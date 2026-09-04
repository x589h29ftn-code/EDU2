// Bouwt de wereld uit js/kaart.js (gegenereerd uit BGT en 3D BAG, zie
// docs/METHODIEK.md). Ondergrond als vlakken, trottoirbanden als opstaande
// randen, panden als 3D BAG-daken op hun echte grondvlak, wegassen voor
// verkeer, voetgangers en straatnaamborden.
//
// world.js roept bouwKaartWereld aan zodra er een kaart is en geeft zijn
// eigen lijsten (colliders, roadSegments, ...) mee, zodat de rest van het spel
// niets merkt van de andere bron.
import * as THREE from 'three';
import * as T from './textures.js';
import { KLEUR } from './kaartkleuren.js';

export let KAART = null;
export function zetKaart(k) { KAART = k; }

// Weergavestand: 'normaal' of 'plat' (egale kleuren per klasse, voor de
// vergelijking met de kaartplaat).
let STAND = 'normaal';
export function zetStand(s) { STAND = s; }
export function kaartStand() { return STAND; }

const vlakIndex = new Map();   // bucket "i:j" -> vlakken, voor ondergrondKaart
const BUCKET = 25;
export const waterRingen = [];
export const kaartLabels = [];

// ---------------------------------------------------------------- hulpjes
function inRing(x, z, ring) {
  let binnen = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) binnen = !binnen;
  }
  return binnen;
}
const inVlak = (x, z, v) => inRing(x, z, v.r[0]) && !v.r.slice(1).some(h => inRing(x, z, h));

function bucketsVan(ringen) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of ringen[0]) { if (x < x0) x0 = x; if (z < z0) z0 = z; if (x > x1) x1 = x; if (z > z1) z1 = z; }
  const uit = [];
  for (let i = Math.floor(x0 / BUCKET); i <= Math.floor(x1 / BUCKET); i++) for (let j = Math.floor(z0 / BUCKET); j <= Math.floor(z1 / BUCKET); j++) uit.push(`${i}:${j}`);
  return uit;
}

/** Welke klasse ondergrond ligt op (x,z)? null buiten de kaart. */
export function vlakOp(x, z) {
  const lijst = vlakIndex.get(`${Math.floor(x / BUCKET)}:${Math.floor(z / BUCKET)}`);
  if (!lijst) return null;
  // hoogste y wint (stoep boven berm boven rijbaan) — vlakken overlappen niet, maar afronding kan
  let best = null;
  for (const v of lijst) if (inVlak(x, z, v) && (!best || v.y > best.y)) best = v;
  return best;
}

/** Ondergrond voor voetstappen: 'klinker' | 'tegel' | 'gras' | 'water' | 'asfalt'. */
export function ondergrondKaart(x, z) {
  const v = vlakOp(x, z);
  if (!v) return 'gras';
  if (v.k === 'water') return 'water';
  switch (v.m) {
    case 'klinker': case 'rood': case 'beton': return 'klinker';
    case 'asfalt': case 'fietspad': return 'asfalt';
    case 'tegels': return 'tegel';
    default: return 'gras';
  }
}

// Driehoeken van een polygoon met gaten; hoekpunten [x,z]. Levert indexen in
// de aaneengeschakelde puntenlijst (buitenring, dan gaten).
function trianguleer(ringen) {
  const contour = ringen[0].map(([x, z]) => new THREE.Vector2(x, z));
  const gaten = ringen.slice(1).map(r => r.map(([x, z]) => new THREE.Vector2(x, z)));
  const tris = THREE.ShapeUtils.triangulateShape(contour, gaten);
  const punten = ringen.flat();
  return { tris, punten };
}

// Vlak plat op hoogte y, normaal omhoog, uv in wereldmeters.
function vlakGeometrie(ringen, y, uvSchaal, pos, uv, nor) {
  const { tris, punten } = trianguleer(ringen);
  for (const [a, b, c] of tris) {
    const A = punten[a], B = punten[b], C = punten[c];
    // volgorde zodat de normaal naar +Y wijst
    const kruis = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
    const [P, Q, R] = kruis > 0 ? [A, C, B] : [A, B, C];
    for (const p of [P, Q, R]) { pos.push(p[0], y, p[1]); uv.push(p[0] * uvSchaal, p[1] * uvSchaal); nor.push(0, 1, 0); }
  }
}

// Opstaande rand langs alle ringen van een vlak, van yBoven naar yOnder.
function randGeometrie(ringen, yBoven, yOnder, pos, uv, nor) {
  for (const ring of ringen) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const L = Math.hypot(dx, dz); if (L < 1e-4) continue;
      const nx = dz / L, nz = -dx / L;
      const quad = [[a[0], yBoven, a[1]], [b[0], yBoven, b[1]], [b[0], yOnder, b[1]], [a[0], yOnder, a[1]]];
      for (const [p, q, r] of [[0, 1, 2], [0, 2, 3]]) {
        for (const k of [p, q, r]) { const v = quad[k]; pos.push(v[0], v[1], v[2]); uv.push(k === 1 || k === 2 ? L : 0, v[1]); nor.push(nx, 0, nz); }
      }
    }
  }
}

function maakMesh(pos, uv, nor, mat, opties = {}) {
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = opties.schaduwOntvangen !== false;
  m.castShadow = !!opties.schaduw;
  m.userData.klasse = opties.klasse;
  return m;
}

// ---------------------------------------------------------------- materialen
const KM = {};
function materialen(MAT) {
  const std = (map, extra = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.95, metalness: 0, ...extra });
  const getint = (tex, kleur) => { const m = std(tex); m.color = new THREE.Color(kleur); return m; };
  KM.klinker = MAT.klinker; KM.rood = MAT.rood; KM.asfalt = MAT.asfalt; KM.tegels = MAT.tiles; KM.gras = MAT.grass;
  KM.fietspad = MAT.fietspad; KM.water = MAT.water; KM.hedge = MAT.hedge;
  KM.beton = getint(T.tiles(), 0xb8b6ae);
  KM.grind = new THREE.MeshStandardMaterial({ color: 0xa79f8f, roughness: 1 });
  KM.grasklinker = getint(T.grass(), 0xa3b48a);
  KM.bosgrond = getint(T.grass(), 0x6f8a58);
  KM.bodembedekker = getint(T.grass(), 0x7ea86a);
  KM.erf = getint(T.grass(), 0xb8c79a);
  KM.zand = MAT.sand;
  KM.oever = new THREE.MeshStandardMaterial({ color: 0x7e9a5c, roughness: 1 });
  KM.hout = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.9 });
  KM.oeverwand = new THREE.MeshStandardMaterial({ color: 0x5f5140, roughness: 1 });
  KM.curb = MAT.curb;
  KM.muur = std(T.brick('#8a6752', '#b9b2a6', 1));
  KM.muurGeel = std(T.brick('#c9b98a', '#d8d2c2', 2));
  KM.muurRood = std(T.brick('#9a4a36', '#b9b2a6', 3));
  KM.dakpan = std(T.roofTiles('#4a3a33', 5));
  KM.dakpanRood = std(T.roofTiles('#7a3b2a', 6));
  KM.bitumen = std(T.bitumen());
  KM.paal = MAT.pole; KM.lamp = MAT.lamp;
  KM.struik = MAT.shrubA;
  // platte controlekleuren
  KM.plat = {};
  for (const [k, kleur] of Object.entries(KLEUR)) KM.plat[k] = new THREE.MeshBasicMaterial({ color: kleur, side: THREE.DoubleSide });
}

// ---------------------------------------------------------------- bouwen
/**
 * scene: Three-scene; W: de lijsten uit world.js
 *   { MAT, colliders, roadSegments, parkSpots, treePositions, lampPosities, waterPolys, addCollider }
 */
export function bouwKaartWereld(scene, W) {
  const K = KAART;
  materialen(W.MAT);
  vlakIndex.clear(); waterRingen.length = 0; kaartLabels.length = 0;
  const plat = STAND === 'plat';
  const matVoor = (v) => plat ? (KM.plat[v.k] || KM.plat.verharding) : (KM[v.m] || KM.klinker);
  const uvVoor = (m) => (m === 'gras' || m === 'erf' || m === 'bosgrond' || m === 'bodembedekker' || m === 'grasklinker') ? 0.12 : m === 'water' ? 0.05 : 0.5;

  // -- ondergrond, één mesh per materiaal
  const perMat = new Map();
  const rand = { pos: [], uv: [], nor: [] };
  const oever = { pos: [], uv: [], nor: [] };
  for (const v of K.vlakken) {
    for (const b of bucketsVan(v.r)) { if (!vlakIndex.has(b)) vlakIndex.set(b, []); vlakIndex.get(b).push(v); }
    const mat = matVoor(v);
    if (!perMat.has(mat)) perMat.set(mat, { pos: [], uv: [], nor: [], klasse: v.k });
    const g = perMat.get(mat);
    vlakGeometrie(v.r, v.y, uvVoor(v.m), g.pos, g.uv, g.nor);
    if (v.k === 'water') {
      waterRingen.push(v.r[0]);
      W.waterPolys.push(v.r[0].map(([x, z]) => new THREE.Vector2(x, z)));
      if (!plat) randGeometrie(v.r, 0.13, -0.6, oever.pos, oever.uv, oever.nor);
    } else if (!plat && v.y > 0.03 && v.k !== 'brug' && v.k !== 'steiger' && v.k !== 'bouwwerk') {
      randGeometrie(v.r, v.y, -0.02, rand.pos, rand.uv, rand.nor);
    }
  }
  for (const [mat, g] of perMat) { const m = maakMesh(g.pos, g.uv, g.nor, mat, { klasse: g.klasse }); if (m) scene.add(m); }
  if (!plat) {
    const r = maakMesh(rand.pos, rand.uv, rand.nor, KM.curb, { klasse: 'rand' }); if (r) scene.add(r);
    const o = maakMesh(oever.pos, oever.uv, oever.nor, KM.oeverwand, { klasse: 'oeverwand' }); if (o) scene.add(o);
    // grondvlak onder alles, voor buiten het gebied en voor gaatjes
    const groundTex = T.grass().clone(); groundTex.needsUpdate = true; groundTex.repeat.set(300, 300);
    const grond = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 }));
    grond.rotation.x = -Math.PI / 2; grond.position.y = -1.0; grond.receiveShadow = true; scene.add(grond);   // onder het water
  } else {
    const grond = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600), KM.plat.achtergrond);
    grond.rotation.x = -Math.PI / 2; grond.position.y = -1.0; scene.add(grond);
  }

  // -- panden
  bouwPanden(scene, W, plat);

  // -- hagen, struiken, bomen, lantaarns
  if (!plat) {
    const hg = { pos: [], uv: [], nor: [] };
    for (const ring of K.hagen) { vlakGeometrie([ring], 1.1, 0.5, hg.pos, hg.uv, hg.nor); randGeometrie([ring], 1.1, 0.0, hg.pos, hg.uv, hg.nor); }
    const hm = maakMesh(hg.pos, hg.uv, hg.nor, KM.hedge, { schaduw: true, klasse: 'haag' }); if (hm) scene.add(hm);
    for (const b of K.bomen) W.treePositions.push({ x: b.x, z: b.z, s: b.s });
    if (K.struiken.length) {
      const geo = new THREE.SphereGeometry(0.7, 7, 5);
      const im = new THREE.InstancedMesh(geo, KM.struik, K.struiken.length);
      const m = new THREE.Matrix4();
      K.struiken.forEach((s, i) => { m.makeScale(s.s, s.s * 0.8, s.s); m.setPosition(s.x, 0.45 * s.s, s.z); im.setMatrixAt(i, m); });
      im.castShadow = true; scene.add(im);
    }
    bouwLantaarns(scene, W);
  } else {
    const hg = { pos: [], uv: [], nor: [] };
    for (const ring of K.hagen) vlakGeometrie([ring], 1.1, 0.5, hg.pos, hg.uv, hg.nor);
    const hm = maakMesh(hg.pos, hg.uv, hg.nor, KM.plat.haag, { klasse: 'haag' }); if (hm) scene.add(hm);
  }

  // -- wegassen -> roadSegments (verkeer, voetgangers, straatnaam) en parkeerplekken
  for (const w of K.wegassen) {
    for (let i = 1; i < w.pts.length; i++) {
      const a = w.pts[i - 1], b = w.pts[i];
      const breed = Math.max(0.5, (a[2] + b[2]) / 2 || w.w);
      W.roadSegments.push({
        name: w.naam, a: [a[0], a[1]], b: [b[0], b[1]], w: breed, drive: w.drive,
        // voetgangers lopen over de as van het voetpad, niet naast de rijbaan
        walkOff: w.drive ? 0 : 0.3, walkOffL: w.drive ? 0 : 0.3, walkOffR: w.drive ? 0 : 0.3,
        corr: breed / 2 + 0.3, corrL: breed / 2 + 0.3, corrR: breed / 2 + 0.3,
      });
    }
  }
  for (const p of K.parkeerplekken) W.parkSpots.push({ x: p.x, z: p.z, yaw: p.yaw });
  for (const l of K.labels) kaartLabels.push(l);
}

// Panden: LoD 2.2-vlakken uit 3D BAG waar die er zijn, anders een opgetrokken grondvlak.
function bouwPanden(scene, W, plat) {
  const K = KAART;
  const muur = { pos: [], uv: [], nor: [] }, dak = { pos: [], uv: [], nor: [] }, platdak = { pos: [], uv: [], nor: [] };
  const drie = (P, Q, R, doel, n, uvf) => {
    for (const p of [P, Q, R]) { doel.pos.push(p[0], p[1], p[2]); doel.nor.push(n[0], n[1], n[2]); const [u, v] = uvf(p); doel.uv.push(u, v); }
  };
  const normaal = (pts) => {           // Newell
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]); }
    const L = Math.hypot(nx, ny, nz) || 1; return [nx / L, ny / L, nz / L];
  };
  const vlak3d = (ringen, soort, dakType) => {
    const buiten = ringen[0];
    const n = normaal(buiten);
    // 2D-basis in het vlak
    const up = Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const ux = [n[1] * up[2] - n[2] * up[1], n[2] * up[0] - n[0] * up[2], n[0] * up[1] - n[1] * up[0]];
    const Lu = Math.hypot(...ux) || 1; ux[0] /= Lu; ux[1] /= Lu; ux[2] /= Lu;
    const vy = [n[1] * ux[2] - n[2] * ux[1], n[2] * ux[0] - n[0] * ux[2], n[0] * ux[1] - n[1] * ux[0]];
    const proj = (p) => new THREE.Vector2(p[0] * ux[0] + p[1] * ux[1] + p[2] * ux[2], p[0] * vy[0] + p[1] * vy[1] + p[2] * vy[2]);
    const contour = buiten.map(proj), gaten = ringen.slice(1).map(r => r.map(proj));
    let tris;
    try { tris = THREE.ShapeUtils.triangulateShape(contour, gaten); } catch { return; }
    const punten = ringen.flat();
    const doel = soort === 1 ? muur : (dakType === 'horizontal' || Math.abs(n[1]) > 0.97) ? platdak : dak;
    const uvf = soort === 1 ? (p) => [p[0] * ux[0] + p[2] * ux[2], p[1]] : (p) => [p[0] * 0.5, p[2] * 0.5];
    for (const [a, b, c] of tris) {
      const A = punten[a], B = punten[b], C = punten[c];
      // driehoek in de richting van de vlaknormaal
      const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
      const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const zelfdeKant = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] >= 0;
      drie(A, zelfdeKant ? B : C, zelfdeKant ? C : B, doel, n, uvf);
    }
  };
  const extrudeer = (voet, h, dakType) => {
    // muren
    for (let i = 0; i < voet.length; i++) {
      const a = voet[i], b = voet[(i + 1) % voet.length];
      const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 1e-4) continue;
      // voet uit de generator is in xz; buitenkant bepalen via oppervlakteteken
      const q = [[a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], h, b[1]], [a[0], h, a[1]]];
      const n = [dz / L, 0, -dx / L];
      const uvf = (p) => [((p[0] - a[0]) * dx + (p[2] - a[1]) * dz) / L, p[1]];
      drie(q[0], q[1], q[2], muur, n, uvf); drie(q[0], q[2], q[3], muur, n, uvf);
    }
    const { tris, punten } = trianguleer([voet]);
    for (const [a, b, c] of tris) {
      const A = punten[a], B = punten[b], C = punten[c];
      const kruis = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
      const [P, Q, R] = kruis > 0 ? [A, C, B] : [A, B, C];
      drie([P[0], h, P[1]], [Q[0], h, Q[1]], [R[0], h, R[1]], dakType === 'slanted' ? dak : platdak, [0, 1, 0], (p) => [p[0] * 0.5, p[2] * 0.5]);
    }
  };
  // Muren van een geëxtrudeerd grondvlak moeten naar buiten kijken: als de
  // ring met de klok mee loopt (in xz) klopt de normaal hierboven, anders keren we hem.
  const opp = (ring) => { let a = 0; for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };

  let met3d = 0, geschat = 0;
  for (const p of K.panden) {
    if (p.v && p.f) {
      const V = p.v;
      const pt = (i) => [V[i * 3], V[i * 3 + 1], V[i * 3 + 2]];
      p.f.forEach((ringen, fi) => vlak3d(ringen.map(r => r.map(pt)), p.s[fi], p.dak));
      met3d++;
    } else {
      const voet = opp(p.voet) > 0 ? p.voet.slice().reverse() : p.voet;
      extrudeer(voet, p.goot || 3, p.dak);
      geschat++;
    }
    if (p.rect) W.addCollider(p.rect.cx, p.rect.cz, p.rect.hx, p.rect.hz, -p.rect.hoek, Math.max(3, p.nok || p.goot || 3));
  }
  const muurMat = plat ? KM.plat.pand : KM.muur, dakMat = plat ? KM.plat.pand : KM.dakpan, platMat = plat ? KM.plat.pand : KM.bitumen;
  for (const [g, mat, k] of [[muur, muurMat, 'muur'], [dak, dakMat, 'dak'], [platdak, platMat, 'platdak']]) {
    const m = maakMesh(g.pos, g.uv, g.nor, mat, { schaduw: true, klasse: k });
    if (m) { if (plat) m.material.side = THREE.DoubleSide; scene.add(m); }
  }
  console.log(`kaart: ${met3d} panden met 3D BAG-dak, ${geschat} geschat, ${K.vlakken.length} vlakken, ${K.wegassen.length} wegassen`);
}

function bouwLantaarns(scene, W) {
  const K = KAART;
  if (!K.lantaarns.length) return;
  const paalGeo = new THREE.CylinderGeometry(0.06, 0.09, 5.2, 8); paalGeo.translate(0, 2.6, 0);
  const armGeo = new THREE.BoxGeometry(0.9, 0.08, 0.08); armGeo.translate(0.35, 5.15, 0);
  const kopGeo = new THREE.BoxGeometry(0.5, 0.14, 0.24); kopGeo.translate(0.7, 5.12, 0);
  const n = K.lantaarns.length;
  const palen = new THREE.InstancedMesh(paalGeo, KM.paal, n), armen = new THREE.InstancedMesh(armGeo, KM.paal, n), koppen = new THREE.InstancedMesh(kopGeo, KM.lamp, n);
  const m = new THREE.Matrix4();
  K.lantaarns.forEach((l, i) => {
    // arm naar de dichtstbijzijnde rijbaan-as
    let best = null, bd = 1e9;
    for (const s of W.roadSegments) { if (!s.drive) continue; const d = Math.hypot(s.a[0] - l.x, s.a[1] - l.z); if (d < bd) { bd = d; best = s; } }
    const hoek = best ? Math.atan2(-(best.a[1] - l.z), best.a[0] - l.x) : 0;
    m.makeRotationY(hoek); m.setPosition(l.x, 0, l.z);
    palen.setMatrixAt(i, m); armen.setMatrixAt(i, m); koppen.setMatrixAt(i, m);
    W.lampPosities.push({ x: l.x + Math.cos(hoek) * 0.7, y: 5.1, z: l.z - Math.sin(hoek) * 0.7 });
    W.addCollider(l.x, l.z, 0.1, 0.1, 0, 5);
  });
  palen.castShadow = true;
  scene.add(palen, armen, koppen);
}

/** Startpositie en kijkrichting uit de kaart. */
export function startKaart() { return KAART.start; }
