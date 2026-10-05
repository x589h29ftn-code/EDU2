/*
 Stap 126: kleine winsten (5 okt 2026: "1 digitale klok niet groot, 2, 4, 6, 7, 8, 9, 10").

   node tools/server.mjs 8123 &   node tools/kleinwinsttest.mjs [poort]   (npm run kleinwinsttest)

 1. Een klein digitaal klokje naast de minikaart, dat de tijd van het spel volgt.
 2. Slapen tot de ochtend: Z op de bank in je eigen huis; niet in een ander huis, niet in een missie.
 4. Met de drone in de lucht volgt de minikaart de drone.
 6. Wisselend weer: vanzelf, geleidelijk, uit te zetten; met de hand meteen.
 7. Kliko's langs de route van de vuilniswagen: aan de stoep, gekanteld bij de stop, weg met de wagen.
 8. De sterren twinkelen.
 (9 en 10 staan in npm run huistest en npm run verhaaltest.)
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
const page = await browser.newPage({ viewport: { width: 1100, height: 640 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  localStorage.removeItem('tinga.spel.v1'); localStorage.removeItem('tinga.checkpoint.v1');
  document.getElementById('overlay').style.display = 'none';
  window.__autoplay = true;
  g.player.active = false;
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) { g.player.health = Math.max(1, g.player.health); v.update(dt); } };
  // vrij spelen, met een eigen huis
  window.__vrij = (extra = {}) => {
    const s = v.bewaar(); s.volgende = null; s.punt = null;
    Object.assign(s, { missie: 'klaar', fase: 'klaar', huis: 'Koningsspil 20' }, extra);
    g.politie.reset(); v.herstel(s); window.__stap(2);
  };
});

// ------------------------------------------------------------------ 1. de klok
kop('een klein digitaal klokje');
const klok = await page.evaluate(() => {
  const g = window.__game, S = g.sfeer;
  const el = document.getElementById('klok');
  S.uur = 14 + 35 / 60; g.werkKlokBij();
  const t1 = el.textContent;
  S.uur = 7 + 5 / 60; g.werkKlokBij();
  const t2 = el.textContent;
  const cs = getComputedStyle(el), r = el.getBoundingClientRect(), kaart = document.getElementById('minimap').getBoundingClientRect();
  return { t1, t2, font: parseFloat(cs.fontSize), b: r.width, h: r.height, zichtbaar: cs.display !== 'none' && r.width > 0,
    naast: r.right <= kaart.left + 1 && Math.abs(r.top - kaart.top) < 40, mono: /mono|Menlo|Consolas/i.test(cs.fontFamily) };
});
ok(klok.t1 === '14:35' && klok.t2 === '07:05', 'het klokje volgt de tijd van het spel', `${klok.t1} · ${klok.t2}`);
ok(klok.zichtbaar && klok.font <= 14 && klok.b < 80 && klok.h < 30, 'klein', `${klok.font}px, ${klok.b.toFixed(0)} × ${klok.h.toFixed(0)} px`);
ok(klok.naast && klok.mono, 'digitaal, naast de minikaart');

// ------------------------------------------------------------------ 2. slapen
kop('slapen tot de ochtend');
const slaap = await page.evaluate(() => {
  const g = window.__game, P = g.player, S = g.sfeer, v = g.verhaal;
  const uit = {};
  window.__vrij();
  uit.eigen = v.eigenHuis;
  const zit = (naam) => {
    const w = g.woningen.find(q => q.naam === naam);
    if (P.zit) for (const q of g.woningen) q.staOp && q.staOp();
    P.inCar = null; P.pos.set(w.plekken.bank.x, 0, w.plekken.bank.z);
    w.toets();
    return w;
  };
  // in je eigen huis, 's nachts
  S.uur = 23.5; P.health = 40;
  const w = zit('Koningsspil 20');
  uit.zit = !!P.zit && w.zitOpBank;
  w.update(0.1, false);
  uit.hint = document.getElementById('hint') ? document.getElementById('hint').textContent : '';
  uit.praat = [...document.querySelectorAll('#praat, #hint, #dialoog')].map(e => e.textContent).join(' | ');
  uit.mag = g.slaapToets();
  for (let i = 0; i < 160; i++) v.update(0.05);
  uit.na = { uur: S.uur, leven: P.health, zit: !!P.zit };
  // in een ander huis niet
  S.uur = 23.5;
  zit('Zeskanter 16');
  uit.ander = g.slaapToets();
  uit.anderUur = S.uur;
  if (P.zit) for (const q of g.woningen) q.staOp && q.staOp();
  // in een missie niet
  v.startMissie('rijden'); window.__stap(2);
  zit('Koningsspil 20');
  uit.missie = v.slapen('Koningsspil 20');
  if (P.zit) for (const q of g.woningen) q.staOp && q.staOp();
  window.__vrij();
  return uit;
});
ok(slaap.eigen === 'Koningsspil 20' && slaap.zit, 'op de bank in je eigen huis');
ok(/Z — slapen/.test(slaap.praat), 'de balk zegt Z — slapen tot de ochtend', slaap.praat.slice(0, 120));
ok(slaap.mag && Math.abs(slaap.na.uur - 8) < 0.05 && slaap.na.leven >= 100 && !slaap.na.zit, 'Z: de volgende ochtend om acht uur, uitgerust', JSON.stringify(slaap.na));
ok(!slaap.ander && Math.abs(slaap.anderUur - 23.5) < 0.01, 'in een ander huis niet');
ok(/missie/.test(slaap.missie || ''), 'in een missie niet', slaap.missie);

// ------------------------------------------------------------------ 4. de minikaart en de drone
kop('de minikaart volgt de drone');
const kaart = await page.evaluate(() => {
  const g = window.__game, P = g.player, D = g.drone;
  const s = g.start || { x: 10.7, z: -7.1 };
  // (de vlag `binnen` zet de hoofdlus; na het slapen stond hij nog aan)
  P.pos.set(s.x, 0, s.z); P.binnen = false; P.zit = false; P.inCar = null; P.drone = true; D.accu = 300;
  const op = g.droneToets(); for (let i = 0; i < 4; i++) D.update(0.05);
  D.pos.set(s.x + 300, 60, s.z + 200);
  g.straatOf(D.pos.x, D.pos.z); g.kaartNaarDrone();
  const k = g.hud.kaartVanaf ? { x: g.hud.kaartVanaf.x, z: g.hud.kaartVanaf.z } : null;
  D.terug(); P.drone = false;
  g.straatOf(P.pos.x, P.pos.z); g.kaartNaarDrone();
  return { op, k, na: g.hud.kaartVanaf, drone: { x: s.x + 300, z: s.z + 200 } };
});
ok(kaart.k && Math.abs(kaart.k.x - kaart.drone.x) < 0.01 && Math.abs(kaart.k.z - kaart.drone.z) < 0.01, 'in de lucht: de kaart op de drone', `opgestegen: ${kaart.op}`);
ok(kaart.na === null, 'terug bij Erik: de kaart weer op Erik');

// ------------------------------------------------------------------ 6. wisselend weer
kop('wisselend weer');
const weer = await page.evaluate(() => {
  const g = window.__game, S = g.sfeer;
  const uit = { aan: S.autoWeer };
  S.weer = 'helder';
  // vanzelf: een heel uur over met een dobbelsteen die "verandering" gooit
  const rnd = Math.random;
  Math.random = () => 0.05;
  S.uur = 10.99; S.loopt = true; S.update(3, 0, 0);
  Math.random = rnd;
  uit.doel = S.weerDoel;
  uit.direct = { zwaar: S.weerZwaar, far: g.scene.fog.far };
  S.loopt = false;
  for (let i = 0; i < 15; i++) S.update(1, 0, 0);             // vijftien tellen: halverwege
  uit.half = { zwaar: S.weerZwaar, far: g.scene.fog.far, weer: S.weer };
  for (let i = 0; i < 40; i++) S.update(1, 0, 0);
  uit.heel = { zwaar: S.weerZwaar, far: g.scene.fog.far, weer: S.weer };
  // naar regen, en weer met de hand terug: meteen
  S.naarWeer('regen'); for (let i = 0; i < 60; i++) S.update(1, 0, 0);
  uit.regen = { weer: S.weer, far: g.scene.fog.far };
  S.weer = 'helder';
  uit.hand = { weer: S.weer, zwaar: S.weerZwaar, far: g.scene.fog.far };
  // over 2000 uur: meestal droog
  const tel = { 0: 0, 1: 0, 2: 0 };
  for (let i = 0; i < 2000; i++) { S.dobbelWeer(); tel[Math.round(S.weerDoel)]++; }
  uit.tel = tel;
  S.weer = 'helder';
  // uit: geen wissel meer
  S.autoWeer = false;
  Math.random = () => 0.05;
  S.uur = 11.99; S.loopt = true; S.update(3, 0, 0);
  Math.random = rnd;
  uit.uit = { doel: S.weerDoel, opslag: localStorage.getItem('tinga.weer') };
  S.autoWeer = true; S.loopt = false; S.weer = 'helder'; S.uur = 13;
  return uit;
});
ok(weer.aan, 'het weer wisselt standaard vanzelf');
ok(weer.doel === 1 && weer.direct.zwaar < 0.2 && weer.direct.far > 850, 'een heel uur: het weer kiest bewolkt, maar het zicht springt niet', JSON.stringify(weer.direct));
ok(weer.half.zwaar > 0.6 && weer.half.zwaar < 1 && weer.half.far < 800 && weer.half.far > 640, 'na vijftien tellen halverwege', JSON.stringify(weer.half));
ok(weer.heel.zwaar === 1 && Math.abs(weer.heel.far - 620) < 1 && weer.heel.weer === 'bewolkt', 'en dan bewolkt', JSON.stringify(weer.heel));
ok(weer.regen.weer === 'regen' && Math.abs(weer.regen.far - 320) < 1, 'een bui', JSON.stringify(weer.regen));
ok(weer.hand.weer === 'helder' && weer.hand.zwaar === 0 && Math.abs(weer.hand.far - 900) < 1, 'met de hand (Y, het menu) meteen');
ok(weer.tel[0] > weer.tel[1] && weer.tel[1] > weer.tel[2] && weer.tel[2] > 50, 'meestal droog, soms bewolkt, af en toe regen', JSON.stringify(weer.tel));
ok(weer.uit.doel === 0 && weer.uit.opslag === 'vast', 'uit te zetten in de instellingen (en de browser onthoudt het)');

// ------------------------------------------------------------------ 7. kliko's
kop('kliko\'s langs de route van de vuilniswagen');
const kliko = await page.evaluate(async () => {
  const g = window.__game, L = g.leven;
  const W = await import('/js/world.js');
  const s = g.start || { x: 10.7, z: -7.1 };
  const sp = { x: s.x, z: s.z };
  let gestart = false;
  for (let i = 0; i < 4 && !gestart; i++) gestart = L.startVuilnis(sp, { zeker: true });
  const k0 = L.vuilnis.klikos;
  const vrij = k0.every(k => { const [x, z] = W.resolveCollisions(k.x, k.z, 0.4); return Math.hypot(x - k.x, z - k.z) < 0.03; });
  // tot de eerste stop, en midden in die stop
  let n = 0;
  while (!L.vuilnis.stil && n++ < 800) L.update(0.1, sp, () => true, 8);
  for (let i = 0; i < 20; i++) L.update(0.1, sp, () => true, 8);
  const midden = L.vuilnis.klikos.find(k => k.kantel > 0.3);
  for (let i = 0; i < 40; i++) L.update(0.1, sp, () => true, 8);
  const geleegd = L.vuilnis.klikos.filter(k => k.leeg).length;
  L.vuilnisWeg();
  return { gestart, n: k0.length, vrij, midden: !!midden, geleegd, na: L.vuilnis.klikos.length };
});
ok(kliko.gestart && kliko.n >= 3, 'kliko\'s aan de stoep bij de stops', `${kliko.n} stuks`);
ok(kliko.vrij, 'niet in een muur, schutting of heg');
ok(kliko.midden && kliko.geleegd >= 1, 'bij de stop gaat er een omhoog en is hij geleegd', `${kliko.geleegd} geleegd`);
ok(kliko.na === 0, 'met de wagen weg zijn ze weg');

// ------------------------------------------------------------------ 8. de sterren twinkelen
kop('de sterren twinkelen');
const ster = await page.evaluate(() => {
  const g = window.__game;
  let u = null, src = '';
  g.scene.traverse(o => { if (!u && o.material && o.material.uniforms && o.material.uniforms.tijd && o.material.uniforms.nacht) { u = o.material.uniforms; src = o.material.fragmentShader; } });
  return { tijd: !!u, sin: /sin\(tijd/.test(src) };
});
ok(ster.tijd && ster.sin, 'de lucht krijgt de tijd, en elke ster flonkert op zijn eigen tempo');

console.log(fouten ? `\n${fouten} FOUT(EN)` : '\nalles goed');
await browser.close();
process.exit(fouten ? 1 : 0);
