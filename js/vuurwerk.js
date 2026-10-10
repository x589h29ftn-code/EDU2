/*
 Vuurwerk boven Tinga (stap 127).

 Gevraagd op 9 okt 2026: "Laat ook vuurwerk de lucht in bij het einde en speel weer het muziekje dat bij intro
 spel ook komt." Aan het eind van missie 18, in het filmbeeld voor de Wieken 29, gaan er pijlen de lucht in.

 Alles is één InstancedMesh van kleine achtvlakken met een MeshBasicMaterial dat optelt (additief): een pijl
 is één vonk met een staart van een paar vonken erachter, en op zijn hoogste punt springt hij open in een bol
 van VUURWERK.vonken vonken in één of twee kleuren. Een vonk dooft uit door te krimpen en donkerder te worden
 (een instantie heeft geen eigen doorzichtigheid). Er komt geen materiaal of lichtbron bij tijdens het spelen:
 het net bestaat vanaf het opstarten en wordt achter het laadscherm vertaald (js/world.js `soortenVoorbereid`
 loopt ook langs wat onzichtbaar is).

 `start(plekken)` begint de show boven een paar plekken ({ x, z, y }), `stop()` laat wat er hangt uitdoven,
 `update(dt)` elk beeld; `knal(afstand)` uit de opties is voor het geluid.
*/
import * as THREE from 'three';

export const VUURWERK = {
  max: 900,            // vonken tegelijk
  vonken: 70,          // per bol
  om: [0.55, 1.15],    // s tussen twee pijlen
  hoog: [40, 62],      // m boven de grond: daar springt hij open (boven de daken, in beeld van het filmbeeld)
  stijg: 30,           // m/s omhoog
  open: [11, 16],      // m/s naar buiten in de bol
  zwaarte: 5.5,        // m/s² naar beneden
  rem: 1.1,            // 1/s luchtweerstand
  leef: [1.4, 2.2],    // s dat een vonk van de bol gloeit
  maat: 0.55,          // m, een vonk van de bol
};

const KLEUREN = [0xff3b3b, 0xffd23f, 0x49d6ff, 0x7dff6a, 0xff6ad5, 0xffffff, 0xff9a2e, 0xb18cff];
const r = (a, b) => a + Math.random() * (b - a);

export function maakVuurwerk(scene, { knal = null } = {}) {
  const geo = new THREE.OctahedronGeometry(0.5, 0);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, VUURWERK.max);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.visible = false;
  mesh.renderOrder = 3;
  const kleur = new THREE.Color();
  for (let i = 0; i < VUURWERK.max; i++) mesh.setColorAt(i, kleur.setHex(0xffffff));
  scene.add(mesh);

  // de vonken: { x, y, z, vx, vy, vz, t, leef, maat, kleur, pijl, hoog }
  const vonken = [];
  let plekken = [], aan = false, wacht = 0, pijlen = 0, bollen = 0;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();

  function pijl() {
    if (!plekken.length || vonken.length >= VUURWERK.max - VUURWERK.vonken) return;
    const b = plekken[Math.floor(Math.random() * plekken.length)];
    const x = b.x + r(-14, 14), z = b.z + r(-14, 14), y0 = b.y || 0;
    vonken.push({ x, y: y0, z, vx: r(-1.5, 1.5), vy: VUURWERK.stijg * r(0.9, 1.1), vz: r(-1.5, 1.5), t: 0, leef: 9,
      maat: 0.45, kleur: 0xffe2a8, pijl: true, hoog: y0 + r(VUURWERK.hoog[0], VUURWERK.hoog[1]) });
    pijlen++;
  }
  function bol(v) {
    const a = KLEUREN[Math.floor(Math.random() * KLEUREN.length)];
    const b = Math.random() < 0.4 ? KLEUREN[Math.floor(Math.random() * KLEUREN.length)] : a;
    const snel = r(VUURWERK.open[0], VUURWERK.open[1]);
    const n = Math.min(VUURWERK.vonken, VUURWERK.max - vonken.length);
    for (let i = 0; i < n; i++) {
      // gelijkmatig over een bol (de gulden hoek), met een beetje ruis
      const u = 1 - 2 * (i + 0.5) / n, rr = Math.sqrt(1 - u * u), h = i * 2.39996;
      const k = snel * r(0.85, 1.05);
      vonken.push({ x: v.x, y: v.y, z: v.z, vx: Math.cos(h) * rr * k, vy: u * k + 2, vz: Math.sin(h) * rr * k,
        t: 0, leef: r(VUURWERK.leef[0], VUURWERK.leef[1]), maat: VUURWERK.maat, kleur: i % 2 ? a : b, pijl: false });
    }
    bollen++;
    if (knal) knal(v);
  }

  return {
    mesh,
    get actief() { return aan; },
    get aantal() { return vonken.length; },
    get pijlen() { return pijlen; },
    get bollen() { return bollen; },
    start(nieuw) { plekken = nieuw.slice(); aan = true; wacht = 0.3; mesh.visible = true; },
    stop() { aan = false; },
    // alles meteen weg (laden, een nieuwe missie)
    wis() { aan = false; vonken.length = 0; mesh.count = 0; mesh.visible = false; },
    update(dt) {
      if (aan) { wacht -= dt; if (wacht <= 0) { wacht = r(VUURWERK.om[0], VUURWERK.om[1]); pijl(); if (Math.random() < 0.3) pijl(); } }
      if (!vonken.length) { mesh.count = 0; if (!aan) mesh.visible = false; return; }
      const rem = Math.max(0, 1 - VUURWERK.rem * dt);
      let n = 0;
      for (let i = vonken.length - 1; i >= 0; i--) {
        const v = vonken[i];
        v.t += dt;
        if (v.pijl) {
          v.vy -= VUURWERK.zwaarte * 0.4 * dt;
          if (v.y >= v.hoog || v.vy < 4) { vonken.splice(i, 1); bol(v); continue; }
        } else {
          v.vx *= rem; v.vy *= rem; v.vz *= rem;
          v.vy -= VUURWERK.zwaarte * dt;
          if (v.t > v.leef) { vonken.splice(i, 1); continue; }
        }
        v.x += v.vx * dt; v.y += v.vy * dt; v.z += v.vz * dt;
      }
      for (const v of vonken) {
        if (n >= VUURWERK.max) break;
        const f = v.pijl ? 1 : Math.max(0, 1 - v.t / v.leef);
        // de pijl: een streep langs zijn snelheid; een vonk krimpt en dooft
        const m = v.maat * (v.pijl ? 1 : 0.35 + 0.65 * f);
        p.set(v.x, v.y, v.z);
        s.set(m, v.pijl ? m * 3.5 : m, m);
        q.identity();
        m4.compose(p, q, s);
        mesh.setMatrixAt(n, m4);
        kleur.setHex(v.kleur).multiplyScalar(v.pijl ? 1 : 0.25 + 0.75 * f * f);
        mesh.setColorAt(n, kleur);
        n++;
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.boundingSphere = null;
    },
  };
}
