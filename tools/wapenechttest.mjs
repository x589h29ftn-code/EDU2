/*
 Echtere wapens (verzoek 24 sep 2026: "kan je de wapens realistischer maken qua
 uiterlijk en textures, ook animatie van de wapens").

   node tools/server.mjs 8123 &   node tools/wapenechttest.mjs [poort]

 Deze proef laadt niet het hele spel maar alleen js/wapen.js op een lege pagina,
 met een camera en een zon. Dat scheelt een halve minuut opbouw en is genoeg:
 alles wat hier gemeten wordt zit in het model zelf. Hoe het wapen in het spel
 hangt (vizierlijn, herladen, wisselen) toetsen tools/wapentest.mjs en
 tools/richttest.mjs al.

 1. Uiterlijk: elk onderdeel heeft een getekend doek met uv, het staal heeft
    een roughness map en een normal map, de randen zijn afgerond (geen normaal
    meer die alleen langs de assen wijst) en de vingers zijn rond.
 2. Terugslag: een veer — hij schiet terug, schiet één keer door en ligt binnen
    een halve seconde stil.
 3. Slede en trekker: de slede slaat in 30 ms naar achteren en staat na 150 ms
    weer vóór; de trekker gaat mee. Na het laatste patroon blijft de slede achter.
 4. Een huls vliegt naar rechts en valt, en is na 0,8 s weg; er hangt damp.
 5. De sniper haalt zijn grendel over: omhoog, naar achteren (dán pas de huls),
    naar voren en omlaag.
 6. Houding: omkijken laat het wapen naslepen, rennen laat het zakken,
    stilstaan laat het ademen — en aangeslagen staat het stil op de vizierlijn.
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
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
// een lege pagina op de server (een adres dat niet bestaat, dus niet het spel
// zelf), zodat de modules met hun eigen paden laden
await page.goto(`http://127.0.0.1:${poort}/wapenbank`, { waitUntil: 'load', timeout: 120000 });
await page.setContent(`<!doctype html><html><head>
<script type="importmap">{ "imports": { "three": "/lib/three.module.js" } }</script></head><body>
<script type="module">
  import * as THREE from 'three';
  import * as W from '/js/wapen.js';
  const geluid = new Proxy({}, { get: () => () => {} });
  const cam = new THREE.PerspectiveCamera(70, 1.6, 0.01, 50);
  window.__t = { THREE, W, cam, maak: (s) => { const w = s === 'sniper' ? W.maakSniper(geluid) : s === 'mitrailleur' ? W.maakMitrailleur(geluid) : W.maakPistool(geluid); cam.add(w.groep); return w; } };
</script></body></html>`);
await page.waitForFunction(() => window.__t, null, { timeout: 120000 });

kop('uiterlijk');
const uit = await page.evaluate(() => {
  const { THREE, maak } = window.__t;
  const w = maak('pistool');
  let meshes = 0, metDoek = 0, metUv = 0, schuin = 0, normalen = 0, staalRuw = false, staalNormaal = false;
  const overig = new Set([w.delen.hulzen, ...w.delen.rook]);
  w.delen.flits.traverse(o => overig.add(o));
  w.groep.traverse(o => {
    if (!o.isMesh || overig.has(o)) return;
    meshes++;
    const m = o.material;
    if (m.map && m.map.image && m.map.image.width >= 128) metDoek++;
    if (o.geometry.attributes.uv) metUv++;
    if (m.metalness > 0.7 && m.roughnessMap && m.normalMap) { staalRuw = true; staalNormaal = true; }
    const N = o.geometry.attributes.normal;
    for (let i = 0; i < N.count; i++) {
      normalen++;
      const a = [Math.abs(N.getX(i)), Math.abs(N.getY(i)), Math.abs(N.getZ(i))];
      if (Math.max(...a) < 0.985) schuin++;
    }
  });
  // de vingers: de hand heeft ronde staafjes, dus veel normalen die niet langs een as liggen
  let handSchuin = 0, handN = 0;
  w.delen.hand.traverse(o => { if (!o.isMesh) return; const N = o.geometry.attributes.normal; for (let i = 0; i < N.count; i++) { handN++; if (Math.max(Math.abs(N.getX(i)), Math.abs(N.getY(i)), Math.abs(N.getZ(i))) < 0.9) handSchuin++; } });
  const kleuren = new Set();
  w.groep.traverse(o => { if (o.isMesh && o.material.map) kleuren.add(o.material.map.uuid); });
  return { meshes, metDoek, metUv, schuin: schuin / normalen, staalRuw, staalNormaal, hand: handSchuin / handN, doeken: kleuren.size };
});
ok(uit.metDoek === uit.meshes - 1, 'elk onderdeel heeft een getekend doek (behalve de witte vizierstippen)', `${uit.metDoek} van ${uit.meshes}`);
ok(uit.metUv >= uit.metDoek, 'en een uv om het op te leggen', `${uit.metUv} met uv`);
ok(uit.doeken >= 5, 'staal, kunststof, greep, huid en stof zijn verschillende doeken', `${uit.doeken} doeken`);
ok(uit.staalRuw && uit.staalNormaal, 'het staal heeft een roughness map en een normal map: krassen vangen het licht');
ok(uit.schuin > 0.3, 'de randen zijn afgerond: de normaal loopt om de hoek', `${(uit.schuin * 100).toFixed(0)} % van de normalen schuin`);
ok(uit.hand > 0.5, 'en de vingers zijn rond in plaats van blokjes', `${(uit.hand * 100).toFixed(0)} % schuin`);

kop('terugslag en slede');
const schot = await page.evaluate(() => {
  const { maak } = window.__t;
  const w = maak('pistool');
  for (let i = 0; i < 30; i++) w.update(1 / 120);
  const rust = { z: w.groep.position.z, rx: w.groep.rotation.x };
  w.vuur();
  const rij = [];
  for (let i = 0; i < 120; i++) {
    w.update(1 / 240);
    rij.push({ t: (i + 1) / 240, vx: w.veer.x, z: w.groep.position.z - rust.z, slede: w.delen.slede.position.z, trek: w.delen.trekker.rotation.x, hulzen: w.hulzenInDeLucht, rook: w.delen.rook.some(r => r.visible && r.material.opacity > 0.05) });
  }
  const piek = rij.reduce((a, b) => (b.vx > a.vx ? b : a));
  const door = Math.min(...rij.filter(r => r.t > piek.t).map(r => r.vx));
  for (let i = 0; i < 60; i++) w.update(1 / 120);
  const stil = Math.abs(w.veer.x) + Math.abs(w.veer.z);
  const sledeAchter = Math.max(...rij.filter(r => r.t <= 0.04).map(r => r.slede));
  const sledeNa = rij.find(r => Math.abs(r.t - 0.15) < 0.003).slede;
  const trek = Math.min(...rij.map(r => r.trek));
  return { piek: piek.vx, piekT: piek.t, door, stil, z: Math.max(...rij.map(r => r.z)), sledeAchter, sledeNa, trek, huls: rij[5].hulzen, rook: rij[10].rook };
});
ok(schot.piek > 0.12 && schot.piekT < 0.1, 'een schot zet de loop omhoog', `${(schot.piek * 57.3).toFixed(1)}° na ${(schot.piekT * 1000).toFixed(0)} ms`);
ok(schot.z > 0.02, 'en het wapen naar achteren', `${(schot.z * 1000).toFixed(0)} mm`);
ok(schot.door < -0.005 && schot.door > -schot.piek * 0.4, 'het veert één keer door, niet meer dan een fractie', `${(schot.door * 57.3).toFixed(2)}°`);
ok(schot.stil < 0.002, 'en ligt binnen een halve seconde stil', `rest ${schot.stil.toFixed(4)}`);
ok(schot.sledeAchter > 0.022, 'de slede slaat binnen 40 ms naar achteren', `${(schot.sledeAchter * 1000).toFixed(0)} mm`);
ok(schot.sledeNa < 0.001, 'en staat na 150 ms weer vóór', `${(schot.sledeNa * 1000).toFixed(1)} mm`);
ok(schot.trek < -0.3, 'de trekker gaat mee naar achteren', `${(schot.trek * 57.3).toFixed(0)}°`);
ok(schot.huls === 1, 'er springt een huls uit');
ok(schot.rook, 'en er hangt een wolkje kruitdamp aan de loop');

/*
 Ronde van 25 sep 2026 ("schieten met het handpistool lijkt raar"). De veer liep
 per beeld in één stap: bij 30 fps was de zet omhoog een zesde van die bij 144.
 En het wapen draaide met de onderarm als een wip om de greep.
*/
const tempo = await page.evaluate(() => {
  const { THREE, maak } = window.__t;
  // het toeval van elk schot (0,9 tot 1,1) even vastzetten, anders meet je dat
  const echt = Math.random; Math.random = () => 0.5;
  const piek = (fps) => {
    const w = maak('pistool');
    for (let i = 0; i < 30; i++) w.update(1 / fps);
    w.vuur();
    let p = 0;
    for (let i = 0; i < fps * 0.4; i++) { w.update(1 / fps); p = Math.max(p, w.veer.x); }
    return p;
  };
  const uit = { fps: {} };
  for (const f of [240, 144, 60, 30, 20]) uit.fps[f] = piek(f);
  Math.random = echt;
  // waar de loop, de pols en het eind van de mouw zijn, voor en op het hoogste punt
  const w = maak('pistool');
  for (let i = 0; i < 30; i++) w.update(1 / 240);
  w.groep.updateMatrixWorld(true);
  const mond = new THREE.Vector3(0, 0.021, -0.166), pols = new THREE.Vector3(0.016, -0.080, 0.075), mouw = new THREE.Vector3(0.10, -0.21, 0.50);
  const plek = () => { w.groep.updateMatrixWorld(true); return { m: w.groep.localToWorld(mond.clone()), p: w.groep.localToWorld(pols.clone()), a: w.delen.arm.localToWorld(mouw.clone()) }; };
  const voor = plek();
  w.vuur();
  let top = null, hoogst = -9;
  for (let i = 0; i < 40; i++) { w.update(1 / 240); if (w.veer.x > hoogst) { hoogst = w.veer.x; top = plek(); } }
  uit.mond = top.m.y - voor.m.y;
  uit.polsOp = top.p.y - voor.p.y;          // de pols gaat mee naar achteren, maar niet omlaag of omhoog
  uit.mouw = top.a.distanceTo(voor.a);
  // het tikje opzij tegen de zet omhoog, over tien schoten
  let zij = 0, op = 0;
  for (let k = 0; k < 10; k++) {
    const v = maak('pistool');
    for (let i = 0; i < 10; i++) v.update(1 / 120);
    v.vuur();
    for (let i = 0; i < 40; i++) { v.update(1 / 240); zij = Math.max(zij, Math.abs(v.veer.y)); op = Math.max(op, v.veer.x); }
  }
  uit.zij = zij / op;
  // zo snel klikken als je kunt: acht schoten in een halve seconde
  const r = maak('pistool');
  for (let i = 0; i < 10; i++) r.update(1 / 120);
  let max = 0;
  for (let k = 0; k < 8; k++) { r.vuur(); for (let i = 0; i < 4; i++) { r.update(1 / 60); max = Math.max(max, r.veer.x); } }
  uit.snel = max;
  return uit;
});
const f = tempo.fps, basis = f[240];
ok([144, 60, 30, 20].every(k => Math.abs(f[k] / basis - 1) < 0.1), 'de zet omhoog is bij elk beeldtempo even groot',
  Object.entries(f).map(([k, v]) => `${k} fps ${(v * 57.3).toFixed(1)}°`).join(', '));
ok(tempo.mond > 0.03, 'de loop gaat een paar centimeter omhoog', `${(tempo.mond * 100).toFixed(1)} cm`);
ok(tempo.polsOp > -0.002 && tempo.polsOp < 0.010, 'en het draait om de pols: die zakt niet, hij komt een paar millimeter mee omhoog', `${(tempo.polsOp * 1000).toFixed(1)} mm`);
ok(tempo.mouw < 0.05, 'de mouw slaat niet meer als een wip omlaag', `${(tempo.mouw * 100).toFixed(1)} cm`);
ok(tempo.zij < 0.35, 'het tikje opzij is klein naast de zet omhoog', `${(tempo.zij * 100).toFixed(0)} %`);
ok(tempo.snel < 0.45, 'snel achter elkaar klikken stapelt niet tot het pistool rechtop staat', `${(tempo.snel * 57.3).toFixed(0)}° hoogst`);

const huls = await page.evaluate(() => {
  const { THREE, maak } = window.__t;
  const w = maak('pistool');
  for (let i = 0; i < 10; i++) w.update(1 / 60);
  w.vuur();
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const plek = () => { w.delen.hulzen.getMatrixAt(0, m); m.decompose(p, q, s); return { x: p.x, y: p.y, s: s.x }; };
  w.update(1 / 60); const a = plek();
  for (let i = 0; i < 8; i++) w.update(1 / 60); const b = plek();
  for (let i = 0; i < 20; i++) w.update(1 / 60); const c = plek();
  for (let i = 0; i < 30; i++) w.update(1 / 60); const d = plek();
  return { a, b, c, weg: d.s === 0 && w.hulzenInDeLucht === 0 };
});
ok(huls.b.x > huls.a.x + 0.05, 'de huls vliegt naar rechts', `${((huls.b.x - huls.a.x) * 100).toFixed(0)} cm in 0,13 s`);
ok(huls.b.y > huls.a.y && huls.c.y < huls.b.y, 'eerst omhoog, dan valt hij', `${huls.a.y.toFixed(3)} → ${huls.b.y.toFixed(3)} → ${huls.c.y.toFixed(3)} m`);
ok(huls.weg, 'en na 0,8 s is hij weg');

const leeg = await page.evaluate(() => {
  const { maak, W } = window.__t;
  const w = maak('pistool');
  for (let i = 0; i < 10; i++) w.update(1 / 60);
  w.vuur();
  for (let i = 0; i < 30; i++) w.update(1 / 60, { leeg: true });
  const achter = w.delen.slede.position.z;
  // herladen: de slede gaat bij de laatste stap naar voren en blijft daar
  const T = W.HERLAADTIJD;
  for (let t = T; t > 0; t -= 1 / 60) w.update(1 / 60, { herlaad: t, leeg: true });
  for (let i = 0; i < 20; i++) w.update(1 / 60, { leeg: false });
  return { achter, na: w.delen.slede.position.z };
});
ok(leeg.achter > 0.022, 'na het laatste patroon blijft de slede achter staan', `${(leeg.achter * 1000).toFixed(0)} mm`);
ok(leeg.na < 0.001, 'en na het herladen staat hij weer vóór', `${(leeg.na * 1000).toFixed(1)} mm`);

kop('de grendel van de sniper');
const grendel = await page.evaluate(() => {
  const { maak } = window.__t;
  const w = maak('sniper');
  for (let i = 0; i < 10; i++) w.update(1 / 60);
  w.vuur();
  const rij = [];
  for (let i = 0; i < 60; i++) { w.update(1 / 60); rij.push({ t: (i + 1) / 60, rz: w.delen.slede.rotation.z, z: w.delen.slede.position.z, h: w.hulzenInDeLucht }); }
  const hulsT = (rij.find(r => r.h > 0) || {}).t;
  const opT = (rij.find(r => r.rz > 0.9) || {}).t, terugT = (rij.find(r => r.z > 0.04) || {}).t;
  const eind = rij[rij.length - 1];
  return { hulsT, opT, terugT, eind, opMax: Math.max(...rij.map(r => r.rz)), terugMax: Math.max(...rij.map(r => r.z)) };
});
ok(grendel.opMax > 0.9 && grendel.opT < grendel.terugT, 'de steel gaat eerst omhoog', `${(grendel.opMax * 57.3).toFixed(0)}° na ${(grendel.opT * 1000).toFixed(0)} ms`);
ok(grendel.terugMax > 0.04, 'dan naar achteren', `${(grendel.terugMax * 1000).toFixed(0)} mm na ${(grendel.terugT * 1000).toFixed(0)} ms`);
ok(grendel.hulsT >= grendel.terugT, 'en pas dan springt de huls eruit, niet bij het schot', `huls na ${(grendel.hulsT * 1000).toFixed(0)} ms`);
ok(Math.abs(grendel.eind.rz) < 0.01 && Math.abs(grendel.eind.z) < 0.001, 'na een seconde zit hij weer dicht');

kop('de houding');
const houding = await page.evaluate(() => {
  const { maak } = window.__t;
  const w = maak('pistool');
  const rust = w.houding.rust, mik = w.houding.mik;
  for (let i = 0; i < 60; i++) w.update(1 / 60, { yaw: 0, pitch: 0 });
  const x0 = w.groep.position.x;
  // snel naar rechts kijken (yaw omlaag): het wapen blijft links achter
  let yaw = 0, minX = x0;
  for (let i = 0; i < 12; i++) { yaw -= 0.05; w.update(1 / 60, { yaw, pitch: 0 }); minX = Math.min(minX, w.groep.position.x); }
  const sleep = x0 - minX;
  for (let i = 0; i < 60; i++) w.update(1 / 60, { yaw, pitch: 0 });
  const terug = Math.abs(w.groep.position.x - x0);
  // ademen: stilstaand beweegt hij een paar millimeter
  let ymin = 9, ymax = -9;
  for (let i = 0; i < 240; i++) { w.update(1 / 60, { yaw, pitch: 0 }); ymin = Math.min(ymin, w.groep.position.y); ymax = Math.max(ymax, w.groep.position.y); }
  // rennen: de loopbeweging gaat snel (13 per seconde), het wapen zakt en kantelt
  let bob = 0;
  for (let i = 0; i < 90; i++) { bob += 13 / 60; w.update(1 / 60, { bob, yaw, pitch: 0 }); }
  const ren = { y: w.groep.position.y - rust.y, rx: w.groep.rotation.x };
  for (let i = 0; i < 90; i++) w.update(1 / 60, { bob, yaw, pitch: 0 });
  // aangeslagen: stil op de vizierlijn, ook als je rondkijkt
  for (let i = 0; i < 60; i++) { yaw += 0.02; w.update(1 / 60, { mik: 1, bob, yaw, pitch: 0 }); }
  const aan = { x: w.groep.position.x, y: w.groep.position.y - mik.y, ry: w.groep.rotation.y, rz: w.groep.rotation.z };
  return { sleep, terug, adem: ymax - ymin, ren, aan };
});
ok(houding.sleep > 0.01, 'kijk je snel opzij, dan sleept het wapen achter', `${(houding.sleep * 1000).toFixed(0)} mm`);
ok(houding.terug < 0.002, 'en veert daarna terug', `${(houding.terug * 1000).toFixed(1)} mm over`);
ok(houding.adem > 0.0015 && houding.adem < 0.006, 'stilstaand ademt het een paar millimeter', `${(houding.adem * 1000).toFixed(1)} mm`);
ok(houding.ren.y < -0.03 && houding.ren.rx < -0.3, 'rennend zakt het en wijst de loop omlaag', `${(houding.ren.y * 100).toFixed(1)} cm, ${(houding.ren.rx * 57.3).toFixed(0)}°`);
ok(Math.abs(houding.aan.x) < 0.001 && Math.abs(houding.aan.y) < 0.001 && Math.abs(houding.aan.ry) < 0.001 && Math.abs(houding.aan.rz) < 0.001,
  'aangeslagen staat het stil op de vizierlijn, ook terwijl je rondkijkt', `x ${houding.aan.x.toFixed(4)}, y ${houding.aan.y.toFixed(4)}`);

console.log(`\n${fout ? fout + ' fout' : 'alles goed'}`);
await browser.close();
process.exit(fout ? 1 : 0);
