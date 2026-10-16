/*
 Stap 177: de gedenkplek voor de Slag om Sneek, 1944, aan de Sudergoweg (de weg naar IJlst), met een Tiger erop die je kunt
 berijden. Gevraagd: "een stukje getegeld met een gedenkplaquette (Gedenksteen ter nagedachtenis aan de Slag om Sneek, 1944,
 gedoneerd door Veteraan met het dikke hondje). Op het getegelde stuk staat een Tiger tank, authentiek gebouwd zoals de
 stafwagen: eigen model, en de grap is dat je hem kunt berijden, van de gedenkplek af. Met rupsbanden, een koepel die draait,
 voor- en achteruit, links en rechts zoals een tank werkt. Interieur: je kijkt langs de loop. Hij kan schieten, en dan duurt
 herladen een tijdje."

 De plek (gemeten, tools/tigertest.mjs): het weiland ten zuiden van de Sudergoweg bij (46, 1080). Langs bijna de hele weg ligt
 tussen het fietspad en het weiland een sloot; hier loopt een halfverharde dam van het fietspad het weiland in, en daarachter
 ligt de tegelvloer (13 × 10 m) op het grasland. Over die dam rijd je de Tiger de weg op.

 Het model: een Tiger I (Ausf. E) op de maten van het echte voertuig. Romp 6,32 m lang (8,45 m met het kanon), 3,56 m breed,
 3,0 m hoog tot de koepel. De onderbouw tussen de rupsen en de bovenbouw over de rupsen heen zijn geëxtrudeerde zijprofielen
 (uv in meters, zoals de stafwagen), met de schuine neusplaat onder de bijna rechte voorplaat. Acht grote loopwielen per kant
 in twee rijen om en om (het `Schachtellaufwerk`), het aandrijfwiel voor en het spanwiel achter, en een rupsband als één
 band om die wielen heen (`bandPunten`: de omhullende van de wielen, gelijk verdeeld), met een eigen doek per kant dat
 meeschuift. De koepel als hoefijzer (een vorm in het vlak, 82 cm hoog), de mantel, het 88 mm-kanon (KwK 36, 4,9 m, de
 dubbele mondingsrem), de commandantenkoepel met kijkspleten, de Rommelkiste achterop, rookbuisjes, uitlaten met kappen, het
 roosterwerk op het motordek, gereedschap, reserveschakels. De verf: dunkelgelb met olijfgroene en roodbruine banen, op canvas.

 Rijden (`TIGER.rij`): W en S gas, A en D draaien de romp, ook op de plaats (de rupsen lopen dan tegen elkaar in). Het
 kanon volgt de muis met de draaisnelheid van de koepel (`TIGER.koepel`) en richt van −8° tot +15°. Klik: een granaat
 (`vuur`) langs de loop, met terugslag, een mondingsvlam en een inslag; dan `TIGER.herladen` seconden herladen. js/main.js
 doet wat de inslag losmaakt (ontploffing, auto's, mensen, politie). Binnen kijk je over de koepel langs de loop, met het
 richtkruis van het TZF-vizier; met V van buiten. E stapt uit.

 Alles wordt bij het opstarten gemaakt (geen nieuw shaderprogramma tijdens het spelen); de mondingsvlam staat altijd in de
 scène en wordt met de doorzichtigheid aan- en uitgezet.
*/
import * as THREE from 'three';
import { doek } from './nomercy.js';

export const TIGER = {
  // de tegelvloer: het midden, en de draaiing zodat de lokale x langs de Sudergoweg loopt en −z het weiland in
  plek: { x: 46.1, z: 1097.0, yaw: -2.958 },
  vloer: { b: 13, d: 10, y: 0.2 },
  // waar de Tiger op de vloer staat (lokaal, in meters) en hoe hij staat: met de neus schuin naar de weg
  staat: { u: 1.2, w: 0.6, draai: Math.PI - 0.45 },
  // de gedenksteen: vooraan op de vloer, oostelijk (bij de dam), met de tekst naar de weg
  steen: { u: -4.2, w: 3.6 },
  maat: { L: 6.32, B: 3.56, H: 3.0, loop: 8.45 },
  rij: { top: 10.5, achteruit: 3.2, optrek: 2.0, rem: 3.0, draai: 0.42, draaiRijdend: 0.32 },
  koepel: 0.55,              // rad/s: de koepel draait hydraulisch, niet snel
  richt: [-8 * Math.PI / 180, 15 * Math.PI / 180],
  herladen: 8,               // s
  /*
   (stap 177, "als de politie op de tank schiet wordt Erik niet geraakt, alleen de tank heeft een bepaalde health; het moet
   duidelijk worden dat de tank bijna explodeert en dat Erik eruit moet") De romp vangt alle schade die anders Erik zou
   raken (js/main.js geeft hem door). Onder `kritiek` rookt het motordek, trilt de romp, schudt het beeld, piept het en
   staat er in rood STAP UIT; onder `brand` komen er vlammen bij. Op nul ontploft hij, en wie dan nog binnen zit gaat neer.
   Het wrak staat er `wrakTijd` tellen, en komt dan (uit het zicht) als nieuw terug op de gedenkplek.
  */
  leven: 300,
  kritiek: 0.35,
  brand: 0.15,
  wrakTijd: 90,
  schok: 0.55,              // de schok van het eigen schot (js/main.js `schok`)
  bereik: 700,               // m
  straal: 2.0,               // de botsing van de romp: drie cirkels langs de lengte
  instap: 4.2,               // zo dicht bij de romp kun je instappen (m)
};
export const TEKST = ['GEDENKSTEEN', 'ter nagedachtenis aan de', 'Slag om Sneek', '1944'];
export const DONATIE = 'gedoneerd door Veteraan met het dikke hondje';

// ---------- doeken ----------
const rnd = (a, b) => a + Math.random() * (b - a);
// dunkelgelb met olijfgroene en roodbruine banen, zimmerit en stof; 4 m per doek
function camoDoek() {
  return doek(512, 512, (c, w, h) => {
    c.fillStyle = '#b39a5e'; c.fillRect(0, 0, w, h);
    const baan = (kleur, n, dik) => {
      c.strokeStyle = kleur; c.lineCap = 'round'; c.lineJoin = 'round';
      for (let i = 0; i < n; i++) {
        c.lineWidth = rnd(dik * 0.6, dik);
        let x = rnd(-60, w), y = rnd(-60, h);
        c.beginPath(); c.moveTo(x, y);
        for (let k = 0; k < 6; k++) { x += rnd(30, 90); y += rnd(-50, 70); c.lineTo(x, y); }
        c.stroke();
        // naar de andere kant van het doek doorlopen (herhalen zonder naad)
        c.save(); c.translate(-w, 0); c.stroke(); c.restore(); c.save(); c.translate(0, -h); c.stroke(); c.restore();
      }
    };
    baan('rgba(84,90,52,0.92)', 9, 46);
    baan('rgba(112,74,44,0.85)', 6, 30);
    // zimmerit: korte horizontale ribbeltjes
    for (let y = 0; y < h; y += 6) for (let x = 0; x < w; x += 14) {
      c.fillStyle = `rgba(40,34,20,${rnd(0.04, 0.12)})`; c.fillRect(x + rnd(-2, 2), y, rnd(6, 11), 1.5);
    }
    // stof en vlekken
    for (let i = 0; i < 1600; i++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? '70,60,40' : '200,190,150'},${rnd(0.03, 0.1)})`; c.beginPath(); c.arc(rnd(0, w), rnd(0, h), rnd(1, 6), 0, Math.PI * 2); c.fill(); }
  });
}
// de rupsband: schakels met grijpers (één schakel per eenheid u), staal met roest en modder
function rupsDoek() {
  return doek(64, 128, (c, w, h) => {
    c.fillStyle = '#2b2925'; c.fillRect(0, 0, w, h);
    // de schakel en de grijper (een V over de breedte)
    c.fillStyle = '#4a463e'; c.fillRect(4, 6, w - 8, h - 12);
    c.strokeStyle = '#6b6457'; c.lineWidth = 7;
    c.beginPath(); c.moveTo(w * 0.2, 10); c.lineTo(w * 0.5, h * 0.5); c.lineTo(w * 0.2, h - 10); c.stroke();
    c.beginPath(); c.moveTo(w * 0.8, 10); c.lineTo(w * 0.5, h * 0.5); c.lineTo(w * 0.8, h - 10); c.stroke();
    c.fillStyle = '#1a1916'; c.fillRect(0, 0, 3, h); c.fillRect(w - 3, 0, 3, h);
    for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? '110,80,48' : '72,60,44'},${rnd(0.15, 0.4)})`; c.fillRect(rnd(0, w), rnd(0, h), rnd(2, 6), rnd(2, 6)); }
  }, true);
}
// een loopwiel van opzij: stalen schijf, rubberen band, de bouten
function wielDoek() {
  return doek(128, 128, (c, w, h) => {
    const m = w / 2;
    c.fillStyle = '#b39a5e'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#1b1a18'; c.beginPath(); c.arc(m, m, 63, 0, Math.PI * 2); c.fill();          // rubber
    c.fillStyle = '#a28c55'; c.beginPath(); c.arc(m, m, 54, 0, Math.PI * 2); c.fill();          // de schijf
    c.strokeStyle = 'rgba(60,50,30,0.6)'; c.lineWidth = 2; c.beginPath(); c.arc(m, m, 40, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#7a6a42'; c.beginPath(); c.arc(m, m, 18, 0, Math.PI * 2); c.fill();          // de naaf
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; c.fillStyle = '#3a3426'; c.beginPath(); c.arc(m + Math.cos(a) * 24, m + Math.sin(a) * 24, 3, 0, Math.PI * 2); c.fill(); }
    for (let i = 0; i < 300; i++) { c.fillStyle = `rgba(90,72,46,${rnd(0.08, 0.25)})`; c.fillRect(rnd(0, w), rnd(0, h), 2, 2); }
  });
}
// het aandrijfwiel: een tandkrans
function tandDoek() {
  return doek(128, 128, (c, w, h) => {
    const m = w / 2;
    c.fillStyle = '#b39a5e'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#2d2a24';
    c.beginPath();
    for (let i = 0; i <= 36; i++) { const a = i / 36 * Math.PI * 2, r = i % 2 ? 58 : 50; c.lineTo(m + Math.cos(a) * r, m + Math.sin(a) * r); }
    c.fill();
    c.fillStyle = '#9a8450'; c.beginPath(); c.arc(m, m, 44, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; c.fillStyle = '#2d2a24'; c.beginPath(); c.arc(m + Math.cos(a) * 28, m + Math.sin(a) * 28, 9, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#6a5a38'; c.beginPath(); c.arc(m, m, 12, 0, Math.PI * 2); c.fill();
  });
}
// het balkenkruis en het torennummer (doorzichtig, op de flank)
function kruisDoek() {
  return doek(128, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    const m = w / 2, a = 46, b = 13;
    c.fillStyle = '#f2f0e6'; c.fillRect(m - a - 5, m - b - 5, (a + 5) * 2, (b + 5) * 2); c.fillRect(m - b - 5, m - a - 5, (b + 5) * 2, (a + 5) * 2);
    c.fillStyle = '#141414'; c.fillRect(m - a, m - b, a * 2, b * 2); c.fillRect(m - b, m - a, b * 2, a * 2);
  });
}
function nummerDoek() {
  return doek(256, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.font = 'bold 92px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 8; c.strokeStyle = '#f0ede0'; c.strokeText('223', w / 2, h / 2 + 4);
    c.fillStyle = '#8e1c14'; c.fillText('223', w / 2, h / 2 + 4);
  });
}
// het roosterwerk op het motordek
function roosterDoek() {
  return doek(128, 128, (c, w, h) => {
    c.fillStyle = '#171612'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#5a5034'; c.lineWidth = 3;
    for (let x = 4; x < w; x += 10) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    for (let y = 4; y < h; y += 10) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  });
}
// de tegels: grijze betontegels van 30 × 30 cm met voegen, 3 m per doek
function tegelDoek() {
  return doek(512, 512, (c, w, h) => {
    const n = 10, t = w / n;
    c.fillStyle = '#5c5a55'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const g = 150 + Math.floor(rnd(-14, 14));
      c.fillStyle = `rgb(${g},${g - 2},${g - 6})`; c.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
      for (let k = 0; k < 18; k++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? '90,88,82' : '200,198,190'},${rnd(0.08, 0.2)})`; c.fillRect(i * t + rnd(3, t - 6), j * t + rnd(3, t - 6), 2, 2); }
    }
    // wat mos in de voegen
    for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(70,96,46,${rnd(0.2, 0.5)})`; const k = Math.floor(rnd(0, n)); c.fillRect(k * t + rnd(-2, 2), rnd(0, h), 3, rnd(3, 10)); }
  });
}
// de bronzen plaquette op de steen
function plaatDoek() {
  return doek(512, 384, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#8a6a34'); g.addColorStop(0.5, '#a9844a'); g.addColorStop(1, '#6e5228');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#4a3416'; c.lineWidth = 10; c.strokeRect(14, 14, w - 28, h - 28);
    c.strokeStyle = '#c9a66a'; c.lineWidth = 2; c.strokeRect(24, 24, w - 48, h - 48);
    c.textAlign = 'center'; c.fillStyle = '#2e200c';
    c.font = 'bold 40px serif'; c.fillText(TEKST[0], w / 2, 82);
    c.font = '28px serif'; c.fillText(TEKST[1], w / 2, 132);
    c.font = 'bold 46px serif'; c.fillText(TEKST[2], w / 2, 190);
    c.font = 'bold 40px serif'; c.fillText(TEKST[3], w / 2, 240);
    c.font = 'italic 20px serif'; c.fillText(DONATIE, w / 2, 300);
    // het dikke hondje, klein onderaan
    c.fillStyle = '#2e200c';
    c.beginPath(); c.ellipse(w / 2, 336, 26, 14, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(w / 2 + 26, 326, 10, 0, Math.PI * 2); c.fill();
    c.fillRect(w / 2 - 20, 342, 5, 10); c.fillRect(w / 2 + 14, 342, 5, 10);
    c.beginPath(); c.moveTo(w / 2 - 26, 332); c.lineTo(w / 2 - 36, 324); c.lineTo(w / 2 - 28, 338); c.fill();
    for (let i = 0; i < 500; i++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? '60,90,70' : '50,36,16'},${rnd(0.03, 0.12)})`; c.fillRect(rnd(0, w), rnd(0, h), 2, 2); }
  });
}
// graniet
function steenDoek() {
  return doek(256, 256, (c, w, h) => {
    c.fillStyle = '#3c3d3f'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const v = Math.floor(rnd(30, 110)); c.fillStyle = `rgba(${v},${v},${v + 4},0.5)`; c.fillRect(rnd(0, w), rnd(0, h), rnd(1, 3), rnd(1, 3)); }
  });
}

// ---------- vormen ----------
// een doos met uv in meters (een BoxGeometry spant elk doek over het hele vlak)
function doosM(b, h, d) {
  const g = new THREE.BoxGeometry(b, h, d);
  const uv = g.attributes.uv, schaal = [[d, h], [d, h], [b, d], [b, d], [b, h], [b, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * schaal[f][0], uv.getY(i) * schaal[f][1]); }
  return g;
}
// een zijprofiel (z, y) als vorm, `breed` meter breed geëxtrudeerd over x, gecentreerd
function profielGeo(punten, breed) {
  const s = new THREE.Shape();
  punten.forEach(([z, y], i) => (i ? s.lineTo(z, y) : s.moveTo(z, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: breed, bevelEnabled: false });
  // vorm-x = z, vorm-y = y, de diepte langs z: een kwartslag om y, dan ligt de diepte langs −x (geen spiegeling, die keert de vlakken om)
  g.rotateY(-Math.PI / 2);   // (vx, vy, d) → (−d, vy, vx)
  g.translate(breed / 2, 0, 0);
  g.computeVertexNormals();
  return g;
}
// de koepel als hoefijzer in het vlak (x, z), `hoog` meter hoog
function hoefijzerGeo(hoog) {
  const s = new THREE.Shape();
  // in het vlak (x, −z): voor recht (z = −1,30), dan schuin naar de flanken en in een boog om de achterkant
  s.moveTo(-1.02, 1.30); s.lineTo(1.02, 1.30); s.lineTo(1.40, 0.70);
  s.absarc(0, -0.05, 1.42, Math.atan2(0.75, 1.40), Math.PI - Math.atan2(0.75, 1.40), true);
  s.lineTo(-1.02, 1.30);
  const g = new THREE.ExtrudeGeometry(s, { depth: hoog, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 20 });
  g.rotateX(-Math.PI / 2);   // (vx, vy, d) → (vx, d, −vy): de diepte omhoog, en z = −vy
  g.computeVertexNormals();
  return g;
}

/*
 De rupsband om de wielen: de omhullende van een paar cirkels in het zijvlak (z, y), gelijk verdeeld in `n` punten met hun
 normaal naar buiten. De band is dan één strook vlakken met uv = (lengte / schakel, breedte).
*/
export function bandPunten(cirkels, n = 160) {
  const pts = [];
  for (const [z, y, r] of cirkels) for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; pts.push([z + Math.cos(a) * r, y + Math.sin(a) * r]); }
  pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const kruis = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const onder = [], boven = [];
  for (const p of pts) { while (onder.length >= 2 && kruis(onder[onder.length - 2], onder[onder.length - 1], p) <= 0) onder.pop(); onder.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (boven.length >= 2 && kruis(boven[boven.length - 2], boven[boven.length - 1], p) <= 0) boven.pop(); boven.push(p); }
  const rand = onder.slice(0, -1).concat(boven.slice(0, -1));   // tegen de klok in
  const L = [0];
  for (let i = 1; i <= rand.length; i++) { const a = rand[i - 1], b = rand[i % rand.length]; L.push(L[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const tot = L[rand.length], uit = [];
  let k = 0;
  for (let i = 0; i < n; i++) {
    const s = i / n * tot;
    while (L[k + 1] < s) k++;
    const a = rand[k], b = rand[(k + 1) % rand.length], f = (s - L[k]) / Math.max(1e-6, L[k + 1] - L[k]);
    const tz = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tz, ty) || 1;
    // tegen de klok in: de buitenkant ligt rechts van de looprichting
    uit.push({ z: a[0] + tz * f, y: a[1] + ty * f, nz: ty / tl, ny: -tz / tl, s });
  }
  return { punten: uit, lengte: tot };
}
function bandGeo(cirkels, x0, breed, dik, schakel) {
  const { punten, lengte } = bandPunten(cirkels);
  const n = punten.length, pos = [], uv = [], idx = [];
  const x1 = x0 + breed;
  // vier ringen: buiten-links, buiten-rechts, binnen-rechts, binnen-links
  for (let i = 0; i <= n; i++) {
    const p = punten[i % n], u = (i === n ? lengte : p.s) / schakel;
    const bz = p.z, by = p.y, iz = p.z - p.nz * dik, iy = p.y - p.ny * dik;
    pos.push(x0, by, bz, x1, by, bz, x1, iy, iz, x0, iy, iz);
    uv.push(u, 0, u, 1, u, 1, u, 0);
  }
  const ring = 4;
  for (let i = 0; i < n; i++) {
    const a = i * ring, b = (i + 1) * ring;
    const vlak = (p, q) => { idx.push(a + p, b + p, b + q, a + p, b + q, a + q); };
    vlak(1, 0);   // buiten
    vlak(3, 2);   // binnen
    vlak(0, 3);   // de kant links
    vlak(2, 1);   // de kant rechts
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return { geo: g, lengte };
}

// ---------- het model ----------
const LOOPWIEL = 0.40;
const AS_Z = [-2.10, -1.50, -0.90, -0.30, 0.30, 0.90, 1.50, 2.10];
const RUPS = { breed: 0.725, dik: 0.07, schakel: 0.13 };
const TAND = { z: -2.62, y: 0.66, r: 0.42 };
const SPAN = { z: 2.70, y: 0.58, r: 0.36 };
export function maakTiger() {
  const camo = camoDoek(); camo.repeat.set(0.25, 0.25);
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0.12, ...o });
  const rups = rupsDoek();
  const M = {
    camo: std({ color: 0xffffff, map: camo }),
    donker: std({ color: 0x2a2822, roughness: 0.6, metalness: 0.45 }),
    zwart: std({ color: 0x141412, roughness: 0.9 }),
    staal: std({ color: 0x5c5a52, roughness: 0.45, metalness: 0.7 }),
    rubber: std({ color: 0x1a1918, roughness: 0.95, metalness: 0 }),
    wiel: std({ color: 0xffffff, map: wielDoek() }),
    tand: std({ color: 0xffffff, map: tandDoek() }),
    rooster: std({ color: 0xffffff, map: roosterDoek(), roughness: 0.7, metalness: 0.4 }),
    hout: std({ color: 0x6e5236, roughness: 0.9, metalness: 0 }),
    glas: std({ color: 0x24302e, roughness: 0.15, metalness: 0.6 }),
    rupsL: std({ color: 0xffffff, map: rups, roughness: 0.75, metalness: 0.5, side: THREE.DoubleSide }),
    rupsR: std({ color: 0xffffff, map: rups.clone(), roughness: 0.75, metalness: 0.5, side: THREE.DoubleSide }),
    kruis: new THREE.MeshStandardMaterial({ map: kruisDoek(), transparent: true, alphaTest: 0.35, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }),
    nummer: new THREE.MeshStandardMaterial({ map: nummerDoek(), transparent: true, alphaTest: 0.35, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }),
    // de mondingsvlam: altijd in de scène, optellend licht, met de doorzichtigheid aan en uit
    vlam: new THREE.MeshBasicMaterial({ color: 0xffc26a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    rook: new THREE.MeshBasicMaterial({ color: 0x8a8578, transparent: true, opacity: 0, depthWrite: false }),
  };
  M.rupsR.map.needsUpdate = true;
  const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; };
  const cilX = (r1, r2, l, seg = 20) => new THREE.CylinderGeometry(r1, r2, l, seg).rotateZ(Math.PI / 2);
  const cilZ = (r1, r2, l, seg = 20) => new THREE.CylinderGeometry(r1, r2, l, seg).rotateX(Math.PI / 2);

  const groep = new THREE.Group(); groep.name = 'tiger';
  const romp = new THREE.Group(); groep.add(romp);

  // de onderbouw tussen de rupsen: de schuine neusplaat, de bodem, de achterplaat
  romp.add(mesh(profielGeo([[-2.62, 0.47], [2.62, 0.47], [2.96, 0.92], [2.96, 1.08], [-3.17, 1.08], [-3.17, 0.93]], 1.86), M.camo));
  // de bovenbouw over de rupsen: de bijna rechte voorplaat, het dek, de achterplaat
  romp.add(mesh(profielGeo([[-3.16, 1.08], [3.0, 1.08], [3.0, 1.80], [2.88, 1.88], [-3.05, 1.88]], 3.42), M.camo));
  // de spatborden voor en achter, boven de rupsen
  for (const k of [-1, 1]) {
    romp.add(mesh(doosM(0.74, 0.03, 0.24), M.camo, k * 1.40, 1.07, -3.22));
    romp.add(mesh(doosM(0.74, 0.03, 0.22), M.camo, k * 1.40, 1.07, 3.06));
  }
  // de voorplaat: het vizier van de bestuurder (links), de kogelaffuit van de mitrailleur (rechts), de koplamp, de sleepogen
  romp.add(mesh(doosM(0.46, 0.16, 0.12), M.camo, -0.62, 1.66, -3.12));
  romp.add(mesh(doosM(0.30, 0.04, 0.02), M.glas, -0.62, 1.66, -3.185));
  const mgBol = mesh(new THREE.SphereGeometry(0.16, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(-Math.PI / 2), M.camo, 0.72, 1.56, -3.10);
  romp.add(mgBol);
  romp.add(mesh(cilZ(0.025, 0.025, 0.22, 8), M.zwart, 0.72, 1.56, -3.22));
  romp.add(mesh(cilZ(0.10, 0.12, 0.12, 14), M.donker, -1.30, 1.98, -2.90));
  romp.add(mesh(cilZ(0.075, 0.075, 0.02, 14), M.glas, -1.30, 1.98, -2.97));
  for (const k of [-1, 1]) romp.add(mesh(doosM(0.14, 0.24, 0.10), M.donker, k * 0.80, 0.78, -3.22));
  // het dek: de luiken van bestuurder en marconist, het roosterwerk en de luchtinlaten op het motordek
  for (const x of [-0.62, 0.62]) romp.add(mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.05, 20), M.camo, x, 1.905, -2.35));
  romp.add(mesh(doosM(1.40, 0.02, 0.85), M.rooster, 0, 1.895, 2.05));
  for (const k of [-1, 1]) romp.add(mesh(doosM(0.62, 0.02, 0.62), M.rooster, k * 1.18, 1.895, 2.15));
  romp.add(mesh(doosM(1.10, 0.10, 0.60), M.camo, 0, 1.93, 1.15));
  // achter: twee uitlaten met kappen, de Feifel-luchtfilters, de krik
  for (const k of [-1, 1]) {
    romp.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.78, 12), M.donker, k * 0.48, 1.86, 3.06));
    romp.add(mesh(cilZ(0.17, 0.17, 0.18, 16), M.camo, k * 0.48, 2.05, 3.04));
    romp.add(mesh(cilX(0.15, 0.15, 0.62, 14), M.camo, k * 1.20, 1.45, 3.05));
  }
  romp.add(mesh(doosM(0.18, 0.40, 0.14), M.donker, 0, 1.15, 3.04));
  // gereedschap langs de flanken: de schep, de bijl, de sleepkabel, de reinigingsstok van de loop
  for (const k of [-1, 1]) {
    romp.add(mesh(cilZ(0.03, 0.03, 4.2, 8), M.hout, k * 1.74, 1.86, 0.0));
    romp.add(mesh(cilZ(0.045, 0.045, 3.6, 8), M.staal, k * 1.74, 1.55, -0.2));
    romp.add(mesh(doosM(0.06, 0.20, 0.90), M.hout, k * 1.73, 1.30, 1.6));
  }

  // ---- het loopwerk: per kant acht loopwielen in twee rijen, het aandrijfwiel, het spanwiel, de rupsband
  const wielen = [], rupsen = [];
  const wielGeo = cilX(LOOPWIEL, LOOPWIEL, 0.12, 24), tandGeo = cilX(TAND.r, TAND.r, 0.22, 24), spanGeo = cilX(SPAN.r, SPAN.r, 0.18, 22);
  for (const k of [-1, 1]) {
    const xc = k * (TIGER.maat.B / 2 - RUPS.breed / 2);
    AS_Z.forEach((z, i) => {
      // om en om: de buitenste rij en de binnenste rij overlappen elkaar (de wielen staan "geschachteld")
      const buiten = i % 2 === 0;
      for (const dx of buiten ? [0.22, -0.02] : [0.10, -0.14]) {
        const w = mesh(wielGeo, M.wiel, xc + k * dx, LOOPWIEL + 0.03, z);
        romp.add(w); wielen.push({ m: w, kant: k, r: LOOPWIEL });
      }
    });
    const t = mesh(tandGeo, M.tand, xc, TAND.y, TAND.z); romp.add(t); wielen.push({ m: t, kant: k, r: TAND.r });
    const s = mesh(spanGeo, M.wiel, xc, SPAN.y, SPAN.z); romp.add(s); wielen.push({ m: s, kant: k, r: SPAN.r });
    // de band: om het aandrijfwiel, het eerste en laatste loopwiel en het spanwiel (de bovenkant rust op de wielen)
    const cirk = [[TAND.z, TAND.y, TAND.r + RUPS.dik], [AS_Z[0], LOOPWIEL + 0.03, LOOPWIEL + RUPS.dik], [AS_Z[7], LOOPWIEL + 0.03, LOOPWIEL + RUPS.dik], [SPAN.z, SPAN.y, SPAN.r + RUPS.dik]];
    const { geo, lengte } = bandGeo(cirk, xc - RUPS.breed / 2, RUPS.breed, RUPS.dik, RUPS.schakel);
    const band = mesh(geo, k < 0 ? M.rupsL : M.rupsR);
    romp.add(band);
    rupsen.push({ kant: k, mat: k < 0 ? M.rupsL : M.rupsR, lengte });
  }
  // reserveschakels op de voorplaat
  for (let i = 0; i < 4; i++) romp.add(mesh(doosM(0.72, 0.06, 0.13), M.rupsL, 0, 1.18 + i * 0.13, -3.20));

  // balkenkruis op de flanken
  for (const k of [-1, 1]) {
    const kr = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), M.kruis);
    kr.position.set(k * 1.715, 1.48, -0.6); kr.rotation.y = k * Math.PI / 2; romp.add(kr);
  }

  // ---- de koepel
  const koepel = new THREE.Group(); koepel.position.set(0, 1.88, -0.12); romp.add(koepel);
  koepel.add(mesh(hoefijzerGeo(0.82), M.camo));
  koepel.add(mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.06, 28), M.donker, 0, 0.02, 0.05));            // de ring
  // de commandantenkoepel met kijkspleten, linksachter; het laadluik rechts; de rookbuisjes
  koepel.add(mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.26, 20), M.camo, -0.58, 0.97, 0.55));
  koepel.add(mesh(new THREE.CylinderGeometry(0.385, 0.385, 0.07, 20), M.glas, -0.58, 0.95, 0.55));
  koepel.add(mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.05, 20), M.camo, -0.58, 1.12, 0.55));
  koepel.add(mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.05, 20), M.camo, 0.55, 0.87, 0.30));
  for (const k of [-1, 1]) for (let i = 0; i < 3; i++) {
    const b = mesh(cilZ(0.045, 0.045, 0.24, 8), M.donker, k * (1.18 + i * 0.07), 0.70, -0.95 + i * 0.12);
    b.rotation.y = -k * 0.5; b.rotation.x = 0.4; koepel.add(b);
  }
  // de Rommelkiste achterop
  koepel.add(mesh(doosM(1.15, 0.46, 0.52), M.camo, 0, 0.42, 1.68));
  // reserveschakels aan de flanken van de koepel en het nummer
  for (const k of [-1, 1]) {
    // (de schakels achter op de flank, waar de boog al naar binnen loopt; het nummer voor op het rechte stuk)
    for (let i = 0; i < 4; i++) { const s = mesh(doosM(0.06, 0.13, 0.62), M.rupsL, k * 1.30, 0.30 + i * 0.13, 0.62); s.rotation.y = -k * 0.42; koepel.add(s); }
    const nr = new THREE.Mesh(new THREE.PlaneGeometry(0.80, 0.40), M.nummer);
    nr.position.set(k * 1.465, 0.50, -0.30); nr.rotation.y = k * Math.PI / 2; koepel.add(nr);
  }
  // de mantel en het kanon: draaien om de tappen (`kanon` richt op en neer)
  const kanon = new THREE.Group(); kanon.position.set(0, 0.42, -1.30); koepel.add(kanon);
  kanon.add(mesh(doosM(1.62, 0.74, 0.30), M.camo, 0, 0, -0.10));
  kanon.add(mesh(cilX(0.37, 0.37, 1.62, 22).scale(1, 1, 0.55), M.camo, 0, 0, -0.24));
  kanon.add(mesh(cilZ(0.05, 0.05, 0.04, 10), M.zwart, -0.42, 0.16, -0.43));        // de vizieropeningen
  kanon.add(mesh(cilZ(0.05, 0.05, 0.04, 10), M.zwart, -0.30, 0.16, -0.43));
  kanon.add(mesh(cilZ(0.04, 0.04, 0.04, 10), M.zwart, 0.46, 0.0, -0.43));          // het coaxiale MG
  const loop = new THREE.Group(); kanon.add(loop);
  loop.add(mesh(cilZ(0.15, 0.17, 0.42, 18), M.camo, 0, 0, -0.55));                  // de schacht in de mantel
  loop.add(mesh(cilZ(0.085, 0.112, 2.80, 18), M.camo, 0, 0, -2.15));                // de loop, taps
  loop.add(mesh(cilZ(0.155, 0.155, 0.46, 18), M.camo, 0, 0, -3.77));                // de mondingsrem
  for (const z of [-3.66, -3.88]) loop.add(mesh(cilZ(0.16, 0.16, 0.06, 18), M.zwart, 0, 0, z));
  loop.add(mesh(cilZ(0.06, 0.06, 0.02, 12), M.zwart, 0, 0, -4.01));                 // de monding
  const monding = new THREE.Object3D(); monding.position.set(0, 0, -4.05); loop.add(monding);
  // mondingsvlam en kruitdamp (altijd in de scène, doorzichtig tot er geschoten wordt)
  const vlam = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8), M.vlam); vlam.scale.set(1, 1, 1.8); monding.add(vlam);
  const rook = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), M.rook); monding.add(rook);
  for (const o of [vlam, rook]) { o.castShadow = false; o.receiveShadow = false; }

  // rook en vuur uit het motordek (zichtbaar pas als de romp het bijna begeeft); elk met een eigen materiaal van dezelfde soort
  const pluimen = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.MeshBasicMaterial({ color: 0x3a3632, transparent: true, opacity: 0, depthWrite: false });
    const o = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), m); o.castShadow = false;
    o.position.set(rnd(-0.6, 0.6), 2.1, 2.1 + rnd(-0.3, 0.3)); romp.add(o);
    pluimen.push({ o, m, t: i / 5 });
  }
  const vuurMat = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const vuur = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), vuurMat); vuur.position.set(0, 2.05, 2.1); vuur.castShadow = false; romp.add(vuur);
  groep.userData = { length: TIGER.maat.L, width: TIGER.maat.B };
  return { groep, romp, koepel, kanon, loop, monding, vlam, rook, wielen, rupsen, M, pluimen, vuur, vuurMat };
}

// ---------- de gedenkplek ----------
export function maakGedenkplek() {
  const V = TIGER.vloer;
  const groep = new THREE.Group(); groep.name = 'gedenkplek';
  const tegel = tegelDoek(); tegel.repeat.set(1 / 3, 1 / 3);
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.02, ...o });
  const mTegel = std({ color: 0xffffff, map: tegel });
  const mBand = std({ color: 0x8c8a84 });
  const mSteen = std({ color: 0xffffff, map: steenDoek(), roughness: 0.5, metalness: 0.05 });
  const mPlaat = std({ color: 0xffffff, map: plaatDoek(), roughness: 0.4, metalness: 0.65 });
  const mBloem = std({ color: 0xb01a14, roughness: 0.7 });
  const mGroen = std({ color: 0x2f5a26, roughness: 0.9 });
  const m = (g, mat, x, y, z) => { const o = new THREE.Mesh(g, mat); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; };
  // de vloer en de opsluitbanden
  groep.add(m(doosM(V.b, 0.16, V.d), mTegel, 0, V.y - 0.08, 0));
  for (const [b, d, x, z] of [[V.b + 0.2, 0.1, 0, -V.d / 2 - 0.05], [V.b + 0.2, 0.1, 0, V.d / 2 + 0.05], [0.1, V.d, -V.b / 2 - 0.05, 0], [0.1, V.d, V.b / 2 + 0.05, 0]])
    groep.add(m(doosM(b, 0.22, d), mBand, x, V.y - 0.06, z));
  // de gedenksteen: een sokkel, de schuine steen, de bronzen plaat ervoor (de tekst naar de weg, lokaal +z)
  const S = TIGER.steen;
  const steen = new THREE.Group(); steen.position.set(S.u, V.y, S.w); groep.add(steen);
  steen.add(m(doosM(1.5, 0.30, 0.8), mSteen, 0, 0.15, 0));
  const blok = m(doosM(1.3, 1.0, 0.32), mSteen, 0, 0.78, 0); blok.rotation.x = -0.22; steen.add(blok);
  const plaat = new THREE.Mesh(new THREE.PlaneGeometry(1.04, 0.78), mPlaat);
  plaat.position.set(0, 0.80, 0.175); plaat.rotation.x = -0.22; steen.add(plaat);
  // een krans van klaprozen en twee bloembakken
  const krans = m(new THREE.TorusGeometry(0.26, 0.07, 8, 20), mGroen, 0, 0.36, 0.52); krans.rotation.x = -1.2; steen.add(krans);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; steen.add(m(new THREE.SphereGeometry(0.05, 8, 6), mBloem, Math.cos(a) * 0.26, 0.36 + Math.sin(a) * 0.09, 0.52 + Math.sin(a) * 0.24)); }
  for (const k of [-1, 1]) { steen.add(m(doosM(0.4, 0.35, 0.4), mBand, k * 1.2, 0.175, 0.3)); for (let i = 0; i < 6; i++) steen.add(m(new THREE.SphereGeometry(0.07, 8, 6), i % 2 ? mBloem : mGroen, k * 1.2 + rnd(-0.12, 0.12), 0.40, 0.3 + rnd(-0.12, 0.12))); }
  return { groep, steen };
}

// ---------- het besturen ----------
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

export function initTiger({ scene, camera, player, geluid = null, resolveCollisions, addCollider, pointInWater, grondHoogte, vrijeCamera = null, derdeAan = () => false, opInslag = () => {}, raakt = () => null, opSchot = () => {}, opOntploffing = () => {}, opSchok = () => {}, raakLantaarn = null }) {
  const P = TIGER.plek, V = TIGER.vloer;
  const plek = maakGedenkplek();
  plek.groep.position.set(P.x, 0.0, P.z); plek.groep.rotation.y = P.yaw;
  scene.add(plek.groep);
  const T = maakTiger();
  scene.add(T.groep);
  // de beginstand op de vloer, in wereldcoördinaten
  const cos = Math.cos(P.yaw), sin = Math.sin(P.yaw);
  const lokaal = (u, w) => ({ x: P.x + u * cos + w * sin, z: P.z - u * sin + w * cos });
  const s0 = lokaal(TIGER.staat.u, TIGER.staat.w);
  const st = { x: s0.x, z: s0.z, y: V.y, yaw: wrap(P.yaw + TIGER.staat.draai), v: 0, draai: 0, koepel: 0, richt: 0, herlaad: 0, terug: 0, vlam: 0, pitch: 0, rol: 0,
    hp: TIGER.leven, kapot: false, wrakT: 0, piepT: 0, kick: 0, tril: 0, t: 0 };
  // de kleuren van het nieuwe model, om het wrak weer terug te zetten
  const kleurWas = Object.values(T.M).filter(m => m && m.isMeshStandardMaterial).map(m => [m, m.color.getHex()]);
  // de botsdoos van de Tiger zelf: houdt je te voet en met een auto tegen (h 3,6: auto's negeren lager)
  const doos = addCollider(st.x, st.z, TIGER.maat.B / 2 + 0.05, TIGER.maat.L / 2 + 0.1, st.yaw, 3.6);
  doos.beweegt = true;
  let actief = false, derdeWas = false;

  // de hud: het richtkruis van het TZF-vizier, de lading en de toetsen
  let hudEl = null;
  function hud() {
    if (hudEl || typeof document === 'undefined') return hudEl;
    const css = document.createElement('style');
    css.textContent = `
    #tigerHud { position: fixed; inset: 0; pointer-events: none; z-index: 3; font-family: Arial, sans-serif; color: #f2ecd8; }
    #tigerHud[hidden] { display: none; }
    #tigerHud .kruis { position: absolute; left: 50%; top: 50%; width: 220px; height: 120px; transform: translate(-50%, -50%); }
    #tigerHud.buiten .kruis { width: 90px; height: 50px; opacity: .8; }
    #tigerHud .stand { position: absolute; left: 50%; bottom: 92px; transform: translateX(-50%); text-align: center; font-size: 14px; letter-spacing: .06em;
      text-shadow: 0 1px 3px #000; }
    #tigerHud .balk { width: 180px; height: 6px; margin: 5px auto 0; background: rgba(0,0,0,.5); border-radius: 3px; overflow: hidden; }
    #tigerHud .balk i { display: block; height: 100%; width: 100%; background: #e2c04a; }
    #tigerHud .romp { margin-top: 8px; font-size: 12px; }
    #tigerHud .rompbalk i { background: #6fbf4a; }
    #tigerHud.kritiek .rompbalk i { background: #d8321e; }
    #tigerHud .alarm { position: absolute; left: 50%; top: 22%; transform: translateX(-50%); padding: 10px 18px; border-radius: 6px;
      background: rgba(150,16,10,.85); color: #fff; font-weight: bold; font-size: 20px; letter-spacing: .04em; text-align: center;
      animation: tigerKnipper .5s steps(2) infinite; max-width: calc(100vw - 32px); }
    #tigerHud .alarm[hidden] { display: none; }
    @keyframes tigerKnipper { 50% { opacity: .35; } }
    #tigerHud .hulp { position: absolute; left: 50%; bottom: 60px; transform: translateX(-50%); font-size: 12px; opacity: .85; text-shadow: 0 1px 3px #000; white-space: nowrap; }`;
    document.head.appendChild(css);
    hudEl = document.createElement('div'); hudEl.id = 'tigerHud'; hudEl.hidden = true;
    hudEl.innerHTML = `<svg class="kruis" viewBox="-110 -60 220 120"><g fill="none" stroke="#111" stroke-width="2.4">
      <path d="M0,-2 L-7,10 L7,10 Z"/><path d="M-60,4 L-67,16 L-53,16 Z"/><path d="M60,4 L53,16 L67,16 Z"/><path d="M-30,4 L-35,13 L-25,13 Z"/><path d="M30,4 L25,13 L35,13 Z"/>
      <path d="M0,16 L0,48"/></g><g fill="none" stroke="#f2ecd8" stroke-width="1">
      <path d="M0,-2 L-7,10 L7,10 Z"/><path d="M-60,4 L-67,16 L-53,16 Z"/><path d="M60,4 L53,16 L67,16 Z"/><path d="M-30,4 L-35,13 L-25,13 Z"/><path d="M30,4 L25,13 L35,13 Z"/>
      <path d="M0,16 L0,48"/></g></svg>
      <div class="stand"><span class="tekst">88 mm · GELADEN</span><div class="balk"><i></i></div>
        <div class="romp">ROMP <b>100 %</b></div><div class="balk rompbalk"><i></i></div></div>
      <div class="alarm" hidden>DE TIGER STAAT OP ONTPLOFFEN — STAP UIT (E)!</div>
      <div class="hulp">W/S rijden · A/D draaien · muis: koepel en kanon · klik: vuur · V binnen/buiten · E uitstappen</div>`;
    (document.getElementById('ui') || document.body).appendChild(hudEl);
    return hudEl;
  }
  function zetHud() {
    const h = hud(); if (!h) return;
    h.hidden = !actief;
    if (!actief) return;
    h.classList.toggle('buiten', !!derdeAan());
    const klaar = st.herlaad <= 0;
    h.querySelector('.tekst').textContent = klaar ? '88 mm · GELADEN' : `HERLADEN · ${st.herlaad.toFixed(1).replace('.', ',')} s`;
    h.querySelector('.balk i').style.width = `${Math.round((1 - st.herlaad / TIGER.herladen) * 100)}%`;
    const deel = Math.max(0, st.hp / TIGER.leven);
    h.querySelector('.romp b').textContent = `${Math.round(deel * 100)} %`;
    h.querySelector('.rompbalk i').style.width = `${Math.round(deel * 100)}%`;
    h.classList.toggle('kritiek', deel < TIGER.kritiek);
    h.querySelector('.alarm').hidden = !(deel < TIGER.kritiek);
  }

  // de vorm neerzetten: positie, helling op het terrein, koepel, kanon, terugslag, vlam
  const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
  function zetModel() {
    T.groep.position.set(st.x, 0, st.z);
    T.romp.position.y = st.y;
    // (bijna kapot) de romp trilt; (net geschoten) hij deint achterover
    const tr = st.tril * 0.035;
    T.romp.position.x = tr ? Math.sin(st.t * 61) * tr : 0; T.romp.position.z = tr ? Math.sin(st.t * 47 + 1) * tr : 0;
    T.romp.rotation.set(st.pitch - st.kick * 0.05 + (tr ? Math.sin(st.t * 53) * tr * 0.4 : 0), st.yaw, st.rol + (tr ? Math.sin(st.t * 67 + 2) * tr * 0.4 : 0), 'YXZ');
    T.koepel.rotation.y = st.koepel;
    T.kanon.rotation.x = st.richt;
    T.loop.position.z = st.terug;
    T.M.vlam.opacity = Math.max(0, st.vlam) * 0.95;
    T.M.rook.opacity = Math.max(0, st.vlam - 0.1) * 0.45;
    T.rook.scale.setScalar(1 + (1 - Math.max(0, st.vlam)) * 1.5);
    doos.cx = st.x; doos.cz = st.z; doos.cos = Math.cos(st.yaw); doos.sin = Math.sin(st.yaw);
  }
  // de hoogte van de grond onder de romp, en daaruit de helling (voor-achter en links-rechts)
  function peilGrond() {
    const fx = -Math.sin(st.yaw), fz = -Math.cos(st.yaw), rx = Math.cos(st.yaw), rz = -Math.sin(st.yaw);
    const h = (a, b) => grondHoogte(st.x + fx * a + rx * b, st.z + fz * a + rz * b, st.y + 1.5);
    const v = h(2.6, 0), a = h(-2.6, 0), l = h(0, -1.5), r = h(0, 1.5);
    const opPlek = Math.hypot(st.x - P.x, st.z - P.z) < 9 ? V.y : -Infinity;
    st.y = Math.max(opPlek, (v + a + l + r) / 4);
    st.pitch = Math.atan2(v - a, 5.2) * 0.8;
    st.rol = -Math.atan2(r - l, 3.0) * 0.8;
  }
  zetModel();

  // vrij om hier te staan? geen hoog obstakel (auto's en heggen rijdt hij plat) en geen water onder de romp
  function vrijOp(x, z, yaw) {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    for (const [a, b] of [[2.9, -1.6], [2.9, 1.6], [-2.9, -1.6], [-2.9, 1.6], [0, 0]]) if (pointInWater(x + fx * a + rx * b, z + fz * a + rz * b)) return false;
    return true;
  }
  function botsUit(x, z, yaw) {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const h = doos.h; doos.h = 0;       // de eigen doos niet
    let dx = 0, dz = 0;
    for (const a of [-2.0, 0, 2.0]) {
      const px = x + fx * a, pz = z + fz * a;
      const [qx, qz] = resolveCollisions(px, pz, TIGER.straal, 3.5);
      dx += qx - px; dz += qz - pz;
    }
    doos.h = h;
    return [x + dx, z + dz];
  }

  const instap = () => Math.hypot(player.pos.x - st.x, player.pos.z - st.z) < TIGER.instap + TIGER.maat.L / 2 - 1;
  function stapIn() {
    if (st.kapot) return false;
    actief = true;
    // (16 okt) de motor aan: zonder motorAan liep motorToeren in het niets en was de tank stil
    if (geluid && geluid.motorAan) geluid.motorAan();
    player.inTiger = true;
    derdeWas = !!derdeAan();
    st.v = 0; st.draai = 0;
    // de muis stuurt de koepel: begin waar het kanon nu wijst
    player.yaw = st.yaw + st.koepel; player.pitch = st.richt;
    if (player.gun) player.gun.visible = false;
    if (geluid && geluid.portier) geluid.portier();
    zetHud();
  }
  function uit() {
    if (!actief) return false;
    actief = false;
    player.inTiger = false;
    st.v = 0; st.draai = 0;
    // naast de romp, links (de kant van het luik van de bestuurder), anders rechts, achter of voor
    const rx = Math.cos(st.yaw), rz = -Math.sin(st.yaw), fx = -Math.sin(st.yaw), fz = -Math.cos(st.yaw);
    let plekUit = null;
    for (const [a, b] of [[0, -2.7], [0, 2.7], [-4.2, 0], [4.6, 0]]) {
      const x = st.x + fx * a + rx * b, z = st.z + fz * a + rz * b;
      if (pointInWater(x, z)) continue;
      const [qx, qz] = resolveCollisions(x, z, 0.4);
      if (Math.hypot(qx - x, qz - z) < 0.3) { plekUit = { x: qx, z: qz }; break; }
    }
    if (!plekUit) plekUit = { x: st.x - rx * 2.7, z: st.z - rz * 2.7 };
    player.pos.set(plekUit.x, grondHoogte(plekUit.x, plekUit.z, st.y + 1), plekUit.z);
    player.yaw = st.yaw; player.pitch = 0;
    if (geluid && geluid.motorUit) geluid.motorUit();
    zetHud();
    return true;
  }

  // de granaat: in stappen van een meter langs de loop tot de grond, een botsdoos, een auto of een mens
  function vuur() {
    if (!actief || st.herlaad > 0) return false;
    T.groep.updateMatrixWorld(true);
    const o = T.monding.getWorldPosition(new THREE.Vector3());
    const d = new THREE.Vector3(0, 0, -1).applyQuaternion(T.loop.getWorldQuaternion(tmpQ)).normalize();
    let hit = null;
    for (let s = 1; s <= TIGER.bereik; s += 1) {
      const x = o.x + d.x * s, y = o.y + d.y * s, z = o.z + d.z * s;
      if (y <= grondHoogte(x, z, y + 1) + 0.05) { hit = { x, y: Math.max(y, 0), z, wat: 'grond' }; break; }
      // (een botsdoos kent hier geen hoogte boven de grond: alleen wat hoger is dan de granaat telt)
      const [qx, qz] = resolveCollisions(x, z, 0.05, Math.max(0.01, y));
      if (Math.hypot(qx - x, qz - z) > 0.01) { hit = { x, y, z, wat: 'muur' }; break; }
      const r = raakt(x, y, z);
      if (r) { hit = { x, y, z, wat: r }; break; }
    }
    if (!hit) hit = { x: o.x + d.x * TIGER.bereik, y: o.y + d.y * TIGER.bereik, z: o.z + d.z * TIGER.bereik, wat: 'lucht' };
    st.herlaad = TIGER.herladen; st.terug = 0.48; st.vlam = 1; st.kick = 1;
    opSchot(TIGER.schok);
    if (geluid && geluid.explosie) geluid.explosie(2);
    if (hit.wat !== 'lucht') opInslag(hit);
    zetHud();
    return hit;
  }
  // een treffer op de romp (js/main.js geeft de schade door die anders Erik had geraakt)
  function raak(d) {
    if (st.kapot || !(d > 0)) return false;
    st.hp = Math.max(0, st.hp - d);
    if (geluid && geluid.klap) geluid.klap();
    if (st.hp <= 0) ontplof();
    zetHud();
    return true;
  }
  function ontplof() {
    if (st.kapot) return;
    st.kapot = true; st.hp = 0; st.wrakT = 0;
    const binnen = actief;
    if (actief) uit();
    // roetzwart (de kleur, niet het materiaal: geen nieuw programma), het vuur blijft nog even branden
    for (const [m] of kleurWas) m.color.setHex(0x1c1b19);
    opOntploffing({ x: st.x, y: st.y + 1.5, z: st.z, binnen });
  }
  function herstel() {
    for (const [m, k] of kleurWas) m.color.setHex(k);
    st.kapot = false; st.hp = TIGER.leven; st.wrakT = 0; st.tril = 0;
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('mousedown', (e) => {
      if (!actief || e.button !== 0) return;
      if (!player.pointerLocked && !player.dragging) return;
      vuur();
    });
  }

  function update(dt, camX = st.x, camZ = st.z) {
    dt = Math.min(dt, 0.1);
    st.t += dt;
    st.kick = Math.max(0, st.kick - dt * 2.2);
    // bijna kapot: rook, trillen, schudden en piepen; daaronder vlammen
    const deel = st.hp / TIGER.leven;
    const nood = st.kapot ? 1 : deel < TIGER.kritiek ? 1 - deel / TIGER.kritiek : 0;
    st.tril = actief ? nood : 0;
    for (const p of T.pluimen) {
      p.t = (p.t + dt * (0.35 + nood * 0.4)) % 1;
      p.o.position.y = 2.1 + p.t * 3.2; p.o.scale.setScalar(0.6 + p.t * 1.8);
      p.m.opacity = nood > 0 ? (1 - p.t) * (0.25 + nood * 0.5) : 0;
    }
    const brand = st.kapot ? Math.max(0, 1 - st.wrakT / 25) : deel < TIGER.brand ? 1 : 0;
    T.vuurMat.opacity = brand * (0.55 + Math.sin(st.t * 23) * 0.2 + Math.sin(st.t * 37) * 0.15);
    T.vuur.scale.setScalar(0.8 + Math.sin(st.t * 19) * 0.15 + brand * 0.6);
    if (actief && nood > 0) {
      opSchok(0.06 + nood * 0.18);
      st.piepT -= dt;
      if (st.piepT <= 0) { st.piepT = 1.1 - nood * 0.7; if (geluid && geluid.aftelPiep) geluid.aftelPiep(false); }
    }
    if (st.kapot && !actief) {
      st.wrakT += dt;
      // terug op de gedenkplek: pas na een tijd en als je ver weg bent (niet in beeld verdwijnen)
      if (st.wrakT > TIGER.wrakTijd && Math.hypot(camX - st.x, camZ - st.z) > 150 && Math.hypot(camX - s0.x, camZ - s0.z) > 150) {
        herstel(); st.x = s0.x; st.z = s0.z; st.yaw = wrap(P.yaw + TIGER.staat.draai); st.koepel = 0; st.richt = 0; st.v = 0; st.draai = 0;
      }
    }
    st.herlaad = Math.max(0, st.herlaad - dt);
    st.terug = Math.max(0, st.terug - dt * 0.8);
    st.vlam = Math.max(0, st.vlam - dt * 4);
    const R = TIGER.rij;
    if (actief) {
      const k = player.keys || {};
      const gas = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), stuur = (k.KeyA ? 1 : 0) - (k.KeyD ? 1 : 0);
      const doel = gas > 0 ? R.top : gas < 0 ? -R.achteruit : 0;
      const a = gas !== 0 && Math.sign(doel - st.v) === Math.sign(gas) ? R.optrek : R.rem;
      st.v += Math.sign(doel - st.v) * Math.min(Math.abs(doel - st.v), a * dt);
      // draaien zoals een tank: op de plaats sneller dan rijdend, en achteruit dezelfde kant op (de rupsen tegen elkaar in)
      const dDoel = stuur * (Math.abs(st.v) < 0.5 ? R.draai : R.draaiRijdend);
      st.draai += (dDoel - st.draai) * Math.min(1, dt * 3);
      const yaw = wrap(st.yaw + st.draai * dt);
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      /*
       (16 okt) Een lantaarnpaal rijdt hij omver: de paal heeft een botsdoos die de Tiger stopte als een muur. Vóór het verplaatsen
       drie punten over de voorkant (of de achterkant, achteruit) die js/kaartwereld.js `raakLantaarn` laten kijken; een auto moet
       daar 5 m/s voor rijden, een tank van 57 ton niet (de snelheid gaat er daarom als minstens 6 in).
      */
      if (raakLantaarn && Math.abs(st.v) > 0.6) {
        const s = Math.sign(st.v), d = TIGER.maat.L / 2 + 0.45, rx = Math.cos(yaw), rz = -Math.sin(yaw);
        for (const u of [-TIGER.maat.B / 2 + 0.35, 0, TIGER.maat.B / 2 - 0.35]) {
          const px = st.x + fx * d * s + rx * u, pz = st.z + fz * d * s + rz * u;
          if (raakLantaarn(px, pz, s > 0 ? yaw : wrap(yaw + Math.PI), Math.max(6, Math.abs(st.v)))) {
            if (geluid && geluid.klap) geluid.klap();
            if (geluid && geluid.glas) geluid.glas();
            opSchok(0.12);
            st.lantaarns = (st.lantaarns || 0) + 1;
          }
        }
      }
      let nx = st.x + fx * st.v * dt, nz = st.z + fz * st.v * dt;
      [nx, nz] = botsUit(nx, nz, yaw);
      if (vrijOp(nx, nz, yaw)) {
        const echt = (nx - st.x) * fx + (nz - st.z) * fz;
        if (Math.abs(echt) < Math.abs(st.v * dt) * 0.3 && Math.abs(st.v) > 1) st.v *= 0.5;     // tegen een muur
        st.x = nx; st.z = nz; st.yaw = yaw;
      } else { st.v = 0; }
      // de koepel draait naar waar de muis wijst, met zijn eigen snelheid; het kanon richt op en neer
      const wilK = wrap(player.yaw - st.yaw - st.koepel);
      st.koepel = wrap(st.koepel + Math.sign(wilK) * Math.min(Math.abs(wilK), TIGER.koepel * dt));
      const wilR = Math.max(TIGER.richt[0], Math.min(TIGER.richt[1], player.pitch));
      st.richt += Math.sign(wilR - st.richt) * Math.min(Math.abs(wilR - st.richt), 0.25 * dt);
      // de speler zit erin: zijn plek is die van de Tiger (de politie, de LOD, de voetgangers kijken daarnaar)
      player.pos.set(st.x, st.y, st.z);
      // (16 okt) een zware dieselbrom: laag toerental, stationair 600, hoogstens 2600 bij de topsnelheid
      if (geluid && geluid.motorToeren) geluid.motorToeren(Math.abs(st.v), R.top, { toeren: 600 + Math.min(1, Math.abs(st.v) / R.top) * 1700 + Math.abs(st.draai) * 120, rood: 2600, stationair: 600, bak: 1 });
    }
    peilGrond();
    // de rupsen en de wielen: links en rechts apart, want draaien laat ze tegen elkaar in lopen
    const halfB = TIGER.maat.B / 2 - RUPS.breed / 2;
    for (const r of T.rupsen) {
      const ds = (st.v + r.kant * -st.draai * halfB) * dt;
      r.mat.map.offset.x -= ds / RUPS.schakel;
      r.s = ds;
    }
    for (const w of T.wielen) {
      const ds = (st.v + w.kant * -st.draai * halfB) * dt;
      w.m.rotation.x -= ds / w.r;
    }
    zetModel();
    // te voet om de Tiger heen: de botsdoos houdt je tegen (hij staat in de lijst met losse dozen)
    if (actief) zetHud();
  }

  // de camera: binnen over de koepel langs de loop, of met V van buiten
  function zetCamera() {
    if (!actief) return;
    T.groep.updateMatrixWorld(true);
    if (derdeAan()) {
      const yaw = player.yaw, pitch = Math.max(-0.6, Math.min(0.35, player.pitch - 0.12));
      const cp = Math.cos(pitch), dx = -Math.sin(yaw) * cp, dy = Math.sin(pitch), dz = -Math.cos(yaw) * cp;
      const py = st.y + 3.4;
      const afst = vrijeCamera ? Math.max(5, vrijeCamera(st.x, py, st.z, -dx, -dy, -dz, 12)) : 12;
      camera.position.set(st.x - dx * afst, Math.max(st.y + 1.2, py - dy * afst), st.z - dz * afst);
      camera.rotation.set(0, 0, 0, 'YXZ');
      camera.rotation.y = yaw; camera.rotation.x = pitch;
      return;
    }
    // op het dak van de koepel, rechts van de koepel van de commandant, net boven de loop: de loop loopt door het beeld
    // (een schot) het oog schiet even naar achteren en omhoog
    const oog = new THREE.Vector3(0.0, 1.30 + st.kick * 0.12, -0.95 + st.kick * 0.35);
    T.koepel.localToWorld(oog);
    camera.position.copy(oog);
    camera.rotation.set(0, 0, 0, 'YXZ');
    camera.rotation.y = st.yaw + st.koepel;
    camera.rotation.x = st.richt - 0.09 + st.pitch * Math.cos(st.koepel) + st.kick * 0.05;
    camera.rotation.z = st.rol * Math.cos(st.koepel);
  }

  return {
    get actief() { return actief; },
    get stand() { return { ...st }; },
    get plek() { return { ...P }; },
    T, gedenk: plek, doos,
    // E: instappen als je naast de Tiger staat, uitstappen als je erin zit
    toets() {
      if (actief) return uit();
      if (player.inCar || player.binnen || player.zit || player.inDrone) return false;
      if (!instap()) return false;
      return stapIn() !== false;
    },
    hint() { return !actief && !player.inCar && instap() ? (st.kapot ? 'De Tiger is uitgebrand' : 'E — in de Tiger stappen') : null; },
    uit, vuur, update, zetCamera, zetHud, raak, ontplof, herstel,
    get leven() { return st.hp; }, get kapot() { return st.kapot; },
    // terug naar de gedenkplek (proeven, laden)
    zetTerug() { uit(); if (st.kapot) herstel(); st.hp = TIGER.leven; st.x = s0.x; st.z = s0.z; st.yaw = wrap(P.yaw + TIGER.staat.draai); st.koepel = 0; st.richt = 0; st.v = 0; st.draai = 0; st.herlaad = 0; peilGrond(); zetModel(); },
    // (voor proeven) de Tiger ergens anders neerzetten
    __zet(x, z, yaw) { if (actief) uit(); st.x = x; st.z = z; st.yaw = wrap(yaw); st.v = 0; st.draai = 0; peilGrond(); zetModel(); return true; },
    // een tank is ook een blokkade voor het verkeer (js/verkeersregels.js meet hem met zijn maat)
    blok: { get x() { return st.x; }, get z() { return st.z; }, get yaw() { return st.yaw; }, get speed() { return st.v; }, soort: 'tiger', mesh: T.romp },
  };
}
