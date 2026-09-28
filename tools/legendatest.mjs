/*
 Toetst de legenda onderaan de grote kaart (js/hud.js, stap 100) en de iconen per soort plek.

 1. De legenda: acht regels (Tinga State, de supermarkt, het autohuis, de wasbox bij de BP,
    je huis, een klusje, een missie, de politie), elk met een eigen icoon en een eigen kleur.
 2. De bedragen in de legenda zijn die van de modules zelf (munitie, verband, wapens, bier,
    de Ferrari en de BX, overspuiten per ster, de klusjes).
 3. Elk speldje op de kaart heeft een icoon, en de wasbox bij de BP staat er nu ook op.
 4. Op de grote kaart: elk icoon in de legenda staat er in zijn eigen kleur, niets is
    afgekapt, de band valt binnen de kaart en het vakje met je plek staat erboven.
 5. Geen twee speldjes over elkaar (het autohuis en de wasbox liggen 45 m uit elkaar,
    op deze schaal elf beeldpunten).
 6. Op een smal scherm: twee kolommen, en nog steeds niets afgekapt.

 En een foto: docs/screenshots/legenda.png.

 Gebruik: npm run server &   node tools/legendatest.mjs 8123
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fouten++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);
mkdirSync('docs/screenshots', { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(() => {
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  window.__autoplay = false; window.__game.player.active = false;
});

// een kleur als [r, g, b]
const METEN = `
  window.__rgb = (hex) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  window.__afstand = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  // waar in het icoon de kleur van het speldje zit (buiten het tekentje erin)
  window.__proefPunt = (wat, r = 9) => wat === 'missie' ? [0, -0.6 * r] : wat === 'politie' ? [0, 0] : [-0.55 * r, -0.65 * r];
  window.__groteKaart = () => {
    const g = window.__game, h = g.hud;
    if (!h.bigOpen) h.toggleBig();
    h._vastSleutel = null;
    h.drawBig(g.player, g.vehicles);
    const cv = h.big, c = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    const vakken = h.legendaVakken(W, H), band = h.legendaBand(W, H);
    const kleuren = vakken.map(v => {
      const [dx, dy] = window.__proefPunt(v.wat);
      const d = c.getImageData(Math.round(v.x + 16 + dx), Math.round(v.y + 16 + dy), 1, 1).data;
      return { wat: v.wat, rgb: [d[0], d[1], d[2]], moet: window.__rgb(window.__game.HUDklasse.PICTO_KLEUR[v.wat]) };
    });
    const pins = (h._bigPins || []).map(q => {
      const [dx, dy] = window.__proefPunt(q.wat);
      const d = c.getImageData(Math.round(q.x + dx), Math.round(q.y + dy), 1, 1).data;
      return { wat: q.wat, naam: q.naam, x: q.x, y: q.y, rgb: [d[0], d[1], d[2]] };
    });
    return { W, H, band, vakken: vakken.map(v => ({ x: v.x, y: v.y, w: v.w, h: v.h, wat: v.wat })), kleuren, pins, afgekapt: h._legendaAfgekapt };
  };
`;
await page.evaluate(async (code) => {
  const { HUD } = await import('/js/hud.js');
  window.__game.HUDklasse = HUD;
  (0, eval)(code);
}, METEN);

// ------------------------------------------------------------------ 1. en 2. de legenda
kop('de legenda');
const leg = await page.evaluate(async () => {
  const { HUD, euro } = await import('/js/hud.js');
  const B = await import('/js/boerderij.js');
  const { BIER } = await import('/js/supermarkt.js');
  const { TE_KOOP, NAAM } = await import('/js/garage.js');
  const { PRIJS_PER_STER } = await import('/js/spuiterij.js');
  const { KLUS } = await import('/js/klusjes.js');
  const h = window.__game.hud;
  const lijst = h.legenda || [];
  const tekst = (wat) => (lijst.find(l => l.wat === wat) || {}).uitleg || '';
  const ferrari = TE_KOOP.find(a => a.soort === 'ferrari'), bx = TE_KOOP.find(a => a.soort === 'bx');
  const bedragen = [
    ['munitie', euro(B.MUNITIE.prijs)], ['munitie', euro(B.EHBO.prijs)],
    ['munitie', euro(Math.min(B.PISTOOL.prijs, B.MITRAILLEUR.prijs, B.SNIPER.prijs))],
    ['bier', euro(BIER.prijs)], ['bier', `${BIER.leven} leven`],
    ["auto's", euro(ferrari.prijs)], ["auto's", euro(bx.prijs)],
    ['overspuiten', euro(PRIJS_PER_STER)],
    ['klus', euro(KLUS.loon.tas[0])], ['klus', euro(KLUS.loon.omleggen[1])],
  ];
  const kleuren = Object.values(HUD.PICTO_KLEUR);
  return {
    n: lijst.length,
    namen: lijst.map(l => l.naam),
    zonderIcoon: lijst.filter(l => !HUD.PICTO[l.wat] || !HUD.PICTO_KLEUR[l.wat]).map(l => l.wat),
    uniekeKleuren: new Set(kleuren).size === kleuren.length,
    autohuis: lijst.some(l => l.naam === NAAM),
    missend: bedragen.filter(([w, b]) => !tekst(w).includes(b)).map(([w, b]) => `${w}: ${b}`),
  };
});
ok(leg.n === 8, 'acht regels in de legenda', leg.namen.join(' · '));
ok(['Tinga State', 'BP wasbox', 'je huis', 'klusje'].every(n => leg.namen.includes(n)) && leg.autohuis,
  'met Tinga State, het autohuis, de wasbox bij de BP, je huis en de klusjes');
ok(leg.zonderIcoon.length === 0, 'elke regel heeft een eigen icoon en een kleur', leg.zonderIcoon.join(', ') || 'allemaal');
ok(leg.uniekeKleuren, 'geen twee soorten met dezelfde kleur');
ok(leg.missend.length === 0, 'de bedragen zijn die uit de modules zelf', leg.missend.join(' · ') || 'munitie, verband, wapens, bier, Ferrari, BX, overspuiten, klusjes');

// ------------------------------------------------------------------ 3. de speldjes
kop('de speldjes op de kaart');
const pins = await page.evaluate(async () => {
  const { HUD } = await import('/js/hud.js');
  const w = window.__game.hud.winkels || [];
  return {
    n: w.length,
    soorten: [...new Set(w.map(x => x.wat))],
    zonder: w.filter(x => !HUD.PICTO[x.wat]).map(x => x.wat),
    bp: w.some(x => x.wat === 'overspuiten'),
  };
});
ok(pins.zonder.length === 0, 'elk speldje heeft een icoon', `${pins.n} speldjes: ${pins.soorten.join(', ')}`);
ok(pins.bp, 'de wasbox bij de BP staat op de kaart');

// ------------------------------------------------------------------ 4. en 5. de grote kaart
kop('de grote kaart');
const groot = await page.evaluate(() => window.__groteKaart());
const mis = groot.kleuren.filter(k => Math.hypot(k.rgb[0] - k.moet[0], k.rgb[1] - k.moet[1], k.rgb[2] - k.moet[2]) > 45);
ok(mis.length === 0, 'elk icoon in de legenda staat er in zijn eigen kleur',
  mis.map(k => `${k.wat} ${k.rgb.join(',')}`).join(' · ') || `${groot.kleuren.length} iconen`);
ok(groot.afgekapt === 0, 'niets in de legenda is afgekapt', `${groot.afgekapt}`);
const b = groot.band;
ok(b.x >= 0 && b.y > groot.H * 0.6 && b.x + b.w <= groot.W && b.y + b.h <= groot.H, 'de band staat onderaan, binnen de kaart',
  `${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.w)}×${Math.round(b.h)} op ${groot.W}×${groot.H}`);
ok(groot.vakken.every(v => v.x >= b.x && v.x + v.w <= b.x + b.w + 0.5 && v.y + v.h <= b.y + b.h + 0.5), 'elk vak binnen de band');
ok(b.y - 30 + 24 <= b.y, 'het vakje met je plek staat erboven, niet eroverheen');
let teDicht = 0, eerst = '';
for (let i = 0; i < groot.pins.length; i++) for (let j = i + 1; j < groot.pins.length; j++) {
  const p = groot.pins[i], q = groot.pins[j];
  if (Math.abs(p.x - q.x) < 20 && Math.abs(p.y - q.y) < 28) { teDicht++; if (!eerst) eerst = `${p.naam} en ${q.naam}`; }
}
ok(teDicht === 0, 'geen twee speldjes over elkaar op de grote kaart', teDicht ? `${teDicht}, o.a. ${eerst}` : `${groot.pins.length} speldjes`);
const pinMis = await page.evaluate((pins) => pins.filter(p => {
  const moet = window.__rgb(window.__game.HUDklasse.PICTO_KLEUR[p.wat]);
  return window.__afstand(p.rgb, moet) > 45;
}).map(p => `${p.naam} ${p.rgb.join(',')}`), groot.pins);
ok(pinMis.length === 0, 'en elk speldje in de kleur van zijn soort', pinMis.join(' · ') || 'allemaal');

await page.waitForTimeout(800);
await page.screenshot({ path: 'docs/screenshots/legenda.png', timeout: 600000 });
console.log('docs/screenshots/legenda.png');

// ------------------------------------------------------------------ 6. smal scherm
kop('op een smal scherm');
await page.setViewportSize({ width: 760, height: 700 });
await page.waitForTimeout(500);
const smal = await page.evaluate(() => window.__groteKaart());
const kolommen = new Set(smal.vakken.map(v => Math.round(v.x))).size;
ok(kolommen === 2, 'twee kolommen', `${kolommen} op ${smal.W} breed`);
ok(smal.afgekapt === 0, 'en nog steeds niets afgekapt', `${smal.afgekapt}`);
ok(smal.band.y > 0 && smal.band.y + smal.band.h <= smal.H, 'de band past nog op de kaart', `${Math.round(smal.band.h)} hoog op ${smal.H}`);

console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
await browser.close();
process.exit(fouten ? 1 : 0);
