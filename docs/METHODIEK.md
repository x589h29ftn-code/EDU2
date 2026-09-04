# Methodiek: Tinga waterdicht nabouwen

Dit document beschrijft hoe de wijk Tinga (Sneek) zó in het spel komt dat elke
straat, elk huis en elke boom op de juiste plek staat, controleerbaar en zonder
dat er nog naar foto's geraden hoeft te worden. Het is de leidraad voor alle
verdere werk aan de kaart; de code volgt dit document, niet andersom.

## 1. Waarom het tot nu toe misging

De huidige kaart (`js/data.js`) is met de hand overgetypt uit één schermafbeelding
van de satellietkaart, in pixels (3,26 px per meter), en daarna bijgesteld aan de
hand van Street View-foto's. Dat gaat op drie punten structureel mis:

1. **Een foto is geen meetinstrument.** Perspectief, onbekende brandpuntsafstand,
   geen schaal. Een schatting van "de groenstrook is hier twaalf meter" kan er zes
   meter naast zitten. Elke correctie op basis van een foto verschuift iets anders,
   en dat zie je terug in de commitgeschiedenis (blokken die niet aansluiten, zijden
   die verwisseld zijn, rijen die herhaaldelijk verzet worden).
2. **Claude kan geen coördinaten uit een plaatje lezen.** Uit een kaartafbeelding
   posities schatten is voor een taalmodel raden met een onbekende fout. Uit een
   tabel met coördinaten rekenen gaat daarentegen foutloos. Zolang de invoer een
   plaatje is, blijft de uitvoer een benadering.
3. **Pixels zonder georeferentie zijn een doodlopende weg.** De kaart is niet uit te
   breiden met een andere bron, niet te toetsen aan de werkelijkheid en niet
   herleidbaar naar een adres.

De oplossing is niet meer foto's, maar een andere bron: de Nederlandse overheid
publiceert de complete wijk als vectordata, gratis, op centimeters nauwkeurig,
inclusief elke stoeptegel-rand, parkeervak, lantaarnpaal en boom.

## 2. De vijf regels

1. **Geometrie komt uit vectordata, nooit uit foto's.** Wegen, stoepen,
   parkeervakken, water, gras, bomen, lantaarnpalen, panden en dakvormen komen uit
   BGT, BAG en 3D BAG (zie §3). Foto's mogen alleen zeggen *hoe iets eruitziet*
   (steenkleur, kozijnkleur, dakpannen), nooit *waar het staat* of *hoe groot het is*.
2. **Eén coördinatenstelsel: RD New (EPSG:28992), in meters.** De spelwereld is RD
   verschoven naar een lokale oorsprong (`x = X − X0`, `z = Y0 − Y`). Geen pixels,
   geen schaalfactoren. Elk punt in het spel is met `tools/geo/rd.mjs` om te rekenen
   naar een plek op Google Maps en terug.
3. **Alles is gegenereerd.** Brondata staat in `data/geo/`, de generator in
   `tools/geo/`, de uitkomst is een gegenereerd kaartbestand dat je nooit met de
   hand bewerkt. Handmatige afwijkingen gaan in een apart overrides-bestand of via de
   editor (`rows.user.js`), zodat opnieuw genereren nooit handwerk weggooit.
4. **Elke stap heeft een machinale controle.** Tellingen (evenveel huizen als panden),
   botsingstests, en een bovenaanzicht van het spel dat als laag over de luchtfoto
   gelegd wordt. Een afwijking van een paar meter is dan direct zichtbaar, zonder
   discussie.
5. **Kleine stappen, elk af.** Eerst ondergrond (wegen, water, groen), dan panden, dan
   inrichting, dan stijl. Een stap is pas klaar als de controle van die stap groen is.

## 3. De bronnen

Alle bronnen zijn open data en gratis. Ze worden binnengehaald met **QGIS**
(gratis, Windows) en als GeoJSON in EPSG:28992 in `data/geo/bron/` gezet. Wat er
precies in welk bestand hoort staat in `data/geo/README.md`.

| Bron | Wat het levert voor het spel | Waar |
|---|---|---|
| **BGT** (Basisregistratie Grootschalige Topografie) | De complete inrichting van de openbare ruimte als vlakken en punten: rijbaan (met verharding: asfalt of klinkers), voetpad, fietspad, parkeervlak, inrit, berm, gras, plantsoen, bosplantsoen, water, oever, erf, pand-grondvlak, schuur/overkapping, losse bomen, hagen, lichtmasten, verkeersbordpalen, afvalbakken, banken, speeltoestellen, hekken, muren, bruggen, duikers, drempels, en de straatnaam op de plek waar hij hoort. Nauwkeurigheid 20–30 cm. | PDOK, BGT Download API met eigen polygoon: `https://api.pdok.nl/lv/bgt/download/v1_0/ui/`. In QGIS via de plug-in **BGT Import** (zet het gedownloade zip-bestand om in een GeoPackage met een laag per objecttype) of **BGT Downloader** (haalt de lagen direct op via de OGC API). |
| **BAG** (Basisregistratie Adressen en Gebouwen) | Per pand: identificatie, bouwjaar, status. Per verblijfsobject: huisnummer, straatnaam, gebruiksdoel. Hiermee krijgt elk huis zijn echte adres ("19 Molenkrite") en kan de stijl per bouwjaar of per straat gekozen worden. | PDOK, via de QGIS-plug-in **PDOK Services** (BAG WFS: lagen `pand` en `verblijfsobject`) of de OGC API Features van de BAG. |
| **3D BAG** (TU Delft) | Per pand: daktype (`b3_dak_type`: slanted, horizontal, multiple horizontal), maaiveldhoogte (`b3_h_maaiveld`), goot- en nokhoogte (`b3_h_dak_min`, `b3_h_dak_50p`, `b3_h_dak_max`) en een compleet 3D-model van het dak (LoD 2.2). Geen giswerk meer over bungalow of twee lagen, zadeldak of plat dak. | `https://3dbag.nl/en/download`: kies de tegel(s) boven Tinga, download als GeoPackage (attributen plus 2D-vlakken) en CityJSON (het 3D-model). |
| **Luchtfoto 8 cm** (Beeldmateriaal Nederland) | Alleen voor controle en textuurreferentie: kleur van bestrating, waar het gras kaal is, hoe dicht het bosje is. Niet voor geometrie. | PDOK WMTS `https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0` (laag "Actueel_orthoHR"). In QGIS als achtergrond; een uitsnede exporteren als GeoTIFF voor het bovenaanzicht-overlay. Licentie CC-BY. |
| **CBS Wijken en Buurten** | De officiële buurtgrens van Tinga; met een buffer van 150 m wordt dat het werkgebied. | PDOK WFS "CBS Wijken en Buurten" (buurtnaam `Tinga`, gemeente Súdwest-Fryslân). |
| **AHN** (Actueel Hoogtebestand) | Optioneel. Sneek is vlak; alleen het talud van de N7 en de afrit hebben hoogteverschil. Voor fase 1 volstaat een vlakke wereld met de maaiveldhoogte uit 3D BAG. | PDOK, AHN4 DTM 0,5 m. |
| **Street View, Mapillary, eigen foto's** | Uitsluitend voor de stijlcatalogus (§5, stap 6): steen- en kozijnkleur, dakpannen, dakkapellen, hekjes. | Geen download; je legt het antwoord per straat vast in `data/stijl/straten.json`. |

Wat Google Maps/Street View hier **niet** meer doet: afstanden, breedtes,
posities, hoeveelheden.

## 4. Coördinaten en oorsprong

- RD New (EPSG:28992) is het Nederlandse stelsel in meters. Tinga ligt rond
  X ≈ 171–173 km, Y ≈ 559–561 km; `node tools/geo/rd.mjs wgs <lat> <lon>` rekent
  een Google Maps-punt om.
- De oorsprong van de spelwereld blijft het kruispunt Molenkrite / Monnikmolen /
  Jasker. Zijn RD-coördinaten komen in `data/geo/oorsprong.json` (niet uit een
  foto, maar als middelpunt van het BGT-wegdeel van dat kruispunt, of desnoods
  via rechtsklik → coördinaten kopiëren in Google Maps, omgerekend met `rd.mjs`).
- Spelwereld: `x = X − X0` (oost), `z = Y0 − Y` (zuid), `y` = hoogte boven maaiveld.
  Dit is dezelfde oriëntatie als de huidige `data.js`, alleen zonder pixels.
- **De oude pixelkaart is om te rekenen.** Zet in `oorsprong.json` drie of meer
  ijkpunten (kruispunten die je in de oude kaart in pixels kent én in RD kunt
  aanwijzen). `node tools/geo/rd.mjs px 600 1045` geeft dan de RD-positie en de
  restfout van de fit. Zo kunnen `rows.user.js` en de geplaatste objecten
  meeverhuizen en zie je meteen hoeveel de oude kaart ernaast zat.

## 5. Stap voor stap

Elke stap eindigt met een controle. Pas als die groen is, begint de volgende.

### Stap 1 — Gebied en oorsprong vastleggen (één uur)

1. QGIS installeren, plug-ins **PDOK Services**, **BGT Import** (of BGT Downloader).
2. Laag CBS Wijken en Buurten laden, buurt Tinga selecteren, buffer 150 m,
   opslaan als `data/geo/gebied.geojson` (EPSG:28992).
3. Kruispuntcoördinaat bepalen en `data/geo/oorsprong.json` invullen
   (voorbeeld: `data/geo/oorsprong.voorbeeld.json`), inclusief drie ijkpunten
   voor de oude pixelkaart.
4. Controle: `node tools/geo/controle.mjs` toont het gebied in meters en het
   middelpunt als WGS84-coördinaat; plak dat in Google Maps en kijk of je midden in
   Tinga uitkomt.

### Stap 2 — Brondata downloaden en in de repo zetten (één avond)

1. BGT downloaden met het gebied als polygoon, alle objecttypen, en per type als
   GeoJSON in EPSG:28992 exporteren naar `data/geo/bron/bgt_<type>.geojson`.
2. BAG `pand` en `verblijfsobject` voor het gebied, idem.
3. 3D BAG-tegel(s) downloaden; de GeoPackage-laag `pand` (LoD 2.2-attributen)
   knippen op het gebied en exporteren als `bag3d_pand.geojson`; het CityJSON-bestand
   ongeknipt bewaren als `data/geo/bron/bag3d_tegel.city.json`.
4. Luchtfoto-uitsnede van het gebied als `data/geo/bron/luchtfoto.tif` (GeoTIFF,
   EPSG:28992). Dit is het enige rasterbestand; de rest is vector.
5. Alles committen. Een wijk is een paar megabyte; dat hoort in de repo, want
   zonder brondata is het spel niet te regenereren.
6. Controle: `node tools/geo/controle.mjs` moet eindigen op "Geen problemen". Het
   verslag laat per bestand zien hoeveel objecten erin zitten en welke functies en
   typen voorkomen (bijvoorbeeld hoeveel `rijbaan lokale weg`, hoeveel `voetpad`,
   hoeveel `boom`). **Dit verslag is wat Claude nodig heeft**, geen schermafbeelding.

### Stap 3 — Generator: ondergrond

`tools/geo/genereer.mjs` leest `data/geo/` en schrijft `js/kaart.js` (gegenereerd,
met een kop "niet handmatig bewerken"). Eerst alleen de ondergrond:

- Elk BGT-vlak wordt een getrianguleerd grondvlak met een materiaal naar functie en
  verharding: rijbaan-asfalt, rijbaan-klinker (grijs of rood; de kleur komt in stap 6
  uit de stijlcatalogus), voetpad-tegels, parkeervlak, inrit, berm-gras,
  groenvoorziening, bosplantsoen, water, oever, erf.
- Trottoirbanden: de gedeelde rand tussen rijbaan en voetpad/berm wordt een band van
  12 cm hoog. Dat is precies de rand die nu met `verge`, `walk` en `bays` benaderd wordt.
- Wegassen blijven nodig voor verkeer, voetgangers en het straatnaambord in de HUD.
  Die komen uit de middellijn van de rijbaanvlakken (skelet van het vlak) met de naam
  uit `openbareruimtelabel`; de breedte wordt per punt gemeten uit het vlak, niet meer
  opgegeven.
- De huidige `ROADS`, `WATER`, `WATERWAYS`, `WOODS`, `GRASS`, `PARKS`, `PLATEAUS` en
  `PARKING_LOTS` worden hierdoor overbodig. `world.js` krijgt een tak die vlakken
  tekent in plaats van linten; de linten blijven als terugvaloptie zolang `kaart.js`
  er niet is.

Controle: het bovenaanzicht (§6) van alleen de ondergrond over de luchtfoto.
Klinkers op klinkers, gras op gras, water op water. Doel: afwijking kleiner dan 2 %
van het oppervlak.

### Stap 4 — Generator: panden

- Grondvlak uit BAG, hoogtes en daktype uit 3D BAG, adres uit `verblijfsobject`.
- Rijtjes worden herkend als aaneengesloten panden die een muur delen; de rij krijgt
  één lijn, één diepte en het aantal woningen uit de data. Dat past op het bestaande
  `ROWS`-formaat (`a`, `b`, `off`, `depth`, `type`), zodat de hele huidige
  gevelgenerator (`textures.js`, `HOUSE_STYLES`, dakkapellen, voortuinen) hergebruikt
  wordt. Per rij wordt getoetst dat de gegenereerde woningen minstens 90 % van de
  BAG-vlakken bedekken; lukt dat niet (hoekwoning, aanbouw, vrijstaand met schuine
  hoek), dan wordt dat pand als los geëxtrudeerd grondvlak met het 3D BAG-dak
  geplaatst.
- Aantal bouwlagen en dakvorm komen uit `b3_h_dak_50p − b3_h_maaiveld` en
  `b3_dak_type`, niet uit een foto. Bungalow of twee lagen is daarmee een feit.
- Schuurtjes en carports: BGT `overigbouwwerk` en `pand` zonder verblijfsobject.

Controle: aantal woningen in het spel = aantal BAG-panden met woonfunctie. Elke rij
uit de oude `data.js` die meer dan 3 m van de BAG-rij ligt komt in een lijst; die
lijst is de meetlat voor hoe ver de oude kaart ernaast zat.

### Stap 5 — Generator: inrichting

Rechtstreeks uit BGT-punten en -lijnen, met een vaste koppeling op de bestaande
objectenbibliotheek (`js/props.js`):

| BGT | object in het spel |
|---|---|
| vegetatieobject `boom` | boom (soort en grootte later uit stijlcatalogus) |
| vegetatieobject `haag`, begroeid terreindeel `haag` | ligusterhaag / beukenhaag |
| paal `lichtmast` | lantaarnpaal |
| paal `verkeersbordpaal` | verkeersbord (welk bord: stijlcatalogus) |
| paal `afsluitpaal`, `poller` | antiparkeerpaaltje |
| bak `afvalbak` / `afval apart plaats` | prullenbak / ondergrondse container |
| straatmeubilair `bank`, `picknicktafel`, `fietsenrek`, `speeltoestel`, `abri` | bank, picknicktafel, fietsenrek, speeltoestel, bushalte |
| scheiding `hek`, `muur` | hek, muurtje |
| weginrichtingselement `verkeersdrempel` | drempel |
| kunstwerkdeel `duiker`, `brug` | duiker, brug |
| functioneel gebied `speeltuin` | speelveld |

Elk object krijgt de BGT-identificatie mee, zodat opnieuw genereren dezelfde
objecten oplevert en handmatige aanpassingen (`overrides`) eraan gekoppeld blijven.

Controle: `tools/propcheck.mjs` (niets in een gebouw of op de rijbaan) en tellingen
per type tegenover het controleverslag van stap 2.

### Stap 6 — Stijlcatalogus (hier komen de foto's pas)

`data/stijl/straten.json` koppelt per straat (of per reeks huisnummers, of per
bouwjaar) een woningtype uit `HOUSE_STYLES`, de klinkerkleur van de straat en
bijzonderheden (zonnepanelen, dakkapel, kozijnkleur). Standaard per bouwjaar,
overschreven per straat.

De regels voor foto's:

- Eén foto, één nauw omschreven vraag, één antwoord dat in de catalogus komt:
  "Kruirad 50: welke steenkleur, welke kozijnkleur, dakkapel ja/nee?" Nooit "maak
  de straat zoals op deze foto".
- Elke opmerking verwijst naar een adres of pand-identificatie, nooit naar "het
  tweede huis van links".
- Vaste steekproef: tien adressen (bijvoorbeeld Molenkrite 19, Kruirad 50,
  Monnikmolen 174, De Wieken, Bonkelaar, Jasker, Molenpaal, Bovenas, Spinnekop,
  Tinga State). Voor elk adres rendert `tools/screenshot.mjs` het spel vanaf een
  vast punt (positie van het adres uit BAG, acht meter richting de weg, kijkend naar
  de voordeur). Die tien beelden staan naast de Street View-foto van dezelfde plek.
  Zo zie je stijlverschillen, en omdat de punten vast zijn, zie je ook of een
  wijziging iets anders stukmaakt.

### Stap 7 — Overrides en editor

Alles wat je met de hand wilt afwijken (een tuinfeest in de voortuin van
Molenkrite 19, een auto op een specifieke plek) gaat in `data/overrides.json` of
`js/rows.user.js`, gekoppeld aan een BAG- of BGT-identificatie of aan
RD-coördinaten. De editor (F2) blijft werken en schrijft in meters in plaats van
pixels. Opnieuw genereren raakt overrides nooit aan.

### Stap 8 — Windows-app

Ongewijzigd: Electron, `npm run dist:win`, en de GitHub-workflow **Windows-app**
bouwt bij elke push een zip. Let op: beide workflows luisteren nu op de branch
`claude/gta-game-tinga-sneek-st3yxi` en `main`; voeg de werkbranch toe of merge
naar `main` om een build te krijgen.

## 6. De controles op een rij

| Controle | Gereedschap | Wanneer groen |
|---|---|---|
| Brondata compleet, in RD, binnen gebied | `node tools/geo/controle.mjs` | eindigt op "Geen problemen" |
| Coördinaten kloppen | `node tools/geo/rd.mjs test`; middelpunt in Google Maps plakken | zelftest slaagt; punt ligt in Tinga |
| Bovenaanzicht over luchtfoto | `tools/geo/bovenaanzicht.mjs` (te schrijven in stap 3): orthografische camera recht van boven, exact 10 px/m, uitvoer PNG plus world-bestand (`.pgw`) zodat QGIS hem georefereerd over de luchtfoto legt; daarnaast dezelfde uitsnede van de BGT-vlakken in dezelfde kleuren, en het percentage pixels dat verschilt | verschil < 2 % en geen zichtbare verschuiving |
| Elk pand een huis | telling in `genereer.mjs` | woningen = BAG-panden met woonfunctie |
| Niets staat in de weg | `tools/propcheck.mjs`, `tools/tuintest.mjs` | geen meldingen |
| Straatprofielen | `tools/meetstrook.mjs`, nu getoetst aan BGT-breedtes in plaats van foto's | afwijking < 0,5 m |
| Stijl | tien vaste steekproefpunten naast Street View | per adres akkoord in de catalogus |

Het bovenaanzicht is de belangrijkste. Het is het enige beeld dat Claude wél
betrouwbaar kan beoordelen, omdat het een pixel-voor-pixel vergelijking is op
dezelfde schaal, en omdat het verschilpercentage als getal terugkomt.

## 7. Zo werk je met Claude aan deze kaart

- **Geef data, geen plaatjes.** Brondata in de repo, en het verslag van
  `controle.mjs` in het gesprek. Claude schrijft scripts die op die data draaien en
  leest de uitkomsten.
- **Vraag om de generator, niet om de coördinaten.** Niet "zet de Molenkrite 12 m
  naar het noorden", maar "de Molenkrite ligt volgens BGT anders dan in het spel;
  laat de generator de BGT-rijbaan gebruiken".
- **Één foto, één vraag, één antwoord in de stijlcatalogus.** Zie stap 6.
- **Verwijs naar adressen en identificaties.** BAG-pand 0000123456 of "Kruirad 50",
  niet "het gele rijtje".
- **Eis de controle.** Elke wijziging aan de kaart eindigt met het bovenaanzicht en
  de tellingen. Geen groene controle, geen commit.

Bruikbare startprompt voor een volgende sessie:

> De brondata staat in `data/geo/` en `node tools/geo/controle.mjs` geeft geen
> problemen (verslag hieronder). Schrijf `tools/geo/genereer.mjs` volgens stap 3 van
> `docs/METHODIEK.md`: alleen de ondergrond, uitvoer `js/kaart.js`, en laat
> `world.js` die vlakken tekenen als `kaart.js` bestaat. Maak daarna het bovenaanzicht
> met world-bestand en rapporteer het verschilpercentage met de BGT-vlakken.

## 8. Volgorde en omvang

| Stap | Wie | Tijd |
|---|---|---|
| 1 gebied en oorsprong | jij, in QGIS | 1 uur |
| 2 downloaden en committen | jij, in QGIS | 1 avond |
| 3 generator ondergrond + bovenaanzicht | Claude, op de data | 1–2 sessies |
| 4 panden | Claude | 1–2 sessies |
| 5 inrichting | Claude | 1 sessie |
| 6 stijlcatalogus | jij met foto's, Claude verwerkt | doorlopend, per straat |
| 7 overrides, verjaardagsdetails | samen | naar wens |
| 8 GTA-besturing (derde persoon, auto's, missies) | Claude | los van de kaart |

Stap 8 staat hier los, bewust: de besturing en de wereld zijn twee verschillende
problemen. De methodiek hierboven lost het wereldprobleem definitief op; daarna is
de besturing een gewone spelfeature zonder onzekerheid over de kaart.

## 9. Stand van zaken

Stap 1, 2 en 3 zijn af; van stap 4 staat de geometrie.

**Data (stap 1 en 2).**
`data/geo/gebied.geojson` is het werkgebied: RD X 171870–172600, Y 558920–559790
(730 × 870 m), de kern van Tinga met de N7, binnen 3D BAG-tegel 9-632-1008. Het
zuidoosten van de wijk (Kaar, Koningsspil, Zomermeter) valt buiten die tegel en
vraagt later een tweede tegel. `data/geo/oorsprong.json` legt het kruispunt
Molenkrite / Monnikmolen / Jasker op RD 172214.98, 559360.95. De ruwe downloads
(BGT-CityGML, 3D BAG GeoPackage en CityJSON) staan in `data/geo/bron/`, de
omzetters `bgt2geojson.mjs` en `bag3d2geojson.mjs` maken er GeoJSON van, en
`controle.mjs` keurt het geheel ("Geen problemen").

**Generator (stap 3 en 4).**
`tools/geo/genereer.mjs` schrijft `js/kaart.js` (2,3 MB) met:

- 1885 vlakken ondergrond met klasse, materiaal en hoogte (rijbaan en parkeervlak op
  0, stoep, berm, gras en erf op +12 cm zodat de trottoirband vanzelf ontstaat, water
  op −35 cm met een oeverwand);
- 130 rijbaanassen (8,1 km) en 608 padassen, afgeleid uit de vlakken met een
  skelet-algoritme (`skelet.mjs`), met per punt de gemeten breedte en de straatnaam
  uit de BGT-labels; de N7 is met de hand benoemd omdat rijkswegen geen label hebben;
- 1327 panden: 1032 met het LoD 2.2-dakmodel uit 3D BAG (hoekpunten en vlakken per
  pand, gedeelde punten), 295 zonder model als opgetrokken grondvlak (schuurtjes 2,5 m,
  woningen met huisnummer 5,8 m goot);
- parkeerplekken uit de parkeervlakken (langs- of haaks naar de breedte van het vak),
  bomen gestrooid in bosplantsoen, struiken in heestervakken, 18 hagen, en lantaarns
  volgens een plaatsingsregel (om de 30 m langs een rijbaanas, alleen op stoep of berm);
- 65 straatnaamlabels en 901 huisnummers.

`js/kaartwereld.js` bouwt daar de wereld van; `main.js` laadt `kaart.js` en valt
met `?kaart=oud` terug op de oude kaart.

**Controle.**
`tools/geo/bovenaanzicht.mjs` rendert het spel orthografisch van boven op 4 px/m,
op dezelfde omhullende als de kaartplaat, eenmaal in egale klassekleuren en eenmaal
zoals het er echt uitziet, en vergelijkt het eerste pixel voor pixel met
`bgt-plaat-kaal.png`, die rechtstreeks uit de brondata komt.

| meting | uitkomst |
|---|---|
| afwijkende pixels kaartplaat ↔ spel | **1,31 %** (doel < 2 %) |
| waarvan | randpixels door anti-aliasing; één pand met koepeldak; enkele dakvlakken |

De uitkomst staat in `data/geo/spel-boven.png` (het spel van boven) en
`data/geo/verschil.png` (rood = afwijking). Beide ontstaan met `npm run geo:boven`
bij een draaiende webserver (`npm start`).

**Wat de data over Tinga zegt.**

- Rijbanen zijn klinkers: 603 van de 670 wegdelen zijn open verharding, met
  onderscheid tussen betonstraatstenen (grijs) en gebakken klinkers (rood). De N7 en
  de Buitenroede zijn asfalt. De straatkleur komt dus uit de data, niet uit een foto.
- Verkeersdrempels staan erin (27 stuks).
- Huisnummers staan op het pand (901 panden); een adres opzoeken is een tabelvraag.
- Bomen en lantaarnpalen staan er niet in: Súdwest-Fryslân vult de optionele
  BGT-objecten paal, bak en straatmeubilair niet, en van vegetatieobjecten zijn er
  alleen 18 hagen. Bosplantsoen en heesters staan wél als vlakken. Losse bomen en
  lichtmasten komen daarom uit een plaatsingsregel (nu) of uit luchtfoto/OSM (later).
- 295 BGT-panden hebben geen 3D BAG-model: 220 kleine bijgebouwen en 75 woningen
  ten noorden van de Buitenroede, vermoedelijk nieuwbouw na de 3D BAG-versie.

**Wat nog niet af is (in volgorde).**

1. Gevels: de panden zijn nu baksteen zonder ramen en deuren. De gevelgenerator uit
   `textures.js` moet per muurvlak geprojecteerd worden, met het woningtype uit de
   stijlcatalogus (stap 6). Dakkapellen, dakramen en zonnepanelen horen daarbij.
2. Voortuinen: erf is nu egaal gras; hekjes, hagen en paden per perceel komen uit de
   stijlcatalogus.
3. De editor (F2) en de oude objecten uit `data.js` werken nog in pixels van de oude
   kaart; enkele objecten staan daardoor een paar meter verkeerd. Omrekenen kan met
   drie ijkpunten in `oorsprong.json` (`rd.mjs px`).
4. Koepel- en samengestelde daken (`multiple horizontal`) en de 75 nieuwbouwwoningen
   zonder 3D-model.
5. Tweede 3D BAG-tegel voor het zuidoosten van de wijk.
