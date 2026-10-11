/*
 De M1 Garand in de eerste persoon (verzoek 10 okt 2026), als foto's.

   m1_hand.png       het geweer in je hand, uit de heup: walnoot, geparkeerd staal, het achtervizier met de
                     diopter en de twee knoppen, de clip met de bovenste patroon onder de grendel
   m1_vizier.png     over het vizier: de korrel in de ring
   m1_ping.png       net na het achtste schot: de grendel open en de lege clip die omhoog wegspringt
   m1_herladen.png   tijdens het herladen: de hand met de volle clip (2 × 4) boven de open grendel
   m1_zij.png        het hele geweer van opzij (rechts), zonder handen: naast de zijfoto te leggen (stap 133)
   m1_dichtbij.png   de kast, de hendel, het hout en de riem van dichtbij en schuin: de doeken (stap 134)

 Schrijft ook het aantal driehoeken van het model (alles in `groep`, zonder de losse hulzen en de damp).

 Laadt alleen js/wapen.js op een lege pagina (zoals tools/terugslagshots.mjs), dus het duurt seconden.

 Gebruik: npm run server &   node tools/m1shots.mjs 8123 [map]   (npm run m1shots)
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const poort = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
mkdirSync(map, { recursive: true });
const B = 900, H = 560;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: B, height: H } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${poort}/m1bank`, { waitUntil: 'load', timeout: 120000 });
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
  // een omgeving om in te spiegelen, zoals het spel die bakt (js/main.js): anders is metaal zwart
  const omg = new THREE.Scene(); omg.background = new THREE.Color(0x8a96a2);
  scene.environment = new THREE.PMREMGenerator(r).fromScene(omg).texture;
  const vloer = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x6f7a55 }));
  vloer.rotation.x = -Math.PI / 2; vloer.position.y = -1.7; scene.add(vloer);
  // een paar paaltjes in de verte, zodat je ziet waar het vizier op staat
  for (let i = -3; i <= 3; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.2, 0.3), new THREE.MeshStandardMaterial({ color: 0x8a4a2a }));
    p.position.set(i * 3, -0.6, -30); scene.add(p);
  }
  const cam = new THREE.PerspectiveCamera(72, ${B / H}, 0.01, 500); scene.add(cam);
  const w = W.maakGarand(geluid); cam.add(w.groep);
  const stap = (n, opt = {}, dt = 1 / 60) => { for (let i = 0; i < n; i++) w.update(dt, { ammo: 8, reserve: 48, ...opt }); };
  const foto = () => { r.render(scene, cam); return r.domElement.toDataURL('image/png'); };
  const uit = {};
  stap(60);
  uit.hand = foto();
  // over het vizier
  cam.fov = 54; cam.updateProjectionMatrix();
  stap(30, { mik: 1 });
  uit.vizier = foto();
  cam.fov = 72; cam.updateProjectionMatrix();
  stap(30);
  // het achtste schot: de grendel blijft open en de clip springt eruit
  w.vuur({ leeg: true });
  stap(9, { ammo: 0 });
  w.delen.flits.visible = false;
  uit.ping = foto();
  stap(90, { ammo: 0 });
  // herladen: de hand met de volle clip boven de open grendel
  const T = W.GARAND_HERLAAD;
  let t = 0;
  while (t < 0.40 * T) { w.update(1 / 60, { herlaad: T - t, ammo: 0, reserve: 48 }); t += 1 / 60; }
  uit.herladen = foto();
  // het hele geweer van opzij, de loop naar rechts, zonder handen (stap 133)
  while (t < T) { w.update(1 / 60, { herlaad: T - t, ammo: 0, reserve: 48 }); t += 1 / 60; }
  stap(30);
  let tris = 0;
  w.groep.traverse(o => {
    if (!o.isMesh || o === w.delen.hulzen || w.delen.rook.includes(o) || o.parent === w.delen.flits) return;
    if (o.parent === w.delen.legeClip || o.parent?.parent === w.delen.legeClip) return;
    const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  window.__tris = tris;
  // het textuurgeheugen van het wapen (stap 134): elk doek één keer, vier bytes per beeldpunt, plus een derde voor de mipmaps
  const tex = new Set();
  w.groep.traverse(o => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) for (const k of ['map', 'normalMap', 'roughnessMap']) if (m[k]) tex.add(m[k]);
  });
  let bytes = 0; const maten = {};
  for (const t of tex) { const b = t.image.width, h = t.image.height; bytes += b * h * 4 * 4 / 3; maten[b] = (maten[b] || 0) + 1; }
  window.__geheugen = { mb: +(bytes / 1048576).toFixed(1), doeken: tex.size, maten };
  for (const d of [w.delen.hand, w.delen.arm, w.delen.linkerhand]) d.visible = false;
  cam.remove(w.groep); scene.add(w.groep);
  w.groep.position.set(0, 0, 0); w.groep.rotation.set(0, 0, 0); w.groep.updateMatrixWorld(true);
  vloer.visible = false; scene.background = new THREE.Color(0xeeeeec);
  const zij = new THREE.PerspectiveCamera(20, ${B / H}, 0.05, 20);
  zij.position.set(2.0, 0.0, -0.22); zij.lookAt(0, -0.02, -0.22);
  r.render(scene, zij); uit.zij = r.domElement.toDataURL('image/png');
  // van dichtbij, schuin van rechtsboven op de kast, de hendel en het hout: zie je de doeken (stap 134)
  const dicht = new THREE.PerspectiveCamera(30, ${B / H}, 0.01, 20);
  dicht.position.set(0.20, 0.13, 0.10); dicht.lookAt(0.0, 0.0, -0.13);
  r.render(scene, dicht); uit.dichtbij = r.domElement.toDataURL('image/png');
  window.__fotos = uit;
</script></body></html>`);
await page.waitForFunction(() => window.__fotos, null, { timeout: 120000 });
const fotos = await page.evaluate(() => window.__fotos);
console.log('driehoeken in het model:', await page.evaluate(() => window.__tris));
console.log('textuurgeheugen van het wapen:', JSON.stringify(await page.evaluate(() => window.__geheugen)));
const { writeFileSync } = await import('node:fs');
for (const [naam, data] of Object.entries(fotos)) {
  const pad = `${map}/m1_${naam}.png`;
  writeFileSync(pad, Buffer.from(data.split(',')[1], 'base64'));
  console.log(pad);
}
await browser.close();
