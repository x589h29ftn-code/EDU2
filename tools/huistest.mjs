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
  window.__klik = (n = 30) => {
    for (let i = 0; i < n; i++) {
      if (!document.getElementById('dialoogTekst').textContent) break;
      g.praat(); window.__stap(2);
    }
  };
  window.__stek = () => g.woningen.filter(w => w.stek);
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
    bank: +w.maten.bank.breed.toFixed(2), bankRuimte: +w.maten.bank.ruimte.toFixed(2) });
  return { stek: window.__stek().map(uit), wieken: uit(g.woningen[1]) };
});
for (const h of spullen.stek) {
  ok(h.schilderij && h.kleed && h.salontafel,
    `${h.naam}: schilderij, kleed en salontafel`,
    `${h.schilderij ? '' : 'geen schilderij '}${h.kleed ? '' : 'geen kleed '}${h.salontafel ? '' : 'geen salontafel'}`);
  ok(h.dressoir && h.fotos && h.lamp, `${h.naam}: dressoir met foto's en een schemerlamp`);
  ok(h.plant, `${h.naam}: een plant in de hoek`);
  ok(h.keuken >= 4, `${h.naam}: het aanrecht staat niet leeg`, `${h.keuken} dingen`);
  /*
   Hij was overal 2,10, ook in een kamer die maar 1,7 m wand had. Nu vult hij het
   vrije stuk wand tot maximaal 2,55 — dus in een diepe kamer een stuk ruimer, en
   in een ondiepe precies wat erin past.
  */
  const past = Math.min(2.55, h.bankRuimte - 0.2);
  ok(h.bank >= past - 0.02, `${h.naam}: de bank vult de wand`,
    `${h.bank} m van de ${h.bankRuimte} m wand`);
}
ok(spullen.wieken.schilderij && spullen.wieken.dressoir && spullen.wieken.plant,
  'en de Wieken 29 is mee opgeknapt', `bank ${spullen.wieken.bank} m, ${spullen.wieken.keuken} in de keuken`);

// ------------------------------------------------------------- de missie
kop('de missie: Mark belt, drie vlaggen op de kaart');
const start = await page.evaluate(() => {
  const g = window.__game;
  g.verhaal.__startMissie('huis');
  window.__stap(40);                       // de telefoon gaat
  let telefoon = '';
  for (let i = 0; i < 30; i++) {
    const t = document.getElementById('dialoogTekst').textContent;
    if (!t) break;
    telefoon += ' ' + t;
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

// --------------------------------------------------- te weinig geld, en genoeg
kop('kopen: eerst te weinig, dan genoeg');
const arm = await page.evaluate(() => {
  const g = window.__game;
  const w = window.__stek().find(x => x.prijs === 5000);
  g.verhaal.betaal(g.verhaal.geld);          // wallet leeg
  g.player.pos.set(w.plekken.stoel.x, 0, w.plekken.stoel.z);
  /*
   Mark zegt bij elk huis wat hij ervan vindt zodra je vlakbij staat. Dat zinnetje
   klikt zichzelf weg, maar zolang het in beeld staat toont het verhaal geen
   koopregel — dus eerst een paar tellen laten lopen en dan pas kijken.
  */
  window.__stap(6);
  for (let i = 0; i < 200 && !document.getElementById('dialoog').hidden; i++) g.verhaal.update(0.1);
  window.__stap(4);
  const el = document.getElementById('praat');
  const hint = el.hidden ? '' : el.textContent;
  g.praat();
  window.__stap(4);
  const melding = document.getElementById('dialoogTekst').textContent;
  return { hint, melding, missie: g.verhaal.missie, fase: g.verhaal.fase,
    geld: g.verhaal.geld, stek: g.verhaal.stek };
});
ok(/kopen/i.test(arm.hint) && /5\.?000/.test(arm.hint), 'aan tafel staat de koopregel', arm.hint);
ok(/niet|terug|hebt/i.test(arm.melding), 'Mark belt dat het nog niet genoeg is',
  (arm.melding || '').slice(0, 45));
ok(arm.missie === 'huis' && arm.fase === 'kiezen' && !arm.stek,
  'en de missie blijft openstaan', `${arm.missie}/${arm.fase}`);

const koop = await page.evaluate(() => {
  const g = window.__game;
  const w = window.__stek().find(x => x.prijs === 2500);
  window.__klik();                            // het telefoontje wegklikken
  g.verhaal.verdien(4000);
  const voor = g.verhaal.geld;
  g.player.pos.set(w.plekken.stoel.x, 0, w.plekken.stoel.z);
  window.__stap(6);
  for (let i = 0; i < 200 && !document.getElementById('dialoog').hidden; i++) g.verhaal.update(0.1);
  window.__stap(4);
  g.praat();
  window.__stap(4); window.__klik(); window.__stap(10);
  g.kaartvlaggen();
  const vlaggen = (g.hud.winkels || []).filter(x => x.wat === 'huis');
  return { voor, na: g.verhaal.geld, stek: g.verhaal.stek, missie: g.verhaal.missie,
    vlaggen: vlaggen.length, naam: vlaggen[0] ? vlaggen[0].naam : null,
    melding: document.getElementById('missie').textContent };
});
ok(koop.stek === 'Molenkrite 130c', 'met genoeg geld koop je het huis', String(koop.stek));
ok(koop.voor - koop.na === 2500, 'en het sleutelgeld gaat van je wallet',
  `${koop.voor} → ${koop.na}`);
ok(/VOLTOOID/i.test(koop.melding), 'de missie is voltooid', (koop.melding || '').slice(0, 40));
ok(koop.vlaggen === 1 && /stek/i.test(koop.naam || ''),
  'en op de kaart blijft alleen je eigen stek staan', `${koop.vlaggen} vlag: ${koop.naam}`);

console.log(`\n${fout ? fout + ' fout' : 'alles goed'}`);
await browser.close();
process.exit(fout ? 1 : 0);
