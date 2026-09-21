/*
 De deal bij de molen (missie 8).

 Twee dingen die de rest van het spel niet heeft:

 1. **Een plek op het water.** Je moet met de sloep op afstand blijven dobberen,
    en "ergens bij de molen" is op open water geen aanwijzing. Er ligt daarom
    een gele ring op het wateroppervlak waar de boot in moet liggen: een platte
    ring die meedeint, met een streepjesrand zodat hij ook van dichtbij te zien
    is. Een vlag op de kaart wijst de plek aan, de ring zegt wanneer je er bent.

 2. **Een scène die je door de kijker bekijkt.** Op de kade staan zeven mensen:
    De Veteraan met zijn hondje, de maffiabaas en vier compagnons. Eerst praten
    ze, dan trekken ze hun wapens en schieten op De Veteraan, die achteruit
    deinst. Ze blijven staan waar ze staan — jij kijkt van vijftig meter mee
    door een scope, en iemand die dekking zoekt is dan niet meer te vinden.

 Alles wordt hier getekend: de ring is een geometrie, de baard van De Veteraan
 een blokje, het hondje dezelfde vorm als de hondjes in de wijk (js/npc.js).
*/
import * as THREE from 'three';
import { Persoon } from './persoon.js';
import { hondGeo } from './npc.js';
import { geluid } from './audio.js';

// ---------- de gele ring op het water ----------
const RING_HOOG = 0.12;        // net boven de waterlijn

/*
 Een ring op het water. `straal` is de binnenmaat: daarbinnen ligt je boot
 goed. Hij deint mee met een golfslag van een halve slag per seconde, want een
 ring die muurvast op het water ligt leest als een tekening op het scherm en
 niet als iets dat er drijft.
*/
export function maakWaterRing(scene, straal = 14, kleur = 0xffd400) {
  const groep = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: kleur, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide,
  });
  const band = new THREE.Mesh(new THREE.RingGeometry(straal - 0.9, straal, 48), mat);
  band.rotation.x = -Math.PI / 2;
  groep.add(band);
  // streepjes langs de rand: die geven de ring diepte als je er vlak boven zit
  const paalMat = new THREE.MeshBasicMaterial({ color: kleur, transparent: true, opacity: 0.75, depthWrite: false });
  for (let i = 0; i < 16; i++) {
    const hoek = (i / 16) * Math.PI * 2;
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), paalMat);
    p.position.set(Math.cos(hoek) * straal, 0.35, Math.sin(hoek) * straal);
    groep.add(p);
  }
  groep.visible = false;
  scene.add(groep);
  let t = 0;
  return {
    groep, straal,
    zet(x, z) { groep.position.set(x, RING_HOOG, z); },
    toon(v) { groep.visible = !!v; },
    get zichtbaar() { return groep.visible; },
    // ligt de boot (of de speler) erin?
    erin(x, z) {
      return Math.hypot(x - groep.position.x, z - groep.position.z) < straal;
    },
    update(dt) {
      if (!groep.visible) return;
      t += dt;
      groep.position.y = RING_HOOG + Math.sin(t * 1.6) * 0.06;
      mat.opacity = 0.45 + Math.abs(Math.sin(t * 1.1)) * 0.2;
    },
    verwijder() { scene.remove(groep); },
  };
}

// ---------- de mensen op de kade ----------
const BAAS = { shirt: 0x2b2b33, broek: 0x1c1c22, huid: 0xc79a72, haar: 0x171717 };
const COMPAGNON = [
  { shirt: 0x3a3f4a, broek: 0x24262c },
  { shirt: 0x4a3a33, broek: 0x2a2520 },
  { shirt: 0x2f3a46, broek: 0x20262e },
  { shirt: 0x413a4a, broek: 0x262231 },
];
// De Veteraan: olijfgroen uniform, pet, en een baard
const VETERAAN = { shirt: 0x4a5236, broek: 0x3c4230, huid: 0xd9b48f, pet: true, petKleur: 0x3c4230 };

const VUURTIJD = [0.5, 1.3];   // hoe vaak een schutter vuurt
const DEINS = 4.5;             // hoeveel meter De Veteraan achteruit gaat

/*
 De ontmoeting. `plek` is het punt op de kade, `naarWater` de richting waarin
 het water ligt (dan staan ze met hun gezicht die kant op, zodat jij ze door de
 kijker van voren ziet en niet zeven ruggen).
*/
export function maakDeal(scene, plek, naarWater) {
  const vx = naarWater.x, vz = naarWater.z;          // eenheidsvector naar het water
  const zx = -vz, zz = vx;                           // dwars erop, langs de kade
  const hoekNaarWater = Math.atan2(-vx, -vz);

  const mensen = [];
  const zet = (p, x, z, yaw) => { p.zetNeer(x, z, yaw); scene.add(p.groep); };

  // De Veteraan staat links, met zijn gezicht naar de baas
  const veteraan = new Persoon({ ...VETERAAN, hoogte: 1.03 });
  /*
   Een baard: een blok aan het hoofd, onder de neus. Persoon kent er geen, en
   voor één man een gezichtshaar-instelling toevoegen is overdreven — dit is
   hetzelfde blokwerk als de rest van het poppetje.
  */
  const baard = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.1, 0.055),
    new THREE.MeshStandardMaterial({ color: 0x5a5148, roughness: 0.95 }));
  baard.position.set(0, -0.035, -0.10);
  veteraan.hoofd.add(baard);
  const vetX = plek.x + zx * -3.2, vetZ = plek.z + zz * -3.2;
  zet(veteraan, vetX, vetZ, Math.atan2(-zx, -zz));

  /*
   Het hondje: dezelfde vorm als de hondjes aan de lijn in de wijk, maar dan
   wat breder en zwaarder — een dik hondje, zoals gevraagd. Het staat naast zijn
   baas en draait mee als die achteruit deinst.
  */
  const hond = new THREE.Mesh(hondGeo(), new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.95 }));
  hond.scale.set(1.5, 1.15, 1.25);
  hond.castShadow = true;
  scene.add(hond);

  // de baas tegenover hem, en vier compagnons in een boog daarachter
  const baas = new Persoon({ ...BAAS, hoogte: 1.02 });
  const baasX = plek.x + zx * 0.6, baasZ = plek.z + zz * 0.6;
  zet(baas, baasX, baasZ, Math.atan2(-(vetX - baasX), -(vetZ - baasZ)));
  mensen.push({ persoon: baas, neer: false, vuurT: VUURTIJD[0], x: baasX, z: baasZ });

  for (let i = 0; i < COMPAGNON.length; i++) {
    const langs = 2.6 + i * 1.9;
    const uit = (i % 2 ? 1.6 : -1.1);
    const p = new Persoon({ ...COMPAGNON[i], huid: i % 2 ? 0xd9b48f : 0xc79a72, hoogte: 0.99 + (i % 3) * 0.02 });
    const px = plek.x + zx * langs - vx * uit;
    const pz = plek.z + zz * langs - vz * uit;
    zet(p, px, pz, Math.atan2(-(vetX - px), -(vetZ - pz)));
    mensen.push({ persoon: p, neer: false, vuurT: VUURTIJD[0] + i * 0.3, x: px, z: pz });
  }

  let schiet = false;          // zijn de wapens getrokken?
  let t = 0;
  let deins = 0;               // hoe ver De Veteraan al achteruit is

  function hondBij() {
    const p = veteraan.groep.position;
    hond.position.set(p.x + zx * 0.9, p.y, p.z + zz * 0.9);
    hond.rotation.y = veteraan.yaw;
  }
  hondBij();

  return {
    veteraan, hond,
    get mensen() { return mensen; },
    get schiet() { return schiet; },
    get neer() { return mensen.filter(m => m.neer).length; },
    get aantal() { return mensen.length; },
    get allemaalNeer() { return mensen.every(m => m.neer); },
    // het midden van het gezelschap: daar wijst de kaart naartoe
    get midden() { return { x: plek.x, z: plek.z }; },

    /*
     De wapens komen tevoorschijn en ze openen het vuur op De Veteraan. Pas
     vanaf dit moment kan de speler zelf ook schieten (js/verhaal.js).
    */
    begin() {
      if (schiet) return;
      schiet = true;
      for (const m of mensen) m.persoon.geefWapen('pistool');
    },

    doelen() { return mensen.filter(m => !m.neer).map(m => m.persoon.groep); },

    raak(obj) {
      for (const m of mensen) {
        if (m.neer) continue;
        let hit = false;
        m.persoon.groep.traverse(o => { if (o === obj) hit = true; });
        if (!hit) continue;
        m.neer = true;
        m.persoon.legNeer(1);
        return true;
      }
      return false;
    },

    update(dt, camPlek = null) {
      t += dt;
      for (const m of mensen) {
        if (m.neer) { m.persoon.update(dt, { loopt: false }); continue; }
        if (!schiet) {
          // praten: ze staan naar elkaar toe en bewegen niet
          m.persoon.update(dt, { loopt: false });
          continue;
        }
        m.persoon.kijkNaar(veteraan.groep.position.x, veteraan.groep.position.z, dt, 5);
        m.persoon.update(dt, { loopt: false, mikt: true });
        m.vuurT -= dt;
        if (m.vuurT <= 0) {
          m.vuurT = VUURTIJD[0] + Math.random() * (VUURTIJD[1] - VUURTIJD[0]);
          m.persoon.vuur();
          // op afstand hoor je het schot zacht; camPlek is waar de speler zit
          const d = camPlek ? Math.hypot(camPlek.x - m.x, camPlek.z - m.z) : 60;
          geluid.schot(d);
        }
      }
      if (schiet && deins < DEINS) {
        // De Veteraan deinst achteruit, van de baas vandaan
        const stap = Math.min(DEINS - deins, dt * 1.6);
        deins += stap;
        const p = veteraan.groep.position;
        veteraan.zetNeer(p.x + zx * -stap, p.z + zz * -stap, veteraan.yaw);
        veteraan.update(dt, { loopt: true, snelheid: 1.0 });
      } else {
        veteraan.update(dt, { loopt: false });
      }
      veteraan.kijkNaar(baas.groep.position.x, baas.groep.position.z, dt, 3);
      hondBij();
    },

    verwijder() {
      for (const m of mensen) scene.remove(m.persoon.groep);
      scene.remove(veteraan.groep);
      scene.remove(hond);
      hond.geometry.dispose();
    },

    // waar de scène staat te kijken, voor de proef
    get kijkrichting() { return hoekNaarWater; },
  };
}
