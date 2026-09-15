/*
 De politie op het water.

   npm run server &   node tools/watertest.mjs [poort]

 Op de Geeuw was je veilig: de politie rijdt over de weg, dus wie de sloep nam
 was van de achtervolging af. Er komt nu een politieboot achter je aan, en alleen
 als dat ergens op slaat — je zit zelf in een boot én er is verdenking.

 Wat hier getoetst wordt is vooral wanneer hij er níet is, want dat is de helft
 van de eis: aan de wal met vijf sterren komt er geen boot, en op het water
 zonder sterren ook niet.
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let goed = 0, fout = 0;
const ok = (naam, waar, extra = '') => {
  if (waar) { goed++; console.log(`  ✓ ${naam}`); }
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
await page.waitForFunction(() => window.__game && window.__game.politieboot, null, { timeout: 300000 });

await page.evaluate(() => {
  const g = window.__game;
  g.player.active = true;
  /*
   Ruim water om op te meten, hetzelfde stuk als tools/boottest.mjs gebruikt: het
   grootste watervlak in het spel meet vijfhonderd bij zeshonderd meter. Een boot
   die op de Geeuw achter je aan komt varen moet daar de ruimte voor hebben.
  */
  window.__opWater = (yaw = -0.785) => {
    if (!g.boten.inBoot) g.boten.stapIn(g.boten.ruw(0));
    g.boten.verplaats(g.boten.inBoot, 1650, 1390, yaw);
    return !!g.boten.inBoot;
  };
  window.__vanBoord = () => {
    if (!g.boten.inBoot) return true;
    g.boten.herstel({ boten: g.boten.bewaar().boten, aanBoord: -1 });
    return !g.boten.inBoot;
  };
  // een aantal beelden laten lopen zonder op de klok te wachten
  window.__loop = (n, dt = 1 / 30) => {
    let schade = 0;
    for (let i = 0; i < n; i++) {
      g.boten.update(dt, null);
      schade += g.politieboot.update(dt) || 0;
    }
    return schade;
  };
  /*
   Verdenking zetten. Niet via `misdaad`: die kijkt of er getuigen zijn, en midden
   op de Geeuw is er niemand die iets ziet — dan blijft het bij nul sterren en
   toets je niets. `zetHeat` zet de verdenking rechtstreeks, zoals tools/helitest
   dat ook doet.
  */
  window.__ster = (heat) => g.politie.zetHeat(heat);
});

// ---------- wanneer komt hij niet? ----------
console.log('\nhij komt alleen als het ergens op slaat');
const niet = await page.evaluate(() => {
  const g = window.__game;
  // 1. op het water, maar niets aan de hand
  g.politieboot.reset();
  g.politie.reset();
  window.__opWater();
  window.__loop(600);
  const zonderSter = g.politieboot.actief;
  // 2. gezocht, maar op de kant
  g.politieboot.reset();
  window.__vanBoord();
  g.player.pos.set(0, 0, 0);
  window.__ster(300);
  window.__loop(600);
  const opDeKant = g.politieboot.actief;
  return { zonderSter, opDeKant, ster: g.politie.ster };
});
ok('op het water zonder verdenking komt er geen boot', niet.zonderSter === false);
ok('en met verdenking op de kant ook niet', niet.opDeKant === false, `${niet.ster} sterren`);

// ---------- en wanneer wel? ----------
console.log('\nop het water met sterren komt hij eraan');
const wel = await page.evaluate(() => {
  const g = window.__game;
  g.politieboot.reset();
  g.politie.reset();
  window.__opWater();
  const jij = g.boten.inBoot;
  window.__ster(300);
  window.__loop(240);                       // vier seconden: hij moet er zijn
  const er = g.politieboot.actief;
  const plek = g.politieboot.plek;
  const afstand = plek ? Math.hypot(plek.x - jij.x, plek.z - jij.z) : -1;
  return { er, afstand, fase: g.politieboot.fase, top: g.politieboot.top, jouwTop: g.boten.top };
});
ok('er komt een politieboot', wel.er, wel.fase);
ok('en hij begint op afstand', wel.afstand > 60, `${wel.afstand.toFixed(0)} m`);
ok('hij loopt harder dan jouw sloep', wel.top > wel.jouwTop,
  `${wel.top.toFixed(1)} tegen ${wel.jouwTop.toFixed(1)} m/s`);

// ---------- hij komt dichterbij ----------
console.log('\nen hij komt achter je aan');
const jacht = await page.evaluate(() => {
  const g = window.__game;
  const jij = g.boten.inBoot;
  const p0 = g.politieboot.plek;
  const d0 = Math.hypot(p0.x - jij.x, p0.z - jij.z);
  /*
   De hoogste vaart onderweg, niet die aan het eind: jij ligt stil, dus tegen de
   tijd dat hij langszij ligt heeft hij het gas eraf en staat de teller weer op
   nul. Dat hoort zo — het is geen aanvaring.
  */
  let top = 0;
  for (let i = 0; i < 900; i++) { window.__loop(1); top = Math.max(top, g.politieboot.vaart); }
  const p1 = g.politieboot.plek;
  const d1 = p1 ? Math.hypot(p1.x - jij.x, p1.z - jij.z) : -1;
  return { d0, d1, vaart: top, actief: g.politieboot.actief };
});
ok('hij vaart', jacht.vaart > 3, `hoogste vaart onderweg ${jacht.vaart.toFixed(2)} m/s`);
ok('en hij komt dichterbij', jacht.actief && jacht.d1 < jacht.d0 - 20,
  `van ${jacht.d0.toFixed(0)} naar ${jacht.d1.toFixed(0)} m`);
ok('hij blijft op het water', await page.evaluate(async () => {
  const { vaarbaar } = await import('/js/world.js');
  const p = window.__game.politieboot.plek;
  return !!p && vaarbaar(p.x, p.z);
}));

// ---------- schieten ze? ----------
console.log('\nen er wordt geschoten');
const vuur = await page.evaluate(() => {
  const g = window.__game;
  const jij = g.boten.inBoot;
  // de boot vlak naast je zetten kan niet van buitenaf, dus we varen door tot
  // hij langszij ligt en tellen dan wat het kost
  let schade = 0;
  for (let i = 0; i < 1800; i++) {
    g.boten.update(1 / 30, null);
    schade += g.politieboot.update(1 / 30) || 0;
  }
  const p = g.politieboot.plek;
  return { schade, afstand: p ? Math.hypot(p.x - jij.x, p.z - jij.z) : -1 };
});
ok('hij komt langszij', vuur.afstand > 0 && vuur.afstand < 40, `${vuur.afstand.toFixed(0)} m`);
ok('en van boord af wordt er op je geschoten', vuur.schade > 0, `${vuur.schade} schade`);

// ---------- erop schieten ----------
console.log('\nje kunt hem uitschakelen');
const kapot = await page.evaluate(() => {
  const g = window.__game;
  const doelen = g.politieboot.doelen();
  if (!doelen.length) return { gevonden: false };
  // een willekeurig onderdeel van de romp als treffer aanbieden
  let romp = null;
  doelen[0].traverse(o => { if (!romp && o.isMesh) romp = o; });
  const max = g.politieboot.maxHp;
  let raak = 0;
  for (let i = 0; i < max + 3 && g.politieboot.fase !== 'wrak'; i++) if (g.politieboot.raak(romp)) raak++;
  return { gevonden: true, raak, max, fase: g.politieboot.fase };
});
ok('er is een romp om op te mikken', kapot.gevonden);
ok('en na veertien treffers ligt hij stil', kapot.fase === 'wrak',
  `${kapot.raak} treffers van ${kapot.max}, fase ${kapot.fase}`);

// ---------- van boord: hij gaat weg ----------
console.log('\nstap je van boord, dan draait hij af');
const weg = await page.evaluate(() => {
  const g = window.__game;
  g.politieboot.reset();
  g.politie.reset();
  window.__opWater();
  window.__ster(300);
  window.__loop(240);
  const er = g.politieboot.actief;
  window.__vanBoord();
  g.politie.reset();                        // en ze zijn je kwijt
  window.__loop(3600);                      // twee minuten
  return { er, na: g.politieboot.actief, fase: g.politieboot.fase };
});
ok('hij was er', weg.er);
ok('en hij is weg zodra je van boord bent en ze je kwijt zijn',
  weg.na === false, `fase ${weg.fase}`);

console.log(`\nfouten in de pagina: ${fouten.length ? fouten.join(' | ') : 'geen'}`);
if (fouten.length) fout++;
console.log(`\n${goed} goed, ${fout} fout`);
await browser.close();
process.exit(fout ? 1 : 0);
