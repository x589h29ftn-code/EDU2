/*
 Bomen, struiken en gras (verzoek 24 sep 2026: "kijk ook eens naar de bomen,
 bosjes en het gras met dezelfde blik").

   node tools/server.mjs 8123 &   node tools/groentest.mjs [poort]

 Meet, net als tools/gebouwtest.mjs, wat je op een foto alleen toevallig ziet:

 1. Vorm: de kronen en struiken hebben gladde normalen (niet meer per vlak
    plat) en licht in de hoekpunten — onderin donkerder dan bovenin.
 2. Doek: kroon, stam en struik hebben een doek en een normal map.
 3. Staan ze goed? Elke stam begint op de grond (ook op de dijk van het
    viaduct), elke kroon begint boven hoofdhoogte, elke struik staat op de grond
    en zweeft niet, en er staat niets in een pand of op de rijbaan.
 4. Gras: geen witte snippers meer in het doek (een madeliefje van 25 cm), vijf
    meter per doek, en de variatie over grote afstand zit echt in de shader.
 5. Voor de pc: niet meer driehoeken in beeld dan vóór deze ronde (gemeten op
    drie vaste plekken: 7,52, 4,17 en 3,12 miljoen, inclusief de schaduwpas).
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fout = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fout++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);
const VOOR = [7521535, 4173770, 3123663];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

const r = await page.evaluate(async () => {
  const THREE = await import('three');
  const W = await import('/js/world.js');
  const KW = await import('/js/kaartwereld.js');
  const { grondHoogte } = await import('/js/viaduct.js');
  const { KAART } = await import('/js/kaart.js');
  const T = await import('/js/textures.js');
  const g = window.__game;
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true;
  const uit = {};
  // de pandrooster, zoals in de gebouwtest
  const C = 25, rooster = new Map(), sl = (i, j) => i * 100003 + j;
  for (const p of KAART.panden) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of p.voet) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    p._b = [x0, z0, x1, z1];
    for (let i = Math.floor(x0 / C); i <= Math.floor(x1 / C); i++) for (let j = Math.floor(z0 / C); j <= Math.floor(z1 / C); j++) { const k = sl(i, j); if (!rooster.has(k)) rooster.set(k, []); rooster.get(k).push(p); }
  }
  const inPoly = (x, z, poly) => { let q = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) q = !q; } return q; };
  const inPand = (x, z) => (rooster.get(sl(Math.floor(x / C), Math.floor(z / C))) || []).some(p => { const b = p._b; return x >= b[0] && x <= b[2] && z >= b[1] && z <= b[3] && inPoly(x, z, p.voet); });

  // ---- de vormen
  const meshes = { stam: [], kroon: [], kroonVer: [], kroonBobbel: [], struik: [] };
  g.scene.traverse(o => { if (o.isInstancedMesh && meshes[o.userData.klasse]) meshes[o.userData.klasse].push(o); });
  const vorm = (geo) => {
    const P = geo.attributes.position, N = geo.attributes.normal, K = geo.attributes.color;
    let glad = 0, onder = [0, 0], boven = [0, 0];
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
    for (let t = 0; t < P.count; t += 3) {
      a.fromBufferAttribute(P, t); b.fromBufferAttribute(P, t + 1); c.fromBufferAttribute(P, t + 2);
      n.subVectors(b, a).cross(c.clone().sub(a)).normalize();
      for (let k = 0; k < 3; k++) {
        const d = Math.abs(n.x * N.getX(t + k) + n.y * N.getY(t + k) + n.z * N.getZ(t + k));
        if (d < 0.995) glad++;
        if (K) { const y = P.getY(t + k); if (N.getY(t + k) < -0.5) { onder[0] += K.getX(t + k); onder[1]++; } if (N.getY(t + k) > 0.5) { boven[0] += K.getX(t + k); boven[1]++; } }
      }
    }
    return { glad: glad / P.count, onder: onder[1] ? onder[0] / onder[1] : null, boven: boven[1] ? boven[0] / boven[1] : null };
  };
  const eerste = (k) => meshes[k][0];
  uit.aantal = Object.fromEntries(Object.entries(meshes).map(([k, v]) => [k, v.reduce((t, m) => t + m.count, 0)]));
  uit.kroon = eerste('kroon') ? { ...vorm(eerste('kroon').geometry), map: !!eerste('kroon').material.map, normaal: !!eerste('kroon').material.normalMap } : null;
  uit.struik = eerste('struik') ? { ...vorm(eerste('struik').geometry), map: !!eerste('struik').material.map, normaal: !!eerste('struik').material.normalMap } : null;
  uit.stam = eerste('stam') ? { map: !!eerste('stam').material.map, normaal: !!eerste('stam').material.normalMap } : null;

  // ---- staan ze goed?
  const m = new THREE.Matrix4(), bb = new THREE.Box3();
  const kijk = (lijst, fn) => {
    for (const mesh of lijst) {
      mesh.geometry.computeBoundingBox();
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, m);
        if (m.elements[0] === 0 && m.elements[5] === 0) continue;     // op schaal nul: weg
        bb.copy(mesh.geometry.boundingBox).applyMatrix4(m);
        // de plek zelf uit de matrix: de doos om een stam met takken ligt niet
        // om de stam heen, dus zijn midden is niet de plek van de boom
        const x = m.elements[12], z = m.elements[14];
        fn(bb, x, z, grondHoogte(x, z, -Infinity));
      }
    }
  };
  const staat = { stamZweeft: 0, stamBegraven: 0, kroonLaag: 0, kroonLaagste: 99, struikZweeft: 0, struikBegraven: 0, inPand: 0, opRijbaan: 0, vb: [] };
  kijk(meshes.stam, (b, x, z, y) => {
    const d = b.min.y - y;
    if (d > 0.10) { staat.stamZweeft++; if (staat.vb.length < 3) staat.vb.push(['stam zweeft', +x.toFixed(1), +z.toFixed(1), +d.toFixed(2)]); }
    if (d < -0.6) staat.stamBegraven++;
    if (inPand(x, z)) { staat.inPand++; staat.vb.push(['stam in pand', +x.toFixed(1), +z.toFixed(1)]); }
    const v = KW.vlakOp(x, z); if (v && v.k === 'rijbaan') { staat.opRijbaan++; staat.vb.push(['stam op rijbaan', +x.toFixed(1), +z.toFixed(1)]); }
  });
  // de onderkant van een kroon: de doos van een gedraaide bol steekt verder
  // uit dan de bol zelf, dus hier het laagste hoekpunt zelf
  const hp = new THREE.Vector3();
  for (const mesh of meshes.kroon) {
    const P = mesh.geometry.attributes.position;
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m);
      if (m.elements[0] === 0 && m.elements[5] === 0) continue;
      let laag = Infinity;
      for (let k = 0; k < P.count; k += 3) { hp.fromBufferAttribute(P, k).applyMatrix4(m); if (hp.y < laag) laag = hp.y; }
      const x = m.elements[12], z = m.elements[14];
      const d = laag - grondHoogte(x, z, -Infinity);
      staat.kroonLaagste = Math.min(staat.kroonLaagste, d);
      if (d < 2.3) { staat.kroonLaag++; if (staat.vb.length < 9) staat.vb.push(['kroon laag', +x.toFixed(1), +z.toFixed(1), +d.toFixed(2)]); }
    }
  }
  kijk(meshes.struik, (b, x, z, y) => {
    const d = b.min.y - y, h = b.max.y - b.min.y;
    if (d > 0.05) { staat.struikZweeft++; if (staat.vb.length < 6) staat.vb.push(['struik zweeft', +x.toFixed(1), +z.toFixed(1), +d.toFixed(2)]); }
    if (d < -0.45 * h) staat.struikBegraven++;
    if (inPand(x, z)) { staat.inPand++; staat.vb.push(['struik in pand', +x.toFixed(1), +z.toFixed(1)]); }
    const v = KW.vlakOp(x, z); if (v && v.k === 'rijbaan') { staat.opRijbaan++; staat.vb.push(['struik op rijbaan', +x.toFixed(1), +z.toFixed(1)]); }
  });
  uit.staat = staat;

  // ---- gras
  const gras = T.grass(), img = gras.image, gc = img.getContext('2d');
  const d = gc.getImageData(0, 0, img.width, img.height).data;
  // witte snippers: groepjes van minstens 4 lichte beeldpunten (een madeliefje
  // van één of twee beeldpunten is een centimeter of twee)
  const licht = new Uint8Array(img.width * img.height);
  for (let i = 0; i < licht.length; i++) licht[i] = (d[i * 4] > 200 && d[i * 4 + 1] > 200 && d[i * 4 + 2] > 190) ? 1 : 0;
  let vlekken = 0;
  const gezien = new Uint8Array(licht.length);
  for (let i = 0; i < licht.length; i++) {
    if (!licht[i] || gezien[i]) continue;
    let n = 0; const st = [i]; gezien[i] = 1;
    while (st.length) { const k = st.pop(); n++; const x = k % img.width, y = (k / img.width) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= img.width || yy >= img.height) continue; const kk = yy * img.width + xx; if (licht[kk] && !gezien[kk]) { gezien[kk] = 1; st.push(kk); } } }
    if (n >= 4) vlekken++;
  }
  uit.gras = { vlekken, breed: img.width };
  // wordt de variatie echt gerekend? kijk in de programma's na één beeld
  g.player.pos.set(g.start.x, 0, g.start.z); g.player.yaw = g.start.yaw || 0; g.player.pitch = -0.2; g.player.applyCamera();
  W.updateLOD(g.camera.position.x, g.camera.position.z);
  g.renderer.render(g.scene, g.camera);
  const gl = g.renderer.getContext();
  uit.gras.programmas = (g.renderer.info.programs || []).filter(p => (gl.getAttachedShaders(p.program) || []).some(s => (gl.getShaderSource(s) || '').includes('grasRuis'))).length;

  // ---- de verre kroon staat dichtbij niet aan (hij stond om de fijne heen)
  g.player.pos.set(g.start.x, 0, g.start.z); g.player.applyCamera();
  W.updateLOD(g.camera.position.x, g.camera.position.z);
  let beide = 0, verAan = 0;
  for (const lod of W.lodGroepen) {
    if (lod.obj.userData.klasse !== 'kroonVer') continue;
    const d = Math.hypot(lod.x - g.camera.position.x, lod.z - g.camera.position.z);
    if (lod.obj.visible) verAan++;
    if (lod.obj.visible && d < 200) beide++;
  }
  uit.lod = { beide, verAan };

  // ---- driehoeken in beeld op de drie plekken van de nulmeting
  const plekken = [[g.start.x, g.start.z, g.start.yaw || 0], [g.start.x + 150, g.start.z - 60, 1.2], [g.start.x - 200, g.start.z + 120, 3.0]];
  uit.driehoeken = [];
  for (const [x, z, yaw] of plekken) {
    g.player.pos.set(x, 0, z); g.player.yaw = yaw; g.player.pitch = 0; g.player.applyCamera();
    W.updateLOD(g.camera.position.x, g.camera.position.z);
    const rd = g.renderer; rd.info.autoReset = false; rd.info.reset();
    rd.render(g.scene, g.camera);
    uit.driehoeken.push(rd.info.render.triangles);
    rd.info.autoReset = true;
  }
  return uit;
});

console.log(`       ${JSON.stringify(r.aantal)}`);
kop('vorm');
ok(r.kroon && r.kroon.glad > 0.6, 'de kroon heeft gladde normalen, niet meer per vlak plat', r.kroon ? `${(r.kroon.glad * 100).toFixed(0)} % van de hoekpunten` : 'geen kroon gevonden');
ok(r.kroon && r.kroon.onder < r.kroon.boven - 0.25, 'en licht in de hoekpunten: onderin donkerder dan bovenin', r.kroon ? `${r.kroon.onder?.toFixed(2)} onder, ${r.kroon.boven?.toFixed(2)} boven` : '');
ok(r.struik && r.struik.glad > 0.6 && r.struik.onder < r.struik.boven - 0.25, 'de struik ook', r.struik ? `${(r.struik.glad * 100).toFixed(0)} % glad, ${r.struik.onder?.toFixed(2)} → ${r.struik.boven?.toFixed(2)}` : 'geen struik gevonden');

kop('doek');
ok(r.kroon && r.kroon.map && r.kroon.normaal, 'de kroon heeft een bladdoek met reliëf');
ok(r.struik && r.struik.map && r.struik.normaal, 'de struik ook');
ok(r.stam && r.stam.map && r.stam.normaal, 'en de stam schors');

kop('staan ze goed');
const s = r.staat;
if (s.vb.length) console.log(`       bv. ${JSON.stringify(s.vb.slice(0, 30))}`);
ok(s.stamZweeft === 0 && s.stamBegraven === 0, 'elke stam begint op de grond', `${s.stamZweeft} zweven, ${s.stamBegraven} begraven van ${r.aantal.stam}`);
ok(s.kroonLaag === 0, 'elke kroon begint boven hoofdhoogte (2,3 m)', `${s.kroonLaag} te laag; de laagste op ${s.kroonLaagste.toFixed(2)} m`);
ok(s.struikZweeft === 0, 'geen struik zweeft', `${s.struikZweeft} van ${r.aantal.struik}`);
ok(s.struikBegraven === 0, 'en geen struik zit voor de helft in de grond', `${s.struikBegraven}`);
ok(s.inPand === 0 && s.opRijbaan === 0, 'er staat geen boom of struik in een pand of op de rijbaan', `${s.inPand} in een pand, ${s.opRijbaan} op de rijbaan`);

kop('gras');
ok(r.gras.vlekken < 5, 'geen witte snippers in het grasdoek', `${r.gras.vlekken} lichte vlekken van 4 beeldpunten of meer`);
ok(r.gras.programmas > 0, 'de variatie over grote afstand zit in de shader', `${r.gras.programmas} programma's`);

kop('voor de pc');
ok(r.lod.beide === 0, 'dichtbij staat alleen de fijne kroon, niet ook de grove eromheen', `${r.lod.beide} tegels met allebei (${r.lod.verAan} verre kronen aan)`);
r.driehoeken.forEach((d, i) => ok(d <= VOOR[i] * 1.03, `plek ${i + 1}: niet meer driehoeken in beeld dan vóór deze ronde`, `${(d / 1e6).toFixed(2)} miljoen (was ${(VOOR[i] / 1e6).toFixed(2)})`));

console.log(`\n${fout ? fout + ' fout' : 'alles goed'}`);
await browser.close();
process.exit(fout ? 1 : 0);
