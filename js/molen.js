/*
 Houtzaagmolen De Rat, Sneekerpad 16 in IJlst — en elke andere molen die in
 data/stijl/straten.json als `type: "molen"` staat.

 Waarom hier en niet gewoon als pand: het 3D BAG-model van een molen is een
 puntenwolk die de roeden meevangt. Opgetrokken tot een gebouw levert dat een
 witte klomp van twintig meter op, en dat was ook precies wat er in het spel
 stond. De bruikbare maten uit de data zijn het hart van de romp, de goot (dat
 is bij een stellingmolen de stelling, 7,52 m), de nok (20,66 m) en het
 grondvlak van de zaagloodsen eromheen; de straal van het achtkant, de vlucht
 van het gevlucht en de kant waar de kap op staat komen uit de stijlcatalogus.
 tools/geo/genereer.mjs zet dat samen in KAART.molens.

 Wat er gebouwd wordt, van onder naar boven:

   - de zaagloodsen: het grondvlak van het pand als houten wanden, met een
     zadeldak in de lengterichting van de omhullende rechthoek. De molen staat
     er middenin en steekt er doorheen, net als in het echt;
   - de zwart geteerde achtkante onderbouw tot aan de stelling;
   - de stelling zelf: een omloop met een plankier, een leuning en schoren;
   - het rieten achtkant, taps naar boven;
   - de kap, met de bovenas eruit;
   - het gevlucht: twee gekruiste roeden met hekwerk, dat langzaam ronddraait;
   - de staart met het kruirad, waarmee de kap op de wind gezet wordt.

 Draairichting: een hoek `a` in het (x,z)-vlak legt de lokale x-as op
 (cos a, sin a) en de lokale z-as op (-sin a, cos a) — dezelfde afspraak als bij
 `rect.hoek` uit de generator. Een Object3D draait om Y met -a; vandaar de
 minnen bij `rotation.y`.

 Over de kant waar een vlak op kijkt: elke vierhoek en driehoek krijgt hier een
 richting mee waar "buiten" ligt, en draait zichzelf om als de normaal de
 verkeerde kant op wijst. Dat is niet uit netheid maar uit ervaring: een vlak
 met zijn normaal de grond in is onzichtbaar, en bij een achtkant is de goede
 volgorde niet uit de code af te lezen.
*/
import * as THREE from 'three';
import * as T from './textures.js';

const ZIJDEN = 8;                 // een achtkant
const HELLING = 0.21;             // de bovenas loopt naar de kop toe omhoog (12°)
const LEUNING = 1.05;             // hoogte van de leuning om de stelling
const STELLING_BREED = 1.8;       // hoe ver de omloop uitsteekt

// alle gevluchten samen, zodat draaiMolens() ze per beeld kan bijwerken
const gevluchten = [];

function bak() { return { pos: [], uv: [], nor: [] }; }

const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _nm = new THREE.Matrix3();
function voegToe(b, geo, m) {
  const pos = geo.getAttribute('position'), nor = geo.getAttribute('normal'), uv = geo.getAttribute('uv');
  const idx = geo.getIndex();
  _nm.getNormalMatrix(m);
  const zet = (i) => {
    _v.fromBufferAttribute(pos, i).applyMatrix4(m);
    b.pos.push(_v.x, _v.y, _v.z);
    if (nor) { _n.fromBufferAttribute(nor, i).applyMatrix3(_nm).normalize(); b.nor.push(_n.x, _n.y, _n.z); }
    else b.nor.push(0, 1, 0);
    if (uv) b.uv.push(uv.getX(i), uv.getY(i)); else b.uv.push(0, 0);
  };
  if (idx) for (let i = 0; i < idx.count; i++) zet(idx.getX(i));
  else for (let i = 0; i < pos.count; i++) zet(i);
}

// Een plaatsingsmatrix. Hij maakt elke keer een nieuwe: er wordt tijdens het
// bouwen mee vermenigvuldigd, en met één gedeelde matrix overschrijft de tweede
// aanroep de eerste voordat die gebruikt is.
function plaats(x, y, z, draaiY = 0, draaiX = 0, draaiZ = 0) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(draaiX, draaiY, draaiZ, 'YXZ'));
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
}

// Een driehoek, met `uit` als de richting waar buiten ligt.
function driehoek(b, P, Q, R, uvs, uit) {
  const e1 = [Q[0] - P[0], Q[1] - P[1], Q[2] - P[2]], e2 = [R[0] - P[0], R[1] - P[1], R[2] - P[2]];
  let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  let punten = [P, Q, R], uv = uvs;
  if (uit && n[0] * uit[0] + n[1] * uit[1] + n[2] * uit[2] < 0) {
    punten = [P, R, Q]; uv = [uvs[0], uvs[2], uvs[1]];
    n = [-n[0], -n[1], -n[2]];
  }
  const L = Math.hypot(n[0], n[1], n[2]) || 1;
  for (let i = 0; i < 3; i++) {
    b.pos.push(punten[i][0], punten[i][1], punten[i][2]);
    b.nor.push(n[0] / L, n[1] / L, n[2] / L);
    b.uv.push(uv[i][0], uv[i][1]);
  }
}

function vierhoek(b, P, Q, R, S, uvs, uit) {
  driehoek(b, P, Q, R, [uvs[0], uvs[1], uvs[2]], uit);
  driehoek(b, P, R, S, [uvs[0], uvs[2], uvs[3]], uit);
}

// De hoekpunten van een regelmatige achthoek met straal r op hoogte y.
function achthoek(cx, cz, r, y, draai = 0) {
  const p = [];
  for (let i = 0; i < ZIJDEN; i++) {
    const a = draai + (i + 0.5) * Math.PI * 2 / ZIJDEN;
    p.push([cx + Math.cos(a) * r, y, cz + Math.sin(a) * r]);
  }
  return p;
}

/*
 Een band tussen twee ringen met evenveel punten: de acht vlakken van de
 onderbouw, van het achtkant of van de kap. De uv loopt per meter, zodat het
 riet op elk vlak even grof blijft.
*/
function band(b, cx, cz, onder, boven, uHerhaling = 1.6, vHerhaling = 1.6) {
  for (let i = 0; i < onder.length; i++) {
    const j = (i + 1) % onder.length;
    const A = onder[i], B = onder[j], C = boven[j], D = boven[i];
    const breed = Math.hypot(B[0] - A[0], B[2] - A[2]);
    const hoog = Math.hypot(D[0] - A[0], D[1] - A[1], D[2] - A[2]);
    const u = breed / uHerhaling, v = hoog / vHerhaling;
    const mx = (A[0] + B[0] + C[0] + D[0]) / 4, mz = (A[2] + B[2] + C[2] + D[2]) / 4;
    vierhoek(b, A, B, C, D, [[0, 0], [u, 0], [u, v], [0, v]], [mx - cx, 0, mz - cz]);
  }
}

function materialen() {
  const hout = (kleur) => new THREE.MeshStandardMaterial({ map: T.planks(kleur), roughness: 0.92 });
  return {
    riet: new THREE.MeshStandardMaterial({ map: T.rietdak('#584330'), roughness: 0.97 }),
    kap: hout('#3b3129'),           // de kap: donker gepotdekseld hout, geen riet
    teer: hout('#2e2721'),          // de zwart geteerde onderbouw
    loods: hout('#6a5540'),         // de zaagloodsen: verweerd hout
    loodsdak: hout('#3c332a'),
    dek: hout('#6c5f4e'),           // het plankier van de stelling
    balk: new THREE.MeshStandardMaterial({ color: 0x3a2f24, roughness: 0.85 }),
    wit: new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.8 }),
    hek: new THREE.MeshStandardMaterial({
      map: T.wiekhek(), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide,
      roughness: 0.9, depthWrite: false,
    }),
  };
}

function maakMesh(g, mat, naam) {
  if (!g.pos.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
  geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true; m.receiveShadow = true;
  m.name = naam;
  return m;
}

/*
 De zaagloodsen. De wanden volgen het grondvlak uit de BGT, het dak is een
 zadeldak over de omhullende rechthoek: elke wand loopt door tot de daklijn op
 die plek, zodat de kopse kanten vanzelf een topgevel krijgen. Dat het dak een
 metertje buiten het grondvlak uitsteekt is geen fout maar een dakoverstek.
*/
function loodsen(M, gWand, gDak) {
  const L = M.loods;
  if (!L || !L.ring || L.ring.length < 3) return;
  const c = Math.cos(L.hoek), s = Math.sin(L.hoek);
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity, mx = 0, mz = 0;
  for (const [x, z] of L.ring) {
    const u = x * c + z * s, v = -x * s + z * c;
    u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
    mx += x / L.ring.length; mz += z / L.ring.length;
  }
  const hv = (v1 - v0) / 2, vm = (v0 + v1) / 2;
  const dakY = (x, z) => {
    const v = -x * s + z * c;
    return L.goot + (L.nok - L.goot) * Math.max(0, 1 - Math.abs(v - vm) / hv);
  };
  for (let i = 0; i < L.ring.length; i++) {
    const a = L.ring[i], b = L.ring[(i + 1) % L.ring.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.2) continue;
    const ha = dakY(a[0], a[1]), hb = dakY(b[0], b[1]);
    const wx = (a[0] + b[0]) / 2 - mx, wz = (a[1] + b[1]) / 2 - mz;
    vierhoek(gWand,
      [a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], hb, b[1]], [a[0], ha, a[1]],
      [[0, 0], [len / 1.2, 0], [len / 1.2, hb / 1.2], [0, ha / 1.2]], [wx, 0, wz]);
  }
  // het zadeldak: twee schuine vlakken over de hele rechthoek
  const P = (u, v, y) => [u * c - v * s, y, u * s + v * c];
  const len = u1 - u0, schuin = Math.hypot(hv, L.nok - L.goot);
  for (const kant of [-1, 1]) {
    const vRand = vm + kant * hv;
    const A = P(u0, vRand, L.goot), B = P(u1, vRand, L.goot);
    const C = P(u1, vm, L.nok), D = P(u0, vm, L.nok);
    // buiten is schuin omhoog, weg van de nok
    const uit = [-s * kant * 0.6, 1, c * kant * 0.6];
    vierhoek(gDak, A, B, C, D, [[0, 0], [len / 1.2, 0], [len / 1.2, schuin / 1.2], [0, schuin / 1.2]], uit);
  }
}

/*
 Het gevlucht: twee gekruiste roeden van 9,7 m met aan één kant van elke roede
 het hekwerk. Het staat in een eigen groep, want die draait; de rest van de
 molen is samengevoegd tot een handvol meshes.

 De groep hangt aan de kop van de bovenas. Zijn lokale z-as ligt langs de as, de
 roeden liggen in het lokale xy-vlak, en draaien doet hij om precies diezelfde
 z-as (`rotation.z`, met de volgorde YXZ dus binnenin de kruirichting en de
 helling van de as).
*/
function maakGevlucht(M, mats) {
  const R = M.vlucht / 2;
  const groep = new THREE.Group();
  const gBalk = bak(), gHek = bak();
  const roedeGeo = new THREE.BoxGeometry(2 * R, 0.19, 0.15);
  voegToe(gBalk, roedeGeo, plaats(0, 0, 0));
  voegToe(gBalk, roedeGeo, plaats(0, 0, 0, 0, 0, Math.PI / 2));
  roedeGeo.dispose();
  // het hekwerk: per roede-einde een vlak naast de roede, met de zoomlat erlangs
  const binnen = R * 0.16, buiten = R * 0.97, breed = 1.15;
  const hekGeo = new THREE.PlaneGeometry(buiten - binnen, breed);
  const uv = hekGeo.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (buiten - binnen), uv.getY(i) * breed);
  uv.needsUpdate = true;
  const zoomGeo = new THREE.BoxGeometry(buiten - binnen, 0.09, 0.07);
  const mid = (binnen + buiten) / 2;
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2;
    voegToe(gHek, hekGeo, plaats(0, 0, 0, 0, 0, a).multiply(plaats(mid, breed / 2 + 0.12, 0)));
    voegToe(gBalk, zoomGeo, plaats(0, 0, 0, 0, 0, a).multiply(plaats(mid, breed + 0.12, 0)));
  }
  hekGeo.dispose(); zoomGeo.dispose();
  const mBalk = maakMesh(gBalk, mats.balk, 'roeden');
  const mHek = maakMesh(gHek, mats.hek, 'hekwerk');
  if (mBalk) groep.add(mBalk);
  if (mHek) { mHek.castShadow = false; groep.add(mHek); }
  return groep;
}

/**
 * Bouwt alle molens uit KAART.molens.
 * @param scene Three-scene
 * @param W de lijsten uit world.js; de botsingsdozen van het pand zelf staan er
 *          al (js/kaartwereld.js), dus hier komt er niets bij
 * @param molens KAART.molens
 */
export function bouwMolens(scene, W, molens) {
  if (!molens || !molens.length) return;
  const mats = materialen();
  const gRiet = bak(), gKap = bak(), gTeer = bak(), gLoods = bak(), gLoodsDak = bak(), gDek = bak(), gBalk = bak(), gWit = bak();

  for (const M of molens) {
    const kruiRad = (M.kruihoek || 0) * Math.PI / 180;
    const kapVoet = M.top - M.kap;
    const kv = [Math.cos(kruiRad), Math.sin(kruiRad)];        // de kant waar de kap op staat
    loodsen(M, gLoods, gLoodsDak);

    // ---- onderbouw: zwart geteerd achtkant tot aan de stelling ----
    const voetRing = achthoek(M.cx, M.cz, M.romp + 0.45, 0, kruiRad);
    const stelRing = achthoek(M.cx, M.cz, M.romp + 0.12, M.stelling, kruiRad);
    band(gTeer, M.cx, M.cz, voetRing, stelRing, 2.2, 2.2);

    // ---- de stelling: plankier, leuning en schoren ----
    const buitenRing = achthoek(M.cx, M.cz, M.romp + 0.12 + STELLING_BREED, M.stelling, kruiRad);
    for (let i = 0; i < ZIJDEN; i++) {
      const j = (i + 1) % ZIJDEN;
      const A = stelRing[i], B = stelRing[j], C = buitenRing[j], D = buitenRing[i];
      const b = Math.hypot(B[0] - A[0], B[2] - A[2]);
      const uvDek = [[0, 0], [b / 1.2, 0], [b / 1.2, STELLING_BREED / 1.2], [0, STELLING_BREED / 1.2]];
      vierhoek(gDek, A, B, C, D, uvDek, [0, 1, 0]);                   // plankier
      const zak = (p) => [p[0], p[1] - 0.14, p[2]];
      vierhoek(gDek, zak(A), zak(B), zak(C), zak(D), uvDek, [0, -1, 0]); // onderkant
      const mx = (C[0] + D[0]) / 2 - M.cx, mz = (C[2] + D[2]) / 2 - M.cz;
      vierhoek(gDek, zak(D), zak(C), C, D, [[0, 0], [b / 1.2, 0], [b / 1.2, 0.12], [0, 0.12]], [mx, 0, mz]);
      // leuning: een stijl op elke hoek met twee regels ertussen
      const paal = new THREE.BoxGeometry(0.09, LEUNING, 0.09);
      voegToe(gBalk, paal, plaats(D[0], M.stelling + LEUNING / 2, D[2]));
      paal.dispose();
      const langs = Math.atan2(C[2] - D[2], C[0] - D[0]);
      for (const h of [LEUNING - 0.06, LEUNING * 0.55]) {
        const regel = new THREE.BoxGeometry(b, 0.07, 0.05);
        voegToe(gBalk, regel, plaats((C[0] + D[0]) / 2, M.stelling + h, (C[2] + D[2]) / 2, -langs));
        regel.dispose();
      }
      // schoor: van de onderbouw schuin omhoog naar de rand van de omloop
      const rl = Math.hypot(D[0] - M.cx, D[2] - M.cz) || 1;
      const bx = M.cx + (D[0] - M.cx) / rl * (M.romp - 0.1), bz = M.cz + (D[2] - M.cz) / rl * (M.romp - 0.1);
      const dy = 2.3, dl = Math.hypot(D[0] - bx, D[2] - bz);
      const schoor = new THREE.BoxGeometry(Math.hypot(dl, dy), 0.12, 0.12);
      voegToe(gBalk, schoor, plaats((bx + D[0]) / 2, M.stelling - dy / 2, (bz + D[2]) / 2,
        -Math.atan2(D[2] - bz, D[0] - bx), 0, Math.atan2(dy, dl)));
      schoor.dispose();
    }

    // ---- het rieten achtkant ----
    const rompOnder = achthoek(M.cx, M.cz, M.romp, M.stelling - 0.05, kruiRad);
    const rompBoven = achthoek(M.cx, M.cz, M.rompTop, kapVoet, kruiRad);
    band(gRiet, M.cx, M.cz, rompOnder, rompBoven, 1.8, 1.8);

    /*
     De kap. Die is niet met riet gedekt maar met hout beschoten, en hij steekt
     een halve meter over de romp heen — zonder dat overstek loopt de kap
     naadloos door in het achtkant en zie je niet meer dat het een losse kap is
     die kan draaien.
    */
    const kapRand = achthoek(M.cx, M.cz, M.rompTop + 0.55, kapVoet, kruiRad);
    const kapRandOnder = achthoek(M.cx, M.cz, M.rompTop + 0.55, kapVoet - 0.28, kruiRad);
    const kapB = achthoek(M.cx, M.cz, M.rompTop * 0.9, kapVoet + M.kap * 0.5, kruiRad);
    const kapC = achthoek(M.cx, M.cz, M.rompTop * 0.45, kapVoet + M.kap * 0.85, kruiRad);
    band(gKap, M.cx, M.cz, kapRandOnder, kapRand, 1.6, 1.6);   // de rand van het overstek
    band(gKap, M.cx, M.cz, kapRand, kapB, 1.6, 1.6);
    band(gKap, M.cx, M.cz, kapB, kapC, 1.6, 1.6);
    const nok = [M.cx, M.top, M.cz];
    for (let i = 0; i < ZIJDEN; i++) {
      const j = (i + 1) % ZIJDEN;
      const ux = (kapC[i][0] + kapC[j][0]) / 2 - M.cx, uz = (kapC[i][2] + kapC[j][2]) / 2 - M.cz;
      driehoek(gKap, kapC[i], kapC[j], nok, [[0, 0], [1.2, 0], [0.6, 1.2]], [ux, 1.2, uz]);
      // de onderkant van het overstek, zichtbaar als je eronder staat
      driehoek(gKap, kapRandOnder[i], kapRandOnder[j], [M.cx, kapVoet - 0.28, M.cz], [[0, 0], [1.2, 0], [0.6, 1.2]], [0, -1, 0]);
    }

    // ---- de bovenas, met de kop naar voren omhoog ----
    const asY = kapVoet + M.kap * 0.42;
    const asLang = M.rompTop + 1.5;
    const asGeo = new THREE.CylinderGeometry(0.24, 0.3, asLang, 8);
    const f = asLang * 0.32;
    voegToe(gBalk, asGeo, plaats(M.cx + kv[0] * f, asY + Math.sin(HELLING) * f, M.cz + kv[1] * f,
      -Math.atan2(kv[1], kv[0]), 0, Math.PI / 2 - HELLING));
    asGeo.dispose();

    // ---- het gevlucht aan de kop van de as ----
    const kop = asLang * 0.62;
    const g = maakGevlucht(M, mats);
    g.position.set(M.cx + kv[0] * kop, asY + Math.sin(HELLING) * kop, M.cz + kv[1] * kop);
    // de lokale z-as langs de as leggen: yaw = 90° − kruihoek
    g.rotation.set(HELLING, Math.PI / 2 - kruiRad, 0, 'YXZ');
    g.name = `gevlucht ${M.naam}`;
    scene.add(g);
    gevluchten.push({ groep: g, rad: (M.toeren || 4.5) * Math.PI * 2 / 60, naam: M.naam });

    // ---- de staart met het kruirad, aan de achterkant ----
    const ax = -kv[0], az = -kv[1];
    const voet = [M.cx + ax * (M.romp + 1.4), M.stelling + 0.5, M.cz + az * (M.romp + 1.4)];
    const top = [M.cx + ax * (M.rompTop + 0.4), kapVoet + M.kap * 0.35, M.cz + az * (M.rompTop + 0.4)];
    for (const zij of [-0.9, 0.9]) {
      const zx = -az * zij, zz = ax * zij;
      const A = [voet[0] + zx, voet[1], voet[2] + zz];
      const B = [top[0] + zx * 0.35, top[1], top[2] + zz * 0.35];
      const len = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
      const boom = new THREE.BoxGeometry(len, 0.16, 0.16);
      voegToe(gBalk, boom, plaats((A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2,
        -Math.atan2(B[2] - A[2], B[0] - A[0]), 0, Math.atan2(B[1] - A[1], Math.hypot(B[0] - A[0], B[2] - A[2]))));
      boom.dispose();
    }
    // het kruirad: het wiel waarmee de kap rondgedraaid wordt
    const wielGeo = new THREE.TorusGeometry(0.85, 0.07, 6, 14);
    voegToe(gWit, wielGeo, plaats(voet[0], voet[1] + 0.6, voet[2], -Math.atan2(az, ax)));
    wielGeo.dispose();
    const spaak = new THREE.BoxGeometry(1.7, 0.06, 0.06);
    for (let k = 0; k < 3; k++) {
      voegToe(gWit, spaak, plaats(voet[0], voet[1] + 0.6, voet[2], -Math.atan2(az, ax), 0, k * Math.PI / 3));
    }
    spaak.dispose();
    // de baard: het bord onder de voorkant van de kap
    const baard = new THREE.BoxGeometry(1.9, 0.55, 0.07);
    voegToe(gWit, baard, plaats(M.cx + kv[0] * (M.rompTop + 0.2), kapVoet - 0.62, M.cz + kv[1] * (M.rompTop + 0.2),
      -Math.atan2(kv[1], kv[0]) + Math.PI / 2));
    baard.dispose();
  }

  for (const [g, mat, naam] of [
    [gLoods, mats.loods, 'zaagloods'], [gLoodsDak, mats.loodsdak, 'zaagloods-dak'],
    [gTeer, mats.teer, 'molen-onderbouw'], [gDek, mats.dek, 'molen-stelling'],
    [gRiet, mats.riet, 'molen-riet'], [gKap, mats.kap, 'molen-kap'],
    [gBalk, mats.balk, 'molen-hout'], [gWit, mats.wit, 'molen-wit'],
  ]) {
    const m = maakMesh(g, mat, naam);
    if (m) scene.add(m);
  }
  const M = molens[0];
  console.log(`molens: ${molens.length} — ${M.naam}, stelling ${M.stelling} m, nok ${M.top} m, vlucht ${M.vlucht} m`);
}

/**
 * Laat het gevlucht rondgaan. js/world.js roept dit elk beeld aan vanuit
 * updateProps(). Vier en een halve omwenteling per minuut is een molen die
 * rustig staat te draaien: één rondje duurt ruim dertien seconden.
 */
export function draaiMolens(dt) {
  for (const g of gevluchten) g.groep.rotation.z += g.rad * dt;
}

// voor de proeven en de foto's
export function molenIntern() { return gevluchten; }
