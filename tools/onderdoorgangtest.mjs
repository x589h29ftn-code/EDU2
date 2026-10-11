/*
 Stap 138: de onderdoorgang van de N7 bij (719, −156) en de muurtjes bij (960, −195).

 De naam `viaducttest` was al van het viaduct Tinga (stap 15); dit is de bak onder
 de rotonde aan de Lemmerweg (`verdiept`, stap 46), dus `onderdoorgangtest`.

   1. stralen recht naar beneden op een raster rond (719, −156): geen gras of
      ander vlak boven de rijbaan, de rijbaan op de hoogte die grondHoogte zegt;
   2. elke driehoek van de ondergrond in de bak: ligt hij ook tússen zijn
      hoekpunten op de grond (geen vlak dat scheef over de bak gespannen is);
   3. de lantaarns: op de grond en niet op het talud;
   4. rijden en lopen door de bak;
   5. de muren uit de BGT: hoeveel meter ligt er over de hele kaart op een
      rijbaan of een stoep, en rond (960, −195) niets.

 Gebruik: node tools/server.mjs 8123 &  node tools/onderdoorgangtest.mjs 8123
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fouten++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = false; window.__autoplay = false;
  window.__W = await import('/js/world.js');
  window.__KW = await import('/js/kaartwereld.js');
  window.__S = await import('/js/scheiding.js');
  window.__K = window.__KW.KAART;
  window.__W.updateLOD(740, -156);
  g.scene.updateMatrixWorld(true);
});

// de vlakken uit de kaart: dit zijn de klassen van de ondergrond
const GROND = ['parkeervlak', 'voetpad', 'rijbaan', 'inrit', 'fietspad', 'autoweg', 'verharding', 'spoorbaan', 'woonerf', 'berm', 'gras',
  'heesters', 'bos', 'bodembedekker', 'asfaltvlak', 'halfverhard', 'erf', 'zand', 'kunstgras', 'oever', 'brug', 'bouwwerk'];
const VERKEER = ['rijbaan', 'autoweg', 'voetpad', 'fietspad', 'inrit', 'parkeervlak', 'woonerf'];

// ------------------------------------------------------------------ 1. stralen naar beneden
kop('stralen recht naar beneden rond (719, −156)');

const meting = await page.evaluate(async ({ GROND, VERKEER }) => {
  const THREE = await import('three');
  const g = window.__game, W = window.__W, KW = window.__KW;
  const box = { x0: 690, x1: 830, z0: -190, z1: -115 };
  const kandidaten = [];
  g.scene.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || !o.geometry || !o.geometry.attributes.position) return;
    let zicht = true; for (let p = o; p; p = p.parent) if (!p.visible) zicht = false;
    if (!zicht) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    const bs = o.geometry.boundingSphere, c = bs.center.clone().applyMatrix4(o.matrixWorld);
    if (c.x + bs.radius < box.x0 || c.x - bs.radius > box.x1 || c.z + bs.radius < box.z0 || c.z - bs.radius > box.z1) return;
    kandidaten.push(o);
  });
  const ray = new THREE.Raycaster();
  const omlaag = new THREE.Vector3(0, -1, 0);
  const isGroen = (m) => ['berm', 'gras', 'heesters', 'bos', 'bodembedekker'].includes(m.object.userData.klasse) || /dijk/.test(m.object.userData.klasse || '')
    || (m.object.material && /gras|dijk|groen/i.test(m.object.material.name || ''));
  let punten = 0, groenBoven = 0, verkeerdHoog = 0, gat = 0, maxAf = 0;
  const voorbeelden = [];
  for (let x = box.x0; x <= box.x1; x += 1) for (let z = box.z0; z <= box.z1; z += 1) {
    const v = KW.vlakOp(x, z);
    if (!v || !(v.k === 'autoweg' || v.k === 'rijbaan')) continue;
    const gh = W.grondHoogte(x, z, -Infinity);
    if (gh > -1) continue;                         // alleen in de bak
    if (W.onderBrug(x, z, 0.5)) continue;         // onder een dek ligt het dek bovenop
    punten++;
    ray.set(new THREE.Vector3(x, 40, z), omlaag);
    ray.far = 80;
    const raak = ray.intersectObjects(kandidaten, false).filter(h => h.object.userData.klasse !== 'lamp' && !/lamp|paal|kroon|stam|blad|riet|graspol/i.test(h.object.userData.klasse || ''));
    if (!raak.length) { gat++; continue; }
    const top = raak[0];
    const verwacht = gh + (v.y || 0);
    const af = top.point.y - verwacht;
    if (isGroen(top) && af > 0.25) { groenBoven++; if (voorbeelden.length < 6) voorbeelden.push(`${x},${z}: ${top.object.userData.klasse} op ${top.point.y.toFixed(2)} boven ${verwacht.toFixed(2)}`); }
    else if (Math.abs(af) > 0.25) { verkeerdHoog++; if (voorbeelden.length < 6) voorbeelden.push(`${x},${z}: ${top.object.userData.klasse} op ${top.point.y.toFixed(2)}, weg ${verwacht.toFixed(2)}`); }
    maxAf = Math.max(maxAf, Math.abs(af));
  }

  // 2. elke driehoek van de ondergrond: ligt hij ook tussen zijn hoekpunten op de grond?
  const v3 = new THREE.Vector3();
  let driehoeken = 0, scheef = 0, ergste = 0, scheefOpp = 0;
  const scheefVb = [];
  for (const o of kandidaten) {
    const kl = o.userData.klasse;
    if (!GROND.includes(kl)) continue;
    const p = o.geometry.attributes.position, idx = o.geometry.index;
    const n = idx ? idx.count : p.count;
    const hp = (i) => { v3.fromBufferAttribute(p, idx ? idx.getX(i) : i).applyMatrix4(o.matrixWorld); return [v3.x, v3.y, v3.z]; };
    for (let t = 0; t < n; t += 3) {
      const A = hp(t), B = hp(t + 1), C = hp(t + 2);
      const cx = (A[0] + B[0] + C[0]) / 3, cz = (A[2] + B[2] + C[2]) / 3;
      if (cx < box.x0 || cx > box.x1 || cz < box.z0 || cz > box.z1) continue;
      // hoe hoog ligt elk hoekpunt boven de grond (dat is de y van het vlak zelf)
      const off = [A, B, C].map(q => q[1] - W.grondHoogte(q[0], q[2], -Infinity));
      const o0 = (off[0] + off[1] + off[2]) / 3;
      if (Math.max(...off) - Math.min(...off) > 0.2) continue;   // geen vlak op de grond (een wand, een rand)
      driehoeken++;
      let af = 0;
      for (const [u, w] of [[1 / 3, 1 / 3], [0.5, 0], [0, 0.5], [0.5, 0.5], [0.25, 0.25], [0.6, 0.2], [0.2, 0.6]]) {
        const x = A[0] + (B[0] - A[0]) * u + (C[0] - A[0]) * w, y = A[1] + (B[1] - A[1]) * u + (C[1] - A[1]) * w, z = A[2] + (B[2] - A[2]) * u + (C[2] - A[2]) * w;
        af = Math.max(af, Math.abs(y - (W.grondHoogte(x, z, -Infinity) + o0)));
      }
      if (af > 0.3) {
        scheef++;
        scheefOpp += Math.abs((B[0] - A[0]) * (C[2] - A[2]) - (B[2] - A[2]) * (C[0] - A[0])) / 2;
        if (scheefVb.length < 5) scheefVb.push(`${kl} bij ${cx.toFixed(0)},${cz.toFixed(0)}: ${af.toFixed(2)} m naast de grond`);
      }
      ergste = Math.max(ergste, af);
    }
  }
  return { punten, groenBoven, verkeerdHoog, gat, maxAf, voorbeelden, driehoeken, scheef, ergste, scheefOpp, scheefVb, meshes: kandidaten.length };
}, { GROND, VERKEER });
console.log(`  ${meting.meshes} meshes; ${meting.punten} punten op de rijbaan in de bak`);
for (const v of meting.voorbeelden) console.log('    ' + v);
ok(meting.punten > 400, 'het raster raakt de rijbaan in de bak', `${meting.punten} punten`);
ok(meting.groenBoven === 0, 'geen gras of berm boven de rijbaan', `${meting.groenBoven} punten`);
ok(meting.verkeerdHoog === 0, 'de rijbaan ligt overal op de hoogte van grondHoogte (25 cm)', `${meting.verkeerdHoog} punten, grootste afwijking ${meting.maxAf.toFixed(2)} m`);
ok(meting.gat === 0, 'nergens een gat in de rijbaan', `${meting.gat} punten`);

kop('de driehoeken van de ondergrond in de bak');
for (const v of meting.scheefVb) console.log('    ' + v);
ok(meting.driehoeken > 1000, 'er liggen driehoeken van de ondergrond in de bak', `${meting.driehoeken}`);
ok(meting.scheef === 0, 'geen driehoek die scheef over de bak hangt (30 cm tussen zijn hoekpunten)',
  `${meting.scheef} driehoeken, ${meting.scheefOpp.toFixed(0)} m², ergste ${meting.ergste.toFixed(2)} m`);

// ------------------------------------------------------------------ 3. de lantaarns
kop('de lantaarns');
const lamp = await page.evaluate(() => {
  const W = window.__W, K = window.__K;
  const uit = [];
  for (const l of K.lantaarns) {
    if (l.x < 690 || l.x > 830 || l.z < -190 || l.z > -115) continue;
    const h = W.grondHoogte(l.x, l.z, -Infinity);
    // helling: het hoogteverschil over een meter in vier richtingen
    let helling = 0;
    for (const [dx, dz] of [[0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]]) helling = Math.max(helling, Math.abs(W.grondHoogte(l.x + dx, l.z + dz, -Infinity) - h) / 0.6);
    uit.push({ x: l.x, z: l.z, h, helling });
  }
  // en de echte palen: de matrix van de instantie
  const g = window.__game;
  let palen = [];
  g.scene.traverse(o => {
    if (!o.isInstancedMesh || !/lamp|paal|lantaarn/i.test(o.userData.klasse || o.name || '')) return;
    const m = new o.matrixWorld.constructor();
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m);
      const x = m.elements[12], y = m.elements[13], z = m.elements[14];
      if (x < 690 || x > 830 || z < -190 || z > -115) continue;
      palen.push({ x, y, z, k: o.userData.klasse || o.name });
    }
  });
  return { uit, palen: palen.slice(0, 80) };
});
let opTalud = 0;
for (const l of lamp.uit) {
  if (l.helling > 0.5) opTalud++;
  console.log(`    lantaarn ${l.x.toFixed(1)}, ${l.z.toFixed(1)}: grond ${l.h.toFixed(2)} m, helling ${(l.helling * 100).toFixed(0)} %`);
}
ok(lamp.uit.length >= 4, 'er staan lantaarns bij de bak', `${lamp.uit.length}`);
ok(opTalud === 0, 'geen lantaarn op het talud (helling > 50 %)', `${opTalud}`);
// palen die zweven of in de grond zakken
const W_ = lamp.palen.filter(p => /paal|lamp|lantaarn/i.test(p.k));
let zweeft = 0;
for (const p of W_) {
  const h = await page.evaluate(({ x, z }) => window.__W.grondHoogte(x, z, -Infinity), p);
  if (p.k && /kop|licht/i.test(p.k)) continue;
  if (Math.abs(p.y - h) > 0.6 && p.y < h + 3) zweeft++;
}
console.log(`    ${W_.length} instanties van palen in de buurt`);
ok(zweeft === 0, 'elke paal staat op de grond', `${zweeft}`);

// de grassprietjes in 3D (js/groen.js maakGrasVeld): op de grond, niet op maaiveldhoogte boven de bak
const gras = await page.evaluate(() => {
  const g = window.__game, W = window.__W;
  if (!g.grasVeld) return null;
  g.grasVeld.update(719.3, -156.2, true);
  const m = g.grasVeld.mesh, M = new m.matrixWorld.constructor();
  let n = 0, zweeft = 0, ergste = 0;
  for (let i = 0; i < m.count; i++) {
    m.getMatrixAt(i, M);
    const x = M.elements[12], y = M.elements[13], z = M.elements[14];
    const v = window.__KW.vlakOp(x, z);
    const verwacht = (v ? v.y : 0) + W.grondHoogte(x, z, -Infinity);
    n++; const af = Math.abs(y - verwacht); ergste = Math.max(ergste, af);
    if (af > 0.2) zweeft++;
  }
  return { n, zweeft, ergste };
});
if (gras) ok(gras.n > 100 && gras.zweeft === 0, 'de grassprietjes rond (719, −156) staan op de grond', `${gras.zweeft} van ${gras.n} zweven, ergste ${gras.ergste.toFixed(2)} m`);

// ------------------------------------------------------------------ 4. rijden en lopen
kop('rijden en lopen door de bak');
const rit = await page.evaluate(() => {
  const g = window.__game, W = window.__W, K = window.__K;
  const V = K.viaducten.find(v => v.verdiept && v.hoogte < -5);
  // het verkeer en de geparkeerde auto's uit de bak
  for (const c of g.vehicles.cars) if (c.x > 680 && c.x < 840 && c.z > -200 && c.z < -100 && !c.mesh) { c.x += 2000; if (g.vehicles.zetInstantie) g.vehicles.zetInstantie(c); }
  for (const t of g.vehicles.traffic) if (t.mesh) { t.mesh.visible = false; t.mesh.position.x += 2000; }
  const start = V.as.find(s => s[0] > 690);
  const auto = g.vehicles.voegToe({ x: start[0], z: start[1] + 4, yaw: -Math.PI / 2, soort: 'hatch', kleur: 0x2266aa });
  auto.speed = 0;
  auto.mesh.position.y = W.grondHoogte(auto.x, auto.z, -Infinity);
  g.vehicles.zetNeer(auto, 0.016, auto.yaw);
  let maxAf = 0, minX = auto.x, maxX = auto.x;
  const volg = () => {
    let bi = 0, bd = 1e9;
    V.as.forEach((s2, i) => { const d = Math.hypot(s2[0] - auto.x, s2[1] + 4 - auto.z); if (d < bd) { bd = d; bi = i; } });
    const t = V.as[Math.min(V.as.length - 1, bi + 10)];
    let e = Math.atan2(-(t[0] - auto.x), -(t[1] + 4 - auto.z)) - auto.yaw;
    while (e > Math.PI) e -= Math.PI * 2;
    while (e < -Math.PI) e += Math.PI * 2;
    return { KeyW: auto.speed < 14, KeyA: e > 0.012, KeyD: e < -0.012 };
  };
  for (let i = 0; i < 900 && auto.x < 830; i++) {
    g.vehicles.drive(auto, volg(), 1 / 60, null);
    const y = auto.mesh.position.y, gh = W.grondHoogte(auto.x, auto.z, y + 0.5);
    if (auto.x > 700 && auto.x < 820) maxAf = Math.max(maxAf, Math.abs(y - gh));
    maxX = Math.max(maxX, auto.x);
  }
  // te voet: de hoogte volgen van punt naar punt zoals de speler dat doet (met zijn eigen y)
  let y = W.grondHoogte(700, -156, -Infinity), sprong = 0, opDek = 0;
  for (let x = 700; x <= 820; x += 0.5) {
    const n = W.grondHoogte(x, -156, y + 0.3);
    sprong = Math.max(sprong, Math.abs(n - y)); y = n;
    if (n > -1) opDek++;
  }
  const res = { maxAf, start: start[0], maxX, sprong, opDek };
  g.vehicles.verwijder && g.vehicles.verwijder(auto);
  return res;
});
ok(rit.maxX > 815, 'een auto rijdt de hele bak door', `van ${rit.start.toFixed(0)} tot ${rit.maxX.toFixed(0)}`);
ok(rit.maxAf < 0.35, 'en blijft daarbij op de weg', `grootste afstand tot grondHoogte ${rit.maxAf.toFixed(2)} m`);
ok(rit.sprong < 0.3 && rit.opDek === 0, 'te voet over de rijbaan: geen sprong en niet ineens op een dek', `sprong ${rit.sprong.toFixed(2)} m, ${rit.opDek} keer boven`);

// ------------------------------------------------------------------ 5. de muren uit de BGT
kop('muren op de rijbaan of de stoep');
const muur = await page.evaluate(({ VERKEER }) => {
  const K = window.__K, KW = window.__KW;
  const op = (x, z) => { const v = KW.vlakOp(x, z); return !!v && VERKEER.includes(v.k); };
  const rijbaan = (x, z) => { const v = KW.vlakOp(x, z); return !!v && (v.k === 'autoweg' || v.k === 'rijbaan'); };
  let meter = 0, meterGetoond = 0, bij960 = 0;
  const per = {};
  for (const s of K.scheidingen) {
    if (!['muur', 'kademuur', 'hek', 'damwand'].includes(s.soort)) continue;
    for (let i = 1; i < s.pts.length; i++) {
      const a = s.pts[i - 1], b = s.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 0.1) continue;
      const nx = -(b[1] - a[1]) / L * 0.6, nz = (b[0] - a[0]) / L * 0.6;
      // zo laat js/scheiding.js een stuk weg (stap 130): dan staat het niet in beeld
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      let opR = 0; for (const f of [0.1, 0.3, 0.5, 0.7, 0.9]) if (rijbaan(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)) opR++;
      const weg = (s.soort === 'muur' || s.soort === 'hek') && ((rijbaan(mx, mz) && rijbaan(mx + nx, mz + nz) && rijbaan(mx - nx, mz - nz)) || opR >= 3);
      for (let t = 0.5; t < L; t += 1) {
        const x = a[0] + (b[0] - a[0]) * t / L, z = a[1] + (b[1] - a[1]) * t / L;
        if (op(x, z) && op(x + nx, z + nz) && op(x - nx, z - nz)) {
          meter++; per[s.soort] = (per[s.soort] || 0) + 1;
          if (!weg) meterGetoond++;
          if (Math.hypot(x - 960, z + 194.9) < 30) bij960++;
        }
      }
    }
  }
  return { meter, meterGetoond, bij960, per, overgeslagen: window.__S.muurOpWeg, telling: K.telling };
}, { VERKEER });
console.log(`    per soort: ${JSON.stringify(muur.per)}; js/scheiding.js liet ${muur.overgeslagen} stukken weg`);
console.log(`    hartlijnen: ${muur.telling.scheiding_vlak_band ?? '-'} als band, ${muur.telling.scheiding_vlak_recht ?? '-'} recht, ${muur.telling.scheiding_vlak_weg ?? '-'} weggelaten`);
ok(muur.bij960 === 0, 'rond (960, −195) geen muurstuk op de rijbaan of de stoep', `${muur.bij960} m`);
ok(muur.meterGetoond <= 10, 'over de hele kaart staat (bijna) geen muur midden op een rijbaan of stoep',
  `${muur.meterGetoond} m in beeld, ${muur.meter} m in de kaart`);

console.log(fouten ? `\n${fouten} fout(en)` : '\nAlles goed.');
console.log('EINDE');
await browser.close();
process.exit(fouten ? 1 : 0);
