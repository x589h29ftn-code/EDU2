/*
 Beleving: vijf punten van 22 september 2026.

   node tools/server.mjs 8123 &   node tools/belevingtest.mjs [poort]

 1. De buurt schrikt van wat je doet. Een autoknal deed dat al; de bom in de
    Poiesz en het vuurgevecht erna niet.
 2. Herstelpunten binnen een missie: ga je neer in de laatste etappe, dan begin
    je daar opnieuw en niet bij het eerste gesprek.
 3. Op De Veteraan schieten is het einde van missie 8.
 4. Voorrang op straat: auto's remmen voor wie oversteekt, en wie oversteekt
    kijkt eerst of er iets aankomt.
 5. Ruimte in het geluid: galm binnen, gedempt verkeer binnen, water dat klotst
    langs de kade, en de molen die kraakt als je eronder staat.
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
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) g.verhaal.update(dt); };
  window.__klik = (n = 20) => {
    for (let i = 0; i < n; i++) {
      if (!document.getElementById('dialoogTekst').textContent) break;
      g.praat(); window.__stap(2);
    }
  };
});

// ------------------------------------------------ de buurt schrikt van de bom
kop('de buurt schrikt van de bom');
const knal = await page.evaluate(async () => {
  const g = window.__game;
  g.verhaal.__startMissie('bom');
  window.__stap(4);
  // door de missie heen tot vlak voor de knal
  const woning = g.woningen[1], plek = woning.plekken;
  g.player.inCar = null;
  g.player.pos.set(plek.deurBinnen.x, 0, plek.deurBinnen.z);
  window.__stap(6); window.__klik();
  const ing = g.supermarkt.ingangen.find(i => /duinterpen/i.test(i.naam));
  g.player.pos.set(ing.stoep.x, 0, ing.stoep.z);
  window.__stap(6); window.__klik(); window.__stap(4);
  const bom = g.verhaal.bomPlek;
  g.player.pos.set(bom.x + 1, 0, bom.z + 1);
  window.__stap(3); g.praat(); window.__stap(4);
  // naar buiten, naast Mark, en een paar mensen vlak bij de winkel neerzetten
  const mp = g.verhaal.mark.groep.position;
  g.player.pos.set(mp.x + 3, 0, mp.z + 3);
  window.__stap(6); window.__klik();
  const dichtbij = g.npcs.people.filter(p => p.alive)
    .sort((a, b) => Math.hypot(a.x - ing.deur.x, a.z - ing.deur.z) - Math.hypot(b.x - ing.deur.x, b.z - ing.deur.z))
    .slice(0, 6);
  for (const p of dichtbij) { p.x = ing.deur.x + (Math.random() - 0.5) * 30; p.z = ing.deur.z + (Math.random() - 0.5) * 30; p.paniek = 0; }
  const voor = dichtbij.filter(p => p.paniek > 0).length;
  for (let i = 0; i < 300 && !g.verhaal.knalBezig; i++) g.verhaal.update(0.05);
  window.__stap(4);
  const na = dichtbij.filter(p => p.paniek > 0).length;
  return { voor, na, van: dichtbij.length, bezig: g.verhaal.knalBezig };
});
ok(knal.bezig, 'de bom gaat af');
ok(knal.voor === 0, 'vooraf rent er niemand', `${knal.voor} van de ${knal.van}`);
ok(knal.na >= knal.van - 1, 'daarna rent de hele buurt weg',
  `${knal.na} van de ${knal.van} in paniek`);

// ------------------------------------------------------- herstelpunten
kop('herstelpunten binnen een missie');
const punt = await page.evaluate(() => {
  const g = window.__game;
  // door naar de laatste etappe van missie 7 en dan neergaan
  window.__klik(); window.__stap(10);
  for (let i = 0; i < 400 && g.verhaal.fase !== 'vuurgevecht'; i++) {
    g.verhaal.update(0.05);
    if (!document.getElementById('dialoog').hidden) g.praat();
  }
  const s = g.verhaal.schutters;
  for (const w of [...(s ? s.wachters : [])]) g.verhaal.raak(w.persoon.groep);
  window.__stap(10); window.__klik(); window.__stap(10);
  const voorDood = g.verhaal.fase;              // 'vluchten' of verder
  // neergaan: zonder opgeslagen spel hervat het verhaal zelf
  g.verhaal.dood();
  for (let i = 0; i < 90; i++) g.verhaal.update(0.05);
  return { voorDood, na: g.verhaal.fase, missie: g.verhaal.missie,
    opdracht: document.getElementById('opdracht').textContent };
});
ok(['vluchten', 'thuisbrengen'].includes(punt.voorDood), 'je haalt de laatste etappe',
  punt.voorDood);
ok(punt.missie === 'bom' && punt.na === punt.voorDood,
  'en na het neergaan sta je in diezelfde etappe, niet bij het begin',
  `${punt.missie}/${punt.na}`);
ok(/bos|Molenkrite/i.test(punt.opdracht), 'met de opdracht van die etappe', punt.opdracht);

// ------------------------------------------------- niet op De Veteraan schieten
kop('op De Veteraan schieten mag niet');
const vet = await page.evaluate(async () => {
  const g = window.__game;
  g.player.krijgWapen('sniper');
  g.verhaal.__startMissie('sniper');
  window.__stap(50); window.__klik();
  // naar Johan en door naar de cirkel
  const j = g.verhaal.johanPersoon.groep.position;
  g.player.pos.set(j.x + 1.5, 0, j.z + 1.5);
  window.__stap(6); window.__klik(); window.__stap(4);
  const plek = g.verhaal.snipPlek;
  const sloep = g.boten.ruw(0);
  g.boten.stapIn(sloep);
  g.boten.verplaats(sloep, plek.boot.x, plek.boot.z, 0);
  window.__stap(8); window.__klik();
  const d = g.verhaal.deal;
  const voor = { missie: g.verhaal.missie, fase: g.verhaal.fase, deal: !!d };
  // en dan op De Veteraan schieten
  const raak = g.verhaal.raak(d.veteraan.groep);
  window.__stap(6);
  const melding = document.getElementById('missie').textContent;
  return { voor, raak, melding, missie: g.verhaal.missie, fase: g.verhaal.fase };
});
ok(vet.voor.deal, 'de ontmoeting staat op de kade', `${vet.voor.missie}/${vet.voor.fase}`);
ok(vet.raak, 'een kogel op De Veteraan telt');
ok(/MISLUKT/i.test(vet.melding) && /Veteraan/i.test(vet.melding),
  'en dan is de missie mislukt', (vet.melding || '').slice(0, 60));

// ----------------------------------------------------- voorrang op straat
kop('voorrang op straat');
const weg = await page.evaluate(() => {
  const g = window.__game;
  // een rijdende auto zoeken en er een overstekende voetganger voor zetten
  const t = g.vehicles.traffic.find(a => a._pos && a._dir && a.snelheid > 2);
  if (!t) return null;
  const voor = t.snelheid;
  const p = g.npcs.people.find(q => q.alive);
  const afstand = 13;
  p.x = t._pos.x + t._dir.x * afstand;
  p.z = t._pos.y + t._dir.y * afstand;
  p.opWeg = true; p.steek = 1;
  for (let i = 0; i < 20; i++) g.vehicles.updateTraffic(0.05, g.player, g.npcs.people, g.player.pos.x, g.player.pos.z);
  const na = t.snelheid;
  // en de vraag die de voetgangers stellen voor ze de stoep af stappen
  const komtIets = g.vehicles.autoDichtbij(t._pos.x + t._dir.x * 8, t._pos.y + t._dir.y * 8, 16);
  const komtNiets = g.vehicles.autoDichtbij(t._pos.x - t._dir.x * 60, t._pos.y - t._dir.y * 60, 16);
  return { voor, na, komtIets, komtNiets, haakje: typeof g.npcs.magOversteken === 'function' };
});
ok(!!weg, 'er rijdt verkeer om mee te meten');
if (weg) {
  ok(weg.na < weg.voor * 0.6, 'een auto remt voor wie oversteekt',
    `${weg.voor.toFixed(1)} → ${weg.na.toFixed(1)} m/s`);
  ok(weg.haakje, 'de voetgangers kijken of er iets aankomt');
  ok(weg.komtIets, 'vlak voor een rijdende auto is het antwoord: wachten');
  ok(!weg.komtNiets, 'en ver achter hem: oversteken mag');
}

// --------------------------------------------------------- ruimte in het geluid
kop('ruimte in het geluid');
const klank = await page.evaluate(async () => {
  const { geluid } = await import('/js/audio.js');
  const g = window.__game;
  const meet = async (opties) => {
    for (let i = 0; i < 12; i++) { geluid.omgeving(0.05, opties); await new Promise(r => setTimeout(r, 60)); }
    return geluid.ruimteStand();
  };
  const buiten = await meet({ weer: 'helder', nacht: false, binnen: false, water: 0, molen: 0 });
  const binnen = await meet({ weer: 'helder', nacht: false, binnen: true, water: 0, molen: 0 });
  const bijWater = await meet({ weer: 'helder', nacht: false, binnen: false, water: 1, molen: 0 });
  const droog = await meet({ weer: 'helder', nacht: false, binnen: false, water: 0, molen: 0 });
  return { buiten, binnen, bijWater, droog };
});
ok(klank.binnen.galm > klank.buiten.galm * 2, 'binnen galmt het, buiten nauwelijks',
  `${klank.binnen.galm} tegen ${klank.buiten.galm}`);
ok(klank.binnen.verkeer < klank.buiten.verkeer, 'en het verkeer van buiten klinkt gedempt',
  `${klank.binnen.verkeer} Hz tegen ${klank.buiten.verkeer} Hz`);
ok(klank.bijWater.water > 0.01, 'aan het water hoor je het klotsen',
  `${klank.bijWater.water}`);
ok(klank.droog.water < klank.bijWater.water * 0.5, 'en midden in de wijk niet',
  `${klank.droog.water}`);

console.log(`\n${fout ? fout + ' fout' : 'alles goed'}`);
await browser.close();
process.exit(fout ? 1 : 0);
