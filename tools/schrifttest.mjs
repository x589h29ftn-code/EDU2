/*
 Het einde van missie 12 en missie 13, het schrift (verzoek 27 sep 2026).

   node tools/server.mjs 8123 &   node tools/schrifttest.mjs [poort]

 1. In het Tinga-bos zegt Mark dat ze even op de achtergrond moeten blijven tot
    de rust terug is in de wijk: "Zoek me later weer op."
 2. Na MISSIE GESLAAGD wordt het zwart, "Een paar dagen later", en is het middag.
    Je staat voor je eigen huis, en de M staat in Duinterpen: Mark voor de deur
    van Parelmoervlinder 3, niet binnen.
 3. Bij Mark begint missie 13 vanzelf: het schrift van De Veteraan ligt in zijn
    sloep in IJlst.
 4. Op de kade: politielint, twee agenten in uniform, het schrift in de sloep en
    een markering. E pakt het. Zien ze je, dan twee sterren.
 5. Met de politie achter je wil Mark het niet; zonder wel: geslaagd, € 2.500.

 En: shift+[ start hem los, en opslaan en laden midden in de missie.
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
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  const { geluid } = await import('/js/audio.js');
  const P = await import('/js/politie.js');
  localStorage.removeItem('tinga.spel.v1');
  localStorage.removeItem('tinga.checkpoint.v1');
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  geluid.start();
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) g.verhaal.update(dt); };
  window.__balkDicht = () => document.getElementById('dialoog').hidden;
  window.__gesprek = (max = 40) => {
    const regels = [];
    for (let i = 0; i < max && !window.__balkDicht(); i++) {
      regels.push({ wie: document.getElementById('dialoogNaam').textContent, tekst: document.getElementById('dialoogTekst').textContent });
      g.praat();
      window.__stap(2);
    }
    return regels;
  };
  window.__nav = () => (g.hud.nav ? { letter: g.hud.nav.letter, x: g.hud.nav.doel[0], z: g.hud.nav.doel[1] } : null);
  window.__zet = (x, z) => { g.player.inCar = null; g.player.pos.set(x, 0, z); g.player.applyCamera(); };
  window.__hint = () => { const el = document.getElementById('praat'); return el.hidden ? '' : el.textContent; };
  window.__inPak = (p) => {
    let ja = false;
    p.groep.traverse(o => { if (o.isMesh && o.material && o.material.color && o.material.color.getHex() === P.UNIFORM.shirt) ja = true; });
    return ja;
  };
});

// ------------------------------------------------ het einde van missie 12
kop('in het Tinga-bos: op de achtergrond blijven');
const bos = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  // missie 12 na het gevecht: Mark praat, dan naar het bos
  v.herstel({ missie: 'brug', fase: 'vluchten', geld: 0, huis: 'Koningsspil 20',
    veteraanKlaar: true, politieautoKlaar: true });
  window.__stap(2);
  window.__gesprek();
  window.__stap(2);
  const b = v.bos;
  window.__zet(b.x, b.z);
  window.__stap(3);
  const regels = window.__gesprek();
  window.__stap(2);
  return { regels, missie: v.missie, klaar: v.brug.klaar, wacht: v.schrift.wachtT };
});
const bosTekst = bos.regels.map(r => r.tekst).join(' ');
ok(/op de achtergrond blijven/.test(bosTekst) && /rust terug is in de wijk/.test(bosTekst) && /Zoek me later weer op/.test(bosTekst),
  'Mark: op de achtergrond blijven tot de rust terug is, "Zoek me later weer op."');
ok(bos.missie === 'klaar' && bos.klaar && bos.wacht > 3, 'missie 12 geslaagd, en even later wordt het zwart', `over ${bos.wacht.toFixed(1)} s`);

kop('een paar dagen later');
const later = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  const el = document.getElementById('overgang'), t = document.getElementById('overgangtekst');
  let tekst = '', max = 0;
  for (let i = 0; i < 400; i++) {
    v.update(0.05);
    const d = parseFloat(el.style.opacity || '0');
    if (d > max) { max = d; if (d > 0.99) tekst = t.textContent; }
    if (max > 0.99 && d < 0.001) break;
  }
  window.__stap(2);
  const w = g.woningen.find(x => x.naam === 'Koningsspil 20'), deur = w.plekken.deurBuiten, sp = g.player.pos;
  const s = v.schrift, m = v.mark.groep.position, nav = window.__nav();
  return { tekst, max, uur: g.sfeer.uur, nacht: !!g.sfeer.nacht, missie: v.missie, fase: v.fase,
    thuis: Math.hypot(sp.x - deur.x, sp.z - deur.z), pand: s.pand,
    mark: v.mark.groep.visible, markBijDeur: Math.hypot(m.x - s.deur.x, m.z - s.deur.z),
    // buiten staat hij: niet in een binnenruimte ver buiten de kaart
    buiten: Math.abs(m.x) < 5000 && Math.abs(m.z) < 5000,
    nav, navD: nav ? Math.hypot(nav.x - s.deur.x, nav.z - s.deur.z) : -1, opdracht: document.getElementById('opdracht').textContent,
    pak: g.derde.pak, markPak: window.__inPak(v.mark) };
});
ok(later.max > 0.99 && /Een paar dagen later/.test(later.tekst), 'zwart: "Een paar dagen later"', later.tekst);
ok(Math.abs(later.uur - 14.5) < 0.01 && !later.nacht, 'en het is middag', `${later.uur} uur`);
ok(later.missie === 'schrift' && later.fase === 'wacht' && later.thuis < 4, 'je staat voor je eigen huis, missie 13 wacht', `${later.thuis.toFixed(1)} m van de deur`);
ok(later.pand && later.mark && later.markBijDeur < 0.5 && later.buiten, 'Mark staat voor de deur van Parelmoervlinder 3 in Duinterpen, niet binnen');
ok(later.nav && later.nav.letter === 'M' && later.navD < 1 && /Duinterpen/.test(later.opdracht), 'met een M op de kaart', later.opdracht);
ok(later.pak === 'gewoon' && !later.markPak, 'en de politiepakken zijn uit');

// ------------------------------------------------------ Mark opzoeken
kop('bij Mark: het schrift');
const brief = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, d = v.schrift.deur;
  window.__zet(d.x + 9, d.z);                 // nog te ver: niets
  window.__stap(4);
  const teVer = window.__balkDicht();
  window.__zet(d.x + 3, d.z + 1);
  window.__stap(3);
  const regels = window.__gesprek();
  window.__stap(3);
  const s = v.schrift, nav = window.__nav(), k = s.kade;
  const sloep = s.sloep;
  const agenten = v.schutters ? v.schutters.wachters : [];
  return { teVer, regels, fase: v.fase, nav, navD: nav ? Math.hypot(nav.x - k.x, nav.z - k.z) : -1,
    opdracht: document.getElementById('opdracht').textContent,
    lint: s.lint.filter(l => l.zichtbaar).length, merk: s.merk.zichtbaar,
    // in de sloep: aan het model van de sloep gehangen, op de bank
    boekOpSloep: s.boek.zichtbaar && sloep && (() => { let p = s.boek.groep.parent; while (p && p !== sloep.mesh) p = p.parent; return p === sloep.mesh; })(),
    sloepBijKade: sloep ? Math.hypot(sloep.x - k.x, sloep.z - k.z) : -1,
    agenten: agenten.length, inPak: agenten.every(w => window.__inPak(w.persoon)),
    agentAfstand: agenten.map(w => Math.hypot(w.persoon.groep.position.x - k.x, w.persoon.groep.position.z - k.z)) };
});
const briefTekst = brief.regels.map(r => r.tekst).join(' ');
ok(brief.teVer, 'op negen meter nog niets');
ok(brief.regels[0] && brief.regels[0].wie === 'Mark' && /Duinterpen/.test(briefTekst), 'dichterbij begint Mark vanzelf', `${brief.regels.length} regels`);
ok(/schrift/.test(briefTekst) && /Agenten/.test(briefTekst) && /En wij/.test(briefTekst) && /recherche/.test(briefTekst),
  'De Veteraan hield een schrift bij: agenten, en ook zij');
ok(/sloep in IJlst/.test(briefTekst) && /politie niet mee/.test(briefTekst), 'het ligt in zijn sloep in IJlst; neem de politie niet mee');
ok(brief.fase === 'naarIJlst' && brief.nav && brief.nav.letter === 'S' && brief.navD < 2, 'de kaart wijst naar de sloep in IJlst', brief.opdracht);
ok(brief.lint === 3 && brief.merk && brief.boekOpSloep && brief.sloepBijKade < 12, 'politielint op de kade, en het schrift ligt in de sloep',
  `sloep ${brief.sloepBijKade.toFixed(1)} m van de kade`);
ok(brief.agenten === 2 && brief.inPak && brief.agentAfstand.every(d => d < 16), 'twee agenten in uniform bij de kade',
  brief.agentAfstand.map(d => d.toFixed(0) + ' m').join(', '));

kop('op de kade');
const kade = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, s = v.schrift, sch = v.schutters;
  // ongezien: ze kijken even niet (de proef zet hun blik stil)
  for (const w of sch.wachters) w.kijkT = 999;
  const m = s.merk.groep.position;
  window.__zet(m.x + 3.5, m.z);
  window.__stap(2);
  const teVer = window.__hint();
  window.__zet(m.x + 0.5, m.z);
  window.__stap(2);
  const hint = window.__hint();
  g.praat();
  window.__stap(3);
  const nu = v.schrift, nav = window.__nav(), d = nu.deur;
  const uit = { teVer, hint, heeft: nu.heeft, boekWeg: !nu.boek.zichtbaar, fase: v.fase, ster: g.politie.ster,
    nav, navD: nav ? Math.hypot(nav.x - d.x, nav.z - d.z) : -1 };
  // en als ze je wel zien: twee sterren
  sch.alarm = true;
  window.__stap(3);
  uit.alarm = v.schrift.alarm; uit.sterNa = g.politie.ster;
  uit.regel = document.getElementById('dialoogTekst').textContent;
  return uit;
});
ok(kade.teVer === '' && /in de sloep zoeken/.test(kade.hint), 'bij de markering "E — in de sloep zoeken", ernaast niet', kade.hint);
ok(kade.heeft && kade.boekWeg && kade.ster === 0, 'E: je hebt het schrift, en ongezien geen sterren');
ok(kade.fase === 'terug' && kade.nav && kade.nav.letter === 'M' && kade.navD < 1, 'terug naar Mark in Duinterpen');
ok(kade.alarm && kade.sterNa === 2 && /gezien/.test(kade.regel), 'zien de agenten je: twee sterren', `${kade.sterNa} sterren`);

kop('opslaan en laden');
const laad = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  const s = v.bewaar();
  v.herstel(s);
  window.__stap(2);
  return { missie: v.missie, fase: v.fase, heeft: v.schrift.heeft, letter: window.__nav() ? window.__nav().letter : null };
});
ok(laad.missie === 'schrift' && laad.fase === 'terug' && laad.heeft && laad.letter === 'M', 'na het laden heb je het schrift nog', `${laad.fase}`);

kop('bij Mark, met en zonder politie');
const eind = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, d = v.schrift.deur;
  g.politie.zetSter(2, d.x, d.z);
  window.__zet(d.x + 3, d.z + 1);
  window.__stap(3);
  const metPolitie = { fase: v.fase, regel: document.getElementById('dialoogTekst').textContent, balk: !window.__balkDicht() };
  for (let i = 0; i < 80 && !window.__balkDicht(); i++) v.update(0.1);
  g.politie.reset();
  const geld = v.geld;
  window.__stap(3);
  const regels = window.__gesprek();
  window.__stap(3);
  return { metPolitie, regels, missie: v.missie, klaar: v.schrift.klaar, geld: v.geld - geld,
    melding: document.getElementById('missie').textContent, agenten: !!v.schutters };
});
const eindTekst = eind.regels.map(r => r.tekst).join(' ');
ok(eind.metPolitie.fase === 'terug' && eind.metPolitie.balk && /Niet met de politie/.test(eind.metPolitie.regel),
  'met de politie achter je: "Niet met de politie achter je aan!"');
ok(/Bladzijde zeventien/.test(eindTekst) && /agenten/.test(eindTekst) && /goud waard/.test(eindTekst) && /wijk stil/.test(eindTekst),
  'zonder: Mark bladert, ziet de agenten, en weet wat het waard is');
ok(eind.missie === 'klaar' && eind.klaar && eind.geld === 2500 && /GESLAAGD/.test(eind.melding) && /SCHRIFT/.test(eind.melding),
  'geslaagd: € 2.500', eind.melding.slice(0, 40));
ok(!eind.agenten, 'en de agenten op de kade zijn weg');

kop('los te starten');
const los = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, d = v.schrift.deur;
  window.__zet(d.x + 60, d.z);             // een eind bij Mark vandaan, anders begint hij meteen
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'BracketLeft', key: '{', shiftKey: true, bubbles: true }));
  window.__stap(2);
  return { missie: v.missie, fase: v.fase, letter: window.__nav() ? window.__nav().letter : null };
});
ok(los.missie === 'schrift' && los.fase === 'wacht' && los.letter === 'M', 'shift+[ begint missie 13', JSON.stringify(los));

console.log(`\n${fout ? fout + ' fout' : 'alles goed'}`);
await browser.close();
process.exit(fout ? 1 : 0);
