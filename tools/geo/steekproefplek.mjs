/*
 Waar staat de camera voor een steekproef, en welke Street View-link hoort daar
 bij?

 Dit zat in tools/geo/steekproef.mjs, maar dat gereedschap start een browser en
 rendert het spel. Voor het opstellen van een nieuwe ronde wil je alleen de
 lijst met links — daar is tools/geo/steekproeflinks.mjs voor, en die gebruikt
 dezelfde rekensom. Eén plek voor de rekensom betekent dat de foto die jij maakt
 en het beeld dat het spel rendert gegarandeerd hetzelfde standpunt hebben.
*/
import { rdNaarWgs, spelNaarRd } from './rd.mjs';

const zwaartepunt = (ring) => {
  let x = 0, z = 0;
  for (const p of ring) { x += p[0]; z += p[1]; }
  return [x / ring.length, z / ring.length];
};

/** Camerapunt: negen meter vóór de voorgevel, op ooghoogte, kijkend naar de gevel. */
export function camera(pand) {
  const [cx, cz] = zwaartepunt(pand.voet);
  const f = pand.front || [0, 1];
  let dmax = 0;
  for (const [x, z] of pand.voet) dmax = Math.max(dmax, (x - cx) * f[0] + (z - cz) * f[1]);
  const afstand = dmax + 9;
  const x = cx + f[0] * afstand, z = cz + f[1] * afstand;
  // kijkrichting -f; speler kijkt langs (-sin yaw, -cos yaw)
  const yaw = Math.atan2(f[0], f[1]);
  // kompaskoers van de kijkrichting (noorden = -z)
  const koers = ((Math.atan2(-f[0], f[1]) * 180 / Math.PI) + 360) % 360;
  return { x, z, yaw, koers, gevel: [cx + f[0] * dmax, cz + f[1] * dmax] };
}

/**
 * Camerapunt voor een omgevingsplek: op de dichtstbijzijnde rijbaanas, kijkend
 * naar de plek; bij `soort: 'profiel'` kijkend langs de as.
 */
export function cameraPlek(pl, KAART) {
  let best = null;
  for (const w of KAART.wegassen) {
    if (!w.drive || w.naam === 'N7') continue;
    for (let i = 1; i < w.pts.length; i++) {
      const a = w.pts[i - 1], b = w.pts[i];
      const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1e-9;
      const t = Math.max(0, Math.min(1, ((pl.x - a[0]) * dx + (pl.z - a[1]) * dz) / L2));
      const qx = a[0] + dx * t, qz = a[1] + dz * t, d = Math.hypot(qx - pl.x, qz - pl.z);
      if (!best || d < best.d) best = { d, x: qx, z: qz, ux: dx / Math.sqrt(L2), uz: dz / Math.sqrt(L2), naam: w.naam };
    }
  }
  if (!best) return null;
  let dir;
  if (pl.soort === 'profiel') dir = [best.ux, best.uz];
  else { const L = Math.hypot(pl.x - best.x, pl.z - best.z) || 1; dir = [(pl.x - best.x) / L, (pl.z - best.z) / L]; }
  // bij een profiel iets terug op de as zodat de straat voor je ligt
  const x = pl.soort === 'profiel' ? best.x - dir[0] * 4 : best.x;
  const z = pl.soort === 'profiel' ? best.z - dir[1] * 4 : best.z;
  const yaw = Math.atan2(-dir[0], -dir[1]);
  const koers = ((Math.atan2(dir[0], -dir[1]) * 180 / Math.PI) + 360) % 360;
  return { x, z, yaw, koers, straat: best.naam, afstand: best.d };
}

/** Het pand bij een adres, of het eerste pand van een woningtype in die straat. */
export function zoek(KAART, straat, nr, type) {
  const kandidaten = type
    ? KAART.panden.filter(p => p.straat === straat && p.type === type && p.nr.length && p.v)
    : KAART.panden.filter(p => p.straat === straat && p.nr.includes(String(nr)));
  return kandidaten.sort((a, b) => (b.v ? 1 : 0) - (a.v ? 1 : 0))[0] || null;
}

/** De Street View-link van een camerapunt in spelmeters. */
export function streetView(x, z, koers, oorsprong) {
  if (!oorsprong) return '';
  const [X, Y] = spelNaarRd([x, z], oorsprong);
  const [lat, lon] = rdNaarWgs(X, Y);
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat.toFixed(6)},${lon.toFixed(6)}&heading=${koers.toFixed(0)}&pitch=5&fov=80`;
}
