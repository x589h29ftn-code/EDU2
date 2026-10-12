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

/*
 Het klokkendoek: twee wijzerplaten met streepjes en cijfers, op een zwarte
 achtergrond. De wijzers zelf zijn geen tekening maar twee dunne meshes die
 draaien — dan hoeft er geen doek per beeld naar de kaart en loopt de naald
 vloeiend mee.
*/
function klokDoek(maxKmu = 160) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#17191d'; g.fillRect(0, 0, 512, 256);
  g.strokeStyle = '#2c3037'; g.lineWidth = 4;
  g.strokeRect(2, 2, 508, 252);
  const plaat = (cx, labels, stap) => {
    g.save(); g.translate(cx, 128);
    g.fillStyle = '#101215'; g.beginPath(); g.arc(0, 0, 104, 0, 6.283); g.fill();
    g.strokeStyle = '#454a52'; g.lineWidth = 3;
    g.beginPath(); g.arc(0, 0, 104, 0, 6.283); g.stroke();
    // schaalverdeling van 225° tot -45°, zoals op een echte teller
    for (let i = 0; i <= labels; i++) {
      const h = (225 - (270 * i) / labels) * Math.PI / 180;
      const co = Math.cos(h), si = -Math.sin(h);
      const groot = i % 2 === 0;
      g.strokeStyle = groot ? '#e6e9ee' : '#8b9098';
      g.lineWidth = groot ? 5 : 3;
      g.beginPath();
      g.moveTo(co * 88, si * 88); g.lineTo(co * (groot ? 68 : 76), si * (groot ? 68 : 76));
      g.stroke();
      if (groot) {
        g.fillStyle = '#dfe3e9';
        g.font = '600 22px system-ui, sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(i * stap), co * 50, si * 50);
      }
    }
    g.restore();
  };
  plaat(128, 8, maxKmu / 8); // snelheidsmeter 0-160 km/u, bij de Ferrari 0-320
  plaat(384, 8, 1);         // toerenteller 0-8 (× 1000)
  g.fillStyle = '#9aa0a8';
  g.font = '600 15px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText('km/u', 128, 222);
  g.fillText('× 1000', 384, 222);
  /*
   (stap 147) Tussen de klokken: brandstof en temperatuur als staafjes, de pijltjes van de richtingaanwijzers en een
   rij controlelampjes onderin (uit, donker getint: een teller staat niet als een kerstboom aan).
  */
  const staaf = (x, label, vol) => {
    g.fillStyle = '#0b0d10'; g.fillRect(x - 8, 66, 16, 116);
    g.fillStyle = '#e6e9ee'; g.fillRect(x - 5, 68 + 112 * (1 - vol), 10, 112 * vol - 2);
    for (let i = 1; i < 4; i++) { g.fillStyle = '#5a5f67'; g.fillRect(x - 8, 66 + i * 29, 4, 2); }
    g.fillStyle = '#9aa0a8'; g.font = '600 12px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(label, x, 198);
  };
  staaf(244, 'F', 0.72); staaf(268, '°C', 0.5);
  const pijl = (x, r) => { g.fillStyle = '#1f5a2c'; g.beginPath(); g.moveTo(x + r * 10, 34); g.lineTo(x, 26); g.lineTo(x, 42); g.closePath(); g.fill(); };
  pijl(240, -1); pijl(272, 1);
  for (const [x, kleur] of [[196, '#5a2020'], [222, '#5a4a18'], [290, '#1d3a5a'], [316, '#5a2020']]) {
    g.fillStyle = kleur; g.beginPath(); g.arc(x, 240, 6, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
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
 De Ferrari van binnen (stap 127, gevraagd: "Ferrari heeft geen goed interieur"). Hij kreeg het interieur van
 een hatchback: een stoffen bank achterin, een hoedenplank, en stoelen met een rugleuning van 1,39 m terwijl zijn
 dak op 1,15 m ligt — de hoofdsteunen staken door het dak. Nu twee lage kuipstoelen in rood leer met zwarte
 wangen, een tunnel in koolstof met de rode startknop en drie knoppen, een schot achter de stoelen, en
 dashboard en stuur in zijn eigen stijl (zie hierboven).
*/
function sportBinnen(groep, M, maat, { vloerY, hemelY, cabZ, achter, stuurX }) {
  const W = maat.W;
  const zit = vloerY + 0.07;
  const rugTop = Math.min(hemelY - 0.06, (maat.oog ? maat.oog.y : 1.02) + 0.06);
  const rugH = rugTop - zit - 0.03;
  for (const sx of [stuurX, -stuurX]) {
    doos(groep, M.leer, 0.40, 0.08, 0.48, sx, zit, cabZ - 0.08);                          // zitting
    doos(groep, M.leer, 0.40, rugH, 0.08, sx, zit + 0.03 + rugH / 2, cabZ + 0.20, 0.22);  // rug, ver achterover
    for (const w of [-1, 1]) {
      // de wangen: hoog langs de zitting en de rug, in zwart leer
      doos(groep, M.leerZwart, 0.07, 0.15, 0.46, sx + w * 0.235, zit + 0.04, cabZ - 0.08);
      doos(groep, M.leerZwart, 0.07, rugH * 0.8, 0.12, sx + w * 0.235, zit + 0.03 + rugH * 0.42, cabZ + 0.19, 0.22);
    }
    // de uitsparing voor de gordels, bovenin de rug
    doos(groep, M.leerZwart, 0.08, 0.05, 0.085, sx, rugTop - 0.09, cabZ + 0.215 + Math.sin(0.22) * rugH * 0.4, 0.22);
  }
  // de tunnel tussen de stoelen, met de brug van knoppen
  doos(groep, M.carbon, 0.24, 0.20, 0.95, 0, vloerY + 0.10, cabZ - 0.30);
  doos(groep, M.carbon, 0.20, 0.05, 0.30, 0, vloerY + 0.24, cabZ - 0.58, -0.25);
  const knop = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 12), M.knop);
  knop.position.set(0, vloerY + 0.28, cabZ - 0.62); knop.rotation.x = -0.25; groep.add(knop);
  for (const dx of [-0.06, 0, 0.06]) doos(groep, M.chroom, 0.035, 0.018, 0.035, dx, vloerY + 0.215, cabZ - 0.42);
  // het schot achter de stoelen (de motor ligt erachter), en de hoedenplank in koolstof
  doos(groep, M.carbon, W - 0.26, maat.schouderY - vloerY + 0.06, 0.04, 0, (vloerY + maat.schouderY) / 2 + 0.03, achter + 0.06);
  doos(groep, M.carbon, W - 0.28, 0.03, 0.30, 0, maat.schouderY + 0.02, achter + 0.22);
  // een kap over de klokken
  doos(groep, M.carbon, 0.40, 0.03, 0.14, stuurX, maat.schouderY + 0.135, (cabZ - maat.cabL / 2 + 0.30) + 0.12, -0.12);
}

/**
 * Het interieur van één auto. `kind` is 'hatch', 'van' of 'truck'.
 *
 * Levert { groep, update(car) } — `update` zet het stuur en de wijzers op hun
 * plek. Hang `groep` in de carrosseriegroep van het model (js/carmodel.js), dan
 * helt het mee in de bocht.
 */
export function maakAutoBinnen(maat) {
  const M = materialen();
  if (!M.klok) M.klok = new THREE.MeshBasicMaterial({ map: klokDoek(), side: THREE.DoubleSide });
  // de Ferrari (js/garage.js) rijdt ruim 200: zijn teller loopt tot 320
  if (maat.sport && !M.klokSport) M.klokSport = new THREE.MeshBasicMaterial({ map: klokDoek(320), side: THREE.DoubleSide });
  const maxKmu = maat.sport ? 320 : 160;
  const { W, dakY, schouderY, cabZ, cabL, dorpelY } = maat;
  const groep = new THREE.Group();

  const binnenX = W / 2 - 0.145;          // binnenkant van het portier, binnen de flankwand
  const vloerY = dorpelY + 0.16;          // de vloer ligt net boven de dorpelbalk
  const hemelY = dakY - 0.045;
  const voor = cabZ - cabL / 2 + 0.30;    // onderkant voorruit
  /*
   Let op de richting van z: de neus van de auto ligt bij −z, dus wat verder
   naar achteren staat heeft een gróter getal. `voor` is de onderkant van de
   voorruit; het dashboard staat daar net achter, het stuur weer achter het
   dashboard, en de bestuurder achter het stuur. Ging dat mis, dan hing het
   stuur onder de motorkap — en dat was precies wat er de eerste keer gebeurde.
  */
  const dashZ = voor + 0.06;              // hart van de dashboardkuip
  const dashAchter = dashZ + 0.10;        // het vlak dat naar de bestuurder kijkt
  const stuurZ = voor + 0.265;            // het stuur, tussen dashboard en stoel
  const achter = cabZ + cabL / 2 - 0.20;  // achterruit
  const stuurX = -(W / 2 - 0.46);         // dezelfde kant als het oogpunt

  // ---------------------------------------------------------------- schil
  // vloer, hemel en de twee deurpanelen: dit is wat voorkomt dat je door de
  // auto heen naar buiten kijkt
  doos(groep, M.vloer, W - 0.20, 0.04, cabL + 0.5, 0, vloerY, cabZ);
  // (de Ferrari heeft een smalle koepel van 1,40 × 1,20 m: een hemel over de hele cabine stak door zijn dak, stap 127)
  if (maat.sport) doos(groep, M.carbon, 1.28, 0.03, 1.05, 0, hemelY - 0.02, cabZ - 0.05);
  else doos(groep, M.hemel, W - 0.26, 0.03, cabL - 0.10, 0, hemelY, cabZ);
  const deurMat = maat.sport ? M.leerZwart : M.kunststof;
  for (const sx of [-1, 1]) {
    // portierpaneel tot aan de raamlijn
    doos(groep, deurMat, 0.035, schouderY - vloerY + 0.06, cabL - 0.30, sx * binnenX, (vloerY + schouderY) / 2 + 0.03, cabZ);
    // armsteun met een greep erin
    doos(groep, M.kunststof, 0.075, 0.075, 0.42, sx * (binnenX - 0.045), schouderY - 0.13, cabZ - 0.12);
    // (stap 147: de trekgreep zwart; in chroom lichtte hij van de stoel af op als een witte balk)
    doos(groep, M.zwart, 0.05, 0.035, 0.15, sx * (binnenX - 0.06), schouderY - 0.05, cabZ - 0.28);
    /*
     (stap 147) Het paneel kreeg wat een deur heeft: een vlak stof onder de armsteun, de raamschakelaar voor op de
     armsteun, een luidspreker laag vooraan en een vak onderin.
    */
    doos(groep, maat.sport ? M.carbon : M.stof, 0.012, 0.14, Math.min(0.55, cabL * 0.32), sx * (binnenX - 0.022), schouderY - 0.27, cabZ - 0.05);
    doos(groep, M.zwart, 0.03, 0.016, 0.07, sx * (binnenX - 0.065), schouderY - 0.085, cabZ - 0.29);
    const gaas = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), M.gaas);
    gaas.position.set(sx * (binnenX - 0.0185), vloerY + 0.15, cabZ - cabL / 2 + 0.47);
    gaas.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2; gaas.name = 'luidspreker';
    groep.add(gaas);
    doos(groep, M.kunststof, 0.045, 0.10, Math.min(0.42, cabL * 0.25), sx * (binnenX - 0.035), vloerY + 0.11, cabZ + 0.08);
  }
  /*
   De binnenkant van de stijlen (stap 147). Van binnen keek je tegen de lak van de A- en B-stijl aan (blauw, rood, wat de
   auto ook had): nu zit er, zoals in elke auto, een bekleding in de kleur van de hemel overheen. De maten komen uit
   dezelfde formule als de stijlen zelf (js/carmodel.js, autoGeoms); de vrachtwagen, de ambulance en de Ferrari hebben
   een eigen cabine en houden hun stijl.
  */
  if (!maat.sport && !maat.truck && !maat.amb && maat.stijlH && maat.aHoek != null) {
    const x0 = W / 2 - (maat.bus ? 0.10 : 0.075), sH = maat.stijlH;
    for (const sx of [-1, 1]) {
      const a = doos(groep, M.hemel, 0.03, sH + 0.10, 0.13, sx * (x0 - 0.06), (schouderY + dakY) / 2, cabZ - cabL / 2 + 0.30 - Math.sin(maat.aHoek) * sH / 2, maat.aHoek);
      a.name = 'stijlbekleding';
      const b = doos(groep, M.hemel, 0.03, sH, 0.10, sx * (x0 - 0.05), (schouderY + dakY) / 2, cabZ + (maat.bus ? 0.30 : 0.18));
      b.name = 'stijlbekleding';
    }
  }

  // ------------------------------------------------------------- dashboard
  // de kuip onder de voorruit, met een schuine bovenkant naar het glas toe
  const dashMat = maat.sport ? M.carbon : M.kunststof;
  doos(groep, dashMat, W - 0.20, 0.26, 0.20, 0, schouderY - 0.10, dashZ);
  /*
   Het schot onder het dashboard. Zonder dit keek je vanaf de stoel onder het
   dashboard door tegen de binnenkant van het plaatwerk aan: een rode vlakte
   waar het voetenhok hoort te zitten.
  */
  doos(groep, M.kunststof, W - 0.22, schouderY - 0.23 - vloerY, 0.05, 0, (vloerY + schouderY - 0.23) / 2, dashZ + 0.02);
  doos(groep, maat.sport ? M.leerZwart : M.kunststof, W - 0.20, 0.06, 0.30, 0, schouderY + 0.03, dashZ - 0.08, -0.42);
  // middenconsole met ventilatieroosters en een radiootje (stap 147: echte lamellen en een verlicht scherm)
  doos(groep, M.zwart, 0.34, 0.20, 0.04, 0, schouderY - 0.10, dashAchter);
  for (const dx of [-0.075, 0.075]) doos(groep, M.rooster, 0.13, 0.055, 0.03, dx, schouderY - 0.035, dashAchter + 0.012).name = 'rooster';
  const radio = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.0975), M.radio);
  radio.position.set(0, schouderY - 0.135, dashAchter + 0.021); radio.name = 'radio';
  groep.add(radio);
  for (const sx of [-1, 1]) doos(groep, M.rooster, 0.18, 0.07, 0.03, sx * (W / 2 - 0.32), schouderY - 0.02, dashAchter).name = 'rooster';
  // de alarmlichtknop tussen de roosters
  doos(groep, M.knop, 0.03, 0.018, 0.012, 0, schouderY + 0.005, dashAchter + 0.01);
  if (!maat.sport) {
    // het handschoenenkastje aan de kant van de bijrijder: een deksel met een naad eromheen en een greep
    doos(groep, M.zwart, 0.42, 0.16, 0.006, -stuurX, schouderY - 0.17, dashAchter + 0.002);
    doos(groep, M.kunststof, 0.40, 0.14, 0.012, -stuurX, schouderY - 0.17, dashAchter + 0.006).name = 'handschoenenkastje';
    doos(groep, M.chroom, 0.09, 0.015, 0.012, -stuurX, schouderY - 0.12, dashAchter + 0.014);
  }
  if (!maat.sport) {
    // console tussen de stoelen, met de pook erop
    doos(groep, M.kunststof, 0.30, 0.16, 0.58, 0, vloerY + 0.12, cabZ - 0.30);
    /*
     De pook (stap 146): een dunne ronde stang met een bol en een rubberen hoes, geen balkje van 3,5 cm in het vierkant
     met een blokje erop: van de stoel af leek dat een stijl midden in de auto.
    */
    const hoes = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.05, 0.07, 12), M.zwart);
    hoes.position.set(0, vloerY + 0.235, cabZ - 0.40); groep.add(hoes);
    const stang = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.15, 8), M.chroom);
    stang.position.set(0, vloerY + 0.34, cabZ - 0.41); stang.rotation.x = -0.12; groep.add(stang);
    const bol = new THREE.Mesh(new THREE.SphereGeometry(0.028, 14, 10), M.zwart);
    bol.position.set(0, vloerY + 0.42, cabZ - 0.42); groep.add(bol);
    // handrem
    doos(groep, M.zwart, 0.035, 0.035, 0.24, 0.02, vloerY + 0.24, cabZ - 0.12, -0.35);
    // (stap 147) twee bekerhouders voor de pook
    for (const dx of [-0.07, 0.07]) {
      const rand = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.012, 18), M.zwart);
      rand.position.set(dx, vloerY + 0.205, cabZ - 0.53); rand.name = 'bekerhouder'; groep.add(rand);
    }
  }

  // -------------------------------------------------------------- klokken
  const klok = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.15), maat.sport ? M.klokSport : M.klok);
  klok.position.set(stuurX, schouderY + 0.035, dashAchter + 0.012);
  klok.rotation.x = -0.30;
  groep.add(klok);
  // een randje eromheen, zodat het niet als een sticker op het dashboard plakt
  doos(groep, M.zwart, 0.34, 0.19, 0.02, stuurX, schouderY + 0.035, dashAchter, -0.30);
  const naalden = [];
  for (const dx of [-0.075, 0.075]) {
    const n = new THREE.Mesh(new THREE.PlaneGeometry(0.010, 0.062), M.naald);
    // het draaipunt onderaan de naald: de geometrie schuift omhoog, de mesh draait
    n.geometry.translate(0, 0.025, 0);
    n.position.set(stuurX + dx, schouderY + 0.035, dashAchter + 0.020);
    n.rotation.x = -0.30;
    klok.parent.add(n);
    naalden.push(n);
  }

  // ----------------------------------------------------------------- stuur
  /*
   Het stuur zit op een kolom en staat scheef — een stuur dat recht overeind
   staat leest als een boot. De krans is een torus, met drie spaken en een naaf
   erin, en het geheel draait om zijn eigen as als je stuurt.
  */
  const stuur = new THREE.Group();
  stuur.position.set(stuurX, schouderY - 0.02, stuurZ);
  stuur.rotation.x = -0.42;
  const R = maat.truck ? 0.21 : 0.158;
  // (stap 147: een dikkere, rondere krans; zestien hoeken lazen als een achthoek)
  const krans = new THREE.Mesh(new THREE.TorusGeometry(R, 0.021, 8, 32), M.zwart);
  stuur.add(krans);
  for (let i = 0; i < 3; i++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.026, R * 0.95, 0.018), M.zwart);
    sp.position.y = -R * 0.47;
    sp.rotation.z = i * Math.PI * 2 / 3;
    sp.position.set(Math.sin(i * Math.PI * 2 / 3) * R * 0.47, -Math.cos(i * Math.PI * 2 / 3) * R * 0.47, 0);
    stuur.add(sp);
  }
  const naaf = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.062, 0.04, 20), M.kunststof);
  naaf.rotation.x = Math.PI / 2;
  stuur.add(naaf);
  if (!maat.sport) {
    // een rond embleempje op de claxon (geen merk)
    const embleem = new THREE.Mesh(new THREE.CircleGeometry(0.016, 16), M.chroom);
    embleem.position.z = 0.021; stuur.add(embleem);
  }
  if (maat.sport) {
    // het gele schildje in de naaf, een rode streep bovenop de krans, en de schakelflippers erachter
    const schild = new THREE.Mesh(new THREE.CircleGeometry(0.03, 14), M.geel);
    schild.position.z = 0.019; stuur.add(schild);
    const streep = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.042), M.leer);
    streep.position.set(0, R, 0); stuur.add(streep);
    for (const sx of [-1, 1]) {
      const fl = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.13, 0.008), M.chroom);
      fl.position.set(sx * (R * 0.72), R * 0.18, -0.045); stuur.add(fl);
    }
  }
  groep.add(stuur);
  // de kolom eronder
  doos(groep, M.zwart, 0.07, 0.07, 0.24, stuurX, schouderY - 0.155, stuurZ - 0.09, -0.42);
  // (stap 147) de hendels voor richtingaanwijzer en ruitenwissers, links en rechts uit de kolom
  for (const sx of [-1, 1]) {
    const hendel = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.15, 8), M.zwart);
    hendel.position.set(stuurX + sx * 0.11, schouderY - 0.085, stuurZ - 0.05);
    hendel.rotation.z = sx * 1.35; hendel.name = 'hendel';
    groep.add(hendel);
  }

  // ---------------------------------------------------------------- stoelen
  /*
   (stap 147) Een stoel met geweven banen in het midden en effen, iets hogere wangen opzij, en een hoofdsteun op twee
   stangetjes. De rug en de hoofdsteun blijven onder de hemel (in de hatchback stak de rug er 2 cm doorheen).
  */
  const stoel = (sx) => {
    const zit = vloerY + 0.16;
    doos(groep, M.stof, 0.30, 0.11, 0.46, sx, zit, cabZ - 0.10).name = 'zitting';
    for (const w of [-1, 1]) doos(groep, M.stofRand, 0.08, 0.15, 0.48, sx + w * 0.19, zit + 0.02, cabZ - 0.10);
    const rugTop = Math.min(zit + 0.62, hemelY - 0.14), rugH = rugTop - (zit + 0.05);
    doos(groep, M.stof, 0.30, rugH, 0.10, sx, zit + 0.05 + rugH / 2, cabZ + 0.16, 0.10);
    for (const w of [-1, 1]) doos(groep, M.stofRand, 0.08, rugH, 0.13, sx + w * 0.18, zit + 0.05 + rugH / 2, cabZ + 0.15, 0.10);
    const hoofdY = Math.min(rugTop + 0.09, hemelY - 0.07);
    doos(groep, M.stofRand, 0.22, 0.11, 0.09, sx, hoofdY, cabZ + 0.13 + Math.sin(0.10) * rugH / 2, 0.10);   // hoofdsteun
    for (const w of [-1, 1]) {
      const stang = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, Math.max(0.02, hoofdY - rugTop), 6), M.chroom);
      stang.position.set(sx + w * 0.06, (hoofdY + rugTop) / 2 - 0.03, cabZ + 0.13 + Math.sin(0.10) * rugH / 2); groep.add(stang);
    }
  };
  if (maat.sport) sportBinnen(groep, M, maat, { vloerY, hemelY, cabZ, achter, stuurX, dashZ, dashAchter, stuurZ, voor });
  else {
    stoel(stuurX);
    stoel(-stuurX);
    // achterbank en hoedenplank
    doos(groep, M.stof, W - 0.30, 0.11, 0.42, 0, vloerY + 0.16, achter - 0.10);
    doos(groep, M.stof, W - 0.32, 0.48, 0.10, 0, vloerY + 0.42, achter + 0.16, 0.12);
    doos(groep, M.kunststof, W - 0.28, 0.03, 0.34, 0, schouderY - 0.02, achter + 0.30);
  }

  /*
   Spiegel en zonnekleppen. Ze hangen aan de hemel, maar in een bestelbus zit de
   bestuurder veel dichter onder het dak dan in een hatchback — daar hingen ze
   dwars door het beeld. Ze houden daarom altijd een handbreedte boven het
   oogpunt, en blijven tegelijk onder de hemel.
  */
  const oogY = (maat.oog && maat.oog.y) || (schouderY + 0.27);
  const spiegelY = Math.min(hemelY - 0.03, Math.max(hemelY - 0.075, oogY + 0.10));
  doos(groep, M.zwart, 0.22, 0.065, 0.035, 0, spiegelY, voor + 0.02);
  // (stap 146) het spiegelglas aan de kant van de bestuurder, een tikje schuin naar hem toe
  const glasSp = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.05), M.chroom);
  glasSp.position.set(0, spiegelY, voor + 0.039); glasSp.rotation.y = -0.12; groep.add(glasSp);
  const klepY = Math.min(hemelY - 0.022, Math.max(hemelY - 0.035, oogY + 0.05));
  if (!maat.sport) {
    // (stap 147) het binnenlampje in de hemel, en een handgreep boven de deur van de bijrijder
    doos(groep, M.kunststof, 0.14, 0.02, 0.08, 0, hemelY - 0.025, cabZ - 0.05);
    doos(groep, M.lampglas, 0.10, 0.006, 0.05, 0, hemelY - 0.037, cabZ - 0.05).name = 'binnenlampje';
    doos(groep, M.kunststof, 0.03, 0.025, 0.20, -stuurX > 0 ? binnenX - 0.07 : -(binnenX - 0.07), hemelY - 0.07, cabZ - 0.05).name = 'handgreep';
  }
  // de vloermatten voor de voorstoelen, van het dashboard tot de zitting
  {
    const z0 = dashZ + 0.13, z1 = cabZ - 0.30, l = Math.max(0.2, z1 - z0);
    for (const sx of [stuurX, -stuurX]) doos(groep, M.mat, 0.40, 0.012, l, sx, vloerY + 0.026, (z0 + z1) / 2).name = 'vloermat';
  }
  if (!maat.sport) for (const sx of [-1, 1]) {
    doos(groep, M.hemel, 0.36, 0.015, 0.16, sx * 0.34, klepY, voor + 0.08, -0.16);
  }

  /*
   Bijwerken: het stuur draait mee met de wielen en de wijzers lopen met de
   snelheid en de toeren mee. Drie kwartslagen stuuruitslag op elke kant is wat
   een auto in dit spel doet; de meters gaan van 225° naar −45°, dezelfde
   verdeling als op het doek.
  */
  const hoekVan = (deel) => (225 - 270 * Math.max(0, Math.min(1, deel))) * Math.PI / 180;
  let getoondeSnelheid = 0, getoondeToeren = 0;
  function update(car, dt = 1 / 60) {
    const uitslag = (car && car.steer) || 0;
    stuur.rotation.z = -uitslag * 4.2;
    const kmu = Math.abs((car && car.speed) || 0) * 3.6;
    const top = ((car && car.topSnelheid) || 24) * 3.6;
    // de toerenteller volgt de motor: hoger verzet, lagere toeren
    const toeren = top > 0 ? 0.12 + 0.75 * ((kmu / top) % 0.34) / 0.34 : 0.12;
    const soepel = Math.min(1, dt * 8);
    getoondeSnelheid += (Math.min(1, kmu / maxKmu) - getoondeSnelheid) * soepel;
    getoondeToeren += (toeren - getoondeToeren) * soepel;
    // de naald staat in het vlak van de klok, dus hij draait om zijn z-as
    naalden[0].rotation.z = -hoekVan(getoondeSnelheid) + Math.PI / 2;
    naalden[1].rotation.z = -hoekVan(getoondeToeren) + Math.PI / 2;
  }

  return { groep, stuur, klok, naalden, update };
}
