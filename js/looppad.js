/*
 Een looproute te voet, om hekken, heggen en gebouwen heen.

 De schutters in js/bewaking.js lopen recht op je af en glijden langs wat ze
 tegenkomen. Op een erf is dat genoeg, maar rond een voetbalveld staat alles
 dicht: een hek langs de lange kant met één poortje, reclameborden, een
 kantine met een tribune ervoor. De bende van missie 10 stapte bij de weg uit en
 bleef honderdtachtig tellen tegen dat hek staan (tools/veteraantest.mjs). Dit
 zoekt daarom één keer een route over een raster van een meter, getoetst met
 dezelfde botsdozen waar de mensen tegenaan lopen (`resolveCollisions`), en
 trekt die daarna strak: van elk punt meteen door naar het verste punt dat in
 een rechte lijn te belopen is.

 Een cel is vrij als iemand van `straal` er kan staan zonder weggeduwd te
 worden. Het raster rekent met een wat ruimere straal dan de loper zelf, zodat
 een hek van acht centimeter dat precies tussen twee cellen door loopt toch in
 een van de twee valt; de rechte stukken worden daarna met de echte straal en
 om de dertig centimeter nagelopen.
*/
import { resolveCollisions, pointInWater } from './world.js';

const CEL = 1.0;             // rastermaat (m)
const RASTER_STRAAL = 0.55;  // wat een cel vrij maakt
const LOOP_STRAAL = 0.36;    // de loper zelf: iets ruimer dan de 0,34 van js/bewaking.js
const MARGE = 40;            // zoveel meter om van en naar heen wordt er gezocht
const MAX_CELLEN = 90000;    // daarboven wordt het te duur voor één beeld

function staatVrij(x, z, r, laag = 0) {
  if (pointInWater(x, z)) return false;
  const [kx, kz] = resolveCollisions(x, z, r, laag);
  return Math.hypot(kx - x, kz - z) < 0.01;
}

// Kun je in een rechte lijn van a naar b lopen?
export function rechtBeloopbaar(ax, az, bx, bz, r = LOOP_STRAAL, laag = 0) {
  const L = Math.hypot(bx - ax, bz - az);
  for (let s = 0; s <= L; s += 0.3) {
    const t = L > 0 ? s / L : 0;
    if (!staatVrij(ax + (bx - ax) * t, az + (bz - az) * t, r, laag)) return false;
  }
  return staatVrij(bx, bz, r, laag);
}

/*
 De route van `van` naar `naar` ({x, z}), als lijst [[x, z], ...] die bij van
 begint en bij naar eindigt, of null als er geen weg is.

 `laag`: botsdozen lager dan dit tellen niet, want daar stap of spring je
 overheen. Het hoofdveld van VV Sneek heeft een gesloten ring reclameborden
 met een doos van zestig centimeter (js/sportveld.js); de speler springt
 eroverheen, en de bende die op hem af komt ook.
*/
export function zoekLooppad(van, naar, { laag = 0 } = {}) {
  const x0 = Math.min(van.x, naar.x) - MARGE, z0 = Math.min(van.z, naar.z) - MARGE;
  const nx = Math.ceil((Math.max(van.x, naar.x) + MARGE - x0) / CEL) + 1;
  const nz = Math.ceil((Math.max(van.z, naar.z) + MARGE - z0) / CEL) + 1;
  if (nx * nz > MAX_CELLEN) return null;
  const idx = (i, j) => j * nx + i;
  const wx = (i) => x0 + i * CEL, wz = (j) => z0 + j * CEL;
  // vrij (1), dicht (2) of nog niet bekeken (0): alleen proeven wat de zoektocht aandoet
  const stand = new Uint8Array(nx * nz);
  const vrij = (i, j) => {
    if (i < 0 || j < 0 || i >= nx || j >= nz) return false;
    const k = idx(i, j);
    if (!stand[k]) stand[k] = staatVrij(wx(i), wz(j), RASTER_STRAAL, laag) ? 1 : 2;
    return stand[k] === 1;
  };
  // begin en eind op de dichtstbijzijnde vrije cel: bij de auto's of voor de tribune
  const dichtsteVrij = (p) => {
    const ci = Math.round((p.x - x0) / CEL), cj = Math.round((p.z - z0) / CEL);
    for (let r = 0; r < 8; r++) {
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        if (vrij(ci + di, cj + dj)) return [ci + di, cj + dj];
      }
    }
    return null;
  };
  const a = dichtsteVrij(van), b = dichtsteVrij(naar);
  if (!a || !b) return null;

  // A* met acht buren; schuin alleen als de twee rechte buren ook vrij zijn
  const g = new Float32Array(nx * nz).fill(Infinity);
  const terug = new Int32Array(nx * nz).fill(-1);
  const dicht = new Uint8Array(nx * nz);
  const heap = [];                 // [f, k], een binaire hoop op f
  const duw = (f, k) => {
    heap.push([f, k]);
    let i = heap.length - 1;
    while (i > 0) {
      const o = (i - 1) >> 1;
      if (heap[o][0] <= heap[i][0]) break;
      [heap[o], heap[i]] = [heap[i], heap[o]]; i = o;
    }
  };
  const pak = () => {
    const top = heap[0], eind = heap.pop();
    if (heap.length) {
      heap[0] = eind;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    }
    return top;
  };
  const h = (i, j) => Math.hypot(i - b[0], j - b[1]);
  const start = idx(a[0], a[1]), doel = idx(b[0], b[1]);
  g[start] = 0;
  duw(h(a[0], a[1]), start);
  const BUREN = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
    [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  let gevonden = false;
  while (heap.length) {
    const [, k] = pak();
    if (dicht[k]) continue;
    if (k === doel) { gevonden = true; break; }
    dicht[k] = 1;
    const i = k % nx, j = (k - i) / nx;
    for (const [di, dj, kost] of BUREN) {
      const ni = i + di, nj = j + dj;
      if (!vrij(ni, nj)) continue;
      if (di && dj && (!vrij(i + di, j) || !vrij(i, j + dj))) continue;
      const nk = idx(ni, nj);
      if (dicht[nk]) continue;
      const ng = g[k] + kost;
      if (ng >= g[nk]) continue;
      g[nk] = ng; terug[nk] = k;
      duw(ng + h(ni, nj), nk);
    }
  }
  if (!gevonden) return null;

  // de cellen terug naar het begin, als wereldpunten
  const cellen = [];
  for (let k = doel; k !== -1; k = terug[k]) {
    const i = k % nx, j = (k - i) / nx;
    cellen.push([wx(i), wz(j)]);
  }
  cellen.reverse();
  cellen[0] = [van.x, van.z];
  cellen[cellen.length - 1] = [naar.x, naar.z];

  /*
   Strak trekken: vanaf elk punt zo ver mogelijk vooruit zolang de rechte lijn
   te belopen is. Vooruit en niet vanaf het eind terug: dan is elke toets zo
   lang als het stuk dat je al had, en niet de hele route.
  */
  const pad = [cellen[0]];
  let hier = 0;
  while (hier < cellen.length - 1) {
    let verst = hier + 1;
    for (let k = hier + 2; k < cellen.length; k++) {
      if (!rechtBeloopbaar(cellen[hier][0], cellen[hier][1], cellen[k][0], cellen[k][1], LOOP_STRAAL, laag)) break;
      verst = k;
    }
    pad.push(cellen[verst]);
    hier = verst;
  }
  return pad;
}
