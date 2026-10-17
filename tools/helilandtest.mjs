/*
 Proef bij stap 208 (npm run helilandtest). Gemeld (17 okt 2026): "Laatste missie, als je naar beneden gaat met de heli, land ik
 bij de autogarage in het water. Fix dit en check op dit probleem."

 Missie 18, de avond: Wiebe landt bij het Autohuis (`landPlek` in js/verhaal.js), Erik stapt uit (3 m van de deur), en bij de
 zwarte Ferrari staan Mark en Johan.

  1. De oude manier (vrij van botsdozen, zonder naar water te kijken), nagerekend: lag die plek of de plek van het uitstappen in het
     water? (Ter vergelijking; deze controle zegt alleen wat er gebeurde.)
  2. De nieuwe landingsplek: vrij van botsdozen, niet in het water, met een ring van `landDroog` m droog land eromheen, en dichtbij
     het Autohuis.
  3. Het landen zelf, beeld voor beeld tot hij staat: de heli zakt op de landingsplek, niet boven het water.
  4. Na het landen (`naLanden`): Erik, Mark, Johan en de Ferrari staan allemaal op het droge en niet in een botsdoos.
  5. Opnieuw na laden in die fase (de opslag zet `naarAuto`): weer alles op het droge.
  6. De posten van het gevecht bij de loods aan het water: geen in het water.

 Gebruik: npm run server &  node tools/helilandtest.mjs [poort]
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fout = 0;
const ok = (goed, wat, extra = '') => { console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`); if (!goed) fout++; };
const kop = (t) => console.log(`\n--- ${t} ---`);
const r1 = (x) => (x == null ? x : Math.round(x * 10) / 10);

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
  const W = await import('/js/world.js');
  for (const k of Object.keys(localStorage)) if (k.startsWith('tinga.spel')) localStorage.removeItem(k);
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, v = g.verhaal, P = g.player;
  P.active = false; window.__autoplay = false;
  g.politie.proefStil = true;
  const stap = (n = 2, dt = 0.05) => { for (let i = 0; i < n; i++) v.update(dt); };
  const r1 = (x) => (x == null ? x : Math.round(x * 10) / 10);
  const nat = (x, z) => W.pointInWater(x, z);
  const inDoos = (x, z, rr = 0.3) => { const [rx, rz] = W.resolveCollisions(x, z, rr); return Math.hypot(rx - x, rz - z) > 0.02; };
  const ring = (x, z, rr) => { let n = 0; for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; if (nat(x + Math.cos(a) * rr, z + Math.sin(a) * rr)) n++; } return n; };
  const uit = {};
  // missie 18 in de avond, zodat de heli en de Ferrari er zijn
  const s = v.bewaar(); s.missie = 'uitzending'; s.fase = 'heliStart';
  v.herstel(s); stap(4);
  const garage = typeof g.garage === 'function' ? g.garage() : g.garage;
  const af = garage && garage.plekken && garage.plekken.aflever;
  // 1. de oude manier, nagerekend
  const m = af ? { x: af[0].x + 12, z: (af[0].z + af[af.length - 1].z) / 2 } : { x: 775, z: 136 };
  let oud = m;
  zoek: for (let rr = 0; rr < 60; rr += 3) for (let k = 0; k < 12; k++) {
    const a = k * Math.PI / 6, x = m.x + Math.cos(a) * rr, z = m.z + Math.sin(a) * rr;
    const [rx, rz] = W.resolveCollisions(x, z, 5);
    if (Math.hypot(rx - x, rz - z) < 0.01) { oud = { x, z }; break zoek; }
    if (rr === 0) break;
  }
  uit.oud = { x: r1(oud.x), z: r1(oud.z), nat: nat(oud.x, oud.z), ring: ring(oud.x, oud.z, 4) };
  // 2. de nieuwe plek
  const A = v.avond;
  const L = A.landPlek();
  uit.nieuw = { x: r1(L.x), z: r1(L.z), nat: nat(L.x, L.z), ring: ring(L.x, L.z, A.landDroog), doos: inDoos(L.x, L.z, 5), dAutohuis: af ? r1(Math.hypot(L.x - af[0].x, L.z - af[0].z)) : null };
  // 3. landen, beeld voor beeld: van 40 m hoog boven de luifel van de BP naar de plek
  const h = A.heli;
  h.toon(true);
  h.zet(L.x - 60, W.grondHoogte(L.x, L.z) + 40, L.z - 30, 0);
  let natBoven = 0, laag = 0, klaar = false, n = 0;
  for (; n < 2000 && !klaar; n++) {
    klaar = h.landNaar(0.05, L, W.grondHoogte(L.x, L.z));
    const y = h.pos.y - W.grondHoogte(h.pos.x, h.pos.z);
    if (y < 4) { laag++; if (nat(h.pos.x, h.pos.z)) natBoven++; }
  }
  uit.landen = { klaar, beelden: n, laag, natBoven, eind: Math.hypot(h.pos.x - L.x, h.pos.z - L.z) };
  // 4. na het landen
  const meet = () => {
    const a = v.avond;
    const p = { x: P.pos.x, z: P.pos.z }, mk = a.mark.groep.position, jo = a.johan.groep.position, au = a.auto;
    const rij = { erik: p, mark: mk, johan: jo, ferrari: au ? { x: au.x, z: au.z } : null };
    const r2 = {};
    for (const [k, q] of Object.entries(rij)) r2[k] = q ? { nat: nat(q.x, q.z), doos: k === 'ferrari' ? false : inDoos(q.x, q.z), x: r1(q.x), z: r1(q.z) } : null;
    r2.heli = { nat: nat(a.heli.pos.x, a.heli.pos.z) };
    r2.fase = v.fase;
    return r2;
  };
  A.naLanden(); stap(2);
  uit.na = meet();
  // 5. laden in die fase
  const s2 = v.bewaar(); s2.missie = 'uitzending'; s2.fase = 'naarAuto';
  v.herstel(s2); stap(4);
  uit.laden = meet();
  // 6. en de andere vaste plekken van deze missie aan het water: de posten bij de loods (begin, doel en uitwijkplekken)
  const posten = v.avond.posten || [];
  const punten = posten.flatMap(p => [p[0], p[1], ...(p[2] || [])]).filter(q => Array.isArray(q));
  uit.posten = { n: punten.length, nat: punten.filter(([x, z]) => nat(x, z)).map(([x, z]) => `(${x}, ${z})`) };
  return uit;
});

kop('1. de oude manier (ter vergelijking)');
console.log(`  oude landingsplek (${r.oud.x}, ${r.oud.z}): ${r.oud.nat ? 'in het water' : 'droog'}, ${r.oud.ring}/16 punten op 4 m in het water`);
kop('2. de nieuwe landingsplek');
ok(!r.nieuw.nat && r.nieuw.ring === 0 && !r.nieuw.doos, 'vrij, op het droge, met droog land rondom', `(${r.nieuw.x}, ${r.nieuw.z}), ${r.nieuw.ring}/16 nat op de ring`);
ok(r.nieuw.dAutohuis !== null && r.nieuw.dAutohuis < 90, 'bij het Autohuis', `${r.nieuw.dAutohuis} m van de auto's`);
kop('3. het landen');
ok(r.landen.klaar && r.landen.eind < 1.5, 'de heli landt op de plek', `${r.landen.beelden} beelden, ${r1(r.landen.eind)} m ernaast`);
ok(r.landen.natBoven === 0, 'onder de 4 m nooit boven het water', `${r.landen.natBoven} van ${r.landen.laag} lage beelden boven water`);
kop('4. na het landen');
for (const k of ['erik', 'mark', 'johan', 'ferrari']) {
  const q = r.na[k];
  ok(q && !q.nat && !q.doos, `${k} op het droge${k === 'ferrari' ? '' : ' en niet in een botsdoos'}`, q && `(${q.x}, ${q.z})`);
}
ok(!r.na.heli.nat && r.na.fase === 'naarAuto', 'de heli staat op het droge, door naar de auto', r.na.fase);
kop('5. na laden in die fase');
ok(['erik', 'mark', 'johan', 'ferrari'].every(k => r.laden[k] && !r.laden[k].nat), 'weer allemaal op het droge', JSON.stringify(Object.fromEntries(['erik', 'mark', 'johan', 'ferrari'].map(k => [k, r.laden[k] && r.laden[k].nat]))));

kop('6. de posten bij de loods aan het water');
ok(r.posten.n > 5 && r.posten.nat.length === 0, 'geen enkele post in het water', `${r.posten.n} punten${r.posten.nat.length ? ', nat: ' + r.posten.nat.join(' ') : ''}`);

await browser.close();
console.log(fout ? `\n${fout} fout(en)` : '\nalles goed');
process.exit(fout ? 1 : 0);
