/*
 Foto's van de vijf cacheplekken van de Tinga Cache (npm run cacheplekshots). Per cache twee foto's in docs/screenshots/:
   cacheplek_<n>_dichtbij.png   het kistje van ~3,5 m, op ooghoogte, waar je het zelf zou zien
   cacheplek_<n>_omgeving.png   de plek van ~16 m en wat hoger, zodat je ziet waar het is
 en cacheplek_3_bordje.png (stap 1 van de multi, het bordje bij de vishandel).

 De camera kiest per plek uit zestien richtingen de eerste waar de lijn naar het kistje vrij is (geen pand, muur of boom ertussen,
 gemeten met een straal) en de camera zelf niet in een botsdoos staat. Alle caches staan open in beeld (gevonden 4: de eerste vier
 met het deksel open, de vijfde dicht).

 Gebruik: npm run server &  node tools/cacheplekshots.mjs [poort] [map]
*/
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const poort = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(900000);
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  window.__W = await import('/js/world.js');
  const g = window.__game; g.reliëfAf();
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('ui').style.display = 'none';
  const v = g.verhaal, P = g.player;
  P.active = true; window.__autoplay = true;
  const s = v.bewaar(); Object.assign(s, { missie: 'klaar', fase: 'klaar', volgende: null, uitzendingKlaar: true, invalKlaar: true, ronaldKlaar: true, roanKlaar: true, noMercyKlaar: true, geld: 5000 });
  v.herstel(s);
  g.geocache.herstel({ gps: true, intro: true, gevonden: 4, invoer: '' });
  g.sfeer.uur = 14; g.sfeer.weer = 'helder';
  if (g.vehicles) g.vehicles.bevries = true;
});

const schrijf = (naam, data) => { writeFileSync(`${map}/${naam}.png`, Buffer.from(data.split(',')[1], 'base64')); console.log(`${map}/${naam}.png`); };

// alles in één evaluate per foto: kies de richting, zet de camera, teken en lees uit
const neem = (doel, afstand, hoogte, voorkeur = 0) => page.evaluate(async ({ doel, afstand, hoogte, voorkeur }) => {
  const g = window.__game, C = g.camera, W = window.__W, sc = g.scene;
  const THREE = await import('three');
  const ray = new THREE.Raycaster();
  const kist = []; sc.traverse(o => { if (o.userData && o.userData.deksel) kist.push(o); });
  const doelV = new THREE.Vector3(doel.x, doel.y, doel.z);
  W.updateLOD(doel.x, doel.z); sc.updateMatrixWorld(true);
  // wat de lijn mag blokkeren: zichtbare meshes op laag 0, niet het kistje zelf
  const mag = []; sc.traverse(o => { if (o.isMesh && o.visible && o.layers.mask & 1 && !kist.some(k => k === o || k.getObjectById(o.id))) mag.push(o); });
  let beste = null;
  for (let i = 0; i < 16; i++) {
    const a = voorkeur + i * Math.PI / 8;
    const x = doel.x + Math.sin(a) * afstand, z = doel.z + Math.cos(a) * afstand;
    const [rx, rz] = W.resolveCollisions(x, z, 0.4, 0, 0);
    if (Math.hypot(rx - x, rz - z) > 0.05) continue;
    const cam = new THREE.Vector3(x, doel.y + hoogte, z);
    const dir = doelV.clone().sub(cam); const L = dir.length(); dir.normalize();
    ray.set(cam, dir); ray.far = L - 0.4; ray.near = 0.2;
    const raak = ray.intersectObjects(mag, false).filter(h => !(h.object.material && h.object.material.transparent));
    if (!raak.length) { beste = cam; break; }
    if (!beste) beste = cam;
  }
  C.position.copy(beste); C.lookAt(doelV);
  for (let i = 0; i < 3; i++) g.sfeer.update(0.1, C.position.x, C.position.z);
  W.updateLOD(C.position.x, C.position.z); sc.updateMatrixWorld(true); g.renderer.shadowMap.needsUpdate = true;
  C.updateMatrixWorld(true); g.renderer.render(sc, C); g.renderer.render(sc, C);
  return g.renderer.domElement.toDataURL('image/png');
}, { doel, afstand, hoogte, voorkeur });

const plekken = await page.evaluate(() => {
  const g = window.__game, st = g.geocache.stand, kist = [];
  g.scene.traverse(o => { if (o.userData && o.userData.deksel) kist.push(o); });
  return st.caches.map((c, i) => {
    const k = kist.find(m => Math.hypot(m.position.x - c.plek.x, m.position.z - c.plek.z) < 1) || null;
    return { nr: c.nr, x: c.plek.x, z: c.plek.z, y: k ? k.position.y + 0.1 : (c.plek.y || 0) + 0.1 };
  });
});
for (const p of plekken) {
  schrijf(`cacheplek_${p.nr}_dichtbij`, await neem(p, 3.5, 1.5));
  schrijf(`cacheplek_${p.nr}_omgeving`, await neem(p, 16, 6.5));
}
const bord = await page.evaluate(() => { const b = window.__game.geocache.bordje; b.updateMatrixWorld(true); const v = b.getWorldPosition(b.position.clone()); return { x: v.x, y: v.y, z: v.z }; });
schrijf('cacheplek_3_bordje', await neem(bord, 3.2, 0.3));
await browser.close();
console.log('klaar');
