/*
 Binnen bij Tinga State, de stelpboerderij op Molenkrite 115.

 Zelfde truc als bij de woning in js/interieur.js: het pand op de kaart is een
 holle 3D BAG-huls, dus de ruimte staat als losse, dichte doos ruim buiten het
 kaartgebied. Loop je buiten naar de schuurdeur en druk je op E, dan sta je
 binnen; bij de deur brengt E je weer buiten.

 De maten komen uit js/kaart.js (BGT en 3D BAG):

   - het grondvlak is bijna een rechthoek van 27,9 bij 19,1 m — de deel van een
     stelpboerderij, één grote open ruimte;
   - de goot ligt op 1,94 m en de nok op 13,32 m, dus de kap staat onder ruim
     vijftig graden. Dat is die steile piramidekap van de foto, en binnen zie je
     hem van onderen: vier schuine vlakken die op een nokbalk samenkomen.

 Binnen staat een toonbank met een verkoper. Voor € 50 verkoopt hij honderd
 kogels; het geld gaat van je portemonnee af (js/verhaal.js) en de kogels komen
 bij je reserve (js/player.js).

 Het licht zit ook hier in de vlakken en niet in lampen — zie de uitleg bovenin
 js/interieur.js.
*/
import * as THREE from 'three';
import { KAART } from './kaartwereld.js';
import { addCollider, resolveCollisions } from './world.js';
import { plattegrond, banden } from './interieur.js';
import { Persoon } from './persoon.js';

const PAND = { straat: 'Molenkrite', nr: '115', type: 'tinga_state' };

// ---------- maten (m) ----------
const MUUR = 0.30;         // de gemetselde buitenwand van een schuur
const DEUR_B = 3.00;       // de zwarte schuurdeur van de foto
const DEUR_H = 1.85;
const DEUR_BEREIK = 4.5;   // zo dicht bij de deur werkt E; een schuurdeur is breed
const UIT_VOOR = 3.0;      // zover voor de gevel kom je weer buiten
const TOONBANK_H = 1.05;
const TOONBANK_BEREIK = 3.2;

// ---------- de handel ----------
export const MUNITIE = { prijs: 50, kogels: 100 };

// ---------- kleine texturehulpjes ----------
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

// Betonvloer met krassen en olievlekken: 256 px staat voor 2,4 m.
function beton() {
  const c = doek(256, 256), g = c.getContext('2d');
  const r = rnd(31);
  g.fillStyle = '#8e8b84'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const t = r();
    g.fillStyle = `rgba(${t < 0.5 ? '120,116,108' : '168,164,156'},${0.10 + r() * 0.18})`;
    g.fillRect(r() * 256, r() * 256, 1 + r() * 3, 1 + r() * 3);
  }
  for (let i = 0; i < 5; i++) {                       // krimpvoegen
    const y = 40 + i * 44;
    g.fillStyle = 'rgba(70,68,64,0.5)'; g.fillRect(0, y, 256, 1);
  }
  for (let i = 0; i < 7; i++) {                       // vlekken
    const x = r() * 256, y = r() * 256, s = 10 + r() * 34;
    g.fillStyle = `rgba(72,68,62,${0.05 + r() * 0.10})`;
    g.beginPath(); g.ellipse(x, y, s, s * 0.7, r() * 3, 0, 6.283); g.fill();
  }
  return c;
}

// Gekalkte baksteen aan de binnenkant: 256 px = 2,4 m, dus lagen van 7 cm.
function schuursteen() {
  const c = doek(256, 256), g = c.getContext('2d');
  const r = rnd(77);
  g.fillStyle = '#b9ab99'; g.fillRect(0, 0, 256, 256);
  const H = 8, B = 24;
  for (let y = 0, i = 0; y < 256; y += H, i++) {
    const off = (i % 2) * (B / 2);
    for (let x = -B; x < 256; x += B) {
      const t = 0.90 + r() * 0.20;
      g.fillStyle = `rgba(${Math.round(190 * t)},${Math.round(176 * t)},${Math.round(158 * t)},1)`;
      g.fillRect(x + off + 1, y + 1, B - 2, H - 2);
    }
    g.fillStyle = 'rgba(150,142,130,0.55)'; g.fillRect(0, y, 256, 1);
  }
  return c;
}

// De onderkant van de kap: donkere dakbeschot met de panlatten erdoorheen.
function beschot() {
  const c = doek(256, 256), g = c.getContext('2d');
  const r = rnd(5);
  g.fillStyle = '#6d5740'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 16) {
    const t = 0.85 + r() * 0.3;
    g.fillStyle = `rgba(${Math.round(140 * t)},${Math.round(112 * t)},${Math.round(82 * t)},1)`;
    g.fillRect(0, y, 256, 15);
    g.fillStyle = 'rgba(20,14,8,0.45)'; g.fillRect(0, y + 15, 256, 1);
  }
  for (let x = 20; x < 256; x += 64) {                // panlatten dwars
    g.fillStyle = 'rgba(38,28,18,0.55)'; g.fillRect(x, 0, 6, 256);
  }
  return c;
}

// Ruw vurenhout voor de toonbank en de stellingen: 256 px = 1,2 m.
function ruwhout() {
  const c = doek(256, 256), g = c.getContext('2d');
  const r = rnd(19);
  g.fillStyle = '#a98a5f'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    const t = 0.88 + r() * 0.24;
    g.fillStyle = `rgba(${Math.round(175 * t)},${Math.round(140 * t)},${Math.round(96 * t)},1)`;
    g.fillRect(0, y, 256, 31);
    for (let k = 0; k < 18; k++) {
      g.fillStyle = `rgba(110,82,50,${0.06 + r() * 0.12})`;
      g.fillRect(r() * 256, y + 2 + r() * 27, 20 + r() * 90, 1);
    }
    g.fillStyle = 'rgba(70,52,30,0.35)'; g.fillRect(0, y + 31, 256, 1);
  }
  return c;
}

/*
 ctx = { scene, player, hud, verhaal }
 Levert null als de boerderij niet in de kaart staat; dan doet de deur niets.
*/
export function initBoerderij({ scene, player, hud, verhaal }) {
  if (!KAART || !KAART.panden) return null;
  const pand = KAART.panden.find(p => p.type === PAND.type)
    || KAART.panden.find(p => p.straat === PAND.straat && (p.nr || []).includes(PAND.nr));
  if (!pand || !pand.voet || !pand.rect || !pand.front) return null;

  const plan = plattegrond(pand);
  const vakken = banden(plan.punten);
  if (!vakken.length) return null;
  /*
   Het grondvlak is bijna een rechthoek met aan de kopse kanten twee ondiepe
   inspringingen van zo'n 70 cm. De vloer en de wanden volgen de echte contour;
   voor de kap en voor het plaatsen van de inrichting is de omhullende rechthoek
   handiger, want daar past de piramidekap netjes op.
  */
  const BREED = Math.max(...plan.punten.map(q => q[0]));
  const DIEP = Math.max(...plan.punten.map(q => q[1]));
  const GOOT = Math.max(1.8, pand.goot || 1.94);
  const NOK = Math.max(GOOT + 3, pand.nok || 13.32);

  // de schuurdeur midden in de voorgevel
  const DEUR_X = BREED / 2;
  const deurBuiten = plan.naarWereld(DEUR_X, 0);
  const stoep = { x: deurBuiten.x + plan.f[0] * UIT_VOOR, z: deurBuiten.z + plan.f[1] * UIT_VOOR };

  // Ruim buiten het kaartgebied, en ver genoeg van de kamer in js/interieur.js
  // vandaan dat de twee elkaar nooit raken.
  const G = KAART.gebied || { x1: 400, z1: 460 };
  const NUL = { x: G.x1 + 640, z: G.z1 + 540 };

  const groep = new THREE.Group();
  groep.position.set(NUL.x, 0, NUL.z);
  scene.add(groep);

  // ---------- licht in de vlakken ----------
  // Licht valt binnen door de open deur (S1) en door de dakramen in de kap (S2,
  // schuin van boven). Zie de uitleg in js/interieur.js.
  const S1 = new THREE.Vector3(0.15, 0.35, -1).normalize();
  const S2 = new THREE.Vector3(-0.4, 1, 0.25).normalize();
  const nrm = new THREE.Vector3();
  function schaduw(geo) {
    const n = geo.getAttribute('normal');
    const kleur = new Float32Array(n.count * 3);
    for (let i = 0; i < n.count; i++) {
      nrm.set(n.getX(i), n.getY(i), n.getZ(i));
      const f = Math.min(1, 0.38 + 0.30 * Math.max(0, nrm.dot(S1)) + 0.30 * Math.max(0, nrm.dot(S2))
        + 0.14 * Math.max(0, nrm.y) + 0.16 * Math.max(0, -nrm.y));
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
    vloer: vlak(beton(), BREED / 2.4, DIEP / 2.4),
    muur: vlak(schuursteen(), 6, 1),
    // de kap zie je van binnen, dus dubbelzijdig: dan valt hij ook niet weg
    // als een vlak per ongeluk andersom staat
    kap: new THREE.MeshBasicMaterial({ map: texture(beschot(), 6, 4), vertexColors: true, fog: false, side: THREE.DoubleSide }),
    hout: vlak(ruwhout(), 3, 1),
    balk: plat(0x54402c),
    deur: plat(0x1d1e21),
    blad: plat(0x6b4c2e),
    metaal: plat(0x8d939a),
    doos: plat(0xa8794a),
    kist: plat(0x7d6242),
    hooi: plat(0xcbb267),
    kassa: plat(0x2a2d33),
    bord: plat(0xe9e4d8),
    licht: new THREE.MeshBasicMaterial({ color: 0xfff2cf, side: THREE.DoubleSide, fog: false }),
  };

  const dozen = [];        // {x,z,hx,hz,h} – in meldAan() bij de wereld aangemeld

  // ---------- bouwstenen ----------
  function doos(x0, x1, z0, z1, y0, y1, mat, botst = true) {
    const w = x1 - x0, d = z1 - z0, h = y1 - y0;
    if (w <= 0 || d <= 0 || h <= 0) return null;
    const m = new THREE.Mesh(schaduw(new THREE.BoxGeometry(w, h, d)), mat);
    m.position.set(x0 + w / 2, y0 + h / 2, z0 + d / 2);
    groep.add(m);
    if (botst) dozen.push({ x: m.position.x, z: m.position.z, hx: w / 2, hz: d / 2, h: y1 });
    return m;
  }
  function vloerVlak(x0, x1, z0, z1, y, mat, omhoog = true) {
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    geo.rotateX(omhoog ? -Math.PI / 2 : Math.PI / 2);
    const m = new THREE.Mesh(schaduw(geo), mat);
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    groep.add(m);
    return m;
  }
  // Een los vlak uit hoekpunten, voor de schuine dakvlakken. De volgorde
  // bepaalt welke kant de normaal op wijst; hier moet dat naar binnen zijn.
  function vlakUit(punten, mat) {
    const geo = new THREE.BufferGeometry();
    const pos = [];
    for (let i = 1; i + 1 < punten.length; i++) {
      pos.push(...punten[0], ...punten[i], ...punten[i + 1]);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    // uv's uit x en z, zodat het beschot in meters blijft kloppen
    const uv = [];
    for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] / 4, (pos[i + 1] + pos[i + 2]) / 4);
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const m = new THREE.Mesh(schaduw(geo), mat);
    groep.add(m);
    return m;
  }

  // ---------- vloer ----------
  // per band een vlak, dus precies het grondvlak uit de kaart
  for (const v of vakken) vloerVlak(v.x0, v.x1, v.z0, v.z1, 0, MAT.vloer);

  // ---------- buitenmuren tot de goot ----------
  /*
   Elke zijde van het grondvlak wordt een wand die naar binnen toe dik is,
   dezelfde aanpak als in js/interieur.js. Alleen de voorgevel krijgt een gat:
   de zwarte schuurdeur.
  */
  const opp = plan.punten.reduce((s, q, i) => {
    const n = plan.punten[(i + 1) % plan.punten.length];
    return s + q[0] * n[1] - n[0] * q[1];
  }, 0);
  const naarBinnen = opp > 0 ? 1 : -1;
  const DEUR = { van: DEUR_X - DEUR_B / 2, tot: DEUR_X + DEUR_B / 2 };

  for (let i = 0; i < plan.punten.length; i++) {
    const a = plan.punten[i], b = plan.punten[(i + 1) % plan.punten.length];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const lang = Math.hypot(dx, dz);
    if (lang < 0.2) continue;
    const nx = -dz / lang * naarBinnen, nz = dx / lang * naarBinnen;
    if (Math.abs(dx) > Math.abs(dz)) {
      const z = (a[1] + b[1]) / 2;
      const bij = nz > 0 ? z : z - MUUR;
      const van = Math.min(a[0], b[0]) - MUUR, tot = Math.max(a[0], b[0]) + MUUR;
      if (z < 0.2 && van < DEUR.van && tot > DEUR.tot) {      // de voorgevel met de deur
        doos(van, DEUR.van, bij, bij + MUUR, 0, GOOT, MAT.muur);
        doos(DEUR.tot, tot, bij, bij + MUUR, 0, GOOT, MAT.muur);
        doos(DEUR.van, DEUR.tot, bij, bij + MUUR, DEUR_H, GOOT, MAT.muur, false);
        /*
         De schuurdeur zelf zit dicht, net als de voordeur in js/interieur.js.
         Dat is niet alleen netter — de deel staat ruim buiten het kaartgebied,
         dus door een open deur keek je zo de lege groene vlakte in.
        */
        doos(DEUR.van, DEUR.tot, bij + MUUR - 0.06, bij + MUUR, 0, DEUR_H, MAT.deur);
        // de twee schuifdelen: een lichte naad in het midden en de rails erboven
        doos(DEUR_X - 0.02, DEUR_X + 0.02, bij + MUUR - 0.07, bij + MUUR + 0.01, 0, DEUR_H, MAT.metaal, false);
        doos(DEUR.van - 0.2, DEUR.tot + 0.2, bij + MUUR - 0.09, bij + MUUR - 0.03,
          DEUR_H, DEUR_H + 0.09, MAT.metaal, false);
      } else {
        doos(van, tot, bij, bij + MUUR, 0, GOOT, MAT.muur);
      }
    } else {
      const x = (a[0] + b[0]) / 2;
      const bij = nx > 0 ? x : x - MUUR;
      const van = Math.min(a[1], b[1]) - MUUR, tot = Math.max(a[1], b[1]) + MUUR;
      doos(bij, bij + MUUR, van, tot, 0, GOOT, MAT.muur);
    }
  }

  // ---------- de kap van binnen ----------
  /*
   Een piramidekap over de omhullende rechthoek: van de goot rondom omhoog naar
   een nokbalk in het midden. Bij gelijke dakhellingen springt de nok aan beide
   kopse kanten een halve diepte in, dus hij loopt van DIEP/2 tot BREED-DIEP/2
   op de halve diepte. Dat geeft twee lange schuine vlakken en twee schilden op
   de kop. Aan de kopse kanten steekt hij een halve meter over het grondvlak
   heen — dat is het overstek waar op de foto het terras onder ligt.
  */
  const zm = DIEP / 2;
  const nokA = [DIEP / 2, NOK, zm];
  const nokB = [BREED - DIEP / 2, NOK, zm];
  const hoek = {
    lv: [0, GOOT, 0], rv: [BREED, GOOT, 0],
    la: [0, GOOT, DIEP], ra: [BREED, GOOT, DIEP],
  };
  // de volgorde loopt zo dat de normaal naar binnen wijst: dat is de kant waar
  // je hem vandaan ziet, en waar het licht in de hoekpunten op gerekend wordt
  vlakUit([nokB, nokA, hoek.lv, hoek.rv], MAT.kap);      // voorschild
  vlakUit([nokA, nokB, hoek.ra, hoek.la], MAT.kap);      // achterschild
  vlakUit([nokA, hoek.la, hoek.lv], MAT.kap);            // kopschild links
  vlakUit([nokB, hoek.rv, hoek.ra], MAT.kap);            // kopschild rechts

  // gebinten: drie zware balken over de breedte met een spantbeen erop
  for (const x of [DIEP / 2, BREED / 2, BREED - DIEP / 2]) {
    doos(x - 0.14, x + 0.14, MUUR, DIEP - MUUR, GOOT + 1.6, GOOT + 1.9, MAT.balk, false);
    doos(x - 0.11, x + 0.11, zm - 0.11, zm + 0.11, GOOT + 1.9, NOK - 0.6, MAT.balk, false);
  }
  // nokbalk
  doos(nokA[0], nokB[0], zm - 0.13, zm + 0.13, NOK - 0.34, NOK - 0.06, MAT.balk, false);
  /*
   De rij dakramen van de foto, van binnen gezien: lichtvlakken die precies in
   het voorschild liggen. De helling volgt uit de kap zelf — een schuin vlak op
   de gok gaat er als een losse plaat in de lucht uitzien.
  */
  const helling = Math.atan2(zm, NOK - GOOT);       // draai om x die het vlak op het dakvlak legt
  for (let i = 0; i < 5; i++) {
    const x = DIEP / 2 + 1.5 + i * (BREED - DIEP - 3) / 4;
    for (const t of [0.42, 0.66]) {                 // twee rijen boven elkaar
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0), MAT.licht);
      m.position.set(x, GOOT + t * (NOK - GOOT) + 0.02, t * zm + 0.03);
      m.rotation.set(helling, 0, 0);
      groep.add(m);
    }
  }

  // ---------- de toonbank ----------
  // Links van de deur als je binnenkomt, met de verkoper erachter.
  const BANK = {
    x0: DEUR_X - 5.6, x1: DEUR_X - 1.4,
    z0: 6.2, z1: 6.9,
  };
  doos(BANK.x0, BANK.x1, BANK.z0, BANK.z1, 0, TOONBANK_H, MAT.hout);
  doos(BANK.x0 - 0.06, BANK.x1 + 0.06, BANK.z0 - 0.06, BANK.z1 + 0.06,
    TOONBANK_H, TOONBANK_H + 0.05, MAT.blad, false);
  // kassa op de bank
  doos(BANK.x1 - 0.9, BANK.x1 - 0.35, BANK.z0 + 0.15, BANK.z1 - 0.1, TOONBANK_H + 0.05, TOONBANK_H + 0.32, MAT.kassa, false);
  // rek met dozen munitie achter de bank
  const REK = { x0: BANK.x0, x1: BANK.x1, z: BANK.z1 + 1.5 };
  for (const y of [0.9, 1.5]) {
    doos(REK.x0, REK.x1, REK.z, REK.z + 0.45, y, y + 0.06, MAT.hout, false);
    for (let x = REK.x0 + 0.15; x < REK.x1 - 0.35; x += 0.5) {
      doos(x, x + 0.34, REK.z + 0.06, REK.z + 0.38, y + 0.06, y + 0.30, MAT.doos, false);
    }
  }
  for (const x of [REK.x0, REK.x1 - 0.1]) doos(x, x + 0.1, REK.z, REK.z + 0.45, 0, 2.0, MAT.hout);
  // bordje boven de bank
  doos(BANK.x0 + 0.6, BANK.x0 + 2.6, BANK.z1 + 1.35, BANK.z1 + 1.40, 1.72, 2.02, MAT.bord, false);

  // ---------- de rest van de deel ----------
  // Stellingen langs de linkerwand, pallets en hooibalen achterin: genoeg om
  // te zien dat je in een schuur staat, en meteen de botsingsdozen ervoor.
  const wandX = MUUR;
  for (let z = 2.2; z < DIEP - 3.5; z += 3.0) {
    doos(wandX, wandX + 0.9, z, z + 2.2, 0, 0.08, MAT.hout);
    for (const y of [0.75, 1.35]) doos(wandX, wandX + 0.9, z, z + 2.2, y, y + 0.08, MAT.hout, false);
    for (const y of [0.08, 0.83]) {
      doos(wandX + 0.1, wandX + 0.7, z + 0.2, z + 0.9, y, y + 0.55, MAT.kist, false);
      doos(wandX + 0.1, wandX + 0.7, z + 1.2, z + 1.9, y, y + 0.5, MAT.doos, false);
    }
    doos(wandX + 0.85, wandX + 0.9, z, z + 0.1, 0, 1.9, MAT.metaal);
  }
  // hooibalen achterin, in twee lagen
  for (let i = 0; i < 6; i++) {
    const x = BREED - 7.5 + (i % 3) * 1.35;
    const z = DIEP - 3.4 - Math.floor(i / 3) * 0.95;
    doos(x, x + 1.25, z, z + 0.85, 0, 0.7, MAT.hooi);
    if (i % 3 !== 1) doos(x + 0.1, x + 1.15, z + 0.05, z + 0.8, 0.7, 1.4, MAT.hooi, false);
  }

  // ---------- de verkoper ----------
  const verkoper = new Persoon({ shirt: 0x4a5f3a, broek: 0x3a3226, huid: 0xd9b48f, haar: 0x6b5842, pet: true, petKleur: 0x2e3a24 });
  /*
   De poppetjes zijn van MeshStandardMaterial en hangen dus aan de zon buiten;
   binnen zou hij 's nachts helemaal wegvallen terwijl de schuur wél licht
   blijft. Een beetje eigen gloed in het materiaal houdt hem zichtbaar, net als
   de vaste helderheid van de vlakken hierboven.
  */
  verkoper.groep.traverse(o => {
    if (!o.material || !o.material.color) return;
    o.material = o.material.clone();
    o.material.emissive = new THREE.Color(o.material.color).multiplyScalar(0.55);
    o.castShadow = false; o.receiveShadow = false;
  });
  verkoper.zetNeer(NUL.x + (BANK.x0 + BANK.x1) / 2, NUL.z + BANK.z1 + 0.7, 0);
  verkoper.yaw = 0;
  verkoper.groep.rotation.y = 0;
  scene.add(verkoper.groep);

  // ---------- botsingsdozen ----------
  function meldAan() {
    for (const d of dozen) addCollider(NUL.x + d.x, NUL.z + d.z, d.hx, d.hz, 0, d.h);
  }
  meldAan();

  // ---------- naar binnen en naar buiten ----------
  const praatEl = document.getElementById('praat');
  const wereld = (x, z) => ({ x: NUL.x + x, z: NUL.z + z });
  const binnenDeur = wereld(DEUR_X, MUUR + 1.6);
  const bankVoor = wereld((BANK.x0 + BANK.x1) / 2, BANK.z0 - 0.8);

  function binnen(x, z) {
    return x > NUL.x - 4 && x < NUL.x + BREED + 4 && z > NUL.z - 4 && z < NUL.z + DIEP + 4;
  }
  function bijDeur(x, z) {
    if (binnen(x, z)) return Math.hypot(x - binnenDeur.x, z - binnenDeur.z) < DEUR_BEREIK ? 'uit' : null;
    return Math.hypot(x - deurBuiten.x, z - deurBuiten.z) < DEUR_BEREIK ? 'in' : null;
  }
  function bijToonbank(x, z) {
    return binnen(x, z) && Math.hypot(x - bankVoor.x, z - bankVoor.z) < TOONBANK_BEREIK;
  }

  function naarBinnenGaan() {
    player.inCar = null;
    player.pos.set(binnenDeur.x, 0, binnenDeur.z);
    player.yaw = Math.PI;                  // met de rug naar de deur, de deel in
    player.pitch = 0;
    player.applyCamera();
  }
  function naarBuitenGaan() {
    player.inCar = null;
    const [ux, uz] = resolveCollisions(stoep.x, stoep.z, 0.4);
    player.pos.set(ux, 0, uz);
    player.yaw = Math.atan2(-plan.f[0], -plan.f[1]);
    player.pitch = 0;
    player.applyCamera();
  }

  /*
   Munitie kopen. Levert 'ok', 'arm' (te weinig geld) of 'vol' (je reserve zit
   al aan het maximum). Ook los aan te roepen vanuit de proef.
  */
  const MAX_RESERVE = 600;
  function koop() {
    if (player.reserve >= MAX_RESERVE) {
      hud.melding('Je tas zit vol', `Meer dan ${MAX_RESERVE} kogels krijg je er niet in.`, 3);
      return 'vol';
    }
    if (!verhaal.betaal || !verhaal.betaal(MUNITIE.prijs)) {
      hud.melding('Te weinig geld', `Een doos van ${MUNITIE.kogels} kogels kost € ${MUNITIE.prijs}.`, 3);
      return 'arm';
    }
    player.reserve = Math.min(MAX_RESERVE, player.reserve + MUNITIE.kogels);
    hud.melding(`${MUNITIE.kogels} kogels gekocht`, `€ ${MUNITIE.prijs} betaald bij Tinga State.`, 3);
    return 'ok';
  }

  // E bij de deur of aan de toonbank. Geeft true als de toets gebruikt is.
  function toets() {
    if (!player.active && !window.__autoplay) return false;
    if (bijToonbank(player.pos.x, player.pos.z)) { koop(); return true; }
    const w = bijDeur(player.pos.x, player.pos.z);
    if (w === 'in' && !player.inCar) { naarBinnenGaan(); return true; }
    if (w === 'uit') { naarBuitenGaan(); return true; }
    return false;
  }

  let hintAan = false;
  function update(dt, bezet = false) {
    const bezig = player.active || window.__autoplay;
    // de verkoper kijkt op zodra je binnen staat
    if (bezig && binnen(player.pos.x, player.pos.z)) verkoper.kijkNaar(player.pos.x, player.pos.z, dt, 2.2);
    verkoper.update(dt, { loopt: false });
    if (bezet) { hintAan = false; return; }
    let tekst = null;
    if (bezig && !player.inCar) {
      if (bijToonbank(player.pos.x, player.pos.z)) {
        tekst = `E — ${MUNITIE.kogels} kogels kopen (€ ${MUNITIE.prijs})`;
      } else {
        const w = bijDeur(player.pos.x, player.pos.z);
        if (w) tekst = w === 'in' ? 'E — de boerderij in' : 'E — naar buiten';
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

  // Wat de HUD laat zien als je binnen bent: de naam van de boerderij, met de
  // schuurdeur als middelpunt voor de minikaart.
  function kaart(x, z) {
    if (!binnen(x, z)) return null;
    return { naam: 'Tinga State', punt: deurBuiten };
  }

  return {
    update, toets, binnen, meldAan, kaart, koop,
    get maten() {
      return {
        breed: BREED, diep: DIEP, goot: GOOT, nok: NOK,
        deur: { breed: DEUR_B, hoog: DEUR_H },
        toonbank: { hoog: TOONBANK_H, breed: BANK.x1 - BANK.x0, diep: BANK.z1 - BANK.z0 },
        munitie: { ...MUNITIE },
      };
    },
    get groep() { return groep; },
    get verkoper() { return verkoper; },
    get plekken() { return { nul: NUL, deurBuiten, deurBinnen: binnenDeur, stoep, toonbank: bankVoor }; },
    // voor het winkelicoontje op de kaart (js/hud.js): waar de schuurdeur zit
    get winkels() { return [{ x: deurBuiten.x, z: deurBuiten.z, naam: 'Tinga State', wat: 'munitie' }]; },
  };
}
