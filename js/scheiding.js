/*
 Muren, hekken, kademuren, damwanden, vangrails en balustrades.

 Dit is straatmeubilair dat gewoon in de BGT staat en er tot nu toe niet uit
 kwam: de laag `scheiding` (muur, hek, kademuur, walbescherming, damwand) en de
 twee soorten uit `weginrichtingselement` die je van de weg af ziet
 (geleideconstructie = vangrail, en balustrade). Samen ruim acht kilometer.

 De BGT weet waar ze liggen en hoe dik een muur is, maar niet hoe hoog; dat
 staat per soort in data/stijl/omgeving.json en komt via js/kaart.js mee.

 Alles van één soort wordt in één mesh gepropt. Dat is hier bijna gratis — een
 muur is een doos en een vangrail is een balkje op paaltjes — en het scheelt
 honderd draw calls. Wat er wél per stuk bij komt is een botsdoos: tegen een
 muur en een vangrail rijd je stuk, en door een spijlenhek loop je niet heen.
*/
import * as THREE from 'three';

// hoe hoog boven de grond het balkje van een vangrail hangt
const RAIL_Y = 0.52;

function doosNaar(g, a, b, y0, y1, dik, uvSchaal = 0.5) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const L = Math.hypot(dx, dz);
  if (L < 1e-3) return;
  const ux = dx / L, uz = dz / L;          // langs
  const nx = -uz, nz = ux;                 // dwars
  const h = dik / 2;
  const p = (t, zij, y) => [a[0] + ux * t + nx * zij * h, y, a[1] + uz * t + nz * zij * h];
  const hoek = [
    p(0, -1, y0), p(L, -1, y0), p(L, 1, y0), p(0, 1, y0),
    p(0, -1, y1), p(L, -1, y1), p(L, 1, y1), p(0, 1, y1),
  ];
  const vlakken = [
    [4, 5, 6, 7],            // boven
    [0, 3, 2, 1],            // onder
    [0, 1, 5, 4],            // zijkant
    [2, 3, 7, 6],            // andere zijkant
    [1, 2, 6, 5],            // kop
    [3, 0, 4, 7],            // kop
  ];
  for (const [i0, i1, i2, i3] of vlakken) {
    const A = hoek[i0], B = hoek[i1], C = hoek[i2], D = hoek[i3];
    const ux2 = B[0] - A[0], uy2 = B[1] - A[1], uz2 = B[2] - A[2];
    const vx = D[0] - A[0], vy = D[1] - A[1], vz = D[2] - A[2];
    let mx = uy2 * vz - uz2 * vy, my = uz2 * vx - ux2 * vz, mz = ux2 * vy - uy2 * vx;
    const Lm = Math.hypot(mx, my, mz) || 1; mx /= Lm; my /= Lm; mz /= Lm;
    const bu = Math.hypot(ux2, uy2, uz2) * uvSchaal, bv = Math.hypot(vx, vy, vz) * uvSchaal;
    const q = [[A, 0, 0], [B, bu, 0], [C, bu, bv], [D, 0, bv]];
    for (const [i, j, k] of [[0, 1, 2], [0, 2, 3]]) for (const m of [i, j, k]) {
      g.pos.push(q[m][0][0], q[m][0][1], q[m][0][2]);
      g.uv.push(q[m][1], q[m][2]);
      g.nor.push(mx, my, mz);
    }
  }
}

/*
 Een paaltje. Dit ging eerst via doosNaar met een segment van een millimeter
 lang, en dat leverde een plaatje van een millimeter breed op dat je niet zag —
 en de helft van de tijd viel het weg tegen de ondergrens voor lengte.
*/
function paalOp(g, x, z, y0, y1, dik) {
  doosNaar(g, [x - dik / 2, z], [x + dik / 2, z], y0, y1, dik, 0.8);
}

// Een doorzichtig paneel met een hektextuur erop, zoals bij de omheinde terreinen.
function paneel(g, a, b, y0, h, weg) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
  if (L < 0.2) return;
  const nx = dz / L, nz = -dx / L;
  const q = [[a[0], y0 + h, a[1]], [b[0], y0 + h, b[1]], [b[0], y0, b[1]], [a[0], y0, a[1]]];
  for (const [i0, i1, i2] of [[0, 1, 2], [0, 2, 3]]) for (const k of [i0, i1, i2]) {
    const v = q[k];
    g.pos.push(v[0], v[1], v[2]);
    g.uv.push((weg + (k === 1 || k === 2 ? L : 0)) / 2.5, (v[1] - y0) / h);
    g.nor.push(nx, 0, nz);
  }
}

/*
 Een tag op een muurvlak: een rechthoekje dat aan beide kanten van de muur wordt
 gezet, met de uv's op een van de vier vakken van het graffitidoek.

 `dx, dz` is de richting van het muurstuk over zijn lengte, `L` die lengte, `uit`
 hoe ver het vlak voor de muur ligt.
*/
function tag(g, cx, cz, cy, dx, dz, L, breed, hoog, uit, vak) {
  const ux = dx / L, uz = dz / L;             // langs de muur
  const nx = -uz, nz = ux;                    // dwars erop
  const u0 = (vak % 2) * 0.5, v0 = (1 - Math.floor(vak / 2)) * 0.5;
  const uvs = [[u0, v0], [u0 + 0.5, v0], [u0 + 0.5, v0 + 0.5], [u0, v0 + 0.5]];
  for (const kant of [-1, 1]) {
    const ox = nx * uit * kant, oz = nz * uit * kant;
    const hb = breed / 2, hh = hoog / 2;
    const p = [
      [cx - ux * hb + ox, cy - hh, cz - uz * hb + oz],
      [cx + ux * hb + ox, cy - hh, cz + uz * hb + oz],
      [cx + ux * hb + ox, cy + hh, cz + uz * hb + oz],
      [cx - ux * hb + ox, cy + hh, cz - uz * hb + oz],
    ];
    const volgorde = kant > 0 ? [[0, 1, 2], [0, 2, 3]] : [[0, 2, 1], [0, 3, 2]];
    for (const driehoek of volgorde) {
      for (const i of driehoek) {
        g.pos.push(...p[i]);
        g.uv.push(uvs[i][0], uvs[i][1]);
        g.nor.push(nx * kant, 0, nz * kant);
      }
    }
  }
}

function mesh(g, mat, klasse, schaduw = true) {
  if (!g.pos.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.nor, 3));
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = schaduw; m.receiveShadow = true;
  m.userData.klasse = klasse;
  m.userData.scheiding = klasse;     // waaraan de proef ze herkent
  return m;
}

/**
 * Bouwt alle scheidingen uit de kaart.
 * `grond(x, z)` geeft de hoogte van het maaiveld (of van het brugdek).
 */
// hoeveel muurstukken op een rijbaan zijn overgeslagen (stap 130)
export let muurOpWeg = 0;

export function bouwScheidingen(scene, W, KM, lijst, grond = () => 0, opWeg = null) {
  if (!lijst || !lijst.length) return 0;
  const nieuw = () => ({ pos: [], uv: [], nor: [] });
  const beton = nieuw(), metaal = nieuw(), hout = nieuw(), gaas = nieuw();
  // tags op de blinde muren; zie de uitleg onderaan bij `verf`
  const verf = nieuw();
  let n = 0;
  let overgeslagen = 0;
  // de laagste en hoogste grond langs een stuk muur, aan beide kanten (stap 138)
  const bereik = (a, b, dik) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
    const nx = -dz / L * (dik / 2 + 0.4), nz = dx / L * (dik / 2 + 0.4);
    let lo = Infinity, hi = -Infinity;
    for (const f of [0, 0.5, 1]) for (const z of [-1, 0, 1]) {
      const y = grond(a[0] + dx * f + nx * z, a[1] + dz * f + nz * z);
      lo = Math.min(lo, y); hi = Math.max(hi, y);
    }
    return [lo, hi];
  };
  const helling = (a, b, dik) => { const [lo, hi] = bereik(a, b, dik); return hi - lo > 0.15; };

  for (const s of lijst) {
    const h = s.h || 1.6;
    const dik = s.dik || (s.soort === 'muur' ? 0.3 : s.soort === 'kademuur' ? 0.5 : 0.12);
    let weg = 0;
    for (let i = 1; i < s.pts.length; i++) {
      const a = s.pts[i - 1], b = s.pts[i];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 0.1) continue;
      const y0 = Math.min(grond(a[0], a[1]), grond(b[0], b[1]));
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      const yaw = -Math.atan2(b[1] - a[1], b[0] - a[0]);
      /*
       Een muur midden op de rijbaan (stap 130, gemeten op (−168, −484): drie BGT-muren van 2 m zigzaggen daar over de
       rondweg, "de weg ziet er raar uit met objecten"). Ligt een stuk met zijn midden én een halve meter aan beide
       kanten op een rijbaan, dan is het een fout in de bron: dat stuk komt er niet, en zijn botsdoos ook niet.
      */
      if (opWeg && (s.soort === 'muur' || s.soort === 'hek')) {
        const nx = -(b[1] - a[1]) / L * 0.6, nz = (b[0] - a[0]) / L * 0.6;
        let opRijbaan = 0;
        for (const f of [0.1, 0.3, 0.5, 0.7, 0.9]) if (opWeg(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)) opRijbaan++;
        // (de foto liet stompjes over de middenberm staan: midden op het gras, de rest op de weg; nu telt de helft)
        if ((opWeg(mx, mz) && opWeg(mx + nx, mz + nz) && opWeg(mx - nx, mz - nz)) || opRijbaan >= 3) { weg += L; overgeslagen++; continue; }
      }

      if (s.soort === 'hek') {
        paneel(gaas, a, b, y0 + 0.02, h, weg);
      } else if (s.soort === 'vangrail') {
        /*
         Een vangrail is geen muur maar een balk op paaltjes: het geprofileerde
         blad hangt op een halve meter en je kijkt eronderdoor. Dat verschil zie
         je meteen — een dichte balk op de grond leest als een stoeprand.
        */
        doosNaar(metaal, a, b, y0 + RAIL_Y, y0 + RAIL_Y + 0.31, 0.09, 0.8);
        for (let t = 0; t < L - 0.5; t += 4) {
          const f = t / L;
          paalOp(metaal, a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, y0, y0 + RAIL_Y + 0.2, 0.12);
        }
      } else if (s.soort === 'balustrade') {
        for (const y of [y0 + h - 0.06, y0 + h * 0.55]) doosNaar(metaal, a, b, y, y + 0.07, 0.07, 0.8);
        for (let t = 0; t < L - 0.3; t += 2) {
          const f = t / L;
          paalOp(metaal, a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, y0, y0 + h, 0.06);
        }
      } else if (s.soort === 'damwand') {
        doosNaar(hout, a, b, y0 - 0.6, y0 + h, dik, 0.7);
      } else if (helling(a, b, dik)) {
        /*
         Een muur op een helling (stap 138): de keermuren langs de bak van de N7
         bij (719, −156) staan in de BGT op de rand van de bak, half op het talud.
         Eén doos van de laagste grond tot twee meter daarboven stak als een grijze
         driehoek uit het gras, en aan de hoge kant stond er niets. Nu in stukjes
         van hoogstens anderhalve meter, elk van de laagste grond aan zijn twee
         kanten tot een meter boven de hoogste: een keermuur, die de grond
         tegenhoudt en er een eind boven uitsteekt.
        */
        const stukjes = Math.max(1, Math.ceil(L / 1.5));
        for (let k = 0; k < stukjes; k++) {
          const p = [a[0] + (b[0] - a[0]) * k / stukjes, a[1] + (b[1] - a[1]) * k / stukjes];
          const q = [a[0] + (b[0] - a[0]) * (k + 1) / stukjes, a[1] + (b[1] - a[1]) * (k + 1) / stukjes];
          const [lo, hi] = bereik(p, q, dik);
          const top = hi + (hi - lo > 0.5 ? Math.min(h, 1) : h);
          doosNaar(beton, p, q, lo - 0.2, top, dik, 0.45);
          const c = W.addCollider((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, L / stukjes / 2, Math.max(0.12, dik / 2), yaw, top - lo);
          c.y0 = lo;
        }
        weg += L;
        continue;
      } else {
        doosNaar(beton, a, b, y0 - 0.2, y0 + h, dik, 0.45);
        /*
         En af en toe een tag erop. Een blinde muur langs een fietspad blijft in
         geen enkele wijk dertig jaar schoon; dit is wat er dan op staat. Het
         vlak ligt vijf centimeter voor de muur, zodat het er niet doorheen
         flikkert, en het kiest een van de vier tags op het doek door de uv's op
         een van de vier vakken te zetten. Eén op de negen stukken muur, en
         alleen als hij hoog en lang genoeg is om er iets op te zetten.
        */
        if (h > 1.1 && L > 2.4 && ((i * 2654435761 + Math.round(mx * 7) + Math.round(mz * 13)) >>> 0) % 9 === 0) {
          const vak = ((Math.round(mx) + Math.round(mz * 3)) >>> 0) % 4;
          const tagB = Math.min(L - 0.6, 1.4 + (Math.abs(Math.round(mx)) % 5) * 0.4);
          const tagH = Math.min(h - 0.4, tagB * 0.62);
          const f = 0.5;
          const cx = a[0] + (b[0] - a[0]) * f, cz = a[1] + (b[1] - a[1]) * f;
          tag(verf, cx, cz, y0 + 0.35 + tagH / 2, b[0] - a[0], b[1] - a[1], L, tagB, tagH, dik / 2 + 0.05, vak);
        }
      }

      // botsdozen: een muur houdt je tegen, een damwand aan de waterkant ook
      if (h >= 0.4) {
        const c = W.addCollider(mx, mz, L / 2, Math.max(0.12, dik / 2), yaw, h);
        c.y0 = y0;
      }
      weg += L;
    }
    n++;
  }

  const delen = [];
  if (verf.pos.length) {
    const mv = mesh(verf, KM.graffiti, 'graffiti', false);
    if (mv) { mv.renderOrder = 1; scene.add(mv); delen.push(mv); }
  }
  for (const [g, mat, klasse] of [
    [beton, KM.betonwand || KM.beton, 'muur'],
    [metaal, KM.staal, 'vangrail'],
    [hout, KM.oeverwand || KM.hout, 'damwand'],
    [gaas, KM.spijlen, 'hekwerk'],
  ]) {
    const m = mesh(g, mat, klasse, klasse !== 'damwand');
    if (m) { scene.add(m); delen.push(m); }
  }
  muurOpWeg = overgeslagen;                    // (stap 130, voor de proef)
  return n;
}
