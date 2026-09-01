// Voetgangers die over de stoepen van de wijk lopen.
import * as THREE from 'three';
import { rng } from './textures.js';

const SHIRTS = [0x2f3a56, 0x8a1f1f, 0xe8e2d0, 0x2a6b3a, 0x111111, 0xd8b04a, 0x6a4c93];
const PANTS = [0x1f2a44, 0x333333, 0x5a4632, 0x7a7f86];

function makePerson(r) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: [0xd9b48f, 0xc48a5a, 0x8d5a3b, 0xf0d5b8][Math.floor(r() * 4)], roughness: 0.9 });
  const shirt = new THREE.MeshStandardMaterial({ color: SHIRTS[Math.floor(r() * SHIRTS.length)], roughness: 0.9 });
  const pants = new THREE.MeshStandardMaterial({ color: PANTS[Math.floor(r() * PANTS.length)], roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.24), shirt); torso.position.y = 1.18; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), skin); head.position.y = 1.66; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.135, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: [0x2a1d12, 0x111111, 0x8a6a3a, 0xd8c39a][Math.floor(r() * 4)] })); hair.position.y = 1.68; g.add(hair);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.85, 0.2), pants); legL.position.set(-0.11, 0.44, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.11; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.6, 0.11), shirt); armL.position.set(-0.28, 1.15, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.28; g.add(armR);
  g.userData.limbs = { legL, legR, armL, armR };
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export class NPCs {
  constructor(scene, roadSegments, count = 18) {
    this.scene = scene;
    this.segs = roadSegments.filter(s => s.w > 0 && s.name !== 'N7' && s.name !== 'Afrit 21');
    this.people = [];
    const r = rng(555); this.r = r;
    for (let i = 0; i < count; i++) {
      const mesh = makePerson(r);
      scene.add(mesh);
      const p = { mesh, seg: null, t: 0, dir: 1, side: r() < 0.5 ? 1 : -1, speed: 1.1 + r() * 0.6, alive: true, fall: 0, phase: r() * 6, respawn: 0 };
      this.pickSegment(p, true);
      this.people.push(p);
    }
  }

  pickSegment(p, random = false) {
    if (random || !p.seg) {
      p.seg = this.segs[Math.floor(this.r() * this.segs.length)];
      p.t = this.r(); p.dir = this.r() < 0.5 ? 1 : -1;
      return;
    }
    // zoek aansluitend segment bij het bereikte eindpunt
    const end = p.dir > 0 ? p.seg.b : p.seg.a;
    const cands = this.segs.filter(s => s !== p.seg && (Math.hypot(s.a[0] - end[0], s.a[1] - end[1]) < 1 || Math.hypot(s.b[0] - end[0], s.b[1] - end[1]) < 1));
    if (cands.length === 0) { p.dir *= -1; return; }
    const s = cands[Math.floor(this.r() * cands.length)];
    const startsAtA = Math.hypot(s.a[0] - end[0], s.a[1] - end[1]) < 1;
    p.seg = s; p.dir = startsAtA ? 1 : -1; p.t = startsAtA ? 0 : 1;
  }

  update(dt, time) {
    for (const p of this.people) {
      if (!p.alive) {
        p.fall = Math.min(1, p.fall + dt * 3);
        p.mesh.rotation.x = -p.fall * Math.PI / 2;
        p.mesh.position.y = p.fall * 0.35;
        p.respawn -= dt;
        if (p.respawn <= 0) { p.alive = true; p.fall = 0; p.mesh.rotation.x = 0; p.mesh.position.y = 0; this.pickSegment(p, true); }
        continue;
      }
      const s = p.seg;
      const len = Math.max(0.1, Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]));
      p.t += p.dir * p.speed * dt / len;
      if (p.t > 1 || p.t < 0) { p.t = Math.max(0, Math.min(1, p.t)); this.pickSegment(p); continue; }
      const x = s.a[0] + (s.b[0] - s.a[0]) * p.t, z = s.a[1] + (s.b[1] - s.a[1]) * p.t;
      const dx = (s.b[0] - s.a[0]) / len, dz = (s.b[1] - s.a[1]) / len;
      const off = s.w / 2 + 1.0;
      p.mesh.position.set(x - dz * off * p.side, 0, z + dx * off * p.side);
      p.mesh.rotation.y = Math.atan2(-dx * p.dir, -dz * p.dir) + Math.PI;
      const L = p.mesh.userData.limbs; const sw = Math.sin(time * 6 + p.phase) * 0.5;
      L.legL.rotation.x = sw; L.legR.rotation.x = -sw; L.armL.rotation.x = -sw * 0.7; L.armR.rotation.x = sw * 0.7;
    }
  }

  hit(obj) {
    for (const p of this.people) {
      let o = obj; while (o && o !== p.mesh) o = o.parent;
      if (o === p.mesh && p.alive) { p.alive = false; p.respawn = 25; return true; }
    }
    return false;
  }
}
