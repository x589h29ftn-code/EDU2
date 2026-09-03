// Fotografeert de wijk op verschillende tijden en weertypes.
// Gebruik: node tools/sfeershots.mjs [poort]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const port = process.argv[2] || '8123';
mkdirSync('shots/sfeer', { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 960, height: 560 } });
p.on('pageerror', e => console.log('[pageerror]', e.message));
await p.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await p.waitForFunction(() => window.__game, null, { timeout: 90000 });
await p.evaluate(() => { window.__autoplay = true; document.getElementById('overlay').style.display='none'; document.getElementById('ui').style.display='none'; });
await p.evaluate(() => { const g=window.__game; g.player.pos.set((405-370)/3.26, 0, (1222-1245)/3.26); g.player.yaw=-0.88; g.player.pitch=0.02; });
await p.waitForTimeout(1200);
const beelden = [
  ['ochtend',   7.0, 'helder'],
  ['middag',   13.5, 'helder'],
  ['bewolkt',  13.5, 'bewolkt'],
  ['regen',    13.5, 'regen'],
  ['avond',    20.0, 'helder'],
  ['nacht',    23.0, 'helder'],
  ['natte_nacht', 22.0, 'regen'],
];
for (const [naam, uur, weer] of beelden) {
  await p.evaluate(({ uur, weer }) => { window.__game.sfeer.weer = weer; window.__game.sfeer.uur = uur; }, { uur, weer });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `shots/sfeer/${naam}.png` });
  console.log('  ', naam.padEnd(12), uur + ' uur,', weer);
}
console.log('lampen aan:', await p.evaluate(() => window.__game.scene.children.filter(c => c.isPointLight && c.visible).length));
console.log('regen zichtbaar:', await p.evaluate(() => window.__game.scene.children.some(c => c.isLineSegments && c.visible)));
console.log('render', await p.evaluate(() => ({ calls: window.__game.renderer.info.render.calls, tris: window.__game.renderer.info.render.triangles })));
await b.close();
