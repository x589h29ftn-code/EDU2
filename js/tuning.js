/*
 Tuning en decals bij Autohuis Lemmerweg (gevraagd: "Tuning ook toevoegen bij garage huis bij de balie.
 Alleen met je eigen gekochte auto. Voeg ook optie om decals toe te voegen op de auto zoals logo radio
 spannenburg. Radio Markant en bedenk er nog paar random zonder radio").

 Waar: aan het eind van de balie staat een zuil met een scherm TUNING (`TUNING.zuil`), en op de wand
 erachter hetzelfde bord. Je staat er op `TUNING.plek`. Dat is bewust niet bij Sjoerd zelf: daar biedt
 hij na missie 14 de race voor geld aan (`geldraceToets` in js/verhaal.js, binnen 2,8 m van de balie),
 en die E gaat vóór. Het gebied van de tuning (`bereik`) blijft daarom overal minstens `balieVrij` van
 het hart van de balie: de twee kunnen elkaar nooit een toets afpakken.

 Alleen voor je eigen auto: een auto die je in de showroom kocht (`auto.eigen`, js/garage.js) en die
 op het voorterrein staat, of vlak bij de deur. Anders zegt Sjoerd dat je hem eerst voor moet rijden.

 Wat er te koop is (`TUNING`):
   1 motor        +12 % topsnelheid en trek (`topSnelheid`, `trek` van js/vehicles.js)
   2 sportvering  +15 % grip in de bocht, en de carrosserie (de `bak`) drie centimeter lager
   3 spoiler      een vleugel op twee steunen op de kofferklep; de vleugel zelf is in de lak (`userData.lak`),
                  dus de spuiterij (`vehicles.verf`) spuit hem mee. De Ferrari heeft er al een.
   4 velgen       zwart mat, goud met tien spaken of een witte schotel, of terug naar standaard (gratis)
   5 decals       drie plekken op de auto: de deur (beide kanten), de motorkap en de flanken voorin.
                  Een nieuwe decal op een bezette plek vervangt de oude; dezelfde nog eens kiezen haalt
                  hem eraf, gratis, en 9 haalt alles eraf.

 De decals zijn doeken op canvas (de radiologo's uit js/textures.js, de rest hieronder), geplakt zoals de
 schade van js/autoschade.js: in de carrosseriegroep `bak`, dus ze hellen mee in de bocht. Maar een plat
 vlak op een bolle flank ligt er half in en half naast; daarom is een decal hier een rooster, en elk
 hoekpunt zoekt met een straal van buitenaf het echte plaatwerk op (in het assenstelsel van het model,
 tegen de lak, het glas en de zwarte delen van `autoVorm`). Een hoekpunt dat glas, een zwarte bumper of
 de wielkast raakt, of niets, valt weg met zijn driehoeken: de decal stopt bij de ruit en bij de wielboog,
 zoals een echte sticker die je eromheen snijdt. Het rooster is per soort auto en per decal hetzelfde,
 dus het wordt één keer berekend en gedeeld.

 Wat je koopt hoort bij die auto (`car.tuning`) en gaat mee in de opslag: js/garage.js `bewaar` schrijft
 het weg en `herstel` zet het met `pasToe` terug.

 Alle materialen bestaan vanaf het opstarten en hangen in een verborgen staal in de scene, zodat
 `soortenVoorbereid` (js/world.js) hun shaders vooraf vertaalt: tunen voegt tijdens het spelen geen
 programma toe (stap 83, `npm run vloeiendtest`).
*/
import * as THREE from 'three';
import { addCollider } from './world.js';
import { autoVorm, lakVoor } from './carmodel.js';
import { bordSpannenburg, logoTinga, logo100nl } from './textures.js';
import { GARAGE } from './bouwvlak.js';

export const TUNING = {
  plek: { x: 783.4, z: 144.0 },      // waar je staat (aan het eind van de balie, kant van de wand)
  zuil: { x: 784.6, z: 144.0 },      // de zuil met het scherm
  bereik: 1.3,                       // zo dicht bij de plek gaat E naar de tuning
  balieVrij: 2.9,                    // en minstens zo ver van het hart van de balie (de geldrace zit op 2,8)
  autoBereik: 16,                    // je eigen auto: op het voorterrein, of zo dicht bij de plek
  sluitVanaf: 3.2,                   // verder weggelopen: het menu gaat dicht
  motor: { prijs: 1500, factor: 1.12 },
  vering: { prijs: 800, grip: 1.15, lager: 0.03 },
  spoiler: { prijs: 400 },
  velg: { prijs: 300 },
  decal: { prijs: 150 },
};

const VLOER = 0.13;                  // de vloer van de showroom (js/garage.js)
const euro = n => `€ ${n.toLocaleString('nl-NL')}`;

// ---------- doeken ----------
function doek(b, h, teken) {
  const c = document.createElement('canvas'); c.width = b; c.height = h;
  teken(c.getContext('2d'), b, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/*
 Radio Markant: een rood schild in de vorm van een trapezium, schuin gezet, met "Radio" klein en
 "Markant" groot in wit, en onder het rood een grijs vlak.
*/
function markantDoek() {
  return doek(512, 256, (g, b, h) => {
    g.translate(b / 2, h / 2); g.rotate(-0.07); g.translate(-b / 2, -h / 2);
    // het grijze vlak eronder, iets smaller, zoals de voet van het schild
    g.fillStyle = '#8d9096';
    g.beginPath(); g.moveTo(92, 186); g.lineTo(452, 186); g.lineTo(436, 236); g.lineTo(104, 236); g.closePath(); g.fill();
    // het rode trapezium: boven breed, onder smaller, en schuin naar rechts
    const rood = g.createLinearGradient(0, 18, 0, 182);
    rood.addColorStop(0, '#e3222b'); rood.addColorStop(1, '#b80d16');
    g.fillStyle = rood;
    g.beginPath(); g.moveTo(48, 18); g.lineTo(500, 18); g.lineTo(462, 180); g.lineTo(84, 180); g.closePath(); g.fill();
    // een smalle lichte rand bovenin, de glans van het schild
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.beginPath(); g.moveTo(52, 22); g.lineTo(496, 22); g.lineTo(493, 34); g.lineTo(55, 34); g.closePath(); g.fill();
    g.fillStyle = '#ffffff'; g.textBaseline = 'alphabetic';
    g.font = 'italic 700 38px system-ui, sans-serif';
    g.fillText('Radio', 96, 70);
    g.font = 'italic 900 100px system-ui, sans-serif';
    g.fillText('Markant', 84, 160, 380);
  });
}

// een racenummer in een wit rondje met een zwarte rand
function nummerDoek() {
  return doek(256, 256, (g, b, h) => {
    g.fillStyle = '#111214'; g.beginPath(); g.arc(b / 2, h / 2, 122, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f6f6f2'; g.beginPath(); g.arc(b / 2, h / 2, 108, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#111214'; g.font = '900 136px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('23', b / 2, h / 2 + 8, 190);
  });
}

// Tinga Racing: een wapperende finishvlag en de naam, wit met een zwarte rand (leesbaar op elke lak)
function racingDoek() {
  return doek(512, 256, (g, b, h) => {
    const n = 7, m = 5, vak = 22;
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const x = 22 + i * vak, y = 64 + j * vak + Math.sin(i * 0.9) * 9;
      g.fillStyle = (i + j) % 2 ? '#111214' : '#f6f6f2';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + vak, y + Math.sin((i + 1) * 0.9) * 9 - Math.sin(i * 0.9) * 9);
      g.lineTo(x + vak, y + vak + Math.sin((i + 1) * 0.9) * 9 - Math.sin(i * 0.9) * 9); g.lineTo(x, y + vak); g.closePath(); g.fill();
    }
    g.fillStyle = '#2a2b2e'; g.fillRect(14, 54, 8, 170);
    g.lineJoin = 'round'; g.textBaseline = 'alphabetic';
    const tekst = (t, x, y, font) => {
      g.font = font;
      g.lineWidth = 10; g.strokeStyle = '#111214'; g.strokeText(t, x, y, 330);
      g.fillStyle = '#ffffff'; g.fillText(t, x, y, 330);
    };
    tekst('TINGA', 182, 118, 'italic 900 84px system-ui, sans-serif');
    g.fillStyle = '#ffd400'; g.fillRect(186, 132, 300, 9);
    tekst('RACING', 196, 200, 'italic 800 60px system-ui, sans-serif');
  });
}

// twee racestrepen over de lengte; het doek is één doorsnede, over de lengte overal hetzelfde
function strepenDoek() {
  return doek(64, 8, g => {
    g.fillStyle = '#f4f4f0';
    g.fillRect(2, 0, 25, 8); g.fillRect(37, 0, 25, 8);
    g.fillStyle = '#16171a';
    g.fillRect(0, 0, 2, 8); g.fillRect(27, 0, 1, 8); g.fillRect(36, 0, 1, 8); g.fillRect(62, 0, 2, 8);
  });
}

/*
 Vlammen. De voet zit rechts (dat is de neus van de auto, zie `flank`), de tongen lopen naar links,
 naar achteren. Drie lagen per tong: rood, oranje, geel.
*/
function vlammenDoek() {
  return doek(512, 176, (g, b, h) => {
    const tong = (yc, len, hh, kleur, rand) => {
      g.beginPath();
      g.moveTo(b, yc - hh);
      g.bezierCurveTo(b - len * 0.4, yc - hh * 1.5, b - len * 0.72, yc + hh * 0.2, b - len, yc - hh * 0.7);
      g.bezierCurveTo(b - len * 0.66, yc + hh * 0.9, b - len * 0.34, yc + hh * 1.25, b, yc + hh);
      g.closePath();
      g.fillStyle = kleur; g.fill();
      if (rand) { g.lineWidth = 3; g.strokeStyle = 'rgba(20,10,8,0.55)'; g.stroke(); }
    };
    const tongen = [[34, 330, 20], [62, 470, 24], [92, 400, 24], [120, 450, 22], [146, 300, 18]];
    for (const [y, l, hh] of tongen) tong(y, l, hh, '#d3141b', true);
    for (const [y, l, hh] of tongen) tong(y + 2, l * 0.78, hh * 0.68, '#ff8a1a', false);
    for (const [y, l, hh] of tongen) tong(y + 3, l * 0.52, hh * 0.4, '#ffe24a', false);
  });
}

// het bord bij de zuil en op de wand
function bordDoek() {
  return doek(512, 256, (g, b, h) => {
    g.fillStyle = '#14161b'; g.fillRect(0, 0, b, h);
    // een strook finishvlag bovenin
    for (let i = 0; i < 32; i++) for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? '#f2f2ee' : '#14161b'; g.fillRect(i * 16, j * 16, 16, 16);
    }
    g.fillStyle = '#ffd400'; g.font = 'italic 900 112px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillText('TUNING', b / 2, 150, 470);
    g.fillStyle = '#f2f4f8'; g.font = '700 46px system-ui, sans-serif';
    g.fillText('& DECALS', b / 2, 214, 470);
  });
}

// ---------- velgen ----------
// alle onderdelen samen in één geometrie, met een (lege) uv zoals de naaf van js/carmodel.js
function samen(delen) {
  const pos = [], nor = [];
  for (const g of delen) {
    const ng = g.index ? g.toNonIndexed() : g;
    pos.push(...ng.attributes.position.array);
    nor.push(...ng.attributes.normal.array);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pos.length / 3 * 2).fill(0), 2));
  return geo;
}
/*
 Dezelfde opbouw als `naafGeo` in js/carmodel.js: de velg zit aan de buitenkant van de band, op ±11 cm,
 aan allebei de kanten. De spaken steken een centimeter buiten de schijf uit, anders zie je ze niet.
*/
const VELG_GEO = new Map();
function velgGeo(R, stijl) {
  const sleutel = `${stijl}|${R}`;
  if (VELG_GEO.has(sleutel)) return VELG_GEO.get(sleutel);
  const delen = [];
  const schijf = (r, d, x, seg) => { const c = new THREE.CylinderGeometry(r, r, d, seg); c.rotateZ(Math.PI / 2); c.translate(x, 0, 0); return c; };
  for (const xs of [-1, 1]) {
    if (stijl === 'goud') {
      // kruisspaak: tien dunne spaken, om en om iets gedraaid
      delen.push(schijf(R * 0.64, 0.03, xs * 0.112, 20), schijf(R * 0.16, 0.055, xs * 0.12, 10));
      for (let i = 0; i < 10; i++) {
        const sp = new THREE.BoxGeometry(0.05, R * 0.5, 0.018);
        sp.rotateX(i % 2 ? 0.18 : -0.18);
        sp.translate(0, R * 0.36, 0);
        sp.rotateX(i * Math.PI * 2 / 10);
        sp.translate(xs * 0.112, 0, 0);
        delen.push(sp);
      }
    } else {
      // schotel: een dichte schijf met een grote kap en zes korte ribben
      delen.push(schijf(R * 0.66, 0.036, xs * 0.114, 24), schijf(R * 0.28, 0.06, xs * 0.122, 16));
      for (let i = 0; i < 6; i++) {
        const rib = new THREE.BoxGeometry(0.05, R * 0.22, 0.03);
        rib.translate(0, R * 0.44, 0);
        rib.rotateX(i * Math.PI * 2 / 6);
        rib.translate(xs * 0.112, 0, 0);
        delen.push(rib);
      }
    }
  }
  const geo = samen(delen);
  VELG_GEO.set(sleutel, geo);
  return geo;
}
export const VELGEN = [
  { id: 'zwart', naam: 'zwart mat' },
  { id: 'goud', naam: 'goud, kruisspaak' },
  { id: 'wit', naam: 'witte schotel' },
];

/*
 De decals. `plek` is waar hij komt: de deur (beide kanten), de motorkap ('kap', ook de strepen die
 over de kap en het dak lopen) of de flanken voorin ('vlam'). `verhouding` is breedte gedeeld door
 hoogte van het doek. `richting`: het doek heeft een voor- en achterkant (de vlammen), dus aan de
 linkerkant gespiegeld; tekst wordt nooit gespiegeld.
*/
export const DECALS = [
  { id: 'spannenburg', naam: 'Radio Spannenburg', plek: 'deur', doek: () => bordSpannenburg(), verhouding: 512 / 154 },
  { id: 'markant', naam: 'Radio Markant', plek: 'deur', doek: markantDoek, verhouding: 2 },
  { id: 'tinga', naam: 'Radio Tinga', plek: 'deur', doek: () => logoTinga(), verhouding: 512 / 154 },
  { id: '100nl', naam: '100% NL', plek: 'deur', doek: () => logo100nl(), verhouding: 512 / 154 },
  { id: 'nummer', naam: 'racenummer 23', plek: 'deur', doek: nummerDoek, verhouding: 1 },
  { id: 'racing', naam: 'Tinga Racing', plek: 'kap', doek: racingDoek, verhouding: 2 },
  { id: 'strepen', naam: 'racestrepen', plek: 'kap', doek: strepenDoek, streep: true },
  { id: 'vlammen', naam: 'vlammen', plek: 'vlam', doek: vlammenDoek, verhouding: 512 / 176, richting: true },
];
const PLEK_NAAM = { deur: 'deur', kap: 'motorkap', vlam: 'flanken' };
const LEEG = () => ({ motor: false, vering: false, spoiler: false, velg: null, decals: { deur: null, kap: null, vlam: null } });

// wat er opgeslagen staat netjes maken: onbekende waarden vallen weg
function schoon(g) {
  const t = LEEG();
  if (!g || typeof g !== 'object') return t;
  t.motor = !!g.motor; t.vering = !!g.vering; t.spoiler = !!g.spoiler;
  t.velg = VELGEN.some(v => v.id === g.velg) ? g.velg : null;
  const d = g.decals || {};
  for (const p of Object.keys(t.decals)) {
    const dec = DECALS.find(x => x.id === d[p]);
    t.decals[p] = dec && dec.plek === p ? dec.id : null;
  }
  return t;
}

export function initTuning({ scene, vehicles, garage, player, hud }) {
  // ---------- materialen, vanaf het opstarten ----------
  const opties = { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, roughness: 0.45, metalness: 0.1 };
  const DMAT = {};
  for (const d of DECALS) DMAT[d.id] = new THREE.MeshStandardMaterial({ ...opties, map: d.doek() });
  const VMAT = {
    zwart: new THREE.MeshStandardMaterial({ color: 0x17181b, metalness: 0.55, roughness: 0.45 }),
    goud: new THREE.MeshStandardMaterial({ color: 0xc9a03a, metalness: 0.9, roughness: 0.28 }),
    wit: new THREE.MeshStandardMaterial({ color: 0xefefeb, metalness: 0.15, roughness: 0.35 }),
  };
  const ZWART = new THREE.MeshStandardMaterial({ color: 0x141518, metalness: 0.3, roughness: 0.55 });
  const bordTex = bordDoek();
  const BORD = new THREE.MeshStandardMaterial({ map: bordTex, emissive: 0xffffff, emissiveMap: bordTex, emissiveIntensity: 0.55, roughness: 0.5 });
  const ZUILMAT = new THREE.MeshStandardMaterial({ color: 0x24262c, metalness: 0.4, roughness: 0.5 });

  // de vleugel en zijn steunen (gedeeld; de lak komt per auto uit `lakVoor`)
  const VLEUGEL = { blad: new THREE.BoxGeometry(1, 0.035, 0.25), plaat: new THREE.BoxGeometry(0.025, 0.15, 0.3), steun: new THREE.BoxGeometry(0.04, 1, 0.07) };

  // het verborgen staal: elk materiaal op een geometrie met uv, zoals ze straks echt hangen
  const staal = new THREE.Group(); staal.visible = false; staal.name = 'tuning-staal';
  const vlak = new THREE.PlaneGeometry(1, 1);
  for (const m of Object.values(DMAT)) staal.add(new THREE.Mesh(vlak, m));
  for (const [id, m] of Object.entries(VMAT)) staal.add(new THREE.Mesh(velgGeo(0.32, id === 'goud' ? 'goud' : 'wit'), m));
  staal.add(new THREE.Mesh(VLEUGEL.blad, lakVoor(0xc40a12)), new THREE.Mesh(VLEUGEL.steun, ZWART));
  scene.add(staal);

  // ---------- de zuil met het scherm, en het bord op de wand ----------
  const Z = TUNING.zuil;
  const zuil = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.25, 0.5), ZUILMAT);
  zuil.position.set(Z.x, VLOER + 0.625, Z.z); zuil.castShadow = true; zuil.receiveShadow = true;
  scene.add(zuil);
  const scherm = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.23), BORD);
  scherm.position.set(Z.x - 0.252, VLOER + 1.0, Z.z); scherm.rotation.y = -Math.PI / 2;
  scene.add(scherm);
  const wandBord = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.0), BORD);
  wandBord.position.set(GARAGE.x1 - 0.14, 3.0, Z.z); wandBord.rotation.y = -Math.PI / 2;
  scene.add(wandBord);
  addCollider(Z.x, Z.z, 0.25, 0.25, 0, 1.3);

  // ---------- het plaatwerk aftasten ----------
  const tastMat = new THREE.MeshBasicMaterial();          // wordt nooit getekend
  const tasters = new Map();
  function taster(soort) {
    if (!tasters.has(soort)) {
      const v = autoVorm(soort);
      const lak = new THREE.Mesh(v.lak, tastMat);
      const rest = [v.glas, v.zwart].filter(Boolean).map(g => new THREE.Mesh(g, tastMat));
      for (const m of [lak, ...rest]) m.updateMatrixWorld(true);
      tasters.set(soort, { lak, alle: [lak, ...rest], v });
    }
    return tasters.get(soort);
  }
  const straal = new THREE.Raycaster();
  // de eerste treffer langs de straal; alleen lak telt, glas of een zwart deel ervoor is "niets"
  function tast(t, van, richting, ver) {
    straal.set(van, richting); straal.far = ver;
    const h = straal.intersectObjects(t.alle, false)[0];
    return h && h.object === t.lak ? h.point : null;
  }

  /*
   Een rooster van nu × nv vakjes, gecentreerd op `c` (lokaal), in het vlak loodrecht op `n` (naar buiten),
   met `op` als de bovenkant van het doek. Rechts is `op × n`: dan is het doek van buitenaf gezien goed
   leesbaar en ligt de voorkant van de driehoeken naar buiten.
     tol   zo ver (langs n) mag een hoekpunt van het midden af liggen; anders is het een ander stuk plaat
           (het binnenwerk van de wielkast, de andere kant van de auto). Infinity: geen midden nodig.
     minY  lager dan dit is geen plaatwerk waar een decal hoort
  */
  function rooster(soort, { c, n, op, breed, hoog, nu, nv, spiegel = false, tol = 0.15, vanaf = 1.4, minY = 0.25 }) {
    const t = taster(soort);
    const rechts = new THREE.Vector3().crossVectors(op, n).normalize();
    const terug = n.clone().negate();
    const van = new THREE.Vector3(), p = new THREE.Vector3();
    /*
     Een zijstraal door de wielkast raakt de dorpel achter de band: de band zelf zit niet in de taster.
     Wat binnen de omtrek van een wiel ligt (plus wat speling) hoort niet bij de decal.
    */
    const R = t.v.R, zij = Math.abs(n.x) > 0.5;
    const inWielkast = h => zij && t.v.wielen.some(w => Math.hypot(h.z - w.z, h.y - R) < R + 0.07);
    const treffers = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      p.copy(c).addScaledVector(rechts, (i / nu - 0.5) * breed).addScaledVector(op, (j / nv - 0.5) * hoog);
      const h = tast(t, van.copy(p).addScaledVector(n, vanaf), terug, vanaf * 2 + 1);
      treffers.push(h && h.y > minY && !inWielkast(h) ? h : null);
    }
    /*
     Waar het plaatwerk ligt: in het midden, en ligt daar niets (de vlammen van de Ferrari hebben hun
     midden boven het voorwiel) dan de mediaan van alles wat geraakt is.
    */
    let ref = null;
    if (tol !== Infinity) {
      const m = tast(t, van.copy(c).addScaledVector(n, vanaf), terug, vanaf * 2 + 1);
      if (m && m.y > minY) ref = m.dot(n);
      else {
        const d = treffers.filter(Boolean).map(h => h.dot(n)).sort((a, b) => a - b);
        if (!d.length) return null;
        ref = d[Math.floor(d.length / 2)];
      }
    }
    const pos = [], uv = [], goed = [];
    for (let j = 0, k = 0; j <= nv; j++) for (let i = 0; i <= nu; i++, k++) {
      const u = i / nu, v = j / nv;
      p.copy(c).addScaledVector(rechts, (u - 0.5) * breed).addScaledVector(op, (v - 0.5) * hoog);
      const h = treffers[k];
      const ok = !!h && (ref === null || Math.abs(h.dot(n) - ref) < tol);
      const q = ok ? h.addScaledVector(n, 0.006) : p;
      pos.push(q.x, q.y, q.z);
      uv.push(spiegel ? 1 - u : u, v);
      goed.push(ok);
    }
    const idx = [];
    const rij = nu + 1;
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = j * rij + i, b = a + 1, d = a + rij, e = d + 1;
      if (goed[a] && goed[b] && goed[e]) idx.push(a, b, e);
      if (goed[a] && goed[e] && goed[d]) idx.push(a, e, d);
    }
    if (!idx.length) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    geo.userData.driehoeken = idx.length / 3;
    geo.userData.dekking = goed.filter(Boolean).length / goed.length;
    return geo;
  }
  /*
   Een doek met tekst moet heel op het plaatwerk: een BX heeft boven en onder zijn deur een zwarte
   strip, en daar viel de bovenste en onderste rij van het logo weg (een derde van "Markant"). Dus
   eerst op volle maat, en anders kleiner of iets hoger of lager, tot het hele doek op de lak ligt.
   Lukt dat nergens, dan het rooster dat het meest bedekt.
  */
  function pasIn(soort, opt) {
    let beste = null;
    for (const f of [1, 0.88, 0.76, 0.66, 0.56]) for (const dy of [0, -0.04, 0.04, -0.08, 0.08]) {
      const c = opt.c.clone().addScaledVector(opt.op, dy * f);
      const geo = rooster(soort, { ...opt, c, breed: opt.breed * f, hoog: opt.hoog * f });
      if (!geo) continue;
      if (geo.userData.dekking >= 0.999) { if (beste && beste !== geo) beste.dispose(); return geo; }
      if (!beste || geo.userData.dekking > beste.userData.dekking) { if (beste) beste.dispose(); beste = geo; } else geo.dispose();
    }
    return beste;
  }

  // per soort auto, decal en kant één rooster
  const ROOSTER = new Map();
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), VOOR = new THREE.Vector3(0, 0, -1);
  function decalGeo(soort, dec, s) {
    const sleutel = `${soort}|${dec.id}|${s}`;
    if (ROOSTER.has(sleutel)) return ROOSTER.get(sleutel);
    const { v } = taster(soort);
    const M = v.maat, L = v.L, W = v.W;
    const vensterZ = M.cabZ - M.cabL / 2;          // waar de voorruit begint
    let geo = null;
    if (dec.plek === 'deur') {
      const maxH = 0.8 * (M.schouderY - M.dorpelY);
      let breed = Math.min(1.05, M.cabL * 0.52), hoog = breed / dec.verhouding;
      if (hoog > maxH) { hoog = maxH; breed = hoog * dec.verhouding; }
      geo = pasIn(soort, { c: new THREE.Vector3(s * W / 2, (M.dorpelY + M.schouderY) / 2, M.cabZ), n: X.clone().multiplyScalar(s), op: Y,
        breed, hoog, nu: 18, nv: 6, minY: M.dorpelY - 0.12 });
    } else if (dec.plek === 'vlam') {
      const z0 = -L / 2 + 0.12, z1 = vensterZ + 0.35;
      const breed = z1 - z0, hoog = Math.min(breed / dec.verhouding, 0.9 * (M.schouderY - M.dorpelY));
      geo = rooster(soort, { c: new THREE.Vector3(s * W / 2, (M.dorpelY + M.schouderY) / 2 - 0.02, (z0 + z1) / 2), n: X.clone().multiplyScalar(s), op: Y,
        breed, hoog, nu: 24, nv: 8, spiegel: dec.richting && s < 0, tol: 0.15, minY: M.dorpelY - 0.15 });
    } else if (dec.streep) {
      // van de neus tot het eind van het dak; over de ruiten loopt hij niet door
      const z0 = -L / 2 + 0.06, z1 = M.cabZ + M.cabL / 2;
      geo = rooster(soort, { c: new THREE.Vector3(0, 1.0, (z0 + z1) / 2), n: Y, op: VOOR, breed: Math.min(0.62, W * 0.36), hoog: z1 - z0,
        nu: 4, nv: 64, tol: Infinity, vanaf: 2.2, minY: M.flankY * 0.8 });
    } else {
      const lengte = vensterZ - (-L / 2);
      const breed = Math.min(W * 0.55, lengte * 0.72 * dec.verhouding), hoog = breed / dec.verhouding;
      geo = pasIn(soort, { c: new THREE.Vector3(0, 1.0, -L / 2 + lengte * 0.55), n: Y, op: VOOR, breed, hoog,
        nu: 14, nv: 10, tol: 0.3, vanaf: 2.2, minY: M.flankY * 0.8 });
    }
    ROOSTER.set(sleutel, geo);
    return geo;
  }

  /*
   Waar de vleugel komt: van achteren naar voren tastend het eerste stuk lak dat hoger ligt dan de flank
   (de kofferklep, of bij een hatchback de achterrand van het dak). Glas en de zwarte bumper tellen niet.
  */
  const VLEUGEL_PLEK = new Map();
  function vleugelPlek(soort) {
    if (VLEUGEL_PLEK.has(soort)) return VLEUGEL_PLEK.get(soort);
    const t = taster(soort), M = t.v.maat, L = t.v.L;
    let plek = null;
    const van = new THREE.Vector3(), neer = new THREE.Vector3(0, -1, 0);
    for (let z = L / 2 - 0.04; z > M.cabZ; z -= 0.04) {
      let laag = Infinity, raak = 0;
      for (const x of [-0.45, 0, 0.45]) {
        const h = tast(t, van.set(x, 3.5, z), neer, 4);
        if (h && h.y > M.flankY + 0.02) { laag = Math.min(laag, h.y); raak++; }
      }
      if (raak === 3) { plek = { y: laag, z: z - 0.1 }; break; }
    }
    VLEUGEL_PLEK.set(soort, plek);
    return plek;
  }

  // ---------- op een auto zetten ----------
  function ruimOp(car) {
    const u = car.mesh && car.mesh.userData;
    for (const d of car._tuneDelen || []) if (d.parent) d.parent.remove(d);
    car._tuneDelen = [];
    if (u && u.bak) u.bak.position.y = 0;
    if (u && u.wielen) for (const w of u.wielen) {
      const naaf = w.groep.children[1];
      if (naaf && naaf.userData.tuneOrig) { naaf.geometry = naaf.userData.tuneOrig.geo; naaf.material = naaf.userData.tuneOrig.mat; }
    }
    if (car._tuneBasis) {
      car.topSnelheid = car._tuneBasis.top; car.trek = car._tuneBasis.trek; car.grip = car._tuneBasis.grip;
    }
  }

  function pasToe(car, gegevens) {
    if (!car) return false;
    if ((!car.mesh || !car.mesh.userData.bak) && vehicles.maakBestuurbaar) vehicles.maakBestuurbaar(car);
    const u = car.mesh && car.mesh.userData;
    if (!u || !u.bak) return false;
    const t = schoon(gegevens);
    ruimOp(car);
    if (!car._tuneBasis) car._tuneBasis = { top: car.topSnelheid, trek: car.trek, grip: car.grip };
    const B = car._tuneBasis, soort = car.soort || 'hatch';
    const hang = m => { m.userData.tuning = true; u.bak.add(m); car._tuneDelen.push(m); return m; };

    if (t.motor) { car.topSnelheid = B.top * TUNING.motor.factor; car.trek = B.trek * TUNING.motor.factor; }
    if (t.vering) { car.grip = B.grip * TUNING.vering.grip; u.bak.position.y = -TUNING.vering.lager; }

    if (t.spoiler && soort !== 'ferrari') {
      const p = vleugelPlek(soort);
      if (p) {
        const W = taster(soort).v.W, hoog = 0.2;
        const blad = new THREE.Mesh(VLEUGEL.blad, lakVoor(car.kleur ?? 0x8a8d93));
        blad.userData.lak = true;                  // de spuiterij spuit hem mee
        blad.scale.x = W * 0.84; blad.position.set(0, p.y + hoog, p.z - 0.02); blad.rotation.x = 0.1; blad.castShadow = true;
        hang(blad);
        for (const s of [-1, 1]) {
          const plaat = new THREE.Mesh(VLEUGEL.plaat, ZWART); plaat.position.set(s * W * 0.42, p.y + hoog, p.z - 0.02); hang(plaat);
          const steun = new THREE.Mesh(VLEUGEL.steun, ZWART); steun.scale.y = hoog; steun.position.set(s * W * 0.26, p.y + hoog / 2, p.z); hang(steun);
        }
      } else t.spoiler = false;
    } else t.spoiler = false;

    if (t.velg && u.wielen) {
      for (const w of u.wielen) {
        const naaf = w.groep.children[1];
        if (!naaf) continue;
        if (!naaf.userData.tuneOrig) naaf.userData.tuneOrig = { geo: naaf.geometry, mat: naaf.material };
        // zwart houdt de vorm van de velg; goud en wit krijgen een eigen vorm
        naaf.geometry = t.velg === 'zwart' ? naaf.userData.tuneOrig.geo : velgGeo(u.R || 0.32, t.velg);
        naaf.material = VMAT[t.velg];
      }
    }

    for (const plek of Object.keys(t.decals)) {
      const dec = DECALS.find(d => d.id === t.decals[plek]);
      if (!dec) continue;
      const kanten = plek === 'kap' ? [0] : [1, -1];
      let n = 0;
      for (const s of kanten) {
        const geo = decalGeo(soort, dec, s);
        if (!geo) continue;
        const m = new THREE.Mesh(geo, DMAT[dec.id]);
        m.renderOrder = 3;
        m.userData.decal = dec.id;
        hang(m); n++;
      }
      if (!n) t.decals[plek] = null;
    }
    car.tuning = t;
    return true;
  }

  const gegevensVan = car => schoon(car && car.tuning);
  // js/garage.js zet bij het laden de tuning terug op de gekochte auto's
  if (garage && garage.zetTuning) garage.zetTuning(pasToe);

  // ---------- waar ben je, en welke auto ----------
  const balie = () => (garage && garage.plekken && garage.plekken.balie) || { x: 784.4, z: 139.8 };
  function bijPlek(x, z) {
    const b = balie();
    return Math.hypot(x - TUNING.plek.x, z - TUNING.plek.z) < TUNING.bereik && Math.hypot(x - b.x, z - b.z) > TUNING.balieVrij;
  }
  const V = GARAGE.voor;
  function opVoorterrein(c) {
    return c.x > V.x0 - 3 && c.x < V.x1 + 3 && c.z > V.z0 - 3 && c.z < V.z1 + 3;
  }
  const eigenAutos = () => (garage ? garage.eigen : []).map(e => e.car)
    .filter(c => c && !c.weg && !c.wrak && (c.hp ?? 100) > 0 && isFinite(c.x));
  function autoBij() {
    let beste = null, bd = Infinity;
    for (const c of eigenAutos()) {
      const d = Math.hypot(c.x - TUNING.plek.x, c.z - TUNING.plek.z);
      if ((opVoorterrein(c) || d < TUNING.autoBereik) && d < bd) { bd = d; beste = c; }
    }
    return beste;
  }
  const naamVan = car => {
    const e = (garage ? garage.eigen : []).find(x => x.car === car);
    return e ? e.naam : 'auto';
  };

  // ---------- het menu ----------
  const css = document.createElement('style');
  css.textContent = `
    #tuningMenu { position: fixed; right: 24px; top: 20%; z-index: 5; width: 330px; max-width: calc(100vw - 32px); box-sizing: border-box;
      background: rgba(8,14,24,.88); color: #f2f4f8; border: 2px solid #ffd400; border-radius: 10px; padding: 12px 16px;
      font: 14px/1.45 system-ui, sans-serif; pointer-events: auto; user-select: none; }
    /* een id met display wint van [hidden] (stap 106): daarom deze regel */
    #tuningMenu[hidden] { display: none; }
    #tuningMenu h3 { margin: 0; font-size: 16px; letter-spacing: .05em; color: #ffd400; }
    #tuningMenu .onder { opacity: .78; margin: 2px 0 8px; font-size: 12.5px; }
    #tuningMenu .r { display: flex; gap: 8px; align-items: baseline; padding: 2px 4px; border-radius: 5px; cursor: pointer; }
    #tuningMenu .r:hover { background: rgba(255,212,0,.12); }
    #tuningMenu .r b { color: #ffd400; width: 16px; flex: none; }
    #tuningMenu .r .t { flex: 1; min-width: 0; }
    #tuningMenu .r .p { white-space: nowrap; opacity: .9; }
    #tuningMenu .r.uit { opacity: .45; }
    #tuningMenu .r.aan .t::after { content: ' ✓'; color: #7ee07e; }
    @media (max-width: 600px) { #tuningMenu { left: 16px; right: 16px; width: auto; top: 10%; font-size: 13px; } }
  `;
  document.head.appendChild(css);
  const paneel = document.createElement('div');
  paneel.id = 'tuningMenu'; paneel.hidden = true;
  document.body.appendChild(paneel);
  paneel.addEventListener('pointerdown', e => {
    const r = e.target.closest('.r');
    if (!r) return;
    e.preventDefault(); e.stopPropagation();
    kies(+r.dataset.n);
  });
  const praatEl = document.getElementById('praat');

  let open = false, scherm_ = 'hoofd', auto = null, getoondGeld = null;
  const geld = () => (garage && typeof garage.geld === 'number' ? garage.geld : 0);

  function regels() {
    const t = gegevensVan(auto), soort = auto && auto.soort;
    if (scherm_ === 'velg') return [
      ...VELGEN.map((v, i) => ({ n: i + 1, tekst: `Velgen ${v.naam}`, prijs: euro(TUNING.velg.prijs), aan: t.velg === v.id })),
      { n: 4, tekst: 'Standaard velgen', prijs: 'gratis', aan: !t.velg },
      { n: 0, tekst: 'Terug', prijs: '' },
    ];
    if (scherm_ === 'decal') return [
      ...DECALS.map((d, i) => {
        const aan = t.decals[d.plek] === d.id;
        return { n: i + 1, tekst: `${d.naam[0].toUpperCase()}${d.naam.slice(1)} (${PLEK_NAAM[d.plek]})`, prijs: aan ? 'eraf: gratis' : euro(TUNING.decal.prijs), aan };
      }),
      { n: 9, tekst: 'Alle decals eraf', prijs: 'gratis' },
      { n: 0, tekst: 'Terug', prijs: '' },
    ];
    return [
      { n: 1, tekst: `Motor (+${Math.round((TUNING.motor.factor - 1) * 100)} % top en trek)`, prijs: t.motor ? 'zit erin' : euro(TUNING.motor.prijs), aan: t.motor },
      { n: 2, tekst: 'Sportvering (grip, lager)', prijs: t.vering ? 'zit erin' : euro(TUNING.vering.prijs), aan: t.vering },
      soort === 'ferrari'
        ? { n: 3, tekst: 'Spoiler (heeft al een vleugel)', prijs: '', uit: true }
        : { n: 3, tekst: 'Spoiler', prijs: t.spoiler ? 'eraf: gratis' : euro(TUNING.spoiler.prijs), aan: t.spoiler },
      { n: 4, tekst: 'Velgen…', prijs: `${euro(TUNING.velg.prijs)}` },
      { n: 5, tekst: 'Decals…', prijs: `${euro(TUNING.decal.prijs)} per stuk` },
      { n: 0, tekst: 'Sluiten', prijs: 'E' },
    ];
  }
  function teken() {
    if (!open) return;
    const kop = scherm_ === 'velg' ? 'TUNING · VELGEN' : scherm_ === 'decal' ? 'TUNING · DECALS' : 'TUNING · AUTOHUIS LEMMERWEG';
    getoondGeld = geld();
    const r = regels().map(x => `<div class="r${x.uit ? ' uit' : ''}${x.aan ? ' aan' : ''}" data-n="${x.n}"><b>${x.n}</b><span class="t">${x.tekst}</span><span class="p">${x.prijs}</span></div>`).join('');
    paneel.innerHTML = `<h3>${kop}</h3><div class="onder">Je ${naamVan(auto)} · je hebt ${euro(getoondGeld)}</div>${r}`;
  }
  function openen(car) {
    auto = car; open = true; scherm_ = 'hoofd';
    paneel.hidden = false;
    if (praatEl && hintAan) { praatEl.hidden = true; hintAan = false; }
    teken();
  }
  function sluit() {
    open = false; scherm_ = 'hoofd'; auto = null;
    paneel.hidden = true;
  }

  // betalen bij Sjoerd; te weinig geld zegt hij wat het kost
  function betaal(prijs, wat) {
    if (garage && garage.betaal && garage.betaal(prijs)) return true;
    if (hud) hud.melding('Te weinig geld', `Sjoerd: "${wat} kost ${euro(prijs)}." Je hebt ${euro(geld())}.`, 4);
    return false;
  }
  function klaar(kop, onder) {
    if (hud) hud.melding(kop, onder, 4);
    teken();
  }

  /*
   Een cijfertoets. Zolang het menu open is, horen alle cijfers bij het menu (true), ook de cijfers die
   niets doen: anders kiest een 6 ergens anders een huis of start shift + cijfer een missie.
  */
  function kies(n) {
    if (!open) return false;
    if (!Number.isInteger(n) || n < 0 || n > 9) return false;
    // de auto moet er nog staan
    if (!auto || auto.weg || auto.wrak || autoBij() !== auto) {
      sluit();
      if (hud) hud.melding('Geen auto', 'Sjoerd: "Rij eerst je eigen auto voor."', 4);
      return true;
    }
    const t = gegevensVan(auto);
    if (scherm_ === 'hoofd') {
      if (n === 0) { sluit(); return true; }
      if (n === 1) {
        if (t.motor) { klaar('Motor', 'Sjoerd: "Die is al opgevoerd."'); return true; }
        if (!betaal(TUNING.motor.prijs, 'De motor opvoeren')) return true;
        t.motor = true; pasToe(auto, t);
        klaar('MOTOR OPGEVOERD', `${euro(TUNING.motor.prijs)} · topsnelheid ${Math.round(auto.topSnelheid * 3.6)} km/u`);
      } else if (n === 2) {
        if (t.vering) { klaar('Sportvering', 'Sjoerd: "Die zit er al onder."'); return true; }
        if (!betaal(TUNING.vering.prijs, 'Een sportvering')) return true;
        t.vering = true; pasToe(auto, t);
        klaar('SPORTVERING', `${euro(TUNING.vering.prijs)} · lager en strakker door de bocht`);
      } else if (n === 3) {
        if (auto.soort === 'ferrari') { klaar('Spoiler', 'Sjoerd: "Op een Ferrari? Die heeft al een vleugel."'); return true; }
        if (t.spoiler) { t.spoiler = false; pasToe(auto, t); klaar('SPOILER ERAF', 'Gratis.'); return true; }
        if (!betaal(TUNING.spoiler.prijs, 'Een spoiler')) return true;
        t.spoiler = true; pasToe(auto, t);
        if (!auto.tuning.spoiler) { if (garage && garage.verdien) garage.verdien(TUNING.spoiler.prijs); klaar('Spoiler', 'Sjoerd: "Die past niet op deze auto."'); return true; }
        klaar('SPOILER', `${euro(TUNING.spoiler.prijs)} · in de kleur van je lak`);
      } else if (n === 4) { scherm_ = 'velg'; teken(); }
      else if (n === 5) { scherm_ = 'decal'; teken(); }
      return true;
    }
    if (scherm_ === 'velg') {
      if (n === 0) { scherm_ = 'hoofd'; teken(); return true; }
      if (n === 4) { t.velg = null; pasToe(auto, t); klaar('STANDAARD VELGEN', 'Gratis.'); return true; }
      const v = VELGEN[n - 1];
      if (!v) return true;
      if (t.velg === v.id) { klaar('Velgen', `Sjoerd: "Die ${v.naam} velgen zitten er al onder."`); return true; }
      if (!betaal(TUNING.velg.prijs, 'Een set velgen')) return true;
      t.velg = v.id; pasToe(auto, t);
      klaar('NIEUWE VELGEN', `${euro(TUNING.velg.prijs)} · ${v.naam}`);
      return true;
    }
    // decals
    if (n === 0) { scherm_ = 'hoofd'; teken(); return true; }
    if (n === 9) {
      t.decals = { deur: null, kap: null, vlam: null }; pasToe(auto, t);
      klaar('DECALS ERAF', 'Gratis. De lak is weer schoon.');
      return true;
    }
    const d = DECALS[n - 1];
    if (!d) return true;
    if (t.decals[d.plek] === d.id) {
      t.decals[d.plek] = null; pasToe(auto, t);
      klaar('DECAL ERAF', `${d.naam[0].toUpperCase()}${d.naam.slice(1)} · gratis`);
      return true;
    }
    if (!betaal(TUNING.decal.prijs, 'Een decal')) return true;
    t.decals[d.plek] = d.id; pasToe(auto, t);
    if (auto.tuning.decals[d.plek] !== d.id) {
      // het rooster vond geen plaatwerk: geld terug
      if (garage && garage.verdien) garage.verdien(TUNING.decal.prijs);
      klaar('Decal', 'Sjoerd: "Die krijg ik er op deze auto niet mooi op."');
      return true;
    }
    klaar('DECAL', `${d.naam[0].toUpperCase()}${d.naam.slice(1)} op de ${PLEK_NAAM[d.plek]} · ${euro(TUNING.decal.prijs)}`);
    return true;
  }

  // E: het menu open of dicht. Geeft true als de toets gebruikt is.
  function toets() {
    if (open) { sluit(); return true; }
    if (!player.active && !window.__autoplay) return false;
    if (player.inCar) return false;
    if (!bijPlek(player.pos.x, player.pos.z)) return false;
    if (!eigenAutos().length) {
      if (hud) hud.melding('Tuning', 'Sjoerd: "Tunen doe ik alleen aan een auto die je hier gekocht hebt."', 4);
      return true;
    }
    const car = autoBij();
    if (!car) {
      if (hud) hud.melding('Tuning', 'Sjoerd: "Rij eerst je eigen auto voor, dan kijk ik ernaar."', 4);
      return true;
    }
    openen(car);
    return true;
  }

  // ---------- elk beeld ----------
  let hintAan = false;
  function update(dt, bezet = false) {
    const px = player.pos.x, pz = player.pos.z;
    if (open) {
      const weg = Math.hypot(px - TUNING.plek.x, pz - TUNING.plek.z) > TUNING.sluitVanaf;
      if (weg || player.inCar || (!player.active && !window.__autoplay)) sluit();
      else if (geld() !== getoondGeld) teken();
    }
    if (!praatEl) return;
    const toon = !open && !bezet && (player.active || window.__autoplay) && !player.inCar && bijPlek(px, pz);
    if (toon) {
      const tekst = 'E — tuning en decals (je eigen auto)';
      if (!hintAan || praatEl.hidden || praatEl.textContent !== tekst) { praatEl.textContent = tekst; praatEl.hidden = false; }
      hintAan = true;
    } else if (hintAan) {
      praatEl.hidden = true; hintAan = false;
    }
  }

  return {
    update, toets, kies, sluit, pasToe, gegevensVan, bijPlek, autoBij,
    get open() { return open; },
    get scherm() { return scherm_; },
    get auto() { return auto; },
    get materialen() { return { decal: DMAT, velg: VMAT, zwart: ZWART, bord: BORD }; },
    get staal() { return staal; },
    // voor een proef: het rooster van een decal op een soort auto (zonder het op een auto te zetten)
    rooster: (soort, id, kant = 1) => { const d = DECALS.find(x => x.id === id); return d ? decalGeo(soort, d, d.plek === 'kap' ? 0 : kant) : null; },
  };
}
