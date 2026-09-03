// Losse kijkpunten voor een review. Geef ze mee als JSON op de opdrachtregel:
//   node tools/reviewshots.mjs 8123 shots/review '[{"name":"a","at":[400,1200],"yaw":0.6}]'
// Velden: name, at [px,py], yaw (rad, 0 = noord), pitch, h (luchtfoto), fov
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const port = process.argv[2] || '8123';
const out = process.argv[3] || 'shots/review';
const VIEWS = JSON.parse(process.argv[4]);
mkdirSync(out, { recursive: true });

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
    if (h) { window.__air = { x, y: h, z, yaw, pitch: pitch ?? -1.5708 }; }
    else {
      window.__air = null;
      g.player.pos.set(x, 0, z);
      g.player.yaw = yaw; g.player.pitch = pitch || 0; g.player.vy = 0;
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
