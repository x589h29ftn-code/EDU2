// Test de touchbesturing in een gesimuleerde telefoon (Playwright, has_touch).
// Gebruik: node tools/touchtest.mjs [poort] [uitvoermap]
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';

const port = process.argv[2] || '8123';
const out = process.argv[3] || 'shots';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ ...devices['Pixel 5'], viewport: { width: 851, height: 393 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') console.log('[browser]', m.text()); });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 90000 });
await page.waitForTimeout(1200);

console.log('touch gedetecteerd:', await page.evaluate(() => document.body.classList.contains('touch')));
await page.screenshot({ path: `${out}/tc_start.png` });

// starten
await page.tap('#start');
await page.waitForTimeout(600);
console.log('actief:', await page.evaluate(() => window.__game.player.active),
  'touch-ui:', await page.evaluate(() => getComputedStyle(document.getElementById('touch')).display));

const cdp = await ctx.newCDPSession(page);
// Chromium negeert een touchStart met een id dat net is losgelaten, dus
// krijgt elke nieuwe vinger een vers id.
let tid = 1;
const touch = async (type, x, y) => {
  if (type === 'touchStart') tid++;
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: tid }],
  });
};

// korte tik in het kijkvak is een schot
const ammo0 = await page.evaluate(() => window.__game.player.ammo);
await page.touchscreen.tap(520, 140);
await page.waitForTimeout(400);
console.log('munitie na tik:', ammo0, '->', await page.evaluate(() => window.__game.player.ammo));

const before = await page.evaluate(() => ({ ...window.__game.player.pos, yaw: window.__game.player.yaw }));

// joystick: vinger neer links, naar boven slepen = vooruit
await touch('touchStart', 150, 300);
await page.waitForTimeout(80);
await touch('touchMove', 150, 230);
await page.waitForTimeout(120);
console.log('as na slepen:', await page.evaluate(() => ({ ...window.__game.player.moveAxis, sprint: window.__game.player.sprint })));
await page.screenshot({ path: `${out}/tc_stick.png` });
await page.waitForTimeout(1200);
const mid = await page.evaluate(() => ({ ...window.__game.player.pos }));
await touch('touchEnd', 150, 230);
await page.waitForTimeout(600);
console.log('as na loslaten:', await page.evaluate(() => window.__game.player.moveAxis));

// rondkijken: rechterhelft horizontaal vegen
await touch('touchStart', 650, 200);
await page.waitForTimeout(200);
await touch('touchMove', 500, 200);
await page.waitForTimeout(200);
await touch('touchEnd', 500, 200);
await page.waitForTimeout(400);
const after = await page.evaluate(() => ({ ...window.__game.player.pos, yaw: window.__game.player.yaw, ammo: window.__game.player.ammo }));

console.log('start', before);
console.log('na lopen', mid, 'verplaatst', Math.hypot(mid.x - before.x, mid.z - before.z).toFixed(2), 'm');
console.log('na kijken', after, 'yaw-verschil', (after.yaw - before.yaw).toFixed(3));

// knoppen
await page.tap('#tmap');
await page.waitForTimeout(200);
console.log('kaart open:', await page.evaluate(() => window.__game.hud.bigOpen));
await page.screenshot({ path: `${out}/tc_map.png` });
await page.tap('#tmap');
await page.waitForTimeout(400);

await page.tap('#tjump');
await page.waitForTimeout(1200);   // softwarerendering haalt maar een paar beelden per seconde
console.log('springt (y>0):', await page.evaluate(() => window.__game.player.pos.y.toFixed(2)));
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/tc_game.png` });

await page.tap('#tpause');
await page.waitForTimeout(300);
console.log('gepauzeerd:', await page.evaluate(() => !window.__game.player.active),
  'overlay:', await page.evaluate(() => getComputedStyle(document.getElementById('overlay')).display));
await page.screenshot({ path: `${out}/tc_pause.png` });

console.log('render', await page.evaluate(() => ({ calls: window.__game.renderer.info.render.calls, tris: window.__game.renderer.info.render.triangles })));
await browser.close();
