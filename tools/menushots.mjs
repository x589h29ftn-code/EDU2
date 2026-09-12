/*
 Foto's van het startscherm en het laadscherm.

 Gebruik: python3 -m http.server 8123 &  node tools/menushots.mjs 8123 [map]
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const port = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
mkdirSync(map, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 300000 });

// 1. het startscherm, dat er is voordat de wereld klaar is
await page.waitForSelector('#menuNieuw', { state: 'attached', timeout: 120000 });
await page.waitForTimeout(700);
await page.screenshot({ path: `${map}/startscherm.png`, timeout: 300000 });
console.log(`${map}/startscherm.png`);

// 2. de besturing, uitgeklapt onder de knoppen
await page.evaluate(() => document.getElementById('menuBesturing').click());
await page.waitForTimeout(400);
await page.screenshot({ path: `${map}/menu_besturing.png`, timeout: 300000 });
console.log(`${map}/menu_besturing.png`);

// 3. het laadscherm, halverwege de opbouw
await page.evaluate(() => {
  document.getElementById('menuBesturing').click();
  document.getElementById('menuNieuw').click();
});
await page.waitForFunction(() => {
  const b = document.getElementById('laadbalkin');
  return b && parseFloat(b.style.width) > 35;
}, null, { timeout: 300000 });
await page.screenshot({ path: `${map}/laadscherm.png`, timeout: 300000 });
console.log(`${map}/laadscherm.png`);

await browser.close();
