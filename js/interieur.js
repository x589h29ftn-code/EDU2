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
import { HOUSE_STYLES } from './textures.js';
import { addCollider, resolveCollisions } from './world.js';

const HUIS = { straat: 'Molenkrite', nr: '15' };

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
function plattegrond(p) {
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
  return { punten, gevel, f, r, naarWereld };
}

/*
 De plattegrond in banden van voor naar achter: per diepte-interval de strook
 die binnen het pand ligt. Bij Molenkrite 15 zijn dat twee banden — het brede
 voorhuis en de smallere aanbouw — en dat is precies wat de kamer nodig heeft.
*/
function banden(punten) {
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
 ctx = { scene, player }
 Levert null als er geen kaartdata is of het huisnummer er niet in staat; dan
 doet de voordeur gewoon niets.
*/
export function initInterieur({ scene, player }) {
  if (!KAART || !KAART.panden) return null;
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
  const NUL = { x: (KAART.gebied ? KAART.gebied.x1 : 400) + 520, z: (KAART.gebied ? KAART.gebied.z1 : 460) + 520 };

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
  const MAT = {
    muur: plat(0xf3f0ea),
    plafond: plat(0xfdfcfa),
    plint: plat(0xf8f7f3),
    kozijn: plat(0xfafaf7),
    // de ruit is dicht: hij krijgt geen hoekpuntlicht, maar staat gewoon aan
    ruit: new THREE.MeshBasicMaterial({ color: 0xe6f2fb, fog: false }),
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
    tvBeeld: new THREE.MeshBasicMaterial({ color: 0x121a24, fog: false }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xfff4d8, side: THREE.DoubleSide, fog: false }),
    snoer: plat(0x33332f),
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

  // ---------- de bank ----------
  // Drie-zits tegen de rechterwand: 2,10 breed, 0,90 diep, zitting op 44 cm,
  // leuningen op 62 en de rug op 85 cm.
  const bankZ = (HAL.z1 + voorhuis.z1) / 2 - 0.4;
  {
    const x1 = BREED - MUUR - 0.04, x0 = x1 - 0.90;
    const z0 = bankZ - 1.05, z1 = bankZ + 1.05;
    doos(x0, x1, z0, z1, 0.10, 0.36, MAT.stof);                    // onderbak
    doos(x0 + 0.10, x1, z0 + 0.10, z1 - 0.10, 0.36, 0.44, MAT.stof, false);   // zitkussens
    doos(x1 - 0.20, x1, z0, z1, 0.36, 0.85, MAT.stofRug, false);   // rugleuning
    doos(x0, x1 - 0.18, z0, z0 + 0.16, 0.36, 0.62, MAT.stofRug, false);
    doos(x0, x1 - 0.18, z1 - 0.16, z1, 0.36, 0.62, MAT.stofRug, false);
    for (const zz of [z0 + 0.12, z1 - 0.16]) for (const xx of [x0 + 0.06, x1 - 0.12]) {
      doos(xx, xx + 0.06, zz, zz + 0.06, 0, 0.10, MAT.poot, false);
    }
  }

  // ---------- de tv ----------
  // Dressoir van 1,60 x 0,40 x 0,45 tegen de linkerwand, met een scherm van 55
  // duim (1,24 x 0,72) erop; het beeld zit dan op 1,05 m, op ooghoogte vanaf de
  // bank aan de overkant.
  {
    const x0 = MUUR + 0.03, x1 = x0 + 0.40;
    const z0 = bankZ - 0.80, z1 = bankZ + 0.80;
    doos(x0, x1, z0, z1, 0.06, 0.45, MAT.tvKast);
    doos(x0, x1 - 0.02, z0 + 0.03, z1 - 0.03, 0.30, 0.32, MAT.tvRand, false);   // schapje
    const zm = (z0 + z1) / 2;
    doos(x0 + 0.14, x0 + 0.20, zm - 0.22, zm + 0.22, 0.45, 0.50, MAT.tvRand, false);  // voet
    doos(x0 + 0.15, x0 + 0.20, zm - 0.62, zm + 0.62, 0.50, 1.22, MAT.tvRand, false);  // kast
    doos(x0 + 0.20, x0 + 0.21, zm - 0.60, zm + 0.60, 0.52, 1.20, MAT.tvBeeld, false); // beeld
  }

  // ---------- het keukenblok ----------
  // Eén rij tegen de zijwand van de aanbouw: onderkasten van 60 cm diep met een
  // werkblad op 90 cm, wandtegels tot 1,45 en bovenkasten van 1,45 tot 2,15.
  if (KEUKEN.z1 - KEUKEN.z0 > 2) {
    const x0 = KEUKEN.x0, z0 = KEUKEN.z0 + 0.30, z1 = KEUKEN.z1 - 0.25;
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
    const [ux, uz] = resolveCollisions(stoep.x, stoep.z, 0.4);
    player.pos.set(ux, 0, uz);
    player.yaw = Math.atan2(-plan.f[0], -plan.f[1]);    // de straat in kijken
    player.pitch = 0;
    player.applyCamera();
  }

  // E bij de deur. Geeft true als de toets gebruikt is, zodat main.js hem niet
  // ook nog als in- of uitstappen leest.
  function toets() {
    if (!player.active && !window.__autoplay) return false;
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
    if (bezet) { hintAan = false; return; }
    const w = (bezig && !player.inCar) ? bijDeur(player.pos.x, player.pos.z) : null;
    if (w) {
      praatEl.textContent = w === 'in' ? 'E — naar binnen' : 'E — naar buiten';
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
    update, toets, binnen, meldAan, kaart,
    // de maten waar het om gaat, voor tools/verhaaltest.mjs
    get maten() {
      return {
        breed: BREED, diep: DIEP, hoogte: HOOGTE, banden: vakken,
        voordeur: { breed: DEUR_B, hoog: DEUR_H }, binnendeur: { breed: BINNENDEUR, hoog: BINNENDEUR_H },
        aanrecht: AANRECHT, bovenkast: [BOVENKAST_ONDER, BOVENKAST_BOVEN],
        bank: { breed: 2.10, diep: 0.90, zitting: 0.44, rug: 0.85 },
        tv: { breed: 1.20, hoog: 0.68, midden: 0.86 },
        gang: HAL_BREED, keuken: { breed: KEUKEN.x1 - KEUKEN.x0, diep: KEUKEN.z1 - KEUKEN.z0 },
      };
    },
    get groep() { return groep; },
    get plekken() { return { nul: NUL, deurBuiten, deurBinnen: binnenDeur, stoep, keuken: KEUKEN }; },
  };
}
