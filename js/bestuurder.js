/*
 De bestuurder achter het stuur (stap 172).

 Gevraagd: "een bestuurder in de auto's van het verkeer, goed achter het stuur". Tot nu toe reed het verkeer
 leeg rond, en zat Erik in de derde persoon ook niet in zijn eigen auto (js/derdepersoon.js verbergt hem zodra
 hij instapt). Een volledige `Persoon` per auto (js/persoon.js, tot 4000 driehoeken, een eigen groep met
 gewrichten) is te duur voor dertig rijdende auto's en ziet door getint glas niemand. Dit is een grof, gedeeld
 figuur: één mesh per auto, één gedeeld materiaal met hoekpuntkleuren (huid, haar, shirt, broek, schoenen), en de
 geometrie per soort en per kleurvariant maar één keer gemaakt.

 Hij zit waar de speler zit. Alle maten komen uit `maat` (js/carmodel.js) en uit de regels van js/autobinnen.js:

   stoel     vloer = dorpel + 0,16; de zitting op vloer + 0,10 (de Ferrari + 0,07), 8 cm dik, midden op cabZ − 0,07
   stuur     x = oog.x, y = schouder − 0,02, z = cabZ − cabL/2 + 0,565, 0,42 rad achterover, straal 0,158 (vrachtwagen 0,21)
   hemel     dak − 0,045
   ogen      `maat.oog`

 Het hoofd hangt op ooghoogte (nooit hoger dan 1 cm onder de hemel), de handen liggen op het stuur op tien voor twee,
 de billen op de zitting. Waar de cabine laag is (de Ferrari) leunt de romp achterover in plaats van door het dak
 te steken: de hoek volgt uit de ruimte tussen zitting en hoofd. tools/autodetailtest.mjs meet het per soort na.
*/
import * as THREE from 'three';

export const BESTUURDER = {
  hoofdR: 0.098,
  nek: 0.155,          // van het midden van het hoofd tot de lijn van de schouders
  romp: 0.28,          // van de heupen tot de schouders, rechtop, op zijn kortst
  rompMax: 0.56,       // en op zijn langst
  heupBoven: 0.085,    // het heupgewricht boven de zitting
  schouderB: 0.175,    // halve schouderbreedte
  dij: 0.40,
  // de kleurvarianten: huid, haar, shirt, broek (de schoenen zijn altijd donker)
  varianten: [
    [0xe2b896, 0x3b2a1e, 0x2c4a7a, 0x2b2e35],
    [0xc99470, 0x161412, 0x8a2a2a, 0x3a3f4a],
    [0xf0cfb4, 0xb08a52, 0xdedad2, 0x2f3a52],
    [0x8d5a3c, 0x111111, 0x3c6b45, 0x26282c],
    [0xe8c0a0, 0x6b6b6b, 0x5a5f66, 0x403a33],
    [0xd9a77f, 0x5a3a22, 0xc8a23a, 0x2e2e33],
    [0x6b4128, 0x0e0d0c, 0xe8e6e0, 0x33363d],
    [0xf2d2b8, 0x9a3b1e, 0x1f2024, 0x4a4f5a],
  ],
  // Erik in zijn eigen auto (derde persoon): donkere jas, spijkerbroek
  erik: [0xe0b090, 0x2a1d14, 0x23262c, 0x34465e],
};

let MAT = null;
/** Het ene materiaal van alle bestuurders: gewoon belicht, met de kleur in de hoekpunten. */
export function bestuurderMateriaal() {
  if (!MAT) MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
  return MAT;
}

/** De maten van stoel, stuur en hemel zoals js/autobinnen.js ze neerzet, plus waar de bestuurder komt. */
export function bestuurderPlek(maat) {
  const B = BESTUURDER, o = maat.oog;
  const vloerY = maat.dorpelY + 0.16;
  const zitTop = vloerY + (maat.sport ? 0.07 : 0.10) + 0.04;
  const hemelY = maat.dakY - 0.045;
  const stuurR = maat.truck ? 0.21 : 0.158;
  const stuur = { x: o.x, y: maat.schouderY - 0.02, z: maat.cabZ - maat.cabL / 2 + 0.565, kantel: -0.42, R: stuurR };
  // het hoofd op ooghoogte, maar altijd een centimeter onder de hemel
  // (de bovenkant van het haar ligt 0,116 boven het midden; de hemel van de Ferrari hangt 3,5 cm lager dan dak − 0,045)
  const hoofd = { x: o.x, y: Math.min(o.y + 0.01, hemelY - 0.165), z: o.z + 0.03 };
  const schouderY = hoofd.y - B.nek;
  const schouderZ = maat.cabZ + 0.07;
  /*
   De romp tussen zitting en schouders. Rechtop is hij `romp` tot `rompMax` lang: in de bus, de vrachtwagen en de
   ambulance zit je hoger boven de zitting dan in een hatchback, en een romp van vaste lengte liet de billen daar
   twintig centimeter boven de stoel zweven (gemeten). Past hij rechtop niet (de Ferrari), dan leunt hij achterover.
  */
  const ruimte = schouderY - (zitTop + B.heupBoven);
  const lang = Math.max(B.romp, Math.min(B.rompMax, ruimte));
  const cos = Math.max(0.42, Math.min(1, ruimte / lang));
  const leun = Math.acos(cos);
  const heup = { x: o.x, y: Math.max(zitTop + 0.05, schouderY - lang * cos), z: schouderZ - lang * Math.sin(leun) - 0.01 };
  // de handen op tien voor twee: het punt op de krans, gekanteld zoals het stuur
  const hand = (s) => {
    const a = 0.45;   // 26° boven de horizon
    const lx = s * stuurR * Math.cos(a), ly = stuurR * Math.sin(a);
    const c = Math.cos(stuur.kantel), sn = Math.sin(stuur.kantel);
    return { x: stuur.x + lx, y: stuur.y + ly * c, z: stuur.z + ly * sn };
  };
  const knieY = zitTop + 0.07;
  const knieZ = heup.z - Math.sqrt(Math.max(0.04, B.dij * B.dij - (knieY - heup.y) ** 2));
  return {
    vloerY, zitTop, hemelY, stuur, hoofd, leun,
    schouder: { y: schouderY, z: schouderZ },
    heup, knie: { y: knieY, z: knieZ },
    enkel: { y: vloerY + 0.075, z: knieZ - 0.24 },
    handL: hand(-1), handR: hand(1),
  };
}

// ---------------------------------------------------------------- de vorm
const V = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
function staafTussen(a, b, r0, r1, seg = 7) {
  const A = new THREE.Vector3(a.x, a.y, a.z), Bv = new THREE.Vector3(b.x, b.y, b.z);
  const len = A.distanceTo(Bv);
  const g = new THREE.CylinderGeometry(r1, r0, Math.max(0.005, len), seg, 1, false);
  const q = new THREE.Quaternion().setFromUnitVectors(Y, V.subVectors(Bv, A).normalize());
  g.applyQuaternion(q);
  g.translate((A.x + Bv.x) / 2, (A.y + Bv.y) / 2, (A.z + Bv.z) / 2);
  return g;
}
function bol(p, r, sx = 1, sy = 1, sz = 1, seg = 9) {
  const g = new THREE.SphereGeometry(r, seg, Math.max(5, seg - 3));
  g.scale(sx, sy, sz);
  g.translate(p.x, p.y, p.z);
  return g;
}
function voeg(lijst, geo, kleur) { lijst.push({ geo: geo.index ? geo.toNonIndexed() : geo, kleur }); }
function samen(lijst) {
  let n = 0;
  for (const d of lijst) n += d.geo.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), kl = new Float32Array(n * 3);
  let k = 0;
  const c = new THREE.Color();
  for (const d of lijst) {
    c.setHex(d.kleur);
    const P = d.geo.attributes.position, N = d.geo.attributes.normal;
    for (let i = 0; i < P.count; i++, k++) {
      pos[k * 3] = P.getX(i); pos[k * 3 + 1] = P.getY(i); pos[k * 3 + 2] = P.getZ(i);
      nor[k * 3] = N.getX(i); nor[k * 3 + 1] = N.getY(i); nor[k * 3 + 2] = N.getZ(i);
      kl[k * 3] = c.r; kl[k * 3 + 1] = c.g; kl[k * 3 + 2] = c.b;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(kl, 3));
  g.computeBoundingSphere();
  return g;
}

const GEO = new Map();
/** De geometrie van een bestuurder voor deze maat en kleuren (gedeeld per sleutel). */
export function bestuurderGeo(sleutel, maat, kleuren) {
  if (GEO.has(sleutel)) return GEO.get(sleutel);
  const B = BESTUURDER, P = bestuurderPlek(maat);
  const [huid, haar, shirt, broek] = kleuren;
  const schoen = 0x1a1a1c;
  const L = [];
  const x0 = P.hoofd.x;
  // hoofd, haar (een kap over de bovenkant en de achterkant), nek
  voeg(L, bol(P.hoofd, B.hoofdR, 0.9, 1.05, 1), huid);
  const kap = new THREE.SphereGeometry(B.hoofdR * 1.06, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
  kap.scale(0.92, 1.0, 1.04); kap.translate(P.hoofd.x, P.hoofd.y + 0.012, P.hoofd.z + 0.01);
  voeg(L, kap, haar);
  voeg(L, staafTussen({ x: x0, y: P.hoofd.y - 0.06, z: P.hoofd.z + 0.01 }, { x: x0, y: P.schouder.y + 0.02, z: P.schouder.z }, 0.045, 0.045, 6), huid);
  // romp: van de heupen naar de schouders, plat van voor naar achter
  const romp = staafTussen(P.heup, { x: x0, y: P.schouder.y, z: P.schouder.z }, 0.15, 0.165, 9);
  // platter maken om de as van de romp: schaal de diepte (z) rond het midden
  {
    const mz = (P.heup.z + P.schouder.z) / 2, p = romp.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, mz + (p.getZ(i) - mz) * 0.62);
    romp.computeVertexNormals();
  }
  voeg(L, romp, shirt);
  for (const s of [-1, 1]) {
    const sch = { x: x0 + s * B.schouderB, y: P.schouder.y - 0.02, z: P.schouder.z };
    const hand = s < 0 ? P.handL : P.handR;
    // de elleboog: halverwege, iets omlaag en naar buiten
    const el = { x: (sch.x + hand.x) / 2 + s * 0.06, y: (sch.y + hand.y) / 2 - 0.08, z: (sch.z + hand.z) / 2 + 0.02 };
    voeg(L, bol(sch, 0.062, 1, 0.9, 1, 8), shirt);
    voeg(L, staafTussen(sch, el, 0.05, 0.045), shirt);
    voeg(L, bol(el, 0.045, 1, 1, 1, 7), shirt);
    voeg(L, staafTussen(el, hand, 0.043, 0.036), shirt);
    voeg(L, bol(hand, 0.04, 1, 0.9, 1.15, 7), huid);
    // benen: heup → knie → enkel, met een schoen naar voren
    const hp = { x: x0 + s * 0.09, y: P.heup.y, z: P.heup.z };
    const kn = { x: x0 + s * 0.11, y: P.knie.y, z: P.knie.z };
    const en = { x: x0 + s * 0.12, y: P.enkel.y, z: P.enkel.z };
    voeg(L, bol(hp, 0.085, 1, 0.85, 1, 8), broek);
    voeg(L, staafTussen(hp, kn, 0.078, 0.06), broek);
    voeg(L, bol(kn, 0.06, 1, 1, 1, 7), broek);
    voeg(L, staafTussen(kn, en, 0.055, 0.042), broek);
    voeg(L, bol({ x: en.x, y: en.y - 0.02, z: en.z - 0.06 }, 0.05, 0.9, 0.6, 1.9, 7), schoen);
  }
  const g = samen(L);
  g.userData.plek = P;
  GEO.set(sleutel, g);
  return g;
}

/*
 Een bestuurder voor een auto van soort `kind`. `variant` kiest de kleuren (een getal, of 'erik'). De mesh hangt
 in de carrosseriegroep (`bak`), dus hij helt mee in de bocht. Hij is geen doel: een kogel gaat door het glas en
 raakt de auto (js/vehicles.js `hit`), zoals het altijd ging.
*/
export function maakBestuurder(kind, maat, variant = 0) {
  const kleuren = variant === 'erik' ? BESTUURDER.erik : BESTUURDER.varianten[Math.abs(variant | 0) % BESTUURDER.varianten.length];
  const geo = bestuurderGeo(`${kind}|${variant}`, maat, kleuren);
  const m = new THREE.Mesh(geo, bestuurderMateriaal());
  m.castShadow = false;
  m.receiveShadow = false;
  m.raycast = () => {};
  m.userData.bestuurder = true;
  m.userData.plek = geo.userData.plek;
  m.name = 'bestuurder';
  return m;
}
