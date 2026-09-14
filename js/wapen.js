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
*/
import * as THREE from 'three';

const STAAL = 0x23262b, GREEP = 0x2b2420, MAG = 0x1a1c20;

export const HERLAADTIJD = 1.55;

/*
 De vijf stappen van het herladen, als fractie van HERLAADTIJD. Ze staan hier bij
 elkaar zodat de beweging en het geluid nooit uit elkaar kunnen lopen.
*/
const STAP = {
  kantelen: [0.00, 0.16],   // wapen kantelt naar je toe, magazijnknop in
  magUit: [0.16, 0.32],     // het lege magazijn valt eruit
  magIn: [0.34, 0.64],      // het volle magazijn komt van onderen omhoog
  slede: [0.70, 0.86],      // slede naar achteren en weer naar voren
  terug: [0.86, 1.00],      // terug in de aanslag
};
const deel = (t, [a, b]) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const soepel = (u) => u * u * (3 - 2 * u);

function mat(kleur, ruw, metaal = 0) {
  return new THREE.MeshStandardMaterial({ color: kleur, roughness: ruw, metalness: metaal });
}

/*
 Alle blokjes van hetzelfde materiaal binnen één onderdeel gaan samen in één
 geometrie. Dat scheelt hier veel: het wapen hangt aan de camera en is dus
 altijd in beeld, en als los blokje zou elk ribbeltje op de slede een eigen
 draw call kosten — drieënveertig in totaal, tegen dertien voor het oude
 model. Zo zijn het er vijftien.
*/
const bak = () => ({ delen: [] });
const doos = (bk, m, b, h, d, x = 0, y = 0, z = 0) => {
  const g = new THREE.BoxGeometry(b, h, d);
  g.translate(x, y, z);
  bk.delen.push({ g, m });
};
const vorm = (bk, g, m) => bk.delen.push({ g, m });
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

function maakWapen(geluid, soort = 'pistool') {
  const SMG = soort === 'mitrailleur';
  const staal = mat(STAAL, 0.42, 0.7);
  const staalDof = mat(0x1b1e22, 0.6, 0.5);
  const greepMat = mat(GREEP, 0.92);
  const magMat = mat(MAG, 0.5, 0.4);
  const huid = mat(0xd0a480, 0.95);
  const stof = mat(0x2f3a56, 0.95);
  const manchetMat = mat(0x27314a, 0.95);
  const ribbelMat = mat(0x201b18, 0.95);

  const groep = new THREE.Group();

  // ---------------------------------------------------------------- wapen
  // Alles wat vastzit aan het frame zit in `wapen`; de slede en het magazijn
  // hangen daar los in, want die bewegen bij het herladen.
  const wapen = new THREE.Group();
  groep.add(wapen);

  const sB = bak();
  if (SMG) {
    /*
     Bij een machinepistool schuift niet de hele bovenkant naar achteren maar de
     grendel eronder; wat je ziet bewegen is de spanknop op de kast. Die zit
     daarom in hetzelfde onderdeel als bij het pistool, zodat de herlaadbeweging
     hieronder voor allebei klopt.
    */
    doos(sB, staal, 0.044, 0.042, 0.250, 0, 0.028, -0.055);          // grendelkast
    doos(sB, staalDof, 0.046, 0.010, 0.250, 0, 0.049, -0.055);       // rib over de rug
    doos(sB, staalDof, 0.014, 0.016, 0.032, 0, 0.054, -0.020);       // spanknop
    doos(sB, staalDof, 0.014, 0.012, 0.008, 0, 0.056, -0.172);       // korrel
    for (const sx of [-1, 1]) doos(sB, staalDof, 0.008, 0.011, 0.008, sx * 0.012, 0.056, 0.055);  // keep
  } else {
  doos(sB, staal, 0.030, 0.040, 0.176, 0, 0.020, -0.048);
  doos(sB, staalDof, 0.031, 0.014, 0.030, 0, 0.004, -0.128);      // afschuining voorop
  // grepen op de slede: de ribbels waar je hem aan overhaalt
  for (let i = 0; i < 6; i++) doos(sB, staalDof, 0.032, 0.030, 0.004, 0, 0.020, 0.006 + i * 0.0085);
  doos(sB, staalDof, 0.033, 0.017, 0.042, 0.001, 0.026, -0.014);  // uitwerpopening
  doos(sB, staalDof, 0.012, 0.010, 0.006, 0, 0.043, -0.126);      // korrel, vlak achter de mond
  for (const sx of [-1, 1]) doos(sB, staalDof, 0.007, 0.009, 0.008, sx * 0.010, 0.043, 0.030);  // keep achterop
  doos(sB, staalDof, 0.026, 0.020, 0.008, 0, 0.030, 0.040);       // sluitstuk
  }
  const slede = bouw(sB, new THREE.Group());
  wapen.add(slede);

  // onderstel: kast, stofkap onder de loop, trekkerbeugel, trekker en de loop
  const fB = bak();
  if (SMG) {
    const loopSMG = new THREE.CylinderGeometry(0.0075, 0.0075, 0.10, 10);
    loopSMG.rotateX(Math.PI / 2); loopSMG.translate(0, 0.024, -0.230);
    vorm(fB, loopSMG, staalDof);
    doos(fB, staal, 0.040, 0.040, 0.110, 0, 0.024, -0.180);         // loopmantel
    for (let i = 0; i < 4; i++) doos(fB, staalDof, 0.042, 0.011, 0.008, 0, 0.024, -0.142 - i * 0.024);  // koelribben
    doos(fB, staal, 0.036, 0.030, 0.160, 0, -0.004, -0.060);        // kast onder de grendel
    doos(fB, staal, 0.021, 0.007, 0.046, 0, -0.041, -0.020);        // onderkant beugel
    doos(fB, staal, 0.021, 0.020, 0.007, 0, -0.031, -0.042);        // voorkant beugel
    doos(fB, staalDof, 0.009, 0.021, 0.007, 0, -0.029, -0.017);     // trekker
    doos(fB, staalDof, 0.009, 0.011, 0.010, -0.019, -0.010, 0.004); // magazijnknop
    // de schouderstut ingeklapt: twee stangen langs de kast met de plaat erachter
    for (const sx of [-1, 1]) doos(fB, staalDof, 0.008, 0.010, 0.170, sx * 0.026, 0.008, 0.105);
    doos(fB, staalDof, 0.062, 0.013, 0.030, 0, 0.008, 0.196);
    bouw(fB, wapen);
  } else {
  const loopGeo = new THREE.CylinderGeometry(0.0058, 0.0058, 0.030, 10);
  loopGeo.rotateX(Math.PI / 2); loopGeo.translate(0, 0.021, -0.146);
  vorm(fB, loopGeo, staalDof);
  doos(fB, staal, 0.028, 0.026, 0.130, 0, -0.008, -0.028);
  doos(fB, staal, 0.025, 0.017, 0.062, 0, -0.006, -0.092);
  doos(fB, staal, 0.021, 0.007, 0.040, 0, -0.041, -0.020);        // onderkant beugel
  doos(fB, staal, 0.021, 0.020, 0.007, 0, -0.031, -0.038);        // voorkant beugel
  doos(fB, staalDof, 0.009, 0.021, 0.007, 0, -0.029, -0.017);     // trekker
  doos(fB, staalDof, 0.009, 0.011, 0.010, -0.017, -0.007, 0.004); // magazijnknop
  bouw(fB, wapen);
  }

  // greep, iets naar achteren gekanteld, met ribbels op de rug
  const gB = bak();
  doos(gB, greepMat, 0.029, 0.092, 0.038, 0, -0.060, 0.022);
  for (let i = 0; i < 5; i++) doos(gB, ribbelMat, 0.030, 0.005, 0.006, 0, -0.032 - i * 0.014, 0.041);
  const greep = bouw(gB, new THREE.Group());
  greep.rotation.x = 0.24;
  wapen.add(greep);

  // magazijn: los, zodat het eruit kan vallen. Bij het machinepistool zit het
  // net als bij een Uzi door de greep heen, en het is een stuk langer: dertig
  // patronen in plaats van twaalf.
  const mB = bak();
  if (SMG) {
    doos(mB, magMat, 0.026, 0.150, 0.032, 0, -0.095, 0.022);
    doos(mB, staalDof, 0.033, 0.008, 0.042, 0, -0.174, 0.022);
  } else {
  doos(mB, magMat, 0.024, 0.086, 0.030, 0, -0.062, 0.022);
  doos(mB, staalDof, 0.031, 0.008, 0.040, 0, -0.108, 0.022);      // bodemplaat
  }
  const magazijn = bouw(mB, new THREE.Group());
  magazijn.rotation.x = 0.24;
  wapen.add(magazijn);

  // het volle magazijn dat je erin duwt; buiten het herladen onzichtbaar
  const nieuwMag = magazijn.clone();
  nieuwMag.visible = false;
  wapen.add(nieuwMag);

  /*
   Mondingsvuur. Een bolletje was te rond en te braaf; dit is een kegel vooruit
   met een dwarskruis erdoorheen, additief opgeteld bij wat erachter ligt.
  */
  const vlamMat = new THREE.MeshBasicMaterial({
    color: 0xffb648, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const vB = bak();
  const kegel = new THREE.ConeGeometry(0.020, 0.070, 6);
  kegel.rotateX(-Math.PI / 2); kegel.translate(0, 0, -0.030);
  vorm(vB, kegel, vlamMat);
  for (const r of [0, Math.PI / 2]) {
    const blad = new THREE.PlaneGeometry(0.075, 0.028);
    blad.rotateZ(r);
    vorm(vB, blad, vlamMat);
  }
  const flits = bouw(vB, new THREE.Group());
  flits.position.set(0, SMG ? 0.024 : 0.021, SMG ? -0.278 : -0.168);
  flits.visible = false;
  wapen.add(flits);

  // ---------------------------------------------------------------- hand
  const hB = bak();
  doos(hB, huid, 0.046, 0.066, 0.044, 0.006, -0.056, 0.030);        // handpalm achter de greep
  // vier vingers om de voorkant van de greep heen
  for (let i = 0; i < 4; i++) doos(hB, huid, 0.044, 0.014, 0.019, -0.004, -0.036 - i * 0.017, 0.001);
  doos(hB, huid, 0.017, 0.022, 0.046, -0.023, -0.028, 0.020);       // duim langs de kast
  doos(hB, huid, 0.014, 0.013, 0.040, -0.011, -0.029, -0.012);      // wijsvinger aan de trekker
  const hand = bouw(hB, new THREE.Group());
  hand.rotation.x = 0.24;
  groep.add(hand);

  // pols en onderarm: lopen schuin naar de rechteronderhoek uit beeld
  const aB = bak();
  const pols = new THREE.BoxGeometry(0.050, 0.056, 0.070);
  pols.rotateY(0.22); pols.rotateX(-0.26); pols.translate(0.016, -0.088, 0.082);
  vorm(aB, pols, huid);
  const mouw = new THREE.BoxGeometry(0.076, 0.082, 0.44);
  mouw.rotateZ(0.06); mouw.rotateY(0.34); mouw.rotateX(-0.26); mouw.translate(0.086, -0.150, 0.300);
  vorm(aB, mouw, stof);
  const manchet = new THREE.BoxGeometry(0.084, 0.090, 0.034);
  manchet.rotateZ(0.06); manchet.rotateY(0.34); manchet.rotateX(-0.26); manchet.translate(0.030, -0.104, 0.112);
  vorm(aB, manchet, manchetMat);
  const arm = bouw(aB, new THREE.Group());
  groep.add(arm);

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

  /** Eén schot: mondingsvuur aan en de slede schiet naar achteren. */
  function vuur() {
    flitsT = 0.055;
    terugslag = 1;
    flits.rotation.z = Math.random() * Math.PI;
    const s = 0.85 + Math.random() * 0.4;
    flits.scale.set(s, s, 0.8 + Math.random() * 0.5);
  }

  /**
   * Eén beeld. `herlaad` is de resterende herlaadtijd in seconden (0 = niet
   * bezig), `bob` de loopbeweging van de speler, `mik` hoever je over het
   * vizier kijkt (0 = uit de heup, 1 = aangeslagen) en `holster` hoever het
   * wapen weggeborgen is (0 = in de aanslag, 1 = helemaal uit beeld).
   */
  function update(dt, { herlaad = 0, bob = 0, mik = 0, holster = 0 } = {}) {
    terugslag = Math.max(0, terugslag - dt * 7);
    flitsT -= dt;
    const aan = flitsT > 0;
    flits.visible = aan;
    vlamMat.opacity = aan ? 0.55 + Math.random() * 0.45 : 0;

    if (herlaad > 0) {
      const t = 1 - herlaad / HERLAAD;
      // geluid: elke stap één keer, op het moment dat je hem ziet
      const stapNr = t < STAP.magUit[0] ? 0 : t < STAP.magIn[0] ? 1 : t < STAP.slede[0] ? 2 : t < STAP.terug[0] ? 3 : 4;
      if (stapNr !== gedaan) {
        gedaan = stapNr;
        if (stapNr === 0) geluid.magazijnKnop();
        else if (stapNr === 1) geluid.magazijnUit();
        else if (stapNr === 3) geluid.magazijnIn();
        else if (stapNr === 4) geluid.slede();
      }
      /*
       Het wapen kantelt naar je toe, zakt een stukje en komt dichterbij, zodat
       je in het magazijnhuis kijkt. Niet verder: zak je er echt mee weg, dan
       valt de hele beweging onder de onderrand van het beeld en zie je alleen
       nog "herladen..." in de hoek staan.
      */
      const uit = soepel(deel(t, STAP.kantelen)) - soepel(deel(t, STAP.terug));
      groep.position.x = RUST.x - 0.030 * uit;
      groep.position.y = RUST.y - 0.030 * uit;
      groep.position.z = RUST.z + 0.070 * uit;
      groep.rotation.z = 0.06 + 0.62 * uit;
      groep.rotation.x = 0.16 * uit;
      groep.rotation.y = 0.10 - 0.30 * uit;
      // het lege magazijn valt eruit
      const val = deel(t, STAP.magUit);
      magazijn.visible = val < 1;
      magazijn.position.y = -0.30 * val * val;
      magazijn.position.z = 0.03 * val;
      // het nieuwe magazijn komt van onderen omhoog en klikt vast
      const in1 = soepel(deel(t, STAP.magIn));
      nieuwMag.visible = in1 > 0 && in1 < 1;
      nieuwMag.position.y = -0.26 * (1 - in1);
      if (in1 >= 1) { magazijn.visible = true; magazijn.position.set(0, 0, 0); }
      // slede naar achteren en weer naar voren
      const sl = deel(t, STAP.slede);
      slede.position.z = Math.sin(sl * Math.PI) * (SMG ? 0.020 : 0.030);
      wegbergen(holster);
      return;
    }
    gedaan = -1;
    magazijn.visible = true; magazijn.position.set(0, 0, 0);
    nieuwMag.visible = false;
    slede.position.z = terugslag * SLAG;

    /*
     Van de heup naar het vizier en terug. Alles wat het wapen scheef en opzij
     houdt (de kanteling van 0,10 en 0,06 rad, de x-verschuiving, het deinen van
     het lopen) loopt met `m` terug naar nul: aangeslagen staat het wapen recht
     voor je en staat het stil, want anders kijk je er niet overheen. De
     terugslag blijft wel te zien, maar korter — je hebt hem beter in bedwang.
    */
    const m = Math.max(0, Math.min(1, mik));
    const deinen = Math.sin(bob) * 0.006 * (1 - m);
    groep.rotation.set(terugslag * 0.22 * (1 - 0.45 * m), 0.10 * (1 - m), 0.06 * (1 - m));
    groep.position.set(
      RUST.x + (MIK.x - RUST.x) * m,
      RUST.y + (MIK.y - RUST.y) * m + deinen,
      RUST.z + (MIK.z - RUST.z) * m + terugslag * 0.045 * (1 - 0.5 * m),
    );
    wegbergen(holster);
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
    delen: { slede, magazijn, nieuwMag, flits, hand, arm },
    // waar het wapen hangt in de heup en aan het oog, zodat tools/wapentest.mjs
    // kan narekenen dat de vizierlijn door het midden van het scherm loopt
    houding: { rust: RUST, mik: MIK, vizierY: VIZIER_Y },
    get terugslag() { return terugslag; },
  };
}
