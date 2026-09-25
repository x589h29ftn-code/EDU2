/*
 Geparkeerde auto's op afstand (ronde van 25 sep 2026: "neem het spel door op wat
 beter kan en optimalisatie").

   node tools/server.mjs 8123 &   node tools/autolodtest.mjs [poort]

 tools/optimeer.mjs liet zien dat de geparkeerde auto's driekwart van alle
 driehoeken in beeld waren: 3,2 tot 4,5 miljoen van de 4,4 tot 5,3. Twee
 oorzaken: een auto is 5836 driehoeken, ook op honderd meter, en een auto op
 schaal nul (voorbij het zicht) ging gewoon door de vertex shader — een tegel
 van 480 m heeft er honderd. Nu tekent een stapel alleen wat er staat, en
 voorbij 45 m de grove uitvoering (js/carmodel.js).

 1. In de wijk: hoeveel driehoeken de stapels samen tekenen, tegen wat het
    vroeger was (alle instanties van elke tegel die aan stond, vol model).
 2. Dichtbij het volle model, ver het grove, voorbij het zicht niets.
 3. Een treffer vindt de goede auto terug, ook uit de grove stapel.
 4. Een geparkeerde auto overspuiten verandert zijn kleur (dat deed niets: de
    stapel werd op de soort opgezocht, en er is er een per soort én tegel).
 5. Binnen is de wijk leeg, en buiten staat alles weer terug (dat ging mis:
    `lod` sloeg een tegel over die al ver weg was, dus na een bezoek aan een
    huis stonden alle 1443 auto's van de wereld aan).
 6. De voetgangers, om dezelfde reden: van de honderddertig zijn er achttien
    binnen tweehonderd meter, maar ze werden allemaal getekend en kregen elk
    beeld hun houding uitgerekend. Nu alleen wie binnen `ZICHT` is, en een
    treffer vindt via `slotNaar` de goede persoon terug.
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
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

const r = await page.evaluate(async () => {
  const THREE = await import('three');
  const C = await import('/js/carmodel.js');
  const g = window.__game, v = g.vehicles, s = g.start;
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const tri = (m) => (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
  const uit = {};
  // ---- 1. hoeveel er getekend wordt
  v.lod(s.x, s.z);
  let nu = 0, vroeger = 0, dicht = 0, ver = 0, aanTegels = 0;
  const volTri = {};
  for (const k in v.stapels) {
    const st = v.stapels[k].stapel;
    const vol = st.meshes.reduce((n, m) => n + tri(m), 0);
    volTri[k.split('|')[0]] = vol;
    for (const m of st.alle) if (m.visible) nu += m.count * tri(m);
    dicht += st.meshes[0].count; ver += st.verMeshes[0].count;
    if (v.stapels[k].aan) { aanTegels++; vroeger += v.stapels[k].autos.length * vol; }
  }
  uit.teken = { nu, vroeger, dicht, ver, aanTegels, volTri };
  // ---- 2. per auto: dichtbij vol, ver grof, voorbij het zicht niets
  let fout = 0, gezien = { dicht: 0, ver: 0, weg: 0 };
  for (const k in v.stapels) {
    const st = v.stapels[k];
    const inDicht = new Set(), inVer = new Set();
    for (let j = 0; j < st.stapel.meshes[0].count; j++) inDicht.add(st.stapel.nummer(st.stapel.meshes[0], j));
    for (let j = 0; j < st.stapel.verMeshes[0].count; j++) inVer.add(st.stapel.nummer(st.stapel.verMeshes[0], j));
    st.autos.forEach((c, i) => {
      if (!c || c.mesh) return;
      const d = Math.hypot(c.x - s.x, c.z - s.z);
      const moet = d > 170 ? 'weg' : d > C.VER_VANAF ? 'ver' : 'dicht';
      const is = inDicht.has(i) ? 'dicht' : inVer.has(i) ? 'ver' : 'weg';
      if (moet !== is && Math.abs(d - 170) > 1 && Math.abs(d - C.VER_VANAF) > 1) fout++;
      gezien[is]++;
    });
  }
  uit.indeling = { fout, gezien };
  // ---- 3. een treffer: de dichtstbijzijnde auto en een verre, via een straal
  const doelen = v.doelen();
  const rc = new THREE.Raycaster();
  const raak = (car) => {
    // recht van boven op het dak: dan ligt er geen andere auto tussen
    rc.set(new THREE.Vector3(car.x, 6, car.z), new THREE.Vector3(0, -1, 0)); rc.far = 7;
    const h = rc.intersectObjects(doelen, false)[0];
    if (!h) return 'mis';
    const hp = car.hp;
    const geraakt = v.hit(h.object, h.instanceId);
    if (geraakt) geraakt.hp += 10;                       // de schade terugdraaien
    return geraakt === car ? 'goed' : geraakt ? 'andere' : 'niets';
  };
  const geparkeerd = v.cars.filter(c => c.inst && !c.mesh && c.getekend);
  geparkeerd.sort((a, b) => Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(b.x - s.x, b.z - s.z));
  const dichtste = geparkeerd[0], verre = geparkeerd.find(c => Math.hypot(c.x - s.x, c.z - s.z) > C.VER_VANAF + 10);
  uit.raak = { dicht: raak(dichtste), ver: verre ? raak(verre) : 'geen', dAfstand: Math.hypot(dichtste.x - s.x, dichtste.z - s.z), vAfstand: verre ? Math.hypot(verre.x - s.x, verre.z - s.z) : 0 };
  // ---- 4. overspuiten
  const kleurVan = (car) => {
    const st = v.stapels[car.inst.sleutel].stapel;
    const lijst = car.opAfstand ? st.verMeshes : st.meshes;
    for (let j = 0; j < lijst[0].count; j++) if (st.nummer(lijst[0], j) === car.inst.i) { const c = new THREE.Color(); lijst[0].getColorAt(j, c); return c.getHex(); }
    return null;
  };
  const oud = dichtste.kleur, voor = kleurVan(dichtste);
  v.verf(dichtste, 0x1f7a3a);
  uit.verf = { voor, na: kleurVan(dichtste) };
  v.verf(dichtste, oud);
  // ---- 5. binnen en weer buiten
  v.zichtbaarheid(false);
  let binnen = 0; for (const k in v.stapels) for (const m of v.stapels[k].stapel.alle) if (m.visible) binnen += m.count;
  v.zichtbaarheid(true); v.lod(s.x, s.z);
  let buiten = 0; for (const k in v.stapels) buiten += v.stapels[k].stapel.meshes[0].count + v.stapels[k].stapel.verMeshes[0].count;
  uit.binnen = { binnen, buiten, was: dicht + ver };
  // ---- en in het echte beeld: de driehoeken van de beeldpas met de auto's aan en uit
  const p = g.player; p.inCar = null; p.pos.set(s.x, 0, s.z); p.yaw = s.yaw || 0; p.pitch = 0; p.applyCamera();
  const meet = () => { g.renderer.info.reset(); g.renderer.render(g.scene, g.camera); return g.renderer.info.render.triangles; };
  const alles = meet();
  for (const k in v.stapels) for (const m of v.stapels[k].stapel.alle) m.userData._v = m.visible, m.visible = false;
  const zonder = meet();
  for (const k in v.stapels) for (const m of v.stapels[k].stapel.alle) m.visible = m.userData._v;
  uit.beeld = { alles, autos: alles - zonder };
  return uit;
});

const mens = await page.evaluate(async () => {
  const THREE = await import('three');
  const g = window.__game, n = g.npcs, s = g.start;
  // eerst zonder kijkkegel (die zet js/main.js elk beeld): iedereen binnen 200 m
  n.kijk = null;
  n.update(1 / 60, 1, s.x, s.z);
  // de verdeling hoort bij de plekken van dít moment (in `update` gaat hij vóór het lopen)
  n.verdeelSlots(s.x, s.z);
  const tri = (m) => (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
  const binnen = n.people.filter(p => Math.hypot(p.x - s.x, p.z - s.z) <= n.ZICHT).length;
  const namen = Object.keys(n.meshes);
  const perPersoon = namen.reduce((t, k) => t + tri(n.meshes[k]) * (n.meshes[k].userData.paar ? 2 : 1), 0);
  const counts = namen.every(k => n.meshes[k].count === (n.meshes[k].userData.paar ? 2 : 1) * n.nZicht);
  // een treffer op instantie 0 van de romp
  const wie = n.people[n.slotNaar[0]];
  const hp = { alive: wie.alive, raken: wie.raken, nodig: wie.nodig };
  const raak = n.hit(n.meshes.romp, 0, 9);
  Object.assign(wie, hp);
  // de kleur van het shirt op de plek van een persoon verderop in de rij
  const j = Math.max(0, n.nZicht - 1), c = new THREE.Color();
  n.meshes.romp.getColorAt(j, c);
  const kleur = c.getHex() === n.kleurVan[n.slotNaar[j]].shirt;
  // en met de kijkkegel: naar het oosten kijkend telt wie achter je staat niet mee,
  // behalve dichtbij (vijftien meter: zijn schaduw, en omdraaien)
  const kegelFout = [];
  let voorN = 0, achterN = 0;
  n.kijk = { x: 1, z: 0 };
  n.verdeelSlots(s.x, s.z);
  for (let i = 0; i < n.people.length; i++) {
    const p = n.people[i], dx = p.x - s.x, dz = p.z - s.z, d = Math.hypot(dx, dz);
    if (d > n.ZICHT) continue;
    const moet = d <= 15 || dx / d >= Math.cos(75 * Math.PI / 180) - 1e-9;
    if (moet !== (n.slotVan[i] >= 0)) kegelFout.push(i);
    if (n.slotVan[i] >= 0) voorN++; else achterN++;
  }
  n.kijk = null; n.verdeelSlots(s.x, s.z);
  const buiten = n.hit(n.meshes.romp, n.nZicht + 1) === null;
  const nZicht = n.nZicht;
  // de tijd per beeld: met de camera erbij (zoals js/main.js het doet) en zonder
  // (dan krijgt iedereen een lichaam, zoals het was)
  const klok = (cx, cz) => { n.update(1 / 60, 2, cx, cz); const a = performance.now(); for (let k = 0; k < 60; k++) n.update(1 / 60, 2 + k / 60, cx, cz); return (performance.now() - a) / 60; };
  const msAlles = klok(null, null), msZicht = klok(s.x, s.z);
  return { kegelFout: kegelFout.length, voorN, achterN, msAlles, msZicht, binnen, nZicht, totaal: n.people.length, counts, perPersoon,
    raak: raak && Math.hypot(raak.x - wie.x, raak.z - wie.z) < 0.01,
    kleur, buiten };
});

kop('hoeveel er getekend wordt');
const T = r.teken;
console.log(`       ${T.dicht} auto's vol, ${T.ver} grof, op ${T.aanTegels} tegels; een auto is ${JSON.stringify(T.volTri)} driehoeken`);
ok(T.nu < T.vroeger * 0.25, 'de stapels tekenen minder dan een kwart van wat het was',
  `${(T.nu / 1e6).toFixed(2)} miljoen driehoeken tegen ${(T.vroeger / 1e6).toFixed(2)} miljoen`);
ok(r.beeld.autos < 800000, 'in het beeld aan de Molenkrite kosten de auto\'s nog geen 0,8 miljoen driehoeken (was 3,2)',
  `${(r.beeld.autos / 1e6).toFixed(2)} miljoen van ${(r.beeld.alles / 1e6).toFixed(2)} miljoen in beeld`);

kop('voetgangers');
ok(mens.nZicht === mens.binnen && mens.nZicht < mens.totaal / 2, 'alleen wie binnen tweehonderd meter is krijgt een lichaam',
  `${mens.nZicht} van ${mens.totaal}: ${((mens.totaal - mens.nZicht) * mens.perPersoon / 1e6).toFixed(2)} miljoen driehoeken per pas minder`);
ok(mens.msZicht < mens.msAlles * 0.6, 'en de rest krijgt geen houding meer uitgerekend',
  `${mens.msZicht.toFixed(2)} ms per beeld tegen ${mens.msAlles.toFixed(2)} ms met iedereen`);
ok(mens.kegelFout === 0 && mens.achterN > 0, 'en alleen wie vóór je is (of binnen vijftien meter): achter je geen lichaam',
  `${mens.voorN} getekend, ${mens.achterN} achter je weggelaten, ${mens.kegelFout} verkeerd`);
ok(mens.counts, 'en elk onderdeel tekent precies zoveel instanties (armen en benen twee per persoon)');
ok(mens.raak, 'een treffer op een instantie raakt de persoon die daar staat');
ok(mens.kleur, 'en zijn kleuren schuiven mee naar zijn plek');
ok(mens.buiten, 'een instantie voorbij wie er getekend wordt raakt niemand');

kop('dichtbij vol, ver grof');
ok(r.indeling.fout === 0 && r.indeling.gezien.dicht > 0 && r.indeling.gezien.ver > 0, 'elke auto staat in de goede uitvoering',
  `${r.indeling.gezien.dicht} vol, ${r.indeling.gezien.ver} grof, ${r.indeling.gezien.weg} niet getekend, ${r.indeling.fout} verkeerd`);

kop('schieten op een geparkeerde auto');
ok(r.raak.dicht === 'goed', 'een treffer vindt de goede auto terug', `op ${r.raak.dAfstand.toFixed(0)} m: ${r.raak.dicht}`);
ok(r.raak.ver === 'goed', 'ook in de grove stapel', `op ${r.raak.vAfstand.toFixed(0)} m: ${r.raak.ver}`);

kop('overspuiten');
ok(r.verf.na === 0x1f7a3a && r.verf.voor !== r.verf.na, 'een geparkeerde auto overspuiten verandert zijn kleur',
  `#${(r.verf.voor ?? 0).toString(16)} → #${(r.verf.na ?? 0).toString(16)}`);

kop('binnen en buiten');
ok(r.binnen.binnen === 0, 'binnen staat er geen auto in de wijk', `${r.binnen.binnen}`);
ok(r.binnen.buiten === r.binnen.was, 'buiten staat alles weer terug', `${r.binnen.buiten} van ${r.binnen.was}`);

console.log(`\n${fout ? fout + ' fout' : 'alles goed'}`);
await browser.close();
process.exit(fout ? 1 : 0);
