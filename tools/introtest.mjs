/*
 De intro, het wapen dat je later pas krijgt, en de uitleg onderweg.

   npm run server &   node tools/introtest.mjs [poort]

 Vijf dingen (verzoek 20 sep 2026):

 1. Bij een nieuw spel komt er eerst een filmpje: hoog boven de wijk, lager,
    door een straat, en dan een daling naar het standpunt waar je begint.
 2. Met de titels RED EAGLE PRODUCTIONS → presents → GTA VI / TINGA.
 3. Het filmpje is over te slaan en geeft de camera daarna netjes terug.
 4. Erik loopt zonder wapen rond tot hij bij het gezelschap staat; dáár krijgt
    hij het, met de uitleg over H, de muisknoppen en R.
 5. De eerste keer in een auto komt de uitleg over de radio en de camera.
*/
import { chromium } from 'playwright';

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

// ------------------------------------------------------------ de cameraweg
console.log('\nde weg die de camera aflegt');
/*
 Niet met een stopwatch maar met de functie die de lus zelf gebruikt:
 `beeldOp(t)` zegt waar de camera op seconde t staat. Zo is elk beeld te toetsen
 zonder dat er twintig seconden film langs hoeft.
*/
const weg = await page.evaluate(async () => {
  const I = await import('/js/intro.js');
  const { KAART } = await import('/js/kaart.js');
  const start = window.__game.start;
  const op = (t) => {
    const b = I.beeldOp(t, KAART, start);
    return { ...b, afstand: Math.hypot(b.pos.x - start.x, b.pos.z - start.z) };
  };
  const eind = op(0).totaal;
  const laatste = op(eind - 0.01);
  // de kijkrichting aan het eind, vergeleken met die van de speler
  const dx = laatste.kijk.x - laatste.pos.x, dz = laatste.kijk.z - laatste.pos.z;
  const yaw = Math.atan2(-dx, -dz);
  const verschil = Math.abs(((yaw - start.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  return {
    totaal: eind,
    hoog: op(2).pos.y, midden: op(8).pos.y, straat: op(13).pos.y,
    straatAfstand: op(13).afstand,
    eindY: laatste.pos.y, eindAfstand: laatste.afstand, eindHoek: +verschil.toFixed(3),
    start,
  };
});
ok('het filmpje duurt een seconde of twintig', weg.totaal > 15 && weg.totaal < 26, `${weg.totaal} s`);
ok('het begint hoog boven de wijk', weg.hoog > 120, `${weg.hoog.toFixed(0)} m hoog`);
ok('daarna lager over de daken', weg.midden < weg.hoog && weg.midden > 25, `${weg.midden.toFixed(0)} m`);
ok('dan door een straat op ooghoogte', weg.straat < 3.5 && weg.straatAfstand < 140,
  `${weg.straat.toFixed(1)} m hoog, ${weg.straatAfstand.toFixed(0)} m van het beginpunt`);
ok('en hij eindigt op het standpunt van de speler',
  weg.eindAfstand < 0.6 && Math.abs(weg.eindY - 1.7) < 0.2,
  `${weg.eindAfstand.toFixed(2)} m ernaast, ${weg.eindY.toFixed(2)} m hoog`);
ok('kijkend dezelfde kant op als waar het spel begint', weg.eindHoek < 0.25, `${weg.eindHoek} rad verschil`);

// ----------------------------------------------------------------- de titels
console.log('\nde titels');
const titels = await page.evaluate(async () => {
  const I = await import('/js/intro.js');
  const { KAART } = await import('/js/kaart.js');
  const start = window.__game.start;
  const rij = [];
  for (let t = 0; t < I.beeldOp(0, KAART, start).totaal; t += 0.2) {
    const T = I.beeldOp(t, KAART, start).titel;
    const tekst = T ? [T.klein, T.groot, T.sub].filter(Boolean).join(' ') : '';
    if (!rij.length || rij[rij.length - 1].tekst !== tekst) rij.push({ t: +t.toFixed(1), tekst });
  }
  return rij;
});
const gezien = titels.filter(r => r.tekst).map(r => r.tekst);
ok('er staan drie titels in het filmpje', gezien.length === 3, gezien.join(' → '));
ok('en ze staan in de goede volgorde',
  gezien[0] === 'RED EAGLE PRODUCTIONS' && gezien[1] === 'presents' && gezien[2] === 'GTA VI TINGA');
ok('met leeg beeld ertussen', titels.filter(r => !r.tekst).length >= 3,
  `${titels.filter(r => !r.tekst).length} stukken zonder titel`);

// ------------------------------------------------- het filmpje in het spel
console.log('\nhet filmpje bij het starten');
await page.evaluate(() => {
  const b = [...document.querySelectorAll('#overlay button')].find(x => x.textContent.trim() === 'Start spel');
  b.click();
});
await page.waitForTimeout(900);
await page.evaluate(async () => { const m = await import('/js/menu.js'); m.__start(); });
await page.waitForTimeout(700);
const draait = await page.evaluate(async () => {
  const I = await import('/js/intro.js');
  const g = window.__game;
  return { bezig: I.bezig(), actief: g.player.active, laag: document.getElementById('intro').classList.contains('aan') };
});
ok('de intro draait en het spel staat nog stil', draait.bezig === true && draait.actief === false);
ok('en de filmlaag staat in beeld', draait.laag === true);

// overslaan met een toets
await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' })));
/*
 Wachten tot de hoofdlus de camera heeft teruggezet, en niet een vast aantal
 tellen: met softwarerendering haalt hij maar een paar beelden per seconde, en
 dan is "drie seconden" soms één beeld. Dit kijkt gewoon of het al zover is.
*/
await page.waitForFunction(() => {
  const g = window.__game;
  return g.player.active && Math.hypot(g.camera.position.x - g.start.x, g.camera.position.z - g.start.z) < 1.5;
}, null, { timeout: 30000 }).catch(() => {});
const na = await page.evaluate(async () => {
  const I = await import('/js/intro.js');
  const g = window.__game;
  return { bezig: I.bezig(), actief: g.player.active, laag: document.getElementById('intro').classList.contains('aan'),
    cam: { x: g.camera.position.x, z: g.camera.position.z }, start: g.start };
});
ok('met een toets sla je hem over', na.bezig === false && na.laag === false);
ok('en dan begint het spel', na.actief === true);
ok('met de camera op het beginpunt',
  Math.hypot(na.cam.x - na.start.x, na.cam.z - na.start.z) < 1.5,
  `${Math.hypot(na.cam.x - na.start.x, na.cam.z - na.start.z).toFixed(2)} m ernaast`);

// ------------------------------------------------------------- het wapen
console.log('\nhet wapen komt later');
const wapen = await page.evaluate(async () => {
  const g = window.__game;
  const uit = { slot: g.player.wapenSlot, weg: g.player.wapenUit };
  // H doet niets zolang het slot erop zit
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH' }));
  await new Promise(r => requestAnimationFrame(r));
  uit.naH = g.player.wapenUit;
  uit.melding = document.getElementById('msg').textContent;
  // en dan het moment uit het verhaal waarop hij hem krijgt
  g.verhaal.__geefWapen();
  await new Promise(r => requestAnimationFrame(r));
  uit.naVerhaal = g.player.wapenUit;
  uit.slotNa = g.player.wapenSlot;
  const u = document.getElementById('uitleg');
  uit.uitlegAan = u.classList.contains('zichtbaar');
  uit.uitlegTekst = u.textContent;
  uit.kruis = document.getElementById('crosshair').style.display;
  return uit;
});
ok('bij het begin heeft Erik geen wapen in beeld', wapen.slot === true && wapen.weg === true);
ok('en H haalt hem er niet uit', wapen.naH === true, wapen.melding);
ok('bij het gezelschap krijgt hij hem wel', wapen.naVerhaal === false && wapen.slotNa === false);
ok('met het richtkruis erbij', wapen.kruis === '');
ok('en met de uitleg over de toetsen', wapen.uitlegAan === true
  && /H/.test(wapen.uitlegTekst) && /LMB/.test(wapen.uitlegTekst)
  && /RMB/.test(wapen.uitlegTekst) && /R/.test(wapen.uitlegTekst), wapen.uitlegTekst.trim());

// ------------------------------------------------------------ in de auto
console.log('\nde uitleg in de auto');
const auto = await page.evaluate(async () => {
  const g = window.__game;
  const u = document.getElementById('uitleg');
  // eerst de vorige uitleg wegklikken
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }));
  await new Promise(r => requestAnimationFrame(r));
  /*
   Instappen zoals een speler dat doet: naast een auto gaan staan en op E
   drukken (dat is wat `toggleCar` doet). `player.inCar` zelf zetten werkt niet
   — de hoofdlus zet je er meteen weer uit als je niet bij de auto staat.
  */
  const car = g.vehicles.voegToe({ x: g.player.pos.x + 2.4, z: g.player.pos.z, yaw: 0, soort: 'hatch', kleur: 0x2a3f8f });
  if (!car) return { geenAuto: true };
  g.player.inCar = null;
  g.toggleCar();
  for (let i = 0; i < 8; i++) await new Promise(r => requestAnimationFrame(r));
  const uit = { aan: u.classList.contains('zichtbaar'), tekst: u.textContent, inAuto: !!g.player.inCar };
  if (g.player.inCar) g.toggleCar();
  return uit;
});
ok('de eerste keer in een auto komt er uitleg', auto.aan === true,
  `${auto.inAuto ? 'in de auto' : 'niet ingestapt'}: ${(auto.tekst || '').trim()}`);
ok('over de radiozenders en de camera',
  /←/.test(auto.tekst || '') && /→/.test(auto.tekst || '') && /V/.test(auto.tekst || ''));

console.log(`\nfouten in de pagina: ${fouten.length ? fouten.join(' | ') : 'geen'}`);
console.log(`\n${goed} goed, ${fout} fout`);
await browser.close();
process.exit(fout ? 1 : 0);
