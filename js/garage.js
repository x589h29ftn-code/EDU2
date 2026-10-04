/*
 Autohuis Lemmerweg: een showroom met glazen gevels aan de Lemmerweg, tegenover
 BP en tegen Duinterpen aan (verzoek 27 sep 2026: "een gebouw dat als autogarage
 gaat fungeren. Mooie glazen met auto's binnen. Je kan er een rode Ferrari of een
 gele Ferrari kopen voor 3000 euro. Rode BX voor 250. Hoge topsnelheid").

 Waar hij staat en waarom daar staat in js/bouwvlak.js. Het gebouw zelf staat
 nergens in de BGT of de 3D BAG; de maten zijn die van een gewone showroom:

   - 26 m langs de weg en 18 m diep, 5,2 m vrije hoogte;
   - de voorgevel en de voorste twaalf meter van de zijgevels zijn glas, van de
     vloer tot het plafond, met zwarte aluminium stijlen om de 2,6 m; de rest is
     witte gevelplaat, want achterin zitten de balie en de koffiehoek;
   - een luifel van 1,6 m boven de voorgevel, met de naam erop in een zwarte
     band die 's avonds oplicht;
   - een automatische schuifdeur in het vierde vak, die opengaat als je ervoor
     staat (niet als je in een auto zit: de showroom is geen doorrijroute);
   - binnen drie auto's: de rode Ferrari op een draaischijf recht tegenover de
     deur, de gele schuin ernaast en de rode BX aan de andere kant. Bij elke auto
     een prijsbordje, en achterin Sjoerd achter de balie.

 Kopen: sta je naast een auto, dan zegt de balk "E — … kopen". Heb je het geld,
 dan staat hij buiten op het voorterrein, met de neus naar de inrit; de auto in
 de showroom blijft staan (dat is het model, en er staan er meer in het
 magazijn). Te weinig geld: dan zegt Sjoerd wat hij kost.

 Een gekochte auto is van jou en blijft van jou: `bewaar` en `herstel` nemen hem
 mee in het opgeslagen spel (js/opslag.js), waar hij ook staat. Een wrak telt
 niet meer.

 Het rijgedrag van de Ferrari staat in js/vehicles.js (`RIJ`), het model in
 js/carmodel.js (soort 'ferrari').

 Het licht zit ook hier in de materialen en niet in lampen (zie js/sfeer.js en
 stap 83 in docs/METHODIEK.md): de lichtpanelen gloeien altijd, en de vloer, de
 wanden en de borden krijgen 's avonds meer eigen gloed.
*/
import * as THREE from 'three';
import { addCollider } from './world.js';
import { makeCar } from './carmodel.js';
import { Persoon } from './persoon.js';
import { GARAGE } from './bouwvlak.js';

export const NAAM = 'Autohuis Lemmerweg';

// wat er te koop staat; de plek is die in de showroom (x, z, yaw)
export const TE_KOOP = [
  { id: 'bx', naam: 'rode BX', merk: 'CITROËN BX', kleurNaam: 'rood', soort: 'bx', kleur: 0xa8141c, prijs: 250,
    x: 776.4, z: 124.6, yaw: Math.PI / 2 + 0.5, bord: { x: 772.9, z: 127.3 } },
  { id: 'ferrari_rood', naam: 'rode Ferrari', merk: 'FERRARI', kleurNaam: 'rosso corsa', soort: 'ferrari', kleur: 0xc40a12, prijs: 3000,
    x: 778.6, z: 131.7, yaw: Math.PI / 2, draai: true, bord: { x: 774.2, z: 135.2 } },
  { id: 'ferrari_geel', naam: 'gele Ferrari', merk: 'FERRARI', kleurNaam: 'giallo modena', soort: 'ferrari', kleur: 0xf2bf00, prijs: 3000,
    x: 776.4, z: 140.6, yaw: Math.PI / 2 - 0.5, bord: { x: 772.9, z: 138.2 } },
  /*
   De derde soort (stap 123): een snelle hatchback, tussen de BX en de Ferrari in. 150 km/u, vlot weg en
   strak door de bocht (`RIJ.gti` in js/vehicles.js); hetzelfde model als de hatchbacks in de wijk, maar
   lager en korter (`gti` in js/carmodel.js). Achterin, tussen de koffiehoek en de balie.
  */
  { id: 'gti', naam: 'blauwe GTI', merk: 'VW GOLF GTI', kleurNaam: 'blauw metallic', soort: 'gti', kleur: 0x1f4fb4, prijs: 1200,
    x: 783.6, z: 132.0, yaw: Math.PI / 2, bord: { x: 780.6, z: 134.6 } },
];

// ---------- maten (m) ----------
const { x0: X0, x1: X1, z0: Z0, z1: Z1 } = GARAGE;
const H = 5.2;                  // vrije hoogte binnen
const VLOER = 0.13;             // bovenkant van de vloer (het gras ligt op 0,12)
const DAK = 0.35;
const LUIFEL = 1.6;             // zover steekt het dak voor de gevel uit
const BAND = 1.3;               // de zwarte band met de naam
const VAK = 2.6;                // hart op hart van de stijlen in de voorgevel
const GLAS_DIEP = 12;           // zover lopen de glazen zijgevels door
const DEUR_Z0 = Z0 + 4 * VAK, DEUR_Z1 = Z0 + 5 * VAK;   // het vierde vak
const DEUR_Z = (DEUR_Z0 + DEUR_Z1) / 2;
const DEUR_H = 2.7;
const DEUR_BEREIK = 3.6;        // zo dichtbij gaat de schuifdeur open
const KOOP_BEREIK = 3.4;        // zo dichtbij het hart van een auto zegt de balk "kopen"
const BORD_BEREIK = 1.6;        // en zo dichtbij zijn prijsbordje
const BOTS_H = 4.2;             // hoger dan 3,5: anders rijdt een auto erdoorheen (js/spuiterij.js)
const SCHIJF_R = 2.8;
const SCHIJF_V = 0.18;          // rad/s: een rondje in 35 s

// waar een gekochte auto komt te staan: op het voorterrein, neus naar het noorden
const AFLEVER = [126, 132.5, 139, 145.2].map(z => ({ x: (GARAGE.voor.x0 + X0) / 2, z, yaw: 0 }));

// ---------- doeken ----------
function doek(w, h, teken) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  teken(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// grote lichte tegels van 60 cm met smalle voegen, een beetje gewolkt
function vloerDoek() {
  const t = doek(512, 512, (g, w) => {
    g.fillStyle = '#d9dad8'; g.fillRect(0, 0, w, w);
    let s = 7;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const l = 208 + Math.floor(r() * 16);
      g.fillStyle = `rgb(${l},${l + 1},${l - 1})`;
      g.fillRect(i * 128 + 2, j * 128 + 2, 124, 124);
      for (let k = 0; k < 30; k++) {
        g.fillStyle = `rgba(150,150,150,${0.03 + r() * 0.04})`;
        g.beginPath(); g.arc(i * 128 + r() * 128, j * 128 + r() * 128, 4 + r() * 16, 0, 6.283); g.fill();
      }
    }
    g.fillStyle = '#a9aaa8';
    for (let i = 0; i <= 4; i++) { g.fillRect(i * 128 - 1, 0, 3, w); g.fillRect(0, i * 128 - 1, w, 3); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// betonklinkers van 30 × 20 in halfsteens verband, antraciet
function klinkerDoek() {
  const t = doek(256, 256, (g, w) => {
    g.fillStyle = '#3c3e40'; g.fillRect(0, 0, w, w);
    let s = 11;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let j = 0; j < 8; j++) for (let i = -1; i < 6; i++) {
      const x = i * 48 + (j % 2) * 24, y = j * 32;
      const l = 78 + Math.floor(r() * 26);
      g.fillStyle = `rgb(${l},${l + 2},${l + 4})`;
      g.fillRect(x + 2, y + 2, 44, 28);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// witte gevelplaat met naden om de 1,2 m
function paneelDoek() {
  const t = doek(256, 256, (g, w) => {
    g.fillStyle = '#eceeed'; g.fillRect(0, 0, w, w);
    g.fillStyle = '#c3c6c6'; g.fillRect(0, 0, 3, w); g.fillRect(0, 0, w, 2);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// de naam op de band boven de luifel
function naamDoek() {
  return doek(2048, 128, (g, w, h) => {
    g.fillStyle = '#1b1d21'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c40a12'; g.fillRect(0, h - 14, w, 8);
    g.font = 'bold 84px sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'center';
    g.fillStyle = '#ffffff';
    g.fillText('AUTOHUIS  LEMMERWEG', w / 2, h * 0.47);
    g.font = 'bold 40px sans-serif'; g.fillStyle = '#e0e2e6';
    g.fillText('SPORT · OCCASIONS · SERVICE', w * 0.13, h * 0.47);
    g.fillText('SNEEK', w * 0.89, h * 0.47);
  });
}
// de zuil aan de weg: staand, met het logo en wat er staat
function zuilDoek() {
  return doek(256, 1024, (g, w, h) => {
    g.fillStyle = '#1b1d21'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c40a12'; g.fillRect(0, 60, w, 150);
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 120px sans-serif'; g.fillText('AL', w / 2, 138);
    g.font = 'bold 44px sans-serif';
    g.fillText('AUTOHUIS', w / 2, 290); g.fillText('LEMMER-', w / 2, 350); g.fillText('WEG', w / 2, 410);
    g.fillStyle = '#f2bf00'; g.font = 'bold 38px sans-serif';
    g.fillText('FERRARI', w / 2, 560);
    g.fillStyle = '#e0e2e6'; g.font = '34px sans-serif';
    g.fillText('vanaf € 3.000', w / 2, 612);
    g.fillText('CITROËN BX', w / 2, 720); g.fillText('€ 250', w / 2, 768);
    g.fillStyle = '#c40a12'; g.fillRect(0, h - 90, w, 10);
  });
}
// het bordje bij een auto
function prijsDoek(a) {
  return doek(256, 192, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c40a12'; g.fillRect(0, 0, w, 40);
    g.fillStyle = '#ffffff'; g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(a.merk, w / 2, 21);
    g.fillStyle = '#44474c'; g.font = 'italic 24px sans-serif';
    g.fillText(a.kleurNaam, w / 2, 70);
    g.fillStyle = '#16181b'; g.font = 'bold 50px sans-serif';
    g.fillText(`€ ${a.prijs.toLocaleString('nl-NL')}`, w / 2, 124);
    g.fillStyle = '#6a6e74'; g.font = '19px sans-serif';
    g.fillText(a.soort === 'ferrari' ? '0-100 in 3,1 s · 200+ km/u' : a.soort === 'gti' ? '0-100 in 6,4 s · 150 km/u' : 'hydropneumatisch · APK', w / 2, 168);
  });
}
// het wandbord achterin
function wandDoek() {
  return doek(1024, 320, (g, w, h) => {
    g.fillStyle = '#1b1d21'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c40a12'; g.fillRect(0, 0, 26, h);
    g.fillStyle = '#ffffff'; g.font = 'bold 96px sans-serif'; g.textBaseline = 'middle';
    g.fillText('AUTOHUIS', 70, 110); g.fillText('LEMMERWEG', 70, 210);
    g.fillStyle = '#9ca1a8'; g.font = '30px sans-serif';
    g.fillText('rijden zoals het hoort — sinds 1987', 72, 285);
  });
}

// ---------- materialen ----------
function materialen() {
  const std = (kleur, extra = {}) => new THREE.MeshStandardMaterial({ color: kleur, roughness: 0.7, ...extra });
  const vloer = vloerDoek(), klinker = klinkerDoek(), paneel = paneelDoek();
  const naam = naamDoek(), zuil = zuilDoek(), wand = wandDoek();
  return {
    /*
     Het glas. Een ruit van een showroom is helder: je moet er de auto's door
     zien. Weinig dekking en een sterke spiegeling, en geen diepte schrijven, zodat
     wat erachter staat gewoon getekend wordt.
    */
    glas: std(0xb9d2dc, { roughness: 0.04, metalness: 0.25, transparent: true, opacity: 0.2, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide }),
    alu: std(0x25282c, { roughness: 0.35, metalness: 0.65 }),
    paneel: std(0xffffff, { map: paneel, roughness: 0.6, emissive: 0xffffff, emissiveMap: paneel, emissiveIntensity: 0.0 }),
    plint: std(0x44474c, { roughness: 0.8 }),
    band: std(0x1b1d21, { roughness: 0.45, metalness: 0.3 }),
    dak: std(0xf1f1ef, { roughness: 0.9, emissive: 0xf1f1ef, emissiveIntensity: 0.12 }),
    lamp: std(0xffffff, { emissive: 0xfff8ea, emissiveIntensity: 1.25, roughness: 1 }),
    vloer: std(0xffffff, { map: vloer, roughness: 0.14, metalness: 0.05, envMapIntensity: 1.1, emissive: 0xffffff, emissiveMap: vloer, emissiveIntensity: 0.1 }),
    klinker: std(0xffffff, { map: klinker, roughness: 0.9 }),
    schijf: std(0x2e3136, { roughness: 0.22, metalness: 0.85 }),
    led: std(0xff2a1a, { emissive: 0xff2a1a, emissiveIntensity: 1.4 }),
    balie: std(0xf4f4f2, { roughness: 0.4, emissive: 0xf4f4f2, emissiveIntensity: 0.1 }),
    blad: std(0x121315, { roughness: 0.25, metalness: 0.2 }),
    scherm: std(0x0b1016, { emissive: 0x2a5d8f, emissiveIntensity: 0.6, roughness: 0.2 }),
    bank: std(0x3a3e46, { roughness: 0.95 }),
    pot: std(0x2a2b2e, { roughness: 0.6 }),
    plant: std(0x3e7a35, { roughness: 0.9 }),
    rood: std(0xc40a12, { roughness: 0.5, emissive: 0xc40a12, emissiveIntensity: 0.15 }),
    naam: std(0xffffff, { map: naam, emissive: 0xffffff, emissiveMap: naam, emissiveIntensity: 0.35, roughness: 0.5 }),
    zuil: std(0xffffff, { map: zuil, emissive: 0xffffff, emissiveMap: zuil, emissiveIntensity: 0.35, roughness: 0.5 }),
    wand: std(0xffffff, { map: wand, emissive: 0xffffff, emissiveMap: wand, emissiveIntensity: 0.25, roughness: 0.5 }),
  };
}

/**
 * De showroom opzetten. `verhaal` voor de portemonnee (`betaal`), `vehicles`
 * om de gekochte auto neer te zetten, `sfeer` voor de avond (`ramenAan`).
 */
export function initGarage({ scene, player, vehicles, hud, verhaal, sfeer = null }) {
  const M = materialen();
  const groep = new THREE.Group();
  groep.name = 'garage';
  scene.add(groep);
  const praatEl = document.getElementById('praat');

  const blok = (b, h, d, mat, x, y, z, { schaduw = true, ontvang = true } = {}) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = schaduw; m.receiveShadow = ontvang;
    groep.add(m);
    return m;
  };
  const herhaal = (tex, u, v) => { const t = tex.clone(); t.needsUpdate = true; t.repeat.set(u, v); return t; };

  const B = X1 - X0, D = Z1 - Z0, MX = (X0 + X1) / 2, MZ = (Z0 + Z1) / 2;

  // ---- de vloer, het voorterrein en de inrit ----
  const vloerMat = M.vloer.clone();
  vloerMat.map = herhaal(M.vloer.map, B / 2.4, D / 2.4); vloerMat.emissiveMap = vloerMat.map;
  blok(B, 0.18, D, vloerMat, MX, VLOER - 0.09, MZ, { schaduw: false });
  const V = GARAGE.voor, I = GARAGE.inrit;
  const klinkerVoor = M.klinker.clone();
  klinkerVoor.map = herhaal(M.klinker.map, (V.x1 - V.x0) / 1.6, (V.z1 - V.z0) / 1.6);
  blok(V.x1 - V.x0, 0.12, V.z1 - V.z0, klinkerVoor, (V.x0 + V.x1) / 2, VLOER - 0.065, (V.z0 + V.z1) / 2, { schaduw: false });
  const klinkerIn = M.klinker.clone();
  klinkerIn.map = herhaal(M.klinker.map, (I.x1 - I.x0) / 1.6, (I.z1 - I.z0) / 1.6);
  blok(I.x1 - I.x0, 0.12, I.z1 - I.z0, klinkerIn, (I.x0 + I.x1) / 2, VLOER - 0.065, (I.z0 + I.z1) / 2, { schaduw: false });
  // witte strepen tussen de plekken op het voorterrein
  for (const p of AFLEVER) for (const s of [-1, 1]) {
    blok(4.8, 0.01, 0.1, M.balie, p.x, VLOER + 0.005, p.z + s * 3.1, { schaduw: false });
  }

  // ---- de voorgevel: glas, stijlen, een kalf op deurhoogte ----
  const glasH = H - VLOER;
  const ruit = (b, h, x, y, z, langsZ) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(langsZ ? 0.03 : b, h, langsZ ? b : 0.03), M.glas);
    m.position.set(x, y, z); m.renderOrder = 2;
    groep.add(m);
    return m;
  };
  ruit(DEUR_Z0 - Z0, glasH, X0, VLOER + glasH / 2, (Z0 + DEUR_Z0) / 2, true);
  ruit(Z1 - DEUR_Z1, glasH, X0, VLOER + glasH / 2, (DEUR_Z1 + Z1) / 2, true);
  ruit(VAK, H - DEUR_H, X0, DEUR_H + (H - DEUR_H) / 2, DEUR_Z, true);        // boven de deur
  for (let i = 0; i <= D / VAK + 0.01; i++) blok(0.14, glasH, 0.09, M.alu, X0, VLOER + glasH / 2, Z0 + i * VAK);
  blok(0.16, 0.10, D, M.alu, X0, DEUR_H, MZ);                               // het kalf
  blok(0.18, 0.12, D, M.alu, X0, VLOER + 0.06, MZ);                          // de onderdorpel
  // ---- de zijgevels: twaalf meter glas, dan witte plaat ----
  const paneelMat = M.paneel.clone();
  paneelMat.map = herhaal(M.paneel.map, (B - GLAS_DIEP) / 1.2, 1); paneelMat.emissiveMap = paneelMat.map;
  for (const z of [Z0, Z1]) {
    ruit(GLAS_DIEP, glasH, X0 + GLAS_DIEP / 2, VLOER + glasH / 2, z, false);
    for (let x = X0 + 3; x <= X0 + GLAS_DIEP + 0.01; x += 3) blok(0.09, glasH, 0.14, M.alu, x, VLOER + glasH / 2, z);
    blok(GLAS_DIEP, 0.10, 0.16, M.alu, X0 + GLAS_DIEP / 2, DEUR_H, z);
    blok(GLAS_DIEP, 0.12, 0.18, M.alu, X0 + GLAS_DIEP / 2, VLOER + 0.06, z);
    blok(B - GLAS_DIEP, H, 0.25, paneelMat, X1 - (B - GLAS_DIEP) / 2, H / 2, z);
    blok(B - GLAS_DIEP + 0.02, 0.4, 0.27, M.plint, X1 - (B - GLAS_DIEP) / 2, 0.2, z);
  }
  // ---- de achtergevel ----
  const achterMat = M.paneel.clone();
  achterMat.map = herhaal(M.paneel.map, D / 1.2, 1); achterMat.emissiveMap = achterMat.map;
  blok(0.25, H, D + 0.25, achterMat, X1, H / 2, MZ);
  blok(0.27, 0.4, D + 0.27, M.plint, X1, 0.2, MZ);
  // ---- hoekstijlen ----
  for (const z of [Z0, Z1]) blok(0.22, H, 0.22, M.alu, X0, H / 2, z);

  // ---- het dak met de luifel, en de band met de naam ----
  blok(B + LUIFEL + 0.2, DAK, D + 0.4, M.dak, (X0 - LUIFEL + X1 + 0.2) / 2, H + DAK / 2, MZ);
  const bandY = H + DAK - BAND / 2 + 0.25;
  blok(0.22, BAND, D + 0.84, M.band, X0 - LUIFEL - 0.11, bandY, MZ);                                    // voor
  for (const s of [-1, 1]) blok(B + LUIFEL + 0.44, BAND, 0.22, M.band, (X0 - LUIFEL + X1) / 2 + 0.1, bandY, MZ + s * (D / 2 + 0.31));
  blok(0.22, BAND, D + 0.84, M.band, X1 + 0.31, bandY, MZ);                                              // achter
  const naam = new THREE.Mesh(new THREE.PlaneGeometry(D - 1.2, BAND * 0.78), M.naam);
  naam.position.set(X0 - LUIFEL - 0.225, bandY, MZ); naam.rotation.y = -Math.PI / 2;
  groep.add(naam);
  for (const s of [-1, 1]) {
    const zij = new THREE.Mesh(new THREE.PlaneGeometry(B * 0.9, BAND * 0.78), M.naam);
    zij.position.set((X0 - LUIFEL + X1) / 2 + 0.1, bandY, MZ + s * (D / 2 + 0.425)); zij.rotation.y = s > 0 ? 0 : Math.PI;
    groep.add(zij);
  }
  // spotjes onder de luifel
  const spotGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.03, 16);
  for (let z = Z0 + VAK / 2; z < Z1; z += VAK) {
    const s = new THREE.Mesh(spotGeo, M.lamp); s.position.set(X0 - LUIFEL / 2, H - 0.01, z); groep.add(s);
  }
  // ---- lichtpanelen aan het plafond ----
  for (let x = X0 + 3.5; x < X1 - 1; x += 4) for (let z = Z0 + 3; z < Z1 - 1; z += 5) {
    blok(1.2, 0.04, 1.2, M.lamp, x, H - 0.02, z, { schaduw: false, ontvang: false });
  }

  // ---- binnen: het wandbord, de balie, de koffiehoek en planten ----
  const wand = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 2.25), M.wand);
  wand.position.set(X1 - 0.13, 3.3, MZ); wand.rotation.y = -Math.PI / 2;
  groep.add(wand);
  blok(0.03, 0.30, D - 0.4, M.rood, X1 - 0.14, 1.05, MZ, { schaduw: false });
  const BALIE = { x: 784.4, z: 139.8 };
  blok(0.8, 1.02, 2.8, M.balie, BALIE.x, VLOER + 0.51, BALIE.z);
  blok(0.9, 0.05, 2.9, M.blad, BALIE.x, VLOER + 1.045, BALIE.z);
  blok(0.05, 0.36, 0.56, M.scherm, BALIE.x + 0.15, VLOER + 1.27, BALIE.z - 0.6);
  blok(0.10, 0.18, 0.08, M.alu, BALIE.x + 0.18, VLOER + 1.12, BALIE.z - 0.6);
  for (const dz of [-0.7, 0.7]) {
    blok(0.46, 0.08, 0.46, M.bank, BALIE.x - 1.05, VLOER + 0.66, BALIE.z + dz);
    blok(0.06, 0.62, 0.06, M.alu, BALIE.x - 1.05, VLOER + 0.31, BALIE.z + dz);
  }
  const HOEK = { x: 785.9, z: 124.6 };
  blok(0.95, 0.44, 2.6, M.bank, HOEK.x, VLOER + 0.22, HOEK.z);
  blok(0.25, 0.46, 2.6, M.bank, HOEK.x + 0.38, VLOER + 0.66, HOEK.z);
  blok(0.7, 0.05, 1.3, M.blad, HOEK.x - 1.35, VLOER + 0.45, HOEK.z);
  blok(0.08, 0.40, 0.08, M.alu, HOEK.x - 1.35, VLOER + 0.21, HOEK.z);
  const bolGeo = new THREE.IcosahedronGeometry(0.55, 2);
  for (const [x, z] of [[787.0, 121.1], [787.0, 144.9], [771.1, 121.1], [771.1, 144.9], [786.9, 136.4]]) {
    blok(0.5, 0.6, 0.5, M.pot, x, VLOER + 0.3, z);
    const bol = new THREE.Mesh(bolGeo, M.plant); bol.position.set(x, VLOER + 1.15, z); bol.scale.set(1, 1.35, 1);
    bol.castShadow = true; groep.add(bol);
  }

  // ---- de auto's, de draaischijf en de prijsbordjes ----
  const modellen = [];
  const bordGeo = new THREE.PlaneGeometry(0.62, 0.465);
  for (const a of TE_KOOP) {
    const auto = makeCar(a.kleur, a.soort, false);
    auto.position.set(a.x, VLOER + (a.draai ? 0.12 : 0), a.z); auto.rotation.y = a.yaw;
    groep.add(auto);
    let schijf = null;
    if (a.draai) {
      schijf = new THREE.Mesh(new THREE.CylinderGeometry(SCHIJF_R, SCHIJF_R, 0.12, 48), M.schijf);
      schijf.position.set(a.x, VLOER + 0.06, a.z); schijf.receiveShadow = true;
      groep.add(schijf);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(SCHIJF_R + 0.02, 0.025, 6, 64), M.led);
      ring.rotation.x = Math.PI / 2; ring.position.set(a.x, VLOER + 0.1, a.z);
      groep.add(ring);
    }
    // het bordje op een zuiltje, schuin naar het gangpad
    blok(0.06, 1.0, 0.06, M.alu, a.bord.x, VLOER + 0.5, a.bord.z);
    const bordMesh = new THREE.Mesh(bordGeo, new THREE.MeshStandardMaterial({ map: prijsDoek(a), roughness: 0.6, emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0 }));
    bordMesh.material.emissiveMap = bordMesh.material.map;
    bordMesh.position.set(a.bord.x, VLOER + 1.12, a.bord.z);
    bordMesh.rotation.set(-0.35, -Math.PI / 2 + (a.bord.z < a.z ? 0.5 : -0.5), 0, 'YXZ');
    groep.add(bordMesh);
    // een botsdoos om de auto, zodat je er niet doorheen loopt (auto's negeren hem)
    const r = a.draai ? SCHIJF_R : 0;
    const bots = r ? addCollider(a.x, a.z, r * 0.75, r * 0.75, 0, 1.3)
      : addCollider(a.x, a.z, 0.98, 2.28, a.yaw, 1.3);   // yaw zoals js/world.js hem draait: lz langs de auto
    // (niet `bord`: dat is al de plek van het bordje, { x, z })
    modellen.push({ ...a, auto, schijf, bordMesh, bots });
  }

  // ---- Sjoerd, achter de balie ----
  const sjoerd = new Persoon({ shirt: 0xf4f4f2, broek: 0x1d2330, haar: 0x6b5842, huid: 0xd9b48f, vest: 0x1b1d21 });
  sjoerd.zetNeer(BALIE.x + 0.95, BALIE.z + 0.2, -Math.PI / 2);
  scene.add(sjoerd.groep);

  // ---- de zuil aan de weg ----
  const ZUIL = { x: 753.8, z: 121.8 };
  blok(0.45, 6.2, 1.3, M.band, ZUIL.x, 3.1, ZUIL.z);
  for (const s of [-1, 1]) {
    const vlak = new THREE.Mesh(new THREE.PlaneGeometry(1.16, 4.6), M.zuil);
    vlak.position.set(ZUIL.x, 3.55, ZUIL.z + s * 0.656); vlak.rotation.y = s > 0 ? 0 : Math.PI;
    groep.add(vlak);
  }
  addCollider(ZUIL.x, ZUIL.z, 0.3, 0.7, 0, BOTS_H);

  // ---- de schuifdeur: twee bladen die opzij schuiven ----
  const bladen = [-1, 1].map(s => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.03, DEUR_H - VLOER - 0.06, VAK / 2 - 0.02), M.glas);
    b.renderOrder = 2; g.add(b);
    for (const dz of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.06, DEUR_H - VLOER, 0.06), M.alu); st.position.z = dz * (VAK / 4 - 0.02); g.add(st); }
    g.position.set(X0 + 0.09, VLOER + (DEUR_H - VLOER) / 2, DEUR_Z + s * VAK / 4);
    groep.add(g);
    return { g, s };
  });
  let deurOpen = 0;

  // ---- botsingen: de gevels, met een gat voor de deur ----
  addCollider(X0, (Z0 + DEUR_Z0) / 2, 0.15, (DEUR_Z0 - Z0) / 2, 0, BOTS_H);
  addCollider(X0, (DEUR_Z1 + Z1) / 2, 0.15, (Z1 - DEUR_Z1) / 2, 0, BOTS_H);
  const deurBots = addCollider(X0, DEUR_Z, 0.15, VAK / 2, 0, BOTS_H);
  for (const z of [Z0, Z1]) addCollider(MX, z, B / 2 + 0.15, 0.15, 0, BOTS_H);
  addCollider(X1, MZ, 0.15, D / 2 + 0.15, 0, BOTS_H);
  addCollider(BALIE.x, BALIE.z, 0.45, 1.45, 0, 1.2);
  addCollider(HOEK.x, HOEK.z, 0.5, 1.3, 0, 1.0);

  // ---------- binnen of niet ----------
  const binnen = (x, z) => x > X0 && x < X1 && z > Z0 && z < Z1;
  /*
   Welke auto koop je hier? Die naast wie je staat, of die van het bordje waar
   je voor staat. Het bordje staat bijna vier meter van het hart van de auto
   (hij is 4,56 m lang): alleen vanaf het hart meten liet je er voor het bordje
   net buiten vallen, en dan pakte E een andere auto om in te stappen.
  */
  function bijAuto(x, z) {
    if (!binnen(x, z)) return null;
    let beste = null, bd = Infinity;
    for (const m of modellen) {
      const d = Math.min(Math.hypot(m.x - x, m.z - z) - (KOOP_BEREIK - BORD_BEREIK), Math.hypot(m.bord.x - x, m.bord.z - z));
      if (d < BORD_BEREIK && d < bd) { bd = d; beste = m; }
    }
    return beste;
  }

  // ---------- kopen ----------
  const eigen = [];            // { id, soort, kleur, naam, car }
  let volgende = 1;
  const euro = n => `€ ${n.toLocaleString('nl-NL')}`;
  function vrijePlek() {
    for (const p of AFLEVER) {
      const bezet = vehicles.cars.some(c => c.driveable !== false && !c.weg && Math.hypot(c.x - p.x, c.z - p.z) < 3);
      if (!bezet) return p;
    }
    return AFLEVER[0];
  }
  function neerzetten(soort, kleur, naam, p, id = volgende++) {
    const car = vehicles.voegToe({ x: p.x, z: p.z, yaw: p.yaw, soort, kleur });
    car.eigen = id;
    eigen.push({ id, soort, kleur, naam, car });
    return car;
  }
  function koop(m) {
    if (!m) return false;
    if (!verhaal || !verhaal.betaal || !verhaal.betaal(m.prijs)) {
      const geld = verhaal && typeof verhaal.geld === 'number' ? ` Je hebt ${euro(verhaal.geld)}.` : '';
      if (hud) hud.melding('Te weinig geld', `Sjoerd: "De ${m.naam} kost ${euro(m.prijs)}."${geld}`, 4);
      return false;
    }
    const p = vrijePlek();
    const car = neerzetten(m.soort, m.kleur, m.naam, p);
    if (hud) hud.melding(`${m.naam[0].toUpperCase()}${m.naam.slice(1)} gekocht`,
      `${euro(m.prijs)} betaald. Sjoerd: "Hij staat buiten voor de deur, de sleutels zitten erin.${m.soort === 'ferrari' ? ' Rustig aan op de Lemmerweg!' : ''}"`, 6);
    return car;
  }

  // E: kopen als je bij een auto staat. Geeft true als de toets gebruikt is.
  function toets() {
    if (!player.active && !window.__autoplay) return false;
    if (player.inCar) return false;
    const m = bijAuto(player.pos.x, player.pos.z);
    if (!m) return false;
    koop(m);
    return true;
  }

  // ---------- elk beeld ----------
  let hintAan = false, gloed = -1;
  function update(dt, bezet = false) {
    const px = player.pos.x, pz = player.pos.z;
    const dichtbij = Math.abs(px - MX) < 160 && Math.abs(pz - MZ) < 160;
    // de draaischijf en Sjoerd, alleen als je er in de buurt bent
    if (dichtbij) {
      for (const m of modellen) if (m.draai) {
        m.yaw += SCHIJF_V * dt;
        m.auto.rotation.y = m.yaw;
        if (m.schijf) m.schijf.rotation.y = m.yaw;
      }
      if (Math.hypot(px - sjoerd.groep.position.x, pz - sjoerd.groep.position.z) < 14 && !player.inCar) {
        sjoerd.kijkNaar(px, pz, dt, 2.0);
      }
      sjoerd.update(dt, { loopt: false });
    }
    // de schuifdeur: open als je te voet voor of achter de deur staat
    const bijDeur = !player.inCar && Math.abs(px - X0) < DEUR_BEREIK && Math.abs(pz - DEUR_Z) < DEUR_BEREIK * 0.8;
    const doel = bijDeur ? 1 : 0;
    if (deurOpen !== doel) {
      deurOpen = doel > deurOpen ? Math.min(1, deurOpen + dt / 0.6) : Math.max(0, deurOpen - dt / 0.8);
      const f = deurOpen * deurOpen * (3 - 2 * deurOpen);
      for (const b of bladen) b.g.position.z = DEUR_Z + b.s * (VAK / 4 + f * (VAK / 2 - 0.1));
      deurBots.h = deurOpen > 0.55 ? 0 : BOTS_H;
    }
    // 's avonds licht het binnen en de naam op
    const avond = sfeer && typeof sfeer.ramenAan === 'number' ? sfeer.ramenAan : 0;
    if (Math.abs(avond - gloed) > 0.02) {
      gloed = avond;
      vloerMat.emissiveIntensity = 0.1 + avond * 0.32;
      for (const m of [paneelMat, achterMat]) m.emissiveIntensity = avond * 0.22;
      M.balie.emissiveIntensity = 0.1 + avond * 0.35;
      M.dak.emissiveIntensity = 0.12 + avond * 0.4;
      M.naam.emissiveIntensity = 0.35 + avond * 0.75;
      M.zuil.emissiveIntensity = 0.35 + avond * 0.75;
      M.wand.emissiveIntensity = 0.25 + avond * 0.5;
      for (const m of modellen) m.bordMesh.material.emissiveIntensity = 0.15 + avond * 0.5;
    }

    // de balk: "E — … kopen"
    if (bezet) { if (hintAan) praatEl.hidden = true; hintAan = false; return; }
    let tekst = null;
    if ((player.active || window.__autoplay) && !player.inCar) {
      const m = bijAuto(px, pz);
      if (m) tekst = `E — ${m.naam} kopen (${euro(m.prijs)})`;
    }
    if (tekst) {
      praatEl.textContent = tekst; praatEl.hidden = false; hintAan = true;
    } else if (hintAan) {
      praatEl.hidden = true; hintAan = false;
    }
  }

  // ---------- opslaan ----------
  // De gekochte auto's, waar ze nu staan. Een wrak is niet meer van jou.
  function bewaar() {
    return eigen.filter(e => e.car && !e.car.wrak && !e.car.weg && (e.car.hp ?? 100) > 0)
      .map(e => ({ id: e.id, soort: e.soort, kleur: e.kleur, naam: e.naam, x: +e.car.x.toFixed(2), z: +e.car.z.toFixed(2), yaw: +e.car.yaw.toFixed(3) }));
  }
  /*
   Terugzetten. Wat er nu van jou is gaat eerst weg: niet uit de lijst van
   js/vehicles.js gehaald (dan schuiven de nummers van alle auto's daarna op, en
   daar rekent de opslag mee), maar ver buiten de wereld gezet en niet meer
   bestuurbaar. Staat er op de plek al een auto van dezelfde soort en kleur — de
   auto op de oprit, die js/verhaal.js al teruggezet heeft — dan is dat de jouwe.
  */
  function herstel(lijst) {
    for (const e of eigen.splice(0)) weg(e.car);
    if (!Array.isArray(lijst)) return;
    for (const s of lijst) {
      if (!s || !s.soort) continue;
      const al = vehicles.cars.find(c => c.driveable !== false && !c.weg && c.eigen == null && c.soort === s.soort
        && c.kleur === s.kleur && Math.hypot(c.x - s.x, c.z - s.z) < 4);
      if (al) {
        al.eigen = s.id; eigen.push({ id: s.id, soort: s.soort, kleur: s.kleur, naam: s.naam, car: al });
      } else {
        neerzetten(s.soort, s.kleur, s.naam || s.soort, { x: s.x, z: s.z, yaw: s.yaw || 0 }, s.id);
      }
      volgende = Math.max(volgende, (s.id || 0) + 1);
    }
  }
  function weg(car) {
    if (!car) return;
    car.driveable = false; car.weg = true; car.speed = 0;
    car.x = car.z = 1e5;
    if (car.mesh) { car.mesh.visible = false; car.mesh.position.set(1e5, 0, 1e5); }
  }

  return {
    update, toets, koop, bewaar, herstel, binnen, bijAuto,
    autoVan: id => (eigen.find(e => e.id === id) || {}).car || null,
    idVan: car => (car && car.eigen != null && eigen.some(e => e.car === car)) ? car.eigen : null,
    get eigen() { return eigen.map(e => ({ id: e.id, soort: e.soort, kleur: e.kleur, naam: e.naam, car: e.car })); },
    get modellen() { return modellen; },
    get deur() { return { x: X0, z: DEUR_Z, open: deurOpen, bots: deurBots.h }; },
    get plekken() { return { aflever: AFLEVER.map(p => ({ ...p })), balie: BALIE, hoek: HOEK, zuil: ZUIL }; },
    get maten() { return { x0: X0, x1: X1, z0: Z0, z1: Z1, hoog: H, vloer: VLOER, glasDiep: GLAS_DIEP }; },
    get groep() { return groep; },
    get sjoerd() { return sjoerd; },
    get winkels() { return [{ x: X0 - 1, z: DEUR_Z, naam: NAAM, wat: "auto's" }]; },
  };
}
