/*
 Het viaduct over de rondweg: de enige plek in de wijk waar de wereld niet plat
 is.

 Tegenover de Jumbo aan de Molenkrite loopt de weg omhoog over een dijklichaam
 en gaat daarna over de N7 heen. Boven op het dek staat een houten boogbrug —
 twee gelamineerde bogen op de dekranden, met trekstangen naar de dekligger en
 dwarsportalen tussen de bogen. Op het dek liggen rode fietsstroken en langs de
 rand een houten leuning.

 De BGT weet welke wegvakken erover heen liggen (relatieveHoogteligging 1),
 maar kent geen hoogte. tools/geo/genereer.mjs maakt daarom een hoogteveld: een
 lijn van station tot station met per station de hoogte en de halve breedte van
 de kruin en van de teen van het talud, links en rechts. Dit bestand leest dat
 uit en beantwoordt de enige vraag die de rest van het spel stelt:

   grondHoogte(x, z, y)  hoe hoog ligt de grond onder je?

 Onder de brug is dat gewoon 0 — daar rijdt de rondweg. Het derde argument is de
 hoogte waar je nu bent; daarmee weet dit bestand of je op de brug staat of
 eronder. Zonder dat argument telt het dek.
*/
import * as THREE from 'three';

let VIA = [];

/** Neemt de viaducten uit js/kaart.js over en bouwt de opzoekroosters. */
export function zetViaducten(lijst) {
  VIA = (lijst || []).map(v => {
    const as = v.as;
    const n = as.length;
    // richting en booglengte per station; links van de rijrichting is +n
    const nrm = [], sAf = [0];
    for (let i = 0; i < n; i++) {
      const a = as[Math.max(0, i - 1)], b = as[Math.min(n - 1, i + 1)];
      const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
      nrm.push([-dz / L, dx / L]);
      if (i) sAf.push(sAf[i - 1] + Math.hypot(as[i][0] - as[i - 1][0], as[i][1] - as[i - 1][1]));
    }
    // rooster: cel -> welke segmenten kunnen hier invloed hebben
    const CEL = 10, rooster = new Map();
    for (let i = 1; i < n; i++) {
      const m = Math.max(as[i - 1][4], as[i - 1][6], as[i][4], as[i][6]) + 1.5;
      const x0 = Math.min(as[i - 1][0], as[i][0]) - m, x1 = Math.max(as[i - 1][0], as[i][0]) + m;
      const z0 = Math.min(as[i - 1][1], as[i][1]) - m, z1 = Math.max(as[i - 1][1], as[i][1]) + m;
      for (let cx = Math.floor(x0 / CEL); cx <= Math.floor(x1 / CEL); cx++)
        for (let cz = Math.floor(z0 / CEL); cz <= Math.floor(z1 / CEL); cz++) {
          const s = `${cx}:${cz}`;
          if (!rooster.has(s)) rooster.set(s, []);
          rooster.get(s).push(i);
        }
    }
    // let op: `boog` uit de kaart is de houten boog, niet de booglengte
    return { ...v, nrm, sAf, CEL, rooster };
  });
}

export function viaducten() { return VIA; }

// Welk stuk van de as ligt het dichtst bij (x,z)? null buiten het viaduct.
function raak(V, x, z) {
  if (x < V.bbox[0] || x > V.bbox[2] || z < V.bbox[1] || z > V.bbox[3]) return null;
  const lijst = V.rooster.get(`${Math.floor(x / V.CEL)}:${Math.floor(z / V.CEL)}`);
  if (!lijst) return null;
  let bi = -1, bt = 0, bd = Infinity;
  for (const i of lijst) {
    const a = V.as[i - 1], b = V.as[i];
    const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1e-9;
    let t = ((x - a[0]) * dx + (z - a[1]) * dz) / L2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const d = Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
    if (d < bd) { bd = d; bi = i; bt = t; }
  }
  if (bi < 0) return null;
  const a = V.as[bi - 1], b = V.as[bi];
  const meng = (p, q) => p + (q - p) * bt;
  // aan welke kant lig je? links van de rijrichting is de normaal van station a
  const nx = V.nrm[bi - 1][0], nz = V.nrm[bi - 1][1];
  const links = (x - meng(a[0], b[0])) * nx + (z - meng(a[1], b[1])) * nz >= 0;
  return {
    h: meng(a[2], b[2]),
    kruin: meng(a[links ? 3 : 5], b[links ? 3 : 5]),
    teen: meng(a[links ? 4 : 6], b[links ? 4 : 6]),
    dek: a[7] === 1 && b[7] === 1,
    d: bd, i: bi, t: bt, links,
  };
}

/**
 * Hoogte van de grond op (x,z). `y` is waar je nu bent: sta je onder de brug,
 * dan is de grond het maaiveld en niet het dek.
 */
export function grondHoogte(x, z, y = Infinity) {
  let uit = 0;
  for (const V of VIA) {
    const r = raak(V, x, z);
    if (!r || r.h <= 0) continue;
    let h;
    if (r.d <= r.kruin) h = r.h;
    else if (r.teen <= r.kruin || r.d >= r.teen) h = 0;
    else h = r.h * (r.teen - r.d) / (r.teen - r.kruin);
    if (h <= 0) continue;
    // op een brugdek kun je er ook onderdoor: dan telt het maaiveld
    if (r.dek && y < h - 1.2) continue;
    if (h > uit) uit = h;
  }
  return uit;
}

/**
 * Ligt hier een brugdek boven het maaiveld (dus: kun je eronderdoor)? `marge`
 * rekent er een strook naast het dek bij op — bomen met een kroon van drie
 * meter groeiden anders dwars door de brug heen.
 */
export function onderBrug(x, z, marge = 0) {
  for (const V of VIA) { const r = raak(V, x, z); if (r && r.dek && r.d <= r.kruin + marge && r.h > 2) return true; }
  return false;
}

/** Ligt (x,z) op het weglichaam van een viaduct (kruin, niet het talud)? */
export function opViaduct(x, z) {
  for (const V of VIA) { const r = raak(V, x, z); if (r && r.h > 0.15 && r.d <= r.kruin) return true; }
  return false;
}

// ---------------------------------------------------------------- meetkunde
// Een doos met een gegeven middelpunt, halve maten en draaiing om Y.
function doos(g, cx, cy, cz, hx, hy, hz, yaw, uvS = 0.5) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const p = (lx, ly, lz) => [cx + lx * c + lz * s, cy + ly, cz - lx * s + lz * c];
  const V = [
    p(-hx, -hy, -hz), p(hx, -hy, -hz), p(hx, hy, -hz), p(-hx, hy, -hz),
    p(-hx, -hy, hz), p(hx, -hy, hz), p(hx, hy, hz), p(-hx, hy, hz),
  ];
  const vlakken = [
    [4, 5, 6, 7], [1, 0, 3, 2], [0, 4, 7, 3], [5, 1, 2, 6], [3, 7, 6, 2], [0, 1, 5, 4],
  ];
  for (const [a, b, cc, d] of vlakken) {
    const A = V[a], B = V[b], C = V[cc], D = V[d];
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
    const vx = D[0] - A[0], vy = D[1] - A[1], vz = D[2] - A[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
    const bu = Math.hypot(ux, uy, uz) * uvS, bv = Math.hypot(vx, vy, vz) * uvS;
    const hoek = [[A, 0, 0], [B, bu, 0], [C, bu, bv], [D, 0, bv]];
    for (const [i, j, k] of [[0, 1, 2], [0, 2, 3]]) for (const q of [i, j, k]) {
      g.pos.push(hoek[q][0][0], hoek[q][0][1], hoek[q][0][2]);
      g.uv.push(hoek[q][1], hoek[q][2]); g.nor.push(nx, ny, nz);
    }
  }
}

// Een strook tussen twee dwarsprofielen: links..rechts met hoogtes per punt.
function strook(g, A, B, uvS = 0.25) {
  for (let k = 0; k < A.length - 1; k++) {
    const q = [A[k], A[k + 1], B[k + 1], B[k]];
    for (const [i, j, m] of [[0, 1, 2], [0, 2, 3]]) {
      const P = q[i], Q = q[j], R = q[m];
      let nx = (Q[1] - P[1]) * (R[2] - P[2]) - (Q[2] - P[2]) * (R[1] - P[1]);
      let ny = (Q[2] - P[2]) * (R[0] - P[0]) - (Q[0] - P[0]) * (R[2] - P[2]);
      let nz = (Q[0] - P[0]) * (R[1] - P[1]) - (Q[1] - P[1]) * (R[0] - P[0]);
      const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
      if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
      for (const v of [P, Q, R]) { g.pos.push(v[0], v[1], v[2]); g.uv.push(v[0] * uvS, v[2] * uvS); g.nor.push(nx, ny, nz); }
    }
  }
}

function mesh(g, mat, schaduw = true) {
  if (!g.pos.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.nor, 3));
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = schaduw; m.receiveShadow = true;
  return m;
}

// ---------------------------------------------------------------- bouwen
/**
 * Bouwt de dijklichamen, de dekken en de houten bogen.
 * KM zijn de materialen van js/kaartwereld.js.
 */
export function bouwViaducten(scene, W, KM) {
  const uit = [];
  for (const V of VIA) uit.push(bouwEen(scene, W, KM, V));
  return uit;
}

function bouwEen(scene, W, KM, V) {
  const as = V.as, n = as.length;
  const grond = { pos: [], uv: [], nor: [] };      // dijklichaam
  const beton = { pos: [], uv: [], nor: [] };      // dekligger, landhoofden, pijler
  const hout = { pos: [], uv: [], nor: [] };       // bogen en leuning
  const punt = (i, zij, y) => [as[i][0] + V.nrm[i][0] * zij, y, as[i][1] + V.nrm[i][1] * zij];

  /*
   Dijklichaam. De BGT-vlakken (weg, berm, gras) worden door kaartwereld.js zelf
   omhoog gelegd met grondHoogte, dus dit is alleen de onderlaag: hij vult de
   gaten tussen die vlakken en zorgt dat je nergens door de dijk heen kijkt.
  */
  const ONDER = 0.06;
  for (let i = 1; i < n; i++) {
    if (as[i - 1][7] && as[i][7]) continue;                 // op het dek geen dijk
    if (as[i - 1][2] < 0.02 && as[i][2] < 0.02) continue;   // op maaiveld niet nodig
    const prof = (k) => {
      const [x, z, h, kl, tl, kr, tr] = as[k];
      return [punt(k, -tr, 0), punt(k, -kr, h - ONDER), punt(k, kl, h - ONDER), punt(k, tl, 0)];
    };
    strook(grond, prof(i - 1), prof(i), 0.12);
  }

  // Brugdek: rijvlak, dekligger eronder en de randen dicht.
  const d0 = Math.max(1, V.dekVan), d1 = Math.min(n - 1, V.dekTot);
  const DIK = V.dekdikte;
  for (let i = d0 + 1; i <= d1; i++) {
    const prof = (k, y) => { const [, , h, kl, , kr] = as[k]; return [punt(k, -kr - 0.35, y(h)), punt(k, kl + 0.35, y(h))]; };
    strook(beton, prof(i - 1, h => h - DIK), prof(i, h => h - DIK), 0.25);
    // zijkanten van de ligger
    for (const zij of [1, -1]) {
      const w = (k) => (zij > 0 ? as[k][3] : -as[k][5]) + zij * 0.35;
      const A = [punt(i - 1, w(i - 1), as[i - 1][2] - DIK), punt(i - 1, w(i - 1), as[i - 1][2] + 0.05)];
      const B = [punt(i, w(i), as[i][2] - DIK), punt(i, w(i), as[i][2] + 0.05)];
      strook(beton, A, B, 0.4);
    }
  }

  /*
   Landhoofden: het dijklichaam houdt bij de brug op, dus daar staat een muur.
   Zonder die muur kijk je van opzij zo de dijk in.
  */
  for (const k of [d0, d1]) {
    const [x, z, h, kl, , kr] = as[k];
    // lokale x dwars over de weg (langs de normaal), lokale z in de rijrichting
    const yaw = Math.atan2(-V.nrm[k][1], V.nrm[k][0]);
    const breed = (kl + kr) / 2 + 0.4;
    const mid = (kl - kr) / 2;
    doos(beton, x + V.nrm[k][0] * mid, (h - DIK) / 2, z + V.nrm[k][1] * mid, breed, (h - DIK) / 2, 0.6, yaw, 0.3);
  }

  // Pijler in de middenberm, op het grondvlak dat de BGT tekent.
  for (const ring of V.pijlers || []) {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const [x, z] of ring) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    // langste zijde bepaalt de richting van de pijlerwand
    let bl = 0, yaw = 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L > bl) { bl = L; yaw = Math.atan2(-(b[1] - a[1]), b[0] - a[0]); }
    }
    const r = raak(V, cx, cz);
    const top = (r ? r.h : V.hoogte) - DIK;
    doos(beton, cx, top / 2, cz, bl / 2 - 0.3, top / 2, 0.9, yaw, 0.3);
    // de pijler staat onder het dek: wie erboven rijdt heeft er niets mee te maken
    W.addCollider(cx, cz, bl / 2, 0.9, yaw, top).y0 = 0;
  }

  /*
   De houten boog. Op de foto zijn het twee brede gebogen wangen die vanaf de
   dekranden naar elkaar toe hellen en boven het midden van de rijbaan bijna
   samenkomen — vandaar dat je er vanaf het dek tegen een spitsboog aankijkt,
   en vanaf de rijksweg tegen een boog die de weg overspant. Elke wang bestaat
   uit twee evenwijdige gebogen liggers met latten ertussen; helemaal bovenin
   verbinden een paar trekstangen de twee wangen.

   Wat er níét is: dwarsbalken op ooghoogte. Die stonden er eerst wel en dan rij
   je bovenop de brug tegen een pergola aan.
  */
  const B = V.boog || {};
  if (B.overspanning) {
    const mid = (d0 + d1) / 2;
    const halve = Math.min((d1 - d0) / 2 - 1, B.overspanning / 2);
    const i0 = Math.round(mid - halve), i1 = Math.round(mid + halve);
    const dikte = B.balk || 0.45;
    const DELEN = 28;
    const laagAf = B.laagAfstand ?? 0.9;      // afstand tussen de twee liggers, langs de brug
    /*
     Hoe ver staat de boog op hoogte u nog uit de as? Bij de voet staat hij op de
     dekrand, vanaf ongeveer een tiende van de overspanning helt hij naar binnen
     en bij de top raakt hij bijna de hartlijn. `resthoek` laat een spleet open,
     zodat de twee wangen elkaar niet doorsnijden.
    */
    const helling = (u) => 0.05 + 0.95 * Math.min(1, Math.abs(2 * u - 1) * 1.25);
    const boogY = (u, dekY) => dekY + B.pijl * (1 - (2 * u - 1) * (2 * u - 1));
    // punt op de boog: u = 0..1 over de overspanning, zij = links/rechts,
    // laag = -1/+1 voor de twee evenwijdige liggers (verschoven langs de brug)
    const boogPunt = (u, zij, laag = 0) => {
      // tussen twee stations in: afronden op een heel station gaf een boog met
      // knikken erin, want de as ligt maar om de meter vast
      const i = Math.max(0, Math.min(n - 1.001, i0 + (i1 - i0) * u + laag * laagAf / 2));
      const k = Math.floor(i), f = i - k, k2 = Math.min(n - 1, k + 1);
      const meng = (a, b) => a + (b - a) * f;
      const kruinL = meng(as[k][3], as[k2][3]), kruinR = meng(as[k][5], as[k2][5]);
      const rand = (zij > 0 ? kruinL + 0.25 : -(kruinR + 0.25)) * helling(u);
      const nx = meng(V.nrm[k][0], V.nrm[k2][0]), nz = meng(V.nrm[k][1], V.nrm[k2][1]);
      const dekY = meng(as[k][2], as[k2][2]);
      return [meng(as[k][0], as[k2][0]) + nx * rand, boogY(u, dekY), meng(as[k][1], as[k2][1]) + nz * rand];
    };
    const balk = (a, b, half) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      const L = Math.hypot(dx, dy, dz);
      if (L < 1e-3) return;
      const hb = Array.isArray(half) ? half[0] : half;
      doosSchuin(hout, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
        half, L / 2 + hb * 0.4, Math.atan2(dx, dz), -Math.atan2(dy, Math.hypot(dx, dz)));
    };
    for (const zij of [1, -1]) {
      for (const laag of [-1, 1]) {
        let vorig = boogPunt(0, zij, laag);
        for (let sg = 1; sg <= DELEN; sg++) {
          const nu = boogPunt(sg / DELEN, zij, laag);
          balk(vorig, nu, [dikte * 0.34, dikte * 0.6]);   // gelamineerde ligger: hoger dan breed
          vorig = nu;
        }
      }
      // latten tussen de twee liggers: dat maakt de wang een vlak in plaats van
      // twee losse balken, net als het lattenwerk op de foto
      const latten = B.latten || 14;
      for (let k = 0; k <= latten; k++) {
        const u = k / latten;
        balk(boogPunt(u, zij, -1), boogPunt(u, zij, 1), [dikte * 0.28, dikte * 0.22]);
      }
    }
    // trekstangen bij de top, tussen de twee wangen door
    for (let k = 1; k <= (B.trekstangen || 0); k++) {
      const u = 0.5 + (k - ((B.trekstangen || 0) + 1) / 2) * 0.075;
      balk(boogPunt(u, 1, 0), boogPunt(u, -1, 0), 0.07);
    }
    // de boogvoeten staan buiten de leuning; ze zijn dik genoeg om tegenaan te rijden
    for (const zij of [1, -1]) for (const i of [i0, i1]) {
      const w = zij > 0 ? as[i][3] + 0.25 : -(as[i][5] + 0.25);
      const p = punt(i, w, as[i][2]);
      W.addCollider(p[0], p[2], dikte, dikte + laagAf / 2, 0, 3).y0 = as[i][2];
    }
  }

  // -- houten leuning langs het dek en een stuk de oprit op
  const L = V.leuning || { hoogte: 1.3 };
  const van = Math.max(1, d0 - 10), tot = Math.min(n - 2, d1 + 10);
  for (const zij of [1, -1]) {
    let vorigP = null;
    for (let i = van; i <= tot; i++) {
      const w = zij > 0 ? as[i][3] + 0.22 : -(as[i][5] + 0.22);
      const p = punt(i, w, as[i][2]);
      if ((i - van) % 2 === 0) doos(hout, p[0], p[1] + L.hoogte / 2, p[2], 0.07, L.hoogte / 2, 0.07, 0, 0.7);
      if (vorigP) {
        const dx = p[0] - vorigP[0], dz = p[2] - vorigP[2], dy = p[1] - vorigP[1];
        const len = Math.hypot(dx, dz, dy);
        const yaw = Math.atan2(dx, dz), hel = -Math.atan2(dy, Math.hypot(dx, dz));
        for (const hh of [L.hoogte, L.hoogte * 0.55]) {
          doosSchuin(hout, [(p[0] + vorigP[0]) / 2, (p[1] + vorigP[1]) / 2 + hh, (p[2] + vorigP[2]) / 2], hh === L.hoogte ? 0.06 : 0.045, len / 2 + 0.02, yaw, hel);
        }
      }
      vorigP = p;
    }
    // botsdozen: elke vier meter een stukje muur, zodat je er niet af rijdt
    for (let i = van; i < tot; i += 4) {
      const j = Math.min(tot, i + 4);
      const w = (k) => zij > 0 ? as[k][3] + 0.22 : -(as[k][5] + 0.22);
      const a = punt(i, w(i), as[i][2]), b = punt(j, w(j), as[j][2]);
      const cx = (a[0] + b[0]) / 2, cz = (a[2] + b[2]) / 2;
      const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
      const yaw = Math.atan2(b[0] - a[0], b[2] - a[2]);
      const c = W.addCollider(cx, cz, 0.12, len / 2, yaw, L.hoogte);
      c.y0 = Math.min(as[i][2], as[j][2]) - 0.5;
    }
  }

  const delen = [];
  // het hout krijgt de tint uit data/stijl/omgeving.json; de bogen en de
  // leuning op de foto zijn lichter dan het schuttinghout in de tuinen
  const houtMat = KM.hout.clone();
  if (V.boog && V.boog.kleur) houtMat.color = new THREE.Color(V.boog.kleur);
  for (const [g, mat, naam] of [[grond, KM.gras, 'dijk'], [beton, KM.beton, 'dekligger'], [hout, houtMat, 'boog']]) {
    const m = mesh(g, mat, naam !== 'dijk');
    if (m) { m.userData.klasse = `viaduct_${naam}`; scene.add(m); delen.push(m); }
  }
  return { naam: V.naam, delen };
}

// Een doos die om Y draait én kantelt (voor boogdelen en leuningregels).
// `half` mag een getal zijn (vierkant) of [breed, hoog] voor een plank.
function doosSchuin(g, c, half, halfLang, yaw, helling) {
  const hb = Array.isArray(half) ? half[0] : half;
  const hh = Array.isArray(half) ? half[1] : half;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(helling, yaw, 0, 'YXZ'));
  const v = new THREE.Vector3();
  const hoekpunten = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    v.set(sx * hb, sy * hh, sz * halfLang).applyQuaternion(q);
    hoekpunten.push([c[0] + v.x, c[1] + v.y, c[2] + v.z]);
  }
  // index: (sx,sy,sz) -> 4*sx' + 2*sy' + sz'
  const P = (a, b, cc) => hoekpunten[(a > 0 ? 4 : 0) + (b > 0 ? 2 : 0) + (cc > 0 ? 1 : 0)];
  const vlakken = [
    [P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1)],
    [P(1, -1, -1), P(-1, -1, -1), P(-1, 1, -1), P(1, 1, -1)],
    [P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1)],
    [P(1, -1, 1), P(1, -1, -1), P(1, 1, -1), P(1, 1, 1)],
    [P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1), P(-1, 1, -1)],
    [P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1)],
  ];
  for (const [A, Bp, C, D] of vlakken) {
    const ux = Bp[0] - A[0], uy = Bp[1] - A[1], uz = Bp[2] - A[2];
    const vx = D[0] - A[0], vy = D[1] - A[1], vz = D[2] - A[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const Ln = Math.hypot(nx, ny, nz) || 1; nx /= Ln; ny /= Ln; nz /= Ln;
    const bu = Math.hypot(ux, uy, uz) * 0.6, bv = Math.hypot(vx, vy, vz) * 0.6;
    const hoek = [[A, 0, 0], [Bp, bu, 0], [C, bu, bv], [D, 0, bv]];
    for (const [i, j, k] of [[0, 1, 2], [0, 2, 3]]) for (const q2 of [i, j, k]) {
      g.pos.push(hoek[q2][0][0], hoek[q2][0][1], hoek[q2][0][2]);
      g.uv.push(hoek[q2][1], hoek[q2][2]); g.nor.push(nx, ny, nz);
    }
  }
}
