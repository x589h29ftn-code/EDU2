// Maakt testscreenshots van de wereld met headless Chromium (Playwright).
// Gebruik: node tools/screenshot.mjs [poort] [uitvoermap]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const port = process.argv[2] || '8123';
const out = process.argv[3] || 'shots';
mkdirSync(out, { recursive: true });

// Kijkpunten: [px, py] in kaartcoördinaten (zie js/data.js), yaw (rad), pitch, hoogte
const VIEWS = [
  { name: 'molenkrite', at: [430, 1205], yaw: Math.PI * 0.72, pitch: -0.02 },
  { name: 'kruispunt', at: [370, 1245], yaw: Math.PI * 1.55, pitch: 0 },
  { name: 'monnikmolen', at: [300, 900], yaw: Math.PI * 1.55 + 0.6, pitch: 0 },
  { name: 'kruirad', at: [110, 1100], yaw: Math.PI * 0.5, pitch: 0 },
  { name: 'dewieken', at: [-190, 1080], yaw: Math.PI, pitch: 0 },
  { name: 'jasker', at: [800, 1490], yaw: Math.PI * 0.5, pitch: 0 },
  { name: 'bonkelaar', at: [780, 1808], yaw: Math.PI * 0.5, pitch: 0 },
  { name: 'overzicht', at: [500, 1200], yaw: Math.PI * 0.85, pitch: -0.9, h: 180 },
  { name: 'overzicht2', at: [200, 1500], yaw: Math.PI * 1.3, pitch: -0.75, h: 140 },
  { name: 'overzicht3', at: [700, 1300], yaw: Math.PI * 0.2, pitch: -0.8, h: 160 },
  { name: 'parkje', at: [-108, 1218], yaw: -0.87, pitch: -0.02 },
  { name: 'parkje2', at: [-60, 1180], yaw: -1.5, pitch: -0.02 },
  { name: 'wieken_tuin', at: [-196, 1010], yaw: 0.06, pitch: -0.05 },
  { name: 'voortuin', at: [452, 1188], yaw: -2.5, pitch: -0.08 },
  { name: 'kaart', at: [405, 1222], yaw: -0.88, pitch: 0, map: true },
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
