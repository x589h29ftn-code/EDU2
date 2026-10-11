/*
 Stap 138: levens zoals in GTA, nagemeten.

   node tools/server.mjs 8123 &   node tools/levenstest.mjs [poort]   (npm run levenstest)

 1. Vanzelf herstel: na LEVEN.wacht tellen zonder treffer komt het leven terug, LEVEN.tempo per
    seconde, tot de helft en nooit verder; geraakt worden zet de wachttijd opnieuw; neer is neer.
 2. Boven de helft alleen met eten: kibbeling bij Martens gaat boven 50, en het herstel haalt daar
    niets af of bij.
 3. EHBO-dozen bij Tinga State: kopen tot vijf, de zesde niet, het leven blijft gelijk bij het kopen.
 4. L zet er een in: +40, nooit boven 100, één doos minder; niet bij vol leven of zonder dozen.
 5. De HUD: een streepje op de helft van de balk, het doosje met het aantal, weg bij nul;
    L staat in de besturing van het menu.
 6. De opslag onthoudt de dozen.
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fouten++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);
const r1 = (n) => (n == null || !isFinite(n)) ? String(n) : n.toFixed(1);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 560 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(() => {
  for (const k of Object.keys(localStorage)) if (k.startsWith('tinga.')) localStorage.removeItem(k);
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = false;
  window.__autoplay = false;
  g.sfeer.uur = 12;
});

// ------------------------------------------------------------------ 1. vanzelf herstel
kop('vanzelf terug tot de helft');
const herstel = await page.evaluate(async () => {
  const g = window.__game, P = g.player, G = g.gezondheid;
  const { LEVEN } = await import('/js/gezondheid.js');
  const stap = (s, dt = 0.05) => { for (let t = 0; t < s - 1e-9; t += dt) G.update(dt); };
  // een treffer: van 100 naar 20
  P.health = 100; stap(0.1);
  P.health = 20; stap(0.05);
  const naTreffer = P.health;
  stap(LEVEN.wacht - 0.5);
  const voorWacht = P.health;                  // nog in de wachttijd: niets erbij
  stap(1.5);
  const naWacht = P.health;                    // een seconde herstel: ~ +2
  // weer geraakt: wachten begint opnieuw
  P.health -= 5; stap(0.05);
  const geraakt = P.health;
  stap(LEVEN.wacht - 0.5);
  const weerWacht = P.health;
  stap(60);
  const lang = P.health;                       // een minuut later: precies de helft
  stap(30);
  const langer = P.health;
  // boven de helft blijft het staan
  P.health = 60; stap(30);
  const zestig = P.health;
  // neer is neer
  P.health = 0; stap(20);
  const neer = P.health;
  P.health = 100; stap(0.1);
  return { LEVEN, naTreffer, voorWacht, naWacht, geraakt, weerWacht, lang, langer, zestig, neer };
});
const L = herstel.LEVEN;
ok(L.vanzelfTot === 50 && L.maxPacks === 5 && L.packLeven === 40, 'LEVEN: vanzelf tot 50, vijf dozen, +40 per doos', JSON.stringify(L));
ok(herstel.voorWacht === herstel.naTreffer, `de eerste ${L.wacht} tellen na een treffer komt er niets bij`, `${r1(herstel.naTreffer)} → ${r1(herstel.voorWacht)}`);
ok(herstel.naWacht > herstel.voorWacht + 0.5 && herstel.naWacht < herstel.voorWacht + 3.5,
  `daarna langzaam: ${L.tempo} per seconde`, `${r1(herstel.voorWacht)} → ${r1(herstel.naWacht)} in 1,5 s (waarvan 0,5 wachten)`);
ok(herstel.weerWacht === herstel.geraakt, 'opnieuw geraakt: de wachttijd begint opnieuw', `${r1(herstel.geraakt)} → ${r1(herstel.weerWacht)}`);
ok(herstel.lang === L.vanzelfTot && herstel.langer === L.vanzelfTot, 'tot de helft en nooit verder', `${r1(herstel.lang)}, ${r1(herstel.langer)}`);
ok(herstel.zestig === 60, 'boven de helft komt er vanzelf niets bij', r1(herstel.zestig));
ok(herstel.neer === 0, 'neer is neer: op nul geen herstel', r1(herstel.neer));

// ------------------------------------------------------------------ 2. eten boven de helft
kop('kibbeling gaat boven de helft');
const eten = await page.evaluate(async () => {
  const g = window.__game, V = g.vishandel, v = g.verhaal, P = g.player, G = g.gezondheid;
  if (!V) return null;
  const s = V.stand, lz = 2.2;
  P.active = true;
  g.sfeer.uur = 12;
  P.pos.set(s.x + lz * Math.sin(s.yaw), 0, s.z + lz * Math.cos(s.yaw));
  P.health = 50; for (let i = 0; i < 4; i++) G.update(0.05);
  v.verdien(100);
  V.update(5);
  V.toets();
  const na = P.health;
  for (let i = 0; i < 400; i++) G.update(0.05);   // twintig tellen herstel: blijft staan
  const later = P.health;
  P.active = false;
  return { na, later };
});
ok(eten && eten.na === 75, 'kibbeling: 50 → 75', eten && r1(eten.na));
ok(eten && eten.later === 75, 'en het herstel laat dat staan', eten && r1(eten.later));

// ------------------------------------------------------------------ 3. EHBO-dozen kopen
kop('EHBO-dozen bij Tinga State');
const koop = await page.evaluate(async () => {
  const g = window.__game, P = g.player, b = g.boerderij, v = g.verhaal;
  const { EHBO } = await import('/js/boerderij.js');
  P.active = true;                 // aan de toonbank kopen kan alleen tijdens het spelen
  P.pos.set(b.plekken.toonbank.x, 0, b.plekken.toonbank.z);
  P.packs = 0; P.health = 35;
  v.verdien(2000);
  b.update(0.1, false);
  const kaartje = [...document.querySelectorAll('#schap .kaart')].some(k => /EHBO/.test(k.textContent) && k.textContent.includes(String(EHBO.prijs)));
  const geld0 = v.geld;
  const uitslagen = [];
  for (let i = 0; i < 5; i++) {
    const nr = b.schap.findIndex(a => a.sleutel === 'ehbo') + 1;
    uitslagen.push(nr > 0 ? (b.toets(String(nr)) ? 'ok' : 'niet') : 'weg');
  }
  const naVijf = { packs: P.packs, betaald: geld0 - v.geld, leven: P.health };
  const geld5 = v.geld;
  const zesde = b.koopLeven();
  const naZes = { packs: P.packs, betaald: geld5 - v.geld };
  b.update(0.1, false);
  const nogInSchap = b.schap.some(a => a.sleutel === 'ehbo');
  P.active = false;
  return { EHBO, kaartje, uitslagen, naVijf, zesde, naZes, nogInSchap };
});
ok(koop.kaartje, `een kaartje "EHBO-doos" met € ${koop.EHBO.prijs} in het schap`);
ok(koop.naVijf.packs === 5 && koop.naVijf.betaald === 5 * koop.EHBO.prijs, 'vijf gekocht', `${koop.uitslagen.join(',')}, € ${koop.naVijf.betaald}`);
ok(koop.naVijf.leven === 35, 'kopen geeft geen leven: je neemt ze mee', r1(koop.naVijf.leven));
ok(koop.zesde === 'vol' && koop.naZes.packs === 5 && koop.naZes.betaald === 0, 'een zesde kan niet, en kost niets', `${koop.zesde}, € ${koop.naZes.betaald}`);
ok(!koop.nogInSchap, 'met vijf staat hij niet meer in het schap');

// ------------------------------------------------------------------ 4. inzetten met L
kop('L zet een doos in');
const inzet = await page.evaluate(() => {
  const g = window.__game, P = g.player;
  P.active = true;
  P.pos.set(10, 0, -7);
  const druk = () => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyL', key: 'l', bubbles: true }));
  P.health = 35;
  druk();
  const een = { leven: P.health, packs: P.packs };
  P.health = 80;
  druk();
  const twee = { leven: P.health, packs: P.packs };
  // vol: niets
  druk();
  const vol = { leven: P.health, packs: P.packs };
  // zonder dozen: niets
  P.packs = 0; P.health = 30;
  const leeg = g.levenToets();
  const geen = { uit: leeg, leven: P.health, packs: P.packs };
  // neer: niets
  P.packs = 2; P.health = 0;
  const neerUit = g.levenToets();
  const neer = { uit: neerUit, leven: P.health, packs: P.packs };
  // op het startscherm: niets
  P.active = false; P.health = 30;
  const menuUit = g.levenToets();
  const menu = { uit: menuUit, leven: P.health, packs: P.packs };
  P.health = 100;
  return { een, twee, vol, geen, neer, menu };
});
ok(inzet.een.leven === 75 && inzet.een.packs === 4, 'L: 35 → 75, één doos minder', JSON.stringify(inzet.een));
ok(inzet.twee.leven === 100 && inzet.twee.packs === 3, 'nooit boven 100: 80 → 100', JSON.stringify(inzet.twee));
ok(inzet.vol.leven === 100 && inzet.vol.packs === 3, 'bij vol leven gebruikt L niets', JSON.stringify(inzet.vol));
ok(inzet.geen.uit === 'geen' && inzet.geen.leven === 30, 'zonder dozen gebeurt er niets', JSON.stringify(inzet.geen));
ok(inzet.neer.uit === 'neer' && inzet.neer.packs === 2, 'neer: geen doos', JSON.stringify(inzet.neer));
ok(inzet.menu.uit === null && inzet.menu.packs === 2, 'op het startscherm doet L niets', JSON.stringify(inzet.menu));

// ------------------------------------------------------------------ 5. de HUD
kop('de levensbalk en de dozen');
const hud = await page.evaluate(async () => {
  const g = window.__game, P = g.player, G = g.gezondheid;
  P.packs = 3; G.update(0.016);
  const balk = document.getElementById('leven').getBoundingClientRect();
  const helft = document.getElementById('levenhelft').getBoundingClientRect();
  const el = document.getElementById('levenpacks');
  const zichtbaar = getComputedStyle(el).display !== 'none';
  const tekst = el.textContent;
  const doos = el.querySelector('.doos').getBoundingClientRect();
  const rood = getComputedStyle(el.querySelector('.doos'), '::before').backgroundColor;
  const label = document.getElementById('levenlabel').getBoundingClientRect();
  const r = el.getBoundingClientRect();
  P.packs = 0; G.update(0.016);
  const weg = getComputedStyle(el).display === 'none';
  const menu = await (await fetch('/js/menu.js')).text();
  return {
    midden: (helft.left + helft.right) / 2, balkMidden: (balk.left + balk.right) / 2, helftH: helft.height, balkH: balk.height,
    zichtbaar, tekst, doosB: doos.width, rood, overlapt: r.left < label.right, weg,
    inMenu: /\['L',\s*'een EHBO-doos/.test(menu),
  };
});
ok(Math.abs(hud.midden - hud.balkMidden) < 2 && hud.helftH >= hud.balkH, 'een streepje op de helft van de balk', `${r1(hud.midden)} tegen ${r1(hud.balkMidden)}`);
ok(hud.zichtbaar && /×3/.test(hud.tekst) && hud.doosB > 8, 'het doosje met het aantal naast het getal', hud.tekst);
ok(/rgb\(214, 42, 42\)/.test(hud.rood), 'met een rood kruis', hud.rood);
ok(!hud.overlapt, 'niet over het getal van het leven heen');
ok(hud.weg, 'zonder dozen staat het er niet');
ok(hud.inMenu, 'L staat in de besturing van het menu');

// ------------------------------------------------------------------ 6. de opslag
kop('de opslag');
const opslag = await page.evaluate(async () => {
  const g = window.__game, P = g.player;
  const O = await import('/js/opslag.js');
  P.packs = 4; P.health = 70;
  O.bewaarSpel({ player: P, sfeer: g.sfeer, vehicles: g.vehicles, verhaal: g.verhaal, garage: g.garage });
  const ruw = Object.keys(localStorage).filter(k => k.startsWith('tinga.spel.v1')).map(k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } })
    .filter(d => d && d.speler).sort((a, b) => b.tijd - a.tijd)[0];
  P.packs = 0; P.health = 100;
  O.laadSpel({ player: P, sfeer: g.sfeer, vehicles: g.vehicles, verhaal: g.verhaal, garage: g.garage });
  g.gezondheid.update(0.016);
  return { bewaard: ruw ? ruw.speler.packs : null, terug: P.packs, leven: P.health, hud: document.getElementById('levenpacksN').textContent };
});
ok(opslag.bewaard === 4 && opslag.terug === 4, 'de opslag onthoudt de dozen', JSON.stringify(opslag));
ok(opslag.hud === '×4', 'en na het laden staan ze in beeld', opslag.hud);

console.log(fouten ? `\n${fouten} FOUT` : '\nalles goed');
await browser.close();
process.exit(fouten ? 1 : 0);
