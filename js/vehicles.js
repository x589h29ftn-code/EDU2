// Auto's: geparkeerd, bestuurbaar en verkeer op de N7 en in de wijk.
import * as THREE from 'three';
import { resolveCollisions, pointInWater } from './world.js';
import { HIGHWAY, ROADS, toWorld } from './data.js';
import { rng } from './textures.js';
import { makeCar } from './carmodel.js';
import { KAART } from './kaartwereld.js';

const COLORS = [0x1c1e24, 0xd8d9dc, 0x8a8d93, 0x2a3f8f, 0x9c1f1f, 0xffffff, 0x3e3a36, 0x2f6b3a, 0x5b6470, 0xc9c1a8];

export class Vehicles {
  constructor(scene, parkSpots) {
    this.scene = scene;
    this.cars = [];   // {mesh,x,z,yaw,speed,driveable}
    this.traffic = [];
    this.duwen = [];  // geparkeerde auto's die een klap kregen en uitrollen
    const r = rng(2024);
    for (const s of parkSpots) {
      const kind = r() < 0.15 ? 'van' : 'hatch';
      const kleur = COLORS[Math.floor(r() * COLORS.length)];
      const mesh = makeCar(kleur, kind);
      const car = { mesh, x: s.x, z: s.z, yaw: s.yaw, speed: 0, steer: 0, driveable: true, hp: 100, soort: kind, kleur, breedte: kind === 'van' ? 1.90 : 1.78 };
      mesh.position.set(s.x, 0, s.z); mesh.rotation.y = s.yaw;
      scene.add(mesh); this.cars.push(car);
    }
    // verkeer N7 (beide richtingen). Met de kaart uit de BGT zijn de twee
    // rijbanen van de N7 losse assen; elke as krijgt verkeer in één richting.
    const n7 = KAART ? KAART.wegassen.filter(w => w.naam === 'N7' && w.w > 6 && w.lengte > 150).map(w => w.pts.map(p => new THREE.Vector2(p[0], p[1]))) : [];
    const hp = n7.length ? null : HIGHWAY.pts.map(p => { const [x, z] = toWorld(p[0], p[1]); return new THREE.Vector2(x, z); });
    for (let i = 0; i < 14; i++) {
      const dir = i % 2 ? 1 : -1;
      const lane = (i % 4 < 2) ? 2.1 : 6.2;
      const mesh = makeCar(COLORS[Math.floor(r() * COLORS.length)], r() < 0.3 ? 'van' : 'hatch');
      scene.add(mesh);
      if (n7.length) {
        const path = n7[i % n7.length];
        this.traffic.push({ mesh, path, t: r() * (path.length - 1), dir: (i % n7.length) ? -1 : 1, lane: (i % 4 < 2) ? 1.6 : -1.6, speed: 22 + r() * 8, y: 0.1 });
      } else this.traffic.push({ mesh, path: hp, t: r() * (hp.length - 1), dir, lane, speed: 22 + r() * 8, y: 0.6 });
    }
    // wijkverkeer: langzame auto's op Molenkrite, Jasker, Monnikmolen, De Wieken
    const namen = ['Molenkrite', 'Jasker', 'Monnikmolen', 'De Wieken', 'de Wieken', 'Buitenroede', 'Bonkelaar'];
    const local = KAART
      ? KAART.wegassen.filter(w => w.drive && namen.includes(w.naam) && w.lengte > 80).sort((a, b) => b.lengte - a.lengte).slice(0, 8).map(w => ({ pts: w.pts.map(p => new THREE.Vector2(p[0], p[1])) }))
      : ROADS.filter(rd => namen.includes(rd.name) && rd.pts.length > 3).map(rd => ({ pts: rd.pts.map(p => { const [x, z] = toWorld(p[0], p[1]); return new THREE.Vector2(x, z); }) }));
    for (let i = 0; i < 6 && local.length; i++) {
      const rd = local[i % local.length];
      const path = rd.pts;
      const mesh = makeCar(COLORS[Math.floor(r() * COLORS.length)]);
      scene.add(mesh);
      this.traffic.push({ mesh, path, t: r() * (path.length - 1), dir: 1, lane: 1.4, speed: 6 + r() * 2, y: 0.1, bounce: true });
    }
  }

  nearestDriveable(x, z, maxD = 3.0) {
    let best = null, bd = maxD;
    for (const c of this.cars) {
      if (!c.driveable) continue;
      const d = Math.hypot(c.x - x, c.z - z) - (c.instap || 1.2);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  /*
   Een voertuig neerzetten dat niet uit de kaart komt, bijvoorbeeld de
   vrachtwagen op het RWZI-terrein (zie js/verhaal.js).
   soort: 'hatch', 'van' of 'truck'. Een bakwagen is zeven meter lang, dus hij
   krijgt bredere botsingscirkels, een hogere stoel en een instapafstand die bij
   zijn maat past.
  */
  voegToe({ x, z, yaw = 0, soort = 'hatch', kleur = 0xd8d9dc, driveable = true }) {
    const mesh = makeCar(kleur, soort, true);
    mesh.position.set(x, 0, z); mesh.rotation.y = yaw;
    this.scene.add(mesh);
    const truck = soort === 'truck';
    const car = {
      mesh, x, z, yaw, speed: 0, steer: 0, driveable, hp: 100, soort, kleur,
      as: truck ? 2.6 : 1.4, botsRadius: truck ? 1.15 : 0.95,
      instap: truck ? 2.4 : 1.2,
      stoel: truck ? { x: -0.55, y: 2.15, z: -2.3 } : null,
      topSnelheid: truck ? 16 : 24,
      breedte: truck ? 2.35 : 1.78,
    };
    this.cars.push(car);
    return car;
  }

  /*
   Een geparkeerde auto klaarmaken om in te rijden. De 329 auto's in de wijk
   staan er in de zuinige uitvoering (zeven meshes); de auto waar je in stapt
   krijgt hier eenmalig het model met losse wielen, remlichten en een
   carrosserie die kan overhellen. Dat scheelt zo'n tweeduizend draw calls ten
   opzichte van iedereen die uitvoering geven.
  */
  maakBestuurbaar(car) {
    if (!car || car.mesh.userData.wielen) return car;
    const nieuw = makeCar(car.kleur ?? car.mesh.children[0].material.color.getHex(), car.soort || 'hatch', true);
    nieuw.position.set(car.x, 0, car.z);
    nieuw.rotation.y = car.yaw;
    nieuw.visible = car.mesh.visible;
    this.scene.remove(car.mesh);
    this.scene.add(nieuw);
    car.mesh = nieuw;
    return car;
  }

  /*
   Auto rijden. Nog steeds een arcade-model, maar met de dingen die je bij het
   rijden voelt:

     - gas geven trekt af naarmate je sneller gaat, en op de rem gaat het harder
       dan uitrollen; los gas is motorrem plus luchtweerstand;
     - de stuuruitslag wordt kleiner naarmate je harder rijdt, anders is een auto
       op snelheid onbestuurbaar;
     - de auto rijdt niet precies waar zijn neus wijst: de rijrichting loopt er
       iets achteraan. Met de handrem loopt hij veel verder achter en glijdt de
       auto de bocht uit;
     - de carrosserie helt over in de bocht, duikt bij het remmen en gaat achter
       zitten bij het optrekken; de voorwielen sturen mee en alle wielen rollen;
     - de remlichten branden als je remt of de handrem trekt, de
       achteruitrijlichten als je achteruit gaat.

   `raak` is een terugroep om voetgangers aan te rijden (zie js/main.js): hij
   krijgt de plek, de straal en de snelheid en geeft terug hoeveel mensen er
   geraakt zijn.
  */
  drive(car, keys, dt, raak = null) {
    const gas = !!(keys.KeyW || keys.ArrowUp);
    const rem = !!(keys.KeyS || keys.ArrowDown);
    const hand = !!keys.Space;
    const top = car.topSnelheid || 24, achteruitTop = -(top * 0.28);
    const wielbasis = (car.as || 1.4) * 2;

    // ---- sturen: bij stilstand vol, op snelheid nog een kwart ----
    let doel = 0;
    if (keys.KeyA || keys.ArrowLeft) doel = 1;
    if (keys.KeyD || keys.ArrowRight) doel = -1;
    const maxStuur = 0.60 * (0.26 + 0.74 / (1 + Math.abs(car.speed) / 8));
    car.steer += (doel * maxStuur - car.steer) * Math.min(1, dt * 8);

    // ---- motor, rem en rolweerstand ----
    const v = car.speed;
    if (gas && v < -0.4) car.speed += 18 * dt;                       // eerst afremmen
    else if (gas) car.speed += 9.5 * (1 - Math.max(0, v) / top) * dt;
    else if (rem && v > 0.4) car.speed -= 15 * dt;                   // remmen
    else if (rem) car.speed -= 6 * dt;                               // achteruit
    else car.speed -= Math.sign(v) * Math.min(Math.abs(v), 2.4 * dt); // motorrem
    if (hand) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 9 * dt);
    car.speed -= v * Math.abs(v) * 0.0012 * dt;                      // luchtweerstand
    car.speed = Math.max(achteruitTop, Math.min(top, car.speed));
    if (Math.abs(car.speed) < 0.03 && !gas && !rem) car.speed = 0;

    // ---- koers ----
    const vorigeYaw = car.yaw;
    if (Math.abs(car.speed) > 0.02) car.yaw += Math.tan(car.steer) * car.speed * dt / wielbasis;
    // de rijrichting loopt achter op de neus; met de handrem breekt de kont uit
    if (car.rij === undefined) car.rij = car.yaw;
    let verschil = car.yaw - car.rij;
    while (verschil > Math.PI) verschil -= Math.PI * 2;
    while (verschil < -Math.PI) verschil += Math.PI * 2;
    const grip = hand ? 1.5 : 9;
    car.rij += verschil * Math.min(1, dt * grip);
    car.slip = verschil;

    const nx = car.x - Math.sin(car.rij) * car.speed * dt;
    const nz = car.z - Math.cos(car.rij) * car.speed * dt;

    // ---- botsingen: drie cirkels langs de auto ----
    let ok = true;
    const fx = -Math.sin(car.yaw), fz = -Math.cos(car.yaw);
    const as = car.as || 1.4, radius = car.botsRadius || 0.95;
    let cx = nx, cz = nz;
    for (const off of [-as, 0, as]) {
      const px = cx + fx * off, pz = cz + fz * off;
      const [rx, rz] = resolveCollisions(px, pz, radius, 3.5);
      if (rx !== px || rz !== pz) { cx += rx - px; cz += rz - pz; ok = false; }
    }
    if (pointInWater(cx, cz)) { cx = car.x; cz = car.z; ok = false; }

    // ---- en tegen andere auto's, die net zo goed in de weg staan ----
    const blik = this.botsAutos(car, cx, cz);
    if (blik.raak) { cx = blik.x; cz = blik.z; ok = false; }

    if (!ok) { car.speed *= 0.25; car.rij = car.yaw; }
    car.x = cx; car.z = cz;

    // ---- iemand aanrijden ----
    if (raak && Math.abs(car.speed) > 1.6) {
      let n = 0;
      for (const off of [-as * 0.9, 0, as * 0.9]) n += raak(cx + fx * off, cz + fz * off, radius + 0.2, car.speed) || 0;
      if (n) car.speed *= 0.88;
    }

    this.zetNeer(car, dt, vorigeYaw, { gas, rem, hand });
  }

  /*
   Blik tegen blik. Tot nu toe reed je dwars door de geparkeerde auto's en door
   het verkeer heen: alleen gebouwen, hekken en bomen hielden je tegen. Elke
   auto wordt hier als drie cirkels langs zijn lengteas gezien — dezelfde
   indeling als bij de botsingen met de omgeving — en wat overlapt, wordt uit
   elkaar geduwd.

   Alleen wat binnen twaalf meter staat doet mee, anders kost het bij 329
   geparkeerde auto's te veel. Een geparkeerde auto die je hard raakt schuift
   een stukje weg (en niet een gebouw in: de duw gaat langs `resolveCollisions`),
   het rijdende verkeer en de bakwagen staan muurvast.

   Geeft de vrijgeduwde plek terug plus `raak`: hoeveel meter er overlapte.
  */
  botsAutos(car, cx, cz) {
    const as = car.as || 1.4, radius = car.botsRadius || 0.95;
    const fx = -Math.sin(car.yaw), fz = -Math.cos(car.yaw);
    const buurt = [];
    for (const c of this.cars) {
      if (c === car || !c.mesh.visible) continue;
      if (Math.abs(c.x - cx) > 12 || Math.abs(c.z - cz) > 12) continue;
      buurt.push({ x: c.x, z: c.z, yaw: c.yaw, as: c.as || 1.4, r: c.botsRadius || 0.95, auto: c });
    }
    for (const t of this.traffic) {
      const p = t.mesh.position;
      if (Math.abs(p.x - cx) > 12 || Math.abs(p.z - cz) > 12) continue;
      buurt.push({ x: p.x, z: p.z, yaw: t.mesh.rotation.y, as: 1.4, r: 0.95 });
    }
    let raak = 0;
    const hard = Math.abs(car.speed) > 3.5;
    // twee rondjes, zodat een auto die tussen twee andere klem komt er ook uit komt
    for (let ronde = 0; ronde < 2; ronde++) {
      for (const o of buurt) {
        const ox = -Math.sin(o.yaw), oz = -Math.cos(o.yaw);
        const minAf = radius + o.r;
        for (const a of [-as, 0, as]) {
          for (const b of [-o.as, 0, o.as]) {
            let dx = (cx + fx * a) - (o.x + ox * b), dz = (cz + fz * a) - (o.z + oz * b);
            let d = Math.hypot(dx, dz);
            if (d >= minAf) continue;
            if (d < 1e-4) { dx = -fx; dz = -fz; d = 1; }
            const duw = minAf - d;
            raak = Math.max(raak, duw);
            cx += (dx / d) * duw;
            cz += (dz / d) * duw;
            // een geparkeerde auto die je hard raakt rolt een stukje weg
            if (o.auto && o.auto.speed === 0 && hard) {
              const v = Math.min(3.5, Math.abs(car.speed) * 0.35);
              o.auto.duwV = { x: -(dx / d) * v, z: -(dz / d) * v };
              if (!this.duwen.includes(o.auto)) this.duwen.push(o.auto);
            }
          }
        }
      }
    }
    return { x: cx, z: cz, raak };
  }

  // Aangereden auto's rollen uit. Ze zitten niet in de rijnatuurkunde, dus ze
  // krijgen hier een snelheid mee die in een halve meter wegvalt; gebouwen en
  // hekken houden ze net zo goed tegen als de speler.
  rolUit(dt) {
    for (let i = this.duwen.length - 1; i >= 0; i--) {
      const c = this.duwen[i], v = c.duwV;
      if (!v) { this.duwen.splice(i, 1); continue; }
      const [rx, rz] = resolveCollisions(c.x + v.x * dt, c.z + v.z * dt, c.botsRadius || 0.95, 3.5);
      c.x = rx; c.z = rz;
      c.mesh.position.set(rx, c.mesh.position.y, rz);
      const rem = Math.max(0, 1 - 3.5 * dt);
      v.x *= rem; v.z *= rem;
      if (Math.hypot(v.x, v.z) < 0.15) { c.duwV = null; this.duwen.splice(i, 1); }
    }
  }

  // De auto op zijn plek zetten en het model laten meebewegen.
  zetNeer(car, dt, vorigeYaw, invoer = {}) {
    const m = car.mesh;
    m.position.set(car.x, 0, car.z);
    m.rotation.y = car.yaw;
    const u = m.userData;
    if (!u || !u.wielen) return;
    // wielen: de voorste sturen, alle vier rollen mee met de afgelegde weg
    const rol = car.speed * dt / u.R;
    for (const w of u.wielen) {
      if (w.stuur) w.groep.rotation.y += (car.steer - w.groep.rotation.y) * Math.min(1, dt * 12);
      w.band.rotation.x -= rol;
    }
    // carrosserie: overhellen in de bocht, duiken bij het remmen
    const draai = dt > 0 ? (car.yaw - vorigeYaw) / dt : 0;
    const zijwaarts = draai * car.speed;                       // dwarsversnelling
    const langs = (car.speed - (car.vorigeSnelheid ?? car.speed)) / Math.max(dt, 1e-3);
    car.vorigeSnelheid = car.speed;
    const rolDoel = Math.max(-0.075, Math.min(0.075, zijwaarts * 0.011));
    const duikDoel = Math.max(-0.05, Math.min(0.05, -langs * 0.004));
    u.bak.rotation.z += (rolDoel - u.bak.rotation.z) * Math.min(1, dt * 6);
    u.bak.rotation.x += (duikDoel - u.bak.rotation.x) * Math.min(1, dt * 6);
    if (u.rem) u.rem.visible = !!(invoer.hand || (invoer.rem && car.speed > 0.2));
    if (u.achteruit) u.achteruit.visible = car.speed < -0.2;
  }

  // Verkeer. Auto's kijken een stukje vooruit en remmen voor elkaar, voor de
  // speler en voor overstekende voetgangers; daarna trekken ze weer op.
  updateTraffic(dt, speler = null, voetgangers = null) {
    this.rolUit(dt);
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

  // Een treffer van het pistool. Het model is genest (carrosserie en wielen in
  // eigen groepen), dus zoek van de geraakte mesh omhoog naar de auto.
  hit(mesh) {
    for (let p = mesh; p; p = p.parent) {
      for (const c of this.cars) if (c.mesh === p) { c.hp -= 25; return c; }
    }
    return null;
  }
}
