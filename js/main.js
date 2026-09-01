// Tinga Sneek – open-wereld FPS in de wijk Tinga.
import * as THREE from 'three';
import { buildWorld, nearestRoadName, colliders } from './world.js';
import { Player } from './player.js';
import { Vehicles } from './vehicles.js';
import { NPCs } from './npc.js';
import { HUD } from './hud.js';
import { START, toWorld } from './data.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fc4e8);
scene.fog = new THREE.Fog(0xb9d3ea, 120, 650);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 1200);
scene.add(camera);

// Lucht: grote koepel met verloop
{
  const skyGeo = new THREE.SphereGeometry(1000, 24, 12);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x3f7fcf) }, mid: { value: new THREE.Color(0x9fc4e8) }, bot: { value: new THREE.Color(0xd9e6f2) } },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top,mid,bot; varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 c = h>0.0 ? mix(mid, top, pow(h,0.6)) : mix(mid, bot, clamp(-h*4.0,0.0,1.0)); gl_FragColor = vec4(c,1.0); }`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat); scene.add(sky);
  // wolken (platte sprites)
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false });
  for (let i = 0; i < 40; i++) {
    const w = 60 + Math.random() * 120;
    const c = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.35), cloudMat);
    c.position.set((Math.random() - 0.5) * 1600, 180 + Math.random() * 120, (Math.random() - 0.5) * 1600);
    c.rotation.x = -Math.PI / 2; scene.add(c);
  }
}

// Licht
const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x4d5b3a, 0.75);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
sun.position.set(70, 150, 110);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 20; sun.shadow.camera.far = 500;
sun.shadow.camera.left = -110; sun.shadow.camera.right = 110; sun.shadow.camera.top = 110; sun.shadow.camera.bottom = -110;
sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03;
scene.add(sun); scene.add(sun.target);

// Wereld
const t0 = performance.now();
const world = buildWorld(scene);
console.log(`Wereld gebouwd in ${Math.round(performance.now() - t0)} ms, ${colliders.length} colliders, ${world.parkSpots.length} auto's`);

const [sx, sz] = toWorld(START.at[0], START.at[1]);
const player = new Player(camera, scene, sx, sz, START.yaw);
const vehicles = new Vehicles(scene, world.parkSpots);
const npcs = new NPCs(scene, world.roadSegments, 18);
const hud = new HUD();

// Schieten: raycast op auto's en voetgangers
const raycaster = new THREE.Raycaster();
const impactMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
player.shootCb = (origin, dir) => {
  raycaster.set(origin, dir); raycaster.far = 120;
  const targets = [...vehicles.cars.map(c => c.mesh), ...npcs.people.map(p => p.mesh)];
  const hits = raycaster.intersectObjects(targets, true);
  if (hits.length) {
    const h = hits[0];
    if (npcs.hit(h.object)) hud.show('Raak!', 0.8);
    else { const car = vehicles.hit(h.object); if (car) hud.show('Auto geraakt', 0.6); }
    const mark = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), impactMat); mark.position.copy(h.point); scene.add(mark);
    setTimeout(() => scene.remove(mark), 8000);
  }
};

// In- en uitstappen
window.addEventListener('keydown', e => {
  if (e.code !== 'KeyE' || !player.locked) return;
  if (player.inCar) {
    const car = player.inCar; player.inCar = null;
    const side = new THREE.Vector3(Math.cos(car.yaw), 0, -Math.sin(car.yaw)).multiplyScalar(-1.6);
    player.pos.set(car.x + side.x, 0, car.z + side.z); player.yaw = car.yaw; player.pitch = 0;
    hud.show('Uitgestapt');
  } else {
    const car = vehicles.nearestDriveable(player.pos.x, player.pos.z);
    if (car) { player.inCar = car; player.carLook = 0; hud.show('Ingestapt – W om te rijden'); }
  }
});

// Pointer lock / startscherm
const overlay = document.getElementById('overlay');
document.getElementById('start').addEventListener('click', () => { canvas.requestPointerLock(); });
document.addEventListener('pointerlockchange', () => {
  overlay.style.display = document.pointerLockElement ? 'none' : 'flex';
});
canvas.addEventListener('click', () => { if (!document.pointerLockElement) canvas.requestPointerLock(); });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Hoofdlus
let last = performance.now(); let time = 0;
function loop() {
  requestAnimationFrame(loop);
  const now = performance.now(); const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
  if (player.locked || window.__autoplay) {
    player.update(dt);
    if (player.inCar) {
      const car = player.inCar;
      vehicles.drive(car, player.keys, dt);
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
    sun.position.set(cx + 70, 150, cz + 110); sun.target.position.set(cx, 0, cz); sun.target.updateMatrixWorld();
    // water laten bewegen
    hud.update(dt, player, vehicles, npcs, nearestRoadName(cx, cz));
  }
  renderer.render(scene, camera);
}
loop();

// Testhaak voor automatische screenshots
window.__game = { scene, camera, player, vehicles, npcs, renderer, hud };
