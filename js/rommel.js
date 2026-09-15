/*
 De wijk minder netjes maken.

 Alles stond er tot nu toe uit de verpakking bij: gevels zonder een vlek, tegels
 zonder een sprietje ertussen, goten zonder een papiertje, blinde muren zonder
 één tag. Dat valt niet op als een fout maar wel als een gevoel — het is een
 maquette en geen wijk waar dertig jaar in gewoond is.

 Dit bestand zet drie dingen langs de straat:

   onkruid    pollen gras tussen de stoeptegels en langs de trottoirband, waar
              de veegwagen niet komt: twee kruislingse vlakken met een
              doorzichtige textuur, precies zoals de hekjes;
   zwerfvuil  een papiertje, een blikje, een plastic zak of een patatbakje,
              plat op de grond in de goot;
   kliko's    grijze, groene en blauwe rolcontainers op de stoep.

 Waar het staat komt uit de kaart zelf: langs de assen van de rijbanen en de
 voetpaden (js/kaart.js), op een vaste afstand uit het hart, met een dobbelsteen
 die aan de plek hangt. Dezelfde kaart geeft dus altijd dezelfde rommel — het
 verspringt niet als je een keer opnieuw laadt, en dat scheelt ook een lijst in
 het geheugen.

 Alles gaat per tegel in instanced meshes met een afstandsgrens, net als de
 struiken: een pol onkruid is op honderd meter een groen puntje van twee
 beeldpunten.
*/
import * as THREE from 'three';
import * as T from './textures.js';

const TEGEL = 240;                      // zelfde tegelmaat als de rest van de wereld

// hoeveel er staat: één pol onkruid per zoveel meter straatrand, enzovoort
const ONKRUID_OM = 7.0;
const VUIL_OM = 26.0;
const KLIKO_OM = 70.0;

// een dobbelsteen die aan de plek hangt: dezelfde kaart geeft dezelfde rommel
function dobbel(x, z, k = 0) {
  let s = Math.imul(Math.round(x * 16) | 0, 374761393) ^ Math.imul(Math.round(z * 16) | 0, 668265263) ^ Math.imul(k + 1, 2246822519);
  s = Math.imul(s ^ (s >>> 13), 1274126177);
  return ((s ^ (s >>> 16)) >>> 0) / 4294967296;
}

/*
 Eén pol onkruid: twee vlakken kruislings, zodat hij van alle kanten iets
 voorstelt. De geometrie is één keer gemaakt en wordt door alle pollen gedeeld.
*/
function polGeo() {
  const pos = [], uv = [], nor = [];
  const vlak = (dx, dz) => {
    const hx = dx / 2, hz = dz / 2;
    const hoek = [[-hx, 0, -hz], [hx, 0, hz], [hx, 1, hz], [-hx, 1, -hz]];
    const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
    for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) {
      for (const i of [a, b, c]) {
        pos.push(...hoek[i]); uv.push(...uvs[i]); nor.push(0, 1, 0);
      }
    }
  };
  vlak(1, 0); vlak(0, 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

/*
 Een plat vlakje voor het zwerfvuil, met de uv's op één van de vier vakken van
 het doek. Vier geometrieën dus, en per stuk kiest de dobbelsteen er een.
*/
function vuilGeo(vak) {
  const u0 = (vak % 2) * 0.5, v0 = (1 - Math.floor(vak / 2)) * 0.5;
  const pos = [], uv = [], nor = [];
  const h = [[-0.5, 0, -0.5], [0.5, 0, -0.5], [0.5, 0, 0.5], [-0.5, 0, 0.5]];
  const t = [[u0, v0 + 0.5], [u0 + 0.5, v0 + 0.5], [u0 + 0.5, v0], [u0, v0]];
  for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) {
    for (const i of [a, b, c]) { pos.push(...h[i]); uv.push(...t[i]); nor.push(0, 1, 0); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

/*
 Een rolcontainer: een bak die naar boven toe iets wijder wordt, een deksel met
 een handgreep en twee wieltjes. Alles in één geometrie, met de kleur per
 instantie — grijs, groen of blauw, zoals ze in Sneek op de stoep staan.
*/
function klikoGeo() {
  const delen = [];
  const doos = (b, h, d, x, y, z) => {
    const g = new THREE.BoxGeometry(b, h, d); g.translate(x, y, z); delen.push(g);
  };
  doos(0.58, 0.92, 0.52, 0, 0.55, 0);           // bak
  doos(0.62, 0.07, 0.56, 0, 1.03, 0);           // deksel
  doos(0.30, 0.05, 0.06, 0, 1.08, -0.24);       // handgreep op het deksel
  doos(0.06, 0.34, 0.06, -0.26, 0.32, 0.27);    // de twee stangen achter
  doos(0.06, 0.34, 0.06, 0.26, 0.32, 0.27);
  for (const sx of [-1, 1]) {
    const w = new THREE.CylinderGeometry(0.09, 0.09, 0.05, 8);
    w.rotateZ(Math.PI / 2); w.translate(sx * 0.26, 0.09, 0.22);
    delen.push(w);
  }
  const pos = [], nor = [], uv = [];
  for (const g of delen) {
    const ng = g.index ? g.toNonIndexed() : g;
    pos.push(...ng.attributes.position.array);
    nor.push(...ng.attributes.normal.array);
    for (let i = 0; i < ng.attributes.position.count; i++) uv.push(0, 0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return geo;
}

const KLIKO_KLEUR = [0x4a4f55, 0x3d5a34, 0x2f4a70, 0x4a4f55, 0x6b6f74];

/*
 Waar géén onkruid hoort te staan. De as van een straat weet alleen hoe breed
 het weglichaam ongeveer is; het echte asfalt ligt in de kaart als een vlak en
 is op een bocht, een inham of een verbreding bij een kruising meters breder dan
 dat. Zette je de pollen puur op afstand uit het hart, dan stonden ze op de
 rijbaan te groeien — precies wat er niet hoort. Deze lijst zijn de vlakken waar
 gereden en geparkeerd wordt: daar komt de veegwagen en daar staat niets.

 Verharding waar je alleen loopt (voetpad, erf, inrit, verharding) staat er niet
 tussen: dáár groeit het juist tussen de tegels door, en dat is de bedoeling.
*/
const GEEN_ONKRUID = new Set([
  'rijbaan', 'autoweg', 'parkeervlak', 'asfaltvlak', 'fietspad', 'brug', 'duiker', 'overbrugging', 'water', 'steiger',
]);
const STAP_UIT = 0.4;      // zoveel schuift een pol per poging naar de berm
const STAPPEN = 6;         // en zoveel keer proberen we het

/**
 * De rommel neerzetten. `W` is js/world.js (voor `lodAan`), `wegassen` de assen
 * uit de kaart, `maaiveld(x, z)` de grondhoogte en `klasseOp(x, z)` de klasse
 * van het kaartvlak onder een punt (`rijbaan`, `gras`, … of null).
 * `opHetWater(x, z)` zegt of een punt op een waterdeel ligt; dat is iets anders
 * dan `klasseOp(x, z) === 'water'`, want over een sloot ligt vaak nog een strook
 * oever of berm en dan leest het bovenste vlak als gras.
 *
 * Levert { onkruid, vuil, kliko } met de aantallen.
 */
export function bouwRommel(scene, W, wegassen, maaiveld = () => 0, klasseOp = null, opHetWater = null) {
  if (!wegassen || !wegassen.length) return { onkruid: 0, vuil: 0, kliko: 0 };

  const matOnkruid = new THREE.MeshStandardMaterial({
    map: T.onkruid(), transparent: true, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1,
  });
  const matVuil = new THREE.MeshStandardMaterial({
    map: T.zwerfvuil(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1,
  });
  const matKliko = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 });

  // per tegel verzamelen, zodat wat ver weg ligt buiten beeld kan vallen
  // ligt hier asfalt? Zonder kaartvlakken (de oude wereld) weten we het niet en
  // laten we de afstand uit het hart het werk doen, zoals het was.
  const opDeWeg = klasseOp ? (x, z) => GEEN_ONKRUID.has(klasseOp(x, z) || '') : () => false;
  /*
   Niets in het water. Een pol onkruid werd al van de rijbaan geweerd, maar een
   patatbakje in de goot en een rolcontainer op de stoep niet — en waar een
   straat vlak langs een sloot loopt kwamen die op het water uit. Op een
   waterspiegel van −0,35 en met de rommel op maaiveldhoogte zweefden ze daar een
   halve meter boven. Vanaf de kant zie je dat nauwelijks, vanaf een boot meteen.
  */
  const inHetWater = opHetWater || (klasseOp ? (x, z) => klasseOp(x, z) === 'water' : () => false);
  let geweerd = 0;

  const perTegel = new Map();
  const tegelVan = (x, z) => `${Math.floor(x / TEGEL)}:${Math.floor(z / TEGEL)}`;
  const bak = (x, z) => {
    const k = tegelVan(x, z);
    if (!perTegel.has(k)) perTegel.set(k, { onkruid: [], vuil: [[], [], [], []], kliko: [] });
    return perTegel.get(k);
  };

  for (const w of wegassen) {
    // de rijbanen en de stoepen; de N7 en de opritten slaan we over, daar loopt
    // niemand en daar staat geen container
    const snelweg = w.naam === 'N7' || (w.naam || '').startsWith('Afrit');
    for (let i = 1; i < w.pts.length; i++) {
      const a = w.pts[i - 1], b = w.pts[i];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const L = Math.hypot(dx, dz);
      if (L < 0.5) continue;
      const ux = dx / L, uz = dz / L;          // langs
      const nx = -uz, nz = ux;                 // dwars
      const rand = Math.max(0.9, ((a[2] + b[2]) / 2 || w.w || 3) / 2);

      // ---- onkruid langs allebei de randen
      for (let t = 0; t < L; t += ONKRUID_OM) {
        for (const kant of [-1, 1]) {
          const f = (t + dobbel(a[0] + t, a[1], kant) * ONKRUID_OM) / L;
          if (f >= 1) continue;
          const px = a[0] + dx * f, pz = a[1] + dz * f;
          const d = dobbel(px, pz, 3 + kant);
          if (d > 0.55) continue;              // niet overal, dat wordt een berm
          let uit = rand + 0.05 + d * 0.35;
          let x = px + nx * kant * uit, z = pz + nz * kant * uit;
          // staat hij op het asfalt, dan schuift hij naar buiten tot hij van de
          // rijbaan af is; lukt dat binnen een paar meter niet, dan vervalt hij
          let poging = 0;
          while (opDeWeg(x, z) && poging < STAPPEN) {
            uit += STAP_UIT; poging++;
            x = px + nx * kant * uit; z = pz + nz * kant * uit;
          }
          if (poging && opDeWeg(x, z)) { geweerd++; continue; }
          bak(x, z).onkruid.push({ x, z, s: 0.18 + d * 0.38, yaw: d * 6.283 });
        }
      }

      // ---- zwerfvuil in de goot
      if (!snelweg) for (let t = 0; t < L; t += VUIL_OM) {
        const kant = dobbel(a[0] + t, a[1], 7) < 0.5 ? -1 : 1;
        const f = (t + dobbel(a[0] + t, a[1], 8) * VUIL_OM) / L;
        if (f >= 1) continue;
        const px = a[0] + dx * f, pz = a[1] + dz * f;
        const d = dobbel(px, pz, 9);
        if (d > 0.5) continue;
        const uit = rand - 0.25 + d * 0.5;
        const x = px + nx * kant * uit, z = pz + nz * kant * uit;
        if (inHetWater(x, z)) { geweerd++; continue; }
        bak(x, z).vuil[Math.floor(d * 8) % 4].push({ x, z, s: 0.34 + d * 0.30, yaw: d * 12.566 });
      }

      // ---- rolcontainers op de stoep, alleen langs straten waar je rijdt
      if (w.drive && !snelweg) for (let t = 0; t < L; t += KLIKO_OM) {
        const d = dobbel(a[0] + t, a[1], 11);
        if (d > 0.28) continue;
        const kant = d < 0.14 ? -1 : 1;
        const f = (t + d * KLIKO_OM) / L;
        if (f >= 1) continue;
        const px = a[0] + dx * f, pz = a[1] + dz * f;
        const uit = rand + 0.75 + dobbel(px, pz, 12) * 0.5;
        const x = px + nx * kant * uit, z = pz + nz * kant * uit;
        const hoek = Math.atan2(-nx * kant, -nz * kant) + (dobbel(px, pz, 13) - 0.5) * 0.7;
        if (inHetWater(x, z)) { geweerd++; continue; }
        bak(x, z).kliko.push({ x, z, yaw: hoek, kleur: KLIKO_KLEUR[Math.floor(dobbel(px, pz, 14) * KLIKO_KLEUR.length)] });
        // de tweede naast de eerste, want die staan zelden alleen
        if (dobbel(px, pz, 15) < 0.45) {
          const x2 = x + ux * 0.72, z2 = z + uz * 0.72;
          if (inHetWater(x2, z2)) { geweerd++; continue; }
          bak(x2, z2).kliko.push({ x: x2, z: z2, yaw: hoek + 0.12, kleur: KLIKO_KLEUR[Math.floor(dobbel(x2, z2, 16) * KLIKO_KLEUR.length)] });
        }
      }
    }
  }

  const pol = polGeo();
  const vuilGeos = [0, 1, 2, 3].map(vuilGeo);
  const kliko = klikoGeo();
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const kleur = new THREE.Color();
  let nOnkruid = 0, nVuil = 0, nKliko = 0;

  for (const [t, lijst] of perTegel) {
    const [ti, tj] = String(t).split(':').map(Number);
    const mx = (ti + 0.5) * TEGEL, mz = (tj + 0.5) * TEGEL;
    const straal = TEGEL * 0.71;

    if (lijst.onkruid.length) {
      const im = new THREE.InstancedMesh(pol, matOnkruid, lijst.onkruid.length);
      lijst.onkruid.forEach((o, i) => {
        e.set(0, o.yaw, 0); q.setFromEuler(e);
        sc.set(o.s * 2.2, o.s * 2.6, o.s * 2.2);
        v.set(o.x, maaiveld(o.x, o.z) - 0.02, o.z);
        m.compose(v, q, sc); im.setMatrixAt(i, m);
      });
      im.castShadow = false; im.receiveShadow = false;
      im.computeBoundingSphere(); im.userData.klasse = 'onkruid';
      scene.add(im);
      W.lodAan(im, mx, mz, { tot: 110, straal });
      nOnkruid += lijst.onkruid.length;
    }

    lijst.vuil.forEach((groep, vak) => {
      if (!groep.length) return;
      const im = new THREE.InstancedMesh(vuilGeos[vak], matVuil, groep.length);
      groep.forEach((o, i) => {
        e.set(0, o.yaw, 0); q.setFromEuler(e);
        sc.set(o.s, 1, o.s);
        v.set(o.x, maaiveld(o.x, o.z) + 0.012, o.z);
        m.compose(v, q, sc); im.setMatrixAt(i, m);
      });
      im.castShadow = false; im.receiveShadow = true;
      im.computeBoundingSphere(); im.userData.klasse = 'zwerfvuil';
      scene.add(im);
      W.lodAan(im, mx, mz, { tot: 90, straal });
      nVuil += groep.length;
    });

    if (lijst.kliko.length) {
      const im = new THREE.InstancedMesh(kliko, matKliko, lijst.kliko.length);
      lijst.kliko.forEach((o, i) => {
        e.set(0, o.yaw, 0); q.setFromEuler(e);
        sc.set(1, 1, 1);
        v.set(o.x, maaiveld(o.x, o.z), o.z);
        m.compose(v, q, sc); im.setMatrixAt(i, m);
        im.setColorAt(i, kleur.setHex(o.kleur));
      });
      im.castShadow = true; im.receiveShadow = true;
      im.computeBoundingSphere(); im.userData.klasse = 'kliko';
      scene.add(im);
      W.lodAan(im, mx, mz, { tot: 260, straal });
      nKliko += lijst.kliko.length;
      // je loopt er niet doorheen; een auto rijdt hem wel omver (onder 3,5 m)
      for (const o of lijst.kliko) W.addCollider(o.x, o.z, 0.32, 0.30, -o.yaw, 1.1);
    }
  }
  return { onkruid: nOnkruid, vuil: nVuil, kliko: nKliko, geweerd };
}
