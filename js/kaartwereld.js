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
import { zetViaducten, bouwViaducten, grondHoogte, onderBrug } from './viaduct.js';
import { bouwSportvelden } from './sportveld.js';
import { bouwVolkstuinen } from './volkstuin.js';
import { bouwMolens } from './molen.js';
import { bouwTankstations } from './tankstation.js';
import { bouwTennisparken } from './tennis.js';
import { bouwZuilengangen } from './zuilengang.js';
import { bouwAfsluitingen } from './afsluiting.js';

export let KAART = null;
export function zetKaart(k) { KAART = k; zetViaducten(k && k.viaducten); }

// Weergavestand: 'normaal' of 'plat' (egale kleuren per klasse, voor de
// vergelijking met de kaartplaat).
let STAND = 'normaal';
export function zetStand(s) { STAND = s; }
export function kaartStand() { return STAND; }

const vlakIndex = new Map();   // bucket "i:j" -> vlakken, voor ondergrondKaart
const BUCKET = 25;
/*
 Tegels voor de wereldgeometrie. De kaart werd per materiaal in één mesh
 samengevoegd — één mesh met alle trottoirbanden van de hele wijk, één met alle
 schuttingen — en zo'n mesh valt nooit buiten beeld. De GPU kreeg daardoor elk
 beeld de complete wijk voorgeschoteld, ook wat achter je lag. Nu gaat elk stuk
 in de tegel waar het ligt, dus laat frustum culling het meeste vallen. Groter
 dan dit levert te weinig op, kleiner kost te veel draw calls.
*/
const TEGEL = 240;
let tegelNu = '0:0';
const tegelVan = (x, z) => `${Math.floor(x / TEGEL)}:${Math.floor(z / TEGEL)}`;
const KERB_Y = 0.12;   // hoogte van stoep, tuin en gras boven de rijbaan
export const waterRingen = [];
// losse tellingen die de proeven uitlezen (bijvoorbeeld hoeveel bomen er onder
// het brugdek weggelaten zijn)
export const kaartTelling = {};
export const kaartLabels = [];
// Schuifpoorten van de omheinde terreinen: {terrein, groep, doos, richting,
// lengte, open, midden}. Een missie kan er een openschuiven (zie verhaal.js).
export const poortBladen = [];

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

function bboxRing(ring) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of ring) { if (x < x0) x0 = x; if (z < z0) z0 = z; if (x > x1) x1 = x; if (z > z1) z1 = z; }
  return [x0, z0, x1, z1];
}

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

/*
 Ondergrond volgt normaal de vlakke wereld, behalve op het viaduct. `HF` is daar
 de hoogte van de grond (js/viaduct.js); staat hij aan, dan worden driehoeken
 eerst opgedeeld tot ze klein genoeg zijn om de helling te volgen — anders loopt
 één driehoek van de voet tot de top van de dijk en zie je de bult niet.
*/
let HF = null;
const HF_ZIJ = 2.5;      // maximale zijde van een driehoek op de helling

function driehoek(A, B, C, y, uvSchaal, pos, uv, nor, diep = 0) {
  const zij = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  const lang = Math.max(zij(A, B), zij(B, C), zij(C, A));
  if (diep < 6 && lang > HF_ZIJ) {
    // langste zijde halveren en beide helften opnieuw
    const m = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    if (zij(A, B) === lang) { const M = m(A, B); driehoek(A, M, C, y, uvSchaal, pos, uv, nor, diep + 1); driehoek(M, B, C, y, uvSchaal, pos, uv, nor, diep + 1); }
    else if (zij(B, C) === lang) { const M = m(B, C); driehoek(A, M, C, y, uvSchaal, pos, uv, nor, diep + 1); driehoek(A, B, M, y, uvSchaal, pos, uv, nor, diep + 1); }
    else { const M = m(C, A); driehoek(A, B, M, y, uvSchaal, pos, uv, nor, diep + 1); driehoek(M, B, C, y, uvSchaal, pos, uv, nor, diep + 1); }
    return;
  }
  const P = [A[0], y + HF(A[0], A[1]), A[1]], Q = [B[0], y + HF(B[0], B[1]), B[1]], R = [C[0], y + HF(C[0], C[1]), C[1]];
  let nx = (Q[1] - P[1]) * (R[2] - P[2]) - (Q[2] - P[2]) * (R[1] - P[1]);
  let ny = (Q[2] - P[2]) * (R[0] - P[0]) - (Q[0] - P[0]) * (R[2] - P[2]);
  let nz = (Q[0] - P[0]) * (R[1] - P[1]) - (Q[1] - P[1]) * (R[0] - P[0]);
  const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
  if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
  for (const [p, q] of [[P, A], [Q, B], [R, C]]) { pos.push(p[0], p[1], p[2]); uv.push(q[0] * uvSchaal, q[1] * uvSchaal); nor.push(nx, ny, nz); }
}

// Vlak plat op hoogte y, normaal omhoog, uv in wereldmeters.
function vlakGeometrie(ringen, y, uvSchaal, pos, uv, nor) {
  const { tris, punten } = trianguleer(ringen);
  for (const [a, b, c] of tris) {
    const A = punten[a], B = punten[b], C = punten[c];
    // volgorde zodat de normaal naar +Y wijst
    const kruis = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
    const [P, Q, R] = kruis > 0 ? [A, C, B] : [A, B, C];
    if (HF) { driehoek(P, Q, R, y, uvSchaal, pos, uv, nor); continue; }
    for (const p of [P, Q, R]) { pos.push(p[0], y, p[1]); uv.push(p[0] * uvSchaal, p[1] * uvSchaal); nor.push(0, 1, 0); }
  }
}

/*
 Opstaande rand langs alle ringen van een vlak, van yBoven naar yOnder.

 De draairichting van de ring bepaalt hier álles: de zijwand wordt per rand
 opgebouwd als een vierhoek met de normaal (dz, 0, −dx), en zowel die normaal als
 de volgorde van de hoekpunten klapt om als de ring andersom loopt. Loopt hij
 verkeerd om, dan kijkt de wand naar binnen, wordt hij als achterkant weggeknipt
 en kijk je door de stoeprand heen tot op het grondvlak op −1 m. Gemeten op vijf
 standpunten was tussen de 0,14 % en 0,58 % van het beeld zo'n kier — een roze
 lijn langs elke berm en elk plantsoen in de proefopstelling waar het grondvlak
 felroze was gemaakt.

 De brondata houdt zich niet aan één draairichting, dus die wordt hier
 rechtgezet: de buitenring linksom (positieve oppervlakte in x-z), de gaten
 erbinnen rechtsom, zodat de wand van een gat de gatkant op kijkt.

 `naarBinnen` draait die keus om, voor de wanden die je juist van de andere kant
 ziet: de oeverwand van een sloot (je staat op de kant en kijkt naar het water,
 dus de wand moet de sloot in kijken) en de binnenwand van een bezinkbak. Zonder
 die vlag werd de wal bij de Lemmerweg en in IJlst juist slechter — daar is veel
 water in beeld.
*/
function ringOppervlak(ring) {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

function randGeometrie(ringen, yBoven, yOnder, pos, uv, nor, naarBinnen = false, kies = null) {
  for (let r = 0; r < ringen.length; r++) {
    const opp = ringOppervlak(ringen[r]);
    const wilLinksom = (r === 0) !== naarBinnen;
    const omdraaien = wilLinksom ? opp < 0 : opp > 0;
    const ring = omdraaien ? ringen[r].slice().reverse() : ringen[r];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const L = Math.hypot(dx, dz); if (L < 1e-4) continue;
      const nx = dz / L, nz = -dx / L;
      // op de helling in stukken, zodat de rand de dijk volgt
      const stukken = HF ? Math.max(1, Math.ceil(L / HF_ZIJ)) : 1;
      for (let s = 0; s < stukken; s++) {
        const p0 = [a[0] + dx * s / stukken, a[1] + dz * s / stukken];
        const p1 = [a[0] + dx * (s + 1) / stukken, a[1] + dz * (s + 1) / stukken];
        const h0 = HF ? HF(p0[0], p0[1]) : 0, h1 = HF ? HF(p1[0], p1[1]) : 0;
        const Ls = L / stukken;
        const quad = [[p0[0], h0 + yBoven, p0[1]], [p1[0], h1 + yBoven, p1[1]], [p1[0], h1 + yOnder, p1[1]], [p0[0], h0 + yOnder, p0[1]]];
        /*
         `kies` deelt elk stukje rand bij de tegel in waar het zelf ligt. Zonder
         dat ging een heel vlak naar de tegel van zijn eerste hoekpunt, en een
         sloot of een berm kan honderden meters lang zijn: dan lag het "midden"
         van dat brok ver weg en verdween de rand terwijl je er pal naast stond.
        */
        const doel = kies ? kies((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2) : { pos, uv, nor };
        for (const [p, q, r] of [[0, 1, 2], [0, 2, 3]]) {
          for (const k of [p, q, r]) { const v = quad[k]; doel.pos.push(v[0], v[1], v[2]); doel.uv.push(k === 1 || k === 2 ? Ls : 0, v[1]); doel.nor.push(nx, 0, nz); }
        }
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
  // kunstgras: de sportvelden die in de BGT als "kunststof" staan
  KM.kunstgras = std(T.kunstgras());
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

/*
 Maat en midden van het grondvlak onder de wereld: het gebied uit de kaart plus
 tweemaal de mistafstand aan elke kant, zodat je nergens over de rand heen kijkt.
*/
function grondMaat() {
  const g = KAART && KAART.gebied;
  if (!g) return [2600, 2600];
  return [(g.x1 - g.x0) + 2400, (g.z1 - g.z0) + 2400];
}
function grondMidden() {
  const g = KAART && KAART.gebied;
  return g ? { x: (g.x0 + g.x1) / 2, z: (g.z0 + g.z1) / 2 } : { x: 0, z: 0 };
}
function grondTextuur() {
  const t = T.grass().clone(); t.needsUpdate = true;
  const [b, d] = grondMaat();
  t.repeat.set(b / 8, d / 8);          // één grasdoek per acht meter
  return t;
}

// ---------------------------------------------------------------- bouwen
/**
 * scene: Three-scene; W: de lijsten uit world.js
 *   { MAT, colliders, roadSegments, parkSpots, treePositions, lampPosities, waterPolys, addCollider }
 */
/*
 Tegelbakken. Een klasse die over de hele kaart voorkomt hoort niet in één mesh:
 zo'n mesh heeft een omhullende bol van meer dan twee kilometer en dan kan
 frustum culling er niets mee. Alle 123.360 driehoeken van alle schuttingen van
 Sneek en IJlst gingen daardoor elk beeld naar de GPU, ook als je in de polder
 stond. `bak(bundel, cel, x, z)` levert de bak waar een stukje geometrie op
 (x, z) in hoort; `zetTegels` maakt er per bak een mesh van en meldt hem aan bij
 de LOD-afstand, zodat een tegel voorbij `ver` meter helemaal uitgaat.
*/
function bak(bundel, cel, x, z) {
  const i = Math.floor(x / cel), j = Math.floor(z / cel);
  const k = i + ':' + j;
  let g = bundel.get(k);
  if (!g) bundel.set(k, g = { pos: [], uv: [], nor: [], i, j });
  return g;
}

function zetTegels(scene, W, bundel, cel, mat, klasse, opties = {}) {
  const { schaduw = false, ver = 0 } = opties;
  let meshes = 0;
  for (const g of bundel.values()) {
    const m = maakMesh(g.pos, g.uv, g.nor, mat, { klasse, schaduw });
    if (!m) continue;
    scene.add(m); meshes++;
    // voorbij `ver` meter uit; de halve diagonaal erbij, anders gaat een tegel
    // die met zijn rand nog in beeld ligt te vroeg uit
    if (ver) W.lodAan(m, (g.i + 0.5) * cel, (g.j + 0.5) * cel, { tot: ver, straal: cel * 0.71 });
  }
  return meshes;
}

/*
 De wereld opbouwen.

 Dit duurt tientallen seconden — er zitten tienduizenden vlakken en ruim
 vijfduizend panden in — en het gebeurde in één keer. De pagina stond al die tijd
 stil: geen menu, geen teller, alleen een zwart scherm. Daarom is het nu een
 generator die tussen de fases en binnen de twee grootste lussen `yield`t. De
 aanroeper (js/main.js) laat er een paar milliseconden per beeld van draaien en
 houdt zo het laadscherm in de lucht.

 Wat er geyield wordt is de voortgang: { wat, deel } met `deel` tussen 0 en 1.
 De verdeling over de fases is gemeten en niet geschat — de panden zijn veruit
 het duurst.

 `bouwKaartWereld` blijft als gewone functie bestaan voor wie hem in één keer
 wil: die draait de generator gewoon leeg.
*/
export function bouwKaartWereld(scene, W) {
  for (const _ of bouwKaartWereldStap(scene, W)) { /* in één keer */ }
}

export function* bouwKaartWereldStap(scene, W) {
  const K = KAART;
  materialen(W.MAT);
  vlakIndex.clear(); waterRingen.length = 0; kaartLabels.length = 0; poortBladen.length = 0;
  const plat = STAND === 'plat';
  const matVoor = (v) => plat ? (KM.plat[v.k] || KM.plat.verharding) : (KM[v.m] || KM.klinker);
  const uvVoor = (m) => (m === 'gras' || m === 'erf' || m === 'bosgrond' || m === 'bodembedekker' || m === 'grasklinker') ? 0.12 : m === 'kunstgras' ? 0.2 : m === 'water' ? 0.05 : 0.5;

  // -- ondergrond, één mesh per materiaal
  const perMat = new Map();       // "materiaal|tegel" -> stuk
  const randen = new Map(), oevers = new Map();
  const stuk = (kaart, sleutel, mat, klasse) => {
    let g = kaart.get(sleutel);
    if (!g) { g = { pos: [], uv: [], nor: [], mat, klasse }; kaart.set(sleutel, g); }
    return g;
  };
  const matNr = new Map();        // materiaal -> kort nummer voor de sleutel
  // Vakken die op of tegen een viaduct liggen krijgen de hoogte van het
  // dijklichaam mee; de rest blijft plat en dus net zo goedkoop als eerst.
  const viaVakken = (K.viaducten || []).map(v => v.bbox);
  const maaiveld = (x, z) => grondHoogte(x, z, 0);
  const opHelling = (r) => {
    const b = bboxRing(r[0]);
    return viaVakken.some(q => b[2] >= q[0] && b[0] <= q[2] && b[3] >= q[1] && b[1] <= q[3]);
  };
  let vlakNr = 0;
  for (const v of K.vlakken) {
    // om de vijfhonderd vlakken het beeld teruggeven aan de browser
    if ((vlakNr++ % 250) === 0) yield { wat: 'ondergrond', deel: 0.30 * (vlakNr / K.vlakken.length) };
    for (const b of bucketsVan(v.r)) { if (!vlakIndex.has(b)) vlakIndex.set(b, []); vlakIndex.get(b).push(v); }
    /*
     Een vlak op het brugdek ligt vlak op de dekhoogte. De rest volgt de dijk op
     maaiveldniveau: de rondweg loopt onder de brug door en moet daar blijven
     liggen, dus vragen we de hoogte op y = 0 en niet die van het dek erboven.
    */
    HF = plat ? null : v.dekh ? () => v.dekh : opHelling(v.r) ? maaiveld : null;
    const mat = matVoor(v);
    if (!matNr.has(mat)) matNr.set(mat, matNr.size);
    const ring = v.r[0];
    const t = tegelVan(ring[0][0], ring[0][1]);
    const g = stuk(perMat, `${matNr.get(mat)}|${t}`, mat, v.k);
    // dekY: het brugdek van het viaduct ligt in de wereld onder de wegvakken,
    // op de controleplaat op zijn eigen hoogte (zie tools/geo/genereer.mjs)
    vlakGeometrie(v.r, (!plat && v.dekY != null) ? v.dekY : v.y, uvVoor(v.m), g.pos, g.uv, g.nor);
    if (v.k === 'water') {
      waterRingen.push(v.r[0]);
      W.waterPolys.push(v.r[0].map(([x, z]) => new THREE.Vector2(x, z)));
      if (!plat) randGeometrie(v.r, 0.13, -0.6, null, null, null, true, (x, z) => stuk(oevers, tegelVan(x, z), KM.oeverwand, 'oeverwand'));
    /*
     Opstaande rand voor élk vlak dat boven de rijbaan ligt. De grens stond op
     3 cm, en daar vielen de 157 fietspaden (y = 2 cm) en zes spoorbanen buiten:
     die lagen dus met een open rand op de weg, en van een meter of drie hoog
     keek je door die spleet tot op het grondvlak. Het scheelt 4 % meer
     randpunten.
    */
    } else if (!plat && v.y > 0.005 && v.k !== 'brug' && v.k !== 'steiger' && v.k !== 'bouwwerk') {
      randGeometrie(v.r, v.y, -0.02, null, null, null, false, (x, z) => stuk(randen, tegelVan(x, z), KM.curb, 'rand'));
    }
  }
  HF = null;
  yield { wat: 'ondergrond', deel: 0.30 };
  for (const g of perMat.values()) { const m = maakMesh(g.pos, g.uv, g.nor, g.mat, { klasse: g.klasse }); if (m) scene.add(m); }
  yield { wat: 'stoepen en oevers', deel: 0.36 };
  if (!plat) {
    // dijklichaam, brugdek en de houten bogen van het viaduct
    bouwViaducten(scene, W, KM);
    /*
     Stoepbanden en oeverwanden staan al per tegel; ze krijgen er nu een afstand
     bij. Een trottoirband is dertien centimeter hoog en een oeverwand
     drieënzeventig: op tweehonderd meter is dat een lijntje van één beeldpunt
     dat tegen de stoep en het gras wegvalt, en het waren met 272.816 driehoeken
     de vierde post in het beeld. Het vlak van de stoep zelf blijft wel staan,
     dus er valt geen gat.
    */
    for (const [t, g] of randen) {
      const m = maakMesh(g.pos, g.uv, g.nor, g.mat, { klasse: 'rand' });
      if (!m) continue; scene.add(m);
      const [i, j] = t.split(':').map(Number);
      if (Number.isFinite(i)) W.lodAan(m, (i + 0.5) * TEGEL, (j + 0.5) * TEGEL, { tot: 200, straal: TEGEL * 0.71 });
    }
    for (const [t, g] of oevers) {
      const m = maakMesh(g.pos, g.uv, g.nor, g.mat, { klasse: 'oeverwand' });
      if (!m) continue; scene.add(m);
      const [i, j] = t.split(':').map(Number);
      if (Number.isFinite(i)) W.lodAan(m, (i + 0.5) * TEGEL, (j + 0.5) * TEGEL, { tot: 260, straal: TEGEL * 0.71 });
    }
    /*
     Grondvlak onder alles, voor buiten het gebied en voor gaatjes. Dit was een
     vast vierkant van 2600 m; toen de wereld tot IJlst werd doorgetrokken (4380
     bij 2500 m) hield het op halverwege de polder en keek je daar tegen een zwart
     gat aan. Het volgt nu het gebied uit de kaart, met een ruime marge zodat de
     rand ook vanaf de buitenste hoek buiten de mist valt.
    */
    const grond = new THREE.Mesh(new THREE.PlaneGeometry(...grondMaat()), new THREE.MeshStandardMaterial({ map: grondTextuur(), roughness: 1 }));
    grond.rotation.x = -Math.PI / 2; grond.position.set(grondMidden().x, -1.0, grondMidden().z);
    grond.receiveShadow = true; scene.add(grond);   // onder het water
  } else {
    const grond = new THREE.Mesh(new THREE.PlaneGeometry(...grondMaat()), KM.plat.achtergrond);
    grond.rotation.x = -Math.PI / 2; grond.position.set(grondMidden().x, -1.0, grondMidden().z);
    scene.add(grond);
  }

  // -- panden
  yield { wat: 'gebouwen', deel: 0.42 };
  yield* bouwPandenStap(scene, W, plat);

  // -- hagen, struiken, bomen, lantaarns
  yield { wat: 'groen en straatmeubilair', deel: 0.86 };
  if (!plat) {
    const hg = { pos: [], uv: [], nor: [] };
    for (const ring of K.hagen) { vlakGeometrie([ring], 1.1, 0.5, hg.pos, hg.uv, hg.nor); randGeometrie([ring], 1.1, 0.0, hg.pos, hg.uv, hg.nor); }
    const hm = maakMesh(hg.pos, hg.uv, hg.nor, KM.hedge, { schaduw: true, klasse: 'haag' }); if (hm) scene.add(hm);
    // vrij: boom zonder botsing (doorloopbaar plantsoen)
    /*
     Bomen. Wie onder het brugdek staat groeit er dwars doorheen (een kroon is
     ruim vier meter breed en het dek ligt op 5,6 m), dus die vervalt — met een
     marge van drie meter naast het dek erbij.
    */
    let bomenWeg = 0;
    for (const b of K.bomen) {
      if (onderBrug(b.x, b.z, 3.0)) { bomenWeg++; continue; }
      W.treePositions.push({ x: b.x, z: b.z, y: grondHoogte(b.x, b.z, 0), s: b.s, tall: !!b.tall, vrij: !!b.vrij });
    }
    kaartTelling.bomenOnderBrug = bomenWeg;
    // drempels: witte markering op de rijbaan
    const dr = { pos: [], uv: [], nor: [] };
    for (const v of K.vlakken) if (v.drempel) vlakGeometrie(v.r, 0.012, 0.5, dr.pos, dr.uv, dr.nor);
    const drm = maakMesh(dr.pos, dr.uv, dr.nor, KM.drempel, { klasse: 'drempel' }); if (drm) scene.add(drm);
    // percelen: lage hagen, schuttingen en tegelpaden uit de plaatsingsregels
    /*
     De heggen en de schuttingen in tegels, de rest niet. Ze stonden allemaal als
     één mesh voor de hele kaart in de scene en dat is voor de twee grote fout:
     samen 451.600 driehoeken die van élke plek in de wereld getekend werden.
     Voor het vlakke tuinspul — tegelpaden, grindtuinen, hekjes, belijning — is
     tegelen juist een verslechtering: dat is samen maar 22.000 driehoeken, en
     opgeknipt kostte het 149 draw calls in plaats van 5. Gemeten met
     `npm run optimeer`, niet beredeneerd.
    */
    const TUIN_CEL = 240;
    const hg2 = new Map(), sch = new Map();
    const pd = { pos: [], uv: [], nor: [] }, st = { pos: [], uv: [], nor: [] };
    // `doel` is of een tegelbundel (een Map) of één bak
    const balk = (a, b, dikte, h, waar, y0 = 0) => {
      const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 0.2) return;
      const doel = waar instanceof Map ? bak(waar, TUIN_CEL, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2) : waar;
      const nx = -dz / L * dikte / 2, nz = dx / L * dikte / 2;
      /*
       De volgorde van de vier hoeken bepaalt welke kant de zijvlakken op kijken
       (`randGeometrie` legt de normaal links van de looprichting). Andersom om
       stonden ze naar binnen, en dan zie je met een gewoon materiaal de zijkant
       van een heg of schutting niet — je keek er dwars doorheen tegen de
       binnenkant van de overkant aan. Het bovenvlak trekt zich er niets van aan:
       `vlakGeometrie` draait dat zelf recht.
      */
      const ring = [[a[0] - nx, a[1] - nz], [b[0] - nx, b[1] - nz], [b[0] + nx, b[1] + nz], [a[0] + nx, a[1] + nz]];
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
    for (const t of K.tuinvlakken || []) { const d = t.m === 'grind' ? tv : tvt; vlakGeometrie([t.r], KERB_Y + 0.01, t.m === 'grind' ? 0.5 : 1 / 1.2, d.pos, d.uv, d.nor); }
    for (const f of K.schuttingen || []) balk(f.a, f.b, 0.06, f.h, sch, KERB_Y);
    for (const ring of K.paden || []) vlakGeometrie([ring], KERB_Y + 0.015, 1 / 1.2, pd.pos, pd.uv, pd.nor);
    for (const l of K.strepen || []) balk(l.a, l.b, 0.1, 0.008, st, 0.0);
    // de twee zware in tegels, met een afstand waarop ze uit mogen
    let tegelMeshes = 0;
    tegelMeshes += zetTegels(scene, W, hg2, TUIN_CEL, KM.hedge, 'heg', { schaduw: true, ver: 320 });
    tegelMeshes += zetTegels(scene, W, sch, TUIN_CEL, KM.schutting, 'schutting', { schaduw: true, ver: 260 });
    // en de rest als één mesh, zoals het was
    for (const [g, mat, k, schaduw] of [[hek, KM.hekje, 'hekje', true], [pd, KM.tegels, 'tegelpad', false], [tv, KM.grind, 'grindtuin', false], [tvt, KM.tegels, 'tegeltuin', false], [st, KM.streep, 'belijning', false]]) {
      const m = maakMesh(g.pos, g.uv, g.nor, mat, { klasse: k, schaduw }); if (m) scene.add(m);
    }
    console.log(`kaart: heggen en schuttingen in ${tegelMeshes} tegelmeshes`);
    // losse objecten uit de objectenbibliotheek (doelen, banken)
    for (const o of K.objecten || []) {
      const obj = W.maakProp ? W.maakProp(o.type) : null; if (!obj) continue;
      obj.position.set(o.x, KERB_Y + grondHoogte(o.x, o.z, 0), o.z); obj.rotation.y = (o.yaw || 0) * Math.PI / 180;
      obj.traverse(c => { c.castShadow = true; c.receiveShadow = true; });
      scene.add(obj);
      const def = PROP_TYPES[o.type];
      if (def && def.maat) W.addCollider(o.x, o.z, def.maat[0] / 2, def.maat[1] / 2, -obj.rotation.y, def.h || 2);
    }
    // omheinde terreinen: hekwerk, poort, bezinkbakken en tanks
    bouwTerreinen(scene, W);
    bouwBouwwerken(scene, W);
    /*
     Struiken per tegel. Ze zaten in één InstancedMesh van de hele wereld, en
     zo'n mesh valt nooit buiten beeld: negentienduizend bollen werden élk beeld
     getekend, ook die drie kilometer verderop in IJlst.
    */
    if (K.struiken.length) {
      const geo = new THREE.SphereGeometry(0.7, 6, 4);
      const perTegel = new Map();
      for (const s of K.struiken) {
        const t = tegelVan(s.x, s.z);
        if (!perTegel.has(t)) perTegel.set(t, []);
        perTegel.get(t).push(s);
      }
      const m = new THREE.Matrix4();
      for (const [t, lijst] of perTegel) {
        const im = new THREE.InstancedMesh(geo, KM.struik, lijst.length);
        lijst.forEach((s, i) => { m.makeScale(s.s, s.s * 0.8, s.s); m.setPosition(s.x, grondHoogte(s.x, s.z, 0) + 0.45 * s.s, s.z); im.setMatrixAt(i, m); });
        im.computeBoundingSphere(); im.userData.klasse = 'struik';
        scene.add(im);
        /*
         Voorbij tweehonderd meter uit. Een struik is anderhalve meter breed en
         een meter hoog; op die afstand is dat een groen puntje van drie
         beeldpunten dat toch al in het gras wegvalt, en er stonden er 482.436
         driehoeken van in beeld. Schaduw werpen doet hij ook niet meer: dat
         vlekje ligt binnen de struik zelf.
        */
        const [i, j] = String(t).split(':').map(Number);
        if (Number.isFinite(i)) W.lodAan(im, (i + 0.5) * TEGEL, (j + 0.5) * TEGEL, { tot: 200, straal: TEGEL * 0.71 });
      }
    }
    bouwLantaarns(scene, W);
    // de belijning, doelen, reclameborden en hekken op de sportvelden aan de
    // Molenkrite, en de tuintjes op het volkstuincomplex achter de Wieken
    bouwSportvelden(scene, W, K.sportvelden, KERB_Y);
    bouwVolkstuinen(scene, W, K.volkstuinen);
    // en de houtzaagmolen aan het Sneekerpad, met zijn zaagloodsen
    bouwMolens(scene, W, K.molens);
    bouwTankstations(scene, W, K.tankstations);
    // en de tennisbanen aan de Molenkrite, op de grindvlakken naast het sportpark
    bouwTennisparken(scene, W, K.tennisparken);
    // de afzettingen waar de wijk voor de speler ophoudt
    const dicht = bouwAfsluitingen(scene, W, K.wegafsluitingen);
    if (dicht) console.log(`kaart: ${dicht} wegafsluiting(en)`);
    // en de zuilengangen onder de twee blokken aan de Keizersmantel in Duinterpen
    const gangen = bouwZuilengangen(scene, W, K.zuilengangen);
    if (gangen) console.log(`kaart: ${gangen} zuilengang(en) gebouwd`);
  } else {
    const hg = { pos: [], uv: [], nor: [] };
    for (const ring of K.hagen) vlakGeometrie([ring], 1.1, 0.5, hg.pos, hg.uv, hg.nor);
    const hm = maakMesh(hg.pos, hg.uv, hg.nor, KM.plat.haag, { klasse: 'haag' }); if (hm) scene.add(hm);
  }

  yield { wat: 'straten', deel: 0.97 };
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
/*
 Botsingsdozen van een pand.

 Lang stond hier één doos: de omhullende rechthoek `p.rect`. Voor een rijtjeshuis
 is dat precies goed, maar de school aan de Molenkrite is een U om een plein
 heen. De omhullende rechthoek is daar 6600 m², dus het plein, de fietsenstalling
 en de paden ertussen telden mee als muur — je liep er vast, te voet en met de
 auto.

 Daarom wordt de echte voetafdruk in verticale stroken gesneden (een
 trapeziumontleding): in het assenstelsel van de rechthoek is elke hoekpunt-x een
 snijlijn, en per strook geeft een verticale scanlijn door het midden de stukken
 die bínnen de voetafdruk vallen. Voor een gewone rechthoekige plattegrond is dat
 precies één doos, dus het kost alleen iets bij de panden waar het nodig is.
*/
function pandDozen(p) {
  const r = p.rect;
  const heel = [{ x: r.cx, z: r.cz, hx: r.hx, hz: r.hz, hoek: r.hoek }];
  if (!p.voet || p.voet.length < 4) return heel;
  // Vult de voetafdruk de rechthoek zo goed als op, dan is één doos genoeg —
  // dat geldt voor vrijwel elk rijtjeshuis en scheelt duizenden dozen.
  let opp = 0;
  for (let i = 0; i < p.voet.length; i++) {
    const a = p.voet[i], b = p.voet[(i + 1) % p.voet.length];
    opp += a[0] * b[1] - b[0] * a[1];
  }
  if (Math.abs(opp / 2) > r.hx * r.hz * 4 * 0.97) return heel;

  // Het assenstelsel is dat van de langste gevel, niet dat van `p.rect`: de
  // omhullende rechthoek staat bij een hoekig complex scheef op de muren, en
  // dan wordt elke strook een trapje in plaats van een muur.
  let hoek = r.hoek, langste = 0;
  for (let i = 0; i < p.voet.length; i++) {
    const a = p.voet[i], b = p.voet[(i + 1) % p.voet.length];
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    if (L > langste) { langste = L; hoek = Math.atan2(dz, dx); }
  }
  const c = Math.cos(hoek), s = Math.sin(hoek);
  const lokaal = p.voet.map(([x, z]) => {
    const dx = x - r.cx, dz = z - r.cz;
    return [dx * c + dz * s, -dx * s + dz * c];
  });
  // de stukken van de voetafdruk op een verticale lijn u
  const snij = (u) => {
    const sn = [];
    for (let j = 0; j < lokaal.length; j++) {
      const a = lokaal[j], b = lokaal[(j + 1) % lokaal.length];
      if ((a[0] <= u) === (b[0] <= u)) continue;
      sn.push(a[1] + (u - a[0]) / (b[0] - a[0]) * (b[1] - a[1]));
    }
    return sn.sort((x, y) => x - y);
  };

  const grenzen = [...new Set(lokaal.map(q => Math.round(q[0] * 100) / 100))].sort((a, b) => a - b);
  let open = [], klaar = [];
  const strook = (u0, u1) => {
    // begin, midden en eind van de strook; bij een schuine gevel verschillen ze
    const sn = [snij(u0 + 1e-4), snij((u0 + u1) / 2), snij(u1 - 1e-4)].filter(q => q.length);
    const n = Math.min(...sn.map(q => q.length));
    const nieuw = [];
    for (let k = 0; k + 1 < n; k += 2) {
      // de doos dekt het hele stuk van de strook, dus nooit een gat in de muur
      const v0 = Math.min(...sn.map(q => q[k])), v1 = Math.max(...sn.map(q => q[k + 1]));
      if (v1 - v0 < 0.05) continue;
      const zelfde = open.find(o => o.u1 === u0 && Math.abs(o.v0 - v0) < 0.03 && Math.abs(o.v1 - v1) < 0.03);
      if (zelfde) { zelfde.u1 = u1; nieuw.push(zelfde); }
      else nieuw.push({ u0, u1, v0, v1 });
    }
    for (const o of open) if (!nieuw.includes(o)) klaar.push(o);
    open = nieuw;
  };

  for (let i = 0; i + 1 < grenzen.length; i++) {
    const u0 = grenzen[i], u1 = grenzen[i + 1];
    if (u1 - u0 < 0.05) continue;
    // hoeveel schuift de rand op over deze strook? bij meer dan een halve meter
    // wordt hij in stukjes gehakt, anders steekt de doos te ver de tuin in
    const a = snij(u0 + 1e-4), b = snij(u1 - 1e-4);
    let scheef = 0;
    for (let k = 0; k < Math.min(a.length, b.length); k++) scheef = Math.max(scheef, Math.abs(a[k] - b[k]));
    const stukken = Math.max(1, Math.min(12, Math.ceil(scheef / 0.5)));
    for (let q = 0; q < stukken; q++) strook(u0 + (u1 - u0) * q / stukken, u0 + (u1 - u0) * (q + 1) / stukken);
  }
  klaar = klaar.concat(open);
  if (!klaar.length) return heel;
  return klaar.map(o => {
    const u = (o.u0 + o.u1) / 2, v = (o.v0 + o.v1) / 2;
    return {
      x: r.cx + u * c - v * s, z: r.cz + u * s + v * c,
      hx: (o.u1 - o.u0) / 2, hz: (o.v1 - o.v0) / 2, hoek,
    };
  });
}

function bouwPanden(scene, W, plat) {
  for (const _ of bouwPandenStap(scene, W, plat)) { /* in één keer */ }
}

function* bouwPandenStap(scene, W, plat) {
  const K = KAART;
  /*
   Welke pandonderdelen in tegels en welke niet.

   Kale baksteen, dakpannen, platte daken en dakkapelwangen delen hun materiaal
   met honderden panden, dus zonder tegels wordt dat één mesh met alle muren van
   Sneek én IJlst erin. De omhullende bol daarvan is 2350 m — de halve wereld —
   en dan kan frustum culling er niets mee: die 319.319 driehoeken gingen van
   élke plek naar de GPU, in de beeldpas én in de schaduwpas.

   De gevels juist niet. Elke gevelplaat is een eigen materiaal dat maar bij een
   handvol panden voorkomt (643 materialen over 643 meshes, samen 31.205
   driehoeken), dus die meshes zijn al klein en tegelen levert alleen extra
   draw calls op. Dat is eerder geprobeerd en teruggedraaid; die conclusie
   blijft staan.

   Hoe groot de tegel moet zijn is gemeten en niet beredeneerd. Een muur-
   materiaal komt in veel tegels voor, dus fijner knippen ruilt driehoeken in
   voor draw calls. Op 480 m was dat -381.000 driehoeken voor +191 draw calls;
   op 960 m staat het in de tabel hieronder in METHODIEK.
  */
  /*
   Panden met een zuilengang (data/stijl/straten.json): daar begint de muur pas
   op de hoogte van de gang. Het stuk eronder bouwt js/zuilengang.js — de begane
   grond ligt terug achter een rij zuilen, en dat is met een gevelplaat op de
   rooilijn niet te maken.
  */
  const gangHoogte = new Map((K.zuilengangen || []).map(z => [z.pand, z.hoogte]));
  const gangBoog = new Map((K.zuilengangen || []).map(z => [z.pand, z.boog]));
  /*
   Alleen de muur langs de zuilengang mag weg, niet de hele onderbouw. De eerste
   versie knipte élk muurvlak van het pand op de ganghoogte af, dus ook de
   achterkant en de kopse kanten — en dan staat de Poiesz aan de achterkant open
   en kijk je onder het gebouw door. De gang loopt alleen langs de gebogen
   voorgevel, dus een vlak wordt pas geknipt als het op die boog ligt.
  */
  const opDeBoog = (pandId, punten) => {
    const boog = gangBoog.get(pandId);
    if (!boog) return false;
    let mx = 0, mz = 0;
    for (const p of punten) { mx += p[0]; mz += p[2]; }
    mx /= punten.length; mz /= punten.length;
    for (let i = 1; i < boog.length; i++) {
      const a2 = boog[i - 1], b2 = boog[i];
      const dx = b2[0] - a2[0], dz = b2[1] - a2[1], L2 = dx * dx + dz * dz;
      if (L2 < 1e-6) continue;
      let t = ((mx - a2[0]) * dx + (mz - a2[1]) * dz) / L2;
      t = Math.max(0, Math.min(1, t));
      if (Math.hypot(mx - (a2[0] + dx * t), mz - (a2[1] + dz * t)) < 1.2) return true;
    }
    return false;
  };

  const PAND_CEL = 960;
  const PAND_STAP = Math.round(PAND_CEL / TEGEL);
  const pandTegel = () => {
    const [i, j] = tegelNu.split(':').map(Number);
    // tegelNu staat op de tegel van 240 m; PAND_STAP daarvan naast elkaar
    return `${Math.floor(i / PAND_STAP)}:${Math.floor(j / PAND_STAP)}`;
  };
  const groepen = new Map();
  const matCache = new Map();
  const groep = (sleutel, maak, klasse, perTegel = false) => {
    const k = perTegel ? `${sleutel}#${pandTegel()}` : sleutel;
    let g = groepen.get(k);
    if (!g) {
      let mat = matCache.get(sleutel);
      if (!mat) { mat = plat ? KM.plat.pand : maak(); matCache.set(sleutel, mat); }
      g = { pos: [], uv: [], nor: [], mat, klasse, tegel: perTegel ? pandTegel() : null };
      groepen.set(k, g);
    }
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
    if (st && !ind && !pand.gang && pand.goot && laagste > pand.goot - 0.35 && Math.abs(n[1]) < 0.5 && !pand.boven) {
      if (Math.abs(kant) > 0.6 && breed >= 1.2) {
        const g = groep(`dakkapel|${st.dormerFrame || st.frame}`, () => std(T.dormerFront(st.dormerFrame || st.frame)), 'dakkapel', true);
        return { g, uvf: (p) => [(p[0] * r[0] + p[2] * r[2] - u0) / breed, Math.min(1, (p[1] - laagste) / Math.max(0.5, top - laagste))] };
      }
      const g = groep('dakkapel|wang', () => std(T.planks('#eeede8')), 'dakkapel', true);
      return { g, uvf: (p) => [(p[0] * r[0] + p[2] * r[2] - u0) / 1.2, p[1] / 1.2] };
    }
    if (pand.boven && st) {
      const totNok = !pand.nok || (pand.bovenTop ?? top) >= pand.nok - 0.6;
      if (!totNok && st.dormer) {
        // wang van een dakkapel: wit
        const g = groep('dakkapel|wang', () => std(T.planks('#eeede8')), 'dakkapel', true);
        return { g, uvf: (p) => [(p[0] * r[0] + p[2] * r[2] - u0) / 1.2, p[1] / 1.2] };
      }
      if (totNok && st.topgevel) {
        // houten topgevel boven de goot (Bonkelaar, Jasker): delen van 15 cm
        const g = groep(`planken|${st.topgevel}`, () => std(T.planks(st.topgevel)), 'topgevel', true);
        return { g, uvf: (p) => [(p[0] * r[0] + p[2] * r[2] - u0) / 1.2, p[1] / 1.2] };
      }
    }
    if (!gevel) {
      const sleutel = `steen|${pand.type}|${seed % 3}`;
      const g = groep(sleutel, () => std(T.brick(steen[0], steen[1], seed % 3 + 1)), 'muur', true);
      // baksteen: 2,6 m per texture
      return { g, uvf: (p) => [(p[0] * r[0] + p[2] * r[2] - u0) / 2.6, p[1] / 2.6] };
    }
    const achter = !ind && kant < 0;
    /*
     Een pand kan twee gevelstijlen hebben, gekozen op de hoogte van het vlak.
     Kindcentrum De Wynpôlle is een lage vleugel met een houten beschot en
     gekleurde luifels naast hogere delen van baksteen; welk vlak waarbij hoort
     staat in de hoogte van het 3D BAG-model (`steenBoven`) en niet in een
     aanname. Zonder dit zou het hele complex één van de twee worden.
    */
    const gtype = (st.steenBoven && st.bovenType && top > st.steenBoven) ? st.bovenType : pand.type;
    const gst = T.HOUSE_STYLES[gtype] || st;
    const SH = gst.storeyH || 2.9;
    // bedrijfsgevel: het aantal lagen past op de echte muurhoogte en de
    // texture wordt over de hele muur uitgerekt, zodat de dakrand bovenaan zit
    /*
     Het aantal lagen wordt normaal op vier afgekapt: hoger dan dat wordt in
     deze wijk niet gewoond, en een doek van meer lagen kost alleen maar
     geheugen. De twee flats aan de Potterzijlstraat zijn de uitzondering — die
     zijn negen lagen hoog — en die zetten `maxLagen` in hun stijl. Zonder dat
     werd hun gevel van 25 m over vier lagen uitgerekt: lagen van ruim zes meter.
    */
    const maxLagen = gst.maxLagen || 4;
    const lagen = ind ? Math.max(1, Math.min(maxLagen, Math.floor(top / SH + 0.35))) : Math.max(1, Math.min(maxLagen, Math.round(top / SH)));
    const huizen = Math.max(1, Math.round(breed / gst.w));
    const sleutel = `gevel|${gtype}|${huizen}|${lagen}|${achter}|${seed % 6}`;
    const g = groep(sleutel, () => std(T.facade(gtype, huizen, lagen, achter, seed % 6)), achter ? 'achtergevel' : 'voorgevel');
    const hoogte = ind ? Math.max(top, 2.5) : lagen * SH;
    // de texture bevat alle `huizen` naast elkaar, dus u loopt over de hele muur
    // van 0 tot 1 (met ×huizen zag een brede muur alleen de laatste pixelkolom)
    return { g, uvf: (p) => [((p[0] * r[0] + p[2] * r[2]) - u0) / breed, Math.min(1, p[1] / hoogte)] };
  };
  const dakGroep = (pand, hellend) => {
    const st = T.HOUSE_STYLES[pand.type];
    if (!hellend && st && st.industrieel) return groep(`dak|plat|${st.roof}`, () => new THREE.MeshStandardMaterial({ color: st.roof, roughness: 0.6, metalness: 0.3 }), 'platdak', true);
    if (!hellend) return groep('dak|plat', () => std(T.bitumen()), 'platdak', true);
    const kleur = st ? st.roof : '#4a3a33';
    // dakplaten in plaats van pannen (de puntdaken van de supermarkt)
    if (st && st.metaaldak) return groep(`dak|plaat|${kleur}`, () => new THREE.MeshStandardMaterial({ color: kleur, roughness: 0.5, metalness: 0.35 }), 'dak', true);
    // pannen met dakramen erin (de kap van de stelpboerderij)
    if (st && st.dakramen) return groep(`dak|ramen|${kleur}`, () => std(T.pannenMetDakramen(kleur)), 'dak', true);
    return groep(`dak|${kleur}`, () => std(T.roofTiles(kleur, 5)), 'dak', true);
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
    /*
     Zuilengang: alles onder de gang weglaten. Let op dat dit vóór de knip op de
     goot hieronder staat: bij deze blokken ís de goot de rand van de gang
     (3,95 m), en dan zou die knip de twee woonlagen erboven als kopgevel
     behandelen — kale steen in plaats van een gevel met balkons. Na het knippen
     ligt de onderkant op de ganghoogte, dus die tweede knip komt niet meer aan
     de beurt en er is geen kans op eindeloos terugroepen.
    */
    const gangH = gangHoogte.get(pand.id);
    if (gangH !== undefined && soort === 1 && Math.abs(n[1]) < 0.5 && ringen.length === 1
        && opDeBoog(pand.id, buiten)) {
      let l = Infinity, t = 0;
      for (const p of buiten) { l = Math.min(l, p[1]); t = Math.max(t, p[1]); }
      if (t <= gangH + 0.3) return;                 // dit vlak zit helemaal in de gang
      if (l < gangH - 0.02) {
        const { boven } = knipOpHoogte(buiten, gangH);
        if (boven) vlak3d(pand, [boven], 1);
        return;
      }
    }
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

  // Twee driehoeken voor een vierhoek P-Q-R-S, gedraaid zodat de normaal n naar buiten wijst.
  const vierhoek = (P, Q, R, S, g, n, uvf) => {
    const e1 = [Q[0] - P[0], Q[1] - P[1], Q[2] - P[2]], e2 = [R[0] - P[0], R[1] - P[1], R[2] - P[2]];
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const goed = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] >= 0;
    if (goed) { drie(P, Q, R, g, n, uvf); drie(P, R, S, g, n, uvf); } else { drie(P, R, Q, g, n, uvf); drie(P, S, R, g, n, uvf); }
  };
  // Een dakkapel bouwen op het voorste dakvlak van een woning waarvan het 3D
  // BAG-model er geen heeft, terwijl de rij er wel een heeft (pand.kapel uit de
  // generator): 1,1 m achter de goot, zo breed als het dak toelaat (max 3,2 m),
  // met het kozijn van het woningtype, witte wangen en een plat dakje.
  const dakkapel = (pand) => {
    const st = T.HOUSE_STYLES[pand.type]; if (!st || !st.dormer || !pand.front || !pand.rect || !pand.v) return;
    const f = [pand.front[0], 0, pand.front[1]], rr = [f[2], 0, -f[0]];
    const V = pand.v, pt = (i) => [V[i * 3], V[i * 3 + 1], V[i * 3 + 2]];
    let dak = null;
    pand.f.forEach((ringen, fi) => {
      if (pand.s[fi] !== 2) return;
      const pts = ringen[0].map(pt), n = normaal(pts);
      if (n[1] < 0.2 || n[1] > 0.97 || n[0] * f[0] + n[2] * f[2] < 0.4) return;
      let ax = 0, ay = 0, az = 0;   // oppervlak (Newell, ongenormaliseerd)
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; ax += (a[1] - b[1]) * (a[2] + b[2]); ay += (a[2] - b[2]) * (a[0] + b[0]); az += (a[0] - b[0]) * (a[1] + b[1]); }
      const opp = Math.hypot(ax, ay, az) / 2;
      if (!dak || opp > dak.opp) dak = { pts, n, opp };
    });
    if (!dak || dak.opp < 8) return;
    const c = [pand.rect.cx, 0, pand.rect.cz];
    let a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const q of dak.pts) { const a = (q[0] - c[0]) * f[0] + (q[2] - c[2]) * f[2], b = (q[0] - c[0]) * rr[0] + (q[2] - c[2]) * rr[2]; a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
    const w = Math.min(3.2, (b1 - b0) - 1.4); if (w < 1.2) return;
    const bm = (b0 + b1) / 2, aVoor = a1 - 1.1, aAchter = aVoor - 2.0;
    const P = (a, b, y) => [c[0] + f[0] * a + rr[0] * b, y, c[2] + f[2] * a + rr[2] * b];
    const q0 = dak.pts[0], n = dak.n;
    const dakY = (x, z) => q0[1] - (n[0] * (x - q0[0]) + n[2] * (z - q0[2])) / n[1];
    const pv = P(aVoor, bm, 0), pa = P(aAchter, bm, 0);
    const y0 = dakY(pv[0], pv[2]) - 0.15, yDakAchter = dakY(pa[0], pa[2]);
    const y1 = Math.min(y0 + 1.55, yDakAchter - 0.05);
    if (y1 - y0 < 1.1 || y0 < (pand.goot || 0) - 0.5) return;
    const gVoor = groep(`dakkapel|${st.dormerFrame || st.frame}`, () => std(T.dormerFront(st.dormerFrame || st.frame)), 'dakkapel', true);
    const gWang = groep('dakkapel|wang', () => std(T.planks('#eeede8')), 'dakkapel', true);
    const gTop = groep('dak|plat', () => std(T.bitumen()), 'platdak', true);
    const bl = bm - w / 2, br = bm + w / 2;
    vierhoek(P(aVoor, bl, y0), P(aVoor, br, y0), P(aVoor, br, y1), P(aVoor, bl, y1), gVoor, f, (p) => [((p[0] - c[0]) * rr[0] + (p[2] - c[2]) * rr[2] - bl) / w, Math.min(1, (p[1] - y0) / (y1 - y0))]);
    for (const [b, nz] of [[bl, [-rr[0], 0, -rr[2]]], [br, rr]]) vierhoek(P(aAchter, b, y0), P(aVoor, b, y0), P(aVoor, b, y1), P(aAchter, b, y1), gWang, nz, (p) => [((p[0] - c[0]) * f[0] + (p[2] - c[2]) * f[2]) / 1.2, p[1] / 1.2]);
    vierhoek(P(aAchter, bl, y1), P(aAchter, br, y1), P(aVoor, br, y1), P(aVoor, bl, y1), gTop, [0, 1, 0], (p) => [p[0] * 0.5, p[2] * 0.5]);
  };

  let met3d = 0, geschat = 0;
  /*
   Panden waar een molen op staat slaan we over: js/molen.js zet er een echte
   molen neer in plaats van het opgetrokken 3D BAG-model, dat bij een molen niet
   meer is dan een puntenwolk met de roeden erin. Op de platte controleplaat
   (`?boven=1&plat=1`) doen ze wél mee, want die vergelijkt het grondvlak met de
   kaartplaat uit de brondata.
  */
  const molenPanden = new Set(plat ? [] : (K.molens || []).map(m => m.pand));
  let pandNr = 0;
  for (const p of K.panden) {
    // de panden zijn het duurste stuk van de opbouw: om de tweehonderd even het
    // beeld teruggeven, zodat het laadscherm blijft lopen
    if ((pandNr++ % 60) === 0) yield { wat: 'gebouwen', deel: 0.42 + 0.38 * (pandNr / K.panden.length) };
    tegelNu = tegelVan(p.rect ? p.rect.cx : p.voet[0][0], p.rect ? p.rect.cz : p.voet[0][1]);
    if (molenPanden.has(p.id)) {
      // alleen de botsingsdozen, verderop in deze lus
    } else if (p.v && p.f) {
      const V = p.v;
      const pt = (i) => [V[i * 3], V[i * 3 + 1], V[i * 3 + 2]];
      /*
       Bij een pand met een zuilengang gaat de vlag `gang` er meteen op, en de
       goot eraf. De goot van zo'n blok is de rand van de gang (3,95 m) en niet
       een dakrand, en `muurKeuze` houdt elk vlak dat boven de goot begint voor
       de wang van een dakkapel. Dat gebeurde niet alleen bij de vlakken die
       hieronder afgeknipt worden maar ook bij de vlakken die al hoger beginnen,
       en die kwamen als wit plaatmateriaal in beeld.
      */
      const pg = gangHoogte.has(p.id) ? { ...p, gang: true, goot: null } : p;
      p.f.forEach((ringen, fi) => vlak3d(pg, ringen.map(r => r.map(pt)), p.s[fi]));
      if (p.kapel) dakkapel(pg);
      met3d++;
    } else {
      // muren naar buiten: ring met de klok mee (in xz)
      const voet = opp(p.voet) > 0 ? p.voet.slice().reverse() : p.voet;
      extrudeer(p, voet, p.goot || 3, p.dak === 'slanted');
      geschat++;
    }
    if (p.rect) {
      const h = Math.max(3, p.nok || p.goot || 3);
      for (const d of pandDozen(p)) W.addCollider(d.x, d.z, d.hx, d.hz, -d.hoek, h);
    }
    const dst = T.HOUSE_STYLES[p.type];
    if (dst && dst.dakdetail) dakDetails(scene, W, p, dst);
  }
  // de meshes van de panden: honderden stukken, en samen het duurste blok van
  // de hele opbouw na de panden zelf — dus ook hiertussen even ademhalen
  let mNr = 0;
  for (const g of groepen.values()) {
    if ((mNr++ % 6) === 0) yield { wat: 'gevels', deel: 0.80 + 0.06 * (mNr / groepen.size) };
    const m = maakMesh(g.pos, g.uv, g.nor, g.mat, { schaduw: true, klasse: g.klasse });
    if (!m) continue;
    if (plat) m.material.side = THREE.DoubleSide;
    scene.add(m);
  }
  console.log(`kaart: ${met3d} panden met 3D BAG-dak, ${geschat} geschat, ${matCache.size} materialen in ${groepen.size} stukken, ${K.vlakken.length} vlakken, ${K.wegassen.length} wegassen`);
}

/*
 Schoorstenen en zonnepanelen op een pand met een echt 3D BAG-dak.

 De rijtjes woningen die het spel zelf uitzet (js/world.js) hebben dit al; een
 pand uit de BGT had alleen een kaal dakvlak. Aan de Westhemstraat is juist dát
 het beeld van de foto: een rij schoorstenen op een rij en zonnepanelen die het
 hele voordakvlak vullen.

 Alles wordt uit de brondata afgeleid en niet geschat: de nok en de goot komen
 uit het 3D BAG-model, en `rect` geeft de richting en de maat van het pand. De
 nokrichting is de kórte as: een rijtjeswoning is diep en smal, en de nok loopt
 evenwijdig aan de straat — dus langs de kant waar de buren staan. Aan welke
 kant het voordakvlak ligt zegt `front`.

 Het staat aan per stijl (`dakdetail`), niet voor alle panden tegelijk: dan
 zouden er in één klap honderden schoorstenen bijkomen, en dat is een andere
 beslissing dan deze ene straat.
*/
function dakDetails(scene, W, p, st) {
  const R = p.rect;
  if (!R || !p.nok || !p.goot || p.nok - p.goot < 0.6) return;
  const u = [Math.cos(R.hoek), Math.sin(R.hoek)];          // lange as
  const w = [-u[1], u[0]];                                  // korte as = nokrichting
  const halfDiep = R.hx, halfNok = R.hz;
  const groep = new THREE.Group();
  const nok = p.nok, goot = p.goot;

  if (st.chimney) {
    const B = 0.62, HGT = Math.min(1.7, 0.55 + (nok - goot) * 0.35);
    const m1 = new THREE.MeshStandardMaterial({ color: 0xb3a082, roughness: 0.95 });
    const schoorsteen = new THREE.Mesh(new THREE.BoxGeometry(B, HGT, B), m1);
    schoorsteen.position.set(R.cx, nok - 0.25 + HGT / 2, R.cz);
    schoorsteen.rotation.y = -R.hoek;
    schoorsteen.castShadow = true;
    groep.add(schoorsteen);
    const kap = new THREE.Mesh(new THREE.BoxGeometry(B + 0.14, 0.1, B + 0.14),
      new THREE.MeshStandardMaterial({ color: 0x4a4744, roughness: 0.8 }));
    kap.position.set(R.cx, nok - 0.25 + HGT + 0.05, R.cz);
    kap.rotation.y = -R.hoek;
    groep.add(kap);
  }

  if (st.solar) {
    /*
     Het voordakvlak: van de goot aan de voorkant omhoog naar de nok. De helling
     volgt uit de twee hoogtes en de halve diepte, dus het paneel ligt echt op
     het dak en niet er een halve meter boven of onder.
    */
    const zij = p.front ? Math.sign(p.front[0] * u[0] + p.front[1] * u[1]) || 1 : 1;
    const loop = Math.hypot(halfDiep, nok - goot);           // lengte van het dakvlak
    const deel = st.solarFull ? 0.70 : 0.45;
    const pw = 2 * halfNok * (st.solarFull ? 0.84 : 0.55);   // breedte langs de nok
    const ph = loop * deel;
    /*
     Het dakvlak als eigen assenstelsel: `wv` langs de nok, `sv` van de nok naar
     de goot toe, `nv` er loodrecht op. Met die drie staat het paneel in één keer
     goed; met drie losse draaiingen om x en y klopt het teken maar in de helft
     van de windrichtingen.
    */
    const wv = new THREE.Vector3(w[0], 0, w[1]).normalize();
    const sv = new THREE.Vector3(zij * u[0] * halfDiep, goot - nok, zij * u[1] * halfDiep).normalize();
    let nv = new THREE.Vector3().crossVectors(sv, wv).normalize();
    if (nv.y < 0) { nv.negate(); wv.negate(); }              // de normaal hoort omhoog te wijzen
    const vlak = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph),
      new THREE.MeshStandardMaterial({ map: T.solarPanel(), roughness: 0.3, metalness: 0.5 }));
    // PlaneGeometry ligt in het xy-vlak met +z als normaal
    vlak.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(wv, sv.clone().negate(), nv));
    vlak.position.copy(new THREE.Vector3(R.cx, nok, R.cz)
      .addScaledVector(sv, ph / 2 + loop * 0.10)
      .addScaledVector(nv, 0.06));
    groep.add(vlak);
  }

  if (!groep.children.length) return;
  scene.add(groep);
  if (W.lodAan) W.lodAan(groep, R.cx, R.cz, { tot: 260, straal: Math.max(halfDiep, halfNok) + 2 });
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
  // Een hek kan een eigen kleur hebben (het spijlenhek bij Jeugdhulp Friesland
  // is donkergroen, dat van de waterzuivering staalgrijs), dus de vlakken
  // worden per kleur verzameld; elke kleur wordt één mesh.
  const perKleur = new Map();
  for (const hw of K.hekwerken || []) {
    const kleur = hw.kleur || null;
    if (kleur && !perKleur.has(kleur)) perKleur.set(kleur, { pos: [], uv: [], nor: [] });
    const doel = kleur ? perKleur.get(kleur) : sp;
    const bewaar = [sp.pos.length, sp.uv.length, sp.nor.length];
    let s = 0;
    for (let i = 1; i < hw.pts.length; i++) {
      const a = hw.pts[i - 1], b = hw.pts[i]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.2) continue;
      paneel(a, b, KERB_Y, hw.h, s); s += L;
      W.addCollider((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, L / 2, 0.08, -Math.atan2(b[1] - a[1], b[0] - a[0]), hw.h);
    }
    if (kleur) {
      doel.pos.push(...sp.pos.splice(bewaar[0]));
      doel.uv.push(...sp.uv.splice(bewaar[1]));
      doel.nor.push(...sp.nor.splice(bewaar[2]));
    }
  }
  for (const [kleur, g] of perKleur) {
    const mat = new THREE.MeshStandardMaterial({ map: T.spijlenhek(kleur), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.3 });
    const mk = maakMesh(g.pos, g.uv, g.nor, mat, { klasse: 'hekwerk', schaduw: true });
    if (mk) scene.add(mk);
  }
  /*
   De schuifpoort. Het hekblad zit in zijn eigen groep, niet in het grote
   spijlenvlak, zodat een missie hem open kan schuiven (zie verhaal.js: als de
   bewaking uitgeschakeld is, rijdt de vrachtwagen naar buiten). De groep en de
   botsingsdoos van het blad staan daarom in `poortBladen`.
  */
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
    const groep = new THREE.Group();
    const bp = { pos: [], uv: [], nor: [] };
    const bewaar = [sp.pos.length, sp.uv.length, sp.nor.length];
    paneel(blad, eind, KERB_Y + 0.1, p.h - 0.2, 0);
    bp.pos = sp.pos.splice(bewaar[0]); bp.uv = sp.uv.splice(bewaar[1]); bp.nor = sp.nor.splice(bewaar[2]);
    const bladMesh = maakMesh(bp.pos, bp.uv, bp.nor, KM.spijlen, { klasse: 'hekwerk', schaduw: true });
    if (bladMesh) groep.add(bladMesh);
    for (const y of [KERB_Y + 0.12, KERB_Y + p.h - 0.12]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(L, 0.07, 0.07), KM.staal);
      b.position.set((blad[0] + eind[0]) / 2, y, (blad[1] + eind[1]) / 2); b.rotation.y = draai; groep.add(b);
    }
    for (const q of [blad, eind]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, p.h - 0.2, 0.08), KM.staal); b.position.set(q[0], KERB_Y + p.h / 2, q[1]); groep.add(b); }
    groep.traverse(c => { c.castShadow = true; }); scene.add(groep);
    const doos = W.addCollider((blad[0] + eind[0]) / 2, (blad[1] + eind[1]) / 2, L / 2, 0.08, draai, p.h);
    doos.beweegt = true;      // een schuifpoort verhuist, dus hij hoort niet in het rooster
    poortBladen.push({
      terrein: p.terrein, groep, doos, richting: [ux, uz], lengte: L, open,
      midden: [(p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2],
    });
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
      randGeometrie([binnen], h, h - 0.35, beton.pos, beton.uv, beton.nor, true);  // binnenwand
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

/*
 Lantaarnpalen.

 Ze staan als drie instanced meshes in de wereld — paal, arm en kop — en die
 delen dezelfde matrix per paal, dus één instantie omzetten kantelt de hele
 lantaarn in één keer.

 Een paal kan omvergereden worden (verzoek beta-test 12 sep 2026). Rij je er met
 vaart tegenaan, dan klapt hij in een seconde om in de richting waarin je reed en
 zakt zijn botsdoos naar knieehoogte: erlangs rijden kan dan, en je struikelt er
 niet over. Uit beeld, en niet te snel, staat hij weer overeind — net als de
 wrakken van auto's. Er verdwijnt dus niets permanent uit de wijk.
*/
const LANTAARNS = [];      // { x, z, y, hoek, i, doos, om, t, val, richting }
let lampStapels = null;    // { palen, armen, koppen }
const LAMP_TERUG = 40;     // seconden voordat hij weer overeind mag
const LAMP_VER = 60;       // en pas als je zo ver weg bent

function bouwLantaarns(scene, W) {
  const K = KAART;
  if (!K.lantaarns.length) return;
  LANTAARNS.length = 0;
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
    const y = grondHoogte(l.x, l.z, 0);        // staat hij op de dijk van het viaduct?
    m.makeRotationY(hoek); m.setPosition(l.x, y, l.z);
    palen.setMatrixAt(i, m); armen.setMatrixAt(i, m); koppen.setMatrixAt(i, m);
    W.lampPosities.push({ x: l.x + Math.cos(hoek) * 0.7, y: y + 5.1, z: l.z - Math.sin(hoek) * 0.7 });
    const doos = W.addCollider(l.x, l.z, 0.1, 0.1, 0, 5);
    LANTAARNS.push({ x: l.x, z: l.z, y, hoek, i, doos, om: false, t: 0, val: 0, richting: 0, lamp: W.lampPosities[W.lampPosities.length - 1] });
  });
  palen.castShadow = true;
  scene.add(palen, armen, koppen);
  lampStapels = { palen, armen, koppen };
}

// De matrix van één lantaarn opnieuw schrijven, met `val` radialen kanteling.
const lampM = new THREE.Matrix4(), lampQ = new THREE.Quaternion();
const lampAs = new THREE.Vector3(), lampPos = new THREE.Vector3(), lampSchaal = new THREE.Vector3(1, 1, 1);
function zetLantaarn(L) {
  if (!lampStapels) return;
  // kantelen om de as die dwars op de valrichting staat, door de voet van de paal
  lampAs.set(Math.cos(L.richting + Math.PI / 2), 0, Math.sin(L.richting + Math.PI / 2)).normalize();
  lampQ.setFromAxisAngle(lampAs, L.val);
  lampM.compose(lampPos.set(L.x, L.y, L.z), lampQ, lampSchaal);
  lampM.multiply(new THREE.Matrix4().makeRotationY(L.hoek));
  for (const s of [lampStapels.palen, lampStapels.armen, lampStapels.koppen]) {
    s.setMatrixAt(L.i, lampM);
    s.instanceMatrix.needsUpdate = true;
  }
}

/*
 Een paal omver rijden. `x, z` is de plek van de klap, `richting` de rijrichting
 en `snelheid` hoe hard. Geeft terug of er eentje omging, zodat js/main.js er een
 klap en een schok bij kan zetten.
*/
export function raakLantaarn(x, z, richting, snelheid) {
  if (Math.abs(snelheid) < 5) return false;
  for (const L of LANTAARNS) {
    if (L.om) continue;
    if (Math.hypot(L.x - x, L.z - z) > 1.7) continue;
    L.om = true; L.t = 0; L.richting = richting;
    // de botsdoos zakt naar de hoogte van een liggende paal
    L.doos.h = 0.35;
    return true;
  }
  return false;
}

/*
 De palen laten vallen en later weer overeind zetten. js/main.js roept dit elk
 beeld aan met de plek van de speler erbij.
*/
export function werkLantaarnsBij(dt, px = null, pz = null) {
  for (const L of LANTAARNS) {
    if (!L.om) continue;
    L.t += dt;
    const doel = Math.PI / 2 - 0.06;                  // net niet plat, dat leest beter
    if (L.val < doel) {
      L.val = Math.min(doel, L.val + dt * (1.6 + L.val * 2.4));   // hij valt versneld
      zetLantaarn(L);
      if (L.lamp) L.lamp.y = L.y + 0.6;               // het licht ligt mee op straat
    } else if (L.t > LAMP_TERUG && px != null && Math.hypot(L.x - px, L.z - pz) > LAMP_VER) {
      L.om = false; L.t = 0; L.val = 0;
      L.doos.h = 5;
      if (L.lamp) L.lamp.y = L.y + 5.1;
      zetLantaarn(L);
    }
  }
}

// voor de proef: hoeveel palen liggen er om?
export function lantaarnsOm() { return LANTAARNS.filter(L => L.om).length; }
export function lantaarnBij(x, z, straal = 3) {
  return LANTAARNS.find(L => Math.hypot(L.x - x, L.z - z) <= straal) || null;
}

/** Startpositie en kijkrichting uit de kaart. */
export function startKaart() { return KAART.start; }
