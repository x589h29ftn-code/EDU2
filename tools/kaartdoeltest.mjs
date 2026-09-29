/*
 Kaart en ondertitels (stap 104, verzoek 29 sep 2026: "tijdens een cutscene zie je de dialoog
 minder goed; de K zie je altijd op de minimap, doe dat ook voor andere bijzondere plekken; op de
 grote kaart een plek aanwijzen voor navigatie en uitzetten, de meest logische weg, steeds
 bijwerken").

   node tools/server.mjs 8123 &   node tools/kaartdoeltest.mjs [poort] [map]   (npm run kaartdoeltest)

 1. In een filmbeeld is het gesprek ondertiteling: in de zwarte balk onderin, een dichte
    achtergrond, witte letters met een ruim contrast, groter dan de gewone balk, zonder kopje.
    Buiten een filmbeeld staat hij waar hij stond.
 2. Op de minikaart staan winkels, je huis, de klus, de missievlag en het eigen doel buiten het
    rondje op de rand, in hun richting; dichtbij op hun echte plek (gemeten, en in de pixels).
 3. De grote kaart: een klik zet een doel met een route over het wegennet; een klik bij een
    speldje neemt die plek en zijn naam; op het doel klikken of rechts haalt hem weg; de legenda
    is geen kaart. Lopen: de route wordt bijgewerkt; aankomen: hij gaat uit.
 4. Een klik op de open kaart is geen schot, en de muis beweegt dan het kruisje.
 Maakt ook drie foto's: film_dialoog.png, kaart_rand.png en kaart_doel.png.
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const poort = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
mkdirSync(map, { recursive: true });
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
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  const { KAART } = await import('/js/kaartwereld.js');
  window.__K = KAART;
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  window.__autoplay = false; g.player.active = false;
  g.sfeer.uur = 12;
  window.__meld = [];
  const echt = g.hud.melding.bind(g.hud);
  g.hud.melding = (k, o, t) => { window.__meld.push(`${k}|${o}`); return echt(k, o, t); };
  window.__teken = () => g.hud.update(0.016, g.player, g.vehicles, g.npcs, 'Molenkrite', false);
  window.__zet = (x, z, yaw = 0) => { g.player.inCar = null; g.player.pos.set(x, 0, z); g.player.yaw = yaw; g.player.applyCamera(); };
});

// ------------------------------------------------------------------ 1. ondertitels in een filmbeeld
kop('ondertitels in een filmbeeld');
const film = await page.evaluate(() => {
  const d = document.getElementById('dialoog');
  const zet = (aan) => {
    document.body.classList.toggle('film', aan);
    for (const id of ['filmboven', 'filmonder']) document.getElementById(id).style.height = aan ? '11vh' : '0';
  };
  d.hidden = false;
  document.getElementById('dialoogNaam').textContent = 'Ronald';
  document.getElementById('dialoogTekst').textContent = 'Ik stond voor veertigduizend onder water. Niet die ene race van jou. Alle races, drie jaar lang.';
  const meet = () => {
    const r = d.getBoundingClientRect(), st = getComputedStyle(d), t = getComputedStyle(document.getElementById('dialoogTekst'));
    const rgba = (s) => (s.match(/[\d.]+/g) || []).map(Number);
    const bg = rgba(st.backgroundColor), fg = rgba(t.color);
    const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const a = bg.length > 3 ? bg[3] : 1;
    // wat er achter de balk zit tellen we als wit (het ergste geval: een verlicht beeld)
    const achter = [bg[0] * a + 255 * (1 - a), bg[1] * a + 255 * (1 - a), bg[2] * a + 255 * (1 - a)];
    const L1 = lum(fg), L2 = lum(achter);
    const contrast = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    // wat er bovenop ligt: in het midden van de tekst hoort het gesprek zelf te liggen, niet een filmbalk
    const tr = document.getElementById('dialoogTekst').getBoundingClientRect();
    const boven = document.elementFromPoint(tr.left + tr.width / 2, tr.top + tr.height / 2);
    const zicht = !!boven && d.contains(boven);
    return { zicht, top: r.top, bottom: r.bottom, hoogte: r.height, alfa: a, contrast, letter: parseFloat(t.fontSize),
      kop: getComputedStyle(document.getElementById('dialoogKop')).display };
  };
  zet(false);
  const gewoon = meet();
  zet(true);
  const inFilm = meet();
  const balk = document.getElementById('filmonder').getBoundingClientRect();
  return { gewoon, inFilm, balkTop: balk.top, H: innerHeight };
});
ok(film.inFilm.zicht && film.gewoon.zicht, 'de tekst ligt bovenop: geen filmbalk eroverheen (ook buiten een filmbeeld niet)');
ok(film.inFilm.alfa >= 0.9 && film.inFilm.contrast >= 12, 'dichte achtergrond, ruim contrast (ook voor een licht beeld erachter)', `dekking ${film.inFilm.alfa.toFixed(2)}, contrast ${film.inFilm.contrast.toFixed(1)} (was ${film.gewoon.contrast.toFixed(1)})`);
ok(film.inFilm.letter > film.gewoon.letter && film.inFilm.kop === 'none', 'grotere letters, zonder kopje', `${film.gewoon.letter} → ${film.inFilm.letter} px`);
const inBalk = film.inFilm.bottom <= film.H && film.inFilm.top >= film.balkTop - film.inFilm.hoogte * 0.35;
ok(inBalk, 'de ondertitel staat (grotendeels) in de zwarte balk onderin', `balk vanaf ${film.balkTop.toFixed(0)}, tekst ${film.inFilm.top.toFixed(0)}–${film.inFilm.bottom.toFixed(0)} px`);
ok(Math.abs(film.gewoon.bottom - (film.H - 54)) < 2, 'buiten een filmbeeld staat de balk waar hij stond', `${film.gewoon.bottom.toFixed(0)} px`);
await page.screenshot({ path: `${map}/film_dialoog.png`, timeout: 600000 });
console.log(`${map}/film_dialoog.png`);
await page.evaluate(() => {
  document.body.classList.remove('film');
  for (const id of ['filmboven', 'filmonder']) document.getElementById(id).style.height = '0';
  document.getElementById('dialoog').hidden = true;
});

// ------------------------------------------------------------------ 2. de minikaart: plekken op de rand
kop('de minikaart: bijzondere plekken op de rand');
const rand = await page.evaluate(() => {
  const g = window.__game, h = g.hud;
  const s = g.start;
  window.__zet(s.x, s.z, 0);
  const winkels = (h.winkels || []).slice();
  // een verre winkel en de klus ver weg, een winkel vlakbij
  h.zetWinkels([...winkels, { x: s.x + 40, z: s.z, naam: 'dichtbij', wat: 'munitie' }]);
  h.zetKlus({ x: s.x, z: s.z - 900, wie: 'mark' });
  // de missievlag ver naar het oosten, het eigen doel ver naar het westen
  h.zetNavigatie({ route: null, doel: [s.x + 700, s.z], naam: 'missie', letter: 'M' });
  h.zetEigenNav({ route: null, doel: [s.x - 700, s.z], naam: 'eigen' });
  window.__teken();
  const pl = h._miniPlekken || [], R = h._miniRand;
  const verre = pl.filter(q => q.rand);
  const opRand = verre.every(q => Math.abs(Math.hypot(q.x - s.x, q.z - s.z) - R) < 0.5);
  const dicht = pl.find(q => q.wat === 'munitie' && Math.abs(q.x - (s.x + 40)) < 0.01);
  const klus = pl.find(q => q.wat === 'klus');
  // pixels: bij yaw 0 is +x rechts op de kaart; zoek geel rechts op de rand, paars links
  const c = h.canvas, W = c.width, ctx = c.getContext('2d');
  const kleurBij = (x0, y0, test) => { const d = ctx.getImageData(x0 - 14, y0 - 22, 28, 34).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (test(d[i], d[i + 1], d[i + 2])) n++; return n; };
  const geel = kleurBij(W - 16, W / 2, (r, g2, b) => r > 220 && g2 > 190 && b < 60);
  const paars = kleurBij(16, W / 2, (r, g2, b) => r > 180 && g2 < 120 && b > 200);
  h.zetWinkels(winkels); h.zetKlus(null); h.zetNavigatie(null); h.zetEigenNav(null);
  return { n: pl.length, verre: verre.length, opRand, R, W, dicht: dicht && !dicht.rand, klus: klus && klus.rand && Math.abs(klus.x - s.x) < 0.5 && klus.z < s.z, geel, paars, soorten: [...new Set(pl.map(q => q.wat))] };
});
ok(rand.verre >= 3 && rand.opRand, 'wat buiten het rondje ligt staat precies op de rand', `${rand.verre} van ${rand.n} op ${rand.R.toFixed(1)} m (${rand.soorten.join(', ')})`);
ok(rand.dicht, 'een winkel vlakbij staat op zijn echte plek');
ok(rand.klus, 'de klus, ver naar het noorden, staat bovenaan op de rand');
ok(rand.geel > 20, 'de gele missievlag staat op de rand, in zijn richting', `${rand.geel} gele beeldpunten`);
ok(rand.paars > 20, 'het paarse eigen doel ook', `${rand.paars} paarse beeldpunten`);

// ------------------------------------------------------------------ 3. de grote kaart: aanwijzen
kop('de grote kaart: een doel aanwijzen');
const groot = await page.evaluate(() => {
  const g = window.__game, h = g.hud, K = window.__K;
  const s = g.start;
  window.__zet(s.x, s.z, 0);
  h.toggleBig();
  window.__teken();
  const uit = {};
  // (a) een klik op een straat een kilometer verderop
  let doelW = null;
  for (const as of K.wegassen) { if (!as.drive) continue; for (const q of as.pts) { const d = Math.hypot(q[0] - s.x, q[1] - s.z); if (d > 900 && d < 1100) { doelW = { x: q[0], z: q[1] }; break; } } if (doelW) break; }
  const q = h.wereldNaarBig(doelW.x, doelW.z);
  h.kaartKlik(q.x, q.y, 0);
  const e = g.eigenDoel, n = h.eigen;
  uit.gezet = !!e && !!n && n.route && n.route.length > 1;
  uit.naam = e && e.naam;
  const r = n && n.route;
  if (r) {
    uit.beginD = Math.hypot(r[0][0] - s.x, r[0][1] - s.z);
    uit.eindD = Math.hypot(r[r.length - 1][0] - doelW.x, r[r.length - 1][1] - doelW.z);
    let lang = 0; for (let i = 1; i < r.length; i++) lang += Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]);
    uit.omweg = lang / Math.hypot(doelW.x - s.x, doelW.z - s.z);
    // over de weg: elk punt van de route ligt op een as
    const dSeg = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2)); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); };
    let naast = 0;
    // (het eerste en laatste punt zijn waar jij staat en waar je heen wilt: die hoeven niet op een as)
    for (const p of r.slice(1, -1)) { let m = Infinity; for (const as of K.wegassen) for (let i = 1; i < as.pts.length; i++) { const d = dSeg(p[0], p[1], as.pts[i - 1], as.pts[i]); if (d < m) m = d; if (m < 0.5) break; } if (m > 1) naast++; }
    uit.naast = naast; uit.punten = r.length - 2;
  }
  uit.melding = window.__meld.some(m => m.startsWith('Navigatie|'));
  // (b) nog eens op het doel: weg
  const q2 = h.wereldNaarBig(e.x, e.z);
  h.kaartKlik(q2.x, q2.y, 0);
  uit.weg = !g.eigenDoel && !h.eigen;
  // (c) bij een speldje: die plek, met zijn naam
  const pin = (h._bigPins || []).find(p => p.naam);
  h.kaartKlik(pin.echt.x + 6, pin.echt.y - 4, 0);
  const e2 = g.eigenDoel, w = h.bigNaarWereld(pin.echt.x, pin.echt.y);
  uit.pin = pin.naam; uit.pinNaam = e2 && e2.naam; uit.pinD = e2 ? Math.hypot(e2.x - w.x, e2.z - w.z) : null;
  // (d) de rechterknop: weg
  h.kaartKlik(10, 10, 2);
  uit.rechts = !g.eigenDoel;
  // (e) in de legenda klikken is geen doel
  const band = h.legendaBand(h._bigT.W, h._bigT.H);
  const na = h.kaartKlik(h._bigT.W / 2, band.y + 10, 0);
  uit.legenda = !na && !g.eigenDoel;
  return uit;
});
ok(groot.gezet && groot.melding, 'een klik op de kaart: een doel, met een route', `${groot.naam}`);
ok(groot.beginD < 40 && groot.eindD < 30, 'de route begint bij jou en eindigt bij het doel', `begin ${groot.beginD && groot.beginD.toFixed(1)} m, eind ${groot.eindD && groot.eindD.toFixed(1)} m`);
ok(groot.naast === 0 && groot.omweg < 2.2, 'over het wegennet, zonder grote omweg', `${groot.naast} van ${groot.punten} punten naast een as, ${groot.omweg && groot.omweg.toFixed(2)} × hemelsbreed`);
ok(groot.weg, 'nog eens op het doel klikken: weg');
ok(groot.pinNaam === groot.pin && groot.pinD < 1, 'vlak bij een speldje: die plek, met zijn naam', `${groot.pinNaam}`);
ok(groot.rechts, 'de rechtermuisknop: weg');
ok(groot.legenda, 'een klik in de legenda zet geen doel');

// ------------------------------------------------------------------ 3b. onderweg en aankomen
kop('onderweg bijwerken, en aankomen');
const weg = await page.evaluate(() => {
  const g = window.__game, h = g.hud, K = window.__K;
  const s = g.start;
  window.__zet(s.x, s.z, 0);
  let doelW = null;
  for (const as of K.wegassen) { if (!as.drive) continue; for (const q of as.pts) { const d = Math.hypot(q[0] - s.x, q[1] - s.z); if (d > 700 && d < 900) { doelW = { x: q[0], z: q[1] }; break; } } if (doelW) break; }
  const q = h.wereldNaarBig(doelW.x, doelW.z);
  h.kaartKlik(q.x, q.y, 0);
  const r0 = h.eigen.route;
  // halverwege de route gaan staan
  const mid = r0[Math.floor(r0.length / 2)];
  window.__zet(mid[0], mid[1], 0);
  g.werkEigenDoelBij(1);
  const r1 = h.eigen && h.eigen.route;
  const uit = { begin1: r1 ? Math.hypot(r1[0][0] - mid[0], r1[0][1] - mid[1]) : null, korter: r1 ? r1.length < r0.length : false };
  // een klein stapje: niet opnieuw rekenen
  window.__zet(mid[0] + 2, mid[1], 0);
  g.werkEigenDoelBij(1);
  uit.zelfde = h.eigen && h.eigen.route === r1;
  // bij het doel
  window.__meld = [];
  window.__zet(doelW.x + 3, doelW.z + 3, 0);
  g.werkEigenDoelBij(1);
  uit.aan = !g.eigenDoel && !h.eigen && window.__meld.some(m => m.startsWith('Aangekomen|'));
  return uit;
});
ok(weg.begin1 != null && weg.begin1 < 40 && weg.korter, 'halverwege: de route begint opnieuw bij jou, en is korter', `${weg.begin1 && weg.begin1.toFixed(1)} m`);
ok(weg.zelfde, 'een stapje van twee meter rekent niet opnieuw');
ok(weg.aan, 'bij het doel: "Aangekomen", en de navigatie uit');

// ------------------------------------------------------------------ 4. de muis op de open kaart
kop('de muis op de open kaart');
const muis = await page.evaluate(() => {
  const g = window.__game, h = g.hud, pl = g.player;
  const s = g.start;
  window.__zet(s.x, s.z, 0);
  window.__teken();
  pl.active = true;
  pl.kaartMuis = g.kaartMuis;
  const kogels = pl.ammo;
  // een echte klik midden op de kaart (zonder vergrendelde muis: de plek van de klik)
  const r = h.big.getBoundingClientRect();
  const cx = r.left + r.width * 0.4, cy = r.top + r.height * 0.4;
  document.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: cx, clientY: cy, bubbles: true }));
  document.dispatchEvent(new MouseEvent('mouseup', { button: 0, clientX: cx, clientY: cy, bubbles: true }));
  const uit = { doel: !!g.eigenDoel, schot: pl.ammo !== kogels };
  // het kruisje: met de muis bewegen, begrensd door de kaart
  h.kaartCursor = null;
  h.kaartMuis(40, -25);
  const c1 = { ...h.kaartCursor };
  h.kaartMuis(99999, 99999);
  uit.cursor = Math.abs(c1.x - (h._bigT.W / 2 + 40)) < 0.01 && Math.abs(c1.y - (h._bigT.H / 2 - 25)) < 0.01
    && h.kaartCursor.x === h._bigT.W && h.kaartCursor.y === h._bigT.H;
  pl.kaartMuis = null; pl.active = false;
  return uit;
});
ok(muis.doel && !muis.schot, 'een klik op de open kaart zet een doel en is geen schot');
ok(muis.cursor, 'met een vergrendelde muis beweegt het kruisje, binnen de kaart');

// ------------------------------------------------------------------ foto's
await page.evaluate(() => {
  const g = window.__game, h = g.hud;
  // de grote kaart met een doel aan de overkant van de wijk
  const s = g.start;
  h.zetEigenNav(null); g.hud.onEigenDoel(null);
  const pin = (h._bigPins || []).find(p => p.naam && Math.hypot(p.echt.x - h.wereldNaarBig(s.x, s.z).x, p.echt.y - h.wereldNaarBig(s.x, s.z).y) > 150) || h._bigPins[0];
  h.kaartKlik(pin.echt.x, pin.echt.y, 0);
  h.kaartCursor = { x: pin.echt.x + 30, y: pin.echt.y + 20 };
  window.__teken();
});
await page.screenshot({ path: `${map}/kaart_doel.png`, timeout: 600000 });
console.log(`${map}/kaart_doel.png`);
await page.evaluate(() => {
  const g = window.__game, h = g.hud;
  h.toggleBig();
  const s = g.start;
  h.zetKlus({ x: s.x + 300, z: s.z - 400, wie: 'johan' });
  window.__teken();
});
await page.screenshot({ path: `${map}/kaart_rand.png`, clip: { x: 1280 - 260, y: 0, width: 260, height: 260 }, timeout: 600000 });
console.log(`${map}/kaart_rand.png`);

console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
await browser.close();
process.exit(fouten ? 1 : 0);
