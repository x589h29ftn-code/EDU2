// Middellijnen van vlakken. De BGT geeft de rijbaan als vlak, maar verkeer,
// voetgangers en het straatnaambord hebben een as nodig. Die wordt hier uit
// de vlakken zelf afgeleid: de vlakken worden op een fijn raster gezet, het
// raster wordt uitgedund tot een skelet van één cel breed (Zhang-Suen), en dat
// skelet wordt teruggebracht tot lijnstukken met per punt de gemeten breedte.
// Geen afhankelijkheden.

// ---------------------------------------------------------------- raster
export function raster(polygonen, cel, bbox) {
  const [x0, z0, x1, z1] = bbox;
  const W = Math.ceil((x1 - x0) / cel) + 2, H = Math.ceil((z1 - z0) / cel) + 2;
  const g = new Uint8Array(W * H);
  vulRaster(g, W, H, polygonen, cel, x0, z0, 1);
  return { g, W, H, cel, x0, z0 };
}

// Vult cellen waarvan het middelpunt in de polygoon ligt (even-oneven, dus
// met gaten). `waarde` maakt een klassenraster mogelijk.
export function vulRaster(g, W, H, polygonen, cel, x0, z0, waarde) {
  for (const ringen of polygonen) {
    let jmin = Infinity, jmax = -Infinity;
    for (const r of ringen) for (const [, z] of r) { jmin = Math.min(jmin, z); jmax = Math.max(jmax, z); }
    const j0 = Math.max(0, Math.floor((jmin - z0) / cel)), j1 = Math.min(H - 1, Math.ceil((jmax - z0) / cel));
    const xs = [];
    for (let j = j0; j <= j1; j++) {
      const zc = z0 + (j + 0.5) * cel;
      xs.length = 0;
      for (const r of ringen) {
        for (let i = 0, n = r.length; i < n; i++) {
          const a = r[i], b = r[(i + 1) % n];
          if ((a[1] <= zc) !== (b[1] <= zc)) xs.push(a[0] + (zc - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
        }
      }
      if (xs.length < 2) continue;
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const ia = Math.max(0, Math.ceil((xs[k] - x0) / cel - 0.5)), ib = Math.min(W - 1, Math.floor((xs[k + 1] - x0) / cel - 0.5));
        for (let i = ia; i <= ib; i++) g[j * W + i] = waarde;
      }
    }
  }
}

// Afstand tot de rand (chamfer 3-4), in cellen ×3.
function afstand(g, W, H) {
  const INF = 1 << 28;
  const d = new Int32Array(W * H);
  for (let i = 0; i < d.length; i++) d[i] = g[i] ? INF : 0;
  for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
    const k = j * W + i; if (!g[k]) continue;
    d[k] = Math.min(d[k], d[k - W] + 3, d[k - 1] + 3, d[k - W - 1] + 4, d[k - W + 1] + 4);
  }
  for (let j = H - 2; j >= 1; j--) for (let i = W - 2; i >= 1; i--) {
    const k = j * W + i; if (!g[k]) continue;
    d[k] = Math.min(d[k], d[k + W] + 3, d[k + 1] + 3, d[k + W - 1] + 4, d[k + W + 1] + 4);
  }
  // randcellen krijgen afstand 1 zodat ze niet als binnenland tellen
  for (let i = 0; i < W; i++) { if (g[i]) d[i] = 3; if (g[(H - 1) * W + i]) d[(H - 1) * W + i] = 3; }
  for (let j = 0; j < H; j++) { if (g[j * W]) d[j * W] = 3; if (g[j * W + W - 1]) d[j * W + W - 1] = 3; }
  return d;
}

// ---------------------------------------------------------------- uitdunnen
// Zhang-Suen, alleen over randcellen zodat het ook op tien miljoen cellen vlot gaat.
function uitdunnen(src, W, H) {
  const g = new Uint8Array(src);
  const P = (k) => g[k];
  let kandidaten = [];
  for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
    const k = j * W + i;
    if (g[k] && (!g[k - W] || !g[k + W] || !g[k - 1] || !g[k + 1])) kandidaten.push(k);
  }
  const weg = [];
  let stap = 0, stil = 0;
  // Stopt zodra twee opeenvolgende deelstappen niets meer weghalen; de
  // overlevende randcellen blijven kandidaat omdat de andere deelstap een
  // andere voorwaarde heeft.
  while (kandidaten.length && stil < 2) {
    weg.length = 0;
    const volgende = new Set();
    for (const k of kandidaten) {
      if (!g[k]) continue;
      const i = k % W, j = (k - i) / W;
      if (i < 1 || j < 1 || i >= W - 1 || j >= H - 1) continue;
      const p2 = P(k - W), p3 = P(k - W + 1), p4 = P(k + 1), p5 = P(k + W + 1), p6 = P(k + W), p7 = P(k + W - 1), p8 = P(k - 1), p9 = P(k - W - 1);
      const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
      if (B < 2 || B > 6) { volgende.add(k); continue; }
      const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
      let A = 0; for (let t = 0; t < 8; t++) if (seq[t] === 0 && seq[t + 1] === 1) A++;
      if (A !== 1) { volgende.add(k); continue; }
      const ok = stap % 2 === 0 ? (p2 * p4 * p6 === 0 && p4 * p6 * p8 === 0) : (p2 * p4 * p8 === 0 && p2 * p6 * p8 === 0);
      if (ok) weg.push(k); else volgende.add(k);
    }
    for (const k of weg) {
      g[k] = 0;
      for (const dk of [-W - 1, -W, -W + 1, -1, 1, W - 1, W, W + 1]) if (g[k + dk]) volgende.add(k + dk);
    }
    kandidaten = [...volgende];
    stil = weg.length ? 0 : stil + 1;
    stap++;
    if (stap > 4000) break;
  }
  return g;
}

// ---------------------------------------------------------------- graaf
function buren(g, W, k) {
  const uit = [];
  for (const dk of [-W - 1, -W, -W + 1, -1, 1, W - 1, W, W + 1]) if (g[k + dk]) uit.push(k + dk);
  return uit;
}

// Skeletcellen -> ketens tussen knooppunten. De graad is het aantal
// overgangen 0->1 rondom de cel (niet het ruwe aantal buren): op een trapje
// raken twee buren elkaar en tellen ze als één richting.
const RING = (W) => [-W, -W + 1, 1, W + 1, W, W - 1, -1, -W - 1];
function graadVan(g, W, k) {
  const r = RING(W); let A = 0;
  for (let t = 0; t < 8; t++) if (!g[k + r[t]] && g[k + r[(t + 1) % 8]]) A++;
  return A;
}
function ketens(g, W, H) {
  const graad = new Uint8Array(W * H);
  const cellen = [];
  for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) { const k = j * W + i; if (g[k]) { graad[k] = graadVan(g, W, k); cellen.push(k); } }
  const bezocht = new Uint8Array(W * H);
  const uit = [];
  const aanElkaar = (a, b) => { const ai = a % W, bi = b % W; return Math.abs(ai - bi) <= 1 && Math.abs((a - ai) / W - (b - bi) / W) <= 1; };
  const volg = (start, eerste) => {
    const pad = [start, eerste];
    let vorig = start, k = eerste;
    if (graad[k] === 2) bezocht[k] = 1;
    while (graad[k] === 2) {
      const b = buren(g, W, k).filter(n => n !== vorig && n !== start);
      // de echte volgende cel ligt niet tegen de vorige aan (andere kant van het lijntje)
      let n = b.find(x => !aanElkaar(x, vorig));
      if (n === undefined) n = b.find(x => !bezocht[x]);
      if (n === undefined) break;
      vorig = k; k = n; pad.push(k);
      if (graad[k] === 2) { if (bezocht[k]) break; bezocht[k] = 1; }
      if (pad.length > 400000) break;
    }
    return pad;
  };
  const gezien = new Set();
  for (const k of cellen) {
    if (graad[k] === 2 || graad[k] === 0) continue;
    for (const n of buren(g, W, k)) {
      if (graad[n] === 2 && bezocht[n]) continue;
      const pad = volg(k, n);
      const eind = pad[pad.length - 1];
      const sleutel = (k < eind ? k + ':' + eind : eind + ':' + k) + ':' + pad.length;
      if (gezien.has(sleutel)) continue;
      gezien.add(sleutel);
      uit.push(pad);
    }
  }
  // gesloten lussen zonder knooppunt
  for (const k of cellen) {
    if (graad[k] === 2 && !bezocht[k]) { const pad = volg(k, buren(g, W, k)[0]); pad.push(k); uit.push(pad); }
  }
  return { uit, graad };
}

// Douglas-Peucker
function vereenvoudig(pts, tol) {
  if (pts.length < 3) return pts;
  const dmax = { d: 0, i: 0 };
  const a = pts[0], b = pts[pts.length - 1];
  const L = Math.hypot(b.x - a.x, b.z - a.z) || 1e-9;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const d = Math.abs((b.x - a.x) * (a.z - p.z) - (a.x - p.x) * (b.z - a.z)) / L;
    if (d > dmax.d) { dmax.d = d; dmax.i = i; }
  }
  if (dmax.d > tol) return vereenvoudig(pts.slice(0, dmax.i + 1), tol).slice(0, -1).concat(vereenvoudig(pts.slice(dmax.i), tol));
  return [a, b];
}

/**
 * polygonen: [[ring, gat, ...], ...] in meters. Geeft ketens terug:
 * [{ pts: [{x,z,w}], w (mediaan), lengte }].
 */
export function middellijnen(polygonen, { cel = 0.25, bbox, tol = 0.35, snoei = 1.0 } = {}) {
  if (!bbox) {
    bbox = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of polygonen) for (const r of p) for (const [x, z] of r) { bbox[0] = Math.min(bbox[0], x); bbox[1] = Math.min(bbox[1], z); bbox[2] = Math.max(bbox[2], x); bbox[3] = Math.max(bbox[3], z); }
    bbox = [bbox[0] - 2 * cel, bbox[1] - 2 * cel, bbox[2] + 2 * cel, bbox[3] + 2 * cel];
  }
  const { g, W, H, x0, z0 } = raster(polygonen, cel, bbox);
  const d = afstand(g, W, H);
  let sk = uitdunnen(g, W, H);
  const naarPunt = (k) => { const i = k % W, j = (k - i) / W; return { x: x0 + (i + 0.5) * cel, z: z0 + (j + 0.5) * cel, w: (2 * d[k] / 3) * cel }; };
  const lengte = (pad) => { let L = 0; for (let i = 1; i < pad.length; i++) { const a = naarPunt(pad[i - 1]), b = naarPunt(pad[i]); L += Math.hypot(a.x - b.x, a.z - b.z); } return L; };

  // Uitlopers wegsnoeien: korte ketens die aan een eind los hangen en korter
  // zijn dan de wegbreedte ter plekke, zijn artefacten van hoeken en pleinen.
  for (let ronde = 0; ronde < 3; ronde++) {
    const { uit, graad } = ketens(sk, W, H);
    let weg = 0;
    for (const pad of uit) {
      const a = pad[0], b = pad[pad.length - 1];
      const losA = graad[a] === 1, losB = graad[b] === 1;
      if (!(losA || losB) || (losA && losB)) continue;
      const knoop = losA ? b : a;
      const L = lengte(pad);
      if (L < Math.max(snoei, naarPunt(knoop).w * 0.9)) {
        for (let i = 0; i < pad.length; i++) { if (pad[i] !== knoop) sk[pad[i]] = 0; }
        weg++;
      }
    }
    if (!weg) break;
  }
  const { uit } = ketens(sk, W, H);
  const ketensUit = [];
  for (const pad of uit) {
    const pts = vereenvoudig(pad.map(naarPunt), tol);
    // breedte per vereenvoudigd punt: mediaan van de omgeving in het pad
    const ws = pad.map(k => naarPunt(k).w).sort((p, q) => p - q);
    const w = ws[Math.floor(ws.length / 2)] || 0;
    let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    if (L < cel) continue;
    ketensUit.push({ pts: pts.map(p => ({ x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100, w: Math.round(p.w * 10) / 10 })), w: Math.round(w * 10) / 10, lengte: Math.round(L * 10) / 10 });
  }
  // ketens samenvoegen op knopen waar nog precies twee ketens overblijven
  return samenvoegen(ketensUit, cel * 1.6);
}

function samenvoegen(ketens, tol) {
  const sleutel = (p) => `${Math.round(p.x / tol)}:${Math.round(p.z / tol)}`;
  const knoop = new Map();
  ketens.forEach((k, i) => {
    for (const eind of [0, 1]) {
      const p = eind ? k.pts[k.pts.length - 1] : k.pts[0];
      const s = sleutel(p);
      if (!knoop.has(s)) knoop.set(s, []);
      knoop.get(s).push({ i, eind });
    }
  });
  const gebruikt = new Uint8Array(ketens.length);
  const uit = [];
  // volgt vanaf een keten door knopen waar precies twee ketens samenkomen
  const verleng = (pts, lengte, wSom, richtingEind) => {
    for (;;) {
      const p = richtingEind ? pts[pts.length - 1] : pts[0];
      const lijst = knoop.get(sleutel(p)) || [];
      const anderen = lijst.filter(e => !gebruikt[e.i]);
      if (lijst.length !== 2 || anderen.length !== 1) return { pts, lengte, wSom };
      const { i, eind } = anderen[0];
      const k = ketens[i]; gebruikt[i] = 1;
      let q = k.pts.slice();
      if (richtingEind) { if (eind === 1) q.reverse(); pts = pts.concat(q.slice(1)); }
      else { if (eind === 0) q.reverse(); pts = q.slice(0, -1).concat(pts); }
      lengte += k.lengte; wSom += k.w * k.lengte;
    }
  };
  for (let i = 0; i < ketens.length; i++) {
    if (gebruikt[i]) continue;
    gebruikt[i] = 1;
    const k = ketens[i];
    let r = verleng(k.pts.slice(), k.lengte, k.w * k.lengte, true);
    r = verleng(r.pts, r.lengte, r.wSom, false);
    uit.push({ pts: r.pts, w: Math.round((r.wSom / (r.lengte || 1)) * 10) / 10, lengte: Math.round(r.lengte * 10) / 10 });
  }
  return uit;
}
