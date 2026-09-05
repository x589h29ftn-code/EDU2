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

/**
 * Bouwt het pistool met hand en onderarm. `geluid` is js/audio.js; de module
 * roept daar zelf de klikken van het herladen op.
 */
export function maakPistool(geluid) {
  const staal = mat(STAAL, 0.42, 0.7);
  const staalDof = mat(0x1b1e22, 0.6, 0.5);
  const greepMat = mat(GREEP, 0.92);
  const magMat = mat(MAG, 0.5, 0.4);
  const huid = mat(0xd0a480, 0.95);
  const stof = mat(0x2f3a56, 0.95);
  const manchetMat = mat(0x27314a, 0.95);
  const ribbelMat = mat(0x201b18, 0.95);

  const groep = new THREE.Group();
  /*
   Alle blokjes van hetzelfde materiaal binnen één onderdeel gaan samen in één
   geometrie. Dat scheelt hier veel: het pistool hangt aan de camera en is dus
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

  // ---------------------------------------------------------------- wapen
  // Alles wat vastzit aan het frame zit in `wapen`; de slede en het magazijn
  // hangen daar los in, want die bewegen bij het herladen.
  const wapen = new THREE.Group();
  groep.add(wapen);

  const sB = bak();
  doos(sB, staal, 0.030, 0.040, 0.176, 0, 0.020, -0.048);
  doos(sB, staalDof, 0.031, 0.014, 0.030, 0, 0.004, -0.128);      // afschuining voorop
  // grepen op de slede: de ribbels waar je hem aan overhaalt
  for (let i = 0; i < 6; i++) doos(sB, staalDof, 0.032, 0.030, 0.004, 0, 0.020, 0.006 + i * 0.0085);
  doos(sB, staalDof, 0.033, 0.017, 0.042, 0.001, 0.026, -0.014);  // uitwerpopening
  doos(sB, staalDof, 0.012, 0.010, 0.006, 0, 0.043, -0.126);      // korrel, vlak achter de mond
  for (const sx of [-1, 1]) doos(sB, staalDof, 0.007, 0.009, 0.008, sx * 0.010, 0.043, 0.030);  // keep achterop
  doos(sB, staalDof, 0.026, 0.020, 0.008, 0, 0.030, 0.040);       // sluitstuk
  const slede = bouw(sB, new THREE.Group());
  wapen.add(slede);

  // onderstel: kast, stofkap onder de loop, trekkerbeugel, trekker en de loop
  const fB = bak();
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

  // greep, iets naar achteren gekanteld, met ribbels op de rug
  const gB = bak();
  doos(gB, greepMat, 0.029, 0.092, 0.038, 0, -0.060, 0.022);
  for (let i = 0; i < 5; i++) doos(gB, ribbelMat, 0.030, 0.005, 0.006, 0, -0.032 - i * 0.014, 0.041);
  const greep = bouw(gB, new THREE.Group());
  greep.rotation.x = 0.24;
  wapen.add(greep);

  // magazijn: los, zodat het eruit kan vallen
  const mB = bak();
  doos(mB, magMat, 0.024, 0.086, 0.030, 0, -0.062, 0.022);
  doos(mB, staalDof, 0.031, 0.008, 0.040, 0, -0.108, 0.022);      // bodemplaat
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
  flits.position.set(0, 0.021, -0.168);
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

  groep.position.set(0.15, -0.13, -0.42);
  groep.rotation.set(0, 0.10, 0.06);

  // ---------------------------------------------------------------- beweging
  let flitsT = 0, terugslag = 0, gedaan = -1;
  const RUST = { x: 0.15, y: -0.13, z: -0.42 };

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
   * bezig), `bob` de loopbeweging van de speler.
   */
  function update(dt, { herlaad = 0, bob = 0 } = {}) {
    terugslag = Math.max(0, terugslag - dt * 7);
    flitsT -= dt;
    const aan = flitsT > 0;
    flits.visible = aan;
    vlamMat.opacity = aan ? 0.55 + Math.random() * 0.45 : 0;

    if (herlaad > 0) {
      const t = 1 - herlaad / HERLAADTIJD;
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
      slede.position.z = Math.sin(sl * Math.PI) * 0.030;
      return;
    }
    gedaan = -1;
    magazijn.visible = true; magazijn.position.set(0, 0, 0);
    nieuwMag.visible = false;
    slede.position.z = terugslag * 0.026;
    groep.rotation.set(terugslag * 0.22, 0.10, 0.06);
    groep.position.set(RUST.x, RUST.y + Math.sin(bob) * 0.006, RUST.z + terugslag * 0.045);
  }

  // de losse onderdelen erbij, zodat tools/wapentest.mjs de beweging kan meten
  return { groep, vuur, update, delen: { slede, magazijn, nieuwMag, flits, hand, arm }, get terugslag() { return terugslag; } };
}
