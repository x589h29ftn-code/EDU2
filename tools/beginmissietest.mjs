/*
 Stap 119: ronde 3 van de steekproef van 4 okt 2026 (de speelelementen van missie 1 tot 5), en het muziekje
 van de intro in de heli van missie 18.

   node tools/server.mjs 8123 &   node tools/beginmissietest.mjs [poort]   (npm run beginmissietest)

 1. Missie 1: na de eerste treffer springt de man die het verst weg zit op en schiet terug; hij telt als een
    van de vier, en opnieuw beginnen of laden zet hem terug op zijn stoel.
 2. Missie 2: Mark praat onderweg, om de tien tellen een zin, en niet vlak bij de poort.
 3. Missie 4: Mark wacht bij de boerderij; van het terrein af slaat de bewaking alarm (één ster); met
    sterren geen aflevering; zonder: het gesprek en € 500.
 4. Missie 5: de dief rent te voet langzamer dan jij; met een auto achter hem aan duikt hij de tuinen in,
    naar een plek ver van de rijweg, en zegt hij dat.
 5. Missie 18: in de heli het muziekje van de intro, aanzwellend; na de heli rustig weg; de missiemuziek
    zwijgt eronder.
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fouten++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  localStorage.removeItem('tinga.spel.v1'); localStorage.removeItem('tinga.checkpoint.v1');
  const g = window.__game, v = g.verhaal;
  window.__autoplay = false;
  g.player.active = true;
  window.__W = await import('/js/world.js');
  window.__D = await import('/js/dief.js');
  const dicht = () => document.getElementById('dialoog').hidden;
  window.__dicht = dicht;
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) v.update(dt); };
  window.__klik = (max = 120) => { for (let i = 0; i < max && !dicht(); i++) { v.toets(); window.__stap(2); } };
  // de tekst van de balk, alleen als hij open is
  window.__zin = () => (dicht() ? '' : document.getElementById('dialoogTekst').textContent);
  window.__laad = (extra) => {
    const s = v.bewaar(); s.volgende = null;
    Object.assign(s, extra);
    g.politie.reset();
    v.herstel(s);
    window.__stap(2);
  };
  window.__zetAuto = (c, x, z, yaw = c.yaw || 0) => {
    c.x = x; c.z = z; c.yaw = yaw; c.speed = 0;
    if (c.mesh) { c.mesh.position.set(x, c.mesh.position.y, z); c.mesh.rotation.y = yaw; }
  };
});

// ------------------------------------------------------------------ 1. missie 1
kop('missie 1: een van het gezelschap springt op');
const m1 = await page.evaluate(async () => {
  const THREE = await import('three');
  const g = window.__game, v = g.verhaal, P = g.player;
  v.__startMissie('molenkrite');
  window.__stap(2);
  window.__laad({ missie: 'molenkrite', fase: 'opdracht', om: [] });
  const doelen = v.doelen();
  const uit = { voor: doelen.length };
  // de speler aan de straatkant, tien meter van de tafel
  const posities = doelen.map(o => o.getWorldPosition(new THREE.Vector3()));
  const mx = posities.reduce((a, p) => a + p.x, 0) / posities.length, mz = posities.reduce((a, p) => a + p.z, 0) / posities.length;
  const M = v.mark.groep.position;
  const r = Math.hypot(M.x - mx, M.z - mz) || 1;
  P.pos.set(mx + (M.x - mx) / r * 10, 0, mz + (M.z - mz) / r * 10);
  P.health = 100;
  // wie zit het verst weg?
  const verst = posities.map((p, i) => ({ i, d: Math.hypot(p.x - P.pos.x, p.z - P.pos.z) })).sort((a, b) => b.d - a.d);
  // de eerste treffer: niet de verste
  const eerste = verst[verst.length - 1].i;
  v.raak(doelen[eerste]);
  window.__stap(1);
  const O = v.opspringer;
  uit.opspringer = !!O;
  if (!O) return uit;
  uit.wasVerst = O.prop === doelen[verst[0].i];
  uit.propWeg = !O.prop.visible;
  uit.stoel = !!O.stoel.parent;
  const w = O.groep.wachters[0];
  uit.staat = w.staat;
  uit.bijStoel = Math.hypot(w.persoon.groep.position.x - O.stoel.position.x, w.persoon.groep.position.z - O.stoel.position.z);
  uit.zin = window.__zin();
  uit.doelenNa = v.doelen().length;
  uit.persoonDoel = v.doelen().includes(w.persoon.groep);
  // tien tellen: schiet hij terug?
  for (let i = 0; i < 200; i++) { v.update(0.05); g.scene.updateMatrixWorld(); }
  uit.leven = P.health;
  P.health = 100;
  // hem raken, en de rest
  v.raak(w.persoon.groep);
  window.__stap(2);
  uit.naHem = v.doelen().length;
  uit.hijNeer = O.groep.alleNeer;
  for (const o of [...v.doelen()]) v.raak(o);
  window.__stap(4);
  uit.fase = v.fase;
  // opnieuw beginnen: weer op zijn stoel
  v.__startMissie('molenkrite');
  window.__stap(2);
  uit.terug = { prop: O.prop.visible, stoel: !!O.stoel.parent, lijf: !!w.persoon.groep.parent, opspringer: !!v.opspringer };
  return uit;
});
ok(m1.voor === 4, 'vier man aan tafel', String(m1.voor));
ok(m1.opspringer, 'na de eerste treffer springt er een op');
if (m1.opspringer) {
  ok(m1.wasVerst, 'de man die het verst weg zit');
  ok(m1.propWeg && m1.stoel, 'zijn stoel blijft leeg achter', `zittend weg: ${m1.propWeg}, lege stoel: ${m1.stoel}`);
  ok(m1.bijStoel < 2.5, 'hij staat naast zijn stoel', `${m1.bijStoel.toFixed(2)} m`);
  ok(m1.staat === 'aanval', 'en valt meteen aan', m1.staat);
  ok(/blaffer/.test(m1.zin), 'Mark waarschuwt', m1.zin);
  ok(m1.doelenNa === 3 && m1.persoonDoel, 'drie doelen over, waaronder hij', String(m1.doelenNa));
  ok(m1.leven < 100 && m1.leven > 40, 'hij schiet terug, maar zwak', `leven ${m1.leven}`);
  ok(m1.hijNeer && m1.naHem === 2, 'één treffer en hij ligt; hij telt als een van de vier', `${m1.naHem} doelen over`);
  ok(m1.fase === 'briefing', 'alle vier neer: de briefing', m1.fase);
  ok(m1.terug.prop && !m1.terug.stoel && !m1.terug.lijf && !m1.terug.opspringer, 'opnieuw beginnen: hij zit weer op zijn stoel', JSON.stringify(m1.terug));
}

// ------------------------------------------------------------------ 2. missie 2
kop('missie 2: Mark praat onderweg');
const m2 = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  v.__startMissie('rijden');
  window.__stap(2);
  const auto = v.auto;
  if (!auto) return { geenAuto: true };
  P.pos.set(auto.x, 0, auto.z);
  P.inCar = auto;
  const zinnen = [];
  let vorige = '', eerste = null;
  for (let i = 0; i < 1000; i++) {
    v.update(0.05);
    const z = window.__zin();
    if (z && z !== vorige) { zinnen.push(z); if (eerste === null) eerste = i * 0.05; }
    vorige = z;
  }
  const uit = { zinnen, eerste, i: v.rijPraat.i, totaal: v.rijPraat.zinnen, fase: v.fase };
  // vlak bij de poort zegt hij niets meer
  v.__startMissie('rijden');
  window.__stap(2);
  const pt = v.plekken.poort;
  const a2 = v.auto;
  window.__zetAuto(a2, pt.x + 55, pt.z);
  P.pos.set(a2.x, 0, a2.z); P.inCar = a2;
  window.__stap(300);
  uit.bijPoort = v.rijPraat.i;
  P.inCar = null;
  return uit;
});
ok(!m2.geenAuto, 'de auto van missie 2 staat er');
if (!m2.geenAuto) {
  ok(m2.i === m2.totaal && m2.zinnen.length >= m2.totaal, `al zijn ${m2.totaal} zinnen in een rit van 50 s`, m2.zinnen.join(' | ').slice(0, 220));
  ok(m2.eerste !== null && m2.eerste >= 3 && m2.eerste <= 6, 'de eerste na een paar tellen', `${m2.eerste} s`);
  ok(m2.bijPoort === 0, 'en niet vlak bij de poort', `${m2.bijPoort} zinnen`);
}

// ------------------------------------------------------------------ 3. missie 4
kop('missie 4: alarm, Mark bij de boerderij, € 500');
const m4 = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player, W = window.__W;
  g.politie.reset();
  // de vrachtwagen komt uit missie 3
  v.__startMissie('bewaking');
  window.__stap(2);
  v.__startMissie('afleveren');
  window.__stap(2);
  const truck = v.truck, schuur = v.plekken.schuur, pt = v.plekken.poort;
  const A = v.aflever, M = v.mark.groep.position;
  const uit = {
    markZicht: v.mark.groep.visible,
    markSchuur: Math.hypot(M.x - schuur.x, M.z - schuur.z),
    markVrij: (() => { const [x, z] = W.resolveCollisions(M.x, M.z, 0.3); return Math.hypot(x - M.x, z - M.z); })(),
  };
  if (!truck || !pt) return { ...uit, geen: true };
  P.inCar = truck;
  // nog op het terrein: niets
  window.__zetAuto(truck, pt.x + 40, pt.z);
  P.pos.set(truck.x, 0, truck.z);
  window.__stap(4);
  uit.alarmVroeg = v.aflever.alarm;
  // van het terrein af
  window.__zetAuto(truck, pt.x + 140, pt.z);
  P.pos.set(truck.x, 0, truck.z);
  window.__stap(4);
  uit.alarm = v.aflever.alarm;
  uit.sterren = g.politie.ster;
  uit.alarmZin = window.__zin();
  window.__klik();
  // bij de schuur, met de ster
  window.__zetAuto(truck, schuur.x + 14, schuur.z + 8);
  P.pos.set(truck.x, 0, truck.z);
  window.__stap(6);
  uit.metSterZin = window.__zin();
  uit.metSterFase = v.fase;
  uit.opdracht = document.getElementById('opdracht').textContent;
  window.__klik();
  // de ster weg: Mark praat en betaalt
  g.politie.reset();
  const geldVoor = v.geld;
  window.__stap(6);
  uit.gesprek = [];
  for (let i = 0; i < 10 && !window.__dicht(); i++) { uit.gesprek.push(window.__zin()); v.toets(); window.__stap(2); }
  window.__stap(4);
  uit.geld = v.geld - geldVoor;
  uit.fase = v.fase;
  uit.melding = document.getElementById('missie').textContent;
  P.inCar = null;
  return uit;
});
ok(m4.markZicht && m4.markSchuur < 30, 'Mark wacht bij de boerderij', `${m4.markSchuur.toFixed(1)} m van de schuur`);
ok(m4.markVrij < 0.05, 'en staat niet in een muur', `${m4.markVrij.toFixed(3)} m weggeduwd`);
if (!m4.geen) {
  ok(!m4.alarmVroeg, 'op het terrein nog geen alarm');
  ok(m4.alarm && m4.sterren >= 1, 'van het terrein af: alarm, een ster', `${m4.sterren} ster`);
  ok(/politie gebeld/.test(m4.alarmZin), 'Mark belt het door', m4.alarmZin);
  ok(m4.metSterFase === 'rijden' && /zwaailichten/.test(m4.metSterZin), 'met een ster bij de schuur: niet afleveren', `${m4.metSterFase} · ${m4.metSterZin}`);
  ok(/politie kwijt/.test(m4.opdracht), 'de opdracht zegt wat er moet', m4.opdracht);
  ok(m4.gesprek.some(z => /Netjes/.test(z)) && m4.gesprek.some(z => /500/.test(z)), 'zonder sterren: Mark praat', m4.gesprek.join(' | '));
  ok(m4.geld === 500, 'en betaalt € 500', `€ ${m4.geld}`);
  ok(m4.fase === 'klaar' && /MISSIE VOLTOOID/.test(m4.melding), 'MISSIE VOLTOOID', `${m4.fase} · ${m4.melding.slice(0, 30)}`);
}

// ------------------------------------------------------------------ 4. missie 5
kop('missie 5: de dief en de tuinen');
const m5 = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player, W = window.__W, D = window.__D;
  v.__startMissie('johan');
  window.__stap(2);
  const dief = v.dief;
  if (!dief) return { geen: true };
  const uit = { punten: dief.tuinPunten.length };
  uit.puntenVanWeg = Math.min(...dief.tuinPunten.map(q => W.afstandTotRijweg(q[0], q[1])));
  // te voet: hoe hard rent hij?
  dief.schrik(); dief.update(1.2, P);
  const pos = dief.positie;
  P.inCar = null;
  P.pos.set(pos.x + 10, 0, pos.z);
  let snelst = 0;
  for (let i = 0; i < 60; i++) {
    const x0 = pos.x, z0 = pos.z;
    dief.update(0.05, P);
    snelst = Math.max(snelst, Math.hypot(pos.x - x0, pos.z - z0) / 0.05);
  }
  uit.snelst = snelst;
  // de achtervolging in het verhaal, met een auto achter hem aan
  window.__laad({ missie: 'johan', fase: 'achtervolging', dief: { staat: 'vlucht', x: pos.x, z: pos.z, yaw: 0, vluchtT: 5, omT: 0 } });
  const auto = g.vehicles.voegToe({ x: pos.x + 16, z: pos.z, yaw: 0, soort: 'hatch', kleur: 0x2a3f8f });
  P.inCar = auto; P.pos.set(auto.x, 0, auto.z);
  let tuinZin = '';
  for (let i = 0; i < 40 && !dief.tuin; i++) { v.update(0.05); const z = window.__zin(); if (/tuinen/.test(z)) tuinZin = z; }
  uit.tuin = dief.tuin;
  for (let i = 0; i < 4; i++) { v.update(0.05); const z = window.__zin(); if (/tuinen/.test(z)) tuinZin = z; }
  uit.zin = tuinZin;
  uit.opdracht = document.getElementById('opdracht').textContent;
  if (!dief.tuin) return uit;
  const route = dief.route.slice();
  const eind = route[route.length - 1];
  uit.eindVanWeg = W.afstandTotRijweg(eind[0], eind[1]);
  uit.routeLang = route.reduce((a, p, i) => a + (i ? Math.hypot(p[0] - route[i - 1][0], p[1] - route[i - 1][1]) : 0), 0);
  // hij loopt de route af (de auto blijft staan)
  let t = 0, vastT = 0, vorige = { x: pos.x, z: pos.z };
  while (t < 40 && dief.tuin) {
    v.update(0.05); t += 0.05;
    const d = Math.hypot(pos.x - vorige.x, pos.z - vorige.z);
    vastT = d < 0.01 ? vastT + 0.05 : 0;
    if (vastT > 3) break;
    vorige = { x: pos.x, z: pos.z };
  }
  uit.tijd = t; uit.vast = vastT > 3;
  uit.aankomst = Math.hypot(pos.x - eind[0], pos.z - eind[1]);
  uit.gepakt = dief.staat === 'gepakt';
  uit.tuinRen = D.TUIN;
  P.inCar = null;
  return uit;
});
ok(!m5.geen, 'de dief staat er');
if (!m5.geen) {
  ok(m5.punten >= 20, 'genoeg plekken in tuinen en steegjes', `${m5.punten} punten`);
  ok(m5.puntenVanWeg >= 5.9, 'allemaal ver van de rijweg', `minstens ${m5.puntenVanWeg.toFixed(1)} m`);
  ok(m5.snelst > 6 && m5.snelst < 7.4, 'te voet rent hij langzamer dan jij (7,5 m/s)', `${m5.snelst.toFixed(2)} m/s`);
  ok(m5.tuin, 'met de auto achter hem aan: de tuinen in');
  ok(/tuinen/.test(m5.zin), 'en dat zegt hij', m5.zin);
  ok(/stap uit/.test(m5.opdracht), 'de opdracht zegt: te voet erachteraan', m5.opdracht);
  if (m5.tuin) {
    ok(m5.eindVanWeg >= 5.9, 'naar een plek waar geen auto komt', `${m5.eindVanWeg.toFixed(1)} m van de rijweg, route ${m5.routeLang.toFixed(0)} m`);
    ok(!m5.vast && m5.aankomst < 2.5, 'en hij komt er ook', `${m5.tijd.toFixed(1)} s, ${m5.aankomst.toFixed(1)} m van het eind${m5.vast ? ', vast' : ''}`);
    ok(!m5.gepakt, 'de auto heeft hem niet');
  }
}

// ------------------------------------------------------------------ 5. muziek in de heli
kop('missie 18: het muziekje van de intro in de heli');
const heli = await page.evaluate(async () => {
  const g = window.__game, v = g.verhaal, G = g.geluid;
  G.start();
  const wacht = (ms) => new Promise(r => setTimeout(r, ms));
  const uit = {};
  // los: aan, aanzwellen
  G.heliMuziek(true);
  const st0 = G.heliMuziekStand();
  uit.bestand = st0 && st0.bestand;
  const vols = [];
  for (let i = 0; i < 12; i++) { await wacht(400); G.heliMuziek(true); vols.push(G.heliMuziekStand().volume); }
  uit.aan = vols;
  // de missiemuziek zwijgt eronder
  G.missiemuziek(true);
  await wacht(600);
  const s = G.stand ? G.stand() : {};
  uit.missie = s.missie;
  G.missiemuziek(false);
  // uit: rustig weg
  const voor = G.heliMuziekStand().volume;
  G.heliMuziek(false);
  const uitVols = [];
  for (let i = 0; i < 10; i++) { await wacht(400); G.heliMuziek(false); uitVols.push(G.heliMuziekStand().volume); }
  uit.voor = voor; uit.uit = uitVols;
  uit.nogAan = G.heliMuziekStand().aan;
  // in het verhaal: in de heli aan, bij de auto uit
  v.__startMissie('uitzending');
  window.__stap(2);
  window.__laad({ missie: 'uitzending', fase: 'heli' });
  window.__stap(10);
  uit.verhaalFase = v.fase;
  uit.inHeli = G.heliMuziekStand().aan;
  window.__laad({ missie: 'uitzending', fase: 'naarAuto' });
  window.__stap(10);
  uit.naHeliFase = v.fase;
  uit.naHeli = G.heliMuziekStand().aan;
  v.__startMissie('molenkrite');
  window.__stap(2);
  return uit;
});
ok(heli.bestand === 'audio/intro/intro.mp3', 'het muziekje van de intro', heli.bestand);
const stijgt = heli.aan.every((x, i) => i === 0 || x >= heli.aan[i - 1] - 1e-3) && heli.aan[heli.aan.length - 1] > heli.aan[0];
ok(stijgt && heli.aan[0] < 0.25, 'het zwelt aan (fade in)', heli.aan.map(x => x.toFixed(2)).join(' '));
ok(heli.missie == null || heli.missie < 0.01, 'de missiemuziek zwijgt eronder', String(heli.missie));
const daalt = heli.uit.every((x, i) => i === 0 || x <= heli.uit[i - 1] + 1e-3) && heli.uit[heli.uit.length - 1] < heli.voor;
ok(daalt && !heli.nogAan, 'uit: rustig weg (fade out)', `${heli.voor.toFixed(2)} → ${heli.uit.map(x => x.toFixed(2)).join(' ')}`);
ok(heli.uit[0] > heli.voor * 0.5, 'en niet in één keer', `na 0,4 s nog ${heli.uit[0].toFixed(2)} van ${heli.voor.toFixed(2)}`);
ok(heli.inHeli, 'in het verhaal: aan zolang Erik in de heli zit', heli.verhaalFase);
ok(!heli.naHeli, 'en uit als hij eruit is', heli.naHeliFase);

console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
await browser.close();
process.exit(fouten ? 1 : 0);
