/*
 De oude Geeuwbrug (stap 161): het betonnen landhoofd met het brugwachtershuisje aan de Geeuw, naast de rijksweg en het
 fietspad (Stadsrondweg-Zuid 90, BAG 0091100000016709, bouwjaar 1966). Gevraagd: "herbouw ook locatie -77.4, -459.8 zie
 foto ingame. dit is een deel van de oude geeuw brug. Zie torentje met tekst geeuwbrug."

 Wat er stond: het geschatte 3D BAG-blok, een lage muur van 3,4 m over 28 × 18 m in het baksteen van een `spil`-pand,
 met in de hoek een smalle toren van 9,2 m. De BAG-voetafdruk is breder dan wat er staat; het betonnen landhoofd zelf
 staat in de BGT als `bouwwerk` (8,2 m breed, 29 m lang, de korte kant aan het water, en aan het water een lage plaat
 van 0,5 m die tot in de Geeuw loopt). Op dat bouwwerk staat het hier, met de maten en de indeling van de foto's
 (Street View juli 2025 en een luchtfoto):

   het basement   een lange, lage betonnen doos van 2,4 m (2,7 m met de dakrand), met een iets uitstekende dakrand (`lijst`), grijs en verweerd,
                  over de hele lengte graffiti (`tekenGraffiti`: verzonnen woorden in grote letters, contouren, druipers,
                  tags, overgeschilderde vlakken), een paar dichtgemetselde openingen en een roestig stalen deurtje; het
                  dak plat in vakken (`dakDoek`). Op de korte kant aan de landkant een groot stuk met zwart-gele randen
                  (`tekenKop`).
   de voet        het torentje staat op het eind aan het water, op een smallere kolom van 2 × 2 m en 2,5 m hoog, onderaan
                  een rood-roze stuk (`tekenVoet`).
   de cabine      de bedieningscabine van ~3,6 × 3,2 m die naar onderen smaller wordt (de schuine onderkant), rondom ramen
                  met blauwe kozijnen (een paar ruiten kapot), een plat dakje met een randje, en onder de ramen een wit
                  bordje "Geeuwbrug" (`tekenBord`), op de kop aan het water en op de kant naar het fietspad.

 Alle doeken op canvas (geen afbeeldingsbestanden), uv in meters. Gewone MeshStandardMaterials met een kaart of een
 kleur, enkelzijdig, bij het opstarten gemaakt: geen nieuw programma tijdens het spelen.

 js/kaartwereld.js slaat de geometrie én de botsdozen van het BAG-pand over (`GEEUW_PANDEN`: de doos van de voetafdruk
 zou op het gras ernaast een onzichtbare muur zijn); dit bestand zet zijn eigen botsdozen. Het groen houdt
 js/bouwvlak.js (`GEEUWBRUG`) eruit.

 Het assenstelsel: `u` langs het landhoofd, 0 aan de landkant en `L` aan het water; `v` dwars, 0 aan de lange zijde
 waar de toren staat (de BAG-toren staat daar) en `B` aan de andere; `y` omhoog vanaf de grond.
*/
import * as THREE from 'three';
import { grondHoogte } from './viaduct.js';

export const GEEUW = {
  pand: '0091100000016709',
  hoog: 2.4,           // de wanden van het basement (met de dakrand 2,7 m)
  lijst: 0.3,          // de dakrand: zo hoog …
  lijstUit: 0.22,      // … en zo ver steekt hij uit
  voet: { b: 2.0, h: 2.5, eind: 0.1 },               // de kolom onder de cabine; `eind`: zo ver van de kop aan het water
  // het midden van de cabine: zo ver vóór de kop (negatief: over het water). In de BAG staat de toren 1,2 m over het eind
  // heen; de foto's tonen hem op de voet op het basement. Dit midden houdt de voet onder de cabine.
  cabineU: -0.6,
  cabine: { b: 3.6, d: 3.2, onder: 0.45, h: 2.3, krimp: 0.3 },   // b langs u, d langs v; `krimp` per kant aan de onderkant
  raam: { y0: 0.75, y1: 2.05, stijl: 0.07, vak: 0.85 },           // vanaf de onderkant van de rechte wand
  wandDoek: 32,        // de graffiti herhaalt zich om de 32 m
};
export const GEEUW_PANDEN = new Set([GEEUW.pand]);

// ------------------------------------------------------------------ doeken
const doek = (b, h, teken) => {
  const c = document.createElement('canvas'); c.width = b; c.height = h;
  teken(c.getContext('2d'), b, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};
let zaad = 1966;
const ruis = () => { zaad = (zaad * 16807) % 2147483647; return zaad / 2147483647; };
const kies = (a) => a[Math.floor(ruis() * a.length) % a.length];

// verweerd beton: grijs met korrel, vlekken, strepen van de dakrand naar beneden en vuil onderaan
function beton(g, b, h, { basis = '#a3a198', strepen = true, voegen = 0 } = {}) {
  g.fillStyle = basis; g.fillRect(0, 0, b, h);
  for (let i = 0; i < b * h / 60; i++) { const c = 120 + ruis() * 70; g.fillStyle = `rgba(${c},${c},${c - 6},0.22)`; g.fillRect(ruis() * b, ruis() * h, 1 + ruis() * 2, 1 + ruis() * 2); }
  for (let i = 0; i < b * h / 9000 + 3; i++) {
    const x = ruis() * b, y = ruis() * h, r = 20 + ruis() * h * 0.5;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const k = kies(['70,66,58', '95,98,80', '160,158,150', '60,64,55']);
    gr.addColorStop(0, `rgba(${k},${0.12 + ruis() * 0.12})`); gr.addColorStop(1, `rgba(${k},0)`);
    g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  if (strepen) for (let i = 0; i < b / 6; i++) {
    const x = ruis() * b, l = h * (0.15 + ruis() * 0.6);
    const gr = g.createLinearGradient(0, 0, 0, l);
    gr.addColorStop(0, `rgba(40,38,34,${0.12 + ruis() * 0.18})`); gr.addColorStop(1, 'rgba(40,38,34,0)');
    g.fillStyle = gr; g.fillRect(x, 0, 1 + ruis() * 4, l);
  }
  // vuil en groen onderaan
  const gr = g.createLinearGradient(0, h, 0, h * 0.82);
  gr.addColorStop(0, 'rgba(48,52,38,0.55)'); gr.addColorStop(1, 'rgba(48,52,38,0)');
  g.fillStyle = gr; g.fillRect(0, h * 0.82, b, h * 0.18);
  if (voegen) { g.fillStyle = 'rgba(45,45,42,0.45)'; for (let x = 0; x < b; x += voegen) g.fillRect(x, 0, 2, h); }
}

const KLEUREN = ['#f4f1ea', '#ff6fb1', '#2f7de1', '#e23b2e', '#3fbf4a', '#ffd23a', '#8a4fd0', '#ff8a2a', '#36c6d8', '#1b1b1b'];
// verzonnen woorden; geen bestaande namen of crews
const WOORDEN = ['ZOEF', 'KRAK', 'BLOEP', 'VLAM', 'ROEF', 'DUUM', 'PLONS', 'GROK', 'TJOEK', 'WOEP', 'SKOE', 'BRAM', 'FJOEW', 'KLETS', 'HOEI', 'ZWIEP'];
const LETTER = '900 {S}px "Arial Black", "Impact", "Haettenschweiler", "Franklin Gothic Heavy", sans-serif';

/*
 Een graffitistuk: grote letters die schuin en scheef staan, met een zwarte contour, een donkere schaduw, een vulling
 in twee kleuren, witte glimlichten en druipers onder de letters. Soms een wolk erachter.
*/
function stuk(g, x, y, grootte, woord, { kleur1 = kies(KLEUREN), kleur2 = kies(KLEUREN), wolk = ruis() < 0.5 } = {}) {
  g.save();
  g.translate(x, y); g.rotate((ruis() - 0.5) * 0.12);
  g.font = LETTER.replace('{S}', Math.round(grootte));
  g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
  const letters = [...woord], breedtes = letters.map(l => g.measureText(l).width * 0.86);
  const totaal = breedtes.reduce((a, b) => a + b, 0);
  if (wolk) {
    g.fillStyle = kies(['#f4f1ea', '#36c6d8', '#ffd23a', '#ff6fb1', '#9be15d']);
    g.strokeStyle = '#111'; g.lineWidth = Math.max(2, grootte * 0.04);
    g.beginPath();
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2, rx = totaal * 0.6, ry = grootte * 0.62;
      const px = totaal / 2 + Math.cos(a) * rx * (0.9 + ruis() * 0.2), py = -grootte * 0.38 + Math.sin(a) * ry * (0.9 + ruis() * 0.2);
      if (i === 0) g.moveTo(px, py); else g.quadraticCurveTo(px + (ruis() - 0.5) * 20, py + (ruis() - 0.5) * 20, px, py);
    }
    g.closePath(); g.fill(); g.stroke();
  }
  let lx = 0;
  const plek = letters.map((l, i) => { const p = { l, x: lx, y: (ruis() - 0.5) * grootte * 0.18, r: (ruis() - 0.5) * 0.3 }; lx += breedtes[i]; return p; });
  const teken = (dx, dy, f) => { for (const p of plek) { g.save(); g.translate(p.x + dx, p.y + dy); g.rotate(p.r); g.transform(1, 0, -0.12, 1, 0, 0); f(p.l); g.restore(); } };
  // schaduw (3D), contour, vulling
  g.fillStyle = 'rgba(15,15,20,0.85)'; teken(grootte * 0.07, grootte * 0.06, l => g.fillText(l, 0, 0));
  g.strokeStyle = '#121212'; g.lineWidth = Math.max(3, grootte * 0.13); teken(0, 0, l => g.strokeText(l, 0, 0));
  const gr = g.createLinearGradient(0, -grootte * 0.75, 0, 0);
  gr.addColorStop(0, kleur1); gr.addColorStop(0.55, kleur1); gr.addColorStop(0.6, kleur2); gr.addColorStop(1, kleur2);
  g.fillStyle = gr; teken(0, 0, l => g.fillText(l, 0, 0));
  // glimlichten
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = Math.max(1, grootte * 0.025);
  teken(-grootte * 0.02, -grootte * 0.02, l => { g.beginPath(); g.moveTo(grootte * 0.08, -grootte * 0.6); g.lineTo(grootte * 0.08, -grootte * 0.38); g.stroke(); });
  // druipers
  g.lineCap = 'round';
  for (let i = 0; i < letters.length * 2; i++) {
    const px = ruis() * totaal, l = grootte * (0.1 + ruis() * 0.45);
    g.strokeStyle = ruis() < 0.7 ? kleur2 : '#121212'; g.lineWidth = Math.max(1.5, grootte * (0.02 + ruis() * 0.025));
    g.beginPath(); g.moveTo(px, -grootte * 0.05); g.lineTo(px, l); g.stroke();
    g.fillStyle = g.strokeStyle; g.beginPath(); g.arc(px, l, g.lineWidth * 0.8, 0, Math.PI * 2); g.fill();
  }
  g.restore();
  return totaal;
}
// een tag: een snel krabbeltje met een stift of een spuitbus
function tag(g, x, y, grootte) {
  g.save(); g.translate(x, y); g.rotate((ruis() - 0.5) * 0.5);
  g.font = `italic 700 ${Math.round(grootte)}px "Segoe Script", "Brush Script MT", "Comic Sans MS", cursive`;
  g.fillStyle = kies(['#111', '#111', '#e8e8e8', '#c8302a', '#2f7de1', '#c0c0c8']);
  const w = kies(['zk1', 'mopz', 'rtx', 'eeh', 'vlo', 'qbn', 'jawz', 'nuk']);
  g.fillText(w, 0, 0);
  g.strokeStyle = g.fillStyle; g.lineWidth = Math.max(1, grootte * 0.06);
  g.beginPath(); g.moveTo(-grootte * 0.2, grootte * 0.2); g.quadraticCurveTo(grootte, grootte * 0.5, g.measureText(w).width + grootte * 0.3, -grootte * 0.1); g.stroke();
  g.restore();
}

// de lange wand: 32 m op 2,6 m. Stukken om de paar meter, tags ertussen, een paar grijs overgeschilderde vlakken
export function tekenGraffiti(g, b, h) {
  beton(g, b, h, { voegen: b / 32 * 4.0 });
  const pm = b / GEEUW.wandDoek;                              // beeldpunten per meter
  // overgeschilderde vlakken (een iets andere grijs)
  for (let i = 0; i < 5; i++) { g.fillStyle = kies(['#9a9890', '#b0aea6', '#8f9089']); g.fillRect(ruis() * b, h * (0.15 + ruis() * 0.3), pm * (1 + ruis() * 2.5), h * (0.3 + ruis() * 0.3)); }
  const zet = (f, x) => { for (const dx of [-b, 0, b]) f(x + dx); };   // over de naad heen (het doek herhaalt)
  let x = pm * 0.4;
  while (x < b - pm * 1.5) {
    const grootte = h * (0.42 + ruis() * 0.2), woord = kies(WOORDEN), y = h * (0.68 + ruis() * 0.1);
    const z0 = zaad, x0 = x;
    let w = 0;
    zet((xx) => { zaad = z0; w = stuk(g, xx, y, grootte, woord); }, x0);
    x += w + pm * (0.15 + ruis() * 0.9);
  }
  for (let i = 0; i < 26; i++) { const xx = ruis() * b, y = h * (0.2 + ruis() * 0.7), z0 = zaad, gr = h * (0.08 + ruis() * 0.08); zet((q) => { zaad = z0; tag(g, q, y, gr); }, xx); }
}
// de korte kant aan de landkant: één groot stuk binnen een rand van zwart-gele schuine strepen
export function tekenKop(g, b, h) {
  beton(g, b, h);
  const r = h * 0.1;
  g.save();
  g.beginPath(); g.rect(0, 0, b, h); g.rect(r, r, b - 2 * r, h - 2 * r); g.clip('evenodd');
  g.fillStyle = '#f2c81e'; g.fillRect(0, 0, b, h);
  g.fillStyle = '#151515';
  for (let x = -h; x < b + h; x += r * 2) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + r, 0); g.lineTo(x + r - h, h); g.lineTo(x - h, h); g.fill(); }
  g.restore();
  g.fillStyle = '#2b3d6b'; g.fillRect(r, r, b - 2 * r, h - 2 * r);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${kies(['255,111,177', '54,198,216', '255,255,255'])},${0.2 + ruis() * 0.4})`; g.beginPath(); g.arc(r + ruis() * (b - 2 * r), r + ruis() * (h - 2 * r), 2 + ruis() * 8, 0, Math.PI * 2); g.fill(); }
  const grootte = h * 0.5;
  g.font = LETTER.replace('{S}', Math.round(grootte));
  const w = g.measureText('SNITS').width * 0.86;
  stuk(g, (b - w) / 2, h * 0.7, grootte, 'SNITS', { kleur1: '#ff6fb1', kleur2: '#ffd23a', wolk: false });
}
// de voet van het torentje: beton, onderaan een groot rood-roze stuk
export function tekenVoet(g, b, h) {
  beton(g, b, h);
  g.save();
  g.fillStyle = '#e0335a'; g.strokeStyle = '#121212'; g.lineWidth = b * 0.03;
  g.beginPath(); g.moveTo(0, h * 0.5);
  for (let i = 0; i <= 8; i++) g.quadraticCurveTo(b * (i + 0.5) / 8, h * (0.4 + ruis() * 0.12), b * (i + 1) / 8, h * (0.47 + ruis() * 0.06));
  g.lineTo(b, h); g.lineTo(0, h); g.closePath(); g.fill(); g.stroke();
  g.restore();
  stuk(g, b * 0.08, h * 0.86, h * 0.26, 'RK', { kleur1: '#ff9ccf', kleur2: '#ff4f86', wolk: false });
}
// het bordje: wit, zwarte letters, een dun zwart randje en wat vuil
export function tekenBord(g, b, h) {
  g.fillStyle = '#f2f1ec'; g.fillRect(0, 0, b, h);
  g.strokeStyle = '#1a1a1a'; g.lineWidth = h * 0.06; g.strokeRect(h * 0.06, h * 0.06, b - h * 0.12, h - h * 0.12);
  g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `700 ${Math.round(h * 0.62)}px "Helvetica Neue", "Arial", sans-serif`;
  g.fillText('Geeuwbrug', b / 2, h * 0.54);
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(90,85,70,${0.04 + ruis() * 0.08})`; g.fillRect(ruis() * b, ruis() * h, 2 + ruis() * 6, 2 + ruis() * 10); }
}
// het platte dak: beton in vakken van 4 m met donkere naden en wat mos
function dakDoek() {
  return doek(256, 256, (g, b, h) => {
    beton(g, b, h, { basis: '#9d9b92', strepen: false });
    for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(70,90,40,${0.1 + ruis() * 0.15})`; g.beginPath(); g.arc(ruis() * b, ruis() * h, 6 + ruis() * 22, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#4a4943'; g.fillRect(0, 0, b, 4); g.fillRect(0, 0, 4, h);
  });
}
// dichtgemetselde opening: betonblokken met voegen
function blokDoek() {
  return doek(128, 128, (g, b, h) => {
    g.fillStyle = '#8a8880'; g.fillRect(0, 0, b, h);
    const bh = h / 5, bb = b / 2.5;
    for (let r = 0; r < 5; r++) for (let k = -1; k < 3; k++) {
      const c = 120 + ruis() * 30; g.fillStyle = `rgb(${c},${c - 2},${c - 8})`;
      g.fillRect(k * bb + (r % 2) * bb / 2 + 2, r * bh + 2, bb - 4, bh - 4);
    }
  });
}
// het stalen deurtje: roest over grijze verf
function roestDoek() {
  return doek(128, 256, (g, b, h) => {
    g.fillStyle = '#5d625f'; g.fillRect(0, 0, b, h);
    for (let i = 0; i < 400; i++) { const c = kies(['122,62,30', '150,80,36', '90,48,26']); g.fillStyle = `rgba(${c},${0.2 + ruis() * 0.5})`; g.beginPath(); g.arc(ruis() * b, ruis() * h, 1 + ruis() * 7, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = 'rgba(30,30,30,0.7)'; g.lineWidth = 3; g.strokeRect(6, 6, b - 12, h - 12);
    g.fillStyle = '#2a2a2a'; g.fillRect(b * 0.78, h * 0.48, b * 0.1, h * 0.05);
    tag(g, b * 0.1, h * 0.3, h * 0.12);
  });
}

// ------------------------------------------------------------------ meten
const binnenRing = (x, z, v) => { let c = false; for (let i = 0, j = v.length - 1; i < v.length; j = i++) { const a = v[i], b = v[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
const inVlak = (x, z, v) => binnenRing(x, z, v.r[0]) && !v.r.slice(1).some(r => binnenRing(x, z, r));

/**
 * Het assenstelsel uit de kaart: het BGT-bouwwerk binnen de BAG-voetafdruk geeft de richting (zijn langste rand) en
 * het smalle deel (8,2 m); het water zegt welk eind de kop aan het water is, de hoge punten van het BAG-model aan welke
 * lange zijde de toren staat. Geeft null als het pand of het bouwwerk ontbreekt.
 */
export function geeuwAssen(K) {
  const p = (K.panden || []).find(q => q.id === GEEUW.pand);
  if (!p) return null;
  const bw = (K.vlakken || []).find(v => {
    if (v.k !== 'bouwwerk') return false;
    const r = v.r[0]; let cx = 0, cz = 0; for (const q of r) { cx += q[0]; cz += q[1]; }
    return binnenRing(cx / r.length, cz / r.length, p.voet);
  });
  if (!bw) return null;
  const ring = bw.r[0];
  // de richting: de langste rand van het bouwwerk
  let e0 = [1, 0], best = 0, ia = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l > best) { best = l; e0 = [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; ia = i; }
  }
  const n0 = [-e0[1], e0[0]];
  const U = (q) => q[0] * e0[0] + q[1] * e0[1], Vv = (q) => q[0] * n0[0] + q[1] * n0[1];
  const vZ = Vv(ring[ia]);
  // de andere lange zijde: de punten tussen 6 en 9,5 m ervandaan (de lage plaat aan het water ligt verder weg)
  const over = ring.map(Vv).filter(v => Math.abs(v - vZ) > 6 && Math.abs(v - vZ) < 9.5).sort((a, b) => a - b);
  const vA = over.length ? over[Math.floor(over.length / 2)] : vZ + 8;
  // de lengte: langs de zijde van de langste rand
  const zij = ring.filter(q => Math.abs(Vv(q) - vZ) < 0.8).map(U);
  const u0 = Math.min(...zij), u1 = Math.max(...zij);
  // welk eind ligt aan het water?
  const water = (K.vlakken || []).filter(v => v.k === 'water');
  const vm = (vZ + vA) / 2;
  const nat = (u) => { const x = u * e0[0] + vm * n0[0], z = u * e0[1] + vm * n0[1]; return water.some(v => inVlak(x, z, v)); };
  let t0 = 0, t1 = 0;
  for (const d of [1.5, 3, 4.5, 6, 7.5]) { if (nat(u0 - d)) t0++; if (nat(u1 + d)) t1++; }
  const sE = t1 >= t0 ? 1 : -1;
  // de zijde van de toren: het zwaartepunt van de hoge punten in het BAG-model (anders de zijde van de langste rand)
  const V = p.v || [];
  let tx = 0, tz = 0, tn = 0;
  for (let i = 0; i < V.length; i += 3) if (V[i + 1] > (p.goot || 3) + 2) { tx += V[i]; tz += V[i + 2]; tn++; }
  let vT = vZ, vO = vA;
  if (tn) { const vt = Vv([tx / tn, tz / tn]); if (Math.abs(vt - vA) < Math.abs(vt - vZ)) { vT = vA; vO = vZ; } }
  const sN = vO > vT ? 1 : -1;
  const e = [sE * e0[0], sE * e0[1]], n = [sN * n0[0], sN * n0[1]];
  const uLand = sE > 0 ? u0 : u1;
  const O = [uLand * e0[0] + vT * n0[0], uLand * e0[1] + vT * n0[1]];
  return { e, n, O, L: u1 - u0, B: Math.abs(vO - vT), toren: tn ? [tx / tn, tz / tn] : null, pand: p, bouwwerk: bw };
}

// ------------------------------------------------------------------ bouwen
/**
 * Bouwt het landhoofd met het torentje. Geeft `{ groep, materialen, maten, wereld, assen }` terug, of null als het pand
 * of het bouwwerk niet in de kaart staat.
 */
export function bouwGeeuwbrug(scene, K, W) {
  const A = geeuwAssen(K);
  if (!A) return null;
  const { e, n, O, L, B } = A;
  const G = GEEUW, H = G.hoog, TOP = H + G.lijst;
  const mx = O[0] + e[0] * L / 2 + n[0] * B / 2, mz = O[1] + e[1] * L / 2 + n[1] * B / 2;
  const Y0 = Math.max(0, grondHoogte(mx, mz, Infinity) || 0);
  const wereld = (u, y, v) => new THREE.Vector3(O[0] + u * e[0] + v * n[0], Y0 + y, O[1] + u * e[1] + v * n[1]);
  const E3 = new THREE.Vector3(e[0], 0, e[1]), N3 = new THREE.Vector3(n[0], 0, n[1]), Y3 = new THREE.Vector3(0, 1, 0);

  const MAT = {
    wand: new THREE.MeshStandardMaterial({ map: doek(3072, 256, tekenGraffiti), roughness: 0.92 }),
    kop: new THREE.MeshStandardMaterial({ map: doek(1024, 300, tekenKop), roughness: 0.9 }),
    beton: new THREE.MeshStandardMaterial({ map: doek(256, 256, (g, b, h) => beton(g, b, h)), roughness: 0.93 }),
    dak: new THREE.MeshStandardMaterial({ map: dakDoek(), roughness: 0.95 }),
    voet: new THREE.MeshStandardMaterial({ map: doek(256, 320, tekenVoet), roughness: 0.9 }),
    blok: new THREE.MeshStandardMaterial({ map: blokDoek(), roughness: 0.95 }),
    roest: new THREE.MeshStandardMaterial({ map: roestDoek(), roughness: 0.8, metalness: 0.3 }),
    raam: new THREE.MeshStandardMaterial({ color: 0x40586a, roughness: 0.1, metalness: 0.5 }),
    kapot: new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1.0 }),
    kozijn: new THREE.MeshStandardMaterial({ color: 0x2a64b4, roughness: 0.55, metalness: 0.1 }),
    bord: new THREE.MeshStandardMaterial({ map: doek(512, 128, tekenBord), roughness: 0.6 }),
  };
  // uv in meters: de herhaling per materiaal
  MAT.wand.map.repeat.set(1 / G.wandDoek, 1 / H);
  MAT.kop.map.repeat.set(1 / (B + 0.08), 1 / H);
  MAT.beton.map.repeat.set(1 / 2, 1 / 2);
  // het dak in zes vakken over de lengte en één over de breedte (de luchtfoto)
  MAT.dak.map.repeat.set(6 / L, 1 / (B + 0.52));
  MAT.dak.map.offset.set(0, 0.26 / (B + 0.52));
  MAT.voet.map.repeat.set(1 / G.voet.b, 1 / G.voet.h);
  MAT.roest.map.repeat.set(1 / 0.9, 1 / 1.9);
  MAT.bord.map.wrapS = MAT.bord.map.wrapT = THREE.ClampToEdgeWrapping;
  MAT.bord.map.repeat.set(1 / 1.7, 1 / 0.42);

  /*
   Per materiaal één geometrie. Een vlak is vier punten in de wereld met de normaal naar buiten; de draairichting volgt
   uit die normaal (dan hoeft niemand na te rekenen welke kant het assenstelsel op draait). De uv: op een wand de meters
   langs de wand (van links naar rechts, gezien van buiten) en de hoogte boven `yRef`; op het dak de meters langs u en v.
  */
  const bak = new Map();
  const vlak = (mat, P, N, uv) => {
    if (!bak.has(mat)) bak.set(mat, { pos: [], uv: [] });
    const g = bak.get(mat);
    const nrm = new THREE.Vector3().subVectors(P[1], P[0]).cross(new THREE.Vector3().subVectors(P[2], P[0]));
    const idx = nrm.dot(N) >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    for (const i of idx) { g.pos.push(P[i].x, P[i].y, P[i].z); g.uv.push(uv[i][0], uv[i][1]); }
  };
  const wandUV = (P, N, yRef, off = 0) => {
    const R = [N.z, -N.x];                                     // rechts, gezien van buiten
    const s = P.map(q => q.x * R[0] + q.z * R[1]), s0 = Math.min(...s);
    return P.map((q, i) => [s[i] - s0 + off, q.y - Y0 - yRef]);
  };
  const dakUV = (P) => P.map(q => [(q.x - O[0]) * e[0] + (q.z - O[1]) * e[1], (q.x - O[0]) * n[0] + (q.z - O[1]) * n[1]]);
  /*
   Een doos in een eigen assenstelsel: oorsprong `o` (wereld x, z), richtingen `a` en `b`, en a0..a1, y0..y1, b0..b1.
   `kanten` uit 'A' (a0), 'a' (a1), 'B' (b0), 'b' (b1), 't' (boven), 'o' (onder); `mats` één materiaal of één per kant;
   `off` per kant de beginmeter op het doek, `yRef` de hoogte waar het doek begint.
  */
  const doos = (o, a, b, a0, a1, y0, y1, b0, b1, kanten, mats, off = {}, yRef = y0) => {
    const P = (s, y, t) => new THREE.Vector3(o[0] + s * a[0] + t * b[0], Y0 + y, o[1] + s * a[1] + t * b[1]);
    const Av = new THREE.Vector3(a[0], 0, a[1]), Bv = new THREE.Vector3(b[0], 0, b[1]);
    const m = (k) => (mats && mats.isMaterial ? mats : mats[k]);
    const wand = (k, Q, N) => { const mm = m(k); if (mm) vlak(mm, Q, N, wandUV(Q, N, yRef, off[k] || 0)); };
    if (kanten.includes('A')) wand('A', [P(a0, y0, b0), P(a0, y0, b1), P(a0, y1, b1), P(a0, y1, b0)], Av.clone().negate());
    if (kanten.includes('a')) wand('a', [P(a1, y0, b0), P(a1, y0, b1), P(a1, y1, b1), P(a1, y1, b0)], Av);
    if (kanten.includes('B')) wand('B', [P(a0, y0, b0), P(a1, y0, b0), P(a1, y1, b0), P(a0, y1, b0)], Bv.clone().negate());
    if (kanten.includes('b')) wand('b', [P(a0, y0, b1), P(a1, y0, b1), P(a1, y1, b1), P(a0, y1, b1)], Bv);
    const vl = (k, Q, N) => { const mm = m(k); if (mm) vlak(mm, Q, N, mm === MAT.dak ? dakUV(Q) : Q.map(q => [q.x, q.z])); };
    if (kanten.includes('t')) vl('t', [P(a0, y1, b0), P(a1, y1, b0), P(a1, y1, b1), P(a0, y1, b1)], Y3);
    if (kanten.includes('o')) vl('o', [P(a0, y0, b0), P(a1, y0, b0), P(a1, y0, b1), P(a0, y0, b1)], Y3.clone().negate());
  };
  const hoofd = (a0, a1, y0, y1, b0, b1, kanten, mats, off, yRef) => doos(O, e, n, a0, a1, y0, y1, b0, b1, kanten, mats, off, yRef);

  // ---- het basement: 4 cm ruimer dan het bouwwerk (de lage rand van het BGT-bouwwerk valt erbinnen)
  const x = 0.04, U = G.lijstUit;
  hoofd(-x, L + x, -0.15, H, -x, B + x, 'AaBb', { A: MAT.kop, a: MAT.wand, B: MAT.wand, b: MAT.wand }, { a: 7, B: 13, b: 0 }, 0);
  // de dakrand: een plaat over het hele dak die rondom uitsteekt; de bovenkant is het dak in vakken
  const zesKant = { A: MAT.beton, a: MAT.beton, B: MAT.beton, b: MAT.beton, t: MAT.dak, o: MAT.beton };
  hoofd(-x - U, L + x + U, H - 0.05, TOP, -x - U, B + x + U, 'AaBbto', zesKant);
  // dichtgemetselde openingen en het roestige deurtje, een paar centimeter voor de wand
  const nissen = [];
  const opening = (mat, zijde, u, br, hg) => {
    const v0 = zijde > 0 ? B + x : -x - 0.03, v1 = zijde > 0 ? B + x + 0.03 : -x;
    hoofd(u, u + br, 0.05, 0.05 + hg, v0, v1, zijde > 0 ? 'Aabt' : 'AaBt', mat);
    nissen.push({ zijde, u, br, hg, soort: mat === MAT.roest ? 'deur' : 'dicht' });
  };
  opening(MAT.blok, 1, L * 0.24, 1.1, 2.0);
  opening(MAT.blok, 1, L * 0.52, 1.0, 1.9);
  opening(MAT.roest, 1, L * 0.71, 0.9, 1.9);
  opening(MAT.blok, -1, L * 0.38, 1.1, 2.0);

  // ---- de voet van het torentje, op het eind aan het water
  const VT = G.voet, C = G.cabine;
  const vu1 = L - VT.eind, vu0 = vu1 - VT.b, vv0 = 0.4, vv1 = vv0 + VT.b;
  const yV0 = TOP, yV1 = TOP + VT.h;
  hoofd(vu0, vu1, yV0 - 0.02, yV1, vv0, vv1, 'AaBb', MAT.voet, {}, yV0);
  // ---- de cabine: de schuine onderkant (smal → breed), de rechte wand, het dakje met een randje
  const cu = L + G.cabineU, cv = C.d / 2;
  const yC0 = yV1, yC1 = yC0 + C.onder, yC2 = yC1 + C.h;
  const k = C.krimp, hb = C.b / 2, hd = C.d / 2;
  const hoek = (du, dv, y) => wereld(cu + du, y, cv + dv);
  for (const [N, q] of [
    [E3, [[hb - k, -hd + k], [hb - k, hd - k], [hb, hd], [hb, -hd]]],
    [E3.clone().negate(), [[-hb + k, hd - k], [-hb + k, -hd + k], [-hb, -hd], [-hb, hd]]],
    [N3, [[hb - k, hd - k], [-hb + k, hd - k], [-hb, hd], [hb, hd]]],
    [N3.clone().negate(), [[-hb + k, -hd + k], [hb - k, -hd + k], [hb, -hd], [-hb, -hd]]],
  ]) {
    const Q = [hoek(q[0][0], q[0][1], yC0), hoek(q[1][0], q[1][1], yC0), hoek(q[2][0], q[2][1], yC1), hoek(q[3][0], q[3][1], yC1)];
    const nS = N.clone().multiplyScalar(C.onder).add(Y3.clone().multiplyScalar(-k)).normalize();   // schuin naar beneden
    vlak(MAT.beton, Q, nS, wandUV(Q, N, yC0));
  }
  hoofd(cu - hb + k, cu + hb - k, yC0, yC0, cv - hd + k, cv + hd - k, 'o', MAT.beton);
  hoofd(cu - hb, cu + hb, yC1, yC2, cv - hd, cv + hd, 'AaBb', MAT.beton, {}, yC1);
  // het dakje: een plaat die 10 cm uitsteekt, met een randje rondom
  const dU = 0.1, ry = yC2 + 0.16;
  hoofd(cu - hb - dU, cu + hb + dU, yC2, ry, cv - hd - dU, cv + hd + dU, 'AaBbto', zesKant);
  for (const [a0, a1, b0, b1] of [
    [cu - hb - dU, cu + hb + dU, cv - hd - dU, cv - hd - dU + 0.08], [cu - hb - dU, cu + hb + dU, cv + hd + dU - 0.08, cv + hd + dU],
    [cu - hb - dU, cu - hb - dU + 0.08, cv - hd - dU, cv + hd + dU], [cu + hb + dU - 0.08, cu + hb + dU, cv - hd - dU, cv + hd + dU],
  ]) hoofd(a0, a1, ry, ry + 0.12, b0, b1, 'AaBbt', MAT.beton);

  // ---- de ramen rondom, met blauwe kozijnen; onder de ramen het bordje (op de kop aan het water en naar het fietspad)
  const R = G.raam, ramen = [], borden = [];
  let kapotTel = 0;
  const c0 = [O[0] + cu * e[0] + cv * n[0], O[1] + cu * e[1] + cv * n[1]];
  for (const [N, hw, hdp, kant] of [[E3, hd, hb, 'water'], [E3.clone().negate(), hd, hb, 'land'], [N3, hb, hd, 'fietspad'], [N3.clone().negate(), hb, hd, 'buiten']]) {
    const r = [N.z, -N.x];                                     // rechts, gezien van buiten
    const o = [c0[0] + N.x * hdp - r[0] * hw, c0[1] + N.z * hdp - r[1] * hw];   // links onder op het wandvlak
    const nz = [N.x, N.z];
    const W2 = 2 * hw, rand = 0.16, y0 = yC1 + R.y0, y1 = yC1 + R.y1;
    const nVak = Math.max(2, Math.round((W2 - 2 * rand) / R.vak)), vb = (W2 - 2 * rand) / nVak;
    for (let i = 0; i < nVak; i++) {
      const s0 = rand + i * vb, kapot = ruis() < 0.2 && kapotTel < 3;
      if (kapot) kapotTel++;
      doos(o, r, nz, s0, s0 + vb, y0, y1, 0.0, 0.015, 'b', kapot ? MAT.kapot : MAT.raam);
      ramen.push({ kant, kapot, s0, s1: s0 + vb });
    }
    // de kozijnen: onder- en bovendorpel, en een stijl op elke naad
    const kz = MAT.kozijn, st = R.stijl / 2;
    doos(o, r, nz, rand - st, W2 - rand + st, y0 - 0.08, y0, 0, 0.06, 'Aabt', kz);
    doos(o, r, nz, rand - st, W2 - rand + st, y1, y1 + 0.08, 0, 0.06, 'Aabto', kz);
    for (let i = 0; i <= nVak; i++) { const s = rand + i * vb; doos(o, r, nz, s - st, s + st, y0, y1, 0, 0.05, 'Aab', kz); }
    if (kant === 'water' || kant === 'fietspad') {
      const bw = 1.7, bh = 0.42, s0 = (W2 - bw) / 2, by0 = yC1 + 0.18;
      doos(o, r, nz, s0, s0 + bw, by0, by0 + bh, 0.02, 0.035, 'b', MAT.bord);
      const midden = new THREE.Vector3(o[0] + r[0] * (s0 + bw / 2) + N.x * 0.035, Y0 + by0 + bh / 2, o[1] + r[1] * (s0 + bw / 2) + N.z * 0.035);
      borden.push({ kant, midden, normaal: N.clone() });
    }
  }

  const groep = new THREE.Group();
  groep.name = 'geeuwbrug';
  for (const [mat, g] of bak) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true; m.receiveShadow = true;
    m.userData.klasse = 'geeuwbrug';
    m.name = Object.keys(MAT).find(k2 => MAT[k2] === mat) || 'geeuwbrug';
    groep.add(m);
  }
  scene.add(groep);

  // ---- botsdozen: het basement en het torentje (dat aan het water een stukje over het eind steekt)
  const yaw = -Math.atan2(e[1], e[0]);
  const dozen = [];
  if (W && W.addCollider) {
    dozen.push(W.addCollider(mx, mz, L / 2 + x, B / 2 + x, yaw, TOP));
    const tc = wereld(cu, 0, cv);
    dozen.push(W.addCollider(tc.x, tc.z, hb, hd, yaw, ry + 0.12));
  }

  const api = {
    groep, materialen: MAT, nissen, ramen, borden, dozen, assen: A, wereld,
    maten: {
      L, B, hoog: H, top: TOP, Y0,
      voet: { u0: vu0, u1: vu1, v0: vv0, v1: vv1, y0: yV0, y1: yV1 },
      cabine: { u: cu, v: cv, b: C.b, d: C.d, y0: yC0, y1: yC1, y2: yC2, top: ry + 0.12 },
    },
  };
  GEEUW_BRUG.nu = api;
  return api;
}
// het gebouwde landhoofd, voor js/main.js en de proeven
export const GEEUW_BRUG = { nu: null };
