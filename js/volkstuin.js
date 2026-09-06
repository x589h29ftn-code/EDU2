/*
 De volkstuinen achter de Wieken.

 Het perceel tussen de twee sloten staat in de BGT als één stuk gras; de tuintjes
 zelf zijn te klein om geregistreerd te worden. tools/geo/genereer.mjs zet ze
 daarom uit binnen dat perceel — rijen rug aan rug met een pad ertussen, met een
 grasrand langs de sloot — en dit bestand bouwt wat erop staat:

   - een schelpenpad tussen de rijen;
   - per tuintje omgespitte grond met bedden gewas, een lage haag of een
     gaashekje eromheen, en een klein poortje aan de padkant;
   - bij een deel van de tuintjes een houten schuurtje met een lessenaarsdak,
     bij een kleiner deel een kasje van glas op een houten voet;
   - een regenton naast het schuurtje en hier en daar een bonenstaakrek.

 Je kunt tussen de bedden door lopen: alleen de schuurtjes, de kassen en de
 hagen houden je tegen.
*/
import * as THREE from 'three';
import * as T from './textures.js';

const GROND_Y = 0.12;       // de tuinen liggen op stoephoogte, net als het gras

function materialen() {
  const std = (map, extra = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.95, metalness: 0, ...extra });
  return {
    pad: std(T.schelpenpad()),
    bed: [0, 1, 2, 3, 4].map(i => std(T.moestuin(i))),
    haag: std(T.hedge('groen')),
    gaas: new THREE.MeshStandardMaterial({ map: T.tuingaas(), transparent: true, alphaTest: 0.15, side: THREE.DoubleSide, roughness: 0.9, depthWrite: false }),
    hout: std(T.planks('#7a5f42')),
    houtDonker: new THREE.MeshStandardMaterial({ color: 0x6b5238, roughness: 0.95 }),
    dak: new THREE.MeshStandardMaterial({ color: 0x40454a, roughness: 0.9 }),
    glas: new THREE.MeshStandardMaterial({ color: 0xcfe2e6, roughness: 0.1, metalness: 0.05, transparent: true, opacity: 0.42, side: THREE.DoubleSide }),
    ton: new THREE.MeshStandardMaterial({ color: 0x2f5a3c, roughness: 0.7 }),
    stok: new THREE.MeshStandardMaterial({ color: 0xa88f63, roughness: 0.95 }),
    frame: new THREE.MeshStandardMaterial({ color: 0x8d9296, roughness: 0.45, metalness: 0.5 }),
  };
}

// deterministisch, zodat de tuinen er elke keer hetzelfde uitzien
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/*
 Alle randen van alle tuintjes gaan in twee meshes: één met haag en één met
 gaas. Een eigen Mesh per stukje rand zou bij zestig tuintjes al tweehonderdvijftig
 draw calls kosten, en een BoxGeometry legt zijn texture bovendien één keer over
 de hele lengte — dan wordt een haag van tien meter één uitgerekte veeg. Daarom
 wordt hier per stuk zelf geometrie gemaakt, met een uv die met de lengte meeloopt
 (één herhaling per meter).
*/
function hegStuk(g, cx, cz, len, dik, h, hoek) {
  const ex = Math.cos(hoek), ez = Math.sin(hoek);          // langs de haag
  const nx = -ez, nz = ex;                                 // dwars erop
  const hl = len / 2, hd = dik / 2;
  const p = (u, v, y) => [cx + ex * u + nx * v, y, cz + ez * u + nz * v];
  const quad = (a, b, c, d, u1, v1, normaal) => {
    for (const [q, uv] of [[a, [0, 0]], [b, [u1, 0]], [c, [u1, v1]], [a, [0, 0]], [c, [u1, v1]], [d, [0, v1]]]) {
      g.pos.push(q[0], q[1], q[2]); g.uv.push(uv[0], uv[1]); g.nor.push(normaal[0], normaal[1], normaal[2]);
    }
  };
  const y0 = GROND_Y, y1 = GROND_Y + h;
  // twee lange zijden, twee kopse kanten en het bovenvlak
  quad(p(-hl, hd, y0), p(hl, hd, y0), p(hl, hd, y1), p(-hl, hd, y1), len, h, [nx, 0, nz]);
  quad(p(hl, -hd, y0), p(-hl, -hd, y0), p(-hl, -hd, y1), p(hl, -hd, y1), len, h, [-nx, 0, -nz]);
  quad(p(hl, hd, y0), p(hl, -hd, y0), p(hl, -hd, y1), p(hl, hd, y1), dik, h, [ex, 0, ez]);
  quad(p(-hl, -hd, y0), p(-hl, hd, y0), p(-hl, hd, y1), p(-hl, -hd, y1), dik, h, [-ex, 0, -ez]);
  quad(p(-hl, -hd, y1), p(hl, -hd, y1), p(hl, hd, y1), p(-hl, hd, y1), len, dik, [0, 1, 0]);
}

// een enkel staand vlak (gaashekje), van twee kanten te zien
function vlakStuk(g, cx, cz, len, h, hoek) {
  const ex = Math.cos(hoek), ez = Math.sin(hoek);
  const hl = len / 2;
  const p = (u, y) => [cx + ex * u, y, cz + ez * u];
  const A = p(-hl, GROND_Y), B = p(hl, GROND_Y), C = p(hl, GROND_Y + h), D = p(-hl, GROND_Y + h);
  for (const [q, uv] of [[A, [0, 0]], [B, [len, 0]], [C, [len, h]], [A, [0, 0]], [C, [len, h]], [D, [0, h]]]) {
    g.pos.push(q[0], q[1], q[2]); g.uv.push(uv[0], uv[1]); g.nor.push(-ez, 0, ex);
  }
}

/*
 Een kasje: glazen wanden met een zadeldakje erop, en een aluminium frame langs
 alle ribben. Zonder dat frame is het een doorzichtige doos zonder vorm — je zag
 alleen een vage glasplaat in het gras staan. Levert twee geometrieën: het glas
 en het frame, allebei bedoeld voor een InstancedMesh.
*/
function maakKas() {
  const B = 2.0, D = 1.5, WAND = 1.35, NOK = 0.55, Y0 = 0.35;
  const glas = { pos: [], uv: [], nor: [] }, frame = { pos: [], uv: [], nor: [] };
  const quad = (g, a, b, c, d) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const L = Math.hypot(...n) || 1;
    for (const [q, uv] of [[a, [0, 0]], [b, [1, 0]], [c, [1, 1]], [a, [0, 0]], [c, [1, 1]], [d, [0, 1]]]) {
      g.pos.push(q[0], q[1], q[2]); g.uv.push(uv[0], uv[1]); g.nor.push(n[0] / L, n[1] / L, n[2] / L);
    }
  };
  const doos = (g, cx, cy, cz, hx, hy, hz) => {
    const p = (sx, sy, sz) => [cx + hx * sx, cy + hy * sy, cz + hz * sz];
    quad(g, p(-1, -1, 1), p(1, -1, 1), p(1, 1, 1), p(-1, 1, 1));
    quad(g, p(1, -1, -1), p(-1, -1, -1), p(-1, 1, -1), p(1, 1, -1));
    quad(g, p(1, -1, 1), p(1, -1, -1), p(1, 1, -1), p(1, 1, 1));
    quad(g, p(-1, -1, -1), p(-1, -1, 1), p(-1, 1, 1), p(-1, 1, -1));
    quad(g, p(-1, 1, 1), p(1, 1, 1), p(1, 1, -1), p(-1, 1, -1));
    quad(g, p(-1, -1, -1), p(1, -1, -1), p(1, -1, 1), p(-1, -1, 1));
  };
  const hb = B / 2, hd = D / 2, y1 = Y0 + WAND, top = y1 + NOK;
  // vier glazen wanden
  quad(glas, [-hb, Y0, hd], [hb, Y0, hd], [hb, y1, hd], [-hb, y1, hd]);
  quad(glas, [hb, Y0, -hd], [-hb, Y0, -hd], [-hb, y1, -hd], [hb, y1, -hd]);
  quad(glas, [hb, Y0, hd], [hb, Y0, -hd], [hb, y1, -hd], [hb, y1, hd]);
  quad(glas, [-hb, Y0, -hd], [-hb, Y0, hd], [-hb, y1, hd], [-hb, y1, -hd]);
  // het zadeldak: twee schuine glasvlakken en twee topgevels
  quad(glas, [-hb, y1, hd], [hb, y1, hd], [hb, top, 0], [-hb, top, 0]);
  quad(glas, [hb, y1, -hd], [-hb, y1, -hd], [-hb, top, 0], [hb, top, 0]);
  for (const s of [-1, 1]) {
    const a = [s * hb, y1, -hd], b = [s * hb, y1, hd], c = [s * hb, top, 0];
    const n = [s, 0, 0];
    for (const [q, uv] of [[a, [0, 0]], [b, [1, 0]], [c, [0.5, 1]]]) {
      glas.pos.push(q[0], q[1], q[2]); glas.uv.push(uv[0], uv[1]); glas.nor.push(n[0], n[1], n[2]);
    }
  }
  // het frame: staanders op de hoeken, een rand bovenaan en de nok
  const d = 0.035;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) doos(frame, sx * hb, (Y0 + y1) / 2, sz * hd, d, WAND / 2, d);
  for (const sz of [-1, 1]) doos(frame, 0, y1, sz * hd, hb, d, d);
  for (const sx of [-1, 1]) doos(frame, sx * hb, y1, 0, d, d, hd);
  doos(frame, 0, top, 0, hb, d, d);
  const maak = (g) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.nor, 3));
    return geo;
  };
  return [maak(glas), maak(frame)];
}

/**
 * Bouwt de volkstuincomplexen uit js/kaart.js.
 * @param scene Three-scene
 * @param W de lijsten uit world.js (addCollider)
 * @param complexen KAART.volkstuinen
 */
export function bouwVolkstuinen(scene, W, complexen) {
  if (!complexen || !complexen.length) return;
  const M = materialen();
  const groep = new THREE.Group();
  groep.name = 'volkstuinen';

  // schuurtjes, kassen en tonnen zijn per stuk hetzelfde model: die gaan in een
  // InstancedMesh, anders kost een complex van zestig tuintjes tweehonderd
  // draw calls
  const schuurGeo = new THREE.BoxGeometry(2.4, 2.0, 1.8);
  schuurGeo.translate(0, 1.0, 0);
  // een doos legt zijn texture één keer over elk vlak; de planken zijn 1,2 m
  // breed, dus twee herhalingen over een schuurtje van 2,4 m
  const uvSchaal = (geo, s) => { const uv = geo.getAttribute('uv'); for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * s, uv.getY(i) * s); uv.needsUpdate = true; };
  uvSchaal(schuurGeo, 2);
  const schuurDakGeo = new THREE.BoxGeometry(2.7, 0.1, 2.1);
  schuurDakGeo.translate(0, 2.06, 0);
  const kasVoetGeo = new THREE.BoxGeometry(2.2, 0.35, 1.6);
  kasVoetGeo.translate(0, 0.18, 0);
  const [kasGeo, kasFrameGeo] = maakKas();
  const tonGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.9, 10);
  tonGeo.translate(0, 0.45, 0);

  const padPos = [], padUv = [], bedGroepen = new Map();
  const hegG = { pos: [], uv: [], nor: [] }, gaasG = { pos: [], uv: [], nor: [] };
  const schuren = [], kassen = [], tonnen = [], rekken = [];

  for (const C of complexen) {
    // ---- de paden ----
    for (const p of C.paden) {
      const dx = p.b[0] - p.a[0], dz = p.b[1] - p.a[1], L = Math.hypot(dx, dz) || 1;
      const nx = -dz / L * p.breed / 2, nz = dx / L * p.breed / 2;
      const h = [[p.a[0] - nx, p.a[1] - nz], [p.b[0] - nx, p.b[1] - nz], [p.b[0] + nx, p.b[1] + nz], [p.a[0] + nx, p.a[1] + nz]];
      const y = GROND_Y + 0.005;
      // met de klok mee gezien van boven, anders wijst de normaal de grond in
      for (const [i, j, k] of [[0, 2, 1], [0, 3, 2]]) for (const q of [h[i], h[j], h[k]]) {
        padPos.push(q[0], y, q[1]); padUv.push(q[0] * 0.5, q[1] * 0.5);
      }
    }

    // ---- de tuintjes ----
    for (const [i, t] of C.tuinen.entries()) {
      const r = rng(1000 + i * 37 + Math.round(t.x * 7) + Math.round(t.z * 13));
      const ex = Math.cos(t.hoek), ez = Math.sin(t.hoek);
      const wx = (u, v) => t.x + ex * u - ez * v;
      const wz = (u, v) => t.z + ez * u + ex * v;
      const hb = t.b / 2, hd = t.d / 2;
      const draai = -t.hoek;

      // omgespitte grond met bedden erop
      const bed = bedGroepen.get(t.gewas) || bedGroepen.set(t.gewas, { pos: [], uv: [] }).get(t.gewas);
      const y = GROND_Y + 0.02;
      const hoeken = [[-hb, -hd], [hb, -hd], [hb, hd], [-hb, hd]].map(([u, v]) => [wx(u, v), wz(u, v)]);
      // de bedden lopen in de lengte van het tuintje: uv langs u en v
      const uvs = [[0, 0], [t.b / 4, 0], [t.b / 4, t.d / 4], [0, t.d / 4]];
      for (const [a, b, c] of [[0, 2, 1], [0, 3, 2]]) for (const k of [a, b, c]) {
        bed.pos.push(hoeken[k][0], y, hoeken[k][1]); bed.uv.push(uvs[k][0], uvs[k][1]);
      }

      /*
       De rand. Een volkstuin heeft geen schutting van 1,80 — je moet over het
       complex heen kunnen kijken — maar wel een lage haag of een gaashekje van
       zo'n 90 cm, met een poortje aan de kant van het pad.
      */
      const randH = 0.9;
      const gaas = r() < 0.45;
      const zijden = [
        { a: [-hb, -hd], b: [hb, -hd], kant: -1 },
        { a: [hb, hd], b: [-hb, hd], kant: 1 },
        { a: [hb, -hd], b: [hb, hd], kant: 0 },
        { a: [-hb, hd], b: [-hb, -hd], kant: 0 },
      ];
      for (const zij of zijden) {
        const du = zij.b[0] - zij.a[0], dv = zij.b[1] - zij.a[1], L = Math.hypot(du, dv);
        // aan de padkant een poortje van 1,1 m in het midden
        const stukken = (zij.kant === t.kant) ? [[0, 0.5 - 0.55 / L], [0.5 + 0.55 / L, 1]] : [[0, 1]];
        for (const [s0, s1] of stukken) {
          if (s1 - s0 < 0.05) continue;
          const mu = zij.a[0] + du * (s0 + s1) / 2, mv = zij.a[1] + dv * (s0 + s1) / 2;
          const len = L * (s1 - s0);
          const hoek = Math.atan2(dv, du);
          const mx = wx(mu, mv), mz = wz(mu, mv);
          if (gaas) vlakStuk(gaasG, mx, mz, len, randH, t.hoek + hoek);
          else hegStuk(hegG, mx, mz, len, 0.45, randH, t.hoek + hoek);
          W.addCollider(mx, mz, len / 2, gaas ? 0.06 : 0.22, -(t.hoek + hoek), randH);
        }
      }

      // schuurtje aan de padkant, in een hoek van het tuintje
      const su = (r() < 0.5 ? -1 : 1) * (hb - 1.5), sv = t.kant * (hd - 1.3);
      if (t.schuur) {
        schuren.push({ x: wx(su, sv), z: wz(su, sv), draai });
        W.addCollider(wx(su, sv), wz(su, sv), 1.25, 0.95, draai, 2.1);
        if (r() < 0.7) {
          const tu = su + (su > 0 ? -1.6 : 1.6);
          tonnen.push({ x: wx(tu, sv), z: wz(tu, sv), draai });
        }
      }
      if (t.kas) {
        const ku = -Math.sign(su || 1) * (hb - 1.4), kv = t.kant * (hd - 1.2);
        kassen.push({ x: wx(ku, kv), z: wz(ku, kv), draai });
        W.addCollider(wx(ku, kv), wz(ku, kv), 1.15, 0.85, draai, 2.1);
      }
      // een bonenstaakrek midden op het bed
      if (r() < 0.4) rekken.push({ x: wx((r() - 0.5) * t.b * 0.5, -t.kant * (r() * hd * 0.4)), z: wz((r() - 0.5) * t.b * 0.5, -t.kant * (r() * hd * 0.4)), draai, n: 4 + Math.floor(r() * 3) });
    }
  }

  // ---- alles in zo min mogelijk meshes ----
  const maak = (pos, uv, mat, klasse) => {
    if (!pos.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true; m.userData.klasse = klasse;
    groep.add(m);
  };
  maak(padPos, padUv, M.pad, 'volkstuinpad');
  for (const [soort, b] of bedGroepen) maak(b.pos, b.uv, M.bed[soort % M.bed.length], 'moestuin');
  for (const [g, mat, klasse, schaduw] of [[hegG, M.haag, 'tuinhaag', true], [gaasG, M.gaas, 'tuinhek', false]]) {
    if (!g.pos.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.nor, 3));
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = schaduw; m.receiveShadow = schaduw; m.userData.klasse = klasse;
    groep.add(m);
  }

  const zet = (lijst, geo, mat, schaduw = true) => {
    if (!lijst.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, lijst.length);
    const m = new THREE.Matrix4();
    lijst.forEach((s, i) => { m.makeRotationY(s.draai); m.setPosition(s.x, GROND_Y, s.z); im.setMatrixAt(i, m); });
    im.castShadow = schaduw; im.receiveShadow = schaduw;
    groep.add(im);
    return im;
  };
  zet(schuren, schuurGeo, M.hout);
  zet(schuren, schuurDakGeo, M.dak);
  zet(kassen, kasVoetGeo, M.houtDonker);
  zet(kassen, kasGeo, M.glas, false);
  zet(kassen, kasFrameGeo, M.frame);
  zet(tonnen, tonGeo, M.ton);

  // bonenstaakrekken: schuine stokken die bovenin samenkomen
  if (rekken.length) {
    const stokGeo = new THREE.CylinderGeometry(0.025, 0.035, 2.2, 5);
    stokGeo.translate(0, 1.1, 0);
    const totaal = rekken.reduce((n, r) => n + r.n * 2, 0);
    const im = new THREE.InstancedMesh(stokGeo, M.stok, totaal);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
    let n = 0;
    for (const r of rekken) {
      for (let i = 0; i < r.n; i++) for (const kant of [-1, 1]) {
        const u = (i - (r.n - 1) / 2) * 0.5;
        e.set(0, r.draai, kant * 0.22);
        q.setFromEuler(e);
        p.set(r.x + Math.cos(-r.draai) * u - Math.sin(-r.draai) * kant * 0.55,
          GROND_Y,
          r.z + Math.sin(-r.draai) * u + Math.cos(-r.draai) * kant * 0.55);
        m.compose(p, q, s);
        im.setMatrixAt(n++, m);
      }
    }
    im.castShadow = true;
    groep.add(im);
  }

  scene.add(groep);
}
