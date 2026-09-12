/*
 Foto's van de scheidingen uit de BGT: de vangrail langs de Lemmerweg, de muur
 bij het knooppunt en een spijlenhek langs de waterzuivering.

 Gebruik: python3 -m http.server 8123 &  node tools/scheidingshots.mjs 8123 [map]
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
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });
await page.evaluate(async () => {
  const g = window.__game;
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('ui').style.display = 'none';
  g.player.active = true; g.sfeer.uur = 11.5; g.sfeer.weer = 'helder';
  window.__W = await import('/js/world.js');
  window.__oog = null;
  g.player.__update = g.player.update.bind(g.player);
  g.player.update = function () {
    const a = window.__oog; if (!a) return;
    this.camera.position.set(a.x, a.y, a.z);
    this.camera.rotation.set(0, 0, 0, 'YXZ');
    this.camera.rotation.y = a.yaw; this.camera.rotation.x = a.pitch;
    this.gun.visible = false;
  };
});

const STANDEN = [
  { naam: 'scheiding_vangrail', x: 660, z: 1000, yaw: 3.3, wat: 'de vangrail tussen rijbaan en fietspad' },
  { naam: 'scheiding_hek', x: -745, z: -205, yaw: 1.6, wat: 'het spijlenhek langs de waterzuivering' },
];

for (const s of STANDEN) {
  await page.evaluate(async (a) => {
    const V = await import('/js/viaduct.js');
    window.__oog = { x: a.x, y: V.grondHoogte(a.x, a.z, -Infinity) + 1.7, z: a.z, yaw: a.yaw, pitch: -0.06 };
    window.__W.updateLOD(a.x, a.z);
  }, s);
  await page.waitForTimeout(2400);
  await page.screenshot({ path: `${map}/${s.naam}.png`, timeout: 300000 });
  console.log(`${map}/${s.naam}.png — ${s.wat}`);
}

await browser.close();
