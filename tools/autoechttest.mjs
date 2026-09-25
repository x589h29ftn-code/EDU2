/*
 Echtere auto's (verzoek 24 sep 2026: "kan je de wapens en auto's ook
 realistischer maken qua uiterlijk en textures").

   node tools/server.mjs 8123 &   node tools/autoechttest.mjs [poort]

 Net als tools/wapenechttest.mjs laadt deze proef niet het spel maar alleen
 js/carmodel.js op een lege pagina: alles wat hier gemeten wordt zit in het
 model. Of er niets door een band loopt en niets los vóór het plaatwerk hangt
 blijft tools/rijtest.mjs toetsen, nu ook met de afgeronde dozen.

 1. Plaatwerk met ronde randen: een flink deel van de normalen van de lak staat
    schuin, en de maat van elke doos blijft na te rekenen.
 2. Banden met een profiel in plaats van cilinders.
 3. Lak met een blanke laklaag (clearcoat), ook op de geparkeerde auto's.
 4. Lampen en kenteken met een doek: reflectoren in de koplamp die alleen in het
    glas oplichten, een geel Nederlands kenteken met de blauwe EU-strook.
 5. De ramen dekken de hele raamopening: geen straal dwars door de auto.
 6. En het blijft even goedkoop: evenveel meshes per soort als voorheen, en een
    ruime grens op het aantal driehoeken (de geometrie wordt gedeeld, maar elke
    auto in beeld wordt wel getekend).
 7. Op afstand (ronde van 25 sep 2026): een stapel heeft een grove uitvoering
    van dezelfde maat met hoogstens een derde van de driehoeken, en tekent
    alleen de auto's die er staan (achter elkaar, `count`). Een treffer vindt
    de goede auto terug, ook als die ergens midden in de stapel zit.
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
await page.goto(`http://127.0.0.1:${poort}/autobank`, { waitUntil: 'load', timeout: 120000 });
await page.setContent(`<!doctype html><html><head>
<script type="importmap">{ "imports": { "three": "/lib/three.module.js" } }</script></head><body>
<script type="module">
  import * as THREE from 'three';
  import * as C from '/js/carmodel.js';
  window.__t = { THREE, C };
</script></body></html>`);
await page.waitForFunction(() => window.__t, null, { timeout: 120000 });

const r = await page.evaluate(() => {
  const { THREE, C } = window.__t;
  const uit = {};
  for (const soort of ['hatch', 'van', 'bx', 'truck']) {
    const auto = C.makeCar(0x8a1c1c, soort);
    const meshes = [];
    auto.traverse(o => { if (o.isMesh) meshes.push(o); });
    const lak = meshes.find(m => m.userData.lak);
    const N = lak.geometry.attributes.normal;
    let schuin = 0;
    for (let i = 0; i < N.count; i++) if (Math.max(Math.abs(N.getX(i)), Math.abs(N.getY(i)), Math.abs(N.getZ(i))) < 0.97) schuin++;
    const driehoeken = meshes.reduce((t, m) => t + m.geometry.attributes.position.count / 3, 0);
    const stapel = C.maakAutoStapel(soort, 2);
    const onder = C.autoOnderdelen(soort);
    uit[soort] = {
      meshes: meshes.length, schuin: schuin / N.count, driehoeken,
      lakSoort: lak.material.type, clearcoat: lak.material.clearcoat || 0,
      stapelMeshes: stapel.meshes.length, stapelClearcoat: stapel.meshes[0].material.clearcoat || 0,
      dozen: onder.dozen.length, lakDozen: onder.dozen.filter(d => d.groep === 'lak').length,
    };
  }
  // de band van de hatchback: het profiel
  const hatch = C.makeCar(0x8a1c1c, 'hatch', true);
  const band = hatch.userData.wielen[0].band.geometry;
  const P = band.attributes.position, BN = band.attributes.normal;
  let straal = 0, wang = 0;
  for (let i = 0; i < P.count; i++) {
    straal = Math.max(straal, Math.hypot(P.getY(i), P.getZ(i)));
    const radiaal = Math.hypot(BN.getY(i), BN.getZ(i));
    if (radiaal > 0.3 && Math.abs(BN.getX(i)) > 0.3) wang++;
  }
  uit.band = { straal, R: hatch.userData.R, wang };
  // de doeken: lampen en kenteken
  const auto = C.makeCar(0x8a1c1c, 'hatch');
  const mats = []; auto.traverse(o => { if (o.isMesh) mats.push(o.material); });
  const kop = mats.find(m => m.emissiveMap && m.emissive.r > 0.9 && m.emissive.g > 0.9);
  const plaat = mats.find(m => m.map && !m.emissiveMap && m.map.image && m.map.image.width === 256 && m.map.image.height === 56);
  const pix = (img) => { const g = img.getContext('2d'); return g.getImageData(0, 0, img.width, img.height).data; };
  let geel = 0, blauw = 0, zwart = 0, n = 0;
  if (plaat) {
    const d = pix(plaat.map.image);
    for (let i = 0; i < d.length; i += 4) { n++; if (d[i] > 200 && d[i + 1] > 160 && d[i + 2] < 80) geel++; else if (d[i + 2] > 120 && d[i] < 60) blauw++; else if (d[i] + d[i + 1] + d[i + 2] < 90) zwart++; }
  }
  let licht = 0, donker = 0;
  if (kop) {
    const d = pix(kop.emissiveMap.image);
    for (let i = 0; i < d.length; i += 4) { const v = d[i] + d[i + 1] + d[i + 2]; if (v > 600) licht++; else if (v < 120) donker++; }
  }
  const tot = kop ? kop.emissiveMap.image.width * kop.emissiveMap.image.height : 1;
  uit.doek = { kop: !!kop, plaat: !!plaat, geel: geel / (n || 1), blauw: blauw / (n || 1), zwart: zwart / (n || 1), licht: licht / tot, donker: donker / tot };
  return uit;
});

kop('plaatwerk met ronde randen');
for (const s of ['hatch', 'van', 'bx', 'truck']) {
  ok(r[s].schuin > 0.25, `${s}: de lak loopt om de hoeken`, `${(r[s].schuin * 100).toFixed(0)} % van de normalen schuin`);
}
ok(r.hatch.lakDozen >= 10, 'en de afgeronde dozen zijn nog steeds na te rekenen (rijtest)', `${r.hatch.lakDozen} lakdozen, ${r.hatch.dozen} in totaal`);

kop('banden');
ok(Math.abs(r.band.straal - r.band.R) < 0.005, 'de band heeft de straal van het wiel', `${r.band.straal.toFixed(3)} m`);
ok(r.band.wang > 50, 'en een ronde schouder: normalen die zowel opzij als naar buiten wijzen', `${r.band.wang} hoekpunten`);

kop('lak');
for (const s of ['hatch', 'truck']) {
  ok(r[s].lakSoort === 'MeshPhysicalMaterial' && r[s].clearcoat > 0.9, `${s}: blanke laklaag over de kleur`, `${r[s].lakSoort}, clearcoat ${r[s].clearcoat}`);
}
ok(r.hatch.stapelClearcoat > 0.9, 'ook bij de geparkeerde auto\'s (de instanced stapel)', `clearcoat ${r.hatch.stapelClearcoat}`);

kop('lampen en kenteken');
ok(r.doek.kop && r.doek.licht > 0.05 && r.doek.donker > 0.1, 'de koplamp licht alleen op in het glas, niet in de behuizing',
  `${(r.doek.licht * 100).toFixed(0)} % licht, ${(r.doek.donker * 100).toFixed(0)} % donker`);
ok(r.doek.plaat && r.doek.geel > 0.5, 'het kenteken is geel', `${(r.doek.geel * 100).toFixed(0)} % geel`);
ok(r.doek.blauw > 0.04 && r.doek.zwart > 0.05, 'met de blauwe EU-strook en zwarte letters', `${(r.doek.blauw * 100).toFixed(0)} % blauw, ${(r.doek.zwart * 100).toFixed(0)} % zwart`);

kop('de ramen dekken de hele raamopening');
/*
 Melding 24 sep 2026: "de ramen lijken niet het gehele raam oppervlakte te
 dekken". Gemeten met stralen in een raster van 3 cm, van opzij, van voren en
 van achteren, over de hoogte van de ruiten. Per rij telt een straal die niets
 raakt als gat zodra er links én rechts ervan in dezelfde rij wel iets geraakt
 wordt: dan zit hij binnen de omtrek van de auto. Vóór deze ronde: bij de
 hatchback 30 % van de stralen door de zijkant (een driehoek langs de schuine
 stijlen) en 8 % naast de voorruit.
*/
const ramen = await page.evaluate(() => {
  const { THREE, C } = window.__t;
  const uit = {};
  for (const soort of ['hatch', 'van', 'bx', 'truck']) {
    const auto = C.makeCar(0x8a1c1c, soort); auto.updateMatrixWorld(true);
    const M = C.autoMaat(soort);
    const meshes = []; auto.traverse(o => { if (o.isMesh) meshes.push(o); });
    const rc = new THREE.Raycaster();
    const tel = {};
    for (const kant of ['zij', 'voor', 'achter']) {
      let gaten = 0, binnen = 0; const waar = [];
      for (let y = M.schouderY + 0.03; y <= M.dakY - 0.03; y += 0.03) {
        const rij = [];
        const [a0, a1] = kant === 'zij' ? [-M.L / 2, M.L / 2] : [-M.W / 2, M.W / 2];
        for (let t = a0; t <= a1; t += 0.03) {
          if (kant === 'zij') { rc.set(new THREE.Vector3(M.W, y, t), new THREE.Vector3(-1, 0, 0)); rc.far = M.W / 2 + 0.3; }
          else { const dz = kant === 'voor' ? 1 : -1; rc.set(new THREE.Vector3(t, y, -dz * (M.L / 2 + 1)), new THREE.Vector3(0, 0, dz)); rc.far = M.L + 2; }
          rij.push(rc.intersectObjects(meshes).length > 0);
        }
        const eerste = rij.indexOf(true), laatste = rij.lastIndexOf(true);
        for (let i = eerste + 1; i < laatste; i++) { binnen++; if (!rij[i]) { gaten++; if (waar.length < 4) waar.push([+y.toFixed(2), +(a0 + i * 0.03).toFixed(2)]); } }
      }
      tel[kant] = { gaten, binnen, waar };
    }
    uit[soort] = tel;
  }
  return uit;
});
for (const s of ['hatch', 'van', 'bx', 'truck']) {
  const t = ramen[s], g = t.zij.gaten + t.voor.gaten + t.achter.gaten;
  ok(g === 0, `${s}: geen straal door de raamopening`, `zij ${t.zij.gaten}, voor ${t.voor.gaten}, achter ${t.achter.gaten} van ${t.zij.binnen + t.voor.binnen + t.achter.binnen}${g ? ' bij (y, z|x) ' + JSON.stringify([...t.zij.waar, ...t.voor.waar, ...t.achter.waar]) : ''}`);
}

kop('even goedkoop');
ok(r.hatch.meshes === 7 && r.truck.meshes === 7, 'evenveel meshes per auto als voorheen (zeven)', `${r.hatch.meshes} en ${r.truck.meshes}`);
ok(r.hatch.stapelMeshes === 7, 'en evenveel instanced meshes per stapel', `${r.hatch.stapelMeshes}`);
ok(r.hatch.driehoeken < 9000 && r.truck.driehoeken < 9000, 'een auto blijft onder de negenduizend driehoeken',
  `hatch ${r.hatch.driehoeken}, bus ${r.van.driehoeken}, BX ${r.bx.driehoeken}, bakwagen ${r.truck.driehoeken}`);

kop('op afstand');
const ver = await page.evaluate(() => {
  const { THREE, C } = window.__t;
  const tri = (m) => (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
  const uit = {};
  for (const soort of ['hatch', 'van']) {
    const s = C.maakAutoStapel(soort, 6);
    const doos = (lijst) => { const b = new THREE.Box3(); for (const m of lijst) { m.geometry.computeBoundingBox(); b.union(m.geometry.boundingBox); } return b; };
    const a = doos(s.meshes), b = doos(s.verMeshes);
    // zes auto's: twee dichtbij, twee ver, twee uit — door elkaar
    const stand = [[true, false], [false, true], [true, true], [true, false], [true, true], [false, false]];
    stand.forEach(([aan, opAfstand], i) => { s.zet(i, i * 5, 0, 0, aan, opAfstand); s.kleur(i, 0x100000 * (i + 1)); });
    s.klaar(); s.omhul();
    const kleur = new THREE.Color(); s.verMeshes[0].getColorAt(1, kleur);
    uit[soort] = {
      vol: s.meshes.reduce((n, m) => n + tri(m), 0), ver: s.verMeshes.reduce((n, m) => n + tri(m), 0),
      maat: Math.max(...['x', 'y', 'z'].flatMap(k => [Math.abs(a.min[k] - b.min[k]), Math.abs(a.max[k] - b.max[k])])),
      count: [s.meshes[0].count, s.verMeshes[0].count],
      nummers: [0, 1].map(j => s.nummer(s.meshes[3], j)).concat([0, 1].map(j => s.nummer(s.verMeshes[2], j))),
      kleurVer: kleur.getHex(),
      bol: s.meshes[0].boundingSphere && s.meshes[0].boundingSphere.radius,
      leegZichtbaar: (() => { const t = C.maakAutoStapel(soort, 2); t.zet(0, 0, 0, 0, false); t.zet(1, 0, 0, 0, false); t.klaar(); return t.alle.some(m => m.visible); })(),
    };
  }
  return uit;
});
for (const s of ['hatch', 'van']) {
  const v = ver[s];
  ok(v.ver < v.vol / 3, `${s}: de grove uitvoering heeft hoogstens een derde van de driehoeken`, `${v.ver} tegen ${v.vol}`);
  ok(v.maat < 0.02, 'en precies dezelfde maat', `${(v.maat * 100).toFixed(1)} cm verschil`);
  ok(v.count[0] === 2 && v.count[1] === 2, 'de stapel tekent alleen wat er staat', `${v.count[0]} dichtbij, ${v.count[1]} ver (van zes, twee uit)`);
  ok(JSON.stringify(v.nummers) === '[0,3,2,4]', 'een treffer vindt de goede auto terug', JSON.stringify(v.nummers));
  ok(v.kleurVer === 0x500000, 'en de lakkleur schuift mee naar zijn plek in de stapel', `#${v.kleurVer.toString(16).padStart(6, '0')}`);
  // de zes staan van x = 0 tot 25, de laatste uit: over wat er staat zou de bol
  // 10 m plus een halve auto zijn, over de hele stapel 12,5 m plus een halve auto
  ok(v.bol > 14, 'de omhullende bol gaat over de hele stapel, niet over wat er nu staat', `straal ${v.bol?.toFixed(1)} m`);
  ok(!v.leegZichtbaar, 'en een lege stapel kost geen draw call');
}

console.log(`\n${fout ? fout + ' fout' : 'alles goed'}`);
await browser.close();
process.exit(fout ? 1 : 0);
