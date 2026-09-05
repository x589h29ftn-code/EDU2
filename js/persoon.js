/*
 Eén los poppetje met een echt skelet: de mensen die in het verhaal meespelen,
 de bewakers, de agenten en de dief.

 De maten en de lichaamsdelen komen uit js/lichaam.js, dus hij ziet er precies
 zo uit als de voetgangers in js/npc.js — die zijn instanced meshes en kunnen
 geen eigen skelet hebben, maar de bouw is dezelfde. Het verschil zit in de
 aansturing: deze kan lopen, zwaaien, je aankijken, mikken, vuren en omvallen.

 Ledematen hangen aan elkaar: de onderarm aan de elleboog, de hand aan de pols,
 de schoen aan de enkel. Daardoor buigt een knie ook echt en zwaait een been niet
 als een plank aan een scharnier.
*/
import * as THREE from 'three';
import { grondHoogte } from './viaduct.js';
import { MAAT, DEEL, loopHouding, mikHouding } from './lichaam.js';

const SCHOUDER_X = 0.235;

function mat(hex, ruw = 0.92) {
  return new THREE.MeshStandardMaterial({ color: hex, roughness: ruw });
}

export class Persoon {
  /*
   kleding en postuur; hoogte 1.0 is een volwassene van 1,75 m
     wapen  geeft hem een geweer in de handen (bewaking en politie)
     pet    pet in plaats van haar
     vest   veiligheidsvest over de romp (de politie draagt er een)
  */
  constructor({ shirt = 0x2a6b3a, broek = 0x24303f, huid = 0xd9b48f, haar = 0x2a1d12,
    hoogte = 1.0, wapen = false, pet = false, petKleur = 0x1d2634,
    vest = null, schoen = 0x24242a } = {}) {
    const mShirt = mat(shirt), mBroek = mat(broek), mHuid = mat(huid, 0.85);
    const mHaar = mat(haar), mSchoen = mat(schoen, 0.7);
    this.groep = new THREE.Group();
    this.groep.scale.setScalar(hoogte);

    const mesh = (geo, m, x = 0, y = 0, z = 0) => {
      const o = new THREE.Mesh(geo, m);
      o.position.set(x, y, z);
      o.castShadow = true; o.receiveShadow = true;
      return o;
    };

    // romp, bekken, nek en hoofd
    this.groep.add(mesh(DEEL.romp(), mShirt, 0, MAAT.romp, 0));
    this.groep.add(mesh(DEEL.bekken(), mBroek, 0, MAAT.bekken, 0));
    this.groep.add(mesh(DEEL.nek(), mHuid, 0, MAAT.nek, 0));
    this.groep.add(mesh(DEEL.hoofd(), mHuid, 0, MAAT.hoofd, 0));
    if (pet) this.groep.add(mesh(DEEL.pet(), mat(petKleur), 0, MAAT.hoofd + 0.020, 0));
    else this.groep.add(mesh(DEEL.haar(), mHaar, 0, MAAT.hoofd + 0.020, 0));
    if (vest) this.groep.add(mesh(DEEL.vest(), mat(vest, 0.72), 0, MAAT.romp, 0));

    /*
     Een ledemaat: een draaipunt met daaronder het bovenstuk, dan een tweede
     draaipunt (elleboog of knie) met het onderstuk, en helemaal onderaan een
     hand of een schoen.
    */
    const ledemaat = (x, y, bovenGeo, onderGeo, eindGeo, mBoven, mOnder, mEind, l1, l2) => {
      const boven = new THREE.Group();
      boven.position.set(x, y, 0);
      boven.add(mesh(bovenGeo, mBoven));
      const onder = new THREE.Group();
      onder.position.set(0, -l1, 0);
      onder.add(mesh(onderGeo, mOnder));
      boven.add(onder);
      const eind = new THREE.Group();
      eind.position.set(0, -l2, 0);
      eind.add(mesh(eindGeo, mEind));
      onder.add(eind);
      this.groep.add(boven);
      return { boven, onder, eind };
    };

    this.armLinks = ledemaat(-SCHOUDER_X, MAAT.schouder, DEEL.bovenarm(), DEEL.onderarm(), DEEL.hand(),
      mShirt, mShirt, mHuid, MAAT.bovenarm, MAAT.onderarm);
    this.armRechts = ledemaat(SCHOUDER_X, MAAT.schouder, DEEL.bovenarm(), DEEL.onderarm(), DEEL.hand(),
      mShirt, mShirt, mHuid, MAAT.bovenarm, MAAT.onderarm);
    this.beenLinks = ledemaat(-MAAT.heupX, MAAT.heup, DEEL.bovenbeen(), DEEL.onderbeen(), DEEL.schoen(),
      mBroek, mBroek, mSchoen, MAAT.bovenbeen, MAAT.onderbeen);
    this.beenRechts = ledemaat(MAAT.heupX, MAAT.heup, DEEL.bovenbeen(), DEEL.onderbeen(), DEEL.schoen(),
      mBroek, mBroek, mSchoen, MAAT.bovenbeen, MAAT.onderbeen);
    // oude namen: js/verhaal.js kijkt naar de schouder om te zien of hij zwaait
    this.armL = this.armLinks.boven; this.armR = this.armRechts.boven;
    this.beenL = this.beenLinks.boven; this.beenR = this.beenRechts.boven;

    /*
     Het geweer hangt aan de onderarm, niet aan de schouder: zo wijst de loop
     mee met de elleboog en steekt hij niet door de mouw heen als hij mikt.
    */
    this.wapen = null;
    if (wapen) {
      const g = new THREE.Group();
      const zwart = mat(0x1b1d21, 0.5);
      g.add(mesh(new THREE.BoxGeometry(0.05, 0.05, 0.62), zwart, 0, 0, -0.20));
      g.add(mesh(new THREE.BoxGeometry(0.06, 0.12, 0.26), mat(0x2c2118), 0, -0.02, 0.20));
      g.add(mesh(new THREE.BoxGeometry(0.05, 0.16, 0.08), zwart, 0, -0.11, -0.02));
      g.add(mesh(new THREE.BoxGeometry(0.02, 0.05, 0.05), zwart, 0, 0.045, 0.02));   // vizier
      g.position.set(0, -MAAT.onderarm - 0.03, 0);
      g.rotation.x = -Math.PI / 2;
      this.armRechts.onder.add(g);
      this.wapen = g;
      const vlam = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffd080, transparent: true, opacity: 0 }));
      vlam.position.set(0, 0, -0.52);
      g.add(vlam);
      this.vlam = vlam;
      this.vlamT = 0;
    }

    this.klok = 0;
    this.stap = 0;
    this.yaw = 0;
    this.omT = 0;      // hoe ver hij omgevallen is (0..1)
    this.grond = 0;    // hoogte van de grond onder hem (het viaduct)
    this._h = {};      // gewrichtshoeken van dit beeld
  }

  get positie() { return this.groep.position; }

  zetNeer(x, z, yaw = 0) {
    this.grond = grondHoogte(x, z);
    this.groep.position.set(x, this.grond, z);
    this.yaw = yaw;
    this.groep.rotation.y = yaw;
  }

  // Draai geleidelijk naar een richting toe (radialen, zelfde conventie als de
  // speler: yaw 0 kijkt naar -Z).
  draaiNaar(yaw, dt, snelheid = 4) {
    let d = yaw - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += d * Math.min(1, dt * snelheid);
    this.groep.rotation.y = this.yaw;
  }

  // Kijk naar een punt in de wereld.
  kijkNaar(x, z, dt, snelheid = 4) {
    const dx = x - this.groep.position.x, dz = z - this.groep.position.z;
    if (dx * dx + dz * dz < 0.01) return;
    this.draaiNaar(Math.atan2(-dx, -dz), dt, snelheid);
  }

  // Omvallen: 0 = staat rechtop, 1 = ligt. Hij kantelt naar achteren en zakt weg.
  legNeer(t) {
    this.omT = t;
    this.groep.rotation.x = -t * 1.45;
    this.groep.position.y = this.grond - t * 0.35;
  }

  vuur() {
    this.vlamT = 0.07;
    if (this.vlam) this.vlam.material.opacity = 0.95;
  }

  // loopt: benen en armen zwaaien · zwaait: rechterarm omhoog en heen en weer
  // mikt: geweer vooruit, dus beide armen naar voren
  update(dt, { loopt = false, zwaait = false, mikt = false, snelheid = 1.3 } = {}) {
    this.klok += dt;
    // hij loopt zelf rond, dus elk beeld opnieuw kijken waar de grond ligt
    this.grond = grondHoogte(this.groep.position.x, this.groep.position.z, this.groep.position.y + 0.9);
    if (this.vlamT > 0) {
      this.vlamT -= dt;
      if (this.vlamT <= 0 && this.vlam) this.vlam.material.opacity = 0;
    }
    // de pas telt door met de snelheid, net als bij de voetgangers
    if (loopt) this.stap += dt * (2.6 + snelheid * 1.9);
    const ren = Math.max(0, Math.min(1, (snelheid - 1.6) / 3.2));
    const H = loopHouding(this.stap, loopt, ren, this._h);

    if (mikt) {
      /*
       Twee handen aan het wapen, vooruit. Let op het teken: de arm hangt naar
       beneden, dus een positieve draai om x brengt hem naar voren (-z) — de kant
       waar het gezicht en de klep van de pet ook heen wijzen. Met een negatieve
       draai staken ze hun armen naar achteren en las je van de zijkant een
       kruispose.
      */
      mikHouding(H);
      this.armLinks.boven.rotation.z = 0.30;
      this.armRechts.boven.rotation.z = -0.12;
    } else if (zwaait && !loopt) {
      // arm omhoog naast het hoofd en dan wapperen
      H.schouderR = 0; H.elleboogR = 0.10;
      H.schouderL = Math.sin(this.klok * 1.1) * 0.05;
      this.armRechts.boven.rotation.z = 2.15 + Math.sin(this.klok * 7.5) * 0.30;
      this.armLinks.boven.rotation.z = 0;
    } else {
      const terug = Math.min(1, dt * 8);
      this.armRechts.boven.rotation.z += (0 - this.armRechts.boven.rotation.z) * terug;
      this.armLinks.boven.rotation.z += (0 - this.armLinks.boven.rotation.z) * terug;
    }

    this.armLinks.boven.rotation.x = H.schouderL;
    this.armRechts.boven.rotation.x = H.schouderR;
    this.armLinks.onder.rotation.x = H.elleboogL;
    this.armRechts.onder.rotation.x = H.elleboogR;
    this.beenLinks.boven.rotation.x = H.heupL;
    this.beenRechts.boven.rotation.x = H.heupR;
    this.beenLinks.onder.rotation.x = -H.knieL;
    this.beenRechts.onder.rotation.x = -H.knieR;
    this.beenLinks.eind.rotation.x = H.enkelL;
    this.beenRechts.eind.rotation.x = H.enkelR;
    if (!this.omT) this.groep.position.y = this.grond + H.wip;
  }
}
