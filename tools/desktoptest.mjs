// Test de Windows/desktop-schil: venster laadt, editor werkt, en Ctrl+S
// schrijft js/rows.user.js echt weg.
import { _electron as electron } from 'playwright';
import { existsSync, readFileSync, rmSync } from 'node:fs';

const doel = 'js/rows.user.js';
if (existsSync(doel)) rmSync(doel);

const app = await electron.launch({ args: ['.', '--no-sandbox', '--enable-unsafe-swiftshader'] });
const page = await app.firstWindow();
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
console.log('titel:', await page.title());
console.log('brug aanwezig:', await page.evaluate(() => !!(window.tinga && window.tinga.saveRows)));
console.log('app-map:', (await page.evaluate(() => window.tinga.info())).appDir);

await page.evaluate(() => { window.__autoplay = true; document.getElementById('overlay').style.display = 'none'; });
await page.waitForTimeout(600);
await page.evaluate(() => window.__game.editor.zet(true));
await page.keyboard.press('Tab');
await page.waitForTimeout(600);
await page.keyboard.down('Shift');
for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowUp');
await page.keyboard.up('Shift');
await page.waitForTimeout(2500);
await page.evaluate(() => window.__game.editor.opslaan());
await page.waitForTimeout(1500);

console.log('bestand geschreven:', existsSync(doel));
if (existsSync(doel)) {
  const t = readFileSync(doel, 'utf8');
  console.log('regels:', t.split('\n').filter(l => l.trim().startsWith('R(')).length);
  console.log('eerste rij:', t.split('\n').find(l => l.trim().startsWith('R(')).trim());
}

// herladen: het bestand moet nu voorrang krijgen
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
const log = await page.evaluate(async () => (await import('./js/data.js')).ROWS.length);
console.log('na herladen rijen:', log);
await app.close();
