/*
 Echtere poppetjes (verzoek 24 sep 2026: "update ook net als de auto's en
 wapens de poppetjes in het spel qua kwaliteit, uiteraard rekening houdend met
 de performance op een pc").

   node tools/server.mjs 8123 &   node tools/mensechttest.mjs [poort]

 Laadt alleen js/lichaam.js en js/persoon.js op een lege pagina. Dat de
 voetgangers nog steeds twaalf instanced meshes zijn en dat de maten van een
 volwassene kloppen, toetsen tools/wapentest.mjs en tools/vuiltest.mjs in het
 spel zelf.

 1. Rond in plaats van dozen: gladde normalen op romp, hoofd, armen en benen.
 2. De romp is één vorm (geen naden van gestapelde dozen).
 3. Elk onderdeel heeft een uv en een doek; stof, spijkerstof en haar hebben een
    normal map; het hoofd heeft een gezicht (wenkbrauwen, mond) dat alleen op de
    voorkant ligt.
 4. De maten zijn niet veranderd: breedte van de romp, lengte van armen en
    benen, de hoogte van het geheel.
 5. Voor de pc: de doeken worden gedeeld, en een mens blijft onder de 4000
    driehoeken (130 voetgangers, allemaal tegelijk getekend).
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fout = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fout++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/mensbank`, { waitUntil: 'load', timeout: 120000 });
await page.setContent(`<!doctype html><html><head>
<script type="importmap">{ "imports": { "three": "/lib/three.module.js" } }</script></head><body>
<script type="module">
  import * as THREE from 'three';
  import * as L from '/js/lichaam.js';
  import { Persoon } from '/js/persoon.js';
  window.__t = { THREE, L, Persoon };
</script></body></html>`);
await page.waitForFunction(() => window.__t, null, { timeout: 120000 });

const r = await page.evaluate(() => {
  const { THREE, L, Persoon } = window.__t;
  const uit = { delen: {} };
  const schuinDeel = (geo) => {
    const N = geo.attributes.normal; let s = 0;
    for (let i = 0; i < N.count; i++) if (Math.max(Math.abs(N.getX(i)), Math.abs(N.getY(i)), Math.abs(N.getZ(i))) < 0.95) s++;
    return s / N.count;
  };
  for (const naam of Object.keys(L.DEEL)) {
    const g = L.DEEL[naam]();
    g.computeBoundingBox();
    const bb = g.boundingBox;
    uit.delen[naam] = { uv: !!g.attributes.uv, schuin: schuinDeel(g), driehoeken: g.attributes.position.count / 3,
      breed: +(bb.max.x - bb.min.x).toFixed(3), hoog: +(bb.max.y - bb.min.y).toFixed(3), diep: +(bb.max.z - bb.min.z).toFixed(3) };
  }
  // de romp: één gesloten vorm? Tel de hoogtes waar de omtrek verspringt: bij
  // gestapelde dozen springt de breedte bij elke overgang, bij één vorm niet
  const romp = L.DEEL.romp(); const P = romp.attributes.position;
  const perY = new Map();
  for (let i = 0; i < P.count; i++) { const y = +P.getY(i).toFixed(3); perY.set(y, Math.max(perY.get(y) || 0, Math.abs(P.getX(i)))); }
  const ys = [...perY.keys()].sort((a, b) => a - b).filter(y => y > -0.2 && y < 0.24);
  let sprong = 0;
  for (let i = 1; i < ys.length; i++) {
    const dy = ys[i] - ys[i - 1], dx = Math.abs(perY.get(ys[i]) - perY.get(ys[i - 1]));
    if (dy > 0.001 && dx / dy > 1.5) sprong++;
  }
  uit.rompSprong = sprong;
  // het gezicht: de uv van de voorkant ligt midden in het doek, de rest in een hoekje
  const hoofd = L.DEEL.hoofd(); const U = hoofd.attributes.uv, HN = hoofd.attributes.normal;
  let voor = 0, achterMidden = 0;
  for (let i = 0; i < U.count; i++) {
    const midden = U.getX(i) > 0.2 && U.getX(i) < 0.8 && U.getY(i) > 0.2 && U.getY(i) < 0.8;
    if (HN.getZ(i) < -0.6 && midden) voor++;
    if (HN.getZ(i) > 0.3 && midden) achterMidden++;
  }
  uit.gezicht = { voor, achterMidden };
  const doek = L.doekVoor('gezicht').map.image, g = doek.getContext('2d');
  const donker = (u, v) => { const d = g.getImageData(Math.round(u * doek.width), Math.round((1 - v) * doek.height), 1, 1).data; return d[0] + d[1] + d[2]; };
  const basis = donker(0.03, 0.03);
  // wenkbrauw (x = ±0,047, y = 0,035) en mond (x = 0, y = −0,060), met de projectie uit lichaam.js
  const uvVan = (x, y) => [0.5 + x / 0.26, 0.5 + (y + 0.01) / 0.30];
  uit.gezicht.wenkbrauw = basis - donker(...uvVan(0.047, 0.035));
  uit.gezicht.mond = basis - donker(...uvVan(0, -0.060));
  // de doeken: gedeeld, en met reliëf waar het hoort
  uit.gedeeld = L.doekVoor('stof') === L.doekVoor('stof');
  uit.reliëf = ['stof', 'broek', 'haar'].every(s => !!L.doekVoor(s).normalMap);
  // een hele Persoon: driehoeken, materialen met een doek en de lengte
  const p = new Persoon({}); p.groep.updateMatrixWorld(true);
  let driehoeken = 0, metDoek = 0, meshes = 0;
  p.groep.traverse(o => { if (o.isMesh) { meshes++; driehoeken += o.geometry.attributes.position.count / 3; if (o.material.map) metDoek++; } });
  const bb = new THREE.Box3().setFromObject(p.groep);
  uit.persoon = { driehoeken, metDoek, meshes, hoogte: +(bb.max.y - bb.min.y).toFixed(3) };
  return uit;
});

kop('rond in plaats van dozen');
for (const naam of ['romp', 'hoofd', 'bovenarm', 'onderarm', 'bovenbeen', 'onderbeen', 'hand']) {
  ok(r.delen[naam].schuin > 0.5, `${naam}: gladde, ronde vorm`, `${(r.delen[naam].schuin * 100).toFixed(0)} % van de normalen schuin`);
}
ok(r.rompSprong === 0, 'de romp is één vorm, zonder naden tussen gestapelde blokken', `${r.rompSprong} sprongen in de omtrek`);

kop('doeken');
ok(Object.values(r.delen).every(d => d.uv), 'elk onderdeel heeft een uv');
ok(r.gedeeld && r.reliëf, 'de doeken worden gedeeld, en stof, spijkerstof en haar hebben reliëf');
ok(r.gezicht.voor > 50 && r.gezicht.achterMidden === 0, 'het gezicht ligt op de voorkant van het hoofd en niet op het achterhoofd',
  `${r.gezicht.voor} hoekpunten voor, ${r.gezicht.achterMidden} achter`);
ok(r.gezicht.wenkbrauw > 30 && r.gezicht.mond > 30, 'met wenkbrauwen en een mond in het doek',
  `${r.gezicht.wenkbrauw} en ${r.gezicht.mond} donkerder dan de huid`);
ok(r.persoon.metDoek >= r.persoon.meshes - 1, 'een meespelend personage heeft op elk onderdeel een doek (op de ogen na)', `${r.persoon.metDoek} van ${r.persoon.meshes}`);

kop('dezelfde maten');
ok(Math.abs(r.delen.romp.breed - 0.425) < 0.03, 'de romp is even breed als voorheen (42,5 cm)', `${(r.delen.romp.breed * 100).toFixed(1)} cm`);
ok(Math.abs(r.delen.bovenarm.hoog - (0.28 + 0.048)) < 0.02 && Math.abs(r.delen.bovenbeen.hoog - (0.44 + 0.074)) < 0.02,
  'armen en benen hangen even lang onder hun gewricht', `bovenarm ${r.delen.bovenarm.hoog} m, bovenbeen ${r.delen.bovenbeen.hoog} m`);
ok(r.persoon.hoogte > 1.70 && r.persoon.hoogte < 1.82, 'een volwassene is 1,75 m', `${r.persoon.hoogte} m`);

kop('voor de pc');
ok(r.persoon.driehoeken < 4000, 'een mens blijft onder de 4000 driehoeken', `${r.persoon.driehoeken}`);

console.log(`\n${fout ? fout + ' fout' : 'alles goed'}`);
await browser.close();
process.exit(fout ? 1 : 0);
