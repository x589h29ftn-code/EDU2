// Auto's: geparkeerd, bestuurbaar en verkeer op de N7 en in de wijk.
import * as THREE from 'three';
import { resolveCollisions, pointInWater } from './world.js';
import { HIGHWAY, ROADS, toWorld } from './data.js';
import { rng } from './textures.js';
import { makeCar } from './carmodel.js';

const COLORS = [0x1c1e24, 0xd8d9dc, 0x8a8d93, 0x2a3f8f, 0x9c1f1f, 0xffffff, 0x3e3a36, 0x2f6b3a, 0x5b6470, 0xc9c1a8];

export class Vehicles {
  constructor(scene, parkSpots) {
    this.scene = scene;
    this.cars = [];   // {mesh,x,z,yaw,speed,driveable}
    this.traffic = [];
    const r = rng(2024);
    for (const s of parkSpots) {
      const kind = r() < 0.15 ? 'van' : 'hatch';
      const mesh = makeCar(COLORS[Math.floor(r() * COLORS.length)], kind);
      const car = { mesh, x: s.x, z: s.z, yaw: s.yaw, speed: 0, steer: 0, driveable: true, hp: 100 };
      mesh.position.set(s.x, 0, s.z); mesh.rotation.y = s.yaw;
      scene.add(mesh); this.cars.push(car);
    }
    // verkeer N7 (beide richtingen)
    const hp = HIGHWAY.pts.map(p => { const [x, z] = toWorld(p[0], p[1]); return new THREE.Vector2(x, z); });
    for (let i = 0; i < 14; i++) {
      const dir = i % 2 ? 1 : -1;
      const lane = (i % 4 < 2) ? 2.1 : 6.2;
      const mesh = makeCar(COLORS[Math.floor(r() * COLORS.length)], r() < 0.3 ? 'van' : 'hatch');
      scene.add(mesh);
      this.traffic.push({ mesh, path: hp, t: r() * (hp.length - 1), dir, lane, speed: 22 + r() * 8, y: 0.6 });
    }
    // wijkverkeer: langzame auto's op Molenkrite, Jasker, Monnikmolen, De Wieken
    const local = ROADS.filter(rd => ['Molenkrite', 'Jasker', 'Monnikmolen', 'De Wieken', 'Buitenroede', 'Bonkelaar'].includes(rd.name) && rd.pts.length > 3);
    for (let i = 0; i < 6; i++) {
      const rd = local[i % local.length];
      const path = rd.pts.map(p => { const [x, z] = toWorld(p[0], p[1]); return new THREE.Vector2(x, z); });
      const mesh = makeCar(COLORS[Math.floor(r() * COLORS.length)]);
      scene.add(mesh);
      this.traffic.push({ mesh, path, t: r() * (path.length - 1), dir: 1, lane: 1.4, speed: 6 + r() * 2, y: 0.1, bounce: true });
    }
  }

  nearestDriveable(x, z, maxD = 3.0) {
    let best = null, bd = maxD;
    for (const c of this.cars) {
      const d = Math.hypot(c.x - x, c.z - z) - 1.2;
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  // Auto rijden: eenvoudig arcade-model
  drive(car, keys, dt) {
    const accel = (keys.KeyW || keys.ArrowUp) ? 7 : 0;
    const brake = (keys.KeyS || keys.ArrowDown) ? 1 : 0;
    const hand = keys.Space ? 1 : 0;
    let target = 0;
    if (keys.KeyA || keys.ArrowLeft) target = 1;
    if (keys.KeyD || keys.ArrowRight) target = -1;
    car.steer += (target * 0.55 - car.steer) * Math.min(1, dt * 6);
    if (accel) car.speed += accel * dt;
    if (brake) car.speed -= (car.speed > 0 ? 12 : 4) * dt;
    if (hand) car.speed *= Math.max(0, 1 - dt * 3);
    // rolweerstand
    car.speed *= Math.max(0, 1 - dt * 0.4);
    car.speed = Math.max(-6, Math.min(24, car.speed));
    if (Math.abs(car.speed) < 0.02 && !accel && !brake) car.speed = 0;
    const turn = car.steer * car.speed * dt / 2.6;
    car.yaw += turn;
    const nx = car.x - Math.sin(car.yaw) * car.speed * dt;
    const nz = car.z - Math.cos(car.yaw) * car.speed * dt;
    // botsingen: 3 cirkels langs de auto
    let ok = true;
    const fx = -Math.sin(car.yaw), fz = -Math.cos(car.yaw);
    let cx = nx, cz = nz;
    for (const off of [-1.4, 0, 1.4]) {
      const px = cx + fx * off, pz = cz + fz * off;
      const [rx, rz] = resolveCollisions(px, pz, 0.95, 3.5);
      if (rx !== px || rz !== pz) { cx += rx - px; cz += rz - pz; ok = false; }
    }
    if (pointInWater(cx, cz)) { cx = car.x; cz = car.z; ok = false; }
    if (!ok) car.speed *= 0.3;
    car.x = cx; car.z = cz;
    car.mesh.position.set(car.x, 0, car.z); car.mesh.rotation.y = car.yaw;
  }

  // Verkeer. Auto's kijken een stukje vooruit en remmen voor elkaar, voor de
  // speler en voor overstekende voetgangers; daarna trekken ze weer op.
  updateTraffic(dt, speler = null, voetgangers = null) {
    // eerst iedereen op zijn plek zetten, dan pas vooruitkijken
    for (const t of this.traffic) {
      const n = t.path.length;
      const j0 = Math.floor(t.t), j1 = Math.min(n - 1, j0 + 1);
      const p = t.path[j0].clone().lerp(t.path[j1], t.t - j0);
      const d = t.path[j1].clone().sub(t.path[j0]).normalize().multiplyScalar(t.dir);
      const nrm = new THREE.Vector2(-d.y, d.x);
      t._pos = new THREE.Vector2(p.x + nrm.x * t.lane, p.y + nrm.y * t.lane);
      t._dir = d;
      if (t.snelheid === undefined) { t.snelheid = t.speed; t.doel = t.speed; }
    }

    const KIJK = 11;          // meter vooruitkijken
    const BREED = 2.2;        // hoe ver naast de as iets nog in de weg staat

    for (const t of this.traffic) {
      let vrij = KIJK;

      const inDeWeg = (x, z, marge) => {
        const dx = x - t._pos.x, dz = z - t._pos.y;
        const langs = dx * t._dir.x + dz * t._dir.y;         // afstand recht vooruit
        if (langs <= 0.5 || langs > KIJK) return;
        const opzij = Math.abs(dx * -t._dir.y + dz * t._dir.x);
        if (opzij > BREED + marge) return;
        if (langs < vrij) vrij = langs;
      };

      for (const a of this.traffic) { if (a !== t) inDeWeg(a._pos.x, a._pos.y, 0.4); }
      for (const c of this.cars) { if (c.mesh.visible) inDeWeg(c.x, c.z, 0.4); }
      if (speler && !speler.inCar) inDeWeg(speler.pos.x, speler.pos.z, 0.1);
      if (voetgangers) {
        for (const v of voetgangers) { if (v.alive && v.opWeg) inDeWeg(v.x, v.z, 0.1); }
      }

      // remmen naar nul op vier meter, weer optrekken zodra het vrij is
      t.doel = vrij >= KIJK ? t.speed : Math.max(0, t.speed * (vrij - 4) / (KIJK - 4));
      const versnelling = t.doel < t.snelheid ? 14 : 3.5;    // remmen gaat harder dan optrekken
      t.snelheid += Math.max(-versnelling * dt, Math.min(versnelling * dt, t.doel - t.snelheid));

      const n = t.path.length;
      const j0 = Math.floor(t.t), j1 = Math.min(n - 1, j0 + 1);
      const segLen = Math.max(0.01, t.path[j0].distanceTo(t.path[j1]));
      t.t += t.dir * (t.snelheid * dt) / segLen;
      if (t.t >= n - 1) { if (t.bounce) { t.dir = -1; t.t = n - 1.001; } else t.t = 0; }
      if (t.t <= 0) { if (t.bounce) { t.dir = 1; t.t = 0.001; } else t.t = n - 1.001; }

      const k0 = Math.floor(t.t), k1 = Math.min(n - 1, k0 + 1);
      const p2 = t.path[k0].clone().lerp(t.path[k1], t.t - k0);
      const d2 = t.path[k1].clone().sub(t.path[k0]).normalize().multiplyScalar(t.dir);
      const nrm2 = new THREE.Vector2(-d2.y, d2.x).multiplyScalar(t.lane);
      t.mesh.position.set(p2.x + nrm2.x, t.y, p2.y + nrm2.y);
      t.mesh.rotation.y = Math.atan2(-d2.x, -d2.y);
      if (t.remlicht) t.remlicht.visible = t.doel < t.speed * 0.6;
    }
  }

  hit(mesh) {
    for (const c of this.cars) {
      if (c.mesh === mesh || mesh.parent === c.mesh) { c.hp -= 25; return c; }
    }
    return null;
  }
}
