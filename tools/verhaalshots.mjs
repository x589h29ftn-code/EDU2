/*
 Maakt de foto's van het verhaal in de Molenkrite: het startpunt voor nummer 15,
 het gesprek met de buurman en de opdracht bij de bierdrinkers.

 Gebruik: python3 -m http.server 8123 &  node tools/verhaalshots.mjs 8123 [map]
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
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
await page.evaluate(() => {
  localStorage.removeItem('tinga.spel.v1');
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  window.__game.player.active = true;
});
await page.waitForTimeout(2000);

const foto = async (naam) => {
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${map}/${naam}.png` });
  console.log(`${map}/${naam}.png`);
};

// 1. het startpunt: de buurman staat voor Molenkrite 15 en zwaait
await page.evaluate(() => { for (let i = 0; i < 30; i++) window.__game.verhaal.update(0.05); });
await foto('molenkrite15');

// 2. het gesprek
await page.keyboard.press('KeyE');
await foto('molenkrite15_gesprek');

// 3. de opdracht bij de bierdrinkers: even meelopen en dan naar hem toe kijken
await page.keyboard.press('KeyE');
await page.evaluate(() => {
  const g = window.__game;
  for (let i = 0; i < 2000 && g.verhaal.fase === 'loopt'; i++) {
    g.verhaal.update(0.05);
    const p = g.verhaal.buurman.groep.position;
    g.player.pos.set(p.x + 2.8, 0, p.z + 2.6);
  }
  for (let i = 0; i < 60; i++) g.verhaal.update(0.05);
  // de speler kijkt naar de buurman, met het gezelschap erachter
  const b = g.verhaal.buurman.groep.position;
  const dx = b.x - g.player.pos.x, dz = b.z - g.player.pos.z;
  g.player.yaw = Math.atan2(-dx, -dz);
  g.player.pitch = -0.05;
});
await foto('molenkrite15_bevel');

await browser.close();
