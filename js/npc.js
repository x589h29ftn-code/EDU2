// Voetgangers die over de trottoirs van de wijk lopen.
// Alle lichaamsdelen zijn instanced meshes met een kleur per persoon, zodat
// tientallen mensen samen maar zeven draw calls kosten.
import * as THREE from 'three';
import { rng } from './textures.js';

const SHIRTS = [0x2f3a56, 0x8a1f1f, 0xe8e2d0, 0x2a6b3a, 0x2b2b2b, 0xd8b04a, 0x6a4c93, 0xc85a2a, 0x3f7fb0];
const PANTS = [0x1f2a44, 0x333333, 0x5a4632, 0x6f7480, 0x24303f];
const SKIN = [0xd9b48f, 0xc48a5a, 0x8d5a3b, 0xf0d5b8, 0xa9714b];
const HAIR = [0x2a1d12, 0x141414, 0x8a6a3a, 0xd8c39a, 0x6b3a1f, 0x9a9a9a];
// vachtkleuren van de hondjes: wit, crème, zandbruin, roodbruin, donkerbruin,
// grijs, zwart en een lichtgrijze
const VACHT = [0xe8e2d6, 0xd9c39a, 0xc39a63, 0x9a5a30, 0x5a3a24, 0x8d8d8d, 0x2b2b2b, 0xbfb9ae];

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

/*
 Een hondje aan de lijn: romp, kop met snuit en oren, staart en vier pootjes in
 één geometrie. Het is een klein hondje (romp van veertig centimeter, schofthoogte
 dertig), en de schaal per instantie maakt de ene wat groter dan de andere. Alles
 zit in één mesh met de kleur per instantie, dus alle honden samen kosten twee
 draw calls: eentje voor de beesten en eentje voor de lijnen.
*/
function hondGeo() {
  const delen = [];
  const doos = (w, h, d, x, y, z, rx = 0) => {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rx) g.rotateX(rx);
    g.translate(x, y, z);
    delen.push(g);
  };
  doos(0.17, 0.18, 0.38, 0, 0.27, 0);                 // romp
  doos(0.13, 0.06, 0.10, 0, 0.33, -0.22, -0.5);       // nek
  doos(0.14, 0.14, 0.15, 0, 0.36, -0.29);             // kop
  doos(0.08, 0.07, 0.10, 0, 0.33, -0.40);             // snuit
  for (const zx of [-1, 1]) doos(0.04, 0.09, 0.05, zx * 0.055, 0.45, -0.28);   // oren
  doos(0.05, 0.05, 0.16, 0, 0.36, 0.24, -0.7);        // staart omhoog
  for (const zx of [-1, 1]) for (const dz of [-0.13, 0.14]) doos(0.05, 0.20, 0.05, zx * 0.055, 0.10, dz);
  const pos = [], nor = [];
  for (const g of delen) {
    const ng = g.index ? g.toNonIndexed() : g;
    pos.push(...ng.attributes.position.array);
    nor.push(...ng.attributes.normal.array);
    if (ng !== g) ng.dispose();
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
      // een op de acht wandelaars laat een hondje uit
      const hond = !fietst && height > 0.93 && r() < 0.13
        ? { kleur: VACHT[Math.floor(r() * VACHT.length)], maat: 0.72 + r() * 0.5,
            kant: r() < 0.5 ? 1 : -1, riem: 1.1 + r() * 0.5, fase: r() * 6.28, x: 0, z: 0, yaw: 0 }
        : null;
      const p = {
        seg: null, t: 0, dir: 1, side: r() < 0.5 ? 1 : -1,
        speed: fietst ? 4.2 + r() * 1.8 : (1.0 + r() * 0.55) * (0.85 + height * 0.2),
        // hollen als er iets gebeurt: een volwassene haalt zo'n 4,8 m/s, een
        // kind blijft rond de 4,2, en wie fietst gaat er stevig vandoor
        ren: fietst ? 6.4 + r() * 1.6 : 1.9 + height * 2.6,
        vNu: 0,                       // snelheid van dit moment, loopt op en af
        paniek: 0, schrik: 0, bron: null,
        height, phase: r() * 6.28, alive: true, fall: 0, respawn: 0,
        pause: fietst ? 0 : r() * 12, x: 0, z: 0, yaw: 0,
        fietst, hond,
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

    // de hondjes en hun lijnen: twee meshes voor allemaal
    this.hondBazen = this.people.filter(p => p.hond);
    this.hondBazen.forEach((p, i) => { p.hond.i = i; });
    const nHond = Math.max(1, this.hondBazen.length);
    this.hond = new THREE.InstancedMesh(hondGeo(), new THREE.MeshStandardMaterial({ roughness: 0.95 }), nHond);
    this.hond.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.hond.castShadow = true; this.hond.frustumCulled = false;
    this.riem = new THREE.InstancedMesh(new THREE.BoxGeometry(0.016, 0.016, 1), new THREE.MeshStandardMaterial({ color: 0x8a2f2f, roughness: 0.9 }), nHond);
    this.riem.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.riem.frustumCulled = false;
    for (const p of this.hondBazen) this.hond.setColorAt(p.hond.i, col.setHex(p.hond.kleur));
    if (this.hond.instanceColor) this.hond.instanceColor.needsUpdate = true;
    scene.add(this.hond, this.riem);

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
    let s;
    if (p.paniek > 0 && p.bron) {
      // op de vlucht: op de hoek de straat in die het verst van de knal af leidt
      let ver = -1;
      for (const c of cands) {
        const aanA = Math.hypot(c.a[0] - end[0], c.a[1] - end[1]) < 1.5;
        const uit = aanA ? c.b : c.a;
        const d = Math.hypot(uit[0] - p.bron.x, uit[1] - p.bron.z);
        if (d > ver) { ver = d; s = c; }
      }
    } else {
      s = cands[Math.floor(this.r() * cands.length)];
    }
    const startsAtA = Math.hypot(s.a[0] - end[0], s.a[1] - end[1]) < 1.5;
    p.seg = s; p.dir = startsAtA ? 1 : -1; p.t = startsAtA ? 0 : 1;
    if (p.paniek <= 0 && this.r() < 0.35) p.side *= -1;   // soms oversteken naar de andere stoep
  }

  /*
   De kant op langs het huidige segment die van de schrik af leidt. Loop je met
   dir = +1 mee met (a → b), dan neemt de afstand tot de bron toe zolang je van
   de bron af wijst; anders draait hij zich om.
  */
  vluchtRichting(p) {
    if (!p.bron) return;
    const s = p.seg;
    const len = Math.max(0.1, Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]));
    const dx = (s.b[0] - s.a[0]) / len, dz = (s.b[1] - s.a[1]) / len;
    p.dir = (p.x - p.bron.x) * dx + (p.z - p.bron.z) * dz >= 0 ? 1 : -1;
  }

  /*
   Schrikken. Iedereen binnen `straal` van het punt kijkt op, blijft een tel
   staan en rent dan weg van de knal: eerst de straat uit waar hij in staat, op
   elke hoek de zijstraat die het verst van het punt af ligt. Wie dichterbij
   staat rent langer door. `duur` is de looptijd in seconden voor wie er bovenop
   staat. Geeft terug hoeveel mensen er schrikken.

   Wordt aangeroepen als er geschoten wordt en als er iemand wordt aangereden
   (zie js/main.js).
  */
  paniek(x, z, straal = 26, duur = 9) {
    let n = 0;
    for (const p of this.people) {
      if (!p.alive) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d > straal) continue;
      const t = duur * (1 - 0.45 * d / straal);
      if (t > p.paniek) p.paniek = t;
      // schrikmoment: een korte reactietijd voordat hij het op een lopen zet
      if (!p.bron) p.schrik = 0.15 + this.r() * 0.35;
      p.bron = { x, z };
      p.pause = 0;
      this.vluchtRichting(p);
      n++;
    }
    return n;
  }

  update(dt, time) {
    const m = this._m, q = this._q, e = this._e, v = this._v, sc = this._s;
    for (let i = 0; i < this.people.length; i++) {
      const p = this.people[i];
      let swing = 0;
      // paniek loopt af; de eerste tienden van een seconde staat hij nog stil
      if (p.paniek > 0) {
        p.paniek = Math.max(0, p.paniek - dt);
        p.schrik = Math.max(0, p.schrik - dt);
        if (p.paniek === 0) { p.bron = null; p.schrik = 0; }
      }
      const rent = p.alive && p.paniek > 0 && p.schrik <= 0;
      // snelheid van dit moment: niemand gaat in één beeld van stilstaan naar
      // hollen, dus het loopt op (en na de schrik weer af)
      const doelV = !p.alive || (p.paniek > 0 && p.schrik > 0) ? 0 : (rent ? p.ren : p.speed);
      p.vNu += Math.max(-6.0 * dt, Math.min(3.2 * dt, doelV - p.vNu));
      if (!p.alive) {
        p.fall = Math.min(1, p.fall + dt * 3);
        p.respawn -= dt;
        if (p.respawn <= 0) {
          p.alive = true; p.fall = 0; p.smak = null;
          p.paniek = 0; p.bron = null; p.vNu = 0;
          if (p.hond) p.hond.geplaatst = false;      // het hondje verhuist mee
          this.pickSegment(p, true);
        }
      } else if (p.steek > 0) {
        // midden in het oversteken: van de ene stoep naar de andere; wie schrikt
        // maakt er haast mee
        p.steek = Math.max(0, p.steek - dt * (p.fietst ? 1.6 : 0.9) * (rent ? 2.2 : 1));
        if (p.steek === 0) { p.side = p.steekNaar; p.opWeg = false; }
        swing = Math.sin(time * (rent ? 11 : 6.2) / p.height + p.phase) * (rent ? 0.9 : 0.5);
      } else if (p.pause > 0 && !rent) {
        p.pause -= dt;                       // even stilstaan
      } else {
        const s = p.seg;
        const len = Math.max(0.1, Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]));
        p.t += p.dir * p.vNu * dt / len;
        if (p.t > 1 || p.t < 0) { p.t = Math.max(0, Math.min(1, p.t)); this.pickSegment(p); }
        if (!rent) {
          if (!p.fietst && this.r() < dt * 0.03) p.pause = 2 + this.r() * 8;
          // af en toe oversteken naar de overkant, dwars over de rijbaan
          p.steekWacht -= dt;
          if (p.steekWacht <= 0 && s.drive) {
            p.steekWacht = 18 + this.r() * 40;
            p.steekVan = p.side; p.steekNaar = -p.side;
            p.steek = 1; p.opWeg = true;
          }
        }
        // de pas loopt mee met de snelheid: slenteren, doorstappen of hollen
        const cadans = p.fietst ? 3.0 + p.vNu * 0.35 : 3.0 + p.vNu * 2.0;
        const uitslag = p.fietst ? 0.3 : 0.45 + Math.min(0.5, p.vNu * 0.12);
        swing = Math.sin(time * cadans / p.height + p.phase) * uitslag;
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
      // aangereden: hij schuift nog een paar meter door in de richting van de klap
      if (p.smak) {
        p.smak.t = Math.max(0, p.smak.t - dt);
        p.smak.weg = (p.smak.weg || 0) + p.smak.t * 7 * dt;
        p.x += p.smak.dx * p.smak.weg;
        p.z += p.smak.dz * p.smak.weg;
      }

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
    // ---- de hondjes ----
    /*
     Het hondje loopt schuin achter zijn baas aan de riem: een halve meter opzij
     en een lijflengte naar achteren, met een slinger erin zodat hij niet als een
     aanhangwagen achter je aan hangt. Hij dribbelt (kleine op-en-neer) en zijn
     neus wijst de kant op waar hij loopt. Wie stilstaat heeft een hond die ook
     stilstaat en wat rondsnuffelt; gaat de baas neer, dan blijft de hond bij hem.
    */
    for (const p of this.hondBazen) {
      const h = p.hond;
      const snel = p.alive ? p.vNu : 0;
      const zwiep = Math.sin(time * (1.4 + snel * 0.5) + h.fase) * (0.28 + snel * 0.06);
      const vx = -Math.sin(p.yaw), vz = -Math.cos(p.yaw);         // looprichting van de baas
      const zx = -vz, zz = vx;                                    // opzij
      const achter = 0.75 + snel * 0.20;
      const doelX = p.x - vx * achter + zx * (h.kant * 0.55 + zwiep * 0.35);
      const doelZ = p.z - vz * achter + zz * (h.kant * 0.55 + zwiep * 0.35);
      // de eerste keer (en na een respawn van de baas) staat hij er meteen
      if (!h.geplaatst) { h.x = doelX; h.z = doelZ; h.yaw = p.yaw; h.geplaatst = true; }
      // daarna loopt hij er soepel naartoe in plaats van eraan vastgeklonken te zitten
      const f = Math.min(1, dt * (3.0 + snel));
      h.x += (doelX - h.x) * f; h.z += (doelZ - h.z) * f;
      const naarX = doelX - h.x, naarZ = doelZ - h.z;
      const doelYaw = Math.hypot(naarX, naarZ) > 0.05 ? Math.atan2(-naarX, -naarZ) : p.yaw + zwiep * 0.25;
      let verschil = doelYaw - h.yaw;
      while (verschil > Math.PI) verschil -= Math.PI * 2;
      while (verschil < -Math.PI) verschil += Math.PI * 2;
      h.yaw += verschil * Math.min(1, dt * 6);
      const dribbel = p.alive ? Math.abs(Math.sin(time * (5 + snel * 2.5) + h.fase)) * 0.035 * Math.min(1, snel) : 0;
      const s2 = h.maat;
      e.set(0, h.yaw, 0, 'YXZ'); q.setFromEuler(e);
      m.compose(v.set(h.x, dribbel, h.z), q, sc.set(s2, s2, s2));
      this.hond.setMatrixAt(h.i, m);
      // de riem: een dun staafje van de hand van de baas naar de nek van de hond
      const handX = p.x + zx * h.kant * 0.22, handZ = p.z + zz * h.kant * 0.22;
      const handY = 0.95 * p.height;
      const nekX = h.x - Math.sin(h.yaw) * 0.28 * s2, nekZ = h.z - Math.cos(h.yaw) * 0.28 * s2;
      const nekY = 0.42 * s2;
      const dx2 = nekX - handX, dy2 = nekY - handY, dz2 = nekZ - handZ;
      const L2 = Math.hypot(dx2, dy2, dz2) || 0.01;
      m.lookAt(v.set(0, 0, 0), sc.set(dx2, dy2, dz2).normalize(), new THREE.Vector3(0, 1, 0));
      q.setFromRotationMatrix(m);
      m.compose(v.set(handX + dx2 / 2, handY + dy2 / 2, handZ + dz2 / 2), q, sc.set(1, 1, L2));
      this.riem.setMatrixAt(h.i, m);
    }
    if (this.hondBazen.length) { this.hond.instanceMatrix.needsUpdate = true; this.riem.instanceMatrix.needsUpdate = true; }

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

  /*
   Aanrijden: iedereen die binnen `straal` van dit punt loopt gaat tegen de
   vlakte. Wordt door js/vehicles.js aangeroepen voor drie punten langs de auto,
   zodat een bakwagen van zeven meter ook echt over zijn hele lengte raakt.
   Geeft terug hoeveel mensen er neergingen; wie geraakt is vliegt een stukje
   met de auto mee en staat na een halve minuut verderop weer op.
  */
  aanrijden(x, z, straal = 1.2, snelheid = 0) {
    let n = 0;
    const vaart = Math.min(1, Math.abs(snelheid) / 14);
    for (const p of this.people) {
      if (!p.alive) continue;
      const dx = p.x - x, dz = p.z - z;
      if (dx * dx + dz * dz > straal * straal) continue;
      p.alive = false; p.fall = 0; p.respawn = 22 + this.r() * 8;
      p.pause = 0; p.steek = 0; p.opWeg = false;
      // een zetje in de richting waarin hij geraakt wordt
      const d = Math.hypot(dx, dz) || 1;
      p.smak = { dx: dx / d, dz: dz / d, t: 0.35 + vaart * 0.5 };
      n++;
    }
    return n;
  }
}
