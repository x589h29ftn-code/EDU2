/*
 Proef bij stap 204 (npm run yugotest): sushi eten bij Yugo met Johan.

 Gevraagd (16 okt 2026): "Tussen missies of na alle missies kan je Johan opzoeken zoals nu al kan. [...] de eerste keer stelt
 hij voor om bij Yugo te eten in Sneek. [...] Als je ja kiest ga je daarheen (zwart beeld, en dan ben je in het restaurant aan
 tafel met Johan). Je bestelt sushi via een tablet die op tafel staat: laat 4 soorten sushi qua keuze zien. En laat als drinken
 de Pornstar Martini zien. De ober brengt de sushi en drankjes en jullie kunnen dit eten. Met stokjes. Johan bestelt wat te veel
 zoals altijd. In totaal 5 rondes, duurt ca 15 minuten. Je kan altijd weggaan met X [...]. Japans muziekje."

  1. De zaal: buiten het kaartgebied en niet over een andere binnenruimte; vier soorten sushi en de Pornstar Martini.
  2. Johan: de eerste keer het voorstel met de keuze, 2 = een andere keer; daarna gewone praatjes, en na een praatje over Yugo
     weer de vraag. Met sterren gaat het niet door.
  3. Ja: het zwart, en dan aan tafel: op de stoel, Johan tegenover je op de bank, het verlichte logo achter hem in beeld, de klok
     stil op 19:00, niet opslaan, geen autoradio, het muziekje speelt.
  4. De tablet: zichtbaar (gemeten met getComputedStyle), vier gerechten, de cocktail en bestellen; met de echte toetsen 1–6 en 0;
     hoogstens vier plankjes; bestellen.
  5. De ober: loopt van de keukendeur naar de tafel en terug, nooit door het hek of een tafel; zet alles op het tafelblad; Johan
     heeft meer plankjes dan jij, en elk een Pornstar Martini.
  6. Eten met de stokjes (E): de punten bij het stuk, het stuk naar je mond, op, leven erbij; de stokjes in beeld. Drinken (Q):
     het glas wordt leger, na vier slokken leeg. Johan eet zelf.
  7. Een hele ronde met de echte tijden (een automaat die eet en bestelt), en daaruit vijf rondes: tussen 12 en 18 minuten.
  8. Vijf rondes (met korte tijden), het einde: "Later die avond…", terug bij Johan op de oprit, de klok loopt weer.
  9. X: Erik zegt dat hij morgen vroeg op moet en die kant op gaat, en je staat weer buiten.
 10. Opslaan en laden: het voorstel onthouden, laden aan tafel ruimt op.
 11. Geen nieuw shaderprogramma aan tafel.

 Gebruik: npm run server &  node tools/yugotest.mjs [poort]
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fout = 0;
const ok = (goed, wat, extra = '') => { console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`); if (!goed) fout++; };
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
page.setDefaultTimeout(900000);
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

await page.evaluate(async () => {
  for (const k of Object.keys(localStorage)) if (k.startsWith('tinga.spel')) localStorage.removeItem(k);
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, v = g.verhaal;
  await g.voorbereidSpel();
  window.__programmasOpstart = g.renderer.info.programs.length;
  window.__M = await import('/js/yugo.js');
  window.__W = await import('/js/world.js');
  window.__K = (await import('/js/kaart.js')).KAART;
  g.player.active = false; window.__autoplay = false;
  g.politie.proefStil = true;
  g.geluid.start && g.geluid.start();
  const tekst = document.getElementById('dialoogTekst'), naam = document.getElementById('dialoogNaam');
  const dicht = () => document.getElementById('dialoog').hidden;
  window.__regels = [];
  let laatst = '';
  window.__lees = () => { const t = dicht() ? '' : `${naam.textContent}: ${tekst.textContent}`; if (t && t !== laatst) window.__regels.push(t); laatst = t; };
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) { v.update(dt); window.__lees(); } };
  window.__klik = (max = 40) => { for (let i = 0; i < max && !dicht(); i++) { window.__lees(); v.toets(); window.__stap(1); } };
  window.__zet = (x, z) => { const P = g.player; if (P.inCar) { P.inCar.speed = 0; P.inCar = null; } P.zit = false; P.eye = P.eyeStaand; P.pos.set(x, 0, z); P.applyCamera(); };
  window.__E = () => { const was = g.player.active; g.player.active = true; v.toets(); g.player.active = was; window.__lees(); };
  window.__toets = (code) => { const was = g.player.active; g.player.active = true; window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code.slice(-1), bubbles: true })); g.player.active = was; };
  window.__stand = (extra) => {
    const s = v.bewaar(); s.volgende = null;
    Object.assign(s, { noMercyKlaar: true, noMercyGebeld: true, roanKlaar: true }, extra);
    g.politie.reset(); v.herstel(s); window.__stap(2);
  };
  window.__dicht = dicht;
  // tot het zwart voorbij is en de stand er is
  window.__tot = (f, max = 600, dt = 0.05) => { for (let i = 0; i < max && !f(); i++) window.__stap(1, dt); return f(); };
});

kop('1. de zaal');
const zaal = await page.evaluate(() => {
  const g = window.__game, y = g.yugo, M = window.__M, K = window.__K;
  const p = y.plekken, G = K.gebied;
  const binnenKaart = p.nul.x < G.x1 && p.nul.z < G.z1;
  const anderen = [...g.woningen, g.boerderij, g.supermarkt, g.studio].filter(r => r && r.binnen);
  const overlap = anderen.some(r => [[0, 0], [14, 0], [0, 9.5], [14, 9.5], [7, 4]].some(([dx, dz]) => r.binnen(p.nul.x + dx, p.nul.z + dz)));
  return { binnenKaart, overlap, sushi: M.SUSHI.map(s => s.naam), drank: M.DRANK.naam, maten: y.maten, eigen: y.binnen(p.tafel.x, p.tafel.z) };
});
ok(!zaal.binnenKaart && !zaal.overlap && zaal.eigen, 'de zaal ligt buiten het kaartgebied en niet over een andere binnenruimte');
ok(zaal.sushi.length === 4 && zaal.drank === 'Pornstar Martini', 'vier soorten sushi en de Pornstar Martini', `${zaal.sushi.join(', ')} · ${zaal.drank}`);
ok(zaal.maten.emmers >= 8 && zaal.maten.stoelen >= 20 && zaal.maten.gasten >= 3, 'emmerlampen, stoelen en een paar gasten', `${zaal.maten.emmers} lampen, ${zaal.maten.stoelen} stoelen, ${zaal.maten.gasten} gasten`);

kop('2. Johan stelt Yugo voor');
const voorstel = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__stand({ missie: 'bx', fase: 'wacht', yugoGevraagd: false });
  const q = v.praatjes.johan;
  window.__zet(q.x + 150, q.z + 150); window.__stap(4);
  window.__zet(q.x + 1.8, q.z + 1.0); window.__stap(4);
  const uit = { zichtbaar: v.praatjes.johan.zichtbaar };
  window.__regels = [];
  window.__E(); window.__klik();
  uit.regels = [...window.__regels];
  uit.keuze = v.openKeuze; uit.fase = v.yugo.fase;
  uit.opdracht = document.getElementById('opdracht').textContent;
  // 2: een andere keer
  window.__regels = [];
  v.kiesHuis(2); window.__klik();
  uit.nee = { fase: v.yugo.fase, regels: [...window.__regels], opdracht: document.getElementById('opdracht').textContent };
  // daarna een gewoon praatje; na een praatje over Yugo vraagt hij het weer
  const aantal0 = v.praatjes.johan.aantal;
  let weer = null;
  for (let k = 0; k < 30 && !weer; k++) {
    window.__regels = [];
    window.__E(); window.__klik();
    if (v.yugo.fase === 'keuze') weer = { regels: [...window.__regels], keuze: v.openKeuze };
  }
  uit.praatjes = v.praatjes.johan.aantal - aantal0;
  uit.weer = weer;
  // met sterren: niet
  g.politie.zetSter && g.politie.zetSter(2, g.player.pos.x, g.player.pos.z);
  window.__regels = [];
  v.kiesHuis(1); window.__klik();
  uit.sterren = { fase: v.yugo.fase, regels: [...window.__regels] };
  g.politie.reset();
  return uit;
});
ok(voorstel.zichtbaar, 'Johan staat op zijn oprit');
ok(voorstel.regels.some(r => /Yugo/.test(r) && /Johan/.test(r)) && voorstel.regels.some(r => /sushi/i.test(r)), 'de eerste keer stelt Johan voor om bij Yugo sushi te eten', voorstel.regels[0]);
ok(voorstel.fase === 'keuze' && voorstel.keuze && voorstel.keuze.length === 2 && /1/.test(voorstel.opdracht), 'daarna de keuze: 1 ja, 2 een andere keer', (voorstel.keuze || []).join(' / '));
ok(voorstel.nee.fase === 'uit' && voorstel.nee.regels.some(r => /Jammer/.test(r)) && !/Yugo/.test(voorstel.nee.opdracht), '2: "Jammer", en de keuze is weg');
ok(voorstel.praatjes >= 1 && voorstel.weer && voorstel.weer.regels.some(r => /Yugo/.test(r)), 'daarna gewone praatjes, en na een praatje over Yugo weer de vraag', `${voorstel.praatjes} praatjes`);
ok(voorstel.sterren.fase === 'uit' && voorstel.sterren.regels.some(r => /politie/i.test(r)), 'met sterren gaat het niet door', voorstel.sterren.regels[0]);

kop('3. ja: aan tafel');
const tafel = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player, y = g.yugo;
  // opnieuw de vraag, nu 1
  const q = v.praatjes.johan;
  window.__zet(q.x + 1.8, q.z + 1.0); window.__stap(2);
  let n = 0;
  while (v.yugo.fase !== 'keuze' && n++ < 40) { window.__E(); window.__klik(); }
  g.sfeer.zetVoorkeur && g.sfeer.zetVoorkeur(true);
  const klokVoor = g.sfeer.loopt; window.__klokVoor = klokVoor;
  window.__regels = [];
  v.kiesHuis(1);
  window.__klik();
  const zwart = [];
  window.__tot(() => { const t = document.getElementById('overgangtekst'); if (t && t.textContent) zwart.push(t.textContent); return v.yugo.fase === 'tafel'; }, 800);
  window.__stap(10);
  P.binnen = y.binnen(P.pos.x, P.pos.z);
  const s = y.stand, pl = y.plekken;
  // waar zit je, waar zit Johan, en is hij (en het logo achter hem) in beeld?
  g.camera.updateMatrixWorld(true);
  const ndc = (x, yy, z) => { const p = new g.camera.position.constructor(x, yy, z).project(g.camera); return { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: p.z }; };
  const jh = y.johan.hoofd.getWorldPosition(new g.camera.position.constructor());
  const logo = ndc(pl.nul.x + 10.0, 1.62, pl.nul.z + 0.05);
  const heup = y.johan.beenLinks.boven.getWorldPosition(new g.camera.position.constructor());
  return {
    zwart: [...new Set(zwart)], fase: v.yugo.fase, ronde: s.ronde, tabletFase: s.fase,
    stoel: Math.hypot(P.pos.x - pl.stoel.x, P.pos.z - pl.stoel.z), zit: P.zit, oog: P.eye,
    johan: { ndc: ndc(jh.x, jh.y, jh.z), afst: +Math.hypot(jh.x - P.pos.x, jh.z - P.pos.z).toFixed(2), heup: +heup.y.toFixed(2), zichtbaar: y.johan.groep.visible },
    logo, uur: +g.sfeer.uur.toFixed(2), klokVoor, klokNu: g.sfeer.loopt, opslaan: v.waaromNietOpslaan(), radio: v.geenRadio, binnen: P.binnen,
    regels: [...window.__regels],
  };
});
ok(tafel.zwart.some(t => /Yugo/.test(t)) && tafel.fase === 'tafel', 'eerst het zwart ("Die avond, bij Yugo…"), dan aan tafel', tafel.zwart.join(' | '));
ok(tafel.stoel < 0.05 && tafel.zit && Math.abs(tafel.oog - 1.16) < 0.01 && tafel.binnen, 'je zit op de stoel aan het tafeltje, binnen (geen wapen)', `oog ${tafel.oog}`);
ok(tafel.johan.zichtbaar && Math.abs(tafel.johan.ndc.x) < 0.4 && Math.abs(tafel.johan.ndc.y) < 0.8 && tafel.johan.ndc.z < 1 && tafel.johan.afst > 1.2 && tafel.johan.afst < 2.2,
  'Johan zit tegenover je, midden in beeld, over de tafel', `${tafel.johan.afst} m, beeld (${tafel.johan.ndc.x}, ${tafel.johan.ndc.y})`);
ok(tafel.johan.heup > 0.4 && tafel.johan.heup < 0.62, 'Johan zit op de bank (zijn heup op de zitting)', `heup ${tafel.johan.heup} m`);
ok(Math.abs(tafel.logo.x) < 1 && Math.abs(tafel.logo.y) < 1 && tafel.logo.z < 1, 'het verlichte logo hangt achter hem in beeld', `(${tafel.logo.x}, ${tafel.logo.y})`);
ok(tafel.uur === 19 && tafel.klokNu === false, 'het is 19:00 en de klok staat stil', `${tafel.uur} uur, klok ${tafel.klokNu}`);
ok(!!tafel.opslaan && tafel.radio, 'niet opslaan aan tafel, en geen autoradio', tafel.opslaan);
ok(tafel.tabletFase === 'bestellen' && tafel.ronde === 1, 'ronde 1 begint met de tablet');

kop('3b. geen wapen aan tafel, en waar ze over praten');
const wapen = await page.evaluate(() => {
  const g = window.__game, P = g.player, y = g.yugo, v = g.verhaal;
  const uit = { aanTafel: P.aanTafel, mag: P.magSchieten() };
  const was = { uit: P.wapenUit, nr: P.wapenNr, ammo: P.ammo };
  window.__toets('KeyH');                                   // trekken of wegbergen
  uit.h = P.wapenUit === was.uit;
  uit.wissel = P.startWissel(P.wapens.find(w => w !== P.wapenSoort) || 'mes');
  P.ammo = 1; P.reload(); uit.herlaad = P.reloading <= 0; P.ammo = was.ammo;
  uit.richt = P.richten(true);
  const kogels = P.ammo; P.shoot && P.shoot(); uit.schot = P.ammo === kogels;
  P.wapenStap && P.wapenStap(0.05);
  uit.zichtbaar = !!(P.gun && P.gun.visible);
  // de gesprekken: wie, waarover, en wat er bij deze stand (missie 6, De Veteraan nog niet gezien) niet mag
  const alle = y.gesprekken;
  const tekst = alle.map(gs => gs.regels.map(r => r[1]).join(' ')).join(' ');
  uit.aantal = alle.filter(gs => !gs.eten).length;
  uit.beide = alle.filter(gs => !gs.eten && gs.regels.some(r => r[0] === 'e') && gs.regels.some(r => r[0] === 'j')).length;
  uit.onderwerpen = { veteraan: /Veteraan/.test(tekst), nomercy: /No Mercy/.test(tekst), erikJan: /Erik Jan/.test(tekst), texel: /Texel/.test(tekst),
    mark: /Mark/.test(tekst), weer: /buienradar|waai|vriezen|zon/.test(tekst), stad: /Groningen|Amsterdam/.test(tekst) };
  const gekozen = new Set();
  for (let k = 0; k < 400; k++) { const gs = y.kiesGesprek(); if (gs) gekozen.add(gs.als || (gs.eten ? 'eten' : 'altijd')); }
  uit.gekozen = [...gekozen];
  return uit;
});
ok(wapen.aanTafel && !wapen.mag && wapen.h && wapen.wissel === null && wapen.herlaad && !wapen.richt && wapen.schot && !wapen.zichtbaar,
  'aan tafel: geen wapen trekken, wisselen, herladen, richten of schieten, en niets in beeld', JSON.stringify(wapen).slice(0, 160));
ok(wapen.aantal >= 20 && wapen.beide >= 20, 'gesprekken tussen Johan en Erik, allebei aan het woord', `${wapen.aantal} gesprekken, ${wapen.beide} met allebei`);
ok(Object.values(wapen.onderwerpen).every(Boolean), 'over het werk en De Veteraan, de nieuwe No Mercy, Erik Jan, een dagje weg (Texel, een stad) met Mark, en het weer', JSON.stringify(wapen.onderwerpen));
// (de proefstand heeft No Mercy 4 gedaan, `__stand`: dat gesprek mag dus wel; No Mercy 5 kan pas na missie 12)
ok(!wapen.gekozen.some(a => /veteraan|einde|nm5/.test(a)) && wapen.gekozen.includes('nm4') && wapen.gekozen.includes('altijd') && wapen.gekozen.includes('eten'),
  'bij missie 6 nog niets over De Veteraan, No Mercy 5 of het einde; wel over No Mercy 4, die je gespeeld hebt', wapen.gekozen.join(', '));

kop('4. de tablet');
const tablet = await page.evaluate(() => {
  const g = window.__game, y = g.yugo;
  const el = y.tabletEl;
  const zichtbaar = getComputedStyle(el).display !== 'none' && !el.hidden;
  const tegels = [...el.querySelectorAll('.tegel')].map(t => t.textContent.replace(/\s+/g, ' ').trim());
  const r = el.getBoundingClientRect();
  // vijf keer 1: hoogstens vier
  for (let i = 0; i < 5; i++) window.__toets('Digit1');
  const vijf = { ...y.stand.keuze };
  window.__toets('Digit0');
  const wis = { ...y.stand.keuze };
  window.__toets('Digit1'); window.__toets('Digit3'); window.__toets('Digit3'); window.__toets('Digit4'); window.__toets('Digit5');
  const keuze = { ...y.stand.keuze };
  const aantal = [...el.querySelectorAll('.aantal')].filter(a => !a.hidden).map(a => a.textContent).join(',');
  window.__regels = [];
  window.__toets('Digit6');
  window.__stap(4);
  const na = y.stand;
  return { zichtbaar, tegels, maat: [Math.round(r.width), Math.round(r.height)], binnenScherm: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
    vijf, wis, keuze, aantal, na: { fase: na.fase, jij: na.jijBesteld, johan: na.johanBesteld }, dicht: getComputedStyle(el).display === 'none', regels: [...window.__regels], keuzes: g.verhaal.openKeuze };
});
ok(tablet.zichtbaar && tablet.binnenScherm, 'de tablet staat in beeld', `${tablet.maat.join(' × ')} px`);
ok(tablet.tegels.length === 6 && ['Sake nigiri', 'Zalm maki', 'California roll', 'Crispy ebi roll', 'Pornstar Martini', 'BESTELLEN'].every(w => tablet.tegels.some(t => t.includes(w))), 'vier gerechten, de Pornstar Martini en bestellen', tablet.tegels.join(' | '));
ok(tablet.vijf.nigiri === 4, 'vijf keer 1: hoogstens vier plankjes per ronde', JSON.stringify(tablet.vijf));
ok(Object.keys(tablet.wis).length === 0, '0 wist de keuze');
ok(tablet.keuze.nigiri === 1 && tablet.keuze.california === 2 && tablet.keuze.ebi === 1 && tablet.keuze.martini === 1 && tablet.aantal.split(',').length === 4, 'met de toetsen 1, 3, 3, 4 en 5 gekozen, en de tellers op de tegels', tablet.aantal);
ok(tablet.na.fase === 'besteld' && tablet.dicht && tablet.na.jij === 4, '6 bestelt, en de tablet gaat dicht');
ok(tablet.na.johan > tablet.na.jij && tablet.regels.some(r => /Johan/.test(r)), 'Johan bestelt meer dan jij', `jij ${tablet.na.jij}, Johan ${tablet.na.johan}: ${tablet.regels[0] || ''}`);

kop('5. de ober');
const ober = await page.evaluate(() => {
  const g = window.__game, y = g.yugo, W = window.__W, pl = y.plekken, T = window.__M.YUGO.tafel;
  let maxAfst = 0, inDoos = 0, zichtbaar = 0, tot = 0, kwam = false, meest = Infinity;
  const posities = [];
  for (let i = 0; i < 2400 && y.stand.fase !== 'eten'; i++) {
    window.__stap(1, 0.05);
    const o = y.ober.groep.position;
    if (y.ober.groep.visible) {
      zichtbaar++;
      const [rx, rz] = W.resolveCollisions(o.x, o.z, 0.2);
      if (Math.hypot(rx - o.x, rz - o.z) > 0.05) inDoos++;
      const d = Math.hypot(o.x - pl.tafel.x, o.z - pl.tafel.z);
      meest = Math.min(meest, d);
      if (i % 20 === 0) posities.push([+(o.x - pl.nul.x).toFixed(1), +(o.z - pl.nul.z).toFixed(1)]);
    }
    tot++;
  }
  const s = y.stand;
  const op = s.borden.length ? y.groep.children.filter(c => c.userData && c.userData.stukken).map(b => ({ x: b.position.x, y: b.position.y, z: b.position.z })) : [];
  const opBlad = op.every(b => Math.abs(b.y - T.hoog) < 0.001 && Math.abs(b.x - T.x) < T.breed / 2 && Math.abs(b.z - T.z) < T.diep / 2);
  return { fase: s.fase, tijd: +(tot * 0.05).toFixed(1), zichtbaar: +(zichtbaar * 0.05).toFixed(1), inDoos, meest: +meest.toFixed(2), posities: posities.slice(0, 12),
    jij: s.borden.filter(b => b.kant === 'jij').length, johan: s.borden.filter(b => b.kant === 'johan').length, glazen: s.glazen.map(g2 => g2.kant), opBlad, n: op.length };
});
ok(ober.fase === 'eten', 'de ober is geweest, het eten staat op tafel', `na ${ober.tijd} s, de ober ${ober.zichtbaar} s te zien`);
ok(ober.meest < 1.2 && ober.inDoos === 0, 'hij loopt tot naast de tafel en nooit door het hek, een tafel of de bar', `het dichtst ${ober.meest} m, ${ober.inDoos} beelden in een doos: ${JSON.stringify(ober.posities)}`);
ok(ober.jij === 4 && ober.johan >= 5 && ober.opBlad, 'jouw vier plankjes en Johans vijf of zes, allemaal op het tafelblad', `jij ${ober.jij}, Johan ${ober.johan}`);
ok(ober.glazen.includes('jij') && ober.glazen.includes('johan'), 'een Pornstar Martini voor jou en voor Johan');

kop('6. eten en drinken');
const eten = await page.evaluate(() => {
  const g = window.__game, y = g.yugo, P = g.player, V = g.camera.position.constructor;
  P.health = 60;
  const stok = y.stokjes;
  // in rust: de stokjes in beeld
  window.__stap(2);
  g.camera.updateMatrixWorld(true);
  const tip = () => new V(0, -0.225, 0).applyMatrix4(stok.matrixWorld);
  stok.updateMatrixWorld(true);
  const rust = tip().project(g.camera);
  const voor = y.stand.over.jij;
  // het stuk dat hij pakt
  let doelStuk = null;
  for (const b of y.groep.children) if (b.userData && b.userData.kant === 'jij' && b.userData.stukken) { doelStuk = b.userData.stukken.find(s => s.visible); if (doelStuk) break; }
  const stukPos = doelStuk.getWorldPosition(new V());
  window.__E();
  let dichtst = Infinity, mond = Infinity;
  for (let i = 0; i < 40; i++) {
    window.__stap(1, 0.03);
    stok.updateMatrixWorld(true);
    const t = tip();
    if (y.stand.stok === 'heen') dichtst = Math.min(dichtst, t.distanceTo(stukPos.clone().add(new V(0, 0.014, 0))));
    if (y.stand.stok === 'mond') mond = Math.min(mond, t.distanceTo(g.camera.position));
  }
  window.__stap(20, 0.03);
  const na = y.stand;
  const leven = P.health;
  // Q: drinken
  const glas = y.groep.children.find(c => c.userData && c.userData.kant === 'jij' && c.userData.vul);
  const vul0 = glas.userData.vul.scale.y;
  window.__toets('KeyQ');
  const vul1 = glas.userData.vul.scale.y;
  for (let i = 0; i < 4; i++) window.__toets('KeyQ');
  const leeg = glas.userData.slokken;
  // Johan eet zelf
  const johan0 = y.stand.over.johan;
  window.__stap(200, 0.05);
  return { rust: { x: +rust.x.toFixed(2), y: +rust.y.toFixed(2), z: rust.z }, voor, na: na.over.jij, gegeten: na.gegeten, dichtst: +dichtst.toFixed(3), mond: +mond.toFixed(3),
    leven, stok: na.stok, vul0, vul1: +vul1.toFixed(2), leeg, slokken: y.stand.slokken, johan0, johan1: y.stand.over.johan };
});
ok(Math.abs(eten.rust.x) < 1 && Math.abs(eten.rust.y) < 1 && eten.rust.z < 1, 'de stokjes zijn in beeld', `(${eten.rust.x}, ${eten.rust.y})`);
ok(eten.dichtst < 0.025, 'E: de punten van de stokjes gaan naar het stuk sushi', `${(eten.dichtst * 100).toFixed(1)} cm`);
ok(eten.mond < 0.2 && eten.na === eten.voor - 1 && eten.gegeten === 1 && eten.stok === 'rust', 'het stuk gaat naar je mond en is op', `${eten.voor} → ${eten.na}, tot ${(eten.mond * 100).toFixed(0)} cm van je ogen`);
ok(eten.leven === 62, 'een stuk sushi geeft leven', `${eten.leven}`);
ok(eten.vul1 < eten.vul0 && eten.leeg === 4 && eten.slokken === 4, 'Q: een slok, het glas wordt leger, na vier slokken leeg', `${eten.vul0} → ${eten.vul1}`);
ok(eten.johan1 < eten.johan0, 'Johan eet zelf', `${eten.johan0} → ${eten.johan1} stukken over`);

kop('7. hoe lang het duurt (de echte tijden)');
const duur = await page.evaluate(() => {
  const g = window.__game, y = g.yugo;
  // een automaat: eet elke 1,3 s een stuk; bestelt na 15 s vier plankjes en een cocktail
  let t = 0, eetT = 0, beginRonde = y.stand.ronde, rondeT = null, start = null;
  // eerst de lopende ronde afmaken
  const loop = (stopAls, max = 9000) => {
    for (let i = 0; i < max && !stopAls(); i++) {
      window.__stap(1, 0.1); t += 0.1; eetT += 0.1;
      const s = y.stand;
      if (s.fase === 'bestellen' && y.stand && start !== null && t - start > 15) { for (const k of ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6']) window.__toets(k); }
      if (eetT > 1.3 && s.stok === 'rust' && s.over.jij > 0) { eetT = 0; window.__E(); }
    }
  };
  loop(() => y.stand.ronde > beginRonde);
  start = t;
  const r = y.stand.ronde;
  loop(() => y.stand.ronde > r || y.stand.fase === 'klaar');
  rondeT = t - start;
  return { ronde: r, rondeT: +rondeT.toFixed(0), vijf: +(rondeT * 5 / 60).toFixed(1), gesprekken: y.stand.gesprekken, erik: window.__regels.filter(x => /^Erik:/.test(x)).length };
});
ok(duur.rondeT > 120 && duur.vijf >= 12 && duur.vijf <= 18, 'een ronde met de echte tijden; vijf rondes duren ongeveer een kwartier', `ronde ${duur.ronde}: ${duur.rondeT} s, vijf rondes ${duur.vijf} min`);
ok(duur.gesprekken >= 6 && duur.erik >= 4, 'onderweg praten ze: Erik en Johan om de beurt', `${duur.gesprekken} gesprekken tot nu, ${duur.erik} regels van Erik`);

kop('8. vijf rondes en het einde');
const einde = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, y = g.yugo, M = window.__M, P = g.player;
  // korte tijden voor de rest
  const was = JSON.parse(JSON.stringify(M.YUGO));
  Object.assign(M.YUGO, { oberNa: [1, 1.5], oberLoop: 6, pauze: [1, 1.5], johanHap: [0.2, 0.3], praat: [999, 1000], tabletMax: 3, tabletDuw: 2 });
  const fases = new Set(), rondes = new Set();
  let eetT = 0;
  for (let i = 0; i < 20000 && v.yugo.fase !== 'uit'; i++) {
    window.__stap(1, 0.05); eetT += 0.05;
    const s = y.stand;
    if (s.actief) { fases.add(s.fase); rondes.add(s.ronde); }
    if (s.fase === 'bestellen') window.__toets('Digit6');
    if (eetT > 0.4 && s.stok === 'rust' && s.over.jij > 0) { eetT = 0; window.__E(); }
  }
  Object.assign(M.YUGO, was);
  const zwart = document.getElementById('overgangtekst').textContent;
  const q = v.praatjes.johan;
  window.__stap(160);            // het zwart ebt weg (6,4 s)
  return { fase: v.yugo.fase, keer: v.yugo.keer, rondes: [...rondes], fases: [...fases], actief: y.stand.actief, borden: y.stand.borden.length, stokjes: y.stokjes.visible,
    johanBinnen: y.johan.groep.visible, zwart, afstJohan: +Math.hypot(P.pos.x - q.x, P.pos.z - q.z).toFixed(1), johanZichtbaar: q.zichtbaar, zit: P.zit,
    klok: g.sfeer.loopt, klokVoor: window.__klokVoor, aanTafel: P.aanTafel, klokWas: v.yugo.klokWas, tijdVast: v.tijdVast(), missieBezig: v.missieBezig, uur: +g.sfeer.uur.toFixed(2), binnen: y.binnen(P.pos.x, P.pos.z), regels: window.__regels.filter(r => /rekening|trakteer/.test(r)) };
});
ok(Math.max(...einde.rondes) === 5 && einde.fases.includes('klaar'), 'door tot ronde vijf (1 en 2 hierboven), en dan klaar', einde.rondes.join(','));
ok(einde.regels.length >= 1, 'Johan vraagt de rekening en trakteert', einde.regels.join(' | '));
ok(einde.fase === 'uit' && !einde.actief && einde.borden === 0 && !einde.stokjes && !einde.johanBinnen, 'na het zwart is de zaal opgeruimd', einde.zwart);
ok(!einde.binnen && einde.afstJohan < 3.5 && einde.johanZichtbaar && !einde.zit && !einde.aanTafel, 'je staat weer bij Johan op de oprit, en je wapen mag weer', `${einde.afstJohan} m`);
// (de klok zelf: missie 6 wacht hier al, en een lopende missie houdt hem na 18:00 stil; Yugo moet hem alleen loslaten)
ok(einde.klokWas === null && !/verhaal houdt de tijd vast/.test(einde.tijdVast || '') && (einde.missieBezig || einde.klok === einde.klokVoor) && einde.uur > 19,
  'Yugo houdt de klok niet meer vast, en het is later op de avond', `${einde.uur} uur, klok ${einde.klok} (voor ${einde.klokVoor}), ${einde.tijdVast || 'tijd vrij'}`);

kop('9. X: weggaan');
const weg = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, y = g.yugo, P = g.player;
  v.startYugo(); window.__stap(10);
  const aan = y.stand.actief && v.yugo.fase === 'tafel';
  window.__regels = [];
  window.__toets('KeyX');
  window.__tot(() => v.yugo.fase === 'uit', 1200);
  window.__stap(4);
  const q = v.praatjes.johan;
  return { aan, regels: [...window.__regels], fase: v.yugo.fase, actief: y.stand.actief, afst: +Math.hypot(P.pos.x - q.x, P.pos.z - q.z).toFixed(1), zit: P.zit };
});
ok(weg.aan, 'opnieuw aan tafel');
ok(weg.regels.some(r => /^Erik/.test(r) && /morgen vroeg op/.test(r) && /die kant op/.test(r)), 'X: Erik zegt dat hij morgen vroeg op moet en die kant op gaat', weg.regels[0]);
ok(weg.fase === 'uit' && !weg.actief && weg.afst < 3.5 && !weg.zit, 'en je staat weer buiten bij Johan', `${weg.afst} m`);

kop('10. opslaan en laden');
const opslag = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, y = g.yugo;
  const s = v.bewaar();
  const uit = { gevraagd: s.yugoGevraagd, keer: s.yugoKeer };
  v.startYugo(); window.__stap(10);
  const aan = y.stand.actief;
  v.herstel({ ...s }); window.__stap(4);
  uit.na = { aan, actief: y.stand.actief, fase: v.yugo.fase, zit: g.player.zit, gevraagd: v.yugo.gevraagd, keer: v.yugo.keer, tablet: getComputedStyle(y.tabletEl).display };
  return uit;
});
ok(opslag.gevraagd === true && opslag.keer >= 2, 'de opslag onthoudt het voorstel en hoe vaak je er was', `${opslag.keer} keer`);
ok(opslag.na.aan && !opslag.na.actief && opslag.na.fase === 'uit' && !opslag.na.zit && opslag.na.tablet === 'none' && opslag.na.gevraagd, 'laden aan tafel ruimt de zaal op');

kop('11. het muziekje en de shaders');
const rest = await page.evaluate(async () => {
  const g = window.__game, v = g.verhaal, y = g.yugo, R = g.renderer, P = g.player;
  // eerst buiten bij Johan een beeld (het uur van het etentje), dan binnen: binnenkomen mag niets vertalen
  g.sfeer.uur = 19; P.applyCamera(); R.render(g.scene, g.camera);
  const buiten = R.info.programs.length;
  v.startYugo(); window.__stap(4);
  // de audioklok loopt met de echte tijd (headless zo'n drie keer trager): echt wachten
  const tel0 = g.geluid.yugoTel || 0;
  for (let i = 0; i < 60; i++) { window.__stap(1, 0.05); await new Promise(r => setTimeout(r, 80)); }
  const tel1 = g.geluid.yugoTel || 0;
  // eerst de zaal zonder de mensen en het eten, dan met alles op tafel
  const render = () => { g.scene.updateMatrixWorld(true); P.applyCamera(); R.render(g.scene, g.camera); P.yaw = 0.8; P.applyCamera(); R.render(g.scene, g.camera); P.yaw = -0.6; P.applyCamera(); R.render(g.scene, g.camera); P.yaw = 0; P.applyCamera(); };
  render();
  const zonder = R.info.programs.length;
  window.__toets('Digit3'); window.__toets('Digit5'); window.__toets('Digit6');
  for (let i = 0; i < 2400 && y.stand.fase !== 'eten'; i++) { window.__stap(1, 0.05); if (y.ober.groep.visible && i % 40 === 0) render(); }
  window.__E(); window.__stap(8, 0.03);
  render();
  const na = R.info.programs.length;
  v.klusAfbreken(); window.__tot(() => v.yugo.fase === 'uit', 1200);
  window.__stap(30, 0.05);
  return { tel0, tel1, stil: g.geluid.yugoVolgende == null, buiten, zonder, na, opstart: window.__programmasOpstart, ctx: g.geluid.ctxStand ? g.geluid.ctxStand() : '' };
});
ok(rest.tel1 > rest.tel0 + 2, 'aan tafel speelt het Japanse muziekje', `${rest.tel1 - rest.tel0} tellen in 4,8 s echte tijd`);
ok(rest.stil, 'buiten houdt het op');
ok(rest.zonder === rest.buiten && rest.na === rest.zonder, 'geen nieuw shaderprogramma bij het binnenkomen en aan tafel (de ober, de sushi, de stokjes, het glas)', `buiten ${rest.buiten}, binnen ${rest.zonder}, met alles ${rest.na} (opstart ${rest.opstart})`);

await browser.close();
console.log(fout ? `\n${fout} fout(en)` : '\nalles goed');
process.exit(fout ? 1 : 0);
