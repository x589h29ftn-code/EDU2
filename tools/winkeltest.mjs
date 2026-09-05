/*
 Toetst de boerderijwinkel bij Tinga State (js/boerderij.js).

 1. Je begint met € 50 op zak.
 2. Bij de schuurdeur zet E je naar binnen, en binnen weer naar buiten.
 3. De deel heeft de maten van het pand uit de kaart en je loopt er niet doorheen.
 4. Aan de toonbank koop je voor € 50 honderd kogels; het geld gaat eraf.
 5. Met een lege portemonnee koop je niets.
 6. Het geld staat in de HUD en gaat mee in de opslag.

 Gebruik: python3 -m http.server 8123 &  node tools/winkeltest.mjs 8123
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
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
await page.evaluate(() => {
  localStorage.removeItem('tinga.spel.v1');
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  window.__zet = (p) => { g.player.pos.set(p.x, 0, p.z); g.player.applyCamera(); };
});
await page.waitForTimeout(600);

// ---------- 1. beginkapitaal ----------
kop('waar je mee begint');
const start = await page.evaluate(() => {
  const g = window.__game;
  return { geld: g.verhaal.geld, hud: document.getElementById('geld').textContent, reserve: g.player.reserve };
});
ok(start.geld === 50, 'je begint met vijftig euro', `€ ${start.geld}`);
ok(/50/.test(start.hud), 'en dat staat rechtsonder in beeld', start.hud);

// ---------- 2. naar binnen en naar buiten ----------
kop('de schuurdeur van Tinga State');
const deur = await page.evaluate(() => {
  const g = window.__game;
  const b = g.boerderij;
  if (!b || !b.plekken) return { er: false };
  const p = b.plekken;
  window.__zet(p.deurBuiten);
  const hintBuiten = (() => { b.update(0.1, false); const e = document.getElementById('praat'); return e.hidden ? '' : e.textContent; })();
  const gebruikt = b.toets();
  const na = { x: g.player.pos.x, z: g.player.pos.z };
  const binnen = b.binnen(na.x, na.z);
  const kaart = b.kaart(na.x, na.z);
  // en weer naar buiten
  const terug = b.toets();
  const uit = { x: g.player.pos.x, z: g.player.pos.z };
  return {
    er: true, hintBuiten, gebruikt, binnen, kaart: kaart ? kaart.naam : null, terug,
    weerBuiten: !b.binnen(uit.x, uit.z),
    afstandTotDeur: Math.hypot(uit.x - p.deurBuiten.x, uit.z - p.deurBuiten.z),
    maten: b.maten,
  };
});
ok(deur.er, 'de boerderij staat in de kaart en heeft een binnenkant');
ok(deur.hintBuiten.includes('E'), 'bij de deur staat de hint in beeld', deur.hintBuiten);
ok(deur.gebruikt && deur.binnen, 'met E sta je binnen');
ok(deur.kaart === 'Tinga State', 'en de HUD noemt de boerderij', String(deur.kaart));
ok(deur.terug && deur.weerBuiten, 'met E bij de deur sta je weer buiten',
  `${deur.afstandTotDeur.toFixed(1)} m van de deur`);
ok(deur.maten.breed > 20 && deur.maten.diep > 14,
  'de deel heeft de maten van het pand', `${deur.maten.breed.toFixed(1)} × ${deur.maten.diep.toFixed(1)} m`);
ok(deur.maten.nok > deur.maten.goot + 8,
  'met de steile kap van een stelpboerderij erboven',
  `goot ${deur.maten.goot.toFixed(2)} m, nok ${deur.maten.nok.toFixed(2)} m`);

// ---------- 3. de wanden houden je binnen ----------
kop('binnen blijf je binnen');
const muren = await page.evaluate(async () => {
  const g = window.__game;
  const b = g.boerderij;
  const W = await import('./js/world.js');
  const nul = b.plekken.nul, m = b.maten;
  const mid = { x: nul.x + m.breed / 2, z: nul.z + m.diep / 2 };
  // vanuit het midden in acht richtingen naar buiten lopen, met stapjes van
  // 15 cm zoals de speler ook loopt: overal hoort er een wand te staan
  const uit = [];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    let x = mid.x, z = mid.z;
    for (let s = 0; s < 400; s++) {
      const nx = x + Math.cos(a) * 0.15, nz = z + Math.sin(a) * 0.15;
      [x, z] = W.resolveCollisions(nx, nz, 0.35);
    }
    uit.push(!b.binnen(x, z));
  }
  // en het dak zit er ook op: niets steekt door de nok
  const THREE = await import('three');
  const doos = new THREE.Box3().setFromObject(b.groep);
  return { door: uit.filter(Boolean).length, top: doos.max.y, bodem: doos.min.y, nok: m.nok };
});
ok(muren.door === 0, 'de wanden en de dichte schuurdeur houden je binnen',
  `${8 - muren.door} van 8 richtingen dicht`);
ok(muren.top <= muren.nok + 0.02 && muren.bodem > -0.02,
  'niets steekt door de kap of door de vloer',
  `van ${muren.bodem.toFixed(2)} tot ${muren.top.toFixed(2)} m`);

// ---------- 4. munitie kopen ----------
kop('de toonbank');
const koop = await page.evaluate(() => {
  const g = window.__game;
  const b = g.boerderij;
  window.__zet(b.plekken.toonbank);
  b.update(0.1, false);
  const hint = (() => { const e = document.getElementById('praat'); return e.hidden ? '' : e.textContent; })();
  const voorGeld = g.verhaal.geld, voorKogels = g.player.reserve;
  const gebruikt = b.toets();
  return {
    hint, gebruikt, voorGeld, voorKogels,
    naGeld: g.verhaal.geld, naKogels: g.player.reserve,
    hud: document.getElementById('geld').textContent,
    melding: document.getElementById('melding') ? document.getElementById('melding').textContent : '',
  };
});
ok(koop.hint.includes('kogels') && koop.hint.includes('50'), 'aan de toonbank vertelt de hint wat het kost', koop.hint);
ok(koop.gebruikt, 'met E reken je af');
ok(koop.naKogels === koop.voorKogels + 100, 'je krijgt honderd kogels',
  `${koop.voorKogels} → ${koop.naKogels}`);
ok(koop.naGeld === koop.voorGeld - 50, 'en er gaat vijftig euro af',
  `€ ${koop.voorGeld} → € ${koop.naGeld}`);

// ---------- 5. zonder geld geen kogels ----------
const arm = await page.evaluate(() => {
  const g = window.__game;
  const b = g.boerderij;
  const voor = g.player.reserve;
  const uit = b.koop();                        // portemonnee is nu leeg
  return { uit, voor, na: g.player.reserve, geld: g.verhaal.geld };
});
ok(arm.uit === 'arm' && arm.na === arm.voor, 'met een lege portemonnee koop je niets',
  `€ ${arm.geld}, ${arm.na} kogels`);

// ---------- 6. verdiend geld kun je uitgeven ----------
const nieuw = await page.evaluate(() => {
  const g = window.__game;
  const b = g.boerderij;
  g.verhaal.herstel({ ...g.verhaal.bewaar(), geld: 500 });
  const voor = { geld: g.verhaal.geld, kogels: g.player.reserve };
  const r1 = b.koop(), r2 = b.koop();
  return { voor, r1, r2, geld: g.verhaal.geld, kogels: g.player.reserve };
});
ok(nieuw.r1 === 'ok' && nieuw.r2 === 'ok', 'met het geld uit de missies koop je gewoon door');
ok(nieuw.geld === nieuw.voor.geld - 100 && nieuw.kogels === nieuw.voor.kogels + 200,
  'twee dozen kosten honderd euro en geven tweehonderd kogels',
  `€ ${nieuw.voor.geld} → € ${nieuw.geld}, ${nieuw.voor.kogels} → ${nieuw.kogels} kogels`);

// ---------- 7. het winkeltje op de kaart ----------
kop('op de kaart');
const kaart = await page.evaluate(async () => {
  const g = window.__game;
  const b = g.boerderij;
  const w = (g.hud.winkels || [])[0];
  if (!w) return { er: false };
  // ga buiten bij de boerderij staan en tel de amberkleurige beeldpunten op de
  // minikaart: die kunnen alleen van het icoontje komen
  window.__zet(b.plekken.stoep);
  g.hud.drawMap(g.player, g.vehicles, g.npcs);
  const cv = g.hud.canvas, c = cv.getContext('2d');
  const d = c.getImageData(0, 0, cv.width, cv.height).data;
  let amber = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] > 210 && d[i + 1] > 150 && d[i + 1] < 210 && d[i + 2] < 110) amber++;
  }
  // en op de grote kaart hoort de naam erbij te staan
  const groot = (() => {
    if (!g.hud.bigOpen) g.hud.toggleBig();
    g.hud.drawBig(g.player, g.vehicles);
    const cb = g.hud.big, cc = cb.getContext('2d');
    const dd = cc.getImageData(0, 0, cb.width, cb.height).data;
    let n = 0;
    for (let i = 0; i < dd.length; i += 4) {
      if (dd[i] > 210 && dd[i + 1] > 150 && dd[i + 1] < 210 && dd[i + 2] < 110) n++;
    }
    g.hud.toggleBig();
    return n;
  })();
  return {
    er: true, naam: w.naam, amber, groot,
    bijDeur: Math.hypot(w.x - b.plekken.deurBuiten.x, w.z - b.plekken.deurBuiten.z),
  };
});
ok(kaart.er && kaart.naam === 'Tinga State', 'de winkel staat als plek in de HUD', String(kaart.naam));
ok(kaart.bijDeur < 0.01, 'op de plek van de schuurdeur', `${kaart.bijDeur.toFixed(2)} m ernaast`);
ok(kaart.amber > 40, 'en het icoontje staat op de minikaart', `${kaart.amber} beeldpunten`);
ok(kaart.groot > 40, 'en ook op de grote kaart', `${kaart.groot} beeldpunten`);

// ---------- 8. de politie blijft buiten ----------
kop('binnen ben je even veilig');
const rust = await page.evaluate(() => {
  const g = window.__game;
  const b = g.boerderij;
  window.__zet(b.plekken.deurBinnen);
  return { binnen: b.binnen(g.player.pos.x, g.player.pos.z) };
});
ok(rust.binnen, 'de deel telt als binnen, dus de politie zoekt daar niet');

console.log(fouten ? `\n${fouten} fout(en).` : '\nAlles goed.');
await browser.close();
process.exit(fouten ? 1 : 0);
