// Wereldopbouw: wegen, stoepen, parkeervakken, water, groen, huizen, straatmeubilair.
import * as THREE from 'three';
import { ROADS, HIGHWAY, WATER, WOODS, GRASS, ROWS, PARKING_LOTS, PLAYGROUND, toWorld } from './data.js';
import * as T from './textures.js';
import { rng } from './textures.js';

export const colliders = [];   // {cx,cz,hx,hz,cos,sin,h} georiënteerde rechthoeken
export const roadSegments = []; // voor straatnaam-detectie en NPC-paden: {name,a:[x,z],b:[x,z],w}
export const parkSpots = [];   // parkeerplaatsen voor auto's: {x,z,yaw}
export const treePositions = [];

const ROAD_Y = 0.10, WALK_Y = 0.085, WATER_Y = -0.15;

function vec(p) { const [x, z] = toWorld(p[0], p[1]); return new THREE.Vector2(x, z); }

// ---------- Hulpfuncties geometrie ----------
// Bouwt een lint (ribbon) langs een polyline met breedte w; offset verschuift het lint zijwaarts.
function ribbon(points2, w, y, offset = 0, uvScale = 1) {
  const pts = points2;
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
  const shape = new THREE.Shape(pts2.map(p => new THREE.Vector2(p.x, -p.y)));
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
  MAT.water = new THREE.MeshStandardMaterial({ map: T.water(), color: 0x7fb0c0, roughness: 0.3, metalness: 0.0, transparent: true, opacity: 0.9 });
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
function buildRoads(scene) {
  let i = 0;
  const walkGeoms = [];
  const curbGeoms = [];
  for (const road of ROADS) {
    const pts = road.pts.map(vec);
    const mat = MAT[road.type] || MAT.klinker;
    const g = ribbon(pts, road.w, ROAD_Y + i * 0.0007, 0, 0.5);
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    scene.add(m);
    for (let k = 0; k < pts.length - 1; k++) {
      roadSegments.push({ name: road.name, a: [pts[k].x, pts[k].y], b: [pts[k + 1].x, pts[k + 1].y], w: road.w, drive: road.type !== 'pad' && road.type !== 'fietspad' });
    }
    if (road.sidewalk > 0) {
      const sw = road.sidewalk;
      const pk = road.parking || '';
      // parkeerstrook 2.2m breed direct naast de weg (grijze klinkers), stoep daarbuiten
      const leftPark = pk.includes('L') ? 2.2 : 0;
      const rightPark = pk.includes('R') ? 2.2 : 0;
      if (leftPark) scene.add(new THREE.Mesh(ribbon(pts, leftPark, ROAD_Y + 0.001 + i * 0.0007, road.w / 2 + leftPark / 2, 0.5), MAT.klinker));
      if (rightPark) scene.add(new THREE.Mesh(ribbon(pts, rightPark, ROAD_Y + 0.001 + i * 0.0007, -(road.w / 2 + rightPark / 2), 0.5), MAT.klinker));
      walkGeoms.push(ribbon(pts, sw, WALK_Y, road.w / 2 + leftPark + sw / 2, 0.8));
      walkGeoms.push(ribbon(pts, sw, WALK_Y, -(road.w / 2 + rightPark + sw / 2), 0.8));
      curbGeoms.push(ribbon(pts, 0.15, WALK_Y + 0.002, road.w / 2 + leftPark + 0.07, 1));
      curbGeoms.push(ribbon(pts, 0.15, WALK_Y + 0.002, -(road.w / 2 + rightPark + 0.07), 1));
      // parkeerplekken registreren (om de 6 m, met 60% bezetting)
      const r = rng(i * 13 + 5);
      for (let k = 0; k < pts.length - 1; k++) {
        const a = pts[k], b = pts[k + 1];
        const d = b.clone().sub(a); const len = d.length(); d.normalize();
        const nrm = new THREE.Vector2(d.y, -d.x);
        for (let s = 4; s < len - 4; s += 6.2) {
          const base = a.clone().add(d.clone().multiplyScalar(s));
          if (leftPark) { const p = base.clone().add(nrm.clone().multiplyScalar(road.w / 2 + 1.1)); if (r() < 0.6) parkSpots.push({ x: p.x, z: p.y, yaw: Math.atan2(d.x, d.y), driveable: r() < 0.25 }); }
          if (rightPark) { const p = base.clone().add(nrm.clone().multiplyScalar(-(road.w / 2 + 1.1))); if (r() < 0.6) parkSpots.push({ x: p.x, z: p.y, yaw: Math.atan2(d.x, d.y) + Math.PI, driveable: r() < 0.25 }); }
        }
      }
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
  for (const c of colliders) {
    const dx = p.x - c.cx, dz = p.y - c.cz;
    const lx = dx * c.cos + dz * c.sin, lz = -dx * c.sin + dz * c.cos;
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

function buildRow(scene, row, idx) {
  const st = T.HOUSE_STYLES[row.type];
  const a = vec(row.a), b = vec(row.b);
  const d = b.clone().sub(a); const len0 = d.length(); d.normalize();
  // links van a->b in kaartcoördinaten = (dy,-dx); in wereld XZ identiek
  const left = new THREE.Vector2(d.y, -d.x);
  const side = row.off < 0 ? -1 : 1;           // +1: rij links van de weg, -1: rechts
  const nrm = left.clone().multiplyScalar(side); // wijst van de weg af, naar de rij toe
  const flip = !!row.flip;                       // true: gevel kijkt van de weg af
  const storeys = row.storeys || st.storeys;
  let n = Math.max(1, Math.round(len0 * 0.86 / st.w));
  if (st.detached) n = Math.max(1, Math.round(len0 / 18));
  const w = st.w;
  const totalLen = (st.detached || st.semi) ? len0 : n * w;
  const depth = row.depth;
  const front = a.clone().add(b).multiplyScalar(0.5).add(nrm.clone().multiplyScalar(Math.abs(row.off)));
  const center = front.clone().add(nrm.clone().multiplyScalar(flip ? -depth / 2 : depth / 2));
  // lokale +z moet naar de voorgevelzijde wijzen: naar de weg (-nrm) of, bij flip, van de weg af (+nrm)
  const faceDir = flip ? nrm : nrm.clone().multiplyScalar(-1);
  const yaw = Math.atan2(faceDir.y, faceDir.x); // hoek van lokale +z in XZ
  const rotY = Math.PI / 2 - yaw;                // rotatie zodat lokale +z = faceDir
  const dLocal = new THREE.Vector2(Math.cos(rotY), -Math.sin(rotY)); // wereldrichting van lokale +x

  const facadeH = storeys * 2.9;
  const roofH = st.roofType === 'gable' ? Math.min(4.5, depth * 0.55) : (st.roofType === 'low' ? 1.6 : 0);

  const group = new THREE.Group();
  group.position.set(center.x, 0, center.y);
  group.rotation.y = rotY;

  const placeUnit = (cx, unitLen, unitN, seed) => {
    // lichaam
    const frontTex = T.facade(row.type, unitN, storeys, false, seed);
    const backTex = T.facade(row.type, unitN, storeys, true, seed);
    const brickTex = st.plaster ? T.plaster(st.brick[0]) : T.brick(st.brick[0], st.brick[1], seed);
    const sideMat = new THREE.MeshStandardMaterial({ map: brickTex.clone(), roughness: 0.95 });
    sideMat.map.needsUpdate = true; sideMat.map.repeat.set(depth / 2.6, facadeH / 2.6);
    const fm = new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.9 });
    const bm = new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.9 });
    const top = new THREE.MeshStandardMaterial({ map: T.bitumen(), roughness: 1 });
    // BoxGeometry materialen: +x, -x, +y, -y, +z, -z ; voorgevel is -z (richting weg = -nrm)
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
      // topgevels als dunne driehoekige wanden (baksteen) aan de uiteinden
      const triShape = new THREE.Shape(); triShape.moveTo(-depth / 2, 0); triShape.lineTo(depth / 2, 0); triShape.lineTo(0, rh); triShape.closePath();
      const tri = new THREE.ShapeGeometry(triShape);
      for (const sgn of [-1, 1]) {
        const tm = new THREE.Mesh(tri, sideMat);
        tm.rotation.y = sgn * Math.PI / 2; tm.position.set(cx + sgn * (unitLen / 2 - 0.01), facadeH, 0);
        group.add(tm);
      }
      // dakkapellen aan de straatzijde
      if (st.dormer) {
        const perHouse = unitLen / unitN;
        for (let i = 0; i < unitN; i++) {
          const hx = cx - unitLen / 2 + perHouse * (i + 0.5);
          if (!st.dormerBand && (i + seed) % 3 === 1) continue; // niet elk huis heeft een dakkapel
          const dw = st.dormerBand ? perHouse * 0.9 : Math.min(2.6, perHouse * 0.55);
          const dh = 1.35, dd = 1.6;
          const z = depth / 2 + 0.35 - dd / 2 - 0.9; // op het dakvlak
          const yBase = facadeH + (rh / (depth / 2 + 0.35)) * (depth / 2 + 0.35 - (z + dd / 2));
          const frontMat = new THREE.MeshStandardMaterial({ map: T.dormerFront(st.frame2), roughness: 0.6 });
          const dm = new THREE.Mesh(new THREE.BoxGeometry(dw, dh, dd), [MAT.white, MAT.white, MAT.dark, MAT.white, frontMat, MAT.white]);
          dm.position.set(hx, yBase + dh / 2 + 0.2, z + 0.5);
          group.add(dm);
        }
      }
      // zonnepanelen
      if (st.solar) {
        const perHouse = unitLen / unitN;
        for (let i = 0; i < unitN; i++) {
          if ((i + seed) % 2) continue;
          const hx = cx - unitLen / 2 + perHouse * (i + 0.5);
          const pw = perHouse * 0.7, pd = 1.9;
          const p = new THREE.Mesh(new THREE.PlaneGeometry(pw, pd), MAT.solar);
          const ang = Math.atan2(rh, depth / 2 + 0.35);
          p.rotation.x = -Math.PI / 2 + ang;
          const z = -(depth / 2 + 0.35) * 0.5;
          p.position.set(hx, facadeH + rh * 0.5 + 0.06, z);
          group.add(p);
        }
      }
      // schoorstenen
      if (st.chimney) {
        const perHouse = unitLen / unitN; const chims = [];
        for (let i = 0; i < unitN; i++) {
          const hx = cx - unitLen / 2 + perHouse * (i + 0.5) + perHouse * 0.45;
          const cg = new THREE.BoxGeometry(0.5, 1.0, 0.5); cg.translate(hx, facadeH + rh + 0.2, 0.3); chims.push(cg);
        }
        group.add(new THREE.Mesh(mergeGeoms(chims), sideMat));
      }
    } else {
      // plat dak: dakrand
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
    // collider
    const wx = center.x + dLocal.x * cx, wz = center.y + dLocal.y * cx;
    addCollider(wx, wz, unitLen / 2, depth / 2, rotY, facadeH + roofH);
  };

  if (st.detached) {
    const gap = len0 / n;
    for (let i = 0; i < n; i++) placeUnit(-len0 / 2 + gap * (i + 0.5), st.w, 1, idx * 3 + i);
  } else if (st.semi) {
    const pairs = Math.max(1, Math.round(len0 / 17));
    const gap = len0 / pairs;
    for (let i = 0; i < pairs; i++) placeUnit(-len0 / 2 + gap * (i + 0.5), st.w * 2, 2, idx * 3 + i);
  } else {
    placeUnit(0, totalLen, n, idx);
  }

  // voortuinen: heg langs de straatkant, tegelpaadjes en struiken (samengevoegd per rij)
  const hedgeLen = (st.detached || st.semi) ? len0 : totalLen;
  const hedgeZ = depth / 2 + 5.2;
  const unitCount = st.detached ? n : (st.semi ? Math.max(1, Math.round(len0 / 17)) * 2 : n);
  if (row.type !== 'spil' && row.type !== 'appart') {
    const hedgeMat = new THREE.MeshStandardMaterial({ map: T.hedge().clone(), roughness: 1 });
    hedgeMat.map.needsUpdate = true; hedgeMat.map.repeat.set(hedgeLen / 1.2, 1);
    const hedge = new THREE.Mesh(new THREE.BoxGeometry(hedgeLen, 0.9, 0.5), hedgeMat);
    hedge.position.set(0, 0.45, hedgeZ); hedge.castShadow = true;
    group.add(hedge);
    const paths = [], bushes = [];
    for (let i = 0; i < unitCount; i++) {
      const hx = -hedgeLen / 2 + (hedgeLen / unitCount) * (i + 0.5) + ((i % 2) ? 1.4 : -1.4);
      const pg = new THREE.BoxGeometry(1.0, 0.03, 5.0); pg.translate(hx, 0.02, depth / 2 + 2.6); paths.push(pg);
      const bg = new THREE.SphereGeometry(0.6, 6, 5); bg.translate(hx + ((i % 2) ? -1.6 : 1.6), 0.5, depth / 2 + 3.0); bushes.push(bg);
    }
    group.add(new THREE.Mesh(mergeGeoms(paths), MAT.tiles));
    const bushMesh = new THREE.Mesh(mergeGeoms(bushes), MAT.leaf2); bushMesh.castShadow = true; group.add(bushMesh);
  }
  // achtertuinen: schuttingen en schuurtjes (één mesh per rij)
  {
    const parts = [];
    const f = new THREE.BoxGeometry(hedgeLen, 1.8, 0.08); f.translate(0, 0.9, -depth / 2 - 9.5); parts.push(f);
    for (const sgn of [-1, 1]) { const f2 = new THREE.BoxGeometry(0.08, 1.8, 9.5); f2.translate(sgn * hedgeLen / 2, 0.9, -depth / 2 - 4.75); parts.push(f2); }
    const shedCount = Math.max(1, Math.round(hedgeLen / 6));
    for (let i = 0; i < shedCount; i++) {
      const hx = -hedgeLen / 2 + (hedgeLen / shedCount) * (i + 0.5);
      const sg = new THREE.BoxGeometry(2.4, 2.2, 2.4); sg.translate(hx, 1.1, -depth / 2 - 8.0); parts.push(sg);
    }
    const back = new THREE.Mesh(mergeGeoms(parts), MAT.fence); back.castShadow = true; group.add(back);
  }
  if (row.label) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.1), new THREE.MeshBasicMaterial({ map: T.streetSign(row.label) }));
    sign.position.set(0, facadeH - 0.9, depth / 2 + 0.02); group.add(sign);
  }
  scene.add(group);
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
      if (!sPlaced && road.name !== 'N7') {
        const p = a.clone().add(d.clone().multiplyScalar(4)).add(nrm.clone().multiplyScalar(road.w / 2 + (pk.includes('L') ? 2.2 : 0) + 0.6));
        signs.push({ x: p.x, z: p.y, yaw: -Math.atan2(d.y, d.x), name: road.name });
        sPlaced = true;
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
    const lx = dx * c.cos + dz * c.sin, lz = -dx * c.sin + dz * c.cos;
    const px = Math.abs(lx) - c.hx, pz = Math.abs(lz) - c.hz;
    if (px < radius && pz < radius) {
      // dichtstbijzijnde as naar buiten duwen
      let nx = 0, nz = 0;
      if (px > pz) { nx = Math.sign(lx) * (radius - px); }
      else { nz = Math.sign(lz) * (radius - pz); }
      // terug naar wereld
      x += nx * c.cos - nz * c.sin;
      z += nx * c.sin + nz * c.cos;
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
