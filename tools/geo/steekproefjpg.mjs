/*
 De steekproeffoto's van PNG naar JPEG.

   npm run server &   node tools/geo/steekproefjpg.mjs [poort] [map] [kwaliteit]

 Waarom. Een ronde steekproef is eenentachtig schermafdrukken van 1280 × 720. Als
 PNG is dat tweeënzestig megabyte, en elke ronde komt daar opnieuw bij in de
 git-geschiedenis — na een stuk of tien rondes is dat meer dan het hele spel. Het
 zijn foto's van een 3D-beeld met lucht, gras en baksteen erop: precies het soort
 plaatje waar JPEG voor gemaakt is. Op kwaliteit 82 gaat er ruim tachtig procent
 af en zie je aan een gevel niets terug.

 Verkleinen gebeurt op een canvas in de browser, net als al het andere beeldwerk
 hier: er zitten geen beeldpakketten in dit project.

 Wat het doet: elke .png in de map wordt een .jpg, de verwijzingen in de
 README.md van die map gaan mee, en de PNG's worden weggegooid. Hij is veilig
 opnieuw te draaien — wat al omgezet is wordt overgeslagen.
*/
import { chromium } from 'playwright';
import { readdirSync, readFileSync, writeFileSync, unlinkSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HIER, '..', '..');

const poort = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/steekproef';
const kwaliteit = Number(process.argv[4] || 0.82);

const volledig = join(ROOT, map);
const pngs = readdirSync(volledig).filter(n => n.toLowerCase().endsWith('.png'));
if (!pngs.length) { console.log(`geen PNG's in ${map} — niets te doen`); process.exit(0); }

const voor = pngs.reduce((n, f) => n + statSync(join(volledig, f)).size, 0);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'domcontentloaded', timeout: 300000 });

let na = 0;
for (const naam of pngs) {
  const jpg = await page.evaluate(async ([src, q]) => {
    const im = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('kan ' + src + ' niet laden'));
      i.src = src;
    });
    const c = Object.assign(document.createElement('canvas'), { width: im.width, height: im.height });
    c.getContext('2d').drawImage(im, 0, 0);
    return c.toDataURL('image/jpeg', q).split(',')[1];
  }, [`/${map}/${encodeURIComponent(naam)}`, kwaliteit]);
  const uit = naam.replace(/\.png$/i, '.jpg');
  const bytes = Buffer.from(jpg, 'base64');
  writeFileSync(join(volledig, uit), bytes);
  unlinkSync(join(volledig, naam));
  na += bytes.length;
  console.log(`${naam} -> ${uit}  ${(bytes.length / 1024).toFixed(0)} kB`);
}
await browser.close();

// en de verwijzingen in de README van die map
const readme = join(volledig, 'README.md');
try {
  const tekst = readFileSync(readme, 'utf8');
  const nieuw = tekst.replace(/\.png\)/g, '.jpg)');
  if (nieuw !== tekst) { writeFileSync(readme, nieuw); console.log(`${map}/README.md bijgewerkt`); }
} catch { /* geen README in deze map */ }

const mb = (n) => (n / 1048576).toFixed(1);
console.log(`\n${pngs.length} foto's: ${mb(voor)} MB -> ${mb(na)} MB (${(100 - na / voor * 100).toFixed(0)} % eraf)`);
