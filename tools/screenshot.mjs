// Maakt testscreenshots van de wereld met headless Chromium (Playwright).
// Gebruik: node tools/screenshot.mjs [poort] [uitvoermap]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const port = process.argv[2] || '8123';
const out = process.argv[3] || 'shots';
mkdirSync(out, { recursive: true });

// Kijkpunten: [px, py] in kaartcoördinaten (zie js/data.js), yaw (rad), pitch, hoogte
const VIEWS = [
  { name: 'mk_start',  at: [405, 1222], yaw: -0.88, pitch: 0.0 },
  { name: 'mk_mid',    at: [480, 1160], yaw: -0.88, pitch: 0.02 },
  { name: 'mk_rechts', at: [470, 1178], yaw: 0.70, pitch: 0.06 },
  { name: 'mk_links',  at: [500, 1150], yaw: -2.45, pitch: 0.06 },
  { name: 'mk_terug',  at: [620, 1040], yaw: 2.26, pitch: 0.0 },
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
