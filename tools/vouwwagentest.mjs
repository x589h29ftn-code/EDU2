/*
 Proef bij stap 184 (npm run vouwwagentest): de vouwwagen op het gras aan de Wieken. Meet:
   1. de plek: binnen 10 m van de gevraagde (−128,8; 7,0), elk stuk van het model (de wereldmaten van alle meshes) boven gras,
      niet in een pand, op de rijbaan of het pad, ver genoeg van boomstammen en lantaarns;
   2. de hoogte: de wielen en de steunen op het gras, niets eronder;
   3. de botsdozen: van vier kanten loop je er niet in, en ernaast loop je er langs;
   4. geen gras en geen struik onder de wagen (`inBouwvlak`);
   5. geen nieuw shaderprogramma als hij in beeld komt (hij wordt bij het opstarten gemaakt, dus voorvertaald).
 Daarna twee foto's in docs/screenshots/: vouwwagen.png (vanaf de plek van de foto van de gebruiker) en vouwwagen_dichtbij.png.

 Gebruik: npm run server &  node tools/vouwwagentest.mjs [poort]
*/
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => { console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`); if (!goed) fouten++; };

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(900000);
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

const r = await page.evaluate(async () => {
  const g = window.__game, THREE = await import('three');
  const W = await import('/js/world.js'), { KAART, vlakOp } = await import('/js/kaartwereld.js'), B = await import('/js/bouwvlak.js');
  await g.voorbereidSpel();
  const V = g.vouwwagen, P = V.plek, uit = { plek: P };
  uit.afstand = Math.hypot(P.x - P.gevraagd.x, P.z - P.gevraagd.z);
  // 1. elk hoekpunt van de wereldmaten van elke mesh, op de grond geprojecteerd
  V.groep.updateMatrixWorld(true);
  const punten = [];
  V.groep.traverse(o => {
    if (!o.isMesh) return;
    const b = new THREE.Box3().setFromObject(o);
    for (const x of [b.min.x, b.max.x]) for (const z of [b.min.z, b.max.z]) punten.push({ x, z, y: b.min.y });
  });
  const inRing = (x, z, r) => { let i = false; for (let a = 0, b = r.length - 1; a < r.length; b = a++) { const [xa, za] = r[a], [xb, zb] = r[b]; if ((za > z) !== (zb > z) && x < (xb - xa) * (z - za) / (zb - za) + xa) i = !i; } return i; };
  const dLijn = (x, z, pts) => { let m = 1e9; for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)); m = Math.min(m, Math.hypot(x - ax - dx * t, z - az - dz * t)); } return m; };
  const nietGras = new Set(), panden = [], bomen = [], lampen = [];
  let minPad = 99, minBoom = 99, minLamp = 99;
  for (const p of punten) {
    const v = vlakOp(p.x, p.z);
    if (!v || v.m !== 'gras') nietGras.add(v ? `${v.k}/${v.m}` : 'niets');
    for (const q of KAART.panden) if (q.voet && Math.abs(q.voet[0][0] - p.x) < 60 && inRing(p.x, p.z, q.voet)) panden.push(q.id || '?');
    for (const a of KAART.wegassen) if (a.pts && Math.abs(a.pts[0][0] - p.x) < 400) minPad = Math.min(minPad, dLijn(p.x, p.z, a.pts) - a.w / 2);
    for (const q of KAART.bomen || []) minBoom = Math.min(minBoom, Math.hypot(p.x - q.x, p.z - q.z));
    for (const q of KAART.lantaarns || []) minLamp = Math.min(minLamp, Math.hypot(p.x - q.x, p.z - q.z));
  }
  Object.assign(uit, { punten: punten.length, nietGras: [...nietGras], panden: panden.length, minPad, minBoom, minLamp });
  // 2. de hoogte: de laagste kant van het model tegen het gras eronder
  uit.y = P.y; uit.laagst = Math.min(...punten.map(p => p.y));
  uit.gras = Math.max(W.grondHoogte(P.x, P.z, 3), (vlakOp(P.x, P.z) || {}).y || 0);
  // 3. de botsdozen: van vier kanten erop af lopen
  const c = Math.cos(P.yaw), s = Math.sin(P.yaw), wereld = (lx, lz) => ({ x: P.x + lx * c + lz * s, z: P.z - lx * s + lz * c });
  const loop = (van, naar) => {
    let x = van.x, z = van.z; const dx = naar.x - van.x, dz = naar.z - van.z, L = Math.hypot(dx, dz);
    for (let i = 0; i < L / 0.05; i++) { [x, z] = W.resolveCollisions(x + dx / L * 0.05, z + dz / L * 0.05, 0.4, 0, 0.1); }
    return { x, z, rest: Math.hypot(naar.x - x, naar.z - z) };
  };
  uit.lopen = [[4, 0], [-4, 0], [0, 4.5], [0, -4]].map(([lx, lz]) => {
    const van = wereld(lx, lz), r = loop(van, wereld(-0.4, 0));
    return +r.rest.toFixed(2);
  });
  // langs de wagen, 2,4 m naast de lange kant: komt hij er
  const langs = loop(wereld(2.4, -3.5), wereld(2.4, 3.5));
  uit.langs = +langs.rest.toFixed(2);
  // 4. geen gras onder de wagen
  uit.bouwvlak = [[0, 0], [-0.77, 1], [0.77, -1], [-0.77, -2.2], [1.4, 1.1]].every(([lx, lz]) => { const p = wereld(lx, lz); return B.inBouwvlak(p.x, p.z); });
  // 5. in beeld: geen nieuw shaderprogramma
  const R = g.renderer, C = g.camera;
  document.getElementById('overlay').style.display = 'none';
  g.sfeer.uur = 14; g.sfeer.weer = 'helder';
  const zet = (x, y, z, nx, ny, nz) => { C.position.set(x, y, z); C.lookAt(nx, ny, nz); for (let i = 0; i < 3; i++) g.sfeer.update(0.1, x, z); W.updateLOD(x, z); g.scene.updateMatrixWorld(true); R.shadowMap.needsUpdate = true; C.updateMatrixWorld(true); };
  // eerst hetzelfde beeld zonder de wagen (wat er dan nieuw is, hoort bij de rest van de wereld), dan met
  const d = wereld(4.2, 3.2);
  V.groep.visible = false;
  zet(P.gevraagd.x, 1.7, P.gevraagd.z, P.x, 1.0, P.z); R.render(g.scene, C);
  zet(d.x, 1.6, d.z, P.x, 1.0, P.z); R.render(g.scene, C);
  V.groep.visible = true;
  const p0 = R.info.programs.length;
  zet(P.gevraagd.x, 1.7, P.gevraagd.z, P.x, 1.0, P.z); R.render(g.scene, C); R.render(g.scene, C);
  uit.programmas = R.info.programs.length - p0;
  uit.foto1 = R.domElement.toDataURL('image/png');
  zet(d.x, 1.6, d.z, P.x, 1.0, P.z); R.render(g.scene, C); R.render(g.scene, C);
  uit.foto2 = R.domElement.toDataURL('image/png');
  uit.programmas2 = R.info.programs.length - p0;
  return uit;
});
writeFileSync('docs/screenshots/vouwwagen.png', Buffer.from(r.foto1.split(',')[1], 'base64'));
writeFileSync('docs/screenshots/vouwwagen_dichtbij.png', Buffer.from(r.foto2.split(',')[1], 'base64'));

console.log('\n--- 1. de plek ---');
ok(r.afstand < 10, 'dicht bij de gevraagde plek', `(${r.plek.x}, ${r.plek.z}), ${r.afstand.toFixed(1)} m van (${r.plek.gevraagd.x}, ${r.plek.gevraagd.z})`);
ok(r.nietGras.length === 0, 'elk stuk van het model staat boven gras', r.nietGras.join(', ') || `${r.punten} hoekpunten`);
ok(r.panden === 0, 'niet in een pand');
ok(r.minPad > 0.3, 'niet op een rijbaan of pad', `${r.minPad.toFixed(2)} m tot de rand van de dichtstbijzijnde as`);
ok(r.minBoom > 2.0 && r.minLamp > 0.8, 'ver genoeg van boomstammen en lantaarns', `boom ${r.minBoom.toFixed(1)} m, lantaarn ${r.minLamp.toFixed(1)} m`);
console.log('\n--- 2. de hoogte ---');
ok(Math.abs(r.y - r.gras) < 0.02, 'op de hoogte van het gras', `${r.y.toFixed(2)} m (gras ${r.gras.toFixed(2)})`);
ok(r.laagst >= r.y - 0.02 && r.laagst < r.y + 0.04, 'wielen en steunen op de grond, niets eronder', `laagste punt ${r.laagst.toFixed(3)} m`);
console.log('\n--- 3. de botsdozen ---');
ok(r.lopen.every(d => d > 0.6), 'van vier kanten loop je er niet in', r.lopen.join(' / ') + ' m voor het hart');
ok(r.langs < 0.1, 'ernaast loop je er gewoon langs', `${r.langs} m tekort`);
console.log('\n--- 4. het gras ---');
ok(r.bouwvlak, 'onder de wagen groeit niets (inBouwvlak)');
console.log('\n--- 5. de shaders ---');
ok(r.programmas === 0 && r.programmas2 === 0, 'geen nieuw shaderprogramma als hij in beeld komt', `${r.programmas} / ${r.programmas2}`);

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);
