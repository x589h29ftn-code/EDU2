/*
 Stap 124: de drone en de beleving van de wereld (5 okt 2026: "Drone kost 1000 euro en idd jouw bediening
 ed. Verder geen politiester voor bediening. Voeg nummer 1, 3, 4, 5 toe").

   node tools/server.mjs 8123 &   node tools/dronetest.mjs [poort]   (npm run dronetest)

 1. De drone: te koop voor € 1.000 bij Tinga State, bewaard in de opslag, B laat hem opstijgen en Erik
    blijft staan, vliegen, niet door een gebouw, de grenzen (150 m hoog, 100 m van de rand, 800 m van
    Erik) met OUT OF RANGE en tien tellen, neerstorten en kwijt, terug op tijd, de accu, een foto,
    nooit een ster, niet in een auto of met de politie achter je aan.
 2. Vogels: eenden en zwanen in het water (en blijven erin), meeuwen boven de haven van IJlst, de
    eend en de kikker bij de geluiden, krekels 's nachts.
 3. De nacht: sterren en maan, rode knipperlichten op de hoge daken en de mast, ochtendmist.
 4. Leven in de wijk: joggers, de vuilniswagen 's ochtends, het terras bij de Poiesz.
 5. Autoschade die blijft: een deuk na een klap, een barst na een harde klap, een kogelgat, overspuiten
    haalt het weg; remsporen liggen er een minuut.
 6. Geen nieuwe shaders tijdens het spelen (stap 83).
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
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 560 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(() => {
  const g = window.__game;
  localStorage.removeItem('tinga.spel.v1'); localStorage.removeItem('tinga.checkpoint.v1');
  document.getElementById('overlay').style.display = 'none';
  window.__autoplay = true; window.__geenDownload = true;
  g.player.active = false;
  g.sfeer.uur = 13; g.sfeer.weer = 'helder';
});

// ------------------------------------------------------------------ 6 (voor): de shaders vooraf
// wat `startGame` doet vóór het spelen (zoals tools/vloeiendtest.mjs): het reliëf af, de vervaagshaders en de avond
await page.evaluate(() => window.__game.voorbereidSpel());
// één keer dag en één keer nacht: bij zonsondergang mag het aantal lampen veranderen (stap 83), en dan
// vertaalt three wat het voor de nacht nodig heeft. Daarna mag er door de drone, de vogels en de schade niets bij.
const progVoor = await page.evaluate(() => {
  const g = window.__game;
  g.renderer.render(g.scene, g.camera);
  g.sfeer.uur = 1; g.renderer.render(g.scene, g.camera);
  g.sfeer.uur = 6; g.renderer.render(g.scene, g.camera);
  g.sfeer.uur = 13; g.renderer.render(g.scene, g.camera);
  return g.renderer.info.programs.length;
});

// ------------------------------------------------------------------ 6. geen nieuwe shaders
kop('geen nieuwe shaders tijdens het spelen (hier, vóór de rest: de proef vliegt daarna tot de rand van de wereld)');
const prog = await page.evaluate(async () => {
  const g = window.__game, P = g.player, D = g.drone;
  const s = g.start || { x: 10.7, z: -7.1 };
  const r = () => { g.scene.updateMatrixWorld(true); g.renderer.render(g.scene, g.camera); };
  // overdag, met de vogels, de drone en een auto met schade in beeld
  P.pos.set(s.x, 0, s.z); P.drone = true; D.accu = 300;
  g.droneToets(); for (let i = 0; i < 10; i++) D.update(0.05);
  const car = g.vehicles.voegToe({ x: s.x + 8, z: s.z - 8, yaw: 0.4, soort: 'hatch', kleur: 0x3a7a3a });
  g.autoschade.botsing(car, 16, true);
  g.vogels.vulAan(s.x, s.z);
  r();
  // 's nachts: sterren, knipperlichten, het lampje van de drone
  g.sfeer.uur = 1; g.knipper.update(0.1, true); D.update(0.05); r();
  // de ochtend
  g.sfeer.uur = 6; r();
  D.terug(); g.vehicles.verwijder(car);
  g.sfeer.uur = 13; P.drone = false;
  return g.renderer.info.programs.length;
});
ok(prog === progVoor, 'evenveel shaderprogramma\'s als bij het begin', `${progVoor} → ${prog}`);

// ------------------------------------------------------------------ 1. de drone
kop('de drone kopen bij Tinga State');
const koop = await page.evaluate(() => {
  const g = window.__game, P = g.player, b = g.boerderij, v = g.verhaal;
  P.pos.set(b.plekken.toonbank.x, 0, b.plekken.toonbank.z);
  v.verdien(3000);
  b.update(0.1, false);
  const artikel = b.schap.find(a => a.sleutel === 'drone');
  const kaartje = [...document.querySelectorAll('#schap .kaart')].some(k => /drone/.test(k.textContent) && /1000/.test(k.textContent));
  const voor = v.geld;
  const nr = b.schap.findIndex(a => a.sleutel === 'drone') + 1;
  b.toets(String(nr));
  const na = v.geld;
  b.update(0.1, false);
  const nogInSchap = b.schap.some(a => a.sleutel === 'drone');
  const inBezit = b.inBezit.includes('drone');
  // de opslag
  g.bewaar && g.bewaar();
  return { artikel, kaartje, betaald: voor - na, heeft: P.drone, nogInSchap, inBezit };
});
ok(koop.artikel && koop.artikel.prijs === 1000, 'de drone ligt in het schap voor € 1.000', JSON.stringify(koop.artikel));
ok(koop.kaartje, 'met een kaartje in beeld');
ok(koop.betaald === 1000 && koop.heeft === true, 'kopen kost € 1.000 en dan heb je hem', `betaald ${koop.betaald}`);
ok(!koop.nogInSchap && koop.inBezit, 'daarna staat hij grijs bij wat je al hebt');

const opslag = await page.evaluate(async () => {
  const g = window.__game, P = g.player;
  const O = await import('/js/opslag.js');
  O.bewaarSpel({ player: P, sfeer: g.sfeer, vehicles: g.vehicles, verhaal: g.verhaal, garage: g.garage });
  const ruw = JSON.parse(localStorage.getItem('tinga.spel.v1'));
  P.drone = false;
  O.laadSpel({ player: P, sfeer: g.sfeer, vehicles: g.vehicles, verhaal: g.verhaal, garage: g.garage });
  return { bewaard: ruw.speler.drone, terug: P.drone };
});
ok(opslag.bewaard === true && opslag.terug === true, 'de opslag onthoudt de drone', JSON.stringify(opslag));

kop('opstijgen, vliegen, Erik blijft staan, nooit een ster');
const vlucht = await page.evaluate(async () => {
  const g = window.__game, P = g.player, D = g.drone;
  const s = g.start || { x: 10.7, z: -7.1 };
  g.politie.reset();
  P.inCar = null; P.binnen = false; P.zit = false;
  P.pos.set(s.x, 0, s.z); P.yaw = 0.3; P.pitch = 0;
  const erik = { x: P.pos.x, z: P.pos.z };
  const kon = g.droneToets();
  const scherm = !document.getElementById('droneScherm').hidden;
  const tik = (n, keys = {}) => { P.keys = keys; for (let i = 0; i < n; i++) { D.update(0.05); g.politie.update(0.05); } P.keys = {}; };
  tik(10);
  tik(60, { Space: true });             // drie tellen omhoog
  const h1 = D.hoogte;
  D.update(0.05);
  const cam1 = g.camera.position.clone(), dp1 = D.pos.clone();
  tik(100, { KeyW: true });             // vijf tellen vooruit
  const af = D.afstand;
  const cam2 = g.camera.position.clone();
  const erikNu = { x: P.pos.x, z: P.pos.z };
  tik(40, { KeyW: true, ShiftLeft: true });
  const snel = D.afstand - af;
  const waarden = document.querySelector('#droneScherm .waarden').textContent;
  return { kon, scherm, h1, camVolgt: Math.abs(cam1.y - dp1.y) < 0.3 && Math.hypot(cam1.x - dp1.x, cam1.z - dp1.z) < 0.01, camDy: cam1.y - dp1.y, af, verplaatst: Math.hypot(cam2.x - cam1.x, cam2.z - cam1.z),
    erikStil: Math.hypot(erikNu.x - erik.x, erikNu.z - erik.z), snel, waarden, ster: g.politie.ster, inDrone: P.inDrone, mag: P.magSchieten() };
});
ok(vlucht.kon && vlucht.scherm && vlucht.inDrone, 'B laat hem opstijgen, met het dronebeeld');
ok(vlucht.h1 > 10 && vlucht.camVolgt, 'spatie: omhoog, en de camera is van de drone', `${vlucht.h1.toFixed(1)} m, camera ${vlucht.camDy.toFixed(2)} m ernaast`);
ok(vlucht.verplaatst > 30 && vlucht.af > 30, 'W: vooruit', `${vlucht.verplaatst.toFixed(1)} m in 5 s, ${vlucht.af.toFixed(0)} m van Erik`);
ok(vlucht.snel > 40, 'shift: sneller', `${vlucht.snel.toFixed(1)} m in 2 s`);
ok(vlucht.erikStil < 0.01, 'Erik blijft staan met de afstandsbediening');
ok(/H \d+ m/.test(vlucht.waarden) && /D \d+ m/.test(vlucht.waarden) && /ACCU \d+%/.test(vlucht.waarden), 'hoogte, afstand en accu in beeld', vlucht.waarden);
ok(vlucht.ster === 0, 'geen politiester');
ok(vlucht.mag === false, 'met de afstandsbediening schiet je niet');

kop('niet door een gebouw en niet door de grond');
const muur = await page.evaluate(async () => {
  const g = window.__game, P = g.player, D = g.drone;
  const W = await import('/js/world.js');
  const { KAART } = await import('/js/kaartwereld.js');
  // het hoogste pand: 28 m
  const pand = KAART.panden.reduce((a, b) => (b.nok > a.nok ? b : a));
  const cx = pand.voet.reduce((s, q) => s + q[0], 0) / pand.voet.length, cz = pand.voet.reduce((s, q) => s + q[1], 0) / pand.voet.length;
  // de drone 40 m ten zuiden, op 10 m hoog, en dan naar het midden vliegen
  // een punt ten zuiden van het pand dat vrij is, op 10 m hoog, en dan recht naar het midden vliegen
  let zuid = 30;
  const vrij = (x, z) => { const [ux, uz] = W.resolveCollisions(x, z, 0.6, 9.5); return Math.hypot(ux - x, uz - z) < 0.01; };
  while (!vrij(cx, cz + zuid) && zuid < 150) zuid += 5;
  D.pos.set(cx, 10, cz + zuid);
  P.yaw = 0; P.pitch = 0;               // −z: naar het noorden, naar het pand
  P.keys = { KeyW: true };
  let binnen = 0, laatste = null;
  for (let i = 0; i < 240; i++) {
    D.update(0.05);
    const [x, z] = W.resolveCollisions(D.pos.x, D.pos.z, 0.3, 9.5);
    if (Math.hypot(x - D.pos.x, z - D.pos.z) > 0.05) binnen++;
    if (i === 200) laatste = D.pos.clone();
  }
  P.keys = {};
  const binnenPand = binnen > 0;
  const stil = Math.hypot(D.pos.x - laatste.x, D.pos.z - laatste.z);
  const afMidden = Math.hypot(D.pos.x - cx, D.pos.z - cz);
  // en omlaag tot de grond
  P.keys = { KeyC: true };
  for (let i = 0; i < 120; i++) D.update(0.05);
  P.keys = {};
  const opGrond = D.hoogte;
  return { nok: pand.nok, afMidden, binnenPand, opGrond, stil, zuid, binnen };
});
// (tegen een muur glijdt hij langs de gevel, zoals de speler: hij hoeft niet stil te staan, wel buiten het pand te blijven)
ok(!muur.binnenPand && muur.afMidden > 3 && muur.afMidden < muur.zuid - 1, 'een gebouw houdt hem tegen (hij glijdt erlangs)', `gestart ${muur.zuid} m ten zuiden, gestopt op ${muur.afMidden.toFixed(1)} m van het midden van een pand van ${muur.nok} m (${muur.binnen} beelden in het pand, ${muur.stil.toFixed(2)} m in de laatste 2 s)`);
ok(muur.opGrond >= 0.45, 'en de grond ook', `${muur.opGrond.toFixed(2)} m boven de grond`);

kop('de grenzen: OUT OF RANGE, vijftien tellen, op tijd terug');
const grens = await page.evaluate(async () => {
  const g = window.__game, P = g.player, D = g.drone;
  const s = g.start || { x: 10.7, z: -7.1 };
  const uit = {};
  // te hoog: omhoog tot boven de 150 m
  D.pos.set(P.pos.x + 20, 140, P.pos.z);
  P.keys = { Space: true, ShiftLeft: true };
  let n = 0;
  while (D.aftel === null && n++ < 400) D.update(0.05);
  P.keys = {};
  uit.hoogBij = D.hoogte;
  uit.aftel = D.aftel;
  const el = document.querySelector('#droneScherm .bereik');
  uit.tekst = el.hidden ? '' : el.textContent;
  uit.ruis = D.ruis;
  // vijf tellen boven de grens, dan zakken: het aftellen stopt
  for (let i = 0; i < 60; i++) D.update(0.05);
  P.keys = { KeyC: true, ShiftLeft: true };
  for (let i = 0; i < 40; i++) D.update(0.05);
  P.keys = {};
  uit.terugBinnen = D.aftel === null && D.actief;
  uit.hoogNa = D.hoogte;
  // de rand: 60 m van de westrand
  const { KAART } = await import('/js/kaartwereld.js');
  D.pos.set(KAART.gebied.x0 + 60, 30, (KAART.gebied.z0 + KAART.gebied.z1) / 2);
  uit.rand = D.buiten();
  // te ver van Erik
  D.pos.set(P.pos.x + 820, 30, P.pos.z);
  uit.ver = D.buiten();
  D.pos.set(P.pos.x + 30, 30, P.pos.z);
  uit.binnen = D.buiten();
  // nu buiten blijven: na tien tellen is het signaal weg
  D.pos.set(P.pos.x + 830, 30, P.pos.z);
  D.update(0.05);
  let t = 0;
  // (stap 127: buiten bereik drijft hij vanzelf terug; wie buiten wil blijven, houdt hem daar)
  while (D.actief && t < 25) { if (!D.verloren) D.pos.x = P.pos.x + 830; D.update(0.05); t += 0.05; }
  uit.kwijtNa = t;
  uit.weg = !D.actief && P.drone === false && D.reden === 'kwijt';
  uit.melding = document.getElementById('missie') ? document.getElementById('missie').textContent : '';
  uit.inDrone = P.inDrone;
  uit.ster = g.politie.ster;
  uit.schap = (() => { const b = g.boerderij; P.pos.set(b.plekken.toonbank.x, 0, b.plekken.toonbank.z); return b.schap.some(a => a.sleutel === 'drone'); })();
  P.pos.set(s.x, 0, s.z);
  uit.zonder = g.waaromGeenDrone();
  return uit;
});
ok(grens.aftel !== null && grens.hoogBij > 149 && grens.hoogBij < 152, 'boven 150 m begint het aftellen', `bij ${grens.hoogBij.toFixed(1)} m, ${grens.aftel && grens.aftel.toFixed(1)} s`);
ok(/OUT OF RANGE/.test(grens.tekst) && grens.ruis > 0.5, 'OUT OF RANGE in beeld, met ruis', `${grens.tekst}, ruis ${grens.ruis.toFixed(2)}`);
ok(grens.terugBinnen && grens.hoogNa < 150, 'op tijd terug: het aftellen stopt', `${grens.hoogNa.toFixed(1)} m`);
ok(grens.rand === 'te dicht bij de rand', 'binnen 100 m van de rand van de wereld: buiten bereik', grens.rand);
ok(grens.ver === 'te ver van Erik' && grens.binnen === null, 'verder dan 800 m van Erik: buiten bereik', `${grens.ver} / ${grens.binnen}`);
ok(grens.weg && grens.kwijtNa > 14.9 && grens.kwijtNa < 17, 'vijftien tellen buiten bereik: neergestort en kwijt (stap 127; was tien)', `na ${grens.kwijtNa.toFixed(1)} s`);
ok(!grens.inDrone && grens.ster === 0, 'terug bij Erik, en nog steeds geen ster');
ok(grens.schap, 'de drone staat weer in het schap');
ok(/geen drone/.test(grens.zonder || ''), 'zonder drone zegt B dat', grens.zonder);

kop('de accu, E, een foto, niet in een auto, niet met sterren');
const rest = await page.evaluate(async () => {
  const g = window.__game, P = g.player, D = g.drone;
  const uit = {};
  P.drone = true;
  D.accu = 300;
  g.droneToets();
  for (let i = 0; i < 10; i++) D.update(0.05);
  // een foto
  const url = g.droneFoto();
  uit.foto = typeof url === 'string' && url.startsWith('data:image/png') && url.length > 20000;
  uit.fotos = D.fotos;
  // de accu leeg: hij komt vanzelf terug
  D.accu = 0.2;
  for (let i = 0; i < 10; i++) D.update(0.05);
  uit.accuTerug = !D.actief && D.reden === 'accu' && P.drone === true;
  uit.accuLeeg = g.waaromGeenDrone();
  // opladen: 90 s van leeg tot vol
  for (let i = 0; i < 950; i++) D.update(0.1);
  uit.vol = D.accu;
  // E haalt hem terug
  g.droneToets();
  uit.weerOp = D.actief;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
  uit.eTerug = !D.actief;
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' }));
  // B haalt hem ook terug
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB' }));
  uit.bOp = D.actief;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB' }));
  uit.bTerug = !D.actief;
  // geraakt worden: hij komt terug
  g.droneToets(); D.update(0.05);
  P.health -= 10; D.update(0.05);
  uit.geraakt = !D.actief && D.reden === 'geraakt';
  P.health = 100;
  // in een auto
  const auto = g.vehicles.cars.find(c => c.driveable && !c.wrak);
  P.inCar = auto;
  uit.inAuto = g.waaromGeenDrone();
  P.inCar = null;
  // met sterren
  g.politie.zetSter(2);
  uit.sterren = g.waaromGeenDrone();
  g.politie.reset();
  uit.camTerug = Math.abs(g.camera.position.y - (P.pos.y + P.eye)) < 2;
  return uit;
});
ok(rest.foto && rest.fotos >= 1, 'F maakt een foto zonder HUD (png)');
ok(rest.accuTerug && /accu/i.test(rest.accuLeeg || ''), 'accu leeg: terug naar Erik, en eerst opladen', rest.accuLeeg);
ok(rest.vol > 299, 'in anderhalve minuut weer vol', rest.vol.toFixed(1));
ok(rest.weerOp && rest.eTerug, 'E haalt hem terug');
ok(rest.bOp && rest.bTerug, 'B laat hem op en haalt hem terug');
ok(rest.geraakt, 'wordt Erik geraakt, dan komt de drone terug');
ok(/uitstappen/i.test(rest.inAuto || ''), 'niet vanuit een auto', rest.inAuto);
ok(/politie/i.test(rest.sterren || ''), 'niet met de politie achter je aan', rest.sterren);

// ------------------------------------------------------------------ 2. vogels
kop('eenden en zwanen op het water, meeuwen boven IJlst');
const vogels = await page.evaluate(async () => {
  const g = window.__game, V = g.vogels;
  const W = await import('/js/world.js');
  const { LIGPLAATSEN } = await import('/js/boot.js');
  const geeuw = LIGPLAATSEN[0];
  V.vulAan(geeuw.x, geeuw.z);
  const groepen = V.groepen;
  const dieren = groepen.flatMap(gr => gr.dieren);
  const inWater = dieren.filter(d => W.vaarbaar(d.x, d.z)).length;
  // een minuut later: nog steeds in het water, en ze hebben bewogen
  for (let i = 0; i < 600; i++) V.update(0.1, geeuw.x, geeuw.z);
  const later = V.groepen.flatMap(gr => gr.dieren);
  const nogInWater = later.filter(d => W.vaarbaar(d.x, d.z)).length;
  const bewogen = later.filter((d, i) => dieren[i] && Math.hypot(d.x - dieren[i].x, d.z - dieren[i].z) > 0.5).length;
  // de meeuwen bij IJlst
  const H = { x: -1282, z: 1106 };
  V.update(0.1, H.x, H.z);
  const meeuwen = V.meeuwen;
  const plekken = [];
  for (let i = 0; i < meeuwen; i++) plekken.push(V.meeuwPlek(i));
  const hoog = plekken.map(p => p.y), af = plekken.map(p => Math.hypot(p.x - H.x, p.z - H.z));
  V.update(0.1, 0, 0);
  const verWeg = V.meeuwen;
  return { groepen: groepen.length, dieren: dieren.length, inWater, nogInWater, bewogen, eenden: V.eenden, zwanen: V.zwanen, meeuwen,
    minH: Math.min(...hoog), maxH: Math.max(...hoog), maxAf: Math.max(...af), verWeg };
});
ok(vogels.groepen >= 5 && vogels.dieren >= 12, 'groepjes eenden en zwanen rond de Geeuw', `${vogels.groepen} groepjes, ${vogels.eenden} eenden, ${vogels.zwanen} zwanen`);
ok(vogels.inWater === vogels.dieren, 'allemaal in het water', `${vogels.inWater}/${vogels.dieren}`);
ok(vogels.nogInWater === vogels.dieren && vogels.bewogen > vogels.dieren / 2, 'een minuut later nog steeds, en ze peddelen rond', `${vogels.nogInWater} in het water, ${vogels.bewogen} bewogen`);
ok(vogels.meeuwen === 14 && vogels.minH > 6 && vogels.maxH < 30 && vogels.maxAf < 80, 'veertien meeuwen boven de haven van IJlst', `${vogels.minH.toFixed(0)}–${vogels.maxH.toFixed(0)} m hoog, hoogstens ${vogels.maxAf.toFixed(0)} m van de haven`);
ok(vogels.verWeg === 0, 'ver van IJlst geen meeuwen');

const geluid = await page.evaluate(() => {
  const G = window.__game.geluid;
  const soorten = G.sfeerSoorten;
  return { eend: soorten.includes('eend'), kikker: soorten.includes('kikker') };
});
ok(geluid.eend && geluid.kikker, 'de eend overdag en de kikker \'s nachts bij de geluiden');

// ------------------------------------------------------------------ 3. de nacht
kop('sterren, maan, knipperlichten, ochtendmist');
const nacht = await page.evaluate(async () => {
  const g = window.__game, S = g.sfeer, U = g.skyUniforms || null;
  const uit = {};
  const sky = () => { let u = null; g.scene.traverse(o => { if (!u && o.material && o.material.uniforms && o.material.uniforms.nacht) u = o.material.uniforms; }); return u; };
  const u = sky();
  S.weer = 'helder';
  S.uur = 1; uit.nacht = u.nacht.value; uit.maan = u.maanDir.value.y;
  S.uur = 13; uit.dag = u.nacht.value;
  S.uur = 1; S.weer = 'bewolkt'; uit.bewolkt = u.nacht.value;
  S.weer = 'regen'; uit.regen = u.nacht.value;
  S.weer = 'helder';
  // ochtendmist
  S.uur = 6; uit.mist6 = S.mist; uit.far6 = g.scene.fog.far; uit.near6 = g.scene.fog.near;
  S.uur = 7.75; uit.mist745 = S.mist;
  S.uur = 12; uit.mist12 = S.mist; uit.far12 = g.scene.fog.far;
  S.weer = 'regen'; S.uur = 6; uit.mistRegen = S.mist; S.weer = 'helder';
  // knipperlichten
  const K = g.knipper;
  uit.lampjes = K.plekken.length;
  const { KAART } = await import('/js/kaartwereld.js');
  uit.opDak = K.plekken.every(p => p.y > 11);
  S.uur = 1;
  const standen = new Set();
  for (let i = 0; i < 50; i++) { K.update(0.1, true); standen.add(K.aan); }
  uit.knippert = standen.size === 2 && K.mesh.visible;
  K.update(0.1, false);
  uit.dagUit = !K.mesh.visible;
  const mast = g.studio.topLampMat;
  const kleuren = new Set();
  for (let i = 0; i < 30; i++) { K.update(0.1, true); kleuren.add(mast.color.getHexString()); }
  uit.mastKnippert = kleuren.size === 2;
  S.uur = 13;
  return uit;
});
ok(nacht.nacht > 0.95 && nacht.dag === 0, 'sterren \'s nachts, niet overdag', `${nacht.nacht.toFixed(2)} / ${nacht.dag}`);
ok(nacht.bewolkt < 0.3 && nacht.regen === 0, 'achter de wolken bijna niets, bij regen niets', `${nacht.bewolkt.toFixed(2)} / ${nacht.regen}`);
ok(nacht.maan > 0.2, 'de maan staat boven de horizon', nacht.maan.toFixed(2));
ok(nacht.mist6 > 0.95 && nacht.far6 < 400 && nacht.near6 < 40, 'om 6 uur dikke ochtendmist', `zicht ${nacht.near6.toFixed(0)}–${nacht.far6.toFixed(0)} m`);
ok(nacht.mist745 < 0.35 && nacht.mist12 === 0 && nacht.far12 === 900, 'om kwart voor acht bijna weg, \'s middags niets', `${nacht.mist745.toFixed(2)} / ${nacht.far12}`);
ok(nacht.mistRegen === 0, 'bij regen geen ochtendmist');
ok(nacht.lampjes >= 10 && nacht.opDak, 'rode lampjes op de hoge daken', `${nacht.lampjes}`);
ok(nacht.knippert && nacht.dagUit, '\'s nachts knipperen ze, overdag zijn ze uit');
ok(nacht.mastKnippert, 'het lampje op de mast van Radio Tinga knippert mee');

// ------------------------------------------------------------------ 4. leven in de wijk
kop('joggers, de vuilniswagen, het terras');
const wijk = await page.evaluate(async () => {
  const g = window.__game, L = g.leven, N = g.npcs;
  const W = await import('/js/world.js');
  const { KAART } = await import('/js/kaartwereld.js');
  const uit = {};
  const joggers = N.people.filter(p => p.jogt);
  uit.joggers = joggers.length;
  uit.snel = Math.min(...joggers.map(p => p.speed));
  uit.geenFiets = joggers.every(p => !p.fietst && !p.hond);
  for (let i = 0; i < 300; i++) N.update(0.1, i * 0.1, 0, 0);
  uit.pauze = joggers.filter(p => p.pause > 0 && !p.paniek).length;
  // de vuilniswagen
  const s = g.start || { x: 10.7, z: -7.1 };
  const sp = { x: s.x, z: s.z };
  uit.start = L.startVuilnis(sp, { zeker: true });
  const v0 = L.vuilnis;
  uit.vuilWas = { reden: v0.reden, fase: v0.fase, wagen: !!v0.wagen, inCars: v0.wagen ? g.vehicles.cars.indexOf(v0.wagen) : -2, soort: v0.wagen && v0.wagen.soort, hp: v0.wagen && v0.wagen.hp, wrak: v0.wagen && !!v0.wagen.wrak };
  uit.inCars = g.vehicles.cars.includes(v0.wagen);
  uit.truck = v0.wagen && v0.wagen.soort === 'vuilnis' && !!v0.wagen.mesh.userData.vuilnis;
  const ziet = () => true;
  let stil = 0;
  for (let i = 0; i < 900; i++) { L.update(0.1, sp, ziet, 8); if (L.vuilnis.stil) stil++; }
  const v1 = L.vuilnis;
  uit.gereden = v1.s; uit.stops = v1.stops; uit.stil = stil * 0.1;
  const p = v1.wagen ? { x: v1.wagen.x, z: v1.wagen.z } : null;
  // (tot het wegvak, niet tot een hoekpunt: op een lange rechte weg liggen die verder dan 12 m uit elkaar; stap 127)
  const totVak = (a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.z - a[1]) * dz) / L2)); return Math.hypot(a[0] + dx * t - p.x, a[1] + dz * t - p.z); };
  uit.opWeg = p ? (KAART.wegassen || []).some(a => a.drive && a.pts.some((q, i) => i > 0 && totVak(a.pts[i - 1], q) < 8)) : false;
  L.vuilnisWeg();
  // buiten de tijden komt hij niet
  for (let i = 0; i < 6000; i++) L.update(0.1, sp, () => false, 13);
  uit.middag = L.vuilnis.fase;
  // het terras
  const T = L.terras;
  uit.plek = !!T.plek; uit.gasten = T.gasten;
  if (T.plek) {
    const [x, z] = W.resolveCollisions(T.plek.x, T.plek.z, 1.2);
    uit.vrij = Math.hypot(x - T.plek.x, z - T.plek.z) < 0.01;
    uit.wegAf = Math.min(...(KAART.wegassen || []).filter(a => a.drive).flatMap(a => a.pts.map(q => Math.hypot(q[0] - T.plek.x, q[1] - T.plek.z))));
    const deur = g.supermarkt.ingangen[0].deur;
    uit.deurAf = Math.hypot(deur.x - T.plek.x, deur.z - T.plek.z);
  }
  L.update(0.1, sp, ziet, 13); uit.middagAan = L.terras.aan;
  L.update(0.1, sp, ziet, 22); uit.avondAan = L.terras.aan;
  return uit;
});
ok(wijk.joggers >= 4 && wijk.snel >= 2.7 && wijk.geenFiets, 'joggers op straat, hard en zonder fiets of hond', `${wijk.joggers}, minstens ${wijk.snel.toFixed(1)} m/s`);
ok(wijk.pauze === 0, 'een jogger staat niet stil');
ok(wijk.start && wijk.inCars && wijk.truck, 'de vuilniswagen: de gele DAF tussen de auto\'s (je botst ertegen)', JSON.stringify(wijk.vuilWas));
ok(wijk.gereden > 100 && wijk.stops >= 2 && wijk.stil >= 8, 'hij rijdt en stopt om de kliko\'s te legen', `${wijk.gereden.toFixed(0)} m, ${wijk.stops} keer gestopt, ${wijk.stil.toFixed(0)} s stil`);
ok(wijk.opWeg, 'op de weg');
ok(wijk.middag === 'weg', '\'s middags komt hij niet');
ok(wijk.plek && wijk.gasten === 5, 'het terras bij de Poiesz in IJlst, met vijf gasten');
ok(wijk.vrij && wijk.wegAf >= 5 && wijk.deurAf < 16, 'vrij van muren, niet op de rijbaan, naast de ingang', `${wijk.wegAf && wijk.wegAf.toFixed(1)} m van de weg, ${wijk.deurAf && wijk.deurAf.toFixed(1)} m van de deur`);
ok(wijk.middagAan && !wijk.avondAan, 'overdag staat het er, \'s avonds niet');

// ------------------------------------------------------------------ 5. autoschade
kop('schade aan auto\'s die blijft');
const schade = await page.evaluate(async () => {
  const g = window.__game, A = g.autoschade, V = g.vehicles, P = g.player;
  const THREE = await import('three');
  const uit = {};
  const s = g.start || { x: 10.7, z: -7.1 };
  const car = V.voegToe({ x: s.x + 30, z: s.z, yaw: 0, soort: 'hatch', kleur: 0x2a5aa0 });
  car.mesh.updateMatrixWorld(true);
  // een zachte tik: niets
  uit.zacht = A.botsing(car, 3, true);
  // een flinke klap van voren
  uit.klap = A.botsing(car, 9, true);
  const d = car.schade[0];
  uit.voor = d ? d.position.z < -1.2 : false;
  uit.opLak = d ? Math.abs(d.position.y - 0.6) < 0.45 : false;
  // een heel harde: ook de ruit
  uit.hard = A.botsing(car, 16, true);
  uit.aantal = car.schade.length;
  // een echte kogel op de zijkant
  const gatVoor = car.schade.length;
  P.inCar = null; P.inDrone = false;
  P.pos.set(car.x + 6, 0, car.z); P.yaw = Math.PI / 2; P.pitch = -0.05;
  P.wapens = ['pistool', 'mes']; P.wapenNr = 0; P.zetWapen('pistool'); P.ammo = 10; P.reloading = 0; P.wisselT = 0; P.vuurKlok = 0; P.binnen = false; P.vuurSlot = false;
  P.active = true; P.applyCamera();
  g.scene.updateMatrixWorld(true);
  const hp0 = car.hp;
  P.shoot();
  P.active = false;
  uit.hp = hp0 - car.hp;
  uit.gat = car.schade.length > gatVoor ? car.schade[car.schade.length - 1].userData.schade : null;
  // het blijft zitten
  for (let i = 0; i < 100; i++) V.zetNeer && 0;
  uit.blijft = car.schade.length;
  // overspuiten haalt alles weg
  V.verf(car, 0x8a1f1f);
  uit.naVerf = car.schade.length;
  let kinderen = 0; car.mesh.traverse(o => { if (o.userData && o.userData.schade) kinderen++; });
  uit.kinderen = kinderen;
  V.verwijder(car);
  return uit;
});
ok(schade.zacht === null, 'een zachte tik laat niets achter');
ok(schade.klap && schade.klap.deuk && !schade.klap.barst && schade.voor && schade.opLak, 'een flinke klap: een deuk in de neus', JSON.stringify(schade.klap));
ok(schade.hard && schade.hard.barst && schade.aantal === 3, 'een heel harde klap: ook een barst in de ruit', `${schade.aantal} stuks`);
ok(schade.hp >= 10 && (schade.gat === 'gat' || schade.gat === 'barst'), 'een kogel laat een gat of een barst achter', `hp −${schade.hp}, ${schade.gat}`);
ok(schade.naVerf === 0 && schade.kinderen === 0, 'overspuiten haalt de schade weg');

const sporen = await page.evaluate(async () => {
  const g = window.__game;
  const { werkSporenBij, sporenTeller } = await import('/js/sporen.js');
  for (let i = 0; i < 20; i++) g.vehicles.spoor(300 + i, 100, 0.4, 0.24, 0.8, 0.9);
  for (let i = 0; i < 300; i++) werkSporenBij(0.1);
  const na30 = sporenTeller();
  for (let i = 0; i < 320; i++) werkSporenBij(0.1);
  return { na30, na62: sporenTeller() };
});
ok(sporen.na30 >= 20 && sporen.na62 === 0, 'remsporen liggen er een minuut', `${sporen.na30} na 30 s, ${sporen.na62} na 62 s`);

console.log(fouten ? `\n${fouten} FOUT(EN)` : '\nalles goed');
await browser.close();
process.exit(fouten ? 1 : 0);
