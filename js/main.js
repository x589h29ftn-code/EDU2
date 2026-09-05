// Tinga Sneek – open-wereld FPS in de wijk Tinga.
import * as THREE from 'three';
import { buildWorld, nearestRoadName, colliders, updateLOD, updateProps, radioPlekken } from './world.js';
import { Player } from './player.js';
import { Vehicles } from './vehicles.js';
import { NPCs } from './npc.js';
import { HUD } from './hud.js';
import { isTouchDevice, initTouchControls } from './touch.js';
import { START, toWorld, ROWS, PROPS } from './data.js';
import { initEditor, opgeslagenWijk, pasWijkToe } from './editor.js';
import { initSfeer } from './sfeer.js';
import { initVerhaal, verhaalStart } from './verhaal.js';
import { initInterieur } from './interieur.js';
import { initDerdePersoon } from './derdepersoon.js';
import { bewaarSpel, laadSpel, opslagInfo } from './opslag.js';
import { geluid } from './audio.js';
import { zetKaart, zetStand, startKaart, KAART } from './kaartwereld.js';
import { KLEUR } from './kaartkleuren.js';

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

// Kaart uit BGT en 3D BAG (js/kaart.js). Met ?kaart=oud draait de oude,
// handgetekende kaart uit data.js; met ?boven=1 komt er een orthografisch
// bovenaanzicht van het hele gebied (en met &plat=1 in egale controlekleuren).
const URLP = new URLSearchParams(location.search);
const BOVEN = URLP.has('boven');
if (URLP.get('kaart') !== 'oud') {
  try {
    const k = await import('./kaart.js');
    zetKaart(k.KAART);
    if (BOVEN && URLP.has('plat')) zetStand('plat');
    console.log(`kaart.js van ${k.KAART.gemaakt}: ${k.KAART.panden.length} panden, ${k.KAART.vlakken.length} vlakken`);
  } catch (e) { console.warn('geen js/kaart.js, de oude kaart uit data.js wordt gebruikt', e); }
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

// Beginpunt: op de berm voor Molenkrite 15, met de buurman recht vooruit (zie
// js/verhaal.js). Zonder kaartdata valt het terug op het punt uit de kaart of
// op START uit de oude data.js.
const [ox, oz] = toWorld(START.at[0], START.at[1]);
const beginpunt = verhaalStart() || (KAART ? startKaart() : { x: ox, z: oz, yaw: START.yaw });
const player = new Player(camera, scene, beginpunt.x, beginpunt.z, beginpunt.yaw);
const vehicles = new Vehicles(scene, world.parkSpots);
const npcs = new NPCs(scene, world.roadSegments, 130);
player.applyCamera();   // meteen op ooghoogte op de Molenkrite, ook voor het startscherm
const hud = new HUD();
// Het verhaal: broer Mark voor Molenkrite 15, het gezelschap schuin tegenover,
// de rit naar de waterzuivering, de bewaking en het afleveren bij de boerderij.
// Zonder kaartdata (?kaart=oud) speelt het niet en doet alles niets.
const verhaal = initVerhaal({
  scene, player, hud, vehicles,
  // Ga je neer, dan begint het verhaal bij het laatst opgeslagen spel; is er
  // niets opgeslagen, dan zegt laadSpel false en begint de missie opnieuw.
  opnieuw: () => laadSpel({ player, sfeer, vehicles, verhaal }),
}) || {
  update() {}, toets() { return false; }, doelen() { return []; }, raak() { return false; },
  bewaar() { return null; }, herstel() {}, meldAan() {}, schotGehoord() {}, dood() {}, mislukt() {},
  hinder: { alive: false, opWeg: false, x: 0, z: 0 },
  missie: 'geen', fase: 'geen', aanspreekbaar: false,
};
// De woning achter de voordeur van Molenkrite 15: een losse kamer ruim buiten
// het kaartgebied, met de maten van het echte pand. Bij de deur zet E je naar
// binnen en weer naar buiten (js/interieur.js).
const interieur = initInterieur({ scene, player }) || {
  update() {}, toets() { return false; }, binnen() { return false; }, meldAan() {}, kaart() { return null; },
};
// Binnen wijst de HUD nog steeds de Molenkrite aan (zie hud.kaartVanaf).
function straatOf(x, z) {
  const k = interieur.kaart(x, z);
  hud.kaartVanaf = k ? k.punt : null;
  return k ? k.naam : nearestRoadName(x, z);
}
// Camera over de schouder (V): handig met de auto, en te voet zie je jezelf
// lopen. De hengel wordt ingekort zodra er een muur achter je staat.
const derde = initDerdePersoon({ scene, camera, player });

// Het verkeer moet ook voor de buurman remmen als hij oversteekt. De lijst met
// voetgangers heeft een vaste lengte, dus die zetten we één keer klaar.
const opDeWeg = npcs.people.concat([verhaal.hinder]);
applyEnvIntensity(scene);

// Hoe ver de schrik reikt. Een schot hoor je door de hele straat, een klap van
// een aanrijding wat minder ver; wie binnen die straal loopt, gaat ervandoor.
const PANIEK_SCHOT = 28;
const PANIEK_KLAP = 20;

// Schieten: raycast op auto's en voetgangers
const raycaster = new THREE.Raycaster();
const impactMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
player.shootCb = (camOrigin, camDir) => {
  // in de derde persoon komt de kogel uit de schouder van je poppetje en niet
  // uit de camera, anders schiet je langs jezelf heen
  const { origin, dir } = derde.mikpunt(camOrigin, camDir);
  verhaal.schotGehoord(origin.x, origin.z);      // de bewaking hoort je schieten
  npcs.paniek(origin.x, origin.z, PANIEK_SCHOT); // en de buurt rent weg
  raycaster.set(origin, dir); raycaster.far = 120;
  const targets = [...vehicles.cars.map(c => c.mesh), ...npcs.targets, ...verhaal.doelen()];
  const hits = raycaster.intersectObjects(targets, true);
  if (hits.length) {
    const h = hits[0];
    if (npcs.hit(h.object, h.instanceId)) { geluid.raak(); hud.show('Raak!', 0.8); }
    else if (verhaal.raak(h.object)) { geluid.raak(); hud.show('Raak!', 0.8); }
    else { const car = vehicles.hit(h.object); if (car) { geluid.klap(); hud.show('Auto geraakt', 0.6); } }
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
    geluid.portier(); geluid.motorUit();
    hud.show('Uitgestapt');
  } else {
    const car = vehicles.nearestDriveable(player.pos.x, player.pos.z);
    if (car) {
      vehicles.maakBestuurbaar(car);   // losse wielen, remlichten, verende carrosserie
      player.inCar = car; player.carLook = 0;
      if (derde.aan) derde.achterAuto(car);
      geluid.portier(); geluid.motorAan();
      hud.show(derde.aan ? 'Ingestapt – W om te rijden' : 'Ingestapt – W om te rijden · V voor de camera achter de auto', 3);
    }
  }
}

// Voetgangers aanrijden: js/vehicles.js roept dit aan voor drie punten langs de
// auto zodra hij hard genoeg gaat.
function aanrijden(x, z, straal, snelheid) {
  const n = npcs.aanrijden(x, z, straal, snelheid);
  if (n) {
    geluid.klap();
    npcs.paniek(x, z, PANIEK_KLAP);   // wie het ziet gebeuren rent weg
    hud.show(n > 1 ? `${n} voetgangers aangereden` : 'Voetganger aangereden', 1.4);
  }
  return n;
}

// Camera wisselen tussen eerste en derde persoon.
function wisselCamera() {
  if (!player.active && !window.__autoplay) return;
  if (editor && editor.actief) return;
  const aan = derde.wissel();
  if (aan && player.inCar) derde.achterAuto(player.inCar);
  hud.show(aan ? 'Camera achter je' : 'Camera vanuit je ogen', 1.6);
}
window.addEventListener('keydown', e => {
  if (e.code === 'KeyV' && !e.ctrlKey && !e.metaKey) wisselCamera();
});
// E doet vier dingen, in deze volgorde: een gesprek doorklikken, iemand
// aanspreken die naast je staat, door de voordeur van Molenkrite 15 gaan, en
// anders in- of uitstappen bij een auto.
// In de editor is E omhoog vliegen, dus daar blijft hij van af.
function praatOfAuto() {
  if (!player.active && !window.__autoplay) return;   // op het startscherm niet
  if (editor && editor.actief) return;
  if (verhaal.toets()) return;
  if (interieur.toets()) return;
  toggleCar();
}
window.addEventListener('keydown', e => {
  if (e.code === 'KeyE' && !e.ctrlKey && !e.metaKey) praatOfAuto();
});

// Geluid uit en aan
let stil = false;
window.addEventListener('keydown', e => {
  if (e.code !== 'KeyU' || e.ctrlKey || e.metaKey) return;
  stil = !stil; geluid.demp(stil);
  hud.show(stil ? 'Geluid uit' : 'Geluid aan', 1.8);
});

// ---------- Starten, pauzeren en muisbesturing ----------
// Het spel hangt niet af van muisvergrendeling. Lukt die niet, bijvoorbeeld
// omdat de browser hem blokkeert of de pagina in een frame staat, dan kijk je
// rond door te slepen met de linkerknop en is een korte klik een schot.
const overlay = document.getElementById('overlay');
let dragHint = false;

// Op een aanraakscherm is er geen muis om vast te zetten: dan verschijnt er een
// joystick links en veeg je rechts om rond te kijken.
const touch = IS_TOUCH ? initTouchControls(player, {
  onCar: praatOfAuto,
  onMap: () => hud.toggleBig(),
  onPause: () => pauseGame(),
  onCamera: wisselCamera,
}) : null;

function startGame(vervolg = false) {
  if (vervolg) laadSpelNu();
  gepauzeerd = false;
  overlay.style.display = 'none';
  player.active = true;
  geluid.start();
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
  gepauzeerd = true;
  toonOpslagKeuze();
  overlay.style.display = 'flex';
}

// ---------- Opslaan en laden ----------
// Eén opslagplek: F5 bewaart, F9 zet terug. Staat er iets, dan biedt het
// startscherm 'verder spelen' aan; anders begin je als Erik voor Molenkrite 15.
const startKnop = document.getElementById('start');
const verderKnop = document.getElementById('verder');
const opslagRegel = document.getElementById('opslaginfo');

function tweeCijfers(v) { return String(Math.floor(v)).padStart(2, '0'); }

// Het startscherm doet dubbel werk: bij het opstarten kies je tussen een nieuw
// en een opgeslagen spel, en na Esc is het een pauzescherm waar je doorgaat.
let gepauzeerd = false;
function toonOpslagKeuze() {
  const info = opslagInfo();
  document.body.classList.toggle('heeftopslag', !!info && !gepauzeerd);
  verderKnop.hidden = !info;
  opslagRegel.hidden = !info;
  startKnop.textContent = gepauzeerd ? 'Doorgaan' : info ? 'Nieuw spel' : 'Klik om te spelen';
  verderKnop.textContent = gepauzeerd ? 'Opgeslagen spel laden' : 'Verder spelen';
  if (!info) return;
  const wanneer = new Date(info.tijd).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' });
  const klok = info.uur != null ? ` · ${tweeCijfers(info.uur)}:${tweeCijfers(info.uur % 1 * 60)} uur in het spel` : '';
  opslagRegel.textContent = `Opgeslagen ${wanneer}${info.straat ? ` op de ${info.straat}` : ''}${klok}. In het spel: F5 opslaan, F9 laden.`;
}

function bewaarSpelNu() {
  const gelukt = bewaarSpel({
    player, sfeer, vehicles, verhaal,
    straat: nearestRoadName(camera.position.x, camera.position.z),
  });
  hud.show(gelukt ? 'Spel opgeslagen' : 'Opslaan lukte niet', 2);
  toonOpslagKeuze();
}

function laadSpelNu() {
  const gelukt = laadSpel({ player, sfeer, vehicles, verhaal });
  hud.show(gelukt ? 'Spel geladen' : 'Er is nog geen opgeslagen spel', 2.5);
  return gelukt;
}

window.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (editor && editor.actief) return;      // in de editor bewaart Ctrl+S de wijk
  if (e.code === 'F5') { e.preventDefault(); bewaarSpelNu(); }
  else if (e.code === 'F9') { e.preventDefault(); laadSpelNu(); }
});

startKnop.addEventListener('click', () => startGame(false));
verderKnop.addEventListener('click', () => startGame(true));
// een klik op het beeld doet hetzelfde als de eerste knop
canvas.addEventListener('click', () => { if (!player.active) startGame(!verderKnop.hidden); });
window.addEventListener('keydown', e => {
  if (e.code !== 'Escape') return;
  if (player.active && !document.pointerLockElement) pauseGame();
});
toonOpslagKeuze();
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
  onRebuild: () => { applyEnvIntensity(scene); verhaal.meldAan(); interieur.meldAan(); },
});

// Hoofdlus
let last = performance.now(); let time = 0; let lodKlok = 0;
// Afstand tot de dichtstbijzijnde radio in de wijk; audio.js bepaalt daarmee
// het volume. Null als er geen radio staat.
function afstandTotRadio(x, z) {
  let best = null;
  for (const r of radioPlekken) {
    const d = Math.hypot(x - r.x, z - r.z);
    if (best == null || d < best) best = d;
  }
  return best;
}

function loop() {
  requestAnimationFrame(loop);
  const now = performance.now(); const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
  if (editor && editor.actief) editor.update();
  if (player.active || window.__autoplay) {
    player.update(dt);
    if (player.inCar) {
      const car = player.inCar;
      vehicles.drive(car, player.driveInput(), dt, aanrijden);
      geluid.motorToeren(car.speed, car.topSnelheid || 24);
      // yaw van speler volgt de auto (relatief kijken), zodat de camera vanzelf
      // achter de auto blijft hangen
      if (player.lastCarYaw !== undefined) player.yaw += car.yaw - player.lastCarYaw;
      player.lastCarYaw = car.yaw;
      if (!derde.update(dt, car)) {
        // camera op de bestuurdersstoel (links), meekijken met muis; een
        // bakwagen heeft zijn eigen, hogere stoel (zie vehicles.voegToe)
        const st = car.stoel || { x: -0.38, y: 1.25, z: -0.25 };
        const seat = new THREE.Vector3(st.x, st.y, st.z);
        seat.applyAxisAngle(new THREE.Vector3(0, 1, 0), car.yaw);
        camera.position.set(car.x + seat.x, st.y, car.z + seat.z);
        camera.rotation.set(0, 0, 0, 'YXZ');
        camera.rotation.y = player.yaw; camera.rotation.x = player.pitch;
      }
      player.gun.visible = false;
    } else {
      player.lastCarYaw = undefined;
      derde.update(dt, null);
    }
    vehicles.updateTraffic(dt, player, opDeWeg);
    npcs.update(dt, time);
    verhaal.update(dt);
    interieur.update(dt, verhaal.aanspreekbaar);
    if (player.health <= 0) verhaal.dood();
    // zon en schaduwcamera volgen de speler
    const cx = camera.position.x, cz = camera.position.z;
    sun.position.set(cx + SUN_DIR.x * 150, SUN_DIR.y * 150, cz + SUN_DIR.z * 150);
    sun.target.position.set(cx, 0, cz); sun.target.updateMatrixWorld();
    updateClouds(dt, cx, cz);
    sfeer.update(dt, cx, cz);
    updateProps(dt);
    geluid.omgeving(dt, { weer: sfeer.weer, nacht: sfeer.nacht, binnen: !!player.inCar });
    geluid.radio(afstandTotRadio(cx, cz));
    geluid.autoradio(!!player.inCar);        // rockje uit de speakers in het portier
    lodKlok += dt;
    if (lodKlok > 0.25) { lodKlok = 0; updateLOD(cx, cz); }
    hud.update(dt, player, vehicles, npcs, straatOf(cx, cz), verhaal.aanspreekbaar);
  }
  if (!player.active && !window.__autoplay) {
    // op het startscherm draaien de wolken en de minikaart gewoon door
    player.applyCamera();
    updateClouds(dt, camera.position.x, camera.position.z);
    sfeer.update(dt, camera.position.x, camera.position.z);
    npcs.update(dt, time);
    vehicles.updateTraffic(dt, player, opDeWeg);
    verhaal.update(dt);
    hud.update(dt, player, vehicles, npcs, straatOf(camera.position.x, camera.position.z), verhaal.aanspreekbaar);
  }
  renderer.render(scene, window.__bovenCam || camera);
}
loop();

// Testhaak voor automatische screenshots
window.__game = {
  scene, camera, player, vehicles, npcs, renderer, hud, editor, sfeer, verhaal, interieur, derde,
  opslaan: bewaarSpelNu, laden: laadSpelNu, praat: praatOfAuto, toggleCar, aanrijden, wisselCamera,
};

// Bovenaanzicht (?boven=1&schaal=4[&plat=1]): het hele gebied recht van boven,
// op exact `schaal` pixels per meter, met dezelfde omhullende als de kaartplaat
// uit tools/geo/plaat.mjs. tools/geo/bovenaanzicht.mjs maakt er een PNG van.
if (BOVEN && KAART) {
  const G = KAART.gebied, S = Number(URLP.get('schaal') || 4);
  const W = Math.round((G.x1 - G.x0) * S), H = Math.round((G.z1 - G.z0) * S);
  const ortho = new THREE.OrthographicCamera(-(G.x1 - G.x0) / 2, (G.x1 - G.x0) / 2, (G.z1 - G.z0) / 2, -(G.z1 - G.z0) / 2, 1, 600);
  ortho.position.set((G.x0 + G.x1) / 2, 300, (G.z0 + G.z1) / 2);
  ortho.up.set(0, 0, -1);            // noorden boven
  ortho.lookAt((G.x0 + G.x1) / 2, 0, (G.z0 + G.z1) / 2);
  scene.fog = null;
  const plat = URLP.has('plat');
  if (plat) { renderer.toneMapping = THREE.NoToneMapping; scene.background = new THREE.Color(KLEUR.achtergrond); }
  else { scene.background = new THREE.Color(0xdfe6ee); }
  renderer.shadowMap.enabled = !plat;
  window.__boven = () => {
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    // verkeer en voetgangers uit beeld
    for (const c of vehicles.cars) c.mesh.visible = false;
    for (const t of vehicles.traffic) t.mesh.visible = false;
    for (const m of Object.values(npcs.meshes)) m.visible = false;
    npcs.fiets.visible = false;
    player.gun.visible = false;
    if (verhaal.buurman) verhaal.buurman.groep.visible = false;   // hij hoort bij de mensen
    for (const l of clouds) l.mesh.visible = false;
    if (!plat) { sun.position.set(ortho.position.x + 60, 300, ortho.position.z + 40); sun.target.position.set(ortho.position.x, 0, ortho.position.z); sun.target.updateMatrixWorld(); }
    window.__bovenCam = ortho;
    renderer.render(scene, ortho);
    // meteen uitlezen, in dezelfde tik als het tekenen
    return { W, H, png: renderer.domElement.toDataURL('image/png') };
  };
}
