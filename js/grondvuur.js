/*
 Vuur van beneden in missie 18 (stap 128).

 Gevraagd op 10 okt 2026: "Tijdens helicopter schieten voeg ook toe dat andere mensen op de weg van bouwman op
 jou schieten van beneden. Voeg tracers toe aan die kogels van de vijanden. Laat ze niet te hard raken."

 Langs lijn A (de rit van Bouwman van zijn loods naar de BP) staan een paar mannen van hem op de stoep. Zodra
 de heli binnen GRONDVUUR.bereik komt, mikken ze omhoog en schieten: elke kogel is een gele streep (een tracer)
 die met GRONDVUUR.tempo van de loop naar de heli vliegt, meestal er een paar meter naast. Raak is een kleine
 dobbelsteen met weinig schade. Ze gaan neer met één treffer (`raak`); hun lichaam is een doel via `doelen`.

 Er komt geen nieuw soort materiaal bij: de streep is een MeshBasicMaterial zoals de mondingsflits van de
 handlangers, en alles bestaat vanaf het opstarten (verborgen), zodat het achter het laadscherm vertaald is.

   start(lijn, hoogte)    de mannen langs de lijn neerzetten; `hoogte(x, z)` is de grond
   update(dt, heli)       heli: { x, y, z } → schade aan de speler dit beeld
   doelen(), raak(obj)    voor de kogels van de speler
   ruim()                 alles weg
*/
import * as THREE from 'three';
import { puntOp } from './inval.js';
import { Persoon } from './persoon.js';
import { geluid } from './audio.js';

export const GRONDVUUR = {
  plekken: [0.1, 0.24, 0.38, 0.52, 0.66, 0.8, 0.92],   // deel van de lijn
  opzij: 6.5,          // m van de as, om en om links en rechts
  bereik: 85,          // m (in drie dimensies) tot de heli
  om: [1.3, 2.6],      // s tussen twee schoten van één man
  kans: 0.07,          // kans dat een kogel raakt…
  schade: 2,           // …en wat dat kost
  mis: [2.5, 7],       // m naast de heli voor een kogel die mist
  tempo: 190,          // m/s, de tracer
  lang: 9,             // m, de streep
  strepen: 12,
};

const r = (a, b) => a + Math.random() * (b - a);

export function maakGrondvuur(scene) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  // dik genoeg om vanuit de heli op 40 tot 80 m nog te zien (7 cm was daar minder dan een pixel)
  const geo = new THREE.BoxGeometry(0.2, 0.2, 1);
  const strepen = [];
  for (let i = 0; i < GRONDVUUR.strepen; i++) {
    const m = new THREE.Mesh(geo, mat);
    m.visible = false; m.raycast = () => {}; m.frustumCulled = false;
    scene.add(m);
    strepen.push({ mesh: m, van: new THREE.Vector3(), dir: new THREE.Vector3(), lengte: 0, s: 0, aan: false });
  }
  /*
   Een gele ring onder elke schutter (stap 129, gevraagd: "Zorg bij laatste missie dat de personen die op je
   schieten wat beter zichtbaar zijn. bijv met geel iets onder hun."). Plat op de grond, 2,3 m breed: vanuit de
   heli op 40 tot 80 m nog een duidelijk teken. Gaat weg als hij neer is.
  */
  const ringGeo = new THREE.RingGeometry(0.8, 1.15, 28).rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd21a, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  // (één vooraf in de scène, verborgen: dan is hij achter het laadscherm vertaald)
  { const proef = new THREE.Mesh(ringGeo, ringMat); proef.visible = false; proef.position.set(0, -500, 0); scene.add(proef); }
  const mannen = [];        // { p: Persoon, vuurT, neer, omT, ring }
  let schoten = 0, raakTel = 0;
  const v = new THREE.Vector3();

  function streep(van, naar) {
    const s = strepen.find(q => !q.aan) || strepen[0];
    s.van.copy(van); s.dir.subVectors(naar, van); s.lengte = s.dir.length(); s.dir.normalize();
    s.s = 0; s.aan = true; s.mesh.visible = true;
  }

  return {
    get mannen() { return mannen; },
    get schoten() { return schoten; },
    get treffers() { return raakTel; },
    get strepen() { return strepen.filter(s => s.aan).length; },
    start(lijn, hoogte = () => 0) {
      this.ruim();
      GRONDVUUR.plekken.forEach((f, i) => {
        const kant = i % 2 ? 1 : -1;
        const q = puntOp(lijn, f * lijn.lengte, kant * GRONDVUUR.opzij);
        const p = new Persoon({ shirt: [0x2a2c30, 0x3b3328][i % 2], broek: 0x1e2024, huid: i % 2 ? 0xd9b48f : 0xc79a72,
          hoogte: 0.99 + (i % 3) * 0.02, wapen: true, pet: false, vest: null });
        if (!p.groep.parent) scene.add(p.groep);
        p.zetNeer(q.x, q.z, q.yaw);
        p.groep.position.y = hoogte(q.x, q.z);
        p.groep.visible = true;
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.y = 0.06; ring.raycast = () => {}; ring.renderOrder = 2;
        p.groep.add(ring);
        mannen.push({ p, vuurT: r(0.5, 2), neer: false, omT: 0, ring });
      });
    },
    update(dt, heli) {
      let schade = 0;
      for (const m of mannen) {
        const g = m.p.groep.position;
        if (m.neer) { if (m.omT < 1) { m.omT = Math.min(1, m.omT + dt * 1.8); m.p.legNeer(m.omT); } continue; }
        const d = heli ? Math.hypot(heli.x - g.x, heli.y - g.y, heli.z - g.z) : Infinity;
        const bij = d < GRONDVUUR.bereik;
        if (bij) m.p.kijkNaar(heli.x, heli.z, dt, 5);
        m.p.update(dt, { mikt: bij });
        if (!bij) continue;
        m.vuurT -= dt;
        if (m.vuurT > 0) continue;
        m.vuurT = r(GRONDVUUR.om[0], GRONDVUUR.om[1]);
        schoten++;
        const raakt = Math.random() < GRONDVUUR.kans;
        const van = new THREE.Vector3(g.x, g.y + 1.45, g.z);
        if (raakt) { v.set(heli.x, heli.y, heli.z); schade += GRONDVUUR.schade; raakTel++; }
        else {
          // ernaast: een willekeurige richting, een paar meter van de heli
          const a = Math.random() * Math.PI * 2, b = r(GRONDVUUR.mis[0], GRONDVUUR.mis[1]);
          v.set(heli.x + Math.cos(a) * b, heli.y + r(-2, 3), heli.z + Math.sin(a) * b);
          // een kogel die mist vliegt door, de lucht in
          v.sub(van).multiplyScalar(1.6).add(van);
        }
        streep(van, v);
        if (m.p.vuur) m.p.vuur();
        geluid.schot(d, { wapen: 'pistool', bron: 'grondvuur' });
      }
      // de strepen vliegen
      for (const s of strepen) {
        if (!s.aan) continue;
        s.s += GRONDVUUR.tempo * dt;
        const kop = Math.min(s.s, s.lengte), staart = Math.max(0, kop - GRONDVUUR.lang);
        if (staart >= s.lengte - 0.01) { s.aan = false; s.mesh.visible = false; continue; }
        const mid = (kop + staart) / 2;
        s.mesh.position.copy(s.van).addScaledVector(s.dir, mid);
        s.mesh.scale.set(1, 1, Math.max(0.2, kop - staart));
        v.copy(s.mesh.position).add(s.dir);
        s.mesh.lookAt(v);
      }
      return schade;
    },
    // een streep van buiten deze mannen: Mark en Johan uit de auto (stap 129); `update(dt, null)` laat hem vliegen
    streep: (van, naar) => streep(van, naar),
    doelen() { return mannen.filter(m => !m.neer).map(m => m.p.groep); },
    raak(obj) {
      for (let o = obj; o; o = o.parent) {
        const m = mannen.find(q => q.p.groep === o);
        if (m) { if (m.neer) return false; m.neer = true; m.ring.visible = false; return true; }
      }
      return false;
    },
    ruim() {
      for (const m of mannen) { m.p.groep.visible = false; if (m.p.groep.parent) m.p.groep.parent.remove(m.p.groep); }
      mannen.length = 0;
      for (const s of strepen) { s.aan = false; s.mesh.visible = false; }
      schoten = 0; raakTel = 0;
    },
  };
}
