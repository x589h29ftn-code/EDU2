/*
 Het verhaal van Erik en zijn broer Mark.

 Vier missies, achter elkaar:

 1. molenkrite  – Mark staat op de stoep voor Molenkrite 15 (het pand met dat
    huisnummer in de kaartdata: steile kap met dakkapel, het vierde huis na de
    knik). Hij kijkt je aan en zwaait; met E spreek je hem aan. Het gesprek
    staat onderin het scherm en klikt met E door. Daarna loopt hij naar het
    gezelschap dat schuin tegenover, in de voortuin van Molenkrite 20, bier zit
    te drinken, en roept hij je de opdracht toe. Als alle vier neer zijn vertelt
    hij over de lading bij de waterzuivering.
 2. rijden      – er staat een auto in de straat; jij rijdt, Mark gaat mee. De
    kaart (minimap en M) wijst de route naar de rioolwaterzuivering aan de
    Buitenroede. Bij het terrein stap je automatisch uit.
 3. bewaking    – vijf bewakers lopen over het terrein. Binnen het hek vallen ze
    je aan zodra ze je zien of je horen schieten; je levensbalk loopt dan leeg.
    Ga je neer, dan begin je bij je laatste opgeslagen spel. Zijn alle vijf uit
    geschakeld, dan gaat de schuifpoort open en mag je de vrachtwagen pakken.
 4. afleveren   – rij de vrachtwagen naar de boerderij in de zuidwesthoek van
    het gebied. Daar staat MISSION COMPLETED in beeld.
 5. johan       – meteen daarna gaat de telefoon: Johan van Kruirad 62 is
    bestolen. Bij zijn oprit krijg je de briefing, in De Wieken spoor je de dief
    op (felrood shirt, gele broek, wit petje), en dan is het rennen: hem
    neerschieten laat de missie mislukken. Na negentig seconden is hij op en kun
    je hem tegen het asfalt trappen; met de duizend euro terug naar Johan levert
    dat vijfhonderd euro in je portemonnee op.

 Alle plekken komen uit js/kaart.js (BGT en 3D BAG): het pand met huisnummer 15
 aan de Molenkrite, het pand ertegenover, het hek en de schuifpoort van het
 RWZI-terrein, de schuur van de boerderij en het wegennet voor de route. In dit
 bestand staat dus geen enkele coördinaat, alleen adressen, namen en afstanden.
*/
import * as THREE from 'three';
import { KAART, poortBladen } from './kaartwereld.js';
import { drinkArmen, radioPlekken, resolveCollisions, addCollider } from './world.js';
import { maakProp, PROP_TYPES } from './props.js';
import { Persoon } from './persoon.js';
import { Bewaking } from './bewaking.js';
import { Dief } from './dief.js';
import { euro, tekenKop } from './hud.js';
import { Navigatie } from './navigatie.js';
import { geluid } from './audio.js';

// ---------- waar het verhaal zich afspeelt ----------
const HUIS = { straat: 'Molenkrite', nr: '15' };      // het huis van Mark
const OVERKANT = { straat: 'Molenkrite', nr: '20' };  // schuin tegenover: de bierdrinkers
const TERREIN = 'rwzi';                               // het omheinde terrein uit omgeving.json
const BOERDERIJ = '0683100000288962';                 // de grote schuur in de zuidwesthoek

// afstanden vanaf de voorgevel (m)
const MARK_VOOR = 6.1;       // op de stoep voor zijn eigen voortuin
const SPELER_VOOR = 9.3;     // in de berm, met Mark recht vooruit
const TAFEL_VOOR = 2.0;      // het tafeltje met de radio in de voortuin
const STOP_VOOR = 4.6;       // waar Mark blijft staan, naast het gezelschap
const STOEL_RING = 1.15;     // de vier stoelen rond het tafeltje

// het RWZI-terrein, gemeten vanaf het midden van de poort: vooruit = het
// terrein op, rechts = langs het hek
const TRUCK_IN = 15;                 // de vrachtwagen staat zover binnen de poort
const POSTEN = [                     // [vooruit, rechts] van elke bewaker, heen en weer
  [[12, -12], [12, -2]],
  [[22, 6], [30, 6]],
  [[32, -6], [32, 4]],
  [[42, 12], [42, 2]],
  [[48, 0], [56, 0]],
];
const MARK_BIJ_POORT = -9;           // Mark wacht zover buiten de poort
const UITSTAP_AFSTAND = 26;          // op zoveel meter van de poort stap je uit
const AFLEVER_AFSTAND = 20;          // zo dicht bij de schuur is de lading afgeleverd

// missie 5: Johan en de dief
const JOHAN_HUIS = { straat: 'Kruirad', nr: '62' };     // de oprit van Johan
const DIEF_HUIS = { straat: 'de Wieken', nr: '27' };    // waar de dief woont
// Johan ijsbeert op het tegelpad voor zijn deur. Dichter bij de gevel staat hij
// in het gangetje tussen de heg en de berging van de buren en zie je hem vanaf
// de straat niet; op zeven en een halve meter ligt het pad over de volle
// breedte vrij.
const JOHAN_VOOR = 7.5;        // waar Johan staat te ijsberen, vanaf zijn voorgevel
const JOHAN_IJSBEER = 3.2;     // de lengte van zijn rondje op het pad
const DIEF_VOOR = 5.2;         // de dief slentert op de stoep voor zijn huis
const DIEF_STOEP = 9;          // de lengte van zijn stukje trottoir
const MARKER_AFSTAND = 8;      // zo dicht bij de marker begint een gesprek
const BUIT = 1000;             // wat de dief gejat heeft
const BELONING = 500;          // wat Johan je ervoor geeft

const PRAAT_AFSTAND = 5.5;
const ZWAAI_AFSTAND = 26;
const ROEP_AFSTAND = 30;
const LOOPSNELHEID = 1.45;

const NAAM = 'Mark';
const GESPREK1 = ['Erik, kom met mij mee. Ik ben helemaal klaar met de bende die voor hun huis bier zitten te drinken.'];
const BEVEL = ['Schiet ze neer!'];
const BRIEFING = [
  'Super, dat probleem is opgelost. Maar we zijn er nog niet.',
  'Ik heb van De Veteraan vernomen dat er bij de waterzuivering een grote lading coke is afgeleverd. Onze taak is om die te bemachtigen en te verplaatsen.',
  'Er staat een auto in de straat. Jij rijdt. Ga je mee?',
];
const BIJ_HET_TERREIN = ['Shit, bewaking. Schakel ze uit, dan stelen we de vrachtwagen met de coke.'];
const NA_DE_BEWAKING = ['Alle vijf neer. De poort staat open — pak de vrachtwagen, ik zie je bij de boerderij.'];

// Johan, de dief en de speler. Erik zelf zegt ook af en toe iets, dus de
// regels hebben een spreker; een regel mag ook een portretje meebrengen.
const KOPPEN = {
  johan: { huid: '#d3a273', haar: '#3a2a1c', shirt: '#3d6b3a', stoppels: true },
  erik: { huid: '#d9b48f', haar: '#6b5a45', shirt: '#2f4a6e' },
  dief: { huid: '#c99b78', shirt: '#d8232a', pet: '#f4f4f4' },
};
const TELEFOON = [
  'Yo, met Johan! Luister, het is hier compleet mis. Ik heb je nú nodig. Kom direct naar Kruirad 62! Geen gezeik door de lijn, kom als de sodemieter deze kant op voor die graftak ermee wegkomt!',
];
const BRIEFING_JOHAN = [
  { wie: 'Johan', kop: KOPPEN.johan, tekst: 'Godverdomme, eindelijk! Ik ben net gewoon in m\'n eigen huis genaaid. Een of andere teringhond heeft zo duizend piek cash van m\'n keukentafel gegrist!' },
  { wie: 'Erik', kop: KOPPEN.erik, tekst: 'Wie was het?' },
  { wie: 'Johan', kop: KOPPEN.johan, tekst: 'Die kneus van De Wieken 27! Die idioot loopt erbij als een wandelende kermisattractie: felrood shirt, kanariegele broek en zo\'n wit petje. Ga direct naar De Wieken en trek die knaken uit z\'n zakken!' },
  { wie: 'Johan', kop: KOPPEN.johan, tekst: 'En luister godverdomme goed: géén lood in z\'n donder jagen! Als je \'m koud maakt hebben we binnen twee minuten de hele Sneker smeris op onze nek. Trap \'m gewoon tegen het asfalt en pak m\'n poen terug.' },
];
const DIEF_SCHRIKT = [{ wie: 'Dief', kop: KOPPEN.dief, tekst: 'Kut! Een maatje van Johan?! Krijg de tering, bekijk het maar!' }];
const DIEF_OP = [{ wie: 'Dief', kop: KOPPEN.dief, tekst: 'Tering... pfff... hou op met rennen, klootzak... m\'n longen knallen uit elkaar!' }];
const DIEF_GEPAKT = [{ wie: 'Dief', kop: KOPPEN.dief, tekst: 'Aah godverdomme, kappen, kappen! Niet slaan man! Alsjeblieft, hier heb je die grafcenten! Flikker gewoon op!' }];
const AFRONDING = [
  { wie: 'Erik', kop: KOPPEN.erik, tekst: 'Alsjeblieft. Duizend piek, geen cent minder. Die idioot loopt voorlopig even niet meer zo hard.' },
  { wie: 'Johan', kop: KOPPEN.johan, tekst: 'Kijk eens aan, godverdomme lekker werk! Ik wist wel dat jij die rat te grazen zou nemen.' },
  { wie: 'Johan', kop: KOPPEN.johan, tekst: 'Afspraak is afspraak: hier, vijfhonderd voor jou. Steek die flappen in je zak, die gaan we later nog hard nodig hebben.' },
];
const MISLUKT_SCHOT = 'Johan zei nog zo: geen wouten op ons dak!';

const ZITTERS = ['zit_rood', 'zit_blauw', 'zit_groen', 'zit_geel'];

// ---------- hulpjes op de kaartdata ----------
function pandVan({ straat, nr }) {
  if (!KAART || !KAART.panden) return null;
  return KAART.panden.find(p => p.straat === straat && (p.nr || []).includes(nr)) || null;
}
/*
 Het midden van de voorgevel, met de richting naar de straat erbij.

 `front` van een pand loopt langs één as van de omsluitende rechthoek (zie
 tools/geo/genereer.mjs), en dat is net zo goed de hx- als de hz-as: bij een
 rijtjeswoning wijst de voorkant over de lange as naar de straat. De halve maat
 langs `front` is dus hx of hz — welke van de twee volgt uit de hoek van de
 rechthoek. `front` is op twee cijfers afgerond en daardoor niet precies een
 meter lang, dus hij gaat er genormaliseerd in.
*/
function voorgevel(p) {
  const L = Math.hypot(p.front[0], p.front[1]) || 1;
  const fx = p.front[0] / L, fz = p.front[1] / L;
  const u = [Math.cos(p.rect.hoek), Math.sin(p.rect.hoek)];
  const diep = Math.abs(fx * u[0] + fz * u[1]) > 0.7 ? p.rect.hx : p.rect.hz;
  return { x: p.rect.cx + fx * diep, z: p.rect.cz + fz * diep, fx, fz };
}
function voorPunt(p, meter) {
  const v = voorgevel(p);
  return { x: v.x + v.fx * meter, z: v.z + v.fz * meter };
}
// kijkrichting van a naar b in de conventie van de speler (yaw 0 = naar -Z)
function kijkHoek(a, b) { return Math.atan2(-(b.x - a.x), -(b.z - a.z)); }
function afst(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

// Het poortstelsel van een omheind terrein: middelpunt, richting naar binnen en
// een assenstelsel om plekken op het terrein in te kunnen geven.
function poortStelsel(terrein) {
  const p = (KAART.poorten || []).find(q => q.terrein === terrein);
  const hek = (KAART.hekwerken || []).find(q => q.terrein === terrein);
  if (!p || !hek) return null;
  const mid = { x: (p.a[0] + p.b[0]) / 2, z: (p.a[1] + p.b[1]) / 2 };
  const L = Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]);
  const d = [(p.b[0] - p.a[0]) / L, (p.b[1] - p.a[1]) / L];
  let vooruit = [-d[1], d[0]];
  // naar binnen is de kant waar het zwaartepunt van het hek ligt
  let cx = 0, cz = 0;
  for (const q of hek.pts) { cx += q[0]; cz += q[1]; }
  cx /= hek.pts.length; cz /= hek.pts.length;
  if ((cx - mid.x) * vooruit[0] + (cz - mid.z) * vooruit[1] < 0) vooruit = [d[1], -d[0]];
  const rechts = [vooruit[1], -vooruit[0]];
  return {
    mid, vooruit, rechts, hek: hek.pts,
    punt: (f, r) => ({ x: mid.x + vooruit[0] * f + rechts[0] * r, z: mid.z + vooruit[1] * f + rechts[1] * r }),
  };
}

function inPolygoon(x, z, poly) {
  let raak = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) raak = !raak;
  }
  return raak;
}

// Startpunt van de speler: op de berm voor Molenkrite 15, kijkend naar Mark.
export function verhaalStart() {
  const p = pandVan(HUIS);
  if (!p) return null;
  const s = voorPunt(p, SPELER_VOOR);
  return { x: s.x, z: s.z, yaw: kijkHoek(s, voorPunt(p, MARK_VOOR)) };
}

/*
 ctx = { scene, player, hud, vehicles, opnieuw }
 `opnieuw` wordt aangeroepen als je neergaat: main.js laadt dan het laatst
 opgeslagen spel. Geeft die functie false terug (er is geen opslag), dan begint
 de missie zelf opnieuw.
*/
export function initVerhaal(ctx) {
  const { scene, player, hud, vehicles } = ctx;
  const balk = document.getElementById('dialoog');
  const naamEl = document.getElementById('dialoogNaam');
  const tekstEl = document.getElementById('dialoogTekst');
  const verderEl = document.getElementById('dialoogVerder');
  const kopEl = document.getElementById('dialoogKop');
  const praatEl = document.getElementById('praat');
  const opdrachtEl = document.getElementById('opdracht');

  const huis = pandVan(HUIS);
  const overkant = pandVan(OVERKANT);
  const poort = KAART ? poortStelsel(TERREIN) : null;
  const schuur = KAART ? (KAART.panden || []).find(p => p.id === BOERDERIJ) : null;
  if (!huis || !overkant) {
    console.warn(`verhaal: ${HUIS.straat} ${HUIS.nr} of ${OVERKANT.straat} ${OVERKANT.nr} niet in de kaartdata`);
    return null;
  }

  const thuis = voorPunt(huis, MARK_VOOR);
  const tafel = voorPunt(overkant, TAFEL_VOOR);
  const stopBijBende = voorPunt(overkant, STOP_VOOR);
  const straatkant = kijkHoek(thuis, voorPunt(huis, SPELER_VOOR + 6));

  /*
   Missie 5. Johan ijsbeert over zijn oprit voor Kruirad 62, de dief slentert
   over het trottoir voor De Wieken 27. Beide plekken volgen uit het pand: een
   paar meter voor de voorgevel, en dan een stukje langs de straat.
  */
  const johanPand = pandVan(JOHAN_HUIS);
  const diefPand = pandVan(DIEF_HUIS);
  const langsHuis = (p, voor, lengte) => {
    const v = voorgevel(p);
    const mid = { x: v.x + v.fx * voor, z: v.z + v.fz * voor };
    const zij = { x: -v.fz, z: v.fx };          // langs de voorgevel
    return {
      mid,
      a: { x: mid.x - zij.x * lengte / 2, z: mid.z - zij.z * lengte / 2 },
      b: { x: mid.x + zij.x * lengte / 2, z: mid.z + zij.z * lengte / 2 },
    };
  };
  const johanPlek = johanPand ? langsHuis(johanPand, JOHAN_VOOR, JOHAN_IJSBEER) : null;
  const diefPlek = diefPand ? langsHuis(diefPand, DIEF_VOOR, DIEF_STOEP) : null;

  // ---------- Mark ----------
  const mark = new Persoon({ shirt: 0x2f5d8a, broek: 0x39312a, huid: 0xd9b48f, haar: 0x6b5a45, hoogte: 1.03 });
  scene.add(mark.groep);
  mark.zetNeer(thuis.x, thuis.z, straatkant);
  let markDoel = null;        // waar hij naartoe loopt
  let markNa = null;          // wat er gebeurt als hij er is

  function markNaar(punt, na = null) { markDoel = punt; markNa = na; }
  function markZichtbaar(v) { mark.groep.visible = v; }

  // ---------- het gezelschap in de voortuin van de overkant ----------
  const bende = [];
  {
    const grond = Math.atan2(-overkant.front[0], -overkant.front[1]);
    const tafelObj = maakProp('radiotafel');
    tafelObj.position.set(tafel.x, 0, tafel.z);
    tafelObj.rotation.y = grond + 0.7;
    scene.add(tafelObj);
    bende.push({ i: -1, soort: 'radiotafel', obj: tafelObj });
    ZITTERS.forEach((soort, i) => {
      const hoek = grond + Math.PI / 4 + i * Math.PI / 2;
      const obj = maakProp(soort);
      obj.position.set(tafel.x - Math.sin(hoek) * STOEL_RING, 0, tafel.z - Math.cos(hoek) * STOEL_RING);
      obj.rotation.y = hoek + Math.PI;
      scene.add(obj);
      bende.push({ i, soort, obj });
    });
    for (const b of bende) b.obj.traverse(o => { o.castShadow = true; o.receiveShadow = true; });
  }
  const drinkers = bende.filter(b => b.i >= 0);
  const omgevallen = new Set();
  const vallen = [];

  function meldAan() {
    for (const b of bende) {
      const def = PROP_TYPES[b.soort];
      if (def) addCollider(b.obj.position.x, b.obj.position.z, def.maat[0] / 2, def.maat[1] / 2, -b.obj.rotation.y, def.h);
      const arm = b.obj.getObjectByName('drinkarm');
      if (arm && !omgevallen.has(b.i) && !drinkArmen.some(a => a.obj === arm)) {
        drinkArmen.push({ obj: arm, fase: arm.userData.drinkfase || 0, duur: 7 + (b.i % 5) * 1.7 });
      }
    }
    if (!radioPlekken.some(r => Math.hypot(r.x - tafel.x, r.z - tafel.z) < 0.1)) radioPlekken.push({ x: tafel.x, z: tafel.z });
  }
  meldAan();

  function legNeer(obj, t) {
    obj.rotation.x = -t * 1.4;
    obj.position.y = -t * 0.18;
    if (t >= 1) stopDrinkarm(obj);
  }
  function stopDrinkarm(obj) {
    for (let i = drinkArmen.length - 1; i >= 0; i--) {
      let p = drinkArmen[i].obj;
      while (p) { if (p === obj) { drinkArmen.splice(i, 1); break; } p = p.parent; }
    }
  }

  // ---------- toestand ----------
  let missie = 'molenkrite';     // molenkrite | rijden | bewaking | afleveren | klaar
  let fase = 'wacht';
  let gesprek = null;            // {regels, i, na}
  let wachtNaAankomst = 0;
  let bewaking = null;           // js/bewaking.js, pas op het terrein
  let truck = null;              // de vrachtwagen
  let vluchtauto = null;         // de auto in de straat
  let navigatie = null;          // js/navigatie.js, wordt bij missie 2 gebouwd
  let navDoel = null;            // {x,z,naam}
  let navVanaf = null;           // waar de route voor het laatst gezocht is
  let navKlok = 0;
  let poortOpen = false;
  let doodT = 0;                 // aftellen na het neergaan
  // missie 5
  let johan = null;              // de Persoon van Johan
  let dief = null;               // js/dief.js
  let telefoonT = 0;             // aftellen tot de telefoon opgenomen is
  let naMissieT = 0;             // pauze tussen twee missies
  let misluktT = 0;              // aftellen na een mislukte missie
  let envelop = null;            // {obj, t} – de envelop die de dief weggooit
  let geld = 0;                  // portemonnee
  let buit = 0;                  // geld dat nog afgeleverd moet worden
  let johanNaarB = true, johanWacht = 0;
  const hinder = { alive: true, opWeg: false, x: thuis.x, z: thuis.z };

  // ---------- tekstbalk ----------
  /*
   Een regel is een tekst met een spreker, en soms met een portretje ernaast en
   een groene rand (een telefoongesprek). Een regel met `auto` klikt zichzelf
   door: dat is voor wat er tijdens het rennen geroepen wordt.
  */
  function toonRegel(regel, verder) {
    naamEl.textContent = regel.wie || NAAM;
    tekstEl.textContent = regel.tekst;
    verderEl.textContent = verder || '';
    balk.classList.toggle('telefoon', !!regel.telefoon);
    if (regel.kop) { kopEl.hidden = false; tekenKop(kopEl, regel.kop); } else { kopEl.hidden = true; }
    balk.hidden = false;
    praatEl.hidden = true;
  }
  function sluitBalk() { balk.hidden = true; balk.classList.remove('telefoon'); }
  function zeg(regels, na = null, opties = {}) {
    const lijst = [].concat(regels).map(r => (typeof r === 'string' ? { tekst: r } : { ...r }));
    for (const r of lijst) {
      if (!r.wie) r.wie = opties.wie || NAAM;
      if (opties.telefoon) r.telefoon = true;
      if (opties.kop && !r.kop) r.kop = opties.kop;
    }
    gesprek = { regels: lijst, i: 0, na, auto: opties.auto || 0, autoT: opties.auto || 0 };
    toonRegel(lijst[0], hintVoor(gesprek));
  }
  function hintVoor(g) {
    if (g.auto) return '';
    return g.i === g.regels.length - 1 ? 'E — sluiten' : 'E — verder';
  }
  function verderInGesprek() {
    if (!gesprek) return false;
    gesprek.i++;
    if (gesprek.i < gesprek.regels.length) {
      gesprek.autoT = gesprek.auto;
      toonRegel(gesprek.regels[gesprek.i], hintVoor(gesprek));
      return true;
    }
    const na = gesprek.na;
    gesprek = null;
    sluitBalk();
    if (na) na();
    return true;
  }

  function zetOpdracht(tekst, rood = false) {
    opdrachtEl.textContent = tekst ? `Opdracht: ${tekst}` : '';
    opdrachtEl.hidden = !tekst;
    opdrachtEl.classList.toggle('rood', !!(tekst && rood));
  }
  function teGaan() { return drinkers.length - omgevallen.size; }
  function spelerPunt() { return player.inCar ? { x: player.inCar.x, z: player.inCar.z } : { x: player.pos.x, z: player.pos.z }; }

  // ---------- navigatie ----------
  function zetNavDoel(x, z, naam, letter = null) {
    navDoel = { x, z, naam, letter };
    navKlok = 0; navVanaf = null;
    werkNavBij(true);
  }
  // Alleen een vlag op de kaart, zonder route: voor een doel dat beweegt.
  function zetMarker(x, z, letter = null) {
    navDoel = null;
    hud.zetNavigatie({ route: null, doel: [x, z], letter });
  }

  function werkNavBij(nu = false) {
    if (!navDoel) { hud.zetNavigatie(null); return; }
    if (!navigatie) navigatie = new Navigatie(KAART.wegassen);
    const p = spelerPunt();
    // De route zoeken kost een paar honderdste seconde; dat hoeft alleen als je
    // een stuk verder bent dan de vorige keer.
    if (!nu && navVanaf && Math.hypot(p.x - navVanaf.x, p.z - navVanaf.z) < 15) return;
    navVanaf = { x: p.x, z: p.z };
    const route = navigatie.route([p.x, p.z], [navDoel.x, navDoel.z]);
    hud.zetNavigatie({ route, doel: [navDoel.x, navDoel.z], naam: navDoel.naam, letter: navDoel.letter });
  }

  // ---------- de poort ----------
  function schuifPoortOpen() {
    if (poortOpen) return;
    poortOpen = true;
    for (const blad of poortBladen) {
      if (blad.terrein !== TERREIN) continue;
      const schuif = blad.lengte - blad.open + 0.2;
      blad.groep.position.set(blad.richting[0] * schuif, 0, blad.richting[1] * schuif);
      if (blad.doos) {
        blad.doos.cx += blad.richting[0] * schuif;
        blad.doos.cz += blad.richting[1] * schuif;
      }
    }
  }

  // ---------- missies ----------
  function startMissie(naam) {
    missie = naam;
    player.health = 100;              // na elke missie is je leven weer vol
    hud.zetLeven(player.health);
    if (naam === 'rijden') beginRijden();
    else if (naam === 'bewaking') beginBewaking();
    else if (naam === 'afleveren') beginAfleveren();
    else if (naam === 'johan') beginJohan();
  }

  // -- missie 2: rijden naar de waterzuivering
  function beginRijden() {
    fase = 'instappen';
    if (!vluchtauto) {
      // de auto staat op de rijbaan naast het gezelschap, met de kop de straat af
      if (!navigatie) navigatie = new Navigatie(KAART.wegassen);
      const k = navigatie.naaste(stopBijBende.x, stopBijBende.z, 400, true);   // op de rijbaan
      const as = k >= 0 ? navigatie.punten[k] : [stopBijBende.x, stopBijBende.z];
      const langs = k >= 0 && navigatie.bogen[k].length
        ? navigatie.punten[navigatie.bogen[k][0].naar] : [as[0] + 1, as[1]];
      const dx = langs[0] - as[0], dz = langs[1] - as[1];
      const L = Math.hypot(dx, dz) || 1;
      const yaw = Math.atan2(-dx / L, -dz / L);
      vluchtauto = vehicles.voegToe({ x: as[0], z: as[1], yaw, soort: 'hatch', kleur: 0x2a3f8f });
    }
    markNaar({ x: vluchtauto.x + 2.2, z: vluchtauto.z + 2.2 });
    zetOpdracht('stap in de auto en rij naar de waterzuivering');
    if (poort) zetNavDoel(poort.mid.x, poort.mid.z, 'waterzuivering');
  }

  // -- missie 3: de bewaking op het terrein
  function beginBewaking() {
    fase = 'vechten';
    if (!poort) { startMissie('afleveren'); return; }
    if (!bewaking) {
      bewaking = new Bewaking(scene, POSTEN.map(([a, b]) => ({
        a: [poort.punt(a[0], a[1]).x, poort.punt(a[0], a[1]).z],
        b: [poort.punt(b[0], b[1]).x, poort.punt(b[0], b[1]).z],
      })));
    }
    if (!truck) {
      const p = poort.punt(TRUCK_IN, 0);
      const yaw = Math.atan2(poort.vooruit[0], poort.vooruit[1]);   // kop naar de poort
      truck = vehicles.voegToe({ x: p.x, z: p.z, yaw, soort: 'truck', kleur: 0xdedede, driveable: false });
    }
    const bij = poort.punt(MARK_BIJ_POORT, 4);
    markZichtbaar(true);
    markNaar(bij);
    zetOpdracht(`schakel de bewaking uit (${bewaking.aantal} te gaan)`);
    zetNavDoel(truck.x, truck.z, 'vrachtwagen');
  }

  // -- missie 4: afleveren bij de boerderij
  function beginAfleveren() {
    fase = 'rijden';
    schuifPoortOpen();
    if (truck) truck.driveable = true;
    zetOpdracht('rij de vrachtwagen naar de boerderij');
    if (schuur) zetNavDoel(schuur.rect.cx, schuur.rect.cz, 'boerderij');
    markZichtbaar(false);
  }

  // Missie 4 klaar: MISSION COMPLETED in beeld, en een paar seconden later gaat
  // de telefoon voor de volgende klus.
  function missieVoltooid() {
    if (fase === 'klaar') return;      // niet elk beeld opnieuw
    fase = 'klaar';
    zetOpdracht('');
    hud.zetNavigatie(null);
    navDoel = null;
    player.health = 100;
    hud.zetLeven(player.health);
    hud.melding('MISSION COMPLETED', 'De lading staat bij de boerderij.', 8);
    naMissieT = 5;                     // daarna belt Johan
  }

  // -- missie 5: Johan van Kruirad 62 en de dief van De Wieken 27
  // Johan en de dief neerzetten (ook nodig na het laden van een opgeslagen spel).
  function zorgVoorJohan() {
    if (!johanPlek || !diefPlek) return false;
    if (!johan) {
      johan = new Persoon({ shirt: 0x3d6b3a, broek: 0x2b3542, huid: 0xd3a273, haar: 0x3a2a1c, hoogte: 1.05 });
      scene.add(johan.groep);
      johan.zetNeer(johanPlek.a.x, johanPlek.a.z, kijkHoek(johanPlek.a, johanPlek.b));
    }
    if (!dief) {
      if (!navigatie) navigatie = new Navigatie(KAART.wegassen);
      dief = new Dief(scene, {
        post: { a: [diefPlek.a.x, diefPlek.a.z], b: [diefPlek.b.x, diefPlek.b.z] },
        navigatie,
      });
    }
    return true;
  }

  function beginJohan() {
    fase = 'telefoon';
    if (!zorgVoorJohan()) { missie = 'klaar'; return; }
    zetOpdracht('neem de telefoon op');
    hud.zetNavigatie(null);
    geluid.telefoon(3);
    telefoonT = 2.0;
  }

  // De envelop met de duizend euro die de dief weggooit.
  function gooiEnvelop(x, z) {
    const groep = new THREE.Group();
    const wit = new THREE.MeshStandardMaterial({ color: 0xf1efe6, roughness: 0.95 });
    const groen = new THREE.MeshStandardMaterial({ color: 0x9fb98a, roughness: 0.95 });
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.16), wit);
    e.rotation.z = 0.12;
    const biljet = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.01, 0.08), groen);
    biljet.position.set(0.1, 0.02, 0.03); biljet.rotation.y = 0.5;
    groep.add(e, biljet);
    groep.position.set(x, 0.9, z);
    groep.traverse(o => { o.castShadow = true; });
    scene.add(groep);
    envelop = { obj: groep, t: 0 };
  }

  function zetGeldInBeeld() { hud.zetGeld(geld, buit); }

  // ---------- missie mislukt ----------
  // Het beeld vaagt naar grijs, de reden komt in beeld en daarna begint het
  // spel bij het laatst opgeslagen spel (of de missie opnieuw).
  function mislukt(reden) {
    if (misluktT > 0) return;
    misluktT = 3.4;
    gesprek = null; sluitBalk();
    zetOpdracht('');
    hud.zetGrijs(true);
    hud.melding('MISSIE MISLUKT', reden, 4);
    player.active = false;
  }
  function naDeMislukking() {
    hud.zetGrijs(false);
    player.active = true;
    const geladen = ctx.opnieuw && ctx.opnieuw();
    if (!geladen) herstartMissie();
  }

  // ---------- neergaan ----------
  function dood() {
    if (doodT > 0) return;
    doodT = 2.6;
    hud.melding('NEERGEGAAN', 'Je begint bij je laatste opgeslagen spel.', 3);
    player.active = false;
  }
  function naDeDood() {
    player.active = true;
    player.health = 100;
    hud.zetLeven(player.health);
    const geladen = ctx.opnieuw && ctx.opnieuw();
    if (!geladen) herstartMissie();
  }
  // Geen opgeslagen spel: dan begint de missie zelf opnieuw.
  function herstartMissie() {
    if (missie === 'bewaking' && poort) {
      if (bewaking) bewaking.reset();
      const buiten = poort.punt(-14, 3);
      player.pos.set(buiten.x, 0, buiten.z);
      player.inCar = null;
      player.yaw = Math.atan2(-poort.vooruit[0], -poort.vooruit[1]);
      player.applyCamera();
      beginBewaking();
    } else if (missie === 'afleveren' && truck) {
      player.inCar = null;
      const p = poort.punt(TRUCK_IN, 0);
      truck.x = p.x; truck.z = p.z; truck.speed = 0;
      truck.mesh.position.set(p.x, 0, p.z);
      player.pos.set(p.x + 3, 0, p.z + 3);
      player.applyCamera();
      beginAfleveren();
    } else if (missie === 'johan' && johanPlek) {
      // terug naar de oprit van Johan, de dief weer op zijn stoep
      if (dief) dief.reset();
      buit = 0; zetGeldInBeeld();
      if (envelop) { scene.remove(envelop.obj); envelop = null; }
      player.inCar = null;
      const voor = { x: johanPlek.mid.x - 4, z: johanPlek.mid.z - 4 };
      player.pos.set(voor.x, 0, voor.z);
      player.yaw = kijkHoek(voor, johanPlek.mid);
      player.applyCamera();
      fase = 'naar_kruirad';
      zetOpdracht('ga naar Kruirad 62');
      zetNavDoel(johanPlek.mid.x, johanPlek.mid.z, 'Kruirad 62', 'J');
    } else {
      const s = verhaalStart();
      player.inCar = null;
      player.pos.set(s.x, 0, s.z); player.yaw = s.yaw; player.applyCamera();
    }
  }

  // ---------- E ----------
  function toets() {
    if (!balk.hidden) return verderInGesprek();
    if (missie === 'molenkrite' && fase === 'wacht' && afst(spelerPunt(), mark.groep.position) < PRAAT_AFSTAND) {
      fase = 'gesprek';
      zeg(GESPREK1, () => { fase = 'loopt'; zetOpdracht('ga met Mark mee'); });
      return true;
    }
    return false;
  }

  // ---------- schieten ----------
  function doelen() {
    const uit = [];
    if (missie === 'molenkrite' && (fase === 'opdracht' || fase === 'briefing')) {
      for (const b of drinkers) if (!omgevallen.has(b.i)) uit.push(b.obj);
    }
    if (bewaking && (missie === 'bewaking' || missie === 'afleveren' || missie === 'klaar')) uit.push(...bewaking.doelen());
    // De dief is ook een doel — maar raak je hem, dan is de missie mislukt.
    if (dief && missie === 'johan' && (fase === 'naar_dewieken' || fase === 'achtervolging')) uit.push(...dief.doelen);
    return uit;
  }

  function raak(obj) {
    // Op de dief mag je niet schieten: dan hangt de politie aan je broek.
    if (dief && missie === 'johan' && dief.isDief(obj)) {
      mislukt(MISLUKT_SCHOT);
      return true;
    }
    if (missie === 'molenkrite' && fase === 'opdracht') {
      let p = obj;
      while (p) {
        const treffer = drinkers.find(b => b.obj === p);
        if (treffer) {
          if (omgevallen.has(treffer.i)) return false;
          omgevallen.add(treffer.i);
          vallen.push({ obj: treffer.obj, t: 0 });
          if (teGaan() > 0) zetOpdracht(`${BEVEL[0]} (${teGaan()} te gaan)`);
          else {
            zetOpdracht('');
            fase = 'briefing';
            zeg(BRIEFING, () => startMissie('rijden'));
          }
          return true;
        }
        p = p.parent;
      }
      return false;
    }
    if (bewaking && bewaking.raak(obj)) {
      const over = bewaking.aantal - bewaking.neer;
      if (missie === 'bewaking') {
        if (over > 0) zetOpdracht(`schakel de bewaking uit (${over} te gaan)`);
        else {
          zetOpdracht('');
          fase = 'poort';
          zeg(NA_DE_BEWAKING, () => startMissie('afleveren'));
        }
      }
      return true;
    }
    return false;
  }

  // Elk schot van de speler: de bewaking hoort het.
  function schotGehoord(x, z) {
    if (bewaking) bewaking.hoorSchot(x, z);
  }

  // ---------- lopen ----------
  function loopNaar(doel, dt) {
    const pos = mark.groep.position;
    let dx = doel.x - pos.x, dz = doel.z - pos.z;
    const a = Math.hypot(dx, dz);
    if (a < 0.5) return true;
    dx /= a; dz /= a;
    const stap = Math.min(a, LOOPSNELHEID * dt);
    for (const draai of [0, 0.6, -0.6, 1.2, -1.2]) {
      const c = Math.cos(draai), s = Math.sin(draai);
      const rx = dx * c - dz * s, rz = dx * s + dz * c;
      const nx = pos.x + rx * stap, nz = pos.z + rz * stap;
      const [kx, kz] = resolveCollisions(nx, nz, 0.34);
      if (Math.hypot(kx - nx, kz - nz) < 0.02) {
        pos.x = kx; pos.z = kz;
        mark.draaiNaar(Math.atan2(-rx, -rz), dt, 6);
        return false;
      }
    }
    const [kx, kz] = resolveCollisions(pos.x + dx * stap, pos.z + dz * stap, 0.34);
    pos.x = kx; pos.z = kz;
    return false;
  }

  // ---------- missie 5 per beeld ----------
  function werkJohanBij(dt, sp) {
    // de envelop die op de tegels landt en na een seconde in je zak zit
    if (envelop) {
      envelop.t += dt;
      envelop.obj.position.y = Math.max(0.03, 0.9 - envelop.t * envelop.t * 5.5);
      envelop.obj.rotation.y += dt * 2.4;
      if (envelop.t > 1.2) {
        scene.remove(envelop.obj);
        envelop = null;
        buit = BUIT;
        zetGeldInBeeld();
        hud.melding(`Buit gepakt: ${euro(BUIT)}`, 'Breng het geld terug naar Johan bij Kruirad 62.', 5);
      }
    }

    // Johan ijsbeert over zijn oprit en kijkt je aan als je in de buurt komt
    if (johan) {
      const dJohan = afst(sp, johan.groep.position);
      if (dJohan < 9 || fase === 'briefing' || fase === 'afronding') {
        johan.kijkNaar(sp.x, sp.z, dt, 4);
        johan.update(dt, {});
      } else if (johanWacht > 0) {
        johanWacht -= dt;
        johan.update(dt, {});
      } else {
        const doel = johanNaarB ? johanPlek.b : johanPlek.a;
        const dx = doel.x - johan.groep.position.x, dz = doel.z - johan.groep.position.z;
        const a = Math.hypot(dx, dz);
        if (a < 0.4) { johanNaarB = !johanNaarB; johanWacht = 0.6; }
        else {
          const stap = Math.min(a, 1.15 * dt);
          johan.groep.position.x += dx / a * stap;
          johan.groep.position.z += dz / a * stap;
          johan.draaiNaar(Math.atan2(-dx, -dz), dt, 5);
        }
        johan.update(dt, { loopt: true, snelheid: 1.15 });
      }
    }

    // de dief slentert of rent; zijn melding gebruiken we bij de achtervolging
    const diefMelding = (dief && fase !== 'telefoon') ? dief.update(dt, player) : null;

    if (fase === 'telefoon') {
      if (telefoonT > 0) {
        telefoonT -= dt;
        if (telefoonT <= 0) {
          zeg(TELEFOON, () => {
            fase = 'naar_kruirad';
            zetOpdracht('ga naar Kruirad 62');
            zetNavDoel(johanPlek.mid.x, johanPlek.mid.z, 'Kruirad 62', 'J');
            hud.melding('NIEUWE MISSIE', 'Ga naar Kruirad 62 — de gele J op de kaart.', 5);
          }, { wie: 'Johan', telefoon: true, kop: KOPPEN.johan });
        }
      }
      return;
    }

    if (fase === 'naar_kruirad') {
      navKlok += dt;
      if (navKlok > 2) { navKlok = 0; werkNavBij(); }
      if (balk.hidden && afst(sp, johanPlek.mid) < MARKER_AFSTAND) {
        fase = 'briefing';
        hud.zetNavigatie(null); navDoel = null;
        zeg(BRIEFING_JOHAN, () => {
          fase = 'naar_dewieken';
          zetOpdracht('ga naar De Wieken en spoor de dief op');
          zetNavDoel(diefPlek.mid.x, diefPlek.mid.z, 'De Wieken 27', '?');
        });
      }
      return;
    }

    if (fase === 'naar_dewieken') {
      navKlok += dt;
      if (navKlok > 2) { navKlok = 0; werkNavBij(); }
      if (dief) {
        if (balk.hidden && dief.zietSpeler(sp)) {
          dief.schrik();
          navDoel = null;
          zeg(DIEF_SCHRIKT, () => {
            fase = 'achtervolging';
            zetOpdracht('achtervolg hem! Schiet hem NIET neer!', true);
          }, { auto: 3.0 });
        }
      }
      return;
    }

    if (fase === 'achtervolging') {
      if (!dief) return;
      zetMarker(dief.positie.x, dief.positie.z, '!');
      if (diefMelding === 'op' && balk.hidden) zeg(DIEF_OP, null, { auto: 3.4 });
      if (dief.binnenBereik(player)) {
        dief.pak();
        geluid.klap();
        gooiEnvelop(dief.positie.x, dief.positie.z);
        fase = 'gepakt';
        zetOpdracht('');
        hud.zetNavigatie(null);
        zeg(DIEF_GEPAKT, () => {
          fase = 'terug';
          zetOpdracht(`breng het geld terug naar Johan bij Kruirad 62`);
          zetNavDoel(johanPlek.mid.x, johanPlek.mid.z, 'Kruirad 62', 'J');
        });
      }
      return;
    }

    if (fase === 'gepakt') return;

    if (fase === 'terug') {
      navKlok += dt;
      if (navKlok > 2) { navKlok = 0; werkNavBij(); }
      if (balk.hidden && afst(sp, johanPlek.mid) < MARKER_AFSTAND) {
        fase = 'afronding';
        hud.zetNavigatie(null); navDoel = null;
        zeg(AFRONDING, () => {
          buit = 0;
          geld += BELONING;
          zetGeldInBeeld();
          missie = 'klaar'; fase = 'klaar';
          zetOpdracht('');
          hud.melding('MISSIE VOLTOOID', `Beloning: + ${euro(BELONING)} toegevoegd aan wallet`, 8);
        });
      }
    }
  }

  // ---------- per beeld ----------
  function update(dt) {
    // Het spannende deuntje loopt precies zolang de achtervolging duurt: het
    // stopt als je hem pakt, als je hem neerschiet en als je neergaat.
    geluid.jacht(missie === 'johan' && fase === 'achtervolging' && doodT <= 0 && misluktT <= 0);
    if (doodT > 0) {
      doodT -= dt;
      if (doodT <= 0) naDeDood();
      return;
    }
    if (misluktT > 0) {
      misluktT -= dt;
      if (misluktT <= 0) naDeMislukking();
      return;
    }
    // pauze tussen twee missies: na de boerderij belt Johan
    if (naMissieT > 0) {
      naMissieT -= dt;
      if (naMissieT <= 0) startMissie('johan');
    }
    // een regel die zichzelf wegklikt (wat er tijdens het rennen geroepen wordt)
    if (gesprek && gesprek.auto) {
      gesprek.autoT -= dt;
      if (gesprek.autoT <= 0) verderInGesprek();
    }
    const sp = spelerPunt();
    const dMark = afst(sp, mark.groep.position);
    const opTerrein = poort ? inPolygoon(sp.x, sp.z, poort.hek) : false;

    // ---- Mark ----
    if (markDoel) {
      const erIs = loopNaar(markDoel, dt);
      mark.update(dt, { loopt: !erIs, snelheid: LOOPSNELHEID });
      if (erIs) { markDoel = null; const na = markNa; markNa = null; if (na) na(); }
      hinder.opWeg = !erIs;
    } else if (missie === 'molenkrite') {
      if (fase === 'wacht' || fase === 'gesprek') {
        if (dMark < ZWAAI_AFSTAND) mark.kijkNaar(sp.x, sp.z, dt);
        mark.update(dt, { zwaait: fase === 'wacht' && dMark < ZWAAI_AFSTAND });
        const bezig = player.active || window.__autoplay;
        // de hint is ook van de voordeur van Molenkrite 15 (js/interieur.js),
        // dus de tekst gaat er elke keer opnieuw in
        praatEl.textContent = 'E — praten';
        praatEl.hidden = !(bezig && fase === 'wacht' && dMark < PRAAT_AFSTAND && balk.hidden);
      } else if (fase === 'loopt') {
        const erIs = loopNaar(stopBijBende, dt);
        mark.update(dt, { loopt: !erIs, snelheid: LOOPSNELHEID });
        hinder.opWeg = !erIs;
        if (erIs) { fase = 'bevel'; wachtNaAankomst = 0.8; }
      } else if (fase === 'bevel') {
        hinder.opWeg = false;
        if (wachtNaAankomst > 0) {
          wachtNaAankomst -= dt;
          mark.kijkNaar(tafel.x, tafel.z, dt, 3);
          mark.update(dt, {});
        } else {
          mark.kijkNaar(sp.x, sp.z, dt, 3);
          mark.update(dt, {});
          if (balk.hidden && dMark < ROEP_AFSTAND) {
            zeg(BEVEL, () => { fase = 'opdracht'; zetOpdracht(`${BEVEL[0]} (${teGaan()} te gaan)`); });
          } else if (balk.hidden) zetOpdracht('ga met Mark mee');
        }
      } else {
        mark.kijkNaar(sp.x, sp.z, dt, 2);
        mark.update(dt, {});
      }
    } else {
      // in de latere missies staat hij te wachten en kijkt hij naar je
      if (mark.groep.visible) { mark.kijkNaar(sp.x, sp.z, dt, 2); mark.update(dt, {}); }
      hinder.opWeg = false;
    }
    hinder.x = mark.groep.position.x;
    hinder.z = mark.groep.position.z;

    // ---- de omvallende drinkers ----
    for (let i = vallen.length - 1; i >= 0; i--) {
      const v = vallen[i];
      v.t = Math.min(1, v.t + dt * 1.8);
      legNeer(v.obj, v.t);
      if (v.t >= 1) vallen.splice(i, 1);
    }

    // ---- missie 2: rijden naar de waterzuivering ----
    if (missie === 'rijden') {
      if (player.inCar) {
        markZichtbaar(false);              // hij zit naast je in de auto
        if (fase === 'instappen') fase = 'onderweg';
      } else {
        // stap je onderweg uit, dan stapt hij ook uit en wacht hij bij de auto
        markZichtbaar(true);
        if (vluchtauto && afst(mark.groep.position, vluchtauto) > 8) {
          mark.zetNeer(vluchtauto.x + 2.2, vluchtauto.z + 2.2, mark.yaw);
        }
      }
      navKlok += dt;
      if (navKlok > 2) { navKlok = 0; werkNavBij(); }
      if (poort && fase !== 'aangekomen' && afst(sp, poort.mid) < UITSTAP_AFSTAND) {
        // Bij het terrein stap je automatisch uit; kom je te voet, dan staat
        // Mark daar gewoon naast je.
        let naast = { x: sp.x, z: sp.z };
        if (player.inCar) {
          const auto = player.inCar;
          auto.speed = 0;
          player.inCar = null;
          const rauw = { x: auto.x - Math.cos(auto.yaw) * 2.2, z: auto.z + Math.sin(auto.yaw) * 2.2 };
          const [ux, uz] = resolveCollisions(rauw.x, rauw.z, 0.4);
          player.pos.set(ux, 0, uz);
          player.yaw = kijkHoek({ x: ux, z: uz }, poort.mid);
          player.applyCamera();
          geluid.portier(); geluid.motorUit();
          naast = { x: auto.x - Math.cos(auto.yaw) * 3.6, z: auto.z + Math.sin(auto.yaw) * 3.6 };
        } else {
          naast = { x: sp.x + 1.8, z: sp.z + 1.8 };
        }
        const [mx, mz] = resolveCollisions(naast.x, naast.z, 0.4);
        mark.zetNeer(mx, mz, kijkHoek({ x: mx, z: mz }, poort.mid));
        markZichtbaar(true);
        markDoel = null;
        fase = 'aangekomen';
        zeg(BIJ_HET_TERREIN, () => startMissie('bewaking'));
      }
    }

    // ---- missie 3: de bewaking ----
    if (bewaking && (missie === 'bewaking' || missie === 'afleveren')) {
      const schade = bewaking.update(dt, player, opTerrein);
      if (schade > 0 && player.active) {
        player.health = Math.max(0, player.health - schade);
        hud.zetLeven(player.health);
        hud.flits();
        if (player.health <= 0) dood();
      }
      if (missie === 'bewaking' && fase === 'vechten' && bewaking.alleNeer && balk.hidden) {
        zetOpdracht('');
        fase = 'poort';
        zeg(NA_DE_BEWAKING, () => startMissie('afleveren'));
      }
    }

    // ---- missie 5: Johan en de dief ----
    if (missie === 'johan') werkJohanBij(dt, sp);

    // ---- missie 4: afleveren ----
    if (missie === 'afleveren' && fase !== 'klaar') {
      navKlok += dt;
      if (navKlok > 2) { navKlok = 0; werkNavBij(); }
      if (truck && schuur) {
        const d = Math.hypot(truck.x - schuur.rect.cx, truck.z - schuur.rect.cz);
        const erbij = player.inCar === truck || Math.hypot(sp.x - truck.x, sp.z - truck.z) < 25;
        if (d < AFLEVER_AFSTAND && erbij) missieVoltooid();
      }
    }
  }

  // ---------- opslaan en laden ----------
  function bewaar() {
    return {
      missie, fase,
      mark: { x: mark.groep.position.x, z: mark.groep.position.z, yaw: mark.yaw, zichtbaar: mark.groep.visible },
      om: [...omgevallen],
      poortOpen,
      bewaking: bewaking ? bewaking.bewaar() : null,
      truck: truck ? { x: truck.x, z: truck.z, yaw: truck.yaw, driveable: truck.driveable } : null,
      auto: vluchtauto ? { x: vluchtauto.x, z: vluchtauto.z, yaw: vluchtauto.yaw } : null,
      navDoel,
      geld, buit,
      johan: johan ? { x: johan.groep.position.x, z: johan.groep.position.z, yaw: johan.yaw } : null,
      dief: dief ? dief.bewaar() : null,
    };
  }

  function herstel(s) {
    if (!s) return;
    gesprek = null; sluitBalk(); praatEl.hidden = true;
    doodT = 0;
    missie = s.missie || 'molenkrite';
    fase = s.fase || 'wacht';
    if (fase === 'gesprek' || fase === 'briefing') { fase = 'wacht'; missie = 'molenkrite'; }
    markDoel = null; markNa = null;
    if (s.mark) { mark.zetNeer(s.mark.x, s.mark.z, s.mark.yaw || 0); markZichtbaar(s.mark.zichtbaar !== false); }
    omgevallen.clear();
    for (const i of s.om || []) omgevallen.add(i);
    vallen.length = 0;
    for (const b of drinkers) {
      if (omgevallen.has(b.i)) legNeer(b.obj, 1);
      else { b.obj.rotation.x = 0; b.obj.position.y = 0; }
    }
    meldAan();

    // de auto en de vrachtwagen
    if (s.auto && !vluchtauto) vluchtauto = vehicles.voegToe({ x: s.auto.x, z: s.auto.z, yaw: s.auto.yaw, soort: 'hatch', kleur: 0x2a3f8f });
    else if (s.auto && vluchtauto) {
      vluchtauto.x = s.auto.x; vluchtauto.z = s.auto.z; vluchtauto.yaw = s.auto.yaw; vluchtauto.speed = 0;
      vluchtauto.mesh.position.set(s.auto.x, 0, s.auto.z); vluchtauto.mesh.rotation.y = s.auto.yaw;
    }
    if (s.truck) {
      if (!truck) truck = vehicles.voegToe({ x: s.truck.x, z: s.truck.z, yaw: s.truck.yaw, soort: 'truck', kleur: 0xdedede, driveable: !!s.truck.driveable });
      else {
        truck.x = s.truck.x; truck.z = s.truck.z; truck.yaw = s.truck.yaw; truck.speed = 0;
        truck.driveable = !!s.truck.driveable;
        truck.mesh.position.set(s.truck.x, 0, s.truck.z); truck.mesh.rotation.y = s.truck.yaw;
      }
    }
    // de bewaking
    if (s.bewaking) {
      if (!bewaking && poort) {
        bewaking = new Bewaking(scene, POSTEN.map(([a, b]) => ({
          a: [poort.punt(a[0], a[1]).x, poort.punt(a[0], a[1]).z],
          b: [poort.punt(b[0], b[1]).x, poort.punt(b[0], b[1]).z],
        })));
      }
      if (bewaking) bewaking.herstel(s.bewaking);
    }
    if (s.poortOpen) schuifPoortOpen();

    // missie 5: Johan, de dief en het geld
    geld = s.geld || 0;
    buit = s.buit || 0;
    zetGeldInBeeld();
    if (envelop) { scene.remove(envelop.obj); envelop = null; }
    misluktT = 0; naMissieT = 0; telefoonT = 0;
    hud.zetGrijs(false);
    if (s.johan || s.dief || missie === 'johan') {
      zorgVoorJohan();
      if (johan && s.johan) johan.zetNeer(s.johan.x, s.johan.z, s.johan.yaw || 0);
      if (dief) dief.herstel(s.dief);
    }

    // opdracht en navigatie terugzetten
    if (missie === 'molenkrite') {
      if (fase === 'opdracht') zetOpdracht(teGaan() > 0 ? `${BEVEL[0]} (${teGaan()} te gaan)` : '');
      else if (fase === 'loopt' || fase === 'bevel') zetOpdracht('ga met Mark mee');
      else zetOpdracht('');
      hud.zetNavigatie(null); navDoel = null;
    } else if (missie === 'rijden') {
      zetOpdracht('stap in de auto en rij naar de waterzuivering');
      if (poort) zetNavDoel(poort.mid.x, poort.mid.z, 'waterzuivering');
    } else if (missie === 'bewaking') {
      const over = bewaking ? bewaking.aantal - bewaking.neer : 5;
      zetOpdracht(over > 0 ? `schakel de bewaking uit (${over} te gaan)` : '');
      if (truck) zetNavDoel(truck.x, truck.z, 'vrachtwagen');
    } else if (missie === 'afleveren') {
      zetOpdracht('rij de vrachtwagen naar de boerderij');
      if (schuur) zetNavDoel(schuur.rect.cx, schuur.rect.cz, 'boerderij');
    } else if (missie === 'johan') {
      if (fase === 'telefoon' || fase === 'briefing' || fase === 'afronding') {
        // midden in een gesprek slaan we niet op: terug naar het vorige doel
        fase = fase === 'afronding' ? 'terug' : 'naar_kruirad';
      }
      if (fase === 'naar_kruirad') {
        zetOpdracht('ga naar Kruirad 62');
        zetNavDoel(johanPlek.mid.x, johanPlek.mid.z, 'Kruirad 62', 'J');
      } else if (fase === 'naar_dewieken') {
        zetOpdracht('ga naar De Wieken en spoor de dief op');
        zetNavDoel(diefPlek.mid.x, diefPlek.mid.z, 'De Wieken 27', '?');
      } else if (fase === 'achtervolging') {
        zetOpdracht('achtervolg hem! Schiet hem NIET neer!', true);
      } else if (fase === 'terug' || fase === 'gepakt') {
        fase = 'terug';
        zetOpdracht('breng het geld terug naar Johan bij Kruirad 62');
        zetNavDoel(johanPlek.mid.x, johanPlek.mid.z, 'Kruirad 62', 'J');
      } else {
        zetOpdracht(''); hud.zetNavigatie(null); navDoel = null;
      }
    } else {
      zetOpdracht(''); hud.zetNavigatie(null); navDoel = null;
    }
    hud.zetLeven(player.health);
  }

  // Op een aanraakscherm klik je het gesprek door met een tik op de balk. Met de
  // muis niet: een klik is in dit spel een schot.
  balk.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    e.preventDefault();
    toets();
  });

  zetOpdracht('');
  sluitBalk();
  praatEl.hidden = true;
  hud.zetLeven(player.health);
  zetGeldInBeeld();

  return {
    update, toets, doelen, raak, hinder, bewaar, herstel, meldAan, schotGehoord, dood, mislukt,
    get missie() { return missie; },
    get fase() { return fase; },
    get buurman() { return mark; },      // oude naam, gebruikt door de testtools
    get mark() { return mark; },
    get bewaking() { return bewaking; },
    get dief() { return dief; },
    get johan() { return johan; },
    get geld() { return geld; },
    get buit() { return buit; },
    get truck() { return truck; },
    get auto() { return vluchtauto; },
    get poortOpen() { return poortOpen; },
    get plekken() {
      return {
        thuis, tafel, stop: stopBijBende, huis: voorgevel(huis), overkant: voorgevel(overkant),
        poort: poort ? poort.mid : null, poortVooruit: poort ? poort.vooruit : null,
        schuur: schuur ? { x: schuur.rect.cx, z: schuur.rect.cz } : null,
        johan: johanPlek ? johanPlek.mid : null, diefstoep: diefPlek ? diefPlek.mid : null,
        johanFront: johanPand ? johanPand.front : null,
      };
    },
    get aanspreekbaar() {
      return !balk.hidden || (missie === 'molenkrite' && fase === 'wacht' && afst(spelerPunt(), mark.groep.position) < PRAAT_AFSTAND);
    },
  };
}
