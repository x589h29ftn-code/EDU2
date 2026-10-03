/*
 Stap 114: racen voor geld, na missie 14.

   node tools/server.mjs 8123 &   node tools/geldracetest.mjs [poort]   (npm run geldracetest)

 1. Na missie 14 belt Ronald over het racen voor geld, en dat is vóór het telefoontje van missie 15.
 2. Bij de balie van het Autohuis: een hint, E, Sjoerd en de keuze; vóór missie 14 niet.
 3. Te weinig geld voor de inleg: niets betaald, de keuze blijft open.
 4. Inleggen en racen: betaald, "Die nacht…", op de grid zonder Bouwman, met Ronald; de tussenpoos
    naar de volgende missie staat stil; door alle ringen als eerste: het dubbele terug, daarna weer
    vrij spelen.
 5. Verliezen (uitgestapt): de inleg is weg, en ook dan weer vrij spelen.
 6. Opslaan tijdens een geldrace bewaart vrij spelen; laden zet de race uit.
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
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, v = g.verhaal;
  g.player.active = false;
  window.__autoplay = false;
  window.__meld = [];
  const echt = g.hud.melding.bind(g.hud);
  g.hud.melding = (k, o, t) => { window.__meld.push(`${k}|${o}`); return echt(k, o, t); };
  window.__toon = [];
  const show = g.hud.show.bind(g.hud);
  g.hud.show = (t, d) => { window.__toon.push(t); return show(t, d); };
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) { g.player.health = 100; v.update(dt); } };
  window.__klik = (max = 80) => { for (let i = 0; i < max && !document.getElementById('dialoog').hidden; i++) { v.toets(); window.__stap(1); } };
  window.__tot = (fase, maxS = 20) => { for (let t = 0; t < maxS && v.fase !== fase; t += 0.05) { window.__stap(1); if (!document.getElementById('dialoog').hidden) v.toets(); } return v.fase === fase; };
  window.__zet = (x, z) => { const P = g.player; if (P.inCar) { P.inCar.speed = 0; P.inCar = null; } P.pos.set(x, 0, z); P.applyCamera(); };
  window.__E = () => { const was = g.player.active; g.player.active = true; v.toets(); g.player.active = was; };
  window.__vrij = (extra = {}) => {
    const s = v.bewaar(); s.missie = 'klaar'; s.fase = 'klaar'; s.volgende = null;
    Object.assign(s, { huis: 'Koningsspil 20', veteraanKlaar: true, politieautoKlaar: true, brugKlaar: true, schriftKlaar: true, raceKlaar: true, geld: 5000 }, extra);
    g.politie.reset();
    v.herstel(s);
    window.__stap(2);
  };
  window.__balie = () => { const b = g.garage.plekken.balie; window.__zet(b.x + 1.2, b.z); window.__stap(2); return b; };
});

// ------------------------------------------------------------------ 1. de tip na missie 14
kop('na missie 14');
const tip = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__vrij({ schaduwKlaar: false });
  // de ochtend na de race (zoals naDeRace dat doet): eerst Ronald, dan een tussenpoos tot Mark (missie 15)
  v.geldrace.ochtendNaRace();
  window.__stap(2);
  const volgende = v.volgendeMissie;
  let t = 0, tel = false, naam = '';
  for (; t < 30; t += 0.05) {
    window.__stap(1);
    if (!document.getElementById('dialoog').hidden) { tel = true; naam = document.getElementById('dialoogNaam').textContent; break; }
  }
  const tekst = [];
  for (let i = 0; i < 20 && !document.getElementById('dialoog').hidden; i++) { tekst.push(document.getElementById('dialoogTekst').textContent); v.toets(); window.__stap(1); }
  window.__stap(2);
  const nogNiet = v.volgendeMissie;
  return { volgende, tel, naam, t, tekst, nogNiet, melding: window.__meld.filter(m => /RACEN VOOR GELD/.test(m)).length };
});
ok(tip.volgende && tip.volgende.naam === 'schaduw', 'na de ochtend staat missie 15 klaar', JSON.stringify(tip.volgende));
ok(tip.tel && tip.naam === 'Ronald' && tip.t < 15, 'eerst belt Ronald', `${tip.naam} na ${tip.t.toFixed(1)} s`);
ok(tip.tekst.some(t => /balie|Sjoerd/.test(t)) && tip.tekst.some(t => /dubbel/.test(t)) && tip.melding === 1, 'over racen voor geld bij de balie, en het dubbele terug');
ok(tip.nogNiet && tip.nogNiet.naam === 'schaduw' && tip.nogNiet.over > 100, 'en dat is ruim vóór het telefoontje van missie 15', `nog ${tip.nogNiet && tip.nogNiet.over.toFixed(0)} s`);

// ------------------------------------------------------------------ 2. de balie
kop('de balie');
const balie = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  // vóór missie 14: niets
  window.__vrij({ raceKlaar: false });
  window.__balie();
  window.__E(); window.__stap(2);
  const voor = !document.getElementById('dialoog').hidden;
  window.__klik();
  // na missie 14: de hint, en E
  window.__vrij();
  window.__toon.length = 0;
  window.__balie();
  window.__stap(60);
  const hint = window.__toon.some(t => /racen voor geld/.test(t));
  window.__E(); window.__stap(2);
  const naam = document.getElementById('dialoogNaam').textContent;
  const open = !document.getElementById('dialoog').hidden;
  const tekst = [];
  for (let i = 0; i < 20 && !document.getElementById('dialoog').hidden; i++) { tekst.push(document.getElementById('dialoogTekst').textContent); v.toets(); window.__stap(1); }
  return { voor, hint, naam, open, tekst, kiezen: v.geldrace.kiezen };
});
ok(!balie.voor, 'vóór missie 14 biedt Sjoerd niets aan');
ok(balie.hint, 'bij de balie: "E — bij Sjoerd: racen voor geld"');
ok(balie.open && balie.naam === 'Sjoerd' && balie.tekst.some(t => /1 —.*2 —.*3 —/.test(t)) && balie.kiezen, 'E: Sjoerd, de drie inleggen, en kiezen', balie.tekst.slice(-1)[0]);

// ------------------------------------------------------------------ 3. te weinig geld
kop('te weinig geld');
const arm = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__vrij({ geld: 300 });
  window.__balie();
  window.__E(); window.__klik();
  const voor = v.bewaar().geld;
  g.verhaal.kiesHuis(3);
  window.__stap(2);
  const zin = document.getElementById('dialoogTekst').textContent;
  window.__klik();
  return { voor, na: v.bewaar().geld, zin, kiezen: v.geldrace.kiezen, missie: v.missie };
});
ok(arm.na === arm.voor && /niet genoeg/.test(arm.zin) && arm.kiezen && arm.missie === 'klaar', 'te weinig voor de inleg: niets betaald, de keuze blijft open', arm.zin);

// ------------------------------------------------------------------ 4. inleggen en winnen
kop('inleggen en winnen');
const win = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__vrij({ geld: 5000, schaduwKlaar: false });
  // een missie die over een poos belt: die moet stil blijven staan tijdens de race
  v.geldrace.ochtendNaRace(); window.__stap(400); window.__klik();
  const wachtVoor = v.volgendeMissie ? v.volgendeMissie.over : null;
  window.__balie();
  window.__E(); window.__klik();
  const geld0 = v.bewaar().geld;
  v.kiesHuis(2);
  window.__stap(2);
  const betaald = geld0 - v.bewaar().geld;
  const nacht = v.fase;
  const start = window.__tot('start', 15);
  const bouwmanWeg = !v.race.bouwman.groep.visible, ronaldEr = v.race.ronald.groep.visible;
  const naam = document.getElementById('dialoogNaam').textContent;
  window.__tot('race', 20);
  const fase = v.fase;
  // over de lijn van de race schuiven, door alle ringen, veel sneller dan de anderen
  const R = v.race.race, L = R.lijn, car = g.player.inCar;
  let s = 0;
  for (let i = 0; i < 4000 && v.fase === 'race'; i++) {
    s = Math.min(L.lengte, s + 2.5);
    // (via punt: de monsters van de lijn liggen niet precies om de twee meter, en met
    //  s / 2 als index kwam de auto nooit bij de finish)
    const p = R.punt(s);
    car.x = p.x; car.z = p.z; car.yaw = p.yaw; car.speed = 40;
    if (car.mesh) car.mesh.position.set(car.x, car.mesh.position.y, car.z);
    g.player.pos.set(car.x, 0, car.z);
    window.__stap(1);
  }
  const na = v.fase;
  const winst = v.bewaar().geld - (geld0 - betaald);
  const wachtTijdens = v.volgendeMissie ? v.volgendeMissie.over : null;
  window.__stap(200);
  return { betaald, nacht, start, bouwmanWeg, ronaldEr, naam, fase, na, winst, missieNa: v.missie, faseNa: v.fase, wachtVoor, wachtTijdens,
    melding: window.__meld.filter(m => /GEWONNEN/.test(m)).slice(-1)[0], inleg: v.geldrace.inleg, laatste: window.__meld.slice(-3), stand: v.race.race.stand && v.race.race.stand() };
});
ok(win.betaald === 1000 && win.nacht === 'nacht', 'keuze 2: € 1.000 betaald, "Die nacht…"', `${win.betaald}`);
ok(win.start && win.bouwmanWeg && win.ronaldEr && win.naam === 'Ronald', 'op de grid: Ronald, en geen Bouwman', win.naam);
ok(win.fase === 'race', 'aftellen en start');
ok(win.na === 'geldKlaar' && win.winst === 2000 && /GEWONNEN/.test(win.melding || ''), 'als eerste in IJlst: het dubbele terug', `${win.winst} · ${win.laatste.join(' / ')} · ${JSON.stringify(win.stand)}`);
ok(win.wachtVoor !== null && Math.abs(win.wachtTijdens - win.wachtVoor) < 1, 'de volgende missie wacht zolang je racet', `${win.wachtVoor && win.wachtVoor.toFixed(0)} → ${win.wachtTijdens && win.wachtTijdens.toFixed(0)} s`);
ok(win.missieNa === 'klaar' && win.faseNa === 'klaar' && win.inleg === 0, 'daarna weer vrij spelen');

// ------------------------------------------------------------------ 5. verliezen
kop('verliezen');
const verlies = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__vrij({ geld: 5000 });
  window.__balie();
  window.__E(); window.__klik();
  v.kiesHuis(1);
  window.__tot('race', 40);
  const geld0 = v.bewaar().geld;
  // uitstappen en blijven staan
  const car = g.player.inCar; g.player.inCar = null;
  for (let t = 0; t < 30 && v.fase === 'race'; t += 0.05) window.__stap(1);
  const fase = v.fase;
  const melding = window.__meld.filter(m => /VERLOREN/.test(m)).slice(-1)[0];
  window.__stap(200);
  return { fase, melding, geldNa: v.bewaar().geld, geld0, missie: v.missie, inleg: v.geldrace.inleg };
});
ok(verlies.fase === 'geldKlaar' && /inleg van € 500 is weg/.test(verlies.melding || '') && !/Bouwman/.test(verlies.melding), 'uitgestapt: verloren, de inleg is weg (en geen Bouwman in de melding)', verlies.melding);
ok(verlies.geldNa === verlies.geld0 && verlies.missie === 'klaar' && verlies.inleg === 0, 'geen geld terug, en weer vrij spelen');

// ------------------------------------------------------------------ 6. opslaan tijdens een geldrace
kop('opslaan en laden');
const op = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__vrij({ geld: 5000 });
  window.__balie();
  window.__E(); window.__klik();
  v.kiesHuis(1);
  window.__tot('race', 40);
  const s = v.bewaar();
  v.herstel(s);
  window.__stap(5);
  return { bewaard: `${s.missie}/${s.fase}`, missie: v.missie, inleg: v.geldrace.inleg };
});
ok(op.bewaard === 'klaar/klaar' && op.missie === 'klaar' && op.inleg === 0, 'opslaan tijdens een geldrace bewaart vrij spelen, en laden zet hem uit', op.bewaard);

console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
await browser.close();
process.exit(fouten ? 1 : 0);
