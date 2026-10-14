/*
 Rijgedrag van de auto van de speler (stap 171): botsen met gevolg, een motor met versnellingen, en de camera die
 met de snelheid meegaat. Alles wat hier staat werkt alleen voor de auto waar je zelf in zit (js/vehicles.js `drive`
 vraagt `vehicles.spelerVan()`); de politie, het verkeer en de lijnen van de missies rijden zoals ze reden.

 1. Botsen (`botsReactie`). Tot nu toe zette elke klap de auto op een kwart van zijn vaart en de rijrichting recht
    op de neus — ook als je een muur alleen maar schampte, en elk beeld opnieuw zolang je ertegenaan schoof. Nu wordt
    de klap ontleed langs de normaal van wat je raakte (de duw uit `resolveCollisions` en `botsAutos`):
    - het deel recht op de muur af gaat eraf en kaatst voor `BOTS.terug` terug (frontaal: hard remmen, een tikje terug);
    - het deel langs de muur blijft, min wat wrijving (schampen: je schuift erlangs);
    - de klap grijpt aan op een punt van de auto (de neus, de kont of de flank) en geeft daar een draai (`car.tol`,
      rad/s) die vanzelf uitdempt, en een zijwaartse snelheid (`car.duw`) die de banden in een paar tienden opeten.
    Rijdt er iets tegen jou aan (verkeer, de politie), dan telt zijn snelheid mee: een stilstaande auto in de flank
    geraakt schuift opzij en draait. De positie blijft van `resolveCollisions`: nooit door een muur, en de hoogte komt
    nog steeds uit `zetNeer` (nooit door de grond).

 2. De motor (`werkBakBij`). Vijf versnellingen per soort (`BAK`), een toerental tussen stationair en de rode streep,
    opschakelen bij `op`, terugschakelen als de lagere versnelling onder `terug` van dat toerental zou zakken. Tijdens
    het schakelen (`schakel` s) valt het gas even weg. De verhoudingen staan als deel van de topsnelheid (`f`), dus een
    opgevoerde motor (js/tuning.js, +12 % top) schakelt vanzelf op hogere snelheden; de vijfde heeft een gasfactor 1,
    zodat de topsnelheid uit `RIJ` precies blijft wat hij was.

 3. De camera (`RijCamera`). Boven `CAM.vanaf` gaat de beeldhoek geleidelijk tot `CAM.fov` graden wijder, en boven
    `CAM.trilVanaf` trilt het beeld een paar millimeter. Niet in een filmbeeld, de heli, de drone of stilstaand spel:
    dan is het meteen nul.
*/

export const BOTS = {
  terug: 0.18,        // hoeveel van de snelheid recht op de muur af terugkaatst
  wrijving: 0.35,     // wrijving langs de muur, als deel van de klap recht erop
  draai: 0.22,        // hoe sterk een klap buiten het midden de auto laat draaien
  maxTol: 2.6,        // rad/s, de hardste draai
  tolDemp: 1.9,       // per seconde: de draai dempt uit (na 2 s nog 2 %)
  zijGrip: 8,         // m/s²: zo snel eten de banden een zijwaartse snelheid op
  maxDuw: 7,          // m/s, de hardste zijwaartse duw
  glij: 0.7,          // s na een klap met weinig grip (de rijrichting loopt achter op de neus)
  klapVanaf: 2.2,     // m/s recht op de muur af: vanaf hier is het een klap (geluid, schok, deuk)
  klapRust: 0.3,      // s tussen twee klappen, anders klapt een schuivende auto elk beeld
  anderen: 0.6,       // hoeveel van de snelheid van een auto die jou raakt op jou overgaat
};

/*
 De versnellingsbak per soort. `f`: bij welke snelheid (deel van de topsnelheid) de versnelling de rode streep haalt.
 `gas`: de trek per versnelling (de eerste twee iets feller), de vijfde altijd 1.
*/
const STANDAARD = { stationair: 850, rood: 6200, op: 5600, terug: 0.62, f: [0.24, 0.42, 0.62, 0.82, 1.08], gas: [1.16, 1.08, 1.03, 1, 1], schakel: 0.15, klok: 8 };
export const BAK = {
  hatch: STANDAARD, bx: STANDAARD, van: STANDAARD, ambulance: STANDAARD,
  gti: { stationair: 900, rood: 7000, op: 6500, terug: 0.6, f: [0.2, 0.36, 0.54, 0.74, 1.0], gas: [1.14, 1.08, 1.03, 1, 1], schakel: 0.16, klok: 8 },
  truck: { stationair: 600, rood: 3200, op: 2900, terug: 0.62, f: [0.22, 0.4, 0.6, 0.8, 1.05], gas: [1.1, 1.05, 1, 1, 1], schakel: 0.32, klok: 8 },
  vuilnis: { stationair: 600, rood: 3200, op: 2900, terug: 0.62, f: [0.22, 0.4, 0.6, 0.8, 1.05], gas: [1.1, 1.05, 1, 1, 1], schakel: 0.32, klok: 8 },
  ferrari: { stationair: 1000, rood: 8500, op: 8000, terug: 0.6, f: [0.17, 0.31, 0.47, 0.67, 0.95], gas: [1.12, 1.07, 1.03, 1, 1], schakel: 0.12, klok: 10 },
};
export function bakVan(car) { return BAK[car && car.soort] || STANDAARD; }

/*
 Het toerental en de versnelling bijwerken. Geeft de gasfactor terug voor `drive` (per versnelling iets anders, en
 tijdens het schakelen minder). Zet `car.versnelling` (−1 achteruit, 1…5), `car.toeren` (omw/min), `car.schakelT`.
*/
export function werkBakBij(car, dt, gas) {
  const B = bakVan(car);
  const top = Math.max(1, car.topSnelheid || 24);
  const v = car.speed || 0, sv = Math.abs(v);
  if (car.versnelling === undefined || car.versnelling === 0) car.versnelling = 1;
  if (car.toeren === undefined) car.toeren = B.stationair;
  car.schakelT = Math.max(0, (car.schakelT || 0) - dt);
  const rpm = (g) => (sv / (top * B.f[g - 1])) * B.rood;
  let doel;
  if (v < -0.2) {
    car.versnelling = -1;
    doel = Math.max(B.stationair, (sv / (top * 0.28)) * 0.75 * B.rood);
  } else {
    if (car.versnelling < 1) car.versnelling = 1;
    let g = car.versnelling;
    if (car.schakelT <= 0) {
      if (g < 5 && rpm(g) >= B.op) { g++; car.schakelT = B.schakel; }
      else if (g > 1 && rpm(g - 1) < B.op * B.terug) { g--; car.schakelT = B.schakel * 0.6; }
      // hard remmen: in één keer een paar terug
      while (g > 1 && rpm(g - 1) < B.op * B.terug * 0.7) g--;
    }
    car.versnelling = g;
    doel = rpm(g);
    // optrekken uit stilstand: de koppeling slipt, de motor draait al op toeren
    if (g === 1 && gas) doel = Math.max(doel, B.stationair + 0.38 * (B.rood - B.stationair));
    doel = Math.max(B.stationair, doel);
  }
  doel = Math.min(B.rood * 1.02, doel);
  // de naald volgt snel maar niet in één beeld; bij schakelen valt hij zichtbaar terug
  car.toeren += (doel - car.toeren) * Math.min(1, dt * 25);
  car.toerenRood = B.rood; car.toerenStationair = B.stationair; car.toerenKlok = B.klok;
  if (car.versnelling < 0) return 1;
  const f = B.gas[car.versnelling - 1] ?? 1;
  return car.schakelT > 0 && gas ? f * 0.5 : f;
}

/*
 Een klap verwerken. `nx, nz`: de normaal van wat je raakte (van het obstakel naar de auto, genormaliseerd).
 `ander`: de snelheid {x, z} van wat jou raakte (of null voor iets vasts). Werkt car.speed, car.rij, car.duw en
 car.tol bij en geeft de snelheid recht op het obstakel terug (m/s, ≥ 0): de kracht van de klap.
*/
export function botsReactie(car, nx, nz, ander = null) {
  const fx = -Math.sin(car.yaw), fz = -Math.cos(car.yaw);
  const rx = -fz, rz = fx;                                     // dwars op de auto
  const d = car.duw || { x: 0, z: 0 };
  // de snelheid van de auto in de wereld: langs de rijrichting plus de zijwaartse duw
  const vx = -Math.sin(car.rij ?? car.yaw) * car.speed + d.x;
  const vz = -Math.cos(car.rij ?? car.yaw) * car.speed + d.z;
  const ax = ander ? ander.x * BOTS.anderen : 0, az = ander ? ander.z * BOTS.anderen : 0;
  // relatieve snelheid langs de normaal: negatief = erin
  const relX = vx - ax, relZ = vz - az;
  const vn = relX * nx + relZ * nz;
  if (vn >= -0.05) return 0;
  // recht op de muur af: eraf, en een stukje terug
  const dvn = -(1 + BOTS.terug) * vn;
  let wx = vx + nx * dvn, wz = vz + nz * dvn;
  // langs de muur: wrijving, nooit meer dan wat er langs gaat
  const tx = relX - vn * nx, tz = relZ - vn * nz, tl = Math.hypot(tx, tz);
  let wrijf = 0;
  if (tl > 1e-3) {
    wrijf = Math.min(tl, BOTS.wrijving * dvn);
    wx -= (tx / tl) * wrijf; wz -= (tz / tl) * wrijf;
  }
  // het punt waar de klap aangrijpt: de neus (normaal tegen de rijrichting in), de kont, of het midden van de flank
  const nf = nx * fx + nz * fz;
  const as = car.as || 1.4;
  const arm = -as * Math.max(-1, Math.min(1, nf * 2.5));
  const half = (car.breedte || 1.78) / 2;
  const nr = nx * rx + nz * rz;
  const px = fx * arm - nx * half * Math.abs(nr), pz = fz * arm - nz * half * Math.abs(nr);
  // de stoot (snelheidsverandering) en zijn moment om de as omhoog: τ = p.z·J.x − p.x·J.z
  const Jx = wx - vx, Jz = wz - vz;
  const moment = pz * Jx - px * Jz;
  const traag = (as * as * 4 + (car.breedte || 1.78) ** 2) / 12 + as * 0.6;
  car.tol = Math.max(-BOTS.maxTol, Math.min(BOTS.maxTol, (car.tol || 0) + (moment / traag) * BOTS.draai * 2));
  // de nieuwe snelheid terug naar de rijrichting (car.speed) en zijwaarts (car.duw)
  const langs = wx * fx + wz * fz;
  const dwars = wx * rx + wz * rz;
  car.speed = langs;
  car.rij = car.yaw;
  const dw = Math.max(-BOTS.maxDuw, Math.min(BOTS.maxDuw, dwars));
  car.duw = { x: rx * dw, z: rz * dw };
  car.glijT = BOTS.glij;
  car.botsVoor = nf < 0;
  return -vn;
}

/*
 Wat er na de klap doorloopt, elk beeld vóór de nieuwe plek: de draai op de koers en de zijwaartse duw die de banden
 opeten. Geeft de verplaatsing van de duw in dit beeld terug.
*/
export function werkNaBij(car, dt) {
  car.glijT = Math.max(0, (car.glijT || 0) - dt);
  car.botsRust = Math.max(0, (car.botsRust || 0) - dt);
  if (car.tol) {
    car.yaw += car.tol * dt;
    car.tol *= Math.exp(-BOTS.tolDemp * dt);
    // een rijdende auto met grip trekt de draai sneller recht
    if (!car.glijT) car.tol *= Math.exp(-2.5 * dt);
    if (Math.abs(car.tol) < 0.02) car.tol = 0;
  }
  const d = car.duw;
  if (!d) return { x: 0, z: 0 };
  const l = Math.hypot(d.x, d.z);
  if (l < 0.05) { car.duw = null; return { x: 0, z: 0 }; }
  const uit = { x: d.x * dt, z: d.z * dt };
  const k = Math.max(0, l - BOTS.zijGrip * dt) / l;
  d.x *= k; d.z *= k;
  return uit;
}

/*
 De camera met de snelheid. `update(dt, snelheid, mag)` met de snelheid in m/s; `mag` is onwaar in een filmbeeld,
 de heli, de drone of buiten de auto (dan valt alles meteen weg). `fov` is het aantal graden extra beeldhoek,
 `trilX/trilY/trilRol` de trilling voor de camera (meters en radialen).
*/
export const CAM = {
  vanaf: 12,          // m/s (43 km/u): daaronder geen extra beeldhoek
  tot: 55,            // m/s (200 km/u): daar de volle extra beeldhoek
  fov: 9,             // graden extra, hooguit
  tempo: 0.9,         // per seconde: zo snel loopt de beeldhoek mee (geleidelijk)
  trilVanaf: 22,      // m/s (80 km/u)
  tril: 0.012,        // m, de grootste uitslag
  rol: 0.0018,        // rad, de grootste rol
};
export class RijCamera {
  constructor() { this.fov = 0; this.tril = 0; this.t = 0; this.trilX = 0; this.trilY = 0; this.trilRol = 0; }
  update(dt, snelheid, mag) {
    this.t += dt;
    if (!mag) { this.fov = 0; this.tril = 0; this.trilX = this.trilY = this.trilRol = 0; return; }
    const v = Math.abs(snelheid || 0);
    const deel = Math.max(0, Math.min(1, (v - CAM.vanaf) / (CAM.tot - CAM.vanaf)));
    const doel = CAM.fov * deel * deel * (3 - 2 * deel);
    this.fov += (doel - this.fov) * Math.min(1, dt * CAM.tempo);
    const trilDoel = Math.max(0, Math.min(1, (v - CAM.trilVanaf) / (CAM.tot - CAM.trilVanaf)));
    this.tril += (trilDoel - this.tril) * Math.min(1, dt * 1.5);
    // een paar trage golven door elkaar (7–13 Hz), geen ruis: ruis leest als een storing
    const t = this.t, a = this.tril;
    this.trilX = (Math.sin(t * 47) * 0.5 + Math.sin(t * 71 + 1.3) * 0.3 + Math.sin(t * 83 + 0.4) * 0.2) * a * CAM.tril;
    this.trilY = (Math.sin(t * 53 + 2.1) * 0.55 + Math.sin(t * 79) * 0.45) * a * CAM.tril;
    this.trilRol = Math.sin(t * 41 + 0.7) * a * CAM.rol;
  }
  zetOp(cam) {
    if (!this.tril) return;
    cam.position.x += this.trilX; cam.position.y += this.trilY; cam.rotation.z += this.trilRol;
  }
}
