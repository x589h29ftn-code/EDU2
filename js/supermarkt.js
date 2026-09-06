/*
 Binnen bij supermarkt Poiesz, De Dassenboarch 32 in IJlst.

 Dezelfde truc als bij de woning (js/interieur.js) en de boerderij
 (js/boerderij.js): het pand op de kaart is een holle 3D BAG-huls, dus de
 winkel staat als losse, dichte doos ruim buiten het kaartgebied. Loop je buiten
 naar de schuifdeuren en druk je op E, dan sta je binnen; bij de deur brengt E
 je weer buiten.

 De maten komen uit js/kaart.js (BGT en 3D BAG): het grondvlak is een L van
 45,7 bij 30,7 m met een zijvleugel, en de goot ligt op 4,63 m. Binnen hangt het
 plafond op 3,4 m — een supermarkt heeft een verlaagd plafond met daarboven de
 techniek, en dat past ruim onder die goot.

 De inrichting komt van de foto's van deze winkel (in de chat, 6 sep 2026):

   - vijf kassa's met lopende banden, vlak bij de ingang;
   - zeven dubbele schappenrijen met een oranje kopschot ("Extra voordeel") aan
     het eind van elk gangpad, precies zoals op de foto van de gangpaden;
   - de diepvriesafdeling rechts: blauwe wanddeuren met een blauwe fotobalk
     erboven, en eilanden met vrieskisten ervoor;
   - achterin de versbalie met de groene Poiesz-wand erboven, en de blauwe
     zuivelwand ernaast;
   - links de drankafdeling, met het bier waar je E op drukt;
   - vijf medewerkers in groen-oranje poloshirt met het logo, en klanten die
     door de gangpaden lopen.

 Bier: € 5 per flesje, tien levenspunten erbij. Vanaf het derde flesje wordt het
 beeld wazig (js/player.js `dronken`, js/hud.js `zetDronken`); dat zakt in een
 minuut weer weg.

 Het licht zit ook hier in de vlakken en niet in lampen — zie de uitleg bovenin
 js/interieur.js. Een supermarkt is van boven gelijkmatig verlicht, dus de
 schaduw is hier veel vlakker dan in de schuur: alles wat omhoog kijkt is licht,
 de zijkanten iets minder, en niets valt helemaal weg.
*/
import * as THREE from 'three';
import { KAART } from './kaartwereld.js';
import { addCollider, resolveCollisions } from './world.js';
import { plattegrond } from './interieur.js';
import { Persoon } from './persoon.js';
import { MAAT } from './lichaam.js';

const PAND = { type: 'poiesz' };

// ---------- maten (m) ----------
const MUUR = 0.30;
const PLAFOND = 3.40;
const DEUR_B = 4.20;          // de schuifdeuren onder de punt van de gevel
const DEUR_H = 2.40;
const DEUR_BEREIK = 4.0;
const UIT_VOOR = 3.0;         // zover voor de gevel kom je weer buiten
const BIER_BEREIK = 3.0;

// ---------- de handel ----------
export const BIER = { prijs: 5, leven: 10, dronkenVanaf: 3, perFlesje: 0.45 };

// ---------- huisstijl ----------
const KLEUR = {
  groen: '#43b02a', groenDonker: '#2f8a1c',
  oranje: '#ef7d00', oranjeDonker: '#c96300',
  blauw: '#1668b3', blauwDonker: '#10508c',
  wit: '#f4f5f3', schap: '#e6e8e7', plint: '#3a3d42',
};

// ---------- kleine texturehulpjes ----------
function doek(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
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

/*
 Het woordmerk, zoals het boven de ingang hangt: groene letters met de I in
 oranje, schuin tussen de andere door. Eén functie, want hij komt op de
 gevelband, op de borden binnen en op de shirts van de medewerkers terug.
*/
function tekenMerk(g, x, y, hoogte, groen = KLEUR.groen, oranje = KLEUR.oranje) {
  g.save();
  g.font = `bold ${Math.round(hoogte)}px Arial, sans-serif`;
  g.textBaseline = 'middle';
  const woord = 'POIESZ';
  const breed = [...woord].map(l => g.measureText(l).width);
  const totaal = breed.reduce((a, b) => a + b, 0);
  let lx = x - totaal / 2;
  for (let i = 0; i < woord.length; i++) {
    if (i === 2) {
      g.save();
      g.translate(lx + breed[i] / 2, y);
      g.rotate(-0.16);
      g.fillStyle = oranje; g.textAlign = 'center';
      g.fillText(woord[i], 0, 0);
      g.restore();
    } else {
      g.fillStyle = groen; g.textAlign = 'left';
      g.fillText(woord[i], lx, y);
    }
    lx += breed[i];
  }
  g.restore();
  return totaal;
}

// vloertegels van 60 cm, lichtbeige met een lichte voeg
function winkelvloer() {
  const S = 512, c = doek(S, S), g = c.getContext('2d');   // 512 px = 2,4 m
  const r = rnd(41);
  g.fillStyle = '#e7e2d6'; g.fillRect(0, 0, S, S);
  const t = S / 4;                                          // vier tegels van 60 cm
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    g.fillStyle = `rgba(0,0,0,${r() * 0.035})`;
    g.fillRect(i * t + 1, j * t + 1, t - 2, t - 2);
    g.fillStyle = `rgba(255,255,255,${r() * 0.05})`;
    g.fillRect(i * t + 2, j * t + 2, t - 6, 3);
  }
  g.strokeStyle = 'rgba(150,146,136,0.55)'; g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    g.beginPath(); g.moveTo(i * t, 0); g.lineTo(i * t, S); g.stroke();
    g.beginPath(); g.moveTo(0, i * t); g.lineTo(S, i * t); g.stroke();
  }
  return c;
}

// systeemplafond: witte platen van 60 cm in een licht raster, met tl-balken
function plafondplaat() {
  const S = 256, c = doek(S, S), g = c.getContext('2d');    // 256 px = 1,2 m
  g.fillStyle = '#f2f3f1'; g.fillRect(0, 0, S, S);
  g.strokeStyle = 'rgba(160,164,164,0.7)'; g.lineWidth = 3;
  for (const p of [0, S / 2, S]) {
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, S); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(S, p); g.stroke();
  }
  g.fillStyle = 'rgba(0,0,0,0.04)';
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) g.fillRect(i * S / 2 + 8, j * S / 2 + 8, S / 2 - 16, S / 2 - 16);
  return c;
}

/*
 Een schap vol pakken. Vier planken boven elkaar met daarop een rij pakken,
 dozen en flessen in de kleuren die je in een schap ziet: veel wit en karton met
 felle vlakken ertussen. 512 px = 2 m breed, 256 px = 1,6 m hoog.
*/
function schapvulling(seed = 1) {
  const B = 512, H = 256, c = doek(B, H), g = c.getContext('2d');
  const r = rnd(seed * 977 + 13);
  const tinten = ['#d8483a', '#e8901c', '#f0c419', '#2f7fbf', '#3aa03a', '#8e4bbf', '#e2e2de', '#f5efe0', '#c9502f', '#2f4f8a'];
  g.fillStyle = '#3e4247'; g.fillRect(0, 0, B, H);
  const planken = 4, ph = H / planken;
  for (let p = 0; p < planken; p++) {
    const y0 = p * ph;
    // de donkere achterwand van het schap
    g.fillStyle = '#4a4f55'; g.fillRect(0, y0, B, ph);
    let x = 2 + r() * 8;
    while (x < B - 6) {
      const w = 14 + r() * 34, h = ph * (0.55 + r() * 0.36);
      const kl = tinten[Math.floor(r() * tinten.length)];
      g.fillStyle = kl;
      g.fillRect(x, y0 + ph - h - 4, w, h);
      // etiket en dop
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.fillRect(x + 2, y0 + ph - h * 0.62, w - 4, h * 0.22);
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fillRect(x + w - 3, y0 + ph - h - 4, 3, h);
      x += w + 2 + r() * 3;
    }
    // de plank zelf, met het prijskaartjesrandje
    g.fillStyle = '#dfe1e0'; g.fillRect(0, y0 + ph - 5, B, 5);
    g.fillStyle = '#ffffff'; g.fillRect(0, y0 + ph - 4, B, 2);
    for (let x2 = 4; x2 < B; x2 += 46) { g.fillStyle = '#f6c800'; g.fillRect(x2, y0 + ph - 4, 22, 3); }
  }
  return c;
}

// de blauwe diepvriesdeur: glas met rijp, een blauw kader en pakken erachter
function vriesdeur() {
  const B = 256, H = 512, c = doek(B, H), g = c.getContext('2d');
  const r = rnd(555);
  g.fillStyle = '#8fa6b4'; g.fillRect(0, 0, B, H);
  // pakken achter het glas, vager naarmate ze lager staan
  for (let p = 0; p < 4; p++) {
    const y0 = 40 + p * (H - 60) / 4;
    let x = 12;
    while (x < B - 16) {
      const w = 18 + r() * 26, h = (H - 60) / 4 * (0.5 + r() * 0.3);
      g.fillStyle = ['#cfe0ea', '#e9eef2', '#bcd2e0', '#dfe8ee'][Math.floor(r() * 4)];
      g.fillRect(x, y0 + (H - 60) / 4 - h - 6, w, h);
      g.fillStyle = 'rgba(40,90,140,0.25)'; g.fillRect(x + 2, y0 + (H - 60) / 4 - h * 0.6, w - 4, h * 0.2);
      x += w + 3;
    }
    g.fillStyle = '#c7d3da'; g.fillRect(8, y0 + (H - 60) / 4 - 5, B - 16, 5);
  }
  // rijp en weerspiegeling over het glas
  g.fillStyle = 'rgba(255,255,255,0.22)';
  for (let i = 0; i < 260; i++) { const x = r() * B, y = r() * H; g.fillRect(x, y, 2 + r() * 5, 2 + r() * 3); }
  g.fillStyle = 'rgba(235,245,252,0.30)';
  g.beginPath(); g.moveTo(0, 0); g.lineTo(B * 0.45, 0); g.lineTo(0, H * 0.7); g.closePath(); g.fill();
  // het blauwe kader en de handgreep
  g.strokeStyle = KLEUR.blauw; g.lineWidth = 14; g.strokeRect(7, 7, B - 14, H - 14);
  g.fillStyle = '#c8ced2'; g.fillRect(B - 34, H * 0.34, 10, H * 0.32);
  return c;
}

// een gekoelde wand (zuivel): open vakken met flessen en pakken in koele tinten
function zuivelwand() {
  const B = 512, H = 256, c = doek(B, H), g = c.getContext('2d');
  const r = rnd(88);
  g.fillStyle = '#2f3f4a'; g.fillRect(0, 0, B, H);
  const planken = 4, ph = H / planken;
  for (let p = 0; p < planken; p++) {
    const y0 = p * ph;
    g.fillStyle = '#e8eef2'; g.fillRect(0, y0 + 4, B, ph - 10);
    let x = 3;
    while (x < B - 8) {
      const w = 12 + r() * 18, h = (ph - 12) * (0.6 + r() * 0.35);
      g.fillStyle = ['#ffffff', '#eaf2f7', '#f6e9c8', '#cfe4f2', '#f2f2ee'][Math.floor(r() * 5)];
      g.fillRect(x, y0 + ph - h - 8, w, h);
      g.fillStyle = ['#1668b3', '#43b02a', '#e8511f', '#2f4f8a'][Math.floor(r() * 4)];
      g.fillRect(x, y0 + ph - h * 0.55, w, h * 0.16);
      x += w + 2;
    }
    g.fillStyle = '#cfd6da'; g.fillRect(0, y0 + ph - 6, B, 6);
  }
  return c;
}

/*
 Het bierschap: kratten onderin en flessen op de planken erboven. Bruin glas,
 gele en rode etiketten — van dichtbij zie je dat het bier is, en dat is precies
 waar je hier op E drukt.
*/
function bierschap() {
  const B = 512, H = 256, c = doek(B, H), g = c.getContext('2d');
  const r = rnd(1907);
  g.fillStyle = '#40454a'; g.fillRect(0, 0, B, H);
  // twee planken flessen
  for (let p = 0; p < 2; p++) {
    const y0 = p * (H * 0.32);
    g.fillStyle = '#4c5157'; g.fillRect(0, y0, B, H * 0.32);
    for (let x = 4; x < B - 8; x += 15) {
      const h = H * 0.22 + r() * 8;
      g.fillStyle = ['#6b3a12', '#7d4515', '#5a3210', '#2f6b2a'][Math.floor(r() * 4)];
      g.fillRect(x, y0 + H * 0.30 - h, 12, h);
      g.fillStyle = ['#f2c200', '#e03127', '#f4f0e2', '#1668b3'][Math.floor(r() * 4)];
      g.fillRect(x, y0 + H * 0.30 - h * 0.55, 12, h * 0.26);
      g.fillStyle = '#c9a227'; g.fillRect(x + 2, y0 + H * 0.30 - h, 8, 5);
    }
    g.fillStyle = '#dfe1e0'; g.fillRect(0, y0 + H * 0.30, B, 5);
  }
  // kratten onderin
  for (let x = 2; x < B; x += 64) {
    for (let ry = 0; ry < 2; ry++) {
      const y = H * 0.66 + ry * (H * 0.17) - 4;
      g.fillStyle = ['#c8102e', '#1668b3', '#1d7a35'][Math.floor(r() * 3)];
      g.fillRect(x, y, 60, H * 0.16);
      g.fillStyle = 'rgba(0,0,0,0.30)';
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) g.fillRect(x + 6 + i * 13, y + 5 + j * 14, 9, 9);
      g.fillStyle = 'rgba(255,255,255,0.20)'; g.fillRect(x, y, 60, 3);
    }
  }
  return c;
}

// Een bord met tekst in een huisstijlkleur; `merk` zet er het woordmerk op.
function bord(tekst, achter, tekstKleur = '#ffffff', merk = false) {
  const B = 512, H = 128, c = doek(B, H), g = c.getContext('2d');
  g.fillStyle = achter; g.fillRect(0, 0, B, H);
  g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 0, B, 8);
  g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(0, H - 8, B, 8);
  if (merk) {
    tekenMerk(g, B / 2, H * 0.36, H * 0.42, '#ffffff', '#ffd08a');
    g.fillStyle = tekstKleur;
    g.font = `600 ${Math.round(H * 0.22)}px Arial, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(tekst, B / 2, H * 0.76);
  } else {
    g.fillStyle = tekstKleur;
    g.font = `bold ${Math.round(H * 0.54)}px Arial, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(tekst, B / 2, H * 0.54);
  }
  return c;
}

// het oranje kopschot aan het eind van een gangpad: "Extra voordeel"
function kopschot() {
  const B = 256, H = 512, c = doek(B, H), g = c.getContext('2d');
  g.fillStyle = KLEUR.oranje; g.fillRect(0, 0, B, H);
  g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(0, H - 26, B, 26);
  g.save();
  g.translate(B / 2, H * 0.5);
  g.rotate(-Math.PI / 2);
  g.fillStyle = '#ffffff';
  g.font = `bold ${Math.round(B * 0.30)}px Arial, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('Extra voordeel', 0, 0);
  g.restore();
  // het groene labeltje bovenaan, net als op de foto
  g.fillStyle = KLEUR.groen; g.fillRect(B * 0.12, 14, B * 0.76, H * 0.10);
  g.fillStyle = '#ffffff';
  g.font = `bold ${Math.round(B * 0.20)}px Arial, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('Extra', B / 2, 14 + H * 0.05);
  return c;
}

/*
 Het logo op de borst van een medewerker. Het zit op een eigen lapje van 22 bij
 8 cm dat vóór de romp hangt, en niet als texture op de romp zelf: die is uit
 drie dozen samengevoegd, en dan valt niet te zeggen welk stukje van de tekening
 op de borst uitkomt — de eerste poging gaf een medewerker met een wit shirt en
 groene mouwen.
*/
function borstlogo() {
  const B = 256, H = 96, c = doek(B, H), g = c.getContext('2d');
  g.fillStyle = KLEUR.groen; g.fillRect(0, 0, B, H);
  g.fillStyle = 'rgba(255,255,255,0.92)'; g.fillRect(4, 6, B - 8, H - 12);
  tekenMerk(g, B / 2, H / 2, H * 0.58);
  return c;
}

// de vloermat en de rubber band van een kassa
function loopband() {
  const B = 128, H = 256, c = doek(B, H), g = c.getContext('2d');
  g.fillStyle = '#2b2f33'; g.fillRect(0, 0, B, H);
  g.fillStyle = 'rgba(255,255,255,0.06)';
  for (let y = 0; y < H; y += 16) g.fillRect(0, y, B, 2);
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, 6, H); g.fillRect(B - 6, 0, 6, H);
  return c;
}

/**
 * De winkel. ctx = { scene, player, hud, verhaal }. Levert null als de Poiesz
 * niet in de kaartdata staat; dan doet de deur gewoon niets.
 */
export function initSupermarkt({ scene, player, hud, verhaal }) {
  if (!KAART || !KAART.panden) return null;
  const pand = KAART.panden.find(p => p.type === PAND.type);
  if (!pand || !pand.voet || !pand.rect || !pand.front) return null;

  const plan = plattegrond(pand);
  const BREED = Math.max(...plan.punten.map(q => q[0]));
  const DIEP = Math.max(...plan.punten.map(q => q[1]));
  /*
   Het grondvlak is een L: de winkelhal plus een smalle zijvleugel langs de
   rechterkant (het magazijn en de laad- en losplek). De hal zelf is de
   rechthoek tot aan die vleugel; daar wordt de winkel in gezet.
  */
  const HAL_B = Math.min(BREED, 41.6);

  // de schuifdeuren in het midden van de voorgevel, onder de punt van de kap
  const DEUR_X = HAL_B / 2;
  const deurBuiten = plan.naarWereld(DEUR_X, 0);
  const stoep = { x: deurBuiten.x + plan.f[0] * UIT_VOOR, z: deurBuiten.z + plan.f[1] * UIT_VOOR };

  // Ruim buiten het kaartgebied, en ver van de kamer en de boerderij vandaan.
  const G = KAART.gebied || { x1: 400, z1: 460 };
  const NUL = { x: G.x1 + 640, z: G.z1 + 900 };

  const groep = new THREE.Group();
  groep.position.set(NUL.x, 0, NUL.z);
  scene.add(groep);

  /*
   Licht in de vlakken. Een supermarkt hangt vol tl-bakken, dus het licht komt
   recht van boven en er zijn nauwelijks slagschaduwen: wat omhoog kijkt is het
   lichtst, de zijkanten iets minder, en de onderkanten blijven ook zichtbaar.
  */
  const nrm = new THREE.Vector3();
  function vlakKleur(nx, ny, nz) {
    return Math.min(1, 0.62 + 0.30 * Math.max(0, ny) + 0.10 * Math.abs(nx) + 0.08 * Math.abs(nz)
      + 0.10 * Math.max(0, -ny));
  }

  // ---------- materialen ----------
  const vlak = (c, rx, ry) => new THREE.MeshBasicMaterial({ map: texture(c, rx, ry), vertexColors: true, fog: false });
  const plat = (kleur) => new THREE.MeshBasicMaterial({ color: kleur, vertexColors: true, fog: false });
  const MAT = {
    vloer: vlak(winkelvloer(), 1, 1),
    plafond: vlak(plafondplaat(), 1, 1),
    muur: plat(0xeceeed),
    schap: plat(KLEUR.schap),
    plint: plat(KLEUR.plint),
    vulling: vlak(schapvulling(1), 1, 1),
    vulling2: vlak(schapvulling(7), 1, 1),
    vries: vlak(vriesdeur(), 1, 1),
    zuivel: vlak(zuivelwand(), 1, 1),
    bier: vlak(bierschap(), 1, 1),
    kopschot: vlak(kopschot(), 1, 1),
    band: vlak(loopband(), 1, 1),
    groen: plat(KLEUR.groen),
    oranje: plat(KLEUR.oranje),
    blauw: plat(KLEUR.blauw),
    wit: plat(KLEUR.wit),
    staal: plat(0xb6bbbe),
    glas: new THREE.MeshBasicMaterial({ color: 0xcfe0ea, transparent: true, opacity: 0.35, vertexColors: true, fog: false, side: THREE.DoubleSide }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xfffbee, fog: false }),
    bordGroen: vlak(bord('VERS', KLEUR.groen, '#ffffff', true), 1, 1),
    bordBlauw: vlak(bord('ZUIVEL', KLEUR.blauw), 1, 1),
    bordVries: vlak(bord('DIEPVRIES', KLEUR.blauw), 1, 1),
    bordBier: vlak(bord('BIER', KLEUR.groen), 1, 1),
    bordKassa: vlak(bord('KASSA', KLEUR.groen), 1, 1),
  };

  // ---------- bouwstenen: alles per materiaal samenvoegen ----------
  const bakken = new Map();
  const dozen = [];             // botsingsdozen, in meldAan() aangemeld
  function bak(mat) {
    let b = bakken.get(mat);
    if (!b) { b = { pos: [], uv: [], nor: [], col: [] }; bakken.set(mat, b); }
    return b;
  }
  function voegGeo(mat, geo) {
    const b = bak(mat);
    const pos = geo.getAttribute('position'), nor = geo.getAttribute('normal'), uv = geo.getAttribute('uv');
    const idx = geo.getIndex();
    const zet = (i) => {
      b.pos.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      const nx = nor ? nor.getX(i) : 0, ny = nor ? nor.getY(i) : 1, nz = nor ? nor.getZ(i) : 0;
      b.nor.push(nx, ny, nz);
      const f = vlakKleur(nx, ny, nz);
      b.col.push(f, f, f);
      b.uv.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
    };
    if (idx) for (let i = 0; i < idx.count; i++) zet(idx.getX(i));
    else for (let i = 0; i < pos.count; i++) zet(i);
    geo.dispose();
  }
  /*
   Een doos van hoek tot hoek. `uvm` is het aantal meters per herhaling van de
   texture; per zijvlak wordt de uv op de echte maat gezet, anders wordt een
   schap van vier meter breed één uitgerekt pak.
  */
  function doos(x0, x1, z0, z1, y0, y1, mat, { uvm = 0, uvVast = null, botst = true } = {}) {
    const w = x1 - x0, h = y1 - y0, d = z1 - z0;
    if (w <= 0 || h <= 0 || d <= 0) return;
    const geo = new THREE.BoxGeometry(w, h, d);
    if (uvVast) {
      // een bord: de hele tekening past precies op het vlak, eventueel een paar
      // keer naast elkaar op een lange band
      const uv = geo.getAttribute('uv');
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvVast[0], uv.getY(i) * uvVast[1]);
      uv.needsUpdate = true;
    } else if (uvm) {
      const uv = geo.getAttribute('uv');
      const maten = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
      for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
        const k = f * 4 + i;
        uv.setXY(k, uv.getX(k) * maten[f][0] / uvm, uv.getY(k) * maten[f][1] / uvm);
      }
      uv.needsUpdate = true;
    }
    geo.translate(x0 + w / 2, y0 + h / 2, z0 + d / 2);
    voegGeo(mat, geo);
    if (botst) dozen.push({ x: x0 + w / 2, z: z0 + d / 2, hx: w / 2, hz: d / 2, h: y1 });
  }
  // een plat vlak (vloer of plafond)
  function vloerVlak(x0, x1, z0, z1, y, mat, omhoog = true, uvm = 0) {
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    geo.rotateX(omhoog ? -Math.PI / 2 : Math.PI / 2);
    if (uvm) {
      const uv = geo.getAttribute('uv');
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0) / uvm, uv.getY(i) * (z1 - z0) / uvm);
      uv.needsUpdate = true;
    }
    geo.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
    voegGeo(mat, geo);
  }

  // ---------- vloer, plafond en wanden ----------
  vloerVlak(0, BREED, 0, DIEP, 0, MAT.vloer, true, 2.4);
  vloerVlak(0, BREED, 0, DIEP, PLAFOND, MAT.plafond, false, 1.2);
  // buitenwanden rondom de hele L
  doos(-MUUR, BREED + MUUR, -MUUR, 0, 0, PLAFOND + 0.3, MAT.muur);
  doos(-MUUR, BREED + MUUR, DIEP, DIEP + MUUR, 0, PLAFOND + 0.3, MAT.muur);
  doos(-MUUR, 0, 0, DIEP, 0, PLAFOND + 0.3, MAT.muur);
  doos(BREED, BREED + MUUR, 0, DIEP, 0, PLAFOND + 0.3, MAT.muur);
  // de wand tussen de winkelhal en de zijvleugel (magazijn), met een klapdeur
  doos(HAL_B, HAL_B + 0.2, 0, DIEP * 0.62, 0, PLAFOND, MAT.muur);
  doos(HAL_B, HAL_B + 0.2, DIEP * 0.62 + 2.4, DIEP, 0, PLAFOND, MAT.muur);
  doos(HAL_B - 0.05, HAL_B + 0.25, DIEP * 0.62, DIEP * 0.62 + 2.4, 0, 2.3, MAT.staal, { botst: false });

  // tl-balken aan het plafond, in de lengterichting van de gangpaden
  for (let x = 3; x < HAL_B - 1; x += 4.6) {
    doos(x, x + 0.28, 1.6, DIEP - 1.6, PLAFOND - 0.10, PLAFOND - 0.02, MAT.lamp, { botst: false });
  }

  // ---------- de schuifdeuren en de entree ----------
  const dx0 = DEUR_X - DEUR_B / 2, dx1 = DEUR_X + DEUR_B / 2;
  // glazen pui naast de deuren, over de hele voorgevel
  doos(0.1, dx0 - 0.1, -0.02, 0.06, 0.25, 2.6, MAT.glas, { botst: false });
  doos(dx1 + 0.1, HAL_B - 0.1, -0.02, 0.06, 0.25, 2.6, MAT.glas, { botst: false });
  for (let x = 1.2; x < HAL_B - 0.4; x += 2.2) {
    if (x > dx0 - 0.4 && x < dx1 + 0.4) continue;
    doos(x, x + 0.09, -0.04, 0.08, 0, 2.7, MAT.staal, { botst: false });
  }
  // de deuren zelf staan open naar de zijkanten toe
  doos(dx0, dx0 + 0.9, -0.03, 0.07, 0.1, DEUR_H, MAT.glas, { botst: false });
  doos(dx1 - 0.9, dx1, -0.03, 0.07, 0.1, DEUR_H, MAT.glas, { botst: false });
  doos(dx0 - 0.12, dx1 + 0.12, -0.05, 0.09, DEUR_H, DEUR_H + 0.55, MAT.groen, { botst: false });
  doos(dx0 - 0.10, dx1 + 0.10, -0.06, -0.05, DEUR_H + 0.02, DEUR_H + 0.52, MAT.bordGroen, { uvVast: [1, 1], botst: false });

  // winkelwagens in het halletje, links van de deur
  for (let i = 0; i < 3; i++) {
    const x = dx1 + 1.2 + i * 1.15;
    doos(x, x + 0.62, 1.0, 2.6, 0.25, 1.02, MAT.staal);
    doos(x, x + 0.62, 1.0, 1.1, 1.02, 1.10, MAT.staal, { botst: false });
  }
  // bloemen en planten bij de ingang, rechts (zoals op de foto)
  for (let i = 0; i < 4; i++) {
    const x = dx0 - 1.4 - i * 1.25;
    doos(x, x + 1.0, 1.1, 1.9, 0.65, 0.72, MAT.schap);
    doos(x + 0.05, x + 0.95, 1.15, 1.85, 0.72, 1.15, i % 2 ? MAT.groen : MAT.oranje, { botst: false });
  }

  // ---------- de kassa's ----------
  /*
   Vijf kassa's met een lopende band, haaks op de voorgevel: je loopt er tussen
   de balies door naar buiten. De band is een donker rubber vlak in een grijze
   bak, met de kassazuil aan het eind en het nummerbordje erboven.
  */
  const KASSA = { n: 5, x0: 4.4, stap: 3.1, z0: 4.6, z1: 8.2, hoog: 0.94 };
  const kassaPlekken = [];
  for (let i = 0; i < KASSA.n; i++) {
    const x = KASSA.x0 + i * KASSA.stap;
    doos(x, x + 1.15, KASSA.z0, KASSA.z1, 0, KASSA.hoog, MAT.schap);
    doos(x + 0.06, x + 1.09, KASSA.z0 + 0.06, KASSA.z1 - 0.06, KASSA.hoog, KASSA.hoog + 0.03, MAT.band, { uvm: 1.2, botst: false });
    // de kassazuil met scherm, aan de kant van de uitgang
    doos(x + 0.1, x + 1.05, KASSA.z0 - 0.75, KASSA.z0 - 0.05, 0, 1.02, MAT.schap);
    doos(x + 0.25, x + 0.9, KASSA.z0 - 0.62, KASSA.z0 - 0.3, 1.02, 1.42, MAT.plint, { botst: false });
    // het bordje met het kassanummer boven de baan
    doos(x + 0.2, x + 1.0, KASSA.z1 - 0.4, KASSA.z1 - 0.32, 2.15, 2.55, MAT.bordKassa, { uvVast: [1, 1], botst: false });
    doos(x + 0.57, x + 0.63, KASSA.z1 - 0.4, KASSA.z1 - 0.34, 2.55, PLAFOND, MAT.staal, { botst: false });
    kassaPlekken.push({ x: x + 0.55, z: KASSA.z0 - 1.35 });
  }
  // de afscheiding tussen de kassa's en de winkel
  doos(KASSA.x0 - 1.5, KASSA.x0 - 1.42, KASSA.z0, KASSA.z1 + 1.2, 0, 1.05, MAT.staal);

  // ---------- de gangpaden ----------
  /*
   Zeven dubbele schappenrijen in de lengterichting van de winkel, met tussen
   elk paar een gangpad van 2,7 m. Elke rij is een plint met vier planken
   erboven; aan het eind van elke rij een oranje kopschot.
  */
  const RIJ = { n: 7, x0: 5.2, stap: 3.9, breed: 1.25, z0: 10.4, z1: 24.6 };
  const gangX = [];
  for (let i = 0; i < RIJ.n; i++) {
    const x = RIJ.x0 + i * RIJ.stap;
    const mat = i % 2 ? MAT.vulling2 : MAT.vulling;
    doos(x, x + RIJ.breed, RIJ.z0, RIJ.z1, 0, 0.18, MAT.plint);
    doos(x, x + RIJ.breed, RIJ.z0, RIJ.z1, 0.18, 1.85, mat, { uvm: 2.0 });
    doos(x - 0.02, x + RIJ.breed + 0.02, RIJ.z0, RIJ.z1, 1.85, 1.95, MAT.schap, { botst: false });
    // het oranje kopschot aan beide einden
    doos(x, x + RIJ.breed, RIJ.z0 - 0.9, RIJ.z0, 0, 1.95, MAT.kopschot, { uvVast: [1, 1] });
    doos(x, x + RIJ.breed, RIJ.z1, RIJ.z1 + 0.9, 0, 1.95, MAT.kopschot, { uvVast: [1, 1] });
    if (i < RIJ.n - 1) gangX.push(x + RIJ.breed + (RIJ.stap - RIJ.breed) / 2);
  }
  // actiebakken in het brede pad voor de schappen
  for (let i = 0; i < 4; i++) {
    const x = 7 + i * 5.2;
    doos(x, x + 1.3, 9.0, 10.0, 0, 0.85, MAT.oranje);
    doos(x + 0.08, x + 1.22, 9.08, 9.92, 0.85, 1.05, MAT.vulling, { uvm: 1.2, botst: false });
  }

  // ---------- de diepvriesafdeling, rechts ----------
  const VRIES_X = HAL_B - 0.35;
  doos(VRIES_X - 0.9, VRIES_X, 9.5, 24.0, 0, 2.15, MAT.vries, { uvm: 1.4 });
  doos(VRIES_X - 0.95, VRIES_X, 9.5, 24.0, 2.15, 3.05, MAT.bordVries, { uvVast: [4, 1], botst: false });
  // twee eilanden met vrieskisten ervoor
  for (const z of [11.5, 18.0]) {
    doos(VRIES_X - 4.4, VRIES_X - 1.9, z, z + 5.0, 0, 0.70, MAT.staal);
    doos(VRIES_X - 4.4, VRIES_X - 1.9, z, z + 5.0, 0.70, 0.78, MAT.blauw, { botst: false });   // de blauwe rand
    doos(VRIES_X - 4.25, VRIES_X - 2.05, z + 0.15, z + 4.85, 0.62, 0.80, MAT.zuivel, { uvm: 1.4, botst: false });
    doos(VRIES_X - 4.3, VRIES_X - 2.0, z + 0.1, z + 4.9, 0.80, 0.86, MAT.glas, { botst: false });
    doos(VRIES_X - 4.45, VRIES_X - 1.85, z + 2.3, z + 2.6, 1.55, 2.05, MAT.bordBlauw, { uvVast: [1, 1], botst: false });
  }

  // ---------- achterin: de versbalie en de zuivelwand ----------
  const ACHTER = DIEP - 0.35;
  // de groene wand met het woordmerk boven de balie
  doos(3.0, 14.0, ACHTER - 0.12, ACHTER, 2.05, 3.15, MAT.bordGroen, { uvVast: [2, 1], botst: false });
  doos(3.0, 14.0, ACHTER - 0.9, ACHTER, 0, 1.05, MAT.schap);
  doos(3.0, 14.0, ACHTER - 1.75, ACHTER - 0.9, 0, 0.98, MAT.schap);          // de toonbank zelf
  doos(3.05, 13.95, ACHTER - 1.72, ACHTER - 0.93, 0.98, 1.42, MAT.glas, { botst: false });
  doos(3.05, 13.95, ACHTER - 1.70, ACHTER - 0.95, 0.98, 1.16, MAT.vulling2, { uvm: 1.0, botst: false });
  // de blauwe zuivelwand ernaast
  doos(16.0, 30.0, ACHTER - 0.85, ACHTER, 0, 2.05, MAT.zuivel, { uvm: 2.0 });
  doos(16.0, 30.0, ACHTER - 0.9, ACHTER, 2.05, 2.95, MAT.bordBlauw, { uvVast: [4, 1], botst: false });

  // ---------- links: de drankafdeling met het bier ----------
  const BIER_X = 0.35;
  doos(BIER_X, BIER_X + 0.95, 11.0, 19.0, 0, 2.05, MAT.bier, { uvm: 2.0 });
  doos(BIER_X, BIER_X + 1.0, 11.0, 19.0, 2.05, 2.95, MAT.bordBier, { uvVast: [2, 1], botst: false });
  // een stapel kratten ervoor
  for (let i = 0; i < 3; i++) {
    doos(BIER_X + 1.3, BIER_X + 1.9, 12.4 + i * 0.05, 12.8 + i * 0.05, i * 0.32, i * 0.32 + 0.30, MAT.oranje, { botst: i === 0 });
  }
  const bierPlek = { x: BIER_X + 2.4, z: 15.0 };

  // ---------- de mensen ----------
  /*
   Vijf medewerkers en vier klanten. De medewerkers dragen het groene shirt met
   het oranje schouderstuk en het logo — dat is een texture op de romp, want de
   armen blijven gewoon groen. Ze lopen een vaste ronde; niemand hoeft hier te
   zoeken, dus een lijst punten is genoeg.
  */
  const logoTex = texture(borstlogo(), 1, 1);
  const logoGeo = new THREE.BoxGeometry(0.22, 0.08, 0.012);
  const lopers = [];
  function maakPersoon({ x, z, yaw = 0, personeel = false, kleur = 0x2b4f8a, hoogte = 1.0 }) {
    const p = new Persoon({
      shirt: personeel ? 0x43b02a : kleur,
      vest: personeel ? 0xef7d00 : null,             // het oranje schort
      broek: personeel ? 0x2b2f33 : [0x24303f, 0x3a3226, 0x4a4a52, 0x2f3a2a][Math.floor(Math.random() * 4)],
      huid: Math.random() < 0.5 ? 0xd9b48f : 0xc79a72,
      haar: [0x2a1d12, 0x6b5842, 0x1c1c1c, 0x8a6a3a][Math.floor(Math.random() * 4)],
      hoogte,
    });
    /*
     De poppetjes zijn van MeshStandardMaterial en hangen dus aan de zon buiten;
     binnen zouden ze 's avonds wegvallen terwijl de winkel wél licht blijft.
     Een beetje eigen gloed houdt ze zichtbaar, net als de vaste helderheid van
     de vlakken hierboven. Zie ook js/boerderij.js.
    */
    p.groep.traverse(o => {
      if (!o.material || !o.material.color) return;
      o.material = o.material.clone();
      o.material.emissive = new THREE.Color(o.material.color).multiplyScalar(0.55);
      o.castShadow = false; o.receiveShadow = false;
    });
    // het logo op de borst; de romp zelf blijft gewoon groen
    if (personeel) {
      const lap = new THREE.Mesh(logoGeo, new THREE.MeshStandardMaterial({
        map: logoTex, roughness: 0.9, emissive: new THREE.Color(0x888888),
      }));
      // net vóór het schort, dat zelf 0,245 m diep is
      lap.position.set(0, MAAT.romp + 0.09, -0.131);
      p.groep.add(lap);
    }
    p.zetNeer(NUL.x + x, NUL.z + z, yaw);
    scene.add(p.groep);
    return p;
  }
  function maakLoper(opties, punten, snelheid = 1.05) {
    const p = maakPersoon(opties);
    lopers.push({ p, punten: punten.map(q => ({ x: NUL.x + q[0], z: NUL.z + q[1] })), i: 0, snelheid, wacht: 0 });
    return p;
  }

  const gang = (i) => gangX[Math.min(gangX.length - 1, i)];
  // medewerkers
  const kassiere = maakPersoon({ x: kassaPlekken[1].x + 0.9, z: kassaPlekken[1].z + 0.4, yaw: Math.PI, personeel: true });
  const balie = maakPersoon({ x: 8.5, z: ACHTER - 0.6, yaw: 0, personeel: true });
  maakLoper({ x: gang(1), z: 12, personeel: true }, [[gang(1), 11.5], [gang(1), 23.5], [gang(2), 23.5], [gang(2), 11.5]], 0.95);
  maakLoper({ x: VRIES_X - 6, z: 14, personeel: true }, [[VRIES_X - 6.2, 11.0], [VRIES_X - 6.2, 23.0], [VRIES_X - 2.0, 23.0], [VRIES_X - 2.0, 11.0]], 1.0);
  maakLoper({ x: 20, z: 9.4, personeel: true }, [[6.0, 9.4], [30.0, 9.4], [30.0, 26.5], [6.0, 26.5]], 1.15);
  // klanten
  maakLoper({ x: gang(0), z: 15 }, [[gang(0), 11.0], [gang(0), 23.8], [gang(3), 23.8], [gang(3), 11.0]], 0.9);
  maakLoper({ x: gang(4), z: 20 }, [[gang(4), 23.5], [gang(4), 11.2], [gang(5), 11.2], [gang(5), 23.5]], 1.0);
  maakLoper({ x: 18, z: 27 }, [[17.0, 27.5], [29.0, 27.5], [29.0, 9.6], [17.0, 9.6]], 0.85);
  maakLoper({ x: 4, z: 16, hoogte: 0.96 }, [[3.6, 20.0], [3.6, 12.0], [gang(0), 12.0], [gang(0), 20.0]], 0.95);

  // ---------- botsingsdozen ----------
  function meldAan() {
    for (const d of dozen) addCollider(NUL.x + d.x, NUL.z + d.z, d.hx, d.hz, 0, d.h);
  }
  meldAan();

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

  // ---------- naar binnen en naar buiten ----------
  const praatEl = document.getElementById('praat');
  const wereld = (x, z) => ({ x: NUL.x + x, z: NUL.z + z });
  const binnenDeur = wereld(DEUR_X, 2.2);
  const bier = wereld(bierPlek.x, bierPlek.z);

  function binnen(x, z) {
    return x > NUL.x - 4 && x < NUL.x + BREED + 4 && z > NUL.z - 4 && z < NUL.z + DIEP + 4;
  }
  function bijDeur(x, z) {
    if (binnen(x, z)) return Math.hypot(x - binnenDeur.x, z - binnenDeur.z) < DEUR_BEREIK ? 'uit' : null;
    return Math.hypot(x - deurBuiten.x, z - deurBuiten.z) < DEUR_BEREIK ? 'in' : null;
  }
  function bijBier(x, z) {
    return binnen(x, z) && Math.hypot(x - bier.x, z - bier.z) < BIER_BEREIK;
  }
  function naarBinnenGaan() {
    player.inCar = null;
    player.pos.set(binnenDeur.x, 0, binnenDeur.z);
    player.yaw = Math.PI;                 // met de rug naar de deur, de winkel in
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
   Een flesje bier kopen en meteen opdrinken. Levert 'ok' of 'arm'. Het derde
   flesje en verder maakt je dronken: `player.dronken` loopt op en zakt in een
   minuut weer weg (js/player.js).
  */
  /*
   Hoeveel flesjes je op hebt. Dat telt niet eeuwig door: heb je een minuut lang
   niets meer gedronken, dan begint de telling opnieuw. Anders zou je een half
   uur later, allang weer nuchter, van één flesje meteen weer scheef lopen.
  */
  let flesjes = 0, nuchterT = 0;
  function koop() {
    if (!verhaal.betaal || !verhaal.betaal(BIER.prijs)) {
      hud.melding('Te weinig geld', `Een flesje kost € ${BIER.prijs}.`, 3);
      return 'arm';
    }
    flesjes++;
    nuchterT = 60;
    player.health = Math.min(100, player.health + BIER.leven);
    hud.zetLeven(player.health);
    if (flesjes >= BIER.dronkenVanaf) {
      player.dronken = Math.min(1, player.dronken + BIER.perFlesje);
      hud.melding(`Flesje ${flesjes}`, 'Je begint het te voelen.', 2.5);
    } else {
      hud.melding('Biertje', `€ ${BIER.prijs} betaald · ${BIER.leven} leven erbij.`, 2.5);
    }
    return 'ok';
  }

  // E bij de deur of bij het bier. Geeft true als de toets gebruikt is.
  function toets() {
    if (!player.active && !window.__autoplay) return false;
    if (bijBier(player.pos.x, player.pos.z)) { koop(); return true; }
    const w = bijDeur(player.pos.x, player.pos.z);
    if (w === 'in' && !player.inCar) { naarBinnenGaan(); return true; }
    if (w === 'uit') { naarBuitenGaan(); return true; }
    return false;
  }

  let hintAan = false;
  function update(dt, bezet = false) {
    const bezig = player.active || window.__autoplay;
    if (nuchterT > 0) { nuchterT -= dt; if (nuchterT <= 0) flesjes = 0; }
    const hier = binnen(player.pos.x, player.pos.z);
    // De mensen lopen alleen rond als je binnen bent: buiten zie je ze niet, en
    // dan hoeft er ook niets bewogen te worden.
    if (hier) {
      for (const l of lopers) {
        const pos = l.p.groep.position;
        const doel = l.punten[l.i];
        const dx = doel.x - pos.x, dz = doel.z - pos.z;
        const d = Math.hypot(dx, dz);
        if (l.wacht > 0) {
          l.wacht -= dt;
          l.p.update(dt, { loopt: false });
          continue;
        }
        if (d < 0.4) {
          l.i = (l.i + 1) % l.punten.length;
          l.wacht = 0.8 + Math.random() * 2.6;      // even bij het schap blijven staan
          l.p.update(dt, { loopt: false });
          continue;
        }
        const stap = Math.min(d, l.snelheid * dt);
        pos.x += dx / d * stap; pos.z += dz / d * stap;
        l.p.draaiNaar(Math.atan2(-dx, -dz), dt, 5);
        l.p.update(dt, { loopt: true, snelheid: l.snelheid });
      }
      kassiere.kijkNaar(player.pos.x, player.pos.z, dt, 2.0);
      balie.kijkNaar(player.pos.x, player.pos.z, dt, 2.0);
    }
    kassiere.update(dt, { loopt: false });
    balie.update(dt, { loopt: false });
    // de waas van het bier volgt de speler, ook buiten de winkel
    hud.zetDronken(player.dronken);

    if (bezet) { hintAan = false; return; }
    let tekst = null;
    if (bezig && !player.inCar) {
      if (bijBier(player.pos.x, player.pos.z)) {
        tekst = `E — flesje bier kopen (€ ${BIER.prijs})`;
      } else {
        const w = bijDeur(player.pos.x, player.pos.z);
        if (w) tekst = w === 'in' ? 'E — de Poiesz in' : 'E — naar buiten';
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

  // Wat de HUD laat zien als je binnen bent.
  function kaart(x, z) {
    if (!binnen(x, z)) return null;
    return { naam: 'Poiesz IJlst', punt: deurBuiten };
  }

  return {
    update, toets, binnen, meldAan, kaart, koop,
    get flesjes() { return flesjes; },
    get maten() {
      return {
        breed: BREED, diep: DIEP, hal: HAL_B, plafond: PLAFOND,
        deur: { breed: DEUR_B, hoog: DEUR_H },
        kassas: KASSA.n, rijen: RIJ.n, mensen: lopers.length + 2,
        bier: { ...BIER },
      };
    },
    get groep() { return groep; },
    get mensen() { return [kassiere, balie, ...lopers.map(l => l.p)]; },
    get plekken() { return { nul: NUL, deurBuiten, deurBinnen: binnenDeur, stoep, bier, kassas: kassaPlekken }; },
    get winkels() { return [{ x: deurBuiten.x, z: deurBuiten.z, naam: 'Poiesz IJlst', wat: 'bier' }]; },
  };
}
