// Bovenaanzicht van het spel op exact dezelfde omhullende en schaal als de
// kaartplaat (data/geo/bgt-plaat.png), plus de vergelijking daarmee.
//
//   node tools/geo/bovenaanzicht.mjs [poort] [schaal]
//
// Maakt:
//   data/geo/spel-plaat.png       spel in egale klassekleuren (?boven=1&plat=1)
//   data/geo/spel-boven.png       spel zoals het er echt uitziet, van boven
//   data/geo/verschil.png         rood waar kaartplaat en spel van klasse verschillen
// en drukt het percentage afwijkende pixels af. Vereist een draaiende
// webserver op de poort (python3 -m http.server 8123) en Playwright.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HIER = dirname(fileURLToPath(import.meta.url));
const GEO = join(HIER, '..', '..', 'data', 'geo');
const poort = process.argv[2] || '8123';
const schaal = Number(process.argv[3] || 4);

// kale kaartplaat (zonder tekst en markeringen) op dezelfde schaal
execFileSync('node', [join(HIER, 'plaat.mjs'), String(schaal), '--kaal'], { stdio: 'inherit' });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function opname(plat, uit) {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const fouten = [];
  page.on('pageerror', e => fouten.push(e.message));
  page.on('console', m => { if (m.type() === 'error') fouten.push(m.text()); });
  await page.goto(`http://127.0.0.1:${poort}/index.html?boven=1&schaal=${schaal}${plat ? '&plat=1' : ''}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__boven, null, { timeout: 180000 });
  // twee keer: de eerste keer laadt de GPU de texturen en schaduwen, de tweede levert het beeld
  await page.evaluate(() => window.__boven());
  await page.waitForTimeout(500);
  const { W, H, png } = await page.evaluate(() => window.__boven());
  writeFileSync(uit, Buffer.from(png.split(',')[1], 'base64'));
  console.log(`${uit}: ${W}×${H} px${fouten.length ? `, fouten: ${fouten.join(' | ')}` : ''}`);
  await page.close();
  return { W, H };
}

const spelPlat = join(GEO, 'spel-plaat.png');
const spelBoven = join(GEO, 'spel-boven.png');
const { W, H } = await opname(true, spelPlat);
await opname(false, spelBoven);

// Vergelijking in de browser (canvas), zonder extra pakketten.
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
const plaat = readFileSync(join(GEO, 'bgt-plaat-kaal.png')).toString('base64');
const spel = readFileSync(spelPlat).toString('base64');
const uitkomst = await page.evaluate(async ({ plaat, spel, W, H }) => {
  const laad = (b64) => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.src = 'data:image/png;base64,' + b64; });
  const [A, B] = await Promise.all([laad(plaat), laad(spel)]);
  const cv = (im) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.drawImage(im, 0, 0, W, H); return x.getImageData(0, 0, W, H).data; };
  const a = cv(A), b = cv(B);
  const uit = document.createElement('canvas'); uit.width = W; uit.height = H;
  const ctx = uit.getContext('2d'); const img = ctx.createImageData(W, H); const d = img.data;
  let anders = 0, totaal = W * H;
  for (let i = 0; i < totaal * 4; i += 4) {
    const dr = Math.abs(a[i] - b[i]), dg = Math.abs(a[i + 1] - b[i + 1]), db = Math.abs(a[i + 2] - b[i + 2]);
    const verschil = dr + dg + db > 60;
    if (verschil) anders++;
    const grijs = Math.round((a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11) * 0.5 + 100);
    d[i] = verschil ? 230 : grijs; d[i + 1] = verschil ? 30 : grijs; d[i + 2] = verschil ? 30 : grijs; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return { anders, totaal, png: uit.toDataURL('image/png').split(',')[1] };
}, { plaat, spel, W, H });
writeFileSync(join(GEO, 'verschil.png'), Buffer.from(uitkomst.png, 'base64'));
const pct = (100 * uitkomst.anders / uitkomst.totaal);
console.log(`verschil kaartplaat ↔ spel (platte klassekleuren): ${pct.toFixed(2)} % van de pixels (${uitkomst.anders} van ${uitkomst.totaal})`);
console.log(`verschilbeeld: ${join(GEO, 'verschil.png')}`);
await browser.close();
process.exit(pct > 5 ? 1 : 0);
