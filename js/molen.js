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
 De vier hoekpunten van een rechthoek met halve maten (hx, hz), gedraaid over
 `hoek`. Een spinnenkop is niet rond: zijn romp is het vierkant uit de omhullende
 rechthoek van het grondvlak. De volgorde is vast — 0 is (+hx,+hz) en dan tegen
 de klok in — zodat `band` en de dakvlakken weten welke zijde waar zit.
*/
function vierkant(cx, cz, hx, hz, y, hoek = 0) {
  const c = Math.cos(hoek), s = Math.sin(hoek);
  const p = [];
  for (const [ax, az] of [[hx, hz], [-hx, hz], [-hx, -hz], [hx, -hz]])
    p.push([cx + ax * c - az * s, y, cz + ax * s + az * c]);
  return p;
}

/*
 Een eigen toevalsgenerator, met het hart van de molen als zaad. De stammen in
 de houtkolk mogen er willekeurig bij liggen, maar wel elke keer hetzelfde: een
 kolk die bij elk bezoek anders ligt leest als een storing.
*/
function dobbel(zaad) {
  let s = Math.floor(Math.abs(zaad) * 1000) % 2147483647 || 12345;
  return () => { s = (s * 48271) % 2147483647; return (s - 1) / 2147483646; };
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
    groen: hout('#33463a'),         // de gepotdekselde romp van de spinnenkop
    // de boomstammen: een vlakke kleur, net als de boomstammen in js/world.js.
    // Een plankentextuur om een cilinder geeft lichte ringen, en dan lijkt een
    // stam op een ton.
    stam: new THREE.MeshStandardMaterial({ color: 0x6b573b, roughness: 0.98 }),
    kops: new THREE.MeshStandardMaterial({ color: 0xc9b088, roughness: 0.95 }),
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
/*
 ---------------------------------------------------------------- spinnenkop
 De Terpensmole in de polder langs het Sneekerpad: een spinnenkopmolen.

 Dat is iets heel anders dan De Rat. Geen achtkant, geen stelling en geen
 loodsen, maar een vierkante, taps toelopende romp van vijf bij vijf meter met
 een klein draaibaar bovenhuis erop — de "spinnenkop" — dat het hele gevlucht en
 de staart draagt. Zo'n molen maalt een polder droog en staat daarom alleen in
 het land, op een terpje met een beschoeiing eromheen zodat het water er niet
 langs vreet.

 Twee draaiingen die niet hetzelfde zijn, en dat is precies het punt van dit
 type: de romp staat vast in de richting van het grondvlak (`voet.hoek`, uit de
 omhullende rechthoek van het BAG-pand), en het bovenhuis staat op de wind
 (`kruihoek`). Bij De Rat vallen die twee samen omdat een achtkant er van alle
 kanten hetzelfde uitziet; hier zie je het verschil meteen.
*/
function bouwSpinnenkop(M, g, mats, scene) {
  const V = M.voet || { hx: 2.5, hz: 2.5, hoek: 0, terp: 4.6 };
  const kruiRad = (M.kruihoek || 0) * Math.PI / 180;
  const kv = [Math.cos(kruiRad), Math.sin(kruiRad)];     // de kant waar de kop op staat
  const TERP = 0.45;                                     // hoogte van het terpje
  const kapVoet = M.top - M.kap;                         // waar het bovenhuis begint
  const t = V.terp;

  // ---- het terpje met zijn beschoeiing ----
  const terpOnder = vierkant(M.cx, M.cz, t, t, 0, V.hoek);
  const terpBoven = vierkant(M.cx, M.cz, t, t, TERP, V.hoek);
  band(g.dek, M.cx, M.cz, terpOnder, terpBoven, 1.3, 0.5);
  const hart = [M.cx, TERP, M.cz];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    driehoek(g.dek, terpBoven[i], terpBoven[j], hart, [[0, 0], [t, 0], [t / 2, t]], [0, 1, 0]);
  }

  // ---- de taps toelopende romp ----
  const voetRing = vierkant(M.cx, M.cz, V.hx, V.hz, TERP, V.hoek);
  const halsRing = vierkant(M.cx, M.cz, M.romp, M.romp, kapVoet, V.hoek);
  band(g.groen, M.cx, M.cz, voetRing, halsRing, 1.4, 0.34);   // 34 cm per plank

  /*
   Het bovenhuis. Het staat op de kruihoek en niet op de hoek van de romp, dus
   het steekt een stukje over de hals heen — dat hoort ook zo: er zit een rand
   tussen die de regen van de romp houdt.
  */
  const kb = M.romp + 0.22;
  const kapVloer = vierkant(M.cx, M.cz, kb, kb, kapVoet, kruiRad);
  const kapMuur = vierkant(M.cx, M.cz, kb, kb, kapVoet + M.kap * 0.42, kruiRad);
  band(g.kap, M.cx, M.cz, kapVloer, kapMuur, 1.2, 0.34);
  // de onderkant van het overstek
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    driehoek(g.kap, kapVloer[i], kapVloer[j], [M.cx, kapVoet, M.cz], [[0, 0], [1, 0], [0.5, 1]], [0, -1, 0]);
  }
  // het dak: een nok in de kruirichting, met twee schuine vlakken en twee topgevels
  const nokA = [M.cx + kv[0] * kb, M.top, M.cz + kv[1] * kb];
  const nokB = [M.cx - kv[0] * kb, M.top, M.cz - kv[1] * kb];
  const zij = [-kv[1], kv[0]];
  vierhoek(g.kap, kapMuur[0], kapMuur[1], nokB, nokA, [[0, 0], [2 * kb, 0], [2 * kb, 1.6], [0, 1.6]], [zij[0], 0.8, zij[1]]);
  vierhoek(g.kap, kapMuur[2], kapMuur[3], nokA, nokB, [[0, 0], [2 * kb, 0], [2 * kb, 1.6], [0, 1.6]], [-zij[0], 0.8, -zij[1]]);
  driehoek(g.kap, kapMuur[3], kapMuur[0], nokA, [[0, 0], [2 * kb, 0], [kb, 1.6]], [kv[0], 0.4, kv[1]]);
  driehoek(g.kap, kapMuur[1], kapMuur[2], nokB, [[0, 0], [2 * kb, 0], [kb, 1.6]], [-kv[0], 0.4, -kv[1]]);

  // ---- de bovenas met het gevlucht ----
  const asY = kapVoet + M.kap * 0.42;
  const asLang = M.romp + 1.2;
  const asGeo = new THREE.CylinderGeometry(0.15, 0.19, asLang, 8);
  const f = asLang * 0.34;
  voegToe(g.balk, asGeo, plaats(M.cx + kv[0] * f, asY + Math.sin(HELLING) * f, M.cz + kv[1] * f,
    -Math.atan2(kv[1], kv[0]), 0, Math.PI / 2 - HELLING));
  asGeo.dispose();
  const kop = asLang * 0.66;
  const gev = maakGevlucht(M, mats);
  gev.position.set(M.cx + kv[0] * kop, asY + Math.sin(HELLING) * kop, M.cz + kv[1] * kop);
  gev.rotation.set(HELLING, Math.PI / 2 - kruiRad, 0, 'YXZ');
  gev.name = `gevlucht ${M.naam}`;
  scene.add(gev);
  gevluchten.push({ groep: gev, rad: (M.toeren || 6) * Math.PI * 2 / 60, naam: M.naam });

  /*
   De staart. Bij een spinnenkop loopt die van het bovenhuis schuin naar beneden
   tot vlak boven de grond: daar duw je hem mee rond, en daar hangt het kruirad
   aan waarmee je hem vastzet. Hij is dus veel langer dan bij een stellingmolen,
   waar je hem vanaf de omloop bedient.
  */
  const ax = -kv[0], az = -kv[1];
  const voet = [M.cx + ax * (t * 0.82), TERP + 0.85, M.cz + az * (t * 0.82)];
  const top = [M.cx + ax * (kb + 0.18), kapVoet + M.kap * 0.26, M.cz + az * (kb + 0.18)];
  for (const kant of [-0.62, 0.62]) {
    const zx = -az * kant, zz = ax * kant;
    const A = [voet[0] + zx, voet[1], voet[2] + zz];
    const B = [top[0] + zx * 0.3, top[1], top[2] + zz * 0.3];
    const len = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
    const boom = new THREE.BoxGeometry(len, 0.13, 0.13);
    voegToe(g.balk, boom, plaats((A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2,
      -Math.atan2(B[2] - A[2], B[0] - A[0]), 0, Math.atan2(B[1] - A[1], Math.hypot(B[0] - A[0], B[2] - A[2]))));
    boom.dispose();
  }
  // de spruit: de dwarsbalk die de twee staartbomen bij elkaar houdt
  const spruit = new THREE.BoxGeometry(0.1, 0.1, 1.35);
  voegToe(g.balk, spruit, plaats(voet[0], voet[1] + 0.05, voet[2], -Math.atan2(az, ax)));
  spruit.dispose();
  // het kruirad aan het eind van de staart
  const wielGeo = new THREE.TorusGeometry(0.55, 0.055, 6, 14);
  voegToe(g.wit, wielGeo, plaats(voet[0], voet[1] - 0.1, voet[2], -Math.atan2(az, ax)));
  wielGeo.dispose();
  const spaakGeo = new THREE.BoxGeometry(1.1, 0.05, 0.05);
  for (let k = 0; k < 3; k++) {
    voegToe(g.wit, spaakGeo, plaats(voet[0], voet[1] - 0.1, voet[2], -Math.atan2(az, ax), 0, k * Math.PI / 3));
  }
  spaakGeo.dispose();

  /*
   De trap naar het deurtje. Hij staat opzij van het gevlucht en niet ervoor:
   wie de molen in wil, moet niet onder de roeden door.
  */
  const tx = -kv[1], tz = kv[0];
  const deurY = 2.0;
  const onderaan = [M.cx + tx * (t * 0.72), TERP, M.cz + tz * (t * 0.72)];
  const bovenaan = [M.cx + tx * (V.hx * 0.75), TERP + deurY, M.cz + tz * (V.hx * 0.75)];
  const trapL = Math.hypot(bovenaan[0] - onderaan[0], bovenaan[1] - onderaan[1], bovenaan[2] - onderaan[2]);
  const trapHoek = Math.atan2(bovenaan[1] - onderaan[1], Math.hypot(bovenaan[0] - onderaan[0], bovenaan[2] - onderaan[2]));
  for (const kant of [-0.42, 0.42]) {
    const zx = -tz * kant, zz = tx * kant;
    const boom = new THREE.BoxGeometry(trapL, 0.1, 0.06);
    voegToe(g.balk, boom, plaats((onderaan[0] + bovenaan[0]) / 2 + zx, (onderaan[1] + bovenaan[1]) / 2, (onderaan[2] + bovenaan[2]) / 2 + zz,
      -Math.atan2(bovenaan[2] - onderaan[2], bovenaan[0] - onderaan[0]), 0, trapHoek));
    boom.dispose();
    // de leuning erboven
    const leun = new THREE.BoxGeometry(trapL, 0.05, 0.05);
    voegToe(g.balk, leun, plaats((onderaan[0] + bovenaan[0]) / 2 + zx, (onderaan[1] + bovenaan[1]) / 2 + 0.78, (onderaan[2] + bovenaan[2]) / 2 + zz,
      -Math.atan2(bovenaan[2] - onderaan[2], bovenaan[0] - onderaan[0]), 0, trapHoek));
    leun.dispose();
  }
  const treden = 7;
  const tredeGeo = new THREE.BoxGeometry(0.26, 0.04, 0.84);
  for (let i = 1; i <= treden; i++) {
    const u = i / (treden + 1);
    voegToe(g.dek, tredeGeo, plaats(onderaan[0] + (bovenaan[0] - onderaan[0]) * u, onderaan[1] + (bovenaan[1] - onderaan[1]) * u,
      onderaan[2] + (bovenaan[2] - onderaan[2]) * u, -Math.atan2(tz, tx)));
  }
  tredeGeo.dispose();
}

/*
 ------------------------------------------------------------------ houtkolk
 De inham achter een zaagmolen. Bij De Rat is dat een waterdeel van 857 m² dat
 met twee punten aan de Geeuw vastzit: geen vijver maar een aftakking, en dat is
 precies wat een houtkolk is. De boomstammen kwamen over het water aangevaren en
 bleven er drijven tot ze de molen in gingen — in het water, want daar scheurt en
 kromtrekt een stam niet, en hij is er ook nog eens makkelijk te verplaatsen.

 De stammen worden in de kolk gelegd en niet erlangs: elk punt wordt eerst tegen
 de ring van het waterdeel gehouden, met een marge zodat er geen stam half in de
 oever steekt.
*/
function inRing(x, z, ring) {
  let binnen = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) binnen = !binnen;
  }
  return binnen;
}
function totRand(x, z, ring) {
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const l2 = dx * dx + dz * dz || 1e-9;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2));
    best = Math.min(best, Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t)));
  }
  return best;
}

function bouwKolk(M, g) {
  const K = M.kolk;
  if (!K || !K.ring || K.ring.length < 4) return 0;
  const water = K.y ?? -0.35;
  const rnd = dobbel(K.cx * 31 + K.cz);

  // de lengterichting van de kolk: de twee punten van de ring die het verst
  // uit elkaar liggen. Stammen liggen in de lengte, niet dwars.
  let A = K.ring[0], B = K.ring[1], ver = -1;
  for (const p of K.ring) for (const q of K.ring) {
    const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (d > ver) { ver = d; A = p; B = q; }
  }
  const langs = Math.atan2(B[1] - A[1], B[0] - A[0]);

  let stammen = 0;
  const STAP = 1.7;
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of K.ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  for (let x = x0; x <= x1; x += STAP) for (let z = z0; z <= z1; z += STAP) {
    const px = x + (rnd() - 0.5) * 0.7, pz = z + (rnd() - 0.5) * 0.7;
    if (!inRing(px, pz, K.ring)) continue;
    const ruimte = totRand(px, pz, K.ring);
    if (ruimte < 1.6) continue;                        // niet half in de oever
    if (rnd() > 0.42) continue;                        // niet elke plek een stam
    /*
     Past de stam hier, en zo ja hoe? Deze kolk is een smalle inham met een knik
     erin, en een stam van zes meter langs de gemiddelde lengterichting steekt in
     die knik aan twee kanten de wal in. Er wordt daarom eerst gekeken of allebei
     de uiteinden nog in het water liggen; zo niet, dan draait de stam een stukje
     bij, en past hij nergens dan blijft die plek leeg. Zo volgen de stammen
     vanzelf de vorm van de kolk in plaats van er dwars overheen te liggen.
    */
    const lang = Math.min(6.4, 3.0 + ruimte * 1.6);
    const straal = 0.17 + rnd() * 0.07;
    let hoek = null;
    for (const af of [0, 0.26, -0.26, 0.52, -0.52, 0.8, -0.8, 1.1, -1.1]) {
      const h = langs + af + (rnd() - 0.5) * 0.12;
      let past = true;
      for (const t of [-0.5, -0.28, 0.28, 0.5]) {
        const ex = px + Math.cos(h) * lang * t, ez = pz + Math.sin(h) * lang * t;
        if (!inRing(ex, ez, K.ring) || totRand(ex, ez, K.ring) < 0.35) { past = false; break; }
      }
      if (past) { hoek = h; break; }
    }
    if (hoek === null) continue;
    /*
     Een drijvende stam steekt er maar voor een derde bovenuit; nat hout ligt
     diep. Het hart komt daarom onder de waterlijn te liggen.
    */
    const geo = new THREE.CylinderGeometry(straal, straal, lang, 7);
    voegToe(g.stam, geo, plaats(px, water - straal * 0.2, pz, -hoek, 0, Math.PI / 2));
    geo.dispose();
    // de kopse kanten, lichter dan de bast
    const kopGeo = new THREE.CircleGeometry(straal, 7);
    for (const kant of [-1, 1]) {
      voegToe(g.kops, kopGeo, plaats(px + Math.cos(hoek) * lang / 2 * kant, water - straal * 0.2, pz + Math.sin(hoek) * lang / 2 * kant,
        -hoek + (kant > 0 ? 0 : Math.PI), 0, 0).multiply(plaats(0, 0, 0, Math.PI / 2, 0, 0).multiply(plaats(0, 0, 0, 0, 0, Math.PI / 2))));
    }
    kopGeo.dispose();
    stammen++;
  }

  /*
   En een paar remmingpalen langs de kant: daar werd het vlot aan vastgelegd.
   Ze staan op de ring zelf, om de zoveel punten, zodat ze de vorm van de kolk
   volgen in plaats van in een rijtje te staan.
  */
  const paalGeo = new THREE.CylinderGeometry(0.11, 0.13, 2.2, 6);
  for (let i = 0; i < K.ring.length; i += 3) {
    const [rx, rz] = K.ring[i];
    // een halve meter het water in, anders staat hij in de wal
    const naar = Math.atan2(K.cz - rz, K.cx - rx);
    voegToe(g.balk, paalGeo, plaats(rx + Math.cos(naar) * 0.6, water + 0.55, rz + Math.sin(naar) * 0.6));
  }
  paalGeo.dispose();

  /*
   Op de wal een stapel gezaagde stammen, klaar om de molen in te gaan. Hij komt
   op de lijn van de molen naar de kolk te liggen, net buiten het water: dat is
   waar je hem in het echt ook neerlegt, en zo staat hij nooit in de sloot.
  */
  const naarKolk = Math.atan2(K.cz - M.cz, K.cx - M.cx);
  let sx = M.cx, sz = M.cz;
  for (let d = 4; d < 60; d += 0.5) {
    const px = M.cx + Math.cos(naarKolk) * d, pz = M.cz + Math.sin(naarKolk) * d;
    if (inRing(px, pz, K.ring)) break;
    sx = px; sz = pz;
  }
  sx -= Math.cos(naarKolk) * 3.0; sz -= Math.sin(naarKolk) * 3.0;
  const stapelHoek = naarKolk + Math.PI / 2;
  const straal = 0.21;
  for (let laag = 0; laag < 2; laag++) {
    const n = 3 - laag;
    for (let k = 0; k < n; k++) {
      const zij = (k - (n - 1) / 2) * straal * 2.15;
      const px = sx + Math.cos(naarKolk) * zij, pz = sz + Math.sin(naarKolk) * zij;
      const geo = new THREE.CylinderGeometry(straal, straal, 4.6, 7);
      voegToe(g.stam, geo, plaats(px, straal + laag * straal * 1.8, pz, -stapelHoek, 0, Math.PI / 2));
      geo.dispose();
    }
  }
  // en twee losse stammen ernaast, niet op de stapel — zo ligt het er in het echt
  for (const [af, draai] of [[3.4, 0.35], [-2.8, -0.5]]) {
    const px = sx + Math.cos(stapelHoek) * af * 0.4 + Math.cos(naarKolk) * af * 0.5;
    const pz = sz + Math.sin(stapelHoek) * af * 0.4 + Math.sin(naarKolk) * af * 0.5;
    const geo = new THREE.CylinderGeometry(straal, straal, 4.2, 7);
    voegToe(g.stam, geo, plaats(px, straal, pz, -(stapelHoek + draai), 0, Math.PI / 2));
    geo.dispose();
  }
  return stammen;
}

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
  const gGroen = bak(), gStam = bak(), gKops = bak();
  /*
   Dezelfde bakken, met een naam erbij voor de bouwers die hieronder staan. Hij
   heet met opzet niet `g`: verderop in de lus staat al een `const g` voor het
   gevlucht, en dan valt deze in de dode zone van dat blok — de pagina viel om
   met "Cannot access 'g' before initialization" nog voor de wereld er stond.
  */
  const bakken = { riet: gRiet, kap: gKap, teer: gTeer, dek: gDek, balk: gBalk, wit: gWit,
    groen: gGroen, stam: gStam, kops: gKops };
  let stammen = 0;

  for (const M of molens) {
    /*
     Twee soorten molen, en ze delen alleen het gevlucht. Een spinnenkop heeft
     geen achtkant, geen stelling en geen loodsen, dus die gaat zijn eigen weg.
    */
    if (M.soort === 'spinnenkop') { bouwSpinnenkop(M, bakken, mats, scene); continue; }
    const kruiRad = (M.kruihoek || 0) * Math.PI / 180;
    const kapVoet = M.top - M.kap;
    const kv = [Math.cos(kruiRad), Math.sin(kruiRad)];        // de kant waar de kap op staat
    loodsen(M, gLoods, gLoodsDak);
    stammen += bouwKolk(M, bakken);

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
    [gGroen, mats.groen, 'molen-romp-spinnenkop'],
    [gStam, mats.stam, 'houtkolk-stammen'], [gKops, mats.kops, 'houtkolk-kopse-kanten'],
  ]) {
    const m = maakMesh(g, mat, naam);
    if (m) scene.add(m);
  }
  const namen = molens.map(m => `${m.naam} (${m.soort || 'stelling'}, vlucht ${m.vlucht} m)`).join(', ');
  console.log(`molens: ${molens.length} — ${namen}${stammen ? `, ${stammen} stammen in de houtkolk` : ''}`);
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
