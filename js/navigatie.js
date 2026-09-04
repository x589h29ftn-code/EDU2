/*
 Navigatie over het wegennet van de kaart.

 De kaart (js/kaart.js) heeft 751 wegassen: rijbaanassen met hun gemeten breedte
 en padassen (voetpaden, fietspaden, dammen). Voor de missies moet de speler een
 route kunnen volgen, dus maken we van die assen één graaf: elk aspunt is een
 knoop, opeenvolgende punten zijn bogen, en assen die op elkaar uitkomen worden
 aan elkaar geknoopt als hun punten dicht bij elkaar liggen.

 Een pad is duurder dan een rijbaan (je rijdt liever over de straat dan over een
 tegelpad), maar niet verboden: de boerderij in de zuidwesthoek van het gebied
 is alleen over een dam en een landweggetje te bereiken.
*/

const SNAP = 0.5;          // knopen die binnen een halve meter samenvallen zijn één knoop
const KNOOP_AFSTAND = 5;   // assen aan elkaar knopen binnen deze afstand (m)
const CEL = 8;             // rastercel voor het zoeken van buren (m)

export class Navigatie {
  constructor(wegassen, { padFactor = 2.2, knoopFactor = 1.6 } = {}) {
    this.punten = [];        // [x, z] per knoop
    this.bogen = [];         // [{ naar, kosten }] per knoop
    this.raster = new Map(); // cel -> knoopindexen
    this.rijbaan = [];       // ligt deze knoop op een rijbaan (en niet op een pad)?
    const sleutels = new Map();

    const knoop = (x, z) => {
      const s = `${Math.round(x / SNAP)}|${Math.round(z / SNAP)}`;
      let i = sleutels.get(s);
      if (i === undefined) {
        i = this.punten.length;
        sleutels.set(s, i);
        this.punten.push([x, z]);
        this.bogen.push([]);
        this.rijbaan.push(false);
        const cel = `${Math.floor(x / CEL)}|${Math.floor(z / CEL)}`;
        if (!this.raster.has(cel)) this.raster.set(cel, []);
        this.raster.get(cel).push(i);
      }
      return i;
    };

    const boog = (a, b, kosten) => {
      if (a === b) return;
      if (!this.bogen[a].some(e => e.naar === b)) this.bogen[a].push({ naar: b, kosten });
      if (!this.bogen[b].some(e => e.naar === a)) this.bogen[b].push({ naar: a, kosten });
    };

    for (const as of wegassen) {
      const factor = as.drive ? 1 : padFactor;
      let vorige = null;
      for (const p of as.pts) {
        const i = knoop(p[0], p[1]);
        if (as.drive) this.rijbaan[i] = true;
        if (vorige !== null) {
          const [px, pz] = this.punten[vorige];
          boog(vorige, i, Math.hypot(p[0] - px, p[1] - pz) * factor);
        }
        vorige = i;
      }
    }

    // assen die op elkaar uitkomen aan elkaar knopen
    for (let i = 0; i < this.punten.length; i++) {
      for (const j of this.buren(this.punten[i][0], this.punten[i][1], KNOOP_AFSTAND)) {
        if (j <= i) continue;
        const d = Math.hypot(this.punten[i][0] - this.punten[j][0], this.punten[i][1] - this.punten[j][1]);
        if (d <= KNOOP_AFSTAND) boog(i, j, d * knoopFactor);
      }
    }
  }

  buren(x, z, r) {
    const uit = [];
    const c0 = Math.floor((x - r) / CEL), c1 = Math.floor((x + r) / CEL);
    const d0 = Math.floor((z - r) / CEL), d1 = Math.floor((z + r) / CEL);
    for (let cx = c0; cx <= c1; cx++) {
      for (let cz = d0; cz <= d1; cz++) {
        const lijst = this.raster.get(`${cx}|${cz}`);
        if (lijst) uit.push(...lijst);
      }
    }
    return uit;
  }

  // Dichtstbijzijnde knoop bij een punt. De zoekradius verdubbelt tot er iets
  // gevonden is; midden in de polder ligt de eerste weg soms honderd meter weg.
  naaste(x, z, maxR = 400, alleenRijbaan = false) {
    let best = -1, bd = Infinity;
    for (let r = 10; r <= maxR; r *= 2) {
      for (const i of this.buren(x, z, r)) {
        if (alleenRijbaan && !this.rijbaan[i]) continue;
        const d = Math.hypot(this.punten[i][0] - x, this.punten[i][1] - z);
        if (d < bd) { bd = d; best = i; }
      }
      if (best >= 0) break;
    }
    return best;
  }

  /*
   Kortste route van (vanX,vanZ) naar (naarX,naarZ) over het wegennet.
   Geeft een lijst punten [[x,z], ...] die begint bij het startpunt en eindigt
   op het doel, of null als er geen weg naartoe is.
  */
  route(van, naar) {
    const a = this.naaste(van[0], van[1]);
    const b = this.naaste(naar[0], naar[1]);
    if (a < 0 || b < 0) return null;
    if (a === b) return [[van[0], van[1]], [naar[0], naar[1]]];

    const n = this.punten.length;
    const afstand = new Float64Array(n).fill(Infinity);
    const vanwaar = new Int32Array(n).fill(-1);
    afstand[a] = 0;
    // eenvoudige binaire hoop
    const hoop = [[0, a]];
    const omhoog = (k) => {
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (hoop[p][0] <= hoop[k][0]) break;
        [hoop[p], hoop[k]] = [hoop[k], hoop[p]]; k = p;
      }
    };
    const omlaag = () => {
      let k = 0;
      for (;;) {
        const l = k * 2 + 1, r = l + 1;
        let m = k;
        if (l < hoop.length && hoop[l][0] < hoop[m][0]) m = l;
        if (r < hoop.length && hoop[r][0] < hoop[m][0]) m = r;
        if (m === k) break;
        [hoop[m], hoop[k]] = [hoop[k], hoop[m]]; k = m;
      }
    };
    while (hoop.length) {
      const [d, i] = hoop[0];
      hoop[0] = hoop[hoop.length - 1]; hoop.pop(); if (hoop.length) omlaag();
      if (d > afstand[i]) continue;
      if (i === b) break;
      for (const e of this.bogen[i]) {
        const nd = d + e.kosten;
        if (nd < afstand[e.naar]) {
          afstand[e.naar] = nd; vanwaar[e.naar] = i;
          hoop.push([nd, e.naar]); omhoog(hoop.length - 1);
        }
      }
    }
    if (afstand[b] === Infinity) return null;
    const pad = [];
    for (let i = b; i >= 0; i = vanwaar[i]) pad.push(this.punten[i]);
    pad.reverse();
    return [[van[0], van[1]], ...pad, [naar[0], naar[1]]];
  }
}

// Lengte van een route in meters.
export function routeLengte(pad) {
  let L = 0;
  for (let i = 0; i < pad.length - 1; i++) L += Math.hypot(pad[i + 1][0] - pad[i][0], pad[i + 1][1] - pad[i][1]);
  return L;
}
