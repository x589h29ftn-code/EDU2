// Maakt testscreenshots van de wereld met headless Chromium (Playwright).
// Gebruik: node tools/screenshot.mjs [poort] [uitvoermap]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const port = process.argv[2] || '8123';
const out = process.argv[3] || 'shots';
mkdirSync(out, { recursive: true });

// Kijkpunten: [px, py] in kaartcoördinaten (zie js/data.js), yaw (rad), pitch, hoogte
// yaw 0 = naar het noorden, +pi/2 = naar het westen, -pi/2 = naar het oosten
const VIEWS = [
  { name: 'dw_in',     at: [290, 1458], yaw: 1.44, pitch: 0.02 },   // De Wieken in, naar het westen
  { name: 'dw_mid',    at: [180, 1443], yaw: 1.44, pitch: 0.02 },
  { name: 'dw_noord',  at: [180, 1443], yaw: 0.35, pitch: 0.06 },   // noordzijde: hoort groen te zijn
  { name: 'dw_west',   at: [60, 1392],  yaw: 1.30, pitch: 0.02 },
  { name: 'dw_terug',  at: [60, 1392],  yaw: -1.45, pitch: 0.02 },  // terug naar het oosten
  { name: 'mk_start',  at: [405, 1222], yaw: -0.88, pitch: 0.0 },
  { name: 'mk_mid',    at: [480, 1160], yaw: -0.88, pitch: 0.02 },
];

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[browser]', m.text()); });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
await page.evaluate(() => { window.__autoplay = true; document.getElementById('overlay').style.display = 'none'; });
await page.waitForTimeout(1500);
for (const v of VIEWS) {
  await page.evaluate(({ at, yaw, pitch, h, map }) => {
    const g = window.__game;
    const PX = 3.26, OX = 370, OY = 1245;
    g.player.pos.set((at[0] - OX) / PX, h || 0, (at[1] - OY) / PX);
    g.player.yaw = yaw; g.player.pitch = pitch; g.player.vy = 0;
    if (h) { g.player.eye = 1.7; g.player.pos.y = h; }
    g.player.keys = {};
    window.__freeze = !!h;
    g.hud.bigOpen = !!map; document.getElementById('bigmap').style.display = map ? 'block' : 'none';
  }, v);
  // zwaartekracht uitzetten voor overzichtsshots door positie herhaald te zetten
  await page.waitForTimeout(400);
  if (v.h) await page.evaluate(({ at, h }) => { const g = window.__game; const PX = 3.26; g.player.pos.y = h; g.player.vy = 0; }, v);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/${v.name}.png` });
  console.log('shot', v.name);
}
const stats = await page.evaluate(() => {
  const bad = [];
  window.__game.scene.traverse(o => { if (o.isMesh) { o.geometry.computeBoundingSphere(); if (!isFinite(o.geometry.boundingSphere.radius)) bad.push(`${o.geometry.type} n=${o.geometry.attributes.position.count} y=${o.geometry.attributes.position.array[1]} first=${Array.from(o.geometry.attributes.position.array.slice(0, 12)).map(v => v.toFixed(2)).join(',')}`); } });
  return { calls: window.__game.renderer.info.render.calls, tris: window.__game.renderer.info.render.triangles, nanGeoms: bad };
});
console.log('render stats', stats);
await browser.close();
