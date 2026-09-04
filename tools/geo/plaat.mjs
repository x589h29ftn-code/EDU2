// Tekent de brondata uit data/geo/bron als kaartplaat: een SVG op vaste schaal,
// en daarvan een PNG met een world-bestand (.pgw) zodat QGIS hem exact over de
// luchtfoto kan leggen. Dit is de referentie waar het spel tegen wordt
// vergeleken (docs/METHODIEK.md §6).
//
//   node tools/geo/plaat.mjs [px per meter, standaard 4] [--kaal]
//
// Zonder --kaal: de leesbare plaat met straatnamen, huisnummers, oorsprong en
// schaalbalk (bgt-plaat.svg/.png/.pgw). Met --kaal: alleen de vlakken, in
// precies de klassekleuren van het spel (js/kaartkleuren.js) en met dezelfde
// klasse-indeling als tools/geo/genereer.mjs, voor de pixelvergelijking met
// het bovenaanzicht van het spel (bgt-plaat-kaal.png).
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { KLEUR as K } from '../../js/kaartkleuren.js';

const HIER = dirname(fileURLToPath(import.meta.url));
const GEO = join(HIER, '..', '..', 'data', 'geo');
const argv = process.argv.slice(2).filter(a => !a.startsWith('--'));
const SCHAAL = Number(argv[0] || 4); // px per meter
const KAAL = process.argv.includes('--kaal');

const gebied = JSON.parse(readFileSync(join(GEO, 'gebied.geojson'), 'utf8'));
const B = (() => { const b = [Infinity, Infinity, -Infinity, -Infinity]; const loop = (a) => { if (typeof a[0] === 'number') { b[0] = Math.min(b[0], a[0]); b[1] = Math.min(b[1], a[1]); b[2] = Math.max(b[2], a[0]); b[3] = Math.max(b[3], a[1]); } else for (const c of a) loop(c); }; for (const f of gebied.features) loop(f.geometry.coordinates); return b; })();
const W = Math.round((B[2] - B[0]) * SCHAAL), H = Math.round((B[3] - B[1]) * SCHAAL);
const X = (x) => ((x - B[0]) * SCHAAL).toFixed(1);
const Y = (y) => ((B[3] - y) * SCHAAL).toFixed(1);

const laag = (naam) => { const p = join(GEO, 'bron', naam + '.geojson'); return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')).features : []; };

function pad(g) {
  const ringen = (poly) => poly.map(r => 'M' + r.map(([x, y]) => `${X(x)} ${Y(y)}`).join('L') + 'Z').join('');
  if (g.type === 'Polygon') return ringen(g.coordinates);
  if (g.type === 'MultiPolygon') return g.coordinates.map(ringen).join('');
  if (g.type === 'LineString') return 'M' + g.coordinates.map(([x, y]) => `${X(x)} ${Y(y)}`).join('L');
  return '';
}

const uit = [];
const teken = (features, kleurVan, opties = '') => {
  for (const f of features) { const d = pad(f.geometry); if (d) uit.push(`<path d="${d}" fill="${kleurVan(f.properties)}" ${opties}/>`); }
};

// Klasse-indeling, gelijk aan tools/geo/genereer.mjs
const klasseWeg = (fn) => fn === 'rijbaan autoweg' ? 'autoweg' : fn.startsWith('rijbaan') ? 'rijbaan' : ['woonerf', 'parkeervlak', 'inrit', 'fietspad', 'voetpad', 'spoorbaan'].includes(fn) ? fn : 'verharding';
const klasseGroen = (plus) => plus === 'bosplantsoen' ? 'bos' : plus === 'heesters' ? 'heesters' : (plus === 'bodembedekkers' || plus === 'planten') ? 'bodembedekker' : 'gras';
const klasseKaal = (fy) => fy === 'erf' ? 'erf' : fy === 'zand' ? 'zand' : fy === 'gesloten verharding' ? 'asfaltvlak' : fy === 'half verhard' ? 'halfverhard' : 'verharding';

uit.push(`<rect width="${W}" height="${H}" fill="${K.achtergrond}"/>`);
teken(laag('bgt_onbegroeidterreindeel'), p => K[klasseKaal(p.bgt_fysiekVoorkomen)]);
teken(laag('bgt_begroeidterreindeel'), p => K[klasseGroen(p.plus_fysiekVoorkomen)]);
teken(laag('bgt_ondersteunendwegdeel'), () => K.berm);
teken(laag('bgt_ondersteunendwaterdeel'), () => K.oever);
teken(laag('bgt_waterdeel'), () => K.water);
const wegen = laag('bgt_wegdeel');
teken(wegen, p => K[klasseWeg(p.function)]);
if (!KAAL) teken(wegen.filter(p => p.properties.function?.startsWith('rijbaan') && p.properties.surfaceMaterial === 'gesloten verharding'), () => '#777');
teken(laag('bgt_overbruggingsdeel'), () => K.brug);
teken(laag('bgt_kunstwerkdeel').filter(f => f.geometry.type !== 'LineString'), () => K.steiger);
teken(laag('bgt_overigbouwwerk').filter(f => f.geometry.type !== 'LineString'), () => K.bouwwerk);
const bag3d = new Set(laag('bag3d_pand').map(f => String(f.properties.identificatie).replace('NL.IMBAG.Pand.', '')));
teken(laag('bgt_pand'), p => (!KAAL && !bag3d.has(String(p.identificatieBAGPND))) ? K.pandSchatting : K.pand, KAAL ? '' : 'stroke="#5a2418" stroke-width="0.6"');
teken(laag('bgt_vegetatieobject'), () => K.haag, KAAL ? '' : 'stroke="#2b5a28" stroke-width="0.6"');

if (!KAAL) {
  for (const f of laag('bgt_scheiding')) { const d = pad(f.geometry); if (d) uit.push(`<path d="${d}" fill="none" stroke="#444" stroke-width="1"/>`); }
  // huisnummers en straatnamen
  for (const f of laag('bgt_pand')) for (const n of f.properties.huisnummers || []) {
    uit.push(`<text x="${X(n.pos[0])}" y="${Y(n.pos[1])}" font-size="${(2.2 * SCHAAL).toFixed(1)}" fill="#fff" text-anchor="middle" dominant-baseline="middle" font-family="Arial" transform="rotate(${-n.hoek} ${X(n.pos[0])} ${Y(n.pos[1])})">${n.tekst}</text>`);
  }
  for (const f of laag('bgt_openbareruimtelabel')) {
    const [x, y] = f.geometry.coordinates;
    uit.push(`<text x="${X(x)}" y="${Y(y)}" font-size="${(4.5 * SCHAAL).toFixed(1)}" fill="#1c1c1c" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-weight="bold" transform="rotate(${-f.properties.hoek} ${X(x)} ${Y(y)})" stroke="#fff" stroke-width="${(0.6 * SCHAAL).toFixed(1)}" paint-order="stroke">${f.properties.tekst}</text>`);
  }
  // oorsprong, schaalbalk, noordpijl
  const oorsprongPad = join(GEO, 'oorsprong.json');
  if (existsSync(oorsprongPad)) {
    const o = JSON.parse(readFileSync(oorsprongPad, 'utf8'));
    const [x, y] = o.rd;
    uit.push(`<circle cx="${X(x)}" cy="${Y(y)}" r="${3 * SCHAAL}" fill="none" stroke="#e6007e" stroke-width="${SCHAAL}"/><line x1="${X(x - 8)}" y1="${Y(y)}" x2="${X(x + 8)}" y2="${Y(y)}" stroke="#e6007e" stroke-width="${SCHAAL / 2}"/><line x1="${X(x)}" y1="${Y(y - 8)}" x2="${X(x)}" y2="${Y(y + 8)}" stroke="#e6007e" stroke-width="${SCHAAL / 2}"/>`);
  }
  const sx = 20 * SCHAAL, sy = H - 20 * SCHAAL;
  uit.push(`<rect x="${sx}" y="${sy}" width="${100 * SCHAAL}" height="${2 * SCHAAL}" fill="#000"/><text x="${sx}" y="${sy - SCHAAL}" font-size="${6 * SCHAAL}" font-family="Arial">100 m</text>`);
  uit.push(`<text x="${W - 20 * SCHAAL}" y="${20 * SCHAAL}" font-size="${8 * SCHAAL}" font-family="Arial" text-anchor="middle">N ↑</text>`);
  uit.push(`<text x="${sx}" y="${8 * SCHAAL}" font-size="${5 * SCHAAL}" font-family="Arial">BGT + 3D BAG, Tinga (Sneek) · RD X ${B[0]}–${B[2]}, Y ${B[1]}–${B[3]} · ${SCHAAL} px/m · donkerrood = pand met 3D BAG-model, roze kruis = oorsprong spelwereld</text>`);
}

const naam = KAAL ? 'bgt-plaat-kaal' : 'bgt-plaat';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" shape-rendering="${KAAL ? 'crispEdges' : 'auto'}">${uit.join('\n')}</svg>`;
const svgPad = join(GEO, naam + '.svg');
writeFileSync(svgPad, svg);
// world-bestand: pixelgrootte, rotatie, en het middelpunt van de pixel linksboven
writeFileSync(join(GEO, naam + '.pgw'), `${1 / SCHAAL}\n0\n0\n${-1 / SCHAAL}\n${B[0] + 0.5 / SCHAAL}\n${B[3] - 0.5 / SCHAAL}\n`);
console.log(`SVG ${W}×${H} px geschreven: ${svgPad} (${(svg.length / 1e6).toFixed(1)} MB)`);

// PNG op exact W×H. Met Playwright (npm install) via een viewport van precies
// die maat; zonder Playwright via de Chromium-opdrachtregel, die het venster
// iets te klein afdrukt (de onderste rijen ontbreken dan).
const chrome = process.env.CHROME_PATH || (() => {
  const basis = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!existsSync(basis)) return null;
  const d = readdirSync(basis).find(n => /^chromium-\d+$/.test(n));
  return d ? join(basis, d, 'chrome-linux', 'chrome') : null;
})();
const png = join(GEO, naam + '.png');
let klaar = false;
try {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ executablePath: chrome || undefined });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.goto('file://' + svgPad);
  await page.screenshot({ path: png, clip: { x: 0, y: 0, width: W, height: H } });
  await browser.close();
  klaar = true;
} catch (e) { console.log('Playwright niet beschikbaar (' + e.message.split('\n')[0] + '), Chromium-opdrachtregel gebruikt'); }
if (!klaar && chrome && existsSync(chrome)) {
  execFileSync(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', `--screenshot=${png}`, `--window-size=${W},${H + 100}`, 'file://' + svgPad], { stdio: 'ignore' });
  klaar = true;
}
if (klaar) console.log(`PNG geschreven: ${png} met world-bestand ${naam}.pgw`);
else console.log('geen Chromium gevonden; zet CHROME_PATH of open de SVG in een browser');
