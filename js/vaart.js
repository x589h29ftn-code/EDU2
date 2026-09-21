/*
 De vaart: de lading over het water.

 Hier zijn de boten voor gebouwd. Er ligt een sloep in IJlst en een aan de
 Geeuwkade bij de waterzuivering, en tussen die twee ligt tweeënhalve kilometer
 vaarwater — 2532 meter over de Geeuw en de Zwette gemeten, tegen 1773 meter
 hemelsbreed. Over de weg is het tien minuten; over het water duurt het langer,
 en dat is precies het punt: een sloep haalt zeven meter per seconde en er staat
 geen wegversperring op het water.

 De opdracht is eenvoudig en de uitvoering niet:

   1. ga naar IJlst en stap in de sloep die daar ligt;
   2. de lading gaat aan boord — vanaf dat moment weet iemand het;
   3. vaar naar de kade bij de waterzuivering en lever hem af.

 Vanaf het moment dat de lading aan boord ligt loopt de verdenking op. Eerst één
 ster, dan twee, dan drie; en met verdenking én een boot onder je komt de politie
 het water op (js/politieboot.js). Je kunt de hele overtocht doen zonder een schot
 te lossen, maar je moet wel blijven varen.

 Een paar keuzes die er toe doen:

 * **De lading blijft aan boord.** Stap je onderweg uit, dan gaat de missie niet
   mislukken — hij wacht gewoon. Dat is minder streng dan "mislukt" en het maakt
   de vaart geen strafexpeditie: je kunt aanleggen, iets regelen en weer verder.
 * **De route wordt over het water gezocht**, niet over de weg. De navigatie van
   het spel loopt over wegassen en die houden bij de kade op; hier wordt daarom
   een eigen route gezocht met een rooster van zes meter over `vaarbaar`.
 * **Afleveren doe je varend.** Je hoeft niet aan te meren en uit te stappen —
   binnen twaalf meter van de kade is de lading over.
*/
import * as THREE from 'three';
import { vaarbaar } from './world.js';
import { LIGPLAATSEN } from './boot.js';
import { KAART } from './kaartwereld.js';
import { geluid } from './audio.js';

const OPHALEN = LIGPLAATSEN[1];          // IJlst
const AFLEVEREN = LIGPLAATSEN[0];        // de Geeuwkade bij de waterzuivering

const NA_JOHAN = 9;                      // zoveel seconden na de vorige missie belt hij
const AFLEVER_AFSTAND = 12;              // zo dicht bij de kade is de lading over
const BELONING = 2500;

// de verdenking tijdens de overtocht: waar hij begint en hoe hard hij oploopt
const HEAT_START = 40;                   // één ster (js/politie.js: 30, 80, 150, …)
const HEAT_PER_SEC = 0.5;                // na vier minuten sta je op drie sterren
const HEAT_MAX = 165;

const KOP = 'Sander';
const BELT = [
  { wie: KOP, telefoon: true, tekst: 'Erik. Er ligt een sloep in IJlst, aan de steiger. Daar staat een partij klaar die naar de kade bij de waterzuivering moet.' },
  { wie: KOP, telefoon: true, tekst: 'Over de weg hoef je het niet te proberen, daar staan ze te kijken. Neem het water. Het duurt langer, maar er staat niemand op de Geeuw.' },
];
const AAN_BOORD = [
  { wie: KOP, telefoon: true, tekst: 'Het ligt vóór je in de kuip, onder de doft. Varen nu — en blijf varen, ze weten het binnen tien minuten.' },
];
const AFGELEVERD = [
  { wie: KOP, telefoon: true, tekst: 'Netjes. Het is binnen. Maak dat je wegkomt van die kade.' },
];

/*
 Een route over het water. Een rooster van zes meter over `vaarbaar` en er in de
 breedte doorheen; daarna wordt het pad uitgedund zodat er geen lijn van
 vierhonderd knikjes op de kaart komt te staan.

 Zes meter is niet toevallig: de sloep is 2,16 breed en de smalste vaart waar hij
 doorheen moet is een meter of acht. Fijner rekenen kost tijd en levert dezelfde
 route; grover en de vaart valt tussen twee roosterpunten door.
*/
const CEL = 6;
export function vaarRoute(van, naar) {
  /*
   Het rooster als vlakke getallenrij in plaats van een Map met tekstsleutels.
   Dat leek overdreven en is het niet: de eerste versie zette per cel een sleutel
   als "213:-84" in elkaar en zocht die op in twee Sets en een Map, en dat kostte
   over de hele overtocht ruim acht tienden van een seconde — een hik van
   vijfentwintig beelden precies op het moment dat je aan boord stapt. Met een
   Int32Array met één plek per cel blijft er een paar honderdste van over.

   `kwam` bewaart per cel waar hij vandaan komt: 0 is "nog niet gezien", −1 is
   "droog", en anders de plek van de vorige cel plus één.
  */
  const G = KAART && KAART.gebied;
  const x0 = (G ? G.x0 : -3000) - 60, z0 = (G ? G.z0 : -3000) - 60;
  const W = Math.ceil(((G ? G.x1 : 3000) + 60 - x0) / CEL);
  const H = Math.ceil(((G ? G.z1 : 3000) + 60 - z0) / CEL);
  const index = (i, j) => (i < 0 || j < 0 || i >= W || j >= H ? -1 : j * W + i);
  const kwam = new Int32Array(W * H);

  const si = Math.round((van.x - x0) / CEL), sj = Math.round((van.z - z0) / CEL);
  const di = Math.round((naar.x - x0) / CEL), dj = Math.round((naar.z - z0) / CEL);
  const start = index(si, sj);
  if (start < 0) return null;
  const rij = new Int32Array(W * H);
  let kop = 0, staart = 0;
  rij[staart++] = start; kwam[start] = start + 1;
  let eind = -1;
  while (kop < staart) {
    const p = rij[kop++];
    const i = p % W, j = (p - i) / W;
    if (Math.abs(i - di) <= 1 && Math.abs(j - dj) <= 1) { eind = p; break; }
    for (let k = 0; k < 4; k++) {
      const ni = i + (k === 0 ? 1 : k === 1 ? -1 : 0);
      const nj = j + (k === 2 ? 1 : k === 3 ? -1 : 0);
      const q = index(ni, nj);
      if (q < 0 || kwam[q] !== 0) continue;
      if (!vaarbaar(x0 + ni * CEL, z0 + nj * CEL)) { kwam[q] = -1; continue; }
      kwam[q] = p + 1;
      rij[staart++] = q;
    }
  }
  if (eind < 0) return null;
  const pad = [];
  for (let p = eind; p !== rij[0] || pad.length === 0; ) {
    const i = p % W, j = (p - i) / W;
    pad.push([x0 + i * CEL, z0 + j * CEL]);
    const vorige = kwam[p] - 1;
    if (vorige === p || vorige < 0) break;
    p = vorige;
  }
  pad.reverse();
  // uitdunnen: elk tiende punt plus het eind, anders staat er een lijn van
  // vierhonderd knikjes op de kaart
  const uit = pad.filter((_, i) => i % 10 === 0);
  if (uit[uit.length - 1] !== pad[pad.length - 1]) uit.push(pad[pad.length - 1]);
  return uit;
}

/*
 De lading: zes pakken in plastic, met tape eromheen. Geen plaatje — de tape is
 een tweede, smaller blokje op het pak, want dat leest van vijf meter afstand
 precies zo goed als een textuur en het kost niets.
*/
function maakLading() {
  const g = new THREE.Group();
  const plastic = new THREE.MeshStandardMaterial({ color: 0xe6e3da, roughness: 0.45 });
  const tape = new THREE.MeshStandardMaterial({ color: 0x8a6a3c, roughness: 0.8 });
  const pak = new THREE.BoxGeometry(0.34, 0.13, 0.22);
  const band = new THREE.BoxGeometry(0.345, 0.05, 0.225);
  for (let i = 0; i < 6; i++) {
    const rij = i % 3, laag = Math.floor(i / 3);
    const p = new THREE.Mesh(pak, plastic);
    p.position.set((rij - 1) * 0.37, laag * 0.14, 0);
    p.rotation.y = (i * 0.11) % 0.2 - 0.1;       // niet kaarsrecht op elkaar
    p.castShadow = true;
    g.add(p);
    const t = new THREE.Mesh(band, tape);
    t.position.copy(p.position);
    t.rotation.y = p.rotation.y;
    g.add(t);
  }
  return g;
}

/*
 De missie staat tijdelijk uit (verzoek 21 sep 2026: "haal eerst even de
 bootmissie weg, die komt later"). Alles blijft staan — de sloep, de route over
 het water, de politieboot — maar hij meldt zich niet meer als het verhaal
 uitgespeeld is. Zet deze vlag op `true` en hij doet weer precies wat hij deed;
 tools/vaarttest.mjs zet hem zelf aan om de missie te kunnen naspelen.
*/
export let VAART_AAN = false;
export function zetVaartAan(v) { VAART_AAN = !!v; }

export function initVaart({ scene, player, hud, boten = null, politie = null, verhaal = null }) {
  if (!scene || !boten) return null;

  let fase = 'uit';           // 'uit' | 'wacht' | 'ophalen' | 'varen' | 'klaar'
  let wachtT = 0;
  let lading = null;
  let route = null;
  let heat = 0;
  let navT = 0;

  const sloep = () => boten.ruw(1);
  const doelSloep = () => boten.ruw(0);
  const sp = () => (player.inBoot
    ? { x: player.inBoot.x, z: player.inBoot.z }
    : { x: player.pos.x, z: player.pos.z });

  const zeg = (regels) => {
    if (!verhaal || !verhaal.zegLosse) {
      // zonder het verhaal (bijvoorbeeld in een toets) is de melding genoeg
      if (hud) hud.show(regels[0].tekst, 5);
      return;
    }
    verhaal.zegLosse(regels);
  };
  const opdracht = (tekst) => { if (verhaal && verhaal.zetOpdracht) verhaal.zetOpdracht(tekst); };

  function begin() {
    fase = 'ophalen';
    zeg(BELT);
    opdracht('ga naar IJlst en stap in de sloep aan de steiger');
    const b = sloep();
    if (b && hud) hud.zetNavigatie({ route: null, doel: [b.x, b.z], naam: 'IJlst', letter: 'S' });
  }

  function aanBoord() {
    fase = 'varen';
    heat = HEAT_START;
    const b = boten.inBoot;
    lading = maakLading();
    /*
     In de kuip, vóór de stuurconsole. De buitenste groep van de boot heeft −z als
     vaarrichting (js/boot.js), dus +z is naar achteren. Je staat zelf op z =
     +1,35 en de console op +0,76; op +0,2 lag de stapel er pal achter en zag je
     er vanaf de stuurstand niets van. Op −0,55 ligt hij in het open deel van de
     kuip, tussen de console en de voorste doft.
    */
    lading.position.set(0, 0.17, -0.55);
    b.mesh.add(lading);
    zeg(AAN_BOORD);
    opdracht('vaar de lading naar de kade bij de waterzuivering');
    geluid.klap();
    const naar = AFLEVEREN.wal || AFLEVEREN;
    route = vaarRoute({ x: b.x, z: b.z }, naar);
    if (hud) hud.zetNavigatie({ route, doel: [naar.x, naar.z], naam: 'Geeuwkade', letter: 'X' });
  }

  function afgeleverd() {
    fase = 'klaar';
    if (lading && lading.parent) lading.parent.remove(lading);
    lading = null;
    route = null;
    if (hud) hud.zetNavigatie(null);
    opdracht('');
    if (politie) politie.vergeet();            // ze zijn je kwijt zodra het van boord is
    heat = 0;
    if (verhaal && verhaal.verdien) verhaal.verdien(BELONING);
    zeg(AFGELEVERD);
    if (hud && hud.melding) hud.melding('MISSIE VOLTOOID', `De lading is over. Beloning: + € ${BELONING}`, 8);
  }

  function update(dt) {
    if (fase === 'klaar') return;

    // hij belt pas als het verhaal uitgespeeld is — en alleen als de missie
    // aanstaat (zie VAART_AAN bovenaan dit bestand)
    if (fase === 'uit') {
      if (VAART_AAN && verhaal && verhaal.missie === 'klaar') { fase = 'wacht'; wachtT = NA_JOHAN; }
      return;
    }
    if (fase === 'wacht') {
      wachtT -= dt;
      if (wachtT <= 0) begin();
      return;
    }

    if (fase === 'ophalen') {
      const b = sloep();
      if (!b) return;
      if (boten.inBoot === b) { aanBoord(); return; }
      // de vlag blijft op de sloep staan; die kan verplaatst zijn
      navT -= dt;
      if (navT <= 0) {
        navT = 1.5;
        if (hud) hud.zetNavigatie({ route: null, doel: [b.x, b.z], naam: 'IJlst', letter: 'S' });
      }
      return;
    }

    if (fase === 'varen') {
      const naar = AFLEVEREN.wal || AFLEVEREN;
      const p = sp();
      /*
       De verdenking loopt op zolang de lading aan boord ligt. Niet zetten maar
       optrekken: schud je ze onderweg af (of rijd je door een spuiterij, wat op
       het water niet gaat), dan komt het niet ineens terug op het oude niveau.
      */
      if (boten.inBoot) heat = Math.min(HEAT_MAX, heat + HEAT_PER_SEC * dt);
      if (politie && politie.zetHeat && heat > politie.heat) politie.zetHeat(heat);

      if (Math.hypot(p.x - naar.x, p.z - naar.z) < AFLEVER_AFSTAND && boten.inBoot) afgeleverd();
      return;
    }
  }

  // ---------- opslaan en laden ----------
  function bewaar() {
    return { fase, heat: Math.round(heat), wachtT: +wachtT.toFixed(1) };
  }

  function herstel(s) {
    if (lading && lading.parent) lading.parent.remove(lading);
    lading = null; route = null; heat = 0; fase = 'uit'; wachtT = 0;
    if (!s) return;
    fase = s.fase || 'uit';
    heat = s.heat || 0;
    wachtT = s.wachtT || 0;
    if (fase === 'ophalen') {
      const b = sloep();
      if (b && hud) hud.zetNavigatie({ route: null, doel: [b.x, b.z], naam: 'IJlst', letter: 'S' });
      opdracht('ga naar IJlst en stap in de sloep aan de steiger');
    } else if (fase === 'varen') {
      /*
       De lading hoort weer aan boord. Sta je bij het laden niet in de sloep —
       dat kan, je mag onderweg aanleggen — dan komt hij pas terug als je weer
       instapt; daar zorgt `update` niet voor, dus dat doen we hier.
      */
      const b = boten.inBoot || sloep();
      if (b && b.mesh) {
        lading = maakLading();
        lading.position.set(0, 0.17, -0.55);
        b.mesh.add(lading);
      }
      const naar = AFLEVEREN.wal || AFLEVEREN;
      route = vaarRoute({ x: b ? b.x : OPHALEN.x, z: b ? b.z : OPHALEN.z }, naar);
      if (hud) hud.zetNavigatie({ route, doel: [naar.x, naar.z], naam: 'Geeuwkade', letter: 'X' });
      opdracht('vaar de lading naar de kade bij de waterzuivering');
    }
  }

  // voor de toetsen: de missie van buitenaf kunnen starten zonder het hele
  // verhaal uit te spelen
  function forceer(nieuweFase = 'ophalen') {
    if (nieuweFase === 'ophalen') begin();
    else if (nieuweFase === 'varen' && boten.inBoot) aanBoord();
  }

  return {
    update, bewaar, herstel, forceer,
    get fase() { return fase; },
    get heat() { return heat; },
    get route() { return route; },
    get ladingAanBoord() { return !!lading; },
    get ophaalPlek() { const b = sloep(); return b ? { x: b.x, z: b.z } : { x: OPHALEN.x, z: OPHALEN.z }; },
    get afleverPlek() { return { ...(AFLEVEREN.wal || AFLEVEREN) }; },
    get beloning() { return BELONING; },
    doelSloep,
  };
}
