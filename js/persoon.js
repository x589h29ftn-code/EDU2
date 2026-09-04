// Eén los poppetje, in de maatvoering van de voetgangers uit npc.js maar met
// een eigen skelet: armen en benen hangen aan draaipunten, zodat hij kan lopen,
// zwaaien en je aankijken. De voetgangers in npc.js zijn instanced meshes en
// kunnen dat niet; voor de mensen die in het verhaal meespelen is dat wel nodig.
import * as THREE from 'three';

// maten van een volwassene van ongeveer 1,75 m (zie PARTS in npc.js)
const ROMP = { b: 0.40, h: 0.60, d: 0.23, y: 1.16 };
const HEUP = 0.88, SCHOUDER = 1.44;

function mat(hex, ruw = 0.92) {
  return new THREE.MeshStandardMaterial({ color: hex, roughness: ruw });
}

export class Persoon {
  // kleding en postuur; hoogte 1.0 is een volwassene van 1,75 m
  // wapen: true geeft hem een geweer in de handen (de bewaking op de RWZI)
  constructor({ shirt = 0x2a6b3a, broek = 0x24303f, huid = 0xd9b48f, haar = 0x2a1d12, hoogte = 1.0, wapen = false, pet = false } = {}) {
    const mShirt = mat(shirt), mBroek = mat(broek), mHuid = mat(huid, 0.85), mHaar = mat(haar);
    this.groep = new THREE.Group();
    this.groep.scale.setScalar(hoogte);

    const doos = (b, h, d, m, x, y, z) => {
      const o = new THREE.Mesh(new THREE.BoxGeometry(b, h, d), m);
      o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true;
      return o;
    };

    this.groep.add(doos(ROMP.b, ROMP.h, ROMP.d, mShirt, 0, ROMP.y, 0));
    const nek = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.075, 0.10, 8), mHuid);
    nek.position.y = 1.50; nek.castShadow = true;
    const hoofd = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), mHuid);
    hoofd.position.y = 1.575; hoofd.castShadow = true;
    const kuif = new THREE.Mesh(
      new THREE.SphereGeometry(0.122, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), mHaar);
    kuif.position.y = 1.59; kuif.castShadow = true;
    this.groep.add(nek, hoofd, kuif);

    // ledematen aan een draaipunt: de doos hangt onder de oorsprong van de groep
    const lid = (x, y, b, h, d, m, hand) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, 0);
      const arm = doos(b, h, d, m, 0, -h / 2, 0);
      pivot.add(arm);
      if (hand) {
        const bol = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), mHuid);
        bol.position.y = -h - 0.03; bol.castShadow = true;
        pivot.add(bol);
      }
      this.groep.add(pivot);
      return pivot;
    };
    this.beenL = lid(-0.115, HEUP, 0.135, 0.84, 0.19, mBroek, false);
    this.beenR = lid(0.115, HEUP, 0.135, 0.84, 0.19, mBroek, false);
    this.armL = lid(-0.26, SCHOUDER, 0.10, 0.52, 0.10, mShirt, true);
    this.armR = lid(0.26, SCHOUDER, 0.10, 0.52, 0.10, mShirt, true);
    // schoenen
    for (const [been, x] of [[this.beenL, -0.115], [this.beenR, 0.115]]) {
      const schoen = doos(0.145, 0.075, 0.26, mat(0x2b2b2b), 0, -0.87, -0.04);
      been.add(schoen);
    }

    // pet in plaats van haar (bewaking)
    if (pet) {
      kuif.visible = false;
      const rand = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.035, 12), mat(0x1d2634));
      rand.position.y = 1.665;
      const bol = new THREE.Mesh(new THREE.SphereGeometry(0.125, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(0x1d2634));
      bol.position.y = 1.66;
      const klep = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.02, 0.11), mat(0x1d2634));
      klep.position.set(0, 1.655, -0.16);
      for (const o of [rand, bol, klep]) o.castShadow = true;
      this.groep.add(rand, bol, klep);
    }

    // geweer: hangt aan de rechterarm, dus hij draait mee met de schouder
    this.wapen = null;
    if (wapen) {
      const g = new THREE.Group();
      const zwart = mat(0x1b1d21, 0.5);
      const loop = doos(0.05, 0.05, 0.62, zwart, 0, 0, -0.2);
      const kolf = doos(0.06, 0.12, 0.26, mat(0x2c2118), 0, -0.02, 0.2);
      const magazijn = doos(0.05, 0.16, 0.08, zwart, 0, -0.11, -0.02);
      g.add(loop, kolf, magazijn);
      g.position.set(0, -0.5, -0.14);          // in de hand, onder de schouder
      g.rotation.x = Math.PI / 2;
      this.armR.add(g);
      this.wapen = g;
      // vuurmond: bolletje dat kort oplicht als hij schiet
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
  }

  get positie() { return this.groep.position; }

  zetNeer(x, z, yaw = 0) {
    this.groep.position.set(x, 0, z);
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
    this.groep.position.y = -t * 0.35;
  }

  vuur() {
    this.vlamT = 0.07;
    if (this.vlam) this.vlam.material.opacity = 0.95;
  }

  // loopt: benen en armen zwaaien · zwaait: rechterarm omhoog en heen en weer
  // mikt: geweer vooruit, dus de rechterarm horizontaal
  update(dt, { loopt = false, zwaait = false, mikt = false, snelheid = 1.3 } = {}) {
    this.klok += dt;
    if (this.vlamT > 0) {
      this.vlamT -= dt;
      if (this.vlamT <= 0 && this.vlam) this.vlam.material.opacity = 0;
    }
    if (loopt) this.stap += dt * snelheid * 4.2;
    const zwaai = loopt ? Math.sin(this.stap) * 0.55 : 0;
    this.beenL.rotation.x = zwaai;
    this.beenR.rotation.x = -zwaai;
    if (mikt) {
      // geweer vooruit in twee handen
      this.armR.rotation.x = -1.5; this.armR.rotation.z = 0;
      this.armL.rotation.x = -1.35; this.armL.rotation.z = -0.35;
      this.groep.position.y = loopt ? Math.abs(Math.sin(this.stap)) * 0.03 : 0;
      return;
    }
    if (zwaait && !loopt) {
      // arm omhoog naast het hoofd en dan wapperen
      this.armR.rotation.z = 2.15 + Math.sin(this.klok * 7.5) * 0.30;
      this.armR.rotation.x = 0;
      this.armL.rotation.z = 0;
      this.armL.rotation.x = Math.sin(this.klok * 1.1) * 0.05;
    } else {
      this.armR.rotation.z += (0 - this.armR.rotation.z) * Math.min(1, dt * 8);
      this.armR.rotation.x = zwaai * 0.75;
      this.armL.rotation.x = -zwaai * 0.75;
      this.armL.rotation.z = 0;
    }
    // wie loopt, wiegt een beetje op en neer
    this.groep.position.y = loopt ? Math.abs(Math.sin(this.stap)) * 0.035 : 0;
  }
}
