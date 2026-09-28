/*
 Toetst de klusjes (js/klusjes.js, stap 99): optionele opdrachten tussen de missies door.

 1. De plekken: altijd binnen de rand van de wereld, niet in het water, niet op een
    viaduct, niet bij wat het verhaal heeft staan.
 2. Het aanbod: tussen twee missies staat er na een paar tellen iemand met een K op de
    kaart; tijdens een missie die loopt niet.
 3. De tas: aannemen, onderweg de politie of een groepje, afgeven, betaald.
 4. Een missie die onder zijn M wacht: de klus mag, het verhaal staat stil (de M doet
    niets), en na de klus staan de M en de opdracht weer in beeld.
 5. De pauze tot de volgende missie telt niet af tijdens een klus.
 6. De auto: ophalen, wegbrengen, niet neerzetten met politie achter je aan (langs de
    stoeprand: de vakken uit de kaart staan allemaal vol).
 7. Overspuiten: stelen (een ster), op rekening bij de BP, neerzetten.
 8. Omleggen: het doelwit neer, drie sterren, afschudden, betaald.
 9. Afbreken met X, mislukken (de auto total loss), en een opgeslagen spel laden:
    geen geld, geen klus meer.
 10. De beloning ligt altijd tussen 250 en 1000.

 Gebruik: npm run server &   node tools/klusjestest.mjs 8123
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
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
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  const W = await import('/js/world.js');
  const { KAART } = await import('/js/kaart.js');
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, v = g.verhaal;
  g.player.active = false;
  window.__autoplay = false;
  g.sfeer.uur = 14;
  window.__W = W; window.__KAART = KAART;
  window.__meld = [];
  const echt = g.hud.melding.bind(g.hud);
  g.hud.melding = (k, o, t) => { window.__meld.push(`${k}|${o}`); return echt(k, o, t); };
  window.__stap = (n = 20, dt = 0.05) => {
    for (let i = 0; i < n; i++) { g.player.health = 100; v.update(dt); }
  };
  window.__klik = (max = 40) => {
    for (let i = 0; i < max && !document.getElementById('dialoog').hidden; i++) { v.toets(); window.__stap(1); }
  };
  window.__zet = (x, z) => { g.player.inCar = null; g.player.pos.set(x, 0, z); g.player.applyCamera(); };
  // de stand na missie 8: tussen twee missies in, zonder volgende missie in de pauze
  window.__klaar = () => {
    const s = v.bewaar(); s.missie = 'klaar'; s.fase = 'klaar'; s.volgende = null;
    v.herstel(s); v.__geenVolgende(); g.politie.reset();
    const st = KAART.start; window.__zet(st.x, st.z);
  };
  // een klus van een bepaalde soort aannemen: aanbod maken, erheen, E, gesprek door
  window.__neemAan = (soort) => {
    const kl = v.klusjes;
    kl.__soort(soort);
    if (!kl.__nieuwAanbod()) return null;
    const a = kl.aanbod;
    window.__zet(a.x + 1.2, a.z);
    window.__stap(2);
    v.toets();
    window.__klik();
    return kl.klus;
  };
  window.__klaar();
});

// ------------------------------------------------------------------ 1. de plekken
kop('de plekken');
const plekken = await page.evaluate(() => {
  const g = window.__game, kl = g.verhaal.klusjes, W = window.__W, G = window.__KAART.gebied;
  const R = 350;
  let n = 0, buiten = 0, water = 0, hoog = 0, vakN = 0, vakBuiten = 0, vakBezet = 0;
  for (let i = 0; i < 3000 && n < 300; i++) {
    const p = kl.__plek();
    if (!p) continue;
    n++;
    if (!(p.x > G.x0 + R && p.x < G.x1 - R && p.z > G.z0 + R && p.z < G.z1 - R)) buiten++;
    if (W.pointInWater(p.x, p.z)) water++;
    if (W.grondHoogte(p.x, p.z, Infinity) > 0.5) hoog++;
  }
  for (let i = 0; i < 3000 && vakN < 100; i++) {
    const p = kl.__vak();
    if (!p) continue;
    vakN++;
    if (!(p.x > G.x0 + R && p.x < G.x1 - R && p.z > G.z0 + R && p.z < G.z1 - R)) vakBuiten++;
    if (g.vehicles.cars.some(c => Math.hypot(c.x - p.x, c.z - p.z) < 2.5)) vakBezet++;
  }
  return { n, buiten, water, hoog, vakN, vakBuiten, vakBezet };
});
ok(plekken.n >= 300, 'er zijn genoeg stoepplekken', `${plekken.n}`);
ok(plekken.buiten === 0, 'geen enkele plek op de rand van de wereld (350 m ervan af)', `${plekken.buiten} te dicht bij de rand`);
ok(plekken.water === 0 && plekken.hoog === 0, 'niet in het water en niet op een viaduct', `${plekken.water} in het water, ${plekken.hoog} hoog`);
ok(plekken.vakN >= 100 && plekken.vakBuiten === 0 && plekken.vakBezet === 0, 'lege plekken langs de stoeprand voor een auto, ook binnen de rand',
  `${plekken.vakN} plekken, ${plekken.vakBuiten} te dicht bij de rand, ${plekken.vakBezet} bezet`);

// ------------------------------------------------------------------ 2. het aanbod
kop('het aanbod');
const aanbod = await page.evaluate(() => {
  const g = window.__game, kl = g.verhaal.klusjes;
  window.__stap(Math.ceil(16 / 0.05));
  const a = kl.aanbod;
  const sp = g.player.pos;
  const thuis = window.__KAART.start;
  return a ? { ...a, d: Math.hypot(a.x - sp.x, a.z - sp.z), dThuis: Math.hypot(a.x - thuis.x, a.z - thuis.z), hud: g.hud.klus } : null;
});
ok(!!aanbod, 'tussen twee missies staat er na een paar tellen iemand met een klus', aanbod ? `${aanbod.wie} aan ${aanbod.straat}, een ${aanbod.soort}` : 'geen aanbod');
if (aanbod) {
  ok(aanbod.d >= 220 && aanbod.d <= 850, 'een stukje van je af', `${Math.round(aanbod.d)} m`);
  ok(aanbod.dThuis >= 160, 'niet bij Molenkrite 15', `${Math.round(aanbod.dThuis)} m`);
  ok(!!aanbod.hud && Math.abs(aanbod.hud.x - aanbod.x) < 0.01, 'met een K op de kaart');
}
const tijdensMissie = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, kl = v.klusjes;
  v.startMissie('sniper');                 // begint met een telefoontje: dan loopt de missie
  window.__stap(Math.ceil(16 / 0.05));
  const uit = { missie: v.missie, fase: v.fase, aanbod: !!kl.aanbod, hud: !!g.hud.klus };
  window.__klaar();
  return uit;
});
ok(!tijdensMissie.aanbod && !tijdensMissie.hud, 'tijdens een missie die loopt geen klus', `${tijdensMissie.missie}/${tijdensMissie.fase}`);

// ------------------------------------------------------------------ 3. de tas, en 5. de pauze
kop('de tas, en de pauze tot de volgende missie');
const tas = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, kl = v.klusjes;
  // de volgende missie komt over zes tellen
  const s = v.bewaar(); s.missie = 'klaar'; s.fase = 'klaar'; s.volgende = 'huis';
  v.herstel(s);
  const k = window.__neemAan('tas');
  if (!k) return null;
  const uit = { loon: k.loon, voorval: k.voorval, d0: k.d0, nav: g.hud.nav && g.hud.nav.letter, geld0: v.geld, bezig: kl.bezig };
  window.__stap(Math.ceil(20 / 0.05));
  uit.naTwintig = { missie: v.missie, volgende: v.volgendeMissie };
  // bij de ontvanger
  window.__zet(k.doel.x + 1.5, k.doel.z);
  window.__stap(4);
  window.__klik();
  uit.sterren = g.politie.ster;
  uit.bende = kl.bende;
  if (g.politie.ster > 0) {
    v.toets(); window.__klik();                  // "niet met die blauwe achter je aan"
    uit.nietMetPolitie = kl.bezig && v.geld === uit.geld0;
    g.politie.reset();
    window.__stap(2);
  }
  window.__meld = [];
  v.toets(); window.__klik();                    // de tas afgeven
  window.__stap(2); window.__klik();             // en het telefoontje
  uit.geld1 = v.geld; uit.bezigNa = kl.bezig; uit.meld = window.__meld.slice();
  window.__stap(Math.ceil(8 / 0.05));
  uit.daarna = v.missie;
  return uit;
});
ok(!!tas, 'de tas aangenomen');
if (tas) {
  ok(tas.bezig && tas.nav === 'K', 'de klus loopt, met een K als doel', `navigatie ${tas.nav}`);
  ok(tas.naTwintig.missie === 'klaar' && tas.naTwintig.volgende && tas.naTwintig.volgende.over > 5,
    'tijdens de klus telt de pauze tot de volgende missie niet af', `na 20 s: ${tas.naTwintig.missie}, nog ${tas.naTwintig.volgende ? tas.naTwintig.volgende.over.toFixed(1) : '-'} s`);
  ok(tas.d0 >= 650 && tas.d0 <= 1300, 'een stukje rijden', `${Math.round(tas.d0)} m hemelsbreed`);
  if (tas.voorval === 'politie') ok(tas.sterren >= 1 && tas.nietMetPolitie, 'onderweg de politie: niet afgeven met een ster', `${tas.sterren} ster(ren)`);
  if (tas.voorval === 'bende') ok(tas.bende, 'onderweg een groepje bij de overdracht');
  ok(tas.geld1 - tas.geld0 === tas.loon && !tas.bezigNa, 'afgegeven en betaald', `+ € ${tas.geld1 - tas.geld0} (${tas.voorval || 'zonder voorval'})`);
  ok(tas.meld.some(m => m.startsWith('KLUS GESLAAGD')), 'KLUS GESLAAGD in beeld');
  ok(tas.daarna === 'huis', 'daarna begint de volgende missie gewoon', tas.daarna);
}

// ------------------------------------------------------------------ 4. een missie die onder zijn M wacht, en 6. de auto
kop('een missie die wacht, en de auto');
const wacht = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, kl = v.klusjes;
  window.__klaar();
  v.startMissie('bx');                            // Mark wacht bij Tinga State onder de M
  window.__stap(2);
  const opdracht0 = document.getElementById('opdracht').textContent;
  const uit = { fase0: v.fase, nav0: g.hud.nav && g.hud.nav.letter };
  const k = window.__neemAan('auto');
  if (!k) return null;
  uit.wie = k.wie; uit.loon = k.loon; uit.voorval = k.voorval;
  uit.nav1 = g.hud.nav && g.hud.nav.letter;
  uit.autoBij = Math.hypot(k.auto.x - k.van.x, k.auto.z - k.van.z);
  // naar Mark lopen en E drukken: de missie doet niets
  const m = v.mark.groep.position;
  window.__zet(m.x + 1, m.z);
  window.__stap(10);
  v.toets(); window.__stap(2);
  uit.faseBijMark = v.fase;
  uit.balkBijMark = !document.getElementById('dialoog').hidden;
  window.__klik();
  // de auto in, naar het vak
  const auto = k.auto;
  g.player.inCar = auto;
  window.__stap(2);
  uit.faseRit = k.fase;
  auto.x = k.doel.x; auto.z = k.doel.z; auto.speed = 0;
  if (auto.mesh) auto.mesh.position.set(auto.x, auto.mesh.position.y, auto.z);
  window.__stap(3); window.__klik();
  uit.sterren = g.politie.ster;
  window.__zet(k.doel.x + 3.5, k.doel.z);
  window.__stap(3); window.__klik();
  uit.metSterrenNiet = g.politie.ster > 0 ? kl.bezig : null;
  g.politie.reset();
  window.__stap(3); window.__klik();
  window.__stap(2); window.__klik();
  uit.bezigNa = kl.bezig;
  uit.nav2 = g.hud.nav && g.hud.nav.letter;
  uit.opdracht0 = opdracht0;
  uit.opdracht2 = document.getElementById('opdracht').textContent;
  uit.fase2 = v.fase;
  return uit;
});
ok(!!wacht, 'een klus aangenomen terwijl missie 6 onder zijn M wacht');
if (wacht) {
  ok(wacht.wie === 'johan', 'Mark staat al bij Tinga State: de klus komt van Johan', wacht.wie);
  ok(wacht.nav0 === 'M' && wacht.nav1 === 'K', 'de M maakt plaats voor de K', `${wacht.nav0} → ${wacht.nav1}`);
  ok(wacht.faseBijMark === 'wacht' && !wacht.balkBijMark, 'E bij Mark doet niets zolang de klus loopt', `fase ${wacht.faseBijMark}`);
  ok(wacht.autoBij <= 70, 'de auto staat vlak bij hem', `${Math.round(wacht.autoBij)} m`);
  ok(wacht.faseRit === 'rijden', 'ingestapt: naar het vak');
  if (wacht.voorval === 'gestolen') ok(wacht.sterren >= 2 && wacht.metSterrenNiet, 'als gestolen opgegeven: niet neerzetten met politie achter je aan', `${wacht.sterren} sterren`);
  ok(!wacht.bezigNa, 'neergezet en uitgestapt: klaar', `€ ${wacht.loon}`);
  ok(wacht.nav2 === 'M' && wacht.opdracht2 === wacht.opdracht0 && wacht.fase2 === 'wacht',
    'daarna staan de M en de opdracht van missie 6 weer in beeld', `${wacht.nav2} · "${wacht.opdracht2}"`);
}

// ------------------------------------------------------------------ 7. overspuiten
kop('overspuiten');
const spuit = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, kl = v.klusjes;
  window.__klaar();
  const k = window.__neemAan('spuiten');
  if (!k) return null;
  const uit = { loon: k.loon, geld0: v.geld };
  const auto = k.auto;
  g.player.inCar = auto;
  window.__stap(2);
  uit.sterren = g.politie.ster;
  uit.nav = g.hud.nav && g.hud.nav.letter;
  uit.prijs = v.spuitPrijs(auto);
  uit.prijsSpuiterij = g.spuiterij ? g.spuiterij.prijsVoor(1, auto) : null;
  g.vehicles.verf(auto, g.vehicles.andereKleur(auto.kleur));
  g.politie.vergeet();
  window.__stap(2);
  uit.fase = k.fase; uit.nav2 = g.hud.nav && g.hud.nav.letter;
  auto.x = k.doel.x; auto.z = k.doel.z; auto.speed = 0;
  if (auto.mesh) auto.mesh.position.set(auto.x, auto.mesh.position.y, auto.z);
  window.__zet(k.doel.x + 3.5, k.doel.z);
  window.__stap(3); window.__klik(); window.__stap(2); window.__klik();
  uit.geld1 = v.geld; uit.bezigNa = kl.bezig;
  return uit;
});
ok(!!spuit, 'de overspuitklus aangenomen');
if (spuit) {
  ok(spuit.sterren >= 1, 'de auto stelen geeft een ster', `${spuit.sterren}`);
  ok(spuit.nav === 'S', 'en dan naar de BP', `navigatie ${spuit.nav}`);
  ok(spuit.prijs === 0 && spuit.prijsSpuiterij === 0, 'overspuiten gaat op rekening', `verhaal ${spuit.prijs}, spuiterij ${spuit.prijsSpuiterij}`);
  ok(spuit.fase === 'rijden' && spuit.nav2 === 'K', 'na het overspuiten naar het vak', `${spuit.fase}, ${spuit.nav2}`);
  ok(spuit.geld1 - spuit.geld0 === spuit.loon && !spuit.bezigNa, 'neergezet en betaald', `+ € ${spuit.geld1 - spuit.geld0}`);
}

// ------------------------------------------------------------------ 8. omleggen
kop('omleggen');
const leg = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, kl = v.klusjes;
  window.__klaar();
  const k = window.__neemAan('omleggen');
  if (!k) return null;
  const uit = { loon: k.loon, lijfwacht: k.lijfwacht, geld0: v.geld, mannen: k.bewaking.aantal };
  const doel = k.bewaking.wachters[0].persoon.groep;
  uit.inDoelen = v.doelen().includes(doel);
  const p = doel.position;
  window.__zet(p.x + 8, p.z);
  window.__stap(2);
  uit.raak = v.raak(doel);
  window.__stap(2);
  uit.sterren = g.politie.ster;
  uit.gedood = !!k.gedood;
  window.__stap(Math.ceil(5 / 0.05));
  uit.nogBezig = kl.bezig;
  g.politie.reset();
  window.__stap(Math.ceil(3 / 0.05));
  window.__klik(); window.__stap(2);
  uit.geld1 = v.geld; uit.bezigNa = kl.bezig;
  return uit;
});
ok(!!leg, 'de omlegklus aangenomen');
if (leg) {
  ok(leg.mannen === (leg.lijfwacht ? 2 : 1), leg.lijfwacht ? 'met een lijfwacht' : 'alleen', `${leg.mannen} man`);
  ok(leg.inDoelen && leg.raak && leg.gedood, 'het doelwit is te raken en gaat neer');
  ok(leg.sterren >= 3, 'daarna drie sterren', `${leg.sterren}`);
  ok(leg.nogBezig, 'met sterren is de klus nog niet klaar');
  ok(leg.geld1 - leg.geld0 === leg.loon && !leg.bezigNa, 'afgeschud en betaald', `+ € ${leg.geld1 - leg.geld0}`);
  ok(leg.loon === (leg.lijfwacht ? 1000 : 750), 'met lijfwacht betaalt het meer', `€ ${leg.loon}`);
}

// ------------------------------------------------------------------ 9. afbreken, mislukken, laden
kop('afbreken, mislukken en laden');
const eind = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, kl = v.klusjes;
  const uit = {};
  window.__klaar();
  let geld0 = v.geld;
  window.__neemAan('tas');
  window.__meld = [];
  uit.afgebroken = v.klusAfbreken();
  window.__stap(2);
  uit.naAfbreken = { bezig: kl.bezig, geld: v.geld - geld0, meld: window.__meld.slice() };
  window.__klaar();
  geld0 = v.geld;
  const k = window.__neemAan('auto');
  g.vehicles.laatOntploffen(k.auto);
  window.__meld = [];
  window.__stap(3);
  uit.naKnal = { bezig: kl.bezig, geld: v.geld - geld0, meld: window.__meld.slice() };
  window.__klaar();
  window.__neemAan('tas');
  const bezigVoor = kl.bezig;
  v.herstel(v.bewaar());
  uit.naLaden = { voor: bezigVoor, bezig: kl.bezig, hud: !!g.hud.klus };
  return uit;
});
ok(eind.afgebroken && !eind.naAfbreken.bezig && eind.naAfbreken.geld === 0 && eind.naAfbreken.meld.some(m => m.startsWith('KLUS AFGEBROKEN')),
  'X breekt een klus af, zonder geld');
ok(!eind.naKnal.bezig && eind.naKnal.geld === 0 && eind.naKnal.meld.some(m => m.startsWith('KLUS MISLUKT')),
  'de auto total loss: klus mislukt, zonder geld');
ok(eind.naLaden.voor && !eind.naLaden.bezig && !eind.naLaden.hud, 'een opgeslagen spel laden: geen klus meer');

// ------------------------------------------------------------------ 10. de beloning
kop('de beloning');
const lonen = await page.evaluate(() => {
  const v = window.__game.verhaal;
  const uit = { tas: [], auto: [], spuiten: [], omleggen: [] };
  for (const s of Object.keys(uit)) {
    for (let i = 0; i < 4; i++) {
      window.__klaar();
      const k = window.__neemAan(s);
      if (k) uit[s].push(k.loon);
      v.klusAfbreken();
    }
  }
  return uit;
});
const alle = Object.values(lonen).flat();
ok(alle.length >= 14, 'genoeg klussen aangenomen om te meten', `${alle.length}`);
ok(alle.every(l => l >= 250 && l <= 1000 && l % 50 === 0), 'elke beloning ligt tussen € 250 en € 1.000, op vijftig afgerond',
  Object.entries(lonen).map(([s, l]) => `${s} ${l.join('/')}`).join(' · '));
const gem = (l) => l.reduce((a, b) => a + b, 0) / Math.max(1, l.length);
ok(gem(lonen.tas) < gem(lonen.auto) && gem(lonen.auto) < gem(lonen.spuiten) && gem(lonen.spuiten) < gem(lonen.omleggen),
  'zwaarder betaalt beter: tas < auto < spuiten < omleggen',
  `${Math.round(gem(lonen.tas))} < ${Math.round(gem(lonen.auto))} < ${Math.round(gem(lonen.spuiten))} < ${Math.round(gem(lonen.omleggen))}`);

console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
await browser.close();
process.exit(fouten ? 1 : 0);
