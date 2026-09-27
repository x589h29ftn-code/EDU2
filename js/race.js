/*
 De race van missie 14: van de Lemmerweg bij BP naar IJlst (verzoek 27 sep 2026:
 "de race vanaf ongeveer BP weg naar IJlst toe en bij IJlst is einde").

 Het parcours komt uit de routeplanner van de navigatie (js/navigatie.js) over
 de wegassen van de kaart: de Lemmerweg af naar het zuiden, over de rotonde, de
 Sudergoweg op (anderhalve kilometer rechtdoor) en door De Sânhorst en De Kling
 naar de Poiesz aan De Dassenboarch. Dat is een lijn van punten met knikken op
 de kruispunten; hij wordt hier om de twee meter opnieuw bemonsterd en een
 beetje gladgestreken, zodat de tegenstanders er vloeiend overheen gaan.

 De tegenstanders rijden niet met het rijgedrag van de speler (js/vehicles.js
 `drive`) maar langs de lijn: afstand s, een snelheid die per stuk weg uit de
 bocht volgt (v = √(a / κ), nooit harder dan hun top, en op tijd remmen voor de
 volgende bocht), en een vaste plek opzij van de as. Zo raken ze nooit vast aan
 een lantaarnpaal en rijden ze elke keer dezelfde race — dat is ook wat de proef
 nodig heeft. De speler rijdt gewoon zelf.

 Controlepunten: een gele ring over de weg om de driehonderd meter. De eerstvolgende
 is fel, die daarna flauw; wie er niet door rijdt komt niet verder. De laatste is de
 finish bij de Poiesz, met een geblokte boog over de weg.

 Alles wat hier getekend wordt, wordt bij het opstarten gemaakt en verborgen neergezet
 (een materiaal dat pas midden in het spel ontstaat, hapert; zie js/world.js).
*/
import * as THREE from 'three';
import { Navigatie } from './navigatie.js';

// ---------- het parcours ----------
export const RACE = {
  van: [741, 175],             // de Lemmerweg bij BP
  naar: [-1090, 1298],         // de Sudergoweg bij de Poiesz in IJlst
  stap: 2,                     // bemonstering van de lijn (m)
  glad: 4,                     // zoveel monsters naar weerskanten middelen
  startS: 62,                  // de startlijn, voorbij de eerste bocht van de afrit
  vak: 9,                      // afstand tussen twee auto's op de grid (m)
  cpElke: 300,                 // afstand tussen de controlepunten (m)
  cpStraal: 11,                // zo dicht bij het hart van een ring telt hij (m)
  ringStraal: 4.4,
  remmen: 8.5,                 // m/s² waarmee een tegenstander voor een bocht remt
  /*
   Tussen de rotonde en de kruising met de Sudergoweg kiest de routeplanner de
   smalle parallelweg (4,5 m) ten westen van de hoofdweg: de hoofdweg zelf, een
   rijbaan van zeven meter, heeft in de kaart geen wegas. Die parallelweg steekt
   halverwege in een S-bocht met paaltjes het fietspad over, en daar reed de
   automaat van de proef twaalf keer tegenaan. Over dit stuk gaat de race daarom
   over de middellijn van de hoofdweg, gemeten uit het rijbaanvlak van de BGT:
   per rij van vier meter een strook asfalt tussen x0 en x1: bij de rotonde de
   oostelijkste, en daarna steeds die het dichtst bij de vorige ligt. (Alleen de
   oostelijkste nemen ging bij z ≈ 900 de afrit naar het oosten op.)
  */
  hoofdweg: { z0: 440, z1: 1040, x0: 630, x1: 740, rij: 4 },
};

function inRing(x, z, r) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i], b = r[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
// de middellijn van de hoofdweg: per rij de stroken asfalt, en daarvan die van de vorige rij
function hoofdwegLijn(KAART) {
  const H = RACE.hoofdweg;
  const vlakken = (KAART.vlakken || []).filter(v => v.k === 'rijbaan' && v.r[0].some(p => p[0] > H.x0 && p[0] < H.x1 && p[1] > H.z0 - 10 && p[1] < H.z1 + 10));
  const uit = [];
  for (let z = H.z0; z <= H.z1; z += H.rij) {
    const stroken = [];
    let begin = null;
    for (let x = H.x0; x <= H.x1; x += 0.5) {
      const erin = vlakken.some(v => inRing(x, z, v.r[0]));
      if (erin && begin == null) begin = x;
      if (!erin && begin != null) { stroken.push([begin, x]); begin = null; }
    }
    if (begin != null) stroken.push([begin, H.x1]);
    // alleen stroken van een echte rijbaan breed; de oostelijkste daarvan
    const breed = stroken.filter(([a, b]) => b - a >= 5.5);
    if (!breed.length) continue;
    const vorig = uit.length ? uit[uit.length - 1][0] : Infinity;
    let beste = breed[breed.length - 1];
    if (uit.length) for (const q of breed) if (Math.abs((q[0] + q[1]) / 2 - vorig) < Math.abs((beste[0] + beste[1]) / 2 - vorig)) beste = q;
    const m = (beste[0] + beste[1]) / 2;
    // een sprong van meer dan drie meter is geen weg meer: daar houdt het op
    if (uit.length && Math.abs(m - vorig) > 3) break;
    uit.push([m, z]);
  }
  return uit;
}

/*
 De drie tegenstanders: top in m/s, dwarsversnelling in de bocht, optrekken, en
 hun plek opzij van de as (m, rechts positief). 42 m/s is 150 km/u: veel sneller
 dan elke gewone auto in dit spel (80), trager dan de Ferrari (200). Met 47 m/s
 (170) werd de Ferrari in de proef vierde: een speler moet dan foutloos door elke
 bocht, en dat is geen race meer maar een examen.
*/
export const TEGENSTANDERS = [
  { naam: 'de zwarte Ferrari', soort: 'ferrari', kleur: 0x141518, top: 42, dwars: 8.5, trek: 7.0, opzij: -1.4 },
  { naam: 'de witte Golf', soort: 'hatch', kleur: 0xe9eaec, top: 40, dwars: 8.0, trek: 6.4, opzij: -1.4 },
  { naam: 'de blauwe BX', soort: 'bx', kleur: 0x1f4f9a, top: 38, dwars: 7.5, trek: 6.0, opzij: 1.4 },
];
// de speler staat tweede op de grid, rechts; om en om links en rechts
const SPELER_VAK = 1, SPELER_OPZIJ = 1.4;

function bouwLijn(KAART) {
  const nav = new Navigatie(KAART.wegassen);
  let ruw = nav.route(RACE.van, RACE.naar);
  if (!ruw || ruw.length < 2) return null;
  // het stuk langs de parallelweg vervangen door de hoofdweg (zie RACE.hoofdweg)
  const H = RACE.hoofdweg, weg = hoofdwegLijn(KAART);
  if (weg.length > 10) {
    const i0 = ruw.findIndex(p => p[1] > H.z0);
    const eind = weg[weg.length - 1][1];
    let i1 = i0;
    while (i1 < ruw.length && ruw[i1][1] < eind + 8) i1++;
    if (i0 > 0 && i1 < ruw.length) ruw = [...ruw.slice(0, i0), ...weg, ...ruw.slice(i1)];
  }
  // dubbele punten eruit
  const p = [ruw[0]];
  for (const q of ruw) if (Math.hypot(q[0] - p[p.length - 1][0], q[1] - p[p.length - 1][1]) > 0.5) p.push(q);
  // om de twee meter bemonsteren
  const mon = [];
  let rest = 0;
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], b = p[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let t = rest;
    while (t < L) { mon.push([a[0] + (b[0] - a[0]) * t / L, a[1] + (b[1] - a[1]) * t / L]); t += RACE.stap; }
    rest = t - L;
  }
  mon.push(p[p.length - 1]);
  // gladstrijken: een voortschrijdend gemiddelde, de uiteinden blijven staan
  const g = RACE.glad, n = mon.length;
  const x = new Float32Array(n), z = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sx = 0, sz = 0, k = 0;
    for (let j = Math.max(0, i - g); j <= Math.min(n - 1, i + g); j++) { sx += mon[j][0]; sz += mon[j][1]; k++; }
    x[i] = sx / k; z[i] = sz / k;
  }
  // afstand langs de lijn en de richting
  const s = new Float32Array(n), tx = new Float32Array(n), tz = new Float32Array(n);
  for (let i = 1; i < n; i++) s[i] = s[i - 1] + Math.hypot(x[i] - x[i - 1], z[i] - z[i - 1]);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 2), b = Math.min(n - 1, i + 2);
    const dx = x[b] - x[a], dz = z[b] - z[a], l = Math.hypot(dx, dz) || 1;
    tx[i] = dx / l; tz[i] = dz / l;
  }
  // kromming: de draai van de richting over zes meter
  const k = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 3), b = Math.min(n - 1, i + 3);
    let d = Math.atan2(tz[b], tx[b]) - Math.atan2(tz[a], tx[a]);
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    k[i] = Math.abs(d) / Math.max(1, s[b] - s[a]);
  }
  return { x, z, s, tx, tz, k, n, lengte: s[n - 1] };
}

// het snelheidsprofiel van één tegenstander: v(s) per monster
function profiel(lijn, t) {
  const v = new Float32Array(lijn.n);
  for (let i = 0; i < lijn.n; i++) {
    // de kromming over twintig meter vooruit telt: hij remt vóór de bocht
    let kmax = 0;
    for (let j = i; j < Math.min(lijn.n, i + 10); j++) kmax = Math.max(kmax, lijn.k[j]);
    v[i] = Math.min(t.top, Math.sqrt(t.dwars / Math.max(kmax, 1e-4)));
  }
  for (let i = lijn.n - 2; i >= 0; i--) {
    const ds = lijn.s[i + 1] - lijn.s[i];
    v[i] = Math.min(v[i], Math.sqrt(v[i + 1] * v[i + 1] + 2 * RACE.remmen * ds));
  }
  return v;
}

// ---------- doeken ----------
function finishDoek() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < 64; i++) for (let j = 0; j < 8; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#f4f4f4'; g.fillRect(i * 16, j * 16, 16, 16); }
  g.fillStyle = '#111'; g.fillRect(300, 18, 424, 92);
  g.fillStyle = '#ffd21f'; g.font = 'bold 70px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('FINISH · IJLST', 512, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * De race opzetten. `vehicles` om de tegenstanders neer te zetten; de lijn wordt
 * pas uitgerekend als hij voor het eerst nodig is (de routeplanner kost even).
 */
export function initRace({ scene, vehicles, KAART }) {
  let lijn = null;
  const lijnNu = () => (lijn || (lijn = KAART ? bouwLijn(KAART) : null));

  // ---- de ringen en de finish, verborgen tot de race ----
  const ringGeo = new THREE.TorusGeometry(RACE.ringStraal, 0.26, 10, 56);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd21f, transparent: true, opacity: 0.9, depthWrite: false });
  const ringMatFlauw = new THREE.MeshBasicMaterial({ color: 0xffd21f, transparent: true, opacity: 0.3, depthWrite: false });
  const ringen = [ringMat, ringMatFlauw].map(m => {
    const r = new THREE.Mesh(ringGeo, m);
    r.visible = false; r.renderOrder = 3;
    scene.add(r);
    return r;
  });
  const finish = new THREE.Group();
  {
    const paal = new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.5, metalness: 0.4 });
    const doek = new THREE.MeshStandardMaterial({ map: finishDoek(), emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.7, side: THREE.DoubleSide });
    doek.emissiveMap = doek.map;
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6.2, 0.3), paal);
      p.position.set(s * 6, 3.1, 0); p.castShadow = true;
      finish.add(p);
    }
    const band = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.5), doek);
    band.position.set(0, 5.4, 0);
    finish.add(band);
  }
  finish.visible = false;
  scene.add(finish);

  // ---- de tegenstanders: pas bij de eerste race neergezet, daarna hergebruikt ----
  const rijders = TEGENSTANDERS.map(t => ({ ...t, car: null, s: 0, v: 0, prof: null, klaar: false, tijd: null }));
  let cps = [];            // de s van elk controlepunt; de laatste is de finish
  let cpNu = 0;            // het eerstvolgende controlepunt van de speler
  let spelerS = 0, spelerI = 0;
  let loopt = false, klok = 0, spelerTijd = null;

  // een plek op de lijn: s langs de as, u opzij (rechts positief)
  function punt(s, u = 0) {
    const L = lijnNu();
    if (!L) return null;
    s = Math.max(0, Math.min(L.lengte, s));
    // binair zoeken naar het monster
    let a = 0, b = L.n - 1;
    while (b - a > 1) { const m = (a + b) >> 1; if (L.s[m] <= s) a = m; else b = m; }
    const f = L.s[b] > L.s[a] ? (s - L.s[a]) / (L.s[b] - L.s[a]) : 0;
    const x = L.x[a] + (L.x[b] - L.x[a]) * f, z = L.z[a] + (L.z[b] - L.z[a]) * f;
    const tx = L.tx[a], tz = L.tz[a];
    // rechts van de rijrichting: (−tz, tx) in dit assenstelsel (+x oost, +z zuid)
    return { x: x - tz * u, z: z + tx * u, tx, tz, i: a, yaw: Math.atan2(-tx, -tz) };
  }

  // waar ben je langs de lijn? Gezocht rond de vorige plek, zodat een lus in de weg niet verwart
  function voortgang(x, z, rond = null) {
    const L = lijnNu();
    if (!L) return { s: 0, i: 0, af: Infinity };
    let beste = 0, bd = Infinity;
    const i0 = rond == null ? 0 : Math.max(0, rond - 60), i1 = rond == null ? L.n - 1 : Math.min(L.n - 1, rond + 120);
    for (let i = i0; i <= i1; i++) {
      const d = (L.x[i] - x) ** 2 + (L.z[i] - z) ** 2;
      if (d < bd) { bd = d; beste = i; }
    }
    return { s: L.s[beste], i: beste, af: Math.sqrt(bd) };
  }

  function zetRingen() {
    for (let k = 0; k < 2; k++) {
      const r = ringen[k], i = cpNu + k;
      // (de laatste ring hangt in de finishboog)
      if (i >= cps.length) { r.visible = false; continue; }
      const p = punt(cps[i]);
      r.position.set(p.x, RACE.ringStraal + 0.4, p.z);
      r.rotation.set(0, Math.atan2(p.tx, p.tz), 0);
      r.visible = true;
    }
  }

  /*
   Klaarzetten op de grid. Levert de plek van de speler (zijn auto zet het verhaal
   daar zelf neer) en van de kant van de weg voor wie er staat te kijken.
  */
  function klaarzetten() {
    const L = lijnNu();
    if (!L) return null;
    cps = [];
    for (let s = RACE.startS + RACE.cpElke; s < L.lengte - RACE.cpElke * 0.5; s += RACE.cpElke) cps.push(s);
    cps.push(L.lengte - 8);                      // de finish
    cpNu = 0; loopt = false; klok = 0; spelerTijd = null;
    rijders.forEach((r, k) => {
      const vak = k < SPELER_VAK ? k : k + 1;   // de speler staat tweede
      r.s = RACE.startS - 4 - vak * RACE.vak;
      r.v = 0; r.klaar = false; r.tijd = null;
      if (!r.prof) r.prof = profiel(L, r);
      const p = punt(r.s, r.opzij);
      if (!r.car) {
        r.car = vehicles.voegToe({ x: p.x, z: p.z, yaw: p.yaw, soort: r.soort, kleur: r.kleur, driveable: false });
        r.car.racer = true;
      }
      r.car.x = p.x; r.car.z = p.z; r.car.yaw = p.yaw; r.car.speed = 0;
      r.car.mesh.visible = true;
      vehicles.zetNeer(r.car, 0.016, p.yaw);
    });
    const f = punt(L.lengte - 8);
    // het doek kijkt naar wie eraan komt (anders lees je FINISH in spiegelschrift)
    finish.position.set(f.x, 0, f.z); finish.rotation.y = Math.atan2(f.tx, f.tz) + Math.PI;
    finish.visible = true;
    zetRingen();
    const speler = punt(RACE.startS - 4 - SPELER_VAK * RACE.vak, SPELER_OPZIJ);
    return {
      speler, start: punt(RACE.startS),
      kant: punt(RACE.startS + 3, -9), kantAuto: punt(RACE.startS + 10, -8.5),
      // bij de finish aan de rechterkant: links ligt de oever van de vaart
      eind: punt(L.lengte - 8), eindKant: punt(L.lengte - 16, 9), eindAuto: punt(L.lengte - 26, 8.5),
    };
  }

  function start() { loopt = true; klok = 0; zetRingen(); }

  function ruimOp() {
    loopt = false;
    for (const r of ringen) r.visible = false;
    finish.visible = false;
    for (const r of rijders) if (r.car) {
      r.car.mesh.visible = false; r.car.x = r.car.z = 1e5; r.car.mesh.position.set(1e5, 0, 1e5); r.car.speed = 0;
    }
  }

  /*
   Per beeld. `sp` is waar de speler (of zijn auto) is. Levert de stand: welke
   plek je hebt, hoeveel controlepunten er achter je liggen, of je over de
   finish bent en als hoeveelste.
  */
  function update(dt, sp) {
    const L = lijnNu();
    if (!L) return null;
    for (const r of ringen) if (r.visible) r.scale.setScalar(1 + Math.sin(klok * 5) * 0.03);
    if (!loopt) return stand();
    klok += dt;
    for (const r of rijders) {
      if (!r.car) continue;
      const i = Math.min(L.n - 1, Math.max(0, Math.round(r.s / RACE.stap)));
      const doel = r.klaar ? 0 : r.prof[i];
      const vorig = r.v;
      if (r.v < doel) r.v = Math.min(doel, r.v + r.trek * (1 - r.v / (r.top + 8)) * dt * 1.6);
      else r.v = Math.max(doel, r.v - RACE.remmen * dt);
      r.s = Math.min(L.lengte + 60, r.s + r.v * dt);
      if (!r.klaar && r.s >= cps[cps.length - 1]) { r.klaar = true; r.tijd = klok; }
      const vorigeYaw = r.car.yaw;
      const p = punt(Math.min(r.s, L.lengte), r.opzij);
      r.car.x = p.x; r.car.z = p.z; r.car.yaw = p.yaw; r.car.speed = r.v;
      vehicles.zetNeer(r.car, dt, vorigeYaw, { gas: r.v > vorig, rem: r.v < vorig - 0.02 });
    }
    // de speler: langs de lijn, en door de ringen
    const v = voortgang(sp.x, sp.z, spelerI);
    spelerS = v.s; spelerI = v.i;
    if (spelerTijd == null && cpNu < cps.length) {
      const c = punt(cps[cpNu]);
      if (Math.hypot(sp.x - c.x, sp.z - c.z) < RACE.cpStraal) {
        cpNu++;
        if (cpNu >= cps.length) spelerTijd = klok;
        zetRingen();
        return { ...stand(), door: true };
      }
    }
    return stand();
  }

  function stand() {
    // de plek: wie verder langs de lijn is, of al over de finish, staat vóór je
    const klaar = spelerTijd != null;
    let voor = 0;
    for (const r of rijders) {
      if (!r.car) continue;
      if (klaar) { if (r.klaar && r.tijd < spelerTijd) voor++; }
      else if (r.klaar || r.s > spelerS) voor++;
    }
    return { plek: voor + 1, van: rijders.length + 1, cp: cpNu, cps: cps.length, klaar, tijd: spelerTijd, klok,
      eersteKlaar: rijders.some(r => r.klaar), afstand: spelerS };
  }

  return {
    klaarzetten, start, update, ruimOp, punt, voortgang, stand,
    get lijn() { return lijnNu(); },
    get lengte() { const L = lijnNu(); return L ? L.lengte : 0; },
    get controlepunten() { return cps.slice(); },
    get cpNu() { return cpNu; },
    get rijders() { return rijders; },
    get ringen() { return ringen; },
    get finish() { return finish; },
    get loopt() { return loopt; },
  };
}
