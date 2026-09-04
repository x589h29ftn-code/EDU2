// Generator: van de brondata in data/geo/ naar js/kaart.js, de kaart waar het
// spel op draait. Alles in meters, oorsprong op het kruispunt uit
// data/geo/oorsprong.json, +X = oost, +Z = zuid (zie docs/METHODIEK.md §4).
//
//   node tools/geo/genereer.mjs
//
// Wat erin gaat: BGT-vlakken (ondergrond), 3D BAG (panden met echte daken),
// straatnaamlabels en huisnummers. Wat eruit komt staat onderaan in TELLING
// en wordt door tools/geo/controle.mjs en het bovenaanzicht getoetst.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { middellijnen, raster, vulRaster } from './skelet.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HIER, '..', '..');
const GEO = join(ROOT, 'data', 'geo');
const UIT = join(ROOT, 'js', 'kaart.js');

const lees = (n) => JSON.parse(readFileSync(join(GEO, 'bron', n + '.geojson'), 'utf8')).features;
const leesOpt = (n) => existsSync(join(GEO, 'bron', n + '.geojson')) ? lees(n) : [];
const oorsprong = JSON.parse(readFileSync(join(GEO, 'oorsprong.json'), 'utf8'));
const [X0, Y0] = oorsprong.rd;
const gebiedRd = (() => {
  const g = JSON.parse(readFileSync(join(GEO, 'gebied.geojson'), 'utf8'));
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  const loop = (a) => { if (typeof a[0] === 'number') { b[0] = Math.min(b[0], a[0]); b[1] = Math.min(b[1], a[1]); b[2] = Math.max(b[2], a[0]); b[3] = Math.max(b[3], a[1]); } else for (const c of a) loop(c); };
  for (const f of g.features) loop(f.geometry.coordinates);
  return b;
})();
// gebied in spelmeters: x0..x1 west->oost, z0..z1 noord->zuid
const G = { x0: gebiedRd[0] - X0, x1: gebiedRd[2] - X0, z0: Y0 - gebiedRd[3], z1: Y0 - gebiedRd[1] };
const r2 = (v) => Math.round(v * 100) / 100;
const naarSpel = ([X, Y]) => [r2(X - X0), r2(Y0 - Y)];

// ---------------------------------------------------------------- meetkunde
function oppervlak(ring) { let a = 0; for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
function inRing(p, ring) {
  let binnen = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) binnen = !binnen;
  }
  return binnen;
}
const inPolygoon = (p, ringen) => inRing(p, ringen[0]) && !ringen.slice(1).some(h => inRing(p, h));
function bboxRing(ring) { const b = [Infinity, Infinity, -Infinity, -Infinity]; for (const [x, z] of ring) { if (x < b[0]) b[0] = x; if (z < b[1]) b[1] = z; if (x > b[2]) b[2] = x; if (z > b[3]) b[3] = z; } return b; }
function zwaartepunt(ring) { let x = 0, z = 0; for (const p of ring) { x += p[0]; z += p[1]; } return [x / ring.length, z / ring.length]; }

// Sutherland-Hodgman tegen de rechthoek van het gebied.
function knipRing(ring) {
  let uit = ring;
  const stappen = [
    (p) => p[0] >= G.x0, (a, b) => snij(a, b, 0, G.x0),
    (p) => p[0] <= G.x1, (a, b) => snij(a, b, 0, G.x1),
    (p) => p[1] >= G.z0, (a, b) => snij(a, b, 1, G.z0),
    (p) => p[1] <= G.z1, (a, b) => snij(a, b, 1, G.z1),
  ];
  for (let s = 0; s < stappen.length; s += 2) {
    const binnen = stappen[s], kruis = stappen[s + 1];
    const inp = uit; uit = [];
    for (let i = 0; i < inp.length; i++) {
      const a = inp[(i + inp.length - 1) % inp.length], b = inp[i];
      const bIn = binnen(b), aIn = binnen(a);
      if (bIn) { if (!aIn) uit.push(kruis(a, b)); uit.push(b); }
      else if (aIn) uit.push(kruis(a, b));
    }
    if (uit.length < 3) return null;
  }
  // dubbele punten weg
  const schoon = uit.filter((p, i) => { const q = uit[(i + 1) % uit.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-3; });
  return schoon.length >= 3 ? schoon.map(p => [r2(p[0]), r2(p[1])]) : null;
}
function snij(a, b, as, v) { const t = (v - a[as]) / (b[as] - a[as]); return as === 0 ? [v, a[1] + t * (b[1] - a[1])] : [a[0] + t * (b[0] - a[0]), v]; }

// GeoJSON-geometrie (RD) -> lijst polygonen [[ring, gat, ...]] in spelmeters, geknipt.
function polygonen(geom) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
  const uit = [];
  for (const p of polys) {
    const ringen = [];
    for (let i = 0; i < p.length; i++) {
      let ring = p[i].map(naarSpel);
      if (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring = ring.slice(0, -1);
      const g = knipRing(ring);
      if (g) ringen.push(g); else if (i === 0) break;
    }
    if (ringen.length && Math.abs(oppervlak(ringen[0])) > 0.05) uit.push(ringen);
  }
  return uit;
}

// Kleinste omsluitende rechthoek (convexe omhulling + draaiende passer).
function omhulling(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const kr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const onder = [], boven = [];
  for (const q of p) { while (onder.length >= 2 && kr(onder[onder.length - 2], onder[onder.length - 1], q) <= 0) onder.pop(); onder.push(q); }
  for (const q of p.reverse()) { while (boven.length >= 2 && kr(boven[boven.length - 2], boven[boven.length - 1], q) <= 0) boven.pop(); boven.push(q); }
  return onder.slice(0, -1).concat(boven.slice(0, -1));
}
function kleinsteRechthoek(pts) {
  const h = omhulling(pts);
  let best = null;
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = h[(i + 1) % h.length];
    const hoek = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const c = Math.cos(-hoek), s = Math.sin(-hoek);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [x, z] of h) { const u = x * c - z * s, v = x * s + z * c; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const opp = (u1 - u0) * (v1 - v0);
    if (!best || opp < best.opp) {
      const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
      best = { opp, hoek, L: u1 - u0, B: v1 - v0, cx: cu * Math.cos(hoek) - cv * Math.sin(hoek), cz: cu * Math.sin(hoek) + cv * Math.cos(hoek) };
    }
  }
  if (best && best.B > best.L) { best.hoek += Math.PI / 2; [best.L, best.B] = [best.B, best.L]; }
  return best;
}

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ---------------------------------------------------------------- ondergrond
const VLAKKEN = [];
const telling = {};
const tel = (k, n = 1) => { telling[k] = (telling[k] || 0) + n; };

// materiaal uit de BGT-verharding
function verharding(plus, basis, functie) {
  switch (plus) {
    case 'betonstraatstenen': return 'klinker';
    case 'gebakken klinkers': case 'sierbestrating': return 'rood';
    case 'tegels': return 'tegels';
    case 'asfalt': return 'asfalt';
    case 'beton element': case 'cementbeton': return 'beton';
    case 'grasklinkers': return 'grasklinker';
    case 'grind': return 'grind';
  }
  if (basis === 'gesloten verharding') return 'asfalt';
  if (basis === 'half verhard') return 'grind';
  if (functie === 'voetpad') return 'tegels';
  if (functie === 'fietspad') return 'fietspad';
  return 'klinker';
}

const KERB = 0.12;
function voegVlak(klasse, mat, y, geom, props = {}) {
  for (const ringen of polygonen(geom)) { VLAKKEN.push({ k: klasse, m: mat, y, r: ringen, ...props }); tel(klasse); }
}

const wegdelen = lees('bgt_wegdeel');
for (const f of wegdelen) {
  const p = f.properties, fn = p.function;
  const mat = verharding(p.plus_fysiekVoorkomenWegdeel, p.surfaceMaterial, fn);
  if (fn.startsWith('rijbaan')) voegVlak(fn === 'rijbaan autoweg' ? 'autoweg' : 'rijbaan', mat, 0, f.geometry, { drempel: p.plus_functieWegdeel === 'verkeersdrempel' || undefined, hl: p.relatieveHoogteligging || undefined });
  else if (fn === 'woonerf') voegVlak('woonerf', mat, 0, f.geometry);
  else if (fn === 'parkeervlak') voegVlak('parkeervlak', mat, 0, f.geometry);
  else if (fn === 'inrit') voegVlak('inrit', mat, 0.04, f.geometry);
  else if (fn === 'fietspad') voegVlak('fietspad', mat === 'klinker' ? 'fietspad' : mat, 0.02, f.geometry, { hl: p.relatieveHoogteligging || undefined });
  else if (fn === 'voetpad') voegVlak('voetpad', mat, KERB, f.geometry);
  else if (fn === 'spoorbaan') voegVlak('spoorbaan', 'grind', 0.02, f.geometry);
  else voegVlak('verharding', mat, KERB, f.geometry);
}
for (const f of lees('bgt_ondersteunendwegdeel')) voegVlak('berm', 'gras', KERB, f.geometry);
for (const f of lees('bgt_begroeidterreindeel')) {
  const plus = f.properties.plus_fysiekVoorkomen;
  const k = plus === 'bosplantsoen' ? 'bos' : plus === 'heesters' ? 'heesters' : (plus === 'bodembedekkers' || plus === 'planten') ? 'bodembedekker' : 'gras';
  voegVlak(k, k === 'bos' ? 'bosgrond' : k === 'gras' ? 'gras' : 'bodembedekker', KERB, f.geometry);
}
for (const f of lees('bgt_onbegroeidterreindeel')) {
  const p = f.properties, fy = p.bgt_fysiekVoorkomen;
  if (fy === 'erf') voegVlak('erf', 'erf', KERB, f.geometry);
  else if (fy === 'zand') voegVlak('zand', 'zand', 0.06, f.geometry);
  else if (fy === 'gesloten verharding') voegVlak('asfaltvlak', 'asfalt', KERB, f.geometry);
  else if (fy === 'half verhard') voegVlak('halfverhard', 'grind', 0.08, f.geometry);
  else voegVlak('verharding', verharding(p.plus_fysiekVoorkomen, fy, 'voetpad'), KERB, f.geometry);
}
for (const f of lees('bgt_waterdeel')) voegVlak('water', 'water', -0.35, f.geometry);
for (const f of leesOpt('bgt_ondersteunendwaterdeel')) voegVlak('oever', 'oever', 0.0, f.geometry);
for (const f of leesOpt('bgt_overbruggingsdeel')) voegVlak('brug', 'asfalt', 0.15, f.geometry);
for (const f of leesOpt('bgt_kunstwerkdeel')) if (f.geometry.type !== 'LineString') voegVlak('steiger', 'hout', 0.3, f.geometry);
for (const f of leesOpt('bgt_overigbouwwerk')) if (f.geometry.type !== 'LineString') voegVlak('bouwwerk', 'beton', 0.5, f.geometry);

// ---------------------------------------------------------------- panden
const cityjson = JSON.parse(readFileSync(join(GEO, 'bron', '9-632-1008.city.json'), 'utf8'));
const CJ = cityjson.CityObjects, VERT = cityjson.vertices, TR = cityjson.transform;
const rdVertex = (i) => { const v = VERT[i]; return [v[0] * TR.scale[0] + TR.translate[0], v[1] * TR.scale[1] + TR.translate[1], v[2] * TR.scale[2] + TR.translate[2]]; };

const bgtPanden = lees('bgt_pand');
const nummersPerPand = new Map();
for (const f of bgtPanden) { const id = String(f.properties.identificatieBAGPND); if (f.properties.huisnummers) nummersPerPand.set(id, f.properties.huisnummers); }
// positie van het huisnummerlabel (staat bij de voordeur) in spelmeters
const nrPositie = (id) => { const h = nummersPerPand.get(id); return h && h.length ? naarSpel(h[0].pos) : null; };

const PANDEN = [];
const gezien = new Set();
const SOORT = { GroundSurface: 0, WallSurface: 1, RoofSurface: 2 };
for (const f of lees('bag3d_pand')) {
  const p = f.properties;
  const id = p.identificatie.replace('NL.IMBAG.Pand.', '');
  const voetPolys = polygonen(f.geometry);
  if (!voetPolys.length) continue;
  const voet = voetPolys[0][0];
  const zp = zwaartepunt(voet);
  if (zp[0] < G.x0 || zp[0] > G.x1 || zp[1] < G.z0 || zp[1] > G.z1) continue;
  gezien.add(id);
  const maaiveld = p.b3_h_maaiveld ?? 0;
  const pand = {
    id, voet, jaar: p.oorspronkelijkbouwjaar, dak: p.b3_dak_type, goot: p.goothoogte, nok: p.nokhoogte,
    nr: (nummersPerPand.get(id) || []).map(h => h.tekst),
  };
  const np = nrPositie(id); if (np) pand.nrpos = np;
  // 3D-model uit CityJSON (LoD 2.2): gedeelde hoekpunten + vlakken met soort
  const gebouw = CJ[p.identificatie];
  if (gebouw) {
    const idx = new Map(); const v = []; const fl = []; const s = [];
    const hoekpunt = (i) => {
      let k = idx.get(i);
      if (k === undefined) {
        const [X, Y, Z] = rdVertex(i);
        k = v.length / 3; idx.set(i, k);
        v.push(r2(X - X0), r2(Z - maaiveld), r2(Y0 - Y));
      }
      return k;
    };
    for (const kind of gebouw.children || []) {
      const deel = CJ[kind]; if (!deel) continue;
      for (const geom of deel.geometry || []) {
        if (String(geom.lod) !== '2.2') continue;
        const shells = geom.type === 'Solid' ? geom.boundaries : [geom.boundaries];
        const sem = geom.type === 'Solid' ? geom.semantics?.values : [geom.semantics?.values];
        shells.forEach((shell, si) => shell.forEach((face, fi) => {
          const type = geom.semantics?.surfaces?.[sem?.[si]?.[fi]]?.type;
          const soort = SOORT[type] ?? 1;
          if (soort === 0) return;                   // grondvlak hoeft niet
          fl.push(face.map(ring => ring.map(hoekpunt)));
          s.push(soort);
        }));
      }
    }
    if (fl.length) { pand.v = v; pand.f = fl; pand.s = s; }
  }
  if (!pand.v) pand.schat = true;
  PANDEN.push(pand);
}
// BGT-panden zonder 3D BAG: schuurtjes en nieuwbouw, met een geschatte hoogte
for (const f of bgtPanden) {
  const id = String(f.properties.identificatieBAGPND);
  if (gezien.has(id)) continue;
  const polys = polygonen(f.geometry);
  if (!polys.length) continue;
  const voet = polys[0][0];
  const zp = zwaartepunt(voet);
  if (zp[0] < G.x0 || zp[0] > G.x1 || zp[1] < G.z0 || zp[1] > G.z1) continue;
  const nrs = (f.properties.huisnummers || []).map(h => h.tekst);
  const opp = Math.abs(oppervlak(voet));
  const woning = nrs.length > 0 || opp > 45;
  const np = nrPositie(id);
  PANDEN.push({ id, voet, nr: nrs, schat: true, dak: woning ? 'slanted' : 'horizontal', goot: woning ? 5.8 : 2.5, nok: woning ? 8.8 : 2.5, ...(np ? { nrpos: np } : {}) });
}
for (const p of PANDEN) {
  const r = kleinsteRechthoek(p.voet);
  if (r) p.rect = { cx: r2(r.cx), cz: r2(r.cz), hx: r2(r.L / 2), hz: r2(r.B / 2), hoek: Math.round(r.hoek * 1000) / 1000 };
}
tel('panden', PANDEN.length); tel('panden_3d', PANDEN.filter(p => p.v).length); tel('panden_geschat', PANDEN.filter(p => p.schat).length);

// ---------------------------------------------------------------- wegassen
const gebiedBbox = [G.x0 - 1, G.z0 - 1, G.x1 + 1, G.z1 + 1];
const rijPolys = VLAKKEN.filter(v => v.k === 'rijbaan' || v.k === 'autoweg' || v.k === 'woonerf');
const loopPolys = VLAKKEN.filter(v => v.k === 'voetpad' || v.k === 'fietspad');
console.time('middellijnen rijbaan');
const rijKetens = middellijnen(rijPolys.map(v => v.r), { cel: 0.25, bbox: gebiedBbox, tol: 0.4, snoei: 2 });
console.timeEnd('middellijnen rijbaan');
console.time('middellijnen voetpad');
const loopKetens = middellijnen(loopPolys.map(v => v.r), { cel: 0.25, bbox: gebiedBbox, tol: 0.3, snoei: 1.5 });
console.timeEnd('middellijnen voetpad');

// Namen: labelpunt -> rijbaanvlak -> keten die door dat vlak loopt; daarna via
// de aansluitingen doorgeven aan naamloze ketens.
const labels = lees('bgt_openbareruimtelabel').map(f => ({ t: f.properties.tekst, p: naarSpel(f.geometry.coordinates), hoek: f.properties.hoek || 0 }));
const alleGrond = VLAKKEN.filter(v => v.k !== 'water');
const naamVanVlak = new Map();
for (const l of labels) {
  const vlak = alleGrond.find(v => inPolygoon(l.p, v.r));
  if (vlak) naamVanVlak.set(vlak, l.t);
}
function vlakOp(p, lijst) { return lijst.find(v => { const b = bboxRing(v.r[0]); return p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3] && inPolygoon(p, v.r); }); }
function afstandTotKeten(p, k) {
  let best = Infinity;
  for (let i = 1; i < k.pts.length; i++) {
    const a = k.pts[i - 1], b = k.pts[i];
    const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1e-9;
    const t = Math.max(0, Math.min(1, ((p[0] - a.x) * dx + (p[1] - a.z) * dz) / L2));
    best = Math.min(best, Math.hypot(a.x + dx * t - p[0], a.z + dz * t - p[1]));
  }
  return best;
}
// Positie (booglengte) van het dichtstbijzijnde punt op een keten.
function positieOpKeten(p, k) {
  let best = { d: Infinity, s: 0 }, acc = 0;
  for (let i = 1; i < k.pts.length; i++) {
    const a = k.pts[i - 1], b = k.pts[i];
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz), L2 = L * L || 1e-9;
    const t = Math.max(0, Math.min(1, ((p[0] - a.x) * dx + (p[1] - a.z) * dz) / L2));
    const d = Math.hypot(a.x + dx * t - p[0], a.z + dz * t - p[1]);
    if (d < best.d) best = { d, s: acc + t * L };
    acc += L;
  }
  return best;
}
// Deel van een keten tussen booglengte s0 en s1.
function deelKeten(k, s0, s1) {
  const pts = []; let acc = 0;
  const tussen = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, w: a.w + (b.w - a.w) * t });
  for (let i = 1; i < k.pts.length; i++) {
    const a = k.pts[i - 1], b = k.pts[i], L = Math.hypot(b.x - a.x, b.z - a.z);
    const sa = acc, sb = acc + L;
    if (sb < s0 || sa > s1) { acc = sb; continue; }
    if (!pts.length) pts.push(sa >= s0 ? a : tussen(a, b, (s0 - sa) / (L || 1)));
    if (sb <= s1) pts.push(b); else { pts.push(tussen(a, b, (s1 - sa) / (L || 1))); break; }
    acc = sb;
  }
  if (pts.length < 2) return null;
  let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  if (L < 1) return null;
  const ws = pts.map(q => q.w).sort((a, b) => a - b);
  return { pts: pts.map(q => ({ x: r2(q.x), z: r2(q.z), w: Math.round(q.w * 10) / 10 })), w: ws[Math.floor(ws.length / 2)], lengte: Math.round(L * 10) / 10 };
}
// Labels aan ketens hangen. Een keten die door meer dan één straat loopt
// (Kruirad gaat zonder knik over in de Monnikmolen) wordt geknipt halverwege
// tussen twee labels met een verschillende naam.
function splitsOpLabels(ketens) {
  const uit = [];
  for (const k of ketens) {
    const hits = [];
    for (const l of labels) { const { d, s } = positieOpKeten(l.p, k); if (d < 12) hits.push({ naam: l.t, s }); }
    const namen = new Set(hits.map(h => h.naam));
    if (namen.size < 2) { if (hits.length) k.naam = hits[0].naam; uit.push(k); continue; }
    hits.sort((a, b) => a.s - b.s);
    const grenzen = [];
    for (let i = 1; i < hits.length; i++) if (hits[i].naam !== hits[i - 1].naam) grenzen.push((hits[i].s + hits[i - 1].s) / 2);
    grenzen.push(Infinity);
    let start = 0;
    for (const g of grenzen) {
      const stuk = deelKeten(k, start, g);
      const naam = hits.find(h => h.s >= start && h.s < g)?.naam;
      if (stuk) { stuk.naam = naam; uit.push(stuk); }
      start = g;
    }
  }
  return uit;
}
function benoem(ketens, polys) {
  const autoweg = polys.filter(v => v.k === 'autoweg');
  for (const k of ketens) {
    if (k.naam) continue;
    const mid = k.pts[Math.floor(k.pts.length / 2)];
    // de rijksweg heeft geen BGT-label; alles wat door een autowegvlak loopt heet N7
    if (vlakOp([mid.x, mid.z], autoweg)) { k.naam = 'N7'; continue; }
    for (const p of [[mid.x, mid.z], [k.pts[0].x, k.pts[0].z], [k.pts[k.pts.length - 1].x, k.pts[k.pts.length - 1].z]]) {
      const v = vlakOp(p, polys);
      if (v && naamVanVlak.has(v)) { k.naam = naamVanVlak.get(v); break; }
    }
  }
  // doorgeven via aansluitingen (langste buur eerst)
  const sleutel = (p) => `${Math.round(p.x / 0.6)}:${Math.round(p.z / 0.6)}`;
  for (let ronde = 0; ronde < 12; ronde++) {
    const bijEind = new Map();
    for (const k of ketens) for (const p of [k.pts[0], k.pts[k.pts.length - 1]]) { const s = sleutel(p); if (!bijEind.has(s)) bijEind.set(s, []); bijEind.get(s).push(k); }
    let nieuw = 0;
    for (const k of ketens) {
      if (k.naam) continue;
      const buren = [k.pts[0], k.pts[k.pts.length - 1]].flatMap(p => bijEind.get(sleutel(p)) || []).filter(b => b !== k && b.naam);
      if (buren.length) { buren.sort((a, b) => b.lengte - a.lengte); k.naam = buren[0].naam; nieuw++; }
    }
    if (!nieuw) break;
  }
}
const rijKetens2 = splitsOpLabels(rijKetens); rijKetens.length = 0; rijKetens.push(...rijKetens2);
benoem(rijKetens, rijPolys);
// paden krijgen de naam van de dichtstbijzijnde rijbaanketen
for (const k of loopKetens) {
  const mid = k.pts[Math.floor(k.pts.length / 2)];
  let best = null, bd = 40;
  for (const r of rijKetens) if (r.naam) for (const p of r.pts) { const d = Math.hypot(p.x - mid.x, p.z - mid.z); if (d < bd) { bd = d; best = r.naam; } }
  k.naam = best || 'Tinga';
}
const WEGASSEN = [
  ...rijKetens.map(k => ({ naam: k.naam || 'Tinga', drive: true, w: k.w, lengte: k.lengte, pts: k.pts.map(p => [p.x, p.z, p.w]) })),
  ...loopKetens.map(k => ({ naam: k.naam, drive: false, w: k.w, lengte: k.lengte, pts: k.pts.map(p => [p.x, p.z, p.w]) })),
];
tel('wegassen_rijbaan', rijKetens.length); tel('wegassen_pad', loopKetens.length);
tel('wegassen_rijbaan_m', Math.round(rijKetens.reduce((t, k) => t + k.lengte, 0)));
tel('wegassen_zonder_naam', rijKetens.filter(k => !k.naam).length);

// ---------------------------------------------------------------- panden: straat, voorgevel, type
// De straat van een pand is de naam van de dichtstbijzijnde rijbaanas; de
// voorgevel kijkt naar het dichtstbijzijnde punt op die as. Het woningtype komt
// uit data/stijl/straten.json, met de goothoogte en het daktype uit 3D BAG als
// onderscheid binnen de straat.
const STIJL = JSON.parse(readFileSync(join(ROOT, 'data', 'stijl', 'straten.json'), 'utf8'));
function dichtstbijOpAs(x, z) {
  let best = null;
  for (const k of rijKetens) {
    if (!k.naam || k.naam === 'N7') continue;
    for (let i = 1; i < k.pts.length; i++) {
      const a = k.pts[i - 1], b = k.pts[i];
      const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1e-9;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2));
      const px = a.x + dx * t, pz = a.z + dz * t;
      const d = Math.hypot(px - x, pz - z);
      if (!best || d < best.d) best = { d, px, pz, naam: k.naam };
    }
  }
  return best;
}
function kiesType(p, straat) {
  const s = STIJL.straten[straat];
  const laag = (p.goot ?? 6) < 4, plat = p.dak === 'horizontal' || p.dak === 'multiple horizontal';
  const opp = Math.abs(oppervlak(p.voet));
  if (opp > 300) return STIJL.standaard.groot;
  if (opp < 35 && !p.nr.length) return 'schuur';           // bijgebouw: kale steen, geen gevel
  if (s) {
    if (plat && s.plat) return s.plat;
    if (laag && s.laag) return s.laag;
    if (s.afwisselend && Number(String(p.id).slice(-1)) % 2 === 1) return s.afwisselend;
    return s.type;
  }
  if (plat && (p.goot ?? 0) > 7) return STIJL.standaard.plat_hoog;
  if (plat) return STIJL.standaard.plat;
  if (laag) return STIJL.standaard.laag;
  return STIJL.standaard.type;
}
let zonderStraat = 0;
for (const p of PANDEN) {
  const [cx, cz] = zwaartepunt(p.voet);
  // het huisnummerlabel staat aan de voordeurkant: daarvandaan de straat zoeken
  const [qx, qz] = p.nrpos || [cx, cz];
  const b = dichtstbijOpAs(qx, qz);
  if (b && b.d < 60) {
    p.straat = b.naam;
    const L = Math.hypot(b.px - cx, b.pz - cz) || 1;
    p.front = [r2((b.px - cx) / L), r2((b.pz - cz) / L)];
  } else zonderStraat++;
  p.type = kiesType(p, p.straat);
}
tel('panden_zonder_straat', zonderStraat);
const perType = {}; for (const p of PANDEN) perType[p.type] = (perType[p.type] || 0) + 1;
telling.woningtypen = perType;

// ---------------------------------------------------------------- parkeerplekken
const PARKEER = [];
const rp = rng(7);
for (const v of VLAKKEN.filter(v => v.k === 'parkeervlak')) {
  const rect = kleinsteRechthoek(v.r[0]);
  if (!rect || rect.L < 4.5) continue;
  const u = [Math.cos(rect.hoek), Math.sin(rect.hoek)], n = [-u[1], u[0]];
  const langs = rect.B < 3.6;            // smalle strook: langsparkeren
  const stap = langs ? 5.8 : 2.5;
  const aantal = Math.floor(rect.L / stap);
  const rijen = langs ? 1 : Math.max(1, Math.floor(rect.B / 5.0));
  for (let ri = 0; ri < rijen; ri++) {
    const off = rijen === 1 ? 0 : (ri - (rijen - 1) / 2) * (rect.B / rijen);
    for (let i = 0; i < aantal; i++) {
      const t = (i + 0.5) * stap - rect.L / 2;
      const x = rect.cx + u[0] * t + n[0] * off, z = rect.cz + u[1] * t + n[1] * off;
      if (!inPolygoon([x, z], v.r)) continue;
      if (rp() > 0.32) continue;          // ruwweg een derde van de vakken bezet
      // yaw zoals in vehicles.js: rijrichting d -> atan2(-dx, -dz)
      const d = langs ? u : (rp() < 0.5 ? n : [-n[0], -n[1]]);
      PARKEER.push({ x: r2(x), z: r2(z), yaw: Math.round(Math.atan2(-d[0], -d[1]) * 1000) / 1000 });
    }
  }
}
tel('parkeerplekken', PARKEER.length);

// ---------------------------------------------------------------- groen
const BOMEN = [], STRUIKEN = [], HAGEN = [];
const rg = rng(11);
function strooi(vlak, afstand, uit, schaal) {
  const b = bboxRing(vlak.r[0]);
  for (let z = b[1] + afstand / 2; z < b[3]; z += afstand) for (let x = b[0] + afstand / 2; x < b[2]; x += afstand) {
    const px = x + (rg() - 0.5) * afstand * 0.7, pz = z + (rg() - 0.5) * afstand * 0.7;
    if (inPolygoon([px, pz], vlak.r)) uit.push({ x: r2(px), z: r2(pz), s: r2(schaal[0] + rg() * (schaal[1] - schaal[0])) });
  }
}
for (const v of VLAKKEN) {
  if (v.k === 'bos') strooi(v, 5.5, BOMEN, [0.9, 1.6]);
  if (v.k === 'heesters') strooi(v, 2.2, STRUIKEN, [0.7, 1.2]);
}
for (const f of leesOpt('bgt_vegetatieobject')) for (const ringen of polygonen(f.geometry)) HAGEN.push(ringen[0]);
tel('bomen_bos', BOMEN.length); tel('struiken', STRUIKEN.length); tel('hagen', HAGEN.length);

// Lantaarnpalen staan niet in de BGT van deze gemeente. Plaatsingsregel: om de
// dertig meter langs een rijbaanas, een meter buiten de rijbaan, alleen waar
// dat op stoep, berm of gras uitkomt.
const klasseRaster = raster([], 0.5, gebiedBbox);
const KLASSE = { rijbaan: 1, autoweg: 1, woonerf: 1, parkeervlak: 1, inrit: 1, fietspad: 1, water: 2, oever: 2, voetpad: 3, berm: 3, gras: 3, bodembedekker: 3, heesters: 4, bos: 4, erf: 5, verharding: 3 };
for (const [k, code] of Object.entries(KLASSE)) vulRaster(klasseRaster.g, klasseRaster.W, klasseRaster.H, VLAKKEN.filter(v => v.k === k).map(v => v.r), 0.5, klasseRaster.x0, klasseRaster.z0, code);
for (const p of PANDEN) vulRaster(klasseRaster.g, klasseRaster.W, klasseRaster.H, [[p.voet]], 0.5, klasseRaster.x0, klasseRaster.z0, 6);
const klasseOp = (x, z) => { const i = Math.floor((x - klasseRaster.x0) / 0.5), j = Math.floor((z - klasseRaster.z0) / 0.5); return (i < 0 || j < 0 || i >= klasseRaster.W || j >= klasseRaster.H) ? 0 : klasseRaster.g[j * klasseRaster.W + i]; };

const LANTAARNS = [];
for (const k of rijKetens) {
  if (k.w > 12 || k.lengte < 20) continue;      // niet langs de N7
  let s = 12, zijde = 1;
  for (let i = 1; i < k.pts.length; i++) {
    const a = k.pts[i - 1], b = k.pts[i];
    const L = Math.hypot(b.x - a.x, b.z - a.z); if (L < 1e-3) continue;
    const ux = (b.x - a.x) / L, uz = (b.z - a.z) / L;
    while (s <= L) {
      const t = s / L, x = a.x + ux * s, z = a.z + uz * s, w = a.w + (b.w - a.w) * t;
      for (const zij of [zijde, -zijde]) {
        const lx = x + (-uz) * zij * (w / 2 + 1.0), lz = z + ux * zij * (w / 2 + 1.0);
        if (klasseOp(lx, lz) === 3) { LANTAARNS.push({ x: r2(lx), z: r2(lz) }); break; }
      }
      zijde = -zijde; s += 30;
    }
    s -= L;
  }
}
tel('lantaarns_regel', LANTAARNS.length);

// ---------------------------------------------------------------- labels, start
const LABELS = labels.filter(l => l.p[0] >= G.x0 && l.p[0] <= G.x1 && l.p[1] >= G.z0 && l.p[1] <= G.z1).map(l => ({ t: l.t, x: l.p[0], z: l.p[1], hoek: l.hoek }));
const HUISNUMMERS = [];
for (const f of bgtPanden) for (const h of f.properties.huisnummers || []) { const p = naarSpel(h.pos); if (p[0] >= G.x0 && p[0] <= G.x1 && p[1] >= G.z0 && p[1] <= G.z1) HUISNUMMERS.push({ t: h.tekst, x: p[0], z: p[1], hoek: h.hoek, pand: String(f.properties.identificatieBAGPND) }); }

// Start: op de Molenkrite bij het kruispunt, zoals in data.js (px 405,1222 = 10,7 m oost, 7,1 m noord), tenzij dat geen rijbaan is
let START = { x: 10.7, z: -7.1, yaw: -0.88 };
if (klasseOp(START.x, START.z) !== 1) {
  let best = null, bd = 1e9;
  for (const k of rijKetens) for (const p of k.pts) { const d = Math.hypot(p.x - START.x, p.z - START.z); if (d < bd) { bd = d; best = p; } }
  if (best) START = { x: best.x, z: best.z, yaw: START.yaw };
}

// ---------------------------------------------------------------- schrijven
const KAART = {
  versie: 1, gemaakt: new Date().toISOString().slice(0, 10),
  oorsprong: { naam: oorsprong.naam, rd: oorsprong.rd, wgs84: oorsprong.wgs84 || null },
  gebied: { x0: r2(G.x0), x1: r2(G.x1), z0: r2(G.z0), z1: r2(G.z1) },
  start: START,
  vlakken: VLAKKEN, wegassen: WEGASSEN, parkeerplekken: PARKEER, panden: PANDEN,
  hagen: HAGEN, bomen: BOMEN, struiken: STRUIKEN, lantaarns: LANTAARNS,
  labels: LABELS, huisnummers: HUISNUMMERS,
  telling,
};
const kop = `// GEGENEREERD door tools/geo/genereer.mjs op ${KAART.gemaakt} — niet met de hand bewerken.
// Bron: BGT en 3D BAG in data/geo/ (zie docs/METHODIEK.md). Meters; oorsprong ${oorsprong.naam}
// op RD ${oorsprong.rd.join(', ')}; +X = oost, +Z = zuid, Y = hoogte boven maaiveld.
`;
writeFileSync(UIT, kop + 'export const KAART = ' + JSON.stringify(KAART) + ';\n');
console.log(`\n${UIT} geschreven (${(readFileSync(UIT).length / 1e6).toFixed(1)} MB)`);
console.log(JSON.stringify(telling, null, 1));
