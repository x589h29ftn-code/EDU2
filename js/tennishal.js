/*
 Tennishal Sneek aan de Lemmerweg 130a (stap 162, BAG 0091100000013880). Gevraagd met een schermafdruk en foto's:
 "herbouw ook 597.5, 158.2 zie foto. Is Tennishal Sneek." Het punt is waar de gebruiker stond, op het gras voor de
 entree; het pand zelf ligt er tien meter oostelijk van, ten westen van BP Slump Oil.

 In het spel stond hier het 3D BAG-model met het doek van het type `sudwester`: een groen spiegelend blok. Zo ziet het
 er in het echt uit, en zo is het hier gebouwd (de maten uit de 3D BAG, de indeling uit de foto's):

   de hal       een lange sporthal (67 × 39 m) met een laag zadeldak, de nok over de lengte (goot 6,3 m, nok 12,2 m uit de
                3D BAG). Dak van lichtgrijze golfplaten (`golfDoek`, ribbels in meters), gevels van lichtgrijze verticale
                sandwichpanelen met een naad om de 1,2 m en een stijl om de 3,6 m (`paneelDoek`).
   het patroon  grote donkere diagonalen als grafisch motief: op de lange gevels twee kruisen en lange schuine lijnen,
                op de puntgevels donkergrijze vlakken met schuine lijnen erdoorheen. Geen doek maar losse stroken een paar
                centimeter voor de gevel, uitgeknipt op de gevel (`knip`), dus scherp op elke afstand.
   de plint     langs de zuidgevel een zwarte strook van 2,6 m (in de BAG een smalle aanbouw), met staanders ervoor.
   de aanbouw   aan de westkant laag en wit (geschilderd metselwerk, plat dak, 4,0 en 3,45 m uit de BAG), met de entree
                op de westgevel: een blauwe luifel, een glazen deur, een donkergrijs vlak en het bord.
   de borden    "tennishal SNEEK" wit met blauw, met www.tennishalsneek.nl, op canvas (`tekenBord`), op de lange gevel
                en naast de entree.

 js/kaartwereld.js slaat de geometrie van dit pand over en houdt zijn botsdozen: deze module zet het pand-id bij het
 laden in `EIGEN_PANDEN` van js/aaff.js (dezelfde set als het kantoor aan het water), zodat kaartwereld alleen een import
 en één aanroep nodig heeft. Het assenstelsel: `u` langs de nok (naar het oosten, 0 aan de westgevel van de hal), `w`
 dwars erop (0 aan de noordgevel, naar het zuiden), `y` omhoog.
*/
import * as THREE from 'three';
import { EIGEN_PANDEN } from './aaff.js';
import { grondHoogte } from './viaduct.js';

export const TENNISHAL = {
  pand: '0091100000013880',
  plint: 2.6,          // de zwarte strook langs de zuidgevel (de foto's; de BAG zegt 3,5 voor die strook)
  aanbouwNoord: 4.0,   // de witte aanbouw: het noordelijke deel (3D BAG 3,9–4,1)
  aanbouwZuid: 3.45,   // en het zuidelijke deel met de entree (3D BAG 3,4–3,5)
  splitsing: [617.54, 150.69],   // waar die twee delen elkaar raken (een hoekpunt in de 3D BAG)
  overstek: 0.35,      // het dak steekt zo ver over de gevels
  streep: 0.85,        // de breedte van de donkere diagonalen
};
EIGEN_PANDEN.add(TENNISHAL.pand);

// ------------------------------------------------------------------ doeken
const doek = (b, h, teken) => {
  const c = document.createElement('canvas'); c.width = b; c.height = h;
  teken(c.getContext('2d'), b, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};
let zaad = 162;
const ruis = () => { zaad = (zaad * 16807) % 2147483647; return zaad / 2147483647; };
// lichtgrijze sandwichpanelen: een tegel van 3,6 × 1 m, drie panelen van 1,2 m, een stijl links
export function paneelDoek() {
  return doek(288, 80, (g, b, h) => {
    g.fillStyle = '#c6cacd'; g.fillRect(0, 0, b, h);
    for (let i = 0; i < 3; i++) {
      const x0 = i * 96, gr = g.createLinearGradient(x0, 0, x0 + 96, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0.10)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.05)');
      g.fillStyle = gr; g.fillRect(x0, 0, 96, h);
      g.fillStyle = 'rgba(70,76,82,0.55)'; g.fillRect(x0, 0, 1, h);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x0 + 1, 0, 1, h);
    }
    g.fillStyle = '#a9aeb2'; g.fillRect(0, 0, 4, h);
    for (let i = 0; i < 500; i++) { const c = 150 + ruis() * 80; g.fillStyle = `rgba(${c},${c},${c},0.12)`; g.fillRect(ruis() * b, ruis() * h, 2, 1); }
  });
}
// lichtgrijze golfplaten (vezelcement): een tegel van 1 × 1 m, zes golven per meter, de golven lopen met de helling mee
export function golfDoek() {
  return doek(192, 192, (g, b, h) => {
    const n = 6, w = b / n;
    for (let i = 0; i < n; i++) {
      const gr = g.createLinearGradient(i * w, 0, (i + 1) * w, 0);
      gr.addColorStop(0, '#9fa3a2'); gr.addColorStop(0.3, '#cfd2d0'); gr.addColorStop(0.55, '#c3c6c4'); gr.addColorStop(1, '#a4a8a7');
      g.fillStyle = gr; g.fillRect(i * w, 0, w, h);
    }
    for (let i = 0; i < 900; i++) { const c = 120 + ruis() * 90; g.fillStyle = `rgba(${c},${c + 4},${c},0.10)`; g.fillRect(ruis() * b, ruis() * h, 1 + ruis() * 3, 1 + ruis() * 3); }
    g.fillStyle = 'rgba(60,62,60,0.18)'; g.fillRect(0, 0, b, 2);       // de overlap van twee platen
  });
}
// wit geschilderd metselwerk: een tegel van 1 × 1 m, stenen van 21 × 6,5 cm
export function witDoek() {
  return doek(128, 128, (g, b, h) => {
    g.fillStyle = '#ebeae5'; g.fillRect(0, 0, b, h);
    const sh = h / 15.4, sb = b / 4.76;
    g.fillStyle = 'rgba(150,148,140,0.22)';
    for (let r = 0; r < 16; r++) {
      const y = Math.round(r * sh); g.fillRect(0, y, b, 1);
      for (let k = -1; k < 6; k++) g.fillRect(Math.round(k * sb + (r % 2 ? sb / 2 : 0)), y, 1, Math.ceil(sh));
    }
    for (let i = 0; i < 700; i++) { const c = 200 + ruis() * 55; g.fillStyle = `rgba(${c},${c},${c - 6},0.2)`; g.fillRect(ruis() * b, ruis() * h, 2, 2); }
  });
}
/*
 Het bord: wit, een blauwe tennisbal met de witte naad links, "tennishal" in blauw en "SNEEK" in kapitalen eronder,
 klein de website. Een doek van 4 : 1.
*/
export function tekenBord(g, b, h) {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, b, h);
  g.strokeStyle = '#1d4f9c'; g.lineWidth = h * 0.03; g.strokeRect(h * 0.03, h * 0.03, b - h * 0.06, h - h * 0.06);
  const r = h * 0.3, cx = h * 0.5, cy = h * 0.46;
  g.fillStyle = '#1f62c4'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#ffffff'; g.lineWidth = h * 0.035;
  g.beginPath(); g.arc(cx - r * 1.25, cy, r * 0.95, -0.75, 0.75); g.stroke();
  g.beginPath(); g.arc(cx + r * 1.25, cy, r * 0.95, Math.PI - 0.75, Math.PI + 0.75); g.stroke();
  const x = h * 0.95;
  g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  g.fillStyle = '#1d4f9c'; g.font = `700 ${Math.round(h * 0.4)}px "Trebuchet MS", "Verdana", "Arial", sans-serif`;
  g.fillText('tennishal', x, h * 0.5);
  g.fillStyle = '#163d7a'; g.font = `900 ${Math.round(h * 0.27)}px "Arial Black", "Verdana", "Arial", sans-serif`;
  const sneek = 'SNEEK', sw = g.measureText(sneek).width;
  g.fillText(sneek, Math.max(x, b - h * 0.12 - sw), h * 0.78);
  g.fillStyle = '#3c6fb8'; g.font = `400 ${Math.round(h * 0.1)}px "Verdana", "Arial", sans-serif`;
  g.fillText('www.tennishalsneek.nl', x, h * 0.92);
}

// ------------------------------------------------------------------ meetkunde in het vlak
// Sutherland–Hodgman: het deel van `onder` binnen de bolle veelhoek `mes` (beide [[a, b], …])
export function knip(onder, mes) {
  let opp = 0;
  for (let i = 0; i < mes.length; i++) { const a = mes[i], b = mes[(i + 1) % mes.length]; opp += a[0] * b[1] - b[0] * a[1]; }
  const s = Math.sign(opp) || 1;
  let uit = onder;
  for (let i = 0; i < mes.length && uit.length; i++) {
    const a = mes[i], b = mes[(i + 1) % mes.length];
    const kant = (p) => s * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
    const was = uit; uit = [];
    for (let j = 0; j < was.length; j++) {
      const p = was[j], q = was[(j + 1) % was.length], kp = kant(p), kq = kant(q);
      if (kp >= 0) uit.push(p);
      if ((kp >= 0) !== (kq >= 0)) { const t = kp / (kp - kq); uit.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
    }
  }
  return uit;
}
const halfvlak = (as, waarde, kleiner) => {   // een groot vierkant aan één kant van u = waarde (as 0) of w = waarde (as 1)
  const G = 1e4, lo = kleiner ? -G : waarde, hi = kleiner ? waarde : G;
  return as === 0 ? [[lo, -G], [hi, -G], [hi, G], [lo, G]] : [[-G, lo], [G, lo], [G, hi], [-G, hi]];
};
const binnenVeelhoek = (x, z, v) => { let c = false; for (let i = 0, j = v.length - 1; i < v.length; j = i++) { const a = v[i], b = v[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
const oppervlak = (v) => { let s = 0; for (let i = 0; i < v.length; i++) { const a = v[i], b = v[(i + 1) % v.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };

// ------------------------------------------------------------------ bouwen
/**
 * Bouwt de tennishal op zijn voetafdruk. Geeft `{ groep, borden, materialen, maten, wereld, lokaal }` terug, of null
 * als het pand niet in de kaart staat.
 */
export function bouwTennishal(scene, K) {
  const p = (K.panden || []).find(q => q.id === TENNISHAL.pand);
  if (!p) return null;
  // de hoekpunten van de 3D BAG: alles boven de 6 m is de hal; de nok is de hoogste lijn
  const V = [];
  if (p.v) for (let i = 0; i < p.v.length; i += 3) V.push([p.v[i], p.v[i + 1], p.v[i + 2]]);
  const nok = V.length ? Math.max(...V.map(q => q[1])) : (p.nok || 12.2);
  const hoog = V.filter(q => q[1] > 6);
  const goot = hoog.length ? Math.min(...hoog.map(q => q[1])) : (p.goot || 6.3);
  const nokPt = V.filter(q => q[1] > nok - 0.05);
  // de richting van de nok (naar het oosten); zonder 3D BAG de lange as van de botsdoos
  let e;
  if (nokPt.length >= 2) {
    let a = nokPt[0], b = nokPt[0];
    for (const q of nokPt) { if (q[0] < a[0]) a = q; if (q[0] > b[0]) b = q; }
    const l = Math.hypot(b[0] - a[0], b[2] - a[2]); e = [(b[0] - a[0]) / l, (b[2] - a[2]) / l];
  } else { const h = p.rect ? p.rect.hoek : 0; e = [Math.cos(h), Math.sin(h)]; if (e[0] < 0) e = [-e[0], -e[1]]; }
  const n = [-e[1], e[0]];                                   // dwars op de nok, naar het zuiden (+z)
  const U = (x, z) => x * e[0] + z * e[1], Vv = (x, z) => x * n[0] + z * n[1];
  const halPt = hoog.length ? hoog.map(q => [q[0], q[2]]) : p.voet;
  const U0 = Math.min(...halPt.map(q => U(q[0], q[1]))), U1 = Math.max(...halPt.map(q => U(q[0], q[1])));
  const V0 = Math.min(...halPt.map(q => Vv(q[0], q[1]))), V1 = Math.max(...halPt.map(q => Vv(q[0], q[1])));
  const L = U1 - U0, D = V1 - V0;                            // lengte en breedte van de hal
  const lokaal = (x, z) => [U(x, z) - U0, Vv(x, z) - V0];
  const wereld = (u, y, w) => new THREE.Vector3((U0 + u) * e[0] + (V0 + w) * n[0], y, (U0 + u) * e[1] + (V0 + w) * n[1]);
  const midden = wereld(L / 2, 0, D / 2);
  const g0 = grondHoogte(midden.x, midden.z, -Infinity), yb = g0 - 0.3;   // de voet een stukje in de grond
  const GOOT = g0 + goot, NOK = g0 + nok;

  // de voetafdruk in (u, w): de aanbouw in het westen, de strook langs de zuidgevel
  const voet = p.voet.map(q => lokaal(q[0], q[1]));
  const zuidPt = voet.filter(q => q[1] > D + 0.8 && q[1] < D + 2.5 && q[0] > 0.5);
  const strook = zuidPt.length >= 2
    ? { u0: Math.min(...zuidPt.map(q => q[0])), u1: Math.max(...zuidPt.map(q => q[0])), d: zuidPt.reduce((s, q) => s + q[1] - D, 0) / zuidPt.length }
    : { u0: 3, u1: L * 0.78, d: 1.6 };
  const verPt = voet.filter(q => q[1] > D + 2.5);
  const uA = verPt.length ? Math.max(...verPt.map(q => q[0])) : 0;          // de oostrand van de aanbouw
  const westPt = voet.filter(q => q[0] < -0.3);
  const wN = westPt.length ? Math.min(...westPt.map(q => q[1])) : D * 0.3;  // de noordrand van de aanbouw
  const wS = lokaal(...TENNISHAL.splitsing)[1];
  let aanbouw = knip(knip(voet, halfvlak(0, uA + 0.001, true)), halfvlak(1, wN - 0.01, false));
  const delen = [
    { naam: 'noord', ring: knip(aanbouw, halfvlak(1, wS, true)), h: g0 + TENNISHAL.aanbouwNoord },
    { naam: 'zuid', ring: knip(aanbouw, halfvlak(1, wS, false)), h: g0 + TENNISHAL.aanbouwZuid },
  ].filter(d => d.ring.length >= 3 && Math.abs(oppervlak(d.ring)) > 2);

  const MAT = {
    paneel: new THREE.MeshStandardMaterial({ map: paneelDoek(), roughness: 0.6, metalness: 0.2 }),
    streep: new THREE.MeshStandardMaterial({ color: 0x2a2e32, roughness: 0.6, metalness: 0.2, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    veld: new THREE.MeshStandardMaterial({ color: 0x545a60, roughness: 0.6, metalness: 0.2, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    dak: new THREE.MeshStandardMaterial({ map: golfDoek(), roughness: 0.88 }),
    dakrand: new THREE.MeshStandardMaterial({ color: 0xc9cccd, roughness: 0.7, metalness: 0.2 }),
    onderdak: new THREE.MeshStandardMaterial({ color: 0x8e9296, roughness: 0.8 }),
    wit: new THREE.MeshStandardMaterial({ map: witDoek(), roughness: 0.9 }),
    platdak: new THREE.MeshStandardMaterial({ color: 0x55585a, roughness: 0.95 }),
    plint: new THREE.MeshStandardMaterial({ color: 0x1d1f21, roughness: 0.7, metalness: 0.15 }),
    luifel: new THREE.MeshStandardMaterial({ color: 0x1f5fb0, roughness: 0.5, metalness: 0.2 }),
    glas: new THREE.MeshStandardMaterial({ color: 0x22303a, roughness: 0.1, metalness: 0.5 }),
    donker: new THREE.MeshStandardMaterial({ color: 0x3c4146, roughness: 0.6, metalness: 0.3 }),
    deur: new THREE.MeshStandardMaterial({ color: 0x8b9095, roughness: 0.5, metalness: 0.4 }),
    paal: new THREE.MeshStandardMaterial({ color: 0x3a3d40, roughness: 0.55, metalness: 0.5 }),
  };
  MAT.paneel.map.repeat.set(1 / 3.6, 1);

  // per materiaal één geometrie. Een veelhoek is een lijst lokale punten [u, y, w]; `naar` is de richting (lokaal) waar
  // hij heen moet kijken (de volgorde wordt daarop gedraaid); uv in meters (muren: langs de gevel en omhoog)
  const bak = new Map();
  const naarWereld = (d) => new THREE.Vector3(d[0] * e[0] + d[2] * n[0], d[1], d[0] * e[1] + d[2] * n[1]);
  const veelhoek = (mat, pts, naar, uvs = null) => {
    if (pts.length < 3) return;
    if (!bak.has(mat)) bak.set(mat, { pos: [], uv: [] });
    const g = bak.get(mat);
    let P = pts.map(q => wereld(q[0], q[1], q[2])), UV = uvs;
    const N = naarWereld(naar);
    const nw = new THREE.Vector3();
    for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; nw.x += (a.y - b.y) * (a.z + b.z); nw.y += (a.z - b.z) * (a.x + b.x); nw.z += (a.x - b.x) * (a.y + b.y); }
    if (nw.dot(N) < 0) { P = P.slice().reverse(); if (UV) UV = UV.slice().reverse(); }
    if (!UV) {
      // een muur: u langs de gevel (naar rechts voor wie ervoor staat), v de hoogte; anders vlak in x/z
      const Nh = new THREE.Vector3(N.x, 0, N.z);
      if (Nh.length() > 0.7) { const T = new THREE.Vector3(Nh.z, 0, -Nh.x).normalize(); UV = P.map(q => [q.x * T.x + q.z * T.z, q.y]); }
      else UV = P.map(q => [q.x, q.z]);
    }
    for (let i = 1; i < P.length - 1; i++) for (const k of [0, i, i + 1]) { g.pos.push(P[k].x, P[k].y, P[k].z); g.uv.push(UV[k][0], UV[k][1]); }
  };
  // een doos van u0..u1, y0..y1, w0..w1; `kanten` uit n(oord) z(uid) w(est) o(ost) b(oven) d (onder)
  const doos = (mat, u0, u1, y0, y1, w0, w1, kanten = 'nzwob') => {
    if (kanten.includes('n')) veelhoek(mat, [[u0, y0, w0], [u1, y0, w0], [u1, y1, w0], [u0, y1, w0]], [0, 0, -1]);
    if (kanten.includes('z')) veelhoek(mat, [[u0, y0, w1], [u1, y0, w1], [u1, y1, w1], [u0, y1, w1]], [0, 0, 1]);
    if (kanten.includes('w')) veelhoek(mat, [[u0, y0, w0], [u0, y0, w1], [u0, y1, w1], [u0, y1, w0]], [-1, 0, 0]);
    if (kanten.includes('o')) veelhoek(mat, [[u1, y0, w0], [u1, y0, w1], [u1, y1, w1], [u1, y1, w0]], [1, 0, 0]);
    if (kanten.includes('b')) veelhoek(mat, [[u0, y1, w0], [u1, y1, w0], [u1, y1, w1], [u0, y1, w1]], [0, 1, 0]);
    if (kanten.includes('d')) veelhoek(mat, [[u0, y0, w0], [u1, y0, w0], [u1, y0, w1], [u0, y0, w1]], [0, -1, 0]);
  };

  // ---- de hal: twee lange gevels en twee puntgevels
  doos(MAT.paneel, 0, L, yb, GOOT, 0, D, 'nz');
  const punt = (u, naar) => veelhoek(MAT.paneel, [[u, yb, 0], [u, yb, D], [u, GOOT, D], [u, NOK, D / 2], [u, GOOT, 0]], naar);
  punt(0, [-1, 0, 0]); punt(L, [1, 0, 0]);

  // ---- het dak: twee vlakken van golfplaat, de overstek, de onderkant, de boeidelen en de nokvorst
  const O = TENNISHAL.overstek, helling = (NOK - GOOT) / (D / 2), dik = 0.14;
  const gootY = GOOT - O * helling, schuin = Math.hypot(D / 2 + O, NOK - gootY);
  for (const kant of [-1, 1]) {
    const wR = kant < 0 ? -O : D + O;                       // de rand van de overstek
    veelhoek(MAT.dak, [[-O, gootY, wR], [L + O, gootY, wR], [L + O, NOK, D / 2], [-O, NOK, D / 2]], [0, 1, kant * helling],
      [[0, 0], [L + 2 * O, 0], [L + 2 * O, schuin], [0, schuin]]);
    veelhoek(MAT.onderdak, [[-O, gootY - dik, wR], [L + O, gootY - dik, wR], [L + O, NOK - dik, D / 2], [-O, NOK - dik, D / 2]], [0, -1, -kant * helling]);
    // het boeideel langs de goot en langs de twee puntgevels
    veelhoek(MAT.dakrand, [[-O, gootY - dik - 0.12, wR], [L + O, gootY - dik - 0.12, wR], [L + O, gootY + 0.02, wR], [-O, gootY + 0.02, wR]], [0, 0, kant]);
    for (const [u, nu] of [[-O, -1], [L + O, 1]]) {
      veelhoek(MAT.dakrand, [[u, gootY - dik - 0.12, wR], [u, NOK - dik - 0.12, D / 2], [u, NOK + 0.02, D / 2], [u, gootY + 0.02, wR]], [nu, 0, 0]);
    }
    // de nokvorst: een smalle strook van 25 cm aan elke kant, iets boven de platen
    const wV = D / 2 - kant * 0.25;
    veelhoek(MAT.dakrand, [[-O, NOK + 0.07 - 0.25 * helling, wV], [L + O, NOK + 0.07 - 0.25 * helling, wV], [L + O, NOK + 0.07, D / 2], [-O, NOK + 0.07, D / 2]], [0, 1, kant * helling]);
  }

  // ---- het patroon: donkere stroken, uitgeknipt op elke gevel. Gevelcoördinaten (s, y): s langs de gevel
  const strepen = [];
  const band = (A, B, breed) => {
    const dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l, px = -uy * breed / 2, py = ux * breed / 2;
    const a = [A[0] - ux * 4, A[1] - uy * 4], b = [B[0] + ux * 4, B[1] + uy * 4];
    return [[a[0] + px, a[1] + py], [b[0] + px, b[1] + py], [b[0] - px, b[1] - py], [a[0] - px, a[1] - py]];
  };
  const gevels = {
    zuid: { vorm: [[0, yb], [L, yb], [L, GOOT], [0, GOOT]], punt3: (s, y, d) => [s, y, D + d], naar: [0, 0, 1] },
    noord: { vorm: [[0, yb], [L, yb], [L, GOOT], [0, GOOT]], punt3: (s, y, d) => [L - s, y, -d], naar: [0, 0, -1] },
    west: { vorm: [[0, yb], [D, yb], [D, GOOT], [D / 2, NOK], [0, GOOT]], punt3: (s, y, d) => [-d, y, D - s], naar: [-1, 0, 0] },
    oost: { vorm: [[0, yb], [D, yb], [D, GOOT], [D / 2, NOK], [0, GOOT]], punt3: (s, y, d) => [L + d, y, s], naar: [1, 0, 0] },
  };
  const strook2 = (gevel, mat, A, B, breed, af) => {
    const G = gevels[gevel], r = knip(band(A, B, breed), G.vorm);
    if (r.length < 3) return;
    veelhoek(mat, r.map(q => G.punt3(q[0], q[1], af)), G.naar);
    strepen.push({ gevel, soort: mat === MAT.streep ? 'streep' : 'veld', A, B, breed, hoek: Math.atan2(B[1] - A[1], B[0] - A[0]) * 180 / Math.PI });
  };
  const S = TENNISHAL.streep, hG = GOOT - g0;
  const X = (gevel, s, breedte) => {         // een kruis van de voet tot de goot
    strook2(gevel, MAT.streep, [s - breedte / 2, g0], [s + breedte / 2, GOOT], S, 0.05);
    strook2(gevel, MAT.streep, [s - breedte / 2, GOOT], [s + breedte / 2, g0], S, 0.05);
  };
  // de lange gevels: twee kruisen en lange schuine lijnen (op de noordgevel gespiegeld: s loopt daar van oost naar west)
  for (const gevel of ['zuid', 'noord']) {
    X(gevel, L * 0.25, hG * 1.5);
    X(gevel, L * 0.62, hG * 1.5);
    strook2(gevel, MAT.streep, [L * 0.0, g0 + hG * 0.35], [L * 0.14, GOOT], S * 0.8, 0.05);
    strook2(gevel, MAT.streep, [L * 0.34, g0], [L * 0.52, GOOT], S * 0.8, 0.05);
    strook2(gevel, MAT.streep, [L * 0.74, g0], [L * 0.96, GOOT], S * 0.8, 0.05);
  }
  // de puntgevels: twee brede donkergrijze vlakken, met smalle zwarte lijnen erdoorheen
  for (const gevel of ['west', 'oost']) {
    strook2(gevel, MAT.veld, [D * 0.08, g0], [D * 0.5, NOK], 4.2, 0.03);
    strook2(gevel, MAT.veld, [D * 0.62, g0], [D * 0.98, GOOT + 1.5], 3.2, 0.03);
    strook2(gevel, MAT.streep, [D * 0.0, GOOT - 0.5], [D * 0.7, g0], S * 0.6, 0.05);
    strook2(gevel, MAT.streep, [D * 0.35, g0], [D * 0.85, NOK - 1], S * 0.6, 0.05);
  }

  // ---- de plint langs de zuidgevel, met staanders en een regel ervoor
  const PL = g0 + TENNISHAL.plint, sd = strook.d;
  strook.u0 = Math.min(strook.u0, uA);                      // aansluitend op de aanbouw
  doos(MAT.plint, strook.u0, strook.u1, yb, PL, D, D + sd, 'zob');
  const wP = D + sd + 0.55;
  for (let u = strook.u0 + 0.6; u <= strook.u1 - 0.3; u += 3) doos(MAT.paal, u - 0.04, u + 0.04, yb, g0 + 2.5, wP - 0.04, wP + 0.04, 'nzwob');
  for (const y of [g0 + 0.12, g0 + 2.42]) doos(MAT.paal, strook.u0 + 0.6, strook.u1 - 0.3, y - 0.025, y + 0.025, wP - 0.02, wP + 0.02, 'nzb');
  // de dubbele grijze deur in de hoek, op de zuidgevel voorbij de plint
  const deurU = Math.min(L - 3, strook.u1 + (L - strook.u1) * 0.65);
  doos(MAT.deur, deurU - 1.0, deurU + 1.0, g0, g0 + 2.35, D, D + 0.04, 'zwob');
  doos(MAT.donker, deurU - 0.02, deurU + 0.02, g0, g0 + 2.35, D + 0.04, D + 0.05, 'z');

  // ---- de witte aanbouw: de voetafdruk opgetrokken, een plat dak met een randje
  for (const deel of delen) {
    const r = deel.ring;
    for (let i = 0; i < r.length; i++) {
      const a = r[i], b = r[(i + 1) % r.length], du = b[0] - a[0], dw = b[1] - a[1], l = Math.hypot(du, dw);
      if (l < 0.02) continue;
      let nu = dw / l, nw = -du / l;
      if (binnenVeelhoek((a[0] + b[0]) / 2 + nu * 0.05, (a[1] + b[1]) / 2 + nw * 0.05, r)) { nu = -nu; nw = -nw; }
      veelhoek(MAT.wit, [[a[0], yb, a[1]], [b[0], yb, b[1]], [b[0], deel.h, b[1]], [a[0], deel.h, a[1]]], [nu, 0, nw]);
    }
    const drie = THREE.ShapeUtils.triangulateShape(r.map(q => new THREE.Vector2(q[0], q[1])), []);
    for (const t of drie) veelhoek(MAT.platdak, t.map(k => [r[k][0], deel.h, r[k][1]]), [0, 1, 0]);
  }
  // de entree: op de langste westgevel van het zuidelijke deel
  const zuidDeel = delen.find(d => d.naam === 'zuid') || delen[0];
  let ingang = null;
  if (zuidDeel) {
    const r = zuidDeel.ring;
    let best = null;
    const uMin = Math.min(...r.map(q => q[0]));
    for (let i = 0; i < r.length; i++) {
      const a = r[i], b = r[(i + 1) % r.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      // alleen de westkant (niet de knip langs de hal aan de oostkant)
      if ((a[0] + b[0]) / 2 > uMin + 1.5) continue;
      if (Math.abs(b[0] - a[0]) < l * 0.2 && (!best || l > best.l)) best = { a, b, l };
    }
    if (best) {
      const { a, b } = best;
      const uG = (a[0] + b[0]) / 2, wLo = Math.min(a[1], b[1]), wHi = Math.max(a[1], b[1]), wM = wLo + (wHi - wLo) * 0.62;
      const hz = zuidDeel.h, f = 0.03;
      // de glazen deur, het donkergrijze vlak ernaast en de blauwe luifel
      doos(MAT.glas, uG - f, uG, g0, g0 + 2.4, wM - 1.0, wM + 1.0, 'w');
      doos(MAT.donker, uG - f * 2, uG - f, g0, g0 + 2.4, wM - 0.02, wM + 0.02, 'w');
      doos(MAT.donker, uG - f, uG, g0, hz - 0.15, wM + 1.15, wM + 2.75, 'w');
      doos(MAT.luifel, uG - 1.5, uG, g0 + 2.6, g0 + 2.8, wM - 1.7, wM + 1.7, 'nzwbd');
      ingang = { punt: wereld(uG - 0.1, g0, wM), naar: naarWereld([-1, 0, 0]), u: uG, w: wM, luifelY: g0 + 2.7 };
    }
  }
  // twee ramen in het noordelijke deel
  const noordDeel = delen.find(d => d.naam === 'noord');
  if (noordDeel) {
    const uW = Math.min(...noordDeel.ring.map(q => q[0]));
    const kant = noordDeel.ring.filter(q => Math.abs(q[0] - uW) < 1.2).map(q => q[1]);
    if (kant.length >= 2) {
      const w0 = Math.min(...kant), w1 = Math.max(...kant);
      for (const t of [0.3, 0.7]) {
        const wm = w0 + (w1 - w0) * t;
        // de gevel ligt hier niet precies op uW (een schuine rand): zet het raam op de gevel bij wm
        const uR = uOpRand(noordDeel.ring, wm, uW);
        doos(MAT.glas, uR - 0.03, uR, g0 + 1.0, g0 + 2.3, wm - 0.8, wm + 0.8, 'w');
      }
    }
  }

  // ---- in elkaar zetten
  const groep = new THREE.Group();
  groep.name = 'tennishal';
  for (const [mat, g] of bak) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true; m.receiveShadow = true;
    m.userData.klasse = 'tennishal';
    groep.add(m);
  }
  // de borden: een vlak een paar centimeter voor de gevel
  const bordMat = new THREE.MeshStandardMaterial({ map: doek(1024, 256, tekenBord), roughness: 0.5, metalness: 0.05 });
  bordMat.map.wrapS = bordMat.map.wrapT = THREE.ClampToEdgeWrapping;
  const borden = [];
  const bord = (naam, u, y, w, breed, naar) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(breed, breed / 4), bordMat);
    const pos = wereld(u, y, w);
    m.position.copy(pos); m.lookAt(pos.clone().add(naarWereld(naar)));
    m.name = naam; m.userData.klasse = 'bord';
    groep.add(m); borden.push(m);
  };
  bord('bord-gevel', (strook.u0 + strook.u1) / 2 + 6, g0 + 4.3, D + 0.09, 6.4, [0, 0, 1]);
  if (ingang) bord('bord-entree', ingang.u - 0.05, g0 + 2.0, ingang.w - 2.7, 2.6, [-1, 0, 0]);
  scene.add(groep);

  const api = {
    groep, borden, strepen, materialen: MAT, bordMateriaal: bordMat, ingang, delen,
    maten: { L, D, goot: GOOT, nok: NOK, grond: g0, e, n, strook, plint: PL, uA, wN, wS, deurU, oorsprong: wereld(0, 0, 0) },
    wereld, lokaal,
  };
  TENNISHAL_PAND.nu = api;
  return api;
}
// de u van de rand van een veelhoek op hoogte w, het dichtst bij `bij` (voor een raam op een gevel die niet recht loopt)
function uOpRand(r, w, bij) {
  let best = bij, d = Infinity;
  for (let i = 0; i < r.length; i++) {
    const a = r[i], b = r[(i + 1) % r.length];
    if ((a[1] - w) * (b[1] - w) > 0 || a[1] === b[1]) continue;
    const u = a[0] + (b[0] - a[0]) * (w - a[1]) / (b[1] - a[1]);
    if (Math.abs(u - bij) < d) { d = Math.abs(u - bij); best = u; }
  }
  return best;
}
// het gebouwde pand, voor de proeven
export const TENNISHAL_PAND = { nu: null };
