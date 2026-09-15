/*
 Een kleine JPEG van een grote controleplaat, voor in de README.

   npm run server &   node tools/geo/verkleinplaat.mjs [poort] [bron] [doel] [breedte]

 Waarom dit er is. `npm run geo:boven` schrijft `data/geo/spel-boven.png`: het
 hele spel van boven, 8760 × 5000 px en zesenveertig megabyte. Dat is precies wat
 je wilt om pixel voor pixel mee te vergelijken, en precies wat je niet wilt in
 een git-geschiedenis — hij wordt bij élke controle opnieuw geschreven en stond
 eenenveertig keer in de repo, samen bijna twee gigabyte. De plaat zelf hoort dus
 niet in versiebeheer (zie .gitignore); wat er wél in hoort is een afbeelding van
 een paar honderd kilobyte om in de README te laten zien hoe het eruitziet.

 Verkleinen gebeurt op een canvas in de browser, net als al het andere
 beeldwerk hier: er zitten geen beeldpakketten in dit project.
*/
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HIER, '..', '..');

const poort = process.argv[2] || '8123';
const bron = process.argv[3] || 'data/geo/spel-boven.png';
const doel = process.argv[4] || 'docs/spel-van-boven.jpg';
const breedte = Number(process.argv[5] || 2200);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'domcontentloaded', timeout: 300000 });
const jpg = await page.evaluate(async ([src, breed]) => {
  const im = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('kan ' + src + ' niet laden'));
    i.src = src;
  });
  const c = document.createElement('canvas');
  c.width = breed;
  c.height = Math.round(im.naturalHeight / im.naturalWidth * breed);
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(im, 0, 0, c.width, c.height);
  return { data: c.toDataURL('image/jpeg', 0.86), w: c.width, h: c.height, bronW: im.naturalWidth, bronH: im.naturalHeight };
}, [`http://127.0.0.1:${poort}/${bron}`, breedte]);

const buf = Buffer.from(jpg.data.split(',')[1], 'base64');
writeFileSync(join(ROOT, doel), buf);
console.log(`${bron} (${jpg.bronW}×${jpg.bronH}) → ${doel} (${jpg.w}×${jpg.h}, ${(buf.length / 1048576).toFixed(2)} MB)`);
await browser.close();
