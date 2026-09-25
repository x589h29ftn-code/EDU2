/*
 Bomen, struiken en gras (verzoek 24 sep 2026: "kijk ook eens naar de bomen,
 bosjes en het gras met dezelfde blik").

 Wat er was, gemeten:
   - een kroon was een icosaëder van tachtig vlakken met platte normalen en één
     egale kleur: van dichtbij een geslepen groene edelsteen;
   - een struik was een bol van 6 × 4 vlakken, even egaal;
   - het grasdoek herhaalde om de 8,3 m, met "madeliefjes" van 12 tot 25 cm die
     in beeld als witte snippers lagen, en zonder enige variatie over grotere
     afstand, zodat je op een veld het doek zag terugkomen.

 Wat er nu is, zonder dat het meer kost: bomen staan in tegels van 240 m en de
 fijne kroon wordt tot ruim driehonderd meter getekend, dus een zwaardere kroon
 zou overal in beeld duurder zijn. Het aantal vlakken blijft daarom gelijk, en de
 winst zit in:
   - een bobbelige vorm: elk hoekpunt van de bol een eigen afstand tot het
     midden (een vaste ruisfunctie op de richting, dus de naden sluiten);
   - gladde normalen: het licht loopt over de bobbels in plaats van per vlak te
     verspringen;
   - licht in de hoekpunten (zoals de rest van deze wereld, zie CLAUDE.md):
     onderin en in de holtes donker, bovenop en op de bulten licht;
   - een bladdoek met een normal map: blaadjes die het licht vangen;
   - schors op de stam, en een paar takken die de kroon in gaan;
   - voor het gras een fijner doek zonder witte snippers, en een variatie over
     tientallen meters (`grasVariatie`), zodat een veld niet uit tegels bestaat.
*/
import * as THREE from 'three';
import { rng, _normaalDoek } from './textures.js';

// ------------------------------------------------------------------ doeken
const cache = new Map();
function doek(naam, S, teken, reliëf = 0) {
  if (cache.has(naam)) return cache.get(naam);
  const c = document.createElement('canvas'); c.width = c.height = S;
  const h = document.createElement('canvas'); h.width = h.height = S;
  const g = c.getContext('2d'), gh = h.getContext('2d');
  gh.fillStyle = '#808080'; gh.fillRect(0, 0, S, S);
  const r = rng(naam.length * 311 + naam.charCodeAt(0));
  teken(g, gh, S, r);
  const map = new THREE.CanvasTexture(c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping; map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  let normalMap = null;
  if (reliëf) {
    normalMap = new THREE.CanvasTexture(_normaalDoek(h, reliëf));
    normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping; normalMap.colorSpace = THREE.NoColorSpace;
  }
  // de gemiddelde kleur, voor de grove kroon zonder doek in de verte
  const d = g.getImageData(0, 0, S, S).data; let rs = 0, gs = 0, bs = 0;
  for (let i = 0; i < d.length; i += 4) { rs += d[i]; gs += d[i + 1]; bs += d[i + 2]; }
  const n = d.length / 4;
  const uit = { map, normalMap, gemiddeld: new THREE.Color(`rgb(${Math.round(rs / n)},${Math.round(gs / n)},${Math.round(bs / n)})`) };
  cache.set(naam, uit);
  return uit;
}
// Een tegelbaar doek (tekenen met een marge over de rand heen, dan klopt de naad)
function overRand(S, x, y, rr, teken) {
  for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
    if (x + dx + rr < 0 || x + dx - rr > S || y + dy + rr < 0 || y + dy - rr > S) continue;
    teken(x + dx, y + dy);
  }
}

/*
 Blad: een donkere ondergrond (de schaduw tussen de bladeren) met daarop
 honderden kleine ovaaltjes in wisselende tinten groen, elk met een lichte kant.
 Op de hoogtekaart zijn ze bultjes, dus ze vangen het licht.
*/
export function bladDoek() {
  return doek('blad', 256, (g, h, S, r) => {
    g.fillStyle = '#26401a'; g.fillRect(0, 0, S, S);
    h.fillStyle = '#303030'; h.fillRect(0, 0, S, S);
    for (let i = 0; i < 1500; i++) {
      const x = r() * S, y = r() * S, a = r() * Math.PI, l = 4 + r() * 6, b = 2 + r() * 2.5;
      const t = r();
      const kleur = `rgb(${Math.round(55 + t * 60)},${Math.round(95 + t * 70)},${Math.round(30 + t * 30)})`;
      overRand(S, x, y, l, (px, py) => {
        g.save(); g.translate(px, py); g.rotate(a);
        g.fillStyle = kleur; g.beginPath(); g.ellipse(0, 0, l, b, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(210,235,150,0.18)'; g.beginPath(); g.ellipse(-l * 0.2, -b * 0.3, l * 0.6, b * 0.4, 0, 0, Math.PI * 2); g.fill();
        g.restore();
        h.save(); h.translate(px, py); h.rotate(a);
        h.fillStyle = `rgba(230,230,230,${0.5 + r() * 0.4})`; h.beginPath(); h.ellipse(0, 0, l, b, 0, 0, Math.PI * 2); h.fill();
        h.restore();
      });
    }
  }, 1.4);
}
// Schors: verticale groeven, wat korstmos
export function schorsDoek() {
  return doek('schors', 128, (g, h, S, r) => {
    g.fillStyle = '#6a5642'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 70; i++) {
      const x = r() * S, w = 1 + r() * 3;
      g.fillStyle = r() < 0.5 ? 'rgba(40,30,20,0.45)' : 'rgba(150,130,105,0.25)';
      g.fillRect(x, 0, w, S);
      h.fillStyle = 'rgba(20,20,20,0.6)'; h.fillRect(x, 0, w, S);
    }
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(140,160,110,0.25)'; g.fillRect(r() * S, r() * S, 3 + r() * 6, 2 + r() * 5); }
    for (let i = 0; i < 25; i++) { const y = r() * S; h.fillStyle = 'rgba(30,30,30,0.5)'; h.fillRect(0, y, S, 1); }
  }, 1.2);
}
/*
 Ruis voor het gras: een tegelbaar veld van zachte vlekken (waarden op een
 rooster van 8 × 8, vloeiend ertussen). `grasVariatie` leest hem op twee schalen.
*/
export function grasRuis() {
  if (cache.has('grasruis')) return cache.get('grasruis');
  const S = 128, N = 8, r = rng(577);
  const rooster = Array.from({ length: N * N }, () => r());
  const w = (i, j) => rooster[((j % N) + N) % N * N + ((i % N) + N) % N];
  const zacht = (t) => t * t * (3 - 2 * t);
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), beeld = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const fx = x / S * N, fy = y / S * N, i = Math.floor(fx), j = Math.floor(fy), u = zacht(fx - i), v = zacht(fy - j);
    const a = w(i, j) + (w(i + 1, j) - w(i, j)) * u, b = w(i, j + 1) + (w(i + 1, j + 1) - w(i, j + 1)) * u;
    const val = Math.round((a + (b - a) * v) * 255), k = (y * S + x) * 4;
    beeld.data[k] = beeld.data[k + 1] = beeld.data[k + 2] = val; beeld.data[k + 3] = 255;
  }
  g.putImageData(beeld, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace;
  cache.set('grasruis', t);
  return t;
}

// ------------------------------------------------------------------ vormen
/*
 Een bobbelige bol. De ruis hangt alleen aan de richting van een hoekpunt, dus
 twee driehoeken die een hoekpunt delen krijgen er dezelfde verplaatsing: de
 kroon blijft dicht. De normalen worden daarna per plek gemiddeld (de icosaëder
 van three heeft geen index, dus zonder dat middelen blijft elk vlak plat).
   straal   de straal van de bol voor hij bobbelt
   diepte   hoeveel hij bobbelt (0,18 = achttien procent)
   uvMaat   meter per doek
*/
export function bolGeo(straal, detail, { diepte = 0.18, zaad = 1, uvMaat = 2, plat = 1, basis = null } = {}) {
  // `basis`: een eigen bol om van uit te gaan (de struik: 6 × 4, net zo veel
  // vlakken als de oude struik), anders een icosaëder van dit detail
  const g = basis ? (basis.index ? basis.toNonIndexed() : basis) : new THREE.IcosahedronGeometry(1, detail);
  const P = g.attributes.position;
  const r = rng(zaad * 7919);
  const f = Array.from({ length: 9 }, () => r() * 6.28);
  const ruis = (x, y, z) =>
    Math.sin(3.1 * x + f[0]) * Math.sin(2.7 * y + f[1]) * Math.sin(3.3 * z + f[2])
    + 0.5 * Math.sin(6.1 * x + f[3]) * Math.sin(5.7 * y + f[4]) * Math.sin(6.4 * z + f[5])
    + 0.25 * Math.sin(11 * x + f[6] + 3 * y) * Math.sin(9.5 * z + f[7]);
  const bult = new Float32Array(P.count);
  const v = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i).normalize();
    const b = ruis(v.x, v.y, v.z) / 1.6;
    bult[i] = b;
    const s = straal * (1 + diepte * b);
    P.setXYZ(i, v.x * s, v.y * s * plat, v.z * s);
  }
  // gladde normalen: per plek (afgerond) de vlaknormalen optellen
  const sleutel = (i) => `${P.getX(i).toFixed(4)},${P.getY(i).toFixed(4)},${P.getZ(i).toFixed(4)}`;
  const som = new Map();
  const a = new THREE.Vector3(), b2 = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let t = 0; t < P.count; t += 3) {
    a.fromBufferAttribute(P, t); b2.fromBufferAttribute(P, t + 1); c.fromBufferAttribute(P, t + 2);
    n.subVectors(c, b2).cross(a.clone().sub(b2));
    for (let k = 0; k < 3; k++) {
      const s = sleutel(t + k);
      if (!som.has(s)) som.set(s, new THREE.Vector3());
      som.get(s).add(n);
    }
  }
  const N = new Float32Array(P.count * 3), kleur = new Float32Array(P.count * 3), uv = new Float32Array(P.count * 2);
  for (let i = 0; i < P.count; i++) {
    const s = som.get(sleutel(i)).clone().normalize();
    // wijst de gemiddelde normaal naar binnen (de volgorde van de vlakken), dan omdraaien
    v.fromBufferAttribute(P, i);
    if (s.dot(v) < 0) s.negate();
    N[i * 3] = s.x; N[i * 3 + 1] = s.y; N[i * 3 + 2] = s.z;
    /*
     Licht in de hoekpunten: van onder (0,55) naar boven (1,05), plus de bult —
     een holte ligt dieper in de kroon en krijgt minder licht.
    */
    const hy = v.y / (straal * plat);
    const zacht = Math.max(0, Math.min(1, (hy + 0.9) / 1.7));
    const l = 0.55 + 0.5 * zacht * zacht * (3 - 2 * zacht) + 0.14 * bult[i];
    kleur[i * 3] = kleur[i * 3 + 1] = kleur[i * 3 + 2] = Math.max(0.35, Math.min(1.1, l));
  }
  // uv per driehoek uit de positie, langs de as waar zijn normaal het meest langs ligt
  for (let t = 0; t < P.count; t += 3) {
    const nx = N[t * 3] + N[t * 3 + 3] + N[t * 3 + 6], ny = N[t * 3 + 1] + N[t * 3 + 4] + N[t * 3 + 7], nz = N[t * 3 + 2] + N[t * 3 + 5] + N[t * 3 + 8];
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
    for (let k = 0; k < 3; k++) {
      const i = t + k, x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      if (ax >= ay && ax >= az) { uv[i * 2] = z / uvMaat; uv[i * 2 + 1] = y / uvMaat; }
      else if (ay >= az) { uv[i * 2] = x / uvMaat; uv[i * 2 + 1] = z / uvMaat; }
      else { uv[i * 2] = x / uvMaat; uv[i * 2 + 1] = y / uvMaat; }
    }
  }
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.BufferAttribute(kleur, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.userData.bol = { straal, diepte };
  return g;
}

/*
 De stam met drie takken die de kroon in lopen. Onder een kroon die op ruim
 drie meter begint zag je een kale paal met een bal erop; met takken is het een
 boom. Hoogte en maat zijn die van de oude stam (5 m, 0,16 tot 0,28), zodat de
 matrices in js/world.js niet veranderen.
*/
export function stamGeo(hoogte = 5.0, rBoven = 0.16, rOnder = 0.28, zaad = 1) {
  const r = rng(zaad * 104729);
  const delen = [];
  const stam = new THREE.CylinderGeometry(rBoven, rOnder, hoogte, 7, 1, true);
  delen.push(stam);
  for (let k = 0; k < 3; k++) {
    // hoog op de stam en niet te lang, zodat ze in de kroon verdwijnen en er
    // niet kaal onder uit steken
    const a = (k / 3) * Math.PI * 2 + r() * 0.8, L = 0.9 + r() * 0.4;
    const tak = new THREE.CylinderGeometry(0.03, 0.065, L, 4, 1, true);
    tak.translate(0, L / 2, 0);
    tak.rotateZ(0.6 + r() * 0.25);
    tak.rotateY(a);
    tak.translate(0, hoogte * (0.30 + k * 0.05), 0);
    delen.push(tak);
  }
  const pos = [], nor = [], uv = [];
  for (const g of delen) {
    const n = g.index ? g.toNonIndexed() : g;
    pos.push(...n.attributes.position.array); nor.push(...n.attributes.normal.array); uv.push(...n.attributes.uv.array);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

// ------------------------------------------------------------------ materialen
/** Kroon, met doek en licht in de hoekpunten. `tint` maakt de tweede kroon iets donkerder. */
export function kroonMat(tint = 0xffffff, { uvHerhaal = 1 } = {}) {
  const d = bladDoek();
  const m = new THREE.MeshStandardMaterial({ color: tint, map: d.map, normalMap: d.normalMap, vertexColors: true, roughness: 0.85 });
  m.normalScale.set(0.9, 0.9);
  if (uvHerhaal !== 1) { m.map = d.map.clone(); m.map.repeat.set(uvHerhaal, uvHerhaal); m.map.needsUpdate = true; }
  return m;
}
/** De grove kroon in de verte: geen doek, wel de gemiddelde kleur van het doek en het licht in de hoekpunten. */
export function kroonVerMat(tint = 0xffffff) {
  const c = bladDoek().gemiddeld.clone().multiply(new THREE.Color(tint));
  return new THREE.MeshStandardMaterial({ color: c, vertexColors: true, roughness: 0.9 });
}
export function stamMat(kleur = 0xffffff) {
  const d = schorsDoek();
  const map = d.map.clone(); map.repeat.set(3, 2); map.needsUpdate = true;
  const nm = d.normalMap.clone(); nm.repeat.set(3, 2); nm.needsUpdate = true;
  return new THREE.MeshStandardMaterial({ color: kleur, map, normalMap: nm, roughness: 0.95 });
}

/*
 Variatie in het gras over grote afstand. Het doek herhaalt om de vijf meter;
 op een veld van honderd meter zie je het twintig keer terugkomen. Deze
 toevoeging aan de shader leest in wereldcoördinaten een zacht ruisveld op twee
 schalen (77 m en 20 m) en maakt het gras daarmee lichter en donkerder, en op de
 hoge plekken van de grove schaal wat geler — dor gras, zoals een grasveld in
 september. Alleen voor materialen zonder instancing (de ondergrond).
*/
export function grasVariatie(mat) {
  if (!mat || mat.userData.grasVariatie) return mat;
  mat.userData.grasVariatie = true;
  const ruis = grasRuis();
  const oud = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (oud) oud(sh, r);
    sh.uniforms.grasRuis = { value: ruis };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGrasW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGrasW = (modelMatrix * vec4(transformed, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGrasW;\nuniform sampler2D grasRuis;')
      .replace('#include <map_fragment>', `#include <map_fragment>
      {
        float grof = texture2D(grasRuis, vGrasW * 0.013).r;
        float fijn = texture2D(grasRuis, vGrasW * 0.05 + vec2(0.37, 0.61)).r;
        float v = grof * 0.65 + fijn * 0.35;
        diffuseColor.rgb *= mix(0.80, 1.14, v);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.14, 1.06, 0.72), smoothstep(0.62, 0.88, grof) * 0.55);
      }`);
  };
  const sleutel = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
  mat.customProgramCacheKey = () => sleutel() + '|grasVariatie';
  mat.needsUpdate = true;
  return mat;
}
