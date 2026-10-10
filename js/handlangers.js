/*
 De handlangers van Bouwman in de achtervolging van missie 18 (stap 127).

 Gevraagd op 9 okt 2026: "Je kan ook nog wat handlangers toevoegen die je onder vuur nemen vanuit auto's of
 scooters. Bijv 2 auto's eerst en later op de weg nog eens."

 Ze rijden over dezelfde lijn als Bouwman (lijn B, van de BP terug naar zijn loods), een eindje achter hem:
 tussen hem en jou in. Wie binnen HANDLANGERS.bereik van je is en je kan zien, schiet: de auto's in korte
 salvo's uit het raam, de scooters met een pistool. Raak is een dobbelsteen die kleiner wordt met de afstand en
 met hoe hard je rijdt. Ze gaan neer zoals elke auto (car.hp, de kogels van js/player.js raken het model), een
 scooter al na een paar treffers; daarna rollen ze uit en schieten niet meer.

   start(lijn)            twee auto's achter Bouwman, op het begin van de lijn
   update(dt, ctx)        { bouwman: { s, v }, speler: { x, z, v }, zicht(x, z) } → schade aan de speler
   stop()                 iedereen remt en houdt op met schieten (bij de loods)
   ruim()                 alles weg (laden, opnieuw, een andere missie)
*/
import * as THREE from 'three';
import { profiel, puntOp } from './inval.js';
import { Persoon } from './persoon.js';
import { geluid } from './audio.js';

export const HANDLANGERS = {
  autos: 2,            // aan het begin
  scooters: 2,         // later op de weg
  scooterNa: 0.42,     // zo ver over de lijn (deel van de lengte) komen de scooters erbij…
  scooterUitZicht: 60, // …als je minstens zo ver van hun plek bent (ze komen een zijstraat uit)
  achter: [16, 30],    // m achter Bouwman: de auto's
  achterScooter: [9, 22],
  top: 33,             // m/s (119 km/u)
  dwars: 9,            // m/s² door de bocht
  optrek: 7, remmen: 9,
  bereik: 60,          // m: binnen zo ver schieten ze
  kans: 0.30,          // kans op raak vlakbij, stilstaand…
  kansVer: 0.005,      // …min zoveel per meter…
  kansHard: 0.006,     // …en zoveel per m/s dat je zelf rijdt (minimaal 6 %)
  schade: 4,           // per treffer
  salvo: 3,            // de auto's: zoveel kogels…
  salvoTempo: 0.13,    // …zo snel achter elkaar…
  rust: [1.1, 1.9],    // …dan zo lang stil
  hpAuto: 100, hpScooter: 30,
};

const r = (a, b) => a + Math.random() * (b - a);

// een scooter met een man erop (de vormen van de pizzascooter in js/leven.js, in het zwart)
function maakScooter() {
  const g = new THREE.Group(); g.name = 'handlangerScooter';
  const romp = new THREE.MeshStandardMaterial({ color: 0x1d1f24, roughness: 0.35, metalness: 0.2 });
  const zwart = new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.7 });
  const wiel = new THREE.TorusGeometry(0.2, 0.06, 6, 14);
  for (const z of [-0.62, 0.55]) { const w = new THREE.Mesh(wiel, zwart); w.rotation.y = Math.PI / 2; w.position.set(0, 0.26, z); g.add(w); }
  for (const [w, h, d, x, y, z, rx] of [[0.34, 0.1, 0.8, 0, 0.32, 0.02, 0], [0.4, 0.34, 0.6, 0, 0.55, 0.42, 0], [0.36, 0.7, 0.12, 0, 0.62, -0.5, -0.25]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), romp); m.position.set(x, y, z); m.rotation.x = rx; g.add(m);
  }
  const zadel = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.5), zwart); zadel.position.set(0, 0.76, 0.38); g.add(zadel);
  const rijder = new Persoon({ shirt: 0x15171b, broek: 0x202228, huid: 0xc99a74, haar: 0x1b1b1b, hoogte: 0.98 });
  const zit = new THREE.Group(); zit.position.set(0, 0.36, 0.3); g.add(zit); zit.add(rijder.groep);
  return { mesh: g, rijder };
}

export function maakHandlangers(scene, vehicles) {
  const flitsMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  const flitsGeo = new THREE.SphereGeometry(0.16, 8, 6);
  let lijn = null, prof = null, scootersErbij = false;
  const mannen = [];        // { auto, s, v, u, gat, soort, vuurT, salvo, flits, flitsT, rijder, dood }
  let schoten = 0, raak = 0;

  function plaats(m, dt) {
    const p = puntOp(lijn, m.s, m.u);
    const vorige = m.auto.yaw;
    m.auto.x = p.x; m.auto.z = p.z; m.auto.yaw = p.yaw; m.auto.speed = m.v;
    vehicles.zetNeer(m.auto, dt, vorige);
  }
  function erbij(soort, s, u, gat) {
    let auto, rijder = null;
    if (soort === 'scooter') {
      const sc = maakScooter();
      auto = vehicles.voegToe({ x: 0, z: 0, soort: 'scooter', mesh: sc.mesh, driveable: false });
      rijder = sc.rijder;
      auto.hp = HANDLANGERS.hpScooter; auto.botsRadius = 0.5; auto.breedte = 0.6;
    } else {
      auto = vehicles.voegToe({ x: 0, z: 0, soort: 'hatch', kleur: [0x1c1d22, 0x3a3d44][mannen.length % 2], driveable: false });
      auto.hp = HANDLANGERS.hpAuto;
    }
    auto.handlanger = true;
    const flits = new THREE.Mesh(flitsGeo, flitsMat);
    flits.visible = false;
    auto.mesh.add(flits);
    // het raam aan de kant van de bestuurder (links), op schouderhoogte
    flits.position.set(soort === 'scooter' ? -0.45 : -1.0, soort === 'scooter' ? 1.35 : 1.15, -0.2);
    const m = { auto, s: Math.max(0, s), v: 0, u, gat, soort, vuurT: r(1.5, 3), salvo: 0, flits, flitsT: 0, rijder, dood: false };
    mannen.push(m);
    plaats(m, 0);
    return m;
  }

  return {
    get mannen() { return mannen; },
    get schoten() { return schoten; },
    get raak() { return raak; },
    get scootersErbij() { return scootersErbij; },
    start(L, sBouwman = 0) {
      this.ruim();
      lijn = L;
      prof = profiel(L, { top: HANDLANGERS.top, dwars: HANDLANGERS.dwars, remmen: HANDLANGERS.remmen });
      for (let i = 0; i < HANDLANGERS.autos; i++) {
        const gat = HANDLANGERS.achter[i % 2];
        erbij('auto', sBouwman - gat, i % 2 ? 1.1 : -1.1, gat);
      }
    },
    update(dt, { bouwman, speler, zicht = () => true }) {
      if (!lijn) return 0;
      let schade = 0;
      // de scooters: een eind over de lijn, als je hun plek niet ziet
      if (!scootersErbij && bouwman.s > lijn.lengte * HANDLANGERS.scooterNa) {
        const s0 = bouwman.s - HANDLANGERS.achterScooter[1];
        const p = puntOp(lijn, Math.max(0, s0));
        if (Math.hypot(p.x - speler.x, p.z - speler.z) > HANDLANGERS.scooterUitZicht) {
          scootersErbij = true;
          for (let i = 0; i < HANDLANGERS.scooters; i++) {
            const gat = HANDLANGERS.achterScooter[i % 2];
            const m = erbij('scooter', bouwman.s - gat, i % 2 ? 1.4 : -1.4, gat);
            m.v = Math.max(8, bouwman.v);
          }
        }
      }
      for (const m of mannen) {
        const a = m.auto;
        if (!m.dood && (a.hp <= 0 || a.wrak)) { m.dood = true; m.flits.visible = false; if (m.rijder) m.rijder.legNeer && m.rijder.legNeer(0); }
        // rijden: een plek `gat` achter Bouwman; na het neergaan uitrollen
        const i = Math.min(lijn.n - 1, Math.max(0, Math.round(m.s / 2)));
        const bocht = prof[Math.min(lijn.n - 1, i + 1)];
        const wil = m.dood || m.stop ? 0 : Math.min(bocht, Math.max(4, bouwman.v + (bouwman.s - m.gat - m.s) * 0.7));
        if (m.v < wil) m.v = Math.min(wil, m.v + HANDLANGERS.optrek * dt);
        else m.v = Math.max(wil, m.v - HANDLANGERS.remmen * (m.dood ? 0.6 : 1) * dt);
        m.s = Math.min(lijn.lengte - 4, m.s + m.v * dt);
        if (!a.wrak) plaats(m, dt);
        if (m.rijder) { m.rijder.update(dt, { zit: 0.36 }); m.rijder.groep.position.set(0, 0, 0); }
        // schieten
        if (m.flitsT > 0) { m.flitsT -= dt; if (m.flitsT <= 0) m.flits.visible = false; }
        if (m.dood || m.stop) continue;
        m.vuurT -= dt;
        if (m.vuurT > 0) continue;
        const d = Math.hypot(a.x - speler.x, a.z - speler.z);
        if (d > HANDLANGERS.bereik || !zicht(a.x, a.z)) { m.vuurT = 0.4; continue; }
        if (m.soort === 'auto') {
          m.salvo++;
          if (m.salvo >= HANDLANGERS.salvo) { m.salvo = 0; m.vuurT = r(HANDLANGERS.rust[0], HANDLANGERS.rust[1]); }
          else m.vuurT = HANDLANGERS.salvoTempo;
        } else m.vuurT = r(HANDLANGERS.rust[0] * 0.8, HANDLANGERS.rust[1]);
        schoten++;
        m.flits.visible = true; m.flitsT = 0.06;
        geluid.schot(d, { wapen: m.soort === 'auto' ? 'mitrailleur' : 'pistool', bron: 'handlanger' + mannen.indexOf(m) });
        const kans = Math.max(0.06, HANDLANGERS.kans - d * HANDLANGERS.kansVer - Math.abs(speler.v || 0) * HANDLANGERS.kansHard);
        if (Math.random() < kans) { schade += HANDLANGERS.schade; raak++; }
      }
      return schade;
    },
    // bij de loods: iedereen remt, niemand schiet meer
    stop() { for (const m of mannen) { m.stop = true; m.flits.visible = false; } },
    ruim() {
      for (const m of mannen) {
        if (m.flits.parent) m.flits.parent.remove(m.flits);
        if (!vehicles.verwijder(m.auto) && m.auto.mesh) m.auto.mesh.visible = false;
      }
      mannen.length = 0; lijn = null; prof = null; scootersErbij = false; schoten = 0; raak = 0;
    },
  };
}
