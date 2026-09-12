// Generator: van de brondata in data/geo/ naar js/kaart.js, de kaart waar het
// spel op draait. Alles in meters, oorsprong op het kruispunt uit
// data/geo/oorsprong.json, +X = oost, +Z = zuid (zie docs/METHODIEK.md §4).
//
//   node tools/geo/genereer.mjs
//
// Wat erin gaat: BGT-vlakken (ondergrond), 3D BAG (panden met echte daken),
// straatnaamlabels en huisnummers. Wat eruit komt staat onderaan in TELLING
// en wordt door tools/geo/controle.mjs en het bovenaanzicht getoetst.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
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
// Omgevingsregels bovenop de BGT: bosgebieden, voortuinen, omheinde terreinen.
const OMGEVING = JSON.parse(readFileSync(join(ROOT, 'data', 'stijl', 'omgeving.json'), 'utf8'));
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
  else if (fn === 'voetpad') voegVlak('voetpad', mat, KERB, f.geometry, { hl: p.relatieveHoogteligging || undefined });
  else if (fn === 'spoorbaan') voegVlak('spoorbaan', 'grind', 0.02, f.geometry);
  else voegVlak('verharding', mat, KERB, f.geometry, { hl: p.relatieveHoogteligging || undefined });
}
for (const f of lees('bgt_ondersteunendwegdeel')) voegVlak('berm', 'gras', KERB, f.geometry);
for (const f of lees('bgt_begroeidterreindeel')) {
  const plus = f.properties.plus_fysiekVoorkomen;
  const k = plus === 'bosplantsoen' ? 'bos' : plus === 'heesters' ? 'heesters' : (plus === 'bodembedekkers' || plus === 'planten') ? 'bodembedekker' : 'gras';
  voegVlak(k, k === 'bos' ? 'bosgrond' : k === 'gras' ? 'gras' : 'bodembedekker', KERB, f.geometry, { sub: plus || f.properties.class });
}
for (const f of lees('bgt_onbegroeidterreindeel')) {
  const p = f.properties, fy = p.bgt_fysiekVoorkomen;
  if (fy === 'erf') voegVlak('erf', 'erf', KERB, f.geometry);
  else if (fy === 'zand') voegVlak('zand', 'zand', 0.06, f.geometry);
  // "kunststof" is de IMGeo-term voor kunstgras: de twee velden van VV Sneek
  // Wit Zwart, de twee hockeyvelden en een paar padelbanen. Die stonden als
  // gesloten verharding in het spel, dus als grijs asfalt — terwijl de brondata
  // zelf zegt dat het een kunstgrasmat is.
  else if (p.plus_fysiekVoorkomen === 'kunststof') voegVlak('kunstgras', 'kunstgras', KERB, f.geometry);
  else if (fy === 'gesloten verharding') voegVlak('asfaltvlak', 'asfalt', KERB, f.geometry);
  else if (fy === 'half verhard') voegVlak('halfverhard', 'grind', 0.08, f.geometry);
  else voegVlak('verharding', verharding(p.plus_fysiekVoorkomen, fy, 'voetpad'), KERB, f.geometry);
}
for (const f of lees('bgt_waterdeel')) voegVlak('water', 'water', -0.35, f.geometry);
for (const f of leesOpt('bgt_ondersteunendwaterdeel')) voegVlak('oever', 'oever', 0.0, f.geometry);
for (const f of leesOpt('bgt_overbruggingsdeel')) voegVlak('brug', f.properties.class === 'pijler' ? 'beton' : 'asfalt', 0.15, f.geometry, { hl: f.properties.relatieveHoogteligging || undefined, sub: f.properties.class || undefined });
for (const f of leesOpt('bgt_kunstwerkdeel')) if (f.geometry.type !== 'LineString') voegVlak('steiger', 'hout', 0.3, f.geometry);
// bezinkbakken en opslagtanks van de RWZI, trafohuisjes: het type gaat mee zodat
// kaartwereld.js er een echte tank of bak van kan maken
for (const f of leesOpt('bgt_overigbouwwerk')) if (f.geometry.type !== 'LineString') voegVlak('bouwwerk', 'beton', 0.5, f.geometry, { sub: f.properties.bgt_type || undefined });

// ---------------------------------------------------------------- panden
/*
 De 3D-dakmodellen komen uit CityJSON. De 3D BAG deelt Nederland op in tegels
 van wisselende grootte, dus dat zijn er meestal meer dan één; alle .city.json
 in data/geo/bron/ die het gebied raken gaan mee. Hoekpuntnummers zijn per
 tegel, dus elk pand onthoudt bij welke tegel het hoort — anders pakt een pand
 uit tegel B de hoekpunten van tegel A en staat er een gebouw ondersteboven in
 de sloot.
*/
const CJ = new Map();          // BAG-id -> { obj, tegel }
const cityBestanden = readdirSync(join(GEO, 'bron')).filter(f => f.endsWith('.city.json')).sort();
const cityGebruikt = [];
for (const naam of cityBestanden) {
  const j = JSON.parse(readFileSync(join(GEO, 'bron', naam), 'utf8'));
  const e = j.metadata?.geographicalExtent;
  // tegels die het gebied niet raken slaan we over: scheelt geheugen en tijd
  if (e && (e[3] < X0 + G.x0 || e[0] > X0 + G.x1 || e[4] < Y0 - G.z1 || e[1] > Y0 - G.z0)) continue;
  const tegel = { VERT: j.vertices, TR: j.transform };
  let n = 0;
  for (const [id, o] of Object.entries(j.CityObjects)) if (!CJ.has(id)) { CJ.set(id, { o, tegel }); n++; }
  cityGebruikt.push(`${naam.replace('.city.json', '')} (${n})`);
}
const rdVertex = (tegel, i) => {
  const v = tegel.VERT[i], T = tegel.TR;
  return [v[0] * T.scale[0] + T.translate[0], v[1] * T.scale[1] + T.translate[1], v[2] * T.scale[2] + T.translate[2]];
};
tel('cityjson_tegels', cityGebruikt.length);

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
  const treffer = CJ.get(p.identificatie);
  if (treffer) {
    const gebouw = treffer.o, tegel = treffer.tegel;
    const idx = new Map(); const v = []; const fl = []; const s = [];
    const hoekpunt = (i) => {
      let k = idx.get(i);
      if (k === undefined) {
        const [X, Y, Z] = rdVertex(tegel, i);
        k = v.length / 3; idx.set(i, k);
        v.push(r2(X - X0), r2(Z - maaiveld), r2(Y0 - Y));
      }
      return k;
    };
    for (const kind of gebouw.children || []) {
      const deel = CJ.get(kind)?.o; if (!deel) continue;
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
  // een pand dat met naam en al in de catalogus staat (de supermarkt, de
  // boerderij) gaat voor op alles wat uit de straat en de meetwaarden volgt
  const vast = (STIJL.panden || {})[p.id];
  if (vast && vast.type) return vast.type;
  const s = STIJL.straten[straat];
  const laag = (p.goot ?? 6) < 4, plat = p.dak === 'horizontal' || p.dak === 'multiple horizontal';
  const opp = Math.abs(oppervlak(p.voet));
  if (opp > 300) return STIJL.standaard.groot;
  if (opp < 35 && !p.nr.length) return 'schuur';           // bijgebouw: kale steen, geen gevel
  const kap = laag && (p.nok ?? 0) > 8;                     // woonruimte in een steile kap
  if (s) {
    if (plat && s.plat) return s.plat;
    if (kap && s.kap) return s.kap;
    if (laag && s.laag) return s.laag;
    // type per huisnummerbereik (tot en met)
    if (s.nummers && p.nr.length) {
      const nr = Math.min(...p.nr.map(n => parseInt(n, 10)).filter(n => !isNaN(n)));
      for (const b of s.nummers) if (nr <= b.tot && (b.van === undefined || nr >= b.van)) return b.type;
    }
    if (s.afwisselend && Number(String(p.id).slice(-1)) % 2 === 1) return s.afwisselend;
    return s.type;
  }
  if (plat && (p.goot ?? 0) > 7) return STIJL.standaard.plat_hoog;
  if (plat) return STIJL.standaard.plat;
  if (kap) return STIJL.standaard.kap;
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
const inBosgebied = (x, z) => (OMGEVING.bosgebieden || []).find(g => x >= g.x0 && x <= g.x1 && z >= g.z0 && z <= g.z1);
for (const v of VLAKKEN) {
  if (v.k === 'bos') { const n0 = BOMEN.length; strooi(v, OMGEVING.bos.afstand, BOMEN, OMGEVING.bos.schaal); for (let i = n0; i < BOMEN.length; i++) if (BOMEN[i].s > 1.7) BOMEN[i].tall = true; }
  if (v.k === 'heesters') strooi(v, 2.2, STRUIKEN, [0.7, 1.2]);
}

for (const f of leesOpt('bgt_vegetatieobject')) for (const ringen of polygonen(f.geometry)) HAGEN.push(ringen[0]);
tel('bomen_bos', BOMEN.length); tel('struiken', STRUIKEN.length); tel('hagen', HAGEN.length);

// Lantaarnpalen staan niet in de BGT van deze gemeente. Plaatsingsregel: om de
// dertig meter langs een rijbaanas, een meter buiten de rijbaan, alleen waar
// dat op stoep, berm of gras uitkomt.
const klasseRaster = raster([], 0.5, gebiedBbox);
const KLASSE = { rijbaan: 1, autoweg: 1, woonerf: 1, parkeervlak: 1, inrit: 1, fietspad: 1, water: 2, oever: 8, voetpad: 7, berm: 3, gras: 3, bodembedekker: 3, heesters: 4, bos: 4, erf: 5, verharding: 7 };
for (const [k, code] of Object.entries(KLASSE)) vulRaster(klasseRaster.g, klasseRaster.W, klasseRaster.H, VLAKKEN.filter(v => v.k === k).map(v => v.r), 0.5, klasseRaster.x0, klasseRaster.z0, code);
for (const p of PANDEN) vulRaster(klasseRaster.g, klasseRaster.W, klasseRaster.H, [[p.voet]], 0.5, klasseRaster.x0, klasseRaster.z0, 6);
const klasseOp = (x, z) => { const i = Math.floor((x - klasseRaster.x0) / 0.5), j = Math.floor((z - klasseRaster.z0) / 0.5); return (i < 0 || j < 0 || i >= klasseRaster.W || j >= klasseRaster.H) ? 0 : klasseRaster.g[j * klasseRaster.W + i]; };

// ---------------------------------------------------------------- terreinmaskers
// Omheinde terreinen uit data/stijl/omgeving.json (de RWZI aan de Buitenroede).
// Het terrein zelf komt uit de BGT: alles wat vanaf het zetelpunt te bereiken is
// zonder water of oever te kruisen en zonder door de poort of een dicht
// hekstuk te gaan. Het masker wordt hier al gemaakt, zodat de bos- en
// parkregels het terrein kunnen overslaan; het hek zelf volgt verderop.
function terreinMasker(t) {
  const cel = 0.5;
  const TW = Math.ceil((t.x1 - t.x0) / cel), TH = Math.ceil((t.z1 - t.z0) / cel);
  const mask = new Uint8Array(TW * TH), versperd = new Uint8Array(TW * TH);
  const celIdx = (x, z) => { const i = Math.floor((x - t.x0) / cel), j = Math.floor((z - t.z0) / cel); return (i < 0 || j < 0 || i >= TW || j >= TH) ? -1 : j * TW + i; };
  // de poort en de dichte hekstukken (dammen zonder poort) als versperring,
  // zodat de vulling niet over een dam wegloopt
  const pa = t.poort.a, pb = t.poort.b;
  const versperringen = [[pa, pb, t.poort.dikte || 2.5], ...(t.versperringen || []).map(v => [v.a, v.b, v.dikte || 2.5])];
  for (const [a, b, dikte] of versperringen) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
    for (let s = -1.5; s <= L + 1.5; s += cel / 2) for (let d = -dikte / 2; d <= dikte / 2; d += cel / 2) { const k = celIdx(a[0] + ux * s - uz * d, a[1] + uz * s + ux * d); if (k >= 0) versperd[k] = 1; }
  }
  const zetel = celIdx(t.zetel[0], t.zetel[1]);
  const stapel = [zetel]; mask[zetel] = 1; let cellen = 0;
  const ouder = process.env.TERREIN_DEBUG ? new Int32Array(TW * TH).fill(-1) : null;
  while (stapel.length) {
    const k = stapel.pop(); cellen++;
    const i = k % TW, j = (k - i) / TW;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= TW || jj >= TH) continue;
      const kk = jj * TW + ii; if (mask[kk] || versperd[kk]) continue;
      const kl = klasseOp(t.x0 + (ii + 0.5) * cel, t.z0 + (jj + 0.5) * cel);
      if (kl === 2 || kl === 8) continue;
      mask[kk] = 1; if (ouder) ouder[kk] = k; stapel.push(kk);
    }
  }
  const opTerrein = (x, z) => { const k = celIdx(x, z); return k >= 0 && mask[k] === 1; };
  const oppTerrein = cellen * cel * cel;
  telling[`terrein_${t.kort}_m2`] = Math.round(oppTerrein);
  if (oppTerrein > (t.maxOpp || 80000)) console.warn(`LET OP: terrein ${t.naam} is ${Math.round(oppTerrein)} m² — de vulling is waarschijnlijk weggelopen (sloot niet dicht?)`);
  // raakt het masker de rand van het zoekvak, dan is de vulling weggelopen
  const randcellen = [];
  for (let i = 0; i < TW; i++) for (const j of [0, TH - 1]) if (mask[j * TW + i]) randcellen.push([t.x0 + i * cel, t.z0 + j * cel]);
  for (let j = 0; j < TH; j++) for (const i of [0, TW - 1]) if (mask[j * TW + i]) randcellen.push([t.x0 + i * cel, t.z0 + j * cel]);
  if (randcellen.length) console.warn(`LET OP: terrein ${t.naam} raakt de rand van het zoekvak op ${randcellen.length} plekken, bv. ${randcellen.slice(0, 3).map(p => p.join(',')).join(' ')}`);
  if (ouder && randcellen.length) {
    // het lek opsporen: de vulweg van de randcel terug naar de zetel, met de klasse onderweg
    let k = celIdx(randcellen[0][0], randcellen[0][1]); const weg = [];
    while (k >= 0 && k !== zetel) { const i = k % TW, j = (k - i) / TW; weg.push([t.x0 + (i + 0.5) * cel, t.z0 + (j + 0.5) * cel]); k = ouder[k]; }
    weg.reverse();
    console.log('vulweg zetel -> rand (elke 8 m, klasse):', weg.filter((p, i) => i % 16 === 0).map(p => `${p[0].toFixed(0)},${p[1].toFixed(0)}:${klasseOp(p[0], p[1])}`).join(' '));
  }
  if (process.env.TERREIN_DEBUG) {
    // grove kaart van het masker: # terrein, ~ water/oever, = versperring, . overig
    const stap = Number(process.env.TERREIN_DEBUG) || 4;
    for (let z = t.z0; z < t.z1; z += stap) {
      let s = String(Math.round(z)).padStart(5) + ' ';
      for (let x = t.x0; x < t.x1; x += stap) { const k = celIdx(x, z), kl = klasseOp(x, z); s += k >= 0 && mask[k] ? '#' : k >= 0 && versperd[k] ? '=' : (kl === 2 || kl === 8) ? '~' : kl === 0 ? ' ' : '.'; }
      console.log(s);
    }
  }
  // ook de versperde cellen (de poort en de dichte hekstukken) horen bij het terrein
  const opTerreinOfHek = (x, z) => { const k = celIdx(x, z); return k >= 0 && (mask[k] === 1 || versperd[k] === 1); };
  return { t, opTerrein, opTerreinOfHek, versperringen, pa, pb };
}
const TERREINEN = (OMGEVING.terreinen || []).map(terreinMasker);
const opEenTerrein = (x, z) => TERREINEN.some(m => m.opTerreinOfHek(x, z));

// ---------------------------------------------------------------- voorkant en dakkapellen
// De voorkant van een woning loopt langs een as van de omsluitende rechthoek,
// nooit door een bouwmuur naar een buurpand, en wijst naar de kant waar de
// rijbaan het dichtst bij ligt, gewogen met de richting naar de straat van het
// huisnummer. Een hoekwoning krijgt zo geen voorgevel op de kopse kant en een
// woning aan een voetpad geen kale voorkant. De huisnummerlabels van de BGT
// liggen bijna altijd midden in het pand en zeggen dus niets over de voorkant.
const pandIndex = new Map();
const sleutel10 = (x, z) => `${Math.floor(x / 10)}:${Math.floor(z / 10)}`;
for (const p of PANDEN) { const b = bboxRing(p.voet); for (let x = b[0]; x <= b[2] + 10; x += 10) for (let z = b[1]; z <= b[3] + 10; z += 10) { const k = sleutel10(x, z); if (!pandIndex.has(k)) pandIndex.set(k, []); pandIndex.get(k).push(p); } }
const pandOp = (x, z, nietDit) => (pandIndex.get(sleutel10(x, z)) || []).find(q => q !== nietDit && inRing([x, z], q.voet)) || null;
let voorkantGedraaid = 0;
for (const p of PANDEN) {
  if (!p.rect || !p.nr.length || p.type === 'schuur') continue;
  const r = p.rect, c = [r.cx, r.cz];
  const u = [Math.cos(r.hoek), Math.sin(r.hoek)], v = [-u[1], u[0]];
  const kand = [{ as: 'u', d: u, h: r.hx, b: r.hz }, { as: 'u', d: [-u[0], -u[1]], h: r.hx, b: r.hz }, { as: 'v', d: v, h: r.hz, b: r.hx }, { as: 'v', d: [-v[0], -v[1]], h: r.hz, b: r.hx }];
  p.buren = [];
  for (const k of kand) {
    // een buurpand tegen deze zijde (op drie plekken langs de zijde gemeten)
    const z = k.as === 'u' ? v : u;
    for (const t of [-0.6, 0, 0.6]) {
      const q = pandOp(c[0] + k.d[0] * (k.h + 0.5) + z[0] * t * k.b, c[1] + k.d[1] * (k.h + 0.5) + z[1] * t * k.b, p);
      if (q) { k.buur = q; if (q.nr.length && !p.buren.includes(q)) p.buren.push(q); }
    }
  }
  const langsU = kand[0].buur || kand[1].buur, langsV = kand[2].buur || kand[3].buur;
  let opties = kand.filter(k => !k.buur);
  if (langsU && !langsV) opties = opties.filter(k => k.as === 'v');
  else if (langsV && !langsU) opties = opties.filter(k => k.as === 'u');
  if (!opties.length) continue;
  // afstand tot de rijbaan in deze richting; een gebouw ervoor telt als ver weg
  const weg = (k) => { for (let s = 1; s <= 35; s += 0.5) { const kl = klasseOp(c[0] + k.d[0] * (k.h + s), c[1] + k.d[1] * (k.h + s)); if (kl === 1) return s; if (kl === 6 && s > 3) return 60; } return 99; };
  let best = null;
  for (const k of opties) { const score = -weg(k) + 4 * (p.front ? k.d[0] * p.front[0] + k.d[1] * p.front[1] : 0); if (!best || score > best.score) best = { k, score }; }
  const nieuw = [r2(best.k.d[0]), r2(best.k.d[1])];
  if (!p.front || nieuw[0] * p.front[0] + nieuw[1] * p.front[1] < 0.9) voorkantGedraaid++;
  p.front = nieuw;
}
tel('voorkant_gedraaid', voorkantGedraaid);

// Voorkant met de hand aangewezen (data/stijl/straten.json, `voorkantNaar`): bij
// een winkel ligt de ingang aan het plein en niet aan de dichtstbijzijnde
// rijbaan. De zijde van de omsluitende rechthoek die het meest naar het
// opgegeven punt wijst wordt de voorkant.
for (const p of PANDEN) {
  const vast = (STIJL.panden || {})[p.id];
  if (!vast || !vast.voorkantNaar || !p.rect) continue;
  const r = p.rect, u = [Math.cos(r.hoek), Math.sin(r.hoek)], v = [-u[1], u[0]];
  let dx = vast.voorkantNaar[0] - r.cx, dz = vast.voorkantNaar[1] - r.cz;
  const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
  let best = null;
  for (const d of [u, [-u[0], -u[1]], v, [-v[0], -v[1]]]) {
    const s = d[0] * dx + d[1] * dz;
    if (!best || s > best.s) best = { s, d };
  }
  p.front = [r2(best.d[0]), r2(best.d[1])];
}

// Dakkapellen: het 3D BAG-model heeft ze bij een deel van de woningen; in een
// rij waar één woning er een heeft, hebben ze in werkelijkheid allemaal een
// (foto Molenkrite). De woningen zonder dakkapel in het model krijgen `kapel`,
// waarop kaartwereld.js er een bouwt.
for (const p of PANDEN) {
  if (!p.v || !p.goot) continue;
  const V = p.v;
  p.f.forEach((ringen, fi) => {
    if (p.s[fi] !== 1 || p.dakkapel) return;
    // een muurvlak boven de goot, minstens 1,2 m breed (geen trapje tussen twee
    // daken), aan de voorkant van het pand (een dakkapel achter telt niet)
    let lo = Infinity, hi = -Infinity; const xs = [], zs = [];
    for (const i of ringen[0]) { lo = Math.min(lo, V[i * 3 + 1]); hi = Math.max(hi, V[i * 3 + 1]); xs.push(V[i * 3]); zs.push(V[i * 3 + 2]); }
    const breed = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
    const mx = xs.reduce((s, v) => s + v, 0) / xs.length, mz = zs.reduce((s, v) => s + v, 0) / zs.length;
    const voor = !p.front || !p.rect || (mx - p.rect.cx) * p.front[0] + (mz - p.rect.cz) * p.front[1] > 0.3;
    if (voor && lo > p.goot - 0.35 && hi < (p.nok || 99) - 0.6 && hi - lo > 0.8 && breed >= 1.2) p.dakkapel = true;
  });
}
const rijGezien = new Set(); let kapels = 0;
for (const p of PANDEN) {
  if (rijGezien.has(p) || !p.buren) continue;
  const rij = [p]; rijGezien.add(p);
  for (let i = 0; i < rij.length; i++) for (const q of rij[i].buren || []) if (!rijGezien.has(q) && q.buren) { rijGezien.add(q); rij.push(q); }
  if (!rij.some(q => q.dakkapel)) continue;
  for (const q of rij) if (!q.dakkapel && q.dak === 'slanted' && (q.nok || 0) - (q.goot || 0) > 2.5 && q.v) { q.kapel = true; kapels++; }
}
tel('dakkapellen_3d', PANDEN.filter(p => p.dakkapel).length); tel('dakkapellen_aangevuld', kapels);
for (const p of PANDEN) delete p.buren;

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
        const kl = klasseOp(lx, lz); if (kl === 3 || kl === 7) { LANTAARNS.push({ x: r2(lx), z: r2(lz) }); break; }
      }
      zijde = -zijde; s += 30;
    }
    s -= L;
  }
}
tel('lantaarns_regel', LANTAARNS.length);

// ---------------------------------------------------------------- omgeving
// Bosgebieden: hier is ook het gras en de oever bos. Dicht, hoog, met ondergroei;
// water, paden en bestaande bomen blijven vrij.
const BOSGEBIED_BOMEN = [];
for (const g of OMGEVING.bosgebieden || []) {
  const rb = rng(g.x0 * 7 + g.z0);
  for (let z = g.z0; z < g.z1; z += g.afstand) for (let x = g.x0; x < g.x1; x += g.afstand) {
    const px = x + (rb() - 0.5) * g.afstand * 0.8, pz = z + (rb() - 0.5) * g.afstand * 0.8;
    const kl = klasseOp(px, pz);
    if (![3, 4, 8].includes(kl)) continue;
    if (opEenTerrein(px, pz)) continue;                 // niet op de RWZI: daar staan alleen bomen langs het hek
    if (BOMEN.some(b => Math.hypot(b.x - px, b.z - pz) < 2.2)) continue;
    const sch = g.schaal[0] + rb() * (g.schaal[1] - g.schaal[0]);
    BOSGEBIED_BOMEN.push({ x: r2(px), z: r2(pz), s: r2(sch), tall: sch > 1.75 });
    if (rb() < 0.6) STRUIKEN.push({ x: r2(px + (rb() - 0.5) * 2.5), z: r2(pz + (rb() - 0.5) * 2.5), s: r2(0.6 + rb() * 0.7) });
  }
}
BOMEN.push(...BOSGEBIED_BOMEN);
tel('bosgebied_bomen', BOSGEBIED_BOMEN.length);

// Wat de foto's van de steekproef laten zien en de BGT niet levert, komt uit
// plaatsingsregels op de BGT-vlakken: straatbomen in de grasbermen, losse grote
// bomen in de parkjes, hagen en schuttingen per perceel met een tegelpad naar
// de voordeur, belijning op de parkeervakken, doelen op het speelveld.
const ro = rng(23);
const vrijRond = (x, z, straal, toegestaan) => {
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; if (!toegestaan.includes(klasseOp(x + Math.cos(a) * straal, z + Math.sin(a) * straal))) return false; }
  return toegestaan.includes(klasseOp(x, z));
};

// Straatbomen: om de 11 à 15 m langs een rijbaanas, twee tot vier meter buiten
// de rijbaan, alleen in gras of berm (niet op de stoep) en vrij van gebouwen.
const STRAATBOMEN = [];
for (const k of rijKetens) {
  if (k.w > 9 || k.lengte < 25 || k.naam === 'N7') continue;
  let s = 6 + ro() * 6;
  for (let i = 1; i < k.pts.length; i++) {
    const a = k.pts[i - 1], b = k.pts[i];
    const L = Math.hypot(b.x - a.x, b.z - a.z); if (L < 1e-3) continue;
    const ux = (b.x - a.x) / L, uz = (b.z - a.z) / L;
    while (s <= L) {
      const t = s / L, x = a.x + ux * s, z = a.z + uz * s, w = a.w + (b.w - a.w) * t;
      buiten: for (const zij of [1, -1]) for (const off of [w / 2 + 2.2, w / 2 + 3.6]) {
        const tx = x + (-uz) * zij * off, tz = z + ux * zij * off;
        if (vrijRond(tx, tz, 1.6, [3]) && ro() < 0.8) { STRAATBOMEN.push({ x: r2(tx), z: r2(tz), s: r2(1.5 + ro() * 0.5), tall: true }); break buiten; }
      }
      s += 11 + ro() * 4;
    }
    s -= L;
  }
}
// Parkbomen: losse grote bomen in de grote gazons van de groenvoorziening.
const PARKBOMEN = [];
for (const v of VLAKKEN) {
  if (v.k !== 'gras' || v.sub !== 'gras- en kruidachtigen') continue;
  if (Math.abs(oppervlak(v.r[0])) < 600) continue;
  const b = bboxRing(v.r[0]);
  for (let z = b[1] + 8; z < b[3]; z += 15) for (let x = b[0] + 8; x < b[2]; x += 15) {
    const px = x + (ro() - 0.5) * 9, pz = z + (ro() - 0.5) * 9;
    if (ro() < 0.45 || opEenTerrein(px, pz)) continue;
    if (inPolygoon([px, pz], v.r) && vrijRond(px, pz, 2.5, [3])) PARKBOMEN.push({ x: r2(px), z: r2(pz), s: r2(1.6 + ro() * 0.5), tall: true });
  }
}
// Ondergroei aan de rand van de bosjes
for (const v of VLAKKEN) if (v.k === 'bos') strooi(v, OMGEVING.bos.struiken, STRUIKEN, [0.6, 1.1]);
tel('straatbomen', STRAATBOMEN.length); tel('parkbomen', PARKBOMEN.length);

// Percelen: per woning een lage haag aan de straatkant met een opening bij de
// voordeur, een tegelpad naar de deur, lage hagen tussen de voortuinen en
// schuttingen van 1,8 m tussen en achter de achtertuinen. De maten volgen uit
// het erf-vlak van de BGT (hoe ver loopt de tuin door).
const HEGGEN = [], SCHUTTINGEN = [], PADEN = [], TUINVLAKKEN = [];
/*
 Vakken waar een achtertuin geen schutting van 1,8 m krijgt maar een lage haag
 of een hekje (data/stijl/omgeving.json → `lageErfscheidingen`). Nodig waar een
 rij met de achterkant naar een straat staat en er in het echt geen schutting
 langs de stoep staat; zonder die uitzondering staat er een houten muur van
 achttien meter tegenover de voordeur van de buren.
*/
const LAGE_ERF = OMGEVING.lageErfscheidingen || [];
const lagErf = (x, z) => LAGE_ERF.some(v => x >= v.x0 && x <= v.x1 && z >= v.z0 && z <= v.z1);
const TUINKANS = OMGEVING.voortuinen;
const tuinVariant = (id) => {
  let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  let n = h % 100;
  for (const [naam, kans] of Object.entries(TUINKANS)) { if (naam.startsWith('_')) continue; if (n < kans) return { naam, hash: h }; n -= kans; }
  return { naam: 'haag', hash: h };
};
const tuinTelling = {};
const lijnSleutel = (a, b) => { const k1 = `${Math.round(a[0] * 2)}:${Math.round(a[1] * 2)}`, k2 = `${Math.round(b[0] * 2)}:${Math.round(b[1] * 2)}`; return k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1; };
const gezienLijn = new Set();
const voegLijn = (lijst, a, b, h, soort) => { const k = lijnSleutel(a, b); if (gezienLijn.has(k)) return; gezienLijn.add(k); lijst.push({ a: [r2(a[0]), r2(a[1])], b: [r2(b[0]), r2(b[1])], h, ...(soort && soort !== 'haag' ? { soort } : {}) }); };
// hoe ver kun je vanaf p in richting d door erf lopen (max m)?
const erfDiepte = (p, d, max) => { let s = 0.3; while (s < max && klasseOp(p[0] + d[0] * s, p[1] + d[1] * s) === 5) s += 0.25; return s - 0.3; };
for (const p of PANDEN) {
  if (!p.front || p.type === 'schuur' || !p.nr.length) continue;
  const f = p.front, r = [-f[1], f[0]];       // r: langs de gevel
  const ring = p.voet;
  // randen indelen naar richting
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 1.5) continue;
    // buitennormaal: ring is in xz met de klok mee of tegen; kies de kant weg van het zwaartepunt
    const [cx, cz] = zwaartepunt(ring);
    let nx = dz / L, nz = -dx / L;
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    if ((mx - cx) * nx + (mz - cz) * nz < 0) { nx = -nx; nz = -nz; }
    const kant = nx * f[0] + nz * f[1];
    if (kant > 0.7) {
      // voorgevel: voortuin tot aan de stoep
      const d = erfDiepte([mx, mz], [nx, nz], 15);
      if (d < 1.2) continue;
      const hx = mx + nx * (d - 0.35), hz = mz + nz * (d - 0.35);
      // opening bij de voordeur: op de plek van het huisnummerlabel, anders op een meter van de kant
      let tDeur = 0.2;
      if (p.nrpos) { const t = ((p.nrpos[0] - a[0]) * dx + (p.nrpos[1] - a[1]) * dz) / (L * L); if (t > 0.05 && t < 0.95) tDeur = t; }
      const ex = dx / L, ez = dz / L;
      const deur = [hx + ex * (tDeur * L - L / 2), hz + ez * (tDeur * L - L / 2)];
      const A = [hx - ex * L / 2, hz - ez * L / 2], B = [hx + ex * L / 2, hz + ez * L / 2];
      const g0 = [deur[0] - ex * 0.65, deur[1] - ez * 0.65], g1 = [deur[0] + ex * 0.65, deur[1] + ez * 0.65];
      // elke voortuin anders: heg, hekje, open, grind of tegels (data/stijl/omgeving.json)
      const tv = tuinVariant(p.id); const th = tv.hash;
      tuinTelling[tv.naam] = (tuinTelling[tv.naam] || 0) + 1;
      const rand = (k) => ((th >> k) & 255) / 255;
      const hoogte = tv.naam === 'grind' ? 0.45 : 0.55 + rand(3) * 0.4;
      const soort = tv.naam === 'hekje' ? 'hekje' : 'haag';
      if (tv.naam !== 'open' && tv.naam !== 'tegels') {
        if (Math.hypot(g0[0] - A[0], g0[1] - A[1]) > 0.8) voegLijn(HEGGEN, A, g0, soort === 'hekje' ? 0.5 : hoogte, soort);
        if (Math.hypot(B[0] - g1[0], B[1] - g1[1]) > 0.8) voegLijn(HEGGEN, g1, B, soort === 'hekje' ? 0.5 : hoogte, soort);
      }
      // tuinvlak: grind of tegels over de hele voortuin (het pad blijft zichtbaar)
      if (tv.naam === 'grind' || tv.naam === 'tegels') {
        const v0 = [mx - ex * L / 2 + nx * 0.3, mz - ez * L / 2 + nz * 0.3], v1 = [mx + ex * L / 2 + nx * 0.3, mz + ez * L / 2 + nz * 0.3];
        TUINVLAKKEN.push({ m: tv.naam === 'grind' ? 'grind' : 'tegels', r: [v0, v1, [B[0] - nx * 0.15, B[1] - nz * 0.15], [A[0] - nx * 0.15, A[1] - nz * 0.15]].map(q => [r2(q[0]), r2(q[1])]) });
      }
      // beplanting: struiken, en bij grind of open een sierboompje
      const nStruik = tv.naam === 'tegels' ? 1 : tv.naam === 'open' ? 2 + (th % 2) : 1 + (th % 2);
      for (let i = 0; i < nStruik; i++) {
        const t = 0.15 + rand(4 + i) * 0.7, diep = 0.9 + rand(9 + i) * Math.max(0.3, d - 1.8);
        const sx = mx + ex * (t * L - L / 2) + nx * diep, sz = mz + ez * (t * L - L / 2) + nz * diep;
        if (Math.abs((t - tDeur) * L) < 1.0) continue;               // niet op het pad
        STRUIKEN.push({ x: r2(sx), z: r2(sz), s: r2(0.45 + rand(12 + i) * 0.5) });
      }
      if ((tv.naam === 'grind' || tv.naam === 'open') && d > 3.5) {
        const t = tDeur > 0.5 ? 0.22 : 0.78;
        BOMEN.push({ x: r2(mx + ex * (t * L - L / 2) + nx * (d * 0.55)), z: r2(mz + ez * (t * L - L / 2) + nz * (d * 0.55)), s: r2(0.45 + rand(7) * 0.3) });
      }
      // tegelpad van de deur naar de stoep, 1,2 m breed
      const q0 = [deur[0] - nx * (d - 0.3), deur[1] - nz * (d - 0.3)];
      PADEN.push([[q0[0] - ex * 0.6, q0[1] - ez * 0.6], [q0[0] + ex * 0.6, q0[1] + ez * 0.6], [deur[0] + ex * 0.6 + nx * 0.4, deur[1] + ez * 0.6 + nz * 0.4], [deur[0] - ex * 0.6 + nx * 0.4, deur[1] - ez * 0.6 + nz * 0.4]].map(q => [r2(q[0]), r2(q[1])]));
    } else if (kant < -0.7) {
      // achtergevel: schutting achter de achtertuin
      const d = erfDiepte([mx, mz], [nx, nz], 14);
      if (d < 2) continue;
      const ex = dx / L, ez = dz / L;
      const hx = mx + nx * (d - 0.25), hz = mz + nz * (d - 0.25);
      const A2 = [hx - ex * L / 2, hz - ez * L / 2], B2 = [hx + ex * L / 2, hz + ez * L / 2];
      if (lagErf(hx, hz)) voegLijn(HEGGEN, A2, B2, 0.6 + ((tuinVariant(p.id).hash >> 7) & 3) * 0.12, 'haag');
      else voegLijn(SCHUTTINGEN, A2, B2, 1.8);
    } else if (Math.abs(kant) < 0.35 && L > 4) {
      // zijgevel (bouwmuur): schutting naar achteren, lage haag naar voren, in het verlengde van de muur
      for (const [punt, richting] of [[a, [a[0] - b[0], a[1] - b[1]]], [b, [b[0] - a[0], b[1] - a[1]]]]) {
        const Lr = Math.hypot(richting[0], richting[1]) || 1; const dr = [richting[0] / Lr, richting[1] / Lr];
        const naarVoren = dr[0] * f[0] + dr[1] * f[1] > 0;
        const d = erfDiepte(punt, dr, naarVoren ? 15 : 14);
        if (d < 1.5) continue;
        const eind = [punt[0] + dr[0] * (d - 0.3), punt[1] + dr[1] * (d - 0.3)];
        const start = [punt[0] + dr[0] * 0.3, punt[1] + dr[1] * 0.3];
        if (naarVoren) voegLijn(HEGGEN, start, eind, 0.45 + ((tuinVariant(p.id).hash >> 5) & 3) * 0.15);
        else if (lagErf(eind[0], eind[1])) voegLijn(HEGGEN, start, eind, 0.6 + ((tuinVariant(p.id).hash >> 7) & 3) * 0.12, 'haag');
        else voegLijn(SCHUTTINGEN, start, eind, 1.8);
      }
    }
  }
}
tel('heggen', HEGGEN.length); tel('schuttingen', SCHUTTINGEN.length); tel('tegelpaden', PADEN.length); tel('tuinvlakken', TUINVLAKKEN.length); telling.voortuinen = tuinTelling;

// Belijning op de parkeervakken: witte strepen tussen de vakken.
const STREPEN = [];
for (const v of VLAKKEN.filter(v => v.k === 'parkeervlak')) {
  const rect = kleinsteRechthoek(v.r[0]);
  if (!rect || rect.L < 4.5) continue;
  const u = [Math.cos(rect.hoek), Math.sin(rect.hoek)], n = [-u[1], u[0]];
  const langs = rect.B < 3.6;
  const stap = langs ? 5.8 : 2.5, diep = langs ? Math.min(rect.B, 2.2) : Math.min(rect.B, 5.0);
  const aantal = Math.floor(rect.L / stap);
  for (let i = 0; i <= aantal; i++) {
    const t = i * stap - (aantal * stap) / 2;
    const cx = rect.cx + u[0] * t, cz = rect.cz + u[1] * t;
    const a = [cx - n[0] * diep / 2, cz - n[1] * diep / 2], b = [cx + n[0] * diep / 2, cz + n[1] * diep / 2];
    if (inPolygoon(a, v.r) && inPolygoon(b, v.r)) STREPEN.push({ a: [r2(a[0]), r2(a[1])], b: [r2(b[0]), r2(b[1])] });
  }
}
tel('parkeerstrepen', STREPEN.length);

// Speelveld en banken: doelen op het grote gazon bij de Wieken, bankjes langs
// de paden bij de vijvers (foto's: Bosje bij de Wieken, Parkje de Wieken).
const OBJECTEN = [];
const grasVelden = VLAKKEN.filter(v => v.k === 'gras' && Math.abs(oppervlak(v.r[0])) > 1500).map(v => ({ v, c: zwaartepunt(v.r[0]), opp: Math.abs(oppervlak(v.r[0])) }));
const veld = grasVelden.filter(g => g.c[0] > -260 && g.c[0] < 300 && g.c[1] > -240 && g.c[1] < 150).sort((a, b) => b.opp - a.opp)[0];
if (veld) {
  const rect = kleinsteRechthoek(veld.v.r[0]);
  const u = [Math.cos(rect.hoek), Math.sin(rect.hoek)];
  const afst = Math.min(22, rect.L / 2 - 6);
  for (const sgn of [1, -1]) {
    const x = rect.cx + u[0] * afst * sgn, z = rect.cz + u[1] * afst * sgn;
    if (inPolygoon([x, z], veld.v.r)) OBJECTEN.push({ type: 'voetbaldoel', x: r2(x), z: r2(z), yaw: Math.round((Math.atan2(-u[0] * sgn, -u[1] * sgn) * 180 / Math.PI) * 10) / 10 });
  }
}
for (const w of VLAKKEN.filter(v => v.k === 'water' && Math.abs(oppervlak(v.r[0])) > 1500)) {
  const c = zwaartepunt(w.r[0]);
  if (c[0] < -260 || c[0] > 300 || c[1] < -240 || c[1] > 200) continue;
  // dichtstbijzijnde padpunt op minstens 4 m van het water
  let best = null;
  for (const k of loopKetens) for (const q of k.pts) { const d = Math.hypot(q.x - c[0], q.z - c[1]); if (d > 6 && d < 60 && (!best || d < best.d)) best = { d, q, k }; }
  if (!best) continue;
  // bank 1,5 m naast het pad, met de rug naar het pad gericht op het water
  const dx = c[0] - best.q.x, dz = c[1] - best.q.z, L = Math.hypot(dx, dz) || 1;
  const bx = best.q.x + dx / L * 2.0, bz = best.q.z + dz / L * 2.0;
  if (klasseOp(bx, bz) === 3) OBJECTEN.push({ type: 'bank', x: r2(bx), z: r2(bz), yaw: Math.round(Math.atan2(-dx, -dz) * 180 / Math.PI * 10) / 10 + 180 });
}
// Plantsoenen met een eigen karakter (data/stijl/omgeving.json): dicht
// struikgewas over het hele groenvak, een bankje aan de kant van het voetpad,
// en de bomen zonder botsing zodat je erdoorheen kunt lopen (foto 9 Molenkrite).
for (const pl of OMGEVING.plantsoenen || []) {
  const vlak = VLAKKEN.find(v => ['bos', 'gras', 'heesters', 'bodembedekker'].includes(v.k) && inPolygoon(pl.punt, v.r));
  if (!vlak) { console.warn(`LET OP: plantsoen ${pl.naam}: geen groenvak op ${pl.punt}`); continue; }
  const n0 = STRUIKEN.length;
  strooi(vlak, pl.struiken || 1.5, STRUIKEN, pl.schaal || [0.8, 1.5]);
  if (pl.doorloopbaar) for (const b of BOMEN) if (inPolygoon([b.x, b.z], vlak.r)) b.vrij = true;
  if (pl.bank) {
    // de rand met het dichtstbijzijnde voetpad ervoor (over gras, niet over
    // water, tot 14 m); het bankje staat 0,9 m voor het pad met het gezicht
    // naar het pad, en de strook gras tussen het groenvak en het bankje groeit
    // vol struiken, zoals op de foto (in de BGT stopt het bosvak eerder)
    const ring = vlak.r[0], [cx, cz] = zwaartepunt(ring);
    let best = null;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length]; const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 3) continue;
      let nx = dz / L, nz = -dx / L; const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      if ((mx - cx) * nx + (mz - cz) * nz < 0) { nx = -nx; nz = -nz; }
      let pad = 0; for (let d = 0.7; d <= 14; d += 0.5) { const kl = klasseOp(mx + nx * d, mz + nz * d); if (kl === 2 || kl === 8) break; if (kl === 7) { pad = d; break; } }
      if (!pad) continue;
      if (!best || pad < best.pad - 0.5 || (Math.abs(pad - best.pad) <= 0.5 && L > best.L)) best = { L, pad, mx, mz, nx, nz, ex: dx / L, ez: dz / L };
    }
    if (best) {
      const { mx, mz, nx, nz, ex, ez, pad, L } = best;
      const bx = mx + nx * (pad - 0.9), bz = mz + nz * (pad - 0.9);
      OBJECTEN.push({ type: 'bank', x: r2(bx), z: r2(bz), yaw: Math.round((Math.atan2(-nx, -nz) * 180 / Math.PI + 180) * 10) / 10 });
      const rs = rng(53);
      for (let s = 0.9; s < pad - 1.6; s += 1.3) for (let t = -L / 2 + 0.6; t <= L / 2 - 0.6; t += 1.3) {
        const sx = mx + nx * s + ex * t + (rs() - 0.5) * 0.8, sz = mz + nz * s + ez * t + (rs() - 0.5) * 0.8;
        if (klasseOp(sx, sz) === 3 && Math.hypot(sx - bx, sz - bz) > 1.5) STRUIKEN.push({ x: r2(sx), z: r2(sz), s: r2(0.8 + rs() * 0.7) });
      }
    } else console.warn(`LET OP: plantsoen ${pl.naam}: geen rand aan een voetpad gevonden voor het bankje`);
  }
  telling[`plantsoen_${pl.naam.replace(/\W+/g, '_')}_struiken`] = STRUIKEN.length - n0;
}
/*
 Objecten die bij een pand horen (data/stijl/straten.json, `objecten`): de gele
 vlaggenmasten voor de ingang van de supermarkt. Ze worden vanaf het midden van
 de voorgevel uitgezet — `voor` meter naar de straat, `langs` meter langs de
 gevel naar rechts gezien van buiten — en kijken met de gevel mee. Zo staan ze
 nog steeds goed als het grondvlak in de brondata verschuift.
*/
for (const p of PANDEN) {
  const vast = (STIJL.panden || {})[p.id];
  if (!vast || (!vast.objecten && !vast.hekken) || !p.rect || !p.front) continue;
  const r = p.rect, u = [Math.cos(r.hoek), Math.sin(r.hoek)];
  const diep = Math.abs(p.front[0] * u[0] + p.front[1] * u[1]) > 0.7 ? r.hx : r.hz;
  const gx = r.cx + p.front[0] * diep, gz = r.cz + p.front[1] * diep;
  const langs = [p.front[1], -p.front[0]];
  const yaw = Math.round(Math.atan2(-p.front[0], -p.front[1]) * 180 / Math.PI * 10) / 10;
  for (const o of vast.objecten || []) {
    /*
     Meestal vanaf het midden van de voorgevel (`voor`/`langs`). Bij een gebogen
     pand loopt die maat weg: het schoolplein van De Wynpôlle ligt achter de
     bocht, en dan kom je uit op `voor: -60`, wat niemand meer kan nalezen. Zo'n
     object mag daarom ook zijn eigen plek in spelmeters krijgen (`x`/`z`), net
     als `voorkantNaar`. tools/schooltest.mjs controleert dat ze buiten de
     grondvlakken en op verharding of gras staan.
    */
    const eigen = o.x !== undefined && o.z !== undefined;
    const x = eigen ? o.x : gx + p.front[0] * (o.voor || 0) + langs[0] * (o.langs || 0);
    const z = eigen ? o.z : gz + p.front[1] * (o.voor || 0) + langs[1] * (o.langs || 0);
    OBJECTEN.push({ type: o.type, x: r2(x), z: r2(z), yaw: o.yaw !== undefined ? o.yaw : yaw });
  }
  /*
   Een hek van A naar B: het wordt in stukken van `stap` meter neergezet, met de
   kop in de richting van de lijn. De props in js/props.js zijn drie meter breed,
   dus `stap` is standaard 3.
  */
  for (const h of vast.hekken || []) {
    const stap = h.stap || 3;
    const dx = h.b[0] - h.a[0], dz = h.b[1] - h.a[1];
    const L = Math.hypot(dx, dz);
    const n = Math.max(1, Math.round(L / stap));
    /*
     De prop is drie meter breed langs zijn eigen x-as. Een draai `yaw` om y zet
     die as op (cos yaw, −sin yaw), dus voor een lijn (dx, dz) hoort
     yaw = atan2(−dz, dx) — in graden, want zo staan alle objecten in de kaart.
    */
    const hoek = Math.round(Math.atan2(-dz / L, dx / L) * 180 / Math.PI * 10) / 10;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      OBJECTEN.push({ type: h.type || 'spijlenhek', x: r2(h.a[0] + dx * t), z: r2(h.a[1] + dz * t), yaw: hoek });
    }
  }
}
tel('objecten', OBJECTEN.length);

// ---------------------------------------------------------------- terreinen
// Het hek volgt de landkant van de oeverrand (het masker komt van hierboven),
// iets het gras op; de poort staat op de dam waar het erf de sloot kruist. De
// gebouwen op het terrein krijgen het bedrijfstype uit de regel, met bomen
// langs het hek en lantaarns langs het erf.
const HEKWERKEN = [], POORTEN = [];
for (const M of TERREINEN) {
  const { t, opTerrein, versperringen, pa, pb } = M;
  // hek: randen van de oeverringen waarvan de landkant op het terrein ligt
  const hek = t.hekwerk || { hoogte: 2.0, afstand: 0.7 };
  const kettingen = [];
  for (const v of VLAKKEN) {
    if (v.k !== 'oever') continue;
    const bb = bboxRing(v.r[0]); if (bb[2] < t.x0 || bb[0] > t.x1 || bb[3] < t.z0 || bb[1] > t.z1) continue;
    const ring = v.r[0], n = ring.length;
    const gekozen = ring.map((a, i) => {
      const b = ring[(i + 1) % n]; const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 1e-3) return null;
      let nx = dz / L, nz = -dx / L; const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      if (inPolygoon([mx + nx * 0.25, mz + nz * 0.25], v.r)) { nx = -nx; nz = -nz; }   // n wijst van de oever af
      const px = mx + nx * 0.8, pz = mz + nz * 0.8;
      if (!opTerrein(px, pz)) return null;
      const kl = klasseOp(px, pz); if (kl === 2 || kl === 8) return null;
      return { a, b, nx, nz };
    });
    let start = gekozen.findIndex(g => !g); if (start < 0) start = 0;
    let ketting = null;
    for (let s = 0; s < n; s++) {
      const g = gekozen[(start + s) % n];
      if (!g) { if (ketting) kettingen.push(ketting); ketting = null; continue; }
      if (!ketting) ketting = [];
      ketting.push(g);
    }
    if (ketting) kettingen.push(ketting);
  }
  // van randen naar een lijn, `afstand` meter de landkant op (verstek in de hoeken)
  const lijnen = [];
  for (const R of kettingen) {
    const pts = [];
    for (let i = 0; i <= R.length; i++) {
      const p = i < R.length ? R[i].a : R[R.length - 1].b;
      const n1 = R[Math.max(0, i - 1)], n2 = R[Math.min(R.length - 1, i)];
      let nx = n1.nx + n2.nx, nz = n1.nz + n2.nz; const L = Math.hypot(nx, nz) || 1; nx /= L; nz /= L;
      const cosH = Math.max(0.5, n1.nx * nx + n1.nz * nz);
      pts.push([p[0] + nx * hek.afstand / cosH, p[1] + nz * hek.afstand / cosH]);
    }
    lijnen.push(pts);
  }
  // uiteinden aan de poort en aan de dichte hekstukken hechten, de dichte
  // hekstukken zelf toevoegen, en losse stukken aan elkaar (kleine onderbrekingen)
  const afst = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  const aansluitpunten = versperringen.flatMap(v => [v[0], v[1]]);
  for (const pts of lijnen) {
    for (const eind of [0, pts.length - 1]) {
      const p = pts[eind];
      const dichtst = aansluitpunten.slice().sort((u, w) => afst(p, u) - afst(p, w))[0];
      const d = afst(p, dichtst);
      if (d < 1.5) pts[eind] = dichtst;                                        // vlakbij: het uiteinde erop leggen
      else if (d < 8) { if (eind === 0) pts.unshift(dichtst); else pts.push(dichtst); }   // verder weg: een stuk hek ernaartoe
    }
  }
  for (const [a, b] of versperringen.slice(1)) lijnen.push([a, b]);
  let samengevoegd = true;
  while (samengevoegd) {
    samengevoegd = false;
    buiten: for (let i = 0; i < lijnen.length; i++) for (let j = 0; j < lijnen.length; j++) {
      if (i === j) continue;
      const A = lijnen[i], B = lijnen[j];
      if (afst(A[A.length - 1], B[0]) < 2.0) { lijnen[i] = A.concat(B.slice(1)); lijnen.splice(j, 1); samengevoegd = true; break buiten; }
      if (afst(A[A.length - 1], B[B.length - 1]) < 2.0) { lijnen[i] = A.concat(B.slice().reverse().slice(1)); lijnen.splice(j, 1); samengevoegd = true; break buiten; }
    }
  }
  for (const pts of lijnen) {
    let lengte = 0; for (let i = 1; i < pts.length; i++) lengte += afst(pts[i - 1], pts[i]);
    if (lengte < 3) continue;
    HEKWERKEN.push({ pts: pts.map(q => [r2(q[0]), r2(q[1])]), h: hek.hoogte, lengte: r2(lengte), terrein: t.kort });
  }
  POORTEN.push({ a: pa, b: pb, h: hek.hoogte, open: t.poort.open ?? 1.4, terrein: t.kort });
  telling[`hekwerk_${t.kort}_m`] = Math.round(HEKWERKEN.filter(h => h.terrein === t.kort).reduce((s, h) => s + h.lengte, 0));

  // gebouwen op het terrein: bedrijfstype in plaats van woningtype
  let nPand = 0;
  for (const p of PANDEN) {
    const [cx, cz] = zwaartepunt(p.voet);
    if (!opTerrein(cx, cz)) continue;
    p.type = (t.typen || {})[p.id] || t.type || p.type;
    if (!p.straat && t.straat) p.straat = t.straat;
    p.terrein = t.kort; nPand++;
  }
  telling[`panden_${t.kort}`] = nPand;

  // bomen langs het hek, aan de binnenkant op het gras
  const rt = rng(31);
  if (t.bomen) for (const hw of HEKWERKEN.filter(h => h.terrein === t.kort)) {
    let s = 4 + rt() * 4;
    for (let i = 1; i < hw.pts.length; i++) {
      const a = hw.pts[i - 1], b = hw.pts[i]; const L = afst(a, b); if (L < 1e-3) continue;
      const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
      while (s <= L) {
        const x = a[0] + ux * s, z = a[1] + uz * s;
        let nx = -uz, nz = ux; if (!opTerrein(x + nx * 2, z + nz * 2)) { nx = -nx; nz = -nz; }
        const tx = x + nx * t.bomen.binnen, tz = z + nz * t.bomen.binnen;
        if (opTerrein(tx, tz) && vrijRond(tx, tz, 1.4, [3]) && rt() < 0.85) BOMEN.push({ x: r2(tx), z: r2(tz), s: r2(1.2 + rt() * 0.6), tall: true });
        s += t.bomen.afstand * (0.8 + rt() * 0.4);
      }
      s -= L;
    }
  }
  // lantaarns langs de erfranden op het terrein
  if (t.lantaarns) {
    let nLamp = 0;
    for (const v of VLAKKEN) {
      if (v.k !== 'erf') continue;
      const ring = v.r[0]; if (!ring.some(p => opTerrein(p[0], p[1]))) continue;
      let s = 10;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length]; const L = afst(a, b); if (L < 1e-3) continue;
        const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
        while (s <= L) {
          const x = a[0] + ux * s, z = a[1] + uz * s;
          let nx = uz, nz = -ux; if (klasseOp(x + nx * 0.7, z + nz * 0.7) === 5) { nx = -nx; nz = -nz; }
          const lx = x + nx * 0.7, lz = z + nz * 0.7;
          if (opTerrein(lx, lz) && klasseOp(lx, lz) === 3 && !LANTAARNS.some(l => Math.hypot(l.x - lx, l.z - lz) < 14)) { LANTAARNS.push({ x: r2(lx), z: r2(lz) }); nLamp++; }
          s += t.lantaarns.afstand;
        }
        s -= L;
      }
    }
    telling[`lantaarns_${t.kort}`] = nLamp;
  }
  // losse objecten aan een gebouw (buitentrap): aan de langste muur met erf ervoor
  for (const o of t.objecten || []) {
    const p = PANDEN.find(q => q.id === o.pand); if (!p) continue;
    const ring = p.voet, [cx, cz] = zwaartepunt(ring);
    let best = null;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length]; const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 4) continue;
      let nx = dz / L, nz = -dx / L; const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      if ((mx - cx) * nx + (mz - cz) * nz < 0) { nx = -nx; nz = -nz; }
      if (klasseOp(mx + nx * 1.6, mz + nz * 1.6) !== 5) continue;
      if (!best || L > best.L) best = { L, x: mx + nx * 0.25, z: mz + nz * 0.25, nx, nz };
    }
    if (best) OBJECTEN.push({ type: o.type, x: r2(best.x), z: r2(best.z), yaw: Math.round(Math.atan2(best.nx, best.nz) * 180 / Math.PI * 10) / 10 });
  }
}
// woningtypen opnieuw tellen na de terreinen
telling.woningtypen = {}; for (const p of PANDEN) telling.woningtypen[p.type] = (telling.woningtypen[p.type] || 0) + 1;
/*
 Losse hekken om een pand heen (data/stijl/omgeving.json → `hekken`).

 De BGT-laag `scheiding` bevat in Tinga alleen kademuren, dus een erfafscheiding
 die wél op de foto staat komt hiervandaan. De lijn wordt niet met de hand
 uitgetypt maar om de omsluitende rechthoek van het pand gelegd, `marge` meter
 uit de gevel, in stukjes van twee meter. Stukjes die op een rijbaan, inrit,
 fietspad, voetpad of water zouden komen vervallen — daardoor ontstaat het gat
 bij de inrit vanzelf en staat er nooit een hek dwars over de weg.
*/
const OPENBAAR = ['rijbaan', 'autoweg', 'woonerf', 'fietspad', 'voetpad', 'inrit', 'water', 'oever'];
for (const h of OMGEVING.hekken || []) {
  const p = PANDEN.find(q => q.id === h.omPand);
  if (!p || !p.rect) { console.warn(`LET OP: hek ${h.naam}: pand ${h.omPand} niet gevonden`); continue; }
  const r = p.rect, c = Math.cos(r.hoek), s = Math.sin(r.hoek);
  const hx = r.hx + (h.marge ?? 8), hz = r.hz + (h.marge ?? 8);
  const hoeken = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].map(([u, v]) => [r.cx + u * c - v * s, r.cz + u * s + v * c]);
  const punten = [];
  for (let i = 0; i < 4; i++) {
    const a = hoeken[i], b = hoeken[(i + 1) % 4];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 2));
    for (let k = 0; k < n; k++) punten.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  punten.push(hoeken[0]);
  const mijden = h.mijd || OPENBAAR;
  const bezet = VLAKKEN.filter(v => mijden.includes(v.k));
  const vrij = (q) => !bezet.some(v => inPolygoon(q, v.r)) && !PANDEN.some(w => inRing(q, w.voet));
  const lijnen = []; let ketting = null;
  for (const q of punten) {
    if (!vrij(q)) { ketting = null; continue; }
    if (!ketting) { ketting = []; lijnen.push(ketting); }
    ketting.push(q);
  }
  let totaal = 0;
  for (const pts of lijnen) {
    let lengte = 0;
    for (let i = 1; i < pts.length; i++) lengte += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (lengte < 3) continue;
    totaal += lengte;
    HEKWERKEN.push({ pts: pts.map(q => [r2(q[0]), r2(q[1])]), h: h.hoogte || 1.5, lengte: r2(lengte), terrein: h.kort, ...(h.kleur ? { kleur: h.kleur } : {}) });
  }
  telling[`hekwerk_${h.kort}_m`] = Math.round(totaal);
}

tel('hekwerken', HEKWERKEN.length); tel('poorten', POORTEN.length);

// ---------------------------------------------------------------- viaducten
/*
 Het viaduct over de rondweg. De BGT markeert de wegvakken die erover heen
 liggen met relatieveHoogteligging 1; die vormen samen het brugdek. De opritten
 staan er als gewone wegvakken in, want de BGT kent geen hoogte — daarom staan
 in data/stijl/omgeving.json alleen de twee punten waar de oprit weer op
 maaiveld ligt. De rest rekent de generator uit: de route tussen die punten over
 de wegassen, de hoogte per meter langs die route, en hoe breed het weglichaam
 en het grastalud er zijn.

 Wat eruit komt is een hoogteveld: een lijn met per station de hoogte en de
 halve breedte van de kruin en van de teen van het talud, links en rechts. Het
 spel (js/viaduct.js) leest daar de hoogte van elk punt uit, zodat de
 ondergrond, de auto's en de speler allemaal dezelfde helling voelen.
*/
const VIADUCTEN = [];
for (const V of OMGEVING.viaducten || []) {
  const D = V.dekvak;
  const inVak = (p) => p[0] >= D.x0 && p[0] <= D.x1 && p[1] >= D.z0 && p[1] <= D.z1;
  const inDekvak = (v) => inVak(zwaartepunt(v.r[0]));
  const dekVlakken = VLAKKEN.filter(v => (v.hl === 1 || v.k === 'brug') && v.sub !== 'pijler' && inDekvak(v));
  // de BGT tekent de pijler als eigen vlak; die staat straks onder het dek
  const PIJLERS = VLAKKEN.filter(v => v.sub === 'pijler' && inDekvak(v)).map(v => v.r[0]);
  if (!dekVlakken.length) { console.warn(`viaduct ${V.naam}: geen dekvlakken in het dekvak`); continue; }
  const opDek = (x, z) => dekVlakken.some(v => inPolygoon([x, z], v.r));

  // -- route van voet tot voet over de wegassen (Dijkstra op de knikpunten)
  const knopen = [], index = new Map();
  const sleutel = (p) => `${Math.round(p[0] * 2)}:${Math.round(p[1] * 2)}`;
  const knoop = (p) => { const s = sleutel(p); if (!index.has(s)) { index.set(s, knopen.length); knopen.push({ p, buren: [] }); } return index.get(s); };
  for (const k of rijKetens) for (let i = 1; i < k.pts.length; i++) {
    const a = knoop([k.pts[i - 1].x, k.pts[i - 1].z]), b = knoop([k.pts[i].x, k.pts[i].z]);
    if (a === b) continue;
    const L = Math.hypot(knopen[a].p[0] - knopen[b].p[0], knopen[a].p[1] - knopen[b].p[1]);
    knopen[a].buren.push([b, L, k.w]); knopen[b].buren.push([a, L, k.w]);
  }
  const dichtst = (q) => { let bi = -1, bd = 1e9; knopen.forEach((n, i) => { const d = Math.hypot(n.p[0] - q[0], n.p[1] - q[1]); if (d < bd) { bd = d; bi = i; } }); return bi; };
  const start = dichtst(V.voetZuid), doel = dichtst(V.voetNoord);
  const afst = knopen.map(() => Infinity), via = knopen.map(() => -1), gedaan = knopen.map(() => false);
  afst[start] = 0;
  for (;;) {
    let u = -1, bd = Infinity;
    for (let i = 0; i < knopen.length; i++) if (!gedaan[i] && afst[i] < bd) { bd = afst[i]; u = i; }
    if (u < 0 || u === doel) break;
    gedaan[u] = true;
    for (const [b, L] of knopen[u].buren) if (afst[u] + L < afst[b]) { afst[b] = afst[u] + L; via[b] = u; }
  }
  if (afst[doel] === Infinity) { console.warn(`viaduct ${V.naam}: geen route tussen de twee voetpunten`); continue; }
  const route = []; for (let i = doel; i >= 0; i = via[i]) route.unshift(knopen[i].p);

  // -- om de meter een station, met de hoogte uit het profiel
  const HOOG = V.doorrijhoogte + V.dekdikte;
  const STAP = 1.0;
  const stations = [];
  let rest = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let t = rest; t < L; t += STAP) stations.push([a[0] + (b[0] - a[0]) * t / L, a[1] + (b[1] - a[1]) * t / L]);
    rest = (rest < L ? STAP - ((L - rest) % STAP) : rest - L);
  }
  stations.push(route[route.length - 1]);
  const dek = stations.map(p => opDek(p[0], p[1]));
  let d0 = dek.indexOf(true), d1 = dek.lastIndexOf(true);
  if (d0 < 0) { console.warn(`viaduct ${V.naam}: de route raakt het dek niet`); continue; }
  // gaatjes in het dek (een naad tussen twee BGT-vakken) tellen als dek
  for (let i = d0; i <= d1; i++) dek[i] = true;
  /*
   Hoogteprofiel: recht omhoog met afgeronde uiteinden, zoals een echte
   verticale boog. `a` is het deel van de oprit dat de ronding kost; daardoor is
   de steilste helling 1/(1-a) keer de gemiddelde, hier een derde meer.
  */
  const a = 0.25;
  const oprit = (t) => t <= 0 ? 0 : t >= 1 ? 1
    : t < a ? (t * t) / (2 * a * (1 - a))
      : t > 1 - a ? 1 - ((1 - t) * (1 - t)) / (2 * a * (1 - a))
        : (t - a / 2) / (1 - a);
  const hoogteVan = (i) => i <= d0 ? HOOG * oprit(d0 ? i / d0 : 1)
    : i >= d1 ? HOOG * oprit((stations.length - 1 - i) / Math.max(1, stations.length - 1 - d1))
      : HOOG;

  // -- breedte van de kruin en van de teen van het talud, per station en per kant
  const HARD = new Set(['rijbaan', 'autoweg', 'fietspad', 'voetpad', 'inrit', 'parkeervlak', 'woonerf', 'verharding', 'asfaltvlak', 'brug']);
  const ZACHT = new Set(['gras', 'berm', 'bodembedekker', 'heesters', 'bos', 'zand', 'halfverhard']);
  // alleen de vlakken langs de route: anders wordt het aftasten hieronder traag
  const rb = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of stations) { rb[0] = Math.min(rb[0], p[0] - 30); rb[1] = Math.min(rb[1], p[1] - 30); rb[2] = Math.max(rb[2], p[0] + 30); rb[3] = Math.max(rb[3], p[1] + 30); }
  const langs = VLAKKEN.filter(v => { const b = bboxRing(v.r[0]); return b[2] >= rb[0] && b[0] <= rb[2] && b[3] >= rb[1] && b[1] <= rb[3]; })
    .map(v => ({ k: v.k, r: v.r, b: bboxRing(v.r[0]) }));
  const klasseVan = (x, z) => {
    for (const w of langs) if (x >= w.b[0] && x <= w.b[2] && z >= w.b[1] && z <= w.b[3] && inPolygoon([x, z], w.r)) return w.k;
    return null;
  };
  const AS = [];
  for (let i = 0; i < stations.length; i++) {
    const p = stations[i];
    const q = stations[Math.min(stations.length - 1, i + 1)], r = stations[Math.max(0, i - 1)];
    const dx = q[0] - r[0], dz = q[1] - r[1], L = Math.hypot(dx, dz) || 1;
    const nx = -dz / L, nz = dx / L;                       // links van de rijrichting
    const h = hoogteVan(i);
    /*
     Aftasten hoe breed het weglichaam hier is. Op het dek telt alleen het
     brugdek zelf mee — zijwaarts ligt daar de rijksweg, en die hoort bij het
     maaiveld. Op de oprit loopt de kruin tot waar de verharding ophoudt en
     zakt het talud daarna af tot in het gras. KRUIN_MAX houdt kruispunten en
     parkeerstroken buiten het weglichaam.
    */
    const KRUIN_MAX = 9;
    const kanten = [];
    for (const zij of [1, -1]) {
      let kruin = 1.5, teen = 1.5;
      for (let d = 1.5; d <= KRUIN_MAX; d += 0.25) {
        const x = p[0] + nx * zij * d, z = p[1] + nz * zij * d;
        if (dek[i] ? opDek(x, z) : HARD.has(klasseVan(x, z))) { kruin = d; teen = d; continue; }
        break;
      }
      if (!dek[i]) for (let d = kruin + 0.25; d <= kruin + h * V.taludHelling + 1; d += 0.25) {
        const k = klasseVan(p[0] + nx * zij * d, p[1] + nz * zij * d);
        if (k && ZACHT.has(k)) { teen = d; continue; }
        break;
      }
      kanten.push([r2(kruin), r2(dek[i] ? kruin : Math.max(teen, kruin + h * 0.5))]);
    }
    AS.push([r2(p[0]), r2(p[1]), r2(h), kanten[0][0], kanten[0][1], kanten[1][0], kanten[1][1], dek[i] ? 1 : 0]);
  }
  /*
   De middellijn komt uit het skelet van de wegvakken en slingert bij elke
   aansluiting een halve meter heen en weer; op het dek zie je dat terug als een
   slingerende brug. Daarom: de as over het dek wordt rechtgetrokken (kleinste
   kwadraten door de dekstations, met een overgang van 12 stations naar de
   oprit), en de breedtes gaan door een mediaanfilter — op het dek zelfs naar
   één waarde per kant, want een brugdek is overal even breed.
  */
  {
    const dekI = AS.map((_, i) => i).filter(i => AS[i][7]);
    let sx = 0, sz = 0; for (const i of dekI) { sx += AS[i][0]; sz += AS[i][1]; }
    const mx = sx / dekI.length, mz = sz / dekI.length;
    let sxx = 0, sxz = 0, szz = 0;
    for (const i of dekI) { const dx = AS[i][0] - mx, dz = AS[i][1] - mz; sxx += dx * dx; sxz += dx * dz; szz += dz * dz; }
    const hoek = 0.5 * Math.atan2(2 * sxz, sxx - szz);      // hoofdrichting van de puntenwolk
    const ux = Math.cos(hoek), uz = Math.sin(hoek);
    const OVER = 12;
    for (let i = Math.max(0, d0 - OVER); i <= Math.min(AS.length - 1, d1 + OVER); i++) {
      const t = (AS[i][0] - mx) * ux + (AS[i][1] - mz) * uz;
      const px = mx + ux * t, pz = mz + uz * t;
      const w = i < d0 ? (i - (d0 - OVER)) / OVER : i > d1 ? (d1 + OVER - i) / OVER : 1;
      AS[i][0] = r2(AS[i][0] + (px - AS[i][0]) * w);
      AS[i][1] = r2(AS[i][1] + (pz - AS[i][1]) * w);
    }
    const mediaan = (a) => a.slice().sort((p, q) => p - q)[Math.floor(a.length / 2)];
    for (const kol of [3, 4, 5, 6]) {
      const oud = AS.map(s => s[kol]);
      for (let i = 0; i < AS.length; i++) AS[i][kol] = mediaan(oud.slice(Math.max(0, i - 4), i + 5));
    }
    for (const kol of [3, 5]) {
      const w = mediaan(dekI.map(i => AS[i][kol]));
      for (const i of dekI) { AS[i][kol] = w; AS[i][kol + 1] = w; }
    }
    // Het talud eindigt bij de landhoofden: laat de teen daar met hoogstens
    // 0,9 m per meter uitwaaieren, anders staat er een klif naast de brug.
    for (const kol of [4, 6]) {
      for (let i = d0 - 1, n = 1; i >= 0 && n <= 14; i--, n++) AS[i][kol] = Math.min(AS[i][kol], AS[d0][kol] + n * 0.9);
      for (let i = d1 + 1, n = 1; i < AS.length && n <= 14; i++, n++) AS[i][kol] = Math.min(AS[i][kol], AS[d1][kol] + n * 0.9);
    }
  }

  const bb = [Infinity, Infinity, -Infinity, -Infinity];
  for (const s of AS) { const m = Math.max(s[4], s[6]) + 2; bb[0] = Math.min(bb[0], s[0] - m); bb[1] = Math.min(bb[1], s[1] - m); bb[2] = Math.max(bb[2], s[0] + m); bb[3] = Math.max(bb[3], s[1] + m); }
  VIADUCTEN.push({
    naam: V.naam, hoogte: r2(HOOG), dekdikte: V.dekdikte,
    as: AS, dekVan: d0, dekTot: d1, bbox: bb.map(r2), dek: dekVlakken.map(v => v.r[0]), pijlers: PIJLERS,
    boog: V.boog, leuning: V.leuning, fietsstrook: V.fietsstrook,
  });
  // Rode fietsstroken: de BGT kent alleen 'gesloten verharding', de foto laat
  // rood asfalt zien. Alleen op het dek, want de oprit is geklinkerd.
  if (V.fietsstrook && V.fietsstrook.rood) for (const v of dekVlakken) if (v.k === 'fietspad') v.m = 'fietspad';
  /*
   Het overbruggingsdeel is één vlak over het hele dek. Op 0,15 ligt het hoger
   dan de rijbaan, het fietspad en het trottoir die erop liggen, en dan zie je
   in het spel alleen nog asfalt. `dekY` laat het in de wereld onder het wegdek
   zakken, waar het als sluitlaag dient: alle naden tussen de BGT-wegvakken
   zitten ermee dicht. Op de platte controleplaat (tools/geo/bovenaanzicht.mjs)
   telt `y` gewoon, zodat de vergelijking met de BGT-kaart niet verschuift.
  */
  for (const v of dekVlakken) if (v.k === 'brug') v.dekY = -0.05;
  /*
   Het dek ligt vlak. De vakken erop krijgen daarom een vaste hoogte mee
   (`dekh`) in plaats van het hoogteveld: een hoekpunt dat net buiten de
   gemeten kruin valt zou anders naar het maaiveld zakken, en dan hangt er een
   scherf rood fietspad van de brug af.
  */
  for (const v of dekVlakken) v.dekh = r2(HOOG);
  const lengte = (AS.length - 1) * STAP;
  telling[`viaduct_${V.naam.replace(/\W+/g, '_').toLowerCase()}_m`] = Math.round(lengte);
  telling[`viaduct_${V.naam.replace(/\W+/g, '_').toLowerCase()}_dek_m`] = Math.round((d1 - d0) * STAP);
  const steil = Math.max(...AS.slice(1).map((s, i) => Math.abs(s[2] - AS[i][2]) / STAP));
  telling[`viaduct_${V.naam.replace(/\W+/g, '_').toLowerCase()}_helling_pct`] = Math.round(steil * 1000) / 10;
}
tel('viaducten', VIADUCTEN.length);

// ---------------------------------------------------------------- sportvelden
/*
 De velden van VV Sneek Wit Zwart aan de Molenkrite 132 en de hockeyvelden
 ernaast. Het vlak zelf komt uit de BGT — kunstgras staat er als "kunststof",
 gras als groenvoorziening — maar een BGT-vlak is een polygoon zonder richting,
 en om er lijnen, doelen, reclameborden en hekken omheen te zetten moet je weten
 welke kant het veld op ligt en hoe groot het is. Daarom wordt hier per veld de
 kleinste omhullende rechthoek gezocht: die geeft het midden, de richting van de
 lange as en de maten. Het uitgezette speelveld ligt daarbinnen met een
 uitloopstrook eromheen, en nooit groter dan wat de KNVB toestaat.

 In data/stijl/omgeving.json staat alleen een punt per veld en hoe het eruitziet.
*/
const SPORTVELDEN = [];
const veldRingen = [];              // de BGT-vlakken van de velden zelf
for (const S of OMGEVING.sportvelden || []) {
  const vlak = VLAKKEN.find(v => ['kunstgras', 'gras', 'asfaltvlak'].includes(v.k) && inPolygoon(S.punt, v.r));
  if (!vlak) { console.warn(`LET OP: sportveld ${S.naam}: geen vlak op ${S.punt}`); continue; }
  const ring = vlak.r[0];
  /*
   Kleinste omhullende rechthoek: bij een convexe vorm ligt één zijde van die
   rechthoek altijd langs een zijde van de vorm zelf, dus het is genoeg om elke
   zijde als richting te proberen en de kleinste oppervlakte te houden.
  */
  let beste = null;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    if (L < 1) continue;
    const ex = dx / L, ez = dz / L;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const p of ring) {
      const u = p[0] * ex + p[1] * ez, v = -p[0] * ez + p[1] * ex;
      u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
    }
    const opp = (u1 - u0) * (v1 - v0);
    if (!beste || opp < beste.opp) {
      const um = (u0 + u1) / 2, vm = (v0 + v1) / 2;
      beste = { opp, ex, ez, a: u1 - u0, b: v1 - v0, cx: um * ex - vm * ez, cz: um * ez + vm * ex };
    }
  }
  if (!beste) { console.warn(`LET OP: sportveld ${S.naam}: geen rechthoek te vinden`); continue; }
  // de lange as is de speelrichting; hoek is de richting daarvan in het spel
  let { a: lang, b: breed, ex, ez } = beste;
  if (breed > lang) { [lang, breed] = [breed, lang]; [ex, ez] = [-ez, ex]; }
  const hoek = Math.atan2(ez, ex);
  const uitloop = S.uitloop ?? 3.0;
  const maxL = S.maat ? S.maat[0] : 105, maxB = S.maat ? S.maat[1] : 68;
  const vl = Math.min(lang - 2 * uitloop, maxL), vb = Math.min(breed - 2 * uitloop, maxB);
  if (vl < 40 || vb < 25) { console.warn(`LET OP: sportveld ${S.naam}: ${r2(vl)} x ${r2(vb)} m is te klein voor een veld`); continue; }
  /*
   De tribune. Die staat als gewoon pand in de BGT — bij het hoofdveld een blok
   van 45 bij 14 m langs de zijlijn — maar wat je ervan ziet zijn de traptreden
   met stoeltjes en het luifeldak, en dat staat nergens in de brondata. Hier
   wordt het pand opgezocht en omgerekend naar de plek van de tribune ten
   opzichte van het veld; js/sportveld.js bouwt hem.
  */
  let tribune = null;
  if (S.tribune) {
    const p = PANDEN.find(q => q.id === S.tribune.pand);
    if (!p || !p.rect) console.warn(`LET OP: sportveld ${S.naam}: geen pand ${S.tribune.pand} voor de tribune`);
    else {
      const r = p.rect;
      // ligt de lange kant van het pand langs het veld? zo niet, de andere kant
      const langsPand = Math.abs(Math.cos(r.hoek - hoek)) > 0.7;
      const lang = langsPand ? r.hx * 2 : r.hz * 2;
      const diepPand = langsPand ? r.hz * 2 : r.hx * 2;
      /*
       Waar staat het pand ten opzichte van het veld? u loopt langs het veld,
       v er dwars op: v = -dx * ez + dz * ex, met de as (ex, ez) langs het veld.
       De voorkant van de tribune is de zijde die naar het veld toe kijkt, dus
       een halve panddiepte de kant van het veld op.
      */
      const dx = r.cx - beste.cx, dz = r.cz - beste.cz;
      const u = dx * ex + dz * ez, v = -dx * ez + dz * ex;
      const kant = Math.sign(v) || 1;
      const vVoor = v - kant * diepPand / 2;
      tribune = {
        lang: r2(lang), diep: r2(Math.min(S.tribune.diep ?? 6, diepPand - 1)),
        treden: S.tribune.treden ?? 5, luifel: r2(S.tribune.luifel ?? 2),
        goot: p.goot, kant,
        // het midden van de voorgevel, in wereldcoördinaten
        vx: r2(beste.cx + ex * u - ez * vVoor), vz: r2(beste.cz + ez * u + ex * vVoor),
        hoek: r2(hoek), vlaggenmast: !!S.tribune.vlaggenmast,
      };
      telling[`tribune_${S.naam.replace(/\W+/g, '_').toLowerCase()}_m`] = Math.round(lang);
    }
  }
  veldRingen.push(vlak.r);
  SPORTVELDEN.push({
    naam: S.naam, soort: S.soort || (vlak.k === 'kunstgras' ? 'kunstgras' : 'gras'),
    hoofd: !!S.hoofd, cx: r2(beste.cx), cz: r2(beste.cz), hoek: r2(hoek),
    l: r2(lang), b: r2(breed), vl: r2(vl), vb: r2(vb),
    reclame: S.reclame !== false, hek: S.hek !== false, doelen: S.doelen !== false,
    dugouts: !!S.dugouts, masten: S.masten || 0, tribune,
  });
  telling[`sportveld_${S.naam.replace(/\W+/g, '_').toLowerCase()}`] = `${Math.round(vl)}x${Math.round(vb)} m`;
}
tel('sportvelden', SPORTVELDEN.length);
/*
 Een voetbalveld is geen gazon. De twee grasvelden zijn in de BGT gewoon
 groenvoorziening van meer dan 600 m², en dat is precies waar de parkbomenregel
 hierboven grote bomen in strooit — er stonden vijfentwintig bomen midden op het
 veld. Alles wat op een veld terecht is gekomen gaat er hier weer af; dat is
 dezelfde aanpak als bij de bomen onder het brugdek van het viaduct.
*/
if (veldRingen.length) {
  const opVeld = (o) => veldRingen.some(r => inPolygoon([o.x, o.z], r));
  let weg = 0;
  for (const lijst of [BOMEN, STRAATBOMEN, PARKBOMEN, STRUIKEN, LANTAARNS]) {
    for (let i = lijst.length - 1; i >= 0; i--) if (opVeld(lijst[i])) { lijst.splice(i, 1); weg++; }
  }
  tel('van_sportveld_weggehaald', weg);
}

// ---------------------------------------------------------------- volkstuinen
/*
 Het volkstuinencomplex achter de Wieken. De BGT kent het als één grasperceel
 tussen twee sloten (Street View "2 De Wieken": een grindpad met een hek erin,
 daarachter tuintjes met schuurtjes en kleine kassen). De percelen zelf staan
 niet in de brondata — die zijn te klein om geregistreerd te worden — dus die
 worden hier uitgezet: het perceel wordt op zijn eigen richting gelegd, er komt
 een grasrand van `rand` meter langs de sloot, en in wat overblijft komen rijen
 tuintjes met een pad ertussen. Wat niet helemaal binnen het perceel valt, komt
 er niet: zo blijven de randen de vorm van de sloot volgen.
*/
const VOLKSTUINEN = [];
for (const V of OMGEVING.volkstuinen || []) {
  const vlak = VLAKKEN.find(v => ['gras', 'bodembedekker', 'heesters'].includes(v.k) && inPolygoon(V.punt, v.r));
  if (!vlak) { console.warn(`LET OP: volkstuinen ${V.naam}: geen groenvak op ${V.punt}`); continue; }
  const ringen = vlak.r;
  const rand = V.rand ?? 7;
  const tuinB = V.tuin?.breed ?? 9, tuinD = V.tuin?.diep ?? 16;
  const padB = V.pad ?? 3;
  // ligt een heel tuintje binnen het perceel, ruim van de rand af?
  const vrij = (cx, cz, hb, hd, ex, ez) => {
    for (const [s, t] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const px = cx + ex * hb * s - ez * hd * t, pz = cz + ez * hb * s + ex * hd * t;
      if (!inPolygoon([px, pz], ringen)) return false;
      // en op `rand` meter van elke slootkant vandaan
      for (const r of ringen) for (let i = 0; i < r.length; i++) {
        const a = r[i], b = r[(i + 1) % r.length];
        const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1;
        let u = ((px - a[0]) * dx + (pz - a[1]) * dz) / L2; u = Math.max(0, Math.min(1, u));
        if (Math.hypot(px - (a[0] + dx * u), pz - (a[1] + dz * u)) < rand) return false;
      }
    }
    return true;
  };
  // richting: de langste zijde van het perceel, zodat de rijen met de sloot meelopen
  let ex = 1, ez = 0, langste = 0;
  for (let i = 0; i < ringen[0].length; i++) {
    const a = ringen[0][i], b = ringen[0][(i + 1) % ringen[0].length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L > langste) { langste = L; ex = (b[0] - a[0]) / L; ez = (b[1] - a[1]) / L; }
  }
  const [mx, mz] = zwaartepunt(ringen[0]);
  const rs = rng(V.seed ?? 97);
  const tuinen = [], paden = [];
  // rijen tuintjes rug aan rug, met een pad tussen elk stel rijen
  const stap = tuinD * 2 + padB;
  const nRij = Math.ceil(120 / stap), nKol = Math.ceil(140 / tuinB);
  for (let j = -nRij; j <= nRij; j++) {
    const vBasis = j * stap;
    let rijLeeg = true, v0 = null, v1 = null;
    for (const kant of [-1, 1]) {
      const vc = vBasis + kant * (padB / 2 + tuinD / 2);
      for (let i = -nKol; i <= nKol; i++) {
        const uc = i * tuinB;
        const cx = mx + ex * uc - ez * vc, cz = mz + ez * uc + ex * vc;
        if (!vrij(cx, cz, tuinB / 2 - 0.4, tuinD / 2 - 0.4, ex, ez)) continue;
        rijLeeg = false;
        v0 = v0 === null ? uc : Math.min(v0, uc); v1 = v1 === null ? uc : Math.max(v1, uc);
        tuinen.push({
          x: r2(cx), z: r2(cz), b: r2(tuinB - 0.8), d: r2(tuinD - 0.8), hoek: r2(Math.atan2(ez, ex)),
          // het schuurtje staat aan de padkant, de kas ernaast
          kant, schuur: rs() < (V.schuurkans ?? 0.6), kas: rs() < (V.kaskans ?? 0.22),
          gewas: Math.floor(rs() * 5), s: r2(0.7 + rs() * 0.6),
        });
      }
    }
    if (!rijLeeg && v0 !== null) {
      const ax = mx + ex * (v0 - tuinB / 2) - ez * vBasis, az = mz + ez * (v0 - tuinB / 2) + ex * vBasis;
      const bx = mx + ex * (v1 + tuinB / 2) - ez * vBasis, bz = mz + ez * (v1 + tuinB / 2) + ex * vBasis;
      paden.push({ a: [r2(ax), r2(az)], b: [r2(bx), r2(bz)], breed: r2(padB) });
    }
  }
  if (!tuinen.length) { console.warn(`LET OP: volkstuinen ${V.naam}: geen tuintje past binnen het perceel`); continue; }
  VOLKSTUINEN.push({ naam: V.naam, tuinen, paden });
  telling[`volkstuinen_${V.naam.replace(/\W+/g, '_').toLowerCase()}`] = tuinen.length;
}
tel('volkstuinen', VOLKSTUINEN.reduce((n, v) => n + v.tuinen.length, 0));

// ---------------------------------------------------------------- molens
/*
 Houtzaagmolen De Rat aan het Sneekerpad 16 in IJlst, en elke andere molen die
 in data/stijl/straten.json als `type: "molen"` staat.

 Wat uit de data komt:
   - het hart van de romp: het zwaartepunt van de 3D BAG-punten in de band net
     boven de goot. Dat komt hier op 26 cm van het middelpunt van de omhullende
     rechthoek uit, dus de twee bevestigen elkaar;
   - de stellinghoogte: de goot van het pand (7,52 m);
   - de tophoogte: de nok (20,66 m);
   - de richting en de maat van de zaagloodsen: de omhullende rechthoek van het
     grondvlak (28,0 x 13,6 m onder 134°).

 Wat er níet uit komt: de straal van het achtkant en de vlucht van de roeden.
 Het 3D BAG-model is bij een molen onbruikbaar voor de romp — de puntenwolk
 vangt ook de roeden, zodat de straal in dezelfde hoogteband van 1,35 tot 6,63 m
 loopt. Die twee maten staan daarom als opgemeten waarden in
 data/stijl/straten.json, net als de kruirichting: een kap draait met de wind
 mee en staat dus nergens in een bestand.
*/
const MOLENS = [];
for (const p of PANDEN) {
  const vast = (STIJL.panden || {})[p.id];
  if (!vast || vast.type !== 'molen') continue;
  const M = vast.molen || {};
  if (!p.rect) { console.warn(`LET OP: molen ${p.id}: geen omhullende rechthoek`); continue; }
  const stelling = M.stelling ?? p.goot ?? 7.5;
  const top = M.top ?? p.nok ?? 20;
  // het hart van de romp uit de punten net boven de stelling
  let cx = p.rect.cx, cz = p.rect.cz, uitData = false;
  if (p.v) {
    const laag = stelling + 1.2, hoog = stelling + 3.6;
    let sx = 0, sz = 0, n = 0;
    for (let i = 0; i < p.v.length; i += 3) { if (p.v[i + 1] >= laag && p.v[i + 1] <= hoog) { sx += p.v[i]; sz += p.v[i + 2]; n++; } }
    if (n >= 6) { cx = sx / n; cz = sz / n; uitData = true; }
  }
  MOLENS.push({
    naam: M.naam || 'molen', pand: p.id,
    cx: r2(cx), cz: r2(cz), stelling: r2(stelling), top: r2(top),
    romp: M.romp ?? 4.5, rompTop: M.rompTop ?? 2.8, kap: M.kap ?? 4.2,
    vlucht: M.vlucht ?? 19.4, kruihoek: M.kruihoek ?? 0, toeren: M.toeren ?? 4.5,
    // de zaagloodsen eromheen: het grondvlak van het pand met de nokrichting
    // van de omhullende rechthoek
    loods: { ring: p.voet, hoek: p.rect.hoek, goot: M.loodsGoot ?? 3.6, nok: M.loodsNok ?? 6.4 },
  });
  if (!uitData) console.warn(`LET OP: molen ${p.id}: te weinig 3D-punten boven de stelling, hart uit de rechthoek`);
}
tel('molens', MOLENS.length);

// ------------------------------------------------------------- tankstations
/*
 Tankstation BP Slump Oil, Lemmerweg 63 aan de rondweg, naast het sportpark.

 Wat uit de data komt:
   - de **luifel** staat als los bouwwerk in de BGT (bgt_overigbouwwerk, klasse
     `bouwwerk`): een vierhoek van 26,4 x 13,0 m. Maat, plek en richting komen
     daar vandaan, niet uit een schatting;
   - de **shop** is gewoon een pand (0091100000004556, 236 m², plat op 4,88 m),
     dat via data/stijl/straten.json zijn eigen gevel krijgt;
   - de **richting** van de luifel is de langste zijde van die vierhoek. De
     pompeilanden liggen daar evenwijdig aan, want zo staan ze onder elke
     luifel: je rijdt er langs de lange kant onderdoor;
   - de **prijzenzuil** komt bij de hoek van de luifel die het dichtst bij de
     rijbaan ligt, vier meter naar de weg toe.

 Wat er niet uit komt: de hoogte van de luifel (5,2 m vrije doorrijhoogte is de
 norm voor een station zonder vrachtverkeer) en het aantal pompen per eiland.
 Die staan in data/stijl/omgeving.json.
*/
const TANKSTATIONS = [];
for (const t of (OMGEVING.tankstations || [])) {
  // de luifel: het bouwwerk waarvan het zwaartepunt het dichtst bij `luifelBij` ligt
  let beste = null, besteD = Infinity;
  for (const v of VLAKKEN) {
    if (v.k !== 'bouwwerk') continue;
    const ring = v.r[0];
    let cx = 0, cz = 0;
    for (const q of ring) { cx += q[0]; cz += q[1]; }
    cx /= ring.length; cz /= ring.length;
    const d = Math.hypot(cx - t.luifelBij[0], cz - t.luifelBij[1]);
    if (d < besteD) { besteD = d; beste = { ring, cx, cz }; }
  }
  if (!beste || besteD > 40) { console.warn(`LET OP: tankstation ${t.naam}: geen luifel gevonden`); continue; }
  // de langste zijde geeft de richting
  let as = [1, 0], asL = 0;
  for (let i = 0; i < beste.ring.length; i++) {
    const a = beste.ring[i], b = beste.ring[(i + 1) % beste.ring.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L > asL) { asL = L; as = [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; }
  }
  // maat in de lengte en in de breedte
  let l0 = Infinity, l1 = -Infinity, b0 = Infinity, b1 = -Infinity;
  for (const q of beste.ring) {
    const dl = (q[0] - beste.cx) * as[0] + (q[1] - beste.cz) * as[1];
    const db = (q[0] - beste.cx) * -as[1] + (q[1] - beste.cz) * as[0];
    l0 = Math.min(l0, dl); l1 = Math.max(l1, dl); b0 = Math.min(b0, db); b1 = Math.max(b1, db);
  }
  const lengte = l1 - l0, breedte = b1 - b0;
  // pompeilanden: evenwijdig aan de lange as, op een derde en twee derde van de breedte
  const eilanden = [];
  const nEil = t.eilanden || 2;
  for (let i = 0; i < nEil; i++) {
    const db = b0 + breedte * (i + 1) / (nEil + 1);
    eilanden.push({
      x: r2(beste.cx + -as[1] * db), z: r2(beste.cz + as[0] * db),
      lengte: r2(Math.min(lengte - 4, 9)), pompen: t.pompenPerEiland || 2,
    });
  }
  // de zuil bij de hoek die het dichtst bij een rijbaan ligt
  let hoek = beste.ring[0], hoekD = Infinity, naar = null;
  for (const q of beste.ring) {
    for (const w of WEGASSEN) {
      if (!w.drive) continue;
      for (const p2 of w.pts) {
        const d = Math.hypot(p2[0] - q[0], p2[1] - q[1]);
        if (d < hoekD) { hoekD = d; hoek = q; naar = p2; }
      }
    }
  }
  let zx = hoek[0], zz = hoek[1], zyaw = 0;
  if (naar) {
    const dx = naar[0] - hoek[0], dz = naar[1] - hoek[1], L = Math.hypot(dx, dz) || 1;
    zx = hoek[0] + dx / L * 4; zz = hoek[1] + dz / L * 4;
    zyaw = r2(Math.atan2(-dx / L, -dz / L));
  }
  TANKSTATIONS.push({
    naam: t.naam, merk: t.merk || 'bp', pand: t.pand || null,
    ring: beste.ring.map(q => [r2(q[0]), r2(q[1])]),
    cx: r2(beste.cx), cz: r2(beste.cz), as: [r2(as[0]), r2(as[1])],
    lengte: r2(lengte), breedte: r2(breedte),
    hoogte: t.hoogte ?? 5.2, dek: t.dek ?? 0.75,
    eilanden, zuil: { x: r2(zx), z: r2(zz), yaw: zyaw, hoog: t.zuilHoogte ?? 6.5 },
    prijzen: t.prijzen || [],
  });
  telling[`tankstation_${t.naam.replace(/\W+/g, '_')}_m`] = `${lengte.toFixed(1)}x${breedte.toFixed(1)} m`;
}
tel('tankstations', TANKSTATIONS.length);

// ------------------------------------------------------------- tennisbanen
/*
 De tennisbanen bij Molenkrite 130, pal naast het sportpark.

 Uit de data: de banen liggen in de BGT als **halfverhard** (grind) — vier
 blokken van 1276 tot 2535 m² rond (478, 225), met het clubgebouw (688 m²,
 bouwjaar 2012) ernaast en tien parkeervakken ervoor. Maat, plek en richting van
 elk blok komen daar vandaan.

 Wat er niet uit komt: hoeveel banen er in zo'n blok liggen. Dat rekent de
 generator uit met de maat van een echte baan: een afgezette tennisbaan is
 36,6 × 18,3 m (speelvlak 23,77 × 10,97 m plus uitloop). De korte kant van het
 blok is dus de lengte van één baan, en over de lange kant passen er
 `lengte / 18,3` naast elkaar.
*/
const TENNIS = [];
const baanRingen = [];
for (const t of (OMGEVING.tennisparken || [])) {
  const vak = t.vak;
  const blokken = [];
  for (const v of VLAKKEN) {
    if (v.k !== 'halfverhard') continue;
    const ring = v.r[0];
    let cx = 0, cz = 0;
    for (const q of ring) { cx += q[0]; cz += q[1]; }
    cx /= ring.length; cz /= ring.length;
    if (cx < vak.x0 || cx > vak.x1 || cz < vak.z0 || cz > vak.z1) continue;
    // de langste zijde geeft de richting
    let as = [1, 0], asL = 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L > asL) { asL = L; as = [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; }
    }
    let u0 = Infinity, u1 = -Infinity, w0 = Infinity, w1 = -Infinity;
    for (const q of ring) {
      const du = (q[0] - cx) * as[0] + (q[1] - cz) * as[1];
      const dw = (q[0] - cx) * -as[1] + (q[1] - cz) * as[0];
      u0 = Math.min(u0, du); u1 = Math.max(u1, du); w0 = Math.min(w0, dw); w1 = Math.max(w1, dw);
    }
    const langs = u1 - u0, dwars = w1 - w0;
    if (Math.min(langs, dwars) < 20 || langs * dwars < 700) continue;   // te klein voor een baan
    /*
     De korte kant is de lengte van de baan (36,6 m), de lange kant vult zich met
     banen naast elkaar. Ligt de korte kant langs `as`, dan draait de baanrichting
     een kwartslag mee.
     */
    const baanLangsAs = langs <= dwars;
    const baanLengte = baanLangsAs ? langs : dwars;
    const rij = baanLangsAs ? dwars : langs;
    const n = Math.max(1, Math.round(rij / (t.baanBreed || 18.3)));
    const richting = baanLangsAs ? as : [-as[1], as[0]];
    /*
     Het hek staat om de omhullende rechthoek van het grindvlak, niet om de
     veelhoek zelf — dat is ook wat er straks getekend wordt. Die rechthoek is
     dus wat er vrijgemaakt moet worden.
    */
    {
      const [ux, uz] = richting, [wx, wz] = [-richting[1], richting[0]];
      const hl = baanLengte / 2, hb = rij / 2;
      baanRingen.push([[[1, 1], [1, -1], [-1, -1], [-1, 1]].map(
        ([a, b]) => [cx + ux * hl * a + wx * hb * b, cz + uz * hl * a + wz * hb * b])]);
    }
    blokken.push({
      cx: r2(cx), cz: r2(cz), as: [r2(richting[0]), r2(richting[1])],
      lengte: r2(baanLengte), breedte: r2(rij), banen: n,
    });
  }
  if (!blokken.length) { console.warn(`LET OP: tennispark ${t.naam}: geen grindvlakken in het vak`); continue; }
  TENNIS.push({ naam: t.naam, pand: t.pand || null, blokken,
    hek: t.hek ?? 3.6, masten: t.masten !== false });
  telling[`tennis_${t.naam.replace(/\W+/g, '_')}_banen`] = blokken.reduce((s2, b) => s2 + b.banen, 0);
}
tel('tennisparken', TENNIS.length);
/*
 Dezelfde opruimactie als bij de voetbalvelden: grind is voor de strooiregels
 hierboven zachte grond, dus er kwamen bomen en struiken tussen de banen te
 staan — binnen het hek, met een stam dwars door de uitloop heen. Alles wat
 binnen zo'n omheind blok terecht is gekomen gaat er hier weer af.
*/
if (baanRingen.length) {
  const opBaan = (o) => baanRingen.some(r => inPolygoon([o.x, o.z], r));
  let weg = 0;
  for (const lijst of [BOMEN, STRAATBOMEN, PARKBOMEN, STRUIKEN, BOSGEBIED_BOMEN, LANTAARNS]) {
    for (let i = lijst.length - 1; i >= 0; i--) if (opBaan(lijst[i])) { lijst.splice(i, 1); weg++; }
  }
  tel('van_tennisbaan_weggehaald', weg);
}

/*
 ------------------------------------------------------------------ zuilengangen
 De twee gebogen blokken aan de Keizersmantel in Duinterpen (401-437 met de
 Poiesz op de begane grond, en 441-485 ernaast) staan op een rij ronde zuilen:
 de begane grond ligt een paar meter terug en de twee woonlagen erboven staan
 op de rooilijn. Wat daarvan uit de data komt:

   - de boog waar de zuilen op staan: de rand van het grondvlak die naar het
     parkeerterrein kijkt. Welke rand dat is volgt uit `voorkantNaar` in
     data/stijl/straten.json, en de buitenkant van een rand wordt met een
     punt-in-veelhoektoets bepaald en niet uit de winding — deze grondvlakken
     zijn halvemaanvormig, en dan ligt het zwaartepunt buiten het pand;
   - de hoogte van de gang: de goot van het pand (3,95 en 4,01 m). Dat is precies
     de onderste dakrand in het 3D BAG-model, dus de zuilen komen tot waar de
     woonlagen beginnen.

 Wat er niet uit komt: de dikte van de zuilen, hun onderlinge afstand en hoe diep
 de winkelpui achterligt. Die drie staan als opgemeten waarden bij het pand in
 data/stijl/straten.json, met de foto als bron.
*/
const ZUILENGANGEN = [];
for (const p of PANDEN) {
  const vast = (STIJL.panden || {})[p.id];
  if (!vast || !vast.zuilengang) continue;
  const Z = vast.zuilengang;
  if (!vast.voorkantNaar) { console.warn(`LET OP: zuilengang ${p.id}: geen voorkantNaar`); continue; }
  const doel = vast.voorkantNaar;

  /*
   Dubbele hoekpunten eruit. In de BGT staat een hoekpunt soms twee keer met een
   paar centimeter ertussen; die piepkleine randjes onderbreken anders de reeks
   en dan valt de boog in stukken uiteen.
  */
  const ring = [];
  for (const q of p.voet) {
    const v = ring[ring.length - 1];
    if (!v || Math.hypot(q[0] - v[0], q[1] - v[1]) > 0.2) ring.push(q);
  }
  if (ring.length > 2 && Math.hypot(ring[0][0] - ring[ring.length - 1][0], ring[0][1] - ring[ring.length - 1][1]) < 0.2) ring.pop();
  const N = ring.length;

  // ligt (x,z) in het grondvlak?
  const binnen = (x, z) => {
    let in_ = false;
    for (let i = 0, j = N - 1; i < N; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) in_ = !in_;
    }
    return in_;
  };

  /*
   Welke randen kijken naar het parkeerterrein? De drempel op het inproduct staat
   laag met opzet. Deze blokken buigen om hun parkeerterrein heen, dus het doel
   ligt er vlak naast en de richting erheen loopt bijna langs de boog: bij de
   Poiesz kwam de hoogste waarde niet boven 0,29 uit, en op een drempel van 0,35
   vond de generator geen enkele rand. Wat de boog eruit haalt is niet de
   scherpte van de hoek maar de eis dat een rand minstens `minRand` lang is —
   de gebogen voorgevel bestaat uit stukken van zeven meter, de kopse kanten uit
   stukjes van anderhalf.
  */
  const minRand = Z.minRand ?? 2.5;
  const lengte = [], kijkt = [];
  for (let i = 0; i < N; i++) {
    const a = ring[i], b = ring[(i + 1) % N];
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    lengte.push(L);
    if (L < minRand) { kijkt.push(false); continue; }
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    let nx = dz / L, nz = -dx / L;
    if (binnen(mx + nx * 0.4, mz + nz * 0.4)) { nx = -nx; nz = -nz; }   // naar buiten wijzen
    const tx = doel[0] - mx, tz = doel[1] - mz, T = Math.hypot(tx, tz) || 1;
    kijkt.push((nx * tx + nz * tz) / T > 0.05);
  }

  // de langste aaneengesloten reeks van die randen, gemeten in meters
  let besteStart = -1, besteLengte = 0, besteLen = 0;
  for (let i = 0; i < N; i++) {
    if (!kijkt[i]) continue;
    let n = 0, L = 0;
    while (n < N && kijkt[(i + n) % N]) { L += lengte[(i + n) % N]; n++; }
    if (L > besteLengte) { besteLengte = L; besteStart = i; besteLen = n; }
  }
  if (besteStart < 0 || besteLengte < 15) { console.warn(`LET OP: zuilengang ${p.id}: geen boog naar voorkantNaar gevonden`); continue; }

  const boog = [];
  for (let n = 0; n <= besteLen; n++) boog.push(ring[(besteStart + n) % N]);

  /*
   En per stuk boog de richting naar binnen, want daar ligt de pui. Die hoort
   hier te worden uitgerekend en niet in js/zuilengang.js: de punt-in-
   veelhoektoets staat hier al, en het hart van de omhullende rechthoek is bij
   een halvemaanvormig grondvlak juist géén goede maat voor "binnen" — dat punt
   ligt in de holte, aan dezelfde kant als het parkeerterrein. De eerste poging
   bouwde de pui daardoor 2,4 m de parkeerplaats in, vóór de zuilen langs.
  */
  const binnenNormaal = [];
  for (let i = 0; i < boog.length - 1; i++) {
    const a2 = boog[i], b2 = boog[i + 1];
    const dx = b2[0] - a2[0], dz = b2[1] - a2[1], L = Math.hypot(dx, dz) || 1;
    let nx = dz / L, nz = -dx / L;
    const mx = (a2[0] + b2[0]) / 2, mz = (a2[1] + b2[1]) / 2;
    if (!binnen(mx + nx * 0.4, mz + nz * 0.4)) { nx = -nx; nz = -nz; }   // naar binnen wijzen
    binnenNormaal.push([r2(nx), r2(nz)]);
  }

  /*
   Zuilen op gelijke afstand langs de boog. Eerst de booglengte per hoekpunt
   opmeten, dan op vaste stappen bemonsteren: zo valt er geen zuil dubbel op een
   knik in de boog, en de laatste komt precies op het eind te staan. Het aantal
   volgt uit de lengte, de afstand uit de foto.
  */
  const tussen = Z.tussen ?? 6.0;
  const langs = [0];
  for (let i = 1; i < boog.length; i++) {
    langs.push(langs[i - 1] + Math.hypot(boog[i][0] - boog[i - 1][0], boog[i][1] - boog[i - 1][1]));
  }
  const totaal = langs[langs.length - 1];
  const opAfstand = (s) => {
    let i = 1;
    while (i < langs.length - 1 && langs[i] < s) i++;
    const t = (s - langs[i - 1]) / Math.max(1e-6, langs[i] - langs[i - 1]);
    return [
      r2(boog[i - 1][0] + (boog[i][0] - boog[i - 1][0]) * t),
      r2(boog[i - 1][1] + (boog[i][1] - boog[i - 1][1]) * t),
    ];
  };
  const aantal = Math.max(2, Math.round(totaal / tussen));
  const zuilen = [];
  for (let k = 0; k <= aantal; k++) zuilen.push(opAfstand(totaal * k / aantal));

  ZUILENGANGEN.push({
    pand: p.id,
    hoogte: r2(Z.hoogte ?? p.goot ?? 3.9),
    straal: Z.straal ?? 0.2,
    diepte: Z.diepte ?? 2.4,
    // hangt er een winkelmerk boven de ingang? (de Poiesz wel, het blok ernaast niet)
    merk: !!Z.merk,
    boog: boog.map(a => [r2(a[0]), r2(a[1])]),
    binnen: binnenNormaal,
    zuilen,
  });
}
tel('zuilengangen', ZUILENGANGEN.length);

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
  hagen: HAGEN, bomen: BOMEN.concat(STRAATBOMEN, PARKBOMEN), struiken: STRUIKEN, lantaarns: LANTAARNS,
  heggen: HEGGEN, schuttingen: SCHUTTINGEN, paden: PADEN, tuinvlakken: TUINVLAKKEN, strepen: STREPEN, objecten: OBJECTEN,
  zuilengangen: ZUILENGANGEN,
  hekwerken: HEKWERKEN, poorten: POORTEN, viaducten: VIADUCTEN,
  sportvelden: SPORTVELDEN, volkstuinen: VOLKSTUINEN, molens: MOLENS, tankstations: TANKSTATIONS, tennisparken: TENNIS,
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
