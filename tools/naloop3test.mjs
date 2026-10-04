/*
 Stap 122: missie 16 tot 18 en het uitje nagelopen op fouten (4 okt 2026, "neem ook de volgende 5 door").

   node tools/server.mjs 8123 &   node tools/naloop3test.mjs [poort]   (npm run naloop3test)

 1. Missie 18: laden tijdens de montage stopt het filmbeeld en het fragment; de geladen missie loopt door.
 2. Missie 18: na de montage opgeslagen (of neergegaan): Mark en Johan staan bij de zuil, de stick zit erin,
    en het gesprek buiten rondt de missie af.
 3. Missie 18: neergaan bij de loods begint bij de loods, met muziek; neergaan in het filmbeeld op de brug
    laat geen filmbalken staan.
 4. Het uitje: weglopen van de Golf of neergaan tijdens de rit zet het uitje terug, met de klok weer aan.
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
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  const g = window.__game, v = g.verhaal;
  localStorage.removeItem('tinga.spel.v1'); localStorage.removeItem('tinga.checkpoint.v1');
  document.getElementById('overlay').style.display = 'none';
  window.__W = await import('/js/world.js');
  window.__autoplay = false;
  g.player.active = false;
  const dicht = () => document.getElementById('dialoog').hidden;
  window.__dicht = dicht;
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) { g.player.health = 100; v.update(dt); } };
  window.__klik = (max = 120) => { for (let i = 0; i < max && !dicht(); i++) { v.toets(); window.__stap(1); } };
  window.__tot = (fase, maxS = 20, dt = 0.05) => {
    for (let t = 0; t < maxS && v.fase !== fase; t += dt) { window.__stap(1, dt); if (!dicht()) v.toets(); }
    return v.fase === fase;
  };
  window.__zet = (x, z) => { const P = g.player; if (P.inCar) { P.inCar.speed = 0; P.inCar = null; } P.zit = false; P.eye = P.eyeStaand || P.eye; P.pos.set(x, 0, z); P.applyCamera(); };
  window.__E = () => {
    const was = g.player.active; g.player.active = true;
    if (!v.toets()) for (const r of [...g.woningen, g.boerderij, g.supermarkt, g.studio]) if (r && r.toets && r.toets()) break;
    g.player.active = was;
  };
  window.__laad = (extra) => {
    const s = v.bewaar(); s.volgende = null;
    Object.assign(s, extra);
    g.politie.reset();
    v.herstel(s);
    window.__stap(2);
  };
  // vrij spelen na missie 17 (missie 18 kan beginnen), of na het einde
  window.__na17 = (extra = {}) => window.__laad({ missie: 'klaar', fase: 'klaar', punt: null, huis: 'Koningsspil 20', veteraanKlaar: true,
    politieautoKlaar: true, brugKlaar: true, schriftKlaar: true, raceKlaar: true, schaduwKlaar: true, invalKlaar: true, invalKeus: 2,
    invalTelefoon: true, ronaldKlaar: true, ronaldPraatte: true, uitzendingKlaar: false, geld: 5000, ...extra });
  window.__bij = (fase, punt = null) => {
    if (v.missie !== 'uitzending') { window.__na17(); v.__geenVolgende(); v.startMissie('uitzending'); window.__stap(2); }
    window.__laad({ missie: 'uitzending', fase, punt });
  };
});

// ------------------------------------------------------------------ 1. laden tijdens de montage
kop('missie 18: laden tijdens de montage');
const montage = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, st = g.studio, P = st.plekken;
  window.__bij('naarStudio');
  // Johan bij de ingang, dan de minuut
  const j = v.uitzending.johan.groep.position;
  window.__zet(j.x + P.f[0] * 1.5, j.z + P.f[1] * 1.5);
  window.__stap(4);
  window.__klik();
  window.__tot('binnen', 30);
  window.__klik();
  window.__zet(P.deurBuiten.x + P.f[0] * 1.2, P.deurBuiten.z + P.f[1] * 1.2);
  window.__stap(1);
  window.__E();
  window.__zet(P.tafel.x, P.tafel.z);
  window.__stap(2);
  window.__E(); window.__stap(30);
  window.__E(); window.__stap(20);
  const voor = { fase: v.fase, film: v.uitzending.film, wil: g.geluid.uitzendingStand().wil };
  // F9 naar een opslag na missie 17 (vrij spelen)
  window.__na17();
  v.__geenVolgende();
  const plek = { x: g.player.pos.x, z: g.player.pos.z };
  window.__stap(100);
  return {
    voor,
    na: { missie: v.missie, fase: v.fase, film: v.uitzending.film, wil: g.geluid.uitzendingStand().wil,
      filmKlasse: document.body.classList.contains('film'), slot: st.slot, onAir: st.onAir,
      verschoven: Math.hypot(g.player.pos.x - plek.x, g.player.pos.z - plek.z) },
  };
});
ok(montage.voor.film === 'uitzending', 'de montage loopt', JSON.stringify(montage.voor));
ok(!montage.na.film && !montage.na.filmKlasse && !montage.na.wil, 'na het laden: geen filmbeeld en geen fragment meer', JSON.stringify(montage.na));
ok(montage.na.missie === 'klaar' && montage.na.fase === 'klaar' && montage.na.verschoven < 0.5, 'de geladen stand blijft staan (niet terug de studio in)', JSON.stringify(montage.na));
ok(!montage.na.slot && !montage.na.onAir, 'de studio is weer gewoon (deur open, ON AIR uit)', JSON.stringify(montage.na));

// ------------------------------------------------------------------ 2. na de montage
kop('missie 18: na de montage opgeslagen');
const buiten = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, st = g.studio;
  window.__bij('naarBuiten', { missie: 'uitzending', fase: 'naarBuiten' });
  const uit = { fase: v.fase, mark: v.mark.groep.visible, johan: v.uitzending.johan.groep.visible, usb: st.usb, slot: st.slot,
    punt: v.punt, opdracht: document.getElementById('opdracht').textContent };
  // neergaan: weer bij de zuil
  v.__herstartMissie(); window.__stap(2);
  uit.opnieuw = { fase: v.fase, johan: v.uitzending.johan.groep.visible };
  // naar Johan: het gesprek buiten, en de missie is af
  const j = v.uitzending.johan.groep.position;
  window.__zet(j.x + 3, j.z + 3);
  window.__stap(6);
  window.__klik();
  window.__stap(2);
  uit.eind = { fase: v.fase, klaar: v.uitzending.klaar };
  return uit;
});
ok(buiten.fase === 'naarBuiten' && buiten.mark && buiten.johan, 'Mark en Johan staan bij de zuil', JSON.stringify(buiten));
ok(buiten.usb && !buiten.slot, 'de stick zit erin, de deur is open', JSON.stringify({ usb: buiten.usb, slot: buiten.slot }));
ok(buiten.punt && buiten.punt.fase === 'naarBuiten', 'het herstelpunt is buiten, niet de minuut', JSON.stringify(buiten.punt));
ok(buiten.opnieuw.fase === 'naarBuiten' && buiten.opnieuw.johan, 'na neergaan ook', JSON.stringify(buiten.opnieuw));
ok(buiten.eind.klaar && (buiten.eind.fase === 'avond' || buiten.eind.fase === 'einde'), 'het gesprek buiten rondt de missie af', JSON.stringify(buiten.eind));

// ------------------------------------------------------------------ 3. de avond: de loods en de brug
kop('missie 18: neergaan bij de loods en op de brug');
const avond = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  window.__bij('achtervolging', { missie: 'uitzending', fase: 'achtervolging' });
  window.__klik();
  const auto = v.avond.auto;
  P.inCar = auto;
  // (instappen: dan begint de achtervolging)
  for (let t = 0; t < 4 && v.fase !== 'achtervolging'; t += 0.05) { window.__stap(1); if (!window.__dicht()) v.toets(); }
  for (let t = 0; t < 200 && v.fase === 'achtervolging'; t += 0.1) {
    const r = v.avond.rit;
    if (r) { auto.x = r.x; auto.z = r.z; P.pos.set(r.x, 0, r.z); }
    window.__stap(1, 0.1);
    if (!window.__dicht()) v.toets();
  }
  const uit = { fase: v.fase, punt: v.punt };
  const autos = g.vehicles.cars.length;
  v.__herstartMissie(); window.__stap(2);
  v.__herstartMissie(); window.__stap(2);
  uit.opnieuw = { fase: v.fase, spanning: v.spanning, groei: g.vehicles.cars.length - autos };
  // de politie, over de brug, en neer in het filmbeeld
  window.__bij('politie', { missie: 'uitzending', fase: 'politie' });
  window.__klik();
  const a = v.avond, br = a.brugAssen, wagen = a.auto;
  const p = br.p(4, 0);
  wagen.yaw = br.noord; wagen.x = p.x; wagen.z = p.z; wagen.speed = 17;
  if (wagen.mesh) { wagen.mesh.visible = true; wagen.mesh.position.set(p.x, br.hoogte, p.z); wagen.mesh.rotation.y = br.noord; }
  P.inCar = wagen;
  for (let t = 0; t < 4 && v.fase !== 'brugFilm'; t += 0.05) window.__stap(1, 0.05);
  window.__stap(20);
  uit.brug = { fase: v.fase, film: document.body.classList.contains('film') };
  const autos2 = g.vehicles.cars.length;
  v.__herstartMissie(); window.__stap(2);
  uit.naBrug = { fase: v.fase, film: document.body.classList.contains('film'), reden: v.waaromNietOpslaan(), groei: g.vehicles.cars.length - autos2 };
  return uit;
});
ok(avond.fase === 'gevecht' && avond.punt && avond.punt.fase === 'gevecht', 'bij de loods: het herstelpunt is het gevecht', JSON.stringify(avond));
ok(avond.opnieuw.fase === 'gevecht' && avond.opnieuw.spanning, 'neergaan: weer bij de loods, met de muziek', JSON.stringify(avond.opnieuw));
ok(avond.opnieuw.groei <= 1, 'opnieuw beginnen stapelt geen auto\'s', `${avond.opnieuw.groei} erbij`);
ok(avond.brug.fase === 'brugFilm' && avond.brug.film, 'over de brug: het filmbeeld', JSON.stringify(avond.brug));
ok(!avond.naBrug.film && avond.naBrug.reden !== 'tijdens een filmbeeld', 'neer in het filmbeeld: daarna geen filmbalken meer', JSON.stringify(avond.naBrug));
ok(avond.naBrug.groei <= 1, 'en de politieauto\'s van het filmbeeld stapelen niet', `${avond.naBrug.groei} erbij`);

// ------------------------------------------------------------------ 4. het uitje
kop('het uitje: weglopen en neergaan tijdens de rit');
const uitje = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  const naarDeRit = () => {
    window.__na17({ uitzendingKlaar: true });
    g.sfeer.loopt = true;
    for (let t = 0; t < 200 && v.uitje.fase !== 'wacht'; t += 0.5) window.__stap(1, 0.5);
    window.__stap(30);
    const w = g.woningen[0];
    window.__zet(w.plekken.deurBinnen.x, w.plekken.deurBinnen.z);
    window.__stap(2); window.__klik();
    g.sfeer.uur = 9;
    v.kiesHuis(1);
    window.__klik();
    for (let t = 0; t < 15 && v.zwart; t += 0.05) window.__stap(1);
    window.__stap(4);
    return { fase: v.uitje.fase, loopt: g.sfeer.loopt };
  };
  const uit = {};
  uit.rit1 = naarDeRit();
  // uitstappen en weglopen
  const golf = v.uitje.golf;
  P.inCar = null;
  P.pos.set(golf.x + 200, 0, golf.z);
  window.__stap(4);
  uit.weg = { fase: v.uitje.fase, loopt: g.sfeer.loopt, bezig: v.uitje.bezig };
  // en neergaan tijdens de rit
  uit.rit2 = naarDeRit();
  v.dood();
  window.__stap(70);
  if (v.keuzeOpen) v.kies('missie');
  window.__stap(2);
  uit.neer = { fase: v.uitje.fase, loopt: g.sfeer.loopt, bezig: v.uitje.bezig };
  return uit;
});
ok(uitje.rit1.fase === 'rijden' && !uitje.rit1.loopt, 'in de Golf naar VV Sneek, de klok stil', JSON.stringify(uitje.rit1));
ok(uitje.weg.fase === 'rust' && uitje.weg.loopt && !uitje.weg.bezig, 'weglopen van de Golf: het uitje is voorbij, de klok loopt weer', JSON.stringify(uitje.weg));
ok(uitje.rit2.fase === 'rijden', 'nog een keer de rit', JSON.stringify(uitje.rit2));
ok(uitje.neer.fase === 'rust' && uitje.neer.loopt && !uitje.neer.bezig, 'neergaan tijdens de rit: ook voorbij, de klok loopt weer', JSON.stringify(uitje.neer));

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);
