// Auto's: geparkeerd, bestuurbaar en verkeer op de N7 en in de wijk.
import * as THREE from 'three';
import { resolveCollisions, pointInWater, grondHoogte, zichtVrij } from './world.js';
import { HIGHWAY, ROADS, toWorld } from './data.js';
import { rng } from './textures.js';
import { makeCar, maakAutoStapel } from './carmodel.js';
import { KAART } from './kaartwereld.js';

/*
 Hoe steil ligt de weg hier? Peil twee meter voor en achter de auto; op vlak
 terrein levert dat nul op en verandert er niets.
*/
function helling(x, z, yaw, y) {
  const dx = -Math.sin(yaw) * 2, dz = -Math.cos(yaw) * 2;
  const voor = grondHoogte(x + dx, z + dz, y + 0.9), achter = grondHoogte(x - dx, z - dz, y + 0.9);
  return Math.atan2(voor - achter, 4);
}

/*
 Rijden twee auto's op dezelfde hoogte? Op het viaduct rijdt de een over de
 rondweg heen terwijl de ander eronder doorrijdt: zonder deze test botsen ze op
 elkaar terwijl er vijf meter lucht tussen zit. `null` = onbekend, dan telt hij
 mee zoals vroeger.
*/
function zelfdeLaag(a, b) {
  if (a == null || b == null) return true;
  return Math.abs(a - b) < 2.5;
}

// Eén stapel geparkeerde auto's per soort én per tegel van deze maat. 480 m:
// groter dan de tegels van de ondergrond, want een stapel is zeven meshes. Op
// 240 m culde het iets beter maar kostte het ruim vijfhonderd draw calls extra,
// en daar is een telefoon gevoeliger voor.
const AUTOTEGEL = 480;
const AUTOTEGEL_HALF = AUTOTEGEL * 0.71;   // halve diagonaal
// het midden van de tegel uit een stapelsleutel "soort|i:j"
function tegelMidden(sleutel) {
  const [i, j] = sleutel.split('|')[1].split(':').map(Number);
  return { x: (i + 0.5) * AUTOTEGEL, z: (j + 0.5) * AUTOTEGEL };
}

const COLORS = [0x1c1e24, 0xd8d9dc, 0x8a8d93, 0x2a3f8f, 0x9c1f1f, 0xffffff, 0x3e3a36, 0x2f6b3a, 0x5b6470, 0xc9c1a8];

export class Vehicles {
  constructor(scene, parkSpots) {
    this.scene = scene;
    this.cars = [];   // {mesh|inst,x,z,yaw,speed,driveable}
    this.knallen = [];   // lopende vuurballen van opgeblazen auto's
    this.traffic = [];
    this.duwen = [];  // geparkeerde auto's die een klap kregen en uitrollen
    const r = rng(2024);
    /*
     De geparkeerde auto's staan als instanced meshes in de wereld: zeven per
     soort in plaats van zeven per auto. Ze hebben dus geen eigen `mesh`, maar
     een `inst` met de stapel en hun plek erin; `zetInstantie` schrijft hun
     matrix. Stap je in, dan wordt die instantie op schaal nul gezet en komt het
     losse model met wielen ervoor in de plaats (zie `maakBestuurbaar`).
    */
    /*
     Eén stapel per soort én per tegel van 240 m. Er was er één per soort voor de
     hele wereld, en zo'n instanced mesh valt nooit buiten beeld: met bijna
     achttienhonderd geparkeerde auto's gingen die elk beeld naar de GPU, ook die
     in IJlst. De afstandsregel in `lod` zette ze wel op schaal nul, maar een
     instantie op nul wordt nog steeds verwerkt. Per tegel laat frustum culling
     het meeste vallen, en `lod` blijft doen wat hij deed voor wat overblijft.
    */
    const soorten = parkSpots.map(() => (r() < 0.15 ? 'van' : 'hatch'));
    // 480 m: groter dan de tegels van de ondergrond, want een stapel is zeven
    // meshes. Op 240 m culde het iets beter maar kostte het ruim vijfhonderd
    // draw calls extra, en daar is een telefoon gevoeliger voor.
    const sleutelVan = (soort, x, z) => `${soort}|${Math.floor(x / AUTOTEGEL)}:${Math.floor(z / AUTOTEGEL)}`;
    this.stapels = {};
    const tel = new Map();
    parkSpots.forEach((s, i) => {
      const k = sleutelVan(soorten[i], s.x, s.z);
      tel.set(k, (tel.get(k) || 0) + 1);
    });
    for (const [k, n] of tel) {
      const stapel = maakAutoStapel(k.split('|')[0], n);
      // `hit` zoekt de stapel op via dit merkteken; dat was de soort, maar er is
      // er nu een per soort én per tegel
      for (const m of stapel.meshes) { m.userData.autoStapel = k; scene.add(m); }
      this.stapels[k] = { stapel, n: 0, autos: [] };
    }
    parkSpots.forEach((s, i) => {
      const kind = soorten[i];
      const kleur = COLORS[Math.floor(r() * COLORS.length)];
      const sleutel = sleutelVan(kind, s.x, s.z);
      const stap = this.stapels[sleutel];
      const idx = stap.n++;
      const car = {
        mesh: null, inst: { sleutel, soort: kind, i: idx }, zichtbaar: true,
        x: s.x, z: s.z, yaw: s.yaw, speed: 0, steer: 0, driveable: true, hp: 100,
        soort: kind, kleur, breedte: kind === 'van' ? 1.90 : 1.78,
        // waar hij geparkeerd stond, zodat een opgeruimd wrak terugkomt
        start: { x: s.x, z: s.z, yaw: s.yaw },
      };
      stap.autos[idx] = car;
      stap.stapel.zet(idx, s.x, s.z, s.yaw, true);
      stap.stapel.kleur(idx, kleur);
      this.cars.push(car);
    });
    for (const k of Object.keys(this.stapels)) {
      this.stapels[k].stapel.klaar();
      for (const m of this.stapels[k].stapel.meshes) m.computeBoundingSphere();
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
      // `lokaal` merkt de wijkauto's, zodat `vulBuurtAan` ze kan laten meeverhuizen
      this.traffic.push({ mesh, path, t: r() * (path.length - 1), dir: 1, lane: 1.4, speed: 6 + r() * 2, y: 0.1, bounce: true, lokaal: true });
    }
    /*
     En álle rijbanen van de wereld als voorraad om die wijkauto's op te zetten.
     Het wijkverkeer reed alleen op acht assen in Tinga (Molenkrite, Jasker,
     Monnikmolen, De Wieken, Buitenroede, Bonkelaar), dus in IJlst, Duinterpen en
     langs de Lemmerweg was er geen enkele rijdende auto: gemeten nul binnen
     tweehonderd meter. Ze verhuizen nu mee met de speler.
    */
    this.rijbanen = KAART
      ? KAART.wegassen.filter(w => w.drive && w.naam !== 'N7' && w.naam !== 'Afrit 21' && w.lengte > 60)
        .map(w => w.pts.map(q => new THREE.Vector2(q[0], q[1])))
      : [];
  }

  /*
   Een wijkauto naar de buurt van de speler verhuizen. Zelfde reden als bij de
   voetgangers in js/npc.js: het aantal blijft gelijk, alleen staan ze waar je
   bent. Er gaat hoogstens één per seconde, en een auto verhuist alleen als hij
   ver genoeg weg is om niet gezien te worden.
  */
  vulBuurtAan(camX, camZ, dt) {
    if (!this.rijbanen || !this.rijbanen.length) return;
    const NABIJ = 260, VER = 520, DOEL = 4;
    this._vulKlok = (this._vulKlok || 0) + dt;
    if (this._vulKlok < 1) return;
    this._vulKlok = 0;
    const lokaal = this.traffic.filter(t => t.lokaal && t._pos);
    if (!lokaal.length) return;
    let nabij = 0, verste = null, vd = VER;
    for (const t of lokaal) {
      const d = Math.hypot(t._pos.x - camX, t._pos.y - camZ);
      if (d < NABIJ) nabij++;
      if (d > vd) { vd = d; verste = t; }
    }
    if (nabij >= DOEL || !verste) return;
    // een rijbaan zoeken die in de band om de speler ligt; net als bij de
    // voetgangers mag het dichterbij als er een gebouw tussen staat
    const DEKKING = 80, OPEN = 130, BUITEN = 250;
    let beste = null, besteScore = -1;
    for (let poging = 0; poging < 30; poging++) {
      const pad = this.rijbanen[Math.floor(Math.random() * this.rijbanen.length)];
      const k = Math.floor(Math.random() * pad.length);
      const q = pad[k];
      const d = Math.hypot(q.x - camX, q.y - camZ);
      if (d < DEKKING || d > BUITEN) continue;
      const uitZicht = !zichtVrij(camX, camZ, q.x, q.y, 1.4);
      if (!uitZicht && d < OPEN) continue;
      const score = (uitZicht ? 1000 : 0) + (BUITEN - d);
      if (score > besteScore) { besteScore = score; beste = { pad, k }; }
    }
    if (!beste) return;
    verste.path = beste.pad;
    verste.t = Math.max(0, Math.min(beste.pad.length - 1.001, beste.k));
    verste.dir = Math.random() < 0.5 ? 1 : -1;
    verste.snelheid = 0; verste.doel = verste.speed;
    verste._pos = null; verste._dir = null;
  }

  // De matrix van een geparkeerde auto in zijn stapel bijwerken.
  zetInstantie(car) {
    if (!car.inst) return;
    const stap = this.stapels[car.inst.sleutel];
    const zichtbaar = car.zichtbaar !== false && car.getekend !== false;
    stap.stapel.zet(car.inst.i, car.x, car.z, car.yaw, zichtbaar);
    stap.stapel.klaar();
  }

  // Staat deze auto in beeld? Een geparkeerde auto heeft geen eigen mesh meer.
  isZichtbaar(car) { return car.mesh ? car.mesh.visible : car.zichtbaar !== false; }

  /*
   Geparkeerde auto's op afstand uitzetten.

   De stapels staan per tegel, dus het meeste valt al weg door frustum culling.
   Wat er dan nog vóór je ligt maar ver weg is, is nog een blokje van een paar
   beeldpunten: verder dan `zicht` meter zetten we die op schaal nul.
   Dit loopt mee met de LOD-klok in js/main.js (vier keer per seconde), niet elk
   beeld.
  */
  lod(camX, camZ, zicht = 170) {
    const q = zicht * zicht;
    for (const k of Object.keys(this.stapels)) {
      const stap = this.stapels[k];
      /*
       Eerst de hele stapel: ligt de tegel voorbij het zicht, dan gaan de zeven
       meshes uit. Frustum culling haalt alleen de tegels weg die achter je
       liggen; wat vóór je ligt tot aan de mist van negenhonderd meter werd wél
       getekend, en met 664 driehoeken per carrosserie was dat op het zwaarste
       standpunt 2,06 miljoen driehoeken — meer dan de helft van het hele beeld.
       De instanties op schaal nul zetten hielp daar niet tegen: een instantie
       op nul gaat nog steeds door de vertex shader.
      */
      const ver = stap.ver !== undefined ? stap.ver : (stap.ver = tegelMidden(k));
      const tdx = ver.x - camX, tdz = ver.z - camZ;
      const tegelDicht = tdx * tdx + tdz * tdz < (zicht + AUTOTEGEL_HALF) * (zicht + AUTOTEGEL_HALF);
      if (stap.aan !== tegelDicht) {
        stap.aan = tegelDicht;
        for (const m of stap.stapel.meshes) m.visible = tegelDicht;
      }
      if (!tegelDicht) continue;
      let veranderd = false;
      for (const car of stap.autos) {
        if (!car || car.mesh) continue;                    // deze rijdt, die heeft zijn eigen model
        const dx = car.x - camX, dz = car.z - camZ;
        const dichtbij = dx * dx + dz * dz < q;
        const wil = dichtbij && car.zichtbaar !== false;
        if (car.getekend === wil) continue;
        car.getekend = wil;
        stap.stapel.zet(car.inst.i, car.x, car.z, car.yaw, wil);
        veranderd = true;
      }
      if (veranderd) stap.stapel.klaar();
    }
  }

  // Alle auto's aan of uit: binnen in een huis en in het bovenaanzicht hoort de
  // wijk leeg te zijn (zie js/main.js en js/editor.js).
  zichtbaarheid(aan) {
    for (const c of this.cars) {
      if (c.mesh) c.mesh.visible = aan;
      else if (c.zichtbaar !== aan) { c.zichtbaar = aan; c.getekend = aan; this.zetInstantie(c); }
    }
    for (const t of this.traffic) t.mesh.visible = aan;
  }

  // De instanced meshes zelf, om op te schieten (raycast) — zie js/main.js.
  doelen() {
    const uit = [];
    for (const k of Object.keys(this.stapels)) uit.push(...this.stapels[k].stapel.meshes);
    for (const c of this.cars) if (c.mesh) uit.push(c.mesh);
    return uit;
  }

  /*
   Een punt uit de auto's duwen. De speler te voet zat alleen in
   `resolveCollisions` uit js/world.js, en daar staan alleen de vaste dingen in
   — dus je liep dwars door elke geparkeerde auto heen. Een auto is hier
   dezelfde rij van drie cirkels langs zijn as als in `botsAutos`: dat past
   beter om een auto heen dan één grote cirkel, en het is precies wat de auto's
   onderling al gebruiken.

   `negeer` is de auto waar je zelf in zit. Levert [x, z] terug.
  */
  duwUit(x, z, radius = 0.35, negeer = null, y = null) {
    let px = x, pz = z;
    const raak = [];
    for (const c of this.cars) {
      if (c === negeer || !this.isZichtbaar(c)) continue;
      if (Math.abs(c.x - px) > 8 || Math.abs(c.z - pz) > 8) continue;
      if (!zelfdeLaag(y, c.mesh ? c.mesh.position.y : 0)) continue;
      raak.push({ x: c.x, z: c.z, yaw: c.yaw, as: c.as || 1.4, r: c.botsRadius || 0.95 });
    }
    for (const t of this.traffic) {
      const p = t.mesh.position;
      if (Math.abs(p.x - px) > 8 || Math.abs(p.z - pz) > 8) continue;
      if (!zelfdeLaag(y, p.y)) continue;
      raak.push({ x: p.x, z: p.z, yaw: t.mesh.rotation.y, as: 1.4, r: 0.95 });
    }
    if (!raak.length) return [px, pz];
    // twee rondjes, zodat je ook tussen twee auto's in weer vrijkomt
    for (let ronde = 0; ronde < 2; ronde++) {
      for (const o of raak) {
        const ox = -Math.sin(o.yaw), oz = -Math.cos(o.yaw);
        const minAf = radius + o.r;
        for (const b of [-o.as, 0, o.as]) {
          let dx = px - (o.x + ox * b), dz = pz - (o.z + oz * b);
          let d = Math.hypot(dx, dz);
          if (d >= minAf) continue;
          if (d < 1e-4) { dx = 1; dz = 0; d = 1; }
          const duw = minAf - d;
          px += (dx / d) * duw; pz += (dz / d) * duw;
        }
      }
    }
    return [px, pz];
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
      stoel: null,          // het oogpunt komt uit het model (userData.oog)
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
    if (!car || (car.mesh && car.mesh.userData.wielen)) return car;
    const zichtbaar = this.isZichtbaar(car);
    const nieuw = makeCar(car.kleur ?? 0x8a8d93, car.soort || 'hatch', true);
    nieuw.position.set(car.x, 0, car.z);
    nieuw.rotation.y = car.yaw;
    nieuw.visible = zichtbaar;
    if (car.inst) { car.zichtbaar = false; this.zetInstantie(car); }   // de instantie op schaal nul
    else if (car.mesh) this.scene.remove(car.mesh);
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
    // hoogte van de auto: de pijler onder het viaduct houdt alleen tegen wie
    // eronder rijdt, de leuning alleen wie erover rijdt
    const cy = car.mesh ? car.mesh.position.y : 0;
    let cx = nx, cz = nz;
    for (const off of [-as, 0, as]) {
      const px = cx + fx * off, pz = cz + fz * off;
      const [rx, rz] = resolveCollisions(px, pz, radius, 3.5, cy);
      if (rx !== px || rz !== pz) { cx += rx - px; cz += rz - pz; ok = false; }
    }
    if (cy < 1.5 && pointInWater(cx, cz)) { cx = car.x; cz = car.z; ok = false; }

    // ---- en tegen andere auto's, die net zo goed in de weg staan ----
    const blik = this.botsAutos(car, cx, cz);
    if (blik.raak) { cx = blik.x; cz = blik.z; ok = false; }

    /*
     Een klap. Voor de motor was dit alleen "snelheid eraf"; je zag en hoorde er
     niets van. `botsKracht` is de snelheid waarmee je erin reed, en js/main.js
     maakt daar een schok van de camera en een klap van. Hij wordt één beeld
     lang gezet en daarna weer op nul, zodat één botsing ook één klap geeft.
    */
    car.botsKracht = (!ok && Math.abs(v) > 2.2) ? Math.abs(v) : 0;
    if (!ok) { car.speed *= 0.25; car.rij = car.yaw; }
    car.x = cx; car.z = cz;

    /*
     Slippen: remsporen en bandengier. Er zijn drie manieren om rubber te laten
     liggen — de handrem, hard remmen vanaf snelheid, en dwars door een bocht
     glijden (dan loopt de rijrichting achter op de neus, `car.slip`). Samen
     geven ze `gierNiveau` tussen 0 en 1; js/main.js gebruikt dat voor het geluid
     en legt er sporen mee neer onder de achterwielen.
    */
    const snel = Math.abs(car.speed);
    let slip = Math.min(1, Math.abs(car.slip || 0) * 2.6);
    if (hand && snel > 2) slip = Math.max(slip, 0.75);
    if (rem && car.speed > 6) slip = Math.max(slip, Math.min(0.85, (car.speed - 6) / 12));
    car.gierNiveau = snel > 2.2 ? slip : 0;
    car.spoorKlok = (car.spoorKlok || 0) - dt;
    if (car.gierNiveau > 0.22 && car.spoorKlok <= 0 && this.spoor) {
      car.spoorKlok = 0.05;
      const breedte = (car.breedte || 1.7) / 2 - 0.18;
      const rx = Math.cos(car.yaw), rz = -Math.sin(car.yaw);       // dwars op de auto
      for (const kant of [-1, 1]) {
        this.spoor(cx + fx * -as * 0.85 + rx * breedte * kant,
          cz + fz * -as * 0.85 + rz * breedte * kant,
          car.rij, 0.24, Math.max(0.5, snel * 0.09), car.gierNiveau);
      }
    }

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
    const y = car.mesh ? car.mesh.position.y : 0;
    for (const c of this.cars) {
      if (c === car || !this.isZichtbaar(c)) continue;
      if (Math.abs(c.x - cx) > 12 || Math.abs(c.z - cz) > 12) continue;
      if (!zelfdeLaag(y, c.mesh ? c.mesh.position.y : 0)) continue;
      buurt.push({ x: c.x, z: c.z, yaw: c.yaw, as: c.as || 1.4, r: c.botsRadius || 0.95, auto: c });
    }
    for (const t of this.traffic) {
      const p = t.mesh.position;
      if (Math.abs(p.x - cx) > 12 || Math.abs(p.z - cz) > 12) continue;
      if (!zelfdeLaag(y, p.y)) continue;
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
      const [rx, rz] = resolveCollisions(c.x + v.x * dt, c.z + v.z * dt, c.botsRadius || 0.95, 3.5, c.mesh ? c.mesh.position.y : 0);
      c.x = rx; c.z = rz;
      if (c.mesh) c.mesh.position.set(rx, c.mesh.position.y, rz);
      else this.zetInstantie(c);
      const rem = Math.max(0, 1 - 3.5 * dt);
      v.x *= rem; v.z *= rem;
      if (Math.hypot(v.x, v.z) < 0.15) { c.duwV = null; this.duwen.splice(i, 1); }
    }
  }

  /*
   De ruiten aan- of uitzetten. Het glas is één doos per ruit met een donkere,
   bijna dekkende tint: van buiten precies goed, maar vanaf de bestuurdersstoel
   kijk je er dwars doorheen naar buiten en wordt het hele beeld grauw. Zit je
   zelf achter het stuur, dan gaan ze uit; stap je uit of ga je naar de camera
   achter de auto, dan komen ze terug.
  */
  ruiten(car, aan) {
    const g = car && car.mesh && car.mesh.userData.glas;
    if (g && g.visible !== aan) g.visible = aan;
  }

  // De auto op zijn plek zetten en het model laten meebewegen.
  zetNeer(car, dt, vorigeYaw, invoer = {}) {
    const m = car.mesh;
    /*
     Bijna overal is de grond nul, behalve op het viaduct. Daar tilt
     grondHoogte de auto op; de neus wijst omhoog door twee meter vooruit en
     achteruit te peilen. rotation.order YXZ, anders kantelt hij om de wereldas
     in plaats van om zijn eigen as.
    */
    const y = grondHoogte(car.x, car.z, m.position.y + 0.9);
    m.position.set(car.x, y, car.z);
    m.rotation.order = 'YXZ';
    m.rotation.y = car.yaw;
    m.rotation.x = helling(car.x, car.z, car.yaw, y);
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
  /*
   Rooster over de geparkeerde auto's. Die staan stil — een auto die gaat rijden
   krijgt zijn eigen model (`c.mesh`) en valt hier dan buiten — dus het rooster
   hoeft alleen opnieuw als het aantal stilstaande auto's verandert (er wordt
   een auto gestolen of opgeruimd).
  */
  parkeerRooster() {
    const stil = [];
    for (const c of this.cars) if (!c.mesh) stil.push(c);
    if (this._pRooster && this._pRoosterN === stil.length) return this._pRooster;
    this._pRoosterN = stil.length;
    const CEL = 16;
    const cellen = new Map();
    for (const c of stil) {
      const k = Math.floor(c.x / CEL) + ':' + Math.floor(c.z / CEL);
      let l = cellen.get(k); if (!l) cellen.set(k, l = []);
      l.push(c);
    }
    this._pRooster = { CEL, cellen };
    return this._pRooster;
  }

  // welke stilstaande auto's staan binnen `R` meter van (x, z)?
  parkeerNabij(x, z, R) {
    const { CEL, cellen } = this.parkeerRooster();
    const uit = [];
    for (let i = Math.floor((x - R) / CEL); i <= Math.floor((x + R) / CEL); i++)
      for (let j = Math.floor((z - R) / CEL); j <= Math.floor((z + R) / CEL); j++) {
        const l = cellen.get(i + ':' + j);
        if (l) for (const c of l) uit.push(c);
      }
    return uit;
  }

  updateTraffic(dt, speler = null, voetgangers = null, camX = null, camZ = null) {
    if (camX !== null) this.vulBuurtAan(camX, camZ, dt);
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

    // De auto's met een eigen model (gestolen of rijdend) één keer opzoeken. Het
    // aflopen van de lijst van 1781 is zelf het werk — niet `isZichtbaar` — dus
    // dit moet buiten de lus hieronder staan.
    const metModel = [];
    for (const c of this.cars) if (c.mesh) metModel.push(c);

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
      /*
       De geparkeerde auto's uit het rooster in plaats van alle 1781. Twintig
       rijdende auto's die elk de hele lijst afgingen waren 35.620 toetsen per
       beeld — met 1,14 ms de tweede grootste post in het javascript, terwijl er
       binnen de elf meter vooruitkijken maar een handjevol staat. `isZichtbaar`
       wordt nog wel per kandidaat gevraagd, dus het remmen blijft hetzelfde.
      */
      for (const c of this.parkeerNabij(t._pos.x, t._pos.y, KIJK + 2)) {
        if (this.isZichtbaar(c)) inDeWeg(c.x, c.z, 0.4);
      }
      // en de auto's met een eigen model: die rijden of zijn gestolen, staan dus
      // niet in het rooster. Die lijst is één keer per beeld gemaakt en niet per
      // rijdende auto — anders loop je alsnog twintig keer door alle 1781.
      for (const c of metModel) { if (this.isZichtbaar(c)) inDeWeg(c.x, c.z, 0.4); }
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
      const tx = p2.x + nrm2.x, tz = p2.y + nrm2.y;
      const ty = t.y + grondHoogte(tx, tz, t.mesh.position.y + 0.9);
      t.mesh.position.set(tx, ty, tz);
      t.mesh.rotation.order = 'YXZ';
      t.mesh.rotation.y = Math.atan2(-d2.x, -d2.y);
      t.mesh.rotation.x = helling(tx, tz, t.mesh.rotation.y, ty - t.y);
      if (t.remlicht) t.remlicht.visible = t.doel < t.speed * 0.6;
    }
  }

  // Een treffer van het pistool. Het model is genest (carrosserie en wielen in
  // eigen groepen), dus zoek van de geraakte mesh omhoog naar de auto.
  /*
   Een auto opblazen. Tien kogels van tien schadepunten en hij is op: de lak
   wordt roetzwart, hij komt niet meer van zijn plek en er staat een vuurbal op
   het dak die in rook opgaat. Wie er vlakbij staat voelt het ook.

   Het wrak blijft liggen: een auto die na de knal verdwijnt leest als een bug.
   De politie ruimt haar eigen wrakken op zodra de achtervolging voorbij is (zie
   js/politie.js); een gewone auto blijft staan waar hij staat.
  */
  laatOntploffen(car) {
    if (!car || car.wrak) return false;
    car.wrak = true;
    car.driveable = false;
    car.speed = 0;
    const zwart = new THREE.MeshStandardMaterial({ color: 0x1b1a18, roughness: 0.95, metalness: 0.1 });
    if (car.mesh) {
      // de oude lak bewaren, anders kan het wrak nooit meer teruggezet worden
      car.lak = [];
      car.mesh.traverse(o => { if (o.isMesh) { car.lak.push([o, o.material]); o.material = zwart; } });
    } else if (car.inst) {
      // een geparkeerde auto zit in een stapel en heeft geen eigen materiaal:
      // daar gaat de kleur van de instantie op roetzwart
      const stap = this.stapels[car.inst.sleutel];
      stap.stapel.kleur(car.inst.i, 0x1b1a18);
      this.zetInstantie(car);
    }
    // vuurbal en rook, een paar seconden
    const groep = new THREE.Group();
    groep.position.set(car.x, 0.9, car.z);
    const vuur = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffb03a, transparent: true, opacity: 0.95 }));
    const rook = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x3a3a38, transparent: true, opacity: 0.6 }));
    groep.add(vuur, rook);
    this.scene.add(groep);
    this.knallen.push({ groep, vuur, rook, t: 0 });
    return true;
  }

  /*
   De vuurballen laten uitdoven, en de wrakken opruimen. js/main.js roept dit elk
   beeld aan met de plek van de speler erbij.

   Een wrak dat er eeuwig blijft staan verandert de wijk: na een half uur spelen
   staat er overal zwart blik. Maar hem laten verdwijnen terwijl je ernaar kijkt
   leest als een fout. Dus: pas na een minuut, en pas als je er meer dan tachtig
   meter vandaan bent — dan is hij ook door de LOD al uit beeld. De auto komt
   terug als een gewone auto op zijn eigen plek, precies zoals hij begon.
  */
  werkKnallenBij(dt, px = null, pz = null) {
    for (let i = this.knallen.length - 1; i >= 0; i--) {
      const k = this.knallen[i];
      k.t += dt;
      const f = k.t / 2.6;
      k.vuur.scale.setScalar(1 + f * 2.2);
      k.vuur.material.opacity = Math.max(0, 0.95 - f * 1.6);
      k.rook.scale.setScalar(1 + f * 3.4);
      k.rook.position.y = f * 3.2;
      k.rook.material.opacity = Math.max(0, 0.6 - f * 0.6);
      if (k.t > 2.6) { this.scene.remove(k.groep); this.knallen.splice(i, 1); }
    }
    if (px == null) return;
    for (const car of this.cars) {
      if (!car.wrak) continue;
      car.wrakT = (car.wrakT || 0) + dt;
      if (car.wrakT < 60) continue;
      if (Math.hypot(car.x - px, car.z - pz) < 80) continue;
      this.herstelWrak(car);
    }
  }

  // Een uitgebrand wrak weer een gewone auto maken, op zijn eigen parkeerplek.
  herstelWrak(car) {
    car.wrak = false; car.wrakT = 0;
    car.hp = 100;
    car.driveable = true;
    car.speed = 0;
    if (car.start) { car.x = car.start.x; car.z = car.start.z; car.yaw = car.start.yaw; }
    car.rij = car.yaw;
    if (car.lak) { for (const [o, m] of car.lak) o.material = m; car.lak = null; }
    if (car.inst) {
      const stap = this.stapels[car.inst.sleutel];
      stap.stapel.kleur(car.inst.i, car.kleur);
      this.zetInstantie(car);
    }
    return true;
  }

  hit(mesh, instanceId) {
    // een geparkeerde auto zit in een stapel: het instantienummer wijst hem aan
    const sleutel = mesh && mesh.userData && mesh.userData.autoStapel;
    if (sleutel && this.stapels[sleutel] && instanceId != null) {
      const car = this.stapels[sleutel].autos[instanceId];
      // tien kogels tot hij op is; dat was vier, en dan ging een auto wel erg
      // makkelijk in vlammen op
      if (car) { car.hp -= 10; return car; }
      return null;
    }
    for (let p = mesh; p; p = p.parent) {
      for (const c of this.cars) if (c.mesh === p) { c.hp -= 10; return c; }
    }
    return null;
  }
}
