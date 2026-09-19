/*
 Het gedrag dat op 19 september 2026 is aangepast.

   npm run server &   node tools/gedragtest.mjs [poort]

 Vier dingen, allemaal onzichtbaar op een foto:

 1. Binnen — bij de Poiesz, bij Tinga State en in de woningen — hoort het wapen
    uit beeld te zijn. Je kunt er toch niets mee: er is niemand om op te schieten
    en de politie loopt binnen niet mee.
 2. Schiet je twintig mensen neer, dan kwamen die een halve minuut later ergens
    in de hele wereld terug. Over bijna elf vierkante kilometer betekent dat: de
    straat waar jíj staat blijft leeg. Ze horen terug te komen in de band om je
    heen, en nooit in je blikveld.
 3. Met vijf sterren naar IJlst rijden gaf een lege weg: het anker van de
    zoekactie bleef op de laatst bekende plek in Tinga liggen en daar stond de
    hele macht. Het anker hoort met je mee te schuiven, en hoe meer sterren hoe
    korter die lijn.
 4. Een neergehaalde helikopter en een stilgelegde politieboot gaven een regel
    tekst in beeld. Die horen weg te zijn.
*/
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const poort = process.argv[2] || '8123';
let goed = 0, fout = 0;
const ok = (naam, waar, extra = '') => {
  if (waar) { goed++; console.log(`  ✓ ${naam}${extra ? ' — ' + extra : ''}`); }
  else { fout++; console.log(`  ✗ ${naam}${extra ? ' — ' + extra : ''}`); }
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const fouten = [];
page.on('pageerror', e => fouten.push(e.message));
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });
await page.evaluate(() => {
  const g = window.__game;
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true;
});

// ------------------------------------------------------- het wapen binnen
console.log('\nhet wapen in de winkel');
const binnen = await page.evaluate(async () => {
  const g = window.__game;
  const uit = {};
  // buiten: met het wapen in de hand hoort hij gewoon te zien te zijn
  g.player.binnen = false; g.player.wapenUit = false;
  g.player.wapenStap(0.016);
  uit.buitenZichtbaar = g.player.gun.visible;
  uit.buitenSchiet = g.player.magSchieten();
  uit.buitenRicht = g.player.richten(true);
  // binnen: weg, en er valt niet te richten of te schieten
  g.player.richten(false);
  g.player.binnen = true;
  g.player.wapenStap(0.016);
  uit.binnenZichtbaar = g.player.gun.visible;
  uit.binnenSchiet = g.player.magSchieten();
  uit.binnenRicht = g.player.richten(true);
  g.player.update(0.016);
  uit.kruis = document.getElementById('crosshair').style.display;
  // en buiten heb je hem meteen weer: `wapenUit` (jouw keuze) is niet aangeraakt
  g.player.binnen = false;
  g.player.wapenStap(0.016);
  uit.terug = g.player.gun.visible && g.player.wapenUit === false;
  return uit;
});
ok('buiten staat het wapen in beeld', binnen.buitenZichtbaar && binnen.buitenSchiet);
ok('en kun je richten', binnen.buitenRicht === true);
ok('binnen is het wapen uit beeld', binnen.binnenZichtbaar === false);
ok('binnen schiet je niet', binnen.binnenSchiet === false);
ok('binnen richt je niet', binnen.binnenRicht === false);
ok('en het kruisje staat uit', binnen.kruis === 'none', `display="${binnen.kruis}"`);
ok('buiten heb je hem meteen weer terug', binnen.terug === true);

// echt naar binnen lopen, zodat de vlag ook uit js/main.js komt en niet alleen
// uit deze test
const echtBinnen = await page.evaluate(async () => {
  const g = window.__game;
  if (!g.supermarkt || !g.supermarkt.plekken) return null;
  const p = g.supermarkt.plekken.deurBinnen;
  g.player.pos.set(p.x, 0, p.z);
  for (let i = 0; i < 4; i++) await new Promise(r => requestAnimationFrame(r));
  return { binnen: g.player.binnen, zichtbaar: g.player.gun.visible };
});
ok('en in de Poiesz zelf gaat hij ook weg',
  echtBinnen && echtBinnen.binnen === true && echtBinnen.zichtbaar === false,
  echtBinnen ? `binnen=${echtBinnen.binnen}, wapen=${echtBinnen.zichtbaar}` : 'geen supermarkt');

// --------------------------------------------------- voetgangers komen terug
console.log('\nde voetgangers komen terug waar jij bent');
const terug = await page.evaluate(async () => {
  const g = window.__game;
  const { KAART } = await import('/js/kaart.js');
  g.player.pos.set(KAART.start.x, 0, KAART.start.z);
  const cx = g.player.pos.x, cz = g.player.pos.z;
  // twintig levende mensen neerhalen, net als in de melding
  const doel = g.npcs.people.filter(p => p.alive).slice(0, 20);
  for (const p of doel) { p.alive = false; p.respawn = 0.2; p.fall = 0; }
  // en dan de tijd vooruitzetten tot ze allemaal terug zijn
  for (let i = 0; i < 40; i++) g.npcs.update(1 / 30, i / 30, cx, cz);
  const levend = doel.filter(p => p.alive);
  const afstanden = levend.map(p => Math.hypot(p.x - cx, p.z - cz));
  return {
    neer: doel.length,
    terug: levend.length,
    binnenDeBand: afstanden.filter(d => d <= 230).length,
    verst: afstanden.length ? Math.max(...afstanden) : 0,
    dichtst: afstanden.length ? Math.min(...afstanden) : 0,
  };
});
ok('alle twintig zijn terug', terug.terug === terug.neer, `${terug.terug} van ${terug.neer}`);
ok('en ze staan in de buurt en niet ergens in de polder',
  terug.binnenDeBand >= terug.terug * 0.8,
  `${terug.binnenDeBand} van ${terug.terug} binnen 230 m, verst ${terug.verst.toFixed(0)} m`);
ok('niemand verschijnt pal voor je neus', terug.dichtst > 40, `dichtstbij ${terug.dichtst.toFixed(0)} m`);

// ------------------------------------------------- de politie komt achter je aan
console.log('\nde politie volgt je naar IJlst');
const jacht = await page.evaluate(async () => {
  const g = window.__game;
  const { KAART } = await import('/js/kaart.js');
  const meet = (ster, naarIJlst) => {
    g.politie.zetHeat(0);
    g.player.pos.set(KAART.start.x, 0, KAART.start.z);
    for (let i = 0; i < 10; i++) g.politie.update(1 / 30);
    g.politie.zetHeat(ster);                   // heat hoog genoeg voor het aantal sterren
    for (let i = 0; i < 30; i++) g.politie.update(1 / 30);
    // en dan in één ruk naar IJlst (of blijven staan)
    if (naarIJlst) g.player.pos.set(-1500, 0, 900);
    // twintig seconden doorspelen; het anker schuift met 45 m/s bij
    for (let i = 0; i < 20 * 30; i++) { g.politie.zetHeat(ster); g.politie.update(1 / 30); }
    const plekken = g.politie.plekken || [];
    const d = plekken.map(p => Math.hypot(p.x - g.player.pos.x, p.z - g.player.pos.z));
    return { ster: g.politie.ster, eenheden: plekken.length, dichtst: d.length ? Math.min(...d) : Infinity };
  };
  return { vijf: meet(400, true), een: meet(20, true) };
});
ok('met vijf sterren staat er in IJlst politie om je heen',
  jacht.vijf.ster === 5 && jacht.vijf.dichtst < 400,
  `${jacht.vijf.ster} sterren, ${jacht.vijf.eenheden} eenheden, dichtstbij ${jacht.vijf.dichtst.toFixed(0)} m`);
ok('met één ster kun je ze nog gewoon afschudden',
  jacht.een.ster <= 1,
  `${jacht.een.ster} ster, dichtstbij ${jacht.een.dichtst === Infinity ? 'geen' : jacht.een.dichtst.toFixed(0) + ' m'}`);

// ------------------------------------------------------------- geen meldingen
console.log('\ngeen tekst bij een neergehaalde helikopter of politieboot');
/*
 Op de aanroep toetsen en niet op het woord: in allebei de bestanden staat nu
 een uitleg waaróm de tekst weg is, en daar komt de oude regel letterlijk in
 voor. Een test die naar de tekst zoekt zou daarop afgaan en dus blijven falen
 terwijl het juist goed is.
*/
const bron = (p) => readFileSync(p, 'utf8');
ok('er wordt geen tekst meer getoond bij een neergehaalde helikopter',
  !/hud\.show\([^)]*Helikopter/.test(bron('js/main.js')));
ok('en niet bij een stilgelegde politieboot',
  !/hud\.show\([^)]*politieboot/i.test(bron('js/politieboot.js')));
const melding = await page.evaluate(() => {
  // de grote melding en de regel bovenin staan allebei op onzichtbaar
  const msg = document.getElementById('msg'), mis = document.getElementById('missie');
  return { msg: msg.style.opacity, missie: mis.style.opacity };
});
ok('en er staat op dit moment geen melding in beeld',
  (melding.msg === '' || Number(melding.msg) === 0) && (melding.missie === '' || Number(melding.missie) === 0),
  `msg="${melding.msg}" missie="${melding.missie}"`);

console.log(`\nfouten in de pagina: ${fouten.length ? fouten.join(' | ') : 'geen'}`);
if (fouten.length) fout++;
console.log(`\n${goed} goed, ${fout} fout`);
await browser.close();
process.exit(fout ? 1 : 0);
