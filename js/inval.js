/*
 Missie 16: De inval (stap 101, verzoek 28 sep 2026). Het verhaal en de gesprekken staan in
 js/verhaal.js; hier staan de lijnen waar auto's over rijden:

   - de inval: vier politieauto's en een zwart busje die de Molenkrite in komen, naar de
     voordeur van Molenkrite 15 (het filmbeeld, en daarna de wagens die je achterna gaan);
   - de vlucht van Bouwman: van zijn plek op de Dúvelsrak een draai op het dek, de helling af
     aan de kant van de Lemmerweg en over de weg naar de dichtstbijzijnde rotonde, en daar
     voorbij. Onderweg ram jij hem van de weg (js/verhaal.js telt de klappen).

 Hoe hij rijdt is hetzelfde als bij de tegenstanders in de race en bij Bouwman in missie 15:
 kinematisch over een gladde lijn (`lijnDoor` in js/schaduw.js), met een snelheidsprofiel dat
 voor elke bocht op tijd afremt.
*/
import { lijnDoor, rotondes } from './schaduw.js';
import { resolveCollisions, pointInWater } from './world.js';

export const INVAL = {
  // de vlucht
  stad: 16.5,            // m/s op de weg (59 km/u): een Golf haalt hem in
  dwars: 5.2,            // m/s² dwars door een bocht (hij rijdt als een gek)
  optrek: 3.4,           // m/s²
  remmen: 4.0,           // m/s²
  draai: 2.2,            // de straal van zijn draai op het dek (m)
  rotondeMin: 250,       // de rotonde waar hij heen rijdt ligt zo ver…
  rotondeMax: 1500,      // …tot zo ver van de voet van de helling (m)
  voorbij: 260,          // en daarna rijdt hij nog zoveel meter door (m)
  // de inval
  invalVan: 115,         // zoveel meter de straat in beginnen de auto's (m): in acht tellen voor de deur
};

// een punt op de lijn, `u` meter rechts van de rijrichting, met de raaklijn ertussen door
export function puntOp(L, s, u = 0) {
  s = Math.max(0, Math.min(L.lengte, s));
  let a = 0, b = L.n - 1;
  while (b - a > 1) { const m = (a + b) >> 1; if (L.s[m] <= s) a = m; else b = m; }
  const f = L.s[b] > L.s[a] ? (s - L.s[a]) / (L.s[b] - L.s[a]) : 0;
  const x = L.x[a] + (L.x[b] - L.x[a]) * f, z = L.z[a] + (L.z[b] - L.z[a]) * f;
  const rx = L.tx[a] + (L.tx[b] - L.tx[a]) * f, rz = L.tz[a] + (L.tz[b] - L.tz[a]) * f;
  const rl = Math.hypot(rx, rz) || 1, tx = rx / rl, tz = rz / rl;
  // rechts van de rijrichting: (−tz, tx) in dit assenstelsel (+x oost, +z zuid)
  return { x: x - tz * u, z: z + tx * u, tx, tz, i: a, yaw: Math.atan2(-tx, -tz) };
}

// het snelheidsprofiel: niet harder dan de bocht toelaat, en op tijd ervoor remmen
export function profiel(L, { top = INVAL.stad, dwars = INVAL.dwars, remmen = INVAL.remmen } = {}) {
  const v = new Float32Array(L.n);
  for (let i = 0; i < L.n; i++) v[i] = Math.min(top, L.k[i] > 1e-4 ? Math.sqrt(dwars / L.k[i]) : top);
  for (let i = L.n - 2; i >= 0; i--) {
    const ds = L.s[i + 1] - L.s[i];
    v[i] = Math.min(v[i], Math.sqrt(v[i + 1] * v[i + 1] + 2 * remmen * ds));
  }
  return v;
}

/*
 De vlucht van Bouwman. Hij staat op `sAuto` meter over het dek, op strook `uAuto`, met zijn
 neus naar Tinga (hij kwam van de Lemmerweg). Eerst een draai op het dek: een halve cirkel
 van INVAL.draai meter naar de andere strook, zodat zijn neus naar de Lemmerweg wijst. Dan de
 helling af, over de weg naar de rotonde, en daar voorbij.
*/
export function vluchtLijn(KAART, brug, sAuto, uAuto = -INVAL.draai) {
  if (!brug) return null;
  const kop = [];
  const R = Math.abs(uAuto);
  for (let i = 0; i <= 8; i++) {
    const t = (i / 8) * Math.PI;
    // van (sAuto, −R) via (sAuto − R, 0) naar (sAuto, +R): eerst nog een stukje naar Tinga
    const q = brug.p(sAuto - Math.sin(t) * R, -Math.cos(t) * R);
    kop.push([q.x, q.z]);
  }
  // dan over het dek naar de Lemmerweg en de helling af, rechts van de as
  const af = brug.vanLemmerweg(90, sAuto + 1, R).slice().reverse();
  kop.push(...af);
  const voet = af[af.length - 1];
  // de rotonde: de dichtstbijzijnde op een fatsoenlijke afstand
  const kandidaten = rotondes(KAART)
    .map(r => ({ ...r, d: Math.hypot(r.x - voet[0], r.z - voet[1]) }))
    .filter(r => r.d > INVAL.rotondeMin && r.d < INVAL.rotondeMax)
    .sort((a, b) => a.d - b.d);
  for (const rot of kandidaten) {
    const dx = (rot.x - voet[0]) / rot.d, dz = (rot.z - voet[1]) / rot.d;
    const verder = [rot.x + dx * INVAL.voorbij, rot.z + dz * INVAL.voorbij];
    const L = lijnDoor(KAART, [voet, [rot.x, rot.z], verder], { kop });
    if (L && L.lengte > 200) return { lijn: L, rotonde: { x: rot.x, z: rot.z, r: rot.r } };
  }
  return null;
}

// een nieuwe vlucht: waar hij is op de lijn en hoe hard hij gaat
export function nieuweVlucht(L) {
  return { s: 0, v: 0, prof: profiel(L), klaar: false, gecrasht: false };
}

/*
 Eén stap van de vlucht. `car` volgt de lijn (kinematisch, zoals de tegenstanders in de race)
 en `vehicles.zetNeer` zet hem op de grond, ook op het dek en de helling. Levert de
 afgelegde afstand.
*/
export function rijdVlucht(st, L, car, vehicles, dt) {
  if (st.klaar || st.gecrasht) return 0;
  const i = Math.min(L.n - 1, Math.max(0, Math.round(st.s / 2)));
  const doel = st.prof[Math.min(L.n - 1, i + 1)];
  const vorig = st.v, vorigeYaw = car.yaw;
  // (`st.optrek` en `st.remmen`: een eigen rijstijl, zoals Bouwman in missie 18; stap 127)
  if (st.v < doel) st.v = Math.min(doel, st.v + (st.optrek || INVAL.optrek) * dt);
  else st.v = Math.max(doel, st.v - (st.remmen || INVAL.remmen) * 1.6 * dt);
  st.v = Math.max(st.v, 1.2);
  const stap = st.v * dt;
  st.s = Math.min(L.lengte, st.s + stap);
  const p = puntOp(L, st.s, Math.min(1.2, L.baan[i] || 1));
  car.x = p.x; car.z = p.z; car.yaw = p.yaw; car.speed = st.v;
  vehicles.zetNeer(car, dt, vorigeYaw, { gas: st.v > vorig, rem: st.v < vorig - 0.02 });
  if (st.s >= L.lengte - 0.5) st.klaar = true;
  return stap;
}

/*
 De route van de inval: over de Molenkrite naar de voordeur van Molenkrite 15. Het begin is
 een punt op een rijbaanas van de Molenkrite, zo'n INVAL.invalVan meter van het huis, en de
 routeplanner rijdt vandaar naar `voor` (de rijbaan voor de deur). Punten [x, z].
*/
export function invalRoute(KAART, voor) {
  let beste = null;
  for (const as of KAART.wegassen || []) {
    if (!as.drive || !/molenkrite/i.test(as.naam || '')) continue;
    for (const q of as.pts) {
      const d = Math.hypot(q[0] - voor.x, q[1] - voor.z);
      const sc = Math.abs(d - INVAL.invalVan);
      if (d > 90 && (!beste || sc < beste.sc)) beste = { sc, x: q[0], z: q[1] };
    }
  }
  if (!beste) return null;
  const L = lijnDoor(KAART, [[beste.x, beste.z], [voor.x, voor.z]]);
  if (!L) return null;
  const pts = [];
  for (let i = 0; i < L.n; i += 2) pts.push([L.x[i], L.z[i]]);
  pts.push([L.x[L.n - 1], L.z[L.n - 1]]);
  return { pts, lengte: L.lengte };
}

/*
 De schuif na de klap, met botsing (stap 106). Tot dan schoof de auto van Bouwman in 1,3 s
 zeven meter opzij en vijf vooruit, dwars door alles heen: "als Bouwman geramd wordt kan hij
 soms in een hokje van een huis terechtkomen, lijkt geen collision" (melding 3 okt 2026). Nu
 loopt de schuif in stapjes van 2 % langs dezelfde baan, met de drie cirkels van
 vehicles.drive, en houdt op bij de laatste stap waarop geen muur, schuur of schutting raakt
 en hij niet in het water staat. Geeft het deel van de baan dat vrij is (0…1).
*/
export function crashSchuif(car, c, kant) {
  const as = car.as || 1.4, r = car.botsRadius || 0.95, y = car.mesh ? car.mesh.position.y : 0;
  let vrij = 0;
  for (let e = 0.02; e <= 1.0001; e += 0.02) {
    const x = c.van.x + (c.zij.x * 7 * kant + c.voor.x * 5) * e;
    const z = c.van.z + (c.zij.z * 7 * kant + c.voor.z * 5) * e;
    const yaw = c.yaw - 1.1 * kant * e, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    if (pointInWater(x, z)) break;
    let raakt = false;
    for (const off of [-as, 0, as]) {
      const px = x + fx * off, pz = z + fz * off;
      const [rx, rz] = resolveCollisions(px, pz, r, 3.5, y);
      if (Math.abs(rx - px) + Math.abs(rz - pz) > 0.01) { raakt = true; break; }
    }
    if (raakt) break;
    vrij = e;
  }
  return vrij;
}
// hoe ver iemand van 0,4 m breed vanaf (x, z) in richting (dx, dz) kan rennen, tot `max`
export function renVrij(x, z, dx, dz, max) {
  for (let d = 0.5; d <= max; d += 0.5) {
    const px = x + dx * d, pz = z + dz * d;
    const [rx, rz] = resolveCollisions(px, pz, 0.4);
    if (Math.abs(rx - px) + Math.abs(rz - pz) > 0.01 || pointInWater(px, pz)) return d - 0.5;
  }
  return max;
}
