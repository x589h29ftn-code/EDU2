/*
 Rode knipperlichten op hoge gebouwen (stap 124). 's Nachts knipperen er rode lampjes op de
 hoeken van de hoge platte daken (goot vanaf 11 m: de flats en kantoren) en bovenop de zendmast van
 Radio Tinga. Het zijn gloeiende bolletjes en geen lampen (stap 83: het aantal lichtbronnen blijft
 gelijk); ze staan in één instanced mesh en knipperen met één gedeeld materiaal, allemaal tegelijk,
 zoals obstakelverlichting doet: een seconde aan, een seconde uit.
*/
import * as THREE from 'three';

export const KNIPPER = { goot: 11, periode: 2.0, aan: 1.0, maat: 0.55 };

export function initKnipperlichten({ scene, panden = [], extra = [] }) {
  const plekken = [];
  for (const p of panden) {
    if (!(p.goot >= KNIPPER.goot) || p.dak === 'slanted' || !p.voet || p.voet.length < 3) continue;
    // de twee hoeken die het verst uit elkaar liggen
    let a = 0, b = 1, best = -1;
    for (let i = 0; i < p.voet.length; i++) for (let j = i + 1; j < p.voet.length; j++) {
      const d = Math.hypot(p.voet[i][0] - p.voet[j][0], p.voet[i][1] - p.voet[j][1]);
      if (d > best) { best = d; a = i; b = j; }
    }
    // een halve meter naar binnen, zodat het lampje op het dak staat en niet in de lucht ernaast
    const cx = p.voet.reduce((s, q) => s + q[0], 0) / p.voet.length, cz = p.voet.reduce((s, q) => s + q[1], 0) / p.voet.length;
    for (const k of [a, b]) {
      const [x, z] = p.voet[k], d = Math.hypot(cx - x, cz - z) || 1;
      plekken.push({ x: x + (cx - x) / d * 0.5, y: (p.nok || p.goot) + 0.35, z: z + (cz - z) / d * 0.5 });
    }
  }
  const mat = new THREE.MeshBasicMaterial({ color: 0xff2414, fog: false });
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(KNIPPER.maat, 8, 6), mat, Math.max(1, plekken.length));
  const m4 = new THREE.Matrix4();
  plekken.forEach((q, i) => { m4.makeTranslation(q.x, q.y, q.z); mesh.setMatrixAt(i, m4); });
  mesh.count = plekken.length;
  mesh.visible = false;
  scene.add(mesh);
  const UIT = new THREE.Color(0x3a0805), AAN = new THREE.Color(0xff2414);
  let t = 0, staat = false;

  function update(dt, nacht) {
    t += dt;
    const aan = (t % KNIPPER.periode) < KNIPPER.aan;
    mesh.visible = !!nacht && plekken.length > 0;
    if (aan !== staat || !nacht) {
      staat = aan && !!nacht;
      mat.color.copy(staat ? AAN : UIT);
      // de lampjes van anderen (de mast van Radio Tinga) knipperen mee; overdag blijven ze rood
      for (const e of extra) if (e) e.color.copy(staat || !nacht ? AAN : UIT);
    }
  }
  return { update, get plekken() { return plekken; }, get aan() { return staat; }, mesh };
}
