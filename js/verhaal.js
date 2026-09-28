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
import { maakWaterRing, maakDeal, maakVeteraan } from './deal.js';
import { maakTas } from './tas.js';
import { zoekLooppad } from './looppad.js';
import { initBendes } from './bendes.js';
import { LIGPLAATSEN } from './boot.js';
import { initPolitieboot } from './politieboot.js';
import { Dief } from './dief.js';
import { euro, tekenKop } from './hud.js';
import { brugAssen, maakDranghek, maakC4, maakSchade } from './brug.js';
import { maakSchrift, maakLint } from './schrift.js';
import { initRace } from './race.js';
import { initSchaduw } from './schaduw.js';
import { initKlusjes } from './klusjes.js';
import { grondHoogte } from './viaduct.js';
import { INVAL, vluchtLijn, nieuweVlucht, rijdVlucht, invalRoute as invalRouteJs } from './inval.js';
import { UNIFORM, zetZwaailamp } from './politie.js';
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
  // olijfgroen uniform, pet en een volle grijze baard, net als op de kade
  veteraan: { huid: '#d9b48f', shirt: '#4a5236', pet: '#3c4230', baard: '#5a5148' },
  // missie 14: Ronald in zijn blauwe overall, blond; Bouwman in burger, grijzend
  ronald: { huid: '#e0b893', haar: '#c9a66b', shirt: '#2d3f63', stoppels: true },
  bouwman: { huid: '#d6ab86', haar: '#8d8a84', shirt: '#4b4f55' },
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

/*
 ---------- missie 9: een eigen stek ----------

 Een korte tussenmissie. Het geld loopt aardig op en Erik woont nog steeds in
 een rijtjeshuis van tweeënzestig vierkante meter; De Veteraan heeft drie
 panden waar hij over gaat en biedt ze aan tegen sleutelgeld en een lage huur.
 Je bekijkt ze met Mark en kiest er een. Heb je het geld niet, dan blijft de
 missie openstaan en kun je later terugkomen (verzoek 22 sep 2026).

 De woningen zelf staan in js/interieur.js — daar komen ook de prijzen vandaan.
*/
const HUIS_WACHT = 55;              // zoveel seconden na de deal belt Mark
const HUIS_THUIS = { straat: 'de Wieken', nr: '29' };   // daar staat hij te wachten
const HUIS_DICHTBIJ = 55;           // zo dicht bij een woning staat Mark er ook
const HUIS_TELEFOON = [
  zegtMark('Erik! Heb je het gezien? Het loopt lekker door, dat geld van ons.'),
  zegtMark('De Veteraan heeft drie panden in de wijk waar hij over gaat. Sleutelgeld eenmalig, daarna een huur waar je om moet lachen.'),
  zegtMark('Jij woont nog steeds in dat hok. Kom even naar de Wieken, dan lopen we ze langs.'),
];
const HUIS_BRIEFING = [
  zegtMark('Drie stuks. Alle drie een stuk groter dan dit.'),
  zegtMark('<b>1</b> — Zeskanter 16. De dure: vrijstaand, negen bij twintig. € 5.000 sleutelgeld.'),
  zegtMark('<b>2</b> — Molenkrite 130c. Een brede bungalow, achttien meter breed. € 2.500.'),
  zegtMark('<b>3</b> — Koningsspil 20. Diep en rustig. € 1.000, en nog steeds twee keer dit.'),
  zegtMark('Zeg maar waar we eerst gaan kijken: druk op <b>1</b>, <b>2</b> of <b>3</b>. '
    + 'Ze staan alle drie op je kaart, en binnen aan tafel zeg je het maar.'),
];
const HUIS_ALLEDRIE = [
  zegtMark('Zo, je hebt ze alle drie gezien.'),
  zegtMark('Denk er rustig over na. Ze blijven op je kaart staan en De Veteraan loopt niet weg — '
    + 'loop naar binnen en ga aan tafel zitten zodra je eruit bent.'),
];
const HUIS_BIJ = {
  luxe: [zegtMark('Kijk, dít is wat ik bedoel. Hier geef je een feestje.')],
  middel: [zegtMark('Deze is van ons drieën de verstandigste. Ruim, en je houdt geld over.')],
  gewoon: [zegtMark('Niks mis mee. Voor dat geld woon je nergens zo.')],
};
const HUIS_ARM = [
  zegtMark('Zoveel heb je nog niet, broeder.'),
  zegtMark('Hij loopt niet weg. Kom terug als je het hebt, dan tekenen we.'),
];
const HUIS_KLAAR = [
  zegtMark('Gefeliciteerd. De sleutels liggen binnen.'),
  zegtMark('Vanaf nu is dit jouw stek. Zet je auto maar voor de deur.'),
];

/*
 ---------- missie 10: De Veteraan ----------

 Na het kopen van een huis belt De Veteraan zelf (verzoek 23 sep 2026). Hij
 staat met zijn hondje op het Sneekerpad, het fietspad tussen Sneek en IJlst,
 bij het kleine molentje: De Terpensmole, de spinnenkop uit `KAART.molens`. Hij
 bedankt je voor de molen in IJlst en stuurt je om een tas die bij de tribune
 van VV Sneek wordt afgeleverd. Dan wordt het zwart: "Enkele uren later" sta je
 om één uur 's nachts voor je eigen huis (verzoek 26 sep 2026). Pak je de tas op,
 dan rijden er vier auto's de weg voor het sportpark op en stappen er tien man
 uit. Die komen het veld niet op: ze gaan rond de ingang staan en wachten je daar
 op. Na het vuurgevecht is De
 Veteraan weg van het pad en belt Mark: hij heeft je laten omleggen. Thuis — in
 het huis dat je gekocht hebt — is de missie klaar.

 De plekken komen weer uit de kaart: de molen uit `KAART.molens`, het stuk
 fietspad ernaast uit de wegassen, de tribune uit `KAART.sportvelden` en de weg
 voor het terrein uit het wegennet van de navigatie.
*/
const VET_WACHT = 45;               // zoveel seconden na het kopen belt hij
const VET_MOLEN = /terpensmole/i;   // het kleine molentje aan het Sneekerpad
const VET_PAD = 40;                 // zo dicht bij de molen moet het fietspad liggen (m)
const VET_LEEG = 16;                // zo dicht bij zijn plek merk je dat hij weg is
const VET_TAS_BEREIK = 2.2;         // zo dicht bij de tas pak je hem op
const VET_AUTOS = 4;                // vier auto's
const VET_MANNEN = [3, 3, 2, 2];    // met tien man erin
const VET_TUSSEN = 8;               // afstand tussen de auto's op de weg
const VET_STOP = [35, 150];         // zover van de tas mag de plek op de weg liggen (m)
const VET_LAAG = 0.7;               // wat lager is stapt de bende overheen: de reclameborden
const VET_THUIS = 8;                // zo dicht bij je voordeur ben je thuis
const VET_BELONING = 250;
/*
 De sprong naar de nacht. Na het gesprek gaat het beeld in anderhalve tel naar
 zwart, staat er ruim drie tellen "Enkele uren later", en komt het in anderhalve
 tel weer op — met jou voor de voordeur en de klok op één uur. De klok loopt in
 dit spel niet vanzelf door (js/sfeer.js), dus het blijft nacht tot je hem zelf
 verzet.
*/
const VET_UUR = 1;
const VET_ZWART = [1.4, 3.4, 1.6];  // naar zwart, zwart met de tekst, weer terug (s)
/*
 Rond de ingang: de bende komt het terrein niet op maar gaat bij het begin van de
 looproute staan (verzoek 26 sep 2026). Elke plek ligt binnen VET_INGANG meter
 van de weg en heeft vrij zicht op het uitkijkpunt, VET_UITKIJK meter het pad
 op: wie het terrein af wil loopt daar in hun vuur.
*/
const VET_INGANG = 14;              // zo ver van de weg staan ze hoogstens (m, langs het pad)
const VET_UITKIJK = 50;             // hier kijken ze naar: zoveel meter het pad op (m)
/*
 De bende. Tien man tegelijk met de schade van de bewaking (6 per treffer) is
 in tien tellen voorbij; met 3 en een dekkingsafstand van twintig meter bleven
 ze op afstand staan vuren en had je tijd om ze een voor een neer te leggen.
 Sinds stap 86 komen ze niet meer op je af maar wachten ze rond de ingang, op
 36 tot 50 m van het pad naar buiten, waar ze met 8 tot 12 % per schot raken.
 Met 3 per treffer kostte het gevecht daar nog maar 9 leven (veteraantest); met
 5 houdt wie om de drieënhalve tel iemand raakt die hij kan zien er weer een
 flinke tik aan over, en gaat wie op het pad blijft staan binnen een minuut neer.
 Ze zien je van verder dan de bewaking: de tribune staat negentig meter het
 terrein op. tools/veteraantest.mjs toetst beide.

 Sinds stap 89 zijn auto's dekking (js/vehicles.js, `blokkeertZicht`): de
 geparkeerde auto's bij het inritje nemen een deel van hun zicht op het pad weg,
 en met dezelfde loting raakten ze je daar nog twee keer in plaats van drie (90
 leven over in plaats van 85). Met 6 per treffer kost het weer wat het kostte.
*/
const VET_BENDE = {
  schade: 6, zicht: 90, vuurbereik: 70, dekking: 20,
  // over de reclameborden rond het veld (60 cm) springen ze heen, net als jij
  overLaag: VET_LAAG,
  vest: null, pet: 'om de beurt',
  kleuren: [
    { shirt: 0x1f2226, broek: 0x2a2d33 }, { shirt: 0x3a2f2a, broek: 0x1e1f23 },
    { shirt: 0x2d3440, broek: 0x23262c }, { shirt: 0x4a4038, broek: 0x26282d },
    { shirt: 0x262a2f, broek: 0x33363c },
  ],
};
const zegtVeteraan = (tekst) => ({ wie: 'De Veteraan', kop: KOPPEN.veteraan, tekst });
const VET_TELEFOON = [
  zegtVeteraan('Erik. Met De Veteraan. Mark vertelde dat je een eigen stek hebt. Mooi zo, jongen.'),
  zegtVeteraan('Ik wil je onder vier ogen spreken. Kom naar het Sneekerpad, bij het kleine molentje. Ik sta daar met mijn hondje.'),
];
const VET_BRIEFING = [
  zegtVeteraan('Daar is hij. De jongen met de vaste handjes.'),
  zegtVeteraan('Ik ben geen man van grote woorden, Erik. Maar bij de molen in IJlst lag ik er bijna bij, en jij hebt ze van me af geschoten.'),
  zegtVeteraan('Zonder jou had dit hondje geen baasje meer gehad. Dank je wel. Ik meen het.'),
  zegtErik('Johan zei al dat je wist wie het was.'),
  zegtVeteraan('Ik weet alles wat er in Tinga gebeurt. Daarom sta je hier.'),
  zegtVeteraan('Vannacht wordt er een tas afgeleverd bij het voetbalveld van VV Sneek, hier in Tinga. Bij de tribune.'),
  zegtErik('Wat zit erin?'),
  zegtVeteraan('Spul. Niks waar jij je druk om hoeft te maken.'),
  zegtVeteraan('Om één uur ligt hij er. Gewoon meenemen en hier terugbrengen. Ik wacht op je.'),
  zegtErik('Komt goed. Dan ga ik eerst even naar huis.'),
];
const VET_GEPAKT = [zegtErik('Die is zwaarder dan ik dacht.')];
const VET_AUTOS_ZIEN = [zegtErik('Wat krijgen we nou... Vier auto\'s?!')];
// ze komen het veld niet op: dat zie je, en dat zegt hij
const VET_OPWACHTEN = [zegtErik('Ze blijven bij de ingang staan. Ze wachten tot ik naar buiten kom.')];
const VET_NA_GEVECHT = [zegtErik('Dit was geen afleveradres. Dit was een hinderlaag.')];
const VET_WEG = [zegtErik('Hé... waar is hij? Hij zou hier op me wachten.')];
const VET_MARK = [
  zegtMark('Erik! Ik hoor net dat er geschoten is bij VV Sneek. Zeg dat jij dat niet was.'),
  zegtErik('Tien man, in vier auto\'s. Ik zou een tas ophalen voor De Veteraan. Nu sta ik bij het molentje en hij is weg.'),
  zegtMark('Dan weet ik genoeg. De Veteraan heeft je geprobeerd om te leggen.'),
  zegtMark('Je bent te snel gegroeid in de rangen, broeder. Wie zo snel omhoog komt, wordt een gevaar voor degene die bovenaan staat.'),
  zegtMark('Ben je veilig?'),
  zegtErik('Ik leef nog. Die tien niet.'),
];
// de laatste regel noemt je eigen adres, dus die wordt pas bij het bellen gemaakt
const vetNaarHuis = (naam) => zegtMark(`Ga naar huis, naar ${naam}. Ik ga nadenken over een plan om hem terug te pakken.`);

/*
 ---------- missie 11: de politieauto en de C4 ----------

 Na missie 10 geen telefoontje (verzoek 26 sep 2026): er staat alleen een M op de
 kaart, bij Molenkrite 15, en binnen zit Mark op de bank. Het is niet meer veilig
 op straat en hij heeft een idee, maar eerst moet je twee dingen regelen: een
 politieauto stelen, die aan de Lemmerweg staat, en vier stuks C4 ophalen bij de
 balie van Tinga State. Instappen in de politieauto kost twee sterren; die moet
 je eerst kwijt. De C4 is gratis — Mark had al gebeld. Breng je de auto en de C4
 naar Molenkrite 15, dan is de missie geslaagd en krijg je € 1.000. Wat Mark
 binnen over zijn plan vertelt is de volgende missie.
*/
const POL_WACHT = 25;               // zoveel tellen na missie 10 staat de M er
const POL_STERREN = 2;              // wat instappen in een politieauto kost
const POL_C4 = 4;                   // vier stuks
const POL_THUIS = 12;               // zo dicht bij Molenkrite 15 moet de auto staan (m)
const POL_BELONING = 1000;
const zegtVerkoper = (tekst) => ({ wie: 'Verkoper', tekst });
const POL_BINNEN = [
  zegtMark('Kom binnen, broeder. Doe de deur maar achter je dicht.'),
  zegtMark('We moeten het over De Veteraan hebben.'),
  zegtErik('Die wil me dood hebben.'),
  zegtMark('Zijn mannen hangen overal rond. In de wijk, langs de Lemmerweg. Het is niet meer veilig op straat.'),
  zegtMark('Dit kan gewoon niet, Erik. Hij moet uitgeschakeld worden.'),
  zegtErik('En hoe had je dat gedacht?'),
  zegtMark('Ik heb zitten broeden op een idee. Maar eerst moet je wat dingen voor me regelen.'),
  zegtMark('Eén: een politieauto. Aan de Lemmerweg staat er een langs de kant. De agenten zitten binnen aan de koffie.'),
  zegtErik('Een politieauto stelen. Dat blijft niet onopgemerkt.'),
  zegtMark('Nee. Dus schud ze eerst van je af, en kom dan pas verder.'),
  zegtMark('Twee: explosieven. Bij Tinga State liggen vier stuks C4 voor je klaar, bij de balie. Ik heb al gebeld.'),
  zegtMark('Breng ze allebei naar mij. Dan vertel ik je over mijn meesterplan.'),
  zegtErik('Een meesterplan. Natuurlijk.'),
];
const POL_INGESTAPT = [zegtErik('Dat is al gezien. Twee sterren — wegwezen.')];
const POL_KWIJT = [zegtErik('Kwijt. Nu de C4 bij Tinga State.')];
const POL_BALIE = [
  zegtVerkoper('Ha, jij bent de jongen van Mark. Mark had al gebeld.'),
  zegtVerkoper('Verse C4 voor jou. Vier stuks. Niet laten vallen.'),
  zegtErik('Wat krijg je van me?'),
  zegtVerkoper('Niks. Mark en ik gaan ver terug.'),
];
const POL_KLAAR = [
  zegtMark('Een echte politieauto. Mooi. En de C4?'),
  zegtErik('Vier stuks, vers van de balie.'),
  zegtMark('Dan kunnen we beginnen. Kom binnen, dan vertel ik je mijn plan.'),
];

/*
 ---------- missie 12: de Dúvelsrak ----------
 Verzoek 27 sep 2026. Binnen vertelt Mark zijn plan: De Veteraan gaat vanavond
 naar de Spil, en moet dan over de Dúvelsrak, de grote houten brug over de N7
 (in de kaart "Viaduct Tinga"). Daar zetten ze met de gestolen politieauto een
 wegversperring neer, aan de kant van Tinga; de kant van de Lemmerweg blijft open,
 want daar komt hij vandaan. Het lijkt een gewone controle, dus hij heeft geen
 argwaan. Achter op de brug ligt de C4.

 Die avond staan ze in politiepak voor Molenkrite 15. Op de brug zet Erik de
 auto dwars, drie dranghekken en vier ladingen C4 (gele markeringen, E). Mark kijkt
 of hij genoeg kogels en leven heeft, Johan komt helpen. Even later rijden vier
 auto's rustig de brug op; De Veteraan stapt uit, herkent Erik, Mark roept, en E
 laat de C4 afgaan. De achterkant van de brug gaat eraf, maar niemand is dood: het
 vuurgevecht, dan nog vier man van de achterkant, dan vier sterren. De politie
 komt pas als Mark uitgepraat is, eerst twee wagens van de Molenkrite-kant. In het
 Tinga-bos schud je ze af.

 Plekken op de brug als (s, u): s meter vanaf het eind aan de Tinga-kant, u
 meter opzij, rechts positief als je naar de Lemmerweg kijkt (js/brug.js).
*/
const BRUG_WACHT = 4;               // na missie 11: Mark gaat alvast naar binnen (s)
const BRUG_AVOND = 22.5;            // "die avond": half elf
const BRUG_LATER = 23.25;           // "even later"
const BRUG_AUTO = [2.6, 1.0];       // waar de politieauto dwars over de weg komt (s, u)
const BRUG_AUTO_BEREIK = 5;         // zo dicht bij die plek moet je hem neerzetten (m)
const BRUG_HEKKEN = [[6.5, -3.3], [6.5, 0], [6.5, 3.3]];                 // drie dranghekken
const BRUG_C4 = [[42.5, -4.2], [42.5, 4.2], [47.5, -4.2], [47.5, 4.2]];   // vier ladingen
const BRUG_GAT = 45;                // midden van wat er van het dek over is (s)
const BRUG_BEREIK = 1.6;            // zo dicht bij een markering voor E (m)
const BRUG_KOGELS = 100;            // wat Mark wil zien: kogels in totaal
const BRUG_EXTRA = 150;             // wat hij je geeft als het er minder zijn
const BRUG_STOP = [11, 18, 25, 32]; // waar de vier auto's stilstaan (s)
const BRUG_RIJBAAN = -1.4;          // hun rijstrook: rechts van de as, naar Tinga toe (u)
/*
 Zoveel meter voor het eind van het dek beginnen ze, halverwege de helling: de
 voorste rijdt dan 83 m, bij 25 km/u met remmen dertien tellen — het filmbeeld.
*/
const BRUG_HELLING = 70;
const BRUG_V = 7;                   // rustig: 25 km/u
const BRUG_REM = 3.2;               // remvertraging (m/s²)
const BRUG_ACHTER = 4;              // die van de achterkant
const BRUG_STERREN = 4;
const BRUG_POLITIE = 2;             // de eerste wagens, van de Molenkrite-kant
const BRUG_BELONING = 5000;
const BRUG_FILM = 18;               // hoe lang het filmbeeld hoogstens duurt (s)
// de lijfwachten: iets minder hard dan de bende van VV Sneek, ze staan dichterbij
const BRUG_BENDE = { schade: 4, zicht: 80, vuurbereik: 60, dekking: 12, vest: null, pet: 'om de beurt',
  kleuren: VET_BENDE.kleuren };
const BRUG_PLAN = [
  zegtMark('Ga zitten, broeder. Ik heb het uitgedacht.'),
  zegtMark('Johan hoorde van iemand dat De Veteraan vanavond naar de Spil gaat.'),
  zegtErik('Naar de Spil? Dan moet hij over de Dúvelsrak.'),
  zegtMark('Precies. En daar zetten wij vanavond een wegversperring neer. Met jouw politieauto.'),
  zegtMark('Het lijkt een gewone politiecontrole. De Veteraan heeft geen argwaan: hij denkt dat hij iedereen betaalt.'),
  zegtErik('En de C4?'),
  zegtMark('Die ligt achter op de brug. Staat hij stil voor de hekken, dan laten wij de C4 afgaan.'),
  zegtMark('Boem! De Veteraan op het grasveld. Briljant!'),
  zegtErik('Jij bent gek.'),
  zegtMark('Gek genoeg om te winnen. Maar eerst moeten we die versperring nog opzetten.'),
  zegtMark('Hier, trek dit aan. Vanavond zijn wij de politie.'),
];
const BRUG_BUITEN = [
  zegtMark('Staat je goed, agent.'),
  zegtMark('Rij de politieauto naar de Dúvelsrak. Aan onze kant, de kant van Tinga. Ik rij met je mee.'),
];
const BRUG_OP_DE_BRUG = [
  zegtMark('Hier. Dwars over de weg, zwaailicht aan.'),
  zegtMark('Zet de dranghekken neer, aan onze kant. De kant van de Lemmerweg laten we open: daar komt hij vandaan.'),
];
const BRUG_HEKKEN_STAAN = [
  zegtMark('Mooi. Nu de C4: vier ladingen, achter op de brug, aan de kant van de Lemmerweg.'),
];
const BRUG_KIJKEN = zegtMark('Laat eens zien wat je bij je hebt.');
const BRUG_GENOEG = [BRUG_KIJKEN, zegtMark('Genoeg kogels, en je staat stevig op je benen. Goed zo.')];
const BRUG_TE_WEINIG = [
  BRUG_KIJKEN,
  zegtMark('Daar ga je het niet mee redden. Hier: een machinegeweer en een pistool, met kogels genoeg.'),
  zegtMark('En neem dit. Je moet fit zijn als het begint.'),
];
const BRUG_JOHAN = [
  zegtJohan('Goedenavond, agenten. Controle?'),
  zegtMark('Johan! Je bent er.'),
  zegtJohan('Dacht je dat ik dit ging missen? Ik help mee. Die rat is me nog wat schuldig.'),
  zegtMark('Iedereen op zijn plek. Nu is het wachten.'),
];
const BRUG_VETERAAN = [
  zegtVeteraan('Wat is dit? Een controle? Hier?'),
  zegtVeteraan('Hebben jullie niet genoeg geld van mij gekregen om mij door te laten gaan?'),
  zegtMark('Rijbewijs en kentekenbewijs, meneer.'),
  zegtVeteraan('Wacht eens… Jou ken ik!'),
  zegtVeteraan('Jij bent die jongen van Mark!'),
  zegtMark('Nu, Erik! Laat de C4 afgaan!'),
];
const BRUG_BOEM = [zegtVeteraan('Schiet ze neer! Allemaal!')];
const BRUG_MEER = [zegtJohan('Daar komen er nog meer! Van de achterkant!')];
const BRUG_VET_NEER = [zegtMark('De Veteraan ligt! Die staat niet meer op.')];
const BRUG_CHAOS = [
  zegtMark('Shit, wat een chaos.'),
  zegtMark('Hoor je dat? Ze komen eraan.'),
  zegtMark('Mannen, de auto in en wegwezen. Op naar het Tinga-bos!'),
];
const BRUG_BOS = [
  zegtMark('We zijn ze kwijt.'),
  zegtJohan('En De Veteraan is geschiedenis.'),
  zegtMark('Tinga is weer van ons, broeders. Hier legt niemand ons meer om.'),
  zegtErik('Wat een nacht.'),
  // (verzoek 27 sep 2026: ze verstoppen zich, en Mark laat later van zich horen)
  zegtMark('Oké. We moeten even op de achtergrond blijven, totdat de rust terug is in de wijk.'),
  zegtMark('Johan, jij gaat een paar dagen naar je zus. Erik, jij houdt je koest.'),
  zegtMark('Zoek me later weer op.'),
];

/*
 ---------- missie 13: het schrift ----------
 Bedacht bij het verzoek van 27 sep 2026 ("bedenk een verhaal dat haalbaar is").
 Een paar dagen na de Dúvelsrak zit Mark ondergedoken bij een neef in Duinterpen.
 De Veteraan hield een schrift bij van iedereen die hij betaalde: agenten, de man
 van de gemeente, en ook Mark en Erik. Het ligt in zijn sloep in IJlst, en de
 politie heeft de kade al met lint afgezet. Twee agenten lopen er rond: ongezien
 blijven kan, en gezien worden kost twee sterren. Het schrift gaat naar Mark,
 maar niet met de politie achter je aan. Hij bladert, ziet de namen van agenten,
 en weet wat het waard is.
*/
const SCHRIFT_HUIS = { straat: 'Parelmoervlinder', nr: '3' };
const SCHRIFT_NA_BOS = 5;           // zoveel tellen na MISSIE GESLAAGD gaat het beeld zwart
const SCHRIFT_UUR = 14.5;           // "een paar dagen later": half drie 's middags
const SCHRIFT_PRAAT = 6;            // zo dicht bij Mark begint hij te praten (m)
const SCHRIFT_BOOT = 1;             // de sloep aan de ligplaats in IJlst (js/boot.js)
const SCHRIFT_BEREIK = 2.6;         // zo dicht bij de markering op de kade voor E (m)
const SCHRIFT_STERREN = 2;
const SCHRIFT_BELONING = 2500;
// twee agenten in uniform (js/politie.js), zoals de bewaking: ze lopen hun rondje
// en zien je op dertig meter recht voor zich
const SCHRIFT_AGENTEN = { schade: 5, zicht: 30, vuurbereik: 36, dekking: 10, vest: UNIFORM.vest, pet: true,
  kleuren: [{ shirt: UNIFORM.shirt, broek: UNIFORM.broek }] };
const SCHRIFT_BRIEFING = [
  zegtMark('Daar ben je. Niemand zoekt ons in Duinterpen.'),
  zegtErik('Waarom hier?'),
  zegtMark('Een neef van me woont hier. Rustige straat, geen vragen.'),
  zegtMark('Maar er is een probleem. De Veteraan hield een schrift bij.'),
  zegtMark('Wie hij betaalde, hoeveel en wanneer. Agenten. De man van de gemeente.'),
  zegtErik('En wij.'),
  zegtMark('En wij. Als de recherche dat vindt, zijn we er allemaal geweest.'),
  zegtMark('Het ligt in zijn sloep in IJlst. Daar deed hij altijd zijn zaken.'),
  zegtErik('En als daar al politie is?'),
  zegtMark('Dan zorg je dat ze je niet zien. Breng het hierheen. En neem de politie niet mee.'),
];
const SCHRIFT_GEZIEN = [zegtErik('Shit, ze hebben me gezien!')];
const SCHRIFT_GEPAKT = [zegtErik('Hebbes. Een zwart schrift met een rood elastiek.')];
const SCHRIFT_NIET_MEE = [zegtMark('Niet met de politie achter je aan! Eerst kwijtraken.')];
const SCHRIFT_KLAAR = [
  zegtMark('Laat zien.'),
  zegtMark('Bladzijde zeventien. "Mark, vijfduizend. De jongen, vijfentwintighonderd." Dat zijn wij.'),
  zegtMark('En kijk eens: Hoekstra, De Vries, Bakker. Allemaal agenten. En de man van de gemeente.'),
  zegtErik('Moet het de barbecue in?'),
  zegtMark('Ben je gek. Dit schrift is goud waard, broeder. Hiermee kopen we de hele wijk stil.'),
  zegtMark('Ga maar even. Ik laat van me horen.'),
];

/*
 ---------- missie 14: Ronald en de race naar IJlst ----------
 Een minuut na het schrift belt Ronald, een oude vriend van Erik die aan de
 Lemmerweg woont (nummer 80, het huis met de schuur). Hij heeft een schuld bij
 brigadier Bouwman, en die naam staat in het schrift. Bouwman laat 's nachts
 races rijden, van de BP aan de Lemmerweg tot bij de Poiesz in IJlst, en zet er
 geld op in; wie hem iets schuldig is moet rijden. Met Ronalds BX win je het niet,
 dus Erik rijdt voor hem, in een Ferrari van Autohuis Lemmerweg (js/garage.js).
 Winnen lost de schuld af en levert € 2.000 op — en Bouwman weet nu wie Erik is.
 Het parcours en de tegenstanders staan in js/race.js.
*/
const zegtRonald = (tekst) => ({ wie: 'Ronald', kop: KOPPEN.ronald, tekst });
const zegtBouwman = (tekst) => ({ wie: 'Bouwman', kop: KOPPEN.bouwman, tekst });
const RACE_HUIS = { straat: 'Lemmerweg', nr: '80' };
const RACE_WACHT = 60;              // zoveel tellen na het schrift belt Ronald
const RACE_PRAAT = 6;               // zo dicht bij Ronald begint hij te praten (m)
const RACE_UUR = 1.0;               // "Die nacht": één uur
const RACE_PRIJS = 3000;            // wat een Ferrari bij het Autohuis kost
const RACE_BELONING = 2000;
const RACE_TE_LAAT = 45;            // zo lang na de eerste over de finish is het voorbij (s)
const RACE_SCHULD = 1500;           // Ronalds schuld bij Bouwman; na een verloren revanche het dubbele
const RACE_UIT_MAX = 20;            // zo lang (s) mag je tijdens de race buiten je auto staan
const RACE_NA = 5;                  // zoveel tellen na de uitslag wordt het zwart
const RACE_OCHTEND = 9.5;           // "De volgende ochtend": half tien
/*
 Verliezen (verzoek 27 sep 2026: "wat als je niet wint, bedenk dat soort zaken
 ook"). Dan is de race niet gewoon opnieuw: Bouwman komt verhaal halen. Ronalds
 schuld wordt van jou, en je kiest: 1, nog een keer rijden, dubbel of niks (verlies
 je weer, dan is de schuld het dubbele), of 2, de schuld betalen. Betalen rondt de
 missie af zonder beloning; heb je het geld niet, dan blijft alleen rijden over.
*/
const RACE_VERLOREN = (schuld) => [
  zegtBouwman('Verloren is verloren, jongen.'),
  zegtBouwman(`Ronald is me ${euro(schuld)} schuldig. Dat is nu jouw probleem.`),
  zegtRonald('Erik, het spijt me…'),
  zegtBouwman('Of je rijdt nog een keer. Dubbel of niks: win je, dan is alles weg. Verlies je, dan is het het dubbele.'),
  zegtBouwman(`<b>1</b> — nog een keer rijden · <b>2</b> — ${euro(schuld)} betalen`),
];
const RACE_REVANCHE = [zegtBouwman('Dat dacht ik al. Terug naar de start.')];
const RACE_TE_ARM = (schuld) => [zegtBouwman(`${euro(schuld)}? Dat heb je niet eens. Dan rij je nog een keer.`)];
const RACE_BETAALD = [
  zegtBouwman('Verstandig. Ronald is van me af.'),
  zegtRonald('Ik betaal je terug, Erik. Ooit.'),
  zegtBouwman('Wacht eens… Erik. Erik van Mark?'),
  zegtBouwman('Dan hebben wij binnenkort nog wat te bespreken.'),
];
const RACE_TELEFOON = [
  zegtRonald('Erik! Met Ronald. Lang niet gesproken, jongen.'),
  zegtErik('Ronald! Alles goed?'),
  zegtRonald('Eerlijk gezegd niet. Ik zit in de problemen. Kun je even langskomen?'),
  zegtRonald('Ik woon nog steeds aan de Lemmerweg. Nummer 80, het huis met de schuur.'),
  zegtErik('Ik kom eraan.'),
];
const RACE_UITLEG = [
  zegtRonald('Fijn dat je er bent. Kom even bij de schuur staan.'),
  zegtRonald('Ik heb een schuld bij een zekere Bouwman. Brigadier Bouwman.'),
  zegtErik('Bouwman… Die naam stond in het schrift van De Veteraan.'),
  zegtRonald('Verbaast me niks. Hij laat \'s nachts races rijden, van de BP hier aan de Lemmerweg tot bij de Poiesz in IJlst.'),
  zegtRonald('Hij zet er geld op in. En wie hem iets schuldig is, moet rijden. Vannacht ben ik aan de beurt.'),
  zegtRonald('Win ik, dan is mijn schuld weg. Maar met mijn oude BX win ik het nooit. Die anderen rijden honderdvijftig.'),
  zegtErik('Dan rij ik voor je.'),
];
const RACE_HEEFT_FERRARI = [
  zegtRonald('Met die Ferrari van jou? Dan maken we een kans!'),
  zegtRonald('Vannacht om één uur bij de BP. Kom niet te laat.'),
];
const RACE_GEEN_FERRARI = [
  zegtRonald('Dan heb je wel een snelle auto nodig. Met een gewone auto haal je ze niet in.'),
  zegtRonald('Bij Autohuis Lemmerweg, hier een stukje verderop, staan Ferrari\'s. Die halen er ruim tweehonderd.'),
];
const RACE_BIJLEGGEN = (n) => [zegtRonald(`En kom je geld tekort: ik heb je ${euro(n)} overgemaakt. Het is tenslotte mijn schuld.`)];
const RACE_GEKOCHT = [
  zegtRonald('Ik hoor dat je hem hebt? Mooi.'),
  zegtRonald('Vannacht om één uur bij de BP. Kom niet te laat.'),
];
const RACE_START = [
  zegtBouwman('Dus jij rijdt voor Ronald?'),
  zegtErik('Klopt.'),
  zegtBouwman('Van hier tot de Poiesz in IJlst. Door elke gele ring, anders telt het niet.'),
  zegtBouwman('Win je, dan is Ronald van me af. Verlies je, dan ga ik zijn huis tellen.'),
  zegtRonald('Succes, Erik. Rustig in de bochten.'),
  zegtBouwman('Motoren aan.'),
];
const RACE_GEWONNEN = [
  zegtBouwman('Niet slecht, jongen. Niet slecht.'),
  zegtBouwman(`Ronald, je schuld is afgelost. En jij krijgt je deel: ${euro(RACE_BELONING)}.`),
  zegtRonald('Erik, je bent een held! Ik sta bij je in het krijt.'),
  zegtBouwman('Wacht eens… Erik. Erik van Mark?'),
  zegtBouwman('Dan hebben wij binnenkort nog wat te bespreken.'),
];

/*
 ---------- missie 15: Bouwman schaduwen ----------
 Een minuut na "De volgende ochtend" belt Mark. Bij hem op de bank: in het schrift
 staat "B. — opslag aan het water. Dinsdag en vrijdag", en het is vrijdag. Die
 avond wacht je in de oude Golf van Mark bij het Autohuis, tegenover de BP waar
 Bouwman tankt, en volg je hem: niet te dichtbij, niet te ver. Bij zijn loods maak
 je drie foto's zonder dat de twee mannen je zien. Terug bij Mark: € 1.500, of de
 helft als ze je gezien hebben (verzoek 27 sep 2026, "net wat anders").
*/
const SCHADUW_WACHT = 60;           // zoveel seconden na de ochtend belt Mark
const SCHADUW_UUR = 23;             // "Die avond…": en de klok staat stil tot de ochtend
const SCHADUW_OCHTEND = 10;         // "De volgende ochtend": je slaapt bij Mark
const SCHADUW_DICHT = 22;           // dichterbij dan dit ziet Bouwman je (m)…
const SCHADUW_DICHT_FERRARI = 45;   // …en een rode Ferrari ziet hij van veel verder
const SCHADUW_DICHT_STIL = 40;      // staat hij stil, dan kijkt hij in zijn spiegel
const SCHADUW_DICHT_T = 3;          // zo lang (s) mag je te dichtbij zitten
const SCHADUW_VER = 170;            // verder dan dit raak je hem kwijt (m)…
const SCHADUW_VER_T = 5;            // …als het langer duurt dan dit (s)
const SCHADUW_STERREN = 2;
const SCHADUW_FOTO = 1.8;           // zo dicht bij de gele ruit voor E (m)
const SCHADUW_RICHT = 0.9;          // en zo recht (rad) moet je naar het onderwerp kijken
const SCHADUW_BELONING = 1500;
const SCHADUW_MANNEN = { schade: 5, zicht: 28, vuurbereik: 34, dekking: 10, vest: null, pet: false,
  kleuren: [{ shirt: 0x2a2c30, broek: 0x1e2024 }, { shirt: 0x3b3328, broek: 0x23262b }] };
const SCHADUW_TELEFOON = [
  zegtMark('Erik. Ronald vertelde me over vannacht.'),
  zegtErik('Die Bouwman wist ineens wie ik was.'),
  zegtMark('Dat bevalt me niet. Kom even langs, ik zit thuis.'),
];
const SCHADUW_BINNEN = [
  zegtMark('Kijk. Het schrift van De Veteraan. Bladzijde achttien.'),
  zegtMark('"B. — opslag aan het water. Dinsdag en vrijdag."'),
  zegtErik('B. van Bouwman.'),
  zegtMark('Vandaag is het vrijdag. Hij heeft de zaakjes van De Veteraan overgenomen, en nu wil hij ons erbij.'),
  zegtMark('Ik wil weten waar die opslag is. Volg hem vanavond, en maak foto\'s.'),
  zegtErik('Met de Ferrari?'),
  zegtMark('Die kent hij nu. Mijn oude Golf staat bij het Autohuis, tegenover de BP. Daar tankt hij altijd.'),
  zegtMark('Blijf achter hem. Niet te dichtbij, en raak hem niet kwijt.'),
];
const SCHADUW_DAAR = [zegtErik('Daar staat hij, bij de pomp. Nu wachten.')];
const SCHADUW_WEG = [zegtErik('Hij rijdt weg. Afstand houden…')];
const SCHADUW_STOP = [zegtErik('Hij stopt… bij Parelmoervlinder 3. Daar zat Mark ondergedoken. Hij weet het.')];
const SCHADUW_LOODS = [
  zegtErik('Een loods aan het water. Hier bewaart hij het dus.'),
  zegtErik('Drie foto\'s. En die twee mogen me niet zien.'),
];
const SCHADUW_FOTOS = [
  [zegtErik('Bouwman met twee man van De Veteraan. Die gezichten ken ik nog van VV Sneek.')],
  [zegtErik('Een bord met namen. Ronald… Johan… en Mark, met een rode cirkel eromheen.')],
  [zegtErik('De boot waarmee ze het aanvoeren. De STAVOREN 7.')],
];
const SCHADUW_GENOEG = [zegtErik('Genoeg gezien. Terug naar Mark.')];
const SCHADUW_GEZIEN = [zegtErik('Ze hebben me gezien!')];
const SCHADUW_KLAAR = (gezien) => [
  zegtMark('En? Laat zien.'),
  zegtErik('Een loods aan het water, voorbij de N7. Twee man van De Veteraan, een boot. En dit.'),
  zegtMark('… Ronald. Johan. En ik, met een cirkel eromheen.'),
  zegtMark('Hij wil ons niet pakken, Erik. Hij wil ons hebben. Net als De Veteraan.'),
  ...(gezien ? [
    zegtMark('En ze hebben je gezien, zeg je? Dan weet hij nu dat wij het weten.'),
    zegtMark(`Dat kost ons iets. Hier, de helft: ${euro(SCHADUW_BELONING / 2)}.`),
  ] : [
    zegtMark('Nu weten wij waar hij het bewaart. Dat is meer dan hij van ons weet.'),
    zegtMark(`Hier, voor vanavond: ${euro(SCHADUW_BELONING)}.`),
  ]),
  zegtMark('Blijf de komende dagen uit de buurt van die loods.'),
  zegtMark('En het is laat. Blijf hier maar even slapen, voor de zekerheid.'),
  zegtErik('Graag.'),
];

/*
 ---------- missie 16: De inval ----------
 Verzoek 28 sep 2026 ("gebruik A, werk het dialoog en de missie helemaal uit", "mag grimmig",
 met filmbeelden zoals op de brug). De ochtend na missie 15 belt Johan: Bouwman heeft een
 bevel voor Molenkrite 15. Drie minuten om het schrift en de foto's te pakken en Mark mee te
 nemen; dan de inval (filmbeeld), drie sterren. Bij de Wieken 29 belt Bouwman: hij heeft Johan.
 Het schrift tegen Johan, vannacht op de Dúvelsrak. Jij kiest: 1 ruilen of 2 een hinderlaag
 met Mark op een dak. Bij 2 ram je Bouwman daarna van de weg en vind je zijn telefoon: ???
 is Ronald. Bij 1 hoort Johan het in de auto.
*/
const INVAL_WACHT = 60;             // zoveel seconden na de ochtend bij Mark belt Johan
const INVAL_TIJD = 180;             // drie minuten voor ze voor de deur staan (s)
const INVAL_STERREN = 3;
const INVAL_NACHT = 1;              // "Die nacht…": één uur, en de klok staat stil
const INVAL_OCHTEND = 9.5;          // "De volgende ochtend"
const INVAL_RUIT = 1.8;             // zo dicht bij een gele ruit voor E (m)
const INVAL_WAPEN = 40;             // dichter dan dit bij het midden: wapen weg (m)
const INVAL_WAPEN_T = 3;            // zo lang mag je het nog vasthouden (s)
const INVAL_ACHTERUIT = 4;          // "Vijf stappen": zoveel meter van de tas af (m)
const INVAL_KLAPPEN = 3;            // zoveel klappen, of één harde…
const INVAL_HARD = 16.7;            // …boven 60 km/u (m/s)
const INVAL_KWIJT = 250;            // verder dan dit bij hem vandaan (m)…
const INVAL_KWIJT_T = 5;            // …zo lang, en hij is weg
const INVAL_BELONING = { ruil: 1000, hinderlaag: 3000, kwijt: 2000 };
// op de Dúvelsrak, als (s, u): s vanaf de Tinga-kant, u rechts als je naar de Lemmerweg kijkt
const INVAL_S = { erik: 3, auto: 34, johan: 30.6, bouwman: 37.2, ruit: 18, erikAuto: [0.5, 2.6] };
const INVAL_MANNEN = { schade: 5, zicht: 60, vuurbereik: 50, dekking: 10, vest: null, pet: false,
  kleuren: [{ shirt: 0x2a2c30, broek: 0x1e2024 }, { shirt: 0x3b3328, broek: 0x23262b }] };
const telLijn = (r) => ({ ...r, telefoon: true });

const INVAL_TELEFOON = [
  telLijn(zegtJohan('Erik. Ben je nog bij Mark?')),
  zegtErik('Ik sta voor de deur. Hoezo?'),
  telLijn(zegtJohan('Bouwman heeft vanochtend een bevel laten tekenen. Molenkrite 15. Ze zijn al onderweg.')),
  telLijn(zegtJohan('Drie minuten, hooguit. Haal Mark daar weg. En dat schrift, en die foto\'s. Als ze dat vinden, zijn we alle drie klaar.')),
  zegtErik('En jij?'),
  telLijn(zegtJohan('Ik red me wel. Gaan, nu.')),
];
const INVAL_BINNEN = [
  zegtMark('Wat is er?'),
  zegtErik('Inval. Johan belde. We moeten weg.'),
  zegtMark('Dan pak jij het schrift en de foto\'s. Ik haal mijn tas.'),
];
const INVAL_SCHRIFT = [zegtErik('Het schrift.')];
const INVAL_FOTOS = [zegtErik('Foto\'s ook.')];
const INVAL_WEG = [zegtMark('Jouw auto. Ik rij niet, ik moet kunnen kijken.')];
const INVAL_TE_LAAT = [telLijn(zegtMark('Ze hebben me, Erik. Blijf weg van het huis.'))];
const INVAL_DAAR = [zegtMark('Daar zijn ze. Rijden, rijden!')];
const INVAL_ONDERWEG = [
  zegtMark('Niet naar de Lemmerweg. Daar staan ze het eerst.'),
  zegtMark('Bouwman staat er zelf niet bij. Die laat anderen het vuile werk doen.'),
];
const INVAL_KLAP = [zegtMark('Dat was dichtbij.'), zegtMark('Zet \'m door, Erik.')];
const INVAL_KWIJTGERAAKT = [zegtMark('We zijn ze kwijt. De Wieken 29. Daar kent niemand me meer.')];
const INVAL_BOUWMAN_BELT = [
  telLijn(zegtBouwman('Goedemorgen, Mark. Je bent op tijd weggekomen. Knap.')),
  zegtMark('Wat wil je, Bouwman.'),
  telLijn(zegtBouwman('Wat jij hebt. Dat schrift. En die foto\'s die jullie bij mijn loods maakten. Ja, dat weet ik ook.')),
  telLijn(zegtBouwman('Je vriend Johan was minder snel dan jij. Hij zit hier naast me. Zeg eens wat, Johan.')),
  telLijn(zegtJohan('Niet doen, Mark. Hij…')),
  telLijn(zegtBouwman('Genoeg. Vannacht om één uur, op de Dúvelsrak. Het schrift tegen Johan.')),
  telLijn(zegtBouwman('Kom je met de politie, of kom je niet, dan zoeken ze morgen twee man in de Geeuw.')),
  zegtMark('Hij is ons een stap voor. Hoe wist hij van de foto\'s?'),
  zegtErik('Iemand praat.'),
  zegtMark('Ja. Maar eerst Johan.'),
  zegtMark('Luister. We kunnen doen wat hij zegt: het schrift geven, Johan halen, en daarna opnieuw beginnen. Dan heeft hij het bewijs, maar leeft Johan.'),
  zegtMark('Of we doen het slim. Ik lig op een dak aan de Tinga-kant, met de sniper. Jij loopt met een lege tas naar het midden. Op mijn teken gaan zijn twee mannen neer, en dan is Bouwman van ons.'),
  zegtMark('Het is jouw keus. Jij moet daar lopen.'),
];
const INVAL_KEUS_RUIL = [zegtMark('Goed. Johan eerst. Het schrift is maar papier.')];
const INVAL_KEUS_HINDERLAAG = [
  zegtMark('Dacht ik al.'),
  zegtMark('Blijf in het midden staan en kijk naar mij. Als ik "nu" zeg, laat je je vallen.'),
];
const INVAL_BRUG_ROEP = [
  zegtBouwman('Erik! Alleen jij? Waar is Mark?'),
  zegtErik('Die zit thuis met zijn handen in zijn haar. Waar dacht je?'),
  zegtBouwman('Wapen weg. Loop naar het midden, tas op de grond.'),
];
const INVAL_WAPEN_WEG = [zegtBouwman('Wapen weg, zei ik!')];
const INVAL_ACHTERUIT_ZEG = [zegtBouwman('Achteruit. Vijf stappen.')];
const INVAL_BRAAF = [
  zegtBouwman('Het schrift. En de foto\'s. Braaf.'),
  zegtBouwman('Laat hem gaan.'),
];
const INVAL_GROETEN = [zegtBouwman('Doe Mark de groeten. Ik zie hem snel.')];
const INVAL_JOHAN_VRIJ = [
  zegtJohan('Dank je, man. Ik dacht echt dat het klaar was.'),
  zegtErik('Ben je oké?'),
  zegtJohan('Ik leef. Maar luister: in de auto belde hij met iemand. "Ze zaten op Molenkrite 15, precies zoals je zei."'),
  zegtJohan('Hij noemde hem bij zijn naam.'),
  zegtErik('Wie?'),
  zegtJohan('Ronald.'),
];
const INVAL_LEEG = [zegtBouwman('Leeg? Jij klein…')];
const INVAL_NU = [telLijn(zegtMark('Nu!'))];
const INVAL_ERVANDOOR = [
  zegtJohan('Hij gaat ervandoor!'),
  telLijn(zegtMark('Achter hem aan, Erik! Johan is veilig, ik haal hem.')),
];
const INVAL_ROTONDE = [telLijn(zegtMark('Hij gaat naar de rotonde. Duw \'m eraf!'))];
const INVAL_CRASH = [zegtBouwman('Dit is niet voorbij, Erik!')];
const INVAL_TELEFOON_BOUWMAN = [
  zegtErik('Zijn telefoon.'),
  zegtErik('"Ze zitten op Molenkrite 15. Kom vandaag, morgen zijn ze weg." — R.'),
  zegtErik('Mark. Ik weet wie ??? is.'),
  telLijn(zegtMark('Zeg het.')),
  zegtErik('Ronald.'),
  telLijn(zegtMark('… Dan heeft hij ons de hele tijd verkocht. Kom naar de Wieken. Johan is bij me.')),
];
const INVAL_KWIJT_BOUWMAN = [telLijn(zegtMark('We zijn hem kwijt. Kom terug, we hebben Johan tenminste.'))];
const INVAL_AFRONDING = (keus, telefoon) => keus === 1 ? [
  zegtMark('Hij heeft het schrift. Dat is het enige wat we op hem hadden.'),
  zegtJohan('Maar we weten nu van Ronald.'),
  zegtMark('Ja. En Ronald weet niet dat wij het weten. Dat is ook wat waard.'),
  zegtMark(`Hier, voor vannacht: ${euro(INVAL_BELONING.ruil)}. Ga slapen. Morgen gaan we het hem vragen.`),
] : telefoon ? [
  zegtJohan('Ik dacht dat je gek was, Erik. Lopen met een lege tas.'),
  zegtMark('Hij liep precies waar ik zei. En het schrift hebben we nog.'),
  zegtMark('Bouwman heeft geen mannen meer, geen schrift en geen telefoon. Wat hij nog heeft is Ronald.'),
  zegtMark(`Hier: ${euro(INVAL_BELONING.hinderlaag)}. Dit heb je verdiend. Morgen gaan we Ronald vragen waarom.`),
] : [
  zegtJohan('Ik dacht dat je gek was, Erik. Lopen met een lege tas.'),
  zegtJohan('En luister: in de auto belde hij met iemand. "Ze zaten op Molenkrite 15, precies zoals je zei." Ronald.'),
  zegtMark('Ronald. Dan heeft hij ons de hele tijd verkocht.'),
  zegtMark(`Bouwman is weg, maar zijn mannen liggen op de brug en het schrift hebben we nog. Hier: ${euro(INVAL_BELONING.kwijt)}.`),
  zegtMark('Morgen gaan we Ronald vragen waarom.'),
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

// Iemand op de bank van een woning: op de zitting, een handbreed naar voren
// zodat de hakken vóór de bank uitkomen, en naar de tv kijkend. Zijn houding
// komt uit `update(dt, { zit: BANK_ZITTING })`.
const BANK_ZITTING = 0.46;
function opDeBank(persoon, plekken, naar) {
  const bank = plekken && plekken.bank;
  if (!bank) return false;
  const k = plekken.bankKijk !== undefined ? plekken.bankKijk : kijkHoek(bank, naar);
  persoon.zetNeer(bank.x - Math.sin(k) * 0.08, bank.z - Math.cos(k) * 0.08, k);
  return true;
}

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
    // missie 9: de drie woningen waar je uit kunt kiezen (js/interieur.js)
    stekken = null,
    // missie 10: na het gesprek met De Veteraan wordt het één uur 's nachts
    zetUur = null, klokLoopt = null,
    // het checkpoint na elke missie, en de keuze na het neergaan (js/main.js)
    checkpoint = null, naarCheckpoint = null, naarOpslag = null,
    heeftCheckpoint = () => false, heeftOpslag = () => false, vergrendel = null,
    // missie 11 (js/main.js): Molenkrite 15 van binnen, Tinga State, of de politie je
    // zoekt, en een politieauto om te stelen
    molenkrite = null, tingaState = null, gezocht = () => false, parkeerPolitieAuto = null,
    // missie 12 (js/main.js): de camera voor het filmbeeld, de politie die even
    // wacht en daarna van de Molenkrite-kant komt, en Erik in een politiepak
    camera = null, politieRust = null, stuurPolitie = null, zetPak = null, sterren = () => 0,
    // missie 14 (js/main.js): de gekochte auto's van Autohuis Lemmerweg, en zelf in een auto stappen
    garage = () => null, stapIn = null,
  } = ctx;
  const balk = document.getElementById('dialoog');
  const naamEl = document.getElementById('dialoogNaam');
  const tekstEl = document.getElementById('dialoogTekst');
  const verderEl = document.getElementById('dialoogVerder');
  const kopEl = document.getElementById('dialoogKop');
  const praatEl = document.getElementById('praat');
  const opdrachtEl = document.getElementById('opdracht');
  // het zwart met "Enkele uren later" (index.html); in een losse proef kan het ontbreken
  const overgangEl = document.getElementById('overgang');
  const overgangTekst = document.getElementById('overgangtekst');

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

  /*
   Na missie 10 heeft De Veteraan zich tegen je gekeerd: zijn mannen hangen in
   groepjes rond in Tinga en langs de Lemmerweg (js/bendes.js). Ze staan er
   alleen buiten de missies om.
  */
  const bendes = initBendes({ scene, player, laatVallen, paniek, uitleg });

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
  let keuzeOpen = false;         // staat de keuze na het neergaan in beeld?
  let vorigeMissie = null;       // om te zien wanneer een missie net klaar is
  let checkpointT = 0;           // even later wordt het checkpoint geschreven
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

  /*
   ---------- klusjes (js/klusjes.js, stap 99) ----------
   Tussen de missies door: Mark of Johan op een willekeurige stoep met een klus. Een
   klus mag als het verhaal vrij is: tussen twee missies, of een missie die onder zijn
   M op je wacht (KLUS_WACHT: de fase waarin nog niets begonnen is). Zolang er een klus
   loopt wacht het verhaal: de pauze tot de volgende missie telt niet af, en de missie
   die op je wacht doet niets (zie `update` en `toets`). Daarna staan zijn opdracht en
   zijn M weer in beeld.
  */
  const KLUS_WACHT = {
    johan: ['naar_johan'], bx: ['wacht'], bom: ['wacht'], huis: ['naar_mark', 'kiezen'],
    veteraan: ['naar_veteraan'], politieauto: ['wacht'], brug: ['wacht'], schrift: ['wacht'],
    race: ['naarRonald'], schaduw: ['naarMark'],
  };
  const VOOR_JOHAN = ['molenkrite', 'rijden', 'bewaking', 'afleveren'];
  let klusPauze = null;          // wat het verhaal in beeld had toen de klus begon
  function vrijVoorKlus() {
    if (doodT > 0 || misluktT > 0 || keuzeOpen || zwart || player.health <= 0) return false;
    if (missie === 'klaar') return true;
    return (KLUS_WACHT[missie] || []).includes(fase);
  }
  function pauzeerVoorKlus(aan) {
    if (aan) {
      if (klusPauze) return;
      klusPauze = {
        navDoel: navDoel ? { ...navDoel } : null,
        nav: hud.nav || null,
        opdracht: opdrachtEl.hidden ? '' : opdrachtEl.textContent.replace(/^Opdracht: /, ''),
        rood: opdrachtEl.classList.contains('rood'),
      };
      return;
    }
    const b = klusPauze;
    klusPauze = null;
    if (!b) return;
    zetOpdracht(b.opdracht, b.rood);
    if (b.navDoel) zetNavDoel(b.navDoel.x, b.navDoel.z, b.navDoel.naam, b.navDoel.letter);
    else { navDoel = null; hud.zetNavigatie(b.nav); }
  }
  const klusjes = initKlusjes({
    scene, player, vehicles, hud, KAART,
    api: {
      vrij: vrijVoorKlus,
      pauzeer: pauzeerVoorKlus,
      zeg: (regels, na = null, opties = {}) => zeg(regels, na, opties),
      balkDicht: () => balk.hidden,
      praat: (tekst) => { if (tekst) { praatEl.textContent = tekst; praatEl.hidden = false; } else praatEl.hidden = true; },
      zetOpdracht: (tekst, rood = false) => zetOpdracht(tekst, rood),
      melding: (k, o, t) => hud.melding(k, o, t),
      telefoon: () => geluid.telefoon(),
      nav: (x, z, naam, letter) => zetNavDoel(x, z, naam, letter),
      navBij: () => werkNavBij(),
      navUit: () => { navDoel = null; hud.zetNavigatie(null); },
      route: (a, b) => {
        if (!navigatie) navigatie = new Navigatie(KAART.wegassen);
        return navigatie.route([a.x, a.z], [b.x, b.z]);
      },
      verdien: (n) => verdien(n),
      sterren: () => sterren(),
      sterGeven: (n, x, z) => { if (sterGeven) sterGeven(n, x, z); },
      bende: { zetGroep: (x, z, n) => bendes.zetGroep(x, z, n) },
      checkpoint: () => { if (checkpoint && player.health > 0) { checkpoint(); hud.show('Checkpoint opgeslagen', 2); } },
      spelerPunt: () => spelerPunt(),
      KOPPEN,
      // Johan ken je vanaf zijn telefoontje in missie 5
      johanBekend: () => !VOOR_JOHAN.includes(missie) && !(missie === 'johan' && fase === 'telefoon')
        && !(missie === 'klaar' && naMissieNaam === 'johan' && naMissieT > 0),
      // staat hij al ergens voor het verhaal? dan geeft de ander de klus
      inBeeld: (wie) => (wie === 'mark' ? mark.groep.visible : !!(johan && johan.groep.visible)),
      // waar het verhaal iets heeft staan: daar komt geen klus
      bezet: () => {
        const uit = [{ x: thuis.x, z: thuis.z }];
        if (navDoel && !klusPauze) uit.push({ x: navDoel.x, z: navDoel.z });
        if (klusPauze && klusPauze.navDoel) uit.push({ x: klusPauze.navDoel.x, z: klusPauze.navDoel.z });
        if (mark.groep.visible) uit.push({ x: mark.groep.position.x, z: mark.groep.position.z });
        if (johan && johan.groep.visible) uit.push({ x: johan.groep.position.x, z: johan.groep.position.z });
        return uit;
      },
    },
  });

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
    klusjes.reset(); klusPauze = null;
    gesprek = null; sluitBalk();
    zetOpdracht('');
    hud.zetNavigatie(null); navDoel = null;
    markDoel = null; markNa = null;
    spanning = false; spanningUit = 0;
    naMissieT = 0;
    ruimBomOp();
    ruimSniperOp();
    ruimVeteraanOp();
    ruimPolitieautoOp();
    ruimBrugOp();
    ruimSchriftOp();
    ruimRaceOp();
    ruimSchaduwOp();
    ruimInvalOp();
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
    else if (naam === 'huis') beginHuis();
    else if (naam === 'veteraan') beginVeteraan();
    else if (naam === 'politieauto') beginPolitieauto();
    else if (naam === 'brug') beginBrug();
    else if (naam === 'schrift') beginSchrift();
    else if (naam === 'race') beginRace();
    else if (naam === 'schaduw') beginSchaduw();
    else if (naam === 'inval') beginInval();
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
  const weg = { mark: false, bx: false, vet: false };
  function ruimOpUitZicht() {
    if (!weg.mark && !weg.bx && !weg.vet) return;
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
    // De Veteraan na het gesprek: hij loopt weg zodra je niet meer kijkt
    if (weg.vet && vet && vet.veteraan.groep.visible) {
      const p = vet.veteraan.groep.position;
      if (uitZicht(p.x, p.z)) { vet.toon(false); weg.vet = false; }
    } else if (weg.vet && (!vet || !vet.veteraan.groep.visible)) weg.vet = false;
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
    if (doodT > 0 || keuzeOpen) return;
    doodT = 2.6;
    spanning = false; spanningUit = 0;
    hud.melding('NEERGEGAAN', 'Kies hoe je verder gaat.', 3);
    player.active = false;
  }
  /*
   Na het neergaan een keuze (verzoek 26 sep 2026: "na doodgaan altijd optie
   geven om vanaf het laatste checkpoint, dus na de laatste missie, te
   herstarten"):
     1  de missie opnieuw vanaf zijn herstelpunt (buiten een missie: hier weer
        opstaan)
     2  terug naar het checkpoint na de laatste afgeronde missie
     3  je eigen opgeslagen spel (F5)
   Met de muis of met 1, 2 en 3. Een proef (`window.__autoplay`) kiest meteen wat
   er vóór deze keuze gebeurde: de eigen opslag, en anders de missie opnieuw.
  */
  const keuzeEl = document.getElementById('doodkeus');
  function naDeDood() {
    bendes.reset();
    player.health = 100;
    hud.zetLeven(player.health);
    if (window.__autoplay || !keuzeEl) {
      player.active = true;
      const geladen = ctx.opnieuw && ctx.opnieuw();
      if (!geladen) herstartMissie();
      return;
    }
    toonKeuze();
  }
  function toonKeuze() {
    keuzeOpen = true;
    const inMissie = missie !== 'klaar';
    const knoppen = keuzeEl.querySelectorAll('button');
    const tekst = {
      missie: inMissie ? 'De missie opnieuw, vanaf het laatste herstelpunt' : 'Hier weer opstaan',
      checkpoint: 'Terug naar het laatste checkpoint (na de laatste missie)',
      opslag: 'Je laatste opgeslagen spel (F5)',
    };
    const kan = { missie: true, checkpoint: heeftCheckpoint(), opslag: heeftOpslag() };
    let nr = 0;
    for (const k of knoppen) {
      const soort = k.dataset.keuze;
      k.hidden = !kan[soort];
      if (!k.hidden) k.textContent = `${++nr} · ${tekst[soort]}`;
      k.dataset.nr = k.hidden ? '' : String(nr);
    }
    keuzeEl.hidden = false;
    if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock();
  }
  function kies(soort) {
    if (!keuzeOpen) return;
    keuzeOpen = false;
    keuzeEl.hidden = true;
    player.active = true;
    hud.melding('', '', 0);
    let gelukt = false;
    if (soort === 'checkpoint' && naarCheckpoint) gelukt = naarCheckpoint();
    else if (soort === 'opslag' && naarOpslag) gelukt = naarOpslag();
    if (!gelukt) herstartMissie();
    else {
      // een geladen spel draait gewoon door: de missie van dat moment weer op gang
      player.health = 100; hud.zetLeven(player.health);
    }
    if (vergrendel) vergrendel();
  }
  if (keuzeEl) {
    keuzeEl.addEventListener('click', (e) => {
      const k = e.target.closest('button');
      if (k && !k.hidden) kies(k.dataset.keuze);
    });
    // 1, 2 en 3 zolang de keuze er staat; vóór de rest van het spel, want 1 tot en
    // met 3 kiezen ook een woning in missie 9
    window.addEventListener('keydown', (e) => {
      if (!keuzeOpen) return;
      const k = [...keuzeEl.querySelectorAll('button')].find(b => !b.hidden && b.dataset.nr === e.key);
      if (!k) return;
      e.preventDefault(); e.stopImmediatePropagation();
      kies(k.dataset.keuze);
    }, true);
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
    if (missie === 'huis') { hervatHuis(punt && punt.missie === 'huis' ? punt.fase : 'telefoon'); return; }
    if (missie === 'veteraan') { hervatVeteraan(punt && punt.missie === 'veteraan' ? punt.fase : 'telefoon'); return; }
    if (missie === 'politieauto') { hervatPolitieauto(punt && punt.missie === 'politieauto' ? punt.fase : 'wacht'); return; }
    if (missie === 'brug') { hervatBrug(punt && punt.missie === 'brug' ? punt.fase : 'wacht'); return; }
    if (missie === 'schrift') { hervatSchrift(punt && punt.missie === 'schrift' ? punt.fase : 'wacht'); return; }
    if (missie === 'race') { hervatRace(punt && punt.missie === 'race' ? punt.fase : 'telefoon'); return; }
    if (missie === 'schaduw') { hervatSchaduw(punt && punt.missie === 'schaduw' ? punt.fase : 'telefoon'); return; }
    if (missie === 'inval') { hervatInval(punt && punt.missie === 'inval' ? punt.fase : 'telefoon'); return; }
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
    } else if (missie === 'klaar' && huisGekozen && stekMet(huisGekozen)) {
      /*
       Neergegaan buiten een missie om — door de bende op straat, na missie 10.
       Je wordt wakker voor je eigen voordeur en niet voor die van Mark aan de
       Molenkrite, waar het spel ooit begon.
      */
      const d = stekDeur(stekMet(huisGekozen));
      player.inCar = null;
      const [px, pz] = resolveCollisions(d.x, d.z, 0.4);
      player.pos.set(px, 0, pz); player.applyCamera();
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
    // een klus (js/klusjes.js): aannemen, of de tas afgeven; en zolang er een loopt doet
    // de missie die onder zijn M op je wacht niets
    if (klusjes.toets()) return true;
    if (klusjes.bezig && missie !== 'klaar') return false;
    // missie 11: aan de balie van Tinga State de C4 ophalen, vóór het kopen daar
    if (bijDeBalie()) return haalC4();
    // missie 12: een dranghek, een lading C4, of de knal zelf
    if (brugToets()) return true;
    // missie 13: het schrift uit de sloep
    if (bijDeSloep()) return pakSchrift();
    // missie 15: een foto bij de loods
    if (schaduwToets()) return true;
    // missie 16: het schrift, de foto's, de tas op de brug, de auto van Bouwman
    if (invalToets()) return true;
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
    /*
     Missie 9: binnen aan de tafel van een van de drie woningen koop je hem. Dat
     gaat vóór het gaan zitten aan diezelfde tafel (js/interieur.js laat zijn
     eigen hint weg zolang `aanspreekbaar` waar is).
    */
    if (huisAanbod && !huisGekozen && !player.zit) {
      const w = huisOnder(spelerPunt());
      if (w && w.bijTafel(player.pos.x, player.pos.z)) return koopHuis(w);
    }
    // missie 10: de tas bij de tribune oppakken
    if (bijDeTas()) return pakTas();
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
    // de groepjes van De Veteraan op straat
    uit.push(...bendes.doelen());
    // wie je voor een klus moet omleggen, en zijn lijfwacht
    uit.push(...klusjes.doelen());
    // en de maffia op de kade plus de waterpolitie uit missie 8
    if (deal) uit.push(...deal.doelen());
    for (const b of snipBoten) uit.push(...b.doelen());
    // De dief is ook een doel — maar raak je hem, dan is de missie mislukt.
    if (dief && missie === 'johan' && (fase === 'naar_dewieken' || fase === 'achtervolging')) uit.push(...dief.doelen);
    return uit;
  }

  function raak(obj) {
    if (klusjes.raak(obj)) return true;
    // de zes man bij de Poiesz: die mogen juist wel
    if (schutters && schutters.raak(obj)) return true;
    // en de bende op straat na missie 10: die begon zelf
    if (bendes.raak(obj)) return true;
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
    bendes.hoorSchot(x, z);
    klusjes.hoorSchot(x, z);
    invalSchot(x, z);
    // missie 12: wie bij de hekken schiet voor de knal, begint het gevecht zelf
    if (missie === 'brug' && schutters && schutters.rustig && (fase === 'stop' || fase === 'ontsteken')) {
      const v = schutters.wachters[0] && schutters.wachters[0].persoon.groep.position;
      if (v && Math.hypot(v.x - x, v.z - z) < 90) { schutters.rustig = false; schutters.alarm = true; }
    }
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
        // en een minuut later belt Mark over de drie woningen (missie 9)
        if (!huisGekozen) { naMissieT = HUIS_WACHT; naMissieNaam = 'huis'; }
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
    rijAan(stop0, vx, vz, sp, BOM_AUTOS, BOM_TUSSEN);
  }

  /*
   De auto's op de weg zetten, `n` achter elkaar vanaf `stop0`. Missie 7 en 10
   delen dit: de wegas onder de stopplek geeft de rijrichting, ze komen van de
   kant die het verst van de speler ligt en stappen uit aan de kant van de
   speler. (vx, vz) is de richting waar de weg niet te vinden is.
  */
  function rijAan(stop0, vx, vz, sp, n, tussen) {
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
    /*
     De weg zelf, vanaf de stopplek terug naar waar ze vandaan komen. Rechtdoor
     rijden ging goed op de rechte straat voor de Poiesz, maar de Molenkrite
     buigt langs het sportpark en daar reden ze door de gevels (missie 10). Nu
     volgen ze de wegas: bij elke knoop de tak die het meest rechtdoor gaat.
    */
    const lijn = k >= 0 ? wegLangs(k, tx, tz, BOM_AANRIJ + n * tussen + 5)
      : [[stop0.x, stop0.z], [stop0.x + tx * (BOM_AANRIJ + n * tussen + 5), stop0.z + tz * (BOM_AANRIJ + n * tussen + 5)]];
    aanrijders = [];
    schutterAutos = [];
    for (let i = 0; i < n; i++) {
      // achter elkaar: de eerste vooraan, de rest een paar meter erachter
      const s0 = i * tussen;
      const doel = opLijn(lijn, s0);
      const start = opLijn(lijn, s0 + BOM_AANRIJ);
      // met de neus tegen de lijn in: ze rijden naar de stopplek toe
      const auto = vehicles.voegToe({
        x: start.x, z: start.z, yaw: Math.atan2(start.ux, start.uz),
        soort: i % 2 ? 'van' : 'hatch', kleur: i % 2 ? 0x2b2f36 : 0x1d1f24, driveable: false,
      });
      // dwars op de weg, naar de speler toe: aan die kant stappen ze uit
      let zx = -doel.uz, zz = doel.ux;
      if ((sp.x - doel.x) * zx + (sp.z - doel.z) * zz < 0) { zx = -zx; zz = -zz; }
      schutterAutos.push(auto);
      aanrijders.push({ auto, doel, lijn, s0, s: s0 + BOM_AANRIJ, zij: { x: zx, z: zz },
        snelheid: BOM_AANRIJ_V, piep: false, stil: false });
    }
  }

  // Een stuk weg over het wegennet vanaf knoop k, zoveel meter in richting (tx, tz).
  function wegLangs(k, tx, tz, lengte) {
    const P = navigatie.punten;
    const lijn = [[P[k][0], P[k][1]]];
    let hier = k, vorige = -1, dx = tx, dz = tz, af = 0;
    while (af < lengte) {
      let beste = -1, besteS = 0.3;
      for (const b of navigatie.bogen[hier] || []) {
        if (b.naar === vorige || !navigatie.rijbaan[b.naar]) continue;
        const L = Math.hypot(P[b.naar][0] - P[hier][0], P[b.naar][1] - P[hier][1]) || 1;
        const sc = ((P[b.naar][0] - P[hier][0]) * dx + (P[b.naar][1] - P[hier][1]) * dz) / L;
        if (sc > besteS) { besteS = sc; beste = b.naar; }
      }
      if (beste < 0) break;
      const L = Math.hypot(P[beste][0] - P[hier][0], P[beste][1] - P[hier][1]);
      if (L > 0.01) { dx = (P[beste][0] - P[hier][0]) / L; dz = (P[beste][1] - P[hier][1]) / L; }
      af += L;
      lijn.push([P[beste][0], P[beste][1]]);
      vorige = hier; hier = beste;
    }
    // houdt het wegennet op, dan rechtdoor verder
    if (af < lengte) {
      const p = lijn[lijn.length - 1];
      lijn.push([p[0] + dx * (lengte - af), p[1] + dz * (lengte - af)]);
    }
    return lijn;
  }
  // Het punt op `s` meter langs de lijn, met de richting van de lijn daar.
  function opLijn(lijn, s) {
    let rest = Math.max(0, s);
    for (let i = 1; i < lijn.length; i++) {
      const a = lijn[i - 1], b = lijn[i];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 1e-6) continue;
      const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
      if (rest <= L || i === lijn.length - 1) {
        const t = Math.min(rest, L);
        return { x: a[0] + ux * t, z: a[1] + uz * t, ux, uz };
      }
      rest -= L;
    }
    return { x: lijn[0][0], z: lijn[0][1], ux: 1, uz: 0 };
  }
  // Ze staan er al (na het neergaan): meteen op hun plek, met de neus goed.
  function zetAanrijdersStil() {
    for (const a of aanrijders) {
      a.s = a.s0; a.stil = true; a.auto.speed = 0;
      a.auto.x = a.doel.x; a.auto.z = a.doel.z; a.auto.yaw = Math.atan2(a.doel.ux, a.doel.uz);
      if (a.auto.mesh) {
        a.auto.mesh.position.set(a.auto.x, a.auto.mesh.position.y, a.auto.z);
        a.auto.mesh.rotation.y = a.auto.yaw;
      }
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
      const d = Math.max(0.0001, a.s - a.s0);          // wat er nog over de weg te rijden is
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
      a.s -= stap;
      const p = opLijn(a.lijn, a.s);
      a.auto.x = p.x; a.auto.z = p.z;
      a.auto.yaw = Math.atan2(p.ux, p.uz);
      a.auto.speed = a.snelheid;
      if (a.auto.mesh) {
        a.auto.mesh.position.set(a.auto.x, a.auto.mesh.position.y, a.auto.z);
        a.auto.mesh.rotation.y = a.auto.yaw;
      }
      if (d - stap < 0.4) { a.stil = true; a.auto.speed = 0; }
    }
    return allemaalStil;
  }

  /*
   De zes man stappen uit: twee per auto, aan de kant van de speler. Dit gebeurt
   bewust pas ná het aanrijden en ná de regel van Mark — eerst hoor je ze
   aankomen, dan pas staan ze er.
  */
  /*
   `perAuto` zegt hoeveel man er uit elke auto komt (missie 10: drie, drie, twee
   en twee) en `bende` gaat door naar js/bewaking.js; zonder die twee is het de
   bende uit missie 7.
  */
  /*
   `plekken` (missie 10): waar ze na het uitstappen gaan staan, [{ x, z }] met
   `kijk` als het punt waar ze naar uitkijken. Zonder is het eind van hun post
   vier meter van de auto af.
  */
  function latenUitstappen(perAuto = null, bende = undefined, plekken = null) {
    if (schutters || !aanrijders.length) return;
    const posten = [];
    for (const [k, a] of aanrijders.entries()) {
      const zx = a.zij.x, zz = a.zij.z;
      const n = perAuto ? perAuto[k] || 0 : BOM_MANNEN / BOM_AUTOS;
      for (let j = 0; j < n; j++) {
        // voor- en achterportier, en met drie man ook een in het midden
        const langs = n === 2 ? (j ? 1.7 : -1.7) : (j - (n - 1) / 2) * 1.7;
        const px = a.auto.x + zx * 2.2 + Math.cos(a.auto.yaw) * langs;
        const pz = a.auto.z + zz * 2.2 - Math.sin(a.auto.yaw) * langs;
        const [mx, mz] = resolveCollisions(px, pz, 0.4);
        const plek = plekken && plekken.lijst.length ? plekken.lijst[posten.length % plekken.lijst.length] : null;
        posten.push(plek ? { a: [mx, mz], b: [plek.x, plek.z], kijk: plekken.kijk, via: plek.via }
          : { a: [mx, mz], b: [mx + zx * 4, mz + zz * 4] });
      }
    }
    schutters = new Bewaking(scene, posten, bende);
    schutters.alarm = true;            // ze komen voor jou, ze hoeven niets te zien
    // zes man die het vuur openen op een parkeerterrein: wie er loopt gaat weg
    if (paniek) paniek(aanrijders[0].auto.x, aanrijders[0].auto.z, BOM_PANIEK * 0.6);
    for (const w of schutters.wachters) w.staat = 'aanval';
    // Mark trekt zijn pistool, en jij kunt de jouwe in elk geval pakken: zonder
    // wapen is dit geen gevecht maar een executie. Bij VV Sneek sta je alleen.
    if (missie === 'bom') mark.geefWapen('pistool');
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
        + Math.floor(Math.random() * (BOM_BUIT_KOGELS[1] - BOM_BUIT_KOGELS[0] + 1)), w.persoon.grond);
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
      opDeBank(mark, woning.plekken, { x: sp.x, z: sp.z });
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
      // hij zit te praten op de bank
      mark.update(dt, { zit: BANK_ZITTING });
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
    zetAanrijdersStil();                    // ze staan er al, dus meteen op hun plek
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
    if (f === 'terug' || f === 'afronding' || f === 'slapen') {
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

  /*
   ---------- missie 9: een eigen stek ----------

   De drie woningen komen uit js/interieur.js: dezelfde module die achter de
   voordeur van Molenkrite 15 en de Wieken 29 zit, nu ook voor Zeskanter 14,
   Spinnekop 127 en Grootwiel 12. Het verhaal hoeft er alleen de voordeur, de
   prijs en de tafel van te weten.

   Mark loopt niet echt met je mee de wijk door — hij staat er eerder dan jij.
   Kom je binnen vijfenvijftig meter van een van de drie, dan staat hij op het
   tegelpad, en zodra je er vlakbij bent zegt hij wat hij ervan vindt. Dat is
   eerlijker dan een tweede route-zoeker voor een man die toch alleen maar
   commentaar levert, en je ziet hem nooit tevoorschijn komen.
  */
  let huisT = 0;                 // telefoon
  let huisBinnen = null;         // in welke van de drie je nu binnen staat
  let gestald = null;            // de auto die op de oprit van een woning staat
  let huisGekozen = null;        // het adres dat je gekocht hebt (blijft na de missie)
  let huisAanbod = false;        // het aanbod staat open: je kunt (nog) kopen
  let huisBij = null;            // bij welke woning Mark nu staat
  let huisKeus = null;           // welk van de drie je met 1, 2 of 3 hebt gekozen
  const huisGezegd = new Set();  // waar Mark zijn zegje al gedaan heeft
  const huisGezien = new Set();  // waar je binnen bent geweest

  function stekLijst() {
    const l = stekken ? stekken() : null;
    return Array.isArray(l) ? l.filter(w => w && w.stek) : [];
  }
  function stekDeur(w) { return w.plekken.deurBuiten; }
  function stekMet(naam) { return stekLijst().find(w => w.naam === naam) || null; }

  /*
   De vlaggetjes op de kaart (js/hud.js tekent ze als huisje). Tijdens het
   kiezen staan alle drie de woningen erop met hun prijs; daarna alleen de jouwe,
   zodat je je eigen stek terugvindt.
  */
  function huisMarkeringen() {
    if (huisGekozen) {
      const w = stekMet(huisGekozen);
      if (!w) return [];
      const d = stekDeur(w);
      return [{ x: d.x, z: d.z, naam: 'je stek', wat: 'huis' }];
    }
    /*
     Zolang het aanbod openstaat blijven ze op de kaart staan, ook als de missie
     zelf al is afgerond omdat je alle drie hebt bekeken zonder te kopen
     (verzoek 23 sep 2026).
    */
    if (!huisAanbod) return [];
    return stekLijst().map(w => {
      const d = stekDeur(w);
      return { x: d.x, z: d.z, naam: `${w.naam} · ${euro(w.prijs)}`, wat: 'huis' };
    });
  }

  function beginHuis() {
    fase = 'telefoon';
    huisT = 1.2;
    huisBij = null;
    huisKeus = null;
    huisGezegd.clear();
    huisGezien.clear();
    huisBinnen = null;
    zetOpdracht('neem de telefoon op');
    hud.zetNavigatie(null); navDoel = null;
    markZichtbaar(false);
  }

  // Mark voor de deur van de Wieken 29, waar missie 7 ook begon
  function markBijDeWieken() {
    const pand = pandVan(HUIS_THUIS);
    const v = pand ? voorPunt(pand, 5.5) : null;
    if (!v) return null;
    const [mx, mz] = resolveCollisions(v.x, v.z, 0.4);
    mark.zetNeer(mx, mz, kijkHoek({ x: mx, z: mz }, { x: pand.rect.cx, z: pand.rect.cz }));
    markZichtbaar(true);
    return { x: mx, z: mz };
  }

  // Mark op het tegelpad van de woning waar je naartoe loopt
  function markBijHuis(w) {
    const d = stekDeur(w);
    const pand = pandVan({ straat: w.naam.split(' ').slice(0, -1).join(' '), nr: w.naam.split(' ').pop() });
    const v = pand ? voorPunt(pand, 4.5) : { x: d.x, z: d.z };
    const [mx, mz] = resolveCollisions(v.x + 1.2, v.z + 1.2, 0.4);
    mark.zetNeer(mx, mz, kijkHoek({ x: mx, z: mz }, d));
    markZichtbaar(true);
    huisBij = w;
  }

  // In welke van de drie sta je?
  function huisOnder(sp) {
    return stekLijst().find(w => w.binnen(sp.x, sp.z)) || null;
  }

  /*
   Kopen, aan de tafel in de woonkamer. Heb je het geld niet, dan belt Mark en
   blijft de missie staan waar hij staat: de drie vlaggen blijven op de kaart en
   je komt terug als je het hebt.
  */
  function koopHuis(w) {
    if (!w) return false;
    if (!betaal(w.prijs)) {
      praatEl.hidden = true;
      geluid.telefoon();
      zeg(HUIS_ARM, null, { wie: 'Mark', telefoon: true, kop: KOPPEN.mark });
      hud.melding('Te weinig geld', `${w.naam} kost ${euro(w.prijs)}.`, 4);
      return true;
    }
    huisGekozen = w.naam;
    huisAanbod = false;
    praatEl.hidden = true;
    hud.zetNavigatie(null); navDoel = null;
    markZichtbaar(false);
    zeg(HUIS_KLAAR, () => {
      missie = 'klaar'; fase = 'klaar';
      spanningUit = 6;
      hud.melding('MISSIE VOLTOOID – EEN EIGEN STEK',
        `${w.naam} is van jou · ${euro(w.prijs)} sleutelgeld betaald`, 8);
      // en even later belt De Veteraan zelf (missie 10)
      if (!vetKlaar) { naMissieT = VET_WACHT; naMissieNaam = 'veteraan'; }
    }, { wie: 'Mark', telefoon: true, kop: KOPPEN.mark });
    return true;
  }

  function werkHuisBij(dt, sp) {
    if (fase === 'klaar') return;
    if (fase !== 'telefoon') {
      navKlok += dt;
      if (navKlok > 2) { navKlok = 0; werkNavBij(); }
    }

    // -- de telefoon: Mark belt een minuut na de deal bij de molen
    if (fase === 'telefoon') {
      if (huisT > 0) {
        huisT -= dt;
        if (huisT <= 0) {
          geluid.telefoon();
          zeg(HUIS_TELEFOON, () => {
            fase = 'naar_mark'; zetPunt(fase);
            zetOpdracht('ga naar Mark bij de Wieken 29');
            const p = markBijDeWieken();
            if (p) zetNavDoel(p.x, p.z, 'Mark bij de Wieken', 'M');
            hud.melding('NIEUWE MISSIE', 'Mark wacht bij de Wieken 29.', 5);
            spanning = true; spanningUit = 0;
          }, { wie: 'Mark', telefoon: true, kop: KOPPEN.mark });
        }
      }
      return;
    }

    // -- bij Mark voor de deur
    if (fase === 'naar_mark') {
      if (!mark.groep.visible) { markBijDeWieken(); return; }
      const d = afst(sp, mark.groep.position);
      if (d > PRAAT_AFSTAND || !balk.hidden) return;
      fase = 'briefing';
      hud.zetNavigatie(null); navDoel = null;
      zeg(HUIS_BRIEFING, () => {
        fase = 'kiezen'; zetPunt(fase);
        huisAanbod = true;
        zetOpdracht('kies met 1, 2 of 3 waar je gaat kijken');
        hud.melding('Drie woningen', 'Druk 1, 2 of 3 — de navigatie gaat erheen.', 6);
      });
      return;
    }

    // -- de drie woningen langs, en binnen aan tafel kiezen
    if (fase === 'kiezen') {
      const lijst = stekLijst();
      if (!lijst.length) return;
      // de dichtstbijzijnde woning bepaalt waar Mark staat
      let dichtst = null, dichtstD = Infinity;
      for (const w of lijst) {
        const d = stekDeur(w);
        const afstand = w.binnen(sp.x, sp.z) ? 0 : Math.hypot(sp.x - d.x, sp.z - d.z);
        if (afstand < dichtstD) { dichtstD = afstand; dichtst = w; }
      }
      if (dichtst && dichtstD < HUIS_DICHTBIJ) {
        if (huisBij !== dichtst) markBijHuis(dichtst);
        if (dichtstD < 14 && balk.hidden && !huisGezegd.has(dichtst.naam)) {
          huisGezegd.add(dichtst.naam);
          zeg(HUIS_BIJ[dichtst.soort] || HUIS_BIJ.gewoon, null, { auto: 3.2 });
        }
      } else if (mark.groep.visible) {
        /*
         Ga je op pad, dan verdwijnt Mark van de stoep bij de Wieken. Hij staat
         even later bij de woning waar je aankomt, en zo lijkt het alsof hij
         meegaat (verzoek 23 sep 2026).
        */
        markZichtbaar(false); huisBij = null;
      }
      /*
       Binnen geweest? Dan is die woning bekeken. En stap je weer naar buiten
       terwijl er nog woningen over zijn, dan zegt het spel meteen welke cijfers
       er nog te kiezen zijn en legt de navigatie alvast op de dichtstbijzijnde
       die je nog niet hebt gezien — anders moest je maar raden dat 1, 2 of 3 nog
       werkte (melding 23 sep 2026).
      */
      const hier = huisOnder(sp);
      if (hier) { huisGezien.add(hier.naam); huisBinnen = hier.naam; }
      else if (huisBinnen) {
        huisBinnen = null;
        const over = lijst.filter(w => !huisGezien.has(w.naam));
        if (over.length) {
          const nrs = over.map(w => lijst.indexOf(w) + 1);
          const toets = nrs.length > 1 ? `${nrs.slice(0, -1).join(', ')} of ${nrs[nrs.length - 1]}` : `${nrs[0]}`;
          hud.melding(over.length === 1 ? 'Nog één te bekijken' : `Nog ${over.length} te bekijken`,
            `Druk ${toets} · ${over.map(w => `${w.naam} (${euro(w.prijs)})`).join(' · ')}`, 7);
          zetOpdracht(`druk ${toets} voor de volgende woning`);
          let dicht = over[0], dichtD = Infinity;
          for (const w of over) {
            const d = stekDeur(w);
            const a = Math.hypot(sp.x - d.x, sp.z - d.z);
            if (a < dichtD) { dichtD = a; dicht = w; }
          }
          const dd = stekDeur(dicht);
          zetNavDoel(dd.x, dd.z, dicht.naam, 'H');
        }
      }
      /*
       Alle drie bekeken en niets gekocht: dan is de missie klaar en loopt het
       verhaal door. Het aanbod blijft staan — de vlaggen op de kaart ook — dus
       je koopt er later alsnog een als je het geld hebt (verzoek 23 sep 2026).
      */
      if (!huisGekozen && lijst.every(w => huisGezien.has(w.naam)) && balk.hidden) {
        fase = 'rondje';
        hud.zetNavigatie(null); navDoel = null;
        markZichtbaar(false); huisBij = null;
        zeg(HUIS_ALLEDRIE, () => {
          missie = 'klaar'; fase = 'klaar';
          spanningUit = 6;
          zetOpdracht('');
          hud.melding('MISSIE VOLTOOID – EEN EIGEN STEK',
            'Je hebt ze alle drie gezien · koop er een zodra je het geld hebt', 8);
        });
        return;
      }
      koopHint(sp);
      return;
    }
  }

  /*
   De koopregel aan tafel. Staat los van de missiefase, want het aanbod blijft
   openstaan nadat je alle drie hebt bekeken.
  */
  function koopHint(sp) {
    if (!huisAanbod || huisGekozen || player.inCar || player.zit || !balk.hidden) return;
    const hier = huisOnder(sp);
    if (!hier || !hier.bijTafel(player.pos.x, player.pos.z)) return;
    praatEl.textContent = `E — ${hier.naam} kopen (${euro(hier.prijs)})`;
    praatEl.hidden = false;
  }

  /*
   ---------- de auto op de oprit ----------
   Naast de voordeur van elk van de drie woningen ligt een oprit (js/interieur.js).
   Zet je daar je auto neer en stap je uit, dan onthoudt het verhaal welke auto
   dat was; bij het laden staat hij er weer (verzoek 23 sep 2026). Dat is het enige
   wat een auto in dit spel blijvend maakt — verder staat alles waar de kaart het
   heeft neergezet.
  */
  const STAL_BEREIK = 3.4;
  function werkStallingBij() {
    if (player.inCar || !vehicles || !vehicles.nearestDriveable) return;
    for (const w of stekLijst()) {
      const o = w.plekken && w.plekken.oprit;
      if (!o) continue;
      const car = vehicles.nearestDriveable(o.x, o.z);
      if (!car) continue;
      if (Math.hypot(car.x - o.x, car.z - o.z) > STAL_BEREIK) continue;
      const nieuw = { huis: w.naam, x: car.x, z: car.z, yaw: car.yaw,
        soort: car.soort || 'hatch', kleur: car.kleur ?? 0xd8d9dc };
      const anders = !gestald || gestald.huis !== nieuw.huis
        || Math.hypot(gestald.x - nieuw.x, gestald.z - nieuw.z) > 1.2;
      gestald = nieuw;
      if (anders) hud.melding('Op de oprit', `Je auto staat bij ${w.naam} en blijft daar staan.`, 4);
      return;
    }
  }

  /*
   Kiezen met 1, 2 of 3 (js/main.js hangt de toetsen eraan). De navigatie gaat
   naar die woning; je mag onderweg van gedachten veranderen.
  */
  function kiesHuis(nr) {
    // (na een verloren race in missie 14 gaan 1 en 2 over de keuze bij Bouwman)
    if (missie === 'race' && fase === 'keuze') return raceKeuze(nr);
    // (en in missie 16 over de ruil op de brug)
    if (missie === 'inval' && fase === 'keuze') return invalKeuze(nr);
    if (!huisAanbod || huisGekozen) return false;
    const lijst = stekLijst();
    const w = lijst[nr - 1];
    if (!w) return false;
    huisKeus = w.naam;
    const d = stekDeur(w);
    zetNavDoel(d.x, d.z, w.naam, 'H');
    zetOpdracht(`ga kijken bij ${w.naam} (${euro(w.prijs)})`);
    hud.melding(`Keuze ${nr}`, `${w.naam} · ${euro(w.prijs)} · ${w.beschrijving}`, 5);
    return true;
  }

  // Ga je neer tijdens het kiezen, dan sta je weer bij Mark voor de deur.
  function hervatHuis(f) {
    beginHuis();
    if (f === 'telefoon') return;
    huisT = 0;
    if (f === 'naar_mark') {
      fase = 'naar_mark';
      zetOpdracht('ga naar Mark bij de Wieken 29');
      const p = markBijDeWieken();
      if (p) zetNavDoel(p.x, p.z, 'Mark bij de Wieken', 'M');
      spanning = true; spanningUit = 0;
      return;
    }
    fase = 'kiezen';
    zetOpdracht('bekijk de drie woningen en kies er een');
    spanning = true; spanningUit = 0;
  }


  /*
   ---------- missie 10: De Veteraan ----------

   Zeven stappen: de telefoon, De Veteraan op het Sneekerpad, de tas bij de
   tribune, de vier auto's, het vuurgevecht, de lege plek bij het molentje met
   Mark aan de lijn, en naar huis. De bende gebruikt `schutters` en de aanrit van
   missie 7, dus het schieten, de schade, de wapens die ze laten vallen en het
   opruimen gaan vanzelf mee.
  */
  let vet = null;                // De Veteraan en zijn hondje (js/deal.js)
  let vetT = 0;                  // klok voor wat vanzelf doorloopt
  let tas = null;                // de sporttas bij de tribune (js/tas.js)
  let tasMerk = null;            // het gele ruitje erboven (js/bom.js)
  let tasBij = false;            // heb je hem bij je?
  let vetKlaar = false;          // is deze missie ooit afgerond?
  let vetPunt = null;            // { x, z, langs, molen }
  let tribunePunt = null;        // { tas, yaw, veld, weg }
  let tasHint = false;           // staat "E — de tas pakken" in beeld?
  let zwart = null;              // de overgang naar de nacht: { t, gesprongen }
  let ingangPunt = null;         // { weg, kijk, lijst }: waar de bende gaat staan

  /*
   Zijn plek: het punt op het fietspad dat het dichtst bij De Terpensmole ligt.
   In de BGT heet dat stuk pad tussen Sneek en IJlst "Tinga"; het loopt van de
   wijk langs het molentje en gaat bij De Rat over in het Sneekerpad.
  */
  function veteraanPlek() {
    if (vetPunt) return vetPunt;
    const mol = (KAART.molens || []).find(m => VET_MOLEN.test(m.naam || ''))
      || (KAART.molens || []).find(m => m.soort === 'spinnenkop');
    if (!mol) return null;
    let beste = null;
    for (const as of KAART.wegassen || []) {
      if (as.drive) continue;
      for (let i = 1; i < as.pts.length; i++) {
        const a = as.pts[i - 1], b = as.pts[i];
        const dx = b[0] - a[0], dz = b[1] - a[1];
        const L2 = dx * dx + dz * dz;
        if (L2 < 1e-6) continue;
        const t = Math.max(0, Math.min(1, ((mol.cx - a[0]) * dx + (mol.cz - a[1]) * dz) / L2));
        const x = a[0] + dx * t, z = a[1] + dz * t;
        const d = Math.hypot(x - mol.cx, z - mol.cz);
        if (d > VET_PAD || (beste && d >= beste.d)) continue;
        const L = Math.sqrt(L2);
        beste = { d, x, z, langs: { x: dx / L, z: dz / L } };
      }
    }
    if (!beste) {
      // geen pad in de buurt: dan maar een paar meter voor de molen
      beste = { d: 8, x: mol.cx + 8, z: mol.cz, langs: { x: 0, z: 1 } };
    }
    const [x, z] = resolveCollisions(beste.x, beste.z, 0.4);
    vetPunt = { x, z, langs: beste.langs, molen: { x: mol.cx, z: mol.cz }, naam: mol.naam };
    return vetPunt;
  }

  /*
   De tribune van het hoofdveld van VV Sneek. De tas staat op de tegels vóór de
   onderste trede, naast het trapje in het midden, want daar kom je als je om
   de tribune heen loopt. De maten zijn dezelfde als in js/sportveld.js:
   `vx, vz` is de voorgevel van de kantine, `d` de afstand naar het veld toe.
  */
  function tribune() {
    if (tribunePunt) return tribunePunt;
    const v = (KAART.sportvelden || []).find(q => BX_VELD.test(q.naam || '') && q.tribune);
    if (!v) return null;
    const T = v.tribune;
    const ax = Math.cos(T.hoek), az = Math.sin(T.hoek);
    const nx = -az * T.kant, nz = ax * T.kant;               // van het veld af
    const punt = (l, d) => ({ x: T.vx + ax * l - nx * d, z: T.vz + az * l - nz * d });
    const plek = punt(2.6, T.diep + 1.0);
    /*
     Waar de bende uitstapt, en hoe ze bij de tribune komen. De voorkant van het
     sportpark is de rijbaan die er het dichtst bij ligt: het inritje van het
     clubparkeerterrein aan de Molenkrite. Daar ligt de kantine tussen, en rond
     het veld staan hekken en borden, dus ze krijgen een looproute mee
     (js/looppad.js). Is er geen route, dan de plek op de weg met vrij zicht.
    */
    if (!navigatie) navigatie = new Navigatie(KAART.wegassen);
    const k = navigatie.naaste(plek.x, plek.z, 400, true);
    let weg = k >= 0 ? { x: navigatie.punten[k][0], z: navigatie.punten[k][1] } : null;
    let pad = weg ? zoekLooppad(weg, plek, { laag: VET_LAAG }) : null;
    if (!pad) {
      weg = wegVoorHetTerrein(plek);
      pad = weg ? zoekLooppad(weg, plek, { laag: VET_LAAG }) : null;
    }
    tribunePunt = { tas: plek, yaw: -T.hoek, veld: { x: v.cx, z: v.cz }, weg, pad };
    return tribunePunt;
  }

  /*
   De terugval als er geen looproute te vinden is: het stuk weg dat het dichtst
   bij de tas ligt én er vrij zicht op heeft, met dezelfde kijklijn als de
   schutters zelf (`zichtVrij` op 1,2 m). Zonder route of zicht stapten ze uit
   achter de kantine en zagen ze je nooit (de eerste proef: honderdtachtig
   tellen lang geen schot).
  */
  function wegVoorHetTerrein(plek) {
    if (!navigatie) navigatie = new Navigatie(KAART.wegassen);
    let beste = null;
    const P = navigatie.punten;
    for (let i = 0; i < P.length; i++) {
      if (!navigatie.rijbaan[i]) continue;
      const d = Math.hypot(P[i][0] - plek.x, P[i][1] - plek.z);
      if (d < VET_STOP[0] || d > VET_STOP[1] || (beste && d >= beste.d)) continue;
      if (!zichtVrij(P[i][0], P[i][1], plek.x, plek.z, 1.2)) continue;
      beste = { d, x: P[i][0], z: P[i][1] };
    }
    if (beste) return { x: beste.x, z: beste.z };
    const k = navigatie.naaste(plek.x, plek.z, 400, true);
    return k >= 0 ? { x: P[k][0], z: P[k][1] } : null;
  }

  // waar je woont: het huis dat je gekocht hebt, en anders de Wieken 29
  function thuisDoel() {
    const w = (huisGekozen && stekMet(huisGekozen)) || (wieken && wieken()) || null;
    if (!w || !w.plekken) return null;
    return { w, deur: w.plekken.deurBuiten, naam: w.naam };
  }

  function zetVeteraanNeer() {
    const plek = veteraanPlek();
    if (!plek) return null;
    if (!vet) vet = maakVeteraan(scene);
    // met zijn rug naar de molen, het pad af kijkend naar Sneek
    const yaw = kijkHoek(plek.molen, plek);
    vet.veteraan.zetNeer(plek.x, plek.z, yaw);
    vet.toon(true);
    vet.hondBij(plek.langs.x, plek.langs.z);
    return plek;
  }

  function zorgVoorTas() {
    if (!tas) tas = maakTas(scene);
    if (!tasMerk) tasMerk = maakMarkering(scene);
  }

  function ruimVeteraanOp() {
    if (vet) vet.toon(false);
    if (zwart) { zwart = null; zetZwart(0, 0); }
    if (tas) tas.toon(false);
    if (tasMerk) tasMerk.toon(false);
    tasBij = false;
    weg.vet = false;
    vetT = 0;
  }

  function beginVeteraan() {
    fase = 'telefoon';
    ruimVeteraanOp();
    vetT = 1.2;
    zetOpdracht('neem de telefoon op');
    hud.zetNavigatie(null); navDoel = null;
    markZichtbaar(false);
  }

  function naarVeteraan() {
    fase = 'naar_veteraan'; zetPunt(fase);
    const p = zetVeteraanNeer();
    zetOpdracht('ga naar De Veteraan op het Sneekerpad, bij het kleine molentje');
    if (p) zetNavDoel(p.x, p.z, 'De Veteraan · Sneekerpad', 'V');
    spanning = true; spanningUit = 0;
  }

  function naarDeTas() {
    fase = 'naar_tas'; zetPunt(fase);
    zorgVoorTas();
    const t = tribune();
    if (zetUur) zetUur(VET_UUR);
    zetOpdracht('ga naar het voetbalveld van VV Sneek en haal de tas op bij de tribune');
    if (t) {
      tas.zet(t.tas.x, 0.12, t.tas.z, t.yaw);
      tas.toon(true);
      tasMerk.zet(t.tas.x, 0.12, t.tas.z);
      tasMerk.toon(true);
      zetNavDoel(t.tas.x, t.tas.z, 'tribune VV Sneek', 'T');
    }
    // hij blijft niet op je wachten, al zie je dat pas als je terugkomt
    weg.vet = true;
    spanning = true; spanningUit = 0;
  }

  /*
   ---------- de sprong naar de nacht ----------
   Na het gesprek wordt het zwart, staat er "Enkele uren later", en sta je om één
   uur 's nachts voor je eigen huis: het huis dat je gekocht hebt, of anders de
   Wieken 29 (`thuisDoel`). De sprong zelf gebeurt als het beeld helemaal zwart
   is, dus je ziet niets verspringen. De tijd loopt op `update(dt)` en niet op
   een css-overgang, zodat een proef hem kan afspelen.
  */
  const glad = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
  function zetZwart(dekking, tekst) {
    if (overgangEl) {
      overgangEl.style.opacity = dekking.toFixed(3);
      overgangEl.style.visibility = dekking > 0.001 ? 'visible' : 'hidden';
    }
    if (overgangTekst) overgangTekst.style.opacity = tekst.toFixed(3);
  }
  function naarDeNacht() {
    fase = 'overgang';
    hud.zetNavigatie(null); navDoel = null;
    zetOpdracht('');
    zwartMet('Enkele uren later', () => { springNaarHuis(); naarDeTas(); });
  }
  /*
   Het zwart zelf, ook voor missie 12 ("Die avond…", "Even later…"): `bijZwart`
   gebeurt als het beeld helemaal zwart is, en daarna komt het beeld terug.
  */
  function zwartMet(tekst, bijZwart, tijden = VET_ZWART) {
    if (overgangTekst) overgangTekst.textContent = tekst;
    zwart = { t: 0, gesprongen: false, bijZwart, tijden };
  }
  function werkZwartBij(dt) {
    if (!zwart) return;
    const [uit, stil, op] = zwart.tijden || VET_ZWART;
    zwart.t += dt;
    const t = zwart.t;
    if (!zwart.gesprongen && t >= uit) {
      zwart.gesprongen = true;
      if (zwart.bijZwart) zwart.bijZwart();
    }
    if (!zwart) return;       // (bijZwart kan zelf een nieuw zwart beginnen)
    const dekking = t < uit ? glad(t / uit) : t < uit + stil ? 1 : 1 - glad((t - uit - stil) / op);
    // de tekst komt pas als het zwart is, en is weg voor het beeld terugkomt
    const tekst = Math.min(glad((t - uit - 0.2) / 0.7), glad((uit + stil - 0.2 - t) / 0.7));
    zetZwart(dekking, tekst);
    if (t >= uit + stil + op) { zwart = null; zetZwart(0, 0); }
  }
  function springNaarHuis() {
    // De Veteraan is dan allang weg van het pad
    if (vet) vet.toon(false);
    weg.vet = false;
    const t = thuisDoel();
    if (!t) return;
    const deur = t.deur, stoep = t.w.plekken.stoep || deur;
    // reed je naar het molentje, dan staat je auto nu op je oprit
    const auto = player.inCar;
    if (auto) {
      auto.speed = 0;
      player.inCar = null;
      if (eersteP) eersteP();
      geluid.motorUit();
      const o = t.w.plekken.oprit;
      if (o) {
        auto.x = o.x; auto.z = o.z; auto.yaw = o.yaw;
        if (auto.mesh) { auto.mesh.position.set(o.x, auto.mesh.position.y, o.z); auto.mesh.rotation.y = o.yaw; }
      }
    }
    const [px, pz] = resolveCollisions(stoep.x, stoep.z, 0.4);
    player.pos.set(px, 0, pz);
    player.yaw = kijkHoek(deur, stoep);          // de straat in
    player.pitch = 0;
    player.applyCamera();
  }

  /*
   ---------- de bende bij de ingang ----------
   Waar de tien man na het uitstappen gaan staan: rond het begin van de looproute
   van de weg naar de tribune (js/looppad.js), dat is het inritje van het
   clubparkeerterrein aan de Molenkrite. Plekken om de drie meter langs dat stuk
   pad, met twee tot zeven meter opzij, zonder botsdoos, en alleen waar vrij zicht
   is op het uitkijkpunt verderop het pad (dezelfde kijklijn als de schutters
   zelf, `zichtVrij` op 1,2 m). Zo komen ze het veld niet op, maar loop je wel in
   hun vuur als je het terrein af wilt.

   Gemeten (26 sep 2026): het pad is 94 m en bijna recht; met het uitkijkpunt op
   50 m hebben 14 van de 30 plekken er zicht op, op 36 tot 50 m. Daar raken ze met
   8 tot 12 % per schot. Bij de tas, zo'n 90 m van de weg, staan ze buiten hun
   vuurbereik van 70 m: daar ben je veilig, en naar buiten moet je langs hen.
  */
  function ingang() {
    if (ingangPunt) return ingangPunt;
    const t = tribune();
    if (!t || !t.weg) return null;
    const lijn = t.pad && t.pad.length > 1 ? t.pad.map(p => [p[0], p[1]])
      : [[t.weg.x, t.weg.z], [t.tas.x, t.tas.z]];
    if (Math.hypot(lijn[0][0] - t.weg.x, lijn[0][1] - t.weg.z) > 0.5) lijn.unshift([t.weg.x, t.weg.z]);
    const k = opLijn(lijn, VET_UITKIJK);
    const kijk = { x: k.x, z: k.z };
    /*
     Iedereen gaat door de ingang: eerst naar het pad net voorbij de weg (op de
     weg zelf staat de eerste auto), dan naar het punt op het pad bij zijn plek,
     en dan opzij. Een plek telt alleen als je hem vanaf dat punt in een rechte
     lijn haalt: de eerste proef had er een achter een heg, en daar bleef er een
     op vier meter van hangen, zonder zicht op het pad.
    */
    const poort = opLijn(lijn, 3);
    const lijst = [], reserve = [];
    for (let s = 2; s <= VET_INGANG; s += 3) {
      const p = opLijn(lijn, s);
      for (const zij of [-2.5, 2.5, -4.5, 4.5, -7, 7]) {
        const [x, z] = resolveCollisions(p.x - p.uz * zij, p.z + p.ux * zij, 0.4);
        if ([...lijst, ...reserve].some(q => Math.hypot(q.x - x, q.z - z) < 1.6)) continue;
        if (!zichtVrij(p.x, p.z, x, z, 0.3)) continue;
        const plek = { x, z, via: [[poort.x, poort.z], [p.x, p.z]] };
        (zichtVrij(x, z, kijk.x, kijk.z, 1.2) ? lijst : reserve).push(plek);
      }
    }
    // te weinig met zicht: dan de rest erbij, dan staan er een paar in de tweede rij
    while (lijst.length < 10 && reserve.length) lijst.push(reserve.shift());
    ingangPunt = { weg: { x: t.weg.x, z: t.weg.z }, kijk, lijst };
    return ingangPunt;
  }

  // De vier auto's op de weg voor het sportpark.
  function vetAanrijden(sp) {
    if (schutters || aanrijders.length) return;
    const t = tribune();
    const stop = t && t.weg ? { x: t.weg.x, z: t.weg.z } : { x: sp.x + 40, z: sp.z };
    const vx = stop.x - sp.x, vz = stop.z - sp.z;
    const L = Math.hypot(vx, vz) || 1;
    rijAan(stop, vx / L, vz / L, sp, VET_AUTOS, VET_TUSSEN);
  }

  function beginGevecht() {
    const t = tribune();
    // ze stappen uit en gaan rond de ingang staan: het veld komen ze niet op
    latenUitstappen(VET_MANNEN, { ...VET_BENDE, houden: true }, ingang());
    fase = 'vuurgevecht'; zetPunt(fase);
    zetOpdracht(`schakel ze uit (${schutters ? schutters.aantal : 0} te gaan)`, true);
  }

  function naarHuis() {
    fase = 'naar_huis'; zetPunt(fase);
    const t = thuisDoel();
    zetOpdracht(t ? `ga naar huis: ${t.naam}` : 'ga naar huis');
    if (t) zetNavDoel(t.deur.x, t.deur.z, t.naam, 'H');
    spanning = true; spanningUit = 0;
  }

  function werkVeteraanBij(dt, sp) {
    if (fase === 'klaar') return;
    if (fase !== 'telefoon' && fase !== 'briefing') {
      navKlok += dt;
      if (navKlok > 2) { navKlok = 0; werkNavBij(); }
    }
    // De Veteraan kijkt je aan zolang hij er staat, en het hondje blijft naast hem
    if (vet && vet.veteraan.groep.visible) {
      const vp = vet.veteraan.groep.position;
      const d = afst(sp, vp);
      if (d < ZWAAI_AFSTAND) vet.veteraan.kijkNaar(sp.x, sp.z, dt, 2);
      vet.veteraan.update(dt, { zwaait: fase === 'naar_veteraan' && d < ZWAAI_AFSTAND && d > PRAAT_AFSTAND });
      const plek = veteraanPlek();
      if (plek) vet.hondBij(plek.langs.x, plek.langs.z);
    }

    // -- hij belt zelf
    if (fase === 'telefoon') {
      if (vetT > 0) {
        vetT -= dt;
        if (vetT <= 0) {
          geluid.telefoon();
          zeg(VET_TELEFOON, () => {
            naarVeteraan();
            hud.melding('NIEUWE MISSIE', 'De Veteraan wacht op het Sneekerpad.', 5);
          }, { wie: 'De Veteraan', telefoon: true, kop: KOPPEN.veteraan });
        }
      }
      return;
    }

    // -- bij het molentje: het gesprek begint vanzelf zodra je bij hem bent
    if (fase === 'naar_veteraan') {
      if (!vet || !vet.veteraan.groep.visible) { zetVeteraanNeer(); return; }
      if (afst(sp, vet.veteraan.groep.position) > PRAAT_AFSTAND || !balk.hidden) return;
      fase = 'briefing';
      hud.zetNavigatie(null); navDoel = null;
      zetOpdracht('');
      zeg(VET_BRIEFING, () => naarDeNacht());
      return;
    }
    if (fase === 'briefing' || fase === 'overgang') return;

    // -- de tas bij de tribune: E pakt hem op (zie toets)
    if (fase === 'naar_tas') {
      const t = tribune();
      if (!t) return;
      const bij = !player.inCar && Math.hypot(sp.x - t.tas.x, sp.z - t.tas.z) < VET_TAS_BEREIK;
      const toon = bij && balk.hidden && (player.active || window.__autoplay);
      // alleen onze eigen regel weghalen: onderweg staat er ook "E — instappen"
      if (toon) { praatEl.textContent = 'E — de tas pakken'; praatEl.hidden = false; }
      else if (tasHint) praatEl.hidden = true;
      tasHint = toon;
      return;
    }

    /*
     De hinderlaag. Eerst zeg je iets over het gewicht, een tel later rijden
     de auto's de weg voor het terrein op, en pas als ze alle vier stilstaan en
     jij uitgesproken bent stappen de tien man uit.
    */
    if (fase === 'hinderlaag') {
      vetT += dt;
      if (vetT > 1.7 && !aanrijders.length) {
        vetAanrijden(sp);
        zeg(VET_AUTOS_ZIEN, null, { auto: 2.6 });
      }
      const stil = werkAanrijdersBij(dt, sp);
      if (!stil || !balk.hidden || !aanrijders.length) return;
      beginGevecht();
      zeg(VET_OPWACHTEN, null, { auto: 3.4 });
      return;
    }

    if (fase === 'vuurgevecht') {
      buitVanSchutters();
      if (schutters && !schutters.alleNeer) {
        zetOpdracht(`schakel ze uit (${schutters.aantal - schutters.neer} te gaan)`, true);
        return;
      }
      if (!balk.hidden) return;
      fase = 'terug'; zetPunt(fase);
      const p = veteraanPlek();
      zeg(VET_NA_GEVECHT, () => {
        zetOpdracht('breng de tas terug naar De Veteraan op het Sneekerpad');
        if (p) zetNavDoel(p.x, p.z, 'De Veteraan · Sneekerpad', 'V');
      }, { auto: 3.0 });
      return;
    }

    // -- terug bij het molentje: niemand. Even later gaat de telefoon.
    if (fase === 'terug') {
      buitVanSchutters();
      const p = veteraanPlek();
      if (!p || afst(sp, p) > VET_LEEG || !balk.hidden) return;
      // stond hij er toch nog (je hebt nooit weggekeken), dan is hij nu weg
      if (vet) vet.toon(false);
      fase = 'leeg';
      vetT = 0;
      hud.zetNavigatie(null); navDoel = null;
      zetOpdracht('');
      zeg(VET_WEG, null, { auto: 2.8 });
      return;
    }
    if (fase === 'leeg') {
      vetT += dt;
      if (vetT < 1.6 || !balk.hidden) return;
      fase = 'telefoon_mark';
      const t = thuisDoel();
      geluid.telefoon();
      zeg([...VET_MARK, vetNaarHuis(t ? t.naam : 'huis')], () => naarHuis(),
        { wie: 'Mark', telefoon: true, kop: KOPPEN.mark });
      return;
    }
    if (fase === 'telefoon_mark') return;

    // -- thuis: in het huis dat je gekocht hebt
    if (fase === 'naar_huis') {
      const t = thuisDoel();
      if (!t) return;
      const binnen = t.w.binnen && t.w.binnen(sp.x, sp.z);
      const staat = !player.inCar || Math.abs(player.inCar.speed || 0) < 1.5;
      const bij = Math.hypot(sp.x - t.deur.x, sp.z - t.deur.z) < VET_THUIS && staat;
      if (!binnen && !bij) return;
      fase = 'klaar';
      missie = 'klaar';
      vetKlaar = true;
      tasBij = false;
      // en even later staat er een M bij Molenkrite 15 (missie 11, zonder telefoon)
      if (!polKlaar) { naMissieT = POL_WACHT; naMissieNaam = 'politieauto'; }
      zetOpdracht('');
      hud.zetNavigatie(null); navDoel = null;
      verdien(VET_BELONING);
      spanningUit = 6;
      hud.melding('MISSIE GESLAAGD – DE VETERAAN',
        `Beloning: + ${euro(VET_BELONING)} toegevoegd aan wallet`, 8);
    }
  }

  // E bij de tas
  function pakTas() {
    tasHint = false;
    if (tas) tas.toon(false);
    if (tasMerk) tasMerk.toon(false);
    tasBij = true;
    praatEl.hidden = true;
    fase = 'hinderlaag';
    vetT = 0;
    hud.zetNavigatie(null); navDoel = null;
    zetOpdracht('');
    geluid.neerzetten();
    hud.melding('Tas opgepakt', 'Breng hem terug naar De Veteraan.', 3);
    zeg(VET_GEPAKT, null, { auto: 1.6 });
    return true;
  }
  function bijDeTas() {
    if (missie !== 'veteraan' || fase !== 'naar_tas' || player.inCar) return false;
    const t = tribune();
    if (!t) return false;
    const sp = spelerPunt();
    return Math.hypot(sp.x - t.tas.x, sp.z - t.tas.z) < VET_TAS_BEREIK;
  }

  /*
   Missie 10 opnieuw opzetten na het neergaan of na het laden. Elke fase bouwt
   op de vorige: na het gesprek staat de tas klaar, na de tas staat de bende er,
   na de bende ben je op weg terug.
  */
  function hervatVeteraan(f) {
    ruimBomOp();
    beginVeteraan();
    if (f === 'telefoon') return;
    vetT = 0;
    if (f === 'naar_veteraan' || f === 'briefing' || f === 'overgang') { naarVeteraan(); return; }
    // hij heeft je al gesproken en staat er niet meer
    if (vet) vet.toon(false);
    if (f === 'naar_tas') { naarDeTas(); if (vet) vet.toon(false); weg.vet = false; return; }
    tasBij = true;
    if (zetUur) zetUur(VET_UUR);
    if (f === 'hinderlaag' || f === 'vuurgevecht') {
      /*
       Het vuurgevecht opnieuw, vanaf de tas en met de bende al uit de auto's:
       net als bij de Poiesz begin je niet midden tussen hen in.
      */
      const t = tribune();
      if (t) {
        player.inCar = null;
        const [px, pz] = resolveCollisions(t.tas.x, t.tas.z, 0.4);
        player.pos.set(px, 0, pz);
        if (t.weg) player.yaw = kijkHoek({ x: px, z: pz }, t.weg);
        player.applyCamera();
      }
      const sp = spelerPunt();
      vetAanrijden(sp);
      zetAanrijdersStil();
      beginGevecht();
      spanning = true; spanningUit = 0;
      return;
    }
    if (f === 'terug' || f === 'leeg') {
      fase = 'terug';
      const p = veteraanPlek();
      zetOpdracht('breng de tas terug naar De Veteraan op het Sneekerpad');
      if (p) zetNavDoel(p.x, p.z, 'De Veteraan · Sneekerpad', 'V');
      spanning = true; spanningUit = 0;
      return;
    }
    naarHuis();
  }

  /*
   ---------- missie 11: de politieauto en de C4 ----------

   Zes stappen: naar binnen bij Molenkrite 15 (de M), het gesprek met Mark op de
   bank, de politieauto aan de Lemmerweg stelen, de politie afschudden, de C4
   ophalen aan de balie van Tinga State, en alles naar Molenkrite 15 brengen.
  */
  let polAuto = null;            // de politieauto die je moet stelen
  let polPunt = null;            // waar hij staat: { x, z, yaw }
  let polKlaar = false;          // is deze missie ooit afgerond?
  let polHint = false;           // staat "E — de C4 ophalen" in beeld?

  /*
   De plek: het stuk Lemmerweg dat het dichtst bij Molenkrite 15 ligt, aan de
   kant van de rijbaan, in de rijrichting geparkeerd. Staat daar een botsdoos, dan
   schuift hij een stukje op tot hij vrij staat.
  */
  function politieautoPlek() {
    if (polPunt) return polPunt;
    const doel = thuis;
    let beste = null;
    for (const as of KAART.wegassen || []) {
      if (!as.drive || !/lemmerweg/i.test(as.naam || as.name || '')) continue;
      for (let i = 1; i < as.pts.length; i++) {
        const a = as.pts[i - 1], b = as.pts[i];
        const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz;
        if (L2 < 1) continue;
        const t = Math.max(0.2, Math.min(0.8, ((doel.x - a[0]) * dx + (doel.z - a[1]) * dz) / L2));
        const x = a[0] + dx * t, z = a[1] + dz * t, d = Math.hypot(x - doel.x, z - doel.z);
        if (!beste || d < beste.d) { const L = Math.sqrt(L2); beste = { d, x, z, ux: dx / L, uz: dz / L, w: as.w || 5 }; }
      }
    }
    if (!beste) {
      const [x, z] = resolveCollisions(thuis.x + 20, thuis.z, 1.2);
      polPunt = { x, z, yaw: 0 };
      return polPunt;
    }
    // naar de kant van de wijk: dwars op de as, een halve breedte min een meter
    let nx = -beste.uz, nz = beste.ux;
    if ((doel.x - beste.x) * nx + (doel.z - beste.z) * nz < 0) { nx = -nx; nz = -nz; }
    const zij = Math.max(0.8, beste.w / 2 - 1.0);
    let x = beste.x + nx * zij, z = beste.z + nz * zij;
    for (let k = 0; k < 8; k++) {
      const [kx, kz] = resolveCollisions(x, z, 1.2);
      if (Math.hypot(kx - x, kz - z) < 0.05) break;
      x += beste.ux * 2; z += beste.uz * 2;
    }
    polPunt = { x, z, yaw: Math.atan2(-beste.ux, -beste.uz) };
    return polPunt;
  }

  function zetPolitieautoNeer() {
    const p = politieautoPlek();
    if (polAuto && polAuto.mesh && (polAuto.hp || 0) > 0 && !polAuto.wrak) {
      polAuto.x = p.x; polAuto.z = p.z; polAuto.yaw = p.yaw; polAuto.speed = 0;
      polAuto.mesh.position.set(p.x, polAuto.mesh.position.y, p.z); polAuto.mesh.rotation.y = p.yaw;
      polAuto.mesh.visible = true; polAuto.zichtbaar = true; polAuto.driveable = true;
      return polAuto;
    }
    if (polAuto && polAuto.mesh) { polAuto.mesh.visible = false; polAuto.zichtbaar = false; polAuto.driveable = false; }
    polAuto = parkeerPolitieAuto ? parkeerPolitieAuto(p.x, p.z, p.yaw) : vehicles.voegToe({ x: p.x, z: p.z, yaw: p.yaw, soort: 'hatch', kleur: 0x1b3a7a });
    return polAuto;
  }
  function ruimPolitieautoOp() {
    polHint = false;
    toonC4(false);
  }

  function tingaDeur() {
    const t = tingaState && tingaState();
    const w = t && t.winkels ? t.winkels[0] : null;
    return w ? { x: w.x, z: w.z } : null;
  }
  function molenkriteDeur() {
    const m = molenkrite && molenkrite();
    return m && m.plekken ? m.plekken.deurBuiten : thuis;
  }

  function beginPolitieauto() {
    fase = 'wacht';
    ruimPolitieautoOp();
    markZichtbaar(false);          // hij zit binnen; buiten zie je hem niet
    player.c4 = 0;
    const d = molenkriteDeur();
    zetOpdracht('ga naar binnen bij Molenkrite 15 — Mark wacht');
    zetNavDoel(d.x, d.z, 'Molenkrite 15', 'M');
  }
  function naarPolitieauto() {
    fase = 'stelen'; zetPunt(fase);
    const a = zetPolitieautoNeer();
    zetOpdracht('steel de politieauto aan de Lemmerweg');
    zetNavDoel(a.x, a.z, 'politieauto · Lemmerweg', 'P');
    spanning = true; spanningUit = 0;
  }
  function toonC4(aan) {
    const t = tingaState && tingaState();
    if (t && typeof t.toonC4 === 'function') t.toonC4(aan);
  }
  function naarDeC4() {
    fase = 'c4'; zetPunt(fase);
    toonC4(true);
    zetOpdracht('haal de C4 op bij de balie van Tinga State');
    const d = tingaDeur();
    if (d) zetNavDoel(d.x, d.z, 'Tinga State', 'T');
  }
  function naarMark() {
    fase = 'brengen'; zetPunt(fase);
    zetOpdracht(`breng de politieauto en de C4 naar Molenkrite 15 (${player.c4 || 0} × C4 bij je)`);
    zetNavDoel(thuis.x, thuis.z, 'Molenkrite 15', 'M');
  }

  // E aan de balie: de verkoper geeft je de C4
  function haalC4() {
    polHint = false;
    praatEl.hidden = true;
    fase = 'balie';
    zeg(POL_BALIE, () => {
      player.c4 = POL_C4;
      toonC4(false);
      geluid.neerzetten();
      hud.melding('C4 opgehaald', `${POL_C4} stuks · gratis, Mark had al gebeld`, 4);
      naarMark();
    });
    return true;
  }
  function bijDeBalie() {
    if (missie !== 'politieauto' || fase !== 'c4' || player.inCar) return false;
    const t = tingaState && tingaState();
    return !!(t && typeof t.bijToonbank === 'function' && t.bijToonbank(player.pos.x, player.pos.z));
  }

  function werkPolitieautoBij(dt, sp) {
    if (fase === 'klaar') return;
    if (fase !== 'wacht' && fase !== 'gesprek' && fase !== 'balie') {
      navKlok += dt;
      if (navKlok > 2) { navKlok = 0; werkNavBij(); }
    }
    // kapot is kapot: zonder politieauto valt er niets te brengen
    if (polAuto && (fase === 'stelen' || fase === 'afschudden' || fase === 'c4' || fase === 'balie' || fase === 'brengen')
      && ((polAuto.hp !== undefined && polAuto.hp <= 0) || polAuto.wrak)) {
      mislukt('De politieauto is kapot.');
      return;
    }

    // -- binnen bij Molenkrite 15: Mark zit op de bank en begint te praten
    if (fase === 'wacht') {
      const woning = molenkrite && molenkrite();
      if (!woning || !woning.binnen || !woning.binnen(sp.x, sp.z)) return;
      opDeBank(mark, woning.plekken, { x: sp.x, z: sp.z });
      markZichtbaar(true);
      fase = 'gesprek';
      hud.zetNavigatie(null); navDoel = null;
      zetOpdracht('');
      zeg(POL_BINNEN, () => { markZichtbaar(false); naarPolitieauto(); });
      return;
    }
    if (fase === 'gesprek') { mark.update(dt, { zit: BANK_ZITTING }); return; }

    // -- de politieauto: instappen kost twee sterren
    if (fase === 'stelen') {
      if (!polAuto) zetPolitieautoNeer();
      if (player.inCar !== polAuto) return;
      fase = 'afschudden'; zetPunt(fase);
      if (sterGeven) sterGeven(POL_STERREN, polAuto.x, polAuto.z);
      hud.zetNavigatie(null); navDoel = null;
      zetOpdracht(`schud de politie af (${POL_STERREN} sterren)`, true);
      zeg(POL_INGESTAPT, null, { auto: 2.6 });
      return;
    }
    if (fase === 'afschudden') {
      if (gezocht()) return;
      zeg(POL_KWIJT, null, { auto: 2.6 });
      naarDeC4();
      return;
    }

    // -- de balie van Tinga State
    if (fase === 'c4') {
      const bij = bijDeBalie();
      const toon = bij && balk.hidden && (player.active || window.__autoplay);
      if (toon) { praatEl.textContent = 'E — de C4 ophalen'; praatEl.hidden = false; }
      else if (polHint) praatEl.hidden = true;
      polHint = toon;
      return;
    }
    if (fase === 'balie') return;

    // -- alles naar Molenkrite 15: de auto op de stoep, en jij erbij
    if (fase === 'brengen') {
      if (!polAuto || (player.c4 || 0) < POL_C4 || !balk.hidden) return;
      const autoBij = Math.hypot(polAuto.x - thuis.x, polAuto.z - thuis.z) < POL_THUIS;
      const stil = Math.abs(polAuto.speed || 0) < 1.5;
      const jijBij = player.inCar === polAuto || afst(sp, thuis) < POL_THUIS + 4;
      if (!autoBij || !stil || !jijBij) return;
      fase = 'klaar';
      missie = 'klaar';
      polKlaar = true;
      zetOpdracht('');
      hud.zetNavigatie(null); navDoel = null;
      verdien(POL_BELONING);
      spanningUit = 6;
      hud.melding('MISSIE GESLAAGD – DE POLITIEAUTO EN DE C4',
        `Beloning: + ${euro(POL_BELONING)} toegevoegd aan wallet`, 8);
      // Mark komt naar buiten om te kijken
      const [mx, mz] = resolveCollisions(thuis.x, thuis.z, 0.4);
      mark.zetNeer(mx, mz, kijkHoek({ x: mx, z: mz }, polAuto));
      markZichtbaar(true);
      // hij gaat alvast naar binnen: daar vertelt hij het plan (missie 12)
      naMissieNaam = 'brug'; naMissieT = 0;
      zeg(POL_KLAAR, () => { if (missie === 'klaar' && !brugKlaar) naMissieT = BRUG_WACHT; });
    }
  }

  /*
   Missie 11 opnieuw opzetten. Tot en met het afschudden begin je weer bij het
   stelen, met de auto terug aan de Lemmerweg; heb je de politie al af, dan staat
   de auto voor Tinga State, en had je de C4 al, dan heb je die nog.
  */
  function hervatPolitieauto(f) {
    beginPolitieauto();
    if (f === 'wacht' || f === 'gesprek') return;
    if (f === 'stelen' || f === 'afschudden') { naarPolitieauto(); return; }
    // voor Tinga State, met de politie van je af
    const d = tingaDeur();
    const a = zetPolitieautoNeer();
    if (d) {
      const [x, z] = resolveCollisions(d.x + 4, d.z + 4, 1.2);
      a.x = x; a.z = z; a.speed = 0;
      if (a.mesh) a.mesh.position.set(x, a.mesh.position.y, z);
      player.inCar = null;
      const [px, pz] = resolveCollisions(d.x + 1.5, d.z + 1.5, 0.4);
      player.pos.set(px, 0, pz);
      player.applyCamera();
    }
    spanning = true; spanningUit = 0;
    if (f === 'c4' || f === 'balie') { naarDeC4(); return; }
    player.c4 = POL_C4;
    naarMark();
  }

  /*
   ---------- missie 12: de Dúvelsrak ----------

   Het verloop, in fases:
     wacht        een M bij Molenkrite 15; binnen zit Mark op de bank
     plan         het plan (daarna zwart: "Die avond…")
     naarBrug     in politiepak voor de deur; rij de politieauto naar de brug
     versperren   drie dranghekken (gele markeringen, E)
     c4leggen     vier ladingen achter op de brug
     controle     Mark kijkt of je genoeg kogels en leven hebt
     johan        Johan komt de helling op lopen
     klaarstaan   zwart: "Even later…"
     film         het filmbeeld: vier auto's rijden rustig de brug op
     stop         ze stappen uit, De Veteraan loopt naar de hekken en praat
     ontsteken    Mark roept: E laat de C4 afgaan
     gevecht      de eerste ploeg, tien man met De Veteraan
     versterking  vier man van de achterkant
     chaos        vier sterren, Mark praat; de politie wacht zolang
     vluchten     naar het Tinga-bos
     bos          ze zijn je kwijt; daarna klaar
  */
  const brug = KAART ? brugAssen(KAART, thuis) : null;
  let brugKlaar = false;           // is deze missie ooit afgerond?
  let brugHint = false;            // staat er een E-regel van deze missie in beeld?
  let brugOntploft = false;
  let brugFilm = null;             // { t } zolang het filmbeeld loopt
  let brugKonvooi = [];            // de vier auto's: { auto, lijn, a, eind, v, stil }
  let brugKnallen = [];            // de vier ontploffingen, kort na elkaar: { t, x, z, knal }
  let brugVetGemeld = false;       // "De Veteraan ligt!" is al geroepen
  let brugKnipper = 0;
  let brugVertraag = 0;            // wachttijd in 'stop' voor De Veteraan begint
  const brugHekGezet = [false, false, false];
  const brugC4Gezet = [false, false, false, false];
  // Mark en Johan in politiepak, en De Veteraan: hier gemaakt en verborgen, zodat
  // hun materialen achter het laadscherm vertaald worden (zie js/brug.js)
  const brugMark = new Persoon({ ...UNIFORM, huid: 0xd9b48f, haar: 0x6b5a45, hoogte: 1.03, pet: true });
  const brugJohan = new Persoon({ ...UNIFORM, huid: 0xd3a273, haar: 0x3a2a1c, hoogte: 1.05, pet: true });
  const brugMarkVuur = { vuurT: 0.6, kiesT: 0, doel: null };
  const brugJohanVuur = { vuurT: 1.1, kiesT: 0.25, doel: null };
  let brugJohanLoopt = false;
  for (const p of [brugMark, brugJohan]) { p.groep.visible = false; scene.add(p.groep); }
  const brugVet = brug ? maakVeteraan(scene) : null;
  if (brugVet) brugVet.toon(false);
  const brugHekken = brug ? BRUG_HEKKEN.map(() => maakDranghek(scene)) : [];
  const brugBlokken = brug ? BRUG_C4.map(() => maakC4(scene)) : [];
  const brugMerken = brug ? BRUG_C4.map(() => maakMarkering(scene)) : [];
  // en een voor de plek van de politieauto: net als bij de C4 zie je waar hij moet komen
  const brugAutoMerk = brug ? maakMarkering(scene) : null;
  let brugSlot = false;            // schieten mag nog niet: De Veteraan is aan het woord
  const brugSchade = brug ? maakSchade(scene) : null;
  const filmBoven = document.getElementById('filmboven');
  const filmOnder = document.getElementById('filmonder');

  const brugP = (s, u = 0) => brug.p(s, u);
  // waar Mark, Johan en Erik bij de versperring staan (s, u)
  const BRUG_POST_MARK = [1.2, -3.6], BRUG_POST_JOHAN = [0.4, 4.3], BRUG_POST_ERIK = [0.2, -1.2];

  function zetOpBrug(p, [s, u], yaw = brug.noord) {
    const q = brugP(s, u);
    p.zetNeer(q.x, q.z, yaw);
    p.groep.visible = true;
  }
  function toonFilmbalken(f) {
    // en zolang het filmbeeld loopt geen kaartje, geld of kogels in beeld
    document.body.classList.toggle('film', f > 0);
    const h = `${(f * 11).toFixed(2)}vh`;
    if (filmBoven) filmBoven.style.height = h;
    if (filmOnder) filmOnder.style.height = h;
  }

  function ruimBrugOp() {
    brugNaT = 0;                     // (begint er een andere missie, dan geen "paar dagen later")
    if (schutters) { schutters.verwijder(); schutters = null; }
    gevallen.clear();
    brugHint = false;
    brugFilm = null;
    toonFilmbalken(0);
    for (const h of brugHekken) h.toon(false);
    for (const b of brugBlokken) b.toon(false);
    for (const m of brugMerken) m.toon(false);
    if (brugAutoMerk) brugAutoMerk.toon(false);
    schietSlot(false);
    if (brugSchade && !brugKlaar) brugSchade.toon(false);
    for (const k of brugKonvooi) if (k.auto && k.auto.mesh) { k.auto.mesh.visible = false; k.auto.zichtbaar = false; k.auto.driveable = false; }
    brugKonvooi = [];
    for (const k of brugKnallen) if (k.knal) k.knal.stop();
    brugKnallen = [];
    for (const p of [brugMark, brugJohan]) { p.groep.visible = false; p.bergWapen(); }
    if (brugVet) brugVet.toon(false);
    brugHekGezet.fill(false); brugC4Gezet.fill(false);
    brugOntploft = false; brugVetGemeld = false; brugJohanLoopt = false;
    if (politieRust) politieRust(false);
    if (zetPak) zetPak('gewoon');
  }

  function beginBrug() {
    fase = 'wacht';
    ruimBrugOp();
    markZichtbaar(false);            // hij zit binnen
    // los gestart (shift+=): de vier stuks C4 van missie 11 heb je dan toch
    if ((player.c4 || 0) < BRUG_C4.length) player.c4 = BRUG_C4.length;
    const d = molenkriteDeur();
    zetOpdracht('ga naar binnen bij Molenkrite 15 — Mark heeft een plan');
    zetNavDoel(d.x, d.z, 'Molenkrite 15', 'M');
  }

  /*
   De politieauto voor de deur van Molenkrite 15: de auto uit missie 11 als die
   er nog is, anders een nieuwe. Recht voor het huis op de rijbaan, aan de kant
   van de stoep, met de neus in de rijrichting. (Een knooppunt van de navigatie
   lag vijftien meter verderop, en daar zag je hem vanaf de stoep niet staan.)
  */
  function politieautoVoorDeDeur() {
    let beste = null;
    for (const as of KAART.wegassen || []) {
      if (!as.drive) continue;
      for (let i = 1; i < as.pts.length; i++) {
        const a = as.pts[i - 1], b = as.pts[i];
        const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz;
        if (L2 < 1) continue;
        const t = Math.max(0, Math.min(1, ((thuis.x - a[0]) * dx + (thuis.z - a[1]) * dz) / L2));
        const x = a[0] + dx * t, z = a[1] + dz * t, d = Math.hypot(x - thuis.x, z - thuis.z);
        if (!beste || d < beste.d) { const L = Math.sqrt(L2); beste = { d, x, z, ux: dx / L, uz: dz / L, w: as.w || 5 }; }
      }
    }
    let x = thuis.x, z = thuis.z, yaw = 0;
    if (beste) {
      let nx = -beste.uz, nz = beste.ux;
      if ((thuis.x - beste.x) * nx + (thuis.z - beste.z) * nz < 0) { nx = -nx; nz = -nz; }
      const zij = Math.max(0.8, beste.w / 2 - 1.0);
      x = beste.x + nx * zij; z = beste.z + nz * zij;
      yaw = Math.atan2(-beste.ux, -beste.uz);
    }
    const [px, pz] = resolveCollisions(x, z, 1.2);
    if (polAuto && polAuto.mesh && (polAuto.hp || 0) > 0 && !polAuto.wrak) {
      polAuto.x = px; polAuto.z = pz; polAuto.yaw = yaw; polAuto.speed = 0;
      polAuto.mesh.visible = true; polAuto.zichtbaar = true; polAuto.driveable = true;
    } else {
      if (polAuto && polAuto.mesh) { polAuto.mesh.visible = false; polAuto.zichtbaar = false; polAuto.driveable = false; }
      polAuto = parkeerPolitieAuto ? parkeerPolitieAuto(px, pz, yaw) : vehicles.voegToe({ x: px, z: pz, yaw, soort: 'hatch', kleur: 0x1b3a7a });
    }
    polAuto.mesh.position.set(px, polAuto.mesh.position.y, pz); polAuto.mesh.rotation.y = yaw;
    return polAuto;
  }

  // In het zwart na het plan: het is avond, jullie staan buiten in politiepak.
  function naarDeAvond(praten = true) {
    markZichtbaar(false);
    if (zetUur) zetUur(BRUG_AVOND);
    if (zetPak) zetPak('politie');
    if (player.inCar) { player.inCar.speed = 0; player.inCar = null; if (eersteP) eersteP(); geluid.motorUit(); }
    const m = molenkrite && molenkrite();
    const stoep = m && m.plekken ? (m.plekken.stoep || m.plekken.deurBuiten) : thuis;
    const [px, pz] = resolveCollisions(stoep.x, stoep.z, 0.4);
    player.pos.set(px, 0, pz);
    const auto = politieautoVoorDeDeur();
    player.yaw = kijkHoek({ x: px, z: pz }, auto);
    player.pitch = 0;
    player.applyCamera();
    // Mark staat bij de auto, aan de kant van de stoep
    const ax = auto.x + (px - auto.x) * 0.35, az = auto.z + (pz - auto.z) * 0.35;
    const [mx, mz] = resolveCollisions(ax, az, 0.4);
    brugMark.zetNeer(mx, mz, kijkHoek({ x: mx, z: mz }, { x: px, z: pz }));
    brugMark.groep.visible = true;
    fase = 'naarBrug'; zetPunt(fase);
    spanning = true; spanningUit = 0;
    const doel = brugP(BRUG_AUTO[0], BRUG_AUTO[1]);
    brugAutoMerk.zet(doel.x, brug.hoogte, doel.z);
    brugAutoMerk.toon(true);
    const nav = () => {
      zetOpdracht('rij de politieauto naar de Dúvelsrak, aan de kant van Tinga');
      zetNavDoel(doel.x, doel.z, 'de Dúvelsrak', 'D');
    };
    if (praten) zeg(BRUG_BUITEN, nav); else nav();
  }

  // De auto staat op zijn plek: dwars over de weg, en Mark stapt uit.
  function opDeBrug(praten = true) {
    const q = brugP(BRUG_AUTO[0], BRUG_AUTO[1]);
    const yaw = brug.noord + Math.PI / 2;
    polAuto.x = q.x; polAuto.z = q.z; polAuto.yaw = yaw; polAuto.speed = 0;
    /*
     Op dekhoogte zetten vóór `zetNeer`: die peilt de grond vanaf de hoogte waar
     de auto was, en een auto die van de Molenkrite (0 m) hierheen springt stond
     dan onder het dek, op de N7 (brugshots, 27 sep 2026).
    */
    if (polAuto.mesh) { polAuto.mesh.position.set(q.x, brug.hoogte, q.z); polAuto.mesh.rotation.y = yaw; }
    vehicles.zetNeer(polAuto, 0, yaw);
    brugAutoMerk.toon(false);
    zetOpBrug(brugMark, BRUG_POST_MARK);
    hud.zetNavigatie(null); navDoel = null;
    fase = 'versperren'; zetPunt(fase);
    const zet = () => {
      zetOpdracht('zet de drie dranghekken neer (gele markeringen, E)');
      BRUG_HEKKEN.forEach(([s, u], i) => { const p = brugP(s, u); brugMerken[i].zet(p.x, brug.hoogte, p.z); brugMerken[i].toon(!brugHekGezet[i]); });
    };
    if (praten) zeg(BRUG_OP_DE_BRUG, zet); else zet();
  }

  function zetHek(i) {
    const [s, u] = BRUG_HEKKEN[i], p = brugP(s, u);
    brugHekken[i].zet(p.x, brug.hoogte, p.z, brug.noord);
    brugHekken[i].toon(true);
    brugHekGezet[i] = true;
    brugMerken[i].toon(false);
  }
  function zetLading(i) {
    const [s, u] = BRUG_C4[i], p = brugP(s, u);
    brugBlokken[i].zet(p.x, brug.hoogte, p.z, brug.noord);
    brugBlokken[i].toon(true);
    brugC4Gezet[i] = true;
    brugMerken[i].toon(false);
  }
  function naarDeLadingen() {
    fase = 'c4leggen';
    BRUG_C4.forEach(([s, u], i) => { const p = brugP(s, u); brugMerken[i].zet(p.x, brug.hoogte, p.z); brugMerken[i].toon(!brugC4Gezet[i]); });
    zetOpdracht(`leg de C4 achter op de brug (${BRUG_C4.length - brugC4Gezet.filter(Boolean).length} te gaan)`);
  }

  // Hoeveel kogels heb je, alles bij elkaar? En is het genoeg voor Mark?
  function kogelsTotaal() {
    let n = player.reserve || 0;
    for (const w of player.wapens || []) n += (player.magazijnen && player.magazijnen[w]) || 0;
    return n;
  }
  function controle() {
    fase = 'controle';
    zetOpdracht('');
    const genoeg = kogelsTotaal() >= BRUG_KOGELS && player.health >= 100;
    zeg(genoeg ? BRUG_GENOEG : BRUG_TE_WEINIG, () => {
      if (!genoeg) {
        if (!player.wapens.includes('pistool')) player.krijgWapen('pistool');
        if (!player.wapens.includes('mitrailleur')) player.krijgWapen('mitrailleur');
        player.reserve = Math.max(player.reserve || 0, BRUG_EXTRA);
        if (player.zetWapen) player.zetWapen('mitrailleur');
        player.health = 100;
        hud.zetLeven(player.health);
        geefWapen();
        hud.melding('Van Mark', `Machinegeweer en pistool · ${BRUG_EXTRA} kogels · 100 leven`, 4);
        geluid.neerzetten();
      }
      naarJohan();
    });
  }
  function naarJohan() {
    fase = 'johan';
    // hij komt van de Tinga-kant de helling op lopen, over de oprit zelf
    const j = brug.langsAs(-24, 1.2);
    brugJohan.zetNeer(j.x, j.z, brug.noord);
    brugJohan.groep.visible = true;
    brugJohanLoopt = true;
    zetOpdracht('wacht op Johan');
  }
  function klaarstaan() {
    fase = 'klaarstaan'; zetPunt(fase);
    zetOpdracht('');
    zwartMet('Even later…', beginFilm);
  }

  /*
   Niet schieten zolang De Veteraan eraan komt en praat (melding 27 sep 2026: "laat
   eerst het dialoog afspelen"). Van het filmbeeld tot zijn laatste regel staat
   het slot erop; daarna mag het, en een schot begint dan het gevecht.
  */
  function schietSlot(aan) {
    if (aan === brugSlot) return;
    brugSlot = aan;
    player.vuurSlot = aan;
  }

  // ---- het filmbeeld ----
  function lijnLengte(l) { let n = 0; for (let i = 1; i < l.length; i++) n += Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]); return n; }
  function beginFilm() {
    if (zetUur) zetUur(BRUG_LATER);
    if (player.inCar) { player.inCar.speed = 0; player.inCar = null; if (eersteP) eersteP(); geluid.motorUit(); }
    const e = brugP(BRUG_POST_ERIK[0], BRUG_POST_ERIK[1]);
    player.pos.set(e.x, brug.hoogte, e.z);
    player.yaw = brug.noord; player.pitch = 0;
    player.applyCamera();
    zetOpBrug(brugMark, BRUG_POST_MARK);
    zetOpBrug(brugJohan, BRUG_POST_JOHAN);
    brugJohanLoopt = false;
    // de vier auto's, achter elkaar de helling op aan de kant van de Lemmerweg
    for (const k of brugKonvooi) if (k.auto.mesh) { k.auto.mesh.visible = false; k.auto.zichtbaar = false; }
    const lijn = brug.vanLemmerweg(BRUG_HELLING, BRUG_STOP[0], BRUG_RIJBAAN);
    const L = lijnLengte(lijn);
    brugKonvooi = BRUG_STOP.map((sStop, i) => {
      const a = (BRUG_STOP.length - 1 - i) * 9;
      const eind = L - (sStop - BRUG_STOP[0]);
      const p = opLijn(lijn, a);
      const auto = vehicles.voegToe({ x: p.x, z: p.z, yaw: Math.atan2(-p.ux, -p.uz),
        soort: i === 0 ? 'hatch' : (i % 2 ? 'van' : 'hatch'),
        kleur: [0x0c0d0f, 0x22262c, 0x1d1f24, 0x2b2f36][i], driveable: false });
      vehicles.zetNeer(auto, 0, auto.yaw);
      return { auto, lijn, a, eind, v: BRUG_V, stil: false };
    });
    brugFilm = { t: 0 };
    schietSlot(true);
    fase = 'film';
    zetOpdracht('');
    hud.zetNavigatie(null); navDoel = null;
  }
  function werkKonvooiBij(dt, vlak = false) {
    let stil = true;
    for (const k of brugKonvooi) {
      if (k.stil) continue;
      const rest = k.eind - k.a;
      /*
       Rustig rijden en op tijd remmen, zoals bij missie 7 en 10: de snelheid die
       nog past om precies op de plek stil te staan is wortel(2·a·d).
      */
      k.v = vlak ? 0 : Math.min(BRUG_V, Math.sqrt(2 * BRUG_REM * Math.max(0, rest)));
      const stap = vlak ? rest : Math.min(rest, Math.max(k.v, 0.4) * dt);
      k.a += stap;
      const p = opLijn(k.lijn, k.a);
      const auto = k.auto;
      auto.x = p.x; auto.z = p.z; auto.yaw = Math.atan2(-p.ux, -p.uz); auto.speed = k.v;
      vehicles.zetNeer(auto, dt, auto.yaw);
      if (k.eind - k.a < 0.05) { k.stil = true; auto.speed = 0; }
      else stil = false;
    }
    return stil;
  }
  // Het beeld zelf: drie standpunten, de laatste achter de versperring.
  function werkFilmBij(dt) {
    if (!brugFilm) return;
    brugFilm.t += dt;
    const t = brugFilm.t;
    const allesStil = werkKonvooiBij(dt);
    toonFilmbalken(Math.min(1, t / 0.8));
    const leider = brugKonvooi[0].auto;
    const ly = (leider.mesh ? leider.mesh.position.y : brug.hoogte) + 0.9;
    let pos, kijk;
    if (t < 5.5) {
      const q = brugP(-1, -4.6), k = brugP(58, -1);
      pos = [q.x, brug.hoogte + 3.2, q.z]; kijk = [k.x, brug.hoogte + 0.8, k.z];
    } else if (t < 10.5) {
      // binnen de leuning (1,3 m hoog, op 5 m van de as): daarbuiten zag je alleen hout
      const q = brugP(20, 3.6);
      pos = [q.x, brug.hoogte + 1.5, q.z]; kijk = [leider.x, ly, leider.z];
    } else {
      const q = brugP(-4.5, 0.8);
      pos = [q.x, brug.hoogte + 1.9, q.z]; kijk = [leider.x, ly, leider.z];
    }
    if (camera) {
      camera.position.set(pos[0], pos[1], pos[2]);
      camera.lookAt(kijk[0], kijk[1], kijk[2]);
    }
    if (player.gun) player.gun.visible = false;
    // Erik staat stil achter de hekken zolang het filmbeeld loopt
    const e = brugP(BRUG_POST_ERIK[0], BRUG_POST_ERIK[1]);
    player.pos.x = e.x; player.pos.z = e.z;
    brugMark.update(dt, {}); brugJohan.update(dt, {});
    if ((allesStil && t > 12.5) || t >= BRUG_FILM) eindeFilm();
  }
  function eindeFilm() {
    werkKonvooiBij(0, true);
    brugFilm = null;
    toonFilmbalken(0);
    player.yaw = brug.noord; player.pitch = 0;
    player.applyCamera();
    uitstappen();
  }

  // De Veteraan en zijn negen man stappen uit. Ze doen niets: het is een controle.
  function uitstappen() {
    if (schutters) { schutters.verwijder(); schutters = null; }
    gevallen.clear();
    const kijk = brugP(3, 0);
    const posten = [];
    // De Veteraan uit de voorste auto, naar de hekken toe
    const v = brug.lokaal(brugKonvooi[0].auto.x, brugKonvooi[0].auto.z);
    const deur = brugP(v.s - 0.4, BRUG_RIJBAAN - 1.3), voor = brugP(8.4, -0.4);
    posten.push({ a: [deur.x, deur.z], b: [voor.x, voor.z], kijk: brugP(BRUG_POST_ERIK[0], BRUG_POST_ERIK[1]) });
    // drie man uit elke volgauto, aan beide kanten
    for (let i = 1; i < brugKonvooi.length; i++) {
      const c = brug.lokaal(brugKonvooi[i].auto.x, brugKonvooi[i].auto.z);
      for (const [ds, kant] of [[-1.1, -1], [0.4, 1], [1.4, -1]]) {
        const a = brugP(c.s + ds, BRUG_RIJBAAN + kant * 1.3), b = brugP(c.s + ds - 0.6, BRUG_RIJBAAN + kant * 2.7);
        posten.push({ a: [a.x, a.z], b: [b.x, b.z], kijk });
      }
    }
    brugVet.toon(true);
    brugVet.hond.visible = false;        // het hondje blijft vannacht thuis
    schutters = new Bewaking(scene, posten, { ...BRUG_BENDE, rustig: true, personen: [brugVet.veteraan] });
    fase = 'stop';
    brugVertraag = 3.2;
  }
  const brugVeteraanNeer = () => !!(schutters && schutters.wachters[0] && schutters.wachters[0].staat === 'neer');

  function laatAfgaan() {
    if (brugOntploft) return false;
    brugOntploft = true;
    brugHint = false;
    praatEl.hidden = true;
    const sp = spelerPunt();
    BRUG_C4.forEach(([s, u], i) => {
      const p = brugP(s, u);
      brugKnallen.push({ t: -i * 0.16, x: p.x, z: p.z, knal: null });
      brugBlokken[i].toon(false);
      brugMerken[i].toon(false);
    });
    const g = brugP(BRUG_GAT, 0);
    brugSchade.zet(g.x, brug.hoogte, g.z, brug.noord);
    brugSchade.toon(true);
    if (schokken) schokken(1.2);
    if (paniek) paniek(g.x, g.z, 90);
    // wie te dicht bij zijn eigen C4 staat, voelt het
    let dichtst = Infinity;
    for (const [s, u] of BRUG_C4) { const p = brugP(s, u); dichtst = Math.min(dichtst, Math.hypot(p.x - sp.x, p.z - sp.z)); }
    if (dichtst < 7 && player.active !== false) {
      player.health = Math.max(0, player.health - Math.round(70 * (1 - dichtst / 7)));
      hud.zetLeven(player.health); hud.flits();
      if (player.health <= 0) { dood(); return true; }
    }
    brugGevecht();
    return true;
  }
  function brugGevecht() {
    schietSlot(false);
    fase = 'gevecht';
    zetOpdracht('');
    if (schutters) {
      schutters.rustig = false;
      schutters.alarm = true;
      for (const w of schutters.wachters) if (w.staat !== 'neer') w.staat = 'aanval';
    }
    brugMark.geefWapen('mp');
    brugJohan.geefWapen('pistool');
    // de auto's van De Veteraan zijn nu van wie ze pakt
    for (const k of brugKonvooi) k.auto.driveable = true;
    geefWapen();
    spanning = true; spanningUit = 0;
    if (balk.hidden) zeg(BRUG_BOEM, null, { auto: 2.4 });
  }
  function versterking() {
    fase = 'versterking';
    const posten = [];
    for (let i = 0; i < BRUG_ACHTER; i++) {
      // de helling af aan de kant van de Lemmerweg, dertig tot veertig meter weg
      const lijn = brug.vanLemmerweg(30 + i * 3, brug.L, (i % 2 ? 1 : -1) * (1 + (i >> 1)));
      const p = lijn[0];
      posten.push({ a: [p[0], p[1]], b: [p[0], p[1]] });
    }
    const nieuw = schutters.voegToe(posten);
    schutters.alarm = true;
    for (const w of nieuw) w.staat = 'aanval';
    zeg(BRUG_MEER, null, { auto: 2.4 });
  }
  // de weg van de Molenkrite naar de voet van de brug, voor de eerste twee wagens
  function politieVanMolenkrite() {
    const voet = brug.voetTinga;
    let beste = null;
    for (const as of KAART.wegassen || []) {
      if (!as.drive || !/molenkrite/i.test(as.naam || as.name || '')) continue;
      for (const q of as.pts) {
        const d = Math.hypot(q[0] - voet.x, q[1] - voet.z);
        const sc = Math.abs(d - 110);
        if (d > 70 && (!beste || sc < beste.sc)) beste = { sc, x: q[0], z: q[1] };
      }
    }
    const van = beste || { x: voet.x - 110, z: voet.z };
    return [[van.x, van.z], [voet.x, voet.z]];
  }
  function chaos() {
    fase = 'chaos'; zetPunt('vluchten');
    zetOpdracht('');
    brugMark.bergWapen(); brugJohan.bergWapen();
    // eerst de sterren, maar de politie wacht tot Mark uitgepraat is
    if (politieRust) politieRust(true);
    const g = brugP(BRUG_GAT * 0.5, 0);
    if (sterGeven) sterGeven(BRUG_STERREN, g.x, g.z);
    zeg(BRUG_CHAOS, naarHetBos);
  }
  function naarHetBos() {
    if (politieRust) politieRust(false);
    if (stuurPolitie) stuurPolitie(politieVanMolenkrite(), BRUG_POLITIE, 16);
    fase = 'vluchten';
    const b = bos();
    zetOpdracht(`schud de politie af in het Tinga-bos (${BRUG_STERREN} sterren)`, true);
    if (b) zetNavDoel(b.x, b.z, 'Tinga-bos', 'B');
  }
  function brugGeslaagd() {
    fase = 'klaar';
    missie = 'klaar';
    brugKlaar = true;
    zetOpdracht('');
    hud.zetNavigatie(null); navDoel = null;
    verdien(BRUG_BELONING);
    spanningUit = 6;
    hud.melding('MISSIE GESLAAGD – DE DÚVELSRAK', `Beloning: + ${euro(BRUG_BELONING)} toegevoegd aan wallet`, 8);
    for (const h of brugHekken) h.toon(false);
    if (zetPak) zetPak('gewoon');
    // en na een paar tellen: "Een paar dagen later" (missie 13)
    if (!schriftKlaar) brugNaT = SCHRIFT_NA_BOS;
  }

  // Mark of Johan schiet: de dichtstbijzijnde die hij kan zien, niet door een auto heen.
  function bondgenootVuurt(p, st, dt) {
    if (!schutters) { p.update(dt, {}); return; }
    const mp = p.groep.position;
    st.kiesT -= dt;
    if (st.kiesT <= 0 || !st.doel || st.doel.staat === 'neer') {
      st.kiesT = 0.5; st.doel = null;
      let dBest = 60;
      for (const w of schutters.wachters) {
        if (w.staat === 'neer') continue;
        const q = w.persoon.groep.position, d = Math.hypot(q.x - mp.x, q.z - mp.z);
        if (d < dBest && zichtVrij(mp.x, mp.z, q.x, q.z, 1.2, p.grond)) { dBest = d; st.doel = w; }
      }
    }
    if (!st.doel) { p.update(dt, { mikt: true }); return; }
    const q = st.doel.persoon.groep.position;
    p.kijkNaar(q.x, q.z, dt, 7);
    p.update(dt, { mikt: true });
    st.vuurT -= dt;
    if (st.vuurT > 0) return;
    st.vuurT = 0.8 + Math.random() * 0.7;
    p.vuur();
    geluid.schot();
    // ongeveer één op de acht: met z'n tweeën doen ze wat, maar het werk is aan jou
    if (Math.random() < 0.12) schutters.raak(st.doel.persoon.groep);
  }

  // Mark en Johan rijden mee: in de auto uit beeld, uitgestapt naast je.
  function metJeMee(sp, dt, erbij = false) {
    for (const [p, zij] of [[brugMark, 1.8], [brugJohan, -1.8]]) {
      if (player.inCar && p.groep.visible) p.groep.visible = false;
      // uitgestapt, of te voet ver voor ze uit gerend: dan staan ze weer naast je
      const ver = p.groep.visible && Math.hypot(p.groep.position.x - sp.x, p.groep.position.z - sp.z) > 30;
      if (!player.inCar && (!p.groep.visible || ver || erbij)) {
        const [mx, mz] = resolveCollisions(sp.x + zij, sp.z + 1.6, 0.4);
        p.zetNeer(mx, mz, kijkHoek({ x: mx, z: mz }, sp));
        p.groep.visible = true;
      }
      if (p.groep.visible) { p.kijkNaar(sp.x, sp.z, dt, 2); p.update(dt, {}); }
    }
  }

  // E: een hek, een lading, het filmbeeld overslaan of de C4 laten afgaan
  function brugToets() {
    if (missie !== 'brug' || !brug) return false;
    if (fase === 'film') { if (brugFilm) brugFilm.t = BRUG_FILM; return true; }
    if (fase === 'ontsteken' || ((fase === 'gevecht' || fase === 'versterking') && !brugOntploft)) return laatAfgaan();
    if (player.inCar) return false;
    const sp = spelerPunt();
    const lijst = fase === 'versperren' ? BRUG_HEKKEN : fase === 'c4leggen' ? BRUG_C4 : null;
    const gezet = fase === 'versperren' ? brugHekGezet : brugC4Gezet;
    if (!lijst) return false;
    for (let i = 0; i < lijst.length; i++) {
      if (gezet[i]) continue;
      const p = brugP(lijst[i][0], lijst[i][1]);
      if (Math.hypot(p.x - sp.x, p.z - sp.z) > BRUG_BEREIK) continue;
      brugHint = false; praatEl.hidden = true;
      geluid.neerzetten();
      if (fase === 'versperren') {
        zetHek(i);
        if (brugHekGezet.every(Boolean)) zeg(BRUG_HEKKEN_STAAN, naarDeLadingen);
        else zetOpdracht(`zet de dranghekken neer (${brugHekGezet.filter(v => !v).length} te gaan)`);
      } else {
        zetLading(i);
        player.c4 = Math.max(0, (player.c4 || 0) - 1);
        if (brugC4Gezet.every(Boolean)) controle();
        else zetOpdracht(`leg de C4 achter op de brug (${brugC4Gezet.filter(v => !v).length} te gaan)`);
      }
      return true;
    }
    return false;
  }
  function brugHintBij(sp) {
    let tekst = null;
    if (!player.inCar && balk.hidden && (fase === 'versperren' || fase === 'c4leggen')) {
      const lijst = fase === 'versperren' ? BRUG_HEKKEN : BRUG_C4;
      const gezet = fase === 'versperren' ? brugHekGezet : brugC4Gezet;
      for (let i = 0; i < lijst.length; i++) {
        if (gezet[i]) continue;
        const p = brugP(lijst[i][0], lijst[i][1]);
        if (Math.hypot(p.x - sp.x, p.z - sp.z) <= BRUG_BEREIK) { tekst = fase === 'versperren' ? 'E — dranghek neerzetten' : 'E — C4 plaatsen'; break; }
      }
    }
    if (fase === 'ontsteken' && balk.hidden) tekst = 'E — de C4 laten afgaan';
    if (tekst && (player.active || window.__autoplay)) { praatEl.textContent = tekst; praatEl.hidden = false; brugHint = true; }
    else if (brugHint) { praatEl.hidden = true; brugHint = false; }
  }

  function werkBrugBij(dt, sp) {
    if (!brug || fase === 'klaar') return;
    if (fase === 'naarBrug' || fase === 'vluchten') {
      navKlok += dt;
      if (navKlok > 2) { navKlok = 0; werkNavBij(); }
    }
    // de politieauto is het hele plan: tot aan de brug moet hij heel blijven
    if (polAuto && (fase === 'naarBrug' || fase === 'versperren' || fase === 'c4leggen')
      && ((polAuto.hp !== undefined && polAuto.hp <= 0) || polAuto.wrak)) {
      mislukt('De politieauto is kapot.');
      return;
    }
    for (const m of brugMerken) m.update(dt);
    if (brugAutoMerk) brugAutoMerk.update(dt);
    for (const h of brugHekken) {
      h.update(dt);
      // wie er met een auto tegenaan rijdt, gooit hem om
      if (!h.zichtbaar || h.om) continue;
      const hp = h.groep.position;
      for (const a of [player.inCar, ...brugKonvooi.map(k => k.auto)]) {
        if (a && Math.abs(a.speed || 0) > 1.5 && Math.hypot(a.x - hp.x, a.z - hp.z) < 2.4) { h.omver(); geluid.neerzetten(); break; }
      }
    }
    for (const b of brugBlokken) b.update(dt);
    if (brugSchade) brugSchade.update(dt);
    for (const k of brugKnallen) {
      k.t += dt;
      if (k.t >= 0 && !k.knal) { k.knal = ontplofBij(scene, k.x, brug.hoogte, k.z); geluid.explosie(Math.hypot(k.x - sp.x, k.z - sp.z)); }
      if (k.knal) k.knal.update(dt);
    }
    // het zwaailicht op de politieauto, zodra hij op de brug staat
    if (polAuto && polAuto.zwaailicht && fase !== 'wacht' && fase !== 'plan' && fase !== 'naarBrug') {
      brugKnipper += dt;
      const aan = (brugKnipper % 0.7) < 0.35;
      // (missie 12 speelt 's avonds: de gloed en de plas op straat vol aan)
      zetZwaailamp(polAuto.zwaailicht.links, aan ? 1 : 0, true);
      zetZwaailamp(polAuto.zwaailicht.rechts, aan ? 0 : 1, true);
    }
    brugHintBij(sp);

    // -- binnen bij Molenkrite 15: Mark zit op de bank en vertelt het plan
    if (fase === 'wacht') {
      const woning = molenkrite && molenkrite();
      if (!woning || !woning.binnen || !woning.binnen(sp.x, sp.z)) return;
      opDeBank(mark, woning.plekken, { x: sp.x, z: sp.z });
      markZichtbaar(true);
      fase = 'plan';
      hud.zetNavigatie(null); navDoel = null;
      zetOpdracht('');
      zeg(BRUG_PLAN, () => zwartMet('Die avond…', () => naarDeAvond()));
      return;
    }
    if (fase === 'plan') { mark.update(dt, { zit: BANK_ZITTING }); return; }

    // -- naar de brug: Mark rijdt mee
    if (fase === 'naarBrug') {
      if (!brugMark.groep.visible && !player.inCar) {
        const [mx, mz] = resolveCollisions(sp.x + 1.8, sp.z + 1.6, 0.4);
        brugMark.zetNeer(mx, mz, kijkHoek({ x: mx, z: mz }, sp));
        brugMark.groep.visible = true;
      } else if (player.inCar && brugMark.groep.visible) brugMark.groep.visible = false;
      if (brugMark.groep.visible) { brugMark.kijkNaar(sp.x, sp.z, dt, 2); brugMark.update(dt, {}); }
      if (!polAuto || !balk.hidden) return;
      const plek = brugP(BRUG_AUTO[0], BRUG_AUTO[1]);
      const bij = Math.hypot(polAuto.x - plek.x, polAuto.z - plek.z) < BRUG_AUTO_BEREIK;
      const stil = Math.abs(polAuto.speed || 0) < 1.5;
      const jij = player.inCar === polAuto || Math.hypot(sp.x - plek.x, sp.z - plek.z) < 8;
      if (bij && stil && jij) opDeBrug();
      return;
    }

    // -- Mark en Johan bij de versperring
    if (fase === 'versperren' || fase === 'c4leggen' || fase === 'controle' || fase === 'johan' || fase === 'klaarstaan') {
      const q = brugP(BRUG_POST_MARK[0], BRUG_POST_MARK[1]);
      if (Math.hypot(brugMark.groep.position.x - q.x, brugMark.groep.position.z - q.z) > 0.3) zetOpBrug(brugMark, BRUG_POST_MARK);
      brugMark.kijkNaar(sp.x, sp.z, dt, 2);
      brugMark.update(dt, {});
    }
    if (fase === 'johan' && brugJohanLoopt) {
      const doel = brugP(BRUG_POST_JOHAN[0], BRUG_POST_JOHAN[1]), pos = brugJohan.groep.position;
      const dx = doel.x - pos.x, dz = doel.z - pos.z, d = Math.hypot(dx, dz);
      const stap = Math.min(d, LOOPSNELHEID * 1.4 * dt);
      if (d > 0.3) {
        pos.x += dx / d * stap; pos.z += dz / d * stap;
        brugJohan.draaiNaar(Math.atan2(-dx, -dz), dt, 6);
        brugJohan.update(dt, { loopt: true, snelheid: LOOPSNELHEID * 1.4 });
      } else {
        brugJohanLoopt = false;
        brugJohan.update(dt, {});
        zeg(BRUG_JOHAN, klaarstaan);
      }
      return;
    }
    if (fase === 'klaarstaan' || fase === 'controle') { if (brugJohan.groep.visible) brugJohan.update(dt, {}); return; }

    // -- het filmbeeld loopt via werkFilmBij
    if (fase === 'film') return;

    // -- stilstaan voor de hekken
    if (fase === 'stop' || fase === 'ontsteken') {
      for (const p of [brugMark, brugJohan]) {
        const v = brugVet.veteraan.groep.position;
        p.kijkNaar(v.x, v.z, dt, 2); p.update(dt, {});
      }
      // schiet je eerder, dan begint het gevecht zonder knal (de C4 kan nog)
      if (schutters && !schutters.rustig) { brugGevecht(); return; }
      if (fase === 'stop') {
        brugVertraag -= dt;
        if (brugVertraag <= 0 && balk.hidden) {
          fase = 'ontsteken';
          zeg(BRUG_VETERAAN, () => { schietSlot(false); zetOpdracht('laat de C4 afgaan', true); });
          zetPunt('klaarstaan');
        }
      }
      return;
    }

    // -- het vuurgevecht
    if (fase === 'gevecht' || fase === 'versterking') {
      bondgenootVuurt(brugMark, brugMarkVuur, dt);
      bondgenootVuurt(brugJohan, brugJohanVuur, dt);
      buitVanSchutters();
      if (!schutters) return;
      const over = schutters.aantal - schutters.neer;
      if (brugVeteraanNeer() && !brugVetGemeld && over > 0 && balk.hidden) {
        brugVetGemeld = true;
        zeg(BRUG_VET_NEER, null, { auto: 2.4 });
      }
      if (over > 0) {
        zetOpdracht(`schakel ze uit (${over} te gaan)${brugOntploft ? '' : ' — E laat de C4 afgaan'}`, true);
        return;
      }
      if (fase === 'gevecht') { versterking(); return; }
      if (!balk.hidden) return;
      chaos();
      return;
    }
    if (fase === 'chaos') {
      for (const p of [brugMark, brugJohan]) if (p.groep.visible) { p.kijkNaar(sp.x, sp.z, dt, 2); p.update(dt, {}); }
      return;
    }

    // -- wegwezen: Mark en Johan rijden mee naar het bos
    if (fase === 'vluchten') {
      metJeMee(sp, dt);
      if (!inHetBos(sp.x, sp.z)) return;
      fase = 'bos';
      metJeMee(sp, dt, true);          // ze zijn er, naast je
      if (sterrenWeg) sterrenWeg();
      hud.zetNavigatie(null); navDoel = null;
      zetOpdracht('');
      zeg(BRUG_BOS, brugGeslaagd);
      return;
    }
    if (fase === 'bos') metJeMee(sp, dt);
  }

  /*
   Missie 12 opnieuw opzetten na het neergaan of het laden. Tot aan de brug begin
   je weer voor de deur; op de brug staat de auto dan al, en wat je al neergezet
   had staat er nog. Vanaf het wachten op De Veteraan begin je met alles klaar,
   en het wordt opnieuw "even later". Na het gevecht sta je bij het gat, met de
   vier sterren en de politie onderweg.
  */
  function hervatBrug(f) {
    if (!brug) { beginBrug(); return; }
    const hekken = brugHekGezet.slice(), ladingen = brugC4Gezet.slice();
    beginBrug();
    if (f === 'wacht' || f === 'plan') return;
    naarDeAvond(false);
    if (f === 'naarBrug') return;
    opDeBrug(false);
    const e = brugP(BRUG_POST_ERIK[0], BRUG_POST_ERIK[1] - 1.2);
    player.pos.set(e.x, brug.hoogte, e.z); player.yaw = brug.noord; player.pitch = 0; player.applyCamera();
    if (f === 'versperren') { hekken.forEach((v, i) => { if (v) zetHek(i); }); return; }
    for (let i = 0; i < BRUG_HEKKEN.length; i++) zetHek(i);
    if (f === 'c4leggen') {
      ladingen.forEach((v, i) => { if (v) { zetLading(i); player.c4 = Math.max(0, player.c4 - 1); } });
      naarDeLadingen();
      return;
    }
    if (f === 'controle' || f === 'johan') {
      for (let i = 0; i < BRUG_C4.length; i++) zetLading(i);
      player.c4 = 0;
      controle();
      return;
    }
    zetOpBrug(brugJohan, BRUG_POST_JOHAN);
    if (f === 'vluchten' || f === 'chaos' || f === 'bos') {
      brugOntploft = true;
      const g = brugP(BRUG_GAT, 0);
      brugSchade.zet(g.x, brug.hoogte, g.z, brug.noord);
      brugSchade.toon(true);
      player.c4 = 0;
      chaos();
      return;
    }
    for (let i = 0; i < BRUG_C4.length; i++) zetLading(i);
    player.c4 = 0;
    klaarstaan();
  }

  /*
   ---------- missie 13: het schrift ----------
     wacht       een M bij Parelmoervlinder 3 in Duinterpen; Mark staat voor de deur
     naarIJlst   naar de sloep in IJlst; lint op de kade, twee agenten
     terug       met het schrift naar Mark (zonder politie achter je)
     afronding   Mark bladert
  */
  const schriftPand = pandVan(SCHRIFT_HUIS);
  let schriftKlaar = false;
  let schriftAlarm = false;        // hebben de agenten je gezien? dan twee sterren
  let schriftHint = false;
  let schriftHeeft = false;        // heb je het schrift?
  let schriftNietMeeT = 0;         // "niet met de politie" niet elk beeld opnieuw
  let brugNaT = 0;                 // na missie 12: de pauze tot het zwart
  const schriftBoek = maakSchrift(scene);
  const schriftLint = [0, 1, 2].map(() => maakLint(scene));
  const schriftMerk = maakMarkering(scene);

  // Mark voor de deur van zijn schuiladres, met zijn gezicht naar de straat
  function schriftDeur() {
    if (!schriftPand) return { x: thuis.x, z: thuis.z, straat: thuis };
    const d = voorPunt(schriftPand, 2.5), straat = voorPunt(schriftPand, 12);
    const [x, z] = resolveCollisions(d.x, d.z, 0.4);
    return { x, z, straat };
  }
  function schriftSloep() {
    const b = boten && boten();
    return b && b.ruw ? b.ruw(SCHRIFT_BOOT) : null;
  }
  // de kade bij de sloep: de wal van de ligplaats, en de richting van de wal naar het water
  function schriftKade() {
    const L = LIGPLAATSEN[SCHRIFT_BOOT];
    const w = L.wal, dx = L.x - w.x, dz = L.z - w.z, l = Math.hypot(dx, dz) || 1;
    return { x: w.x, z: w.z, nx: dx / l, nz: dz / l, lx: -dz / l, lz: dx / l };
  }

  function ruimSchriftOp() {
    schriftHint = false;
    schriftBoek.toon(false);
    for (const l of schriftLint) l.toon(false);
    schriftMerk.toon(false);
    schriftAlarm = false; schriftHeeft = false; schriftNietMeeT = 0;
  }

  function beginSchrift() {
    fase = 'wacht';
    ruimSchriftOp();
    const d = schriftDeur();
    mark.bergWapen();
    mark.zetNeer(d.x, d.z, kijkHoek(d, d.straat));
    markZichtbaar(true);
    zetOpdracht('zoek Mark op: hij zit ondergedoken in Duinterpen');
    zetNavDoel(d.x, d.z, 'Mark · Duinterpen', 'M');
  }

  // De sloep, het lint, het schrift en de twee agenten op de kade in IJlst
  function naarIJlst() {
    fase = 'naarIJlst'; zetPunt(fase);
    spanning = true; spanningUit = 0;
    const b = boten && boten();
    if (b && b.naarLigplaats && !b.inBoot) b.naarLigplaats(SCHRIFT_BOOT);
    const sloep = schriftSloep();
    /*
     Het schrift ligt op het kussen van een bank in de sloep. Het kussen wordt in
     het model zelf opgezocht (een doos van 0,42 m, js/boot.js `doft`): met een
     geschatte hoogte lag het eerst onzichtbaar in de romp (schriftshots).
    */
    let kussen = null;
    if (sloep && sloep.mesh) sloep.mesh.traverse(o => {
      const p = o.geometry && o.geometry.parameters;
      if (o.isMesh && p && Math.abs(p.width - 0.42) < 1e-6 && Math.abs(p.height - 0.075) < 1e-6 && (!kussen || o.position.x > kussen.position.x)) kussen = o;
    });
    if (kussen) schriftBoek.zet(kussen.position.x, kussen.position.y + 0.0375, kussen.position.z + 0.15, 0.5, kussen.parent);
    else { const k = schriftKade(); schriftBoek.zet(k.x + k.nx * 2, 0.3, k.z + k.nz * 2); }
    schriftBoek.toon(true);
    const k = schriftKade(), y = 0;
    const p = (l, n) => ({ x: k.x + k.lx * l + k.nx * n, z: k.z + k.lz * l + k.nz * n });
    // lint: langs de kade, en aan beide kanten een stuk de wal op
    schriftLint[0].span(p(-5, -1.2), p(5, -1.2), y);
    schriftLint[1].span(p(-5, -1.2), p(-5, -4.5), y);
    schriftLint[2].span(p(5, -1.2), p(5, -4.5), y);
    for (const l of schriftLint) l.toon(true);
    const m = p(0, -0.6);
    schriftMerk.zet(m.x, y, m.z); schriftMerk.toon(true);
    // de twee agenten: heen en weer langs de kade, elk aan een kant van het lint
    if (schutters) { schutters.verwijder(); schutters = null; }
    gevallen.clear();
    const a1 = p(-12, -3), b1 = p(-3, -3), a2 = p(12, -3.5), b2 = p(3, -3.5);
    schutters = new Bewaking(scene, [{ a: [a1.x, a1.z], b: [b1.x, b1.z] }, { a: [a2.x, a2.z], b: [b2.x, b2.z] }], SCHRIFT_AGENTEN);
    schriftAlarm = false;
    zetOpdracht('haal het schrift uit de sloep van De Veteraan in IJlst');
    zetNavDoel(m.x, m.z, 'de sloep · IJlst', 'S');
  }
  function pakSchrift() {
    schriftHeeft = true;
    schriftHint = false; praatEl.hidden = true;
    schriftBoek.toon(false);
    schriftMerk.toon(false);
    geluid.neerzetten();
    zeg(SCHRIFT_GEPAKT, null, { auto: 2.4 });
    naarMarkMetSchrift();
    return true;
  }
  function naarMarkMetSchrift() {
    fase = 'terug'; zetPunt(fase);
    const d = schriftDeur();
    zetOpdracht('breng het schrift naar Mark in Duinterpen — zonder de politie achter je');
    zetNavDoel(d.x, d.z, 'Mark · Duinterpen', 'M');
  }
  function bijDeSloep() {
    if (missie !== 'schrift' || fase !== 'naarIJlst' || player.inCar || !schriftMerk.zichtbaar) return false;
    const m = schriftMerk.groep.position, sp = spelerPunt();
    return Math.hypot(m.x - sp.x, m.z - sp.z) < SCHRIFT_BEREIK;
  }
  function schriftGeslaagd() {
    fase = 'klaar';
    missie = 'klaar';
    schriftKlaar = true;
    zetOpdracht('');
    hud.zetNavigatie(null); navDoel = null;
    verdien(SCHRIFT_BELONING);
    spanningUit = 6;
    hud.melding('MISSIE GESLAAGD – HET SCHRIFT', `Beloning: + ${euro(SCHRIFT_BELONING)} toegevoegd aan wallet`, 8);
    if (schutters) { schutters.verwijder(); schutters = null; }
    for (const l of schriftLint) l.toon(false);
    // een minuut later belt Ronald (missie 14)
    if (!raceKlaar) { naMissieNaam = 'race'; naMissieT = RACE_WACHT; }
  }

  function werkSchriftBij(dt, sp) {
    if (fase === 'klaar') return;
    if (fase !== 'wacht' && fase !== 'afronding') {
      navKlok += dt;
      if (navKlok > 2) { navKlok = 0; werkNavBij(); }
    }
    for (const l of schriftLint) l.update(dt);
    schriftMerk.update(dt);
    // Mark wacht voor de deur en kijkt je aan als je eraan komt
    if (mark.groep.visible) {
      if (afst(sp, mark.groep.position) < 20) mark.kijkNaar(sp.x, sp.z, dt, 2);
      mark.update(dt, {});
    }
    // gezien door de agenten: twee sterren, en ze schieten
    if (schutters && schutters.alarm && !schriftAlarm && (fase === 'naarIJlst' || fase === 'terug')) {
      schriftAlarm = true;
      const q = schutters.wachters[0].persoon.groep.position;
      if (sterGeven) sterGeven(SCHRIFT_STERREN, q.x, q.z);
      // (ook als er nog een regel van Erik staat: dit gaat voor)
      if (balk.hidden || (gesprek && gesprek.auto)) zeg(SCHRIFT_GEZIEN, null, { auto: 2.2 });
    }
    // de E-regel bij de sloep
    const bij = bijDeSloep() && balk.hidden && (player.active || window.__autoplay);
    if (bij) { praatEl.textContent = 'E — in de sloep zoeken'; praatEl.hidden = false; }
    else if (schriftHint) praatEl.hidden = true;
    schriftHint = bij;

    const dMark = afst(sp, mark.groep.position);
    const staat = !player.inCar || Math.abs(player.inCar.speed || 0) < 1.5;
    if (fase === 'wacht') {
      if (dMark < SCHRIFT_PRAAT && staat && balk.hidden) { fase = 'briefing'; zeg(SCHRIFT_BRIEFING, naarIJlst); }
      return;
    }
    if (fase === 'terug') {
      if (schriftNietMeeT > 0) schriftNietMeeT -= dt;
      if (dMark > SCHRIFT_PRAAT || !staat || !balk.hidden) return;
      if (gezocht()) {
        if (schriftNietMeeT <= 0) { schriftNietMeeT = 8; zeg(SCHRIFT_NIET_MEE, null, { auto: 2.6 }); }
        return;
      }
      fase = 'afronding';
      hud.zetNavigatie(null); navDoel = null;
      zetOpdracht('');
      zeg(SCHRIFT_KLAAR, schriftGeslaagd);
    }
  }

  /*
   Opnieuw na het neergaan of het laden: tot je het schrift hebt begin je weer
   bij Mark, met de kade zoals hij was; had je het al, dan sta je ermee op de
   wal in IJlst, een eind bij de agenten vandaan.
  */
  function hervatSchrift(f) {
    beginSchrift();
    if (f === 'wacht' || f === 'briefing') return;
    const d = schriftDeur();
    naarIJlst();
    if (f === 'naarIJlst') {
      player.inCar = null;
      const [px, pz] = resolveCollisions(d.x + 2, d.z + 2, 0.4);
      player.pos.set(px, 0, pz); player.applyCamera();
      return;
    }
    schriftHeeft = true;
    schriftBoek.toon(false); schriftMerk.toon(false);
    const k = schriftKade();
    const [px, pz] = resolveCollisions(k.x - k.nx * 40, k.z - k.nz * 40, 0.4);
    player.inCar = null; player.pos.set(px, 0, pz); player.applyCamera();
    naarMarkMetSchrift();
  }

  /*
   Na de missie: Mark en Johan blijven bij het bos staan tot je een eind weg bent,
   en de brug houdt zijn gat. En na de paar tellen van MISSIE GESLAAGD wordt het
   zwart: "Een paar dagen later", het is middag, je staat voor je eigen huis, en
   Mark zit in Duinterpen (missie 13).
  */
  function brugNaloop(sp, dt) {
    if (brugNaT > 0) {
      brugNaT -= dt;
      if (brugNaT <= 0) zwartMet('Een paar dagen later', naarDeMiddag);
    }
    if (missie === 'brug') return;
    for (const p of [brugMark, brugJohan]) {
      if (p.groep.visible && Math.hypot(p.groep.position.x - sp.x, p.groep.position.z - sp.z) > 35) p.groep.visible = false;
    }
    if (brugSchade && brugSchade.zichtbaar) brugSchade.update(dt);
  }
  // in het zwart: de middag, thuis, en Mark in Duinterpen
  function naarDeMiddag() {
    for (const p of [brugMark, brugJohan]) p.groep.visible = false;
    if (zetUur) zetUur(SCHRIFT_UUR);
    springNaarHuis();
    startMissie('schrift');
  }

  /*
   ---------- missie 14: Ronald en de race naar IJlst ----------
     telefoon    Ronald belt, een minuut na het schrift
     naarRonald  een R op de kaart bij de Lemmerweg 80
     uitleg      het gesprek bij zijn schuur
     auto        geen Ferrari? Dan eerst naar Autohuis Lemmerweg
     gekocht     Ronald belt nog even: vannacht om één uur
     nacht       "Die nacht…"
     start       bij de BP: Bouwman, Ronald, drie tegenstanders op de grid
     aftellen    drie, twee, één
     race        door de gele ringen naar IJlst (js/race.js)
     finish      gewonnen: stoppen bij Bouwman bij de Poiesz
     verloren    even grijs, dan weer op de grid
  */
  const race = initRace({ scene, vehicles, KAART });
  const racePand = pandVan(RACE_HUIS);
  const racePandAanwezig = () => racePand;
  const ronald = new Persoon({ shirt: 0x2d3f63, broek: 0x2d3f63, huid: 0xe0b893, haar: 0xc9a66b });
  const bouwman = new Persoon({ shirt: 0x4b4f55, broek: 0x23262b, huid: 0xd6ab86, haar: 0x8d8a84, hoogte: 1.02 });
  for (const p of [ronald, bouwman]) { p.groep.visible = false; scene.add(p.groep); }
  let raceKlaar = false;
  let raceT = 0;                   // aftellen tot de telefoon gaat
  let raceAuto = null;             // de auto waarin je de race rijdt
  let raceLeen = null;             // een geleende Ferrari, als de jouwe een wrak is
  let raceBouwmanAuto = null;         // de politieauto van Bouwman
  let racePlek = null;             // de plekken op en langs de grid (js/race.js)
  let raceAftel = 0, raceTel = 0;
  let raceOverT = 0;               // na een verloren race: even grijs, dan opnieuw
  let raceTeLaatT = 0;
  let raceVerplaatst = false;      // staan Bouwman en Ronald al bij de finish?
  let raceBijgelegd = false;
  let raceStandT = 0, raceNavT = 0;
  let raceUitslag = null;
  let raceNaT = 0;                 // na de race: de tellen tot het zwart
  let raceSchuld = RACE_SCHULD;    // wat Ronald Bouwman schuldig is (dubbel na elke verloren revanche)
  let raceRondes = 0;              // hoe vaak je al verloren hebt
  let raceVerloor = null;          // waarom
  let raceUitT = 0, raceKantT = 0, raceGemistCp = -1, raceVorigePlek = 0, raceLaatste = false;

  // Ronald voor zijn huis, bij de schuur, met zijn gezicht naar de weg
  function ronaldPlek() {
    if (!racePand) return { x: 705, z: 890, yaw: 0, straat: { x: 700, z: 890 } };
    const d = voorPunt(racePand, 3), straat = voorPunt(racePand, 14);
    const [x, z] = resolveCollisions(d.x, d.z, 0.4);
    return { x, z, straat, yaw: kijkHoek({ x, z }, straat) };
  }
  // de gekochte Ferrari die nog heel is (js/garage.js)
  function eigenFerrari() {
    const g = garage && garage();
    if (!g) return null;
    const e = g.eigen.find(e => e.soort === 'ferrari' && e.car && !e.car.wrak && !e.car.weg && (e.car.hp ?? 100) > 0);
    return e ? e.car : null;
  }
  function autohuis() {
    const g = garage && garage();
    return g ? { x: g.deur.x - 2, z: g.deur.z } : { x: 766, z: 131.7 };
  }

  function ruimRaceOp() {
    race.ruimOp();
    for (const p of [ronald, bouwman]) p.groep.visible = false;
    if (raceBouwmanAuto) {
      raceBouwmanAuto.driveable = false; raceBouwmanAuto.x = raceBouwmanAuto.z = 1e5;
      if (raceBouwmanAuto.mesh) { raceBouwmanAuto.mesh.visible = false; raceBouwmanAuto.mesh.position.set(1e5, 0, 1e5); }
    }
    raceAftel = 0; raceOverT = 0; raceTeLaatT = 0; raceVerplaatst = false; raceUitslag = null;
    raceUitT = 0;
    vehicles.vrijeZone = null;
  }

  function beginRace() {
    fase = 'telefoon';
    ruimRaceOp();
    raceSchuld = RACE_SCHULD; raceRondes = 0; raceVerloor = null; raceNaT = 0;
    raceT = 1.2;
    markZichtbaar(false);
    zetOpdracht('neem de telefoon op');
    hud.zetNavigatie(null); navDoel = null;
  }
  function naarRonald() {
    fase = 'naarRonald'; zetPunt(fase);
    const r = ronaldPlek();
    ronald.zetNeer(r.x, r.z, r.yaw);
    ronald.groep.visible = true;
    zetOpdracht('ga naar Ronald aan de Lemmerweg 80');
    zetNavDoel(r.x, r.z, 'Ronald · Lemmerweg 80', 'R');
  }
  function naUitleg() {
    if (eigenFerrari()) { zeg(RACE_HEEFT_FERRARI, naarDeRaceNacht); return; }
    fase = 'auto'; zetPunt(fase);
    // Ronald legt bij wat je tekortkomt: het is zijn schuld
    const tekort = RACE_PRIJS - geld;
    const regels = [...RACE_GEEN_FERRARI];
    if (tekort > 0 && !raceBijgelegd) {
      raceBijgelegd = true;
      verdien(tekort);
      regels.push(...RACE_BIJLEGGEN(tekort));
    }
    zeg(regels, naarHetAutohuis);
  }
  function naarHetAutohuis() {
    fase = 'auto';
    const a = autohuis();
    zetOpdracht('koop een Ferrari bij Autohuis Lemmerweg');
    zetNavDoel(a.x, a.z, 'Autohuis Lemmerweg', 'A');
  }
  function naarDeRaceNacht() {
    fase = 'nacht';
    zetOpdracht('');
    hud.zetNavigatie(null); navDoel = null;
    zwartMet('Die nacht…', opDeStart);
  }

  /*
   De start, om één uur 's nachts op de Lemmerweg bij de BP. Je zit al in je
   Ferrari, tweede op de grid; Bouwman en Ronald staan langs de kant, zijn
   politieauto erachter. Wie opnieuw moet (verloren, of neergegaan) begint hier.
  */
  function opDeStart() {
    fase = 'start'; zetPunt(fase);
    if (zetUur) zetUur(RACE_UUR);
    if (sterrenWeg) sterrenWeg();
    ruimRaceOp();
    racePlek = race.klaarzetten();
    if (!racePlek) return;
    /*
     Het gewone verkeer blijft even van de route af (verzoek 27 sep 2026: "zorg dat
     op de route normaal verkeer er even tijdelijk niet is, daarna wel weer"). Wat
     er nu rijdt verhuist meteen (het beeld is zwart), en tot de race voorbij is
     kiest geen auto een plek op de route (js/vehicles.js, `vrijeZone`).
    */
    vehicles.vrijeZone = race.opRoute;
    if (vehicles.maakVrij) vehicles.maakVrij(racePlek.start.x, racePlek.start.z);
    const p = racePlek.speler;
    raceAuto = eigenFerrari();
    if (!raceAuto) {
      // is de jouwe een wrak (of heb je er nooit een gekocht): dan leent Ronald er een
      if (!raceLeen || raceLeen.wrak) raceLeen = vehicles.voegToe({ x: p.x, z: p.z, yaw: p.yaw, soort: 'ferrari', kleur: 0xc40a12 });
      raceAuto = raceLeen;
    }
    if (player.inCar && player.inCar !== raceAuto) { player.inCar.speed = 0; player.inCar = null; }
    raceAuto.x = p.x; raceAuto.z = p.z; raceAuto.yaw = p.yaw; raceAuto.rij = p.yaw; raceAuto.speed = 0;
    raceAuto.driveable = true; raceAuto.hp = Math.max(raceAuto.hp ?? 100, 100);
    if (raceAuto.mesh) { raceAuto.mesh.visible = true; raceAuto.mesh.position.set(p.x, raceAuto.mesh.position.y, p.z); raceAuto.mesh.rotation.y = p.yaw; }
    player.pos.set(p.x, 0, p.z);
    if (stapIn) stapIn(raceAuto); else player.inCar = raceAuto;
    // Bouwman en Ronald langs de kant, de politieauto erachter
    const k = racePlek.kant, ka = racePlek.kantAuto, st = racePlek.start;
    bouwman.zetNeer(k.x, k.z, kijkHoek(k, st)); bouwman.groep.visible = true;
    const [rx, rz] = resolveCollisions(k.x + k.tx * 2.2, k.z + k.tz * 2.2, 0.4);
    ronald.zetNeer(rx, rz, kijkHoek({ x: rx, z: rz }, st)); ronald.groep.visible = true;
    zetBouwmanAuto(ka);
    markZichtbaar(false);
    hud.zetNavigatie(null); navDoel = null;
    zetOpdracht('luister naar Bouwman');
    spanning = false;
    race.toonPijlen(true);
    raceUitT = 0; raceKantT = 0; raceGemistCp = -1; raceVorigePlek = 0; raceLaatste = false;
    zeg(RACE_START, aftellen);
  }
  function zetBouwmanAuto(q) {
    if (!raceBouwmanAuto) raceBouwmanAuto = parkeerPolitieAuto ? parkeerPolitieAuto(q.x, q.z, q.yaw) : vehicles.voegToe({ x: q.x, z: q.z, yaw: q.yaw, soort: 'hatch', kleur: 0x1b3a7a });
    const a = raceBouwmanAuto;
    a.x = q.x; a.z = q.z; a.yaw = q.yaw; a.speed = 0; a.driveable = false;
    if (a.mesh) { a.mesh.visible = true; a.mesh.position.set(q.x, 0, q.z); a.mesh.rotation.y = q.yaw; }
  }
  function aftellen() {
    fase = 'aftellen';
    raceAftel = 3.0; raceTel = 4;
    zetOpdracht('wacht op het startsein');
  }
  function raceStart() {
    fase = 'race';
    race.start();
    spanning = true; spanningUit = 0;
    raceTeLaatT = 0; raceStandT = 0; raceNavT = 0;
    hud.show('START!', 1.6);
    if (geluid.aftelPiep) geluid.aftelPiep(true);
  }
  /*
   Verloren. Eerst even VERLOREN in beeld, dan komt Bouwman verhaal halen: bij de
   finish staat hij naast je, en anders belt hij. Daarna de keuze (`raceKeuze`).
  */
  function raceVerloren(reden) {
    if (fase === 'verloren' || fase === 'keuze') return;
    fase = 'verloren'; zetPunt('start');
    raceVerloor = reden; raceRondes++;
    raceOverT = 2.6;
    spanning = false; spanningUit = 0;
    gesprek = null; sluitBalk();
    zetOpdracht('');
    race.toonPijlen(false);
    for (const r of race.ringen) r.visible = false;
    hud.melding('VERLOREN', reden, 4);
  }
  function naVerlies(sp) {
    // na een verloren revanche is de schuld het dubbele
    if (raceRondes > 1) raceSchuld = RACE_SCHULD * 2 ** (raceRondes - 1);
    const dichtbij = afst(sp, bouwman.groep.position) < 60 && bouwman.groep.visible;
    if (!dichtbij) geluid.telefoon(1);
    zeg(RACE_VERLOREN(raceSchuld), () => {
      fase = 'keuze';
      zetOpdracht(`1 — nog een keer rijden (dubbel of niks) · 2 — ${euro(raceSchuld)} betalen`);
      hud.melding('WAT DOE JE?', `1 — nog een keer rijden · 2 — Ronalds schuld betalen (${euro(raceSchuld)})`, 8);
    }, dichtbij ? {} : { wie: 'Bouwman', telefoon: true, kop: KOPPEN.bouwman });
  }
  // 1 of 2 na een verloren race (js/main.js stuurt de cijfers via `kiesHuis`)
  function raceKeuze(nr) {
    if (missie !== 'race' || fase !== 'keuze') return false;
    if (nr === 1) {
      fase = 'revanche';
      zetOpdracht('');
      zeg(RACE_REVANCHE, () => zwartMet('Even later…', opDeStart));
      return true;
    }
    if (nr === 2) {
      if (geld < raceSchuld) {
        fase = 'revanche';
        zetOpdracht('');
        zeg(RACE_TE_ARM(raceSchuld), () => zwartMet('Even later…', opDeStart));
        return true;
      }
      betaal(raceSchuld);
      fase = 'afronding';
      zetOpdracht('');
      zeg(RACE_BETAALD, raceAfgekocht);
      return true;
    }
    return false;
  }
  // de schuld betaald: de missie is voorbij, zonder beloning
  function raceAfgekocht() {
    const betaald = raceSchuld;
    fase = 'klaar';
    missie = 'klaar';
    raceKlaar = true;
    zetOpdracht('');
    hud.zetNavigatie(null); navDoel = null;
    hud.melding('MISSIE VOLTOOID – DE RACE', `Verloren, maar Ronald is van Bouwman af: je betaalde ${euro(betaald)}.`, 8);
    naDeRace();
  }
  function raceGeslaagd() {
    fase = 'klaar';
    missie = 'klaar';
    raceKlaar = true;
    zetOpdracht('');
    hud.zetNavigatie(null); navDoel = null;
    verdien(RACE_BELONING);
    spanningUit = 6;
    hud.melding('MISSIE GESLAAGD – DE RACE', `Beloning: + ${euro(RACE_BELONING)} toegevoegd aan wallet`, 8);
    for (const r of race.ringen) r.visible = false;
    naDeRace();
  }
  /*
   Na de race: nog vijf tellen in IJlst, dan zwart, "De volgende ochtend", en je
   staat voor je eigen huis (of de Wieken 29). Het verkeer mag weer over de route.
  */
  function naDeRace() {
    vehicles.vrijeZone = null;
    race.toonPijlen(false);
    raceNaT = RACE_NA;
  }
  function naarDeOchtend() {
    race.ruimOp();
    for (const p of [ronald, bouwman]) p.groep.visible = false;
    if (raceBouwmanAuto) {
      raceBouwmanAuto.x = raceBouwmanAuto.z = 1e5;
      if (raceBouwmanAuto.mesh) { raceBouwmanAuto.mesh.visible = false; raceBouwmanAuto.mesh.position.set(1e5, 0, 1e5); }
    }
    if (zetUur) zetUur(RACE_OCHTEND);
    springNaarHuis();
    // een minuut later belt Mark (missie 15)
    if (!schaduwKlaar && missie === 'klaar') { naMissieNaam = 'schaduw'; naMissieT = SCHADUW_WACHT; }
  }
  // de weg die nog voor je ligt, voor de minikaart: om de twintig meter
  function raceRoute(sp) {
    const L = race.lijn;
    if (!L) return null;
    const v = race.voortgang(sp.x, sp.z);
    const uit = [[sp.x, sp.z]];
    for (let i = v.i; i < L.n; i += 10) uit.push([L.x[i], L.z[i]]);
    uit.push([L.x[L.n - 1], L.z[L.n - 1]]);
    return uit;
  }

  function werkRaceBij(dt, sp) {
    if (fase === 'klaar') return;
    if (raceOverT > 0) {
      raceOverT -= dt;
      if (raceOverT <= 0) naVerlies(sp);
      return;
    }
    if (fase === 'verloren' || fase === 'keuze' || fase === 'revanche' || fase === 'afronding') {
      for (const p of [ronald, bouwman]) if (p.groep.visible) { p.kijkNaar(sp.x, sp.z, dt, 2); p.update(dt, {}); }
      // de tegenstanders rijden na de finish nog uit
      race.update(dt, sp);
      return;
    }
    if (fase === 'naarRonald' || fase === 'auto') {
      navKlok += dt;
      if (navKlok > 2) { navKlok = 0; werkNavBij(); }
    }
    for (const p of [ronald, bouwman]) {
      if (!p.groep.visible) continue;
      if (afst(sp, p.groep.position) < 25) p.kijkNaar(sp.x, sp.z, dt, 2);
      p.update(dt, {});
    }
    const staat = !player.inCar || Math.abs(player.inCar.speed || 0) < 1.5;
    if (fase === 'telefoon') {
      if (raceT > 0) {
        raceT -= dt;
        if (raceT <= 0) {
          geluid.telefoon();
          zeg(RACE_TELEFOON, () => {
            naarRonald();
            hud.melding('NIEUWE MISSIE – RONALD', 'Ronald woont aan de Lemmerweg 80. Er staat een R op de kaart.', 7);
          }, { wie: 'Ronald', telefoon: true, kop: KOPPEN.ronald });
        }
      }
      return;
    }
    if (fase === 'naarRonald') {
      if (afst(sp, ronald.groep.position) < RACE_PRAAT && staat && balk.hidden) { fase = 'uitleg'; zeg(RACE_UITLEG, naUitleg); }
      return;
    }
    if (fase === 'auto') {
      // Ronald staat niet meer bij de schuur als je terugkomt: hij belt
      if (ronald.groep.visible && afst(sp, ronald.groep.position) > 60) ronald.groep.visible = false;
      if (eigenFerrari() && balk.hidden) {
        fase = 'gekocht';
        geluid.telefoon(1);
        zeg(RACE_GEKOCHT, naarDeRaceNacht, { wie: 'Ronald', telefoon: true, kop: KOPPEN.ronald });
      }
      return;
    }
    // op de grid staat de auto stil tot het startsein
    if ((fase === 'start' || fase === 'aftellen') && raceAuto) {
      raceAuto.speed = 0;
      if (racePlek) { raceAuto.x = racePlek.speler.x; raceAuto.z = racePlek.speler.z; raceAuto.yaw = racePlek.speler.yaw; }
    }
    if (fase === 'aftellen') {
      raceAftel -= dt;
      const tel = Math.ceil(raceAftel);
      // drie korte piepjes en een lange op START, zoals aan de start van een race
      if (tel !== raceTel && tel > 0) { raceTel = tel; hud.show(String(tel), 0.9); if (geluid.aftelPiep) geluid.aftelPiep(); }
      if (raceAftel <= 0) raceStart();
    }
    // (voor de start staat de klok stil; de ringen pulseren wel)
    const st = race.update(fase === 'race' ? dt : 0, sp);
    if (fase === 'race' && st) {
      if (st.door) geluid.neerzetten();
      raceStandT -= dt;
      if (raceStandT <= 0) {
        raceStandT = 0.25;
        zetOpdracht(`race naar IJlst · ${st.plek}e van ${st.van} · ring ${Math.min(st.cp + 1, st.cps)} van ${st.cps}`);
      }
      raceNavT -= dt;
      if (raceNavT <= 0) {
        raceNavT = 1;
        const cps = race.controlepunten, c = race.punt(cps[Math.min(st.cp, cps.length - 1)]);
        hud.zetNavigatie({ route: raceRoute(sp), doel: [c.x, c.z], naam: st.cp >= cps.length - 1 ? 'finish · IJlst' : `ring ${st.cp + 1}`, letter: st.cp >= cps.length - 1 ? 'F' : 'R' });
      }
      // Bouwman en Ronald rijden vooruit naar de finish, uit je zicht
      if (!raceVerplaatst && racePlek && afst(sp, racePlek.start) > 150) {
        raceVerplaatst = true;
        const e = racePlek.eindKant, ea = racePlek.eindAuto, f = racePlek.eind;
        bouwman.zetNeer(e.x, e.z, kijkHoek(e, f));
        const [rx, rz] = resolveCollisions(e.x - e.tx * 2.2, e.z - e.tz * 2.2, 0.4);
        ronald.zetNeer(rx, rz, kijkHoek({ x: rx, z: rz }, f));
        zetBouwmanAuto(ea);
      }
      if (raceAuto && (raceAuto.wrak || (raceAuto.hp ?? 100) <= 0)) { raceVerloren('Je Ferrari is total loss.'); return; }
      /*
       Wat er onderweg mis kan gaan. Een ring gemist: dan telt de race niet door tot
       je terug bent (de ring blijft staan). De verkeerde kant op. Uitgestapt: na
       twintig tellen is het verloren. En je plek, zodra die verandert.
      */
      if (st.gemist > 35 && raceGemistCp !== st.cp) {
        raceGemistCp = st.cp;
        hud.melding('RING GEMIST', `Terug naar ring ${st.cp + 1}: zonder die ring telt het niet.`, 4);
      }
      if (raceKantT > 0) raceKantT -= dt;
      // ver van de route af (een stuk afgesneden, of verdwaald)
      if (raceKantT <= 0 && race.voortgang(sp.x, sp.z).af > 22) { raceKantT = 3; hud.show('TERUG NAAR DE ROUTE', 1.8); }
      if (player.inCar && raceKantT <= 0 && Math.abs(player.inCar.speed) > 6) {
        const L = race.lijn, v = race.voortgang(sp.x, sp.z);
        const vooruit = -Math.sin(player.inCar.yaw) * L.tx[v.i] - Math.cos(player.inCar.yaw) * L.tz[v.i];
        if (vooruit * Math.sign(player.inCar.speed) < -0.4) { raceKantT = 2.5; hud.show('VERKEERDE KANT OP', 1.6); }
      }
      if (!player.inCar) {
        raceUitT += dt;
        if (Math.floor(raceUitT / 4) !== Math.floor((raceUitT - dt) / 4)) hud.show(`Stap in — de race loopt! (${Math.ceil(RACE_UIT_MAX - raceUitT)} s)`, 2.5);
        if (raceUitT > RACE_UIT_MAX) { raceVerloren('Uitgestapt: dat rekent Bouwman als verloren.'); return; }
      } else raceUitT = 0;
      if (st.plek !== raceVorigePlek) {
        if (raceVorigePlek && st.plek < raceVorigePlek) hud.show(`${st.plek}e!`, 1.4);
        else if (raceVorigePlek) hud.show(`${st.plek}e`, 1.4);
        raceVorigePlek = st.plek;
      }
      if (!raceLaatste && st.cp === st.cps - 1) { raceLaatste = true; hud.show('LAATSTE STUK: DE FINISH!', 2.2); }
      if (st.klaar) {
        raceUitslag = { plek: st.plek, tijd: st.tijd };
        race.toonPijlen(false);
        if (st.plek === 1) {
          fase = 'finish';
          spanningUit = 4;
          const m = Math.floor(st.tijd / 60), sec = Math.round(st.tijd % 60);
          hud.melding('GEWONNEN!', `Als eerste in IJlst · ${m}:${String(sec).padStart(2, '0')}`, 5);
          zetOpdracht('stop bij Bouwman bij de Poiesz');
          const d = bouwman.groep.position;
          hud.zetNavigatie({ route: null, doel: [d.x, d.z], naam: 'Bouwman', letter: 'B' });
        } else {
          raceVerloren(`Je werd ${st.plek}e.`);
        }
        return;
      }
      if (st.eersteKlaar) {
        raceTeLaatT += dt;
        if (raceTeLaatT > RACE_TE_LAAT) raceVerloren('De anderen zijn al lang in IJlst.');
      }
      return;
    }
    if (fase === 'finish') {
      if (afst(sp, bouwman.groep.position) < 14 && staat && balk.hidden) {
        fase = 'afronding';
        zetOpdracht('');
        hud.zetNavigatie(null); navDoel = null;
        zeg(RACE_GEWONNEN, raceGeslaagd);
      }
    }
  }
  /*
   Opnieuw na het neergaan of het laden. Tot het gesprek bij Ronald begin je weer
   bij het telefoontje of de R; moest je nog een Ferrari halen, dan staat de A er
   weer; en vanaf de nacht sta je weer op de grid.
  */
  function hervatRace(f) {
    const schuld = raceSchuld, rondes = raceRondes;
    beginRace();
    raceSchuld = schuld; raceRondes = rondes;
    if (f === 'telefoon') return;
    if (f === 'naarRonald' || f === 'uitleg') { naarRonald(); return; }
    if (f === 'auto' || f === 'gekocht') { naarRonald(); ronald.groep.visible = false; raceBijgelegd = true; naarHetAutohuis(); zetPunt('auto'); return; }
    opDeStart();
  }
  // na de race: Bouwman, Ronald en de tegenstanders gaan weg als je een eind weg bent
  function raceNaloop(sp, dt) {
    if (raceNaT > 0) {
      raceNaT -= dt;
      if (raceNaT <= 0) zwartMet('De volgende ochtend', naarDeOchtend);
    }
    // (in missie 15 rijdt Bouwman zijn politieauto zelf: die hoort dan niet weg te gaan)
    if (missie === 'race' || missie === 'schaduw' || missie === 'inval') return;
    for (const p of [ronald, bouwman]) {
      if (p.groep.visible && afst(sp, p.groep.position) > 60) p.groep.visible = false;
    }
    if (raceBouwmanAuto && raceBouwmanAuto.mesh && raceBouwmanAuto.mesh.visible && afst(sp, raceBouwmanAuto) > 80) {
      raceBouwmanAuto.mesh.visible = false; raceBouwmanAuto.x = raceBouwmanAuto.z = 1e5; raceBouwmanAuto.mesh.position.set(1e5, 0, 1e5);
    }
    if (race.finish.visible && racePlek && afst(sp, racePlek.eind) > 150) race.ruimOp();
  }

  /*
   ---------- missie 15: Bouwman schaduwen ----------
     telefoon    Mark belt, een minuut na de ochtend na de race
     naarMark    een M bij Molenkrite 15; binnen zit hij op de bank
     gesprek     het schrift: "B. — opslag aan het water"
     avond       "Die avond…"
     wacht       in de oude Golf van Mark bij het Autohuis; Bouwman tankt bij de BP
     volgen      achter hem aan door Duinterpen: niet dichter dan 22 m, niet verder dan 170
     loods       drie foto's, zonder dat de twee mannen je zien
     terug       terug naar Mark
     afronding   hij bekijkt de foto's
   De auto van Bouwman is de politieauto uit missie 14 (`raceBouwmanAuto`), en
   Bouwman zelf ook (`bouwman`). De loods en de route staan in js/schaduw.js.
  */
  const schaduw = initSchaduw({ scene, vehicles, KAART, stopBij: () => schriftDeur() });
  let schaduwKlaar = false;
  let schaduwGezien = false;       // hebben de mannen bij de loods je gezien? dan de helft
  let schaduwFotos = [false, false, false];
  let schaduwRit = null;           // de rit van Bouwman (js/schaduw.js `nieuweRit`)
  let schaduwGolf = null;          // de oude Golf van Mark
  let schaduwBus = null;           // de bestelbus bij de loods
  let schaduwMannen = null;        // de twee mannen (`schutters`, zolang ze van deze missie zijn)
  let schaduwT = 0, schaduwDichtT = 0, schaduwVerT = 0, schaduwMarkT = 0, schaduwMeldT = 0;
  let schaduwStopGezegd = false, schaduwHint = false;
  let schaduwAfstand = null;       // de laatst gemeten afstand tot Bouwman (m)
  let schaduwKlokWas = null;       // liep de klok voor "Die avond…"? Dan loopt hij na de ochtend weer
  const schaduwMerk = schaduw.fotos.map(() => maakMarkering(scene));
  const schaduwBalk = document.getElementById('schaduwbalk');
  const schaduwFlits = document.getElementById('fotoflits');

  function bouwmanAuto() {
    const p = schaduw.punt(0);
    if (!raceBouwmanAuto) zetBouwmanAuto({ x: p.x, z: p.z, yaw: p.yaw });
    return raceBouwmanAuto;
  }
  function ruimSchaduwOp() {
    for (const m of schaduwMerk) m.toon(false);
    if (schaduwBalk) schaduwBalk.hidden = true;
    schaduwHint = false;
    schaduwRit = null;
    if (schaduwMannen && schutters === schaduwMannen) { schutters.verwijder(); schutters = null; }
    schaduwMannen = null;
    if (schaduwBus && schaduwBus.mesh) { schaduwBus.mesh.visible = false; schaduwBus.x = schaduwBus.z = 1e5; schaduwBus.mesh.position.set(1e5, 0, 1e5); }
    schaduwDichtT = 0; schaduwVerT = 0; schaduwStopGezegd = false; schaduwAfstand = null;
    if (vehicles.vrijeZone === schaduw.opRoute) vehicles.vrijeZone = null;
    vehicles.zoneSlaapt = false;
    if (schaduwKlokWas !== null && klokLoopt) klokLoopt(schaduwKlokWas);
    schaduwKlokWas = null;
  }
  function beginSchaduw() {
    fase = 'telefoon';
    ruimSchaduwOp();
    schaduwFotos = [false, false, false];
    schaduwGezien = false;
    schaduwT = 1.2;
    markZichtbaar(false);
    zetOpdracht('neem de telefoon op');
    hud.zetNavigatie(null); navDoel = null;
  }
  function naarMarkSchaduw() {
    fase = 'naarMark'; zetPunt(fase);
    markZichtbaar(false);          // hij zit binnen
    const d = molenkriteDeur();
    zetOpdracht('ga naar Mark in Molenkrite 15');
    zetNavDoel(d.x, d.z, 'Molenkrite 15', 'M');
  }
  function naarDeAvond() {
    fase = 'avond';
    markZichtbaar(false);
    zetOpdracht('');
    hud.zetNavigatie(null); navDoel = null;
    zwartMet('Die avond…', opDeWacht);
  }

  /*
   Die avond om elf uur: je zit in de oude Golf van Mark op het voorterrein van het
   Autohuis, en aan de overkant staat Bouwman met zijn politieauto bij de pomp. De
   loods is er al, met de twee mannen en de bestelbus: die wachten op hem.
  */
  function opDeWacht() {
    fase = 'wacht'; zetPunt(fase);
    if (zetUur) zetUur(SCHADUW_UUR);
    if (sterrenWeg) sterrenWeg();
    ruimSchaduwOp();
    /*
     De hele nacht donker (verzoek 28 sep 2026: "laat het tijdens missie 15 gewoon
     donker zijn en geen dag-nachtritme"): de klok staat stil tot de volgende ochtend.
    */
    if (klokLoopt) { schaduwKlokWas = klokLoopt(); klokLoopt(false); }
    schaduwRit = schaduw.nieuweRit();
    const car = bouwmanAuto();
    zetBouwmanAuto({ ...schaduw.punt(0), yaw: schaduw.punt(0).yaw });
    schaduw.rijd(schaduwRit, car, 0);
    bouwman.groep.visible = false;               // hij zit in zijn auto
    ronald.groep.visible = false;
    // de Golf, met de neus naar de Lemmerweg (dezelfde als de vorige keer, als die er nog is)
    const G = { x: 766.5, z: 118.5, yaw: Math.PI / 2 };
    if (!schaduwGolf || schaduwGolf.wrak || (schaduwGolf.hp !== undefined && schaduwGolf.hp <= 0)) {
      schaduwGolf = vehicles.voegToe({ x: G.x, z: G.z, yaw: G.yaw, soort: 'hatch', kleur: 0x6b7178 });
    }
    const g = schaduwGolf;
    if (player.inCar && player.inCar !== g) { player.inCar.speed = 0; player.inCar = null; }
    g.x = G.x; g.z = G.z; g.yaw = G.yaw; g.rij = G.yaw; g.speed = 0; g.driveable = true;
    if (g.mesh) { g.mesh.visible = true; g.mesh.position.set(G.x, g.mesh.position.y, G.z); g.mesh.rotation.y = G.yaw; }
    player.pos.set(G.x, 0, G.z);
    if (stapIn) stapIn(g); else player.inCar = g;
    // de bestelbus en de twee mannen bij de loods
    const B = schaduw.bus;
    if (!schaduwBus) schaduwBus = vehicles.voegToe({ x: B.x, z: B.z, yaw: B.yaw, soort: 'van', kleur: 0xe8e8e4 });
    const bus = schaduwBus;
    bus.x = B.x; bus.z = B.z; bus.yaw = B.yaw; bus.speed = 0; bus.driveable = false;
    if (bus.mesh) { bus.mesh.visible = true; bus.mesh.position.set(B.x, bus.mesh.position.y, B.z); bus.mesh.rotation.y = B.yaw; }
    if (schutters) { schutters.verwijder(); schutters = null; }
    gevallen.clear();
    schutters = schaduwMannen = new Bewaking(scene, schaduw.posten, { ...SCHADUW_MANNEN, terrein: schaduw.opHetErf });
    // geen wijkverkeer op zijn route zolang je hem volgt (het beeld is nu zwart: wat er rijdt verhuist)
    vehicles.vrijeZone = schaduw.opRoute;
    vehicles.zoneSlaapt = true;
    if (vehicles.maakVrij) vehicles.maakVrij(G.x, G.z);
    schaduwT = 6;
    spanning = true; spanningUit = 0;
    zetOpdracht('wacht tot Bouwman wegrijdt');
    zetMarker(car.x, car.z, 'B');
    zeg(SCHADUW_DAAR, null, { auto: 2.6 });
  }
  function aanDeLoods() {
    fase = 'loods'; zetPunt(fase);
    if (vehicles.vrijeZone === schaduw.opRoute) vehicles.vrijeZone = null;
    vehicles.zoneSlaapt = false;
    const st = schaduw.bouwmanStaat;
    if (!schaduwGezien) {
      bouwman.zetNeer(st.x, st.z, kijkHoek(st, schaduw.bus));
      bouwman.groep.visible = true;
    }
    if (schaduwBalk) schaduwBalk.hidden = true;
    schaduw.fotos.forEach((f, i) => { schaduwMerk[i].zet(f.plek.x, 0.14, f.plek.z); schaduwMerk[i].toon(!schaduwFotos[i]); });
    const d = schaduw.loods.deur;
    zetMarker(d.x, d.z, 'L');
    zetFotoOpdracht();
    if (balk.hidden && !schaduwGezien) zeg(SCHADUW_LOODS, null, { auto: 2.6 });
  }
  function zetFotoOpdracht() {
    const n = schaduwFotos.filter(Boolean).length;
    zetOpdracht(schaduwGezien ? `maak de foto's af (${n} van 3)` : `maak drie foto's bij de loods zonder gezien te worden (${n} van 3)`);
  }
  // Bouwman gaat ervandoor: dezelfde weg terug, aan de andere kant
  function bouwmanVlucht() {
    if (!schaduwRit) return;
    schaduwRit.vlucht = true; schaduwRit.wacht = 0; schaduwRit.klaar = false;
    bouwman.groep.visible = false;
  }
  function gezienBijDeLoods() {
    if (schaduwGezien) return;
    schaduwGezien = true;
    bouwmanVlucht();
    hud.show('GEZIEN', 2);
    zeg(SCHADUW_GEZIEN, null, { auto: 2.2 });
    if (fase === 'loods') zetFotoOpdracht();
  }
  function naarMarkMetFotos() {
    fase = 'terug'; zetPunt(fase);
    for (const m of schaduwMerk) m.toon(false);
    const d = molenkriteDeur();
    zetOpdracht('breng de foto\'s naar Mark in Molenkrite 15');
    zetNavDoel(d.x, d.z, 'Molenkrite 15', 'M');
  }
  // welke foto kun je hier maken? (op de ruit, en recht naar het onderwerp kijkend)
  function fotoHier() {
    if (missie !== 'schaduw' || fase !== 'loods' || player.inCar) return null;
    const sp = spelerPunt();
    for (let i = 0; i < schaduw.fotos.length; i++) {
      if (schaduwFotos[i]) continue;
      const f = schaduw.fotos[i];
      if (Math.hypot(sp.x - f.plek.x, sp.z - f.plek.z) > SCHADUW_FOTO) continue;
      const vx = -Math.sin(player.yaw), vz = -Math.cos(player.yaw);
      const dx = f.kijk.x - sp.x, dz = f.kijk.z - sp.z, l = Math.hypot(dx, dz) || 1;
      const hoek = Math.acos(Math.max(-1, Math.min(1, (vx * dx + vz * dz) / l)));
      return { i, f, recht: hoek < SCHADUW_RICHT };
    }
    return null;
  }
  function schaduwToets() {
    const h = fotoHier();
    if (!h || !h.recht) return false;
    schaduwFotos[h.i] = true;
    schaduwMerk[h.i].toon(false);
    schaduwHint = false; praatEl.hidden = true;
    if (geluid.fotoKlik) geluid.fotoKlik();
    if (schaduwFlits) { schaduwFlits.classList.remove('aan'); void schaduwFlits.offsetWidth; schaduwFlits.classList.add('aan'); }
    const n = schaduwFotos.filter(Boolean).length;
    hud.show(`FOTO ${n} VAN 3`, 1.6);
    if (n >= schaduwFotos.length) { zeg([...SCHADUW_FOTOS[h.i], ...SCHADUW_GENOEG], naarMarkMetFotos); return true; }
    zeg(SCHADUW_FOTOS[h.i], null, { auto: 3.0 });
    zetFotoOpdracht();
    return true;
  }
  /*
   "Blijf hier maar even slapen": zwart, "De volgende ochtend", en je staat om tien
   uur voor de deur van Molenkrite 15, met MISSIE GESLAAGD. De klok loopt dan weer
   zoals hij liep voor "Die avond…".
  */
  function wakkerBijMark() {
    fase = 'slapen';
    zetOpdracht('');
    hud.zetNavigatie(null); navDoel = null;
    zwartMet('De volgende ochtend', () => {
      if (zetUur) zetUur(SCHADUW_OCHTEND);
      const w = molenkrite && molenkrite();
      const d = molenkriteDeur(), stoep = (w && w.plekken && w.plekken.stoep) || d;
      player.inCar = null;
      const [px, pz] = resolveCollisions(stoep.x, stoep.z, 0.4);
      player.pos.set(px, 0, pz);
      player.yaw = kijkHoek(d, stoep);
      player.pitch = 0;
      player.applyCamera();
      schaduwGeslaagd();
    });
  }
  function schaduwGeslaagd() {
    const beloning = schaduwGezien ? SCHADUW_BELONING / 2 : SCHADUW_BELONING;
    fase = 'klaar';
    missie = 'klaar';
    schaduwKlaar = true;
    zetOpdracht('');
    hud.zetNavigatie(null); navDoel = null;
    verdien(beloning);
    spanningUit = 6;
    hud.melding('MISSIE GESLAAGD – BOUWMAN SCHADUWEN', `Beloning: + ${euro(beloning)} toegevoegd aan wallet`, 8);
    markZichtbaar(false);
    // de loods staat er nog, maar Bouwman, zijn mannen en de bus zijn weg
    ruimSchaduwOp();
    bouwman.groep.visible = false;
    if (raceBouwmanAuto && raceBouwmanAuto.mesh) { raceBouwmanAuto.mesh.visible = false; raceBouwmanAuto.x = raceBouwmanAuto.z = 1e5; raceBouwmanAuto.mesh.position.set(1e5, 0, 1e5); }
    // een minuut later belt Johan (missie 16)
    if (!invalKlaar) { naMissieNaam = 'inval'; naMissieT = INVAL_WACHT; }
  }

  // de balk die zegt hoe ver je achter hem zit: rood te dichtbij, groen goed, rood te ver
  function zetSchaduwBalk(d, dicht) {
    if (!schaduwBalk) return;
    schaduwBalk.hidden = false;
    const schaal = 200;
    const q = (m) => `${Math.max(0, Math.min(100, m / schaal * 100)).toFixed(1)}%`;
    schaduwBalk.style.setProperty('--dicht', q(dicht));
    schaduwBalk.style.setProperty('--ver', q(SCHADUW_VER));
    schaduwBalk.style.setProperty('--nu', q(d));
    const t = schaduwBalk.querySelector('.tekst');
    const staat = d < dicht ? 'te dichtbij!' : d > SCHADUW_VER ? 'je raakt hem kwijt!' : 'goed zo';
    if (t) t.textContent = `Bouwman · ${Math.round(d)} m · ${staat}`;
    schaduwBalk.classList.toggle('fout', d < dicht || d > SCHADUW_VER);
  }

  function werkSchaduwBij(dt, sp) {
    if (fase === 'klaar') return;
    if (fase === 'telefoon') {
      if (schaduwT > 0) {
        schaduwT -= dt;
        if (schaduwT <= 0) {
          geluid.telefoon();
          zeg(SCHADUW_TELEFOON, () => {
            naarMarkSchaduw();
            hud.melding('NIEUWE MISSIE – BOUWMAN SCHADUWEN', 'Mark wacht thuis, in Molenkrite 15. Er staat een M op de kaart.', 7);
          }, { wie: 'Mark', telefoon: true, kop: KOPPEN.mark });
        }
      }
      return;
    }
    if (fase === 'naarMark' || fase === 'terug') {
      if (fase === 'terug' && klokLoopt && klokLoopt()) klokLoopt(false);     // het is nog steeds nacht
      navKlok += dt;
      if (navKlok > 2) { navKlok = 0; werkNavBij(); }
      const woning = molenkrite && molenkrite();
      if (!woning || !woning.binnen || !woning.binnen(sp.x, sp.z) || !balk.hidden) return;
      opDeBank(mark, woning.plekken, { x: sp.x, z: sp.z });
      markZichtbaar(true);
      hud.zetNavigatie(null); navDoel = null;
      zetOpdracht('');
      if (fase === 'naarMark') { fase = 'gesprek'; zeg(SCHADUW_BINNEN, naarDeAvond); }
      else { fase = 'afronding'; zeg(SCHADUW_KLAAR(schaduwGezien), wakkerBijMark); }
      return;
    }
    // de nacht blijft nacht, ook als iemand de klok aanzet
    if (fase !== 'gesprek' && klokLoopt && klokLoopt()) klokLoopt(false);
    if (fase === 'gesprek' || fase === 'afronding' || fase === 'slapen') { mark.update(dt, { zit: BANK_ZITTING }); return; }
    if (fase === 'avond') return;

    // ---- de rit van Bouwman, en of hij je ziet ----
    const car = bouwmanAuto();
    if (fase === 'wacht' && schaduwT > 0) {
      schaduwT -= dt;
      if (schaduwT <= 0) {
        fase = 'volgen';
        zetOpdracht('volg Bouwman — niet te dichtbij, en raak hem niet kwijt');
        if (balk.hidden || (gesprek && gesprek.auto)) zeg(SCHADUW_WEG, null, { auto: 2.4 });
      }
    }
    if (schaduwRit && (fase === 'volgen' || schaduwRit.vlucht)) {
      schaduw.rijd(schaduwRit, car, dt);
      if (schaduwRit.weg && car.mesh) { car.mesh.visible = false; car.x = car.z = 1e5; car.mesh.position.set(1e5, 0, 1e5); }
    }
    // de mannen bij de loods: zien ze je, dan is het voorbij met het stil blijven
    if (schaduwMannen && schaduwMannen.alarm && !schaduwGezien && (fase === 'volgen' || fase === 'loods' || fase === 'wacht')) gezienBijDeLoods();

    if (fase === 'wacht' || fase === 'volgen') {
      const d = afst(sp, car);
      schaduwAfstand = d;
      const ferrari = player.inCar && player.inCar.soort === 'ferrari';
      let dicht = ferrari ? SCHADUW_DICHT_FERRARI : SCHADUW_DICHT;
      if (fase === 'volgen' && schaduwRit && schaduwRit.wacht > 0) dicht = Math.max(dicht, SCHADUW_DICHT_STIL);
      if (fase === 'wacht') dicht = Math.max(dicht, SCHADUW_DICHT_STIL);
      if (d < dicht) schaduwDichtT += dt; else schaduwDichtT = Math.max(0, schaduwDichtT - dt * 0.5);
      if (fase === 'volgen' && d > SCHADUW_VER) schaduwVerT += dt; else schaduwVerT = 0;
      zetSchaduwBalk(d, dicht);
      schaduwMarkT -= dt;
      if (schaduwMarkT <= 0) { schaduwMarkT = 0.5; zetMarker(car.x, car.z, 'B'); }
      schaduwMeldT -= dt;
      if (schaduwMeldT <= 0 && schaduwDichtT > 1) { schaduwMeldT = 3; hud.show('TE DICHTBIJ', 1.2); }
      if (schaduwMeldT <= 0 && schaduwVerT > 1.5) { schaduwMeldT = 3; hud.show('JE RAAKT HEM KWIJT', 1.2); }
      if (schaduwDichtT > SCHADUW_DICHT_T) {
        if (schaduwBalk) schaduwBalk.hidden = true;
        if (sterGeven) sterGeven(SCHADUW_STERREN, car.x, car.z);
        mislukt('Bouwman heeft je gezien.');
        return;
      }
      if (schaduwVerT > SCHADUW_VER_T) {
        if (schaduwBalk) schaduwBalk.hidden = true;
        mislukt('Je bent Bouwman kwijtgeraakt.');
        return;
      }
      if (fase === 'volgen' && schaduwRit && schaduwRit.wacht > 0 && !schaduwStopGezegd && d < 150) {
        schaduwStopGezegd = true;
        if (balk.hidden || (gesprek && gesprek.auto)) zeg(SCHADUW_STOP, null, { auto: 3.0 });
      }
      if (fase === 'volgen' && schaduwRit && schaduwRit.klaar) aanDeLoods();
      return;
    }

    // ---- bij de loods ----
    if (fase === 'loods') {
      for (const m of schaduwMerk) m.update(dt);
      if (bouwman.groep.visible) { bouwman.kijkNaar(schaduw.bus.x, schaduw.bus.z, dt, 1); bouwman.update(dt, {}); }
      const h = fotoHier();
      const toon = !!h && balk.hidden && (player.active || window.__autoplay);
      if (toon) { praatEl.textContent = h.recht ? `E — foto maken: ${h.f.wat}` : `richt op ${h.f.wat}`; praatEl.hidden = false; }
      else if (schaduwHint) praatEl.hidden = true;
      schaduwHint = toon;
    }
  }

  /*
   Opnieuw na het neergaan, een mislukking of het laden. Het volgen begint weer bij
   het Autohuis (de rit halverwege oppakken kan niet: Bouwman weet dan waar je bent);
   bij de loods sta je weer op de weg ervoor, met de foto's die je al had.
  */
  function hervatSchaduw(f) {
    const fotos = schaduwFotos.slice(), gezien = schaduwGezien;
    beginSchaduw();
    if (f === 'telefoon') return;
    if (f === 'naarMark' || f === 'gesprek') { naarMarkSchaduw(); return; }
    if (f === 'terug' || f === 'afronding' || f === 'slapen') { schaduwFotos = [true, true, true]; schaduwGezien = gezien; naarMarkMetFotos(); return; }
    opDeWacht();
    if (f !== 'loods') return;
    schaduwFotos = fotos; schaduwGezien = gezien;
    schaduwRit.s = schaduw.lijn.lengte; schaduwRit.klaar = true; schaduwRit.gestopt = true;
    schaduw.rijd(schaduwRit, bouwmanAuto(), 0);
    // de Golf op de weg vóór de loods
    const g = schaduwGolf;
    const w = { x: 1428, z: -216.5, yaw: Math.PI / 2 };
    g.x = w.x; g.z = w.z; g.yaw = w.yaw; g.rij = w.yaw; g.speed = 0;
    if (g.mesh) { g.mesh.position.set(w.x, g.mesh.position.y, w.z); g.mesh.rotation.y = w.yaw; }
    player.pos.set(w.x, 0, w.z);
    gesprek = null; sluitBalk();
    aanDeLoods();
    if (schaduwGezien) bouwmanVlucht();
  }

  /*
   ---------- missie 16: De inval ----------
     telefoon      Johan belt, een minuut na de ochtend bij Mark
     leeghalen     drie minuten: het schrift (bij de bank) en de foto's (op het dressoir)
     naarBuiten    Mark gaat mee naar buiten
     instappen     in je auto (of de Golf van Mark voor de deur); de tijd loopt door
     invalFilm     het filmbeeld: twee politieauto's en een zwart busje draaien de straat in
     afschudden    drie sterren, Mark praat
     naarWieken    naar de Wieken 29
     bouwmanBelt   Bouwman belt: Johan tegen het schrift
     keuze         1 ruilen · 2 hinderlaag
     nacht         "Die nacht…"
     brugFilm      het filmbeeld: Bouwman rijdt de Dúvelsrak op
     ruilLopen     wapen weg, naar de gele ruit, E: de tas neer
     achteruit     vijf stappen terug
     ophalen       een van de mannen haalt de tas
     kijken        Bouwman kijkt erin
     vrij          (1) Johan loopt naar je toe, Bouwman rijdt weg
     nuFilm        (2) "Nu!": Mark op het dak, twee schoten
     achtervolging (2) ram Bouwman van de weg
     crashFilm     (2) hij vliegt de berm in en rent weg
     doorzoeken    (2) zijn telefoon: "— R."
     naarWiekenB   terug naar Mark
     afronding     het einde, en "De volgende ochtend"
   Bouwman en zijn politieauto zijn die uit missie 14 en 15 (`bouwman`, `raceBouwmanAuto`).
   De lijnen over de weg staan in js/inval.js.
  */
  let invalKlaar = false;
  let invalKeus = 0;               // 1 ruilen, 2 hinderlaag
  let invalTelefoon = false;       // de telefoon van Bouwman gevonden
  let schriftKwijt = false;        // na de ruil heeft Bouwman het schrift (de finale wordt zwaarder)
  let invalT = 0, invalKlok = 0, invalMeldT = 0, invalMeldI = 0, invalNaT = 0;
  let invalHeeft = { schrift: false, fotos: false };
  let invalBinnenGezegd = false;
  let invalGolf = null;            // de Golf van Mark voor de deur, als je zelf geen auto hebt
  let invalRoute = null;           // { pts, lengte }: de Molenkrite in, naar de voordeur
  let invalKonvooi = [];           // { auto, lijn, a, eind, v, stil, politie }
  let invalFilm = null;            // { soort, t, vast }
  let invalMannen = null;          // de twee mannen van Bouwman op de brug (`schutters`)
  let invalVlucht = null;          // de vlucht van Bouwman (js/inval.js)
  let invalVluchtLijn = null, invalRotonde = null;
  let invalKlappen = 0, invalKlapT = 0, invalKwijtT = 0, invalRotondeGezegd = false;
  let invalWapenT = 0, invalWapenGezegd = false;
  let invalLoper = null;           // wie er loopt: { p, naar, v, na }
  let invalCrash = null;           // { t, van, zij, yaw }
  let invalKlokWas = null;
  const invalJohan = new Persoon({ shirt: 0x3d6b3a, broek: 0x2b3542, huid: 0xd3a273, haar: 0x3a2a1c, hoogte: 1.05 });
  invalJohan.groep.visible = false; scene.add(invalJohan.groep);
  const invalTas = maakTas(scene); invalTas.toon(false);
  const invalMerken = [maakMarkering(scene), maakMarkering(scene)];
  const invalMerkPlek = [null, null];          // (een markering zegt zelf niet waar hij staat)
  for (const m of invalMerken) m.toon(false);
  function zetInvalMerk(i, x, y, z) { invalMerken[i].zet(x, y, z); invalMerken[i].toon(true); invalMerkPlek[i] = { x, z }; }
  let invalHint = false;
  // een E-regel van deze missie in beeld, of weer weg
  function invalPraat(tekst) {
    if (tekst) { praatEl.textContent = tekst; praatEl.hidden = false; invalHint = true; }
    else if (invalHint) { praatEl.hidden = true; invalHint = false; }
  }
  const invalBalk = document.getElementById('schaduwbalk');
  const invalP = (s, u = 0) => brug.p(s, u);

  function wiekenDeur() {
    const pand = pandVan(HUIS_THUIS);
    return pand ? voorPunt(pand, 5.5) : thuis;
  }
  // waar een auto voor Molenkrite 15 staat: op de rijbaan aan de kant van het huis
  function plekVoorDeDeur() {
    let beste = null;
    for (const as of KAART.wegassen || []) {
      if (!as.drive) continue;
      for (let i = 1; i < as.pts.length; i++) {
        const a = as.pts[i - 1], b = as.pts[i];
        const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz;
        if (L2 < 1) continue;
        const t = Math.max(0, Math.min(1, ((thuis.x - a[0]) * dx + (thuis.z - a[1]) * dz) / L2));
        const x = a[0] + dx * t, z = a[1] + dz * t, d = Math.hypot(x - thuis.x, z - thuis.z);
        if (!beste || d < beste.d) { const L = Math.sqrt(L2); beste = { d, x, z, ux: dx / L, uz: dz / L, w: as.w || 5 }; }
      }
    }
    if (!beste) return { x: thuis.x, z: thuis.z, yaw: 0, as: { x: thuis.x, z: thuis.z } };
    let nx = -beste.uz, nz = beste.ux;
    if ((thuis.x - beste.x) * nx + (thuis.z - beste.z) * nz < 0) { nx = -nx; nz = -nz; }
    const zij = Math.max(0.8, beste.w / 2 - 1.0);
    const [px, pz] = resolveCollisions(beste.x + nx * zij, beste.z + nz * zij, 1.2);
    return { x: px, z: pz, yaw: Math.atan2(-beste.ux, -beste.uz), as: { x: beste.x, z: beste.z } };
  }
  function zetInvalBalk(tekst, deel, fout) {
    if (!invalBalk) return;
    invalBalk.hidden = false;
    invalBalk.style.setProperty('--dicht', '16.7%');
    invalBalk.style.setProperty('--ver', '100%');
    invalBalk.style.setProperty('--nu', `${Math.max(0, Math.min(100, deel * 100)).toFixed(1)}%`);
    const t = invalBalk.querySelector('.tekst');
    if (t) t.textContent = tekst;
    invalBalk.classList.toggle('fout', !!fout);
  }
  function verstopAuto(a) {
    if (!a) return;
    a.speed = 0; a.driveable = false; a.zichtbaar = false;
    if (a.mesh) { a.mesh.visible = false; a.mesh.position.set(1e5, 0, 1e5); }
    a.x = a.z = 1e5;
  }
  function ruimInvalOp() {
    for (const m of invalMerken) m.toon(false);
    invalMerkPlek[0] = invalMerkPlek[1] = null;
    invalPraat(null);
    invalTas.toon(false);
    invalJohan.groep.visible = false;
    if (invalBalk) invalBalk.hidden = true;
    for (const k of invalKonvooi) verstopAuto(k.auto);
    invalKonvooi = [];
    if (invalFilm) { invalFilm = null; toonFilmbalken(0); }
    if (invalMannen && schutters === invalMannen) { schutters.verwijder(); schutters = null; }
    invalMannen = null;
    invalVlucht = null; invalLoper = null; invalCrash = null;
    invalKlappen = 0; invalKlapT = 0; invalKwijtT = 0; invalRotondeGezegd = false;
    invalWapenT = 0; invalWapenGezegd = false;
    if (invalKlokWas !== null && klokLoopt) klokLoopt(invalKlokWas);
    invalKlokWas = null;
    schietSlot(false);
  }
  function beginInval() {
    fase = 'telefoon';
    ruimInvalOp();
    invalHeeft = { schrift: false, fotos: false };
    invalBinnenGezegd = false;
    invalKeus = 0; invalTelefoon = false;
    invalT = 1.2;
    markZichtbaar(false);
    zetOpdracht('neem de telefoon op');
    hud.zetNavigatie(null); navDoel = null;
  }
  // na het neergaan of het laden: je staat weer voor de deur van Molenkrite 15
  function voorMolenkrite15() {
    const w = molenkrite && molenkrite();
    const d = molenkriteDeur(), stoep = (w && w.plekken && w.plekken.stoep) || d;
    if (player.inCar) { player.inCar.speed = 0; player.inCar = null; if (eersteP) eersteP(); }
    const [px, pz] = resolveCollisions(stoep.x, stoep.z, 0.4);
    player.pos.set(px, 0, pz);
    player.yaw = kijkHoek(d, stoep); player.pitch = 0;
    player.applyCamera();
  }

  // ---- de drie minuten ----
  function startLeeghalen() {
    fase = 'leeghalen'; zetPunt('telefoon');
    invalKlok = INVAL_TIJD;
    spanning = true; spanningUit = 0;
    const w = molenkrite && molenkrite();
    if (w && w.plekken) {
      opDeBank(mark, w.plekken, thuis);
      markZichtbaar(true);
      const b = w.plekken.bank, r = w.plekken.radio || w.plekken.tafel;
      if (b) zetInvalMerk(0, b.x, 0.14, b.z);
      if (r) zetInvalMerk(1, r.x, 0.14, r.z);
    }
    const d = molenkriteDeur();
    zetOpdracht('haal het schrift en de foto\'s, en Mark');
    zetNavDoel(d.x, d.z, 'Molenkrite 15', 'M');
    hud.melding('MISSIE 16 · DE INVAL', 'Drie minuten. Het schrift, de foto\'s, en Mark.', 6);
  }
  function invalHier() {
    // welke ruit binnen: 0 het schrift, 1 de foto's
    if (missie !== 'inval' || fase !== 'leeghalen' || player.inCar) return -1;
    const sp = spelerPunt();
    for (let i = 0; i < 2; i++) {
      if (i === 0 ? invalHeeft.schrift : invalHeeft.fotos) continue;
      const q = invalMerkPlek[i];
      if (!invalMerken[i].zichtbaar || !q) continue;
      if (Math.hypot(sp.x - q.x, sp.z - q.z) < INVAL_RUIT) return i;
    }
    return -1;
  }
  function naarBuiten() {
    fase = 'naarBuiten';
    markZichtbaar(false);          // hij pakt zijn tas en loopt voor je uit
    zetOpdracht('naar buiten: Mark gaat mee');
    zeg(INVAL_WEG, null, { auto: 2.4 });
  }
  function buitenMetMark() {
    fase = 'instappen';
    const sp = spelerPunt();
    const [mx, mz] = resolveCollisions(sp.x + 1.6, sp.z + 1.2, 0.4);
    mark.zetNeer(mx, mz, kijkHoek({ x: mx, z: mz }, sp));
    markZichtbaar(true);
    // een auto voor de deur: die van jou als hij in de buurt staat, anders de Golf van Mark
    const eigen = vehicles.nearestDriveable ? vehicles.nearestDriveable(sp.x, sp.z) : null;
    if (!eigen || Math.hypot(eigen.x - sp.x, eigen.z - sp.z) > 35) {
      const v = plekVoorDeDeur();
      if (!invalGolf || invalGolf.wrak) invalGolf = vehicles.voegToe({ x: v.x, z: v.z, yaw: v.yaw, soort: 'hatch', kleur: 0x6b7178 });
      const g = invalGolf;
      g.x = v.x; g.z = v.z; g.yaw = v.yaw; g.rij = v.yaw; g.speed = 0; g.driveable = true; g.zichtbaar = true;
      if (g.mesh) { g.mesh.visible = true; g.mesh.position.set(v.x, g.mesh.position.y, v.z); g.mesh.rotation.y = v.yaw; }
    }
    zetOpdracht('stap in je auto — Mark rijdt mee');
  }

  // ---- het filmbeeld van de inval ----
  function startInvalFilm() {
    fase = 'invalFilm';
    if (invalBalk) invalBalk.hidden = true;
    const auto = player.inCar;
    const voor = plekVoorDeDeur();
    const route = invalRouteVan(voor);
    invalRoute = route;
    for (const k of invalKonvooi) verstopAuto(k.auto);
    invalKonvooi = [];
    if (route) {
      const L = route.lengte;
      const soorten = ['politie', 'politie', 'bus'];
      invalKonvooi = soorten.map((soort, i) => {
        const a = (soorten.length - 1 - i) * 10;
        const eind = Math.max(a + 5, L - 8 - i * 11);
        const p = opLijn(route.pts, a);
        const yaw = Math.atan2(-p.ux, -p.uz);
        const car = soort === 'politie' && parkeerPolitieAuto ? parkeerPolitieAuto(p.x, p.z, yaw)
          : vehicles.voegToe({ x: p.x, z: p.z, yaw, soort: 'van', kleur: 0x111214, driveable: false });
        car.driveable = false;
        vehicles.zetNeer(car, 0, yaw);
        return { auto: car, lijn: route.pts, a, eind, v: 9, stil: false, politie: soort === 'politie' };
      });
    }
    invalFilm = { soort: 'inval', t: 0, vast: auto ? { x: auto.x, z: auto.z, yaw: auto.yaw, auto } : { x: player.pos.x, z: player.pos.z } };
    schietSlot(true);
    zetOpdracht('');
  }
  function invalRouteVan(voor) {
    return invalRouteJs(KAART, voor);
  }
  function werkInvalKonvooiBij(dt) {
    let stil = true;
    for (const k of invalKonvooi) {
      if (k.stil) continue;
      const rest = k.eind - k.a;
      k.v = Math.min(11, Math.sqrt(2 * 4.2 * Math.max(0, rest)));
      k.a += Math.min(rest, Math.max(k.v, 0.4) * dt);
      const p = opLijn(k.lijn, k.a);
      const car = k.auto, vorige = car.yaw;
      car.x = p.x; car.z = p.z; car.yaw = Math.atan2(-p.ux, -p.uz); car.speed = k.v;
      vehicles.zetNeer(car, dt, vorige);
      if (k.eind - k.a < 0.05) { k.stil = true; car.speed = 0; } else stil = false;
    }
    // de zwaailichten knipperen
    const aan = Math.floor(performance.now() / 260) % 2 === 0;
    for (const k of invalKonvooi) {
      const z = k.politie && k.auto.zwaailicht;
      if (z) { zetZwaailamp(z.links, aan ? 1 : 0, false); zetZwaailamp(z.rechts, aan ? 0 : 1, false); }
    }
    return stil;
  }
  function eindeInvalFilm() {
    invalFilm = null;
    toonFilmbalken(0);
    schietSlot(false);
    player.applyCamera();
    fase = 'afschudden';
    if (sterGeven) sterGeven(INVAL_STERREN, thuis.x, thuis.z);
    if (stuurPolitie && invalRoute) stuurPolitie(invalRoute.pts, 2, 5);
    zeg(INVAL_DAAR, null, { auto: 2.2 });
    zetOpdracht('raak de politie kwijt — Mark zit naast je');
    hud.zetNavigatie(null); navDoel = null;
    invalT = 0; invalMeldT = 9; invalMeldI = 0;
  }

  // ---- de Wieken en de keuze ----
  function naarDeWiekenMetMark() {
    fase = 'naarWieken'; zetPunt(fase);
    const d = wiekenDeur();
    zetOpdracht('rij naar de Wieken 29');
    zetNavDoel(d.x, d.z, 'de Wieken 29', 'M');
  }
  function bouwmanBelt() {
    fase = 'bouwmanBelt';
    const sp = spelerPunt();
    if (player.inCar) { player.inCar.speed = 0; }
    const [mx, mz] = resolveCollisions(sp.x + 2.2, sp.z + 1.4, 0.4);
    mark.zetNeer(mx, mz, kijkHoek({ x: mx, z: mz }, sp));
    markZichtbaar(true);
    hud.zetNavigatie(null); navDoel = null;
    zetOpdracht('');
    geluid.telefoon();
    zeg(INVAL_BOUWMAN_BELT, () => {
      fase = 'keuze';
      zetOpdracht('1 — het schrift ruilen tegen Johan · 2 — een hinderlaag met Mark op het dak');
      hud.melding('WAT DOE JE?', '1 — ruilen · 2 — hinderlaag', 10);
    });
  }
  // 1 of 2 (js/main.js stuurt de cijfers via `kiesHuis`)
  function invalKeuze(nr) {
    if (missie !== 'inval' || fase !== 'keuze' || (nr !== 1 && nr !== 2)) return false;
    invalKeus = nr;
    fase = 'nacht';
    zetOpdracht('');
    zeg(nr === 1 ? INVAL_KEUS_RUIL : INVAL_KEUS_HINDERLAAG, () => zwartMet('Die nacht…', opDeBrugNacht));
    return true;
  }

  // ---- die nacht op de Dúvelsrak ----
  function opDeBrugNacht() {
    ruimInvalOp();
    fase = 'brugFilm'; zetPunt('brug');
    if (zetUur) zetUur(INVAL_NACHT);
    if (klokLoopt) { invalKlokWas = klokLoopt(); klokLoopt(false); }
    if (sterrenWeg) sterrenWeg();
    markZichtbaar(false);            // hij ligt op zijn dak (of zit thuis)
    // jouw auto aan de Tinga-kant van het dek
    let auto = player.inCar || invalGolf;
    if (player.inCar) { player.inCar.speed = 0; player.inCar = null; if (eersteP) eersteP(); geluid.motorUit(); }
    if (!auto || auto.wrak) auto = invalGolf = vehicles.voegToe({ x: 0, z: 0, yaw: 0, soort: 'hatch', kleur: 0x6b7178 });
    const q = invalP(INVAL_S.erikAuto[0], INVAL_S.erikAuto[1]);
    auto.x = q.x; auto.z = q.z; auto.yaw = brug.noord; auto.rij = brug.noord; auto.speed = 0;
    auto.driveable = true; auto.zichtbaar = true;
    if (auto.mesh) { auto.mesh.visible = true; auto.mesh.position.set(q.x, brug.hoogte, q.z); auto.mesh.rotation.y = brug.noord; }
    vehicles.zetNeer(auto, 0, brug.noord);
    const e = invalP(INVAL_S.erik, -1.0);
    player.pos.set(e.x, brug.hoogte, e.z);
    player.yaw = brug.noord; player.pitch = 0;
    player.applyCamera();
    // Bouwman komt van de Lemmerweg de helling op
    const lijn = brug.vanLemmerweg(BRUG_HELLING, INVAL_S.auto, -INVAL.draai);
    const p = opLijn(lijn, 0);
    zetBouwmanAuto({ x: p.x, z: p.z, yaw: Math.atan2(-p.ux, -p.uz) });
    const car = raceBouwmanAuto;
    if (car.mesh) car.mesh.position.y = grondHoogte(p.x, p.z, Infinity);
    vehicles.zetNeer(car, 0, car.yaw);
    invalKonvooi = [{ auto: car, lijn, a: 0, eind: lijnLengte(lijn), v: 8, stil: false, bouwman: true }];
    bouwman.groep.visible = false;
    invalJohan.groep.visible = false;
    spanning = true; spanningUit = 0;
    invalFilm = { soort: 'brug', t: 0, vast: { x: e.x, z: e.z } };
    schietSlot(true);
    zetOpdracht('');
    hud.zetNavigatie(null); navDoel = null;
  }
  function werkBouwmanAanrijBij(dt) {
    const k = invalKonvooi[0];
    if (!k || k.stil) return true;
    const rest = k.eind - k.a;
    k.v = Math.min(8, Math.sqrt(2 * 3.4 * Math.max(0, rest)));
    k.a += Math.min(rest, Math.max(k.v, 0.4) * dt);
    const p = opLijn(k.lijn, k.a);
    const car = k.auto, vorige = car.yaw;
    car.x = p.x; car.z = p.z; car.yaw = Math.atan2(-p.ux, -p.uz); car.speed = k.v;
    vehicles.zetNeer(car, dt, vorige);
    if (k.eind - k.a < 0.05) { k.stil = true; car.speed = 0; }
    return k.stil;
  }
  // ze stappen uit: Johan voor de auto, Bouwman erachter, twee man ernaast
  function uitstappenOpDeBrug() {
    const j = invalP(INVAL_S.johan, -1.6), b = invalP(INVAL_S.bouwman, -1.0);
    invalJohan.zetNeer(j.x, j.z, brug.zuid); invalJohan.groep.visible = true;
    bouwman.zetNeer(b.x, b.z, brug.zuid); bouwman.groep.visible = true;
    if (schutters) { schutters.verwijder(); schutters = null; }
    gevallen.clear();
    const kijk = invalP(INVAL_S.erik, 0);
    const posten = [-4.2, 2.4].map(u => {
      const a = invalP(INVAL_S.johan + 0.8, u), c = invalP(INVAL_S.johan + 1.2, u);
      return { a: [a.x, a.z], b: [c.x, c.z], kijk };
    });
    schutters = invalMannen = new Bewaking(scene, posten, { ...INVAL_MANNEN, rustig: true });
  }
  function eindeBrugFilm() {
    invalFilm = null;
    toonFilmbalken(0);
    schietSlot(false);
    player.yaw = brug.noord; player.pitch = 0;
    player.applyCamera();
    fase = 'ruilLopen'; zetPunt('brug');
    const r = invalP(INVAL_S.ruit, 0);
    zetInvalMerk(0, r.x, brug.hoogte + 0.14, r.z);
    invalWapenT = 0; invalWapenGezegd = false;
    zeg(INVAL_BRUG_ROEP, () => zetOpdracht('wapen weg (H), en loop naar de gele ruit in het midden'));
  }
  function heeftWapenInHand() { return !player.wapenUit && !player.inCar && (player.wapens || []).length > 0; }
  function zetTasNeer() {
    const r = invalP(INVAL_S.ruit, 0);
    invalTas.zet(r.x, brug.hoogte, r.z, brug.noord); invalTas.toon(true);
    invalMerken[0].toon(false);
    invalPraat(null);
    fase = 'achteruit'; invalT = 0;
    zetOpdracht('vijf stappen achteruit');
    zeg(INVAL_ACHTERUIT_ZEG, null, { auto: 2.2 });
  }
  // iemand loopt naar een punt (een man naar de tas, Johan naar jou, Bouwman het weiland in)
  function loopt(p, naar, v, na) { invalLoper = { p, naar, v, na }; }
  function werkLoperBij(dt) {
    const l = invalLoper;
    if (!l) return;
    const pos = l.p.groep.position;
    const dx = l.naar.x - pos.x, dz = l.naar.z - pos.z, d = Math.hypot(dx, dz);
    if (d < 0.4) { invalLoper = null; l.p.update(dt, {}); if (l.na) l.na(); return; }
    const stap = Math.min(d, l.v * dt);
    pos.x += dx / d * stap; pos.z += dz / d * stap;
    l.p.draaiNaar ? l.p.draaiNaar(Math.atan2(-dx, -dz), dt, 8) : l.p.kijkNaar(l.naar.x, l.naar.z, dt, 8);
    l.p.update(dt, { loopt: true, snelheid: l.v });
  }
  function tasOphalen() {
    fase = 'ophalen';
    const man = invalMannen && invalMannen.wachters[0];
    if (!man || man.staat === 'neer') { tasBekeken(); return; }
    const r = invalP(INVAL_S.ruit, 0.6), terug = { x: man.persoon.groep.position.x, z: man.persoon.groep.position.z };
    zetOpdracht('');
    loopt(man.persoon, r, 1.7, () => {
      invalTas.toon(false);
      loopt(man.persoon, terug, 1.7, tasBekeken);
    });
  }
  function tasBekeken() {
    fase = 'kijken';
    if (invalKeus === 1) {
      schriftKwijt = true;
      zeg(INVAL_BRAAF, johanVrij);
    } else {
      zeg(INVAL_LEEG, null, { auto: 1.4 });
      invalT = 1.4;
    }
  }
  // (1) Johan loopt naar je toe, Bouwman en de mannen stappen in en rijden weg
  function johanVrij() {
    fase = 'vrij';
    const sp = spelerPunt();
    loopt(invalJohan, { x: sp.x + 1.2, z: sp.z + 0.6 }, 1.5, () => {
      invalJohan.kijkNaar(sp.x, sp.z, 0.1, 99);
      zeg(INVAL_JOHAN_VRIJ, () => naarWiekenB());
    });
    invalT = 2.6;           // dan stappen ze in
  }
  function bouwmanRijdtWeg() {
    bouwman.groep.visible = false;
    if (invalMannen) for (const w of invalMannen.wachters) w.persoon.groep.visible = false;
    const v = vluchtLijn(KAART, brug, INVAL_S.auto);
    if (v) { invalVluchtLijn = v.lijn; invalRotonde = v.rotonde; invalVlucht = nieuweVlucht(v.lijn); }
    zeg(INVAL_GROETEN, null, { auto: 2.4 });
  }
  // (2) "Nu!": het filmbeeld vanaf het dak van Mark
  function startNu() {
    if (fase === 'nuFilm' || fase === 'achtervolging') return;
    invalLoper = null;
    fase = 'nuFilm';
    gesprek = null; sluitBalk();
    zeg(INVAL_NU, null, { auto: 1.2 });
    invalFilm = { soort: 'nu', t: 0, vast: { x: player.pos.x, z: player.pos.z }, schoten: 0 };
    schietSlot(true);
  }
  function startAchtervolging() {
    invalFilm = null;
    toonFilmbalken(0);
    schietSlot(false);
    player.applyCamera();
    fase = 'achtervolging'; zetPunt('brug');
    bouwman.groep.visible = false;
    const v = vluchtLijn(KAART, brug, INVAL_S.auto);
    if (!v) { bouwmanKwijt(); return; }
    invalVluchtLijn = v.lijn; invalRotonde = v.rotonde; invalVlucht = nieuweVlucht(v.lijn);
    invalKlappen = 0; invalKlapT = 0; invalKwijtT = 0; invalRotondeGezegd = false;
    zeg(INVAL_ERVANDOOR, null, { auto: 2.4 });
    zetOpdracht('ram de auto van Bouwman van de weg');
  }
  function crash() {
    fase = 'crashFilm';
    const car = raceBouwmanAuto;
    invalVlucht.gecrasht = true;
    const tx = -Math.sin(car.yaw), tz = -Math.cos(car.yaw);
    invalCrash = { t: 0, van: { x: car.x, z: car.z }, zij: { x: -tz, z: tx }, voor: { x: tx, z: tz }, yaw: car.yaw, gerend: false };
    invalFilm = { soort: 'crash', t: 0, vast: player.inCar ? { x: player.inCar.x, z: player.inCar.z, yaw: player.inCar.yaw, auto: player.inCar } : { x: player.pos.x, z: player.pos.z } };
    if (invalBalk) invalBalk.hidden = true;
    if (schokken) schokken(0.6);
    geluid.klap();
    zetOpdracht('');
  }
  function eindeCrashFilm() {
    invalFilm = null;
    toonFilmbalken(0);
    player.applyCamera();
    bouwman.groep.visible = false;
    invalLoper = null;
    fase = 'doorzoeken';
    const car = raceBouwmanAuto;
    zetInvalMerk(1, car.x + invalCrash.zij.x * 1.6, 0.14, car.z + invalCrash.zij.z * 1.6);
    zetOpdracht('doorzoek zijn auto');
    zetMarker(car.x, car.z, 'B');
  }
  function bouwmanKwijt() {
    fase = 'kwijtZeg';
    if (invalBalk) invalBalk.hidden = true;
    verstopAuto(raceBouwmanAuto);
    invalVlucht = null;
    zeg(INVAL_KWIJT_BOUWMAN, naarWiekenB);
  }
  function naarWiekenB() {
    fase = 'naarWiekenB'; zetPunt(fase);
    for (const m of invalMerken) m.toon(false);
    if (invalBalk) invalBalk.hidden = true;
    // Mark staat voor de deur aan de Wieken; bij de hinderlaag heeft hij Johan al opgehaald
    const d = wiekenDeur();
    const [mx, mz] = resolveCollisions(d.x, d.z, 0.4);
    mark.zetNeer(mx, mz, mark.yaw);
    markZichtbaar(true);
    if (invalKeus === 2) {
      const [jx, jz] = resolveCollisions(mx + 1.4, mz + 0.6, 0.4);
      invalJohan.zetNeer(jx, jz, invalJohan.yaw); invalJohan.groep.visible = true;
    }
    zetOpdracht(invalKeus === 1 ? 'breng Johan naar Mark, de Wieken 29' : 'naar Mark en Johan, de Wieken 29');
    zetNavDoel(d.x, d.z, 'de Wieken 29', 'M');
  }
  function invalGeslaagd() {
    const beloning = invalKeus === 1 ? INVAL_BELONING.ruil : invalTelefoon ? INVAL_BELONING.hinderlaag : INVAL_BELONING.kwijt;
    fase = 'klaar';
    missie = 'klaar';
    invalKlaar = true;
    zetOpdracht('');
    hud.zetNavigatie(null); navDoel = null;
    verdien(beloning);
    spanningUit = 6;
    hud.melding('MISSIE GESLAAGD – DE INVAL', `Beloning: + ${euro(beloning)} toegevoegd aan wallet`, 8);
    invalNaT = 5;
  }
  function invalOchtend() {
    ruimInvalOp();
    markZichtbaar(false);
    bouwman.groep.visible = false;
    verstopAuto(raceBouwmanAuto);
    if (zetUur) zetUur(INVAL_OCHTEND);
    springNaarHuis();
  }
  function invalNaloop(dt) {
    if (invalNaT > 0) {
      invalNaT -= dt;
      if (invalNaT <= 0) zwartMet('De volgende ochtend', invalOchtend);
    }
  }

  // ---- E en schoten ----
  function invalToets() {
    if (missie !== 'inval') return false;
    const sp = spelerPunt();
    const i = invalHier();
    if (i >= 0) {
      if (i === 0) { invalHeeft.schrift = true; zeg(INVAL_SCHRIFT, null, { auto: 1.4 }); }
      else { invalHeeft.fotos = true; zeg(INVAL_FOTOS, null, { auto: 1.4 }); }
      invalMerken[i].toon(false);
      invalPraat(null);
      geluid.neerzetten();
      if (invalHeeft.schrift && invalHeeft.fotos) naarBuiten();
      return true;
    }
    if (fase === 'ruilLopen' && !player.inCar) {
      const r = invalP(INVAL_S.ruit, 0);
      if (Math.hypot(sp.x - r.x, sp.z - r.z) < INVAL_RUIT + 0.4) { zetTasNeer(); return true; }
    }
    if (fase === 'doorzoeken' && !player.inCar && raceBouwmanAuto && afst(sp, raceBouwmanAuto) < 3.6) {
      invalTelefoon = true;
      invalMerken[1].toon(false);
      invalPraat(null);
      zeg(INVAL_TELEFOON_BOUWMAN, naarWiekenB);
      return true;
    }
    return false;
  }
  function invalSchot() {
    if (missie !== 'inval') return;
    if (!['ruilLopen', 'achteruit', 'ophalen', 'kijken'].includes(fase)) return;
    if (invalKeus === 1) mislukt('Johan is geraakt.');
    else startNu();
  }

  // ---- het filmbeeld, elk beeld (ook als het spel verder stilstaat) ----
  function werkInvalFilmBij(dt) {
    const f = invalFilm;
    if (!f) return;
    f.t += dt;
    const t = f.t;
    toonFilmbalken(Math.min(1, t / 0.6));
    // jij staat (of rijdt) niet door zolang het filmbeeld loopt
    if (f.vast.auto) { const a = f.vast.auto; a.speed = 0; a.x = f.vast.x; a.z = f.vast.z; a.yaw = f.vast.yaw; }
    else { player.pos.x = f.vast.x; player.pos.z = f.vast.z; }
    if (player.gun) player.gun.visible = false;
    let pos = null, kijk = null;
    if (f.soort === 'inval') {
      const stil = werkInvalKonvooiBij(dt);
      const leider = invalKonvooi[0] ? invalKonvooi[0].auto : null;       // de voorste
      const r = invalRoute;
      if (r && leider) {
        if (t < 3.4) {
          const q = opLijn(r.pts, Math.max(0, r.lengte - 42));
          pos = [q.x - q.uz * 3.2, 2.1, q.z + q.ux * 3.2]; kijk = [leider.x, 1.0, leider.z];
        } else {
          const a = f.vast.auto || { x: f.vast.x, z: f.vast.z, yaw: player.yaw };
          const vx = -Math.sin(a.yaw), vz = -Math.cos(a.yaw);
          pos = [a.x - vx * 6.5 + vz * 1.5, 3.3, a.z - vz * 6.5 - vx * 1.5]; kijk = [leider.x, 1.0, leider.z];
        }
      }
      if ((stil && t > 5.2) || t > 8) eindeInvalFilm();
    } else if (f.soort === 'brug') {
      const stil = werkBouwmanAanrijBij(dt);
      const car = raceBouwmanAuto;
      const cy = (car.mesh ? car.mesh.position.y : brug.hoogte) + 0.9;
      if (t < 4.5) {
        const q = invalP(-2.5, 3.8);
        pos = [q.x, brug.hoogte + 1.6, q.z]; kijk = [car.x, cy, car.z];
      } else if (t < 8.5) {
        const q = invalP(24, 4.2);
        pos = [q.x, brug.hoogte + 1.5, q.z]; kijk = [car.x, cy, car.z];
      } else {
        const q = invalP(INVAL_S.johan - 6, 2.2), k = invalP(INVAL_S.johan, -1.4);
        pos = [q.x, brug.hoogte + 1.7, q.z]; kijk = [k.x, brug.hoogte + 1.2, k.z];
      }
      if (stil && !f.uit) { f.uit = true; f.uitT = t; uitstappenOpDeBrug(); }
      if (f.uit) { bouwman.update(dt, {}); invalJohan.update(dt, {}); }
      if ((f.uit && t - f.uitT > 3.2) || t > 16) eindeBrugFilm();
    } else if (f.soort === 'nu') {
      // vanaf het dak van Mark, aan de Tinga-kant: over het dek naar de twee mannen
      const q = brug.langsAs(-16, 10);
      const m = invalMannen && invalMannen.wachters[0] ? invalMannen.wachters[0].persoon.groep.position : invalP(INVAL_S.johan, 0);
      pos = [q.x, brug.hoogte + 5.5, q.z]; kijk = [m.x, brug.hoogte + 1.0, m.z];
      const raakMan = (i) => {
        const w = invalMannen && invalMannen.wachters[i];
        if (w && w.staat !== 'neer') { invalMannen.raak(w.persoon.groep); geluid.schot(60); }
      };
      if (t > 0.7 && f.schoten < 1) { f.schoten = 1; raakMan(0); }
      if (t > 1.5 && f.schoten < 2) { f.schoten = 2; raakMan(1); }
      if (t > 2.0 && bouwman.groep.visible) bouwman.groep.visible = false;
      invalJohan.update(dt, { hurkt: 1 });
      if (t > 3.0) startAchtervolging();
    } else if (f.soort === 'crash') {
      const c = invalCrash, car = raceBouwmanAuto;
      const g = Math.min(1, t / 1.3), e = 1 - (1 - g) * (1 - g);
      car.x = c.van.x + c.zij.x * 7 * e + c.voor.x * 5 * e;
      car.z = c.van.z + c.zij.z * 7 * e + c.voor.z * 5 * e;
      car.yaw = c.yaw - 1.1 * e; car.speed = 0;
      vehicles.zetNeer(car, dt, car.yaw);
      if (t > 1.4 && !c.gerend) {
        c.gerend = true;
        const [bx, bz] = resolveCollisions(car.x + c.zij.x * 1.6, car.z + c.zij.z * 1.6, 0.4);
        bouwman.zetNeer(bx, bz, Math.atan2(-c.zij.x, -c.zij.z));
        bouwman.groep.visible = true;
        loopt(bouwman, { x: bx + c.zij.x * 60, z: bz + c.zij.z * 60 }, 5.2, null);
        zeg(INVAL_CRASH, null, { auto: 2.0 });
      }
      werkLoperBij(dt);
      pos = [c.van.x - c.voor.x * 9 - c.zij.x * 7, 2.6, c.van.z - c.voor.z * 9 - c.zij.z * 7];
      kijk = [car.x + c.zij.x * 6, 1.0, car.z + c.zij.z * 6];
      if (t > 4.2) eindeCrashFilm();
    }
    if (pos && kijk) f.cam = { pos, kijk };        // (voor tools/invalshots.mjs)
    if (camera && pos && kijk && invalFilm) {
      camera.position.set(pos[0], pos[1], pos[2]);
      camera.lookAt(kijk[0], kijk[1], kijk[2]);
    }
  }

  // ---- elk beeld, tijdens de missie ----
  function werkInvalBij(dt, sp) {
    if (fase === 'klaar' || invalFilm) return;
    if (fase === 'telefoon') {
      if (invalT > 0) {
        invalT -= dt;
        if (invalT <= 0) {
          geluid.telefoon();
          zeg(INVAL_TELEFOON, startLeeghalen, { wie: 'Johan', telefoon: true, kop: KOPPEN.johan });
        }
      }
      return;
    }
    // de drie minuten lopen tot Mark naast je in de auto zit
    if (fase === 'leeghalen' || fase === 'naarBuiten' || fase === 'instappen') {
      invalKlok -= dt;
      const m = Math.max(0, Math.ceil(invalKlok));
      zetInvalBalk(`Inval over ${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`, invalKlok / INVAL_TIJD, invalKlok < 30);
      if (invalKlok <= 0) { if (invalBalk) invalBalk.hidden = true; mislukt('Te laat: Mark is opgepakt. "Ze hebben me, Erik."'); return; }
      navKlok += dt;
      if (navKlok > 2) { navKlok = 0; werkNavBij(); }
    }
    const woning = molenkrite && molenkrite();
    const binnen = !!(woning && woning.binnen && woning.binnen(sp.x, sp.z));
    if (fase === 'leeghalen') {
      if (mark.groep.visible) mark.update(dt, { zit: BANK_ZITTING });
      for (const mm of invalMerken) if (mm.zichtbaar) mm.update(dt);
      if (binnen && !invalBinnenGezegd && balk.hidden) { invalBinnenGezegd = true; zeg(INVAL_BINNEN, null, { auto: 2.4 }); }
      const i = invalHier();
      invalPraat(i >= 0 && balk.hidden ? (i === 0 ? 'E — het schrift pakken' : 'E — de foto\'s pakken') : null);
      return;
    }
    if (fase === 'naarBuiten') { if (!binnen) buitenMetMark(); return; }
    if (fase === 'instappen') {
      if (mark.groep.visible) { mark.kijkNaar(sp.x, sp.z, dt, 2); mark.update(dt, {}); }
      if (player.inCar && afst(player.inCar, mark.groep.position) < 14) { markZichtbaar(false); startInvalFilm(); }
      return;
    }
    if (fase === 'afschudden' || fase === 'naarWieken') {
      if (player.inCar && player.inCar.wrak) { mislukt('Mark is geraakt.'); return; }
      if (fase === 'afschudden') {
        werkInvalKonvooiBij(0);
        invalT += dt;
        invalMeldT -= dt;
        if (invalMeldT <= 0 && invalMeldI < INVAL_ONDERWEG.length && balk.hidden) { zeg([INVAL_ONDERWEG[invalMeldI++]], null, { auto: 3.2 }); invalMeldT = 9; }
        if (invalT > 4 && sterren() === 0 && balk.hidden) { zeg(INVAL_KWIJTGERAAKT, null, { auto: 3 }); naarDeWiekenMetMark(); }
        return;
      }
      navKlok += dt;
      if (navKlok > 2) { navKlok = 0; werkNavBij(); }
      const d = wiekenDeur();
      const stil = !player.inCar || Math.abs(player.inCar.speed || 0) < 1.2;
      if (afst(sp, d) < 14 && stil && balk.hidden) bouwmanBelt();
      return;
    }
    if (fase === 'bouwmanBelt' || fase === 'keuze') {
      if (mark.groep.visible) { mark.kijkNaar(sp.x, sp.z, dt, 2); mark.update(dt, {}); }
      return;
    }
    // ---- op de brug ----
    if (fase === 'ruilLopen' || fase === 'achteruit' || fase === 'ophalen' || fase === 'kijken' || fase === 'vrij') {
      if (bouwman.groep.visible) { bouwman.kijkNaar(sp.x, sp.z, dt, 2); bouwman.update(dt, {}); }
      if (invalJohan.groep.visible && (!invalLoper || invalLoper.p !== invalJohan)) invalJohan.update(dt, {});
      werkLoperBij(dt);
      if (invalMerken[0].zichtbaar) invalMerken[0].update(dt);
      const r = invalP(INVAL_S.ruit, 0);
      const dR = Math.hypot(sp.x - r.x, sp.z - r.z);
      // wapen weg, zolang Bouwman nog kijkt
      if (fase !== 'vrij' && heeftWapenInHand() && dR < INVAL_WAPEN) {
        invalWapenT += dt;
        if (!invalWapenGezegd && invalWapenT > 0.6 && balk.hidden) { invalWapenGezegd = true; zeg(INVAL_WAPEN_WEG, null, { auto: 1.8 }); }
        if (invalWapenT > INVAL_WAPEN_T + 0.6) { mislukt('Bouwman vertrouwt het niet. Hij rijdt weg, met Johan.'); return; }
      } else invalWapenT = Math.max(0, invalWapenT - dt);
      if (fase === 'ruilLopen') {
        const bij = dR < INVAL_RUIT + 0.4 && !player.inCar && balk.hidden;
        invalPraat(bij ? 'E — tas neerzetten' : null);
        return;
      }
      if (fase === 'achteruit') {
        invalT += dt;
        if (dR >= INVAL_ACHTERUIT || invalT > 6) tasOphalen();
        return;
      }
      if (fase === 'kijken' && invalKeus === 2 && invalT > 0) { invalT -= dt; if (invalT <= 0) startNu(); return; }
      if (fase === 'vrij') {
        if (invalT > 0) { invalT -= dt; if (invalT <= 0) bouwmanRijdtWeg(); }
        if (invalVlucht && raceBouwmanAuto) {
          rijdVlucht(invalVlucht, invalVluchtLijn, raceBouwmanAuto, vehicles, dt);
          if (invalVlucht.s > 120) { verstopAuto(raceBouwmanAuto); invalVlucht = null; }
        }
      }
      return;
    }
    if (fase === 'achtervolging') {
      const car = raceBouwmanAuto;
      rijdVlucht(invalVlucht, invalVluchtLijn, car, vehicles, dt);
      const d = afst(sp, car);
      zetMarker(car.x, car.z, 'B');
      zetInvalBalk(`Bouwman · ${invalKlappen} van ${INVAL_KLAPPEN} klappen · ${Math.round(d)} m`, invalKlappen / INVAL_KLAPPEN, d > INVAL_KWIJT * 0.7);
      invalKlapT -= dt;
      if (player.inCar && d < 3.6 && invalKlapT <= 0) {
        const v = Math.abs(player.inCar.speed || 0);
        if (v > 4) {
          invalKlapT = 0.9;
          invalKlappen += v > INVAL_HARD ? INVAL_KLAPPEN : 1;
          geluid.klap();
          if (schokken) schokken(0.25);
          if (invalKlappen < INVAL_KLAPPEN && balk.hidden) zeg([INVAL_KLAP[invalKlappen % INVAL_KLAP.length]].map(telLijn), null, { auto: 1.6 });
        }
      }
      if (invalKlappen >= INVAL_KLAPPEN) { crash(); return; }
      if (!invalRotondeGezegd && invalRotonde && Math.hypot(car.x - invalRotonde.x, car.z - invalRotonde.z) < 140 && balk.hidden) {
        invalRotondeGezegd = true; zeg(INVAL_ROTONDE, null, { auto: 2.2 });
      }
      if (d > INVAL_KWIJT) invalKwijtT += dt; else invalKwijtT = 0;
      if (invalKwijtT > INVAL_KWIJT_T || invalVlucht.klaar) bouwmanKwijt();
      return;
    }
    if (fase === 'doorzoeken') {
      if (invalMerken[1].zichtbaar) invalMerken[1].update(dt);
      const bij = raceBouwmanAuto && !player.inCar && afst(sp, raceBouwmanAuto) < 3.6 && balk.hidden;
      invalPraat(bij ? 'E — zijn auto doorzoeken' : null);
      return;
    }
    if (fase === 'naarWiekenB') {
      navKlok += dt;
      if (navKlok > 2) { navKlok = 0; werkNavBij(); }
      if (invalKeus === 1) {
        // Johan loopt mee, of zit naast je in de auto
        if (player.inCar) invalJohan.groep.visible = false;
        else if (!invalJohan.groep.visible) { const [jx, jz] = resolveCollisions(sp.x + 1.2, sp.z + 1.0, 0.4); invalJohan.zetNeer(jx, jz, player.yaw); invalJohan.groep.visible = true; }
        else if (afst(sp, invalJohan.groep.position) > 2.4) { const p = invalJohan.groep.position; const dx = sp.x - p.x, dz = sp.z - p.z, l = Math.hypot(dx, dz); p.x += dx / l * Math.min(l - 2, 3.4 * dt); p.z += dz / l * Math.min(l - 2, 3.4 * dt); invalJohan.kijkNaar(sp.x, sp.z, dt, 6); invalJohan.update(dt, { loopt: true, snelheid: 3.4 }); }
        else invalJohan.update(dt, {});
      }
      if (mark.groep.visible) { mark.kijkNaar(sp.x, sp.z, dt, 2); mark.update(dt, {}); }
      const stil = !player.inCar || Math.abs(player.inCar.speed || 0) < 1.2;
      if (afst(sp, mark.groep.position) < 12 && stil && balk.hidden) {
        fase = 'afronding';
        hud.zetNavigatie(null); navDoel = null;
        zetOpdracht('');
        if (invalKeus === 1 && !invalJohan.groep.visible) {
          const m = mark.groep.position;
          const [jx, jz] = resolveCollisions(m.x + 1.4, m.z + 0.6, 0.4);
          invalJohan.zetNeer(jx, jz, invalJohan.yaw); invalJohan.groep.visible = true;
        }
        zeg(INVAL_AFRONDING(invalKeus, invalTelefoon), invalGeslaagd);
      }
      return;
    }
    if (fase === 'afronding') {
      if (mark.groep.visible) { mark.kijkNaar(sp.x, sp.z, dt, 2); mark.update(dt, {}); }
      if (invalJohan.groep.visible) { invalJohan.kijkNaar(sp.x, sp.z, dt, 2); invalJohan.update(dt, {}); }
    }
  }

  /*
   Opnieuw na het neergaan, een mislukking of het laden. Tot de Wieken begint het weer bij
   het telefoontje, voor de deur van Molenkrite 15; bij de Wieken staat Mark weer naast je en
   belt Bouwman opnieuw; op de brug begint "die nacht" weer, met dezelfde keuze.
  */
  function hervatInval(f) {
    const keus = invalKeus, tel = invalTelefoon, kwijt = schriftKwijt;
    beginInval();
    if (['telefoon', 'leeghalen', 'naarBuiten', 'instappen', 'invalFilm', 'afschudden'].includes(f)) { voorMolenkrite15(); return; }
    invalKeus = keus; invalTelefoon = tel; schriftKwijt = kwijt;
    if (['naarWieken', 'bouwmanBelt', 'keuze', 'nacht'].includes(f) || !invalKeus) {
      const d = wiekenDeur();
      if (player.inCar) { player.inCar.speed = 0; player.inCar = null; if (eersteP) eersteP(); }
      const [px, pz] = resolveCollisions(d.x, d.z, 0.4);
      player.pos.set(px, 0, pz); player.applyCamera();
      naarDeWiekenMetMark();
      return;
    }
    if (f === 'naarWiekenB' || f === 'afronding') { naarWiekenB(); return; }
    schriftKwijt = false;
    opDeBrugNacht();
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
    // de overgang naar de nacht in missie 10 loopt altijd door tot het beeld terug is
    werkZwartBij(dt);
    // missie 12: het filmbeeld van de auto's op de brug zet zelf de camera
    werkFilmBij(dt);
    // missie 16: de filmbeelden van de inval, de brug, het dak en de crash
    werkInvalFilmBij(dt);
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
    if (keuzeOpen) return;
    /*
     Het checkpoint: een missie die net klaar is (de missie springt op 'klaar')
     wordt een tel later bewaard in een eigen opslagplek, zodat je na het neergaan
     daar kunt beginnen. Een tel later, zodat de beloning en de volgende missie er
     al in staan.
    */
    if (missie === 'klaar' && vorigeMissie !== null && vorigeMissie !== 'klaar') checkpointT = 1.0;
    vorigeMissie = missie;
    if (checkpointT > 0) {
      checkpointT -= dt;
      if (checkpointT <= 0 && checkpoint && player.health > 0) {
        checkpoint();
        hud.show('Checkpoint opgeslagen', 2);
      }
    }
    if (misluktT > 0) {
      misluktT -= dt;
      if (misluktT <= 0) naDeMislukking();
      return;
    }
    // pauze tussen twee missies: na de boerderij belt Johan (niet tijdens een klus)
    if (naMissieT > 0 && !klusjes.bezig) {
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
      // in de latere missies staat hij te wachten en kijkt hij naar je — behalve
      // als hij op de bank zit (missie 7 en 11): dan houdt hij zijn houding
      // en kijkt hij naar de tv
      const opBank = ((missie === 'bom' || missie === 'politieauto') && fase === 'gesprek') || (missie === 'brug' && fase === 'plan')
        || missie === 'schrift' || missie === 'inval';   // (missie 13 en 16 werken Mark zelf bij)
      if (mark.groep.visible && !opBank) { mark.kijkNaar(sp.x, sp.z, dt, 2); mark.update(dt, {}); }
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

    // een missie die onder zijn M op je wacht, wacht ook tijdens een klus (js/klusjes.js)
    const wachtOpKlus = klusjes.bezig && missie !== 'klaar';

    // ---- missie 5: Johan en de dief ----
    if (missie === 'johan' && !wachtOpKlus) werkJohanBij(dt, sp);

    // ---- missie 6: de groene BX ----
    if (missie === 'bx' && !wachtOpKlus) werkBXBij(dt, sp);

    // ---- missie 8: de deal bij de molen ----
    if (missie === 'sniper') werkSniperBij(dt, sp);
    if (missie === 'veteraan' && !wachtOpKlus) werkVeteraanBij(dt, sp);
    if (missie === 'huis') { if (!wachtOpKlus) werkHuisBij(dt, sp); }
    // de koopregel blijft ook staan als de missie al voorbij is en het aanbod nog loopt
    else koopHint(sp);
    werkStallingBij();
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
    if (!wachtOpKlus) {
      if (missie === 'bom') werkBomBij(dt, sp);
      if (missie === 'politieauto') werkPolitieautoBij(dt, sp);
      if (missie === 'brug') werkBrugBij(dt, sp);
      if (missie === 'schrift') werkSchriftBij(dt, sp);
      if (missie === 'race') werkRaceBij(dt, sp);
      if (missie === 'schaduw') werkSchaduwBij(dt, sp);
      if (missie === 'inval') werkInvalBij(dt, sp);
    }
    brugNaloop(sp, dt);
    raceNaloop(sp, dt);
    invalNaloop(dt);
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
    if (tasMerk) tasMerk.update(dt);

    // ---- na missie 10: de bende op straat ----
    {
      // van missie 10 tot De Veteraan dood is (missie 12): daarna valt zijn bende
      // uit elkaar (verzoek 27 sep 2026)
      // en een groepje dat bij een klus op je wacht (js/klusjes.js): dan geen nieuwe erbij
      const verhaalBende = vetKlaar && !brugKlaar && missie === 'klaar';
      const schade = bendes.update(dt, verhaalBende || klusjes.bende, verhaalBende);
      if (schade > 0 && player.active) {
        player.health = Math.max(0, player.health - schade);
        hud.zetLeven(player.health);
        hud.flits();
        if (player.health <= 0) dood();
      }
    }
    // ---- een klus ----
    {
      const schade = klusjes.update(dt);
      if (schade > 0 && player.active) {
        player.health = Math.max(0, player.health - schade);
        hud.zetLeven(player.health);
        hud.flits();
        if (player.health <= 0) dood();
      }
    }
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
      // missie 9: het huis dat je gekocht hebt blijft van jou, en een aanbod dat
      // nog openstaat ook
      huis: huisGekozen, aanbod: huisAanbod, gezien: [...huisGezien], gestald,
      // missie 10, en welke missie er nog moest beginnen: na het laden gaat de
      // telefoon dan alsnog
      veteraanKlaar: vetKlaar,
      politieautoKlaar: polKlaar,
      brugKlaar, schriftKlaar, raceKlaar, schaduwKlaar,
      // missie 15: welke foto's je al hebt, en of de mannen je zagen
      schaduwFotos: schaduwFotos.slice(), schaduwGezien,
      // missie 16: afgerond, welke keuze, de telefoon van Bouwman, en of hij het schrift heeft
      invalKlaar, invalKeus, invalTelefoon, schriftKwijt,
      // missie 14: wat Ronald Bouwman nog schuldig is, en hoe vaak je verloor
      raceSchuld, raceRondes,
      volgende: naMissieT > 0 ? naMissieNaam : null,
    };
  }

  function herstel(s) {
    // een opgeslagen spel begint zonder klus
    klusjes.reset(); klusPauze = null;
    if (!s) return;
    gesprek = null; sluitBalk(); praatEl.hidden = true;
    doodT = 0;
    missie = s.missie || 'molenkrite';
    // een geladen spel is geen net afgeronde missie: daar komt geen checkpoint bij
    // (het volgende beeld neemt de missie over zoals herstel hem achterlaat)
    vorigeMissie = null; checkpointT = 0;
    fase = s.fase || 'wacht';
    huisGekozen = s.huis || null;
    huisAanbod = !!s.aanbod;
    /*
     De auto op de oprit. Stond hij er bij het opslaan, dan staat hij er bij het
     laden weer — tenzij er al een auto staat, want dan zou je er twee in elkaar
     zetten (verzoek 23 sep 2026).
    */
    gestald = s.gestald || null;
    if (gestald) {
      const bij = vehicles.nearestDriveable(gestald.x, gestald.z);
      if (!bij || Math.hypot(bij.x - gestald.x, bij.z - gestald.z) > 4) {
        vehicles.voegToe({ x: gestald.x, z: gestald.z, yaw: gestald.yaw || 0,
          soort: gestald.soort || 'hatch', kleur: gestald.kleur ?? 0xd8d9dc });
      }
    }
    huisGezien.clear();
    for (const n of s.gezien || []) huisGezien.add(n);
    vetKlaar = !!s.veteraanKlaar;
    polKlaar = !!s.politieautoKlaar;
    brugKlaar = !!s.brugKlaar;
    schriftKlaar = !!s.schriftKlaar;
    raceKlaar = !!s.raceKlaar;
    schaduwKlaar = !!s.schaduwKlaar;
    schaduwFotos = Array.isArray(s.schaduwFotos) ? s.schaduwFotos.slice(0, 3).map(Boolean) : [false, false, false];
    schaduwGezien = !!s.schaduwGezien;
    invalKlaar = !!s.invalKlaar;
    invalKeus = s.invalKeus === 1 || s.invalKeus === 2 ? s.invalKeus : 0;
    invalTelefoon = !!s.invalTelefoon;
    schriftKwijt = !!s.schriftKwijt;
    raceSchuld = typeof s.raceSchuld === 'number' ? s.raceSchuld : RACE_SCHULD;
    raceRondes = s.raceRondes || 0;
    // na missie 12 heeft de Dúvelsrak een gat
    if (brugSchade) {
      if (brugKlaar) { const g = brugP(BRUG_GAT, 0); brugSchade.zet(g.x, brug.hoogte, g.z, brug.noord); brugSchade.toon(true); }
      else brugSchade.toon(false);
    }
    if ((fase === 'gesprek' || fase === 'briefing') && missie !== 'veteraan') { fase = 'wacht'; missie = 'molenkrite'; }
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
    } else if (missie === 'veteraan' && fase !== 'klaar') {
      hervatVeteraan(fase);
    } else if (missie === 'politieauto' && fase !== 'klaar') {
      hervatPolitieauto(fase);
    } else if (missie === 'brug' && fase !== 'klaar') {
      hervatBrug(fase);
    } else if (missie === 'schrift' && fase !== 'klaar') {
      hervatSchrift(fase);
    } else if (missie === 'race' && fase !== 'klaar') {
      hervatRace(fase);
    } else if (missie === 'schaduw' && fase !== 'klaar') {
      hervatSchaduw(fase);
    } else if (missie === 'inval' && fase !== 'klaar') {
      hervatInval(fase);
    } else {
      zetOpdracht(''); hud.zetNavigatie(null); navDoel = null;
    }
    /*
     Tussen twee missies opgeslagen: dan belt de volgende alsnog, een paar tellen
     na het laden. En een opslag van vóór missie 10 met een gekocht huis erin
     krijgt De Veteraan ook nog aan de lijn.
    */
    if (missie === 'klaar' && s.volgende) { naMissieNaam = s.volgende; naMissieT = 6; }
    else if (missie === 'klaar' && huisGekozen && !vetKlaar) { naMissieNaam = 'veteraan'; naMissieT = VET_WACHT; }
    // een opslag na missie 10 van vóór missie 11: de M komt alsnog
    else if (missie === 'klaar' && vetKlaar && !polKlaar) { naMissieNaam = 'politieauto'; naMissieT = 6; }
    // en na missie 11 van vóór missie 12: Mark wacht binnen met zijn plan
    else if (missie === 'klaar' && polKlaar && !brugKlaar) { naMissieNaam = 'brug'; naMissieT = 6; }
    // en na missie 12: Mark zit in Duinterpen
    else if (missie === 'klaar' && brugKlaar && !schriftKlaar) { naMissieNaam = 'schrift'; naMissieT = 6; }
    // en na het schrift: Ronald belt
    else if (missie === 'klaar' && schriftKlaar && !raceKlaar) { naMissieNaam = 'race'; naMissieT = 6; }
    // en na de race: Mark belt over Bouwman
    else if (missie === 'klaar' && raceKlaar && !schaduwKlaar) { naMissieNaam = 'schaduw'; naMissieT = 6; }
    // en na het schaduwen: Johan belt over de inval
    else if (missie === 'klaar' && schaduwKlaar && !invalKlaar) { naMissieNaam = 'inval'; naMissieT = 6; }
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
    spuitPrijs: (auto) => (missie === 'bx' && auto && auto === bxAuto ? BX_SPUIT : klusjes.spuitPrijs(auto)),
    // de klusjes (js/klusjes.js): X breekt er een af
    klusAfbreken: () => klusjes.afbreken(),
    get klusjes() { return klusjes; },
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
    // missie 13, voor tools/schrifttest.mjs
    get schrift() {
      return { klaar: schriftKlaar, heeft: schriftHeeft, alarm: schriftAlarm, deur: schriftDeur(), kade: schriftKade(),
        boek: schriftBoek, lint: schriftLint, merk: schriftMerk, sloep: schriftSloep(), wachtT: brugNaT, pand: !!schriftPand };
    },
    // missie 14, voor tools/racetest.mjs
    get race() {
      return { klaar: raceKlaar, race, ronald, bouwman, auto: raceAuto, leen: raceLeen, bouwmanAuto: raceBouwmanAuto,
        plek: racePlek, huis: ronaldPlek(), pand: !!racePandAanwezig(), uitslag: raceUitslag, overT: raceOverT,
        verplaatst: raceVerplaatst, bijgelegd: raceBijgelegd, wachtT: naMissieNaam === 'race' ? naMissieT : 0,
        schuld: raceSchuld, rondes: raceRondes, verloor: raceVerloor, uitT: raceUitT };
    },
    // missie 16, voor tools/invaltest.mjs
    get inval() {
      return { klaar: invalKlaar, keus: invalKeus, telefoon: invalTelefoon, schriftKwijt, heeft: { ...invalHeeft },
        klok: invalKlok, film: invalFilm ? invalFilm.soort : null, filmT: invalFilm ? invalFilm.t : 0,
        filmCam: invalFilm && invalFilm.cam ? { pos: invalFilm.cam.pos.slice(), kijk: invalFilm.cam.kijk.slice() } : null,
        konvooi: invalKonvooi.map(k => k.auto), mannen: invalMannen, johan: invalJohan, tas: invalTas,
        vlucht: invalVlucht, lijn: invalVluchtLijn, rotonde: invalRotonde, klappen: invalKlappen, kwijtT: invalKwijtT,
        auto: raceBouwmanAuto, bouwman, golf: invalGolf, route: invalRoute, merkPlek: invalMerkPlek.map(p => p && { ...p }),
        merkZichtbaar: invalMerken.map(m => m.zichtbaar), wiekenDeur: wiekenDeur(), brugPunt: (s2, u) => invalP(s2, u),
        S: INVAL_S, tijd: INVAL_TIJD, beloning: INVAL_BELONING, wachtT: naMissieNaam === 'inval' ? naMissieT : 0,
        wapenT: invalWapenT };
    },
    // missie 15, voor tools/schaduwtest.mjs
    get schaduw() {
      return { klaar: schaduwKlaar, gezien: schaduwGezien, fotos: schaduwFotos.slice(), rit: schaduwRit, wereld: schaduw,
        golf: schaduwGolf, bus: schaduwBus, mannen: schaduwMannen, auto: raceBouwmanAuto, bouwman,
        afstand: schaduwAfstand, dichtT: schaduwDichtT, verT: schaduwVerT, merken: schaduwMerk,
        wachtT: naMissieNaam === 'schaduw' ? naMissieT : 0,
        grenzen: { dicht: SCHADUW_DICHT, ferrari: SCHADUW_DICHT_FERRARI, stil: SCHADUW_DICHT_STIL, dichtT: SCHADUW_DICHT_T, ver: SCHADUW_VER, verT: SCHADUW_VER_T } };
    },
    get schutterAutos() { return schutterAutos; },
    get zwart() { return zwart; },
    get keuzeOpen() { return keuzeOpen; },
    // missie 11
    get politieauto() { return polAuto; },
    get politieautoPlek() { return politieautoPlek(); },
    get politieautoKlaar() { return polKlaar; },
    // missie 12, voor tools/brugtest.mjs
    get brug() {
      return brug && {
        assen: brug, klaar: brugKlaar, ontploft: brugOntploft, film: !!brugFilm, filmT: brugFilm ? brugFilm.t : 0,
        hekken: brugHekGezet.slice(), c4: brugC4Gezet.slice(),
        hekStukken: brugHekken, blokken: brugBlokken, merken: brugMerken, schade: brugSchade, autoMerk: brugAutoMerk,
        konvooi: brugKonvooi.map(k => k.auto), mark: brugMark, johan: brugJohan, veteraan: brugVet,
        knallen: brugKnallen.length, politieRoute: politieVanMolenkrite(),
        punt: (s, u) => brugP(s, u), autoPlek: brugP(BRUG_AUTO[0], BRUG_AUTO[1]),
        hekPlekken: BRUG_HEKKEN.map(([s, u]) => brugP(s, u)), c4Plekken: BRUG_C4.map(([s, u]) => brugP(s, u)),
      };
    },
    kies,
    get ingang() { return ingang(); },
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
      // en binnen aan de tafel van een van de drie woningen uit missie 9
      const bijTafel = huisAanbod && !huisGekozen && !player.zit && (() => {
        const w = huisOnder(spelerPunt());
        return !!(w && w.bijTafel(player.pos.x, player.pos.z));
      })();
      return !balk.hidden
        || bijBom
        || bijTafel
        || bijDeTas()
        || (missie === 'molenkrite' && fase === 'wacht' && bijMark)
        || (missie === 'bx' && fase === 'wacht' && bijMark);
    },
    // missie 9: de vlaggen op de kaart en het huis dat van jou is
    huisMarkeringen, kiesHuis,
    get gestaldeAuto() { return gestald; },
    get stek() { return huisGekozen; },
    get stekAanbod() { return huisAanbod; },
    get stekKeus() { return huisKeus; },
    get stekGezien() { return [...huisGezien]; },
    get stekHuis() { return huisGekozen ? stekMet(huisGekozen) : null; },
    // missie 10: De Veteraan, de tas en waar je naartoe moet
    get veteraan() { return vet; },
    get veteraanPlek() { return veteraanPlek(); },
    get tribune() { return tribune(); },
    get tas() { return tas; },
    get tasBij() { return tasBij; },
    get thuisDoel() { return thuisDoel(); },
    get veteraanKlaar() { return vetKlaar; },
    get bendes() { return bendes; },
    get aanrijders() { return aanrijders; },
    get volgendeMissie() { return naMissieT > 0 ? { naam: naMissieNaam, over: naMissieT } : null; },
    // testhaak (tools/bendetest.mjs): de volgende missie niet vanzelf laten beginnen
    __geenVolgende() { naMissieT = 0; },
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
