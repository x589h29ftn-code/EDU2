/*
 Klusjes: optionele opdrachten tussen de missies door (stap 99).

 Gevraagd (28 sep 2026): "random missies om geld te verdienen. Optionele klusjes die je
 tussen elke missie door kan doen. Zo kan je voorafgaand aan huis koop missie geld
 opbouwen. Drugstas of auto van a naar b met random politie of gangs, auto overspuiten
 en ergens parkeren, iemand omleggen en dan 3 sterren afschudden. Beloning tussen 250 en
 1000 afhankelijk van zwaarte. Mag niet overlappen met andere missie. Missiegebied niet
 op de randen."

 Hoe het loopt:

   1. Is het verhaal vrij (tussen twee missies, of een missie die op je wacht onder zijn
      M; `api.vrij`), dan staat er na een paar tellen iemand op een willekeurige stoep:
      Mark of Johan, met een groen speldje K op de kaart.
   2. E bij hem: hij vertelt wat er moet gebeuren, en de klus loopt. Zolang hij loopt
      wacht het verhaal (js/verhaal.js): er komt geen telefoontje en de M doet niets.
   3. Klaar: hij belt, het geld staat erop, en er wordt een checkpoint geschreven.
      Mislukt of afgebroken (X): niets verdiend, en even later staat er een nieuwe.

 De vier soorten, van licht naar zwaar:

   tas       een tas afleveren bij iemand aan de andere kant van de stad; onderweg soms
             een ster, of een groepje dat bij de overdracht op je wacht       € 250–500
   auto      een auto naar de andere kant van de stad brengen, heel; soms staat
             hij als gestolen opgegeven (twee sterren)                         € 400–650
   spuiten   een auto stelen (een ster), laten overspuiten bij de BP (op rekening) en
             ergens langs de stoep neerzetten                                  € 550–750
   omleggen  iemand op straat neerleggen, soms met een lijfwacht; daarna drie
             sterren afschudden                                                € 750–1000

 Stap 132, gevraagd (10 okt 2026): "Voeg aan de klusjes ook missies toe dat je met je drone (check of je er
 een hebt anders draait andere missie) een auto moet volgen overdag of in de nacht. Blijf binnen x meter en
 hoogte. Fotografeer dan bijv een deal met de drone door op muisknop te klikken en breng de foto terug bij
 persoon x. Zo'n soort missie. Laat dezelfde soort missies elkaar niet opvolgen."

   drone     alleen als je een drone hebt (`player.drone`): een auto rijdt over een lijn (`lijnDoor`,
             `rijdVlucht`, zoals de ambulance) naar een deal; volg hem met de drone binnen
             KLUS_DRONE.afstand en tussen KLUS_DRONE.laag en .hoog boven de auto (de balk #droneklus),
             fotografeer de deal met de linkermuisknop (of F) en breng de foto terug       € 600–900

 Twee keer achter elkaar dezelfde soort komt niet voor: `vorigeSoort` is de soort van het laatste aanbod
 (in het geheugen; laden of een missie wist hem niet).

 Plekken: een stoep langs een gewone rijbaan (geen N7, geen viaduct, geen water, niet
 op een bouwvlak), minstens KLUS.rand van de rand van de wereld en KLUS.bezet van alles
 waar het verhaal iets heeft staan (`api.bezet`). Ophalen en afleveren van een auto: een
 plek langs de stoeprand waar geen auto staat (`kantPlek`; de vakken uit de kaart staan
 allemaal vol: 1781 geparkeerde auto's op 1755 vakken). Elke plek moet over de weg te
 bereiken zijn (`api.route`), en een rit is niet langer dan KLUS.maxRoute.
*/
import { Persoon } from './persoon.js';
import { Bewaking } from './bewaking.js';
import { maakMarkering } from './bom.js';
import { resolveCollisions, pointInWater, grondHoogte } from './world.js';
import { inBouwvlak } from './bouwvlak.js';
import { euro } from './hud.js';
import * as THREE from 'three';
import { lijnDoor } from './schaduw.js';
import { profiel, rijdVlucht, puntOp } from './inval.js';
import { lichaamMat } from './lichaam.js';

export const KLUS = {
  rand: 350,              // zo ver van de rand van de wereld blijft elke plek (m)
  wacht: 12,              // zoveel seconden na een missie of een klus komt er een nieuw aanbod
  verplaats: 600,         // een aanbod dat zo lang ligt gaat naar een andere plek (s)
  gever: [220, 850],      // hoe ver de opdrachtgever van je af staat (m, hemelsbreed)
  bezet: 160,             // zo ver van wat het verhaal ergens heeft staan (m)
  praat: 3.4,             // zo dichtbij kun je hem aanspreken (m)
  rit: {                  // hemelsbreed van ophalen tot afleveren (m)
    tas: [650, 1300], auto: [700, 1400], spuiten: [300, 700], parkeer: [450, 1000], omleggen: [400, 900],
    drone: [350, 600],
  },
  maxRoute: 2400,         // langer mag een rit over de weg niet zijn (m)
  loon: { tas: [250, 500], auto: [400, 650], spuiten: [550, 750], omleggen: [750, 1000], drone: [600, 900] },
  aflever: 5,             // zo dicht bij de ontvanger geef je de tas af (m)
  vak: 3.6,               // zo dicht bij de groene ruit staat de auto neergezet (m)
  voorval: 0.55,          // bij dit deel van de afstand gebeurt er onderweg iets
};
export const SOORTEN = ['tas', 'auto', 'spuiten', 'omleggen', 'drone'];

/*
 De drone-klus (stap 132). Afstand is horizontaal van de drone tot de auto, hoogte is hoe hoog de drone
 boven de auto hangt. Te laag: de bestuurder ziet hem (na `gezien` tellen mislukt); te ver of te hoog
 (dan zie je niets): na `kwijt` tellen kwijt. De drone haalt 12 m/s en met shift 26; de auto rijdt
 hoogstens `top`.
*/
export const KLUS_DRONE = {
  afstand: 60,        // m horizontaal van de auto
  laag: 15, hoog: 45, // m boven de auto
  kwijt: 8,           // s te ver, te hoog of niet in de lucht: kwijt
  gezien: 3,          // s te laag: hij heeft de drone gezien
  foto: 70,           // m: verder van de camera is de deal niet te herkennen
  midden: 0.5,        // de deal moet in het midden van het beeld staan: |x| en |y| in NDC (−1…1)
  deal: 22,           // s staan ze bij elkaar
  top: 10,            // m/s (36 km/u)
  stopVoor: 11,       // m voor het eind van de lijn stopt hij: daar staat de auto van de koper
  bereik: 650,        // m: de deal ligt niet verder van de opdrachtgever (de drone haalt 800 m van Erik)
  start: 1.5,         // s na het opstijgen rijdt hij weg
};

// hoe Mark en Johan eruitzien: dezelfde maten als in js/verhaal.js
const MARK = { shirt: 0x2f5d8a, broek: 0x39312a, huid: 0xd9b48f, haar: 0x6b5a45, hoogte: 1.03 };
const JOHAN = { shirt: 0x3d6b3a, broek: 0x2b3542, huid: 0xd3a273, haar: 0x3a2a1c, hoogte: 1.05 };
const LAK = [[0x9b1c1c, 'rode'], [0x1f4f8f, 'blauwe'], [0x2e6b35, 'groene'], [0xe8e6df, 'witte'],
  [0x16171a, 'zwarte'], [0xc9a227, 'gele'], [0x6b2e7a, 'paarse']];
const MODEL = { hatch: 'hatchback', van: 'bestelbus', bx: 'BX' };

const rond50 = (v) => Math.round(v / 50) * 50;
const kies = (lijst) => lijst[Math.floor(Math.random() * lijst.length)];
const afst = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/*
 De teksten. {straat}, {auto}, {bedrag} en {doel} worden ingevuld; `wie` is wie de klus
 geeft. Kort: een klus is geen missie, en je hoort ze vaker.
*/
const TEKST = {
  tas: [
    'Mooi dat je er bent. Ik heb een tas die weg moet.',
    'Naar {doel}. Daar staat iemand op je te wachten. Niet openmaken.',
    'Lever je hem af, dan is het {bedrag}.',
  ],
  auto: [
    'Zie je die {auto} daar? Die moet weg.',
    'Naar {doel}. Zet hem bij de groene ruit langs de stoep en loop weg. Geen krassen.',
    '{bedrag} als hij er heel staat.',
  ],
  spuiten: [
    'Aan {straat} staat een {auto}. Die is nog niet van ons.',
    'Haal hem op en laat hem overspuiten bij de wasbox achter de BP. Dat staat op mijn rekening.',
    'Daarna zet je hem neer aan {doel}, bij de groene ruit. {bedrag}.',
  ],
  omleggen: [
    'Er loopt iemand rond aan {straat}. Hij heeft te veel gezien.',
    'Leg hem om. Daarna zitten ze achter je aan, drie sterren. Schud ze af en ik betaal {bedrag}.',
  ],
  drone: [
    'Zie je die {auto}? Die rijdt zo naar een afspraak.',
    'Volg hem met je drone. Te laag en hij ziet je, te hoog en je ziet niks. Blijf erboven.',
    'Maak een foto van de deal en breng hem hier. Dan is het {bedrag}.',
  ],
  droneTerug: 'Laat zien… Ja, dat is hem. Mooi werk.',
  lijfwacht: 'Hij loopt niet alleen. Er is iemand bij hem die een wapen draagt.',
  politie: 'Shit, er rijdt politie achter je. Schud ze af voor je aflevert.',
  gestolen: 'Die auto staat als gestolen opgegeven. Raak ze kwijt voor je hem neerzet.',
  bende: 'Ze weten dat je komt. Kijk uit bij de overdracht.',
  klaar: 'Netjes gedaan. {bedrag} staat voor je klaar.',
  ontvanger: 'Mooi. Doe de groeten.',
  nietMetPolitie: 'Niet met die blauwe achter je aan. Raak ze eerst kwijt.',
};
const vul = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => (v[k] != null ? v[k] : ''));

export function initKlusjes({ scene, player, vehicles, hud, KAART, api }) {
  const g = KAART.gebied;
  const R = KLUS.rand;
  const binnen = (x, z) => x > g.x0 + R && x < g.x1 - R && z > g.z0 + R && z < g.z1 - R;

  // gewone straten: geen snelweg of afrit, niet te smal en niet te breed
  const straten = KAART.wegassen.filter(w => w.drive && w.naam && !/^(N\d|A\d|Afrit|Rijksweg)/.test(w.naam)
    && w.w >= 4 && w.w <= 12 && w.lengte > 60 && w.pts.length >= 2);

  // de mensen en de markering: één keer gemaakt, zodat er tijdens het spelen niets
  // nieuws hoeft te worden vertaald (stap 83)
  const gevers = { mark: new Persoon(MARK), johan: new Persoon(JOHAN) };
  const ontvanger = new Persoon({ shirt: 0x5a4a3a, broek: 0x1f2328, huid: 0xc79a72, haar: 0x1a1410, hoogte: 1.0, pet: true, petKleur: 0x202225 });
  for (const p of [gevers.mark, gevers.johan, ontvanger]) { p.groep.visible = false; scene.add(p.groep); }
  const merk = maakMarkering(scene, 0x39d353);
  merk.toon(false);
  // de drone-klus: de chauffeur, de koper en de tas, ook één keer gemaakt (stap 132)
  const camera = api.camera || null;
  const chauffeur = new Persoon({ shirt: 0x26292e, broek: 0x1c1e22, huid: 0xd2a67c, haar: 0x18120c, hoogte: 1.02 });
  const koper = new Persoon({ shirt: 0x7a2a22, broek: 0x2b2f36, huid: 0xb98a62, haar: 0x111111, hoogte: 0.98, pet: true, petKleur: 0x15171a });
  for (const p of [chauffeur, koper]) { p.groep.visible = false; scene.add(p.groep); }
  const tasMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.2), lichaamMat(0x1d1a17, 'schoen'));
  tasMesh.visible = false;
  scene.add(tasMesh);
  const balkEl = maakBalk();

  let aanbod = null;          // { soort, wie, plek, t }
  let klus = null;            // de lopende klus
  let wachtT = KLUS.wacht;
  let vorigeSoort = null;
  let gedaan = 0, verdiend = 0;
  let wegNaT = [];            // wie nog even blijft staan tot je weg bent
  let vastSoort = null;       // voor de proef: deze soort als volgende
  // waar een groepje van een klus staat: dat blijft er tot je uit de buurt bent, ook na de
  // klus (js/bendes.js haalt anders alles in één keer weg, ook wat je ziet)
  let bendePlek = null;

  // ---------------------------------------------------------------- plekken
  // een punt op een wegas, op een deel `f` van zijn lengte, met de richting daar
  function langsAs(w, f) {
    const pts = w.pts;
    let tot = 0;
    const lengtes = [];
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); lengtes.push(l); tot += l; }
    let s = f * tot;
    for (let i = 1; i < pts.length; i++) {
      const l = lengtes[i - 1];
      if (s <= l || i === pts.length - 1) {
        const t = l > 0 ? Math.min(1, s / l) : 0;
        const dx = (pts[i][0] - pts[i - 1][0]) / (l || 1), dz = (pts[i][1] - pts[i - 1][1]) / (l || 1);
        return { x: pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, z: pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t, dx, dz };
      }
      s -= l;
    }
    return null;
  }
  function vrijVanVerhaal(x, z) {
    for (const b of api.bezet()) if (Math.hypot(b.x - x, b.z - z) < (b.r || KLUS.bezet)) return false;
    return true;
  }
  function goedePlek(x, z) {
    return binnen(x, z) && !pointInWater(x, z) && !inBouwvlak(x, z) && grondHoogte(x, z, Infinity) < 0.5 && vrijVanVerhaal(x, z);
  }
  // een plek op de stoep langs een gewone straat
  function stoepPlek() {
    const w = kies(straten);
    const p = langsAs(w, 0.25 + Math.random() * 0.5);
    if (!p) return null;
    const kant = Math.random() < 0.5 ? 1 : -1;
    const o = w.w / 2 + 1.7;
    const nx = -p.dz * kant, nz = p.dx * kant;          // opzij van de as
    const [x, z] = resolveCollisions(p.x + nx * o, p.z + nz * o, 0.4);
    if (Math.hypot(x - (p.x + nx * o), z - (p.z + nz * o)) > 1.2) return null;   // in een gebouw of een heg
    if (!goedePlek(x, z)) return null;
    return { x, z, yaw: Math.atan2(nx, nz), as: { x: p.x, z: p.z }, langs: { x: p.dx, z: p.dz }, straat: w.naam, w: w.w, kant };
  }
  function routeLengte(a, b) {
    const r = api.route(a, b);
    if (!r || r.length < 2) return Infinity;
    let l = 0;
    for (let i = 1; i < r.length; i++) l += Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]);
    return l;
  }
  // zoek een plek in een ring om `van`, die over de weg te bereiken is
  function zoekPlek(van, [dMin, dMax], maak = stoepPlek, pogingen = 400) {
    let routes = 0;
    for (let i = 0; i < pogingen; i++) {
      const p = maak();
      if (!p) continue;
      const d = afst(p, van);
      if (d < dMin || d > dMax) continue;
      if (routes++ > 8) break;
      if (routeLengte(van, p) <= KLUS.maxRoute) return p;
    }
    return null;
  }
  /*
   Een plek langs de stoeprand, op de weg, waar een auto kan staan: geen auto binnen vier
   meter, geen muur of paal. `kant` +1 is rechts van de richting van de as, en daar staat
   een auto met zijn neus die kant op (rechts rijden). Zonder `rond` een willekeurige
   straat; met `rond` (een stoepplek) dezelfde straat, een paar meter ernaast.
  */
  function kantOp(w, p, kant) {
    const o = w / 2 - 1.15;
    const nx = -p.dz * kant, nz = p.dx * kant;
    const x = p.x + nx * o, z = p.z + nz * o;
    if (!goedePlek(x, z)) return null;
    const [rx, rz] = resolveCollisions(x, z, 1.0, 3.5);
    if (Math.hypot(rx - x, rz - z) > 0.3) return null;
    for (const c of vehicles.cars) if (Math.abs(c.x - x) < 4 && Math.abs(c.z - z) < 4) return null;
    const yaw = kant > 0 ? Math.atan2(-p.dx, -p.dz) : Math.atan2(p.dx, p.dz);
    return { x, z, yaw, straat: null };
  }
  function kantPlek() {
    const w = kies(straten);
    const p = langsAs(w, 0.2 + Math.random() * 0.6);
    return p ? kantOp(w.w, p, Math.random() < 0.5 ? 1 : -1) : null;
  }
  function kantBij(rond) {
    for (const stap of [7, -7, 12, -12, 18, -18, 25, -25]) {
      const p = { x: rond.as.x + rond.langs.x * stap, z: rond.as.z + rond.langs.z * stap, dx: rond.langs.x, dz: rond.langs.z };
      const q = kantOp(rond.w, p, rond.kant);
      if (q) { q.straat = rond.straat; return q; }
    }
    return null;
  }
  // de straat erbij pas als de plek gekozen is: dat zoeken loopt alle straten af
  const metStraat = (p) => { if (p && !p.straat) p.straat = straatBij(p.x, p.z); return p; };
  // welke straat hoort hierbij: de dichtstbijzijnde as met een naam
  function straatBij(x, z) {
    let beste = null, bd = Infinity;
    for (const w of straten) {
      const pts = w.pts;
      for (let i = 1; i < pts.length; i++) {
        const ax = pts[i - 1][0], az = pts[i - 1][1], bx = pts[i][0] - ax, bz = pts[i][1] - az;
        const l2 = bx * bx + bz * bz || 1e-9;
        const t = Math.max(0, Math.min(1, ((x - ax) * bx + (z - az) * bz) / l2));
        const d = Math.hypot(ax + bx * t - x, az + bz * t - z);
        if (d < bd) { bd = d; beste = w.naam; }
      }
    }
    return beste || 'de stad';
  }
  const deStraat = (naam) => (/^(de|het) /i.test(naam) ? naam : `de ${naam}`);

  // ---------------------------------------------------------------- het aanbod
  function kiesSoort() {
    if (vastSoort) { const s = vastSoort; vastSoort = null; return s; }
    // nooit twee keer dezelfde achter elkaar, en de drone alleen als je er een hebt
    const kan = SOORTEN.filter(s => s !== vorigeSoort && (s !== 'drone' || player.drone));
    return kies(kan);
  }
  function maakAanbod() {
    const sp = api.spelerPunt();
    const plek = zoekPlek(sp, KLUS.gever);
    if (!plek) return false;
    // Johan pas als je hem kent, en niet wie er voor het verhaal al ergens staat
    // (en niet wie van de vorige klus nog in beeld staat: die springt anders voor je ogen weg)
    const kan = ['mark', 'johan'].filter(w => (w === 'mark' || api.johanBekend()) && !api.inBeeld(w)
      && !wegNaT.includes(gevers[w]));
    if (!kan.length) return false;
    const wie = kies(kan);
    aanbod = { soort: kiesSoort(), wie, plek, t: 0 };
    vorigeSoort = aanbod.soort;
    const p = gevers[wie];
    p.zetNeer(plek.x, plek.z, plek.yaw);
    p.groep.visible = true;
    hud.zetKlus({ x: plek.x, z: plek.z, wie });
    return true;
  }
  function haalAanbodWeg() {
    if (!aanbod) return;
    wegNa(gevers[aanbod.wie]);
    aanbod = null;
    hud.zetKlus(null);
    api.praat(null);
  }
  // iemand die er staat verdwijnt pas als je uit de buurt bent: voor je ogen weg leest als een fout
  function wegNa(persoon) { if (persoon && persoon.groep.visible && !wegNaT.includes(persoon)) wegNaT.push(persoon); }
  function ruimWegNa(sp) {
    for (let i = wegNaT.length - 1; i >= 0; i--) {
      const p = wegNaT[i];
      if (aanbod && gevers[aanbod.wie] === p) { wegNaT.splice(i, 1); continue; }
      if (klus && klus.ontvanger === p) { wegNaT.splice(i, 1); continue; }
      if (afst(sp, p.groep.position) > 70) { p.groep.visible = false; wegNaT.splice(i, 1); }
    }
  }

  // ---------------------------------------------------------------- een klus beginnen
  function kop(wie) { return wie === 'johan' ? api.KOPPEN.johan : api.KOPPEN.mark; }
  function naam(wie) { return wie === 'johan' ? 'Johan' : 'Mark'; }
  function zegt(wie, tekst, telefoon = false) { return { wie: naam(wie), kop: kop(wie), tekst, telefoon }; }
  // een regel onderweg: als de balk open is, wacht hij tot hij dicht is
  function meld(wie, tekst) {
    if (!klus) return;
    klus.meldingen.push(zegt(wie, tekst, true));
  }

  function neemAan() {
    const a = aanbod;
    aanbod = null;
    // de drone is kwijt of verkocht sinds het aanbod: dan een andere klus
    if (a.soort === 'drone' && !player.drone) { a.soort = kies(SOORTEN.filter(s => s !== 'drone')); vorigeSoort = a.soort; }
    hud.zetKlus(null);
    api.praat(null);
    klus = { soort: a.soort, wie: a.wie, gever: gevers[a.wie], van: a.plek, fase: 'uitleg', t: 0, meldingen: [], navT: 0 };
    api.pauzeer(true);
    const k = klus;
    const ok = k.soort === 'tas' ? zetTas(k) : k.soort === 'auto' ? zetAuto(k) : k.soort === 'spuiten' ? zetSpuiten(k)
      : k.soort === 'drone' ? zetDrone(k) : zetOmleggen(k);
    if (!ok) {
      // geen plek gevonden (dat hoort niet te gebeuren, maar een klus die niet kan gaat niet door)
      klus = null; api.pauzeer(false);
      api.zeg([zegt(a.wie, 'Laat maar. Er is vandaag niets.')]);
      wegNa(gevers[a.wie]);
      wachtT = KLUS.wacht;
      return;
    }
    const v = { straat: deStraat(k.straat || ''), doel: deStraat(k.doelStraat || ''), auto: k.autoNaam || '', bedrag: euro(k.loon) };
    const regels = TEKST[k.soort].map(t => zegt(a.wie, vul(t, v)));
    if (k.lijfwacht) regels.splice(1, 0, zegt(a.wie, TEKST.lijfwacht));
    api.zeg(regels, () => { if (klus === k) begin(k); });
  }

  // -- de tas
  function zetTas(k) {
    const doel = zoekPlek(k.van, KLUS.rit.tas);
    if (!doel) return false;
    k.doel = doel; k.doelStraat = doel.straat;
    k.d0 = afst(k.van, doel);
    const r = Math.random();
    k.voorval = r < 0.35 ? 'politie' : r < 0.7 ? 'bende' : null;
    const f = Math.max(0, Math.min(1, (k.d0 - KLUS.rit.tas[0]) / (KLUS.rit.tas[1] - KLUS.rit.tas[0])));
    k.loon = rond50(Math.min(KLUS.loon.tas[1], KLUS.loon.tas[0] + f * 150 + (k.voorval ? 100 : 0)));
    return true;
  }
  // -- een auto naar de andere kant van de stad
  function zetAuto(k) {
    const op = kantBij(k.van);
    if (!op) return false;
    const doel = metStraat(zoekPlek(op, KLUS.rit.auto, kantPlek, 600));
    if (!doel) return false;
    const [kleur, kleurNaam] = kies(LAK);
    const soort = kies(['hatch', 'hatch', 'van']);
    k.op = op; k.doel = doel; k.doelStraat = doel.straat;
    k.kleur = kleur; k.autoNaam = `${kleurNaam} ${MODEL[soort]}`; k.autoSoort = soort;
    k.d0 = afst(op, doel);
    k.voorval = Math.random() < 0.5 ? 'gestolen' : null;
    const f = Math.max(0, Math.min(1, (k.d0 - KLUS.rit.auto[0]) / (KLUS.rit.auto[1] - KLUS.rit.auto[0])));
    k.loon = rond50(Math.min(KLUS.loon.auto[1], KLUS.loon.auto[0] + f * 150 + (k.voorval ? 100 : 0)));
    return true;
  }
  // -- stelen, overspuiten, neerzetten
  function zetSpuiten(k) {
    const op = metStraat(zoekPlek(k.van, KLUS.rit.spuiten, kantPlek, 600));
    const bp = (KAART.tankstations || [])[0];
    if (!op || !bp) return false;
    const bpP = { x: bp.x ?? bp.cx, z: bp.z ?? bp.cz };
    // het vak moet een eind van de BP af liggen, en dan hoeft het zelf niet bij de start te liggen
    const doel = metStraat(zoekPlek(bpP, KLUS.rit.parkeer, kantPlek, 600));
    if (!doel) return false;
    const [kleur, kleurNaam] = kies(LAK);
    const soort = kies(['hatch', 'bx', 'van']);
    k.op = op; k.bp = bpP; k.doel = doel; k.straat = op.straat; k.doelStraat = doel.straat;
    k.kleur = kleur; k.autoNaam = `${kleurNaam} ${MODEL[soort]}`; k.autoSoort = soort;
    const d = afst(k.van, op) + afst(op, bpP) + afst(bpP, doel);
    const f = Math.max(0, Math.min(1, (d - 1000) / 1800));
    k.loon = rond50(KLUS.loon.spuiten[0] + f * (KLUS.loon.spuiten[1] - KLUS.loon.spuiten[0]));
    return true;
  }
  // -- iemand omleggen
  function zetOmleggen(k) {
    const doel = zoekPlek(k.van, KLUS.rit.omleggen);
    if (!doel) return false;
    k.doel = doel; k.straat = doel.straat;
    k.lijfwacht = Math.random() < 0.5;
    k.loon = k.lijfwacht ? KLUS.loon.omleggen[1] : KLUS.loon.omleggen[0];
    return true;
  }

  function begin(k) {
    k.fase = 'loopt';
    if (k.soort === 'drone') { beginDrone(k); return; }
    wegNa(k.gever);
    if (k.soort === 'tas') {
      ontvanger.zetNeer(k.doel.x, k.doel.z, k.doel.yaw + Math.PI);
      ontvanger.groep.visible = true;
      k.ontvanger = ontvanger;
      // de ruit naast hem, niet op zijn hoofd
      merk.zet(k.doel.x + k.doel.langs.x * 1.6, 0, k.doel.z + k.doel.langs.z * 1.6); merk.toon(true);
      api.nav(k.doel.x, k.doel.z, `klus · ${k.doel.straat}`, 'K');
      api.zetOpdracht(`breng de tas naar ${deStraat(k.doel.straat)} · X: afbreken`);
      api.melding('KLUS', `De tas naar ${deStraat(k.doel.straat)} · ${euro(k.loon)}`, 5);
    } else if (k.soort === 'auto' || k.soort === 'spuiten') {
      k.auto = vehicles.voegToe({ x: k.op.x, z: k.op.z, yaw: k.op.yaw, soort: k.autoSoort, kleur: k.kleur });
      k.kleur0 = k.auto.kleur;
      k.fase = 'ophalen';
      api.nav(k.op.x, k.op.z, `klus · ${k.autoNaam}`, 'K');
      api.zetOpdracht(k.soort === 'auto'
        ? `stap in de ${k.autoNaam} · X: afbreken`
        : `steel de ${k.autoNaam} aan ${deStraat(k.straat)} · X: afbreken`);
      api.melding('KLUS', k.soort === 'auto' ? `De ${k.autoNaam} wegbrengen · ${euro(k.loon)}` : `Stelen, overspuiten, neerzetten · ${euro(k.loon)}`, 5);
    } else {
      const a = k.doel, l = k.doel.langs;
      const b = { x: a.x + l.x * 9, z: a.z + l.z * 9 };
      const [bx, bz] = resolveCollisions(b.x, b.z, 0.4);
      const posten = [{ a: [a.x, a.z], b: [bx, bz] }];
      if (k.lijfwacht) {
        const [cx, cz] = resolveCollisions(a.x - l.x * 1.4 + l.z * 0.9, a.z - l.z * 1.4 - l.x * 0.9, 0.4);
        posten.push({ a: [cx, cz], b: [bx - l.x * 1.4, bz - l.z * 1.4] });
      }
      k.bewaking = new Bewaking(scene, posten, {
        vest: null, pet: 'om de beurt', schade: 4, zicht: 24, vuurbereik: 28, dekking: 8,
        // het doelwit in een grijs jasje (zo staat het in de opdracht), de lijfwacht in het donker
        kleuren: [{ shirt: 0x767b82, broek: 0x2a2d33 }, { shirt: 0x1f2328, broek: 0x1a1c20 }],
      });
      api.nav(a.x, a.z, `klus · ${deStraat(k.straat)}`, 'K');
      api.zetOpdracht(`leg de man in het grijze jasje om, aan ${deStraat(k.straat)} · X: afbreken`);
      api.melding('KLUS', `Iemand omleggen aan ${deStraat(k.straat)} · ${euro(k.loon)}`, 5);
    }
  }

  // ---------------------------------------------------------------- tijdens de klus
  function werkTasBij(k, sp, dt) {
    const d = afst(sp, k.doel);
    ontvanger.kijkNaar(sp.x, sp.z, dt, 2);
    ontvanger.update(dt, {});
    if (!k.gebeurd && d < k.d0 * KLUS.voorval) {
      k.gebeurd = true;
      if (k.voorval === 'politie') {
        api.sterGeven(1, sp.x, sp.z);
        meld(k.wie, TEKST.politie);
      } else if (k.voorval === 'bende') {
        // een groepje een paar huizen voor de ontvanger, op dezelfde stoep
        const l = k.doel.langs, kant = Math.random() < 0.5 ? 1 : -1;
        const [x, z] = resolveCollisions(k.doel.x + l.x * 16 * kant, k.doel.z + l.z * 16 * kant, 0.4);
        api.bende.zetGroep(x, z, 2 + Math.floor(Math.random() * 2));
        k.bende = true;
        bendePlek = { x, z };
        meld(k.wie, TEKST.bende);
      }
    }
    if (d < KLUS.aflever + 2 && api.balkDicht()) {
      if (player.inCar) api.praat('stap uit om de tas af te geven');
      else if (api.sterren() > 0) api.praat('eerst de politie kwijt — dan pas afgeven');
      else api.praat('E — tas afgeven');
    } else if (k.bijOntvanger) api.praat(null);
    k.bijOntvanger = d < KLUS.aflever + 2;
  }
  function tasToets(k, sp) {
    if (afst(sp, k.doel) > KLUS.aflever + 2 || player.inCar) return false;
    if (api.sterren() > 0) { api.zeg([{ wie: 'Koper', tekst: TEKST.nietMetPolitie }]); return true; }
    api.praat(null);
    api.zeg([{ wie: 'Koper', tekst: TEKST.ontvanger }], () => geslaagd(k));
    return true;
  }

  function werkAutoBij(k, sp, dt) {
    const auto = k.auto;
    if (!auto || auto.wrak || auto.hp <= 0) { mislukt('De auto is total loss.'); return; }
    if (k.fase === 'ophalen') {
      if (player.inCar === auto) {
        if (k.soort === 'spuiten') {
          k.fase = 'spuiten';
          api.sterGeven(1, auto.x, auto.z);
          api.nav(k.bp.x, k.bp.z, 'BP · wasbox', 'S');
          api.zetOpdracht('laat hem overspuiten bij de wasbox achter de BP · X: afbreken');
        } else {
          k.fase = 'rijden';
          naarHetVak(k);
          if (k.voorval === 'gestolen') k.gebeurdNa = true;
        }
      }
      return;
    }
    if (k.fase === 'spuiten') {
      if (auto.kleur !== k.kleur0) { k.fase = 'rijden'; naarHetVak(k); }
      return;
    }
    if (k.fase === 'rijden') {
      const d = afst(auto, k.doel);
      if (k.gebeurdNa && !k.gebeurd && d < k.d0 * KLUS.voorval) {
        k.gebeurd = true;
        api.sterGeven(2, auto.x, auto.z);
        meld(k.wie, TEKST.gestolen);
      }
      const staat = d < KLUS.vak && Math.abs(auto.speed || 0) < 0.6;
      if (staat && !player.inCar) {
        if (api.sterren() > 0) {
          if (!k.teVroeg) { k.teVroeg = true; api.zetOpdracht('schud eerst de politie af, dan pas neerzetten', true); }
          return;
        }
        merk.toon(false);
        geslaagd(k);
      } else if (k.teVroeg && api.sterren() === 0) {
        k.teVroeg = false;
        api.zetOpdracht(`zet de ${k.autoNaam} bij de groene ruit aan ${deStraat(k.doelStraat)} en stap uit · X: afbreken`);
      }
    }
  }
  function naarHetVak(k) {
    k.d0 = afst(k.auto, k.doel);
    merk.zet(k.doel.x, 0, k.doel.z); merk.toon(true);
    api.nav(k.doel.x, k.doel.z, `klus · ${k.doelStraat}`, 'K');
    api.zetOpdracht(`zet de ${k.autoNaam} bij de groene ruit aan ${deStraat(k.doelStraat)} en stap uit · X: afbreken`);
  }

  function werkOmleggenBij(k, sp, dt) {
    const bw = k.bewaking;
    const doelwit = bw.wachters[0];
    const pos = doelwit.persoon.groep.position;
    const dSp = afst(sp, pos);
    k.schade += bw.update(dt, player, dSp < 32);
    if (!k.gedood) {
      k.navT -= dt;
      if (k.navT <= 0) { k.navT = 2; api.nav(pos.x, pos.z, `klus · ${deStraat(k.straat)}`, 'K'); }
      if (doelwit.staat === 'neer') {
        k.gedood = true; k.naT = 0;
        api.sterGeven(3, pos.x, pos.z);
        api.navUit();
        api.zetOpdracht('schud de politie af · X: afbreken');
        api.melding('Raak', 'Nu weg hier: drie sterren.', 4);
      }
      return;
    }
    k.naT += dt;
    if (k.naT > 2 && api.sterren() === 0) geslaagd(k);
  }

  // ---------------------------------------------------------------- de drone-klus (stap 132)
  /*
   De deal staat los van de klus: na een mislukte of afgebroken klus speelt hij nog uit (de auto rijdt
   door, de twee mannen lopen terug naar hun auto), en alles gaat pas weg als je het niet meer kunt zien.
   Laden en een nieuwe missie ruimen hem meteen op (`reset` → `ruimDeal`).
     fase  wacht → rijden → uitstappen → deal → terug → weg     (`stil`: de auto rijdt niet meer)
  */
  let deal = null;
  const v3 = new THREE.Vector3(), kijk = new THREE.Vector3();

  // de balk: afstand en hoogte, elk met een groen stuk waar het goed is
  function maakBalk() {
    if (typeof document === 'undefined') return null;
    const stijl = document.createElement('style');
    stijl.textContent = `
      #droneklus { position: absolute; left: 24px; top: 66px; width: 300px; font-size: 12px; font-weight: 700; color: #fff;
        text-shadow: 0 1px 3px rgba(0,0,0,.9); --goed: 62%; --laag: 25%; --hoog: 75%; --af: 0%; --ho: 0%; }
      #droneklus[hidden] { display: none; }
      #droneklus .rij { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
      #droneklus .naam { width: 66px; font-size: 11px; letter-spacing: .06em; }
      #droneklus .spoor { position: relative; flex: 1; height: 10px; border-radius: 5px; box-shadow: 0 0 0 2px rgba(0,0,0,.55); }
      #droneklus .af { background: linear-gradient(90deg, #3fae4a 0 var(--goed), #c8321e var(--goed) 100%); }
      #droneklus .ho { background: linear-gradient(90deg, #c8321e 0 var(--laag), #3fae4a var(--laag) var(--hoog), #c8321e var(--hoog) 100%); }
      #droneklus .wijzer { position: absolute; top: -5px; width: 4px; height: 20px; margin-left: -2px; background: #fff;
        border-radius: 2px; box-shadow: 0 0 4px rgba(0,0,0,.9); }
      #droneklus .af .wijzer { left: var(--af); }
      #droneklus .ho .wijzer { left: var(--ho); }
      #droneklus.fout .tekst { color: #ff6a50; }`;
    document.head.appendChild(stijl);
    const el = document.createElement('div');
    el.id = 'droneklus';
    el.hidden = true;
    el.innerHTML = '<div class="rij"><span class="naam">AFSTAND</span><div class="spoor af"><div class="wijzer"></div></div></div>'
      + '<div class="rij"><span class="naam">HOOGTE</span><div class="spoor ho"><div class="wijzer"></div></div></div><div class="tekst"></div>';
    (document.getElementById('ui') || document.body).appendChild(el);
    return el;
  }
  const AF_SCHAAL = KLUS_DRONE.afstand * 1.6, HO_SCHAAL = KLUS_DRONE.hoog * 1.33;
  const pct = (v, max) => `${Math.max(0, Math.min(100, v / max * 100)).toFixed(1)}%`;
  function toonBalk(d, h, tekst, fout) {
    if (!balkEl) return;
    balkEl.hidden = false;
    balkEl.style.setProperty('--goed', pct(KLUS_DRONE.afstand, AF_SCHAAL));
    balkEl.style.setProperty('--laag', pct(KLUS_DRONE.laag, HO_SCHAAL));
    balkEl.style.setProperty('--hoog', pct(KLUS_DRONE.hoog, HO_SCHAAL));
    balkEl.style.setProperty('--af', pct(d, AF_SCHAAL));
    balkEl.style.setProperty('--ho', pct(h, HO_SCHAAL));
    const t = balkEl.querySelector('.tekst');
    if (t.textContent !== tekst) t.textContent = tekst;
    balkEl.classList.toggle('fout', !!fout);
  }

  // het snelheidsprofiel van de lijn, met remmen tot stilstand op `sStop`
  function profielTot(L, sStop) {
    const v = profiel(L, { top: KLUS_DRONE.top });
    for (let i = 0; i < L.n; i++) v[i] = Math.min(v[i], Math.sqrt(2 * 2.5 * Math.max(0, sStop - L.s[i])) + 0.3);
    return v;
  }

  // de rit uitzetten: een auto bij de opdrachtgever, een lijn over de weg naar de deal, en daar de koper
  function zetDrone(k) {
    if (!player.drone) return false;
    const op = kantBij(k.van);
    if (!op) return false;
    for (let poging = 0; poging < 6; poging++) {
      const plek = metStraat(zoekPlek(op, KLUS.rit.drone, kantPlek, 600));
      if (!plek || afst(plek, k.van) > KLUS_DRONE.bereik) continue;
      const L = lijnDoor(KAART, [[op.x, op.z], [plek.x, plek.z]]);
      if (!L || L.n < 10 || L.lengte < 250 || L.lengte > 1300 || L.sprong > 0.8) continue;
      const eind = puntOp(L, L.lengte);
      if (afst(eind, k.van) > KLUS_DRONE.bereik || afst(eind, k.van) < 200) continue;
      ruimDeal();
      const [kleur, kleurNaam] = kies(LAK);
      const soort = kies(['hatch', 'hatch', 'van']);
      const [kleur2] = kies(LAK.filter(l => l[0] !== kleur));
      const sStop = L.lengte - KLUS_DRONE.stopVoor;
      const baan = (s) => Math.min(1.2, L.baan[Math.min(L.n - 1, Math.round(s / 2))] || 1);
      const a = puntOp(L, 0, baan(0));
      const b = puntOp(L, L.lengte - 0.5, baan(L.lengte));
      const auto = vehicles.voegToe({ x: a.x, z: a.z, yaw: a.yaw, soort, kleur, driveable: false });
      const koperAuto = vehicles.voegToe({ x: b.x, z: b.z, yaw: b.yaw + Math.PI, soort: 'hatch', kleur: kleur2, driveable: false });
      vehicles.zetNeer(auto, 0, auto.yaw);
      vehicles.zetNeer(koperAuto, 0, koperAuto.yaw);
      // waar ze elkaar treffen: tussen de twee auto's, aan de stoepkant
      const m = puntOp(L, sStop + (KLUS_DRONE.stopVoor - 0.5) / 2, baan(sStop) + 2.4);
      const [mx, mz] = resolveCollisions(m.x, m.z, 0.4);
      deal = {
        L, sStop, auto, koperAuto, fase: 'wacht', dealT: 0, einde: false,
        rit: { s: 0, v: 0, prof: profielTot(L, sStop), klaar: false, gecrasht: false },
        midden: { x: mx, z: mz, tx: m.tx, tz: m.tz },
        deurA: puntOp(L, sStop, baan(sStop) + 1.3), deurB: puntOp(L, L.lengte - 0.5, baan(L.lengte) + 1.3),
        tasBij: chauffeur,
      };
      k.deal = deal;
      k.autoNaam = `${kleurNaam} ${MODEL[soort]}`;
      k.straat = op.straat; k.doelStraat = plek.straat;
      const f = Math.max(0, Math.min(1, (L.lengte - 300) / 800));
      k.loon = rond50(KLUS.loon.drone[0] + f * (KLUS.loon.drone[1] - KLUS.loon.drone[0]));
      k.laagT = 0; k.buitenT = 0; k.startT = 0;
      return true;
    }
    return false;
  }
  function beginDrone(k) {
    k.fase = 'wachten';
    api.nav(k.deal.auto.x, k.deal.auto.z, `klus · de ${k.autoNaam}`, 'K');
    api.zetOpdracht(`start je drone (B) en volg de ${k.autoNaam} · X: afbreken`);
    api.melding('KLUS', `Start je drone (B) · volg de ${k.autoNaam} · ${euro(k.loon)}`, 5);
  }
  // de deal in beeld: het punt tussen de twee mannen, op borsthoogte
  function dealPunt() {
    const a = chauffeur.groep.position, b = koper.groep.position;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + 1.1, z: (a.z + b.z) / 2 };
  }
  // iemand loopt naar een punt; true als hij er is
  function loop(p, doel, dt, snel = 1.5) {
    const pos = p.groep.position, dx = doel.x - pos.x, dz = doel.z - pos.z, d = Math.hypot(dx, dz);
    if (d < 0.3) { p.update(dt, {}); return true; }
    const stap = Math.min(d, snel * dt);
    pos.x += dx / d * stap; pos.z += dz / d * stap;
    p.draaiNaar(Math.atan2(-dx, -dz), dt, 8);
    p.update(dt, { loopt: true, snelheid: snel });
    return false;
  }
  function zetTasMesh() {
    const p = deal.tasBij, pos = p.groep.position;
    tasMesh.position.set(pos.x - Math.sin(p.yaw) * 0.32, pos.y + 0.78, pos.z - Math.cos(p.yaw) * 0.32);
    tasMesh.rotation.y = p.yaw;
  }
  // elk beeld, ook zonder klus: de rit, het uitstappen, de deal, teruglopen en opruimen
  function werkDealBij(dt, sp) {
    const D = deal;
    if (!D) return;
    const auto = D.auto;
    if (D.fase === 'rijden') {
      if (auto.wrak || auto.hp <= 0) D.fase = 'stil';
      else {
        rijdVlucht(D.rit, D.L, auto, vehicles, dt);
        if (D.rit.s >= D.sStop - 0.25) {
          D.rit.klaar = true; auto.speed = 0;
          if (D.einde) D.fase = 'stil';
          else {
            D.fase = 'uitstappen';
            chauffeur.zetNeer(D.deurA.x, D.deurA.z, auto.yaw); chauffeur.groep.visible = true;
            koper.zetNeer(D.deurB.x, D.deurB.z, D.koperAuto.yaw); koper.groep.visible = true;
            D.tasBij = chauffeur; tasMesh.visible = true; zetTasMesh();
          }
        }
      }
    } else if (D.fase === 'uitstappen') {
      const m = D.midden;
      const a = loop(chauffeur, { x: m.x - m.tx * 0.55, z: m.z - m.tz * 0.55 }, dt);
      const b = loop(koper, { x: m.x + m.tx * 0.55, z: m.z + m.tz * 0.55 }, dt);
      zetTasMesh();
      if (a && b) { D.fase = 'deal'; D.dealT = KLUS_DRONE.deal; }
    } else if (D.fase === 'deal') {
      D.dealT -= dt;
      chauffeur.kijkNaar(koper.groep.position.x, koper.groep.position.z, dt, 6);
      koper.kijkNaar(chauffeur.groep.position.x, chauffeur.groep.position.z, dt, 6);
      chauffeur.update(dt, {}); koper.update(dt, {});
      // halverwege gaat de tas over
      if (D.dealT < KLUS_DRONE.deal / 2) D.tasBij = koper;
      zetTasMesh();
      if (D.dealT <= 0) D.fase = 'terug';
    } else if (D.fase === 'terug') {
      const a = !chauffeur.groep.visible || loop(chauffeur, D.deurA, dt);
      const b = !koper.groep.visible || loop(koper, D.deurB, dt);
      if (a) chauffeur.groep.visible = false;
      if (b) koper.groep.visible = false;
      zetTasMesh();
      if (b) tasMesh.visible = false;
      if (a && b) D.fase = 'weg';
    }
    // klaar of afgebroken: weg als niemand het meer ziet (Erik niet, en de drone niet)
    if (D.einde && D.fase !== 'uitstappen' && D.fase !== 'deal' && D.fase !== 'terug') {
      const cam = player.inDrone && camera ? camera.position : null;
      if (afst(sp, auto) > 150 && afst(sp, D.koperAuto) > 150
        && (!cam || (afst(cam, auto) > 150 && afst(cam, D.koperAuto) > 150))) ruimDeal();
    }
  }
  function ruimDeal() {
    if (!deal) return;
    vehicles.verwijder(deal.auto);
    vehicles.verwijder(deal.koperAuto);
    deal = null;
    chauffeur.groep.visible = false; koper.groep.visible = false; tasMesh.visible = false;
  }

  // de drone tijdens de klus: waar hangt hij ten opzichte van de auto
  function werkDroneBij(k, sp, dt) {
    const D = k.deal;
    if (!player.drone) { mislukt('De drone is kwijt.'); return; }
    if (!D || D.fase === 'stil' || D.auto.wrak || D.auto.hp <= 0) { mislukt('De auto is kapot. Er komt geen deal meer.'); return; }
    const inDeLucht = !!(player.inDrone && camera);
    if (k.fase === 'wachten') {
      if (balkEl) balkEl.hidden = !inDeLucht;
      if (!inDeLucht) { k.startT = 0; if (api.balkDicht()) api.praat('B — start je drone'); return; }
      api.praat(null);
      k.startT += dt;
      if (k.startT >= KLUS_DRONE.start) {
        k.fase = 'volgen'; D.fase = 'rijden';
        api.zetOpdracht(`volg de ${k.autoNaam} met je drone en fotografeer de deal (klik) · X: afbreken`);
      }
    }
    if (k.fase === 'terug') {
      if (balkEl) balkEl.hidden = true;
      const d = afst(sp, k.gever.groep.position);
      if (d < KLUS.praat + 1 && api.balkDicht()) api.praat(player.inDrone ? 'haal eerst je drone terug (B)' : player.inCar ? 'stap uit om de foto te laten zien' : 'E — foto laten zien');
      else if (d < KLUS.praat + 4) api.praat(null);
      return;
    }
    // het volgen (ook tijdens de rit naar de deal en de deal zelf)
    k.navT2 = (k.navT2 || 0) - dt;
    if (k.navT2 <= 0) { k.navT2 = 2; api.nav(D.auto.x, D.auto.z, `klus · de ${k.autoNaam}`, 'K'); }
    if (k.fase !== 'volgen') return;
    if (D.fase === 'weg' || D.fase === 'terug') { mislukt('De deal is voorbij en je hebt geen foto.'); return; }
    let staat = 'goed', d = 0, h = 0;
    if (!inDeLucht) {
      staat = 'niet';
      if (balkEl) balkEl.hidden = true;
      if (api.balkDicht()) api.praat('B — start je drone');
    } else {
      const c = camera.position;
      d = Math.hypot(c.x - D.auto.x, c.z - D.auto.z);
      h = c.y - (D.auto.mesh ? D.auto.mesh.position.y : 0);
      staat = h < KLUS_DRONE.laag ? 'laag' : d > KLUS_DRONE.afstand ? 'ver' : h > KLUS_DRONE.hoog ? 'hoog' : 'goed';
      api.praat(null);
    }
    if (staat === 'laag') k.laagT += dt; else k.laagT = Math.max(0, k.laagT - dt * 0.5);
    if (staat === 'ver' || staat === 'hoog' || staat === 'niet') k.buitenT += dt; else k.buitenT = 0;
    k.staat = staat;
    if (k.laagT >= KLUS_DRONE.gezien) { mislukt('Hij heeft de drone gezien. De deal gaat niet door.'); return; }
    if (k.buitenT >= KLUS_DRONE.kwijt) { mislukt(staat === 'hoog' ? 'Te hoog: je bent hem uit het oog verloren.' : `Je bent de ${k.autoNaam} kwijt.`); return; }
    if (!inDeLucht) return;
    const rest = (t) => Math.max(0, Math.ceil(t));
    const tekst = staat === 'laag' ? `TE LAAG — hij ziet je bijna · ${rest(KLUS_DRONE.gezien - k.laagT)}`
      : staat === 'ver' ? `TE VER — ${rest(KLUS_DRONE.kwijt - k.buitenT)} tellen om bij te komen`
      : staat === 'hoog' ? `TE HOOG — je ziet niets · ${rest(KLUS_DRONE.kwijt - k.buitenT)}`
      : D.fase === 'deal' ? 'DE DEAL — klik voor een foto'
      : D.fase === 'uitstappen' ? 'ze stappen uit…' : `goed · ${Math.round(d)} m, ${Math.round(h)} m hoog`;
    toonBalk(d, h, tekst, staat !== 'goed');
  }

  // een foto uit de drone: telt als de deal bezig is, dichtbij genoeg en midden in beeld
  function flits() {
    if (typeof document === 'undefined') return;
    const f = document.getElementById('fotoflits');
    if (f) { f.classList.remove('aan'); void f.offsetWidth; f.classList.add('aan'); }
  }
  function foto() {
    const k = klus;
    if (!k || k.soort !== 'drone' || !player.inDrone || !camera) return null;
    flits();
    const D = k.deal;
    let reden = null;
    if (k.fase !== 'volgen' || !D || D.fase !== 'deal') reden = 'Er is (nog) geen deal in beeld.';
    else {
      const P = dealPunt();
      camera.updateMatrixWorld();
      v3.set(P.x, P.y, P.z);
      const d = camera.position.distanceTo(v3);
      camera.getWorldDirection(kijk);
      const voor = (v3.x - camera.position.x) * kijk.x + (v3.y - camera.position.y) * kijk.y + (v3.z - camera.position.z) * kijk.z;
      v3.project(camera);
      if (d > KLUS_DRONE.foto) reden = 'Te ver weg: je ziet niet wie het zijn.';
      else if (voor <= 0 || Math.abs(v3.x) > KLUS_DRONE.midden || Math.abs(v3.y) > KLUS_DRONE.midden) reden = 'De deal staat er niet op.';
    }
    if (reden) { api.melding('FOTO', reden, 3); return { ok: false, reden }; }
    k.foto = true;
    k.fase = 'terug';
    if (balkEl) balkEl.hidden = true;
    api.melding('FOTO', `De deal staat erop. Breng hem naar ${naam(k.wie)}.`, 4);
    api.nav(k.gever.groep.position.x, k.gever.groep.position.z, `klus · ${naam(k.wie)}`, 'K');
    api.zetOpdracht(`breng de foto naar ${naam(k.wie)} · X: afbreken`);
    return { ok: true };
  }
  function droneTerugToets(k, sp) {
    if (afst(sp, k.gever.groep.position) > KLUS.praat + 1 || player.inCar || player.inDrone) return false;
    api.praat(null);
    api.zeg([zegt(k.wie, TEKST.droneTerug)], () => geslaagd(k));
    return true;
  }
  // de linkermuisknop (en F, naast de foto van js/main.js) in de drone
  if (typeof document !== 'undefined') {
    const magFoto = () => player.active && klus && klus.soort === 'drone' && player.inDrone;
    document.addEventListener('mousedown', e => { if (e.button === 0 && magFoto()) foto(); });
    document.addEventListener('keydown', e => {
      if (e.code === 'KeyF' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && magFoto()) foto();
    });
  }

  // ---------------------------------------------------------------- einde
  function ruimKlusOp(k, { direct = false } = {}) {
    merk.toon(false);
    api.praat(null);
    if (k.bewaking) {
      // wie er ligt blijft even liggen; wie nog staat mag weg zodra je uit beeld bent
      if (direct) k.bewaking.verwijder();
      else { const bw = k.bewaking; k.bewakingWeg = bw; }
    }
    if (k.ontvanger) { if (direct) k.ontvanger.groep.visible = false; else wegNa(k.ontvanger); }
    if (k.soort === 'drone') {
      if (balkEl) balkEl.hidden = true;
      // de deal speelt uit en de auto's gaan weg als je ze niet meer ziet; laden en een missie: meteen
      if (direct) ruimDeal(); else if (deal) deal.einde = true;
      if (!direct) wegNa(k.gever);
    }
    k.bende = false;
  }
  let oudeBewaking = [];
  function geslaagd(k) {
    if (klus !== k) return;
    ruimKlusOp(k);
    if (k.bewakingWeg) oudeBewaking.push(k.bewakingWeg);
    klus = null;
    gedaan++; verdiend += k.loon;
    vorigeSoort = k.soort;
    wachtT = KLUS.wacht;
    api.navUit();
    api.zetOpdracht('');
    api.telefoon();
    api.zeg([zegt(k.wie, vul(TEKST.klaar, { bedrag: euro(k.loon) }), true)], () => {
      api.verdien(k.loon);
      api.melding('KLUS GESLAAGD', `+ ${euro(k.loon)}`, 6);
      api.pauzeer(false);
      api.checkpoint();
    });
  }
  function mislukt(reden, kopTekst = 'KLUS MISLUKT') {
    const k = klus;
    if (!k) return;
    ruimKlusOp(k);
    if (k.bewakingWeg) oudeBewaking.push(k.bewakingWeg);
    klus = null;
    vorigeSoort = k.soort;
    wachtT = KLUS.wacht * 2;
    api.navUit();
    api.zetOpdracht('');
    api.melding(kopTekst, reden, 5);
    api.pauzeer(false);
  }

  // ---------------------------------------------------------------- elk beeld
  function update(dt) {
    const sp = api.spelerPunt();
    ruimWegNa(sp);
    werkDealBij(dt, sp);
    if (bendePlek && !(klus && klus.bende) && afst(sp, bendePlek) > 160) bendePlek = null;
    for (let i = oudeBewaking.length - 1; i >= 0; i--) {
      const bw = oudeBewaking[i];
      const w = bw.wachters[0];
      if (!w || afst(sp, w.persoon.groep.position) > 90) { bw.verwijder(); oudeBewaking.splice(i, 1); }
      else bw.update(dt, player, false);
    }
    if (!klus) {
      // niet vrij: het aanbod weg, behalve tijdens het telefoontje van een missie die daarna op je wacht (api.houd)
      if (!api.vrij()) { if (aanbod && !(api.houd && api.houd())) haalAanbodWeg(); wachtT = Math.max(wachtT, KLUS.wacht); return 0; }
      if (!aanbod) {
        wachtT -= dt;
        if (wachtT <= 0) { if (!maakAanbod()) wachtT = 4; }
        return 0;
      }
      aanbod.t += dt;
      const p = gevers[aanbod.wie];
      const d = afst(sp, p.groep.position);
      if (aanbod.t > KLUS.verplaats && d > 250) { haalAanbodWeg(); wachtT = 1; return 0; }
      if (d < 30) p.kijkNaar(sp.x, sp.z, dt, 2);
      p.update(dt, { zwaait: d < 22 && d > KLUS.praat });
      if (d < KLUS.praat && api.balkDicht()) api.praat(`E — klus van ${naam(aanbod.wie)}`);
      else if (d < KLUS.praat + 3) api.praat(null);
      return 0;
    }
    const k = klus;
    k.t += dt;
    k.schade = 0;
    if (k.gever.groep.visible) { k.gever.kijkNaar(sp.x, sp.z, dt, 2); k.gever.update(dt, {}); }
    if (k.fase === 'uitleg') return 0;
    // wat er onderweg gezegd wordt, als de balk vrij is
    if (k.meldingen.length && api.balkDicht()) api.zeg(k.meldingen.splice(0), null, { auto: 3.4 });
    if (k.fase !== 'uitleg' && k.soort !== 'omleggen') {
      k.navT -= dt;
      if (k.navT <= 0) { k.navT = 2; api.navBij(); }
    }
    if (k.soort === 'tas') werkTasBij(k, sp, dt);
    else if (k.soort === 'auto' || k.soort === 'spuiten') werkAutoBij(k, sp, dt);
    else if (k.soort === 'drone') werkDroneBij(k, sp, dt);
    else werkOmleggenBij(k, sp, dt);
    if (merk.zichtbaar) merk.update(dt);
    return k.schade || 0;
  }

  function toets() {
    const sp = api.spelerPunt();
    if (!klus && aanbod && api.vrij()) {
      const p = gevers[aanbod.wie];
      if (afst(sp, p.groep.position) < KLUS.praat) { neemAan(); return true; }
      return false;
    }
    if (klus && klus.soort === 'tas' && klus.fase === 'loopt') return tasToets(klus, sp);
    if (klus && klus.soort === 'drone' && klus.fase === 'terug') return droneTerugToets(klus, sp);
    return false;
  }

  // `aanbodHouden`: een missie die vanzelf begint (na de tussenpoos) laat een klaarstaand aanbod liggen
  function reset({ aanbodHouden = false } = {}) {
    if (aanbodHouden && !klus && aanbod) return;
    if (klus) ruimKlusOp(klus, { direct: true });
    for (const bw of oudeBewaking) bw.verwijder();
    oudeBewaking = [];
    klus = null; aanbod = null; bendePlek = null;
    ruimDeal();
    if (balkEl) balkEl.hidden = true;
    for (const p of [gevers.mark, gevers.johan, ontvanger]) p.groep.visible = false;
    wegNaT = [];
    hud.zetKlus(null);
    wachtT = KLUS.wacht;
  }

  return {
    update, toets, reset,
    afbreken() { if (!klus) return false; mislukt('Je hebt de klus laten lopen.', 'KLUS AFGEBROKEN'); return true; },
    doelen() {
      const uit = [];
      if (klus && klus.bewaking) uit.push(...klus.bewaking.doelen());
      for (const bw of oudeBewaking) uit.push(...bw.doelen());
      return uit;
    },
    raak(obj) {
      if (klus && klus.bewaking && klus.bewaking.raak(obj)) return true;
      for (const bw of oudeBewaking) if (bw.raak(obj)) return true;
      return false;
    },
    hoorSchot(x, z) { if (klus && klus.bewaking) klus.bewaking.hoorSchot(x, z); },
    // het overspuiten van de klusauto staat op rekening (js/spuiterij.js)
    spuitPrijs(auto) { return klus && klus.soort === 'spuiten' && auto && auto === klus.auto ? 0 : null; },
    get bezig() { return !!klus; },
    // de drone-klus (stap 132): een foto maken (de linkermuisknop of F in de drone), en de deal zelf
    foto,
    get deal() { return deal; },
    get vorigeSoort() { return vorigeSoort; },
    get bende() { return !!((klus && klus.bende) || bendePlek); },
    get aanbod() { return aanbod ? { soort: aanbod.soort, wie: aanbod.wie, x: aanbod.plek.x, z: aanbod.plek.z, straat: aanbod.plek.straat, t: aanbod.t } : null; },
    get klus() { return klus; },
    // wie de klus aanbiedt (een Persoon), voor de foto's
    get gever() { return aanbod ? gevers[aanbod.wie] : null; },
    get wachtT() { return wachtT; },
    get gedaan() { return gedaan; },
    get verdiend() { return verdiend; },
    get binnenGebied() { return binnen; },
    // voor de proef
    __soort(s) { vastSoort = s; },
    __plek: () => stoepPlek(),
    __vak: () => metStraat(kantPlek()),
    // (de vorige opdrachtgever gaat meteen weg: in de proef sta je er vaak nog naast)
    __nieuwAanbod() {
      if (aanbod) gevers[aanbod.wie].groep.visible = false;
      haalAanbodWeg();
      wegNaT = wegNaT.filter(p => p.groep.visible);
      wachtT = 0;
      return maakAanbod();
    },
    __zetAanbodBij(x, z) {
      if (!aanbod) return false;
      const p = gevers[aanbod.wie];
      aanbod.plek = { ...aanbod.plek, x, z };
      p.zetNeer(x, z, aanbod.plek.yaw);
      hud.zetKlus({ x, z, wie: aanbod.wie });
      return true;
    },
  };
}
