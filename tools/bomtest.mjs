/*
 Missie 7: de bom bij de Poiesz in Duinterpen (verzoek 21 sep 2026), plus de
 vier kleine punten uit dezelfde ronde.

   node tools/server.mjs 8123 &   node tools/bomtest.mjs [poort]

 De missie, in de volgorde waarin je hem speelt:

 1. Er staat een M op de kaart bij de Wieken 29; binnen zit Mark op de bank en
    begint hij uit zichzelf te praten.
 2. Na het gesprek staat er een auto voor de deur en loopt de spanningsmuziek.
 3. Bij de Poiesz in Duinterpen geeft Mark je de explosieven en licht de plek
    bij de schappen op.
 4. Met E plant je de bom daar — en alleen daar.
 5. Buiten laat Mark hem afgaan: een knal, een schok en rook.
 6. Drie auto's met zes man; die moeten neer. Mark schiet mee en gaat niet neer.
 7. Daarna twee sterren, die je afschudt in het Tinga-bos.
 8. Mark thuisbrengen bij Molenkrite 15 levert € 300 op.

 En de rest van de ronde: de radio gaat voor op de missiemuziek zodra je zelf
 een zender kiest, buiten de auto komt de muziek terug, de missievlag op de
 kaart is groter, en de bootmissie staat uit.
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
  const g = window.__game;
  g.player.active = true;
  g.player.wapenSlot = false; g.player.wapenUit = false;
  geluid.start();
  await geluid.laadMissieMuziek();
  await geluid.laadRadio();
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) g.verhaal.update(dt); };
  window.__klik = (n = 30) => { for (let i = 0; i < n; i++) { g.praat(); g.verhaal.update(0.05); } };
});

// ------------------------------------------------------- de bootmissie uit
kop('de bootmissie staat uit');
const boot = await page.evaluate(async () => {
  const V = await import('/js/vaart.js');
  const g = window.__game;
  return { vlag: V.VAART_AAN, fase: g.vaart ? g.vaart.fase : null };
});
ok(boot.vlag === false, 'de vlag VAART_AAN staat uit', `VAART_AAN = ${boot.vlag}`);
ok(boot.fase === 'uit', 'en de missie blijft in de stand "uit"', `fase ${boot.fase}`);

// ------------------------------------------- een missie los kunnen starten
kop('elke missie is los te starten');
const los = await page.evaluate(async () => {
  const g = window.__game;
  const voor = g.verhaal.missie;
  // shift+7 in het spel
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit7', shiftKey: true }));
  const naToets = g.verhaal.missie;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', shiftKey: true }));
  const terug = g.verhaal.missie;
  // en ?missie=bom bij het starten: startGame leest de adresregel
  history.replaceState({}, '', `${location.pathname}?missie=bom`);
  await g.hervat(false, false);
  const naAdres = g.verhaal.missie;
  history.replaceState({}, '', location.pathname);
  // een cijfer zonder shift hoort gewoon de toonbank te bedienen
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit3' }));
  return { voor, naToets, terug, naAdres, naCijfer: g.verhaal.missie };
});
ok(los.naToets === 'bom', 'shift+7 begint missie 7', `${los.voor} → ${los.naToets}`);
ok(los.terug === 'molenkrite', 'en shift+1 zet je terug bij missie 1', los.terug);
ok(los.naAdres === 'bom', 'index.html?missie=bom begint er ook mee', los.naAdres);
ok(los.naCijfer === 'bom', 'een cijfer zonder shift verandert de missie niet', los.naCijfer);

// --------------------------------------------------- de M bij de Wieken 29
kop('de missie begint binnen');
const start = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const g = window.__game;
  g.verhaal.__startMissie('bom');
  window.__stap(4);
  const pand = KAART.panden.find(p => p.straat === 'de Wieken' && (p.nr || []).includes('29'));
  const nav = g.hud.nav ? { letter: g.hud.nav.letter, naam: g.hud.nav.naam, doel: g.hud.nav.doel } : null;
  const bij = nav && pand ? Math.hypot(nav.doel[0] - pand.rect.cx, nav.doel[1] - pand.rect.cz) : -1;
  return { missie: g.verhaal.missie, fase: g.verhaal.fase, nav, bij,
    markZichtbaar: g.verhaal.mark.groep.visible };
});
ok(start.missie === 'bom' && start.fase === 'wacht', `missie 'bom', fase 'wacht'`,
  `${start.missie}/${start.fase}`);
ok(start.nav && start.nav.letter === 'M' && /Wieken/.test(start.nav.naam || ''),
  'met een M op de kaart bij de Wieken 29', start.nav ? start.nav.naam : 'geen marker');
ok(start.bij >= 0 && start.bij < 25, 'die vlag staat bij het juiste pand', `${start.bij.toFixed(1)} m`);
ok(start.markZichtbaar === false, 'Mark is buiten niet te zien — hij zit binnen');

// ---------------------------------------------------- Mark zit op de bank
kop('Mark op de bank');
const binnen = await page.evaluate(async () => {
  const { geluid } = await import('/js/audio.js');
  const g = window.__game;
  const woning = g.woningen[1];
  const plek = woning.plekken;
  g.player.inCar = null;
  g.player.pos.set(plek.deurBinnen.x, 0, plek.deurBinnen.z);
  window.__stap(6);
  const eerste = document.getElementById('dialoogTekst').textContent;
  const mp = g.verhaal.mark.groep.position;
  const regels = [];
  for (let i = 0; i < 20; i++) {
    const t = document.getElementById('dialoogTekst').textContent;
    if (!t) break;
    regels.push(t);
    g.praat();
    window.__stap(2);
    // doorklikken tot de balk leeg is: na het gesprek op de bank volgt nog
    // de regel dat de auto voor de deur staat, en pas daarna de opdracht
  }
  window.__stap(10);
  return {
    eerste, regels, fase: g.verhaal.fase,
    bijBank: Math.hypot(mp.x - plek.bank.x, mp.z - plek.bank.z),
    auto: g.verhaal.bomAuto ? { x: g.verhaal.bomAuto.x, z: g.verhaal.bomAuto.z, soort: g.verhaal.bomAuto.soort } : null,
    muziek: geluid.missieStand(),
    opdracht: document.getElementById('opdracht').textContent,
  };
});
ok(/katten/.test(binnen.eerste || ''), 'hij begint over de katten', (binnen.eerste || '').slice(0, 50));
ok(binnen.bijBank < 1.5, 'en hij zit op de bank', `${binnen.bijBank.toFixed(2)} m van de zitplek`);
ok(binnen.regels.some(r => /Veteraan/.test(r)) && binnen.regels.some(r => /filiaalhouder/.test(r))
  && binnen.regels.some(r => /Ga je mee/.test(r)),
  'de briefing noemt De Veteraan, de filiaalhouder en de vraag of je meegaat');
ok(!!binnen.auto, 'daarna staat er een auto voor de deur',
  binnen.auto ? `${binnen.auto.soort} op ${binnen.auto.x.toFixed(0)},${binnen.auto.z.toFixed(0)}` : 'geen auto');
ok(binnen.muziek.aan === true, 'en de missiemuziek staat aan');
ok(/Duinterpen/i.test(binnen.opdracht), 'de opdracht wijst naar Duinterpen', binnen.opdracht);

// ------------------------------------------------- de radio gaat voor
kop('de radio gaat voor op de missiemuziek');
const radio = await page.evaluate(async () => {
  const { geluid } = await import('/js/audio.js');
  const g = window.__game;
  const auto = g.verhaal.bomAuto;
  g.player.pos.set(auto.x + 1.2, 0, auto.z + 1.2);
  g.praat();                                    // instappen
  const inAuto = !!g.player.inCar;
  for (let i = 0; i < 18; i++) { geluid.autoradio(true); await new Promise(r => setTimeout(r, 80)); }
  const voorWissel = { radio: geluid.stand().muziek, missie: geluid.stand().missie };
  geluid.zenderWissel(1);                       // de speler kiest zelf een zender
  for (let i = 0; i < 22; i++) { geluid.autoradio(true); await new Promise(r => setTimeout(r, 80)); }
  const naWissel = { radio: geluid.stand().muziek, missie: geluid.stand().missie, voor: geluid.radioVoorgrond() };
  // uitstappen: de missiemuziek is weer de baas
  g.toggleCar();
  const uit = !g.player.inCar;
  // zoals de hoofdlus het doet: elk beeld de radio bijwerken én het verhaal
  for (let i = 0; i < 22; i++) {
    geluid.autoradio(false);
    g.verhaal.update(0.05);
    await new Promise(r => setTimeout(r, 80));
  }
  const buiten = { uit, radio: geluid.stand().muziek, missie: geluid.stand().missie,
    voor: geluid.radioVoorgrond(), aan: geluid.missieStand().aan };
  return { inAuto, voorWissel, naWissel, buiten };
});
ok(radio.inAuto, 'je stapt in de auto van de missie');
ok(radio.voorWissel.missie > radio.voorWissel.radio, 'zonder ingrijpen staat de missiemuziek voorop',
  `missie ${radio.voorWissel.missie} tegen radio ${radio.voorWissel.radio}`);
ok(radio.naWissel.voor === true && radio.naWissel.radio > radio.naWissel.missie,
  'kies je zelf een zender, dan gaat de radio voor',
  `radio ${radio.naWissel.radio} tegen missie ${radio.naWissel.missie}`);
ok(radio.buiten.voor === false && radio.buiten.missie > 0.1,
  'en buiten de auto komt de missiemuziek terug',
  `missie ${radio.buiten.missie} · uitgestapt ${radio.buiten.uit} · radio voor ${radio.buiten.voor} · muziek aan ${radio.buiten.aan}`);

// ------------------------------------------------- bij de winkel in Duinterpen
kop('bij de Poiesz in Duinterpen');
const winkel = await page.evaluate(() => {
  const g = window.__game;
  const ing = g.supermarkt.ingangen.find(i => /duinterpen/i.test(i.naam));
  g.player.inCar = null;
  g.player.pos.set(ing.stoep.x, 0, ing.stoep.z);
  window.__stap(6);
  const regels = [];
  for (let i = 0; i < 10; i++) {
    const t = document.getElementById('dialoogTekst').textContent;
    if (!t) break;
    regels.push(t);
    g.praat();
    window.__stap(2);
  }
  window.__stap(6);
  const plek = g.verhaal.bomPlek;
  return {
    fase: g.verhaal.fase, regels, plek,
    markBij: Math.hypot(g.verhaal.mark.groep.position.x - ing.deur.x, g.verhaal.mark.groep.position.z - ing.deur.z),
    opdracht: document.getElementById('opdracht').textContent,
  };
});
ok(winkel.regels.some(r => /explosieven/.test(r)) && winkel.regels.some(r => /detoneren/.test(r)),
  'Mark geeft je de explosieven en zegt dat hij buiten detoneert');
ok(winkel.markBij < 12, 'hij wacht bij de deur', `${winkel.markBij.toFixed(1)} m van de ingang`);
ok(winkel.fase === 'planten' && /schappen/.test(winkel.opdracht),
  'de opdracht: naar binnen en planten bij de schappen', `${winkel.fase} · ${winkel.opdracht}`);
ok(!!winkel.plek, 'en de plek bij de schappen is bekend',
  winkel.plek ? `${winkel.plek.x.toFixed(0)}, ${winkel.plek.z.toFixed(0)}` : 'geen plek');

// -------------------------------------------------------- de bom planten
kop('de bom planten');
const planten = await page.evaluate(() => {
  const g = window.__game;
  const plek = g.verhaal.bomPlek;
  // eerst ergens anders in de winkel: daar mag het niet
  g.player.pos.set(plek.x + 14, 0, plek.z + 8);
  window.__stap(3);
  g.praat();
  const ergensAnders = { geplant: g.verhaal.bomGeplant, fase: g.verhaal.fase };
  // en dan op de plek zelf
  g.player.pos.set(plek.x + 1.0, 0, plek.z + 0.6);
  window.__stap(3);
  /*
   Zoals de hoofdlus het doet: eerst het verhaal, dan de binnenruimtes. De
   markering staat bij het bierschap, en de winkel zette daar zijn eigen
   "E — flesje bier kopen" overheen; het verhaal hoort voor te gaan.
  */
  for (const r of [g.supermarkt, g.boerderij, ...(g.woningen || [])]) {
    if (r && r.update) r.update(0.05, g.verhaal.aanspreekbaar);
  }
  const praatEl = document.getElementById('praat');
  const hint = !praatEl.hidden;
  const hintTekst = praatEl.textContent;
  g.praat();
  window.__stap(3);
  return { ergensAnders, hint, hintTekst, geplant: g.verhaal.bomGeplant, fase: g.verhaal.fase,
    opdracht: document.getElementById('opdracht').textContent };
});
ok(!planten.ergensAnders.geplant && planten.ergensAnders.fase === 'planten',
  'ergens anders in de winkel plant hij niets', planten.ergensAnders.fase);
ok(planten.hint && /bom planten/.test(planten.hintTekst || ''),
  'bij de schappen staat "E — de bom planten" in beeld', planten.hintTekst || 'niets in beeld');
ok(planten.geplant && planten.fase === 'naarbuiten', 'daar plant hij hem wel',
  `${planten.fase} · geplant: ${planten.geplant}`);

// ----------------------------------------------------------- de knal
kop('de knal');
const knal = await page.evaluate(() => {
  const g = window.__game;
  const mp = g.verhaal.mark.groep.position;
  g.player.pos.set(mp.x + 3, 0, mp.z + 3);       // buiten, naast Mark
  window.__stap(6);
  const zegt = document.getElementById('dialoogTekst').textContent;
  g.__schokNul();
  // de regels en de knal lopen vanzelf door
  let bezig = false, schok = 0;
  // wat er tijdens de aanrit te zien is: rijden ze echt, en staan er dan al
  // mannen naast de auto's? (dat hoort niet)
  let reden = 0, vroegeMannen = 0, verweg = 0;
  for (let i = 0; i < 400; i++) {
    g.verhaal.update(0.05);
    bezig = bezig || g.verhaal.knalBezig;
    schok = Math.max(schok, g.__schokKracht());
    const autos = g.verhaal.schutterAutos || [];
    if (autos.length && autos.some(a => a.speed > 1)) {
      reden++;
      if (g.verhaal.schutters) vroegeMannen++;
      verweg = Math.max(verweg, Math.max(...autos.map(a => Math.hypot(
        a.x - g.player.pos.x, a.z - g.player.pos.z))));
    }
    if (g.verhaal.fase === 'vuurgevecht') break;
    if (!document.getElementById('dialoog').hidden) g.praat();
  }
  const s = g.verhaal.schutters;
  return {
    zegt, bezig, schok, fase: g.verhaal.fase, reden, vroegeMannen, verweg,
    autos: (g.verhaal.schutterAutos || []).length,
    mannen: s ? s.aantal : 0,
    markWapen: !!(g.verhaal.mark.wapen && g.verhaal.mark.wapen.visible),
    wapenSlot: g.player.wapenSlot,
    afstand: s ? Math.min(...s.wachters.map(w => Math.hypot(
      w.persoon.groep.position.x - g.player.pos.x, w.persoon.groep.position.z - g.player.pos.z))) : -1,
    opdracht: document.getElementById('opdracht').textContent,
  };
});
ok(/afgaan/.test(knal.zegt || ''), 'Mark: "Ik laat hem afgaan"', (knal.zegt || '').slice(0, 40));
ok(knal.bezig, 'er volgt een ontploffing met rook');
ok(knal.schok > 0.3, 'en de camera schudt ervan', `schok ${knal.schok.toFixed(2)}`);
ok(knal.autos === 3, 'er komen drie auto\'s aanrijden', `${knal.autos} auto's`);
ok(knal.reden > 10 && knal.verweg > 30, 'ze rijden echt aan, van ver',
  `${knal.reden} beelden onderweg, tot ${knal.verweg.toFixed(0)} m van je vandaan`);
ok(knal.vroegeMannen === 0, 'en er staat niemand naast de auto zolang ze rijden',
  `${knal.vroegeMannen} beelden met mannen erbij`);
ok(knal.mannen === 6, 'pas daarna stappen er zes man uit', `${knal.mannen} man`);
ok(knal.markWapen, 'Mark heeft dan een pistool in zijn hand');
ok(knal.wapenSlot === false, 'en jouw wapen zit niet meer op slot');
ok(knal.afstand > 12 && knal.afstand < 40, 'ze stappen op een meter of twintig uit',
  `dichtstbijzijnde op ${knal.afstand.toFixed(0)} m`);
ok(knal.fase === 'vuurgevecht' && /schakel ze uit/i.test(knal.opdracht), 'en het vuurgevecht begint',
  `${knal.fase} · ${knal.opdracht}`);

// ------------------------------------------------------- het vuurgevecht
kop('het vuurgevecht');
const gevecht = await page.evaluate(() => {
  const g = window.__game;
  g.player.health = 100;
  const s = g.verhaal.schutters;
  // Mark schiet mee: even kijken of hij vuurt en overeind blijft
  let markVuurt = false;
  const echt = g.verhaal.mark.vuur.bind(g.verhaal.mark);
  g.verhaal.mark.vuur = () => { markVuurt = true; echt(); };
  for (let i = 0; i < 40; i++) g.verhaal.update(0.05);
  const markStaat = g.verhaal.mark.groep.visible;
  // en dan ruimen we ze zelf op, zoals een speler dat met zijn pistool doet
  for (const w of [...s.wachters]) g.verhaal.raak(w.persoon.groep);
  for (let i = 0; i < 40; i++) g.verhaal.update(0.05);
  // wat ze laten liggen: een pistool per man, met kogels erin
  const liggen = g.buit.dingen.filter(d => d.soort === 'pistool');
  const wapens = liggen.length;
  const kogelsIn = wapens ? Math.min(...liggen.map(d => d.waarde)) : 0;
  // eentje oppakken zoals je erlangs loopt
  const reserveVoor = g.player.reserve;
  let opgepakt = 0;
  if (wapens) {
    const d = liggen[0];
    g.player.pos.set(d.groep.position.x, 0, d.groep.position.z);
    opgepakt = g.buit.update(0.05, g.player, (soort, waarde) => {
      if (soort === 'pistool') { g.player.reserve += waarde; }
    });
  }
  const reserveNa = g.player.reserve;
  if (!document.getElementById('dialoog').hidden) { g.praat(); g.praat(); }
  for (let i = 0; i < 20; i++) g.verhaal.update(0.05);
  return {
    markVuurt, markStaat, neer: s.neer, fase: g.verhaal.fase, wapens, kogelsIn,
    opgepakt, erbij: reserveNa - reserveVoor,
    markWapenNa: !!(g.verhaal.mark.wapen && g.verhaal.mark.wapen.visible),
    sterren: g.politie.ster, opdracht: document.getElementById('opdracht').textContent,
  };
});
ok(gevecht.markVuurt, 'Mark schiet terug');
ok(gevecht.markStaat, 'en hij gaat zelf niet neer');
ok(gevecht.neer === 6, 'alle zes gaan neer', `${gevecht.neer} neer`);
ok(gevecht.wapens === 6, 'en ze laten alle zes een pistool liggen', `${gevecht.wapens} wapens`);
ok(gevecht.kogelsIn >= 6, 'met kogels erin', `minstens ${gevecht.kogelsIn} kogels`);
ok(gevecht.opgepakt === 1 && gevecht.erbij > 0, 'je kunt er eentje oppakken',
  `${gevecht.opgepakt} opgepakt, ${gevecht.erbij} kogels erbij`);
ok(gevecht.markWapenNa === false, 'Mark bergt zijn pistool weer op');
ok(gevecht.sterren === 2, 'daarna staat de politie op twee sterren', `${gevecht.sterren} sterren`);
ok(gevecht.fase === 'vluchten' && /bos/i.test(gevecht.opdracht), 'en je moet naar het Tinga-bos',
  `${gevecht.fase} · ${gevecht.opdracht}`);

// ------------------------------------------------------ het bos en thuis
kop('het bos in en Mark thuisbrengen');
const eind = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const g = window.__game;
  const bos = g.verhaal.bos;
  g.player.inCar = null;
  g.player.pos.set(bos.x, 0, bos.z);
  window.__stap(8);
  const naBos = { sterren: g.politie.ster, fase: g.verhaal.fase,
    tekst: document.getElementById('dialoogTekst').textContent };
  for (let i = 0; i < 10 && !document.getElementById('dialoog').hidden; i++) { g.praat(); window.__stap(2); }
  window.__stap(6);
  const opdracht = document.getElementById('opdracht').textContent;
  // en naar Molenkrite 15
  // de kaart wijst de plek aan waar je Mark afzet: daar gaan we heen staan
  const pand = KAART.panden.find(p => p.straat === 'Molenkrite' && (p.nr || []).includes('15'));
  const nav = g.hud.nav && g.hud.nav.doel;
  const doel = nav ? { x: nav[0], z: nav[1] } : { x: pand.rect.cx + 8, z: pand.rect.cz + 8 };
  const geldVoor = g.verhaal.geld;
  g.player.pos.set(doel.x, 0, doel.z);
  window.__stap(8);
  const regels = [];
  for (let i = 0; i < 12; i++) {
    const t = document.getElementById('dialoogTekst').textContent;
    if (!t) break;
    regels.push(t);
    g.praat();
    window.__stap(2);
  }
  window.__stap(6);
  return { naBos, opdracht, regels, geldVoor, geldNa: g.verhaal.geld,
    missie: g.verhaal.missie, fase: g.verhaal.fase,
    melding: document.getElementById('missie').textContent,
    markZichtbaar: g.verhaal.mark.groep.visible };
});
ok(eind.naBos.sterren === 0 && eind.naBos.fase === 'thuisbrengen',
  'in het bos ben je de politie kwijt',
  `${eind.naBos.sterren} sterren, fase ${eind.naBos.fase}`);
ok(/nippertje/.test(eind.naBos.tekst || ''), 'Mark: "Poeh, op het nippertje"', (eind.naBos.tekst || '').slice(0, 40));
ok(/Molenkrite/i.test(eind.opdracht), 'daarna moet hij naar Molenkrite 15', eind.opdracht);
ok(eind.regels.some(r => /geld van De Veteraan/i.test(r)) && eind.regels.some(r => /broeder/i.test(r)),
  'hij bedankt je en noemt het geld van De Veteraan');
ok(eind.geldNa - eind.geldVoor === 300, 'de beloning is € 300', `€ ${eind.geldVoor} → € ${eind.geldNa}`);
ok(/MISSIE VOLTOOID/.test(eind.melding) && /BOM/i.test(eind.melding), 'MISSIE VOLTOOID – DE BOM',
  (eind.melding || '').slice(0, 40));
ok(eind.missie === 'klaar' && eind.fase === 'klaar', 'en de missie is afgerond',
  `${eind.missie}/${eind.fase}`);

console.log(`\n${fout ? fout + ' fout' : 'alles goed'}`);
await browser.close();
process.exit(fout ? 1 : 0);
