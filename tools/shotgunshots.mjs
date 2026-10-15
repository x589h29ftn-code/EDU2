/*
 Het pompgeweer (stap 189, "een pompgeweer, shotgun, ww2 stijl") in de eerste persoon, als foto's.

   shotgun_hand.png      uit de heup: walnoot, geparkeerd staal, het hitteschild met de gaten, het geribde voorhout
   shotgun_richten.png   over de korrel (50°)
   shotgun_pomp.png      net na het schot: het voorhout naar achteren, de grendel uit de kast, de rode huls die eruit vliegt
   shotgun_laden.png     herladen: het geweer op zijn zij, de hand met een patroon onder de laadopening
   shotgun_zij.png       het hele geweer van opzij (rechts), zonder handen
   shotgun_dichtbij.png  (stap 191) de kast met de stempel, het hout, het schild en de riem van dichtbij: de doeken
   shotgun_patroon.png   (stap 191) de rode patroon in de hand

 Laadt alleen js/wapen.js op een lege pagina, dus het duurt seconden. Schrijft ook het aantal driehoeken.

 Gebruik: npm run server &   node tools/shotgunshots.mjs 8123 [map]   (npm run shotgunshots)
*/
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const poort = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
mkdirSync(map, { recursive: true });
const B = 960, H = 540;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: B, height: H } });
page.setDefaultTimeout(600000);
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${poort}/shotgunbank`, { waitUntil: 'load', timeout: 120000 });
await page.setContent(`<!doctype html><html><head>
<style>body{margin:0;background:#20242a}canvas{display:block}</style>
<script type="importmap">{ "imports": { "three": "/lib/three.module.js" } }</script></head><body>
<script type="module">
  import * as THREE from 'three';
  import * as W from '/js/wapen.js';
  const geluid = new Proxy({}, { get: () => () => {} });
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setSize(${B}, ${H}); r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(r.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x9db4c6);
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x4a4238, 1.5));
  const zon = new THREE.DirectionalLight(0xfff2dc, 2.4); zon.position.set(2, 3, 1); scene.add(zon);
  const omg = new THREE.Scene(); omg.background = new THREE.Color(0x8a96a2);
  scene.environment = new THREE.PMREMGenerator(r).fromScene(omg).texture;
  const vloer = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x6f7a55 }));
  vloer.rotation.x = -Math.PI / 2; vloer.position.y = -1.7; scene.add(vloer);
  for (let i = -3; i <= 3; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.2, 0.3), new THREE.MeshStandardMaterial({ color: 0x8a4a2a }));
    p.position.set(i * 3, -0.6, -30); scene.add(p);
  }
  const cam = new THREE.PerspectiveCamera(72, ${B / H}, 0.01, 500); scene.add(cam);
  const w = W.maakTrenchgun(geluid); cam.add(w.groep);
  const stap = (n, opt = {}, dt = 1 / 60) => { for (let i = 0; i < n; i++) w.update(dt, { ammo: 6, ...opt }); };
  const foto = () => { r.render(scene, cam); return r.domElement.toDataURL('image/png'); };
  const uit = {};
  stap(60);
  uit.hand = foto();
  cam.fov = 50; cam.updateProjectionMatrix();
  stap(40, { mik: 1 }); uit.richten = foto();
  cam.fov = 72; cam.updateProjectionMatrix();
  stap(40, { mik: 0 });
  w.vuur(); stap(16); uit.pomp = foto();
  stap(60);
  // herladen: twee patronen achter elkaar, de foto vlak voor de tweede erin gaat
  let h = W.SHOTGUN_PATROON;
  for (let i = 0; i < 44; i++) { h -= 1 / 60; if (h <= 0) h += W.SHOTGUN_PATROON; w.update(1 / 60, { herlaad: h, ammo: 3 }); }
  uit.laden = foto();
  stap(60, { herlaad: 0 });
  // van opzij, zonder handen, met de camera los van het geweer
  w.delen.hand.visible = w.delen.arm.visible = w.delen.linkerhand.visible = false;
  cam.remove(w.groep); scene.add(w.groep);
  w.groep.position.set(0, 0, 0); w.groep.rotation.set(0, 0, 0); w.groep.updateMatrixWorld(true);
  const zcam = new THREE.PerspectiveCamera(30, ${B / H}, 0.01, 50);
  zcam.position.set(1.95, 0.02, -0.19); zcam.lookAt(0, -0.02, -0.19);
  r.render(scene, zcam); uit.zij = r.domElement.toDataURL('image/png');
  // (stap 191) van dichtbij, schuin van linksvoor en boven: de stempel op de kast, het hout, het schild, de riem
  const dcam = new THREE.PerspectiveCamera(32, ${B / H}, 0.01, 50);
  dcam.position.set(-0.26, 0.11, -0.30); dcam.lookAt(0, -0.01, -0.13);
  r.render(scene, dcam); uit.dichtbij = r.domElement.toDataURL('image/png');
  // de patroon in de hand
  w.delen.linkerhand.visible = true; w.delen.patroon.visible = true; w.groep.updateMatrixWorld(true);
  const pp = w.delen.patroon.getWorldPosition(new THREE.Vector3());
  const pcam = new THREE.PerspectiveCamera(30, ${B / H}, 0.01, 50);
  pcam.position.set(pp.x - 0.10, pp.y + 0.05, pp.z - 0.12); pcam.lookAt(pp);
  r.render(scene, pcam); uit.patroon = r.domElement.toDataURL('image/png');
  let drie = 0;
  w.groep.traverse(o => { if (o.isMesh && !o.isInstancedMesh && o.geometry) drie += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  uit.drie = drie;
  window.__uit = uit;
</script></body></html>`);
await page.waitForFunction(() => window.__uit, null, { timeout: 600000 });
const uit = await page.evaluate(() => window.__uit);
for (const n of ['hand', 'richten', 'pomp', 'laden', 'zij', 'dichtbij', 'patroon']) {
  writeFileSync(`${map}/shotgun_${n}.png`, Buffer.from(uit[n].split(',')[1], 'base64'));
  console.log(`${map}/shotgun_${n}.png`);
}
console.log(`driehoeken: ${Math.round(uit.drie)}`);
await browser.close();
