/*
 Het verhaal van Erik en zijn broer Mark.

 Zes missies. De eerste vijf rijgen zichzelf aan elkaar; de zesde begint pas als
 je er zelf heen gaat — hij staat als M op de kaart.

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
 6. bx          – daarna verschijnt er een M op de kaart bij Tinga State: daar
    staat Mark met een klus van De Veteraan. Een groene Citroën BX ophalen van
    het parkeerterrein van VV Sneek (dat kost je een politiester), hem bij de
    wasbox achter de BP laten overspuiten voor de vijfhonderd euro die Mark
    meegeeft, en hem afleveren op het parkeerterrein van de Poiesz in IJlst.

 Alle plekken komen uit js/kaart.js (BGT en 3D BAG): het pand met huisnummer 15
 aan de Molenkrite, het pand ertegenover, het hek en de schuifpoort van het
 RWZI-terrein, de schuur van de boerderij en het wegennet voor de route. In dit
 bestand staat dus geen enkele coördinaat, alleen adressen, namen en afstanden.
*/
import * as THREE from 'three';
import { KAART, poortBladen } from './kaartwereld.js';
import { drinkArmen, radioPlekken, resolveCollisions, addCollider, vaarbaar, zichtVrij } from './world.js';
import { maakProp, PROP_TYPES } from './props.js';
import { Persoon } from './persoon.js';
import { Bewaking } from './bewaking.js';
import { maakMarkering, maakBompakket, ontplofBij } from './bom.js';
import { maakWaterRing, maakDeal } from './deal.js';
import { LIGPLAATSEN } from './boot.js';
import { initPolitieboot } from './politieboot.js';
import { Dief } from './dief.js';
import { euro, tekenKop } from './hud.js';
import { Navigatie } from './navigatie.js';
import { geluid } from './audio.js';
import * as uitleg from './uitleg.js';

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
const START_GELD = 1000;       // waar je het spel mee begint — ruim, zodat de testfase het schap kan proberen

/*
 Missie 6: de groene BX (verzoek 20 sep 2026). Alle plekken komen weer uit de
 kaart: Tinga State is het pand met huisnummer 115 aan de Molenkrite, de auto
 staat op de dichtstbijzijnde parkeerplek bij het hoofdveld van VV Sneek, de
 wasbox zit achter BP Slump Oil uit `KAART.tankstations`, en afleveren gebeurt
 op de parkeerplek naast de Poiesz in IJlst.
*/
const BX_HUIS = { straat: 'Molenkrite', nr: '115' };   // Tinga State: daar wacht Mark
const BX_VELD = /vv sneek/i;                           // het voetbalveld waar de BX staat
const BX_GROEN = 0x2f6b3a;                             // "Ja. Groen ook."
const BX_SPUIT = 500;                                  // wat het overspuiten kost
const BX_BELONING = 250;                               // wat je eraan overhoudt
const BX_PARKEER = 8;                                  // zo dicht bij de plek staat hij goed
const BX_MARK_NAAST = 4.2;                             // zover naast de plek wacht Mark

/*
 Missie 7: de bom bij de Poiesz in Duinterpen (verzoek 21 sep 2026). Hij begint
 binnen, in het huis aan de Wieken waar je zelf ook naar binnen kunt: Mark zit
 daar op de bank. Daarna: rijden naar Duinterpen, de bom bij de schappen
 planten, buiten de knal afwachten, het vuurgevecht met de zes man die komen
 opdagen, de politie afschudden in het Tinga-bos, en Mark thuisbrengen.
*/
const BOM_HUIS = { straat: 'de Wieken', nr: '29' };   // hier woont Erik
const BOM_WINKEL = 'duinterpen_poiesz';               // het pand in Duinterpen
const BOM_BELONING = 300;
const BOM_MANNEN = 6;                                 // zes man in drie auto's
const BOM_AUTOS = 3;
const BOM_KOMEN = 23;                                 // zover van je vandaan stoppen ze (m)
const BOM_AANRIJ = 70;                                // en zover verderop zetten ze in
const BOM_AANRIJ_V = 20;                              // hoe hard ze aan komen rijden (m/s, 72 km/u)
const BOM_REM_A = 7.5;                                // en hoe hard ze remmen (m/s²): 27 m uitloop
const BOM_TUSSEN = 7;                                 // afstand tussen de drie auto's
const BOM_BUIT_KOGELS = [6, 13];                      // wat er nog in hun pistool zit
const BOM_PANIEK = 70;                                // zover schrikt de buurt van de knal (m)
const BOM_STERREN = 2;                                // wat de politie ervan vindt
const BOM_PLANT_BEREIK = 3.0;                         // zo dicht bij de plek plant je hem
const BOM_PARKEER = 26;                               // zo dicht bij de winkel ben je "voor het pand"
const BOM_THUIS_BEREIK = 14;                          // en zo dicht bij Molenkrite 15 ben je er

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
  mark: { huid: '#d9b48f', haar: '#4a3b2c', shirt: '#3c4148', stoppels: true },
};
// twee sprekers die elkaar afwisselen, dus twee hulpjes die een regel opmaken
const zegtMark = (tekst) => ({ wie: 'Mark', kop: KOPPEN.mark, tekst });
const zegtErik = (tekst) => ({ wie: 'Erik', kop: KOPPEN.erik, tekst });
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

/*
 Missie 8: de deal bij de molen (verzoek 21 sep 2026). Johan belt een minuut na
 de bom: hij heeft iemand met vaste handen nodig. Je koopt een sniper bij Tinga
 State, vaart met hem vanaf de Geeuwkade naar IJlst, houdt vanaf het water de
 ontmoeting bij houtzaagmolen De Rat in de gaten, en als die misgaat schiet je
 de maffia neer. Daarna terug, met drie waterpolitieboten achter je aan.
*/
const SNIP_WACHT = 60;                                // zoveel seconden na de bom belt Johan
const SNIP_WINKEL = { straat: 'Molenkrite', nr: '115' };  // Tinga State
const SNIP_RING = 15;                                 // straal van de gele cirkel op het water
const SNIP_VER = [46, 78];                            // zo ver van de molen mag de boot liggen
const SNIP_LIEFST = 60;                               // en zo ver het liefst
const SNIP_KIJK = 15;                                 // seconden meekijken voor het misgaat
const SNIP_BOTEN = 3;                                 // zoveel waterpolitie komt er achter je aan
const SNIP_THUIS = 18;                                // zo dicht bij de kade ben je terug
const SNIP_BELONING = 500;
const MISLUKT_VETERAAN = 'Je hebt De Veteraan neergeschoten.';

// ---------- missie 7: de bom bij de Poiesz in Duinterpen ----------
const BOM_BINNEN = [
  zegtMark('Erik, je moet je katten wel eten geven, ze blijven maar skooien.'),
  zegtMark('Afijn, De Veteraan heeft een oogje op jou. Ik denk dat we grotere spelers in Tinga kunnen worden! Lekker geld verdienen!'),
  zegtMark('De filiaalhouder van de Poiesz in Duinterpen heeft zich tegen De Veteraan gekeerd. Hij wil dat we een bom plaatsen in het pand, en hem eens een lesje leren wie de baas is.'),
  zegtMark('Ga je mee?'),
];
const BOM_INSTAPPEN = [zegtMark('De auto staat voor de deur. Jij rijdt.')];
const BOM_BIJ_WINKEL = [
  zegtMark('Hier heb je de explosieven. Ga naar binnen en plant het bij de schappen.'),
  zegtMark('We detoneren het buiten.'),
];
const BOM_AFGAAN = [zegtMark('Ik laat hem afgaan.')];
const BOM_PERFECT = [zegtMark('Perfect. Dat zal hem leren.')];
const BOM_ALARM = [zegtMark('Shit, wat hebben ze snel gereageerd! We moeten ze afschieten!!!')];
const BOM_POLITIE = [zegtMark('Wegwezen, nu de politie afschudden. We gaan naar het Tinga-bos.')];
const BOM_BOS = [
  zegtMark('Poeh, op het nippertje.'),
  zegtMark('Kun je me terugbrengen naar de Molenkrite 15?'),
];
const BOM_THUIS = [
  zegtMark('Bedankt. Hier heb je trouwens het geld van De Veteraan.'),
  zegtMark('We spreken, broeder!'),
];

// ---------- missie 8: de deal bij de molen ----------
const zegtJohan = (tekst) => ({ wie: 'Johan', kop: KOPPEN.johan, tekst });
const SNIP_TELEFOON = [
  zegtJohan('Erik, Johan hier. Ik had je nog een bericht op Telegram gestuurd, maar je hebt het niet gelezen denk ik. Misschien moet ik eens WhatsApp gaan gebruiken.'),
  zegtJohan('Afijn, ik heb iemand nodig met steady handjes. Die van mij trillen te veel, en ik weet dat jij om kan gaan met snipers.'),
  zegtJohan('Koop er eentje bij de Tinga State en kom naar mij toe, achter de waterzuivering aan de Geeuw. Ik praat je daar bij.'),
  zegtJohan('Zwembroek hoeft niet mee, haha. Grapje.'),
];
const SNIP_BIJ_JOHAN = [
  zegtJohan('Erik, goed dat je er bent.'),
  zegtJohan('De Veteraan gaat bij de molen in IJlst een belangrijke deal sluiten met de IJlster maffia. Die deal moet doorgaan.'),
  zegtJohan('Hij vertrouwt het alleen niet en wil dat wij het met dit bootje op afstand in de gaten houden.'),
  zegtJohan('Oké, jij vaart. Op naar IJlst.'),
];
const SNIP_OP_PLEK = [zegtJohan('Hier is het goed. Motor eruit en blijven liggen.')];
const SNIP_SCOPE = [
  zegtJohan('Oké, de meeting gaat plaatsvinden.'),
  zegtJohan('Bekijk het door je scope: rechtermuisknop, en met het scrollwiel zoom je in.'),
];
const SNIP_MIS = [
  zegtJohan('Shit, dit gaat fout.'),
  zegtJohan('Erik, schiet ze neer!'),
];
const SNIP_WEG = [zegtJohan('Oké, wegwezen. Terug naar de kade bij de Geeuw waar we vandaan kwamen.')];
const SNIP_POLITIE = [zegtJohan('Waterpolitie! Drie stuks. Schakel ze uit, anders varen we ze zo de haven in.')];
const SNIP_KLAAR = [
  zegtJohan('Bedankt Erik. Hier heb je een beloning.'),
  zegtJohan('De Veteraan weet wie hem heeft gered. Dat komt goed van pas.'),
];

// ---------- missie 6: de groene BX ----------
const BX_AANKONDIGING = ['Nieuwe missies kunnen worden gestart door naar het '
  + '<b>M-symbool</b> op de minimap te gaan.'];
const BX_BRIEFING_A = [
  zegtMark('Daar ben je eindelijk.'),
  zegtErik('Wat is er?'),
  zegtMark('De Veteraan heeft een auto nodig.'),
  zegtErik('En daarvoor stuurt hij mij?'),
  zegtMark('Blijkbaar. Hij schijnt nogal specifiek te zijn.'),
  zegtErik('Wat voor auto?'),
  zegtMark('Een Citroën BX.'),
  zegtMark('Prachtige auto al zeg ik het zelf.'),
  zegtErik('Een BX?'),
  zegtMark('Ja. Groen ook.'),
  zegtErik('Waar staat-ie?'),
  zegtMark('Op het parkeerterrein van de voetbalvereniging Sneek.'),
  zegtErik('En wat moet ik ermee?'),
  zegtMark('Ophalen en daarna een andere kleur laten spuiten.'),
  zegtErik('Waar?'),
  zegtMark('Bij de BP. Achter het tankstation zit een wasbox. Daar kunnen ze hem voor je overspuiten.'),
  zegtErik('Een wasbox?'),
  zegtMark('Ja. Vraag niet hoe het werkt. Het werkt.'),
  zegtErik('En daarna?'),
  zegtMark('Breng hem naar het parkeerterrein van de Poiesz in IJlst.'),
  zegtErik('Wie wacht daar?'),
  zegtMark('Ik.'),
  zegtErik('Natuurlijk.'),
];
// hier telt hij het geld voor het overspuiten uit
const BX_BRIEFING_B = [
  zegtMark('Vijfhonderd euro. Dat zijn de kosten voor het overspuiten.'),
  zegtErik('En welke kleur moet-ie worden?'),
  zegtMark('Maakt niet uit. Als-ie maar niet meer groen is.'),
  zegtErik('Dat is nogal een belangrijke toevoeging.'),
  zegtMark('Succes.'),
];
const BX_EINDE = [
  zegtMark('Kijk nou.'),
  zegtMark('Je zou bijna zeggen dat-ie nieuw is.'),
  zegtErik('Bijna?'),
  zegtMark('Het blijft een BX.'),
  zegtErik('Waar is De Veteraan?'),
  zegtMark('Die ziet hem later wel.'),
  zegtErik('Dus dat was het?'),
  zegtMark('Voor vandaag wel.'),
  // hij loopt er nog een keer omheen
  zegtMark('Mooie kleur trouwens.'),
  zegtErik('Jij zei dat het niet uitmaakte.'),
  zegtMark('Dat zei ik inderdaad.'),
  zegtMark('Wees trouwens bereikbaar, De Veteraan heeft ons snel weer nodig en wij kunnen het geld gebruiken.'),
  zegtMark('Trakteer jezelf ook maar op een biertje, kan je hier binnen halen bij de Poiesz!'),
];

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

/*
 De dichtstbijzijnde parkeerplek bij een punt, met de richting van het vak erbij
 (`yaw` uit de kaartdata). Zo staat de BX straks netjes in een vak en niet
 schuin op een grasveld, en zo weet het verhaal waar hij afgeleverd moet worden.
*/
function parkeerBij(x, z, straal = 220, vrij = null) {
  let beste = null;
  for (const p of KAART.parkeerplekken || []) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d > straal) continue;
    // een vak waar al een auto in staat is geen vak: dan zet je de BX bovenop
    // een geparkeerde auto, en stap je bij het indrukken van E in de verkeerde
    if (vrij && !vrij(p.x, p.z)) continue;
    if (!beste || d < beste.d) beste = { x: p.x, z: p.z, yaw: p.yaw || 0, d };
  }
  return beste;
}

// Het hoofdveld van de voetbalclub, om de parkeerplaats ernaast te vinden.
function sportveldVan(naam) {
  const v = (KAART.sportvelden || []).find(q => naam.test(q.naam || ''));
  if (!v) return null;
  const x = v.cx ?? (v.mid ? v.mid[0] : null), z = v.cz ?? (v.mid ? v.mid[1] : null);
  return x == null ? null : { x, z, naam: v.naam };
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
  /*
   `eersteP`, `sterrenWeg` en `sterGeven` komen uit js/main.js: dit bestand kent
   de camera en de politie niet, maar moet er op een paar momenten wel iets mee
   — de camera terug naar de eerste persoon, de sterren weghalen na de
   vrachtwagen, en er juist één geven als je de BX steelt. Ze zijn optioneel,
   zodat het verhaal ook zonder werkt.
  */
  const {
    scene, player, hud, vehicles,
    eersteP = null, sterrenWeg = null, sterGeven = null,
    // missie 7 heeft twee binnenruimtes en de camera nodig; ze komen als
    // functies binnen omdat js/main.js ze pas ná het verhaal maakt
    wieken = null, poiesz = null, schokken = null, laatVallen = null, paniek = null,
    // missie 8 vaart: de sloepen komen als functie binnen, net als de ruimtes
    boten = null,
  } = ctx;
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
  /*
   De spanningsmuziek (audio/missie/, zie geluid.missiemuziek). Hij staat aan
   vanaf het moment dat je in de auto stapt naar de waterzuivering, door de
   bewaking en de rit met de vrachtwagen heen, tot even na MISSION COMPLETED —
   en verder nergens. `spanningUit` is het uitlopen aan het eind; neergaan of
   een mislukte missie zet hem meteen af.
  */
  let spanning = false;
  let spanningUit = 0;
  let startPraatT = -1;          // aftellen tot Mark uit zichzelf begint (zie beginGesprek)
  // missie 7: de bom
  let schutters = null;          // de zes man die komen opdagen (js/bewaking.js)
  let schutterAutos = [];        // hun drie auto's
  let aanrijders = [];           // diezelfde auto's zolang ze nog onderweg zijn
  // missie 8: de deal bij de molen
  let deal = null;               // de ontmoeting op de kade (js/deal.js)
  let snipRing = null;           // de gele cirkel op het water
  let snipBoten = [];            // de drie waterpolitieboten
  let snipT = 0;                 // aftellen tot de telefoon gaat
  let snipKijkT = 0;             // hoelang je nog meekijkt voor het misgaat
  let snipGezien = false;        // is de waterpolitie al een keer in beeld geweest?
  const gevallen = new Set();    // wie er al een wapen heeft laten liggen
  let bomAuto = null;            // de auto voor de deur aan de Wieken
  let bomMerk = null;            // de markering waar de bom moet komen
  let bomPakket = null;          // het pakket zelf, zodra het geplant is
  let knal = null;               // de lopende ontploffing
  let bomT = 0;                  // klok voor de stappen die vanzelf doorlopen
  let markVuurT = 0;             // wanneer Mark weer een schot lost
  let naMissieNaam = 'johan';    // welke missie er na de pauze begint
  // missie 6: de groene BX
  let bxAuto = null;             // de Citroën BX zelf
  let bxPlek = null;             // het parkeervak bij de Poiesz in IJlst
  let bxGestolen = false;        // of de ster voor de diefstal al gegeven is
  let doodT = 0;                 // aftellen na het neergaan
  // missie 5
  let johan = null;              // de Persoon van Johan
  let dief = null;               // js/dief.js
  let telefoonT = 0;             // aftellen tot de telefoon opgenomen is
  let naMissieT = 0;             // pauze tussen twee missies
  let misluktT = 0;              // aftellen na een mislukte missie
  let envelop = null;            // {obj, t} – de envelop die de dief weggooit
  let geld = START_GELD;         // portemonnee; ruim gevuld zolang het spel in de testfase zit
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
  /*
   Een missie beginnen. Twee gebruikers: het verhaal zelf (de volgende missie na
   een pauze) en de testfase, waarin je elke missie los moet kunnen starten
   zonder de vorige zes te spelen (verzoek 21 sep 2026, zie `startMissieLos` in
   js/main.js). Daarom gaat eerst alles van de vorige missie weg: een gesprek
   dat nog openstaat, de opdrachtregel, de vlag op de kaart, en wat missie 7 in
   de wereld had gezet.
  */
  function startMissie(naam) {
    gesprek = null; sluitBalk();
    zetOpdracht('');
    hud.zetNavigatie(null); navDoel = null;
    markDoel = null; markNa = null;
    spanning = false; spanningUit = 0;
    naMissieT = 0;
    ruimBomOp();
    ruimSniperOp();
    punt = null;                      // een nieuwe missie, dus geen oud herstelpunt
    missie = naam;
    fase = 'wacht';
    player.health = 100;              // na elke missie is je leven weer vol
    hud.zetLeven(player.health);
    /*
     Vanaf missie 2 heb je je pistool al. Sla je met shift+cijfer een missie
     over, dan staat het slot van missie 1 nog dicht en kun je hem ook met H
     niet tevoorschijn halen (melding 21 sep 2026) — dus dan gaat het hier open.
    */
    if (naam !== 'molenkrite') geefWapen();
    if (naam === 'molenkrite') {
      // terug naar het begin: Mark staat voor de deur en begint zelf te praten
      mark.zetNeer(thuis.x, thuis.z, straatkant);
      markZichtbaar(true);
      beginGesprek(1.0);
    }
    else if (naam === 'rijden') beginRijden();
    else if (naam === 'bewaking') beginBewaking();
    else if (naam === 'afleveren') beginAfleveren();
    else if (naam === 'johan') beginJohan();
    else if (naam === 'bx') beginBX();
    else if (naam === 'bom') beginBom();
    else if (naam === 'sniper') beginSniper();
  }

  /*
   ---- missie 6: de groene BX ----

   Vanaf hier werkt het spel anders: een missie begint niet meer vanzelf maar
   staat als **M** op de kaart. Mark loopt naar Tinga State en wacht daar; met E
   spreek je hem aan (verzoek 20 sep 2026).
  */
  function beginBX() {
    fase = 'wacht';
    bxGestolen = false;
    const pand = pandVan(BX_HUIS);
    const bij = pand ? voorPunt(pand, 7.5) : { x: player.pos.x + 6, z: player.pos.z };
    const [mx, mz] = resolveCollisions(bij.x, bij.z, 0.4);
    markDoel = null; markNa = null;
    mark.zetNeer(mx, mz, pand ? kijkHoek({ x: mx, z: mz }, voorPunt(pand, 24)) : mark.yaw);
    markZichtbaar(true);
    zetOpdracht('ga naar de M op de kaart: Mark wacht bij Tinga State');
    zetNavDoel(mx, mz, 'Tinga State', 'M');
    // eenmalig uitleggen waar die M voor staat
    uitleg.toon('missies', 'NIEUWE MISSIES',
      BX_AANKONDIGING[0], 14);
  }

  /*
   De gele ruit die aanwijst waar de bom moet komen, en het pakket zelf
   (js/bom.js). Ze staan er vanaf het begin maar zijn onzichtbaar tot missie 7
   ze nodig heeft; zo hoeft er middenin een missie niets gebouwd te worden.
  */
  bomMerk = maakMarkering(scene);
  bomPakket = maakBompakket(scene);

  /*
   Wat er weg mag zodra de speler even niet kijkt. Na missie 6 rijdt Mark met de
   BX naar De Veteraan (verzoek 21 sep 2026), en dat mag je niet zien gebeuren:
   iets dat verdwijnt terwijl je ernaar staat te kijken leest als een fout, iets
   dat weg is als je je omdraait leest als vertrokken.
  */
  const weg = { mark: false, bx: false };
  function ruimOpUitZicht() {
    if (!weg.mark && !weg.bx) return;
    const sp = spelerPunt();
    const vx = -Math.sin(player.yaw), vz = -Math.cos(player.yaw);
    const uitZicht = (x, z) => {
      const dx = x - sp.x, dz = z - sp.z;
      const d = Math.hypot(dx, dz);
      if (d > 70) return true;                          // zo ver weg zie je het niet meer
      if (d < 0.5) return false;
      return (dx / d) * vx + (dz / d) * vz < 0.3;       // buiten de kijkkegel
    };
    if (weg.mark && mark.groep.visible && uitZicht(mark.groep.position.x, mark.groep.position.z)) {
      markZichtbaar(false);
      weg.mark = false;
    }
    if (weg.bx && bxAuto && player.inCar !== bxAuto && uitZicht(bxAuto.x, bxAuto.z)) {
      // onzichtbaar betekent in js/vehicles.js ook: telt niet meer mee voor
      // botsingen, voor het verkeer en voor het instappen met E
      if (bxAuto.mesh) bxAuto.mesh.visible = false;
      bxAuto.zichtbaar = false;
      bxAuto.driveable = false;
      weg.bx = false;
    }
  }

  /*
   Elk parkeervak in de wijk is bezet: de geparkeerde auto's komen uit dezelfde
   kaartdata als de vakken zelf (js/kaartwereld.js, `parkSpots`). Een "leeg vak"
   zoeken heeft dus geen zin — dit zoekt de auto die er staat.
  */
  function geparkeerdBij(x, z, straal) {
    let beste = null;
    for (const c of vehicles.cars) {
      if (c === bxAuto || !c.inst || c.zichtbaar === false) continue;
      const d = Math.hypot(c.x - x, c.z - z);
      if (d > straal) continue;
      if (!beste || d < beste.d) beste = { c, d };
    }
    return beste ? beste.c : null;
  }

  /*
   De BX neerzetten. Niet als extra auto bovenop een vak dat al bezet is — dan
   stap je met E in de verkeerde — maar door de auto die het dichtst bij het
   veld van VV Sneek staat *tot* de BX te maken: ander model, groene lak, en het
   losse model in plaats van de instantie. Eén van de auto's op het
   clubparkeerterrein ís de BX.
  */
  function zetBXNeer() {
    if (bxAuto) return bxAuto;
    const veld = sportveldVan(BX_VELD);
    const staander = veld ? geparkeerdBij(veld.x, veld.z, 260) : null;
    if (staander) {
      staander.soort = 'bx';
      vehicles.verf(staander, BX_GROEN);
      vehicles.maakBestuurbaar(staander);
      bxAuto = staander;
      return bxAuto;
    }
    // geen geparkeerde auto in de buurt (een kale kaart): dan toch maar een nieuwe
    const vak = veld ? parkeerBij(veld.x, veld.z, 260) : null;
    const plek = vak || { x: player.pos.x + 8, z: player.pos.z + 8, yaw: 0 };
    bxAuto = vehicles.voegToe({ x: plek.x, z: plek.z, yaw: plek.yaw, soort: 'bx', kleur: BX_GROEN });
    return bxAuto;
  }

  // Waar hij afgeleverd moet worden: het vak naast de Poiesz in IJlst.
  function bxAfleverPlek() {
    if (bxPlek) return bxPlek;
    const poiesz = (KAART.panden || []).find(q => q.type === 'poiesz');
    const vak = poiesz ? parkeerBij(poiesz.rect.cx, poiesz.rect.cz, 120) : null;
    if (vak) {
      /*
       En het vak leegmaken: de auto die er stond is weggereden. Zonder dat
       parkeer je de BX dwars door een geparkeerde auto heen. Onzichtbaar
       betekent hier ook: hij telt niet meer mee voor botsingen en voor het
       instappen met E (`isZichtbaar` in js/vehicles.js).
      */
      const erop = geparkeerdBij(vak.x, vak.z, 2.2);
      if (erop) {
        erop.zichtbaar = false;
        erop.driveable = false;
        vehicles.zetInstantie(erop);
      }
    }
    bxPlek = vak || (bxAuto ? { x: bxAuto.x, z: bxAuto.z, yaw: 0 } : null);
    return bxPlek;
  }

  // Na de briefing: de auto staat klaar, de muziek gaat aan en de kaart wijst.
  function startBXRit() {
    fase = 'ophalen';
    spanning = true; spanningUit = 0;          // spanningsmuziek, tot het eind
    const auto = zetBXNeer();
    markZichtbaar(false);                      // hij ziet je straks in IJlst wel
    zetOpdracht('haal de groene Citroën BX op bij VV Sneek');
    zetNavDoel(auto.x, auto.z, 'VV Sneek', 'A');
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
    /*
     En de politie is je eenmalig kwijt. Je hebt net een vrachtwagen met een
     lading dwars door de wijk gereden; dat de sterren daarna blijven staan
     maakt het spel na de missie onspeelbaar (verzoek 20 sep 2026). Dit gebeurt
     één keer, hier, en niet bij de andere missies.
    */
    if (sterrenWeg) sterrenWeg();
    spanningUit = 6;                   // de muziek loopt over de melding heen uit
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

  /*
   Afrekenen. Levert false als je het niet hebt, en dan gebeurt er niets — de
   verkoper bij Tinga State (js/boerderij.js) gebruikt dit.
  */
  /*
   Geld erbij. Tot nu toe kwam er alleen geld binnen bij het afleveren van een
   missie; sinds 13 september 2026 rapen we ook op wat er op straat ligt
   (js/buit.js). Levert op hoeveel erbij kwam.
  */
  function verdien(bedrag) {
    const n = Math.round(bedrag || 0);
    if (n <= 0) return 0;
    geld += n;
    zetGeldInBeeld();
    return n;
  }

  function betaal(bedrag) {
    if (bedrag <= 0 || geld < bedrag) return false;
    geld -= bedrag;
    zetGeldInBeeld();
    return true;
  }

  // ---------- missie mislukt ----------
  // Het beeld vaagt naar grijs, de reden komt in beeld en daarna begint het
  // spel bij het laatst opgeslagen spel (of de missie opnieuw).
  function mislukt(reden) {
    if (misluktT > 0) return;
    misluktT = 3.4;
    spanning = false; spanningUit = 0;
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
    spanning = false; spanningUit = 0;
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
    // je staat weer buiten de auto: de muziek begint straks opnieuw, op een
    // ander fragment
    spanning = missie === 'bewaking' || missie === 'afleveren';
    spanningUit = 0;
    /*
     Missie 7 en 8 hervatten bij het laatste herstelpunt in plaats van bij het
     begin: ze duren te lang om ze na elk ongeluk helemaal over te doen.
    */
    if (missie === 'bom') { hervatBom(punt && punt.missie === 'bom' ? punt.fase : 'wacht'); return; }
    if (missie === 'sniper') { hervatSniper(punt && punt.missie === 'sniper' ? punt.fase : 'telefoon'); return; }
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

  /*
   Mark begint uit zichzelf. Het spel opende met jou tegenover je broer en de
   vraag of je op <kbd>E</kbd> drukt; wie dat niet doorheeft loopt de wijk in en
   het verhaal begint nooit (verzoek 20 sep 2026). Nu zet main.js dit klaar
   zodra het filmpje voorbij is: na een tel begint hij te praten, en verder
   loopt het gesprek zoals altijd met E verder.
  */
  function beginGesprek(na = 1.4) {
    if (missie === 'molenkrite' && fase === 'wacht') startPraatT = na;
  }

  // ---------- E ----------
  function toets() {
    if (!balk.hidden) return verderInGesprek();
    if (missie === 'molenkrite' && fase === 'wacht' && afst(spelerPunt(), mark.groep.position) < PRAAT_AFSTAND) {
      fase = 'gesprek';
      zeg(GESPREK1, () => { fase = 'loopt'; zetOpdracht('ga met Mark mee'); });
      return true;
    }
    /*
     Missie 6 begint hier: Mark staat bij Tinga State onder de M op de kaart.
     Halverwege het gesprek telt hij vijfhonderd euro uit voor het overspuiten;
     daarom staat de briefing in twee stukken.
    */
    /*
     De bom planten. Dat kan alleen op de plek bij de schappen die met de gele
     ruit is aangewezen — een winkel van veertig bij dertig meter is te groot
     voor "ergens binnen".
    */
    if (missie === 'bom' && fase === 'planten') {
      const plek = bomPlek();
      const sp = spelerPunt();
      if (plek && Math.hypot(sp.x - plek.x, sp.z - plek.z) < BOM_PLANT_BEREIK) {
        if (bomMerk) bomMerk.toon(false);
        if (bomPakket) { bomPakket.zet(plek.x, 0, plek.z, player.yaw); bomPakket.toon(true); }
        praatEl.hidden = true;
        fase = 'naarbuiten'; zetPunt(fase);
        geluid.neerzetten();
        zetOpdracht('naar buiten, Mark wacht op je');
        hud.melding('Bom geplant', 'Naar buiten — Mark laat hem afgaan.', 4);
        return true;
      }
    }
    if (missie === 'bx' && fase === 'wacht' && afst(spelerPunt(), mark.groep.position) < PRAAT_AFSTAND) {
      fase = 'briefing';
      zeg(BX_BRIEFING_A, () => {
        verdien(BX_SPUIT);
        hud.melding('Mark geeft je € 500', 'Dat is het geld voor het overspuiten.', 5);
        zeg(BX_BRIEFING_B, () => startBXRit());
      });
      return true;
    }
    return false;
  }

  /*
   Het wapen vrijgeven, met de uitleg erbij. Eén keer: staat het slot al open,
   dan gebeurt er niets meer — je kunt deze missie ook opnieuw doen na een
   mislukking, en dan hoeft dezelfde uitleg er niet nog eens overheen.
  */
  function geefWapen() {
    if (!player.wapenSlot && !player.wapenUit) return;
    player.wapenSlot = false;
    player.wapenUit = false;
    const kruis = document.getElementById('crosshair');
    if (kruis) kruis.style.display = '';
    uitleg.toon('wapen', 'Je pistool',
      '<kbd>H</kbd> wapen pakken en weer wegbergen · '
      + '<kbd>LMB</kbd> schieten · <kbd>RMB</kbd> richten · <kbd>R</kbd> herladen', 11);
  }

  // ---------- schieten ----------
  function doelen() {
    const uit = [];
    if (missie === 'molenkrite' && (fase === 'opdracht' || fase === 'briefing')) {
      for (const b of drinkers) if (!omgevallen.has(b.i)) uit.push(b.obj);
    }
    if (bewaking && (missie === 'bewaking' || missie === 'afleveren' || missie === 'klaar')) uit.push(...bewaking.doelen());
    // de zes man uit missie 7, zolang ze er staan
    if (schutters) uit.push(...schutters.doelen());
    // en de maffia op de kade plus de waterpolitie uit missie 8
    if (deal) uit.push(...deal.doelen());
    for (const b of snipBoten) uit.push(...b.doelen());
    // De dief is ook een doel — maar raak je hem, dan is de missie mislukt.
    if (dief && missie === 'johan' && (fase === 'naar_dewieken' || fase === 'achtervolging')) uit.push(...dief.doelen);
    return uit;
  }

  function raak(obj) {
    // de zes man bij de Poiesz: die mogen juist wel
    if (schutters && schutters.raak(obj)) return true;
    /*
     Bij de molen: op De Veteraan schieten is het einde van de missie. Hij is
     degene die jullie in de gaten houden; een kogel van jou maakt van de
     bescherming een liquidatie (verzoek 22 sep 2026).
    */
    if (deal && missie === 'sniper' && deal.raakVeteraan(obj)) {
      mislukt(MISLUKT_VETERAAN);
      return true;
    }
    // de maffia bij de molen, en de waterpolitie die achter je aan komt
    if (deal && deal.raak(obj)) return true;
    /*
     De waterpolitie uit missie 8: eerst de twee agenten aan boord, dan de romp.
     Ze lopen bewust via het verhaal en niet via js/main.js, want daar telt een
     agent als een misdaad — en deze achtervolging hoort juist geen sterren op
     te leveren. Een snipertreffer in de romp telt voor drie.
    */
    for (const b of snipBoten) if (b.raakAgent(obj) || b.raak(obj, 3)) return true;
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
          zetOpdracht('');
          hud.melding('MISSIE VOLTOOID', `Beloning: + ${euro(BELONING)} toegevoegd aan wallet`, 8);
          /*
           En meteen door naar de volgende: vanaf hier staat een missie als M op
           de kaart in plaats van dat hij vanzelf begint (verzoek 20 sep 2026).
           De uitleg daarover en de M bij Tinga State komen uit `beginBX`.
          */
          startMissie('bx');
          /*
           En waar je dat geld aan kwijt kunt. Tot hier is het spel een reeks
           opdrachten geweest; vanaf nu is het de wijk in, en dan helpt het om te
           weten waar de winkels voor zijn (verzoek 20 sep 2026).
          */
          uitleg.toon('winkels', 'Wat je met je geld kunt',
            'Bij <b>Tinga State</b> aan de Molenkrite koop je wapens en munitie · '
            + 'bij de <b>Poiesz</b> in IJlst en Duinterpen vul je je health aan', 13);
        });
      }
    }
  }

  /*
   ---- missie 8: de deal bij de molen ----

   Twee plekken maken deze missie: de kade bij houtzaagmolen De Rat, waar de
   ontmoeting is, en het stukje open water waar jij met de sloep moet liggen.
   Allebei worden ze gezocht in de kaart en niet met de hand ingetikt: rond de
   molen wordt een ring van kandidaten afgelopen, en de beste is die op een
   meter of zestig ligt, ruim genoeg water eromheen heeft en vrij zicht op de
   kade geeft. Zonder dat laatste kijk je door een kijker tegen een loods aan.
  */
  let snipPlek = null;           // { boot: {x,z}, kade: {x,z}, naarWater: {x,z} }
  function zoekSnipPlek() {
    if (snipPlek) return snipPlek;
    const mol = (KAART.molens || []).find(m => /rat/i.test(m.naam || ''));
    if (!mol) return null;
    let beste = null;
    for (let r = SNIP_VER[0]; r <= SNIP_VER[1]; r += 2) {
      for (let i = 0; i < 64; i++) {
        const hoek = (i / 64) * Math.PI * 2;
        const x = mol.cx + Math.cos(hoek) * r, z = mol.cz + Math.sin(hoek) * r;
        if (!vaarbaar(x, z)) continue;
        // ruim genoeg om in te dobberen: de hele cirkel eromheen moet water zijn
        let ruim = true;
        for (let j = 0; j < 10 && ruim; j++) {
          const h = (j / 10) * Math.PI * 2;
          if (!vaarbaar(x + Math.cos(h) * (SNIP_RING * 0.6), z + Math.sin(h) * (SNIP_RING * 0.6))) ruim = false;
        }
        if (!ruim) continue;
        // de oever ertussen: vanaf het water naar de molen lopen tot het land begint
        const nx = (mol.cx - x) / r, nz = (mol.cz - z) / r;
        let oever = null;
        for (let d = 2; d < r; d += 1) {
          const px = x + nx * d, pz = z + nz * d;
          if (!vaarbaar(px, pz)) { oever = { x: px, z: pz }; break; }
        }
        if (!oever) continue;
        const kade = { x: oever.x + nx * 2.6, z: oever.z + nz * 2.6 };
        if (!zichtVrij(x, z, kade.x, kade.z, 1.6)) continue;
        const score = -Math.abs(r - SNIP_LIEFST);
        if (!beste || score > beste.score) {
          beste = { score, boot: { x, z }, kade, naarWater: { x: -nx, z: -nz }, afstand: r };
        }
      }
    }
    snipPlek = beste;
    return snipPlek;
  }

  // de kade aan de Geeuw waar je vertrekt en weer terugkomt
  function geeuwKade() {
    const lig = LIGPLAATSEN[0];
    return lig.wal || { x: lig.x, z: lig.z };
  }

  function beginSniper() {
    fase = 'telefoon';
    ruimSniperOp();
    snipT = 1.2;
    zetOpdracht('neem de telefoon op');
    hud.zetNavigatie(null); navDoel = null;
    markZichtbaar(false);
  }

  function ruimSniperOp() {
    if (deal) { deal.verwijder(); deal = null; }
    if (snipRing) { snipRing.toon(false); }
    for (const b of snipBoten) b.reset();
    snipBoten = [];
    snipT = 0; snipKijkT = 0; snipGezien = false;
    player.vuurSlot = false;
    if (johan) johan.groep.visible = false;
  }

  // Johan neerzetten bij het bootje aan de Geeuwkade
  function johanBijDeBoot() {
    if (!zorgVoorJohan()) return null;
    const kade = geeuwKade();
    const [jx, jz] = resolveCollisions(kade.x + 1.4, kade.z + 1.4, 0.4);
    johan.zetNeer(jx, jz, kijkHoek({ x: jx, z: jz }, kade));
    johan.groep.visible = true;
    return { x: jx, z: jz };
  }

  // waar de speler is: in de boot telt de boot, niet het poppetje
  function bootPunt() {
    const b = boten && boten();
    if (b && b.inBoot) return { x: b.inBoot.x, z: b.inBoot.z };
    return spelerPunt();
  }

  function werkSniperBij(dt, sp) {
    if (fase === 'klaar') return;
    if (fase !== 'telefoon') {
      navKlok += dt;
      if (navKlok > 2) { navKlok = 0; werkNavBij(); }
    }

    // -- de telefoon: Johan belt een minuut na de bom
    if (fase === 'telefoon') {
      if (snipT > 0) {
        snipT -= dt;
        if (snipT <= 0) {
          geluid.telefoon();
          zeg(SNIP_TELEFOON, () => {
            const heeft = player.wapens.includes('sniper');
            fase = heeft ? 'naar_johan' : 'kopen'; zetPunt(fase);
            if (heeft) {
              zetOpdracht('ga naar Johan bij de Geeuwkade achter de waterzuivering');
              const p = johanBijDeBoot();
              if (p) zetNavDoel(p.x, p.z, 'Johan bij de Geeuw', 'J');
            } else {
              zetOpdracht('koop een sniper bij Tinga State');
              const pand = pandVan(SNIP_WINKEL);
              const v = pand ? voorPunt(pand, 7.5) : null;
              if (v) zetNavDoel(v.x, v.z, 'Tinga State', 'M');
            }
            hud.melding('NIEUWE MISSIE', heeft ? 'Ga naar Johan aan de Geeuw.'
              : 'Koop een sniper bij Tinga State.', 5);
            spanning = true; spanningUit = 0;
          }, { wie: 'Johan', telefoon: true, kop: KOPPEN.johan });
        }
      }
      return;
    }

    // -- de sniper kopen bij Tinga State
    if (fase === 'kopen') {
      if (!player.wapens.includes('sniper')) return;
      fase = 'naar_johan'; zetPunt(fase);
      zetOpdracht('ga naar Johan bij de Geeuwkade achter de waterzuivering');
      const p = johanBijDeBoot();
      if (p) zetNavDoel(p.x, p.z, 'Johan bij de Geeuw', 'J');
      return;
    }

    // -- bij Johan aan de kade
    if (fase === 'naar_johan') {
      if (!johan || !johan.groep.visible) { johanBijDeBoot(); return; }
      johan.update(dt, { loopt: false });
      const d = afst(sp, johan.groep.position);
      if (d > PRAAT_AFSTAND || !balk.hidden) return;
      fase = 'briefing';
      hud.zetNavigatie(null); navDoel = null;
      johan.kijkNaar(sp.x, sp.z, 1, 99);
      zeg(SNIP_BIJ_JOHAN, () => {
        fase = 'varen'; zetPunt(fase);
        const plek = zoekSnipPlek();
        zetOpdracht('vaar met de sloep naar de molen in IJlst en blijf in de gele cirkel');
        if (plek) {
          if (!snipRing) snipRing = maakWaterRing(scene, SNIP_RING);
          snipRing.zet(plek.boot.x, plek.boot.z);
          snipRing.toon(true);
          zetNavDoel(plek.boot.x, plek.boot.z, 'De Rat, IJlst', 'M');
        }
      });
      return;
    }
    if (fase === 'briefing') { if (johan) johan.update(dt, { loopt: false }); return; }

    // -- varen naar IJlst; Johan vaart mee en is dus uit beeld zodra jij aan boord bent
    if (fase === 'varen') {
      const b = boten && boten();
      const aanBoord = !!(b && b.inBoot);
      if (johan) johan.groep.visible = !aanBoord;
      if (!aanBoord && johan) johan.update(dt, { loopt: false });
      const plek = zoekSnipPlek();
      if (!plek || !aanBoord) return;
      const p = bootPunt();
      const erin = Math.hypot(p.x - plek.boot.x, p.z - plek.boot.z) < SNIP_RING;
      const traag = Math.abs(b.inBoot.snelheid || 0) < 1.6;
      if (!erin || !traag || !balk.hidden) return;
      fase = 'kijken'; zetPunt('varen');   // sterf je hier, dan vaar je opnieuw uit
      snipKijkT = SNIP_KIJK;
      hud.zetNavigatie(null); navDoel = null;
      // de sniper in de hand, en schieten kan nog niet: eerst kijken
      if (!player.wapens.includes('sniper')) player.krijgWapen('sniper');
      else player.zetWapen('sniper');
      player.wapenUit = false;
      player.vuurSlot = true;
      // de ontmoeting op de kade opbouwen, met hun gezicht naar het water
      if (!deal) deal = maakDeal(scene, plek.kade, plek.naarWater);
      zeg(SNIP_SCOPE, () => {
        zetOpdracht('kijk door de kijker: rechtermuisknop, scrollwiel zoomt in');
      });
      return;
    }

    // -- meekijken door de kijker
    if (fase === 'kijken') {
      if (!balk.hidden) return;
      snipKijkT -= dt;
      if (snipKijkT > 0) return;
      fase = 'vuurgevecht';
      if (deal) deal.begin();
      player.vuurSlot = false;
      zeg(SNIP_MIS, () => {
        zetOpdracht(`schakel de maffia uit (${deal ? deal.aantal : 0} te gaan)`, true);
      }, { auto: 2.2 });
      return;
    }

    // -- het vuurgevecht door de kijker
    if (fase === 'vuurgevecht') {
      if (!deal) return;
      if (!deal.allemaalNeer) {
        if (balk.hidden) zetOpdracht(`schakel de maffia uit (${deal.aantal - deal.neer} te gaan)`, true);
        return;
      }
      if (!balk.hidden) return;
      fase = 'terug'; zetPunt(fase);
      const kade = geeuwKade();
      zeg(SNIP_WEG, () => {
        zetOpdracht('terug naar de kade aan de Geeuw');
        zetNavDoel(kade.x, kade.z, 'Geeuwkade', 'M');
        // en de waterpolitie komt achter je aan
        maakWaterpolitie();
        zeg(SNIP_POLITIE, null, { auto: 3.0 });
      });
      return;
    }

    // -- terug naar de Geeuwkade, met drie boten achter je aan
    if (fase === 'terug') {
      const p = bootPunt();
      const kade = geeuwKade();
      const thuis = Math.hypot(p.x - kade.x, p.z - kade.z) < SNIP_THUIS;
      /*
       Ze komen niet meteen het water op (js/politieboot.js laat ze een paar
       tellen later opkomen). Zolang er nog geen boot te zien is geweest ben je
       niet klaar — anders zou je de missie kunnen uitspelen door meteen terug
       te varen voordat ze er zijn.
      */
      if (snipBoten.some(b => b.actief)) snipGezien = true;
      const politieWeg = snipGezien && snipBoten.every(b => !b.actief || b.fase === 'wrak');
      if (balk.hidden) {
        zetOpdracht(politieWeg
          ? 'terug naar de kade aan de Geeuw'
          : `schakel de waterpolitie uit (${snipBoten.filter(b => b.actief && b.fase !== 'wrak').length} te gaan)`,
        !politieWeg);
      }
      if (!thuis || !politieWeg || !balk.hidden) return;
      fase = 'afronding';
      hud.zetNavigatie(null); navDoel = null;
      const [jx, jz] = resolveCollisions(kade.x + 1.6, kade.z + 1.6, 0.4);
      if (johan) {
        johan.zetNeer(jx, jz, kijkHoek({ x: jx, z: jz }, { x: p.x, z: p.z }));
        johan.groep.visible = true;
      }
      zeg(SNIP_KLAAR, () => {
        verdien(SNIP_BELONING);
        missie = 'klaar'; fase = 'klaar';
        spanningUit = 6;
        ruimSniperOp();
        hud.melding('MISSIE VOLTOOID – DE DEAL BIJ DE MOLEN',
          `Beloning: + ${euro(SNIP_BELONING)} toegevoegd aan wallet`, 8);
      });
      return;
    }
  }

  /*
   Drie politiesloepen die achter je aan komen zonder dat je een ster hebt: het
   is hier geen gevolg van een misdaad maar een deel van de missie. Ze komen uit
   js/politieboot.js — dezelfde boot, dezelfde vaartechniek, dezelfde twee
   agenten aan boord — met een haakje dat zegt dat ze ook zonder verdenking
   mogen jagen.
  */
  function maakWaterpolitie() {
    if (snipBoten.length || !boten) return;
    const b = boten();
    if (!b) return;
    for (let i = 0; i < SNIP_BOTEN; i++) {
      snipBoten.push(initPolitieboot({
        scene, player, hud, boten: b, politie: null,
        jaagtOok: () => missie === 'sniper' && fase === 'terug',
        melding: i === 0,
        /*
         Ze komen van de Geeuw af, dus van de kant waar jij naartoe moet: dan
         vaar je ze tegemoet en zie je ze aankomen in plaats van dat ze naast
         je opduiken (melding 21 sep 2026). En ze komen niet tegelijk: twee
         tellen ertussen, zodat het er drie zijn en geen muur.
        */
        komVan: () => geeuwKade(),
        komNa: 1.5 + i * 2.5,
      }));
    }
  }

  /*
   ---- missie 7: de bom bij de Poiesz in Duinterpen ----

   De plekken komen weer uit de wereld zelf: het huis aan de Wieken en de
   winkel in Duinterpen zijn de twee binnenruimtes die er al waren
   (js/interieur.js en js/supermarkt.js), het bos is het bosvlak naast de
   waterzuivering, en thuis is Molenkrite 15.
  */
  function beginBom() {
    fase = 'wacht';
    bomT = 0;
    ruimBomOp();
    markZichtbaar(false);          // hij zit binnen; buiten zie je hem niet
    const huis = wieken && wieken();
    const deur = huis && huis.plekken ? huis.plekken.deurBuiten : null;
    zetOpdracht('ga naar binnen bij de Wieken 29 — Mark zit op je bank');
    if (deur) zetNavDoel(deur.x, deur.z, 'de Wieken 29', 'M');
    else if (diefPand) {
      const v = voorPunt(diefPand, 4);
      zetNavDoel(v.x, v.z, 'de Wieken 29', 'M');
    }
  }

  // alles van de missie weer weghalen (bij opnieuw beginnen)
  function ruimBomOp() {
    if (schutters) { schutters.verwijder(); schutters = null; }
    aanrijders = [];
    gevallen.clear();
    mark.bergWapen();
    for (const a of schutterAutos) if (a && a.mesh) { a.mesh.visible = false; a.zichtbaar = false; a.driveable = false; }
    schutterAutos = [];
    if (bomMerk) bomMerk.toon(false);
    if (bomPakket) bomPakket.toon(false);
    if (knal) { knal.stop(); knal = null; }
  }

  // het bosvlak naast de waterzuivering: daar schud je de politie af
  let bosVlak = null;
  function bos() {
    if (bosVlak) return bosVlak;
    const mid = poort ? poort.mid : { x: 0, z: 0 };
    let beste = null;
    for (const v of KAART.vlakken || []) {
      if (v.k !== 'bos' || !v.r || !v.r[0] || v.r[0].length < 3) continue;
      let sx = 0, sz = 0;
      for (const q of v.r[0]) { sx += q[0]; sz += q[1]; }
      const cx = sx / v.r[0].length, cz = sz / v.r[0].length;
      let straal = 0;
      for (const q of v.r[0]) straal = Math.max(straal, Math.hypot(q[0] - cx, q[1] - cz));
      const d = Math.hypot(cx - mid.x, cz - mid.z);
      // het bos moet in de buurt van de waterzuivering liggen én van formaat zijn
      if (d > 700 || straal < 30) continue;
      const score = straal - d * 0.5;
      if (!beste || score > beste.score) beste = { score, x: cx, z: cz, straal, ring: v.r[0] };
    }
    bosVlak = beste;
    return bosVlak;
  }
  function inHetBos(x, z) {
    const b = bos();
    if (!b) return false;
    return inPolygoon(x, z, b.ring) || Math.hypot(x - b.x, z - b.z) < b.straal * 0.8;
  }

  // de winkel in Duinterpen: de ingang buiten en de plek bij de schappen binnen
  function winkelIngang() {
    const w = poiesz && poiesz();
    if (!w || !w.ingangen) return null;
    return w.ingangen.find(i => /duinterpen/i.test(i.naam || '')) || w.ingangen[0];
  }
  function bomPlek() {
    const w = poiesz && poiesz();
    return w && w.plekken ? w.plekken.bier : null;     // het schap achterin de winkel
  }

  // De auto voor de deur: dezelfde manier als bij missie 2 — op de rijbaan
  // naast het huis, met de kop de straat af.
  function zetBomAutoNeer() {
    if (bomAuto && bomAuto.zichtbaar !== false) return bomAuto;
    const huis = wieken && wieken();
    const stoep = huis && huis.plekken ? huis.plekken.stoep : null;
    const bij = stoep || (diefPand ? voorPunt(diefPand, 6) : { x: player.pos.x + 4, z: player.pos.z });
    if (!navigatie) navigatie = new Navigatie(KAART.wegassen);
    const k = navigatie.naaste(bij.x, bij.z, 400, true);
    const as = k >= 0 ? navigatie.punten[k] : [bij.x, bij.z];
    const langs = k >= 0 && navigatie.bogen[k].length
      ? navigatie.punten[navigatie.bogen[k][0].naar] : [as[0] + 1, as[1]];
    const dx = langs[0] - as[0], dz = langs[1] - as[1];
    const L = Math.hypot(dx, dz) || 1;
    const yaw = Math.atan2(-dx / L, -dz / L);
    bomAuto = vehicles.voegToe({ x: as[0], z: as[1], yaw, soort: 'hatch', kleur: 0x9aa0a6 });
    return bomAuto;
  }

  /*
   De drie auto's met zes man. Ze komen aanrijden en stoppen op ruim twintig
   meter; pas daarna stappen de mannen uit. Dat "pas daarna" is precies wat de
   scène spannend maakt: eerst hoor je ze aankomen, dan pas staan ze er.
  */
  /*
   De drie auto's komen aanrijden. Niet tevoorschijn toveren maar echt aan
   komen rijden en piepend tot stilstand komen (verzoek 21 sep 2026): ze zetten
   zeventig meter verderop in, rijden achter elkaar de straat af en gaan op de
   laatste twintig meter vol op de rem. Pas als ze stilstaan én Mark
   uitgesproken is stappen de mannen uit — dat is `latenUitstappen` hieronder.

   De koers komt uit de wegas onder hun stopplek (js/navigatie.js), niet uit een
   richting die hier bedacht wordt: zo komen ze over de weg aanrijden en niet
   dwars over het gras of door een gevel heen.
  */
  function latenAanrijden(sp) {
    if (schutters || aanrijders.length) return;
    const ing = winkelIngang();
    // van de winkel weg gezien: daar staan ze straks, tussen jou en de uitgang
    let vx = -Math.sin(player.yaw), vz = -Math.cos(player.yaw);
    if (ing) {
      const dx = sp.x - ing.deur.x, dz = sp.z - ing.deur.z;
      const L = Math.hypot(dx, dz);
      if (L > 1) { vx = dx / L; vz = dz / L; }
      else { vx = ing.f[0]; vz = ing.f[1]; }
    }
    const stop0 = { x: sp.x + vx * BOM_KOMEN, z: sp.z + vz * BOM_KOMEN };
    // de wegas eronder: die geeft de rijrichting
    if (!navigatie) navigatie = new Navigatie(KAART.wegassen);
    let tx = vx, tz = vz;
    const k = navigatie.naaste(stop0.x, stop0.z, 60, true);
    if (k >= 0 && navigatie.bogen[k].length) {
      const a = navigatie.punten[k], b = navigatie.punten[navigatie.bogen[k][0].naar];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const L = Math.hypot(dx, dz) || 1;
      tx = dx / L; tz = dz / L;
      stop0.x = a[0]; stop0.z = a[1];
    }
    // ze komen van de kant die het verst van de speler ligt
    const heen = Math.hypot(stop0.x + tx * 30 - sp.x, stop0.z + tz * 30 - sp.z);
    const terug = Math.hypot(stop0.x - tx * 30 - sp.x, stop0.z - tz * 30 - sp.z);
    if (terug > heen) { tx = -tx; tz = -tz; }
    // dwars op de weg, naar de speler toe: aan die kant stappen ze uit
    let zx = -tz, zz = tx;
    if ((sp.x - stop0.x) * zx + (sp.z - stop0.z) * zz < 0) { zx = -zx; zz = -zz; }
    aanrijders = [];
    schutterAutos = [];
    for (let i = 0; i < BOM_AUTOS; i++) {
      // achter elkaar: de eerste vooraan, de rest zeven meter erachter
      const doel = { x: stop0.x + tx * (i * BOM_TUSSEN), z: stop0.z + tz * (i * BOM_TUSSEN) };
      const yaw = Math.atan2(tx, tz);          // met de neus tegen de rijrichting in
      const auto = vehicles.voegToe({
        x: doel.x + tx * BOM_AANRIJ, z: doel.z + tz * BOM_AANRIJ, yaw,
        soort: i === 1 ? 'van' : 'hatch', kleur: i === 1 ? 0x2b2f36 : 0x1d1f24, driveable: false,
      });
      schutterAutos.push(auto);
      aanrijders.push({ auto, doel, zij: { x: zx, z: zz }, snelheid: BOM_AANRIJ_V, piep: false, stil: false });
    }
  }

  /*
   Eén beeld van die aanrit. Levert true zodra ze alle drie stilstaan.
  */
  function werkAanrijdersBij(dt, sp) {
    if (!aanrijders.length) return false;
    let allemaalStil = true;
    for (const a of aanrijders) {
      if (a.stil) continue;
      allemaalStil = false;
      const dx = a.doel.x - a.auto.x, dz = a.doel.z - a.auto.z;
      const d = Math.hypot(dx, dz) || 0.0001;
      /*
       Remmen zoals een auto remt: de snelheid die nog past om precies op de
       plek stil te staan is v = wortel(2·a·d). Zolang die boven de
       rijsnelheid ligt gaat hij vol gas, daaronder remt hij af. De eerste
       opzet remde op een vaste afstand naar een ondergrens en kroop daarna de
       laatste meters naar zijn plek — dat zag eruit als stapvoets rijden
       (melding 21 sep 2026).
      */
      const nodig = Math.sqrt(2 * BOM_REM_A * d);
      const remt = nodig < BOM_AANRIJ_V;
      a.snelheid = Math.min(BOM_AANRIJ_V, nodig);
      if (remt && !a.piep) { a.piep = true; geluid.piependeBanden(afst(sp, a.auto)); }
      const stap = Math.min(d, a.snelheid * dt);
      a.auto.x += (dx / d) * stap;
      a.auto.z += (dz / d) * stap;
      a.auto.speed = a.snelheid;
      if (a.auto.mesh) a.auto.mesh.position.set(a.auto.x, a.auto.mesh.position.y, a.auto.z);
      if (d - stap < 0.4) { a.stil = true; a.auto.speed = 0; }
    }
    return allemaalStil;
  }

  /*
   De zes man stappen uit: twee per auto, aan de kant van de speler. Dit gebeurt
   bewust pas ná het aanrijden en ná de regel van Mark — eerst hoor je ze
   aankomen, dan pas staan ze er.
  */
  function latenUitstappen() {
    if (schutters || !aanrijders.length) return;
    const posten = [];
    for (const a of aanrijders) {
      const zx = a.zij.x, zz = a.zij.z;
      for (let j = 0; j < BOM_MANNEN / BOM_AUTOS; j++) {
        const langs = j ? 1.7 : -1.7;          // voor- en achterportier
        const px = a.auto.x + zx * 2.2 + Math.cos(a.auto.yaw) * langs;
        const pz = a.auto.z + zz * 2.2 - Math.sin(a.auto.yaw) * langs;
        const [mx, mz] = resolveCollisions(px, pz, 0.4);
        posten.push({ a: [mx, mz], b: [mx + zx * 4, mz + zz * 4] });
      }
    }
    schutters = new Bewaking(scene, posten);
    schutters.alarm = true;            // ze komen voor jou, ze hoeven niets te zien
    // zes man die het vuur openen op een parkeerterrein: wie er loopt gaat weg
    if (paniek) paniek(aanrijders[0].auto.x, aanrijders[0].auto.z, BOM_PANIEK * 0.6);
    for (const w of schutters.wachters) w.staat = 'aanval';
    // Mark trekt zijn pistool, en jij kunt de jouwe in elk geval pakken: zonder
    // wapen is dit geen gevecht maar een executie
    mark.geefWapen('pistool');
    geefWapen();
  }

  /*
   Wat een neergelegde schutter laat liggen: zijn pistool, met wat er nog in
   zit (verzoek 21 sep 2026). Je kunt het oppakken en gebruiken — heb je zelf
   al een pistool, dan houd je dat en gaan alleen de kogels in je voorraad
   (js/main.js). Elke man laat er één keer iets vallen, of hij nu door jou of
   door Mark is neergehaald.
  */
  function buitVanSchutters() {
    if (!schutters || !laatVallen) return;
    for (const w of schutters.wachters) {
      if (w.staat !== 'neer' || gevallen.has(w)) continue;
      gevallen.add(w);
      const p = w.persoon.groep.position;
      laatVallen('pistool', p.x, p.z, BOM_BUIT_KOGELS[0]
        + Math.floor(Math.random() * (BOM_BUIT_KOGELS[1] - BOM_BUIT_KOGELS[0] + 1)));
    }
  }

  /*
   Mark schiet mee. Hij kan niet neergaan — hij staat in geen enkele doellijst —
   maar hij staat er ook niet werkeloos bij: hij vuurt op de dichtstbijzijnde
   man en haalt er af en toe een neer, zodat het gevecht nooit vastloopt op een
   laatste vijand die achter een auto blijft hangen.
  */
  function markVuurt(dt) {
    if (!schutters) return;
    const over = schutters.wachters.filter(w => w.staat !== 'neer');
    if (!over.length) return;
    const mp = mark.groep.position;
    let doel = null, dBest = Infinity;
    for (const w of over) {
      const p = w.persoon.groep.position;
      const d = Math.hypot(p.x - mp.x, p.z - mp.z);
      if (d < dBest) { dBest = d; doel = w; }
    }
    if (!doel) return;
    mark.kijkNaar(doel.persoon.groep.position.x, doel.persoon.groep.position.z, dt, 7);
    mark.update(dt, { mikt: true });
    markVuurT -= dt;
    if (markVuurT > 0) return;
    markVuurT = 0.7 + Math.random() * 0.6;
    mark.vuur();
    geluid.schot();
    // ongeveer één op de zes schoten is raak; met zes man duurt dat lang genoeg
    if (Math.random() < 0.17 && dBest < 45) schutters.raak(doel.persoon.groep);
  }

  function werkBomBij(dt, sp) {
    if (fase === 'klaar') return;
    const huis2 = huis;                 // het pand Molenkrite 15 uit de kaart
    const woning = wieken && wieken();  // de binnenruimte aan de Wieken
    const winkel = poiesz && poiesz();
    const binnenHuis = woning && woning.binnen ? woning.binnen(sp.x, sp.z) : false;
    const binnenWinkel = winkel && winkel.binnen ? winkel.binnen(sp.x, sp.z) : false;
    if (fase !== 'wacht' && fase !== 'gesprek') {
      navKlok += dt;
      if (navKlok > 2) { navKlok = 0; werkNavBij(); }
    }

    // -- binnen bij de Wieken: Mark zit op de bank en begint te praten
    if (fase === 'wacht') {
      if (!binnenHuis) return;
      const bank = woning.plekken ? woning.plekken.bank : null;
      if (bank) mark.zetNeer(bank.x, bank.z, kijkHoek(bank, { x: sp.x, z: sp.z }));
      markZichtbaar(true);
      fase = 'gesprek';
      hud.zetNavigatie(null); navDoel = null;
      zetOpdracht('');
      zeg(BOM_BINNEN, () => {
        fase = 'instappen'; zetPunt(fase);
        zetBomAutoNeer();
        markZichtbaar(false);          // hij loopt vast naar de auto
        spanning = true; spanningUit = 0;
        zeg(BOM_INSTAPPEN, () => {
          zetOpdracht('rij met Mark naar de Poiesz in Duinterpen');
          const ing = winkelIngang();
          if (ing) zetNavDoel(ing.stoep.x, ing.stoep.z, 'Poiesz Duinterpen', 'M');
        });
      });
      return;
    }
    if (fase === 'gesprek') {
      // hij zit te praten: laat hem gehurkt op de bank zitten
      mark.update(dt, { hurkt: 0.85 });
      return;
    }

    // -- rijden naar Duinterpen
    if (fase === 'instappen') {
      const ing = winkelIngang();
      if (!ing) return;
      const d = Math.hypot(sp.x - ing.stoep.x, sp.z - ing.stoep.z);
      const staat = !player.inCar || Math.abs(player.inCar.speed || 0) < 1.5;
      if (d < BOM_PARKEER && staat && balk.hidden) {
        fase = 'planten'; zetPunt(fase);
        hud.zetNavigatie(null); navDoel = null;
        // Mark stapt uit en wacht bij de deur
        const naast = { x: ing.stoep.x + ing.f[0] * 3.5, z: ing.stoep.z + ing.f[1] * 3.5 };
        const [mx, mz] = resolveCollisions(naast.x, naast.z, 0.4);
        mark.zetNeer(mx, mz, kijkHoek({ x: mx, z: mz }, ing.deur));
        markZichtbaar(true);
        zeg(BOM_BIJ_WINKEL, () => {
          zetOpdracht('ga naar binnen en plant de bom bij de schappen');
          const plek = bomPlek();
          if (plek && bomMerk) { bomMerk.zet(plek.x, 0, plek.z); bomMerk.toon(true); }
        });
      }
      return;
    }

    // -- binnen: de bom bij de schappen planten
    if (fase === 'planten') {
      const plek = bomPlek();
      if (!plek) return;
      const bij = binnenWinkel && Math.hypot(sp.x - plek.x, sp.z - plek.z) < BOM_PLANT_BEREIK;
      praatEl.textContent = 'E — de bom planten';
      praatEl.hidden = !(bij && balk.hidden && (player.active || window.__autoplay));
      return;
    }

    // -- weer naar buiten, naar Mark
    if (fase === 'naarbuiten') {
      if (binnenWinkel || !balk.hidden) return;
      const dMark = afst(sp, mark.groep.position);
      if (dMark > 26) return;
      fase = 'knal';
      bomT = 0;
      zetOpdracht('');
      hud.zetNavigatie(null); navDoel = null;
      zeg(BOM_AFGAAN, null, { auto: 2.2 });
      return;
    }

    // -- de ontploffing, en wat daarop volgt
    if (fase === 'knal') {
      bomT += dt;
      if (bomT > 2.4 && !knal) {
        const ing = winkelIngang();
        // de knal is buiten te zien: op de gevel, niet in de kamer die ruim
        // buiten het kaartgebied staat
        const px = ing ? ing.deur.x : sp.x, pz = ing ? ing.deur.z : sp.z;
        knal = ontplofBij(scene, px, 0, pz);
        if (bomPakket) bomPakket.toon(false);
        geluid.explosie(Math.hypot(sp.x - px, sp.z - pz));
        if (schokken) schokken(0.9);
        // een pand gaat de lucht in: iedereen binnen zeventig meter rent weg
        if (paniek) paniek(px, pz, BOM_PANIEK);
      }
      if (bomT > 4.6 && balk.hidden) {
        fase = 'aanval';
        bomT = 0;
        zeg(BOM_PERFECT, () => {
          // ze komen aanrijden terwijl Mark praat; uitstappen doen ze pas
          // daarna (zie de fase 'aanval' hieronder)
          latenAanrijden(sp);
          zeg(BOM_ALARM, null, { auto: 2.6 });
        }, { auto: 2.4 });
      }
      return;
    }

    /*
     De aanrit. Hier wordt op twee dingen tegelijk gewacht: de auto's moeten
     stilstaan en Mark moet uitgesproken zijn. Pas dan stappen ze uit — dat is
     precies de volgorde die de scène spannend maakt.
    */
    if (fase === 'aanval') {
      const stil = werkAanrijdersBij(dt, sp);
      if (!stil || !balk.hidden || !aanrijders.length) return;
      latenUitstappen();
      fase = 'vuurgevecht'; zetPunt(fase);
      zetOpdracht(`schakel ze uit (${schutters ? schutters.aantal : 0} te gaan)`, true);
      return;
    }

    // -- het vuurgevecht
    if (fase === 'vuurgevecht') {
      markVuurt(dt);
      buitVanSchutters();
      if (schutters && !schutters.alleNeer) {
        zetOpdracht(`schakel ze uit (${schutters.aantal - schutters.neer} te gaan)`, true);
        return;
      }
      if (!balk.hidden) return;
      fase = 'vluchten'; zetPunt(fase);
      mark.bergWapen();                   // het gevecht is voorbij
      if (sterGeven) sterGeven(BOM_STERREN, sp.x, sp.z);
      const b = bos();
      zeg(BOM_POLITIE, () => {
        zetOpdracht('schud de politie af in het Tinga-bos');
        if (b) zetNavDoel(b.x, b.z, 'Tinga-bos', 'M');
      });
      return;
    }

    /*
     Vanaf hier rijdt Mark met je mee. Hij loopt niet naar de auto en stapt
     niet in — dat is een animatie die niets toevoegt en alles kan misgaan als
     jij intussen wegrijdt. Zodra je achter het stuur zit is hij uit beeld
     (verzoek 21 sep 2026: "laat Mark verwijderen als je in een auto instapt");
     bij de Molenkrite staat hij weer naast je als hij uitstapt.
    */
    if (fase === 'vluchten' || fase === 'thuisbrengen') {
      if (player.inCar && mark.groep.visible) markZichtbaar(false);
      else if (!player.inCar && !mark.groep.visible) {
        // stap je onderweg uit, dan stapt hij mee uit en staat hij naast je
        const [mx, mz] = resolveCollisions(sp.x + 1.8, sp.z + 1.8, 0.4);
        mark.zetNeer(mx, mz, kijkHoek({ x: mx, z: mz }, sp));
        markZichtbaar(true);
      }
    }

    // -- de politie afschudden in het bos
    if (fase === 'vluchten') {
      if (!inHetBos(sp.x, sp.z)) return;
      fase = 'thuisbrengen'; zetPunt(fase);
      if (sterrenWeg) sterrenWeg();
      hud.zetNavigatie(null); navDoel = null;
      zeg(BOM_BOS, () => {
        zetOpdracht('breng Mark terug naar Molenkrite 15');
        const t = voorPunt(huis2, 6);
        zetNavDoel(t.x, t.z, 'Molenkrite 15', 'M');
      });
      return;
    }

    // -- en terug naar de Molenkrite
    if (fase === 'thuisbrengen') {
      const t = voorPunt(huis2, 6);
      const d = Math.hypot(sp.x - t.x, sp.z - t.z);
      const staat = !player.inCar || Math.abs(player.inCar.speed || 0) < 1.5;
      if (d > BOM_THUIS_BEREIK || !staat || !balk.hidden) return;
      fase = 'afronding';
      zetOpdracht('');
      hud.zetNavigatie(null); navDoel = null;
      const [mx, mz] = resolveCollisions(t.x + 1.8, t.z + 1.8, 0.4);
      mark.zetNeer(mx, mz, kijkHoek({ x: mx, z: mz }, { x: sp.x, z: sp.z }));
      markZichtbaar(true);
      zeg(BOM_THUIS, () => {
        verdien(BOM_BELONING);
        missie = 'klaar'; fase = 'klaar';
        spanningUit = 6;
        // een minuut later belt Johan met de volgende klus (missie 8)
        naMissieNaam = 'sniper';
        naMissieT = SNIP_WACHT;
        hud.melding('MISSIE VOLTOOID – DE BOM',
          `Beloning: + ${euro(BOM_BELONING)} toegevoegd aan wallet`, 8);
      });
    }
  }

  /*
   Missie 6 per beeld. Vier stappen: de auto ophalen (dat kost je een ster), hem
   laten overspuiten bij de wasbox achter de BP, hem naar IJlst rijden en hem
   naast Mark parkeren. De kaart wijst steeds het volgende doel aan.
  */
  function werkBXBij(dt, sp) {
    if (fase === 'wacht') {
      // de hint boven de M: dit is dezelfde regel als bij Molenkrite 15
      const bezig = player.active || window.__autoplay;
      praatEl.textContent = 'E — praten';
      praatEl.hidden = !(bezig && afst(sp, mark.groep.position) < PRAAT_AFSTAND && balk.hidden);
      return;
    }
    if (fase === 'briefing' || fase === 'klaar') return;
    navKlok += dt;
    if (navKlok > 2) { navKlok = 0; werkNavBij(); }

    if (fase === 'ophalen') {
      if (!bxAuto) return;
      if (player.inCar === bxAuto) {
        /*
         Je stapt in een auto die niet van jou is, op een parkeerterrein waar
         mensen lopen. Dat is één ster — niet afhankelijk van of iemand het ziet
         (verzoek 20 sep 2026), want het hoort bij de missie.
        */
        if (!bxGestolen) {
          bxGestolen = true;
          if (sterGeven) sterGeven(1, bxAuto.x, bxAuto.z);
          // en in deze auto staat Radio Spannenburg op
          geluid.zetZender('Spannenburg');
        }
        fase = 'spuiten';
        const bp = (KAART.tankstations || [])[0];
        zetOpdracht('laat de BX overspuiten bij de wasbox achter de BP');
        if (bp) zetNavDoel(bp.x ?? bp.cx, bp.z ?? bp.cz, 'BP Slump Oil', 'S');
      }
      return;
    }

    if (fase === 'spuiten') {
      // De spuiterij (js/spuiterij.js) doet het werk; hier kijken we alleen of
      // hij een andere kleur heeft gekregen. Welke kleur dat wordt kiest het
      // spel, niet de speler.
      if (bxAuto && bxAuto.kleur !== BX_GROEN) {
        fase = 'wegbrengen';
        const plek = bxAfleverPlek();
        zetOpdracht('breng de BX naar het parkeerterrein van de Poiesz in IJlst');
        if (plek) {
          zetNavDoel(plek.x, plek.z, 'Poiesz IJlst', 'M');
          // Mark staat daar te wachten; hij is intussen naar IJlst gereden
          const naast = { x: plek.x - Math.sin(plek.yaw + Math.PI / 2) * BX_MARK_NAAST,
            z: plek.z - Math.cos(plek.yaw + Math.PI / 2) * BX_MARK_NAAST };
          const [mx, mz] = resolveCollisions(naast.x, naast.z, 0.4);
          mark.zetNeer(mx, mz, kijkHoek({ x: mx, z: mz }, plek));
          markZichtbaar(true);
        }
      }
      return;
    }

    if (fase === 'wegbrengen') {
      const plek = bxAfleverPlek();
      if (!bxAuto || !plek) return;
      const d = Math.hypot(bxAuto.x - plek.x, bxAuto.z - plek.z);
      const staat = Math.abs(bxAuto.speed || 0) < 1.2;
      const erbij = player.inCar === bxAuto || afst(sp, bxAuto) < 12;
      if (d < BX_PARKEER && staat && erbij && balk.hidden) {
        fase = 'afronding';
        zetOpdracht('');
        hud.zetNavigatie(null); navDoel = null;
        zeg(BX_EINDE, () => {
          verdien(BX_BELONING);
          missie = 'klaar'; fase = 'klaar';
          spanningUit = 6;                 // de muziek loopt over de melding heen uit
          hud.melding('MISSIE VOLTOOID – DE GROENE BX',
            `Beloning: + ${euro(BX_BELONING)} toegevoegd aan wallet`, 8);
          // en hij rijdt weg met de auto — zodra je even niet kijkt
          weg.mark = true;
          weg.bx = true;
          // de volgende klus staat straks als M bij je eigen voordeur
          naMissieNaam = 'bom';
          naMissieT = 8;
        });
      }
      return;
    }
  }

  /*
   ---- herstelpunten binnen een missie ----

   Ga je neer, dan begon de missie helemaal opnieuw. Bij de korte missies is dat
   geen straf, maar missie 7 en 8 duren tien minuten: bij de laatste rit
   opnieuw beginnen bij het eerste gesprek is geen uitdaging maar een boete
   (verzoek 22 sep 2026). Elke fase die begint zet daarom een punt, en na het
   neergaan hervat het spel bij die fase in plaats van bij het begin.

   Het punt is geen opgeslagen wereld maar een naam: de missie bouwt de fase
   opnieuw op met dezelfde functies die hem de eerste keer opzetten. Dat is
   minder werk en het kan niet uit de pas lopen met wat de missie zelf doet.
  */
  let punt = null;               // { missie, fase }
  function zetPunt(f) {
    if (!f) return;
    punt = { missie, fase: f };
  }

  /*
   Missie 7 opnieuw opzetten vanaf een fase. Elke stap bouwt voort op de vorige,
   dus 'planten' krijgt ook de auto en de opdracht van 'instappen' mee.
  */
  function hervatBom(f) {
    beginBom();
    if (f === 'wacht' || f === 'gesprek') return;

    // het gesprek op de bank is geweest: de auto staat voor de deur
    fase = 'instappen';
    zetBomAutoNeer();
    markZichtbaar(false);
    spanning = true; spanningUit = 0;
    zetOpdracht('rij met Mark naar de Poiesz in Duinterpen');
    const ing = winkelIngang();
    if (ing) zetNavDoel(ing.stoep.x, ing.stoep.z, 'Poiesz Duinterpen', 'M');
    if (f === 'instappen') return;

    // bij de winkel: Mark wacht bij de deur en de plek bij de schappen licht op
    if (!ing) return;
    fase = 'planten';
    hud.zetNavigatie(null); navDoel = null;
    const naast = { x: ing.stoep.x + ing.f[0] * 3.5, z: ing.stoep.z + ing.f[1] * 3.5 };
    const [mx, mz] = resolveCollisions(naast.x, naast.z, 0.4);
    mark.zetNeer(mx, mz, kijkHoek({ x: mx, z: mz }, ing.deur));
    markZichtbaar(true);
    zetOpdracht('ga naar binnen en plant de bom bij de schappen');
    const plek = bomPlek();
    if (plek && bomMerk) { bomMerk.zet(plek.x, 0, plek.z); bomMerk.toon(true); }
    if (f === 'planten') return;

    // de bom ligt er al
    fase = 'naarbuiten';
    if (bomMerk) bomMerk.toon(false);
    if (plek && bomPakket) { bomPakket.zet(plek.x, 0, plek.z, 0); bomPakket.toon(true); }
    zetOpdracht('naar buiten, Mark wacht op je');
    if (f === 'naarbuiten' || f === 'knal' || f === 'aanval') return;

    /*
     Het vuurgevecht opnieuw. Je begint bij de ingang en niet waar je neerging:
     de zes man worden om die ingang heen opgebouwd, en midden tussen hen in
     wakker worden is geen herstart maar een executie.
    */
    player.inCar = null;
    player.pos.set(ing.stoep.x, 0, ing.stoep.z);
    player.applyCamera();
    if (bomPakket) bomPakket.toon(false);
    const sp = spelerPunt();
    latenAanrijden(sp);
    for (const a of aanrijders) {           // ze staan er al, dus meteen op hun plek
      a.auto.x = a.doel.x; a.auto.z = a.doel.z; a.auto.speed = 0; a.stil = true;
      if (a.auto.mesh) a.auto.mesh.position.set(a.auto.x, a.auto.mesh.position.y, a.auto.z);
    }
    latenUitstappen();
    if (f === 'vuurgevecht') {
      fase = 'vuurgevecht';
      zetOpdracht(`schakel ze uit (${schutters ? schutters.aantal : 0} te gaan)`, true);
      return;
    }

    // en de twee laatste etappes: wegwezen en Mark thuisbrengen
    ruimBomOp();
    markZichtbaar(true);
    const mp = voorPunt(huis, 6);
    if (f === 'vluchten') {
      fase = 'vluchten';
      if (sterGeven) sterGeven(BOM_STERREN, player.pos.x, player.pos.z);
      zetOpdracht('schud de politie af in het Tinga-bos');
      const b = bos();
      if (b) zetNavDoel(b.x, b.z, 'Tinga-bos', 'M');
      return;
    }
    fase = 'thuisbrengen';
    zetOpdracht('breng Mark terug naar Molenkrite 15');
    zetNavDoel(mp.x, mp.z, 'Molenkrite 15', 'M');
  }

  /*
   Missie 8 opnieuw opzetten. Drie etappes: naar Johan, de tocht naar de molen
   (daar hoort het kijken en het schieten bij, want dat is één scène), en de
   terugtocht. Je begint elke etappe aan de Geeuwkade, want daar ligt de boot.
  */
  function hervatSniper(f) {
    ruimSniperOp();
    spanning = true; spanningUit = 0;
    const kade = geeuwKade();
    if (f === 'telefoon' || f === 'kopen' || f === 'naar_johan' || f === 'briefing') {
      const heeft = player.wapens.includes('sniper');
      fase = heeft ? 'naar_johan' : 'kopen';
      if (heeft) {
        zetOpdracht('ga naar Johan bij de Geeuwkade achter de waterzuivering');
        const p = johanBijDeBoot();
        if (p) zetNavDoel(p.x, p.z, 'Johan bij de Geeuw', 'J');
      } else {
        zetOpdracht('koop een sniper bij Tinga State');
        const pand = pandVan(SNIP_WINKEL);
        const v = pand ? voorPunt(pand, 7.5) : null;
        if (v) zetNavDoel(v.x, v.z, 'Tinga State', 'M');
      }
      return;
    }
    // vanaf hier ben je bijgepraat: terug naar de kade en opnieuw uitvaren
    player.inCar = null;
    const [kx, kz] = resolveCollisions(kade.x, kade.z, 0.4);
    player.pos.set(kx, 0, kz);
    player.applyCamera();
    if (johan) johan.groep.visible = false;
    if (f === 'terug' || f === 'afronding') {
      fase = 'terug';
      zetOpdracht('terug naar de kade aan de Geeuw');
      zetNavDoel(kade.x, kade.z, 'Geeuwkade', 'M');
      return;
    }
    fase = 'varen';
    const plek = zoekSnipPlek();
    zetOpdracht('vaar met de sloep naar de molen in IJlst en blijf in de gele cirkel');
    if (plek) {
      if (!snipRing) snipRing = maakWaterRing(scene, SNIP_RING);
      snipRing.zet(plek.boot.x, plek.boot.z);
      snipRing.toon(true);
      zetNavDoel(plek.boot.x, plek.boot.z, 'De Rat, IJlst', 'M');
    }
  }

  // ---------- per beeld ----------
  function update(dt) {
    // Het spannende deuntje loopt precies zolang de achtervolging duurt: het
    // stopt als je hem pakt, als je hem neerschiet en als je neergaat.
    geluid.jacht(missie === 'johan' && fase === 'achtervolging' && doodT <= 0 && misluktT <= 0);
    // En de muziek onder de missie: die loopt nog een paar tellen door over
    // MISSION COMPLETED heen en dooft daarna uit (zie geluid.missiemuziek).
    if (spanningUit > 0) {
      spanningUit -= dt;
      if (spanningUit <= 0) spanning = false;
    }
    geluid.missiemuziek(spanning && doodT <= 0 && misluktT <= 0);
    // Mark die zelf begint (zie beginGesprek): even wachten tot het beeld staat
    // en de speler zijn handen aan de muis heeft, en dan praat hij.
    if (startPraatT > 0) {
      startPraatT -= dt;
      if (startPraatT <= 0) {
        startPraatT = -1;
        if (missie === 'molenkrite' && fase === 'wacht' && balk.hidden && !gesprek) {
          fase = 'gesprek';
          zeg(GESPREK1, () => { fase = 'loopt'; zetOpdracht('ga met Mark mee'); });
        }
      }
    }
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
      if (naMissieT <= 0) startMissie(naMissieNaam);
    }
    // een regel die zichzelf wegklikt (wat er tijdens het rennen geroepen wordt)
    if (gesprek && gesprek.auto) {
      gesprek.autoT -= dt;
      if (gesprek.autoT <= 0) verderInGesprek();
    }
    ruimOpUitZicht();       // Mark en de BX verdwijnen als je je omdraait
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
            zeg(BEVEL, () => {
              fase = 'opdracht';
              zetOpdracht(`${BEVEL[0]} (${teGaan()} te gaan)`);
              /*
               Hier krijgt Erik zijn wapen. Tot dit moment loopt hij met lege
               handen rond (js/main.js zet `wapenSlot` bij een nieuw spel), en
               dit is het eerste moment waarop je hem nodig hebt — dus ook het
               moment om uit te leggen hoe hij werkt (verzoek 20 sep 2026).
              */
              geefWapen();
            });
          } else if (balk.hidden) zetOpdracht('ga met Mark mee');
        }
      } else {
        mark.kijkNaar(sp.x, sp.z, dt, 2);
        mark.update(dt, {});
      }
    } else if (missie === 'bx' && mark.groep.visible) {
      /*
       Bij de BX staat hij twee keer te wachten: onder de M bij Tinga State en
       op het parkeerterrein in IJlst. Allebei de keren zwaait hij als je in
       zicht komt — net als aan het begin van het spel voor Molenkrite 15. Als
       de auto er eenmaal staat kijkt hij naar de auto en niet meer naar jou:
       "Mooie kleur trouwens."
      */
      const naarAuto = fase === 'afronding' && bxAuto;
      if (naarAuto) mark.kijkNaar(bxAuto.x, bxAuto.z, dt, 2);
      else mark.kijkNaar(sp.x, sp.z, dt, 2);
      mark.update(dt, { zwaait: !naarAuto && (fase === 'wacht' || fase === 'wegbrengen') && dMark < ZWAAI_AFSTAND });
      hinder.opWeg = false;
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
        if (fase === 'instappen') {
          fase = 'onderweg';
          // portier dicht, muziek aan: vanaf hier tot het afleveren van de
          // vrachtwagen speelt er een fragment onder (verzoek 20 sep 2026)
          spanning = true; spanningUit = 0;
        }
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
          /*
           Uit de auto stap je in de eerste persoon. Reed je met de camera over
           je schouder, dan stond je daarna als poppetje op het terrein te
           kijken; dit is het moment waarop het spel weer van jou wordt (melding
           20 sep 2026).
          */
          if (eersteP) eersteP();
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

    // ---- missie 6: de groene BX ----
    if (missie === 'bx') werkBXBij(dt, sp);

    // ---- missie 8: de deal bij de molen ----
    if (missie === 'sniper') werkSniperBij(dt, sp);
    if (snipRing) snipRing.update(dt);
    if (deal) deal.update(dt, bootPunt());
    for (const b of snipBoten) {
      const schade = b.update(dt);
      if (schade > 0 && player.active) {
        player.health = Math.max(0, player.health - schade);
        hud.zetLeven(player.health);
        hud.flits();
        if (player.health <= 0) dood();
      }
    }

    // ---- missie 7: de bom ----
    if (missie === 'bom') werkBomBij(dt, sp);
    if (schutters) {
      const schade = schutters.update(dt, player, true);
      if (schade > 0 && player.active) {
        player.health = Math.max(0, player.health - schade);
        hud.zetLeven(player.health);
        hud.flits();
        if (player.health <= 0) dood();
      }
    }
    if (bomMerk) bomMerk.update(dt);
    if (bomPakket) bomPakket.update(dt);
    if (knal) { knal.update(dt); if (knal.klaar) knal = null; }

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
      bx: bxAuto ? { x: bxAuto.x, z: bxAuto.z, yaw: bxAuto.yaw, kleur: bxAuto.kleur, gestolen: bxGestolen } : null,
    };
  }

  function herstel(s) {
    if (!s) return;
    gesprek = null; sluitBalk(); praatEl.hidden = true;
    doodT = 0;
    missie = s.missie || 'molenkrite';
    fase = s.fase || 'wacht';
    if (fase === 'gesprek' || fase === 'briefing') { fase = 'wacht'; missie = 'molenkrite'; }
    /*
     Missie 7 heeft een winkel vol losse toestand (de bende, de bom, de knal).
     Die wordt niet in de opslag gestopt maar opnieuw opgezet: je begint hem
     weer bij de M aan de Wieken. Dat is eerlijker dan half herstellen.
    */
    if (missie === 'bom' && fase !== 'klaar') { beginBom(); return; }
    // Een opgeslagen spel middenin de rit begint ook weer met muziek eronder.
    spanning = (missie === 'rijden' && fase !== 'instappen') || missie === 'bewaking' || missie === 'afleveren'
      || (missie === 'bx' && fase !== 'wacht' && fase !== 'briefing' && fase !== 'klaar')
      || (missie === 'bom' && fase !== 'wacht' && fase !== 'gesprek' && fase !== 'klaar');
    spanningUit = 0;
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
    /*
     De BX uit missie 6. Hij staat niet in de kaart, dus hij wordt bij het laden
     opnieuw neergezet — in de kleur die hij op dat moment had, want misschien
     was hij al overgespoten.
    */
    if (s.bx) {
      bxGestolen = !!s.bx.gestolen;
      if (!bxAuto) bxAuto = vehicles.voegToe({ x: s.bx.x, z: s.bx.z, yaw: s.bx.yaw, soort: 'bx', kleur: s.bx.kleur ?? BX_GROEN });
      else {
        bxAuto.x = s.bx.x; bxAuto.z = s.bx.z; bxAuto.yaw = s.bx.yaw; bxAuto.speed = 0;
        bxAuto.mesh.position.set(s.bx.x, 0, s.bx.z); bxAuto.mesh.rotation.y = s.bx.yaw;
      }
      if (bxAuto.kleur !== (s.bx.kleur ?? BX_GROEN)) vehicles.verf(bxAuto, s.bx.kleur ?? BX_GROEN);
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
    geld = typeof s.geld === 'number' ? s.geld : START_GELD;
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
    beginGesprek,
    /*
     Wat het overspuiten kost. De wasbox achter de BP (js/spuiterij.js) rekent
     normaal honderd euro per ster; de BX uit missie 6 gaat voor een vast bedrag
     over de kop, ook zonder sterren — dat is precies het geld dat Mark je
     meegaf. Levert null als het om een gewone auto gaat, en dan telt de prijs
     van de spuiterij zelf.
    */
    spuitPrijs: (auto) => (missie === 'bx' && auto && auto === bxAuto ? BX_SPUIT : null),
    /*
     Twee haakjes voor een missie die buiten dit bestand draait (js/vaart.js, de
     lading over het water): de opdrachtregel in beeld en de gespreksbalk. Ze
     horen bij het verhaal en niet bij de HUD — de balk weet van telefoontjes, van
     "E — verder" en van hoe hij weer dichtgaat — dus ze worden hier gedeeld in
     plaats van nagebouwd.
    */
    zetOpdracht,
    zegLosse: (regels) => zeg(regels),
    get missie() { return missie; },
    get fase() { return fase; },
    get buurman() { return mark; },      // oude naam, gebruikt door de testtools
    get mark() { return mark; },
    get bewaking() { return bewaking; },
    get dief() { return dief; },
    get johan() { return johan; },
    betaal, verdien,
    get geld() { return geld; },
    get buit() { return buit; },
    get truck() { return truck; },
    get auto() { return vluchtauto; },
    get bx() { return bxAuto; },
    get schutters() { return schutters; },
    get schutterAutos() { return schutterAutos; },
    // missie 8
    get deal() { return deal; },
    get snipPlek() { return zoekSnipPlek(); },
    get snipRing() { return snipRing; },
    get snipBoten() { return snipBoten; },
    get johanPersoon() { return johan; },
    get bomPlek() { return bomPlek(); },
    get bomGeplant() { return !!(bomPakket && bomPakket.zichtbaar); },
    get bomAuto() { return bomAuto; },
    get knalBezig() { return !!knal; },
    get bos() { return bos(); },
    get bxPlek() { return bxAfleverPlek(); },
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
      const bijMark = afst(spelerPunt(), mark.groep.position) < PRAAT_AFSTAND && mark.groep.visible;
      /*
       Ook waar als het verhaal zelf de E-toets nodig heeft. Bij de schappen in
       Duinterpen staat de bom op dezelfde plek als het bier: E plantte de bom
       (js/verhaal.js gaat voor in `praatOfAuto`) maar in beeld stond nog
       "E — flesje bier kopen". De binnenruimte laat haar eigen hint weg zodra
       dit waar is.
      */
      const bijBom = missie === 'bom' && fase === 'planten' && (() => {
        const plek = bomPlek();
        if (!plek) return false;
        const sp = spelerPunt();
        return Math.hypot(sp.x - plek.x, sp.z - plek.z) < BOM_PLANT_BEREIK;
      })();
      return !balk.hidden
        || bijBom
        || (missie === 'molenkrite' && fase === 'wacht' && bijMark)
        || (missie === 'bx' && fase === 'wacht' && bijMark);
    },
    // testhaak (tools/introtest.mjs): het moment waarop Erik zijn wapen krijgt
    __geefWapen: geefWapen,
    /*
     Een missie los starten. Dit is geen testhaak meer maar onderdeel van het
     spel zolang het in de testfase zit: js/main.js hangt er de toetsen
     shift+1 … shift+7 en `?missie=` aan. `__startMissie` blijft staan voor de
     gereedschappen die er al gebruik van maken.
    */
    startMissie,
    __startMissie: startMissie,
  };
}
