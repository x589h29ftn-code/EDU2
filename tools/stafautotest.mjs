/*
 De stafauto en het zijspan van No Mercy 5 als eigen modellen (stap 142, gevraagd: "Geef de stafauto en de zijspan
 motor meer detail en betere textures", en "bouw anders een nieuw speciaal model").

   node tools/server.mjs 8123 &   node tools/stafautotest.mjs [poort]      (npm run stafautotest)

 Laadt alleen js/nomercy5.js op een lege pagina (een paar seconden); hoe ze in het spel rijden en of ze een nieuwe
 shader vertalen, toetst tools/nomercy5test.mjs.

 1. De stafauto heeft wat js/vehicles.js van een auto verwacht: `bak`, vier `wielen` (twee sturen), `R`, `length`,
    `oog`, `glas` en een remlicht.
 2. De maten: lengte, breedte (binnen de 1,78 m waar js/vehicles.js mee rekent), de wielen op de grond en binnen de
    flanken, niets onder de grond, de stoelen en het stuur in de kuip, de bestuurder links achter het stuur.
 3. De doeken: elk onderdeel met een kaart heeft uv; het zijdoek valt precies over de zijplaat; de soorten materiaal
    zijn die van het spel (geen tweezijdig materiaal met een kaart, doorzichtig alleen het glas of een opdruk).
 4. Het reservewiel ligt op de voorkap, de kap en het motordeksel lopen de goede kant op (de neus laag).
 5. Het zijspan: drie wielen op de grond, binnen 1,8 m breed (een R75 met zijspan is 1,73 m), de rijder op het zadel van de scooters, de bijrijder in
    de kuip, het reservewiel achter de kuip en niet erin, dezelfde regels voor de materialen.
 6. Veel meer onderdelen dan het oude model (het zijspan had 16 meshes, de BX 7).
 7. Van binnen (stap 145): het interieur staat uit tot je erin zit (`userData.binnen`), de ogen zitten boven de stoel en
    onder de bovenrand van de ruit, de klok en het stuur liggen vóór je, de binnenpanelen kijken naar binnen, het stuur
    draait mee met het sturen en de naald met de snelheid, de spiegel hangt boven je ogen, en dezelfde materiaalregels.
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fout = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fout++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);
const r2 = (x) => (x == null || !isFinite(x)) ? String(x) : (Math.round(x * 100) / 100).toString();

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/stafautobank`, { waitUntil: 'load', timeout: 120000 });
await page.setContent(`<!doctype html><html><head>
<script type="importmap">{ "imports": { "three": "/lib/three.module.js" } }</script></head><body>
<script type="module">
  import * as THREE from 'three';
  import * as N from '/js/nomercy5.js';
  import { maakDuitser } from '/js/nomercy.js';
  import { SCOOTER } from '/js/lichaam.js';
  window.__t = { THREE, N, maakDuitser, SCOOTER };
</script></body></html>`);
await page.waitForFunction(() => window.__t, null, { timeout: 120000 });

await page.evaluate(() => {
  const { THREE } = window.__t;
  // de grenzen van een object (en zijn kinderen) in het assenstelsel van `wortel`
  window.__doos = (obj, wortel, filter = null) => {
    wortel.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(wortel.matrixWorld).invert();
    const b = new THREE.Box3(), v = new THREE.Vector3();
    obj.traverse(o => {
      if (!o.isMesh || (filter && !filter(o))) return;
      const p = o.geometry.attributes.position, m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m); b.expandByPoint(v); }
    });
    return { min: { x: b.min.x, y: b.min.y, z: b.min.z }, max: { x: b.max.x, y: b.max.y, z: b.max.z } };
  };
  // de materiaalregels van het spel
  window.__materialen = (wortel) => {
    let meshes = 0, kaartZonderUv = 0, dubbelMetKaart = 0, vreemd = 0, doorzichtigVreemd = 0, metKaart = 0;
    const soorten = new Set();
    wortel.traverse(o => {
      if (!o.isMesh) return;
      meshes++;
      const m = o.material;
      soorten.add(m.type);
      if (m.type !== 'MeshStandardMaterial') vreemd++;
      if (m.map) { metKaart++; if (!o.geometry.attributes.uv) kaartZonderUv++; }
      if (m.map && m.side === THREE.DoubleSide) dubbelMetKaart++;
      if (m.transparent && !(m.map && m.alphaTest > 0) && m.map) doorzichtigVreemd++;
    });
    return { meshes, kaartZonderUv, dubbelMetKaart, vreemd, doorzichtigVreemd, metKaart, soorten: [...soorten] };
  };
});

// ------------------------------------------------------------------ 1–4. de stafauto
kop('1. wat js/vehicles.js verwacht');
const staf = await page.evaluate(() => {
  const { N, THREE } = window.__t;
  const g = N.maakStafauto();
  const u = g.userData;
  const uit = {
    bak: !!(u.bak && u.bak.isObject3D), wielen: (u.wielen || []).length, sturen: (u.wielen || []).filter(w => w.stuur).length,
    elkWiel: (u.wielen || []).every(w => w.groep && w.band && w.band.parent === w.groep),
    R: u.R, length: u.length, oog: u.oog, glas: !!(u.glas && u.glas.isMesh), rem: !!(u.rem && u.rem.visible === false),
  };
  const heel = window.__doos(g, g);
  uit.maat = heel;
  // de wielen: onderkant op de grond, binnen de flanken
  uit.wielOnder = u.wielen.map(w => window.__doos(w.groep, g).min.y);
  uit.wielX = u.wielen.map(w => { const d = window.__doos(w.groep, g); return Math.max(Math.abs(d.min.x), Math.abs(d.max.x)); });
  // zonder de antenne: de hoogte van de auto zelf
  uit.zonderSpriet = window.__doos(g, g, o => !(o.geometry.type === 'CylinderGeometry' && o.geometry.parameters.height > 1.5));
  // de kuip: de zijplaten (een ExtrudeGeometry), het stuur (een torus) en de stoelen (zeil)
  let platen = 0, zijUv = null, stuur = null, kap = null, dek = null;
  g.traverse(o => {
    if (!o.isMesh) return;
    if (o.geometry.type === 'ExtrudeGeometry') {
      platen++;
      if (!zijUv) {
        const uv = o.geometry.attributes.uv, t = o.material.map;
        let lo = [1e9, 1e9], hi = [-1e9, -1e9];
        // alleen de twee grote zijvlakken (de normaal opzij): daar ligt het doek op
        const n = o.geometry.attributes.normal;
        for (let i = 0; i < uv.count; i++) {
          if (Math.abs(n.getX(i)) < 0.9) continue;           // (de geometrie is gedraaid: de grote vlakken kijken langs x)
          const x = uv.getX(i) * t.repeat.x + t.offset.x, y = uv.getY(i) * t.repeat.y + t.offset.y;
          lo = [Math.min(lo[0], x), Math.min(lo[1], y)]; hi = [Math.max(hi[0], x), Math.max(hi[1], y)];
        }
        zijUv = { lo, hi };
      }
    }
    // (stap 145: het stuur draait in zijn eigen groep `binnen.draai`; de rand van de snelheidsmeter is ook een ring)
    if (o.geometry.type === 'TorusGeometry' && o.parent && u.binnen && o.parent === u.binnen.draai && !stuur) stuur = window.__doos(o, g);
  });
  uit.platen = platen; uit.zijUv = zijUv; uit.stuur = stuur;
  // de kap, het motordeksel en het reservewiel: de neus laag, het reservewiel erop
  const kinderen = u.bak.children;
  for (const o of kinderen) {
    if (o.isMesh && o.material.map && o.geometry.type === 'BoxGeometry' && o.geometry.parameters.height < 0.05 && o.geometry.parameters.depth > 0.8) {
      const d = window.__doos(o, g);
      const p = o.geometry.attributes.position, v = new THREE.Vector3();
      o.updateMatrixWorld(true);
      let voor = null, achter = null;
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); if (!voor || v.z < voor.z) voor = v.clone(); if (!achter || v.z > achter.z) achter = v.clone(); }
      const rec = { z: (d.min.z + d.max.z) / 2, voorY: voor.y, achterY: achter.y, maxY: d.max.y };
      if (rec.z < 0) kap = rec; else dek = rec;
    }
  }
  uit.kap = kap; uit.dek = dek;
  const reserve = kinderen.find(o => o.isGroup && o.children.some(c => c.geometry && c.geometry.type === 'CylinderGeometry' && c.geometry.parameters.openEnded));
  uit.reserve = reserve ? window.__doos(reserve, g) : null;
  uit.mat = window.__materialen(g);
  let n = 0; g.traverse(o => { if (o.isMesh) n++; });
  uit.meshes = n;
  return uit;
});
ok(staf.bak && staf.wielen === 4 && staf.sturen === 2 && staf.elkWiel, 'bak, vier wielen waarvan twee sturen, elk met een band in zijn groep');
ok(Math.abs(staf.R - 0.345) < 0.01 && Math.abs(staf.length - 3.74) < 0.01 && staf.oog && staf.glas && staf.rem, 'R, length, oog, glas en een remlicht dat uit staat', `R ${staf.R}, ${staf.length} m`);

kop('2. de maten');
const L = staf.maat.max.z - staf.maat.min.z, B = staf.maat.max.x - staf.maat.min.x, H = staf.zonderSpriet.max.y;
ok(L > 3.6 && L < 4.1, 'zo lang als een Kübelwagen (3,74 m, met de bumpers)', `${r2(L)} m`);
ok(B <= 1.78, 'niet breder dan js/vehicles.js rekent (1,78 m)', `${r2(B)} m`);
ok(H > 1.2 && H < 1.75, 'zo hoog als een open stafwagen met de ruit omhoog', `${r2(H)} m, met de antenne ${r2(staf.maat.max.y)} m`);
ok(staf.maat.min.y > -0.01, 'niets onder de grond', `${r2(staf.maat.min.y)} m`);
ok(staf.wielOnder.every(y => Math.abs(y) < 0.02), 'de wielen staan op de grond', staf.wielOnder.map(r2).join(', '));
ok(staf.wielX.every(x => x <= B / 2 + 0.01), 'de wielen binnen de breedte', staf.wielX.map(r2).join(', '));
ok(staf.platen === 2, 'twee zijplaten (de kuip is open)');
ok(staf.stuur && staf.stuur.max.x < 0 && staf.stuur.min.y > 0.8, 'het stuur zit links, op stuurhoogte', staf.stuur ? `x ${r2(staf.stuur.min.x)}…${r2(staf.stuur.max.x)}, y ${r2(staf.stuur.min.y)}` : 'niet gevonden');
ok(staf.oog.x < 0 && staf.oog.y > 1.1 && staf.oog.y < 1.5, 'de bestuurder links, met zijn ogen boven de ruitrand', JSON.stringify(staf.oog));

kop('3. de doeken en materialen');
ok(staf.zijUv && staf.zijUv.lo[0] > -0.02 && staf.zijUv.hi[0] < 1.02 && staf.zijUv.lo[1] > -0.02 && staf.zijUv.hi[1] < 1.02, 'het zijdoek valt precies over de zijplaat',
  staf.zijUv ? `u ${r2(staf.zijUv.lo[0])}…${r2(staf.zijUv.hi[0])}, v ${r2(staf.zijUv.lo[1])}…${r2(staf.zijUv.hi[1])}` : '');
ok(staf.mat.kaartZonderUv === 0 && staf.mat.metKaart >= 10, 'elk onderdeel met een doek heeft uv', `${staf.mat.metKaart} met een doek`);
ok(staf.mat.vreemd === 0 && staf.mat.dubbelMetKaart === 0 && staf.mat.doorzichtigVreemd === 0, 'alleen MeshStandardMaterial, geen tweezijdig doek, doorzichtig alleen glas of opdruk', staf.mat.soorten.join(', '));

kop('4. de kap, het motordeksel, het reservewiel');
ok(staf.kap && staf.kap.voorY < staf.kap.achterY, 'de voorkap loopt van de neus omhoog naar de ruit', staf.kap ? `${r2(staf.kap.voorY)} → ${r2(staf.kap.achterY)} m` : 'niet gevonden');
ok(staf.dek && staf.dek.voorY > staf.dek.achterY, 'het motordeksel loopt naar achter af', staf.dek ? `${r2(staf.dek.voorY)} → ${r2(staf.dek.achterY)} m` : 'niet gevonden');
ok(staf.reserve && staf.kap && staf.reserve.min.y > staf.kap.voorY - 0.05 && staf.reserve.max.z < -0.6 && staf.reserve.min.z > -1.95, 'het reservewiel ligt op de voorkap',
  staf.reserve ? `y ${r2(staf.reserve.min.y)}…${r2(staf.reserve.max.y)}, z ${r2(staf.reserve.min.z)}…${r2(staf.reserve.max.z)}` : 'niet gevonden');

// ------------------------------------------------------------------ 5. het zijspan
kop('5. het zijspan');
const zij = await page.evaluate(() => {
  const { N, maakDuitser, SCOOTER } = window.__t;
  const m = N.maakZijspan(maakDuitser(5), maakDuitser(7));
  const g = m.mesh;
  g.visible = true;
  const heel = window.__doos(g, g, o => !m.rijder.groep.getObjectById(o.id) && !m.bijrijder.groep.getObjectById(o.id));
  // de wielen: groepen met een open cilinder (de band)
  const wielen = g.children.filter(o => o.isGroup && o.children.some(c => c.geometry && c.geometry.type === 'CylinderGeometry' && c.geometry.parameters.openEnded));
  const opGrond = wielen.map(w => window.__doos(w, g).min.y);
  const kuip = g.children.find(o => o.isMesh && o.geometry.type === 'CapsuleGeometry');
  const kd = kuip ? window.__doos(kuip, g) : null;
  const reserve = wielen.find(w => w.position.z > 0.8);
  const rd = reserve ? window.__doos(reserve, g) : null;
  let n = 0; g.traverse(o => { if (o.isMesh && !m.rijder.groep.getObjectById(o.id) && !m.bijrijder.groep.getObjectById(o.id)) n++; });
  // de materialen van de motor zelf (de mannen hebben hun eigen mondingsvuur)
  m.zit.remove(m.rijder.groep); m.zitBak.remove(m.bijrijder.groep);
  const mat = window.__materialen(g);
  m.zit.add(m.rijder.groep); m.zitBak.add(m.bijrijder.groep);
  return { heel, wielen: wielen.length, opGrond, kuip: kd, reserve: rd, zit: { ...m.zit.position }, scooter: SCOOTER ? true : false,
    rijder: m.rijder.groep.parent === m.zit, bijrijder: m.bijrijder.groep.parent === m.zitBak, bak: { ...m.zitBak.position }, meshes: n,
    mat };
});
const zb = zij.heel.max.x - zij.heel.min.x, zl = zij.heel.max.z - zij.heel.min.z;
ok(zij.wielen === 4, 'drie wielen en een reservewiel', `${zij.wielen}`);
const onder = zij.opGrond.filter((y, i) => i < 3);
ok(onder.every(y => Math.abs(y) < 0.02), 'de drie wielen op de grond', zij.opGrond.map(r2).join(', '));
ok(zb < 1.8 && zl < 2.3 && zij.heel.min.y > -0.01, 'binnen 1,8 m breed (een R75 met zijspan is 1,73 m) en 2,3 m lang, niets onder de grond', `${r2(zb)} × ${r2(zl)} m`);
ok(zij.rijder && Math.abs(zij.zit.x) < 1e-6 && Math.abs(zij.zit.y - 0.36) < 1e-6 && Math.abs(zij.zit.z - 0.3) < 1e-6, 'de rijder op het zadel van de scooters (SCOOTER)');
ok(zij.bijrijder && zij.kuip && zij.bak.x > zij.kuip.min.x && zij.bak.x < zij.kuip.max.x && zij.bak.z > zij.kuip.min.z && zij.bak.z < zij.kuip.max.z, 'de bijrijder in de kuip');
ok(zij.reserve && zij.kuip && zij.reserve.min.z > zij.kuip.max.z - 0.06, 'het reservewiel achter de kuip, niet erin', zij.reserve ? `wiel vanaf z ${r2(zij.reserve.min.z)}, kuip tot ${r2(zij.kuip.max.z)}` : '');
ok(zij.mat.kaartZonderUv === 0 && zij.mat.vreemd === 0 && zij.mat.dubbelMetKaart === 0 && zij.mat.doorzichtigVreemd === 0, 'de materialen volgen dezelfde regels', zij.mat.soorten.join(', '));

kop('6. detail');
ok(staf.meshes >= 60, 'de stafauto: veel meer onderdelen dan de BX (7)', `${staf.meshes} meshes`);
ok(zij.meshes >= 60, 'het zijspan: veel meer onderdelen dan eerst (16)', `${zij.meshes} meshes`);

kop('7. van binnen');
const bin = await page.evaluate(() => {
  const { THREE, N } = window.__t;
  const g = N.maakStafauto();
  g.updateMatrixWorld(true);
  const B = g.userData.binnen, oog = g.userData.oog;
  if (!B) return null;
  const d = (naam) => { let o = null; B.groep.traverse(x => { if (!o && x.name === naam) o = x; }); return o; };
  const wp = (o) => { const v = new THREE.Vector3(); o.getWorldPosition(v); return v; };
  // de stoel van de bestuurder: de zitting die het dichtst onder de ogen ligt
  let zitTop = -Infinity;
  g.userData.bak.traverse(o => {
    if (!o.isMesh || !o.geometry.parameters || o.geometry.parameters.depth !== 0.44) return;
    const p = wp(o); if (Math.abs(p.x - oog.x) < 0.1 && Math.abs(p.z - oog.z) < 0.3) zitTop = Math.max(zitTop, p.y + 0.045);
  });
  const klok = wp(d('klok')), naald = d('naald');
  // de panelen: de normaal in de wereld moet naar het midden wijzen
  const panelen = [];
  B.groep.traverse(o => { if (o.name === 'binnenpaneel') { const n = new THREE.Vector3(0, 0, 1).applyQuaternion(o.getWorldQuaternion(new THREE.Quaternion())); panelen.push({ x: wp(o).x, nx: n.x }); } });
  // sturen en snelheid
  const auto = { steer: 0, speed: 0 };
  B.update(auto, 1);
  const stuur0 = B.draai.rotation.z, naald0 = naald.rotation.z;
  auto.steer = 0.4; auto.speed = 50 / 3.6;
  for (let i = 0; i < 30; i++) B.update(auto, 0.1);
  const stuur1 = B.draai.rotation.z, naald1 = naald.rotation.z;
  const verwacht = N.stafKlokHoek(0.5);
  // de spiegel: het hoogste kleine ding vlak achter de ruit
  let spiegel = null;
  B.groep.traverse(o => { if (o.isMesh && o.geometry.parameters && o.geometry.parameters.width === 0.17) spiegel = wp(o); });
  const draaiStuur = wp(B.draai);
  // materiaalregels voor het interieur alleen
  const mat = window.__materialen(B.groep);
  return {
    uit: B.groep.visible === false, oog, zitTop, ruitTop: 0.98 + 0.46,
    klok: { x: klok.x, y: klok.y, z: klok.z }, stuur: { x: draaiStuur.x, y: draaiStuur.y, z: draaiStuur.z },
    panelen, stuur0, stuur1, naald0, naald1, verwacht, spiegel: spiegel && { y: spiegel.y, z: spiegel.z }, mat,
    nul: N.stafKlokHoek(0), vol: N.stafKlokHoek(1),
  };
});
ok(!!bin && bin.uit, 'het interieur staat uit tot je erin zit (userData.binnen)');
if (bin) {
  ok(bin.oog.y > bin.zitTop + 0.55 && bin.oog.y < bin.ruitTop - 0.05, 'de ogen boven de stoel en onder de bovenrand van de ruit',
    `ogen ${r2(bin.oog.y)} m, zitting ${r2(bin.zitTop)}, ruit tot ${r2(bin.ruitTop)}`);
  const dKlok = Math.hypot(bin.klok.x - bin.oog.x, bin.klok.y - bin.oog.y, bin.klok.z - bin.oog.z);
  ok(bin.klok.z < bin.oog.z - 0.3 && dKlok < 0.75 && bin.klok.y < bin.oog.y, 'de snelheidsmeter vóór je, onder je ogen, binnen armlengte', `${r2(dKlok)} m`);
  ok(bin.stuur.z < bin.oog.z && Math.abs(bin.stuur.x - bin.oog.x) < 0.05 && bin.stuur.y < bin.oog.y, 'het stuur recht voor de bestuurder');
  ok(bin.panelen.length === 2 && bin.panelen.every(p => Math.sign(p.nx) === -Math.sign(p.x) && Math.abs(p.nx) > 0.99), 'de binnenpanelen kijken naar binnen',
    bin.panelen.map(p => `x ${r2(p.x)} → ${r2(p.nx)}`).join(', '));
  // (sinds stap 181 draait het stuur de goede kant op: links is tegen de klok in, dus + bij steer > 0; de proef verwachtte nog −)
ok(Math.abs(bin.stuur0) < 1e-6 && Math.abs(bin.stuur1 - 0.4 * 4.2) < 1e-6, 'het stuur draait mee met het sturen (links tegen de klok in)', `${r2(bin.stuur1)} rad`);
  ok(Math.abs(bin.naald0 - bin.nul) < 1e-3 && Math.abs(bin.naald1 - bin.verwacht) < 0.02, 'de naald staat op 0 en bij 50 km/u halverwege de schaal',
    `${r2(bin.naald1)} tegen ${r2(bin.verwacht)} rad`);
  ok(bin.nul > bin.vol, 'de schaal loopt met de klok mee');
  ok(!!bin.spiegel && bin.spiegel.y > bin.oog.y && bin.spiegel.z < bin.oog.z, 'de binnenspiegel hangt boven je ogen, vóór je');
  ok(bin.mat.kaartZonderUv === 0 && bin.mat.vreemd === 0 && bin.mat.dubbelMetKaart === 0 && bin.mat.doorzichtigVreemd === 0, 'het interieur volgt dezelfde materiaalregels',
    `${bin.mat.meshes} meshes, ${bin.mat.soorten.join(', ')}`);
}

await browser.close();
console.log(fout ? `\n${fout} fout${fout > 1 ? 'en' : ''}` : '\nalles goed');
process.exit(fout ? 1 : 0);
