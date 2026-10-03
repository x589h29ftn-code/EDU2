/*
 Radio Tinga: de studio van de lokale omroep, aan de weg Tinga (missie 18, stap 107).

 Gevraagd op 3 okt 2026, met een foto van een radiostudio: "De studio van Tinga, zoek een plek
 hiervoor en maak dit. Zorg voor interieur met dj spullen voor radio zender waar je met E de
 usb-stick in doet en dan speelt het af."

 De plek: het lage pand aan de weg Tinga (BAG-type `zorg`, 1996, een plat dak op ruim 4 m). Radio
 Tinga aan de Tinga. Buiten krijgt het een zendmast op het dak, die je van ver over de daken
 ziet, en een zuil met het merk naast de ingang.

 Binnen is het dezelfde truc als de boerderij en de Poiesz (js/boerderij.js, js/supermarkt.js): een
 losse, dichte kamer ruim buiten het kaartgebied, en de deur teleporteert. De studio is geen
 nagebouwd pand maar één kamer van 8,4 bij 7,2 m, ingericht naar de foto:

   - een gebogen bureau, wit blad met een zwarte rand, om de stoel van de dj heen;
   - twee mengpanelen met schuiven, toetsenborden, vijf schermen op de achterrand;
   - twee microfoons aan een arm, en twee luidsprekers die van het plafond hangen;
   - een rek met apparatuur en een signaalpaal (rood, oranje, groen) naast de deur;
   - ramen met dichte lamellen (de ramen van een binnenruimte zijn altijd dicht), een glazen wand
     naar de regiekamer, en het merk groot en blauw op de wand;
   - een systeemplafond met spots, donker tapijt, en boven de deur het ON AIR-bord.

 Op het eerste mengpaneel zit de usb-poort (`zetUsb`) en de hoofdschuif die omhoog gaat
 (`zetSchuif`); het ON AIR-bord brandt met `zetOnAir`. De dj (Sjors) zit aan tafel; het verhaal
 laat hem opstaan en koffie halen (js/verhaal.js, missie 18). Wat er gebeurt staat daar; hier
 staat alleen de ruimte, met de plekken die het verhaal nodig heeft (`plekken`).

 Het licht zit ook hier in de vlakken (de vertexkleuren), niet in lampen: zie js/interieur.js.
 Een studio is van boven gelijkmatig verlicht door de spots, net als een winkel.
*/
import * as THREE from 'three';
import { KAART } from './kaartwereld.js';
import { addCollider, resolveCollisions } from './world.js';
import { plattegrond } from './interieur.js';
import { Persoon } from './persoon.js';

const PAND = { type: 'zorg' };

// ---------- maten (m) ----------
export const STUDIO = {
  breed: 8.4, diep: 7.2, plafond: 2.9, muur: 0.25,
  deurX: 1.2,                     // de deur naar de gang, links in de voorwand
  koffieX: 7.2,                   // de deur naar de koffiehoek, rechts in de voorwand
  stoel: { x: 4.6, z: 4.2 },      // waar de dj zit; het bureau buigt eromheen, naar achteren kijkend
  blad: 0.76,                     // hoogte van het bureaublad
  binnen: 0.62, buiten: 1.55,     // de straal van het bureau om de stoel
  hoek: 1.98,                     // halve openingshoek van het bureau (rad, vanaf achteren gemeten)
  tafelBereik: 1.25,              // zo dicht bij de stoel werkt E aan de tafel
  deurBereik: 3.0,
  uitVoor: 3.2,                   // zover voor de gevel kom je weer buiten
  mast: 18,                       // de zendmast steekt zoveel boven het dak uit
};
export const ZENDER = { naam: 'Radio Tinga', frequentie: '87.9 FM' };

const KLEUR = { blauw: '#1d4fa8', blauwDonker: '#14387a', oranje: '#f28c1b', wit: '#f3f4f2' };

// ---------- kleine texturehulpjes ----------
function doek(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function texture(c, rx = 1, ry = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function rnd(seed) {
  let s = seed >>> 0 || 7;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// het merk: een golfje in oranje en de naam in blauw
function tekenMerk(g, x, y, h, kleur = KLEUR.blauw, golf = KLEUR.oranje) {
  g.save();
  g.strokeStyle = golf; g.lineWidth = h * 0.12; g.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.arc(x - h * 1.9, y, h * (0.22 + i * 0.2), -0.9, 0.9);
    g.stroke();
  }
  g.fillStyle = kleur;
  g.font = `900 ${Math.round(h)}px Arial, sans-serif`;
  g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText('RADIO', x - h * 1.25, y - h * 0.48);
  g.fillText('TINGA', x - h * 1.25, y + h * 0.52);
  g.restore();
}
// donker tapijt met een fijne korrel
function tapijt() {
  const S = 256, c = doek(S, S), g = c.getContext('2d'), r = rnd(11);
  g.fillStyle = '#2a2c30'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 4200; i++) {
    const v = 30 + Math.floor(r() * 26);
    g.fillStyle = `rgb(${v},${v + 1},${v + 4})`;
    g.fillRect(r() * S, r() * S, 1.5, 1.5);
  }
  return c;
}
// systeemplafond: platen van 60 cm met een lichte voeg
function plafondplaat() {
  const S = 128, c = doek(S, S), g = c.getContext('2d'), r = rnd(5);
  g.fillStyle = '#e9eae7'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 500; i++) { g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect(r() * S, r() * S, 1, 1); }
  g.fillStyle = '#c9cbc8'; g.fillRect(0, 0, S, 3); g.fillRect(0, 0, 3, S);
  return c;
}
// dichte lamellen voor een raam: lichte latjes, daglicht ertussen, twee koordjes
function lamellen() {
  const B = 256, H = 256, c = doek(B, H), g = c.getContext('2d');
  g.fillStyle = '#dfe6ea'; g.fillRect(0, 0, B, H);
  for (let y = 0; y < H; y += 10) {
    const lg = g.createLinearGradient(0, y, 0, y + 8);
    lg.addColorStop(0, '#f6f7f6'); lg.addColorStop(1, '#c8cccd');
    g.fillStyle = lg; g.fillRect(0, y, B, 8);
  }
  g.fillStyle = 'rgba(80,80,80,0.5)';
  g.fillRect(B * 0.3, 0, 2, H); g.fillRect(B * 0.7, 0, 2, H);
  // het kozijn
  g.strokeStyle = '#2b2d31'; g.lineWidth = 12; g.strokeRect(6, 6, B - 12, H - 12);
  return c;
}
// de glazen wand naar de regiekamer: donker, met een bureau en een scherm dat licht geeft
function regiekamer() {
  const B = 512, H = 256, c = doek(B, H), g = c.getContext('2d');
  const lg = g.createLinearGradient(0, 0, 0, H);
  lg.addColorStop(0, '#202a33'); lg.addColorStop(1, '#141a20');
  g.fillStyle = lg; g.fillRect(0, 0, B, H);
  g.fillStyle = '#3a4048'; g.fillRect(0, H * 0.62, B, H * 0.1);           // bureau
  for (const x of [70, 170, 300]) {
    g.fillStyle = '#0d1014'; g.fillRect(x, H * 0.36, 86, 56);
    g.fillStyle = '#3d6fb0'; g.fillRect(x + 4, H * 0.36 + 4, 78, 48);
    g.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < 5; i++) g.fillRect(x + 8, H * 0.36 + 9 + i * 8, 40 + (i * 13) % 30, 3);
  }
  g.fillStyle = '#0c0f12'; g.fillRect(420, H * 0.25, 60, H * 0.37);        // een rek
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 3 ? '#2ecc71' : '#e74c3c'; g.fillRect(430 + (i % 4) * 11, H * 0.3 + Math.floor(i / 4) * 16, 4, 4); }
  // spiegeling op het glas
  g.fillStyle = 'rgba(255,255,255,0.08)';
  g.beginPath(); g.moveTo(40, 0); g.lineTo(140, 0); g.lineTo(60, H); g.lineTo(-40, H); g.fill();
  g.strokeStyle = '#2b2d31'; g.lineWidth = 10; g.strokeRect(5, 5, B - 10, H - 10);
  return c;
}
// een mengpaneel van boven: kanalen met een schuif, knoppen en gekleurde toetsen
function mengpaneel() {
  const B = 512, H = 384, c = doek(B, H), g = c.getContext('2d'), r = rnd(3);
  g.fillStyle = '#cfd2d4'; g.fillRect(0, 0, B, H);
  const n = 12, w = B / n;
  for (let i = 0; i < n; i++) {
    const x = i * w;
    g.fillStyle = i % 2 ? '#c6c9cb' : '#d4d7d9'; g.fillRect(x, 0, w, H);
    // knoppen bovenaan
    for (let k = 0; k < 3; k++) {
      g.fillStyle = '#2b2e33'; g.beginPath(); g.arc(x + w / 2, 26 + k * 34, 11, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e9ebec'; g.fillRect(x + w / 2 - 1, 16 + k * 34, 2, 8);
    }
    // toetsen
    g.fillStyle = ['#e74c3c', '#f1c40f', '#2ecc71', '#ecf0f1'][i % 4];
    g.fillRect(x + 8, 128, w - 16, 18);
    g.fillStyle = '#ecf0f1'; g.fillRect(x + 8, 152, w - 16, 14);
    // de sleuf van de schuif, en de schuif
    g.fillStyle = '#1c1e22'; g.fillRect(x + w / 2 - 3, 182, 6, 170);
    const y = 200 + r() * 120;
    g.fillStyle = '#3a3d42'; g.fillRect(x + w / 2 - 12, y, 24, 22);
    g.fillStyle = '#f5f5f5'; g.fillRect(x + w / 2 - 12, y + 9, 24, 3);
  }
  g.strokeStyle = '#8c9094'; g.lineWidth = 4; g.strokeRect(2, 2, B - 4, H - 4);
  return c;
}
// een scherm: een afspeellijst, een golfvorm, of de klok met de uitzending
function scherm(soort) {
  const B = 256, H = 160, c = doek(B, H), g = c.getContext('2d'), r = rnd(soort * 17 + 3);
  g.fillStyle = '#16191f'; g.fillRect(0, 0, B, H);
  g.fillStyle = '#232833'; g.fillRect(0, 0, B, 16);
  g.fillStyle = '#8ea2c0'; g.font = '10px Arial'; g.fillText(['Afspeellijst', 'Uitzending', 'Opnames', 'Nieuws', 'Klok'][soort % 5], 6, 11);
  if (soort % 5 === 0 || soort % 5 === 3) {
    for (let i = 0; i < 9; i++) {
      g.fillStyle = i === 2 ? '#2f6fd6' : (i % 2 ? '#1c2028' : '#20252e');
      g.fillRect(4, 22 + i * 15, B - 8, 13);
      g.fillStyle = i === 2 ? '#ffffff' : '#b8c2d0';
      g.fillRect(10, 26 + i * 15, 60 + r() * 90, 4);
      g.fillRect(B - 50, 26 + i * 15, 36, 4);
    }
  } else if (soort % 5 === 1 || soort % 5 === 2) {
    for (let k = 0; k < 2; k++) {
      const y0 = 40 + k * 60;
      g.fillStyle = k ? '#1d3b2a' : '#1c2c46'; g.fillRect(4, y0 - 22, B - 8, 46);
      g.strokeStyle = k ? '#2ecc71' : '#5dade2'; g.lineWidth = 1;
      g.beginPath();
      for (let x = 6; x < B - 6; x += 2) { const a = (0.3 + 0.7 * r()) * 18; g.moveTo(x, y0 - a); g.lineTo(x, y0 + a); }
      g.stroke();
    }
    g.fillStyle = '#f1c40f'; g.fillRect(B * 0.42, 18, 2, H - 24);
  } else {
    g.fillStyle = '#e74c3c'; g.font = 'bold 44px Arial'; g.textAlign = 'center';
    g.fillText('08:10:24', B / 2, 80);
    g.fillStyle = '#5dade2'; g.font = '14px Arial'; g.fillText(`${ZENDER.naam} · ${ZENDER.frequentie}`, B / 2, 116);
  }
  return c;
}
// de voorkant van een luidspreker: een woofer en een tweeter
function speakerFront() {
  const B = 128, H = 160, c = doek(B, H), g = c.getContext('2d');
  g.fillStyle = '#1b1c1f'; g.fillRect(0, 0, B, H);
  const rg = g.createRadialGradient(B / 2, H * 0.62, 6, B / 2, H * 0.62, 44);
  rg.addColorStop(0, '#4a4c50'); rg.addColorStop(0.5, '#141517'); rg.addColorStop(1, '#2c2e32');
  g.fillStyle = rg; g.beginPath(); g.arc(B / 2, H * 0.62, 44, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2c2e32'; g.beginPath(); g.arc(B / 2, H * 0.2, 14, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#9aa0a6'; g.beginPath(); g.arc(B / 2, H * 0.2, 5, 0, Math.PI * 2); g.fill();
  return c;
}
// de voorkant van het rek: apparaten van één of twee eenheden met lampjes
function rekFront() {
  const B = 128, H = 384, c = doek(B, H), g = c.getContext('2d'), r = rnd(9);
  g.fillStyle = '#121316'; g.fillRect(0, 0, B, H);
  let y = 8;
  while (y < H - 20) {
    const h = r() < 0.6 ? 18 : 36;
    g.fillStyle = r() < 0.5 ? '#2a2c31' : '#33363c'; g.fillRect(8, y, B - 16, h - 2);
    for (let i = 0; i < 4; i++) { g.fillStyle = r() < 0.3 ? '#e74c3c' : (r() < 0.6 ? '#2ecc71' : '#f39c12'); g.fillRect(14 + i * 7, y + 6, 3, 3); }
    g.fillStyle = '#6b7078'; g.fillRect(B - 44, y + 5, 28, 3);
    y += h;
  }
  return c;
}
// het merk groot op de wand, staand (zoals op de foto)
function wandmerk() {
  const B = 256, H = 768, c = doek(B, H), g = c.getContext('2d');
  g.fillStyle = KLEUR.wit; g.fillRect(0, 0, B, H);
  g.save();
  g.translate(B * 0.55, H * 0.5); g.rotate(-Math.PI / 2);
  g.fillStyle = KLEUR.blauw; g.font = '900 150px Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('TINGA', 40, 0);
  g.fillStyle = KLEUR.oranje; g.font = '900 64px Arial, sans-serif';
  g.fillText('RADIO', -250, -86);
  g.restore();
  g.strokeStyle = KLEUR.oranje; g.lineWidth = 12; g.lineCap = 'round';
  for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(B * 0.5, H - 70, 18 + i * 18, Math.PI * 1.2, Math.PI * 1.8); g.stroke(); }
  return c;
}
// het ON AIR-bord (de kleur van het materiaal zet hem aan of uit)
function onAirBord() {
  const B = 256, H = 96, c = doek(B, H), g = c.getContext('2d');
  g.fillStyle = '#ff2a1f'; g.fillRect(0, 0, B, H);
  g.fillStyle = '#ffffff'; g.font = '900 56px Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('ON AIR', B / 2, H / 2 + 3);
  g.strokeStyle = '#1a1a1a'; g.lineWidth = 8; g.strokeRect(4, 4, B - 8, H - 8);
  return c;
}
// de zuil bij de ingang
function zuilBord() {
  const B = 256, H = 640, c = doek(B, H), g = c.getContext('2d');
  g.fillStyle = KLEUR.blauwDonker; g.fillRect(0, 0, B, H);
  g.fillStyle = KLEUR.wit; g.fillRect(14, 14, B - 28, 250);
  tekenMerk(g, B * 0.58, 139, 58);
  g.fillStyle = '#ffffff'; g.font = 'bold 40px Arial'; g.textAlign = 'center';
  g.fillText(ZENDER.frequentie, B / 2, 330);
  g.font = '24px Arial'; g.fillStyle = '#c9d6ee';
  g.fillText('de omroep van Tinga', B / 2, 372);
  g.fillText('studio · ingang', B / 2, 410);
  g.fillStyle = KLEUR.oranje; g.fillRect(14, H - 40, B - 28, 16);
  return c;
}

/*
 Bouwt de studio en de buitenkant. Levert null als het pand niet in de kaart staat; dan is er geen
 Radio Tinga en speelt missie 18 niet (js/verhaal.js kijkt daarnaar).
*/
export function initStudio({ scene, player, hud }) {
  if (!KAART || !KAART.panden) return null;
  const pand = KAART.panden.find(p => p.type === PAND.type);
  if (!pand || !pand.voet || !pand.rect || !pand.front) return null;

  const S = STUDIO, B = S.breed, D = S.diep, P = S.plafond;
  const plan = plattegrond(pand);
  const PAND_B = Math.max(...plan.punten.map(q => q[0]));
  /*
   De ingang. Het pand heeft een grillig grondvlak, en het pad met de naam Tinga loopt er deels
   onder door. De deur komt daarom op een gevel van minstens 4 m, met de normaal naar buiten (uit de
   draairichting van het grondvlak), op een plek waar de stoep vrij is en buiten het pand ligt; van
   die plekken wint de stoep die het dichtst bij de Tinga ligt. De Tinga is hier een voetpad (het
   adres van het pand); de dichtstbijzijnde weg voor auto's is de Molenkrite, zo'n 50 m verderop
   (gemeten in tools/uitzendingtest.mjs). Daar parkeer je, en dan loop je het pad op.
  */
  const binnenVoet = (x, z) => {
    let i = false; const r = pand.voet;
    for (let a = 0, b = r.length - 1; a < r.length; b = a++) {
      const [xa, za] = r[a], [xb, zb] = r[b];
      if ((za > z) !== (zb > z) && x < (xb - xa) * (z - za) / (zb - za) + xa) i = !i;
    }
    return i;
  };
  const vrij = (x, z, r) => { const [rx, rz] = resolveCollisions(x, z, r); return Math.hypot(rx - x, rz - z) < 0.02 && !binnenVoet(x, z); };
  const deurPlek = (() => {
    // de assen met de naam Tinga (ook paden), om de afstand tot de stoep te meten
    const tinga = (KAART.wegassen || []).filter(w => /^tinga$/i.test(w.naam || ''));
    const totTinga = (x, z) => {
      let d = Infinity;
      for (const w of tinga) for (let i = 1; i < w.pts.length; i++) {
        const [ax, az] = w.pts[i - 1], [bx, bz] = w.pts[i];
        const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
        d = Math.min(d, Math.hypot(ax + dx * t - x, az + dz * t - z));
      }
      return d;
    };
    // de draairichting van het grondvlak: daarmee wijst de normaal van elke gevel naar buiten
    const v = pand.voet;
    let opp = 0;
    for (let i = 0; i < v.length; i++) { const a = v[i], b = v[(i + 1) % v.length]; opp += a[0] * b[1] - b[0] * a[1]; }
    const buiten = opp > 0 ? -1 : 1;
    let beste = null;
    for (let i = 0; i < v.length; i++) {
      const [ax, az] = v[i], [bx, bz] = v[(i + 1) % v.length];
      const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
      if (L < 4) continue;                         // een gevel van minder dan 4 m is geen ingang
      const nx = -dz / L * buiten, nz = dx / L * buiten;
      for (const t of [0.3, 0.5, 0.7]) {
        const x = ax + dx * t, z = az + dz * t;
        const st = { x: x + nx * S.uitVoor, z: z + nz * S.uitVoor };
        // de stoep moet vrij zijn en buiten het pand liggen, en net zo de plek een stap voor de deur
        if (!vrij(st.x, st.z, 0.45) || !vrij(x + nx * 1.2, z + nz * 1.2, 0.35)) continue;
        const d = totTinga(st.x, st.z);
        if (!beste || d < beste.d) beste = { d, x, z, f: [nx, nz] };
      }
    }
    return beste;
  })();
  const F = deurPlek ? deurPlek.f : plan.f;
  const R = [F[1], -F[0]];                         // naar rechts, gezien van buiten (zoals plattegrond)
  const deurBuiten = deurPlek ? { x: deurPlek.x, z: deurPlek.z } : plan.naarWereld(PAND_B / 2, 0);
  const stoep = { x: deurBuiten.x + F[0] * S.uitVoor, z: deurBuiten.z + F[1] * S.uitVoor };

  // Ruim buiten het kaartgebied, ver van de woningen, de boerderij en de Poiesz.
  const G = KAART.gebied || { x1: 400, z1: 460 };
  const NUL = { x: G.x1 + 640, z: G.z1 + 1250 };
  const groep = new THREE.Group();
  groep.position.set(NUL.x, 0, NUL.z);
  scene.add(groep);

  // ---------- licht in de vlakken: spots van boven, gelijkmatig ----------
  function vlakKleur(nx, ny, nz) {
    return Math.min(1, 0.60 + 0.30 * Math.max(0, ny) + 0.10 * Math.abs(nx) + 0.06 * Math.abs(nz) + 0.08 * Math.max(0, -ny));
  }
  function kleurIn(geo, vol = false) {
    const n = geo.getAttribute('normal'), cnt = geo.getAttribute('position').count;
    const col = new Float32Array(cnt * 3);
    for (let i = 0; i < cnt; i++) {
      const f = vol ? 1 : (n ? vlakKleur(n.getX(i), n.getY(i), n.getZ(i)) : 0.9);
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = f;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
  }

  // ---------- materialen ----------
  const vlak = (c, rx, ry) => new THREE.MeshBasicMaterial({ map: texture(c, rx, ry), vertexColors: true, fog: false });
  const plat = (kleur) => new THREE.MeshBasicMaterial({ color: kleur, vertexColors: true, fog: false });
  const MAT = {
    vloer: vlak(tapijt(), 1, 1),
    plafond: vlak(plafondplaat(), 1, 1),
    muur: plat(0xeceeec),
    plint: plat(0x2f3236),
    blad: plat(0xf4f3ef),
    rand: plat(0x1c1d20),
    zwart: plat(0x222428),
    grijs: plat(0x8b9096),
    staal: plat(0xb9bdc1),
    wit: plat(0xf2f2f0),
    lamp: new THREE.MeshBasicMaterial({ color: 0xfffbea, fog: false }),
    lamellen: vlak(lamellen(), 1, 1),
    regie: vlak(regiekamer(), 1, 1),
    paneel: vlak(mengpaneel(), 1, 1),
    speaker: vlak(speakerFront(), 1, 1),
    rek: vlak(rekFront(), 1, 1),
    wandmerk: vlak(wandmerk(), 1, 1),
    toets: plat(0x34373c),
    stoel: plat(0x17181b),
    paalRood: plat(0xd83a2e), paalOranje: plat(0xf0a020), paalGroen: plat(0x2fbf5a),
    usb: plat(0x2f6fd6),
  };
  const schermMat = [0, 1, 2, 3, 4].map(i => vlak(scherm(i), 1, 1));
  // het ON AIR-bord: één materiaal, de kleur zet hem aan (wit = vol) of uit (donker)
  const onAirMat = new THREE.MeshBasicMaterial({ map: texture(onAirBord(), 1, 1), color: 0x3a1210, fog: false });

  // ---------- bouwstenen: per materiaal samengevoegd ----------
  const bakken = new Map();
  const dozen = [];                 // botsingsdozen { x, z, hx, hz, yaw, h }
  function voegGeo(mat, geo, vol = false) {
    let b = bakken.get(mat);
    if (!b) { b = { pos: [], nor: [], uv: [], col: [] }; bakken.set(mat, b); }
    const pos = geo.getAttribute('position'), nor = geo.getAttribute('normal'), uv = geo.getAttribute('uv');
    const idx = geo.getIndex();
    const zet = (i) => {
      b.pos.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      const nx = nor ? nor.getX(i) : 0, ny = nor ? nor.getY(i) : 1, nz = nor ? nor.getZ(i) : 0;
      b.nor.push(nx, ny, nz);
      const f = vol ? 1 : vlakKleur(nx, ny, nz);
      b.col.push(f, f, f);
      b.uv.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
    };
    if (idx) for (let i = 0; i < idx.count; i++) zet(idx.getX(i));
    else for (let i = 0; i < pos.count; i++) zet(i);
    geo.dispose();
  }
  // een doos van hoek tot hoek; `uvm` meters per herhaling, `uvVast` de hele tekening per vlak
  function doos(x0, x1, z0, z1, y0, y1, mat, { uvm = 0, botst = true } = {}) {
    const w = x1 - x0, h = y1 - y0, d = z1 - z0;
    if (w <= 0 || h <= 0 || d <= 0) return;
    const geo = new THREE.BoxGeometry(w, h, d);
    if (uvm) {
      const uv = geo.getAttribute('uv');
      const maten = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
      for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
        const k = f * 4 + i;
        uv.setXY(k, uv.getX(k) * maten[f][0] / uvm, uv.getY(k) * maten[f][1] / uvm);
      }
    }
    geo.translate(x0 + w / 2, y0 + h / 2, z0 + d / 2);
    voegGeo(mat, geo);
    if (botst) dozen.push({ x: x0 + w / 2, z: z0 + d / 2, hx: w / 2, hz: d / 2, yaw: 0, h: y1 });
  }
  // een gedraaide doos rond (x, y, z): breed langs zijn eigen x, kijkend naar `yaw`
  function blok(x, y, z, w, h, d, yaw, mat, { kantel = 0, botst = false, vol = false } = {}) {
    const geo = new THREE.BoxGeometry(w, h, d);
    if (kantel) geo.rotateX(kantel);
    geo.rotateY(yaw);
    geo.translate(x, y, z);
    voegGeo(mat, geo, vol);
    if (botst) dozen.push({ x, z, hx: w / 2, hz: d / 2, yaw, h: y + h / 2 });
  }
  // een vlak met de hele tekening erop, met de voorkant naar `yaw` (0 = +z)
  function bordVlak(x, y, z, w, h, yaw, mat, vol = true) {
    const geo = new THREE.PlaneGeometry(w, h);
    geo.rotateY(yaw);
    geo.translate(x, y, z);
    voegGeo(mat, geo, vol);
  }
  // een staaf van a naar b
  const OMHOOG = new THREE.Vector3(0, 1, 0);
  function staaf(a, b, r, mat) {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const lang = va.distanceTo(vb);
    if (lang < 1e-4) return;
    const geo = new THREE.CylinderGeometry(r, r, lang, 10);
    const q = new THREE.Quaternion().setFromUnitVectors(OMHOOG, vb.clone().sub(va).normalize());
    geo.applyQuaternion(q);
    const m = va.clone().add(vb).multiplyScalar(0.5);
    geo.translate(m.x, m.y, m.z);
    voegGeo(mat, geo);
  }
  function vloerVlak(x0, x1, z0, z1, y, mat, omhoog = true, uvm = 0) {
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    geo.rotateX(omhoog ? -Math.PI / 2 : Math.PI / 2);
    if (uvm) {
      const uv = geo.getAttribute('uv');
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0) / uvm, uv.getY(i) * (z1 - z0) / uvm);
    }
    geo.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
    voegGeo(mat, geo);
  }

  // ---------- vloer, plafond, wanden ----------
  const M = S.muur;
  vloerVlak(0, B, 0, D, 0, MAT.vloer, true, 2.0);
  vloerVlak(0, B, 0, D, P, MAT.plafond, false, 0.6);
  doos(-M, B + M, -M, 0, 0, P + 0.2, MAT.muur);              // voorwand (met de deuren erop getekend)
  doos(-M, B + M, D, D + M, 0, P + 0.2, MAT.muur);           // achterwand met de ramen
  doos(-M, 0, 0, D, 0, P + 0.2, MAT.muur);                   // links: de glazen wand
  doos(B, B + M, 0, D, 0, P + 0.2, MAT.muur);                // rechts: het merk en een raam
  // plinten
  doos(0, B, 0.0, 0.02, 0, 0.08, MAT.plint, { botst: false });
  doos(0, B, D - 0.02, D, 0, 0.08, MAT.plint, { botst: false });
  doos(0, 0.02, 0, D, 0, 0.08, MAT.plint, { botst: false });
  doos(B - 0.02, B, 0, D, 0, 0.08, MAT.plint, { botst: false });
  // de twee deuren in de voorwand: een donker blad met een kozijn en een kruk
  for (const dx of [S.deurX, S.koffieX]) {
    doos(dx - 0.5, dx + 0.5, 0.0, 0.04, 0, 2.15, MAT.zwart, { botst: false });
    doos(dx - 0.56, dx + 0.56, 0.0, 0.03, 2.15, 2.22, MAT.grijs, { botst: false });
    doos(dx + 0.3, dx + 0.42, 0.04, 0.09, 1.0, 1.04, MAT.staal, { botst: false });
  }
  // het ON AIR-bord boven de deur naar de gang (los, zodat de kleur kan wisselen)
  const onAirGeo = kleurIn(new THREE.BoxGeometry(0.62, 0.2, 0.06), true);
  const onAir = new THREE.Mesh(onAirGeo, onAirMat);
  onAir.position.set(S.deurX, 2.48, 0.05);
  groep.add(onAir);
  // ramen met lamellen in de achterwand en rechts
  for (const [x0, x1] of [[1.0, 2.7], [3.4, 5.8], [6.4, 7.8]]) bordVlak((x0 + x1) / 2, 1.62, D - 0.01, x1 - x0, 1.45, Math.PI, MAT.lamellen, false);
  bordVlak(B - 0.01, 1.62, 5.2, 1.8, 1.45, -Math.PI / 2, MAT.lamellen, false);
  // radiatoren onder de ramen
  for (const [x0, x1] of [[1.1, 2.6], [3.6, 5.6], [6.5, 7.7]]) doos(x0, x1, D - 0.1, D - 0.02, 0.18, 0.72, MAT.wit, { botst: false });
  // de glazen wand naar de regiekamer, links
  bordVlak(0.01, 1.55, 3.9, 3.4, 1.5, Math.PI / 2, MAT.regie, false);
  doos(0.0, 0.05, 2.15, 5.65, 0.78, 0.82, MAT.zwart, { botst: false });
  // het merk groot op de rechterwand
  bordVlak(B - 0.01, 1.4, 2.0, 1.7, 2.3, -Math.PI / 2, MAT.wandmerk, false);

  // ---------- het plafond: een verhoogd deel boven het bureau met spots ----------
  const C = S.stoel;
  for (let i = 0; i < 9; i++) {
    const x = 1.3 + (i % 3) * 2.9, z = 1.5 + Math.floor(i / 3) * 2.2;
    const geo = new THREE.CircleGeometry(0.09, 16);
    geo.rotateX(Math.PI / 2);
    geo.translate(x, P - 0.005, z);
    voegGeo(MAT.lamp, geo, true);
  }

  // ---------- het gebogen bureau om de stoel ----------
  /*
   Een ringstuk om de stoel heen, open naar voren (naar de deur): de dj kijkt naar de ramen,
   met de schermen op de achterrand. Wit blad, eronder een zwarte rand en een zwarte voet die
   naar binnen ligt, zoals op de foto.
  */
  function ringVorm(r0, r1, a0, a1) {
    const vorm = new THREE.Shape();
    const n = 40;
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * i / n;
      const p = [Math.sin(a) * r1, Math.cos(a) * r1];
      if (i === 0) vorm.moveTo(p[0], p[1]); else vorm.lineTo(p[0], p[1]);
    }
    for (let i = n; i >= 0; i--) {
      const a = a0 + (a1 - a0) * i / n;
      vorm.lineTo(Math.sin(a) * r0, Math.cos(a) * r0);
    }
    return vorm;
  }
  function ring(r0, r1, y0, y1, mat) {
    // de vorm ligt in x/y en wordt langs z uitgetrokken; een kwartslag om x zet (x, y, z) op
    // (x, −z, y): de y van de vorm wordt de z van de kamer (a = 0 wijst naar de ramen) en de
    // dikte gaat van het blad naar beneden
    const vorm = ringVorm(r0, r1, -S.hoek, S.hoek);
    const geo = new THREE.ExtrudeGeometry(vorm, { depth: y1 - y0, bevelEnabled: false, curveSegments: 6 });
    geo.rotateX(Math.PI / 2);
    geo.translate(C.x, y1, C.z);
    geo.computeVertexNormals();
    voegGeo(mat, geo);
  }
  ring(S.binnen, S.buiten, S.blad - 0.03, S.blad, MAT.blad);
  ring(S.binnen - 0.01, S.buiten + 0.025, S.blad - 0.07, S.blad - 0.03, MAT.rand);
  ring(S.binnen + 0.22, S.buiten - 0.22, 0, S.blad - 0.07, MAT.rand);
  // botsing: stukjes langs de boog
  for (let i = 0; i < 8; i++) {
    const a = -S.hoek + 2 * S.hoek * (i + 0.5) / 8, rm = (S.binnen + S.buiten) / 2;
    const lang = 2 * S.hoek * rm / 8;
    dozen.push({ x: C.x + Math.sin(a) * rm, z: C.z + Math.cos(a) * rm, hx: lang / 2 + 0.05, hz: (S.buiten - S.binnen) / 2, yaw: a, h: S.blad });
  }
  const opBoog = (a, r) => ({ x: C.x + Math.sin(a) * r, z: C.z + Math.cos(a) * r, kijk: a + Math.PI });

  // ---------- op het bureau ----------
  // vijf schermen op voetjes op de achterrand, naar de stoel gericht
  [-1.05, -0.52, 0, 0.52, 1.05].forEach((a, i) => {
    const p = opBoog(a, S.buiten - 0.15);
    staaf([p.x, S.blad, p.z], [p.x, S.blad + 0.16, p.z], 0.025, MAT.zwart);
    blok(p.x, S.blad + 0.01, p.z, 0.22, 0.02, 0.16, p.kijk, MAT.zwart);
    blok(p.x, S.blad + 0.36, p.z, 0.58, 0.36, 0.04, p.kijk, MAT.zwart);
    const sx = p.x + Math.sin(p.kijk) * 0.021, sz = p.z + Math.cos(p.kijk) * 0.021;
    bordVlak(sx, S.blad + 0.36, sz, 0.54, 0.32, p.kijk, schermMat[i]);
  });
  // toetsenborden en muizen
  for (const a of [-0.62, 0.05, 0.75]) {
    const p = opBoog(a, S.binnen + 0.12);
    blok(p.x, S.blad + 0.012, p.z, 0.44, 0.024, 0.15, p.kijk, MAT.toets);
    const m = opBoog(a + 0.36, S.binnen + 0.12);
    blok(m.x, S.blad + 0.015, m.z, 0.06, 0.03, 0.1, m.kijk, MAT.toets);
  }
  // studiomonitortjes op de hoeken
  for (const a of [-1.62, 1.62]) {
    const p = opBoog(a, S.buiten - 0.25);
    blok(p.x, S.blad + 0.2, p.z, 0.2, 0.3, 0.22, p.kijk, MAT.zwart);
    bordVlak(p.x + Math.sin(p.kijk) * 0.112, S.blad + 0.2, p.z + Math.cos(p.kijk) * 0.112, 0.19, 0.28, p.kijk, MAT.speaker);
  }
  // een koptelefoon op het blad
  {
    const p = opBoog(-1.32, S.binnen + 0.3);
    staaf([p.x - 0.09, S.blad + 0.02, p.z], [p.x + 0.09, S.blad + 0.02, p.z], 0.035, MAT.zwart);
  }
  // de microfoons aan een arm: van een paal op de achterrand naar de mond van wie zit
  const MOND = 1.22;
  for (const [a, naar] of [[-0.28, C], [1.35, opBoog(1.0, 0.0)]]) {
    const voet = opBoog(a, S.buiten - 0.12);
    const top = [voet.x, MOND + 0.32, voet.z];
    staaf([voet.x, S.blad, voet.z], top, 0.018, MAT.staal);
    const dx = naar.x - voet.x, dz = naar.z - voet.z, L = Math.hypot(dx, dz) || 1;
    const eind = [voet.x + dx / L * (L - 0.42), MOND + 0.08, voet.z + dz / L * (L - 0.42)];
    staaf(top, eind, 0.014, MAT.staal);
    const mic = [eind[0] + dx / L * 0.12, MOND, eind[2] + dz / L * 0.12];
    staaf(eind, mic, 0.032, MAT.wit);
    staaf(mic, [mic[0] + dx / L * 0.05, MOND - 0.01, mic[2] + dz / L * 0.05], 0.04, MAT.grijs);
  }
  // de stoel van de dj
  staaf([C.x, 0.06, C.z], [C.x, 0.44, C.z], 0.035, MAT.staal);
  for (let k = 0; k < 5; k++) {
    const a = k * Math.PI * 2 / 5;
    staaf([C.x, 0.08, C.z], [C.x + Math.sin(a) * 0.3, 0.05, C.z + Math.cos(a) * 0.3], 0.02, MAT.stoel);
  }
  blok(C.x, 0.48, C.z, 0.5, 0.08, 0.48, 0, MAT.stoel);
  blok(C.x, 0.86, C.z - 0.26, 0.46, 0.62, 0.06, 0, MAT.stoel, { kantel: -0.12 });

  // ---------- de mengpanelen (los: de schuif en de usb-stick bewegen) ----------
  const panelen = [];
  for (const a of [-0.3, 0.38]) {
    const p = opBoog(a, S.binnen + 0.45);
    const g = new THREE.Group();
    g.position.set(p.x, S.blad, p.z);
    g.rotation.y = p.kijk;
    // het lijf, schuin oplopend naar achteren
    const lijf = new THREE.Mesh(kleurIn(new THREE.BoxGeometry(0.62, 0.07, 0.42)), MAT.grijs);
    lijf.position.set(0, 0.05, 0); lijf.rotation.x = 0.14;       // achter hoger dan voor
    g.add(lijf);
    const top = new THREE.Mesh(kleurIn(new THREE.PlaneGeometry(0.6, 0.4), true), MAT.paneel);
    top.rotation.x = -Math.PI / 2 + 0.14; top.position.set(0, 0.087, 0);
    g.add(top);
    groep.add(g);
    panelen.push(g);
  }
  // de hoofdschuif op het eerste paneel: een rode kap die langs de sleuf schuift
  const kapMat = new THREE.MeshBasicMaterial({ color: 0xe0362b, fog: false, vertexColors: true });
  const schuif = new THREE.Mesh(kleurIn(new THREE.BoxGeometry(0.045, 0.03, 0.035)), kapMat);
  panelen[0].add(schuif);
  const SCHUIF = { x: 0.22, laag: 0.15, hoog: -0.12 };     // langs de z van het paneel: laag = dicht bij de dj
  let schuifStand = 0;
  function zetSchuif(v) {
    schuifStand = Math.max(0, Math.min(1, v));
    const z = SCHUIF.laag + (SCHUIF.hoog - SCHUIF.laag) * schuifStand;
    schuif.position.set(SCHUIF.x, 0.1 - z * Math.tan(0.14), z);
    schuif.rotation.x = 0.14;
  }
  zetSchuif(0);
  // de usb-stick in de zijkant van het eerste paneel
  const usb = new THREE.Group();
  {
    const lijf = new THREE.Mesh(kleurIn(new THREE.BoxGeometry(0.075, 0.016, 0.024)), MAT.usb);
    lijf.position.set(0.05, 0, 0);
    const stekker = new THREE.Mesh(kleurIn(new THREE.BoxGeometry(0.02, 0.01, 0.016)), MAT.staal);
    stekker.position.set(0.0, 0, 0);
    usb.add(lijf, stekker);
    usb.position.set(0.32, 0.055, 0.05);
    usb.visible = false;
    panelen[0].add(usb);
  }
  function zetUsb(aan) { usb.visible = !!aan; }

  // ---------- hangende luidsprekers ----------
  for (const a of [-0.95, 0.95]) {
    const p = opBoog(a, S.buiten + 0.35);
    staaf([p.x, P, p.z], [p.x, 2.42, p.z], 0.03, MAT.zwart);
    blok(p.x, 2.2, p.z, 0.42, 0.46, 0.36, p.kijk, MAT.zwart, { kantel: 0.2 });
    const fx = Math.sin(p.kijk) * 0.19, fz = Math.cos(p.kijk) * 0.19;
    const geo = new THREE.PlaneGeometry(0.4, 0.44);
    geo.rotateX(0.2); geo.rotateY(p.kijk); geo.translate(p.x + fx, 2.2 - 0.04, p.z + fz);
    voegGeo(MAT.speaker, geo, true);
  }

  // ---------- het rek en de signaalpaal, links naast de deur ----------
  doos(0.0, 0.62, 0.7, 1.5, 0, 1.95, MAT.zwart);
  bordVlak(0.63, 1.0, 1.1, 0.74, 1.8, Math.PI / 2, MAT.rek);
  staaf([0.95, 0, 1.75], [0.95, 1.3, 1.75], 0.025, MAT.staal);
  [MAT.paalGroen, MAT.paalOranje, MAT.paalRood].forEach((m, i) => staaf([0.95, 1.3 + i * 0.09, 1.75], [0.95, 1.38 + i * 0.09, 1.75], 0.04, m));
  // en een bank voor gasten tegen de rechterwand, achter het merk
  doos(B - 0.55, B, 3.6, 4.8, 0, 0.45, MAT.stoel);

  // ---------- de meshes ----------
  for (const [mat, b] of bakken) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
    geo.computeBoundingSphere();
    groep.add(new THREE.Mesh(geo, mat));
  }

  // ---------- buiten: de zendmast op het dak en de zuil bij de ingang ----------
  const buiten = new THREE.Group();
  scene.add(buiten);
  const dak = Math.max(pand.nok || 0, pand.goot || 0, 3.5);
  // de mast staat op het midden van het dak, een stuk naar achteren (zo zie je hem over de gevel)
  const mastVoet = { x: pand.rect.cx - F[0] * 4, z: pand.rect.cz - F[1] * 4 };
  const mastRood = new THREE.MeshStandardMaterial({ color: 0xc8352b, roughness: 0.6 });
  const mastWit = new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.6 });
  const mastTop = dak + S.mast;
  {
    // drie staanders met dwarsverbanden, in banden rood en wit
    const R = 0.55, banden = 6;
    for (let k = 0; k < 3; k++) {
      const a = k * Math.PI * 2 / 3;
      for (let b = 0; b < banden; b++) {
        const y0 = dak + S.mast * b / banden, y1 = dak + S.mast * (b + 1) / banden;
        const r0 = R * (1 - 0.6 * b / banden), r1 = R * (1 - 0.6 * (b + 1) / banden);
        const p0 = new THREE.Vector3(mastVoet.x + Math.cos(a) * r0, y0, mastVoet.z + Math.sin(a) * r0);
        const p1 = new THREE.Vector3(mastVoet.x + Math.cos(a) * r1, y1, mastVoet.z + Math.sin(a) * r1);
        const geo = new THREE.CylinderGeometry(0.045, 0.045, p0.distanceTo(p1), 6);
        geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(OMHOOG, p1.clone().sub(p0).normalize()));
        const m = new THREE.Mesh(geo, b % 2 ? mastWit : mastRood);
        m.position.copy(p0.clone().add(p1).multiplyScalar(0.5));
        buiten.add(m);
      }
    }
    // dwarsverbanden: een ring per band
    for (let b = 1; b < banden; b++) {
      const y = dak + S.mast * b / banden, r = R * (1 - 0.6 * b / banden);
      const geo = new THREE.TorusGeometry(r, 0.03, 4, 3);
      geo.rotateX(Math.PI / 2);
      const m = new THREE.Mesh(geo, mastWit);
      m.position.set(mastVoet.x, y, mastVoet.z);
      buiten.add(m);
    }
    // twee schotels en de antenne bovenop
    const schotel = new THREE.MeshStandardMaterial({ color: 0xdedfdc, roughness: 0.5, side: THREE.DoubleSide });
    for (const [h, a] of [[0.45, 0.4], [0.7, 2.6]]) {
      const geo = new THREE.SphereGeometry(0.55, 14, 6, 0, Math.PI * 2, 0, 0.9);
      const m = new THREE.Mesh(geo, schotel);
      m.position.set(mastVoet.x + Math.cos(a) * 0.4, dak + S.mast * h, mastVoet.z + Math.sin(a) * 0.4);
      m.rotation.set(0, -a, Math.PI / 2);
      buiten.add(m);
    }
    const spriet = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.2, 6), mastWit);
    spriet.position.set(mastVoet.x, mastTop + 1.6, mastVoet.z);
    buiten.add(spriet);
  }
  // het rode lampje bovenop: geen lichtbron, een gloeiend bolletje (het aantal lampen blijft gelijk)
  const topLampMat = new THREE.MeshBasicMaterial({ color: 0xff3020, fog: false });
  const topLamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), topLampMat);
  topLamp.position.set(mastVoet.x, mastTop + 3.25, mastVoet.z);
  buiten.add(topLamp);
  // de zuil naast de ingang, haaks op de gevel
  // naast de ingang, rechts of links: de kant waar hij vrij en buiten het pand staat
  const zuil = [3.2, -3.2, 2.4, -2.4].map(k => ({ x: deurBuiten.x + F[0] * 2.4 + R[0] * k, z: deurBuiten.z + F[1] * 2.4 + R[1] * k }))
    .find(p => vrij(p.x, p.z, 0.6)) || { x: deurBuiten.x + F[0] * 2.4 + R[0] * 3.2, z: deurBuiten.z + F[1] * 2.4 + R[1] * 3.2 };
  {
    const zuilMat = new THREE.MeshStandardMaterial({ color: 0x14387a, roughness: 0.6 });
    const doekZuil = texture(zuilBord(), 1, 1);
    // zoals de zuil van het Autohuis (js/garage.js): een beetje eigen licht, dan lees je hem ook 's avonds
    const bordMat = new THREE.MeshStandardMaterial({ map: doekZuil, emissive: 0xffffff, emissiveMap: doekZuil, emissiveIntensity: 0.45, roughness: 0.5 });
    const yaw = Math.atan2(F[0], F[1]);
    const lijf = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.6, 0.32), zuilMat);
    lijf.position.set(zuil.x, 1.3, zuil.z); lijf.rotation.y = yaw;
    buiten.add(lijf);
    for (const kant of [1, -1]) {
      const v = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 2.4), bordMat);
      v.position.set(zuil.x + F[0] * 0.165 * kant, 1.3, zuil.z + F[1] * 0.165 * kant);
      v.rotation.y = kant > 0 ? yaw : yaw + Math.PI;
      buiten.add(v);
    }
    addCollider(zuil.x, zuil.z, 0.5, 0.16, yaw, 2.6);
  }
  // het ON AIR-bord ook buiten, boven de ingang
  const onAirBuiten = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.08), onAirMat);
  onAirBuiten.position.set(deurBuiten.x + F[0] * 0.08, 2.75, deurBuiten.z + F[1] * 0.08);
  onAirBuiten.rotation.y = Math.atan2(F[0], F[1]);
  buiten.add(onAirBuiten);

  let onAirAan = false;
  function zetOnAir(aan) {
    onAirAan = !!aan;
    onAirMat.color.setHex(onAirAan ? 0xffffff : 0x3a1210);
  }

  // ---------- de dj ----------
  const dj = new Persoon({ shirt: 0x1d2a44, broek: 0x2a2a2e, huid: 0xe2b896, haar: 0x3b2a1c });
  // binnen hangt hij niet aan de zon: een beetje eigen gloed (zie de verkoper in js/boerderij.js)
  dj.groep.traverse(o => {
    if (!o.material || !o.material.color) return;
    o.material = o.material.clone();
    o.material.emissive = new THREE.Color(o.material.color).multiplyScalar(0.55);
    o.castShadow = false; o.receiveShadow = false;
  });
  scene.add(dj.groep);
  const ZITTING = 0.5;
  let djZit = true;
  function djAanTafel() {
    djZit = true;
    // op de stoel, iets naar achteren, naar de schermen kijkend (+z)
    dj.zetNeer(NUL.x + C.x, NUL.z + C.z - 0.06, Math.PI);
    dj.groep.visible = true;
  }
  djAanTafel();

  // ---------- botsingsdozen ----------
  function meldAan() {
    for (const d of dozen) addCollider(NUL.x + d.x, NUL.z + d.z, d.hx, d.hz, d.yaw || 0, d.h);
  }
  meldAan();

  // ---------- naar binnen en naar buiten ----------
  const praatEl = document.getElementById('praat');
  const wereld = (x, z) => ({ x: NUL.x + x, z: NUL.z + z });
  const binnenDeur = wereld(S.deurX, 1.0);
  const koffieDeur = wereld(S.koffieX, 0.6);
  // waar je staat om aan de tafel te werken: achter de stoel, iets opzij
  const tafel = wereld(C.x - 0.6, C.z - 0.75);
  const stoel = wereld(C.x, C.z);
  let slot = null;            // een tekst: de deur zit (nog) dicht, zie zetSlot
  let tafelHint = null;       // wat E aan de tafel nu doet (het verhaal zet hem)

  function binnen(x, z) {
    return x > NUL.x - 4 && x < NUL.x + B + 4 && z > NUL.z - 4 && z < NUL.z + D + 4;
  }
  function bijDeur(x, z) {
    if (binnen(x, z)) return Math.hypot(x - binnenDeur.x, z - binnenDeur.z) < S.deurBereik * 0.6 ? 'uit' : null;
    return Math.hypot(x - deurBuiten.x, z - deurBuiten.z) < S.deurBereik ? 'in' : null;
  }
  function bijTafel(x, z) {
    return binnen(x, z) && Math.hypot(x - tafel.x, z - tafel.z) < S.tafelBereik;
  }
  function naarBinnenGaan() {
    player.inCar = null;
    player.pos.set(binnenDeur.x, 0, binnenDeur.z);
    player.yaw = Math.PI;                 // met de rug naar de deur: de studio in (+z)
    player.pitch = 0;
    player.applyCamera();
  }
  function naarBuitenGaan() {
    player.inCar = null;
    const [ux, uz] = resolveCollisions(stoep.x, stoep.z, 0.4);
    player.pos.set(ux, 0, uz);
    player.yaw = Math.atan2(-F[0], -F[1]);
    player.pitch = 0;
    player.applyCamera();
  }

  // E bij de deur. De tafel is van het verhaal (js/verhaal.js vraagt `bijTafel`).
  function toets() {
    if (!player.active && !window.__autoplay) return false;
    const w = bijDeur(player.pos.x, player.pos.z);
    if (w === 'in' && !player.inCar) {
      if (slot) { hud.melding(ZENDER.naam, slot, 3); return true; }
      naarBinnenGaan(); return true;
    }
    if (w === 'uit') { naarBuitenGaan(); return true; }
    return false;
  }

  let hintAan = false, knipper = 0;
  function update(dt, bezet = false) {
    // het lampje op de mast knippert, ook als je er niet bent: je ziet hem van ver
    knipper += dt;
    topLamp.visible = (knipper % 1.6) < 0.9;
    if (djZit && dj.groep.visible) dj.update(dt, { zit: ZITTING });
    if (bezet) { if (hintAan) praatEl.hidden = true; hintAan = false; return; }
    const bezig = player.active || window.__autoplay;
    let tekst = null;
    if (bezig && !player.inCar) {
      if (tafelHint && bijTafel(player.pos.x, player.pos.z)) tekst = tafelHint;
      else {
        const w = bijDeur(player.pos.x, player.pos.z);
        if (w) tekst = w === 'in' ? `E — ${ZENDER.naam} in` : 'E — naar buiten';
      }
    }
    if (tekst) { praatEl.textContent = tekst; praatEl.hidden = false; hintAan = true; }
    else if (hintAan) { praatEl.hidden = true; hintAan = false; }
  }

  function kaart(x, z) {
    if (!binnen(x, z)) return null;
    return { naam: ZENDER.naam, punt: deurBuiten };
  }

  return {
    update, toets, binnen, meldAan, kaart, bijTafel, bijDeur, naarBinnenGaan, naarBuitenGaan,
    zetUsb, zetSchuif, zetOnAir, djAanTafel,
    zetSlot(t) { slot = t || null; },
    zetTafelHint(t) { tafelHint = t || null; },
    // het verhaal laat de dj opstaan en lopen; zolang hij niet zit, werkt hij hem zelf bij
    djStaat() { djZit = false; },
    get dj() { return dj; },
    get djZit() { return djZit; },
    get onAir() { return onAirAan; },
    get usb() { return usb.visible; },
    get schuif() { return schuifStand; },
    get groep() { return groep; },
    get buiten() { return buiten; },
    get panelen() { return panelen; },
    get plekken() {
      return {
        nul: NUL, deurBuiten, stoep, deurBinnen: binnenDeur, koffieDeur, tafel, stoel, zuil,
        mast: { x: mastVoet.x, z: mastVoet.z, voet: dak, top: mastTop + 3.25 },
        f: F, r: R,
      };
    },
    get maten() { return { ...STUDIO, pandBreed: PAND_B, dak, schermen: 5, panelen: panelen.length, microfoons: 2 }; },
    winkels: [],
  };
}
