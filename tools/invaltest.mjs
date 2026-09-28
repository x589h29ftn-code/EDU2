/*
 Toetst missie 16, De inval (js/verhaal.js, js/inval.js; stap 101).

 1. Na missie 15 staat missie 16 klaar.
 2. Het telefoontje van Johan, de drie minuten, en te laat: Mark is opgepakt.
 3. Leeghalen: het schrift bij de bank, de foto's op het dressoir, Mark mee naar buiten, een
    auto voor de deur.
 4. De inval: het filmbeeld (de auto staat stil, de politie draait de straat in tot voor de
    deur), dan drie sterren en twee wagens erachteraan.
 5. Afgeschud: naar de Wieken 29; Bouwman belt; de keuze.
 6. Keuze 2, de hinderlaag: "Die nacht…", het filmbeeld op de brug (Bouwman op het dek, niet
    op de N7), wapen weg, de tas, "Nu!" (twee man neer), de vlucht (over het dek, de helling af
    en naar een rotonde, zonder sprong), rammen, de crash, zijn telefoon, € 3.000, de ochtend.
 7. Keuze 1, ruilen: de tas, Johan vrij, Bouwman rijdt weg, schriftKwijt, € 1.000.
 8. Bouwman ontsnapt: € 2.000. Schieten tijdens de ruil: Johan geraakt. Het wapen te lang in
    je hand: Bouwman vertrouwt het niet. De auto total loss met Mark erin.
 9. Opslaan en laden: de keuze en de afloop gaan mee.

 Gebruik: npm run server &   node tools/invaltest.mjs 8123
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
  const V = await import('/js/viaduct.js');
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, v = g.verhaal;
  g.player.active = false;
  window.__autoplay = false;
  g.sfeer.uur = 10;
  window.__W = W; window.__V = V;
  window.__meld = [];
  const echt = g.hud.melding.bind(g.hud);
  g.hud.melding = (k, o, t) => { window.__meld.push(`${k}|${o}`); return echt(k, o, t); };
  // mislukt laadt het opgeslagen spel: in de proef niet, dan kunnen we verder
  window.__stap = (n = 20, dt = 0.05) => {
    for (let i = 0; i < n; i++) { g.player.health = 100; v.update(dt); }
  };
  window.__klik = (max = 60) => {
    for (let i = 0; i < max && !document.getElementById('dialoog').hidden; i++) { v.toets(); window.__stap(1); }
  };
  window.__tot = (fase, maxS = 20, dt = 0.05) => {
    for (let t = 0; t < maxS && v.fase !== fase; t += dt) { g.player.health = 100; v.update(dt); if (!document.getElementById('dialoog').hidden) { v.toets(); } }
    return v.fase === fase;
  };
  window.__zet = (x, z, y = 0) => { if (g.player.inCar) { g.player.inCar.speed = 0; g.player.inCar = null; } g.player.pos.set(x, y, z); g.player.applyCamera(); };
  window.__zetAuto = (a, x, z, yaw, y = null) => {
    a.x = x; a.z = z; a.yaw = yaw; a.rij = yaw; a.speed = 0;
    if (a.mesh) { if (y != null) a.mesh.position.y = y; a.mesh.position.set(x, a.mesh.position.y, z); a.mesh.rotation.y = yaw; }
  };
  window.__klaar = () => {
    const s = v.bewaar(); s.missie = 'klaar'; s.fase = 'klaar'; s.volgende = null;
    v.herstel(s); v.__geenVolgende(); g.politie.reset();
  };
  // de missie op een fase zetten, zoals na het laden van een opgeslagen spel
  window.__opFase = (fase, keus = 0) => {
    const s = v.bewaar(); s.missie = 'inval'; s.fase = fase; s.invalKeus = keus; s.invalTelefoon = false; s.schriftKwijt = false; s.invalKlaar = false;
    g.politie.reset();
    v.herstel(s);
  };
});

// ------------------------------------------------------------------ 1. na missie 15
kop('na missie 15');
const na15 = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  const s = v.bewaar(); s.missie = 'klaar'; s.fase = 'klaar'; s.volgende = null; s.schaduwKlaar = true; s.raceKlaar = true;
  s.brugKlaar = true; s.schriftKlaar = true; s.polKlaar = true; s.vetKlaar = true; s.huisGekozen = s.huisGekozen || 'Koningsspil 20';
  v.herstel(s);
  return v.volgendeMissie;
});
ok(na15 && na15.naam === 'inval', 'na het schaduwen staat De inval klaar', JSON.stringify(na15));

// ------------------------------------------------------------------ 2. het telefoontje en te laat
kop('het telefoontje en de drie minuten');
const tel = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  v.startMissie('inval');
  const d = v.inval;
  const w = g.woningen ? null : null;
  window.__stap(40);
  const naam = document.getElementById('dialoogNaam').textContent;
  const open = !document.getElementById('dialoog').hidden;
  window.__klik();
  window.__stap(2);
  const balk = document.getElementById('schaduwbalk');
  return { naam, open, fase: v.fase, klok: v.inval.klok, balk: !balk.hidden, tekst: balk.querySelector('.tekst').textContent,
    nav: g.hud.nav && g.hud.nav.letter, merken: v.inval.merkZichtbaar };
});
ok(tel.open && tel.naam === 'Johan', 'Johan belt', tel.naam);
ok(tel.fase === 'leeghalen' && tel.klok > 175 && tel.klok <= 180, 'drie minuten', `${tel.fase}, ${tel.klok.toFixed(1)} s`);
ok(tel.balk && /Inval over 2:5\d|Inval over 3:00/.test(tel.tekst), 'de balk telt af', tel.tekst);
ok(tel.nav === 'M' && tel.merken[0] && tel.merken[1], 'een M op de kaart en twee gele ruiten binnen');
const laat = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__meld = [];
  for (let i = 0; i < 400 && !window.__meld.some(m => m.startsWith('MISSIE MISLUKT')); i++) v.update(0.5);
  return window.__meld.filter(m => m.startsWith('MISSIE MISLUKT'));
});
ok(laat.length && /opgepakt/.test(laat[0]), 'te laat: Mark is opgepakt', laat[0] || 'geen melding');

// ------------------------------------------------------------------ 3. leeghalen
kop('leeghalen');
const leeg = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__stap(80);                       // de mislukking loopt af
  v.startMissie('inval');
  window.__stap(40); window.__klik(); window.__stap(2);
  const d = v.inval.merkPlek;
  // naar binnen: bij de bank
  window.__zet(d[0].x + 0.4, d[0].z);
  window.__stap(4);
  const zegtIets = !document.getElementById('dialoog').hidden;
  window.__klik();
  v.toets(); window.__stap(2); window.__klik();
  const schrift = v.inval.heeft.schrift;
  window.__zet(d[1].x + 0.4, d[1].z);
  window.__stap(2);
  v.toets(); window.__stap(2); window.__klik();
  const uit = { zegtIets, schrift, fotos: v.inval.heeft.fotos, fase: v.fase, klok: v.inval.klok };
  // naar buiten, voor de deur
  const m = g.molenkrite ? null : null;
  return uit;
});
ok(leeg.zegtIets, 'binnen zegt Mark vanzelf iets');
ok(leeg.schrift && leeg.fotos, 'het schrift en de foto\'s gepakt');
ok(leeg.fase === 'naarBuiten', 'en dan naar buiten', leeg.fase);
const buiten = await page.evaluate(async () => {
  const g = window.__game, v = g.verhaal;
  const { KAART } = await import('/js/kaart.js');
  // de stoep voor Molenkrite 15: de huisdeur van het verhaal
  const w = g.verhaal.inval.wiekenDeur;
  const mk = v.mark;
  // buiten staan: vlak voor de voordeur van Molenkrite 15 (die zit in molenkriteDeur; het
  // verhaal kent hem, de proef pakt de plek van het huis via het pijltje van de navigatie)
  const nav = g.hud.nav;
  const deur = nav && nav.doel ? { x: nav.doel[0], z: nav.doel[1] } : { x: KAART.start.x, z: KAART.start.z };
  window.__zet(deur.x + 1.5, deur.z + 1.5);
  window.__stap(6);
  const fase = v.fase;
  const markZien = mk.groep.visible;
  const sp = g.player.pos;
  let auto = null, ad = Infinity;
  for (const c of g.vehicles.cars) {
    if (!c.driveable || c.wrak) continue;
    const d = Math.hypot(c.x - sp.x, c.z - sp.z);
    if (d < ad) { ad = d; auto = c; }
  }
  window.__auto = auto;
  return { fase, markZien, ad, deur, klok: v.inval.klok };
});
ok(buiten.fase === 'instappen' && buiten.markZien, 'buiten staat Mark naast je', buiten.fase);
ok(buiten.ad < 36, 'en er staat een auto voor de deur', `${buiten.ad.toFixed(1)} m`);
ok(buiten.klok < 180 && buiten.klok > 150, 'de tijd loopt door', `${buiten.klok.toFixed(0)} s over`);

// ------------------------------------------------------------------ 4. de inval
kop('de inval');
const inval = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  const a = window.__auto;
  g.vehicles.maakBestuurbaar(a);   // zoals instappen met E: een eigen model met wielen
  g.player.inCar = a; g.player.pos.set(a.x, 0, a.z);
  // Mark rent naar de auto en stapt in
  for (let i = 0; i < 200 && !v.inval.film; i++) window.__stap(1);
  window.__stap(2);
  const film = v.inval.film, filmBalk = document.body.classList.contains('film');
  const konvooi = v.inval.konvooi;
  const voor = { x: a.x, z: a.z };
  // waar ze heen rijden: het eind van de route, de rijbaan voor de deur van Molenkrite 15
  const rp = v.inval.route && v.inval.route.pts, eind = rp ? { x: rp[rp.length - 1][0], z: rp[rp.length - 1][1] } : voor;
  const d0 = konvooi.length ? Math.hypot(konvooi[0].x - eind.x, konvooi[0].z - eind.z) : null;
  // tijdens het filmbeeld staat de auto stil, ook als je gas geeft
  a.x += 3; window.__stap(1);
  const stil = Math.hypot(a.x - voor.x, a.z - voor.z) < 0.01;
  window.__stap(Math.ceil(9 / 0.05));
  const d1 = konvooi.length ? Math.hypot(konvooi[0].x - eind.x, konvooi[0].z - eind.z) : null;
  window.__klik();
  return { film, filmBalk, n: konvooi.length, politie: konvooi.filter(c => c.zwaailicht).length, d0, d1, stil,
    fase: v.fase, sterren: g.politie.ster, wagens: g.politie.eenheden.wagens, filmNa: document.body.classList.contains('film') };
});
ok(inval.film === 'inval' && inval.filmBalk, 'Mark stapt in: het filmbeeld begint', String(inval.film));
ok(inval.n === 3 && inval.politie === 2, 'twee politieauto\'s en een busje', `${inval.n} auto's, ${inval.politie} met zwaailicht`);
ok(inval.stil, 'je auto staat stil zolang het filmbeeld loopt');
ok(inval.d0 != null && inval.d1 < inval.d0 && inval.d1 < 14, 'ze rijden de straat in tot voor de deur', `${inval.d0 && inval.d0.toFixed(0)} → ${inval.d1 && inval.d1.toFixed(0)} m`);
ok(inval.fase === 'afschudden' && inval.sterren >= 3 && !inval.filmNa, 'daarna drie sterren', `${inval.fase}, ${inval.sterren} sterren`);
ok(inval.wagens >= 2, 'en wagens erachteraan', `${inval.wagens}`);

// ------------------------------------------------------------------ 5. afschudden, de Wieken en de keuze
kop('de Wieken en de keuze');
const wieken = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  g.politie.reset();
  window.__stap(Math.ceil(6 / 0.05)); window.__klik();
  const fase1 = v.fase, nav = g.hud.nav && g.hud.nav.letter;
  const d = v.inval.wiekenDeur, a = g.player.inCar;
  window.__zetAuto(a, d.x + 3, d.z + 3, a.yaw);
  window.__stap(4);
  const fase2 = v.fase;
  const namen = new Set();
  for (let i = 0; i < 40 && !document.getElementById('dialoog').hidden; i++) { namen.add(document.getElementById('dialoogNaam').textContent); v.toets(); window.__stap(1); }
  return { fase1, nav, fase2, namen: [...namen], fase3: v.fase, markZien: v.mark.groep.visible };
});
ok(wieken.fase1 === 'naarWieken' && wieken.nav === 'M', 'afgeschud: naar de Wieken 29', `${wieken.fase1}, ${wieken.nav}`);
ok(wieken.fase2 === 'bouwmanBelt' && wieken.namen.includes('Bouwman') && wieken.namen.includes('Johan'), 'Bouwman belt, en Johan zegt iets', wieken.namen.join(', '));
ok(wieken.fase3 === 'keuze' && wieken.markZien, 'dan de keuze, met Mark naast je', wieken.fase3);

// ------------------------------------------------------------------ 6. keuze 2: de hinderlaag
kop('keuze 2: de hinderlaag');
const brug = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, V = window.__V;
  v.kiesHuis(2);
  window.__klik();
  const gehaald = window.__tot('brugFilm', 12);
  const I = v.inval, auto = I.auto;
  const uit = { gehaald, uur: g.sfeer.uur, film: I.film };
  window.__stap(Math.ceil(17 / 0.05));
  window.__klik();
  const I2 = v.inval;
  const B = (x, z) => { const s0 = I2.brugPunt(0, 0), s1 = I2.brugPunt(10, 0); const fx = (s1.x - s0.x) / 10, fz = (s1.z - s0.z) / 10; return { s: (x - s0.x) * fx + (z - s0.z) * fz, u: (x - s0.x) * -fz + (z - s0.z) * fx }; };
  const lok = B(auto.x, auto.z);
  const dek = V.grondHoogte(auto.x, auto.z, Infinity);
  uit.fase = v.fase; uit.autoS = lok.s; uit.autoY = auto.mesh ? auto.mesh.position.y : null; uit.dek = dek;
  uit.mannen = I2.mannen ? I2.mannen.aantal : 0; uit.johan = I2.johan.groep.visible;
  uit.spelerY = g.player.pos.y;
  uit.ruit = I2.merkZichtbaar[0];
  return uit;
});
ok(brug.gehaald && brug.uur === 1 && brug.film === 'brug', '"Die nacht…": één uur, en het filmbeeld op de brug', `${brug.uur} uur, ${brug.film}`);
ok(brug.fase === 'ruilLopen', 'na het filmbeeld: naar het midden', brug.fase);
ok(Math.abs(brug.autoS - 34) < 1.5 && brug.autoY > 4.5, 'Bouwman staat op het dek, niet op de N7', `s ${brug.autoS.toFixed(1)}, hoogte ${brug.autoY && brug.autoY.toFixed(2)} (dek ${brug.dek.toFixed(2)})`);
ok(brug.mannen === 2 && brug.johan && brug.ruit, 'met twee man en Johan; de gele ruit ligt klaar');
ok(brug.spelerY > 4.5, 'en jij staat ook op het dek', `${brug.spelerY.toFixed(2)} m`);
const wapen = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, I = v.inval;
  const r = I.brugPunt(I.S.ruit, 0);
  window.__zet(r.x - 1, r.z, g.player.pos.y);
  g.player.wapenUit = false;
  window.__meld = [];
  window.__stap(Math.ceil(2 / 0.05));
  const na2 = { fase: v.fase, wapenT: v.inval.wapenT, mislukt: window.__meld.some(m => m.startsWith('MISSIE MISLUKT')) };
  g.player.wapenUit = true;
  window.__stap(10); window.__klik();
  return na2;
});
ok(!wapen.mislukt && wapen.fase === 'ruilLopen' && wapen.wapenT > 1, 'wapen in je hand: Bouwman roept, en je krijgt even de tijd', `${wapen.fase}, ${wapen.wapenT.toFixed(1)} s${wapen.mislukt ? ', mislukt' : ''}`);
const nu = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, I = v.inval;
  const r = I.brugPunt(I.S.ruit, 0);
  window.__zet(r.x, r.z, g.player.pos.y);
  window.__stap(2);
  v.toets(); window.__stap(2);
  const tas = I.tas.zichtbaar, fase1 = v.fase;
  const t = I.brugPunt(I.S.ruit - 6, 0);
  window.__zet(t.x, t.z, g.player.pos.y);
  window.__stap(2); window.__klik();
  const gehaald = window.__tot('nuFilm', 20);
  const tasWeg = !v.inval.tas.zichtbaar;
  window.__stap(Math.ceil(3.4 / 0.05)); window.__klik();
  const I2 = v.inval;
  return { tas, fase1, gehaald, tasWeg, neer: I2.mannen ? I2.mannen.neer : 0, fase: v.fase, vlucht: !!I2.vlucht,
    lengte: I2.lijn ? I2.lijn.lengte : 0, sprong: I2.lijn ? I2.lijn.sprong : null, rotonde: I2.rotonde };
});
ok(nu.tas && nu.fase1 === 'achteruit', 'de tas op de ruit, vijf stappen achteruit');
ok(nu.gehaald && nu.tasWeg, 'een van de mannen haalt de tas, Bouwman kijkt erin: "Nu!"');
ok(nu.neer === 2, 'twee schoten van Mark: allebei neer', `${nu.neer}`);
ok(nu.fase === 'achtervolging' && nu.vlucht && nu.lengte > 300, 'Bouwman vlucht', `${nu.fase}, ${nu.lengte.toFixed(0)} m`);
ok(!!nu.rotonde, 'naar een rotonde', nu.rotonde ? `${nu.rotonde.x.toFixed(0)},${nu.rotonde.z.toFixed(0)}` : 'geen');
const rit = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, V = window.__V, I = v.inval, L = I.lijn;
  // de lijn: langs de rotonde, en de hoogte zoals een auto hem rijdt
  let minR = Infinity;
  for (let i = 0; i < L.n; i++) minR = Math.min(minR, Math.hypot(L.x[i] - I.rotonde.x, L.z[i] - I.rotonde.z));
  // hem een stuk laten rijden: nergens een sprong naar beneden
  const car = I.auto;
  let yVorig = car.mesh.position.y, sprong = 0, afgelegd = 0;
  const s0 = I.vlucht.s;
  for (let i = 0; i < 160; i++) {
    window.__stap(1);
    const y = car.mesh.position.y;
    sprong = Math.max(sprong, Math.abs(y - yVorig)); yVorig = y;
  }
  afgelegd = v.inval.vlucht ? v.inval.vlucht.s - s0 : 0;
  return { minR, r: I.rotonde.r, sprong, afgelegd, fase: v.fase };
});
ok(rit.minR < rit.r + 12, 'de lijn gaat over de rotonde', `${rit.minR.toFixed(1)} m van het midden (straal ${rit.r.toFixed(1)})`);
ok(rit.sprong < 0.6, 'hij rijdt van het dek de helling af, zonder sprong', `grootste stap ${rit.sprong.toFixed(2)} m`);
ok(rit.afgelegd > 40 && rit.fase === 'achtervolging', 'en hij rijdt echt weg', `${rit.afgelegd.toFixed(0)} m in 8 s`);
const ram = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, I = v.inval, car = I.auto;
  // jij in een auto vlak achter hem, op volle snelheid
  const a = I.golf || window.__auto;
  const vx = -Math.sin(car.yaw), vz = -Math.cos(car.yaw);
  window.__zetAuto(a, car.x - vx * 2.2, car.z - vz * 2.2, car.yaw, car.mesh.position.y);
  a.driveable = true; g.player.inCar = a;
  a.speed = 20;
  window.__stap(1);
  a.speed = 20;
  const klappen = v.inval.klappen, fase1 = v.fase;
  const van = { x: car.x, z: car.z };
  window.__stap(Math.ceil(4.6 / 0.05)); window.__klik();
  return { klappen, fase1, fase: v.fase, verschoven: Math.hypot(car.x - van.x, car.z - van.z), bouwman: v.inval.bouwman.groep.visible };
});
ok(ram.klappen >= 3 && ram.fase1 === 'crashFilm', 'één harde klap: hij vliegt de berm in', `${ram.klappen} klappen, ${ram.fase1}`);
ok(ram.fase === 'doorzoeken' && ram.verschoven > 4 && !ram.bouwman, 'zijn auto ligt ernaast, hij is het weiland in', `${ram.verschoven.toFixed(1)} m`);
const eind2 = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, I = v.inval, car = I.auto;
  window.__zet(car.x + 1.5, car.z + 1.5);
  window.__stap(2);
  v.toets(); window.__stap(1);
  const namen = new Set();
  for (let i = 0; i < 30 && !document.getElementById('dialoog').hidden; i++) { namen.add(document.getElementById('dialoogTekst').textContent); v.toets(); window.__stap(1); }
  const telefoon = v.inval.telefoon, fase1 = v.fase;
  const geld0 = v.geld;
  const d = v.inval.wiekenDeur;
  window.__zet(d.x + 2, d.z + 2);
  window.__stap(4); window.__klik();
  const geld1 = v.geld;
  window.__meld = [];
  window.__stap(Math.ceil(12 / 0.05)); window.__klik();
  return { telefoon, fase1, ronald: [...namen].some(t => /— R\./.test(t)), verdiend: geld1 - geld0, klaar: v.inval.klaar, uur: g.sfeer.uur,
    johan: v.inval.johan.groep.visible };
});
ok(eind2.telefoon && eind2.ronald, 'zijn telefoon: het bericht van "R."');
ok(eind2.fase1 === 'naarWiekenB', 'terug naar Mark en Johan', eind2.fase1);
ok(eind2.verdiend === 3000 && eind2.klaar, 'MISSIE GESLAAGD: € 3.000', `+ € ${eind2.verdiend}`);
ok(Math.abs(eind2.uur - 9.5) < 0.3, 'en de volgende ochtend', `${eind2.uur.toFixed(2)} uur`);

// ------------------------------------------------------------------ 7. keuze 1: ruilen
kop('keuze 1: ruilen');
const ruil = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__opFase('keuze', 0);
  window.__stap(4); window.__klik();
  const faseKeuze = v.fase;
  v.kiesHuis(1); window.__klik();
  window.__tot('brugFilm', 12);
  window.__stap(Math.ceil(17 / 0.05)); window.__klik();
  const I = v.inval, r = I.brugPunt(I.S.ruit, 0);
  g.player.wapenUit = true;
  window.__zet(r.x, r.z, g.player.pos.y);
  window.__stap(2); v.toets(); window.__stap(2);
  const t = I.brugPunt(I.S.ruit - 6, 0);
  window.__zet(t.x, t.z, g.player.pos.y);
  window.__stap(2); window.__klik();
  const kijken = window.__tot('vrij', 25);
  const schriftKwijt = v.inval.schriftKwijt;
  // Johan loopt naar je toe, Bouwman stapt in en rijdt weg
  const namen = new Set();
  let wegGereden = false;
  for (let i = 0; i < 700 && v.fase !== 'naarWiekenB'; i++) {
    g.player.health = 100; v.update(0.05);
    if (!document.getElementById('dialoog').hidden) { namen.add(document.getElementById('dialoogTekst').textContent); v.toets(); }
    if (v.inval.vlucht && v.inval.vlucht.s > 20) wegGereden = true;
  }
  const fase = v.fase;
  const geld0 = v.geld;
  const d = v.inval.wiekenDeur;
  window.__zet(d.x + 2, d.z + 2);
  window.__stap(4); window.__klik();
  return { faseKeuze, kijken, schriftKwijt, fase, wegGereden, ronald: [...namen].some(t => t === 'Ronald.'),
    verdiend: v.geld - geld0, klaar: v.inval.klaar, keus: v.inval.keus };
});
ok(ruil.faseKeuze === 'keuze', 'weer bij de Wieken, en de keuze', ruil.faseKeuze);
ok(ruil.kijken && ruil.schriftKwijt, 'de ruil: Bouwman heeft het schrift');
ok(ruil.wegGereden && ruil.ronald && ruil.fase === 'naarWiekenB', 'Bouwman rijdt weg, Johan is vrij en noemt Ronald', ruil.fase);
ok(ruil.verdiend === 1000 && ruil.klaar && ruil.keus === 1, 'MISSIE GESLAAGD: € 1.000', `+ € ${ruil.verdiend}`);

// ------------------------------------------------------------------ 8. ontsnapt, en mislukken
kop('ontsnapt, en mislukken');
const ontsnapt = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__opFase('brugFilm', 2);
  window.__stap(Math.ceil(17 / 0.05)); window.__klik();
  const I = v.inval, r = I.brugPunt(I.S.ruit, 0);
  g.player.wapenUit = true;
  window.__zet(r.x, r.z, g.player.pos.y);
  window.__stap(2); v.toets(); window.__stap(2);
  const t = I.brugPunt(I.S.ruit - 6, 0);
  window.__zet(t.x, t.z, g.player.pos.y);
  window.__stap(2); window.__klik();
  window.__tot('achtervolging', 30);
  // jij blijft op de brug staan: hij rijdt weg
  const achter = v.fase;
  const gehaald = window.__tot('naarWiekenB', 60);
  const geld0 = v.geld;
  const d = v.inval.wiekenDeur;
  window.__zet(d.x + 2, d.z + 2);
  window.__stap(4); window.__klik();
  return { achter, gehaald, telefoon: v.inval.telefoon, verdiend: v.geld - geld0 };
});
ok(ontsnapt.achter === 'achtervolging' && ontsnapt.gehaald && !ontsnapt.telefoon, 'je laat hem gaan: hij is weg, zonder telefoon', `${ontsnapt.achter}, ${ontsnapt.gehaald}, ${ontsnapt.telefoon}`);
ok(ontsnapt.verdiend === 2000, 'dan € 2.000', `+ € ${ontsnapt.verdiend}`);
const mis = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  const uit = {};
  const misluktNa = (f) => {
    window.__meld = [];
    f();
    const m = window.__meld.find(x => x.startsWith('MISSIE MISLUKT'));
    window.__stap(90);           // de mislukking loopt af
    return m || null;
  };
  const opBrug = (keus) => {
    window.__opFase('brugFilm', keus);
    window.__stap(Math.ceil(17 / 0.05)); window.__klik();
  };
  uit.schot = misluktNa(() => {
    opBrug(1);
    const I = v.inval, r = I.brugPunt(I.S.ruit, 0);
    g.player.wapenUit = true;
    window.__zet(r.x, r.z, g.player.pos.y);
    window.__stap(2); v.toets(); window.__stap(2);
    v.schotGehoord(r.x, r.z);
    window.__stap(2);
  });
  uit.wapen = misluktNa(() => {
    opBrug(1);
    const I = v.inval, r = I.brugPunt(I.S.ruit - 4, 0);
    window.__zet(r.x, r.z, g.player.pos.y);
    g.player.wapenUit = false;
    window.__stap(Math.ceil(5 / 0.05));
    g.player.wapenUit = true;
  });
  uit.wrak = misluktNa(() => {
    window.__opFase('afschudden');
    // opnieuw vanaf het telefoontje, voor de deur: snel door tot in de auto
    window.__stap(40); window.__klik(); window.__stap(2);
    const d = v.inval.merkPlek;
    window.__zet(d[0].x + 0.4, d[0].z); window.__stap(2); window.__klik(); v.toets(); window.__stap(2); window.__klik();
    window.__zet(d[1].x + 0.4, d[1].z); window.__stap(2); v.toets(); window.__stap(2); window.__klik();
    const nav = g.hud.nav;
    window.__zet(nav.doel[0] + 1.5, nav.doel[1] + 1.5); window.__stap(6);
    const sp = g.player.pos;
    let auto = null, ad = Infinity;
    for (const c of g.vehicles.cars) { if (!c.driveable || c.wrak) continue; const dd = Math.hypot(c.x - sp.x, c.z - sp.z); if (dd < ad) { ad = dd; auto = c; } }
    g.vehicles.maakBestuurbaar(auto); g.player.inCar = auto; window.__stap(2);
    for (let i = 0; i < 200 && !v.inval.film; i++) window.__stap(1);
    window.__stap(Math.ceil(9 / 0.05)); window.__klik();
    uit.wrakFase = v.fase;
    g.vehicles.laatOntploffen(auto);
    window.__stap(3);
  });
  return uit;
});
ok(/Johan is geraakt/.test(mis.schot || ''), 'schieten tijdens de ruil: Johan is geraakt', mis.schot || 'geen melding');
ok(/vertrouwt het niet/.test(mis.wapen || ''), 'het wapen te lang in je hand: Bouwman vertrouwt het niet', mis.wapen || 'geen melding');
ok(mis.wrakFase === 'afschudden' && /Mark is geraakt/.test(mis.wrak || ''), 'de auto total loss met Mark erin', `${mis.wrakFase}: ${mis.wrak || 'geen melding'}`);

// ------------------------------------------------------------------ 9. opslaan en laden
kop('opslaan en laden');
const opslag = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  const s = v.bewaar(); s.invalKlaar = true; s.invalKeus = 1; s.schriftKwijt = true; s.invalTelefoon = false; s.missie = 'klaar'; s.fase = 'klaar'; s.volgende = null;
  v.herstel(s);
  const I = v.inval;
  const s2 = v.bewaar();
  return { klaar: I.klaar, keus: I.keus, kwijt: I.schriftKwijt, bewaard: s2.invalKlaar === true && s2.invalKeus === 1 && s2.schriftKwijt === true, volgende: v.volgendeMissie };
});
ok(opslag.klaar && opslag.keus === 1 && opslag.kwijt && opslag.bewaard, 'de afloop en de keuze gaan mee in de opslag');
ok(!opslag.volgende || opslag.volgende.naam !== 'inval', 'en daarna begint De inval niet opnieuw', JSON.stringify(opslag.volgende));

console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
await browser.close();
process.exit(fouten ? 1 : 0);
