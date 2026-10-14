/*
 Het verkeer gedraagt zich (stap 173, gevraagd: "Voorrang op kruisingen en rotondes,
 wachten voor overstekende voetgangers, en uitwijken of stoppen als jij dwars staat in
 plaats van door te rijden").

 Het verkeer rijdt op rails: elke auto over één gladde as (`gladPad` in js/vehicles.js),
 aan het eind keert hij. Deze module zegt per auto per beeld hoe hard hij hooguit mag
 (`doel`), en wisselt bij een rotonde het pad (`naStap`). js/vehicles.js roept dat aan
 vanuit `updateTraffic`; de rest van het rijden (bochten, keren, afstand tot de
 voorganger, de voetgangers) blijft daar.

 1. Kruisingen. Een knoop is een punt waar minstens drie stukken rijbaan samenkomen (een
    as die er doorheen loopt telt voor twee). Wie er binnen KRUIS.kijk meter op afrijdt,
    staat in de lijst van die knoop. Voorrang: wie al op de kruising staat; dan het
    doorgaande verkeer (de N7) op de wijk; dan de bredere weg (KRUIS.breder meter breder);
    anders rechts gaat voor. Wie moet wachten, remt naar de stopstreep. Het vangnet: wie
    KRUIS.vangnet tellen stilstaat terwijl niemand op de kruising staat, gaat (`_forceer`),
    en de anderen zien hem dan als iemand die al op de kruising staat. Vier auto's die
    allemaal iemand van rechts hebben, lossen het zo op.
 2. Rotondes. js/schaduw.js `rotondes` vindt ze (een rijbaanvlak met een rond gat). Een as
    die de rotonde in loopt (of erop eindigt), krijgt bij de rand een eigen stuk pad: een
    bocht naar rechts de ring op, tegen de klok in om het eiland (eiland links), en een
    bocht naar rechts eruit — terug op dezelfde as aan de overkant, of op de andere strook
    als de as op de rotonde eindigde. Wie de ring op wil, wacht aan de rand als er al
    iemand op de ring aankomt (ROT.hoek radialen of ROT.dicht meter vóór zijn invoegpunt).
    Assen die zelf vooral ring zijn, gaan uit de voorraad van rijbanen.
 3. Stilstaande auto's op de rijbaan (de auto van de speler, achtergelaten of dwars, een
    wrak, een geparkeerde auto die uitsteekt): gemeten met de maat en de draaiing van die
    auto, niet als punt. Het verkeer stopt BLOK.stop meter ervoor, toetert na een tijdje,
    en wijkt na BLOK.wacht tellen uit over de andere strook als daar plaats is en er
    niemand aankomt; anders keert het na BLOK.keer tellen. Voetgangers en de speler te voet
    blijven in js/vehicles.js (`vrijMens`, `inDeWeg`): die werkten al, `voorrangtest` meet het.

 Werk per beeld: per auto een paar knopen langs zijn eigen pad (vooraf per pad
 uitgerekend en op het pad onthouden), een lijst per knoop, en de auto's in het rooster
 binnen twintig meter. Geen ronde over alle paren.
*/
import { gladPad } from './vehicles.js';
import { rotondes } from './schaduw.js';
import { autoMaat } from './carmodel.js';

export const KRUIS = { kijk: 28, rem: 3.5, breder: 1, vangnet: 5, rechts: 0.3, tegen: 0.7 };
export const ROT = { recht: 0.5, band: 9, raak: 4, kijk: 30, hoek: 1.9, dicht: 7, ringPad: 0.6, rem: 2.6 };
export const MENS = { stop: 2.6 };
export const BLOK = { kijk: 18, marge: 0.25, stop: 7, stopRijdt: 2, rem: 4, wacht: 2.5, keer: 6, schuin: 0.6, uitTempo: 3, claxon: 1.5, draai: 0.8, vast: 15 };

const TWEE_PI = Math.PI * 2;
const mod2pi = (a) => ((a % TWEE_PI) + TWEE_PI) % TWEE_PI;

// de maat van een auto (halve lengte en breedte), per soort één keer uit js/carmodel.js
const MATEN = new Map();
function maatVan(soort) {
  const s = soort || 'hatch';
  let m = MATEN.get(s);
  if (!m) {
    try { const a = autoMaat(s); m = { hl: a.L / 2, hw: a.W / 2 }; } catch { m = null; }
    if (!m || !(m.hl > 0)) m = s === 'vuilnis' ? { hl: 4.3, hw: 1.25 } : s === 'truck' ? { hl: 3.6, hw: 1.2 } : s === 'tiger' ? { hl: 3.2, hw: 1.8 } : { hl: 2.15, hw: 0.9 };
    MATEN.set(s, m);
  }
  return m;
}

const sleutel = (x, y) => x.toFixed(1) + ',' + y.toFixed(1);

export class Verkeersregels {
  constructor(KAART, vehicles = null) {
    this.V = vehicles;
    this.aan = true;
    this.rotondes = [];
    this.knopen = [];
    this.breedtes = new Map();
    this.stats = { wachtKruis: 0, wachtRotonde: 0, blok: 0, uitwijk: 0, keer: 0, forceer: 0, rondjes: 0, vast: 0 };
    if (KAART) this.bouw(KAART);
    if (vehicles) this.koppel(vehicles);
  }

  koppel(V) {
    this.V = V;
    V.regels = this;
    // een as die vooral ring is, rijdt niemand meer heen en weer (dan reed de helft met de klok mee)
    if (V.rijbanen) V.rijbanen = V.rijbanen.filter(p => !this.isRing(p));
    return this;
  }

  // ------------------------------------------------------------------ vooraf
  bouw(KAART) {
    // rotondes: een dubbel gevonden eiland (twee gaten om hetzelfde midden) telt één keer, de grootste
    const rot = [];
    for (const o of rotondes(KAART)) {
      const dubbel = rot.find(q => Math.hypot(q.x - o.x, q.z - o.z) < 5);
      if (dubbel) { if (o.r > dubbel.r) Object.assign(dubbel, o); } else rot.push({ ...o });
    }
    rot.forEach((o, i) => { o.id = i; });
    this.rotondes = rot;

    const assen = (KAART.wegassen || []).filter(a => a.drive && a.pts && a.pts.length >= 2);
    for (const a of assen) {
      const p0 = a.pts[0], p1 = a.pts[a.pts.length - 1];
      this.breedtes.set(sleutel(p0[0], p0[1]) + '|' + sleutel(p1[0], p1[1]), a.w || 6);
      this.breedtes.set(sleutel(p1[0], p1[1]) + '|' + sleutel(p0[0], p0[1]), a.w || 6);
    }
    // knopen: eerst de eindpunten samenvoegen (binnen 3 m)
    const C = 8, cellen = new Map();
    const knopen = [];
    const celVan = (x, z) => Math.floor(x / C) + ':' + Math.floor(z / C);
    const zoek = (x, z, r) => {
      let beste = null, bd = r;
      const i0 = Math.floor((x - r) / C), i1 = Math.floor((x + r) / C), j0 = Math.floor((z - r) / C), j1 = Math.floor((z + r) / C);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const l = cellen.get(i + ':' + j);
        if (l) for (const k of l) { const d = Math.hypot(k.x - x, k.z - z); if (d < bd) { bd = d; beste = k; } }
      }
      return beste;
    };
    this._zoekKnoop = zoek;
    const voeg = (x, z, w, as) => {
      let k = zoek(x, z, 3);
      if (!k) {
        k = { x, z, graad: 0, w: 0, assen: new Set() };
        knopen.push(k);
        const c = celVan(x, z);
        let l = cellen.get(c); if (!l) cellen.set(c, l = []);
        l.push(k);
      }
      if (!k.assen.has(as)) { k.assen.add(as); k.graad += 1; }
      k.w = Math.max(k.w, w || 0);
    };
    assen.forEach((a, n) => { voeg(a.pts[0][0], a.pts[0][1], a.w, n); const e = a.pts[a.pts.length - 1]; voeg(e[0], e[1], a.w, n); });
    // dan de assen die er doorheen lopen: een T-kruising is een eindpunt midden op een andere as
    const S = 20, segCel = new Map();
    assen.forEach((a, n) => {
      for (let i = 1; i < a.pts.length; i++) {
        const A = a.pts[i - 1], B = a.pts[i];
        const x0 = Math.floor((Math.min(A[0], B[0]) - 2) / S), x1 = Math.floor((Math.max(A[0], B[0]) + 2) / S);
        const z0 = Math.floor((Math.min(A[1], B[1]) - 2) / S), z1 = Math.floor((Math.max(A[1], B[1]) + 2) / S);
        for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
          const c = x + ':' + z;
          let l = segCel.get(c); if (!l) segCel.set(c, l = []);
          l.push([n, i]);
        }
      }
    });
    for (const k of knopen) {
      const l = segCel.get(Math.floor(k.x / S) + ':' + Math.floor(k.z / S));
      if (!l) continue;
      for (const [n, i] of l) {
        if (k.assen.has(n)) continue;
        const a = assen[n], A = a.pts[i - 1], B = a.pts[i];
        const dx = B[0] - A[0], dz = B[1] - A[1], l2 = dx * dx + dz * dz || 1e-9;
        const f = Math.max(0, Math.min(1, ((k.x - A[0]) * dx + (k.z - A[1]) * dz) / l2));
        if (Math.hypot(A[0] + dx * f - k.x, A[1] + dz * f - k.z) > 2) continue;
        k.assen.add(n); k.graad += 2; k.w = Math.max(k.w, a.w || 0);
      }
    }
    // een kruising: drie of meer, en niet op een rotonde (daar gelden de regels van de ring)
    this.knopen = knopen.filter(k => k.graad >= 3 && !rot.some(o => Math.hypot(o.x - k.x, o.z - k.z) < o.r + ROT.band + 6));
    this.knopen.forEach((k, i) => {
      k.id = i;
      // de stopstreep: de halve breedte van de breedste weg op de knoop, plus wat ruimte
      k.r = Math.max(4.5, k.w / 2 + 2.2);
      delete k.assen;
    });
    // en een eigen rooster voor de echte kruisingen
    const kc = new Map();
    for (const k of this.knopen) {
      const c = celVan(k.x, k.z);
      let l = kc.get(c); if (!l) kc.set(c, l = []);
      l.push(k);
    }
    this._kruisCel = kc;
  }

  kruisingBij(x, z, r) {
    const C = 8;
    let beste = null, bd = r;
    for (let i = Math.floor((x - r) / C); i <= Math.floor((x + r) / C); i++)
      for (let j = Math.floor((z - r) / C); j <= Math.floor((z + r) / C); j++) {
        const l = this._kruisCel && this._kruisCel.get(i + ':' + j);
        if (l) for (const k of l) { const d = Math.hypot(k.x - x, k.z - z); if (d < bd) { bd = d; beste = k; } }
      }
    return beste;
  }

  // hoe breed is de weg van dit pad (uit de BGT-as met dezelfde eindpunten)
  breedte(P) {
    if (P._breed !== undefined) return P._breed;
    let w = 6;
    if (P.length >= 2) {
      const a = P[0], b = P[P.length - 1];
      const k = this.breedtes.get(sleutel(a.x, a.y) + '|' + sleutel(b.x, b.y));
      if (k) w = k;
    }
    P._breed = w;
    return w;
  }

  // de kruisingen langs een pad: [{ i, k }] op volgorde, vooraf één keer per pad
  knopenOp(P) {
    if (P._kn) return P._kn;
    const uit = [];
    if (!P.rond) {
      let laatst = null, ld = Infinity;
      for (let i = 0; i < P.length; i++) {
        const k = this.kruisingBij(P[i].x, P[i].y, 3.5);
        if (!k) { laatst = null; continue; }
        const d = Math.hypot(k.x - P[i].x, k.z - P[i].y);
        if (laatst && laatst.k === k) { if (d < ld) { laatst.i = i; ld = d; } continue; }
        laatst = { i, k }; ld = d;
        uit.push(laatst);
      }
    }
    P._kn = uit;
    return uit;
  }

  isRing(P) {
    if (P._ring !== undefined) return P._ring;
    let n = 0;
    for (const q of P) if (this.rotondes.some(o => Math.hypot(q.x - o.x, q.y - o.z) < o.r + ROT.band)) n++;
    P._ring = P.length > 0 && n / P.length > 0.6;
    return P._ring;
  }

  /*
   Waar een pad een rotonde in gaat: per rijrichting een lijst { o, iIn, iUit, dirUit }.
   Een as die op de rotonde eindigt komt er op dezelfde plek weer uit, de andere kant op;
   een as die er doorheen loopt aan de overkant. Op het gladde pad (monsters om de 2 m).
  */
  passages(P) {
    if (P._pas) return P._pas;
    const vooruit = [], achteruit = [];
    const n = P.length;
    if (!P.rond && n > 2 && !this.isRing(P)) {
      for (const o of this.rotondes) {
        const grens = o.r + ROT.band;
        let a = -1, minD = Infinity;
        const sluit = (b) => {
          if (a < 0) return;
          // alleen wie echt de ring op rijdt: dicht bij het eiland, en bij de rand recht op het midden af
          // (een as die er schuin langs scheert, reed eerst een heel rondje met een lus erin)
          const naarMidden = (i, d) => {
            if (!P.raak) return true;
            const dx = o.x - P[i].x, dz = o.z - P[i].y, l = Math.hypot(dx, dz) || 1;
            return (P.raak.tx[i] * d * dx + P.raak.tz[i] * d * dz) / l > ROT.recht;
          };
          const inA = naarMidden(a, 1), inB = naarMidden(b, -1);
          if (minD < o.r + ROT.raak && !(a === 0 && b === n - 1)) {
            if (b === n - 1) { if (inA) vooruit.push({ o, iIn: a, iUit: a, dirUit: -1 }); }
            else if (a === 0) { if (inB) achteruit.push({ o, iIn: b, iUit: b, dirUit: 1 }); }
            else if (inA && inB) { vooruit.push({ o, iIn: a, iUit: b, dirUit: 1 }); achteruit.push({ o, iIn: b, iUit: a, dirUit: -1 }); }
          }
          a = -1; minD = Infinity;
        };
        for (let i = 0; i < n; i++) {
          const d = Math.hypot(P[i].x - o.x, P[i].y - o.z);
          if (d < grens) { if (a < 0) a = i; minD = Math.min(minD, d); } else sluit(i - 1);
        }
        sluit(n - 1);
      }
      vooruit.sort((p, q) => p.iIn - q.iIn);
      achteruit.sort((p, q) => q.iIn - p.iIn);
    }
    P._pas = [vooruit, achteruit];
    return P._pas;
  }

  /*
   Het stuk pad over de rotonde (in de as, zonder strook: de strook komt er in
   `plekOpPad` rechts bij, en rechts is op de ring de buitenkant). Twee hermitebochten
   met de raaklijn van de as aan het begin en eind en die van de ring ertussen, daarna
   door `gladPad`, zodat bochtsnelheid en raaklijn er gewoon bij horen.
  */
  rondje(P, pas, dirIn) {
    const key = dirIn > 0 ? '_padV' : '_padA';
    if (pas[key]) return pas[key];
    const o = pas.o, A = P[pas.iIn], B = P[pas.iUit];
    const raak = (i, d) => {
      if (P.raak) return [P.raak.tx[i] * d, P.raak.tz[i] * d];
      const j = Math.min(P.length - 1, i + 1), h = Math.max(0, j - 1);
      const dx = P[j].x - P[h].x, dz = P[j].y - P[h].y, l = Math.hypot(dx, dz) || 1;
      return [dx / l * d, dz / l * d];
    };
    const dA = raak(pas.iIn, dirIn), dB = raak(pas.iUit, pas.dirUit);
    const thA = Math.atan2(A.y - o.z, A.x - o.x), thB = Math.atan2(B.y - o.z, B.x - o.x);
    let D = mod2pi(thA - thB);
    if (D < 0.2) D += TWEE_PI;
    const m = Math.min(0.55, D / 3), th1 = thA - m, th2 = thB + m, boog = D - 2 * m;
    const R = o.r + ROT.ringPad;
    const ring = (th) => [o.x + R * Math.cos(th), o.z + R * Math.sin(th)];
    const raakRing = (th) => [Math.sin(th), -Math.cos(th)];       // tegen de klok in: de hoek loopt af
    const pts = [];
    const V2 = P[0].constructor;
    const hermite = (p0, t0, p1, t1, eerste) => {
      const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) * 1.1;
      const N = Math.max(4, Math.ceil(L));
      for (let s = eerste ? 0 : 1; s <= N; s++) {
        const u = s / N, u2 = u * u, u3 = u2 * u;
        const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
        pts.push(new V2(h00 * p0[0] + h10 * L * t0[0] + h01 * p1[0] + h11 * L * t1[0],
          h00 * p0[1] + h10 * L * t0[1] + h01 * p1[1] + h11 * L * t1[1]));
      }
      return L;
    };
    const L1 = hermite([A.x, A.y], dA, ring(th1), raakRing(th1), true);
    const nBoog = Math.max(2, Math.ceil(boog * R / 1.5));
    for (let s = 1; s <= nBoog; s++) { const [x, z] = ring(th1 - boog * s / nBoog); pts.push(new V2(x, z)); }
    hermite(ring(th2), raakRing(th2), [B.x, B.y], dB, false);
    const g = gladPad(pts);
    // de raaklijn aan begin en eind precies die van de as: anders draait de neus bij het wisselen van pad in één beeld
    // (de eerste raaklijn was die van de koorde over twee meter bocht: 0,18 rad ernaast)
    g.raak.tx[0] = dA[0]; g.raak.tz[0] = dA[1];
    g.raak.tx[g.length - 1] = dB[0]; g.raak.tz[g.length - 1] = dB[1];
    g.rond = true;
    // waar op dit stuk de ring begint en ophoudt (in monsters van twee meter)
    g.boogBegin = Math.round(L1 / 1.1 / 2);
    g.boogEind = Math.round((L1 / 1.1 + boog * R) / 2);
    g.th1 = th1;
    g.q1 = ring(th1);
    pas[key] = g;
    return g;
  }

  // ------------------------------------------------------------------ per beeld
  voorbereid(V, speler, metModel, dt) {
    this.V = V; this.metModel = metModel || []; this.dt = dt;
    this.speler = speler && !speler.inCar && speler.pos ? speler : null;
    const perKnoop = this.perKnoop = new Map();
    const ring = this.ringAutos = [];
    if (!this.aan) return;
    for (const t of V.traffic) {
      if (t.slaapt || !t._pos) continue;
      t._tVorig = t.t;
      // verhuisd of opnieuw neergezet (js/vehicles.js `zetOp`): wat hier liep geldt niet meer
      if (t.rond && t.path !== t.rond.pad) { t.bounce = t.rond.bounce; t.rond = null; }
      if (t.uitwijk && t.path !== t.uitwijk.pad) { t.lane = t.uitwijk.lane0; t.uitwijk = null; t.vLane = 0; t.zijHoek = 0; }  // (verhuisd: niet in beeld)
      if (t.rond) { ring.push(t); t._kn = null; continue; }
      const kn = this.volgendeKnoop(t);
      t._kn = kn;
      if (!kn || kn.s > KRUIS.kijk) { t._gaatK = null; t._forceerK = null; t._wachtT = 0; continue; }
      if (t._gaatK && t._gaatK !== kn.k) t._gaatK = null;
      if (t._forceerK && t._forceerK !== kn.k) t._forceerK = null;
      let l = perKnoop.get(kn.k); if (!l) perKnoop.set(kn.k, l = []);
      l.push(t);
    }
  }

  // de eerstvolgende kruising vóór deze auto langs zijn pad, met de afstand ernaartoe
  volgendeKnoop(t) {
    const P = t.path;
    if (!P || !P.lang) return null;
    const lijst = this.knopenOp(P);
    if (!lijst.length) return null;
    const n = P.length, j = Math.max(0, Math.min(n - 2, Math.floor(t.t)));
    const hier = P.lang[j] + (P.lang[j + 1] - P.lang[j]) * Math.max(0, Math.min(1, t.t - j));
    let beste = null;
    for (const e of lijst) {
      const s = (P.lang[e.i] - hier) * t.dir;
      if (s < -e.k.r) continue;                 // voorbij
      if (!beste || s < beste.s) beste = { k: e.k, s };
    }
    return beste;
  }

  // Hoe hard mag deze auto hooguit? Het strengste van kruising, rotonde en wat er stilstaat.
  doel(t, doel, basis, dt) {
    if (!this.aan || t.slaapt || !t._pos) return doel;
    if (!t.uitwijk && t.zijHoek) this.draaiNaar(t, 0, dt);      // na het uitwijken de neus weer recht
    let d = doel;
    if (t.lokaal && !t.keer) {
      d = Math.min(d, this.kruisDoel(t, dt));
      d = Math.min(d, this.rotondeDoel(t));
    }
    d = Math.min(d, this.blokDoel(t, basis, dt));
    if (this.speler) d = Math.min(d, this.spelerDoel(t));
    /*
     Het laatste vangnet: wie BLOK.vast tellen stilstaat zonder dat hij op een kruising of
     rotonde wacht (die hebben hun eigen vangnet), keert om. Zo lossen ook twee auto's op die
     neus aan neus voor elkaar staan, of een rij achter iets dat niet weggaat.
    */
    t._stilT = (t.snelheid || 0) < 0.2 ? (t._stilT || 0) + dt : 0;
    if (t._vastKeer && !(t.achteruit > 0) && (t.snelheid || 0) > -0.2) {
      // eerst een stukje achteruit (zie hieronder), nu keren
      t._vastKeer = false;
      if (this.keerHier(t, 3.5)) { t._stilT = 0; this.stats.vast++; }
    } else if (t._stilT > BLOK.vast && t.bounce && !t.keer && !t._wachtK && !t._wachtR && !t.uitwijk) {
      if (this.keerHier(t, 5.5)) { t._stilT = 0; this.stats.vast++; }
      else if (!this.iemandAchter(t, 8)) {
        // neus aan neus met een auto die ook niet weg kan: drie meter terug, dan keren
        // (js/vehicles.js rijdt achteruit zolang `achteruit` loopt, zie `schrikAf`)
        t.achteruit = 1.4; t._vastKeer = true; t._stilT = 0;
      }
    }
    return Math.max(0, d);
  }

  /*
   De speler te voet op de rijbaan. js/vehicles.js remt al voor hem (`inDeWeg`), maar
   tot vier meter van midden tot midden: met de neus op anderhalve meter. Hier stopt de
   auto met zijn neus op MENS.stop meter.
  */
  spelerDoel(t) {
    const p = this.speler.pos, d = t._dir, mij = maatVan(t.soort);
    const dx = p.x - t._pos.x, dz = p.z - t._pos.y;
    const langs = dx * d.x + dz * d.y;
    if (langs <= 0 || langs > 20) return Infinity;
    if (Math.abs(dx * -d.y + dz * d.x) > mij.hw + 0.9) return Infinity;
    return Math.sqrt(2 * BLOK.rem * Math.max(0, langs - mij.hl - MENS.stop));
  }

  // heeft auto a voorrang op auto t bij kruising k?
  gaatVoor(a, t, k) {
    if (a._gaatK === k || a._forceerK === k) return true;
    if (t._forceerK === k) return false;
    if (!a.lokaal && t.lokaal) return true;
    if (a.lokaal && !t.lokaal) return false;
    const wa = this.breedte(a.path), wt = this.breedte(t.path);
    if (wa >= wt + KRUIS.breder) return true;
    if (wt >= wa + KRUIS.breder) return false;
    // rechts gaat voor: staat a, gezien vanaf de kruising, rechts van de rijrichting van t?
    const vx = a._pos.x - k.x, vz = a._pos.y - k.z, l = Math.hypot(vx, vz) || 1;
    return (vx * -t._dir.y + vz * t._dir.x) / l > KRUIS.rechts;
  }

  kruisDoel(t, dt) {
    const kn = t._kn;
    t._wachtK = false;
    if (!kn) { t._wachtT = 0; return Infinity; }
    const k = kn.k;
    // al over de stopstreep, of al begonnen: doorrijden, niet midden op de kruising stoppen
    if (t._gaatK === k || kn.s < k.r - 0.5) { t._gaatK = k; t._wachtT = 0; return Infinity; }
    const lijst = this.perKnoop.get(k);
    let wacht = false, iemandOp = false;
    if (lijst) for (const a of lijst) {
      if (a === t || a.path === t.path || !a._kn) continue;
      const op = a._gaatK === k || a._forceerK === k;
      if (op) iemandOp = true;
      // tegemoetkomend verkeer (aan de overkant van de kruising) kruist niet
      const vx = a._pos.x - k.x, vz = a._pos.y - k.z, l = Math.hypot(vx, vz) || 1;
      if (!op && (vx * t._dir.x + vz * t._dir.y) / l > KRUIS.tegen) continue;
      // wie ver terug stilstaat, komt er niet aan
      if (!op && (a.snelheid || 0) < 0.3 && a._kn.s > k.r + 4) continue;
      if (this.gaatVoor(a, t, k)) { wacht = true; break; }
    }
    if (!wacht) {
      if (kn.s < k.r + 0.6) t._gaatK = k;      // hij gaat: vanaf nu staat hij op de kruising
      t._wachtT = 0;
      return Infinity;
    }
    t._wachtK = true;
    this.stats.wachtKruis++;
    if ((t.snelheid || 0) < 0.5) t._wachtT = (t._wachtT || 0) + dt;
    // het vangnet: lang genoeg gewacht en niemand op de kruising (of heel lang gewacht)
    if (t._wachtT > KRUIS.vangnet * (iemandOp ? 2 : 1)) {
      let ander = false;
      if (lijst) for (const a of lijst) if (a !== t && a._forceerK === k) ander = true;
      if (!ander) { t._forceerK = k; t._gaatK = k; t._wachtT = 0; this.stats.forceer++; return Infinity; }
    }
    return Math.sqrt(2 * KRUIS.rem * Math.max(0, kn.s - k.r));
  }

  // de eerstvolgende rotonde vóór deze auto (op zijn eigen pad), met de afstand tot de rand
  volgendePassage(t) {
    const P = t.path;
    if (!P.lang) return null;
    const lijst = this.passages(P)[t.dir > 0 ? 0 : 1];
    if (!lijst.length) return null;
    const n = P.length, j = Math.max(0, Math.min(n - 2, Math.floor(t.t)));
    const hier = P.lang[j] + (P.lang[j + 1] - P.lang[j]) * Math.max(0, Math.min(1, t.t - j));
    for (const p of lijst) {
      const s = (P.lang[p.iIn] - hier) * t.dir;
      if (s < -0.5) continue;
      if (s > ROT.kijk) return null;
      return { p, s };
    }
    return null;
  }

  rotondeDoel(t) {
    if (t.rond) return Infinity;
    const v = this.volgendePassage(t);
    if (!v) return Infinity;
    const g = this.rondje(t.path, v.p, t.dir);
    const o = v.p.o;
    for (const a of this.ringAutos) {
      if (a.rond.o !== o || a === t) continue;
      if (a.t > a.path.boogEind) continue;                       // al op weg naar buiten
      const th = Math.atan2(a._pos.y - o.z, a._pos.x - o.x);
      const voor = mod2pi(th - g.th1);                            // hoeveel ring hij nog heeft tot ons invoegpunt
      const dicht = Math.hypot(a._pos.x - g.q1[0], a._pos.y - g.q1[1]) < ROT.dicht;
      if (voor < ROT.hoek || dicht) {
        this.stats.wachtRotonde++;
        t._wachtR = true;
        return Math.sqrt(2 * KRUIS.rem * Math.max(0, v.s - 1));
      }
    }
    t._wachtR = false;
    // en op tijd afremmen voor de bochten van het stuk over de rotonde (die kent `bochtSnelheid` nog niet)
    let beste = Infinity;
    for (let i = 0; i < g.length; i++) {
      const vb = g.vmax[i];
      if (vb >= 99) continue;
      beste = Math.min(beste, Math.sqrt(vb * vb + 2 * ROT.rem * (Math.max(0, v.s) + g.lang[i])));
    }
    return beste;
  }

  /*
   Na het opschuiven langs het pad (js/vehicles.js, vóór het eind van de as): de rotonde
   op of eraf. Geeft true als het pad gewisseld is; t.t ligt dan binnen het nieuwe pad.
  */
  naStap(t) {
    if (!this.aan) return false;
    if (t.rond) {
      const P = t.path, n = P.length;
      if (t.t < 0) { t.t = 0.001; return true; }
      if (t.t < n - 1) return false;
      const r = t.rond, terug = r.terug;
      const over = (t.t - (n - 1)) * Math.max(0.01, P[n - 1].distanceTo(P[n - 2]));
      const seg = Math.max(0.01, terug[Math.min(terug.length - 1, r.iUit + 1)].distanceTo(terug[Math.max(0, r.iUit - 1)]) / 2);
      t.path = terug;
      t.dir = r.dirUit;
      t.t = Math.max(0.001, Math.min(terug.length - 1.001, r.iUit + r.dirUit * over / seg));
      t._tVorig = t.t;
      t.bounce = r.bounce;
      t.rond = null;
      return true;
    }
    if (!t.lokaal || !t.bounce || t.keer || !(t.snelheid > 0)) return false;
    const v = t._tVorig;
    if (v === undefined) return false;
    const lijst = this.passages(t.path)[t.dir > 0 ? 0 : 1];
    for (const p of lijst) {
      const over = t.dir > 0 ? (v < p.iIn && t.t >= p.iIn) : (v > p.iIn && t.t <= p.iIn);
      if (!over) continue;
      const P = t.path;
      const seg = Math.max(0.01, P[Math.min(P.length - 1, p.iIn + 1)].distanceTo(P[Math.max(0, p.iIn - 1)]) / 2);
      const verder = Math.abs(t.t - p.iIn) * seg;
      const g = this.rondje(P, p, t.dir);
      // (bounce uit zolang hij op de rotonde is: anders remt js/vehicles.js `bochtSnelheid`
      //  voor het eind van dit stuk pad alsof hij daar moet keren)
      t.rond = { pad: g, o: p.o, terug: P, iUit: p.iUit, dirUit: p.dirUit, bounce: t.bounce };
      t.bounce = false;
      t.path = g;
      t.dir = 1;
      t.t = Math.min(g.length - 1.01, verder / Math.max(0.01, g[0].distanceTo(g[1])));
      t._tVorig = t.t;
      this.stats.rondjes++;
      return true;
    }
    return false;
  }

  /*
   Stilstaande (en rijdende) auto's met een eigen model en geparkeerde auto's in de
   buurt, met hun echte maat: een auto dwars op de weg steekt 2,2 m uit naar beide kanten,
   ook als zijn midden buiten de strook staat.
  */
  blokkadeVoor(t) {
    const V = this.V, d = t._dir, mij = maatVan(t.soort);
    let beste = null;
    const u = t.uitwijk;
    const R2 = (BLOK.kijk + 10) * (BLOK.kijk + 10);
    const toets = (c) => {
      // (stap 175) eerst de afstand: de lijst met eigen modellen is lang (politie, garage, missies), de meeste ver weg
      const dx = c.x - t._pos.x, dz = c.z - t._pos.y;
      if (dx * dx + dz * dz > R2) return;
      if (!V.isZichtbaar(c)) return;
      const langs = dx * d.x + dz * d.y;
      if (langs < -8 || langs > BLOK.kijk + 4) return;
      const opzij = dx * -d.y + dz * d.x;
      const m = maatVan(c.soort);
      const yaw = c.mesh ? c.mesh.rotation.y : (c.yaw || 0);
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      const co = Math.abs(fx * d.x + fz * d.y), si = Math.abs(fx * d.y - fz * d.x);
      const eA = m.hl * co + m.hw * si, eC = m.hl * si + m.hw * co;
      if (Math.abs(opzij) - eC >= mij.hw + BLOK.marge) return;    // ernaast: rijdt er langs
      if (langs + eA < -mij.hl) return;                            // al voorbij
      const gap = langs - eA - mij.hl;
      if (gap > BLOK.kijk) return;
      // al naast of half in ons (een auto die bij het verhuizen op een geparkeerde auto terechtkwam): stoppen
      // helpt niet meer, dan rijdt hij door zoals vroeger; anders stond hij er voor altijd
      if (gap < -0.3) return;
      const wie = (u && u.obj === c) ? 'uit' : 'blok';
      if (!beste || gap < beste.gap) beste = { c, gap, opzij, eA, eC, wie };
    };
    for (const c of V.parkeerNabij(t._pos.x, t._pos.y, BLOK.kijk + 6)) toets(c);
    for (const c of this.metModel) toets(c);
    return beste;
  }

  blokDoel(t, basis, dt) {
    if (t.keer) { t.blokT = 0; return Infinity; }
    const b = this.blokkadeVoor(t);
    const u = t.uitwijk;
    let doel = Infinity;
    if (u) doel = this.werkUitwijkBij(t, dt, b);
    if (!b) { t.blokT = 0; return doel; }
    const stil = Math.abs(b.c.speed || 0) < 0.3;
    if (b.wie === 'uit') {
      // langs de auto die we inhalen: tot vlak erbij mag, maar niet ertegenaan
      return Math.min(doel, Math.sqrt(2 * BLOK.rem * Math.max(0, b.gap - 0.6)));
    }
    doel = Math.min(doel, Math.sqrt(2 * BLOK.rem * Math.max(0, b.gap - (stil ? BLOK.stop : BLOK.stopRijdt))));
    if ((t.snelheid || 0) < 0.4 && b.gap < BLOK.stop + 3) {
      this.stats.blok++;
      t.blokT = (t.blokT || 0) + dt;
      // toeteren, niet meteen en niet aan één stuk door
      if (t.blokT > (t.blokClaxon || (t.blokClaxon = BLOK.claxon + Math.random() * 2))) {
        t.blokClaxon = t.blokT + 4 + Math.random() * 5;
        if (this.V.opClaxon && Math.random() < 0.8) this.V.opClaxon(t._pos.x, t._pos.y);
      }
      if (stil && !u && t.blokT > BLOK.wacht) {
        const plan = t._geenUit === b.c ? null : this.uitwijkPlan(t, b);
        if (plan) {
          t.uitwijk = { obj: b.c, pad: t.path, lane0: t.lane, lane: plan, fase: 'uit' };
          t.vLane = 0;
          this.stats.uitwijk++;
        } else if (t.blokT > BLOK.keer && this.keerHier(t)) {
          t.blokT = 0;
          this.stats.keer++;
        }
      }
    } else if ((t.snelheid || 0) > 1) t.blokT = 0;
    return doel;
  }

  /*
   Kan hij er langs? De ruimte links en rechts van de blokkade binnen de rijbaan (de
   breedte uit de BGT, plus een halve meter berm), genoeg aanloop om schuin opzij te gaan,
   niets anders in die nieuwe strook, en niemand die daar aankomt.
  */
  uitwijkPlan(t, b) {
    const mij = maatVan(t.soort);
    const W = this.breedte(t.path) / 2 + 0.5;
    const oc = b.opzij + t.lane;                  // het midden van de blokkade, gemeten vanaf de as
    const nodig = mij.hw + BLOK.marge + 0.15;
    const opties = [];
    const links = oc - b.eC - nodig;
    if (links - mij.hw >= -W) opties.push(links);
    const rechts = oc + b.eC + nodig;
    if (rechts + mij.hw <= W) opties.push(rechts);
    opties.sort((p, q) => Math.abs(p - t.lane) - Math.abs(q - t.lane));
    for (const L of opties) {
      const S = Math.abs(L - t.lane);
      if (S / BLOK.schuin + 1 > b.gap - 0.6) continue;               // te weinig aanloop
      if (this.strookBezet(t, L, b.c)) continue;
      return L;
    }
    return null;
  }

  // staat er in een strook op `L` van de as iets in de weg (tot ruim voorbij de blokkade), of komt er iemand aan?
  strookBezet(t, L, negeer) {
    const V = this.V, d = t._dir, mij = maatVan(t.soort);
    const asX = t._pos.x + d.y * t.lane, asZ = t._pos.y - d.x * t.lane;    // het punt op de as naast hem
    for (const c of [...V.parkeerNabij(t._pos.x, t._pos.y, 30), ...this.metModel]) {
      if (c === negeer || !V.isZichtbaar(c)) continue;
      const dx = c.x - asX, dz = c.z - asZ;
      const langs = dx * d.x + dz * d.y;
      if (langs < -3 || langs > 25) continue;
      const m = maatVan(c.soort);
      const opzij = dx * -d.y + dz * d.x;
      if (Math.abs(opzij - L) < m.hl + mij.hw) return true;
    }
    for (const a of V.traffic) {
      if (a === t || a.slaapt || !a._pos) continue;
      const dx = a._pos.x - asX, dz = a._pos.y - asZ;
      const langs = dx * d.x + dz * d.y;
      if (langs < -6 || langs > 45) continue;
      const opzij = dx * -d.y + dz * d.x;
      if (Math.abs(opzij - L) < 2.6) return true;
    }
    return false;
  }

  // de strook opzij en weer terug: de zijwaartse snelheid hangt aan de voortgang, dus nooit opzij schuiven terwijl hij stilstaat
  werkUitwijkBij(t, dt, b) {
    const u = t.uitwijk;
    u.tijd = (u.tijd || 0) + dt;
    /*
     (stap 175, voorrangtest: een auto stond 169 s stil) Opzij gaan kan alleen rijdend, en vooruit mag niet dichter dan
     0,6 m bij wat hij inhaalt: stond hij daar, dan kwam hij er nooit meer uit, ook niet terug, en het vangnet hieronder
     slaat een uitwijkende auto over. Na BLOK.vast tellen stil: de poging af (de strook blijft waar hij is, geen sprong),
     voor deze auto niet nog eens, en het vangnet keert hem.
    */
    if (Math.abs(t.snelheid || 0) < 0.2 && (t._stilT || 0) > BLOK.vast) {
      t._geenUit = u.obj; t.uitwijk = null; t.vLane = 0;
      return Infinity;
    }
    if (u.fase === 'uit' && u.tijd > 20) u.fase = 'terug';       // komt hij er niet langs, dan terug in zijn strook
    if (u.fase === 'uit') {
      // voorbij de blokkade (of de blokkade is weg): terug naar de eigen strook
      const c = u.obj, m = maatVan(c.soort), mij = maatVan(t.soort);
      const dx = c.x - t._pos.x, dz = c.z - t._pos.y;
      const langs = dx * t._dir.x + dz * t._dir.y;
      if (langs < -(m.hl + mij.hl + 2) || Math.abs(c.speed || 0) > 0.5 || !this.V.isZichtbaar(c)) u.fase = 'terug';
    }
    const doelL = u.fase === 'uit' ? u.lane : u.lane0;
    const v = Math.abs(t.snelheid || 0);
    const rest = doelL - t.lane;
    const max = BLOK.schuin * v;
    const wil = Math.sign(rest) * Math.min(max, Math.abs(rest) * 1.5);
    t.vLane = (t.vLane || 0) + Math.max(-2 * dt, Math.min(2 * dt, wil - (t.vLane || 0)));
    t.vLane = Math.max(-max, Math.min(max, t.vLane));
    let stap = t.vLane * dt;
    if (Math.abs(stap) > Math.abs(rest)) stap = rest;
    t.lane += stap;
    // de neus wijst waar hij heen gaat, maar draait niet sneller dan BLOK.draai (geen draai in één beeld)
    const zij = dt > 0 ? stap / dt : 0;
    this.draaiNaar(t, v > 0.3 ? -Math.atan2(zij, v) * (t.snelheid < 0 ? -1 : 1) : (t.zijHoek || 0), dt);
    if (u.fase === 'terug' && Math.abs(doelL - t.lane) < 0.02 && Math.abs(t.vLane) < 0.1) {
      t.lane = u.lane0; t.uitwijk = null; t.vLane = 0;
    }
    return BLOK.uitTempo;
  }

  // staat er iets binnen `r` meter achter deze auto?
  iemandAchter(t, r) {
    const d = t._dir;
    const achter = (x, z) => {
      const dx = x - t._pos.x, dz = z - t._pos.y, langs = dx * d.x + dz * d.y;
      return langs < 0 && langs > -r && Math.abs(dx * -d.y + dz * d.x) < 2.4;
    };
    for (const a of this.V.traffic) if (a !== t && !a.slaapt && a._pos && achter(a._pos.x, a._pos.y)) return true;
    for (const c of this.V.parkeerNabij(t._pos.x, t._pos.y, r + 3)) if (achter(c.x, c.z)) return true;
    for (const c of this.metModel) if (achter(c.x, c.z)) return true;
    return false;
  }

  draaiNaar(t, doel, dt) {
    const z = t.zijHoek || 0, max = BLOK.draai * dt;
    t.zijHoek = z + Math.max(-max, Math.min(max, doel - z));
  }

  // midden op de weg keren: dezelfde halve cirkel als aan het eind van de as (js/vehicles.js `keer`)
  keerHier(t, vrij = 9) {
    if (!t.bounce) return false;
    for (const a of this.V.traffic) {
      if (a === t || a.slaapt || !a._pos) continue;
      if (Math.hypot(a._pos.x - t._pos.x, a._pos.y - t._pos.y) < vrij) return false;
    }
    const P = t.path, n = P.length;
    const j0 = Math.max(0, Math.min(n - 2, Math.floor(t.t))), f = Math.max(0, Math.min(1, t.t - j0));
    const Ex = P[j0].x + (P[j0 + 1].x - P[j0].x) * f, Ez = P[j0].y + (P[j0 + 1].y - P[j0].y) * f;
    const pl = this.V.plekOpPad(t);
    const ux = pl.x - Ex, uz = pl.z - Ez, L = Math.hypot(ux, uz) || 1;
    t.keer = { cx: Ex, cz: Ez, ux, uz, vx: pl.dx * L, vz: pl.dz * L, f: 0 };
    t.dir = -t.dir;
    return true;
  }
}
