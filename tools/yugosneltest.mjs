/*
 Proef bij stap 211 (npm run yugosneltest). Gevraagd (17 okt 2026): "Bouw een snelkoppeling om Yugo te testen."

 shift+Y zet je meteen aan tafel bij Yugo (js/verhaal.js `startYugoLos`), zonder het voorstel van Johan af te wachten:

  1. Vanuit vrij spelen (na het einde): shift+Y met de echte toets → "Die avond, bij Yugo in Sneek…", aan tafel in de zaal, de
     tablet, geen wapen (`player.aanTafel`), de klok stil.
  2. Midden in het spel, vóór Johan het ooit voorstelde (missie 3), in een auto: je stapt uit en zit ook aan tafel.
  3. X: weg uit Yugo, terug buiten, en weer een wapen.
  4. Nog een keer shift+Y kan weer; aan tafel doet een tweede shift+Y niets (geen tweede keer zwart).

 Gebruik: npm run server &  node tools/yugosneltest.mjs [poort]
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
  window.__stap = (n = 1, dt = 0.05) => { for (let i = 0; i < n; i++) { P.health = 100; v.update(dt); } };
  window.__zwart = [];
  window.__tot = (f, max = 600) => {
    for (let i = 0; i < max; i++) {
      const t = document.getElementById('overgangtekst'); if (t && t.textContent && !window.__zwart.includes(t.textContent)) window.__zwart.push(t.textContent);
      if (f()) return i;
      window.__stap(1);
    }
    return -1;
  };
  window.__stand = () => {
    const y = g.yugo && g.yugo.stand;
    return { fase: v.yugo.fase, keer: v.yugo.keer, zaal: !!(y && y.actief), aanTafel: !!P.aanTafel, inCar: !!P.inCar, tablet: !document.getElementById('yugoTablet').hidden || (y && y.fase === 'bestellen'), uur: +g.sfeer.uur.toFixed(2), x: +P.pos.x.toFixed(0), z: +P.pos.z.toFixed(0) };
  };
  const s = v.bewaar(); Object.assign(s, { missie: 'klaar', fase: 'klaar', volgende: null, uitzendingKlaar: true, invalKlaar: true, ronaldKlaar: true, roanKlaar: true, noMercyKlaar: true, noMercyGebeld: true });
  v.herstel(s); window.__stap(2);
});

kop('1. shift+Y vanuit vrij spelen');
await page.keyboard.press('Shift+KeyY');
const een = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  const n = window.__tot(() => v.yugo.fase === 'tafel' && g.yugo.stand.actief);
  window.__stap(140);            // het zwart ebt weg
  const a = window.__stand();
  const uur1 = g.sfeer.uur; window.__stap(100); a.klokStil = Math.abs(g.sfeer.uur - uur1) < 0.01;
  return { n, ...a, zwart: [...window.__zwart] };
});
ok(een.n >= 0 && een.fase === 'tafel' && een.zaal, 'aan tafel in de zaal van Yugo', JSON.stringify(een));
ok(een.zwart.some(t => /Yugo/.test(t)), '"Die avond, bij Yugo in Sneek…"', een.zwart.join(' | '));
ok(een.aanTafel && een.klokStil, 'geen wapen aan tafel, en de klok staat stil', `aanTafel ${een.aanTafel}, klok stil ${een.klokStil}`);

kop('2. een tweede shift+Y aan tafel doet niets');
await page.keyboard.press('Shift+KeyY');
const twee = await page.evaluate(() => { window.__zwart.length = 0; window.__stap(20); return { ...window.__stand(), zwart: [...window.__zwart] }; });
ok(twee.fase === 'tafel' && twee.keer === een.keer && !twee.zwart.length, 'geen tweede keer zwart, nog steeds dezelfde avond', JSON.stringify(twee));

kop('3. X: weg uit Yugo');
await page.keyboard.press('KeyX');
const weg = await page.evaluate(() => {
  const v = window.__game.verhaal;
  const n = window.__tot(() => !window.__game.yugo.stand.actief && v.yugo.fase !== 'tafel' && v.yugo.fase !== 'weg', 1200);
  window.__stap(160);
  return { n, ...window.__stand() };
});
ok(weg.n >= 0 && !weg.zaal && !weg.aanTafel, 'buiten, en weer een wapen', JSON.stringify(weg));

kop('4. midden in het spel, in een auto');
const drie = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  const s = v.bewaar(); s.missie = 'bewaking'; s.fase = 'naarAuto'; s.yugoGevraagd = false;
  v.herstel(s); window.__stap(4);
  const auto = g.vehicles.voegToe({ x: P.pos.x + 4, z: P.pos.z, yaw: 0, soort: 'hatch', kleur: 0x335577 });
  window.__stap(2);
  P.inCar = auto;
  return { missie: v.missie, gevraagd: v.yugo.gevraagd, inCar: !!P.inCar };
});
await page.keyboard.press('Shift+KeyY');
const vier = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  const n = window.__tot(() => v.yugo.fase === 'tafel' && g.yugo.stand.actief);
  window.__stap(140);
  return { n, missie: v.missie, ...window.__stand() };
});
ok(drie.inCar && vier.n >= 0 && vier.fase === 'tafel' && vier.zaal && !vier.inCar && vier.aanTafel, 'ook in een auto, vóór het voorstel van Johan: aan tafel', `${JSON.stringify(drie)} → ${JSON.stringify(vier)}`);

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);
