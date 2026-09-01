// Automodel met samengevoegde geometrie per materiaal (weinig draw calls).
import * as THREE from 'three';

function merge(parts) {
  const pos = [], nor = [], uv = [];
  for (const { geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 } of parts) {
    const g = geo.clone();
    if (rx || ry || rz) g.rotateX(rx), g.rotateY(ry), g.rotateZ(rz);
    g.translate(x, y, z);
    const ng = g.index ? g.toNonIndexed() : g;
    pos.push(...ng.attributes.position.array);
    nor.push(...ng.attributes.normal.array);
    if (ng.attributes.uv) uv.push(...ng.attributes.uv.array); else for (let i = 0; i < ng.attributes.position.count; i++) uv.push(0, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

const GEO = {};
function geoms(kind) {
  if (GEO[kind]) return GEO[kind];
  const isVan = kind === 'van';
  const L = isVan ? 5.2 : 4.3, W = 1.8, H = isVan ? 1.3 : 0.7;
  const cabL = isVan ? 3.3 : 2.1, cabH = isVan ? 0.75 : 0.62;
  const cabZ = isVan ? -0.55 : -0.05;
  const paint = merge([
    { geo: new THREE.BoxGeometry(W, H, L), y: 0.34 + H / 2 },
    { geo: new THREE.BoxGeometry(W - 0.16, 0.08, cabL - 0.25), y: 0.34 + H + cabH + 0.03, z: cabZ },
    // stijlen
    { geo: new THREE.BoxGeometry(0.08, cabH, 0.08), x: -W / 2 + 0.12, y: 0.34 + H + cabH / 2, z: cabZ - cabL / 2 + 0.1 },
    { geo: new THREE.BoxGeometry(0.08, cabH, 0.08), x: W / 2 - 0.12, y: 0.34 + H + cabH / 2, z: cabZ - cabL / 2 + 0.1 },
    { geo: new THREE.BoxGeometry(0.08, cabH, 0.08), x: -W / 2 + 0.12, y: 0.34 + H + cabH / 2, z: cabZ + cabL / 2 - 0.1 },
    { geo: new THREE.BoxGeometry(0.08, cabH, 0.08), x: W / 2 - 0.12, y: 0.34 + H + cabH / 2, z: cabZ + cabL / 2 - 0.1 },
    // spiegels
    { geo: new THREE.BoxGeometry(0.18, 0.1, 0.12), x: -W / 2 - 0.1, y: 0.34 + H + 0.35, z: cabZ - cabL / 2 + 0.2 },
    { geo: new THREE.BoxGeometry(0.18, 0.1, 0.12), x: W / 2 + 0.1, y: 0.34 + H + 0.35, z: cabZ - cabL / 2 + 0.2 },
  ]);
  const glass = merge([{ geo: new THREE.BoxGeometry(W - 0.2, cabH, cabL), y: 0.34 + H + cabH / 2, z: cabZ }]);
  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 12); wheelGeo.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.23, 8); hubGeo.rotateZ(Math.PI / 2);
  const wheelPos = [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]].map(([x, z]) => [x, z * (L / 4.3)]);
  const black = merge([
    ...wheelPos.map(([x, z]) => ({ geo: wheelGeo, x, y: 0.32, z })),
    { geo: new THREE.BoxGeometry(W + 0.02, 0.18, 0.2), y: 0.42, z: -L / 2 + 0.05 }, // bumper voor
    { geo: new THREE.BoxGeometry(W + 0.02, 0.18, 0.2), y: 0.42, z: L / 2 - 0.05 },
    { geo: new THREE.BoxGeometry(0.8, 0.12, 0.05), y: 0.62, z: -L / 2 - 0.01 }, // grille
  ]);
  const chrome = merge(wheelPos.map(([x, z]) => ({ geo: hubGeo, x, y: 0.32, z })));
  const head = merge([{ geo: new THREE.BoxGeometry(0.36, 0.16, 0.05), x: -0.6, y: 0.78, z: -L / 2 - 0.01 }, { geo: new THREE.BoxGeometry(0.36, 0.16, 0.05), x: 0.6, y: 0.78, z: -L / 2 - 0.01 }]);
  const tail = merge([{ geo: new THREE.BoxGeometry(0.36, 0.16, 0.05), x: -0.6, y: 0.82, z: L / 2 + 0.01 }, { geo: new THREE.BoxGeometry(0.36, 0.16, 0.05), x: 0.6, y: 0.82, z: L / 2 + 0.01 }]);
  const plate = merge([{ geo: new THREE.BoxGeometry(0.5, 0.11, 0.02), y: 0.56, z: L / 2 + 0.02 }, { geo: new THREE.BoxGeometry(0.5, 0.11, 0.02), y: 0.56, z: -L / 2 - 0.02 }]);
  GEO[kind] = { paint, glass, black, chrome, head, tail, plate, L };
  return GEO[kind];
}

const SHARED = {
  glass: new THREE.MeshStandardMaterial({ color: 0x1b2630, roughness: 0.1, metalness: 0.6, transparent: true, opacity: 0.85 }),
  black: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xbbbbbb, metalness: 0.8, roughness: 0.3 }),
  head: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d0, emissiveIntensity: 0.4 }),
  tail: new THREE.MeshStandardMaterial({ color: 0xaa1111, emissive: 0xff2020, emissiveIntensity: 0.4 }),
  plate: new THREE.MeshStandardMaterial({ color: 0xf2c400 }),
};
const paintCache = new Map();

export function makeCar(color, kind = 'hatch') {
  const g = new THREE.Group();
  const G = geoms(kind);
  if (!paintCache.has(color)) paintCache.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 }));
  const body = new THREE.Mesh(G.paint, paintCache.get(color)); body.castShadow = true;
  g.add(body,
    new THREE.Mesh(G.glass, SHARED.glass),
    new THREE.Mesh(G.black, SHARED.black),
    new THREE.Mesh(G.chrome, SHARED.chrome),
    new THREE.Mesh(G.head, SHARED.head),
    new THREE.Mesh(G.tail, SHARED.tail),
    new THREE.Mesh(G.plate, SHARED.plate));
  g.userData.length = G.L;
  return g;
}
