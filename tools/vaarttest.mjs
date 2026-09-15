/*
 De lading over het water: ophalen in IJlst, afleveren aan de Geeuwkade.

   npm run server &   node tools/vaarttest.mjs [poort]

 Het eerste wat hier gemeten wordt is of de missie überhaupt te doen is: liggen
 de twee sloepen aan hetzelfde water? Dat is geen vanzelfsprekendheid — IJlst en
 de Geeuw zijn twee aparte watervlakken in de BGT — en als het antwoord nee was,
 was de hele missie een onmogelijke opdracht geweest.

 Daarna het verloop: de lading komt aan boord zodra je in de sloep in IJlst stapt,
 de verdenking loopt vanaf dat moment op, en bij de kade is hij over.
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
await page.waitForFunction(() => window.__game && window.__game.vaart, null, { timeout: 300000 });

await page.evaluate(() => {
  const g = window.__game;
  g.player.active = true;
  window.__loop = (n, dt = 1 / 30) => {
    for (let i = 0; i < n; i++) { g.boten.update(dt, null); g.vaart.update(dt); }
  };
});

// ---------- is de overtocht te varen? ----------
console.log('\nde vaarweg tussen de twee ligplaatsen');
const weg = await page.evaluate(async () => {
  const { vaarRoute } = await import('/js/vaart.js');
  const { LIGPLAATSEN } = await import('/js/boot.js');
  const { vaarbaar } = await import('/js/world.js');
  const t0 = performance.now();
  const r = vaarRoute({ x: LIGPLAATSEN[1].x, z: LIGPLAATSEN[1].z }, LIGPLAATSEN[0].wal);
  const ms = performance.now() - t0;
  if (!r) return { er: false, ms };
  let lengte = 0;
  for (let i = 1; i < r.length; i++) lengte += Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]);
  return {
    er: true, ms, punten: r.length, lengte,
    hemelsbreed: Math.hypot(LIGPLAATSEN[0].wal.x - LIGPLAATSEN[1].x, LIGPLAATSEN[0].wal.z - LIGPLAATSEN[1].z),
    opWater: r.filter(([x, z]) => vaarbaar(x, z)).length,
  };
});
ok('IJlst en de Geeuw liggen aan hetzelfde water', weg.er);
ok('de route is langer dan de rechte lijn, zoals een vaart hoort te zijn',
  weg.er && weg.lengte > weg.hemelsbreed, `${Math.round(weg.lengte)} m tegen ${Math.round(weg.hemelsbreed)} m hemelsbreed`);
ok('en hij loopt over bevaarbaar water', weg.er && weg.opWater >= weg.punten - 1,
  `${weg.opWater} van ${weg.punten} punten`);
ok('het zoeken kost geen halve seconde', weg.ms < 250, `${weg.ms.toFixed(0)} ms`);

// ---------- de missie starten ----------
console.log('\nde opdracht');
const start = await page.evaluate(() => {
  const g = window.__game;
  const voor = g.vaart.fase;
  g.vaart.forceer('ophalen');
  window.__loop(30);
  const doel = g.vaart.ophaalPlek;
  const ijlst = g.boten.ruw(1);
  return { voor, na: g.vaart.fase, doel, ijlst: { x: ijlst.x, z: ijlst.z }, lading: g.vaart.ladingAanBoord };
});
ok('hij begint niet uit zichzelf', start.voor === 'uit', start.voor);
ok('en na het telefoontje moet je naar IJlst', start.na === 'ophalen');
ok('de vlag staat op de sloep in IJlst',
  Math.hypot(start.doel.x - start.ijlst.x, start.doel.z - start.ijlst.z) < 1);
ok('er ligt nog niets aan boord', start.lading === false);

// ---------- instappen: de lading komt aan boord ----------
console.log('\nde lading aan boord');
const boord = await page.evaluate(() => {
  const g = window.__game;
  // eerst de verkeerde sloep: die van de Geeuw doet niets
  g.boten.stapIn(g.boten.ruw(0));
  window.__loop(30);
  const verkeerd = g.vaart.fase;
  g.boten.herstel({ boten: g.boten.bewaar().boten, aanBoord: -1 });
  // en dan de goede
  g.boten.stapIn(g.boten.ruw(1));
  window.__loop(30);
  return {
    verkeerd, fase: g.vaart.fase, lading: g.vaart.ladingAanBoord,
    heat: g.politie.heat, route: g.vaart.route ? g.vaart.route.length : 0,
  };
});
ok('in de verkeerde sloep gebeurt er niets', boord.verkeerd === 'ophalen');
ok('in de sloep in IJlst komt de lading aan boord', boord.fase === 'varen' && boord.lading);
ok('en er is een route over het water', boord.route > 10, `${boord.route} punten`);
ok('de verdenking begint meteen', boord.heat >= 30, `${boord.heat}`);

// ---------- de verdenking loopt op ----------
console.log('\nonderweg loopt de verdenking op');
const heat = await page.evaluate(() => {
  const g = window.__game;
  const voor = g.politie.ster;
  window.__loop(30 * 240);            // vier minuten varen
  return { voor, na: g.politie.ster, heat: g.vaart.heat };
});
ok('je begint op één ster', heat.voor === 1, `${heat.voor}`);
ok('en na vier minuten sta je hoger', heat.na > heat.voor, `${heat.voor} → ${heat.na} sterren`);

// ---------- afleveren ----------
console.log('\nafleveren aan de Geeuwkade');
const af = await page.evaluate(() => {
  const g = window.__game;
  const doel = g.vaart.afleverPlek;
  const geldVoor = g.verhaal.geld;
  /*
   Niet echt de hele overtocht varen — dat is tweeënhalve kilometer en duurt in
   het spel zes minuten. De sloep wordt bij de kade neergezet; wat hier getoetst
   wordt is het afleveren, niet het varen (dat doet tools/boottest.mjs).
  */
  const b = g.boten.inBoot;
  g.boten.verplaats(b, g.boten.ruw(0).plek.x, g.boten.ruw(0).plek.z, b.yaw);
  window.__loop(30);
  return {
    doel, fase: g.vaart.fase, lading: g.vaart.ladingAanBoord,
    geld: g.verhaal.geld - geldVoor, beloning: g.vaart.beloning, ster: g.politie.ster,
  };
});
ok('bij de kade is de lading over', af.fase === 'klaar', af.fase);
ok('en hij ligt niet meer in de boot', af.lading === false);
ok('je wordt betaald', af.geld === af.beloning, `€ ${af.geld} van € ${af.beloning}`);
ok('en ze zijn je kwijt', af.ster === 0, `${af.ster} sterren`);

// ---------- opslaan en laden ----------
console.log('\nF5 en F9 midden op de Geeuw');
const opslag = await page.evaluate(() => {
  const g = window.__game;
  // opnieuw beginnen en halverwege opslaan
  g.vaart.herstel(null);
  g.vaart.forceer('ophalen');
  // de sloep ligt van de vorige proef nog aan de Geeuwkade; terug naar IJlst,
  // anders is de lading afgeleverd voor hij aan boord ligt
  g.boten.naarLigplaats(1);
  g.boten.stapIn(g.boten.ruw(1));
  window.__loop(30 * 60);
  const voor = { fase: g.vaart.fase, lading: g.vaart.ladingAanBoord, heat: Math.round(g.vaart.heat) };
  g.opslaan();
  g.vaart.herstel(null);                 // alles overhoop
  const tussen = { fase: g.vaart.fase, lading: g.vaart.ladingAanBoord };
  g.laden();
  return { voor, tussen, na: { fase: g.vaart.fase, lading: g.vaart.ladingAanBoord, heat: Math.round(g.vaart.heat) } };
});
ok('de proef begon met een missie onderweg', opslag.voor.fase === 'varen' && opslag.voor.lading);
ok('en die was daarna weg', opslag.tussen.fase === 'uit' && !opslag.tussen.lading);
ok('na laden vaar je weer met de lading aan boord',
  opslag.na.fase === 'varen' && opslag.na.lading, JSON.stringify(opslag));
ok('en de verdenking staat waar hij stond', Math.abs(opslag.na.heat - opslag.voor.heat) <= 1,
  `${opslag.voor.heat} → ${opslag.na.heat}`);

console.log(`\nfouten in de pagina: ${fouten.length ? fouten.join(' | ') : 'geen'}`);
if (fouten.length) fout++;
console.log(`\n${goed} goed, ${fout} fout`);
await browser.close();
process.exit(fout ? 1 : 0);
