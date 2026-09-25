/*
 Missie 9: een eigen stek. De drie woningen van De Veteraan, en wat erin staat.

   node tools/server.mjs 8123 &   node tools/huistest.mjs [poort]

 1. De drie woningen staan er, met hun echte maten uit de kaart en met de
    prijzen 5000 / 2500 / 1000 — en alle drie groter dan de Wieken 29.
 2. Binnen: een tafel om aan te zitten, een koelkast met bier, een tv die
    aanstaat, en twee katten die rondlopen.
 3. De missie: Mark belt, staat bij de Wieken, en daarna staan de drie huizen
    als vlag op de kaart.
 4. Te weinig geld houdt de missie open; genoeg geld maakt hem af, haalt het
    sleutelgeld van je wallet en laat één vlag over: je eigen stek.
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
await page.evaluate(() => {
  const g = window.__game;
  localStorage.removeItem('tinga.spel.v1');
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true;
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) g.verhaal.update(dt); };
  /*
   Een gesprek wegklikken. Stoppen zodra de balk weg is: `dialoogTekst` houdt de
   laatste zin vast, dus daarop doortellen betekende nog dertig keer E drukken —
   en stond je dan toevallig bij de tafel van een van de drie woningen, dan kocht
   de proef het huis dat ze net wilde bekijken.
  */
  window.__klik = (n = 30) => {
    for (let i = 0; i < n; i++) {
      if (document.getElementById('dialoog').hidden) break;
      g.praat(); window.__stap(2);
    }
  };
  window.__stek = () => g.woningen.filter(w => w.stek);
  /*
   Even wachten tot het stil is. Mark zegt bij elke woning iets zodra je vlakbij
   staat; dat zinnetje klikt zichzelf weg, maar zolang het in beeld staat toont
   het verhaal geen koopregel en gaat E naar het gesprek in plaats van naar de
   tafel.
  */
  window.__rust = (n = 120) => {
    for (let i = 0; i < n; i++) {
      g.verhaal.update(0.2);
      if (i > 8 && document.getElementById('dialoog').hidden) return true;
    }
    return document.getElementById('dialoog').hidden;
  };
});

// ------------------------------------------------------- de drie woningen
kop('de drie woningen van De Veteraan');
const huizen = await page.evaluate(() => {
  const g = window.__game;
  const wieken = g.woningen[1];
  return {
    wieken: { naam: wieken.naam, opp: +(wieken.maten.breed * wieken.maten.diep).toFixed(0) },
    lijst: window.__stek().map(w => ({
      naam: w.naam, prijs: w.prijs, soort: w.soort,
      breed: +w.maten.breed.toFixed(1), diep: +w.maten.diep.toFixed(1),
      opp: +(w.maten.breed * w.maten.diep).toFixed(0),
      katten: w.katten.length, tv: w.tvAan,
      tafel: !!w.plekken.tafel, koelkast: !!w.plekken.koelkast,
    })),
  };
});
ok(huizen.lijst.length === 3, 'er staan er drie', huizen.lijst.map(h => h.naam).join(', '));
for (const h of huizen.lijst) {
  ok(h.opp > huizen.wieken.opp, `${h.naam} is groter dan de Wieken 29`,
    `${h.opp} tegen ${huizen.wieken.opp} m²`);
}
const prijzen = huizen.lijst.map(h => h.prijs).sort((a, b) => b - a);
ok(prijzen.join(',') === '5000,2500,1000', 'en de prijzen zijn 5000, 2500 en 1000',
  prijzen.join(' · '));

// --------------------------------------------------------- wat er binnen staat
kop('binnen: tafel, koelkast, tv en katten');
for (const h of huizen.lijst) {
  ok(h.tafel && h.koelkast, `${h.naam} heeft een tafel en een koelkast`);
}
ok(huizen.lijst.every(h => h.tv), 'de tv staat aan');
ok(huizen.lijst.every(h => h.katten === 2), 'en er lopen twee katten rond',
  huizen.lijst.map(h => h.katten).join('/'));

const binnen = await page.evaluate(() => {
  const g = window.__game;
  const w = window.__stek()[0];
  const p = w.plekken;
  // aan tafel gaan zitten
  g.player.inCar = null;
  g.player.pos.set(p.stoel.x, 0, p.stoel.z);
  const hint = (() => {
    w.update(0.05, false);
    const el = document.getElementById('praat');
    return el.hidden ? '' : el.textContent;
  })();
  w.toets();
  const zit = { zit: g.player.zit, oog: +g.player.eye.toFixed(2) };
  w.toets();                                   // en weer opstaan
  const staat = { zit: g.player.zit, oog: +g.player.eye.toFixed(2) };
  // een flesje uit de koelkast
  g.player.health = 60; g.hud.zetLeven(60);
  g.player.pos.set(p.koelkast.x, 0, p.koelkast.z);
  const bij = w.bijKoelkast(g.player.pos.x, g.player.pos.z);
  w.update(0.05, false);
  const koelHint = document.getElementById('praat').hidden ? '' : document.getElementById('praat').textContent;
  w.toets();
  return { hint, zit, staat, koelHint, bij, leven: g.player.health, flesjes: w.flesjes };
});
ok(/aan tafel/i.test(binnen.hint), 'bij de stoel staat de hint', binnen.hint);
ok(binnen.zit.zit && binnen.zit.oog < 1.2, 'je zit aan tafel', `oog op ${binnen.zit.oog} m`);
ok(!binnen.staat.zit, 'en je staat weer op');
ok(/koelkast/i.test(binnen.koelHint), 'bij de koelkast staat de hint',
  `${binnen.koelHint || 'geen'} (bereik: ${binnen.bij})`);
ok(binnen.leven > 60 && binnen.flesjes === 1, 'een flesje uit de eigen koelkast geeft leven',
  `${binnen.leven} leven, ${binnen.flesjes} flesje`);

// ---------------------------------------------------------- de inrichting
kop('de inrichting van de kamer');
const spullen = await page.evaluate(() => {
  const g = window.__game;
  const uit = (w) => ({ naam: w.naam, ...w.inrichting,
    bank: +w.maten.bank.breed.toFixed(2), bankRuimte: +w.maten.bank.ruimte.toFixed(2),
    zitvlak: +w.maten.bank.zitvlak.toFixed(2), tvAfstand: +w.maten.tv.afstand.toFixed(2),
    wand: w.maten.bank.wand });
  return { stek: window.__stek().map(uit), wieken: uit(g.woningen[1]) };
});
for (const h of spullen.stek) {
  ok(h.schilderij && h.kleed && h.salontafel,
    `${h.naam}: schilderij, kleed en salontafel`,
    `${h.schilderij ? '' : 'geen schilderij '}${h.kleed ? '' : 'geen kleed '}${h.salontafel ? '' : 'geen salontafel'}`);
  ok(h.dressoir && h.fotos && h.lamp, `${h.naam}: dressoir met foto's en een schemerlamp`);
  ok(h.plant && h.klok && h.kattenmand, `${h.naam}: plant, klok en kattenmand`);
  ok(h.gordijnen && h.accentwand, `${h.naam}: gordijnen bij de pui en een gekleurde wand`);
  ok(h.keuken >= 6, `${h.naam}: het aanrecht staat niet leeg`, `${h.keuken} dingen`);
  /*
   Hij was overal 2,10, ook in een kamer die maar 1,7 m wand had. Nu vult hij het
   vrije stuk wand tot maximaal 2,55 — dus in een diepe kamer een stuk ruimer, en
   in een ondiepe precies wat erin past.
  */
  const past = Math.min(3.20, h.bankRuimte - 0.2);
  ok(h.bank >= past - 0.02, `${h.naam}: de bank vult de wand`,
    `${h.bank} m van de ${h.bankRuimte} m wand`);
  /*
   Het zitvlak moet ruim twee keer zo groot zijn als de oude drie-zits van
   2,10 bij 0,90 — met de chaise longue erbij waar de kamer dat toelaat.
  */
  ok(h.zitvlak >= 3.8, `${h.naam}: het zitvlak is meer dan verdubbeld`,
    `${h.zitvlak} m² tegen 1,9 m² (bank tegen de ${h.wand}wand`
    + `${h.hoek ? ', met chaise longue' : ''})`);
}
ok(spullen.stek.every(h => h.tvAfstand > 2.4 && h.tvAfstand < 4.2),
  'de tv staat op kijkafstand van de bank',
  spullen.stek.map(h => `${h.tvAfstand} m`).join(' · '));
ok(spullen.wieken.schilderij && spullen.wieken.dressoir && spullen.wieken.plant,
  'en de Wieken 29 is mee opgeknapt', `bank ${spullen.wieken.bank} m, ${spullen.wieken.keuken} in de keuken`);

// ------------------------------------------------- ramen, tuin en het opstaan
kop('ramen, de tuin en uit het goede huis komen');
const buitenom = await page.evaluate(async () => {
  const W = await import('/js/world.js');
  const g = window.__game;
  const uit = { ramen: [], tuin: [], hek: [], deur: [] };
  for (const w of window.__stek()) {
    uit.ramen.push(w.inrichting.ramen);
    const p = w.plekken;
    uit.tuin.push(!!p.tuindeur && !!p.terras && w.tuin(p.terras.x, p.terras.z));
    // door de tuindeur kun je lopen, door het hek niet
    const d = p.tuindeur;
    const [dx, dz] = W.resolveCollisions(d.x, d.z, 0.34);
    uit.deur.push(+Math.hypot(dx - d.x, dz - d.z).toFixed(2));
    const h = p.hek;
    const [hx, hz] = W.resolveCollisions(h.x, h.z, 0.34);
    uit.hek.push(+Math.hypot(hx - h.x, hz - h.z).toFixed(2));
  }
  // en het opstaan: ga in het derde huis zitten en druk op E via het spel zelf
  const w = window.__stek()[2];
  g.player.inCar = null;
  g.player.pos.set(w.plekken.stoel.x, 0, w.plekken.stoel.z);
  g.praat();                                   // zitten
  const zat = g.player.zit;
  g.praat();                                   // en opstaan
  uit.opstaan = { zat, zit: g.player.zit, inHuis: w.binnen(g.player.pos.x, g.player.pos.z),
    naam: w.naam };
  return uit;
});
ok(buitenom.ramen.every(n => n >= 3), 'er zitten ramen in de buitenmuren',
  buitenom.ramen.join(' · '));
ok(buitenom.tuin.every(Boolean), 'achter elk huis ligt een tuin');
ok(buitenom.deur.every(v => v < 0.05), 'door de tuindeur loop je naar buiten',
  buitenom.deur.join(' · '));
ok(buitenom.hek.every(v => v > 0.1), 'en door het hek kom je niet',
  buitenom.hek.map(v => `${v} m opzij gezet`).join(' · '));
ok(buitenom.opstaan.zat && !buitenom.opstaan.zit && buitenom.opstaan.inHuis,
  'opstaan laat je staan in het huis waar je zat', buitenom.opstaan.naam);

// ------------------------- dichte ramen, radio, barbecue, oprit en de kijkdoos
kop('de tweede ronde meldingen');
const ronde2 = await page.evaluate(() => {
  const g = window.__game;
  const uit = { keuken: [], overlap: [], radio: [], sterkte: [], bbq: null, oprit: [], zit: [] };
  for (const w of window.__stek()) {
    const m = w.maten, p = w.plekken;
    // de keuken begint achter de gang, en niet in de gangdeur
    uit.keuken.push(+(m.keukenVak.z0 - m.hal.z1).toFixed(2));
    // geen nagebouwd buurpand over de kamer of de tuin heen
    const punten = [p.deurBinnen, p.stoel, p.bank, p.tafel, p.terras].filter(Boolean);
    uit.overlap.push(punten.filter(q => w.kijkdoosRaakt(q.x, q.z, 1.0)).length);
    // op elk dressoir staat een radio, en die is met E aan en uit te zetten
    uit.radio.push(!!p.radio);
    if (p.radio) {
      g.player.pos.set(p.radio.x + 0.6, 0, p.radio.z);
      const hint1 = w.bijRadio(g.player.pos.x, g.player.pos.z);
      w.toets();
      const dichtbij = +w.radioSterkte(g.player.pos.x, g.player.pos.z).toFixed(2);
      // een eind verderop in dezelfde kamer moet hij zachter staan
      const ver = +w.radioSterkte(p.tafel.x, p.tafel.z).toFixed(2);
      const buitenshuis = +w.radioSterkte(p.deurBuiten.x, p.deurBuiten.z).toFixed(2);
      w.toets();                                  // en weer uit
      const na = +w.radioSterkte(g.player.pos.x, g.player.pos.z).toFixed(2);
      uit.sterkte.push({ naam: w.naam, hint: hint1, dichtbij, ver, buitenshuis, na, aan: w.radioAan });
    }
    // de oprit ligt naast de voordeur, in de echte wereld
    const o = p.oprit;
    uit.oprit.push(o ? +Math.hypot(o.x - p.deurBuiten.x, o.z - p.deurBuiten.z).toFixed(1) : -1);
    // en aan tafel kun je zitten
    g.player.inCar = null; g.player.zit = false;
    g.player.pos.set(p.stoel.x, 0, p.stoel.z);
    w.toets();
    uit.zit.push({ naam: w.naam, zit: g.player.zit });
    w.toets();
  }
  // de barbecue: vlees erop, wachten, opeten
  {
    const w = window.__stek()[0], p = w.plekken;
    g.player.health = 40; g.hud.zetLeven(40);
    g.player.pos.set(p.bbq.x + 0.8, 0, p.bbq.z);
    const bij = w.bijBBQ(g.player.pos.x, g.player.pos.z);
    w.toets();
    const opgelegd = w.vlees;
    for (let i = 0; i < 40; i++) w.update(1, false);        // veertig tellen wachten
    const gaar = w.vlees;
    w.toets();
    uit.bbq = { bij, opgelegd, gaar, leven: g.player.health, na: w.vlees };
  }
  return uit;
});
ok(ronde2.keuken.every(v => v > 0), 'de keuken begint achter de gang',
  ronde2.keuken.map(v => `${v} m`).join(' · '));
ok(ronde2.overlap.every(v => v === 0), 'er staat geen buurpand over de kamer heen',
  ronde2.overlap.join(' · '));
ok(ronde2.radio.every(Boolean), 'op elk dressoir staat een radio');
ok(ronde2.sterkte.every(r => r.hint && r.dichtbij > 0.7 && !r.aan && r.na === 0),
  'E zet de radio aan en weer uit',
  ronde2.sterkte.map(r => `${r.naam}: ${r.dichtbij}`).join(' · '));
ok(ronde2.sterkte.every(r => r.ver < r.dichtbij && r.buitenshuis === 0),
  'verder weg klinkt hij zachter, buiten de deur uit',
  ronde2.sterkte.map(r => `${r.dichtbij} → ${r.ver} → ${r.buitenshuis}`).join(' · '));
ok(ronde2.oprit.every(v => v > 1 && v < 12), 'naast elke voordeur ligt een oprit',
  ronde2.oprit.map(v => `${v} m`).join(' · '));
ok(ronde2.zit.every(r => r.zit), 'in elke woning kun je aan tafel gaan zitten',
  ronde2.zit.map(r => `${r.naam}: ${r.zit ? 'ja' : 'nee'}`).join(' · '));
ok(ronde2.bbq && ronde2.bbq.bij && ronde2.bbq.opgelegd === 'op de barbecue'
  && ronde2.bbq.gaar === 'gaar' && ronde2.bbq.leven > 60 && ronde2.bbq.na === 'niets',
  'op de barbecue braad je vlees en dat eet je op',
  ronde2.bbq ? `${ronde2.bbq.opgelegd} → ${ronde2.bbq.gaar} → ${ronde2.bbq.leven} leven` : 'geen');

// ------------------------------------- staan er meubels in elkaar? (clipping)
/*
 Melding 25 sep 2026: "clipping bij objecten in de huisjes die je kan kopen".
 Elk meubelstuk met een botsdoos wordt tegen elk ander gelegd; overlappen twee
 grondvlakken meer dan twaalf centimeter in beide richtingen, dan staan ze in
 elkaar. Muren, kozijnen en deuren tellen niet mee: daar hoort een kast juist
 tegenaan te staan.
*/
kop('staat er niets in elkaar');
const inelkaar = await page.evaluate(() => {
  const g = window.__game;
  const uit = [];
  for (const w of g.woningen) {
    const meubels = w.botsdozen.filter(d => !d.muur);
    const paren = [];
    for (let i = 0; i < meubels.length; i++) {
      for (let j = i + 1; j < meubels.length; j++) {
        const a = meubels[i], b = meubels[j];
        const ox = Math.min(a.x + a.hx, b.x + b.hx) - Math.max(a.x - a.hx, b.x - b.hx);
        const oz = Math.min(a.z + a.hz, b.z + b.hz) - Math.max(a.z - a.hz, b.z - b.hz);
        if (ox > 0.12 && oz > 0.12) {
          paren.push(`${ox.toFixed(2)}×${oz.toFixed(2)} m bij (${(a.x - w.plekken.nul.x).toFixed(1)}, ${(a.z - w.plekken.nul.z).toFixed(1)})`);
        }
      }
    }
    uit.push({ naam: w.naam, meubels: meubels.length, paren });
  }
  return uit;
});
for (const h of inelkaar) {
  ok(h.paren.length === 0, `${h.naam}: geen meubels in elkaar`,
    h.paren.length ? `${h.paren.length} paren, o.a. ${h.paren.slice(0, 3).join(' · ')}` : `${h.meubels} meubels`);
}

// ------------------------------------------------------------- de missie
kop('de missie: Mark belt, drie vlaggen op de kaart');
const start = await page.evaluate(() => {
  const g = window.__game;
  g.verhaal.__startMissie('huis');
  window.__stap(40);                       // de telefoon gaat
  /*
   Doortellen op `dialoogTekst` kan niet: die houdt de laatste zin vast als de
   balk allang weg is. De lus drukte daarna nog dertig keer E terwijl de speler
   bij de tafel van Koningsspil stond — en liet hem zittend achter, waardoor de
   koopregel verderop niet meer verscheen.
  */
  let telefoon = '';
  for (let i = 0; i < 30; i++) {
    if (document.getElementById('dialoog').hidden) break;
    telefoon += ' ' + document.getElementById('dialoogTekst').textContent;
    g.praat(); window.__stap(2);
  }
  window.__stap(4);
  return { telefoon, missie: g.verhaal.missie, fase: g.verhaal.fase,
    mark: g.verhaal.mark.groep.visible,
    opdracht: document.getElementById('opdracht').textContent };
});
ok(/panden/i.test(start.telefoon) && /Wieken/i.test(start.telefoon),
  'Mark belt over de drie panden', (start.telefoon || '').trim().slice(0, 60));
ok(start.missie === 'huis' && start.fase === 'naar_mark', 'en je moet naar hem toe',
  `${start.missie}/${start.fase}`);
ok(/Wieken/i.test(start.opdracht), 'de opdracht wijst naar de Wieken', start.opdracht);

const kiezen = await page.evaluate(() => {
  const g = window.__game;
  const m = g.verhaal.mark.groep.position;
  g.player.pos.set(m.x + 1.5, 0, m.z + 1.5);
  window.__stap(6); window.__klik(); window.__stap(4);
  g.kaartvlaggen();
  const vlaggen = (g.hud.winkels || []).filter(w => w.wat === 'huis');
  return { fase: g.verhaal.fase, vlaggen: vlaggen.length,
    namen: vlaggen.map(v => v.naam), opdracht: document.getElementById('opdracht').textContent };
});
ok(kiezen.fase === 'kiezen', 'na de briefing mag je kiezen', kiezen.fase);
ok(kiezen.vlaggen === 3, 'en staan er drie huisjes op de kaart', kiezen.namen.join(' · '));

const keuze = await page.evaluate(() => {
  const g = window.__game;
  const w2 = window.__stek()[1];
  const gekozen = g.verhaal.kiesHuis(2);
  const nav = g.hud.nav;
  const d = w2.plekken.deurBuiten;
  const bij = nav && nav.doel ? Math.hypot(nav.doel[0] - d.x, nav.doel[1] - d.z) : -1;
  // en Mark verdwijnt zodra je van de Wieken wegloopt
  g.player.pos.set(d.x + 40, 0, d.z + 40);
  window.__stap(6);
  return { gekozen, naam: w2.naam, bij: +bij.toFixed(1), mark: g.verhaal.mark.groep.visible,
    opdracht: document.getElementById('opdracht').textContent };
});
ok(keuze.gekozen && keuze.bij >= 0 && keuze.bij < 6,
  'met 2 gaat de navigatie naar de tweede woning', `${keuze.naam}, ${keuze.bij} m van de deur`);
ok(/Molenkrite 130c/i.test(keuze.opdracht), 'en de opdracht noemt hem', keuze.opdracht);
ok(!keuze.mark, 'Mark blijft niet bij de Wieken staan als je op pad gaat');

// ------------------------------------------- alle drie bekeken zonder te kopen
kop('alle drie bekeken en niets gekocht');
const rondje = await page.evaluate(() => {
  const g = window.__game;
  for (const w of window.__stek()) {
    g.player.pos.set(w.plekken.deurBinnen.x, 0, w.plekken.deurBinnen.z);
    window.__rust();
  }
  // weer de deur uit voor we het gesprek wegklikken: bij de tafel is E kopen
  const eerste = window.__stek()[0];
  g.player.pos.set(eerste.plekken.deurBuiten.x, 0, eerste.plekken.deurBuiten.z);
  window.__rust(); window.__klik(); window.__stap(10);
  g.kaartvlaggen();
  return { missie: g.verhaal.missie, fase: g.verhaal.fase, aanbod: g.verhaal.stekAanbod,
    gezien: g.verhaal.stekGezien.length, stek: g.verhaal.stek,
    vlaggen: (g.hud.winkels || []).filter(x => x.wat === 'huis').length,
    melding: document.getElementById('missie').textContent };
});
ok(rondje.gezien === 3, 'je hebt ze alle drie van binnen gezien', `${rondje.gezien} van de 3`);
ok(rondje.missie === 'klaar' && /VOLTOOID/i.test(rondje.melding),
  'de missie is klaar, ook zonder te kopen', `${rondje.missie}/${rondje.fase}`);
ok(rondje.aanbod && !rondje.stek && rondje.vlaggen === 3,
  'en het aanbod blijft staan: drie vlaggen op de kaart', `${rondje.vlaggen} vlaggen`);

// --------------------------------------------------- te weinig geld, en genoeg
kop('kopen: eerst te weinig, dan genoeg');
const arm = await page.evaluate(() => {
  const g = window.__game;
  const w = window.__stek().find(x => x.prijs === 5000);
  window.__klik(); window.__stap(4);         // eerst de balk leeg
  g.verhaal.betaal(g.verhaal.geld);          // wallet leeg
  g.player.pos.set(w.plekken.stoel.x, 0, w.plekken.stoel.z);
  /*
   Na een voltooide missie loopt het verhaal door en kan er onderweg nog een
   telefoontje binnenkomen; zolang dat in beeld staat toont het verhaal geen
   koopregel. Dus: uitwachten, wegklikken, en dan pas kijken.
  */
  window.__rust(); window.__klik(); window.__stap(6);
  const el = document.getElementById('praat');
  const hint = el.hidden ? '' : el.textContent;
  // waarom niet, als hij er niet staat: elk van de voorwaarden apart
  const waarom = {
    balk: document.getElementById('dialoog').hidden,
    zit: !!g.player.zit, inCar: !!g.player.inCar, actief: !!g.player.active,
    binnen: w.binnen(g.player.pos.x, g.player.pos.z),
    bijTafel: w.bijTafel(g.player.pos.x, g.player.pos.z),
    aanspreekbaar: g.verhaal.aanspreekbaar,
  };
  g.praat();
  window.__stap(4);
  const melding = document.getElementById('dialoogTekst').textContent;
  return { hint, melding, waarom, aanbod: g.verhaal.stekAanbod, geld: g.verhaal.geld,
    stek: g.verhaal.stek };
});
ok(/kopen/i.test(arm.hint) && /5\.?000/.test(arm.hint), 'aan tafel staat de koopregel',
  `${arm.hint || 'geen'} · ${JSON.stringify(arm.waarom)}`);
ok(/zoveel heb je nog niet/i.test(arm.melding), 'Mark belt dat het nog niet genoeg is',
  (arm.melding || '').slice(0, 45));
ok(arm.aanbod && !arm.stek, 'en het aanbod blijft openstaan');

const koop = await page.evaluate(() => {
  const g = window.__game;
  const w = window.__stek().find(x => x.prijs === 2500);
  window.__klik();                            // het telefoontje wegklikken
  g.verhaal.verdien(4000);
  const voor = g.verhaal.geld;
  g.player.pos.set(w.plekken.stoel.x, 0, w.plekken.stoel.z);
  window.__rust();
  g.praat();
  window.__stap(4); window.__klik(); window.__stap(10);
  g.kaartvlaggen();
  const vlaggen = (g.hud.winkels || []).filter(x => x.wat === 'huis');
  return { voor, na: g.verhaal.geld, stek: g.verhaal.stek, aanbod: g.verhaal.stekAanbod,
    vlaggen: vlaggen.length, naam: vlaggen[0] ? vlaggen[0].naam : null,
    melding: document.getElementById('missie').textContent };
});
ok(koop.stek === 'Molenkrite 130c', 'met genoeg geld koop je het huis', String(koop.stek));
ok(koop.voor - koop.na === 2500, 'en het sleutelgeld gaat van je wallet',
  `${koop.voor} → ${koop.na}`);
ok(!koop.aanbod, 'het aanbod is daarmee van tafel');
ok(koop.vlaggen === 1 && /stek/i.test(koop.naam || ''),
  'en op de kaart blijft alleen je eigen stek staan', `${koop.vlaggen} vlag: ${koop.naam}`);

console.log(`\n${fout ? fout + ' fout' : 'alles goed'}`);
await browser.close();
process.exit(fout ? 1 : 0);
