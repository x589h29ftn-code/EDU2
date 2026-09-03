// Tinga Sneek – open-wereld FPS in de wijk Tinga.
import * as THREE from 'three';
import { buildWorld, nearestRoadName, colliders, updateLOD } from './world.js';
import { Player } from './player.js';
import { Vehicles } from './vehicles.js';
import { NPCs } from './npc.js';
import { HUD } from './hud.js';
import { isTouchDevice, initTouchControls } from './touch.js';
import { START, toWorld, ROWS, PROPS } from './data.js';
import { initEditor, opgeslagenWijk, pasWijkToe } from './editor.js';
import { initSfeer } from './sfeer.js';

const canvas = document.getElementById('game');
const IS_TOUCH = isTouchDevice();
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !IS_TOUCH, powerPreference: 'high-performance' });
// telefoons hebben een hoge pixeldichtheid maar weinig vulkracht
renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_TOUCH ? 1 : 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = null;
scene.fog = new THREE.Fog(0xc3d9ec, 180, 900);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 1200);
scene.add(camera);

// ---------- Lucht met zonneschijf en horizonwaas ----------
// De sfeermodule draait deze vector met de tijd van de dag mee.
const SUN_DIR = new THREE.Vector3(0.42, 0.62, 0.66).normalize();
const skyUniforms = {
  top: { value: new THREE.Color(0x2f6fc4) },
  mid: { value: new THREE.Color(0x8fbde6) },
  bot: { value: new THREE.Color(0xdae8f2) },
  sunDir: { value: SUN_DIR },
};
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyUniforms,
  vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform vec3 top, mid, bot, sunDir;
    varying vec3 vP;
    void main(){
      vec3 dir = normalize(vP);
      float h = dir.y;
      vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.55)) : mix(mid, bot, clamp(-h * 5.0, 0.0, 1.0));
      // waas rond de horizon
      c = mix(c, bot, pow(1.0 - abs(h), 12.0) * 0.7);
      // zonneschijf met halo
      float d = max(dot(dir, normalize(sunDir)), 0.0);
      c += vec3(1.0, 0.95, 0.84) * pow(d, 7000.0) * 2.6;
      c += vec3(1.0, 0.92, 0.76) * pow(d, 22.0) * 0.16;
      gl_FragColor = vec4(c, 1.0);
    }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), skyMat);
sky.frustumCulled = false;
scene.add(sky);

// ---------- Wolkendek ----------
// Zachte cumulusvlekken op twee hoogtes. Ze liggen horizontaal, want vanaf de
// grond zie je de onderkant; dat scheelt billboarden en houdt het op twee calls.
function cloudTexture(seed, wisps) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  let s2 = seed >>> 0 || 1;
  const rnd = () => { s2 = (s2 * 1664525 + 1013904223) >>> 0; return s2 / 4294967296; };
  g.clearRect(0, 0, 256, 256);
  const puffs = wisps ? 14 : 26;
  for (let i = 0; i < puffs; i++) {
    const x = 128 + (rnd() - 0.5) * (wisps ? 210 : 150);
    const y = 128 + (rnd() - 0.5) * (wisps ? 70 : 120);
    const r = (wisps ? 16 : 30) + rnd() * (wisps ? 26 : 46);
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const a = wisps ? 0.16 : 0.5;
    grad.addColorStop(0, `rgba(255,255,255,${a})`);
    grad.addColorStop(0.55, `rgba(252,253,255,${a * 0.55})`);
    grad.addColorStop(1, 'rgba(250,252,255,0)');
    g.fillStyle = grad; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const clouds = [];
function buildCloudLayer(count, tex, yMin, yMax, sizeMin, sizeMax, opacity, drift) {
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, opacity, depthWrite: false, fog: false,
    side: THREE.DoubleSide, blending: THREE.NormalBlending,
  });
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, count);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  const items = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < count; i++) {
    const it = {
      x: (Math.random() - 0.5) * 3000,
      z: (Math.random() - 0.5) * 3000,
      y: yMin + Math.random() * (yMax - yMin),
      s: sizeMin + Math.random() * (sizeMax - sizeMin),
      rot: Math.random() * Math.PI,
      ar: 0.55 + Math.random() * 0.5,
    };
    items.push(it);
    e.set(-Math.PI / 2, 0, it.rot);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.s, it.s * it.ar, 1));
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);
  clouds.push({ mesh, items, drift, m, q, e });
  return mesh;
}
buildCloudLayer(46, cloudTexture(7, false), 240, 340, 160, 420, 0.95, 3.2);
buildCloudLayer(26, cloudTexture(23, true), 460, 620, 380, 900, 0.5, 1.5);

function updateClouds(dt, camX, camZ) {
  for (const layer of clouds) {
    const { mesh, items, drift, m, q, e } = layer;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      it.x += drift * dt;
      // laat de wolken meelopen met de speler, zodat de lucht nooit leegloopt
      if (it.x - camX > 1600) it.x -= 3200;
      if (it.x - camX < -1600) it.x += 3200;
      if (it.z - camZ > 1600) it.z -= 3200;
      if (it.z - camZ < -1600) it.z += 3200;
      e.set(-Math.PI / 2, 0, it.rot);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.s, it.s * it.ar, 1));
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------- Verlichting ----------
// Omgevingslicht komt uit een environment map die uit de lucht zelf wordt
// gerenderd; dat geeft baksteen, glas en lak veel natuurlijker aanzetten dan
// een vlakke hemisphere light.
const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
{
  const envScene = new THREE.Scene();
  const envSky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMat.clone());
  envScene.add(envSky);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshBasicMaterial({ color: 0x5d7a46, side: THREE.DoubleSide }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -6;
  envScene.add(ground);
  const rt = pmrem.fromScene(envScene, 0, 0.1, 200);
  scene.environment = rt.texture;
  envSky.geometry.dispose();
}
pmrem.dispose();

const hemi = new THREE.HemisphereLight(0xd2e2f6, 0x6e8154, 0.75);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3e0, 2.2);
sun.castShadow = true;
// 2048 over een strakkere doos is vier keer goedkoper dan 4096 over 156 m en
// nauwelijks van elkaar te onderscheiden; op een telefoon scheelt dat het meest.
sun.shadow.mapSize.set(IS_TOUCH ? 1024 : 2048, IS_TOUCH ? 1024 : 2048);
sun.shadow.camera.near = 8; sun.shadow.camera.far = 230;
const SHADOW_R = 52;
sun.shadow.camera.left = -SHADOW_R; sun.shadow.camera.right = SHADOW_R;
sun.shadow.camera.top = SHADOW_R; sun.shadow.camera.bottom = -SHADOW_R;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.035;
sun.shadow.radius = 2.2;
scene.add(sun); scene.add(sun.target);
// zwak tegenlicht zodat schaduwzijden niet dichtlopen
const fill = new THREE.DirectionalLight(0xcfe0f2, 0.8);
fill.position.set(-SUN_DIR.x * 150, 90, -SUN_DIR.z * 150);
scene.add(fill);

// Eigen huizenrijen: js/rows.user.js (uit de editor, Ctrl+S) gaat voor op
// data.js; staat dat bestand er niet, dan tellen de wijzigingen in de browser.
try {
  const eigen = await import('./rows.user.js');
  pasWijkToe({ rows: eigen.ROWS, props: eigen.PROPS });
  console.log(`rows.user.js geladen: ${ROWS.length} rijen, ${PROPS.length} objecten`);
} catch { /* geen eigen bestand, dat is prima */ }
{
  const lokaal = opgeslagenWijk();
  if (lokaal) { pasWijkToe(lokaal); console.log(`uit de browser-opslag: ${ROWS.length} rijen, ${PROPS.length} objecten`); }
}

// Wereld
const t0 = performance.now();
const world = buildWorld(scene);
console.log(`Wereld gebouwd in ${Math.round(performance.now() - t0)} ms, ${colliders.length} colliders, ${world.parkSpots.length} auto's`);

// Omgevingslicht sterker laten meewegen. three r160 heeft nog geen
// scene.environmentIntensity, dus het gaat per materiaal.
function applyEnvIntensity(root, v = 1.7) {
  const seen = new Set();
  root.traverse(o => {
    const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    for (const m of mats) {
      if (!m || seen.has(m) || !m.isMeshStandardMaterial) continue;
      seen.add(m);
      m.envMapIntensity = m.metalness > 0.4 ? v * 0.8 : v;
      m.needsUpdate = true;
    }
  });
}
applyEnvIntensity(scene);

const [sx, sz] = toWorld(START.at[0], START.at[1]);
const player = new Player(camera, scene, sx, sz, START.yaw);
const vehicles = new Vehicles(scene, world.parkSpots);
const npcs = new NPCs(scene, world.roadSegments, 130);
player.applyCamera();   // meteen op ooghoogte op de Molenkrite, ook voor het startscherm
const hud = new HUD();
applyEnvIntensity(scene);

// Schieten: raycast op auto's en voetgangers
const raycaster = new THREE.Raycaster();
const impactMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
player.shootCb = (origin, dir) => {
  raycaster.set(origin, dir); raycaster.far = 120;
  const targets = [...vehicles.cars.map(c => c.mesh), ...npcs.targets];
  const hits = raycaster.intersectObjects(targets, true);
  if (hits.length) {
    const h = hits[0];
    if (npcs.hit(h.object, h.instanceId)) hud.show('Raak!', 0.8);
    else { const car = vehicles.hit(h.object); if (car) hud.show('Auto geraakt', 0.6); }
    const mark = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), impactMat); mark.position.copy(h.point); scene.add(mark);
    setTimeout(() => scene.remove(mark), 8000);
  }
};

// In- en uitstappen
function toggleCar() {
  if (!player.active) return;
  if (player.inCar) {
    const car = player.inCar; player.inCar = null;
    const side = new THREE.Vector3(Math.cos(car.yaw), 0, -Math.sin(car.yaw)).multiplyScalar(-1.6);
    player.pos.set(car.x + side.x, 0, car.z + side.z); player.yaw = car.yaw; player.pitch = 0;
    hud.show('Uitgestapt');
  } else {
    const car = vehicles.nearestDriveable(player.pos.x, player.pos.z);
    if (car) { player.inCar = car; player.carLook = 0; hud.show('Ingestapt – W om te rijden'); }
  }
}
window.addEventListener('keydown', e => { if (e.code === 'KeyE') toggleCar(); });

// ---------- Starten, pauzeren en muisbesturing ----------
// Het spel hangt niet af van muisvergrendeling. Lukt die niet, bijvoorbeeld
// omdat de browser hem blokkeert of de pagina in een frame staat, dan kijk je
// rond door te slepen met de linkerknop en is een korte klik een schot.
const overlay = document.getElementById('overlay');
let dragHint = false;

// Op een aanraakscherm is er geen muis om vast te zetten: dan verschijnt er een
// joystick links en veeg je rechts om rond te kijken.
const touch = IS_TOUCH ? initTouchControls(player, {
  onCar: toggleCar,
  onMap: () => hud.toggleBig(),
  onPause: () => pauseGame(),
}) : null;

function startGame() {
  overlay.style.display = 'none';
  player.active = true;
  if (touch) {
    touch.setVisible(true);
    // volledig scherm en dwars: op een telefoon scheelt dat de halve browserbalk
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
    hud.show('Links lopen · rechts kijken', 4);
    return;
  }
  const req = canvas.requestPointerLock({ unadjustedMovement: true });
  const fallback = () => {
    const again = canvas.requestPointerLock();
    if (again && again.catch) again.catch(() => useDragMode());
  };
  if (req && req.catch) req.catch(fallback);
  // Lukt de vergrendeling binnen een halve seconde niet, dan slepen we.
  setTimeout(() => { if (!document.pointerLockElement) useDragMode(); }, 500);
}

function useDragMode() {
  if (dragHint) return;
  dragHint = true;
  hud.show('Sleep met de linkermuisknop om rond te kijken', 5);
}

function pauseGame() {
  player.active = false;
  if (touch) touch.setVisible(false);
  overlay.style.display = 'flex';
}

document.getElementById('start').addEventListener('click', startGame);
canvas.addEventListener('click', () => { if (!player.active) startGame(); });
window.addEventListener('keydown', e => {
  if (e.code !== 'Escape') return;
  if (player.active && !document.pointerLockElement) pauseGame();
});
document.addEventListener('pointerlockchange', () => {
  // Esc geeft de muis vrij; dan pauzeren we ook echt.
  if (!document.pointerLockElement && player.active && !dragHint) pauseGame();
});

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);
// draaien van de telefoon meldt zich soms pas na de resize
window.addEventListener('orientationchange', () => setTimeout(resize, 250));

// Sfeer: tijd van de dag, weer, wind, stromend water en straatverlichting
const sfeer = initSfeer({
  scene, camera, renderer, sun, hemi, fill, skyUniforms, hud,
  zonRichting: SUN_DIR,
});

// Wijkeditor (F2)
const editor = initEditor({
  scene, camera, player, hud, npcs, vehicles,
  onRebuild: () => { applyEnvIntensity(scene); },
});

// Hoofdlus
let last = performance.now(); let time = 0; let lodKlok = 0;
function loop() {
  requestAnimationFrame(loop);
  const now = performance.now(); const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
  if (editor && editor.actief) editor.update();
  if (player.active || window.__autoplay) {
    player.update(dt);
    if (player.inCar) {
      const car = player.inCar;
      vehicles.drive(car, player.driveInput(), dt);
      // camera op de bestuurdersstoel (links), meekijken met muis
      const seat = new THREE.Vector3(-0.38, 1.25, -0.25);
      seat.applyAxisAngle(new THREE.Vector3(0, 1, 0), car.yaw);
      camera.position.set(car.x + seat.x, seat.y, car.z + seat.z);
      camera.rotation.set(0, 0, 0, 'YXZ');
      camera.rotation.y = player.yaw; camera.rotation.x = player.pitch;
      // yaw van speler volgt de auto (relatief kijken)
      if (player.lastCarYaw !== undefined) player.yaw += car.yaw - player.lastCarYaw;
      player.lastCarYaw = car.yaw;
      player.gun.visible = false;
    } else player.lastCarYaw = undefined;
    vehicles.updateTraffic(dt);
    npcs.update(dt, time);
    // zon en schaduwcamera volgen de speler
    const cx = camera.position.x, cz = camera.position.z;
    sun.position.set(cx + SUN_DIR.x * 150, SUN_DIR.y * 150, cz + SUN_DIR.z * 150);
    sun.target.position.set(cx, 0, cz); sun.target.updateMatrixWorld();
    updateClouds(dt, cx, cz);
    sfeer.update(dt, cx, cz);
    lodKlok += dt;
    if (lodKlok > 0.25) { lodKlok = 0; updateLOD(cx, cz); }
    hud.update(dt, player, vehicles, npcs, nearestRoadName(cx, cz));
  }
  if (!player.active && !window.__autoplay) {
    // op het startscherm draaien de wolken en de minikaart gewoon door
    player.applyCamera();
    updateClouds(dt, camera.position.x, camera.position.z);
    sfeer.update(dt, camera.position.x, camera.position.z);
    npcs.update(dt, time);
    vehicles.updateTraffic(dt);
    hud.update(dt, player, vehicles, npcs, nearestRoadName(camera.position.x, camera.position.z));
  }
  renderer.render(scene, camera);
}
loop();

// Testhaak voor automatische screenshots
window.__game = { scene, camera, player, vehicles, npcs, renderer, hud, editor, sfeer };
