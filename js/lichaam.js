/*
 Eén maatvoering en één set lichaamsdelen voor alle mensen in het spel.

 De voetgangers (js/npc.js) zijn instanced meshes en de mensen die meespelen
 (js/persoon.js) hebben een echt skelet, maar ze zagen er tot nu toe ook
 verschillend uit: allebei een eigen stapeltje dozen, allebei met andere maten.
 Erger was dat armen en benen uit één stuk bestonden — een been dat van heup tot
 voet één rechte plank is, zwaait als een klok en niet als een been.

 Hier staan daarom de maten van een volwassene van 1,75 m en de losse
 onderdelen. Armen en benen hebben een elleboog en een knie, er zitten handen,
 schoenen en een bekken aan, en het hoofd heeft een neus en oren — bij elkaar is
 dat het verschil tussen een pop en een mens, ook op tien meter afstand.

 Elk onderdeel is een geometrie waarvan de oorsprong op het draaipunt ligt: een
 bovenarm hangt onder (0,0,0) naar beneden, zodat een draai om de x-as meteen
 een schouderdraai is. `loopHouding` rekent uit hoe ver alle gewrichten staan bij
 een gegeven pas; npc.js en persoon.js gebruiken allebei dezelfde uitkomst, dus
 een wandelaar en een agent lopen precies gelijk.
*/
import * as THREE from 'three';
import { rng, _normaalDoek } from './textures.js';

// maten in meters, voor een lichaam van 1,75 m (schaal 1,0)
export const MAAT = {
  heup: 0.90,          // hoogte van het heupgewricht
  bovenbeen: 0.44,
  onderbeen: 0.39,     // enkel op 0,07
  schoenH: 0.07,
  heupX: 0.105,        // halve afstand tussen de heupen
  schouder: 1.42,
  schouderX: 0.205,
  bovenarm: 0.28,
  onderarm: 0.25,
  romp: 1.20,          // midden van de romp
  bekken: 0.99,
  nek: 1.46,
  hoofd: 1.615,
  hoofdR: 0.112,
  lengte: 1.75,
};

// ---------------------------------------------------------------- doeken
/*
 Ronde van 24 sep 2026 ("update ook net als de auto's en wapens de poppetjes qua
 kwaliteit, met oog voor de performance op een pc").

 Elk onderdeel krijgt een doek, en dat doek is bijna wit: bij de voetgangers is
 de kleur per persoon de kleur van de instantie (js/npc.js), en die wordt met
 het doek vermenigvuldigd. Zo heeft een rood shirt en een blauw shirt dezelfde
 breisteek, zonder een doek per kleur. Stof en spijkerstof hebben er een normal
 map bij, zodat de draad het licht vangt; het gezicht is een eigen doek met
 wenkbrauwen, oogkassen, neusschaduw, lippen en wangen.

 Voor de pc: zes doeken van 128 of 256 beeldpunten, één keer getekend en door
 iedereen gedeeld; per soort onderdeel nog steeds één instanced mesh.
*/
const doekCache = new Map();
function canvasVan(S, teken) {
  const c = document.createElement('canvas'); c.width = c.height = S;
  const h = document.createElement('canvas'); h.width = h.height = S;
  const g = c.getContext('2d'), gh = h.getContext('2d');
  gh.fillStyle = '#808080'; gh.fillRect(0, 0, S, S);
  teken(g, gh, S);
  return { c, h };
}
function alsTex(c, kleur = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = kleur ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}
function korrel(g, S, sterkte, r) {
  const d = g.getImageData(0, 0, S, S), p = d.data;
  for (let i = 0; i < p.length; i += 4) { const v = (r() - 0.5) * sterkte; p[i] += v; p[i + 1] += v; p[i + 2] += v; }
  g.putImageData(d, 0, 0);
}
const DOEKEN = {
  // breisteek van een shirt: fijne rijen, een beetje ongelijk
  stof: (g, h, S, r) => {
    g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 4) {
      g.fillStyle = 'rgba(0,0,0,0.07)'; g.fillRect(0, y, S, 2);
      h.fillStyle = 'rgba(40,40,40,0.8)'; h.fillRect(0, y, S, 2);
    }
    for (let x = 0; x < S; x += 4) { h.fillStyle = 'rgba(60,60,60,0.3)'; h.fillRect(x, 0, 1, S); }
    korrel(g, S, 10, r);
  },
  // spijkerstof: een schuine keper, met een naad langs de rand van het doek
  // (bij een been valt die rand op de zijkant: de buitennaad van de broek)
  broek: (g, h, S, r) => {
    g.fillStyle = '#f0f0f0'; g.fillRect(0, 0, S, S);
    for (let i = -S; i < S; i += 3) {
      for (const [gg, k] of [[g, 'rgba(0,0,0,0.10)'], [h, 'rgba(30,30,30,0.85)']]) {
        gg.strokeStyle = k; gg.lineWidth = 1.2; gg.beginPath(); gg.moveTo(i, 0); gg.lineTo(i + S, S); gg.stroke();
      }
    }
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 0, 3, S);
    h.fillStyle = 'rgba(20,20,20,1)'; h.fillRect(0, 0, 2, S);
    korrel(g, S, 14, r);
  },
  // huid: een zachte tekening, zonder dat het vlekken worden
  huid: (g, h, S, r) => {
    g.fillStyle = '#fbfbfb'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 90; i++) {
      const x = r() * S, y = r() * S, rr = 6 + r() * 18;
      const gr = g.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, r() < 0.5 ? 'rgba(200,120,110,0.07)' : 'rgba(255,240,220,0.08)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    korrel(g, S, 5, r);
  },
  // haar: strengen in de lengte, met lichte en donkere lokken
  haar: (g, h, S, r) => {
    g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 420; i++) {
      const x = r() * S, L = 20 + r() * 60, y = r() * S, licht = r() < 0.4;
      g.fillStyle = licht ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.22)'; g.fillRect(x, y, 1, L);
      h.fillStyle = licht ? 'rgba(200,200,200,0.6)' : 'rgba(40,40,40,0.6)'; h.fillRect(x, y, 1, L);
    }
  },
  // leer van een schoen: een fijne nerf en wat kreukels
  schoen: (g, h, S, r) => {
    g.fillStyle = '#eeeeee'; g.fillRect(0, 0, S, S);
    korrel(g, S, 18, r);
    for (let i = 0; i < 14; i++) { g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1; g.beginPath(); const y = r() * S; g.moveTo(0, y); g.bezierCurveTo(S / 3, y + (r() - 0.5) * 12, S * 2 / 3, y + (r() - 0.5) * 12, S, y); g.stroke(); }
  },
};
/*
 Het gezicht. De uv van het hoofd is een projectie van voren (zie `uvGezicht`
 hieronder): u = ½ + x / GEZ_B, v = ½ + (y − GEZ_Y) / GEZ_H. Wat niet naar voren
 kijkt krijgt een hoekje van het doek dat gewoon huid is. De wenkbrauwen zijn
 dun en half doorzichtig: eerder liepen wenkbrauwen van een eigen kleur op tien
 meter samen met de ogen tot één band (zie `ogen` hieronder); zo, als een
 schaduw in de huidskleur, gebeurt dat niet.
*/
const GEZ_B = 0.26, GEZ_H = 0.30, GEZ_Y = -0.01;
const naarDoek = (x, y, S) => [(0.5 + x / GEZ_B) * S, (1 - (0.5 + (y - GEZ_Y) / GEZ_H)) * S];
function gezichtDoek(g, h, S, r) {
  DOEKEN.huid(g, h, S, r);
  const ovaal = (x, y, rx, ry, kleur) => {
    const [cx, cy] = naarDoek(x, y, S), px = rx / GEZ_B * S, py = ry / GEZ_H * S;
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(px, py));
    gr.addColorStop(0, kleur); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.save(); g.translate(cx, cy); g.scale(px / Math.max(px, py), py / Math.max(px, py)); g.translate(-cx, -cy);
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, Math.max(px, py), 0, Math.PI * 2); g.fill(); g.restore();
  };
  for (const sx of [-1, 1]) {
    ovaal(sx * 0.045, 0.004, 0.030, 0.020, 'rgba(90,50,40,0.22)');         // oogkas
    ovaal(sx * 0.058, -0.045, 0.032, 0.026, 'rgba(230,110,100,0.16)');     // wang
    // wenkbrauw: een dunne boog
    const [a0, b0] = naarDoek(sx * 0.020, 0.030, S), [a1, b1] = naarDoek(sx * 0.047, 0.036, S), [a2, b2] = naarDoek(sx * 0.072, 0.028, S);
    g.strokeStyle = 'rgba(70,45,35,0.45)'; g.lineWidth = S / 90; g.lineCap = 'round';
    g.beginPath(); g.moveTo(a0, b0); g.quadraticCurveTo(a1, b1 - 2, a2, b2); g.stroke();
  }
  ovaal(0.014, -0.022, 0.008, 0.022, 'rgba(90,50,40,0.18)');               // schaduw langs de neus
  ovaal(-0.014, -0.022, 0.008, 0.022, 'rgba(90,50,40,0.10)');
  ovaal(0, -0.040, 0.016, 0.006, 'rgba(90,40,40,0.20)');                    // onder de neus
  // de mond: bovenlip, onderlip en de lijn ertussen
  const [m0, my] = naarDoek(-0.026, -0.060, S), [m1] = naarDoek(0.026, -0.060, S);
  const [, bl] = naarDoek(0, -0.052, S), [, ol] = naarDoek(0, -0.070, S);
  g.fillStyle = 'rgba(170,70,70,0.30)';
  g.beginPath(); g.moveTo(m0, my); g.quadraticCurveTo((m0 + m1) / 2, bl - 3, m1, my); g.quadraticCurveTo((m0 + m1) / 2, ol, m0, my); g.fill();
  g.strokeStyle = 'rgba(80,30,30,0.55)'; g.lineWidth = S / 170;
  g.beginPath(); g.moveTo(m0, my); g.quadraticCurveTo((m0 + m1) / 2, my + 1.5, m1, my); g.stroke();
  ovaal(0, -0.088, 0.030, 0.014, 'rgba(90,50,40,0.10)');                    // onder de lip, de kin
}

/**
 * Doek, reliëf en ruwheid voor een soort onderdeel: 'stof', 'broek', 'huid',
 * 'gezicht', 'haar' of 'schoen'. Gedeeld: elke aanroep met dezelfde soort
 * levert dezelfde texture.
 */
export function doekVoor(soort) {
  if (doekCache.has(soort)) return doekCache.get(soort);
  const r = rng(soort.length * 131 + soort.charCodeAt(0));
  const S = soort === 'gezicht' ? 256 : 128;
  const { c, h } = canvasVan(S, (g, gh, S) => (soort === 'gezicht' ? gezichtDoek : DOEKEN[soort])(g, gh, S, r));
  const reliëf = { stof: 1.2, broek: 1.4, haar: 0.9 }[soort];
  const uit = {
    map: alsTex(c),
    normalMap: reliëf ? alsTex(_normaalDoek(h, reliëf), false) : null,
    roughness: { stof: 0.95, broek: 0.9, huid: 0.62, gezicht: 0.62, haar: 0.6, schoen: 0.55 }[soort],
  };
  doekCache.set(soort, uit);
  return uit;
}
/** Een materiaal in een kleur met het doek van dat soort onderdeel (js/persoon.js). */
export function lichaamMat(kleur, soort) {
  const d = doekVoor(soort);
  const m = new THREE.MeshStandardMaterial({ color: kleur, roughness: d.roughness, map: d.map });
  if (d.normalMap) { m.normalMap = d.normalMap; m.normalScale.set(0.8, 0.8); }
  return m;
}
/** Welk doek hoort bij welk onderdeel. */
// (de onderarm is huid of mouw, per persoon; het gladde huiddoek staat op
// allebei goed, een breisteek op een blote arm niet)
export const DOEK_VAN = {
  romp: 'stof', bekken: 'broek', nek: 'huid', hoofd: 'gezicht', haar: 'haar', ogen: null,
  bovenarm: 'stof', onderarm: 'huid', hand: 'huid', bovenbeen: 'broek', onderbeen: 'broek',
  schoen: 'schoen', pet: 'stof', vest: 'stof',
};

// ---------------------------------------------------------------- bouwstenen
/*
 Een doos met afgeronde randen (dezelfde omzetting als in js/wapen.js en
 js/carmodel.js). Een romp van scherpe dozen heeft schouders als een kast; met
 vier tot vijf centimeter afronding is het een lichaam.
*/
function doosGeo(b, h, d, x = 0, y = 0, z = 0, rx = 0, r = 0.012) {
  r = Math.max(0.001, Math.min(r, b / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
  const g = new THREE.BoxGeometry(1, 1, 1, 3, 3, 3).toNonIndexed();
  const P = g.attributes.position, N = g.attributes.normal;
  const half = 0.5 / 3, bx = b / 2 - r, by = h / 2 - r, bz = d / 2 - r;
  const n = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    const px = P.getX(i), py = P.getY(i), pz = P.getZ(i);
    n.set(px - Math.sign(px) * half, py - Math.sign(py) * half, pz - Math.sign(pz) * half).normalize();
    P.setXYZ(i, bx * Math.sign(px) + n.x * r, by * Math.sign(py) + n.y * r, bz * Math.sign(pz) + n.z * r);
    N.setXYZ(i, n.x, n.y, n.z);
  }
  if (rx) g.rotateX(rx);
  g.translate(x, y, z);
  return g;
}
/*
 Een arm- of beenstuk: een taps toelopende buis die onder het gewricht hangt,
 met een bol op het gewricht zelf. Die bol is wat een knie en een elleboog doet
 lijken: buig je twee dozen ten opzichte van elkaar, dan gaapt er aan de
 buitenkant een wig; met een bol erin loopt de omtrek rond door.
*/
function ledGeo(rBoven, rOnder, lengte, { bol = true, eind = false, dz = 1 } = {}) {
  const buis = new THREE.CylinderGeometry(rBoven, rOnder, lengte, 10, 1, true);
  buis.scale(1, 1, dz); buis.translate(0, -lengte / 2, 0);
  const delen = [buis];
  if (bol) { const k = new THREE.SphereGeometry(rBoven, 10, 5); k.scale(1, 1, dz); delen.push(k); }
  if (eind) { const k = new THREE.SphereGeometry(rOnder, 10, 3, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); k.scale(1, 1, dz); k.translate(0, -lengte, 0); delen.push(k); }
  return delen;
}

/*
 Een romp uit één stuk: ringen op een reeks hoogtes, elk een afgeronde
 rechthoek (een superellips met macht 3: tussen een ellips en een doos in),
 aan elkaar genaaid. Gestapelde dozen gaven op elke overgang een naad, en met
 afgeronde dozen werd dat een rij opgeblazen banden; zo loopt de romp van de
 taille naar de borst naar de schouders zonder een naad.
   ringen: [y, halve breedte, halve diepte]
*/
function lijfGeo(ringen, rond = 16, macht = 3) {
  const pos = [], idx = [];
  const e = 2 / macht;
  for (const [y, bx, bz] of ringen) {
    for (let i = 0; i < rond; i++) {
      const a = (i / rond) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
      pos.push(Math.sign(c) * Math.pow(Math.abs(c), e) * bx, y, Math.sign(sn) * Math.pow(Math.abs(sn), e) * bz);
    }
  }
  for (let r = 0; r < ringen.length - 1; r++) for (let i = 0; i < rond; i++) {
    const a = r * rond + i, b = r * rond + (i + 1) % rond, c2 = a + rond, d = b + rond;
    idx.push(a, c2, b, b, c2, d);
  }
  // boven en onder dicht, met een middelpunt
  const onder = pos.length / 3; pos.push(0, ringen[0][0], 0);
  const boven = pos.length / 3; pos.push(0, ringen[ringen.length - 1][0], 0);
  const top = (ringen.length - 1) * rond;
  for (let i = 0; i < rond; i++) { idx.push(onder, i, (i + 1) % rond); idx.push(boven, top + (i + 1) % rond, top + i); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
// de maten van de romp, van de taille tot de nek (ten opzichte van MAAT.romp)
const ROMP = [
  [-0.215, 0.168, 0.094], [-0.15, 0.170, 0.096], [-0.06, 0.182, 0.102], [0.03, 0.194, 0.110],
  [0.12, 0.200, 0.114], [0.19, 0.210, 0.114], [0.235, 0.196, 0.104], [0.262, 0.150, 0.088], [0.285, 0.085, 0.070],
];

/*
 Losse geometrieën samenvoegen tot één. Zo kost een hoofd met neus en oren
 evenveel draw calls als een kale bol, en dat is nodig: bij de voetgangers is
 elk onderdeel een eigen instanced mesh.

 De normalen komen nu van de vormen zelf: `computeVertexNormals` op een
 geometrie zonder index maakt elk vlak plat, en dan is een bol een facettenbal.
 De uv komt per driehoek uit de positie (de as waar de normaal het meest langs
 ligt, net als bij de wapens), met `maat` meter per doek — of, bij het hoofd,
 een projectie van voren voor het gezicht.
*/
function samen(delen, maat = 0.08, gezicht = false) {
  const pos = [], nor = [];
  for (const g of delen) {
    const ng = g.index ? g.toNonIndexed() : g;
    pos.push(...ng.attributes.position.array);
    nor.push(...ng.attributes.normal.array);
    if (ng !== g) ng.dispose();
    g.dispose();
  }
  const uv = new Float32Array(pos.length / 3 * 2);
  for (let t = 0; t < pos.length; t += 9) {
    let nx = 0, ny = 0, nz = 0;
    for (let k = 0; k < 3; k++) { nx += nor[t + k * 3]; ny += nor[t + k * 3 + 1]; nz += nor[t + k * 3 + 2]; }
    const L = Math.hypot(nx, ny, nz) || 1;
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
    for (let k = 0; k < 3; k++) {
      const x = pos[t + k * 3], y = pos[t + k * 3 + 1], z = pos[t + k * 3 + 2], j = (t / 3 + k) * 2;
      if (gezicht) {
        // naar voren (−z): het gezicht; al het andere: een hoekje huid
        if (nz / L < -0.35) { uv[j] = 0.5 + x / GEZ_B; uv[j + 1] = 0.5 + (y - GEZ_Y) / GEZ_H; }
        else { uv[j] = 0.03; uv[j + 1] = 0.03; }
      } else if (ax >= ay && ax >= az) { uv[j] = z / maat; uv[j + 1] = y / maat; }
      else if (ay >= az) { uv[j] = x / maat; uv[j + 1] = z / maat; }
      else { uv[j] = x / maat; uv[j + 1] = y / maat; }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return geo;
}

/*
 De onderdelen. Elke functie geeft een geometrie met de oorsprong op het
 draaipunt: de romp om zijn eigen midden, een ledemaat aan de bovenkant. De
 maten zijn die van de dozen van hiervoor, zodat de houdingen, de botsingen en
 de proeven blijven kloppen; alleen de vorm is rond.
*/
export const DEEL = {
  // borstkas en taille: bovenin breder dan onderin, anders is het een doos
  // borstkas en taille: één gladde vorm, bovenin breder dan onderin (ROMP)
  romp: () => samen([lijfGeo(ROMP)], 0.05),
  // bekken met een broekband die een slag breder is dan de broek eronder
  bekken: () => samen([
    doosGeo(0.335, 0.19, 0.205, 0, 0, 0, 0, 0.045),
    doosGeo(0.352, 0.042, 0.215, 0, 0.085, 0, 0, 0.018),
  ], 0.06),
  nek: () => samen([new THREE.CylinderGeometry(0.055, 0.068, 0.10, 12)], 0.08),
  /*
   Hoofd met een neus, oren, een kaak en een kin. De bol alleen was een
   biljartbal; met de neus en de oren erbij werd het een hoofd, maar van opzij
   bleef het een bal met dingen erop. Een kaaklijn die naar de kin toe smaller
   wordt is wat je van een mens herkent, ook op tien meter. Nu glad (een bol van
   16 × 12 in plaats van 10 × 8, met zijn eigen normalen) en met een gezicht op
   het doek.
  */
  hoofd: () => {
    const kop = new THREE.SphereGeometry(MAAT.hoofdR, 14, 9);
    kop.scale(1.0, 1.13, 1.06);
    const delen = [
      kop,
      new THREE.SphereGeometry(1, 6, 4).scale(0.014, 0.021, 0.020).rotateX(-0.25).translate(0, -0.016, -0.110),   // neus
      // kaak en kin als ellipsoïden: als dozen stond er een witte baard onder
      // het gezicht, ook met ronde randen
      // (de kaak ligt vóór binnen de bol: stak hij erbuiten, dan tekende de
      // snijlijn een lichte rand om het gezicht)
      new THREE.SphereGeometry(1, 10, 6).scale(0.074, 0.048, 0.074).translate(0, -0.080, -0.006),   // kaak
      new THREE.SphereGeometry(1, 8, 5).scale(0.036, 0.022, 0.040).translate(0, -0.106, -0.050),   // kin
    ];
    for (const sx of [-1, 1]) delen.push(new THREE.SphereGeometry(1, 6, 4).scale(0.009, 0.025, 0.017).translate(sx * 0.109, 0.005, 0.008));   // oren
    return samen(delen, 0.08, true);
  },
  /*
   Ogen, als eigen onderdeel omdat ze een andere kleur hebben dan de huid — bij
   de voetgangers is elk onderdeel één instanced mesh met één kleur. Twee
   donkere ovaaltjes, meer niet, en het is het verschil tussen een pop en iemand
   die je aankijkt.

   Er zaten eerst wenkbrauwen bij. Die liepen op deze afstand met de ogen samen
   tot één donkere band over het gezicht — een blinddoek. Weg dus; twee kleine
   ogen doen het werk (de wenkbrauwen zitten nu, dun, in het doek van het hoofd).
  */
  ogen: () => {
    const delen = [];
    for (const sx of [-1, 1]) {
      const oog = new THREE.SphereGeometry(0.0095, 6, 4);
      oog.scale(1.25, 0.8, 0.55); oog.translate(sx * 0.045, 0.008, -0.1055);
      delen.push(oog);
    }
    return samen(delen, 0.05);
  },
  /*
   Kapsel: een kruin plus een stukje in de nek. De kruin liep tot op de ooglijn
   en dat las als een helm; hij houdt nu hoger op, zodat er voorhoofd overblijft.
  */
  /*
   Nu één ronde kap: rondom tot boven het voorhoofd, en aan de achterkant (een
   boog van 130 graden om +z) verder omlaag tot in de nek. Het achterhoofd en de
   nek waren twee afgeronde blokjes, en van achteren lazen die als een zwarte
   band met twee bolletjes over het hoofd.
  */
  haar: () => {
    const kruin = new THREE.SphereGeometry(0.119, 16, 7, 0, Math.PI * 2, 0, Math.PI * 0.44);
    const achter = new THREE.SphereGeometry(0.119, 12, 4, Math.PI / 2 - 1.15, 2.3, Math.PI * 0.44, Math.PI * 0.26);
    for (const g of [kruin, achter]) g.scale(1.0, 1.08, 1.06);
    return samen([kruin, achter], 0.06);
  },
  bovenarm: () => samen(ledGeo(0.048, 0.042, MAAT.bovenarm), 0.05),
  onderarm: () => samen(ledGeo(0.042, 0.034, MAAT.onderarm, { eind: true }), 0.05),
  // hand met een duim en de vingers als één ronde want, iets gebogen
  hand: () => {
    // (ellipsoïden in plaats van afgeronde dozen: een hand is klein, en bij
    // honderddertig voetgangers telt elke driehoek twee keer)
    const duim = new THREE.CapsuleGeometry(0.013, 0.030, 2, 6);
    duim.rotateZ(0.5); duim.translate(-0.036, -0.034, 0.004);
    return samen([
      new THREE.SphereGeometry(1, 8, 6).scale(0.036, 0.036, 0.022).translate(0, -0.032, 0),                 // handpalm
      new THREE.SphereGeometry(1, 8, 6).scale(0.033, 0.030, 0.019).rotateX(0.30).translate(0, -0.074, -0.006),   // vingers
      duim,
    ], 0.07);
  },
  bovenbeen: () => samen(ledGeo(0.074, 0.060, MAAT.bovenbeen, { dz: 1.08 }), 0.06),
  onderbeen: () => samen(ledGeo(0.060, 0.046, MAAT.onderbeen, { dz: 1.05, eind: true }), 0.06),
  // schoen: hangt aan de enkel en steekt naar voren uit
  schoen: () => samen([
    doosGeo(0.108, MAAT.schoenH, 0.235, 0, -MAAT.schoenH / 2, -0.045, 0, 0.030),
    doosGeo(0.098, 0.060, 0.10, 0, -0.012, 0.020, 0, 0.026),        // hiel en wreef, tot aan de enkel
    doosGeo(0.114, 0.022, 0.245, 0, -MAAT.schoenH + 0.008, -0.048, 0, 0.010),   // zool, iets breder
  ], 0.08),
  // pet met klep, in plaats van haar
  pet: () => samen([
    new THREE.SphereGeometry(0.122, 16, 6, 0, Math.PI * 2, 0, Math.PI * 0.5),
    doosGeo(0.245, 0.026, 0.244, 0, 0.006, 0, 0, 0.012),
    doosGeo(0.185, 0.020, 0.115, 0, 0.000, -0.155, 0, 0.009),       // klep
  ], 0.05),
  /*
   Veiligheidsvest over de romp: een bak om de borst plus twee schouderbanden.
   Hij is een fractie ruimer dan de borstkas zelf (0,245 tegen 0,225 diep), zodat
   hij er netjes overheen valt en er geen vlakken door elkaar heen flikkeren.
  */
  vest: () => {
    // dezelfde vorm als de romp, een centimeter ruimer, van de taille tot de
    // schouders (daarboven is de hals vrij)
    const ringen = ROMP.filter(([y]) => y > -0.05 && y < 0.24).map(([y, bx, bz]) => [y, bx + 0.012, bz + 0.012]);
    return samen([lijfGeo(ringen)], 0.05);
  },
};

/*
 Hoe staan de gewrichten bij een gegeven pas?

   fase   loopt door met de tijd; één hele slag is twee stappen
   loopt  false = stilstaan, dan hangen de armen en staan de benen recht
   ren    0..1, hoe hard: rennen zwaait verder en buigt de knie meer

 Alle hoeken zijn draaiingen om de x-as van het lichaam (positief = naar voren).
 Een knie kan maar één kant op, dus die krijgt alleen een positieve buiging als
 het onderbeen naar achteren zwaait — anders knikt hij de verkeerde kant uit.
*/
export function loopHouding(fase, loopt, ren = 0, uit = {}, klok = 0) {
  const zw = loopt ? 0.38 + ren * 0.26 : 0;
  const s = Math.sin(fase), c = Math.cos(fase);
  uit.heupL = s * zw;
  uit.heupR = -s * zw;
  // knie: buigt als het been naar achteren gaat en bij het opzwaaien
  uit.knieL = loopt ? Math.max(0, -s) * (0.55 + ren * 0.55) + Math.max(0, -c) * 0.25 : 0.03;
  uit.knieR = loopt ? Math.max(0, s) * (0.55 + ren * 0.55) + Math.max(0, c) * 0.25 : 0.03;
  /*
   De enkel. Hij volgde alleen de knie, en daardoor stond de voet het hele
   rondje in dezelfde stand — alsof je op planken loopt. Een pas heeft twee
   momenten die je ziet: de hiel komt als eerste neer (voet omhoog), en aan het
   eind zet je af met de teen (voet omlaag). Dat is één sinus, een kwartslag
   verschoven ten opzichte van de heup.
  */
  const afzet = loopt ? (0.30 + ren * 0.22) : 0;
  uit.enkelL = -uit.knieL * 0.35 + c * afzet;
  uit.enkelR = -uit.knieR * 0.35 - c * afzet;
  // armen tegengesteld aan de benen, met een elleboog die altijd wat gebogen is
  const az = loopt ? 0.34 + ren * 0.30 : 0;
  uit.schouderL = -s * az;
  uit.schouderR = s * az;
  uit.elleboogL = 0.15 + (loopt ? Math.max(0, -s) * (0.45 + ren * 0.5) : 0);
  uit.elleboogR = 0.15 + (loopt ? Math.max(0, s) * (0.45 + ren * 0.5) : 0);
  /*
   En het lichaam zakt. Wie een stap zet staat met gespreide benen lager dan wie
   rechtop staat — sla je dat over, dan zweven de voeten bij elke pas een paar
   centimeter boven de stoep. De zak is de hoogte die het gestrekte been
   verliest, iets afgezwakt omdat de knie de rest opvangt.
  */
  const been = MAAT.bovenbeen + MAAT.onderbeen;
  uit.wip = loopt ? -been * (1 - Math.cos(zw * Math.abs(s))) * 0.85 : 0;

  /*
   Wat er tot nu toe ontbrak: het lichaam zelf deed niet mee. Armen en benen
   zwaaiden, maar de romp stond er kaarsrecht en doodstil bij, en dat is waarom
   iedereen eruitzag als een marionet.

     romp    voorover hellen. Wie rent hangt vooruit; wie stilstaat staat een
             fractie voorover, want kaarsrecht staat niemand;
     rol     de zijwaartse slinger. Bij elke pas valt je gewicht op één been en
             helt je bovenlichaam een graad of twee die kant op — twee keer per
             hele slag, dus op het dubbele van de pasfrequentie;
     hoofd   tegendraai, zodat het hoofd waterpas blijft terwijl de romp helt.
             Dat doet een mens vanzelf: je ogen willen stil staan;
     armZij  de armen hangen niet plat tegen de romp maar een paar graden naar
             buiten, en bij het rennen verder.

   Staat hij stil, dan staat hij niet stíl: `klok` (de tijd in seconden) laat
   hem ademen en langzaam van het ene op het andere been wisselen. Een rij
   mensen die allemaal bevroren staan te wachten is net zo verkeerd als een rij
   die allemaal precies gelijk loopt.
  */
  if (loopt) {
    uit.romp = 0.035 + ren * 0.16;
    uit.rol = Math.sin(fase * 2 + Math.PI / 2) * (0.022 + ren * 0.030);
    uit.armZij = 0.07 + ren * 0.07;
    uit.wip += Math.abs(c) * (0.004 + ren * 0.010);
  } else {
    const adem = Math.sin(klok * 1.7);
    uit.romp = 0.020 + adem * 0.008;
    uit.rol = Math.sin(klok * 0.45) * 0.035;
    uit.armZij = 0.06;
    uit.wip = adem * 0.007;
    // en de armen hangen niet als twee stokken stil
    uit.schouderL = Math.sin(klok * 0.45 + 0.4) * 0.035;
    uit.schouderR = -uit.schouderL;
  }
  uit.hoofd = -uit.romp * 0.8;
  return uit;
}

/*
 Fietsen: de benen draaien rondjes op de trappers en de armen liggen vooruit op
 het stuur. De romp helt naar voren (dat regelt de aanroeper met `tilt`).
*/
export function fietsHouding(fase, uit = {}) {
  uit.romp = 0; uit.rol = 0; uit.hoofd = 0; uit.armZij = 0.10;
  const s = Math.sin(fase), c = Math.cos(fase);
  uit.heupL = 1.05 + s * 0.42;
  uit.heupR = 1.05 - s * 0.42;
  uit.knieL = 0.85 + c * 0.50;
  uit.knieR = 0.85 - c * 0.50;
  uit.enkelL = -0.25; uit.enkelR = -0.25;
  /*
   De armen naar het stuur. Schouder 1,26 rad en elleboog 0,34: de hand komt dan
   uit op zo'n 0,44 m vóór en 0,36 m onder de schouder, en daar ligt het stuur
   van de fiets in js/npc.js. Op 1,05 bleef de hand er een kwart meter vandaan
   en stak de arm er als een plank naast.
  */
  uit.schouderL = 1.26; uit.schouderR = 1.26;
  uit.elleboogL = 0.34; uit.elleboogR = 0.34;
  // de handen staan op stuurbreedte uit elkaar, niet tegen de romp aan
  uit.armZij = 0.16;
  uit.wip = 0;
  return uit;
}

/*
 Gebukt lopen. `mate` loopt van 0 (rechtop) tot 1 (zo diep als het gaat): de
 heupen zakken, de knieën buigen mee en het bovenlichaam helt naar voren, zodat
 je achter een muurtje of een auto past. De armen komen wat naar voren, want met
 twee slingerende armen naast je lichaam zie je er niet uit als iemand die zich
 verstopt.

 Levert terug hoeveel het lichaam zakt (in meters, bij schaal 1): de aanroeper
 zet de heup en de camera daarmee lager.
*/
export const HURK_HEUP = 1.45, HURK_KNIE = 2.15;
export function hurkHouding(uit, mate = 1) {
  const m = Math.max(0, Math.min(1, mate));
  if (!m) return 0;
  const h = m * HURK_HEUP, k = m * HURK_KNIE;
  uit.heupL += h; uit.heupR += h;
  uit.knieL += k; uit.knieR += k;
  // de voet blijft plat op de grond staan: de enkel maakt de knik goed
  uit.enkelL += k - h; uit.enkelR += k - h;
  uit.schouderL += m * 0.30; uit.schouderR += m * 0.30;
  uit.elleboogL += m * 0.55; uit.elleboogR += m * 0.55;
  uit.romp = (uit.romp || 0) + m * 0.26;
  uit.hoofd = -(uit.romp || 0) * 0.8;
  uit.armZij = (uit.armZij || 0) + m * 0.05;
  /*
   Hoeveel de heup zakt, uitgerekend en niet geschat: het bovenbeen staat onder
   `h` uit het lood en het onderbeen onder `h − k`, dus wat er van de beenlengte
   in hoogte overblijft is de som van die twee cosinussen. Volledig gehurkt is
   dat achtenveertig centimeter — precies zoveel als een mens zakt.
  */
  const staand = MAAT.bovenbeen + MAAT.onderbeen;
  const zak = staand - (MAAT.bovenbeen * Math.cos(h) + MAAT.onderbeen * Math.cos(h - k));
  uit.wip = (uit.wip || 0) - zak;
  return zak;
}

/** Houding voor wie met twee handen een wapen vooruit houdt. */
export function mikHouding(uit = {}) {
  uit.schouderL = 1.42; uit.schouderR = 1.48;
  uit.elleboogL = 0.55; uit.elleboogR = 0.30;
  return uit;
}
