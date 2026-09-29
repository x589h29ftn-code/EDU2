/*
 Missie 17: het erf van Ronald aan de Lemmerweg 80 (stap 103, verzoek 29 sep 2026).

 Het huis staat met de voorgevel naar het westen, naar de weg Tinga; de oprit ligt linksvoor, de
 schuur uit de 3D BAG rechtsachter, en om het erf lopen sloten. Hier staat wat het spel daar nog
 niet had:

   - een caravan aan de noordkant van het huis, met de kluis erin: daar kraak je (E, en blijven
     staan);
   - een camera op de noordwesthoek van het huis die langzaam over de oprit en de voortuin zwaait.
     Waar hij kijkt ligt een zwakke gele kegel op de grond. Wie erin staat, en niet achter de
     caravan, laat de argwaan snel oplopen;
   - een waakhond aan een ketting achter het huis, met zijn hok. Kom je te dichtbij, dan blaft hij
     en loopt de argwaan langzaam op. Een worst uit de koelkast van de Wieken 29, van een afstand
     toegegooid (E), houdt hem stil;
   - de worst zelf.

 Alle plekken staan in het assenstelsel van het huis (`erfAssen`): `v` meter vanaf het midden van
 het huis naar de straat (de voorgevel ligt op v = hx), `s` meter opzij, positief naar de schuur.
 Zo blijft het kloppen met het grondvlak uit de kaart, en de proef (tools/ronaldtest.mjs) meet het
 na: de kraakplek buiten de kegel en buiten het bereik van de hond, de caravan vrij van het huis en
 het water, en de weg van de straat naar de deur die de kegel wel kruist.

 Alles wordt bij het opstarten gemaakt en verborgen (zie `soortenVoorbereid` in js/world.js); geen
 afbeeldingen: de streep op de caravan en de kegel zijn gewone kleuren.
*/
import * as THREE from 'three';
import { hondGeo } from './npc.js';
import { addCollider, zichtVrij } from './world.js';

export const ERF = {
  caravan: { v: 4.4, s: -8.4, lang: 5.8, breed: 2.3, hoog: 2.45 },
  deur: { v: 5.5, s: -6.45 },            // waar je staat om te kraken, aan de kant van het huis
  camera: {
    v: 6.0, s: -3.45, h: 3.1,             // op de noordwesthoek van het huis
    basis: 1.15, zwaai: 0.8,              // hoek (rad) vanaf "recht van het huis af" naar de straat toe, en hoe ver hij heen en weer gaat
    periode: 10,                          // één keer heen en terug (s)
    bereik: 11.5, halfHoek: 0.26,         // hoe ver en hoe breed hij kijkt
  },
  hond: { v: -8.0, s: -1.0, ketting: 2.6, blaf: 7.5 },   // achter het huis; noordelijker ligt de sloot
  hok: { v: -8.6, s: 1.2 },
  argwaan: { kegel: 0.55, blaf: 0.09, zakt: 0.04 },   // per seconde
  kraak: 7,                               // tellen om de kluis open te krijgen
  gooi: 10,                               // zo ver kun je de worst gooien (m)
};

/*
 Het assenstelsel van het huis: `p(v, s)` naar de wereld, `lokaal(x, z)` terug. `voor` wijst naar de
 straat, `opzij` naar de schuur; `hoek` is de draaiing voor three en voor `addCollider`, zodat de
 lange as van een doos (lokaal x) langs `voor` ligt.
*/
export function erfAssen(pand, schuur = null) {
  const r = pand.rect;
  const L = Math.hypot(pand.front[0], pand.front[1]) || 1;
  const fx = pand.front[0] / L, fz = pand.front[1] / L;
  let ox = fz, oz = -fx;
  if (schuur && (schuur.x - r.cx) * ox + (schuur.z - r.cz) * oz < 0) { ox = -ox; oz = -oz; }
  const p = (v, s) => ({ x: r.cx + fx * v + ox * s, z: r.cz + fz * v + oz * s });
  const lokaal = (x, z) => ({ v: (x - r.cx) * fx + (z - r.cz) * fz, s: (x - r.cx) * ox + (z - r.cz) * oz });
  // de richting (dv, ds) in het huis als yaw van de speler (0 = naar −z)
  const yawVan = (dv, ds) => { const wx = fx * dv + ox * ds, wz = fz * dv + oz * ds; return Math.atan2(-wx, -wz); };
  // local −z van een doos met rotation.y = hoek wijst naar +s, als opzij = (fz, −fx)
  const spiegel = ox === fz ? 1 : -1;
  return { p, lokaal, yawVan, voor: { x: fx, z: fz }, opzij: { x: ox, z: oz }, hoek: Math.atan2(-fz, fx), spiegel, midden: { x: r.cx, z: r.cz } };
}

/*
 De hoogte van de grond op (x, z): de vlakken uit de kaart dragen elk een hoogte (`y`: een erf ligt
 op 12 cm, gras op 4); wat er het hoogst ligt, ligt boven. Zonder dit lag de kegel op 7 cm, dus
 onder het erf, en zakte de hond een derde in de grond (stap 103, gemeten met een straal).
*/
function grondPeiler(KAART, midden, straal = 60) {
  const vlakken = (KAART && KAART.vlakken || []).filter(q => q.k !== 'water' && q.k !== 'oever' && Array.isArray(q.r) && q.r.length)
    .map(q => {
      const r = Array.isArray(q.r[0][0]) ? q.r[0] : q.r;
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const p of r) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
      return { y: q.y || 0, r, x0, x1, z0, z1 };
    })
    // (op de omsluitende rechthoek: een groot grasveld heeft zijn hoekpunten ver weg en ligt er toch onder)
    .filter(q => q.x1 > midden.x - straal && q.x0 < midden.x + straal && q.z1 > midden.z - straal && q.z0 < midden.z + straal);
  const binnen = (x, z, r) => { let b = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, zi] = r[i], [xj, zj] = r[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) b = !b; } return b; };
  return (x, z) => { let y = 0; for (const q of vlakken) if (q.y > y && binnen(x, z, q.r)) y = q.y; return y; };
}

export function maakErf(scene, pand, schuur = null, KAART = null) {
  const A = erfAssen(pand, schuur);
  const grond = grondPeiler(KAART, { x: pand.rect.cx, z: pand.rect.cz });
  const groep = new THREE.Group();
  groep.name = 'erf-ronald';
  groep.visible = false;
  scene.add(groep);
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
  const M = {
    wit: mat(0xe6e0d0, { roughness: 0.55 }), streep: mat(0x8a6a45), raam: mat(0x1d242b, { roughness: 0.2, metalness: 0.3 }),
    rubber: mat(0x1a1a1a, { roughness: 0.9 }), staal: mat(0x9aa0a6, { roughness: 0.4, metalness: 0.6 }),
    hond: mat(0x3a2b20, { roughness: 0.95 }), hout: mat(0x6b4a2f, { roughness: 0.9 }), dak: mat(0x3b3f45),
    worst: mat(0x9b3b32, { roughness: 0.5 }), camera: mat(0xd8dadc, { roughness: 0.5 }),
  };
  const led = new THREE.MeshBasicMaterial({ color: 0x3a0606 });
  const kegelMat = new THREE.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.28, depthWrite: false });
  const doos = (b, h, d, m, x, y, z, ouder = groep) => {
    const k = new THREE.Mesh(new THREE.BoxGeometry(b, h, d), m);
    k.position.set(x, y, z); k.castShadow = true; k.receiveShadow = true;
    ouder.add(k);
    return k;
  };

  // ---- de caravan ----
  const C = ERF.caravan;
  const cp = A.p(C.v, C.s);
  const caravan = new THREE.Group();
  caravan.position.set(cp.x, grond(cp.x, cp.z), cp.z);
  caravan.rotation.y = A.hoek;
  groep.add(caravan);
  const vloer = 0.42;
  doos(C.lang, C.hoog - vloer, C.breed, M.wit, 0, vloer + (C.hoog - vloer) / 2, 0, caravan);
  doos(C.lang - 0.1, 0.08, C.breed - 0.1, M.wit, 0, C.hoog + 0.02, 0, caravan);            // een rand op het dak
  const zij = A.spiegel;            // −z lokaal is de kant van het huis (de deur)
  for (const k of [-1, 1]) {
    doos(C.lang + 0.01, 0.16, 0.02, M.streep, 0, vloer + 0.62, k * (C.breed / 2 + 0.005), caravan);
    doos(1.3, 0.62, 0.03, M.raam, -1.4, vloer + 1.35, k * (C.breed / 2 + 0.01), caravan);
    doos(0.9, 0.5, 0.03, M.raam, 1.6, vloer + 1.4, k * (C.breed / 2 + 0.01), caravan);
  }
  doos(0.03, 0.55, 1.4, M.raam, C.lang / 2 + 0.01, vloer + 1.3, 0, caravan);                // voorraam
  const deurZ = -zij * (C.breed / 2 + 0.02);
  const deurX = (ERF.deur.v - C.v) * 1;                                                      // langs de lange as
  doos(0.72, 1.82, 0.04, mat(0xd6cfbd, { roughness: 0.55 }), deurX, vloer + 0.93, deurZ, caravan);
  doos(0.12, 0.03, 0.04, M.staal, deurX + 0.22, vloer + 1.0, deurZ - zij * 0.02, caravan);   // de klink
  doos(0.5, 0.12, 0.35, M.staal, deurX, 0.24, deurZ - zij * 0.2, caravan);                  // opstapje
  const wielGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.2, 16);
  for (const k of [-1, 1]) {
    const w = new THREE.Mesh(wielGeo, M.rubber);
    w.rotation.x = Math.PI / 2; w.position.set(-0.2, 0.33, k * (C.breed / 2 - 0.05));
    caravan.add(w);
  }
  // de dissel, met het neuswiel
  doos(1.25, 0.08, 0.08, M.staal, C.lang / 2 + 0.6, 0.42, 0.35, caravan).rotation.y = 0.25;
  doos(1.25, 0.08, 0.08, M.staal, C.lang / 2 + 0.6, 0.42, -0.35, caravan).rotation.y = -0.25;
  doos(0.08, 0.45, 0.08, M.staal, C.lang / 2 + 1.15, 0.22, 0, caravan);
  const botsCaravan = addCollider(cp.x, cp.z, C.lang / 2, C.breed / 2, A.hoek, 2.5);
  botsCaravan.hOrig = botsCaravan.h;

  // ---- de camera op de hoek van het huis ----
  const K = ERF.camera;
  const kp = A.p(K.v, K.s);
  const camGroep = new THREE.Group();
  camGroep.position.set(kp.x, K.h, kp.z);
  groep.add(camGroep);
  doos(0.06, 0.06, 0.32, M.camera, 0, 0.05, 0, camGroep);                                    // de beugel
  const kop = new THREE.Group();
  camGroep.add(kop);
  doos(0.16, 0.14, 0.34, M.camera, 0, 0, -0.18, kop);
  const lampje = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), led);
  lampje.position.set(0.05, 0.05, -0.36);
  kop.add(lampje);
  // de kegel: een waaier van driehoeken op de grond, vanaf de voet van de muur
  const WAAIER = 12;
  const kegelGeo = new THREE.BufferGeometry();
  {
    const pos = [0, 0, 0];
    for (let i = 0; i <= WAAIER; i++) {
      const a = -K.halfHoek + (2 * K.halfHoek * i) / WAAIER;
      pos.push(Math.sin(a) * K.bereik, 0, -Math.cos(a) * K.bereik);
    }
    const idx = [];
    for (let i = 1; i <= WAAIER; i++) idx.push(0, i + 1, i);          // met de goede kant naar boven
    kegelGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    kegelGeo.setIndex(idx);
  }
  const kegel = new THREE.Mesh(kegelGeo, kegelMat);
  let kegelY = 0;
  for (let a = -1; a <= 1; a += 0.25) for (let r = 1; r <= K.bereik; r += 1.5) {
    const q = A.p(K.v + Math.sin(K.basis + a * (K.zwaai + K.halfHoek)) * r, K.s - Math.cos(K.basis + a * (K.zwaai + K.halfHoek)) * r);
    kegelY = Math.max(kegelY, grond(q.x, q.z));
  }
  kegel.position.set(kp.x, kegelY + 0.05, kp.z);
  kegel.renderOrder = 3;
  groep.add(kegel);

  // ---- de hond, zijn ketting en zijn hok ----
  const H = ERF.hond;
  const anker = A.p(H.v, H.s);
  const hond = new THREE.Mesh(hondGeo(), M.hond);
  hond.scale.setScalar(1.9);
  hond.castShadow = true;
  groep.add(hond);
  const ketting = doos(0.02, 0.02, 1, M.staal, anker.x, 0.25, anker.z);
  const hp = A.p(ERF.hok.v, ERF.hok.s);
  const hok = new THREE.Group();
  hok.position.set(hp.x, grond(hp.x, hp.z), hp.z); hok.rotation.y = A.hoek;
  groep.add(hok);
  doos(1.1, 0.8, 0.9, M.hout, 0, 0.4, 0, hok);
  for (const k of [-1, 1]) doos(1.25, 0.05, 0.62, M.dak, 0, 0.98, k * 0.24, hok).rotation.x = k * 0.55;
  doos(0.05, 0.5, 0.4, mat(0x14100c), 0.56, 0.3, 0, hok);                                  // de opening
  const botsHok = addCollider(hp.x, hp.z, 0.6, 0.5, A.hoek, 1.0);
  botsHok.hOrig = botsHok.h;
  // de paal waar de ketting aan zit
  const ankerY = grond(anker.x, anker.z);
  doos(0.08, 0.5, 0.08, M.staal, anker.x, ankerY + 0.25, anker.z);

  // ---- de worst ----
  const worst = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.18, 10), M.worst);
  worst.rotation.z = Math.PI / 2;
  worst.visible = false;
  groep.add(worst);

  // ---- de stand ----
  const st = {
    t: 0, alarm: false, stil: false,
    hond: { x: anker.x, z: anker.z, yaw: 0, stap: 0 },
    blafT: 0, eetT: 0,
    worst: null,                      // { van, naar, t } terwijl hij vliegt, daarna { ligt }
  };

  // de hoek van de camera (vanaf "recht van het huis af", −s, naar de straat toe, +v)
  const hoekOp = (t) => K.basis + K.zwaai * Math.sin((2 * Math.PI * t) / K.periode);
  function kegelRaakt(x, z, hoek = hoekOp(st.t)) {
    const l = A.lokaal(x, z);
    const dv = l.v - K.v, ds = l.s - K.s;
    const d = Math.hypot(dv, ds);
    if (d < 0.3 || d > K.bereik) return false;
    let da = Math.atan2(dv, -ds) - hoek;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    if (Math.abs(da) > K.halfHoek) return false;
    // de caravan (of iets anders met een botsdoos) houdt de blik tegen; kijk vanaf een halve meter
    // voor de muur, anders begint de lijn in het huis zelf
    const oog = A.p(K.v + Math.sin(hoek) * 0.6, K.s - Math.cos(hoek) * 0.6);
    return zichtVrij(oog.x, oog.z, x, z, 1.2);
  }
  function zetKegel() {
    const a = hoekOp(st.t);
    // de richting in de wereld, als yaw (0 = naar −z)
    const yaw = A.yawVan(Math.sin(a), -Math.cos(a));
    kegel.rotation.y = yaw;
    kop.rotation.y = yaw;
    kop.rotation.x = -0.35;
  }
  function zetHond(dt, loopt) {
    const h = st.hond;
    hond.position.set(h.x, grond(h.x, h.z), h.z);
    hond.rotation.y = h.yaw;
    if (loopt) { h.stap += dt * 9; hond.position.y += Math.abs(Math.sin(h.stap)) * 0.04; }
    // de ketting van de paal naar zijn halsband
    const nx = h.x - Math.sin(h.yaw) * 0.45, nz = h.z - Math.cos(h.yaw) * 0.45;
    const dx = nx - anker.x, dz = nz - anker.z, L = Math.max(0.05, Math.hypot(dx, dz));
    ketting.position.set((anker.x + nx) / 2, ankerY + 0.42, (anker.z + nz) / 2);
    ketting.scale.set(1, 1, L);
    ketting.rotation.set(0, Math.atan2(dx, dz), 0);
  }

  function reset() {
    st.t = 0; st.alarm = false; st.stil = false; st.blafT = 0; st.eetT = 0; st.worst = null;
    const wacht = A.p(H.v + 0.8, H.s - 0.4);
    st.hond.x = wacht.x; st.hond.z = wacht.z; st.hond.yaw = A.yawVan(1, 0); st.hond.stap = 0;
    worst.visible = false;
    led.color.setHex(0x3a0606);
    zetKegel(); zetHond(0, false);
  }
  reset();
  // tot de missie het erf laat zien houdt er niets je tegen
  botsCaravan.h = 0; botsHok.h = 0;

  return {
    groep, assen: A, p: A.p,
    caravan: { ...cp, lang: C.lang, breed: C.breed, hoek: A.hoek },
    grond, get kegelY() { return kegel.position.y; },
    deur: A.p(ERF.deur.v, ERF.deur.s),
    camera: kp, anker, hok: hp,
    get hond() { return { x: st.hond.x, z: st.hond.z, stil: st.stil }; },
    get hoek() { return hoekOp(st.t); },
    get t() { return st.t; },
    set t(v) { st.t = v; zetKegel(); },
    hoekOp, kegelRaakt,
    get zichtbaar() { return groep.visible; },
    toon(aan) {
      groep.visible = !!aan;
      botsCaravan.h = aan ? botsCaravan.hOrig : 0;
      botsHok.h = aan ? botsHok.hOrig : 0;
    },
    reset,
    // het lampje brandt rood zodra het alarm naar Ronald is
    zetAlarm(aan) { st.alarm = !!aan; led.color.setHex(aan ? 0xff2a1a : 0x3a0606); },
    get alarm() { return st.alarm; },
    get stil() { return st.stil; },
    get worstLigt() { return !!(st.worst && st.worst.ligt); },
    // de worst gooien van (x, z): hij landt vlak voor de hond, aan jouw kant
    gooiWorst(x, z) {
      const h = st.hond;
      const dx = x - h.x, dz = z - h.z, d = Math.hypot(dx, dz) || 1;
      const naar = { x: h.x + dx / d * 0.9, z: h.z + dz / d * 0.9 };
      st.worst = { van: { x, z }, naar, t: 0, ligt: false };
      worst.visible = true;
      return naar;
    },
    /*
     Eén beeld. `speler` is { x, z } (of null als je er niet bent). Geeft terug wat de argwaan
     doet: `inKegel` (de camera ziet je), `blaft` (de hond), en de afstand tot de hond.
    */
    update(dt, speler) {
      if (!groep.visible) return { inKegel: false, blaft: false, hondD: Infinity };
      st.t += dt;
      zetKegel();
      // het lampje knippert rustig, tot het alarm is gegaan
      if (!st.alarm) led.color.setHex(Math.floor(st.t * 1.2) % 2 === 0 ? 0x8a0c08 : 0x3a0606);
      const h = st.hond;
      let loopt = false, blaft = false;
      // de worst: eerst door de lucht, dan ligt hij, dan eet de hond
      if (st.worst && !st.worst.ligt) {
        const w = st.worst;
        w.t = Math.min(1, w.t + dt / 0.7);
        const x = w.van.x + (w.naar.x - w.van.x) * w.t, z = w.van.z + (w.naar.z - w.van.z) * w.t;
        worst.position.set(x, grond(x, z) + 0.05 + Math.sin(w.t * Math.PI) * 1.6, z);
        worst.rotation.y += dt * 9;
        if (w.t >= 1) { w.ligt = true; worst.position.y = grond(x, z) + 0.04; }
      }
      const hondD = speler ? Math.hypot(speler.x - anker.x, speler.z - anker.z) : Infinity;
      if (st.worst && st.worst.ligt && !st.stil) {
        // naar de worst toe en opeten; daarna ligt hij tevreden bij zijn hok
        const w = st.worst.naar, dx = w.x - h.x, dz = w.z - h.z, d = Math.hypot(dx, dz);
        if (d > 0.5) { const stap = Math.min(d - 0.45, 3.2 * dt); h.x += dx / d * stap; h.z += dz / d * stap; h.yaw = Math.atan2(-dx, -dz); loopt = true; }
        else { st.eetT += dt; hond.rotation.x = 0.25 * Math.abs(Math.sin(st.eetT * 7)); if (st.eetT > 2.5) { st.stil = true; worst.visible = false; hond.rotation.x = 0; } }
      } else if (!st.stil && speler && hondD < H.blaf) {
        // hij ziet je: naar je toe tot de ketting op is, en blaffen
        const dx = speler.x - h.x, dz = speler.z - h.z;
        h.yaw = Math.atan2(-dx, -dz);
        const doel = { x: anker.x + (speler.x - anker.x) / hondD * Math.min(H.ketting, hondD - 0.8), z: anker.z + (speler.z - anker.z) / hondD * Math.min(H.ketting, hondD - 0.8) };
        const ex = doel.x - h.x, ez = doel.z - h.z, e = Math.hypot(ex, ez);
        if (e > 0.1) { const stap = Math.min(e, 4.5 * dt); h.x += ex / e * stap; h.z += ez / e * stap; loopt = true; }
        blaft = true;
      }
      zetHond(dt, loopt);
      const inKegel = !!speler && kegelRaakt(speler.x, speler.z);
      return { inKegel, blaft, hondD };
    },
    // voor de geluidjes: of hij net een keer blaft (om de ~0,7 s)
    blafNu(dt) { st.blafT -= dt; if (st.blafT <= 0) { st.blafT = 0.6 + Math.random() * 0.35; return true; } return false; },
  };
}
