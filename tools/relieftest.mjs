/*
 Toetst het reliëf en de glans die js/textures.js uit de kleurdoeken afleidt
 (`zetReliëf`, `normaalVoor`, `ruwVoor`), en het natte wegdek bij regen:

   - krijgen de getegelde materialen — metselwerk, dakpannen, klinkers,
     stoeptegels, asfalt, planken — een normal map, en zijn die lineair en niet
     als sRGB opgeslagen?
   - wijzen de normalen overwegend naar buiten (blauw het sterkst)?
   - klopt de richting? Een bult in het doek moet een bult blijven en geen deuk
     worden. Dat wordt met een doek met een bekende bult nagerekend, want aan
     het beeld zie je het pas als de zon een halve dag verder staat.
   - staat het metselwerk niet binnenstebuiten? Bij baksteen is de specie lichter
     dan de steen, dus daar moet de hoogte omgekeerd (RELIEF.baksteen.om).
   - hebben de gevels een roughness map waarin het glas glad is en het
     metselwerk mat, en staat `roughness` dan op 1 zodat de kaart de waarde
     draagt?
   - wordt het wegdek nat en donker bij regen, en droogt het weer op?
   - en blijft het texturegeheugen binnen de perken?

 Gebruik: python3 -m http.server 8123 &  node tools/relieftest.mjs 8123
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
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
let melding = '';
page.on('console', m => { if (m.text().startsWith('reliëf:')) melding = m.text(); });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });
await page.evaluate(async () => {
  document.getElementById('overlay').style.display = 'none';
  window.__T = await import('/js/textures.js');
  // een doek uitlezen als pixels
  window.__lees = (doek) => {
    const c = document.createElement('canvas');
    c.width = doek.width; c.height = doek.height;
    const g = c.getContext('2d');
    g.drawImage(doek, 0, 0);
    return { w: c.width, h: c.height, d: g.getImageData(0, 0, c.width, c.height).data };
  };
});
await page.waitForTimeout(300);

// ---------- 1. de materialen hebben reliëf gekregen ----------
kop('reliëf over de wereld');
ok(/normal maps/.test(melding), 'js/main.js meldt hoeveel materialen reliëf kregen', melding || 'geen melding');
const heeft = await page.evaluate(() => {
  const T = window.__T;
  const proef = {
    metselwerk: T.brick('#b39a75', '#d2c9b6', 1),
    dakpannen: T.roofTiles('#3d3430', 5),
    klinkers: T.klinkers('grijs'),
    stoeptegels: T.tiles(),
    asfalt: T.asphalt(),
    planken: T.planks('#7a5f42'),
    gras: T.grass(),
  };
  const uit = {};
  for (const [naam, t] of Object.entries(proef)) {
    const nm = T.normaalVoor(t);
    uit[naam] = nm ? {
      er: true, sRGB: nm.colorSpace === 'srgb',
      maat: `${nm.image.width}x${nm.image.height}`,
      kleurMaat: `${t.image.width}x${t.image.height}`,
      herhaling: [nm.repeat.x, nm.repeat.y],
    } : { er: false };
  }
  // en iets dat geen reliëf hoort te krijgen
  uit._doelnet = { er: !!T.normaalVoor(T.doelnet()) };
  return uit;
});
for (const naam of ['metselwerk', 'dakpannen', 'klinkers', 'stoeptegels', 'asfalt', 'planken', 'gras']) {
  const h = heeft[naam];
  ok(h.er, `${naam} heeft een normal map`, h.er ? `${h.maat} bij een kleurdoek van ${h.kleurMaat}` : '');
  if (h.er) ok(!h.sRGB, `en die staat lineair, niet als sRGB (${naam})`);
}
ok(!heeft._doelnet.er, 'een doelnet krijgt er geen: dat is gaas, geen reliëf');

// ---------- 2. wijzen de normalen naar buiten? ----------
kop('de richting van de normalen');
const richting = await page.evaluate(() => {
  const T = window.__T;
  const nm = T.normaalVoor(T.brick('#b39a75', '#d2c9b6', 1));
  const { w, h, d } = window.__lees(nm.image);
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
  const n = w * h;
  return { r: +(r / n).toFixed(1), g: +(g / n).toFixed(1), b: +(b / n).toFixed(1) };
});
ok(richting.b > 200, 'gemiddeld wijzen de normalen naar buiten (blauw het sterkst)', JSON.stringify(richting));
ok(Math.abs(richting.r - 128) < 12 && Math.abs(richting.g - 128) < 12,
  'en rood en groen liggen rond het midden: het reliëf helt niet naar één kant', JSON.stringify(richting));

/*
 De richting nagerekend met een bekende bult: een licht blok op een donker doek.
 Hoogte loopt naar rechts op waar het blok begint, dus daar hoort het rood ónder
 128 te liggen (nx = -dh/dx), en aan de rechterkant erboven. En omdat three het
 doek omklapt (flipY) loopt v omhoog in plaats van omlaag: aan de bovenrand van
 het blok, waar de hoogte in het doek naar beneden toe oploopt, hoort groen dus
 bóven 128 te liggen. Staat dat teken verkeerd, dan is elke bult een deuk.
*/
const bult = await page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#202020'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#e8e8e8'; g.fillRect(32, 32, 64, 64);
  const doek = window.__T._normaalDoek(c, 2, false);
  const { w, d } = window.__lees(doek);
  const px = (x, y) => { const i = (y * w + x) * 4; return { r: d[i], g: d[i + 1], b: d[i + 2] }; };
  // het doek houdt zijn maat, dus het blok ligt op 32..96
  return { links: px(32, 64), rechts: px(96, 64), boven: px(64, 32), onder: px(64, 96) };
});
ok(bult.links.r < 118, 'aan de linkerkant van een bult wijst de normaal naar links', `rood ${bult.links.r}`);
ok(bult.rechts.r > 138, 'en aan de rechterkant naar rechts', `rood ${bult.rechts.r}`);
ok(bult.boven.g > 138, 'aan de bovenrand wijst hij omhoog', `groen ${bult.boven.g}`);
ok(bult.onder.g < 118, 'en aan de onderrand omlaag', `groen ${bult.onder.g}`);

// ---------- 3. metselwerk staat niet binnenstebuiten ----------
/*
 Bij baksteen is de specie lichter dan de steen. Zou de helderheid recht als
 hoogte gelden, dan staken de voegen uit de muur. RELIEF.baksteen zet daarom
 `om`, en dat is te zien door hetzelfde doek met en zonder omkeren te maken: de
 uitkomsten moeten spiegelbeeldig zijn.
*/
kop('licht is bij baksteen laag, niet hoog');
const steen = await page.evaluate(() => {
  const T = window.__T;
  const kleur = T.brick('#b39a75', '#d2c9b6', 1);
  const echt = window.__lees(T.normaalVoor(kleur).image);
  const recht = window.__lees(T._normaalDoek(kleur.image, 2.2, false));
  const om = window.__lees(T._normaalDoek(kleur.image, 2.2, true));
  const verschil = (a, b) => {
    let som = 0;
    for (let i = 0; i < a.d.length; i += 4) som += Math.abs(a.d[i] - b.d[i]) + Math.abs(a.d[i + 1] - b.d[i + 1]);
    return som / (a.d.length / 4);
  };
  return { alsOm: verschil(echt, om), alsRecht: verschil(echt, recht) };
});
ok(steen.alsOm < steen.alsRecht,
  'de normal map van baksteen komt van de omgekeerde hoogte',
  `afwijking van omgekeerd ${steen.alsOm.toFixed(1)}, van recht ${steen.alsRecht.toFixed(1)}`);

// ---------- 4. de glans van de gevels ----------
kop('glas glimt, metselwerk niet');
const glans = await page.evaluate(() => {
  const T = window.__T;
  const gevel = T.facade('molenkrite', 3, 2, false, 1);
  const rm = T.ruwVoor(gevel);
  if (!rm) return { er: false };
  const { w, h, d } = window.__lees(rm.image);
  const telling = new Map();
  let laagste = 255, som = 0;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i];
    telling.set(v, (telling.get(v) || 0) + 1);
    if (v < laagste) laagste = v;
    som += v;
  }
  const soorten = [...telling.entries()].sort((a, b) => b[1] - a[1]);
  // hoeveel materialen in de scene hebben er een, en staat roughness dan op 1?
  let metKaart = 0, verkeerdGetal = 0;
  const gezien = new Set();
  window.__game.scene.traverse(o => {
    const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    for (const m of mats) {
      if (!m || gezien.has(m)) continue;
      gezien.add(m);
      if (!m.roughnessMap) continue;
      metKaart++;
      if (Math.abs(m.roughness - 1) > 0.001) verkeerdGetal++;
    }
  });
  return {
    er: true, sRGB: rm.colorSpace === 'srgb', maat: `${w}x${h}`,
    laagste, gemiddeld: +(som / (d.length / 4)).toFixed(1),
    meest: soorten[0][0], soorten: soorten.length, metKaart, verkeerdGetal,
    glasDeel: +(100 * ([...telling.entries()].filter(([v]) => v < 60).reduce((n, [, c]) => n + c, 0)) / (d.length / 4)).toFixed(1),
  };
});
ok(glans.er, 'een gevel heeft een roughness map', glans.er ? `${glans.maat}` : 'geen');
ok(glans.er && !glans.sRGB, 'die staat lineair, niet als sRGB');
ok(glans.er && glans.laagste < 40, 'het glas is echt glad', `laagste waarde ${glans.laagste} van 255`);
ok(glans.er && glans.meest > 200, 'en het metselwerk blijft mat', `meest voorkomende waarde ${glans.meest}`);
ok(glans.er && glans.glasDeel > 3 && glans.glasDeel < 60,
  'het glas beslaat een aannemelijk deel van de gevel', `${glans.glasDeel} %`);
ok(glans.er && glans.metKaart > 20, 'alle gevels in de wereld hebben hem', `${glans.metKaart} materialen`);
ok(glans.er && glans.verkeerdGetal === 0,
  'en bij die materialen staat roughness op 1, zodat de kaart de waarde draagt',
  `${glans.verkeerdGetal} met een ander getal`);

// ---------- 5. nat wegdek ----------
kop('nat wegdek bij regen');
const nat = await page.evaluate(async () => {
  const g = window.__game;
  const W = await import('/js/world.js');
  const wegen = W.sfeerMaterialen().weg;
  g.sfeer.weer = 'helder';
  const droog = wegen.map(m => ({ ruw: m.roughness, kleur: m.color.getHex(), metaal: m.metalness }));
  g.sfeer.weer = 'regen';
  const regen = wegen.map(m => ({ ruw: m.roughness, kleur: m.color.getHex(), metaal: m.metalness }));
  g.sfeer.weer = 'helder';
  const weerDroog = wegen.map(m => ({ ruw: m.roughness, kleur: m.color.getHex(), metaal: m.metalness }));
  const donkerder = (a, b) => {
    const f = (h) => ((h >> 16 & 255) + (h >> 8 & 255) + (h & 255));
    return f(b) < f(a);
  };
  return {
    aantal: wegen.length,
    natter: regen.filter((r, i) => r.ruw < droog[i].ruw - 0.05).length,
    donker: regen.filter((r, i) => donkerder(droog[i].kleur, r.kleur)).length,
    metaal: regen.filter(r => r.metaal > 0).length,
    terug: weerDroog.filter((r, i) => Math.abs(r.ruw - droog[i].ruw) < 1e-6 && r.kleur === droog[i].kleur).length,
  };
});
ok(nat.aantal >= 4, 'het wegdek is aan de sfeermodule doorgegeven', `${nat.aantal} materialen`);
ok(nat.natter === nat.aantal, 'bij regen wordt het hele wegdek spiegelender', `${nat.natter} van ${nat.aantal}`);
ok(nat.donker === nat.aantal, 'en donkerder', `${nat.donker} van ${nat.aantal}`);
ok(nat.terug === nat.aantal, 'en na de regen droogt het weer op naar precies de oude waarden',
  `${nat.terug} van ${nat.aantal}`);

// ---------- 6. wat het aan geheugen kost ----------
kop('wat het kost');
const kosten = await page.evaluate(() => {
  const g = window.__game;
  const texs = new Set();
  g.scene.traverse(o => {
    const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    for (const m of mats) for (const k of ['map', 'normalMap', 'roughnessMap']) if (m && m[k]) texs.add(m[k]);
  });
  // per bron één keer tellen: een kloon deelt zijn doek en kost geen tweede plek
  const perBron = new Map();
  for (const t of texs) {
    const im = t.image;
    if (!im || !im.width) continue;
    if (!perBron.has(im)) perBron.set(im, im.width * im.height * 4 * 1.33);   // 1,33 voor de mipmaps
  }
  let bytes = 0; for (const b of perBron.values()) bytes += b;
  return { MB: +(bytes / 1048576).toFixed(1), plaatjes: perBron.size };
});
ok(kosten.MB < 260, 'het texturegeheugen blijft binnen de perken', `${kosten.MB} MB over ${kosten.plaatjes} plaatjes`);

// ---------- 7. de schakelaar ----------
kop('met ?relief=0 blijft alles vlak');
await page.close();          // anders bouwen twee wereldjes tegelijk en loopt de tweede zijn tijd voorbij
const zonder = await browser.newPage({ viewport: { width: 640, height: 400 } });
await zonder.goto(`http://127.0.0.1:${port}/index.html?relief=0`, { waitUntil: 'load', timeout: 300000 });
await zonder.waitForFunction(() => window.__game, null, { timeout: 300000 });
const vlak = await zonder.evaluate(() => {
  let normalen = 0, ruw = 0;
  const gezien = new Set();
  window.__game.scene.traverse(o => {
    const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    for (const m of mats) {
      if (!m || gezien.has(m)) continue; gezien.add(m);
      if (m.normalMap) normalen++;
      if (m.roughnessMap) ruw++;
    }
  });
  return { normalen, ruw };
});
ok(vlak.normalen === 0 && vlak.ruw === 0, 'geen enkele kaart gezet', `${vlak.normalen} normal, ${vlak.ruw} roughness`);
await zonder.close();

console.log(fouten ? `\n${fouten} fout(en).` : '\nAlles goed.');
await browser.close();
process.exit(fouten ? 1 : 0);
