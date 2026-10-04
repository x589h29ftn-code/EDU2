/*
 Stap 121: missie 11 tot 15 nagelopen op fouten (4 okt 2026, "check de volgende 5 op dezelfde wijze").

   node tools/server.mjs 8123 &   node tools/naloop2test.mjs [poort]   (npm run naloop2test)

 1. Missie 11: na het afleveren staat missie 12 al klaar terwijl Mark praat; het aftellen wacht op het
    gesprek, en neergaan tijdens het gesprek laat missie 12 niet meer weg.
 2. Missie 12: de dranghekken die er al stonden komen mee in de opslag; alle drie gezet en het gesprek weg
    gaat door naar de C4; de auto's van het konvooi verdwijnen echt (geen stapel bij elke poging) en laden
    van een andere missie ruimt het dek op.
 3. Na missie 12: "Een paar dagen later" blijft zwart terwijl missie 13 begint, en komt rustig terug.
 4. Laden ruimt missie 14 en 15 op (ringen, verkeersvrij parcours, de balk van het volgen).
 5. Missie 14: laden na de finish is gewonnen, laden na het verliezen geeft de keuze terug, en laden
    midden in de race zet je op de grid in de raceauto in plaats van op de plek van het opslaan.
 6. Racen voor geld: neergaan is de inleg kwijt en vrij spelen, niet het verhaal van missie 14 opnieuw.
 7. Een mislukte missie begint zonder sterren opnieuw.
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
await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__autoplay = false;
  g.player.active = true;
  localStorage.removeItem('tinga.spel.v1'); localStorage.removeItem('tinga.checkpoint.v1');
  const dicht = () => document.getElementById('dialoog').hidden;
  window.__dicht = dicht;
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) { g.player.health = 100; v.update(dt); } };
  window.__klik = (max = 120) => { for (let i = 0; i < max && !dicht(); i++) { v.toets(); window.__stap(2); } };
  window.__laad = (extra) => {
    const s = v.bewaar(); s.volgende = null; s.punt = null;
    Object.assign(s, extra);
    g.politie.reset();
    v.herstel(s);
    window.__stap(2);
  };
  window.__opdracht = () => (document.getElementById('opdracht').hidden ? '' : document.getElementById('opdracht').textContent);
});

// ------------------------------------------------------------------ 1. missie 11
kop('missie 11: missie 12 staat klaar, ook na neergaan in het gesprek');
const m11 = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  window.__laad({ missie: 'politieauto', fase: 'brengen', politieautoKlaar: false, brugKlaar: false });
  P.c4 = 4;
  window.__stap(2);
  const a = v.politieauto, t = v.plekken.thuis;
  a.x = t.x + 3; a.z = t.z + 2; a.speed = 0;
  a.mesh.position.set(a.x, a.mesh.position.y, a.z);
  P.inCar = null; P.pos.set(a.x + 1.5, 0, a.z);
  window.__stap(6);
  const uit = { missie: v.missie, gesprek: !window.__dicht(), volgende: v.volgendeMissie };
  // tien tellen met het gesprek open: het aftellen staat stil
  window.__stap(200);
  uit.naTien = { missie: v.missie, over: v.volgendeMissie && v.volgendeMissie.over };
  // neer tijdens het gesprek, en de missie opnieuw (buiten een missie: hier weer opstaan)
  v.dood();
  window.__stap(70);
  uit.keuze = v.keuzeOpen;
  if (v.keuzeOpen) v.kies('missie');
  uit.naDood = { volgende: v.volgendeMissie, dicht: window.__dicht() };
  window.__stap(120);
  uit.eind = v.missie;
  return uit;
});
ok(m11.missie === 'klaar' && m11.gesprek, 'missie 11 geslaagd, Mark praat', JSON.stringify({ m: m11.missie, g: m11.gesprek }));
ok(m11.volgende && m11.volgende.naam === 'brug', 'missie 12 staat al klaar tijdens het gesprek', JSON.stringify(m11.volgende));
ok(m11.naTien.missie === 'klaar', 'zolang Mark praat begint missie 12 niet', JSON.stringify(m11.naTien));
ok(m11.naDood.volgende && m11.naDood.volgende.naam === 'brug' && m11.naDood.dicht, 'na neergaan in het gesprek staat missie 12 er nog', JSON.stringify(m11.naDood));
ok(m11.eind === 'brug', 'en hij begint', m11.eind);

// ------------------------------------------------------------------ 2. missie 12
kop('missie 12: hekken in de opslag, konvooi, opruimen');
const m12 = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, V = g.vehicles;
  const uit = {};
  window.__laad({ missie: 'brug', fase: 'versperren', politieautoKlaar: true, brugKlaar: false, brugGezet: { hekken: [true, true, false], c4: [false, false, false, false] } });
  let b = v.brug;
  uit.hekken = b.hekken.slice();
  uit.zichtbaar = b.hekStukken.map(h => !!(h.groep ? h.groep.visible : h.zichtbaar));
  uit.fase1 = v.fase;
  uit.bewaard = v.bewaar().brugGezet;
  // alle drie gezet, het gesprek erna weg (een oude opslag): door naar de C4
  window.__laad({ missie: 'brug', fase: 'versperren', brugGezet: { hekken: [true, true, true], c4: [false, false, false, false] } });
  uit.fase2 = v.fase;
  uit.opdracht2 = window.__opdracht();
  uit.punt2 = v.punt;
  // het konvooi: twee keer de film, en dan een andere missie laden
  const voor = V.cars.length;
  const konvooien = [];
  for (let k = 0; k < 2; k++) {
    window.__laad({ missie: 'brug', fase: 'klaarstaan' });
    window.__klik();
    window.__stap(160);
    konvooien.push(v.brug.konvooi.slice());
  }
  uit.konvooi = konvooien.map(k => k.length);
  uit.groei = V.cars.length - voor;
  window.__laad({ missie: 'schrift', fase: 'wacht', brugKlaar: true });
  b = v.brug;
  uit.naLaden = {
    konvooiInLijst: konvooien.flat().filter(c => V.cars.includes(c)).length,
    hekken: b.hekStukken.filter(h => (h.groep ? h.groep.visible : h.zichtbaar)).length,
    blokken: b.blokken.filter(h => (h.groep ? h.groep.visible : h.zichtbaar)).length,
    mark: b.mark.groep.visible, johan: b.johan.groep.visible,
    groei: V.cars.length - voor,
  };
  return uit;
});
ok(JSON.stringify(m12.hekken) === '[true,true,false]' && m12.fase1 === 'versperren', 'twee hekken uit de opslag staan er weer', JSON.stringify(m12.hekken));
ok(m12.bewaard && JSON.stringify(m12.bewaard.hekken) === '[true,true,false]', 'de opslag kent de hekken', JSON.stringify(m12.bewaard));
ok(m12.fase2 === 'c4leggen' && /C4/.test(m12.opdracht2), 'alle drie gezet: door naar de C4', `${m12.fase2} · ${m12.opdracht2}`);
ok(m12.punt2 && m12.punt2.fase === 'c4leggen', 'het herstelpunt is de C4', JSON.stringify(m12.punt2));
ok(m12.konvooi.every(n => n === 4), 'het konvooi rijdt elke keer met vier auto\'s', JSON.stringify(m12.konvooi));
ok(m12.groei <= 4, 'een tweede poging stapelt geen auto\'s', `${m12.groei} erbij`);
ok(m12.naLaden.konvooiInLijst === 0 && m12.naLaden.groei <= 0, 'na het laden van missie 13 zijn de auto\'s van het konvooi weg', JSON.stringify(m12.naLaden));
ok(m12.naLaden.hekken === 0 && m12.naLaden.blokken === 0 && !m12.naLaden.mark && !m12.naLaden.johan, 'en het dek is leeg', JSON.stringify(m12.naLaden));

// ------------------------------------------------------------------ 3. het zwart na missie 12
kop('na missie 12: "Een paar dagen later"');
const zw = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__laad({ missie: 'klaar', fase: 'klaar', brugKlaar: true, schriftKlaar: false });
  v.__geenVolgende();
  v.zetNaloop('brug', 0.05);
  const ov = document.getElementById('overgang');
  const dekking = () => Number(ov.style.opacity || 0);
  let bijStart = null;
  for (let i = 0; i < 300 && v.missie !== 'schrift'; i++) window.__stap(1);
  bijStart = { missie: v.missie, zwart: !!v.zwart, dekking: dekking() };
  window.__stap(20);
  const eenTelLater = { zwart: !!v.zwart, dekking: dekking() };
  window.__stap(200);
  return { bijStart, eenTelLater, eind: { zwart: !!v.zwart, dekking: dekking(), missie: v.missie } };
});
ok(zw.bijStart.missie === 'schrift' && zw.bijStart.zwart && zw.bijStart.dekking > 0.9, 'missie 13 begint in het zwart', JSON.stringify(zw.bijStart));
ok(zw.eenTelLater.zwart && zw.eenTelLater.dekking > 0.9, 'een tel later is het nog zwart (met de tekst)', JSON.stringify(zw.eenTelLater));
ok(!zw.eind.zwart && zw.eind.dekking < 0.05 && zw.eind.missie === 'schrift', 'daarna komt het beeld terug, missie 13 loopt', JSON.stringify(zw.eind));

// ------------------------------------------------------------------ 4. opruimen bij laden
kop('laden ruimt missie 14 en 15 op');
const ruim = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, V = g.vehicles;
  window.__laad({ missie: 'race', fase: 'start', schriftKlaar: true, raceKlaar: false });
  const r = v.race.race;
  const voor = { ringen: r.ringen.filter(x => x.visible).length, zone: !!V.vrijeZone };
  window.__laad({ missie: 'schrift', fase: 'wacht' });
  const na = { ringen: r.ringen.filter(x => x.visible).length, zone: !!V.vrijeZone, finish: r.finish.visible };
  window.__laad({ missie: 'schaduw', fase: 'volgen', raceKlaar: true });
  const balk = document.getElementById('schaduwbalk');
  const schVoor = { balk: !balk.hidden, mannen: !!v.schaduw.mannen };
  window.__laad({ missie: 'schrift', fase: 'wacht', raceKlaar: false });
  const schNa = { balk: !balk.hidden, rit: !!v.schaduw.rit, zone: !!V.vrijeZone };
  return { voor, na, schVoor, schNa };
});
ok(ruim.voor.ringen > 0 && ruim.voor.zone, 'een race op de grid heeft ringen en een vrij parcours', JSON.stringify(ruim.voor));
ok(ruim.na.ringen === 0 && !ruim.na.zone && !ruim.na.finish, 'na het laden van missie 13: geen ringen, het verkeer mag weer', JSON.stringify(ruim.na));
ok(!ruim.schNa.balk && !ruim.schNa.rit && !ruim.schNa.zone, 'na missie 15 geen balk en geen rit van Bouwman meer', JSON.stringify(ruim));

// ------------------------------------------------------------------ 5. missie 14
kop('missie 14: na de finish, na het verliezen, midden in de race');
const m14 = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player, V = g.vehicles;
  const uit = {};
  window.__laad({ missie: 'race', fase: 'finish', schriftKlaar: true, raceKlaar: false, geld: 1000 });
  uit.finish = { klaar: v.race.klaar, missie: v.missie, geld: v.geld };
  window.__stap(2);
  window.__laad({ missie: 'race', fase: 'keuze', raceKlaar: false, raceRondes: 1, geld: 1000 });
  uit.keuze = { fase: v.fase, opdracht: window.__opdracht() };
  uit.keuze1 = v.kiesHuis(1);
  uit.keuzeNa = v.fase;
  // midden in de race opslaan, ergens anders, en laden
  window.__laad({ missie: 'race', fase: 'start', raceKlaar: false });
  window.__klik();
  window.__stap(160);
  const auto = v.race.auto, grid = v.race.plek.speler;
  uit.raceFase = v.fase;
  auto.x += 250; auto.z += 40; auto.mesh.position.set(auto.x, auto.mesh.position.y, auto.z);
  P.inCar = auto; P.pos.set(auto.x, 0, auto.z);
  P.active = true;
  uit.reden = v.waaromNietOpslaan();
  g.opslaan();
  uit.opgeslagen = !!localStorage.getItem('tinga.spel.v1');
  g.laden();
  const nu = v.race.auto;
  uit.laden = {
    fase: v.fase, inAuto: P.inCar === nu, zelfde: nu === auto,
    gridD: Math.hypot(P.inCar.x - grid.x, P.inCar.z - grid.z),
    ferrarisBijGrid: V.cars.filter(c => c.soort === 'ferrari' && V.isZichtbaar(c) && Math.hypot(c.x - grid.x, c.z - grid.z) < 8).length,
  };
  window.__klik();
  return uit;
});
ok(m14.finish.klaar && m14.finish.missie === 'klaar' && m14.finish.geld === 3000, 'laden na de finish: gewonnen, € 2.000', JSON.stringify(m14.finish));
ok(m14.keuze.fase === 'keuze' && /1 —/.test(m14.keuze.opdracht), 'laden na het verliezen: de keuze staat er weer', JSON.stringify(m14.keuze));
ok(m14.keuze1 && m14.keuzeNa === 'revanche', 'en 1 kiest de revanche', `${m14.keuze1} · ${m14.keuzeNa}`);
ok(m14.raceFase === 'race' && m14.reden === null && m14.opgeslagen, 'midden in de race opgeslagen', `${m14.raceFase} · ${m14.reden}`);
ok(m14.laden.fase === 'start' && m14.laden.inAuto && m14.laden.gridD < 3, 'na het laden in de raceauto op de grid, niet op de plek van het opslaan', JSON.stringify(m14.laden));
ok(m14.laden.ferrarisBijGrid === 1, 'één Ferrari op je plek op de grid', JSON.stringify(m14.laden));

// ------------------------------------------------------------------ 6. racen voor geld
kop('racen voor geld: neergaan');
const geld = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, V = g.vehicles;
  window.__laad({ missie: 'klaar', fase: 'klaar', raceKlaar: true, schaduwKlaar: false, geld: 5000 });
  v.__geenVolgende();
  const gekozen = v.geldrace.kies(1);
  window.__stap(160);
  const voor = { missie: v.missie, fase: v.fase, inleg: v.geldrace.inleg, geld: v.geld };
  v.__herstartMissie();
  window.__stap(2);
  const na = { missie: v.missie, fase: v.fase, inleg: v.geldrace.inleg, geld: v.geld, zone: !!V.vrijeZone,
    ringen: v.race.race.ringen.filter(r => r.visible).length };
  window.__stap(200);
  return { gekozen, voor, na, later: { missie: v.missie, fase: v.fase, klaar: v.race.klaar, wie: window.__dicht() ? '' : (document.getElementById('dialoog').textContent || '').slice(0, 80) } };
});
ok(geld.gekozen && geld.voor.missie === 'race' && geld.voor.inleg === 500, 'een race voor € 500', JSON.stringify(geld.voor));
ok(geld.na.missie === 'klaar' && geld.na.inleg === 0 && geld.na.geld === 4500, 'neergaan: de inleg is weg, vrij spelen', JSON.stringify(geld.na));
ok(!geld.na.zone && geld.na.ringen === 0, 'het parcours is weer vrij', JSON.stringify(geld.na));
ok(geld.later.missie === 'klaar' && geld.later.fase === 'klaar' && geld.later.klaar, 'missie 14 begint niet opnieuw (geen telefoon van Ronald voor de race)', JSON.stringify(geld.later));

// ------------------------------------------------------------------ 7. mislukt
kop('een mislukte missie begint zonder sterren');
const mis = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__laad({ missie: 'schrift', fase: 'naarIJlst', brugKlaar: true, schriftKlaar: false });
  g.politie.zetSter(2);
  const voor = g.politie.ster;
  v.__mislukt('Gezien door de politie.');
  window.__stap(90);
  return { voor, na: g.politie.ster, missie: v.missie, fase: v.fase };
});
ok(mis.voor === 2 && mis.na === 0 && mis.missie === 'schrift', 'na MISLUKT geen sterren meer, missie 13 opnieuw', JSON.stringify(mis));

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);
