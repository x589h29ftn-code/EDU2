/*
 Vogels (stap 124): eenden en zwanen op het water, en een zwerm meeuwen boven de haven van IJlst.

 Op het water: een vaste pool van groepjes (twee tot vijf eenden, of een paar zwanen) die rond de
 camera in het water liggen, tussen 40 en 220 m. Een groepje dat verder dan 320 m weg ligt, verhuist
 naar een nieuw stuk water in de buurt (dan zie je het toch niet meer). Ze peddelen langzaam, draaien
 af en toe, en keren om waar het water ophoudt (`vaarbaar` uit js/world.js, dus ook voor een steiger).

 Alles staat in instanced meshes met de kleur in de hoekpunten: één voor de eenden, één voor de
 zwanen, en voor de meeuwen een lijf en twee vleugels die per beeld klapperen. Gemaakt bij het
 opstarten, zodat de shaders vooraf vertaald worden (`soortenVoorbereid`).
*/
import * as THREE from 'three';
import { vaarbaar } from './world.js';

export const VOGELS = {
  groepen: 7,            // groepjes op het water
  perGroep: 5,           // hoogstens zoveel eenden in een groepje
  zwanenKans: 0.3,
  binnen: 40, buiten: 220, verhuis: 320,
  meeuwen: 14,
  haven: { x: -1282, z: 1106 },   // de ligplaats in IJlst (js/boot.js LIGPLAATSEN)
};

// ---------- vormen met kleur in de hoekpunten ----------
function gekleurd(geo, kleur) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(kleur);
  const n = g.attributes.position.count, k = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { k[i * 3] = c.r; k[i * 3 + 1] = c.g; k[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(k, 3));
  g.deleteAttribute('uv');
  return g;
}
function samen(lijst) {
  const pos = [], nor = [], kl = [];
  for (const g of lijst) {
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); kl.push(...g.attributes.color.array);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(kl, 3));
  geo.computeBoundingSphere();
  return geo;
}
function bol(r, sx, sy, sz, x, y, z, kleur) {
  const g = new THREE.SphereGeometry(r, 10, 7); g.scale(sx, sy, sz); g.translate(x, y, z);
  return gekleurd(g, kleur);
}
function doos(w, h, d, x, y, z, kleur, rx = 0) {
  const g = new THREE.BoxGeometry(w, h, d); if (rx) g.rotateX(rx); g.translate(x, y, z);
  return gekleurd(g, kleur);
}

// een wilde eend, 50 cm lang, de kop naar −z: bruin lijf, groene kop, gele snavel
function eendGeo() {
  return samen([
    bol(0.13, 1, 0.62, 1.9, 0, 0.05, 0.02, 0x7a6248),
    bol(0.07, 1, 1, 1.2, 0, 0.14, -0.2, 0x1f5a34),
    bol(0.04, 1.2, 0.5, 1, 0, 0.1, -0.16, 0xf2f2ea),      // de witte halsband
    doos(0.045, 0.02, 0.07, 0, 0.13, -0.29, 0xe0b23a),
    bol(0.06, 1, 0.5, 1.4, 0, 0.09, 0.2, 0x3b3f46),         // de staart
  ]);
}
// een knobbelzwaan, 1,4 m lang, met de gebogen hals
function zwaanGeo() {
  return samen([
    bol(0.3, 1, 0.6, 1.7, 0, 0.12, 0.08, 0xf4f3ee),
    doos(0.08, 0.5, 0.08, 0, 0.42, -0.32, 0xf0efea, 0.32),
    bol(0.07, 1, 1, 1.5, 0, 0.66, -0.43, 0xf4f3ee),
    doos(0.05, 0.04, 0.12, 0, 0.64, -0.55, 0xe06a1c),
    doos(0.04, 0.05, 0.03, 0, 0.66, -0.49, 0x15171a),
  ]);
}
function meeuwLijf() {
  return samen([
    bol(0.09, 1, 1, 2.6, 0, 0, 0, 0xf2f2ee),
    doos(0.03, 0.02, 0.06, 0, -0.01, -0.27, 0xe6c13a),
    doos(0.12, 0.02, 0.1, 0, 0, 0.27, 0xe9e9e4),
  ]);
}
// een vleugel naar +x; de andere is gespiegeld
function meeuwVleugel(spiegel) {
  const s = spiegel ? -1 : 1;
  const g = new THREE.BufferGeometry();
  const p = [0, 0, -0.08, s * 0.62, 0, 0.02, 0, 0, 0.12];
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  // de punt van de vleugel donker, net als bij een zilvermeeuw
  const kl = [0.72, 0.74, 0.78, 0.18, 0.18, 0.2, 0.72, 0.74, 0.78];
  g.setAttribute('color', new THREE.Float32BufferAttribute(kl, 3));
  return g;
}

export function initVogels({ scene, waterY = -0.35, geluid = null }) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
  const vleugelMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  const N_EEND = VOGELS.groepen * VOGELS.perGroep, N_ZWAAN = VOGELS.groepen * 2;
  const eenden = new THREE.InstancedMesh(eendGeo(), mat, N_EEND);
  const zwanen = new THREE.InstancedMesh(zwaanGeo(), mat, N_ZWAAN);
  const lijven = new THREE.InstancedMesh(meeuwLijf(), mat, VOGELS.meeuwen);
  const links = new THREE.InstancedMesh(meeuwVleugel(false), vleugelMat, VOGELS.meeuwen);
  const rechts = new THREE.InstancedMesh(meeuwVleugel(true), vleugelMat, VOGELS.meeuwen);
  for (const m of [eenden, zwanen, lijven, links, rechts]) {
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;      // ze verhuizen over de hele kaart; de bol zou elk beeld opnieuw moeten
    m.count = 0;
    scene.add(m);
  }

  // ---------- het water ----------
  const groepen = [];
  let zaad = 9173;
  const rnd = () => { zaad = (zaad * 1664525 + 1013904223) >>> 0; return zaad / 4294967296; };
  // ruim water: het punt en vier punten op 2,5 m eromheen
  function ruim(x, z, r = 2.5) {
    return vaarbaar(x, z) && vaarbaar(x + r, z) && vaarbaar(x - r, z) && vaarbaar(x, z + r) && vaarbaar(x, z - r);
  }
  function zoekWater(cx, cz) {
    for (let i = 0; i < 40; i++) {
      const a = rnd() * Math.PI * 2, d = VOGELS.binnen + rnd() * (VOGELS.buiten - VOGELS.binnen);
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (ruim(x, z)) return { x, z };
    }
    return null;
  }
  function vulGroep(g, plek) {
    g.x = plek.x; g.z = plek.z;
    g.zwaan = rnd() < VOGELS.zwanenKans;
    const n = g.zwaan ? 2 : 2 + Math.floor(rnd() * (VOGELS.perGroep - 1));
    g.dieren = [];
    for (let i = 0; i < n; i++) {
      g.dieren.push({ x: plek.x + (rnd() - 0.5) * 3, z: plek.z + (rnd() - 0.5) * 3, yaw: rnd() * 6.28, v: 0.15 + rnd() * 0.3,
        draai: 0, klok: rnd() * 4, deining: rnd() * 6.28 });
    }
  }
  for (let i = 0; i < VOGELS.groepen; i++) groepen.push({ x: 1e9, z: 1e9, dieren: [], zwaan: false, leeg: true });

  // ---------- de meeuwen ----------
  const meeuwen = [];
  for (let i = 0; i < VOGELS.meeuwen; i++) {
    meeuwen.push({ r: 18 + rnd() * 45, h: 14 + rnd() * 22, fase: rnd() * 6.28, w: (0.18 + rnd() * 0.16) * (rnd() < 0.5 ? -1 : 1),
      klap: rnd() * 6.28, zweef: rnd() * 10, cx: (rnd() - 0.5) * 30, cz: (rnd() - 0.5) * 30 });
  }

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sch = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  let t = 0, zoekKlok = 0, meeuwKlok = 3;

  function update(dt, cx, cz) {
    t += dt;
    // verhuizen: een groepje te ver weg zoekt een nieuw stuk water (één per beeld, het zoeken kost iets)
    zoekKlok -= dt;
    if (zoekKlok <= 0) {
      zoekKlok = 0.4;
      const g = groepen.find(g => g.leeg || Math.hypot(g.x - cx, g.z - cz) > VOGELS.verhuis);
      if (g) { const plek = zoekWater(cx, cz); if (plek) { vulGroep(g, plek); g.leeg = false; } }
    }
    let ne = 0, nz = 0;
    for (const g of groepen) {
      if (g.leeg) continue;
      let sx = 0, sz = 0;
      for (const d of g.dieren) {
        // af en toe een andere kant op, en terug naar het groepje als je te ver afdrijft
        d.klok -= dt;
        if (d.klok <= 0) {
          d.klok = 2 + rnd() * 5;
          d.draai = (rnd() - 0.5) * 0.9;
          const terug = Math.hypot(g.x - d.x, g.z - d.z) > (g.zwaan ? 8 : 5);
          if (terug) d.yaw = Math.atan2(-(g.x - d.x), -(g.z - d.z));
          d.v = rnd() < 0.25 ? 0 : 0.15 + rnd() * 0.3;
        }
        d.yaw += d.draai * dt;
        const nx = d.x - Math.sin(d.yaw) * d.v * dt, nzz = d.z - Math.cos(d.yaw) * d.v * dt;
        // waar het water ophoudt draait hij om
        if (vaarbaar(nx - Math.sin(d.yaw) * 0.8, nzz - Math.cos(d.yaw) * 0.8)) { d.x = nx; d.z = nzz; }
        else { d.yaw += Math.PI * (0.6 + rnd() * 0.4); d.klok = 1.5; }
        d.deining += dt * 1.3;
        sx += d.x; sz += d.z;
        e.set(Math.sin(d.deining) * 0.04, d.yaw, Math.cos(d.deining * 0.8) * 0.03, 'YXZ');
        q.setFromEuler(e);
        p.set(d.x, waterY + Math.sin(d.deining) * 0.012, d.z);
        m4.compose(p, q, sch);
        if (g.zwaan) zwanen.setMatrixAt(nz++, m4); else eenden.setMatrixAt(ne++, m4);
      }
      // het midden van het groepje schuift mee, langzaam
      g.x += (sx / g.dieren.length - g.x) * Math.min(1, dt * 0.1);
      g.z += (sz / g.dieren.length - g.z) * Math.min(1, dt * 0.1);
    }
    eenden.count = ne; zwanen.count = nz;
    eenden.instanceMatrix.needsUpdate = true; zwanen.instanceMatrix.needsUpdate = true;

    // de meeuwen: alleen als je binnen 700 m van de haven bent
    const H = VOGELS.haven;
    const havenAf = Math.hypot(cx - H.x, cz - H.z);
    const zien = havenAf < 700;
    lijven.count = links.count = rechts.count = zien ? meeuwen.length : 0;
    if (zien) {
      for (let i = 0; i < meeuwen.length; i++) {
        const m = meeuwen[i];
        m.fase += m.w * dt;
        const x = H.x + m.cx + Math.cos(m.fase) * m.r, z = H.z + m.cz + Math.sin(m.fase) * m.r;
        const y = m.h + Math.sin(t * 0.4 + m.zweef) * 2;
        // de vliegrichting is de raaklijn aan de cirkel; schuin in de bocht
        const yaw = Math.atan2(Math.sin(m.fase) * Math.sign(m.w), -Math.cos(m.fase) * Math.sign(m.w));
        e.set(0, yaw, -Math.sign(m.w) * 0.35, 'YXZ'); q.setFromEuler(e);
        p.set(x, y, z); m4.compose(p, q, sch);
        lijven.setMatrixAt(i, m4);
        // klapperen, met tussendoor stukken zweven
        const zweeft = Math.sin(t * 0.3 + m.zweef) > 0.2;
        m.klap += dt * (zweeft ? 0 : 7);
        const hoek = zweeft ? 0.08 : Math.sin(m.klap) * 0.55;
        e.set(0, yaw, -Math.sign(m.w) * 0.35 + hoek, 'YXZ'); q.setFromEuler(e); m4.compose(p, q, sch); links.setMatrixAt(i, m4);
        e.set(0, yaw, -Math.sign(m.w) * 0.35 - hoek, 'YXZ'); q.setFromEuler(e); m4.compose(p, q, sch); rechts.setMatrixAt(i, m4);
      }
      lijven.instanceMatrix.needsUpdate = links.instanceMatrix.needsUpdate = rechts.instanceMatrix.needsUpdate = true;
      // en je hoort ze, hoe dichterbij hoe vaker
      if (geluid && havenAf < 220) {
        meeuwKlok -= dt;
        if (meeuwKlok <= 0) { meeuwKlok = 2 + Math.random() * 4 + havenAf / 60; geluid.sfeerGeluid('meeuw'); }
      }
    }
  }

  return {
    update,
    get eenden() { return eenden.count; },
    get zwanen() { return zwanen.count; },
    get meeuwen() { return lijven.count; },
    get groepen() { return groepen.filter(g => !g.leeg).map(g => ({ x: g.x, z: g.z, zwaan: g.zwaan, dieren: g.dieren.map(d => ({ x: d.x, z: d.z })) })); },
    // voor een proef of foto: meteen alle groepjes rond (cx, cz) neerleggen
    vulAan(cx, cz) {
      for (const g of groepen) { const plek = zoekWater(cx, cz); if (plek) { vulGroep(g, plek); g.leeg = false; } }
      update(0, cx, cz);
    },
    meeuwPlek(i = 0) { const m = new THREE.Matrix4(); lijven.getMatrixAt(i, m); return new THREE.Vector3().setFromMatrixPosition(m); },
    meshes: { eenden, zwanen, lijven, links, rechts },
  };
}
