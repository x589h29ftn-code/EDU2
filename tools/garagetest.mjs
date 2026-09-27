/*
 Autohuis Lemmerweg: de glazen showroom aan de Lemmerweg (verzoek 27 sep 2026).

   node tools/server.mjs 8123 &   node tools/garagetest.mjs [poort]

 1. De plek: geen pand, geen rijbaan en geen water onder het gebouw, het
    voorterrein en de inrit; geen boom, struik of gras in 3D erbinnen.
 2. Het gebouw: glazen gevels waar je doorheen de auto's ziet, muren die je
    tegenhouden, en een schuifdeur die alleen voor wie te voet is opengaat.
 3. Drie auto's binnen: een rode en een gele Ferrari van € 3.000 en een rode
    BX van € 250. Te weinig geld: niets gekocht. Wel genoeg: de auto staat
    buiten op het voorterrein en het geld is eraf.
 4. De Ferrari: laag, breed, niets door de banden, en een hoge topsnelheid
    (ruim 200 km/u); een gewone auto en de BX blijven rond de 80.
 5. Opslaan en laden: wat je gekocht hebt blijft van jou, ook als je erin zit.
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
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  localStorage.removeItem('tinga.spel.v1');
  localStorage.removeItem('tinga.checkpoint.v1');
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  window.__stap = (n = 10, dt = 0.05) => {
    for (let i = 0; i < n; i++) { g.verhaal.update(dt); g.garage.update(dt, false); }
  };
  window.__zet = (x, z) => { g.player.inCar = null; g.player.pos.set(x, 0, z); g.player.applyCamera(); };
  window.__geld = (n) => { const v = g.verhaal; v.betaal(v.geld); v.verdien(n); };
});

// ------------------------------------------------------------------ de plek
kop('de plek');
const plek = await page.evaluate(async () => {
  const THREE = await import('three');
  const W = await import('/js/world.js');
  const K = await import('/js/kaartwereld.js');
  const { GARAGE, inBouwvlak } = await import('/js/bouwvlak.js');
  const vlakken = [GARAGE, GARAGE.voor, GARAGE.inrit];
  let inPand = 0, water = 0, rijbaan = 0, punten = 0;
  for (const r of vlakken) for (let x = r.x0 + 0.25; x < r.x1; x += 0.5) for (let z = r.z0 + 0.25; z < r.z1; z += 0.5) {
    punten++;
    if (K.inPand(x, z)) inPand++;
    if (W.pointInWater(x, z)) water++;
    const v = K.vlakOp(x, z);
    if (v && (v.k === 'rijbaan' || v.k === 'water') && r === GARAGE) rijbaan++;
  }
  const bomen = W.treePositions.filter(t => inBouwvlak(t.x, t.z)).length;
  const bomenBijGebouw = W.treePositions.filter(t => t.x > GARAGE.x0 - 2 && t.x < GARAGE.x1 + 2 && t.z > GARAGE.z0 - 2 && t.z < GARAGE.z1 + 2).length;
  const gras = window.__game.grasVeld;
  // de pollen gras in 3D: kijk of er een op de vloer van de showroom staat
  let pollen = 0;
  if (gras) {
    gras.update(779, 133, true);
    const im = gras.mesh, mat = new THREE.Matrix4();
    for (let i = 0; i < im.count; i++) {
      im.getMatrixAt(i, mat);
      const x = mat.elements[12], z = mat.elements[14];
      if (x > GARAGE.x0 && x < GARAGE.x1 && z > GARAGE.z0 && z < GARAGE.z1) pollen++;
    }
  }
  // de weg: de inrit sluit aan op een rijbaan van de Lemmerweg
  const aan = K.vlakOp(GARAGE.inrit.x0 - 0.8, (GARAGE.inrit.z0 + GARAGE.inrit.z1) / 2);
  return { punten, inPand, water, rijbaan, bomen, bomenBijGebouw, pollen, gras: !!gras, aan: aan ? aan.k : null,
    garage: !!window.__game.garage };
});
ok(plek.garage, 'de showroom staat in de wereld');
ok(plek.inPand === 0, 'geen pand onder het gebouw, het voorterrein of de inrit', `${plek.punten} punten`);
ok(plek.water === 0, 'geen water eronder (de sloot begint pas ten zuiden van de inrit)');
ok(plek.rijbaan === 0, 'het gebouw staat niet op een rijbaan');
ok(plek.aan === 'rijbaan', 'de inrit sluit aan op de rijbaan van de Lemmerweg', `vlak voor de inrit: ${plek.aan}`);
ok(plek.bomen === 0 && plek.bomenBijGebouw === 0, 'geen boom in of vlak bij het gebouw', `${plek.bomen} op het bouwvlak`);
ok(!plek.gras || plek.pollen === 0, 'geen gras in 3D op de vloer van de showroom', `${plek.pollen} pollen`);

// ------------------------------------------------------------------ het gebouw
kop('het gebouw');
const gebouw = await page.evaluate(async () => {
  const THREE = await import('three');
  const W = await import('/js/world.js');
  const g = window.__game, G = g.garage, m = G.maten;
  // glas: doorzichtig, en door de voorgevel zie je de rode Ferrari
  const glas = [];
  G.groep.traverse(o => { if (o.isMesh && o.material && o.material.transparent && o.material.opacity < 0.5) glas.push(o); });
  const rood = G.modellen.find(a => a.id === 'ferrari_rood');
  const ray = new THREE.Raycaster();
  const van = new THREE.Vector3(m.x0 - 6, 1.0, rood.z + 0.3);
  const naar = new THREE.Vector3(rood.x, 0.8, rood.z + 0.3).sub(van).normalize();
  ray.set(van, naar);
  G.groep.updateMatrixWorld(true);
  const hits = ray.intersectObject(G.groep, true);
  const eersteGlas = hits.find(h => h.object.material && h.object.material.transparent);
  const eersteDicht = hits.find(h => !(h.object.material && h.object.material.transparent));
  let inAuto = false;
  if (eersteDicht) { let o = eersteDicht.object; while (o) { if (o === rood.auto) inAuto = true; o = o.parent; } }
  // de muren houden je tegen: tegen het glas, tegen de achtergevel en tegen de zijgevel
  const [gx] = W.resolveCollisions(m.x0 - 0.1, 125, 0.35);
  const [, sz] = W.resolveCollisions(784, m.z0 - 0.1, 0.35);
  const [ax] = W.resolveCollisions(m.x1 + 0.1, 133, 0.35);
  // en een auto ook (die negeert alles onder de 3,5 m)
  const [cx] = W.resolveCollisions(m.x0 - 0.2, 125, 0.95, 3.5);
  return {
    glas: glas.length, dekking: glas.length ? Math.max(...glas.map(o => o.material.opacity)) : 1,
    glasGeraakt: !!eersteGlas, dichtbijAuto: inAuto,
    eersteGlas: eersteGlas ? +eersteGlas.distance.toFixed(2) : null, eersteDicht: eersteDicht ? +eersteDicht.distance.toFixed(2) : null,
    tegenGlas: +(gx - (m.x0 - 0.1)).toFixed(2), tegenZij: +((m.z0 - 0.1) - sz).toFixed(2), tegenAchter: +(ax - (m.x1 + 0.1)).toFixed(2),
    autoTegen: +((m.x0 - 0.2) - cx).toFixed(2), hoog: m.hoog,
  };
});
ok(gebouw.glas >= 6 && gebouw.dekking <= 0.3, 'glazen gevels, doorzichtig', `${gebouw.glas} ruiten, dekking ${gebouw.dekking}`);
ok(gebouw.glasGeraakt && gebouw.dichtbijAuto && gebouw.eersteGlas < gebouw.eersteDicht,
  'door de voorgevel zie je de rode Ferrari staan', `glas op ${gebouw.eersteGlas} m, auto op ${gebouw.eersteDicht} m`);
ok(gebouw.tegenGlas < -0.2 && gebouw.tegenZij > 0.2 && gebouw.tegenAchter > 0.2,
  'de voorgevel, de zijgevel en de achtergevel houden je tegen', JSON.stringify({ voor: gebouw.tegenGlas, zij: gebouw.tegenZij, achter: gebouw.tegenAchter }));
ok(gebouw.autoTegen > 0.3, 'en een auto rijdt niet door het glas', `${gebouw.autoTegen} m teruggeduwd`);

const deur = await page.evaluate(() => {
  const g = window.__game, G = g.garage, d0 = G.deur;
  window.__zet(d0.x - 2.2, d0.z);
  window.__stap(30);
  const open = G.deur;
  window.__zet(d0.x - 12, d0.z);
  window.__stap(30);
  const dicht = G.deur;
  // in een auto voor de deur: dicht
  const auto = g.vehicles.cars.find(c => c.driveable !== false);
  const oud = { x: auto.x, z: auto.z };
  g.player.pos.set(d0.x - 2.2, 0, d0.z); auto.x = d0.x - 2.2; auto.z = d0.z; g.player.inCar = auto;
  window.__stap(30);
  const metAuto = G.deur;
  g.player.inCar = null; auto.x = oud.x; auto.z = oud.z;
  // en naar binnen lopen
  window.__zet(d0.x - 2.2, d0.z);
  window.__stap(30);
  return { open, dicht, metAuto };
});
ok(deur.open.open === 1 && deur.open.bots === 0, 'de schuifdeur gaat open als je ervoor staat', JSON.stringify(deur.open));
ok(deur.dicht.open === 0 && deur.dicht.bots > 3.5, 'en weer dicht als je wegloopt', JSON.stringify(deur.dicht));
ok(deur.metAuto.open === 0, 'maar niet voor een auto', JSON.stringify(deur.metAuto));
const binnen = await page.evaluate(async () => {
  const W = await import('/js/world.js');
  const g = window.__game, G = g.garage, d = G.deur;
  window.__zet(d.x - 2.2, d.z);
  window.__stap(30);
  // tien stappen van een halve meter de deur door
  let x = d.x - 2.2, z = d.z;
  for (let i = 0; i < 12; i++) { [x, z] = W.resolveCollisions(x + 0.5, z, 0.35); g.player.pos.set(x, 0, z); window.__stap(2); }
  return { x: +x.toFixed(2), binnen: G.binnen(x, z) };
});
ok(binnen.binnen, 'door de open deur loop je naar binnen', JSON.stringify(binnen));

// ------------------------------------------------------------------ kopen
kop('kopen');
const aanbod = await page.evaluate(() => window.__game.garage.modellen.map(m => ({ id: m.id, naam: m.naam, soort: m.soort, prijs: m.prijs, kleur: m.kleur })));
const vind = (id) => aanbod.find(a => a.id === id);
ok(vind('ferrari_rood') && vind('ferrari_rood').prijs === 3000 && vind('ferrari_rood').soort === 'ferrari', 'een rode Ferrari voor € 3.000');
ok(vind('ferrari_geel') && vind('ferrari_geel').prijs === 3000 && vind('ferrari_geel').soort === 'ferrari', 'een gele Ferrari voor € 3.000');
ok(vind('bx') && vind('bx').prijs === 250 && vind('bx').soort === 'bx', 'een rode BX voor € 250');
const kopen = await page.evaluate(async () => {
  const g = window.__game, G = g.garage, v = g.verhaal;
  const bij = (id) => { const m = G.modellen.find(a => a.id === id); window.__zet(m.bord.x + 0.4, m.bord.z); window.__stap(3); return m; };
  const uit = {};
  // de balk
  bij('ferrari_geel');
  uit.balk = { tekst: document.getElementById('praat').textContent, zichtbaar: !document.getElementById('praat').hidden };
  // te weinig geld
  window.__geld(200);
  const voor = g.vehicles.cars.length;
  bij('bx'); g.praat(); window.__stap(2);
  uit.teWeinig = { geld: v.geld, erbij: g.vehicles.cars.length - voor, melding: g.hud.msg ? g.hud.msg.textContent : '' };
  // genoeg geld: de rode Ferrari
  window.__geld(10000);
  bij('ferrari_rood'); g.praat(); window.__stap(2);
  const f = g.vehicles.cars[g.vehicles.cars.length - 1];
  uit.ferrari = { geld: v.geld, erbij: g.vehicles.cars.length - voor, soort: f.soort, kleur: f.kleur, x: +f.x.toFixed(2), z: +f.z.toFixed(2),
    yaw: f.yaw, top: f.topSnelheid, trek: f.trek, bestuurbaar: f.driveable !== false, eigen: G.idVan(f) };
  // en de BX, die komt op de volgende plek
  bij('bx'); g.praat(); window.__stap(2);
  const b = g.vehicles.cars[g.vehicles.cars.length - 1];
  uit.bx = { geld: v.geld, soort: b.soort, kleur: b.kleur, x: +b.x.toFixed(2), z: +b.z.toFixed(2) };
  uit.eigen = G.eigen.length;
  uit.plekken = G.plekken.aflever;
  uit.maten = G.maten;
  uit.voor = (await import('/js/bouwvlak.js')).GARAGE.voor;
  return uit;
});
ok(kopen && kopen.balk.zichtbaar && /gele Ferrari kopen \(€ 3\.000\)/.test(kopen.balk.tekst), 'bij de gele Ferrari: "E — gele Ferrari kopen (€ 3.000)"', kopen && kopen.balk.tekst);
ok(kopen && kopen.teWeinig.geld === 200 && kopen.teWeinig.erbij === 0, 'met € 200 koop je geen BX', kopen && JSON.stringify(kopen.teWeinig));
ok(kopen && kopen.ferrari.geld === 7000 && kopen.ferrari.soort === 'ferrari' && kopen.ferrari.kleur === vind('ferrari_rood').kleur,
  'met € 10.000 koop je de rode Ferrari: € 3.000 eraf', kopen && JSON.stringify({ geld: kopen.ferrari.geld, soort: kopen.ferrari.soort }));
ok(kopen && kopen.ferrari.bestuurbaar && kopen.ferrari.eigen != null, 'hij is van jou en je kunt erin rijden');
ok(kopen && kopen.ferrari.x > kopen.voor.x0 && kopen.ferrari.x < kopen.voor.x1 && kopen.ferrari.z > kopen.voor.z0 && kopen.ferrari.z < kopen.voor.z1,
  'hij staat buiten op het voorterrein', kopen && `${kopen.ferrari.x}, ${kopen.ferrari.z}`);
ok(kopen && kopen.bx.geld === 6750 && kopen.bx.soort === 'bx' && Math.hypot(kopen.bx.x - kopen.ferrari.x, kopen.bx.z - kopen.ferrari.z) > 5,
  'de BX voor € 250 komt op de volgende plek', kopen && JSON.stringify(kopen.bx));

// ------------------------------------------------------------------ de Ferrari
kop('de Ferrari');
const model = await page.evaluate(async () => {
  const { autoOnderdelen, autoMaat } = await import('/js/carmodel.js');
  const uit = {};
  for (const soort of ['ferrari', 'bx', 'hatch']) {
    const { dozen, wielen, R, bandBreed, L, W } = autoOnderdelen(soort);
    const maat = autoMaat(soort);
    const doorBand = [], los = [];
    const doos = (d) => ({ x0: d.x - d.b / 2, x1: d.x + d.b / 2, y0: d.y - d.h / 2, y1: d.y + d.h / 2, z0: d.z - d.d / 2, z1: d.z + d.d / 2 });
    const boxen = dozen.map(doos);
    for (let i = 0; i < dozen.length; i++) {
      const b = boxen[i];
      for (const w of wielen) {
        const buitenX = Math.abs(w.x) + bandBreed / 2;
        const raaktZ = b.z1 > w.z - R && b.z0 < w.z + R;
        const voorbij = Math.max(Math.abs(b.x0), Math.abs(b.x1)) > buitenX - 0.03;
        const laag = b.y0 < R + 0.20 && b.y1 > 0;
        if (raaktZ && voorbij && laag) { doorBand.push(`${dozen[i].groep} z=${dozen[i].z.toFixed(2)}`); break; }
      }
      let raakt = false;
      for (let j = 0; j < dozen.length && !raakt; j++) {
        if (i === j) continue;
        const a = boxen[j];
        raakt = b.x1 > a.x0 - 0.001 && b.x0 < a.x1 + 0.001 && b.y1 > a.y0 - 0.001 && b.y0 < a.y1 + 0.001 && b.z1 > a.z0 - 0.001 && b.z0 < a.z1 + 0.001;
      }
      if (!raakt) los.push(`${dozen[i].groep} z=${dozen[i].z.toFixed(2)} y=${dozen[i].y.toFixed(2)}`);
    }
    uit[soort] = { L, W, R, dak: maat.dakY, delen: dozen.length, doorBand, los };
  }
  return uit;
});
const fm = model.ferrari;
ok(fm.dak < 1.25 && fm.W >= 1.9 && fm.L > 4.4 && fm.L < 4.8, 'de Ferrari is laag en breed', `${fm.L} × ${fm.W} m, dak op ${fm.dak} m (hatchback ${model.hatch.dak})`);
ok(fm.doorBand.length === 0, 'geen onderdeel dwars door een band', fm.doorBand.join(', ') || `${fm.delen} onderdelen`);
ok(fm.los.length === 0, 'niets hangt los', fm.los.join(', ') || `${fm.delen} onderdelen`);

const snel = await page.evaluate(() => {
  const g = window.__game, V = g.vehicles;
  // op een lege vlakte buiten de kaart, waar niets in de weg staat
  const rij = (soort) => {
    const car = V.voegToe({ x: 4000 + Math.random(), z: 4000, yaw: 0, soort, kleur: 0xc40a12 });
    let t100 = null, t = 0;
    const dt = 1 / 30;
    for (let i = 0; i < 30 * 40; i++) {
      car.x = 4000; car.z = 4000; car.yaw = 0; car.rij = 0;      // blijf op de vlakte
      V.drive(car, { KeyW: true }, dt);
      t += dt;
      if (t100 == null && car.speed * 3.6 >= 100) t100 = +t.toFixed(1);
    }
    const uit = { kmu: Math.round(car.speed * 3.6), t100 };
    car.driveable = false; car.mesh.visible = false;
    return uit;
  };
  return { ferrari: rij('ferrari'), bx: rij('bx'), hatch: rij('hatch') };
});
ok(snel.ferrari.kmu >= 190, 'de Ferrari haalt ruim 190 km/u', `${snel.ferrari.kmu} km/u, 0-100 in ${snel.ferrari.t100} s`);
ok(snel.hatch.kmu < 95 && snel.bx.kmu < 95, 'een gewone auto en de BX blijven onder de 95', `hatchback ${snel.hatch.kmu}, BX ${snel.bx.kmu} km/u`);
ok(snel.ferrari.t100 != null && (snel.hatch.t100 == null || snel.ferrari.t100 < snel.hatch.t100 / 2), 'en optrekken gaat veel harder', `0-100: Ferrari ${snel.ferrari.t100} s, hatchback ${snel.hatch.t100 ?? 'haalt het niet'}`);

const dash = await page.evaluate(() => {
  const g = window.__game, G = g.garage;
  const f = G.eigen.find(e => e.soort === 'ferrari').car;
  const b = f.mesh.userData.binnen;
  return { klok: !!(b && b.klok && b.klok.material && b.klok.material.map) };
});
ok(dash.klok, 'de Ferrari heeft een dashboard met klokken');

// ------------------------------------------------------------------ opslaan
kop('opslaan en laden');
const opslag = await page.evaluate(() => {
  const g = window.__game, G = g.garage;
  const f = G.eigen.find(e => e.soort === 'ferrari').car;
  // rijd hem een stukje weg en ga erin zitten, dan opslaan
  f.x = 760; f.z = 104; f.yaw = 1.2; f.mesh.position.set(f.x, 0, f.z);
  g.player.inCar = f;
  g.opslaan();
  const bewaard = JSON.parse(localStorage.getItem('tinga.spel.v1'));
  // alles door elkaar, en laden
  g.player.inCar = null; f.x = 900; f.z = 900;
  g.laden();
  const na = G.eigen;
  const zit = g.player.inCar;
  return {
    bewaard: bewaard.garage, autoEigen: bewaard.auto && bewaard.auto.eigen,
    aantal: na.length, soorten: na.map(e => e.soort).sort().join(','),
    ferrari: na.filter(e => e.soort === 'ferrari').map(e => ({ x: +e.car.x.toFixed(1), z: +e.car.z.toFixed(1) })),
    zit: zit ? { soort: zit.soort, eigen: zit.eigen, x: +zit.x.toFixed(1), z: +zit.z.toFixed(1) } : null,
    oudWeg: f.weg === true || f.driveable === false,
  };
});
ok(Array.isArray(opslag.bewaard) && opslag.bewaard.length === 2, 'de opslag onthoudt de twee gekochte auto\'s', JSON.stringify(opslag.bewaard && opslag.bewaard.map(b => b.soort)));
ok(opslag.aantal === 2 && opslag.soorten === 'bx,ferrari', 'na het laden heb je ze allebei nog', opslag.soorten);
ok(opslag.ferrari.length === 1 && opslag.ferrari[0].x === 760 && opslag.ferrari[0].z === 104, 'de Ferrari staat waar je hem liet', JSON.stringify(opslag.ferrari));
ok(opslag.zit && opslag.zit.soort === 'ferrari' && opslag.zit.eigen != null, 'en je zit er weer in', JSON.stringify(opslag.zit));

console.log(`\n${fout ? fout + ' fout' : 'alles goed'}`);
await browser.close();
process.exit(fout ? 1 : 0);
