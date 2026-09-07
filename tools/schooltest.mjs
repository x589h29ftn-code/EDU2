/*
 Toetst kindcentrum De Wynpôlle, Keizersmantel 1 in Duinterpen
 (BAG-pand 0091100000004552).

 De toetsen zijn gekozen op wat er tijdens het bouwen misging:

 1. het pand krijgt zijn eigen type en niet meer het naamloze `spil`;
 2. élke muur is een gevel. Zonder de vlag `industrieel` kwam bijna het hele
    complex als kale bleke steen in beeld: `voorkantNaar` wijst één richting aan
    en dit grondvlak heeft 131 hoeken, dus maar een handvol vlakken haalde de
    eis `|kant| > 0,6`;
 3. de tweedeling zit op de hoogte uit 3D BAG en niet op een aanname: de lage
    vleugel (tot 9,5 m) krijgt het houten beschot met luifels, de hoge delen
    baksteen. Er moeten dus twee gevelstijlen op één pand staan;
 4. de vijf luifelkleuren staan echt in het doek, en niet in het bakstenen doek;
 5. de achtergrond van de lage gevel is liggend beschot en geen metselwerk.

 Gebruik: python3 -m http.server 8123 &  node tools/schooltest.mjs 8123
*/
import { chromium } from 'playwright';

const port = process.argv[2] || '8123';
const PAND = '0091100000004552';
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
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });
await page.evaluate(async () => {
  document.getElementById('overlay').style.display = 'none';
  window.__T = await import('/js/textures.js');
});

// ---------- 1. het pand ----------
kop('het pand in de kaart');
const pand = await page.evaluate(async (PAND) => {
  const { KAART } = await import('/js/kaart.js');
  const p = KAART.panden.find(q => q.id === PAND);
  if (!p) return null;
  // de bovenkanten van de muurvlakken, in twee groepen
  const V = p.v, pt = (i) => [V[i * 3], V[i * 3 + 1], V[i * 3 + 2]];
  let laag = 0, hoog = 0;
  p.f.forEach((ringen, fi) => {
    if (p.s[fi] !== 1) return;
    let t = 0; for (const q of ringen[0].map(pt)) t = Math.max(t, q[1]);
    if (t > 9.5) hoog++; else laag++;
  });
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const a of p.voet) { x0 = Math.min(x0, a[0]); x1 = Math.max(x1, a[0]); z0 = Math.min(z0, a[1]); z1 = Math.max(z1, a[1]); }
  return { type: p.type, hoeken: p.voet.length, jaar: p.jaar, goot: p.goot, nok: p.nok,
    opp: Math.round((x1 - x0) * (z1 - z0)), laag, hoog, front: p.front };
}, PAND);
ok(!!pand, 'het pand staat in de kaart');
ok(pand && pand.type === 'dewynpolle', 'en heeft zijn eigen type', pand ? pand.type : '');
ok(pand && pand.hoeken > 100, 'het grondvlak is de gebogen plattegrond uit de BGT', `${pand ? pand.hoeken : 0} hoeken`);
ok(pand && pand.laag > 40 && pand.hoog > 40,
  'de muurvlakken vallen in twee hoogtegroepen, dus de tweedeling zit in de data',
  `${pand ? pand.laag : 0} tot 9,5 m en ${pand ? pand.hoog : 0} erboven`);

// ---------- 2. de twee gevelstijlen ----------
kop('de twee gevelstijlen op één pand');
const doeken = await page.evaluate(() => {
  const T = window.__T;
  const lees = (t) => {
    const im = t.image;
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    return { w: im.width, h: im.height, d: g.getImageData(0, 0, im.width, im.height).data };
  };
  const bijKleur = (beeld, hex, marge = 26) => {
    const r = parseInt(hex.slice(1, 3), 16), gg = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    let n = 0;
    for (let i = 0; i < beeld.d.length; i += 4) {
      if (Math.abs(beeld.d[i] - r) < marge && Math.abs(beeld.d[i + 1] - gg) < marge && Math.abs(beeld.d[i + 2] - b) < marge) n++;
    }
    return n;
  };
  const st = T.HOUSE_STYLES.dewynpolle;
  const hout = lees(T.facade('dewynpolle', 6, 2, false, 1));
  const steen = lees(T.facade('dewynpolle_steen', 6, 4, false, 1));
  // liggend beschot: rijen donkere schaduwlijnen. Tel per beeldrij hoe donker
  // hij gemiddeld is en kijk of dat regelmatig op en neer gaat.
  const rijDonker = [];
  for (let y = 0; y < hout.h; y++) {
    let som = 0;
    for (let x = 0; x < hout.w; x += 7) { const i = (y * hout.w + x) * 4; som += hout.d[i] + hout.d[i + 1] + hout.d[i + 2]; }
    rijDonker.push(som);
  }
  let wissels = 0;
  const gem = rijDonker.reduce((a, b) => a + b, 0) / rijDonker.length;
  for (let y = 1; y < rijDonker.length; y++) if ((rijDonker[y - 1] < gem) !== (rijDonker[y] < gem)) wissels++;
  return {
    luifelsInHout: st.luifels.map(k => bijKleur(hout, k)),
    luifelsInSteen: st.luifels.map(k => bijKleur(steen, k)),
    kleuren: st.luifels.length,
    houtMaat: `${hout.w}x${hout.h}`, steenMaat: `${steen.w}x${steen.h}`,
    wissels, rijen: hout.h,
  };
});
ok(doeken.luifelsInHout.every(n => n > 40),
  'alle vijf de luifelkleuren staan in het gevelblad van de lage vleugel',
  doeken.luifelsInHout.join(', ') + ' beeldpunten');
/*
 In het bakstenen blad hoort geen luifel te zitten. Eén kleur komt er wel in
 voor: de oranje entreedeur (#e0651a) ligt binnen de meetmarge van de oranje
 luifel (#e07b1a). De toets kijkt daarom naar de verhouding en niet naar een
 absoluut aantal — in het houten blad hoort elke kleur ruim vaker te staan.
*/
ok(doeken.luifelsInSteen.every((n, i) => n < doeken.luifelsInHout[i] / 4),
  'en in het bakstenen gevelblad hoogstens een fractie daarvan (de oranje deur)',
  doeken.luifelsInSteen.join(', ') + ' tegen ' + doeken.luifelsInHout.join(', '));
ok(doeken.wissels >= 6,
  'de achtergrond van de lage gevel is liggend beschot: donkere lijnen op regelmaat',
  `${doeken.wissels} wisselingen over ${doeken.rijen} rijen`);

// ---------- 3. wat er in de wereld staat ----------
kop('de school in de wereld');
const wereld = await page.evaluate(async (PAND) => {
  const { KAART } = await import('/js/kaart.js');
  const g = window.__game;
  const p = KAART.panden.find(q => q.id === PAND);
  const ring = p.voet;
  // hoekpunten binnen 60 cm van de omtrek horen bij dit pand (een
  // punt-in-veelhoektoets valt op de grens willekeurig uit)
  const opOmtrek = (x, z) => {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz;
      if (L2 < 1e-6) continue;
      let t = ((x - a[0]) * dx + (z - a[1]) * dz) / L2;
      t = Math.max(0, Math.min(1, t));
      if (Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t)) < 0.6) return true;
    }
    return false;
  };
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const a of ring) { x0 = Math.min(x0, a[0]); x1 = Math.max(x1, a[0]); z0 = Math.min(z0, a[1]); z1 = Math.max(z1, a[1]); }
  const perKlasse = {}, gevelMats = new Set();
  let hoogsteInDoos = 0;
  g.scene.traverse(o => {
    const k = o.userData && o.userData.klasse;
    if (!o.isMesh || o.isInstancedMesh || !k) return;
    if (!['muur', 'voorgevel', 'achtergevel', 'dakkapel', 'dak', 'platdak'].includes(k)) return;
    const pos = o.geometry.getAttribute('position');
    let raakt = false;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (x >= x0 && x <= x1 && z >= z0 && z <= z1 && y > hoogsteInDoos) hoogsteInDoos = y;
      if (!opOmtrek(x, z)) continue;
      raakt = true;
      perKlasse[k] = (perKlasse[k] || 0) + 1;
    }
    if (raakt && ['voorgevel', 'achtergevel'].includes(k)) gevelMats.add(o.material);
  });
  return { perKlasse, gevelStijlen: gevelMats.size, hoogsteInDoos, nok: p.nok };
}, PAND);
ok((wereld.perKlasse.voorgevel || 0) + (wereld.perKlasse.achtergevel || 0) > 400,
  'het hele complex staat er als gevel en niet als kale steen',
  `voorgevel ${wereld.perKlasse.voorgevel || 0}, achtergevel ${wereld.perKlasse.achtergevel || 0} hoekpunten`);
/*
 Er blijft kale steen over, en dat hoort zo. Een gevel vraagt in `muurKeuze` een
 muurvlak van minstens 2,4 m breed, en een gebogen wand bestaat uit facetten die
 daar deels onder blijven. Die facetten krijgen het metselwerk van het pand zelf
 (#9c5a42, dezelfde roodbruine steen als de hoge delen), dus ze vallen niet uit
 de toon. Wat deze toets vastlegt is dat de gevel de overhand heeft: was
 `industrieel` uit, dan was bijna álles kale steen.
*/
ok((wereld.perKlasse.voorgevel || 0) > (wereld.perKlasse.muur || 0),
  'de gevel heeft de overhand op de kale steen van de smalle facetten',
  `gevel ${wereld.perKlasse.voorgevel || 0} tegen steen ${wereld.perKlasse.muur || 0} hoekpunten`);
ok(wereld.gevelStijlen >= 2,
  'er staan minstens twee gevelstijlen op dit ene pand (hout en steen)',
  `${wereld.gevelStijlen} materialen`);
/*
 De hoogte wordt in de omhullende doos gemeten en niet op de omtrek: de hoogste
 delen van dit complex liggen terug van de rooilijn (op de omtrek kom je tot
 12,05 m, in de doos tot 14,67 m).
*/
ok(wereld.hoogsteInDoos > wereld.nok - 0.6, 'het complex komt tot de nok uit 3D BAG',
  `${wereld.hoogsteInDoos.toFixed(2)} m tegen nok ${wereld.nok} m`);

console.log(fouten ? `\n${fouten} fout(en).` : '\nAlles goed.');
await browser.close();
process.exit(fouten ? 1 : 0);
