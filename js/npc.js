// Voetgangers die over de trottoirs van de wijk lopen.
// Alle lichaamsdelen zijn instanced meshes met een kleur per persoon, zodat
// tientallen mensen samen maar zeven draw calls kosten.
import * as THREE from 'three';
import { rng } from './textures.js';
import { grondHoogte } from './viaduct.js';
import { MAAT, DEEL, loopHouding, fietsHouding } from './lichaam.js';

const SHIRTS = [0x2f3a56, 0x8a1f1f, 0xe8e2d0, 0x2a6b3a, 0x2b2b2b, 0xd8b04a, 0x6a4c93, 0xc85a2a, 0x3f7fb0];
const PANTS = [0x1f2a44, 0x333333, 0x5a4632, 0x6f7480, 0x24303f];
const SKIN = [0xd9b48f, 0xc48a5a, 0x8d5a3b, 0xf0d5b8, 0xa9714b];
const HAIR = [0x2a1d12, 0x141414, 0x8a6a3a, 0xd8c39a, 0x6b3a1f, 0x9a9a9a];
// vachtkleuren van de hondjes: wit, crème, zandbruin, roodbruin, donkerbruin,
// grijs, zwart en een lichtgrijze
const VACHT = [0xe8e2d6, 0xd9c39a, 0xc39a63, 0x9a5a30, 0x5a3a24, 0x8d8d8d, 0x2b2b2b, 0xbfb9ae];

const SCHOEN = [0x2b2b2b, 0x3a2c22, 0x4a4a52, 0x1c1c22, 0x6b5540];

/*
 De lichaamsdelen. De maten en de vormen komen uit js/lichaam.js, zodat een
 wandelaar, een agent en een bewaker precies dezelfde bouw hebben.

 Delen met `paar: true` zitten links én rechts aan het lichaam. Die krijgen niet
 twee instanced meshes maar één met twee instanties per persoon (2*i is links,
 2*i+1 is rechts): elf meshes voor honderddertig mensen in plaats van zeventien.

 `y` is de hoogte van het draaipunt; voor een ledemaat rekent `houding()` die
 zelf uit, want die hangt aan het gewricht erboven.
*/
const DELEN = [
  { naam: 'romp', geo: DEEL.romp, kleur: 'shirt', y: MAAT.romp },
  { naam: 'bekken', geo: DEEL.bekken, kleur: 'broek', y: MAAT.bekken },
  { naam: 'nek', geo: DEEL.nek, kleur: 'huid', y: MAAT.nek },
  { naam: 'hoofd', geo: DEEL.hoofd, kleur: 'huid', y: MAAT.hoofd },
  { naam: 'haar', geo: DEEL.haar, kleur: 'haar', y: MAAT.hoofd + 0.020 },
  { naam: 'bovenarm', geo: DEEL.bovenarm, kleur: 'shirt', paar: true },
  { naam: 'onderarm', geo: DEEL.onderarm, kleur: 'shirt', paar: true },
  { naam: 'hand', geo: DEEL.hand, kleur: 'huid', paar: true },
  { naam: 'bovenbeen', geo: DEEL.bovenbeen, kleur: 'broek', paar: true },
  { naam: 'onderbeen', geo: DEEL.onderbeen, kleur: 'broek', paar: true },
  { naam: 'schoen', geo: DEEL.schoen, kleur: 'schoen', paar: true },
];
const SCHOUDER_X = 0.235;      // iets buiten de romp, anders steken de armen erin

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
    for (const def of DELEN) {
      const n = def.paar ? count * 2 : count;
      const m = new THREE.InstancedMesh(def.geo(), new THREE.MeshStandardMaterial({ roughness: 0.92 }), n);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.castShadow = true;
      m.frustumCulled = false;
      m.userData.paar = !!def.paar;
      this.meshes[def.naam] = m;
      scene.add(m);
    }
    // kleur per persoon
    const col = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const shirt = SHIRTS[Math.floor(r() * SHIRTS.length)];
      const pants = PANTS[Math.floor(r() * PANTS.length)];
      const skin = SKIN[Math.floor(r() * SKIN.length)];
      const hair = HAIR[Math.floor(r() * HAIR.length)];
      const schoen = SCHOEN[Math.floor(r() * SCHOEN.length)];
      const kleuren = { shirt, broek: pants, huid: skin, haar: hair, schoen };
      for (const def of DELEN) {
        const mesh = this.meshes[def.naam], hex = kleuren[def.kleur];
        if (def.paar) { mesh.setColorAt(i * 2, col.setHex(hex)); mesh.setColorAt(i * 2 + 1, col.setHex(hex)); }
        else mesh.setColorAt(i, col.setHex(hex));
      }

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
        height, phase: r() * 6.28, fase: r() * 6.28, alive: true, fall: 0, respawn: 0,
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

    for (const def of DELEN) this.meshes[def.naam].instanceColor.needsUpdate = true;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion();
    this._e = new THREE.Euler(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3();
    this._w = new THREE.Quaternion();
    this._h = {};       // gewrichtshoeken van dit beeld (zie js/lichaam.js)
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

  /*
   Eén lichaam op zijn plek zetten. Elk ledemaat hangt aan het gewricht erboven:
   de onderarm aan de elleboog, de hand aan de pols, de schoen aan de enkel. Alle
   gewrichten draaien om dezelfde as (de x-as van het lichaam), dus de stand van
   een ledemaat is gewoon de som van de hoeken erboven — en dat scheelt een hoop
   quaternionen vermenigvuldigen bij honderddertig mensen per beeld.
  */
  zetLichaam(i, x, y, z, yaw, tilt, h, H) {
    const m = this._m, q = this._q, e = this._e, v = this._v, sc = this._s, w = this._w;
    sc.set(h, h, h);
    const zet = (mesh, nr, ox, oy, oz, hoek) => {
      e.set(tilt + hoek, yaw, 0, 'YXZ'); q.setFromEuler(e);
      e.set(tilt, yaw, 0, 'YXZ'); w.setFromEuler(e);
      v.set(ox * h, oy * h, oz * h).applyQuaternion(w);
      m.compose(v.set(x + v.x, y + v.y, z + v.z), q, sc);
      mesh.setMatrixAt(nr, m);
    };
    // romp, bekken, nek, hoofd en haar draaien alleen met het lichaam mee
    zet(this.meshes.romp, i, 0, MAAT.romp, 0, 0);
    zet(this.meshes.bekken, i, 0, MAAT.bekken, 0, 0);
    zet(this.meshes.nek, i, 0, MAAT.nek, 0, 0);
    zet(this.meshes.hoofd, i, 0, MAAT.hoofd, 0, 0);
    zet(this.meshes.haar, i, 0, MAAT.hoofd + 0.020, 0, 0);
    // armen en benen, links (2i) en rechts (2i+1)
    for (const [nr, kant] of [[i * 2, 'L'], [i * 2 + 1, 'R']]) {
      const sx = kant === 'L' ? -1 : 1;
      const a1 = H['schouder' + kant], a2 = a1 + H['elleboog' + kant];
      const sxa = sx * SCHOUDER_X, sy = MAAT.schouder;
      zet(this.meshes.bovenarm, nr, sxa, sy, 0, a1);
      const ex = sxa, ey = sy - MAAT.bovenarm * Math.cos(a1), ez = -MAAT.bovenarm * Math.sin(a1);
      zet(this.meshes.onderarm, nr, ex, ey, ez, a2);
      zet(this.meshes.hand, nr, ex - 0, ey - MAAT.onderarm * Math.cos(a2), ez - MAAT.onderarm * Math.sin(a2), a2);
      const b1 = H['heup' + kant], b2 = b1 - H['knie' + kant], b3 = b2 + H['enkel' + kant];
      const hx = sx * MAAT.heupX, hy = MAAT.heup;
      zet(this.meshes.bovenbeen, nr, hx, hy, 0, b1);
      const kx = hx, ky = hy - MAAT.bovenbeen * Math.cos(b1), kz = -MAAT.bovenbeen * Math.sin(b1);
      zet(this.meshes.onderbeen, nr, kx, ky, kz, b2);
      zet(this.meshes.schoen, nr, kx, ky - MAAT.onderbeen * Math.cos(b2), kz - MAAT.onderbeen * Math.sin(b2), b3);
    }
  }

  update(dt, time) {
    const m = this._m, q = this._q, e = this._e, v = this._v, sc = this._s;
    for (let i = 0; i < this.people.length; i++) {
      const p = this.people[i];
      // loopt hij, en hoe hard? de pas hangt daaraan
      let loopt = false, renDeel = 0;
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
        loopt = true; renDeel = rent ? 1 : 0.25;
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
        loopt = true;
        renDeel = Math.max(0, Math.min(1, (p.vNu - 1.6) / 3.2));
      }
      /*
       De pas telt door met de tijd in plaats van hem uit `time` te berekenen:
       verandert het tempo, dan versnelt de pas mee zonder te verspringen.
      */
      const cadans = p.fietst ? 2.4 + p.vNu * 0.42 : 2.6 + p.vNu * 1.9;
      if (loopt) p.fase += dt * cadans / p.height;
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
      // bijna overal nul; op het viaduct loopt de stoep meters omhoog
      const gy = grondHoogte(p.x, p.z);
      const dood = !p.alive;
      // omvallen: naar achteren kantelen en wegzakken
      const tilt = (dood ? -p.fall * Math.PI / 2 : 0) + (p.fietst && !dood ? 0.30 : 0);
      // op de fiets zit je hoger
      const yLift = (dood ? p.fall * 0.3 : 0) + (p.fietst && !dood ? 0.42 : 0);
      if (p.fietst) {
        e.set(dood ? tilt : 0, p.yaw, 0, 'YXZ'); q.setFromEuler(e);
        m.compose(v.set(p.x, gy + (dood ? 0.1 : 0), p.z), q, sc.set(h, h, h));
        this.fiets.setMatrixAt(i, m);
      } else {
        m.makeScale(0, 0, 0);
        this.fiets.setMatrixAt(i, m);
      }
      // de stand van alle gewrichten
      const H = this._h;
      if (dood) loopHouding(0, false, 0, H);
      else if (p.fietst) fietsHouding(p.fase, H);
      else loopHouding(p.fase, loopt, renDeel, H);
      this.zetLichaam(i, p.x, gy + yLift + (dood ? 0 : H.wip * h), p.z, p.yaw, tilt, h, H);
      p.wip = H.wip;
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

    for (const def of DELEN) this.meshes[def.naam].instanceMatrix.needsUpdate = true;
    this.fiets.instanceMatrix.needsUpdate = true;
  }

  // raycast-doelen: de instanced meshes zelf
  get targets() { return Object.values(this.meshes); }

  hit(obj, instanceId) {
    if (instanceId == null) return false;
    // armen, benen en schoenen zitten met twee instanties per persoon in één
    // mesh (links en rechts), dus dan is het instantienummer het dubbele
    const nr = obj && obj.userData && obj.userData.paar ? instanceId >> 1 : instanceId;
    const p = this.people[nr];
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
