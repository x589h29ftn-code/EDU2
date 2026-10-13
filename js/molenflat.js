/*
 De flats aan de Molenkrite (stap 163, BAG 0091100000006034 met de nummers 134–182 en 0091100000006042 met 184–232).
 Gevraagd met een schermafdruk en vier foto's uit Street View: "verbeter ook deze woningen: 399.9, -26.9 zie foto van
 straatkant." Het punt is waar de gebruiker stond, op de klinkers aan de westkant; de twee blokken liggen er 25 tot 60 m
 oostelijk van, langs de Molenkrite (Street View zegt "167 Molenkrite").

 In het spel stonden hier de 3D BAG-modellen met het doek van het naamloze `spil`-type: kale blokken van lichte baksteen
 zonder één raam. Zo zien ze er in het echt uit, en zo zijn ze hier gebouwd (de maten uit de 3D BAG, de rest uit de foto's):

   de vorm      elk blok is een molen van vier vleugels om een trappenhuis, in trappen van één, twee en drie lagen. De
                platte dakvlakken van de 3D BAG zijn de delen (`regios`): 3,1–3,4 m de bergingen, 6,1–6,3, 8,9–9,1 en
                11,7–11,9 m de woningen. Een deel heeft muren tot zijn goot en een mansardekap tot de hoogte uit de 3D BAG.
   de kap       aan de goot een brede witte rand die over de gevel steekt en schuin naar binnen loopt (`overstek`,
                `rand`), met een witte onderkant; daarboven een steil, donker, bemost dakschild tot een plat dak. De
                goot ligt `mansard` (boven 8,5 m) of `mansardLaag` onder de dakhoogte: in de 3D BAG staan op een paar
                plekken die schuine vlakken (6,0 → 9,1 m, 10,0 → 11,8 m, 4,4 → 6,1 m).
   de gevels    donker paarsbruine baksteen (`steenDoek`), ramen met blauwe kozijnen in paren, staand, met een lichte
                dorpel, en inpandige balkons (loggia's): een nis van 1,1 m met een deur en een raam achterin, een
                borstwering van baksteen of een metalen hek. Alles in echte gaten in de muur (`muur`), dus met diepte.
   de bergingen de lage delen met een plat dak, een blauwe boeiboord en een strook kleine raampjes eronder.
   de schoorstenen  van baksteen, uit het dak van de hoogste delen.

 Waar een deel tegen een hoger deel aan ligt, is die rand binnen (`binnen`): geen muur, geen kap, en het platte dak schuift
 een kwart meter onder de muur van het hogere deel. Een raam komt alleen waar het boven het dak van de buren uitkomt.

 js/kaartwereld.js slaat de geometrie van deze panden over en houdt hun botsdozen: deze module zet de pand-id's bij het
 laden in `EIGEN_PANDEN` van js/aaff.js, net als js/tennishal.js. Ook het trappenhuis in het midden (een eigen pand van
 11,4 m) bouwt deze module: baksteen, een raam per verdieping waar het vrij ligt, een blauwe band bovenaan.
 's Nachts brandt achter een derde van de ramen licht (`update(dt, nacht)`, alleen `emissiveIntensity`).
*/
import * as THREE from 'three';
import { EIGEN_PANDEN } from './aaff.js';
import { grondHoogte } from './viaduct.js';

export const MOLENFLAT = {
  panden: ['0091100000006034', '0091100000006042'],
  torens: ['0091100000014656', '0091100000006038'],   // de trappenhuizen in het midden (11,4 m, een eigen pand in de BAG)
  mansard: 2.6,        // boven 8,5 m: de goot (de witte rand) zo ver onder de dakhoogte uit de 3D BAG
  mansardLaag: 1.9,    // tussen 5,5 en 8,5 m
  berging: 4.5,        // lager: een berging met een plat dak en een blauwe boeiboord
  overstek: 0.7,       // de onderkant van de witte rand steekt zo ver over de gevel
  rand: 1.0,           // de hoogte van de witte rand
  randBoven: 0.3,      // de bovenkant van de rand ligt nog zo ver buiten de gevel (hij loopt schuin naar binnen)
  steil: 0.6,          // het donkere dakschild: zoveel meter naar binnen per meter omhoog
  verdieping: 2.85,    // ongeveer de hoogte van een laag (het aantal lagen is de goot gedeeld hierdoor, afgerond)
  loggiaDiep: 1.1,
  lichtNacht: 0.85,    // de gloed van de verlichte ramen 's nachts
  kozijn: 0x2456b8,    // het blauw van de kozijnen
};
for (const id of [...MOLENFLAT.panden, ...MOLENFLAT.torens]) EIGEN_PANDEN.add(id);

// ------------------------------------------------------------------ doeken
const doek = (b, h, teken) => {
  const c = document.createElement('canvas'); c.width = b; c.height = h;
  teken(c.getContext('2d'), b, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};
let zaad = 163;
const ruis = () => { zaad = (zaad * 16807) % 2147483647; return zaad / 2147483647; };
/*
 Donker paarsbruine baksteen in halfsteensverband: een tegel van 1,32 × 1,30 m (zes stenen van 22 cm met de voeg, twintig
 lagen van 6,5 cm), 256 × 256 beeldpunten. De voeg is grijs en net zo donker als op de foto's.
*/
export const STEEN_TEGEL = [1.32, 1.30];
export function steenDoek() {
  return doek(256, 256, (g, b, h) => {
    g.fillStyle = '#7a706a'; g.fillRect(0, 0, b, h);
    const rijen = 20, rh = h / rijen, sb = b / 6, voeg = 2;
    for (let r = 0; r < rijen; r++) {
      const y = r * rh, off = r % 2 ? sb / 2 : 0;
      for (let k = -1; k < 7; k++) {
        const x = k * sb + off, f = ruis() < 0.12 ? 0.75 + ruis() * 0.5 : 0.9 + ruis() * 0.2;
        const rr = Math.round(116 * f), gg = Math.round(78 * f), bb = Math.round(66 * f);
        g.fillStyle = `rgb(${rr},${gg},${bb})`; g.fillRect(Math.round(x), Math.round(y), Math.round(sb - voeg), Math.round(rh - voeg));
        g.fillStyle = `rgba(0,0,0,${0.05 + ruis() * 0.12})`; g.fillRect(Math.round(x + ruis() * sb * 0.6), Math.round(y + 1), Math.round(sb * 0.35), Math.round(rh * 0.5));
        g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(Math.round(x), Math.round(y), Math.round(sb - voeg), 1);
      }
    }
    for (let i = 0; i < 1500; i++) { const c = 60 + ruis() * 60; g.fillStyle = `rgba(${c},${c - 10},${c - 10},0.12)`; g.fillRect(ruis() * b, ruis() * h, 1 + ruis() * 2, 1); }
  });
}
/*
 Het dakschild: donkere leien of shingles, groen bemost en met strepen naar beneden (een tegel van 2 × 2 m). Op de foto's
 is de kap bijna zwart met een groene waas.
*/
export function dakDoek() {
  return doek(256, 256, (g, b, h) => {
    g.fillStyle = '#3a3d37'; g.fillRect(0, 0, b, h);
    const rij = h / 10;
    for (let r = 0; r < 10; r++) {
      const off = r % 2 ? 16 : 0;
      for (let k = -1; k < 9; k++) {
        const c = 50 + ruis() * 18;
        g.fillStyle = `rgb(${c},${c + 4},${c - 2})`; g.fillRect(k * 32 + off + 1, r * rij + 1, 30, rij - 2);
      }
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, r * rij, b, 2);
    }
    for (let i = 0; i < 70; i++) {     // mos en strepen van het regenwater
      const x = ruis() * b, w = 2 + ruis() * 6;
      g.fillStyle = ruis() < 0.6 ? `rgba(92,110,64,${0.12 + ruis() * 0.2})` : `rgba(20,22,20,${0.15 + ruis() * 0.2})`;
      g.fillRect(x, 0, w, h);
    }
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${100 + ruis() * 60},${120 + ruis() * 50},${70 + ruis() * 40},0.18)`; g.fillRect(ruis() * b, ruis() * h, 2, 2); }
  });
}

// ------------------------------------------------------------------ meetkunde in het vlak
const binnenVeelhoek = (x, z, v) => { let c = false; for (let i = 0, j = v.length - 1; i < v.length; j = i++) { const a = v[i], b = v[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
const oppervlak = (v) => { let s = 0; for (let i = 0; i < v.length; i++) { const a = v[i], b = v[(i + 1) % v.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
const lijnAfst = (q, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return Math.abs((q[0] - a[0]) * dz - (q[1] - a[1]) * dx) / l; };
// punten die dubbel staan of op een rechte lijn liggen eruit (de 3D BAG heeft hoekjes van een paar centimeter)
export function vereenvoudig(r) {
  const a = r.slice();
  for (let weer = true; weer && a.length > 3;) {
    weer = false;
    for (let i = 0; i < a.length && a.length > 3; i++) {
      const n = a.length, p = a[(i - 1 + n) % n], q = a[i], s = a[(i + 1) % n];
      if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.3 || lijnAfst(q, p, s) < 0.12) { a.splice(i, 1); weer = true; break; }
    }
  }
  return a;
}
/*
 De ring verschoven per rand: `d[i]` is hoe ver rand i (van punt i naar i + 1) naar binnen schuift (negatief: naar buiten).
 Elk nieuw punt is het snijpunt van de twee verschoven randen; liggen die bijna in elkaars verlengde, dan het gemiddelde.
*/
export function verschuif(ring, buiten, d) {
  const n = ring.length, uit = [];
  for (let j = 0; j < n; j++) {
    const i = (j - 1 + n) % n;
    const n1 = [-buiten[i][0], -buiten[i][1]], n2 = [-buiten[j][0], -buiten[j][1]];
    const c1 = ring[i][0] * n1[0] + ring[i][1] * n1[1] + d[i], c2 = ring[j][0] * n2[0] + ring[j][1] * n2[1] + d[j];
    const det = n1[0] * n2[1] - n1[1] * n2[0];
    let p;
    if (Math.abs(det) < 0.08) p = [ring[j][0] + (n1[0] * d[i] + n2[0] * d[j]) / 2, ring[j][1] + (n1[1] * d[i] + n2[1] * d[j]) / 2];
    else p = [(c1 * n2[1] - n1[1] * c2) / det, (n1[0] * c2 - c1 * n2[0]) / det];
    const m = Math.max(Math.abs(d[i]), Math.abs(d[j]));
    if (Math.hypot(p[0] - ring[j][0], p[1] - ring[j][1]) > 3 * m + 0.01) p = [ring[j][0] + (n1[0] * d[i] + n2[0] * d[j]) / 2, ring[j][1] + (n1[1] * d[i] + n2[1] * d[j]) / 2];
    uit.push(p);
  }
  return uit;
}
const snijdtZelf = (v) => {
  const n = v.length, kruis = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue;
    const a = v[i], b = v[(i + 1) % n], c = v[j], e = v[(j + 1) % n];
    if (kruis(a, b, c) * kruis(a, b, e) < 0 && kruis(c, e, a) * kruis(c, e, b) < 0) return true;
  }
  return false;
};

/** De platte dakvlakken van de 3D BAG als delen: `{ H, ring }`, H boven het maaiveld, de ring tegen de klok in (x, z). */
export function regios(p) {
  const V = [];
  for (let i = 0; i < p.v.length; i += 3) V.push([p.v[i], p.v[i + 1], p.v[i + 2]]);
  const uit = [];
  p.f.forEach((ringen, i) => {
    if (p.s[i] !== 2) return;
    const r = ringen[0].map(k => V[k]), ys = r.map(q => q[1]);
    if (Math.max(...ys) - Math.min(...ys) > 0.35) return;     // een schuin vlak: de kap bouwen we zelf
    let ring = vereenvoudig(r.map(q => [q[0], q[2]]));
    if (ring.length < 3 || Math.abs(oppervlak(ring)) < 3) return;
    if (oppervlak(ring) < 0) ring = ring.reverse();
    uit.push({ H: ys.reduce((s, y) => s + y, 0) / ys.length, ring });
  });
  return uit;
}

// ------------------------------------------------------------------ bouwen
/**
 * Bouwt de twee flats. Geeft `{ groep, panden, ramen, materialen, update(dt, nacht) }` terug, of null als de panden niet
 * in de kaart staan.
 */
export function bouwMolenflats(scene, K) {
  const panden = MOLENFLAT.panden.map(id => (K.panden || []).find(q => q.id === id)).filter(p => p && p.v && p.f);
  const torenPanden = MOLENFLAT.torens.map(id => (K.panden || []).find(q => q.id === id)).filter(Boolean);
  if (!panden.length) return null;
  const C = MOLENFLAT;
  const MAT = {
    steen: new THREE.MeshStandardMaterial({ map: steenDoek(), roughness: 0.9 }),
    rand: new THREE.MeshStandardMaterial({ color: 0xe8e9e5, roughness: 0.6 }),
    // de onderkant van de rand: van onderen kleurt het licht van het gras hem groen; iets rozig en overdag een grijze gloed
    // erbij (alleen `emissiveIntensity`, in `update`), dan is hij wit in de schaduw zoals op de foto's
    onderrand: new THREE.MeshStandardMaterial({ color: 0xcdb9c8, roughness: 0.7, emissive: 0x3a3a3a, emissiveIntensity: 1 }),
    dak: new THREE.MeshStandardMaterial({ map: dakDoek(), roughness: 0.92 }),
    platdak: new THREE.MeshStandardMaterial({ color: 0x4b4c49, roughness: 0.95 }),
    kozijn: new THREE.MeshStandardMaterial({ color: C.kozijn, roughness: 0.45 }),
    glas: new THREE.MeshStandardMaterial({ color: 0x506476, roughness: 0.2, metalness: 0.15, emissive: 0xffcf8a, emissiveIntensity: 0 }),
    glasLicht: new THREE.MeshStandardMaterial({ color: 0x506476, roughness: 0.2, metalness: 0.15, emissive: 0xffcf8a, emissiveIntensity: 0 }),
    dorpel: new THREE.MeshStandardMaterial({ color: 0xcfd0cb, roughness: 0.6 }),
    beton: new THREE.MeshStandardMaterial({ color: 0xb9b8b2, roughness: 0.85 }),
    hek: new THREE.MeshStandardMaterial({ color: 0x5c6166, roughness: 0.5, metalness: 0.5 }),
    blauw: new THREE.MeshStandardMaterial({ color: 0x1f4fb8, roughness: 0.5 }),
  };
  MAT.steen.map.repeat.set(1 / STEEN_TEGEL[0], 1 / STEEN_TEGEL[1]);
  MAT.dak.map.repeat.set(0.5, 0.5);

  // per materiaal één geometrie; een veelhoek in wereldcoördinaten met de richting waar hij heen kijkt
  const bak = new Map();
  const veelhoek = (mat, P, N, UV = null) => {
    if (P.length < 3) return;
    if (!bak.has(mat)) bak.set(mat, { pos: [], uv: [] });
    const g = bak.get(mat);
    const nw = new THREE.Vector3();
    for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; nw.x += (a.y - b.y) * (a.z + b.z); nw.y += (a.z - b.z) * (a.x + b.x); nw.z += (a.x - b.x) * (a.y + b.y); }
    if (nw.dot(N) < 0) { P = P.slice().reverse(); if (UV) UV = UV.slice().reverse(); }
    if (!UV) {
      const Nh = new THREE.Vector3(N.x, 0, N.z);
      if (Nh.length() > 0.5) { const T = new THREE.Vector3(Nh.z, 0, -Nh.x).normalize(); UV = P.map(q => [q.x * T.x + q.z * T.z, q.y]); }
      else UV = P.map(q => [q.x, q.z]);
    }
    for (let i = 1; i < P.length - 1; i++) for (const k of [0, i, i + 1]) { g.pos.push(P[k].x, P[k].y, P[k].z); g.uv.push(UV[k][0], UV[k][1]); }
  };
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

  // een rand als assenstelsel: s langs de rand, y omhoog, d naar buiten
  const stelsel = (A, B, o) => {
    const l = Math.hypot(B[0] - A[0], B[1] - A[1]), t = [(B[0] - A[0]) / l, (B[1] - A[1]) / l];
    const P = (s, y, d) => V3(A[0] + t[0] * s + o[0] * d, y, A[1] + t[1] * s + o[1] * d);
    const N = (ns, ny, nd) => V3(t[0] * ns + o[0] * nd, ny, t[1] * ns + o[1] * nd);
    return { A, B, l, t, o, P, N };
  };
  const vlakK = (mat, F, pts, n) => veelhoek(mat, pts.map(q => F.P(q[0], q[1], q[2])), F.N(n[0], n[1], n[2]));
  const vlak = vlakK;
  // een doos in het stelsel; kanten: v(oor, d1) a(chter, d0) l(inks, s0) r(echts, s1) b(oven) o(nder)
  // (`keer`: de doos is een gat, de vlakken kijken naar binnen)
  const kist = (mat, F, s0, s1, y0, y1, d0, d1, kanten = 'valrbo', keer = false) => {
    const k = keer ? -1 : 1, vlak = (m, F2, pts, n) => vlakK(m, F2, pts, [n[0] * k, n[1] * k, n[2] * k]);
    if (kanten.includes('v')) vlak(mat, F, [[s0, y0, d1], [s1, y0, d1], [s1, y1, d1], [s0, y1, d1]], [0, 0, 1]);
    if (kanten.includes('a')) vlak(mat, F, [[s0, y0, d0], [s1, y0, d0], [s1, y1, d0], [s0, y1, d0]], [0, 0, -1]);
    if (kanten.includes('l')) vlak(mat, F, [[s0, y0, d0], [s0, y0, d1], [s0, y1, d1], [s0, y1, d0]], [-1, 0, 0]);
    if (kanten.includes('r')) vlak(mat, F, [[s1, y0, d0], [s1, y0, d1], [s1, y1, d1], [s1, y1, d0]], [1, 0, 0]);
    if (kanten.includes('b')) vlak(mat, F, [[s0, y1, d0], [s1, y1, d0], [s1, y1, d1], [s0, y1, d1]], [0, 1, 0]);
    if (kanten.includes('o')) vlak(mat, F, [[s0, y0, d0], [s1, y0, d0], [s1, y0, d1], [s0, y0, d1]], [0, -1, 0]);
  };
  // een muur van s = a tot b op diepte d met rechthoekige gaten ({ s0, s1, y0, y1 }); de gaten mogen elkaar niet overlappen
  const muur = (F, a, b, y0, y1, gaten, d = 0) => {
    const S = new Set([a, b]);
    for (const g of gaten) { S.add(Math.max(a, Math.min(b, g.s0))); S.add(Math.max(a, Math.min(b, g.s1))); }
    const xs = [...S].sort((p, q) => p - q);
    for (let k = 0; k < xs.length - 1; k++) {
      const s0 = xs[k], s1 = xs[k + 1];
      if (s1 - s0 < 1e-3) continue;
      const m = (s0 + s1) / 2, hier = gaten.filter(g => g.s0 < m && g.s1 > m).sort((p, q) => p.y0 - q.y0);
      let y = y0;
      for (const g of hier) { if (g.y0 > y + 1e-3) vlak(MAT.steen, F, [[s0, y, d], [s1, y, d], [s1, g.y0, d], [s0, g.y0, d]], [0, 0, 1]); y = Math.max(y, g.y1); }
      if (y1 > y + 1e-3) vlak(MAT.steen, F, [[s0, y, d], [s1, y, d], [s1, y1, d], [s0, y1, d]], [0, 0, 1]);
    }
  };
  const ramen = [], loggias = [];
  let raamNr = 0;
  // een raam (of deur) in een gat: de dagkanten, het glas wat naar binnen, het blauwe kozijn eromheen en een dorpel
  const raam = (F, g, d = 0, { deur = false, kozijn = MAT.kozijn, dorpel = true } = {}) => {
    const { s0, s1, y0, y1 } = g, R = 0.13, k = deur ? 0.08 : 0.075;
    kist(MAT.steen, F, s0, s1, y0, y1, d - R, d, 'lrb', true);  // de dagkanten (binnenkant van het gat)
    vlak(MAT.dorpel, F, [[s0, y0, d - R], [s1, y0, d - R], [s1, y0, d], [s0, y0, d]], [0, 1, 0]);
    const licht = !deur && ((raamNr * 7 + 3) % 10) < 3;
    raamNr++;
    vlak(licht ? MAT.glasLicht : MAT.glas, F, [[s0, y0, d - 0.1], [s1, y0, d - 0.1], [s1, y1, d - 0.1], [s0, y1, d - 0.1]], [0, 0, 1]);
    const dv = d - 0.1, dk = d - 0.045;
    kist(kozijn, F, s0, s0 + k, y0, y1, dv, dk, 'vr');
    kist(kozijn, F, s1 - k, s1, y0, y1, dv, dk, 'vl');
    kist(kozijn, F, s0 + k, s1 - k, y1 - k, y1, dv, dk, 'vo');
    kist(kozijn, F, s0 + k, s1 - k, y0, y0 + k, dv, dk, 'vb');
    if (deur) kist(kozijn, F, s0 + k, s1 - k, y0 + 0.95, y0 + 1.02, dv, dk, 'vbo');     // de regel in de deur
    if (dorpel && !deur) kist(MAT.dorpel, F, s0 - 0.05, s1 + 0.05, y0 - 0.07, y0, d - 0.02, d + 0.07, 'vblro');
    ramen.push({ midden: F.P((s0 + s1) / 2, (y0 + y1) / 2, d - 0.1), naar: F.N(0, 0, 1), licht, deur, gevel: d === 0, strook: kozijn !== MAT.kozijn });
  };
  // een loggia in een gat: de nis, de deur en het raam achterin, de borstwering
  const loggia = (F, g, hek) => {
    const { s0, s1, y0, y1 } = g, D = C.loggiaDiep;
    loggias.push({ midden: F.P((s0 + s1) / 2, y0 + 1.6, 0), naar: F.N(0, 0, 1), breed: s1 - s0, hoog: y1 - y0, hek: !!hek });
    kist(MAT.steen, F, s0, s1, y0, y1, -D, 0, 'lr', true);       // de zijwanden, naar de nis toe
    vlak(MAT.beton, F, [[s0, y1, -D], [s1, y1, -D], [s1, y1, 0], [s0, y1, 0]], [0, -1, 0]);
    vlak(MAT.beton, F, [[s0, y0, -D], [s1, y0, -D], [s1, y0, 0], [s0, y0, 0]], [0, 1, 0]);
    // achterin: een deur en een raam, in een muur met gaten
    const gaten = [], hoog = Math.min(2.2, y1 - y0 - 0.15);
    gaten.push({ s0: s0 + 0.25, s1: s0 + 1.15, y0, y1: y0 + hoog, deur: true });
    if (s1 - s0 > 2.2) gaten.push({ s0: s0 + 1.45, s1: s1 - 0.25, y0: y0 + 0.85, y1: y0 + hoog });
    muur(F, s0, s1, y0, y1, gaten, -D);
    for (const q of gaten) raam(F, q, -D, { deur: !!q.deur, dorpel: false });
    // de borstwering
    if (!hek) kist(MAT.steen, F, s0, s1, y0, y0 + 1.0, -0.22, 0, 'vab');
    else {
      kist(MAT.steen, F, s0, s1, y0, y0 + 0.12, -0.2, 0, 'vb');
      kist(MAT.hek, F, s0, s1, y0 + 0.97, y0 + 1.03, -0.08, -0.02, 'vabo');
      kist(MAT.hek, F, s0, s1, y0 + 0.16, y0 + 0.2, -0.07, -0.03, 'vb');
      for (let s = s0 + 0.08; s < s1 - 0.05; s += 0.13) kist(MAT.hek, F, s - 0.01, s + 0.01, y0 + 0.12, y0 + 0.97, -0.06, -0.04, 'vlr');
    }
  };

  const gebouwd = [];
  for (const p of panden) {
    const R = regios(p);
    const cx = p.voet.reduce((s, q) => s + q[0], 0) / p.voet.length, cz = p.voet.reduce((s, q) => s + q[1], 0) / p.voet.length;
    const g0 = grondHoogte(cx, cz, -Infinity), yb = g0 - 0.3;
    // de hoogte van het hoogste deel op (x, z), behalve deel `niet`
    const hoogteBij = (x, z, niet) => { let h = 0; for (const r of R) if (r !== niet && binnenVeelhoek(x, z, r.ring)) h = Math.max(h, r.H); return h; };
    for (const r of R) {
      r.berging = r.H < C.berging;
      r.Hw = r.berging ? r.H : r.H - (r.H >= 8.5 ? C.mansard : C.mansardLaag);
      r.lagen = r.berging ? 1 : Math.max(1, Math.round(r.Hw / C.verdieping));
      r.randen = r.ring.map((A, i) => {
        const B = r.ring[(i + 1) % r.ring.length], l = Math.hypot(B[0] - A[0], B[1] - A[1]);
        let o = [(B[1] - A[1]) / l, -(B[0] - A[0]) / l];
        if (binnenVeelhoek((A[0] + B[0]) / 2 + o[0] * 0.05, (A[1] + B[1]) / 2 + o[1] * 0.05, r.ring)) o = [-o[0], -o[1]];
        // binnen: overal langs de rand ligt een deel dat minstens even hoog is
        const hn = [0.2, 0.5, 0.8].map(f => hoogteBij(A[0] + (B[0] - A[0]) * f + o[0] * 0.35, A[1] + (B[1] - A[1]) * f + o[1] * 0.35, r));
        return { A, B, l, o, binnen: hn.every(h => h >= r.H - 0.3), buur: Math.max(...hn) };
      });
    }
    for (const r of R) {
      const n = r.ring.length, Hw = g0 + r.Hw, H = g0 + r.H, buitenN = r.randen.map(e => e.o);
      const op = (d) => r.randen.map(e => e.binnen ? -0.25 : d);
      // ---- het dak: de witte rand, het dakschild en het platte dak (een berging: de blauwe boeiboord)
      let top;
      if (r.berging) {
        const R0 = verschuif(r.ring, buitenN, op(0)), R1 = verschuif(r.ring, buitenN, op(-0.15));
        for (let i = 0; i < n; i++) {
          if (r.randen[i].binnen) continue;
          const j = (i + 1) % n, o = r.randen[i].o, N = V3(o[0], 0, o[1]);
          veelhoek(MAT.blauw, [V3(R1[i][0], H - 0.55, R1[i][1]), V3(R1[j][0], H - 0.55, R1[j][1]), V3(R1[j][0], H + 0.08, R1[j][1]), V3(R1[i][0], H + 0.08, R1[i][1])], N);
          veelhoek(MAT.blauw, [V3(R0[i][0], H - 0.55, R0[i][1]), V3(R0[j][0], H - 0.55, R0[j][1]), V3(R1[j][0], H - 0.55, R1[j][1]), V3(R1[i][0], H - 0.55, R1[i][1])], V3(0, -1, 0));
          veelhoek(MAT.blauw, [V3(R0[i][0], H + 0.08, R0[i][1]), V3(R0[j][0], H + 0.08, R0[j][1]), V3(R1[j][0], H + 0.08, R1[j][1]), V3(R1[i][0], H + 0.08, R1[i][1])], V3(0, 1, 0));
          veelhoek(MAT.blauw, [V3(R0[i][0], H, R0[i][1]), V3(R0[j][0], H, R0[j][1]), V3(R0[j][0], H + 0.08, R0[j][1]), V3(R0[i][0], H + 0.08, R0[i][1])], V3(-o[0], 0, -o[1]));
        }
        top = R0;
      } else {
        const R0 = verschuif(r.ring, buitenN, op(0)), RA = verschuif(r.ring, buitenN, op(-C.overstek)), RB = verschuif(r.ring, buitenN, op(-C.randBoven));
        let inzet = (r.H - r.Hw - C.rand) * C.steil, RT;
        for (let poging = 0; poging < 4; poging++) {
          RT = verschuif(r.ring, buitenN, op(inzet));
          const a = oppervlak(RT);
          if (a > 0.2 * oppervlak(r.ring) && !snijdtZelf(RT)) break;
          inzet = poging < 2 ? inzet / 2 : 0;
        }
        r.inzet = inzet;
        const yR = Hw + C.rand;
        for (let i = 0; i < n; i++) {
          if (r.randen[i].binnen) continue;
          const j = (i + 1) % n, o = r.randen[i].o;
          const p3 = (q, y) => V3(q[0], y, q[1]);
          veelhoek(MAT.onderrand, [p3(R0[i], Hw), p3(R0[j], Hw), p3(RA[j], Hw), p3(RA[i], Hw)], V3(0, -1, 0));
          const lr = Math.hypot(RA[j][0] - RA[i][0], RA[j][1] - RA[i][1]);
          veelhoek(MAT.rand, [p3(RA[i], Hw), p3(RA[j], Hw), p3(RB[j], yR), p3(RB[i], yR)], V3(o[0], 0.4, o[1]));
          // de dakrand loopt ook aan de achterkant dicht (vanaf het dak van een lager deel zie je er soms achter)
          veelhoek(MAT.dak, [p3(RB[i], yR), p3(RB[j], yR), p3(RT[j], H), p3(RT[i], H)], V3(o[0], 1 / C.steil * 0.6, o[1]),
            [[0, 0], [lr, 0], [lr, Math.hypot(H - yR, inzet + C.randBoven)], [0, Math.hypot(H - yR, inzet + C.randBoven)]]);
        }
        top = RT;
      }
      const drie = THREE.ShapeUtils.triangulateShape(top.map(q => new THREE.Vector2(q[0], q[1])), []);
      for (const t of drie) veelhoek(MAT.platdak, t.map(k => V3(top[k][0], H, top[k][1])), V3(0, 1, 0));
      r.top = top;

      // ---- de gevels
      const fh = r.Hw / r.lagen;
      r.randen.forEach((e, i) => {
        if (e.binnen) return;
        const F = stelsel(e.A, e.B, e.o), l = e.l;
        const yTop = r.berging ? H - 0.55 : Hw;
        const buurOp = (s) => hoogteBij(F.P(s, 0, 0.35).x, F.P(s, 0, 0.35).z, r);
        const gaten = [];
        if (r.berging) {
          // een strook kleine raampjes onder de boeiboord, op de lange randen
          if (l >= 4) {
            const nr = Math.floor((l - 1.0) / 0.8);
            const s0 = (l - nr * 0.8) / 2;
            for (let k = 0; k < nr; k++) {
              const s = s0 + k * 0.8 + 0.12;
              if (buurOp(s + 0.28) > 0.1) continue;
              gaten.push({ s0: s, s1: s + 0.56, y0: H - 1.05, y1: H - 0.72, soort: 'strook' });
            }
          }
        } else if (l >= 1.6) {
          const vrij = l - 0.8, nb = Math.floor(vrij / 3.0);
          const kolommen = [];
          if (nb === 0) kolommen.push({ s: l / 2, soort: 'een' });
          else {
            const bw = vrij / nb;
            for (let j = 0; j < nb; j++) {
              const s = 0.4 + bw * (j + 0.5), lw = Math.min(2.7, bw - 0.4);
              const kan = fh <= 3.4 && l >= 5.5 && bw >= 2.9 && s - lw / 2 >= 0.45 && s + lw / 2 <= l - 0.45;
              kolommen.push({ s, soort: kan && ((j + i) % 2 === 0) ? 'loggia' : (bw >= 2.3 ? 'paar' : 'een'), lw, hek: (i + j) % 3 === 0 });
            }
          }
          for (let k = 0; k < r.lagen; k++) {
            const yk = g0 + k * fh, hw = Math.min(1.45, fh - 1.3), sill = yk + Math.max(0.85, (fh - hw) * 0.55);
            for (const kol of kolommen) {
              if (kol.soort === 'loggia') {
                const y0 = yk + (k === 0 ? 0.15 : 0.05), y1 = yk + fh - 0.3;
                const bu = buurOp(kol.s);
                if ((bu > 0.05 && y0 < g0 + bu + 0.2) || y1 - y0 < 2.2) continue;
                gaten.push({ s0: kol.s - kol.lw / 2, s1: kol.s + kol.lw / 2, y0, y1, soort: 'loggia', hek: kol.hek });
              } else {
                const ws = kol.soort === 'paar' ? [kol.s - 1.0, kol.s + 0.25] : [kol.s - 0.375];
                for (const s of ws) {
                  const bu = buurOp(s + 0.375);
                  if ((bu > 0.05 && sill < g0 + bu + 0.3) || hw < 0.8) continue;
                  gaten.push({ s0: s, s1: s + 0.75, y0: sill, y1: sill + hw, soort: 'raam' });
                }
              }
            }
          }
        }
        muur(F, 0, l, yb, yTop, gaten);
        for (const q of gaten) {
          if (q.soort === 'loggia') loggia(F, q, q.hek);
          else raam(F, q, 0, q.soort === 'strook' ? { kozijn: MAT.rand } : {});
        }
        e.gaten = gaten;
      });
    }
    // ---- schoorstenen: uit het dak van de hoogste delen, bij het midden van hun langste buitenrand
    const hoogste = R.filter(r => !r.berging).sort((a, b) => b.H - a.H).slice(0, 2);
    const schoorstenen = [];
    for (const r of hoogste) {
      const e = r.randen.filter(q => !q.binnen).sort((a, b) => b.l - a.l)[0];
      if (!e) continue;
      const F = stelsel(e.A, e.B, e.o), d = -(r.inzet || 0) - 0.55, y0 = g0 + r.H - 1.2, y1 = g0 + r.H + 1.4;
      kist(MAT.steen, F, e.l / 2 - 0.45, e.l / 2 + 0.45, y0, y1, d - 0.35, d + 0.35, 'valrb');
      kist(MAT.platdak, F, e.l / 2 - 0.55, e.l / 2 + 0.55, y1, y1 + 0.1, d - 0.45, d + 0.45, 'valrbo');
      schoorstenen.push({ punt: F.P(e.l / 2, y1, d), H: r.H });
    }
    // ---- het trappenhuis: een toren van baksteen met een blauwe band bovenaan en een raam per verdieping
    const torens = [];
    for (const t of torenPanden) {
      const tx = t.voet.reduce((a, q) => a + q[0], 0) / t.voet.length, tz = t.voet.reduce((a, q) => a + q[1], 0) / t.voet.length;
      // (de voetafdruk van het blok heeft een gat waar het trappenhuis staat: het dichtstbijzijnde blok)
      if (Math.hypot(tx - cx, tz - cz) > 15) continue;
      let ring = vereenvoudig(t.voet);
      if (oppervlak(ring) < 0) ring = ring.slice().reverse();
      const Ht = g0 + (t.goot || 11.4), n = ring.length;
      for (let i = 0; i < n; i++) {
        const A = ring[i], B = ring[(i + 1) % n], l = Math.hypot(B[0] - A[0], B[1] - A[1]);
        let o = [(B[1] - A[1]) / l, -(B[0] - A[0]) / l];
        if (binnenVeelhoek((A[0] + B[0]) / 2 + o[0] * 0.05, (A[1] + B[1]) / 2 + o[1] * 0.05, ring)) o = [-o[0], -o[1]];
        const F = stelsel(A, B, o), gaten = [];
        const buur = hoogteBij(F.P(l / 2, 0, 0.35).x, F.P(l / 2, 0, 0.35).z, null);
        for (let k = 0; k < 4; k++) {
          const y0 = g0 + k * C.verdieping + 0.9;
          if (l >= 2.4 && y0 > g0 + buur + 0.3 && y0 + 1.3 < Ht - 0.9) gaten.push({ s0: l / 2 - 0.35, s1: l / 2 + 0.35, y0, y1: y0 + 1.3 });
        }
        muur(F, 0, l, yb, Ht - 0.7, gaten);
        for (const q of gaten) raam(F, q);
        kist(MAT.blauw, F, 0, l, Ht - 0.7, Ht, -0.02, 0.06, 'vb');
      }
      const drie = THREE.ShapeUtils.triangulateShape(ring.map(q => new THREE.Vector2(q[0], q[1])), []);
      for (const tr of drie) veelhoek(MAT.platdak, tr.map(k => V3(ring[k][0], Ht - 0.05, ring[k][1])), V3(0, 1, 0));
      torens.push({ id: t.id, H: Ht - g0, voet: t.voet });
    }
    gebouwd.push({ id: p.id, nr: p.nr, regios: R, grond: g0, schoorstenen, torens, voet: p.voet });
  }

  // ---- in elkaar zetten
  const groep = new THREE.Group();
  groep.name = 'molenflat';
  for (const [mat, g] of bak) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true; m.receiveShadow = true;
    m.name = Object.keys(MAT).find(k => MAT[k] === mat) || 'molenflat';
    m.userData.klasse = 'molenflat';
    groep.add(m);
  }
  scene.add(groep);
  let gloed = 0;
  const api = {
    groep, panden: gebouwd, ramen, loggias, materialen: MAT,
    /** 's nachts gaat achter een derde van de ramen het licht aan (alleen `emissiveIntensity`, dus geen nieuw programma). */
    update(dt, nacht) {
      const doel = nacht ? C.lichtNacht : 0;
      gloed += (doel - gloed) * Math.min(1, dt * 1.5);
      if (Math.abs(gloed - doel) < 0.01) gloed = doel;
      MAT.glasLicht.emissiveIntensity = gloed;
      MAT.onderrand.emissiveIntensity = 1 - gloed / C.lichtNacht;
    },
    get gloed() { return gloed; },
  };
  MOLENFLAT_PAND.nu = api;
  return api;
}
// het gebouwde pand, voor js/main.js en de proeven
export const MOLENFLAT_PAND = { nu: null };
