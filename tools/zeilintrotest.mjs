/*
 Stap 176 (npm run zeilintrotest): "in de intro cinematic zie je op de Molenkrite een zeilboot".

 De zeilbootjes van js/zeilen.js kregen hun plek pas in de eerste `update`, en die draait alleen in het spel. Tot dan
 stonden ze op (0, 0): de Molenkrite bij het beginpunt, in het filmpje van de intro en achter het menu. Deze proef laadt
 het spel zonder het te starten en kijkt of elke zichtbare zeilboot op het water ligt, ver van het beginpunt; en na een
 beeld spelen nog steeds.

 Gebruik: npm run server &  node tools/zeilintrotest.mjs [poort]
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fout = 0;
const ok = (goed, wat, extra = '') => { console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`); if (!goed) fout++; };

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
  const W = await import('./js/world.js');
  const g = window.__game, s = g.start || { x: 10, z: -7 };
  const meet = () => {
    const uit = [];
    g.scene.traverse(o => {
      if (o.name !== 'zeilboot') return;
      const p = o.position;
      uit.push({ zicht: o.visible, x: +p.x.toFixed(1), z: +p.z.toFixed(1), water: W.pointInWater(p.x, p.z), vanStart: +Math.hypot(p.x - s.x, p.z - s.z).toFixed(0) });
    });
    return uit;
  };
  const voor = meet();
  // een beeld spelen zoals de hoofdlus dat doet
  if (g.zeilen) g.zeilen.update(0.05, s.x, s.z);
  return { voor, na: meet() };
});

const goed = (b) => !b.zicht || (b.water && b.vanStart > 40);
ok(r.voor.length === 4, 'vier zeilboten in de scène', `${r.voor.length}`);
ok(r.voor.every(goed), 'vóór het spelen (menu, intro): elke zichtbare zeilboot op het water, niet bij het beginpunt', JSON.stringify(r.voor));
ok(r.voor.every(b => b.vanStart > 40), 'geen enkele op de Molenkrite (ook geen verborgen)', JSON.stringify(r.voor.map(b => b.vanStart)));
ok(r.na.every(goed), 'na een beeld spelen nog steeds op het water', JSON.stringify(r.na));

await browser.close();
console.log(fout ? `\n${fout} fout(en)` : '\nalles goed');
process.exit(fout ? 1 : 0);
