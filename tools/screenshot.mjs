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
  // 52 Molenkrite: het stuk tussen de Jasker-knoop en de aansluiting De Wieken
  { name: 'm52_zw',    at: [332, 1296], yaw: 2.84, pitch: 0.02 },   // langs de Molenkrite naar De Wieken
  { name: 'm52_nw',    at: [332, 1296], yaw: 0.79, pitch: 0.04 },   // over het groen naar het noordwesten
  { name: 'm52_zo',    at: [332, 1296], yaw: -2.4, pitch: 0.02 },   // naar de vijver in het bosje
  { name: 'm52_z',     at: [330, 1370], yaw: 3.05, pitch: 0.02 },   // bij de aansluiting De Wieken
  { name: 'kr_achter', at: [268, 1340], yaw: 0.55, pitch: 0.07 },   // vanaf het gras naar de achtertuinen van het Kruirad
  { name: 'kr_achter2',at: [190, 1332], yaw: 0.15, pitch: 0.07 },
  // luchtfoto's om rechtstreeks met de satellietkaart te vergelijken
  // recht van boven, precies hetzelfde kader als de satellietuitsnede
  // (kaart-px -147..564 in x, 1169..1683 in y)
  { name: 'plan_wieken', at: [209, 1426], yaw: 0, pitch: -1.5708, h: 106, fov: 60 },
  { name: 'mk_start',    at: [405, 1222], yaw: -0.88, pitch: 0.0 },
];

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[browser]', m.text()); });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
await page.evaluate(() => { window.__autoplay = true; document.getElementById('overlay').style.display = 'none'; });
await page.waitForTimeout(1500);
// Een luchtshot (h gezet) zet de camera zelf neer: de speler valt anders naar
// beneden. Daarvoor leggen we player.update tijdelijk stil.
await page.evaluate(() => {
  const g = window.__game;
  g.player.__update = g.player.update.bind(g.player);
  window.__air = null;
  g.player.update = function (dt) {
    if (!window.__air) return this.__update(dt);
    const a = window.__air;
    this.camera.position.set(a.x, a.y, a.z);
    this.camera.rotation.set(0, 0, 0, 'YXZ');
    this.camera.rotation.y = a.yaw; this.camera.rotation.x = a.pitch;
    this.gun.visible = false;
  };
});
for (const v of VIEWS) {
  await page.evaluate(({ at, yaw, pitch, h, map, fov }) => {
    const g = window.__game;
    const PX = 3.26, OX = 370, OY = 1245;
    const x = (at[0] - OX) / PX, z = (at[1] - OY) / PX;
    g.camera.fov = fov || 60; g.camera.updateProjectionMatrix();
    if (h) {
      window.__air = { x, y: h, z, yaw, pitch };
    } else {
      window.__air = null;
      g.player.pos.set(x, 0, z);
      g.player.yaw = yaw; g.player.pitch = pitch; g.player.vy = 0;
      g.player.gun.visible = true;
    }
    g.player.keys = {};
    g.hud.bigOpen = !!map; document.getElementById('bigmap').style.display = map ? 'block' : 'none';
    document.getElementById('ui').style.display = h ? 'none' : 'block';
  }, v);
  await page.waitForTimeout(600);
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
