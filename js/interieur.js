/*
 Achter de voordeur van Molenkrite 15.

 De woning staat niet in het pand zelf — daar zit de 3D BAG-huls, en die is aan
 de binnenkant hol en zonder vloeren. In plaats daarvan staat er ergens buiten
 het kaartgebied een losse, dichte ruimte. Loop je buiten naar de voordeur en
 druk je op E, dan word je daarheen gezet; ga je binnen weer door de voordeur,
 dan sta je weer op het tegelpad voor het huis. Je merkt er niets van: de kamer
 heeft de maten van het echte huis en de kaart blijft de Molenkrite tonen.

 Alle maten komen uit js/kaart.js (BGT en 3D BAG):

   - het grondvlak `voet` van het pand met huisnummer 15 aan de Molenkrite geeft
     de plattegrond: een voorhuis van 5,42 bij 9,48 m met een aanbouw van 2,44
     bij 4,59 m aan de achterkant;
   - de goothoogte (3,38 m) laat één woonlaag toe; binnen is dat 2,60 m plafond
     op een vloerpakket van een kleine 30 cm en daarboven de kap;
   - de plek van de voordeur in de gevel komt uit dezelfde maatvoering als de
     geveltexture (js/textures.js): 50 cm uit de zijkant, 95 cm breed.

 De indeling is die van een gewone Sneker rijtjeswoning, met de foto's van de
 verbouwing als leidraad: een gang met zwart-wit blokjes langs de zijmuur, een
 L-vormige woonkamer met bruin laminaat, en in de aanbouw een keukenblok in één
 rij met een lichte houten front en witte wandtegels. Alleen de begane grond is
 ingericht.

 Het licht zit in de vlakken, niet in lampen. Een paar puntlichten in de scene
 laat three.js alle duizend materialen van de wijk opnieuw compileren en kost
 buiten ook rekenkracht; hier krijgt elk vlak zijn helderheid in de hoekpunten
 mee, uit de richting waar hij naar kijkt (zie `schaduw`). Daardoor ziet de
 kamer er altijd hetzelfde uit — ook 's nachts, als de zon buiten uit is.
*/
import * as THREE from 'three';
import { KAART } from './kaartwereld.js';
import { HOUSE_STYLES, facade, roofTiles, brick } from './textures.js';
import { addCollider, resolveCollisions } from './world.js';
import { maakKat } from './kat.js';

/*
 De woningen waar je naar binnen kunt. Ze hebben allebei dezelfde opzet — een
 voorhuis met een aanbouw erachter — dus dezelfde bouwer maakt ze allebei; de
 maten komen per adres uit de kaart. `plek` houdt de losse kamers ruim uit
 elkaars buurt, ver buiten het kaartgebied.
*/
export const WONINGEN = [
  { straat: 'Molenkrite', nr: '15', plek: 0, katten: 1 },
  { straat: 'de Wieken', nr: '29', plek: 1, katten: 2 },
  /*
   En de drie woningen waar De Veteraan over gaat (missie 9). Ze zijn alle drie
   fors groter dan de Wieken 29 — dat is 62 m² grondvlak — en ze liggen uit
   elkaar, zodat je met Mark echt een rondje door de wijk maakt. De prijs is het
   sleutelgeld dat je eenmalig betaalt; daarna is het jouw stek.
  */
  { straat: 'Zeskanter', nr: '16', plek: 2, katten: 2, stek: true, prijs: 5000,
    soort: 'luxe', beschrijving: 'vrijstaand aan de noordkant, negen bij twintig meter' },
  { straat: 'Molenkrite', nr: '130c', plek: 3, katten: 2, stek: true, prijs: 2500,
    soort: 'middel', beschrijving: 'een brede bungalow van achttien meter' },
  { straat: 'Koningsspil', nr: '20', plek: 4, katten: 2, stek: true, prijs: 1000,
    soort: 'gewoon', beschrijving: 'diep en rustig, twee keer de Wieken' },
];
const HUIS = WONINGEN[0];

// ---------- maten (m) ----------
const HOOGTE = 2.60;      // plafondhoogte begane grond
const MUUR = 0.24;        // buitenmuur
const WAND = 0.10;        // binnenwand
const PLINT = 0.09;       // plinthoogte
const HAL_BREED = 1.30;   // vrije breedte van de gang
const HAL_DIEP = 4.30;    // gang tot aan de trapdeur
const BINNENDEUR = 0.83;  // standaard binnendeur
const BINNENDEUR_H = 2.31;
const DEUR_H = 2.15;      // voordeur, net als in de geveltexture
const RAAM_ONDER = 0.85;  // vensterbank woonkamer
const RAAM_BOVEN = 2.20;
const AANRECHT = 0.90;    // werkbladhoogte
const KAST_DIEP = 0.60;   // onderkasten
const BOVENKAST_DIEP = 0.35;
const BOVENKAST_ONDER = 1.45;
const BOVENKAST_BOVEN = 2.15;

const DEUR_BEREIK = 2.6;  // zo dicht bij de deur werkt E
const UIT_VOOR = 2.2;     // zover voor de gevel kom je weer buiten

// ---------- kleine texturehulpjes ----------
// Eigen canvasjes, want de textures uit js/textures.js zitten in een cache die
// door de hele wijk gedeeld wordt; daar mag de repeat niet aan gesleuteld worden.
function doek(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function texture(c, rx, ry) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function rnd(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// Bruin laminaat: 256 px staat voor 1,2 m, dus planken van 19 cm breed met een
// naad ertussen en per plank een eigen tint en wat nerf.
function laminaat() {
  const c = doek(256, 256), g = c.getContext('2d');
  const r = rnd(9);
  g.fillStyle = '#8a6440'; g.fillRect(0, 0, 256, 256);
  const H = 41;                                   // 19 cm op 1,2 m
  for (let y = 0, i = 0; y < 256; y += H, i++) {
    const t = 0.86 + r() * 0.3;
    g.fillStyle = `rgba(${Math.round(150 * t)},${Math.round(104 * t)},${Math.round(64 * t)},1)`;
    g.fillRect(0, y, 256, H - 1);
    for (let k = 0; k < 26; k++) {                // nerf
      const ny = y + 2 + r() * (H - 5);
      g.fillStyle = `rgba(${r() < 0.5 ? '60,36,18' : '190,150,110'},${0.05 + r() * 0.12})`;
      g.fillRect(r() * 256, ny, 30 + r() * 120, 1);
    }
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, y + H - 1, 256, 1);      // naad
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(0, y, 256, 1);
    const kop = Math.round((i * 97) % 256);       // kopse naad, per rij verschoven
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(kop, y, 1, H - 1);
  }
  return c;
}

// Zwart-witte blokjes in de gang: 256 px = 1,2 m, dus tegels van 15 cm.
function blokjes() {
  const c = doek(256, 256), g = c.getContext('2d');
  const s = 32;
  for (let y = 0; y < 256; y += s) for (let x = 0; x < 256; x += s) {
    const wit = ((x / s) + (y / s)) % 2 === 0;
    g.fillStyle = wit ? '#e8e6e0' : '#26241f';
    g.fillRect(x, y, s, s);
    g.fillStyle = 'rgba(140,140,132,0.55)'; g.fillRect(x, y, s, 1); g.fillRect(x, y, 1, s);
  }
  return c;
}

// Witte wandtegels achter het aanrecht: 256 px = 1,2 m, tegels van 15 cm.
function wandtegels() {
  const c = doek(256, 256), g = c.getContext('2d');
  const r = rnd(5), s = 32;
  g.fillStyle = '#bdb9b0'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += s) for (let x = 0; x < 256; x += s) {
    const f = 0.96 + r() * 0.08;
    g.fillStyle = `rgba(${Math.round(246 * f)},${Math.round(245 * f)},${Math.round(240 * f)},1)`;
    g.fillRect(x + 1, y + 1, s - 2, s - 2);
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x + 1, y + 1, s - 2, 2);
    g.fillStyle = 'rgba(0,0,0,0.07)'; g.fillRect(x + 1, y + s - 3, s - 2, 2);
  }
  return c;
}

// Licht eiken voor de keukenfronten: staande nerf.
function lichthout() {
  const c = doek(128, 128), g = c.getContext('2d');
  const r = rnd(17);
  g.fillStyle = '#c9a878'; g.fillRect(0, 0, 128, 128);
  for (let k = 0; k < 90; k++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '150,116,74' : '224,201,166'},${0.10 + r() * 0.18})`;
    g.fillRect(r() * 128, 0, 1 + r() * 2, 128);
  }
  return c;
}

/*
 Het beeld op de tv. Geen plaatje in de repo (dat is de afspraak: alles wordt
 getekend), maar een doek met een programma erop zoals je het door een
 woonkamerraam ziet: een lucht met een horizon, een paar vlakken die voor
 gebouwen doorgaan, en onderin de balk van de omroep. Het schuift in de lus
 langzaam door, en dan is het van drie meter afstand precies genoeg beweging om
 te zien dat hij aanstaat.
*/
function tvDoek() {
  const c = doek(128, 96), g = c.getContext('2d');
  const r = rnd(41);
  const lucht = g.createLinearGradient(0, 0, 0, 58);
  lucht.addColorStop(0, '#2c5f96'); lucht.addColorStop(1, '#9fc4e0');
  g.fillStyle = lucht; g.fillRect(0, 0, 128, 58);
  g.fillStyle = '#3d6b3a'; g.fillRect(0, 54, 128, 42);
  for (let k = 0; k < 9; k++) {
    const x = r() * 128, w = 8 + r() * 16, h = 10 + r() * 22;
    g.fillStyle = `rgba(${40 + r() * 60 | 0},${40 + r() * 40 | 0},${50 + r() * 50 | 0},0.9)`;
    g.fillRect(x, 58 - h, w, h);
  }
  g.fillStyle = 'rgba(12,16,24,0.82)'; g.fillRect(0, 78, 128, 18);
  g.fillStyle = '#f2c14a'; g.fillRect(4, 82, 3, 10);
  g.fillStyle = '#e8e6e0'; g.font = 'bold 9px sans-serif';
  g.fillText('SPANNENBURG', 11, 90);
  return c;
}

/*
 Het schilderij boven de bank: een Fries landschap zoals er in half Sneek een
 aan de muur hangt. Lucht, een streep water, een dijkje en een molen in
 silhouet. Getekend en niet gefotografeerd — er komen geen plaatjes in de repo.
*/
function schilderijDoek() {
  const c = doek(128, 96), g = c.getContext('2d');
  const lucht = g.createLinearGradient(0, 0, 0, 62);
  lucht.addColorStop(0, '#c9d8e6'); lucht.addColorStop(1, '#f0e4cd');
  g.fillStyle = lucht; g.fillRect(0, 0, 128, 62);
  const r = rnd(53);
  for (let k = 0; k < 7; k++) {                       // wolkenvegen
    g.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.2})`;
    g.beginPath();
    g.ellipse(r() * 128, 10 + r() * 34, 14 + r() * 20, 4 + r() * 5, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#7d9a63'; g.fillRect(0, 58, 128, 12);   // dijkje
  g.fillStyle = '#5c7a4e'; g.fillRect(0, 68, 128, 28);   // weiland
  g.fillStyle = '#8fa9bd'; g.fillRect(0, 62, 128, 7);    // water
  // de molen: romp, kap en wieken
  g.fillStyle = '#3a3128';
  g.beginPath(); g.moveTo(88, 58); g.lineTo(94, 30); g.lineTo(101, 30); g.lineTo(107, 58);
  g.closePath(); g.fill();
  g.beginPath(); g.moveTo(92, 30); g.lineTo(97.5, 22); g.lineTo(103, 30); g.closePath(); g.fill();
  g.strokeStyle = '#3a3128'; g.lineWidth = 1.6;
  for (const h of [0.5, 2.07]) {
    g.beginPath();
    g.moveTo(97.5 - Math.cos(h) * 13, 27 - Math.sin(h) * 13);
    g.lineTo(97.5 + Math.cos(h) * 13, 27 + Math.sin(h) * 13);
    g.stroke();
  }
  return c;
}

/*
 De fotolijstjes op het dressoir. Drie kiekjes van een halve centimeter op het
 doek: een kop met schouders tegen een vlakke achtergrond. Meer hoeft niet —
 van een meter afstand zie je dat het foto's van mensen zijn, en dat is precies
 wat een dressoir nodig heeft.
*/
function fotoDoek() {
  const c = doek(96, 32), g = c.getContext('2d');
  const r = rnd(29);
  const achter = ['#c9d3dc', '#d8cfc0', '#cbd8c8'];
  for (let i = 0; i < 3; i++) {
    const x = i * 32;
    g.fillStyle = achter[i]; g.fillRect(x, 0, 32, 32);
    g.fillStyle = `hsl(${20 + r() * 20}, 40%, ${58 + r() * 12}%)`;   // gezicht
    g.beginPath(); g.arc(x + 16, 13, 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = `hsl(${r() * 360}, 35%, ${30 + r() * 25}%)`;       // schouders
    g.beginPath(); g.ellipse(x + 16, 33, 11, 11, 0, Math.PI, 0); g.fill();
    g.fillStyle = 'rgba(40,34,28,0.75)';                             // haar
    g.beginPath(); g.arc(x + 16, 11, 6.2, Math.PI, 0); g.fill();
  }
  return c;
}

/*
 Het behang. De wanden waren één egaal vlak van gebroken wit en dat leest als
 een wachtkamer (melding 23 sep 2026). Dit doek is bijna wit met een fijne
 korrel erin; de kleur komt van het materiaal, zodat dezelfde textuur met een
 andere tint een andere kamer geeft.
*/
function behangDoek() {
  const c = doek(96, 96), g = c.getContext('2d');
  const r = rnd(97);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 96, 96);
  for (let k = 0; k < 2600; k++) {
    const v = 232 + r() * 22;
    g.fillStyle = `rgba(${v | 0},${v | 0},${(v - 4) | 0},${0.25 + r() * 0.3})`;
    g.fillRect(r() * 96, r() * 96, 1, 1);
  }
  // een heel flauwe verticale baan, zoals de rol op de muur zit
  for (let x = 0; x < 96; x += 24) {
    g.fillStyle = 'rgba(214,208,196,0.20)';
    g.fillRect(x, 0, 1, 96);
  }
  return c;
}

// De ruggen in de boekenkast: banden van verschillende breedte en kleur.
function boekenDoek() {
  const c = doek(128, 64), g = c.getContext('2d');
  const r = rnd(113);
  g.fillStyle = '#2b2118'; g.fillRect(0, 0, 128, 64);
  let x = 1;
  while (x < 127) {
    const b = 3 + r() * 7, h = 40 + r() * 20;
    g.fillStyle = `hsl(${r() * 360}, ${25 + r() * 35}%, ${25 + r() * 30}%)`;
    g.fillRect(x, 64 - h, b, h);
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(x, 64 - h + 4 + r() * 8, b, 1.5);
    x += b + 0.6;
  }
  return c;
}

// Het vloerkleed voor de bank: wollig, met een rand eromheen.
function kleedDoek() {
  const c = doek(64, 64), g = c.getContext('2d');
  const r = rnd(71);
  g.fillStyle = '#8a6f56'; g.fillRect(0, 0, 64, 64);
  for (let k = 0; k < 500; k++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '112,90,70' : '160,134,104'},${0.25 + r() * 0.35})`;
    g.fillRect(r() * 64, r() * 64, 1.5, 1.5);
  }
  g.strokeStyle = '#6d563f'; g.lineWidth = 3; g.strokeRect(2, 2, 60, 60);
  return c;
}

// Bankstof: fijne grijze weving.
function stof() {
  const c = doek(64, 64), g = c.getContext('2d');
  const r = rnd(31);
  g.fillStyle = '#6f6f74'; g.fillRect(0, 0, 64, 64);
  for (let k = 0; k < 900; k++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '40,40,46' : '150,150,158'},${0.10 + r() * 0.2})`;
    g.fillRect(r() * 64, r() * 64, 1, 1);
  }
  return c;
}

// ---------- de plattegrond uit de kaartdata ----------
/*
 Het grondvlak van het pand omgerekend naar de maten van de kamer:
   x = langs de voorgevel, 0 aan de linkerkant zoals je er van buiten naar kijkt
   z = de diepte naar achteren, 0 aan de buitenkant van de voorgevel
 De hoekpunten liggen in de BGT op een paar centimeter, dus ze worden per as op
 elkaar geklikt; dan is de plattegrond haaks en zijn de wanden rechte dozen.
*/
export function plattegrond(p) {
  const L = Math.hypot(p.front[0], p.front[1]) || 1;
  const f = [p.front[0] / L, p.front[1] / L];
  const r = [f[1], -f[0]];                       // naar rechts, gezien van buiten
  const u = [Math.cos(p.rect.hoek), Math.sin(p.rect.hoek)];
  const diep = Math.abs(f[0] * u[0] + f[1] * u[1]) > 0.7 ? p.rect.hx : p.rect.hz;
  const gevel = { x: p.rect.cx + f[0] * diep, z: p.rect.cz + f[1] * diep };
  let punten = p.voet.map(([X, Z]) => {
    const dx = X - gevel.x, dz = Z - gevel.z;
    return [dx * r[0] + dz * r[1], -(dx * f[0] + dz * f[1])];
  });
  // per as clusteren wat binnen 12 cm bij elkaar ligt
  for (const as of [0, 1]) {
    const waarden = [...new Set(punten.map(q => q[as]))].sort((a, b) => a - b);
    const groepen = [];
    for (const v of waarden) {
      const g = groepen[groepen.length - 1];
      if (g && v - g[0] < 0.12) g.push(v); else groepen.push([v]);
    }
    const naar = new Map();
    for (const g of groepen) {
      const m = g.reduce((s, v) => s + v, 0) / g.length;
      for (const v of g) naar.set(v, Math.round(m * 100) / 100);
    }
    for (const q of punten) q[as] = naar.get(q[as]);
  }
  const x0 = Math.min(...punten.map(q => q[0]));
  const z0 = Math.min(...punten.map(q => q[1]));
  punten = punten.map(q => [Math.round((q[0] - x0) * 100) / 100, Math.round((q[1] - z0) * 100) / 100]);
  // een punt uit de kamer terug naar de wereld: dat is waar de deur staat
  const naarWereld = (x, z) => ({
    x: gevel.x + r[0] * (x0 + x) - f[0] * (z0 + z),
    z: gevel.z + r[1] * (x0 + x) - f[1] * (z0 + z),
  });
  // en andersom: een punt uit de wereld naar de kamermaten. Daarmee wordt het
  // uitzicht door de ramen opgebouwd (zie `bouwBuiten`).
  const naarKamer = (X, Z) => {
    const dx = X - gevel.x, dz = Z - gevel.z;
    return { x: dx * r[0] + dz * r[1] - x0, z: -(dx * f[0] + dz * f[1]) - z0 };
  };
  // een richting uit de wereld naar de kamer (zonder verschuiving)
  const richting = (vx, vz) => ({ x: vx * r[0] + vz * r[1], z: -(vx * f[0] + vz * f[1]) });
  return { punten, gevel, f, r, naarWereld, naarKamer, richting };
}

/*
 De plattegrond in banden van voor naar achter: per diepte-interval de strook
 die binnen het pand ligt. Bij Molenkrite 15 zijn dat twee banden — het brede
 voorhuis en de smallere aanbouw — en dat is precies wat de kamer nodig heeft.
*/
export function banden(punten) {
  const zs = [...new Set(punten.map(q => q[1]))].sort((a, b) => a - b);
  const uit = [];
  for (let i = 0; i < zs.length - 1; i++) {
    const z0 = zs[i], z1 = zs[i + 1];
    if (z1 - z0 < 0.3) continue;
    const zm = (z0 + z1) / 2;
    const kruis = [];
    for (let a = 0; a < punten.length; a++) {
      const q = punten[a], s = punten[(a + 1) % punten.length];
      if ((q[1] > zm) === (s[1] > zm)) continue;
      kruis.push(q[0] + (s[0] - q[0]) * (zm - q[1]) / (s[1] - q[1]));
    }
    kruis.sort((a, b) => a - b);
    for (let k = 0; k + 1 < kruis.length; k += 2) uit.push({ z0, z1, x0: kruis[k], x1: kruis[k + 1] });
  }
  return uit;
}

/*
 ctx = { scene, player, sfeer, huis }
 `huis` is een regel uit WONINGEN hierboven. Levert null als er geen kaartdata
 is of het huisnummer er niet in staat; dan doet de voordeur gewoon niets.
*/
export function initInterieur({ scene, player, sfeer = null, hud = null, huis = HUIS }) {
  if (!KAART || !KAART.panden) return null;
  const HUIS = huis;
  const pand = KAART.panden.find(p => p.straat === HUIS.straat && (p.nr || []).includes(HUIS.nr));
  if (!pand || !pand.voet || !pand.rect || !pand.front) return null;

  const plan = plattegrond(pand);
  const vakken = banden(plan.punten);
  if (!vakken.length) return null;
  const voorhuis = vakken[0];
  const aanbouw = vakken.length > 1 ? vakken[vakken.length - 1] : null;
  const BREED = voorhuis.x1 - voorhuis.x0;
  const DIEP = vakken[vakken.length - 1].z1;

  // de voordeur op dezelfde plek als in de geveltexture (js/textures.js): 50 cm
  // uit de zijkant, 95 cm breed, uitgerekt naar de echte gevelbreedte
  const st = HOUSE_STYLES[pand.type] || { w: BREED };
  const rek = BREED / (st.w || BREED);
  const DEUR_B = 0.95 * rek;
  const DEUR_X = (0.5 + 0.95 / 2) * rek;

  // de plek van de deur in de wereld, en waar je buiten weer neerkomt
  const deurBuiten = plan.naarWereld(DEUR_X, 0);
  const stoep = {
    x: deurBuiten.x + plan.f[0] * UIT_VOOR, z: deurBuiten.z + plan.f[1] * UIT_VOOR,
  };

  // De kamer staat ruim buiten het kaartgebied, dus je komt er nooit langs en
  // hij staat ook niet op het bovenaanzicht (tools/geo/bovenaanzicht.mjs).
  const NUL = { x: (KAART.gebied ? KAART.gebied.x1 : 400) + 520, z: (KAART.gebied ? KAART.gebied.z1 : 460) + 520 + (HUIS.plek || 0) * 140 };

  const groep = new THREE.Group();
  groep.position.set(NUL.x, 0, NUL.z);
  scene.add(groep);

  // ---------- licht in de vlakken ----------
  /*
   In plaats van lampen krijgt elk vlak een helderheid mee in zijn hoekpunten,
   uit de richting waar hij naar toe kijkt: fel licht door de pui aan de
   voorkant (S1) en zachter licht door de tuindeur en het keukenraam
   achterlangs (S2), met een beetje daglicht van boven. Daardoor lopen de
   hoeken van de kamer zichtbaar uit elkaar — de gevelwand staat in tegenlicht,
   de achterwand licht op — zonder dat er ook maar één lamp in de scene komt.
  */
  const S1 = new THREE.Vector3(0.25, 0.5, -1).normalize();
  const S2 = new THREE.Vector3(-0.7, 0.45, 0.55).normalize();
  const nrm = new THREE.Vector3();
  function schaduw(geo) {
    const n = geo.getAttribute('normal');
    const kleur = new Float32Array(n.count * 3);
    for (let i = 0; i < n.count; i++) {
      nrm.set(n.getX(i), n.getY(i), n.getZ(i));
      const f = Math.min(1, 0.30 + 0.42 * Math.max(0, nrm.dot(S1)) + 0.24 * Math.max(0, nrm.dot(S2))
        + 0.17 * Math.max(0, nrm.y) + 0.13 * Math.max(0, -nrm.y));
      kleur[i * 3] = kleur[i * 3 + 1] = kleur[i * 3 + 2] = f;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(kleur, 3));
    return geo;
  }

  // ---------- materialen ----------
  const vlak = (c, rx, ry) => new THREE.MeshBasicMaterial({
    map: texture(c, rx, ry), vertexColors: true, fog: false,
  });
  const plat = (kleur) => new THREE.MeshBasicMaterial({ color: kleur, vertexColors: true, fog: false });
  /*
   De kleur op de muur. Vijf schema's, één per woning: een warme wandkleur en
   een accentkleur voor de wand achter de bank. Het gebroken wit van hiervoor
   stond overal en gaf elke kamer hetzelfde ziekenhuisgevoel.
  */
  const KLEUREN = [
    { muur: 0xe9e2d3, accent: 0x6f8068 },   // zand met salie
    { muur: 0xe7e3da, accent: 0x8c5a48 },   // gebroken wit met terracotta
    { muur: 0xeae2d2, accent: 0x4f6274 },   // zand met staalblauw
    { muur: 0xe6e5de, accent: 0x7a6a86 },   // koel wit met oud paars
    { muur: 0xece4d4, accent: 0x5d7a74 },   // zand met diepgroen
  ];
  const KLEUR = KLEUREN[(HUIS.plek || 0) % KLEUREN.length];
  const MAT = {
    muur: new THREE.MeshBasicMaterial({
      map: texture(behangDoek(), 2.5, 2.5), color: KLEUR.muur, vertexColors: true, fog: false,
    }),
    accent: plat(KLEUR.accent),
    boeken: vlak(boekenDoek(), 1, 1),
    plafond: plat(0xfdfcfa),
    plint: plat(0xf8f7f3),
    kozijn: plat(0xfafaf7),
    /*
     Het glas is doorzichtig: door de pui en de tuindeur kijk je naar buiten.
     Wat je daar ziet staat in `bouwBuiten()` hieronder — de kamer ligt ver
     buiten het kaartgebied, dus de buren zijn daar in vereenvoudigde vorm
     opnieuw neergezet, op hun echte plek en hoogte uit de kaart. Een vleugje
     wit erover is de weerspiegeling die elk raam heeft.
    */
    ruit: new THREE.MeshBasicMaterial({ color: 0xdfeaf4, fog: false, transparent: true, opacity: 0.18 }),
    voordeur: plat(0x24422f),
    binnendeur: plat(0xf4f3ee),
    klink: plat(0xa8aeb4),
    hout: vlak(lichthout(), 4, 2),
    werkblad: plat(0x42464c),
    rvs: plat(0xc2c6cb),
    kookplaat: plat(0x22252a),
    stof: vlak(stof(), 3, 3),
    stofRug: vlak(stof(), 3, 3),
    poot: plat(0x53422f),
    tvKast: plat(0x33333a),
    tvRand: plat(0x1a1a1e),
    /*
     Een donker scherm, behalve in de drie woningen van missie 9: daar staat de
     tv aan op Radio Spannenburg en is het beeld een eigen doek dat langzaam
     doorschuift. Zonder `vertexColors` blijft hij overal even fel — een scherm
     dat aanstaat hoort niet mee te doen met het licht in de kamer.
    */
    tvBeeld: HUIS.stek
      ? new THREE.MeshBasicMaterial({ map: texture(tvDoek(), 1, 1), fog: false })
      : new THREE.MeshBasicMaterial({ color: 0x121a24, fog: false }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xfff4d8, side: THREE.DoubleSide, fog: false }),
    snoer: plat(0x33332f),
    // de inrichting (verzoek 23 sep 2026): planten, een dressoir met foto's en
    // een schemerlamp, een schilderij, een salontafel met een kleed eronder en
    // wat spullen op het aanrecht
    pot: plat(0xb0664a),
    aarde: plat(0x3b2f26),
    blad: plat(0x3f7a3a),
    bladLicht: plat(0x58a04c),
    stam: plat(0x6b5334),
    donkerhout: plat(0x6b4a30),
    lijst: plat(0x4a3826),
    doekje: new THREE.MeshBasicMaterial({ map: texture(schilderijDoek(), 1, 1), vertexColors: true, fog: false }),
    fotos: new THREE.MeshBasicMaterial({ map: texture(fotoDoek(), 1, 1), vertexColors: true, fog: false }),
    kleed: new THREE.MeshBasicMaterial({ map: texture(kleedDoek(), 1, 1), vertexColors: true, fog: false }),
    glas: new THREE.MeshBasicMaterial({ color: 0xcfdde6, fog: false, transparent: true, opacity: 0.55 }),
    kap: plat(0xe8dcc2),
    fruit: plat(0xc8532e),
    keramiek: plat(0xe9e6df),
  };
  // vloeren krijgen hun eigen texture, want de repeat hangt aan de maat
  const vloerMat = (soort, w, d) => {
    const c = soort === 'blokjes' ? blokjes() : laminaat();
    return new THREE.MeshBasicMaterial({ map: texture(c, w / 1.2, d / 1.2), vertexColors: true, fog: false });
  };

  const dozen = [];        // {x,z,hx,hz,h} – wordt in meldAan() bij de wereld aangemeld

  // ---------- bouwstenen ----------
  // Een doos in kamercoördinaten: x/z van..tot, y van..tot.
  function doos(x0, x1, z0, z1, y0, y1, mat, botst = true) {
    const w = x1 - x0, d = z1 - z0, h = y1 - y0;
    if (w <= 0 || d <= 0 || h <= 0) return null;
    const m = new THREE.Mesh(schaduw(new THREE.BoxGeometry(w, h, d)), mat);
    m.position.set(x0 + w / 2, y0 + h / 2, z0 + d / 2);
    groep.add(m);
    if (botst) dozen.push({ x: m.position.x, z: m.position.z, hx: w / 2, hz: d / 2, h: y1 });
    return m;
  }
  // Een vloer- of plafondvlak. De draai zit in de geometrie, want het licht in
  // de hoekpunten volgt de normaal van de geometrie.
  function vloer(x0, x1, z0, z1, y, mat, omhoog = true) {
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    geo.rotateX(omhoog ? -Math.PI / 2 : Math.PI / 2);
    const m = new THREE.Mesh(schaduw(geo), mat);
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    groep.add(m);
    return m;
  }
  /*
   Een wandvlak met gaten erin (een deur, een raam). `as` is 'x' voor een wand
   op een vaste x en 'z' voor een wand op een vaste z; `van`/`tot` is de lengte
   langs de wand. De gaten knippen hem in stukken; alleen een stuk dat op de
   vloer staat botst, zodat je door een deurgat kunt lopen maar niet door de
   muur onder een raam.
  */
  function wand({ as, bij, dik, van, tot, y0 = 0, y1 = HOOGTE, mat, gaten = [] }) {
    const stuk = (a, b, ya, yb) => {
      if (b - a < 0.005 || yb - ya < 0.005) return;
      if (as === 'x') doos(bij, bij + dik, a, b, ya, yb, mat, ya < 0.02);
      else doos(a, b, bij, bij + dik, ya, yb, mat, ya < 0.02);
    };
    const g = gaten.slice().sort((a, b) => a.van - b.van);
    let p = van;
    for (const h of g) {
      const hv = Math.max(van, h.van), ht = Math.min(tot, h.tot);
      if (ht <= hv) continue;
      if (hv > p) stuk(p, hv, y0, y1);
      if (h.y0 > y0) stuk(hv, ht, y0, h.y0);
      if (h.y1 < y1) stuk(hv, ht, h.y1, y1);
      p = ht;
    }
    if (p < tot) stuk(p, tot, y0, y1);
  }
  // Een ruit met kozijn in een gat; de ruit is dicht en licht, want achter de
  // kamer is niets te zien.
  function raam(as, bij, dik, van, tot, y0, y1) {
    const k = 0.06;
    const mid = bij + dik / 2;
    if (as === 'x') {
      doos(mid - 0.012, mid + 0.012, van + k, tot - k, y0 + k, y1 - k, MAT.ruit, false);
      doos(bij, bij + dik, van, tot, y0, y0 + k, MAT.kozijn, false);
      doos(bij, bij + dik, van, tot, y1 - k, y1, MAT.kozijn, false);
      doos(bij, bij + dik, van, van + k, y0, y1, MAT.kozijn, false);
      doos(bij, bij + dik, tot - k, tot, y0, y1, MAT.kozijn, false);
    } else {
      doos(van + k, tot - k, mid - 0.012, mid + 0.012, y0 + k, y1 - k, MAT.ruit, false);
      doos(van, tot, bij, bij + dik, y0, y0 + k, MAT.kozijn, false);
      doos(van, tot, bij, bij + dik, y1 - k, y1, MAT.kozijn, false);
      doos(van, van + k, bij, bij + dik, y0, y1, MAT.kozijn, false);
      doos(tot - k, tot, bij, bij + dik, y0, y1, MAT.kozijn, false);
    }
  }

  // ---------- de buitenmuren, uit de plattegrond ----------
  // Elke zijde van het grondvlak wordt een wand die naar binnen toe dik is. De
  // voorgevel krijgt het deurgat en de woonkamerpui, de achterkant van het
  // voorhuis een tuindeur en de aanbouw een keukenraam.
  const opp = plan.punten.reduce((s, q, i) => {
    const n = plan.punten[(i + 1) % plan.punten.length];
    return s + q[0] * n[1] - n[0] * q[1];
  }, 0);
  const naarBinnen = opp > 0 ? 1 : -1;      // linkernormaal of rechternormaal

  const KEUKEN = aanbouw ? { x0: aanbouw.x0 + MUUR, x1: aanbouw.x1 - MUUR, z0: aanbouw.z0, z1: aanbouw.z1 - MUUR }
    : { x0: MUUR, x1: BREED / 2, z0: DIEP - 4.6, z1: DIEP - MUUR };
  const TUINDEUR = { van: (aanbouw ? aanbouw.x1 : BREED / 2) + 0.5, tot: BREED - MUUR - 0.3 };
  const PUI = { van: MUUR + HAL_BREED + 0.4, tot: BREED - MUUR - 0.35 };

  for (let i = 0; i < plan.punten.length; i++) {
    const a = plan.punten[i], b = plan.punten[(i + 1) % plan.punten.length];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const lang = Math.hypot(dx, dz);
    if (lang < 0.2) continue;
    const langsX = Math.abs(dx) > Math.abs(dz);
    // normaal naar binnen; de wand ligt binnen de contour, dus vanaf de zijde
    // een muurdikte naar binnen. Aan de uiteinden loopt hij een muurdikte door,
    // zodat er in de hoeken (ook de inspringende hoek bij de aanbouw) geen
    // kiertje overblijft.
    const nx = -dz / lang * naarBinnen, nz = dx / lang * naarBinnen;
    const gaten = [];
    if (langsX) {
      const z = (a[1] + b[1]) / 2;
      const bij = nz > 0 ? z : z - MUUR;
      const van = Math.min(a[0], b[0]) - MUUR, tot = Math.max(a[0], b[0]) + MUUR;
      if (z < 0.2) {                     // de voorgevel
        gaten.push({ van: DEUR_X - DEUR_B / 2, tot: DEUR_X + DEUR_B / 2, y0: 0, y1: DEUR_H });
        gaten.push({ van: PUI.van, tot: PUI.tot, y0: RAAM_ONDER, y1: RAAM_BOVEN });
      } else if (z > DIEP - 0.2) {       // de achterkant van de aanbouw
        gaten.push({ van: van + 0.79, tot: Math.min(tot - 0.69, van + 2.19), y0: 0.95, y1: 2.15 });
      } else if (TUINDEUR.tot > TUINDEUR.van + 0.8) {   // de tuinkant van het voorhuis
        gaten.push({ van: TUINDEUR.van, tot: TUINDEUR.tot, y0: 0.05, y1: 2.30 });
      }
      wand({ as: 'z', bij, dik: MUUR, van, tot, mat: MAT.muur, gaten });
      for (const h of gaten) {
        if (h.y0 > 0.02) raam('z', bij, MUUR, h.van, h.tot, h.y0, h.y1);
        // een gat in een buitenmuur is dicht: glas of een deur die niet opengaat
        dozen.push({ x: (h.van + h.tot) / 2, z: bij + MUUR / 2, hx: (h.tot - h.van) / 2, hz: MUUR / 2, h: h.y1 });
      }
      // de voordeur zelf, aan de binnenkant tegen het kozijn
      if (z < 0.2) {
        const d = new THREE.Mesh(schaduw(new THREE.BoxGeometry(DEUR_B - 0.03, DEUR_H - 0.03, 0.045)), MAT.voordeur);
        d.position.set(DEUR_X, (DEUR_H - 0.03) / 2, bij + MUUR - 0.03);
        groep.add(d);
        const k = new THREE.Mesh(schaduw(new THREE.BoxGeometry(0.02, 0.02, 0.14)), MAT.klink);
        k.position.set(DEUR_X + DEUR_B / 2 - 0.14, 1.04, bij + MUUR + 0.03);
        groep.add(k);
      }
    } else {
      const x = (a[0] + b[0]) / 2;
      const bij = nx > 0 ? x : x - MUUR;
      const van = Math.min(a[1], b[1]) - MUUR, tot = Math.max(a[1], b[1]) + MUUR;
      wand({ as: 'x', bij, dik: MUUR, van, tot, mat: MAT.muur });
    }
  }

  // ---------- vloer en plafond ----------
  const HAL = { x0: MUUR, x1: MUUR + HAL_BREED + WAND, z0: MUUR, z1: HAL_DIEP + WAND };
  for (const v of vakken) {
    const x0 = v.x0, x1 = v.x1, z0 = v.z0, z1 = v.z1;
    vloer(x0, x1, z0, z1, HOOGTE, MAT.plafond, false);
  }
  // de woonvloer in stukken, want de gang heeft blokjes en de rest laminaat
  const vloerdelen = [
    { x0: HAL.x0, x1: HAL.x1, z0: HAL.z0, z1: HAL.z1, soort: 'blokjes' },
    { x0: HAL.x1, x1: BREED - MUUR, z0: MUUR, z1: voorhuis.z1, soort: 'laminaat' },
    { x0: MUUR, x1: HAL.x1, z0: HAL.z1, z1: voorhuis.z1, soort: 'laminaat' },
  ];
  if (aanbouw) vloerdelen.push({ x0: KEUKEN.x0, x1: KEUKEN.x1, z0: aanbouw.z0, z1: KEUKEN.z1, soort: 'laminaat' });
  for (const d of vloerdelen) {
    if (d.x1 - d.x0 < 0.1 || d.z1 - d.z0 < 0.1) continue;
    vloer(d.x0, d.x1, d.z0, d.z1, 0.005, vloerMat(d.soort, d.x1 - d.x0, d.z1 - d.z0));
  }

  // ---------- de gang ----------
  // Een wand langs de gang met aan het eind een deurgat naar de woonkamer, en
  // achterin de dichte deur naar de trap. Boven de begane grond is niets
  // ingericht, dus die deur blijft dicht.
  wand({ as: 'x', bij: HAL.x1 - WAND, dik: WAND, van: MUUR, tot: HAL_DIEP - BINNENDEUR, mat: MAT.muur });
  doos(HAL.x1 - WAND, HAL.x1, HAL_DIEP - BINNENDEUR, HAL.z1, BINNENDEUR_H, HOOGTE, MAT.muur, false);
  wand({
    as: 'z', bij: HAL_DIEP, dik: WAND, van: MUUR, tot: HAL.x1, mat: MAT.muur,
    gaten: [{ van: MUUR + 0.2, tot: MUUR + 0.2 + BINNENDEUR, y0: 0, y1: BINNENDEUR_H }],
  });
  {
    doos(MUUR + 0.22, MUUR + 0.2 + BINNENDEUR, HAL_DIEP - 0.045, HAL_DIEP - 0.005, 0.01, BINNENDEUR_H - 0.02, MAT.binnendeur, false);
    const k = new THREE.Mesh(schaduw(new THREE.BoxGeometry(0.02, 0.02, 0.13)), MAT.klink);
    k.position.set(MUUR + 0.2 + BINNENDEUR - 0.08, 1.04, HAL_DIEP - 0.09);
    groep.add(k);
    // hij blijft dicht, dus je loopt er niet door
    dozen.push({ x: MUUR + 0.2 + BINNENDEUR / 2, z: HAL_DIEP + WAND / 2, hx: BINNENDEUR / 2, hz: WAND / 2, h: BINNENDEUR_H });
  }

  // ---------- plinten ----------
  // Alleen langs de wanden van de woonkamer en de keuken; de gang heeft tegels.
  const plinten = [
    ['x', MUUR, HAL.z1, voorhuis.z1 - 0.01],                 // linkerwand woonkamer
    ['x', BREED - MUUR - 0.02, MUUR, voorhuis.z1 - 0.01],    // rechterwand
    ['z', MUUR, HAL.x1, BREED - MUUR - 0.01],                // voorgevel binnen
  ];
  for (const [as, bij, van, tot] of plinten) {
    if (tot - van < 0.2) continue;
    if (as === 'x') doos(bij, bij + 0.02, van, tot, 0, PLINT, MAT.plint, false);
    else doos(van, tot, bij, bij + 0.02, 0, PLINT, MAT.plint, false);
  }

  /*
   ---------- de zithoek ----------

   Een hoekbank, de tv op kijkafstand ervoor, een salontafel op een kleed
   ertussen, een schemerlamp aan het uiteinde en een poef erbij. Samen ruim twee
   keer het zitvlak van de drie-zits die hier stond (verzoek 23 sep 2026).

   Waar de groep staat hangt van de vorm van de kamer af. Normaal met de rug
   tegen de rechterwand, maar in een brede ondiepe kamer — de bungalow aan de
   Molenkrite is achttien bij zeven — is die wand te kort voor een bank én een
   kijkafstand, en gaat de hele groep tegen de achterwand. Om dat niet twee keer
   te hoeven uitschrijven staat alles in maten langs de bank (`u`) en vanaf de
   wand (`v`); `dB` rekent dat om naar de kamer.
  */
  // wat er aan inrichting daadwerkelijk gepast heeft; de proef leest dit uit
  const inrichting = { schilderij: false, kleed: false, salontafel: false,
    dressoir: false, fotos: false, lamp: false, plant: false, fauteuil: false,
    hoek: false, boekenkast: false, gordijnen: false, klok: false,
    kattenmand: false, staandelamp: false, accentwand: false, keuken: 0 };

  const BANK_DIEP = 0.98;
  const Z_RUIMTE = (voorhuis.z1 - MUUR - 0.15) - (HAL.z1 + 0.15);   // langs de rechterwand
  const X_RUIMTE = (BREED - MUUR - 0.3) - (HAL.x1 + 0.3);           // langs de achterwand
  const ACHTERWAND = Z_RUIMTE < 2.6 && X_RUIMTE > Z_RUIMTE + 1.5;
  const BANK_RUIMTE = ACHTERWAND ? X_RUIMTE : Z_RUIMTE;
  const BANK_LANG = Math.max(1.4, Math.min(3.20, BANK_RUIMTE - 0.2));
  /*
   Waar de bank langs die wand begint. Tegen de rechterwand in het midden; tegen
   de achterwand juist aan de kant van de gang, want in zo'n brede kamer staat de
   eettafel in het midden en wil je er niet tegenaan kijken.
  */
  const BANK_U0 = ACHTERWAND
    ? HAL.x1 + 0.3 + 0.2
    : (HAL.z1 + 0.15) + (Z_RUIMTE - BANK_LANG) / 2;
  const BANK_U1 = BANK_U0 + BANK_LANG;
  const bankZ = ACHTERWAND ? voorhuis.z1 - MUUR - BANK_DIEP / 2 : (BANK_U0 + BANK_U1) / 2;
  const bankX = ACHTERWAND ? (BANK_U0 + BANK_U1) / 2 : BREED - MUUR - BANK_DIEP / 2;

  // u loopt langs de wand, v vanaf de wand de kamer in
  const pB = (u, v) => (ACHTERWAND
    ? { x: u, z: voorhuis.z1 - MUUR - v }
    : { x: BREED - MUUR - v, z: u });
  const dB = (u0, u1, v0, v1, y0, y1, mat, botst = true) => {
    const a = pB(u0, v0), b = pB(u1, v1);
    return doos(Math.min(a.x, b.x), Math.max(a.x, b.x), Math.min(a.z, b.z), Math.max(a.z, b.z),
      y0, y1, mat, botst);
  };

  // de chaise longue: alleen als er naast de bank genoeg kamer over is
  /*
   Hoeveel kamer er vóór de bank is. Tegen de rechterwand is dat de hele breedte
   van de kamer: de gang houdt op bij `HAL.z1` en de bank staat daar altijd
   achter. Tegen de achterwand is het de diepte tot vlak voor de voorgevel, waar
   de gordijnen hangen.
  */
  const DWARS = ACHTERWAND ? voorhuis.z1 - 2 * MUUR - 0.3 : BREED - 2 * MUUR;
  const HOEK_LANG = (DWARS > 3.4 && BANK_LANG > 2.0) ? Math.min(1.95, DWARS * 0.36) : 0;
  {
    const u0 = BANK_U0, u1 = BANK_U1;
    // de lange poot langs de wand
    dB(u0, u1, 0.04, BANK_DIEP, 0.10, 0.36, MAT.stof);                       // onderbak
    dB(u0 + 0.10, u1, 0.04, BANK_DIEP - 0.10, 0.36, 0.46, MAT.stof, false);  // zitkussens
    dB(u0, u1, 0.04, 0.24, 0.36, 0.85, MAT.stofRug, false);                  // rug tegen de wand
    dB(u0, u0 + 0.16, 0.22, BANK_DIEP, 0.36, 0.62, MAT.stofRug, false);      // armleuning
    for (const uu of [u0 + 0.12, u1 - 0.18]) for (const vv of [0.10, BANK_DIEP - 0.16]) {
      dB(uu, uu + 0.06, vv, vv + 0.06, 0, 0.10, MAT.poot, false);
    }
    if (HOEK_LANG > 0) {
      // de chaise longue haaks erop, aan het eind van de bank
      dB(u1 - BANK_DIEP, u1, BANK_DIEP, BANK_DIEP + HOEK_LANG, 0.10, 0.36, MAT.stof);
      dB(u1 - BANK_DIEP + 0.10, u1 - 0.10, BANK_DIEP, BANK_DIEP + HOEK_LANG - 0.10, 0.36, 0.46, MAT.stof, false);
      dB(u1 - 0.20, u1, BANK_DIEP, BANK_DIEP + HOEK_LANG, 0.36, 0.85, MAT.stofRug, false);
      dB(u1 - BANK_DIEP, u1 - 0.18, BANK_DIEP + HOEK_LANG - 0.16, BANK_DIEP + HOEK_LANG, 0.36, 0.62, MAT.stofRug, false);
      for (const uu of [u1 - BANK_DIEP + 0.06, u1 - 0.18])
        for (const vv of [BANK_DIEP + 0.10, BANK_DIEP + HOEK_LANG - 0.16]) {
          dB(uu, uu + 0.06, vv, vv + 0.06, 0, 0.10, MAT.poot, false);
        }
      // een plaid over de chaise longue
      dB(u1 - 0.80, u1 - 0.26, BANK_DIEP + 0.15, BANK_DIEP + HOEK_LANG - 0.30, 0.46, 0.50, MAT.stofRug, false);
      inrichting.hoek = true;
    } else {
      dB(u1 - 0.16, u1, 0.22, BANK_DIEP, 0.36, 0.62, MAT.stofRug, false);    // tweede armleuning
    }
    // kussens tegen de rug
    for (const uu of [u0 + 0.34, u1 - 0.62]) {
      dB(uu, uu + 0.28, 0.24, 0.42, 0.46, 0.74, MAT.stofRug, false);
    }
    /*
     Het schilderij erboven: een Fries landschap met een molen, in een lijst van
     donker hout, met de onderkant op 1,25 m.
    */
    const sh = Math.min(0.78, BANK_LANG * 0.36), sb = sh * 1.32;
    const um = (u0 + u1) / 2;
    dB(um - sb / 2 - 0.05, um + sb / 2 + 0.05, 0.01, 0.05, 1.20, 1.25 + sh + 0.05, MAT.lijst, false);
    dB(um - sb / 2, um + sb / 2, 0.048, 0.053, 1.25, 1.25 + sh, MAT.doekje, false);
    inrichting.schilderij = true;
    // en de accentwand erachter, van plint tot plafond
    const av = Math.max(0.02, um - BANK_LANG / 2 - 0.45), at = um + BANK_LANG / 2 + 0.45;
    dB(av, at, 0.004, 0.012, PLINT, HOOGTE - 0.02, MAT.accent, false);
    inrichting.accentwand = true;
  }

  /*
   ---------- de tv, op kijkafstand ----------
   Hij stond tegen de zijwand, en in een kamer van negen meter breed keek je dus
   van acht meter naar een scherm van 55 duim (melding 23 sep 2026). Nu staat het
   dressoir drie meter twintig voor de bank — of zoveel minder als de kamer diep
   is — met het beeld naar de bank toe.
  */
  const TV_AFSTAND = Math.max(1.9, Math.min(3.20, DWARS - BANK_DIEP - 1.35));
  const TV_V = BANK_DIEP + TV_AFSTAND;
  {
    const um = (BANK_U0 + BANK_U1) / 2;
    const u0 = um - 0.85, u1 = um + 0.85;
    dB(u0, u1, TV_V, TV_V + 0.42, 0.06, 0.48, MAT.tvKast);
    dB(u0 + 0.03, u1 - 0.03, TV_V + 0.02, TV_V + 0.42, 0.30, 0.33, MAT.tvRand, false);   // schapje
    dB(um - 0.24, um + 0.24, TV_V + 0.15, TV_V + 0.22, 0.48, 0.53, MAT.tvRand, false);   // voet
    dB(um - 0.66, um + 0.66, TV_V + 0.16, TV_V + 0.22, 0.53, 1.30, MAT.tvRand, false);   // kast
    dB(um - 0.64, um + 0.64, TV_V + 0.15, TV_V + 0.16, 0.55, 1.28, MAT.tvBeeld, false);  // beeld
    // twee dingen op het dressoir, want een kale kast leest als een doos
    dB(u0 + 0.12, u0 + 0.28, TV_V + 0.10, TV_V + 0.26, 0.48, 0.62, MAT.pot, false);
    dB(u0 + 0.13, u0 + 0.27, TV_V + 0.11, TV_V + 0.25, 0.60, 0.62, MAT.aarde, false);
    for (const [du, h] of [[0, 0.20], [0.05, 0.15]]) {
      const q = pB(u0 + 0.20 + du, TV_V + 0.18);
      const b = new THREE.Mesh(schaduw(new THREE.IcosahedronGeometry(0.08, 0)), MAT.bladLicht);
      b.position.set(q.x, 0.62 + h, q.z);
      b.scale.set(1, 1.3, 1);
      groep.add(b);
    }
    dB(u1 - 0.30, u1 - 0.12, TV_V + 0.12, TV_V + 0.30, 0.48, 0.53, MAT.donkerhout, false); // stapeltje
  }

  /*
   ---------- de salontafel met een kleed eronder ----------
   Tussen de bank en de tv in, dichter bij de bank. Het kleed steekt er aan alle
   kanten ruim onderuit en ligt een millimeter boven de vloer, zodat de twee
   vlakken niet met elkaar gaan vechten om hetzelfde beeldpunt.
  */
  {
    // voor het rechte deel van de bank, dus niet in de chaise longue
    const vrijU1 = BANK_U1 - (HOEK_LANG > 0 ? BANK_DIEP : 0);
    const um = (BANK_U0 + vrijU1) / 2;
    const tv = BANK_DIEP + Math.min(1.0, TV_AFSTAND * 0.42);
    const kl = Math.min(3.4, BANK_LANG + 0.6), kb = Math.min(2.6, TV_AFSTAND + 0.6);
    const a = pB(BANK_U0 - 0.3, BANK_DIEP - 0.25), b = pB(BANK_U0 - 0.3 + kl, BANK_DIEP - 0.25 + kb);
    vloer(Math.min(a.x, b.x), Math.max(a.x, b.x), Math.min(a.z, b.z), Math.max(a.z, b.z), 0.012,
      new THREE.MeshBasicMaterial({ map: texture(kleedDoek(), kb / 1.4, kl / 1.4), vertexColors: true, fog: false }));
    const tl = Math.min(1.30, (vrijU1 - BANK_U0) - 0.5), tb = 0.62;
    dB(um - tl / 2, um + tl / 2, tv, tv + tb, 0.34, 0.40, MAT.donkerhout);
    dB(um - tl / 2 + 0.06, um + tl / 2 - 0.06, tv + 0.06, tv + tb - 0.06, 0.14, 0.18, MAT.donkerhout, false);
    for (const uu of [um - tl / 2 + 0.04, um + tl / 2 - 0.10]) for (const vv of [tv + 0.04, tv + tb - 0.10]) {
      dB(uu, uu + 0.06, vv, vv + 0.06, 0, 0.34, MAT.poot, false);
    }
    // een schaal met fruit, een stapeltje tijdschriften en de afstandsbediening
    dB(um - 0.13, um + 0.13, tv + tb / 2 - 0.13, tv + tb / 2 + 0.13, 0.40, 0.47, MAT.keramiek, false);
    dB(um - 0.08, um + 0.08, tv + tb / 2 - 0.08, tv + tb / 2 + 0.08, 0.45, 0.52, MAT.fruit, false);
    dB(um + 0.18, um + 0.42, tv + 0.06, tv + 0.26, 0.40, 0.45, MAT.doekje, false);
    dB(um - 0.34, um - 0.18, tv + tb - 0.20, tv + tb - 0.14, 0.40, 0.43, MAT.tvRand, false);
    inrichting.kleed = true; inrichting.salontafel = true;
  }

  /*
   ---------- de staande lamp en de poef ----------
   De lamp aan het uiteinde van de bank, de poef aan de andere kant van de
   salontafel; allebei in dezelfde maten langs de bank als de rest.
  */
  {
    const lu = BANK_U0 - 0.30;
    if (lu > (ACHTERWAND ? HAL.x1 + 0.3 : HAL.z1 + 0.2)) {
      dB(lu - 0.16, lu + 0.16, 0.20, 0.52, 0, 0.04, MAT.tvRand, false);        // voet
      dB(lu - 0.02, lu + 0.02, 0.34, 0.38, 0.04, 1.45, MAT.tvRand, false);     // stang
      const q = pB(lu, 0.36);
      const kp = new THREE.Mesh(schaduw(new THREE.CylinderGeometry(0.20, 0.15, 0.26, 14, 1, true)), MAT.kap);
      kp.position.set(q.x, 1.58, q.z);
      groep.add(kp);
      inrichting.staandelamp = true;
    }
    const pu = (BANK_U0 + BANK_U1) / 2 - BANK_LANG / 2 - 0.10;
    const pv = BANK_DIEP + Math.min(1.0, TV_AFSTAND * 0.42) + 0.20;
    if (pu > (ACHTERWAND ? HAL.x1 + 0.2 : HAL.z1 + 0.1)) {
      dB(pu - 0.26, pu + 0.26, pv, pv + 0.52, 0, 0.40, MAT.stofRug);
      dB(pu - 0.22, pu + 0.22, pv + 0.04, pv + 0.48, 0.40, 0.44, MAT.stof, false);
    }
  }


  /*
   ---------- het dressoir met de foto's en de schemerlamp ----------
   Tegen dezelfde wand als de tv, in het stuk dat daar nog vrij is: achter de tv
   als de kamer diep genoeg is, anders ervoor richting de gang. Erop staan drie
   fotolijstjes, een schemerlamp met een linnen kap en een plantje — de dingen
   die een kamer van een ruimte een woonkamer maken (verzoek 23 sep 2026).
  */
  const DRESSOIR = (() => {
    // eerst langs de linkerwand, voor of achter de tv — maar niet als de zithoek
    // tegen de achterwand staat: dan ligt die wand vol met de keuken
    const achter = { van: bankZ + BANK_LANG / 2 + 0.2, tot: voorhuis.z1 - MUUR - 0.15 };
    const voor = { van: HAL.z1 + 0.15, tot: bankZ - BANK_LANG / 2 - 0.2 };
    const ruimte = (achter.tot - achter.van) >= (voor.tot - voor.van) ? achter : voor;
    const lang = Math.min(1.45, ruimte.tot - ruimte.van - 0.1);
    if (!ACHTERWAND && lang >= 0.9) {
      const zm = (ruimte.van + ruimte.tot) / 2;
      return { langs: 'z', x0: MUUR + 0.03, diep: 0.42, z0: zm - lang / 2, z1: zm + lang / 2, hoog: 0.80 };
    }
    /*
     Past daar niets, dan is de kamer breed en ondiep (Molenkrite 130c: achttien
     bij zeven) en gaat hij tegen de achterwand, dwars op de tv. Dezelfde kast,
     een kwartslag gedraaid.
    */
    // tegen de achterwand, voorbij de bank en de boekenkast
    const bvan = ACHTERWAND ? BANK_U1 + 2.3 : HAL.x1 + 0.3;
    const btot = BREED - MUUR - 0.4;
    const blang = Math.min(1.45, btot - bvan - 0.1);
    if (blang < 0.9) return null;
    const xm = (bvan + btot) / 2;
    return { langs: 'x', z0: voorhuis.z1 - MUUR - 0.45, diep: 0.42,
      x0: xm - blang / 2, x1: xm + blang / 2, hoog: 0.80 };
  })();
  if (DRESSOIR && DRESSOIR.langs === 'x') {
    /*
     Tegen de achterwand. Hetzelfde meubel als hieronder, maar dan met x en z
     verwisseld; het staat apart omdat een doos geen draaiing kent en de code
     met twee verwisselde assen onleesbaar zou worden.
    */
    const d = DRESSOIR, z1 = d.z0 + d.diep, xm = (d.x0 + d.x1) / 2;
    doos(d.x0, d.x1, d.z0, z1, 0.08, d.hoog, MAT.donkerhout);
    doos(d.x0 - 0.02, d.x1 + 0.02, d.z0, z1 + 0.02, d.hoog, d.hoog + 0.035, MAT.hout, false);
    for (const xx of [d.x0 + 0.06, d.x1 - 0.12]) {
      doos(xx, xx + 0.06, d.z0 + 0.02, d.z0 + 0.08, 0, 0.08, MAT.poot, false);
      doos(xx, xx + 0.06, z1 - 0.10, z1 - 0.04, 0, 0.08, MAT.poot, false);
    }
    doos(d.x0 + 0.08, d.x1 - 0.08, d.z0 - 0.008, d.z0, 0.30, 0.34, MAT.rvs, false);
    const fb = Math.min(0.62, (d.x1 - d.x0) * 0.5);
    doos(xm - fb / 2, xm + fb / 2, z1 - 0.10, z1 - 0.06, d.hoog + 0.035, d.hoog + 0.30, MAT.lijst, false);
    doos(xm - fb / 2 + 0.02, xm + fb / 2 - 0.02, z1 - 0.105, z1 - 0.10, d.hoog + 0.07, d.hoog + 0.27, MAT.fotos, false);
    const lx = d.x1 - 0.22;
    doos(lx - 0.07, lx + 0.07, z1 - 0.28, z1 - 0.14, d.hoog + 0.035, d.hoog + 0.06, MAT.donkerhout, false);
    doos(lx - 0.015, lx + 0.015, z1 - 0.22, z1 - 0.19, d.hoog + 0.06, d.hoog + 0.30, MAT.tvRand, false);
    {
      const m = new THREE.Mesh(schaduw(new THREE.CylinderGeometry(0.14, 0.10, 0.20, 12, 1, true)), MAT.kap);
      m.position.set(lx, d.hoog + 0.40, z1 - 0.205);
      groep.add(m);
    }
    const px2 = d.x0 + 0.20;
    doos(px2 - 0.07, px2 + 0.07, z1 - 0.28, z1 - 0.14, d.hoog + 0.035, d.hoog + 0.18, MAT.pot, false);
    doos(px2 - 0.06, px2 + 0.06, z1 - 0.27, z1 - 0.15, d.hoog + 0.16, d.hoog + 0.18, MAT.aarde, false);
    for (const [dx, dz, h] of [[0.02, 0, 0.26], [-0.03, 0.04, 0.20], [0.04, -0.05, 0.22]]) {
      const b = new THREE.Mesh(schaduw(new THREE.IcosahedronGeometry(0.09, 0)), MAT.bladLicht);
      b.position.set(px2 + dx, d.hoog + 0.12 + h, z1 - 0.21 + dz);
      b.scale.set(1, 1.35, 1);
      groep.add(b);
    }
    inrichting.dressoir = true; inrichting.fotos = true; inrichting.lamp = true;
  } else if (DRESSOIR) {
    const d = DRESSOIR, x1 = d.x0 + d.diep, zm = (d.z0 + d.z1) / 2;
    doos(d.x0, x1, d.z0, d.z1, 0.08, d.hoog, MAT.donkerhout);                    // kast
    doos(d.x0, x1 + 0.02, d.z0 - 0.02, d.z1 + 0.02, d.hoog, d.hoog + 0.035, MAT.hout, false); // blad
    for (const zz of [d.z0 + 0.06, d.z1 - 0.12]) {
      doos(d.x0 + 0.02, d.x0 + 0.08, zz, zz + 0.06, 0, 0.08, MAT.poot, false);   // pootjes
      doos(x1 - 0.10, x1 - 0.04, zz, zz + 0.06, 0, 0.08, MAT.poot, false);
    }
    doos(x1 - 0.008, x1, d.z0 + 0.08, d.z1 - 0.08, 0.30, 0.34, MAT.rvs, false);  // greep van de lade
    // drie fotolijstjes op het blad, allemaal de kamer in gedraaid
    const fb = Math.min(0.62, (d.z1 - d.z0) * 0.5);
    doos(d.x0 + 0.06, d.x0 + 0.10, zm - fb / 2, zm + fb / 2, d.hoog + 0.035, d.hoog + 0.30, MAT.lijst, false);
    doos(d.x0 + 0.10, d.x0 + 0.105, zm - fb / 2 + 0.02, zm + fb / 2 - 0.02, d.hoog + 0.07, d.hoog + 0.27, MAT.fotos, false);
    // de schemerlamp: voet, stang en een linnen kap
    const lz = d.z1 - 0.22;
    doos(d.x0 + 0.14, d.x0 + 0.28, lz - 0.07, lz + 0.07, d.hoog + 0.035, d.hoog + 0.06, MAT.donkerhout, false);
    doos(d.x0 + 0.19, d.x0 + 0.22, lz - 0.015, lz + 0.015, d.hoog + 0.06, d.hoog + 0.30, MAT.tvRand, false);
    {
      const m = new THREE.Mesh(schaduw(new THREE.CylinderGeometry(0.14, 0.10, 0.20, 12, 1, true)), MAT.kap);
      m.position.set(d.x0 + 0.205, d.hoog + 0.40, lz);
      groep.add(m);
    }
    // en een plantje ernaast
    const pz = d.z0 + 0.20;
    doos(d.x0 + 0.14, d.x0 + 0.28, pz - 0.07, pz + 0.07, d.hoog + 0.035, d.hoog + 0.18, MAT.pot, false);
    doos(d.x0 + 0.15, d.x0 + 0.27, pz - 0.06, pz + 0.06, d.hoog + 0.16, d.hoog + 0.18, MAT.aarde, false);
    for (const [dx, dz, h] of [[0.02, 0.0, 0.26], [-0.03, 0.04, 0.20], [0.04, -0.05, 0.22]]) {
      const b = new THREE.Mesh(schaduw(new THREE.IcosahedronGeometry(0.09, 0)), MAT.bladLicht);
      b.position.set(d.x0 + 0.21 + dx, d.hoog + 0.12 + h, pz + dz);
      b.scale.set(1, 1.35, 1);
      groep.add(b);
    }
    inrichting.dressoir = true; inrichting.fotos = true; inrichting.lamp = true;
  }

  /*
   ---------- de boekenkast ----------
   Vier planken met boeken en een plantje bovenop. Staat de tv vrij in de kamer,
   dan komt de kast tegen de wand erachter; staat hij tegen de wand, dan komt de
   kast naast de bank langs dezelfde wand. Zo staat hij nooit in de looproute.
  */
  {
    const lang = Math.min(1.60, Math.max(0.9, BANK_LANG * 0.6));
    const naast = BANK_U1 + 0.35;
    const eind = ACHTERWAND ? BREED - MUUR - 0.3 : voorhuis.z1 - MUUR - 0.3;
    const plek = (naast + lang < eind)
      ? { u0: naast, u1: naast + lang, v0: 0.04, v1: 0.38 }              // naast de bank
      : null;
    if (plek) {
      const { u0, u1, v0, v1 } = plek;
      dB(u0, u1, v0, v1, 0, 1.95, MAT.donkerhout);                       // ombouw
      for (let i = 0; i < 4; i++) {
        const y = 0.30 + i * 0.42;
        dB(u0 + 0.03, u1 - 0.03, v0 + 0.02, v1 - 0.02, y, y + 0.03, MAT.hout, false);
        const n = Math.max(2, Math.round((u1 - u0 - 0.1) / 0.34));
        for (let k = 0; k < n; k++) {
          if ((i + k) % 5 === 3) continue;
          const bu = u0 + 0.05 + k * ((u1 - u0 - 0.1) / n);
          dB(bu, bu + ((u1 - u0 - 0.1) / n) - 0.03, v0 + 0.06, v1 - 0.04, y + 0.03, y + 0.31, MAT.boeken, false);
        }
      }
      const um = (u0 + u1) / 2;
      dB(um - 0.09, um + 0.09, v0 + 0.08, v1 - 0.08, 1.95, 2.10, MAT.pot, false);
      for (const [du, h] of [[0, 0.18], [0.06, 0.13], [-0.05, 0.15]]) {
        const q = pB(um + du, (v0 + v1) / 2);
        const b = new THREE.Mesh(schaduw(new THREE.IcosahedronGeometry(0.085, 0)), MAT.blad);
        b.position.set(q.x, 2.10 + h, q.z);
        b.scale.set(1, 1.25, 1);
        groep.add(b);
      }
      inrichting.boekenkast = true;
    }
  }

  /*
   ---------- de gordijnen bij de pui ----------
   Twee banen naast het raam, met een roede erboven. Ze hangen tot vijf
   centimeter boven de vloer, zoals gordijnen horen te hangen.
  */
  if (PUI.tot - PUI.van > 1.2) {
    const zw = MUUR + 0.02;
    doos(PUI.van - 0.25, PUI.tot + 0.25, zw + 0.06, zw + 0.09, 2.36, 2.40, MAT.tvRand, false);  // roede
    for (const [a, b] of [[PUI.van - 0.22, PUI.van + 0.30], [PUI.tot - 0.30, PUI.tot + 0.22]]) {
      if (b - a < 0.2) continue;
      doos(a, b, zw + 0.03, zw + 0.12, 0.05, 2.34, MAT.kap, false);
      // een vouw erin, zodat het geen plank is
      doos(a + (b - a) * 0.45, a + (b - a) * 0.62, zw + 0.12, zw + 0.17, 0.05, 2.34, MAT.kap, false);
    }
    inrichting.gordijnen = true;
  }

  /*
   ---------- de klok en de kattenmand ----------
   De klok hangt vooraan tegen de rechterwand, de mand staat in de hoek bij de
   plant — de katten uit js/kat.js lopen er vanzelf langs.
  */
  {
    const kx = BREED - MUUR - 0.04, kz = MUUR + 1.00;
    if (!ACHTERWAND ? kz < BANK_U0 - 0.4 : true) {
      const rand = new THREE.Mesh(schaduw(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 18)), MAT.lijst);
      rand.rotation.z = Math.PI / 2;
      rand.position.set(kx - 0.03, 1.95, kz);
      groep.add(rand);
      const wijzer = new THREE.Mesh(schaduw(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 18)), MAT.keramiek);
      wijzer.rotation.z = Math.PI / 2;
      wijzer.position.set(kx - 0.055, 1.95, kz);
      groep.add(wijzer);
      doos(kx - 0.07, kx - 0.06, kz - 0.005, kz + 0.005, 1.95, 2.06, MAT.tvRand, false);
      doos(kx - 0.07, kx - 0.06, kz - 0.005, kz + 0.075, 1.945, 1.955, MAT.tvRand, false);
      inrichting.klok = true;
    }
    const mx = BREED - MUUR - 0.50, mz = MUUR + 1.35;
    if (!ACHTERWAND ? mz < BANK_U0 - 0.5 : mz < voorhuis.z1 - MUUR - BANK_DIEP - 1.0) {
      doos(mx - 0.30, mx + 0.30, mz - 0.24, mz + 0.24, 0, 0.16, MAT.donkerhout);
      doos(mx - 0.25, mx + 0.25, mz - 0.19, mz + 0.19, 0.10, 0.18, MAT.stof, false);
      inrichting.kattenmand = true;
    }
  }

  /*
   ---------- de fauteuil ----------
   Alleen als er geen chaise longue is: dan is er een losse stoel naast de bank,
   in het verlengde ervan en met de rug tegen dezelfde wand.
  */
  if (HOEK_LANG === 0) {
    const fu = BANK_U1 + 0.30;
    const eind = ACHTERWAND ? BREED - MUUR - 0.3 : voorhuis.z1 - MUUR - 0.3;
    if (fu + 0.85 < eind) {
      dB(fu, fu + 0.85, 0.04, BANK_DIEP - 0.06, 0.10, 0.36, MAT.stof);
      dB(fu + 0.10, fu + 0.85, 0.04, BANK_DIEP - 0.16, 0.36, 0.46, MAT.stof, false);
      dB(fu, fu + 0.85, 0.04, 0.22, 0.36, 0.82, MAT.stofRug, false);
      dB(fu, fu + 0.14, 0.20, BANK_DIEP - 0.06, 0.36, 0.60, MAT.stofRug, false);
      dB(fu + 0.71, fu + 0.85, 0.20, BANK_DIEP - 0.06, 0.36, 0.60, MAT.stofRug, false);
      for (const uu of [fu + 0.06, fu + 0.73]) for (const vv of [0.10, BANK_DIEP - 0.22]) {
        dB(uu, uu + 0.06, vv, vv + 0.06, 0, 0.10, MAT.poot, false);
      }
      inrichting.fauteuil = true;
    }
  }

  /*
   ---------- de grote plant in de hoek ----------
   Een pot met een stam en drie bossen blad, in de hoek bij het raam. Hij staat
   in de weg zoals een echte kamerplant in de weg staat: er zit een botsdoos om
   de pot, dus je loopt er niet dwars doorheen.
  */
  {
    const px = BREED - MUUR - 0.42, pz = MUUR + 0.50;
    if (px > HAL.x1 + 0.6) {
      doos(px - 0.22, px + 0.22, pz - 0.22, pz + 0.22, 0, 0.34, MAT.pot);
      doos(px - 0.19, px + 0.19, pz - 0.19, pz + 0.19, 0.32, 0.35, MAT.aarde, false);
      doos(px - 0.035, px + 0.035, pz - 0.035, pz + 0.035, 0.34, 1.05, MAT.stam, false);
      for (const [dx, dz, h, r] of [[0, 0, 1.28, 0.30], [0.22, 0.12, 1.05, 0.22], [-0.18, -0.14, 1.12, 0.20]]) {
        const b = new THREE.Mesh(schaduw(new THREE.IcosahedronGeometry(r, 0)), dx ? MAT.bladLicht : MAT.blad);
        b.position.set(px + dx, h, pz + dz);
        b.scale.set(1, 0.8, 1);
        groep.add(b);
      }
      inrichting.plant = true;
    }
  }

  /*
   ---------- de eettafel ----------
   Een tafel van 1,40 bij 0,85 met vier stoelen, in het voorste deel van de
   woonkamer bij het raam — daar waar in een Sneker rijtjeshuis de eethoek
   staat, met de bank achter je en de keuken in het verlengde. Aan de stoel met
   de rug naar het raam kun je gaan zitten (verzoek 22 sep 2026); dan kijk je de
   kamer in.
  */
  const TAFEL = (() => {
    const bl = Math.min(1.40, Math.max(0.9, (BREED - MUUR - HAL.x1) - 0.9));
    const dp = 0.85;
    const xm = (HAL.x1 + BREED - MUUR) / 2;
    const zm = Math.min(MUUR + 1.55, Math.max(MUUR + 1.0, (MUUR + HAL.z1) / 2 + 0.2));
    return { x: xm, z: zm, breed: bl, diep: dp, hoog: 0.74 };
  })();
  {
    const t = TAFEL;
    const x0 = t.x - t.breed / 2, x1 = t.x + t.breed / 2;
    const z0 = t.z - t.diep / 2, z1 = t.z + t.diep / 2;
    doos(x0, x1, z0, z1, t.hoog - 0.04, t.hoog, MAT.hout);                   // blad
    for (const xx of [x0 + 0.06, x1 - 0.12]) for (const zz of [z0 + 0.06, z1 - 0.12]) {
      doos(xx, xx + 0.06, zz, zz + 0.06, 0, t.hoog - 0.04, MAT.poot, false); // poten
    }
    // vier stoelen: zitting op 45, rug tot 90
    const stoel = (sx, sz, langsX) => {
      const b = langsX ? 0.42 : 0.40, d = langsX ? 0.40 : 0.42;
      const a0 = sx - b / 2, a1 = sx + b / 2, c0 = sz - d / 2, c1 = sz + d / 2;
      doos(a0, a1, c0, c1, 0.43, 0.47, MAT.hout);
      for (const xx of [a0 + 0.02, a1 - 0.06]) for (const zz of [c0 + 0.02, c1 - 0.06]) {
        doos(xx, xx + 0.04, zz, zz + 0.04, 0, 0.43, MAT.poot, false);
      }
      if (langsX) doos(a0, a1, sz < t.z ? c0 : c1 - 0.04, sz < t.z ? c0 + 0.04 : c1, 0.47, 0.90, MAT.hout, false);
      else doos(sx < t.x ? a0 : a1 - 0.04, sx < t.x ? a0 + 0.04 : a1, c0, c1, 0.47, 0.90, MAT.hout, false);
    };
    stoel(t.x - 0.38, z0 - 0.32, true);
    stoel(t.x + 0.38, z0 - 0.32, true);
    stoel(t.x - 0.38, z1 + 0.32, true);
    stoel(t.x + 0.38, z1 + 0.32, true);
  }

  /*
   ---------- de koelkast ----------
   Naast het keukenblok, aan het eind van de rij: 60 breed, 65 diep, 1,80 hoog,
   met een greep. Er staat bier in — je eigen bier, dus je betaalt er niets
   voor; het scheelt hetzelfde leven als een flesje bij de Poiesz.
  */
  /*
   Aan het eind van de keukenrij, tegen dezelfde wand: zo staat hij in elke
   keuken, ook in een smalle aanbouw waar naast het aanrecht niets meer past.
   De kastenrij hieronder houdt er rekening mee en begint erachter.
  */
  const KOEL_LENGTE = 0.68;
  const KOELKAST = (KEUKEN.z1 - KEUKEN.z0 > 2.6)
    ? { x0: KEUKEN.x0, z0: KEUKEN.z0 + 0.20, breed: 0.66, lang: KOEL_LENGTE }
    : null;
  if (KOELKAST) {
    const k = KOELKAST;
    const x1 = k.x0 + k.breed, z1 = k.z0 + k.lang;
    doos(k.x0, x1, k.z0, z1, 0, 1.80, MAT.rvs);
    doos(x1, x1 + 0.02, z1 - 0.16, z1 - 0.12, 0.55, 1.45, MAT.tvRand, false);   // greep
    doos(k.x0, x1 + 0.002, k.z0 + 0.86, k.z0 + 0.89, 0, 1.80, MAT.tvRand, false); // naad
  }

  // ---------- het keukenblok ----------
  // Eén rij tegen de zijwand van de aanbouw: onderkasten van 60 cm diep met een
  // werkblad op 90 cm, wandtegels tot 1,45 en bovenkasten van 1,45 tot 2,15.
  if (KEUKEN.z1 - KEUKEN.z0 > 2) {
    const x0 = KEUKEN.x0;
    const z0 = KEUKEN.z0 + 0.30 + (KOELKAST ? KOEL_LENGTE : 0), z1 = KEUKEN.z1 - 0.25;
    doos(x0, x0 + KAST_DIEP, z0, z1, 0.10, AANRECHT - 0.04, MAT.hout);          // kastenrij
    doos(x0, x0 + KAST_DIEP, z0, z1, 0, 0.10, MAT.werkblad, false);             // sokkel
    doos(x0, x0 + KAST_DIEP + 0.02, z0 - 0.02, z1 + 0.02, AANRECHT - 0.04, AANRECHT, MAT.werkblad, false);
    // greepjes en naden tussen de deurtjes
    const n = Math.max(3, Math.round((z1 - z0) / 0.6));
    for (let i = 1; i < n; i++) {
      const zz = z0 + (z1 - z0) * i / n;
      doos(x0 + KAST_DIEP - 0.005, x0 + KAST_DIEP + 0.001, zz - 0.008, zz + 0.008, 0.12, AANRECHT - 0.06, MAT.werkblad, false);
    }
    for (let i = 0; i < n; i++) {
      const zz = z0 + (z1 - z0) * (i + 0.5) / n;
      doos(x0 + KAST_DIEP, x0 + KAST_DIEP + 0.025, zz - 0.06, zz + 0.06, AANRECHT - 0.16, AANRECHT - 0.13, MAT.rvs, false);
    }
    // spoelbak en kookplaat in het blad
    const spoelZ = z0 + (z1 - z0) * 0.30, kookZ = z0 + (z1 - z0) * 0.70;
    doos(x0 + 0.07, x0 + 0.53, spoelZ - 0.21, spoelZ + 0.21, AANRECHT - 0.001, AANRECHT + 0.004, MAT.rvs, false);
    doos(x0 + 0.11, x0 + 0.16, spoelZ + 0.26, spoelZ + 0.30, AANRECHT, AANRECHT + 0.24, MAT.rvs, false);   // kraan
    doos(x0 + 0.16, x0 + 0.34, spoelZ + 0.26, spoelZ + 0.29, AANRECHT + 0.21, AANRECHT + 0.24, MAT.rvs, false);
    doos(x0 + 0.05, x0 + 0.55, kookZ - 0.28, kookZ + 0.28, AANRECHT, AANRECHT + 0.008, MAT.kookplaat, false);
    // wandtegels achter het blad (eigen repeat, zodat de blokjes 15 cm blijven)
    const tw = z1 - z0 + 0.10, th = BOVENKAST_ONDER - AANRECHT;
    doos(x0 + 0.001, x0 + 0.012, z0 - 0.05, z1 + 0.05, AANRECHT, BOVENKAST_ONDER,
      vlak(wandtegels(), tw / 1.2, th / 1.2, 0.98), false);
    // bovenkasten, met boven de kookplaat een plek voor de schouw
    const gatVan = kookZ - 0.35, gatTot = kookZ + 0.35;
    for (const [a, b] of [[z0, gatVan], [gatTot, z1]]) {
      if (b - a < 0.3) continue;
      doos(x0, x0 + BOVENKAST_DIEP, a, b, BOVENKAST_ONDER, BOVENKAST_BOVEN, MAT.hout, false);
      doos(x0, x0 + BOVENKAST_DIEP + 0.01, a, b, BOVENKAST_BOVEN, BOVENKAST_BOVEN + 0.02, MAT.werkblad, false);
    }
    doos(x0, x0 + 0.50, gatVan + 0.05, gatTot - 0.05, 1.55, 1.90, MAT.rvs, false);       // wasemkap
    doos(x0, x0 + 0.16, gatVan + 0.22, gatTot - 0.22, 1.90, BOVENKAST_BOVEN, MAT.rvs, false);

    /*
     En wat er op het aanrecht staat (verzoek 23 sep 2026). Een leeg werkblad
     leest als een showroom; dit is wat er in een gewone keuken op staat: een
     waterkoker, een snijplank tegen de tegels, een fruitschaal, een afdruiprek
     naast de spoelbak en een theedoek over het handvat van de oven. Allemaal
     zonder botsdoos — je loopt er niet tegenaan, je kijkt ernaar.
    */
    const bl = AANRECHT + 0.004;                      // net op het blad
    const zet = (zz, breed, diep, hoog, mat, dx = 0.10) => {
      if (zz < z0 + 0.05 || zz + diep > z1 - 0.05) return;
      doos(x0 + dx, x0 + dx + breed, zz, zz + diep, bl, bl + hoog, mat, false);
      inrichting.keuken++;
    };
    // waterkoker: een romp met een deksel en een tuit
    const kz = z0 + (z1 - z0) * 0.12;
    zet(kz, 0.17, 0.17, 0.22, MAT.rvs, 0.12);
    zet(kz + 0.03, 0.11, 0.11, 0.26, MAT.tvRand, 0.15);
    // snijplank rechtop tegen de tegels, met een blokje ernaast
    const sz = z0 + (z1 - z0) * 0.45;
    if (sz > z0 && sz + 0.30 < z1) {
      doos(x0 + 0.03, x0 + 0.055, sz, sz + 0.30, bl, bl + 0.34, MAT.hout, false);
      doos(x0 + 0.08, x0 + 0.20, sz + 0.33, sz + 0.45, bl, bl + 0.24, MAT.donkerhout, false);
      inrichting.keuken++;
    }
    // fruitschaal met een paar appels erin
    const fz = z1 - 0.42;
    zet(fz, 0.26, 0.26, 0.07, MAT.keramiek, 0.16);
    for (const [ddx, ddz] of [[0.02, 0.03], [0.10, 0.09], [0.06, 0.15]]) {
      doos(x0 + 0.18 + ddx, x0 + 0.24 + ddx, fz + ddz, fz + 0.06 + ddz, bl + 0.05, bl + 0.11, MAT.fruit, false);
    }
    // afdruiprek naast de spoelbak: een bak met drie borden op hun kant
    const az = spoelZ - 0.52;
    if (az > z0 + 0.1) {
      doos(x0 + 0.10, x0 + 0.44, az, az + 0.30, bl, bl + 0.04, MAT.rvs, false);
      for (let i = 0; i < 3; i++) {
        doos(x0 + 0.14, x0 + 0.40, az + 0.05 + i * 0.08, az + 0.065 + i * 0.08, bl + 0.04, bl + 0.22, MAT.keramiek, false);
      }
      inrichting.keuken++;
    }
    // theedoek over de greep van de onderkast onder de spoelbak
    doos(x0 + KAST_DIEP + 0.005, x0 + KAST_DIEP + 0.035, spoelZ - 0.10, spoelZ + 0.10,
      AANRECHT - 0.30, AANRECHT - 0.13, MAT.kap, false);
    inrichting.keuken++;
    // een pedaalemmer aan het eind van de rij, en een plantje op het raamkozijn
    if (z1 + 0.45 < KEUKEN.z1) {
      doos(x0 + 0.05, x0 + 0.40, z1 + 0.08, z1 + 0.43, 0, 0.62, MAT.rvs);
      doos(x0 + 0.05, x0 + 0.40, z1 + 0.08, z1 + 0.43, 0.62, 0.66, MAT.tvRand, false);
      inrichting.keuken++;
    }
    {
      const vz = KEUKEN.z1 - 0.35;
      doos(x0 + 0.02, x0 + 0.16, vz - 0.07, vz + 0.07, 0.95, 1.10, MAT.pot, false);
      for (const [dz, h] of [[0, 0.16], [0.05, 0.12]]) {
        const b = new THREE.Mesh(schaduw(new THREE.IcosahedronGeometry(0.07, 0)), MAT.bladLicht);
        b.position.set(x0 + 0.09, 1.10 + h, vz + dz);
        b.scale.set(1, 1.2, 1);
        groep.add(b);
      }
      inrichting.keuken++;
    }
  }

  // ---------- lampen ----------
  // Een kap aan het plafond in de woonkamer en in de keuken. Ze geven geen
  // licht (dat zit in de materialen), maar zonder lamp is het plafond leeg.
  const kap = (x, z) => {
    doos(x - 0.01, x + 0.01, z - 0.01, z + 0.01, HOOGTE - 0.35, HOOGTE, MAT.snoer, false);
    const m = new THREE.Mesh(schaduw(new THREE.CylinderGeometry(0.16, 0.11, 0.16, 14, 1, true)), MAT.lamp);
    m.position.set(x, HOOGTE - 0.43, z);
    groep.add(m);
  };
  kap(BREED / 2 + 0.2, bankZ);
  if (KEUKEN.z1 - KEUKEN.z0 > 2) kap((KEUKEN.x0 + KEUKEN.x1) / 2 + 0.15, (KEUKEN.z0 + KEUKEN.z1) / 2);

  /*
   ---------- het uitzicht ----------
   De kamer staat ver buiten het kaartgebied, dus achter de ramen was niets te
   zien. Hier komt de buurt terug: de panden binnen vijftig meter van dit huis
   worden op hun echte plek, maat en goothoogte als eenvoudige blokken opnieuw
   neergezet — omgerekend naar kamermaten met `plan.naarKamer` — met de straat
   en de stoep aan de voorkant, gras eromheen en een paar bomen. Het is een
   kijkdoos: van dichtbij is het een blokkendoos, maar door een raam van tweeën-
   half bij anderhalve meter is het precies de buurt zoals hij hoort te liggen.

   Het staat in een eigen groep, los van de kamer, zodat de proefgereedschappen
   die de omhullende doos van de kamer meten er geen last van hebben.
  */
  const buiten = new THREE.Group();
  buiten.position.set(NUL.x, 0, NUL.z);
  scene.add(buiten);
  const buitenMat = {
    gras: new THREE.MeshBasicMaterial({ color: 0x5f8a3f, vertexColors: true, fog: false }),
    weg: new THREE.MeshBasicMaterial({ color: 0x8d8f92, vertexColors: true, fog: false }),
    stoep: new THREE.MeshBasicMaterial({ color: 0xb4b3ad, vertexColors: true, fog: false }),
    stam: new THREE.MeshBasicMaterial({ color: 0x6b5334, vertexColors: true, fog: false }),
    kruin: new THREE.MeshBasicMaterial({ color: 0x3f6b33, vertexColors: true, fog: false }),
    heg: new THREE.MeshBasicMaterial({ color: 0x46702f, vertexColors: true, fog: false }),
  };
  /*
   Een zadeldak als twee schuine vlakken naar een nok in het midden, met de uv
   in meters zodat de pannen overal even groot zijn. Een platte doos van vijf
   meter hoog leest als een muur; dit leest als een dak.
  */
  function zadeldak(breed, diep, y0, y1) {
    const b = breed / 2, d = diep / 2;
    const nok = [[-b, y1, 0], [b, y1, 0]];
    const pos = [], uv = [];
    const hel = Math.hypot(d, y1 - y0);
    for (const zk of [1, -1]) {
      const A = nok[0], B = nok[1];
      const C = [b, y0, d * zk], D = [-b, y0, d * zk];
      const driehoeken = zk > 0 ? [[A, B, C], [A, C, D]] : [[B, A, D], [B, D, C]];
      for (const t of driehoeken) for (const p of t) {
        pos.push(p[0], p[1], p[2]);
        uv.push(p[0] / 2.2, (p[1] === y1 ? hel : 0) / 2.2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    return geo;
  }
  // de twee driehoeken op de kop van dat dak
  function kopvlakken(breed, diep, y0, y1) {
    const b = breed / 2, d = diep / 2;
    const pos = [], uv = [];
    for (const xk of [1, -1]) {
      const A = [b * xk, y0, -d], B = [b * xk, y0, d], C = [b * xk, y1, 0];
      const t = xk > 0 ? [A, B, C] : [B, A, C];
      for (const p of t) { pos.push(p[0], p[1], p[2]); uv.push(p[2] / 2.6, p[1] / 2.6); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    return geo;
  }

  function bouwBuiten() {
    const plaat = (b, d, y, mat, x, z) => {
      const geo = new THREE.PlaneGeometry(b, d);
      geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(schaduw(geo), mat);
      m.position.set(x, y, z);
      buiten.add(m);
    };
    // gras onder alles door, dan de weg en de stoep voor de deur
    plaat(220, 220, -0.02, buitenMat.gras, BREED / 2, DIEP / 2);
    plaat(220, 6.5, -0.012, buitenMat.weg, BREED / 2, -6.6);
    plaat(220, 1.9, -0.008, buitenMat.stoep, BREED / 2, -2.4);
    /*
     De buren, uit de kaart. Ze krijgen de échte geveltexture van hun eigen
     woningtype mee — dezelfde die de wijk buiten gebruikt, en dus uit dezelfde
     cache, wat geen extra geheugen kost. Een doos van three.js legt zijn uv per
     zijde van 0 tot 1, en zo'n geveltexture bevat alle woningen van het rijtje
     naast elkaar; die past dus precies over de lange kant, net als bij de echte
     muren. De kopse kanten krijgen kale steen, want een uitgerekt rijtje van
     opzij klopt niet.
    */
    const hier = pand.rect;
    const buitenMats = new Map();
    const mat = (sleutel, maak) => {
      if (!buitenMats.has(sleutel)) {
        buitenMats.set(sleutel, new THREE.MeshBasicMaterial({ map: maak(), vertexColors: true, fog: false }));
      }
      return buitenMats.get(sleutel);
    };
    for (const q of KAART.panden) {
      if (q === pand || !q.rect) continue;
      const d = Math.hypot(q.rect.cx - hier.cx, q.rect.cz - hier.cz);
      if (d > 52) continue;
      const st2 = HOUSE_STYLES[q.type];
      if (!st2) continue;
      const mid = plan.naarKamer(q.rect.cx, q.rect.cz);
      const as = plan.richting(Math.cos(q.rect.hoek), Math.sin(q.rect.hoek));
      const h = Math.max(2.6, q.goot || 3);
      const nok = Math.max(h + 0.6, q.nok || h + 2);
      /*
       Welke kant van de rechthoek is de gevel? Bij een rijtje is dat de lange
       kant, maar een losse woning in een rij staat met zijn diepte langs de
       rechthoek-as: dan ligt de gevel op de korte kant. Zonder deze slag keek de
       halve straat je met een blinde zijmuur aan en stonden de nokken dwars op
       de weg. `q.front` weet welke kant het is; komt hij overeen met de as van
       de rechthoek, dan draait de doos een kwartslag mee.
      */
      const frontK = q.front ? plan.richting(q.front[0], q.front[1]) : null;
      const langsAs = frontK ? frontK.x * as.x + frontK.z * as.z : 0;
      const dwarsAs = frontK ? frontK.x * -as.z + frontK.z * as.x : 1;
      const kwart = Math.abs(langsAs) > Math.abs(dwarsAs);
      const breed = (kwart ? q.rect.hz : q.rect.hx) * 2;
      const diep = (kwart ? q.rect.hx : q.rect.hz) * 2;
      const naarPlusZ = kwart ? langsAs > 0 : dwarsAs > 0;
      const SH = st2.storeyH || 2.9;
      const lagen = Math.max(1, Math.min(4, Math.round(h / SH)));
      const huizen = Math.max(1, Math.round(breed / (st2.w || 5.5)));
      const zaad = (Number(String(q.id).slice(-1)) || 0) % 6;
      const voorgevel = mat(`v|${q.type}|${huizen}|${lagen}|${zaad}`, () => facade(q.type, huizen, lagen, false, zaad));
      const achtergevel = mat(`a|${q.type}|${huizen}|${lagen}|${zaad}`, () => facade(q.type, huizen, lagen, true, zaad));
      const kopgevel = mat(`s|${q.type}`, () => brick(st2.brick[0], st2.brick[1], 1));
      const draai = Math.atan2(-as.z, as.x) + (kwart ? Math.PI / 2 : 0);
      const langsA = naarPlusZ ? voorgevel : achtergevel;
      const langsB = naarPlusZ ? achtergevel : voorgevel;
      // volgorde van BoxGeometry: +x, -x, +y, -y, +z, -z — de lange zijden zijn ±z
      const muur = new THREE.Mesh(schaduw(new THREE.BoxGeometry(breed, h, diep)),
        [kopgevel, kopgevel, kopgevel, kopgevel, langsA, langsB]);
      muur.position.set(mid.x, h / 2, mid.z);
      muur.rotation.y = draai;
      buiten.add(muur);
      // een echt zadeldak met pannen erop: twee schuine vlakken naar een nok
      const dakMat = mat(`d|${st2.roof}`, () => roofTiles(st2.roof, 5));
      const kap2 = new THREE.Mesh(schaduw(zadeldak(breed + 0.4, diep + 0.4, 0, nok - h)), dakMat);
      kap2.position.set(mid.x, h, mid.z);
      kap2.rotation.y = draai;
      buiten.add(kap2);
      // de topgevels dicht, anders kijk je onder de pannen door
      const kop = new THREE.Mesh(schaduw(kopvlakken(breed, diep + 0.4, 0, nok - h)), kopgevel);
      kop.position.set(mid.x, h, mid.z);
      kop.rotation.y = draai;
      buiten.add(kop);
    }
    // heg achter in de tuin en een paar bomen, zodat het niet kaal is
    for (const [x, z, b] of [[BREED / 2, DIEP + 7.5, BREED + 9]]) {
      const m = new THREE.Mesh(schaduw(new THREE.BoxGeometry(b, 1.7, 0.6)), buitenMat.heg);
      m.position.set(x, 0.85, z); buiten.add(m);
    }
    for (const [x, z, h] of [[-7.5, 6, 7], [BREED + 8, 4.5, 6], [-6, -12, 8], [BREED + 9, DIEP + 3, 7]]) {
      const stam = new THREE.Mesh(schaduw(new THREE.CylinderGeometry(0.18, 0.24, h * 0.45, 6)), buitenMat.stam);
      stam.position.set(x, h * 0.22, z); buiten.add(stam);
      const kruin = new THREE.Mesh(schaduw(new THREE.IcosahedronGeometry(h * 0.34, 0)), buitenMat.kruin);
      kruin.position.set(x, h * 0.62, z); buiten.add(kruin);
    }
  }
  bouwBuiten();

  /*
   ---------- de katten ----------
   Eén aan de Molenkrite, twee aan de Wieken. Ze lopen de kamer rond, blijven af
   en toe staan om rond te kijken, gaan zitten, en klimmen soms op de bank. Het
   doel wordt geprikt in de vloervakken van de plattegrond zelf en daarna langs
   `resolveCollisions` gehaald: ligt er een bank, een kast of een keukenblok, dan
   komt het punt niet vrij en wordt er een nieuw geprikt. Zo hoeft er nergens een
   looproute ingetekend te worden.
  */
  const katten = [];
  const KAT_LOOP = 0.62;
  function vrijPunt() {
    for (let poging = 0; poging < 30; poging++) {
      const v = vakken[Math.floor(Math.random() * vakken.length)];
      const x = v.x0 + 0.5 + Math.random() * Math.max(0.1, v.x1 - v.x0 - 1.0);
      const z = v.z0 + 0.5 + Math.random() * Math.max(0.1, v.z1 - v.z0 - 1.0);
      const [rx, rz] = resolveCollisions(NUL.x + x, NUL.z + z, 0.2);
      if (Math.hypot(rx - (NUL.x + x), rz - (NUL.z + z)) < 0.01) return { x, z };
    }
    return { x: BREED / 2, z: DIEP / 2 };
  }
  for (let i = 0; i < (HUIS.katten || 0); i++) {
    const kat = maakKat({ schaduw, zaad: i });
    const p = vrijPunt();
    kat.zetNeer(p.x, p.z, Math.random() * 6.28);
    groep.add(kat.groep);
    katten.push({ kat, staat: 'wacht', doel: vrijPunt(), t: 1 + Math.random() * 2, opBank: false });
  }
  // waar een kat op de bank springt: op de zitting, in de maten langs de bank
  const BANK_ZIT = { y: 0.46, plek: (t) => pB(BANK_U0 + 0.4 + t * (BANK_LANG - 0.8), 0.50) };
  function katUpdate(dt) {
    for (const k of katten) {
      const pos = k.kat.groep.position;
      k.t -= dt;
      if (k.staat === 'loopt') {
        const dx = k.doel.x - pos.x, dz = k.doel.z - pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.12) {
          k.kat.draaiNaar(Math.atan2(-dx, -dz), dt, 3.2);
          const stap = Math.min(d, KAT_LOOP * dt);
          const nx = pos.x + dx / d * stap, nz = pos.z + dz / d * stap;
          const [rx, rz] = resolveCollisions(NUL.x + nx, NUL.z + nz, 0.16);
          pos.x = rx - NUL.x; pos.z = rz - NUL.z;
          // klem tegen de bank of een kast? dan een ander doel
          if (Math.hypot(pos.x - nx, pos.z - nz) > 0.02) { k.doel = vrijPunt(); k.t = 0.5; }
          k.kat.update(dt, { loopt: true, snelheid: KAT_LOOP });
          continue;
        }
        k.staat = Math.random() < 0.45 ? 'zit' : 'wacht';
        k.t = k.staat === 'zit' ? 5 + Math.random() * 9 : 1.5 + Math.random() * 3;
      }
      k.kat.update(dt, { loopt: false, zit: k.staat === 'zit' || k.opBank, snelheid: KAT_LOOP });
      // rondkijken terwijl hij stilstaat
      if (!k.opBank) k.kat.groep.rotation.y += Math.sin(k.t * 0.7) * dt * 0.35;
      if (k.t > 0) continue;
      if (k.opBank) {
        // van de bank af en verder rondlopen
        k.opBank = false; pos.y = 0;
        k.doel = vrijPunt(); k.staat = 'loopt'; k.t = 20;
        continue;
      }
      // een op de vier keer springt hij op de bank
      if (Math.random() < 0.25) {
        k.opBank = true;
        const zp = BANK_ZIT.plek(Math.random());
        pos.set(zp.x, BANK_ZIT.y, zp.z);
        k.kat.groep.rotation.y = (ACHTERWAND ? 0 : Math.PI / 2) + (Math.random() - 0.5) * 0.5;
        k.staat = 'wacht';
        k.t = 14 + Math.random() * 24;
      } else {
        k.doel = vrijPunt(); k.staat = 'loopt'; k.t = 20;
      }
    }
  }

  /*
   ---------- dag en nacht ----------
   Er staan geen lampen in de scene: de helderheid zit in de materialen (zie
   bovenin). Wordt het buiten donker, dan gaat hier de plafondlamp aan — dat is
   dus geen licht dat schijnt, maar een andere tint over alle vlakken: binnen
   warm en iets gedempt, buiten blauw en veel donkerder. Precies wat je ziet als
   je 's avonds vanuit een verlichte kamer naar buiten kijkt.
  */
  const DAG_BINNEN = new THREE.Color(1, 1, 1);
  const NACHT_BINNEN = new THREE.Color(0.74, 0.63, 0.47);
  const DAG_BUITEN = new THREE.Color(1, 1, 1);
  const NACHT_BUITEN = new THREE.Color(0.17, 0.21, 0.32);
  const tinten = [];
  for (const [g, dag, nacht] of [[groep, DAG_BINNEN, NACHT_BINNEN], [buiten, DAG_BUITEN, NACHT_BUITEN]]) {
    const gezien = new Set();
    g.traverse(o => {
      const m = o.material;
      if (!m || !m.color || gezien.has(m)) return;
      gezien.add(m);
      tinten.push({ m, basis: m.color.clone(), dag, nacht });
    });
  }
  let nachtNu = null;
  function zetLicht(nacht) {
    if (nacht === nachtNu) return;
    nachtNu = nacht;
    for (const t of tinten) {
      // de lampenkap doet niet mee: die is 's avonds juist het felst
      /*
       De lampenkap doet niet mee met de tint: overdag is hij gewoon een kap van
       gebroken wit, 's avonds brandt hij. Dat verschil moet je kunnen zien —
       hij is dan het felste vlak in de kamer.
      */
      if (t.m === MAT.lamp) { t.m.color.setHex(nacht ? 0xfff6d2 : 0xd7d4cb); continue; }
      // en een tv die aanstaat is 's avonds juist het enige licht in de kamer
      if (t.m === MAT.tvBeeld && MAT.tvBeeld.map) continue;
      t.m.color.copy(t.basis).multiply(nacht ? t.nacht : t.dag);
    }
  }
  zetLicht(false);

  // ---------- botsingsdozen ----------
  // resetWorld() in de editor gooit alle colliders weg, dus main.js meldt ze na
  // een herbouw opnieuw aan (net als het gezelschap in js/verhaal.js).
  function meldAan() {
    for (const d of dozen) addCollider(NUL.x + d.x, NUL.z + d.z, d.hx, d.hz, 0, d.h);
  }
  meldAan();

  // ---------- naar binnen en naar buiten ----------
  const praatEl = document.getElementById('praat');
  const wereld = (x, z) => ({ x: NUL.x + x, z: NUL.z + z });
  const binnenDeur = wereld(DEUR_X, MUUR + 0.9);

  // Sta je in de kamer? Ruim om de plattegrond heen, dus ook in een deurgat.
  function binnen(x, z) {
    return x > NUL.x - 2 && x < NUL.x + BREED + 2 && z > NUL.z - 2 && z < NUL.z + DIEP + 2;
  }
  function bijDeur(x, z) {
    if (binnen(x, z)) return Math.hypot(x - binnenDeur.x, z - binnenDeur.z) < DEUR_BEREIK ? 'uit' : null;
    return Math.hypot(x - deurBuiten.x, z - deurBuiten.z) < DEUR_BEREIK ? 'in' : null;
  }

  function naarBinnenGaan() {
    player.inCar = null;
    player.pos.set(binnenDeur.x, 0, binnenDeur.z);
    player.yaw = Math.PI;                   // met de rug naar de deur, de kamer in
    player.pitch = 0;
    player.applyCamera();
  }
  function naarBuitenGaan() {
    player.inCar = null;
    if (player.zit) { player.zit = false; player.eye = player.eyeStaand; }
    const [ux, uz] = resolveCollisions(stoep.x, stoep.z, 0.4);
    player.pos.set(ux, 0, uz);
    player.yaw = Math.atan2(-plan.f[0], -plan.f[1]);    // de straat in kijken
    player.pitch = 0;
    player.applyCamera();
  }

  /*
   ---------- op de bank ----------
   De bank staat tegen de rechterwand, de tv aan de overkant. Ga je zitten, dan
   zak je naar zithoogte, kijk je naar de tv en blijf je zitten tot je weer op
   E drukt; rondkijken kan gewoon (zie `player.zit` in js/player.js).
  */
  const ZITHOOGTE = 1.05;
  const zitMid = pB((BANK_U0 + BANK_U1) / 2, 0.46);
  const zitPlek = wereld(zitMid.x, zitMid.z);
  const ZIT_BEREIK = 1.6;
  // en de stoel aan de tafel, met de rug naar het raam en het gezicht de kamer in
  const tafelPlek = wereld(TAFEL.x - 0.38, TAFEL.z - TAFEL.diep / 2 - 0.32);
  const TAFEL_BEREIK = 1.1;
  let zitWaar = null;                       // 'bank' of 'tafel', voor het opstaan
  function bijBank(x, z) {
    return binnen(x, z) && Math.hypot(x - zitPlek.x, z - zitPlek.z) < ZIT_BEREIK;
  }
  function bijTafel(x, z) {
    return binnen(x, z) && Math.hypot(x - tafelPlek.x, z - tafelPlek.z) < TAFEL_BEREIK;
  }
  function gaZitten() {
    player.pos.set(zitPlek.x, 0, zitPlek.z);
    player.eye = ZITHOOGTE;
    // naar de tv aan de overkant; die staat recht voor de bank, en waar dat is
    // hangt af van de wand waar de zithoek tegenaan staat
    player.yaw = ACHTERWAND ? 0 : Math.PI / 2;
    player.pitch = 0;
    player.zit = true;
    zitWaar = 'bank';
    player.applyCamera();
  }
  function aanTafel() {
    player.pos.set(tafelPlek.x, 0, tafelPlek.z);
    player.eye = ZITHOOGTE;
    player.yaw = Math.PI;                   // over de tafel heen de kamer in
    player.pitch = 0;
    player.zit = true;
    zitWaar = 'tafel';
    player.applyCamera();
  }
  function staOp() {
    const bij = zitWaar === 'tafel' ? tafelPlek : zitPlek;
    const kant = zitWaar === 'tafel' ? { x: 0, z: -0.9 }
      : (ACHTERWAND ? { x: 0, z: -1.0 } : { x: -1.0, z: 0 });
    player.zit = false;
    zitWaar = null;
    player.eye = player.eyeStaand;
    // een stap opzij, zodat je niet in de bank of de tafel blijft staan
    player.pos.set(bij.x + kant.x, 0, bij.z + kant.z);
    player.applyCamera();
  }

  /*
   ---------- het bier uit de eigen koelkast ----------
   Bij de Poiesz koop je een flesje (js/supermarkt.js); hier pak je er een, want
   het is je eigen huis. Zelfde leven erbij en dezelfde waas na een stuk of wat,
   zodat een flesje thuis net zo telt als een flesje in de winkel.
  */
  const BIER = { leven: 12, dronkenVanaf: 3, perFlesje: 0.34 };
  const koelPlek = KOELKAST ? wereld(KOELKAST.x0 + KOELKAST.breed + 0.55, KOELKAST.z0 + KOELKAST.lang / 2) : null;
  const KOEL_BEREIK = 1.3;
  let flesjes = 0, nuchterT = 0;
  function bijKoelkast(x, z) {
    return !!koelPlek && binnen(x, z) && Math.hypot(x - koelPlek.x, z - koelPlek.z) < KOEL_BEREIK;
  }
  function pakBier() {
    flesjes++; nuchterT = 60;
    player.health = Math.min(100, player.health + BIER.leven);
    if (hud && hud.zetLeven) hud.zetLeven(player.health);
    if (flesjes >= BIER.dronkenVanaf) {
      player.dronken = Math.min(1, (player.dronken || 0) + BIER.perFlesje);
      if (hud && hud.melding) hud.melding(`Flesje ${flesjes}`, 'Je begint het te voelen.', 2.5);
    } else if (hud && hud.melding) {
      hud.melding('Uit de koelkast', `Een flesje bier · ${BIER.leven} leven erbij.`, 2.5);
    }
    return true;
  }

  // E bij de deur of bij de bank. Geeft true als de toets gebruikt is, zodat
  // main.js hem niet ook nog als in- of uitstappen leest.
  function toets() {
    if (!player.active && !window.__autoplay) return false;
    if (player.zit) { staOp(); return true; }
    if (bijKoelkast(player.pos.x, player.pos.z)) return pakBier();
    if (bijTafel(player.pos.x, player.pos.z)) { aanTafel(); return true; }
    if (bijBank(player.pos.x, player.pos.z)) { gaZitten(); return true; }
    const w = bijDeur(player.pos.x, player.pos.z);
    if (w === 'in' && !player.inCar) { naarBinnenGaan(); return true; }
    if (w === 'uit') { naarBuitenGaan(); return true; }
    return false;
  }

  /*
   De hint bij de deur. `bezet` is waar als het verhaal de E-toets al nodig
   heeft (er staat iemand naast je of er loopt een gesprek); dan blijft de balk
   van het verhaal staan. De hint wordt alleen weer weggehaald als hij van deze
   module was, zodat de twee elkaar niet uitzetten.
  */
  let hintAan = false;
  function update(dt, bezet = false) {
    const bezig = player.active || window.__autoplay;
    // de lamp gaat aan zodra het buiten donker wordt
    if (sfeer) zetLicht(!!sfeer.nacht);
    if (katten.length) katUpdate(Math.min(dt, 0.1));
    // het beeld op de tv schuift door, en de telling van de flesjes loopt af
    if (MAT.tvBeeld.map) MAT.tvBeeld.map.offset.y = (MAT.tvBeeld.map.offset.y + dt * 0.035) % 1;
    if (nuchterT > 0) { nuchterT -= dt; if (nuchterT <= 0) flesjes = 0; }
    /*
     Bezet (gesprek, menu, pauze, of het verhaal dat zelf om E vraagt): ons
     eigen balkje weg, niet alleen de vlag — maar alleen het onze. Zet het
     verhaal er zijn eigen regel in ("E — praten", "E — de bom planten"), dan
     hoort die te blijven staan: de binnenruimtes worden ná het verhaal
     bijgewerkt en wisten hem anders elk beeld weer.
    */
    if (bezet) { if (hintAan) praatEl.hidden = true; hintAan = false; return; }
    let tekst = null;
    if (bezig && !player.inCar) {
      if (player.zit && binnen(player.pos.x, player.pos.z)) tekst = 'E — opstaan';
      else if (bijKoelkast(player.pos.x, player.pos.z)) tekst = 'E — een flesje uit de koelkast';
      else if (bijTafel(player.pos.x, player.pos.z)) tekst = 'E — aan tafel zitten';
      else if (bijBank(player.pos.x, player.pos.z)) tekst = 'E — op de bank zitten';
      else {
        const w = bijDeur(player.pos.x, player.pos.z);
        if (w) tekst = w === 'in' ? 'E — naar binnen' : 'E — naar buiten';
      }
    }
    if (tekst) {
      praatEl.textContent = tekst;
      praatEl.hidden = false;
      hintAan = true;
    } else if (hintAan) {
      praatEl.hidden = true;
      hintAan = false;
    }
  }

  /*
   Wat de HUD moet laten zien als je binnen bent: de straatnaam met het
   huisnummer, en de plek van de voordeur als middelpunt voor de kaart. Zo
   blijft de minikaart de Molenkrite tonen in plaats van de leegte om de kamer
   heen. Buiten levert dit null en verandert er niets.
  */
  function kaart(x, z) {
    if (!binnen(x, z)) return null;
    return { naam: `${HUIS.straat} ${HUIS.nr}`, punt: deurBuiten };
  }

  return {
    update, toets, binnen, meldAan, kaart, zetLicht, gaZitten, staOp,
    aanTafel, bijTafel, bijKoelkast, pakBier,
    // missie 9: is dit een van de drie woningen, wat kost hij, en staat de tv aan
    get stek() { return !!HUIS.stek; },
    get prijs() { return HUIS.prijs || 0; },
    get soort() { return HUIS.soort || null; },
    get beschrijving() { return HUIS.beschrijving || ''; },
    get tvAan() { return !!MAT.tvBeeld.map; },
    // wat er aan inrichting in deze kamer gepast heeft (npm run huistest)
    get inrichting() { return { ...inrichting, meshes: groep.children.length }; },
    get flesjes() { return flesjes; },
    get katten() { return katten.map(k => ({ x: k.kat.groep.position.x, y: k.kat.groep.position.y, z: k.kat.groep.position.z, staat: k.staat, opBank: k.opBank })); },
    get naam() { return `${HUIS.straat} ${HUIS.nr}`; },
    get nacht() { return nachtNu; },
    // de maten waar het om gaat, voor tools/verhaaltest.mjs
    get maten() {
      return {
        breed: BREED, diep: DIEP, hoogte: HOOGTE, banden: vakken,
        voordeur: { breed: DEUR_B, hoog: DEUR_H }, binnendeur: { breed: BINNENDEUR, hoog: BINNENDEUR_H },
        aanrecht: AANRECHT, bovenkast: [BOVENKAST_ONDER, BOVENKAST_BOVEN],
        bank: { breed: BANK_LANG, diep: BANK_DIEP, zitting: 0.46, rug: 0.85,
          ruimte: BANK_RUIMTE, hoek: HOEK_LANG, wand: ACHTERWAND ? 'achter' : 'rechts',
          // het zitvlak van de hele hoekbank, dus met de chaise longue erbij
          zitvlak: BANK_LANG * BANK_DIEP + HOEK_LANG * BANK_DIEP },
        tv: { breed: 1.28, hoog: 0.73, midden: 0.92, afstand: TV_AFSTAND },
        gang: HAL_BREED, keuken: { breed: KEUKEN.x1 - KEUKEN.x0, diep: KEUKEN.z1 - KEUKEN.z0 },
      };
    },
    get groep() { return groep; },
    get plekken() {
      return { nul: NUL, deurBuiten, deurBinnen: binnenDeur, stoep, keuken: KEUKEN, bank: zitPlek,
        tafel: wereld(TAFEL.x, TAFEL.z), stoel: tafelPlek, koelkast: koelPlek };
    },
  };
}
