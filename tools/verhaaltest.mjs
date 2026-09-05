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
 5. Johan: de telefoon gaat, briefing op de oprit van Kruirad 62, de dief van De
    Wieken 27 opsporen, achtervolgen (niet neerschieten!), pakken en de duizend
    euro terugbrengen voor vijfhonderd euro beloning.

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
  zichtbaar: getComputedStyle(document.getElementById('dialoog')).display !== 'none',
}));
ok(naGesprek.fase === 'loopt', 'daarna gaat Mark lopen', naGesprek.fase);
ok(!naGesprek.zichtbaar, 'de tekstbalk is echt uit beeld');
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
const doorDePoort = await page.evaluate(async () => {
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
  const spoor = [];
  for (let i = 0; i < 120; i++) {
    g.vehicles.drive(truck, { KeyW: true }, 1 / 30);   // vier seconden gas
    spoor.push(truck.speed);
  }
  return { in1, voor, na: langs(), top: Math.max(...spoor) };
});
ok(doorDePoort.in1, 'je kunt in de vrachtwagen stappen');
// gemeten wordt de hoogste snelheid onderweg en niet die aan het eind: buiten de
// poort staat de auto waarmee je zelf naar de waterzuivering bent gereden, en
// sinds auto's elkaar raken (js/vehicles.js) loopt hij daar tegenaan
ok(doorDePoort.na < 0 && doorDePoort.top > 8,
  `hij rijdt door de poort naar buiten (${doorDePoort.voor.toFixed(1)} m binnen → ${(-doorDePoort.na).toFixed(1)} m buiten de poort, ${doorDePoort.top.toFixed(1)} m/s)`);

const afgeleverd = await page.evaluate(() => {
  const g = window.__game;
  const truck = g.verhaal.truck, schuur = g.verhaal.plekken.schuur;
  // de rit overslaan: de vrachtwagen bij de schuur zetten
  truck.x = schuur.x + 14; truck.z = schuur.z + 8; truck.speed = 0;
  truck.mesh.position.set(truck.x, 0, truck.z);
  g.player.pos.set(truck.x, 0, truck.z);
  window.__stap(20);
  return {
    missie: g.verhaal.missie, fase: g.verhaal.fase,
    melding: document.getElementById('missie').textContent,
    opdracht: document.getElementById('opdracht').textContent, leven: g.player.health,
    nav: g.hud.nav,
  };
});
ok(afgeleverd.fase === 'klaar', 'de missie is afgerond', `${afgeleverd.missie}/${afgeleverd.fase}`);
ok(/MISSION COMPLETED/.test(afgeleverd.melding), '"MISSION COMPLETED" staat in beeld', afgeleverd.melding.slice(0, 40));
ok(afgeleverd.opdracht === '' && !afgeleverd.nav, 'de opdracht en de route zijn van het scherm');
ok(afgeleverd.leven === 100, 'je leven is weer vol', String(afgeleverd.leven));

// ---------- 5. het telefoontje van Johan ----------
kop('missie 5: het telefoontje van Johan');
const telefoon = await page.evaluate(() => {
  const g = window.__game;
  window.__stap(220);      // vijf seconden pauze en dan de telefoon opnemen
  return {
    missie: g.verhaal.missie, fase: g.verhaal.fase,
    naam: document.getElementById('dialoogNaam').textContent,
    tekst: document.getElementById('dialoogTekst').textContent,
    telefoonstijl: document.getElementById('dialoog').classList.contains('telefoon'),
    kop: !document.getElementById('dialoogKop').hidden,
  };
});
ok(telefoon.missie === 'johan', `daarna begint missie 'johan'`, `${telefoon.missie}/${telefoon.fase}`);
ok(telefoon.naam === 'Johan' && /Yo, met Johan/.test(telefoon.tekst), 'Johan belt', telefoon.tekst.slice(0, 45));
ok(/Kruirad 62/.test(telefoon.tekst), 'hij zegt dat je naar Kruirad 62 moet komen');
ok(telefoon.telefoonstijl && telefoon.kop, 'de balk staat in telefoonstand met zijn kop erbij');

await page.keyboard.press('KeyE');
const naTelefoon = await page.evaluate(() => {
  const g = window.__game;
  window.__stap(10);
  return {
    fase: g.verhaal.fase, opdracht: document.getElementById('opdracht').textContent,
    melding: document.getElementById('missie').textContent,
    letter: g.hud.nav ? g.hud.nav.letter : null,
    doel: g.hud.nav ? g.hud.nav.doel : null,
    johan: g.verhaal.plekken.johan,
  };
});
ok(naTelefoon.fase === 'naar_kruirad', `fase 'naar_kruirad'`, naTelefoon.fase);
ok(/Kruirad 62/.test(naTelefoon.opdracht), 'de opdracht wijst naar Kruirad 62', naTelefoon.opdracht);
ok(/NIEUWE MISSIE/.test(naTelefoon.melding), 'er staat "Nieuwe missie" in beeld', naTelefoon.melding.slice(0, 40));
ok(naTelefoon.letter === 'J' && naTelefoon.doel
  && Math.hypot(naTelefoon.doel[0] - naTelefoon.johan.x, naTelefoon.doel[1] - naTelefoon.johan.z) < 1,
  'met een gele J op de kaart bij de oprit van Johan');

// ---------- 6. de briefing op de oprit ----------
kop('missie 5: de briefing bij Kruirad 62');
const briefing2 = await page.evaluate(async () => {
  const { KAART } = await import('./js/kaartwereld.js');
  const g = window.__game;
  const j = g.verhaal.plekken.johan;
  g.player.inCar = null;
  g.player.pos.set(j.x + 3, 0, j.z + 3);
  window.__stap(20);
  // staat Johan voor Kruirad 62?
  let dichtst = null;
  const p = g.verhaal.johan.groep.position;
  for (const q of KAART.panden) {
    if (!q.nr || !q.nr.length) continue;
    const d = Math.hypot(q.rect.cx - p.x, q.rect.cz - p.z);
    if (!dichtst || d < dichtst.d) dichtst = { d, nr: q.nr.join('/'), straat: q.straat };
  }
  // staat hij vrij op het pad, of tegen de gevel geplakt tussen de bergingen?
  const W = await import('./js/world.js');
  const N = await import('./js/navigatie.js');
  const pand = KAART.panden.find(q => q.straat === 'Kruirad' && (q.nr || []).includes('62'));
  const u = [Math.cos(pand.rect.hoek), Math.sin(pand.rect.hoek)];
  const f = pand.front, diep = Math.abs(f[0] * u[0] + f[1] * u[1]) > 0.7 ? pand.rect.hx : pand.rect.hz;
  const gevel = { x: pand.rect.cx + f[0] * diep, z: pand.rect.cz + f[1] * diep };
  const nav = new N.Navigatie(KAART.wegassen);
  const k = nav.naaste(p.x, p.z, 400, true);
  const weg = k >= 0 ? nav.punten[k] : null;
  return {
    fase: g.verhaal.fase, dichtst,
    voorGevel: (p.x - gevel.x) * f[0] + (p.z - gevel.z) * f[1],
    grond: W.ondergrondOp(p.x, p.z),
    zichtVanafStraat: weg ? W.zichtVrij(weg[0], weg[1], p.x, p.z, 1.4) : false,
    naam: document.getElementById('dialoogNaam').textContent,
    tekst: document.getElementById('dialoogTekst').textContent,
  };
});
ok(briefing2.dichtst && briefing2.dichtst.nr === '62' && briefing2.dichtst.straat === 'Kruirad',
  'Johan staat voor Kruirad 62', briefing2.dichtst ? `${briefing2.dichtst.straat} ${briefing2.dichtst.nr}` : '-');
ok(briefing2.voorGevel > 6 && briefing2.grond === 'tegel',
  'hij staat ruim vóór de gevel op het tegelpad, niet in het gebouw',
  `${briefing2.voorGevel.toFixed(1)} m voor de gevel, op ${briefing2.grond}`);
ok(briefing2.zichtVanafStraat, 'en je ziet hem vanaf de straat staan');
ok(briefing2.fase === 'briefing' && /in m'n eigen huis genaaid/.test(briefing2.tekst),
  'bij de marker begint de briefing', briefing2.tekst.slice(0, 40));

const regels = [];
for (let i = 0; i < 4; i++) {
  await page.keyboard.press('KeyE');
  regels.push(await page.evaluate(() => ({
    naam: document.getElementById('dialoogNaam').textContent,
    tekst: document.getElementById('dialoogTekst').textContent,
    fase: window.__game.verhaal.fase,
    opdracht: document.getElementById('opdracht').textContent,
    letter: window.__game.hud.nav ? window.__game.hud.nav.letter : null,
  })));
}
ok(regels[0].naam === 'Erik' && /Wie was het/.test(regels[0].tekst), 'Erik vraagt wie het was', regels[0].tekst);
ok(/De Wieken 27/.test(regels[1].tekst) && /felrood shirt/.test(regels[1].tekst),
  'Johan noemt De Wieken 27 en de kleren van de dief');
ok(/geen lood/i.test(regels[2].tekst) || /gé{0,1}én lood/.test(regels[2].tekst),
  'en dat je niet mag schieten', regels[2].tekst.slice(0, 40));
ok(regels[3].fase === 'naar_dewieken' && /De Wieken/.test(regels[3].opdracht),
  'daarna moet je naar De Wieken', `${regels[3].fase} · ${regels[3].opdracht}`);

// ---------- 7. de dief en de achtervolging ----------
kop('missie 5: de dief van De Wieken 27');
const ontmoeting = await page.evaluate(() => {
  const g = window.__game;
  const d = g.verhaal.dief;
  const p = d.positie;
  // op tien meter op de stoep gaan staan, in het zicht
  g.player.pos.set(p.x + 7, 0, p.z + 7);
  const staatVoor = d.staat;
  window.__stap(10);
  return {
    staatVoor, staat: d.staat, fase: g.verhaal.fase,
    naam: document.getElementById('dialoogNaam').textContent,
    tekst: document.getElementById('dialoogTekst').textContent,
  };
});
ok(ontmoeting.staatVoor === 'slentert', 'hij slentert over het trottoir', ontmoeting.staatVoor);
ok(ontmoeting.naam === 'Dief' && /Een maatje van Johan/.test(ontmoeting.tekst), 'hij schrikt van je', ontmoeting.tekst.slice(0, 40));

const rennen = await page.evaluate(() => {
  const g = window.__game;
  const d = g.verhaal.dief;
  window.__stap(80);                    // de regel klikt zichzelf weg
  const fase = g.verhaal.fase;
  const opdrachtRood = document.getElementById('opdracht').classList.contains('rood');
  const voor = { x: d.positie.x, z: d.positie.z };
  // de speler blijft staan: dan moet de dief er vandoor gaan
  for (let i = 0; i < 100; i++) g.verhaal.update(0.05);
  const na = { x: d.positie.x, z: d.positie.z };
  return {
    fase, opdrachtRood, staat: d.staat,
    gerend: Math.hypot(na.x - voor.x, na.z - voor.z),
    weg: Math.hypot(na.x - g.player.pos.x, na.z - g.player.pos.z),
    opdracht: document.getElementById('opdracht').textContent,
    marker: g.hud.nav ? g.hud.nav.letter : null,
  };
});
ok(rennen.fase === 'achtervolging', `fase 'achtervolging'`, rennen.fase);
ok(rennen.opdrachtRood && /NIET neer/.test(rennen.opdracht), 'de opdracht knippert rood', rennen.opdracht);
ok(rennen.staat === 'vlucht' && rennen.gerend > 15, `hij rent weg (${rennen.gerend.toFixed(0)} m in vijf seconden)`);
ok(rennen.marker === '!', 'hij staat als marker op de kaart', String(rennen.marker));

// het spannende deuntje loopt tijdens de achtervolging mee
const deuntje = await page.evaluate(async () => {
  const A = await import('./js/audio.js');
  const echt = A.geluid.jacht;
  let aan = 0, uit = 0;
  A.geluid.jacht = (v) => { v ? aan++ : uit++; echt.call(A.geluid, v); };
  window.__stap(10);
  A.geluid.jacht = echt;
  return { aan, uit, bestaat: typeof echt === 'function' };
});
ok(deuntje.bestaat, 'audio.js heeft een spannend deuntje voor de achtervolging');
ok(deuntje.aan === 10 && deuntje.uit === 0,
  'het loopt elk beeld van de achtervolging', `${deuntje.aan} keer aan, ${deuntje.uit} keer uit`);

// schieten mag niet: dat laat de missie mislukken
const misgeschoten = await page.evaluate(() => {
  const g = window.__game;
  // eerst een veilige opslag maken, zodat we terugkomen waar we waren
  g.player.pos.set(g.verhaal.dief.positie.x + 6, 0, g.verhaal.dief.positie.z + 6);
  g.opslaan();
  const opgeslagen = { x: g.player.pos.x, z: g.player.pos.z, fase: g.verhaal.fase };
  g.verhaal.raak(g.verhaal.dief.persoon.groep);          // een treffer op de dief
  const melding = document.getElementById('missie').textContent;
  const grijs = document.body.classList.contains('mislukt');
  window.__stap(100);                                    // aftellen en opnieuw beginnen
  return {
    opgeslagen, melding, grijs, grijsNa: document.body.classList.contains('mislukt'),
    missie: g.verhaal.missie, fase: g.verhaal.fase,
    x: g.player.pos.x, z: g.player.pos.z,
  };
});
ok(/MISSIE MISLUKT/.test(misgeschoten.melding) && /geen wouten/.test(misgeschoten.melding),
  'schiet je hem neer, dan mislukt de missie', misgeschoten.melding.slice(0, 60));
ok(misgeschoten.grijs && !misgeschoten.grijsNa, 'het beeld vaagt naar grijs en komt daarna terug');
ok(misgeschoten.missie === 'johan', 'daarna staat de missie weer aan', `${misgeschoten.missie}/${misgeschoten.fase}`);
ok(Math.hypot(misgeschoten.x - misgeschoten.opgeslagen.x, misgeschoten.z - misgeschoten.opgeslagen.z) < 0.5,
  'en begin je bij je laatste opgeslagen spel');

// na negentig seconden is hij op
const uitgeput = await page.evaluate(() => {
  const g = window.__game;
  const d = g.verhaal.dief;
  if (g.verhaal.fase !== 'achtervolging') {              // na het laden weer op de vlucht zetten
    d.schrik();
    for (let i = 0; i < 40; i++) g.verhaal.update(0.05);
  }
  d.vluchtT = 88;
  let tekst = '';
  for (let i = 0; i < 120 && d.staat === 'vlucht'; i++) {
    g.verhaal.update(0.05);
    if (/longen/.test(document.getElementById('dialoogTekst').textContent)) tekst = document.getElementById('dialoogTekst').textContent;
  }
  // nu hij op is: hoeveel meter haalt hij nog in vier seconden?
  const voor = { x: d.positie.x, z: d.positie.z };
  for (let i = 0; i < 80; i++) g.verhaal.update(0.05);
  const na = { x: d.positie.x, z: d.positie.z };
  return { staat: d.staat, tekst, afgelegd: Math.hypot(na.x - voor.x, na.z - voor.z) };
});
ok(uitgeput.staat === 'uitgeput', 'na negentig seconden is hij op', uitgeput.staat);
ok(/longen knallen uit elkaar/.test(uitgeput.tekst), 'en dat roept hij ook', uitgeput.tekst.slice(0, 40));
ok(uitgeput.afgelegd < 12, `hij wankelt nog maar ${uitgeput.afgelegd.toFixed(1)} m in vier seconden`);

// ---------- 8. pakken en afleveren ----------
kop('missie 5: pakken en afleveren');
const gepakt = await page.evaluate(() => {
  const g = window.__game;
  const d = g.verhaal.dief;
  g.player.pos.set(d.positie.x + 1.2, 0, d.positie.z + 0.6);   // tegen hem aan
  window.__stap(10);
  return {
    staat: d.staat, fase: g.verhaal.fase,
    naam: document.getElementById('dialoogNaam').textContent,
    tekst: document.getElementById('dialoogTekst').textContent,
  };
});
ok(gepakt.staat === 'gepakt' && gepakt.fase === 'gepakt', 'je hebt hem', `${gepakt.staat}/${gepakt.fase}`);
ok(/hier heb je die grafcenten/.test(gepakt.tekst), 'hij smijt het geld op de grond', gepakt.tekst.slice(0, 40));

await page.keyboard.press('KeyE');
const metBuit = await page.evaluate(() => {
  const g = window.__game;
  window.__stap(60);        // de envelop landt en zit in je zak
  return {
    fase: g.verhaal.fase, buit: g.verhaal.buit, geld: g.verhaal.geld,
    opdracht: document.getElementById('opdracht').textContent,
    geldEl: document.getElementById('geld').textContent,
    letter: g.hud.nav ? g.hud.nav.letter : null,
  };
});
ok(metBuit.fase === 'terug' && metBuit.buit === 1000, 'je hebt duizend euro buit', `${metBuit.buit}`);
ok(/terug naar Johan/.test(metBuit.opdracht), 'en moet het terugbrengen naar Johan', metBuit.opdracht);
ok(/1\.000/.test(metBuit.geldEl), 'de buit staat rechtsonder in beeld', metBuit.geldEl);
ok(metBuit.letter === 'J', 'de J-marker staat weer bij Kruirad 62');

const afronding = await page.evaluate(() => {
  const g = window.__game;
  const j = g.verhaal.plekken.johan;
  g.player.pos.set(j.x + 3, 0, j.z + 3);
  window.__stap(15);
  return { fase: g.verhaal.fase, tekst: document.getElementById('dialoogTekst').textContent, naam: document.getElementById('dialoogNaam').textContent };
});
ok(afronding.fase === 'afronding' && afronding.naam === 'Erik' && /Duizend piek/.test(afronding.tekst),
  'bij Johan geef je het geld terug', afronding.tekst.slice(0, 40));

const beloning = [];
for (let i = 0; i < 3; i++) {
  await page.keyboard.press('KeyE');
  beloning.push(await page.evaluate(() => ({
    tekst: document.getElementById('dialoogTekst').textContent,
    missie: window.__game.verhaal.missie, geld: window.__game.verhaal.geld,
    buit: window.__game.verhaal.buit,
    melding: document.getElementById('missie').textContent,
    geldEl: document.getElementById('geld').textContent,
  })));
}
ok(/lekker werk/.test(beloning[0].tekst), 'Johan is blij', beloning[0].tekst.slice(0, 40));
ok(/vijfhonderd voor jou/.test(beloning[1].tekst), 'en geeft je vijfhonderd euro', beloning[1].tekst.slice(0, 40));
const eind = beloning[2];
// je begint met € 50 op zak (js/verhaal.js), dus na de beloning staat er € 550
ok(eind.missie === 'klaar' && eind.geld === 550 && eind.buit === 0,
  'de missie is voltooid en het geld staat in je portemonnee', `${eind.missie}, € ${eind.geld}`);
ok(/MISSIE VOLTOOID/.test(eind.melding) && /500/.test(eind.melding), '"MISSIE VOLTOOID" met de beloning', eind.melding.slice(0, 50));
ok(/550/.test(eind.geldEl), 'de portemonnee staat in beeld', eind.geldEl);

// ---------- 9. achter de voordeur van Molenkrite 15 ----------
kop('binnen bij Molenkrite 15');
const stil = await page.evaluate(async () => {
  // de missie is klaar: het deuntje van de achtervolging hoort uit te staan
  const A = await import('./js/audio.js');
  const echt = A.geluid.jacht;
  let aan = 0, uit = 0;
  A.geluid.jacht = (v) => { v ? aan++ : uit++; echt.call(A.geluid, v); };
  window.__stap(5);
  A.geluid.jacht = echt;
  return { aan, uit };
});
ok(stil.aan === 0 && stil.uit === 5, 'buiten de achtervolging staat het deuntje uit', `${stil.uit} keer uit`);

const huis = await page.evaluate(async () => {
  const g = window.__game, I = g.interieur, p = I.plekken, m = I.maten;
  const { KAART } = await import('./js/kaartwereld.js');
  const pand = KAART.panden.find(q => q.straat === 'Molenkrite' && (q.nr || []).includes('15'));
  // buiten voor de deur gaan staan en op E drukken
  g.player.inCar = null;
  g.player.pos.set(p.stoep.x, 0, p.stoep.z);
  const buitenOp = { x: g.player.pos.x, z: g.player.pos.z };
  const heen = g.praat();
  const binnenOp = { x: g.player.pos.x, z: g.player.pos.z };
  const straatBinnen = I.kaart(binnenOp.x, binnenOp.z);
  // door de wanden heen lopen lukt niet
  const W = await import('./js/world.js');
  // vier stappen vanaf de deurmat: door de voordeur, door de zijmuur, door de
  // gangwand en door de trapdeur — die horen alle vier tegen te houden
  const vast = [];
  for (const [dx, dz] of [[0, -1.02], [-0.88, 0], [0.61, 0], [0, 3.21]]) {
    const [kx, kz] = W.resolveCollisions(binnenOp.x + dx, binnenOp.z + dz, 0.35);
    vast.push(Math.hypot(kx - (binnenOp.x + dx), kz - (binnenOp.z + dz)) > 0.01);
  }
  // en weer naar buiten
  const terug = g.praat();
  const weerBuiten = { x: g.player.pos.x, z: g.player.pos.z };
  // niets mag door het plafond of buiten de plattegrond steken
  const THREE = await import('three');
  const doos = new THREE.Box3().setFromObject(I.groep);
  return {
    maten: m, banden: m.banden.length, heen, terug,
    binnen: I.binnen(binnenOp.x, binnenOp.z), buiten: !I.binnen(weerBuiten.x, weerBuiten.z),
    straatBinnen: straatBinnen ? straatBinnen.naam : null,
    weerBij: Math.hypot(weerBuiten.x - buitenOp.x, weerBuiten.z - buitenOp.z),
    voorDeGevel: Math.hypot(weerBuiten.x - p.deurBuiten.x, weerBuiten.z - p.deurBuiten.z),
    vast,
    bovenkant: doos.max.y, onderkant: doos.min.y,
    pandBreed: pand.rect.hz * 2, pandDiep: pand.rect.hx * 2, goot: pand.goot,
  };
});
const M = huis.maten;
ok(Math.abs(M.breed - huis.pandBreed) < 0.15 && Math.abs(M.diep - huis.pandDiep) < 0.15,
  'de kamer heeft de maten van het pand uit de kaartdata',
  `${M.breed.toFixed(2)} × ${M.diep.toFixed(2)} m (pand ${huis.pandBreed.toFixed(2)} × ${huis.pandDiep.toFixed(2)})`);
ok(huis.banden === 2, 'met het voorhuis en de aanbouw als aparte banden', `${huis.banden} banden`);
ok(M.hoogte > 2.4 && M.hoogte < huis.goot, `plafond op ${M.hoogte.toFixed(2)} m onder een goot van ${huis.goot} m`);
ok(huis.binnen, 'met E bij de voordeur sta je binnen');
ok(huis.straatBinnen === 'Molenkrite 15', 'en zegt de HUD Molenkrite 15', String(huis.straatBinnen));
ok(huis.vast.every(v => v), 'de wanden houden je binnen', `${huis.vast.filter(v => v).length} van 4 richtingen dicht`);
ok(huis.buiten && huis.voorDeGevel < 3, 'met E bij de deur sta je weer voor het huis',
  `${huis.voorDeGevel.toFixed(1)} m van de deur`);
ok(huis.weerBij < 1.5, 'op de plek waar je naar binnen ging', `${huis.weerBij.toFixed(2)} m ernaast`);
ok(huis.bovenkant <= M.hoogte + 0.02 && huis.onderkant > -0.02,
  'niets steekt door het plafond of de vloer',
  `van ${huis.onderkant.toFixed(2)} tot ${huis.bovenkant.toFixed(2)} m`);
// de maten waar de opdracht om vroeg: juiste hoogtes en breedtes
ok(Math.abs(M.voordeur.hoog - 2.15) < 0.01 && Math.abs(M.voordeur.breed - 0.95) < 0.05,
  'de voordeur is 0,95 bij 2,15 m', `${M.voordeur.breed.toFixed(2)} × ${M.voordeur.hoog.toFixed(2)}`);
ok(M.aanrecht === 0.90 && M.bovenkast[0] === 1.45 && M.bovenkast[1] === 2.15,
  'het aanrecht ligt op 90 cm, de bovenkasten van 1,45 tot 2,15 m');
ok(M.bank.breed === 2.10 && M.bank.diep === 0.90 && Math.abs(M.bank.zitting - 0.44) < 0.02,
  'de bank is 2,10 bij 0,90 m met een zitting op 44 cm');
ok(Math.abs(M.tv.breed - 1.20) < 0.05 && Math.abs(M.tv.midden - 0.86) < 0.05,
  'de tv is een 55-inch met het beeld op ooghoogte vanaf de bank',
  `${M.tv.breed.toFixed(2)} × ${M.tv.hoog.toFixed(2)} m, midden op ${M.tv.midden.toFixed(2)}`);
ok(M.gang >= 1.1 && M.gang <= 1.4 && M.keuken.breed > 1.7 && M.keuken.diep > 4,
  'de gang is 1,30 m breed en de keuken is een rijtje in de aanbouw',
  `gang ${M.gang} m, keuken ${M.keuken.breed.toFixed(2)} × ${M.keuken.diep.toFixed(2)} m`);

// ---------- 10. opslaan en laden midden in het verhaal ----------
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
    geldInOpslag: bewaard && bewaard.verhaal ? bewaard.verhaal.geld : null,
    naLaden: g.verhaal.missie, leven: g.player.health,
    ammo: g.player.ammo, bewakingNeer: g.verhaal.bewaking.neer, poortOpen: g.verhaal.poortOpen,
    geld: g.verhaal.geld, diefStaat: g.verhaal.dief.staat,
  };
});
ok(opslag.inOpslag === 'klaar' && opslag.geldInOpslag === 550, 'de stand van het verhaal en het geld zitten in de opslag',
  `${opslag.inOpslag}, € ${opslag.geldInOpslag}`);
ok(opslag.naLaden === 'klaar' && opslag.bewakingNeer === 5 && opslag.poortOpen && opslag.diefStaat === 'gepakt',
  'na laden staat alles er weer: missie, bewaking, poort en de dief');
ok(opslag.geld === 550, 'en je geld ook', `€ ${opslag.geld}`);
ok(opslag.leven === 100 && opslag.ammo !== 2, 'leven en munitie komen terug', `${opslag.leven} leven`);

await browser.close();
console.log(fouten === 0 ? '\nAlles goed.' : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
