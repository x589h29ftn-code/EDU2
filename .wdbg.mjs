import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 700, height: 460 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
console.log(await page.evaluate(() => {
  const g = window.__game;
  const w = g.woningen || [];
  return JSON.stringify(w.map(h => ({ naam: h.naam, plekken: h.plekken, maten: { breed: h.maten.breed, diep: h.maten.diep, banden: h.maten.banden.length } })));
}));
await browser.close();
