/*
 Stap 168: de woningen aan de Molenkrite nog eens nagelopen (npm run molenkritetest). Gevraagd: "Check de Molenkrite
 aangepaste woningen nog eens of dit beter kan." Laadt alleen js/kaart.js en js/textures.js, dus geen heel spel.

   1. de typen: Molenkrite 145–157 (1979, het buurblok op de tweede Street View) zijn `molenkrite_balkon`, 133–143
      blijven `molenkrite_punt`, en verder is er niets van type veranderd;
   2. het balkon: om de woning een witte borstwering op de eerste en tweede verdieping, nooit op de begane grond, en de
      borstwering telt niet als glas (anders brandt hij 's nachts als raam, `nachtRamen`);
   3. de steen van 145–157 is grijsbruin, niet het geelbeige van `molenkrite`;
   4. 133–143: naast het glas in de top een strook beschot, wit of blauw, bij twee van de drie woningen;
   5. de pannen van de aanbouw zijn grijsbruin, niet bijna zwart.

 Gebruik: npm run server &  node tools/molenkritetest.mjs [poort]
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fout = 0;
const ok = (goed, wat, extra = '') => { console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`); if (!goed) fout++; };
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
page.setDefaultTimeout(900000);
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
// een lege pagina op dezelfde plek, zodat de modules te importeren zijn zonder het spel op te starten
await page.goto(`http://127.0.0.1:${poort}/package.json`);
await page.setContent(`<!doctype html><html><head><script type="importmap">{ "imports": { "three": "/lib/three.module.js" } }</script></head><body></body></html>`);

const r = await page.evaluate(async () => {
  const T = await import('/js/textures.js');
  const { KAART } = await import('/js/kaart.js');
  const uit = {};
  const nr = (p) => Math.min(...(p.nr || []).map(n => parseInt(n, 10)).filter(n => !isNaN(n)));
  const mk = KAART.panden.filter(p => p.straat === 'Molenkrite' && p.jaar === 1979);
  uit.balkon = mk.filter(p => nr(p) >= 145 && nr(p) <= 157).map(p => `${nr(p)} ${p.type}`).sort();
  uit.punt = mk.filter(p => nr(p) >= 133 && nr(p) <= 143).map(p => `${nr(p)} ${p.type}`).sort();
  uit.balkonElders = KAART.panden.filter(p => p.type === 'molenkrite_balkon' && !(p.straat === 'Molenkrite' && nr(p) >= 145 && nr(p) <= 157)).length;

  // de doeken: vier woningen breed, drie lagen, voorkant
  const ST = T.HOUSE_STYLES;
  const doek = (type, n, lagen, achter, seed) => { const t = T.facade(type, n, lagen, achter, seed); T.maakAf && T.maakAf(t); return t.image; };
  const isGlas = (r, g, b) => (b - r) > 3 && g >= b * 0.62 && (0.3 * r + 0.55 * g + 0.15 * b) < 0.40 * 255;
  const vak = (img, x0, x1, y0, y1) => img.getContext('2d').getImageData(Math.floor(x0 * img.width), Math.floor(y0 * img.height),
    Math.max(1, Math.floor((x1 - x0) * img.width)), Math.max(1, Math.floor((y1 - y0) * img.height))).data;
  const deel = (d, f) => { let n = 0; for (let i = 0; i < d.length; i += 4) if (f(d[i], d[i + 1], d[i + 2])) n++; return n / (d.length / 4); };
  const wit = (r, g, b) => r > 225 && g > 225 && b > 220 && Math.abs(r - b) < 14;
  // 2. het balkon per woning en per laag (laag 0 = begane grond, onderaan het doek)
  uit.balkonDoek = [];
  for (const seed of [1, 2]) {
    const img = doek('molenkrite_balkon', 4, 3, false, seed);
    for (let i = 0; i < 4; i++) {
      const x0 = i / 4 + 0.02, x1 = (i + 1) / 4 - 0.02;
      const laag = (s) => vak(img, x0, x1, 1 - (s + 1) / 3 + 0.02, 1 - s / 3 - 0.02);
      // de borstwering is een witte band over bijna de hele breedte van de woning: tel per laag welk deel van de
      // pixelrijen voor meer dan 75 % wit is (kozijnen en deuren halen dat niet, de dakrand bovenin is maar een strookje)
      const band = (s) => { const y0 = Math.floor((1 - (s + 1) / 3) * img.height), y1 = Math.floor((1 - s / 3) * img.height);
        const bx0 = Math.floor(x0 * img.width), bw = Math.floor((x1 - x0) * img.width);
        const d = img.getContext('2d').getImageData(bx0, y0, bw, y1 - y0).data; let rijen = 0;
        for (let y = 0; y < y1 - y0; y++) { let n = 0; for (let x = 0; x < bw; x++) { const k = (y * bw + x) * 4; if (wit(d[k], d[k + 1], d[k + 2])) n++; } if (n / bw > 0.75) rijen++; }
        return rijen / (y1 - y0); };
      uit.balkonDoek.push({ seed, i, verwacht: (i + seed) % 2 === 1,
        wit: [0, 1, 2].map(s => +band(s).toFixed(3)),
        glasInBorstwering: +deel(vak(img, x0 + 0.04, x1 - 0.04, 1 - 2 / 3 - 0.13, 1 - 2 / 3 - 0.03), isGlas).toFixed(3) });
    }
  }
  // 3. de steen: een stukje gevel tussen de ramen, gemiddeld
  const gem = (img, x0, x1, y0, y1) => { const d = vak(img, x0, x1, y0, y1); const s = [0, 0, 0]; for (let i = 0; i < d.length; i += 4) { s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2]; } return s.map(v => Math.round(v / (d.length / 4))); };
  uit.steen = { balkon: ST.molenkrite_balkon.brick[0], oud: ST.molenkrite.brick[0] };
  const hex = (h) => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16));
  uit.steenRgb = hex(ST.molenkrite_balkon.brick[0]);
  // 4. de strook beschot in de top van 133–143 (de bovenste laag)
  const blauw = (r, g, b) => b > 130 && b - r > 60 && Math.abs(r - 0x3d) < 25;
  uit.top = [];
  for (const seed of [0, 1, 2]) {
    const img = doek('molenkrite_punt', 3, 3, false, seed);
    for (let i = 0; i < 3; i++) uit.top.push({ seed, i, kleur: ST.molenkrite_punt.rabatTop[(i + seed) % 3],
      blauw: +deel(vak(img, i / 3, (i + 1) / 3, 0, 1 / 3), blauw).toFixed(3), wit: +deel(vak(img, i / 3, (i + 1) / 3, 0, 1 / 3), wit).toFixed(3) });
  }
  // 5. de pannen van de aanbouw
  uit.bergingDak = ST.molenkrite_berging.roof;
  return uit;
});

kop('1. de typen');
ok(r.balkon.length === 7 && r.balkon.every(s => s.endsWith('molenkrite_balkon')), 'Molenkrite 145–157 zijn molenkrite_balkon', r.balkon.join(', '));
ok(r.punt.length === 6 && r.punt.every(s => s.endsWith('molenkrite_punt')), 'Molenkrite 133–143 blijven molenkrite_punt', r.punt.join(', '));
ok(r.balkonElders === 0, 'geen ander pand werd molenkrite_balkon', `${r.balkonElders}`);

kop('2. het balkon');
const metB = r.balkonDoek.filter(d => d.verwacht), zonder = r.balkonDoek.filter(d => !d.verwacht);
ok(metB.every(d => d.wit[1] > 0.25 && d.wit[2] > 0.25), 'om de woning een witte borstwering op de eerste en tweede verdieping', JSON.stringify(metB.map(d => d.wit)));
ok(zonder.every(d => d.wit[1] < 0.15 && d.wit[2] < 0.15), 'de woningen ertussen zonder balkon', JSON.stringify(zonder.map(d => d.wit)));
ok(r.balkonDoek.every(d => d.wit[0] < 0.15), 'nooit een balkon op de begane grond', JSON.stringify(r.balkonDoek.map(d => d.wit[0])));
ok(metB.every(d => d.glasInBorstwering < 0.02), 'de borstwering telt niet als glas (geen raam dat \'s nachts brandt)', JSON.stringify(metB.map(d => d.glasInBorstwering)));

kop('3. de steen');
const [sr, sg, sb] = r.steenRgb;
ok(sr - sb >= 25 && sr < 160 && sg < 130, 'grijsbruin: warmer dan grijs, donkerder dan het geelbeige van molenkrite', `${r.steen.balkon} (was ${r.steen.oud})`);

kop('4. de top van 133–143');
const metStrook = r.top.filter(t => t.kleur), zonderStrook = r.top.filter(t => !t.kleur);
ok(metStrook.filter(t => t.kleur === '#3d4f9c').every(t => t.blauw > 0.01), 'een blauwe strook beschot waar die hoort', JSON.stringify(metStrook.map(t => [t.kleur, t.blauw])));
ok(zonderStrook.every(t => t.blauw < 0.005), 'en geen strook bij één op de drie', JSON.stringify(zonderStrook.map(t => t.blauw)));
ok(metStrook.length === 6 && zonderStrook.length === 3, 'twee van de drie woningen een strook', `${metStrook.length}/${r.top.length}`);

kop('5. de aanbouw');
ok(r.bergingDak === '#5e4f47', 'grijsbruine pannen op de aanbouw', r.bergingDak);

await browser.close();
console.log(fout ? `\n${fout} fout(en)` : '\nalles goed');
process.exit(fout ? 1 : 0);
