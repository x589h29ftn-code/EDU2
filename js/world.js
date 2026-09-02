// Wereldopbouw: wegen, stoepen, parkeervakken, water, groen, huizen, straatmeubilair.
import * as THREE from 'three';
import { ROADS, HIGHWAY, WATER, WATERWAYS, WOODS, GRASS, ROWS, PARKS, PARKING_LOTS, PLAYGROUND, START, PX_PER_M, toWorld } from './data.js';
import * as T from './textures.js';
import { rng } from './textures.js';

export const colliders = [];   // {cx,cz,hx,hz,cos,sin,h} georiënteerde rechthoeken
export const roadSegments = []; // voor straatnaam-detectie en NPC-paden: {name,a:[x,z],b:[x,z],w}
export const parkSpots = [];   // parkeerplaatsen voor auto's: {x,z,yaw}
export const treePositions = [];

const ROAD_Y = 0.10, WATER_Y = -0.15;

function vec(p) { const [x, z] = toWorld(p[0], p[1]); return new THREE.Vector2(x, z); }

// ---------- Hulpfuncties geometrie ----------
// Bouwt een lint (ribbon) langs een polyline met breedte w; offset verschuift het lint zijwaarts.
function ribbon(points2, w, y, offset = 0, uvScale = 1) {
  const pts = points2.filter((p, i) => i === 0 || p.distanceTo(points2[i - 1]) > 1e-3);
  const n = pts.length;
  const left = [], right = [];
  let acc = 0; const dists = [0];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const dPrev = i > 0 ? pts[i].clone().sub(pts[i - 1]).normalize() : null;
    const dNext = i < n - 1 ? pts[i + 1].clone().sub(pts[i]).normalize() : null;
    let d = dPrev && dNext ? dPrev.clone().add(dNext).normalize() : (dPrev || dNext);
    if (d.lengthSq() < 1e-6) d = dPrev || dNext;
    // normaal naar links (in kaartcoördinaten (dy,-dx); wereld XZ is identiek)
    const nrm = new THREE.Vector2(d.y, -d.x);
    let scale = 1;
    if (dPrev && dNext) {
      const cosHalf = Math.max(0.5, Math.sqrt((1 + dPrev.dot(dNext)) / 2));
      scale = 1 / cosHalf;
    }
    const c = p.clone().add(nrm.clone().multiplyScalar(offset * scale));
    left.push(c.clone().add(nrm.clone().multiplyScalar(w / 2 * scale)));
    right.push(c.clone().add(nrm.clone().multiplyScalar(-w / 2 * scale)));
    if (i > 0) acc += pts[i].distanceTo(pts[i - 1]);
    dists[i] = acc;
  }
  const pos = [], uv = [], idx = [];
  for (let i = 0; i < n; i++) {
    pos.push(left[i].x, y, left[i].y, right[i].x, y, right[i].y);
    uv.push(0, dists[i] * uvScale, w * uvScale, dists[i] * uvScale);
    if (i < n - 1) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function polygonGeom(pts2, y, uvScale = 0.5) {
  let area = 0;
  for (let i = 0; i < pts2.length; i++) { const a = pts2[i], b = pts2[(i + 1) % pts2.length]; area += a.x * b.y - b.x * a.y; }
  const ordered = area > 0 ? pts2.slice().reverse() : pts2;
  const shape = new THREE.Shape(ordered.map(p => new THREE.Vector2(p.x, -p.y)));
  const g = new THREE.ShapeGeometry(shape);
  // ShapeGeometry ligt in XY; roteren naar XZ
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  const uv = g.attributes.uv; const p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) * uvScale, p.getZ(i) * uvScale);
  const nor = g.attributes.normal;
  for (let i = 0; i < nor.count; i++) nor.setXYZ(i, 0, 1, 0);   // vlak op de grond: altijd omhoog
  nor.needsUpdate = true;
  return g;
}

function mergeGeoms(geoms) {
  // eenvoudige merge (alle geometrieën non-indexed met position/uv/normal)
  const pos = [], uv = [], nor = [];
  for (const g of geoms) {
    const ng = g.index ? g.toNonIndexed() : g;
    pos.push(...ng.attributes.position.array);
    if (ng.attributes.uv) uv.push(...ng.attributes.uv.array); else for (let i = 0; i < ng.attributes.position.count; i++) uv.push(0, 0);
    if (ng.attributes.normal) nor.push(...ng.attributes.normal.array); else for (let i = 0; i < ng.attributes.position.count; i++) nor.push(0, 1, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

// ---------- Materialen ----------
const MAT = {};
function materials() {
  const std = (map, extra = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.95, metalness: 0, ...extra });
  MAT.asfalt = std(T.asphalt());
  MAT.klinker = std(T.klinkers('grijs'));
  MAT.rood = std(T.klinkers('rood'));
  MAT.fietspad = new THREE.MeshStandardMaterial({ color: 0x9a4a3c, roughness: 0.95 });
  MAT.pad = std(T.tiles());
  MAT.snelweg = std(T.asphalt());
  MAT.tiles = std(T.tiles());
  MAT.grass = std(T.grass());
  MAT.water = new THREE.MeshStandardMaterial({ map: T.water(), color: 0xa8cfd6, roughness: 0.25, metalness: 0.05, transparent: true, opacity: 0.94, side: THREE.DoubleSide });
  MAT.hedge = std(T.hedge());
  MAT.curb = new THREE.MeshStandardMaterial({ color: 0x9a9890, roughness: 0.9 });
  MAT.trunk = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 });
  MAT.trunkPale = new THREE.MeshStandardMaterial({ color: 0x8f8a78, roughness: 1 });
  MAT.bank = new THREE.MeshStandardMaterial({ color: 0x4b5c33, roughness: 1 });
  MAT.leaf = new THREE.MeshStandardMaterial({ color: 0x4d7d2c, roughness: 1 });
  MAT.leaf2 = new THREE.MeshStandardMaterial({ color: 0x3f6b25, roughness: 1 });
  MAT.pole = new THREE.MeshStandardMaterial({ color: 0x7a7f86, roughness: 0.6, metalness: 0.6 });
  MAT.lamp = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 0.6 });
  MAT.kliko = new THREE.MeshStandardMaterial({ color: 0x3a3f44, roughness: 0.7 });
  MAT.klikoLid = new THREE.MeshStandardMaterial({ color: 0x1f5fd0, roughness: 0.6 });
  MAT.white = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.8 });
  MAT.gutter = new THREE.MeshStandardMaterial({ color: 0xb9bcc0, roughness: 0.55, metalness: 0.4 });
  MAT.glassDark = new THREE.MeshStandardMaterial({ color: 0x28323a, roughness: 0.12, metalness: 0.35 });
  MAT.railing = new THREE.MeshStandardMaterial({ color: 0xc6cace, roughness: 0.45, metalness: 0.55 });
  MAT.bikeFrame = new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.5, metalness: 0.5 });
  MAT.tyre = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 });
  MAT.pot = new THREE.MeshStandardMaterial({ color: 0x9a5b3f, roughness: 0.9 });
  MAT.tarp = new THREE.MeshStandardMaterial({ color: 0x27406b, roughness: 0.85 });
  MAT.dish = new THREE.MeshStandardMaterial({ color: 0xdedad2, roughness: 0.6 });
  MAT.drain = new THREE.MeshStandardMaterial({ color: 0x4a4a4c, roughness: 0.8, metalness: 0.3 });
  MAT.dark = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.8 });
  MAT.solar = std(T.solarPanel(), { roughness: 0.3, metalness: 0.5 });
  MAT.barrier = new THREE.MeshStandardMaterial({ color: 0x6b7a5a, roughness: 0.9 });
  MAT.sand = new THREE.MeshStandardMaterial({ color: 0xc9b58a, roughness: 1 });
  MAT.play = new THREE.MeshStandardMaterial({ color: 0xd8342a, roughness: 0.6 });
  MAT.play2 = new THREE.MeshStandardMaterial({ color: 0x2a6bd8, roughness: 0.6 });
  MAT.fence = new THREE.MeshStandardMaterial({ color: 0x6b5236, roughness: 1 });
  MAT.picket = new THREE.MeshStandardMaterial({ color: 0x9a8562, roughness: 1 });
  MAT.hedgeRed = new THREE.MeshStandardMaterial({ map: T.hedge(), color: 0xa4563f, roughness: 1 });
  MAT.conifer = new THREE.MeshStandardMaterial({ color: 0x2c4a24, roughness: 1 });
  MAT.shrubA = new THREE.MeshStandardMaterial({ color: 0x5c8a34, roughness: 1 });
  MAT.shrubB = new THREE.MeshStandardMaterial({ color: 0x86963a, roughness: 1 });
  MAT.shrubC = new THREE.MeshStandardMaterial({ color: 0x8e5a48, roughness: 1 });
  MAT.gravel = new THREE.MeshStandardMaterial({ color: 0x9c968a, roughness: 1 });
  MAT.reed = new THREE.MeshStandardMaterial({ color: 0x6f8a3e, roughness: 1 });
  MAT.bench = new THREE.MeshStandardMaterial({ color: 0x7a5f3c, roughness: 0.9 });
  MAT.parkGrass = new THREE.MeshStandardMaterial({ map: T.grass(), color: 0xc8e6a0, roughness: 1, side: THREE.DoubleSide });
}

// ---------- Wegen ----------
// Lengte van een polyline en slice op booglengte
function polyLength(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += pts[i].distanceTo(pts[i - 1]); return L; }
function sliceByLength(pts, s0, s1) {
  const out = []; let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]; const len = a.distanceTo(b); if (len < 1e-6) continue;
    const segStart = acc, segEnd = acc + len;
    if (segEnd < s0 || segStart > s1) { acc = segEnd; continue; }
    const t0 = Math.max(0, (s0 - segStart) / len), t1 = Math.min(1, (s1 - segStart) / len);
    if (t1 - t0 > 1e-6) {
      const p0 = a.clone().lerp(b, t0), p1 = a.clone().lerp(b, t1);
      if (out.length === 0) out.push(p0);
      if (out[out.length - 1].distanceTo(p1) > 1e-3) out.push(p1);
    }
    acc = segEnd;
  }
  return out.length >= 2 && polyLength(out) > 0.5 ? out : null;
}
function projectOnPolyline(p, pts) {
  let best = { d: 1e9 }; let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]; const ab = b.clone().sub(a); const len = ab.length(); if (len < 1e-6) continue;
    let t = p.clone().sub(a).dot(ab) / (len * len); t = Math.max(0, Math.min(1, t));
    const q = a.clone().add(ab.multiplyScalar(t)); const d = q.distanceTo(p);
    if (d < best.d) best = { d, q, s: acc + t * len, dir: b.clone().sub(a).normalize(), i };
    acc += len;
  }
  return best;
}

function buildRoads(scene) {
  const walkGeoms = [];
  const curbGeoms = [];
  const bayGeoms = [];
  // smalle straten bovenop bredere paden: teken op volgorde van breedte
  const order = ROADS.map((r, i) => ({ r, i })).sort((x, y) => x.r.w - y.r.w || x.i - y.i);
  const roads = order.map(({ r }) => ({ ...r, pts: r.pts.map(vec), trimStart: 0, trimEnd: 0 }));
  // wegeinden op de kruisende wegas leggen
  for (const road of roads) {
    for (const endIdx of [0, road.pts.length - 1]) {
      const p = road.pts[endIdx];
      let best = null, connected = false;
      for (const other of roads) {
        if (other === road) continue;
        const bothPath = (t) => t === 'pad' || t === 'fietspad';
        if (bothPath(other.type) && !bothPath(road.type)) continue;
        const pr = projectOnPolyline(p, other.pts);
        if (pr.d <= 0.05) connected = true;
        if (pr.d > 0.05 && pr.d < 13 && (!best || pr.d < best.pr.d)) best = { other, pr };
      }
      if (!best || connected) continue;
      road.pts[endIdx] = best.pr.q.clone();
      const trim = best.other.w / 2 + (best.other.verge || 0) + 1.6;
      if (endIdx === 0) road.trimStart = trim; else road.trimEnd = trim;
    }
  }
  let i = 0;
  for (const road of roads) {
    const pts = road.pts;
    const mat = MAT[road.type] || MAT.klinker;
    scene.add(Object.assign(new THREE.Mesh(ribbon(pts, road.w, ROAD_Y + i * 0.0007, 0, 0.5), mat), { receiveShadow: true }));
    const isPath = road.type === 'pad' || road.type === 'fietspad';
    // De berm kan per zijde verschillen: aan de kant van de huizen ligt het
    // trottoir vaak direct tegen de rijbaan (tuin, voetpad, weg), terwijl aan
    // de overkant een brede grasberm met bomen ligt.
    const vergeL = road.vergeL != null ? road.vergeL : (road.verge || 0);
    const vergeR = road.vergeR != null ? road.vergeR : (road.verge || 0);
    const walkSides = road.walk || '';
    const walkOffL = road.w / 2 + vergeL + 0.6;
    const walkOffR = road.w / 2 + vergeR + 0.6;
    const verge = Math.max(vergeL, vergeR);
    const corr = road.w / 2 + (isPath ? 0.4 : Math.min(vergeL, vergeR) + 1.4);
    for (let k = 0; k < pts.length - 1; k++) {
      roadSegments.push({
        name: road.name, a: [pts[k].x, pts[k].y], b: [pts[k + 1].x, pts[k + 1].y],
        w: road.w, corr, walkOff: walkOffL, walkOffL, walkOffR, drive: !isPath,
      });
    }
    if (!isPath) {
      const total = polyLength(pts);
      const inner = sliceByLength(pts, road.trimStart, total - road.trimEnd) || pts;
      const y = 0.05 + i * 0.0006;
      // trottoir tegen de voortuinen, met een grasberm ertussen
      if (walkSides.includes('L')) { walkGeoms.push(ribbon(inner, 1.3, y, walkOffL, 0.8)); }
      if (walkSides.includes('R')) { walkGeoms.push(ribbon(inner, 1.3, y, -walkOffR, 0.8)); }
      // trottoirband langs de rijbaan
      curbGeoms.push(ribbon(pts, 0.16, ROAD_Y + 0.004 + i * 0.0007, road.w / 2 + 0.08, 1));
      curbGeoms.push(ribbon(pts, 0.16, ROAD_Y + 0.004 + i * 0.0007, -(road.w / 2 + 0.08), 1));
      // parkeerhavens in de berm, direct naast de rijbaan
      const bays = road.bays || '';
      if (bays) {
        const r = rng(i * 17 + 3);
        for (let k = 0; k < pts.length - 1; k++) {
          const a = pts[k], b = pts[k + 1]; const d = b.clone().sub(a); const len = d.length(); d.normalize();
          const nrm = new THREE.Vector2(d.y, -d.x);
          const yaw = -Math.atan2(d.y, d.x);
          for (let sPos = 4; sPos < len - 9; sPos += 13.5) {
            for (const sgn of [1, -1]) {
              if (sgn > 0 && (!bays.includes('L') || vergeL < 2.0)) continue;
              if (sgn < 0 && (!bays.includes('R') || vergeR < 2.0)) continue;
              const bayLen = 10.8, bayW = 2.2;
              const c = a.clone().add(d.clone().multiplyScalar(sPos + bayLen / 2))
                .add(nrm.clone().multiplyScalar(sgn * (road.w / 2 + bayW / 2)));
              if (c.clone().sub(pts[0]).length() < road.trimStart || b.distanceTo(c) < road.trimEnd) continue;
              const g = new THREE.PlaneGeometry(bayLen, bayW);
              g.rotateX(-Math.PI / 2); g.rotateY(yaw); g.translate(c.x, ROAD_Y + 0.006, c.y);
              bayGeoms.push(g);
              for (const t of [-2.75, 2.75]) {
                if (r() < 0.32) continue;
                const p = c.clone().add(d.clone().multiplyScalar(t));
                parkSpots.push({ x: p.x, z: p.y, yaw: Math.atan2(d.x, d.y) + (sgn < 0 ? Math.PI : 0) });
              }
            }
          }
        }
      }
    }
    i++;
  }
  if (bayGeoms.length) scene.add(new THREE.Mesh(mergeGeoms(bayGeoms), MAT.klinker));
  const walk = new THREE.Mesh(mergeGeoms(walkGeoms), MAT.tiles); walk.receiveShadow = true; scene.add(walk);
  scene.add(new THREE.Mesh(mergeGeoms(curbGeoms), MAT.curb));

  // Rode-klinkerplateaus op de hoofdkruispunten en zebra bij Molenkrite
  const plateau = (px, py, s) => {
    const [x, z] = toWorld(px, py);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), MAT.rood);
    m.rotation.x = -Math.PI / 2; m.position.set(x, ROAD_Y + 0.06, z); scene.add(m);
  };
  plateau(375, 1252, 11); plateau(243, 935, 9); plateau(305, 1460, 9); plateau(600, 1750, 9);
  const zebraMat = new THREE.MeshBasicMaterial({ map: T.zebra(), transparent: true });
  const zb = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.6), zebraMat);
  const [zx, zz] = toWorld(410, 1215); zb.rotation.x = -Math.PI / 2; zb.rotation.z = -0.7; zb.position.set(zx, ROAD_Y + 0.07, zz); scene.add(zb);

  // N7 snelweg met berm en geluidsscherm
  const hp = HIGHWAY.pts.map(vec);
  const hw = new THREE.Mesh(ribbon(hp, HIGHWAY.w, ROAD_Y + 0.5, 0, 0.3), MAT.snelweg); scene.add(hw);
  const emb = new THREE.Mesh(ribbon(hp, HIGHWAY.w + 14, 0.02, 0, 0.1), MAT.grass); scene.add(emb);
  // wegmarkering
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
  for (const off of [-8.2, -4.2, 0.3, 4.2, 8.2]) {
    const l = new THREE.Mesh(ribbon(hp, 0.15, ROAD_Y + 0.52, off, 1), lineMat); scene.add(l);
  }
  const barrier = new THREE.Mesh(ribbon(hp, 0.4, 0.5, -(HIGHWAY.w / 2 + 2), 1), MAT.barrier);
  barrier.geometry.translate(0, 0, 0);
  // maak van het scherm een wand: extrude simpel via BoxGeometry per segment
  for (let k = 0; k < hp.length - 1; k++) {
    const a = hp[k], b = hp[k + 1]; const d = b.clone().sub(a); const len = d.length(); d.normalize();
    const nrm = new THREE.Vector2(-d.y, d.x).multiplyScalar(-(HIGHWAY.w / 2 + 3));
    const c = a.clone().add(b).multiplyScalar(0.5).add(nrm);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(len, 3.5, 0.3), MAT.barrier);
    wall.position.set(c.x, 1.75 + 0.5, c.y); wall.rotation.y = -Math.atan2(d.y, d.x); wall.castShadow = true; scene.add(wall);
    addCollider(c.x, c.y, len / 2, 0.15, -Math.atan2(d.y, d.x), 4);
  }
  for (const s of HIGHWAY.pts.map(vec)) { for (let k = 0; k < 6; k++) roadSegments.push({ name: 'N7', a: [s.x, s.y], b: [s.x, s.y], w: 0, drive: false }); }
}

// ---------- Water, bos, gras ----------
function buildNature(scene) {
  const groundTex = T.grass().clone(); groundTex.needsUpdate = true; groundTex.repeat.set(300, 300);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);

  for (const poly of WATER) {
    const pts = poly.map(vec);
    const w = new THREE.Mesh(polygonGeom(pts, 0.04, 0.3), MAT.water); scene.add(w);
  }
  for (const ww of WATERWAYS) {
    const pts = ww._pts || ww.pts.map(vec);
    scene.add(new THREE.Mesh(ribbon(pts, ww.w, 0.04, 0, 0.25), MAT.water));
    // smalle, donkere oeverrand langs beide zijden
    for (const off of [ww.w / 2 + 0.35, -(ww.w / 2 + 0.35)]) {
      scene.add(new THREE.Mesh(ribbon(pts, 0.7, 0.045, off, 0.5), MAT.bank));
    }
  }
  for (const poly of GRASS) { /* gras is standaard */ }

  // bomen in bosschages
  const r = rng(77);
  for (const entry of WOODS) {
    // een bosschage is een lijst punten, of { poly, dens } voor dichter bos
    const pts = woodPoly(entry).map(vec);
    const bb = new THREE.Box2().setFromPoints(pts);
    const area = (bb.max.x - bb.min.x) * (bb.max.y - bb.min.y);
    const count = Math.floor(area / (entry.dens || 140));
    for (let i = 0; i < count; i++) {
      const p = new THREE.Vector2(bb.min.x + r() * (bb.max.x - bb.min.x), bb.min.y + r() * (bb.max.y - bb.min.y));
      if (pointInPoly(p, pts) && !nearRoad(p, 4) && !inWater(p)) treePositions.push({ x: p.x, z: p.y, s: 0.8 + r() * 0.7 });
    }
  }
  // straatbomen langs wegen met grasstrook (om de ~14 m, aan de stoepzijde)
  for (const road of ROADS) {
    if (road.type === 'pad' || road.type === 'fietspad' || road.name === 'Buitenroede' || road.name === 'Afrit 21') continue;
    const pts = road.pts.map(vec);
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1]; const d = b.clone().sub(a); const len = d.length(); d.normalize();
      const nrm = new THREE.Vector2(d.y, -d.x);
      const vgL = road.vergeL != null ? road.vergeL : (road.verge || 0);
      const vgR = road.vergeR != null ? road.vergeR : (road.verge || 0);
      if (Math.max(vgL, vgR) < 1.6) continue;
      for (let s = 6; s < len - 4; s += 13.5) {
        for (const side of [1, -1]) {
          const vg = side > 0 ? vgL : vgR;
          if (vg < 1.6 || r() < 0.42) continue;
          const p = a.clone().add(d.clone().multiplyScalar(s)).add(nrm.clone().multiplyScalar(side * (road.w / 2 + vg * 0.55)));
          if (!nearBuilding(p, 2.5) && !inWater(p) && !nearParkBay(p, 2.0)) treePositions.push({ x: p.x, z: p.y, s: 0.95 + r() * 0.5 });
        }
      }
    }
  }
}

function pointInPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
const waterPolys = [];
const parkPolys = [];
const woodPolys = [];
function inPark(p) { return parkPolys.some(poly => pointInPoly(p, poly)); }
// In een bosschage staan bomen, geen huizen. Dat houdt ook de automatische
// verdichting uit stroken groen zoals de berm langs De Wieken.
function inWoods(p) { return woodPolys.some(poly => pointInPoly(p, poly)); }
const woodPoly = entry => (Array.isArray(entry) ? entry : entry.poly);
function inWater(p) { return waterPolys.some(poly => pointInPoly(p, poly)); }
export function nearRoad(p, margin) {
  for (const s of roadSegments) {
    if (s.w === 0) continue;
    const d = distToSeg(p.x, p.y, s.a[0], s.a[1], s.b[0], s.b[1]);
    if (d < s.w / 2 + margin) return true;
  }
  return false;
}
function nearParkBay(p, margin) {
  for (const s of parkSpots) { if (Math.hypot(p.x - s.x, p.y - s.z) < margin + 2.6) return true; }
  return false;
}
function nearBuilding(p, margin) {
  for (const u of units) { if (pointInUnit(p.x, p.y, u, margin + 6)) return true; }
  for (const c of colliders) {
    const dx = p.x - c.cx, dz = p.y - c.cz;
    const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
    if (Math.abs(lx) < c.hx + margin && Math.abs(lz) < c.hz + margin) return true;
  }
  return false;
}
export function distToSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az; const l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = Math.max(0, Math.min(1, t));
  const x = ax + t * dx, z = az + t * dz;
  return Math.hypot(px - x, pz - z);
}

export function addCollider(cx, cz, hx, hz, yaw, h = 8) {
  colliders.push({ cx, cz, hx, hz, cos: Math.cos(yaw), sin: Math.sin(yaw), h });
}

// ---------- Huizen ----------
function gableRoof(w, d, h, mat, overhang = 0.35) {
  // dak met nok evenwijdig aan de lange zijde (x = lengte, z = diepte)
  const W = w + overhang * 2, D = d + overhang * 2;
  const g = new THREE.BufferGeometry();
  const hw = W / 2, hd = D / 2;
  const pos = [
    // voorzijde (z = +hd) schuine vlak
    -hw, 0, hd, hw, 0, hd, hw, h, 0,
    -hw, 0, hd, hw, h, 0, -hw, h, 0,
    // achterzijde
    hw, 0, -hd, -hw, 0, -hd, -hw, h, 0,
    hw, 0, -hd, -hw, h, 0, hw, h, 0,
  ];
  const slope = Math.hypot(hd, h);
  const uv = [0, 0, W / 2, 0, W / 2, slope / 2, 0, 0, W / 2, slope / 2, 0, slope / 2,
    0, 0, W / 2, 0, W / 2, slope / 2, 0, 0, W / 2, slope / 2, 0, slope / 2];
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  const roof = new THREE.Mesh(g, mat);
  // topgevels (driehoeken) in baksteen worden door de rij zelf afgedekt met een box-eind
  return roof;
}

// Geplaatste woonblokken (georiënteerde rechthoeken) voor onderlinge controle
const units = [];
function pointInUnit(px, pz, u, margin) {
  const dx = px - u.cx, dz = pz - u.cz;
  // inverse van een rotatie om Y met hoek rotY: x_l = x cos - z sin ; z_l = x sin + z cos
  const lx = dx * u.cos - dz * u.sin, lz = dx * u.sin + dz * u.cos;
  return Math.abs(lx) < u.hx + margin && Math.abs(lz) < u.hz + margin;
}
function roadClearance(px, pz) {
  let best = 1e9;
  for (const sgm of roadSegments) {
    if (sgm.w === 0) continue;
    const d = distToSeg(px, pz, sgm.a[0], sgm.a[1], sgm.b[0], sgm.b[1]) - sgm.corr;
    if (d < best) best = d;
  }
  return best;
}
// Ruimte tot aan de rijbaan-as van de dichtstbijzijnde weg (voor de diepte van de voortuin)
function distToNearestRoadEdge(px, pz) {
  let best = 1e9;
  for (const sgm of roadSegments) {
    if (sgm.w === 0 || !sgm.drive) continue;
    const d = distToSeg(px, pz, sgm.a[0], sgm.a[1], sgm.b[0], sgm.b[1]) - sgm.corr;
    if (d < best) best = d;
  }
  return best;
}
function blocked(px, pz, margin, skipUnit = null) {
  if (roadClearance(px, pz) < margin) return true;
  const v = new THREE.Vector2(px, pz);
  if (inWater(v) || inPark(v) || inWoods(v)) return true;
  for (const u of units) { if (u !== skipUnit && pointInUnit(px, pz, u, margin)) return true; }
  return false;
}

const rowBuilds = [];

// Verspringende rooilijn. In Tinga loopt een lange rij niet in één rechte
// lijn: na zes à zeven woningen springt het blok een paar meter naar achteren
// en daarna weer naar voren. Een rij met { stagger: { houses, step } } wordt
// hier opgeknipt in blokken met om en om een grotere afstand tot de weg.
function expandStagger(row) {
  if (!row.stagger) return [row];
  const st = T.HOUSE_STYLES[row.type];
  const [ax, ay] = row.a, [bx, by] = row.b;
  const lenM = Math.hypot(bx - ax, by - ay) / PX_PER_M;
  const per = (row.stagger.houses || 7) * st.w;
  const n = Math.max(1, Math.round(lenM / per));
  if (n < 2) return [row];
  const sign = row.off < 0 ? -1 : 1;
  const out = [];
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    out.push({
      ...row,
      a: [ax + (bx - ax) * t0, ay + (by - ay) * t0],
      b: [ax + (bx - ax) * t1, ay + (by - ay) * t1],
      off: sign * (Math.abs(row.off) + (i % 2 ? (row.stagger.step || 2.2) : 0)),
      stagger: null,
      contiguous: true,   // vult het hele stuk, dus geen gat tussen de blokken
    });
  }
  return out;
}

// Fase 1: bepaal per rij welke woningen passen en bouw de gebouwen
function buildRow(scene, row, idx) {
  const st = T.HOUSE_STYLES[row.type];
  const a = vec(row.a), b = vec(row.b);
  const d = b.clone().sub(a); const len0 = d.length(); d.normalize();
  const left = new THREE.Vector2(d.y, -d.x);
  const side = row.off < 0 ? -1 : 1;
  const nrm = left.clone().multiplyScalar(side);
  const flip = !!row.flip;
  const storeys = row.storeys || st.storeys;
  const depth = row.depth;
  const front = a.clone().add(b).multiplyScalar(0.5).add(nrm.clone().multiplyScalar(Math.abs(row.off)));
  const center = front.clone().add(nrm.clone().multiplyScalar(flip ? -depth / 2 : depth / 2));
  const faceDir = flip ? nrm.clone() : nrm.clone().multiplyScalar(-1);
  const yaw = Math.atan2(faceDir.y, faceDir.x);
  const rotY = Math.PI / 2 - yaw;
  const dLocal = new THREE.Vector2(Math.cos(rotY), -Math.sin(rotY));
  const facadeH = storeys * 2.9;
  // Bij bungalows zit de woonruimte in de kap: een lage gevel krijgt een hoger dak.
  const roofH = st.roofType === 'gable'
    ? (storeys === 1 ? Math.min(4.6, depth * 0.55) : Math.min(4.2, depth * 0.5))
    : (st.roofType === 'low' ? 1.6 : 0);

  // kandidaat-woningen langs de rij
  let cand = [];
  if (st.detached) {
    const n = Math.max(1, Math.round(len0 / 18)); const gap = len0 / n;
    for (let i = 0; i < n; i++) cand.push({ cx: -len0 / 2 + gap * (i + 0.5), w: st.w, n: 1 });
  } else if (st.semi) {
    const pairs = Math.max(1, Math.round(len0 / 17)); const gap = len0 / pairs;
    for (let i = 0; i < pairs; i++) cand.push({ cx: -len0 / 2 + gap * (i + 0.5), w: st.w * 2, n: 2 });
  } else if (row.contiguous) {
    // Een blok van een verspringende rooilijn loopt door tot de blokgrens; de
    // woningbreedte wordt iets bijgesteld zodat het stuk precies volloopt.
    const n = Math.max(1, Math.round(len0 / st.w));
    const w2 = len0 / n;
    for (let i = 0; i < n; i++) cand.push({ cx: -len0 / 2 + w2 * (i + 0.5), w: w2, n: 1 });
  } else {
    const n = Math.max(1, Math.round(len0 * 0.86 / st.w));
    for (let i = 0; i < n; i++) cand.push({ cx: -n * st.w / 2 + st.w * (i + 0.5), w: st.w, n: 1 });
  }
  const toWorldLocal = (lx, lz) => new THREE.Vector2(center.x + dLocal.x * lx + faceDir.x * lz, center.y + dLocal.y * lx + faceDir.y * lz);
  const why = (px, pz, margin) => {
    let best = null, bd = 1e9;
    for (const sgm of roadSegments) { if (sgm.w === 0) continue; const d = distToSeg(px, pz, sgm.a[0], sgm.a[1], sgm.b[0], sgm.b[1]) - sgm.corr; if (d < bd) { bd = d; best = sgm.name; } }
    if (bd < margin) return `weg ${best} (${bd.toFixed(1)} m)`;
    const vv = new THREE.Vector2(px, pz);
    if (inWater(vv)) return 'water';
    if (inPark(vv)) return 'parkje';
    const u = units.find(u => pointInUnit(px, pz, u, margin)); if (u) return `woning rij ${u.rowIdx}`;
    return 'stoep';
  };
  const fits = (c) => {
    for (const [fx, fz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) {
      const p = toWorldLocal(c.cx + fx * (c.w / 2 - 0.35), fz * (depth / 2 - 0.35));
      if (blocked(p.x, p.y, 0.25)) { if (row.debug) console.warn(`  rij ${idx} unit ${c.cx.toFixed(1)}: ${why(p.x, p.y, 0.25)}`); return false; }
    }
    const step = toWorldLocal(c.cx, depth / 2 + 1.2); // stoep voor de deur mag niet in de weg liggen
    if (roadClearance(step.x, step.y) < -0.5) { if (row.debug) console.warn(`  rij ${idx} unit ${c.cx.toFixed(1)}: stoep in weg`); return false; }
    return true;
  };
  cand = cand.map(c => ({ ...c, ok: fits(c) }));
  // opeenvolgende passende woningen bundelen tot bouwblokken
  const runs = [];
  let cur = null;
  for (const c of cand) {
    if (!c.ok) { cur = null; continue; }
    if (cur && Math.abs((cur.cx + cur.len / 2) - (c.cx - c.w / 2)) < 0.05) { cur.len += c.w; cur.cx = cur.x0 + cur.len / 2; cur.n += c.n; }
    else { cur = { x0: c.cx - c.w / 2, cx: c.cx, len: c.w, n: c.n }; runs.push(cur); }
  }
  const dropped = cand.filter(c => !c.ok).length;
  if (dropped > 0 && !row.generated) console.warn(`rij ${idx} ${row.type} [${row.a}]-[${row.b}] off ${row.off}: ${dropped}/${cand.length} woningen weggelaten (botsing)`);
  if (runs.length === 0) return;
  // registreer de blokken (voor latere controles)
  for (const run of runs) {
    const wc = toWorldLocal(run.cx, 0);
    run.unit = { cx: wc.x, cz: wc.y, hx: run.len / 2, hz: depth / 2, cos: Math.cos(rotY), sin: Math.sin(rotY), rowIdx: idx };
    units.push(run.unit);
  }

  const group = new THREE.Group();
  group.position.set(center.x, 0, center.y);
  group.rotation.y = rotY;

  const placeUnit = (cx, unitLen, unitN, seed) => {
    const frontTex = T.facade(row.type, unitN, storeys, false, seed);
    const backTex = T.facade(row.type, unitN, storeys, true, seed);
    const brickTex = st.plaster ? T.plaster(st.brick[0]) : T.brick(st.brick[0], st.brick[1], seed);
    const sideMat = new THREE.MeshStandardMaterial({ map: brickTex.clone(), roughness: 0.95 });
    sideMat.map.needsUpdate = true; sideMat.map.repeat.set(depth / 2.6, facadeH / 2.6);
    const fm = new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.9 });
    const bm = new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.9 });
    const top = new THREE.MeshStandardMaterial({ map: T.bitumen(), roughness: 1 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(unitLen, facadeH, depth), [sideMat, sideMat, top, sideMat, fm, bm]);
    body.position.set(cx, facadeH / 2, 0);
    body.castShadow = true; body.receiveShadow = true;
    group.add(body);

    if (st.roofType === 'gable' || st.roofType === 'low') {
      const rh = st.roofType === 'low' ? 1.6 : roofH;
      const roofMat = new THREE.MeshStandardMaterial({ map: T.roofTiles(st.roof), roughness: 0.9 });
      const roof = gableRoof(unitLen, depth, rh, roofMat);
      // het dakvlak loopt door over het overstek; laat het zakken zodat de dakrand
      // precies op de muur landt in plaats van er 30 cm boven te zweven
      const OV = 0.35;
      const eaveDrop = rh * OV / (depth / 2 + OV);
      roof.position.set(cx, facadeH - eaveDrop, 0); roof.castShadow = true;
      group.add(roof);
      // boeiboord met goot langs beide dakranden
      for (const sgn of [1, -1]) {
        const fascia = new THREE.Mesh(new THREE.BoxGeometry(unitLen + OV * 2, 0.22, 0.10), MAT.white);
        fascia.position.set(cx, facadeH - eaveDrop - 0.06, sgn * (depth / 2 + OV));
        group.add(fascia);
        const gutter = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, unitLen + OV * 2, 6), MAT.gutter);
        gutter.rotation.z = Math.PI / 2;
        gutter.position.set(cx, facadeH - eaveDrop - 0.20, sgn * (depth / 2 + OV + 0.04));
        group.add(gutter);
      }
      // regenpijpen op de scheiding tussen de woningen
      const pipes = [];
      for (let i = 0; i <= unitN; i++) {
        const hx = cx - unitLen / 2 + (unitLen / unitN) * i;
        const pg = new THREE.CylinderGeometry(0.045, 0.045, facadeH - eaveDrop - 0.2, 6);
        pg.translate(hx, (facadeH - eaveDrop - 0.2) / 2, depth / 2 + 0.06);
        pipes.push(pg);
      }
      group.add(new THREE.Mesh(mergeGeoms(pipes), MAT.gutter));
      const triShape = new THREE.Shape(); triShape.moveTo(-depth / 2, 0); triShape.lineTo(depth / 2, 0); triShape.lineTo(0, rh); triShape.closePath();
      const tri = new THREE.ShapeGeometry(triShape);
      for (const sgn of [-1, 1]) {
        const tm = new THREE.Mesh(tri, sideMat);
        tm.rotation.y = sgn * Math.PI / 2; tm.position.set(cx + sgn * (unitLen / 2 - 0.01), facadeH - eaveDrop, 0);
        group.add(tm);
      }
      if (st.dormer) {
        const perHouse = unitLen / unitN;
        const bodies = [], fronts = [];
        for (let i = 0; i < unitN; i++) {
          const hx = cx - unitLen / 2 + perHouse * (i + 0.5);
          const dw = st.dormerBand ? perHouse * 0.9 : Math.min(2.6, perHouse * 0.55);
          const dh = 1.35, dd = 1.6;
          const z = depth / 2 + 0.35 - dd / 2 - 0.9;
          const yBase = facadeH - eaveDrop + (rh / (depth / 2 + 0.35)) * (depth / 2 + 0.35 - (z + dd / 2));
          const bg = new THREE.BoxGeometry(dw, dh, dd);
          bg.translate(hx, yBase + dh / 2 + 0.2, z + 0.5);
          bodies.push(bg);
          const fg = new THREE.PlaneGeometry(dw * 0.98, dh * 0.98);
          fg.translate(hx, yBase + dh / 2 + 0.2, z + 0.5 + dd / 2 + 0.01);
          fronts.push(fg);
        }
        group.add(new THREE.Mesh(mergeGeoms(bodies), MAT.white));
        group.add(new THREE.Mesh(mergeGeoms(fronts), new THREE.MeshStandardMaterial({ map: T.dormerFront(st.frame2), roughness: 0.6 })));
      }
      if (st.skylight) {
        const perHouse = unitLen / unitN;
        const ang = Math.atan2(rh, depth / 2 + OV);
        const frames = [], glasses = [];
        for (let i = 0; i < unitN; i++) {
          const hx = cx - unitLen / 2 + perHouse * (i + 0.5);
          const zRel = (depth / 2 + OV) * (st.solarFull ? 0.24 : 0.45);
          const y = facadeH - eaveDrop + rh * (1 - zRel / (depth / 2 + OV));
          const fg = new THREE.PlaneGeometry(1.0, 1.15);
          fg.rotateX(-Math.PI / 2 + ang); fg.translate(hx, y + 0.05, zRel); frames.push(fg);
          const gg = new THREE.PlaneGeometry(0.82, 0.95);
          gg.rotateX(-Math.PI / 2 + ang); gg.translate(hx, y + 0.09, zRel); glasses.push(gg);
        }
        group.add(new THREE.Mesh(mergeGeoms(frames), MAT.white));
        group.add(new THREE.Mesh(mergeGeoms(glasses), MAT.glassDark));
      }
      if (st.solar) {
        const perHouse = unitLen / unitN;
        const ang = Math.atan2(rh, depth / 2 + OV);
        const panels = [];
        for (let i = 0; i < unitN; i++) {
          if (!st.solarFull && (i + seed) % 2) continue;
          const hx = cx - unitLen / 2 + perHouse * (i + 0.5);
          // Bij een vol zonnedak liggen de panelen op het voorste dakvlak, naast
          // de dakramen; anders een kleiner veld op het achterdakvlak.
          const pw = st.solarFull ? perHouse * 0.92 : perHouse * 0.7;
          const pd = st.solarFull ? (depth / 2 + OV) * 0.62 : 1.9;
          const zRel = st.solarFull ? (depth / 2 + OV) * 0.60 : -(depth / 2 + OV) * 0.5;
          const y = facadeH - eaveDrop + rh * (1 - Math.abs(zRel) / (depth / 2 + OV));
          const pg = new THREE.PlaneGeometry(pw, pd);
          pg.rotateX(-Math.PI / 2 + (zRel > 0 ? ang : -ang));
          pg.translate(hx, y + 0.07, zRel);
          panels.push(pg);
        }
        if (panels.length) group.add(new THREE.Mesh(mergeGeoms(panels), MAT.solar));
      }
      if (st.chimney) {
        const perHouse = unitLen / unitN; const chims = [];
        for (let i = 0; i < unitN; i++) {
          const hx = cx - unitLen / 2 + perHouse * (i + 0.5) + perHouse * 0.45;
          const cg = new THREE.BoxGeometry(0.5, 1.1, 0.5); cg.translate(hx, facadeH - eaveDrop + rh + 0.25, 0.3); chims.push(cg);
        }
        group.add(new THREE.Mesh(mergeGeoms(chims), sideMat));
      }
      if (st.gallery) {
        const floor = new THREE.Mesh(new THREE.BoxGeometry(unitLen, 0.14, 1.35), MAT.white);
        floor.position.set(cx, 2.9, depth / 2 + 0.68); group.add(floor);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(unitLen, 0.95, 0.05), MAT.railing);
        rail.position.set(cx, 3.45, depth / 2 + 1.33); group.add(rail);
        const posts = [];
        for (let i = 0; i <= unitN; i++) {
          const hx = cx - unitLen / 2 + (unitLen / unitN) * i;
          const pg = new THREE.CylinderGeometry(0.05, 0.05, 2.9, 6); pg.translate(hx, 1.45, depth / 2 + 1.3); posts.push(pg);
        }
        group.add(new THREE.Mesh(mergeGeoms(posts), MAT.railing));
      }
    } else {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(unitLen + 0.2, 0.3, depth + 0.2), MAT.dark);
      edge.position.set(cx, facadeH + 0.1, 0); group.add(edge);
      if (st.balcony) {
        for (let s = 1; s < storeys; s++) {
          const bal = new THREE.Mesh(new THREE.BoxGeometry(unitLen * 0.9, 0.15, 1.3), new THREE.MeshStandardMaterial({ color: 0xa0a5ab }));
          bal.position.set(cx, s * 2.9 + 0.05, depth / 2 + 0.65); group.add(bal);
          const rail = new THREE.Mesh(new THREE.BoxGeometry(unitLen * 0.9, 1.0, 0.05), new THREE.MeshStandardMaterial({ color: 0xd8dde3, transparent: true, opacity: 0.6 }));
          rail.position.set(cx, s * 2.9 + 0.6, depth / 2 + 1.3); group.add(rail);
        }
      }
    }
    const wc = toWorldLocal(cx, 0);
    addCollider(wc.x, wc.y, unitLen / 2, depth / 2, rotY, facadeH + roofH);
  };

  runs.forEach((run, k) => placeUnit(run.cx, run.len, run.n, idx * 5 + k));
  if (row.label) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.1), new THREE.MeshBasicMaterial({ map: T.streetSign(row.label) }));
    sign.position.set(runs[0].cx, facadeH - 0.9, depth / 2 + 0.02); group.add(sign);
  }
  scene.add(group);
  rowBuilds.push({ row, st, runs, group, depth, toWorldLocal, facadeH });
}

// Fase 2: tuinen. Elke woning krijgt een eigen voortuintje: het ene met een lage
// heg, het andere met een houten kruishekje, een conifeer of gewoon gras met
// wat struiken. De diepte volgt de werkelijk beschikbare ruimte tot het trottoir.
function buildGardens() {
  for (const rb of rowBuilds) {
    const { row, st, runs, group, depth, toWorldLocal } = rb;
    for (const run of runs) {
      let backAvail = 9.5;
      for (let x = run.cx - run.len / 2 + 1; x <= run.cx + run.len / 2 - 1; x += 2.5) {
        for (let k = 0.8; k <= 9.5; k += 0.5) {
          const p = toWorldLocal(x, -depth / 2 - k);
          if (blocked(p.x, p.y, 0.3, run.unit)) { backAvail = Math.min(backAvail, k - 0.6); break; }
        }
      }
      let frontAvail = 5.4;
      for (let x = run.cx - run.len / 2 + 1; x <= run.cx + run.len / 2 - 1; x += 2.5) {
        for (let k = 0.6; k <= 5.6; k += 0.4) {
          const p = toWorldLocal(x, depth / 2 + k);
          if (blocked(p.x, p.y, 0.2, run.unit)) { frontAvail = Math.min(frontAvail, k - 0.6); break; }
        }
      }

      // ---------- voortuinen, per woning een eigen inrichting ----------
      if (row.type !== 'spil' && row.type !== 'appart' && frontAvail >= 1.3) {
        const r = rng(Math.round(Math.abs(run.unit.cx) * 31 + Math.abs(run.unit.cz) * 17) + 1);
        const buckets = { tiles: [], picket: [], hedge: [], hedgeRed: [], conifer: [], shrubA: [], shrubB: [], shrubC: [], gravel: [], bench: [], trunk: [], leaf: [] };
        const w = run.len / run.n;
        const z0 = depth / 2;                     // gevellijn
        const zEdge = z0 + frontAvail;            // erfgrens tegen het trottoir
        for (let i = 0; i < run.n; i++) {
          const hx = run.cx - run.len / 2 + w * (i + 0.5);
          const style = Math.floor(r() * 5);
          const doorLeft = (i % 2) === 0;
          const doorX = hx + (doorLeft ? -w * 0.28 : w * 0.28);
          // tegelpad van het trottoir naar de voordeur
          const pathW = 1.0;
          const pg = new THREE.BoxGeometry(pathW, 0.04, frontAvail);
          pg.translate(doorX, 0.03, z0 + frontAvail / 2); buckets.tiles.push(pg);
          // stoepje bij de deur
          const st2 = new THREE.BoxGeometry(1.5, 0.10, 0.7); st2.translate(doorX, 0.05, z0 + 0.4); buckets.tiles.push(st2);

          // erfafscheiding langs het trottoir, met een opening bij het pad
          const gapA = doorX - pathW / 2 - hx, gapB = doorX + pathW / 2 - hx;
          const segs = [[-w / 2 + 0.05, gapA], [gapB, w / 2 - 0.05]];
          for (const [a, b] of segs) {
            const segLen = b - a; if (segLen < 0.4) continue;
            const cx2 = hx + (a + b) / 2;
            if (style === 1) {           // houten kruishekje
              const rail = new THREE.BoxGeometry(segLen, 0.06, 0.05);
              rail.translate(cx2, 0.42, zEdge); buckets.picket.push(rail);
              for (let t = a + 0.2; t < b; t += 0.42) {
                const sl = new THREE.BoxGeometry(0.05, 0.5, 0.05); sl.translate(hx + t, 0.25, zEdge); buckets.picket.push(sl);
              }
            } else if (style === 2) {    // rode berberishaag
              const h = new THREE.BoxGeometry(segLen, 0.55, 0.45); h.translate(cx2, 0.28, zEdge); buckets.hedgeRed.push(h);
            } else if (style === 3) {    // open gazon, alleen een lage rand
              const h = new THREE.BoxGeometry(segLen, 0.12, 0.25); h.translate(cx2, 0.06, zEdge); buckets.picket.push(h);
            } else {                     // groene ligusterhaag
              const h = new THREE.BoxGeometry(segLen, 0.72 + r() * 0.18, 0.5); h.translate(cx2, 0.36, zEdge); buckets.hedge.push(h);
            }
          }
          if (frontAvail < 2.0) continue;
          // beplanting in de voortuin
          const side = doorLeft ? 1 : -1;
          if (style === 4) {             // conifeer naast de deur
            const c = new THREE.ConeGeometry(0.42, 2.1, 7);
            c.translate(doorX + side * 1.1, 1.05, z0 + Math.min(1.2, frontAvail - 0.6)); buckets.conifer.push(c);
          }
          const nShrub = 1 + Math.floor(r() * 3);
          for (let k = 0; k < nShrub; k++) {
            const sx = hx + (r() - 0.5) * (w - 1.4);
            const sz = z0 + 0.8 + r() * Math.max(0.4, frontAvail - 1.6);
            if (Math.abs(sx - doorX) < 0.8) continue;
            const rad = 0.32 + r() * 0.32;
            const g = new THREE.SphereGeometry(rad, 6, 5);
            g.scale(1, 0.75 + r() * 0.4, 1);
            g.translate(sx, rad * 0.8, sz);
            const b = r();
            (b < 0.45 ? buckets.shrubA : b < 0.8 ? buckets.shrubB : buckets.shrubC).push(g);
          }
          if (r() < 0.16 && frontAvail > 3.0) {   // sierboompje
            const tx = hx + (r() - 0.5) * (w - 2.0);
            const tz = z0 + frontAvail * 0.55;
            const tr = new THREE.CylinderGeometry(0.07, 0.09, 2.2, 5); tr.translate(tx, 1.1, tz); buckets.trunk.push(tr);
            const lf = new THREE.SphereGeometry(0.85, 7, 6); lf.scale(1, 0.85, 1); lf.translate(tx, 2.5, tz); buckets.leaf.push(lf);
          }
          if (r() < 0.12 && frontAvail > 2.6) {   // bankje tegen de gevel
            const bb = new THREE.BoxGeometry(1.4, 0.09, 0.42); bb.translate(hx + side * 1.2, 0.45, z0 + 0.75); buckets.bench.push(bb);
            for (const dx2 of [-0.55, 0.55]) { const lg = new THREE.BoxGeometry(0.09, 0.42, 0.09); lg.translate(hx + side * 1.2 + dx2, 0.21, z0 + 0.75); buckets.bench.push(lg); }
          }
          if (r() < 0.18 && frontAvail > 2.2) {   // grindvak
            const gv = new THREE.BoxGeometry(w * 0.5, 0.03, frontAvail * 0.5);
            gv.translate(hx - side * w * 0.2, 0.025, z0 + frontAvail * 0.5); buckets.gravel.push(gv);
          }
        }
        // fietsen tegen de gevel, plantenbakken, tuinornamenten en af en toe een
        // afgedekte boot op een trailer, zoals in de wijk voor de deur staat
        buckets.bike = []; buckets.tyre = []; buckets.pot = []; buckets.tarp = []; buckets.stone = [];
        for (let i = 0; i < run.n; i++) {
          const hx = run.cx - run.len / 2 + w * (i + 0.5);
          if (r() < 0.22 && frontAvail > 1.6) {          // fiets tegen de gevel
            const bx = hx + (r() - 0.5) * (w - 1.6), bz = z0 + 0.55;
            const ang = (r() - 0.5) * 0.5;
            for (const dz of [-0.52, 0.52]) {
              const wh = new THREE.TorusGeometry(0.34, 0.035, 6, 14);
              wh.rotateY(Math.PI / 2 + ang); wh.translate(bx + Math.sin(ang) * dz, 0.36, bz + Math.cos(ang) * dz);
              buckets.tyre.push(wh);
            }
            const bar = new THREE.BoxGeometry(0.05, 0.05, 1.0); bar.rotateY(ang); bar.translate(bx, 0.62, bz); buckets.bike.push(bar);
            const seat = new THREE.BoxGeometry(0.12, 0.06, 0.26); seat.rotateY(ang); seat.translate(bx - Math.sin(ang) * 0.3, 0.86, bz - Math.cos(ang) * 0.3); buckets.bike.push(seat);
            const stem = new THREE.BoxGeometry(0.05, 0.42, 0.05); stem.translate(bx + Math.sin(ang) * 0.38, 0.72, bz + Math.cos(ang) * 0.38); buckets.bike.push(stem);
            const hb = new THREE.BoxGeometry(0.48, 0.04, 0.04); hb.rotateY(ang); hb.translate(bx + Math.sin(ang) * 0.38, 0.94, bz + Math.cos(ang) * 0.38); buckets.bike.push(hb);
          }
          if (r() < 0.3 && frontAvail > 1.2) {           // plantenbakken naast de deur
            const px2 = hx + (r() < 0.5 ? -1 : 1) * (0.9 + r() * 0.6);
            const pg = new THREE.CylinderGeometry(0.19, 0.15, 0.32, 8); pg.translate(px2, 0.16, z0 + 0.5); buckets.pot.push(pg);
            const pl = new THREE.SphereGeometry(0.22, 6, 5); pl.scale(1, 0.8, 1); pl.translate(px2, 0.42, z0 + 0.5); buckets.shrubB.push(pl);
          }
          if (r() < 0.14 && frontAvail > 2.2) {          // tuinornament of siersteen
            const ox = hx + (r() - 0.5) * (w - 1.2), oz = z0 + 1.0 + r() * (frontAvail - 1.6);
            const og = new THREE.SphereGeometry(0.16 + r() * 0.1, 6, 5); og.scale(1, 1.4, 1); og.translate(ox, 0.18, oz); buckets.stone.push(og);
          }
        }
        if (r() < 0.10 && frontAvail > 3.2 && run.len > 10) {   // boot onder dekzeil op de oprit
          const bx = run.cx + (r() - 0.5) * (run.len - 6);
          const hull = new THREE.BoxGeometry(1.7, 0.55, 4.4); hull.translate(bx, 0.72, z0 + frontAvail * 0.55);
          buckets.tarp.push(hull);
          const cover = new THREE.BoxGeometry(1.5, 0.34, 4.0); cover.translate(bx, 1.14, z0 + frontAvail * 0.55);
          buckets.tarp.push(cover);
          for (const dz2 of [-1.3, 1.3]) {
            const wh = new THREE.CylinderGeometry(0.22, 0.22, 0.16, 8); wh.rotateZ(Math.PI / 2); wh.translate(bx + 0.85, 0.22, z0 + frontAvail * 0.55 + dz2); buckets.tyre.push(wh);
            const wh2 = new THREE.CylinderGeometry(0.22, 0.22, 0.16, 8); wh2.rotateZ(Math.PI / 2); wh2.translate(bx - 0.85, 0.22, z0 + frontAvail * 0.55 + dz2); buckets.tyre.push(wh2);
          }
        }
        const matOf = { tiles: MAT.tiles, picket: MAT.picket, hedge: MAT.hedge, hedgeRed: MAT.hedgeRed, conifer: MAT.conifer, shrubA: MAT.shrubA, shrubB: MAT.shrubB, shrubC: MAT.shrubC, gravel: MAT.gravel, bench: MAT.bench, trunk: MAT.trunk, leaf: MAT.leaf, bike: MAT.bikeFrame, tyre: MAT.tyre, pot: MAT.pot, tarp: MAT.tarp, stone: MAT.gravel };
        for (const key of Object.keys(buckets)) {
          if (!buckets[key].length) continue;
          const m = new THREE.Mesh(mergeGeoms(buckets[key]), matOf[key]);
          m.castShadow = true; m.receiveShadow = true; group.add(m);
        }
      }

      // ---------- achtertuinen ----------
      if (backAvail >= 1.8 && row.type !== 'spil') {
        // Staat de achterkant vlak langs een straat, dan hoort daar geen hoge
        // schutting maar een lage haag; anders kijk je vanaf de weg tegen een
        // blinde houten wand aan.
        let openToStreet = false;
        for (let x = run.cx - run.len / 2 + 1; x <= run.cx + run.len / 2 - 1; x += 3) {
          const p = toWorldLocal(x, -depth / 2 - backAvail - 1.2);
          if (roadClearance(p.x, p.y) < 1.2) { openToStreet = true; break; }
        }
        if (openToStreet) {
          const hm = new THREE.MeshStandardMaterial({ map: T.hedge().clone(), roughness: 1 });
          hm.map.needsUpdate = true; hm.map.repeat.set(run.len / 1.2, 1);
          const h = new THREE.Mesh(new THREE.BoxGeometry(run.len, 0.85, 0.5), hm);
          h.position.set(run.cx, 0.42, -depth / 2 - backAvail); h.castShadow = true;
          group.add(h);
        }
        const parts = [];
        if (!openToStreet) { const f = new THREE.BoxGeometry(run.len, 1.8, 0.08); f.translate(run.cx, 0.9, -depth / 2 - backAvail); parts.push(f); }
        for (const sgn of [-1, 1]) { const f2 = new THREE.BoxGeometry(0.08, 1.8, backAvail); f2.translate(run.cx + sgn * run.len / 2, 0.9, -depth / 2 - backAvail / 2); parts.push(f2); }
        if (backAvail >= 4.5 && !openToStreet) {
          const shedCount = Math.max(1, Math.round(run.len / 6));
          for (let i = 0; i < shedCount; i++) {
            const hx = run.cx - run.len / 2 + (run.len / shedCount) * (i + 0.5);
            const sg = new THREE.BoxGeometry(2.2, 2.2, 2.2); sg.translate(hx, 1.1, -depth / 2 - backAvail + 1.3); parts.push(sg);
          }
        }
        for (let i = 1; i < run.n; i++) {
          const hx = run.cx - run.len / 2 + (run.len / run.n) * i;
          const fp = new THREE.BoxGeometry(0.07, 1.8, backAvail); fp.translate(hx, 0.9, -depth / 2 - backAvail / 2); parts.push(fp);
        }
        const back = new THREE.Mesh(mergeGeoms(parts), MAT.fence); back.castShadow = true; group.add(back);
      }
    }
  }
}

// ---------- Parkjes: gras, slingerend tegelpad, bomen, struiken, bankjes ----------
function buildParks(scene) {
  for (const park of PARKS) {
    const poly = park.poly.map(vec);
    const lawn = new THREE.Mesh(polygonGeom(poly, 0.025, 0.35), MAT.parkGrass);
    lawn.receiveShadow = true; scene.add(lawn);
    // wandelpad
    const path = park.path.map(vec);
    const pw = 1.6;
    const pm = new THREE.Mesh(ribbon(path, pw, 0.05, 0, 0.8), MAT.tiles);
    pm.receiveShadow = true; scene.add(pm);
    for (let k = 0; k < path.length - 1; k++) {
      roadSegments.push({ name: park.name, a: [path[k].x, path[k].y], b: [path[k + 1].x, path[k + 1].y], w: pw, corr: pw / 2 + 0.4, walkOff: 0, drive: false });
    }
    // bankjes langs het pad
    for (const b of park.benches || []) {
      const [bx, bz] = toWorld(b[0], b[1]);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.09, 0.45), MAT.bench); seat.position.set(bx, 0.45, bz); seat.castShadow = true; scene.add(seat);
      const rest = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 0.08), MAT.bench); rest.position.set(bx, 0.72, bz - 0.2); scene.add(rest);
      for (const dx of [-0.7, 0.7]) { const lg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.1), MAT.bench); lg.position.set(bx + dx, 0.22, bz); scene.add(lg); }
      addCollider(bx, bz, 0.9, 0.3, 0, 1);
    }
    // rij grote bomen langs het pad (populieren aan het eind van De Wieken)
    if (park.treeLine) {
      const lp = park.treeLine.pts.map(vec);
      let acc = 0;
      for (let k = 0; k < lp.length - 1; k++) {
        const a = lp[k], b = lp[k + 1]; const len = a.distanceTo(b); const d = b.clone().sub(a).normalize();
        for (let sPos = acc; sPos < len; sPos += park.treeLine.spacing) {
          const p = a.clone().add(d.clone().multiplyScalar(sPos));
          treePositions.push({ x: p.x, z: p.y, s: park.treeLine.scale, tall: true });
        }
        acc = (acc - len) % park.treeLine.spacing; if (acc < 0) acc += park.treeLine.spacing;
      }
    }
    // bomen en struiken verspreid over het gras, niet op het pad of in het water
    const r = rng(park.name.length * 991 + poly.length * 7);
    const bb = new THREE.Box2().setFromPoints(poly);
    const onPath = (p) => { for (let k = 0; k < path.length - 1; k++) if (distToSeg(p.x, p.y, path[k].x, path[k].y, path[k + 1].x, path[k + 1].y) < 2.6) return true; return false; };
    let placedT = 0, placedS = 0, guard = 0;
    const shrubs = [];
    while ((placedT < (park.trees || 0) || placedS < (park.shrubs || 0)) && guard++ < 4000) {
      const p = new THREE.Vector2(bb.min.x + r() * (bb.max.x - bb.min.x), bb.min.y + r() * (bb.max.y - bb.min.y));
      if (!pointInPoly(p, poly) || inWater(p) || onPath(p) || nearBuilding(p, 3)) continue;
      if (placedT < (park.trees || 0) && r() < 0.55) {
        if (nearRoad(p, 2.0)) continue;
        treePositions.push({ x: p.x, z: p.y, s: 1.0 + r() * 0.7 }); placedT++;
      } else if (placedS < (park.shrubs || 0)) {
        const rad = 0.6 + r() * 0.9;
        const g = new THREE.SphereGeometry(rad, 7, 5); g.scale(1.2, 0.7, 1.2); g.translate(p.x, rad * 0.62, p.y);
        shrubs.push(g); placedS++;
      }
    }
    if (shrubs.length) { const m = new THREE.Mesh(mergeGeoms(shrubs), MAT.shrubA); m.castShadow = true; scene.add(m); }
  }
}

// ---------- Riet en oeverbegroeiing langs het water ----------
function buildReeds(scene) {
  const tufts = [];
  const r = rng(4242);
  for (const poly of waterPolys) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const len = a.distanceTo(b); if (len < 2) continue;
      const d = b.clone().sub(a).normalize();
      const nrm = new THREE.Vector2(d.y, -d.x);
      for (let sPos = 0.4; sPos < len; sPos += 1.6) {
        if (r() < 0.55) continue;
        const p = a.clone().add(d.clone().multiplyScalar(sPos)).add(nrm.clone().multiplyScalar((r() - 0.5) * 1.0));
        if (nearBuilding(p, 1.0)) continue;
        const h = 0.4 + r() * 0.35, rad = 0.22 + r() * 0.18;
        const g = new THREE.SphereGeometry(rad, 6, 4);
        g.scale(1.0 + r() * 0.5, h / rad * 0.75, 1.0 + r() * 0.5);
        g.rotateY(r() * 3.14);
        g.translate(p.x, h * 0.42, p.y);
        tufts.push(g);
      }
    }
  }
  if (tufts.length) { const m = new THREE.Mesh(mergeGeoms(tufts), MAT.reed); m.castShadow = true; scene.add(m); }
}

// ---------- Bomen (instanced) ----------
function buildTrees(scene) {
  const normal = treePositions.filter(t => !t.tall);
  const tall = treePositions.filter(t => t.tall);
  const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const r = rng(99);

  // gewone straat- en parkbomen: brede bolkroon
  if (normal.length) {
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.28, 2.6, 6);
    const leafGeo = new THREE.IcosahedronGeometry(2.2, 1);
    const n = normal.length;
    const trunks = new THREE.InstancedMesh(trunkGeo, MAT.trunk, n);
    const leavesA = new THREE.InstancedMesh(leafGeo, MAT.leaf, n);
    const leavesB = new THREE.InstancedMesh(leafGeo, MAT.leaf2, n);
    normal.forEach((t, i) => {
      const s2 = t.s; q.identity();
      m.compose(new THREE.Vector3(t.x, 1.3 * s2, t.z), q, new THREE.Vector3(1, s2, 1)); trunks.setMatrixAt(i, m);
      q.setFromEuler(new THREE.Euler(r() * 3, r() * 3, 0));
      m.compose(new THREE.Vector3(t.x, 3.6 * s2, t.z), q, new THREE.Vector3(s2 * (0.95 + r() * 0.45), s2 * (0.85 + r() * 0.4), s2 * (0.95 + r() * 0.45))); leavesA.setMatrixAt(i, m);
      q.setFromEuler(new THREE.Euler(r() * 3, r() * 3, 0));
      m.compose(new THREE.Vector3(t.x + (r() - 0.5) * 1.4 * s2, 5.0 * s2, t.z + (r() - 0.5) * 1.4 * s2), q, new THREE.Vector3(s2 * 0.85, s2 * 0.7, s2 * 0.85)); leavesB.setMatrixAt(i, m);
      addCollider(t.x, t.z, 0.3, 0.3, 0, 3);
    });
    trunks.castShadow = true; leavesA.castShadow = true; leavesB.castShadow = true;
    scene.add(trunks, leavesA, leavesB);
  }

  // populieren langs de parkpaden: hoge, rechte stam met smalle kroon
  if (tall.length) {
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.30, 5.4, 7);
    const leafGeo = new THREE.IcosahedronGeometry(2.0, 1);
    const n = tall.length;
    const trunks = new THREE.InstancedMesh(trunkGeo, MAT.trunkPale, n);
    const crownA = new THREE.InstancedMesh(leafGeo, MAT.leaf, n * 2);
    const crownB = new THREE.InstancedMesh(leafGeo, MAT.leaf2, n * 2);
    tall.forEach((t, i) => {
      const s2 = t.s; q.identity();
      m.compose(new THREE.Vector3(t.x, 2.7 * s2, t.z), q, new THREE.Vector3(1, s2, 1)); trunks.setMatrixAt(i, m);
      for (let k = 0; k < 2; k++) {
        q.setFromEuler(new THREE.Euler(r() * 3, r() * 3, 0));
        const y = (6.0 + k * 2.2) * s2;
        const w = (1.30 - k * 0.30) * s2;
        m.compose(new THREE.Vector3(t.x + (r() - 0.5) * 1.2 * s2, y, t.z + (r() - 0.5) * 1.2 * s2), q, new THREE.Vector3(w, w * 1.25, w));
        (k === 0 ? crownA : crownB).setMatrixAt(i * 2 + k, m);
        q.setFromEuler(new THREE.Euler(r() * 3, r() * 3, 0));
        m.compose(new THREE.Vector3(t.x + (r() - 0.5) * 2.2 * s2, y + 1.2 * s2, t.z + (r() - 0.5) * 2.2 * s2), q, new THREE.Vector3(w * 0.8, w, w * 0.8));
        (k === 0 ? crownB : crownA).setMatrixAt(i * 2 + k, m);
      }
      addCollider(t.x, t.z, 0.45, 0.45, 0, 3);
    });
    trunks.castShadow = true; crownA.castShadow = true; crownB.castShadow = true;
    scene.add(trunks, crownA, crownB);
  }
}

// ---------- Straatmeubilair ----------
function buildFurniture(scene) {
  const r = rng(123);
  const lampGeo = new THREE.CylinderGeometry(0.06, 0.09, 5.5, 6);
  const armGeo = new THREE.BoxGeometry(0.9, 0.08, 0.08);
  const headGeo = new THREE.BoxGeometry(0.5, 0.16, 0.25);
  const lamps = [], arms = [], heads = [];
  const signs = [];
  const klikos = [];
  for (const road of ROADS) {
    if (road.type === 'pad' || road.type === 'fietspad') continue;
    const pts = road.pts.map(vec);
    let sPlaced = false;
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1]; const d = b.clone().sub(a); const len = d.length(); d.normalize();
      const nrm = new THREE.Vector2(d.y, -d.x);
      const vgL2 = road.vergeL != null ? road.vergeL : (road.verge || 0);
      const vgR2 = road.vergeR != null ? road.vergeR : (road.verge || 0);
      for (let s = 3; s < len; s += 30) {
        const side = ((Math.floor(s / 30) + k) % 2 === 0) ? 1 : -1;
        const vg = side > 0 ? vgL2 : vgR2;
        const p = a.clone().add(d.clone().multiplyScalar(s)).add(nrm.clone().multiplyScalar(side * (road.w / 2 + Math.max(0.45, Math.min(1.0, vg * 0.45)))));
        lamps.push({ x: p.x, z: p.y, yaw: -Math.atan2(d.y, d.x), side });
      }
      // straatnaambord + 30-bord aan het begin van elke weg
      if (!sPlaced) {
        const p = a.clone().add(d.clone().multiplyScalar(9)).add(nrm.clone().multiplyScalar(road.w / 2 + 0.8));
        signs.push({ x: p.x, z: p.y, yaw: -Math.atan2(d.y, d.x), name: road.name });
        sPlaced = true;
      }
      if (k === pts.length - 2) {
        const p = b.clone().sub(d.clone().multiplyScalar(9)).add(nrm.clone().multiplyScalar(-(road.w / 2 + 0.8)));
        signs.push({ x: p.x, z: p.y, yaw: -Math.atan2(d.y, d.x), name: road.name });
      }
      // kliko's bij de stoeprand
      for (let s = 9; s < len; s += 23) {
        if (r() < 0.55) continue;
        const side = r() < 0.5 ? 1 : -1;
        const p = a.clone().add(d.clone().multiplyScalar(s)).add(nrm.clone().multiplyScalar(side * (road.w / 2 + 0.9)));
        klikos.push({ x: p.x, z: p.y, yaw: -Math.atan2(d.y, d.x) + (r() - 0.5) * 0.6 });
      }
    }
  }
  const lampMesh = new THREE.InstancedMesh(lampGeo, MAT.pole, lamps.length);
  const armMesh = new THREE.InstancedMesh(armGeo, MAT.pole, lamps.length);
  const headMesh = new THREE.InstancedMesh(headGeo, MAT.lamp, lamps.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  lamps.forEach((l, i) => {
    q.setFromEuler(e.set(0, l.yaw, 0));
    m.compose(new THREE.Vector3(l.x, 2.75, l.z), q, new THREE.Vector3(1, 1, 1)); lampMesh.setMatrixAt(i, m);
    // arm richt naar de weg (naar -side in lokale z)
    const off = new THREE.Vector3(0, 0, -l.side * 0.45).applyQuaternion(q);
    m.compose(new THREE.Vector3(l.x + off.x, 5.45, l.z + off.z), q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0))), new THREE.Vector3(1, 1, 1)); armMesh.setMatrixAt(i, m);
    const off2 = new THREE.Vector3(0, 0, -l.side * 0.85).applyQuaternion(q);
    m.compose(new THREE.Vector3(l.x + off2.x, 5.4, l.z + off2.z), q, new THREE.Vector3(1, 1, 1)); headMesh.setMatrixAt(i, m);
    addCollider(l.x, l.z, 0.12, 0.12, 0, 5);
  });
  scene.add(lampMesh, armMesh, headMesh);

  // borden
  for (const s of signs) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 6), MAT.pole);
    pole.position.set(s.x, 1.3, s.z); scene.add(pole);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.25), new THREE.MeshBasicMaterial({ map: T.streetSign(s.name), side: THREE.DoubleSide }));
    plate.position.set(s.x, 2.45, s.z); plate.rotation.y = s.yaw; scene.add(plate);
    const round = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), new THREE.MeshBasicMaterial({ map: T.sign30(), transparent: true, side: THREE.DoubleSide }));
    round.position.set(s.x, 1.95, s.z); round.rotation.y = s.yaw; scene.add(round);
  }
  // kliko's
  const kGeo = new THREE.BoxGeometry(0.58, 1.05, 0.72);
  const lidGeo = new THREE.BoxGeometry(0.6, 0.08, 0.74);
  const kMesh = new THREE.InstancedMesh(kGeo, MAT.kliko, klikos.length);
  const lMesh = new THREE.InstancedMesh(lidGeo, MAT.klikoLid, klikos.length);
  klikos.forEach((k, i) => {
    q.setFromEuler(e.set(0, k.yaw, 0));
    m.compose(new THREE.Vector3(k.x, 0.53, k.z), q, new THREE.Vector3(1, 1, 1)); kMesh.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(k.x, 1.09, k.z), q, new THREE.Vector3(1, 1, 1)); lMesh.setMatrixAt(i, m);
  });
  scene.add(kMesh, lMesh);

  // Kolkdeksels langs de trottoirband
  {
    const drains = [];
    const rr = rng(881);
    for (const sgm of roadSegments) {
      if (!sgm.drive || sgm.w < 4) continue;
      const ax = sgm.a[0], az = sgm.a[1], bx = sgm.b[0], bz = sgm.b[1];
      const len = Math.hypot(bx - ax, bz - az); if (len < 8) continue;
      const dx = (bx - ax) / len, dz = (bz - az) / len;
      for (let t = 6; t < len - 4; t += 22) {
        if (rr() < 0.35) continue;
        const side = rr() < 0.5 ? 1 : -1;
        const px = ax + dx * t + dz * side * (sgm.w / 2 - 0.25);
        const pz = az + dz * t - dx * side * (sgm.w / 2 - 0.25);
        const g = new THREE.BoxGeometry(0.42, 0.03, 0.32);
        g.rotateY(-Math.atan2(dz, dx)); g.translate(px, ROAD_Y + 0.02, pz);
        drains.push(g);
      }
    }
    if (drains.length) scene.add(new THREE.Mesh(mergeGeoms(drains), MAT.drain));
  }

  // Parkeerhoven
  for (const lot of PARKING_LOTS) {
    const [x, z] = toWorld(lot.at[0], lot.at[1]);
    const g = new THREE.PlaneGeometry(lot.l, lot.w);
    const mesh = new THREE.Mesh(g, MAT.klinker);
    mesh.rotation.x = -Math.PI / 2; mesh.rotation.z = lot.angle; mesh.position.set(x, ROAD_Y + 0.02, z); scene.add(mesh);
    for (let s = -lot.l / 2 + 3; s < lot.l / 2 - 2; s += 5.5) {
      const px = x + Math.cos(lot.angle) * s, pz = z - Math.sin(lot.angle) * s;
      if (r() < 0.65) parkSpots.push({ x: px, z: pz, yaw: -lot.angle + Math.PI / 2, driveable: r() < 0.3 });
    }
  }

  // Speeltuin
  {
    const [x, z] = toWorld(PLAYGROUND.at[0], PLAYGROUND.at[1]);
    const sand = new THREE.Mesh(new THREE.CircleGeometry(7, 24), MAT.sand); sand.rotation.x = -Math.PI / 2; sand.position.set(x, 0.04, z); scene.add(sand);
    // glijbaan
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 3.2), MAT.play2); slide.position.set(x - 2, 1.0, z); slide.rotation.x = -0.55; scene.add(slide);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.0, 1.2), MAT.play); tower.position.set(x - 2, 1.0, z - 1.9); scene.add(tower);
    // schommel
    const frame = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 0.1), MAT.pole); frame.position.set(x + 2.5, 2.4, z); scene.add(frame);
    for (const sx of [-1.4, 1.4]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), MAT.pole); leg.position.set(x + 2.5 + sx, 1.2, z); scene.add(leg); }
    for (const sx of [-0.6, 0.6]) { const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.25), MAT.dark); seat.position.set(x + 2.5 + sx, 0.6, z); scene.add(seat); }
    // wipwap
    const ww = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 0.3), MAT.play); ww.position.set(x, 0.6, z + 3); ww.rotation.z = 0.2; scene.add(ww);
    // bankje
    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.4), MAT.fence); bench.position.set(x + 3, 0.5, z + 4.5); scene.add(bench);
    addCollider(x - 2, z - 1.9, 0.6, 0.6, 0, 2);
  }
}

// ---------- Hoofdfunctie ----------
export function buildWorld(scene) {
  materials();
  for (const poly of WATER) waterPolys.push(poly.map(vec));
  // watergangen omzetten naar een omtrekpolygoon van middellijn + breedte
  for (const ww of WATERWAYS) {
    const pts = ww.pts.map(vec);
    const left = [], right = [];
    for (let i = 0; i < pts.length; i++) {
      const dPrev = i > 0 ? pts[i].clone().sub(pts[i - 1]).normalize() : null;
      const dNext = i < pts.length - 1 ? pts[i + 1].clone().sub(pts[i]).normalize() : null;
      const d = (dPrev && dNext) ? dPrev.clone().add(dNext).normalize() : (dPrev || dNext);
      const n = new THREE.Vector2(d.y, -d.x).multiplyScalar(ww.w / 2);
      left.push(pts[i].clone().add(n)); right.push(pts[i].clone().sub(n));
    }
    waterPolys.push(left.concat(right.reverse()));
    ww._pts = pts;
  }
  for (const park of PARKS) parkPolys.push(park.poly.map(vec));
  for (const entry of WOODS) woodPolys.push(woodPoly(entry).map(vec));
  buildRoads(scene);
  const allRows = ROWS.flatMap(expandStagger);
  allRows.forEach((row, i) => buildRow(scene, row, i));
  // Verdichting: in Tinga liggen de rijen vrijwel overal rug aan rug met de
  // achtertuinen tegen elkaar. Achter elke rij komt daarom een tweede rij, die
  // alleen wordt gebouwd waar hij niet tegen een weg, water of andere woning botst.
  const GARDENS = 17;                       // twee achtertuinen van 8,5 m
  const skip = new Set(['spil', 'appart']);
  const generated = [];
  for (const row of allRows) {
    if (row.flip || skip.has(row.type)) continue;
    const sign = row.off < 0 ? -1 : 1;
    generated.push({ ...row, off: sign * (Math.abs(row.off) + 2 * row.depth + GARDENS), flip: true, generated: true });
  }
  // en nog een derde rij voor de diepe blokken
  for (const row of allRows) {
    if (row.flip || skip.has(row.type) || row.type === 'detached' || row.type === 'bonkelaar') continue;
    const sign = row.off < 0 ? -1 : 1;
    generated.push({ ...row, off: sign * (Math.abs(row.off) + 2 * row.depth + GARDENS + row.depth + 14), flip: false, generated: true });
  }
  const before = units.length;
  generated.forEach((row, i) => buildRow(scene, row, 1000 + i));
  console.log(`verdichting: ${units.length - before} extra bouwblokken geplaatst`);
  buildParks(scene);
  buildGardens();
  buildNature(scene);
  buildReeds(scene);
  // rondom het startpunt geen bomen, zodat je niet in een kruin begint
  {
    const [sx0, sz0] = toWorld(START.at[0], START.at[1]);
    for (let i = treePositions.length - 1; i >= 0; i--) {
      const t = treePositions[i];
      if (Math.hypot(t.x - sx0, t.z - sz0) < 9) treePositions.splice(i, 1);
    }
  }
  buildTrees(scene);
  buildFurniture(scene);
  return { colliders, roadSegments, parkSpots, waterPolys };
}

// Botsingsafhandeling: cirkel (x,z,radius) tegen alle colliders -> gecorrigeerde positie
export function resolveCollisions(x, z, radius, ignoreLowH = 0) {
  for (const c of colliders) {
    if (c.h < ignoreLowH) continue;
    const dx = x - c.cx, dz = z - c.cz;
    const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
    const px = Math.abs(lx) - c.hx, pz = Math.abs(lz) - c.hz;
    if (px < radius && pz < radius) {
      // dichtstbijzijnde as naar buiten duwen
      let nx = 0, nz = 0;
      if (px > pz) { nx = Math.sign(lx || 1) * (radius - px); }
      else { nz = Math.sign(lz || 1) * (radius - pz); }
      // terug naar wereld (rotatie om Y met rotY)
      x += nx * c.cos + nz * c.sin;
      z += -nx * c.sin + nz * c.cos;
    }
  }
  return [x, z];
}

export function pointInWater(x, z) {
  return inWater(new THREE.Vector2(x, z));
}

export function nearestRoadName(x, z) {
  let best = null, bd = 1e9;
  for (const s of roadSegments) {
    if (s.w === 0) continue;
    const d = distToSeg(x, z, s.a[0], s.a[1], s.b[0], s.b[1]) - s.w / 2;
    if (d < bd) { bd = d; best = s.name; }
  }
  return bd < 30 ? best : 'Tinga';
}
