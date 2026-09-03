// Screenshots van het kruispunt Molenkrite / Monnikmolen / Jasker, vanaf
// dezelfde standpunten als de Street View-foto's. Zo is een-op-een te
// vergelijken of de verhoudingen en het wegverloop kloppen.
// Gebruik: node tools/kruisshots.mjs [poort] [uitvoermap]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const port = process.argv[2] || '8123';
const out = process.argv[3] || 'shots/kruispunt';
mkdirSync(out, { recursive: true });

// [px, py] kaartcoordinaten, yaw 0 = noord, +pi/2 = west, -pi/2 = oost
const VIEWS = [
  // foto 1: op het plateau, noordwaarts de Monnikmolen in
  { name: '1_monnikmolen_noord', at: [379, 1259], yaw: 0.62, pitch: -0.02 },
  // foto 2: op het kruispunt, noordoostwaarts de Molenkrite in
  { name: '2_molenkrite_noordoost', at: [372, 1252], yaw: -0.97, pitch: -0.02 },
  // foto 3: op het voetpad aan de noordwestzijde van de Molenkrite
  { name: '3_voetpad_molenkrite', at: [432, 1172], yaw: -0.79, pitch: -0.03 },
  // foto 4: vanaf de Monnikmolen het Kruirad in
  { name: '4_kruirad', at: [252, 931], yaw: 2.05, pitch: -0.02 },
  // extra: het kruispunt van bovenaf, om de plateauvorm te beoordelen
  { name: '5_plan_kruispunt', at: [370, 1245], yaw: 0, pitch: -1.5708, h: 70, fov: 60 },
  { name: '6_schuin_kruispunt', at: [300, 1360], yaw: -0.55, pitch: -0.55, h: 26, fov: 62 },
];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1180, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
await page.evaluate(() => { window.__autoplay = true; document.getElementById('overlay').style.display = 'none'; });
await page.waitForTimeout(1500);
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
  await page.evaluate(({ at, yaw, pitch, h, fov }) => {
    const g = window.__game;
    const PX = 3.26, OX = 370, OY = 1245;
    const x = (at[0] - OX) / PX, z = (at[1] - OY) / PX;
    g.camera.fov = fov || 62; g.camera.updateProjectionMatrix();
    if (h) { window.__air = { x, y: h, z, yaw, pitch }; }
    else {
      window.__air = null;
      g.player.pos.set(x, 0, z);
      g.player.yaw = yaw; g.player.pitch = pitch; g.player.vy = 0;
      g.player.gun.visible = false;
    }
    g.player.keys = {};
    document.getElementById('ui').style.display = 'none';
  }, v);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/${v.name}.png` });
  console.log('shot', v.name);
}
await browser.close();
