// Kaartdata van de wijk Tinga (Sneek).
// Alle coördinaten zijn overgenomen uit de noord-georiënteerde satellietkaart
// (pixelcoördinaten, 3.26 px per meter). De oorsprong van de spelwereld ligt op
// het kruispunt Molenkrite / Monnikmolen / Jasker (het rode-klinkerplateau).
// Wereld: +X = oost, +Z = zuid, Y = hoogte (meters).

export const PX_PER_M = 3.26;
const OX = 370, OY = 1245;

export function toWorld(px, py) {
  return [(px - OX) / PX_PER_M, (py - OY) / PX_PER_M];
}

// Wegtypen: 'asfalt', 'klinker' (grijs), 'rood' (rode klinkers), 'fietspad', 'snelweg', 'pad'
// Elke weg: naam, type, breedte (m), punten (px), optioneel: parkeren (zijde 'L'/'R'/'LR')
export const ROADS = [
  // ---- Molenkrite ----
  { name: 'Molenkrite', type: 'klinker', w: 5.6, verge: 2.6, walk: 'LR',
    pts: [[370,1245],[450,1190],[500,1140],[550,1090]] },
  { name: 'Molenkrite', type: 'klinker', w: 5.6, verge: 2.8, walk: 'LR', bays: 'LR',
    pts: [[550,1090],[600,1045],[650,1005],[688,980],[788,972],[888,972],[988,975],[1088,990],[1183,1000]] },
  { name: 'Molenkrite', type: 'klinker', w: 5.6, verge: 2.6, walk: 'LR',
    pts: [[370,1245],[355,1290],[340,1350],[322,1400],[310,1440],[305,1460]] },
  { name: 'Molenkrite', type: 'klinker', w: 5.4, verge: 2.6, walk: 'LR', bays: 'R',
    pts: [[305,1460],[302,1520],[300,1600],[300,1650],[300,1690],[310,1730],[340,1780],[380,1830],[430,1880],[480,1915],[505,1935]] },
  { name: 'Molenkrite', type: 'klinker', w: 5.2, verge: 3.0, walk: 'LR',
    pts: [[505,1935],[560,1980],[620,2010],[700,2060],[740,2100],[790,2150],[830,2200]] },

  // ---- Monnikmolen ----
  { name: 'Monnikmolen', type: 'klinker', w: 5.2, verge: 2.6, walk: 'LR', bays: 'R',
    pts: [[370,1245],[345,1210],[320,1160],[300,1110],[285,1060],[265,1000],[250,955],[243,935]] },
  { name: 'Monnikmolen', type: 'klinker', w: 5.2, verge: 2.6, walk: 'LR', bays: 'LR',
    pts: [[243,935],[300,898],[350,865],[400,832],[450,800],[500,768],[560,725],[612,695]] },
  { name: 'Monnikmolen', type: 'klinker', w: 5.2, verge: 2.6, walk: 'LR',
    pts: [[612,695],[700,735],[800,795],[888,840]] },
  { name: 'Monnikmolen', type: 'klinker', w: 4.6, verge: 2.2, walk: 'LR', bays: 'LR',
    pts: [[888,840],[1000,845],[1068,850]] },
  // binnenweg Monnikmolen (parkeerhof) + Binnenroede
  { name: 'Monnikmolen', type: 'klinker', w: 4.4, verge: 2.0, walk: 'LR', bays: 'LR',
    pts: [[500,768],[560,830],[600,880],[630,960],[665,1000]] },
  { name: 'Binnenroede', type: 'klinker', w: 4.4, verge: 2.2, walk: 'LR',
    pts: [[307,1075],[440,990],[600,880]] },

  // ---- Verbindingen noord ----
  { name: 'Monnikmolen', type: 'klinker', w: 5.0, verge: 2.4, walk: 'LR',
    pts: [[612,695],[618,600],[628,500],[645,445],[660,395]] },
  { name: 'Buitenroede', type: 'asfalt', w: 6.0, verge: 3.2, walk: 'LR',
    pts: [[-200,510],[-50,470],[100,440],[250,410],[350,395],[430,370],[508,357],[600,360],[660,395],[720,435],[790,470],[880,505],[1000,565],[1100,640],[1150,680],[1178,710]] },
  { name: 'Buitenroede', type: 'asfalt', w: 6.0, verge: 3.2, walk: 'LR',
    pts: [[1178,710],[1183,760],[1183,850],[1183,930],[1183,1000],[1183,1100],[1183,1250],[1178,1270],[1163,1370],[1163,1435],[1160,1548]] },
  { name: 'Afrit 21', type: 'asfalt', w: 6.0, verge: 0, walk: '',
    pts: [[508,357],[540,300],[590,240],[650,200]] },

  // ---- Kruirad ----
  { name: 'Kruirad', type: 'klinker', w: 4.6, verge: 2.2, walk: 'LR', bays: 'R',
    pts: [[243,935],[160,978],[75,1020]] },
  { name: 'Kruirad', type: 'klinker', w: 4.6, verge: 2.2, walk: 'LR', bays: 'L',
    pts: [[75,1020],[85,1080],[100,1130],[115,1170],[140,1198]] },
  { name: 'Kruirad', type: 'klinker', w: 4.6, verge: 2.2, walk: 'LR', bays: 'L',
    pts: [[140,1198],[200,1205],[260,1188],[320,1165]] },
  { name: 'Fietspad', type: 'fietspad', w: 2.4, verge: 0, walk: '',
    pts: [[75,1020],[0,930],[-60,860],[-120,790],[-160,700],[-180,620]] },

  // ---- Molenpaal + verbinding Monnikmolen -> Jasker ----
  { name: 'Molenpaal', type: 'klinker', w: 4.6, verge: 2.2, walk: 'LR',
    pts: [[888,840],[886,972],[883,1135]] },
  { name: 'Molenpaal', type: 'klinker', w: 4.6, verge: 2.2, walk: 'LR', bays: 'L',
    pts: [[883,1135],[838,1160],[773,1215],[700,1285],[628,1350],[575,1400]] },
  { name: 'Spinnekop', type: 'klinker', w: 4.4, verge: 2.0, walk: 'LR',
    pts: [[883,1135],[886,1240],[888,1335],[888,1487]] },

  // ---- Jasker ----
  { name: 'Jasker', type: 'klinker', w: 5.0, verge: 2.6, walk: 'LR', bays: 'R',
    pts: [[370,1245],[400,1275],[450,1320],[500,1370],[560,1420],[600,1470],[625,1492]] },
  { name: 'Jasker', type: 'klinker', w: 5.0, verge: 2.6, walk: 'LR', bays: 'LR',
    pts: [[625,1492],[750,1487],[888,1487],[988,1497],[1088,1525],[1160,1548],[1206,1565],[1260,1590]] },
  { name: 'Jasker', type: 'klinker', w: 4.4, verge: 2.0, walk: 'LR', bays: 'R',
    pts: [[712,1490],[715,1580],[718,1673]] },
  { name: 'Jasker', type: 'klinker', w: 4.4, verge: 2.0, walk: 'LR', bays: 'L',
    pts: [[943,1490],[946,1600],[948,1728]] },
  { name: 'Spinnekop', type: 'klinker', w: 4.4, verge: 2.0, walk: 'LR',
    pts: [[700,1492],[720,1440],[745,1380],[765,1340],[800,1335],[888,1335],[1000,1340],[1038,1345],[1060,1380]] },
  { name: 'Omloop', type: 'klinker', w: 4.6, verge: 2.2, walk: 'LR',
    pts: [[1160,1548],[1180,1580],[1176,1640],[1160,1700],[1178,1763],[1170,1830],[1188,1890],[1183,2000],[1183,2140]] },

  // ---- De Wieken / Bovenas / Windbord / Voorzoom ----
  { name: 'De Wieken', type: 'rood', w: 4.8, verge: 2.4, walk: 'LR', bays: 'L',
    pts: [[-215,880],[-210,950],[-204,1000],[-195,1060],[-175,1130],[-145,1185]] },
  { name: 'De Wieken', type: 'klinker', w: 4.8, verge: 2.4, walk: 'LR', bays: 'R',
    pts: [[-145,1185],[-105,1240],[-60,1290],[-10,1345],[20,1355],[50,1380],[100,1420],[150,1440],[230,1450],[305,1460]] },
  { name: 'De Wieken', type: 'klinker', w: 4.8, verge: 2.4, walk: 'LR',
    pts: [[305,1460],[380,1465],[480,1462],[560,1465],[595,1470]] },
  { name: 'Bovenas', type: 'klinker', w: 4.8, verge: 2.4, walk: 'LR', bays: 'R',
    pts: [[105,1450],[112,1500],[110,1550],[100,1600],[85,1650],[60,1700],[30,1740],[0,1770],[-40,1800]] },
  { name: 'Windbord', type: 'klinker', w: 4.2, verge: 2.0, walk: 'LR',
    pts: [[-10,1345],[-18,1380],[-25,1430],[-35,1480],[-45,1530]] },
  { name: 'Voorzoom', type: 'klinker', w: 4.2, verge: 2.0, walk: 'LR',
    pts: [[-175,1130],[-240,1120],[-310,1112],[-380,1108]] },

  // ---- Bonkelaar ----
  { name: 'Grootwiel', type: 'klinker', w: 4.6, verge: 2.4, walk: 'LR', bays: 'L',
    pts: [[500,1480],[500,1560],[500,1640],[540,1690],[600,1750]] },
  { name: 'Bonkelaar', type: 'rood', w: 4.8, verge: 3.2, walk: 'LR', bays: 'R',
    pts: [[600,1750],[650,1785],[700,1800],[800,1810],[890,1810],[950,1812],[990,1830],[1010,1880],[1010,1950],[990,2000],[950,2050],[900,2100],[860,2150]] },
  { name: 'Bonkelaar', type: 'klinker', w: 4.8, verge: 3.0, walk: 'LR',
    pts: [[600,1750],[560,1810],[530,1860],[505,1935],[470,1975],[440,2030],[400,2100],[380,2150]] },

  // ---- Paden / park ----
  { name: 'Tinga Parkje', type: 'pad', w: 2.2, verge: 0, walk: '',
    pts: [[508,357],[430,420],[350,490],[270,570],[200,650],[120,730],[40,770],[-40,800],[-120,830],[-180,860]] },
  { name: 'Fietspad', type: 'fietspad', w: 2.4, verge: 0, walk: '',
    pts: [[330,1330],[400,1380],[470,1425],[560,1462]] },
  { name: 'Voetpad', type: 'pad', w: 1.6, verge: 0, walk: '',
    pts: [[345,1300],[420,1440]] },
];

// De N7 (rijksweg) ten noorden van de wijk, met afrit 21 Sneek.
export const HIGHWAY = {
  name: 'N7', w: 17, pts: [[-400,60],[0,170],[400,280],[700,365],[1000,450],[1300,535]],
};

// Water: polygonen (px). Vijvers en sloten.
export const WATER = [
  // Vijver langs De Wieken (Tinga Parkje-zuid)
  [[-150,870],[-90,880],[-55,930],[-45,1000],[-50,1080],[-70,1160],[-110,1220],[-150,1215],[-170,1150],[-175,1040],[-170,950]],
  // Sloot noord langs het park
  [[-190,880],[0,845],[150,750],[320,625],[450,548],[520,490],[532,505],[462,562],[332,640],[162,765],[8,862],[-188,896]],
  // Sloot langs Bonkelaar (noordzijde)
  [[520,1725],[700,1758],[900,1770],[965,1790],[963,1802],[898,1783],[698,1772],[518,1739]],
  // Vijver in het parkje tegenover De Wieken, met de achtertuinen van Kruirad erachter
  [[-32,1178],[10,1210],[38,1252],[44,1288],[6,1298],[-22,1262],[-44,1218],[-46,1192]],
  // Vijvertje in de groene driehoek bij Jasker
  [[430,1395],[470,1390],[490,1420],[470,1445],[435,1440],[420,1418]],
  // Sloot oostzijde (bij De Spil)
  [[1120,1050],[1150,1080],[1160,1180],[1150,1300],[1140,1300],[1150,1180],[1138,1085],[1110,1058]],
  // De Geau (kanaal) ver westelijk
  [[-700,300],[-600,300],[-560,2200],[-660,2200]],
];

// Bosschages / bomenrijen (px polygons) – dichte bomen
export const WOODS = [
  [[-140,860],[-40,870],[-30,1000],[-40,1100],[-60,1200],[-90,1260],[-140,1240],[-180,1180],[-185,1000],[-170,900]],  // rond de vijver De Wieken
  [[-190,600],[520,340],[560,400],[100,720],[-40,780],[-180,820]], // Tinga Parkje noord
  [[335,1295],[560,1455],[330,1450]], // groene driehoek Jasker
  [[520,1700],[960,1770],[960,1790],[520,1735]], // bomen langs Bonkelaar-sloot
  [[1080,1000],[1230,1000],[1230,1400],[1090,1420]], // groen oostzijde
];

// Grasvelden (px polygons) – extra open gras
export const GRASS = [
  [[760,1365],[880,1365],[880,1470],[760,1470]], // speelveld Spinnekop
  [[1030,1000],[1170,1005],[1170,1150],[1040,1140]], // braakliggend / De Spil
];

// Parkjes met gemaaid gras, een slingerend tegelpad, bomen, struiken en bankjes.
export const PARKS = [
  {
    name: 'Parkje De Wieken',
    poly: [[-122,1160],[-58,1112],[18,1188],[62,1262],[70,1300],[14,1330],[-40,1288]],
    path: [[-116,1186],[-88,1214],[-56,1244],[-22,1272],[8,1300],[26,1318]],
    benches: [[-92,1206],[-18,1266]],
    trees: 26, shrubs: 22,
  },
  {
    name: 'Groene driehoek Jasker',
    poly: [[338,1300],[540,1452],[336,1450]],
    path: [[344,1318],[400,1372],[452,1420],[510,1446]],
    benches: [[398,1400]],
    trees: 18, shrubs: 14,
  },
];

// Speeltuin
export const PLAYGROUND = { at: [825,1418] };

/*
 Huizenrijen. R(ax,ay,bx,by, off, depth, type, opts)
 - a→b is de richting van de weg waar de rij aan ligt (px).
 - off (m): afstand van de wegas tot de voorgevel, positief = linkerzijde van a→b
   (links = (dy,-dx) in kaartcoördinaten).
 - Het huis strekt zich vanaf de voorgevel verder naar links uit (depth m);
   de voorgevel kijkt dus naar rechts, richting de weg.
 Typen: molenkrite, monnik, kruirad, molenpaal, jasker_flat, jasker_gable, wieken_white,
        wieken_yellow, bonkelaar (twee-onder-een-kap), detached (vrijstaand), appart (3 lagen), spil
*/
export const ROWS = [];
function R(ax, ay, bx, by, off, depth, type, opts = {}) {
  ROWS.push({ a: [ax, ay], b: [bx, by], off, depth, type, ...opts });
}

// ===== Monnikmolen (rijenweg N1 -> MJ), links (+) = noordwest =====
R(262,923, 455,798,  13, 9, 'molenkrite');                 // noordzijde aan de straat
R(480,781, 596,706,  13, 9, 'molenkrite');
R(262,923, 455,798,  56, 9, 'monnik', { flip: true });     // tweede rij, rug aan rug, gevel naar het hof
R(480,781, 596,706,  56, 9, 'monnik', { flip: true });
R(280,912, 560,729,  71, 9, 'monnik');                     // derde rij, gevel naar het hof
R(262,923, 455,798, -13, 9, 'molenkrite');                 // zuidzijde aan de straat
R(480,781, 596,706, -13, 9, 'molenkrite');
R(307,1075, 600,880, -13, 9, 'molenkrite');               // zuidoostzijde Binnenroede

// ===== Molenkrite noord (P -> 688,980), links (+) = noordwest =====
R(400,1220, 645,1015,  12, 9, 'molenkrite');               // NW-zijde
R(400,1220, 645,1015, -12, 9, 'molenkrite');               // ZO-zijde (rij met dakkapellen)
R(418,1206, 660,1002, -38, 9, 'molenkrite', { flip: true }); // achterliggende rij, gevel naar het hofpad
R(838,1160, 628,1350, -13, 9, 'molenpaal');                 // Molenpaal noordwestzijde (gele steen)
// Molenkrite oost-west (688,980 -> 1183,1000), links (+) = noord
// Molenkrite oost-west: zuidzijde (rechterkant) doorlopende rijen
R(700,975, 862,972, -12, 9, 'molenkrite');
R(878,972, 1040,978, -12, 9, 'molenkrite');
R(1056,982, 1170,996, -12, 9, 'jasker_gable');
// Molenkrite oost-west: noordzijde
R(700,975, 862,972,  12, 9, 'monnik');
R(878,972, 1040,978,  10, 8, 'monnik');
// tweede rij aan de noordkant, gevel naar de doodlopende Monnikmolen
R(900,842, 1050,850, -10, 8, 'monnik');
R(950,655, 1000,800,  12, 9, 'monnik');                    // rijen noord van de stub
R(950,655, 1000,800, -12, 9, 'monnik');
R(1183,930, 1183,850, 14, 14, 'spil', { label: 'Stichting Jeugdhulp Friesland', storeys: 2 });

// ===== Monnikmolen noord-zuid (N1 -> P), links (+) = oost =====
R(255,985, 300,1110, 13, 9, 'monnik');

// ===== Kruirad =====
R(243,935, 75,1020, -13, 9, 'kruirad');    // noordwestzijde Kruirad-noord
R(243,935, 75,1020,  13, 9, 'kruirad');    // binnenzijde
R(75,1020, 140,1198, -13, 9, 'kruirad');   // westzijde Kruirad-west
R(170,1192, 290,1170, 13, 9, 'kruirad');   // binnenzijde Kruirad-zuid
R(140,1198, 320,1165, -13, 9, 'kruirad');  // zuidzijde Kruirad-zuid

// ===== Jasker oost-west, links (+) = noord =====
R(640,1487, 680,1487,  13, 9, 'jasker_flat');
R(760,1487, 875,1487,  13, 9, 'jasker_flat');
R(905,1490, 1075,1520, 13, 9, 'jasker_gable');
R(635,1490, 695,1490, -13, 9, 'jasker_gable');
R(800,1490, 880,1498, -13, 9, 'jasker_gable');
R(1010,1503, 1085,1523, -13, 9, 'jasker_flat');
// doodlopende stukken
R(712,1520, 718,1665, -11, 9, 'jasker_flat');
R(712,1520, 718,1665,  11, 9, 'jasker_flat');
R(943,1525, 948,1715, -11, 9, 'jasker_gable');
R(943,1525, 948,1715,  11, 9, 'jasker_gable');
// Spinnekop
R(830,1336, 1030,1345,  12, 9, 'jasker_flat');
R(900,1338, 1030,1345, -12, 9, 'jasker_flat');
R(725,1440, 765,1340,  12, 9, 'jasker_gable');
// Molenpaal zuidoostzijde: vrijstaande woningen (incl. hoekwoning Jasker)
R(770,1218, 710,1272, 13, 11, 'detached');   // hoekwoning Molenpaal/Jasker

// ===== Wijkvereniging De Spil =====
R(1010,1240, 1090,1240, 8, 18, 'spil', { label: 'Wijkvereniging De Spil', storeys: 1 });

// ===== De Wieken =====
R(-215,900, -180,1100, -13, 9, 'wieken_white');   // noord-zuid deel, westzijde
R(-145,1185, -10,1345, -13, 9, 'wieken_white');   // zuidoost lopend deel, zuidwestzijde
R(50,1380, 100,1420,   -13, 9, 'wieken_yellow');  // bungalows
// Voorzoom
R(-200,1127, -370,1109,  12, 9, 'wieken_white');
R(-300,1116, -370,1109, -12, 9, 'wieken_yellow');
// Windbord
R(-12,1360, -45,1530, -11, 9, 'wieken_white');
R(-14,1372, -45,1528,  11, 9, 'wieken_yellow');

// ===== Bovenas =====
R(104,1545, 60,1700, -12, 14, 'appart', { storeys: 3 });
// blok tussen Bovenas en Molenkrite-zuid: oost-west rijen
R(150,1447, 255,1455, -13, 9, 'molenkrite');
R(150,1447, 255,1455, -53, 9, 'molenkrite', { flip: true });
R(150,1447, 255,1455, -75, 9, 'molenkrite');
// oostzijde Molenkrite-zuid en Bonkelaar-verbinding
R(305,1480, 300,1640,  13, 9, 'molenkrite');
R(390,1463, 470,1464, -13, 9, 'molenkrite');
R(500,1500, 500,1640, -13, 9, 'kruirad');
R(500,1500, 500,1640,  13, 9, 'jasker_gable');
R(600,1560, 600,1700,   2, 9, 'jasker_flat');

// ===== Bonkelaar =====
R(700,1800, 950,1812, -14, 10, 'bonkelaar');            // zuidzijde twee-onder-een-kap
R(585,1780, 540,1870, 14, 10, 'bonkelaar');             // langs de zuidwestelijke tak
R(590,1770, 545,1860, -14, 11, 'detached');
R(340,1780, 480,1915, -14, 11, 'detached');             // Molenkrite-bocht
R(340,1780, 430,1880,  16, 10, 'bonkelaar');
R(540,1960, 730,2095, -14, 10, 'bonkelaar');            // Molenkrite richting Alliade
R(600,2000, 730,2095,  14, 11, 'detached');

// ===== Omloop =====
R(1175,1720, 1178,1590, 12, 9, 'jasker_gable');


// ===== Ontbrekende straatzijden: in Tinga staan vrijwel overal huizen aan beide kanten =====
// Binnenroede noordwestzijde
R(307,1075, 600,880,  13, 9, 'monnik');
// Monnikmolen noord-zuid, westzijde (naar het Kruirad-hof)
R(255,985, 300,1110, -13, 9, 'kruirad');
// Kruirad west, binnenzijde van de lus
R(75,1020, 140,1198,  13, 9, 'kruirad');
// Molenpaal zuidoostzijde
R(830,1168, 668,1315,  13, 9, 'jasker_gable');
// Molenkrite noordwesttak: vierde rij richting Binnenroede

// De Wieken: beide zijden over de volle lengte
R(-145,1185, -18,1338,  13, 9, 'wieken_yellow');   // noordoostzijde schuine deel
R(30,1362, 245,1452,    13, 9, 'wieken_white');    // noordzijde oost-westdeel
// Voorzoom en Windbord over de volle lengte
R(-190,1128, -372,1110, -12, 9, 'wieken_yellow');
// Bovenas oostzijde
R(108,1500, 55,1712,    12, 9, 'wieken_yellow');
R(30,1740, -38,1798,    12, 9, 'wieken_white');

// Molenkrite zuid: rijen aan weerszijden
R(303,1500, 300,1660,  -13, 9, 'molenkrite');
R(310,1700, 372,1822,   13, 9, 'kruirad');
R(310,1700, 372,1822,  -13, 9, 'kruirad');
// Grootwiel: extra rij aan de oostkant
R(514,1660, 560,1728,   13, 9, 'jasker_flat');

// Jasker: ontbrekende zijden
R(1080,1522, 1160,1545, 13, 9, 'jasker_flat');
R(1080,1522, 1160,1545, -13, 9, 'jasker_gable');
// Jasker diagonaal (kruispunt -> oost), zuidwestzijde
R(600,1470, 470,1340,  -14, 9, 'molenkrite');
// Spinnekop zuidzijde bij de noordtak
R(725,1440, 765,1340,  -12, 9, 'jasker_gable');

// Omloop westzijde
R(1175,1720, 1178,1590, -12, 9, 'jasker_flat');
R(1183,1900, 1183,2060,  12, 9, 'jasker_gable');
R(1183,1900, 1183,2060, -12, 9, 'jasker_gable');

// Bonkelaar zuidzijde over de volle lengte (noordzijde is sloot met bomen)
R(660,1790, 700,1798,  -14, 10, 'bonkelaar');

// ===== Alliade Tinga State: zorgcomplex ten oosten van Molenkrite =====
R(1285,1130, 1285,1060, -10, 22, 'spil', { label: 'Tinga State', storeys: 3 });
R(1285,1250, 1285,1180, -10, 22, 'spil', { storeys: 3 });

// Parkeerhoven (px rechthoeken: center, breedte m, lengte m, hoek rad) worden afgeleid uit wegen met parking.
// Extra losse parkeerhoven:
export const PARKING_LOTS = [
  { at: [190,1105], w: 12, l: 40, angle: -0.55 },  // binnenhof Kruirad
  { at: [520,830],  w: 10, l: 28, angle: 0.55 },   // hof Monnikmolen
  { at: [1050,1220], w: 12, l: 24, angle: 0 },     // De Spil
];

// Speler startpositie (px) en kijkrichting (rad): op Molenkrite bij het kruispunt
export const START = { at: [405,1222], yaw: -0.88 };
