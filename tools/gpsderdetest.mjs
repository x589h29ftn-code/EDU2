/*
 Proef bij stap 207 (npm run gpsderdetest). Gevraagd (17 okt 2026): "In de derde persoon kan je de GPS van de cache ook gebruiken,
 o.a. als je in de auto de derde persoon doet; dit moet niet."

 De GPS (js/geocache.js) hangt aan de camera; in de derde persoon zweefde hij voor je in de lucht achter Erik of de auto.

  1. Te voet in de eerste persoon: N zet hem aan en hij is in beeld.
  2. V naar de derde persoon met de GPS in de hand: meteen weg (niet aan, niet in beeld), in hetzelfde beeld.
  3. In de derde persoon: N weigert, met de melding dat het in de eerste persoon gaat.
  4. In een auto in de derde persoon: N weigert; in de auto in de eerste persoon mag hij; V in de auto: weer weg.
  5. Terug te voet in de eerste persoon: N werkt gewoon weer.

 Gebruik: npm run server &  node tools/gpsderdetest.mjs [poort]
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

const r = await page.evaluate(() => {
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, P = g.player, gc = g.geocache, D = g.derde;
  P.active = false; window.__autoplay = true;          // geocache.update draait alleen als het spel loopt
  g.politie.proefStil = true;
  const meldingen = []; const echt = g.hud.show.bind(g.hud); g.hud.show = (t, s) => { meldingen.push(String(t)); return echt(t, s); };
  gc.herstel({ gps: true, intro: true, gevonden: 0, invoer: '', mis: 0, goud: false });
  const stap = (n = 6) => { for (let i = 0; i < n; i++) gc.update(0.05); };
  const derde = (aan) => { if (D.aan !== aan) D.wissel(); };
  const stand = () => ({ aan: gc.aan, beeld: gc.inBeeld, hand: !!P.gpsInHand });
  const uit = {};
  P.inCar = null; derde(false); stap(2);
  // 1. te voet, eerste persoon
  uit.voet = { mag: gc.wissel() }; stap(10); Object.assign(uit.voet, stand());
  // 2. V met de GPS in de hand: één beeld later weg
  derde(true); gc.update(0.016);
  uit.v = stand();
  // 3. N in de derde persoon
  meldingen.length = 0;
  uit.derdeN = { mag: gc.wissel() }; stap(4); Object.assign(uit.derdeN, stand(), { melding: meldingen.find(m => /eerste persoon/.test(m)) || '' });
  // 4. in een auto
  const auto = g.vehicles.cars.find(c => c.driveable && c.mesh && c.mesh.visible) || g.vehicles.cars.find(c => c.driveable);
  P.inCar = auto;
  derde(true);
  uit.autoDerde = { mag: gc.wissel() }; stap(4); Object.assign(uit.autoDerde, stand());
  derde(false);
  uit.autoEerste = { mag: gc.wissel() }; stap(10); Object.assign(uit.autoEerste, stand());
  derde(true); gc.update(0.016);
  uit.autoV = stand();
  // 5. weer te voet, eerste persoon
  P.inCar = null; derde(false); stap(2);
  uit.terug = { mag: gc.wissel() }; stap(10); Object.assign(uit.terug, stand());
  gc.wissel(); stap(10);
  window.__autoplay = false;
  return uit;
});

kop('1. te voet in de eerste persoon');
ok(r.voet.mag && r.voet.aan && r.voet.beeld && r.voet.hand, 'N zet de GPS aan, in je hand en in beeld', JSON.stringify(r.voet));
kop('2. V met de GPS in de hand');
ok(!r.v.aan && !r.v.beeld && !r.v.hand, 'naar de derde persoon: de GPS is meteen weg', JSON.stringify(r.v));
kop('3. N in de derde persoon');
ok(!r.derdeN.mag && !r.derdeN.aan && !r.derdeN.beeld && !!r.derdeN.melding, 'N weigert, met uitleg', r.derdeN.melding);
kop('4. in de auto');
ok(!r.autoDerde.mag && !r.autoDerde.aan && !r.autoDerde.beeld, 'in de auto in de derde persoon: geen GPS', JSON.stringify(r.autoDerde));
ok(r.autoEerste.mag && r.autoEerste.aan && r.autoEerste.beeld, 'in de auto in de eerste persoon mag hij wel', JSON.stringify(r.autoEerste));
ok(!r.autoV.aan && !r.autoV.beeld, 'V in de auto: weer weg', JSON.stringify(r.autoV));
kop('5. terug te voet');
ok(r.terug.mag && r.terug.aan && r.terug.beeld, 'te voet in de eerste persoon werkt N gewoon weer', JSON.stringify(r.terug));

await browser.close();
console.log(fout ? `\n${fout} fout(en)` : '\nalles goed');
process.exit(fout ? 1 : 0);
