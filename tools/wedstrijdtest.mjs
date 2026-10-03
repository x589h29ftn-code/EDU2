/*
 Stap 111: de terugslag van de sniper, en de wedstrijd op het hoofdveld van VV Sneek.

   node tools/server.mjs 8123 &   node tools/wedstrijdtest.mjs [poort]   (npm run wedstrijdtest)

 1. De sniper: de terugslag per schot uit de heup en door de kijker, tegen het pistool en tegen
    de oude waarden (2,6 met 42 % door de kijker); hij zakt trager terug maar is na een seconde
    weg; een schot schudt het beeld (`schok`).
 2. De wedstrijd: elftallen, scheidsrechter en publiek; niets om elf uur; om half een begint hij
    alleen als je niet kijkt; om half vier blijft hij zolang je kijkt en is hij weg als je wegkijkt.
 3. Spelen, tien minuten lang gemeten: de bal beweegt, er wordt overgespeeld en geschoten,
    iedereen blijft op en om het veld, de keepers bij hun doel, geen NaN, de tijd per beeld.
 4. Een doelpunt: de stand, gejuich, en aftrappen vanaf de middenstip.
 5. Het publiek: op de treden van de tribune, en langs de lijn.
 6. Aanrijden: wie geraakt wordt ligt, de wedstrijd is gestaakt, de rest rent weg; uit beeld weg,
    die dag geen nieuwe wedstrijd, de volgende dag wel.
 7. Een kogel op een speler; en de borden rond het veld houden een auto niet tegen.
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fouten++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);
const r2 = (n) => (n == null || !isFinite(n)) ? String(n) : n.toFixed(2);

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
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = false;
  window.__autoplay = false;
  window.__W = W;
  // de camera: kijkend naar (kx, kz) vanaf (x, z), op ooghoogte; of ver weg en de andere kant op
  window.__kijk = (x, z, kx, kz, y = 1.7) => {
    const P = g.player; P.inCar = null;
    P.pos.set(x, y - P.eye, z);
    P.yaw = Math.atan2(-(kx - x), -(kz - z)); P.pitch = Math.atan2(-0.3, Math.hypot(kx - x, kz - z));
    P.applyCamera(); g.camera.updateMatrixWorld();
  };
  window.__wed = (n = 1, dt = 0.1) => { for (let i = 0; i < n; i++) g.werkWedstrijdBij(dt); };
});

// ------------------------------------------------------------------ 1. de sniper
kop('de sniper');
const sniper = await page.evaluate(() => {
  const g = window.__game, P = g.player;
  P.wapens = ['pistool', 'mitrailleur', 'sniper'];
  const kies = (soort) => { P.wapenNr = P.wapens.indexOf(soort); };
  const meet = (soort, mik) => {
    kies(soort);
    let som = 0;
    for (let i = 0; i < 12; i++) {
      P.mik = mik; P.kickPitch = 0; P.kickYaw = 0; P.vuurKlok = 0; P.reloading = 0; P.ammo = 5;
      P.shoot(); som += P.kickPitch;
    }
    return som / 12;
  };
  const pistool = meet('pistool', 0);
  const heup = meet('sniper', 0), kijker = meet('sniper', 1);
  // terugzakken: na een kwart seconde nog te zien, na een seconde weg
  P.mik = 1; P.kickPitch = 0; P.vuurKlok = 0; P.ammo = 5; P.shoot();
  const begin = P.kickPitch;
  for (let i = 0; i < 25; i++) P.demptTerugslag(0.01);
  const kwart = P.kickPitch;
  for (let i = 0; i < 75; i++) P.demptTerugslag(0.01);
  const sec = P.kickPitch;
  // het beeld schudt
  g.__schokNul();
  P.vuurKlok = 0; P.ammo = 5; P.shoot();
  const schok = g.__schokKracht();
  kies('pistool'); P.mik = 0;
  // de oude sniper: 2,6 met 42 % door de kijker, gemiddeld (0,026 + 0,005) per kick
  const oud = { heup: 0.031 * 2.6, kijker: 0.031 * 2.6 * 0.42 };
  return { pistool, heup, kijker, oud, begin, kwart, sec, schok };
});
ok(sniper.kijker > sniper.oud.kijker * 1.9, 'door de kijker bijna twee keer zo hard als voorheen',
  `${(sniper.kijker * 57.3).toFixed(1)}° tegen ${(sniper.oud.kijker * 57.3).toFixed(1)}°`);
ok(sniper.heup > sniper.oud.heup * 1.4 && sniper.heup > sniper.pistool * 3, 'uit de heup harder dan voorheen, en veel harder dan het pistool',
  `${(sniper.heup * 57.3).toFixed(1)}° (oud ${(sniper.oud.heup * 57.3).toFixed(1)}°, pistool ${(sniper.pistool * 57.3).toFixed(1)}°)`);
ok(sniper.kwart > sniper.begin * 0.25 && sniper.sec < 0.002, 'je ziet de klap: na een kwart seconde nog een kwart, na een seconde weg',
  `${(sniper.kwart / sniper.begin * 100).toFixed(0)} %, dan ${(sniper.sec * 57.3).toFixed(3)}°`);
ok(sniper.schok >= 0.3, 'een sniperschot schudt het beeld', r2(sniper.schok));

// ------------------------------------------------------------------ 2. komen en gaan
kop('komen en gaan');
const komen = await page.evaluate(() => {
  const g = window.__game, w = g.wedstrijd, V = w.veld, sf = g.sfeer;
  if (!w) return { geen: true };
  const uit = { spelers: w.spelers.length, publiek: w.publiek.length, scheids: !!w.scheids, veld: V.naam };
  const weg = () => window.__kijk(V.cx + 600, V.cz + 600, V.cx + 1200, V.cz + 1200);   // ver weg, de andere kant op
  const erbij = () => window.__kijk(V.cx - 70, V.cz - 70, V.cx, V.cz);                  // naast het veld, kijkend
  w.weg(); w.st.dag = -1;
  sf.uur = 11; weg(); window.__wed(3);
  uit.elf = w.aanwezig;
  sf.uur = 12.5; erbij(); window.__wed(3);
  uit.kijkend = w.aanwezig;
  weg(); window.__wed(3);
  uit.weggekeken = w.aanwezig;
  // om half vier: zolang je kijkt blijft hij
  erbij(); window.__wed(3);
  sf.uur = 15.5; window.__wed(3);
  uit.drieKijkend = w.aanwezig && w.groep.visible;
  weg(); window.__wed(3);
  uit.drieWeg = w.aanwezig;
  // en dezelfde dag geen tweede keer
  sf.uur = 13; window.__wed(3);
  uit.zelfdeDag = w.aanwezig;
  return uit;
});
ok(!komen.geen && komen.spelers === 22 && komen.scheids && komen.publiek >= 14, 'twee elftallen, een scheidsrechter en publiek', `${komen.spelers} spelers, ${komen.publiek} toeschouwers, ${komen.veld}`);
ok(!komen.elf, 'om elf uur is er niemand');
ok(!komen.kijkend && komen.weggekeken, 'om half een: niet terwijl je kijkt, wel zodra je wegkijkt');
ok(komen.drieKijkend && !komen.drieWeg, 'om half vier: blijft zolang je kijkt, weg als je wegkijkt');
ok(!komen.zelfdeDag, 'dezelfde dag geen tweede wedstrijd');

// ------------------------------------------------------------------ 3. spelen
kop('spelen');
const spel = await page.evaluate(() => {
  const g = window.__game, w = g.wedstrijd, V = w.veld, sf = g.sfeer;
  sf.uur = 13; w.st.dag = -1;
  window.__kijk(V.cx + 600, V.cz + 600, V.cx + 1200, V.cz + 1200);
  window.__wed(2);
  const begin = w.aanwezig;
  // dichtbij staan, maar met de rug naar het veld: dan wordt er gespeeld
  window.__kijk(V.cx - 80, V.cz - 80, V.cx - 200, V.cz - 200);
  const hl = V.vl / 2, hb = V.vb / 2;
  let balWeg = 0, vorig = null, buiten = 0, keeperVer = 0, nan = 0, ms = 0, n = 0, maxBal = 0;
  const s0 = { ...w.st };
  for (let i = 0; i < 6000; i++) {
    const t0 = performance.now();
    g.werkWedstrijdBij(0.1);
    ms += performance.now() - t0; n++;
    const b = w.bal;
    if (vorig) balWeg += Math.hypot(b.u - vorig.u, b.v - vorig.v);
    vorig = { u: b.u, v: b.v };
    if (!isFinite(b.u) || !isFinite(b.v)) nan++;
    maxBal = Math.max(maxBal, Math.abs(b.u) - hl, Math.abs(b.v) - hb);
    if (i % 10 === 0) {
      for (const s of w.spelers) {
        if (!isFinite(s.u) || !isFinite(s.v)) nan++;
        if (Math.abs(s.u) > hl + 4 || Math.abs(s.v) > hb + 4) buiten++;
        if (s.keeper) keeperVer = Math.max(keeperVer, hl - (s.team === 0 ? -s.u : s.u));
      }
    }
  }
  // staan ze op de grond?
  const hoog = Math.max(...w.spelers.map(s => Math.abs(s.p.groep.position.y - s.p.grond)));
  return { begin, balWeg, buiten, keeperVer, nan, ms: ms / n, maxBal, passes: w.st.passes - s0.passes, schoten: w.st.schoten - s0.schoten,
    uit: w.st.uit - s0.uit, doelpunten: w.st.doelpunten - s0.doelpunten, stand: w.stand, hoog, gestaakt: w.gestaakt };
});
ok(spel.begin, 'om één uur, uit beeld: de wedstrijd begint');
ok(spel.balWeg > 1500 && spel.passes > 40 && spel.schoten >= 3 && spel.doelpunten <= 4, 'tien minuten spelen: de bal gaat rond, overspelen en schieten (en niet elke minuut een doelpunt)',
  `${spel.balWeg.toFixed(0)} m, ${spel.passes} passes, ${spel.schoten} schoten, ${spel.uit} keer uit, ${spel.doelpunten} doelpunten (${spel.stand.join('-')})`);
ok(spel.buiten === 0 && spel.maxBal < 4 && spel.nan === 0, 'iedereen blijft op het veld, de bal ook, en geen NaN', `bal hoogstens ${r2(spel.maxBal)} m buiten de lijn`);
ok(spel.keeperVer < 18, 'de keepers blijven bij hun doel', `hoogstens ${r2(spel.keeperVer)} m van de doellijn`);
ok(spel.hoog < 0.2, 'op de grond', `${r2(spel.hoog)} m`);
ok(spel.ms < 25, 'de tijd per beeld', `${r2(spel.ms)} ms (headless)`);

// ------------------------------------------------------------------ 4. een doelpunt
kop('een doelpunt');
const goal = await page.evaluate(() => {
  const g = window.__game, w = g.wedstrijd, V = w.veld, b = w.bal;
  const hl = V.vl / 2;
  const voor = w.stand;
  w.st.pauzeT = 0; w.st.naDoel = false;
  b.inHanden = null; b.u = hl - 3; b.v = 0.5; b.h = 0.3; b.vu = 14; b.vv = 0; b.vh = 0;
  // keepers even weg
  for (const s of w.spelers) if (s.keeper) s.u = 0;
  let juichers = 0;
  for (let i = 0; i < 8; i++) { g.werkWedstrijdBij(0.1); juichers = Math.max(juichers, w.publiek.filter(p => p.juich > 0).length); }
  const na = w.stand;
  // de aftrap: de bal komt op de middenstip
  let balMidden = Infinity;
  for (let i = 0; i < 80; i++) { g.werkWedstrijdBij(0.1); balMidden = Math.min(balMidden, Math.hypot(b.u, b.v)); }
  return { voor, na, juichers, balMidden, later: w.stand };
});
ok(goal.na[0] === goal.voor[0] + 1, 'een bal over de lijn, tussen de palen: VV Sneek scoort', `${goal.voor.join('-')} → ${goal.na.join('-')}`);
ok(goal.juichers > 5, 'het publiek juicht', `${goal.juichers}`);
ok(goal.balMidden < 0.5 && goal.later[0] === goal.na[0], 'daarna aftrappen vanaf de middenstip (en het telt één keer)', `${r2(goal.balMidden)} m van het midden, ${goal.later.join('-')}`);

// ------------------------------------------------------------------ 5. het publiek
kop('het publiek');
const pub = await page.evaluate(() => {
  const g = window.__game, w = g.wedstrijd, W = window.__W;
  const trib = w.publiek.filter(p => p.houder), langs = w.publiek.filter(p => !p.houder);
  const boven = trib.map(p => p.houder.position.y - W.grondHoogte(p.houder.position.x, p.houder.position.z));
  return { trib: trib.length, langs: langs.length, minBoven: Math.min(...boven), maxBoven: Math.max(...boven),
    zitten: trib.every(p => p.zit) };
});
ok(pub.trib >= 10 && pub.zitten && pub.minBoven > 0.2 && pub.maxBoven < 1.6, 'op de treden van de tribune, zittend',
  `${pub.trib} man, ${r2(pub.minBoven)}–${r2(pub.maxBoven)} m boven de grond`);
ok(pub.langs >= 4, 'en een paar langs de lijn', `${pub.langs}`);

// ------------------------------------------------------------------ 6. aanrijden
kop('aanrijden');
const rij = await page.evaluate(() => {
  const g = window.__game, w = g.wedstrijd, V = w.veld, sf = g.sfeer;
  const s = w.spelers.find(q => !q.keeper && !q.neer);
  const p = s.p.groep.position;
  const voor = w.spelers.map(q => ({ x: q.p.groep.position.x, z: q.p.groep.position.z }));
  // te zacht: niets
  const zacht = g.aanrijden(p.x, p.z, 1.5, 2);
  const n = g.aanrijden(p.x, p.z, 1.5, 12);
  const geraakt = s.neer;
  const gestaakt = w.gestaakt;
  // kijkend: een gestaakte wedstrijd blijft staan zolang je kijkt (en ook daarna nog een poos)
  window.__kijk(V.cx - 80, V.cz - 80, V.cx, V.cz);
  for (let i = 0; i < 50; i++) g.werkWedstrijdBij(0.1);
  const gevlucht = w.spelers.filter((q, i) => !q.neer && Math.hypot(q.p.groep.position.x - voor[i].x, q.p.groep.position.z - voor[i].z) > 15).length;
  const ligt = s.omT;
  const slacht = w.slachtoffers.length;
  // even wegkijken: de slachtoffers blijven liggen (de ambulance); ver weg: dan is het opgeruimd
  window.__kijk(V.cx - 80, V.cz - 80, V.cx - 200, V.cz - 200);
  window.__wed(3);
  const blijft = w.aanwezig && w.gestaakt;
  window.__kijk(V.cx + 600, V.cz + 600, V.cx + 1200, V.cz + 1200);
  window.__wed(3);
  const weg = !w.aanwezig;
  window.__wed(3);
  const zelfde = w.aanwezig;
  sf.uur = 23.5; window.__wed(1); sf.uur = 0.5; window.__wed(1); sf.uur = 13; window.__wed(2);
  const volgende = w.aanwezig && !w.gestaakt && w.spelers.every(q => !q.neer);
  return { zacht, n, geraakt, gestaakt, gevlucht, ligt, slacht, blijft, weg, zelfde, volgende, ster: g.politie.ster };
});
ok(rij.zacht === 0, 'stapvoets: niemand gaat neer');
ok(rij.n >= 1 && rij.geraakt && rij.gestaakt, 'hard erop: hij ligt, en de wedstrijd is gestaakt', `${rij.n} geraakt`);
ok(rij.ligt >= 1 && rij.slacht >= 1, 'hij blijft liggen (voor de ambulance)', `${rij.slacht} slachtoffer(s)`);
ok(rij.gevlucht >= 15, 'de rest rent weg', `${rij.gevlucht} van de 21`);
ok(rij.ster >= 1, 'aanrijden kost een ster', `${rij.ster}`);
ok(rij.blijft, 'even wegkijken: wie ligt blijft liggen (voor de ambulance)');
ok(rij.weg && !rij.zelfde, 'ver weg en uit beeld: opgeruimd, en die dag geen nieuwe');
ok(rij.volgende, 'de volgende dag weer een wedstrijd, iedereen op de been');

// ------------------------------------------------------------------ 7. een kogel, en de borden
kop('een kogel, en de borden');
const kogel = await page.evaluate(() => {
  const g = window.__game, w = g.wedstrijd, V = w.veld, P = g.player, W = window.__W;
  g.politie.reset();
  const s = w.spelers.find(q => !q.keeper && !q.neer);
  const q = s.p.groep.position;
  window.__kijk(q.x + 8, q.z + 3, q.x, q.z);
  window.__wed(1);
  // nog eens precies mikken op zijn borst, na de laatste stap
  const oog = { x: P.pos.x, y: P.pos.y + P.eye, z: P.pos.z };
  const dx = q.x - oog.x, dy = q.y + 1.2 - oog.y, dz = q.z - oog.z;
  P.yaw = Math.atan2(-dx, -dz); P.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  P.applyCamera();
  P.wapenNr = P.wapens.indexOf('pistool'); P.vuurKlok = 0; P.ammo = 5; P.reloading = 0; P.kickPitch = 0; P.kickYaw = 0; P.mik = 0;
  g.scene.updateMatrixWorld(true);
  P.shoot();
  // de botsdozen van borden en hek rond het veld: lager dan 3,5 m, dan rijdt een auto erdoorheen
  // langs de zijlijnen (niet achter de doelen: daar staan de ballenvangers, en niet de tribune)
  const hl = V.vl / 2, hb = V.vb / 2;
  // (de kant zonder de tribune: aan de tribunekant staan de tribune en de kantine)
  const kant = V.tribune ? -V.tribune.kant : 1;
  const rond = W.colliders.filter(c => { const q = w.naarUV(c.cx, c.cz); return Math.abs(q.u) < hl - 2 && q.v * kant > hb - 0.5 && q.v * kant < hb + 4; });
  const hoog = rond.filter(c => (c.h ?? 8) >= 3.5).length;
  return { neer: s.neer, gestaakt: w.gestaakt, rond: rond.length, hoog };
});
ok(kogel.neer && kogel.gestaakt, 'een kogel op een speler: hij gaat neer en de wedstrijd stopt');
ok(kogel.rond > 5 && kogel.hoog === 0, 'langs de overkant houden de borden en het hek een auto niet tegen (lager dan 3,5 m)', `${kogel.rond} dozen, ${kogel.hoog} hoger`);

console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
await browser.close();
process.exit(fouten ? 1 : 0);
