// Wereldopbouw: wegen, stoepen, parkeervakken, water, groen, huizen, straatmeubilair.
import * as THREE from 'three';
import { ROADS, HIGHWAY, WATER, WATERWAYS, WOODS, GRASS, ROWS, PROPS, PARKS, PARKING_LOTS, PLATEAUS, PLAYGROUND, START, PX_PER_M, toWorld } from './data.js';
import { maakProp, PROP_TYPES } from './props.js';
import * as T from './textures.js';
import { rng } from './textures.js';
import { KAART, bouwKaartWereld, ondergrondKaart, kaartStand, vlakOp } from './kaartwereld.js';

export const colliders = [];   // {cx,cz,hx,hz,cos,sin,h} georiënteerde rechthoeken
export const roadSegments = []; // voor straatnaam-detectie en NPC-paden: {name,a:[x,z],b:[x,z],w}
export const parkSpots = [];   // parkeerplaatsen voor auto's: {x,z,yaw}
export const treePositions = [];
export const lodGroepen = [];   // {obj,x,z} – fijn detail dat op afstand uit gaat
export const lampPosities = []; // {x,z} – koppen van de lantaarnpalen

// Binnen deze afstand tekent het spel boeiboorden, goten en regenpijpen.
const LOD_AFSTAND = 85;

// Zet het fijne werk aan of uit naar gelang de afstand tot de camera. Hoeft
// niet elk beeld: een paar keer per seconde is ruim genoeg.
export function updateLOD(camX, camZ) {
  const d2 = LOD_AFSTAND * LOD_AFSTAND;
  for (const g of lodGroepen) {
    const dx = g.x - camX, dz = g.z - camZ;
    const zichtbaar = dx * dx + dz * dz < d2;
    if (g.obj.visible !== zichtbaar) g.obj.visible = zichtbaar;
  }
}

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
  MAT.goot = new THREE.MeshStandardMaterial({ color: 0x3c3a37, roughness: 0.95 });
  MAT.paal = new THREE.MeshStandardMaterial({ color: 0x232629, roughness: 0.6, metalness: 0.3 });
  MAT.paalBand = new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.5 });
  MAT.streep = new THREE.MeshStandardMaterial({ color: 0xe6e4dc, roughness: 0.9 });
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
  MAT.hedgeRed = new THREE.MeshStandardMaterial({ map: T.hedge('rood'), roughness: 1 });
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

// De plateaus, zodat lantaarns, borden, kliko's en bomen er niet middenop komen.
const plateauVlakken = [];   // {x, z, bereik}
export function opPlateau(x, z, marge = 0) {
  for (const p of plateauVlakken) { if (Math.hypot(x - p.x, z - p.z) < p.bereik + marge) return true; }
  return false;
}

// Punt op arclengte s langs een polylijn (geclampt op de uiteinden).
function puntOpLengte(pts, s) {
  if (s <= 0) return pts[0].clone();
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = pts[i].distanceTo(pts[i - 1]);
    if (acc + l >= s) return pts[i - 1].clone().lerp(pts[i], (s - acc) / l);
    acc += l;
  }
  return pts[pts.length - 1].clone();
}

/*
 Kruispuntplateau: een vlak van rode klinkers dat vanuit een ronde kern in
 elke straatmond uitwaaiert. De armen worden uit de wegen zelf afgeleid, dus
 het plateau volgt automatisch mee als een straat verlegd wordt.

 De omtrek is stervormig ten opzichte van het midden: per straatmond twee
 hoekpunten, en tussen twee monden een boogje over de kern. Zo kan hij als
 waaier vanuit het midden getrianguleerd worden zonder overlappende vlakken,
 wat z-fighting zou geven.
*/
function buildPlateaus(scene, roads) {
  const vlakGeoms = [], gootGeoms = [], paalGeoms = [], bandGeoms = [];
  for (const pl of PLATEAUS) {
    const [cx, cz] = toWorld(pl.at[0], pl.at[1]);
    const c = new THREE.Vector2(cx, cz);
    plateauVlakken.push({ x: cx, z: cz, bereik: pl.arm });

    // straatmonden zoeken: elke weg die vlak langs het midden loopt
    const armen = [];
    for (const road of roads) {
      if (road.type === 'pad' || road.type === 'fietspad') continue;
      const pr = projectOnPolyline(c, road.pts);
      if (pr.d > pl.straal) continue;
      const totaal = polyLength(road.pts);
      const halfBreed = road.w / 2 + pl.extra;
      for (const richting of [1, -1]) {
        const s = pr.s + richting * pl.arm;
        if (s < 1 || s > totaal - 1) continue;          // weg houdt hier op
        const eind = puntOpLengte(road.pts, s);
        // Halverwege is de mond op zijn breedst; bij de oprit versmalt hij weer
        // tot net iets breder dan de rijbaan. Dat geeft de typische trechter.
        const mid = puntOpLengte(road.pts, pr.s + richting * pl.arm * 0.55);
        const d = eind.clone().sub(c);
        if (d.length() < pl.straal) continue;
        armen.push({ hoek: Math.atan2(d.y, d.x), eind, mid, halfBreed, tipBreed: road.w / 2 + 0.3 });
      }
    }
    armen.sort((a, b) => a.hoek - b.hoek);

    // Omtrek opbouwen. Per straatmond vier hoekpunten (versmallende trechter),
    // ertussen een boog over de kern. `open` markeert de rand die dwars over de
    // rijbaan loopt: daar komen natuurlijk geen paaltjes te staan.
    const rand = [];
    for (let i = 0; i < armen.length; i++) {
      const a = armen[i];
      const d = a.eind.clone().sub(c).normalize();
      const n = new THREE.Vector2(-d.y, d.x);
      const nb = n.clone().multiplyScalar(a.halfBreed);
      const nt = n.clone().multiplyScalar(a.tipBreed);
      rand.push({ p: a.mid.clone().sub(nb) });
      rand.push({ p: a.eind.clone().sub(nt), open: true });
      rand.push({ p: a.eind.clone().add(nt) });
      rand.push({ p: a.mid.clone().add(nb) });
      const volgende = armen[(i + 1) % armen.length];
      let h0 = a.hoek + Math.asin(Math.min(1, a.halfBreed / a.mid.distanceTo(c)));
      let h1 = volgende.hoek - Math.asin(Math.min(1, volgende.halfBreed / volgende.mid.distanceTo(c)));
      while (h1 < h0) h1 += Math.PI * 2;
      const stappen = Math.max(2, Math.round((h1 - h0) / 0.22));
      for (let k = 0; k <= stappen; k++) {
        const h = h0 + (h1 - h0) * (k / stappen);
        rand.push({ p: new THREE.Vector2(cx + Math.cos(h) * pl.straal, cz + Math.sin(h) * pl.straal) });
      }
    }
    if (!rand.length) continue;

    // Antiparkeerpaaltjes: om de anderhalve meter langs de rand, een halve meter
    // in het gras, behalve waar de rijbaan het plateau in of uit loopt.
    if (pl.paaltjes) {
      for (let i = 0; i < rand.length; i++) {
        if (rand[i].open) continue;
        const a = rand[i].p, b = rand[(i + 1) % rand.length].p;
        const d = b.clone().sub(a); const len = d.length();
        if (len < 0.4) continue;
        d.divideScalar(len);
        let uit = new THREE.Vector2(-d.y, d.x);
        if (uit.dot(a.clone().add(b).multiplyScalar(0.5).sub(c)) < 0) uit.negate();
        uit.multiplyScalar(0.5);
        for (let s = 1.1; s < len; s += 2.2) {
          const q = a.clone().add(d.clone().multiplyScalar(s)).add(uit);
          paalGeoms.push(paaltje(q.x, q.y));
          bandGeoms.push(paalBand(q.x, q.y));
        }
      }
    }

    // waaier vanuit het midden
    const pos = [], uv = [], idx = [];
    pos.push(cx, 0, cz); uv.push(cx * 0.5, cz * 0.5);
    for (const { p } of rand) { pos.push(p.x, 0, p.y); uv.push(p.x * 0.5, p.y * 0.5); }
    // De rand loopt met oplopende hoek rond het midden; van boven gezien is dat
    // met de klok mee, dus de driehoeken moeten omgekeerd om naar boven te kijken.
    for (let i = 1; i <= rand.length; i++) idx.push(0, i === rand.length ? 1 : i + 1, i);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    g.translate(0, ROAD_Y + 0.06, 0);
    vlakGeoms.push(g);

    // donkere goot dwars over het plateau
    if (pl.naad) {
      const n = pl.naad.map(vec);
      gootGeoms.push(ribbon(n, 0.18, ROAD_Y + 0.068, 0, 0.5));
    }
  }
  if (vlakGeoms.length) {
    const m = new THREE.Mesh(mergeGeoms(vlakGeoms), MAT.rood);
    m.receiveShadow = true; scene.add(m);
  }
  if (gootGeoms.length) scene.add(new THREE.Mesh(mergeGeoms(gootGeoms), MAT.goot));
  if (paalGeoms.length) {
    const m = new THREE.Mesh(mergeGeoms(paalGeoms), MAT.paal);
    m.castShadow = true; scene.add(m);
    scene.add(new THREE.Mesh(mergeGeoms(bandGeoms), MAT.paalBand));
  }
}

// Zwart antiparkeerpaaltje van 90 cm met een reflecterende band bovenin.
function paaltje(x, z) {
  const g = new THREE.CylinderGeometry(0.045, 0.055, 0.88, 6);
  g.translate(x, 0.45, z);
  return g;
}
function paalBand(x, z) {
  const g = new THREE.CylinderGeometry(0.048, 0.048, 0.07, 6);
  g.translate(x, 0.76, z);
  return g;
}

function buildRoads(scene) {
  const walkGeoms = [];
  const curbGeoms = [];
  const bayGeoms = [];
  const streepGeoms = [];
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
    // Een haakse parkeerstrook hoort bij de weg: voortuinen en hagen moeten
    // erachter blijven in plaats van er bovenop te liggen. Dat geldt alleen
    // voor de zijde waar hij ligt, dus de correctie is per kant.
    const haaks = road.haaks || '';
    const corrVan = (vg, metHaaks) => road.w / 2 + (isPath ? 0.4
      : metHaaks ? vg - 0.1 : Math.min(vergeL, vergeR) + 1.4);
    const corrL = corrVan(vergeL, haaks.includes('L'));
    const corrR = corrVan(vergeR, haaks.includes('R'));
    const corr = Math.min(corrL, corrR);
    for (let k = 0; k < pts.length - 1; k++) {
      roadSegments.push({
        name: road.name, a: [pts[k].x, pts[k].y], b: [pts[k + 1].x, pts[k + 1].y],
        w: road.w, corr, corrL, corrR, walkOff: walkOffL, walkOffL, walkOffR, drive: !isPath,
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
      // Haakse parkeerstrook: een doorlopend klinkervak met vakken dwars op de
      // rijbaan, met de stoep erachter. Zo ligt het aan het Kruirad: je stapt
      // uit de auto zo de tuin in. Zie 50 Kruirad en 174 Monnikmolen.
      if (haaks) {
        const rh2 = rng(i * 31 + 7);
        const DIEP = 5.0, VAK = 2.6;
        for (const sgn of [1, -1]) {
          if (sgn > 0 && !haaks.includes('L')) continue;
          if (sgn < 0 && !haaks.includes('R')) continue;
          const strook = ribbon(inner, DIEP, ROAD_Y + 0.008 + i * 0.0007, sgn * (road.w / 2 + DIEP / 2), 0.5);
          bayGeoms.push(strook);
          // vakken aftekenen en er auto's in zetten
          for (let k = 0; k < inner.length - 1; k++) {
            const a2 = inner[k], b2 = inner[k + 1];
            const d2 = b2.clone().sub(a2); const len2 = d2.length(); if (len2 < 1) continue;
            d2.normalize();
            const n2 = new THREE.Vector2(d2.y, -d2.x).multiplyScalar(sgn);
            for (let sp = VAK / 2; sp < len2 - VAK / 2; sp += VAK) {
              const c2 = a2.clone().add(d2.clone().multiplyScalar(sp)).add(n2.clone().multiplyScalar(road.w / 2 + DIEP / 2));
              if (rh2() < 0.42) parkSpots.push({ x: c2.x, z: c2.y, yaw: Math.atan2(-n2.x, -n2.y) });
              const lijn = a2.clone().add(d2.clone().multiplyScalar(sp - VAK / 2)).add(n2.clone().multiplyScalar(road.w / 2 + DIEP / 2));
              const lg = new THREE.PlaneGeometry(0.1, DIEP - 0.4);
              lg.rotateX(-Math.PI / 2); lg.rotateY(Math.atan2(d2.x, d2.y) + Math.PI / 2);
              lg.translate(lijn.x, ROAD_Y + 0.014 + i * 0.0007, lijn.y);
              streepGeoms.push(lg);
            }
          }
        }
      }
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
  if (bayGeoms.length) {
    const m = new THREE.Mesh(mergeGeoms(bayGeoms), MAT.klinker); m.receiveShadow = true; scene.add(m);
  }
  if (streepGeoms.length) scene.add(new THREE.Mesh(mergeGeoms(streepGeoms), MAT.streep));
  const walk = new THREE.Mesh(mergeGeoms(walkGeoms), MAT.tiles); walk.receiveShadow = true; scene.add(walk);
  scene.add(new THREE.Mesh(mergeGeoms(curbGeoms), MAT.curb));

  buildPlateaus(scene, roads);
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
      for (let s = 6; s < len - 4; s += 11.0) {
        for (const side of [1, -1]) {
          const vg = side > 0 ? vgL : vgR;
          if (vg < 1.6) continue;
          // In een brede grasberm staat een echte laan: grote bomen op vaste
          // afstand, zoals langs de noordwestzijde van de Molenkrite. In een
          // smalle berm blijft het losse aanplant.
          const laan = vg >= 3.6;
          if (!laan && r() < 0.42) continue;
          // De laanbomen staan achter de parkeerstrook, tussen de auto's en het
          // trottoir; losse bomen mogen dichter bij de rijbaan blijven.
          const p = a.clone().add(d.clone().multiplyScalar(s)).add(nrm.clone().multiplyScalar(side * (road.w / 2 + vg * (laan ? 0.80 : 0.55))));
          if (opPlateau(p.x, p.y, 2.0)) continue;
          if (nearBuilding(p, 2.5) || inWater(p) || nearParkBay(p, laan ? 0.4 : 2.0)) continue;
          treePositions.push({ x: p.x, z: p.y, s: laan ? 1.55 + r() * 0.25 : 0.95 + r() * 0.5 });
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
  const c = { cx, cz, hx, hz, cos: Math.cos(yaw), sin: Math.sin(yaw), h };
  colliders.push(c);
  return c;      // de aanroeper kan de doos later verplaatsen of weghalen (zie de poort in verhaal.js)
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
// Breedte van de wegkoker aan de kant waar het punt ligt: een haakse
// parkeerstrook maakt die kant breder dan de overkant.
function corrVoor(sgm, px, pz) {
  if (sgm.corrL == null) return sgm.corr;
  const dx = sgm.b[0] - sgm.a[0], dz = sgm.b[1] - sgm.a[1];
  const links = (px - sgm.a[0]) * dz - (pz - sgm.a[1]) * dx > 0;
  return links ? sgm.corrL : sgm.corrR;
}
function roadClearance(px, pz) {
  let best = 1e9;
  for (const sgm of roadSegments) {
    if (sgm.w === 0) continue;
    const d = distToSeg(px, pz, sgm.a[0], sgm.a[1], sgm.b[0], sgm.b[1]) - corrVoor(sgm, px, pz);
    if (d < best) best = d;
  }
  return best;
}
// Ruimte tot aan de rijbaan-as van de dichtstbijzijnde weg (voor de diepte van de voortuin)
function distToNearestRoadEdge(px, pz) {
  let best = 1e9;
  for (const sgm of roadSegments) {
    if (sgm.w === 0 || !sgm.drive) continue;
    const d = distToSeg(px, pz, sgm.a[0], sgm.a[1], sgm.b[0], sgm.b[1]) - corrVoor(sgm, px, pz);
    if (d < best) best = d;
  }
  return best;
}
// woods = false laat bomenstroken toe; een voortuin mag wel in een bosschage
// steken, want die polygonen zijn met de hand getekend en lopen soms een paar
// meter over de stoep heen.
function pointInUnitAny(px, pz, margin) {
  for (const u of units) if (pointInUnit(px, pz, u, margin)) return true;
  return false;
}

// Mag hier een object staan? Niet in een gebouw, niet op de rijbaan, niet in
// het water. De editor en tools/propcheck.mjs gebruiken dezelfde test.
export function vrijeObjectPlek(x, z, marge = 0.5) {
  if (pointInUnitAny(x, z, marge)) return 'gebouw';
  if (roadClearance(x, z) < -1.0) return 'rijbaan';
  if (inWater(new THREE.Vector2(x, z))) return 'water';
  return null;
}
function blocked(px, pz, margin, skipUnit = null, woods = true) {
  if (roadClearance(px, pz) < margin) return true;
  const v = new THREE.Vector2(px, pz);
  if (inWater(v) || inPark(v) || (woods && inWoods(v))) return true;
  for (const u of units) { if (u !== skipUnit && pointInUnit(px, pz, u, margin)) return true; }
  return false;
}

const rowBuilds = [];

// Gedeelde gevelmaterialen. Zonder deze cache kreeg elke woning een eigen
// materiaal met een eigen kloon van de baksteentexture; dat kostte honderden
// megabytes videogeheugen en duizenden statuswisselingen per beeld.
const gevelMats = new Map();
function gedeeldMat(sleutel, maak) {
  let m = gevelMats.get(sleutel);
  if (!m) { m = maak(); gevelMats.set(sleutel, m); }
  return m;
}

// Verspringende rooilijn. In Tinga loopt een lange rij niet in één rechte
// lijn: na zes à zeven woningen springt het blok een paar meter naar achteren
// en daarna weer naar voren. Een rij met { stagger: { houses, step } } wordt
// hier opgeknipt in blokken met om en om een grotere afstand tot de weg.
function expandStagger(row) {
  if (!row.stagger) return [row];
  const st = stijlVan(row);
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
// De rij mag eigenschappen van het woningtype overschrijven: dakkapel,
// dakraam, zonnepanelen, schoorsteen en het aantal lagen. Zo maak je in de
// editor variatie zonder een nieuw type te hoeven schrijven.
function stijlVan(row) {
  const basis = T.HOUSE_STYLES[row.type] || T.HOUSE_STYLES.molenkrite;
  return row.stijl ? { ...basis, ...row.stijl } : basis;
}

function buildRow(scene, row, idx) {
  const st = stijlVan(row);
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
  const facadeH = storeys * (st.storeyH || 2.9);
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
    if (inWoods(vv)) return 'bosschage';
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
  // De automatische verdichting mag geen losse woningen achterlaten. Waar van
  // een rug-aan-rug rij maar één woning past, hoort er helemaal niets te staan:
  // dat levert een huis midden in een weiland op, zoals bij de ingang van De
  // Wieken gebeurde. Twee of meer aaneengesloten woningen leest als een blok.
  if (row.generated) {
    for (let i = runs.length - 1; i >= 0; i--) if (runs[i].n < 2) runs.splice(i, 1);
  }
  if (runs.length === 0) return;
  // registreer de blokken (voor latere controles)
  for (const run of runs) {
    const wc = toWorldLocal(run.cx, 0);
    run.unit = { cx: wc.x, cz: wc.y, hx: run.len / 2, hz: depth / 2, cos: Math.cos(rotY), sin: Math.sin(rotY), rowIdx: idx };
    units.push(run.unit);
  }

  const group = new THREE.Group();
  const detail = new THREE.Group();           // fijn werk, alleen dichtbij zichtbaar
  group.add(detail);
  group.position.set(center.x, 0, center.y);
  group.rotation.y = rotY;
  group.userData.src = row.src;               // index in ROWS, of undefined
  group.userData.generated = !!row.generated; // automatische verdichting

  const placeUnit = (cx, unitLen, unitN, seed) => {
    const sleutel = `${row.type}|${unitN}|${storeys}|${seed % 6}`;
    const fm = gedeeldMat('f' + sleutel, () =>
      new THREE.MeshStandardMaterial({ map: T.facade(row.type, unitN, storeys, false, seed), roughness: 0.9 }));
    const bm = gedeeldMat('b' + sleutel, () =>
      new THREE.MeshStandardMaterial({ map: T.facade(row.type, unitN, storeys, true, seed), roughness: 0.9 }));
    // De zijmuur herhaalt de baksteen naar diepte en hoogte, dus die hangt aan
    // de maten van het blok in plaats van aan de woning.
    const sideMat = gedeeldMat(`z|${row.type}|${seed % 4}|${depth.toFixed(2)}|${facadeH.toFixed(2)}`, () => {
      const brickTex = (st.plaster ? T.plaster(st.brick[0]) : T.brick(st.brick[0], st.brick[1], seed)).clone();
      brickTex.needsUpdate = true;
      brickTex.repeat.set(depth / 2.6, facadeH / 2.6);
      return new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.95 });
    });
    const top = gedeeldMat('dak_plat', () => new THREE.MeshStandardMaterial({ map: T.bitumen(), roughness: 1 }));
    const body = new THREE.Mesh(new THREE.BoxGeometry(unitLen, facadeH, depth), [sideMat, sideMat, top, sideMat, fm, bm]);
    body.position.set(cx, facadeH / 2, 0);
    body.castShadow = true; body.receiveShadow = true;
    group.add(body);

    if (st.roofType === 'gable' || st.roofType === 'low') {
      const rh = st.roofType === 'low' ? 1.6 : roofH;
      const roofMat = gedeeldMat('dak|' + st.roof, () => new THREE.MeshStandardMaterial({ map: T.roofTiles(st.roof), roughness: 0.9 }));
      const roof = gableRoof(unitLen, depth, rh, roofMat);
      // het dakvlak loopt door over het overstek; laat het zakken zodat de dakrand
      // precies op de muur landt in plaats van er 30 cm boven te zweven
      const OV = 0.35;
      const eaveDrop = rh * OV / (depth / 2 + OV);
      roof.position.set(cx, facadeH - eaveDrop, 0); roof.castShadow = true;
      group.add(roof);
      // Boeiboord, goot en regenpijpen zijn fijn werk dat je op afstand toch
      // niet ziet. Ze gaan in de detailgroep, die pas binnen LOD_AFSTAND meedoet.
      for (const sgn of [1, -1]) {
        const fascia = new THREE.Mesh(new THREE.BoxGeometry(unitLen + OV * 2, 0.22, 0.10), MAT.white);
        fascia.position.set(cx, facadeH - eaveDrop - 0.06, sgn * (depth / 2 + OV));
        detail.add(fascia);
        const gutter = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, unitLen + OV * 2, 6), MAT.gutter);
        gutter.rotation.z = Math.PI / 2;
        gutter.position.set(cx, facadeH - eaveDrop - 0.20, sgn * (depth / 2 + OV + 0.04));
        detail.add(gutter);
      }
      // regenpijpen op de scheiding tussen de woningen
      const pipes = [];
      for (let i = 0; i <= unitN; i++) {
        const hx = cx - unitLen / 2 + (unitLen / unitN) * i;
        const pg = new THREE.CylinderGeometry(0.045, 0.045, facadeH - eaveDrop - 0.2, 6);
        pg.translate(hx, (facadeH - eaveDrop - 0.2) / 2, depth / 2 + 0.06);
        pipes.push(pg);
      }
      detail.add(new THREE.Mesh(mergeGeoms(pipes), MAT.gutter));
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
      /* Doorlopende laagbouw met plat dak voor de gevel. Aan het Kruirad, de
         Monnikmolen en de Binnenroede staat die over de volle breedte van het
         hele blok: een gemetselde strook van ruim twee meter diep en 2,65 hoog
         met daarin de voordeuren en een klein raam, met het tweelaagse
         hoofdvolume erachter. Zie Kruirad 62 op street view. */
      if (st.voorbouw) {
        const perHouse2 = unitLen / unitN;
        const vd = 2.4, vh = 2.65;
        const zc = depth / 2 + vd / 2;
        const romp = new THREE.BoxGeometry(unitLen, vh, vd); romp.translate(cx, vh / 2, zc);
        const m1 = new THREE.Mesh(romp, sideMat); m1.castShadow = true; m1.receiveShadow = true;
        // dakrand: een witte band rondom, iets uitkragend
        const rand = new THREE.BoxGeometry(unitLen + 0.14, 0.18, vd + 0.14); rand.translate(cx, vh + 0.07, zc);
        const deuren = [], ramen = [], kozijnen = [];
        for (let i = 0; i < unitN; i++) {
          const links = cx - unitLen / 2 + perHouse2 * i;
          // De voordeur zit een halve meter uit de zijgevel; bij oneven woningen
          // is de gevel gespiegeld, dus dan zit hij aan de andere kant.
          const gespiegeld = (i % 2 === 1) && !st.detached;
          const dx = links + (gespiegeld ? perHouse2 - 0.5 - 0.48 : 0.5 + 0.48);
          const zf = depth / 2 + vd + 0.03;
          const dz = new THREE.BoxGeometry(0.96, 2.15, 0.07); dz.translate(dx, 1.08, zf); deuren.push(dz);
          // raampje naast de deur
          const rx = links + (gespiegeld ? perHouse2 * 0.33 : perHouse2 * 0.67);
          const kg = new THREE.BoxGeometry(1.5, 1.15, 0.06); kg.translate(rx, 1.55, zf); kozijnen.push(kg);
          const rg = new THREE.BoxGeometry(1.32, 0.97, 0.05); rg.translate(rx, 1.55, zf + 0.02); ramen.push(rg);
        }
        const dm = gedeeldMat('vbdeur|' + st.door[0], () => new THREE.MeshStandardMaterial({ color: st.door[0], roughness: 0.7 }));
        const km = gedeeldMat('vbkozijn|' + st.frame, () => new THREE.MeshStandardMaterial({ color: st.frame, roughness: 0.8 }));
        group.add(m1, new THREE.Mesh(rand, MAT.white), new THREE.Mesh(mergeGeoms(deuren), dm),
                  new THREE.Mesh(mergeGeoms(kozijnen), km), new THREE.Mesh(mergeGeoms(ramen), MAT.glassDark));
        const p2 = toWorldLocal(cx, zc);
        addCollider(p2.x, p2.y, unitLen / 2, vd / 2, rotY, vh);
      }
      // Frans balkonhekje voor de raamband op de verdieping.
      if (st.balkon && storeys > 1) {
        const yb = facadeH / storeys + 0.12;
        for (const dy of [0.42, 0.92]) {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(unitLen - 0.3, 0.055, 0.05), MAT.railing);
          rail.position.set(cx, yb + dy, depth / 2 + 0.2); group.add(rail);
        }
        const spijlen = [];
        const n2 = Math.max(2, Math.round(unitLen / 0.28));
        for (let k = 0; k <= n2; k++) {
          const hx = cx - (unitLen - 0.3) / 2 + ((unitLen - 0.3) / n2) * k;
          const pg = new THREE.CylinderGeometry(0.022, 0.022, 0.95, 4);
          pg.translate(hx, yb + 0.5, depth / 2 + 0.2); spijlen.push(pg);
        }
        detail.add(new THREE.Mesh(mergeGeoms(spijlen), MAT.railing));
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

  // Kopgevels: de blinde zijmuur van een eindwoning krijgt een paar ramen, zoals
  // in de wijk. Zonder die ramen staat er een kale bakstenen vlakte langs de weg.
  if (!st.detached && st.roofType !== 'flat') {
    const glass = new THREE.MeshStandardMaterial({ color: 0x1d2733, roughness: 0.25, metalness: 0.1 });
    const frameMat = new THREE.MeshStandardMaterial({ color: st.frame || '#ffffff', roughness: 0.85 });
    const panes = [], frames = [];
    for (const run of runs) {
      for (const sgn of [-1, 1]) {
        const wx = run.cx + sgn * (run.len / 2);
        for (let laag = 0; laag < storeys; laag++) {
          const wy = laag * 2.9 + 1.55;
          const wz = (laag === 0 ? -1 : 1) * depth * 0.20;   // beneden achterin, boven vooraan
          const w2 = 0.95, h2 = 1.15;
          const g = new THREE.BoxGeometry(0.06, h2, w2); g.translate(wx + sgn * 0.03, wy, wz); panes.push(g);
          const f = new THREE.BoxGeometry(0.05, h2 + 0.16, w2 + 0.16); f.translate(wx + sgn * 0.02, wy, wz); frames.push(f);
        }
      }
    }
    if (panes.length) {
      const pm = new THREE.Mesh(mergeGeoms(frames), frameMat); pm.castShadow = true; group.add(pm);
      group.add(new THREE.Mesh(mergeGeoms(panes), glass));
    }
  }
  if (row.label) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.1), new THREE.MeshBasicMaterial({ map: T.streetSign(row.label) }));
    sign.position.set(runs[0].cx, facadeH - 0.9, depth / 2 + 0.02); group.add(sign);
  }
  scene.add(group);
  if (detail.children.length) lodGroepen.push({ obj: detail, x: center.x, z: center.y });
  rowBuilds.push({ row, st, runs, group, depth, toWorldLocal, facadeH, why });
}

// Fase 2: tuinen. Elke woning krijgt een eigen voortuintje: het ene met een lage
// heg, het andere met een houten kruishekje, een conifeer of gewoon gras met
// wat struiken. De diepte volgt de werkelijk beschikbare ruimte tot het trottoir.
// Staat er met de hand een object neergezet (zie PROPS), dan houdt de
// automatische tuinaankleding daar afstand van: anders groeit er een boompje
// dwars door het gezelschap in de voortuin van 19 Molenkrite heen.
let propPlekken = null;
function propNabij(x, z, r = 1.8) {
  if (!propPlekken) {
    propPlekken = PROPS.map(p => { const [px, pz] = toWorld(p.at[0], p.at[1]); return { x: px, z: pz, s: p.scale || 1 }; });
  }
  for (const p of propPlekken) if (Math.hypot(x - p.x, z - p.z) < r * p.s) return true;
  return false;
}

function buildGardens() {
  for (const rb of rowBuilds) {
    const { row, st, runs, group, depth, toWorldLocal, why } = rb;
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
          if (blocked(p.x, p.y, 0.2, run.unit, false)) { frontAvail = Math.min(frontAvail, k - 0.6); break; }
        }
      }

      if (globalThis.__gprobe && !row.generated) {
        let reden = '';
        if (frontAvail < 3) {
          let worst = 99, wp = null;
          for (let x = run.cx - run.len / 2 + 1; x <= run.cx + run.len / 2 - 1; x += 2.5) {
            for (let k = 0.6; k <= 5.6; k += 0.4) {
              const p = toWorldLocal(x, depth / 2 + k);
              if (blocked(p.x, p.y, 0.2, run.unit, false)) { if (k < worst) { worst = k; wp = p; } break; }
            }
          }
          if (wp) reden = ` <- ${why(wp.x, wp.y, 0.2)} op ${worst.toFixed(1)} m`;
        }
        console.warn(`TUIN ${row.type} [${row.a}]-[${row.b}] off ${row.off}: voor ${frontAvail.toFixed(1)} m, achter ${backAvail.toFixed(1)} m${reden}`);
      }
      // ---------- voortuinen, per woning een eigen inrichting ----------
      if (row.type !== 'spil' && row.type !== 'appart' && frontAvail >= 1.3) {
        const r = rng(Math.round(Math.abs(run.unit.cx) * 31 + Math.abs(run.unit.cz) * 17) + 1);
        const buckets = { tiles: [], picket: [], plank: [], hedge: [], hedgeRed: [], conifer: [], shrubA: [], shrubB: [], shrubC: [], gravel: [], bench: [], trunk: [], leaf: [] };
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
            if (st.voorschutting) {      // houten schutting rond de voortuin
              const f2 = new THREE.BoxGeometry(segLen, 1.7, 0.09);
              f2.translate(cx2, 0.85, zEdge); buckets.plank.push(f2);
            } else if (style === 1) {    // houten kruishekje
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
            if (st.voorbouw && sz < z0 + 3.0) continue;   // daar staat de laagbouw
            const sw = toWorldLocal(sx, sz);
            if (propNabij(sw.x, sw.y, 1.2)) continue;
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
            const tw2 = toWorldLocal(tx, tz);
            if (!propNabij(tw2.x, tw2.y, 2.4)) {
              const tr = new THREE.CylinderGeometry(0.07, 0.09, 2.2, 5); tr.translate(tx, 1.1, tz); buckets.trunk.push(tr);
              const lf = new THREE.SphereGeometry(0.85, 7, 6); lf.scale(1, 0.85, 1); lf.translate(tx, 2.5, tz); buckets.leaf.push(lf);
            }
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
        const matOf = { tiles: MAT.tiles, picket: MAT.picket, plank: MAT.fence, hedge: MAT.hedge, hedgeRed: MAT.hedgeRed, conifer: MAT.conifer, shrubA: MAT.shrubA, shrubB: MAT.shrubB, shrubC: MAT.shrubC, gravel: MAT.gravel, bench: MAT.bench, trunk: MAT.trunk, leaf: MAT.leaf, bike: MAT.bikeFrame, tyre: MAT.tyre, pot: MAT.pot, tarp: MAT.tarp, stone: MAT.gravel };
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
          const hm = gedeeldMat('heg|' + run.len.toFixed(2), () => {
            const t = T.hedge().clone(); t.needsUpdate = true; t.repeat.set(run.len / 1.2, 1);
            return new THREE.MeshStandardMaterial({ map: t, roughness: 1 });
          });
          // Op de foto's van het Kruirad staan die achtertuinhagen op
          // ooghoogte: hoog genoeg om de tuin af te schermen, laag genoeg om
          // over de daken heen te blijven kijken.
          const h = new THREE.Mesh(new THREE.BoxGeometry(run.len, 1.45, 0.62), hm);
          h.position.set(run.cx, 0.72, -depth / 2 - backAvail); h.castShadow = true;
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

// ---------- Losse objecten (carports, borden, speeltoestellen, ...) ----------
// Bewegende onderdelen van objecten: de arm met het bierflesje, en de plek van
// elke radio zodat het geluid meeloopt met hoe dicht je erbij staat.
export const drinkArmen = [];
export const radioPlekken = [];

// Af en toe gaat het flesje naar de mond en weer omlaag. Elk poppetje heeft
// zijn eigen tempo, anders drinken ze als een peloton.
export function updateProps(dt) {
  for (const a of drinkArmen) {
    a.fase += dt / a.duur;
    if (a.fase >= 1) a.fase -= 1;
    // een slok duurt kort; de rest van de tijd ligt de arm op de leuning
    const f = a.fase < 0.25 ? Math.sin(a.fase / 0.25 * Math.PI) : 0;
    a.obj.rotation.x = f * 1.35;
  }
}

function buildProps(scene) {
  for (const p of PROPS) {
    const def = PROP_TYPES[p.type];
    const obj = maakProp(p.type);
    if (!obj || !def) { console.warn(`onbekend object: ${p.type}`); continue; }
    const [x, z] = toWorld(p.at[0], p.at[1]);
    const s = p.scale || 1;
    obj.position.set(x, 0, z);
    obj.rotation.y = (p.yaw || 0) * Math.PI / 180;
    obj.scale.setScalar(s);
    obj.userData.prop = p.src;
    obj.traverse(o => { o.castShadow = true; o.receiveShadow = true; });
    scene.add(obj);
    const arm = obj.getObjectByName('drinkarm');
    if (arm) drinkArmen.push({ obj: arm, fase: arm.userData.drinkfase || 0, duur: 7 + (p.src % 5) * 1.7 });
    if (p.type === 'radiotafel') radioPlekken.push({ x, z });
    const bezwaar = vrijeObjectPlek(x, z);
    if (bezwaar) console.warn(`object ${p.src} ${p.type} op [${p.at}] staat in ${bezwaar === 'rijbaan' ? 'de rijbaan' : bezwaar === 'water' ? 'het water' : 'een gebouw'}`);
    // botsingsdoos, behalve voor dingen waar je onderdoor of overheen loopt
    if (!['haag', 'struik', 'vijverrand', 'zandbak', 'pergola', 'carport', 'veranda'].includes(p.type)) {
      addCollider(x, z, def.maat[0] * s / 2, def.maat[1] * s / 2, -obj.rotation.y, def.h * s);
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

// ---------- Bomen (instanced, per tegel) ----------
/*
 De 3177 bomen stonden in drie instanced meshes voor de hele wijk. Dat is zuinig
 in draw calls, maar three.js kan zo'n mesh alleen in zijn geheel wegcullen — en
 een mesh die over de hele wijk ligt valt nooit buiten beeld. De GPU kreeg dus
 elk beeld alle bomen, ook die achter je: ruim een half miljoen driehoeken.

 Nu gaan ze per vak van 160 m in een eigen stel meshes. Je ziet er meestal een
 stuk of acht, dus er blijft een kwart van over, tegen een handvol draw calls
 meer.
*/
const BOOMTEGEL = 240;

function boomTegels(lijst) {
  const per = new Map();
  for (const t of lijst) {
    const k = `${Math.floor(t.x / BOOMTEGEL)}:${Math.floor(t.z / BOOMTEGEL)}`;
    if (!per.has(k)) per.set(k, []);
    per.get(k).push(t);
  }
  return [...per.values()];
}

function buildTrees(scene) {
  const normal = treePositions.filter(t => !t.tall);
  const tall = treePositions.filter(t => t.tall);
  const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const r = rng(99);

  // gewone straat- en parkbomen: brede bolkroon
  if (normal.length) {
    // De kroon begint pas op ruim twee meter: anders loop je op het trottoir
    // met je hoofd door de bladeren en zie je in een screenshot alleen groen.
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.28, 5.0, 6);
    const leafGeo = new THREE.IcosahedronGeometry(2.2, 1);
    // de tweede, kleinere kroon zit boven op de eerste en is alleen een bobbel
    // in het silhouet: die mag met twintig vlakken toe in plaats van tachtig
    const leafGeoGrof = new THREE.IcosahedronGeometry(2.2, 0);
    for (const groep of boomTegels(normal)) {
      const n = groep.length;
      const trunks = new THREE.InstancedMesh(trunkGeo, MAT.trunk, n);
      const leavesA = new THREE.InstancedMesh(leafGeo, MAT.leaf, n);
      const leavesB = new THREE.InstancedMesh(leafGeoGrof, MAT.leaf2, n);
      groep.forEach((t, i) => {
        const s2 = t.s; q.identity();
        // Een grote laanboom heeft ook een dikkere stam, anders staat er een
        // enorme kroon op een stokje.
        const dik = 0.6 + s2 * 0.4;
        m.compose(new THREE.Vector3(t.x, 2.5 * s2, t.z), q, new THREE.Vector3(dik, s2, dik)); trunks.setMatrixAt(i, m);
        q.setFromEuler(new THREE.Euler(r() * 3, r() * 3, 0));
        m.compose(new THREE.Vector3(t.x, 5.2 * s2, t.z), q, new THREE.Vector3(s2 * (0.95 + r() * 0.45), s2 * (0.85 + r() * 0.4), s2 * (0.95 + r() * 0.45))); leavesA.setMatrixAt(i, m);
        q.setFromEuler(new THREE.Euler(r() * 3, r() * 3, 0));
        m.compose(new THREE.Vector3(t.x + (r() - 0.5) * 1.4 * s2, 6.7 * s2, t.z + (r() - 0.5) * 1.4 * s2), q, new THREE.Vector3(s2 * 0.85, s2 * 0.7, s2 * 0.85)); leavesB.setMatrixAt(i, m);
        if (!t.vrij) addCollider(t.x, t.z, 0.3 * dik, 0.3 * dik, 0, 3);
      });
      trunks.castShadow = true; leavesA.castShadow = true; leavesB.castShadow = true;
      trunks.computeBoundingSphere(); leavesA.computeBoundingSphere(); leavesB.computeBoundingSphere();
      scene.add(trunks, leavesA, leavesB);
    }
  }

  // populieren langs de parkpaden: hoge, rechte stam met smalle kroon
  if (tall.length) {
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.30, 5.4, 7);
    const leafGeo = new THREE.IcosahedronGeometry(2.0, 1);
    const leafGeoGrof = new THREE.IcosahedronGeometry(2.0, 0);
    for (const groep of boomTegels(tall)) {
      const n = groep.length;
      const trunks = new THREE.InstancedMesh(trunkGeo, MAT.trunkPale, n);
      const crownA = new THREE.InstancedMesh(leafGeo, MAT.leaf, n * 2);
      const crownB = new THREE.InstancedMesh(leafGeoGrof, MAT.leaf2, n * 2);
      groep.forEach((t, i) => {
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
        if (!t.vrij) addCollider(t.x, t.z, 0.45, 0.45, 0, 3);
      });
      trunks.castShadow = true; crownA.castShadow = true; crownB.castShadow = true;
      trunks.computeBoundingSphere(); crownA.computeBoundingSphere(); crownB.computeBoundingSphere();
      scene.add(trunks, crownA, crownB);
    }
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
        if (opPlateau(p.x, p.y, 1.5)) continue;   // niet middenop een kruispunt
        lamps.push({ x: p.x, z: p.y, yaw: -Math.atan2(d.y, d.x), side });
      }
      // straatnaambord + 30-bord aan het begin van elke weg, net buiten het plateau
      if (!sPlaced) {
        const p = a.clone().add(d.clone().multiplyScalar(9)).add(nrm.clone().multiplyScalar(road.w / 2 + 0.8));
        if (!opPlateau(p.x, p.y, 1.0)) {
          signs.push({ x: p.x, z: p.y, yaw: -Math.atan2(d.y, d.x), name: road.name });
          sPlaced = true;
        }
      }
      if (k === pts.length - 2) {
        const p = b.clone().sub(d.clone().multiplyScalar(9)).add(nrm.clone().multiplyScalar(-(road.w / 2 + 0.8)));
        if (!opPlateau(p.x, p.y, 1.0)) signs.push({ x: p.x, z: p.y, yaw: -Math.atan2(d.y, d.x), name: road.name });
      }
      // kliko's bij de stoeprand
      for (let s = 9; s < len; s += 23) {
        if (r() < 0.55) continue;
        const side = r() < 0.5 ? 1 : -1;
        const p = a.clone().add(d.clone().multiplyScalar(s)).add(nrm.clone().multiplyScalar(side * (road.w / 2 + 0.9)));
        if (opPlateau(p.x, p.y, 1.0)) continue;
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
    lampPosities.push({ x: l.x + off2.x, y: 5.2, z: l.z + off2.z });
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
  // Parkeerhof. Met rijen: 2 komen er aan weerszijden haakse vakken met een
  // rijloper ertussen, zoals het hof binnen de lus van het Kruirad.
  const hofStreepGeoms = [];
  for (const lot of PARKING_LOTS) {
    const [x, z] = toWorld(lot.at[0], lot.at[1]);
    const g = new THREE.PlaneGeometry(lot.l, lot.w);
    const mesh = new THREE.Mesh(g, MAT.klinker);
    mesh.rotation.x = -Math.PI / 2; mesh.rotation.z = lot.angle; mesh.position.set(x, ROAD_Y + 0.02, z);
    mesh.receiveShadow = true; scene.add(mesh);
    // richting van de lengte en van de breedte in de wereld
    const ux = Math.cos(lot.angle), uz = -Math.sin(lot.angle);
    const nx = -Math.sin(lot.angle), nz = -Math.cos(lot.angle);
    if (lot.rijen === 0) continue;              // alleen bestrating, geen vakken
    if ((lot.rijen || 1) < 2) {
      for (let s = -lot.l / 2 + 3; s < lot.l / 2 - 2; s += 5.5) {
        const px = x + ux * s, pz = z + uz * s;
        if (r() < 0.65) parkSpots.push({ x: px, z: pz, yaw: -lot.angle + Math.PI / 2, driveable: r() < 0.3 });
      }
      continue;
    }
    const vakDiep = 5.0, vakBreed = 2.5;
    for (const kant of [-1, 1]) {
      const d = kant * (lot.w / 2 - vakDiep / 2);
      for (let s = -lot.l / 2 + vakBreed / 2; s <= lot.l / 2 - vakBreed / 2; s += vakBreed) {
        const px = x + ux * s + nx * d, pz = z + uz * s + nz * d;
        if (r() < 0.62) parkSpots.push({ x: px, z: pz, yaw: lot.angle + (kant > 0 ? Math.PI : 0), driveable: r() < 0.2 });
        // belijning tussen de vakken
        const sl = new THREE.PlaneGeometry(0.1, vakDiep - 0.3);
        sl.rotateX(-Math.PI / 2); sl.rotateY(-lot.angle);
        const lx = x + ux * (s - vakBreed / 2) + nx * d, lz2 = z + uz * (s - vakBreed / 2) + nz * d;
        sl.translate(lx, ROAD_Y + 0.03, lz2);
        hofStreepGeoms.push(sl);
      }
    }
  }
  if (hofStreepGeoms.length) scene.add(new THREE.Mesh(mergeGeoms(hofStreepGeoms), MAT.streep));

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
// Alles wat buildWorld aan de scene hangt, zodat de editor de wereld opnieuw
// kan opbouwen zonder de pagina te herladen.
const worldObjects = [];

export function resetWorld(scene) {
  for (const o of worldObjects) {
    scene.remove(o);
    o.traverse && o.traverse(c => {
      if (c.geometry) c.geometry.dispose();
      const mats = Array.isArray(c.material) ? c.material : (c.material ? [c.material] : []);
      for (const m of mats) { if (m.map) m.map.dispose(); m.dispose(); }
    });
  }
  worldObjects.length = 0;
  gevelMats.clear();
  colliders.length = 0; roadSegments.length = 0; parkSpots.length = 0; treePositions.length = 0;
  units.length = 0; rowBuilds.length = 0;
  lodGroepen.length = 0; lampPosities.length = 0; plateauVlakken.length = 0;
  drinkArmen.length = 0; radioPlekken.length = 0; propPlekken = null;
  waterPolys.length = 0; parkPolys.length = 0; woodPolys.length = 0;
}

export function buildWorld(scene) {
  const bekend = new Set(scene.children);
  materials();
  // Kaart uit BGT en 3D BAG (js/kaart.js): dan komt alles daaruit en blijven
  // alleen de losse objecten uit de editor (PROPS) over.
  if (KAART) {
    bouwKaartWereld(scene, { MAT, colliders, roadSegments, parkSpots, treePositions, lampPosities, waterPolys, addCollider, maakProp });
    buildTrees(scene);
    if (kaartStand() !== 'plat') buildReeds(scene);
    if (kaartStand() !== 'plat') buildProps(scene);
    for (const c of scene.children) if (!bekend.has(c)) worldObjects.push(c);
    return { colliders, roadSegments, parkSpots, waterPolys };
  }
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
    if (row.flip || row.showroom || row.nodens || skip.has(row.type)) continue;
    const sign = row.off < 0 ? -1 : 1;
    generated.push({ ...row, off: sign * (Math.abs(row.off) + 2 * row.depth + GARDENS), flip: true, generated: true });
  }
  // en nog een derde rij voor de diepe blokken
  for (const row of allRows) {
    if (row.flip || row.showroom || row.nodens || skip.has(row.type) || row.type === 'detached' || row.type === 'bonkelaar') continue;
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
  buildProps(scene);
  for (const c of scene.children) if (!bekend.has(c)) worldObjects.push(c);
  return { colliders, roadSegments, parkSpots, waterPolys };
}

/*
 Vrij zicht van (x1,z1) naar (x2,z2)? Loopt de lijn in stappen langs en kijkt of
 er een botsingsdoos in de weg staat die hoger is dan `hoogte`. De bewaking op
 het RWZI-terrein gebruikt dit (js/bewaking.js): achter een gebouw of achter de
 vrachtwagen zien ze je niet en schieten ze niet.
*/
export function zichtVrij(x1, z1, x2, z2, hoogte = 1.2) {
  const dx = x2 - x1, dz = z2 - z1;
  const L = Math.hypot(dx, dz);
  if (L < 1) return true;
  const stappen = Math.min(30, Math.max(2, Math.round(L / 2)));
  for (let i = 1; i < stappen; i++) {
    const t = i / stappen;
    const x = x1 + dx * t, z = z1 + dz * t;
    for (const c of colliders) {
      if (c.h < hoogte) continue;
      const ax = x - c.cx, az = z - c.cz;
      const lx = ax * c.cos - az * c.sin, lz = ax * c.sin + az * c.cos;
      if (Math.abs(lx) < c.hx && Math.abs(lz) < c.hz) return false;
    }
  }
  return true;
}

/*
 Hoe ver kan de camera achteruit voordat hij door een muur zakt? Loopt van het
 draaipunt (px,py,pz) langs de richting (dx,dy,dz) naar buiten en levert de
 afstand tot het eerste obstakel, met een marge zodat de camera er niet tegenaan
 plakt. Wordt elk beeld gebruikt door de derdepersoonscamera (js/derdepersoon.js).

 De wijk heeft bijna vijfduizend botsingsdozen, dus eerst wordt er een korte
 lijst gemaakt van de dozen die überhaupt in de buurt liggen; daarna hoeven de
 stapjes langs de straal alleen die paar te toetsen. De hoogte telt mee: een
 heg van een meter houdt de camera niet tegen.
*/
const camKandidaten = [];
export function vrijeCamera(px, py, pz, dx, dy, dz, maxD, marge = 0.35) {
  camKandidaten.length = 0;
  const bereik = maxD + 3;
  for (const c of colliders) {
    if (c.h < 0.6) continue;
    if (Math.abs(c.cx - px) > bereik + c.hx || Math.abs(c.cz - pz) > bereik + c.hz) continue;
    camKandidaten.push(c);
  }
  if (!camKandidaten.length) return maxD;
  const stap = 0.25;
  for (let d = stap; d <= maxD; d += stap) {
    const x = px + dx * d, y = py + dy * d, z = pz + dz * d;
    if (y < 0.35) return Math.max(0, d - stap - marge * 0.5);
    for (const c of camKandidaten) {
      if (c.h < y) continue;
      const ax = x - c.cx, az = z - c.cz;
      const lx = ax * c.cos - az * c.sin, lz = ax * c.sin + az * c.cos;
      if (Math.abs(lx) < c.hx + marge && Math.abs(lz) < c.hz + marge) return Math.max(0, d - stap - marge * 0.5);
    }
  }
  return maxD;
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

/*
 Sta je in het water? Op een brug, een duiker of een steiger niet: die liggen in
 de BGT boven het waterdeel, dus het waterpolygoon loopt eronderdoor. Zonder
 deze uitzondering kwam je op geen enkele brug (en dus ook niet over de dam naar
 de boerderij en de waterzuivering).
*/
const BOVEN_WATER = new Set(['brug', 'steiger', 'duiker', 'overbrugging']);
export function pointInWater(x, z) {
  if (KAART) {
    const v = vlakOp(x, z);
    if (v && BOVEN_WATER.has(v.k)) return false;
  }
  return inWater(new THREE.Vector2(x, z));
}

// Waar loop je op? Bepaalt de klank van de voetstappen.
export function ondergrondOp(x, z) {
  if (KAART) return ondergrondKaart(x, z);
  let best = 1e9, beste = null;
  for (const s of roadSegments) {
    if (s.w === 0) continue;
    const d = distToSeg(x, z, s.a[0], s.a[1], s.b[0], s.b[1]);
    if (d < best) { best = d; beste = s; }
  }
  if (!beste) return 'gras';
  if (beste.drive && best < beste.w / 2 + 0.3) return 'klinker';   // rijbaan
  if (best < beste.corr + 0.6) return 'tegel';                     // stoep of pad
  return 'gras';
}

// De sfeermodule heeft deze materialen nodig om water te laten stromen, de
// bladeren te laten waaien en de lantaarns 's avonds aan te doen.
export function sfeerMaterialen() {
  return { water: MAT.water, blad: [MAT.leaf, MAT.leaf2], lamp: MAT.lamp, hedge: MAT.hedge };
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
