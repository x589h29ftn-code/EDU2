/*
 Toetst de vijf panden uit de steekproefronde: de bungalows aan de
 Westhemstraat, de galerijflats en de hoogbouw aan de Potterzijlstraat,
 Sûdwester aan de Lemmerweg en de loods aan het Sneekerpad.

 Wat er mis kan gaan, en dus wat hier nagerekend wordt:
 1. de maten komen uit de BGT en het 3D BAG en niet uit de foto: hoogte, goot,
    nok en grondvlak moeten met de brondata overeenkomen;
 2. een gevel wordt normaal op vier lagen afgekapt. De hoogbouw is negen lagen,
    dus zonder `maxLagen` worden dat lagen van ruim zes meter;
 3. de balkonplaten van de hoogbouw en de open onderbouw van de galerijflat zijn
    het hele beeld van die twee gebouwen — die moeten op het doek staan;
 4. de schoorstenen en zonnepanelen van de Westhemstraat zijn nieuw op een pand
    met een 3D BAG-dak. Ze moeten op de nok staan, niet ernaast, en ze mogen niet
    ineens overal in de wijk opduiken;
 5. Sûdwester is donkergroen met één strook ramen, de loods roodbruine steen —
    geen van beide is een rijtjeshuis met een voordeur.

 Gebruik: python3 -m http.server 8123 &  node tools/steekproeftest.mjs 8123
*/
import { chromium } from 'playwright';

const port = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fouten++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });

kop('de vijf panden staan met hun eigen gevel in de kaart');
const data = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const zoek = (id) => KAART.panden.find(p => p.id === id);
  const uit = {};
  for (const [naam, id] of [['westhem', '0091100000009703'], ['galerij', '0091100000019604'],
    ['hoog', '0091100000004654'], ['sudwester', '0091100000013880'], ['loods', '0683100000293900']]) {
    const p = zoek(id);
    uit[naam] = p ? { type: p.type, goot: p.goot, nok: p.nok, jaar: p.jaar, straat: p.straat, nr: (p.nr || []).join('/'), rect: p.rect } : null;
  }
  // hoeveel panden gebruiken elk van de nieuwe typen? (niet per ongeluk de halve wijk)
  const tel = {};
  for (const p of KAART.panden) if (/^westhem$|^potterzijl_|^sudwester$|^sneekerpad_loods$/.test(p.type || '')) tel[p.type] = (tel[p.type] || 0) + 1;
  return { uit, tel };
});
const D = data.uit;
ok(D.westhem && D.westhem.type === 'westhem', 'Westhemstraat 59 is een bungalow uit de foto',
  D.westhem ? `${D.westhem.straat} ${D.westhem.nr}, ${D.westhem.type}` : '');
ok(D.westhem && D.westhem.goot > 2.5 && D.westhem.goot < 3.4 && D.westhem.nok > 6.2 && D.westhem.nok < 7.0,
  'met de goot en de nok uit 3D BAG', D.westhem ? `goot ${D.westhem.goot}, nok ${D.westhem.nok}` : '');
ok(D.galerij && D.galerij.type === 'potterzijl_gaanderij', 'Potterzijlstraat 2-48 is een galerijflat',
  D.galerij ? `goot ${D.galerij.goot} m, bj ${D.galerij.jaar}` : '');
ok(D.hoog && D.hoog.type === 'potterzijl_hoog', 'Potterzijlstraat 51-177 is hoogbouw',
  D.hoog ? `goot ${D.hoog.goot} m, bj ${D.hoog.jaar}` : '');
ok(D.hoog && D.hoog.goot > 24 && D.hoog.goot < 27, 'en die goot van ruim 25 m komt uit de brondata',
  D.hoog ? `${D.hoog.goot} m` : '');
ok(D.sudwester && D.sudwester.type === 'sudwester', 'Lemmerweg 130a is Sûdwester',
  D.sudwester ? `${(D.sudwester.rect.hx * 2).toFixed(0)} × ${(D.sudwester.rect.hz * 2).toFixed(0)} m` : '');
ok(D.loods && D.loods.type === 'sneekerpad_loods', 'Sneekerpad 25 is de loods',
  D.loods ? `${(D.loods.rect.hx * 2).toFixed(0)} × ${(D.loods.rect.hz * 2).toFixed(0)} m, bj ${D.loods.jaar}` : '');
ok(data.tel.westhem === 4 && data.tel.potterzijl_gaanderij === 2 && data.tel.potterzijl_hoog === 2
  && data.tel.sudwester === 1 && data.tel.sneekerpad_loods === 1,
  'en geen enkel type is per ongeluk over de wijk uitgesmeerd', JSON.stringify(data.tel));

kop('de gevels laten zien wat er op de foto staat');
const doek = await page.evaluate(async () => {
  const T = await import('/js/textures.js');
  // een rij beeldpunten per hoogte: hoe licht is die rij gemiddeld?
  const rijen = (tex) => {
    const c = tex.image, g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const uit = [];
    for (let y = 0; y < c.height; y++) {
      let s = 0;
      for (let x = 0; x < c.width; x += 4) s += (d[(y * c.width + x) * 4] + d[(y * c.width + x) * 4 + 1] + d[(y * c.width + x) * 4 + 2]) / 3;
      uit.push(s / Math.ceil(c.width / 4));
    }
    return uit;
  };
  /*
   De kleur van de wand zelf, en dat is de vaakst voorkomende kleur — niet het
   gemiddelde. Een bungalowgevel is voor een derde glas en witte kozijnen, en
   het gemiddelde van zandsteen met donker glas en wit hout is precies grijs;
   dan meet je je eigen rekensom en niet de steen.
  */
  const kleur = (tex) => {
    const c = tex.image, g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const bak = new Map();
    for (let i = 0; i < d.length; i += 4 * 3) {
      const k = (d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4);
      const v = bak.get(k) || [0, 0, 0, 0];
      v[0] += d[i]; v[1] += d[i + 1]; v[2] += d[i + 2]; v[3]++;
      bak.set(k, v);
    }
    let beste = null;
    for (const v of bak.values()) if (!beste || v[3] > beste[3]) beste = v;
    return [beste[0] / beste[3], beste[1] / beste[3], beste[2] / beste[3]];
  };
  // hoogbouw: negen lagen, dus negen lichte balkonbanden onder elkaar
  const hoog = rijen(T.facade('potterzijl_hoog', 6, 9, false, 0));
  let banden = 0, inBand = false;
  const drempel = 150;
  for (const v of hoog) { if (v > drempel && !inBand) { banden++; inBand = true; } else if (v <= drempel) inBand = false; }
  // galerijflat: de onderste laag is de open onderbouw en hoort donker te zijn
  const gal = rijen(T.facade('potterzijl_gaanderij', 5, 4, false, 0));
  const onder = gal.slice(Math.round(gal.length * 0.80)).reduce((a, b) => a + b, 0) / Math.round(gal.length * 0.20);
  const boven = gal.slice(Math.round(gal.length * 0.20), Math.round(gal.length * 0.60)).reduce((a, b) => a + b, 0) / Math.round(gal.length * 0.40);
  /*
   Hoeveel van de gevel is de steen van de stijl zelf? Bij een bungalow van één
   laag is de vaakst voorkomende kleur wit — kozijnen, dakrand en vitrage — en
   dan zegt die maat niets meer over het metselwerk. Dus hier het aandeel
   beeldpunten dat op de steenkleur uit de stijl lijkt.
  */
  const aandeel = (tex, hex, tol = 26) => {
    const w = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const c = tex.image, g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let raak = 0, n = 0;
    for (let i = 0; i < d.length; i += 4 * 3) {
      n++;
      if (Math.abs(d[i] - w[0]) < tol && Math.abs(d[i + 1] - w[1]) < tol && Math.abs(d[i + 2] - w[2]) < tol) raak++;
    }
    return raak / n;
  };
  return {
    banden,
    galOnder: onder, galBoven: boven,
    sud: kleur(T.facade('sudwester', 4, 3, false, 0)),
    loods: kleur(T.facade('sneekerpad_loods', 4, 2, false, 0)),
    westSteen: T.HOUSE_STYLES.westhem.brick[0],
    westDeel: aandeel(T.facade('westhem', 3, 1, false, 0), T.HOUSE_STYLES.westhem.brick[0]),
  };
});
ok(doek.banden >= 8, 'de hoogbouw heeft minstens één lichte band per laag',
  `${doek.banden} lichte banden over negen lagen`);
ok(doek.galOnder < doek.galBoven - 25, 'de galerijflat staat op een donkere open onderbouw',
  `onderbouw ${doek.galOnder.toFixed(0)}, woonlagen ${doek.galBoven.toFixed(0)}`);
ok(doek.sud[1] > doek.sud[0] + 8 && doek.sud[1] > doek.sud[2] + 4 && doek.sud[1] < 110,
  'Sûdwester is donkergroen', `rgb ${doek.sud.map(v => Math.round(v)).join(',')}`);
ok(doek.loods[0] > doek.loods[1] + 18 && doek.loods[1] > doek.loods[2],
  'de loods is roodbruine steen', `rgb ${doek.loods.map(v => Math.round(v)).join(',')}`);
const wr = parseInt(doek.westSteen.slice(1, 3), 16), wb = parseInt(doek.westSteen.slice(5, 7), 16);
ok(wr > 150 && wr > wb + 25, 'de Westhemstraat is lichte zandkleurige steen', doek.westSteen);
ok(doek.westDeel > 0.12, 'en die steen is ook echt het grootste deel van de gevel',
  `${(doek.westDeel * 100).toFixed(0)}% van de beeldpunten`);

kop('schoorstenen en zonnepanelen op de nok');
const dak = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const W = await import('/js/world.js');
  const THREE = await import('three');
  const west = KAART.panden.filter(p => p.type === 'westhem');
  const p = KAART.panden.find(q => q.id === '0091100000009703');
  W.updateLOD(p.rect.cx, p.rect.cz);
  /*
   De dakdetails zitten in losse groepen die in wereldcoördinaten getekend zijn,
   dus de groep zelf staat in de oorsprong en de onderdelen staan op hun plek.
   Per bungalow wordt gekeken wat er boven zijn dak hangt.
  */
  const stukken = [];
  for (const o of window.__game.scene.children) {
    if (!o.isGroup) continue;
    for (const c of o.children) if (c.isMesh && c.geometry) stukken.push(c);
  }
  const bijPand = (q) => stukken.filter(c => Math.hypot(c.position.x - q.rect.cx, c.position.z - q.rect.cz)
    < Math.max(q.rect.hx, q.rect.hz) + 1);
  const metDak = west.filter(q => bijPand(q).length >= 2).length;
  let schoorsteen = null, paneel = null;
  for (const c of bijPand(p)) {
    const doos = new THREE.Box3().setFromObject(c);
    if (c.geometry.type === 'BoxGeometry' && doos.max.y > p.nok) {
      schoorsteen = { top: doos.max.y, afwijking: Math.hypot(c.position.x - p.rect.cx, c.position.z - p.rect.cz) };
    }
    if (c.geometry.type === 'PlaneGeometry') paneel = { hoog: doos.max.y, laag: doos.min.y };
  }
  return { panden: west.length, metDak, schoorsteen, paneel, nok: p.nok, goot: p.goot };
});
ok(dak.panden === 4 && dak.metDak === 4, 'alle vier de bungalows hebben de dakdetails',
  `${dak.metDak} van de ${dak.panden}`);
ok(dak.schoorsteen && dak.schoorsteen.top > dak.nok + 0.4 && dak.schoorsteen.top < dak.nok + 2.2,
  'de schoorsteen steekt boven de nok uit', dak.schoorsteen ? `tot ${dak.schoorsteen.top.toFixed(2)} m, nok ${dak.nok}` : 'geen schoorsteen gevonden');
ok(dak.schoorsteen && dak.schoorsteen.afwijking < 0.6, 'en staat op de nok, niet ernaast',
  dak.schoorsteen ? `${dak.schoorsteen.afwijking.toFixed(2)} m van het hart` : '');
ok(dak.paneel && dak.paneel.hoog <= dak.nok + 0.35 && dak.paneel.laag >= dak.goot - 0.4,
  'het zonnepaneel ligt tussen goot en nok op het dakvlak',
  dak.paneel ? `${dak.paneel.laag.toFixed(2)} tot ${dak.paneel.hoog.toFixed(2)} m (goot ${dak.goot}, nok ${dak.nok})` : 'geen paneel gevonden');

await browser.close();
console.log(fouten === 0 ? '\nAlles goed.' : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
