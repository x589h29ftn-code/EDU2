/*
 Stap 177 (npm run tigertest): de gedenkplek voor de Slag om Sneek aan de Sudergoweg en de Tiger die je kunt berijden.

   1. de plek: de tegelvloer op het weiland ten zuiden van de Sudergoweg, geen water en geen pand eronder, vlak bij de weg;
   2. de gedenksteen met de tekst die gevraagd is;
   3. het model op de maten van een Tiger I (6,32 m romp, 8,45 m met het kanon, 3,56 m breed, 3,0 m hoog), de rupsen op
      de grond;
   4. instappen met E, en dan rijden zoals een tank: vooruit, achteruit, draaien op de plaats, de rupsen tegen elkaar in;
   5. de koepel volgt de muis met zijn eigen draaisnelheid, de romp blijft staan; het kanon richt van −8° tot +15°;
   6. schieten: een inslag die een auto in vlammen zet, dan acht seconden herladen;
   7. de camera: binnen langs de loop (de monding in beeld, de kijkrichting langs het kanon), met V van buiten;
   8. van de gedenkplek af: over de dam de weg op, en nooit met een hoek in het water; tegen een muur houdt hij op;
   9. uitstappen naast de romp, niet in het water; te voet houdt de Tiger je tegen;
  10. geen nieuw shaderprogramma, ook niet bij het schieten.

 Gebruik: npm run server &  node tools/tigertest.mjs [poort]
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fout = 0;
const ok = (goed, wat, extra = '') => { console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`); if (!goed) fout++; };
const kop = (t) => console.log(`\n--- ${t} ---`);
const r2 = (v) => Math.round(v * 100) / 100;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
page.setDefaultTimeout(900000);
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

const r = await page.evaluate(async () => {
  const THREE = await import('three');
  const g = window.__game, W = await import('./js/world.js'), { KAART } = await import('./js/kaart.js');
  const { TIGER, TEKST, DONATIE } = await import('./js/tiger.js');
  document.getElementById('overlay').style.display = 'none';
  await g.voorbereidSpel();
  const R = g.renderer, programmasVoor = R.info.programs.length;
  const T = g.tiger, pl = g.player, uit = {};
  const r2 = (v) => Math.round(v * 100) / 100;
  window.__autoplay = true; pl.active = true; pl.inCar = null;
  const stap = (n, dt = 0.05) => { for (let i = 0; i < n; i++) T.update(dt); };
  const inPoly = (x, z, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, zi] = ring[i], [xj, zj] = ring[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
  const soortOp = (x, z) => { const s = []; for (const v of KAART.vlakken) if (inPoly(x, z, v.r[0])) s.push(v.k === 'gras' ? v.sub : v.k); return s; };

  // ---- 1. de plek
  const P = TIGER.plek, V = TIGER.vloer, c = Math.cos(P.yaw), s = Math.sin(P.yaw);
  const hoek = [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]].map(([a, b]) => { const u = a * V.b / 2, w = b * V.d / 2; return { x: P.x + u * c + w * s, z: P.z - u * s + w * c }; });
  uit.vloer = hoek.map(p => ({ water: W.pointInWater(p.x, p.z), soort: soortOp(p.x, p.z).join('|') }));
  const as = KAART.wegassen.filter(a => a.naam === 'Sudergoweg');
  let dWeg = Infinity;
  for (const a of as) for (let i = 0; i < a.pts.length - 1; i++) {
    const [ax, az] = a.pts[i], [bx, bz] = a.pts[i + 1], L2 = (bx - ax) ** 2 + (bz - az) ** 2;
    const t = Math.max(0, Math.min(1, ((P.x - ax) * (bx - ax) + (P.z - az) * (bz - az)) / L2));
    dWeg = Math.min(dWeg, Math.hypot(ax + (bx - ax) * t - P.x, az + (bz - az) * t - P.z));
  }
  uit.dWeg = dWeg;
  uit.pand = KAART.panden.some(p => inPoly(P.x, P.z, p.voet));

  // ---- 2. de steen
  uit.tekst = { TEKST, DONATIE };

  // ---- 3. de maten
  T.zetTerug(); stap(2);
  g.scene.updateMatrixWorld(true);
  const box = (o) => { const b = new THREE.Box3(); o.traverse(q => { if (q.isMesh && !q.material.isMeshBasicMaterial) b.expandByObject(q); }); return b; };
  // in de eigen assen meten: even recht zetten
  const st0 = T.stand;
  T.T.romp.rotation.set(0, 0, 0); T.T.koepel.rotation.y = 0; T.T.kanon.rotation.x = 0; g.scene.updateMatrixWorld(true);
  const bAl = box(T.T.groep);
  const rompAlleen = new THREE.Box3(); T.T.romp.children.forEach(q => { if (q !== T.T.koepel && q.isMesh) rompAlleen.expandByObject(q); });
  uit.maat = { lang: r2(bAl.max.z - bAl.min.z), romp: r2(rompAlleen.max.z - rompAlleen.min.z), breed: r2(bAl.max.x - bAl.min.x), hoog: r2(bAl.max.y - bAl.min.y), onder: r2(bAl.min.y - st0.y) };
  stap(1);

  // ---- 4. instappen en rijden
  const fwd = (y) => [-Math.sin(y), -Math.cos(y)];
  const st1 = T.stand, [rx, rz] = [Math.cos(st1.yaw), -Math.sin(st1.yaw)];
  pl.pos.set(st1.x + rx * 3.0, 0.2, st1.z + rz * 3.0);
  uit.hint = T.hint();
  uit.inE = T.toets(); uit.actief = T.actief; uit.inTiger = pl.inTiger;
  // de muis houdt het kanon recht vooruit
  pl.yaw = st1.yaw; pl.pitch = 0;
  // draaien op de plaats (links)
  const offL0 = T.T.rupsen.find(q => q.kant < 0).mat.map.offset.x, offR0 = T.T.rupsen.find(q => q.kant > 0).mat.map.offset.x;
  pl.keys = { KeyA: true }; stap(40); pl.keys = {}; stap(20);
  const st2 = T.stand;
  uit.draaiPlaats = { yaw: r2(st2.yaw - st1.yaw), verplaatst: r2(Math.hypot(st2.x - st1.x, st2.z - st1.z)),
    links: r2(T.T.rupsen.find(q => q.kant < 0).mat.map.offset.x - offL0), rechts: r2(T.T.rupsen.find(q => q.kant > 0).mat.map.offset.x - offR0) };
  // terug naar de beginstand en vooruit / achteruit
  T.uit(); T.zetTerug(); pl.pos.set(st1.x + rx * 3.0, 0.2, st1.z + rz * 3.0); T.toets(); pl.yaw = st1.yaw; pl.pitch = 0;
  const wiel0 = T.T.wielen[0].m.rotation.x;
  pl.keys = { KeyW: true }; stap(40); pl.keys = {}; stap(40);
  const st3 = T.stand, [f3x, f3z] = fwd(st1.yaw);
  uit.vooruit = r2((st3.x - st1.x) * f3x + (st3.z - st1.z) * f3z);
  uit.wielDraait = r2(T.T.wielen[0].m.rotation.x - wiel0);
  pl.keys = { KeyS: true }; stap(30); pl.keys = {}; stap(30);
  const st4 = T.stand;
  uit.achteruit = r2((st4.x - st3.x) * f3x + (st4.z - st3.z) * f3z);
  uit.speler = r2(Math.hypot(pl.pos.x - st4.x, pl.pos.z - st4.z));

  // ---- 5. de koepel en het kanon
  T.uit(); T.zetTerug(); pl.pos.set(st1.x + rx * 3.0, 0.2, st1.z + rz * 3.0); T.toets();
  pl.yaw = st1.yaw + 1.0; pl.pitch = 0;
  stap(20);
  const k1 = T.stand.koepel;
  stap(60);
  const k3 = T.stand;
  uit.koepel = { na1: r2(k1), na4: r2(k3.koepel), romp: r2(k3.yaw - st1.yaw) };
  pl.pitch = 0.6; stap(80); uit.richtOp = r2(T.stand.richt * 180 / Math.PI);
  pl.pitch = -0.6; stap(120); uit.richtNeer = r2(T.stand.richt * 180 / Math.PI);
  pl.pitch = 0; stap(60);

  // ---- 7. de camera binnen en buiten (vóór het schieten: de koepel staat 1 rad gedraaid)
  T.zetCamera();
  const C = g.camera; C.updateMatrixWorld(true);
  const kijk = new THREE.Vector3(0, 0, -1).applyQuaternion(C.quaternion);
  const loopDir = new THREE.Vector3(0, 0, -1).applyQuaternion(T.T.loop.getWorldQuaternion(new THREE.Quaternion()));
  const mond = T.T.monding.getWorldPosition(new THREE.Vector3());
  const ndc = mond.clone().project(C);
  const koepelPos = T.T.koepel.getWorldPosition(new THREE.Vector3());
  uit.binnen = { langsLoop: r2(kijk.dot(loopDir)), mond: [r2(ndc.x), r2(ndc.y), r2(ndc.z)], hoogte: r2(C.position.y - koepelPos.y), afstand: r2(Math.hypot(C.position.x - koepelPos.x, C.position.z - koepelPos.z)) };
  const derdeWas = g.derde.aan; if (!g.derde.aan) g.derde.wissel();
  pl.yaw = T.stand.yaw; pl.pitch = -0.1;
  T.zetCamera();
  const sNu = T.stand;
  uit.buiten = { afstand: r2(Math.hypot(C.position.x - sNu.x, C.position.z - sNu.z)), hoog: r2(C.position.y - sNu.y) };
  if (g.derde.aan !== derdeWas) g.derde.wissel();
  const hud = document.getElementById('tigerHud');
  uit.hud = { zichtbaar: !!hud && !hud.hidden && getComputedStyle(hud).display !== 'none', tekst: hud ? hud.querySelector('.tekst').textContent : '' };

  // ---- 6. schieten op een auto
  stap(80);   // de koepel weer recht (de muis staat op de romp)
  const sv = T.stand, [fx, fz] = fwd(sv.yaw + sv.koepel);
  const o = T.T.monding.getWorldPosition(new THREE.Vector3());
  const doel = g.vehicles.voegToe({ x: o.x + fx * 30, z: o.z + fz * 30, yaw: 0, soort: 'hatch' });
  doel.mesh.position.set(doel.x, 0, doel.z); g.scene.updateMatrixWorld(true);
  // het kanon een fractie omlaag, zodat de granaat de auto op 30 m raakt (de loop zit op 2,3 m)
  pl.pitch = -0.045; stap(30);
  const knal0 = g.tigerKnallen.length;
  const hit = T.vuur();
  uit.schot = { hit: hit ? hit.wat : null, wrak: !!doel.wrak, knallen: g.tigerKnallen.length - knal0, herlaad: r2(T.stand.herlaad), hud: hud ? hud.querySelector('.tekst').textContent : '' };
  uit.nogEens = T.vuur();
  stap(100);   // 5 s
  uit.na5 = { herlaad: r2(T.stand.herlaad), mag: T.vuur() };
  stap(70);    // 8,5 s
  uit.na8 = { herlaad: r2(T.stand.herlaad) };
  uit.na8.mag = !!T.vuur();
  // de inslag en de mondingsvlam zijn uitgedoofd na een paar seconden
  stap(120); for (let i = 0; i < 80; i++) for (const k of g.tigerKnallen) k.update(0.05);
  g.vehicles.verwijder && g.vehicles.verwijder(doel);

  // ---- 8. van de gedenkplek af, over de dam naar de weg
  T.uit(); T.zetTerug();
  pl.pos.set(st1.x + rx * 3.0, 0.2, st1.z + rz * 3.0); T.toets();
  // eerst recht naar de dam draaien (de dam ligt bij (47,5; 1084))
    let water = 0, maxStap = 0, minWeg = Infinity, t = 0;
  const hoekenNat = () => { const q = T.stand, a = fwd(q.yaw), b = [Math.cos(q.yaw), -Math.sin(q.yaw)]; let n = 0; for (const [u, w] of [[2.9, -1.6], [2.9, 1.6], [-2.9, -1.6], [-2.9, 1.6]]) if (W.pointInWater(q.x + a[0] * u + b[0] * w, q.z + a[1] * u + b[1] * w)) n++; return n; };
  const rijweg = as.filter(a => a.drive);
  const naarWeg = (q) => { let d = Infinity; for (const a of rijweg) for (let i = 0; i < a.pts.length - 1; i++) { const [ax, az] = a.pts[i], [bx, bz] = a.pts[i + 1], L2 = (bx - ax) ** 2 + (bz - az) ** 2; const tt = Math.max(0, Math.min(1, ((q.x - ax) * (bx - ax) + (q.z - az) * (bz - az)) / L2)); d = Math.min(d, Math.hypot(ax + (bx - ax) * tt - q.x, az + (bz - az) * tt - q.z)); } return d; };
  for (t = 0; t < 60; t += 0.05) {
    const q = T.stand;
    // langs de as van de dam: eerst het midden, dan het fietspad, dan de weg
    const doelP = q.z > 1088 ? { x: 45.8, z: 1086 } : q.z > 1080.5 ? { x: 45.6, z: 1078.5 } : { x: 45.3, z: 1073 };
    const wil = Math.atan2(-(doelP.x - q.x), -(doelP.z - q.z));
    let d = wil - q.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    pl.keys = { KeyW: Math.abs(d) < 0.35, KeyA: d > 0.05, KeyD: d < -0.05 };
    const x0 = q.x, z0 = q.z;
    T.update(0.05);
    const q2 = T.stand;
    maxStap = Math.max(maxStap, Math.hypot(q2.x - x0, q2.z - z0));
    water = Math.max(water, hoekenNat());
    minWeg = Math.min(minWeg, naarWeg(q2));
    if (minWeg < 2.5) break;
  }
  pl.keys = {};
  uit.vanPlek = { t: r2(t), minWeg: r2(minWeg), water, maxStap: r2(maxStap), eind: [r2(T.stand.x), r2(T.stand.z), r2(T.stand.yaw)] };

  // tegen een muur: een pand met een hoge botsdoos, de Tiger er recht op af
  const muur = W.colliders.find(q => q.h > 5 && q.hx > 3 && q.hz > 3 && Math.hypot(q.cx - 10, q.cz + 7) < 400 && !q.beweegt);
  if (muur) {
    T.uit(); T.zetTerug();
    // 10 m voor de doos, met de neus erheen
    const ax = 10, az = -7, dx = muur.cx - ax, dz = muur.cz - az, L = Math.hypot(dx, dz);
    const sx = muur.cx - dx / L * (Math.max(muur.hx, muur.hz) + 10), sz = muur.cz - dz / L * (Math.max(muur.hx, muur.hz) + 10);
    pl.pos.set(sx, 0, sz);
    // de Tiger erheen zetten met een eigen sprong: via de stand van de module (alleen voor de proef)
    T.uit();
    const S = T.__zet ? T.__zet(sx, sz, Math.atan2(-dx, -dz)) : null;
    pl.pos.set(sx + 3, 0, sz); T.toets(); pl.yaw = Math.atan2(-dx, -dz); pl.pitch = 0;
    pl.keys = { KeyW: true }; stap(160); pl.keys = {}; stap(10);
    const q = T.stand;
    // de rompcirkels mogen niet in de doos staan
    const lx = (q.x - muur.cx) * muur.cos - (q.z - muur.cz) * muur.sin, lz = (q.x - muur.cx) * muur.sin + (q.z - muur.cz) * muur.cos;
    uit.muur = { binnen: Math.abs(lx) < muur.hx && Math.abs(lz) < muur.hz, afstand: r2(Math.max(Math.abs(lx) - muur.hx, Math.abs(lz) - muur.hz)), gezet: !!S };
  }

  // ---- 11. de romp vangt de treffers, en waarschuwt voor hij ontploft
  T.uit(); T.zetTerug(); stap(1);
  const sL = T.stand;
  pl.zetLevenRuw(100);
  pl.pos.set(sL.x + Math.cos(sL.yaw) * 3, 0.2, sL.z - Math.sin(sL.yaw) * 3); T.toets();
  g.tigerSchade();                 // het begin
  pl.health -= 30;                 // een treffer van de politie
  g.tigerSchade();
  uit.treffer = { erik: pl.health, romp: T.leven };
  const hudT = document.getElementById('tigerHud');
  uit.alarmVoor = !hudT.querySelector('.alarm').hidden;
  T.raak(T.leven - 90);           // nog 90 van de 300: kritiek
  const rx0 = T.T.romp.position.x;
  stap(10);
  uit.kritiek = { alarm: !hudT.querySelector('.alarm').hidden && getComputedStyle(hudT.querySelector('.alarm')).display !== 'none',
    tekst: hudT.querySelector('.alarm').textContent, rook: Math.max(...T.T.pluimen.map(p => p.m.opacity)), tril: r2(Math.abs(T.T.romp.position.x - rx0) + Math.abs(T.T.romp.position.z)),
    schok: r2(g.schokNu()), erik: pl.health };
  T.raak(50); stap(4);
  uit.brand = r2(T.T.vuurMat.opacity);
  const knal1 = g.tigerKnallen.length;
  T.raak(100);
  uit.ontploft = { kapot: T.kapot, actief: T.actief, inTiger: pl.inTiger, erik: pl.health, knal: g.tigerKnallen.length - knal1,
    zwart: T.T.M.camo.color.getHex().toString(16) };
  pl.pos.set(T.stand.x + Math.cos(T.stand.yaw) * 3, 0.2, T.stand.z - Math.sin(T.stand.yaw) * 3);
  uit.wrak = { hint: T.hint(), in: T.toets(), actief: T.actief };
  T.zetTerug(); stap(2);
  uit.nieuw = { kapot: T.kapot, leven: T.leven, kleur: T.T.M.camo.color.getHex().toString(16), rook: Math.max(...T.T.pluimen.map(p => p.m.opacity)) };
  pl.zetLevenRuw(100);
  // het eigen schot: de romp deint, het oog schiet terug, het beeld schudt
  pl.pos.set(sL.x + Math.cos(sL.yaw) * 3, 0.2, sL.z - Math.sin(sL.yaw) * 3); T.toets(); pl.yaw = T.stand.yaw; pl.pitch = 0.05; stap(20);
  T.zetCamera(); const oog0 = g.camera.position.clone();
  T.vuur(); T.update(0.016); T.zetCamera();
  uit.terugslag = { kick: r2(T.stand.kick), oog: r2(g.camera.position.distanceTo(oog0)), schok: r2(g.schokNu()) };
  stap(60); T.uit(); T.zetTerug(); stap(1);

  // ---- 9. uitstappen, en te voet tegen de Tiger
  const sU = T.stand;
  T.uit();
  uit.uitstap = { actief: T.actief, inTiger: pl.inTiger, water: W.pointInWater(pl.pos.x, pl.pos.z), afstand: r2(Math.hypot(pl.pos.x - sU.x, pl.pos.z - sU.z)) };
  T.zetTerug(); stap(1);
  const sB = T.stand;
  const [bx, bz] = W.resolveCollisions(sB.x, sB.z, 0.35);
  uit.teVoet = r2(Math.hypot(bx - sB.x, bz - sB.z));
  uit.verkeer = (g.vehicles.extraBlokkades || []).includes(T.blok);

  // ---- 10. shaders: bij de Tiger kijken, instappen, schieten (vlam en inslag) en tekenen
  pl.pos.set(sB.x + Math.cos(sB.yaw) * 3, 0.2, sB.z - Math.sin(sB.yaw) * 3); T.toets();
  pl.yaw = sB.yaw; pl.pitch = 0.05; stap(10);
  W.updateLOD(sB.x, sB.z);
  T.zetCamera(); g.scene.updateMatrixWorld(true); R.render(g.scene, g.camera);
  T.vuur(); T.update(0.02); for (const k of g.tigerKnallen) k.update(0.05);
  R.render(g.scene, g.camera);
  if (!g.derde.aan) g.derde.wissel(); T.zetCamera(); R.render(g.scene, g.camera); g.derde.wissel();
  uit.programmas = { voor: programmasVoor, na: R.info.programs.length };
  T.uit(); T.zetTerug();
  pl.active = false; window.__autoplay = false;
  return uit;
});

kop('1. de plek');
ok(r.vloer.every(v => !v.water), 'geen water onder de tegelvloer (vier hoeken en het midden)', JSON.stringify(r.vloer));
ok(r.vloer.every(v => v.soort.includes('grasland agrarisch')), 'de vloer ligt op het weiland (grasland agrarisch)', JSON.stringify(r.vloer.map(v => v.soort)));
ok(r.dWeg > 12 && r.dWeg < 30 && !r.pand, 'vlak bij de Sudergoweg, niet in een pand', `${r2(r.dWeg)} m van de as`);

kop('2. de gedenksteen');
ok(r.tekst.TEKST.join(' ').includes('Slag om Sneek') && r.tekst.TEKST.includes('1944') && r.tekst.DONATIE === 'gedoneerd door Veteraan met het dikke hondje', 'de tekst: ter nagedachtenis aan de Slag om Sneek, 1944, gedoneerd door Veteraan met het dikke hondje', JSON.stringify(r.tekst));

kop('3. het model');
const M = r.maat;
ok(Math.abs(M.lang - 8.45) < 0.3, 'met het kanon 8,45 m lang', `${M.lang} m`);
ok(Math.abs(M.romp - 6.32) < 0.35, 'de romp 6,32 m (met spatborden en rupsen)', `${M.romp} m`);
ok(Math.abs(M.breed - 3.56) < 0.25, '3,56 m breed', `${M.breed} m`);
ok(Math.abs(M.hoog - 3.0) < 0.2, '3,0 m hoog tot de koepel', `${M.hoog} m`);
ok(Math.abs(M.onder) < 0.06, 'de rupsen staan op de grond', `${M.onder} m`);

kop('4. instappen en rijden');
ok(r.hint && r.hint.includes('Tiger'), 'naast de Tiger: "E — in de Tiger stappen"', r.hint);
ok(r.inE && r.actief && r.inTiger, 'E: je zit erin');
ok(r.draaiPlaats.yaw > 0.5 && r.draaiPlaats.verplaatst < 0.3, 'A draait de romp op de plaats naar links', JSON.stringify(r.draaiPlaats));
ok(Math.sign(r.draaiPlaats.links) === -Math.sign(r.draaiPlaats.rechts) && r.draaiPlaats.links !== 0, 'op de plaats lopen de rupsen tegen elkaar in', JSON.stringify(r.draaiPlaats));
ok(r.vooruit > 5, 'W: vooruit', `${r.vooruit} m`);
ok(r.wielDraait !== 0, 'de wielen draaien mee', `${r.wielDraait} rad`);
ok(r.achteruit < -1, 'S: achteruit', `${r.achteruit} m`);
ok(r.speler < 0.01, 'de speler rijdt mee (zijn plek is die van de Tiger)', `${r.speler} m`);

kop('5. de koepel en het kanon');
ok(Math.abs(r.koepel.na1 - 0.55) < 0.08, 'de koepel draait met zijn eigen snelheid (0,55 rad/s)', JSON.stringify(r.koepel));
ok(Math.abs(r.koepel.na4 - 1.0) < 0.03 && Math.abs(r.koepel.romp) < 0.01, 'en komt waar de muis wijst, de romp blijft staan', JSON.stringify(r.koepel));
ok(Math.abs(r.richtOp - 15) < 0.3 && Math.abs(r.richtNeer + 8) < 0.3, 'het kanon richt van −8° tot +15°', `${r.richtNeer}° … ${r.richtOp}°`);

kop('6. schieten');
ok(r.schot.hit === 'auto' && r.schot.wrak && r.schot.knallen > 0, 'een granaat op een auto: een ontploffing en een wrak', JSON.stringify(r.schot));
ok(r.schot.herlaad === 8 && r.schot.hud.startsWith('HERLADEN'), 'daarna acht seconden herladen, in de hud', JSON.stringify(r.schot));
ok(r.nogEens === false && r.na5.mag === false, 'tijdens het herladen geen tweede schot', JSON.stringify(r.na5));
ok(r.na8.herlaad === 0 && r.na8.mag, 'na acht seconden weer geladen', JSON.stringify(r.na8));

kop('7. de camera');
ok(r.binnen.langsLoop > 0.99, 'binnen: je kijkt langs de loop', JSON.stringify(r.binnen));
ok(Math.abs(r.binnen.mond[0]) < 0.5 && r.binnen.mond[1] < 0.2 && r.binnen.mond[1] > -0.8 && r.binnen.mond[2] < 1, 'de monding in beeld, net onder het midden', JSON.stringify(r.binnen.mond));
ok(r.binnen.hoogte > 0.8 && r.binnen.hoogte < 1.4, 'het oog op de koepel', JSON.stringify(r.binnen));
ok(r.buiten.afstand > 4 && r.buiten.afstand < 13 && r.buiten.hoog > 1, 'met V van buiten, achter de Tiger', JSON.stringify(r.buiten));
ok(r.hud.zichtbaar, 'het vizier en de lading in beeld', JSON.stringify(r.hud));

kop('8. van de gedenkplek af');
ok(r.vanPlek.minWeg < 2.5, 'over de dam tot op de Sudergoweg', JSON.stringify(r.vanPlek));
ok(r.vanPlek.water === 0, 'nooit met een hoek in het water', JSON.stringify(r.vanPlek));
ok(r.vanPlek.maxStap < 0.6, 'geen sprong (hooguit 10,5 m/s)', JSON.stringify(r.vanPlek));
ok(!r.muur || (!r.muur.binnen && r.muur.afstand > 0.5), 'tegen een muur houdt hij op', JSON.stringify(r.muur));

kop('11. treffers, waarschuwing en ontploffen');
ok(r.treffer.erik === 100 && r.treffer.romp === 270, 'een treffer raakt Erik niet: de romp vangt hem', JSON.stringify(r.treffer));
ok(!r.alarmVoor, 'met een gave romp geen alarm');
ok(r.kritiek.alarm && r.kritiek.tekst.includes('STAP UIT'), 'kritiek: in rood "STAP UIT (E)"', r.kritiek.tekst);
ok(r.kritiek.rook > 0.1 && r.kritiek.tril > 0.001 && r.kritiek.schok > 0.05, 'kritiek: rook uit het motordek, de romp trilt, het beeld schudt', JSON.stringify(r.kritiek));
ok(r.brand > 0.2, 'nog lager: vlammen', `${r.brand}`);
ok(r.ontploft.kapot && !r.ontploft.actief && !r.ontploft.inTiger && r.ontploft.erik <= 0 && r.ontploft.knal > 0, 'op nul ontploft hij, en wie binnen zit gaat neer', JSON.stringify(r.ontploft));
ok(r.ontploft.zwart === '1c1b19', 'het wrak is roetzwart', r.ontploft.zwart);
ok(!r.wrak.in && !r.wrak.actief && r.wrak.hint === 'De Tiger is uitgebrand', 'in een wrak stap je niet', JSON.stringify(r.wrak));
ok(!r.nieuw.kapot && r.nieuw.leven === 300 && r.nieuw.kleur !== '1c1b19' && r.nieuw.rook === 0, 'terug op de gedenkplek: weer heel', JSON.stringify(r.nieuw));
ok(r.terugslag.kick > 0.9 && r.terugslag.oog > 0.1 && r.terugslag.schok >= 0.5, 'een schot: terugslag en het beeld schudt', JSON.stringify(r.terugslag));

kop('9. uitstappen');
ok(!r.uitstap.actief && !r.uitstap.inTiger && !r.uitstap.water && r.uitstap.afstand > 2, 'E: naast de romp, niet in het water', JSON.stringify(r.uitstap));
ok(r.teVoet > 1.5, 'te voet houdt de Tiger je tegen', `${r.teVoet} m opzij geduwd`);
ok(r.verkeer, 'het verkeer kent de Tiger als blokkade');

kop('10. shaders');
ok(r.programmas.na === r.programmas.voor, 'geen nieuw shaderprogramma bij de Tiger, het schot en de inslag', `${r.programmas.voor} → ${r.programmas.na}`);

await browser.close();
console.log(fout ? `\n${fout} fout(en)` : '\nalles goed');
process.exit(fout ? 1 : 0);
