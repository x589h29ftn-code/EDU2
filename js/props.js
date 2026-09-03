// Objectenbibliotheek: losse dingen die je in de wijk kunt neerzetten.
// Alles is nagebouwd naar wat er op de street-viewfoto's van Tinga staat:
// carports en bergingen, schuttingen en hagen, het informatiebord op betonnen
// voeten, ondergrondse containers, speeltoestellen, verkeersborden enzovoort.
//
// Elk object wordt opgebouwd rond de oorsprong met zijn voet op y = 0 en kijkt
// naar -Z. De editor draait en schaalt het daarna.
import * as THREE from 'three';
import { rng } from './textures.js';

// ---------- materialen ----------
const M = {};
function mat(kleur, ruw = 0.9, metaal = 0) {
  return new THREE.MeshStandardMaterial({ color: kleur, roughness: ruw, metalness: metaal });
}
export function propMaterials() {
  if (M.klaar) return M;
  M.hout = mat(0x8a6a48);
  M.houtDonker = mat(0x5f4a34);
  M.houtLicht = mat(0xb59667);
  M.plank = mat(0x7d6146);
  M.staal = mat(0x9aa0a6, 0.45, 0.7);
  M.staalDonker = mat(0x3c4147, 0.5, 0.6);
  M.zwart = mat(0x24262a, 0.7, 0.2);
  M.wit = mat(0xf1f1ee, 0.85);
  M.beton = mat(0xa8a49c, 0.98);
  M.betonDonker = mat(0x8d8981, 0.98);
  M.baksteen = mat(0x9c6b52, 0.96);
  M.baksteenGeel = mat(0xcbb98f, 0.96);
  M.dakleer = mat(0x33363a, 0.95);
  M.glas = new THREE.MeshStandardMaterial({ color: 0x2a3a48, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.6 });
  M.blad = mat(0x4a7a35, 1);
  M.bladDonker = mat(0x36602a, 1);
  M.groen = mat(0x2f6b3a, 0.9);
  M.rood = mat(0xa8231f, 0.85);
  M.oranje = mat(0xdd6a12, 0.85);
  M.blauw = mat(0x0b3d91, 0.85);
  M.geel = mat(0xe8c02a, 0.85);
  M.grijsPlastic = mat(0x6d7278, 0.85);
  M.kunstgras = mat(0x4f7c3a, 1);
  M.zand = mat(0xd9c9a0, 1);
  M.grind = mat(0xb9b3a8, 1);
  M.houtGrijs = mat(0x9a927f, 1);
  M.bladLicht = mat(0x6f9c42, 1);
  M.bladRood = mat(0x8c5a3a, 1);
  M.bladWijn = mat(0x6b2b33, 1);
  M.bladPaars = mat(0x8a3a3f, 1);
  M.haagWarm = mat(0x5b7434, 1);
  M.groenDonker = mat(0x2b3a30, 0.92);
  M.bierglas = new THREE.MeshStandardMaterial({ color: 0x6b3a12, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.85 });
  M.klaar = true;
  return M;
}

// ---------- bouwhulpjes ----------
const G = new THREE.Group();
function doos(w, h, d, m, x = 0, y = 0, z = 0, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return { g, m };
}
function cil(r1, r2, h, m, x = 0, y = 0, z = 0, seg = 10, rx = 0, rz = 0) {
  const g = new THREE.CylinderGeometry(r1, r2, h, seg);
  if (rx) g.rotateX(rx);
  if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  return { g, m };
}
function bol(r, m, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
  const g = new THREE.SphereGeometry(r, 8, 6);
  g.scale(sx, sy, sz);
  g.translate(x, y, z);
  return { g, m };
}

// Bundelt losse stukjes per materiaal tot zo min mogelijk meshes.
function bouw(delen) {
  const perMat = new Map();
  for (const d of delen) {
    if (!d) continue;
    if (!perMat.has(d.m)) perMat.set(d.m, []);
    perMat.get(d.m).push(d.g);
  }
  const groep = new THREE.Group();
  for (const [m, geos] of perMat) {
    let geo = geos[0];
    if (geos.length > 1) {
      // handmatig samenvoegen: alle geometrieen zijn non-indexed te maken
      const pos = [], nor = [], uv = [];
      for (const g of geos) {
        const ng = g.index ? g.toNonIndexed() : g;
        pos.push(...ng.attributes.position.array);
        nor.push(...ng.attributes.normal.array);
        if (ng.attributes.uv) uv.push(...ng.attributes.uv.array);
        if (ng !== g) ng.dispose();
        g.dispose();
      }
      geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      if (uv.length) geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    }
    const mesh = new THREE.Mesh(geo, m);
    mesh.castShadow = true; mesh.receiveShadow = true;
    groep.add(mesh);
  }
  return groep;
}

// ---------- de objecten ----------
// maat: [breedte, diepte] voor de botsingsdoos, hoogte h
const LIB = {};
const def = (naam, label, groep, maat, h, maak) => { LIB[naam] = { naam, label, groep, maat, h, maak }; };

// ===== erf en tuin =====
def('carport', 'Carport', 'erf', [3.2, 5.6], 2.5, () => {
  const d = [];
  for (const [x, z] of [[-1.5, -2.6], [1.5, -2.6], [-1.5, 2.6], [1.5, 2.6]])
    d.push(doos(0.14, 2.4, 0.14, M.houtDonker, x, 1.2, z));
  d.push(doos(3.4, 0.16, 5.8, M.dakleer, 0, 2.46, 0));
  d.push(doos(3.5, 0.10, 0.12, M.houtDonker, 0, 2.34, -2.85));
  d.push(doos(3.5, 0.10, 0.12, M.houtDonker, 0, 2.34, 2.85));
  return bouw(d);
});

def('veranda', 'Veranda met glasdak', 'erf', [3.0, 3.4], 2.6, () => {
  const d = [];
  for (const [x, z] of [[-1.4, -1.6], [1.4, -1.6], [-1.4, 1.6], [1.4, 1.6]])
    d.push(doos(0.11, 2.5, 0.11, M.zwart, x, 1.25, z));
  d.push(doos(3.0, 0.08, 3.6, M.glas, 0, 2.56, 0));
  d.push(doos(3.1, 0.14, 0.10, M.zwart, 0, 2.48, -1.8));
  return bouw(d);
});

def('berging', 'Stenen berging', 'erf', [3.0, 2.4], 2.5, () => {
  const d = [
    doos(3.0, 2.2, 2.4, M.baksteenGeel, 0, 1.1, 0),
    doos(3.2, 0.14, 2.6, M.dakleer, 0, 2.25, 0),
    doos(0.9, 2.0, 0.06, M.houtDonker, 0.6, 1.0, -1.22),
    doos(0.55, 0.5, 0.05, M.glas, -0.8, 1.55, -1.22),
  ];
  return bouw(d);
});

def('garageblok', 'Blok garageboxen', 'erf', [15.0, 6.0], 2.8, () => {
  const d = [doos(15, 2.5, 6, M.baksteen, 0, 1.25, 0), doos(15.3, 0.18, 6.3, M.dakleer, 0, 2.55, 0)];
  for (let i = 0; i < 6; i++) {
    const x = -7.5 + 1.25 + i * 2.5;
    d.push(doos(2.1, 2.05, 0.1, M.staalDonker, x, 1.03, -3.02));
    for (let k = 0; k < 5; k++) d.push(doos(2.0, 0.05, 0.04, M.staal, x, 0.3 + k * 0.42, -3.09));
  }
  return bouw(d);
});

def('schuurtje', 'Houten tuinhuisje', 'erf', [2.4, 2.0], 2.3, () => {
  const d = [];
  for (let i = 0; i < 8; i++) d.push(doos(2.4, 0.24, 2.0, M.plank, 0, 0.12 + i * 0.24, 0));
  d.push(doos(2.7, 0.10, 2.3, M.dakleer, 0, 2.02, 0));
  d.push(doos(0.8, 1.8, 0.05, M.houtDonker, 0, 0.9, -1.02));
  return bouw(d);
});

def('schutting', 'Schutting (3 m)', 'erf', [3.0, 0.2], 1.8, () => {
  const d = [doos(0.10, 1.8, 0.10, M.houtDonker, -1.5, 0.9, 0), doos(0.10, 1.8, 0.10, M.houtDonker, 1.5, 0.9, 0)];
  for (let i = 0; i < 9; i++) d.push(doos(2.94, 0.17, 0.05, M.plank, 0, 0.12 + i * 0.195, 0));
  return bouw(d);
});

def('haag', 'Ligusterhaag (3 m)', 'erf', [3.0, 0.6], 0.9, () => bouw([
  doos(3.0, 0.85, 0.6, M.blad, 0, 0.43, 0),
  doos(2.9, 0.1, 0.5, M.bladDonker, 0, 0.86, 0),
]));

def('muurtje', 'Bakstenen muurtje (3 m)', 'erf', [3.0, 0.3], 0.6, () => bouw([
  doos(3.0, 0.55, 0.28, M.baksteen, 0, 0.275, 0),
  doos(3.1, 0.06, 0.34, M.beton, 0, 0.58, 0),
]));

def('hekje', 'Laag tuinhekje (3 m)', 'erf', [3.0, 0.1], 0.6, () => {
  const d = [doos(3.0, 0.06, 0.05, M.wit, 0, 0.55, 0), doos(3.0, 0.06, 0.05, M.wit, 0, 0.28, 0)];
  for (let i = 0; i <= 7; i++) d.push(doos(0.05, 0.62, 0.05, M.wit, -1.5 + i * 0.43, 0.31, 0));
  return bouw(d);
});

def('pergola', 'Pergola', 'erf', [3.0, 2.2], 2.3, () => {
  const d = [];
  for (const [x, z] of [[-1.4, -1.0], [1.4, -1.0], [-1.4, 1.0], [1.4, 1.0]])
    d.push(doos(0.12, 2.2, 0.12, M.hout, x, 1.1, z));
  for (let i = 0; i < 7; i++) d.push(doos(3.2, 0.08, 0.08, M.hout, 0, 2.24, -1.1 + i * 0.37));
  return bouw(d);
});

def('trampoline', 'Trampoline', 'erf', [3.2, 3.2], 0.9, () => {
  const d = [cil(1.6, 1.6, 0.08, M.zwart, 0, 0.85, 0, 14)];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    d.push(cil(0.05, 0.05, 0.85, M.staal, Math.cos(a) * 1.5, 0.42, Math.sin(a) * 1.5, 6));
  }
  d.push(cil(1.62, 1.62, 0.12, M.blauw, 0, 0.9, 0, 14));
  return bouw(d);
});

// ===== straat =====
def('lantaarn', 'Lantaarnpaal', 'straat', [0.3, 0.3], 5.4, () => bouw([
  cil(0.09, 0.13, 5.0, M.staal, 0, 2.5, 0, 8),
  doos(1.4, 0.10, 0.10, M.staal, 0.6, 5.0, 0),
  doos(0.5, 0.14, 0.22, M.wit, 1.25, 4.92, 0),
]));

def('paaltje', 'Antiparkeerpaaltje', 'straat', [0.16, 0.16], 0.9, () => bouw([
  cil(0.07, 0.07, 0.85, M.staalDonker, 0, 0.42, 0, 8),
  cil(0.075, 0.075, 0.08, M.wit, 0, 0.74, 0, 8),
  bol(0.07, M.staalDonker, 0, 0.86, 0),
]));

def('bord30', 'Bord 30 km', 'straat', [0.2, 0.2], 2.4, () => bouw([
  cil(0.045, 0.045, 2.1, M.staal, 0, 1.05, 0, 8),
  cil(0.33, 0.33, 0.04, M.rood, 0, 1.95, 0.02, 16, Math.PI / 2),
  cil(0.26, 0.26, 0.04, M.wit, 0, 1.95, -0.01, 16, Math.PI / 2),
  doos(0.30, 0.16, 0.02, M.zwart, 0, 1.95, -0.035),
]));

def('bord_straat', 'Straatnaambord', 'straat', [0.2, 0.2], 2.3, () => bouw([
  cil(0.04, 0.04, 2.0, M.staal, 0, 1.0, 0, 8),
  doos(1.14, 0.30, 0.03, M.wit, 0.4, 2.0, 0.01),
  doos(1.06, 0.22, 0.03, M.blauw, 0.4, 2.0, -0.02),
]));

def('bord_voorrang', 'Voorrangsbord', 'straat', [0.2, 0.2], 2.3, () => bouw([
  cil(0.045, 0.045, 2.0, M.staal, 0, 1.0, 0, 8),
  doos(0.56, 0.56, 0.03, M.wit, 0, 1.95, 0.02, Math.PI / 4),
  doos(0.44, 0.44, 0.03, M.geel, 0, 1.95, -0.01, Math.PI / 4),
]));

def('spiegel', 'Verkeersspiegel', 'straat', [0.3, 0.3], 2.6, () => bouw([
  cil(0.05, 0.05, 2.2, M.staal, 0, 1.1, 0, 8),
  doos(0.8, 0.6, 0.08, M.oranje, 0, 2.3, 0),
  doos(0.72, 0.52, 0.03, M.glas, 0, 2.3, -0.06),
]));

def('infobord', 'Informatiebord', 'straat', [1.6, 0.5], 1.7, () => bouw([
  doos(0.45, 0.55, 0.45, M.beton, -0.62, 0.27, 0),
  doos(0.45, 0.55, 0.45, M.beton, 0.62, 0.27, 0),
  doos(0.12, 1.2, 0.12, M.staalDonker, -0.62, 1.05, 0),
  doos(0.12, 1.2, 0.12, M.staalDonker, 0.62, 1.05, 0),
  doos(1.7, 0.95, 0.08, M.wit, 0, 1.2, 0),
  doos(1.6, 0.28, 0.02, M.groen, 0, 1.52, -0.05),
]));

def('nutskast', 'Nutskast', 'straat', [1.1, 0.5], 1.5, () => bouw([
  doos(1.1, 1.4, 0.5, M.grijsPlastic, 0, 0.7, 0),
  doos(1.16, 0.08, 0.56, M.staalDonker, 0, 1.42, 0),
  doos(0.5, 1.2, 0.02, M.staalDonker, 0, 0.7, -0.26),
]));

def('container', 'Ondergrondse container', 'straat', [1.3, 1.3], 1.2, () => bouw([
  doos(1.4, 0.10, 1.4, M.beton, 0, 0.05, 0),
  cil(0.42, 0.46, 1.05, M.staalDonker, 0, 0.55, 0, 12),
  cil(0.44, 0.44, 0.10, M.grijsPlastic, 0, 1.12, 0, 12),
  doos(0.30, 0.26, 0.05, M.zwart, 0, 0.95, -0.44),
]));

def('kliko', 'Kliko', 'straat', [0.7, 0.6], 1.1, () => bouw([
  doos(0.62, 0.95, 0.55, M.grijsPlastic, 0, 0.5, 0),
  doos(0.66, 0.08, 0.60, M.groen, 0, 1.0, 0),
  cil(0.09, 0.09, 0.06, M.zwart, -0.3, 0.09, 0.2, 8, 0, Math.PI / 2),
  cil(0.09, 0.09, 0.06, M.zwart, 0.3, 0.09, 0.2, 8, 0, Math.PI / 2),
]));

def('prullenbak', 'Prullenbak', 'straat', [0.4, 0.4], 1.1, () => bouw([
  cil(0.045, 0.045, 1.0, M.staal, 0, 0.5, 0, 8),
  cil(0.20, 0.17, 0.55, M.staalDonker, 0, 0.85, 0.12, 10),
  cil(0.21, 0.21, 0.04, M.zwart, 0, 1.14, 0.12, 10),
]));

def('fietsenrek', 'Fietsenrek', 'straat', [2.4, 0.6], 0.8, () => {
  const d = [];
  for (let i = 0; i < 5; i++) {
    const x = -1.0 + i * 0.5;
    d.push(cil(0.03, 0.03, 0.7, M.staal, x, 0.35, -0.2, 6));
    d.push(cil(0.03, 0.03, 0.7, M.staal, x, 0.35, 0.2, 6));
    d.push(cil(0.03, 0.03, 0.44, M.staal, x, 0.68, 0, 6, Math.PI / 2));
  }
  return bouw(d);
});

def('bushalte', 'Bushalte', 'straat', [3.6, 1.6], 2.5, () => {
  const d = [];
  for (const x of [-1.7, 1.7]) d.push(doos(0.1, 2.3, 1.5, M.glas, x, 1.15, 0));
  d.push(doos(3.6, 2.3, 0.08, M.glas, 0, 1.15, 0.72));
  d.push(doos(3.8, 0.12, 1.7, M.staalDonker, 0, 2.36, 0));
  d.push(doos(2.0, 0.45, 0.35, M.hout, 0, 0.48, 0.5));
  for (const x of [-0.9, 0.9]) d.push(doos(0.08, 0.45, 0.3, M.staalDonker, x, 0.22, 0.5));
  return bouw(d);
});

def('bank', 'Bankje', 'straat', [1.8, 0.7], 0.9, () => {
  const d = [doos(1.8, 0.09, 0.45, M.hout, 0, 0.45, 0), doos(1.8, 0.5, 0.08, M.hout, 0, 0.72, -0.2)];
  for (const x of [-0.75, 0.75]) {
    d.push(doos(0.09, 0.45, 0.09, M.staalDonker, x, 0.22, -0.15));
    d.push(doos(0.09, 0.45, 0.09, M.staalDonker, x, 0.22, 0.15));
  }
  return bouw(d);
});

def('picknicktafel', 'Picknicktafel', 'straat', [2.0, 1.8], 0.8, () => {
  const d = [doos(2.0, 0.08, 0.8, M.hout, 0, 0.74, 0)];
  for (const z of [-0.72, 0.72]) d.push(doos(2.0, 0.07, 0.3, M.hout, 0, 0.45, z));
  for (const x of [-0.8, 0.8]) {
    d.push(doos(0.09, 0.75, 1.7, M.houtDonker, x, 0.37, 0));
  }
  return bouw(d);
});

def('vlaggenmast', 'Vlaggenmast', 'straat', [0.3, 0.3], 6.5, () => bouw([
  cil(0.05, 0.09, 6.2, M.wit, 0, 3.1, 0, 8),
  doos(0.5, 0.12, 0.5, M.beton, 0, 0.06, 0),
  doos(1.5, 0.34, 0.03, M.rood, 0.78, 5.85, 0),
  doos(1.5, 0.34, 0.03, M.wit, 0.78, 5.51, 0),
  doos(1.5, 0.34, 0.03, M.blauw, 0.78, 5.17, 0),
]));

// ===== groen en spelen =====
def('boom', 'Losse boom', 'groen', [0.7, 0.7], 8, () => bouw([
  cil(0.16, 0.28, 5.0, M.houtDonker, 0, 2.5, 0, 7),
  bol(2.2, M.blad, 0, 5.4, 0, 1.05, 0.95, 1.05),
  bol(1.7, M.bladDonker, 0.6, 6.6, -0.3),
]));

def('conifeer', 'Conifeer', 'groen', [1.0, 1.0], 3.2, () => bouw([
  cil(0.0, 0.75, 3.0, M.bladDonker, 0, 1.5, 0, 9),
  cil(0.09, 0.12, 0.4, M.houtDonker, 0, 0.2, 0, 6),
]));

def('struik', 'Struik', 'groen', [1.4, 1.4], 1.1, () => bouw([
  bol(0.7, M.blad, 0, 0.5, 0, 1.2, 0.8, 1.2),
  bol(0.45, M.bladDonker, 0.4, 0.7, 0.25),
]));

def('plantenbak', 'Plantenbak', 'groen', [1.2, 0.6], 0.9, () => bouw([
  doos(1.2, 0.5, 0.55, M.houtDonker, 0, 0.25, 0),
  doos(1.1, 0.06, 0.45, M.zand, 0, 0.52, 0),
  bol(0.3, M.blad, -0.3, 0.65, 0, 1, 0.7, 1),
  bol(0.3, M.blad, 0.3, 0.65, 0, 1, 0.7, 1),
]));

def('voetbaldoel', 'Voetbaldoel', 'spelen', [3.2, 1.2], 2.0, () => {
  const d = [
    cil(0.06, 0.06, 2.0, M.wit, -1.5, 1.0, 0, 8),
    cil(0.06, 0.06, 2.0, M.wit, 1.5, 1.0, 0, 8),
    cil(0.06, 0.06, 3.0, M.wit, 0, 1.98, 0, 8, 0, Math.PI / 2),
  ];
  for (let i = 0; i <= 10; i++) d.push(cil(0.012, 0.012, 1.9, M.wit, -1.5 + i * 0.3, 0.95, 0.5, 4));
  return bouw(d);
});

def('basket', 'Basketbalpaal', 'spelen', [1.2, 0.8], 3.3, () => bouw([
  cil(0.08, 0.10, 3.0, M.staalDonker, 0, 1.5, 0.4, 8),
  doos(1.2, 0.85, 0.06, M.wit, 0, 2.9, 0.1),
  cil(0.23, 0.23, 0.03, M.oranje, 0, 2.6, -0.1, 12, Math.PI / 2),
]));

def('speeltoestel', 'Klimtoestel', 'spelen', [3.4, 2.6], 2.6, () => {
  const d = [];
  for (const [x, z] of [[-1.5, -1.1], [1.5, -1.1], [-1.5, 1.1], [1.5, 1.1]])
    d.push(cil(0.07, 0.07, 2.4, M.hout, x, 1.2, z, 7));
  d.push(doos(3.2, 0.10, 2.4, M.plank, 0, 1.25, 0));
  d.push(doos(3.4, 0.12, 0.12, M.hout, 0, 2.42, -1.1));
  d.push(doos(3.4, 0.12, 0.12, M.hout, 0, 2.42, 1.1));
  // glijbaan
  const gl = new THREE.BoxGeometry(0.7, 0.06, 2.6);
  gl.rotateX(-0.45); gl.translate(1.0, 0.72, 2.2);
  d.push({ g: gl, m: M.rood });
  return bouw(d);
});

def('wipkip', 'Wipkip', 'spelen', [0.8, 1.2], 0.9, () => bouw([
  cil(0.05, 0.05, 0.55, M.staal, 0, 0.27, 0, 8),
  doos(0.30, 0.35, 1.0, M.rood, 0, 0.72, 0),
  doos(0.24, 0.30, 0.26, M.geel, 0, 0.95, -0.42),
  cil(0.03, 0.03, 0.55, M.staalDonker, 0, 0.82, -0.1, 6, 0, Math.PI / 2),
]));

def('zandbak', 'Zandbak', 'spelen', [3.0, 3.0], 0.4, () => {
  const d = [doos(3.0, 0.12, 3.0, M.zand, 0, 0.06, 0)];
  for (const [x, z, w, dd] of [[0, -1.5, 3.2, 0.2], [0, 1.5, 3.2, 0.2], [-1.5, 0, 0.2, 3.2], [1.5, 0, 0.2, 3.2]])
    d.push(doos(w, 0.3, dd, M.hout, x, 0.15, z));
  return bouw(d);
});

def('vijverrand', 'Rietpol', 'groen', [1.0, 1.0], 1.4, () => {
  const d = [];
  const r = rng(11);
  for (let i = 0; i < 26; i++) {
    const a = r() * 6.28, rad = r() * 0.45;
    d.push(cil(0.012, 0.02, 0.9 + r() * 0.5, M.groen, Math.cos(a) * rad, 0.6, Math.sin(a) * rad, 4, (r() - 0.5) * 0.25, (r() - 0.5) * 0.25));
  }
  return bouw(d);
});


// ===== hagen en hekken (naar de foto's uit de wijk) =====
def('haag_hoog', 'Hoge beukenhaag (3 m)', 'hek', [3.0, 0.95], 1.9, () => bouw([
  doos(3.0, 1.78, 0.9, M.haagWarm, 0, 0.89, 0),        // dichte, rossig-groene haag
  doos(2.94, 0.16, 0.84, M.bladDonker, 0, 1.80, 0),    // donkerder geschoren bovenkant
  doos(3.1, 0.14, 0.26, M.blad, 0, 0.07, 0.5),         // pol gras aan de voet
]));

def('haag_laag', 'Lage haag (3 m)', 'hek', [3.0, 0.5], 0.55, () => bouw([
  doos(3.0, 0.5, 0.45, M.blad, 0, 0.25, 0),
  doos(2.9, 0.08, 0.38, M.bladDonker, 0, 0.51, 0),
]));

def('kastanjehek', 'Kastanjehouten hek (3 m)', 'hek', [3.0, 0.12], 1.25, () => {
  const d = [];
  const r = rng(31);
  for (const x of [-1.45, 0, 1.45]) d.push(doos(0.09, 1.25, 0.09, M.houtGrijs, x, 0.62, 0));
  // ruwe, ongelijke palen met wat speling, zoals op de foto
  for (let i = 0; i <= 22; i++) {
    const x = -1.5 + i * 0.136;
    const h = 0.95 + r() * 0.3;
    const kant = (r() - 0.5) * 0.07;
    d.push(doos(0.045 + r() * 0.02, h, 0.045, M.houtGrijs, x, h / 2, kant, (r() - 0.5) * 0.06));
  }
  for (const y of [0.35, 0.95]) d.push(doos(2.98, 0.035, 0.03, M.staalDonker, 0, y, 0.045));
  return bouw(d);
});

def('paalhek', 'Paalhek met liggers (3 m)', 'hek', [3.0, 0.1], 0.8, () => {
  const d = [];
  for (const x of [-1.5, 0, 1.5]) d.push(doos(0.08, 0.8, 0.08, M.houtDonker, x, 0.4, 0));
  for (const y of [0.42, 0.7]) d.push(doos(3.0, 0.10, 0.045, M.houtLicht, 0, y, 0));
  return bouw(d);
});

def('hekje_bruin', 'Bruin tuinhekje (3 m)', 'hek', [3.0, 0.08], 0.75, () => {
  const d = [];
  for (const y of [0.66, 0.36]) d.push(doos(3.0, 0.055, 0.04, M.houtDonker, 0, y, 0));
  for (let i = 0; i <= 11; i++) d.push(doos(0.055, 0.72, 0.04, M.houtDonker, -1.5 + i * 0.273, 0.38, 0));
  return bouw(d);
});

def('schutting_donker', 'Donkere schutting (3 m)', 'hek', [3.0, 0.16], 1.9, () => {
  const d = [doos(0.10, 1.9, 0.12, M.zwart, -1.5, 0.95, 0), doos(0.10, 1.9, 0.12, M.zwart, 1.5, 0.95, 0)];
  for (let i = 0; i < 10; i++) d.push(doos(2.92, 0.18, 0.045, M.groenDonker, 0, 0.12 + i * 0.19, 0));
  return bouw(d);
});

def('poortje', 'Tuinpoortje', 'hek', [1.1, 0.14], 1.85, () => {
  const d = [doos(0.11, 1.85, 0.11, M.houtDonker, -0.55, 0.92, 0), doos(0.11, 1.85, 0.11, M.houtDonker, 0.55, 0.92, 0)];
  for (let i = 0; i < 8; i++) d.push(doos(0.98, 0.17, 0.04, M.plank, 0, 0.16 + i * 0.195, 0.02));
  d.push(doos(0.06, 0.06, 0.05, M.staal, 0.42, 1.0, -0.05));
  return bouw(d);
});

def('betonpaaltje', 'Betonnen paaltje', 'hek', [0.34, 0.34], 0.45, () => bouw([
  cil(0.15, 0.17, 0.42, M.beton, 0, 0.21, 0, 12),
  cil(0.15, 0.13, 0.06, M.betonDonker, 0, 0.44, 0, 12),
]));

// ===== bij de woning =====
def('aanbouw', 'Aanbouw met plat dak', 'erf', [3.4, 2.6], 2.6, () => bouw([
  doos(3.4, 2.35, 2.6, M.baksteenGeel, 0, 1.17, 0),
  doos(3.6, 0.14, 2.8, M.beton, 0, 2.42, 0),
  doos(0.95, 2.05, 0.06, M.blauw, 0.95, 1.02, -1.32),      // blauwe deur
  doos(0.75, 0.6, 0.05, M.glas, -0.75, 1.55, -1.32),
  doos(0.85, 0.7, 0.03, M.wit, -0.75, 1.55, -1.35),        // wit kozijn
  doos(3.5, 0.28, 0.06, M.baksteen, 0, 0.14, -1.31),       // donkere plint
]));

def('luifel', 'Luifel boven de deur', 'erf', [2.2, 0.9], 2.5, () => bouw([
  doos(2.2, 0.16, 0.9, M.wit, 0, 2.4, -0.35),
  doos(2.2, 0.10, 0.10, M.wit, 0, 2.3, -0.78),
  doos(0.09, 2.4, 0.09, M.wit, -1.0, 1.2, -0.72),
  doos(0.09, 2.4, 0.09, M.wit, 1.0, 1.2, -0.72),
]));

def('meterkast', 'Meterkastje aan de gevel', 'erf', [0.4, 0.2], 0.75, () => bouw([
  doos(0.38, 0.5, 0.18, M.wit, 0, 0.95, 0),
  doos(0.34, 0.44, 0.02, M.grijsPlastic, 0, 0.95, -0.10),
]));

def('verhoogde_bak', 'Verhoogde plantenbak', 'groen', [2.6, 0.8], 0.6, () => {
  const d = [];
  for (let i = 0; i < 3; i++) d.push(doos(2.6, 0.16, 0.09, M.houtLicht, 0, 0.09 + i * 0.17, -0.36));
  for (let i = 0; i < 3; i++) d.push(doos(2.6, 0.16, 0.09, M.houtLicht, 0, 0.09 + i * 0.17, 0.36));
  for (const x of [-1.3, 1.3]) d.push(doos(0.09, 0.52, 0.8, M.houtDonker, x, 0.26, 0));
  d.push(doos(2.5, 0.06, 0.7, M.zand, 0, 0.5, 0));
  d.push(bol(0.35, M.blad, -0.7, 0.62, 0, 1.3, 0.6, 1.1));
  d.push(bol(0.35, M.blad, 0.6, 0.62, 0.05, 1.3, 0.6, 1.1));
  return bouw(d);
});

def('grindtuin', 'Grindvak', 'erf', [2.4, 1.6], 0.1, () => bouw([
  doos(2.4, 0.08, 1.6, M.grind, 0, 0.04, 0),
  doos(2.5, 0.12, 0.08, M.beton, 0, 0.06, -0.82),
  doos(2.5, 0.12, 0.08, M.beton, 0, 0.06, 0.82),
]));

// ===== bomen uit de foto's van het groen =====
def('treurwilg', 'Treurwilg', 'groen', [1.2, 1.2], 8.0, () => {
  const d = [cil(0.20, 0.34, 4.0, M.houtGrijs, 0, 2.0, 0, 7)];
  const r = rng(77);
  // brede, platte kruin met daaronder afhangende twijgen
  d.push(bol(2.3, M.bladLicht, 0, 4.9, 0, 1.15, 0.55, 1.15));
  d.push(bol(1.6, M.blad, 0.4, 5.5, -0.3, 1.0, 0.5, 1.0));
  // slierten die tot vlak boven het gras hangen
  for (let i = 0; i < 40; i++) {
    const a = r() * 6.283;
    const rad = 0.7 + r() * 1.9;
    const len = 2.4 + r() * 1.9;
    const top = 4.8 - (rad / 2.6) * 0.9;
    const g = new THREE.CylinderGeometry(0.09, 0.02, len, 5);
    g.translate(0, -len / 2, 0);                       // hangt vanaf de kruinrand
    g.translate(Math.cos(a) * rad, top, Math.sin(a) * rad);
    d.push({ g, m: r() < 0.5 ? M.bladLicht : M.blad });
  }
  return bouw(d);
});

def('esdoorn_rood', 'Rode esdoorn', 'groen', [0.6, 0.6], 7.5, () => bouw([
  cil(0.10, 0.19, 4.6, M.houtDonker, 0, 2.3, 0, 7),
  cil(0.05, 0.08, 1.5, M.houtDonker, 0.35, 4.9, 0.15, 5, 0, 0.5),
  cil(0.05, 0.08, 1.5, M.houtDonker, -0.35, 4.9, -0.15, 5, 0, -0.5),
  bol(1.30, M.bladWijn, 0, 5.7, 0, 1.05, 0.95, 1.05),
  bol(0.95, M.bladWijn, 0.6, 6.4, -0.25),
  bol(0.85, M.bladPaars, -0.55, 6.1, 0.45),
  bol(0.75, M.bladPaars, 0.15, 5.2, 0.8),
]));

def('jonge_boom', 'Jonge boom met boompaal', 'groen', [0.5, 0.5], 5.0, () => bouw([
  cil(0.06, 0.09, 3.4, M.houtDonker, 0, 1.7, 0, 6),
  bol(0.95, M.bladLicht, 0, 3.8, 0, 0.85, 1.2, 0.85),
  cil(0.045, 0.045, 1.9, M.houtLicht, -0.28, 0.95, 0, 6),
  cil(0.045, 0.045, 1.9, M.houtLicht, 0.28, 0.95, 0, 6),
  doos(0.62, 0.05, 0.04, M.houtLicht, 0, 1.8, 0),
  doos(0.58, 0.03, 0.03, M.zwart, 0, 1.55, 0),
]));

def('kale_boom', 'Kale boom (winter)', 'groen', [0.7, 0.7], 9.0, () => {
  const d = [cil(0.16, 0.30, 4.8, M.houtGrijs, 0, 2.4, 0, 7)];
  const r = rng(53);
  // takken schuin omhoog vanaf verschillende hoogtes, elk met twee zijtakken
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * 6.283 + r() * 0.5;
    const hel = 0.45 + r() * 0.35;
    const len = 2.4 + r() * 1.5;
    const y0 = 3.4 + r() * 1.4;
    // voet in de oorsprong, dan pas kantelen en draaien: zo groeien de takken
    // echt vanaf de stam omhoog naar buiten
    const tak = (r1, r2, l, kant, hoek, hy) => {
      const g = new THREE.CylinderGeometry(r1, r2, l, 5);
      g.translate(0, l / 2, 0);
      g.rotateZ(kant); g.rotateY(hoek); g.translate(0, hy, 0);
      return { g, m: M.houtGrijs };
    };
    d.push(tak(0.035, 0.09, len, hel, a, y0));
    const tx = Math.sin(hel) * len, ty = y0 + Math.cos(hel) * len;
    for (const k of [-1, 1]) {
      const len2 = 1.0 + r() * 1.0;
      const g2 = new THREE.CylinderGeometry(0.015, 0.035, len2, 4);
      g2.translate(0, len2 / 2, 0);
      g2.rotateZ(hel + k * 0.4); g2.rotateY(a + k * 0.35);
      g2.translate(Math.sin(a) * tx * 0.85, ty * 0.98, Math.cos(a) * tx * 0.85);
      d.push({ g: g2, m: M.houtGrijs });
    }
  }
  return bouw(d);
});

// ===== mensen in de tuin =====
// Een tuinstoel met iemand erin, biertje in de hand. De arm met het flesje zit
// in een aparte groep 'drinkarm' met zijn draaipunt op de schouder, zodat de
// wereld hem kan laten bewegen: af en toe gaat het flesje naar de mond.
function stoelDelen(m = M.staalDonker, doek = M.groenDonker) {
  const d = [];
  for (const [x, z] of [[-0.24, -0.22], [0.24, -0.22], [-0.24, 0.24], [0.24, 0.24]]) {
    d.push(cil(0.022, 0.022, 0.44, m, x, 0.22, z, 6));
  }
  d.push(doos(0.56, 0.05, 0.5, doek, 0, 0.46, 0));            // zitting
  d.push(doos(0.56, 0.5, 0.05, doek, 0, 0.72, 0.24));         // rugleuning
  for (const x of [-0.28, 0.28]) {
    d.push(cil(0.02, 0.02, 0.5, m, x, 0.72, 0.24, 6));        // stijlen rugleuning
    d.push(cil(0.02, 0.02, 0.46, m, x, 0.62, 0.02, 6, Math.PI / 2)); // armleuning
  }
  return d;
}

// bierflesje: bruin glas met een geel etiket, staand in de oorsprong
function flesjeDelen(x, y, z) {
  return [
    cil(0.032, 0.032, 0.17, M.bierglas, x, y + 0.085, z, 7),
    cil(0.013, 0.026, 0.07, M.bierglas, x, y + 0.20, z, 7),
    cil(0.033, 0.033, 0.05, M.geel, x, y + 0.09, z, 7),
  ];
}

const ZITTERS = [
  ['zit_rood', 'Zittende buur (rood shirt)', 0xb03a2e, 0x2f3a52, 0xe8c9a8, true],
  ['zit_blauw', 'Zittende buur (blauw shirt)', 0x2a5d9e, 0x33383f, 0xd9b493, false],
  ['zit_groen', 'Zittende buur (groen shirt)', 0x3f7a45, 0x50412f, 0xc99b78, true],
  ['zit_geel', 'Zittende buur (geel shirt)', 0xd2a52c, 0x2c3138, 0xeed3b4, false],
];
for (const [naam, label, shirt, broek, huid, drinkt] of ZITTERS) {
  def(naam, label, 'mensen', [0.6, 0.9], 1.35, () => {
    const mShirt = mat(shirt, 0.9), mBroek = mat(broek, 0.9), mHuid = mat(huid, 0.85);
    const d = stoelDelen();
    // bovenbenen vooruit, onderbenen omlaag, voeten op de grond
    for (const x of [-0.13, 0.13]) {
      d.push(doos(0.17, 0.16, 0.42, mBroek, x, 0.53, -0.18));
      d.push(doos(0.15, 0.44, 0.15, mBroek, x, 0.24, -0.36));
      d.push(doos(0.15, 0.07, 0.26, M.zwart, x, 0.035, -0.44));
    }
    d.push(doos(0.42, 0.5, 0.26, mShirt, 0, 0.74, 0.06));      // romp
    d.push(cil(0.07, 0.07, 0.08, mHuid, 0, 1.02, 0.06, 7));    // nek
    d.push(bol(0.115, mHuid, 0, 1.14, 0.05));                  // hoofd
    d.push(bol(0.118, M.houtDonker, 0, 1.19, 0.07, 1, 0.7, 1)); // haar
    // vrije arm hangt over de armleuning
    d.push(doos(0.11, 0.36, 0.11, mShirt, -0.26, 0.8, 0.04));
    d.push(cil(0.05, 0.05, 0.16, mHuid, -0.26, 0.58, 0.0, 6));
    // bovenarm van de drinkarm hangt vast langs het lichaam
    d.push(doos(0.11, 0.3, 0.11, mShirt, 0.26, 0.79, 0.06));
    const romp = bouw(d);

    // Onderarm met het flesje draait om de elleboog. In rust ligt hij
    // horizontaal op de armleuning met het flesje rechtop in de hand; bij een
    // slok komt hij omhoog naar de mond.
    const arm = new THREE.Group();
    arm.name = 'drinkarm';
    arm.position.set(0.26, 0.64, 0.06);
    arm.add(bouw([
      doos(0.1, 0.1, 0.3, mShirt, 0, 0, -0.15),
      bol(0.055, mHuid, 0, 0, -0.3),
      ...flesjeDelen(0, -0.02, -0.3),
    ]));
    // wie net een slok neemt begint met de arm al half omhoog
    arm.rotation.x = drinkt ? 1.0 : 0;
    arm.userData.drinkfase = drinkt ? 0.12 : 0.6;

    const g = new THREE.Group();
    g.add(romp, arm);
    return g;
  });
}

def('tuinstoel', 'Lege tuinstoel', 'mensen', [0.6, 0.6], 1.0, () => bouw(stoelDelen()));

def('radiotafel', 'Tafeltje met radio', 'mensen', [0.7, 0.7], 0.95, () => bouw([
  cil(0.31, 0.31, 0.04, M.wit, 0, 0.72, 0, 12),              // rond tafelblad
  cil(0.035, 0.035, 0.7, M.wit, 0, 0.35, 0, 8),              // poot
  cil(0.16, 0.16, 0.03, M.wit, 0, 0.02, 0, 10),              // voet
  // draagbare radio: kastje met luidsprekerrooster, twee knoppen en een antenne
  doos(0.34, 0.19, 0.13, M.zwart, 0, 0.84, 0),
  doos(0.15, 0.13, 0.01, M.grijsPlastic, -0.08, 0.84, -0.068),
  cil(0.028, 0.028, 0.012, M.staal, 0.06, 0.84, -0.068, 8, Math.PI / 2),
  cil(0.028, 0.028, 0.012, M.staal, 0.13, 0.84, -0.068, 8, Math.PI / 2),
  cil(0.007, 0.004, 0.42, M.staal, 0.14, 1.12, 0.04, 6, 0, 0.25),
  // twee lege flesjes op tafel
  ...flesjeDelen(-0.16, 0.74, 0.1),
  ...flesjeDelen(-0.06, 0.74, 0.17),
]));

// ---------- publiek ----------
export const PROP_TYPES = LIB;
export const PROP_GROEPEN = ['erf', 'hek', 'straat', 'groen', 'spelen', 'mensen'];

// Elke keer opnieuw opbouwen: een gedeelde geometrie zou bij het opruimen van
// de wereld weggegooid worden terwijl een ander exemplaar hem nog gebruikt.
export function maakProp(naam) {
  propMaterials();
  const def2 = LIB[naam];
  return def2 ? def2.maak() : null;
}
