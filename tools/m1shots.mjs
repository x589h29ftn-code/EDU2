/*
 De M1 Garand in de eerste persoon (verzoek 10 okt 2026), als foto's.

   m1_hand.png       het geweer in je hand, uit de heup: walnoot, geparkeerd staal, het achtervizier met de
                     diopter en de twee knoppen, de clip met de bovenste patroon onder de grendel
   m1_vizier.png     over het vizier: de korrel in de ring
   m1_ping.png       net na het achtste schot: de grendel open en de lege clip die omhoog wegspringt
   m1_herladen.png   tijdens het herladen: de hand met de volle clip (2 × 4) boven de open grendel
   m1_zij.png        het hele geweer van opzij (rechts), zonder handen: naast de zijfoto te leggen (stap 133)
   m1_dichtbij.png   de kast, de hendel, het hout en de riem van dichtbij en schuin: de doeken (stap 134)
   m1_169.png        uit de heup in 16:9 (1280 × 720) met de beeldhoek van het spel (72° verticaal), naast de foto uit
                     Hell Let Loose te leggen (stap 135)
   m1_vizierdicht.png het achtervizier en de hiel van dichtbij, van achteren zoals de speler ze ziet (stap 135)
   m1_richten.png    aangelegd in 16:9 met de beeldhoek van de M1 (42°): door de ring, de korrel in het midden (stap 138)
   m1_herladen_1..4.png het herladen in vier beelden, 16:9 (stap 138)

 Meet ook (stap 135) waar het vizier op het scherm staat, als fractie van de breedte en de hoogte en in eenheden van de
 breedte over de twee knoppen: zo is het te vergelijken met de eerste-persoonsfoto's van de gebruiker (docs/METHODIEK.md).

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
  /*
   De maat (stap 135): de punten van het vizier, de korrel, de hiel en de linkerhand naar het scherm, in beeldpunten.
   span is de breedte over de twee knoppen; de rest staat als fractie van het beeld of in eenheden van span.
  */
  function meet(B, H) {
    const P = w.meetpunten, wap = w.groep.children[0];
    cam.updateMatrixWorld(true); w.groep.updateMatrixWorld(true);
    const naar = (x, y, z) => { const v = wap.localToWorld(new THREE.Vector3(x, y, z)).project(cam); return [(v.x + 1) / 2 * B, (1 - v.y) / 2 * H]; };
    const rand = (cx, cy, cz, r, as) => Array.from({ length: 24 }, (_, i) => {
      const a = i / 24 * Math.PI * 2, c = Math.cos(a) * r, s = Math.sin(a) * r;
      return as === 'x' ? naar(cx, cy + c, cz + s) : naar(cx + c, cy + s, cz);
    });
    const kL = rand(-P.knop.x, P.knop.y, P.vizierZ, P.knop.r, 'x'), kR = rand(P.knop.x, P.knop.y, P.vizierZ, P.knop.r, 'x');
    const links = Math.min(...kL.map(p => p[0])), rechts = Math.max(...kR.map(p => p[0]));
    const span = rechts - links;
    const ring = naar(0, P.vizierY, P.vizierZ), ringRand = rand(0, P.vizierY, P.vizierZ, P.ringR, 'z');
    const ringD = Math.max(...ringRand.map(p => p[0])) - Math.min(...ringRand.map(p => p[0]));
    const knik = naar(0, P.hielKnik[1], P.hielKnik[0]);
    const korrel = naar(0, P.korrel.y, P.korrel.z);
    const hielL = naar(-P.hielB / 2, P.hielAchter[1], P.hielAchter[0]), hielR = naar(P.hielB / 2, P.hielAchter[1], P.hielAchter[0]);
    // de linkerhand: alleen de huid (dezelfde stof als de rechterhand), niet de mouw
    const huid = w.delen.hand.children[0].material;
    let hx0 = 1e9, hx1 = -1e9, hy0 = 1e9, hy1 = -1e9;
    w.delen.linkerhand.traverse(o => {
      if (!o.isMesh || o.material !== huid) return;
      const A = o.geometry.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < A.count; i++) {
        v.fromBufferAttribute(A, i); o.localToWorld(v); v.project(cam);
        const x = (v.x + 1) / 2 * B, y = (1 - v.y) / 2 * H;
        hx0 = Math.min(hx0, x); hx1 = Math.max(hx1, x); hy0 = Math.min(hy0, y); hy1 = Math.max(hy1, y);
      }
    });
    const f = (v) => +v.toFixed(3);
    return {
      beeld: B + "x" + H, knoppenBreed_W: f(span / B), ring_x: f(ring[0] / B), ring_y: f(ring[1] / H),
      korrel_x: f(korrel[0] / B), korrel_y: f(korrel[1] / H),
      ringNaarKorrel_span: [f((korrel[0] - ring[0]) / span), f((korrel[1] - ring[1]) / span)],
      ringDoorsnede_span: f(ringD / span), ringBovenHiel_span: f((knik[1] - ring[1]) / span),
      hielAchter_span: f((hielR[0] - hielL[0]) / span), hielAchter_y: f(hielL[1] / H),
      hand_span: f((Math.min(hx1, B) - Math.max(hx0, 0)) / span), hand_x: f((hx0 + hx1) / 2 / B), hand_y: f((hy0 + hy1) / 2 / H),
    };
  }
  window.__maat = { hand: meet(${B}, ${H}) };
  // dezelfde stand in 16:9, met de beeldhoek van het spel (js/main.js: 72° verticaal)
  r.setSize(1280, 720); cam.aspect = 16 / 9; cam.updateProjectionMatrix();
  window.__maat.b169 = meet(1280, 720);
  uit['169'] = foto();
  r.setSize(${B}, ${H}); cam.aspect = ${B / H}; cam.updateProjectionMatrix();
  uit.hand = foto();
  // over het vizier, met de beeldhoek van de M1 (stap 138: 42° in plaats van 54)
  cam.fov = 72 * w.mikBeeld; cam.updateProjectionMatrix();
  stap(30, { mik: 1 });
  uit.vizier = foto();
  /*
   Aangelegd in 16:9 (stap 138): het hart van de ring en de top van de korrel op het scherm, in beeldpunten van het
   midden, en de ring (buiten) en het gat als deel van de beeldhoogte.
  */
  r.setSize(1280, 720); cam.aspect = 16 / 9; cam.updateProjectionMatrix();
  {
    const P = w.meetpunten, wap = w.groep.children[0];
    cam.updateMatrixWorld(true); w.groep.updateMatrixWorld(true);
    const naar = (x, y, z) => { const v = wap.localToWorld(new THREE.Vector3(x, y, z)).project(cam); return [(v.x + 1) / 2 * 1280, (1 - v.y) / 2 * 720]; };
    const ring = naar(0, P.vizierY, P.vizierZ), korrel = naar(0, P.korrel.y, P.korrel.z);
    const boven = naar(0, P.vizierY + P.ringR, P.vizierZ), onder = naar(0, P.vizierY - P.ringR, P.vizierZ);
    const gatB = naar(0, P.vizierY + 0.0033, P.vizierZ), gatO = naar(0, P.vizierY - 0.0033, P.vizierZ);
    const f = (v) => +v.toFixed(3);
    window.__maat.richten = {
      fov: cam.fov, ring_px: [f(ring[0] - 640), f(ring[1] - 360)], korrel_px: [f(korrel[0] - 640), f(korrel[1] - 360)],
      ring_H: f((onder[1] - boven[1]) / 720), gat_H: f((gatO[1] - gatB[1]) / 720),
    };
  }
  uit.richten = foto();
  r.setSize(${B}, ${H}); cam.aspect = ${B / H}; cam.updateProjectionMatrix();
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
  /*
   (stap 138) een reeks in 16:9: de put naar je toe en de hand op weg (0,30), de clip boven de put (0,47), de duim
   drukt (0,57), de hand schiet weg als de grendel dichtslaat (0,655); en de oude foto (0,45) in het gewone formaat
  */
  r.setSize(1280, 720); cam.aspect = 16 / 9; cam.updateProjectionMatrix();
  const reeks = [0.30, 0.47, 0.57, 0.655];
  for (let i = 0; i < reeks.length; i++) {
    while (t < reeks[i] * T) { w.update(1 / 60, { herlaad: T - t, ammo: 0, reserve: 48 }); t += 1 / 60; }
    uit['herladen_' + (i + 1)] = foto();
    if (i === 1) {
      r.setSize(${B}, ${H}); cam.aspect = ${B / H}; cam.updateProjectionMatrix();
      uit.herladen = foto();
      r.setSize(1280, 720); cam.aspect = 16 / 9; cam.updateProjectionMatrix();
    }
  }
  r.setSize(${B}, ${H}); cam.aspect = ${B / H}; cam.updateProjectionMatrix();
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
  // het achtervizier en de hiel van dichtbij, van achter en boven, zoals de speler ze ziet (stap 135)
  const vd = new THREE.PerspectiveCamera(30, ${B / H}, 0.01, 20);
  vd.position.set(0.035, 0.150, 0.170); vd.lookAt(0.0, 0.040, -0.040);
  r.render(scene, vd); uit.vizierdicht = r.domElement.toDataURL('image/png');
  window.__fotos = uit;
</script></body></html>`);
await page.waitForFunction(() => window.__fotos, null, { timeout: 120000 });
const fotos = await page.evaluate(() => window.__fotos);
console.log('driehoeken in het model:', await page.evaluate(() => window.__tris));
console.log('maat (stap 135):', JSON.stringify(await page.evaluate(() => window.__maat), null, 1));
console.log('textuurgeheugen van het wapen:', JSON.stringify(await page.evaluate(() => window.__geheugen)));
const { writeFileSync } = await import('node:fs');
for (const [naam, data] of Object.entries(fotos)) {
  const pad = `${map}/m1_${naam}.png`;
  writeFileSync(pad, Buffer.from(data.split(',')[1], 'base64'));
  console.log(pad);
}
await browser.close();
