/*
 Stap 162: Tennishal Sneek aan de Lemmerweg 130a (npm run tennishaltest).
 Gevraagd: "herbouw ook 597.5, 158.2 zie foto. Is Tennishal Sneek."

   1. het pand staat op zijn voetafdruk (BAG 0091100000013880) en het oude groene blok is weg: een straal van boven
      raakt het nieuwe dak van lichtgrijze golfplaat en niets van een oud blok eronder;
   2. een zadeldak met de nok over de lengte: de hoogte op de nok (op drie plekken langs de hal) en aan de goot;
   3. de gevel: lichtgrijze panelen (het doek gemeten) met donkere diagonalen (kruisen op de lange gevels, langs een
      lijn over de zuidgevel geteld);
   4. de zwarte plint langs de zuidgevel, met staanders ervoor;
   5. het bord "tennishal SNEEK": blauw en wit op het doek, plat op de lange gevel en op de aanbouw;
   6. de witte aanbouw met de entree: glas, de blauwe luifel, wit metselwerk;
   7. de botsdozen van het pand blijven;
   8. geen nieuw shaderprogramma als de hal in beeld komt (dag en nacht).

 Gebruik: npm run server &  node tools/tennishaltest.mjs [poort]
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fout = 0;
const ok = (goed, wat, extra = '') => { console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`); if (!goed) fout++; };
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
page.setDefaultTimeout(1800000);
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 1800000 });

const r = await page.evaluate(async () => {
  const THREE = await import('three');
  const g = window.__game, W = await import('./js/world.js');
  const { KAART } = await import('./js/kaart.js');
  const { TENNISHAL, TENNISHAL_PAND } = await import('./js/tennishal.js');
  document.getElementById('overlay').style.display = 'none';
  g.player.active = false; window.__autoplay = false;
  await g.voorbereidSpel();
  const A = TENNISHAL_PAND.nu, uit = { er: !!A };
  if (!A) return uit;
  const M = A.maten, MAT = A.materialen;
  const p = KAART.panden.find(q => q.id === TENNISHAL.pand);
  const binnen = (x, z, v) => { let c = false; for (let i = 0, j = v.length - 1; i < v.length; j = i++) { const a = v[i], b = v[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  const randAfst = (x, z, v) => { let best = Infinity; for (let i = 0, j = v.length - 1; i < v.length; j = i++) { const a = v[j], b = v[i], dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l)); best = Math.min(best, Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z)); } return best; };
  const midden = A.wereld(M.L / 2, 0, M.D / 2);
  W.updateLOD(midden.x, midden.z); g.scene.updateMatrixWorld(true);
  const naam = (mat) => mat === A.bordMateriaal ? 'bord' : (Object.keys(MAT).find(k => MAT[k] === mat) || '?');
  const nE = new THREE.Vector3(M.e[0], 0, M.e[1]), nN = new THREE.Vector3(M.n[0], 0, M.n[1]);
  // een straal in lokale maten: van (u, y, w) in de lokale richting d
  const straal = (u, y, w, d, wat = A.groep.children) => {
    const o = A.wereld(u, y, w), dir = new THREE.Vector3(d[0] * M.e[0] + d[2] * M.n[0], d[1], d[0] * M.e[1] + d[2] * M.n[1]).normalize();
    return new THREE.Raycaster(o, dir, 0, 80).intersectObjects(wat, true).filter(h => h.object.visible && h.object.isMesh);
  };
  const eerste = (u, y, w, d, zonder = []) => { const h = straal(u, y, w, d).find(h => !zonder.includes(naam(h.object.material))); return h ? { mat: naam(h.object.material), y: +h.point.y.toFixed(2), afst: +h.distance.toFixed(2) } : null; };
  const doekGem = (tex) => {
    const img = tex.image, c = img.getContext('2d').getImageData(0, 0, img.width, img.height).data;
    let r = 0, gr = 0, b = 0, n = 0; for (let i = 0; i < c.length; i += 4) { r += c[i]; gr += c[i + 1]; b += c[i + 2]; n++; }
    return [r / n, gr / n, b / n].map(Math.round);
  };

  // ---- 1. op de voetafdruk, het oude blok weg
  const hoeken = [[0.05, 0.05], [M.L - 0.05, 0.05], [M.L - 0.05, M.D - 0.05], [0.05, M.D - 0.05]].map(([u, w]) => A.wereld(u, 0, w));
  uit.hoeken = hoeken.map(v => binnen(v.x, v.z, p.voet) || randAfst(v.x, v.z, p.voet) < 0.4);
  uit.maat = { L: +M.L.toFixed(1), D: +M.D.toFixed(1), goot: +M.goot.toFixed(2), nok: +M.nok.toFixed(2), grond: M.grond };
  uit.van = [[M.L / 2, M.D / 4], [M.L * 0.2, M.D * 0.75], [M.L * 0.85, M.D * 0.3]].map(([u, w]) => {
    const o = A.wereld(u, 40, w);
    const hs = new THREE.Raycaster(o, new THREE.Vector3(0, -1, 0), 0, 60).intersectObjects(g.scene.children, true)
      .filter(h => h.object.visible && h.object.isMesh && !h.object.isInstancedMesh);
    return hs.slice(0, 4).map(h => ({ klasse: h.object.userData.klasse || h.object.name || '?', mat: h.object.userData.klasse === 'tennishal' ? naam(h.object.material) : '-', y: +h.point.y.toFixed(2) }));
  });
  uit.dakKleur = doekGem(MAT.dak.map);
  // ---- 2. het zadeldak
  uit.nokY = [5, M.L / 2, M.L - 5].map(u => eerste(u, 30, M.D / 2, [0, -1, 0])?.y);
  uit.gootY = [[M.L / 2, 0.3], [M.L / 2, M.D - 0.3]].map(([u, w]) => eerste(u, 30, w, [0, -1, 0])?.y);
  uit.kwartY = eerste(M.L / 2, 30, M.D / 4, [0, -1, 0])?.y;
  // ---- 3. de gevel
  uit.paneel = doekGem(MAT.paneel.map);
  uit.streepKleur = MAT.streep.color.getHSL({}).l;
  uit.strepen = A.strepen.map(s => ({ gevel: s.gevel, soort: s.soort, hoek: +s.hoek.toFixed(0) }));
  // langs een lijn over de zuidgevel op 5,5 m (boven de plint en het bord), om de halve meter
  const lijn = [];
  for (let u = 0.5; u < M.L - 0.5; u += 0.5) { const h = eerste(u, M.grond + 5.5, M.D + 8, [0, 0, -1]); lijn.push(h ? h.mat : '-'); }
  let wissel = 0; for (let i = 1; i < lijn.length; i++) if ((lijn[i] === 'streep') !== (lijn[i - 1] === 'streep')) wissel++;
  uit.lijn = { streep: lijn.filter(m => m === 'streep').length / lijn.length, paneel: lijn.filter(m => m === 'paneel').length / lijn.length, wissel };
  // en op twee hoogtes: een diagonaal schuift op met de hoogte (het midden van een kruis blijft staan)
  const lijnOp = (y) => { const l = []; for (let u = 0.5; u < M.L - 0.5; u += 0.25) { const h = eerste(u, y, M.D + 8, [0, 0, -1]); l.push(h && h.mat === 'streep' ? 1 : 0); } return l; };
  const l3 = lijnOp(M.grond + 3.4), l6 = lijnOp(M.grond + 5.9);
  let gelijk = 0, samen = 0; for (let i = 0; i < l3.length; i++) { if (l3[i] || l6[i]) samen++; if (l3[i] && l6[i]) gelijk++; }
  uit.diagonaal = { overlap: +(gelijk / Math.max(1, samen)).toFixed(2) };
  // de puntgevel boven de aanbouw: de donkergrijze vlakken
  const punt = []; for (let w = 1; w < M.D - 1; w += 0.5) { const h = eerste(-8, M.grond + 6.5, w, [1, 0, 0]); if (h) punt.push(h.mat); }
  uit.punt = { veld: punt.filter(m => m === 'veld').length, streep: punt.filter(m => m === 'streep').length, paneel: punt.filter(m => m === 'paneel').length };
  // ---- 4. de plint
  const S = M.strook, pl = [];
  for (let u = S.u0 + 1.3; u < S.u1 - 0.5; u += 2.1) { const h = eerste(u, M.grond + 1.2, M.D + 8, [0, 0, -1], ['paal']); pl.push(h ? h.mat : '-'); }
  uit.plint = { lengte: +(S.u1 - S.u0).toFixed(1), deel: +((S.u1 - S.u0) / M.L).toFixed(2), raak: pl.filter(m => m === 'plint').length / pl.length, hoog: +(M.plint - M.grond).toFixed(2),
    licht: MAT.plint.color.getHSL({}).l, palen: straal(S.u0 + 0.6, M.grond + 1.2, M.D + 8, [0, 0, -1]).slice(0, 1).map(h => naam(h.object.material))[0],
    boven: eerste((S.u0 + S.u1) / 2 - 3, M.grond + 4, M.D + 8, [0, 0, -1])?.mat };
  // ---- 5. de borden
  const img = A.bordMateriaal.map.image, c = img.getContext('2d').getImageData(0, 0, img.width, img.height).data;
  let blauw = 0, wit = 0; const tot = c.length / 4;
  for (let i = 0; i < c.length; i += 4) { if (c[i + 2] > c[i] + 60 && c[i + 2] > 120) blauw++; if (c[i] > 230 && c[i + 1] > 230 && c[i + 2] > 230) wit++; }
  uit.bordDoek = { blauw: +(blauw / tot).toFixed(3), wit: +(wit / tot).toFixed(3) };
  uit.borden = A.borden.map(b => {
    const naar = new THREE.Vector3(0, 0, 1).applyQuaternion(b.quaternion);
    const [u, w] = A.lokaal(b.position.x, b.position.z);
    // achter het bord: wat zit er een halve meter verder, terug langs zijn normaal?
    const o = b.position.clone().addScaledVector(naar, 1.0);
    const hs = new THREE.Raycaster(o, naar.clone().negate(), 0, 3).intersectObjects(A.groep.children, true).filter(h => h.object !== b);
    const achter = hs.find(h => !['streep', 'veld'].includes(naam(h.object.material)));
    return { naam: b.name, u: +u.toFixed(2), w: +w.toFixed(2), y: +b.position.y.toFixed(2), naarZuid: +naar.dot(nN).toFixed(2), naarWest: +(-naar.dot(nE)).toFixed(2),
      achter: achter ? naam(achter.object.material) : null, afst: achter ? +(achter.distance - 1.0).toFixed(3) : null };
  });
  // ---- 6. de aanbouw en de entree
  const I = A.ingang;
  uit.ingang = I && {
    deur: eerste(I.u - 6, M.grond + 1.2, I.w + 0.5, [1, 0, 0])?.mat,   // (in het midden staat de stijl tussen de twee deuren)
    naast: eerste(I.u - 6, M.grond + 1.2, I.w - 4.5, [1, 0, 0])?.mat,
    luifel: eerste(I.u - 0.75, M.grond + 3.3, I.w, [0, -1, 0]),
    luifelKleur: MAT.luifel.color.toArray().map(v => +v.toFixed(2)),
  };
  uit.delen = A.delen.map(d => ({ naam: d.naam, h: +(d.h - M.grond).toFixed(2) }));
  uit.wit = doekGem(MAT.wit.map);
  const zuid = A.delen.find(d => d.naam === 'zuid'), noord = A.delen.find(d => d.naam === 'noord');
  const zw = zuid.ring.reduce((s, q) => [s[0] + q[0] / zuid.ring.length, s[1] + q[1] / zuid.ring.length], [0, 0]);
  const zm = A.wereld(Math.min(zw[0], -3), 0, zw[1] + 2);
  uit.aanbouwDak = new THREE.Raycaster(new THREE.Vector3(zm.x, 30, zm.z), new THREE.Vector3(0, -1, 0), 0, 40).intersectObjects(g.scene.children, true)
    .filter(h => h.object.visible && h.object.isMesh && !h.object.isInstancedMesh).slice(0, 2).map(h => ({ mat: h.object.userData.klasse === 'tennishal' ? naam(h.object.material) : h.object.userData.klasse || '?', y: +h.point.y.toFixed(2) }));
  const nw = noord.ring.reduce((s, q) => [s[0] + q[0] / noord.ring.length, s[1] + q[1] / noord.ring.length], [0, 0]);
  uit.noordGevel = eerste(-25, M.grond + 3.0, nw[1], [1, 0, 0])?.mat;
  // ---- 7. botsdozen
  const dicht = (x, z) => { const [cx, cz] = W.resolveCollisions(x, z, 0.4); return Math.hypot(cx - x, cz - z) > 0.5; };
  uit.bots = { hal: dicht(midden.x, midden.z), kwart: dicht(A.wereld(M.L * 0.2, 0, M.D * 0.3).x, A.wereld(M.L * 0.2, 0, M.D * 0.3).z), aanbouw: dicht(zm.x, zm.z) };
  // ---- 8. shaders: met de hal verborgen en zichtbaar, dag en nacht
  const C = g.camera, R = g.renderer;
  const kijk = (uur, zien) => {
    g.sfeer.uur = uur; for (let i = 0; i < 3; i++) g.sfeer.update(0.1, 597.5, 158.2);
    A.groep.visible = zien;
    C.position.set(597.5, 2, 158.2); C.lookAt(midden.x, 5, midden.z); C.updateMatrixWorld(true);
    W.updateLOD(597.5, 158.2); g.scene.updateMatrixWorld(true); R.render(g.scene, C);
    return R.info.programs.length;
  };
  kijk(13, false); kijk(1, false);
  uit.prog = [kijk(13, false), kijk(13, true), kijk(1, false), kijk(1, true)];
  A.groep.visible = true;
  return uit;
});

kop('1. op zijn voetafdruk, het oude blok weg');
ok(r.er, 'de tennishal is gebouwd');
if (!r.er) { await browser.close(); console.log(`\n${fout + 1} fout(en)`); process.exit(1); }
console.log('       maten:', JSON.stringify(r.maat));
ok(r.hoeken.every(Boolean), 'de vier hoeken van de hal liggen op de voetafdruk', JSON.stringify(r.hoeken));
ok(r.maat.L > 60 && r.maat.L < 75 && r.maat.D > 34 && r.maat.D < 44, 'de hal is ~67 × 39 m (de 3D BAG)', `${r.maat.L} × ${r.maat.D}`);
ok(r.van.every(hs => hs.length && hs[0].klasse === 'tennishal' && hs[0].mat === 'dak' && hs.every(h => h.klasse === 'tennishal' || h.y < 0.5)),
  'van boven: het nieuwe dak, geen oud blok eronder', JSON.stringify(r.van));
ok(r.dakKleur.every(v => v > 150) && Math.max(...r.dakKleur) - Math.min(...r.dakKleur) < 15, 'het dak is lichtgrijs (golfplaat)', JSON.stringify(r.dakKleur));
kop('2. het zadeldak');
ok(r.nokY.every(y => y && Math.abs(y - (r.maat.nok + 0.07)) < 0.2), 'de nok over de hele lengte op de nokhoogte uit de 3D BAG', `${JSON.stringify(r.nokY)} (nok ${r.maat.nok})`);
ok(r.gootY.every(y => y && y < r.maat.goot + 0.3 && y > r.maat.goot - 0.3), 'aan beide goten op de goothoogte', `${JSON.stringify(r.gootY)} (goot ${r.maat.goot})`);
ok(r.kwartY > r.maat.goot + 1 && r.kwartY < r.maat.nok - 1 && Math.abs(r.kwartY - (r.maat.goot + r.maat.nok) / 2) < 0.6, 'halverwege de helling halverwege de hoogte: een rechte, flauwe helling', `${r.kwartY}`);
ok(r.maat.nok - r.maat.goot > 4 && r.maat.goot > 5 && r.maat.goot < 7, 'een lage goot en een nok erboven', `goot ${r.maat.goot}, nok ${r.maat.nok}`);
kop('3. de gevel');
ok(r.paneel.every(v => v > 170), 'het paneeldoek is lichtgrijs', JSON.stringify(r.paneel));
ok(r.streepKleur < 0.25, 'de diagonalen zijn donker', `lichtheid ${r.streepKleur.toFixed(2)}`);
const zs = r.strepen.filter(s => s.gevel === 'zuid'), schuin = (h) => { const a = Math.abs(h) % 180; return a > 15 && a < 165 && Math.abs(a - 90) > 10; };
ok(zs.length >= 6 && zs.every(s => schuin(s.hoek)) && zs.filter(s => s.hoek > 0).length >= 2 && zs.filter(s => s.hoek < 0).length >= 2,
  'op de zuidgevel kruisen: schuine stroken beide kanten op', JSON.stringify(zs.map(s => s.hoek)));
ok(r.lijn.streep > 0.12 && r.lijn.streep < 0.5 && r.lijn.paneel > 0.45 && r.lijn.wissel >= 8, 'langs de zuidgevel afwisselend panelen en donkere stroken', JSON.stringify(r.lijn));
ok(r.diagonaal.overlap < 0.5, 'de stroken lopen schuin (op 3,4 en 5,9 m op andere plekken)', JSON.stringify(r.diagonaal));
ok(r.punt.veld >= 6 && r.punt.paneel >= 6, 'op de puntgevel donkergrijze vlakken op de lichte panelen', JSON.stringify(r.punt));
kop('4. de plint');
ok(r.plint.deel > 0.6 && r.plint.raak > 0.9 && r.plint.licht < 0.15, 'een zwarte strook over het grootste deel van de zuidgevel', JSON.stringify(r.plint));
ok(r.plint.hoog > 2.2 && r.plint.hoog < 3.6 && r.plint.boven !== 'plint', 'ongeveer 2,5 m hoog, de gevel erboven vrij', `${r.plint.hoog} m, erboven ${r.plint.boven}`);
ok(r.plint.palen === 'paal', 'staanders voor de plint');
kop('5. het bord "tennishal SNEEK"');
ok(r.bordDoek.blauw > 0.05 && r.bordDoek.wit > 0.3, 'het doek is wit met blauw', JSON.stringify(r.bordDoek));
const bg = r.borden.find(b => b.naam === 'bord-gevel'), be = r.borden.find(b => b.naam === 'bord-entree');
ok(bg && bg.naarZuid > 0.95 && bg.achter === 'paneel' && bg.afst < 0.15, 'op de lange zuidgevel, plat ertegen', JSON.stringify(bg));
ok(be && be.naarWest > 0.95 && be.achter === 'wit' && be.afst < 0.15, 'op de witte aanbouw bij de entree, plat ertegen', JSON.stringify(be));
kop('6. de witte aanbouw en de entree');
ok(r.delen.length === 2 && r.delen.every(d => d.h > 2.8 && d.h < 4.5), 'twee lage delen met een plat dak (3D BAG)', JSON.stringify(r.delen));
ok(r.wit.every(v => v > 215), 'wit metselwerk', JSON.stringify(r.wit));
ok(r.aanbouwDak.length && r.aanbouwDak[0].mat === 'platdak', 'van boven op de aanbouw het platte dak', JSON.stringify(r.aanbouwDak));
ok(r.ingang && r.ingang.deur === 'glas', 'de entree: een glazen deur op de westgevel', JSON.stringify(r.ingang));
ok(r.ingang && r.ingang.naast === 'wit' && r.noordGevel === 'wit', 'ernaast en verderop wit', `${r.ingang && r.ingang.naast}, ${r.noordGevel}`);
ok(r.ingang && r.ingang.luifel && r.ingang.luifel.mat === 'luifel' && r.ingang.luifel.y > r.maat.grond + 2.4 && r.ingang.luifel.y < r.maat.grond + 3.2
  && r.ingang.luifelKleur[2] > r.ingang.luifelKleur[0] + 0.3, 'de blauwe luifel boven de deur', JSON.stringify(r.ingang && [r.ingang.luifel, r.ingang.luifelKleur]));
kop('7. botsdozen');
ok(r.bots.hal && r.bots.kwart && r.bots.aanbouw, 'de hal en de aanbouw zijn dicht', JSON.stringify(r.bots));
kop('8. shaders');
ok(r.prog[1] === r.prog[0] && r.prog[3] === r.prog[2], 'de hal in beeld: geen nieuw programma, overdag en \'s nachts', `dag ${r.prog[0]} → ${r.prog[1]}, nacht ${r.prog[2]} → ${r.prog[3]}`);

await browser.close();
console.log(fout ? `\n${fout} fout(en)` : '\nalles goed');
process.exit(fout ? 1 : 0);
