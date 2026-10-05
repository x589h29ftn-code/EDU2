// Auto's: geparkeerd, bestuurbaar en verkeer op de N7 en in de wijk.
import * as THREE from 'three';
import { resolveCollisions, pointInWater, grondHoogte, zichtVrij, breekScheidingenBij, zetZichtBlokker } from './world.js';
import { HIGHWAY, ROADS, toWorld } from './data.js';
import { rng } from './textures.js';
import { makeCar, maakAutoStapel, lakVoor, VER_VANAF } from './carmodel.js';
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
// waar een slapende auto 's nachts staat: ver buiten de wereld (zie updateTraffic)
const VER_WEG = Object.freeze(new THREE.Vector2(1e5, 1e5));
const VER_WEG_R = Object.freeze(new THREE.Vector2(1, 0));
const AUTOTEGEL_HALF = AUTOTEGEL * 0.71;   // halve diagonaal
// het midden van de tegel uit een stapelsleutel "soort|i:j"
function tegelMidden(sleutel) {
  const [i, j] = sleutel.split('|')[1].split(':').map(Number);
  return { x: (i + 0.5) * AUTOTEGEL, z: (j + 0.5) * AUTOTEGEL };
}

/*
 Lakkleuren. Er stonden er tien, waarvan drie fel (wit, knalrood, koningsblauw).
 Een Nederlandse woonstraat staat vol grijs, zilver, donkerblauw en zwart met
 hier en daar iets anders; de felle kleuren blijven erbij maar zijn nu de
 uitzondering, en er staat ook wat verschoten en stoffig tussen.
*/
/*
 Topsnelheid (m/s) en trekkracht per soort. `trek` vermenigvuldigt het gas van
 `drive`; de luchtweerstand is voor iedereen gelijk. Daardoor haalt een auto zijn
 `top` nooit helemaal: de hatchback en de BX komen op ongeveer 22 m/s (80 km/u),
 de Ferrari uit de showroom op 56 m/s, ruim 200 km/u (js/garage.js;
 `npm run garagetest` meet het).
*/
// hoeveel dwarsversnelling (m/s²) het stuur hooguit vraagt, zie `drive`
const STUUR_GRIP = 26;

/*
 Een wegas om over te rijden, gladgestreken (stap 98, "kan je auto's die door AI
 bestuurd worden ook bochten soepeler laten nemen?"). Het verkeer reed recht over
 de hoekpunten van de BGT-as: in één beeld een halve draai, en op de strook
 opzij van de as een sprong naar buiten in elke knik. Nu om de twee meter een
 monster, drie keer een voortschrijdend gemiddelde over vijf monsters (de
 uiteinden blijven staan), per monster de raaklijn en hoe hard je daar door de
 bocht kunt: v = √(a / κ). Eén keer per as, onthouden op de as zelf.
*/
const PAD = { stap: 2, glad: 2, passen: 3, dwars: 2.6, remmen: 2.8, vooruit: 45 };   // m, monsters, keer, m/s², m/s², m
export function gladPad(pts) {
  if (!pts || pts.length < 2) return pts;
  if (pts._glad) return pts._glad;
  if (pts.raak) return pts;                    // is al glad
  // herbemonsteren om de PAD.stap meter
  const ruw = [pts[0].clone()];
  let nodig = PAD.stap;                        // hoe ver het volgende monster nog is
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const l = a.distanceTo(b);
    let s = nodig;
    while (s <= l) { ruw.push(a.clone().lerp(b, s / l)); s += PAD.stap; }
    nodig = s - l;
  }
  const eind = pts[pts.length - 1];
  if (ruw.length > 1 && ruw[ruw.length - 1].distanceTo(eind) < 0.6) ruw[ruw.length - 1] = eind.clone();
  else ruw.push(eind.clone());
  const n = ruw.length;
  let p = ruw;
  for (let pas = 0; pas < PAD.passen; pas++) {
    const q = new Array(n);
    for (let i = 0; i < n; i++) {
      const h = Math.min(PAD.glad, i, n - 1 - i);
      let x = 0, z = 0;
      for (let j = i - h; j <= i + h; j++) { x += p[j].x; z += p[j].y; }
      q[i] = new THREE.Vector2(x / (2 * h + 1), z / (2 * h + 1));
    }
    p = q;
  }
  const tx = new Float32Array(n), tz = new Float32Array(n), vmax = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = p[Math.max(0, i - 1)], b = p[Math.min(n - 1, i + 1)];
    const l = Math.max(1e-6, a.distanceTo(b));
    tx[i] = (b.x - a.x) / l; tz[i] = (b.y - a.y) / l;
  }
  // kromming per stuk: hoeveel de raaklijn van het ene monster naar het volgende draait
  const krom = new Float32Array(Math.max(1, n - 1));
  for (let i = 0; i < n - 1; i++) {
    const kruis = tx[i] * tz[i + 1] - tz[i] * tx[i + 1], punt = tx[i] * tx[i + 1] + tz[i] * tz[i + 1];
    krom[i] = Math.abs(Math.atan2(kruis, punt)) / Math.max(0.5, p[i].distanceTo(p[i + 1]));
  }
  // en per monster de scherpste van de twee stukken ernaast: tussen twee monsters draait
  // de neus met die van het stuk, niet met het gemiddelde
  for (let i = 0; i < n; i++) {
    const k = Math.max(krom[Math.max(0, i - 1)], krom[Math.min(n - 2, i)]);
    vmax[i] = k > 1e-4 ? Math.sqrt(PAD.dwars / k) : 99;
  }
  // de afstand langs de lijn: in een bocht liggen de monsters na het gladstrijken dichter dan twee meter
  const lang = new Float32Array(n);
  for (let i = 1; i < n; i++) lang[i] = lang[i - 1] + p[i].distanceTo(p[i - 1]);
  p.raak = { tx, tz };
  p.vmax = vmax;
  p.lang = lang;
  pts._glad = p;
  return p;
}

export const RIJ = {
  hatch: { top: 24, trek: 1 },
  van: { top: 24, trek: 1 },
  bx: { top: 24, trek: 1 },
  truck: { top: 16, trek: 1 },
  ambulance: { top: 24, trek: 1 },
  /*
   `grip`: hoeveel dwarsversnelling het stuur van deze auto hooguit vraagt (zie `drive`).
   De Ferrari had dezelfde 26 m/s² als een hatchback, en omdat hij twee keer zo hard gaat
   draaide hij op 200 km/u nog maar een halve radiaal per seconde: "de Ferrari draait nu wel
   heel lastig links en rechts" (melding 3 okt 2026, stap 106). Met 50 draait hij op 120 km/u
   1,5 en op 200 km/u 0,9 rad/s.
  */
  ferrari: { top: 70, trek: 1.9, grip: 50 },
  // de GTI uit de showroom (stap 123): 150 km/u, vlot weg, strakker door de bocht dan een gewone hatchback
  gti: { top: 42, trek: 1.45, grip: 36 },
};

export const LAKKLEUREN = [
  0x1c1e24, 0x2b2f36, 0x8a8d93, 0xa8abb0, 0xd8d9dc, 0xc9c1a8, 0x5b6470, 0x6e737a,
  0x2a3f8f, 0x2f4a6e, 0x9c1f1f, 0x7a3b2a, 0x2f6b3a, 0x3e3a36, 0xffffff, 0xb9a98c,
];

export class Vehicles {
  constructor(scene, parkSpots) {
    // de auto's zijn dekking voor wie op je schiet (zie `blokkeertZicht`)
    zetZichtBlokker((x1, z1, x2, z2, h) => this.blokkeertZicht(x1, z1, x2, z2, h));
    this.scene = scene;
    this.cars = [];   // {mesh|inst,x,z,yaw,speed,driveable}
    this.knallen = [];   // lopende vuurballen van opgeblazen auto's
    this.traffic = [];
    // js/main.js hangt hier het geluid aan: een bestuurder die staat te wachten
    this.opClaxon = null;
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
      for (const m of stapel.alle) { m.userData.autoStapel = k; scene.add(m); }
      this.stapels[k] = { stapel, n: 0, autos: [] };
    }
    parkSpots.forEach((s, i) => {
      const kind = soorten[i];
      const kleur = LAKKLEUREN[Math.floor(r() * LAKKLEUREN.length)];
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
      this.stapels[k].stapel.omhul();
    }
    // verkeer N7 (beide richtingen). Met de kaart uit de BGT zijn de twee
    // rijbanen van de N7 losse assen; elke as krijgt verkeer in één richting.
    const n7 = KAART ? KAART.wegassen.filter(w => w.naam === 'N7' && w.w > 6 && w.lengte > 150).map(w => w.pts.map(p => new THREE.Vector2(p[0], p[1]))) : [];
    const hp = n7.length ? null : gladPad(HIGHWAY.pts.map(p => { const [x, z] = toWorld(p[0], p[1]); return new THREE.Vector2(x, z); }));
    for (let i = 0; i < 14; i++) {
      const dir = i % 2 ? 1 : -1;
      const lane = (i % 4 < 2) ? 2.1 : 6.2;
      const mesh = makeCar(LAKKLEUREN[Math.floor(r() * LAKKLEUREN.length)], r() < 0.3 ? 'van' : 'hatch');
      scene.add(mesh);
      if (n7.length) {
        const path = gladPad(n7[i % n7.length]);
        this.traffic.push({ mesh, path, t: r() * (path.length - 1), dir: (i % n7.length) ? -1 : 1, lane: (i % 4 < 2) ? 1.6 : -1.6, speed: 22 + r() * 8, y: 0.1 });
      } else this.traffic.push({ mesh, path: hp, t: r() * (hp.length - 1), dir, lane, speed: 22 + r() * 8, y: 0.6 });
    }
    // wijkverkeer: langzame auto's op Molenkrite, Jasker, Monnikmolen, De Wieken
    const namen = ['Molenkrite', 'Jasker', 'Monnikmolen', 'De Wieken', 'de Wieken', 'Buitenroede', 'Bonkelaar'];
    const local = KAART
      ? KAART.wegassen.filter(w => w.drive && namen.includes(w.naam) && w.lengte > 80).sort((a, b) => b.lengte - a.lengte).slice(0, 8).map(w => ({ pts: w.pts.map(p => new THREE.Vector2(p[0], p[1])) }))
      : ROADS.filter(rd => namen.includes(rd.name) && rd.pts.length > 3).map(rd => ({ pts: rd.pts.map(p => { const [x, z] = toWorld(p[0], p[1]); return new THREE.Vector2(x, z); }) }));
    /*
     Twaalf in plaats van zes (melding 25 sep 2026: "ik zie geen verkeer meer
     rijden"). Gemeten na een minuut aan de Molenkrite: twee binnen 260 m, en
     één daarvan stond stil voor de speler. Zes wijkauto's voor heel Sneek en
     IJlst is te weinig, ook als ze meeverhuizen.
    */
    for (let i = 0; i < 12 && local.length; i++) {
      const rd = local[i % local.length];
      const path = gladPad(rd.pts);
      const mesh = makeCar(LAKKLEUREN[Math.floor(r() * LAKKLEUREN.length)]);
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
    /*
     Wie verhuist: iedereen buiten de band (`VER`) die je niet kunt zien. Dat was
     alleen wie verder dan 520 m reed, en de wijkauto's reden bijna allemaal
     tussen 300 en 500 m rond: dan verhuisde er nooit een, en bleef het bij twee
     in de buurt.

     En het doel hangt aan de klok (js/sfeer.js, `drukte`, uit de andere sessie
     van 25 sep 2026): na half elf 's avonds rijdt er bijna niets meer, en tussen
     vijf en half zeven komt het verkeer terug.
    */
    const NABIJ = 260, VER = 300;
    const f = this.drukte === undefined ? 1 : this.drukte;
    const DOEL = Math.max(1, Math.round(7 * f));
    this._vulKlok = (this._vulKlok || 0) + dt;
    if (this._vulKlok < 1) return;
    this._vulKlok = 0;
    const lokaal = this.traffic.filter(t => t.lokaal && t._pos && !t.slaapt);
    if (!lokaal.length) return;
    /*
     Een zone die vrij moet blijven: de route van de race in missie 14
     (`vrijeZone`, js/race.js). Wie daar rijdt en niet in beeld is, verhuist;
     wie je ziet rijden mag doorrijden, anders verdwijnt hij voor je ogen.
    */
    if (this.vrijeZone) {
      for (const t of lokaal) {
        if (!this.vrijeZone(t._pos.x, t._pos.y)) continue;
        const d = Math.hypot(t._pos.x - camX, t._pos.y - camZ);
        if (d > 70 || !zichtVrij(camX, camZ, t._pos.x, t._pos.y, 1.4)) this.zetOpRijbaan(t, camX, camZ, 300, 300, 1400);
      }
    }
    let nabij = 0, verste = null, vd = VER;
    for (const t of lokaal) {
      const d = Math.hypot(t._pos.x - camX, t._pos.y - camZ);
      if (d < NABIJ) nabij++;
      // niet wegtoveren wat je ziet rijden
      if (d > vd && (d > 600 || !zichtVrij(camX, camZ, t._pos.x, t._pos.y, 1.4))) { vd = d; verste = t; }
    }
    /*
     Rijden er te veel — het doel zakt 's avonds terwijl de auto's er al zijn —
     dan gaat er telkens één weg: de dichtstbijzijnde die verder dan negentig
     meter rijdt, naar een rijbaan ver buiten de buurt.
    */
    if (nabij > DOEL + 1) {
      let weg = null, wd = Infinity;
      for (const t of lokaal) {
        const d = Math.hypot(t._pos.x - camX, t._pos.y - camZ);
        if (d > 90 && d < wd) { wd = d; weg = t; }
      }
      if (weg) this.zetOpRijbaan(weg, camX, camZ, 420, 420, 1400);
      return;
    }
    if (nabij >= DOEL || !verste) return;
    // een rijbaan zoeken die in de band om de speler ligt; net als bij de
    // voetgangers mag het dichterbij als er een gebouw tussen staat
    const beste = this.kiesRijbaan(camX, camZ, 80, 130, 250);
    if (!beste) return;
    this.zetOp(verste, beste.pad, beste.k);
  }

  /*
   Een plek op een rijbaan in de band om de speler. Net als bij de voetgangers:
   eerst goedkoop dertig plekken prikken, dan van dichtbij naar ver hoogstens
   vijf zichtlijnen trekken en stoppen bij de eerste die uit het zicht ligt
   (andere sessie, 25 sep 2026: veertig zichtlijnen per verhuizing, alleen
   terwijl je bewoog, was wat je als haperen bij lopen en rijden voelde).
  */
  kiesRijbaan(camX, camZ, DEKKING, OPEN, BUITEN) {
    const kandidaten = [];
    for (let poging = 0; poging < 30; poging++) {
      const pad = this.rijbanen[Math.floor(Math.random() * this.rijbanen.length)];
      const k = Math.floor(Math.random() * pad.length);
      const q = pad[k];
      const d = Math.hypot(q.x - camX, q.y - camZ);
      if (d < DEKKING || d > BUITEN) continue;
      if (this.vrijeZone && this.vrijeZone(q.x, q.y)) continue;      // niet op de route van de race
      kandidaten.push({ pad, k, q, d });
    }
    kandidaten.sort((a, b) => a.d - b.d);
    let stralen = 0;
    for (const c of kandidaten) {
      const uitZicht = c.d >= OPEN ? true : (stralen++ < 5 ? !zichtVrij(camX, camZ, c.q.x, c.q.y, 1.4) : false);
      if (uitZicht) return c;
    }
    return null;
  }

  /*
   Alles wat in de vrije zone rijdt meteen elders neerzetten, ook wat je ziet:
   voor als het beeld zwart is (de start van de race). Levert hoeveel er verhuisden.
  */
  maakVrij(camX, camZ) {
    if (!this.vrijeZone) return 0;
    let n = 0;
    for (const t of this.traffic) {
      if (!t.lokaal || !t._pos || t.slaapt || !this.vrijeZone(t._pos.x, t._pos.y)) continue;
      if (this.zetOpRijbaan(t, camX, camZ, 300, 300, 1400)) n++;
    }
    return n;
  }

  // een wijkauto op een rijbaan in een band om de speler zetten
  zetOpRijbaan(t, camX, camZ, DEKKING, OPEN, BUITEN) {
    const beste = this.kiesRijbaan(camX, camZ, DEKKING, OPEN, BUITEN);
    if (!beste) return false;
    this.zetOp(t, beste.pad, beste.k);
    return true;
  }

  zetOp(t, pad, k) {
    // de gladde versie van de as; het monster dat het dichtst bij hoekpunt k ligt
    const g = gladPad(pad), q = pad[Math.max(0, Math.min(pad.length - 1, Math.round(k)))];
    let beste = 0, bd = Infinity;
    for (let i = 0; i < g.length; i++) { const d = g[i].distanceToSquared(q); if (d < bd) { bd = d; beste = i; } }
    t.path = g;
    t.t = Math.max(0, Math.min(g.length - 1.001, beste));
    t.keer = null;
    t.dir = Math.random() < 0.5 ? 1 : -1;
    t.snelheid = 0; t.doel = t.speed;
    t._pos = null; t._dir = null;
  }

  // De matrix van een geparkeerde auto in zijn stapel bijwerken.
  // (`meteen` false: de stapel pas bijwerken bij `spoel`, voor wie er veel tegelijk zet)
  zetInstantie(car, meteen = true) {
    if (!car.inst) return;
    const stap = this.stapels[car.inst.sleutel];
    const zichtbaar = car.zichtbaar !== false && car.getekend !== false;
    stap.stapel.zet(car.inst.i, car.x, car.z, car.yaw, zichtbaar);
    if (meteen) stap.stapel.klaar(); else stap.vies = true;
  }
  spoel() {
    for (const k in this.stapels) { const st = this.stapels[k]; if (st.vies) { st.vies = false; st.stapel.klaar(); } }
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
    this._lodBij = { x: camX, z: camZ, zicht };
    const q = zicht * zicht, qVer = VER_VANAF * VER_VANAF;
    for (const k of Object.keys(this.stapels)) {
      const stap = this.stapels[k];
      /*
       Eerst de hele stapel: ligt de tegel voorbij het zicht, dan gaan al zijn
       auto's uit. Frustum culling haalt alleen de tegels weg die achter je
       liggen; wat vóór je ligt tot aan de mist van negenhonderd meter werd wél
       getekend.

       Daarna per auto: dichtbij het volle model, voorbij `VER_VANAF` meter de
       grove uitvoering (js/carmodel.js), voorbij `zicht` niets. De stapel
       tekent alleen wat er staat — een auto op schaal nul ging vroeger nog
       gewoon door de vertex shader.
      */
      const ver = stap.ver !== undefined ? stap.ver : (stap.ver = tegelMidden(k));
      const tdx = ver.x - camX, tdz = ver.z - camZ;
      const tegelDicht = tdx * tdx + tdz * tdz < (zicht + AUTOTEGEL_HALF) * (zicht + AUTOTEGEL_HALF);
      if (!tegelDicht && stap.aan === false) continue;
      stap.aan = tegelDicht;
      let veranderd = false;
      for (const car of stap.autos) {
        if (!car || car.mesh) continue;                    // deze rijdt, die heeft zijn eigen model
        const dx = car.x - camX, dz = car.z - camZ, d2 = dx * dx + dz * dz;
        const wil = tegelDicht && d2 < q && car.zichtbaar !== false;
        const opAfstand = d2 > qVer;
        if (car.getekend === wil && (!wil || car.opAfstand === opAfstand)) continue;
        car.getekend = wil; car.opAfstand = opAfstand;
        stap.stapel.zet(car.inst.i, car.x, car.z, car.yaw, wil, opAfstand);
        veranderd = true;
      }
      if (veranderd || stap.vies) { stap.vies = false; stap.stapel.klaar(); }
    }
  }

  // Alle auto's aan of uit: binnen in een huis en in het bovenaanzicht hoort de
  // wijk leeg te zijn (zie js/main.js en js/editor.js).
  zichtbaarheid(aan) {
    this._verkeerAan = aan;
    for (const c of this.cars) {
      if (c.mesh) c.mesh.visible = aan;
      else if (c.zichtbaar !== aan) { c.zichtbaar = aan; c.getekend = aan; this.zetInstantie(c, false); }
    }
    /*
     Weer buiten: meteen de afstandsregel erover, vanaf waar hij het laatst
     stond. Anders stonden alle auto's van de hele wereld aan tot `lod` de tegel
     weer eens bekeek — en die slaat een tegel over die al ver weg was.
    */
    if (aan && this._lodBij) {
      for (const k in this.stapels) this.stapels[k].aan = undefined;
      this.lod(this._lodBij.x, this._lodBij.z, this._lodBij.zicht);
    }
    this.spoel();
    for (const t of this.traffic) t.mesh.visible = aan && !t.slaapt;
  }

  /*
   Dekking (missie 12): loopt de kijklijn van (x1, z1) naar (x2, z2) op `hoogte`
   boven de grond door een auto? Een auto is hier een doos van zijn lengte, zijn
   breedte en zijn dak (hatchback 4,30 × 1,78 × 1,40 m, bus 5,20 × 1,90 × 2,02, zie
   js/carmodel.js). Staat een van de twee eindpunten ín de doos — je zit erin, of
   de schutter staat ertegenaan — dan telt die auto niet: anders was je in een
   auto onzichtbaar. Eerst een grove toets op de rechthoek om de lijn heen, dan
   pas de doos zelf (de slab-toets, zoals `zichtVrij`).
  */
  blokkeertZicht(x1, z1, x2, z2, hoogte = 1.2) {
    const minX = Math.min(x1, x2) - 3, maxX = Math.max(x1, x2) + 3;
    const minZ = Math.min(z1, z2) - 3, maxZ = Math.max(z1, z2) + 3;
    const doos = (x, z, yaw, soort) => {
      if (x < minX || x > maxX || z < minZ || z > maxZ) return false;
      const bus = soort === 'van', truck = soort === 'truck', amb = soort === 'ambulance';
      const dak = truck ? 3.0 : amb ? 2.7 : bus ? 2.02 : 1.40;
      if (dak < hoogte) return false;
      const hl = (truck ? 7.0 : amb ? 5.95 : bus ? 5.20 : 4.30) / 2, hb = (truck ? 2.35 : amb ? 2.04 : bus ? 1.90 : 1.78) / 2;
      // breedte langs (cos, −sin), lengte langs (−sin, −cos): de neus wijst naar −z bij yaw 0
      const c = Math.cos(yaw), sn = Math.sin(yaw);
      const u0 = (x1 - x) * c - (z1 - z) * sn, v0 = -(x1 - x) * sn - (z1 - z) * c;
      const u1 = (x2 - x) * c - (z2 - z) * sn, v1 = -(x2 - x) * sn - (z2 - z) * c;
      const binnen = (u, v) => Math.abs(u) < hb + 0.2 && Math.abs(v) < hl + 0.2;
      if (binnen(u0, v0) || binnen(u1, v1)) return false;
      let t0 = 0, t1 = 1;
      for (const [p0, e, h] of [[u0, u1 - u0, hb], [v0, v1 - v0, hl]]) {
        if (Math.abs(e) < 1e-9) { if (p0 < -h || p0 > h) return false; continue; }
        let a2 = (-h - p0) / e, b2 = (h - p0) / e;
        if (a2 > b2) { const t = a2; a2 = b2; b2 = t; }
        if (a2 > t0) t0 = a2;
        if (b2 < t1) t1 = b2;
        if (t0 > t1) return false;
      }
      return true;
    };
    for (const c of this.cars) {
      if (!this.isZichtbaar(c)) continue;
      if (doos(c.x, c.z, c.yaw, c.soort)) return true;
    }
    for (const t of this.traffic) {
      if (t.slaapt || !t.mesh.visible) continue;
      if (doos(t.mesh.position.x, t.mesh.position.z, t.mesh.rotation.y, t.soort)) return true;
    }
    return false;
  }

  // De instanced meshes zelf, om op te schieten (raycast) — zie js/main.js.
  doelen() {
    const uit = [];
    for (const k of Object.keys(this.stapels)) uit.push(...this.stapels[k].stapel.alle);
    for (const c of this.cars) if (c.mesh) uit.push(c.mesh);
    // het rijdende verkeer hoort er ook bij: daar zat geen kogel in te krijgen,
    // en juist daar zit een bestuurder die er op kan reageren (zie schrikAf)
    for (const t of this.traffic) if (t.mesh.visible) uit.push(t.mesh);
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
    // (de ambulance van stap 116 is een eigen model: zes meter lang en twee breed)
    const amb = soort === 'ambulance';
    const rij = RIJ[soort] || RIJ.hatch;
    const car = {
      mesh, x, z, yaw, speed: 0, steer: 0, driveable, hp: 100, soort, kleur,
      as: truck ? 2.6 : amb ? 1.95 : 1.4, botsRadius: truck ? 1.15 : amb ? 1.05 : (soort === 'ferrari' ? 1.0 : 0.95),
      instap: truck || amb ? 2.4 : 1.2,
      stoel: null,          // het oogpunt komt uit het model (userData.oog)
      topSnelheid: rij.top, trek: rij.trek, grip: rij.grip || STUUR_GRIP,
      breedte: truck ? 2.35 : amb ? 2.04 : (soort === 'ferrari' ? 1.95 : 1.78),
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
   Een auto overspuiten. De spuiterij bij het tankstation (js/spuiterij.js)
   gebruikt dit: je rijdt er in één kleur in en in een andere weer uit.

   Het lakmateriaal wordt per kleur gedeeld tussen alle auto's, dus we ruilen
   het materiaal om en maken er geen nieuw aan; de carrosseriedelen die de lak
   dragen zijn in js/carmodel.js gemerkt met `userData.lak`. Staat de auto nog
   als instantie in de stapel, dan gaat de kleur daar naartoe.
  */
  verf(car, kleur) {
    if (!car) return null;
    car.kleur = kleur;
    // de schade van js/autoschade.js (stap 124): nieuwe lak, geen deuken meer
    if (car.schade) { for (const d of car.schade) if (d.parent) d.parent.remove(d); car.schade = []; }

    if (car.mesh) {
      const lak = lakVoor(kleur);
      car.mesh.traverse(o => { if (o.isMesh && o.userData.lak) o.material = lak; });
    }
    if (car.inst) {
      // (dit zocht de stapel op `soort`, maar er is er een per soort én per
      // tegel: een geparkeerde auto overspuiten deed daardoor niets)
      const stap = this.stapels && this.stapels[car.inst.sleutel];
      if (stap && stap.stapel) { stap.stapel.kleur(car.inst.i, kleur); stap.stapel.klaar(); }
    }
    return kleur;
  }

  /** Een andere lakkleur dan `nu`, uit dezelfde reeks als het overige verkeer. */
  andereKleur(nu) {
    const keus = LAKKLEUREN.filter(k => k !== nu);
    return keus[Math.floor(Math.random() * keus.length)];
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
    /*
     Sturen met A en D. De pijltjes naar links en rechts stuurden hier ook mee,
     maar die wisselen sinds de tweede radiozender van zender (js/main.js) —
     anders stuur je de berm in terwijl je Radio Spannenburg zoekt.
    */
    let doel = 0;
    if (keys.KeyA) doel = 1;
    if (keys.KeyD) doel = -1;
    // een bestuurder van de computer stuurt niet met aan of uit maar met een stand
    // tussen −1 en 1 (js/politie.js, stap 98): anders slingert hij over de weg
    if (typeof keys.stuur === 'number') doel = Math.max(-1, Math.min(1, keys.stuur));
    /*
     En begrensd door de grip: een auto kan niet harder de bocht om dan zijn banden
     houden (v²·tan(stuur)/wielbasis ≤ GRIP). Onder de 55 km/u maakt dat niets uit;
     daarboven wordt het stuur steeds rustiger. Zonder dit gaf de Ferrari op 200 km/u
     bij een tikje op A of D een draai van bijna vier radialen per seconde: "een klein
     tikje naar links of rechts, grote gevolgen" (melding 27 sep 2026).
    */
    const vv = car.speed * car.speed;
    const maxStuur = Math.min(0.60 * (0.26 + 0.74 / (1 + Math.abs(car.speed) / 8)),
      Math.atan((car.grip || STUUR_GRIP) * wielbasis / Math.max(1, vv)));
    /*
     Met de toetsen bouwt de uitslag op snelheid trager op (stap 106): A of D is aan of uit,
     en met de ruimere grip van de Ferrari gaf een tikje anders weer een ruk. Vasthouden haalt
     wel de volle uitslag, in een derde seconde op 200 km/u. Loslaten gaat wel meteen terug
     naar het midden, anders loopt een tikje nog lang na. Een bestuurder van de computer
     (keys.stuur) stuurt zelf geleidelijk en houdt het snelle tempo.
    */
    const naar = doel * maxStuur;
    const opbouwen = Math.abs(naar) > Math.abs(car.steer) && naar * car.steer >= 0;
    const tempo = typeof keys.stuur === 'number' || !opbouwen ? 8 : 8 / (1 + Math.abs(car.speed) / 40);
    car.steer += (naar - car.steer) * Math.min(1, dt * tempo);

    // ---- motor, rem en rolweerstand ----
    const v = car.speed;
    if (gas && v < -0.4) car.speed += 18 * dt;                       // eerst afremmen
    else if (gas) car.speed += 9.5 * (car.trek || 1) * (1 - Math.max(0, v) / top) * dt;
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
    /*
     Erfscheidingen eerst, want die horen niet tegen te houden maar te breken.
     Rijd je met een beetje vaart een schutting of een heg in, dan klapt hij plat
     (js/world.js) en houdt hij daarna niemand meer tegen — ook de agent achter
     je niet, die kijkt er dan dwars overheen. Het kost vaart, en hoe meer je er
     tegelijk meeneemt hoe meer. Stilstaand gebeurt er niets, anders sloop je een
     tuin door er tegenaan te leunen.
    */
    if (Math.abs(v) > 2) {
      let stuk = 0;
      for (const off of [-as, 0, as]) stuk += breekScheidingenBij(cx + fx * off, cz + fz * off, radius, car.x, car.z);
      if (stuk) {
        car.speed *= Math.max(0.55, 1 - stuk * 0.06);
        car.brakKracht = stuk;
      }
    }
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
  // `alleenGeparkeerd`: zonder het verkeer en zonder wat niet te besturen is (js/schaduw.js)
  botsAutos(car, cx, cz, alleenGeparkeerd = false) {
    const as = car.as || 1.4, radius = car.botsRadius || 0.95;
    const fx = -Math.sin(car.yaw), fz = -Math.cos(car.yaw);
    const buurt = [];
    const y = car.mesh ? car.mesh.position.y : 0;
    for (const c of this.cars) {
      if (c === car || !this.isZichtbaar(c)) continue;
      if (alleenGeparkeerd && c.driveable === false) continue;
      if (Math.abs(c.x - cx) > 12 || Math.abs(c.z - cz) > 12) continue;
      if (!zelfdeLaag(y, c.mesh ? c.mesh.position.y : 0)) continue;
      buurt.push({ x: c.x, z: c.z, yaw: c.yaw, as: c.as || 1.4, r: c.botsRadius || 0.95, auto: c });
    }
    for (const t of alleenGeparkeerd ? [] : this.traffic) {
      const p = t.mesh.position;
      if (Math.abs(p.x - cx) > 12 || Math.abs(p.z - cz) > 12) continue;
      if (!zelfdeLaag(y, p.y)) continue;
      buurt.push({ x: p.x, z: p.z, yaw: t.mesh.rotation.y, as: 1.4, r: 0.95, verkeer: t });
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
            // er zit iemand achter het stuur: die schrikt en probeert achteruit weg
            if (o.verkeer && hard) this.schrikAf(o.verkeer, 'botsing');
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

  /*
   Er zit iemand achter het stuur van het verkeer, en die reageert nu ergens op.

   Twee dingen kunnen een bestuurder laten schrikken. Rijd je hem aan, dan zet
   hij hem in zijn achteruit en probeert hij van je weg te komen — een seconde
   of twee, want hij rijdt op zijn baan en verder achteruit dan dat heeft geen
   zin. Schiet je op een rijdende auto, dan geeft de bestuurder juist gas: een
   seconde of zes hard door, zodat hij bij je vandaan is voordat de volgende
   kogel komt.

   Allebei zijn het tijden op de auto zelf (`achteruit` en `haast`), die in
   `updateTraffic` de doelsnelheid overrulen. De baan zelf blijft dezelfde: het
   verkeer rijdt op rails, dus wegrijden is harder of andersom over diezelfde
   rails.
  */
  schrikAf(t, waarom) {
    if (!t) return;
    if (waarom === 'botsing') {
      if ((t.achteruit || 0) > 0) return;                  // niet stapelen
      t.achteruit = 1.1 + Math.random() * 0.9;
      t.haast = 0;
      /*
       Een klap kost vaart. Zonder dit stond de auto er na een aanrijding nog
       met tachtig kilometer per uur in, en die snelheid is er in anderhalve
       seconde niet uit te remmen: dan liep de achteruit-klok af voordat hij
       ooit achteruit reed. Een aanrijding zet hem vrijwel stil, en vanaf stil
       is achteruit een kwestie van een halve seconde.
      */
      if (t.snelheid !== undefined) t.snelheid = Math.min(t.snelheid, 3);
    } else {
      t.achteruit = 0;
      t.haast = Math.max(t.haast || 0, 5 + Math.random() * 3);
    }
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
    /*
     Een geparkeerde auto in de stapel heeft geen eigen model. Wie er een verplaatst (een missie
     die hem ergens neerzet, een proef die de speler erin zet) krijgt hier het losse model, zoals
     bij instappen met E; anders viel dit om op `mesh.position` (stap 101). Op het viaduct: eerst
     `maakBestuurbaar` en de hoogte zetten, want het nieuwe model staat op 0 m.
    */
    if (!car.mesh) this.maakBestuurbaar(car);
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
    /*
     's Nachts gaat het meeste verkeer slapen (verzoek 26 sep 2026: "na 24:00
     minder mensen en auto's op de weg"). Alleen het wijkverkeer rond de speler
     zakte met de klok; het verkeer op de doorgaande wegen (de N7, de Lemmerweg)
     reed de hele nacht even druk door, en in een wijk waar je nog niet was stond
     het verkeer van overdag nog. Nu heeft elke auto een vaste drempel (uit zijn
     nummer, niet uit de loting, zodat de rest van het verkeer niet verschuift):
     boven `drukte` slaapt hij. Op de doorgaande weg blijft er altijd een kwart
     rijden. Inslapen en wakker worden gebeurt alleen verder dan SLAAP_VER van de
     camera, dus je ziet er geen verdwijnen of opduiken. Een slapende auto staat
     onzichtbaar ver buiten de wereld: dan hoeft geen enkele botsing of kogel er
     rekening mee te houden.
    */
    const f = this.drukte === undefined ? 1 : this.drukte;
    const SLAAP_VER = 180;
    for (let i = 0; i < this.traffic.length; i++) {
      const t = this.traffic[i];
      if (t.slaap === undefined) t.slaap = ((i + 1) * 2654435761 % 4294967296) / 4294967296;
      let wakker = t.slaap < (t.lokaal ? f : Math.max(0.25, f));
      /*
       `zoneSlaapt` (missie 15): alles wat op de vrije zone rijdt slaapt, ook het doorgaande
       verkeer op de N7, en dat mag al op dertig meter van de camera. Bouwman rijdt langs een
       lijn en gaat door elke auto heen, en een auto die in beeld de route op reed hield de
       speler tegen (stap 97).
      */
      const zone = this.zoneSlaapt && this.vrijeZone && t._pos && !t.slaapt && this.vrijeZone(t._pos.x, t._pos.y);
      if (zone) wakker = false;
      if (camX === null || wakker === !t.slaapt) continue;
      if (t._pos && !t.slaapt && Math.hypot(t._pos.x - camX, t._pos.y - camZ) < (zone ? 30 : SLAAP_VER)) continue;
      if (t.slaapt) {
        // wakker worden: op een rijbaan uit het zicht, net als het bijvullen
        // (maar niet zolang de zone slaapt: dan zou hij er zo weer op kunnen staan)
        if (this.zoneSlaapt && this.vrijeZone && !t.lokaal) continue;
        t.slaapt = false;
        t.mesh.visible = this._verkeerAan !== false;
        if (t.lokaal) this.zetOpRijbaan(t, camX, camZ, SLAAP_VER, SLAAP_VER, 600);
      } else {
        t.slaapt = true;
        t.mesh.visible = false;
        t.mesh.position.set(1e5 + i * 10, -50, 1e5);
      }
    }
    // eerst iedereen op zijn plek zetten, dan pas vooruitkijken
    for (const t of this.traffic) {
      if (t.slaapt) { t._pos = VER_WEG; t._dir = VER_WEG_R; continue; }
      const pl = this.plekOpPad(t);
      t._pos = new THREE.Vector2(pl.x, pl.z);
      t._dir = new THREE.Vector2(pl.dx, pl.dz);
      if (t.snelheid === undefined) {
        // wie vlak voor een bocht begint, begint op de snelheid van die bocht
        t.snelheid = t.speed;
        t.snelheid = t.doel = Math.min(t.speed, this.bochtSnelheid(t));
      }
    }

    const KIJK = 11;          // meter vooruitkijken
    const BREED = 2.2;        // hoe ver naast de as iets nog in de weg staat
    const MENS_KIJK = 20;     // voor een overstekende voetganger verder vooruit
    const MENS_BREED = 1.4;   // en breder, want hij is nog onderweg de weg op

    // De auto's met een eigen model (gestolen of rijdend) één keer opzoeken. Het
    // aflopen van de lijst van 1781 is zelf het werk — niet `isZichtbaar` — dus
    // dit moet buiten de lus hieronder staan.
    const metModel = [];
    for (const c of this.cars) if (c.mesh) metModel.push(c);

    for (const t of this.traffic) {
      if (t.slaapt) continue;
      let vrij = KIJK;            // het dichtstbijzijnde obstakel binnen elf meter
      let vrijMens = MENS_KIJK;   // en de dichtstbijzijnde overstekende voetganger

      // Staat er iets binnen elf meter recht vooruit? `marge` is de speling
      // naast de as. Voetgangers worden verderop ook op ruimere maat bekeken.
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
      /*
       De speler die voor de auto staat. `blokSpeler` telt hoe lang hij dat al
       doet: pas als dat een seconde of twee duurt gaat de claxon (verzoek
       20 sep 2026 — "niet gelijk claxonneren"). Daarna een rustpauze, anders
       staat er een auto te loeien zolang jij daar staat.
      */
      if (speler && !speler.inCar) {
        const voor = vrij;
        inDeWeg(speler.pos.x, speler.pos.z, 0.1);
        const doorSpeler = vrij < voor && vrij < 7;
        if (t.claxonRust > 0) t.claxonRust -= dt;
        if (doorSpeler && t.snelheid < 1.2) {
          t.blokSpeler = (t.blokSpeler || 0) + dt;
          if (t.blokSpeler > (t.claxonNa || (t.claxonNa = 1.6 + Math.random() * 2.2)) && (t.claxonRust || 0) <= 0) {
            t.blokSpeler = 0;
            t.claxonNa = 1.6 + Math.random() * 2.2;
            t.claxonRust = 4 + Math.random() * 5;
            // niet elke bestuurder is even kort aangebonden
            if (this.opClaxon && Math.random() < 0.7) this.opClaxon(t._pos.x, t._pos.y);
          }
        } else if (t.blokSpeler) {
          t.blokSpeler = Math.max(0, t.blokSpeler - dt * 2);
        }
      }
      if (voetgangers) {
        /*
         Een voetganger telt twee keer. Dichtbij doet hij mee in `vrij`, net als
         een auto of een paal: daar stopt de wagen voor. En verder vooruit telt
         hij apart in `vrijMens`, in zijn eigen maat — twintig meter en een
         meter breder — want iemand die van de stoep stapt is nog niet op de as
         en moet je zien aankomen (verzoek 22 sep 2026).
        */
        for (const v of voetgangers) {
          if (!v.alive || !v.opWeg || v.slaapt) continue;
          inDeWeg(v.x, v.z, 0.1);
          const dx = v.x - t._pos.x, dz = v.z - t._pos.y;
          const langs = dx * t._dir.x + dz * t._dir.y;
          if (langs <= 0.5 || langs > MENS_KIJK) continue;
          const opzij = Math.abs(dx * -t._dir.y + dz * t._dir.x);
          if (opzij <= BREED + MENS_BREED && langs < vrijMens) vrijMens = langs;
        }
      }

      // een geschrokken bestuurder rijdt niet gewoon door (zie schrikAf)
      if (t.achteruit > 0) t.achteruit -= dt;
      if (t.haast > 0) t.haast -= dt;
      // wie beschoten is geeft gas; harder dan dit rijdt hij niet, ook niet op de N7
      const basis = t.haast > 0 ? Math.min(t.speed * 1.9, t.speed + 12) : t.speed;

      /*
       Remmen naar nul op vier meter, weer optrekken zodra het vrij is. Voor een
       overstekende voetganger geldt een eigen, ruimere curve: die begint al op
       twintig meter af te remmen en staat op vijf meter stil, zodat je hem ziet
       remmen in plaats van dat hij op het laatste moment in de ankers gaat
       (verzoek 22 sep 2026). Het strengste van de twee wint.
      */
      const doelAuto = vrij >= KIJK ? basis : Math.max(0, basis * (vrij - 4) / (KIJK - 4));
      const doelMens = vrijMens >= MENS_KIJK ? basis
        : Math.max(0, basis * (vrijMens - 5) / (MENS_KIJK - 5));
      t.doel = Math.min(doelAuto, doelMens);
      // en niet harder de bocht door dan de banden houden, op tijd ervoor remmen (stap 98);
      // wie haast heeft neemt hem wat scherper
      t.bocht = this.bochtSnelheid(t) * (t.haast > 0 ? 1.3 : 1);
      t.doel = Math.min(t.doel, t.bocht);
      // achteruit gaat voor: dan kijkt hij niet vooruit maar wil hij er weg
      if (t.achteruit > 0) t.doel = -3.2;
      // remmen gaat harder dan optrekken, en wie achteruit wil harder dan dat
      const versnelling = t.achteruit > 0 ? 20 : t.doel < t.snelheid ? 14 : (t.haast > 0 ? 8 : 3.5);
      t.snelheid += Math.max(-versnelling * dt, Math.min(versnelling * dt, t.doel - t.snelheid));

      const n = t.path.length;
      if (t.keer) {
        // midden in het keren aan het eind van de straat: een halve cirkel
        t.keer.f += Math.abs(t.snelheid) * dt / (Math.PI * Math.max(0.5, Math.abs(t.lane)));
        if (t.keer.f >= 1) t.keer = null;
      } else {
        const j0 = Math.floor(t.t), j1 = Math.min(n - 1, j0 + 1);
        const segLen = Math.max(0.01, t.path[j0].distanceTo(t.path[j1]));
        t.t += t.dir * (t.snelheid * dt) / segLen;
        /*
         Het eind van de as. Een wijkauto keerde daar in één beeld om: een halve draai
         en een sprong van twee stroken opzij. Nu rijdt hij een halve cirkel om het
         eindpunt heen, van zijn strook naar de andere (`keer`, stap 98).
        */
        const eind = t.t >= n - 1 ? n - 1 : t.t <= 0 ? 0 : -1;
        if (eind >= 0 && t.bounce && t.snelheid > 0) {
          const pl = this.plekOpPad(t), E = t.path[eind];
          const ux = pl.x - E.x, uz = pl.z - E.y, L = Math.hypot(ux, uz) || 1;
          t.keer = { cx: E.x, cz: E.y, ux, uz, vx: pl.dx * L, vz: pl.dz * L, f: 0 };
          t.dir = eind > 0 ? -1 : 1;
          t.t = eind > 0 ? n - 1.001 : 0.001;
        } else if (t.t >= n - 1 || t.t <= 0) {
          if (t.t >= n - 1) { if (t.bounce) { t.dir = -1; t.t = n - 1.001; } else t.t = 0; }
          else if (t.bounce) { t.dir = 1; t.t = 0.001; } else t.t = n - 1.001;
          // de N7 begint weer vooraan: niet met 25 m/s de bocht in die daar ligt
          t.snelheid = Math.min(t.snelheid, this.bochtSnelheid(t));
        }
      }

      const pl = this.plekOpPad(t);
      const tx = pl.x, tz = pl.z;
      const ty = t.y + grondHoogte(tx, tz, t.mesh.position.y + 0.9);
      t.mesh.position.set(tx, ty, tz);
      t.mesh.rotation.order = 'YXZ';
      t.mesh.rotation.y = Math.atan2(-pl.dx, -pl.dz);
      t.mesh.rotation.x = helling(tx, tz, t.mesh.rotation.y, ty - t.y);
      if (t.remlicht) t.remlicht.visible = t.doel < t.speed * 0.6;
    }
  }

  /*
   Waar een rijdende auto staat en waar hij heen kijkt. Ook de raaklijn loopt
   tussen twee monsters door (stap 98), anders draait hij om de twee meter met
   een schokje; de strook ligt links of rechts van die raaklijn, dus ook die
   schuift vloeiend mee. Tijdens het keren (`keer`) een halve cirkel om het eind.
  */
  plekOpPad(t) {
    if (t.keer) {
      const k = t.keer, a = Math.PI * Math.min(1, k.f), c = Math.cos(a), s = Math.sin(a);
      let dx = -k.ux * s + k.vx * c, dz = -k.uz * s + k.vz * c;
      const l = Math.hypot(dx, dz) || 1;
      return { x: k.cx + k.ux * c + k.vx * s, z: k.cz + k.uz * c + k.vz * s, dx: dx / l, dz: dz / l };
    }
    const P = t.path, n = P.length;
    const j0 = Math.max(0, Math.min(n - 2, Math.floor(t.t))), j1 = j0 + 1;
    const f = Math.max(0, Math.min(1, t.t - j0));
    const x = P[j0].x + (P[j1].x - P[j0].x) * f, z = P[j0].y + (P[j1].y - P[j0].y) * f;
    let dx, dz;
    if (P.raak) {
      // over de hoek, niet over de vector: dan draait hij over het hele stuk even snel
      const a0 = Math.atan2(P.raak.tz[j0], P.raak.tx[j0]);
      let da = Math.atan2(P.raak.tz[j1], P.raak.tx[j1]) - a0;
      if (da > Math.PI) da -= 2 * Math.PI; else if (da < -Math.PI) da += 2 * Math.PI;
      dx = Math.cos(a0 + da * f); dz = Math.sin(a0 + da * f);
    } else { dx = P[j1].x - P[j0].x; dz = P[j1].y - P[j0].y; }
    const l = Math.hypot(dx, dz) || 1;
    dx = dx / l * t.dir; dz = dz / l * t.dir;
    return { x: x - dz * t.lane, z: z + dx * t.lane, dx, dz };
  }

  /*
   Hoe hard deze auto nu mag om de bochten vóór hem te halen: per monster tot
   PAD.vooruit meter verder de bochtsnelheid, plus wat hij tot daar kan
   afremmen (v² = vb² + 2·a·d). Het eind van een as waar hij keert telt als een
   bocht van drie meter per seconde.
  */
  bochtSnelheid(t) {
    const P = t.path;
    if (t.keer) return 3;
    if (!P || !P.vmax) return Infinity;
    const n = P.length, B = PAD.remmen;
    // het monster waar hij net voorbij is telt ook: daar zit hij nog in de bocht
    const achter = t.dir > 0 ? Math.floor(t.t) : Math.ceil(t.t);
    let beste = achter >= 0 && achter < n && P.vmax[achter] < 99 ? P.vmax[achter] : Infinity;
    const i0 = t.dir > 0 ? Math.ceil(t.t) : Math.floor(t.t);
    const j = Math.max(0, Math.min(n - 2, Math.floor(t.t)));
    const hier = P.lang[j] + (P.lang[j + 1] - P.lang[j]) * Math.max(0, Math.min(1, t.t - j));
    // zo ver als hij nodig heeft om tot stilstand te remmen: op de N7 (25 m/s) ruim honderd meter
    const v = Math.abs(t.snelheid || 0), vooruit = Math.min(240, Math.max(PAD.vooruit, v * v / (2 * B) + 12));
    for (let k = 0; k * PAD.stap <= vooruit; k++) {
      const i = i0 + k * t.dir;
      if (i < 0 || i > n - 1) {
        // drie meter per seconde óp het eindpunt, niet een monster verder
        const dEind = Math.abs(P.lang[t.dir > 0 ? n - 1 : 0] - hier);
        if (t.bounce) beste = Math.min(beste, Math.sqrt(9 + 2 * B * dEind));
        break;
      }
      const vb = P.vmax[i];
      if (vb >= 99) continue;
      const d = Math.abs(P.lang[i] - hier);
      const mag = Math.sqrt(vb * vb + 2 * B * d);
      if (mag < beste) beste = mag;
    }
    return beste;
  }

  /*
   Komt er verkeer aan bij dit punt? De voetgangers vragen dit voordat ze de
   stoep af stappen (js/npc.js): wie een auto ziet naderen wacht even. Alleen
   auto's die er ook echt naartoe rijden tellen — een auto die net voorbij is
   hoeft niemand tegen te houden.
  */
  autoDichtbij(x, z, straal = 16) {
    for (const t of this.traffic) {
      if (!t._pos || !t._dir) continue;
      const dx = x - t._pos.x, dz = z - t._pos.y;
      const langs = dx * t._dir.x + dz * t._dir.y;       // vóór hem is positief
      if (langs < 0 || langs > straal) continue;
      const opzij = Math.abs(dx * -t._dir.y + dz * t._dir.x);
      if (opzij > 5) continue;
      // een auto die al stilstaat laat je juist wél voorgaan
      if ((t.snelheid || 0) < 0.8) continue;
      return true;
    }
    return false;
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

  /*
   Een auto die het verhaal neerzette weer weghalen (stap 120: de auto's van de bende in missie 7). Alleen
   een losse auto, geen geparkeerde instantie; die horen bij hun vak.
  */
  verwijder(car) {
    if (!car || car.inst) return false;
    const i = this.cars.indexOf(car);
    if (i < 0) return false;
    this.cars.splice(i, 1);
    if (car.mesh) this.scene.remove(car.mesh);
    return true;
  }

  // Een uitgebrand wrak weer een gewone auto maken, op zijn eigen parkeerplek.
  herstelWrak(car) {
    car.wrak = false; car.wrakT = 0;
    // de schade van js/autoschade.js (stap 124): nieuwe lak, geen deuken meer
    if (car.schade) { for (const d of car.schade) if (d.parent) d.parent.remove(d); car.schade = []; }

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
      const st = this.stapels[sleutel];
      const car = st.autos[st.stapel.nummer(mesh, instanceId)];
      // tien kogels tot hij op is; dat was vier, en dan ging een auto wel erg
      // makkelijk in vlammen op
      if (car) { car.hp -= 10; return car; }
      return null;
    }
    for (let p = mesh; p; p = p.parent) {
      for (const c of this.cars) if (c.mesh === p) { c.hp -= 10; return c; }
      // rijdend verkeer: die auto's zitten niet in `cars` en gaan niet stuk, maar
      // de bestuurder geeft wel gas om weg te komen
      for (const t of this.traffic) if (t.mesh === p) {
        this.schrikAf(t, 'beschoten');
        // hp blijft boven nul: rijdend verkeer gaat niet in vlammen op (het rijdt
        // op rails, een wrak midden op de N7 zou de rij erachter opsluiten). De
        // teruggave zorgt wel voor de klap en het glasgerinkel.
        return { hp: 1, verkeer: t };
      }
    }
    return null;
  }
}
