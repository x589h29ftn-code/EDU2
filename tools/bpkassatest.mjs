/*
 Stap 169: de kassa van de BP-shop (npm run bpkassatest). Gevraagd: "blikje energy drank kopen bij BP voor 10 health en
 een 5% boost in rennen. Max 20% boost als je doordrinkt. Ook kraslot kopen en dat kost 25 euro, kan tussen 0 en 150
 opleveren, random kans."

   1. de kassa alleen aan de balie (de kant van de klant), niet buiten of achter de balie; E open en weer dicht;
   2. energydrank: € 3, +10 leven, 5 % sneller rennen per blikje, na vier 20 % en niet meer, leven nooit boven 100;
   3. de boost echt gemeten: rennen met 20 % boost legt 1,20 keer zo veel af als zonder, lopen blijft gelijk;
   4. de boost houdt 90 s na het laatste blikje en zakt dan in 15 s weg; neergaan haalt hem weg;
   5. kraslot: € 25, de prijs altijd uit 0, 10, 25, 50, 100 of 150, het geld klopt met de prijs; over 20.000 trekkingen
      kansen die bij de tabel horen en gemiddeld onder de € 25 (de BP verdient eraan);
   6. te weinig geld: niets betaald, geen leven en geen lot;
   7. weglopen sluit de kassa; op een aanraakscherm twee keuzeknoppen, en na missie 5 drie (sinds stap 196 de GPS).

 Gebruik: npm run server &  node tools/bpkassatest.mjs [poort]
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
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
page.setDefaultTimeout(900000);
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

const r = await page.evaluate(async () => {
  const g = window.__game, K = g.bpKassa, P = g.bpshop.wereld, V = g.verhaal, pl = g.player;
  const { BP_KASSA } = await import('./js/bpkassa.js');
  document.getElementById('overlay').style.display = 'none';
  await g.voorbereidSpel();
  window.__autoplay = true; pl.active = true;
  const uit = {};
  const zet = (u, w) => { const [x, z] = P(u, w); pl.pos.x = x; pl.pos.z = z; };
  // genoeg geld
  V.verdien(1000);

  // ---- 1. waar de kassa werkt
  zet(5.3, 5.2); uit.balie = K.bijBalie();
  zet(5.3, 7.2); uit.achter = K.bijBalie();
  zet(14.7, -4); uit.buiten = K.bijBalie();
  zet(5.3, 5.2);
  uit.e1 = K.toets(); uit.open1 = K.open; uit.knoppen = K.keuzes ? K.keuzes.length : 0;
  uit.e2 = K.toets(); uit.open2 = K.open;
  // (16 okt) de GPS pas vanaf na missie 5: dan drie knoppen
  { const s = V.bewaar(); Object.assign(s, { missie: 'klaar', fase: 'klaar', volgende: null, uitzendingKlaar: true }); V.herstel(s); V.verdien(1000); zet(5.3, 5.2); }
  K.toets(); uit.knoppenNa5 = K.keuzes ? K.keuzes.length : 0; K.toets();

  // ---- 2. energydrank
  K.reset(); pl.health = 50; K.toets();
  const blikjes = [];
  for (let i = 0; i < 6; i++) { const g0 = V.geld; K.kies(1); blikjes.push({ geld: g0 - V.geld, leven: pl.health, boost: +pl.renBoost.toFixed(3) }); }
  uit.blikjes = blikjes;

  // ---- 3. de boost gemeten: rennen en lopen, met en zonder
  K.toets();   // dicht
  // een vrij stuk van 12 m naar het oosten (+x) op het terrein voor de shop: elk halve meter buiten de botsdozen
  const W = await import('./js/world.js');
  let vrij = null;
  for (const w of [-6, -9, -14, -18, -22]) for (const u of [-10, -5, 0, 5, 10, 15, 20, 25]) {
    if (vrij) break;
    const [x, z] = P(u, w); let schoon = true;
    for (let d = 0; d <= 12 && schoon; d += 0.5) { const [a2, b2] = W.resolveCollisions(x + d, z, 0.35, 0, 0); if (Math.hypot(a2 - x - d, b2 - z) > 1e-6) schoon = false; }
    if (schoon) vrij = [x, z];
  }
  uit.vrij = vrij;
  const loop = (boost, rennen) => {
    pl.pos.x = vrij[0]; pl.pos.z = vrij[1]; pl.renBoost = boost; pl.yaw = -Math.PI / 2;   // kijkrichting (−sin, −cos) = (+1, 0)
    pl.keys = { KeyW: true, ShiftLeft: rennen }; pl.hurk = 0; pl.mik = 0;
    const x0 = pl.pos.x, z0 = pl.pos.z;
    for (let i = 0; i < 20; i++) pl.update(0.05);
    pl.keys = {};
    return Math.hypot(pl.pos.x - x0, pl.pos.z - z0);
  };
  const r0 = loop(0, true), r20 = loop(0.2, true), l0 = loop(0, false), l20 = loop(0.2, false);
  uit.rennen = { zonder: +r0.toFixed(2), met: +r20.toFixed(2), factor: +(r20 / r0).toFixed(3) };
  uit.lopen = { zonder: +l0.toFixed(2), met: +l20.toFixed(2) };

  // ---- 4. de boost verloopt
  K.reset(); zet(5.3, 5.2); K.toets(); K.kies(1); K.kies(1); K.toets();
  const b0 = pl.renBoost;
  for (let t = 0; t < 89; t++) K.update(1);
  const b89 = pl.renBoost;
  for (let t = 0; t < 2; t++) K.update(1);
  const b91 = pl.renBoost;
  for (let t = 0; t < 16; t++) K.update(1);
  uit.verloop = { start: +b0.toFixed(3), na89: +b89.toFixed(3), na91: +b91.toFixed(3), na107: +pl.renBoost.toFixed(3) };
  K.toets(); K.kies(1); K.toets(); K.reset(); uit.naReset = pl.renBoost;

  // ---- 5. kraslot
  zet(5.3, 5.2); K.toets();
  const loten = [];
  for (let i = 0; i < 12; i++) { const g0 = V.geld; const voor = K.stand.gewonnen; K.kies(2); const prijs = K.stand.gewonnen - voor; loten.push({ verschil: V.geld - g0, prijs }); }
  uit.loten = loten;
  K.toets();
  const tel = {}; let som = 0; const N = 20000;
  for (let i = 0; i < N; i++) { const p = K.trek(); tel[p] = (tel[p] || 0) + 1; som += p; }
  uit.trek = { tel, gemiddeld: +(som / N).toFixed(2), tabel: BP_KASSA.lot.prijzen };

  // ---- 6. te weinig geld
  V.betaal(V.geld - 2);
  pl.health = 40; K.toets();
  const g0 = V.geld, lot0 = K.stand.loten; K.kies(1); K.kies(2);
  uit.arm = { geld: V.geld, was: g0, leven: pl.health, loten: K.stand.loten - lot0 };
  // ---- 7. weglopen
  zet(14.7, -4); K.update(0.016); uit.weggelopen = K.open;
  pl.active = false; window.__autoplay = false;
  return uit;
});

kop('1. waar de kassa werkt');
ok(r.balie && !r.achter && !r.buiten, 'alleen voor de balie, niet erachter en niet buiten', JSON.stringify({ balie: r.balie, achter: r.achter, buiten: r.buiten }));
ok(r.e1 && r.open1 && r.e2 && !r.open2, 'E opent de kassa en sluit hem weer');
// (sinds stap 196 een derde: de GPS voor de Tinga Cache, sinds 16 okt pas na missie 5)
ok(r.knoppen === 2, 'op een aanraakscherm twee keuzeknoppen vóór missie 5 (drank, kraslot)', `${r.knoppen}`);
ok(r.knoppenNa5 === 3, 'en drie na missie 5 (ook de GPS)', `${r.knoppenNa5}`);

kop('2. energydrank');
const B = r.blikjes;
ok(B.every(b => b.geld === 3), 'elk blikje kost € 3', JSON.stringify(B.map(b => b.geld)));
ok(B[0].leven === 60 && B[1].leven === 70 && B.every(b => b.leven <= 100) && B[5].leven === 100, '+10 leven per blikje, nooit boven de 100', JSON.stringify(B.map(b => b.leven)));
ok(B[0].boost === 0.05 && B[1].boost === 0.1 && B[2].boost === 0.15 && B[3].boost === 0.2, '5 % sneller rennen per blikje', JSON.stringify(B.map(b => b.boost)));
ok(B[4].boost === 0.2 && B[5].boost === 0.2, 'na vier blikjes 20 % en niet meer', JSON.stringify(B.map(b => b.boost)));

kop('3. de boost gemeten');
ok(!!r.vrij, 'een vrij stuk om te meten gevonden', JSON.stringify(r.vrij));
ok(Math.abs(r.rennen.factor - 1.2) < 0.02, 'rennen met 20 % boost legt 1,20 keer zo veel af', JSON.stringify(r.rennen));
ok(Math.abs(r.lopen.met - r.lopen.zonder) < 0.02, 'lopen (zonder shift) blijft even snel', JSON.stringify(r.lopen));

kop('4. de boost verloopt');
const v = r.verloop;
ok(v.start === 0.1 && v.na89 === 0.1, 'de boost houdt 90 s na het laatste blikje', JSON.stringify(v));
ok(v.na91 < 0.1 && v.na91 > 0, 'en zakt daarna weg', JSON.stringify(v));
ok(v.na107 === 0, 'binnen 15 s helemaal weg', JSON.stringify(v));
ok(r.naReset === 0, 'neergaan haalt de boost weg', `${r.naReset}`);

kop('5. kraslot');
const L = r.loten, mogelijk = [0, 10, 25, 50, 100, 150];
ok(L.every(l => mogelijk.includes(l.prijs)), 'de prijs altijd € 0, 10, 25, 50, 100 of 150', JSON.stringify(L.map(l => l.prijs)));
ok(L.every(l => l.verschil === l.prijs - 25), 'het geld klopt: € 25 eraf, de prijs erbij', JSON.stringify(L.map(l => l.verschil)));
const T = r.trek, N = 20000;
ok(Object.keys(T.tel).every(k => mogelijk.includes(+k)), 'over 20.000 trekkingen alleen die bedragen', JSON.stringify(T.tel));
ok(T.tabel.every(([b, kans]) => Math.abs((T.tel[b] || 0) / N - kans) < 0.015), 'de kansen kloppen met de tabel (binnen 1,5 procentpunt)', JSON.stringify(T.tabel.map(([b, k]) => [b, k, +((T.tel[b] || 0) / N).toFixed(3)])));
ok((T.tel[150] || 0) > 0 && (T.tel[0] || 0) > 0, 'zowel niets als € 150 komt voor');
ok(T.gemiddeld > 8 && T.gemiddeld < 25, 'gemiddeld minder terug dan het lot kost', `€ ${T.gemiddeld}`);

kop('6. te weinig geld');
ok(r.arm.geld === r.arm.was && r.arm.leven === 40 && r.arm.loten === 0, 'niets betaald, geen leven, geen lot', JSON.stringify(r.arm));

kop('7. weglopen');
ok(r.weggelopen === false, 'weglopen sluit de kassa');

await browser.close();
console.log(fout ? `\n${fout} fout(en)` : '\nalles goed');
process.exit(fout ? 1 : 0);
