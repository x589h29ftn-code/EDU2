/*
 Missie 15: Bouwman schaduwen (verzoek 27 sep 2026: "Bouw missie 15", met De Boer
 voortaan Bouwman). Het verhaal staat in js/verhaal.js; hier staan de dingen in de
 wereld:

   - de route die Bouwman rijdt, van de pomp bij de BP door Duinterpen (langs
     Parelmoervlinder 3, waar Mark in missie 13 ondergedoken zat) en over de
     Stadsrondweg en de N7 naar zijn loods;
   - hoe zijn auto daarover rijdt: een snelheidsprofiel zoals bij de tegenstanders
     van de race (js/race.js), met een stop bij Parelmoervlinder 3 en een vlucht terug;
   - de loods zelf, aan het water ten zuiden van de stad (de plek en waarom daar
     staat in js/bouwvlak.js): damwand, een half open roldeur, een raam in de
     oostgevel, binnen een tafel met tassen en een bord met namen, op het erf een
     container, aan de kade een steiger met een sloep;
   - de drie plekken voor een foto en waar de twee mannen heen en weer lopen.

 Alles wordt bij het opstarten gemaakt, dus de materialen zijn vooraf vertaald
 (`soortenVoorbereid`, js/world.js).

 De route is gemeten (27 sep 2026, tools/schaduwtest.mjs rekent hem na): 2,2 km,
 geen keerpunt (de grootste draai is 98°, een gewone kruising), geen sprong in hoogte,
 en hij komt tot op tien meter langs Parelmoervlinder 3. Eerst ging hij door Tinga,
 maar dan viel hij bij het knooppunt op de Dúvelsrak van het dek (zie `bouwLijn`), en
 zonder dat knooppunt keert elke route door Tinga ergens om.
*/
import * as THREE from 'three';
import { Navigatie } from './navigatie.js';
import { addCollider } from './world.js';
import { grondHoogte } from './viaduct.js';
import { LOODS } from './bouwvlak.js';
import { bouwSloep, SLOEP } from './boot.js';
import { maakTas } from './tas.js';

export const SCHADUW = {
  van: [721.0, 133.2],          // de pomp bij de BP waar Bouwman tankt
  via: [1200, 600],             // door Duinterpen: langs Parelmoervlinder 3
  weg: [1412, -214],            // de weg langs de loods, bij de oprit
  // van de weg over het fietspad het erf op, en parkeren naast de roldeur
  erfIn: [[1412, -208.5], [1408.5, -203.5], [1403.5, -201], [1399.5, -200.4]],
  stap: 2,                      // bemonstering van de lijn (m)
  glad: 3,                      // gladstrijken over zoveel monsters naar elke kant
  stad: 12.5,                   // m/s binnen de bebouwing (45 km/u)
  snelweg: 21,                  // op de Stadsrondweg en de N7 (75 km/u)
  dwars: 3.8,                   // m/s² dwars door een bocht: hij rijdt rustig
  optrek: 2.0,                  // m/s²
  remmen: 3.0,                  // m/s², waarmee het profiel voor een bocht of stop afremt
  rechts: 1.5,                  // zover rechts van de as rijdt hij (m)
  stopT: 7,                     // zo lang staat hij stil bij Parelmoervlinder 3 (s)
  vlucht: 15,                   // m/s als hij er met gillende banden vandoor gaat
};

// de loods: 22 bij 12 m, 5 m tot de goot, de nok op 6,3 m, oost-west
const { x0: X0, x1: X1, z0: Z0, z1: Z1 } = LOODS;
const GOOT = 5.0, NOK = 6.3, WAND = 0.2;
const DEUR = { x0: 1402, x1: 1406.5, h: 4.0, open: 2.4 };      // de roldeur in de noordgevel
const RAAM = { z0: -186.6, z1: -184.4, y0: 1.2, y1: 2.2 };      // het raam in de oostgevel
const BOTS_H = 5;
export const CONTAINER = { x: 1388, z: -199, b: 2.44, l: 6.06, h: 2.59 };
const KADE = { x0: 1398, x1: 1421, z0: -182, z1: -168.8, top: 0.32 };
const STEIGER = { x0: 1405.4, x1: 1407.4, z0: -168.8, z1: -158.8, top: 0.3 };
export const BOOT = { x: 1409.9, z: -163.4, yaw: Math.PI, naam: 'STAVOREN 7' };

/*
 De drie foto's. `plek` is waar je moet staan (de gele ruit), `kijk` is waar je op
 richt. Alle drie liggen uit het zicht van het erf: de eerste achter de container,
 de tweede om de hoek aan de oostgevel, de derde achter de loods op de kade
 (schaduwtest rekent na dat geen van de mannen er zicht op heeft).
*/
export const FOTOS = [
  { plek: { x: 1385.0, z: -199.0 }, kijk: { x: 1404, z: -198 }, wat: 'Bouwman met de mannen bij de bestelbus' },
  { plek: { x: 1420.4, z: -185.5 }, kijk: { x: 1414.6, z: -185.5 }, wat: 'het bord met de namen, door het raam' },
  { plek: { x: 1402.0, z: -171.2 }, kijk: { x: 1410, z: -163.5 }, wat: 'de boot aan de steiger' },
];
// de twee mannen lopen heen en weer over het erf
export const POSTEN = [
  { a: [1397.5, -198.4], b: [1404.5, -198.4] },
  { a: [1408.5, -202.2], b: [1415.5, -202.2] },
];
/*
 Waar de mannen op letten: het erf, de loods en de kade, tot aan het fietspad. Wie
 over de weg langs rijdt (twintig meter verderop) zien ze niet: dat is gewoon verkeer.
*/
export function opHetErf(x, z) {
  const E = LOODS.erf, K = LOODS.kade;
  return x > E.x0 - 6 && x < E.x1 + 6 && z > E.z0 && z < K.z1 + 4;
}
// waar Bouwman gaat staan als hij er is, en waar de bestelbus staat
export const BOUWMAN_STAAT = { x: 1406.2, z: -196.6 };
export const BUS = { x: 1411.2, z: -199.2, yaw: 0 };

// ---------- doeken ----------
function doek(w, h, teken) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  teken(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const rnd = (zaad) => { let s = zaad; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
// damwandprofiel: een rib om de 25 cm, met licht op de ene flank en schaduw op de andere
function damwandDoek(kleur = [74, 88, 82]) {
  const t = doek(256, 256, (g, w, h) => {
    const [r, gr, b] = kleur;
    g.fillStyle = `rgb(${r},${gr},${b})`; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 64) {
      g.fillStyle = `rgba(255,255,255,0.10)`; g.fillRect(x + 6, 0, 10, h);
      g.fillStyle = `rgba(0,0,0,0.22)`; g.fillRect(x + 16, 0, 6, h);
      g.fillStyle = `rgba(0,0,0,0.08)`; g.fillRect(x + 40, 0, 3, h);
    }
    const r2 = rnd(5);
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(40,30,20,${0.03 + r2() * 0.05})`; g.fillRect(r2() * w, r2() * h, 2 + r2() * 5, 6 + r2() * 30); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// de roldeur: horizontale lamellen van 12 cm
function roldeurDoek() {
  const t = doek(128, 256, (g, w, h) => {
    g.fillStyle = '#9fa4a6'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) { g.fillStyle = '#7d8284'; g.fillRect(0, y, w, 3); g.fillStyle = '#b6babc'; g.fillRect(0, y + 3, w, 2); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// grind: grijze en bruine steentjes op zand
function grindDoek() {
  const t = doek(256, 256, (g, w, h) => {
    g.fillStyle = '#8a8378'; g.fillRect(0, 0, w, h);
    const r = rnd(9);
    for (let i = 0; i < 2600; i++) {
      const l = 90 + Math.floor(r() * 90);
      g.fillStyle = `rgb(${l},${l - 4 - Math.floor(r() * 10)},${l - 12 - Math.floor(r() * 12)})`;
      g.beginPath(); g.ellipse(r() * w, r() * h, 1 + r() * 2.2, 1 + r() * 1.6, r() * 3, 0, 6.283); g.fill();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// betonplaten van de kade, twee bij twee meter
function betonDoek() {
  const t = doek(256, 256, (g, w, h) => {
    g.fillStyle = '#9c9a94'; g.fillRect(0, 0, w, h);
    const r = rnd(13);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '60,60,58' : '200,198,190'},${0.05 + r() * 0.07})`; g.fillRect(r() * w, r() * h, 2 + r() * 6, 2 + r() * 6); }
    g.fillStyle = '#6e6c67'; g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// de planken van de steiger
function plankDoek() {
  const t = doek(256, 256, (g, w, h) => {
    g.fillStyle = '#6b5a45'; g.fillRect(0, 0, w, h);
    const r = rnd(21);
    for (let y = 0; y < h; y += 32) {
      const l = 88 + Math.floor(r() * 30);
      g.fillStyle = `rgb(${l + 20},${l + 4},${l - 14})`; g.fillRect(0, y + 2, w, 28);
      for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(40,28,18,0.25)'; g.fillRect(0, y + 4 + r() * 24, w, 1); }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// de zeecontainer: roestrood, verticale ribben, een nummer op de deur
function containerDoek() {
  return doek(512, 256, (g, w, h) => {
    g.fillStyle = '#7c2f22'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 22) { g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x, 0, 7, h); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x + 7, 0, 4, h); }
    const r = rnd(33);
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(60,30,10,${0.08 + r() * 0.12})`; g.fillRect(r() * w, r() * h, 3 + r() * 14, 2 + r() * 10); }
    g.fillStyle = '#e8e4d8'; g.font = 'bold 26px monospace'; g.fillText('TGHU 482190 3', 30, 48);
    g.font = 'bold 18px monospace'; g.fillText('22G1', 30, 76);
  });
}
/*
 Het bord in de loods: kurk, vier foto's met een punaise, en daaronder met stift de
 namen. Het is wat Erik door het raam ziet, dus het staat groot genoeg om te lezen.
*/
function bordDoek() {
  return doek(512, 300, (g, w, h) => {
    g.fillStyle = '#b08a5a'; g.fillRect(0, 0, w, h);
    const r = rnd(41);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '90,60,30' : '220,190,140'},0.25)`; g.fillRect(r() * w, r() * h, 2, 2); }
    g.strokeStyle = '#5a4128'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    const namen = [['RONALD', 'Lemmerweg 80'], ['JOHAN', 'Kruirad 62'], ['MARK', 'Molenkrite 15'], ['???', 'rijdt voor Mark']];
    namen.forEach(([naam, adres], i) => {
      const x = 22 + i * 122, y = 26;
      g.save(); g.translate(x + 50, y + 60); g.rotate((r() - 0.5) * 0.12);
      g.fillStyle = '#f2efe6'; g.fillRect(-50, -60, 100, 120);
      g.fillStyle = '#4a4f57'; g.fillRect(-42, -52, 84, 84);
      // een hoofd en schouders
      g.fillStyle = '#c9a383'; g.beginPath(); g.arc(0, -18, 16, 0, 6.283); g.fill();
      g.fillStyle = '#23262c'; g.fillRect(-28, 2, 56, 30);
      g.fillStyle = '#c21d1d'; g.beginPath(); g.arc(0, -56, 5, 0, 6.283); g.fill();
      g.restore();
      g.fillStyle = '#111'; g.font = 'bold 24px sans-serif'; g.textAlign = 'center';
      g.fillText(naam, x + 50, y + 172);
      g.font = '16px sans-serif'; g.fillText(adres, x + 50, y + 194);
    });
    // Mark omcirkeld
    g.strokeStyle = '#c21d1d'; g.lineWidth = 5;
    g.beginPath(); g.ellipse(22 + 2 * 122 + 50, 26 + 180, 60, 34, 0, 0, 6.283); g.stroke();
    g.fillStyle = '#c21d1d'; g.font = 'bold 22px sans-serif'; g.textAlign = 'left';
    g.fillText('VRIJDAG', 30, h - 26);
  });
}

function materialen() {
  const std = (kleur, extra = {}) => new THREE.MeshStandardMaterial({ color: kleur, roughness: 0.8, ...extra });
  return {
    wand: std(0xffffff, { map: damwandDoek(), roughness: 0.62, metalness: 0.25 }),
    dak: std(0xffffff, { map: damwandDoek([96, 100, 102]), roughness: 0.55, metalness: 0.3, side: THREE.DoubleSide }),
    roldeur: std(0xffffff, { map: roldeurDoek(), roughness: 0.5, metalness: 0.35 }),
    kozijn: std(0x2b2e31, { roughness: 0.5, metalness: 0.4 }),
    // het raam en de lampen gloeien altijd: binnen brandt licht (zie js/sfeer.js, stap 83)
    raam: std(0xffe7b0, { emissive: 0xffd88a, emissiveIntensity: 0.9, roughness: 0.2 }),
    tl: std(0xffffff, { emissive: 0xf4f6ff, emissiveIntensity: 1.3, roughness: 1 }),
    lamp: std(0xfff3d0, { emissive: 0xffe2a0, emissiveIntensity: 1.5, roughness: 1 }),
    binnen: std(0x3a3d3f, { roughness: 0.95, emissive: 0x3a3226, emissiveIntensity: 0.35 }),
    vloer: std(0x76746f, { roughness: 0.9, emissive: 0x2e2a22, emissiveIntensity: 0.4 }),
    grind: std(0xffffff, { map: grindDoek(), roughness: 1 }),
    beton: std(0xffffff, { map: betonDoek(), roughness: 0.95 }),
    plank: std(0xffffff, { map: plankDoek(), roughness: 0.9 }),
    paal: std(0x4a3b2c, { roughness: 0.95 }),
    container: std(0xffffff, { map: containerDoek(), roughness: 0.7, metalness: 0.3 }),
    containerKop: std(0x6e281c, { roughness: 0.7, metalness: 0.3 }),
    tafel: std(0x5b4a37, { roughness: 0.8, emissive: 0x2a1d10, emissiveIntensity: 0.3 }),
    pallet: std(0xa98b62, { roughness: 0.95, emissive: 0x3a2a18, emissiveIntensity: 0.3 }),
    krat: std(0x2e5a8a, { roughness: 0.7, emissive: 0x0d1a2a, emissiveIntensity: 0.3 }),
    bord: std(0xffffff, { map: bordDoek(), roughness: 0.9, emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0.35 }),
    staal: std(0x8f969b, { roughness: 0.4, metalness: 0.7 }),
  };
}

/*
 De lijn van Bouwman: dezelfde aanpak als de race (js/race.js `bouwLijn`). De
 routeplanner over de rijbanen alleen (zonder fietspaden), om de twee meter
 bemonsterd, gladgestreken; per monster de toegestane snelheid (de Stadsrondweg en
 de N7 harder dan de wijk) en hoe ver rechts de rijstrook ligt.
*/
export function bouwLijn(KAART, via = SCHADUW.via) {
  const rij = KAART.wegassen.filter(w => w.drive);
  /*
   Wegen die onder een brugdek door lopen, daar doorgeknipt (stap 96). Het knooppunt
   van de Stadsrondweg op de Dúvelsrak ligt 5,6 m hoog, maar de Stadsrondweg-Zuid naar
   het oosten en de N7 liggen op de grond en raken het dek in de plattegrond. De
   routeplanner kent geen hoogte en reed van het dek zo die weg op: 5,6 m naar beneden.
   Een stuk as dat helemaal boven een open brugdek ligt (daaronder is maaiveld) en aan
   geen enkele kant op het talud aansluit, is een weg eronder: dat stuk gaat eruit.
  */
  const boven = (p) => grondHoogte(p[0], p[1], Infinity) > 0.8;      // er ligt iets hoogs
  const onderOpen = (p) => grondHoogte(p[0], p[1], 0) < 0.3;          // en je kunt eronder staan
  const assen = [];
  for (const w of rij) {
    const P = w.pts, n = P.length;
    const eruit = new Array(n).fill(false);
    for (let i = 0; i < n; i++) {
      if (!boven(P[i])) continue;
      let j = i;
      while (j + 1 < n && boven(P[j + 1])) j++;
      const allesOpen = P.slice(i, j + 1).every(onderOpen);
      const voor = i > 0 ? P[i - 1] : null, na = j + 1 < n ? P[j + 1] : null;
      const grond = (q) => !q || grondHoogte(q[0], q[1], Infinity) < 0.3;
      if (allesOpen && grond(voor) && grond(na)) for (let k = i; k <= j; k++) eruit[k] = true;
      i = j;
    }
    if (!eruit.some(Boolean)) { assen.push(w); continue; }
    let stuk = [];
    for (let i = 0; i < n; i++) {
      if (eruit[i]) { if (stuk.length > 1) assen.push({ ...w, pts: stuk }); stuk = []; }
      else stuk.push(P[i]);
    }
    if (stuk.length > 1) assen.push({ ...w, pts: stuk });
  }
  const nav = new Navigatie(assen);
  const a = nav.route(SCHADUW.van, via), b = nav.route(via, SCHADUW.weg);
  if (!a || !b) return null;
  // het tussenpunt zelf eruit: dan geen stukje naar de naaste knoop en weer terug
  const ruw = [...a.slice(0, -1), ...b.slice(2), ...SCHADUW.erfIn];
  const p = [ruw[0]];
  for (const q of ruw) if (Math.hypot(q[0] - p[p.length - 1][0], q[1] - p[p.length - 1][1]) > 0.5) p.push(q);
  const mon = [];
  let rest = 0;
  for (let i = 1; i < p.length; i++) {
    const A = p[i - 1], B = p[i], L = Math.hypot(B[0] - A[0], B[1] - A[1]);
    let t = rest;
    while (t < L) { mon.push([A[0] + (B[0] - A[0]) * t / L, A[1] + (B[1] - A[1]) * t / L]); t += SCHADUW.stap; }
    rest = t - L;
  }
  mon.push(p[p.length - 1]);
  const g = SCHADUW.glad, n = mon.length;
  const x = new Float32Array(n), z = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sx = 0, sz = 0, k = 0;
    for (let j = Math.max(0, i - g); j <= Math.min(n - 1, i + g); j++) { sx += mon[j][0]; sz += mon[j][1]; k++; }
    x[i] = sx / k; z[i] = sz / k;
  }
  const s = new Float32Array(n), tx = new Float32Array(n), tz = new Float32Array(n);
  for (let i = 1; i < n; i++) s[i] = s[i - 1] + Math.hypot(x[i] - x[i - 1], z[i] - z[i - 1]);
  for (let i = 0; i < n; i++) {
    const A = Math.max(0, i - 2), B = Math.min(n - 1, i + 2);
    const dx = x[B] - x[A], dz = z[B] - z[A], l = Math.hypot(dx, dz) || 1;
    tx[i] = dx / l; tz[i] = dz / l;
  }
  const k = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const A = Math.max(0, i - 3), B = Math.min(n - 1, i + 3);
    let d = Math.atan2(tz[B], tx[B]) - Math.atan2(tz[A], tx[A]);
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    k[i] = Math.abs(d) / Math.max(1, s[B] - s[A]);
  }
  // de weg onder elk monster: een rooster van de punten van de rijbaanassen
  const C = 20, rooster = new Map();
  for (const w of rij) for (const q of w.pts) {
    const key = Math.floor(q[0] / C) + '|' + Math.floor(q[1] / C);
    if (!rooster.has(key)) rooster.set(key, []);
    rooster.get(key).push([q[0], q[1], w]);
  }
  const vmax = new Float32Array(n), baan = new Float32Array(n);
  const naamOp = new Array(n);
  for (let i = 0; i < n; i++) {
    let best = null, bd = 14;
    const cx = Math.floor(x[i] / C), cz = Math.floor(z[i] / C);
    for (let a2 = -1; a2 <= 1; a2++) for (let b2 = -1; b2 <= 1; b2++) {
      for (const q of rooster.get((cx + a2) + '|' + (cz + b2)) || []) {
        const d = Math.hypot(q[0] - x[i], q[1] - z[i]);
        if (d < bd) { bd = d; best = q[2]; }
      }
    }
    const snel = best && /N7|Stadsrondweg/i.test(best.naam || '');
    vmax[i] = snel ? SCHADUW.snelweg : SCHADUW.stad;
    baan[i] = best ? Math.min(SCHADUW.rechts, Math.max(0.6, (best.w || 5) / 4)) : 0.8;
    naamOp[i] = best ? best.naam : null;
  }
  // de hoogte zoals een auto hem rijdt (js/vehicles.js `zetNeer`: peilen vanaf waar hij is),
  // en de grootste sprong tussen twee monsters: die hoort klein te zijn
  let y = 0, sprong = 0;
  for (let i = 0; i < n; i++) {
    const ny = grondHoogte(x[i], z[i], y + 0.9);
    if (i) sprong = Math.max(sprong, Math.abs(ny - y));
    y = ny;
  }
  return { x, z, s, tx, tz, k, n, vmax, baan, naam: naamOp, lengte: s[n - 1], sprong };
}

/**
 * De loods, de route en de rit van Bouwman. `vehicles` voor `zetNeer`.
 */
export function initSchaduw({ scene, vehicles, KAART, stopBij = null }) {
  const M = materialen();
  const groep = new THREE.Group();
  groep.name = 'loods';
  scene.add(groep);
  const blok = (b, h, d, mat, x, y, z, { schaduw = true, ontvang = true, ry = 0 } = {}) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b, h, d), mat);
    m.position.set(x, y, z); m.rotation.y = ry;
    m.castShadow = schaduw; m.receiveShadow = ontvang;
    groep.add(m);
    return m;
  };
  const herhaal = (mat, u, v) => { const m = mat.clone(); m.map = mat.map.clone(); m.map.needsUpdate = true; m.map.repeat.set(u, v); return m; };
  const MX = (X0 + X1) / 2, MZ = (Z0 + Z1) / 2, B = X1 - X0, D = Z1 - Z0;

  // ---- het erf, de oprit en de kade ----
  const E = LOODS.erf, O = LOODS.oprit;
  blok(E.x1 - E.x0, 0.06, E.z1 - E.z0, herhaal(M.grind, (E.x1 - E.x0) / 3, (E.z1 - E.z0) / 3), (E.x0 + E.x1) / 2, 0.12, (E.z0 + E.z1) / 2, { schaduw: false });
  blok(O.x1 - O.x0, 0.06, O.z1 - O.z0, herhaal(M.grind, (O.x1 - O.x0) / 3, (O.z1 - O.z0) / 3), (O.x0 + O.x1) / 2, 0.12, (O.z0 + O.z1) / 2, { schaduw: false });
  const kadeH = KADE.top - SLOEP.WATER_Y + 0.6;
  blok(KADE.x1 - KADE.x0, kadeH, KADE.z1 - KADE.z0, herhaal(M.beton, (KADE.x1 - KADE.x0) / 2, (KADE.z1 - KADE.z0) / 2),
    (KADE.x0 + KADE.x1) / 2, KADE.top - kadeH / 2, (KADE.z0 + KADE.z1) / 2, { schaduw: false });
  // een bolder aan de kade
  const bolderGeo = new THREE.CylinderGeometry(0.16, 0.2, 0.5, 12);
  for (const x of [1403.2, 1414.5]) { const b = new THREE.Mesh(bolderGeo, M.kozijn); b.position.set(x, KADE.top + 0.25, KADE.z1 + 0.5); groep.add(b); }
  // ---- de steiger en de boot ----
  blok(STEIGER.x1 - STEIGER.x0, 0.1, STEIGER.z1 - STEIGER.z0, herhaal(M.plank, 1, (STEIGER.z1 - STEIGER.z0) / 1.2),
    (STEIGER.x0 + STEIGER.x1) / 2, STEIGER.top - 0.05, (STEIGER.z0 + STEIGER.z1) / 2);
  const paalGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.6, 8);
  for (let z = STEIGER.z0 + 1; z <= STEIGER.z1 + 0.01; z += 3) for (const x of [STEIGER.x0 + 0.1, STEIGER.x1 - 0.1]) {
    const p = new THREE.Mesh(paalGeo, M.paal); p.position.set(x, STEIGER.top - 0.7, z); groep.add(p);
  }
  const boot = bouwSloep({ naam: BOOT.naam, romp: 0x23304a, kleur: 0xd9d4c4 });
  boot.position.set(BOOT.x, SLOEP.WATER_Y + 0.03, BOOT.z); boot.rotation.y = BOOT.yaw;
  groep.add(boot);

  // ---- de loods: vier gevels van damwand ----
  const wandMat = (lengte) => herhaal(M.wand, lengte / 1.0, GOOT / 1.0);
  // noordgevel met de roldeur (en een deur voor mensen ernaast, dicht)
  const noordLinks = DEUR.x0 - X0, noordRechts = X1 - DEUR.x1;
  blok(noordLinks, GOOT, WAND, wandMat(noordLinks), X0 + noordLinks / 2, GOOT / 2, Z0);
  blok(noordRechts, GOOT, WAND, wandMat(noordRechts), DEUR.x1 + noordRechts / 2, GOOT / 2, Z0);
  const deurB = DEUR.x1 - DEUR.x0;
  blok(deurB, GOOT - DEUR.h, WAND, wandMat(deurB), (DEUR.x0 + DEUR.x1) / 2, DEUR.h + (GOOT - DEUR.h) / 2, Z0);
  // de roldeur staat half open: het deurblad hangt van 2,4 tot 4 m
  blok(deurB, DEUR.h - DEUR.open, 0.08, herhaal(M.roldeur, 1, (DEUR.h - DEUR.open) / 1.0), (DEUR.x0 + DEUR.x1) / 2, DEUR.open + (DEUR.h - DEUR.open) / 2, Z0 - 0.12);
  for (const x of [DEUR.x0, DEUR.x1]) blok(0.16, DEUR.h, 0.3, M.kozijn, x, DEUR.h / 2, Z0 - 0.05);
  blok(deurB + 0.3, 0.35, 0.45, M.kozijn, (DEUR.x0 + DEUR.x1) / 2, DEUR.h + 0.18, Z0 - 0.15);     // de rolkast
  blok(1.0, 2.1, 0.06, M.kozijn, 1398.6, 1.05, Z0 - 0.11);                                     // de loopdeur
  // een lamp boven de roldeur
  blok(0.5, 0.12, 0.3, M.lamp, (DEUR.x0 + DEUR.x1) / 2, DEUR.h + 0.5, Z0 - 0.35, { schaduw: false });
  // zuidgevel (aan de kade), dicht
  blok(B, GOOT, WAND, wandMat(B), MX, GOOT / 2, Z1);
  blok(1.0, 2.1, 0.06, M.kozijn, 1409.5, 1.05, Z1 + 0.11);
  // westgevel, dicht
  blok(WAND, GOOT, D, wandMat(D), X0, GOOT / 2, MZ);
  // oostgevel met het raam
  const raamD = RAAM.z1 - RAAM.z0;
  blok(WAND, GOOT, RAAM.z0 - Z0, wandMat(RAAM.z0 - Z0), X1, GOOT / 2, (Z0 + RAAM.z0) / 2);
  blok(WAND, GOOT, Z1 - RAAM.z1, wandMat(Z1 - RAAM.z1), X1, GOOT / 2, (RAAM.z1 + Z1) / 2);
  blok(WAND, RAAM.y0, raamD, wandMat(raamD), X1, RAAM.y0 / 2, (RAAM.z0 + RAAM.z1) / 2);
  blok(WAND, GOOT - RAAM.y1, raamD, wandMat(raamD), X1, RAAM.y1 + (GOOT - RAAM.y1) / 2, (RAAM.z0 + RAAM.z1) / 2);
  // het kozijn, en het glas zelf: je ziet naar binnen, dus doorzichtig met een warme gloed
  const glas = new THREE.Mesh(new THREE.BoxGeometry(0.02, RAAM.y1 - RAAM.y0, raamD),
    new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffc870, emissiveIntensity: 0.25, transparent: true, opacity: 0.28, roughness: 0.1, depthWrite: false }));
  glas.position.set(X1 + 0.02, (RAAM.y0 + RAAM.y1) / 2, (RAAM.z0 + RAAM.z1) / 2); glas.renderOrder = 2;
  groep.add(glas);
  for (const z of [RAAM.z0, RAAM.z1]) blok(0.26, RAAM.y1 - RAAM.y0 + 0.1, 0.08, M.kozijn, X1, (RAAM.y0 + RAAM.y1) / 2, z);
  for (const y of [RAAM.y0, RAAM.y1]) blok(0.26, 0.08, raamD + 0.1, M.kozijn, X1, y, (RAAM.z0 + RAAM.z1) / 2);
  // de hoeken
  for (const x of [X0, X1]) for (const z of [Z0, Z1]) blok(0.3, GOOT, 0.3, M.kozijn, x, GOOT / 2, z);
  // het dak: twee schuine vlakken van goot tot nok, oost-west, met een overstek
  const halfD = D / 2 + 0.4, schuin = Math.hypot(halfD, NOK - GOOT), hoek = Math.atan2(NOK - GOOT, halfD);
  for (const s of [-1, 1]) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(B + 0.8, 0.08, schuin), herhaal(M.dak, (B + 0.8) / 1.0, schuin / 1.0));
    d.position.set(MX, (GOOT + NOK) / 2 + 0.04, MZ + s * halfD / 2);
    d.rotation.x = s * hoek;
    d.castShadow = true; d.receiveShadow = true;
    groep.add(d);
  }
  // de topgevels: een driehoek damwand op de oost- en westgevel
  const drie = new THREE.Shape();
  drie.moveTo(-D / 2, 0); drie.lineTo(D / 2, 0); drie.lineTo(0, NOK - GOOT); drie.closePath();
  const drieGeo = new THREE.ExtrudeGeometry(drie, { depth: WAND, bevelEnabled: false });
  drieGeo.translate(0, 0, -WAND / 2);
  for (const x of [X0, X1]) {
    const t = new THREE.Mesh(drieGeo, M.wand); t.position.set(x, GOOT, MZ); t.rotation.y = Math.PI / 2;
    t.castShadow = true; groep.add(t);
  }

  // ---- binnen ----
  blok(B - 0.4, 0.05, D - 0.4, M.vloer, MX, 0.14, MZ, { schaduw: false });
  // de binnenkant van de gevels: een donkere, iets verlichte laag, zodat je door de
  // deur niet de achterkant van de damwand ziet
  blok(B - 0.5, GOOT - 0.2, 0.04, M.binnen, MX, GOOT / 2, Z1 - 0.13, { schaduw: false });
  blok(0.04, GOOT - 0.2, D - 0.5, M.binnen, X0 + 0.13, GOOT / 2, MZ, { schaduw: false });
  for (let x = X0 + 3; x < X1 - 1; x += 5) blok(0.18, 0.06, 1.3, M.tl, x, GOOT - 0.3, MZ, { schaduw: false, ontvang: false });
  // de tafel met de tassen
  blok(2.4, 0.06, 1.1, M.tafel, 1409.6, 0.92, -188.2);
  for (const [dx, dz] of [[-1.1, -0.45], [1.1, -0.45], [-1.1, 0.45], [1.1, 0.45]]) blok(0.07, 0.8, 0.07, M.staal, 1409.6 + dx, 0.52, -188.2 + dz);
  const tassen = [];
  for (const [dx, dz, r] of [[-0.7, -0.15, 0.2], [0.05, 0.2, -0.3], [0.8, -0.1, 0.1]]) {
    const t = maakTas(scene);
    t.zet(1409.6 + dx, 0.95, -188.2 + dz, r); t.toon(true);
    tassen.push(t);
  }
  // pallets met kratten tegen de westgevel
  for (const [x, z, n] of [[1398.5, -191.5, 3], [1398.5, -188.8, 2], [1398.5, -185.8, 4]]) {
    blok(1.2, 0.14, 1.0, M.pallet, x, 0.21, z);
    for (let i = 0; i < n; i++) blok(0.6, 0.32, 0.4, M.krat, x + (i % 2 ? 0.28 : -0.28), 0.44 + Math.floor(i / 2) * 0.34, z + 0.1);
  }
  /*
   Het bord met de namen. Het staat op een verrijdbare standaard vlak achter het
   raam in de oostgevel, met de voorkant naar het raam: zo zie je het van buiten.
  */
  const bord = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.35), M.bord);
  M.bord.emissiveMap = M.bord.map;
  bord.position.set(FOTOS[1].kijk.x, 1.75, FOTOS[1].kijk.z); bord.rotation.y = Math.PI / 2;
  groep.add(bord);
  blok(0.05, 1.45, 2.4, M.staal, FOTOS[1].kijk.x - 0.04, 1.75, FOTOS[1].kijk.z);
  for (const dz of [-1.0, 1.0]) blok(0.05, 1.05, 0.05, M.staal, FOTOS[1].kijk.x - 0.06, 0.55, FOTOS[1].kijk.z + dz);
  for (const dz of [-1.0, 1.0]) blok(0.6, 0.05, 0.05, M.staal, FOTOS[1].kijk.x - 0.06, 0.05, FOTOS[1].kijk.z + dz);

  // ---- de container op het erf ----
  const C = CONTAINER;
  const cont = blok(C.b, C.h, C.l, M.container, C.x, 0.15 + C.h / 2, C.z);
  // (de vlakken van een doos: +x, −x, +y, −y, +z, −z; de ribben op de lange zijden)
  cont.material = [M.container, M.container, M.containerKop, M.containerKop, M.containerKop, M.containerKop];

  // ---- botsdozen: de gevels (met de roldeur als gat), de container, de kade-rand ----
  const muur = (x0, x1, z0, z1) => addCollider((x0 + x1) / 2, (z0 + z1) / 2, Math.max(0.12, (x1 - x0) / 2), Math.max(0.12, (z1 - z0) / 2), 0, BOTS_H);
  muur(X0, DEUR.x0, Z0 - 0.1, Z0 + 0.1);
  muur(DEUR.x1, X1, Z0 - 0.1, Z0 + 0.1);
  muur(X0, X1, Z1 - 0.1, Z1 + 0.1);
  muur(X0 - 0.1, X0 + 0.1, Z0, Z1);
  muur(X1 - 0.1, X1 + 0.1, Z0, Z1);
  addCollider(C.x, C.z, C.b / 2, C.l / 2, 0, C.h + 0.15);
  addCollider(1409.6, -188.2, 1.2, 0.55, 0, 1.0);                         // de tafel
  addCollider(FOTOS[1].kijk.x - 0.05, FOTOS[1].kijk.z, 0.1, 1.2, 0, 2.4);   // het bord

  // ---- de lijn en de rit ----
  let lijn = null;
  const lijnNu = () => (lijn || (lijn = bouwLijn(KAART)));
  let prof = null;
  // de stop bij Parelmoervlinder 3: het monster op de lijn dat het dichtst bij de voordeur ligt
  let stopS = null;
  function maakProfiel() {
    const L = lijnNu();
    if (!L) return null;
    const v = new Float32Array(L.n);
    for (let i = 0; i < L.n; i++) {
      let kmax = 0;
      for (let j = i; j < Math.min(L.n, i + 8); j++) kmax = Math.max(kmax, L.k[j]);
      v[i] = Math.min(L.vmax[i], Math.sqrt(SCHADUW.dwars / Math.max(kmax, 1e-4)));
    }
    // (de voordeur komt van js/verhaal.js: `schriftDeur`, het adres van missie 13)
    const huis = (typeof stopBij === 'function' ? stopBij() : stopBij) || { x: 1263.8, z: 363.9 };
    let bi = 0, bd = Infinity;
    for (let i = 0; i < L.n; i++) { const d = Math.hypot(L.x[i] - huis.x, L.z[i] - huis.z); if (d < bd) { bd = d; bi = i; } }
    stopS = L.s[bi];
    v[bi] = 0; v[L.n - 1] = 0;
    for (let i = L.n - 2; i >= 0; i--) {
      const ds = L.s[i + 1] - L.s[i];
      v[i] = Math.min(v[i], Math.sqrt(v[i + 1] * v[i + 1] + 2 * SCHADUW.remmen * ds));
    }
    return v;
  }
  function punt(s, u = 0) {
    const L = lijnNu();
    if (!L) return null;
    s = Math.max(0, Math.min(L.lengte, s));
    let a = 0, b = L.n - 1;
    while (b - a > 1) { const m = (a + b) >> 1; if (L.s[m] <= s) a = m; else b = m; }
    const f = L.s[b] > L.s[a] ? (s - L.s[a]) / (L.s[b] - L.s[a]) : 0;
    const x = L.x[a] + (L.x[b] - L.x[a]) * f, z = L.z[a] + (L.z[b] - L.z[a]) * f;
    const tx = L.tx[a], tz = L.tz[a];
    return { x: x - tz * u, z: z + tx * u, tx, tz, i: a, yaw: Math.atan2(-tx, -tz) };
  }
  // hoe ver rechts: de rijstrook, behalve op het plein van de BP en op het erf
  function opzij(s) {
    const L = lijnNu(), p = punt(s);
    const rand = Math.min(1, s / 20, (L.lengte - 40 - s) / 20);
    return L.baan[p.i] * Math.max(0, rand);
  }

  /*
   De rit. `st` is de toestand van één rit (s langs de lijn, v, de stop). Elke stap
   gaat de auto daarheen en wordt hij neergezet zoals een tegenstander in de race.
   Terug (`vlucht`): dezelfde lijn achteruit, aan de andere kant van de weg en met
   de neus de andere kant op.
  */
  function nieuweRit() { if (!prof) prof = maakProfiel(); return { s: 0, v: 0, wacht: 0, gestopt: false, klaar: false, vlucht: false, weg: false }; }
  function rijd(st, car, dt) {
    const L = lijnNu();
    if (!L || !car || st.weg) return st;
    if (!prof) prof = maakProfiel();
    const vorig = st.v, vorigeYaw = car.yaw;
    if (st.vlucht) {
      st.v = Math.min(SCHADUW.vlucht, st.v + 4.5 * dt);
      st.s -= st.v * dt;
      if (st.s <= 0) { st.s = 0; st.weg = true; }
    } else if (st.wacht > 0) {
      st.wacht -= dt; st.v = 0;
    } else if (!st.klaar) {
      const i = Math.min(L.n - 1, Math.max(0, Math.round(st.s / SCHADUW.stap)));
      // (vlak voor de stop telt het profiel van het monster erna niet: anders kruipt hij er langs)
      const doel = !st.gestopt && stopS != null && st.s < stopS ? Math.min(prof[i], Math.sqrt(2 * SCHADUW.remmen * Math.max(0, stopS - st.s))) : prof[i];
      if (st.v < doel) st.v = Math.min(doel, st.v + SCHADUW.optrek * dt);
      else st.v = Math.max(doel, st.v - 6 * dt);
      // het profiel is nul óp de stop en het einde: het laatste stukje kruipt hij, anders komt hij er nooit
      st.v = Math.max(st.v, 0.4);
      st.s += st.v * dt;
      if (!st.gestopt && stopS != null && st.s >= stopS - 0.3) { st.s = stopS; st.v = 0; st.gestopt = true; st.wacht = SCHADUW.stopT; }
      if (st.s >= L.lengte - 0.2) { st.s = L.lengte; st.v = 0; st.klaar = true; }
    }
    const p = punt(st.s, st.vlucht ? -opzij(st.s) : opzij(st.s));
    car.x = p.x; car.z = p.z; car.yaw = st.vlucht ? p.yaw + Math.PI : p.yaw;
    car.speed = st.v;
    vehicles.zetNeer(car, dt, vorigeYaw, { gas: st.v > vorig, rem: st.v < vorig - 0.02 || st.wacht > 0 });
    return st;
  }
  /*
   Ligt (x, z) op zijn route? Zolang je hem volgt komt daar geen wijkverkeer
   (js/vehicles.js `vrijeZone`, zoals bij de race): hij rijdt kinematisch en zou er
   dwars doorheen gaan, en een auto die voor jou stilstaat hield de proef tegen.
  */
  let routeCellen = null;
  function opRoute(x, z) {
    const L = lijnNu();
    if (!L) return false;
    const C = 10, BREED = 12;
    if (!routeCellen) {
      routeCellen = new Set();
      const r = Math.ceil(BREED / C);
      for (let i = 0; i < L.n; i += 2) {
        const ci = Math.floor(L.x[i] / C), cj = Math.floor(L.z[i] / C);
        for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) routeCellen.add((ci + a) * 100003 + (cj + b));
      }
    }
    if (!routeCellen.has(Math.floor(x / C) * 100003 + Math.floor(z / C))) return false;
    return voortgang(x, z).af < BREED;
  }

  // waar ben je langs de lijn? (voor de proef en de afstand langs de weg)
  function voortgang(x, z, rond = null) {
    const L = lijnNu();
    if (!L) return { s: 0, i: 0, af: Infinity };
    let beste = 0, bd = Infinity;
    const i0 = rond == null ? 0 : Math.max(0, rond - 60), i1 = rond == null ? L.n - 1 : Math.min(L.n - 1, rond + 120);
    for (let i = i0; i <= i1; i++) {
      const d = (L.x[i] - x) ** 2 + (L.z[i] - z) ** 2;
      if (d < bd) { bd = d; beste = i; }
    }
    return { s: L.s[beste], i: beste, af: Math.sqrt(bd) };
  }

  return {
    groep, punt, voortgang, rijd, nieuweRit, opzij, opRoute,
    get lijn() { return lijnNu(); },
    get profiel() { if (!prof) prof = maakProfiel(); return prof; },
    get stopS() { if (!prof) prof = maakProfiel(); return stopS; },
    fotos: FOTOS, posten: POSTEN, opHetErf, container: CONTAINER, bus: BUS, boot: BOOT, bouwmanStaat: BOUWMAN_STAAT,
    loods: { x0: X0, x1: X1, z0: Z0, z1: Z1, deur: { x: (DEUR.x0 + DEUR.x1) / 2, z: Z0 - 1.5 }, raam: RAAM },
  };
}
