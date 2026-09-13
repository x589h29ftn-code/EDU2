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
  MAT = {
    // grijs kunststof: dashboard, deurpanelen, console
    kunststof: std(0x585c64, 0.92, binnenlicht(0x585c64)),
    // lichter voor de hemel, want die vangt het meeste licht
    hemel: std(0x9ea2a9, 0.95, binnenlicht(0x9ea2a9, 0.42)),
    // stof van de stoelen
    stof: std(0x646975, 0.98, binnenlicht(0x646975, 0.30)),
    vloer: std(0x3a3d43, 1, binnenlicht(0x3a3d43, 0.22)),
    zwart: std(0x222429, 0.7, binnenlicht(0x222429, 0.25)),
    chroom: std(0xc6c9cf, 0.35, { metalness: 0.7, ...binnenlicht(0xc6c9cf, 0.2) }),
    klok: null,     // wordt gezet zodra het doek er is
    naald: new THREE.MeshBasicMaterial({ color: 0xe8453a, side: THREE.DoubleSide }),
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
function klokDoek() {
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
  plaat(128, 8, 20);        // snelheidsmeter 0-160 km/u
  plaat(384, 8, 1);         // toerenteller 0-8 (× 1000)
  g.fillStyle = '#9aa0a8';
  g.font = '600 15px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText('km/u', 128, 222);
  g.fillText('× 1000', 384, 222);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// een doos die naar binnen kijkt
function doos(groep, mat, b, h, d, x, y, z, rx = 0) {
  const g = new THREE.BoxGeometry(b, h, d);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z);
  if (rx) m.rotation.x = rx;
  return groep.add(m), m;
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
  doos(groep, M.hemel, W - 0.26, 0.03, cabL - 0.10, 0, hemelY, cabZ);
  for (const sx of [-1, 1]) {
    // portierpaneel tot aan de raamlijn
    doos(groep, M.kunststof, 0.035, schouderY - vloerY + 0.06, cabL - 0.30, sx * binnenX, (vloerY + schouderY) / 2 + 0.03, cabZ);
    // armsteun met een greep erin
    doos(groep, M.kunststof, 0.075, 0.075, 0.42, sx * (binnenX - 0.045), schouderY - 0.13, cabZ - 0.12);
    doos(groep, M.chroom, 0.05, 0.035, 0.15, sx * (binnenX - 0.06), schouderY - 0.05, cabZ - 0.28);
  }

  // ------------------------------------------------------------- dashboard
  // de kuip onder de voorruit, met een schuine bovenkant naar het glas toe
  doos(groep, M.kunststof, W - 0.20, 0.26, 0.20, 0, schouderY - 0.10, dashZ);
  /*
   Het schot onder het dashboard. Zonder dit keek je vanaf de stoel onder het
   dashboard door tegen de binnenkant van het plaatwerk aan: een rode vlakte
   waar het voetenhok hoort te zitten.
  */
  doos(groep, M.kunststof, W - 0.22, schouderY - 0.23 - vloerY, 0.05, 0, (vloerY + schouderY - 0.23) / 2, dashZ + 0.02);
  doos(groep, M.kunststof, W - 0.20, 0.06, 0.30, 0, schouderY + 0.03, dashZ - 0.08, -0.42);
  // middenconsole met ventilatieroosters en een radiootje
  doos(groep, M.zwart, 0.34, 0.12, 0.04, 0, schouderY - 0.08, dashAchter);
  doos(groep, M.chroom, 0.26, 0.05, 0.02, 0, schouderY - 0.08, dashAchter + 0.015);
  for (const sx of [-1, 1]) doos(groep, M.zwart, 0.18, 0.07, 0.03, sx * (W / 2 - 0.32), schouderY - 0.02, dashAchter);
  // console tussen de stoelen, met de pook erop
  doos(groep, M.kunststof, 0.30, 0.16, 0.58, 0, vloerY + 0.12, cabZ - 0.30);
  doos(groep, M.zwart, 0.035, 0.20, 0.035, 0, vloerY + 0.28, cabZ - 0.40);
  doos(groep, M.zwart, 0.055, 0.05, 0.055, 0, vloerY + 0.38, cabZ - 0.40);
  // handrem
  doos(groep, M.zwart, 0.035, 0.035, 0.24, 0.02, vloerY + 0.24, cabZ - 0.12, -0.35);

  // -------------------------------------------------------------- klokken
  const klok = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.15), M.klok);
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
  const krans = new THREE.Mesh(new THREE.TorusGeometry(R, 0.019, 6, 16), M.zwart);
  stuur.add(krans);
  for (let i = 0; i < 3; i++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.026, R * 0.95, 0.018), M.zwart);
    sp.position.y = -R * 0.47;
    sp.rotation.z = i * Math.PI * 2 / 3;
    sp.position.set(Math.sin(i * Math.PI * 2 / 3) * R * 0.47, -Math.cos(i * Math.PI * 2 / 3) * R * 0.47, 0);
    stuur.add(sp);
  }
  const naaf = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.035, 10), M.kunststof);
  naaf.rotation.x = Math.PI / 2;
  stuur.add(naaf);
  groep.add(stuur);
  // de kolom eronder
  doos(groep, M.zwart, 0.07, 0.07, 0.24, stuurX, schouderY - 0.155, stuurZ - 0.09, -0.42);

  // ---------------------------------------------------------------- stoelen
  const stoel = (sx) => {
    const zit = vloerY + 0.16;
    doos(groep, M.stof, 0.46, 0.11, 0.48, sx, zit, cabZ - 0.10);
    doos(groep, M.stof, 0.44, 0.58, 0.10, sx, zit + 0.33, cabZ + 0.16, 0.10);
    doos(groep, M.stof, 0.22, 0.10, 0.10, sx, zit + 0.66, cabZ + 0.12);   // hoofdsteun
  };
  stoel(stuurX);
  stoel(-stuurX);
  // achterbank en hoedenplank
  doos(groep, M.stof, W - 0.30, 0.11, 0.42, 0, vloerY + 0.16, achter - 0.10);
  doos(groep, M.stof, W - 0.32, 0.48, 0.10, 0, vloerY + 0.42, achter + 0.16, 0.12);
  doos(groep, M.kunststof, W - 0.28, 0.03, 0.34, 0, schouderY - 0.02, achter + 0.30);

  /*
   Spiegel en zonnekleppen. Ze hangen aan de hemel, maar in een bestelbus zit de
   bestuurder veel dichter onder het dak dan in een hatchback — daar hingen ze
   dwars door het beeld. Ze houden daarom altijd een handbreedte boven het
   oogpunt, en blijven tegelijk onder de hemel.
  */
  const oogY = (maat.oog && maat.oog.y) || (schouderY + 0.27);
  const spiegelY = Math.min(hemelY - 0.03, Math.max(hemelY - 0.075, oogY + 0.10));
  doos(groep, M.zwart, 0.22, 0.065, 0.035, 0, spiegelY, voor + 0.02);
  const klepY = Math.min(hemelY - 0.022, Math.max(hemelY - 0.035, oogY + 0.05));
  for (const sx of [-1, 1]) {
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
    getoondeSnelheid += (Math.min(1, kmu / 160) - getoondeSnelheid) * soepel;
    getoondeToeren += (toeren - getoondeToeren) * soepel;
    // de naald staat in het vlak van de klok, dus hij draait om zijn z-as
    naalden[0].rotation.z = -hoekVan(getoondeSnelheid) + Math.PI / 2;
    naalden[1].rotation.z = -hoekVan(getoondeToeren) + Math.PI / 2;
  }

  return { groep, stuur, klok, naalden, update };
}
