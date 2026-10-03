/*
 De rondvluchtheli van Wiebe (missie 18, de avond; stap 109).

 Gevraagd op 3 okt 2026: "een helikopter waar Erik in gaat; vliegt laag in de avond over Tinga; hij
 moet Bouwman in de gaten houden; Erik bestuurt de heli niet." En daarna: "Erik zit in de deur met
 buitencamera, dus je ziet de binnenkant van de heli niet. Vlieg rustig, niet te druk."

 Het toestel is dat van de politie (js/helikopter.js, `bouwHeli`) in de kleuren van een rondvlucht:
 wit met een oranje streep, zonder zwaailichten. Links zit de deur open; Erik zit op de rand met
 zijn benen buiten. Wiebe vliegt: `volg` houdt de heli rechts naast het doel, zo dat de open deur
 er naartoe wijst, op RONDVLUCHT.hoogte boven de grond, met een veer en een begrensde snelheid en
 draaisnelheid (rustig). Het zoeklicht is een additieve kegel zonder lichtbron (het aantal lampen
 mag tijdens het spelen niet veranderen, zie stap 83), en `richtLicht` draait hem naar het doel.

 `camera(yaw, pitch)` geeft de buitencamera: een vaste plek buiten de deur, links achter en boven
 Erik, die kijkt waar de speler kijkt (begrensd tot de kant van de deur). Een kogel gaat uit de
 camera (js/player.js `shoot`), dus wat in het kruisje staat is wat je raakt.
*/
import * as THREE from 'three';
import { bouwHeli } from './helikopter.js';
import { Persoon } from './persoon.js';

export const RONDVLUCHT = {
  hoogte: 34,          // boven de grond (m): laag, maar ruim boven de daken (de hoogste toren is 26 m)
  opzij: 28,           // zo ver rechts naast het doel (m): de open deur kijkt naar links
  achter: 6,           // en een stukje erachter
  vmax: 21,            // m/s: rustig
  veer: 0.75,          // hoe snel hij naar zijn plek toe wil (1/s)
  draai: 0.55,         // rad/s: rustig bijdraaien
  helling: 0.16,       // zo ver helt hij hooguit over in een bocht (rad)
  deurHoek: 1.75,      // zo ver mag de blik van de deur af draaien (rad), naar voren en naar achteren
  pitchMin: -1.25, pitchMax: 0.15,
  landen: 2.4,         // m/s naar beneden bij het landen
  versnel: 4.5,        // m/s²: hooguit zo hard op of af, ook als het doel een bocht neemt
};

const ROMP = 0xf3f2ee, STREEP = 0xe2661b;

export function maakRondvlucht(scene) {
  const H = bouwHeli({ romp: ROMP, streep: STREEP });
  const g = H.groep;
  // geen politie: de zwaailichten uit
  H.links.visible = false; H.rechts.visible = false;
  // de open deur links (−x): een donker gat in de flank, met de rand eromheen
  const gat = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.25, 1.4), new THREE.MeshStandardMaterial({ color: 0x15181d, roughness: 0.9 }));
  gat.position.set(-1.115, -0.1, 0.25);
  g.add(gat);
  const randMat = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.6 });
  for (const [dy, dz, h, d] of [[0.66, 0.25, 0.06, 1.5], [-0.76, 0.25, 0.06, 1.5], [-0.1, -0.48, 1.36, 0.06], [-0.1, 0.98, 1.36, 0.06]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, d), randMat);
    m.position.set(-1.12, dy, dz);
    g.add(m);
  }
  // het zoeklicht: de kegel uit js/helikopter.js, zwak, en hij moet kunnen draaien
  H.bundelMat.opacity = 0.0;
  const lichtArm = new THREE.Group();
  lichtArm.position.set(0, -1.2, -0.6);
  g.add(lichtArm);
  g.remove(H.bundel);
  H.bundel.position.set(0, 0, 0);
  // de kegel wijst langs −y; in de arm wijst −y naar het doel
  const bundelLang = 60;
  H.bundel.geometry.dispose();
  H.bundel.geometry = new THREE.ConeGeometry(6.5, bundelLang, 14, 1, true);
  H.bundel.position.set(0, -bundelLang / 2, 0);
  lichtArm.add(H.bundel);

  // Erik op de rand van de deur, met zijn benen buiten
  /*
   Een poppetje zet bij elke update zijn eigen hoogte boven de grond (js/persoon.js), dus in het
   toestel zit hij in een houder: de houder staat op de plek in de heli, het poppetje op nul erin.
  */
  const houder = (x, y, z, kop) => { const h = new THREE.Group(); h.position.set(x, y, z); h.rotation.y = kop; g.add(h); return h; };
  const erik = new Persoon({ shirt: 0x2f4a6e, broek: 0x24303f, huid: 0xd9b48f, haar: 0x6b5a45, hoogte: 1.02 });
  houder(-0.95, -1.12, 0.3, -Math.PI / 2).add(erik.groep);        // met zijn gezicht naar buiten (−x)
  // en Wiebe achter de knuppel, door de ruit
  const wiebe = new Persoon({ shirt: 0x3b3f46, broek: 0x2b2f36, huid: 0xe0b48e, haar: 0x9a8a72, hoogte: 1.0 });
  houder(0.45, -1.0, -1.35, 0).add(wiebe.groep);

  g.visible = false;
  scene.add(g);

  const pos = new THREE.Vector3(), vel = new THREE.Vector3();
  let yaw = 0, bank = 0, rotorT = 0, landed = false;
  const tmp = new THREE.Vector3(), q = new THREE.Quaternion();
  const OMLAAG = new THREE.Vector3(0, -1, 0);

  function plaats() {
    g.position.copy(pos);
    g.rotation.set(0, 0, 0, 'YXZ');
    g.rotation.y = yaw;
    g.rotation.z = bank;
    g.rotation.x = -Math.min(0.12, vel.length() / RONDVLUCHT.vmax * 0.1);   // neus een tikje omlaag als hij vliegt
  }

  // een richting in de wereld uit een lokale richting van het toestel
  function wereldRichting(x, y, z) { return tmp.set(x, y, z).applyQuaternion(g.quaternion).clone(); }
  function wereldPunt(x, y, z) { g.updateMatrixWorld(true); return new THREE.Vector3(x, y, z).applyMatrix4(g.matrixWorld); }

  return {
    groep: g, erik, wiebe,
    toon(v) { g.visible = !!v; H.bundelMat.opacity = v ? H.bundelMat.opacity : 0; },
    get zichtbaar() { return g.visible; },
    get pos() { return pos; },
    get yaw() { return yaw; },
    get snelheid() { return vel.length(); },
    get geland() { return landed; },
    zet(x, y, z, kop = 0) { pos.set(x, y, z); vel.set(0, 0, 0); yaw = kop; bank = 0; landed = false; plaats(); },
    /*
     Wiebe vliegt naar zijn plek naast `doel` ({ x, z, yaw }: waar het doel is en waar het heen
     rijdt). `grond`: de hoogte van de grond daar. Rustig: een veer naar de plek, nooit harder dan
     vmax, hooguit `versnel` m/s² erbij, en bijdraaien met hooguit `draai` rad/s tot de open deur
     naar het doel kijkt.
    */
    volg(dt, doel, grond = 0) {
      landed = false;
      const fx = -Math.sin(doel.yaw), fz = -Math.cos(doel.yaw);       // vooruit van het doel
      /*
       De plek: `opzij` van het doel af, in de richting waar de heli nu al hangt. Aan de rijrichting
       van het doel (rechts ervan) zwaaide de plek in een haakse bocht in één beeld veertig meter om,
       en trok de heli met 67 m/s² bij; aan zijn eigen trage kop raakte hij in de bochten 125 m
       achter (tools/avondtest.mjs). Zo draait hij rustig mee om het doel heen.
      */
      let ux = pos.x - doel.x, uz = pos.z - doel.z;
      const du = Math.hypot(ux, uz);
      if (du > 0.5) { ux /= du; uz /= du; } else { ux = fz; uz = -fx; }   // (bovenop: naar rechts)
      const wx = doel.x + ux * RONDVLUCHT.opzij - fx * RONDVLUCHT.achter;
      const wz = doel.z + uz * RONDVLUCHT.opzij - fz * RONDVLUCHT.achter;
      const wy = grond + RONDVLUCHT.hoogte;
      // gewenste snelheid: naar de plek toe, plus de snelheid van het doel
      const dv = doel.v || 0;
      const want = new THREE.Vector3((wx - pos.x) * RONDVLUCHT.veer + fx * dv, (wy - pos.y) * RONDVLUCHT.veer, (wz - pos.z) * RONDVLUCHT.veer + fz * dv);
      if (want.length() > RONDVLUCHT.vmax) want.setLength(RONDVLUCHT.vmax);
      const oud = vel.clone();
      // rustig: de snelheid verandert hooguit `versnel` m/s per seconde
      const bij = want.sub(vel), max = RONDVLUCHT.versnel * dt;
      if (bij.length() > max) bij.setLength(max);
      vel.add(bij);
      pos.addScaledVector(vel, dt);
      // bijdraaien tot de open deur (links, −x) naar het doel kijkt
      let d = Math.atan2(doel.z - pos.z, -(doel.x - pos.x)) - yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      yaw += Math.max(-RONDVLUCHT.draai * dt, Math.min(RONDVLUCHT.draai * dt, d));
      // overhellen met de dwarsversnelling
      const ax = (vel.x - oud.x) / Math.max(dt, 1e-3), az = (vel.z - oud.z) / Math.max(dt, 1e-3);
      const zij = ax * Math.cos(yaw) - az * Math.sin(yaw);
      bank += (Math.max(-RONDVLUCHT.helling, Math.min(RONDVLUCHT.helling, -zij * 0.02)) - bank) * Math.min(1, dt * 2);
      plaats();
    },
    // vliegen naar een punt en landen; levert true als de sleden op de grond staan
    landNaar(dt, plek, grond = 0, kop = null) {
      const dx = plek.x - pos.x, dz = plek.z - pos.z, d = Math.hypot(dx, dz);
      const v = Math.min(RONDVLUCHT.vmax * 0.7, d * 0.6);
      const want = new THREE.Vector3(d > 0.01 ? dx / d * v : 0, 0, d > 0.01 ? dz / d * v : 0);
      // pas zakken als hij er bijna boven hangt
      const bodem = grond + 1.42;
      want.y = d < 12 ? -Math.min(RONDVLUCHT.landen, Math.max(0.4, (pos.y - bodem) * 0.5)) : (grond + 24 - pos.y) * 0.4;
      vel.lerp(want, Math.min(1, dt * 1.4));
      pos.addScaledVector(vel, dt);
      if (pos.y <= bodem) { pos.y = bodem; vel.set(0, 0, 0); }
      const doelYaw = kop !== null ? kop : (d > 3 ? Math.atan2(-dx, -dz) : yaw);
      let dd = doelYaw - yaw;
      while (dd > Math.PI) dd -= Math.PI * 2;
      while (dd < -Math.PI) dd += Math.PI * 2;
      yaw += Math.max(-RONDVLUCHT.draai * dt, Math.min(RONDVLUCHT.draai * dt, dd));
      bank *= 1 - Math.min(1, dt * 2);
      plaats();
      landed = pos.y <= bodem + 0.01 && d < 2;
      return landed;
    },
    // de rotoren draaien, Erik en Wiebe zitten
    update(dt, { stationair = false } = {}) {
      rotorT += dt;
      H.rotor.rotation.y += dt * (stationair ? 9 : 23);
      H.staartRotor.rotation.x += dt * 40;
      for (const p of [erik, wiebe]) {
        p.update(dt, { zit: 0.42 });
        p.groep.position.x = 0; p.groep.position.z = 0;
        p.groep.position.y = Math.min(0.2, Math.max(-0.2, p.groep.position.y));
      }
    },
    // waar Erik zit (in de wereld), en de richting uit de deur
    deur() { return wereldPunt(-1.0, -0.2, 0.3); },
    deurNormaal() { return wereldRichting(-1, 0, 0); },
    /*
     De buitencamera: buiten de deur, links achter en boven Erik. `blik` is { yaw, pitch } van de
     speler, al begrensd met `begrens`. Levert { pos, kijk } (kijk: een punt 60 m verderop).
    */
    camera(blik) {
      const D = this.deur(), n = this.deurNormaal(), achter = wereldRichting(0, 0, 1);
      const p = D.clone().addScaledVector(n, 2.4).addScaledVector(achter, 3.6).add(new THREE.Vector3(0, 1.5, 0));
      const cp = Math.cos(blik.pitch);
      const dir = new THREE.Vector3(-Math.sin(blik.yaw) * cp, Math.sin(blik.pitch), -Math.cos(blik.yaw) * cp);
      return { pos: p, kijk: p.clone().addScaledVector(dir, 60), dir };
    },
    // de blik van de speler binnen het halfrond van de deur houden
    begrens(blik) {
      const n = this.deurNormaal();
      const deurYaw = Math.atan2(-n.x, -n.z);
      let d = blik.yaw - deurYaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      d = Math.max(-RONDVLUCHT.deurHoek, Math.min(RONDVLUCHT.deurHoek, d));
      return { yaw: deurYaw + d, pitch: Math.max(RONDVLUCHT.pitchMin, Math.min(RONDVLUCHT.pitchMax, blik.pitch)) };
    },
    // het zoeklicht op een punt richten; `sterkte` 0 is uit
    richtLicht(doel, sterkte = 0.14) {
      H.bundelMat.opacity = sterkte;
      if (!doel || sterkte <= 0) return;
      g.updateMatrixWorld(true);
      const van = new THREE.Vector3().setFromMatrixPosition(lichtArm.matrixWorld);
      const naar = new THREE.Vector3(doel.x, doel.y || 0, doel.z).sub(van).normalize();
      // in de assen van het toestel
      const inv = g.quaternion.clone().invert();
      naar.applyQuaternion(inv);
      q.setFromUnitVectors(OMLAAG, naar);
      lichtArm.quaternion.copy(q);
    },
  };
}
