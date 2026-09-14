/*
 Varen.

 Op het water liggen twee boten die je kunt besturen: een open Friese motorsloep
 van ruim zes meter, met een buitenboordmotor, een stuurconsole en een houten
 vlonder. Eén ligt aan de steiger in IJlst, de ander aan de Geeuwkade vlak bij de
 waterzuivering. Je stapt in met E, net als bij een auto, en dan vaar je.

 Een boot is met opzet **traag**. De sloep haalt zeven meter per seconde — nog
 geen kwart van wat een auto doet — en hij komt daar ook niet in één tel. Dat is
 niet om je te pesten: een boot is straks het vervoermiddel voor een lading die
 niet op de weg mag komen, en dan hoort de overtocht iets te kosten. Wat je er
 voor terugkrijgt is dat er op het water geen wegversperring staat.

 Hoe hij vaart, en waarom het anders voelt dan een auto:

   * **De schroef duwt, de romp remt.** Gas geven zet een kracht op de romp; het
     water zet daar een weerstand tegenover die met het kwadraat van de snelheid
     oploopt. Daardoor loopt hij traag op gang, houdt hij zijn snelheid vast als
     je het gas eraf haalt, en staat hij pas na tientallen meters stil. Er zit
     geen rem op een boot.
   * **Langsscheeps glijdt hij, dwarsscheeps niet.** De weerstand is in de
     lengterichting klein en dwars op de romp groot — dat is precies wat een kiel
     doet. Daardoor zwenkt de achtersteven in een bocht naar buiten en zeilt hij
     de bocht nog een stukje uit nadat je het roer recht hebt gezet.
   * **Het roer werkt alleen als er water langs stroomt.** Stilliggend draai je
     met het roer niets; de buitenboordmotor kan hem wel op zijn plek ronddraaien
     als je gas geeft, en dat is ook hoe je hem van de kant af krijgt.
   * **Achteruit is traag en onwillig**, zoals achteruit op een boot hoort.

 De vaarweg komt uit de BGT: `vaarbaar(x, z)` in js/world.js. Dat is net iets
 anders dan `pointInWater` — een boot vaart ónder een brug door (anders houdt de
 Geeuw bij elke brug op en kom je nergens), maar niet onder een steiger en niet
 door een duiker. Loopt de romp de kant in, dan stopt hij; je vaart hier niet de
 wal op.

 De plekken zijn uit de kaart gemeten, niet verzonnen:

   * Geeuw bij de RWZI — water op (−242, −330), oever op zes meter, en van daar
     kun je ruim 250.000 m² aan vaarwater bereiken.
   * IJlst — naast de steiger op (−1282, 1106); daar hangt 185.000 m² aan.
*/
import * as THREE from 'three';
import { vaarbaar } from './world.js';
import { geluid } from './audio.js';
import * as T from './textures.js';

// ---------- maten van de sloep (m) ----------
const LENGTE = 6.30;
const BREEDTE = 2.16;
const DIEPGANG = 0.62;          // van de waterlijn tot de kiel
const OPBOORD = 0.52;           // van de waterlijn tot het boord
const WATER_Y = -0.15;          // de waterspiegel in js/world.js
const VLOER = 0.09;             // de vlonder, net boven de waterlijn
const VOORDEK = 0.20;           // tot dit spant loopt het voordek
const ACHTERDEK = 0.88;         // en vanaf dit spant het achterdek

// ---------- hoe hij vaart ----------
const TOP = 7.0;                // m/s vooruit — ruim 25 km/u, en dat is veel op een vaart
const TOP_ACHTER = 2.2;
const STUW = 3.6;               // versnelling bij vol gas (m/s²), vóór de weerstand
const STUW_ACHTER = 1.5;
const LANGS = 0.065;            // rompweerstand in de lengte, × v²
const LANGS_VAST = 0.14;        // en een beetje vaste weerstand, anders drijft hij eeuwig door
const DWARS = 2.4;              // dwars op de romp remt het water veel harder af
const ROER = 0.52;              // hoeveel het roer geeft bij volle vaart (rad/s)
const ROER_TRAAG = 3.2;         // hoe snel het roer zelf meedraait
const SCHROEF_DRAAI = 0.34;     // draaien op de plek, op de schroef alleen
const HELLING = 0.22;           // hoever hij in de bocht naar buiten hangt (rad bij vol roer)

// ---------- instappen ----------
/*
 Zo dicht bij de boot mag je instappen. Negen meter lijkt veel voor "ernaast
 staan", maar een boot ligt nu eenmaal in het water en daar loop je niet in:
 vanaf de kade is het hart van de romp al gauw zes meter van je vandaan, met de
 steiger ertussen. Korter en je kunt niet aan boord. js/main.js geeft de auto
 voorrang als die dichterbij staat, zodat E naast je eigen auto ook echt die
 auto pakt.
*/
const INSTAP = 9.0;

/*
 De twee ligplaatsen. `yaw` is de koers waarin de boot ligt: de vaargeul is ter
 plekke opgemeten (tools, 14 sep 2026) en de boot ligt met zijn neus in de geul,
 niet dwars erop. `steiger` zet er een houten aanlegsteiger bij; in IJlst ligt er
 al een in de BGT, bij de waterzuivering is de oever gewoon gras.
*/
export const LIGPLAATSEN = [
  {
    naam: 'Geeuw', x: -242, z: -330, yaw: -0.785, kleur: 0x1f4a6e, romp: 0xf0ede4,
    steiger: true, wal: { x: -236.5, z: -327.7 },
    hint: 'De sloep aan de Geeuwkade, achter de waterzuivering',
  },
  {
    naam: 'IJlst', x: -1282, z: 1106, yaw: 0.524, kleur: 0x2c5f3a, romp: 0xe8e4d8,
    steiger: false, wal: { x: -1283.8, z: 1096.8 },
    hint: 'De sloep aan de steiger in IJlst',
  },
];

/*
 De romp.

 Een boot is geen doos, en met een doos ziet het er ook naar uit. Deze romp
 wordt gelofd: over de lengte liggen spanten, elk spant is een halve
 superellips van het boord naar de kiel, en daartussen wordt een vel gespannen.
 Twee getallen doen het werk — hoe breed het spant is en hoe diep — en die lopen
 van een scherpe steven vooraan naar een vlakke spiegel achterin.

   t = 0  de steven: bijna geen breedte, ondiep, en hij steekt naar voren over
   t = 1  de spiegel: vol breed, vol diep, recht afgesneden

 `MACHT` bepaalt de kim: 2 geeft een halve cirkel, hoger maakt de bodem vlakker
 en de zij steiler. 2,7 is een sloepvorm — rond genoeg om een boot te zijn, vlak
 genoeg om stil te liggen.
*/
const SPANTEN = 22, HALVE = 9, MACHT = 2.7;
function rompVorm() {
  const posities = [], normalen = [], uvs = [], indices = [];
  // breedte en diepte per spant, en hoeveel het boord daar oploopt (de zeeg)
  const breed = (t) => BREEDTE / 2 * Math.pow(Math.sin(Math.min(1, t * 1.06) * Math.PI * 0.62), 0.58);
  const diep = (t) => DIEPGANG * (0.30 + 0.70 * Math.pow(Math.min(1, t * 1.15), 0.55));
  const zeeg = (t) => OPBOORD + 0.20 * Math.pow(1 - t, 2.2) + 0.05 * Math.pow(t, 3);
  // de steven loopt naar voren over, de spiegel staat een slag naar achteren
  const lang = (t) => (0.5 - t) * LENGTE + 0.10 * Math.pow(1 - t, 2.5) * LENGTE * 0.5;

  for (let i = 0; i < SPANTEN; i++) {
    const t = i / (SPANTEN - 1);
    const b = Math.max(0.035, breed(t)), d = diep(t), h = zeeg(t), x = lang(t);
    for (let j = 0; j < HALVE * 2 + 1; j++) {
      /*
       Van bakboordboord (u = −1) over de kiel (u = 0) naar stuurboord (u = +1).
       Boven de waterlijn loopt de zij bijna recht omhoog, eronder buigt hij als
       een superellips naar de kiel toe.
      */
      const u = j / HALVE - 1, a = Math.abs(u), zij = Math.sign(u) || 1;
      let br, y;
      if (a > 0.82) {                    // het stuk boven water: recht omhoog
        const f = (a - 0.82) / 0.18;
        br = b; y = -0 + h * f;
      } else {
        const p = a / 0.82;              // 0 kiel … 1 waterlijn
        br = b * Math.pow(1 - Math.pow(1 - p, MACHT), 1 / MACHT);
        y = -d * (1 - p) ** 1.25;
      }
      posities.push(x, y, br * zij);
      uvs.push(t * 2.4, (a + 1) * 0.5);
    }
  }
  const rij = HALVE * 2 + 1;
  for (let i = 0; i < SPANTEN - 1; i++) for (let j = 0; j < rij - 1; j++) {
    const a = i * rij + j, b = a + 1, c = a + rij, d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(posities, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  void normalen;
  return { geo: g, breed, diep, zeeg, lang };
}

/*
 Een dicht dek tussen bakboord en stuurboord, van spant t0 tot spant t1. Nodig
 voor het voordek en het achterdek: het water is één vlak vlak dat dwars door de
 boot heen gaat, dus alles van de romp onder de waterlijn is onzichtbaar. Zonder
 dek keek je bij de steven zo door de boot heen het water in.
*/
function dekVorm(vorm, t0, t1, n = 10) {
  const pos = [], idx = [], uv = [];
  for (let i = 0; i <= n; i++) {
    const t = t0 + (t1 - t0) * i / n;
    const b = Math.max(0.03, vorm.breed(t)), h = vorm.zeeg(t), x = vorm.lang(t);
    pos.push(x, h, -b, x, h, b);
    uv.push(t * 3, 0, t * 3, 1);
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Het boord: een plat vlak langs de bovenrand, zodat de romp geen papieren
// snijrand houdt en je iets hebt om de stootwillen aan te hangen.
function boordVorm(vorm, dikte = 0.085) {
  const pos = [], idx = [], uv = [];
  const N = SPANTEN;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const b = Math.max(0.035, vorm.breed(t)), h = vorm.zeeg(t), x = vorm.lang(t);
    /*
     Vlak bij de steven is de romp smaller dan het boord breed is; een strook van
     vaste breedte klapt daar over de hartlijn heen en dan ligt er een driehoekig
     voordek waar niemand om gevraagd heeft. De binnenkant komt daarom nooit
     verder naar binnen dan de helft van de romp.
    */
    const binnen = Math.max(b * 0.45, b - dikte * 1.9);
    for (const zij of [-1, 1]) {
      pos.push(x, h, (b + dikte * 0.5) * zij);
      pos.push(x, h, binnen * zij);
      uv.push(t * 3, 0, t * 3, 1);
    }
  }
  for (let i = 0; i < N - 1; i++) for (const k of [0, 2]) {
    const a = i * 4 + k, b = a + 1, c = a + 4, d = c + 1;
    if (k === 0) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function initBoten({ scene, player, hud }) {
  if (!scene) return null;

  const std = (o) => new THREE.MeshStandardMaterial(o);
  const vorm = rompVorm();
  const rompGeo = vorm.geo;
  const boordGeo = boordVorm(vorm);

  // materialen die alle boten delen; alleen de romp- en de dekkleur verschillen
  const gedeeld = {
    berghout: std({ color: 0x2a2724, roughness: 0.62 }),
    hout: std({ map: T.planks('#a8763f'), roughness: 0.78 }),
    donker: std({ color: 0x3a3b3d, roughness: 0.7 }),
    rvs: std({ color: 0xb9bec4, roughness: 0.28, metalness: 0.75 }),
    kussen: std({ color: 0xd8d3c4, roughness: 0.92 }),
    zwart: std({ color: 0x17181a, roughness: 0.55 }),
    rood: std({ color: 0xc0281f, emissive: 0x3a0c08, roughness: 0.4 }),
    groen: std({ color: 0x1f9c4a, emissive: 0x073a18, roughness: 0.4 }),
    wit: std({ color: 0xf4f2ec, roughness: 0.45 }),
    touw: std({ color: 0xcfc09a, roughness: 0.95 }),
  };
  for (const m of Object.values(gedeeld)) if (m.map) m.map.anisotropy = 4;

  // het schuim achter de boot: één zacht wit vlekje, veel keer opnieuw gebruikt
  const schuimMap = schuimTextuur();

  function bouwBoot(L) {
    const groep = new THREE.Group();
    /*
     De romp is getekend met de steven op +x en stuurboord op +z, want zo reken
     je een boot uit: langsscheeps eerst. Varen doet hij naar −z — dat is de
     richting die uit `yaw` komt, net als bij de auto's. De hele boot gaat daarom
     in een binnengroep die een kwartslag gedraaid staat. Buitenom blijft de
     groep de bewegingsrichting houden, zodat rollen om z en stampen om x precies
     de assen zijn die je verwacht.
    */
    const schip = new THREE.Group();
    schip.rotation.y = Math.PI / 2;
    groep.add(schip);
    const romp = new THREE.Mesh(rompGeo, std({ color: L.romp, roughness: 0.42, side: THREE.DoubleSide }));
    romp.castShadow = true; romp.receiveShadow = true;
    schip.add(romp);

    // berghout: de donkere band net onder het boord, die elke sloep heeft
    const berg = new THREE.Mesh(boordGeo, gedeeld.berghout);
    berg.position.y = -0.055; berg.scale.set(1, 1, 1.035);
    schip.add(berg);
    const boord = new THREE.Mesh(boordGeo, std({ color: L.kleur, roughness: 0.45 }));
    boord.castShadow = true;
    schip.add(boord);

    /*
     Het voordek en het achterdek. Ze zitten er niet alleen omdat elke sloep ze
     heeft: het water is één plat vlak dwars door de wereld, dus wat er van de
     boot onder de waterlijn zit valt erachter weg. Bij de steven en bij de
     spiegel keek je zonder dek de boot dóór, zo het water in.
    */
    for (const [t0, t1] of [[0, VOORDEK], [ACHTERDEK, 1]]) {
      const dek = new THREE.Mesh(dekVorm(vorm, t0, t1), std({ color: L.romp, roughness: 0.5, side: THREE.DoubleSide }));
      dek.castShadow = true; dek.receiveShadow = true;
      schip.add(dek);
    }
    /*
     En een schot onder elk dek. Vanuit de kuip keek je anders onder het voordek
     door naar de ruimte eronder, en die ligt onder water — dus je zag daar een
     boog water midden in de boot. Een schot is precies wat er in het echt ook
     zit: het sluit de punt af en je hebt er een bergruimte aan.
    */
    for (const t of [VOORDEK, ACHTERDEK]) {
      const h = vorm.zeeg(t) - VLOER;
      const schot = new THREE.Mesh(new THREE.BoxGeometry(0.05, h, vorm.breed(t) * 2),
        std({ color: L.romp, roughness: 0.5 }));
      schot.position.set(vorm.lang(t), VLOER + h / 2, 0);
      schot.castShadow = true;
      schip.add(schot);
    }

    /*
     De vlonder — de houten vloer waar je op staat. Hij ligt een handbreedte
     bóven de waterlijn, want dat is waar de vloer van een boot hoort te liggen
     en, net als bij de dekken hierboven, omdat alles eronder achter het
     watervlak verdwijnt.
    */
    const vloerY = VLOER;
    const N = 9, stap = (ACHTERDEK - VOORDEK) / N;
    for (let i = 0; i < N; i++) {
      const t = VOORDEK + i * stap;
      const b = vorm.breed(t) * 1.0, x = vorm.lang(t);
      const bb = vorm.breed(t + stap) * 1.0, xx = vorm.lang(t + stap);
      const plank = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x - xx) + 0.02, 0.05, (b + bb)), gedeeld.hout);
      plank.position.set((x + xx) / 2, vloerY, 0);
      plank.receiveShadow = true;
      schip.add(plank);
    }

    // de spiegel: de vlakke achterkant waar de motor aan hangt
    const spiegelB = vorm.breed(1) * 2, spiegelH = vorm.zeeg(1) + vorm.diep(1);
    const spiegel = new THREE.Mesh(new THREE.BoxGeometry(0.07, spiegelH, spiegelB * 0.99), std({ color: L.romp, roughness: 0.42 }));
    spiegel.position.set(vorm.lang(1) - 0.03, vorm.zeeg(1) - spiegelH / 2, 0);
    spiegel.castShadow = true;
    schip.add(spiegel);
    // de naam erop, zoals elke boot er een heeft
    const naam = new THREE.Mesh(new THREE.PlaneGeometry(spiegelB * 0.72, 0.22),
      new THREE.MeshBasicMaterial({ map: naamTextuur(L.naam), transparent: true }));
    naam.position.set(vorm.lang(1) - 0.075, vorm.zeeg(1) - 0.20, 0);
    naam.rotation.y = -Math.PI / 2;
    schip.add(naam);

    // ---- twee doften en een stuurconsole ----
    const doft = (t) => {
      const b = vorm.breed(t) * 1.84;
      const bank = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.07, b), gedeeld.hout);
      bank.position.set(vorm.lang(t), vorm.zeeg(t) - 0.34, 0);
      bank.castShadow = true; schip.add(bank);
      const kussen = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.075, b * 0.94), gedeeld.kussen);
      kussen.position.set(vorm.lang(t), vorm.zeeg(t) - 0.27, 0);
      schip.add(kussen);
    };
    doft(0.34); doft(0.90);

    const console = new THREE.Group();
    console.position.set(vorm.lang(0.62), vloerY, 0.30);
    const kast = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.86, 0.62), std({ color: L.kleur, roughness: 0.4 }));
    kast.position.y = 0.43; kast.castShadow = true;
    console.add(kast);
    const blad = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.68), gedeeld.donker);
    blad.position.y = 0.885; console.add(blad);
    const stuur = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.022, 8, 22), gedeeld.zwart);
    stuur.position.set(-0.13, 0.99, 0);
    stuur.rotation.set(0, 0, Math.PI / 2 - 0.45);
    console.add(stuur);
    for (let i = 0; i < 3; i++) {
      const spaak = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.32, 0.018), gedeeld.zwart);
      spaak.position.copy(stuur.position);
      spaak.rotation.set(i * Math.PI / 3, 0, Math.PI / 2 - 0.45);
      console.add(spaak);
    }
    const meter = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 14), gedeeld.wit);
    meter.position.set(-0.12, 0.80, 0.16); meter.rotation.z = Math.PI / 2 - 0.3;
    console.add(meter);
    const gashendel = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.24, 0.035), gedeeld.zwart);
    gashendel.position.set(0.02, 0.96, -0.24); gashendel.rotation.x = 0.35;
    console.add(gashendel);
    schip.add(console);

    // ---- buitenboordmotor aan de spiegel ----
    const motor = new THREE.Group();
    motor.position.set(vorm.lang(1) - 0.32, vorm.zeeg(1) - 0.24, 0);
    const kap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.40, 0.34), std({ color: L.kleur, roughness: 0.35 }));
    kap.castShadow = true; motor.add(kap);
    const staart = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.72, 0.16), gedeeld.donker);
    staart.position.y = -0.55; motor.add(staart);
    const torpedo = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.30, 4, 10), gedeeld.donker);
    torpedo.position.set(-0.02, -0.92, 0); torpedo.rotation.z = Math.PI / 2;
    motor.add(torpedo);
    const schroef = new THREE.Group();
    schroef.position.set(-0.20, -0.92, 0);
    for (let i = 0; i < 3; i++) {
      const blad2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.15, 0.06), gedeeld.rvs);
      blad2.position.set(0, Math.cos(i * 2.094) * 0.075, Math.sin(i * 2.094) * 0.075);
      blad2.rotation.x = i * 2.094 + 0.5;
      schroef.add(blad2);
    }
    motor.add(schroef);
    schip.add(motor);

    // ---- navigatielichten, stootwillen, een touw naar de wal ----
    const lampje = (mat, x, z) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat);
      m.position.set(x, vorm.zeeg(0.12) + 0.03, z);
      schip.add(m); return m;
    };
    lampje(gedeeld.rood, vorm.lang(0.10), -vorm.breed(0.10) * 0.8);
    lampje(gedeeld.groen, vorm.lang(0.10), vorm.breed(0.10) * 0.8);
    const hek = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.62, 6), gedeeld.rvs);
    hek.position.set(vorm.lang(1) + 0.14, vorm.zeeg(1) + 0.31, 0);
    schip.add(hek);
    const heklicht = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), gedeeld.wit);
    heklicht.position.set(vorm.lang(1) + 0.14, vorm.zeeg(1) + 0.63, 0);
    schip.add(heklicht);

    for (const t of [0.42, 0.74]) for (const zij of [-1, 1]) {
      const wil = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.20, 4, 8), gedeeld.donker);
      wil.position.set(vorm.lang(t), vorm.zeeg(t) - 0.22, (vorm.breed(t) + 0.08) * zij);
      schip.add(wil);
    }
    // de bolder voorop, met het touw eraan
    const bolder = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.13, 8), gedeeld.rvs);
    bolder.position.set(vorm.lang(0.04), vorm.zeeg(0.04) + 0.05, 0);
    schip.add(bolder);

    /*
     `length` is wat js/derdepersoon.js uitleest om te bepalen hoe ver de camera
     achter je hangt. Een sloep van ruim zes meter krijgt daarmee acht meter
     hengel, en dat is precies genoeg om de hele boot en het water eromheen te
     zien zonder dat je de kant uit het oog verliest.
    */
    groep.userData = { romp, motor, schroef, lichten: [heklicht], console, stuur, length: LENGTE };
    return groep;
  }

  /*
   Past de romp hier? We kijken op vijf punten: de steven, de spiegel, het
   midden en de twee breedste punten. Ligt één daarvan op de kant, dan gaat de
   boot niet verder. Het is ruim genomen — de punten liggen binnen de romp, niet
   erbuiten — want een boot die bij elke rietkraag vastloopt is geen boot.
  */
  const PROEF = [
    [LENGTE * 0.46, 0], [-LENGTE * 0.46, 0], [0, 0],
    [LENGTE * 0.10, BREEDTE * 0.42], [LENGTE * 0.10, -BREEDTE * 0.42],
  ];
  function pastHier(x, z, yaw) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (const [l, d] of PROEF) {
      // lokaal: +x is de neus, +z is stuurboord
      const px = x - s * l + c * d, pz = z - c * l - s * d;
      if (!vaarbaar(px, pz)) return false;
    }
    return true;
  }

  /*
   Waar komt de boot precies te liggen?

   In de kaart is per ligplaats een punt met ruim water opgezocht en het punt op
   de oever ernaast. Midden in de vaart afmeren is geen afmeren, dus de boot
   schuift langs die lijn naar de kant tot hij op AFMEER meter van de oever ligt
   — net genoeg om er met de steiger bij te kunnen. Past hij daar niet (een
   bocht in de oever, riet, een duiker), dan blijft hij op het gemeten punt in
   het ruime water liggen; dat is altijd bevaarbaar.
  */
  const AFMEER = 2.9;

  // hoeveel meter kan de boot vanaf hier nog vooruit (s = 1) of achteruit (s = −1)?
  function ruimte(x, z, yaw, s, max = 30) {
    let r = 0;
    while (r < max && pastHier(x - Math.sin(yaw) * r * s, z - Math.cos(yaw) * r * s, yaw)) r += 1.5;
    return r;
  }

  /*
   Welke kant ligt de boot op?

   De vaargeul is bij de ligplaats opgemeten, maar die meting geldt midden op het
   water. Zodra de boot tegen de kade schuift klopt hij niet meer: de oever
   loopt daar anders, en met de gemeten koers stak de steven bij allebei de
   ligplaatsen zo de wal in — drie meter vooruit en dan hield het op. Daarom
   wordt de koers hier ter plekke gezocht: om de tien graden rond de meting, en
   de winnaar is die waarbij er zowel vóór als achter de meeste ruimte is. Dat is
   per definitie de richting waarin de vaart loopt. De straf op afwijken houdt
   hem bij de meting in de buurt als er meerdere even goed zijn.
  */
  function koers(x, z, wens) {
    let best = null;
    for (let i = 0; i < 36; i++) {
      const yaw = wens + (i - 18) * Math.PI / 18;
      if (!pastHier(x, z, yaw)) continue;
      const score = Math.min(ruimte(x, z, yaw, 1), ruimte(x, z, yaw, -1));
      let af = (yaw - wens + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      const w = score - Math.abs(af) * 1.4;
      if (!best || w > best.w) best = { yaw, w, score };
    }
    return best || { yaw: wens, score: 0 };
  }

  /*
   Waar komt de boot te liggen: tegen de kade als dat kan, en anders op het
   gemeten punt in het ruime water. Een ligplaats waar je niet weg kunt varen is
   geen ligplaats, dus er hoort ook een vaarweg bij — vandaar dat er naar de
   ruimte vóór en achter gekeken wordt en niet alleen naar of hij erin past.
  */
  function ligplek(L) {
    const dx = L.wal.x - L.x, dz = L.wal.z - L.z;
    const d = Math.hypot(dx, dz);
    const kandidaten = [];
    if (d > AFMEER) kandidaten.push({ x: L.wal.x - dx / d * AFMEER, z: L.wal.z - dz / d * AFMEER });
    kandidaten.push({ x: L.x, z: L.z });
    let beste = null;
    for (const k of kandidaten) {
      if (!pastHier(k.x, k.z, L.yaw) && !pastHier(k.x, k.z, L.yaw + Math.PI / 2)) continue;
      const K = koers(k.x, k.z, L.yaw);
      if (K.score >= 12) return { x: k.x, z: k.z, yaw: K.yaw };
      if (!beste || K.score > beste.score) beste = { x: k.x, z: k.z, yaw: K.yaw, score: K.score };
    }
    return beste || { x: L.x, z: L.z, yaw: L.yaw };
  }

  // ---------- de boten neerzetten ----------
  const boten = [];
  for (const L of LIGPLAATSEN) {
    const plek = ligplek(L);
    const mesh = bouwBoot(L);
    mesh.position.set(plek.x, WATER_Y, plek.z);
    mesh.rotation.y = plek.yaw;
    scene.add(mesh);
    if (L.steiger) scene.add(maakSteiger(plek, plek.yaw, L.wal, gedeeld));
    boten.push({
      L, mesh, naam: L.naam, plek,
      x: plek.x, z: plek.z, yaw: plek.yaw,
      vx: 0, vz: 0,          // snelheid over de grond (m/s)
      roer: 0, gas: 0,
      deining: Math.random() * 6.283,
      sporen: [],
    });
  }

  // ---------- het schuim achter de boot ----------
  const SCHUIM = 26;
  const schuim = [];
  const schuimGeo = new THREE.PlaneGeometry(1, 1);
  for (let i = 0; i < SCHUIM; i++) {
    const m = new THREE.Mesh(schuimGeo, new THREE.MeshBasicMaterial({
      map: schuimMap, transparent: true, opacity: 0, depthWrite: false,
    }));
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    /*
     Het water is zelf half doorzichtig (opacity 0,94 in js/world.js) en komt dus
     in dezelfde doorzichtige laag terecht als het schuim. Three sorteert die
     laag op de afstand tot het middelpunt van elk voorwerp, en één waterpolygoon
     van tweehonderd meter heeft zijn middelpunt gerust dichter bij de camera dan
     de vlek die vlak achter je boot ligt — dan wordt het water er overheen
     getekend en zie je van je kielzog niets. Een hogere `renderOrder` zet het
     schuim hoe dan ook als laatste op het scherm.
    */
    m.renderOrder = 2;
    scene.add(m);
    schuim.push({ mesh: m, t: 0, maat: 1 });
  }
  let schuimKlok = 0;

  function laatSchuimNa(x, z, kracht) {
    const s = schuim.find(o => o.t <= 0);
    if (!s) return;
    s.t = 1; s.maat = 1.5 + kracht * 2.4;
    s.mesh.position.set(x, WATER_Y + 0.035, z);
    s.mesh.rotation.z = Math.random() * 6.283;
    s.mesh.material.opacity = 0.60 * kracht;
    s.mesh.visible = true;
  }

  function werkSchuimBij(dt) {
    for (const s of schuim) {
      if (s.t <= 0) continue;
      s.t -= dt * 0.55;
      if (s.t <= 0) { s.mesh.visible = false; continue; }
      const groei = s.maat * (1 + (1 - s.t) * 1.6);
      s.mesh.scale.set(groei, groei, 1);
      s.mesh.material.opacity = 0.60 * s.t * s.t;
    }
  }

  // ---------- varen ----------
  let inBoot = null;
  let laatsteYaw = 0;

  function vaar(boot, keys, dt) {
    const gas = !!(keys.KeyW || keys.ArrowUp);
    const terug = !!(keys.KeyS || keys.ArrowDown);
    let doel = 0;
    if (keys.KeyA) doel = 1;
    if (keys.KeyD) doel = -1;
    boot.roer += (doel - boot.roer) * Math.min(1, dt * ROER_TRAAG);

    const fx = -Math.sin(boot.yaw), fz = -Math.cos(boot.yaw);   // de neus
    const rx = Math.cos(boot.yaw), rz = -Math.sin(boot.yaw);    // stuurboord

    // snelheid uiteen in langs- en dwarsscheeps
    let vl = boot.vx * fx + boot.vz * fz;
    let vd = boot.vx * rx + boot.vz * rz;

    // ---- schroef ----
    boot.gas += ((gas ? 1 : terug ? -1 : 0) - boot.gas) * Math.min(1, dt * 2.4);
    if (boot.gas > 0) vl += STUW * boot.gas * dt;
    else vl += STUW_ACHTER * boot.gas * dt;

    // ---- weerstand van het water ----
    vl -= vl * Math.abs(vl) * LANGS * dt;
    vl -= Math.sign(vl) * Math.min(Math.abs(vl), LANGS_VAST * dt);
    vd -= vd * Math.min(1, DWARS * dt);
    vl = Math.max(-TOP_ACHTER, Math.min(TOP, vl));

    // ---- roer ----
    /*
     Het roer werkt op het water dat langs het blad stroomt, dus met de snelheid
     mee; achteruit draait hij de andere kant op, net als in het echt. Daar
     bovenop kan de buitenboordmotor hem op de plek ronddraaien zolang je gas
     geeft — anders kom je nooit van de kant weg.
    */
    const draai = boot.roer * (ROER * Math.max(-1, Math.min(1, vl / (TOP * 0.55)))
      + SCHROEF_DRAAI * Math.max(0, boot.gas) * Math.max(0, 1 - Math.abs(vl) / 2.5));
    boot.yaw += draai * dt;

    // terug naar snelheid over de grond
    boot.vx = fx * vl + rx * vd;
    boot.vz = fz * vl + rz * vd;

    // ---- verplaatsen, en niet de wal op ----
    const nx = boot.x + boot.vx * dt, nz = boot.z + boot.vz * dt;
    if (pastHier(nx, nz, boot.yaw)) { boot.x = nx; boot.z = nz; }
    else {
      // langs de kant schuiven in plaats van muurvast: probeer x en z apart
      if (pastHier(nx, boot.z, boot.yaw)) { boot.x = nx; boot.vz *= 0.2; }
      else if (pastHier(boot.x, nz, boot.yaw)) { boot.z = nz; boot.vx *= 0.2; }
      else { boot.vx *= 0.1; boot.vz *= 0.1; }
      boot.aanDeKant = Math.abs(vl) > 1.2;
    }
    boot.snelheid = vl;
    // js/derdepersoon.js kijkt naar `speed` om de camera achter je terug te
    // laten zwaaien; dat is bij een boot hetzelfde getal als bij een auto
    boot.speed = vl;
    boot.dwars = vd;
    return { gas, terug, vl, vd, draai };
  }

  // de boot laten leven: deinen, hellen in de bocht, en de schroef laten draaien
  function zetBeeld(boot, dt, t) {
    boot.deining += dt * 1.35;
    const rust = Math.max(0, 1 - Math.abs(boot.snelheid || 0) / 3);
    const m = boot.mesh;
    m.position.set(boot.x, WATER_Y + Math.sin(boot.deining) * 0.035 * (0.4 + rust * 0.6), boot.z);
    m.rotation.y = boot.yaw;
    // in de bocht hangt hij naar buiten; stilliggend rolt hij zachtjes mee
    const helling = -(boot.roer || 0) * HELLING * Math.min(1, Math.abs(boot.snelheid || 0) / (TOP * 0.6))
      + Math.sin(boot.deining * 0.78) * 0.022 * rust;
    m.rotation.z = helling;
    // en met gas gaat de neus omhoog
    m.rotation.x = -Math.max(0, boot.snelheid || 0) / TOP * 0.055 + Math.sin(boot.deining * 1.21) * 0.012 * rust;
    const u = m.userData;
    if (u && u.schroef) u.schroef.rotation.x += (Math.abs(boot.gas || 0) * 26 + 1) * dt;
    if (u && u.stuur) u.stuur.rotation.x = (boot.roer || 0) * 2.2;
    void t;
  }

  function update(dt, keys) {
    const t = performance.now() / 1000;
    for (const b of boten) {
      if (b === inBoot) continue;
      b.snelheid = 0; b.speed = 0; b.roer = 0; b.gas = 0;
      zetBeeld(b, dt, t);
    }
    if (!inBoot) { werkSchuimBij(dt); geluid.bootMotor(null); return; }

    const uit = vaar(inBoot, keys || {}, dt);
    zetBeeld(inBoot, dt, t);

    /*
     De speler staat erin: zijn plaats is de plaats van de boot, en zijn hoogte
     die van de vlonder. Zijn kijkrichting draait mee met de romp — je kijkt
     relatief, net als in de auto — anders draait de boot onder je vandaan.
    */
    if (player) {
      player.pos.x = inBoot.x; player.pos.z = inBoot.z;
      player.pos.y = (inBoot.mesh ? inBoot.mesh.position.y : WATER_Y) + VLOER;
      player.yaw += inBoot.yaw - laatsteYaw;
      laatsteYaw = inBoot.yaw;
    }

    // ---- schuim en geluid ----
    const snel = Math.abs(inBoot.snelheid || 0);
    schuimKlok -= dt;
    if (snel > 0.35 && schuimKlok <= 0) {
      schuimKlok = 0.07;
      const kracht = Math.min(1, snel / (TOP * 0.7));
      const fx = -Math.sin(inBoot.yaw), fz = -Math.cos(inBoot.yaw);
      const rx = Math.cos(inBoot.yaw), rz = -Math.sin(inBoot.yaw);
      // één vlek achter de schroef en twee boeggolven schuin naar voren
      laatSchuimNa(inBoot.x - fx * LENGTE * 0.5, inBoot.z - fz * LENGTE * 0.5, kracht);
      for (const zij of [-1, 1]) {
        laatSchuimNa(inBoot.x + fx * LENGTE * 0.34 + rx * BREEDTE * 0.6 * zij,
          inBoot.z + fz * LENGTE * 0.34 + rz * BREEDTE * 0.6 * zij, kracht * 0.55);
      }
    }
    werkSchuimBij(dt);
    geluid.bootMotor(inBoot.gas, snel / TOP);
    if (inBoot.aanDeKant) {
      inBoot.aanDeKant = false;
      geluid.klap();
      if (hud) hud.show('Je loopt aan de kant', 1.4);
    }
    void uit;
  }

  // ---------- in- en uitstappen ----------
  function dichtstbij(x, z, max = INSTAP) {
    let beste = null, best = max;
    for (const b of boten) {
      const d = Math.hypot(b.x - x, b.z - z);
      if (d < best) { best = d; beste = b; }
    }
    return beste;
  }

  function stapIn(boot) {
    if (!boot || inBoot) return false;
    inBoot = boot;
    laatsteYaw = boot.yaw;
    boot.vx = 0; boot.vz = 0; boot.gas = 0; boot.roer = 0;
    if (player) player.inBoot = boot;
    return true;
  }

  /*
   Uitstappen mag alleen als er wal is om op te stappen. We kijken rondom de
   boot naar het eerste punt dat geen vaarwater is — dat is de kant — en zetten
   je daar een halve meter landinwaarts neer. Ligt de boot midden op de Geeuw,
   dan stap je niet uit; dat scheelt zwemmen.
  */
  function stapUit() {
    if (!inBoot) return false;
    const b = inBoot;
    let plek = null;
    for (let r = BREEDTE * 0.7; r <= 9 && !plek; r += 0.5) {
      for (let i = 0; i < 24; i++) {
        const h = i / 24 * 6.283;
        const x = b.x + Math.cos(h) * r, z = b.z + Math.sin(h) * r;
        if (!vaarbaar(x, z)) { plek = { x: x + Math.cos(h) * 0.6, z: z + Math.sin(h) * 0.6 }; break; }
      }
    }
    if (!plek) {
      if (hud) hud.show('Te ver van de kant om uit te stappen', 2);
      return false;
    }
    inBoot = null;
    b.gas = 0; b.vx = 0; b.vz = 0; b.snelheid = 0; b.speed = 0;
    if (player) { player.inBoot = null; player.pos.set(plek.x, 0, plek.z); }
    geluid.bootMotor(null);
    return true;
  }

  /*
   Een boot ergens neerzetten. Nodig zodra er een missie komt waarbij de lading
   op de ene plek aan boord gaat en er op de andere af moet, en handig om mee te
   toetsen. Hij gaat alleen waar hij ook kan liggen.
  */
  function verplaats(boot, x, z, yaw = boot.yaw) {
    if (!boot || !pastHier(x, z, yaw)) return false;
    boot.x = x; boot.z = z; boot.yaw = yaw;
    boot.vx = 0; boot.vz = 0; boot.snelheid = 0; boot.speed = 0; boot.gas = 0; boot.roer = 0;
    if (boot === inBoot) laatsteYaw = yaw;
    zetBeeld(boot, 0, 0);
    return true;
  }

  function naarLigplaats(i) {
    const b = boten[i], L = LIGPLAATSEN[i];
    if (!b || !L) return false;
    return verplaats(b, b.plek.x, b.plek.z, b.plek.yaw);
  }

  return {
    update,
    dichtstbij,
    stapIn,
    stapUit,
    verplaats,
    naarLigplaats,
    ruw: (i) => boten[i],
    get inBoot() { return inBoot; },
    get vaart() { return inBoot ? inBoot.snelheid || 0 : 0; },
    get top() { return TOP; },
    get boten() {
      return boten.map(b => ({
        naam: b.naam, x: +b.x.toFixed(2), z: +b.z.toFixed(2), yaw: +b.yaw.toFixed(3),
        snelheid: +(b.snelheid || 0).toFixed(3), gas: +(b.gas || 0).toFixed(3),
        roer: +(b.roer || 0).toFixed(3), inBoot: b === inBoot,
      }));
    },
    get schuimAan() { return schuim.filter(s => s.t > 0).length; },
    pastHier,
    maten: { LENGTE, BREEDTE, TOP, TOP_ACHTER, INSTAP },
  };
}

/*
 Een aanlegsteiger bij de waterzuivering. In IJlst staat er een in de BGT; hier
 niet, en een boot die zomaar in het riet ligt is geen ligplaats. Vier palen,
 een dek van planken, en hij steekt vanaf de oever het water in.
*/
function maakSteiger(plek, yaw, wal, mat) {
  const LANG = 8.40;              // zo lang loopt hij langs de boot
  const DEK_Y = 0.30;
  const KANT = BREEDTE / 2 + 0.10; // waar de zij van de boot ligt
  const g = new THREE.Group();
  /*
   De steiger ligt lángs de boot, tussen de boot en de kant, en hij loopt van de
   romp helemaal door tot op het gras. Zo stap je van de doft op het dek en van
   het dek de kade op — precies waar een steiger voor is. (De eerste poging lag
   haaks op de boot en dus dwars over de boeg; de tweede lag wel goed maar bleef
   in het water hangen omdat de boot verder van de wal ging liggen dan gedacht.)

   Aan wélke kant hij ligt rekenen we uit in plaats van het aan te nemen: de
   oever kan links of rechts van de boot liggen, en dat hangt van de koers af
   die hierboven in het water gezocht is.
  */
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);     // stuurboord
  const langs = (wal.x - plek.x) * rx + (wal.z - plek.z) * rz;
  const zij = langs < 0 ? -1 : 1;
  const BREED = Math.max(1.4, Math.abs(langs) - KANT + 0.7);   // tot een eind het gras op
  g.position.set(plek.x + rx * zij * (KANT + BREED / 2), 0, plek.z + rz * zij * (KANT + BREED / 2));
  g.rotation.y = zij > 0 ? yaw : yaw + Math.PI;      // lokaal +z langs de boot, +x naar de wal
  const dek = new THREE.Mesh(new THREE.BoxGeometry(BREED, 0.09, LANG), mat.hout);
  dek.position.y = DEK_Y; dek.castShadow = true; dek.receiveShadow = true;
  g.add(dek);
  // de palen eronder, en twee meerpalen aan de waterkant
  for (const zij of [-0.34, 0.34]) for (const f of [-0.42, 0, 0.42]) {
    const paal = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 1.6, 7), mat.berghout);
    paal.position.set(BREED * zij, DEK_Y - 0.85, LANG * f);
    paal.castShadow = true;
    g.add(paal);
  }
  for (const f of [-0.32, 0.32]) {
    const meer = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 2.3, 8), mat.berghout);
    meer.position.set(-BREED * 0.5 + 0.11, DEK_Y - 0.40, LANG * f);
    meer.castShadow = true;
    g.add(meer);
  }
  return g;
}

// ---------- twee doeken, allebei getekend en niet ingeladen ----------
function schuimTextuur() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  r.addColorStop(0, 'rgba(255,255,255,0.95)');
  r.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  // een paar belletjes, anders is het een wolkje in plaats van schuim
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * 6.283, d = Math.random() * 26;
    g.beginPath();
    g.arc(32 + Math.cos(a) * d, 32 + Math.sin(a) * d, 0.8 + Math.random() * 2.2, 0, 6.283);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function naamTextuur(tekst) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 64);
  g.font = 'italic 700 40px Georgia, serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillText(tekst.toUpperCase(), 129, 34);
  g.fillStyle = '#f4f0e2';
  g.fillText(tekst.toUpperCase(), 128, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
