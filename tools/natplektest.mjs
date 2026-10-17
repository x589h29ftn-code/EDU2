/*
 Proef bij stap 209 (npm run natplektest). Gevraagd (17 okt 2026), na de heli van missie 18 die in het water landde: "Check een paar
 andere missies, zoals met de boot enzovoort."

 Elke missie die je kunt laden heeft in js/verhaal.js een `hervat…` die je na het laden ergens neerzet (de kade, de sloep, een
 straat, een binnenruimte). Deze proef haalt uit js/verhaal.js zelf welke fasen elke `hervat…` kent, laadt het verhaal in elke fase,
 en meet twee keer (meteen, en acht tellen later, als een zwart beeld voorbij is):

   - Erik: te voet of in een auto nooit in het water (in een boot mag het, daar hoort hij);
   - Mark en Johan (de figuren van het verhaal, en de Johan van missie 16–18), als ze te zien zijn en niet in een boot staan:
     nooit in het water.

 En de vaste plekken aan het water: de ligplaatsen van de boten (uitstappen moet op het droge kunnen, `walVrij` in js/boot.js).

 Gebruik: npm run server &  node tools/natplektest.mjs [poort]
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fout = 0;
const ok = (goed, wat, extra = '') => { console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`); if (!goed) fout++; };
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.setDefaultTimeout(1800000);
const fouten = [];
page.on('pageerror', e => { fouten.push(e.message); });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

const r = await page.evaluate(async () => {
  const W = await import('/js/world.js');
  for (const k of Object.keys(localStorage)) if (k.startsWith('tinga.spel')) localStorage.removeItem(k);
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, v = g.verhaal, P = g.player;
  P.active = false; window.__autoplay = false;
  g.politie.proefStil = true;
  // de fasen per missie, uit de bron: alles waar een hervat… op vergelijkt
  const bron = await (await fetch('/js/verhaal.js')).text();
  const NAAM = { BX: 'bx', Bom: 'bom', Sniper: 'sniper', Huis: 'huis', Veteraan: 'veteraan', Politieauto: 'politieauto', Brug: 'brug',
    Schrift: 'schrift', Race: 'race', Schaduw: 'schaduw', Inval: 'inval', Ronald: 'ronald', Uitzending: 'uitzending' };
  const plan = [];
  for (const [naam, missie] of Object.entries(NAAM)) {
    const i = bron.indexOf(`function hervat${naam}(f)`);
    if (i < 0) continue;
    const eind = bron.indexOf('\n  function ', i + 10);
    const lijf = bron.slice(i, eind > 0 ? eind : i + 8000);
    const fasen = new Set();
    for (const m of lijf.matchAll(/f === '([A-Za-z_0-9]+)'/g)) fasen.add(m[1]);
    for (const m of lijf.matchAll(/\[((?:\s*'[A-Za-z_0-9]+',?)+)\]\.includes\(f\)/g)) for (const w of m[1].matchAll(/'([A-Za-z_0-9]+)'/g)) fasen.add(w[1]);
    for (const f of fasen) plan.push({ missie, fase: f });
  }
  // en de eerste missies zonder eigen hervat, en vrij spelen
  for (const [missie, fase] of [['molenkrite', 'wacht'], ['rijden', 'telefoon'], ['bewaking', 'telefoon'], ['afleveren', 'telefoon'], ['johan', 'telefoon'], ['klaar', 'klaar']])
    plan.push({ missie, fase });
  const nat = (x, z) => W.pointInWater(x, z);
  const B = g.boten;
  const inBoot = () => !!(B && B.inBoot);
  const meet = () => {
    const uit = [];
    const sp = P.inCar ? { x: P.inCar.x, z: P.inCar.z, wie: 'Erik (in een auto)' } : { x: P.pos.x, z: P.pos.z, wie: 'Erik' };
    if (!inBoot() && nat(sp.x, sp.z)) uit.push(`${sp.wie} (${sp.x.toFixed(1)}, ${sp.z.toFixed(1)})`);
    const figuren = [['Mark', v.mark], ['Johan', v.johan], ['Johan (16–18)', v.avond && v.avond.johan]];
    for (const [wie, p] of figuren) {
      if (!p || !p.groep || !p.groep.visible) continue;
      if (p.groep.parent && p.groep.parent !== g.scene) continue;         // in een boot (een kind van de boot)
      const q = p.groep.position;
      if (nat(q.x, q.z)) uit.push(`${wie} (${q.x.toFixed(1)}, ${q.z.toFixed(1)})`);
    }
    return uit;
  };
  const resultaten = [];
  const basis = v.bewaar();
  // het droge beginpunt: hier zet de proef Erik vóór elke fase neer. In het echte spel zet de opslag hem op zijn bewaarde plek
  // (js/opslag.js); een hervat… die hem niet verplaatst, liet hem anders staan waar de vorige fase eindigde (in een sloep op het water)
  const start = { x: P.pos.x, z: P.pos.z };
  for (const { missie, fase } of plan) {
    let nu = [], later = [], fout = null;
    try {
      if (B && B.inBoot) B.herstel(null);
      P.inCar = null; P.zit = false;
      P.pos.set(start.x, W.grondHoogte(start.x, start.z), start.z);
      const s = { ...basis, missie, fase, volgende: null, noMercyKlaar: true, noMercyGebeld: true, roanKlaar: true, yugoGevraagd: true,
        // missies na missie 9 verwachten een eigen huis, na 12 de brug
        huisGekocht: basis.huisGekocht };
      g.politie.reset();
      v.herstel(s);
      for (let i = 0; i < 4; i++) { P.health = 100; v.update(0.05); }
      nu = meet();
      for (let i = 0; i < 160; i++) { P.health = 100; v.update(0.05); }
      later = meet();
    } catch (e) { fout = String(e && e.message || e).slice(0, 120); }
    resultaten.push({ missie, fase, nu, later, fout, boot: inBoot() });
  }
  // de ligplaatsen: aan wal stappen moet op het droge kunnen
  const ligplaatsen = [];
  const { LIGPLAATSEN } = await import('/js/boot.js');
  for (const L of LIGPLAATSEN || []) ligplaatsen.push({ naam: L.naam || '', wal: L.wal, nat: L.wal ? nat(L.wal.x, L.wal.z) : null });
  return { resultaten, ligplaatsen, n: plan.length };
});

kop(`elke fase die je kunt laden (${r.n})`);
for (const x of r.resultaten) {
  const nat = [...new Set([...x.nu, ...x.later])];
  if (x.fout) { console.log(`  ..   ${x.missie}/${x.fase}: niet te laden in deze proef (${x.fout})`); continue; }
  ok(nat.length === 0, `${x.missie}/${x.fase}: niemand in het water${x.boot ? ' (Erik in een boot)' : ''}`, nat.join(', '));
}
kop('de ligplaatsen');
if (!r.ligplaatsen.length) console.log('  ..   (de ligplaatsen zijn niet uit te lezen; uitstappen staat in js/boot.js met walVrij)');
for (const L of r.ligplaatsen) ok(L.nat === false, `ligplaats ${L.naam}: de wal op het droge`, L.wal ? `(${L.wal.x}, ${L.wal.z})` : '');
if (fouten.length) { console.log('\n[pageerror]', [...new Set(fouten)].slice(0, 5).join(' | ')); }

await browser.close();
console.log(fout ? `\n${fout} fout(en)` : '\nalles goed');
process.exit(fout ? 1 : 0);
