/*
 Missie 6: de groene BX (verzoek 20 sep 2026).

   node tools/server.mjs 8123 &   node tools/bxtest.mjs [poort]

 Wat er getoetst wordt, in de volgorde waarin je het speelt:

 1. Na de missie met Johan staat er een M op de kaart bij Tinga State, met de
    uitleg erbij dat missies daar beginnen. Mark staat eronder.
 2. Met E begint de briefing; halverwege telt Mark vijfhonderd euro uit.
 3. Daarna staat er een gróéne Citroën BX op het parkeerterrein van VV Sneek,
    en loopt de spanningsmuziek.
 4. Instappen kost je één politiester — altijd, niet afhankelijk van getuigen —
    en de radio staat op Radio Spannenburg.
 5. Overspuiten kost bij de wasbox vijfhonderd euro in plaats van het gewone
    tarief, en de kleur die eruit komt is niet meer groen.
 6. Parkeren bij de Poiesz in IJlst geeft de slotdialoog, € 250 en de melding
    MISSIE VOLTOOID – DE GROENE BX; daarna dooft de muziek uit.
 7. En het model: een BX is 4,23 bij 1,69 meter, lager dan een gewone auto.
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fout = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fout++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });
await page.evaluate(async () => {
  const { geluid } = await import('/js/audio.js');
  localStorage.removeItem('tinga.spel.v1');
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  window.__game.player.active = true;
  geluid.start();
  await geluid.laadMissieMuziek();
  await geluid.laadRadio();
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) window.__game.verhaal.update(dt); };
});

// ---------------------------------------------------- het model van de BX
kop('de Citroën BX');
const model = await page.evaluate(async () => {
  const C = await import('/js/carmodel.js');
  const bx = C.autoMaat('bx'), hatch = C.autoMaat('hatch');
  return { bx, hatch };
});
ok(model.bx && Math.abs(model.bx.L - 4.23) < 0.02 && Math.abs(model.bx.W - 1.69) < 0.02,
  'de BX heeft zijn eigen maten', model.bx ? `${model.bx.L} × ${model.bx.W} m` : 'geen maat');
ok(model.bx && model.hatch && model.bx.dakY < model.hatch.dakY,
  'en hij is lager dan een gewone auto',
  model.bx ? `dak op ${model.bx.dakY} tegen ${model.hatch.dakY} m` : '');

// ------------------------------------------------- de M bij Tinga State
kop('de M op de kaart');
const start = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const g = window.__game;
  const uitleg = await import('/js/uitleg.js');
  uitleg.reset();
  g.verhaal.__startMissie('bx');
  window.__stap(4);
  const ts = KAART.panden.find(p => p.straat === 'Molenkrite' && (p.nr || []).includes('115'));
  const m = g.verhaal.mark.groep.position;
  return {
    missie: g.verhaal.missie, fase: g.verhaal.fase,
    nav: g.hud.nav ? { letter: g.hud.nav.letter, naam: g.hud.nav.naam, doel: g.hud.nav.doel } : null,
    markZichtbaar: g.verhaal.mark.groep.visible,
    bijTingaState: ts ? Math.hypot(m.x - ts.rect.cx, m.z - ts.rect.cz) : -1,
    uitleg: document.getElementById('uitleg').textContent,
    uitlegAan: document.getElementById('uitleg').classList.contains('zichtbaar'),
    opdracht: document.getElementById('opdracht').textContent,
  };
});
ok(start.missie === 'bx' && start.fase === 'wacht', `missie 'bx', fase 'wacht'`, `${start.missie}/${start.fase}`);
ok(start.nav && start.nav.letter === 'M', 'er staat een M op de kaart',
  start.nav ? `${start.nav.letter} bij ${start.nav.naam}` : 'geen marker');
ok(start.markZichtbaar && start.bijTingaState > 0 && start.bijTingaState < 30,
  'Mark staat bij Tinga State', `${start.bijTingaState.toFixed(1)} m van het pand`);
ok(start.uitlegAan && /NIEUWE MISSIES/i.test(start.uitleg) && /M-symbool/i.test(start.uitleg),
  'met de uitleg over het M-symbool erbij', start.uitleg.slice(0, 60));

// --------------------------------------------------------- de briefing
kop('de briefing');
const briefing = await page.evaluate(() => {
  const g = window.__game;
  const m = g.verhaal.mark.groep.position;
  g.player.inCar = null;
  g.player.pos.set(m.x + 1.5, 0, m.z + 1.5);
  window.__stap(2);
  const hint = !document.getElementById('praat').hidden;
  const geldVoor = g.verhaal.geld;
  g.praat();                                  // E
  const regels = [];
  for (let i = 0; i < 40; i++) {
    const naam = document.getElementById('dialoogNaam').textContent;
    const tekst = document.getElementById('dialoogTekst').textContent;
    if (!tekst) break;
    regels.push(`${naam}: ${tekst}`);
    if (g.verhaal.fase !== 'briefing') break;
    g.praat();                                // E — verder
  }
  return { hint, geldVoor, geldNa: g.verhaal.geld, regels, fase: g.verhaal.fase };
});
ok(briefing.hint, 'bij Mark staat "E — praten" in beeld');
ok(/Daar ben je eindelijk/.test(briefing.regels[0] || ''), 'hij begint met "Daar ben je eindelijk"',
  briefing.regels[0] || 'geen regel');
ok(briefing.regels.some(r => /Citroën BX/.test(r)) && briefing.regels.some(r => /Groen ook/.test(r)),
  'hij vertelt over de groene Citroën BX');
ok(briefing.regels.some(r => /voetbalvereniging Sneek/.test(r))
  && briefing.regels.some(r => /wasbox/.test(r))
  && briefing.regels.some(r => /Poiesz in IJlst/.test(r)),
  'met de drie plekken erin: het veld, de wasbox en IJlst');
ok(briefing.geldNa - briefing.geldVoor === 500, 'en hij geeft je vijfhonderd euro mee',
  `€ ${briefing.geldVoor} → € ${briefing.geldNa}`);

// --------------------------------------------------- de auto op het veld
kop('de groene BX bij VV Sneek');
const auto = await page.evaluate(async () => {
  const { geluid } = await import('/js/audio.js');
  const { KAART } = await import('/js/kaart.js');
  const g = window.__game;
  window.__stap(6);
  const bx = g.verhaal.bx;
  const veld = (KAART.sportvelden || []).find(v => /vv sneek/i.test(v.naam || ''));
  await new Promise(r => setTimeout(r, 900));
  return {
    fase: g.verhaal.fase,
    bx: bx ? { x: bx.x, z: bx.z, soort: bx.soort, kleur: bx.kleur, driveable: bx.driveable } : null,
    bijVeld: bx && veld ? Math.hypot(bx.x - veld.cx, bx.z - veld.cz) : -1,
    opdracht: document.getElementById('opdracht').textContent,
    nav: g.hud.nav ? g.hud.nav.naam : null,
    muziek: geluid.missieStand(),
  };
});
ok(auto.fase === 'ophalen' && !!auto.bx, `fase 'ophalen', de auto staat er`, auto.fase);
ok(auto.bx && auto.bx.soort === 'bx', 'het is een BX en geen gewone hatchback', auto.bx ? auto.bx.soort : '-');
ok(auto.bx && auto.bx.kleur === 0x2f6b3a, 'en hij is groen',
  auto.bx ? `#${auto.bx.kleur.toString(16)}` : '-');
ok(auto.bijVeld > 0 && auto.bijVeld < 260, 'hij staat bij het veld van VV Sneek',
  `${auto.bijVeld.toFixed(0)} m van het hoofdveld`);
ok(/BX ophalen|haal de groene/i.test(auto.opdracht), 'de opdracht wijst hem aan', auto.opdracht);
ok(auto.muziek.aan === true, 'en de missiemuziek staat aan', `aan: ${auto.muziek.aan}`);

// ------------------------------------------------------------- instappen
kop('instappen kost een ster');
const instap = await page.evaluate(async () => {
  const { geluid } = await import('/js/audio.js');
  const g = window.__game;
  const bx = g.verhaal.bx;
  const sterrenVoor = g.politie.ster;
  g.player.pos.set(bx.x + 1.2, 0, bx.z + 1.2);
  g.praat();                                   // E: instappen
  const inAuto = g.player.inCar === bx;
  window.__stap(6);
  return {
    inAuto, sterrenVoor, sterrenNa: g.politie.ster, fase: g.verhaal.fase,
    zender: geluid.radioZender(), nav: g.hud.nav ? g.hud.nav.naam : null,
    opdracht: document.getElementById('opdracht').textContent,
  };
});
ok(instap.inAuto, 'je kunt in de BX stappen');
ok(instap.sterrenVoor === 0 && instap.sterrenNa === 1, 'en dat levert precies één ster op',
  `${instap.sterrenVoor} → ${instap.sterrenNa}`);
ok(instap.zender && /spannenburg/i.test(instap.zender.naam || ''), 'in deze auto staat Radio Spannenburg op',
  instap.zender ? instap.zender.naam : 'geen zender');
ok(instap.fase === 'spuiten' && /BP|wasbox/i.test(instap.opdracht), 'en de opdracht wijst naar de wasbox',
  `${instap.fase} · ${instap.opdracht}`);

// ------------------------------------------------------------ overspuiten
kop('overspuiten bij de wasbox');
const spuit = await page.evaluate(() => {
  const g = window.__game;
  const bx = g.verhaal.bx;
  const gewoon = g.vehicles.cars.find(c => c !== bx && c.driveable) || null;
  const prijsBX = g.spuiterij ? g.spuiterij.prijsVoor(0, bx) : null;
  const prijsGewoon = g.spuiterij && gewoon ? g.spuiterij.prijsVoor(0, gewoon) : null;
  // het overspuiten zelf zoals de wasbox het doet: betalen en een andere kleur
  const geldVoor = g.verhaal.geld;
  const betaald = g.verhaal.betaal(prijsBX);
  const kleurVoor = bx.kleur;
  g.vehicles.verf(bx, g.vehicles.andereKleur(bx.kleur));
  window.__stap(6);
  const markVoor = { x: g.verhaal.mark.groep.position.x, z: g.verhaal.mark.groep.position.z };
  return {
    prijsBX, prijsGewoon, betaald, geldVoor, geldNa: g.verhaal.geld,
    kleurVoor, kleurNa: bx.kleur, fase: g.verhaal.fase,
    opdracht: document.getElementById('opdracht').textContent,
    mark: markVoor, plek: g.verhaal.bxPlek,
  };
});
ok(spuit.prijsBX === 500, 'de wasbox vraagt € 500 voor de BX', `€ ${spuit.prijsBX}`);
ok(spuit.prijsGewoon === 100, 'en voor een gewone auto het oude tarief', `€ ${spuit.prijsGewoon}`);
ok(spuit.betaald && spuit.geldVoor - spuit.geldNa === 500, 'dat geld gaat van je saldo af',
  `€ ${spuit.geldVoor} → € ${spuit.geldNa}`);
ok(spuit.kleurNa !== spuit.kleurVoor && spuit.kleurNa !== 0x2f6b3a, 'en hij is niet meer groen',
  `#${spuit.kleurVoor.toString(16)} → #${spuit.kleurNa.toString(16)}`);
ok(spuit.fase === 'wegbrengen' && /IJlst/i.test(spuit.opdracht), 'daarna moet hij naar IJlst',
  `${spuit.fase} · ${spuit.opdracht}`);
ok(spuit.plek && Math.hypot(spuit.mark.x - spuit.plek.x, spuit.mark.z - spuit.plek.z) < 12,
  'en Mark staat daar al te wachten',
  spuit.plek ? `${Math.hypot(spuit.mark.x - spuit.plek.x, spuit.mark.z - spuit.plek.z).toFixed(1)} m van het vak` : '-');

// ------------------------------------------------------------- afleveren
kop('afleveren bij de Poiesz in IJlst');
const einde = await page.evaluate(async () => {
  const { geluid } = await import('/js/audio.js');
  const { KAART } = await import('/js/kaart.js');
  const g = window.__game;
  const bx = g.verhaal.bx;
  const plek = g.verhaal.bxPlek;
  const poiesz = KAART.panden.find(p => p.type === 'poiesz');
  // de rit overslaan: de BX op het vak zetten
  bx.x = plek.x; bx.z = plek.z; bx.speed = 0;
  bx.mesh.position.set(bx.x, 0, bx.z);
  g.player.pos.set(bx.x + 1, 0, bx.z + 1);
  window.__stap(6);
  const geldVoor = g.verhaal.geld;
  const regels = [];
  for (let i = 0; i < 40; i++) {
    const tekst = document.getElementById('dialoogTekst').textContent;
    if (!tekst) break;
    regels.push(tekst);
    g.praat();
    if (g.verhaal.fase === 'klaar') break;
  }
  const melding = document.getElementById('missie').textContent;
  // en de muziek dooft uit: het verhaal bijwerken op de echte klok
  for (let i = 0; i < 160; i++) { g.verhaal.update(0.06); await new Promise(r => setTimeout(r, 60)); }
  return {
    bijPoiesz: poiesz ? Math.hypot(bx.x - poiesz.rect.cx, bx.z - poiesz.rect.cz) : -1,
    regels, melding, geldVoor, geldNa: g.verhaal.geld,
    missie: g.verhaal.missie, fase: g.verhaal.fase, muziek: geluid.missieStand(),
  };
});
ok(einde.bijPoiesz > 0 && einde.bijPoiesz < 120, 'het vak ligt bij de Poiesz in IJlst',
  `${einde.bijPoiesz.toFixed(0)} m van de winkel`);
ok(/Kijk nou/.test(einde.regels[0] || ''), 'Mark begint met "Kijk nou"', einde.regels[0] || 'geen regel');
ok(einde.regels.some(r => /Het blijft een BX/.test(r)) && einde.regels.some(r => /Mooie kleur trouwens/.test(r)),
  'en de slotdialoog loopt helemaal af');
ok(einde.regels.some(r => /bereikbaar/.test(r)), 'met de aankondiging van de volgende klus');
ok(einde.geldNa - einde.geldVoor === 250, 'de beloning is € 250',
  `€ ${einde.geldVoor} → € ${einde.geldNa}`);
ok(/MISSIE VOLTOOID/.test(einde.melding) && /BX/.test(einde.melding), 'MISSIE VOLTOOID – DE GROENE BX',
  einde.melding.slice(0, 40));
/*
 Afgerond is hier: de BX is klaar. Acht seconden na de beloning zet het verhaal
 zelf de volgende missie klaar (de bom, met een M bij de Wieken 29), dus
 'bom/wacht' telt net zo goed als 'klaar/klaar' — zolang de BX maar niet meer
 loopt.
*/
ok((einde.missie === 'klaar' && einde.fase === 'klaar')
  || (einde.missie === 'bom' && einde.fase === 'wacht'),
  'de missie is afgerond', `${einde.missie}/${einde.fase}`);
ok(!einde.muziek.aan && einde.muziek.volume < 0.01, 'en de muziek is uitgedoofd',
  `volume ${einde.muziek.volume}`);

console.log(`\n${fout ? fout + ' fout' : 'alles goed'}`);
await browser.close();
process.exit(fout ? 1 : 0);
