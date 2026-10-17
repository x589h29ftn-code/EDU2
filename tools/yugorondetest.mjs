/*
 Proef bij stap 212 (npm run yugorondetest). Gemeld (17 okt 2026): "Leg bij Yugo de eerste keer kort uit hoe het werkt. Ik klikte
 door en daardoor kon ik niks meer bestellen. Zorg ook dat je een nieuwe ronde sneller kan starten."

 Wat er gebeurde: aan tafel bestelde E meteen (`kies(6)`), ook als Johan nog praatte en ook als je niets had gekozen. Wie Johan met
 E doorklikte, bestelde zo een lege ronde, en de tablet was dicht.

  1. De eerste keer: Johan legt het uit, er komt een melding "YUGO · ZO WERKT HET", en op de tablet staat een uitleg (ronde 1).
  2. E terwijl Johan praat (tablet open): de regel gaat verder, er wordt niets besteld, de tablet blijft open.
  3. 6 of E met niets gekozen: niet besteld, met een hint. Met een keuze (1) bestelt E wel.
  4. Je bord leeg (Johan eet nog): E begint meteen de volgende ronde. In de pauze ook. Na de laatste ronde rondt E af.
  5. De uitleg op de tablet is weg in ronde 2, en de tweede keer bij Yugo legt Johan niets meer uit.

 Gebruik: npm run server &  node tools/yugorondetest.mjs [poort]
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => { console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`); if (!goed) fouten++; };
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
page.setDefaultTimeout(900000);
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  for (const k of Object.keys(localStorage)) if (k.startsWith('tinga.spel')) localStorage.removeItem(k);
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, P = g.player, v = g.verhaal;
  P.active = true; window.__autoplay = true;
  g.politie.proefStil = true;
  window.__M = await import('/js/yugo.js');
  window.__stap = (n = 1, dt = 0.05) => { for (let i = 0; i < n; i++) { P.health = 100; v.update(dt); } };
  window.__E = () => v.toets();
  window.__dicht = () => document.getElementById('dialoog').hidden;
  window.__tekst = () => document.getElementById('dialoogTekst').textContent;
  window.__meldingen = [];
  const m = g.hud.melding.bind(g.hud); g.hud.melding = (a, b, c) => { window.__meldingen.push(`${a} ${b || ''}`); return m(a, b, c); };
  window.__hints = [];
  const h = g.hud.show.bind(g.hud); g.hud.show = (t, d) => { window.__hints.push(t); return h(t, d); };
  window.__tot = (f, max = 800) => { for (let i = 0; i < max; i++) { if (f()) return i; window.__stap(1); } return -1; };
  const s = v.bewaar(); Object.assign(s, { missie: 'klaar', fase: 'klaar', volgende: null, uitzendingKlaar: true, invalKlaar: true, ronaldKlaar: true, roanKlaar: true, noMercyKlaar: true, noMercyGebeld: true, yugoKeer: 0 });
  v.herstel(s); window.__stap(2);
});

kop('1. de eerste keer');
const een = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, y = g.yugo;
  v.startYugoLos();
  window.__tot(() => v.yugo.fase === 'tafel' && y.stand.actief);
  window.__stap(2);
  const regels = [];
  const lees = () => { if (!window.__dicht()) { const t = window.__tekst(); if (!regels.includes(t)) regels.push(t); } };
  lees();
  const eerst = document.querySelector('#yugoTablet .eerst');
  return { keer: v.yugo.keer, regels, eersteRegel: regels[0] || '', melding: window.__meldingen.find(m => /ZO WERKT HET/.test(m)) || '',
    uitlegZicht: !!eerst && getComputedStyle(eerst).display !== 'none' && getComputedStyle(document.getElementById('yugoTablet')).display !== 'none',
    uitleg: eerst ? eerst.textContent : '', fase: y.stand.fase };
});
ok(een.keer === 1 && een.fase === 'bestellen', 'aan tafel, de tablet open', JSON.stringify({ keer: een.keer, fase: een.fase }));
ok(/ZO WERKT HET/.test(een.melding) && /1–4/.test(een.melding) && /E eten/.test(een.melding), 'een melding met de uitleg', een.melding);
ok(een.uitlegZicht && /1–4/.test(een.uitleg) && /6/.test(een.uitleg), 'op de tablet staat de uitleg', een.uitleg);

kop('2. E terwijl Johan praat');
const twee = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, y = g.yugo;
  const regels = [];
  let e = 0;
  for (let i = 0; i < 12 && !window.__dicht(); i++) {
    const t = window.__tekst(); if (!regels.includes(t)) regels.push(t);
    window.__E(); e++; window.__stap(1);
  }
  return { e, regels, fase: y.stand.fase, dicht: window.__dicht(), besteld: y.stand.jijBesteld };
});
ok(twee.e >= 2 && twee.dicht, 'E klikt Johan door', `${twee.e} keer E`);
ok(twee.regels.some(r => /1 tot 4/.test(r)) && twee.regels.some(r => /6 bestel/.test(r)), 'Johan legde het uit', twee.regels.join(' | '));
ok(twee.fase === 'bestellen', 'en er is niets besteld: de tablet staat nog open', twee.fase);

kop('3. bestellen zonder iets te kiezen');
const drie = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, y = g.yugo;
  window.__hints.length = 0;
  v.kiesHuis(6); window.__stap(1);
  const na6 = y.stand.fase;
  window.__E(); window.__stap(1);
  const naE = y.stand.fase, hint = window.__hints.find(h => /Kies eerst/.test(h)) || '';
  v.kiesHuis(1); v.kiesHuis(1); window.__stap(1);
  const keuze = { ...y.stand.keuze };
  // wacht tot Johan niets meer zegt, dan E
  window.__tot(() => window.__dicht(), 400);
  window.__E(); window.__stap(1);
  return { na6, naE, hint, keuze, na: y.stand.fase, jij: y.stand.jijBesteld };
});
ok(drie.na6 === 'bestellen' && drie.naE === 'bestellen' && !!drie.hint, '6 en E met niets gekozen: niet besteld, wel een hint', drie.hint);
ok(drie.na === 'besteld' && drie.jij === 2, 'met twee plankjes gekozen bestelt E wel', JSON.stringify(drie));

kop('4. sneller naar de volgende ronde');
const vier = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, y = g.yugo, M = window.__M;
  const was = JSON.parse(JSON.stringify(M.YUGO));
  Object.assign(M.YUGO, { oberNa: [1, 1.5], oberLoop: 6, praat: [999, 1000], johanHap: [30, 40] });
  window.__tot(() => y.stand.fase === 'eten', 1200);
  // alles van jou opeten met E
  let n = 0;
  while (y.stand.over.jij > 0 && n++ < 400) { if (y.stand.stok === 'rust') window.__E(); window.__stap(1); }
  window.__stap(2);
  const voor = { fase: y.stand.fase, ronde: y.stand.ronde, johan: y.stand.over.johan };
  window.__hints.length = 0; window.__stap(30);
  const hint = window.__hints.find(h => /volgende ronde/.test(h)) || '';
  window.__E(); window.__stap(1);
  const na = { fase: y.stand.fase, ronde: y.stand.ronde, johan: y.stand.over.johan };
  // in de pauze: kies, bestel, eet op, laat Johan ook opeten, en dan E in de pauze
  v.kiesHuis(5); window.__tot(() => window.__dicht(), 400); window.__E(); window.__stap(1);
  Object.assign(M.YUGO, { johanHap: [0.05, 0.1] });
  window.__tot(() => y.stand.fase === 'pauze', 3000);
  const pauze = { fase: y.stand.fase, ronde: y.stand.ronde };
  window.__E(); window.__stap(1);
  const naPauze = { fase: y.stand.fase, ronde: y.stand.ronde };
  // de laatste ronde: naar ronde 5 en dan afronden
  let r = 0;
  while (y.stand.ronde < M.YUGO.rondes && r++ < 20) {
    if (y.stand.fase === 'bestellen') { v.kiesHuis(1); window.__tot(() => window.__dicht(), 400); window.__E(); }
    window.__tot(() => y.stand.fase === 'pauze' || (y.stand.fase === 'eten' && y.stand.over.jij === 0), 3000);
    while (y.stand.over.jij > 0) { if (y.stand.stok === 'rust') window.__E(); window.__stap(1); }
    window.__stap(2); window.__E(); window.__stap(1);
  }
  if (y.stand.fase === 'bestellen') { v.kiesHuis(1); window.__tot(() => window.__dicht(), 400); window.__E(); }
  window.__tot(() => y.stand.fase === 'pauze' || (y.stand.fase === 'eten' && y.stand.over.jij === 0), 3000);
  while (y.stand.over.jij > 0) { if (y.stand.stok === 'rust') window.__E(); window.__stap(1); }
  window.__stap(10);          // de stokjes eerst terug (0,28 s): pas dan pakt E weer
  const laatste = { fase: y.stand.fase, ronde: y.stand.ronde };
  window.__E();
  const klaarN = window.__tot(() => y.stand.fase === 'klaar', 200);
  Object.assign(M.YUGO, was);
  return { voor, hint, na, pauze, naPauze, laatste, klaarN, eindFase: y.stand.fase };
});
ok(vier.voor.fase === 'eten' && vier.voor.johan > 0 && /volgende ronde/.test(vier.hint), 'je bord leeg terwijl Johan nog eet: "E — volgende ronde"', JSON.stringify(vier.voor));
ok(vier.na.fase === 'bestellen' && vier.na.ronde === vier.voor.ronde + 1, 'E: meteen de tablet voor de volgende ronde', JSON.stringify(vier.na));
ok(vier.pauze.fase === 'pauze' && vier.naPauze.fase === 'bestellen' && vier.naPauze.ronde === vier.pauze.ronde + 1, 'in de pauze begint E ook de volgende ronde', `${JSON.stringify(vier.pauze)} → ${JSON.stringify(vier.naPauze)}`);
ok(vier.laatste.ronde === 5 && vier.klaarN >= 0 && vier.klaarN < 60, 'na de laatste ronde rondt E af', `${JSON.stringify(vier.laatste)}, klaar na ${vier.klaarN} beelden`);

kop('5. ronde 2 en de tweede keer');
const vijf = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, y = g.yugo;
  // de eerste keer laten aflopen
  window.__tot(() => v.yugo.fase === 'uit' && !y.stand.actief, 3000);
  window.__stap(160);
  window.__meldingen.length = 0;
  v.startYugoLos();
  window.__tot(() => v.yugo.fase === 'tafel' && y.stand.actief);
  window.__stap(2);
  const regels = [];
  for (let i = 0; i < 12 && !window.__dicht(); i++) { regels.push(window.__tekst()); window.__E(); window.__stap(1); }
  const eerst = document.querySelector('#yugoTablet .eerst');
  return { keer: v.yugo.keer, regels, melding: window.__meldingen.some(m => /ZO WERKT HET/.test(m)), uitleg: !!eerst && getComputedStyle(eerst).display !== 'none' };
});
ok(vijf.keer === 2 && !vijf.melding && !vijf.uitleg && !vijf.regels.some(r => /1 tot 4/.test(r)), 'de tweede keer geen uitleg meer', JSON.stringify(vijf));

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);
