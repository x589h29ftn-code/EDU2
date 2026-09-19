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
    // de schouders zelf: twee blokjes die de hoek eraf halen, zodat de romp
    // bovenin niet als een plank ophoudt
    doosGeo(0.115, 0.075, 0.205, -0.165, 0.225, 0),
    doosGeo(0.115, 0.075, 0.205, 0.165, 0.225, 0),
    doosGeo(0.185, 0.085, 0.150, 0, 0.245, 0),     // aanzet van de nek
  ]),
  // bekken met een broekband die een slag breder is dan de broek eronder
  bekken: () => samen([
    doosGeo(0.335, 0.19, 0.205),
    doosGeo(0.352, 0.042, 0.215, 0, 0.085, 0),
  ]),
  nek: () => { const g = new THREE.CylinderGeometry(0.055, 0.068, 0.10, 7); return g; },
  /*
   Hoofd met een neus, oren, een kaak en een kin. De bol alleen was een
   biljartbal; met de neus en de oren erbij werd het een hoofd, maar van opzij
   bleef het een bal met dingen erop. Een kaaklijn die naar de kin toe smaller
   wordt is wat je van een mens herkent, ook op tien meter.
  */
  hoofd: () => {
    const kop = new THREE.SphereGeometry(MAAT.hoofdR, 10, 8);
    kop.scale(1.0, 1.13, 1.06);
    const delen = [
      kop,
      doosGeo(0.030, 0.034, 0.038, 0, -0.014, -0.106),        // neus
      doosGeo(0.150, 0.052, 0.150, 0, -0.088, -0.012),        // kaak
      doosGeo(0.086, 0.034, 0.090, 0, -0.112, -0.024),        // kin
    ];
    for (const sx of [-1, 1]) delen.push(doosGeo(0.014, 0.045, 0.030, sx * 0.108, 0.005, 0.008));
    return samen(delen);
  },
  /*
   Ogen, als eigen onderdeel omdat ze een andere kleur hebben dan de huid — bij
   de voetgangers is elk onderdeel één instanced mesh met één kleur. Twee
   donkere spleetjes, meer niet, en het is het verschil tussen een pop en iemand
   die je aankijkt.

   Er zaten eerst wenkbrauwen bij. Die liepen op deze afstand met de ogen samen
   tot één donkere band over het gezicht — een blinddoek. Weg dus; twee kleine
   ogen doen het werk.
  */
  ogen: () => {
    const delen = [];
    for (const sx of [-1, 1]) {
      delen.push(doosGeo(0.022, 0.012, 0.010, sx * 0.045, 0.008, -0.103));
    }
    return samen(delen);
  },
  // kapsel: kruin plus een stukje in de nek
  /*
   Kapsel: een kruin plus een stukje in de nek. De kruin liep tot op de ooglijn
   en dat las als een helm; hij houdt nu hoger op, zodat er voorhoofd overblijft.
  */
  haar: () => samen([
    new THREE.SphereGeometry(0.119, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.44),
    doosGeo(0.205, 0.075, 0.085, 0, -0.030, 0.060),        // achterhoofd
    doosGeo(0.215, 0.030, 0.150, 0, -0.058, 0.035),        // in de nek
  ]),
  bovenarm: () => doosGeo(0.092, MAAT.bovenarm, 0.098, 0, -MAAT.bovenarm / 2, 0),
  onderarm: () => doosGeo(0.080, MAAT.onderarm, 0.086, 0, -MAAT.onderarm / 2, 0),
  // hand met een duim eraan: van dichtbij is een blokje aan een arm een want
  hand: () => samen([
    doosGeo(0.072, 0.095, 0.050, 0, -0.048, 0),
    doosGeo(0.030, 0.052, 0.038, -0.038, -0.030, 0.004),
  ]),
  bovenbeen: () => doosGeo(0.135, MAAT.bovenbeen, 0.155, 0, -MAAT.bovenbeen / 2, 0),
  onderbeen: () => doosGeo(0.115, MAAT.onderbeen, 0.125, 0, -MAAT.onderbeen / 2, 0),
  // schoen: hangt aan de enkel en steekt naar voren uit
  schoen: () => samen([
    doosGeo(0.108, MAAT.schoenH, 0.235, 0, -MAAT.schoenH / 2, -0.045),
    doosGeo(0.098, 0.045, 0.10, 0, -0.020, 0.030),        // hiel
    doosGeo(0.114, 0.022, 0.245, 0, -MAAT.schoenH + 0.008, -0.048),   // zool, iets breder
    doosGeo(0.100, 0.050, 0.070, 0, 0.020, 0.006),        // wreef, tot over de enkel
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
export function loopHouding(fase, loopt, ren = 0, uit = {}, klok = 0) {
  const zw = loopt ? 0.38 + ren * 0.26 : 0;
  const s = Math.sin(fase), c = Math.cos(fase);
  uit.heupL = s * zw;
  uit.heupR = -s * zw;
  // knie: buigt als het been naar achteren gaat en bij het opzwaaien
  uit.knieL = loopt ? Math.max(0, -s) * (0.55 + ren * 0.55) + Math.max(0, -c) * 0.25 : 0.03;
  uit.knieR = loopt ? Math.max(0, s) * (0.55 + ren * 0.55) + Math.max(0, c) * 0.25 : 0.03;
  /*
   De enkel. Hij volgde alleen de knie, en daardoor stond de voet het hele
   rondje in dezelfde stand — alsof je op planken loopt. Een pas heeft twee
   momenten die je ziet: de hiel komt als eerste neer (voet omhoog), en aan het
   eind zet je af met de teen (voet omlaag). Dat is één sinus, een kwartslag
   verschoven ten opzichte van de heup.
  */
  const afzet = loopt ? (0.30 + ren * 0.22) : 0;
  uit.enkelL = -uit.knieL * 0.35 + c * afzet;
  uit.enkelR = -uit.knieR * 0.35 - c * afzet;
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

  /*
   Wat er tot nu toe ontbrak: het lichaam zelf deed niet mee. Armen en benen
   zwaaiden, maar de romp stond er kaarsrecht en doodstil bij, en dat is waarom
   iedereen eruitzag als een marionet.

     romp    voorover hellen. Wie rent hangt vooruit; wie stilstaat staat een
             fractie voorover, want kaarsrecht staat niemand;
     rol     de zijwaartse slinger. Bij elke pas valt je gewicht op één been en
             helt je bovenlichaam een graad of twee die kant op — twee keer per
             hele slag, dus op het dubbele van de pasfrequentie;
     hoofd   tegendraai, zodat het hoofd waterpas blijft terwijl de romp helt.
             Dat doet een mens vanzelf: je ogen willen stil staan;
     armZij  de armen hangen niet plat tegen de romp maar een paar graden naar
             buiten, en bij het rennen verder.

   Staat hij stil, dan staat hij niet stíl: `klok` (de tijd in seconden) laat
   hem ademen en langzaam van het ene op het andere been wisselen. Een rij
   mensen die allemaal bevroren staan te wachten is net zo verkeerd als een rij
   die allemaal precies gelijk loopt.
  */
  if (loopt) {
    uit.romp = 0.035 + ren * 0.16;
    uit.rol = Math.sin(fase * 2 + Math.PI / 2) * (0.022 + ren * 0.030);
    uit.armZij = 0.07 + ren * 0.07;
    uit.wip += Math.abs(c) * (0.004 + ren * 0.010);
  } else {
    const adem = Math.sin(klok * 1.7);
    uit.romp = 0.020 + adem * 0.008;
    uit.rol = Math.sin(klok * 0.45) * 0.035;
    uit.armZij = 0.06;
    uit.wip = adem * 0.007;
    // en de armen hangen niet als twee stokken stil
    uit.schouderL = Math.sin(klok * 0.45 + 0.4) * 0.035;
    uit.schouderR = -uit.schouderL;
  }
  uit.hoofd = -uit.romp * 0.8;
  return uit;
}

/*
 Fietsen: de benen draaien rondjes op de trappers en de armen liggen vooruit op
 het stuur. De romp helt naar voren (dat regelt de aanroeper met `tilt`).
*/
export function fietsHouding(fase, uit = {}) {
  uit.romp = 0; uit.rol = 0; uit.hoofd = 0; uit.armZij = 0.10;
  const s = Math.sin(fase), c = Math.cos(fase);
  uit.heupL = 1.05 + s * 0.42;
  uit.heupR = 1.05 - s * 0.42;
  uit.knieL = 0.85 + c * 0.50;
  uit.knieR = 0.85 - c * 0.50;
  uit.enkelL = -0.25; uit.enkelR = -0.25;
  /*
   De armen naar het stuur. Schouder 1,26 rad en elleboog 0,34: de hand komt dan
   uit op zo'n 0,44 m vóór en 0,36 m onder de schouder, en daar ligt het stuur
   van de fiets in js/npc.js. Op 1,05 bleef de hand er een kwart meter vandaan
   en stak de arm er als een plank naast.
  */
  uit.schouderL = 1.26; uit.schouderR = 1.26;
  uit.elleboogL = 0.34; uit.elleboogR = 0.34;
  // de handen staan op stuurbreedte uit elkaar, niet tegen de romp aan
  uit.armZij = 0.16;
  uit.wip = 0;
  return uit;
}

/*
 Gebukt lopen. `mate` loopt van 0 (rechtop) tot 1 (zo diep als het gaat): de
 heupen zakken, de knieën buigen mee en het bovenlichaam helt naar voren, zodat
 je achter een muurtje of een auto past. De armen komen wat naar voren, want met
 twee slingerende armen naast je lichaam zie je er niet uit als iemand die zich
 verstopt.

 Levert terug hoeveel het lichaam zakt (in meters, bij schaal 1): de aanroeper
 zet de heup en de camera daarmee lager.
*/
export const HURK_HEUP = 1.45, HURK_KNIE = 2.15;
export function hurkHouding(uit, mate = 1) {
  const m = Math.max(0, Math.min(1, mate));
  if (!m) return 0;
  const h = m * HURK_HEUP, k = m * HURK_KNIE;
  uit.heupL += h; uit.heupR += h;
  uit.knieL += k; uit.knieR += k;
  // de voet blijft plat op de grond staan: de enkel maakt de knik goed
  uit.enkelL += k - h; uit.enkelR += k - h;
  uit.schouderL += m * 0.30; uit.schouderR += m * 0.30;
  uit.elleboogL += m * 0.55; uit.elleboogR += m * 0.55;
  uit.romp = (uit.romp || 0) + m * 0.26;
  uit.hoofd = -(uit.romp || 0) * 0.8;
  uit.armZij = (uit.armZij || 0) + m * 0.05;
  /*
   Hoeveel de heup zakt, uitgerekend en niet geschat: het bovenbeen staat onder
   `h` uit het lood en het onderbeen onder `h − k`, dus wat er van de beenlengte
   in hoogte overblijft is de som van die twee cosinussen. Volledig gehurkt is
   dat achtenveertig centimeter — precies zoveel als een mens zakt.
  */
  const staand = MAAT.bovenbeen + MAAT.onderbeen;
  const zak = staand - (MAAT.bovenbeen * Math.cos(h) + MAAT.onderbeen * Math.cos(h - k));
  uit.wip = (uit.wip || 0) - zak;
  return zak;
}

/** Houding voor wie met twee handen een wapen vooruit houdt. */
export function mikHouding(uit = {}) {
  uit.schouderL = 1.42; uit.schouderR = 1.48;
  uit.elleboogL = 0.55; uit.elleboogR = 0.30;
  return uit;
}
