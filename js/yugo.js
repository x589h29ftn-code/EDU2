/*
 Yugo: sushi eten met Johan (stap 204).

 Gevraagd op 16 okt 2026, met vier foto's (de tablet met het menu, een plank sushi, een gedekte tafel en de zaal met het
 verlichte logo): "Tussen missies of na alle missies kan je Johan opzoeken zoals nu al kan. Hij praat random met je was het
 idee maar de eerste keer stelt hij voor om bij Yugo te eten in Sneek. Dit is een Japans sushirestaurant. Als je ja kiest ga je
 daarheen (zwart beeld, en dan ben je in het restaurant aan tafel met Johan). Je bestelt sushi via een tablet die op tafel
 staat: laat 4 soorten sushi qua keuze zien. En laat als drinken de Pornstar Martini zien. De ober brengt de sushi en drankjes
 en jullie kunnen dit eten. Met stokjes. Johan bestelt wat te veel zoals altijd. In totaal 5 rondes, duurt ca 15 minuten. Je
 kan altijd weggaan met X, dan zegt Erik: Johan sorry maar ik moet morgen vroeg op. Ik ga die kant op. Japans muziekje."

 Hier staat de zaal en het etentje zelf; het voorstel van Johan, de keuze, het zwart en de weg terug staan in js/verhaal.js
 (het blok `yugo`). Het is dezelfde truc als de studio en de Poiesz: een losse, dichte zaal ruim buiten het kaartgebied. Er
 is geen deur: het zwart zet je aan tafel en haalt je er weer weg.

 De zaal naar de foto van de zaal: een lange ruimte met een donker systeemplafond met spotjes, een lichte houten vloer, achterin
 een wand van houten steenstrips met het logo "yugo" in zwarte penseelletters, van achteren verlicht, met een rode stip in de o
 en een grijze streep eronder; daarvoor een lange blauwe bank met tafeltjes voor twee, links een stalen rek met flessen en
 aloë's, emmerlampen boven de tafels (blauw, groen, donkerblauw met rood van binnen), een zwart stalen hek met een houten
 leuning, en voorin ronde tafels met grijze en zwarte kuipstoelen. Op elke tafel een sojaflesje met een rode dop, een geel
 glaasje, zwarte bordjes en papieren onderleggers met "yugo". Links achterin de sushibar met de keukendeur: daar komt de ober
 vandaan.

 Jij zit op een stoel aan het tafeltje voor het logo, Johan op de bank tegenover je. De tablet staat op een standaard aan de
 kant van de muur; bij het bestellen gaat hij open op het scherm (`#yugoTablet`, naar de foto van de tablet: een donkere rand,
 het zwarte vierkant met "yūgō SUSHI", tegels met het gerecht op een zwarte achtergrond en de naam eronder).

 Een ronde:
   bestellen   de tablet: 1–4 een plankje sushi (hoogstens YUGO.maxSushi per ronde), 5 een Pornstar Martini, 0 wissen,
               6 bestellen. Na YUGO.tabletDuw tellen jaagt Johan je op, na YUGO.tabletMax bestelt hij voor je.
   besteld     Johan bestelt te veel (altijd meer plankjes dan jij, en een Pornstar Martini), daarna wachten op de ober
   ober        de ober loopt van de keukendeur naar de tafel met een dienblad, zet alles neer, ruimt de lege plankjes op
   eten        E pakt met de stokjes een stuk van jouw plankjes en eet het op (YUGO.leven erbij), Q een slok van je cocktail;
               Johan eet in zijn eigen tempo. Klaar als alles op is, of na YUGO.eetMax: dan eet Johan de rest op.
   pauze       even napraten, dan de volgende ronde
 Na vijf rondes geeft `klaar()` het terug aan het verhaal. Hoe lang het duurt hangt van jou af; met de standaardwaarden
 ongeveer drie minuten per ronde.

 Het licht zit in de hoekpunten (zoals overal): de vlakken krijgen een tint naar hun richting, de lampen zelf zijn wit of geel.
 Alles wordt bij het opstarten gebouwd, ook de stokjes, de sushi en het glas, zodat er tijdens het spelen geen nieuw
 shaderprogramma bij komt (`soortenVoorbereid` in js/world.js ziet ze in de scène staan).
*/
import * as THREE from 'three';
import { KAART } from './kaartwereld.js';
import { addCollider } from './world.js';

// ---------- maten (m) en tijden (s) ----------
export const YUGO = {
  breed: 14, diep: 9.5, plafond: 2.85, muur: 0.25,
  // ons tafeltje voor het logo: jij op de stoel (z groter), Johan op de bank (z kleiner)
  tafel: { x: 9.6, z: 1.30, breed: 1.30, diep: 0.80, hoog: 0.75 },
  bankDiep: 0.62, zitting: 0.46,
  oog: 1.16,                    // ooghoogte als je zit
  rondes: 5,
  maxSushi: 4,                  // plankjes per persoon per ronde (zoals bij all you can eat)
  tabletDuw: 40, tabletMax: 70, // Johan jaagt je op, en bestelt daarna zelf voor je
  oberNa: [16, 24],             // na het bestellen komt de ober
  oberLoop: 1.25,               // m/s
  eetMax: 150,                  // daarna eet Johan de rest op
  pauze: [24, 32],              // napraten tussen twee rondes
  johanHap: [2.8, 4.4],         // Johan pakt elke zoveel tellen een stuk
  praat: [7, 14],               // zoveel tellen stilte tussen twee gesprekken
  regelTijd: 4.6,               // zo lang staat een regel van een gesprek in beeld
  leven: 2,                     // per stuk sushi
  slok: 3,                      // per slok cocktail
  slokken: 4,                   // een glas is na zoveel slokken leeg
  stokjes: { heen: 0.32, mond: 0.38, terug: 0.28 },
};

// de vier soorten op de tablet, en het drankje
export const SUSHI = [
  { id: 'nigiri', naam: 'Sake nigiri', stuks: 2, uitleg: 'zalm op rijst' },
  { id: 'maki', naam: 'Zalm maki', stuks: 4, uitleg: 'nori, rijst, zalm' },
  { id: 'california', naam: 'California roll', stuks: 4, uitleg: 'krab, avocado, tobiko' },
  { id: 'ebi', naam: 'Crispy ebi roll', stuks: 4, uitleg: 'garnaal in tempura, spicy mayo' },
];
export const DRANK = { id: 'martini', naam: 'Pornstar Martini', uitleg: 'vanille, passievrucht, een shotje prosecco' };

// ---------- wat Johan zegt aan tafel ----------
export const YUGO_TEKST = {
  aanTafel: ['Hier zitten we goed. Pak die tablet maar, jij eerst.', 'En niet zuinig doen, Erik. Het zijn maar vijf rondes.'],
  // (stap 212) de eerste keer legt Johan uit hoe het werkt, en de uitleg staat ook op de tablet en als melding
  uitleg: ['Eerste keer hier? Op de tablet kies je met 1 tot 4 een plankje sushi, hoogstens vier per ronde. 5 is een Pornstar Martini.',
    'Met 6 bestel je. Als de ober het brengt, eet je met E, en met Q neem je een slok. Is je bord leeg, dan begin je met E de volgende ronde.'],
  uitlegKop: 'YUGO · ZO WERKT HET',
  uitlegTekst: '1–4 sushi kiezen (hoogstens 4) · 5 Pornstar Martini · 0 wissen · 6 bestellen · daarna E eten, Q een slok · bord leeg: E volgende ronde · X weg',
  leeg: 'Kies eerst iets: 1–4 een plankje sushi, 5 een Pornstar Martini. Dan 6.',
  sneller: ['Nu al? Prima, ik eet ondertussen gewoon door.', 'Jij hebt haast. Goed, tablet erbij.'],
  opjagen: ['Kom op, ik heb honger. Bestel eens wat.', 'Je hoeft niet het hele menu uit je hoofd te leren, hoor.'],
  voorJou: 'Ik bestel wel voor je. Je moet ergens beginnen.',
  johanBestelt: [
    'Vier plankjes? Watje. Doe mij twee California, twee ebi, een nigiri en een maki. En een Pornstar Martini, natuurlijk.',
    'Nog een rondje voor mij: alles een keer, en de ebi twee keer. Die zijn hier zo goed.',
    'Ik neem gewoon wat jij neemt. Maal twee. Plus een ebi, voor de zekerheid.',
    'De vierde ronde is de belangrijkste, Erik. Dan weet je pas wie er echt kan eten.',
    'Laatste ronde. Ik ga er vol in: alles wat er op dat scherm staat. Twee keer.',
  ],
  ober: ['Alsjeblieft, eet smakelijk!', 'Zo, dat is een hoop. Voor wie is dit allemaal?', 'Ronde drie al. Eet smakelijk, heren.',
    'Alsjeblieft. De martini\'s zijn vers, de passievrucht ook.', 'De laatste ronde. Eet smakelijk!'],
  oberJohan: ['', 'Voor mij.', '', '', 'Je bent een held.'],
  tafelpraat: [
    'Met stokjes gaat het je goed af. Ik prik ze gewoon, niemand die het ziet.',
    'Die Pornstar Martini, met dat halve passievruchtje erin. Daar kom ik eigenlijk voor.',
    'Wist je dat je nigiri met je vingers mag eten? Zegt de ober. Ik geloof hem niet.',
    'Mark zou hier binnen een uur onder tafel liggen. Die kan niet tegen wasabi.',
    'Niet te veel rijst eten, dan zit je te snel vol. Dat is de truc.',
    'Ze hebben hier ook ijs als toetje. Maar dat telt niet als ronde.',
    'Volgende keer nemen we Mark mee. Dan kunnen we nog meer bestellen.',
    'Hoeveel heb jij er al op? Ik ben de tel kwijt. Dat is een goed teken.',
    'Soja, gember, wasabi. In die volgorde. Dat heb ik ergens gelezen.',
    'Die muziek, hè. Je waant je in Tokio. Nou ja, in Sneek.',
    'Die crispy ebi, man. Daar zou ik een hele ronde van kunnen eten.',
    'Zie je die lampen? Gewoon emmers. Daar had ik zelf op moeten komen.',
  ],
  /*
   Gesprekken aan tafel tussen Johan (j) en Erik (e), gevraagd: "Johan en Erik praten over werk (De Veteraan, missies),
   nieuwe No Mercy film die uitkomt, het weer, over Erik Jan hoe het met hem is (dat is het broertje van Johan), over weer eens een
   stad uitje doen met Mark en Erik Jan erbij, net als de laatste keer naar Texel." `als` zegt wanneer het past (js/verhaal.js geeft
   de stand mee in `onderwerpen`): veteraanLeeft (na missie 10, vóór de Dúvelsrak), veteraanDood, nm4 en nm5 (de opnames gedaan),
   einde (na de uitzending). Zonder `als` past het altijd.
  */
  gesprekken: [
    // het werk
    { als: 'veteraanLeeft', regels: [['j', 'Die Veteraan, Erik. Ik vertrouw die vent voor geen meter. Dat hondje is het enige aan hem dat eerlijk is.'], ['e', 'Zolang hij betaalt, praten we met hem.'], ['j', 'Tot hij een keer niet betaalt. Dan sta ik achter je.']] },
    { als: 'veteraanLeeft', regels: [['e', 'Die mannen van De Veteraan hangen overal rond de Lemmerweg.'], ['j', 'Ik rij tegenwoordig om. Langs de Molenkrite, met de ramen dicht.'], ['e', 'Slim. Nog even volhouden.']] },
    { als: 'veteraanDood', regels: [['j', 'Soms denk ik nog aan die avond op de Dúvelsrak.'], ['e', 'Ik ook. Maar hij had het zelf zo gewild.'], ['j', 'Zijn hondje heeft nu een goed huis. Dat heb ik nagevraagd.']] },
    { als: 'veteraanDood', regels: [['e', 'Sinds De Veteraan weg is, is het stil op straat.'], ['j', 'Zijn mannen zijn allemaal hun eigen weg gegaan. Eentje werkt nu bij de Poiesz, achter de kassa.'], ['e', 'Dan weet ik waar ik mijn bier niet meer haal.']] },
    { regels: [['j', 'Mark belde vanochtend alweer. Of ik iets wilde ophalen.'], ['e', 'En?'], ['j', 'Ik heb gezegd dat ik vanavond sushi eet. Werk kan wachten.']] },
    { regels: [['e', 'Hoe is het met je hand? Van dat hek laatst.'], ['j', 'Prima. Een litteken maakt indruk, zegt Mark.'], ['e', 'Mark zegt veel.']] },
    { regels: [['j', 'Weet je wat ik het mooiste vind aan dit werk? Dat niemand in Tinga het doorheeft.'], ['e', 'Behalve de buurvrouw van Mark.'], ['j', 'Die denkt dat we glazenwassers zijn. Laat haar maar.']] },
    { als: 'einde', regels: [['j', 'Die uitzending op Radio Tinga. Heel Sneek heeft het gehoord.'], ['e', 'Bouwman ook.'], ['j', 'Vooral Bouwman. Proost daarop.']] },
    { als: 'einde', regels: [['e', 'Nu het allemaal voorbij is: wat ga jij doen?'], ['j', 'Eerst vijf rondes sushi. Dan zien we wel.'], ['e', 'Goed plan.']] },
    // No Mercy
    { regels: [['j', 'Er komt een nieuwe No Mercy uit, wist je dat? Erik Jan heeft me de trailer laten zien.'], ['e', 'Weer zoveel ontploffingen?'], ['j', 'Meer. Hij heeft een nieuwe rookmachine gekocht. De buren hebben al geklaagd.']] },
    { regels: [['e', 'Wanneer komt die nieuwe No Mercy eigenlijk in de bioscoop?'], ['j', 'Voor de kerst, zegt Erik Jan. In Sneek in de grote zaal.'], ['e', 'Dan reserveren we de achterste rij. Met popcorn.']] },
    { als: 'nm4', regels: [['j', 'Erik Jan zegt dat de nieuwe No Mercy bijna af is. Met jou erin, bij de Flak in het bos.'], ['e', 'Kom ik echt in de film?'], ['j', 'Drie seconden. Maar wel drie mooie seconden.']] },
    { als: 'nm5', regels: [['j', 'Die première van De Overtocht in IJlst was mooi, hè. Opgedragen aan De Veteraan.'], ['e', 'Daar had hij wel om gelachen.'], ['j', 'Erik Jan wil al aan deel zes beginnen. Hij zoekt nog een molen.']] },
    // Erik Jan
    { regels: [['e', 'Hoe is het eigenlijk met Erik Jan?'], ['j', 'Druk. Hij slaapt bijna op de set. Mijn moeder belt mij om te vragen of hij wel eet.'], ['e', 'En, eet hij?'], ['j', 'Broodjes kroket van de catering. Elke dag.']] },
    { regels: [['j', 'Mijn broertje heeft een nieuwe camera gekocht. Duurder dan mijn auto.'], ['e', 'Jouw auto is ook niet veel waard.'], ['j', 'Daarom zeg ik het ook niet hardop.']] },
    { regels: [['e', 'Is Erik Jan nou jonger dan jij?'], ['j', 'Jonger. Maar op de set doet hij alsof hij de baas is.'], ['e', 'Hij ís daar ook de baas.'], ['j', 'Zeg het hem maar niet.']] },
    { regels: [['j', 'Erik Jan vroeg nog naar je. Of je weer eens wilt figureren.'], ['e', 'Als ik dan niet weer in een feldgrauw pak moet.'], ['j', 'Hij had het over een rol als Amerikaan. Met een helm.']] },
    // een dagje weg
    { regels: [['j', 'We moeten weer eens een dagje weg. Met Mark en Erik Jan, net als vorig jaar op Texel.'], ['e', 'Met die gehuurde fietsen?'], ['j', 'Mark had na tien minuten een lekke band. Wij een uur wachten bij de vuurtoren.']] },
    { regels: [['e', 'Weet je nog die vis op Texel, bij de haven?'], ['j', 'Erik Jan at drie porties kibbeling. Daarna was hij zeeziek op de boot terug.'], ['e', 'Daar had hij een film van moeten maken.']] },
    { regels: [['j', 'Wat dacht je van Groningen, dit keer? Een stadsdag. Martinitoren op, een terrasje, en Erik Jan filmt alles.'], ['e', 'Als Mark de route maar niet plant.'], ['j', 'Mark plant niks. Mark rijdt mee en zoekt de snackbar.']] },
    { regels: [['e', 'Of Amsterdam, met z\'n vieren?'], ['j', 'Dan wil Mark weer een rondvaart. Dat noemt hij cultuur.'], ['e', 'En Erik Jan filmt de grachten voor een volgende film.']] },
    { regels: [['j', 'Zullen we in het voorjaar weer naar Texel? Zelfde huisje, zelfde vuurtoren.'], ['e', 'Alleen als Mark zijn eigen fiets meeneemt.'], ['j', 'Ik zet het in de groepsapp. Erik Jan reageert toch pas over een week.']] },
    // het weer
    { regels: [['j', 'Zag je de buienradar vandaag? Elk uur iets anders.'], ['e', 'Gewoon Friesland.'], ['j', 'Vier seizoenen op één dag, en wij zitten droog binnen met sushi.']] },
    { regels: [['e', 'Het waaide flink op de heenweg.'], ['j', 'Dan liggen de zeilboten op de Geeuw lekker scheef. Mooi om te zien vanaf de brug.'], ['e', 'Zolang ze niet omslaan.']] },
    { regels: [['j', 'Als het deze winter gaat vriezen, gaan we schaatsen. Op de Geeuw, of verder.'], ['e', 'Jij op schaatsen?'], ['j', 'Ik heb ze nog van mijn opa. Noren, met houten zolen.']] },
    { regels: [['e', 'Morgen schijnt de zon, zeggen ze.'], ['j', 'Dan gaan we vissen. Om zes uur aan de Geeuw, ik neem koffie mee.'], ['e', 'Om zes uur? Dan neem ik twee bekers.']] },
  ],
  op: ['Op? Mooi, dan kan de volgende ronde erin.', 'Schoon schip. Pak die tablet maar weer.'],
  resteOp: 'Laat maar liggen, ik eet het wel op. Zonde om weg te gooien.',
  klaar: ['Ik kan echt niet meer. Ober, de rekening!', 'Ik trakteer. Volgende keer jij, en dan nemen we Mark mee.'],
};

// ---------- canvas ----------
function doek(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function texture(c, rx = 1, ry = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function rnd(seed) {
  let s = seed >>> 0 || 7;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/*
 Het merk zoals op de tablet en de deur: een zwart vierkant met "yūgō" in dunne witte letters (de streepjes boven de u en de
 o) en daaronder SUSHI met wijde letterafstand.
*/
export function tekenLogo(g, x, y, s) {
  g.save();
  g.fillStyle = '#0b0b0c'; g.fillRect(x, y, s, s);
  g.fillStyle = '#f4f4f2'; g.strokeStyle = '#f4f4f2';
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = `200 ${Math.round(s * 0.30)}px "Helvetica Neue", Arial, sans-serif`;
  g.fillText('yugo', x + s / 2, y + s * 0.54);
  // de streepjes boven de u en de o
  g.lineWidth = Math.max(1, s * 0.018);
  const w = g.measureText('yugo').width, x0 = x + s / 2 - w / 2;
  const letter = (t) => g.measureText(t).width;
  for (const [voor, l] of [['y', 'u'], ['yug', 'o']]) {
    const a = x0 + letter(voor), b = a + letter(l);
    g.beginPath(); g.moveTo(a + (b - a) * 0.12, y + s * 0.30); g.lineTo(b - (b - a) * 0.12, y + s * 0.30); g.stroke();
  }
  g.font = `400 ${Math.round(s * 0.10)}px "Helvetica Neue", Arial, sans-serif`;
  const sushi = 'S U S H I';
  g.fillText(sushi, x + s / 2, y + s * 0.74);
  g.restore();
}
/*
 Het logo op de wand: "yugo" in dikke, schuine penseelletters met rafelige randen, een rode stip in de o en een grijsblauwe
 penseelstreep eronder. `gloed` legt er een warme lichtkrans achter (het logo is van achteren verlicht).
*/
export function tekenWandLogo(g, B, H, gloed = true) {
  const r = rnd(41);
  if (gloed) {
    const lg = g.createRadialGradient(B * 0.5, H * 0.5, H * 0.08, B * 0.5, H * 0.5, B * 0.55);
    lg.addColorStop(0, 'rgba(255,214,140,0.85)'); lg.addColorStop(0.45, 'rgba(255,190,110,0.35)'); lg.addColorStop(1, 'rgba(255,170,90,0)');
    g.fillStyle = lg; g.fillRect(0, 0, B, H);
  }
  // de streep eronder: een lange veeg, licht grijsblauw
  g.save();
  g.translate(B * 0.08, H * 0.78);
  for (let i = 0; i < 9; i++) {
    g.strokeStyle = `rgba(${170 + i * 4},${185 + i * 3},${200 + i * 2},${0.55 + r() * 0.3})`;
    g.lineWidth = H * (0.018 + r() * 0.012); g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, i * H * 0.012 - H * 0.04); g.lineTo(B * 0.84, i * H * 0.006 - H * 0.07 - r() * H * 0.01); g.stroke();
  }
  g.restore();
  // de letters: schuin, zwart, met een paar rafels
  g.save();
  g.translate(B * 0.5, H * 0.62);
  g.transform(1, 0, -0.22, 1, 0, 0);
  g.fillStyle = '#0d0d0e';
  g.font = `900 ${Math.round(H * 0.62)}px "Brush Script MT", "Segoe Script", "Comic Sans MS", Impact, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillText('yugo', 0, 0);
  for (let i = 0; i < 70; i++) {
    const x = (r() - 0.5) * B * 0.62, y = -r() * H * 0.48;
    g.fillRect(x, y, 2 + r() * 10, 1 + r() * 3);
  }
  g.restore();
  // de rode stip in de o (rechtsboven in de laatste letter)
  g.fillStyle = '#d3242a';
  g.beginPath(); g.ellipse(B * 0.76, H * 0.36, H * 0.05, H * 0.04, -0.4, 0, Math.PI * 2); g.fill();
}
// houten steenstrips: rijen strips van wisselende lengte en kleur, met schaduw in de voegen
function steenstrips() {
  const S = 512, c = doek(S, S), g = c.getContext('2d'), r = rnd(23);
  const kleuren = ['#c9a678', '#b8915f', '#d8bb8e', '#a77c4f', '#e0c79f', '#8f6a44', '#cfae80', '#9d7448'];
  g.fillStyle = '#4a3624'; g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 21) {
    let x = -r() * 60;
    while (x < S) {
      const w = 40 + r() * 110, k = kleuren[Math.floor(r() * kleuren.length)];
      const diep = r() < 0.3 ? 2 : 0;          // sommige strips liggen iets dieper
      g.fillStyle = k; g.fillRect(x + 1, y + 1, w - 2, 18);
      // licht van boven, schaduw onder (het reliëf van de strips)
      g.fillStyle = `rgba(255,240,210,${0.18 + diep * 0.04})`; g.fillRect(x + 1, y + 1, w - 2, 3);
      g.fillStyle = 'rgba(40,25,10,0.35)'; g.fillRect(x + 1, y + 16, w - 2, 3);
      for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(60,40,20,${0.08 + r() * 0.1})`; g.fillRect(x + r() * w, y + 2 + r() * 14, 8 + r() * 30, 1); }
      x += w;
    }
  }
  return c;
}
// lichte eiken planken
function plankenvloer() {
  const S = 512, c = doek(S, S), g = c.getContext('2d'), r = rnd(9);
  for (let y = 0; y < S; y += 64) {
    let x = -r() * 200;
    while (x < S) {
      const w = 180 + r() * 220, v = 196 + Math.floor(r() * 26);
      g.fillStyle = `rgb(${v},${v - 14},${v - 34})`; g.fillRect(x, y, w, 64);
      for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(120,95,60,${0.06 + r() * 0.08})`; g.fillRect(x, y + 4 + r() * 56, w, 1 + r() * 2); }
      g.fillStyle = 'rgba(90,70,45,0.45)'; g.fillRect(x, y, 2, 64);
      x += w;
    }
    g.fillStyle = 'rgba(90,70,45,0.5)'; g.fillRect(0, y, S, 2);
  }
  return c;
}
// het donkere systeemplafond met een ronde spot in elke tweede plaat
function plafondplaat() {
  const S = 256, c = doek(S, S), g = c.getContext('2d'), r = rnd(5);
  g.fillStyle = '#2b2e33'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.04})`; g.fillRect(r() * S, r() * S, 1, 1); }
  g.fillStyle = '#1c1e22'; g.fillRect(0, 0, S, 4); g.fillRect(0, 0, 4, S); g.fillRect(0, S / 2, S, 3); g.fillRect(S / 2, 0, 3, S);
  // spotje
  const lg = g.createRadialGradient(S * 0.75, S * 0.75, 2, S * 0.75, S * 0.75, 22);
  lg.addColorStop(0, '#fffdf2'); lg.addColorStop(0.45, '#fff2cc'); lg.addColorStop(0.5, '#6d6a62'); lg.addColorStop(1, 'rgba(43,46,51,0)');
  g.fillStyle = lg; g.beginPath(); g.arc(S * 0.75, S * 0.75, 22, 0, Math.PI * 2); g.fill();
  return c;
}
// blauw velours van de bank, met naden om de meter
function velours() {
  const S = 256, c = doek(S, S), g = c.getContext('2d'), r = rnd(13);
  g.fillStyle = '#3a5a8c'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) { const v = r() * 0.12; g.fillStyle = r() < 0.5 ? `rgba(255,255,255,${v})` : `rgba(0,10,30,${v})`; g.fillRect(r() * S, r() * S, 2, 2); }
  g.fillStyle = 'rgba(15,25,45,0.55)'; g.fillRect(0, 0, 4, S);
  return c;
}
// papieren onderlegger met "yugo" in penseelletters, zoals op de foto van de zaal
function onderlegger() {
  const B = 256, H = 160, c = doek(B, H), g = c.getContext('2d');
  g.fillStyle = '#f2f0ea'; g.fillRect(0, 0, B, H);
  g.save(); g.translate(B * 0.5, H * 0.6); g.transform(1, 0, -0.2, 1, 0, 0);
  g.fillStyle = '#151515'; g.font = `900 ${Math.round(H * 0.42)}px "Brush Script MT", "Segoe Script", Impact, sans-serif`;
  g.textAlign = 'center'; g.fillText('yugo', 0, 0); g.restore();
  g.fillStyle = '#c92a2a'; g.beginPath(); g.arc(B * 0.73, H * 0.36, 5, 0, Math.PI * 2); g.fill();
  return c;
}
// het scherm van de tablet op tafel (in 3D): het menu, klein
function tabletScherm() {
  const B = 256, H = 180, c = doek(B, H), g = c.getContext('2d');
  g.fillStyle = '#ececea'; g.fillRect(0, 0, B, H);
  // veren in zwarte penseelstreken, zoals het welkomstscherm van de tablet
  const r = rnd(77);
  g.strokeStyle = '#111'; g.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const x = r() * B, y = r() * H, a = r() * Math.PI * 2, l = 18 + r() * 30;
    g.lineWidth = 2 + r() * 3;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l, y + Math.sin(a) * l * 0.4, x + Math.cos(a + 0.6) * l * 1.4, y + Math.sin(a + 0.6) * l); g.stroke();
  }
  tekenLogo(g, B * 0.5 - 45, 18, 90);
  g.fillStyle = 'rgba(110,110,110,0.85)'; g.beginPath(); g.arc(B * 0.5, H * 0.78, 22, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.font = '11px Arial'; g.textAlign = 'center'; g.fillText('Tap for', B * 0.5, H * 0.77); g.fillText('Menu', B * 0.5, H * 0.84);
  return c;
}
// de dop van een rol: rijst rondom, nori, en de vulling in het midden
function rolDop(soort) {
  const S = 128, c = doek(S, S), g = c.getContext('2d'), r = rnd(soort.length * 31);
  const m = S / 2;
  const rijst = (r0, r1) => {
    g.fillStyle = '#f4f1e8'; g.beginPath(); g.arc(m, m, r0, 0, Math.PI * 2); g.arc(m, m, r1, 0, Math.PI * 2, true); g.fill();
    for (let i = 0; i < 160; i++) {
      const a = r() * Math.PI * 2, d = r1 + r() * (r0 - r1);
      g.fillStyle = r() < 0.5 ? '#ffffff' : '#ddd8c8';
      g.beginPath(); g.ellipse(m + Math.cos(a) * d, m + Math.sin(a) * d, 3, 1.6, r() * 3, 0, Math.PI * 2); g.fill();
    }
  };
  g.clearRect(0, 0, S, S);
  if (soort === 'maki') {
    g.fillStyle = '#16201a'; g.beginPath(); g.arc(m, m, 63, 0, Math.PI * 2); g.fill();      // nori buiten
    rijst(57, 22);
    g.fillStyle = '#f27a3d'; g.beginPath(); g.arc(m, m, 22, 0, Math.PI * 2); g.fill();      // zalm
    g.strokeStyle = 'rgba(255,230,210,0.7)'; g.lineWidth = 2;
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(m - 18, m + i * 7); g.lineTo(m + 18, m + i * 7 + 4); g.stroke(); }
    return c;
  }
  // de rollen met rijst buiten (uramaki)
  g.fillStyle = soort === 'california' ? '#f07a1a' : '#d9a441';
  g.beginPath(); g.arc(m, m, 63, 0, Math.PI * 2); g.fill();                                  // de jas
  rijst(58, 34);
  g.fillStyle = '#16201a'; g.beginPath(); g.arc(m, m, 34, 0, Math.PI * 2); g.fill();         // nori binnen
  if (soort === 'california') {
    g.fillStyle = '#f7efe6'; g.beginPath(); g.arc(m - 8, m - 6, 13, 0, Math.PI * 2); g.fill();  // krab
    g.fillStyle = '#e04a3a'; g.fillRect(m - 18, m - 10, 18, 4);
    g.fillStyle = '#8fbf4a'; g.beginPath(); g.arc(m + 12, m - 4, 9, 0, Math.PI * 2); g.fill();  // avocado
    g.fillStyle = '#4f9a3a'; g.fillRect(m - 6, m + 10, 18, 7);                                   // komkommer
  } else {
    g.fillStyle = '#e8a33a'; g.beginPath(); g.ellipse(m, m, 20, 13, 0.3, 0, Math.PI * 2); g.fill();  // tempura
    g.fillStyle = '#f26b4a'; g.beginPath(); g.ellipse(m + 2, m, 12, 7, 0.3, 0, Math.PI * 2); g.fill(); // garnaal
    // spicy mayo en de zoete saus in een zigzag eroverheen
    g.lineCap = 'round';
    g.strokeStyle = '#f2b38a'; g.lineWidth = 5; g.beginPath();
    for (let i = 0; i <= 6; i++) g.lineTo(m - 50 + i * 17, m + (i % 2 ? -26 : 24)); g.stroke();
    g.strokeStyle = '#4a2412'; g.lineWidth = 3; g.beginPath();
    for (let i = 0; i <= 6; i++) g.lineTo(m - 46 + i * 16, m + (i % 2 ? 22 : -22)); g.stroke();
  }
  return c;
}
// de zijkant van een rol: nori (maki), tobiko (California) of krokante tempura (ebi)
function rolZij(soort) {
  const B = 256, H = 64, c = doek(B, H), g = c.getContext('2d'), r = rnd(soort.length * 17);
  if (soort === 'maki') {
    g.fillStyle = '#18231c'; g.fillRect(0, 0, B, H);
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${40 + r() * 40},${70 + r() * 40},${50 + r() * 30},0.35)`; g.fillRect(r() * B, r() * H, 3, 1); }
  } else if (soort === 'california') {
    g.fillStyle = '#e8661a'; g.fillRect(0, 0, B, H);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = r() < 0.5 ? '#ff8a2a' : '#c94e0e';
      g.beginPath(); g.arc(r() * B, r() * H, 1.6 + r(), 0, Math.PI * 2); g.fill();
    }
  } else {
    g.fillStyle = '#d6a24a'; g.fillRect(0, 0, B, H);
    for (let i = 0; i < 500; i++) { g.fillStyle = r() < 0.5 ? '#f1cd7a' : '#a8742a'; g.fillRect(r() * B, r() * H, 2 + r() * 5, 1 + r() * 3); }
  }
  return c;
}
// zalm: oranje met witte vetlijnen
function zalm() {
  const B = 128, H = 64, c = doek(B, H), g = c.getContext('2d');
  g.fillStyle = '#f2763a'; g.fillRect(0, 0, B, H);
  g.strokeStyle = 'rgba(255,236,220,0.8)'; g.lineWidth = 3;
  for (let x = -40; x < B + 40; x += 14) { g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + 10, H / 2, x - 6, H); g.stroke(); }
  return c;
}
function rijstDoek() {
  const S = 128, c = doek(S, S), g = c.getContext('2d'), r = rnd(3);
  g.fillStyle = '#f2efe6'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 500; i++) { g.fillStyle = r() < 0.5 ? '#ffffff' : '#d9d3c2'; g.beginPath(); g.ellipse(r() * S, r() * S, 4, 2, r() * 3, 0, Math.PI * 2); g.fill(); }
  return c;
}
// de passievrucht: geel met zaadjes, voor het halve vruchtje in de cocktail
function passievrucht() {
  const S = 64, c = doek(S, S), g = c.getContext('2d'), r = rnd(19);
  g.fillStyle = '#f2c230'; g.beginPath(); g.arc(32, 32, 31, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#d98a14'; g.beginPath(); g.arc(32, 32, 26, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 40; i++) { const a = r() * Math.PI * 2, d = r() * 22; g.fillStyle = '#2a1a0c'; g.beginPath(); g.arc(32 + Math.cos(a) * d, 32 + Math.sin(a) * d, 1.6, 0, Math.PI * 2); g.fill(); }
  return c;
}

/*
 Een tegel van de tablet: het gerecht op een zwarte achtergrond, getekend (geen foto's). Ook voor de proef en de README.
*/
export function tekenGerecht(g, soort, B, H) {
  g.fillStyle = '#0c0c0d'; g.fillRect(0, 0, B, H);
  const plank = (x, y, w, h) => { g.fillStyle = '#1f1f22'; g.fillRect(x, y, w, h); g.fillStyle = '#2c2c30'; g.fillRect(x, y, w, 3); };
  const m = { x: B / 2, y: H * 0.55 };
  if (soort === 'martini') {
    // de coupe met het gele drankje, het halve vruchtje en het shotje ernaast
    g.strokeStyle = 'rgba(230,240,245,0.8)'; g.lineWidth = 2;
    g.fillStyle = '#f2b33d'; g.beginPath(); g.moveTo(m.x - 34, m.y - 26); g.quadraticCurveTo(m.x, m.y + 18, m.x + 34, m.y - 26); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(m.x, m.y - 4); g.lineTo(m.x, m.y + 30); g.moveTo(m.x - 16, m.y + 32); g.lineTo(m.x + 16, m.y + 32); g.stroke();
    g.fillStyle = '#f2c230'; g.beginPath(); g.arc(m.x + 10, m.y - 26, 9, Math.PI, 0); g.fill();
    g.fillStyle = '#d98a14'; g.beginPath(); g.ellipse(m.x + 10, m.y - 26, 8, 2.5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(240,235,200,0.8)'; g.fillRect(m.x + 46, m.y + 2, 12, 22);
    g.strokeRect(m.x + 46, m.y - 4, 12, 28);
    return;
  }
  plank(m.x - 60, m.y + 4, 120, 16);
  const n = soort === 'nigiri' ? 2 : 4;
  for (let i = 0; i < n; i++) {
    const x = m.x - (n - 1) * 15 + i * 30;
    if (soort === 'nigiri') {
      const x2 = m.x - 22 + i * 44;
      g.fillStyle = '#f4f1e8'; g.beginPath(); g.ellipse(x2, m.y, 20, 9, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f2763a'; g.beginPath(); g.ellipse(x2, m.y - 7, 22, 8, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,236,220,0.8)'; g.lineWidth = 1.5;
      for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(x2 + k * 7 - 3, m.y - 13); g.lineTo(x2 + k * 7 + 3, m.y - 2); g.stroke(); }
      continue;
    }
    const zij = soort === 'maki' ? '#18231c' : soort === 'california' ? '#e8661a' : '#d6a24a';
    g.fillStyle = zij; g.fillRect(x - 12, m.y - 10, 24, 14);
    g.fillStyle = zij; g.beginPath(); g.ellipse(x, m.y - 10, 12, 5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f4f1e8'; g.beginPath(); g.ellipse(x, m.y - 10, soort === 'maki' ? 10 : 9, 4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = soort === 'maki' ? '#f27a3d' : '#16201a'; g.beginPath(); g.ellipse(x, m.y - 10, 5, 2, 0, 0, Math.PI * 2); g.fill();
    if (soort === 'ebi') { g.strokeStyle = '#f2b38a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 9, m.y - 12); g.lineTo(x, m.y - 8); g.lineTo(x + 9, m.y - 12); g.stroke(); }
  }
  // gember en wasabi
  g.fillStyle = '#f2b7a8'; g.beginPath(); g.ellipse(m.x + 50, m.y + 2, 7, 4, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#8fbf3a'; g.beginPath(); g.arc(m.x - 52, m.y + 2, 4, 0, Math.PI * 2); g.fill();
}

// ---------- het etentje ----------
export function initYugo({ scene, player, camera, hud, geluid, Persoon }) {
  if (!KAART) return null;
  const Y = YUGO, B = Y.breed, D = Y.diep, P = Y.plafond, T = Y.tafel;
  // ruim buiten het kaartgebied, ver van de woningen, de boerderij, de Poiesz en de studio (die op x1 + 520…640)
  const G = KAART.gebied || { x1: 400, z1: 460 };
  const NUL = { x: G.x1 + 800, z: G.z1 + 1250 };
  const groep = new THREE.Group();
  groep.position.set(NUL.x, 0, NUL.z);
  scene.add(groep);
  const wereld = (x, z) => ({ x: NUL.x + x, z: NUL.z + z });

  // ---------- licht in de vlakken: warm en gedempt, van boven ----------
  function vlakKleur(nx, ny, nz) {
    return Math.min(1, 0.56 + 0.30 * Math.max(0, ny) + 0.10 * Math.abs(nx) + 0.07 * Math.abs(nz) + 0.06 * Math.max(0, -ny));
  }
  function kleurIn(geo, vol = false) {
    const n = geo.getAttribute('normal'), cnt = geo.getAttribute('position').count;
    const col = new Float32Array(cnt * 3);
    for (let i = 0; i < cnt; i++) {
      const f = vol ? 1 : (n ? vlakKleur(n.getX(i), n.getY(i), n.getZ(i)) : 0.9);
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = f;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
  }
  const vlak = (c, rx = 1, ry = 1) => new THREE.MeshBasicMaterial({ map: texture(c, rx, ry), vertexColors: true, fog: false });
  const plat = (kleur) => new THREE.MeshBasicMaterial({ color: kleur, vertexColors: true, fog: false });
  const merkCanvas = doek(1024, 384);
  tekenWandLogo(merkCanvas.getContext('2d'), 1024, 384);
  const logoCanvas = doek(256, 256);
  tekenLogo(logoCanvas.getContext('2d'), 0, 0, 256);
  const MAT = {
    vloer: vlak(plankenvloer()),
    plafond: vlak(plafondplaat()),
    muur: plat(0x3a3d42),
    muurLicht: plat(0xd8d6d0),
    strips: vlak(steenstrips()),
    velours: vlak(velours()),
    blad: plat(0xcfc3ad),              // licht eiken tafelblad
    staal: plat(0x1e1f22),
    zwart: plat(0x15161a),
    grijs: plat(0x8e959c),
    stoelGrijs: plat(0x9aa3aa),
    stoelZwart: plat(0x2a2c30),
    hout: plat(0xa8845a),
    bar: plat(0x4b4f55),
    fles: plat(0x1f3c78),
    plant: plat(0x4f8a4a),
    pot: plat(0x8a8f94),
    emmerBlauw: plat(0x2f6cb0), emmerGroen: plat(0x5fa89a), emmerDonker: plat(0x1e3a7a), emmerRood: plat(0xe2553a),
    lamp: new THREE.MeshBasicMaterial({ color: 0xfff1c8, fog: false }),
    merk: new THREE.MeshBasicMaterial({ map: texture(merkCanvas), transparent: true, depthWrite: false, fog: false }),
    logo: vlak(logoCanvas),
    onderlegger: vlak(onderlegger()),
    soja: plat(0x1a0d08), dop: plat(0xd8302a),
    glaasje: plat(0xf0b030),
    bordje: plat(0x101012),
    scherm: vlak(tabletScherm()),
    deur: plat(0x2a2c30),
    keukenRaam: new THREE.MeshBasicMaterial({ color: 0xf6efd8, fog: false }),
  };
  // ---------- bouwstenen: per materiaal samengevoegd ----------
  const bakken = new Map();
  const dozen = [];
  function voegGeo(mat, geo, vol = false) {
    let b = bakken.get(mat);
    if (!b) { b = { pos: [], nor: [], uv: [], col: [] }; bakken.set(mat, b); }
    const pos = geo.getAttribute('position'), nor = geo.getAttribute('normal'), uv = geo.getAttribute('uv');
    const idx = geo.getIndex();
    const zet = (i) => {
      b.pos.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      const nx = nor ? nor.getX(i) : 0, ny = nor ? nor.getY(i) : 1, nz = nor ? nor.getZ(i) : 0;
      b.nor.push(nx, ny, nz);
      const f = vol ? 1 : vlakKleur(nx, ny, nz);
      b.col.push(f, f, f);
      b.uv.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
    };
    if (idx) for (let i = 0; i < idx.count; i++) zet(idx.getX(i));
    else for (let i = 0; i < pos.count; i++) zet(i);
    geo.dispose();
  }
  function doos(x0, x1, z0, z1, y0, y1, mat, { uvm = 0, botst = false, vol = false } = {}) {
    const w = x1 - x0, h = y1 - y0, d = z1 - z0;
    if (w <= 0 || h <= 0 || d <= 0) return;
    const geo = new THREE.BoxGeometry(w, h, d);
    if (uvm) {
      const uv = geo.getAttribute('uv');
      const maten = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
      for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
        const k = f * 4 + i;
        uv.setXY(k, uv.getX(k) * maten[f][0] / uvm, uv.getY(k) * maten[f][1] / uvm);
      }
    }
    geo.translate(x0 + w / 2, y0 + h / 2, z0 + d / 2);
    voegGeo(mat, geo, vol);
    if (botst) dozen.push({ x: x0 + w / 2, z: z0 + d / 2, hx: w / 2, hz: d / 2, h: y1 });
  }
  function cilinder(x, y0, z, r0, r1, h, mat, seg = 16, open = false) {
    const geo = new THREE.CylinderGeometry(r1, r0, h, seg, 1, open);
    geo.translate(x, y0 + h / 2, z);
    voegGeo(mat, geo);
  }
  const OMHOOG = new THREE.Vector3(0, 1, 0);
  function staaf(a, b, r, mat, seg = 8) {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const lang = va.distanceTo(vb);
    if (lang < 1e-4) return;
    const geo = new THREE.CylinderGeometry(r, r, lang, seg);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(OMHOOG, vb.clone().sub(va).normalize()));
    const m = va.clone().add(vb).multiplyScalar(0.5);
    geo.translate(m.x, m.y, m.z);
    voegGeo(mat, geo);
  }
  function vlakXY(x, y, z, w, h, mat, yaw = 0, vol = true) {
    const geo = new THREE.PlaneGeometry(w, h);
    geo.rotateY(yaw);
    geo.translate(x, y, z);
    voegGeo(mat, geo, vol);
  }
  function vloerVlak(x0, x1, z0, z1, y, mat, omhoog = true, uvm = 0) {
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    geo.rotateX(omhoog ? -Math.PI / 2 : Math.PI / 2);
    if (uvm) {
      const uv = geo.getAttribute('uv');
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0) / uvm, uv.getY(i) * (z1 - z0) / uvm);
    }
    geo.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
    voegGeo(mat, geo);
  }

  // ---------- vloer, plafond, wanden ----------
  const M = Y.muur;
  vloerVlak(0, B, 0, D, 0, MAT.vloer, true, 3.0);
  vloerVlak(0, B, 0, D, P, MAT.plafond, false, 1.2);
  doos(-M, B + M, -M, 0, 0, P + 0.1, MAT.muur, { botst: true });          // achterwand (z = 0)
  doos(-M, B + M, D, D + M, 0, P + 0.1, MAT.muur, { botst: true });       // voorwand met de ingang
  doos(-M, 0, 0, D, 0, P + 0.1, MAT.muur, { botst: true });               // links: de keuken
  doos(B, B + M, 0, D, 0, P + 0.1, MAT.muurLicht, { botst: true });       // rechts
  // de wand met steenstrips achter de bank, van x 5,8 tot het eind, met het logo erop
  doos(5.8, B, 0, 0.04, 0, P, MAT.strips, { uvm: 1.6 });
  // het logo boven de rugleuning (die komt tot 1,02 m), achter Johan; van de stoel zie je het in zijn geheel
  vlakXY(10.0, 1.62, 0.05, 2.5, 0.94, MAT.merk);
  // links op de achterwand: het stalen rek met flessen en planten
  for (let i = 0; i <= 4; i++) staaf([2.2 + i * 0.9, 0.95, 0.12], [2.2 + i * 0.9, 2.55, 0.12], 0.012, MAT.staal);
  for (const y of [1.25, 1.75, 2.25]) {
    doos(2.15, 5.85, 0.02, 0.26, y, y + 0.03, MAT.hout);
    const r = rnd(Math.round(y * 100));
    for (let x = 2.35; x < 5.7; x += 0.32 + r() * 0.25) {
      if (r() < 0.35) { cilinder(x, y + 0.03, 0.14, 0.06, 0.07, 0.11, MAT.pot); staaf([x, y + 0.14, 0.14], [x - 0.04, y + 0.36, 0.12], 0.012, MAT.plant); staaf([x, y + 0.14, 0.14], [x + 0.05, y + 0.32, 0.16], 0.012, MAT.plant); staaf([x, y + 0.14, 0.14], [x, y + 0.40, 0.14], 0.013, MAT.plant); }
      else { cilinder(x, y + 0.03, 0.14, 0.035, 0.035, 0.22, MAT.fles, 10); cilinder(x, y + 0.25, 0.14, 0.035, 0.012, 0.08, MAT.fles, 10); }
    }
  }
  // de lange blauwe bank langs de achterwand
  const BD = Y.bankDiep, Z = Y.zitting;
  doos(2.0, B - 0.2, 0.04, BD, 0, Z - 0.08, MAT.staal);                    // onderstel
  doos(2.0, B - 0.2, 0.04, BD, Z - 0.08, Z, MAT.velours, { uvm: 1.0 });    // zitting
  doos(2.0, B - 0.2, 0.04, 0.16, Z, 1.02, MAT.velours, { uvm: 1.0 });      // rugleuning
  dozen.push({ x: (2.0 + B - 0.2) / 2, z: BD / 2, hx: (B - 2.2) / 2, hz: BD / 2, h: Z });
  // de tafeltjes voor twee langs de bank, met een stoel ertegenover; ons tafeltje is T
  const stoelen = [];
  function stoel(x, z, yaw, mat) {
    // een kuipstoel op houten poten: een zitting, een gebogen rug (twee schuine plaatjes) en vier schuine poten
    const sx = Math.sin(yaw), sz = Math.cos(yaw);
    const zit = new THREE.BoxGeometry(0.44, 0.05, 0.42); zit.rotateY(yaw); zit.translate(x, 0.44, z); voegGeo(mat, zit);
    const rug = new THREE.BoxGeometry(0.44, 0.36, 0.04); rug.rotateX(-0.18); rug.rotateY(yaw); rug.translate(x + sx * 0.21, 0.66, z + sz * 0.21); voegGeo(mat, rug);
    for (const [px, pz] of [[-0.17, -0.15], [0.17, -0.15], [-0.17, 0.15], [0.17, 0.15]]) {
      const ax = x + px * Math.cos(yaw) + pz * sx, az = z - px * sx + pz * Math.cos(yaw);
      staaf([ax, 0.42, az], [ax + (ax - x) * 0.25, 0, az + (az - z) * 0.25], 0.012, MAT.hout, 6);
    }
    stoelen.push({ x, z, yaw });
  }
  function tafel(x, z, breed, diep, { stoelKant = true } = {}) {
    doos(x - breed / 2, x + breed / 2, z - diep / 2, z + diep / 2, T.hoog - 0.03, T.hoog, MAT.blad);
    staaf([x, 0, z], [x, T.hoog - 0.03, z], 0.03, MAT.staal);
    doos(x - 0.28, x + 0.28, z - 0.2, z + 0.2, 0, 0.02, MAT.staal);
    dozen.push({ x, z, hx: breed / 2, hz: diep / 2, h: T.hoog });
    // gedekt: twee onderleggers met een zwart bordje, een sojaflesje en een geel glaasje
    for (const k of [-1, 1]) {
      const pz = z + k * (diep / 2 - 0.13);
      vloerVlak(x - 0.17, x + 0.17, pz - 0.105, pz + 0.105, T.hoog + 0.002, MAT.onderlegger);
      if (!(x === T.x && z === T.z)) doos(x - 0.09, x + 0.09, pz - 0.05, pz + 0.05, T.hoog + 0.003, T.hoog + 0.016, MAT.bordje);
    }
    cilinder(x + breed / 2 - 0.12, T.hoog, z, 0.022, 0.018, 0.10, MAT.soja, 10);
    cilinder(x + breed / 2 - 0.12, T.hoog + 0.10, z, 0.012, 0.012, 0.025, MAT.dop, 8);
    cilinder(x + breed / 2 - 0.22, T.hoog, z + 0.05, 0.03, 0.035, 0.08, MAT.glaasje, 12);
    if (stoelKant) stoel(x, z + diep / 2 + 0.28, 0, (Math.round(x * 3) % 2) ? MAT.stoelGrijs : MAT.stoelZwart);
  }
  for (const x of [3.2, 5.0, 6.8, 8.2, T.x, 11.2, 12.8]) {
    if (x === T.x) tafel(T.x, T.z, T.breed, T.diep, { stoelKant: false });
    else if (Math.abs(x - T.x) > 1.3) tafel(x, 1.05, 0.9, 0.7);
  }
  // onze stoel: hier zit jij
  const jijStoel = { x: T.x, z: T.z + T.diep / 2 + 0.30 };
  stoel(jijStoel.x, jijStoel.z, 0, MAT.stoelZwart);
  // het hek met de houten leuning, met een opening bij de bar
  const HEK_Z = 2.65;
  doos(2.6, B - 0.1, HEK_Z - 0.04, HEK_Z + 0.04, 1.0, 1.05, MAT.hout);
  doos(2.6, B - 0.1, HEK_Z - 0.02, HEK_Z + 0.02, 0.06, 0.09, MAT.staal);
  for (let x = 2.6; x <= B - 0.1; x += 1.35) staaf([x, 0, HEK_Z], [x, 1.0, HEK_Z], 0.022, MAT.staal, 4);
  dozen.push({ x: (2.6 + B - 0.1) / 2, z: HEK_Z, hx: (B - 2.7) / 2, hz: 0.05, h: 1.05 });
  // voorin: ronde tafels met vier stoelen
  for (const [x, z] of [[4.4, 4.4], [7.4, 4.6], [10.4, 4.4], [5.6, 7.0], [9.0, 7.2], [12.3, 6.8]]) {
    cilinder(x, T.hoog - 0.03, z, 0.55, 0.55, 0.03, MAT.blad, 28);
    staaf([x, 0, z], [x, T.hoog - 0.03, z], 0.035, MAT.staal);
    cilinder(x, 0, z, 0.25, 0.25, 0.02, MAT.staal, 16);
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + 0.4;
      stoel(x + Math.sin(a) * 0.78, z + Math.cos(a) * 0.78, a, k % 2 ? MAT.stoelGrijs : MAT.stoelZwart);
      vloerVlak(x + Math.sin(a) * 0.36 - 0.12, x + Math.sin(a) * 0.36 + 0.12, z + Math.cos(a) * 0.36 - 0.08, z + Math.cos(a) * 0.36 + 0.08, T.hoog + 0.002, MAT.onderlegger);
    }
    cilinder(x, T.hoog, z, 0.022, 0.018, 0.10, MAT.soja, 10);
    cilinder(x, T.hoog + 0.10, z, 0.012, 0.012, 0.025, MAT.dop, 8);
  }
  // de emmerlampen: een open kegel aan een snoer, met een gloeiende lamp eronder
  const emmers = [[4.1, 1.05, MAT.emmerBlauw], [7.5, 1.05, MAT.emmerGroen], [T.x, T.z, MAT.emmerDonker], [12.0, 1.05, MAT.emmerBlauw],
    [4.4, 4.4, MAT.emmerGroen], [7.4, 4.6, MAT.emmerDonker], [10.4, 4.4, MAT.emmerBlauw], [5.6, 7.0, MAT.emmerDonker], [9.0, 7.2, MAT.emmerGroen], [12.3, 6.8, MAT.emmerBlauw]];
  for (const [x, z, mat] of emmers) {
    const onder = 1.72;
    staaf([x, onder + 0.32, z], [x, P, z], 0.005, MAT.zwart, 4);
    cilinder(x, onder, z, 0.17, 0.12, 0.32, mat, 18, true);
    const binnen = new THREE.CylinderGeometry(0.115, 0.165, 0.3, 18, 1, true);
    binnen.scale(-1, 1, 1);                     // de binnenkant naar binnen
    binnen.translate(x, onder + 0.16, z);
    voegGeo(mat === MAT.emmerDonker ? MAT.emmerRood : MAT.grijs, binnen);
    const bol = new THREE.SphereGeometry(0.045, 12, 8); bol.translate(x, onder + 0.04, z); voegGeo(MAT.lamp, bol, true);
  }
  // de sushibar links achterin, met de keukendeur erachter
  doos(0.0, 1.9, 0.6, 5.2, 0, 1.05, MAT.bar, { botst: true });
  doos(-0.02, 1.95, 0.55, 5.25, 1.05, 1.1, MAT.hout);
  const KEUKEN = { x: 0.02, z: 6.3 };
  doos(0.0, 0.06, KEUKEN.z - 0.5, KEUKEN.z + 0.5, 0, 2.1, MAT.deur);
  cilinder(0.07, 1.45, KEUKEN.z, 0.16, 0.16, 0.01, MAT.keukenRaam, 18);
  // de ingang voorin, met het zwarte vierkant van het logo erboven
  doos(2.5, 3.9, D - 0.06, D, 0, 2.2, MAT.deur);
  vlakXY(3.2, 2.45, D - 0.07, 0.42, 0.42, MAT.logo, Math.PI);

  // de bakken worden meshes
  for (const [mat, b] of bakken) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
    const mesh = new THREE.Mesh(geo, mat);
    if (mat === MAT.merk) mesh.renderOrder = 2;
    groep.add(mesh);
  }
  for (const d of dozen) addCollider(NUL.x + d.x, NUL.z + d.z, d.hx, d.hz, 0, d.h);

  // ---------- de tablet op tafel ----------
  const tablet3d = new THREE.Group();
  {
    const voet = new THREE.Mesh(kleurIn(new THREE.BoxGeometry(0.08, 0.01, 0.08)), MAT.zwart); voet.position.y = 0.005;
    const arm = new THREE.Mesh(kleurIn(new THREE.BoxGeometry(0.02, 0.12, 0.012)), MAT.zwart); arm.position.set(0, 0.07, 0.01);
    const rand = new THREE.Mesh(kleurIn(new THREE.BoxGeometry(0.26, 0.18, 0.01)), MAT.zwart); rand.position.set(0, 0.17, 0.02); rand.rotation.x = -0.35;
    const scherm = new THREE.Mesh(kleurIn(new THREE.PlaneGeometry(0.24, 0.165), true), MAT.scherm); scherm.position.set(0, 0.171, 0.0265); scherm.rotation.x = -0.35;
    tablet3d.add(voet, arm, rand, scherm);
  }
  // aan de kant van het hek, naar jou toe gedraaid
  tablet3d.position.set(T.x + T.breed / 2 - 0.2, T.hoog, T.z + 0.12);
  tablet3d.rotation.y = 0.5;
  groep.add(tablet3d);

  // ---------- de sushi: gedeelde vormen en doeken ----------
  const SM = {
    rijst: vlak(rijstDoek()),
    zalm: vlak(zalm()),
    plank: plat(0x141416),
    gember: plat(0xf2b7a8), wasabi: plat(0x8fbf3a),
    stokje: plat(0x1a1210), punt: plat(0xc9a676),
    glas: new THREE.MeshBasicMaterial({ color: 0xdfeef5, transparent: true, opacity: 0.28, depthWrite: false, fog: false }),
    cocktail: plat(0xf2b33d),
    prosecco: plat(0xf1e8b8),
    vrucht: vlak(passievrucht()),
    schil: plat(0xe8b62a),
  };
  const ROL = {};
  for (const s of ['maki', 'california', 'ebi']) ROL[s] = [vlak(rolZij(s)), vlak(rolDop(s)), vlak(rolDop(s))];
  const GEO = {
    rijstBol: kleurIn((() => { const g = new THREE.SphereGeometry(1, 14, 10); g.scale(0.022, 0.011, 0.012); g.translate(0, 0.011, 0); return g; })()),
    zalmPlak: kleurIn((() => {
      const g = new THREE.BoxGeometry(0.052, 0.006, 0.027, 8, 1, 2);
      const p = g.getAttribute('position');
      for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + 0.021 - 9 * p.getX(i) * p.getX(i));
      g.computeVertexNormals(); return g;
    })()),
    maki: kleurIn(new THREE.CylinderGeometry(0.0135, 0.0135, 0.024, 18).translate(0, 0.012, 0)),
    uramaki: kleurIn(new THREE.CylinderGeometry(0.019, 0.019, 0.024, 20).translate(0, 0.012, 0)),
    plank: kleurIn(new THREE.BoxGeometry(0.21, 0.009, 0.085).translate(0, 0.0045, 0)),
    gember: kleurIn(new THREE.SphereGeometry(0.012, 8, 6).scale(1.3, 0.5, 1).translate(0, 0.012, 0)),
    wasabi: kleurIn(new THREE.SphereGeometry(0.007, 8, 6).translate(0, 0.012, 0)),
    stokje: kleurIn(new THREE.CylinderGeometry(0.0018, 0.0034, 0.23, 6).translate(0, -0.115, 0)),
  };
  // het glas van de Pornstar Martini: een coupe als draaiprofiel, met het drankje erin en het halve vruchtje erop
  const coupe = [[0.001, 0], [0.034, 0], [0.034, 0.003], [0.004, 0.006], [0.004, 0.085], [0.02, 0.092], [0.045, 0.108], [0.052, 0.13], [0.050, 0.131]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const vulling = [[0.001, 0.088], [0.02, 0.094], [0.043, 0.109], [0.048, 0.124], [0.001, 0.124]].map(([x, y]) => new THREE.Vector2(x, y));
  GEO.coupe = kleurIn(new THREE.LatheGeometry(coupe, 24), true);
  GEO.vulling = kleurIn(new THREE.LatheGeometry(vulling, 24));
  GEO.vrucht = kleurIn(new THREE.SphereGeometry(0.016, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2));
  GEO.vruchtDop = kleurIn(new THREE.CircleGeometry(0.0155, 14).rotateX(-Math.PI / 2), true);
  GEO.shot = kleurIn(new THREE.CylinderGeometry(0.017, 0.015, 0.06, 14, 1, true).translate(0, 0.03, 0), true);
  GEO.shotVul = kleurIn(new THREE.CylinderGeometry(0.0155, 0.014, 0.04, 14).translate(0, 0.02, 0));

  function maakStuk(soort) {
    const g = new THREE.Group();
    if (soort === 'nigiri') { g.add(new THREE.Mesh(GEO.rijstBol, SM.rijst), new THREE.Mesh(GEO.zalmPlak, SM.zalm)); }
    else g.add(new THREE.Mesh(soort === 'maki' ? GEO.maki : GEO.uramaki, ROL[soort]));
    g.userData.soort = soort;
    return g;
  }
  function maakPlankje(soort) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(GEO.plank, SM.plank));
    const n = SUSHI.find(s => s.id === soort).stuks;
    const stukken = [];
    for (let i = 0; i < n; i++) {
      const s = maakStuk(soort);
      const tussen = soort === 'nigiri' ? 0.058 : 0.043;
      s.position.set(-0.02 - (n - 1) * tussen / 2 + i * tussen, 0.009, 0);
      if (soort === 'nigiri') s.rotation.y = 0.15;
      g.add(s); stukken.push(s);
    }
    const gember = new THREE.Mesh(GEO.gember, SM.gember); gember.position.set(0.084, 0.0, 0.012);
    const wasabi = new THREE.Mesh(GEO.wasabi, SM.wasabi); wasabi.position.set(0.086, 0.0, -0.022);
    g.add(gember, wasabi);
    g.userData = { soort, stukken };
    return g;
  }
  function maakGlas() {
    const g = new THREE.Group();
    const glas = new THREE.Mesh(GEO.coupe, SM.glas); glas.renderOrder = 3;
    const vul = new THREE.Mesh(GEO.vulling, SM.cocktail);
    const vrucht = new THREE.Group();
    vrucht.add(new THREE.Mesh(GEO.vrucht, SM.schil), new THREE.Mesh(GEO.vruchtDop, SM.vrucht));
    vrucht.position.set(0.012, 0.124, 0.005);
    const shot = new THREE.Mesh(GEO.shot, SM.glas); shot.position.set(0.075, 0, 0.02); shot.renderOrder = 3;
    const shotVul = new THREE.Mesh(GEO.shotVul, SM.prosecco); shotVul.position.copy(shot.position);
    g.add(vul, vrucht, shotVul, glas, shot);
    g.userData = { vul, vrucht, slokken: 0 };
    return g;
  }
  // de stokjes in jouw hand (aan de camera) en die van Johan
  function maakStokjes() {
    const g = new THREE.Group();
    const a = new THREE.Mesh(GEO.stokje, SM.stokje), b = new THREE.Mesh(GEO.stokje, SM.stokje);
    a.position.set(-0.004, 0, 0); b.position.set(0.004, 0, 0);
    a.rotation.z = 0.03; b.rotation.z = -0.03;
    g.add(a, b);
    // het stuk sushi hangt tussen de punten
    const vast = new THREE.Group(); vast.position.set(0, -0.225, 0); g.add(vast);
    g.userData.vast = vast;
    return g;
  }
  const stokjes = maakStokjes();
  stokjes.visible = false;
  scene.add(stokjes);
  const johanStokjes = maakStokjes();
  groep.add(johanStokjes);

  // één van elk ligt in de vitrine van de sushibar: dan staan alle materialen bij het opstarten in de scène
  const vitrine = new THREE.Group();
  SUSHI.forEach((s, i) => { const p = maakPlankje(s.id); p.position.set(0.9, 1.1, 1.2 + i * 0.6); p.rotation.y = Math.PI / 2; vitrine.add(p); });
  { const gl = maakGlas(); gl.position.set(1.2, 1.1, 4.0); vitrine.add(gl); }
  groep.add(vitrine);

  // ---------- de mensen: Johan, de ober, een paar gasten ----------
  const johan = new Persoon({ shirt: 0x3d6b3a, broek: 0x2b3542, huid: 0xd3a273, haar: 0x3a2a1c, hoogte: 1.05 });
  scene.add(johan.groep);
  const johanPlek = wereld(T.x, 0.36);
  johan.zetNeer(johanPlek.x, johanPlek.z, Math.PI);
  johan.groep.visible = false;
  const ober = new Persoon({ shirt: 0x141416, broek: 0x141416, huid: 0xc99a6e, haar: 0x111111, hoogte: 1.0, schoen: 0x0d0d0d });
  scene.add(ober.groep);
  const dienblad = new THREE.Mesh(kleurIn(new THREE.CylinderGeometry(0.2, 0.2, 0.012, 22)), MAT.zwart);
  ober.groep.add(dienblad);
  dienblad.position.set(0.22, 1.02, -0.18);
  const KEUKEN_W = wereld(KEUKEN.x + 0.5, KEUKEN.z);
  ober.zetNeer(KEUKEN_W.x, KEUKEN_W.z, Math.PI / 2);
  ober.groep.visible = false;
  // de looproute van de ober: de keukendeur, langs de bar, door het gangpad achter het hek, naast onze tafel
  const OBER_PAD = [[KEUKEN.x + 0.5, KEUKEN.z], [2.25, 5.6], [2.25, 2.2], [T.x + T.breed / 2 + 0.25, 2.2], [T.x + T.breed / 2 + 0.25, T.z + 0.1]]
    .map(([x, z]) => wereld(x, z));
  /*
   De andere gasten (gevraagd: "laat ook wat andere mensen in Yugo zitten te eten"): stelletjes aan de tafeltjes langs de bank, een
   gezin en vrienden aan de ronde tafels. Ieder heeft een plankje sushi voor zich en eet in zijn eigen tempo met stokjes: een stuk
   per 4 à 9 tellen, met de arm naar de mond; is het plankje leeg, dan staat er na een tijdje een nieuw (de ober loopt niet voor
   ze, dat zou door je eigen bestelling heen lopen). Ze zijn er alleen zolang jij aan tafel zit.
  */
  const gasten = [];
  {
    const r = rnd(5);
    const kleding = [[0x8a3b3b, 0x2a2f3a, 0xe0b894], [0x2f4f6f, 0x3a3a3a, 0x8d5a3b], [0xd8d2c4, 0x2d3542, 0xf0c9a8], [0x5b4a7a, 0x222428, 0xc08a62],
      [0x3f6b5a, 0x1f2a36, 0xd9b48f], [0xc9a24a, 0x2b2b2b, 0x6b4630], [0x1d1f24, 0x45505c, 0xf2d0b4], [0xa84a6a, 0x2a2f3a, 0xd3a273]];
    const rond = (x, z, k) => { const a = k * Math.PI / 2 + 0.4; return [x + Math.sin(a) * 0.78, z + Math.cos(a) * 0.78, a]; };
    const BANK_Z = 0.36, STOEL_Z = 1.05 + 0.35 + 0.28;
    const plekken = [
      [3.2, BANK_Z, Math.PI], [3.2, STOEL_Z, 0], [5.0, BANK_Z, Math.PI], [6.8, BANK_Z, Math.PI], [6.8, STOEL_Z, 0],
      [8.2, STOEL_Z, 0], [11.2, BANK_Z, Math.PI], [12.8, BANK_Z, Math.PI], [12.8, STOEL_Z, 0],
      rond(4.4, 4.4, 0), rond(4.4, 4.4, 2), rond(7.4, 4.6, 0), rond(7.4, 4.6, 1),
      rond(5.6, 7.0, 0), rond(5.6, 7.0, 1), rond(5.6, 7.0, 2), rond(12.3, 6.8, 1), rond(12.3, 6.8, 3),
    ];
    plekken.forEach(([x, z, yaw], i) => {
      const k = kleding[i % kleding.length];
      const kind = i === 14;                          // het gezin aan de ronde tafel heeft een kind
      const hoogte = kind ? 0.72 : 0.96 + r() * 0.08;
      const p = new Persoon({ shirt: k[0], broek: k[1], huid: k[2], haar: r() < 0.5 ? 0x2a1d12 : (r() < 0.5 ? 0x6b4a2a : 0xc9a26a),
        vrouw: i % 2 === 1, kapsel: i % 2 ? (r() < 0.5 ? 'lang' : 'halflang') : (r() < 0.2 ? 'kaal' : 'kort'), baard: !(i % 2) && r() < 0.3 ? 'kort' : 'geen',
        hoogte });
      scene.add(p.groep);
      const w = wereld(x, z);
      p.zetNeer(w.x, w.z, yaw);
      p.groep.visible = false;
      // het plankje voor hem op tafel, en zijn stokjes
      const f = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
      const bord = maakPlankje(SUSHI[i % SUSHI.length].id);
      bord.position.set(x + f.x * 0.5, T.hoog, z + f.z * 0.5);
      bord.rotation.y = yaw;
      bord.visible = false;
      groep.add(bord);
      const stok = maakStokjes();
      stok.rotation.order = 'YXZ';
      stok.visible = false;
      groep.add(stok);
      gasten.push({ p, bord, stok, yaw, kind, hapT: 2 + r() * 7, hap: null, bijT: 0, zit: Y.zitting / hoogte });   // (de zithouding rekent in zijn eigen maat: een kind op dezelfde stoel)
    });
  }
  // ---------- de tablet op het scherm ----------
  const tabletEl = maakTabletEl();
  function maakTabletEl() {
    if (typeof document === 'undefined') return null;
    const stijl = document.createElement('style');
    stijl.textContent = `
      #yugoTablet { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -54%) rotate(-1.5deg); z-index: 5;
        width: min(560px, 92vw); background: #111214; border-radius: 30px; padding: 18px; box-shadow: 0 30px 60px rgba(0,0,0,0.55);
        font-family: "Helvetica Neue", Arial, sans-serif; color: #111; }
      #yugoTablet[hidden] { display: none; }
      #yugoTablet .scherm { background: #f1f1ef; border-radius: 12px; padding: 12px 12px 10px; }
      #yugoTablet .kop { display: flex; align-items: center; justify-content: space-between; }
      #yugoTablet .terug { background: #9a9a9a; color: #fff; border-radius: 4px; padding: 3px 10px; font-size: 13px; }
      #yugoTablet .titel { font-size: 18px; margin: 6px 0 8px; }
      #yugoTablet .tegels { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
      #yugoTablet .tegel { position: relative; background: #0c0c0d; border-radius: 6px; overflow: hidden; }
      #yugoTablet .tegel canvas { display: block; width: 100%; height: auto; }
      #yugoTablet .tegel .naam { background: #fff; font-size: 12px; padding: 4px 6px; display: flex; justify-content: space-between; }
      #yugoTablet .tegel .nr { position: absolute; left: 6px; top: 5px; color: #fff; font-size: 12px; opacity: 0.8; }
      #yugoTablet .tegel .aantal { position: absolute; right: 6px; top: 5px; background: #d3242a; color: #fff; border-radius: 10px; min-width: 20px;
        text-align: center; font-size: 13px; font-weight: bold; padding: 1px 6px; }
      #yugoTablet .tegel .aantal[hidden] { display: none; }
      #yugoTablet .bestel { display: flex; flex-direction: column; justify-content: center; align-items: center; background: #0c0c0d; color: #fff; }
      #yugoTablet .bestel b { font-size: 18px; letter-spacing: 1px; }
      #yugoTablet .eerst { background: #fff6d6; border-radius: 6px; font-size: 12px; padding: 6px 8px; margin-top: 8px; color: #333; }
      #yugoTablet .eerst[hidden] { display: none; }
      #yugoTablet .voet { display: flex; justify-content: space-between; font-size: 12px; color: #555; margin-top: 8px; }
    `;
    document.head.appendChild(stijl);
    const el = document.createElement('div');
    el.id = 'yugoTablet'; el.hidden = true;
    const logo = doek(120, 120); tekenLogo(logo.getContext('2d'), 0, 0, 120);
    logo.style.cssText = 'width:60px;height:60px;display:block';
    el.innerHTML = `<div class="scherm"><div class="kop"><span class="terug">‹ Back</span><span class="logo"></span><span class="ronde"></span></div>
      <div class="titel">Yugo Sushi</div><div class="tegels"></div>
      <div class="eerst">Zo werkt het: kies met 1–4 een plankje sushi (hoogstens 4), met 5 een Pornstar Martini, en bestel met 6 of E. De ober brengt het; dan eet je met E en drink je met Q.</div>
      <div class="voet"><span class="uitleg">1–4 sushi · 5 drankje · 0 wissen · 6 of E bestellen</span><span class="teller"></span></div></div>`;
    el.querySelector('.logo').appendChild(logo);
    const tegels = el.querySelector('.tegels');
    [...SUSHI, DRANK].forEach((s, i) => {
      const t = document.createElement('div'); t.className = 'tegel';
      const c = doek(180, 120); tekenGerecht(c.getContext('2d'), s.id, 180, 120);
      t.appendChild(c);
      t.insertAdjacentHTML('beforeend', `<span class="nr">${i + 1}</span><span class="aantal" hidden>0</span><div class="naam"><span>${s.naam}</span></div>`);
      t.dataset.id = s.id;
      tegels.appendChild(t);
    });
    const bestel = document.createElement('div'); bestel.className = 'tegel bestel';
    bestel.innerHTML = '<span class="nr">6</span><b>BESTELLEN</b><span style="font-size:12px;opacity:.7">de ober komt eraan</span>';
    tegels.appendChild(bestel);
    document.body.appendChild(el);
    return el;
  }
  function werkTabletBij() {
    if (!tabletEl) return;
    tabletEl.hidden = !(st.actief && st.fase === 'bestellen');
    if (tabletEl.hidden) return;
    tabletEl.querySelector('.ronde').textContent = `Ronde ${st.ronde} van ${Y.rondes}`;
    for (const t of tabletEl.querySelectorAll('.tegel[data-id]')) {
      const n = st.keuze[t.dataset.id] || 0, a = t.querySelector('.aantal');
      a.hidden = !n; a.textContent = n;
    }
    tabletEl.querySelector('.teller').textContent = `${sushiTeller()} van ${Y.maxSushi} plankjes`;
    tabletEl.querySelector('.eerst').hidden = !(st.eersteKeer && st.ronde === 1);
  }

  // ---------- het etentje ----------
  const st = {
    actief: false, ronde: 0, fase: '', t: 0, tabletT: 0, duwde: false,
    keuze: {}, borden: [], glazen: [], praatT: 0, praatRecent: [], gesprekken: 0, johanT: 0, gegeten: 0, slokken: 0,
    stok: null, johanHap: null, besteldJohan: 0, besteldJij: 0, oberI: 0, oberMet: false, cb: null,
  };
  const r = Math.random;
  const tussen = ([a, b]) => a + r() * (b - a);
  function sushiTeller() { return SUSHI.reduce((n, s) => n + (st.keuze[s.id] || 0), 0); }
  // de vrije plekken op tafel: drie kolommen en twee rijen aan elke kant
  function plekOpTafel(kant, i) {
    const kol = i % 3, rij = Math.floor(i / 3);
    const x = T.x - 0.42 + kol * 0.25;
    const z = kant === 'jij' ? T.z + 0.18 - rij * 0.11 : T.z - 0.18 + rij * 0.11;
    return { x, z };
  }
  /*
   Een gesprek kiezen: twee van de drie keer een gesprek tussen Johan en Erik (als het bij de stand past), anders een losse
   opmerking van Johan over het eten; nooit een van de laatste acht.
  */
  const ALLE_GESPREKKEN = [...YUGO_TEKST.gesprekken, ...YUGO_TEKST.tafelpraat.map(t => ({ eten: true, regels: [['j', t]] }))];
  function kiesGesprek() {
    const vlag = (st.cb && st.cb.onderwerpen && st.cb.onderwerpen()) || {};
    const past = (g) => !g.als || !!vlag[g.als];
    const eten = r() < 0.34;
    let kan = ALLE_GESPREKKEN.map((g, i) => i).filter(i => past(ALLE_GESPREKKEN[i]) && !!ALLE_GESPREKKEN[i].eten === eten && !st.praatRecent.includes(i));
    if (!kan.length) kan = ALLE_GESPREKKEN.map((g, i) => i).filter(i => past(ALLE_GESPREKKEN[i]) && !st.praatRecent.includes(i));
    if (!kan.length) return null;
    const i = kan[Math.floor(r() * kan.length)];
    st.praatRecent.push(i); if (st.praatRecent.length > 8) st.praatRecent.shift();
    st.laatsteGesprek = i;
    return ALLE_GESPREKKEN[i];
  }
  function zeg(regels, opties = {}) { if (st.cb && st.cb.zeg) st.cb.zeg(regels, opties); }
  function johanZegt(tekst, auto = 4.5) { if (tekst) zeg([{ wie: 'Johan', tekst }], { auto }); }

  function begin(cb = {}) {
    st.cb = cb;
    st.actief = true; st.ronde = 0; st.gegeten = 0; st.slokken = 0; st.gesprekken = 0; st.praatT = tussen(Y.praat);
    ruimTafel(true);
    johan.groep.visible = true; ober.groep.visible = false;
    for (const g of gasten) {
      g.p.groep.visible = true; g.bord.visible = true; g.stok.visible = true; g.hap = null; g.hapT = 1 + r() * 8;
      for (const x of g.bord.userData.stukken) x.visible = r() < 0.75;
    }
    johan.zetNeer(johanPlek.x, johanPlek.z, Math.PI);
    // aan tafel: op de stoel, over de tafel naar Johan en het logo kijkend, een beetje omlaag naar het blad
    const w = wereld(jijStoel.x, jijStoel.z);
    player.inCar = null;
    player.pos.set(w.x, 0, w.z);
    player.eye = Y.oog;
    player.yaw = 0; player.pitch = -0.22;
    player.zit = true;
    // geen wapen tot je weer weg bent: niet trekken, wisselen, herladen, richten of schieten (js/player.js)
    player.aanTafel = true; player.richtAan = false; player.vuurAan = false;
    if (player.gun) player.gun.visible = false;
    player.applyCamera();
    stokjes.visible = true;
    st.stok = { fase: 'rust', t: 0, stuk: null, van: new THREE.Vector3() };
    st.eersteKeer = !!cb.eersteKeer;
    const tekst = st.eersteKeer ? [...YUGO_TEKST.aanTafel.slice(0, 1), ...YUGO_TEKST.uitleg] : YUGO_TEKST.aanTafel;
    zeg(tekst.map(t => ({ wie: 'Johan', tekst: t })), { auto: st.eersteKeer ? 6 : 4 });
    if (st.eersteKeer && hud && hud.melding) hud.melding(YUGO_TEKST.uitlegKop, YUGO_TEKST.uitlegTekst, 14);
    volgendeRonde();
  }
  function volgendeRonde() {
    st.ronde++;
    st.fase = 'bestellen'; st.t = 0; st.tabletT = 0; st.duwde = false;
    st.keuze = {};
    werkTabletBij();
  }
  function kies(n) {
    if (!st.actief || st.fase !== 'bestellen') return false;
    if (n === 0) { st.keuze = {}; werkTabletBij(); return true; }
    // (stap 212) niets gekozen: niet bestellen (wie E drukte om Johan door te klikken, bestelde zo een lege ronde)
    if (n === 6) {
      if (!sushiTeller() && !st.keuze.martini) { if (hud) hud.show(YUGO_TEKST.leeg, 3); return true; }
      bestel(); return true;
    }
    if (n === 5) { st.keuze.martini = (st.keuze.martini || 0) ? 0 : 1; werkTabletBij(); if (geluid && geluid.tikje) geluid.tikje(); return true; }
    const s = SUSHI[n - 1];
    if (!s) return false;
    if (sushiTeller() >= Y.maxSushi) { if (hud) hud.show(`Hoogstens ${Y.maxSushi} plankjes per ronde`, 2); return true; }
    st.keuze[s.id] = (st.keuze[s.id] || 0) + 1;
    werkTabletBij();
    return true;
  }
  // Johan bestelt altijd meer dan jij: vijf of zes plankjes, en een Pornstar Martini
  function johanKeuze() {
    const k = {};
    const n = Math.max(5, Math.min(6, sushiTeller() + 2));
    for (let i = 0; i < n; i++) { const s = SUSHI[(st.ronde + i) % SUSHI.length]; k[s.id] = (k[s.id] || 0) + 1; }
    k.martini = 1;
    return k;
  }
  function bestel(voorJou = false) {
    if (voorJou) { st.keuze = { [SUSHI[st.ronde % 4].id]: 1, [SUSHI[(st.ronde + 2) % 4].id]: 1 }; johanZegt(YUGO_TEKST.voorJou, 3.5); }
    st.jijBestelt = { ...st.keuze };
    st.johanBestelt = johanKeuze();
    st.besteldJij = sushiTeller();
    st.besteldJohan = SUSHI.reduce((n, s) => n + (st.johanBestelt[s.id] || 0), 0);
    st.fase = 'besteld'; st.t = 0; st.oberNa = tussen(Y.oberNa);
    werkTabletBij();
    if (!voorJou) johanZegt(YUGO_TEKST.johanBestelt[(st.ronde - 1) % YUGO_TEKST.johanBestelt.length], 6);
  }
  // de ober zet alles neer; de lege plankjes en glazen neemt hij mee
  function zetNeer() {
    ruimTafel(false);
    const zet = (kant, keuze) => {
      let i = st.borden.filter(b => b.userData.kant === kant).length;
      for (const s of SUSHI) for (let k = 0; k < (keuze[s.id] || 0); k++) {
        if (i >= 6) break;
        const p = maakPlankje(s.id);
        const q = plekOpTafel(kant, i++);
        p.position.set(q.x, T.hoog, q.z);
        p.userData.kant = kant;
        groep.add(p); st.borden.push(p);
      }
      if (keuze.martini) {
        const g = maakGlas();
        g.position.set(kant === 'jij' ? T.x + 0.30 : T.x + 0.42, T.hoog, kant === 'jij' ? T.z + 0.26 : T.z - 0.26);
        g.userData.kant = kant;
        groep.add(g); st.glazen.push(g);
      }
    };
    zet('jij', st.jijBestelt || {});
    zet('johan', st.johanBestelt || {});
  }
  function ruimTafel(alles) {
    for (const b of [...st.borden]) if (alles || !b.userData.stukken.some(s => s.visible)) { groep.remove(b); st.borden.splice(st.borden.indexOf(b), 1); }
    for (const g of [...st.glazen]) if (alles || g.userData.slokken >= Y.slokken) { groep.remove(g); st.glazen.splice(st.glazen.indexOf(g), 1); }
  }
  const over = (kant) => st.borden.filter(b => b.userData.kant === kant).reduce((n, b) => n + b.userData.stukken.filter(s => s.visible).length, 0);
  function volgendStuk(kant) {
    // van het dichtstbijzijnde plankje eerst, en daarop van links naar rechts
    for (const b of st.borden) if (b.userData.kant === kant) for (const s of b.userData.stukken) if (s.visible) return s;
    return null;
  }

  // E: met de stokjes een stuk pakken en opeten
  function eet() {
    if (!st.actief || st.stok.fase !== 'rust') return false;
    const s = volgendStuk('jij');
    if (!s && volgendeNu()) return true;
    if (!s) { if (hud) hud.show(st.fase === 'eten' ? 'Je bord is leeg' : 'Er staat nog niets op tafel', 1.5); return true; }
    st.stok = { fase: 'heen', t: 0, stuk: s, van: stokjes.position.clone() };
    return true;
  }
  /*
   (stap 212) Sneller door: met een leeg bord (na het eten of in de pauze) begint E meteen de volgende ronde. Johan eet zijn eigen
   plankjes gewoon verder leeg. Na de laatste ronde is het dan klaar.
  */
  const kanVolgende = () => st.actief && (st.fase === 'pauze' || (st.fase === 'eten' && over('jij') === 0 && st.stok.fase === 'rust'));
  function volgendeNu() {
    if (!kanVolgende()) return false;
    if (st.ronde >= Y.rondes) { st.fase = 'pauze'; st.t = st.pauze = 0; return true; }
    if (st.fase === 'eten') johanZegt(YUGO_TEKST.sneller[st.ronde % 2], 3);
    volgendeRonde();
    return true;
  }
  // Q: een slok van je cocktail
  function drink() {
    if (!st.actief) return false;
    const g = st.glazen.find(x => x.userData.kant === 'jij' && x.userData.slokken < Y.slokken);
    if (!g) { if (hud) hud.show('Je glas is leeg', 1.5); return true; }
    g.userData.slokken++;
    st.slokken++;
    const rest = 1 - g.userData.slokken / Y.slokken;
    g.userData.vul.scale.set(0.6 + 0.4 * rest, Math.max(0.02, rest), 0.6 + 0.4 * rest);
    g.userData.vul.position.y = 0.088 * (1 - Math.max(0.02, rest));
    g.userData.vrucht.visible = rest > 0.3;
    g.userData.vrucht.position.y = 0.124 - (1 - rest) * 0.03;
    if (geluid && geluid.slok) geluid.slok();
    player.health = Math.min(100, player.health + Y.slok); if (hud) hud.zetLeven(player.health);
    return true;
  }

  // waar de stokjes rusten: rechtsonder in beeld, schuin naar voren
  const STOK_RICHT = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(-0.36, -0.10, -0.93).normalize());
  const RUST = new THREE.Vector3(0.15, -0.16, -0.22), MOND = new THREE.Vector3(0.0, -0.05, -0.12);
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  function inCamera(v, uit) { return uit.copy(v).applyMatrix4(camera.matrixWorld); }
  function werkStokjesBij(dt) {
    const s = st.stok;
    camera.updateMatrixWorld();
    // de stokjes wijzen met hun punt (−y in het model) naar voren en omlaag
    // (de wortel rechtsonder, waar je hand zit; de punten schuin naar voren en iets naar links, zoals je ze vasthoudt)
    stokjes.quaternion.copy(camera.quaternion).multiply(STOK_RICHT);
    const rust = inCamera(RUST, tmp);
    if (s.fase === 'rust') { stokjes.position.copy(rust); return; }
    const S = Y.stokjes;
    s.t += dt;
    // het punt tussen de stokjes moet bij het stuk zijn: dat ligt 0,225 m langs de stokjes vanaf hun wortel
    const punt = new THREE.Vector3(0, -0.225, 0).applyQuaternion(stokjes.quaternion);
    if (s.fase === 'heen') {
      const doel = s.stuk.getWorldPosition(tmp2).add(new THREE.Vector3(0, 0.014, 0)).sub(punt);
      const f = Math.min(1, s.t / S.heen);
      stokjes.position.lerpVectors(s.van, doel, f * f * (3 - 2 * f));
      if (f >= 1) {
        // vast tussen de punten
        const vast = stokjes.userData.vast;
        s.ouder = s.stuk.parent; s.plek = s.stuk.position.clone();
        vast.add(s.stuk); s.stuk.position.set(0, -0.012, 0); s.stuk.rotation.set(0, 0, 0);
        s.fase = 'mond'; s.t = 0; s.van = stokjes.position.clone();
      }
    } else if (s.fase === 'mond') {
      const doel = inCamera(MOND, tmp2).sub(punt);
      const f = Math.min(1, s.t / S.mond);
      stokjes.position.lerpVectors(s.van, doel, f * f * (3 - 2 * f));
      if (f >= 1) {
        // op: het stuk gaat terug op zijn plankje, onzichtbaar (zo telt het plankje zijn stukken)
        s.stuk.visible = false; s.ouder.add(s.stuk); s.stuk.position.copy(s.plek);
        st.gegeten++;
        player.health = Math.min(100, player.health + Y.leven); if (hud) hud.zetLeven(player.health);
        if (geluid && geluid.hap) geluid.hap();
        s.fase = 'terug'; s.t = 0; s.van = stokjes.position.clone();
      }
    } else if (s.fase === 'terug') {
      const f = Math.min(1, s.t / S.terug);
      stokjes.position.lerpVectors(s.van, rust, f);
      if (f >= 1) st.stok = { fase: 'rust', t: 0, stuk: null, van: rust.clone() };
    }
  }
  // Johan eet: zijn arm gaat met een stuk tussen de stokjes naar zijn mond
  function werkJohanBij(dt) {
    let hap = 0;
    const h = st.johanHap;
    if (h) {
      h.t += dt;
      hap = Math.sin(Math.min(1, h.t / 1.1) * Math.PI);
      if (!h.op && h.t > 0.55) { h.op = true; h.stuk.visible = false; }
      if (h.t > 1.1) st.johanHap = null;
    } else if (['eten', 'pauze', 'besteld', 'ober'].includes(st.fase)) {
      st.johanT -= dt;
      if (st.johanT <= 0) {
        st.johanT = tussen(Y.johanHap);
        const s = volgendStuk('johan');
        if (s) st.johanHap = { t: 0, stuk: s, op: false };
      }
    }
    johan.update(dt, { zit: Y.zitting / 1.05 });
    eetArm(johan, johanStokjes, hap, Math.PI, h && !h.op ? h.stuk.userData.soort : null);
  }
  /*
   De rechterarm van iemand aan tafel, van het blad naar de mond (`hap` 0…1), met de stokjes in zijn hand en zolang `soort` een stuk
   sushi ertussen. `yaw` is zijn draaiing: de stokjes wijzen voor hem uit, omlaag.
  */
  const handPunt = new THREE.Vector3();
  function eetArm(p, stok, hap, yaw, soort) {
    p.armRechts.boven.rotation.x = 0.55 + hap * 0.75;
    p.armRechts.onder.rotation.x = 0.85 + hap * 1.15;
    p.groep.updateWorldMatrix(true, true);
    handPunt.set(0, -0.07, 0).applyMatrix4(p.armRechts.eind.matrixWorld);
    stok.position.copy(handPunt).sub(groep.position);
    stok.rotation.order = 'YXZ';
    stok.rotation.set(-0.9 - hap * 0.5, yaw - Math.PI, 0.3);
    const vast = stok.userData.vast;
    if (soort) { if (!vast.userData.stuk) { const k = maakStuk(soort); vast.add(k); vast.userData.stuk = k; } }
    else if (vast.userData.stuk) { vast.remove(vast.userData.stuk); vast.userData.stuk = null; }
  }
  // de gasten eten mee, elk in zijn eigen tempo
  function werkGastenBij(dt) {
    for (const g of gasten) {
      let hap = 0, soort = null;
      if (g.hap) {
        g.hap.t += dt;
        hap = Math.sin(Math.min(1, g.hap.t / 1.2) * Math.PI);
        if (!g.hap.op && g.hap.t > 0.6) { g.hap.op = true; g.hap.stuk.visible = false; }
        else if (!g.hap.op) soort = g.hap.stuk.userData.soort;
        if (g.hap.t > 1.2) g.hap = null;
      } else {
        g.hapT -= dt;
        const s = g.bord.userData.stukken.find(x => x.visible);
        if (!s) {
          // leeg: na een tijdje een vol plankje
          g.bijT += dt;
          if (g.bijT > 25) { g.bijT = 0; for (const x of g.bord.userData.stukken) x.visible = true; }
        } else if (g.hapT <= 0) { g.hapT = 4 + r() * 5; g.hap = { t: 0, stuk: s, op: false }; }
      }
      g.p.update(dt, { zit: g.zit });
      eetArm(g.p, g.stok, hap, g.yaw, soort);
    }
  }
  // de ober loopt het pad af, zet neer, en loopt terug
  function werkOberBij(dt) {
    const p = OBER_PAD;
    if (st.fase !== 'ober') { ober.groep.visible = false; return; }
    ober.groep.visible = true;
    // bij de tafel: even blijven staan en naar Johan kijken (hij zegt iets), dan terug
    if (st.oberWacht > 0) {
      st.oberWacht -= dt;
      ober.kijkNaar(johanPlek.x, johanPlek.z, dt);
      ober.update(dt, {});
      if (st.oberWacht <= 0) { st.oberHeen = false; dienblad.visible = false; }
      return;
    }
    const heen = st.oberHeen;
    const doelI = heen ? st.oberI + 1 : st.oberI - 1;
    const doel = p[doelI];
    if (!doel) { st.fase = 'eten'; st.t = 0; ober.groep.visible = false; return; }
    const pos = ober.groep.position;
    const dx = doel.x - pos.x, dz = doel.z - pos.z, d = Math.hypot(dx, dz);
    const stap = Y.oberLoop * dt;
    if (d <= stap) {
      pos.x = doel.x; pos.z = doel.z; st.oberI = doelI;
      if (heen && doelI === p.length - 1) {
        zetNeer();
        st.oberWacht = 2.2;
        const i = (st.ronde - 1) % YUGO_TEKST.ober.length;
        zeg([{ wie: 'Ober', tekst: YUGO_TEKST.ober[i] }, ...(YUGO_TEKST.oberJohan[i] ? [{ wie: 'Johan', tekst: YUGO_TEKST.oberJohan[i] }] : [])], { auto: 3 });
      } else if (!heen && doelI === 0) {
        ober.groep.visible = false;
        st.fase = 'eten'; st.t = 0;
      }
    } else {
      pos.x += dx / d * stap; pos.z += dz / d * stap;
      ober.draaiNaar(Math.atan2(-dx, -dz), dt, 6);
    }
    ober.update(dt, { loopt: true, snelheid: Y.oberLoop });
  }
  function update(dt) {
    if (!st.actief) return;
    st.t += dt;
    werkStokjesBij(dt);
    werkJohanBij(dt);
    werkOberBij(dt);
    werkGastenBij(dt);
    // de muziek
    if (geluid && geluid.yugoMuziek) geluid.yugoMuziek(dt, true);
    const balkVrij = !st.cb || !st.cb.balkVrij || st.cb.balkVrij();
    if (st.fase === 'bestellen') {
      st.tabletT += dt;
      if (!st.duwde && st.tabletT > Y.tabletDuw && balkVrij) { st.duwde = true; johanZegt(YUGO_TEKST.opjagen[st.ronde % 2]); }
      if (st.tabletT > Y.tabletMax) bestel(true);
    } else if (st.fase === 'besteld') {
      if (st.t > st.oberNa) {
        st.fase = 'ober'; st.oberI = 0; st.oberHeen = true; st.oberWacht = 0; dienblad.visible = true;
        ober.zetNeer(OBER_PAD[0].x, OBER_PAD[0].z, Math.PI / 2);
      }
    } else if (st.fase === 'eten') {
      const jij = over('jij'), hij = over('johan');
      if (jij + hij === 0 && !st.johanHap && st.stok.fase === 'rust') {
        st.fase = 'pauze'; st.t = 0; st.pauze = tussen(Y.pauze);
        if (st.ronde < Y.rondes) johanZegt(YUGO_TEKST.op[st.ronde % 2]);
      } else if (st.t > Y.eetMax && st.stok.fase === 'rust') {
        // te langzaam: Johan eet de rest op
        johanZegt(YUGO_TEKST.resteOp);
        for (const b of st.borden) for (const s of b.userData.stukken) s.visible = false;
        st.fase = 'pauze'; st.t = 0; st.pauze = tussen(Y.pauze);
      }
    } else if (st.fase === 'pauze') {
      if (st.t > st.pauze) {
        if (st.ronde >= Y.rondes) { st.fase = 'klaar'; st.t = 0; zeg(YUGO_TEKST.klaar.map(t => ({ wie: 'Johan', tekst: t })), { auto: 4 }); }
        else volgendeRonde();
      }
    } else if (st.fase === 'klaar') {
      if (st.t > 9 && balkVrij && st.cb && st.cb.klaar) { const k = st.cb.klaar; st.cb.klaar = null; k(); }
    }
    // Johan praat tussendoor, nooit twee keer hetzelfde vlak na elkaar
    if (st.fase !== 'klaar' && st.fase !== 'bestellen') {
      // (de tijd tussen twee gesprekken telt alleen als er niemand praat)
      if (balkVrij) st.praatT -= dt;
      if (st.praatT <= 0 && balkVrij) {
        st.praatT = tussen(Y.praat);
        const g = kiesGesprek();
        if (g) {
          st.gesprekken++;
          zeg(g.regels.map(([w, t]) => ({ wie: w === 'e' ? 'Erik' : 'Johan', tekst: t })), { auto: Y.regelTijd });
        }
      }
    }
    // (stap 212) de hint voor de volgende ronde
    st.hintT = (st.hintT || 0) - dt;
    if (kanVolgende() && st.hintT <= 0 && hud) { st.hintT = 1.2; hud.show(st.ronde >= Y.rondes ? 'E — afronden' : 'E — volgende ronde', 1.4); }
    werkTabletBij();
  }
  function eind() {
    st.actief = false; st.fase = ''; st.cb = null;
    ruimTafel(true);
    stokjes.visible = false;
    if (st.stok && st.stok.stuk && st.stok.ouder) { st.stok.ouder.add(st.stok.stuk); }
    johan.groep.visible = false; ober.groep.visible = false;
    for (const g of gasten) { g.p.groep.visible = false; g.bord.visible = false; g.stok.visible = false; g.hap = null; eetArm(g.p, g.stok, 0, g.yaw, null); }
    if (player.zit) { player.zit = false; player.eye = player.eyeStaand; }
    player.aanTafel = false;
    if (geluid && geluid.yugoMuziek) geluid.yugoMuziek(0, false);
    werkTabletBij();
  }

  function binnen(x, z) { return x > NUL.x - 3 && x < NUL.x + B + 3 && z > NUL.z - 3 && z < NUL.z + D + 3; }
  let terugPunt = null;
  return {
    // als binnenruimte (js/main.js): binnen is het wapen weg, de politie stil en klinkt het als een kamer
    binnen, toets: () => false, update: () => {}, winkels: [],
    kaart: (x, z) => (binnen(x, z) ? { naam: 'Yugo Sushi', punt: terugPunt } : null),
    zetTerug(p) { terugPunt = p; },
    begin, eind, kies, eet, drink, werkBij: update,
    get actief() { return st.actief; },
    get tabletOpen() { return st.actief && st.fase === 'bestellen'; },
    get kanVolgende() { return kanVolgende(); },
    // voor de proef: alle gesprekken, en welke het laatst kwam
    get gesprekken() { return ALLE_GESPREKKEN; },
    kiesGesprek,
    get keuzes() { return [...SUSHI.map(s => s.naam), DRANK.naam, 'bestellen']; },
    // voor de proef en de foto's
    get stand() {
      return { actief: st.actief, ronde: st.ronde, fase: st.fase, keuze: { ...st.keuze }, gegeten: st.gegeten, slokken: st.slokken,
        borden: st.borden.map(b => ({ kant: b.userData.kant, soort: b.userData.soort, over: b.userData.stukken.filter(s => s.visible).length })),
        glazen: st.glazen.map(g => ({ kant: g.userData.kant, slokken: g.userData.slokken })),
        jijBesteld: st.besteldJij, johanBesteld: st.besteldJohan, gesprekken: st.gesprekken, laatsteGesprek: st.laatsteGesprek, stok: st.stok ? st.stok.fase : null, over: { jij: over('jij'), johan: over('johan') } };
    },
    get plekken() { return { nul: NUL, tafel: wereld(T.x, T.z), stoel: wereld(jijStoel.x, jijStoel.z), johan: johanPlek, keuken: KEUKEN_W, pad: OBER_PAD }; },
    get maten() { return { ...YUGO, stoelen: stoelen.length, emmers: emmers.length, gasten: gasten.length }; },
    // voor de proef: de gasten, hun plankje en hoeveel ze op hebben
    get gasten() { return gasten.map(g => ({ x: g.p.groep.position.x, z: g.p.groep.position.z, yaw: g.yaw, zichtbaar: g.p.groep.visible, kind: g.kind, bord: g.bord, stok: g.stok, persoon: g.p, over: g.bord.userData.stukken.filter(x => x.visible).length, hapt: !!g.hap })); },
    get johan() { return johan; }, get ober() { return ober; }, get stokjes() { return stokjes; }, get groep() { return groep; },
    get tabletEl() { return tabletEl; },
  };
}
