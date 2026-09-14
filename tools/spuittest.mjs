/*
 Toetst de wasboxen achter BP Slump Oil (js/spuiterij.js).

 1. Er staan drie gesloten boxen op het terrein achter het tankstation, met hun
    rug tegen de shop en hun deuren naar het achterterrein.
 2. Dicht houden de deur en de wanden een auto tegen; open laat de deur hem
    door.
 3. Rijd je er met de auto naartoe, dan gaat de roldeur omhoog — maar niet als
    er politie naast staat.
 4. Binnen gaat de deur dicht, en een paar tellen later ben je je sterren kwijt,
    is er betaald (honderd euro per ster) en heeft de auto een andere kleur.
 5. Het gebeurt één keer per keer: blijf je binnen staan, dan wordt je auto niet
    aan één stuk door overgespoten.
 6. Met een lege portemonnee gebeurt er niets.

 Gebruik: npm run server &  node tools/spuittest.mjs 8123
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
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });
await page.evaluate(() => {
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  /*
   Een auto klaarzetten voor de deur van een box. `nr` is de box, `afst` hoever
   ervoor, en de neus wijst naar de deur toe.
  */
  window.__zetAuto = (nr, afst) => {
    const S = g.spuiterij, P = S.plek, box = S.boxen[nr];
    const x = box.deurX + P.nx * afst, z = box.deurZ + P.nz * afst;
    if (window.__auto) { window.__auto.x = x; window.__auto.z = z; window.__auto.yaw = Math.atan2(P.nx, P.nz); return window.__auto; }
    const auto = g.vehicles.voegToe({ x, z, yaw: Math.atan2(P.nx, P.nz), soort: 'hatch', kleur: 0x9c1f1f });
    g.vehicles.maakBestuurbaar(auto);
    window.__auto = auto;
    return auto;
  };
  // alle politie ver weg parkeren, zodat hij niet ongemerkt in de weg staat
  window.__blauwWeg = () => {
    const P = g.politie.intern;
    for (const a of P.agenten) a.persoon.zetNeer(a.persoon.groep.position.x + 800, a.persoon.groep.position.z + 800, 0);
    for (const w of P.wagens) { w.car.x += 800; w.car.z += 800; }
    for (const v of P.verlaten) { v.car.x += 800; v.car.z += 800; }
  };
  window.__stap = (n, dt = 0.05) => { for (let i = 0; i < n; i++) g.spuiterij.update(dt); };
  window.__hint = () => { const e = document.getElementById('praat'); return e.hidden ? '' : e.textContent; };
});

// ---------- 1. de boxen staan er ----------
kop('drie gesloten boxen achter het tankstation');
const bouw = await page.evaluate(async () => {
  const g = window.__game, S = g.spuiterij;
  if (!S) return { er: false };
  const K = await import('/js/kaartwereld.js');
  const T = K.KAART.tankstations[0];
  const P = S.plek;
  return {
    er: true,
    n: S.boxen.length,
    plek: { x: +P.x.toFixed(1), z: +P.z.toFixed(1), breed: +P.breed.toFixed(2), diep: P.diep, hoog: P.hoog },
    bijStation: +Math.hypot(P.x - T.cx, P.z - T.cz).toFixed(1),
    dicht: S.boxen.every(b => b.staat === 'dicht' && b.open === 0),
    botsDicht: S.boxen.every(b => b.botsH > 3.5),
    // de deuren kijken allemaal dezelfde kant op, van de achterwand af
    deurenNaarBuiten: S.boxen.every(b => Math.abs(
      ((b.deurX - b.x) * P.nx + (b.deurZ - b.z) * P.nz) - P.diep / 2) < 0.01),
  };
});
ok(bouw.er, 'de spuiterij staat in de wereld');
ok(bouw.n === 3, 'met drie boxen', `${bouw.n}`);
ok(bouw.plek.breed > 8 && bouw.plek.breed < 11 && bouw.plek.diep > 7,
  'de rij is ruim negen meter breed en meer dan zeven diep',
  `${bouw.plek.breed} × ${bouw.plek.diep} m, ${bouw.plek.hoog} m hoog`);
ok(bouw.bijStation > 15 && bouw.bijStation < 60,
  'op het terrein van het tankstation', `${bouw.bijStation} m van de luifel`);
ok(bouw.dicht, 'en de deuren staan dicht als er niemand is');
ok(bouw.botsDicht, 'een dichte deur houdt een auto tegen (botsdoos boven de 3,5 m van een auto)');
ok(bouw.deurenNaarBuiten, 'alle drie de deuren kijken dezelfde kant op');

// ---------- 2. de deur gaat open als je aan komt rijden ----------
kop('de roldeur');
const deur = await page.evaluate(async () => {
  const g = window.__game, S = g.spuiterij;
  window.__blauwWeg();
  const auto = window.__zetAuto(1, 8);
  g.player.inCar = auto;
  const voor = { staat: S.boxen[1].staat, bots: S.boxen[1].botsH };
  window.__stap(4);
  const hint = window.__hint();
  const gaat = S.boxen[1].staat;
  // en dan doorlopen tot hij helemaal open is
  const rij = [];
  for (let i = 0; i < 60; i++) { window.__stap(1); rij.push(S.boxen[1].open); }
  const na = { staat: S.boxen[1].staat, open: S.boxen[1].open, bots: S.boxen[1].botsH };
  // de andere twee blijven dicht: je rijdt maar naar één deur
  const anderen = [S.boxen[0].staat, S.boxen[2].staat];
  return { voor, hint, gaat, na, anderen, stijgt: rij[10] > rij[2] && rij[40] > rij[10] };
});
ok(deur.voor.staat === 'dicht', 'hij begint dicht');
ok(deur.gaat === 'gaatOpen', 'en gaat open zodra je er met de auto op af rijdt', deur.gaat);
ok(/overspuiten/i.test(deur.hint), 'met de prijs erbij in beeld', deur.hint);
ok(deur.stijgt, 'de deur rolt geleidelijk omhoog, niet in één beeld');
ok(deur.na.staat === 'open' && deur.na.open === 1, 'tot hij helemaal open staat');
ok(deur.na.bots === 0, 'en dan laat hij een auto door', `botsdoos ${deur.na.bots} m hoog`);
ok(deur.anderen.every(s => s === 'dicht'), 'de andere twee blijven dicht', deur.anderen.join(', '));

// ---------- 3. met politie ernaast blijft hij dicht ----------
kop('met blauw ernaast');
const blauw = await page.evaluate(async () => {
  const g = window.__game, S = g.spuiterij;
  // alles weer dicht: de auto een eind weg en wachten tot de deur zakt
  window.__zetAuto(1, 90);
  window.__stap(300);
  const rust = S.boxen[1].staat;
  // een agent naast de deur, en dan aan komen rijden
  g.politie.zetHeat(200);
  for (let k = 0; k < 400 && !g.politie.intern.agenten.length; k++) g.politie.update(0.1);
  const a = g.politie.intern.agenten.find(x => x.staat !== 'neer');
  if (!a) return { er: false };
  a.persoon.groep.visible = true;
  a.persoon.zetNeer(S.boxen[1].deurX + 6, S.boxen[1].deurZ + 3, 0);
  window.__zetAuto(1, 8);
  window.__stap(20);
  const metBlauw = { staat: S.boxen[1].staat, hint: window.__hint() };
  // en zonder: dan gaat hij alsnog open
  window.__blauwWeg();
  window.__stap(20);
  const zonder = S.boxen[1].staat;
  return { er: true, rust, metBlauw, zonder };
});
ok(blauw.er, 'er is een agent om mee te meten');
ok(blauw.rust === 'dicht', 'rijd je weg, dan gaat de deur vanzelf weer dicht', blauw.rust);
ok(blauw.er && blauw.metBlauw.staat === 'dicht',
  'met een agent naast de box blijft de deur dicht', blauw.er ? blauw.metBlauw.staat : '');
ok(blauw.er && /politie/i.test(blauw.metBlauw.hint),
  'en het scherm zegt waarom', blauw.er ? blauw.metBlauw.hint : '');
ok(blauw.er && blauw.zonder !== 'dicht', 'rijdt het blauw weg, dan gaat hij alsnog open',
  blauw.er ? blauw.zonder : '');

// ---------- 4. overspuiten ----------
kop('overspuiten');
const spuit = await page.evaluate(async () => {
  const g = window.__game, S = g.spuiterij;
  window.__blauwWeg();
  g.verhaal.verdien(3000);
  g.politie.zetHeat(300);                         // vier sterren
  const auto = window.__auto;
  const voor = { ster: g.politie.ster, geld: g.verhaal.geld, kleur: auto.kleur };
  const prijs = S.prijsVoor(voor.ster);
  // de deur open laten gaan en naar binnen rijden
  window.__zetAuto(1, 8);
  window.__stap(60);
  const box = S.boxen[1];
  auto.x = box.binnen.x; auto.z = box.binnen.z;
  window.__stap(6);
  const binnen = S.boxen[1].staat;
  // de deur dicht, het spuiten, en de deur weer open
  const standen = [];
  for (let i = 0; i < 300; i++) { window.__stap(1); standen.push(S.boxen[1].staat); }
  const na = { ster: g.politie.ster, geld: g.verhaal.geld, kleur: auto.kleur, staat: S.boxen[1].staat };
  // blijf je staan: dan gebeurt het niet nog een keer
  const geldNa = g.verhaal.geld;
  window.__stap(400);
  const nogmaals = { geld: g.verhaal.geld, zelfde: g.verhaal.geld === geldNa };
  return { voor, prijs, binnen, na, nogmaals, gespoten: standen.includes('spuiten'), hint: window.__hint() };
});
ok(spuit.binnen === 'gaatDicht', 'sta je binnen, dan gaat de deur achter je dicht', spuit.binnen);
ok(spuit.gespoten, 'en dan wordt er gespoten');
ok(spuit.prijs === spuit.voor.ster * 100,
  `${spuit.voor.ster} sterren kost € ${spuit.prijs}`, `€ 100 per ster`);
ok(spuit.na.geld === spuit.voor.geld - spuit.prijs, 'dat geld gaat eraf',
  `€ ${spuit.voor.geld} → € ${spuit.na.geld}`);
ok(spuit.na.ster === 0, 'de sterren zijn weg', `${spuit.voor.ster} → ${spuit.na.ster}`);
ok(spuit.na.kleur !== spuit.voor.kleur, 'en de auto heeft een andere kleur',
  `#${spuit.voor.kleur.toString(16)} → #${spuit.na.kleur.toString(16)}`);
ok(spuit.na.staat === 'open', 'de deur staat weer open om eruit te rijden', spuit.na.staat);
ok(/naar buiten/i.test(spuit.hint), 'en dat staat er ook', spuit.hint);
ok(spuit.nogmaals.zelfde, 'blijf je staan, dan wordt hij niet nóg een keer overgespoten',
  `€ ${spuit.nogmaals.geld}`);

// ---------- 5. zonder geld gebeurt er niets ----------
kop('met een lege portemonnee');
const arm = await page.evaluate(async () => {
  const g = window.__game, S = g.spuiterij;
  window.__blauwWeg();
  const auto = window.__auto;
  // eruit, portemonnee leeg, sterren erbij, en weer naar binnen
  window.__zetAuto(1, 90);
  window.__stap(300);
  g.verhaal.betaal(g.verhaal.geld);
  g.politie.zetHeat(200);
  const voorSter = g.politie.ster;
  window.__zetAuto(1, 8);
  window.__stap(60);
  const box = S.boxen[1];
  auto.x = box.binnen.x; auto.z = box.binnen.z;
  const kleurVoor = auto.kleur;
  window.__stap(300);
  return {
    voorSter, naSter: g.politie.ster, geld: g.verhaal.geld,
    zelfdeKleur: auto.kleur === kleurVoor,
    melding: document.getElementById('missie').textContent,
  };
});
ok(arm.geld === 0, 'de portemonnee is leeg', `€ ${arm.geld}`);
ok(arm.naSter === arm.voorSter, 'dan raak je je sterren niet kwijt',
  `${arm.voorSter} → ${arm.naSter}`);
ok(arm.zelfdeKleur, 'en de auto houdt zijn kleur');
ok(/te weinig geld/i.test(arm.melding), 'het scherm zegt dat het niet lukt', arm.melding);

console.log(`\n${fouten === 0 ? 'alles goed.' : `${fouten} fout(en).`}`);
await browser.close();
process.exit(fouten ? 1 : 0);
