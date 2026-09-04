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
import { PROP_TYPES } from './props.js';

export let KAART = null;
export function zetKaart(k) { KAART = k; }

// Weergavestand: 'normaal' of 'plat' (egale kleuren per klasse, voor de
// vergelijking met de kaartplaat).
let STAND = 'normaal';
export function zetStand(s) { STAND = s; }
export function kaartStand() { return STAND; }

const vlakIndex = new Map();   // bucket "i:j" -> vlakken, voor ondergrondKaart
const BUCKET = 25;
const KERB_Y = 0.12;   // hoogte van stoep, tuin en gras boven de rijbaan
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
  KM.schutting = std(T.planks('#7a5f42'));
  KM.hekje = new THREE.MeshStandardMaterial({ map: T.hekje(), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 });
  KM.streep = MAT.streep;
  KM.drempel = new THREE.MeshStandardMaterial({ map: T.zebra(), roughness: 0.9 });
  // omheinde terreinen (RWZI): spijlenhek, staal, betonnen bakken met water, silo's
  KM.spijlen = new THREE.MeshStandardMaterial({ map: T.spijlenhek(), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.35 });
  KM.staal = new THREE.MeshStandardMaterial({ color: 0x6b7178, roughness: 0.5, metalness: 0.5 });
  KM.betonwand = new THREE.MeshStandardMaterial({ color: 0xa9a59b, roughness: 0.95, side: THREE.DoubleSide });
  KM.tankwater = new THREE.MeshStandardMaterial({ color: 0x3d5457, roughness: 0.25, metalness: 0.1 });
  KM.silo = new THREE.MeshStandardMaterial({ color: 0x8b9197, roughness: 0.4, metalness: 0.55 });
  KM.gevel = new Map();     // gedeelde gevel- en steenmaterialen per sleutel
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
    // vrij: boom zonder botsing (doorloopbaar plantsoen)
    for (const b of K.bomen) W.treePositions.push({ x: b.x, z: b.z, s: b.s, tall: !!b.tall, vrij: !!b.vrij });
    // drempels: witte markering op de rijbaan
    const dr = { pos: [], uv: [], nor: [] };
    for (const v of K.vlakken) if (v.drempel) vlakGeometrie(v.r, 0.012, 0.5, dr.pos, dr.uv, dr.nor);
    const drm = maakMesh(dr.pos, dr.uv, dr.nor, KM.drempel, { klasse: 'drempel' }); if (drm) scene.add(drm);
    // percelen: lage hagen, schuttingen en tegelpaden uit de plaatsingsregels
    const hg2 = { pos: [], uv: [], nor: [] }, sch = { pos: [], uv: [], nor: [] }, pd = { pos: [], uv: [], nor: [] }, st = { pos: [], uv: [], nor: [] };
    const balk = (a, b, dikte, h, doel, y0 = 0) => {
      const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 0.2) return;
      const nx = -dz / L * dikte / 2, nz = dx / L * dikte / 2;
      const ring = [[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz]];
      vlakGeometrie([ring], y0 + h, 0.5, doel.pos, doel.uv, doel.nor);
      randGeometrie([ring], y0 + h, y0, doel.pos, doel.uv, doel.nor);
    };
    const hek = { pos: [], uv: [], nor: [] }, tv = { pos: [], uv: [], nor: [] }, tvt = { pos: [], uv: [], nor: [] };
    for (const h of K.heggen || []) {
      if (h.soort === 'hekje') {
        // één plat vlak (twee kanten zichtbaar door DoubleSide), latten via de texture
        const dx = h.b[0] - h.a[0], dz = h.b[1] - h.a[1], L = Math.hypot(dx, dz); if (L < 0.3) continue;
        const nx = dz / L, nz = -dx / L;
        const q = [[h.a[0], KERB_Y + h.h, h.a[1]], [h.b[0], KERB_Y + h.h, h.b[1]], [h.b[0], KERB_Y, h.b[1]], [h.a[0], KERB_Y, h.a[1]]];
        for (const [i0, i1, i2] of [[0, 1, 2], [0, 2, 3]]) for (const k of [i0, i1, i2]) { const v = q[k]; hek.pos.push(v[0], v[1], v[2]); hek.uv.push(k === 1 || k === 2 ? L : 0, (v[1] - KERB_Y) / h.h); hek.nor.push(nx, 0, nz); }
        continue;
      }
      balk(h.a, h.b, 0.5, h.h, hg2, KERB_Y);
    }
    for (const t of K.tuinvlakken || []) vlakGeometrie([t.r], KERB_Y + 0.01, t.m === 'grind' ? 0.5 : 1 / 1.2, (t.m === 'grind' ? tv : tvt).pos, (t.m === 'grind' ? tv : tvt).uv, (t.m === 'grind' ? tv : tvt).nor);
    for (const f of K.schuttingen || []) balk(f.a, f.b, 0.06, f.h, sch, KERB_Y);
    for (const ring of K.paden || []) vlakGeometrie([ring], KERB_Y + 0.015, 1 / 1.2, pd.pos, pd.uv, pd.nor);
    for (const l of K.strepen || []) balk(l.a, l.b, 0.1, 0.008, st, 0.0);
    for (const [g, mat, k, schaduw] of [[hg2, KM.hedge, 'heg', true], [hek, KM.hekje, 'hekje', true], [sch, KM.schutting, 'schutting', true], [pd, KM.tegels, 'tegelpad', false], [tv, KM.grind, 'grindtuin', false], [tvt, KM.tegels, 'tegeltuin', false], [st, KM.streep, 'belijning', false]]) {
      const m = maakMesh(g.pos, g.uv, g.nor, mat, { klasse: k, schaduw }); if (m) scene.add(m);
    }
    // losse objecten uit de objectenbibliotheek (doelen, banken)
    for (const o of K.objecten || []) {
      const obj = W.maakProp ? W.maakProp(o.type) : null; if (!obj) continue;
      obj.position.set(o.x, KERB_Y, o.z); obj.rotation.y = (o.yaw || 0) * Math.PI / 180;
      obj.traverse(c => { c.castShadow = true; c.receiveShadow = true; });
      scene.add(obj);
      const def = PROP_TYPES[o.type];
      if (def && def.maat) W.addCollider(o.x, o.z, def.maat[0] / 2, def.maat[1] / 2, -obj.rotation.y, def.h || 2);
    }
    // omheinde terreinen: hekwerk, poort, bezinkbakken en tanks
    bouwTerreinen(scene, W);
    bouwBouwwerken(scene, W);
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

// Panden: LoD 2.2-vlakken uit 3D BAG waar die er zijn, anders een opgetrokken
// grondvlak. Muren die naar de straat kijken krijgen de gevel met ramen en
// deuren van het woningtype (textures.js), de achtergevel de achterkant, de
// rest kale steen. Het aantal lagen volgt uit de echte goothoogte.
function bouwPanden(scene, W, plat) {
  const K = KAART;
  const groepen = new Map();   // materiaalsleutel -> { pos, uv, nor, mat, klasse }
  const groep = (sleutel, maak, klasse) => {
    let g = groepen.get(sleutel);
    if (!g) { g = { pos: [], uv: [], nor: [], mat: plat ? KM.plat.pand : maak(), klasse }; groepen.set(sleutel, g); }
    return g;
  };
  const std = (map) => new THREE.MeshStandardMaterial({ map, roughness: 0.9 });
  const drie = (P, Q, R, g, n, uvf) => {
    for (const p of [P, Q, R]) { g.pos.push(p[0], p[1], p[2]); g.nor.push(n[0], n[1], n[2]); const [u, v] = uvf(p); g.uv.push(u, v); }
  };
  const normaal = (pts) => {           // Newell
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]); }
    const L = Math.hypot(nx, ny, nz) || 1; return [nx / L, ny / L, nz / L];
  };
  const opp = (ring) => { let a = 0; for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };

  // Welke groep en welke uv krijgt een muurvlak? Levert { g, uvf }.
  const muurKeuze = (pand, n, punten) => {
    const st = T.HOUSE_STYLES[pand.type];
    const seed = Number(String(pand.id).slice(-1)) || 0;
    const steen = st ? st.brick : ['#8a6752', '#b9b2a6'];
    // rechts-vector voor wie buiten voor de muur staat: (n.z, 0, -n.x)
    const r = [n[2], 0, -n[0]];
    let u0 = Infinity, u1 = -Infinity, top = 0;
    for (const p of punten) { const u = p[0] * r[0] + p[2] * r[2]; if (u < u0) u0 = u; if (u > u1) u1 = u; if (p[1] > top) top = p[1]; }
    const breed = u1 - u0;
    const kant = pand.front ? n[0] * pand.front[0] + n[2] * pand.front[1] : 0;
    // bedrijfsgebouw (RWZI): de bedrijfsgevel aan alle kanten, geen dakkapellen
    const ind = !!(st && st.industrieel);
    // (lage bedrijfsmuren onder 2,6 m, zoals de randen van de bakken, blijven kale steen)
    const gevel = !pand.boven && st && pand.type !== 'schuur' && breed >= 2.4 && Math.abs(n[1]) < 0.3 && (ind ? top >= 2.6 : (kant > 0.6 || kant < -0.6));
    // Dakkapel: een muurvlak dat helemaal boven de goot begint. Witte wangen,
    // en aan de voorkant het kozijn van de dakkapel.
    let laagste = Infinity; for (const p of punten) laagste = Math.min(laagste, p[1]);
    if (st && !ind && pand.goot && laagste > pand.goot - 0.35 && Math.abs(n[1]) < 0.5 && !pand.boven) {
      if (Math.abs(kant) > 0.6 && breed >= 1.2) {
        const g = groep(`dakkapel|${st.dormerFrame || st.frame}`, () => std(T.dormerFront(st.dormerFrame || st.frame)), 'dakkapel');
        return { g, uvf: (p) => [(p[0] * r[0] + p[2] * r[2] - u0) / breed, Math.min(1, (p[1] - laagste) / Math.max(0.5, top - laagste))] };
      }
      const g = groep('dakkapel|wang', () => std(T.planks('#eeede8')), 'dakkapel');
      return { g, uvf: (p) => [(p[0] * r[0] + p[2] * r[2] - u0) / 1.2, p[1] / 1.2] };
    }
    if (pand.boven && st) {
      const totNok = !pand.nok || (pand.bovenTop ?? top) >= pand.nok - 0.6;
      if (!totNok && st.dormer) {
        // wang van een dakkapel: wit
        const g = groep('dakkapel|wang', () => std(T.planks('#eeede8')), 'dakkapel');
        return { g, uvf: (p) => [(p[0] * r[0] + p[2] * r[2] - u0) / 1.2, p[1] / 1.2] };
      }
      if (totNok && st.topgevel) {
        // houten topgevel boven de goot (Bonkelaar, Jasker): delen van 15 cm
        const g = groep(`planken|${st.topgevel}`, () => std(T.planks(st.topgevel)), 'topgevel');
        return { g, uvf: (p) => [(p[0] * r[0] + p[2] * r[2] - u0) / 1.2, p[1] / 1.2] };
      }
    }
    if (!gevel) {
      const sleutel = `steen|${pand.type}|${seed % 3}`;
      const g = groep(sleutel, () => std(T.brick(steen[0], steen[1], seed % 3 + 1)), 'muur');
      // baksteen: 2,6 m per texture
      return { g, uvf: (p) => [(p[0] * r[0] + p[2] * r[2] - u0) / 2.6, p[1] / 2.6] };
    }
    const achter = !ind && kant < 0;
    const SH = st.storeyH || 2.9;
    // bedrijfsgevel: het aantal lagen past op de echte muurhoogte en de
    // texture wordt over de hele muur uitgerekt, zodat de dakrand bovenaan zit
    const lagen = ind ? Math.max(1, Math.min(4, Math.floor(top / SH + 0.35))) : Math.max(1, Math.min(4, Math.round(top / SH)));
    const huizen = Math.max(1, Math.round(breed / st.w));
    const sleutel = `gevel|${pand.type}|${huizen}|${lagen}|${achter}|${seed % 6}`;
    const g = groep(sleutel, () => std(T.facade(pand.type, huizen, lagen, achter, seed % 6)), achter ? 'achtergevel' : 'voorgevel');
    const hoogte = ind ? Math.max(top, 2.5) : lagen * SH;
    // de texture bevat alle `huizen` naast elkaar, dus u loopt over de hele muur
    // van 0 tot 1 (met ×huizen zag een brede muur alleen de laatste pixelkolom)
    return { g, uvf: (p) => [((p[0] * r[0] + p[2] * r[2]) - u0) / breed, Math.min(1, p[1] / hoogte)] };
  };
  const dakGroep = (pand, hellend) => {
    const st = T.HOUSE_STYLES[pand.type];
    if (!hellend && st && st.industrieel) return groep(`dak|plat|${st.roof}`, () => new THREE.MeshStandardMaterial({ color: st.roof, roughness: 0.6, metalness: 0.3 }), 'platdak');
    if (!hellend) return groep('dak|plat', () => std(T.bitumen()), 'platdak');
    const kleur = st ? st.roof : '#4a3a33';
    return groep(`dak|${kleur}`, () => std(T.roofTiles(kleur, 5)), 'dak');
  };

  // Een muurvlak in een deel onder en een deel boven hoogte h knippen (voor
  // kopgevels: gevel tot de goot, daarboven kale steen tot de nok).
  const knipOpHoogte = (ring, h) => {
    const onder = [], boven = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      (a[1] <= h ? onder : boven).push(a);
      if ((a[1] <= h) !== (b[1] <= h)) {
        const t = (h - a[1]) / (b[1] - a[1]);
        const s = [a[0] + (b[0] - a[0]) * t, h, a[2] + (b[2] - a[2]) * t];
        onder.push(s); boven.push(s);
      }
    }
    return { onder: onder.length >= 3 ? onder : null, boven: boven.length >= 3 ? boven : null };
  };
  // Goothoogte van een muurvlak: de laagste bovenhoek aan de zijkanten.
  const gootVan = (ring, n) => {
    const r = [n[2], 0, -n[0]];
    let u0 = Infinity, u1 = -Infinity;
    for (const p of ring) { const u = p[0] * r[0] + p[2] * r[2]; if (u < u0) u0 = u; if (u > u1) u1 = u; }
    let goot = Infinity, top = 0;
    for (const p of ring) {
      const u = p[0] * r[0] + p[2] * r[2];
      if (p[1] > top) top = p[1];
      if (p[1] > 0.5 && (Math.abs(u - u0) < 0.15 || Math.abs(u - u1) < 0.15)) goot = Math.min(goot, p[1]);
    }
    return { goot: goot === Infinity ? top : goot, top };
  };

  const vlak3d = (pand, ringen, soort) => {
    const buiten = ringen[0];
    const n = normaal(buiten);
    if (soort === 1 && Math.abs(n[1]) < 0.5 && ringen.length === 1 && !pand.boven && !(T.HOUSE_STYLES[pand.type] || {}).industrieel) {
      // Muren boven de goot doorknippen: eronder de gevel, erboven een kopgevel
      // (tot de nok) of de wang van een dakkapel (lager dan de nok). 3D BAG trekt
      // de wanden van een dakkapel door tot de grond, dus zonder knip zou de
      // wang als baksteen uit het dak steken.
      let laag = Infinity, top = 0;
      for (const p of buiten) { laag = Math.min(laag, p[1]); top = Math.max(top, p[1]); }
      const gootH = pand.goot || gootVan(buiten, n).goot;
      if (laag < gootH - 0.3 && top > gootH + 0.6) {
        const { onder, boven } = knipOpHoogte(buiten, gootH + 0.02);
        if (onder && boven) { vlak3d(pand, [onder], 1); vlak3d({ ...pand, boven: true, bovenTop: top }, [boven], 1); return; }
      }
    }
    const up = Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const ux = [n[1] * up[2] - n[2] * up[1], n[2] * up[0] - n[0] * up[2], n[0] * up[1] - n[1] * up[0]];
    const Lu = Math.hypot(...ux) || 1; ux[0] /= Lu; ux[1] /= Lu; ux[2] /= Lu;
    const vy = [n[1] * ux[2] - n[2] * ux[1], n[2] * ux[0] - n[0] * ux[2], n[0] * ux[1] - n[1] * ux[0]];
    const proj = (p) => new THREE.Vector2(p[0] * ux[0] + p[1] * ux[1] + p[2] * ux[2], p[0] * vy[0] + p[1] * vy[1] + p[2] * vy[2]);
    const contour = buiten.map(proj), gaten = ringen.slice(1).map(r => r.map(proj));
    let tris;
    try { tris = THREE.ShapeUtils.triangulateShape(contour, gaten); } catch { return; }
    const punten = ringen.flat();
    let g, uvf;
    if (soort === 1 && Math.abs(n[1]) < 0.5) ({ g, uvf } = muurKeuze(pand, n, punten));
    else { const hellend = Math.abs(n[1]) < 0.97 && pand.dak !== 'horizontal'; g = dakGroep(pand, hellend); const s = hellend ? 0.25 : 0.5; uvf = (p) => [p[0] * s, (p[2] + p[1] * 0.6) * s]; }
    for (const [a, b, c] of tris) {
      const A = punten[a], B = punten[b], C = punten[c];
      const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
      const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const zelfdeKant = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] >= 0;
      drie(A, zelfdeKant ? B : C, zelfdeKant ? C : B, g, n, uvf);
    }
  };
  const extrudeer = (pand, voet, h, hellend) => {
    for (let i = 0; i < voet.length; i++) {
      const a = voet[i], b = voet[(i + 1) % voet.length];
      const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 1e-4) continue;
      const q = [[a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], h, b[1]], [a[0], h, a[1]]];
      const n = [dz / L, 0, -dx / L];
      const { g, uvf } = muurKeuze(pand, n, q);
      drie(q[0], q[1], q[2], g, n, uvf); drie(q[0], q[2], q[3], g, n, uvf);
    }
    const { tris, punten } = trianguleer([voet]);
    const g = dakGroep(pand, hellend);
    for (const [a, b, c] of tris) {
      const A = punten[a], B = punten[b], C = punten[c];
      const kruis = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
      const [P, Q, R] = kruis > 0 ? [A, C, B] : [A, B, C];
      drie([P[0], h, P[1]], [Q[0], h, Q[1]], [R[0], h, R[1]], g, [0, 1, 0], (p) => [p[0] * 0.5, p[2] * 0.5]);
    }
  };

  let met3d = 0, geschat = 0;
  for (const p of K.panden) {
    if (p.v && p.f) {
      const V = p.v;
      const pt = (i) => [V[i * 3], V[i * 3 + 1], V[i * 3 + 2]];
      p.f.forEach((ringen, fi) => vlak3d(p, ringen.map(r => r.map(pt)), p.s[fi]));
      met3d++;
    } else {
      // muren naar buiten: ring met de klok mee (in xz)
      const voet = opp(p.voet) > 0 ? p.voet.slice().reverse() : p.voet;
      extrudeer(p, voet, p.goot || 3, p.dak === 'slanted');
      geschat++;
    }
    if (p.rect) W.addCollider(p.rect.cx, p.rect.cz, p.rect.hx, p.rect.hz, -p.rect.hoek, Math.max(3, p.nok || p.goot || 3));
  }
  for (const g of groepen.values()) {
    const m = maakMesh(g.pos, g.uv, g.nor, g.mat, { schaduw: true, klasse: g.klasse });
    if (m) { if (plat) m.material.side = THREE.DoubleSide; scene.add(m); }
  }
  console.log(`kaart: ${met3d} panden met 3D BAG-dak, ${geschat} geschat, ${groepen.size} materialen, ${K.vlakken.length} vlakken, ${K.wegassen.length} wegassen`);
}

// Hekwerken en poorten van de omheinde terreinen (RWZI, data/stijl/omgeving.json):
// een spijlenhek van 2 m op panelen van 2,5 m als één doorzichtig vlak per
// hekstuk (twee kanten zichtbaar door DoubleSide), met een botsingsdoos per
// segment. De schuifpoort: twee zware palen en een hekblad in een stalen kader
// dat een stukje openstaat, zodat je te voet het terrein op kunt.
function bouwTerreinen(scene, W) {
  const K = KAART;
  const sp = { pos: [], uv: [], nor: [] };
  const paneel = (a, b, y0, h, offset = 0) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 0.2) return;
    const nx = dz / L, nz = -dx / L;
    const q = [[a[0], y0 + h, a[1]], [b[0], y0 + h, b[1]], [b[0], y0, b[1]], [a[0], y0, a[1]]];
    for (const [i0, i1, i2] of [[0, 1, 2], [0, 2, 3]]) for (const k of [i0, i1, i2]) {
      const v = q[k]; sp.pos.push(v[0], v[1], v[2]); sp.uv.push((offset + (k === 1 || k === 2 ? L : 0)) / 2.5, (v[1] - y0) / h); sp.nor.push(nx, 0, nz);
    }
  };
  for (const hw of K.hekwerken || []) {
    let s = 0;
    for (let i = 1; i < hw.pts.length; i++) {
      const a = hw.pts[i - 1], b = hw.pts[i]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.2) continue;
      paneel(a, b, KERB_Y, hw.h, s); s += L;
      W.addCollider((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, L / 2, 0.08, -Math.atan2(b[1] - a[1], b[0] - a[0]), hw.h);
    }
  }
  for (const p of K.poorten || []) {
    const dx = p.b[0] - p.a[0], dz = p.b[1] - p.a[1], L = Math.hypot(dx, dz); if (L < 1) continue;
    const ux = dx / L, uz = dz / L, open = Math.min(p.open || 0, L - 0.5), draai = -Math.atan2(uz, ux);
    const paal = new THREE.BoxGeometry(0.18, p.h + 0.4, 0.18);
    for (const q of [p.a, p.b]) {
      const m = new THREE.Mesh(paal, KM.staal); m.position.set(q[0], KERB_Y + (p.h + 0.4) / 2, q[1]); m.castShadow = true; scene.add(m);
      W.addCollider(q[0], q[1], 0.12, 0.12, 0, p.h);
    }
    // het hekblad, vanaf paal a `open` meter opzij geschoven (het steekt dan voorbij paal b)
    const blad = [p.a[0] + ux * open, p.a[1] + uz * open], eind = [p.a[0] + ux * (open + L), p.a[1] + uz * (open + L)];
    paneel(blad, eind, KERB_Y + 0.1, p.h - 0.2, 0);
    const kader = new THREE.Group();
    for (const y of [KERB_Y + 0.12, KERB_Y + p.h - 0.12]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(L, 0.07, 0.07), KM.staal);
      b.position.set((blad[0] + eind[0]) / 2, y, (blad[1] + eind[1]) / 2); b.rotation.y = draai; kader.add(b);
    }
    for (const q of [blad, eind]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, p.h - 0.2, 0.08), KM.staal); b.position.set(q[0], KERB_Y + p.h / 2, q[1]); kader.add(b); }
    kader.traverse(c => { c.castShadow = true; }); scene.add(kader);
    W.addCollider((blad[0] + eind[0]) / 2, (blad[1] + eind[1]) / 2, L / 2, 0.08, draai, p.h);
  }
  const m = maakMesh(sp.pos, sp.uv, sp.nor, KM.spijlen, { klasse: 'hekwerk', schaduw: true }); if (m) scene.add(m);
}

// Bezinkbakken en tanks (BGT overig bouwwerk, op de RWZI): een ronde betonnen
// bak van 1,6 m met donker water erin en een ruimerbrug op een middenkolom, een
// opslagtank als stalen silo van 6 m, overige bouwwerken als laag betonblok.
// In de kaartplaat blijven ze de platte 'bouwwerk'-vlakken die ze al waren.
function bouwBouwwerken(scene, W) {
  const K = KAART;
  const beton = { pos: [], uv: [], nor: [] }, water = { pos: [], uv: [], nor: [] }, silo = { pos: [], uv: [], nor: [] };
  for (const v of K.vlakken) {
    if (v.k !== 'bouwwerk') continue;
    const ring = v.r[0];
    let cx = 0, cz = 0; for (const p of ring) { cx += p[0]; cz += p[1]; } cx /= ring.length; cz /= ring.length;
    let rMax = 0; for (const p of ring) rMax = Math.max(rMax, Math.hypot(p[0] - cx, p[1] - cz));
    const rond = ring.length >= 40;
    if (v.sub === 'bezinkbak' && rond) {
      const h = 1.6;
      const binnen = ring.map(p => [cx + (p[0] - cx) * (1 - 0.35 / rMax), cz + (p[1] - cz) * (1 - 0.35 / rMax)]);
      randGeometrie([ring], h, -0.02, beton.pos, beton.uv, beton.nor);          // buitenwand
      vlakGeometrie([ring, binnen], h, 0.5, beton.pos, beton.uv, beton.nor);    // rand bovenop
      randGeometrie([binnen], h, h - 0.35, beton.pos, beton.uv, beton.nor);     // binnenwand
      vlakGeometrie([binnen], h - 0.3, 0.05, water.pos, water.uv, water.nor);   // water
      if (rMax < 30) {
        // ruimerbrug van het midden naar de rand, met een middenkolom
        const brug = new THREE.Group();
        const dek = new THREE.Mesh(new THREE.BoxGeometry(rMax + 0.6, 0.12, 1.0), KM.staal); dek.position.set((rMax + 0.6) / 2 - 0.3, h + 0.35, 0); brug.add(dek);
        for (const z of [-0.5, 0.5]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(rMax + 0.6, 0.04, 0.04), KM.staal); rail.position.set((rMax + 0.6) / 2 - 0.3, h + 1.35, z); brug.add(rail); }
        const kolom = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, h + 0.8, 12), KM.betonwand); kolom.position.set(0, (h + 0.8) / 2, 0); brug.add(kolom);
        brug.position.set(cx, 0, cz); brug.rotation.y = (cx * 7 + cz * 3) % 6.28; brug.traverse(c => { c.castShadow = true; }); scene.add(brug);
        W.addCollider(cx, cz, rMax * 0.72, rMax * 0.72, 0, h);
      }
    } else if (v.sub === 'opslagtank' && rond) {
      const h = 6.0;
      randGeometrie([ring], h, -0.02, silo.pos, silo.uv, silo.nor);
      vlakGeometrie([ring], h, 0.5, silo.pos, silo.uv, silo.nor);
      W.addCollider(cx, cz, rMax * 0.72, rMax * 0.72, 0, h);
    } else {
      randGeometrie([ring], v.y, -0.02, beton.pos, beton.uv, beton.nor);
    }
  }
  for (const [g, mat, k] of [[beton, KM.betonwand, 'bezinkbak'], [water, KM.tankwater, 'tankwater'], [silo, KM.silo, 'opslagtank']]) {
    const m = maakMesh(g.pos, g.uv, g.nor, mat, { klasse: k, schaduw: k !== 'tankwater' }); if (m) scene.add(m);
  }
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
