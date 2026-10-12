/*
 Het interieur van de auto waar je in zit.

 Tot nu toe was er geen. De camera stond daarom vóór de voorruit en vlak onder
 de dakrand — buiten de auto dus, boven de motorkap — want vanaf de stoel keek
 je door twee getinte ruiten naar een leeg gat. Er stond geen dashboard, geen
 stuur, geen stijl naast je hoofd: je zweefde.

 Hoe dit slim blijft. Er wordt géén interieur in elk automodel gebouwd: de 1781
 geparkeerde auto's zijn instanced meshes en die krijgen er niets bij. Er is
 maar één auto tegelijk waar je in zit, en alleen díe krijgt dit erin gehangen —
 aan de carrosseriegroep, zodat het meehelt in de bocht en meeduikt bij het
 remmen. Stap je uit, dan gaat het weer weg. Het kost dus nooit meer dan één
 auto aan driehoeken, en buiten de auto helemaal niets.

 Het is een schil die naar bínnen kijkt: dashboard, stuur, klokken, deurpanelen,
 hemelbekleding, vloer, stoelen, middenconsole met pook, achterbank, hoedenplank
 en een binnenspiegel. Een doos van three kijkt naar buiten, dus alles wat je
 van binnen moet zien staat op `DoubleSide` — dat is één regel en scheelt het
 omklappen van tientallen vlakken.

 De ruiten zelf blijven uit zolang je erin zit (js/vehicles.js doet dat al): het
 glas is van buiten donker getint en van binnen keek je er dwars doorheen naar
 een grauwe plaat. Wat je nu ziet is de opening met de stijlen eromheen, alsof
 de ramen openstaan — en dat is precies wat je in een spel wilt.

 Maten komen uit `autoMaat(kind)` in js/carmodel.js, zodat een bus en een
 bakwagen vanzelf een grotere cabine krijgen zonder dat hier getallen dubbel
 staan.
*/
import * as THREE from 'three';

/*
 De doeken van het interieur (stap 147, gevraagd: "Kan je de interieur details en opmaak verbeteren"). Alles was een
 effen kleur: grijs kunststof, grijze stof, een grijze hemel. Nu nerf op het kunststof, geweven stof met banen op de
 stoelen en effen stof op de wangen, een geperforeerde hemel, tapijt, ventilatieroosters, een luidsprekergaas en een
 verlicht radiootje; in de Ferrari leer met stiksels en koolstof met een keperbinding. Op canvas, zoals elk doek in dit
 spel, met een vaste zaadwaarde (elke keer dezelfde korrel).

 Een doek met `userData.tegel` herhaalt zich om de zoveel meter: `doos` rekt de uv van elk vlak naar zijn maat in meters,
 zodat een deurpaneel en een knopje dezelfde korrel hebben. Deze materialen zijn enkelzijdig: het zijn dichte dozen die
 je altijd van buiten ziet, en een MeshStandardMaterial met een kaart, enkelzijdig, is een soort die het spel al vertaalt
 (de stafauto, js/nomercy5.js) — tweezijdig met een kaart zou een nieuw programma kosten (tools/binnentest.mjs).
*/
function zaad(n) { return () => { n = (n * 16807) % 2147483647; return n / 2147483647; }; }
function tekenDoek(w, h, fn, herhaal = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  fn(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (herhaal) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}
// korrel: `n` stipjes licht en donker over een effen ondergrond
function korrel(g, w, h, basis, n, sterkte, r = zaad(7)) {
  g.fillStyle = basis; g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const licht = r() < 0.5;
    g.fillStyle = licht ? `rgba(255,255,255,${sterkte * r()})` : `rgba(0,0,0,${sterkte * 1.4 * r()})`;
    g.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1 + (r() < 0.2 ? 1 : 0), 1);
  }
}
const DOEK = {
  nerf: () => tekenDoek(128, 128, (g, w, h) => korrel(g, w, h, '#53575e', 7000, 0.045, zaad(11))),
  // geweven stof: een fijne keper, met banen van 2,5 cm
  stof: () => tekenDoek(128, 128, (g, w, h) => {
    korrel(g, w, h, '#5f6472', 2500, 0.12, zaad(23));
    for (let y = 0; y < h; y += 3) { g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(0, y, w, 1); }
    for (let x = 0; x < w; x += 4) { g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x, 0, 1, h); }
    for (let x = 0; x < w; x += 32) { g.fillStyle = 'rgba(20,22,30,0.28)'; g.fillRect(x, 0, 3, h); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x + 3, 0, 1, h); }
  }),
  stofRand: () => tekenDoek(64, 64, (g, w, h) => korrel(g, w, h, '#454954', 1800, 0.05, zaad(31))),
  // de hemel: lichte stof met een raster van gaatjes
  hemel: () => tekenDoek(128, 128, (g, w, h) => {
    korrel(g, w, h, '#a4a8af', 1800, 0.08, zaad(41));
    g.fillStyle = 'rgba(60,64,72,0.35)';
    for (let y = 2; y < h; y += 8) for (let x = (y / 8) % 2 ? 6 : 2; x < w; x += 8) g.fillRect(x, y, 2, 2);
  }),
  tapijt: () => tekenDoek(128, 128, (g, w, h) => korrel(g, w, h, '#33363b', 9000, 0.16, zaad(53))),
  mat: () => tekenDoek(128, 128, (g, w, h) => {
    korrel(g, w, h, '#232528', 3000, 0.10, zaad(59));
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 3;
    for (let x = 8; x < w; x += 12) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  }),
  // ventilatierooster: lamellen
  rooster: () => tekenDoek(64, 32, (g, w, h) => {
    g.fillStyle = '#16181b'; g.fillRect(0, 0, w, h);
    for (let y = 3; y < h; y += 6) { g.fillStyle = '#3a3e45'; g.fillRect(2, y, w - 4, 2); g.fillStyle = '#0b0c0e'; g.fillRect(2, y + 2, w - 4, 1); }
    g.strokeStyle = '#2b2e34'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2);
  }, false),
  // luidsprekergaas: een rond gaas op de kleur van het deurpaneel
  gaas: () => tekenDoek(64, 64, (g, w, h) => {
    korrel(g, w, h, '#53575e', 600, 0.10, zaad(61));
    g.fillStyle = '#2a2d32'; g.beginPath(); g.arc(32, 32, 28, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#17181b';
    for (let y = 6; y < 60; y += 4) for (let x = 6; x < 60; x += 4) if ((x - 32) ** 2 + (y - 32) ** 2 < 24 ** 2) g.fillRect(x, y, 2, 2);
    g.strokeStyle = '#6a6e76'; g.lineWidth = 2; g.beginPath(); g.arc(32, 32, 28, 0, Math.PI * 2); g.stroke();
  }, false),
  // het radiootje: een donker scherm met de zender, en de knopjes eronder
  radio: () => tekenDoek(256, 96, (g, w, h) => {
    g.fillStyle = '#121418'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#06131a'; g.fillRect(40, 10, 176, 44);
    g.fillStyle = '#6fe3ff'; g.font = 'bold 28px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('FM 98.2', 128, 26);
    g.font = 'bold 13px monospace'; g.fillStyle = '#3fb6d4'; g.fillText('TINGA', 128, 46);
    for (let i = 0; i < 6; i++) { g.fillStyle = '#2b2f36'; g.fillRect(22 + i * 36, 64, 30, 20); g.fillStyle = '#9aa0a8'; g.font = '12px sans-serif'; g.fillText(String(i + 1), 37 + i * 36, 75); }
    g.fillStyle = '#2b2f36'; g.beginPath(); g.arc(18, 32, 14, 0, Math.PI * 2); g.arc(238, 32, 14, 0, Math.PI * 2); g.fill();
  }, false),
  // de Ferrari: rood leer met korrel en een stiksel, zwart leer, koolstof met een keperbinding
  leer: () => tekenDoek(128, 128, (g, w, h) => {
    korrel(g, w, h, '#8c1818', 4200, 0.12, zaad(71));
    g.fillStyle = 'rgba(0,0,0,0.30)';
    for (let y = 4; y < h; y += 6) for (let x = (y / 6) % 2 ? 5 : 2; x < w; x += 6) g.fillRect(x, y, 1, 1);   // perforatie
    g.strokeStyle = 'rgba(230,200,190,0.5)'; g.setLineDash([3, 3]); g.lineWidth = 1;
    for (const x of [2, 62, 66, 126]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  }),
  leerZwart: () => tekenDoek(128, 128, (g, w, h) => {
    korrel(g, w, h, '#1f2024', 5000, 0.06, zaad(73));
    g.strokeStyle = 'rgba(200,40,40,0.55)'; g.setLineDash([3, 3]); g.lineWidth = 1;
    for (const y of [3, 125]) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  }),
  carbon: () => tekenDoek(64, 64, (g, w, h) => {
    const c = 8;
    for (let y = 0; y < h; y += c) for (let x = 0; x < w; x += c) {
      const keper = ((x / c) + (y / c)) % 4 < 2;
      const gr = g.createLinearGradient(x, y, keper ? x + c : x, keper ? y : y + c);
      gr.addColorStop(0, keper ? '#2d3036' : '#191b1f'); gr.addColorStop(1, keper ? '#1c1e22' : '#2a2c31');
      g.fillStyle = gr; g.fillRect(x, y, c, c);
    }
  }),
};

// één set materialen voor alle auto's samen
let MAT = null;
function materialen() {
  if (MAT) return MAT;
  const std = (kleur, ruw, extra = {}) => new THREE.MeshStandardMaterial({
    color: kleur, roughness: ruw, side: THREE.DoubleSide, ...extra,
  });
  /*
   Binnen in een auto valt geen zonlicht: alles wordt er verlicht door wat er
   via de ruiten binnenkomt en weer weerkaatst. Dat rekent deze wereld niet uit,
   dus met alleen een kleur werd het een blauwzwarte grot. Elk materiaal krijgt
   daarom een beetje eigen gloed (`emissive`) in zijn eigen kleur — dat is
   precies wat je van weerkaatst licht zou zien, en het is wat elk spel doet.
  */
  const binnenlicht = (kleur, sterkte = 0.34) => ({ emissive: new THREE.Color(kleur), emissiveIntensity: sterkte });
  // een materiaal met een doek: enkelzijdig (zie boven), `tegel` meter per herhaling (0 = het doek één keer over het vlak)
  const doekMat = (map, tegel, ruw, gloed, sterkte, metaal = 0) => {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, map, roughness: ruw, metalness: metaal, ...binnenlicht(gloed, sterkte) });
    m.userData.tegel = tegel;
    return m;
  };
  MAT = {
    // (stap 147) grijs kunststof met nerf: dashboard, deurpanelen, console; de hemel, de stof en de vloer met hun doek
    kunststof: doekMat(DOEK.nerf(), 0.18, 0.92, 0x585c64, 0.26),
    // lichter voor de hemel, want die vangt het meeste licht
    hemel: doekMat(DOEK.hemel(), 0.40, 0.95, 0x9ea2a9, 0.34),
    // stof van de stoelen: geweven banen in het midden, effen op de wangen
    stof: doekMat(DOEK.stof(), 0.26, 0.98, 0x646975, 0.24),
    stofRand: doekMat(DOEK.stofRand(), 0.25, 0.98, 0x4b4f59, 0.22),
    vloer: doekMat(DOEK.tapijt(), 0.30, 1, 0x3a3d43, 0.16),
    mat: doekMat(DOEK.mat(), 0.25, 1, 0x26282b, 0.12),
    rooster: doekMat(DOEK.rooster(), 0, 0.8, 0x1b1d21, 0.15),
    gaas: doekMat(DOEK.gaas(), 0, 0.9, 0x40444a, 0.18),
    // het scherm van het radiootje geeft zelf licht: zonder licht van buiten, net als de klokken
    radio: new THREE.MeshBasicMaterial({ map: DOEK.radio(), side: THREE.DoubleSide }),
    lampglas: new THREE.MeshBasicMaterial({ color: 0xf1ead2 }),
    zwart: std(0x222429, 0.7, binnenlicht(0x222429, 0.25)),
    // (stap 147: wat minder fel; de deurgreep lichtte als een witte balk op)
    chroom: std(0xa9aeb6, 0.4, { metalness: 0.7, ...binnenlicht(0xa9aeb6, 0.1) }),
    klok: null,     // wordt gezet zodra het doek er is
    naald: new THREE.MeshBasicMaterial({ color: 0xe8453a, side: THREE.DoubleSide }),
    // de Ferrari (stap 127): rood leer, koolstof, en het gele schildje op het stuur
    leer: doekMat(DOEK.leer(), 0.25, 0.62, 0x8a1717, 0.24),
    leerZwart: doekMat(DOEK.leerZwart(), 0.25, 0.6, 0x1d1e22, 0.2),
    carbon: doekMat(DOEK.carbon(), 0.10, 0.42, 0x26282d, 0.18, 0.25),
    geel: new THREE.MeshBasicMaterial({ color: 0xf2c418, side: THREE.DoubleSide }),
    knop: new THREE.MeshBasicMaterial({ color: 0xd21f1f }),
    lampje: new THREE.MeshBasicMaterial({ color: 0x8fe0a0 }),
  };
  return MAT;
}

// de uv van een doos in meters: elk vlak herhaalt het doek om de `tegel` meter (vlakken: +x −x +y −y +z −z)
function schaalUv(geo, b, h, d, tegel) {
  const uv = geo.attributes.uv, maten = [[d, h], [d, h], [b, d], [b, d], [b, h], [b, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    uv.setXY(i, uv.getX(i) * maten[f][0] / tegel, uv.getY(i) * maten[f][1] / tegel);
  }
  uv.needsUpdate = true;
}
// een doos (de naam is gebleven: alles wat hier staat is een dichte doos die je van buiten ziet)
function doos(groep, mat, b, h, d, x, y, z, rx = 0) {
  const g = new THREE.BoxGeometry(b, h, d);
  if (mat.map && mat.userData && mat.userData.tegel > 0) schaalUv(g, b, h, d, mat.userData.tegel);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z);
  if (rx) m.rotation.x = rx;
  return groep.add(m), m;
}

/*
 ---------------------------------------------------------------- vormen (stap 148)
 Gevraagd: "De interieur van de auto's behalve staf auto lijken wat low poly en niet logisch qua opbouw. Kan je hier
 verbeteringen in aanbrengen, dat het van binnen er net zo goed uit ziet als de buitenkant. Ook dat de interieur radio
 meegaat met Radio Tinga, Radio Spannenburg of 100% NL. Die tekst en wat knopjes en dashboardverlichting ook aan in de
 nacht."

 Tot stap 147 was alles een rechthoekige doos, en de opbouw klopte niet: de console stak door het dashboard, het dashboard
 was drie losse platen voor een gat, de klokken een plaatje op de rand, en de zitting lag hoger dan de onderkant van het
 stuur. Nu:
 - `rond`: een doos met afgeronde randen (een geëxtrudeerde afgeronde rechthoek met een afronding rondom);
 - `profiel`: een doorsnede in het vlak (z, y), over de breedte uitgetrokken: het dashboard is één vorm, van de voet van
   de voorruit over de bovenkant en de voorkant naar het schot bij de voeten;
 - een klokkenhuis met een kap op het dashboard, met twee echte ronde klokken, een rand, wijzers en een displaytje;
 - een middenconsole die als één geheel uit het dashboard naar beneden komt (roosters, radio, klimaatknoppen) en tussen
   de stoelen doorloopt tot een armsteun;
 - lagere stoelen met afgeronde zittingen, wangen en een hoofdsteun;
 - roosters met echte lamellen, een stuur met een airbagkussen, een kolom met een kap.
 De radio laat de zender zien waar je naar luistert en het nummer dat speelt; 's nachts branden de klokken, het scherm en
 de knopjes (`update(car, dt, { nacht, zender, nummer })` uit js/main.js).
*/
const RONDING = { curveSegments: 3, bevelSegments: 2 };
// een doos van b × h × d met afgeronde randen (straal r); de uv in meters, gedeeld door de tegel van het materiaal
function rondGeo(b, h, d, r = 0.015) {
  r = Math.max(0.002, Math.min(r, b / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
  const bb = b - 2 * r, hh = h - 2 * r, rr = Math.min(r, bb / 2 - 0.0005, hh / 2 - 0.0005);
  const s = new THREE.Shape();
  const x0 = -bb / 2, y0 = -hh / 2, x1 = bb / 2, y1 = hh / 2, k = Math.max(0.0005, rr * 0.6);
  s.moveTo(x0 + k, y0); s.lineTo(x1 - k, y0); s.quadraticCurveTo(x1, y0, x1, y0 + k);
  s.lineTo(x1, y1 - k); s.quadraticCurveTo(x1, y1, x1 - k, y1); s.lineTo(x0 + k, y1);
  s.quadraticCurveTo(x0, y1, x0, y1 - k); s.lineTo(x0, y0 + k); s.quadraticCurveTo(x0, y0, x0 + k, y0);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, ...RONDING });
  g.translate(0, 0, -(d - 2 * r) / 2);
  return g;
}
function tegelUv(g, mat) {
  const t = mat && mat.userData && mat.userData.tegel;
  if (!(t > 0) || !g.attributes.uv) return g;
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / t, uv.getY(i) / t);
  uv.needsUpdate = true;
  return g;
}
function rond(groep, mat, b, h, d, x, y, z, rx = 0, r = 0.015, naam = '') {
  const m = new THREE.Mesh(tegelUv(rondGeo(b, h, d, r), mat), mat);
  m.position.set(x, y, z);
  if (rx) m.rotation.x = rx;
  if (naam) m.name = naam;
  groep.add(m);
  return m;
}
// een doorsnede [[z, y], …] over de breedte `breed` uitgetrokken, rond x = 0, met afgeronde randen
function profiel(groep, mat, punten, breed, x = 0, r = 0.018, naam = '') {
  const s = new THREE.Shape();
  punten.forEach(([z, y], i) => (i ? s.lineTo(z, y) : s.moveTo(z, y)));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, breed - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.8, ...RONDING });
  g.rotateY(-Math.PI / 2);                 // de doorsnede-x wordt de z van de auto, de extrusie loopt naar −x
  g.translate((breed - 2 * r) / 2, 0, 0);
  const m = new THREE.Mesh(tegelUv(g, mat), mat);
  m.position.x = x;
  if (naam) m.name = naam;
  groep.add(m);
  return m;
}
function cilinder(groep, mat, r0, r1, h, x, y, z, seg = 20) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat);
  m.position.set(x, y, z);
  groep.add(m);
  return m;
}

// ---------------------------------------------------------------- klokken
/*
 Eén wijzerplaat per klok (snelheid of toeren), overdag wit op zwart, 's nachts in barnsteen met een zachte gloed: de
 dashboardverlichting. De wijzers zijn losse meshes die draaien.
*/
function wijzerDoek(labels, stap, eenheid, nacht) {
  return tekenDoek(256, 256, (g, w, h) => {
    const m = w / 2;
    g.fillStyle = '#0c0e11'; g.beginPath(); g.arc(m, m, m, 0, Math.PI * 2); g.fill();
    if (nacht) { const gr = g.createRadialGradient(m, m, 20, m, m, m); gr.addColorStop(0, 'rgba(255,150,40,0.10)'); gr.addColorStop(1, 'rgba(255,150,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
    const kleur = nacht ? '#ffb24a' : '#e6e9ee', fijn = nacht ? '#b5762a' : '#8b9098';
    if (nacht) { g.shadowColor = 'rgba(255,160,60,0.9)'; g.shadowBlur = 6; }
    for (let i = 0; i <= labels * 2; i++) {
      const a = (225 - (270 * i) / (labels * 2)) * Math.PI / 180, co = Math.cos(a), si = -Math.sin(a);
      const groot = i % 2 === 0;
      g.strokeStyle = groot ? kleur : fijn; g.lineWidth = groot ? 6 : 3;
      g.beginPath(); g.moveTo(m + co * 112, m + si * 112); g.lineTo(m + co * (groot ? 88 : 98), m + si * (groot ? 88 : 98)); g.stroke();
      if (groot) {
        g.fillStyle = kleur; g.font = '600 26px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String((i / 2) * stap), m + co * 64, m + si * 64);
      }
    }
    g.fillStyle = fijn; g.font = '600 18px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(eenheid, m, m + 70);
  }, false);
}
const KLOKDOEKEN = new Map();
function klokDoeken(max) {
  if (!KLOKDOEKEN.has(max)) KLOKDOEKEN.set(max, {
    snelDag: wijzerDoek(8, max / 8, 'km/u', false), snelNacht: wijzerDoek(8, max / 8, 'km/u', true),
    toerDag: wijzerDoek(8, 1, '× 1000', false), toerNacht: wijzerDoek(8, 1, '× 1000', true),
  });
  return KLOKDOEKEN.get(max);
}
// ---------------------------------------------------------------- radio
/*
 Het scherm van de radio: de zender waar je naar luistert (Radio Tinga, Radio Spannenburg, 100% NL), een frequentie, het
 nummer dat speelt, en een klokje. Eén doek dat alleen opnieuw getekend wordt als er iets verandert.
*/
const FREQ = { tinga: '98.2', spannenburg: '104.7', '100nl': '101.4' };
function tekenRadio(doek, { naam, logo, regel, nacht, uit }) {
  const c = doek.image, g = c.getContext('2d'), w = c.width, h = c.height;
  g.fillStyle = '#05080c'; g.fillRect(0, 0, w, h);
  if (uit) { doek.needsUpdate = true; return; }
  const kleur = nacht ? '#8ff0ff' : '#6fd6ec', zacht = nacht ? '#4fb3cc' : '#3e9ab0';
  if (nacht) { g.shadowColor = 'rgba(120,230,255,0.8)'; g.shadowBlur = 8; }
  g.fillStyle = zacht; g.font = 'bold 22px monospace'; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText(`FM ${FREQ[logo] || '98.2'}`, 14, 22);
  g.textAlign = 'right'; g.fillText('ST', w - 14, 22);
  // de naam zo groot als past: "RADIO SPANNENBURG" moet er helemaal op
  const tekst = (naam || 'RADIO').toUpperCase();
  let px = 46; g.font = `bold ${px}px monospace`;
  while (px > 20 && g.measureText(tekst).width > w - 28) { px -= 2; g.font = `bold ${px}px monospace`; }
  g.fillStyle = kleur; g.textAlign = 'center';
  g.fillText(tekst, w / 2, 66);
  g.fillStyle = zacht; g.font = '20px monospace';
  g.fillText((regel || '').slice(0, 30), w / 2, 106);
  doek.needsUpdate = true;
}

/*
 De Ferrari (stap 127, en stap 148: afgerond). Twee lage kuipstoelen in rood leer met zwarte wangen, een tunnel in
 koolstof met de rode startknop en drie knoppen, een schot achter de stoelen.
*/
function sportBinnen(groep, M, maat, { vloerY, hemelY, cabZ, achter, stuurX }) {
  const W = maat.W;
  const zit = vloerY + 0.07;
  const rugTop = Math.min(hemelY - 0.06, (maat.oog ? maat.oog.y : 1.02) + 0.06);
  const rugH = rugTop - zit - 0.03;
  for (const sx of [stuurX, -stuurX]) {
    rond(groep, M.leer, 0.36, 0.08, 0.46, sx, zit, cabZ - 0.08, 0, 0.03, 'zitting');
    rond(groep, M.leer, 0.36, rugH, 0.08, sx, zit + 0.03 + rugH / 2, cabZ + 0.20, 0.22, 0.035);
    for (const w of [-1, 1]) {
      rond(groep, M.leerZwart, 0.08, 0.16, 0.46, sx + w * 0.22, zit + 0.04, cabZ - 0.08, 0, 0.035);
      rond(groep, M.leerZwart, 0.08, rugH * 0.82, 0.13, sx + w * 0.22, zit + 0.03 + rugH * 0.42, cabZ + 0.19, 0.22, 0.035);
    }
    rond(groep, M.leerZwart, 0.09, 0.05, 0.09, sx, rugTop - 0.09, cabZ + 0.215 + Math.sin(0.22) * rugH * 0.4, 0.22, 0.02);
  }
  rond(groep, M.carbon, 0.24, 0.20, 0.95, 0, vloerY + 0.10, cabZ - 0.30, 0, 0.04);
  rond(groep, M.carbon, 0.20, 0.05, 0.30, 0, vloerY + 0.24, cabZ - 0.58, -0.25, 0.02);
  const knop = cilinder(groep, M.knop, 0.018, 0.018, 0.012, 0, vloerY + 0.28, cabZ - 0.62, 16); knop.rotation.x = -0.25;
  for (const dx of [-0.06, 0, 0.06]) rond(groep, M.chroom, 0.035, 0.018, 0.035, dx, vloerY + 0.215, cabZ - 0.42, 0, 0.006);
  rond(groep, M.carbon, W - 0.26, maat.schouderY - vloerY + 0.06, 0.04, 0, (vloerY + maat.schouderY) / 2 + 0.03, achter + 0.06, 0, 0.015);
  rond(groep, M.carbon, W - 0.28, 0.03, 0.30, 0, maat.schouderY + 0.02, achter + 0.22, 0, 0.012);
}

/**
 * Het interieur van één auto. `maat` komt uit `autoMaat(kind)` in js/carmodel.js.
 *
 * Levert { groep, stuur, klok, naalden, update(car, dt, { nacht, zender, nummer }) } — `update` zet het stuur en de
 * wijzers, de klok- en knopverlichting en het scherm van de radio. Hang `groep` in de carrosseriegroep (js/carmodel.js),
 * dan helt het mee in de bocht.
 */
export function maakAutoBinnen(maat) {
  const M = materialen();
  if (!M.knopLicht) {
    // de knopjes en de randjes die 's nachts oplichten; overdag donker kunststof (alleen de kleur verandert)
    M.knopLicht = new THREE.MeshBasicMaterial({ color: 0x2a2d33 });
    M.wijzer = new THREE.MeshBasicMaterial({ color: 0xff5a2a, side: THREE.DoubleSide });
    M.doekLcd = tekenDoek(256, 64, (g, w, h) => { g.fillStyle = '#071014'; g.fillRect(0, 0, w, h); g.fillStyle = '#5fd0e6'; g.font = 'bold 30px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('054213 km', w / 2, h / 2); }, false);
    M.lcd = new THREE.MeshBasicMaterial({ map: M.doekLcd, side: THREE.DoubleSide, color: 0xbfc8cc });
  }
  const maxKmu = maat.sport ? 320 : 160;
  const KD = klokDoeken(maxKmu);
  // elke auto zijn eigen klokmaterialen (de doeken zijn gedeeld): de nacht wisselt het doek
  const snelMat = new THREE.MeshBasicMaterial({ map: KD.snelDag, side: THREE.DoubleSide });
  const toerMat = new THREE.MeshBasicMaterial({ map: KD.toerDag, side: THREE.DoubleSide });
  // het scherm van de radio: een eigen doek per auto, opnieuw getekend als de zender of het nummer verandert
  const radioDoek = tekenDoek(512, 128, () => {}, false);
  const radioMat = new THREE.MeshBasicMaterial({ map: radioDoek, side: THREE.DoubleSide, color: 0xd6dde0 });
  tekenRadio(radioDoek, { naam: 'Radio Tinga', logo: 'tinga', regel: '', nacht: false });

  const { W, dakY, schouderY, cabZ, cabL, dorpelY } = maat;
  const T = schouderY;
  const groep = new THREE.Group();
  const binnenX = W / 2 - 0.145;          // binnenkant van het portier, binnen de flankwand
  const vloerY = dorpelY + 0.16;          // de vloer ligt net boven de dorpelbalk
  const hemelY = dakY - 0.045;
  const voor = cabZ - cabL / 2 + 0.30;    // (de bovenkant van de voorruit; de voet staat in `maat.ruit`)
  // (de neus ligt bij −z: wat verder naar achteren staat heeft een gróter getal)
  const dashZ = voor + 0.06;
  const F = dashZ + 0.10;                 // het vlak van het dashboard dat naar de bestuurder kijkt
  const stuurZ = voor + 0.265;
  const achter = cabZ + cabL / 2 - 0.20;
  const stuurX = -(W / 2 - 0.46);
  const sport = !!maat.sport;
  const dashMat = sport ? M.carbon : M.kunststof, bovenMat = sport ? M.leerZwart : M.kunststof;

  // ---------------------------------------------------------------- schil: vloer, hemel, deuren
  doos(groep, M.vloer, W - 0.20, 0.04, cabL + 0.5, 0, vloerY, cabZ);
  // (stap 149) de hemel zo lang als het dak van binnen (`maat.dakZ`): hij stak voor en achter door de ruiten heen
  const [dak0, dak1] = maat.dakZ || [cabZ - cabL / 2 + 0.28, cabZ + cabL / 2 - 0.28];
  if (sport) rond(groep, M.carbon, 1.28, 0.03, dak1 - dak0, 0, hemelY - 0.02, (dak0 + dak1) / 2, 0, 0.012, 'hemel');
  else rond(groep, M.hemel, W - 0.26, 0.03, dak1 - dak0, 0, hemelY, (dak0 + dak1) / 2, 0, 0.012, 'hemel');
  const deurMat = sport ? M.leerZwart : M.kunststof;
  const deurL = cabL - 0.30;
  for (const sx of [-1, 1]) {
    const bx = sx * binnenX;
    // het paneel tot de raamlijn, met een rand langs het raam
    rond(groep, deurMat, 0.04, T - vloerY + 0.04, deurL, bx, (vloerY + T) / 2 + 0.02, cabZ, 0, 0.012);
    rond(groep, M.zwart, 0.06, 0.03, deurL, bx - sx * 0.01, T + 0.01, cabZ, 0, 0.012);
    // de armsteun loopt naar voren toe iets op, met een uitsparing als greep
    rond(groep, M.kunststof, 0.08, 0.05, 0.44, bx - sx * 0.045, T - 0.15, cabZ - 0.10, -0.06, 0.022);
    rond(groep, M.zwart, 0.04, 0.035, 0.13, bx - sx * 0.075, T - 0.12, cabZ - 0.26, 0, 0.012);
    // de deurklink vooraan, en de raamschakelaar voor op de armsteun
    rond(groep, M.chroom, 0.02, 0.025, 0.08, bx - sx * 0.03, T - 0.05, cabZ - deurL / 2 + 0.16, 0, 0.008);
    rond(groep, M.zwart, 0.035, 0.018, 0.075, bx - sx * 0.07, T - 0.12, cabZ - 0.31, -0.06, 0.006);
    // een stofvlak onder de armsteun, een luidspreker laag vooraan en een vak onderin
    rond(groep, sport ? M.carbon : M.stof, 0.014, 0.15, Math.min(0.55, cabL * 0.30), bx - sx * 0.022, T - 0.28, cabZ - 0.02, 0, 0.006);
    const gaas = new THREE.Mesh(new THREE.CircleGeometry(0.07, 32), M.gaas);
    gaas.position.set(bx - sx * 0.0205, vloerY + 0.15, cabZ - deurL / 2 + 0.17);
    gaas.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2; gaas.name = 'luidspreker';
    groep.add(gaas);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.006, 6, 32), M.zwart);
    ring.position.copy(gaas.position); ring.rotation.y = Math.PI / 2; groep.add(ring);
    rond(groep, M.kunststof, 0.05, 0.10, Math.min(0.42, cabL * 0.24), bx - sx * 0.04, vloerY + 0.11, cabZ + 0.10, 0, 0.015);
  }
  // de bekleding van de A- en B-stijl (in hatch, bus, BX en GTI; uit dezelfde formule als de stijlen in js/carmodel.js)
  if (!sport && !maat.truck && !maat.amb && maat.stijlH && maat.aHoek != null) {
    const x0 = W / 2 - (maat.bus ? 0.10 : 0.075), sH = maat.stijlH;
    for (const sx of [-1, 1]) {
      rond(groep, M.hemel, 0.03, sH + 0.10, 0.13, sx * (x0 - 0.06), (T + dakY) / 2, cabZ - cabL / 2 + 0.30 - Math.sin(maat.aHoek) * sH / 2, maat.aHoek, 0.012, 'stijlbekleding');
      rond(groep, M.hemel, 0.03, sH, 0.10, sx * (x0 - 0.05), (T + dakY) / 2, cabZ + (maat.bus ? 0.30 : 0.18), 0, 0.012, 'stijlbekleding');
    }
  }

  /*
   (stap 149) De ambulance is van buiten één dichte vorm met de ruiten erop; van binnen zie je daar alleen de achterkant
   van, en die tekent three niet. Er stond dus geen A-stijl: van de bestuurdersstoel liep de voorruit naadloos over in de
   zijruit. Nu een bekleding langs de rand van de voorruit, net erachter.
  */
  if (maat.amb && maat.ruit) {
    const r = maat.ruit, hoek = Math.atan(r.tan), lang = (dakY - r.y) / Math.cos(hoek), ym = (r.y + dakY) / 2;
    for (const sx of [-1, 1]) rond(groep, M.hemel, 0.05, lang, 0.09, sx * (W / 2 - 0.05), ym, r.z + (ym - r.y) * r.tan + 0.055, hoek, 0.015, 'stijlbekleding');
  }

  // ---------------------------------------------------------------- het dashboard: één vorm
  /*
   De doorsnede, van de voet van de voorruit (iets eronder, zodat er geen kier is) over een bolle bovenkant naar de
   voorkant, dan schuin terug langs de knieën naar het schot bij de voeten. Over de breedte van portier tot portier.
  */
  const kniY = Math.max(T - 0.27, vloerY + 0.14);
  /*
   (stap 149) Het dashboard liep tot `voor` − 0,06 — maar `voor` is de bovenkant van de voorruit, niet de voet. Tussen
   de rand van het dashboard en het glas lag zo twintig centimeter motorkap in beeld, een gekleurde strook onder de
   ruit. Nu loopt de bovenkant door tot net onder het glas (`maat.ruit`: de voet van de ruit van binnen, uit
   js/carmodel.js) en ligt hij net boven de motorkap. Vooraan een sleuf voor de ontwaseming.
  */
  const ruit = maat.ruit || { z: voor - 0.30, y: T + 0.05, tan: 0.7 };
  const glasOp = (y) => ruit.z + (y - ruit.y) * ruit.tan;          // de binnenkant van de voorruit op hoogte y
  const yTop = Math.max(T + 0.06, ruit.y + 0.02);                  // de bovenkant van het dashboard bij de bestuurder
  const yVoor = ruit.y + 0.012;
  // (de afronding van `profiel` legt er rondom 0,8 · 0,018 = 0,0144 m omheen: de voorrand blijft zo nog net van het glas af;
  // bij de bestuurder wijkt het voorvlak 3 cm terug, anders stond het voor de klokken, die nu op de hoogte van de rand zitten)
  const BV = 0.0144;
  const zVoor = glasOp(yVoor + BV) + BV + 0.006;
  const zMid = Math.min(F - 0.12, Math.max(zVoor + 0.06, (zVoor + F) / 2));
  profiel(groep, dashMat, [
    [ruit.z + 0.02, Math.min(yVoor - 0.06, kniY)], [zVoor, yVoor], [zMid, yTop], [F - 0.035, yTop - 0.012], [F - 0.01, yTop - 0.035],
    [F + 0.03, T - 0.11], [F - 0.04, kniY], [voor + 0.05, vloerY + 0.06], [ruit.z + 0.02, vloerY + 0.06],
  ], 2 * binnenX - 0.02, 0, 0.018, 'dashboard');
  // de bovenkant in leer of zacht kunststof: een vel over het vlakke stuk, van de knik tot de rand bij de bestuurder
  if (F - 0.05 - zMid > 0.06) {
    const hoek = Math.atan2(0.012, F - 0.035 - zMid);
    rond(groep, bovenMat, 2 * binnenX - 0.08, 0.006, F - 0.05 - zMid, 0, yTop - 0.006 + BV + 0.003, (zMid + F - 0.05) / 2, hoek, 0.003, 'dashvel');
  }
  // de sleuf van de ontwaseming op het schuine stuk vlak onder het glas
  {
    const helling = (yTop - yVoor) / Math.max(0.02, zMid - zVoor), zs = zVoor + Math.min(0.035, (zMid - zVoor) / 2);
    rond(groep, M.zwart, 2 * binnenX - 0.40, 0.005, 0.03, 0, yVoor + (zs - zVoor) * helling + BV + 0.002, zs, -Math.atan(helling), 0.002, 'ontwaseming');
  }

  // ---------------------------------------------------------------- het klokkenhuis met de klokken
  // (het huis staat met zijn achterkant op F + 0,015: de klokken net daarvoor, anders zaten ze erin)
  const klokY = Math.max(T + 0.05, yTop - 0.035), klokZ = F + 0.021;
  rond(groep, dashMat, 0.36, 0.16, 0.10, stuurX, klokY, F - 0.035, 0, 0.035);                 // het huis
  /*
   De kap over de klokken was een losse plank op het huis. Nu een doorsnede die uit de bovenkant van het dashboard
   oprijst, over de klokken heen buigt en vooraan als een klep over de rand hangt, met de zijkanten afgerond.
  */
  profiel(groep, bovenMat, [
    [F - 0.24, yTop - 0.004], [F - 0.13, klokY + 0.085], [F - 0.04, klokY + 0.105], [F + 0.025, klokY + 0.098],
    [F + 0.04, klokY + 0.078], [F + 0.022, klokY + 0.074], [F - 0.02, klokY + 0.082], [F - 0.06, yTop - 0.01],
  ], 0.40, stuurX, 0.02, 'klokkap');
  const klok = new THREE.Group(); klok.name = 'klokken'; groep.add(klok);
  const naalden = [];
  const RK = 0.056;
  for (const [dx, mat] of [[-0.078, snelMat], [0.078, toerMat]]) {
    const plaat = new THREE.Mesh(new THREE.CircleGeometry(RK, 40), mat);
    plaat.position.set(stuurX + dx, klokY, klokZ); klok.add(plaat);
    const rand = new THREE.Mesh(new THREE.TorusGeometry(RK + 0.004, 0.0045, 8, 40), M.chroom);
    rand.position.set(stuurX + dx, klokY, klokZ + 0.002); klok.add(rand);
    const n = new THREE.Mesh(new THREE.PlaneGeometry(0.006, RK * 0.82), M.wijzer);
    n.geometry.translate(0, RK * 0.3, 0);
    n.position.set(stuurX + dx, klokY, klokZ + 0.004); klok.add(n); naalden.push(n);
    cilinder(klok, M.zwart, 0.008, 0.008, 0.006, stuurX + dx, klokY, klokZ + 0.005, 12).rotation.x = Math.PI / 2;
  }
  const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.016), M.lcd);
  lcd.position.set(stuurX, klokY - 0.045, klokZ + 0.001); klok.add(lcd);
  // de controlelampjes tussen de klokken: 's nachts lichten ze op
  for (let i = 0; i < 3; i++) {
    const l = new THREE.Mesh(new THREE.CircleGeometry(0.0055, 10), M.knopLicht);
    l.position.set(stuurX, klokY + 0.03 - i * 0.017, klokZ + 0.001); klok.add(l);
  }

  // ---------------------------------------------------------------- het stuur
  const stuur = new THREE.Group();
  stuur.position.set(stuurX, T - 0.02, stuurZ);
  stuur.rotation.x = -0.42;
  const R = maat.truck ? 0.21 : 0.158;
  stuur.add(new THREE.Mesh(new THREE.TorusGeometry(R, 0.022, 12, 48), M.zwart));
  // drie spaken van het kussen naar de krans: links en rechts iets onder de horizon, en recht naar beneden
  for (const phi of [Math.PI + 0.2, -0.2, -Math.PI / 2]) {
    const sp = new THREE.Mesh(rondGeo(0.045, R * 0.62, 0.016, 0.007), sport ? M.carbon : M.zwart);
    sp.rotation.z = phi - Math.PI / 2;          // de lengte (lokale y) wijst naar `phi`
    sp.position.set(Math.cos(phi) * R * 0.6, Math.sin(phi) * R * 0.6, -0.004);
    stuur.add(sp);
  }
  const kussen = new THREE.Mesh(rondGeo(0.12, 0.095, 0.05, 0.025), M.zwart);
  kussen.position.z = 0.012; stuur.add(kussen);
  if (sport) {
    const schild = new THREE.Mesh(new THREE.CircleGeometry(0.026, 16), M.geel); schild.position.z = 0.038; stuur.add(schild);
    const streep = new THREE.Mesh(rondGeo(0.03, 0.04, 0.046, 0.008), M.leer); streep.position.set(0, R, 0); stuur.add(streep);
    for (const sx of [-1, 1]) { const fl = new THREE.Mesh(rondGeo(0.075, 0.13, 0.008, 0.003), M.carbon); fl.position.set(sx * (R * 0.72), R * 0.18, -0.045); stuur.add(fl); }
  } else {
    const embleem = new THREE.Mesh(new THREE.CircleGeometry(0.014, 16), M.chroom); embleem.position.z = 0.038; stuur.add(embleem);
  }
  groep.add(stuur);
  // de kolom met een kap, en de hendels voor richtingaanwijzer en ruitenwissers
  rond(groep, M.zwart, 0.085, 0.085, 0.24, stuurX, T - 0.11, stuurZ - 0.09, -0.42, 0.03);
  for (const sx of [-1, 1]) {
    const hendel = cilinder(groep, M.zwart, 0.006, 0.008, 0.15, stuurX + sx * 0.11, T - 0.085, stuurZ - 0.05, 8);
    hendel.rotation.z = sx * 1.35; hendel.name = 'hendel';
  }

  // ---------------------------------------------------------------- de middenconsole: uit het dashboard naar de stoelen
  const consoleTop = vloerY + 0.20;
  const stackBoven = T - 0.03, stackOnder = vloerY + 0.10;
  // het front: één schuin vlak van onder de dashboardrand tot de vloer
  rond(groep, sport ? M.carbon : M.kunststof, 0.30, stackBoven - stackOnder, 0.10, 0, (stackBoven + stackOnder) / 2, F + 0.01, -0.10, 0.03, 'middenconsole');
  const fz = (y) => F + 0.065 - (y - (stackBoven + stackOnder) / 2) * Math.tan(0.10);   // het voorvlak op hoogte y
  // twee roosters bovenin, met lamellen
  const rooster = (cx, cy, cz, b, h) => {
    rond(groep, M.zwart, b, h, 0.03, cx, cy, cz, -0.10, 0.01, 'rooster');
    for (let i = 0; i < 4; i++) rond(groep, M.chroom, b - 0.02, 0.004, 0.022, cx, cy - h / 2 + (i + 1) * h / 5, cz + 0.006, -0.25, 0.0015);
  };
  for (const dx of [-0.075, 0.075]) rooster(dx, stackBoven - 0.045, fz(stackBoven - 0.045), 0.12, 0.055);
  // de radio: een frame, het scherm, twee draaiknoppen en zes voorkeuzetoetsen die 's nachts oplichten
  const ry = stackBoven - 0.13;
  rond(groep, M.zwart, 0.26, 0.10, 0.025, 0, ry, fz(ry), -0.10, 0.01);
  const scherm = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.0375), radioMat);
  scherm.position.set(0, ry + 0.015, fz(ry) + 0.014); scherm.rotation.x = -0.10; scherm.name = 'radio';
  groep.add(scherm);
  for (const dx of [-0.105, 0.105]) { const k = cilinder(groep, M.chroom, 0.014, 0.015, 0.018, dx, ry + 0.012, fz(ry) + 0.02, 20); k.rotation.x = Math.PI / 2 - 0.10; }
  for (let i = 0; i < 6; i++) rond(groep, M.knopLicht, 0.026, 0.012, 0.008, -0.075 + i * 0.03, ry - 0.03, fz(ry) + 0.014, -0.10, 0.003);
  // de klimaatknoppen eronder, met een lichtring
  const ky = Math.max(stackOnder + 0.05, ry - 0.10);
  for (const dx of [-0.08, 0, 0.08]) {
    const k = cilinder(groep, M.zwart, 0.018, 0.02, 0.02, dx, ky, fz(ky) + 0.015, 20); k.rotation.x = Math.PI / 2 - 0.10;
    const lr = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0025, 6, 24), M.knopLicht); lr.position.set(dx, ky, fz(ky) + 0.008); lr.rotation.x = -0.10; groep.add(lr);
  }
  // de alarmlichtknop, boven tussen de roosters
  rond(groep, M.knop, 0.03, 0.02, 0.012, 0, stackBoven - 0.005, fz(stackBoven) + 0.01, -0.10, 0.004);
  // de roosters aan de zijkanten, op het dashboard bij de portieren
  for (const sx of [-1, 1]) rooster(sx * (binnenX - 0.13), T - 0.02, F + 0.03, 0.16, 0.065);
  if (!sport) {
    // het handschoenenkastje: een deksel met een naad en een greep, op het schuine stuk aan de kant van de bijrijder
    const hy = T - 0.17;
    rond(groep, M.kunststof, 0.40, 0.13, 0.022, -stuurX, hy, F + 0.02 - (T - 0.11 - hy) * 0.45, -0.42, 0.012, 'handschoenenkastje');
    rond(groep, M.chroom, 0.09, 0.016, 0.014, -stuurX, hy + 0.045, F + 0.035 - (T - 0.11 - hy) * 0.45, -0.42, 0.005);
    // de tunnel tussen de stoelen: van het front tot een armsteun, met de pook, bekerhouders en de handrem
    const z0 = F + 0.06, z1 = cabZ + 0.12, cl = Math.max(0.3, z1 - z0);
    rond(groep, M.kunststof, 0.26, consoleTop - vloerY, cl, 0, (vloerY + consoleTop) / 2, (z0 + z1) / 2, 0, 0.03);
    rond(groep, M.zwart, 0.20, 0.004, Math.min(0.24, cl * 0.4), 0, consoleTop + 0.002, z0 + 0.16, 0, 0.002);   // een mat in het vak
    rond(groep, M.stofRand, 0.22, 0.06, 0.26, 0, consoleTop + 0.035, z1 - 0.13, 0, 0.025);                      // de armsteun
    const pz = z0 + 0.10;
    const hoes = cilinder(groep, M.zwart, 0.022, 0.05, 0.07, 0, consoleTop + 0.035, pz, 14);
    const stang = cilinder(groep, M.chroom, 0.009, 0.011, 0.15, 0, consoleTop + 0.14, pz - 0.01, 10); stang.rotation.x = -0.12;
    const bol = new THREE.Mesh(new THREE.SphereGeometry(0.028, 18, 12), M.zwart); bol.position.set(0, consoleTop + 0.22, pz - 0.02); groep.add(bol);
    for (const dx of [-0.065, 0.065]) {
      const bh = cilinder(groep, M.zwart, 0.036, 0.036, 0.014, dx, consoleTop + 0.003, pz + 0.15, 22); bh.name = 'bekerhouder';
    }
    const rem = rond(groep, M.zwart, 0.04, 0.035, 0.24, 0.015, consoleTop + 0.04, pz + 0.30, -0.30, 0.015);
    rem.name = 'handrem';
    // het binnenlampje in de hemel en een handgreep boven de deur van de bijrijder
    rond(groep, M.kunststof, 0.14, 0.022, 0.08, 0, hemelY - 0.025, cabZ - 0.05, 0, 0.008);
    rond(groep, M.lampglas, 0.10, 0.008, 0.05, 0, hemelY - 0.037, cabZ - 0.05, 0, 0.003, 'binnenlampje');
    rond(groep, M.kunststof, 0.03, 0.025, 0.20, -stuurX > 0 ? binnenX - 0.07 : -(binnenX - 0.07), hemelY - 0.07, cabZ - 0.05, 0, 0.01, 'handgreep');
  }

  // ---------------------------------------------------------------- stoelen
  /*
   Lager dan eerst: de zitting lag hoger dan de onderkant van het stuur. Nu een zitting van 8 cm net boven de vloer, iets
   naar voren oplopend, met wangen, een rug die onder de hemel blijft en een hoofdsteun op twee stangetjes.
  */
  const stoel = (sx) => {
    const zit = vloerY + 0.10;
    rond(groep, M.stof, 0.30, 0.08, 0.42, sx, zit, cabZ - 0.07, -0.05, 0.03, 'zitting');
    for (const w of [-1, 1]) rond(groep, M.stofRand, 0.08, 0.12, 0.44, sx + w * 0.19, zit + 0.02, cabZ - 0.07, -0.05, 0.035);
    const rugTop = Math.min(zit + 0.60, hemelY - 0.14), rugH = rugTop - (zit + 0.05);
    rond(groep, M.stof, 0.30, rugH, 0.09, sx, zit + 0.05 + rugH / 2, cabZ + 0.17, 0.12, 0.035);
    for (const w of [-1, 1]) rond(groep, M.stofRand, 0.08, rugH, 0.12, sx + w * 0.18, zit + 0.05 + rugH / 2, cabZ + 0.16, 0.12, 0.035);
    const hoofdY = Math.min(rugTop + 0.09, hemelY - 0.07), hz = cabZ + 0.14 + Math.sin(0.12) * rugH / 2;
    rond(groep, M.stofRand, 0.22, 0.12, 0.09, sx, hoofdY, hz, 0.12, 0.04);
    for (const w of [-1, 1]) cilinder(groep, M.chroom, 0.006, 0.006, Math.max(0.02, hoofdY - rugTop), sx + w * 0.06, (hoofdY + rugTop) / 2 - 0.03, hz, 6);
  };
  if (sport) sportBinnen(groep, M, maat, { vloerY, hemelY, cabZ, achter, stuurX });
  else {
    stoel(stuurX);
    stoel(-stuurX);
    // de achterbank en de hoedenplank
    rond(groep, M.stof, W - 0.32, 0.10, 0.42, 0, vloerY + 0.14, achter - 0.10, 0, 0.035);
    rond(groep, M.stof, W - 0.34, 0.46, 0.10, 0, vloerY + 0.42, achter + 0.16, 0.12, 0.035);
    rond(groep, M.kunststof, W - 0.28, 0.03, 0.34, 0, T - 0.02, achter + 0.30, 0, 0.012);
  }
  // de vloermatten voor de voorstoelen
  {
    const z0 = F + 0.05, z1 = cabZ - 0.26, l = Math.max(0.2, z1 - z0);
    for (const sx of [stuurX, -stuurX]) rond(groep, M.mat, 0.40, 0.012, l, sx, vloerY + 0.026, (z0 + z1) / 2, 0, 0.005, 'vloermat');
  }

  // ---------------------------------------------------------------- spiegel en zonnekleppen
  const oogY = (maat.oog && maat.oog.y) || (T + 0.27);
  const spiegelY = Math.min(hemelY - 0.03, Math.max(hemelY - 0.075, oogY + 0.10));
  // (stap 149) aan de voorrand van het dak, achter het glas: ze hingen op `voor`, en dat lag bij sommige soorten vóór de ruit
  const spZ = Math.max(dak0 + 0.04, glasOp(spiegelY + 0.04) + 0.05);
  rond(groep, M.zwart, 0.23, 0.07, 0.035, 0, spiegelY, spZ, 0, 0.018, 'binnenspiegel');
  const glasSp = new THREE.Mesh(tegelUv(rondGeo(0.205, 0.05, 0.004, 0.012), null), M.chroom);
  glasSp.position.set(0, spiegelY, spZ + 0.019); glasSp.rotation.y = -0.12; groep.add(glasSp);
  cilinder(groep, M.zwart, 0.007, 0.007, Math.max(0.02, hemelY - spiegelY - 0.02), 0, (hemelY + spiegelY) / 2, spZ, 8);
  const klepY = Math.min(hemelY - 0.022, Math.max(hemelY - 0.035, oogY + 0.05));
  if (!sport) for (const sx of [-1, 1]) rond(groep, M.hemel, 0.36, 0.018, 0.16, sx * 0.34, klepY, Math.max(dak0 + 0.09, glasOp(klepY) + 0.10), -0.16, 0.008, 'zonneklep');

  // ---------------------------------------------------------------- bijwerken
  /*
   Het stuur draait mee met de wielen (drie kwartslagen per kant), de wijzers lopen van 225° naar −45°. 's Nachts het
   barnstenen doek op de klokken en de knopjes aan; het scherm van de radio volgt de zender en het nummer.
  */
  const hoekVan = (deel) => (225 - 270 * Math.max(0, Math.min(1, deel))) * Math.PI / 180;
  let getoondeSnelheid = 0, getoondeToeren = 0, wasNacht = null, radioSleutel = '';
  function update(car, dt = 1 / 60, { nacht = false, zender, nummer } = {}) {
    const uitslag = (car && car.steer) || 0;
    stuur.rotation.z = -uitslag * 4.2;
    const kmu = Math.abs((car && car.speed) || 0) * 3.6;
    const top = ((car && car.topSnelheid) || 24) * 3.6;
    const toeren = top > 0 ? 0.12 + 0.75 * ((kmu / top) % 0.34) / 0.34 : 0.12;
    const soepel = Math.min(1, dt * 8);
    getoondeSnelheid += (Math.min(1, kmu / maxKmu) - getoondeSnelheid) * soepel;
    getoondeToeren += (toeren - getoondeToeren) * soepel;
    naalden[0].rotation.z = hoekVan(getoondeSnelheid) - Math.PI / 2;
    naalden[1].rotation.z = hoekVan(getoondeToeren) - Math.PI / 2;
    if (nacht !== wasNacht) {
      wasNacht = nacht;
      snelMat.map = nacht ? KD.snelNacht : KD.snelDag;
      toerMat.map = nacht ? KD.toerNacht : KD.toerDag;
      M.knopLicht.color.setHex(nacht ? 0xffa53c : 0x2a2d33);
      /*
       De eigen gloed van het interieur staat voor het daglicht dat via de ruiten binnenvalt (zie `materialen`); 's nachts
       is dat er niet, en dan lichtte de hemel grijs op in het donker. Nu een kwart, zodat de verlichting van het dashboard
       het licht is.
      */
      for (const m of Object.values(M)) {
        if (!m || !m.isMeshStandardMaterial || !m.emissive) continue;
        if (m.userData.gloedDag == null) m.userData.gloedDag = m.emissiveIntensity;
        m.emissiveIntensity = m.userData.gloedDag * (nacht ? 0.25 : 1);
      }
      M.lcd.color.setHex(nacht ? 0xffffff : 0xbfc8cc);
      radioMat.color.setHex(nacht ? 0xffffff : 0xd6dde0);
      radioSleutel = '';
    }
    const z = zender === undefined ? { naam: 'Radio Tinga', logo: 'tinga' } : zender;
    const regel = nummer ? `${nummer.artiest ? nummer.artiest + ' - ' : ''}${nummer.titel || ''}` : '';
    const sleutel = `${z ? z.naam : '-'}|${regel}|${nacht}`;
    if (sleutel !== radioSleutel) {
      radioSleutel = sleutel;
      tekenRadio(radioDoek, { naam: z && z.naam, logo: z && z.logo, regel, nacht, uit: !z });
    }
  }
  update(null, 1, { nacht: false });

  return { groep, stuur, klok, naalden, radioDoek, get radioTekst() { return radioSleutel; }, update };
}
