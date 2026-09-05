/*
 Eén foto van een willekeurige plek in de wijk, in spelmeters.

 Handig als er over een plek een opmerking komt ("hier loop ik vast", "dit
 gebouw klopt niet"): je zet de camera precies daar neer en kijkt ernaar,
 zonder eerst het hele spel door te lopen.

 Gebruik: python3 -m http.server 8123 &
          node tools/plek.mjs <x> <z> <kijkNaarX> <kijkNaarZ> [naam] [hoogte]

 Voorbeeld (de speeltuin bij Molenkrite 234 vanaf de inrit):
          node tools/plek.mjs 300 -85 330 -95 speeltuin
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const [x, z, dx, dz] = process.argv.slice(2, 6).map(Number);
const naam = process.argv[6] || 'plek';
const hoogte = Number(process.argv[7] || 1.7);
if ([x, z, dx, dz].some(n => !Number.isFinite(n))) {
  console.error('Gebruik: node tools/plek.mjs <x> <z> <kijkNaarX> <kijkNaarZ> [naam] [hoogte]');
  process.exit(2);
}
mkdirSync('docs/screenshots', { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
await page.evaluate(({ x, z, dx, dz, hoogte }) => {
  localStorage.removeItem('tinga.spel.v1');
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  g.player.pos.set(x, 0, z);
  g.player.yaw = Math.atan2(-(dx - x), -(dz - z));
  g.player.pitch = Math.atan2(hoogte * 0 - 0.2, Math.hypot(dx - x, dz - z));
  g.player.applyCamera();
  g.hud.msgT = 0; g.hud.msg.style.opacity = 0;
}, { x, z, dx, dz, hoogte });
await page.waitForTimeout(2500);
await page.screenshot({ path: `docs/screenshots/${naam}.png` });
console.log(`docs/screenshots/${naam}.png`);
await browser.close();
