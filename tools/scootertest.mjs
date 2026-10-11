/*
 Stap 138: de scooterrijder en de tracers van Mark en Johan.

   node tools/server.mjs 8123 &   node tools/scootertest.mjs [poort]   (npm run scootertest)

 1. De rijder op een scooter (`Persoon.opScooter`, de maten in SCOOTER van js/lichaam.js), voor alle drie de
    scooters: de pizzabezorger van js/leven.js, jij op de scooter van de pizzabaan (js/pizzabaan.js) en de
    handlangers van missie 18 (js/handlangers.js). Gemeten, niet bekeken:
      - elke handpalm minder dan 4 cm van het midden van zijn handgreep;
      - de ellebogen gebogen (geen planken);
      - het heupgewricht een broekdikte boven het zadel, op het zadel;
      - het laagste punt van bekken en bovenbenen boven het zadel op het zadel (niet erin, niet erboven zwevend);
      - de zolen op de treeplank, de schoenen binnen de plank;
      - de onderbenen en schoenen niet door het beenschild;
      - het hoofd vóór de heup (voorover), de knieën lager dan het stuur;
      - na het afstappen staan de benen weer recht onder hem (geen zijdraai die blijft hangen).
 2. De tracers (js/grondvuur.js): een korte streep (4 m, korter dan de streep zelf) vliegt uit en gaat weg — tot
    stap 138 bleef die eeuwig hangen —, een lange ook; na de heli zijn er geen strepen meer; in de achtervolging
    schieten Mark en Johan met strepen, en als ze ophouden zijn die binnen een tel weg.
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fouten++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);
const cm = (n) => (n == null || !isFinite(n)) ? String(n) : `${(n * 100).toFixed(1)} cm`;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  const THREE = await import('three');
  const { SCOOTER } = await import('/js/lichaam.js');
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = false;
  window.__autoplay = false;
  /*
   De meting: `root` is het assenstelsel van de scooter (voorkant −z, grond 0), `r` de rijder erop.
  */
  window.__meet = (root, r) => {
    root.updateWorldMatrix(true, true);
    r.groep.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const naar = (v) => v.clone().applyMatrix4(inv);
    const G = r.gewrichten();
    const greep = (n) => { const o = root.getObjectByName(n); return o ? o.getWorldPosition(new THREE.Vector3()) : null; };
    const gL = greep('handvatL'), gR = greep('handvatR');
    const punten = (mesh, f) => {
      const p = mesh.geometry.attributes.position, v = new THREE.Vector3();
      mesh.updateWorldMatrix(true, false);
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld).applyMatrix4(inv); f(v); }
    };
    const Z = SCOOTER.zadel, S = SCOOTER.scherm;
    // het laagste punt van bekken en bovenbenen boven het zadel
    let zitMin = Infinity;
    for (const m of [r.groep.children[1], r.beenLinks.boven.children[0], r.beenRechts.boven.children[0]]) {
      punten(m, (v) => { if (v.z > Z.z0 && v.z < Z.z1 && Math.abs(v.x) < 0.14) zitMin = Math.min(zitMin, v.y); });
    }
    // zolen en schoenen
    let zool = Infinity, voetZ = [Infinity, -Infinity], voetX = 0;
    for (const lid of [r.beenLinks, r.beenRechts]) {
      punten(lid.eind.children[0], (v) => { zool = Math.min(zool, v.y); voetZ[0] = Math.min(voetZ[0], v.z); voetZ[1] = Math.max(voetZ[1], v.z); voetX = Math.max(voetX, Math.abs(v.x)); });
    }
    // door het beenschild: een punt dat achter het voorvlak van het schild ligt (de achterkant is z + 0,06)
    let schild = 0;
    for (const lid of [r.beenLinks, r.beenRechts]) {
      for (const m of [lid.onder.children[0], lid.eind.children[0]]) {
        punten(m, (v) => {
          if (v.y < S.y - 0.35 || v.y > S.y + 0.33 || Math.abs(v.x) > 0.19) return;
          const vlak = S.z + (v.y - S.y) * Math.tan(S.rx) + 0.06;
          if (v.z < vlak) schild = Math.max(schild, vlak - v.z);
        });
      }
    }
    const hL = naar(G.heupL), hR = naar(G.heupR), kL = naar(G.knieL), kR = naar(G.knieR);
    const hoofd = naar(r.hoofd.getWorldPosition(new THREE.Vector3()));
    return {
      handL: gL ? G.handL.distanceTo(gL) : null, handR: gR ? G.handR.distanceTo(gR) : null,
      elleboog: Math.min(r.armLinks.onder.rotation.x, r.armRechts.onder.rotation.x),
      heupBoven: Math.max(hL.y, hR.y) - Z.y, heupOnder: Math.min(hL.y, hR.y) - Z.y, heupZ: (hL.z + hR.z) / 2,
      zit: zitMin - Z.y,
      zool: zool - SCOOTER.plank, voetZ, voetX,
      schild,
      voorover: (hL.z + hR.z) / 2 - hoofd.z,
      knie: Math.max(kL.y, kR.y), stuur: SCOOTER.handvat.y,
    };
  };
});

const keur = (naam, m) => {
  ok(m.handL != null && m.handL < 0.04 && m.handR < 0.04, `${naam}: beide handen om het handvat`, `links ${cm(m.handL)}, rechts ${cm(m.handR)}`);
  ok(m.elleboog > 0.25, `${naam}: de ellebogen gebogen`, `${(m.elleboog * 180 / Math.PI).toFixed(0)}°`);
  ok(m.heupOnder > 0.04 && m.heupBoven < 0.1, `${naam}: het heupgewricht een broekdikte boven het zadel`, `${cm(m.heupOnder)}–${cm(m.heupBoven)}`);
  ok(m.heupZ > 0.12 && m.heupZ < 0.4, `${naam}: op het zadel, niet erachter`, `z ${m.heupZ.toFixed(2)} (zadel 0,10–0,66)`);
  ok(m.zit > -0.03 && m.zit < 0.02, `${naam}: de billen op het zadel (niet erin, niet erboven)`, `laagste punt ${cm(m.zit)} van de zitting`);
  ok(m.zool > -0.025 && m.zool < 0.02, `${naam}: de zolen op de treeplank`, `${cm(m.zool)}`);
  ok(m.voetZ[0] > -0.38 && m.voetZ[1] < 0.42 && m.voetX < 0.19, `${naam}: de schoenen binnen de plank`, `z ${m.voetZ.map(q => q.toFixed(2)).join('…')}, |x| ${m.voetX.toFixed(2)}`);
  ok(m.schild < 0.01, `${naam}: de benen niet door het beenschild`, cm(m.schild));
  ok(m.voorover > 0.08, `${naam}: licht voorover`, `hoofd ${cm(m.voorover)} vóór de heup`);
  ok(m.knie < m.stuur - 0.05, `${naam}: de knieën onder het stuur`, `knie ${m.knie.toFixed(2)} m, stuur ${m.stuur.toFixed(2)} m`);
};

// ------------------------------------------------------------------ 1. de rijders
kop('de pizzabezorger (js/leven.js)');
const lv = await page.evaluate(() => {
  const g = window.__game, l = g.leven, sp = { x: 900, z: -150 };
  let gestart = false;
  for (let k = 0; k < 8 && !gestart; k++) { l.pizzaWeg(); gestart = l.startPizza(sp, () => false, { zeker: true }); }
  if (!gestart) return { geen: true };
  for (let i = 0; i < 20 && l.pizza.fase === 'heen'; i++) l.update(0.1, sp, () => false, 18);
  const fase = l.pizza.fase;
  const m = window.__meet(l.scooter, l.rijder);
  // tot hij afstapt: de benen weer recht
  for (let i = 0; i < 4000 && l.pizza.fase === 'heen'; i++) l.update(0.1, sp, () => false, 18);
  for (let i = 0; i < 10; i++) l.update(0.1, sp, () => false, 18);
  const zij = Math.max(Math.abs(l.rijder.beenLinks.boven.rotation.z), Math.abs(l.rijder.beenRechts.boven.rotation.z));
  const naFase = l.pizza.fase;
  l.pizzaWeg();
  return { fase, m, zij, naFase };
});
ok(!lv.geen && lv.fase === 'heen', 'hij rijdt', lv.fase);
if (!lv.geen) keur('bezorger', lv.m);
ok(lv.zij < 0.01, 'na het afstappen staan zijn benen weer recht', `${lv.naFase}: zijdraai ${lv.zij}`);

kop('jij op de scooter van de pizzabaan (js/pizzabaan.js)');
const pb = await page.evaluate(() => {
  const g = window.__game, P = g.pizzabaan;
  const car = P && P.scooters[0];
  if (!car || !P.rijder) return { geen: true };
  // zoals `update` het doet als je erop zit en van buiten kijkt
  const zp = car.mesh.userData.zitPlek;
  zp.add(P.rijder.groep); P.rijder.groep.visible = true;
  P.rijder.opScooter(0.05, zp.position);
  const m = window.__meet(car.mesh.userData.bak, P.rijder);
  P.rijder.groep.visible = false;
  const bron = [];
  return { m };
});
ok(!pb.geen, 'de scooter en zijn rijder');
if (!pb.geen) keur('pizzabaan', pb.m);

kop('de handlangers van missie 18 (js/handlangers.js)');
const hl = await page.evaluate(async () => {
  const H = await import('/js/handlangers.js');
  const sc = H.maakScooter();
  sc.rijder.opScooter(0.05, sc.zit.position);
  return { m: window.__meet(sc.mesh, sc.rijder) };
});
keur('handlanger', hl.m);

const bron = await page.evaluate(async () => {
  const t = async (f) => (await fetch(f).then(r => r.text()));
  return { leven: await t('/js/leven.js'), pb: await t('/js/pizzabaan.js'), hl: await t('/js/handlangers.js') };
});
ok(!/rijder\.update\(dt, \{ zit:/.test(bron.leven) && !/rijder\.update\(dt, \{ zit:/.test(bron.pb) && !/rijder\.update\(dt, \{ zit:/.test(bron.hl),
  'geen enkele scooterrijder zit nog met de houding van de bank');

// ------------------------------------------------------------------ 2. de tracers
kop('de tracers');
const tr = await page.evaluate(async () => {
  const THREE = await import('three');
  const { maakGrondvuur } = await import('/js/grondvuur.js');
  const sc = new THREE.Scene();
  const G = maakGrondvuur(sc);
  const zichtbaar = () => sc.children.filter(o => o.visible && o.geometry && o.geometry.type === 'BoxGeometry').length;
  const vlieg = (lengte) => {
    G.streep(new THREE.Vector3(0, 1.4, 0), new THREE.Vector3(0, 1.1, -lengte));
    const aan = G.strepen;
    let t = 0;
    for (; t < 3 && G.strepen; t += 0.05) G.update(0.05, null);
    return { aan, t, na: G.strepen, zichtbaar: zichtbaar() };
  };
  return { kort: vlieg(4), heel: vlieg(1.5), lang: vlieg(60) };
});
ok(tr.kort.aan === 1 && tr.kort.na === 0 && tr.kort.zichtbaar === 0 && tr.kort.t < 0.3, 'een korte streep (4 m) vliegt uit en is weg', `na ${tr.kort.t.toFixed(2)} s`);
ok(tr.heel.na === 0 && tr.heel.t < 0.3, 'een heel korte (1,5 m) ook', `na ${tr.heel.t.toFixed(2)} s`);
ok(tr.lang.na === 0 && tr.lang.t < 0.6, 'een lange (60 m) ook', `na ${tr.lang.t.toFixed(2)} s`);

kop('missie 18: na de heli en in de achtervolging');
await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
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
  window.__bij = (fase) => {
    if (v.missie !== 'uitzending') { window.__na17(); v.startMissie('uitzending'); window.__stap(2); }
    const s = v.bewaar(); s.missie = 'uitzending'; s.fase = fase;
    g.politie.reset();
    v.herstel(s);
    window.__stap(2);
  };
});
const m18 = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  window.__bij('heli');
  window.__tot('heli', 12);
  const G = v.avond.grondvuur;
  let maxH = 0;
  for (let t = 0; t < 60 && G.schoten < 3; t += 0.05) { v.update(0.05); P.health = 100; maxH = Math.max(maxH, G.strepen); }
  const inHeli = G.strepen;
  // landen en naar de auto (zoals het verhaal na de luifel, en zoals laden of opnieuw)
  window.__bij('naarAuto');
  const naHeli = G.strepen;
  window.__klik();
  window.__stap(20);
  const naarAuto = G.strepen;
  return { fase: v.fase, maxH, inHeli, naHeli, naarAuto };
});
ok(m18.maxH >= 1, 'in de heli schieten ze met tracers', `${m18.maxH} tegelijk`);
ok(m18.naHeli === 0 && m18.naarAuto === 0, 'na de heli geen enkele streep meer in de lucht', `${m18.naHeli}, een tel later ${m18.naarAuto} (${m18.fase})`);
const ach = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player, W = window.__W;
  const a = v.avond; P.inCar = a.auto; window.__stap(2);
  const fase = v.fase;
  const H = v.avond.handlangers, G = v.avond.grondvuur;
  let max = 0;
  for (let i = 0; i < 400; i++) {
    const B = v.avond.B;
    const ach = H.mannen.length ? Math.min(...H.mannen.map(m => m.s)) : 0;
    const k = Math.min(B.n - 1, Math.max(0, Math.round((ach - 6) / 2)));
    a.auto.x = B.x[k]; a.auto.z = B.z[k]; a.auto.yaw = Math.atan2(-B.tx[k], -B.tz[k]); a.auto.speed = v.avond.rit ? v.avond.rit.v : 10;
    if (a.auto.mesh) a.auto.mesh.position.set(B.x[k], a.auto.mesh.position.y, B.z[k]);
    P.health = 100; window.__stap(1);
    max = Math.max(max, G.strepen);
    if (v.fase !== 'achtervolging') break;
  }
  // ze houden op (jij stapt uit): binnen een tel zijn alle strepen uitgevlogen
  P.inCar = null;
  let t = 0;
  for (; t < 2 && G.strepen; t += 0.05) { P.health = 100; window.__stap(1); }
  return { fase, max, t, na: G.strepen };
});
ok(ach.fase === 'achtervolging', 'de achtervolging', ach.fase);
ok(ach.max >= 1, 'Mark en Johan schieten uit de Ferrari, met hun eigen tracers', `${ach.max} tegelijk`);
ok(ach.na === 0 && ach.t <= 1, 'en hun strepen blijven niet hangen', `alle weg na ${ach.t.toFixed(2)} s`);

console.log(fouten ? `\n${fouten} fout(en)` : '\nAlles goed.');
console.log('EINDE');
await browser.close();
process.exit(fouten ? 1 : 0);
