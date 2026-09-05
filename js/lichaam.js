/*
 Eén maatvoering en één set lichaamsdelen voor alle mensen in het spel.

 De voetgangers (js/npc.js) zijn instanced meshes en de mensen die meespelen
 (js/persoon.js) hebben een echt skelet, maar ze zagen er tot nu toe ook
 verschillend uit: allebei een eigen stapeltje dozen, allebei met andere maten.
 Erger was dat armen en benen uit één stuk bestonden — een been dat van heup tot
 voet één rechte plank is, zwaait als een klok en niet als een been.

 Hier staan daarom de maten van een volwassene van 1,75 m en de losse
 onderdelen. Armen en benen hebben een elleboog en een knie, er zitten handen,
 schoenen en een bekken aan, en het hoofd heeft een neus en oren — bij elkaar is
 dat het verschil tussen een pop en een mens, ook op tien meter afstand.

 Elk onderdeel is een geometrie waarvan de oorsprong op het draaipunt ligt: een
 bovenarm hangt onder (0,0,0) naar beneden, zodat een draai om de x-as meteen
 een schouderdraai is. `loopHouding` rekent uit hoe ver alle gewrichten staan bij
 een gegeven pas; npc.js en persoon.js gebruiken allebei dezelfde uitkomst, dus
 een wandelaar en een agent lopen precies gelijk.
*/
import * as THREE from 'three';

// maten in meters, voor een lichaam van 1,75 m (schaal 1,0)
export const MAAT = {
  heup: 0.90,          // hoogte van het heupgewricht
  bovenbeen: 0.44,
  onderbeen: 0.39,     // enkel op 0,07
  schoenH: 0.07,
  heupX: 0.105,        // halve afstand tussen de heupen
  schouder: 1.42,
  schouderX: 0.205,
  bovenarm: 0.28,
  onderarm: 0.25,
  romp: 1.20,          // midden van de romp
  bekken: 0.99,
  nek: 1.46,
  hoofd: 1.615,
  hoofdR: 0.112,
  lengte: 1.75,
};

// ---------------------------------------------------------------- bouwstenen
function doosGeo(b, h, d, x = 0, y = 0, z = 0, rx = 0) {
  const g = new THREE.BoxGeometry(b, h, d);
  if (rx) g.rotateX(rx);
  g.translate(x, y, z);
  return g;
}

/*
 Losse geometrieën samenvoegen tot één. Zo kost een hoofd met neus en oren
 evenveel draw calls als een kale bol, en dat is nodig: bij de voetgangers is
 elk onderdeel een eigen instanced mesh.
*/
function samen(delen) {
  const pos = [], nor = [];
  for (const g of delen) {
    const ng = g.index ? g.toNonIndexed() : g;
    ng.computeVertexNormals();
    pos.push(...ng.attributes.position.array);
    nor.push(...ng.attributes.normal.array);
    if (ng !== g) ng.dispose();
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return geo;
}

/*
 De onderdelen. Elke functie geeft een geometrie met de oorsprong op het
 draaipunt: de romp om zijn eigen midden, een ledemaat aan de bovenkant.
*/
export const DEEL = {
  // borstkas en taille: bovenin breder dan onderin, anders is het een doos
  romp: () => samen([
    doosGeo(0.395, 0.24, 0.225, 0, 0.10, 0),
    doosGeo(0.345, 0.21, 0.195, 0, -0.11, 0),
    doosGeo(0.425, 0.10, 0.235, 0, 0.185, 0),      // schouderlijn
  ]),
  bekken: () => doosGeo(0.335, 0.19, 0.205),
  nek: () => { const g = new THREE.CylinderGeometry(0.055, 0.068, 0.10, 7); return g; },
  // hoofd met een neus en oren; zonder die twee is het een biljartbal
  hoofd: () => {
    const kop = new THREE.SphereGeometry(MAAT.hoofdR, 10, 8);
    kop.scale(1.0, 1.13, 1.06);
    const delen = [kop, doosGeo(0.030, 0.032, 0.036, 0, -0.012, -0.108)];
    for (const sx of [-1, 1]) delen.push(doosGeo(0.014, 0.045, 0.030, sx * 0.108, 0.005, 0.008));
    return samen(delen);
  },
  // kapsel: kruin plus een stukje in de nek
  haar: () => samen([
    new THREE.SphereGeometry(0.119, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.56),
    doosGeo(0.185, 0.09, 0.10, 0, -0.055, 0.055),
  ]),
  bovenarm: () => doosGeo(0.092, MAAT.bovenarm, 0.098, 0, -MAAT.bovenarm / 2, 0),
  onderarm: () => doosGeo(0.080, MAAT.onderarm, 0.086, 0, -MAAT.onderarm / 2, 0),
  hand: () => samen([doosGeo(0.078, 0.100, 0.052, 0, -0.050, 0)]),
  bovenbeen: () => doosGeo(0.135, MAAT.bovenbeen, 0.155, 0, -MAAT.bovenbeen / 2, 0),
  onderbeen: () => doosGeo(0.115, MAAT.onderbeen, 0.125, 0, -MAAT.onderbeen / 2, 0),
  // schoen: hangt aan de enkel en steekt naar voren uit
  schoen: () => samen([
    doosGeo(0.108, MAAT.schoenH, 0.235, 0, -MAAT.schoenH / 2, -0.045),
    doosGeo(0.098, 0.045, 0.10, 0, -0.020, 0.030),        // hiel
  ]),
  // pet met klep, in plaats van haar
  pet: () => samen([
    new THREE.SphereGeometry(0.122, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5),
    doosGeo(0.245, 0.026, 0.244, 0, 0.006, 0),
    doosGeo(0.185, 0.020, 0.115, 0, 0.000, -0.155),       // klep
  ]),
  /*
   Veiligheidsvest over de romp: een bak om de borst plus twee schouderbanden.
   Hij is een fractie ruimer dan de borstkas zelf (0,245 tegen 0,225 diep), zodat
   hij er netjes overheen valt en er geen vlakken door elkaar heen flikkeren.
  */
  vest: () => {
    const delen = [doosGeo(0.412, 0.265, 0.245, 0, 0.095, 0)];
    for (const sx of [-1, 1]) delen.push(doosGeo(0.075, 0.11, 0.252, sx * 0.135, 0.205, 0));
    return samen(delen);
  },
};

/*
 Hoe staan de gewrichten bij een gegeven pas?

   fase   loopt door met de tijd; één hele slag is twee stappen
   loopt  false = stilstaan, dan hangen de armen en staan de benen recht
   ren    0..1, hoe hard: rennen zwaait verder en buigt de knie meer

 Alle hoeken zijn draaiingen om de x-as van het lichaam (positief = naar voren).
 Een knie kan maar één kant op, dus die krijgt alleen een positieve buiging als
 het onderbeen naar achteren zwaait — anders knikt hij de verkeerde kant uit.
*/
export function loopHouding(fase, loopt, ren = 0, uit = {}) {
  const zw = loopt ? 0.38 + ren * 0.26 : 0;
  const s = Math.sin(fase), c = Math.cos(fase);
  uit.heupL = s * zw;
  uit.heupR = -s * zw;
  // knie: buigt als het been naar achteren gaat en bij het opzwaaien
  uit.knieL = loopt ? Math.max(0, -s) * (0.55 + ren * 0.55) + Math.max(0, -c) * 0.25 : 0.03;
  uit.knieR = loopt ? Math.max(0, s) * (0.55 + ren * 0.55) + Math.max(0, c) * 0.25 : 0.03;
  // enkel volgt het onderbeen maar blijft vlakker
  uit.enkelL = -uit.knieL * 0.45;
  uit.enkelR = -uit.knieR * 0.45;
  // armen tegengesteld aan de benen, met een elleboog die altijd wat gebogen is
  const az = loopt ? 0.34 + ren * 0.30 : 0;
  uit.schouderL = -s * az;
  uit.schouderR = s * az;
  uit.elleboogL = 0.15 + (loopt ? Math.max(0, -s) * (0.45 + ren * 0.5) : 0);
  uit.elleboogR = 0.15 + (loopt ? Math.max(0, s) * (0.45 + ren * 0.5) : 0);
  /*
   En het lichaam zakt. Wie een stap zet staat met gespreide benen lager dan wie
   rechtop staat — sla je dat over, dan zweven de voeten bij elke pas een paar
   centimeter boven de stoep. De zak is de hoogte die het gestrekte been
   verliest, iets afgezwakt omdat de knie de rest opvangt.
  */
  const been = MAAT.bovenbeen + MAAT.onderbeen;
  uit.wip = loopt ? -been * (1 - Math.cos(zw * Math.abs(s))) * 0.85 : 0;
  return uit;
}

/*
 Fietsen: de benen draaien rondjes op de trappers en de armen liggen vooruit op
 het stuur. De romp helt naar voren (dat regelt de aanroeper met `tilt`).
*/
export function fietsHouding(fase, uit = {}) {
  const s = Math.sin(fase), c = Math.cos(fase);
  uit.heupL = 1.05 + s * 0.42;
  uit.heupR = 1.05 - s * 0.42;
  uit.knieL = 0.85 + c * 0.50;
  uit.knieR = 0.85 - c * 0.50;
  uit.enkelL = -0.25; uit.enkelR = -0.25;
  uit.schouderL = 1.05; uit.schouderR = 1.05;
  uit.elleboogL = 0.30; uit.elleboogR = 0.30;
  uit.wip = 0;
  return uit;
}

/** Houding voor wie met twee handen een wapen vooruit houdt. */
export function mikHouding(uit = {}) {
  uit.schouderL = 1.42; uit.schouderR = 1.48;
  uit.elleboogL = 0.55; uit.elleboogR = 0.30;
  return uit;
}
