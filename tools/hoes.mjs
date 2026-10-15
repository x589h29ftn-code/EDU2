/*
 De dvd-hoes van Tinga (npm run hoes). Een inlay voor een standaard dvd-doosje: 273 × 183 mm (achterkant 129,5, rug 14,
 voorkant 129,5) met 3 mm afloop rondom, dus 279 × 189 mm. Opgemaakt als HTML in millimeters en door Chromium gezet:

   docs/hoes/hoes_dvd.pdf            drukwerk: vector-tekst, de beelden ingebed, met afloop (279 × 189 mm)
   docs/hoes/hoes_dvd.png            hetzelfde als beeld op 300 dpi (3295 × 2232 px)
   docs/hoes/hoes_voorkant.png       alleen de voorkant (op snijmaat, 129,5 × 183 mm, 300 dpi)
   docs/hoes/hoes_voorbeeld.png      klein, met de snij- en vouwlijnen gestippeld (niet om te drukken)

 De voorkant komt uit docs/hoes/voorkant_kunst.jpg: het laadscherm (beeld/laadscherm/tinga_vi.jpg) bijgesneden zónder het
 logo van Grand Theft Auto (een echt merk) en met Lanczos naar 300 dpi vergroot. De achterkant gebruikt schermafdrukken uit
 docs/screenshots/. Geen echte merken, logo's of keurmerken (PEGI, Kijkwijzer, Rockstar) — alles is eigen opmaak.

 Gebruik: node tools/hoes.mjs   (geen server nodig; laadt de beelden als bestanden)
*/
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const map = 'docs/hoes';
mkdirSync(map, { recursive: true });
const b64 = (pad) => `data:image/${pad.endsWith('.png') ? 'png' : 'jpeg'};base64,${readFileSync(pad).toString('base64')}`;

// de maten in mm
const AF = 3, ACHTER = 129.5, RUG = 14, VOOR = 129.5, HOOG = 183;
const BREED = ACHTER + RUG + VOOR + 2 * AF, HOOGT = HOOG + 2 * AF;
const xRug = AF + ACHTER, xVoor = xRug + RUG;

const beelden = [
  ['intro_geeuw', 'De Geeuw en Tinga van boven'],
  ['heli_zoeklicht', "'s Nachts in de heli van Wiebe"],
  ['avond_brug', 'De Dúvelsrak bij nacht'],
  ['tiger_schot', 'De Tiger aan de Sudergoweg'],
  ['nomercy5_molen', 'No Mercy 5: de overtocht bij De Rat'],
  ['intro_viaduct', 'De Stadsrondweg en het viaduct'],
].map(([n, t]) => ({ src: b64(`docs/screenshots/${n}.png`), t }));
const kunst = b64(`${map}/voorkant_kunst.jpg`);

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: ${BREED}mm ${HOOGT}mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${BREED}mm; height: ${HOOGT}mm; }
  body { position: relative; overflow: hidden; background: #1a0f2e; font-family: 'Inter', 'Liberation Sans', sans-serif; color: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .paneel { position: absolute; top: 0; height: ${HOOGT}mm; overflow: hidden; }

  /* ---------- achterkant ---------- */
  .achter { left: 0; width: ${xRug}mm;
    background: radial-gradient(120% 70% at 30% 0%, #6b2f8f 0%, #2a1446 45%, #120a22 100%); }
  .achter .in { position: absolute; left: ${AF + 9}mm; right: 9mm; top: ${AF + 8}mm; bottom: ${AF + 7}mm; display: flex; flex-direction: column; }
  .kop { font-weight: 900; font-size: 7.4mm; line-height: 1.02; letter-spacing: -0.2mm; text-transform: uppercase;
    background: linear-gradient(180deg, #ffd27a 0%, #ff7a59 55%, #e0408a 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .verhaal { margin-top: 2.6mm; font-size: 2.6mm; line-height: 1.38; color: #efe6ff; }
  .verhaal b { color: #ffd27a; font-weight: 700; }
  .raster { margin-top: 3.2mm; display: grid; grid-template-columns: 1fr 1fr; gap: 1.8mm; }
  .raster figure { position: relative; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 1.2mm; box-shadow: 0 0.6mm 2mm rgba(0,0,0,.55);
    outline: 0.35mm solid rgba(255,255,255,.18); }
  .raster img { width: 100%; height: 100%; object-fit: cover; transform: scale(1.04); }
  .raster figcaption { position: absolute; left: 0; right: 0; bottom: 0; padding: 0.6mm 1.2mm; font-size: 1.85mm; font-weight: 600;
    background: linear-gradient(0deg, rgba(10,4,20,.85), rgba(10,4,20,0)); }
  .punten { margin-top: 3.2mm; display: grid; grid-template-columns: 1fr 1fr; gap: 1.2mm 4mm; font-size: 2.35mm; line-height: 1.3; color: #efe6ff; }
  .punten div::before { content: '★ '; color: #ff7a59; }
  .voet { margin-top: auto; padding-top: 2mm; display: flex; align-items: flex-end; justify-content: space-between; gap: 4mm; }
  .opdracht { font-size: 2.6mm; line-height: 1.35; font-style: italic; color: #ffd27a; max-width: 62mm; }
  .systeem { font-size: 1.9mm; line-height: 1.4; color: #bfb2d8; text-align: right; }
  .leeftijd { display: inline-flex; align-items: center; justify-content: center; width: 9mm; height: 9mm; border: 0.5mm solid #fff; border-radius: 1.2mm;
    font-weight: 900; font-size: 4.2mm; margin-left: 2mm; vertical-align: middle; }

  /* ---------- rug ---------- */
  .rug { left: ${xRug}mm; width: ${RUG}mm; background: linear-gradient(180deg, #ff8a4c 0%, #c03f8e 45%, #3a1a5e 100%);
    display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: ${AF + 8}mm 0 ${AF + 8}mm; }
  .rug .tekst { writing-mode: vertical-rl; font-weight: 900; font-size: 8mm; letter-spacing: 1.4mm; text-transform: uppercase;
    text-shadow: 0 0.4mm 0 #2a0c3a, 0 0 2mm rgba(0,0,0,.35); }
  .rug .klein { writing-mode: vertical-rl; font-size: 2.6mm; font-weight: 700; letter-spacing: 0.6mm; text-transform: uppercase; opacity: .92; }
  .rug .ster { font-size: 4mm; color: #ffd27a; }

  /* ---------- voorkant ---------- */
  .voor { left: ${xVoor}mm; width: ${VOOR + AF}mm; background: #2a1446; }
  .voor img.kunst { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .voor .boven { position: absolute; left: 0; right: 0; top: 0; height: 30mm; background: linear-gradient(180deg, rgba(20,8,40,.55), rgba(20,8,40,0)); }
  .voor .lint { position: absolute; top: ${AF + 6}mm; left: 8mm; font-size: 2.7mm; font-weight: 800; letter-spacing: 0.9mm; text-transform: uppercase;
    padding: 1.1mm 2.4mm; background: rgba(255,255,255,.92); color: #3a1a5e; border-radius: 0.8mm; }
  .voor .onder { position: absolute; left: 0; right: 0; bottom: 0; height: 78mm;
    background: linear-gradient(0deg, rgba(14,6,28,.96) 0%, rgba(14,6,28,.82) 38%, rgba(14,6,28,0) 100%); }
  .titel { position: absolute; left: 7mm; right: ${AF + 7}mm; bottom: ${AF + 21}mm; text-align: center; }
  .titel .woord { font-weight: 900; font-size: 30mm; line-height: .86; letter-spacing: -0.6mm; text-transform: uppercase;
    background: linear-gradient(180deg, #fff6d6 0%, #ffd27a 30%, #ff7a59 62%, #e0408a 100%); -webkit-background-clip: text; background-clip: text; color: transparent;
    filter: drop-shadow(0 0.7mm 0 #2a0c3a) drop-shadow(0 0 3mm rgba(0,0,0,.6)); }
  .titel .plaats { margin-top: 1.6mm; font-size: 4.1mm; font-weight: 800; letter-spacing: 3.2mm; text-transform: uppercase; color: #fff; padding-left: 3.2mm;
    text-shadow: 0 0.4mm 1.4mm rgba(0,0,0,.8); }
  .slagzin { position: absolute; left: 8mm; right: ${AF + 8}mm; bottom: ${AF + 9}mm; text-align: center; font-size: 2.9mm; line-height: 1.35; font-weight: 600;
    color: #f2e8ff; text-shadow: 0 0.3mm 1mm rgba(0,0,0,.9); }
  .slagzin b { color: #ffd27a; }
</style></head><body>

<section class="paneel achter"><div class="in">
  <div class="kop">Sneek. Tinga.<br>Achttien missies.</div>
  <p class="verhaal">Wat begint als een klusje voor <b>Mark</b> aan de Molenkrite, wordt een zomer vol achtervolgingen,
    hinderlagen en nachten op de <b>Dúvelsrak</b>. Erik rijdt, schiet en vlucht door een wijk die tot op het huisnummer klopt:
    de straten, de panden en het water komen uit de kaarten van het Kadaster. Tussen <b>De Veteraan</b> met zijn dikke hondje en
    brigadier <b>Bouwman</b> blijft er maar één vraag over: wie is R.? Het antwoord gaat zondagochtend over heel Sneek, live op
    <b>Radio Tinga</b>.</p>
  <div class="raster">${beelden.map(b => `<figure><img src="${b.src}"><figcaption>${b.t}</figcaption></figure>`).join('')}</div>
  <div class="punten">
    <div>Heel Tinga, Duinterpen en IJlst om in rond te rijden</div>
    <div>Achttien missies en de bijmissies No Mercy 4 en 5</div>
    <div>Een Ferrari, een helikopter en een Tiger-tank</div>
    <div>Politie die je zoekt, insluit en ramt</div>
    <div>Dag en nacht, regen en onweer</div>
    <div>Drie zenders op de autoradio, met 100% NL</div>
  </div>
  <div class="voet">
    <div class="opdracht">Voor Erik — van harte gefeliciteerd met je verjaardag.</div>
    <div class="systeem">Windows 10 en 11, of in de browser<br>Muis en toetsenbord · opslaan en laden<br>
      Bevat geweld en grof taalgebruik<span class="leeftijd">16</span></div>
  </div>
</div></section>

<section class="paneel rug">
  <div class="ster">★</div>
  <div class="tekst">Tinga</div>
  <div class="klein">Sneek · 2026</div>
</section>

<section class="paneel voor">
  <img class="kunst" src="${kunst}">
  <div class="boven"></div>
  <div class="lint">Sneek · Friesland</div>
  <div class="onder"></div>
  <div class="titel"><div class="woord">Tinga</div><div class="plaats">De wijk</div></div>
  <div class="slagzin">Erik en Mark tegen De Veteraan, Bouwman en heel Sneek.<br><b>Achttien missies</b> in de echte wijk Tinga.</div>
</section>
</body></html>`;
// (de html zelf wordt niet bewaard: met de ingebedde beelden is hij 8 MB)

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
const mm = 96 / 25.4;                       // css-pixels per mm
const page = await browser.newPage({ viewport: { width: Math.round(BREED * mm), height: Math.round(HOOGT * mm) }, deviceScaleFactor: 300 / 96 });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: `${map}/hoes_dvd.pdf`, width: `${BREED}mm`, height: `${HOOGT}mm`, printBackground: true, pageRanges: '1' });
await page.screenshot({ path: `${map}/hoes_dvd.png`, fullPage: false });
// alleen de voorkant, op snijmaat
await page.screenshot({ path: `${map}/hoes_voorkant.png`, clip: { x: xVoor * mm, y: AF * mm, width: VOOR * mm, height: HOOG * mm } });
// een klein voorbeeld met de snij- en vouwlijnen
await page.evaluate(({ AF, xRug, xVoor, BREED, HOOGT }) => {
  const lijn = (css) => { const d = document.createElement('div'); d.style.cssText = `position:absolute;z-index:9;${css}`; document.body.appendChild(d); };
  lijn(`left:${AF}mm;top:${AF}mm;width:${BREED - 2 * AF}mm;height:${HOOGT - 2 * AF}mm;border:0.3mm dashed #0ff`);
  for (const x of [xRug, xVoor]) lijn(`left:${x}mm;top:0;width:0;height:${HOOGT}mm;border-left:0.3mm dashed #ff0`);
}, { AF, xRug, xVoor, BREED, HOOGT });
const klein = await browser.newPage({ viewport: { width: Math.round(BREED * mm), height: Math.round(HOOGT * mm) }, deviceScaleFactor: 1.2 });
await klein.setContent(await page.content(), { waitUntil: 'load' });
await klein.screenshot({ path: `${map}/hoes_voorbeeld.png` });
await browser.close();
console.log(`${map}/hoes_dvd.pdf, hoes_dvd.png, hoes_voorkant.png, hoes_voorbeeld.png — ${BREED} × ${HOOGT} mm met ${AF} mm afloop`);
