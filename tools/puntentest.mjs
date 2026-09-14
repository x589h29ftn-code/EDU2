/*
 De twaalf punten van 13 september 2026, stuk voor stuk nagemeten.

 De lijst kwam in een Word-document binnen. Punt 11 (Radio Spannenburg) heeft
 zijn eigen proef — `npm run radiotest` — de andere elf staan hier:

   1  een aangereden auto: de bestuurder zet hem in zijn achteruit
   2  een neergeschoten agent laat drie tot vijftien kogels vallen
   3  het laadscherm wacht op enter          (ook in menutest)
   4  de koplampen clippen niet meer in de grille
   5  het machinegeweer van vijfhonderd euro, wisselen met het scrollwiel
   6  een neergeschoten voetganger laat wisselend geld vallen, hooguit een tientje
   7  de politie schiet nauwkeuriger en dodelijker
   8  meer verschillende omgevingsgeluiden
   9  de twee uitlegregels zijn van het startscherm af  (ook in menutest)
  10  een beschoten auto: de bestuurder geeft gas
  12  het cameraschudden bij een explosie schaalt met de afstand

 Gebruik: npm run server &   node tools/puntentest.mjs 8123
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
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });
await page.evaluate(() => {
  localStorage.removeItem('tinga.spel.v1');
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  // headless haalt maar een beeld per seconde: de beelden worden met de hand
  // gedraaid, net als in tools/rijtest.mjs
  window.__tik = (n, dt = 1 / 30) => {
    for (let i = 0; i < n; i++) {
      g.vehicles.updateTraffic(dt, g.player, g.npcs.people);
      g.player.update(dt);
    }
  };
});
await page.waitForTimeout(600);

// ---------------------------------------------------------------- punt 5
kop('punt 5 — het machinegeweer, te koop en met het scrollwiel te pakken');
const koop = await page.evaluate(async () => {
  const g = window.__game;
  const { MITRAILLEUR } = await import('/js/boerderij.js');
  // eerst de portemonnee leeg: je begint sinds de testfase met € 1000 op zak
  // (js/verhaal.js), en dan valt er niets te bewijzen over "te weinig geld"
  g.verhaal.betaal(g.verhaal.geld);
  const start = { wapens: g.player.wapens.slice(), geld: g.verhaal.geld };
  // te weinig geld: dan gebeurt er niets
  const arm = g.boerderij.koopWapen();
  g.verhaal.verdien(MITRAILLEUR.prijs);
  const rijk = g.verhaal.geld;
  const gekocht = g.boerderij.koopWapen();
  return {
    prijs: MITRAILLEUR.prijs, start, arm, rijk, gekocht,
    wapens: g.player.wapens.slice(),
    soort: g.player.wapenSoort,
    mag: g.player.ammo,
    geldNa: g.verhaal.geld,
    nogmaals: g.boerderij.koopWapen(),
  };
});
ok(koop.prijs === 500, 'het machinegeweer kost vijfhonderd euro', `€ ${koop.prijs}`);
ok(koop.start.wapens.length === 1 && koop.start.wapens[0] === 'pistool',
  'je begint met alleen een pistool', koop.start.wapens.join(', '));
ok(koop.arm === 'arm', 'met te weinig geld koop je hem niet', `€ ${koop.start.geld} op zak`);
ok(koop.gekocht === 'ok' && koop.wapens.includes('mitrailleur'),
  'met vijfhonderd euro wel', koop.wapens.join(', '));
ok(koop.geldNa === koop.rijk - koop.prijs, 'en het geld gaat eraf',
  `€ ${koop.rijk} → € ${koop.geldNa}`);
ok(koop.soort === 'mitrailleur' && koop.mag === 30,
  'hij zit meteen in je handen, met dertig kogels erin', `${koop.soort}, magazijn ${koop.mag}`);
ok(koop.nogmaals === 'heeft', 'twee keer kopen kan niet', koop.nogmaals);

const wissel = await page.evaluate(() => {
  const g = window.__game, p = g.player;
  /*
   Wisselen is sinds 14 september 2026 een beweging: het wapen wordt eerst
   opgeborgen en pas halverwege wisselt het model (js/player.js). De proef laat
   die beweging daarom aflopen voordat hij kijkt wat je vasthebt.
  */
  const laat = (n = 40, dt = 0.02) => { for (let i = 0; i < n; i++) p.update(dt); };
  laat();                                         // het aanpakken bij de toonbank afmaken
  p.ammo = 7;                                     // zeven in het machinegeweer
  const heen = p.kiesWapen(1);
  laat();
  const naHeen = { soort: p.wapenSoort, ammo: p.ammo, model: p.gun.visible };
  const terug = p.kiesWapen(1);
  laat();
  return { heen, naHeen, terug, soort: p.wapenSoort, ammo: p.ammo,
           modellen: Object.keys(p.modellen),
           zichtbaar: Object.keys(p.modellen).filter(k => p.modellen[k].groep.visible) };
});
ok(wissel.heen === 'pistool' && wissel.naHeen.soort === 'pistool',
  'het scrollwiel wisselt naar het andere wapen', `${wissel.heen} → ${wissel.soort}`);
ok(wissel.naHeen.model, 'en het model van dat wapen staat in beeld');
ok(wissel.zichtbaar.length === 1, 'er staat er altijd precies één in beeld',
  wissel.zichtbaar.join(', '));
ok(wissel.soort === 'mitrailleur' && wissel.ammo === 7,
  'het magazijn blijft in het wapen zitten waar je het in liet', `${wissel.ammo} kogels`);

const icoon = await page.evaluate(async () => {
  const g = window.__game;
  const T = await import('/js/textures.js');
  const el = document.getElementById('wapen');
  g.hud.toonWapen(T.wapenIcoon('mitrailleur').image);
  const aan = el.style.opacity;
  g.hud.wapenT = 0.01;
  g.hud.update(0.02, g.player, g.vehicles, g.npcs, 'proef');
  return { aan, uit: el.style.opacity, doek: !!document.getElementById('wapenicoon') };
});
ok(icoon.doek && icoon.aan === '1', 'het wapenicoon komt in beeld', `dekking ${icoon.aan}`);
ok(icoon.uit === '0', 'en verdwijnt weer vanzelf');

const vuur = await page.evaluate(() => {
  const g = window.__game, p = g.player;
  const W = p.wapenInfo;
  p.ammo = 30; p.vuurKlok = 0;
  let schoten = 0;
  const oud = p.shootCb; p.shootCb = () => { schoten++; };
  p.vuurAan = true;
  for (let i = 0; i < 60; i++) p.update(1 / 30);     // twee seconden vasthouden
  p.vuurAan = false;
  const auto = schoten;
  p.shootCb = oud;
  return { auto, tempo: W.tempo, automatisch: W.auto, over: p.ammo };
});
ok(vuur.automatisch, 'het machinegeweer schiet door zolang je de knop vasthoudt');
ok(vuur.auto >= 10, 'en dat levert in twee seconden een flinke serie op',
  `${vuur.auto} schoten, ${vuur.over} over in het magazijn`);

const semi = await page.evaluate(() => {
  const g = window.__game, p = g.player;
  p.kiesWapen(1);                                   // terug naar het pistool
  p.ammo = 12; p.vuurKlok = 0;
  let schoten = 0;
  const oud = p.shootCb; p.shootCb = () => { schoten++; };
  p.vuurAan = true;
  for (let i = 0; i < 60; i++) p.update(1 / 30);
  p.vuurAan = false;
  p.shootCb = oud;
  return { soort: p.wapenSoort, schoten, over: p.ammo };
});
ok(semi.soort === 'pistool' && semi.schoten === 0,
  'het pistool schiet niet door: dat is klikken per schot', `${semi.schoten} schoten`);

// ---------------------------------------------------------------- punt 2 en 6
kop('punt 2 en 6 — wat er op straat blijft liggen');
const buit = await page.evaluate(async () => {
  const B = await import('/js/buit.js');
  // vaste reeks getallen, zodat de uitkomst niet van het toeval afhangt
  const reeks = (waardes) => { let i = 0; return () => waardes[i++ % waardes.length]; };
  const geld = [], kogels = [];
  for (let i = 0; i < 200; i++) geld.push(B.zakgeld());
  for (let i = 0; i < 200; i++) kogels.push(B.agentMunitie());
  return {
    geldMin: Math.min(...geld), geldMax: Math.max(...geld),
    geldNiets: geld.filter(g => g === 0).length,
    kogelMin: Math.min(...kogels), kogelMax: Math.max(...kogels),
    leegBijNul: B.zakgeld(reeks([0.9])),
  };
});
ok(buit.geldMax <= 10, 'een voetganger laat hooguit een tientje vallen', `hoogste € ${buit.geldMax}`);
ok(buit.geldNiets > 20 && buit.geldNiets < 180, 'en vaak niets',
  `${buit.geldNiets} van de 200 keer niets`);
ok(buit.geldMin === 0 && buit.geldMax > 1, 'het bedrag wisselt',
  `van € ${buit.geldMin} tot € ${buit.geldMax}`);
ok(buit.kogelMin >= 3 && buit.kogelMax <= 15, 'een agent laat drie tot vijftien kogels vallen',
  `${buit.kogelMin}–${buit.kogelMax}`);

const oppakken = await page.evaluate(async () => {
  const g = window.__game;
  const { maakBuit } = await import('/js/buit.js');
  const proef = maakBuit(g.scene, () => 0);
  const x = g.player.pos.x, z = g.player.pos.z;
  proef.laatVallen('geld', x + 8, z, 7);
  proef.laatVallen('kogels', x + 8, z, 9);
  const niets = proef.laatVallen('geld', x, z, 0);
  const gevallen = proef.dingen.length;
  const ver = proef.update(0.1, g.player, () => {});
  // nu ernaartoe lopen
  const gepakt = [];
  proef.dingen.forEach(d => { d.groep.position.x = x; d.groep.position.z = z; });
  const n = proef.update(0.1, g.player, (soort, waarde) => gepakt.push([soort, waarde]));
  return { gevallen, niets, ver, n, gepakt, over: proef.dingen.length };
});
ok(oppakken.gevallen === 2 && oppakken.niets === null,
  'wat je laat vallen ligt er, en nul euro laat niets liggen');
ok(oppakken.ver === 0, 'acht meter verderop pak je het niet op');
ok(oppakken.n === 2 && oppakken.over === 0, 'loop je erlangs, dan pak je het op');
ok(JSON.stringify(oppakken.gepakt.sort()) === JSON.stringify([['geld', 7], ['kogels', 9]]),
  'met het juiste bedrag en het juiste aantal kogels', JSON.stringify(oppakken.gepakt));

const inSpel = await page.evaluate(() => {
  const g = window.__game;
  const p = g.player;
  const reserve = p.reserve, geld = g.verhaal.geld;
  p.reserve += 11;                 // zoals de haak in js/main.js het doet
  g.verhaal.verdien(6);
  return { kogels: p.reserve - reserve, geld: g.verhaal.geld - geld };
});
ok(inSpel.kogels === 11, 'opgeraapte kogels gaan naar de reserve — die is voor elk wapen dezelfde');
ok(inSpel.geld === 6, 'en opgeraapt geld naar je portemonnee');

// ---------------------------------------------------------------- punt 1 en 10
kop('punt 1 en 10 — wat de bestuurder van een andere auto doet');
const verkeer = await page.evaluate(() => {
  const g = window.__game;
  const t = g.vehicles.traffic.find(a => a._pos) || g.vehicles.traffic[0];
  g.vehicles.updateTraffic(1 / 30, g.player, g.npcs.people);
  const voor = { snelheid: t.snelheid, doel: t.doel };
  g.vehicles.schrikAf(t, 'botsing');
  const klok = t.achteruit;
  for (let i = 0; i < 12; i++) g.vehicles.updateTraffic(1 / 30, g.player, g.npcs.people);
  const achteruit = { doel: t.doel, snelheid: t.snelheid, klok: t.achteruit };
  // uitlopen tot hij weer gewoon rijdt
  for (let i = 0; i < 120; i++) g.vehicles.updateTraffic(1 / 30, g.player, g.npcs.people);
  const daarna = { doel: t.doel, achteruit: t.achteruit };
  return { voor, klok, achteruit, daarna, kruis: t.speed };
});
ok(verkeer.klok > 0.8 && verkeer.klok < 2.2, 'een aanrijding zet de bestuurder een seconde of twee in zijn achteruit',
  `${verkeer.klok.toFixed(2)} s`);
ok(verkeer.achteruit.doel < 0 && verkeer.achteruit.snelheid < 0,
  'en dan rijdt hij ook echt achteruit', `doel ${verkeer.achteruit.doel} m/s, snelheid ${verkeer.achteruit.snelheid.toFixed(2)}`);
ok(verkeer.daarna.achteruit <= 0 && verkeer.daarna.doel >= 0,
  'daarna rijdt hij weer gewoon vooruit', `doel ${verkeer.daarna.doel.toFixed(1)} m/s`);

const beschoten = await page.evaluate(() => {
  const g = window.__game;
  const t = g.vehicles.traffic.find(a => a._pos) || g.vehicles.traffic[0];
  t.achteruit = 0; t.haast = 0;
  g.vehicles.updateTraffic(1 / 30, g.player, g.npcs.people);
  const rustig = t.doel;
  // schieten: dezelfde weg als een kogel, via de mesh van die auto
  const raak = g.vehicles.hit(t.mesh, null);
  const klok = t.haast;
  for (let i = 0; i < 30; i++) g.vehicles.updateTraffic(1 / 30, g.player, g.npcs.people);
  return { rustig, klok, doel: t.doel, kruis: t.speed, raak: !!raak,
           inDoelen: g.vehicles.doelen().includes(t.mesh) };
});
ok(beschoten.inDoelen, 'je kunt op rijdend verkeer schieten (het staat in de doelenlijst)');
ok(beschoten.raak && beschoten.klok >= 5, 'een kogel laat de bestuurder gas geven',
  `${beschoten.klok.toFixed(1)} s lang`);
ok(beschoten.doel > beschoten.kruis, 'en dan rijdt hij harder dan zijn gewone snelheid',
  `${beschoten.kruis.toFixed(1)} → ${beschoten.doel.toFixed(1)} m/s`);

// ---------------------------------------------------------------- punt 4
kop('punt 4 — de koplampen zitten niet meer in de grille');
const grille = await page.evaluate(async () => {
  // de maten uit de bron: de grille mag niet meer over de koplampen heen liggen
  const r = await fetch('/js/carmodel.js').then(x => x.text());
  const mGrille = /doos\(W - ([\d.]+), 0\.13, 0\.05\)/.exec(r);
  const mLamp = /doos\(0\.40, 0\.15, lampD\), x: -W \/ 2 \+ ([\d.]+)/.exec(r);
  if (!mGrille || !mLamp) return null;
  const W = 1.78;
  const grilleHalf = (W - Number(mGrille[1])) / 2;
  const lampBinnen = W / 2 - Number(mLamp[1]) - 0.20;      // binnenrand van de lamp
  return { grilleHalf, lampBinnen };
});
ok(!!grille, 'de maten van grille en koplamp staan in js/carmodel.js');
if (grille) {
  ok(grille.grilleHalf <= grille.lampBinnen,
    'de grille houdt op waar de koplamp begint — geen twee vlakken op dezelfde plek',
    `grille tot ${grille.grilleHalf.toFixed(2)} m, lamp vanaf ${grille.lampBinnen.toFixed(2)} m`);
}

// ---------------------------------------------------------------- punt 7
kop('punt 7 — de politie schiet nauwkeuriger en dodelijker');
const politie = await page.evaluate(async () => {
  const r = await fetch('/js/politie.js').then(x => x.text());
  const schade = /const SCHADE = (\d+);/.exec(r);
  const kans = /Math\.max\(([\d.]+), ([\d.]+) - dSp \* ([\d.]+)\)/.exec(r);
  if (!schade || !kans) return null;
  const S = Number(schade[1]);
  const bij = (d) => Math.max(Number(kans[1]), Number(kans[2]) - d * Number(kans[3]));
  return { schade: S, kans11: bij(11), kans25: bij(25), dps11: bij(11) * S / 1.8 };
});
ok(politie && politie.schade > 4, 'een treffer doet meer schade dan de vier van hiervoor',
  politie ? `${politie.schade} punten` : 'niet gevonden');
ok(politie && politie.kans11 > 0.379, 'en op dekkingsafstand raken ze je vaker dan de 38 % van hiervoor',
  politie ? `${Math.round(politie.kans11 * 100)} %` : '');
ok(politie && politie.dps11 < 2.5, 'maar niet zo hard dat je binnen tien tellen neer bent',
  politie ? `${politie.dps11.toFixed(2)} punten per seconde per schutter` : '');

// ---------------------------------------------------------------- punt 8
kop('punt 8 — meer verschillende omgevingsgeluiden');
const sfeer = await page.evaluate(async () => {
  const { geluid } = await import('/js/audio.js');
  geluid.start();
  const soorten = geluid.sfeerSoorten;
  const gehoord = new Set();
  for (let i = 0; i < 80; i++) {
    // de klok van `omgeving` staat op vier tot dertien seconden; hier draaien we
    // hem met grote stappen door zodat er genoeg langskomt
    geluid.omgeving(6, { weer: 'helder', nacht: false, binnen: false });
    if (geluid.laatsteSfeer) gehoord.add(geluid.laatsteSfeer);
  }
  const nacht = new Set();
  for (let i = 0; i < 60; i++) {
    geluid.omgeving(6, { weer: 'helder', nacht: true, binnen: false });
    if (geluid.laatsteSfeer) nacht.add(geluid.laatsteSfeer);
  }
  const onbekend = geluid.sfeerGeluid('bestaatniet');
  return { soorten, dag: [...gehoord], nacht: [...nacht], onbekend };
});
ok(sfeer.soorten.length >= 6, 'er zijn meer dan een handvol omgevingsgeluiden',
  sfeer.soorten.join(', '));
ok(sfeer.dag.length >= 5, 'overdag komen er verschillende langs', sfeer.dag.join(', '));
ok(sfeer.nacht.length >= 3 && sfeer.nacht.includes('uil'),
  "'s nachts een andere verzameling, met de uil erbij", sfeer.nacht.join(', '));
ok(sfeer.onbekend === null, 'een naam die niet bestaat doet niets');

// ---------------------------------------------------------------- punt 12
kop('punt 12 — het schudden bij een explosie schaalt met de afstand');
const knal = await page.evaluate(() => {
  const g = window.__game;
  const meet = (afstand) => {
    const auto = { x: g.player.pos.x + afstand, z: g.player.pos.z, mesh: null, wrak: true };
    g.__schokNul();
    g.__ontplof(auto);
    return g.__schokKracht();
  };
  return { dichtbij: meet(1), midden: meet(20), ver: meet(45), buiten: meet(80) };
});
ok(knal.dichtbij > 1, 'naast de auto schudt het beeld flink', knal.dichtbij.toFixed(2));
ok(knal.midden < knal.dichtbij * 0.5, 'op twintig meter een stuk minder',
  `${knal.dichtbij.toFixed(2)} → ${knal.midden.toFixed(2)}`);
ok(knal.ver < knal.midden, 'op vijfenveertig meter bijna niets meer', knal.ver.toFixed(3));
ok(knal.buiten === 0, 'en op tachtig meter helemaal niets', String(knal.buiten));

await browser.close();
console.log(fouten === 0 ? '\nAlles goed.' : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
