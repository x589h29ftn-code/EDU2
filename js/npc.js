// Voetgangers die over de trottoirs van de wijk lopen.
// Alle lichaamsdelen zijn instanced meshes met een kleur per persoon, zodat
// tientallen mensen samen maar zeven draw calls kosten.
import * as THREE from 'three';
import { rng } from './textures.js';

const SHIRTS = [0x2f3a56, 0x8a1f1f, 0xe8e2d0, 0x2a6b3a, 0x2b2b2b, 0xd8b04a, 0x6a4c93, 0xc85a2a, 0x3f7fb0];
const PANTS = [0x1f2a44, 0x333333, 0x5a4632, 0x6f7480, 0x24303f];
const SKIN = [0xd9b48f, 0xc48a5a, 0x8d5a3b, 0xf0d5b8, 0xa9714b];
const HAIR = [0x2a1d12, 0x141414, 0x8a6a3a, 0xd8c39a, 0x6b3a1f, 0x9a9a9a];

// lichaamsmaten in meters (volwassene van ~1,75 m)
const PARTS = {
  torso: { geo: () => new THREE.BoxGeometry(0.40, 0.60, 0.23), y: 1.16 },
  neck: { geo: () => new THREE.CylinderGeometry(0.062, 0.075, 0.10, 8), y: 1.50 },
  head: { geo: () => new THREE.SphereGeometry(0.115, 10, 8), y: 1.575 },
  hair: { geo: () => new THREE.SphereGeometry(0.122, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), y: 1.59 },
  legL: { geo: () => { const g = new THREE.BoxGeometry(0.135, 0.84, 0.19); g.translate(0, -0.42, 0); return g; }, y: 0.88, x: -0.115 },
  legR: { geo: () => { const g = new THREE.BoxGeometry(0.135, 0.84, 0.19); g.translate(0, -0.42, 0); return g; }, y: 0.88, x: 0.115 },
  armL: { geo: () => { const g = new THREE.BoxGeometry(0.10, 0.58, 0.10); g.translate(0, -0.29, 0); return g; }, y: 1.44, x: -0.26 },
  armR: { geo: () => { const g = new THREE.BoxGeometry(0.10, 0.58, 0.10); g.translate(0, -0.29, 0); return g; }, y: 1.44, x: 0.26 },
};

// Een fiets: frame, twee wielen en een stuur. Wie fietst krijgt hem onder zich,
// wie loopt krijgt hem op schaal nul en is dus onzichtbaar.
function fietsGeo() {
  const delen = [];
  const voeg = (g) => delen.push(g.index ? g.toNonIndexed() : g);
  for (const dz of [-0.52, 0.52]) {
    const w = new THREE.TorusGeometry(0.34, 0.028, 5, 12);
    w.rotateY(Math.PI / 2); w.translate(0, 0.34, dz); voeg(w);
  }
  const frame = new THREE.BoxGeometry(0.05, 0.05, 0.95); frame.translate(0, 0.62, 0); voeg(frame);
  const zadelbuis = new THREE.BoxGeometry(0.05, 0.34, 0.05); zadelbuis.translate(0, 0.72, 0.28); voeg(zadelbuis);
  const zadel = new THREE.BoxGeometry(0.10, 0.05, 0.24); zadel.translate(0, 0.90, 0.30); voeg(zadel);
  const balhoofd = new THREE.BoxGeometry(0.05, 0.46, 0.05); balhoofd.translate(0, 0.78, -0.42); voeg(balhoofd);
  const stuur = new THREE.BoxGeometry(0.46, 0.04, 0.04); stuur.translate(0, 1.00, -0.44); voeg(stuur);
  const pos = [], nor = [];
  for (const g of delen) {
    pos.push(...g.attributes.position.array);
    nor.push(...g.attributes.normal.array);
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return geo;
}

export class NPCs {
  constructor(scene, roadSegments, count = 42) {
    this.scene = scene;
    // alleen segmenten met een trottoir; het trottoir ligt op walkOff van de as
    this.segs = roadSegments.filter(s => s.w > 0 && s.walkOff > 0 && s.name !== 'N7' && s.name !== 'Afrit 21');
    // kans op een segment evenredig met de lengte, zodat lange straten voller zijn
    // en de doorgaande Buitenroede juist rustiger
    this.weights = [];
    let acc = 0;
    for (const s of this.segs) {
      const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
      acc += len * (s.name === 'Buitenroede' ? 0.25 : 1);
      this.weights.push(acc);
    }
    this.total = acc;
    this.paths = roadSegments.filter(s => s.w > 0 && !s.drive);   // parkpaden
    if (!this.segs.length) this.segs = roadSegments.filter(s => s.w > 0);
    const r = rng(555); this.r = r;
    this.people = [];

    this.meshes = {};
    for (const [key, def] of Object.entries(PARTS)) {
      const m = new THREE.InstancedMesh(def.geo(), new THREE.MeshStandardMaterial({ roughness: 0.92 }), count);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.castShadow = true;
      m.frustumCulled = false;
      this.meshes[key] = m;
      scene.add(m);
    }
    // kleur per persoon
    const col = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const shirt = SHIRTS[Math.floor(r() * SHIRTS.length)];
      const pants = PANTS[Math.floor(r() * PANTS.length)];
      const skin = SKIN[Math.floor(r() * SKIN.length)];
      const hair = HAIR[Math.floor(r() * HAIR.length)];
      this.meshes.torso.setColorAt(i, col.setHex(shirt));
      this.meshes.armL.setColorAt(i, col.setHex(shirt));
      this.meshes.armR.setColorAt(i, col.setHex(shirt));
      this.meshes.legL.setColorAt(i, col.setHex(pants));
      this.meshes.legR.setColorAt(i, col.setHex(pants));
      this.meshes.head.setColorAt(i, col.setHex(skin));
      this.meshes.neck.setColorAt(i, col.setHex(skin));
      this.meshes.hair.setColorAt(i, col.setHex(hair));

      const height = 0.88 + r() * 0.22;   // kinderen tot volwassenen
      // een op de vijf is een fietser: hoger, sneller en met een fiets eronder
      const fietst = r() < 0.20 && height > 0.95;
      const p = {
        seg: null, t: 0, dir: 1, side: r() < 0.5 ? 1 : -1,
        speed: fietst ? 4.2 + r() * 1.8 : (1.0 + r() * 0.55) * (0.85 + height * 0.2),
        height, phase: r() * 6.28, alive: true, fall: 0, respawn: 0,
        pause: fietst ? 0 : r() * 12, x: 0, z: 0, yaw: 0,
        fietst,
        // oversteken: opWeg is waar het verkeer voor moet remmen
        steek: 0, steekVan: 0, steekNaar: 0, opWeg: false, steekWacht: 4 + r() * 25,
      };
      this.pickSegment(p, true);
      this.people.push(p);
    }
    // fietsen als aparte instanced mesh; wie loopt krijgt schaal nul
    this.fiets = new THREE.InstancedMesh(fietsGeo(), new THREE.MeshStandardMaterial({ color: 0x2a3340, roughness: 0.55, metalness: 0.4 }), count);
    this.fiets.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.fiets.castShadow = true; this.fiets.frustumCulled = false;
    scene.add(this.fiets);

    for (const key of Object.keys(PARTS)) this.meshes[key].instanceColor.needsUpdate = true;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion();
    this._e = new THREE.Euler(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3();
  }

  pickSegment(p, random = false) {
    if (random || !p.seg) {
      const target = this.r() * this.total;
      let lo = 0, hi = this.weights.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (this.weights[mid] < target) lo = mid + 1; else hi = mid; }
      p.seg = this.segs[lo];
      p.t = this.r(); p.dir = this.r() < 0.5 ? 1 : -1;
      return;
    }
    const end = p.dir > 0 ? p.seg.b : p.seg.a;
    const cands = this.segs.filter(s => s !== p.seg &&
      (Math.hypot(s.a[0] - end[0], s.a[1] - end[1]) < 1.5 || Math.hypot(s.b[0] - end[0], s.b[1] - end[1]) < 1.5));
    if (!cands.length) { p.dir *= -1; p.t = Math.max(0, Math.min(1, p.t)); return; }
    const s = cands[Math.floor(this.r() * cands.length)];
    const startsAtA = Math.hypot(s.a[0] - end[0], s.a[1] - end[1]) < 1.5;
    p.seg = s; p.dir = startsAtA ? 1 : -1; p.t = startsAtA ? 0 : 1;
    if (this.r() < 0.35) p.side *= -1;     // soms oversteken naar de andere stoep
  }

  update(dt, time) {
    const m = this._m, q = this._q, e = this._e, v = this._v, sc = this._s;
    for (let i = 0; i < this.people.length; i++) {
      const p = this.people[i];
      let swing = 0;
      if (!p.alive) {
        p.fall = Math.min(1, p.fall + dt * 3);
        p.respawn -= dt;
        if (p.respawn <= 0) { p.alive = true; p.fall = 0; this.pickSegment(p, true); }
      } else if (p.steek > 0) {
        // midden in het oversteken: van de ene stoep naar de andere
        p.steek = Math.max(0, p.steek - dt * (p.fietst ? 1.6 : 0.9));
        if (p.steek === 0) { p.side = p.steekNaar; p.opWeg = false; }
        swing = Math.sin(time * 6.2 / p.height + p.phase) * 0.5;
      } else if (p.pause > 0) {
        p.pause -= dt;                       // even stilstaan
      } else {
        const s = p.seg;
        const len = Math.max(0.1, Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]));
        p.t += p.dir * p.speed * dt / len;
        if (p.t > 1 || p.t < 0) { p.t = Math.max(0, Math.min(1, p.t)); this.pickSegment(p); }
        if (!p.fietst && this.r() < dt * 0.03) p.pause = 2 + this.r() * 8;
        // af en toe oversteken naar de overkant, dwars over de rijbaan
        p.steekWacht -= dt;
        if (p.steekWacht <= 0 && s.drive) {
          p.steekWacht = 18 + this.r() * 40;
          p.steekVan = p.side; p.steekNaar = -p.side;
          p.steek = 1; p.opWeg = true;
        }
        swing = Math.sin(time * (p.fietst ? 3.0 : 5.4) / p.height + p.phase) * (p.fietst ? 0.3 : 0.55);
      }
      const s = p.seg;
      const len = Math.max(0.1, Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]));
      const dx = (s.b[0] - s.a[0]) / len, dz = (s.b[1] - s.a[1]) / len;
      const basis = s.walkOff || s.w / 2 + 0.8;
      // tijdens het oversteken schuift de zijde van de ene naar de andere kant
      const zijde = p.steek > 0 ? p.steekVan * p.steek + p.steekNaar * (1 - p.steek) : p.side;
      const off = basis * zijde;
      p.x = s.a[0] + (s.b[0] - s.a[0]) * p.t - dz * off;
      p.z = s.a[1] + (s.b[1] - s.a[1]) * p.t + dx * off;
      p.yaw = Math.atan2(-dx * p.dir, -dz * p.dir) + Math.PI;

      const h = p.height;
      const tilt = p.alive ? 0 : -p.fall * Math.PI / 2;
      // op de fiets zit je hoger en trappen je benen kleine rondjes
      const yLift = (p.alive ? 0 : p.fall * 0.3) + (p.fietst && p.alive ? 0.42 : 0);
      if (p.fietst) {
        const fq = new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, p.yaw, 0, 'YXZ'));
        m.compose(new THREE.Vector3(p.x, p.alive ? 0 : 0.1, p.z), fq, new THREE.Vector3(h, h, h));
        this.fiets.setMatrixAt(i, m);
      } else {
        m.makeScale(0, 0, 0);
        this.fiets.setMatrixAt(i, m);
      }
      for (const [key, def] of Object.entries(PARTS)) {
        const isLeg = key === 'legL' || key === 'legR';
        const isArm = key === 'armL' || key === 'armR';
        let rot = 0;
        if (isLeg) rot = key === 'legL' ? swing : -swing;
        if (isArm) rot = key === 'armL' ? -swing * 0.75 : swing * 0.75;
        e.set(tilt, p.yaw, 0, 'YXZ');
        q.setFromEuler(e);
        // ledemaat zwaait om zijn ophangpunt, daarna pas de romprotatie
        if (rot) {
          const swingQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), rot);
          q.multiply(swingQ);
        }
        v.set((def.x || 0) * h, def.y * h + yLift, 0).applyQuaternion(
          new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, p.yaw, 0, 'YXZ')));
        sc.set(h, h, h);
        m.compose(v.add(new THREE.Vector3(p.x, 0, p.z)), q, sc);
        this.meshes[key].setMatrixAt(i, m);
      }
    }
    for (const key of Object.keys(PARTS)) this.meshes[key].instanceMatrix.needsUpdate = true;
    this.fiets.instanceMatrix.needsUpdate = true;
  }

  // raycast-doelen: de instanced meshes zelf
  get targets() { return Object.values(this.meshes); }

  hit(obj, instanceId) {
    if (instanceId == null) return false;
    const p = this.people[instanceId];
    if (!p || !p.alive) return false;
    p.alive = false; p.respawn = 25; p.fall = 0;
    return true;
  }
}
