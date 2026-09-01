// Wereldopbouw: wegen, stoepen, parkeervakken, water, groen, huizen, straatmeubilair.
import * as THREE from 'three';
import { ROADS, HIGHWAY, WATER, WOODS, GRASS, ROWS, PARKING_LOTS, PLAYGROUND, toWorld } from './data.js';
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
  MAT.water = new THREE.MeshStandardMaterial({ map: T.water(), color: 0x7fb0c0, roughness: 0.3, metalness: 0.0, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
  MAT.hedge = std(T.hedge());
  MAT.curb = new THREE.MeshStandardMaterial({ color: 0x9a9890, roughness: 0.9 });
  MAT.trunk = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 });
  MAT.leaf = new THREE.MeshStandardMaterial({ color: 0x4d7d2c, roughness: 1 });
  MAT.leaf2 = new THREE.MeshStandardMaterial({ color: 0x3f6b25, roughness: 1 });
  MAT.pole = new THREE.MeshStandardMaterial({ color: 0x7a7f86, roughness: 0.6, metalness: 0.6 });
  MAT.lamp = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 0.6 });
  MAT.kliko = new THREE.MeshStandardMaterial({ color: 0x3a3f44, roughness: 0.7 });
  MAT.klikoLid = new THREE.MeshStandardMaterial({ color: 0x1f5fd0, roughness: 0.6 });
  MAT.white = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.8 });
  MAT.dark = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.8 });
  MAT.solar = std(T.solarPanel(), { roughness: 0.3, metalness: 0.5 });
  MAT.barrier = new THREE.MeshStandardMaterial({ color: 0x6b7a5a, roughness: 0.9 });
  MAT.sand = new THREE.MeshStandardMaterial({ color: 0xc9b58a, roughness: 1 });
  MAT.play = new THREE.MeshStandardMaterial({ color: 0xd8342a, roughness: 0.6 });
  MAT.play2 = new THREE.MeshStandardMaterial({ color: 0x2a6bd8, roughness: 0.6 });
  MAT.fence = new THREE.MeshStandardMaterial({ color: 0x6b5236, roughness: 1 });
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
  // brede wegen bovenop: sorteer op breedte (paden onderaan)
  const order = ROADS.map((r, i) => ({ r, i })).sort((x, y) => x.r.w - y.r.w || x.i - y.i);
  const roads = order.map(({ r }) => ({ ...r, pts: r.pts.map(vec), gaps: { L: [], R: [] }, trimStart: 0, trimEnd: 0 }));
  // Wegeinden aansluiten: eindpunt dat binnen 13 m van een andere weg ligt wordt op die wegas gezet
  for (const road of roads) {
    for (const endIdx of [0, road.pts.length - 1]) {
      const p = road.pts[endIdx];
      let best = null, connected = false;
      for (const other of roads) {
        if (other === road) continue;
        if (other.type === 'pad' || other.type === 'fietspad') { if (road.type !== 'pad' && road.type !== 'fietspad') continue; }
        const pr = projectOnPolyline(p, other.pts);
        if (pr.d <= 0.05) connected = true; // ligt al precies op een andere weg
        if (pr.d > 0.05 && pr.d < 13 && (!best || pr.d < best.pr.d)) best = { other, pr };
      }
      if (!best || connected) continue;
      const { other, pr } = best;
      road.pts[endIdx] = pr.q.clone();
      // trimafstand voor eigen parkeerstroken/stoepen bij dit eind
      const trim = other.w / 2 + (other.parking ? 2.2 : 0) + other.sidewalk + 0.6;
      if (endIdx === 0) road.trimStart = trim; else road.trimEnd = trim;
      // parkeerstrook van de andere weg onderbreken ter hoogte van deze aansluiting
      const prev = road.pts[endIdx === 0 ? 1 : road.pts.length - 2];
      const left = new THREE.Vector2(pr.dir.y, -pr.dir.x);
      const sideKey = prev.clone().sub(pr.q).dot(left) > 0 ? 'L' : 'R';
      const half = road.w / 2 + road.sidewalk + 1.5;
      other.gaps[sideKey].push([pr.s - half, pr.s + half]);
    }
  }
  let i = 0;
  for (const road of roads) {
    const pts = road.pts;
    const mat = MAT[road.type] || MAT.klinker;
    const g = ribbon(pts, road.w, ROAD_Y + i * 0.0007, 0, 0.5);
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    scene.add(m);
    const isPath = road.type === 'pad' || road.type === 'fietspad';
    const pk = road.parking || '';
    const corr = road.w / 2 + (pk ? 2.2 : 0) + (road.sidewalk || 0) + (isPath ? 0.5 : 0);
    for (let k = 0; k < pts.length - 1; k++) {
      roadSegments.push({ name: road.name, a: [pts[k].x, pts[k].y], b: [pts[k + 1].x, pts[k + 1].y], w: road.w, corr, drive: !isPath });
    }
    if (road.sidewalk > 0) {
      const sw = road.sidewalk;
      const leftPark = pk.includes('L') ? 2.2 : 0;
      const rightPark = pk.includes('R') ? 2.2 : 0;
      const total = polyLength(pts);
      const inner = sliceByLength(pts, road.trimStart, total - road.trimEnd) || pts;
      const walkY = 0.05 + i * 0.0006;
      // parkeerstroken in stukken tussen de aansluitingen
      const parkPieces = (sideKey, offset, width) => {
        const gaps = road.gaps[sideKey].slice().sort((a, b) => a[0] - b[0]);
        let cursor = road.trimStart; const pieces = [];
        for (const [g0, g1] of gaps) { if (g0 > cursor) pieces.push([cursor, g0]); cursor = Math.max(cursor, g1); }
        if (total - road.trimEnd > cursor) pieces.push([cursor, total - road.trimEnd]);
        for (const [s0, s1] of pieces) {
          const sub = sliceByLength(pts, s0, s1); if (!sub || polyLength(sub) < 5) continue;
          scene.add(new THREE.Mesh(ribbon(sub, width, ROAD_Y + 0.001 + i * 0.0007, offset, 0.5), MAT.klinker));
          // parkeerplekken
          const r = rng(i * 13 + Math.round(s0));
          for (let k = 0; k < sub.length - 1; k++) {
            const a = sub[k], b = sub[k + 1]; const d = b.clone().sub(a); const len = d.length(); d.normalize();
            const nrm = new THREE.Vector2(d.y, -d.x);
            for (let s = 3.5; s < len - 3; s += 6.2) {
              const p = a.clone().add(d.clone().multiplyScalar(s)).add(nrm.clone().multiplyScalar(offset));
              if (r() < 0.6) parkSpots.push({ x: p.x, z: p.y, yaw: Math.atan2(d.x, d.y) + (offset < 0 ? Math.PI : 0), driveable: true });
            }
          }
        }
      };
      if (leftPark) parkPieces('L', road.w / 2 + leftPark / 2, leftPark);
      if (rightPark) parkPieces('R', -(road.w / 2 + rightPark / 2), rightPark);
      walkGeoms.push(ribbon(inner, sw, walkY, road.w / 2 + leftPark + sw / 2, 0.8));
      walkGeoms.push(ribbon(inner, sw, walkY, -(road.w / 2 + rightPark + sw / 2), 0.8));
      curbGeoms.push(ribbon(inner, 0.15, walkY + 0.002, road.w / 2 + leftPark + 0.07, 1));
      curbGeoms.push(ribbon(inner, 0.15, walkY + 0.002, -(road.w / 2 + rightPark + 0.07), 1));
    }
    i++;
  }
  const walk = new THREE.Mesh(mergeGeoms(walkGeoms), MAT.tiles); walk.receiveShadow = true; scene.add(walk);
  scene.add(new THREE.Mesh(mergeGeoms(curbGeoms), MAT.curb));

  // Rode-klinkerplateaus op de hoofdkruispunten en zebra bij Molenkrite
  const plateau = (px, py, s) => {
    const [x, z] = toWorld(px, py);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), MAT.rood);
    m.rotation.x = -Math.PI / 2; m.position.set(x, ROAD_Y + 0.06, z); scene.add(m);
  };
  plateau(370, 1245, 13); plateau(243, 935, 11); plateau(305, 1460, 11); plateau(600, 1750, 11);
  const zebraMat = new THREE.MeshBasicMaterial({ map: T.zebra(), transparent: true });
  const zb = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), zebraMat);
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
  for (const poly of GRASS) { /* gras is standaard */ }

  // bomen in bosschages
  const r = rng(77);
  for (const poly of WOODS) {
    const pts = poly.map(vec);
    const bb = new THREE.Box2().setFromPoints(pts);
    const area = (bb.max.x - bb.min.x) * (bb.max.y - bb.min.y);
    const count = Math.floor(area / 140);
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
      for (let s = 7; s < len - 4; s += 14) {
        const side = ((Math.floor(s / 14) + k) % 2 === 0) ? 1 : -1;
        const pk = (road.parking || '');
        const extra = (side > 0 && pk.includes('L')) || (side < 0 && pk.includes('R')) ? 2.2 : 0;
        const p = a.clone().add(d.clone().multiplyScalar(s)).add(nrm.clone().multiplyScalar(side * (road.w / 2 + extra + road.sidewalk + 1.6)));
        if (!nearRoad(p, 2.5) && !nearBuilding(p, 3) && !inWater(p)) treePositions.push({ x: p.x, z: p.y, s: 0.7 + r() * 0.5 });
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
function inWater(p) { return waterPolys.some(poly => pointInPoly(p, poly)); }
export function nearRoad(p, margin) {
  for (const s of roadSegments) {
    if (s.w === 0) continue;
    const d = distToSeg(p.x, p.y, s.a[0], s.a[1], s.b[0], s.b[1]);
    if (d < s.w / 2 + margin) return true;
  }
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
function blocked(px, pz, margin, skipUnit = null) {
  if (roadClearance(px, pz) < margin) return true;
  if (inWater(new THREE.Vector2(px, pz))) return true;
  for (const u of units) { if (u !== skipUnit && pointInUnit(px, pz, u, margin)) return true; }
  return false;
}

const rowBuilds = [];

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
  const roofH = st.roofType === 'gable' ? Math.min(4.5, depth * 0.55) : (st.roofType === 'low' ? 1.6 : 0);

  // kandidaat-woningen langs de rij
  let cand = [];
  if (st.detached) {
    const n = Math.max(1, Math.round(len0 / 18)); const gap = len0 / n;
    for (let i = 0; i < n; i++) cand.push({ cx: -len0 / 2 + gap * (i + 0.5), w: st.w, n: 1 });
  } else if (st.semi) {
    const pairs = Math.max(1, Math.round(len0 / 17)); const gap = len0 / pairs;
    for (let i = 0; i < pairs; i++) cand.push({ cx: -len0 / 2 + gap * (i + 0.5), w: st.w * 2, n: 2 });
  } else {
    const n = Math.max(1, Math.round(len0 * 0.86 / st.w));
    for (let i = 0; i < n; i++) cand.push({ cx: -n * st.w / 2 + st.w * (i + 0.5), w: st.w, n: 1 });
  }
  const toWorldLocal = (lx, lz) => new THREE.Vector2(center.x + dLocal.x * lx + faceDir.x * lz, center.y + dLocal.y * lx + faceDir.y * lz);
  const why = (px, pz, margin) => {
    let best = null, bd = 1e9;
    for (const sgm of roadSegments) { if (sgm.w === 0) continue; const d = distToSeg(px, pz, sgm.a[0], sgm.a[1], sgm.b[0], sgm.b[1]) - sgm.corr; if (d < bd) { bd = d; best = sgm.name; } }
    if (bd < margin) return `weg ${best} (${bd.toFixed(1)} m)`;
    if (inWater(new THREE.Vector2(px, pz))) return 'water';
    const u = units.find(u => pointInUnit(px, pz, u, margin)); if (u) return `woning rij ${u.rowIdx}`;
    return 'stoep';
  };
  const fits = (c) => {
    for (const fx of [-1, 0, 1]) for (const fz of [-1, 0, 1]) {
      const p = toWorldLocal(c.cx + fx * (c.w / 2 - 0.3), fz * (depth / 2 - 0.3));
      if (blocked(p.x, p.y, 0.5)) { if (row.debug) console.warn(`  rij ${idx} unit ${c.cx.toFixed(1)}: ${why(p.x, p.y, 0.5)}`); return false; }
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
  if (dropped > 0) console.warn(`rij ${idx} ${row.type} [${row.a}]-[${row.b}] off ${row.off}: ${dropped}/${cand.length} woningen weggelaten (botsing)`);
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
      roof.position.set(cx, facadeH, 0); roof.castShadow = true;
      group.add(roof);
      const triShape = new THREE.Shape(); triShape.moveTo(-depth / 2, 0); triShape.lineTo(depth / 2, 0); triShape.lineTo(0, rh); triShape.closePath();
      const tri = new THREE.ShapeGeometry(triShape);
      for (const sgn of [-1, 1]) {
        const tm = new THREE.Mesh(tri, sideMat);
        tm.rotation.y = sgn * Math.PI / 2; tm.position.set(cx + sgn * (unitLen / 2 - 0.01), facadeH, 0);
        group.add(tm);
      }
      if (st.dormer) {
        const perHouse = unitLen / unitN;
        for (let i = 0; i < unitN; i++) {
          const hx = cx - unitLen / 2 + perHouse * (i + 0.5);
          if (!st.dormerBand && (i + seed) % 3 === 1) continue;
          const dw = st.dormerBand ? perHouse * 0.9 : Math.min(2.6, perHouse * 0.55);
          const dh = 1.35, dd = 1.6;
          const z = depth / 2 + 0.35 - dd / 2 - 0.9;
          const yBase = facadeH + (rh / (depth / 2 + 0.35)) * (depth / 2 + 0.35 - (z + dd / 2));
          const frontMat = new THREE.MeshStandardMaterial({ map: T.dormerFront(st.frame2), roughness: 0.6 });
          const dm = new THREE.Mesh(new THREE.BoxGeometry(dw, dh, dd), [MAT.white, MAT.white, MAT.dark, MAT.white, frontMat, MAT.white]);
          dm.position.set(hx, yBase + dh / 2 + 0.2, z + 0.5);
          group.add(dm);
        }
      }
      if (st.solar) {
        const perHouse = unitLen / unitN;
        for (let i = 0; i < unitN; i++) {
          if ((i + seed) % 2) continue;
          const hx = cx - unitLen / 2 + perHouse * (i + 0.5);
          const p = new THREE.Mesh(new THREE.PlaneGeometry(perHouse * 0.7, 1.9), MAT.solar);
          const ang = Math.atan2(rh, depth / 2 + 0.35);
          p.rotation.x = -Math.PI / 2 + ang;
          p.position.set(hx, facadeH + rh * 0.5 + 0.06, -(depth / 2 + 0.35) * 0.5);
          group.add(p);
        }
      }
      if (st.chimney) {
        const perHouse = unitLen / unitN; const chims = [];
        for (let i = 0; i < unitN; i++) {
          const hx = cx - unitLen / 2 + perHouse * (i + 0.5) + perHouse * 0.45;
          const cg = new THREE.BoxGeometry(0.5, 1.0, 0.5); cg.translate(hx, facadeH + rh + 0.2, 0.3); chims.push(cg);
        }
        group.add(new THREE.Mesh(mergeGeoms(chims), sideMat));
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

// Fase 2: tuinen – alleen waar ruimte is (geen wegen, water of andere woningen)
function buildGardens() {
  for (const rb of rowBuilds) {
    const { row, st, runs, group, depth, toWorldLocal } = rb;
    for (const run of runs) {
      // beschikbare diepte achter het blok
      let backAvail = 9.5;
      for (let x = run.cx - run.len / 2 + 1; x <= run.cx + run.len / 2 - 1; x += 2.5) {
        for (let k = 0.8; k <= 9.5; k += 0.5) {
          const p = toWorldLocal(x, -depth / 2 - k);
          if (blocked(p.x, p.y, 0.3, run.unit)) { backAvail = Math.min(backAvail, k - 0.6); break; }
        }
      }
      // beschikbare diepte vóór het blok (tot de stoep)
      let frontAvail = 5.2;
      for (let x = run.cx - run.len / 2 + 1; x <= run.cx + run.len / 2 - 1; x += 2.5) {
        for (let k = 0.6; k <= 5.4; k += 0.4) {
          const p = toWorldLocal(x, depth / 2 + k);
          if (blocked(p.x, p.y, 0.2, run.unit)) { frontAvail = Math.min(frontAvail, k - 0.6); break; }
        }
      }
      const unitCount = run.n;
      if (row.type !== 'spil' && row.type !== 'appart' && frontAvail >= 1.4) {
        const hedgeZ = depth / 2 + frontAvail;
        const hedgeMat = new THREE.MeshStandardMaterial({ map: T.hedge().clone(), roughness: 1 });
        hedgeMat.map.needsUpdate = true; hedgeMat.map.repeat.set(run.len / 1.2, 1);
        const hedge = new THREE.Mesh(new THREE.BoxGeometry(run.len, 0.8, 0.45), hedgeMat);
        hedge.position.set(run.cx, 0.4, hedgeZ); hedge.castShadow = true;
        group.add(hedge);
        const paths = [], bushes = [];
        for (let i = 0; i < unitCount; i++) {
          const hx = run.cx - run.len / 2 + (run.len / unitCount) * (i + 0.5) + ((i % 2) ? 1.2 : -1.2);
          const pg = new THREE.BoxGeometry(0.9, 0.03, frontAvail); pg.translate(hx, 0.02, depth / 2 + frontAvail / 2); paths.push(pg);
          if (frontAvail > 2.2) { const bg = new THREE.SphereGeometry(0.5, 6, 5); bg.translate(hx + ((i % 2) ? -1.5 : 1.5), 0.4, depth / 2 + frontAvail * 0.5); bushes.push(bg); }
        }
        group.add(new THREE.Mesh(mergeGeoms(paths), MAT.tiles));
        if (bushes.length) { const bushMesh = new THREE.Mesh(mergeGeoms(bushes), MAT.leaf2); bushMesh.castShadow = true; group.add(bushMesh); }
      }
      if (backAvail >= 2.5 && row.type !== 'spil') {
        const parts = [];
        const f = new THREE.BoxGeometry(run.len, 1.8, 0.08); f.translate(run.cx, 0.9, -depth / 2 - backAvail); parts.push(f);
        for (const sgn of [-1, 1]) { const f2 = new THREE.BoxGeometry(0.08, 1.8, backAvail); f2.translate(run.cx + sgn * run.len / 2, 0.9, -depth / 2 - backAvail / 2); parts.push(f2); }
        if (backAvail >= 5) {
          const shedCount = Math.max(1, Math.round(run.len / 6));
          for (let i = 0; i < shedCount; i++) {
            const hx = run.cx - run.len / 2 + (run.len / shedCount) * (i + 0.5);
            const sg = new THREE.BoxGeometry(2.2, 2.2, 2.2); sg.translate(hx, 1.1, -depth / 2 - backAvail + 1.3); parts.push(sg);
          }
        }
        const back = new THREE.Mesh(mergeGeoms(parts), MAT.fence); back.castShadow = true; group.add(back);
      }
    }
  }
}

// ---------- Bomen (instanced) ----------
function buildTrees(scene) {
  const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 3.2, 6);
  const leafGeo = new THREE.IcosahedronGeometry(2.2, 1);
  const n = treePositions.length;
  const trunks = new THREE.InstancedMesh(trunkGeo, MAT.trunk, n);
  const leavesA = new THREE.InstancedMesh(leafGeo, MAT.leaf, n);
  const leavesB = new THREE.InstancedMesh(leafGeo, MAT.leaf2, n);
  const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const r = rng(99);
  treePositions.forEach((t, i) => {
    const s = t.s;
    q.identity();
    m.compose(new THREE.Vector3(t.x, 1.6 * s, t.z), q, new THREE.Vector3(1, s, 1)); trunks.setMatrixAt(i, m);
    q.setFromEuler(new THREE.Euler(r() * 3, r() * 3, 0));
    m.compose(new THREE.Vector3(t.x, 3.2 * s + 1.6 * s, t.z), q, new THREE.Vector3(s * (0.8 + r() * 0.4), s * (0.9 + r() * 0.5), s * (0.8 + r() * 0.4))); leavesA.setMatrixAt(i, m);
    q.setFromEuler(new THREE.Euler(r() * 3, r() * 3, 0));
    m.compose(new THREE.Vector3(t.x + (r() - 0.5) * 1.2 * s, 3.2 * s + 2.6 * s, t.z + (r() - 0.5) * 1.2 * s), q, new THREE.Vector3(s * 0.8, s * 0.7, s * 0.8)); leavesB.setMatrixAt(i, m);
    addCollider(t.x, t.z, 0.3, 0.3, 0, 3);
  });
  trunks.castShadow = true; leavesA.castShadow = true; leavesB.castShadow = true;
  scene.add(trunks, leavesA, leavesB);
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
      const pk = road.parking || '';
      for (let s = 3; s < len; s += 28) {
        const side = ((Math.floor(s / 28) + k) % 2 === 0) ? 1 : -1;
        const extra = (side > 0 && pk.includes('L')) || (side < 0 && pk.includes('R')) ? 2.2 : 0;
        const p = a.clone().add(d.clone().multiplyScalar(s)).add(nrm.clone().multiplyScalar(side * (road.w / 2 + extra + 0.45)));
        lamps.push({ x: p.x, z: p.y, yaw: -Math.atan2(d.y, d.x), side });
      }
      // straatnaambord + 30-bord aan het begin van elke weg
      if (!sPlaced) {
        const p = a.clone().add(d.clone().multiplyScalar(9)).add(nrm.clone().multiplyScalar(road.w / 2 + (pk.includes('L') ? 2.2 : 0) + 0.6));
        signs.push({ x: p.x, z: p.y, yaw: -Math.atan2(d.y, d.x), name: road.name });
        sPlaced = true;
      }
      if (k === pts.length - 2) {
        const p = b.clone().sub(d.clone().multiplyScalar(9)).add(nrm.clone().multiplyScalar(-(road.w / 2 + (pk.includes('R') ? 2.2 : 0) + 0.6)));
        signs.push({ x: p.x, z: p.y, yaw: -Math.atan2(d.y, d.x), name: road.name });
      }
      // kliko's bij de stoeprand
      for (let s = 9; s < len; s += 23) {
        if (r() < 0.5) continue;
        const side = r() < 0.5 ? 1 : -1;
        const extra = (side > 0 && pk.includes('L')) || (side < 0 && pk.includes('R')) ? 2.2 : 0;
        const p = a.clone().add(d.clone().multiplyScalar(s)).add(nrm.clone().multiplyScalar(side * (road.w / 2 + extra + 1.0)));
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
  buildRoads(scene);
  ROWS.forEach((row, i) => buildRow(scene, row, i));
  buildGardens();
  buildNature(scene);
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
