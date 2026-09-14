/*
 Een kaart van het speelgebied om af te drukken.

   node tools/geo/printkaart.mjs [poort] [schaal]

 Maakt `docs/kaart/tinga-speelgebied.jpg`: het hele spel recht van boven, met de
 straatnamen, een maatverdeling langs de randen, een schaalbalk, een noordpijl
 en een legenda. Bedoeld om uit te printen en er met een stift op te tekenen —
 bijvoorbeeld om aan te geven waar de grens van het speelgebied moet komen te
 liggen. Langs alle vier de randen staat om de honderd meter een streepje en om
 de vijfhonderd een cijfer, en die cijfers zijn dezelfde meters die de
 **K**-toets in het spel afdrukt: wat je op papier aanwijst kun je dus één op
 één doorgeven.

 De opname zelf gaat net als bij tools/geo/bovenaanzicht.mjs: het spel tekent
 zichzelf orthografisch van boven (`?boven=1&schaal=…`) in stukken van hoogstens
 8192 px per kant en zestien megapixel in het geheel, want groter geeft WebGL
 een leeg beeld terug, en die stukken worden hier weer aan elkaar geplakt. De
 stukken blijven in de bladzijde staan; alleen hun maten reizen mee terug naar
 node. Alle tekenwerk gebeurt op een canvas in de browser — er zitten geen
 beeldpakketten in dit project.

 De schaal is in beeldpunten per meter. Drie is de standaard: het gebied is 4380
 bij 2500 m, dus 13.140 × 7500 px, en op A1 (84 cm breed) is dat bijna 400 dpi.
 Twee is genoeg voor A1 op 265 dpi, één levert een plaat voor A3.
*/
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HIER, '..', '..');
const UIT = join(ROOT, 'docs', 'kaart');
mkdirSync(UIT, { recursive: true });

const poort = process.argv[2] || '8123';
const schaal = Number(process.argv[3] || 2);
const naam = process.argv[4] || 'tinga-speelgebied';
/*
 Standaard wordt alleen de JPEG bewaard, op kwaliteit 0,90. De PNG van een blad
 van honderdtwintig megapixel is meer dan een gigabyte aan opslaggeschiedenis per
 keer dat je hem opnieuw maakt, en op papier is het verschil er niet. Wil je hem
 toch — voor een drukker die per se lossless wil — geef dan `--png` mee; dan
 wordt hij ook pas gemaakt, want ook het heen en weer sturen ervan kost tijd.
*/
const alleenJpg = !process.argv.includes('--png');
/*
 Twee bladen uit dezelfde opname, met elk hun eigen taak.

 Het gewone blad is de kaart zoals het spel eruitziet: straatnamen, de
 maatverdeling langs de randen en verder niets. Het lichte blad heeft een witte waas over de kaart — daarop teken
 je, want een stift op een volle groene polder is nauwelijks te zien, en het
 scheelt ook nogal wat inkt — en dáár staan de herkenningspunten op (het
 startpunt, Tinga State, het tankstation), want die heb je nodig om te weten waar
 je de grens legt. Op het kleurenblad zouden ze alleen in de weg zitten.
*/
const BLADEN = [
  { licht: 0, merken: false, achter: '' },
  { licht: 0.55, merken: true, achter: '-licht' },
];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
const fouten = [];
page.on('pageerror', e => fouten.push(e.message));
await page.goto(`http://127.0.0.1:${poort}/index.html?boven=1&schaal=${schaal}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__boven, null, { timeout: 300000 });

const raster = await page.evaluate(() => window.__bovenRaster);
console.log(`gebied ${raster.W}×${raster.H} px op ${schaal} px/m, in ${raster.kolommen}×${raster.rijen} stuk(ken)`);

// de eerste opname warmt de GPU op (texturen, schaduwkaart); die gooien we weg
await page.evaluate(() => window.__boven(0, 0));
await page.waitForTimeout(600);

await page.evaluate(() => { window.__bovenStukken = []; });
let leeg = 0;
for (let iy = 0; iy < raster.rijen; iy++) {
  for (let ix = 0; ix < raster.kolommen; ix++) {
    const s = await page.evaluate(([ix, iy]) => window.__boven(ix, iy, true), [ix, iy]);
    if (s.gevuld <= 0) leeg++;
    console.log(`  stuk ${ix},${iy} klaar (${s.W}×${s.H}, ${Math.round(s.gevuld * 100)}% getekend)`);
  }
}
/*
 Een leeg stuk is geen zeldzaamheid maar wel altijd fout: zo kwam er een keer
 een spierwitte kaart uit terwijl er geen enkele foutmelding was. Liever hier
 stoppen dan een lege plaat in docs/kaart/ zetten.
*/
if (leeg) {
  console.error(`${leeg} van de ${raster.kolommen * raster.rijen} stukken is leeg gebleven — kaart niet bewaard.`);
  await browser.close();
  process.exit(1);
}

console.log('tekenen…');

/*
 Alles op één blad. De kaart komt binnen een rand te staan; onderaan is een brede
 strook voor de titel, de schaalbalk en de legenda. Alle maten hangen aan de
 bréédte van het blad en niet aan de schaal: een afdruk van A1 is even groot of
 je hem nu op één of op twee beeldpunten per meter zet, dus de letters en de
 lijnen horen daar mee te schalen en niet met het aantal pixels per meter.
*/
async function blad(licht, merken) {
  return page.evaluate(async ({ raster, schaal, datum, licht, merken, metPng }) => {
    const stukken = window.__bovenStukken;
    const { KAART } = await import('/js/kaart.js');
    const G = KAART.gebied;
    const W = raster.W, H = raster.H;

    const RAND = Math.round(W * 0.016);          // rand rondom de kaart
    /*
     De strook onderaan. Hij moet de titel, twee regels uitleg, de schaalbalk en
     zes legenda-regels dragen; op 5,5 % van de bladbreedte viel de onderste
     rij legenda er net buiten.
    */
    const BAND = Math.round(W * 0.082);
    const CW = W + RAND * 2, CH = H + RAND + BAND;
    const c = document.createElement('canvas');
    c.width = CW; c.height = CH;
    const g = c.getContext('2d');

    // maten van alles wat geen kaart is, als deel van de bladbreedte
    const pt = (f) => Math.max(7, Math.round(W * f));
    const GROOT = pt(0.0130), MID = pt(0.0056), KLEIN = pt(0.0042);
    const RANDMAAT = pt(0.0046), NAAMMAAT = pt(0.0034), MERKMAAT = pt(0.0044);

    // ---------- papier ----------
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, CW, CH);

    // ---------- de kaart zelf ----------
    for (const s of stukken) {
      const im = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = s.png; });
      g.drawImage(im, RAND + s.x, RAND + s.y);
    }
    if (licht > 0) {
      g.fillStyle = `rgba(255,255,255,${licht})`;
      g.fillRect(RAND, RAND, W, H);
    }

    // helpers: spelmeters ⇄ beeldpunten op het blad
    const px = (x) => RAND + (x - G.x0) * schaal;
    const py = (z) => RAND + (z - G.z0) * schaal;

    // ---------- straatnamen ----------
    /*
     De namen komen uit de kaart (KAART.labels) en staan langs hun eigen straat
     gedraaid, met een witte gloed eromheen. Er zijn er vierhonderd, en zonder
     schifting wordt dat een kaart waar je doorheen moet turen. Drie zeven:

     1. **Kleine straatjes krijgen geen naam.** Een straat telt mee als hij bij
        elkaar opgeteld minstens MIN_LENGTE lang is óf ergens minstens MIN_BREED
        breed — dan is het een straat waar je doorheen rijdt en geen hofje van
        veertig meter. Zestien namen vallen zo weg, allemaal steegjes.
     2. **Niet tien keer dezelfde naam.** De Molenkrite stond er tien keer op en
        de Zuidwesthoekweg elf; hoogstens MAX_PER_NAAM keer is genoeg, en dan ook
        nog minstens MIN_AFSTAND meter uit elkaar, zodat een lange weg aan beide
        einden zijn naam houdt.
     3. En wat dan nog over elkaar heen valt, wordt overgeslagen.

     Namen zonder weg-as — het water, de vaarten, de paden — blijven staan: dat
     zijn er maar een paar dozijn en ze helpen juist met oriënteren.
    */
    const MIN_LENGTE = 250, MIN_BREED = 9, MAX_PER_NAAM = 3, MIN_AFSTAND = 400;
    const straat = new Map();
    for (const w of (KAART.wegassen || [])) {
      if (!w.naam) continue;
      const o = straat.get(w.naam) || { lengte: 0, breed: 0 };
      o.lengte += w.lengte || 0;
      for (const p of w.pts) o.breed = Math.max(o.breed, p[2] || w.w || 0);
      straat.set(w.naam, o);
    }
    const alGezet = new Map();
    const magNaam = (l) => {
      const o = straat.get(l.t);
      if (o && o.lengte < MIN_LENGTE && o.breed < MIN_BREED) return false;
      const eerder = alGezet.get(l.t) || [];
      if (eerder.length >= MAX_PER_NAAM) return false;
      if (eerder.some(q => Math.hypot(q.x - l.x, q.z - l.z) < MIN_AFSTAND)) return false;
      eerder.push(l); alGezet.set(l.t, eerder);
      return true;
    };

    g.font = `600 ${NAAMMAAT}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    const bezet = [];
    const botst = (x, y, w, h) => bezet.some(q =>
      Math.abs(q.x - x) < (q.w + w) / 2 && Math.abs(q.y - y) < (q.h + h) / 2);
    let gezet = 0, over = 0;
    for (const l of (KAART.labels || [])) {
      if (!magNaam(l)) { over++; continue; }
      const X = px(l.x), Y = py(l.z);
      const b = g.measureText(l.t).width, h = NAAMMAAT * 1.25;
      if (botst(X, Y, b, h)) { over++; continue; }
      bezet.push({ x: X, y: Y, w: b, h });
      gezet++;
      g.save();
      g.translate(X, Y);
      let hoek = (l.hoek || 0) * Math.PI / 180;
      // altijd leesbaar: nooit op zijn kop
      if (hoek > Math.PI / 2) hoek -= Math.PI;
      if (hoek < -Math.PI / 2) hoek += Math.PI;
      g.rotate(hoek);
      g.strokeStyle = 'rgba(255,255,255,0.95)';
      g.lineWidth = Math.max(2, NAAMMAAT * 0.42);
      g.strokeText(l.t, 0, 0);
      g.fillStyle = '#16202b';
      g.fillText(l.t, 0, 0);
      g.restore();
    }

    /*
     ---------- de streepjes langs de rand ----------
     Hier lag een raster van honderd meter over de hele kaart. Dat las prettig
     als ruitjespapier maar het lag wél over alles heen: over de daken, over de
     straatnamen, over het water. Het is nu weg, en wat ervoor terugkomt zijn
     streepjes langs alle vier de randen — elke honderd meter een kort streepje,
     elke vijfhonderd een lang. Je legt er een liniaal tegenaan en je hebt
     dezelfde lijn, maar de kaart eronder blijft heel.
    */
    const HOK = 100, DIK = 500;
    const eerste = (v, stap) => Math.ceil(v / stap) * stap;
    const dun = Math.max(1, W * 0.00022), zwaarLijn = Math.max(2, W * 0.00050);
    const streep = W * 0.0035, streepLang = W * 0.0070;
    g.lineCap = 'butt';
    g.strokeStyle = 'rgba(16,26,40,0.85)';
    for (let x = eerste(G.x0, HOK); x < G.x1; x += HOK) {
      const zwaar = x % DIK === 0;
      const l = zwaar ? streepLang : streep;
      g.lineWidth = zwaar ? zwaarLijn : dun;
      g.beginPath();
      g.moveTo(px(x), RAND); g.lineTo(px(x), RAND + l);
      g.moveTo(px(x), RAND + H); g.lineTo(px(x), RAND + H - l);
      g.stroke();
    }
    for (let z = eerste(G.z0, HOK); z < G.z1; z += HOK) {
      const zwaar = z % DIK === 0;
      const l = zwaar ? streepLang : streep;
      g.lineWidth = zwaar ? zwaarLijn : dun;
      g.beginPath();
      g.moveTo(RAND, py(z)); g.lineTo(RAND + l, py(z));
      g.moveTo(RAND + W, py(z)); g.lineTo(RAND + W - l, py(z));
      g.stroke();
    }

    // het nulpunt: waar het spel zijn assen vandaan heeft
    g.strokeStyle = '#c0392b';
    g.lineWidth = zwaarLijn * 1.4;
    const kruis = W * 0.0035;
    g.beginPath();
    g.moveTo(px(0) - kruis, py(0)); g.lineTo(px(0) + kruis, py(0));
    g.moveTo(px(0), py(0) - kruis); g.lineTo(px(0), py(0) + kruis);
    g.stroke();

    // ---------- de cijfers langs de rand ----------
    g.fillStyle = '#16202b';
    for (let x = eerste(G.x0, HOK); x < G.x1; x += HOK) {
      const zwaar = x % DIK === 0;
      g.font = `${zwaar ? 800 : 500} ${zwaar ? RANDMAAT : RANDMAAT * 0.72}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'bottom'; g.fillText(String(x), px(x), RAND - RANDMAAT * 0.35);
      g.textBaseline = 'top'; g.fillText(String(x), px(x), RAND + H + RANDMAAT * 0.35);
    }
    for (let z = eerste(G.z0, HOK); z < G.z1; z += HOK) {
      const zwaar = z % DIK === 0;
      g.font = `${zwaar ? 800 : 500} ${zwaar ? RANDMAAT : RANDMAAT * 0.72}px system-ui, sans-serif`;
      g.textBaseline = 'middle';
      g.textAlign = 'right'; g.fillText(String(z), RAND - RANDMAAT * 0.4, py(z));
      g.textAlign = 'left'; g.fillText(String(z), RAND + W + RANDMAAT * 0.4, py(z));
    }

    // ---------- rand om de kaart ----------
    g.strokeStyle = '#16202b';
    g.lineWidth = zwaarLijn * 1.6;
    g.strokeRect(RAND, RAND, W, H);

    // ---------- plekken die je moet kunnen aanwijzen ----------
    /*
     Een handvol herkenningspunten, zodat je op papier weet waar je bent. Ze komen
     allemaal uit de kaartdata zelf: het startpunt, de panden waar je naar binnen
     kunt, het tankstation, de molen en de wegafsluiting die er al ligt.
    */
    const midden = (p) => {
      if (!p) return null;
      let x = 0, z = 0;
      for (const v of p.voet) { x += v[0]; z += v[1]; }
      return { x: x / p.voet.length, z: z / p.voet.length };
    };
    const pand = (id) => midden((KAART.panden || []).find(q => q.id === id));
    const adres = (straat, nr) => midden((KAART.panden || []).find(q => q.straat === straat && q.nr && q.nr.includes(nr)));
    const T = (KAART.tankstations || [])[0];
    const molen = (KAART.molens || [])[0];
    const punten = [
      { p: KAART.start, t: 'start van het spel', k: '#1d7a3a' },
      { p: adres('Molenkrite', '15'), t: 'Molenkrite 15', k: '#c0392b' },
      { p: adres('de Wieken', '29'), t: 'de Wieken 29', k: '#c0392b' },
      { p: pand('0683100000288962'), t: 'Tinga State', k: '#b8860b' },
      { p: T ? { x: T.cx, z: T.cz } : null, t: 'BP + wasboxen', k: '#00713c' },
      { p: molen ? { x: molen.cx, z: molen.cz } : null, t: 'De Rat (IJlst)', k: '#7a4b12' },
      { p: pand('0683100000288505'), t: 'Poiesz (IJlst)', k: '#b8860b' },
    ].filter(q => q.p);
    for (const q of (merken ? punten : [])) {
      const X = px(q.p.x), Y = py(q.p.z), r = W * 0.0018;
      g.beginPath(); g.arc(X, Y, r, 0, Math.PI * 2);
      g.fillStyle = q.k; g.fill();
      g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(1.5, r * 0.4); g.stroke();
      g.font = `700 ${MERKMAAT}px system-ui, sans-serif`;
      g.textAlign = 'left'; g.textBaseline = 'middle';
      g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = Math.max(2.5, MERKMAAT * 0.45);
      g.strokeText(q.t, X + r * 1.7, Y);
      g.fillStyle = '#0d151d';
      g.fillText(q.t, X + r * 1.7, Y);
    }
    for (const a of (KAART.wegafsluitingen || [])) {
      const X = px(a.x), Y = py(a.z), r = W * 0.0024;
      g.fillStyle = '#e8622a';
      g.fillRect(X - r, Y - r * 0.42, r * 2, r * 0.84);
      g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(1.4, r * 0.25);
      g.strokeRect(X - r, Y - r * 0.42, r * 2, r * 0.84);
    }

    // ---------- de strook onderaan ----------
    const bY = RAND + H + Math.round(RAND * 1.4);
    g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillStyle = '#0d151d';
    g.font = `800 ${GROOT}px system-ui, sans-serif`;
    g.fillText('TINGA · SNEEK — speelgebied', RAND, bY);
    g.font = `500 ${MID}px system-ui, sans-serif`;
    g.fillStyle = '#3a4653';
    g.fillText(
      `${(G.x1 - G.x0).toFixed(0)} × ${(G.z1 - G.z0).toFixed(0)} m · streepjes om de 100 m · ${schaal} px/m · ${datum}`,
      RAND, bY + GROOT * 1.3,
    );
    g.font = `500 ${KLEIN}px system-ui, sans-serif`;
    g.fillStyle = '#4a5663';
    g.fillText('De cijfers langs de rand zijn spelmeters — dezelfde die de K-toets in het spel afdrukt (x, z).',
      RAND, bY + GROOT * 1.3 + MID * 1.7);
    g.fillText('Teken de grens met een stift en geef de hoekpunten door als x, z.',
      RAND, bY + GROOT * 1.3 + MID * 1.7 + KLEIN * 1.5);

    // ---- schaalbalk ----
    const balkL = 500 * schaal;
    const balkX = RAND + Math.round(W * 0.42), balkY = bY + GROOT * 0.35;
    const balkH = Math.max(6, W * 0.0030);
    for (let i = 0; i < 5; i++) {
      g.fillStyle = i % 2 ? '#ffffff' : '#0d151d';
      g.fillRect(balkX + (balkL / 5) * i, balkY, balkL / 5, balkH);
    }
    g.strokeStyle = '#0d151d'; g.lineWidth = Math.max(1.2, W * 0.0004);
    g.strokeRect(balkX, balkY, balkL, balkH);
    g.font = `600 ${KLEIN}px system-ui, sans-serif`;
    g.fillStyle = '#0d151d';
    g.textAlign = 'center'; g.textBaseline = 'top';
    for (const m of [0, 100, 250, 500]) g.fillText(`${m}`, balkX + m * schaal, balkY + balkH * 1.5);
    g.textAlign = 'left';
    g.fillText('meter', balkX + balkL + KLEIN * 0.8, balkY + balkH * 0.1);

    // ---- legenda, in twee kolommen naast de schaalbalk ----
    const lx = balkX, ly = bY + GROOT * 1.9;
    g.font = `600 ${KLEIN}px system-ui, sans-serif`;
    g.textAlign = 'left'; g.textBaseline = 'middle';
    const items = [
      [(X, Y) => { g.fillStyle = '#c0392b'; g.fillRect(X - KLEIN * 0.55, Y - KLEIN * 0.1, KLEIN * 1.1, KLEIN * 0.2); g.fillRect(X - KLEIN * 0.1, Y - KLEIN * 0.55, KLEIN * 0.2, KLEIN * 1.1); }, 'nulpunt (0, 0)'],
      [(X, Y) => { g.fillStyle = '#e8622a'; g.fillRect(X - KLEIN * 0.6, Y - KLEIN * 0.25, KLEIN * 1.2, KLEIN * 0.5); }, 'wegafsluiting'],
      // de rest staat alleen op het blad waar de herkenningspunten op staan
      ...(merken ? [
        [(X, Y) => { g.beginPath(); g.arc(X, Y, KLEIN * 0.45, 0, Math.PI * 2); g.fillStyle = '#1d7a3a'; g.fill(); }, 'start van het spel'],
        [(X, Y) => { g.beginPath(); g.arc(X, Y, KLEIN * 0.45, 0, Math.PI * 2); g.fillStyle = '#c0392b'; g.fill(); }, 'huis waar je naar binnen kunt'],
        [(X, Y) => { g.beginPath(); g.arc(X, Y, KLEIN * 0.45, 0, Math.PI * 2); g.fillStyle = '#b8860b'; g.fill(); }, 'winkel'],
        [(X, Y) => { g.beginPath(); g.arc(X, Y, KLEIN * 0.45, 0, Math.PI * 2); g.fillStyle = '#00713c'; g.fill(); }, 'tankstation en wasboxen'],
      ] : []),
    ];
    items.forEach(([teken, tekst], i) => {
      const X = lx + Math.floor(i / 3) * Math.round(W * 0.15), Y = ly + (i % 3) * KLEIN * 2.0;
      teken(X, Y);
      g.fillStyle = '#0d151d';
      g.fillText(tekst, X + KLEIN * 1.6, Y);
    });

    // ---- noordpijl ----
    /*
     In het spel ligt het noorden op −z, dus boven aan deze plaat.
    */
    const nx = RAND + W - Math.round(W * 0.030), ny = bY + GROOT * 1.2;
    const nl = W * 0.011;
    g.beginPath();
    g.moveTo(nx, ny - nl);
    g.lineTo(nx + nl * 0.36, ny + nl * 0.5);
    g.lineTo(nx, ny + nl * 0.18);
    g.lineTo(nx - nl * 0.36, ny + nl * 0.5);
    g.closePath();
    g.fillStyle = '#0d151d'; g.fill();
    g.font = `800 ${MID}px system-ui, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'top';
    g.fillText('N', nx, ny + nl * 0.66);

    /*
     Twee uitvoeringen van hetzelfde blad. De PNG is scherp tot de laatste pixel
     en dus het origineel; de JPEG is een tiende van de omvang en op papier niet
     van de PNG te onderscheiden — dat is het bestand dat je naar een drukker
     mailt of op een USB-stick meeneemt.
    */
    return {
      png: metPng ? c.toDataURL('image/png') : '',
      jpg: c.toDataURL('image/jpeg', 0.90),
      gezet, over, CW, CH,
    };
  }, { raster, schaal, datum: new Date().toISOString().slice(0, 10), licht, merken, metPng: !alleenJpg });
}

for (const B of BLADEN) {
  const r = await blad(B.licht, B.merken);
  const mb = (b) => `${(b.length / 1048576).toFixed(1)} MB`;
  const png = r.png ? Buffer.from(r.png.split(',')[1], 'base64') : Buffer.alloc(0);
  const jpg = Buffer.from(r.jpg.split(',')[1], 'base64');
  if (!alleenJpg) writeFileSync(join(UIT, `${naam}${B.achter}.png`), png);
  writeFileSync(join(UIT, `${naam}${B.achter}.jpg`), jpg);
  console.log(`${naam}${B.achter} — ${r.CW}×${r.CH} px · jpg ${mb(jpg)}`
    + `${alleenJpg ? '' : ` · png ${mb(png)}`}`
    + ` · ${r.gezet} straatnamen (${r.over} overgeslagen omdat ze over elkaar vielen)`);
}
if (fouten.length) console.log('fouten in de pagina:', fouten.join(' | '));
await browser.close();
