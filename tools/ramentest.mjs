/*
 Stap 116: de ramen die 's avonds licht geven, van dichtbij (js/licht.js, `nachtRamen`).

   node tools/server.mjs 8123 &   node tools/ramentest.mjs [poort] [map]   (npm run ramentest)

 Melding met foto (3 okt 2026): een brandend raam van dichtbij is een rafelige vlek met trapjes.
 Het masker keek per texel naar de kleur van het doek, met harde drempels. Nu komt het uit een
 vervaagde mip en lopen de drempels zacht af (`RAAM_ZACHT`). Gemeten op dezelfde gevel, om elf uur,
 met elk raam aan en open, op twee afstanden, oud (`raamZachtUniform` 0) tegen nieuw (1):

 1. Er brandt nog evenveel licht (niet weggevaagd, niet over de muur uitgelopen).
 2. Minder harde sprongen in het licht tussen twee buurpixels.
 3. Een kortere rand per oppervlak licht: minder rafels en gaatjes.
 Ook: de muur zonder raam blijft donker, en overdag verandert er niets.
 Maakt ramen_oud.png en ramen_nieuw.png (dezelfde gevel van dichtbij).
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const poort = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
mkdirSync(map, { recursive: true });
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
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

// de gevel zoeken en de camera ervoor zetten
const opzet = await page.evaluate(async () => {
  const THREE = await import('three');
  const W = await import('/js/world.js');
  const L = await import('/js/licht.js');
  window.__L = L;
  const g = window.__game, s = g.start;
  document.getElementById('overlay').style.display = 'none';
  g.player.active = false; window.__autoplay = false;
  g.player.wapenUit = true; if (g.player.gun) g.player.gun.visible = false;
  await g.reliëfAf();
  const gl = g.renderer.getContext();
  window.__zet = (x, z, yaw, pitch, uur) => {
    g.sfeer.uur = uur; g.sfeer.weer = 'helder';
    for (let i = 0; i < 3; i++) g.sfeer.update(0.1, x, z);
    g.player.pos.set(x, 0, z); g.player.yaw = yaw; g.player.pitch = pitch; g.player.applyCamera();
    W.updateLOD(g.camera.position.x, g.camera.position.z);
    if (g.grasVeld) g.grasVeld.update(g.camera.position.x, g.camera.position.z, true);
  };
  window.__beeld = () => {
    g.renderer.setRenderTarget(null); g.renderer.render(g.scene, g.camera);
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, b = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, b);
    return { w, h, b };
  };
  /*
   Een gevel met ramen: een grote, rechtopstaande driehoek van een voorgevel binnen 150 m van het
   begin, met een vrije plek 7 en 14 m ervoor (geen botsdoos, geen water) en vrij zicht erop.
  */
  g.player.applyCamera = () => {};
  window.__cam = (x, y, z, kx, ky, kz, uur) => {
    g.sfeer.uur = uur; g.sfeer.weer = 'helder';
    for (let i = 0; i < 3; i++) g.sfeer.update(0.1, x, z);
    g.camera.position.set(x, y, z); g.camera.lookAt(kx, ky, kz); g.camera.updateMatrixWorld(true);
    W.updateLOD(x, z);
    if (g.grasVeld) g.grasVeld.update(x, z, true);
    g.scene.updateMatrixWorld(true);
  };
  window.__zet(s.x, s.z, s.yaw || 0, 0, 23);
  g.scene.updateMatrixWorld(true);
  const gevels = [];
  g.scene.traverse(o => { if (o.isMesh && o.material && o.material.userData && o.material.userData.nachtRamen && o.userData.klasse === 'voorgevel') gevels.push(o); });
  const rc = new THREE.Raycaster();
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), N = new THREE.Vector3(), M = new THREE.Vector3();
  const kandidaten = [];
  for (const o of gevels) {
    const P = o.geometry.attributes.position, I = o.geometry.index;
    const n3 = I ? I.count / 3 : P.count / 3;
    for (let t = 0; t < n3; t += Math.max(1, Math.floor(n3 / 40))) {
      const ia = I ? I.getX(t * 3) : t * 3, ib = I ? I.getX(t * 3 + 1) : t * 3 + 1, ic = I ? I.getX(t * 3 + 2) : t * 3 + 2;
      A.fromBufferAttribute(P, ia).applyMatrix4(o.matrixWorld); B.fromBufferAttribute(P, ib).applyMatrix4(o.matrixWorld); C.fromBufferAttribute(P, ic).applyMatrix4(o.matrixWorld);
      N.subVectors(B, A).cross(M.subVectors(C, A));
      const opp = N.length() / 2;
      if (opp < 6) continue;
      N.normalize();
      if (Math.abs(N.y) > 0.05) continue;
      const mid = new THREE.Vector3().add(A).add(B).add(C).divideScalar(3);
      if (Math.hypot(mid.x - s.x, mid.z - s.z) > 150 || mid.y < 2.5) continue;
      kandidaten.push({ o, mid, n: N.clone(), d: Math.hypot(mid.x - s.x, mid.z - s.z) });
    }
  }
  kandidaten.sort((a, b) => a.d - b.d);
  let beste = null;
  for (const k of kandidaten) {
    // de normaal moet van het huis af wijzen: de plek ervoor ligt buiten het pand
    let vrij = true;
    for (const d of [7, 14]) {
      const x = k.mid.x + k.n.x * d, z = k.mid.z + k.n.z * d;
      const [px, pz] = W.resolveCollisions(x, z, 0.4);
      if (Math.hypot(px - x, pz - z) > 0.05 || (W.pointInWater && W.pointInWater(x, z))) { vrij = false; break; }
      const van = new THREE.Vector3(x, 1.7, z), naar = new THREE.Vector3().subVectors(k.mid, van);
      const afst = naar.length(); naar.normalize();
      rc.set(van, naar); rc.far = afst + 0.5;
      const h = rc.intersectObjects(g.scene.children, true).find(q => q.object.visible && q.object.material && !q.object.material.transparent);
      if (!h || h.object !== k.o || Math.abs(h.distance - afst) > 0.6) { vrij = false; break; }
    }
    if (vrij) { beste = k; break; }
  }
  if (!beste) return { geen: true, gevels: gevels.length, kandidaten: kandidaten.length };
  window.__gevel = { x: beste.mid.x, y: beste.mid.y, z: beste.mid.z, nx: beste.n.x, nz: beste.n.z };
  return { gevels: gevels.length, kandidaten: kandidaten.length, gevel: window.__gevel, afstand: beste.d };
});
kop('de gevel');
ok(!opzet.geen, 'een gevel met ramen voor de camera', JSON.stringify(opzet));
if (opzet.geen) { await browser.close(); process.exit(1); }

// meet oud en nieuw op afstand `d` voor de gevel, op 4 m hoogte kijkend naar de eerste verdieping
const meet = async (d) => page.evaluate((d) => {
  const g = window.__game, L = window.__L, G = window.__gevel;
  window.__cam(G.x + G.nx * d, 1.7, G.z + G.nz * d, G.x, Math.max(3, G.y), G.z, 23);
  L.aandeelUniform.value = 1; L.raamSoortUniform.value = 0.2;
  const nacht = L.nachtUniform.value;
  L.nachtUniform.value = 0; const donker = window.__beeld();
  L.nachtUniform.value = nacht;
  L.raamZachtUniform.value = 0; const oud = window.__beeld();
  L.raamZachtUniform.value = 1; const nieuw = window.__beeld();
  const { w, h } = donker;
  const lum = (b, i) => 0.3 * b[i] + 0.55 * b[i + 1] + 0.15 * b[i + 2];
  const maat = (img) => {
    // het licht van de ramen: dit beeld min het beeld met de ramen uit
    const L2 = new Float32Array(w * h);
    for (let p = 0; p < w * h; p++) L2[p] = Math.max(0, lum(img.b, p * 4) - lum(donker.b, p * 4));
    let licht = 0, aan = 0, rand = 0, paren = 0, sprong = 0, energie = 0;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const p = y * w + x, v = L2[p];
      licht += v;
      const isAan = v > 8;
      if (isAan) { aan++; if (L2[p - 1] <= 8 || L2[p + 1] <= 8 || L2[p - w] <= 8 || L2[p + w] <= 8) rand++; }
      for (const q of [p + 1, p + w]) {
        const dv = Math.abs(v - L2[q]);
        if (v > 8 || L2[q] > 8) { paren++; energie += dv; if (dv > 35) sprong++; }
      }
    }
    return { licht: licht / (w * h), aan: aan / (w * h), rand: aan ? rand / aan : 0, sprong: paren ? sprong / paren : 0, energie: licht ? energie / licht : 0 };
  };
  return { oud: maat(oud), nieuw: maat(nieuw) };
}, d);

for (const d of [7, 14]) {
  kop(`op ${d} m van de gevel`);
  const m = await meet(d);
  const f = (o) => `licht ${o.licht.toFixed(2)}, ${(o.aan * 100).toFixed(1)} % aan, rand ${(o.rand * 100).toFixed(1)} %, sprongen ${(o.sprong * 100).toFixed(2)} %, energie ${o.energie.toFixed(2)}`;
  console.log(`       oud:   ${f(m.oud)}\n       nieuw: ${f(m.nieuw)}`);
  ok(m.oud.aan > 0.01, 'er branden ramen in beeld', `${(m.oud.aan * 100).toFixed(1)} % van het beeld`);
  ok(m.nieuw.licht > m.oud.licht * 0.7 && m.nieuw.licht < m.oud.licht * 1.4, 'evenveel licht als eerst: niet weggevaagd, niet over de muur', `${(m.nieuw.licht / m.oud.licht * 100).toFixed(0)} % van het oude`);
  ok(m.nieuw.sprong < m.oud.sprong * 0.6, 'minder harde sprongen tussen buurpixels', `${(m.nieuw.sprong * 100).toFixed(2)} % tegen ${(m.oud.sprong * 100).toFixed(2)} %`);
  ok(m.nieuw.rand < m.oud.rand * 0.85, 'een kortere rand per oppervlak licht: minder rafels en gaatjes', `${(m.nieuw.rand * 100).toFixed(1)} % tegen ${(m.oud.rand * 100).toFixed(1)} %`);
}

// overdag: niets anders
kop('overdag');
const dag = await page.evaluate(() => {
  const g = window.__game, L = window.__L, G = window.__gevel;
  window.__cam(G.x + G.nx * 10, 1.7, G.z + G.nz * 10, G.x, Math.max(3, G.y), G.z, 13);
  L.raamZachtUniform.value = 0; const a = window.__beeld();
  L.raamZachtUniform.value = 1; const b = window.__beeld();
  let n = 0; for (let i = 0; i < a.b.length; i += 4) if (Math.abs(a.b[i] - b.b[i]) + Math.abs(a.b[i + 1] - b.b[i + 1]) + Math.abs(a.b[i + 2] - b.b[i + 2]) > 6) n++;
  return { nacht: L.nachtUniform.value, anders: n / (a.b.length / 4) };
});
ok(dag.nacht === 0 && dag.anders < 0.001, 'overdag verandert er niets', `${(dag.anders * 100).toFixed(3)} % anders`);

// de foto's: van dichtbij, schuin, zoals op de foto van de melding
for (const [naam, zacht] of [['ramen_oud', 0], ['ramen_nieuw', 1]]) {
  await page.evaluate((zacht) => {
    const g = window.__game, L = window.__L, G = window.__gevel;
    window.__cam(G.x + G.nx * 6 + G.nz * 2.5, 1.7, G.z + G.nz * 6 - G.nx * 2.5, G.x, Math.max(3.5, G.y + 0.5), G.z, 23);
    L.aandeelUniform.value = 0.6; L.raamSoortUniform.value = -1; L.raamZachtUniform.value = zacht;
    g.hud.msgT = 0; g.hud.msg.style.opacity = 0;
    if (g.renderer.shadowMap) g.renderer.shadowMap.needsUpdate = true;
  }, zacht);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 600000 });
  console.log(`${map}/${naam}.png`);
}
await page.evaluate(() => { const L = window.__L; L.raamZachtUniform.value = 1; L.raamSoortUniform.value = -1; });

console.log(fout ? `\n${fout} fout(en)` : '\nalles goed');
await browser.close();
process.exit(fout ? 1 : 0);
