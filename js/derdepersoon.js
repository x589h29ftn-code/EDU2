/*
 De camera over je schouder (V).

 In de eerste persoon zie je alleen je pistool; met de auto is dat lastig sturen,
 want je ziet de neus niet en je weet niet waar je achterwielen staan. Deze
 module zet de camera achter je: te voet een paar meter, in de auto verder weg
 en wat hoger, zodat je de hele auto en het stuk weg eromheen ziet.

 Twee dingen die het bruikbaar maken:

   - De camera zakt nooit door een gebouw. De hengel wordt elk beeld ingekort
     tot de eerste botsingsdoos die hoger is dan de camera zelf (`vrijeCamera`
     in js/world.js), en de ingekorte lengte loopt soepel terug naar de volle
     lengte zodra het weer vrij is.
   - Te voet krijg je een poppetje om naar te kijken: dezelfde `Persoon` als de
     mensen uit het verhaal, met hetzelfde looppasje. In de auto is hij onzichtbaar.

 Het richten blijft kloppen: de kogel komt niet uit de camera maar uit de
 schouder van het poppetje, in de richting van het kruisje. Zie `mikpunt`.
*/
import * as THREE from 'three';
import { Persoon } from './persoon.js';
import { vrijeCamera } from './world.js';

// te voet: dicht op de rug. In een auto hangt de hengel aan de lengte van het
// voertuig, zodat je bij een bakwagen van zeven meter niet in de laadbak kijkt.
// `min` is de kortste hengel: korter mag niet, want dan zit de camera in je
// eigen auto. Botst hij toch, dan klimt hij omhoog in plaats van naar binnen.
const TE_VOET = { afstand: 3.6, hoog: 1.45, zij: 0.55, min: 1.1 };

export function initDerdePersoon({ scene, camera, player }) {
  // Erik zelf: hetzelfde poppetje als de mensen in het verhaal.
  const pop = new Persoon({ shirt: 0x2f4a6e, broek: 0x24303f, huid: 0xd9b48f, haar: 0x6b5a45, hoogte: 1.02 });
  pop.groep.visible = false;
  scene.add(pop.groep);

  let aan = false;
  let afstand = 0;              // huidige, ingekorte hengellengte
  let hoogte = 0;               // extra hoogte als de hengel ingekort is
  let vorigeX = null, vorigeZ = null;

  function instelling(car) {
    if (!car) return TE_VOET;
    const L = (car.mesh && car.mesh.userData.length) || 4.3;
    return { afstand: L * 0.78 + 3.3, hoog: car.soort === 'truck' ? 3.3 : 1.9, zij: 0, min: L / 2 + 1.7 };
  }

  /*
   De camera neerzetten. Levert true als hij hem overgenomen heeft, zodat
   js/main.js de gewone camerastand kan overslaan.
  */
  function update(dt, car = null) {
    const zichtbaar = aan && !car;
    if (pop.groep.visible !== zichtbaar) pop.groep.visible = zichtbaar;

    if (zichtbaar) {
      // het poppetje loopt mee met de speler
      const p = player.pos;
      const verplaatst = vorigeX === null ? 0 : Math.hypot(p.x - vorigeX, p.z - vorigeZ);
      vorigeX = p.x; vorigeZ = p.z;
      const snelheid = dt > 0 ? verplaatst / dt : 0;
      pop.groep.position.set(p.x, p.y, p.z);
      pop.yaw = player.yaw;
      pop.groep.rotation.y = player.yaw;
      pop.update(dt, { loopt: snelheid > 0.3, snelheid: Math.max(1, snelheid) });
    } else { vorigeX = null; vorigeZ = null; }

    if (!aan) { afstand = 0; hoogte = 0; return false; }

    // In de auto hangt de camera achter je. Kijk je zelf niet rond, dan draait
    // hij langzaam terug tot recht achter de auto, zodat je bij het sturen
    // vanzelf weer vooruit kijkt.
    player.kijkT = Math.max(0, (player.kijkT || 0) - dt);
    if (car && !player.kijkT && Math.abs(car.speed) > 1.5) {
      let d = car.yaw - player.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      player.yaw += d * Math.min(1, dt * 1.6);
      player.pitch += (-0.10 - player.pitch) * Math.min(1, dt * 1.6);
    }

    const inst = instelling(car);
    // draaipunt: het hoofd van de speler, of het midden van de auto
    const px = car ? car.x : player.pos.x;
    const pz = car ? car.z : player.pos.z;
    const py = (car ? 0 : player.pos.y) + inst.hoog;

    const yaw = player.yaw, pitch = player.pitch;
    const cp = Math.cos(pitch);
    // kijkrichting; de camera staat er precies achter, dus het draaipunt blijft
    // midden in beeld
    const dx = -Math.sin(yaw) * cp, dy = Math.sin(pitch), dz = -Math.cos(yaw) * cp;
    // een stukje opzij, zodat je poppetje niet precies het kruisje afdekt
    const zx = -Math.cos(yaw) * inst.zij, zz = Math.sin(yaw) * inst.zij;

    const vrij = vrijeCamera(px + zx, py, pz + zz, -dx, -dy, -dz, inst.afstand);
    // Staat er iets vlak achter je, dan kort de hengel in — maar nooit korter
    // dan `min`, want dan zit de camera in je eigen auto. Wat er aan lengte
    // tekortkomt gaat naar hoogte: de camera klimt over de heg of het schuurtje
    // heen in plaats van erdoorheen.
    const wens = Math.max(inst.min, vrij);
    const klim = Math.max(0, inst.min - vrij) * 0.8;
    // inkorten mag meteen, uitschuiven gaat rustig
    afstand = wens < afstand ? wens : afstand + (wens - afstand) * Math.min(1, dt * 4);
    if (afstand > inst.afstand) afstand = inst.afstand;
    hoogte += (klim - hoogte) * Math.min(1, dt * 5);

    camera.position.set(px + zx - dx * afstand, Math.max(0.4, py + hoogte - dy * afstand), pz + zz - dz * afstand);
    camera.rotation.set(0, 0, 0, 'YXZ');
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
    player.gun.visible = false;
    return true;
  }

  /*
   Waar komt de kogel vandaan? In de derde persoon staat de camera achter je,
   dus schieten vanaf de camera zou langs je poppetje heen gaan. De kogel start
   bij zijn schouder en gaat naar het punt waar het kruisje op staat.
  */
  function mikpunt(origin, dir) {
    if (!aan || player.inCar) return { origin, dir };
    const doel = origin.clone().addScaledVector(dir, 80);
    const uit = new THREE.Vector3(player.pos.x, player.pos.y + 1.45, player.pos.z);
    return { origin: uit, dir: doel.sub(uit).normalize() };
  }

  return {
    get aan() { return aan; },
    set aan(v) { aan = !!v; if (!aan) pop.groep.visible = false; },
    wissel() { aan = !aan; if (!aan) pop.groep.visible = false; return aan; },
    update, mikpunt,
    // recht achter de auto gaan hangen (bij het instappen en bij het wisselen)
    achterAuto(car) { if (!car) return; player.yaw = car.yaw; player.pitch = -0.10; player.kijkT = 0; },
    get pop() { return pop; },
    get afstand() { return afstand; },
  };
}
