// Maakt testscreenshots van de wereld met headless Chromium (Playwright).
// Gebruik: node tools/screenshot.mjs [poort] [uitvoermap]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const port = process.argv[2] || '8123';
const out = process.argv[3] || 'shots';
mkdirSync(out, { recursive: true });

// Kijkpunten: [px, py] in kaartcoördinaten (zie js/data.js), yaw (rad), pitch, hoogte
const VIEWS = [
  // --- loop door De Wieken, van noord naar zuid ---
  { name: 'w1_noord',   at: [-206, 950],  yaw: -0.10, pitch: 0.0 },
  { name: 'w2_bocht',   at: [-176, 1128], yaw: -0.55, pitch: 0.0 },
  { name: 'w3_park',    at: [-108, 1218], yaw: -0.87, pitch: 0.0 },
  { name: 'w4_windbord',at: [-18, 1338],  yaw: -1.15, pitch: 0.0 },
  { name: 'w5_oost',    at: [120, 1428],  yaw: -1.45, pitch: 0.0 },
  { name: 'w6_terug',   at: [120, 1428],  yaw: 1.70, pitch: 0.0 },
  // --- loop over Molenkrite ---
  { name: 'm1_kruispunt', at: [392, 1232], yaw: -0.88, pitch: 0.0 },
  { name: 'm2_rij',       at: [470, 1170], yaw: -0.88, pitch: 0.0 },
  { name: 'm3_gevel',     at: [500, 1150], yaw: 0.70, pitch: 0.05 },
  { name: 'm4_oostwest',  at: [760, 972],  yaw: -1.55, pitch: 0.0 },
  { name: 'm5_terug',     at: [980, 976],  yaw: 1.59, pitch: 0.0 },
  { name: 'm6_zuid',      at: [302, 1560], yaw: -3.10, pitch: 0.0 },
  // --- maatcontrole: mens naast auto voor een huis ---
  { name: 'maat_auto',  at: [468, 1176], yaw: -2.45, pitch: -0.06 },
  { name: 'maat_deur',  at: [455, 1196], yaw: 0.72, pitch: 0.10 },
  // --- overzicht ---
  { name: 'b1_bovenas', at: [110, 1490], yaw: -3.05, pitch: -0.02 },
  { name: 'b2_kruising', at: [118, 1452], yaw: -1.9, pitch: -0.02 },
  { name: 'w7_gevel', at: [40, 1392], yaw: 1.15, pitch: 0.06 },
  { name: 'overzicht3', at: [700, 1300], yaw: Math.PI * 0.2, pitch: -0.8, h: 160 },
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
