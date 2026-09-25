/*
 Het pistool in beeld, met de hand eromheen.

 Het hing er eerst als een paar blokjes bij: een slede, een kolf, een vuistje en
 een mouw. Van dichtbij — en in de eerste persoon kijk je er de hele tijd tegenaan —
 zag je dat het geen wapen was maar een stapeltje dozen. Dit is hetzelfde formaat
 (een 9 mm van 19 cm lang, 13 cm hoog) maar dan met de onderdelen die een pistool
 werkelijk heeft: een slede met grepen aan de achterkant en een uitwerpopening,
 een loop die er aan de voorkant net uitsteekt, een onderstel met stofkap, een
 trekkerbeugel met de trekker erin, een greep met ribbels, en een magazijn dat er
 los in zit — want dat moet er bij het herladen uit kunnen vallen.

 De hand is geen vuist meer: een handpalm achter de greep, vier vingers die er
 omheen vouwen, een duim langs de kast en een wijsvinger aan de trekker. De
 onderarm loopt vanuit de rechteronderhoek van het beeld naar de pols.

 Het herladen is een echte beweging in vijf stappen (magazijn los, eruit, nieuw
 erin, slede overhalen, terug in de aanslag); `update` krijgt de voortgang mee en
 zet elk beeld de onderdelen op hun plek. De geluiden hangen aan diezelfde
 voortgang, zodat de klik altijd valt op het moment dat je hem ziet gebeuren.

 Datzelfde `update` doet ook de twee houdingen die er later bij kwamen: over het
 vizier kijken (`mik`, zie MIK hieronder — de korrel en de keep komen dan
 werkelijk op het midden van het scherm te liggen) en wegbergen bij het wisselen
 van wapen (`holster`).

 Ronde van 24 sep 2026 ("kan je de wapens realistischer maken qua uiterlijk en
 textures, ook animatie van de wapens"):

 - Geen scherpe dozen meer maar afgeronde: elke rand heeft een straal van een
   paar millimeter en een gladde normaal, zodat het licht over de hoek loopt in
   plaats van er een zwarte of witte lijn van te maken. Vingers zijn staafjes met
   ronde uiteinden, de mouw is rond.
 - Elk materiaal heeft een doek: geblauwd staal met slijpsporen en krassen,
   kunststof met een fijne korrel, een greep met stippels (en een normal map, dus
   ze vangen het licht), notenhout met nerven voor de sniper, geweven stof voor de
   mouw, en huid met een beetje tekening. De uv wordt per vlak uit de positie
   gehaald, zodat een doek op elk onderdeel dezelfde maat heeft.
 - Bewegingen: de terugslag is een veer (schiet terug, schiet iets door, komt tot
   rust) in plaats van een rechte lijn; de slede slaat in dertig milliseconden
   naar achteren en veert terug; de trekker gaat mee; er vliegt een huls uit de
   uitwerpopening; er hangt een wolkje kruitdamp aan de loop; de sniper haalt na
   elk schot zijn grendel over; het wapen deint mee met je passen, zakt als je
   rent, ademt als je stilstaat, en blijft een fractie achter als je omkijkt.
*/
import * as THREE from 'three';
import { rng, _normaalDoek } from './textures.js';

export const HERLAADTIJD = 1.55;

/*
 De vijf stappen van het herladen, als fractie van HERLAADTIJD. Ze staan hier bij
 elkaar zodat de beweging en het geluid nooit uit elkaar kunnen lopen.
*/
const STAP = {
  kantelen: [0.00, 0.16],   // wapen kantelt naar je toe, magazijnknop in
  magUit: [0.16, 0.38],     // het lege magazijn valt eruit en tuimelt weg
  hand: [0.30, 0.46],       // de linkerhand komt met een vol magazijn in beeld
  magIn: [0.46, 0.66],      // en duwt het erin
  tik: [0.66, 0.74],        // een tik op de bodem: hij zit
  handWeg: [0.74, 0.86],    // de hand zakt weer uit beeld
  slede: [0.76, 0.90],      // slede naar achteren en weer naar voren
  terug: [0.88, 1.00],      // terug in de aanslag
};
const deel = (t, [a, b]) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const soepel = (u) => u * u * (3 - 2 * u);

// ------------------------------------------------------------------ doeken
/*
 Alle doeken zijn 256 × 256 en worden één keer getekend: de drie wapens delen
 ze. Bij elk kleurdoek hoort een roughness map (waar het glimt) en waar het er
 iets toe doet een normal map (stippels, krassen, weefsel, poriën). Die komt uit
 dezelfde omzetting als het reliëf van de gevels (`_normaalDoek` in
 js/textures.js), dus het groene kanaal staat gegarandeerd de goede kant op.
*/
const DOEK = 256;
const doeken = new Map();
function nieuwDoek(S = DOEK) { const c = document.createElement('canvas'); c.width = c.height = S; return c; }
function alsTexture(c, kleur) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = kleur ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}
// per beeldpunt een kleine afwijking, zodat een egaal vlak niet als plastic oogt
function ruis(g, S, sterkte, r) {
  const d = g.getImageData(0, 0, S, S), p = d.data;
  for (let i = 0; i < p.length; i += 4) { const v = (r() - 0.5) * sterkte; p[i] += v; p[i + 1] += v; p[i + 2] += v; }
  g.putImageData(d, 0, 0);
}
/**
 * Een doek met kleur, glans en reliëf. `teken(kleur, ruw, hoogte, r)` krijgt
 * drie tekenvlakken: de kleur, de ruwheid (grijs: wit is dof) en de hoogte
 * (grijs: wit is hoog) waar de normal map uit komt.
 */
function doekSet(naam, teken, reliëf = 1) {
  if (doeken.has(naam)) return doeken.get(naam);
  const k = nieuwDoek(), w = nieuwDoek(), h = nieuwDoek();
  const r = rng(naam.length * 977 + naam.charCodeAt(0));
  const gk = k.getContext('2d'), gw = w.getContext('2d'), gh = h.getContext('2d');
  gh.fillStyle = '#808080'; gh.fillRect(0, 0, DOEK, DOEK);
  teken(gk, gw, gh, r);
  const set = { map: alsTexture(k, true), roughnessMap: alsTexture(w, false), normalMap: reliëf ? alsTexture(_normaalDoek(h, reliëf), false) : null };
  doeken.set(naam, set);
  return set;
}
const S = DOEK;

// geblauwd staal: bijna zwart met een blauwe zweem, slijpsporen in de lengte
// en hier en daar een kras waar het blanke metaal doorkomt
const staalDoek = () => doekSet('staal', (k, w, h, r) => {
  k.fillStyle = '#2b2f35'; k.fillRect(0, 0, S, S);
  w.fillStyle = '#5c5c5c'; w.fillRect(0, 0, S, S);
  ruis(k, S, 10, r);
  for (let i = 0; i < 900; i++) {                          // slijpsporen, liggend
    const y = r() * S, x = r() * S, L = 20 + r() * 140, licht = r() < 0.5;
    k.fillStyle = licht ? 'rgba(160,170,185,0.06)' : 'rgba(0,0,0,0.10)';
    k.fillRect(x, y, L, 1);
    w.fillStyle = licht ? 'rgba(40,40,40,0.10)' : 'rgba(140,140,140,0.10)';
    w.fillRect(x, y, L, 1);
  }
  for (let i = 0; i < 26; i++) {                           // krassen
    const x = r() * S, y = r() * S, a = (r() - 0.5) * 0.8, L = 6 + r() * 26;
    const dx = Math.cos(a) * L, dy = Math.sin(a) * L;
    for (const [g, kl, bd] of [[k, 'rgba(150,158,168,0.35)', 1], [w, 'rgba(30,30,30,0.6)', 1], [h, 'rgba(40,40,40,0.9)', 1.2]]) {
      g.strokeStyle = kl; g.lineWidth = bd; g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx, y + dy); g.stroke();
    }
  }
}, 0.8);

// kunststof onderstel: mat, met een fijne korrel
const polyDoek = () => doekSet('polymeer', (k, w, h, r) => {
  k.fillStyle = '#26272a'; k.fillRect(0, 0, S, S);
  w.fillStyle = '#c4c4c4'; w.fillRect(0, 0, S, S);
  ruis(k, S, 8, r); ruis(w, S, 20, r); ruis(h, S, 40, r);
}, 0.35);

// de greep: dicht bezaaid met stippels, en die voel je ook in het licht
const stippelDoek = () => doekSet('stippel', (k, w, h, r) => {
  k.fillStyle = '#232427'; k.fillRect(0, 0, S, S);
  w.fillStyle = '#d8d8d8'; w.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) {
    const x = r() * S, y = r() * S, rr = 1.3 + r() * 1.2;
    k.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.35)' : 'rgba(70,72,76,0.35)';
    k.beginPath(); k.arc(x, y, rr, 0, Math.PI * 2); k.fill();
    h.fillStyle = 'rgba(20,20,20,0.8)';
    h.beginPath(); h.arc(x, y, rr, 0, Math.PI * 2); h.fill();
  }
}, 1.6);

// notenhout: nerven in de lengte, met jaarringen die over het doek golven
const houtDoek = () => doekSet('hout', (k, w, h, r) => {
  const d = k.createImageData(S, S), p = d.data;
  const golf = [0, 1, 2, 3].map(() => [r() * 6, 0.01 + r() * 0.03, 2 + r() * 4]);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let o = 0; for (const [f, s, a] of golf) o += Math.sin(x * s * 6.28 / 8 + f) * a;
    // zachte jaarringen, een brede vlam eroverheen en wat korrel
    const ring = 0.5 + 0.5 * Math.sin((y + o) * 0.16);
    const vlam = 0.5 + 0.5 * Math.sin(y * 0.035 + Math.sin(x * 0.02) * 1.5);
    const donker = Math.pow(ring, 4) * 0.22 + vlam * 0.18 + (r() - 0.5) * 0.05;
    const i = (y * S + x) * 4;
    p[i] = 112 - donker * 60; p[i + 1] = 70 - donker * 42; p[i + 2] = 40 - donker * 26; p[i + 3] = 255;
  }
  k.putImageData(d, 0, 0);
  w.fillStyle = '#8a8a8a'; w.fillRect(0, 0, S, S);         // geolied: halfglanzend
  for (let i = 0; i < 160; i++) { h.fillStyle = 'rgba(60,60,60,0.5)'; h.fillRect(r() * S, r() * S, 10 + r() * 60, 1); }
}, 0.5);

// geweven stof van de mouw: een keperbinding, schuine ribbels
const stofDoek = () => doekSet('stof', (k, w, h, r) => {
  k.fillStyle = '#303b58'; k.fillRect(0, 0, S, S);
  w.fillStyle = '#f2f2f2'; w.fillRect(0, 0, S, S);
  for (let i = -S; i < S; i += 4) {
    k.strokeStyle = 'rgba(0,0,0,0.22)'; h.strokeStyle = 'rgba(30,30,30,0.9)';
    for (const g of [k, h]) { g.lineWidth = 1.5; g.beginPath(); g.moveTo(i, 0); g.lineTo(i + S, S); g.stroke(); }
    k.strokeStyle = 'rgba(140,155,190,0.10)'; k.beginPath(); k.moveTo(i + 2, 0); k.lineTo(i + 2 + S, S); k.stroke();
  }
  ruis(k, S, 12, r);
}, 0.9);

// huid: een zachte tekening van rood en geel, en fijne poriën
const huidDoek = () => doekSet('huid', (k, w, h, r) => {
  k.fillStyle = '#cfa27e'; k.fillRect(0, 0, S, S);
  w.fillStyle = '#9c9c9c'; w.fillRect(0, 0, S, S);
  for (let i = 0; i < 260; i++) {
    const x = r() * S, y = r() * S, rr = 8 + r() * 30;
    const gr = k.createRadialGradient(x, y, 0, x, y, rr);
    gr.addColorStop(0, r() < 0.5 ? 'rgba(190,110,90,0.10)' : 'rgba(230,190,150,0.10)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    k.fillStyle = gr; k.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  for (let i = 0; i < 1800; i++) { const x = r() * S, y = r() * S; h.fillStyle = 'rgba(50,50,50,0.5)'; h.fillRect(x, y, 1, 1); k.fillStyle = 'rgba(120,80,60,0.12)'; k.fillRect(x, y, 1, 1); }
}, 0.4);

// het mondingsvuur: een ster met een witte kern
function flitsDoek() {
  if (doeken.has('flits')) return doeken.get('flits');
  const c = nieuwDoek(128), g = c.getContext('2d'), r = rng(31);
  g.translate(64, 64);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + r() * 0.3, L = 36 + r() * 26, b = 5 + r() * 5;
    const gr = g.createLinearGradient(0, 0, Math.cos(a) * L, Math.sin(a) * L);
    gr.addColorStop(0, 'rgba(255,240,190,0.9)'); gr.addColorStop(0.5, 'rgba(255,160,50,0.5)'); gr.addColorStop(1, 'rgba(255,90,20,0)');
    g.fillStyle = gr; g.beginPath();
    g.moveTo(Math.cos(a + 1.57) * b, Math.sin(a + 1.57) * b); g.lineTo(Math.cos(a) * L, Math.sin(a) * L); g.lineTo(Math.cos(a - 1.57) * b, Math.sin(a - 1.57) * b);
    g.closePath(); g.fill();
  }
  const kern = g.createRadialGradient(0, 0, 0, 0, 0, 30);
  kern.addColorStop(0, 'rgba(255,255,240,1)'); kern.addColorStop(0.35, 'rgba(255,200,90,0.8)'); kern.addColorStop(1, 'rgba(255,120,30,0)');
  g.fillStyle = kern; g.beginPath(); g.arc(0, 0, 30, 0, Math.PI * 2); g.fill();
  const t = alsTexture(c, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  doeken.set('flits', t);
  return t;
}
// kruitdamp: een zacht, onregelmatig wolkje
function rookDoek() {
  if (doeken.has('rook')) return doeken.get('rook');
  const c = nieuwDoek(128), g = c.getContext('2d'), r = rng(47);
  for (let i = 0; i < 14; i++) {
    const x = 40 + r() * 48, y = 40 + r() * 48, rr = 16 + r() * 26;
    const gr = g.createRadialGradient(x, y, 0, x, y, rr);
    gr.addColorStop(0, 'rgba(210,210,205,0.30)'); gr.addColorStop(1, 'rgba(210,210,205,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }
  const t = alsTexture(c, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  doeken.set('rook', t);
  return t;
}

/*
 Een materiaal met doek. `maat` is hoeveel meter één doek beslaat, per richting
 (u, v): bij hout loopt de nerf in de lengte, dus daar is het doek langer dan
 breed. `bouw` gebruikt die maat voor de uv.
*/
function mat(kleur, ruw, metaal = 0, doek = null, maat = [0.06, 0.06], extra = {}) {
  const m = new THREE.MeshStandardMaterial({ color: kleur, roughness: ruw, metalness: metaal, ...extra });
  if (doek) {
    m.map = doek.map; m.roughnessMap = doek.roughnessMap;
    if (doek.normalMap) { m.normalMap = doek.normalMap; m.normalScale.set(1, 1); }
  }
  m.userData.uvMaat = maat;
  return m;
}

/*
 Alle blokjes van hetzelfde materiaal binnen één onderdeel gaan samen in één
 geometrie. Dat scheelt hier veel: het wapen hangt aan de camera en is dus
 altijd in beeld, en als los blokje zou elk ribbeltje op de slede een eigen
 draw call kosten.
*/
const bak = () => ({ delen: [] });
/*
 Een doos met afgeronde randen: de omzetting van RoundedBoxGeometry uit de
 voorbeelden van three.js, maar dan zonder die mee te hoeven laden. Een doos van
 (2·seg+1)³ vakjes wordt zo geknepen dat de middelste vakjes het vlakke deel zijn
 en de buitenste de afronding; de normaal is de richting vanaf de binnendoos,
 dus op de rand loopt hij glad mee om de hoek.
*/
function rondeDoosGeo(b, h, d, r, seg = 2) {
  r = Math.max(0.0002, Math.min(r, b / 2 - 1e-5, h / 2 - 1e-5, d / 2 - 1e-5));
  const s = seg * 2 + 1;
  const geo = new THREE.BoxGeometry(1, 1, 1, s, s, s).toNonIndexed();
  const P = geo.attributes.position, N = geo.attributes.normal;
  const half = 0.5 / s, bx = b / 2 - r, by = h / 2 - r, bz = d / 2 - r;
  const n = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    n.set(x - Math.sign(x) * half, y - Math.sign(y) * half, z - Math.sign(z) * half).normalize();
    P.setXYZ(i, bx * Math.sign(x) + n.x * r, by * Math.sign(y) + n.y * r, bz * Math.sign(z) + n.z * r);
    N.setXYZ(i, n.x, n.y, n.z);
  }
  return geo;
}
const doos = (bk, m, b, h, d, x = 0, y = 0, z = 0, r = 0.0025, seg = 1) => {
  const g = rondeDoosGeo(b, h, d, r, seg);
  g.translate(x, y, z);
  bk.delen.push({ g, m });
};
const vorm = (bk, g, m) => bk.delen.push({ g, m });
// een staafje met ronde uiteinden van A naar B: vingers, de grendelsteel
const OP = new THREE.Vector3(0, 1, 0);
function staafGeo(A, B, r, rond = 8) {
  const a = new THREE.Vector3(...A), b = new THREE.Vector3(...B);
  const d = b.clone().sub(a), L = d.length();
  const g = new THREE.CapsuleGeometry(r, Math.max(0.0001, L), 3, rond);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(OP, d.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}
const staaf = (bk, m, A, B, r) => vorm(bk, staafGeo(A, B, r), m);
// een cilinder langs z (lopen, kokers)
function buisGeo(r1, r2, L, x, y, z, rond = 14) {
  const g = new THREE.CylinderGeometry(r1, r2, L, rond);
  g.rotateX(Math.PI / 2); g.translate(x, y, z);
  return g;
}

/*
 De uv: per driehoek de as waar zijn normaal het meest langs ligt, en de twee
 andere coördinaten gedeeld door de maat van het doek. Per driehoek en niet per
 hoekpunt, anders loopt de naad van de projectie dwars door een driehoek op de
 afgeronde rand en krijg je daar een veeg.
*/
function uvUitPositie(pos, nor, maat) {
  const uv = new Float32Array(pos.length / 3 * 2);
  const [su, sv] = maat;
  for (let t = 0; t < pos.length; t += 9) {
    let nx = 0, ny = 0, nz = 0;
    for (let k = 0; k < 3; k++) { nx += nor[t + k * 3]; ny += nor[t + k * 3 + 1]; nz += nor[t + k * 3 + 2]; }
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
    for (let k = 0; k < 3; k++) {
      const x = pos[t + k * 3], y = pos[t + k * 3 + 1], z = pos[t + k * 3 + 2], j = (t / 3 + k) * 2;
      // zijkant: u langs de loop (z), v omhoog; boven- en onderkant: u langs de
      // loop, v dwars; voor- en achterkant: u opzij, v omhoog
      if (ax >= ay && ax >= az) { uv[j] = z / su; uv[j + 1] = y / sv; }
      else if (ay >= az) { uv[j] = z / su; uv[j + 1] = x / sv; }
      else { uv[j] = x / su; uv[j + 1] = y / sv; }
    }
  }
  return uv;
}
const bouw = (bk, ouder) => {
  const perMat = new Map();
  for (const { g, m } of bk.delen) {
    if (!perMat.has(m)) perMat.set(m, []);
    perMat.get(m).push(g.index ? g.toNonIndexed() : g);
  }
  for (const [m, lijst] of perMat) {
    const pos = [], nor = [];
    for (const g of lijst) { pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); g.dispose(); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    if (m.map) geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvUitPositie(pos, nor, m.userData.uvMaat || [0.06, 0.06]), 2));
    ouder.add(new THREE.Mesh(geo, m));
  }
  return ouder;
};

/**
 * Bouwt het pistool met hand en onderarm. `geluid` is js/audio.js; de module
 * roept daar zelf de klikken van het herladen op.
 */
export function maakPistool(geluid) { return maakWapen(geluid, 'pistool'); }

/**
 * Hetzelfde, maar dan het machinegeweer dat je bij Tinga State kunt kopen. De
 * greep, de hand, de arm en de hele herlaadbeweging zijn gelijk — daar zit de
 * speler aan vast. Wat erboven zit is anders: een langere kast met een
 * loopmantel, een grendel in plaats van een slede, een lange magazijnschacht
 * door de greep heen (zoals bij een Uzi) en een ingeklapte schouderstut.
 */
export function maakMitrailleur(geluid) { return maakWapen(geluid, 'mitrailleur'); }

/**
 * En de sniper, het derde wapen bij Tinga State. Weer dezelfde greep, hand, arm
 * en herlaadbeweging; wat erboven zit is een lange loop met een vizierblok, een
 * grendel die opzij uitsteekt, een houten kolf die tegen je schouder loopt, en
 * een kijker op twee montagebeugels. Door die kijker kijk je niet in het model
 * maar met de camera (zie `scope` in js/player.js): hier staat alleen wat je
 * ziet zolang je hem gewoon vasthoudt.
 */
export function maakSniper(geluid) { return maakWapen(geluid, 'sniper'); }

function maakWapen(geluid, soort = 'pistool') {
  const SMG = soort === 'mitrailleur';
  const SNIPER = soort === 'sniper';
  const staal = mat(0xffffff, 1, 0.82, staalDoek(), [0.08, 0.08]);
  const staalDof = mat(0x9a9ea6, 1, 0.6, staalDoek(), [0.05, 0.05]);
  const poly = mat(0xffffff, 1, 0, polyDoek(), [0.05, 0.05]);
  const greepMat = SNIPER ? mat(0xffffff, 1, 0, houtDoek(), [0.22, 0.05]) : mat(0xffffff, 1, 0, stippelDoek(), [0.03, 0.03]);
  const hout = mat(0xffffff, 1, 0, houtDoek(), [0.22, 0.05]);
  const magMat = mat(0x8c9098, 1, 0.55, staalDoek(), [0.05, 0.05]);
  const huid = mat(0xffffff, 1, 0, huidDoek(), [0.07, 0.07]);
  const stof = mat(0xffffff, 1, 0, stofDoek(), [0.05, 0.05]);
  const manchetMat = mat(0x8890a8, 1, 0, stofDoek(), [0.03, 0.03]);
  const ribbelMat = mat(0x201b18, 0.95);
  // de witte stippen van het driepuntsvizier; iets lichtgevend, zodat je ze in
  // de schemering nog ziet
  const stip = mat(0xf4f1e6, 0.4, 0, null, undefined, { emissive: 0x5a5a50 });
  const glas = mat(0x1d2e3a, 0.08, 0.9);

  const groep = new THREE.Group();

  // ---------------------------------------------------------------- wapen
  // Alles wat vastzit aan het frame zit in `wapen`; de slede en het magazijn
  // hangen daar los in, want die bewegen bij het herladen.
  const wapen = new THREE.Group();
  groep.add(wapen);

  const sB = bak();
  // waar de huls uit komt, in de coördinaten van het wapen
  let uitwerp = [0.016, 0.030, -0.014];
  if (SMG) {
    /*
     Bij een machinepistool schuift niet de hele bovenkant naar achteren maar de
     grendel eronder; wat je ziet bewegen is de spanknop op de kast. Die zit
     daarom in hetzelfde onderdeel als bij het pistool, zodat de herlaadbeweging
     hieronder voor allebei klopt.
    */
    doos(sB, staal, 0.044, 0.042, 0.250, 0, 0.028, -0.055, 0.006, 2);   // grendelkast
    // een rail over de rug, met de dwarsgroeven erin
    doos(sB, staalDof, 0.020, 0.006, 0.200, 0, 0.051, -0.055, 0.0015);
    for (let i = 0; i < 16; i++) doos(sB, staalDof, 0.024, 0.004, 0.005, 0, 0.0545, -0.145 + i * 0.012, 0.001);
    doos(sB, staalDof, 0.014, 0.016, 0.032, 0, 0.054, -0.020, 0.003);   // spanknop
    doos(sB, staalDof, 0.010, 0.012, 0.008, 0, 0.056, -0.172, 0.0015);  // korrel
    for (const sx of [-1, 1]) doos(sB, staalDof, 0.008, 0.011, 0.008, sx * 0.012, 0.056, 0.055, 0.0015);  // keep
    doos(sB, staalDof, 0.002, 0.018, 0.050, 0.0222, 0.028, -0.010, 0.0008);   // uitwerpopening
    uitwerp = [0.024, 0.030, -0.010];
  } else if (SNIPER) {
    /*
     Bij een grendelgeweer beweegt de grendel, en die steekt opzij uit — dat is
     wat je bij het herladen ziet bewegen. Hij zit daarom in hetzelfde onderdeel
     als de slede van het pistool, zodat de beweging hieronder voor alle drie
     klopt. Het draaipunt ligt op de as van de grendel (y = 0,030): na elk schot
     gaat de steel omhoog, naar achteren, naar voren en weer omlaag.
    */
    vorm(sB, buisGeo(0.0125, 0.0125, 0.060, 0, 0, 0.088), staal);      // grendelhuis achter de kast
    vorm(sB, staafGeo([0.004, 0, 0.078], [0.036, -0.006, 0.084], 0.0042), staalDof);   // grendelsteel opzij
    vorm(sB, new THREE.SphereGeometry(0.0095, 12, 8).translate(0.040, -0.008, 0.084), staalDof);  // knop eraan
    uitwerp = [0.020, 0.030, 0.040];
  } else {
    doos(sB, staal, 0.030, 0.034, 0.176, 0, 0.023, -0.048, 0.0045, 2);  // de slede
    doos(sB, staalDof, 0.031, 0.012, 0.030, 0, 0.010, -0.126, 0.003);   // afschuining voorop
    // grepen op de slede: de ribbels waar je hem aan overhaalt, achter en voor
    for (let i = 0; i < 7; i++) doos(sB, staalDof, 0.0312, 0.026, 0.0022, 0, 0.022, 0.008 + i * 0.0042, 0.0006);
    for (let i = 0; i < 4; i++) doos(sB, staalDof, 0.0312, 0.020, 0.0022, 0, 0.024, -0.104 - i * 0.0042, 0.0006);
    doos(sB, staalDof, 0.002, 0.016, 0.036, 0.0152, 0.030, -0.014, 0.0008);   // uitwerpopening
    doos(sB, staal, 0.012, 0.004, 0.030, 0.004, 0.0405, -0.014, 0.0012);      // de loopkop erin
    doos(sB, staalDof, 0.005, 0.010, 0.007, 0, 0.043, -0.126, 0.0012);   // korrel, vlak achter de mond
    doos(sB, stip, 0.0026, 0.0026, 0.0008, 0, 0.045, -0.1296, 0.0005);   // stip op de korrel
    doos(sB, staalDof, 0.026, 0.006, 0.008, 0, 0.041, 0.030, 0.0015);   // voet van de keep
    for (const sx of [-1, 1]) {
      doos(sB, staalDof, 0.007, 0.009, 0.008, sx * 0.010, 0.043, 0.030, 0.0012);  // keep achterop
      doos(sB, stip, 0.0024, 0.0024, 0.0008, sx * 0.010, 0.0445, 0.0258, 0.0005);
    }
    doos(sB, staalDof, 0.026, 0.020, 0.008, 0, 0.030, 0.040, 0.003);    // sluitstuk
  }
  const slede = bouw(sB, new THREE.Group());
  if (SNIPER) slede.position.y = 0.030;
  wapen.add(slede);

  // onderstel: kast, stofkap onder de loop, trekkerbeugel en de loop
  const fB = bak();
  if (SMG) {
    vorm(fB, buisGeo(0.0075, 0.0075, 0.10, 0, 0.024, -0.230, 12), staalDof);
    vorm(fB, buisGeo(0.020, 0.020, 0.110, 0, 0.024, -0.180, 16), staal);   // loopmantel
    // de koelgaten in de mantel: donkere sleuven aan weerszijden
    for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) doos(fB, staalDof, 0.004, 0.009, 0.016, sx * 0.019, 0.024, -0.142 - i * 0.024, 0.0015);
    doos(fB, poly, 0.036, 0.030, 0.160, 0, -0.004, -0.060, 0.005, 2);  // kast onder de grendel
    doos(fB, poly, 0.021, 0.007, 0.046, 0, -0.041, -0.020, 0.003);     // onderkant beugel
    doos(fB, poly, 0.021, 0.020, 0.007, 0, -0.031, -0.042, 0.003);     // voorkant beugel
    doos(fB, staalDof, 0.009, 0.011, 0.010, -0.019, -0.010, 0.004, 0.002); // magazijnknop
    // de schouderstut ingeklapt: twee stangen langs de kast met de plaat erachter
    for (const sx of [-1, 1]) vorm(fB, buisGeo(0.005, 0.005, 0.170, sx * 0.026, 0.008, 0.105, 8), staalDof);
    doos(fB, staalDof, 0.062, 0.013, 0.030, 0, 0.008, 0.196, 0.004);
    bouw(fB, wapen);
  } else if (SNIPER) {
    // een lange, zware loop met een mondingsrem eraan
    vorm(fB, buisGeo(0.0105, 0.0115, 0.34, 0, 0.026, -0.330, 16), staalDof);
    doos(fB, staal, 0.030, 0.030, 0.055, 0, 0.026, -0.500, 0.006, 2);   // mondingsrem
    for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) doos(fB, staalDof, 0.004, 0.012, 0.007, sx * 0.0145, 0.026, -0.485 + i * 0.014, 0.001);
    vorm(fB, buisGeo(0.019, 0.019, 0.200, 0, 0.030, -0.030, 18), staal);   // de kast, rond
    doos(fB, staalDof, 0.002, 0.016, 0.048, 0.0185, 0.034, 0.040, 0.0008); // uitwerpopening
    doos(fB, staal, 0.038, 0.030, 0.130, 0, 0.004, -0.060, 0.005, 2);   // onderkant van de kast
    doos(fB, hout, 0.042, 0.032, 0.200, 0, -0.002, -0.230, 0.008, 2);   // voorhout
    doos(fB, staal, 0.021, 0.007, 0.050, 0, -0.041, -0.020, 0.003);     // onderkant beugel
    doos(fB, staal, 0.021, 0.020, 0.007, 0, -0.031, -0.045, 0.003);     // voorkant beugel
    doos(fB, staalDof, 0.009, 0.011, 0.010, -0.020, -0.008, 0.004, 0.002); // magazijnknop
    doos(fB, staalDof, 0.044, 0.009, 0.060, 0, 0.049, -0.090, 0.002);   // vizierbalk vooraan
    /*
     De kolf. Hij loopt vanaf de kast naar achteren en iets omlaag, met een
     wangsteun erop en een rubber plaat aan het eind; dat is wat een geweer een
     geweer maakt in plaats van een groot pistool.
    */
    doos(fB, hout, 0.036, 0.052, 0.150, 0, -0.014, 0.135, 0.009, 2);    // kolfhals
    doos(fB, hout, 0.038, 0.030, 0.090, 0, 0.026, 0.150, 0.009, 2);     // wangsteun
    doos(fB, hout, 0.042, 0.090, 0.040, 0, -0.022, 0.228, 0.010, 2);    // kolfplaat
    doos(fB, ribbelMat, 0.044, 0.094, 0.010, 0, -0.022, 0.252, 0.004);  // rubber eind
    /*
     De kijker: een koker op twee ringen, met een objectief dat naar voren
     uitloopt. De lenzen zijn donker glas dat de lucht spiegelt — je kijkt er in
     het spel niet dóór (dat doet de camera), dus een glimmend vlak is genoeg.
    */
    for (const dz of [-0.075, 0.055]) {
      doos(fB, staalDof, 0.012, 0.030, 0.014, 0, 0.062, dz, 0.002);
      vorm(fB, buisGeo(0.0195, 0.0195, 0.012, 0, 0.082, dz, 18), staalDof);   // de ring om de koker
    }
    vorm(fB, buisGeo(0.016, 0.016, 0.230, 0, 0.082, -0.020, 18), poly);
    vorm(fB, buisGeo(0.024, 0.016, 0.060, 0, 0.082, -0.160, 18), poly);    // objectief, uitlopend
    vorm(fB, buisGeo(0.0215, 0.0215, 0.003, 0, 0.082, -0.1905, 18), glas);
    vorm(fB, buisGeo(0.018, 0.019, 0.034, 0, 0.082, 0.078, 18), poly);    // oculair
    vorm(fB, buisGeo(0.0145, 0.0145, 0.002, 0, 0.082, 0.0955, 18), glas);
    // de stelknoppen: een bovenop, een opzij
    const knop = new THREE.CylinderGeometry(0.009, 0.009, 0.014, 14); knop.translate(0, 0.104, -0.020); vorm(fB, knop, staalDof);
    const zij = new THREE.CylinderGeometry(0.009, 0.009, 0.014, 14); zij.rotateZ(Math.PI / 2); zij.translate(0.022, 0.082, -0.020); vorm(fB, zij, staalDof);
    bouw(fB, wapen);
  } else {
    vorm(fB, buisGeo(0.0058, 0.0058, 0.030, 0, 0.021, -0.146, 12), staalDof);
    doos(fB, poly, 0.028, 0.026, 0.130, 0, -0.008, -0.028, 0.004, 2);  // het onderstel
    doos(fB, poly, 0.025, 0.017, 0.062, 0, -0.006, -0.092, 0.004, 2);  // stofkap onder de loop
    // de rail onder de stofkap: drie dwarsgroeven
    for (let i = 0; i < 3; i++) doos(fB, poly, 0.026, 0.004, 0.004, 0, -0.0155, -0.078 - i * 0.012, 0.001);
    doos(fB, poly, 0.012, 0.006, 0.044, 0, -0.041, -0.020, 0.0025);     // onderkant beugel
    doos(fB, poly, 0.012, 0.022, 0.006, 0, -0.031, -0.039, 0.0025);     // voorkant beugel
    doos(fB, staalDof, 0.009, 0.011, 0.010, -0.017, -0.007, 0.004, 0.002); // magazijnknop
    for (const sx of [-1, 1]) doos(fB, staalDof, 0.003, 0.004, 0.012, sx * 0.0142, -0.001, -0.050, 0.001);  // demontagepal
    doos(fB, staalDof, 0.003, 0.005, 0.020, -0.0142, 0.002, -0.004, 0.001);  // sledevanger links
    bouw(fB, wapen);
  }

  // de trekker, apart: hij draait om zijn bovenkant als je schiet
  const tB = bak();
  doos(tB, staalDof, 0.007, 0.021, 0.006, 0, -0.010, 0, 0.0025);
  const trekker = bouw(tB, new THREE.Group());
  trekker.position.set(0, -0.019, -0.017);
  wapen.add(trekker);

  // greep, iets naar achteren gekanteld; de stippels zitten in het doek
  const gB = bak();
  doos(gB, greepMat, 0.029, 0.092, 0.038, 0, -0.060, 0.022, 0.007, 2);
  if (!SNIPER) doos(gB, poly, 0.027, 0.009, 0.016, 0, -0.013, 0.044, 0.004);   // bevertail boven je hand
  const greep = bouw(gB, new THREE.Group());
  greep.rotation.x = 0.24;
  wapen.add(greep);

  // magazijn: los, zodat het eruit kan vallen. Bij het machinepistool zit het
  // net als bij een Uzi door de greep heen, en het is een stuk langer: dertig
  // patronen in plaats van twaalf.
  const mB = bak();
  if (SMG) {
    doos(mB, magMat, 0.026, 0.150, 0.032, 0, -0.095, 0.022, 0.003);
    for (let i = 0; i < 3; i++) doos(mB, magMat, 0.027, 0.004, 0.030, 0, -0.130 - i * 0.012, 0.022, 0.001);   // ribbels
    doos(mB, poly, 0.033, 0.009, 0.042, 0, -0.174, 0.022, 0.003);
  } else if (SNIPER) {
    // vijf patronen, dus een kort recht magazijn dat nauwelijks uitsteekt
    doos(mB, magMat, 0.028, 0.062, 0.044, 0, -0.050, 0.010, 0.003);
    doos(mB, poly, 0.034, 0.008, 0.050, 0, -0.084, 0.010, 0.003);
  } else {
    doos(mB, magMat, 0.024, 0.086, 0.030, 0, -0.062, 0.022, 0.003);
    doos(mB, poly, 0.031, 0.009, 0.040, 0, -0.108, 0.022, 0.0035);      // bodemplaat
  }
  const magazijn = bouw(mB, new THREE.Group());
  magazijn.rotation.x = 0.24;
  wapen.add(magazijn);

  // het volle magazijn dat je erin duwt; buiten het herladen onzichtbaar
  const nieuwMag = magazijn.clone();
  nieuwMag.visible = false;
  wapen.add(nieuwMag);

  /*
   ---- de linkerhand ----
   Het herladen was een magazijn dat uit zichzelf naar beneden zakte en een
   tweede dat uit zichzelf omhoog kwam. Dat is de beweging van een wapen dat
   zichzelf laadt, en dat is precies waarom het niet overtuigde: een magazijn
   wisselt niet vanzelf, je doet het met je andere hand.

   Dit is die hand: een handpalm met vier vingers eromheen en een duim, met het
   nieuwe magazijn erin geklemd. Hij komt van linksonder het beeld in, duwt het
   magazijn erin, geeft er met de muis van zijn hand een tik op, en zakt weer
   weg. Hij hangt aan `wapen` en niet aan `groep`, zodat hij met het wapen
   meekantelt: je brengt je hand naar het wapen, niet naar een vast punt in de
   lucht, en zo blijft hij bij het magazijn dat hij vasthoudt.
  */
  const MAG_ONDER = SMG ? -0.205 : -0.142;   // waar de hand het magazijn beetpakt
  const lhB = bak();
  doos(lhB, huid, 0.030, 0.058, 0.066, -0.026, 0, 0.002, 0.011, 2);      // handpalm, links naast het magazijn
  for (let i = 0; i < 4; i++) {
    const y = 0.020 - i * 0.0155, r = i === 3 ? 0.0068 : 0.0078;
    staaf(lhB, huid, [-0.014, y, -0.026], [0.012, y, -0.030], r);       // om de voorkant van het magazijn
    staaf(lhB, huid, [0.016, y, -0.028], [0.020, y, -0.014], r * 0.92); // de toppen aan de andere kant
  }
  staaf(lhB, huid, [-0.012, -0.012, 0.030], [0.016, 0.012, 0.036], 0.0095);   // duim langs de achterkant
  const polsL = rondeDoosGeo(0.050, 0.050, 0.060, 0.018, 2);
  polsL.rotateZ(0.30); polsL.translate(-0.048, -0.048, 0.010);
  vorm(lhB, polsL, huid);
  const mouwL = buisGeo(0.038, 0.042, 0.30, 0, 0, 0, 14);
  mouwL.rotateZ(0.30); mouwL.rotateY(-0.18); mouwL.translate(-0.115, -0.135, 0.130);
  vorm(lhB, mouwL, stof);
  const manchetL = buisGeo(0.041, 0.041, 0.032, 0, 0, 0, 14);
  manchetL.rotateZ(0.30); manchetL.translate(-0.062, -0.080, 0.028);
  vorm(lhB, manchetL, manchetMat);
  const linkerhand = bouw(lhB, new THREE.Group());
  linkerhand.rotation.x = 0.24;                // dezelfde rake als de greep
  linkerhand.position.set(0, MAG_ONDER, 0.022);
  linkerhand.visible = false;
  wapen.add(linkerhand);

  /*
   Mondingsvuur: drie gekruiste vlakken met een getekende ster erop — één naar
   je toe, twee in de lengte — additief opgeteld bij wat erachter ligt. Elk schot
   een andere draai en maat, zodat twee schoten nooit hetzelfde vuur hebben.
  */
  const vlamMat = new THREE.MeshBasicMaterial({
    map: flitsDoek(), color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const vB = bak();
  vorm(vB, new THREE.PlaneGeometry(0.10, 0.10), vlamMat);
  for (const r of [0, Math.PI / 2]) {
    const blad = new THREE.PlaneGeometry(0.11, 0.05);
    blad.rotateY(Math.PI / 2); blad.rotateZ(r); blad.translate(0, 0, -0.035);
    vorm(vB, blad, vlamMat);
  }
  // het vuur heeft zijn eigen uv (de ster), dus niet door `bouw`, maar wel in
  // één geometrie: één draw call voor de drie vlakken
  const flits = new THREE.Group();
  {
    const pos = [], nor = [], uv = [];
    for (const { g } of vB.delen) {
      const n = g.toNonIndexed();
      pos.push(...n.attributes.position.array); nor.push(...n.attributes.normal.array); uv.push(...n.attributes.uv.array);
      g.dispose(); n.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    flits.add(new THREE.Mesh(geo, vlamMat));
  }
  const MOND = SMG ? [0, 0.024, -0.284] : SNIPER ? [0, 0.026, -0.532] : [0, 0.021, -0.166];
  flits.position.set(...MOND);
  flits.visible = false;
  wapen.add(flits);

  // ---------------------------------------------------------------- hand
  /*
   De rechterhand, in de coördinaten van de greep (die 0,24 rad naar achteren
   helt). De greep loopt van x ±0,0145, y −0,106 tot −0,014, z 0,003 tot 0,041.
   De rug van de hand ligt rechts tegen de greep, de muis erachter om de rug van
   de greep, drie vingers vouwen om de voorkant onder de trekkerbeugel door, de
   wijsvinger ligt in de beugel aan de trekker en de duim hoog aan de linkerkant.
  */
  const hB = bak();
  doos(hB, huid, 0.022, 0.066, 0.058, 0.024, -0.058, 0.030, 0.009, 2);   // de rug van de hand
  doos(hB, huid, 0.034, 0.060, 0.034, 0.008, -0.064, 0.058, 0.010, 2);   // de muis achter de greep, tot aan de pols
  doos(hB, huid, 0.036, 0.020, 0.030, 0.004, -0.021, 0.046, 0.008, 2);   // tussen duim en wijsvinger
  for (const [y, r] of [[-0.054, 0.0088], [-0.071, 0.0085], [-0.087, 0.0075]]) {
    staaf(hB, huid, [0.026, y, 0.010], [0.021, y, -0.005], r);          // van de knokkel naar voren
    staaf(hB, huid, [0.018, y, -0.007], [-0.012, y, -0.007], r);        // om de voorkant
    staaf(hB, huid, [-0.016, y, -0.004], [-0.020, y, 0.012], r * 0.9);  // de top aan de linkerkant
  }
  staaf(hB, huid, [0.024, -0.030, 0.010], [0.016, -0.034, -0.010], 0.0085);    // wijsvinger
  staaf(hB, huid, [0.016, -0.034, -0.010], [0.002, -0.037, -0.016], 0.0080);   // aan de trekker
  staaf(hB, huid, [-0.006, -0.020, 0.036], [-0.022, -0.026, 0.012], 0.0098);   // duim
  staaf(hB, huid, [-0.022, -0.026, 0.012], [-0.024, -0.025, -0.012], 0.0092);
  const hand = bouw(hB, new THREE.Group());
  hand.rotation.x = 0.24;
  groep.add(hand);

  // pols en onderarm: lopen schuin naar de rechteronderhoek uit beeld
  const aB = bak();
  const pols = rondeDoosGeo(0.050, 0.054, 0.070, 0.019, 2);
  pols.rotateY(0.22); pols.rotateX(-0.26); pols.translate(0.016, -0.088, 0.082);
  vorm(aB, pols, huid);
  const mouw = buisGeo(0.038, 0.043, 0.44, 0, 0, 0, 16);
  mouw.rotateZ(0.06); mouw.rotateY(0.34); mouw.rotateX(-0.26); mouw.translate(0.086, -0.150, 0.300);
  vorm(aB, mouw, stof);
  const manchet = buisGeo(0.043, 0.043, 0.034, 0, 0, 0, 16);
  manchet.rotateZ(0.06); manchet.rotateY(0.34); manchet.rotateX(-0.26); manchet.translate(0.030, -0.104, 0.112);
  vorm(aB, manchet, manchetMat);
  const arm = bouw(aB, new THREE.Group());
  groep.add(arm);

  /*
   ---- wat los van het wapen beweegt: hulzen en kruitdamp ----
   Een huls die uit het wapen springt hoort niet met het wapen mee te bewegen
   zodra hij los is. Deze groep hangt daarom wel in `groep` (zodat hij met de
   rest op de wapenlaag getekend wordt), maar krijgt elk beeld het omgekeerde
   van de stand van `groep` mee: wat erin zit staat stil ten opzichte van de
   camera.
  */
  const los = new THREE.Group();
  los.matrixAutoUpdate = false;
  groep.add(los);
  const messing = mat(0xc9a24a, 0.28, 1);
  const HULS = SNIPER ? [0.0062, 0.050] : [0.0048, 0.019];
  const hulsGeo = new THREE.CylinderGeometry(HULS[0], HULS[0], HULS[1], 10);
  const HULZEN = 6;
  const hulzen = new THREE.InstancedMesh(hulsGeo, messing, HULZEN);
  hulzen.frustumCulled = false;
  const hulsData = Array.from({ length: HULZEN }, () => ({ t: 9, p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), w: new THREE.Vector3() }));
  const nul = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < HULZEN; i++) hulzen.setMatrixAt(i, nul);
  los.add(hulzen);
  let hulsNr = 0;
  const rookMats = [0, 1, 2].map(() => new THREE.MeshBasicMaterial({ map: rookDoek(), transparent: true, opacity: 0, depthWrite: false }));
  const rookData = rookMats.map(m => {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m);
    r.visible = false; los.add(r);
    return { mesh: r, t: 9, v: new THREE.Vector3() };
  });
  let rookNr = 0;

  // ---------------------------------------------------------------- beweging
  let flitsT = 0, terugslag = 0, gedaan = -1;
  // het machinepistool is een halve meter lang; dat hangt verder van je af en
  // wat lager, anders vult de loop het halve scherm
  const RUST = SMG ? { x: 0.16, y: -0.155, z: -0.46 } : { x: 0.15, y: -0.13, z: -0.42 };

  /*
   Over het vizier kijken (rechtermuisknop).

   Dit is geen zoom-effect maar echt richten: de korrel en de keep hierboven
   staan allebei op dezelfde hoogte boven de kast en allebei op x = 0. Zet je het
   wapen dus op x = 0 en y = −die hoogte, recht voor de camera zonder enige
   draaiing, dan loopt de lijn korrel–keep precies door het midden van het scherm
   — je kijkt er werkelijk overheen, en de korrel valt in de keep zoals het hoort.

   Die hoogte is niet het hart van de korrel maar de bovenkant ervan (4,8 cm bij
   het pistool, 6,2 bij het machinepistool). Dat scheelt een halve centimeter en
   het is precies het verschil tussen kijken en niets zien: mik je op het hart,
   dan ligt de bovenkant van de slede exact op ooghoogte, kijk je er van opzij
   tegenaan en is het één zwart blok. Een halve centimeter hoger kijk je over de
   slede heen naar achteren weg lopend, met de korrel als silhouetje aan het
   eind — precies wat je over een echt vizier ziet.

   Verder komt het wapen een paar centimeter naar je toe: richten doe je met het
   wapen dichter bij je oog, niet op gestrekte armen.
  */
  const VIZIER_Y = SMG ? 0.062 : 0.048;
  /*
   En hoe ver van je oog. Dat is voor de twee wapens precies andersom, en dat is
   geen detail maar wat ze van elkaar onderscheidt: een pistool richt je met
   gestrékte armen, dus vérder weg dan uit de heup — knijp je het tegen je oog,
   dan is de achterkant van de slede een zwart blok en zie je niets meer. Een
   machinepistool trek je juist naar je schouder toe — maar het heeft een
   ingeklapte schouderstut die eenentwintig centimeter achter de kast uitsteekt,
   dus ook die schuift van je af: anders staat die plaat in je oog.
  */
  const MIK = { x: 0, y: -VIZIER_Y, z: RUST.z - (SMG ? 0.10 : 0.12) };
  const HERLAAD = SMG ? 2.05 : HERLAADTIJD;       // een lang magazijn kost meer tijd
  const SLAG = SMG ? 0.016 : 0.026;               // hoever de grendel/slede terugloopt
  groep.position.set(RUST.x, RUST.y, RUST.z);
  groep.rotation.set(0, 0.10, 0.06);

  /*
   De terugslag als veer. Een schot geeft het wapen een zet — naar achteren, de
   loop omhoog, een tikje opzij — en daarna trekt een gedempte veer het terug.
   Met deze demping (ζ ≈ 0,65) schiet hij één keer een fractie door voordat hij
   stilligt: dat is het naveren van een pols die de klap opvangt. De rechte lijn
   van vroeger (`terugslag` die in een zevende seconde naar nul liep) stopte
   abrupt, en dat is wat een beweging mechanisch maakt.
  */
  /*
   Ronde van 25 sep 2026 ("schieten met het handpistool lijkt raar qua recoil en
   animatie"). Drie dingen klopten niet:
    - De veer werd in één stap per beeld doorgerekend. Met c·dt ≈ 0,9 bij 30
      beelden per seconde ving de demping de zet in het eerste beeld al bijna
      helemaal op: 2° loop omhoog bij 30 fps, 12° bij 144. Nu in stapjes van
      hoogstens 1/240 s, dus bij elk beeldtempo dezelfde beweging.
    - Het wapen draaide met hand en onderarm als één stijf blok om de greep:
      de loop ging omhoog en de mouw sloeg tien centimeter omlaag, een wip. Nu
      draait het om de pols (`POLS`) en draait de onderarm maar voor een derde
      mee, zoals een pols die de klap opvangt.
    - Het tikje opzij (y) was bijna zo groot als de zet omhoog, waardoor het
      pistool bij elk schot heen en weer wiebelde. Nu een derde daarvan.
    - Het schoot 3,5 cm naar je oog toe: op 42 cm is dat een wapen dat in één
      beeld 8 % groter wordt. Nu 2 cm, en de handen komen een paar millimeter
      mee omhoog.
  */
  const VEER = { k: 420, c: 27 };
  const KICK = SNIPER ? { z: 3.0, x: 15, y: 1.6 } : SMG ? { z: 0.9, x: 4.5, y: 1.1 } : { z: 0.9, x: 8.2, y: 0.9 };
  const veer = { z: 0, vz: 0, x: 0, vx: 0, y: 0, vy: 0 };
  const PIEK_X = KICK.x / 41;                      // ongeveer de hoogste uitslag
  // het draaipunt van de terugslag: de pols, achter en onder de greep
  const POLS = { y: -0.080, z: 0.075 };
  const ARM_MEE = 0.35;                            // zoveel draait de onderarm mee
  let sledeT = 9, grendelT = 9, trekT = 9, hulsWacht = -1;
  let tijd = 0, vorigeBob = null, loopF = 0, renF = 0, vorigeYaw = null, vorigePitch = null;
  const zwaai = { x: 0, y: 0 };
  const tmp = new THREE.Vector3();
  // de stand van het wapen (groep) in de laatste update, voor de hulzen
  const standMat = new THREE.Matrix4();
  let leegGelaten = false;

  /** Eén schot: mondingsvuur, terugslag, slede, trekker, huls en damp. */
  function vuur() {
    flitsT = SNIPER ? 0.07 : 0.055;
    // snel achter elkaar klikken: de loop staat al omhoog, dan komt er minder
    // bij (anders stapelt hij tot het pistool rechtop staat)
    const al = Math.max(0, Math.min(0.6, veer.x / (PIEK_X * 2)));
    veer.vz += KICK.z * (0.9 + Math.random() * 0.2) * (1 - al);
    veer.vx += KICK.x * (0.9 + Math.random() * 0.2) * (1 - al);
    veer.vy += (Math.random() - 0.5) * 2 * KICK.y;
    terugslag = 1;
    flits.rotation.z = Math.random() * Math.PI;
    const s = (SNIPER ? 1.35 : SMG ? 0.9 : 1) * (0.85 + Math.random() * 0.4);
    flits.scale.set(s, s, 0.8 + Math.random() * 0.5);
    sledeT = 0; trekT = 0;
    // bij de sniper komt de huls pas bij het overhalen van de grendel eruit
    if (SNIPER) { grendelT = 0; hulsWacht = 0.38; } else werpHuls();
    blaasRook();
  }
  function werpHuls() {
    const h = hulsData[hulsNr]; hulsNr = (hulsNr + 1) % HULZEN;
    h.t = 0;
    h.p.set(...uitwerp).applyMatrix4(standMat);
    // naar rechts, omhoog en een beetje naar achteren, elke keer anders
    h.v.set(0.55 + Math.random() * 0.3, 0.85 + Math.random() * 0.35, 0.10 + Math.random() * 0.2);
    if (SNIPER) h.v.multiplyScalar(0.6);
    h.q.setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.PI / 2));
    h.w.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, 18 + Math.random() * 20);
  }
  function blaasRook() {
    const r = rookData[rookNr]; rookNr = (rookNr + 1) % rookData.length;
    r.t = 0;
    r.mesh.position.set(...MOND).applyMatrix4(standMat);
    r.v.set((Math.random() - 0.5) * 0.05, 0.05 + Math.random() * 0.04, -0.05 - Math.random() * 0.05);
    r.mesh.rotation.z = Math.random() * Math.PI * 2;
    r.mesh.visible = true;
  }
  const hulsM = new THREE.Matrix4(), hulsS = new THREE.Vector3(1, 1, 1), draai = new THREE.Quaternion(), e = new THREE.Euler();
  function losBij(dt) {
    let iets = false;
    for (let i = 0; i < HULZEN; i++) {
      const h = hulsData[i];
      if (h.t > 0.7) continue;
      iets = true;
      h.t += dt;
      if (h.t > 0.7) { hulzen.setMatrixAt(i, nul); continue; }
      h.v.y -= 7 * dt;
      h.p.addScaledVector(h.v, dt);
      e.set(h.w.x * dt, h.w.y * dt, h.w.z * dt); draai.setFromEuler(e); h.q.multiply(draai);
      hulsM.compose(h.p, h.q, hulsS);
      hulzen.setMatrixAt(i, hulsM);
    }
    if (iets) hulzen.instanceMatrix.needsUpdate = true;
    for (const r of rookData) {
      if (!r.mesh.visible) continue;
      r.t += dt;
      const u = r.t / 0.9;
      if (u >= 1) { r.mesh.visible = false; continue; }
      r.mesh.position.addScaledVector(r.v, dt);
      const s = (SNIPER ? 0.10 : 0.05) + u * (SNIPER ? 0.22 : 0.12);
      r.mesh.scale.set(s, s, 1);
      r.mesh.material.opacity = (SNIPER ? 0.6 : 0.45) * (1 - u) * Math.min(1, r.t * 25);
      r.mesh.rotation.z += dt * 0.6;
    }
  }

  /**
   * Eén beeld. `herlaad` is de resterende herlaadtijd in seconden (0 = niet
   * bezig), `bob` de loopbeweging van de speler, `mik` hoever je over het
   * vizier kijkt (0 = uit de heup, 1 = aangeslagen), `holster` hoever het
   * wapen weggeborgen is (0 = in de aanslag, 1 = helemaal uit beeld), `yaw` en
   * `pitch` je kijkrichting (voor het naslepen bij omkijken) en `leeg` of het
   * magazijn leeg is (dan blijft de slede van het pistool achter staan).
   */
  function update(dt, { herlaad = 0, bob = 0, mik = 0, holster = 0, yaw = null, pitch = null, leeg = false } = {}) {
    dt = Math.min(dt, 0.05);
    tijd += dt;
    // de veer: versnelling tegen de uitwijking in, gedempt door de snelheid —
    // in stapjes van hoogstens 1/240 s, zodat hij bij elk beeldtempo gelijk loopt
    const stappen = Math.max(1, Math.ceil(dt * 240)), h = dt / stappen;
    for (let s = 0; s < stappen; s++) {
      for (const [p, v] of [['z', 'vz'], ['x', 'vx'], ['y', 'vy']]) {
        veer[v] += (-VEER.k * veer[p] - VEER.c * veer[v]) * h;
        veer[p] += veer[v] * h;
      }
    }
    terugslag = Math.max(0, Math.min(1, veer.x / PIEK_X));
    flitsT -= dt;
    const aan = flitsT > 0;
    flits.visible = aan;
    vlamMat.opacity = aan ? 0.6 + Math.random() * 0.4 : 0;
    // de flits licht je hand en het staal even op
    const gloed = aan ? 0.22 : 0;
    huid.emissive.setRGB(gloed, gloed * 0.55, gloed * 0.2);
    staal.emissive.setRGB(gloed * 0.12, gloed * 0.07, gloed * 0.02);
    sledeT += dt; trekT += dt; grendelT += dt;
    if (hulsWacht >= 0 && grendelT >= hulsWacht) { hulsWacht = -1; werpHuls(); }

    // de trekker: in 40 ms naar achteren, in 120 ms terug
    const trek = trekT < 0.04 ? trekT / 0.04 : Math.max(0, 1 - (trekT - 0.04) / 0.12);
    trekker.rotation.x = -0.38 * soepel(trek);

    // lopen, rennen en omkijken: hoe hard gaat `bob`, en hoe hard draai je?
    const dBob = vorigeBob === null ? 0 : bob - vorigeBob; vorigeBob = bob;
    const tempo = dt > 0 ? dBob / dt : 0;
    loopF += ((tempo > 0.1 ? 1 : 0) - loopF) * Math.min(1, dt * 6);
    renF += ((tempo > 11 ? 1 : 0) - renF) * Math.min(1, dt * 5);
    let dYaw = 0, dPitch = 0;
    if (yaw !== null && vorigeYaw !== null) {
      dYaw = yaw - vorigeYaw;
      while (dYaw > Math.PI) dYaw -= 2 * Math.PI;
      while (dYaw < -Math.PI) dYaw += 2 * Math.PI;
      dPitch = pitch - vorigePitch;
    }
    vorigeYaw = yaw; vorigePitch = pitch;
    // het wapen sleept achter je kijkrichting aan en veert terug
    // (naar rechts kijken is yaw omlaag: het wapen blijft dan links achter)
    const doelX = Math.max(-0.035, Math.min(0.035, dt > 0 ? dYaw / dt * 0.006 : 0));
    const doelY = Math.max(-0.03, Math.min(0.03, dt > 0 ? -dPitch / dt * 0.005 : 0));
    zwaai.x += (doelX - zwaai.x) * Math.min(1, dt * 9);
    zwaai.y += (doelY - zwaai.y) * Math.min(1, dt * 9);

    if (herlaad > 0) {
      const t = 1 - herlaad / HERLAAD;
      // geluid: elke stap één keer, op het moment dat je hem ziet
      const stapNr = t < STAP.magUit[0] ? 0 : t < STAP.magIn[0] ? 1 : t < STAP.tik[0] ? 2 : t < STAP.slede[0] ? 3 : 4;
      if (stapNr !== gedaan) {
        gedaan = stapNr;
        if (stapNr === 0) geluid.magazijnKnop();
        else if (stapNr === 1) geluid.magazijnUit();
        else if (stapNr === 3) geluid.magazijnIn();
        else if (stapNr === 4) geluid.slede();
      }
      /*
       Het wapen komt omhoog, naar het midden en naar je toe, en kantelt naar je
       toe zodat je in het magazijnhuis kijkt — zoals je een wapen omhoog haalt
       om erin te kunnen kijken terwijl je herlaadt.

       Het zákte hier eerst drie centimeter, en dat was precies de fout: de
       onderrand van het beeld ligt op deze afstand een kleine kwart meter onder
       het midden, en de magazijnschacht hing daar al tegenaan. Alles wat er
       daarna gebeurde — het magazijn dat eruit viel, het nieuwe dat erin ging —
       speelde zich onder de onderrand af. Je zag het wapen wiebelen en verder
       niets. Tien centimeter omhoog zet de hele beweging in beeld.
      */
      const uit = soepel(deel(t, STAP.kantelen)) - soepel(deel(t, STAP.terug));
      groep.position.x = RUST.x - 0.140 * uit;
      groep.position.y = RUST.y + 0.105 * uit;
      groep.position.z = RUST.z + 0.090 * uit;
      /*
       En hij kantelt naar líjnks, niet naar rechts. Dat was de tweede helft van
       hetzelfde probleem: gekanteld naar rechts wijst de magazijnschacht recht
       in je eigen onderarm, die vanuit de rechteronderhoek in beeld komt, en
       viel het magazijn er precies achter weg. Naar links toe ligt de schacht
       vrij, komt de linkerhand er van de goede kant bij, en zie je alles wat er
       gebeurt.
      */
      groep.rotation.z = 0.06 - 0.72 * uit;
      groep.rotation.x = 0.16 * uit;
      groep.rotation.y = 0.10 - 0.60 * uit;
      /*
       De onderarm draait niet mee. Hij hangt in dezelfde groep als het wapen,
       dus kantelde hij er netjes mee en kwam hij ineens van linksonder in beeld
       — precies dwars door de plek waar het magazijn uit valt. Je elleboog
       blijft echter waar hij is als je je pols draait, dus hier draait de arm
       terug: de pols volgt het wapen, de mouw komt nog steeds uit de
       rechteronderhoek.
      */
      arm.position.set(0, 0, 0);
      arm.rotation.z = 0.72 * uit * 0.62;
      arm.rotation.y = 0.60 * uit * 0.45;
      arm.rotation.x = -0.16 * uit;
      /*
       Het lege magazijn valt eruit — en valt dan ook echt: met de versnelling
       van de zwaartekracht (daarom het kwadraat), een tuimeling erin, en ver
       genoeg om onder de onderrand van het beeld te verdwijnen. Eerst schiet
       het een paar centimeter uit de schacht, daarna laat de zwaartekracht het
       los; dat is de beweging die je ziet als iemand de magazijnknop indrukt.
      */
      const val = deel(t, STAP.magUit);
      magazijn.visible = val < 1;
      magazijn.position.y = -(0.05 * val + 0.52 * val * val);
      magazijn.position.z = 0.05 * val;
      magazijn.rotation.x = 0.24 + val * 1.1;          // hij kantelt onder het vallen
      magazijn.rotation.z = val * val * 0.9;

      /*
       De linkerhand met het volle magazijn. Hij komt van linksonder in beeld
       (`hand`), schuift het magazijn de schacht in (`magIn`), geeft er met de
       muis van zijn hand een tik op (`tik` — de kleine stoot omhoog), en zakt
       weer weg (`handWeg`). Het magazijn en de hand lopen op dezelfde hoogte,
       zodat hij het werkelijk vasthoudt in plaats van ernaast te zweven.
      */
      const komt = soepel(deel(t, STAP.hand));
      const duwt = soepel(deel(t, STAP.magIn));
      const tik = Math.sin(deel(t, STAP.tik) * Math.PI) * 0.012;
      const weg = soepel(deel(t, STAP.handWeg));
      const magZak = -0.30 * (1 - duwt) - 0.26 * (1 - komt) + tik;
      nieuwMag.visible = komt > 0 && duwt < 1;
      nieuwMag.position.set(0, magZak, 0);
      linkerhand.visible = komt > 0 && weg < 1;
      linkerhand.position.set(
        -0.11 * (1 - komt) - 0.16 * weg,
        MAG_ONDER + magZak - 0.20 * weg,
        0.022 + 0.05 * (1 - komt) + 0.06 * weg,
      );
      if (duwt >= 1) { magazijn.visible = true; magazijn.position.set(0, tik, 0); magazijn.rotation.set(0.24, 0, 0); }

      // slede naar achteren en weer naar voren; stond hij al achter (leeg
      // geschoten), dan blijft hij daar tot hij bij deze stap losgelaten wordt
      const sl = deel(t, STAP.slede);
      const achter = leegGelaten && !SMG && !SNIPER ? (sl < 0.5 ? 1 : Math.cos((sl - 0.5) * Math.PI)) : Math.sin(sl * Math.PI);
      slede.position.z = achter * (SMG ? 0.020 : SNIPER ? 0.045 : 0.030);
      slede.rotation.z = 0;
      if (sl >= 1) leegGelaten = false;
      stand(holster);
      losBij(dt);
      return;
    }
    gedaan = -1;
    magazijn.visible = true;
    magazijn.position.set(0, 0, 0);
    magazijn.rotation.set(0.24, 0, 0);        // de tuimeling van het herladen terugzetten
    nieuwMag.visible = false;
    linkerhand.visible = false;
    arm.rotation.set(0, 0, 0);

    /*
     De slede slaat in 30 ms helemaal naar achteren en veert in 70 ms terug —
     te snel om te volgen, en dat is ook zo bij een echt pistool: je ziet een
     veeg, geen schuivend blok. Is het laatste patroon eruit, dan blijft hij
     achter staan (de sledevanger) tot je herlaadt.
    */
    if (leeg && !SMG && !SNIPER && sledeT < 0.2) leegGelaten = true;
    if (!leeg) leegGelaten = false;
    const slag = sledeT < 0.03 ? sledeT / 0.03 : leegGelaten ? 1 : Math.max(0, 1 - (sledeT - 0.03) / 0.07);
    if (SNIPER) {
      /*
       De grendel van de sniper na een schot: omhoog (0,12–0,24 s), naar
       achteren (tot 0,40 s — daar springt de huls eruit), naar voren (tot
       0,56 s) en weer omlaag (tot 0,68 s). Het geweer kantelt er iets bij, zoals
       wanneer je met je rechterhand de steel pakt.
      */
      const g = grendelT;
      const op = soepel(deel(g, [0.12, 0.24])) - soepel(deel(g, [0.56, 0.68]));
      const terugG = soepel(deel(g, [0.24, 0.40])) - soepel(deel(g, [0.42, 0.56]));
      slede.rotation.z = 1.05 * op;
      slede.position.z = 0.045 * terugG;
    } else slede.position.z = slag * SLAG;

    /*
     Van de heup naar het vizier en terug. Alles wat het wapen scheef en opzij
     houdt (de kanteling van 0,10 en 0,06 rad, de x-verschuiving, het deinen van
     het lopen) loopt met `m` terug naar nul: aangeslagen staat het wapen recht
     voor je en staat het stil, want anders kijk je er niet overheen. De
     terugslag blijft wel te zien, maar korter — je hebt hem beter in bedwang.
    */
    const m = Math.max(0, Math.min(1, mik));
    const vrij = 1 - m;
    /*
     Deinen met je passen: een liggende acht — op en neer bij elke pas, opzij
     bij elke tweede — en bij rennen zakt het wapen en kantelt het weg, zoals je
     een pistool vasthoudt als je sprint in plaats van richt. Stilstaand ademt
     het: een paar millimeter op en neer, twee keer per vier seconden.
    */
    const pas = loopF * vrij, ren = renF * vrij;
    const deinen = Math.sin(bob) * 0.006 * vrij;
    const opzij = Math.cos(bob * 0.5) * 0.008 * pas;
    const adem = Math.sin(tijd * 1.6) * 0.0014 * vrij * (1 - loopF);
    const grendelKantel = SNIPER ? 0.10 * soepel(deel(grendelT, [0.08, 0.20])) * (1 - soepel(deel(grendelT, [0.60, 0.75]))) : 0;
    const terugM = 1 - 0.45 * m;
    /*
     De terugslag draait om de pols: `groep` draait om zijn eigen oorsprong (de
     bovenkant van de greep), dus schuift hij er zoveel bij dat de pols blijft
     staan waar hij stond. De onderarm draait voor `ARM_MEE` mee, om diezelfde
     pols; de rest draait hij terug.
    */
    const rx = veer.x * terugM;
    const cx = Math.cos(rx), sx = Math.sin(rx);
    const polsY = POLS.y - (POLS.y * cx - POLS.z * sx), polsZ = POLS.z - (POLS.y * sx + POLS.z * cx);
    const ax = -rx * (1 - ARM_MEE), ca = Math.cos(ax), sa = Math.sin(ax);
    arm.rotation.set(ax, 0, 0);
    arm.position.set(0, POLS.y - (POLS.y * ca - POLS.z * sa), POLS.z - (POLS.y * sa + POLS.z * ca));
    groep.rotation.set(
      rx - 0.42 * ren + Math.sin(tijd * 1.6 + 1) * 0.004 * vrij + zwaai.y * 1.2 * vrij,
      0.10 * vrij + veer.y * terugM + 0.35 * ren - zwaai.x * 1.4 * vrij,
      0.06 * vrij + Math.sin(bob * 0.5) * 0.02 * pas + 0.25 * ren + grendelKantel,
    );
    groep.position.set(
      RUST.x + (MIK.x - RUST.x) * m + opzij + zwaai.x * vrij + 0.02 * ren,
      RUST.y + (MIK.y - RUST.y) * m + deinen + adem + zwaai.y * vrij - 0.05 * ren + polsY + rx * 0.04,
      RUST.z + (MIK.z - RUST.z) * m + veer.z * (1 - 0.5 * m) + 0.02 * ren + polsZ,
    );
    stand(holster);
    losBij(dt);
  }

  // na het zetten van de stand: wegbergen, en de losse groep terugrekenen
  function stand(holster) {
    wegbergen(holster);
    groep.updateMatrix();
    standMat.copy(groep.matrix);
    los.matrix.copy(groep.matrix).invert();
    los.matrixWorldNeedsUpdate = true;
  }

  /*
   Het wapen wegbergen. Bij het wisselen zakt het eerst onder de onderrand van
   het beeld weg met de loop naar beneden en de kolf naar je toe — dat is de
   beweging van een wapen dat in je broeksband of onder je jas verdwijnt —
   en komt het andere er op dezelfde manier weer uit. Het staat apart omdat het
   bovenop alles komt: je kunt ook midden in het herladen wisselen.
  */
  function wegbergen(h) {
    if (!(h > 0)) return;
    groep.position.y -= 0.42 * h;
    groep.position.z += 0.16 * h;
    groep.position.x += 0.05 * h;
    groep.rotation.x -= 0.95 * h;      // loop omlaag
    groep.rotation.z += 0.42 * h;      // en de kolf naar binnen gedraaid
  }

  // de losse onderdelen erbij, zodat tools/wapentest.mjs de beweging kan meten
  return {
    groep, vuur, update, soort, herlaadtijd: HERLAAD,
    delen: { slede, magazijn, nieuwMag, flits, hand, arm, linkerhand, trekker, hulzen, rook: rookData.map(r => r.mesh), los },
    // waar het wapen hangt in de heup en aan het oog, zodat tools/wapentest.mjs
    // kan narekenen dat de vizierlijn door het midden van het scherm loopt
    houding: { rust: RUST, mik: MIK, vizierY: VIZIER_Y },
    get terugslag() { return terugslag; },
    get veer() { return { ...veer }; },
    get hulzenInDeLucht() { return hulsData.filter(h => h.t <= 0.7).length; },
  };
}
