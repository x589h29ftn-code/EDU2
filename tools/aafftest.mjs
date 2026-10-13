/*
 Stap 159: het kantoor aan het water naast de loods van Bouwman, Stadsrondweg-Zuid 121–121A (npm run aafftest).
 Gevraagd met vier foto's: "Ziet in het echt zo uit. Maak het logo Excellente en aaff in de nacht lichtgevend."

   1. het pand staat op zijn voetafdruk (BAG 1900100010087325): de nagebouwde kubus en hal binnen de voetafdruk, en het
      geschatte BAG-blok is weg (een straal van boven op de hal raakt het nieuwe pand, niets anders);
   2. van het water op 1,2 m de glazen pui, op 7 m de koperen lamellen; de kubus ongeveer 12,5 m breed en 10 m hoog,
      de hal lager dan de kubus; de botsdozen van het pand blijven;
   3. de logo's: "aaff." (paars, met een groene punt) op de waterkant en "Excellente" (rood) op de oostgevel, plat op hun
      gevel; letters op het doek in de goede kleur;
   4. 's nachts lichtgevend: overdag geen gloed, 's nachts na een paar tellen de volle sterkte, overdag weer uit;
   5. overdag geen nieuw shaderprogramma als het pand in beeld komt; 's nachts hoogstens zijn eigen twee (de omgeving
      vertaalt daar de eerste nacht tientallen nachtvarianten, zie open punt 30).

 Gebruik: npm run server &  node tools/aafftest.mjs [poort]
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
page.setDefaultTimeout(900000);
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

const r = await page.evaluate(async () => {
  const THREE = await import('three');
  const g = window.__game, W = await import('./js/world.js');
  const { KAART } = await import('./js/kaart.js');
  const { AAFF } = await import('./js/aaff.js');
  document.getElementById('overlay').style.display = 'none';
  g.player.active = false; window.__autoplay = false;
  await g.voorbereidSpel();
  const A = g.aaff, uit = { er: !!A };
  if (!A) return uit;
  const p = KAART.panden.find(q => q.id === AAFF.pand);
  const binnen = (x, z, v) => { let c = false; for (let i = 0, j = v.length - 1; i < v.length; j = i++) { const a = v[i], b = v[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  const randAfst = (x, z, v) => { let best = Infinity; for (let i = 0, j = v.length - 1; i < v.length; j = i++) { const a = v[j], b = v[i], dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l)); best = Math.min(best, Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z)); } return best; };
  W.updateLOD(1561, -150); g.scene.updateMatrixWorld(true);
  // ---- 1. op de voetafdruk, en het oude blok weg
  const M = A.maten;
  // de hoeken van de kubus (de glazen uitbouw links steekt 1,6 m over een inham in de voetafdruk: daar meten we 2 m diep)
  const K0 = Math.max(0, M.B - AAFF.kubus);
  const hoeken = [[M.B - 0.01, 0.01], [K0 + 0.01, 0.01], [M.B - 0.01, M.D - 0.01], [0.3, 2.0]].map(([u, w]) => A.wereld(u, 0, w));
  uit.hoekenBinnen = hoeken.map(v => binnen(v.x, v.z, p.voet) || randAfst(v.x, v.z, p.voet) < 0.3);
  const halMid = A.wereld((M.hal.u0 + M.hal.u1) / 2, 0, (Math.max(M.D, M.hal.w0) + M.hal.w1) / 2);
  const rc = new THREE.Raycaster(new THREE.Vector3(halMid.x, 40, halMid.z), new THREE.Vector3(0, -1, 0), 0, 60);
  const boven = rc.intersectObjects(g.scene.children, true).filter(h => h.object.visible && h.object.isMesh && !h.object.isInstancedMesh);
  uit.boven = boven.slice(0, 2).map(h => ({ klasse: h.object.userData.klasse || h.object.name || '?', y: +h.point.y.toFixed(2) }));
  // ---- 2. van het water
  const n = M.n, front = A.wereld(M.B - 3, 0, 0);
  const straal = (y) => {
    const o = new THREE.Vector3(front.x + n[0] * 20, y, front.z + n[1] * 20), d = new THREE.Vector3(-n[0], 0, -n[1]);
    const h = new THREE.Raycaster(o, d, 0, 40).intersectObjects(A.groep.children, false)[0];
    if (!h) return null;
    const mat = h.object.material, MAT = A.materialen;
    return Object.keys(MAT).find(k => MAT[k] === mat) || '?';
  };
  uit.van = { y12: straal(1.2), y7: straal(7) };
  uit.maten = { kubus: +(M.B - Math.max(0, M.B - AAFF.kubus)).toFixed(1), top: M.top, hal: AAFF.hal, B: +M.B.toFixed(1), D: +M.D.toFixed(1) };
  const mid = A.wereld(M.B / 2, 0, M.D / 2);
  const [cx, cz] = W.resolveCollisions(mid.x, mid.z, 0.4);
  uit.bots = Math.hypot(cx - mid.x, cz - mid.z) > 0.5;
  // ---- 3. de logo's
  uit.logos = A.logos.map(l => {
    const naar = new THREE.Vector3(0, 0, 1).applyQuaternion(l.quaternion);
    // waar is de gevel? de afstand van het midden van het logo tot het gevelvlak (waterkant w = 0, oostgevel u = B)
    let afst;
    if (l.name === 'aaff') afst = Math.abs((l.position.x - A.wereld(0, 0, 0).x) * n[0] + (l.position.z - A.wereld(0, 0, 0).z) * n[1]);
    else { const e = M.e, o = A.wereld(M.B, 0, 0); afst = Math.abs((l.position.x - o.x) * e[0] + (l.position.z - o.z) * e[1]); }
    const img = l.material.map.image, c = img.getContext('2d').getImageData(0, 0, img.width, img.height).data;
    let n2 = 0, r = 0, gr = 0, b = 0, groen = 0;
    for (let i = 0; i < c.length; i += 4) if (c[i + 3] > 128) { n2++; r += c[i]; gr += c[i + 1]; b += c[i + 2]; if (c[i + 1] > c[i] + 60 && c[i + 1] > c[i + 2]) groen++; }
    return { naam: l.name, afst: +afst.toFixed(3), y: +l.position.y.toFixed(2), naarWater: +(naar.x * n[0] + naar.z * n[1]).toFixed(2), naarOost: +(naar.x * M.e[0] + naar.z * M.e[1]).toFixed(2),
      dekking: +(n2 / (c.length / 4)).toFixed(3), kleur: [r, gr, b].map(v => Math.round(v / Math.max(1, n2))), groen };
  });
  // ---- 4. 's nachts
  A.update(10, false); const dag = A.gloed;
  const lopen = (nacht, sec) => { for (let i = 0; i < sec * 30; i++) A.update(1 / 30, nacht); return A.gloed; };
  const na1 = lopen(true, 0.5), na5 = lopen(true, 5), weerDag = lopen(false, 5);
  uit.gloed = { dag, na1, na5, weerDag, max: AAFF.gloedNacht, mats: A.logoMaterialen.map(m => m.emissiveIntensity) };
  // ---- 5. shaders: dag en nacht in beeld
  const C = g.camera, R = g.renderer;
  // (de eerste nacht op een plek ver van het begin vertaalt de nachtvarianten van wat er staat; dat hoort niet bij dit
  // pand. Dus: eerst zonder het pand, dan met, overdag en 's nachts)
  const kijk = (uur, zien) => {
    g.sfeer.uur = uur; for (let i = 0; i < 3; i++) g.sfeer.update(0.1, 1561, -145);
    A.update(10, g.sfeer.nacht); A.groep.visible = zien;
    C.position.set(1561, 4, -140); C.lookAt(1561, 5, -165); C.updateMatrixWorld(true);
    W.updateLOD(1561, -140); g.scene.updateMatrixWorld(true); R.render(g.scene, C);
    return R.info.programs.length;
  };
  // (het pand zelf is al bij het opstarten vertaald, overdag én 's avonds: de tegenproef zonder pand begint daarom
  // met een eerste ronde om de omgeving klaar te zetten)
  kijk(13, false); kijk(1, false);
  uit.prog = [kijk(13, false), kijk(13, true), kijk(1, false), kijk(1, true)];
  A.groep.visible = true;
  return uit;
});

kop('1. op zijn voetafdruk');
ok(r.er, 'het pand is gebouwd');
if (!r.er) { await browser.close(); console.log(`\n${fout + 1} fout(en)`); process.exit(1); }
ok(r.hoekenBinnen.every(Boolean), 'de hoeken van de kubus en de westkant liggen op de voetafdruk', JSON.stringify(r.hoekenBinnen));
ok(r.boven.length && r.boven[0].klasse === 'aaff' && r.boven.every(h => h.klasse === 'aaff' || h.y < 0.5),
  'van boven op de hal: het nieuwe pand, geen oud blok eronder', JSON.stringify(r.boven));
kop('2. van het water');
ok(r.van.y12 === 'pui' && r.van.y7 === 'koper', 'op 1,2 m de glazen pui, op 7 m de koperen lamellen', JSON.stringify(r.van));
ok(r.maten.kubus >= 12 && r.maten.kubus <= 13 && r.maten.top >= 9.5 && r.maten.top <= 11.5 && r.maten.hal < r.maten.top,
  'de kubus 12,5 m breed en ~10 m hoog, de hal lager', JSON.stringify(r.maten));
ok(r.bots, 'de botsdozen van het pand blijven');
kop('3. de logo\'s');
const la = r.logos.find(l => l.naam === 'aaff'), le = r.logos.find(l => l.naam === 'Excellente');
ok(la && la.afst < 0.15 && la.naarWater > 0.95, '"aaff." plat op de waterkant, naar het water', la && `${la.afst} m, ${la.naarWater}`);
ok(le && le.afst < 0.15 && le.naarOost > 0.95, '"Excellente" plat op de oostgevel', le && `${le.afst} m, ${le.naarOost}`);
ok(la && la.dekking > 0.05 && la.kleur[2] > la.kleur[0] && la.groen > 50, '"aaff." in paars, met een groene punt', la && `${JSON.stringify(la.kleur)}, ${la.groen} groene beeldpunten`);
ok(le && le.dekking > 0.03 && le.kleur[0] > le.kleur[1] + 60 && le.kleur[0] > le.kleur[2] + 60, '"Excellente" in rood', le && JSON.stringify(le.kleur));
ok(la && le && la.y > r.maten.top - 1.2 && le.y > r.maten.top - 1.2, 'allebei bovenaan de gevel', la && le && `${la.y} en ${le.y} m`);
kop("4. 's nachts lichtgevend");
const gl = r.gloed;
ok(gl.dag === 0, 'overdag geen gloed', `${gl.dag}`);
ok(gl.na1 > 0 && gl.na1 < gl.max && Math.abs(gl.na5 - gl.max) < 0.02, "'s nachts in een paar tellen naar de volle sterkte", `${gl.na1.toFixed(2)} → ${gl.na5.toFixed(2)} (${gl.max})`);
ok(gl.weerDag === 0 && gl.mats.every(v => v === 0), 'overdag weer uit, op beide logo\'s', JSON.stringify(gl.mats));
kop('5. shaders');
// (de eerste nacht ver van het beginpunt vertaalt three ook de nachtvarianten van de omgeving, tientallen: dat is
// algemeen, zie open punt 30 in CLAUDE.md. Van het pand zelf hoogstens zijn twee eigen soorten, het logo en het glas)
ok(r.prog[1] === r.prog[0] && r.prog[3] - r.prog[2] <= 2, 'het pand in beeld: overdag geen nieuw programma, \'s nachts hoogstens zijn eigen twee', `dag ${r.prog[0]} → ${r.prog[1]}, nacht ${r.prog[2]} → ${r.prog[3]}`);

await browser.close();
console.log(fout ? `\n${fout} fout(en)` : '\nalles goed');
process.exit(fout ? 1 : 0);
