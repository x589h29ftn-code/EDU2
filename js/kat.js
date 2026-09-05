/*
 Een kat voor binnen: één aan de Molenkrite, twee aan de Wieken.

 Zwart-wit, zoals de meeste huiskatten in de wijk: wit met een zwarte rug, een
 zwarte kop met een witte bles, zwarte oren en een zwarte staart. Hij is niet
 groot — een volwassen kat is zo'n 45 cm lang met een schofthoogte van 25 cm —
 en dat is met opzet precies aangehouden, want naast een bank van 2,10 m valt
 een kat die tien centimeter te groot is meteen op.

 De materialen zijn dezelfde soort als in de kamer zelf (MeshBasicMaterial met
 licht in de hoekpunten): er staan binnen geen lampen, dus een kat met een
 standaardmateriaal zou 's avonds zwart worden terwijl de kamer verlicht is.
 js/interieur.js neemt ze mee in zijn dag- en nachttint.

 De kat kan lopen, stilstaan en zitten. Zitten is geen apart model: de
 achterpoten klappen in, het achterlijf zakt en de staart krult om de voorpoten
 heen — dat is wat een kat doet en het scheelt een tweede skelet.
*/
import * as THREE from 'three';

const WIT = 0xf1efe8;
const ZWART = 0x26272c;
const ROZE = 0xd58f92;
const OOG = 0x8fbf5a;

/*
 `schaduw` komt uit js/interieur.js: die zet de helderheid in de hoekpunten uit
 de richting waar een vlak naar kijkt. De kat krijgt hem mee zodat hij in
 hetzelfde licht staat als de kamer.
*/
export function maakKat({ schaduw = (g) => g, zaad = 0 } = {}) {
  const mats = {
    wit: new THREE.MeshBasicMaterial({ color: WIT, vertexColors: true, fog: false }),
    zwart: new THREE.MeshBasicMaterial({ color: ZWART, vertexColors: true, fog: false }),
    roze: new THREE.MeshBasicMaterial({ color: ROZE, vertexColors: true, fog: false }),
    oog: new THREE.MeshBasicMaterial({ color: OOG, fog: false }),
  };
  const doos = (b, h, d, m, x, y, z) => {
    const o = new THREE.Mesh(schaduw(new THREE.BoxGeometry(b, h, d)), m);
    o.position.set(x, y, z);
    return o;
  };
  const bol = (r, m, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const g = new THREE.SphereGeometry(r, 8, 6);
    g.scale(sx, sy, sz);
    const o = new THREE.Mesh(schaduw(g), m);
    o.position.set(x, y, z);
    return o;
  };

  const groep = new THREE.Group();
  groep.userData.kat = true;
  // het hele beest hangt aan een draaipunt, zodat zitten één rotatie is
  const lijf = new THREE.Group();
  groep.add(lijf);

  const RUG = 0.245;                       // hoogte van de rug bij het staan
  lijf.add(doos(0.155, 0.145, 0.40, mats.wit, 0, RUG, 0));          // romp
  lijf.add(doos(0.135, 0.075, 0.34, mats.zwart, 0, RUG + 0.05, 0.01)); // zwarte rug
  lijf.add(doos(0.125, 0.115, 0.10, mats.wit, 0, RUG - 0.01, -0.23)); // borst

  // kop: zwart met een witte bles over de snuit
  const kop = new THREE.Group();
  kop.position.set(0, RUG + 0.085, -0.255);
  lijf.add(kop);
  kop.add(bol(0.082, mats.zwart, 0, 0, 0, 1, 0.95, 0.95));
  kop.add(doos(0.055, 0.075, 0.075, mats.wit, 0, -0.025, -0.055));   // bles en snuit
  kop.add(bol(0.016, mats.roze, 0, -0.028, -0.092, 1, 0.7, 1));      // neusje
  for (const sx of [-1, 1]) {
    kop.add(bol(0.017, mats.oog, sx * 0.038, 0.012, -0.068, 1, 1.15, 0.6));
    // oortjes: een driehoekje op de kop
    const oor = new THREE.Mesh(schaduw(new THREE.ConeGeometry(0.032, 0.055, 4)), mats.zwart);
    oor.position.set(sx * 0.045, 0.078, 0.01);
    oor.rotation.z = sx * 0.18;
    kop.add(oor);
  }
  // snorharen
  for (const sx of [-1, 1]) kop.add(doos(0.075, 0.004, 0.004, mats.wit, sx * 0.055, -0.02, -0.075));

  // poten: voor en achter, elk aan een draaipunt zodat ze kunnen zwaaien
  const poten = [];
  for (const [sx, sz, zwartePoot] of [[-1, -1, true], [1, -1, false], [-1, 1, false], [1, 1, false]]) {
    const p = new THREE.Group();
    p.position.set(sx * 0.055, RUG - 0.055, sz * 0.13);
    p.add(doos(0.045, 0.19, 0.045, zwartePoot ? mats.zwart : mats.wit, 0, -0.095, 0));
    lijf.add(p);
    poten.push({ p, achter: sz > 0 });
  }

  // staart: drie stukjes die samen een boog maken
  const staart = new THREE.Group();
  staart.position.set(0, RUG + 0.03, 0.19);
  lijf.add(staart);
  let vorige = staart;
  for (let i = 0; i < 3; i++) {
    const lid = new THREE.Group();
    lid.position.z = i === 0 ? 0 : 0.09;
    lid.rotation.x = i === 0 ? -0.55 : -0.32;
    lid.add(doos(0.036 - i * 0.004, 0.036 - i * 0.004, 0.10, mats.zwart, 0, 0, 0.05));
    vorige.add(lid);
    vorige = lid;
  }

  let klok = zaad * 1.7;
  let zitT = 0;

  /*
   Eén beeld. `loopt` laat de poten zwaaien, `zit` klapt het achterlijf in.
   `snelheid` is in meters per seconde en bepaalt het tempo van de pas.
  */
  function update(dt, { loopt = false, zit = false, snelheid = 0.7 } = {}) {
    klok += dt;
    zitT += (zit ? 1 : -1) * dt * 4;
    zitT = Math.max(0, Math.min(1, zitT));
    if (loopt && !zit) {
      const zwaai = Math.sin(klok * snelheid * 7) * 0.55;
      for (const q of poten) q.p.rotation.x = (q.achter ? -zwaai : zwaai) * (q.p.position.x < 0 ? 1 : -1);
      lijf.position.y = Math.abs(Math.sin(klok * snelheid * 7)) * 0.012;
    } else {
      for (const q of poten) q.p.rotation.x += (0 - q.p.rotation.x) * Math.min(1, dt * 8);
      lijf.position.y += (0 - lijf.position.y) * Math.min(1, dt * 6);
    }
    // zitten: achterlijf zakt, voorpoten blijven staan, staart krult naar voren
    lijf.rotation.x = -0.30 * zitT;
    lijf.position.y -= 0.055 * zitT;
    for (const q of poten) if (q.achter) q.p.rotation.x = 1.15 * zitT;
    staart.rotation.x = 0.55 * zitT;
    // staart zwiept altijd een beetje
    staart.rotation.y = Math.sin(klok * 1.6) * (zit ? 0.14 : 0.26);
  }

  function zetNeer(x, z, yaw) {
    groep.position.set(x, 0, z);
    groep.rotation.y = yaw;
  }
  // naar een richting toedraaien, met een maximum per seconde
  function draaiNaar(yaw, dt, snel = 5) {
    let d = yaw - groep.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    groep.rotation.y += Math.max(-snel * dt, Math.min(snel * dt, d));
  }

  return { groep, update, zetNeer, draaiNaar, get materialen() { return Object.values(mats); } };
}
