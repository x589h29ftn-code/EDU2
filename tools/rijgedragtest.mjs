/*
 Stap 171: het rijgedrag van de auto van de speler — botsen met gevolg, de motor met versnellingen, de camera met de
 snelheid (js/rijgedrag.js, en `drive` in js/vehicles.js).

   node tools/server.mjs 8123 &   node tools/rijgedragtest.mjs [poort]

 Alles wordt gereden door een automaat op `vehicles.drive`, ver buiten de kaart (20 km oost): daar staat niets in de
 weg behalve de muur die de proef zelf neerzet (`addCollider`), en rijdt er geen verkeer.

 1. Frontaal tegen een muur: de snelheid na de klap laag en iets achteruit, nooit in de muur, geen draai.
 2. Schampend: hij blijft langs de muur schuiven, draait, en de draai dempt binnen een paar tellen uit.
 3. In de flank geraakt door een rijdende auto: zijwaarts weg en een draai.
 4. Tegen een stilstaande auto: hij remt hard af, de ander rolt weg, ze staan niet door elkaar.
 5. Schakelen: de versnelling loopt op met de snelheid, het toerental zakt bij opschakelen en blijft tussen stationair
    en de rode streep, de toerenteller in het interieur volgt, de toon van de motor zakt bij opschakelen.
 6. De topsnelheid is dezelfde als met het oude rijgedrag (hatchback, Ferrari, Ferrari opgevoerd).
 7. De camera: wijder op snelheid, geleidelijk en begrensd, terug bij stilstand, de 78° van de bestuurder, de trilling
    begrensd, niets in een filmbeeld.
 8. Geen nieuw shaderprogramma.
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
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  const g = window.__game;
  if (g.voorbereidSpel) await g.voorbereidSpel();
  if (g.reliëfAf) await g.reliëfAf();
  if (g.avondBelofte) await g.avondBelofte;
  const W = await import('/js/world.js');
  const R = await import('/js/rijgedrag.js');
  const A = await import('/js/audio.js');
  window.__W = W; window.__R = R; window.__A = A;
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true;
  const X0 = 20000, Z0 = 20000;
  window.__X0 = X0; window.__Z0 = Z0;
  // een auto neerzetten waar de speler in zit
  window.__auto = (soort, x, z, yaw, speler = true) => {
    const c = g.vehicles.voegToe({ x, z, yaw, soort, kleur: 0x8a8d93 });
    c.rij = yaw;
    if (speler) g.player.inCar = c;
    return c;
  };
  window.__weg = (c) => { if (c) { g.vehicles.verwijder ? g.vehicles.verwijder(c) : (c.mesh.visible = false); } if (g.player.inCar === c) g.player.inCar = null; };
  // steekt een cirkel van de auto in een botsdoos?
  window.__inMuur = (c) => {
    const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw), as = c.as || 1.4, r = c.botsRadius || 0.95;
    let diep = 0;
    for (const off of [-as, 0, as]) {
      const px = c.x + fx * off, pz = c.z + fz * off;
      const [rx, rz] = W.resolveCollisions(px, pz, r, 3.5, 0);
      diep = Math.max(diep, Math.hypot(rx - px, rz - pz));
    }
    return diep;
  };
});

// ---------- 8 (begin). shaderprogramma's ----------
const progVoor = await page.evaluate(() => {
  const g = window.__game;
  const a = window.__auto('hatch', window.__X0 - 400, window.__Z0, 0, false);
  const b = window.__auto('ferrari', window.__X0 - 404, window.__Z0, 0, false);
  for (const c of [a, b]) if (c.mesh.userData.binnen) c.mesh.userData.binnen.groep.visible = true;
  g.camera.position.set(window.__X0 - 402, 1.5, window.__Z0 + 6); g.camera.lookAt(window.__X0 - 402, 0.8, window.__Z0);
  g.camera.updateMatrixWorld(true);
  for (const c of [a, b]) if (c.mesh.userData.binnen) c.mesh.userData.binnen.update(c, 0.05);
  // met de schaduwpas erbij: de hoofdlus tekent die ook, en zijn dieptematerialen zijn geen rijgedrag
  // en de schaduwdoos bij de auto's, zoals de hoofdlus hem bij de auto van de speler zet: dan werpen ze schaduw
  g.zetSchaduwDoos(window.__X0 - 402, window.__Z0);
  g.renderer.shadowMap.needsUpdate = true;
  g.renderer.render(g.scene, g.camera);
  g.renderer.shadowMap.needsUpdate = true;
  g.renderer.render(g.scene, g.camera);
  window.__proefAutos = [a, b];
  window.__progNamen = new Set(g.renderer.info.programs.map(p => p.cacheKey));
  window.__tel = (wat) => { g.camera.position.set(window.__X0 - 402, 1.5, window.__Z0 + 6); g.camera.lookAt(window.__X0 - 402, 0.8, window.__Z0); g.camera.updateMatrixWorld(true); g.zetSchaduwDoos(window.__X0 - 402, window.__Z0); g.renderer.shadowMap.needsUpdate = true; g.renderer.render(g.scene, g.camera); const n = g.renderer.info.programs.filter(p => !window.__progNamen.has(p.cacheKey)); return wat + ':' + n.length + (n.length ? ' ' + n.map(p => p.name + ' ' + p.cacheKey.slice(0, 160).replace(/\s+/g, ' ')).join(' / ') : ''); };
  return g.renderer.info.programs.length;
});

// ---------- 1. frontaal ----------
kop('frontaal tegen een muur');
const front = await page.evaluate(() => {
  const g = window.__game, W = window.__W, X = window.__X0, Z = window.__Z0;
  // een muur van 30 m breed, een meter dik, 20 m vóór de auto (vooruit is −z)
  W.addCollider(X, Z - 20, 15, 0.5, 0, 8);
  const c = window.__auto('hatch', X, Z, 0);
  c.speed = 20;
  const dt = 0.05;
  let klap = null, diep = 0, yMin = 9, minV = 99, yaw0 = c.yaw, na = [];
  for (let i = 0; i < 80; i++) {
    g.vehicles.drive(c, i * dt < 0.4 && !klap ? { KeyW: true } : {}, dt);
    diep = Math.max(diep, window.__inMuur(c));
    yMin = Math.min(yMin, c.mesh.position.y);
    if (c.botsKracht > 0 && !klap) klap = { kracht: c.botsKracht, v: c.speed, voor: c.botsVoor, i };
    if (klap && i - klap.i <= 6) na.push(c.speed);
    if (klap) minV = Math.min(minV, c.speed);
  }
  const r = { klap, diep, yMin, minV, na, draai: Math.abs(c.yaw - yaw0), eind: c.speed, z: c.z };
  window.__weg(c);
  return r;
});
await page.evaluate(() => { window.__telLog = (window.__telLog || '') + window.__tel('front') + ' ; '; });
ok(!!front.klap && front.klap.kracht > 15, 'een klap op volle snelheid', front.klap ? `${front.klap.kracht.toFixed(1)} m/s recht op de muur` : 'geen klap');
ok(front.klap && front.klap.v < 0 && front.klap.v > -5, 'hard afgeremd en een stukje teruggekaatst', front.klap ? `${front.klap.v.toFixed(2)} m/s na de klap` : '');
ok(front.klap && front.klap.voor, 'de neus raakte (voor de deuk van js/autoschade.js)');
ok(front.diep < 0.02, 'nooit in de muur', `${(front.diep * 100).toFixed(1)} cm`);
ok(front.yMin > -0.02, 'nooit door de grond', `${front.yMin.toFixed(3)} m`);
ok(front.draai < 0.1, 'frontaal draait hij niet', `${front.draai.toFixed(3)} rad`);
ok(Math.abs(front.eind) < 0.5, 'en daarna staat hij stil', `${front.eind.toFixed(2)} m/s`);

// ---------- 2. schampend ----------
kop('schampend langs een muur');
const schamp = await page.evaluate(() => {
  const g = window.__game, W = window.__W, X = window.__X0 + 300, Z = window.__Z0;
  // een lange muur langs de z-as, rechts van de auto; hij rijdt er onder 20° naartoe
  W.addCollider(X + 6, Z - 60, 0.5, 60, 0, 8);
  const c = window.__auto('hatch', X, Z, -0.35);
  c.speed = 18;
  const dt = 0.05;
  let klap = null, diep = 0, maxTol = 0, tolNa3 = null, vNa = null, yaw0 = c.yaw;
  for (let i = 0; i < 160; i++) {
    g.vehicles.drive(c, {}, dt);
    diep = Math.max(diep, window.__inMuur(c));
    if (c.botsKracht > 0 && !klap) klap = { kracht: c.botsKracht, i, yaw: c.yaw };
    if (klap) maxTol = Math.max(maxTol, Math.abs(c.tol || 0));
    if (klap && i === klap.i + 4) vNa = c.speed;
    if (klap && i === klap.i + 60) tolNa3 = Math.abs(c.tol || 0);
  }
  const r = { klap, diep, maxTol, tolNa3, vNa, draai: klap ? c.yaw - klap.yaw : 0 };
  window.__weg(c);
  return r;
});
await page.evaluate(() => { window.__telLog += window.__tel('schamp') + ' ; '; });
ok(!!schamp.klap, 'hij raakt de muur', schamp.klap ? `${schamp.klap.kracht.toFixed(1)} m/s recht erop` : 'geen klap');
ok(schamp.vNa > 9, 'en schuift erlangs door (niet stil)', `${(schamp.vNa ?? 0).toFixed(1)} m/s twee tienden na de klap`);
ok(schamp.maxTol > 0.15, 'de klap geeft draaiing', `${schamp.maxTol.toFixed(2)} rad/s`);
ok(schamp.maxTol <= 2.61, 'begrensd', `${schamp.maxTol.toFixed(2)} rad/s`);
ok(schamp.tolNa3 !== null && schamp.tolNa3 < 0.05, 'de draai dempt binnen drie tellen uit', `${(schamp.tolNa3 ?? 9).toFixed(3)} rad/s na 3 s`);
ok(schamp.draai > 0.05, 'de neus draait van de muur weg', `${schamp.draai.toFixed(2)} rad`);
ok(schamp.diep < 0.02, 'nooit in de muur', `${(schamp.diep * 100).toFixed(1)} cm`);

// ---------- 3. in de flank geraakt ----------
kop('in de flank geraakt');
const flank = await page.evaluate(() => {
  const g = window.__game, X = window.__X0 + 600, Z = window.__Z0;
  const c = window.__auto('hatch', X, Z, 0);            // stil, neus naar −z
  // een auto van links, met 12 m/s dwars op de flank, net iets voor het midden
  const b = window.__auto('hatch', X - 2.6, Z - 0.5, -Math.PI / 2, false);   // yaw −90°: vooruit is +x
  b.speed = 12; b.rij = b.yaw;
  const dt = 0.05;
  let klap = 0, maxZij = 0, yaw0 = c.yaw;
  for (let i = 0; i < 40; i++) {
    g.vehicles.drive(c, {}, dt);
    if (i === 0) klap = c.botsKracht;
    maxZij = Math.max(maxZij, c.x - X);
    b.speed = 0;            // de ander staat na de klap stil (in het spel: schrikAf)
  }
  const r = { klap, zij: c.x - X, maxZij, draai: c.yaw - yaw0, langs: Math.abs(c.z - Z) };
  window.__weg(c); window.__weg(b);
  return r;
});
await page.evaluate(() => { window.__telLog += window.__tel('flank') + ' ; '; });
ok(flank.klap > 2.2, 'het is een klap', `${flank.klap.toFixed(1)} m/s`);
ok(flank.zij > 1.2, 'hij schuift zijwaarts weg', `${flank.zij.toFixed(2)} m opzij`);
ok(Math.abs(flank.draai) > 0.05, 'en draait', `${flank.draai.toFixed(2)} rad`);
ok(flank.langs < 1.5, 'zonder vooruit te gaan rijden', `${flank.langs.toFixed(2)} m langs`);

// ---------- 4. tegen een stilstaande auto ----------
kop('tegen een stilstaande auto');
const stil = await page.evaluate(() => {
  const g = window.__game, X = window.__X0 + 900, Z = window.__Z0;
  const b = window.__auto('hatch', X, Z - 12, 0, false);
  b.speed = 0;
  const c = window.__auto('hatch', X, Z, 0);
  c.speed = 12;
  const dt = 0.05;
  let klap = null, minAf = 99, duw = false;
  for (let i = 0; i < 60; i++) {
    g.vehicles.drive(c, {}, dt);
    g.vehicles.rolUit(dt);
    if (c.botsKracht > 0 && !klap) klap = { kracht: c.botsKracht, v: c.speed };
    if (b.duwV) duw = true;
    // afstand tussen de neus van c en de kont van b (de cirkels)
    const nx = c.x, nz = c.z - 1.4, kx = b.x, kz = b.z + 1.4;
    minAf = Math.min(minAf, Math.hypot(nx - kx, nz - kz));
  }
  const r = { klap, minAf, duw, bz: b.z - (Z - 12) };
  window.__weg(c); window.__weg(b);
  return r;
});
ok(!!stil.klap && stil.klap.v < 3, 'hard afgeremd tegen de stilstaande auto', stil.klap ? `${stil.klap.kracht.toFixed(1)} → ${stil.klap.v.toFixed(2)} m/s` : 'geen klap');
ok(stil.duw && stil.bz < -0.2, 'de ander rolt een stuk weg', `${stil.bz.toFixed(2)} m`);
ok(stil.minAf > 1.7, 'ze staan niet door elkaar', `${stil.minAf.toFixed(2)} m tussen de cirkels (1,9 = raken)`);

// ---------- 5. schakelen ----------
kop('de motor en de versnellingen');
const bak = await page.evaluate(() => {
  const g = window.__game, X = window.__X0 + 3000, Z = window.__Z0 + 3000, A = window.__A;
  const uit = {};
  for (const soort of ['hatch', 'ferrari']) {
    const c = window.__auto(soort, X + (soort === 'ferrari' ? 50 : 0), Z, 0);
    const binnen = c.mesh.userData.binnen;
    const dt = 0.05;
    let vorigeG = 1, rpmVorig = 0, terug = 0, dalingen = [], rpmMin = 1e9, rpmMax = 0, toonDaal = 0, toonOp = 0, tellerFout = 0, maxG = 1;
    const B = window.__R.bakVan(c);
    let voor = null;
    for (let i = 0; i < 700; i++) {
      g.vehicles.drive(c, { KeyW: true }, dt);
      if (binnen) binnen.update(c, dt);
      const gNu = c.versnelling;
      if (gNu < vorigeG) terug++;
      if (gNu > vorigeG) { voor = { rpm: rpmVorig, i, toon: A.motorToon({ toeren: rpmVorig, rood: c.toerenRood, stationair: c.toerenStationair }).f1 }; }
      if (voor && i === voor.i + 3) {
        dalingen.push(c.toeren - voor.rpm);
        const t = A.motorToon({ toeren: c.toeren, rood: c.toerenRood, stationair: c.toerenStationair }).f1;
        toonOp++; if (t < voor.toon - 3) toonDaal++;
        voor = null;
      }
      rpmVorig = c.toeren;
      vorigeG = gNu; maxG = Math.max(maxG, gNu);
      if (i > 10) { rpmMin = Math.min(rpmMin, c.toeren); rpmMax = Math.max(rpmMax, c.toeren); }
      if (binnen && i > 20 && i % 20 === 0) tellerFout = Math.max(tellerFout, Math.abs(binnen.toerenDeel - c.toeren / binnen.toerKlok));
    }
    // terugschakelen bij het remmen
    let gRem = c.versnelling;
    for (let i = 0; i < 200 && c.speed > 1; i++) g.vehicles.drive(c, { KeyS: true }, dt);
    uit[soort] = { maxG, terug, dalingen, rpmMin, rpmMax, B, toonDaal, toonOp, tellerFout, heeftBinnen: !!binnen, gRem, gNaRem: c.versnelling, v: c.speed };
    window.__weg(c);
  }
  // en het geluid zelf, als de audio loopt
  let stand = null;
  try {
    g.geluid.start && g.geluid.start();
    g.geluid.motorAan();
    g.geluid.motorToeren(10, 24, { toeren: 4200, rood: 6200, stationair: 850, bak: 3 });
    stand = g.geluid.motorStand();
    g.geluid.motorUit();
  } catch (e) { stand = { fout: e.message }; }
  uit.stand = stand;
  return uit;
});
await page.evaluate(() => { window.__telLog += window.__tel('bak') + ' ; '; });
for (const soort of ['hatch', 'ferrari']) {
  const b = bak[soort];
  ok(b.maxG === 5, `${soort}: de versnelling loopt op tot de vijfde`, `${b.maxG}`);
  ok(b.terug === 0, `${soort}: met het gas erop geen terugschakelen`, `${b.terug} keer`);
  ok(b.dalingen.length === 4 && b.dalingen.every(d => d < -300), `${soort}: het toerental zakt bij elk opschakelen`, b.dalingen.map(d => d.toFixed(0)).join(', '));
  ok(b.rpmMin >= b.B.stationair * 0.95 && b.rpmMax <= b.B.rood * 1.03, `${soort}: het toerental blijft tussen stationair en de rode streep`,
    `${b.rpmMin.toFixed(0)}–${b.rpmMax.toFixed(0)} (${b.B.stationair}–${b.B.rood})`);
  ok(b.toonOp === 4 && b.toonDaal === 4, `${soort}: de toon van de motor zakt bij opschakelen`, `${b.toonDaal} van ${b.toonOp}`);
  ok(b.heeftBinnen && b.tellerFout < 0.05, `${soort}: de toerenteller in het interieur volgt`, `grootste verschil ${(b.tellerFout * 100).toFixed(1)} % van de klok`);
  ok(b.gNaRem <= 2 && Math.abs(b.v) <= 1.2, `${soort}: bij het remmen terug naar de eerste of tweede`, `${b.gRem} → ${b.gNaRem}`);
}
ok(bak.ferrari.rpmMax > bak.hatch.rpmMax + 1000, 'de Ferrari draait hoger', `${bak.ferrari.rpmMax.toFixed(0)} tegen ${bak.hatch.rpmMax.toFixed(0)}`);
ok(!bak.stand || bak.stand.fout === undefined, 'het motorgeluid neemt de bak over', bak.stand ? JSON.stringify(bak.stand).slice(0, 90) : 'geen audio in deze browser');

// ---------- 6. topsnelheid ----------
kop('de topsnelheid');
const top = await page.evaluate(() => {
  const g = window.__game, X = window.__X0 + 6000, Z = window.__Z0 + 6000;
  const dt = 0.05, uit = [];
  const rij = (soort, speler, tuning) => {
    const c = window.__auto(soort, X, Z, 0, speler);
    if (!speler) g.player.inCar = null;
    if (tuning) { c.topSnelheid *= 1.12; c.trek *= 1.12; }
    let t10 = null;
    for (let i = 0; i < 1600; i++) {
      g.vehicles.drive(c, { KeyW: true }, dt);
      if (t10 === null && c.speed >= 0.9 * 22) t10 = i * dt;
    }
    const v = c.speed;
    window.__weg(c);
    return { v, t20: t10 };
  };
  for (const [soort, tuning] of [['hatch', false], ['ferrari', false], ['ferrari', true], ['gti', false]]) {
    const oud = rij(soort, false, tuning), nieuw = rij(soort, true, tuning);
    uit.push({ soort, tuning, oud, nieuw });
  }
  return uit;
});
await page.evaluate(() => { window.__telLog += window.__tel('top') + ' ; '; });
for (const t of top) {
  ok(Math.abs(t.nieuw.v - t.oud.v) / t.oud.v < 0.01, `${t.soort}${t.tuning ? ' opgevoerd' : ''}: dezelfde topsnelheid`,
    `${(t.nieuw.v * 3.6).toFixed(1)} km/u (was ${(t.oud.v * 3.6).toFixed(1)})`);
  ok(t.nieuw.t20 !== null && Math.abs(t.nieuw.t20 - t.oud.t20) < Math.max(0.6, t.oud.t20 * 0.12), `${t.soort}${t.tuning ? ' opgevoerd' : ''}: optrekken ongeveer als voorheen`,
    `tot 71 km/u in ${t.nieuw.t20?.toFixed(2)} s (was ${t.oud.t20?.toFixed(2)})`);
}

// ---------- 7. de camera ----------
kop('de camera met de snelheid');
const cam = await page.evaluate(() => {
  const g = window.__game, P = g.player, C = g.rijCam, X = window.__X0 + 9000, Z = window.__Z0;
  const c = window.__auto('ferrari', X, Z, 0);
  const dt = 0.05;
  const r = {};
  const basis = P.fovBasis;
  P.autoBeeld = 0;
  // stilstand
  c.speed = 0;
  for (let i = 0; i < 40; i++) g.werkRijCamBij(dt);
  P.zetBeeldhoek();
  r.stil = { fov: C.fov, cam: g.camera.fov, basis };
  // op 200 km/u: geleidelijk wijder
  c.speed = 56;
  let grootsteStap = 0, vorig = C.fov, trilMax = 0, rolMax = 0, t1 = null;
  for (let i = 0; i < 200; i++) {
    g.werkRijCamBij(dt);
    grootsteStap = Math.max(grootsteStap, C.fov - vorig); vorig = C.fov;
    trilMax = Math.max(trilMax, Math.abs(C.trilX), Math.abs(C.trilY));
    rolMax = Math.max(rolMax, Math.abs(C.trilRol));
    if (i === 20) t1 = C.fov;
  }
  P.zetBeeldhoek();
  r.snel = { fov: C.fov, cam: g.camera.fov, grootsteStap, trilMax, rolMax, t1 };
  // door je eigen ogen: 78° plus het extra
  P.autoBeeld = 78; P.zetBeeldhoek();
  r.ogen = g.camera.fov;
  // een filmbeeld: meteen niets
  document.body.classList.add('film');
  g.werkRijCamBij(dt);
  r.film = { fov: C.fov, tril: C.tril, x: C.trilX };
  document.body.classList.remove('film');
  // de drone, de heli (zitten): ook niets
  P.zit = true; g.werkRijCamBij(dt); r.zit = C.fov; P.zit = false;
  // terug naar stilstand
  for (let i = 0; i < 40; i++) g.werkRijCamBij(dt);
  c.speed = 0;
  for (let i = 0; i < 200; i++) g.werkRijCamBij(dt);
  P.zetBeeldhoek();
  r.terug = { fov: C.fov, ogen: g.camera.fov };
  // uit de auto: weg
  window.__weg(c); P.autoBeeld = 0; g.werkRijCamBij(dt); P.zetBeeldhoek();
  r.uit = { fov: C.fov, cam: g.camera.fov };
  return r;
});
await page.evaluate(() => { window.__telLog += window.__tel('cam') + ' ; '; });
ok(cam.stil.fov === 0 && Math.abs(cam.stil.cam - cam.stil.basis) < 0.05, 'stilstaand de gewone beeldhoek', `${cam.stil.cam.toFixed(2)}° (basis ${cam.stil.basis})`);
ok(cam.snel.fov > 6 && cam.snel.fov <= 9.001, 'op 200 km/u wijder, hooguit 9°', `+${cam.snel.fov.toFixed(2)}°, camera ${cam.snel.cam.toFixed(2)}°`);
ok(cam.snel.t1 < cam.snel.fov * 0.75 && cam.snel.grootsteStap < 0.45, 'en geleidelijk', `na 1 s +${cam.snel.t1.toFixed(2)}°, grootste stap ${cam.snel.grootsteStap.toFixed(3)}° per beeld`);
ok(cam.snel.trilMax > 0.001 && cam.snel.trilMax <= 0.0121 && cam.snel.rolMax <= 0.00181, 'een lichte trilling, begrensd', `${(cam.snel.trilMax * 1000).toFixed(1)} mm, rol ${(cam.snel.rolMax * 1000).toFixed(2)} mrad`);
ok(Math.abs(cam.ogen - (78 + cam.snel.fov)) < 0.05, 'door je eigen ogen: 78° plus het extra', `${cam.ogen.toFixed(2)}°`);
ok(cam.film.fov === 0 && cam.film.tril === 0 && cam.film.x === 0, 'in een filmbeeld meteen niets');
ok(cam.zit === 0, 'zittend (de heli) ook niet');
ok(cam.terug.fov < 0.3 && Math.abs(cam.terug.ogen - 78) < 0.3, 'stilstaand weer terug naar de 78° van de bestuurder', `${cam.terug.ogen.toFixed(2)}°`);
ok(cam.uit.fov === 0 && Math.abs(cam.uit.cam - cam.stil.basis) < 0.05, 'uit de auto de gewone beeldhoek', `${cam.uit.cam.toFixed(2)}°`);

// ---------- 8. shaderprogramma's ----------
kop('geen nieuw shaderprogramma');
const progNa = await page.evaluate(() => {
  const g = window.__game;
  for (const c of window.__proefAutos) if (c.mesh.userData.binnen) c.mesh.userData.binnen.update(c, 0.05);
  g.camera.position.set(window.__X0 - 402, 1.5, window.__Z0 + 6); g.camera.lookAt(window.__X0 - 402, 0.8, window.__Z0);
  g.camera.updateMatrixWorld(true);
  g.zetSchaduwDoos(window.__X0 - 402, window.__Z0);
  g.renderer.shadowMap.needsUpdate = true;
  g.renderer.render(g.scene, g.camera);
  return { n: g.renderer.info.programs.length, nieuw: [window.__telLog || ''] };
});
ok(progNa.n === progVoor, 'het rijden, schakelen en de camera maken geen nieuw programma', `${progVoor} → ${progNa.n} ${progNa.nieuw.join(', ')}`);

await browser.close();
console.log(fout ? `\n${fout} FOUT` : '\nalles goed');
process.exit(fout ? 1 : 0);
