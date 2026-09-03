// Meet een dwarsdoorsnede door de wijk: loopt langs een lijn in kaartpixels en
// zegt om de halve meter wat daar ligt (gras, tegels, klinkers, water, gebouw).
// Zo is te controleren hoe breed een groenstrook werkelijk is.
//
//   node tools/meetstrook.mjs 8123 '[[250,1270],[250,1470]]'
import { chromium } from 'playwright';

const port = process.argv[2] || '8123';
const [van, naar] = JSON.parse(process.argv[3] || '[[250,1270],[250,1470]]');

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 60000 });

const stukken = await page.evaluate(async ({ van, naar }) => {
  const w = await import('./js/world.js');
  const d = await import('./js/data.js');
  const [ax, az] = d.toWorld(van[0], van[1]);
  const [bx, bz] = d.toWorld(naar[0], naar[1]);
  const lengte = Math.hypot(bx - ax, bz - az);
  const ux = (bx - ax) / lengte, uz = (bz - az) / lengte;
  const uit = [];
  let vorig = null, begin = 0;
  for (let s = 0; s <= lengte; s += 0.25) {
    const x = ax + ux * s, z = az + uz * s;
    const bezet = w.vrijeObjectPlek(x, z);           // 'gebouw' | 'rijbaan' | 'water' | null
    const soort = bezet === 'gebouw' ? 'gebouw' : bezet === 'water' ? 'water'
      : bezet === 'rijbaan' ? 'rijbaan' : w.ondergrondOp(x, z);
    if (soort !== vorig) {
      if (vorig !== null) uit.push([vorig, +(s - begin).toFixed(1)]);
      vorig = soort; begin = s;
    }
  }
  uit.push([vorig, +(lengte - begin).toFixed(1)]);
  return uit;
}, { van, naar });

console.log(`doorsnede ${van} -> ${naar}`);
for (const [soort, m] of stukken) console.log(`  ${String(soort).padEnd(8)} ${m} m`);
await browser.close();
