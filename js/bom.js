/*
 De bom uit missie 7 (de Poiesz in Duinterpen), en wat er daarna van het pand
 over is.

 Twee dingen die de rest van het spel niet heeft:

 1. **Een plek die oplicht.** De winkel is een hal van veertig bij dertig meter
    met zeventien schappen; "plant hem bij de schappen" is daarbinnen geen
    aanwijzing. Er staat dus een markering op de plek zelf: een gele ruit die
    op en neer dobbert boven een lichtvlek op de vloer, zoals een oppakpunt in
    een spel hoort te zijn. Een icoontje op de kaart kan hier niet — het
    interieur staat ruim buiten het kaartgebied (js/supermarkt.js).
 2. **Een ontploffing die geen auto is.** De vuurbal van js/vehicles.js hangt
    aan een voertuig. Deze staat los: een oplichtende bol die openklapt, een
    ring van vonken en een rookpluim die opstijgt en uitwaaiert. Alles wordt
    hier getekend, niets komt uit een bestand — zoals overal in dit spel.

 De maten zijn niet willekeurig: de pluim gaat tot twaalf meter en waaiert tot
 acht meter uit, zodat hij van de overkant van het parkeerterrein (waar Mark
 staat) nog boven de gevel uitkomt.
*/
import * as THREE from 'three';

// ---------- de markering waar de bom moet komen ----------
const RUIT = 0.42;            // halve hoogte van de ruit
const ZWEEF = 0.35;           // hoe ver hij op en neer gaat
const VLEK = 0.9;             // straal van de lichtvlek op de vloer

/*
 Een plek waar iets moet gebeuren: een gele ruit die boven een vlek op de vloer
 dobbert. `zet` verplaatst hem, `toon` zet hem aan of uit en `update` laat hem
 draaien en deinen.
*/
export function maakMarkering(scene, kleur = 0xffd400) {
  const groep = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: kleur, transparent: true, opacity: 0.92, depthWrite: false });
  // een ruit: twee piramides tegen elkaar, dus een octaëder
  const ruit = new THREE.Mesh(new THREE.OctahedronGeometry(RUIT), mat);
  ruit.position.y = 1.15;
  groep.add(ruit);
  const vlekMat = new THREE.MeshBasicMaterial({ color: kleur, transparent: true, opacity: 0.22, depthWrite: false });
  const vlek = new THREE.Mesh(new THREE.CircleGeometry(VLEK, 24), vlekMat);
  vlek.rotation.x = -Math.PI / 2;
  vlek.position.y = 0.03;
  groep.add(vlek);
  groep.visible = false;
  scene.add(groep);
  let t = 0;
  return {
    groep,
    zet(x, y, z) { groep.position.set(x, y || 0, z); },
    toon(v) { groep.visible = !!v; },
    get zichtbaar() { return groep.visible; },
    update(dt) {
      if (!groep.visible) return;
      t += dt;
      ruit.rotation.y += dt * 1.7;
      ruit.position.y = 1.15 + Math.sin(t * 2.2) * ZWEEF;
      vlekMat.opacity = 0.16 + Math.abs(Math.sin(t * 2.2)) * 0.12;
    },
    verwijder() { scene.remove(groep); },
  };
}

// ---------- het pakketje zelf ----------
/*
 Een tas met de explosieven: een donkere doos met een band eromheen en een
 rood lampje dat knippert. Hij staat op de vloer zodra je hem geplant hebt.
*/
export function maakBompakket(scene) {
  const groep = new THREE.Group();
  const doos = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.28, 0.30),
    new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.8 }));
  doos.position.y = 0.14;
  groep.add(doos);
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.07, 0.32),
    new THREE.MeshStandardMaterial({ color: 0x8a6a2b, roughness: 0.9 }));
  band.position.y = 0.19;
  groep.add(band);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xff2d2d });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), lampMat);
  lamp.position.set(0.14, 0.30, 0.10);
  groep.add(lamp);
  groep.visible = false;
  scene.add(groep);
  let t = 0;
  return {
    groep,
    zet(x, y, z, yaw = 0) { groep.position.set(x, y || 0, z); groep.rotation.y = yaw; },
    toon(v) { groep.visible = !!v; },
    get zichtbaar() { return groep.visible; },
    update(dt) {
      if (!groep.visible) return;
      t += dt;
      // knipperen: kort aan, langer uit — dat leest als "hij staat scherp"
      lampMat.color.setHex((t % 1.1) < 0.22 ? 0xff5a5a : 0x571010);
    },
    verwijder() { scene.remove(groep); },
  };
}

// ---------- de ontploffing ----------
const DUUR = 3.4;             // hoe lang het hele effect duurt
const BAL_MAX = 6.5;          // straal van de vuurbal op zijn hoogtepunt
const PLUIM_H = 12;           // hoe hoog de rook komt
const PLUIM_UIT = 8;          // en hoe ver hij uitwaaiert

/*
 Eén ontploffing op een plek. Maak hem met `ontplofBij` en werk hem elk beeld
 bij; hij ruimt zichzelf op als hij klaar is (`klaar` wordt true).
*/
export function ontplofBij(scene, x, y, z) {
  const groep = new THREE.Group();
  groep.position.set(x, y || 0, z);
  scene.add(groep);

  const balMat = new THREE.MeshBasicMaterial({ color: 0xffb44a, transparent: true, opacity: 0.95, depthWrite: false });
  const bal = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), balMat);
  bal.position.y = 1.6;
  groep.add(bal);

  // een ring van vonken die naar buiten schiet
  const vonken = [];
  const vonkMat = new THREE.MeshBasicMaterial({ color: 0xffd97a, transparent: true, opacity: 0.9, depthWrite: false });
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), vonkMat);
    const hoek = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
    const snel = 9 + Math.random() * 7;
    vonken.push({ m, vx: Math.cos(hoek) * snel, vy: 5 + Math.random() * 7, vz: Math.sin(hoek) * snel });
    m.position.y = 1.2;
    groep.add(m);
  }

  // en de rook: bollen die opstijgen, groeien en vervagen
  const pluim = [];
  for (let i = 0; i < 9; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x5b5b5b, transparent: true, opacity: 0.0, depthWrite: false });
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mat);
    const hoek = Math.random() * Math.PI * 2;
    const uit = Math.random() * PLUIM_UIT;
    pluim.push({
      m, mat, vertraag: i * 0.13,
      dx: Math.cos(hoek) * uit, dz: Math.sin(hoek) * uit,
      hoog: PLUIM_H * (0.45 + Math.random() * 0.55),
      maat: 1.6 + Math.random() * 2.4,
    });
    m.scale.setScalar(0.2);
    groep.add(m);
  }

  let t = 0, klaar = false;
  return {
    get klaar() { return klaar; },
    get t() { return t; },
    plek: { x, y: y || 0, z },
    update(dt) {
      if (klaar) return;
      t += dt;
      // de vuurbal: in een tiende seconde open, daarna uitdoven
      const u = Math.min(1, t / 0.9);
      bal.scale.setScalar(0.6 + u * BAL_MAX);
      balMat.opacity = Math.max(0, 0.95 - u * 1.05);
      bal.visible = balMat.opacity > 0.01;
      // de vonken vliegen weg en vallen
      for (const v of vonken) {
        v.m.position.x += v.vx * dt;
        v.m.position.z += v.vz * dt;
        v.m.position.y += v.vy * dt;
        v.vy -= 16 * dt;
        if (v.m.position.y < 0.1) { v.m.position.y = 0.1; v.vx *= 0.6; v.vz *= 0.6; v.vy = 0; }
      }
      vonkMat.opacity = Math.max(0, 0.9 - t / 1.4);
      // de rook stijgt op, waaiert uit en trekt weg
      for (const p of pluim) {
        const s = Math.max(0, t - p.vertraag);
        const f = Math.min(1, s / (DUUR - p.vertraag));
        p.m.position.set(p.dx * f, 1.2 + p.hoog * f, p.dz * f);
        p.m.scale.setScalar(0.4 + p.maat * f);
        p.mat.opacity = s <= 0 ? 0 : Math.max(0, 0.55 * Math.sin(Math.min(1, f) * Math.PI));
      }
      if (t >= DUUR) {
        klaar = true;
        scene.remove(groep);
        groep.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      }
    },
    stop() {
      if (klaar) return;
      klaar = true;
      scene.remove(groep);
    },
  };
}
