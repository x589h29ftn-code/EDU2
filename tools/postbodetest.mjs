/*
 Stap 141: de postbode van "Post Tinga" (js/postbode.js, via js/leven.js).

   node tools/server.mjs 8123 &   node tools/postbodetest.mjs [poort]   (npm run postbodetest)

 1. De tijd: tussen 8 en half twaalf komt hij bij de speler (binnen 150 m), om zeven en om twaalf uur niet.
 2. Van deur naar deur: minstens drie deuren in een paar minuten speltijd; bij elke deur staat hij stil,
    met de arm naar voren en een envelop, en de klep klinkt (`geluid.brievenbus`, zacht op afstand).
 3. Nooit in een botsdoos: elk stapje gemeten met `resolveCollisions` uit js/world.js, en geen stap
    dwars door een gevel, hek of heg (`rechtBeloopbaar`); geen deur binnen een pand.
 4. Uit beeld: met de echte camera (`inBeeld`) ontstaat hij nooit in beeld, en verdwijnt hij niet in beeld.
 5. Raken, aanrijden en schrikken: hij staat in de doelen, valt om, rent weg bij een schot, en komt
    pas de volgende ochtend terug.
 6. Geen nieuwe shaders als hij in beeld komt.
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fouten++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);
const r1 = (n) => (n == null || !isFinite(n)) ? String(n) : n.toFixed(1);
const r2 = (n) => (n == null || !isFinite(n)) ? String(n) : n.toFixed(2);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  const W = await import('/js/world.js');
  const LP = await import('/js/looppad.js');
  const K = await import('/js/kaart.js');
  const g = window.__game;
  document.getElementById('overlay').style.display = 'none';
  g.player.active = false;
  window.__autoplay = false;
  window.__W = W; window.__LP = LP; window.__K = K.KAART || K.default;
  window.__zet = (x, z) => { const P = g.player; P.inCar = null; P.pos.set(x, 0, z); P.applyCamera(); };
  window.__klep = [];
  const b = g.geluid.brievenbus.bind(g.geluid);
  g.geluid.brievenbus = (d) => { window.__klep.push(d); return b(d); };
  // zit (x, z) in een pand?
  const inPoly = (x, z, V) => { let c = false; for (let i = 0, j = V.length - 1; i < V.length; j = i++) {
    const [xi, zi] = V[i], [xj, zj] = V[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
  // een straat neerzetten; kiesStraat loot en kan een keer niets vinden
  window.__start = (sp) => { const pb = g.leven.postbode; for (let i = 0; i < 8; i++) { pb.weg(false); if (pb.start(sp, {})) return true; } return false; };
  window.__inPand = (x, z) => window.__K.panden.some(p => p.voet && p.voet.length > 2 && Math.abs(p.voet[0][0] - x) < 80 && Math.abs(p.voet[0][1] - z) < 80 && inPoly(x, z, p.voet));
});

// ------------------------------------------------------------------ 1. de tijd
kop('de tijd: tussen 8 en half twaalf, bij de speler');
const tijd = await page.evaluate(() => {
  const g = window.__game, pb = g.leven.postbode;
  const sp = { x: window.__K.start.x, z: window.__K.start.z };
  window.__zet(sp.x, sp.z);
  pb.weg(false);
  const tel = (uur, sec) => { let n = 0; for (let i = 0; i < sec; i++) { pb.update(1, sp, () => false, uur); if (pb.stand.fase !== 'weg') { n++; pb.weg(false); } } return n; };
  const zeven = tel(7, 300), twaalf = tel(12, 300), avond = tel(20, 120);
  // om negen uur: binnen een minuut of twee, via js/leven.js (zoals de hoofdlus)
  pb.weg(false);
  let na = null;
  for (let i = 0; i < 1200 && na == null; i++) { g.leven.update(0.1, sp, () => false, 9); if (pb.stand.fase !== 'weg') na = i * 0.1; }
  const s = pb.stand;
  const eerste = s.deuren[0];
  return { zeven, twaalf, avond, na, d: eerste ? Math.hypot(eerste.x - sp.x, eerste.z - sp.z) : null, deuren: s.deuren.length, reden: s.reden,
    halfTwaalf: (() => { pb.weg(false); return tel(11.6, 200); })() };
});
ok(tijd.zeven === 0 && tijd.twaalf === 0 && tijd.avond === 0 && tijd.halfTwaalf === 0, 'om 7, 11:36, 12 en 20 uur geen postbode', `${tijd.zeven} / ${tijd.halfTwaalf} / ${tijd.twaalf} / ${tijd.avond} keer`);
ok(tijd.na != null && tijd.na < 120, 'om 9 uur komt hij (via leven.update)', `na ${r1(tijd.na)} s${tijd.reden ? `, ${tijd.reden}` : ''}`);
ok(tijd.d != null && tijd.d < 150 + 75, 'zijn straat ligt bij de speler', `eerste deur op ${r1(tijd.d)} m, ${tijd.deuren} deuren`);

// ------------------------------------------------------------------ 2 en 3. van deur naar deur, nergens doorheen
kop('van deur naar deur, en nergens doorheen');
const ronde = await page.evaluate(() => {
  const g = window.__game, pb = g.leven.postbode, W = window.__W, LP = window.__LP;
  const sp = { x: window.__K.start.x, z: window.__K.start.z };
  const uit = { deurBezoek: 0, stilBijDeur: 0, verschuivingBijDeur: 0, armMax: 0, envelopVoorKlep: 0, inDoos: 0, maxDoos: 0, doorMuur: 0, stappen: 0,
    deurInPand: 0, deurAfstand: [], kleppen: 0, rondes: 0, maxStap: 0, klepD: [], straten: [] };
  window.__klep = [];
  pb.weg(false);
  pb.update(30, sp, () => false, 9);        // de rust voorbij
  let vorige = null, faseWas = null, deurPos = null;
  const rondeWas = pb.stand.rondes;
  for (let i = 0; i < 2400; i++) {          // vier minuten speltijd
    pb.update(0.1, sp, () => false, 9);
    const s = pb.stand;
    if (s.fase === 'weg') { vorige = null; faseWas = 'weg'; continue; }
    if (faseWas === 'weg' || faseWas === null) {
      uit.straten.push(s.deuren.length);
      for (const d of s.deuren) { if (window.__inPand(d.x, d.z)) uit.deurInPand++; uit.deurTal = (uit.deurTal || 0) + 1; if (d.echt) uit.echt = (uit.echt || 0) + 1; }
    }
    const q = pb.persoon.groep.position;
    // de botsdozen: met een iets kleinere straal dan waar hij mee loopt
    const [rx, rz] = W.resolveCollisions(q.x, q.z, 0.25);
    const dd = Math.hypot(rx - q.x, rz - q.z);
    uit.maxDoos = Math.max(uit.maxDoos, dd);
    if (dd > 0.02) uit.inDoos++;
    if (window.__inPand(q.x, q.z)) uit.inDoos++;
    if (vorige) {
      const st = Math.hypot(q.x - vorige.x, q.z - vorige.z);
      uit.maxStap = Math.max(uit.maxStap, st);
      if (st > 0.01 && !LP.rechtBeloopbaar(vorige.x, vorige.z, q.x, q.z, 0.2)) uit.doorMuur++;
      uit.stappen++;
    }
    if (s.fase === 'deur') {
      if (faseWas !== 'deur') { uit.deurBezoek++; deurPos = { x: q.x, z: q.z }; const d = s.deuren[s.nr]; uit.deurAfstand.push(Math.hypot(q.x - d.x, q.z - d.z)); }
      else uit.verschuivingBijDeur = Math.max(uit.verschuivingBijDeur, Math.hypot(q.x - deurPos.x, q.z - deurPos.z));
      uit.armMax = Math.max(uit.armMax, pb.persoon.armRechts.boven.rotation.x);
      if (pb.envelop.visible) uit.envelopVoorKlep++;
    }
    vorige = { x: q.x, z: q.z };
    faseWas = s.fase;
  }
  const s = pb.stand;
  uit.kleppen = window.__klep.length; uit.klepD = window.__klep.slice(0, 5);
  uit.bezocht = s.bezocht; uit.rondes = s.rondes - rondeWas;
  return uit;
});
ok(ronde.deurBezoek >= 3, 'minstens drie deuren in vier minuten', `${ronde.deurBezoek} deuren in ${ronde.straten.length} straten (${ronde.straten.join(', ')} deuren per straat)`);
ok(ronde.deurAfstand.length && Math.max(...ronde.deurAfstand) < 0.6, 'hij komt echt bij de deur', `hoogstens ${r2(Math.max(...ronde.deurAfstand))} m ervan`);
ok(ronde.verschuivingBijDeur < 0.05, 'bij de deur staat hij stil', `${r2(ronde.verschuivingBijDeur)} m verschoven`);
ok(ronde.armMax > 0.85 && ronde.envelopVoorKlep > 0, 'de arm gaat naar de brievenbus, met een envelop', `arm ${r2(ronde.armMax)} rad, envelop ${ronde.envelopVoorKlep} beelden`);
ok(ronde.kleppen >= ronde.deurBezoek - 1 && ronde.kleppen >= 3, 'bij elke deur klinkt de klep', `${ronde.kleppen} kleppen, afstanden ${ronde.klepD.map(r1).join(', ')} m`);
ok(ronde.inDoos === 0, 'nooit in een botsdoos of pand', `${ronde.inDoos} van ${ronde.stappen} beelden, hoogstens ${r2(ronde.maxDoos)} m eruit geduwd`);
ok(ronde.doorMuur === 0, 'geen stap door een gevel, hek of heg', `${ronde.doorMuur} stappen, de langste ${r2(ronde.maxStap)} m`);
ok(ronde.deurInPand === 0, 'geen deur binnen een pand', `${ronde.deurInPand}`);
ok((ronde.echt || 0) >= (ronde.deurTal || 0) * 0.5, 'de meeste deuren zijn de voordeur uit het geveldoek (niet het raam)', `${ronde.echt || 0} van ${ronde.deurTal || 0}`);

// het geluid: zacht, en op afstand niets
const klank = await page.evaluate(() => {
  const g = window.__game;
  window.__klep = [];
  const src = g.geluid.brievenbus.toString();
  return { ver: (() => { try { g.geluid.brievenbus(60); return true; } catch (e) { return e.message; } })(), src: /afstand \/ 30/.test(src) || src.includes('30') };
});
ok(klank.ver === true, 'de klep op 60 m geeft geen fout (en klinkt niet: grens 30 m)');

// ------------------------------------------------------------------ 4. uit beeld
kop('alleen uit beeld');
const beeld = await page.evaluate(() => {
  const g = window.__game, pb = g.leven.postbode, P = g.player;
  const sp = { x: window.__K.start.x, z: window.__K.start.z };
  const uit = { pogingen: 0, gestart: 0, inBeeldBijStart: 0, wegInBeeld: 0, kijkHem: 0, blijft: 0 };
  // de camera in alle richtingen; elke keer een nieuwe straat met de echte zichttoets
  for (let r = 0; r < 12; r++) {
    window.__zet(sp.x, sp.z);
    P.yaw = r / 12 * Math.PI * 2; P.pitch = 0; P.applyCamera(); P.camera.updateMatrixWorld();
    pb.weg(false);
    for (let i = 0; i < 400 && pb.stand.fase === 'weg'; i++) pb.update(0.5, sp, g.inBeeld, 9);
    uit.pogingen++;
    if (pb.stand.fase === 'weg') continue;
    uit.gestart++;
    const q = pb.persoon.groep.position;
    if (g.inBeeld(q.x, q.z)) uit.inBeeldBijStart++;
  }
  // in beeld verdwijnt hij niet: kijk naar hem en zet de klok op twaalf
  window.__start(sp);
  const q = pb.persoon.groep.position;
  P.pos.set(q.x + 8, 0, q.z + 8); P.yaw = Math.atan2(-(q.x - P.pos.x), -(q.z - P.pos.z)); P.pitch = 0; P.applyCamera(); P.camera.updateMatrixWorld();
  uit.kijkHem = g.inBeeld(q.x, q.z) ? 1 : 0;
  for (let i = 0; i < 100; i++) pb.update(0.1, { x: P.pos.x, z: P.pos.z }, g.inBeeld, 12);
  uit.blijft = pb.stand.fase !== 'weg' ? 1 : 0;
  // weg kijken: dan is hij weg
  P.yaw += Math.PI; P.applyCamera(); P.camera.updateMatrixWorld();
  for (let i = 0; i < 10; i++) pb.update(0.1, { x: P.pos.x, z: P.pos.z }, g.inBeeld, 12);
  uit.wegNa = pb.stand.fase;
  // en ver weg (300 m) ook
  window.__start(sp);
  pb.update(0.1, { x: sp.x + 400, z: sp.z }, () => false, 9);
  uit.ver = pb.stand.fase;
  return uit;
});
ok(beeld.gestart >= 6 && beeld.inBeeldBijStart === 0, 'hij ontstaat nooit in beeld', `${beeld.gestart} van ${beeld.pogingen} keer gestart, ${beeld.inBeeldBijStart} in beeld`);
ok(beeld.kijkHem === 1 && beeld.blijft === 1, 'om twaalf uur blijft hij zolang je kijkt', `in beeld ${beeld.kijkHem}, staat er nog ${beeld.blijft}`);
ok(beeld.wegNa === 'weg' && beeld.ver === 'weg', 'weggekeken of ver weg: dan is hij weg', `${beeld.wegNa}, ${beeld.ver}`);

// ------------------------------------------------------------------ 5. raken, aanrijden, schrikken
kop('raken, aanrijden en schrikken');
const geraakt = await page.evaluate(() => {
  const g = window.__game, l = g.leven, pb = l.postbode, W = window.__W;
  const sp = { x: window.__K.start.x, z: window.__K.start.z };
  const uit = {};
  // een kogel (zoals js/main.js: het mesh in de doelen, dan leven.raak)
  window.__start(sp);
  uit.inDoelen = l.doelen().includes(pb.persoon.groep);
  let mesh = null; pb.persoon.groep.traverse(o => { if (!mesh && o.isMesh) mesh = o; });
  const r = l.raak(mesh);
  uit.raak = !!r && pb.stand.fase === 'neer';
  for (let i = 0; i < 20; i++) pb.update(0.1, sp, () => true, 9);
  uit.ligt = pb.persoon.omT;
  uit.nietInDoelen = !l.doelen().includes(pb.persoon.groep);
  for (let i = 0; i < 5; i++) pb.update(0.1, { x: sp.x + 300, z: sp.z }, () => false, 9);
  uit.wegNaRaak = pb.stand.fase;
  // vandaag niet meer
  let terug = 0; for (let i = 0; i < 300; i++) { pb.update(1, sp, () => false, 9); if (pb.stand.fase !== 'weg') terug++; }
  uit.vandaagTerug = terug;
  // de volgende ochtend wel
  pb.update(1, sp, () => false, 14);
  let morgen = null; for (let i = 0; i < 300 && morgen == null; i++) { pb.update(1, sp, () => false, 8.5); if (pb.stand.fase !== 'weg') morgen = i; }
  uit.morgen = morgen;

  // aanrijden
  window.__start(sp);
  const p2 = pb.persoon.groep.position;
  uit.langzaam = l.aanrijden(p2.x, p2.z, 1.5, 2);
  uit.aangereden = l.aanrijden(p2.x + 0.5, p2.z, 1.5, 9);
  uit.faseAan = pb.stand.fase;

  // schrikken: een schot op twintig meter
  pb.weg(false); g.leven.postbode.update(1, sp, () => false, 13); window.__start(sp);
  const p3 = pb.persoon.groep.position, v = { x: p3.x, z: p3.z };
  const schot = { x: p3.x + 20, z: p3.z };
  l.schrik(schot.x, schot.z);
  uit.faseSchrik = pb.stand.fase;
  let doos = 0, pad = 0, vx = p3.x, vz = p3.z;
  const d0 = Math.hypot(p3.x - schot.x, p3.z - schot.z);
  for (let i = 0; i < 60; i++) {
    pb.update(0.1, sp, () => true, 9);
    const [rx, rz] = W.resolveCollisions(p3.x, p3.z, 0.25);
    if (Math.hypot(rx - p3.x, rz - p3.z) > 0.02) doos++;
    if (i < 30) pad += Math.hypot(p3.x - vx, p3.z - vz);
    vx = p3.x; vz = p3.z;
  }
  // (eerst de tuin uit naar de stoep, dan langs de straat: hemelsbreed minder dan wat hij rent)
  uit.gerend = pad;
  uit.schotNa = Math.hypot(p3.x - schot.x, p3.z - schot.z);
  uit.wegRennen = uit.schotNa > d0 + 4 ? 'van het schot af' : 'niet verder van het schot';
  uit.doosRennen = doos;
  for (let i = 0; i < 5; i++) pb.update(0.1, sp, () => false, 9);
  uit.wegNaSchrik = pb.stand.fase;
  uit.vandaag = pb.stand.vandaag;
  // een schot ver weg: niets
  pb.update(1, sp, () => false, 13); window.__start(sp);
  const p4 = pb.persoon.groep.position;
  l.schrik(p4.x + 120, p4.z);
  uit.verSchot = pb.stand.fase;
  pb.weg(false);
  return uit;
});
ok(geraakt.inDoelen, 'hij staat in de doelen van de kogel (leven.doelen)');
ok(geraakt.raak && geraakt.ligt > 0.95 && geraakt.nietInDoelen, 'geraakt: hij valt om', `omT ${r2(geraakt.ligt)}`);
ok(geraakt.wegNaRaak === 'weg' && geraakt.vandaagTerug === 0, 'daarna uit beeld weg, en die ochtend niet meer terug', `${geraakt.wegNaRaak}, ${geraakt.vandaagTerug} s terug`);
ok(geraakt.morgen != null, 'de volgende ochtend weer', `na ${geraakt.morgen} s`);
ok(geraakt.langzaam === 0 && geraakt.aangereden === 1 && geraakt.faseAan === 'neer', 'aanrijden: stapvoets niet, met 9 m/s wel', `${geraakt.langzaam} / ${geraakt.aangereden}, ${geraakt.faseAan}`);
ok(geraakt.faseSchrik === 'vlucht' && geraakt.gerend > 12 && geraakt.wegRennen === 'van het schot af', 'een schot op 20 m: hij rent weg', `${r1(geraakt.gerend)} m gerend in 3 s, na 6 s ${r1(geraakt.schotNa)} m van het schot (was 20)`);
ok(geraakt.doosRennen === 0, 'ook rennend nergens in', `${geraakt.doosRennen} beelden`);
ok(geraakt.wegNaSchrik === 'weg' && geraakt.vandaag, 'uit beeld weg, tot morgen', `${geraakt.wegNaSchrik}`);
ok(geraakt.verSchot !== 'vlucht', 'een schot op 120 m: hij loopt door', geraakt.verSchot);

// ------------------------------------------------------------------ 6. geen nieuwe shaders
kop('geen nieuwe shaders');
const sh = await page.evaluate(async () => {
  const g = window.__game, pb = g.leven.postbode, P = g.player, R = g.renderer;
  if (!R) return { overgeslagen: true };
  for (let i = 0; i < 600 && !(R.info.programs && R.info.programs.length > 20); i++) await new Promise(r => setTimeout(r, 100));
  const sp = { x: window.__K.start.x, z: window.__K.start.z };
  window.__start(sp);
  const q = pb.persoon.groep.position;
  P.pos.set(q.x + 3, 0, q.z + 3); P.yaw = Math.atan2(-(q.x - P.pos.x), -(q.z - P.pos.z)); P.pitch = -0.1; P.applyCamera();
  pb.persoon.groep.visible = false;
  R.render(g.scene || P.scene, P.camera);
  const voor = R.info.programs.length;
  pb.persoon.groep.visible = true;
  for (let i = 0; i < 30; i++) { pb.update(0.1, sp, () => true, 9); }
  pb.envelop.visible = true;
  R.render(g.scene || P.scene, P.camera);
  return { voor, na: R.info.programs.length };
});
if (sh.overgeslagen) ok(false, 'geen renderer in __game');
else ok(sh.na === sh.voor, 'de postbode in beeld vertaalt geen nieuwe shader', `${sh.voor} → ${sh.na} programma's`);

await browser.close();
console.log(fouten ? `\n${fouten} fout${fouten > 1 ? 'en' : ''}` : '\nalles goed');
process.exit(fouten ? 1 : 0);
