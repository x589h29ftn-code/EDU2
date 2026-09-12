/*
 Foto's van de rotonde in de Lemmerweg die over de N7 heen ligt: de bak van
 onderaf, de brug van dichtbij en het geheel van boven.

 Gebruik: python3 -m http.server 8123 &  node tools/rotondeshots.mjs 8123 [map]
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

// een vrije camera: de speler kan niet in de lucht hangen, deze wel
await page.evaluate(async () => {
  const g = window.__game;
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('ui').style.display = 'none';
  g.player.active = true; g.sfeer.uur = 11.5; g.sfeer.weer = 'helder';
  window.__W = await import('/js/world.js');
  window.__oog = null;
  g.player.__update = g.player.update.bind(g.player);
  g.player.update = function (dt) {
    if (!window.__oog) return this.__update(dt);
    const a = window.__oog;
    this.camera.position.set(a.x, a.y, a.z);
    this.camera.rotation.set(0, 0, 0, 'YXZ');
    this.camera.rotation.y = a.yaw; this.camera.rotation.x = a.pitch;
    this.gun.visible = false;
  };
});

const STANDEN = [
  { naam: 'rotonde_bak', x: 690, z: -150, y: -1.4, yaw: -Math.PI / 2, pitch: 0.02,
    wat: 'de N7 in de bak, met de twee viaducten voor je' },
  { naam: 'rotonde_onderdoor', x: 730, z: -152, y: -3.6, yaw: -Math.PI / 2, pitch: 0.05,
    wat: 'vlak voor de onderdoorgang' },
  { naam: 'rotonde_boven', x: 782, z: -150, y: 150, yaw: 0, pitch: -1.4,
    wat: 'het geheel van boven' },
  { naam: 'rotonde_fietstunnel', x: 748.5, z: -206, oog: 1.6, yaw: Math.PI - 0.12, pitch: -0.05,
    wat: 'het fietspad dat onder de oprit door duikt' },
];

for (const s of STANDEN) {
  await page.evaluate(async (a) => {
    // `oog` betekent: ooghoogte boven de grond, en die ligt hier niet op nul
    if (a.oog !== undefined) {
      const V = await import('/js/viaduct.js');
      a = { ...a, y: V.grondHoogte(a.x, a.z, -Infinity) + a.oog };
    }
    window.__oog = a; window.__W.updateLOD(a.x, a.z);
  }, s);
  await page.waitForTimeout(2400);
  await page.screenshot({ path: `${map}/${s.naam}.png`, timeout: 300000 });
  console.log(`${map}/${s.naam}.png — ${s.wat}`);
}

await browser.close();
