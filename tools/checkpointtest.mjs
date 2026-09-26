/*
 Het checkpoint na elke missie en de keuze na het neergaan (verzoek 26 sep
 2026: "na doodgaan altijd optie geven om vanaf het laatste checkpoint, dus na
 de laatste missie, te herstarten").

   node tools/server.mjs 8123 &   node tools/checkpointtest.mjs [poort]

 1. Een afgeronde missie (hier: een huis kopen, missie 9) schrijft een tel later
    een checkpoint in een eigen opslagplek, los van F5. Een geladen spel doet
    dat niet.
 2. Ga je neer, dan staat er een keuze in beeld: de missie opnieuw, terug naar
    het checkpoint, of je eigen opslag. Met 2 sta je weer waar de laatste missie
    klaar was, met het huis van toen.
 3. Buiten een missie is de eerste keuze "hier weer opstaan"; zonder checkpoint
    staat die knop er niet. Een proef (`__autoplay`) krijgt geen keuze: die gaat
    meteen verder, zoals voorheen.
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fout = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fout++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 600000 });
await page.waitForFunction(() => window.__game, null, { timeout: 600000 });

const r = await page.evaluate(() => {
  const g = window.__game;
  localStorage.removeItem('tinga.spel.v1');
  localStorage.removeItem('tinga.checkpoint.v1');
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true;
  const stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) g.verhaal.update(dt); };
  const balkDicht = () => document.getElementById('dialoog').hidden;
  const tot = (vw, max = 400, dt = 0.2) => { for (let i = 0; i < max; i++) { if (vw()) return true; g.verhaal.update(dt); } return vw(); };
  const doorklikken = () => { for (let i = 0; i < 40 && !balkDicht(); i++) { g.praat(); stap(2); } };
  const cp = () => { try { return JSON.parse(localStorage.getItem('tinga.checkpoint.v1')); } catch { return null; } };
  const uit = {};

  // ---- 1. een huis kopen: de missie is klaar, en een tel later ligt er een checkpoint
  const w = g.woningen.find(x => x.stek && x.prijs === 1000);
  g.verhaal.herstel({ missie: 'huis', fase: 'kiezen', aanbod: true, geld: 3000 });
  stap(4);
  g.player.inCar = null;
  g.player.pos.set(w.plekken.stoel.x, 0, w.plekken.stoel.z);
  tot(() => balkDicht() && g.verhaal.aanspreekbaar, 120);
  uit.voor = cp();
  g.praat();                                   // kopen aan tafel
  stap(2);
  doorklikken();
  stap(40);                                    // twee tellen
  const c = cp();
  uit.koop = { missie: g.verhaal.missie, stek: g.verhaal.stek,
    cp: c ? { missie: c.verhaal && c.verhaal.missie, huis: c.verhaal && c.verhaal.huis, x: c.speler.x, z: c.speler.z } : null,
    opslag: !!localStorage.getItem('tinga.spel.v1') };
  const cpTekst = localStorage.getItem('tinga.checkpoint.v1');
  // laden is geen afgeronde missie
  localStorage.removeItem('tinga.checkpoint.v1');
  g.verhaal.herstel(g.verhaal.bewaar());
  stap(40);
  uit.naLaden = !!localStorage.getItem('tinga.checkpoint.v1');
  localStorage.setItem('tinga.checkpoint.v1', cpTekst);

  // ---- 2. verder spelen, zelf opslaan, een missie beginnen en neergaan
  g.player.pos.set(g.start.x, 0, g.start.z); g.player.applyCamera();
  g.opslaan();
  g.verhaal.startMissie('veteraan');
  stap(10);
  window.__autoplay = false;
  g.verhaal.dood();
  stap(70);
  const el = document.getElementById('doodkeus');
  const knoppen = () => [...el.querySelectorAll('button')].filter(b => !b.hidden).map(b => b.textContent);
  uit.keuze = { open: g.verhaal.keuzeOpen, zicht: !el.hidden, knoppen: knoppen(), actief: g.player.active };
  // en zolang de keuze er staat gebeurt er niets: tien tellen later staat hij er nog
  stap(200);
  uit.keuze.blijft = g.verhaal.keuzeOpen && !el.hidden;
  // 2: terug naar het checkpoint
  window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', code: 'Digit2', bubbles: true }));
  stap(4);
  uit.terug = { open: g.verhaal.keuzeOpen, zicht: !el.hidden, missie: g.verhaal.missie, stek: g.verhaal.stek,
    d: Math.hypot(g.player.pos.x - w.plekken.stoel.x, g.player.pos.z - w.plekken.stoel.z),
    actief: g.player.active, leven: g.player.health };

  // ---- 3. buiten een missie neergaan: "hier weer opstaan"; zonder checkpoint geen knop
  localStorage.removeItem('tinga.checkpoint.v1');
  g.player.health = 0;
  g.verhaal.dood();
  stap(70);
  uit.buiten = { knoppen: knoppen() };
  el.querySelector('button[data-keuze="missie"]').click();
  stap(4);
  uit.buiten.open = g.verhaal.keuzeOpen; uit.buiten.leven = g.player.health; uit.buiten.actief = g.player.active;

  // en een proef krijgt geen keuze
  window.__autoplay = true;
  g.verhaal.dood();
  stap(70);
  uit.proef = { open: g.verhaal.keuzeOpen, zicht: !el.hidden, actief: g.player.active };
  return uit;
});

kop('het checkpoint na een missie');
ok(!r.voor, 'vóór de missie klaar is ligt er geen checkpoint');
ok(r.koop.missie === 'klaar' && r.koop.cp && r.koop.cp.missie === 'klaar' && r.koop.cp.huis === 'Koningsspil 20',
  'een tel na het kopen ligt er een checkpoint, met het huis erin', JSON.stringify(r.koop.cp));
ok(!r.koop.opslag, 'en je eigen opslag (F5) blijft er buiten');
ok(!r.naLaden, 'een geladen spel schrijft geen checkpoint');

kop('de keuze na het neergaan');
ok(r.keuze.open && r.keuze.zicht && !r.keuze.actief, 'na het neergaan staat er een keuze in beeld', r.keuze.knoppen.join(' | '));
ok(r.keuze.knoppen.length === 3 && /missie opnieuw/i.test(r.keuze.knoppen[0]) && /checkpoint/i.test(r.keuze.knoppen[1])
  && /opgeslagen/i.test(r.keuze.knoppen[2]), 'de missie opnieuw, het checkpoint en je eigen opslag');
ok(r.keuze.blijft, 'en die blijft staan tot je kiest');
ok(!r.terug.open && !r.terug.zicht && r.terug.missie === 'klaar' && r.terug.stek === 'Koningsspil 20' && r.terug.d < 1.5,
  'met 2 sta je weer waar de laatste missie klaar was', `${r.terug.missie}, ${r.terug.stek}, ${r.terug.d.toFixed(2)} m van de tafel`);
ok(r.terug.actief && r.terug.leven === 100, 'met vol leven, en je kunt weer spelen');

kop('buiten een missie, en in een proef');
ok(r.buiten.knoppen.length === 2 && /opstaan/i.test(r.buiten.knoppen[0]) && !r.buiten.knoppen.some(k => /checkpoint/i.test(k)),
  'buiten een missie: hier weer opstaan; zonder checkpoint geen knop', r.buiten.knoppen.join(' | '));
ok(!r.buiten.open && r.buiten.leven === 100 && r.buiten.actief, 'een klik en je staat weer op');
ok(!r.proef.open && !r.proef.zicht && r.proef.actief, 'een proef gaat meteen verder, zonder keuze');

console.log(`\n${fout ? fout + ' fout' : 'alles goed'}`);
await browser.close();
process.exit(fout ? 1 : 0);
