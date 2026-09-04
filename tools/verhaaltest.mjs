/*
 Loopt het hele verhaal na: de vier missies, de levensbalk, doodgaan, en
 opslaan en laden.

 1. Molenkrite 15: Mark staat voor het huis, zwaait, het gesprek loopt onderin
    het scherm en klikt door met E, hij loopt naar de bierdrinkers en roept de
    opdracht; na vier treffers volgt de briefing over de waterzuivering.
 2. Rijden: er staat een auto, de kaart wijst de route naar de waterzuivering,
    en bij het terrein stap je automatisch uit.
 3. Bewaking: vijf bewakers, ze vallen je binnen het hek aan (levensbalk loopt
    leeg), na vijf treffers gaat de poort open en mag je de vrachtwagen pakken.
 4. Afleveren: met de vrachtwagen naar de boerderij, dan MISSION COMPLETED.

 Gebruik: python3 -m http.server 8123 &  node tools/verhaaltest.mjs 8123
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
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
await page.evaluate(() => {
  localStorage.removeItem('tinga.spel.v1');       // begin als een eerste keer
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  window.__game.player.active = true;
  // handige hulpjes voor de test
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) window.__game.verhaal.update(dt); };
});
await page.waitForTimeout(600);

// ---------- 1. Molenkrite 15 ----------
kop('missie 1: Molenkrite 15');
const start = await page.evaluate(async () => {
  const { verhaalStart } = await import('./js/verhaal.js');
  const { KAART } = await import('./js/kaartwereld.js');
  const g = window.__game;
  const s = verhaalStart();
  const b = g.verhaal.mark.groep.position;
  let dichtst = null;
  for (const p of KAART.panden) {
    if (!p.nr || !p.nr.length) continue;
    const d = Math.hypot(p.rect.cx - b.x, p.rect.cz - b.z);
    if (!dichtst || d < dichtst.d) dichtst = { d, nr: p.nr.join('/'), straat: p.straat, kapel: !!p.kapel };
  }
  const plek = g.verhaal.plekken;
  return {
    speler: { x: g.player.pos.x, z: g.player.pos.z }, start: s,
    afstand: Math.hypot(b.x - g.player.pos.x, b.z - g.player.pos.z),
    dichtst, missie: g.verhaal.missie, fase: g.verhaal.fase,
    tegenover: plek.huis.fx * plek.overkant.fx + plek.huis.fz * plek.overkant.fz,
    bendeAfstand: Math.hypot(plek.tafel.x - b.x, plek.tafel.z - b.z),
    leven: document.getElementById('levenlabel').textContent,
  };
});
ok(start.start != null && Math.hypot(start.speler.x - start.start.x, start.speler.z - start.start.z) < 0.1,
  'de speler begint op het punt uit de kaartdata',
  start.start ? `speler ${start.speler.x.toFixed(2)},${start.speler.z.toFixed(2)} · punt ${start.start.x.toFixed(2)},${start.start.z.toFixed(2)}` : 'geen startpunt');
ok(start.dichtst && start.dichtst.nr === '15' && start.dichtst.straat === 'Molenkrite',
  'Mark staat voor Molenkrite 15', start.dichtst ? `${start.dichtst.straat} ${start.dichtst.nr}` : '-');
ok(start.dichtst && start.dichtst.kapel, 'dat huis heeft een dakkapel');
ok(start.afstand > 2 && start.afstand < 6, `hij staat ${start.afstand.toFixed(1)} m voor de speler`);
ok(start.tegenover < -0.9, 'de bierdrinkers zitten aan de overkant', `voorkanten dot ${start.tegenover.toFixed(2)}`);
ok(start.bendeAfstand > 15 && start.bendeAfstand < 45, `het gezelschap zit ${start.bendeAfstand.toFixed(0)} m schuin tegenover`);
ok(start.missie === 'molenkrite' && start.fase === 'wacht', `missie 'molenkrite', fase 'wacht'`, `${start.missie}/${start.fase}`);
ok(start.leven === '100', 'de levensbalk staat op 100', start.leven);

const zwaai = await page.evaluate(() => {
  const g = window.__game;
  let maxArm = 0;
  for (let i = 0; i < 40; i++) { g.verhaal.update(0.05); maxArm = Math.max(maxArm, g.verhaal.mark.armR.rotation.z); }
  const b = g.verhaal.mark;
  const doel = Math.atan2(-(g.player.pos.x - b.groep.position.x), -(g.player.pos.z - b.groep.position.z));
  return { maxArm, hoek: Math.abs(((b.yaw - doel + Math.PI * 3) % (Math.PI * 2)) - Math.PI), hint: !document.getElementById('praat').hidden };
});
ok(zwaai.maxArm > 1.5, `hij zwaait met zijn arm (${zwaai.maxArm.toFixed(2)} rad)`);
ok(zwaai.hoek < 0.15, 'hij kijkt naar de speler');
ok(zwaai.hint, 'de hint "E — praten" staat op het scherm');

await page.keyboard.press('KeyE');
const regel1 = await page.evaluate(() => ({
  naam: document.getElementById('dialoogNaam').textContent,
  tekst: document.getElementById('dialoogTekst').textContent,
  fase: window.__game.verhaal.fase,
}));
ok(regel1.naam === 'MARK' || regel1.naam === 'Mark', 'de spreker is Mark', regel1.naam);
ok(regel1.tekst.startsWith('Erik, kom met mij mee'), 'de eerste regel klopt', regel1.tekst.slice(0, 40));

await page.keyboard.press('KeyE');
const naGesprek = await page.evaluate(() => ({
  fase: window.__game.verhaal.fase, opdracht: document.getElementById('opdracht').textContent,
}));
ok(naGesprek.fase === 'loopt', 'daarna gaat Mark lopen', naGesprek.fase);
ok(/Mark/.test(naGesprek.opdracht), 'de opdracht staat in beeld', naGesprek.opdracht);

const wandeling = await page.evaluate(() => {
  const g = window.__game;
  const tafel = g.verhaal.plekken.tafel;
  let n = 0;
  for (let i = 0; i < 2000 && g.verhaal.fase === 'loopt'; i++) {
    g.verhaal.update(0.05);
    const p = g.verhaal.mark.groep.position;
    g.player.pos.set(p.x + 2.2, 0, p.z + 2.2);
    n++;
  }
  window.__stap(80);
  const p = g.verhaal.mark.groep.position;
  return { seconden: n * 0.05, bij: Math.hypot(p.x - tafel.x, p.z - tafel.z), tekst: document.getElementById('dialoogTekst').textContent };
});
ok(wandeling.bij < 4, `hij komt bij het gezelschap (${wandeling.bij.toFixed(1)} m van het tafeltje)`);
ok(wandeling.tekst === 'Schiet ze neer!', 'hij roept de opdracht', wandeling.tekst);

await page.keyboard.press('KeyE');
const schieten = await page.evaluate(async () => {
  const THREE = await import('three');
  const g = window.__game;
  const voor = g.verhaal.doelen().length;
  // eerst één echt schot met het pistool
  const doel = g.verhaal.doelen()[0];
  const p = doel.getWorldPosition(new THREE.Vector3()); p.y += 1.05;
  g.player.pos.set(p.x + 3, 0, p.z + 3);
  const dx = p.x - g.player.pos.x, dz = p.z - g.player.pos.z;
  g.player.yaw = Math.atan2(-dx, -dz);
  g.player.pitch = Math.atan2(p.y - 1.7, Math.hypot(dx, dz));
  g.player.applyCamera();
  g.player.ammo = 12; g.player.reloading = 0;
  g.player.shoot();
  window.__stap(30);
  const naSchot = g.verhaal.doelen().length;
  // de rest erbij
  for (const o of [...g.verhaal.doelen()]) g.verhaal.raak(o);
  window.__stap(40);
  return { voor, naSchot, over: g.verhaal.doelen().length, fase: g.verhaal.fase, tekst: document.getElementById('dialoogTekst').textContent };
});
ok(schieten.voor === 4, 'vier bierdrinkers zijn doelen', String(schieten.voor));
ok(schieten.naSchot === 3, 'een schot met het pistool legt er een om', `${schieten.voor} → ${schieten.naSchot}`);
ok(schieten.fase === 'briefing', 'daarna volgt de briefing', schieten.fase);
ok(/Super, dat probleem is opgelost/.test(schieten.tekst), 'Mark begint met "Super, dat probleem is opgelost"', schieten.tekst.slice(0, 40));

// ---------- 2. rijden naar de waterzuivering ----------
kop('missie 2: naar de waterzuivering');
const briefing = [];
for (let i = 0; i < 3; i++) {
  await page.keyboard.press('KeyE');
  briefing.push(await page.evaluate(() => ({
    tekst: document.getElementById('dialoogTekst').textContent,
    open: !document.getElementById('dialoog').hidden,
    missie: window.__game.verhaal.missie,
  })));
}
ok(/De Veteraan/.test(briefing[0].tekst), 'hij noemt De Veteraan en de lading coke', briefing[0].tekst.slice(0, 50));
ok(/auto/.test(briefing[1].tekst), 'en dat er een auto in de straat staat', briefing[1].tekst);
ok(briefing[2].missie === 'rijden', `daarna begint missie 'rijden'`, briefing[2].missie);

const rijklaar = await page.evaluate(() => {
  const g = window.__game;
  window.__stap(200);          // Mark loopt naar de auto
  const auto = g.verhaal.auto;
  const nav = g.hud.nav;
  const poort = g.verhaal.plekken.poort;
  return {
    auto: auto ? { x: auto.x, z: auto.z, driveable: auto.driveable } : null,
    opdracht: document.getElementById('opdracht').textContent,
    route: nav && nav.route ? nav.route.length : 0,
    eind: nav && nav.route ? nav.route[nav.route.length - 1] : null,
    poort,
    markBijAuto: auto ? Math.hypot(g.verhaal.mark.groep.position.x - auto.x, g.verhaal.mark.groep.position.z - auto.z) : -1,
  };
});
ok(rijklaar.auto && rijklaar.auto.driveable, 'er staat een auto in de straat waar je in kunt');
ok(rijklaar.markBijAuto < 6, `Mark loopt naar de auto (${rijklaar.markBijAuto.toFixed(1)} m)`);
ok(/waterzuivering/.test(rijklaar.opdracht), 'de opdracht wijst naar de waterzuivering', rijklaar.opdracht);
ok(rijklaar.route > 5, `de kaart navigeert met een route van ${rijklaar.route} punten`);
ok(rijklaar.eind && rijklaar.poort && Math.hypot(rijklaar.eind[0] - rijklaar.poort.x, rijklaar.eind[1] - rijklaar.poort.z) < 3,
  'die route eindigt bij de poort van het terrein');

// in de auto stappen en er (met de auto) naartoe rijden
const aankomst = await page.evaluate(() => {
  const g = window.__game;
  const auto = g.verhaal.auto;
  g.player.pos.set(auto.x + 1.2, 0, auto.z + 1.2);
  g.praat();                                   // E: instappen
  const inAuto = g.player.inCar === auto;
  // de rit zelf overslaan: de auto vlak voor de poort zetten
  const poort = g.verhaal.plekken.poort;
  const nav = g.hud.nav;
  const punt = nav.route[Math.max(0, nav.route.length - 4)];
  auto.x = punt[0]; auto.z = punt[1]; auto.speed = 4;
  window.__stap(40);
  return {
    inAuto, missie: g.verhaal.missie, fase: g.verhaal.fase,
    uitgestapt: g.player.inCar === null,
    tekst: document.getElementById('dialoogTekst').textContent,
    bijPoort: Math.hypot(g.player.pos.x - poort.x, g.player.pos.z - poort.z),
    markZichtbaar: g.verhaal.mark.groep.visible,
  };
});
ok(aankomst.inAuto, 'met E stap je in de auto');
ok(aankomst.uitgestapt, 'bij de waterzuivering stap je automatisch uit');
ok(aankomst.bijPoort < 30, `je staat bij de poort (${aankomst.bijPoort.toFixed(0)} m)`);
ok(aankomst.markZichtbaar, 'Mark staat naast je');
ok(/Shit, bewaking/.test(aankomst.tekst), 'Mark: "Shit, bewaking…"', aankomst.tekst);

// ---------- 3. de bewaking ----------
kop('missie 3: de bewaking');
await page.keyboard.press('KeyE');
const bewaking = await page.evaluate(() => {
  const g = window.__game;
  window.__stap(20);
  const b = g.verhaal.bewaking;
  return {
    missie: g.verhaal.missie, aantal: b ? b.aantal : 0, neer: b ? b.neer : -1,
    truck: g.verhaal.truck ? { driveable: g.verhaal.truck.driveable, soort: g.verhaal.truck.soort } : null,
    opdracht: document.getElementById('opdracht').textContent,
    poortOpen: g.verhaal.poortOpen,
    nav: g.hud.nav ? g.hud.nav.naam : null,
  };
});
ok(bewaking.missie === 'bewaking', `missie 'bewaking'`, bewaking.missie);
ok(bewaking.aantal === 5 && bewaking.neer === 0, 'er lopen vijf bewakers', `${bewaking.aantal}, waarvan ${bewaking.neer} neer`);
ok(bewaking.truck && bewaking.truck.soort === 'truck' && !bewaking.truck.driveable,
  'de vrachtwagen staat er, maar je kunt er nog niet in');
ok(/bewaking uit \(5 te gaan\)/.test(bewaking.opdracht), 'de opdracht telt de bewakers', bewaking.opdracht);
ok(!bewaking.poortOpen, 'de poort is nog niet open');

// binnen het hek gaan ze je te lijf
const gevecht = await page.evaluate(() => {
  const g = window.__game;
  const b = g.verhaal.bewaking;
  const w = b.wachters[0].persoon.groep.position;
  g.player.pos.set(w.x + 6, 0, w.z + 6);      // vlak naast bewaker 1, binnen het hek
  g.player.health = 100;
  let alarm = false;
  for (let i = 0; i < 400 && g.player.health > 40; i++) { g.verhaal.update(0.05); alarm = alarm || b.alarm; }
  return { alarm, leven: g.player.health, balk: document.getElementById('levenbalk').style.width };
});
ok(gevecht.alarm, 'ze zien je en het alarm gaat af');
ok(gevecht.leven < 100, `je levensbalk loopt leeg (${gevecht.leven} over, balk ${gevecht.balk})`);

// doodgaan met een opgeslagen spel: je begint daar weer
const doodMetOpslag = await page.evaluate(() => {
  const g = window.__game;
  const w = g.verhaal.bewaking.wachters[0].persoon.groep.position;
  // eerst een veilige plek opslaan, buiten het bereik van de bewaking
  g.player.pos.set(w.x + 120, 0, w.z + 120);
  g.player.health = 100;
  g.opslaan();
  const opgeslagen = { x: g.player.pos.x, z: g.player.pos.z };
  // dan naast een bewaker gaan staan met bijna geen leven meer
  g.player.pos.set(w.x + 5, 0, w.z + 5);
  g.player.health = 4;
  for (let i = 0; i < 400 && g.player.health > 0; i++) g.verhaal.update(0.05);
  const gevallen = g.player.health <= 0;
  for (let i = 0; i < 80; i++) g.verhaal.update(0.05);      // het aftellen
  return { opgeslagen, na: { x: g.player.pos.x, z: g.player.pos.z }, gevallen, leven: g.player.health };
});
ok(doodMetOpslag.gevallen, 'de bewaking schiet je neer');
ok(Math.hypot(doodMetOpslag.na.x - doodMetOpslag.opgeslagen.x, doodMetOpslag.na.z - doodMetOpslag.opgeslagen.z) < 0.5,
  'daarna begin je bij je laatste opgeslagen spel',
  `${doodMetOpslag.na.x.toFixed(0)},${doodMetOpslag.na.z.toFixed(0)} tegen ${doodMetOpslag.opgeslagen.x.toFixed(0)},${doodMetOpslag.opgeslagen.z.toFixed(0)}`);

// doodgaan zonder opgeslagen spel: dan begint de missie opnieuw
const dood = await page.evaluate(() => {
  const g = window.__game;
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('missie').textContent = '';
  const w = g.verhaal.bewaking.wachters[0].persoon.groep.position;
  g.player.pos.set(w.x + 5, 0, w.z + 5);      // weer naast een bewaker
  g.player.health = 3;
  let melding = '';
  for (let i = 0; i < 400 && g.player.health > 0; i++) g.verhaal.update(0.05);
  melding = document.getElementById('missie').textContent;
  for (let i = 0; i < 80; i++) g.verhaal.update(0.05);    // de 2,6 seconden aftellen
  return {
    melding, leven: g.player.health, missie: g.verhaal.missie,
    neer: g.verhaal.bewaking.neer, alarm: g.verhaal.bewaking.alarm,
  };
});
ok(/NEERGEGAAN/.test(dood.melding), 'je gaat neer en dat staat in beeld', dood.melding.slice(0, 40));
ok(dood.leven === 100, 'daarna is je leven weer vol', String(dood.leven));
ok(dood.missie === 'bewaking' && !dood.alarm, 'de missie begint opnieuw, de bewaking staat weer op patrouille');

// alle vijf uitschakelen
const opgeruimd = await page.evaluate(() => {
  const g = window.__game;
  g.player.health = 100;
  for (const o of [...g.verhaal.bewaking.doelen()]) g.verhaal.raak(o);
  window.__stap(40);
  return {
    neer: g.verhaal.bewaking.neer, fase: g.verhaal.fase,
    tekst: document.getElementById('dialoogTekst').textContent,
    doelen: g.verhaal.bewaking.doelen().length,
  };
});
ok(opgeruimd.neer === 5 && opgeruimd.doelen === 0, 'alle vijf bewakers liggen neer', `${opgeruimd.neer} neer`);
ok(/Alle vijf neer/.test(opgeruimd.tekst), 'Mark meldt dat het terrein leeg is', opgeruimd.tekst.slice(0, 40));

// ---------- 4. afleveren bij de boerderij ----------
kop('missie 4: afleveren bij de boerderij');
await page.keyboard.press('KeyE');
const poortOpen = await page.evaluate(async () => {
  const w = await import('./js/world.js');
  const g = window.__game;
  window.__stap(20);
  const truck = g.verhaal.truck;
  const poort = g.verhaal.plekken.poort;
  // is het gat in de poort breed genoeg voor de vrachtwagen? meet dwars
  const kw = await import('./js/kaartwereld.js');
  const blad = kw.poortBladen[0];
  let vrij = 0;
  for (let t = -0.5; t <= 1.5; t += 0.05) {
    const x = blad.midden[0] + blad.richting[0] * (t * blad.lengte - blad.lengte / 2);
    const z = blad.midden[1] + blad.richting[1] * (t * blad.lengte - blad.lengte / 2);
    const [rx, rz] = w.resolveCollisions(x, z, 1.3);
    if (Math.hypot(rx - x, rz - z) < 0.02) vrij += 0.05 * blad.lengte;
  }
  return {
    missie: g.verhaal.missie, poortOpen: g.verhaal.poortOpen,
    truckRijdbaar: truck.driveable, opdracht: document.getElementById('opdracht').textContent,
    nav: g.hud.nav ? g.hud.nav.naam : null,
    routePunten: g.hud.nav && g.hud.nav.route ? g.hud.nav.route.length : 0,
    doorgang: vrij, poort,
  };
});
ok(poortOpen.missie === 'afleveren', `missie 'afleveren'`, poortOpen.missie);
ok(poortOpen.poortOpen, 'de schuifpoort is open');
ok(poortOpen.truckRijdbaar, 'de vrachtwagen is nu te besturen');
ok(poortOpen.doorgang > 3, `er is ${poortOpen.doorgang.toFixed(1)} m vrije doorgang voor de vrachtwagen`);
ok(/boerderij/.test(poortOpen.opdracht), 'de opdracht wijst naar de boerderij', poortOpen.opdracht);
ok(poortOpen.nav === 'boerderij' && poortOpen.routePunten > 10, `de kaart navigeert naar de boerderij (${poortOpen.routePunten} punten)`);

// echt met de vrachtwagen door de poort rijden
const doorDePoort = await page.evaluate(() => {
  const g = window.__game;
  const truck = g.verhaal.truck;
  const poort = g.verhaal.plekken.poort;
  g.player.pos.set(truck.x + 2, 0, truck.z + 2);
  g.praat();                                    // instappen
  const in1 = g.player.inCar === truck;
  // afstand langs de poortrichting: positief = op het terrein, negatief = buiten
  const v = g.verhaal.plekken.poortVooruit;
  const langs = () => (truck.x - poort.x) * v[0] + (truck.z - poort.z) * v[1];
  const voor = langs();
  for (let i = 0; i < 120; i++) g.vehicles.drive(truck, { KeyW: true }, 1 / 30);   // vier seconden gas
  return { in1, voor, na: langs(), snelheid: truck.speed };
});
ok(doorDePoort.in1, 'je kunt in de vrachtwagen stappen');
ok(doorDePoort.na < 0 && doorDePoort.snelheid > 2,
  `hij rijdt door de poort naar buiten (${doorDePoort.voor.toFixed(1)} m binnen → ${(-doorDePoort.na).toFixed(1)} m buiten de poort)`);

const afgeleverd = await page.evaluate(() => {
  const g = window.__game;
  const truck = g.verhaal.truck, schuur = g.verhaal.plekken.schuur;
  // de rit overslaan: de vrachtwagen bij de schuur zetten
  truck.x = schuur.x + 14; truck.z = schuur.z + 8; truck.speed = 0;
  truck.mesh.position.set(truck.x, 0, truck.z);
  g.player.pos.set(truck.x, 0, truck.z);
  window.__stap(20);
  return {
    missie: g.verhaal.missie, melding: document.getElementById('missie').textContent,
    opdracht: document.getElementById('opdracht').textContent, leven: g.player.health,
    nav: g.hud.nav,
  };
});
ok(afgeleverd.missie === 'klaar', 'de missie is afgerond', afgeleverd.missie);
ok(/MISSION COMPLETED/.test(afgeleverd.melding), '"MISSION COMPLETED" staat in beeld', afgeleverd.melding.slice(0, 40));
ok(afgeleverd.opdracht === '' && !afgeleverd.nav, 'de opdracht en de route zijn van het scherm');
ok(afgeleverd.leven === 100, 'je leven is weer vol', String(afgeleverd.leven));

// ---------- 5. opslaan en laden midden in het verhaal ----------
kop('opslaan en laden');
const opslag = await page.evaluate(() => {
  const g = window.__game;
  g.opslaan();
  const bewaard = JSON.parse(localStorage.getItem('tinga.spel.v1'));
  // alles door de war schoppen en terugladen
  g.player.pos.set(0, 0, 0); g.player.health = 20; g.player.ammo = 2;
  g.laden();
  return {
    inOpslag: bewaard && bewaard.verhaal ? bewaard.verhaal.missie : null,
    naLaden: g.verhaal.missie, leven: g.player.health,
    ammo: g.player.ammo, bewakingNeer: g.verhaal.bewaking.neer, poortOpen: g.verhaal.poortOpen,
  };
});
ok(opslag.inOpslag === 'klaar', 'de stand van het verhaal zit in de opslag', String(opslag.inOpslag));
ok(opslag.naLaden === 'klaar' && opslag.bewakingNeer === 5 && opslag.poortOpen,
  'na laden staat alles er weer: missie, bewaking en poort');
ok(opslag.leven === 100 && opslag.ammo !== 2, 'leven en munitie komen terug', `${opslag.leven} leven`);

await browser.close();
console.log(fouten === 0 ? '\nAlles goed.' : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
