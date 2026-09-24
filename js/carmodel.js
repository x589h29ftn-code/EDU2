/*
 Automodellen, samengevoegd per materiaal zodat een auto weinig draw calls kost.
 Er staan er 329 geparkeerd in de wijk, dus elke extra mesh per auto telt zwaar
 mee; de vorm mag daarentegen zoveel driehoeken hebben als hij nodig heeft,
 want de geometrie wordt per soort maar één keer gemaakt en daarna gedeeld.

 Vandaar twee uitvoeringen:

   stil       zeven meshes: lak, glas, zwart (met de banden erin), chroom (met
              de naafdoppen erin), koplampen, achterlichten en de kentekenplaat.
              Dat is de auto zoals hij geparkeerd staat.
   animatie   de wielen zitten los in eigen groepjes, zodat de voorwielen kunnen
              sturen en alle vier kunnen rollen; de carrosserie hangt in een
              tussengroep die kan overhellen in de bocht en duiken bij het
              remmen; en er zijn losse rem- en achteruitrijlichten. Die krijgt
              alleen de auto waar je in stapt (zie js/vehicles.js).
*/
import * as THREE from 'three';
import { maakAutoBinnen } from './autobinnen.js';

function merge(parts) {
  const pos = [], nor = [], uv = [];
  for (const { geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 } of parts) {
    const g = geo.clone();
    if (rx || ry || rz) g.rotateX(rx), g.rotateY(ry), g.rotateZ(rz);
    g.translate(x, y, z);
    const ng = g.index ? g.toNonIndexed() : g;
    pos.push(...ng.attributes.position.array);
    nor.push(...ng.attributes.normal.array);
    if (ng.attributes.uv) uv.push(...ng.attributes.uv.array); else for (let i = 0; i < ng.attributes.position.count; i++) uv.push(0, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
const doos = (b, h, d) => new THREE.BoxGeometry(b, h, d);
/*
 Een doos met afgeronde randen (ronde van 24 sep 2026: "kan je de auto's
 realistischer maken"). De carrosserie bestond uit scherpe dozen, en op lak zie
 je dat het eerst: een scherpe rand vangt geen licht, dus elke hoek was een
 harde lijn tussen twee egale vlakken. Met een straal van een paar centimeter
 loopt de glans over de schouder van de auto heen, zoals bij echt plaatwerk.

 Dezelfde omzetting als in js/wapen.js (RoundedBoxGeometry uit de voorbeelden
 van three.js): een doos van (2·seg+1)³ vakjes waarvan de buitenste de
 afronding worden, met de normaal vanaf de binnendoos. `userData.doos` houdt de
 maat bij, zodat `autoOnderdelen` hem net als een gewone doos kan narekenen.
*/
function rdoos(b, h, d, r, seg = 1) {
  r = Math.max(0.001, Math.min(r, b / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
  const s = seg * 2 + 1;
  const geo = new THREE.BoxGeometry(1, 1, 1, s, s, s).toNonIndexed();
  const P = geo.attributes.position, N = geo.attributes.normal;
  const half = 0.5 / s, bx = b / 2 - r, by = h / 2 - r, bz = d / 2 - r;
  const n = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    n.set(x - Math.sign(x) * half, y - Math.sign(y) * half, z - Math.sign(z) * half).normalize();
    P.setXYZ(i, bx * Math.sign(x) + n.x * r, by * Math.sign(y) + n.y * r, bz * Math.sign(z) + n.z * r);
    N.setXYZ(i, n.x, n.y, n.z);
  }
  geo.userData.doos = { width: b, height: h, depth: d };
  return geo;
}

/*
 De band. Een cilinder is een blok met een scherpe rand, en dat is het eerste
 wat opvalt aan een wiel van speelgoed. Dit is het profiel van een echte band,
 rondgedraaid: de wang loopt van de velgrand naar buiten, de schouder is rond en
 het loopvlak recht. Binnenin een donkere schijf (de remschijf en de naaf), zodat
 je tussen de spaken door niet dwars door het wiel kijkt.
*/
function bandGeo(R, breed, rond = 22) {
  const w = breed / 2;
  const profiel = [
    [R * 0.66, -w], [R * 0.86, -w - 0.004], [R * 0.95, -w + 0.012], [R * 0.99, -w + 0.035],
    [R, -w + 0.06], [R, w - 0.06], [R * 0.99, w - 0.035], [R * 0.95, w - 0.012], [R * 0.86, w + 0.004], [R * 0.66, w],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const band = new THREE.LatheGeometry(profiel, rond);
  band.rotateZ(Math.PI / 2);
  const schijf = new THREE.CylinderGeometry(R * 0.67, R * 0.67, breed * 0.7, rond);
  schijf.rotateZ(Math.PI / 2);
  const delen = [band, schijf].map(g => g.index ? g.toNonIndexed() : g);
  const pos = [], nor = [];
  for (const g of delen) { pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pos.length / 3 * 2).fill(0), 2));
  return geo;
}

/*
 Doeken voor de lampen en het kenteken, op canvas zoals alles in dit spel. Een
 koplamp was een wit blok dat oplichtte; nu zit er een behuizing in met twee
 reflectoren en een dagrijlicht eronder, en licht alleen het glas op (de
 emissiveMap is hetzelfde doek: donker wat niet licht). Een achterlicht heeft
 ribbels in het rode glas. En het kenteken is een geel Nederlands kenteken met
 de blauwe EU-strook — het detail waar je een auto in Sneek aan herkent.
*/
function doekVan(w, h, teken) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  teken(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const rondeRechthoek = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
let _kop = null, _achter = null, _plaat = null;
function kopDoek() {
  return _kop || (_kop = doekVan(256, 96, (g, W, H) => {
    g.fillStyle = '#15181b'; g.fillRect(0, 0, W, H);
    rondeRechthoek(g, 6, 6, W - 12, H - 12, 18); g.fillStyle = '#8d949b'; g.fill();
    for (const cx of [W * 0.3, W * 0.68]) {
      const gr = g.createRadialGradient(cx, H * 0.45, 2, cx, H * 0.45, H * 0.36);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, '#f4f1e6'); gr.addColorStop(0.8, '#9aa2aa'); gr.addColorStop(1, '#4a5056');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, H * 0.45, H * 0.34, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#fbfbff'; rondeRechthoek(g, 22, H - 22, W - 44, 8, 4); g.fill();   // dagrijlicht
  }));
}
function achterDoek() {
  return _achter || (_achter = doekVan(256, 128, (g, W, H) => {
    g.fillStyle = '#2a0506'; g.fillRect(0, 0, W, H);
    rondeRechthoek(g, 8, 8, W - 16, H - 16, 14); g.fillStyle = '#b01414'; g.fill();
    for (let y = 14; y < H - 14; y += 9) { g.fillStyle = 'rgba(255,120,110,0.28)'; g.fillRect(14, y, W - 28, 3); }
    g.fillStyle = 'rgba(255,90,80,0.55)'; rondeRechthoek(g, 26, 30, W * 0.46, H - 60, 10); g.fill();
  }));
}
function plaatDoek() {
  return _plaat || (_plaat = doekVan(256, 56, (g, W, H) => {
    g.fillStyle = '#f2c400'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#111'; g.lineWidth = 3; g.strokeRect(2, 2, W - 4, H - 4);
    g.fillStyle = '#1c3f9a'; g.fillRect(3, 3, 26, H - 6);
    g.fillStyle = '#f2c400';
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.fillRect(16 + Math.cos(a) * 7 - 1, 17 + Math.sin(a) * 7 - 1, 2, 2); }
    g.fillStyle = '#ffffff'; g.font = 'bold 14px sans-serif'; g.textAlign = 'center'; g.fillText('NL', 16, H - 9);
    g.fillStyle = '#111'; g.font = 'bold 36px sans-serif'; g.textBaseline = 'middle';
    g.fillText('GT-481-S', W / 2 + 14, H / 2 + 2);
  }));
}

// Een wielkast: een halve ring die om het wiel heen staat, in de lengterichting
// van de auto. Dat is wat een auto van een schoenendoos onderscheidt.
/*
 Een velg met spaken in plaats van een gladde schijf. De naaf was een cilinder
 van acht kanten: van dichtbij een blikken dop. Dit is een rand, een naafje in
 het midden en vijf spaken ertussen — bij elkaar een stuk of honderdvijftig
 driehoeken, en die geometrie wordt door álle auto's gedeeld.
*/
function naafGeo(R) {
  const delen = [];
  /*
   De velg zit aan de buitenkant van de band, niet in het midden ervan: een band
   is 22 cm breed, dus een schijf op x = 0 verdwijnt erin. Daarom twee keer
   hetzelfde, op ±11,5 cm — dan zie je hem aan allebei de kanten van de auto.
  */
  for (const xs of [-1, 1]) {
    const rand = new THREE.CylinderGeometry(R * 0.64, R * 0.64, 0.030, 12);
    rand.rotateZ(Math.PI / 2); rand.translate(xs * 0.112, 0, 0); delen.push(rand);
    const naaf = new THREE.CylinderGeometry(R * 0.20, R * 0.20, 0.045, 8);
    naaf.rotateZ(Math.PI / 2); naaf.translate(xs * 0.118, 0, 0); delen.push(naaf);
    for (let i = 0; i < 5; i++) {
      const sp = new THREE.BoxGeometry(0.026, R * 0.58, 0.050);
      sp.translate(0, R * 0.31, 0);
      sp.rotateX(i * Math.PI * 2 / 5);
      sp.translate(xs * 0.110, 0, 0);
      delen.push(sp);
    }
  }
  const pos = [], nor = [];
  for (const g of delen) {
    const ng = g.index ? g.toNonIndexed() : g;
    pos.push(...ng.attributes.position.array);
    nor.push(...ng.attributes.normal.array);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pos.length / 3 * 2).fill(0), 2));
  return geo;
}

/*
 Een holle koker in plaats van een massieve doos.

 De carrosserie was opgebouwd uit dichte blokken die over de hele lengte liepen:
 de flank, de schouderlijn, bij de bakwagen de hele cabine. Van buiten klopt dat
 precies, maar zodra de camera erín zit (js/autobinnen.js) kijk je tegen de
 bovenkant van zo'n blok aan — een rode vlakte waar het interieur hoort te
 zitten. Daarom wordt het middenstuk eruit gehaald: er blijven twee zijwanden
 over plus een vulling vóór en áchter de cabine. Van buiten zie je exact
 hetzelfde, want de buitenvlakken liggen op precies dezelfde plek.

 `gat0`/`gat1` is het stuk in de lengte dat open moet blijven.
*/
function holleKoker(b, h, d, x, y, z, wand, gat0, gat1, rond = 0) {
  const uit = [];
  const z0 = z - d / 2, z1 = z + d / 2;
  const blok = (bb, hh, dd) => rond ? rdoos(bb, hh, dd, rond) : doos(bb, hh, dd);
  for (const sx of [-1, 1]) uit.push({ geo: blok(wand, h, d), x: x + sx * (b / 2 - wand / 2), y, z });
  if (gat0 > z0 + 0.02) {
    const len = gat0 - z0;
    uit.push({ geo: blok(b, h, len), x, y, z: z0 + len / 2 });
  }
  if (gat1 < z1 - 0.02) {
    const len = z1 - gat1;
    uit.push({ geo: blok(b, h, len), x, y, z: gat1 + len / 2 });
  }
  return uit;
}

function wielkast(R) {
  const g = new THREE.TorusGeometry(R + 0.07, 0.05, 4, 10, Math.PI);
  g.rotateY(Math.PI / 2);
  return g;
}

const GEO = {};

// Bakwagen: chassis met cabine voorop en een gesloten laadbak erachter. Zeven
// meter lang, dus hij rijdt en botst anders dan een auto (zie vehicles.js).
function truckGeoms() {
  const L = 7.2, W = 2.35, R = 0.45;      // lengte, breedte, wielradius
  const cabZ = -L / 2 + 1.15, bakZ = 1.0;
  /*
   Het chassis was W − 0,1 = 2,25 m breed en liep over de volle lengte, terwijl
   de wielen op x = ±1,00 staan met een band van 0,30 breed: zevenentwintig van
   de dertig centimeter band zat ín het chassis, en dat zag je van opzij als een
   halve band. Een echte bakwagen heeft een ladderchassis dat smaller is dan de
   spoorbreedte, met de wielen ernaast.
  */
  const chassisB = 2 * (W / 2 - 0.18) - 0.34;                     // 1,66 m: tussen de banden
  const paintDelen = [
    { geo: doos(chassisB, 0.40, L), y: 0.60 },                    // chassis (loopt door tot ín de cabine)
    /*
     De cabine is hol: daar zit de bestuurder in (js/autobinnen.js).

     Het gat liep van cabZ − 0,92 tot cabZ + 0,80, en dat is de zijkant. Vóór dat
     gat zette `holleKoker` een dichte wand van cabZ − 1,05 tot cabZ − 0,92, over
     de volle hoogte van de koker (0,80 tot 2,25 m). Precies daar zit de
     voorruit. Van buiten zie je er niets van, want het glas ligt ervoor; van
     binnen keek je er recht tegenaan en zag je de weg niet (melding 19 sep
     2026: "first person view in vrachtwagen van de missie zie je buiten niet").

     Het gat loopt nu tot voorbij de voorkant door, zodat `holleKoker` daar geen
     wand meer zet, en het stuk plaatwerk ónder de voorruit — van de cabinevloer
     tot de onderdorpel op 1,55 m — staat er los achteraan. Boven de ruit zit het
     cabinedak al.
    */
    ...holleKoker(W, 1.45, 2.1, 0, 1.52, cabZ, 0.12, cabZ - 1.06, cabZ + 0.80, 0.05),
    { geo: doos(W, 0.64, 0.13), y: 1.23, z: cabZ - 0.985 },       // plaatwerk onder de voorruit
    { geo: rdoos(W, 0.10, 2.1, 0.045), y: 2.20, z: cabZ },        // cabinedak
    { geo: doos(W, 0.12, 2.1), y: 0.85, z: cabZ },                // cabinevloer
    { geo: rdoos(W - 0.14, 0.3, 1.9, 0.10), y: 2.35, z: cabZ + 0.05 },   // dakspoiler
    { geo: rdoos(W, 2.3, 4.8, 0.035), y: 2.15, z: bakZ },         // laadbak
    { geo: doos(W + 0.06, 0.12, 4.8), y: 3.32, z: bakZ },         // dakrand
    // spiegels: op W/2 + 0,12 hingen ze twee centimeter naast de cabine
    { geo: doos(0.2, 0.1, 0.14), x: -W / 2 - 0.06, y: 1.9, z: cabZ - 0.9 },
    { geo: doos(0.2, 0.1, 0.14), x: W / 2 + 0.06, y: 1.9, z: cabZ - 0.9 },
  ];
  const paint = merge(paintDelen);
  const glasDelen = [
    { geo: doos(W - 0.22, 0.8, 0.06), y: 1.95, z: cabZ - 1.03 },  // voorruit
    { geo: doos(0.06, 0.65, 1.1), x: -W / 2 + 0.02, y: 1.9, z: cabZ + 0.2 },
    { geo: doos(0.06, 0.65, 1.1), x: W / 2 - 0.02, y: 1.9, z: cabZ + 0.2 },
  ];
  const glass = merge(glasDelen);
  const wielGeo = bandGeo(R, 0.3);
  const hubGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.32, 12); hubGeo.rotateZ(Math.PI / 2);
  const wielen = [
    { x: -W / 2 + 0.18, z: cabZ + 0.1, stuur: true }, { x: W / 2 - 0.18, z: cabZ + 0.1, stuur: true },
    { x: -W / 2 + 0.18, z: 1.5 }, { x: W / 2 - 0.18, z: 1.5 },
    { x: -W / 2 + 0.18, z: 2.6 }, { x: W / 2 - 0.18, z: 2.6 },
  ];
  const zwartVast = [
    { geo: rdoos(W + 0.04, 0.24, 0.22, 0.06), y: 0.5, z: -L / 2 + 0.05 },
    { geo: rdoos(W + 0.04, 0.24, 0.22, 0.06), y: 0.62, z: L / 2 - 0.05 },
    // grille en lampen zaten vóór de cabine in de lucht: die begint pas op
    // cabZ − 1,05 = −3,50 en de grille stond op −3,61
    // grille smaller dan de koplampen (die staan op x ±0,75, 0,4 breed, dus van
    // ±0,55 tot ±0,95): op 1,2 m breed liep hij er vijf centimeter in, en daar
    // flikkerden de twee vlakken over elkaar heen
    { geo: doos(1.0, 0.5, 0.14), y: 1.0, z: -L / 2 + 0.06 },      // grille
    { geo: doos(0.16, 0.16, 0.5), x: -W / 2 + 0.3, y: 0.42, z: L / 2 - 0.6 },   // uitlaat
  ];
  // wielkasten, net als bij de personenauto: zonder die ring loopt de band zo de
  // cabine en de laadbak in
  const kastT = wielkast(R);
  for (const w of wielen) zwartVast.push({ geo: kastT, x: Math.sign(w.x) * (W / 2 + 0.01), y: R, z: w.z });
  const lampen = [];
  // zelfde reden als bij de personenauto: ondiep en net aan uitstekend
  const koplampen = [
    { geo: doos(0.4, 0.2, 0.05), x: -0.75, y: 0.78, z: -L / 2 + 0.055 },
    { geo: doos(0.4, 0.2, 0.05), x: 0.75, y: 0.78, z: -L / 2 + 0.055 },
  ];
  lampen.push(...koplampen);
  const head = merge(koplampen);
  /*
   De achterkant van de laadbak ligt op bakZ + 2,4 = 3,40 en niet op L/2 = 3,60:
   de lichten hingen twintig centimeter achter de wagen in de lucht. De
   kentekenplaat zat juist ín de bumper en was dus onzichtbaar.
  */
  const zBak = bakZ + 2.4;
  const achter = [
    { geo: doos(0.34, 0.18, 0.06), x: -0.85, y: 1.05, z: zBak + 0.02 },
    { geo: doos(0.34, 0.18, 0.06), x: 0.85, y: 1.05, z: zBak + 0.02 },
  ];
  const platen = [{ geo: doos(0.5, 0.11, 0.02), y: 0.72, z: L / 2 - 0.05 + 0.12 }];
  lampen.push(...platen, ...achter);
  const plate = merge(platen);
  const rem = merge(achter.map(a => ({ ...a, z: a.z + 0.01 })));
  const achteruit = merge([
    { geo: doos(0.2, 0.14, 0.06), x: -0.45, y: 1.05, z: zBak + 0.03 },
    { geo: doos(0.2, 0.14, 0.06), x: 0.45, y: 1.05, z: zBak + 0.03 },
  ]);
  // oogpunt van de bestuurder: net vóór de voorruit, zodat je niet door twee
  // getinte glasplaten naar buiten kijkt (zie js/main.js)
  // in de cabine, vlak achter de voorruit: de cabine is één doos, dus vanbinnen
  // zie je er niets van en heb je vrij zicht over de weg
  const oog = { x: -(W / 2 - 0.6), y: 1.82, z: cabZ + 0.10 };
  const delen = [
    ...paintDelen.map(d => ({ ...d, groep: 'lak' })),
    ...glasDelen.map(d => ({ ...d, groep: 'glas' })),
    ...zwartVast.map(d => ({ ...d, groep: 'zwart' })),
    ...lampen.map(d => ({ ...d, groep: 'licht' })),
  ];
  return { paint, glass, zwartVast, chroomVast: [], head, tail: merge(achter), rem, achteruit, plate,
    wielGeo, hubGeo, wielen, R, L, W, oog, delen,
    // de maten van de cabine zoals hij er werkelijk staat: vloer op 0,91, de
    // onderkant van de voorruit op 1,55 en het dak op 2,15
    maat: { L, W, R, dakY: 2.15, schouderY: 1.52, flankY: 1.2, dorpelY: 0.79, cabZ, cabL: 2.1,
      aHoek: 0.30, stijlH: 1.0, oog, truck: true } };
}

/*
 Personenauto. De vorm is opgebouwd uit lagen die naar boven toe smaller worden
 — dorpel, flank, schouderlijn, motorkap, kofferklep en dak — met schuine
 stijlen ertussen en wielkasten om de wielen. Daardoor heeft hij een taille en
 een aflopende neus in plaats van de rechte doos van hiervoor.
*/
function autoGeoms(kind) {
  const bus = kind === 'van';
  /*
   De Citroën BX uit missie 6 (js/verhaal.js). Het is geen ander model maar
   dezelfde opbouw met andere maten: 4,23 × 1,69 m op een wielbasis van 2,65
   (de echte maten), een lager dak, een langere ruitpartij en een scherpere
   neus — de wig waar een BX aan te herkennen is. Alles wat hieronder van deze
   getallen wordt afgeleid — stijlen, ruiten, bumpers, lampen — schuift vanzelf
   mee.
  */
  const bx = kind === 'bx';
  let L = bus ? 5.20 : 4.30, W = bus ? 1.90 : 1.78, R = bus ? 0.35 : 0.32;
  let wielZ = bus ? 1.62 : 1.32;

  // hoogtes: dorpel → flank → schouder → dak
  let flankY = bus ? 1.02 : 0.72, flankH = bus ? 0.84 : 0.30;
  let schouderY = bus ? 1.50 : 0.90;
  let dakY = bus ? 2.02 : 1.40;
  let cabZ = bus ? -0.60 : 0.10;                // midden van de cabine
  let cabL = bus ? 2.30 : 1.95;                 // lengte van de cabine
  let kapL = bus ? 1.00 : 1.55;
  let kontL = bus ? 2.10 : 1.05;
  let kapVoor = bus ? 0.55 : 0.80, kontAchter = bus ? 1.10 : 0.55;
  if (bx) {
    L = 4.23; W = 1.69; R = 0.30; wielZ = 1.325;
    flankY = 0.66; flankH = 0.26;
    /*
     De schouderlijn ligt laag en het dak hoog genoeg om er een echte ruitpartij
     tussen te krijgen: 0,55 m glas tegen 0,50 bij de andere auto's, op een dak
     dat juist láger ligt. Dat is wat een BX zo plat doet lijken.
    */
    schouderY = 0.82; dakY = 1.37;
    cabZ = 0.06; cabL = 2.15;
    kapL = 1.45; kontL = 0.80;
    kapVoor = 0.70; kontAchter = 0.42;
  }
  const wielX = W / 2 - 0.09;
  const dorpelY = 0.30 + R * 0.42;
  const kapZ = -L / 2 + kapVoor;
  const kontZ = L / 2 - kontAchter;

  const lak = [
    /*
     Dorpel. Hij stond op dorpelY en reikte tot 0,569 m, terwijl de flank op
     0,570 begint: een naad van een millimeter over de hele flank, waar je van
     dichtbij dwars doorheen keek. Twee centimeter hoger overlappen ze.
    */
    { geo: rdoos(W - 0.10, R * 0.84, L - 0.34, 0.06), y: dorpelY + 0.02 },          // dorpel
    /*
     Flank en schouderlijn zijn holle kokers: het stuk onder de cabine is eruit,
     zodat er ruimte is voor het interieur (js/autobinnen.js). Van buiten is er
     niets aan veranderd — de buitenvlakken liggen op dezelfde plek.
    */
    ...holleKoker(W, flankH, L - 0.12, 0, flankY, 0, 0.10, cabZ - cabL / 2 + 0.12, cabZ + cabL / 2 - 0.12, 0.045),
    ...holleKoker(W - 0.09, 0.10, L - 0.40, 0, schouderY - 0.05, 0, 0.10, cabZ - cabL / 2 + 0.12, cabZ + cabL / 2 - 0.12, 0.04),
    /*
     Motorkap. Bij de BX loopt hij naar voren af: dat is de wig waar de auto aan
     te herkennen is. Een negatieve kanteling om de x-as zet de voorkant omlaag
     (y' = z·sin θ voor de voorste rand op −z).
    */
    { geo: rdoos(W - 0.20, 0.11, kapL, 0.05), y: schouderY + (bus ? 0.30 : (bx ? -0.02 : 0.02)), z: kapZ, rx: bx ? -0.085 : 0 }, // motorkap
    { geo: rdoos(W - 0.14, 0.20, kontL, 0.07), y: schouderY + 0.09, z: kontZ },     // kofferklep
    /*
     Het dak. Het was W − 0,40 breed (1,38 m) terwijl de zijruiten op ±0,79
     staan: aan weerskanten bleef tien centimeter open, en daar keek je dwars
     door de auto heen. Van schuin voren leek elke auto een cabriolet. Nu sluit
     het dak over de ruiten heen, met een druiplijst langs de dakrand.
    */
    { geo: rdoos(W - (bus ? 0.14 : 0.16), 0.085, cabL - (bus ? 0.10 : 0.52), 0.04), y: dakY, z: cabZ }, // dak
    // spiegels op een steeltje
    { geo: doos(0.09, 0.05, 0.05), x: -W / 2 - 0.05, y: schouderY + 0.16, z: cabZ - cabL / 2 + 0.15 },
    { geo: doos(0.09, 0.05, 0.05), x: W / 2 + 0.05, y: schouderY + 0.16, z: cabZ - cabL / 2 + 0.15 },
    { geo: rdoos(0.17, 0.11, 0.07, 0.03), x: -W / 2 - 0.13, y: schouderY + 0.17, z: cabZ - cabL / 2 + 0.15 },
    { geo: rdoos(0.17, 0.11, 0.07, 0.03), x: W / 2 + 0.13, y: schouderY + 0.17, z: cabZ - cabL / 2 + 0.15 },
  ];
  // stijlen: A schuin naar voren, C schuin naar achteren, B recht in het midden
  const stijlH = dakY - schouderY;
  const aHoek = bus ? 0.34 : (bx ? 0.74 : 0.62), cHoek = bus ? -0.16 : (bx ? -0.40 : -0.50);
  for (const zx of [-1, 1]) {
    const x = zx * (W / 2 - (bus ? 0.10 : 0.075));
    lak.push({ geo: doos(0.09, stijlH + 0.16, 0.10), x, y: (schouderY + dakY) / 2, z: cabZ - cabL / 2 + 0.30 - Math.sin(aHoek) * stijlH / 2, rx: aHoek });
    lak.push({ geo: doos(0.09, stijlH + 0.14, 0.12), x, y: (schouderY + dakY) / 2, z: cabZ + cabL / 2 - 0.24 - Math.sin(cHoek) * stijlH / 2, rx: cHoek });
    lak.push({ geo: doos(0.07, stijlH, 0.08), x, y: (schouderY + dakY) / 2, z: cabZ + (bus ? 0.30 : 0.18) });
  }
  if (!bus) lak.push({ geo: doos(W - 0.55, 0.05, 0.16), y: dakY + 0.02, z: cabZ + cabL / 2 - 0.30 });  // dakspoiler

  const glas = [
    // voorruit en achterruit staan schuin tussen de schouderlijn en het dak
    { geo: doos(W - (bus ? 0.24 : 0.42), stijlH / Math.cos(aHoek) + 0.10, 0.05),
      y: (schouderY + dakY) / 2 + 0.03, z: cabZ - cabL / 2 + 0.30 - Math.sin(aHoek) * stijlH / 2, rx: aHoek },
    { geo: doos(W - (bus ? 0.26 : 0.46), stijlH / Math.cos(cHoek) + 0.06, 0.05),
      y: (schouderY + dakY) / 2 + 0.03, z: cabZ + cabL / 2 - 0.24 - Math.sin(cHoek) * stijlH / 2, rx: cHoek },
    // zijruiten
    // De ruit loopt tot ín de schouderlijn en het dak. Hij was stijlH − 0,06 hoog
    // en zweefde daarmee in het portiergat: elf centimeter open boven en onder,
    // waar je dwars de auto in keek.
    { geo: doos(0.05, stijlH + 0.10, cabL - (bus ? 0.35 : 0.85)), x: -W / 2 + 0.045, y: (schouderY + dakY) / 2, z: cabZ + 0.02 },
    { geo: doos(0.05, stijlH + 0.10, cabL - (bus ? 0.35 : 0.85)), x: W / 2 - 0.045, y: (schouderY + dakY) / 2, z: cabZ + 0.02 },
  ];

  const lijstL = 2 * (wielZ - R - 0.05);        // tussen de banden, zie hieronder
  const zwartVast = [
    { geo: rdoos(W + 0.03, 0.24, 0.26, 0.08), y: dorpelY + 0.06, z: -L / 2 + 0.09 },   // bumper voor
    { geo: rdoos(W + 0.03, 0.24, 0.26, 0.08), y: dorpelY + 0.08, z: L / 2 - 0.09 },    // bumper achter
    /*
     Grille, koplampen, achterlichten en kentekenplaten zaten allemaal een paar
     centimeter vóór de carrosserie: de flank is L − 0,12 lang, dus zijn voorkant
     ligt op −L/2 + 0,06, en de grille stond op −L/2 − 0,035. Van schuin voren
     zag je daardoor een zwevend plaatje met daglicht erachter. Ze zitten nu
     allemaal een centimeter ín het plaatwerk.
    */
    /*
     Grille. Hij was W − 0,42 breed (±0,68 m) en lag op precies dezelfde diepte
     als de koplampen, die van ±0,43 tot ±0,83 lopen. Een kwart meter lag dus
     dwars door elkaar heen, met twee vlakken op dezelfde plek: dat flikkerde van
     grille naar lampglas en terug zodra je langs de neus liep — de melding dat
     de voorlampen nog clippen (punt 4 van 13 sep 2026). Nu houdt de grille op
     waar de lampen beginnen (±0,39) en ligt hij een centimeter dieper, zodat er
     ook bij het schuin kijken niets meer samenvalt.
    */
    { geo: doos(W - 1.00, 0.13, 0.05), y: schouderY - 0.13, z: -L / 2 + 0.06 - 0.015 + 0.035 },  // grille, zie de lampen hierboven
    /*
     Sierlijst langs de dorpel. Hij liep eerst over L − 1,5 m = 2,80 m, en de
     wielen staan op z = ±1,32 met een straal van 0,32: de lijst stak dus veertig
     centimeter dwars door beide banden heen. Nu loopt hij alleen tussen de
     wielkasten door.
    */
    // x op W/2 − 0,03: op − 0,01 hing hij vijf millimeter naast de dorpel (die
    // loopt tot W/2 − 0,05) en zat er dus een spleet tussen
    { geo: doos(0.07, 0.13, lijstL), x: -W / 2 + 0.03, y: dorpelY - 0.02 },       // sierlijst dorpel
    { geo: doos(0.07, 0.13, lijstL), x: W / 2 - 0.03, y: dorpelY - 0.02 },
    { geo: doos(0.10, 0.10, 0.24), x: -W / 2 + 0.34, y: dorpelY - 0.02, z: L / 2 + 0.02 },  // uitlaat
  ];
  // portiernaden: twee dunne lijnen per flank
  for (const zx of [-1, 1]) for (const dz of bus ? [-0.15, 1.35] : [-0.62, 0.62]) {
    zwartVast.push({ geo: doos(0.04, flankH + 0.16, 0.035), x: zx * (W / 2 - 0.005), y: flankY + 0.05, z: cabZ + dz });
  }
  // wielkasten rond alle vier de wielen
  const kast = wielkast(R);
  const wielen = [
    { x: -wielX, z: -wielZ, stuur: true }, { x: wielX, z: -wielZ, stuur: true },
    { x: -wielX, z: wielZ }, { x: wielX, z: wielZ },
  ];
  // De kast hoort nét buiten het plaatwerk te staan, anders zit hij erin en zie
  // je hem niet: de flank loopt tot W/2 en de kast stond op wielX + 0,02 = W/2 − 0,07.
  for (const w of wielen) zwartVast.push({ geo: kast, x: Math.sign(w.x) * (W / 2 + 0.01), y: R, z: w.z });

  const chroomVast = [
    { geo: doos(0.11, 0.035, 0.05), x: -W / 2 - 0.01, y: flankY + 0.12, z: cabZ - 0.32 },   // portiergrepen
    { geo: doos(0.11, 0.035, 0.05), x: W / 2 + 0.01, y: flankY + 0.12, z: cabZ - 0.32 },
    { geo: doos(0.11, 0.035, 0.05), x: -W / 2 - 0.01, y: flankY + 0.12, z: cabZ + 0.92 },
    { geo: doos(0.11, 0.035, 0.05), x: W / 2 + 0.01, y: flankY + 0.12, z: cabZ + 0.92 },
    // tankdop op het achterspatbord
    { geo: doos(0.02, 0.115, 0.115), x: W / 2 + 0.005, y: flankY + 0.06, z: kontZ + 0.30 },
  ];

  /*
   De kleine dingen die een auto een auto maken. Ze staan hier apart omdat ze
   allemaal zwart zijn en dus in dezelfde mesh vallen; bij elkaar zijn het een
   paar honderd driehoeken voor het hele wagenpark, want de geometrie wordt
   gedeeld.

     ruitenwissers   twee armen plat op de voorruit, met een blad eraan. Van
                     alle details is dit degene die je het eerst ziet als hij
                     ontbreekt: een auto zonder wissers heeft een spiegel in
                     plaats van een ruit;
     antenne         een staafje op de achterkant van het dak;
     grillelamellen  de grille was één glad vlak; drie horizontale ribbels
                     erover maken er een rooster van;
     vuilrand        een donkere band langs de dorpel en rond de wielkasten.
                     Dat is geen sierlijst maar opspattend vuil van de weg, en
                     het is precies wat elke auto die niet net gewassen is heeft
                     (zie ook de wijk in js/kaartwereld.js).
  */
  if (!bus) {
    /*
     De wissers liggen in hun ruststand op de motorkap, vlak voor de voorruit —
     niet ervoor in de lucht. De kap loopt tot kapZ + kapL/2 en zijn bovenkant
     ligt op schouderY + 0,075; daar liggen ze net bovenop.
    */
    const wisZ = kapZ + kapL / 2 - 0.12;
    for (const sx of [-1, 1]) {
      zwartVast.push({ geo: doos(0.34, 0.018, 0.040), x: sx * 0.30, y: schouderY + 0.080, z: wisZ, rz: sx * 0.10 });
      zwartVast.push({ geo: doos(0.05, 0.030, 0.055), x: sx * 0.16, y: schouderY + 0.075, z: wisZ });
    }
    // antenne achter op het dak
    zwartVast.push({ geo: doos(0.016, 0.34, 0.016), x: -W / 2 + 0.22, y: dakY + 0.17, z: cabZ + cabL / 2 - 0.34 });
  }
  for (let i = 0; i < 3; i++) {
    zwartVast.push({ geo: doos(W - 1.04, 0.016, 0.055), y: schouderY - 0.175 + i * 0.045, z: -L / 2 + 0.06 - 0.015 + 0.030 });
  }
  if (!bus) for (const sx of [-1, 1]) {
    zwartVast.push({ geo: doos(0.030, 0.030, cabL - 0.50), x: sx * (W / 2 - 0.085), y: dakY + 0.035, z: cabZ });
  }
  // vuilrand langs de dorpel: net als de sierlijst alleen tussen de wielkasten
  // door, anders loopt hij dwars door de banden heen
  for (const sx of [-1, 1]) {
    zwartVast.push({ geo: doos(0.035, 0.075, lijstL), x: sx * (W / 2 - 0.015), y: dorpelY - 0.11 });
  }

  const wielGeo = bandGeo(R, 0.22);
  const hubGeo = naafGeo(R);

  const kopY = schouderY - 0.14;
  /*
   Koplampen en achterlichten liggen ín het plaatwerk, met alleen het glas eruit.

   Ze waren tien centimeter diep en stonden met hun hart op de voorkant van de
   flank (−L/2 + 0,06). Daarmee stak er vijf centimeter vóór de auto uit, en van
   schuin voren zag je de zijkanten van dat blokje als een wit tabje naast de
   neus zweven (melding beta-test 12 sep 2026). Nu zijn ze de helft ondieper en
   steken ze nog anderhalve centimeter uit — genoeg om ze te zien, te weinig om
   ze als los blokje te herkennen.

     voorkant flank : −L/2 + 0,060
     voorkant lamp  : −L/2 + 0,045   (1,5 cm ervoor)
     achterkant lamp: −L/2 + 0,095   (3,5 cm erin)
  */
  const lampD = 0.05, lampUit = 0.015;
  const zKop = -L / 2 + 0.06 - lampUit + lampD / 2;
  const zAchter = L / 2 - 0.06 + lampUit - lampD / 2;
  const lampen = [];                       // voor `delen` hieronder
  const koplampen = [
    { geo: rdoos(0.40, 0.15, lampD, 0.02), x: -W / 2 + 0.26, y: kopY, z: zKop },
    { geo: rdoos(0.40, 0.15, lampD, 0.02), x: W / 2 - 0.26, y: kopY, z: zKop },
  ];
  lampen.push(...koplampen);
  const head = merge(koplampen);
  const achter = [
    { geo: doos(0.34, 0.17, lampD), x: -W / 2 + 0.24, y: kopY + 0.06, z: zAchter },
    { geo: doos(0.34, 0.17, lampD), x: W / 2 - 0.24, y: kopY + 0.06, z: zAchter },
  ];
  lampen.push(...achter);
  const rem = merge([
    ...achter.map(a => ({ ...a, z: a.z + 0.012 })),
    { geo: doos(W - 0.60, 0.05, 0.05), y: dakY - 0.05, z: cabZ + cabL / 2 - 0.22 },   // derde remlicht
  ]);
  const achteruit = merge([
    { geo: doos(0.16, 0.11, lampD), x: -W / 2 + 0.60, y: kopY + 0.06, z: zAchter + 0.004 },
    { geo: doos(0.16, 0.11, lampD), x: W / 2 - 0.60, y: kopY + 0.06, z: zAchter + 0.004 },
  ]);
  // op de bumper, niet ervóór: de bumper steekt tot ±(L/2 + 0,04) uit
  const platen = [
    { geo: doos(0.5, 0.11, 0.02), y: dorpelY + 0.16, z: L / 2 + 0.035 },
    { geo: doos(0.5, 0.11, 0.02), y: dorpelY + 0.14, z: -L / 2 - 0.035 },
  ];
  lampen.push(...platen);
  const plate = merge(platen);

  // oogpunt van de bestuurder: net vóór de voorruit en vlak onder de dakrand.
  // Zat de camera op de stoel, dan vulde de voorruit het halve beeld met een
  // grauwe tint en hing de dakrand als een donkere balk in beeld.
  const zVoorruit = cabZ - cabL / 2 + 0.30 - Math.sin(aHoek) * stijlH / 2;
  /*
   Het oogpunt van de bestuurder. Het lag hierboven: vóór de voorruit en vlak
   onder de dakrand, dus eigenlijk bóven de motorkap en buiten de auto. Dat was
   een noodgreep — er wás geen interieur, dus vanaf de stoel keek je door twee
   getinte ruiten naar buiten met de dakrand als donkere balk erboven.

   Sinds js/autobinnen.js er is zit je echt in de auto: achter het stuur, met
   het dashboard voor je en de stijlen naast je. De ooghoogte ligt twintig
   centimeter boven de schouderlijn (1,10 m bij een hatchback), en in de lengte
   een stuk achter de voorruit — precies waar een stoel staat.
  */
  const oog = { x: -(W / 2 - 0.46), y: schouderY + (bus ? 0.42 : 0.27), z: cabZ + 0.04 };
  /*
   `delen` is de lijst dozen waar dit model uit bestaat, met hun maat en plek.
   Het model zelf gebruikt hem niet — de geometrieën zijn hierboven al
   samengevoegd — maar tools/rijtest.mjs rekent er twee dingen mee na: dat geen
   enkel onderdeel dwars door een band loopt, en dat er niets los vóór het
   plaatwerk hangt. Dat waren de twee fouten die je in het spel zag.
  */
  const delen = [
    ...lak.map(d => ({ ...d, groep: 'lak' })),
    ...glas.map(d => ({ ...d, groep: 'glas' })),
    ...zwartVast.map(d => ({ ...d, groep: 'zwart' })),
    ...chroomVast.map(d => ({ ...d, groep: 'chroom' })),
    ...lampen.map(d => ({ ...d, groep: 'licht' })),
  ];
  return { paint: merge(lak), glass: merge(glas), zwartVast, chroomVast,
    head, tail: merge(achter), rem, achteruit, plate, wielGeo, hubGeo, wielen, R, L, W, oog, delen,
    // de maten die js/autobinnen.js nodig heeft om het interieur op te bouwen
    /*
     De maten die js/autobinnen.js nodig heeft. Bij de bus staat de vloer van de
     cabine hoger dan de dorpel van de carrosserie — dat is ook wat een bestelbus
     heeft: je stapt er ín in plaats van erin te zakken. Zonder dat zat de
     bestuurder een meter onder zijn eigen stuur.
    */
    maat: { L, W, R, dakY, schouderY, flankY, dorpelY: bus ? schouderY - 0.75 : dorpelY,
      cabZ, cabL, aHoek, stijlH, oog, bus } };
}

/*
 De dozen waar een model uit bestaat, als gewone getallen: naam van de groep,
 middelpunt en maat, plus de wielen. tools/rijtest.mjs rekent hiermee na dat er
 niets door een band loopt en niets los vóór het plaatwerk hangt. Onderdelen die
 geen doos zijn (de wielkastringen) vallen weg — die hóren om de band heen.
*/
/** De maten van de cabine, voor js/autobinnen.js. */
export function autoMaat(kind) { return geoms(kind).maat; }

export function autoOnderdelen(kind) {
  const G = geoms(kind);
  const dozen = [];
  for (const d of G.delen || []) {
    // een afgeronde doos telt ook: zijn maat staat in userData.doos
    const p = d.geo && (d.geo.userData.doos || (d.geo.type === 'BoxGeometry' && d.geo.parameters));
    if (!p) continue;
    dozen.push({ groep: d.groep, x: d.x || 0, y: d.y || 0, z: d.z || 0,
      b: p.width, h: p.height, d: p.depth, rx: d.rx || 0 });
  }
  return { dozen, wielen: G.wielen.map(w => ({ x: w.x, z: w.z })), R: G.R, L: G.L, W: G.W,
    bandBreed: kind === 'truck' ? 0.30 : 0.22 };
}

function geoms(kind) {
  if (GEO[kind]) return GEO[kind];
  const G = kind === 'truck' ? truckGeoms() : autoGeoms(kind);
  // twee uitvoeringen van zwart en chroom: met en zonder de wielen erin
  const banden = G.wielen.map(w => ({ geo: G.wielGeo, x: w.x, y: G.R, z: w.z }));
  const naven = G.wielen.map(w => ({ geo: G.hubGeo, x: w.x, y: G.R, z: w.z }));
  G.black = merge([...G.zwartVast, ...banden]);
  G.chrome = merge([...G.chroomVast, ...naven]);
  G.blackLos = merge(G.zwartVast);
  G.chroomLos = G.chroomVast.length ? merge(G.chroomVast) : null;
  GEO[kind] = G;
  return G;
}

/*
 De materialen. Het glas is donkerder en gladder dan het was, zodat het de lucht
 spiegelt zoals een ruit doet in plaats van een grijze plaat te zijn; de velgen
 zijn lichtmetaal (lichter en iets ruwer dan chroom); de lampen en het kenteken
 krijgen hun doek.
*/
const SHARED = {
  glass: new THREE.MeshStandardMaterial({ color: 0x101a22, roughness: 0.05, metalness: 0.45, transparent: true, opacity: 0.84, envMapIntensity: 1.4 }),
  black: new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.82 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xc9ccd0, metalness: 0.9, roughness: 0.28 }),
  head: new THREE.MeshStandardMaterial({ color: 0xffffff, map: kopDoek(), emissive: 0xfff4d0, emissiveMap: kopDoek(), emissiveIntensity: 0.55, roughness: 0.12, metalness: 0.3 }),
  tail: new THREE.MeshStandardMaterial({ color: 0xffffff, map: achterDoek(), emissive: 0xff3020, emissiveMap: achterDoek(), emissiveIntensity: 0.45, roughness: 0.15 }),
  rem: new THREE.MeshStandardMaterial({ color: 0xff3020, map: achterDoek(), emissive: 0xff2010, emissiveMap: achterDoek(), emissiveIntensity: 2.6 }),
  achteruit: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e0, emissiveIntensity: 1.6 }),
  plate: new THREE.MeshStandardMaterial({ color: 0xffffff, map: plaatDoek(), roughness: 0.5 }),
};
/*
 Autolak met een blanke laklaag. Een auto is geen egaal gekleurd plastic: onder
 heeft hij de kleur (een beetje metallic, iets ruw), en daarover ligt een gladde,
 heldere laag die de lucht en de straat spiegelt. MeshPhysicalMaterial heeft die
 laag als `clearcoat`, en precies die tweede, scherpe spiegeling bovenop een
 zachte kleur is wat lak op lak doet lijken.
*/
function nieuweLak(color) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.5, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 });
}
const paintCache = new Map();

/*
 Een stapel geparkeerde auto's van één soort als instanced meshes.

 De 329 auto's in de wijk stonden er als losse groepjes van zeven meshes: ruim
 tweeduizend objecten, en op straat waren er zeshonderd van in beeld — meer dan
 de helft van alle draw calls. Ze delen allemaal dezelfde geometrie en op de lak
 na ook dezelfde materialen, dus ze kunnen in één keer getekend worden: zeven
 InstancedMeshes per soort, met de lakkleur per instantie.

 Levert { meshes, zet(i, x, z, yaw, zichtbaar), kleur(i, hex), klaar() }.
 Een auto verbergen is hem op schaal nul zetten; dat gebeurt als je erin stapt
 (dan komt het losse model met wielen ervoor in de plaats) of als de hele wijk
 uit beeld moet (binnen, of het bovenaanzicht).
*/
export function maakAutoStapel(kind, aantal) {
  const G = geoms(kind);
  /*
   Autolak. Hij stond op ruwheid 0,35 met metaalgehalte 0,5 en dat leest als
   plastic speelgoed: te glad en te spiegelend. Een gelakte auto die een paar
   weken buiten staat is matter dan dat. Lager metaalgehalte, iets ruwer.
  */
  const lak = nieuweLak(0xffffff);
  const delen = [
    { geo: G.paint, mat: lak, kleurbaar: true, schaduw: true },
    { geo: G.glass, mat: SHARED.glass },
    { geo: G.black, mat: SHARED.black, schaduw: true },
    { geo: G.head, mat: SHARED.head },
    { geo: G.tail, mat: SHARED.tail },
    { geo: G.plate, mat: SHARED.plate },
  ];
  if (G.chrome) delen.push({ geo: G.chrome, mat: SHARED.chrome });
  const meshes = delen.map(d => {
    const m = new THREE.InstancedMesh(d.geo, d.mat, aantal);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.castShadow = !!d.schaduw;
    m.receiveShadow = true;
    /*
     Culling mag weer aan. Dit stond uit omdat er één stapel per soort was voor de
     hele wijk: die ligt altijd ergens in beeld, en dan is een bounding sphere
     alleen maar werk zonder resultaat. Sinds js/vehicles.js een stapel per tegel
     van 240 m maakt is die bol wél klein, en valt alles wat achter je of aan de
     andere kant van de polder staat vanzelf weg.
    */
    m.frustumCulled = true;
    m.userData.autoStapel = kind;
    return m;
  });
  const lakMesh = meshes[0];
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3();
  const kleurHulp = new THREE.Color();
  return {
    meshes, lengte: G.L,
    zet(i, x, z, yaw, zichtbaar = true) {
      P.set(x, 0, z);
      Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      S.setScalar(zichtbaar ? 1 : 0);
      M.compose(P, Q, S);
      for (const m of meshes) m.setMatrixAt(i, M);
    },
    kleur(i, hex) { lakMesh.setColorAt(i, kleurHulp.setHex(hex)); },
    klaar() {
      for (const m of meshes) m.instanceMatrix.needsUpdate = true;
      if (lakMesh.instanceColor) lakMesh.instanceColor.needsUpdate = true;
    },
  };
}

/*
 color    lakkleur
 kind     'hatch', 'van' of 'truck'
 animatie losse wielen, een kantelende carrosserie en rem- en
          achteruitrijlichten; alleen voor een auto die echt rijdt
*/
/** Het lakmateriaal voor een kleur, gedeeld tussen alle auto's van die kleur. */
export function lakVoor(color) {
  if (!paintCache.has(color)) paintCache.set(color, nieuweLak(color));
  return paintCache.get(color);
}

export function makeCar(color, kind = 'hatch', animatie = false) {
  const g = new THREE.Group();
  const G = geoms(kind);
  if (!paintCache.has(color)) paintCache.set(color, nieuweLak(color));

  const bak = animatie ? new THREE.Group() : g;    // carrosserie, kan overhellen
  const body = new THREE.Mesh(G.paint, paintCache.get(color)); body.castShadow = true;
  // gemerkt, zodat js/vehicles.js hem later kan overspuiten (de spuiterij bij BP)
  body.userData.lak = true;
  const glas = new THREE.Mesh(G.glass, SHARED.glass);
  bak.add(body, glas,
    new THREE.Mesh(animatie ? G.blackLos : G.black, SHARED.black),
    new THREE.Mesh(G.head, SHARED.head),
    new THREE.Mesh(G.tail, SHARED.tail),
    new THREE.Mesh(G.plate, SHARED.plate));
  const chroom = animatie ? G.chroomLos : G.chrome;
  if (chroom) bak.add(new THREE.Mesh(chroom, SHARED.chrome));

  if (!animatie) { g.userData.length = G.L; g.userData.oog = G.oog; return g; }

  g.add(bak);
  /*
   Het interieur (js/autobinnen.js). Alleen de auto waar je in zit krijgt het —
   dit is de tak met `animatie`, en dat is per definitie die ene. Het hangt in
   `bak`, de carrosseriegroep, dus het helt mee in de bocht en duikt mee bij het
   remmen. Standaard staat het uit: js/main.js zet het aan zodra je erin zit en
   vanuit je ogen kijkt.
  */
  const binnen = maakAutoBinnen(G.maat);
  binnen.groep.visible = false;
  bak.add(binnen.groep);
  const rem = new THREE.Mesh(G.rem, SHARED.rem); rem.visible = false; bak.add(rem);
  const achteruit = new THREE.Mesh(G.achteruit, SHARED.achteruit); achteruit.visible = false; bak.add(achteruit);
  const wielen = G.wielen.map(w => {
    const groep = new THREE.Group();
    groep.position.set(w.x, G.R, w.z);
    const band = new THREE.Mesh(G.wielGeo, SHARED.black); band.castShadow = true;
    const naaf = new THREE.Mesh(G.hubGeo, SHARED.chrome);
    groep.add(band, naaf);
    g.add(groep);
    return { groep, band, stuur: !!w.stuur };
  });
  g.userData = { length: G.L, oog: G.oog, bak, glas, wielen, rem, achteruit, R: G.R, binnen };
  return g;
}
