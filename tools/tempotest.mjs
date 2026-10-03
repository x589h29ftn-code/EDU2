/*
 Het tempo tussen de missies (stap 108). Gevraagd op 3 okt 2026: "check of de missies elkaar niet te
 snel opvolgen; is er genoeg ruimte voor de andere klusjes tussendoor, of is het missie na missie?"

   node tools/server.mjs 8123 &   node tools/tempotest.mjs [poort]   (npm run tempotest)

 1. Zonder browser: elke pauze na een missie die met de telefoon begint is de TUSSENPOOS; de korte die
    overblijven zetten alleen een M neer die op je wacht (of horen bij de eerste vijf, de inleiding).
 2. Na een missie: de tussenpoos, het eerste klusaanbod na een paar tellen, en dat het blijft staan als
    de telefoon gaat (een klus op 850 m is met de auto krap binnen de tussenpoos).
 3. Een klus aangenomen: de tussenpoos staat stil tot hij klaar is.
 4. Per missie, na het telefoontje: wacht hij op je (en komt er weer een klus), of begint hij meteen?
*/
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fouten++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);

// ------------------------------------------------------------------ 1. de pauzes in de code
kop('de pauzes in js/verhaal.js');
{
  const bron = readFileSync(new URL('../js/verhaal.js', import.meta.url), 'utf8');
  const poos = +(/const TUSSENPOOS = (\d+)/.exec(bron) || [])[1];
  const waardes = {};
  for (const m of bron.matchAll(/^const ([A-Z]+_WACHT) = ([^;]+);/gm)) waardes[m[1]] = m[2].trim();
  // de missies die met een telefoontje beginnen
  const bellen = ['SNIP_WACHT', 'HUIS_WACHT', 'VET_WACHT', 'RACE_WACHT', 'SCHADUW_WACHT', 'INVAL_WACHT', 'RONALD_WACHT', 'UITZENDING_WACHT'];
  const fout = bellen.filter(n => waardes[n] !== 'TUSSENPOOS');
  ok(poos >= 120, 'de tussenpoos is ruim twee minuten', `${poos} s`);
  ok(fout.length === 0, 'elke missie die met de telefoon begint, wacht de tussenpoos', fout.length ? fout.map(n => `${n} = ${waardes[n]}`).join(', ') : bellen.length + ' pauzes');
  // de korte die overblijven: na missie 11 (BRUG_WACHT, Mark gaat naar binnen), na 10 (POL_WACHT, een M),
  // de M voor de bom (8 s), en Johan na de inleiding (5 s)
  const kort = [...bron.matchAll(/naMissieT = (\d+);/g)].map(m => +m[1]).filter(n => n !== 0 && n !== 6);
  ok(kort.every(n => n <= 8), 'wat er korter is, zet alleen een M neer of hoort bij de inleiding', `${kort.join(', ')} s; BRUG_WACHT ${waardes.BRUG_WACHT}, POL_WACHT ${waardes.POL_WACHT}`);
}

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
  g.sfeer.uur = 12;
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) { g.player.health = 100; v.update(dt); } };
  window.__klik = (max = 80) => { for (let i = 0; i < max && !document.getElementById('dialoog').hidden; i++) { v.toets(); window.__stap(1); } };
  window.__zet = (x, z) => { if (g.player.inCar) { g.player.inCar.speed = 0; g.player.inCar = null; } g.player.pos.set(x, 0, z); g.player.applyCamera(); };
  // missie 13 afronden zoals in tools/racetest.mjs: terug bij Mark met het schrift; daarna loopt de tussenpoos
  window.__naSchrift = () => {
    window.__klaarTot({ schriftKlaar: false });
    v.startMissie('schrift');
    window.__stap(2);
    const s = v.bewaar(); s.missie = 'schrift'; s.fase = 'terug';
    v.herstel(s);
    window.__stap(2);
    const d = v.schrift.deur;
    window.__zet(d.x + 3, d.z + 1);
    window.__stap(3);
    window.__klik();
    window.__stap(2);
  };
  // alle missies tot en met 13 achter de rug, en het geld om alles te kunnen
  window.__klaarTot = (extra = {}) => {
    const s = v.bewaar(); s.missie = 'klaar'; s.fase = 'klaar'; s.volgende = null;
    Object.assign(s, { huis: 'Koningsspil 20', veteraanKlaar: true, politieautoKlaar: true, brugKlaar: true, schriftKlaar: true,
      raceKlaar: false, geld: 20000 }, extra);
    g.politie.reset();
    v.herstel(s);
  };
});

// ------------------------------------------------------------------ 2. na een missie
kop('na een missie');
const na = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__naSchrift();
  const begin = v.volgendeMissie;
  // de tellen tot het eerste klusaanbod
  let t = 0;
  while (t < 40 && !v.klusjes.aanbod) { window.__stap(1, 0.1); t += 0.1; }
  const a = v.klusjes.aanbod, sp = g.player.pos;
  const over = v.volgendeMissie;
  return { missie: v.missie, begin, aanbodNa: t, d: a ? Math.hypot(a.x - sp.x, a.z - sp.z) : null, over, poos: v.tussenpoos,
    wie: a ? a.wie : null };
});
ok(na.missie === 'klaar' && na.begin && na.begin.naam === 'race' && Math.abs(na.begin.over - na.poos) < 1, 'na het schrift: de volgende missie over de hele tussenpoos', JSON.stringify(na.begin));
ok(na.aanbodNa < 15 && na.d !== null, 'na een paar tellen staat er een klus klaar', `${na.aanbodNa.toFixed(1)} s, ${na.wie} op ${na.d ? na.d.toFixed(0) : '-'} m`);
// rijdend door de wijk haal je gemiddeld zo'n 8 m/s, met de omwegen van de straten erbij (ter informatie:
// een klus aan de verre kant van 220–850 m is krap, daarom blijft hij staan als de telefoon gaat)
const rijtijd = na.d ? na.d * 1.4 / 8 : 999;
console.log(`        (rijden ernaartoe ~${rijtijd.toFixed(0)} s, tot de telefoon ${na.over ? na.over.over.toFixed(0) : '-'} s)`);
const doorBel = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  const voor = v.klusjes.aanbod;
  // de rest van de tussenpoos wachten: de telefoon gaat, en het gesprek doorklikken
  let t = 0;
  while (t < 200 && v.missie === 'klaar') { window.__stap(1, 0.1); t += 0.1; }
  const tijdensBellen = v.klusjes.aanbod;
  window.__klik();
  window.__stap(4);
  const na = v.klusjes.aanbod;
  const zelfde = (a, b) => !!a && !!b && Math.hypot(a.x - b.x, a.z - b.z) < 0.5;
  return { missie: v.missie, fase: v.fase, tijdens: zelfde(voor, tijdensBellen), na: zelfde(voor, na), t };
});
ok(doorBel.missie === 'race' && doorBel.tijdens && doorBel.na, 'gaat de telefoon terwijl je onderweg bent, dan blijft je klus gewoon staan', `${doorBel.fase} na ${doorBel.t.toFixed(0)} s`);

// ------------------------------------------------------------------ 3. tijdens een klus
kop('tijdens een klus');
const klus = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, kl = v.klusjes;
  window.__naSchrift();
  for (let t = 0; t < 40 && !kl.aanbod; t += 0.1) window.__stap(1, 0.1);
  const a = kl.aanbod;
  if (!a) return { geen: true };
  window.__zet(a.x + 1.2, a.z + 0.6);
  window.__stap(2);
  g.player.active = true;
  v.toets();
  g.player.active = false;
  window.__klik();
  const bezig = kl.bezig;
  const voor = v.volgendeMissie;
  window.__stap(Math.round(90 / 0.05));
  const na = v.volgendeMissie;
  kl.reset && kl.reset();
  return { bezig, voor: voor ? voor.over : null, na: na ? na.over : null, missie: v.missie };
});
ok(!klus.geen && klus.bezig, 'de klus is aangenomen');
ok(klus.voor !== null && klus.na !== null && Math.abs(klus.voor - klus.na) < 0.5 && klus.missie === 'klaar',
  'anderhalve minuut bezig: de tussenpoos staat stil, geen telefoon', `${klus.voor ? klus.voor.toFixed(1) : '-'} s → ${klus.na ? klus.na.toFixed(1) : '-'} s`);

// ------------------------------------------------------------------ 4. per missie
kop('na het telefoontje: wacht de missie op je?');
const per = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  const namen = ['bx', 'bom', 'sniper', 'huis', 'veteraan', 'politieauto', 'brug', 'schrift', 'race', 'schaduw', 'inval', 'ronald', 'uitzending'];
  const uit = [];
  for (const naam of namen) {
    window.__klaarTot({ huis: naam === 'huis' ? null : 'Koningsspil 20', raceKlaar: ['schaduw', 'inval', 'ronald', 'uitzending'].includes(naam),
      schaduwKlaar: ['inval', 'ronald', 'uitzending'].includes(naam), invalKlaar: ['ronald', 'uitzending'].includes(naam),
      ronaldKlaar: naam === 'uitzending', brugKlaar: naam !== 'politieauto' && naam !== 'brug' });
    v.klusjes.reset && v.klusjes.reset();
    v.startMissie(naam);
    // het telefoontje (of de M) afwachten en doorklikken
    for (let i = 0; i < 80; i++) { window.__stap(1); if (!document.getElementById('dialoog').hidden) window.__klik(); }
    const fase = v.fase, vrij = v.klusVrij;
    // en dan: komt er een klus terwijl de missie wacht?
    let t = 0;
    while (t < 20 && !v.klusjes.aanbod) { window.__stap(1, 0.1); t += 0.1; }
    uit.push({ naam, fase, vrij, aanbod: !!v.klusjes.aanbod, na: +t.toFixed(1) });
  }
  return uit;
});
const urgent = ['inval'];          // De inval: Johan belt en de drie minuten lopen meteen (zo hoort het verhaal)
for (const m of per) {
  if (urgent.includes(m.naam)) {
    ok(!m.vrij, `${m.naam}: begint meteen (de inval is haast, zo bedoeld), en komt pas na de tussenpoos`, m.fase);
    continue;
  }
  ok(m.vrij && m.aanbod, `${m.naam}: wacht onder zijn letter, en er komt een klus`, `${m.fase}${m.aanbod ? `, aanbod na ${m.na} s` : ', geen aanbod'}`);
}

console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
await browser.close();
process.exit(fouten ? 1 : 0);
