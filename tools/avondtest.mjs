/*
 Missie 18, de avond (stap 109): de heli boven Bouwman, landen, de achtervolging, het vuurgevecht bij
 de loods, de politie en de C4 op de Dúvelsrak.

   node tools/server.mjs 8123 &   node tools/avondtest.mjs [poort]   (npm run avondtest)

 1. De lijnen: van de loods naar de BP (A) en terug (B), over de weg en zonder sprong in de hoogte.
 2. De heli: 01:00, de klok stil, Erik in de deur (de speler zit). Elke tiende seconde van de rit:
    boven de daken, ruim van de rand van de wereld, rechts naast Bouwman met de open deur naar hem toe,
    rustig (nooit harder dan vmax, geen schok), de buitencamera buiten de romp en de blik begrensd.
 3. Echte schoten uit de deur raken zijn auto en tellen, maar hij komt weg: onder de luifel, en Wiebe
    landt op een vrije plek bij het Autohuis.
 4. De auto staat klaar, Mark en Johan ernaast; instappen begint de achtervolging over B.
 5. Kwijtraken: verder dan AVOND_KWIJT, tien tellen, dan mislukt.
 6. Bij de loods: Bouwman en zes man (stap 127), niet neer met één kogel, twee met een machinegeweer (salvo's);
    een echt schot met het pistool kost één leven, de sniper legt hem neer. Je komt in een andere auto
    dan de Ferrari: Mark en Johan stappen naast jou uit en schieten mee (niet op Bouwman); Bouwman neer,
    iedereen neer, dan de politie: vier sterren en de nav naar de Dúvelsrak.
 Ook (stap 110): in de heli doen E en V niets, Johan geeft kogels als je ze niet hebt, en opnieuw na het
 neergaan bij de loods begin je bij de loods.
 7. Op het dek: het filmbeeld. Johan gooit de C4, de knal, de politie staat ervoor stil, de sterren weg,
    elk beeld de camera boven het dek; daarna "Zondagochtend".
 8. De politie op een andere manier kwijt: ook "Zondagochtend".
 9. Opnieuw na het neergaan, per fase.
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fouten++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);
const r1 = (n) => (n == null || !isFinite(n)) ? String(n) : n.toFixed(1);

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
  const { KAART } = await import('/js/kaartwereld.js');
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, v = g.verhaal;
  g.player.active = false;
  window.__autoplay = false;
  window.__W = W; window.__K = KAART;
  window.__meld = [];
  const echt = g.hud.melding.bind(g.hud);
  g.hud.melding = (k, o, t) => { window.__meld.push(`${k}|${o}`); return echt(k, o, t); };
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) { g.player.health = 100; v.update(dt); } };
  window.__klik = (max = 80) => { for (let i = 0; i < max && !document.getElementById('dialoog').hidden; i++) { v.toets(); window.__stap(1); } };
  window.__tot = (fase, maxS = 20, dt = 0.05) => {
    for (let t = 0; t < maxS && v.fase !== fase; t += dt) { window.__stap(1, dt); if (!document.getElementById('dialoog').hidden) v.toets(); }
    return v.fase === fase;
  };
  window.__na17 = () => {
    const s = v.bewaar(); s.missie = 'klaar'; s.fase = 'klaar'; s.volgende = null;
    Object.assign(s, { schaduwKlaar: true, raceKlaar: true, brugKlaar: true, schriftKlaar: true, invalKlaar: true, invalKeus: 2,
      invalTelefoon: true, ronaldKlaar: true, ronaldPraatte: true, uitzendingKlaar: false, huisGekozen: s.huisGekozen || 'Koningsspil 20' });
    g.politie.reset();
    v.herstel(s);
  };
  // missie 18 op een fase hervatten (zoals het laden en het neergaan dat doen)
  window.__bij = (fase) => {
    if (v.missie !== 'uitzending') { window.__na17(); v.startMissie('uitzending'); window.__stap(2); }
    const s = v.bewaar(); s.missie = 'uitzending'; s.fase = fase;
    g.politie.reset();
    v.herstel(s);
    window.__stap(2);
  };
});

// ------------------------------------------------------------------ 1. de lijnen
kop('de lijnen');
const lijn = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, W = window.__W, K = window.__K;
  window.__na17();
  v.startMissie('uitzending');
  window.__stap(2);
  const a = v.avond;
  a.lijnen();
  const A = v.avond.A, B = v.avond.B, sw = v.schaduw.wereld, bp = K.tankstations[0];
  let mx = 0, mz = 0; for (const [x, z] of bp.ring) { mx += x; mz += z; } mx /= bp.ring.length; mz /= bp.ring.length;
  // de hoogte langs de lijn: geen sprong (dan zou hij onder een dek door of erop springen)
  const sprong = (L) => { let m = 0, vor = null; for (let i = 0; i < L.n; i++) { const y = W.grondHoogte(L.x[i], L.z[i]); if (vor !== null) m = Math.max(m, Math.abs(y - vor)); vor = y; } return m; };
  const G = K.gebied;
  const rand = (L) => { let m = Infinity; for (let i = 0; i < L.n; i++) m = Math.min(m, L.x[i] - G.x0, G.x1 - L.x[i], L.z[i] - G.z0, G.z1 - L.z[i]); return m; };
  return {
    A: A && { L: A.lengte, begin: Math.hypot(A.x[0] - sw.bus.x, A.z[0] - sw.bus.z), eind: Math.hypot(A.x[A.n - 1] - mx, A.z[A.n - 1] - mz), sprong: sprong(A), rand: rand(A) },
    B: B && { L: B.lengte, begin: Math.hypot(B.x[0] - mx, B.z[0] - mz), eind: Math.hypot(B.x[B.n - 1] - sw.bus.x, B.z[B.n - 1] - sw.bus.z), sprong: sprong(B), rand: rand(B) },
  };
});
ok(lijn.A && lijn.A.L > 600 && lijn.A.begin < 25 && lijn.A.eind < 30, 'A: van de loods naar de BP', lijn.A && `${r1(lijn.A.L)} m, begin ${r1(lijn.A.begin)} m, eind ${r1(lijn.A.eind)} m`);
ok(lijn.B && lijn.B.L > 600 && lijn.B.begin < 30 && lijn.B.eind < 25, 'B: van de BP terug naar de loods', lijn.B && `${r1(lijn.B.L)} m, begin ${r1(lijn.B.begin)} m, eind ${r1(lijn.B.eind)} m`);
ok(lijn.A && lijn.B && lijn.A.sprong < 0.6 && lijn.B.sprong < 0.6, 'geen sprong in de hoogte langs de lijnen', `${r1(lijn.A && lijn.A.sprong)} / ${r1(lijn.B && lijn.B.sprong)} m`);

// ------------------------------------------------------------------ 2. de heli
kop('de heli');
const heli = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, W = window.__W, K = window.__K;
  // "Die avond…" na het plan: de fase klaarmaken, dan naar buiten
  const s = v.bewaar(); s.missie = 'uitzending'; s.fase = 'heliStart';
  v.herstel(s);
  window.__stap(2);
  const a = v.avond, h = a.heli;
  const start = { fase: v.fase, zit: g.player.zit, zichtbaar: h.zichtbaar, uur: g.sfeer.uur, erik: h.erik.groep.visible };
  window.__klik();
  const G = K.gebied;
  let minBoven = Infinity, minRand = Infinity, minD = Infinity, maxD = 0, minDeur = 1, maxV = 0, maxSchok = 0, camBinnen = 0, camLaag = Infinity, n = 0;
  let maxYawDeur = 0, uurEind = 0;
  const dakHoogte = (x, z) => {
    // het hoogste pand onder de heli, binnen 25 m (uit de kaart)
    let m = 0;
    for (const p of K.panden) {
      if (!p.voet || !p.nok) continue;
      const [px, pz] = p.voet[0];
      if (Math.abs(px - x) > 60 || Math.abs(pz - z) > 60) continue;
      for (const [qx, qz] of p.voet) if (Math.hypot(qx - x, qz - z) < 25) { m = Math.max(m, p.nok); break; }
    }
    return m;
  };
  let vorigeV = null;
  // de blik draait mee rond: ook naar achteren en recht omhoog, dan houdt begrens hem binnen de deur
  for (let t = 0; t < 200 && (v.fase === 'heli' || v.fase === 'heliStart'); t += 0.1) {
    g.player.yaw += 0.21; g.player.pitch = Math.sin(t) * 2;
    window.__stap(1, 0.1);
    const r = v.avond.rit, P = h.pos;
    if (!r || v.fase !== 'heli') continue;
    n++;
    const grond = W.grondHoogte(P.x, P.z);
    if (n % 10 === 0) minBoven = Math.min(minBoven, P.y - grond - dakHoogte(P.x, P.z));
    minRand = Math.min(minRand, P.x - G.x0, G.x1 - P.x, P.z - G.z0, G.z1 - P.z);
    const d = Math.hypot(r.x - P.x, r.z - P.z);
    if (t > 12) { minD = Math.min(minD, d); maxD = Math.max(maxD, d); }
    const nn = h.deurNormaal();
    const dot = ((r.x - P.x) * nn.x + (r.z - P.z) * nn.z) / Math.max(d, 1e-3);
    if (t > 12) minDeur = Math.min(minDeur, dot);
    const sv = h.snelheid; maxV = Math.max(maxV, sv);
    if (vorigeV !== null) maxSchok = Math.max(maxSchok, Math.abs(sv - vorigeV) / 0.1);
    vorigeV = sv;
    // de camera: buiten de romp (lokaal x links van de deur), en de blik binnen het halfrond van de deur
    const c = v.avond.filmCam;
    if (c) {
      const lok = h.groep.worldToLocal(new g.camera.position.constructor(c.pos[0], c.pos[1], c.pos[2]));
      if (lok.x > -1.9) camBinnen++;
      camLaag = Math.min(camLaag, c.pos[1] - grond);
    }
    const deurYaw = Math.atan2(-nn.x, -nn.z);
    let dy = g.player.yaw - deurYaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
    maxYawDeur = Math.max(maxYawDeur, Math.abs(dy));
    uurEind = g.sfeer.uur;
  }
  return { start, minBoven, minRand, minD, maxD, minDeur, maxV, maxSchok, camBinnen, camLaag, n, maxYawDeur, uurEind, fase: v.fase,
    vmax: 31, deurHoek: 1.75, pitch: g.player.pitch };
});
ok(heli.start.fase === 'heliStart' && heli.start.zichtbaar && heli.start.zit && heli.start.erik, 'Die avond: de heli, Erik zit in de deur', heli.start.fase);
ok(Math.abs(heli.start.uur - 1) < 0.05 && Math.abs(heli.uurEind - 1) < 0.05, 'één uur \'s nachts, en de klok staat stil', `${r1(heli.start.uur)} → ${r1(heli.uurEind)}`);
ok(heli.n > 300 && heli.fase !== 'heli', 'de hele rit gevolgd, tot de BP', `${heli.n} metingen, nu ${heli.fase}`);
ok(heli.minBoven > 5, 'boven de daken', `minstens ${r1(heli.minBoven)} m boven het hoogste dak in de buurt`);
ok(heli.minRand > 150, 'ruim van de rand van de wereld', `${r1(heli.minRand)} m`);
ok(heli.minD > 12 && heli.maxD < 70, 'naast Bouwman: niet erbovenop en niet kwijt', `${r1(heli.minD)}–${r1(heli.maxD)} m`);
ok(heli.minDeur > 0.35, 'de open deur kijkt naar hem', `cos ${heli.minDeur.toFixed(2)}`);
ok(heli.maxV <= heli.vmax + 0.01 && heli.maxSchok < 7, 'rustig: nooit harder dan vmax, geen schok', `${r1(heli.maxV)} m/s, ${r1(heli.maxSchok)} m/s²`);
ok(heli.camBinnen === 0 && heli.camLaag > 15, 'de buitencamera hangt buiten de romp', `${heli.camBinnen} keer binnen, laagst ${r1(heli.camLaag)} m`);
ok(heli.maxYawDeur <= heli.deurHoek + 0.01, 'de blik blijft binnen de deur', `${r1(heli.maxYawDeur)} rad`);

// ------------------------------------------------------------------ 3. schieten, de luifel en landen
kop('schieten, en hij komt weg');
const raak = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  window.__bij('heliStart');
  window.__klik();
  // E en V in de heli: niet instappen, en de buitencamera blijft
  P.inCar = null;
  const eSlik = v.toets();
  const eAuto = !!P.inCar;
  P.active = true; g.wisselCamera(); P.active = false;
  window.__stap(2);
  const derdeAan = g.derde.aan;
  const camNaV = v.avond.filmCam, hNaV = v.avond.heli.pos;
  const camBijHeli = camNaV ? Math.hypot(camNaV.pos[0] - hNaV.x, camNaV.pos[2] - hNaV.z) : 99;
  if (g.derde.aan) g.derde.wissel();
  // naar de helft van de rit
  for (let t = 0; t < 60 && !(v.avond.rit && v.avond.rit.s > 250); t += 0.1) window.__stap(1, 0.1);
  P.ammo = 200; P.reloading = 0;
  let schoten = 0;
  for (let i = 0; i < 40; i++) {
    const r = v.avond.rit, h = v.avond.heli;
    const c = v.avond.filmCam;
    if (!c || !r) { window.__stap(1, 0.1); continue; }
    // mikken vanaf waar de camera nu hangt, op het midden van de auto
    const cp = g.camera.position, gy = window.__W.grondHoogte(r.x, r.z) + 0.6;
    const dx = r.x - cp.x, dy = gy - cp.y, dz = r.z - cp.z;
    P.yaw = Math.atan2(-dx, -dz); P.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    window.__stap(1, 0.02);
    P.vuurKlok = 0; P.kickPitch = 0; P.kickYaw = 0; P.ammo = Math.max(P.ammo, 5); P.reloading = 0;
    // (headless tekent de lus niet: de wereldmatrices zelf bijwerken, anders mist de straal een oude auto)
    g.scene.updateMatrixWorld(true);
    P.shoot(); schoten++;
    window.__stap(1, 0.05);
  }
  const treffers = v.avond.treffers;
  P.reserve = 3;                     // bijna door de kogels heen: Johan geeft er bij de auto
  // de rest van de rit
  for (let t = 0; t < 150 && v.fase === 'heli'; t += 0.1) window.__stap(1, 0.1);
  const luifel = v.fase;
  let landT = 0;
  for (let t = 0; t < 90 && v.fase !== 'naarAuto'; t += 0.1) { window.__stap(1, 0.1); if (!document.getElementById('dialoog').hidden) v.toets(); landT = t; }
  const h = v.avond.heli, L = v.avond.land;
  const [rx, rz] = window.__W.resolveCollisions(L.x, L.z, 5);
  const garage = typeof g.garage === 'function' ? g.garage() : g.garage;
  const af = garage && garage.plekken && garage.plekken.aflever;
  return { schoten, treffers, luifel, fase: v.fase, landT, vrij: Math.hypot(rx - L.x, rz - L.z), dAutohuis: af ? Math.hypot(L.x - af[0].x, L.z - af[0].z) : null,
    hY: h.pos.y - window.__W.grondHoogte(h.pos.x, h.pos.z), zit: P.zit, eSlik, eAuto, derdeAan, camBijHeli, reserve: P.reserve };
});
ok(raak.eSlik && !raak.eAuto, 'in de heli doet E niets (geen auto 34 m lager instappen)');
ok(!raak.derdeAan && raak.camBijHeli < 8, 'V in de heli: de buitencamera blijft bij de deur', `${r1(raak.camBijHeli)} m van de heli`);
ok(raak.reserve >= 120, 'zonder kogels: Johan geeft je een doos bij de auto', `${raak.reserve} in reserve`);
ok(raak.treffers >= 3, 'schoten uit de deur raken zijn auto', `${raak.treffers} treffers uit ${raak.schoten} schoten`);
ok(raak.luifel === 'luifel' || raak.luifel === 'landen' || raak.luifel === 'naarAuto', 'maar hij komt weg: onder de luifel van de BP', raak.luifel);
ok(raak.fase === 'naarAuto' && raak.hY < 2 && !raak.zit, 'Wiebe landt, Erik stapt uit', `${raak.fase}, ${r1(raak.hY)} m, na ${r1(raak.landT)} s`);
ok(raak.vrij < 0.01 && raak.dAutohuis !== null && raak.dAutohuis < 70, 'op een vrije plek bij het Autohuis', `${r1(raak.dAutohuis)} m van de auto's`);

// ------------------------------------------------------------------ 4. de auto en de achtervolging
kop('de auto en de achtervolging');
const jacht = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  const a = v.avond, auto = a.auto;
  const klaar = { auto: !!auto && auto.soort === 'ferrari' && auto.driveable, mark: a.mark.groep.visible, johan: a.johan.groep.visible,
    dMark: auto ? Math.hypot(a.mark.groep.position.x - auto.x, a.mark.groep.position.z - auto.z) : 99,
    dSpeler: auto ? Math.hypot(P.pos.x - auto.x, P.pos.z - auto.z) : 99 };
  window.__klik();
  P.inCar = auto;
  window.__stap(2);
  const fase1 = v.fase;
  // volgen: de auto 30 m achter hem op de lijn
  const B = v.avond.B;
  let maxD = 0, n = 0;
  for (let t = 0; t < 150 && v.fase === 'achtervolging'; t += 0.1) {
    const r = v.avond.rit;
    if (r) {
      let i = 0, best = Infinity;
      for (let k = 0; k < B.n; k++) { const d = Math.hypot(B.x[k] - r.x, B.z[k] - r.z); if (d < best) { best = d; i = k; } }
      const j = Math.max(0, i - 15);
      auto.x = B.x[j]; auto.z = B.z[j]; auto.yaw = Math.atan2(-B.tx[j], -B.tz[j]); auto.speed = r.v;
      if (auto.mesh) auto.mesh.position.set(auto.x, window.__W.grondHoogte(auto.x, auto.z), auto.z);
      P.pos.set(auto.x, 0, auto.z);
      maxD = Math.max(maxD, Math.hypot(auto.x - r.x, auto.z - r.z));
      n++;
    }
    window.__stap(1, 0.1);
    if (!document.getElementById('dialoog').hidden) v.toets();
  }
  return { klaar, fase1, fase: v.fase, maxD, n, mannen: !!v.avond.mannen, kwijt: v.avond.kwijtT };
});
ok(jacht.klaar.auto && jacht.klaar.mark && jacht.klaar.johan && jacht.klaar.dMark < 6 && jacht.klaar.dSpeler < 40, 'de zwarte Ferrari staat klaar, Mark en Johan ernaast',
  `Mark op ${r1(jacht.klaar.dMark)} m, jij op ${r1(jacht.klaar.dSpeler)} m`);
ok(jacht.fase1 === 'achtervolging', 'instappen: de achtervolging', jacht.fase1);
ok(jacht.fase === 'gevecht' && jacht.mannen && jacht.kwijt === 0, 'erachteraan tot zijn loods: het gevecht', `${jacht.fase}, ${jacht.n} metingen, hoogstens ${r1(jacht.maxD)} m`);

// ------------------------------------------------------------------ 5. kwijtraken
kop('kwijtraken');
const kwijt = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  window.__bij('achtervolging');
  window.__klik();
  const a = v.avond;
  P.inCar = a.auto;
  window.__stap(2);
  const fase1 = v.fase;
  window.__meld.length = 0;
  // blijven staan: hij rijdt weg
  P.inCar = null;
  let t = 0, maxD = 0;
  for (; t < 160 && v.missie === 'uitzending' && v.fase === 'achtervolging'; t += 0.1) {
    window.__stap(1, 0.1);
    const r = v.avond.rit; if (r) maxD = Math.max(maxD, Math.hypot(r.x - P.pos.x, r.z - P.pos.z));
    if (!document.getElementById('dialoog').hidden) v.toets();
  }
  return { fase1, t, maxD, mislukt: window.__meld.some(m => /MISLUKT/.test(m)), meld: window.__meld.slice(-3), kwijt: a.kwijt };
});
ok(kwijt.fase1 === 'achtervolging', 'opnieuw bij de auto, en weer de achtervolging', kwijt.fase1);
ok(kwijt.mislukt && kwijt.maxD > kwijt.kwijt, 'verder dan de grens te lang: Bouwman is ontkomen, mislukt', `na ${r1(kwijt.t)} s, ${r1(kwijt.maxD)} m; ${kwijt.meld.join(' / ')}`);

// ------------------------------------------------------------------ 6. het gevecht bij de loods
kop('het gevecht bij de loods');
const gev = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  window.__bij('achtervolging');
  window.__klik();
  // niet de Ferrari: een andere auto ernaast
  const fer = v.avond.auto;
  const anders = g.vehicles.voegToe({ x: fer.x + 4, z: fer.z, yaw: fer.yaw, soort: 'hatch', kleur: 0x8a8f96 });
  P.inCar = anders;
  window.__stap(2);
  const a = v.avond, auto = v.avond.auto;
  const andersGenomen = auto === anders;
  // in één keer naar het eind van B: de rit klaar
  const B = a.B;
  for (let t = 0; t < 200 && v.fase === 'achtervolging'; t += 0.1) {
    const r = v.avond.rit;
    if (r) { auto.x = r.x; auto.z = r.z; P.pos.set(r.x, 0, r.z); }
    window.__stap(1, 0.1);
    if (!document.getElementById('dialoog').hidden) v.toets();
  }
  const W = v.avond.mannen;
  const begin = { fase: v.fase, aantal: W ? W.wachters.length : 0, bouwman: W && W.wachters[0].persoon === v.avond.bouwman, zichtbaar: v.avond.bouwman.groep.visible,
    leven: W ? W.wachters.map(w => w.leven) : [], mg: W ? W.wachters.filter(w => w.mg && w.persoon.wapenSoort === 'mp').length : 0 };
  // het machinegeweer schiet in salvo's: acht tellen schieten, geteld per man
  const telVuur = (w) => { let n = 0; const echt = w.persoon.vuur.bind(w.persoon); w.persoon.vuur = () => { n++; return echt(); }; return () => { w.persoon.vuur = echt; return n; }; };
  const wMg = W.wachters.find(w => w.mg), wPi = W.wachters.find((w, i) => i > 0 && !w.mg);
  const stopMg = telVuur(wMg), stopPi = telVuur(wPi);
  let schadeMg = 0, schadePi = 0;
  for (let i = 0; i < 80; i++) { schadeMg += W.schiet(wMg, 10, 0.1); schadePi += W.schiet(wPi, 10, 0.1); }
  const vuurMg = stopMg(), vuurPi = stopPi();
  window.__klik();
  // uitstappen, een eindje van de loods af
  const lo = v.schaduw.wereld.bouwmanStaat;
  P.inCar = null;
  const [sx, sz] = window.__W.resolveCollisions(lo.x - 30, lo.z - 22, 0.4);
  P.pos.set(sx, window.__W.grondHoogte(sx, sz), sz);
  window.__stap(2);
  const hulp = { mark: v.avond.mark.groep.visible, johan: v.avond.johan.groep.visible,
    dMark: Math.hypot(v.avond.mark.groep.position.x - P.pos.x, v.avond.mark.groep.position.z - P.pos.z) };
  // vijfenzestig tellen (sinds stap 127 vier levens per man en om de 5,5–8 s een treffer): Mark en Johan halen er
  // een paar neer, Bouwman niet
  for (let t = 0; t < 65 && v.fase === 'gevecht'; t += 0.1) { window.__stap(1, 0.1); if (!document.getElementById('dialoog').hidden) v.toets(); }
  const neerHulp = W.wachters.filter((w, i) => i > 0 && w.staat === 'neer').length;
  const bouwmanStaat = W.wachters[0].staat;
  // een echt schot met het pistool op een bodyguard die nog staat: één leven eraf, hij blijft staan
  let pistool = null;
  const doel = W.wachters.find((w, i) => i > 0 && w.staat !== 'neer' && w.leven >= 2);
  if (doel) {
    const q = doel.persoon.groep.position, voor = doel.leven;
    const [px, pz] = window.__W.resolveCollisions(q.x + 6, q.z + 2, 0.4);
    P.pos.set(px, window.__W.grondHoogte(px, pz), pz);
    const oog = { x: px, y: P.pos.y + P.eye, z: pz };
    const dx = q.x - oog.x, dy = q.y + 1.2 - oog.y, dz = q.z - oog.z;
    P.yaw = Math.atan2(-dx, -dz); P.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    P.applyCamera(); P.vuurKlok = 0; P.reloading = 0; P.ammo = Math.max(P.ammo, 5); P.kickPitch = 0; P.kickYaw = 0;
    g.scene.updateMatrixWorld(true);
    P.shoot();
    pistool = { voor, na: doel.leven, staat: doel.staat, wapen: P.wapenSoort };
  }
  // de sniper: in één keer
  const doel2 = W.wachters.find((w, i) => i > 0 && w.staat !== 'neer' && w.leven >= 2 && w !== doel);
  const sniper = doel2 ? (W.raak(doel2.persoon.groep, 99), doel2.staat) : null;
  // Bouwman: de speler raakt hem
  for (let i = 0; i < 12 && W.wachters[0].staat !== 'neer'; i++) { W.raak(v.avond.bouwman.groep); window.__stap(1); }
  window.__stap(4);
  const zin = document.getElementById('dialoogTekst').textContent, open = !document.getElementById('dialoog').hidden;
  window.__klik();
  for (const w of W.wachters) for (let i = 0; i < 12 && w.staat !== 'neer'; i++) { W.raak(w.persoon.groep); window.__stap(1); }
  window.__stap(4);
  const komt = v.fase;
  window.__klik();
  window.__stap(4);
  return { andersGenomen, vuurMg, vuurPi, schadeMg, schadePi, pistool, sniper, begin, hulp, neerHulp, bouwmanStaat, bouwmanNeer: W.wachters[0].staat === 'neer', zin, open, komt, fase: v.fase,
    sterren: g.politie.ster, nav: g.hud.nav && g.hud.nav.letter, inAuto: !!P.inCar };
});
ok(gev.begin.fase === 'gevecht' && gev.begin.aantal === 7 && gev.begin.bouwman && gev.begin.zichtbaar, 'bij de loods: Bouwman en zes man (stap 127)', `${gev.begin.fase}, ${gev.begin.aantal}`);
ok(gev.andersGenomen, 'in een andere auto dan de Ferrari: de achtervolging gaat met die auto');
ok(gev.begin.leven.join(',') === '5,4,4,4,4,4,4', 'niet neer met één kogel: Bouwman vijf treffers, zijn mannen vier (stap 127)', gev.begin.leven.join(', '));
ok(gev.begin.mg >= 2, 'twee bodyguards met een machinegeweer', `${gev.begin.mg}`);
ok(gev.vuurMg >= gev.vuurPi * 3 && gev.schadeMg > 0, 'het machinegeweer schiet in salvo\'s', `${gev.vuurMg} kogels tegen ${gev.vuurPi} met het pistool in 8 s; schade ${gev.schadeMg} tegen ${gev.schadePi}`);
ok(gev.pistool && gev.pistool.na === gev.pistool.voor - 1 && gev.pistool.staat !== 'neer', 'een echt schot met het pistool: één leven eraf, hij staat nog', JSON.stringify(gev.pistool));
ok(gev.sniper === 'neer', 'de sniper legt hem in één keer neer', String(gev.sniper));
ok(gev.hulp.mark && gev.hulp.johan && gev.hulp.dMark < 6, 'uitstappen: Mark en Johan stappen naast jou uit', `Mark op ${r1(gev.hulp.dMark)} m`);
ok(gev.neerHulp >= 2 && gev.bouwmanStaat !== 'neer', 'Mark en Johan halen er mannen neer, Bouwman laten ze voor jou', `${gev.neerHulp} neer, Bouwman ${gev.bouwmanStaat}`);
ok(gev.bouwmanNeer && gev.open && /Bouwman|Dat was/.test(gev.zin), 'Bouwman neer: iemand zegt het', gev.zin.slice(0, 60));
ok(gev.komt === 'politieKomt' || gev.komt === 'politie', 'iedereen neer: sirenes', gev.komt);
ok(gev.fase === 'politie' && gev.sterren === 4 && gev.nav === 'M', 'de politie: vier sterren, de nav naar de Dúvelsrak', `${gev.fase}, ${gev.sterren} sterren`);

// ------------------------------------------------------------------ 7. de Dúvelsrak
kop('de Dúvelsrak');
const brug = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player, W = window.__W;
  const a = v.avond, br = a.brugAssen, auto = a.auto;
  // een eindje vóór het dek, dan erop rijden
  const s = 4, p = br.p(s, 0);
  auto.yaw = br.noord; auto.x = p.x; auto.z = p.z; auto.speed = 17;
  if (auto.mesh) { auto.mesh.visible = true; auto.mesh.position.set(p.x, br.hoogte, p.z); auto.mesh.rotation.y = br.noord; }
  P.inCar = auto;
  window.__stap(1);
  const fase1 = v.fase;
  let camOnder = 0, camVer = 0, n = 0, maxT = 0, gezien = { gegooid: false, geknald: false };
  let politieVoorbij = 0, autoStop = null;
  for (let t = 0; t < 12 && v.fase === 'brugFilm'; t += 0.05) {
    window.__stap(1, 0.05);
    const b = v.avond.brug, c = v.avond.filmCam;
    if (!b) continue;
    n++; maxT = b.t;
    if (c) {
      const gy = W.grondHoogte(c.pos[0], c.pos[2], br.hoogte + 2);
      if (c.pos[1] < br.hoogte + 0.6) camOnder++;
      if (c.pos[1] - gy > 25) camVer++;
    }
    if (b.geknald) gezien.geknald = true;
    // de politie mag niet voorbij de bom
    for (const k of b.politie) {
      const q = a.opHetDek(k.x, k.z);
      if ((q.s - b.sBom) * b.dir > -2) politieVoorbij++;
    }
    autoStop = b;
  }
  const naBrug = v.fase, sterren = g.politie.ster;
  window.__klik();
  const zondag = window.__tot('naarStudio', 20);
  return { fase1, n, maxT, camOnder, camVer, geknald: gezien.geknald, politieVoorbij, naBrug, sterren, zondag, uur: g.sfeer.uur,
    stilV: autoStop ? autoStop.politie.map(k => k.v) : [], heli: a.heli.zichtbaar };
});
ok(brug.fase1 === 'brugFilm', 'over de Dúvelsrak: het filmbeeld', brug.fase1);
ok(brug.geknald && brug.n > 100 && brug.maxT > 6, 'Johan gooit de C4, de knal', `${brug.n} beelden, ${r1(brug.maxT)} s`);
ok(brug.politieVoorbij === 0 && brug.stilV.every(x => x < 0.5), 'de politie staat stil voor het vuur', `${brug.politieVoorbij} keer voorbij de bom, ${brug.stilV.map(r1).join(', ')} m/s`);
ok(brug.camOnder === 0 && brug.camVer === 0, 'de camera elk beeld boven het dek', `${brug.camOnder} keer onder, ${brug.camVer} keer te hoog`);
ok(brug.naBrug === 'naBrug' && brug.sterren === 0, 'en de sterren weg', `${brug.naBrug}, ${brug.sterren}`);
ok(brug.zondag && Math.abs(brug.uur - 7.75) < 0.1 && !brug.heli, 'Zondagochtend', `uur ${r1(brug.uur)}`);

// ------------------------------------------------------------------ 8. de politie anders kwijt
kop('de politie anders kwijt');
const anders = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__bij('politie');
  const fase1 = v.fase, sterren = g.politie.ster, inAuto = !!g.player.inCar;
  g.politie.reset();
  window.__stap(3);
  window.__klik();
  const zondag = window.__tot('naarStudio', 20);
  return { fase1, sterren, inAuto, zondag };
});
ok(anders.fase1 === 'politie' && anders.sterren === 4 && anders.inAuto, 'opnieuw: in de auto bij de loods, vier sterren', `${anders.fase1}, ${anders.sterren}`);
ok(anders.zondag, 'sterren kwijt zonder de brug: ook Zondagochtend');

// ------------------------------------------------------------------ 9. opnieuw per fase
kop('opnieuw per fase');
const opnieuw = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  const uit = {};
  for (const f of ['nacht', 'heli', 'luifel', 'landen', 'naarAuto', 'gevecht', 'politieKomt', 'brugFilm']) {
    window.__bij(f);
    const Wm = v.avond.mannen;
    uit[f] = { fase: v.fase, zit: g.player.zit, heli: v.avond.heli.zichtbaar, sterren: g.politie.ster, inAuto: !!g.player.inCar,
      staan: Wm ? Wm.wachters.filter(w => w.staat !== 'neer').length : 0, bouwman: Wm ? Wm.wachters[0].staat : null };
    window.__klik();
  }
  // en weg uit de missie: de heli verdwijnt
  window.__na17();
  window.__stap(2);
  uit.weg = { heli: v.avond.heli.zichtbaar, zit: g.player.zit };
  return uit;
});
for (const f of ['nacht', 'heli', 'luifel', 'landen']) ok(opnieuw[f].fase === 'heliStart' && opnieuw[f].zit && opnieuw[f].heli, `${f}: opnieuw in de heli`, opnieuw[f].fase);
ok(opnieuw.naarAuto.fase === 'naarAuto' && !opnieuw.naarAuto.zit, 'naarAuto: opnieuw bij de auto', opnieuw.naarAuto.fase);
ok(opnieuw.gevecht.fase === 'gevecht' && opnieuw.gevecht.inAuto && opnieuw.gevecht.staan === 7 && opnieuw.gevecht.bouwman !== 'neer',
  'gevecht: opnieuw bij de loods, niet de hele achtervolging over', `${opnieuw.gevecht.fase}, ${opnieuw.gevecht.staan} man, Bouwman ${opnieuw.gevecht.bouwman}`);
for (const f of ['politieKomt', 'brugFilm']) ok(opnieuw[f].fase === 'politie' && opnieuw[f].sterren === 4, `${f}: opnieuw met de politie achter je aan`, opnieuw[f].fase);
ok(!opnieuw.weg.heli && !opnieuw.weg.zit, 'laden buiten de missie: geen heli, niet meer zitten');

console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
await browser.close();
process.exit(fouten ? 1 : 0);
