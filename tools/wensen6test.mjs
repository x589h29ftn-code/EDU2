/*
 Proef bij stap 181 (npm run wensen6test). Gevraagd op 15 okt 2026:
   1. drie nummers op 100% NL (Acda en De Munnik twee keer, VOF de Kunst);
   2. het thema van Medal of Honor onder No Mercy 4 en 5, met fade in en uit;
   3. het stuur in de auto draait de goede kant op (naar rechts sturen = het stuur rechtsom);
   4. sturen op snelheid weer zoals vóór stap 179 (geen zacht aanlopen meer);
   5. voetgangers hoogstens iets groter of kleiner dan Erik, behalve kinderen;
   6. een auto van de computer die vaststaat en toetert: na een tijdje achteruit en eromheen, en niet eindeloos toeteren.

 Gebruik: npm run server &  node tools/wensen6test.mjs [poort]
*/
import { chromium } from 'playwright';
import { readFileSync, existsSync, statSync } from 'node:fs';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => { console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`); if (!goed) fouten++; };
const kop = (t) => console.log(`\n--- ${t} ---`);

// ------------------------------------------------------------------ 1. de bestanden (zonder browser)
kop('1. de nummers en de muziek');
const zenders = JSON.parse(readFileSync('audio/radio/zenders.json', 'utf8')).zenders;
const nl = zenders.find(z => z.naam === '100% NL');
for (const [bestand, titel] of [['niet-of-nooit-geweest.mp3', 'Niet of nooit geweest'], ['het-regent-zonnestralen.mp3', 'Het regent zonnestralen'], ['suzanne.mp3', 'Suzanne']]) {
  const n = nl && nl.nummers.find(x => x.bestand === bestand);
  const pad = `audio/radio/${bestand}`;
  const kopB = existsSync(pad) ? readFileSync(pad).subarray(0, 3) : Buffer.alloc(3);
  const mp3 = (kopB[0] === 0x49 && kopB[1] === 0x44 && kopB[2] === 0x33) || (kopB[0] === 0xff && (kopB[1] & 0xe0) === 0xe0);
  ok(n && n.titel === titel && mp3 && statSync(pad).size > 1e6, `100% NL: ${titel}`, existsSync(pad) ? `${(statSync(pad).size / 1e6).toFixed(1)} MB` : 'geen bestand');
}
ok(nl.nummers.length === 5, 'en Ren Lenny Ren en Kali staan er nog', nl.nummers.map(n => n.titel).join(', '));
{
  const pad = 'audio/missie/nomercy.mp3';
  ok(existsSync(pad) && statSync(pad).size > 1e6, 'het thema van Medal of Honor staat in audio/missie/', existsSync(pad) ? `${(statSync(pad).size / 1e6).toFixed(1)} MB` : '');
  const src = readFileSync('js/audio.js', 'utf8');
  ok(/NOMERCY_MUZIEK = \{ url: 'audio\/missie\/nomercy\.mp3'/.test(src), 'js/audio.js speelt dat bestand (NOMERCY_MUZIEK)');
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});

// ------------------------------------------------------------------ 3. het stuur, op een lege pagina
kop('3. het stuur draait mee met de wielen');
{
  const page = await browser.newPage();
  page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
  await page.route('**/leeg.html', r => r.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head>
<script type="importmap">{ "imports": { "three": "/lib/three.module.js" } }</script></head><body>
<script type="module">
  import * as THREE from 'three';
  import { makeCar } from '/js/carmodel.js';
  import { maakStafauto } from '/js/nomercy5.js';
  window.__t = { THREE, makeCar, maakStafauto };
</script></body></html>` }));
  await page.goto(`http://127.0.0.1:${poort}/leeg.html`);
  await page.waitForFunction(() => window.__t, null, { timeout: 120000 });
  const st = await page.evaluate(() => {
    const { THREE, makeCar, maakStafauto } = window.__t;
    const uit = {};
    for (const soort of ['hatch', 'ferrari', 'staf']) {
      const g = soort === 'staf' ? maakStafauto() : makeCar(0x3b6ea8, soort, true);
      const B = g.userData.binnen; if (!B) { uit[soort] = null; continue; }
      B.groep.visible = true;
      const s = B.stuur || B.draai;
      // een punt bovenop de krans, in het assenstelsel van het stuur, dan in dat van de auto (rechts = +x)
      const top = () => { g.updateMatrixWorld(true); const p = s.localToWorld(new THREE.Vector3(0, 0.18, 0)); return g.worldToLocal(p); };
      const auto = { steer: 0, speed: 8, topSnelheid: 30 };
      B.update(auto, 1); const x0 = top().x;
      auto.steer = -0.25; B.update(auto, 1); const rechts = top().x - x0;   // steer < 0: de wielen naar rechts (yaw neemt af)
      auto.steer = 0.25; B.update(auto, 1); const links = top().x - x0;
      uit[soort] = { rechts: +rechts.toFixed(3), links: +links.toFixed(3) };
    }
    // en de auto zelf: met steer < 0 draait hij naar rechts (yaw neemt af, vooruit = −z)
    return uit;
  });
  for (const [soort, r] of Object.entries(st)) {
    ok(r && r.rechts > 0.05 && r.links < -0.05, `${soort}: naar rechts sturen draait de bovenkant van het stuur naar rechts`, r ? `rechts ${r.rechts} m, links ${r.links} m` : 'geen interieur');
  }
  await page.close();
}

// ------------------------------------------------------------------ het spel
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.setDefaultTimeout(900000);
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  for (const k of Object.keys(localStorage)) if (k.startsWith('tinga.spel')) localStorage.removeItem(k);
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, v = g.verhaal;
  window.__W = await import('/js/world.js');
  g.player.active = false; window.__autoplay = false; g.sfeer.uur = 14; g.vehicles.drukte = 1;
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) v.update(dt); };
  window.__klik = (max = 40) => { for (let i = 0; i < max && !document.getElementById('dialoog').hidden; i++) { v.toets(); window.__stap(1); } };
});

// ------------------------------------------------------------------ 2. Medal of Honor onder No Mercy
kop('2. Medal of Honor onder No Mercy 4 en 5');
const nm = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, G = g.geluid;
  G.start();
  const stand = () => G.nomercyMuziekStand() || { aan: false, ramps: [] };
  const laatst = () => { const r = stand().ramps; return r[r.length - 1] || null; };
  const uit = {};
  const s0 = v.bewaar();
  uit.voor = stand().aan;
  for (const [naam, start] of [['nm4', 'startNoMercy'], ['nm5', 'startNoMercy5']]) {
    v.herstel(s0); v.update(0.05);
    const ok = v[start]();
    window.__stap(4);
    // bij Erik Jan: E begint het gesprek
    v.toets(); window.__stap(2);
    const f = naam === 'nm4' ? v.noMercy.fase : v.noMercy5 ? v.noMercy5.fase : null;
    const a = stand();
    uit[naam] = { gestart: ok, fase: f, aan: a.aan, in: laatst(), bestand: a.bestand, stuk: a.stuk };
    // de missiemuziek zwijgt eronder
    uit[naam].missieStil = !(G.stand && G.stand().missie && G.stand().missie.aan);
    window.__klik();
    v.herstel(s0); window.__stap(2);
    uit[naam].naLaden = { aan: stand().aan, uit: laatst() };
  }
  return uit;
});
ok(!nm.voor, 'buiten No Mercy geen Medal of Honor');
for (const n of ['nm4', 'nm5']) {
  const r = nm[n];
  ok(r.gestart && r.aan && r.in && r.in.waarom === 'in' && r.in.duur >= 3 && r.in.van === 0, `${n === 'nm4' ? 'No Mercy 4' : 'No Mercy 5'}: bij Erik Jan zwelt het thema aan`, `fase ${r.fase}, ${r.in ? `${r.in.van} → ${r.in.naar} in ${r.in.duur} s` : 'geen fade'}, ${r.bestand}`);
  ok(!r.naLaden.aan && r.naLaden.uit && r.naLaden.uit.waarom === 'uit' && r.naLaden.uit.duur >= 4, 'en dooft uit als de opnames ophouden', r.naLaden.uit ? `${r.naLaden.uit.van} → 0 in ${r.naLaden.uit.duur} s` : '');
}

// ------------------------------------------------------------------ 4. sturen op snelheid
kop('4. sturen op snelheid zoals vóór stap 179');
const stuur = await page.evaluate(() => {
  const g = window.__game, V = g.vehicles;
  const car = V.voegToe({ x: 9000, z: 9000, yaw: 0, soort: 'ferrari' });
  const rit = (v0, tik) => {
    car.x = 9000; car.z = 9000; car.yaw = 0; car.rij = 0; car.speed = v0; car.steer = 0; car.stuurHoud = 0;
    if (car.mesh) car.mesh.position.set(car.x, 0, car.z);
    const dt = 1 / 60; let t = 0, eerst = null;
    while (t < 0.4) {
      const k = t < tik ? { KeyD: true, KeyW: true } : { KeyW: true };
      V.drive(car, k, dt); t += dt;
      if (eerst === null && Math.abs(car.steer) > 0) eerst = { t, steer: car.steer };
    }
    return { draai: Math.abs(car.yaw), eerst };
  };
  const r = { tik50: rit(50, 0.1), tik20: rit(20, 0.1) };
  V.verwijder && V.verwijder(car);
  return r;
});
ok(stuur.tik50.eerst && stuur.tik50.eerst.t < 0.02 && Math.abs(stuur.tik50.eerst.steer) > 0.002, 'op 180 km/u reageert het stuur meteen op een toets (geen 0,15 s zacht aanlopen)', stuur.tik50.eerst ? `na ${(stuur.tik50.eerst.t * 1000).toFixed(0)} ms ${stuur.tik50.eerst.steer.toFixed(4)} rad` : '');
ok(stuur.tik50.draai > 0.05 && stuur.tik50.draai < 0.13, 'een tikje van 0,1 s op 180 km/u: weer een merkbare koerswijziging, zoals vóór stap 179', `${(stuur.tik50.draai * 180 / Math.PI).toFixed(1)}° na 0,4 s (racetest meet het anders: stap 179 1,1°, daarvoor 5,9°)`);

// ------------------------------------------------------------------ 5. de lengte van de voetgangers
kop('5. voetgangers ongeveer zo groot als Erik');
const len = await page.evaluate(() => {
  const P = window.__game.npcs.people;
  const vol = P.filter(p => !p.kind).map(p => p.height), kind = P.filter(p => p.kind).map(p => p.height);
  return { n: vol.length, min: Math.min(...vol), max: Math.max(...vol), kinderen: kind.length, kindMax: kind.length ? Math.max(...kind) : 0,
    fiets: P.filter(p => p.fietst).length, hond: P.filter(p => p.hond).length };
});
ok(len.min >= 0.92 && len.max <= 1.04, 'alle volwassenen tussen 0,92 en 1,04 keer Erik', `${len.n} mensen van ${len.min.toFixed(3)} tot ${len.max.toFixed(3)}`);
ok(len.kinderen > 0 && len.kindMax < 0.8, 'kinderen blijven kinderen', `${len.kinderen} kinderen, hoogstens ${len.kindMax.toFixed(2)}`);
ok(len.fiets > 10 && len.hond > 5, 'en er fietsen en hondjes nog evenveel mensen als de loting zei', `${len.fiets} fietsers, ${len.hond} hondjes`);

// ------------------------------------------------------------------ 6. vast en toeteren
kop('6. een auto die vaststaat rijdt achteruit en eromheen');
const vast = await page.evaluate(async () => {
  const { gladPad } = await import('/js/vehicles.js');
  const g = window.__game, V = g.vehicles, R = V.regels;
  // een rechte, brede straat zonder kruising en zonder geparkeerde auto's langs de route (zoals tools/voorrangtest.mjs)
  let straat = null;
  for (const p of V.rijbanen) {
    const P = gladPad(p), w = R.breedte(P);
    if (w < 6.5 || w > 9 || P.length < 60) continue;
    const [pv, pa] = R.passages(P); if (pv.length || pa.length) continue;
    for (let i = 6; i < P.length - 50 && !straat; i++) {
      let recht = true;
      for (let j = i; j < i + 40; j++) if (P.vmax[j] < 25) { recht = false; break; }
      if (!recht || R.knopenOp(P).some(e => e.i > i - 4 && e.i < i + 45)) continue;
      let vrij = true;
      for (let j = i; j < i + 40 && vrij; j += 2) for (const c of V.parkeerNabij(P[j].x, P[j].y, 6)) if (Math.hypot(c.x - P[j].x, c.z - P[j].y) < 5) vrij = false;
      if (vrij) straat = { P, i, w };
    }
    if (straat) break;
  }
  if (!straat) return null;
  const t = V.traffic.find(q => q.lokaal && q.bounce && q.soort !== 'truck');
  for (const q of V.traffic) if (q !== t) q.slaapt = true;
  t.slaapt = false; t.mesh.visible = true;
  const { P, i } = straat;
  const k = i + 15, q = P[k], tx = P.raak.tx[k], tz = P.raak.tz[k];
  // de blokkade in zijn strook, en hij staat er al vlak achter (zes meter van midden tot midden): geen aanloop om opzij te gaan
  const x = q.x - tz * 1.4, z = q.y + tx * 1.4;
  const blok = V.voegToe({ x, z, yaw: Math.atan2(-tx, -tz), soort: 'hatch', kleur: 0x9c1f1f });
  blok.mesh.position.set(x, 0, z); blok.mesh.rotation.y = blok.yaw;
  const bounce = t.bounce;
  t.path = P; t.t = k - 3; t.dir = 1; t.keer = null; t.rond = null; t.uitwijk = null; t.lane = 1.4; t.vLane = 0; t.zijHoek = 0;
  t.haast = 0; t.achteruit = 0; t.speed = t.snelheid = t.doel = 0; t.blokT = 0; t._pos = null; t._dir = null; t._terugN = 0; t._geenUit = null;
  t.bounce = false;                      // keren kan hier niet: zo bleef hij eerst eeuwig staan
  let toeter = 0; const oud = V.opClaxon; V.opClaxon = () => { toeter++; };
  const rnd = Math.random; Math.random = () => 0.1;
  const uit = { terug: 0, uitgeweken: false, voorbij: false, achteruitMax: 0, duur: null, stilMax: 0 };
  const terug0 = R.stats.terug;
  const t0 = t.t; let stil = 0;
  for (let n = 0; n < 30 * 60; n++) {
    V.updateTraffic(1 / 30, null, null, null, null);
    if (t.uitwijk) uit.uitgeweken = true;
    uit.achteruitMax = Math.max(uit.achteruitMax, t0 - t.t);
    stil = t.snelheid < 0.2 ? stil + 1 / 30 : 0; uit.stilMax = Math.max(uit.stilMax, stil);
    if (t.t - k > 4) { uit.voorbij = true; uit.duur = (n + 1) / 30; break; }
  }
  uit.terug = R.stats.terug - terug0;
  if (!uit.voorbij) {
    const b = R.blokkadeVoor(t);
    uit.waarom = { gap: b && +b.gap.toFixed(1), opzij: b && +b.opzij.toFixed(2), lane: t.lane, plan: b ? R.uitwijkPlan(t, b) : null, geenUit: !!t._geenUit,
      bezetL: b ? R.strookBezet(t, b.opzij + t.lane - b.eC - 1.3, b.c) : null, terugN: t._terugN, blokT: +(t.blokT || 0).toFixed(1), v: +t.snelheid.toFixed(2) };
  }
  uit.toeter = toeter;
  // en zonder uitweg (de andere strook ook dicht): niet eindeloos toeteren
  const x2 = q.x + tz * 1.4, z2 = q.y - tx * 1.4;
  const blok2 = V.voegToe({ x: x2, z: z2, yaw: Math.atan2(tx, tz), soort: 'hatch', kleur: 0x1f3f9c });
  blok2.mesh.position.set(x2, 0, z2); blok2.mesh.rotation.y = blok2.yaw;
  t.t = k - 3; t.dir = 1; t.uitwijk = null; t.lane = 1.4; t.vLane = 0; t.speed = t.snelheid = t.doel = 0; t.blokT = 0; t._terugN = 0; t._geenUit = null; t.achteruit = 0;
  toeter = 0;
  for (let n = 0; n < 30 * 90; n++) V.updateTraffic(1 / 30, null, null, null, null);
  uit.dicht = { toeter, terugN: t._terugN || 0 };
  V.opClaxon = oud; Math.random = rnd; t.bounce = bounce;
  V.verwijder && (V.verwijder(blok), V.verwijder(blok2));
  uit.straat = [Math.round(q.x), Math.round(q.y), +straat.w.toFixed(1)];
  return uit;
});
if (!vast) ok(false, 'een rechte straat voor de proef gevonden');
else {
  ok(vast.terug >= 1 && vast.achteruitMax > 1.0, 'hij rijdt een stuk achteruit', `${vast.terug} keer, tot ${(vast.achteruitMax * 2).toFixed(1)} m terug (straat bij ${vast.straat})`);
  ok(vast.uitgeweken && vast.voorbij, 'en dan eromheen', vast.duur ? `voorbij na ${vast.duur.toFixed(1)} s` : `niet voorbij: ${JSON.stringify(vast.waarom)}`);
  ok(vast.toeter >= 1 && vast.toeter <= 6, 'toetert eerst wel, maar niet aan één stuk door', `${vast.toeter} keer`);
  ok(vast.dicht.toeter <= 6 && vast.dicht.terugN >= 1, 'helemaal dicht: na een paar pogingen houdt het toeteren op', `${vast.dicht.toeter} keer in 90 s, ${vast.dicht.terugN} keer terug`);
}

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);
