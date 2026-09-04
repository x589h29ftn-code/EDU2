// Coördinaten voor de wijk: Rijksdriehoeksstelsel (RD New, EPSG:28992), WGS84
// (Google Maps) en de spelwereld in meters.
//
// De spelwereld is RD, verschoven naar een lokale oorsprong:
//   x_spel = X_rd - X0        (+X = oost)
//   z_spel = Y0 - Y_rd        (+Z = zuid, zoals in js/data.js)
// X0/Y0 staan in data/geo/oorsprong.json (het kruispunt Molenkrite /
// Monnikmolen / Jasker). Zo is elk punt in het spel herleidbaar naar een
// echte plek en omgekeerd, zonder pixels of schaalfactoren.
//
// RD <-> WGS84 volgens de benadering van Schreutelkamp & Strang van Hees
// (2001), nauwkeurig tot ongeveer een halve meter — ruim genoeg voor een spel.
//
// Gebruik op de opdrachtregel:
//   node tools/geo/rd.mjs test                       zelftest
//   node tools/geo/rd.mjs wgs 53.0306 5.6497         Google Maps-punt -> RD en spel
//   node tools/geo/rd.mjs rd 171234.5 559876.2       RD-punt -> WGS84 en spel
//   node tools/geo/rd.mjs px 370 1245                oude kaartpixel -> RD (via ijkpunten)
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HIER = dirname(fileURLToPath(import.meta.url));
const OORSPRONG_BESTAND = join(HIER, '..', '..', 'data', 'geo', 'oorsprong.json');

// Referentiepunt: de Onze-Lieve-Vrouwetoren in Amersfoort.
const X0_RD = 155000, Y0_RD = 463000;
const PHI0 = 52.15517440, LAM0 = 5.38720621;

// RD -> WGS84
const K = [[0, 1, 3235.65389], [2, 0, -32.58297], [0, 2, -0.24750], [2, 1, -0.84978], [0, 3, -0.06550],
  [2, 2, -0.01709], [1, 0, -0.00738], [4, 0, 0.00530], [2, 3, -0.00039], [4, 1, 0.00033], [1, 1, -0.00012]];
const L = [[1, 0, 5260.52916], [1, 1, 105.94684], [1, 2, 2.45656], [3, 0, -0.81885], [1, 3, 0.05594],
  [3, 1, -0.05607], [0, 1, 0.01199], [3, 2, -0.00256], [1, 4, 0.00128], [0, 2, 0.00022], [2, 0, -0.00022], [5, 0, 0.00026]];
// WGS84 -> RD
const R = [[0, 1, 190094.945], [1, 1, -11832.228], [2, 1, -114.221], [0, 3, -32.391], [1, 0, -0.705],
  [3, 1, -2.340], [1, 3, -0.608], [2, 3, -0.008], [0, 5, 0.148]];
const S = [[1, 0, 309056.544], [0, 2, 3638.893], [2, 0, 73.077], [1, 2, -157.984], [3, 0, 59.788],
  [0, 1, 0.433], [2, 2, -6.439], [1, 1, -0.032], [0, 4, 0.092], [1, 4, -0.054]];

const som = (tabel, a, b) => tabel.reduce((t, [p, q, c]) => t + c * a ** p * b ** q, 0);

/** RD (meters) -> [breedtegraad, lengtegraad] in graden. */
export function rdNaarWgs(x, y) {
  const dx = (x - X0_RD) * 1e-5, dy = (y - Y0_RD) * 1e-5;
  return [PHI0 + som(K, dx, dy) / 3600, LAM0 + som(L, dx, dy) / 3600];
}

/** [breedtegraad, lengtegraad] in graden -> RD [x, y] in meters. */
export function wgsNaarRd(lat, lon) {
  const dphi = 0.36 * (lat - PHI0), dlam = 0.36 * (lon - LAM0);
  return [X0_RD + som(R, dphi, dlam), Y0_RD + som(S, dphi, dlam)];
}

/** Leest data/geo/oorsprong.json; null als die er nog niet is. */
export function leesOorsprong(pad = OORSPRONG_BESTAND) {
  if (!existsSync(pad)) return null;
  const o = JSON.parse(readFileSync(pad, 'utf8'));
  if (!Array.isArray(o.rd) || o.rd.length !== 2) throw new Error(`${pad}: veld "rd" moet [X, Y] zijn`);
  return o;
}

/** RD -> spelwereld [x, z] in meters, gegeven de oorsprong {rd:[X0,Y0]}. */
export function rdNaarSpel([X, Y], oorsprong) {
  return [X - oorsprong.rd[0], oorsprong.rd[1] - Y];
}

/** spelwereld [x, z] -> RD. */
export function spelNaarRd([x, z], oorsprong) {
  return [x + oorsprong.rd[0], oorsprong.rd[1] - z];
}

/**
 * Past een affiene transformatie (rotatie, schaal, verschuiving, evt. scheef)
 * op ijkpunten [[bron_x, bron_y], [doel_x, doel_y]] met kleinste kwadraten.
 * Nodig om de oude pixelkaart uit js/data.js naar RD te brengen: geef drie of
 * meer kruispunten op die je zowel in pixels als in RD kent.
 * Geeft {naar(p), restfout: [m per punt]} terug.
 */
export function affienFit(paren) {
  if (paren.length < 3) throw new Error('minstens drie ijkpunten nodig');
  // Los per doelcoördinaat  d = a*x + b*y + c  op via normaalvergelijkingen.
  const los = (kol) => {
    let sxx = 0, sxy = 0, sx = 0, syy = 0, sy = 0, n = 0, sxd = 0, syd = 0, sd = 0;
    for (const [[x, y], doel] of paren) {
      const d = doel[kol];
      sxx += x * x; sxy += x * y; sx += x; syy += y * y; sy += y; n++;
      sxd += x * d; syd += y * d; sd += d;
    }
    // 3x3 stelsel [sxx sxy sx; sxy syy sy; sx sy n] * [a b c] = [sxd syd sd]
    const M = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]];
    const v = [sxd, syd, sd];
    for (let i = 0; i < 3; i++) {
      let piv = i;
      for (let r = i + 1; r < 3; r++) if (Math.abs(M[r][i]) > Math.abs(M[piv][i])) piv = r;
      [M[i], M[piv]] = [M[piv], M[i]]; [v[i], v[piv]] = [v[piv], v[i]];
      for (let r = 0; r < 3; r++) {
        if (r === i) continue;
        const f = M[r][i] / M[i][i];
        for (let c = i; c < 3; c++) M[r][c] -= f * M[i][c];
        v[r] -= f * v[i];
      }
    }
    return [v[0] / M[0][0], v[1] / M[1][1], v[2] / M[2][2]];
  };
  const [a1, b1, c1] = los(0), [a2, b2, c2] = los(1);
  const naar = ([x, y]) => [a1 * x + b1 * y + c1, a2 * x + b2 * y + c2];
  const restfout = paren.map(([bron, doel]) => { const p = naar(bron); return Math.hypot(p[0] - doel[0], p[1] - doel[1]); });
  return { naar, restfout, schaal: Math.hypot(a1, a2) };
}

// ---------------------------------------------------------------- zelftest
function zelftest() {
  const fouten = [];
  const check = (naam, ok) => { if (!ok) fouten.push(naam); console.log(`${ok ? 'ok  ' : 'FOUT'} ${naam}`); };

  // Het referentiepunt gaat exact op zichzelf over.
  const [phi, lam] = rdNaarWgs(X0_RD, Y0_RD);
  check('Amersfoort RD -> WGS84', Math.abs(phi - PHI0) < 1e-9 && Math.abs(lam - LAM0) < 1e-9);
  const [xa, ya] = wgsNaarRd(PHI0, LAM0);
  check('Amersfoort WGS84 -> RD', Math.abs(xa - X0_RD) < 1e-6 && Math.abs(ya - Y0_RD) < 1e-6);

  // Heen en terug rond Sneek blijft binnen een decimeter.
  let maxAfw = 0;
  for (const [x, y] of [[171000, 559000], [172500, 560500], [169800, 557900], [120000, 487000], [235000, 582000]]) {
    const [la, lo] = rdNaarWgs(x, y);
    const [x2, y2] = wgsNaarRd(la, lo);
    maxAfw = Math.max(maxAfw, Math.hypot(x2 - x, y2 - y));
  }
  check(`heen-en-terug RD -> WGS84 -> RD binnen 0,1 m (max ${maxAfw.toFixed(3)} m)`, maxAfw < 0.1);

  // Sneek ligt op ongeveer 53,03 N / 5,66 O; dat moet in RD ergens rond
  // x 171 km, y 559 km uitkomen (noord van Amersfoort, iets oostelijker).
  const [xs, ys] = wgsNaarRd(53.033, 5.658);
  check(`Sneek plausibel in RD (${xs.toFixed(0)}, ${ys.toFixed(0)})`, xs > 165000 && xs < 178000 && ys > 553000 && ys < 566000);

  // Een meter oost/noord in RD is ook een meter in het spel, met Z naar het zuiden.
  const o = { rd: [171000, 559000] };
  const [gx, gz] = rdNaarSpel([171010, 559025], o);
  check('RD -> spel: 10 m oost, 25 m noord = x 10, z -25', gx === 10 && gz === -25);
  const [rx, ry] = spelNaarRd([gx, gz], o);
  check('spel -> RD terug', rx === 171010 && ry === 559025);

  // Affiene fit: een bekende transformatie (schaal 1/3,26; spiegeling; draai) wordt teruggevonden.
  const echt = ([px, py]) => [171000 + (px - 370) / 3.26 * Math.cos(0.02) - (py - 1245) / 3.26 * Math.sin(0.02),
                              559000 - (py - 1245) / 3.26 * Math.cos(0.02) - (px - 370) / 3.26 * Math.sin(0.02)];
  const ijk = [[370, 1245], [243, 935], [305, 1460], [888, 1487], [1183, 1000]].map(p => [p, echt(p)]);
  const fit = affienFit(ijk);
  const p = fit.naar([600, 1045]), q = echt([600, 1045]);
  check(`affiene fit reproduceert punten (afw. ${Math.hypot(p[0] - q[0], p[1] - q[1]).toExponential(1)} m, schaal ${fit.schaal.toFixed(4)})`,
    Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6 && Math.max(...fit.restfout) < 1e-6);

  if (fouten.length) { console.error(`\n${fouten.length} test(s) mislukt`); process.exit(1); }
  console.log('\nalles in orde');
}

// ---------------------------------------------------------------- opdrachtregel
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [modus, ...rest] = process.argv.slice(2);
  const oorsprong = leesOorsprong();
  const toonSpel = (rd) => {
    if (!oorsprong) return '  spel: (nog geen data/geo/oorsprong.json)';
    const [x, z] = rdNaarSpel(rd, oorsprong);
    return `  spel: x ${x.toFixed(2)} m, z ${z.toFixed(2)} m (oorsprong ${oorsprong.naam || 'onbenoemd'})`;
  };
  if (modus === 'test') {
    zelftest();
  } else if (modus === 'wgs' && rest.length === 2) {
    const rd = wgsNaarRd(+rest[0], +rest[1]);
    console.log(`WGS84 ${rest[0]}, ${rest[1]}\n  RD:   X ${rd[0].toFixed(2)}  Y ${rd[1].toFixed(2)}\n${toonSpel(rd)}`);
  } else if (modus === 'rd' && rest.length === 2) {
    const rd = [+rest[0], +rest[1]];
    const [la, lo] = rdNaarWgs(rd[0], rd[1]);
    console.log(`RD ${rest[0]}, ${rest[1]}\n  WGS84: ${la.toFixed(7)}, ${lo.toFixed(7)}  (plak dit in Google Maps)\n${toonSpel(rd)}`);
  } else if (modus === 'px' && rest.length === 2) {
    if (!oorsprong?.ijkpunten?.length) {
      console.error('geen ijkpunten in data/geo/oorsprong.json (zie docs/METHODIEK.md, stap 1)'); process.exit(2);
    }
    const fit = affienFit(oorsprong.ijkpunten.map(p => [p.px, p.rd]));
    const rd = fit.naar([+rest[0], +rest[1]]);
    const [la, lo] = rdNaarWgs(rd[0], rd[1]);
    console.log(`pixel ${rest[0]}, ${rest[1]} (oude kaart)\n  RD:    X ${rd[0].toFixed(2)}  Y ${rd[1].toFixed(2)}\n  WGS84: ${la.toFixed(7)}, ${lo.toFixed(7)}\n${toonSpel(rd)}`);
    console.log(`  restfout ijkpunten: ${fit.restfout.map(f => f.toFixed(2) + ' m').join(', ')}  (schaal ${(1 / fit.schaal).toFixed(3)} px/m)`);
  } else {
    console.log('gebruik: node tools/geo/rd.mjs test | wgs <lat> <lon> | rd <X> <Y> | px <px> <py>');
    process.exit(2);
  }
}
