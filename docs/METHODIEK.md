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
| Panden met een eigen aanzien (winkel, boerderij) | `npm run adresshots` | foto per pand naast de bronfoto |
| Het verhaal, alle vijf de missies (stap 8) | `npm run verhaaltest` | eindigt op "Alles goed" |
| Rijden, de camera achter je, aanrijden (stap 8) | `npm run rijtest` | eindigt op "Alles goed" |
| Nergens vastlopen op een binnenterrein (stap 8) | `npm run looptest` | eindigt op "Alles goed" |

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

Stap 1, 2, 3 en 4 zijn af; stap 6 (de stijlcatalogus) is ingericht en wacht op foto's, en van stap 8
staan de eerste vijf missies in de wijk (zie *Het verhaal en de opslag* onderaan).

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

**Gevels en stijl (stap 4 en 6).**
Elk pand krijgt zijn straat en voorgevelrichting uit de data: de straat is de naam
van de rijbaanas die het dichtst bij het huisnummerlabel ligt (dat label staat bij
de voordeur), de voorgevel kijkt naar die as. `data/stijl/straten.json` koppelt per
straat een woningtype uit `HOUSE_STYLES`; binnen een straat maakt de generator
onderscheid op goothoogte (onder 4 m is een bungalow) en daktype (plat) uit 3D BAG.
De goothoogte is de laagste rand van de grote dakvlakken, zodat een afdakje of
erker niet als goot telt. Panden onder 35 m² zonder huisnummer zijn schuurtjes en
krijgen kale steen.

In het spel legt `kaartwereld.js` de bestaande gevel met ramen en deuren op elk
muurvlak dat naar de straat kijkt, en de achtergevel op de tegenoverliggende
muren. Het aantal lagen volgt uit de hoogte van het muurvlak zelf; een kopgevel
wordt op de goot doorgeknipt, met de gevel eronder en kale steen tot de nok. De
dakkleur komt uit het woningtype.

De catalogus is gevuld met de Street View-foto's van de twaalf steekproefadressen
(`data/stijl/fotos/`). Wat die foto's leerden: heel Tinga is lichtgele tot beige
baksteen met donkerbruine pannen en witte boeiboorden; het verschil per straat zit
in de accentkleur (rood op Kruirad 12, Monnikmolen, de Wieken en Bovenas; blauw op
Kruirad 50; donkergroen en donkerblauw op de Molenkrite), in de dakvorm (steile kap
met grote dakkapel op Molenkrite 19 en 43 en de Wieken, laag zonnedak op Molenkrite
70) en in details als de witte luifel van de Monnikmolen en de witte houten
topgevels van Bonkelaar en Jasker. De regels met bron "foto" zijn bevestigd; de
overige straten staan nog op "aanname". De gevelgenerator tekent sindsdien op 40
pixels per meter met kozijnsponning, vensterbanken, lateischaduw, plint,
regenpijp en luifel, en de baksteen is waalformaat op 197 pixels per meter.
Dakkapellen komen uit het 3D BAG-model: wanden die boven de goot beginnen of
doorlopen tot onder de nok krijgen witte wangen en aan de straatkant het
dakkapelkozijn in de accentkleur.

**Steekproef.** `npm run geo:steekproef` rendert de twaalf adressen uit
`data/stijl/steekproef.json` vanaf de straat, negen meter voor de voorgevel, en
schrijft `docs/steekproef/README.md` met per adres de meetwaarden, het gekozen
type, het beeld en de Street View-link van precies dat camerapunt (zelfde plek,
zelfde kijkrichting). Dat is de plek waar foto's het spel ontmoeten: per adres
wordt alleen kleur en detail beoordeeld, nooit positie of maat.

**Omgeving (stap 5, uit de foto's van de tweede ronde).**
De BGT van deze gemeente heeft geen bomen, hagen of straatmeubilair, dus die
komen uit plaatsingsregels op de BGT-vlakken, met de foto's als maat: straatbomen
om de 11 tot 15 m in de grasbermen langs de rijbaanassen (niet op de stoep, niet
tegen een gebouw), losse grote bomen in de gazons van de groenvoorziening, riet
langs de oevers, ondergroei aan de rand van de bosjes. Per woning met huisnummer:
een lage haag aan de straatkant met een opening bij de voordeur (op de plek van het
huisnummerlabel), een tegelpad van de deur naar de stoep, lage hagen tussen de
voortuinen en schuttingen van 1,8 m tussen en achter de achtertuinen; hoe diep de
tuin is volgt uit het erf-vlak. Parkeervakken krijgen witte belijning, drempels
een markering, het grote gazon bij de Wieken twee doelen. Alles staat als lijst in
`kaart.js` en wordt bij het genereren opnieuw berekend.

**Omgeving uit plaatsingsregels (stap 5).**
De BGT van Súdwest-Fryslân heeft geen bomen, lantaarns of tuininrichting. Die
komen uit regels op de BGT-vlakken, met de foto's van de omgevingssteekproef
als maat (`data/stijl/fotos/`), en met `data/stijl/omgeving.json` als knop:

- straatbomen om de 11 à 15 m in gras en berm langs elke woonstraat, niet op de
  stoep en niet tegen een gebouw; losse grote bomen in de gazons van de parkjes;
- bosplantsoen dicht en hoog met ondergroei; `bosgebieden` in omgeving.json maken
  ook het gras en de oever tot bos waar dat in werkelijkheid zo is (het bos tussen
  Monnikmolen en Buitenroede);
- per woning een voortuin uit vijf varianten (heg, hekje, open, grind, tegels),
  gekozen op het pand-nummer zodat het bij elke generatie hetzelfde blijft, met
  tegelpad naar de deur, struiken en soms een sierboom; lage hagen tussen de
  voortuinen, schuttingen van 1,8 m tussen en achter de achtertuinen; de
  tuindiepte volgt uit het erf-vlak;
- witte belijning op parkeervakken, markering op drempels, riet langs het water,
  doelen op het speelveld, banken bij de vijvers;
- `plantsoenen` in omgeving.json voor groenvakken met een eigen karakter: het
  bosje bij Molenkrite 9 (foto) staat vol struiken, heeft een bankje aan het
  tegelpad en bomen zonder botsing, zodat je er doorheen kunt lopen.

**Omheinde terreinen: de RWZI aan de Buitenroede 1 (stap 5, foto 4 sep 2026).**
De waterzuivering ligt in een sloot die de BGT wél heeft; het hek eromheen
niet. Het terrein wordt daarom uit de data afgeleid, met `terreinen` in
`omgeving.json` als regel:

- het terrein is alles wat vanaf een zetelpunt bereikbaar is zonder water of
  oever te kruisen (vulling op het klasseraster van 0,5 m); de poort en de dammen
  zonder poort staan in de regel als korte lijnen die de vulling tegenhouden, en
  de generator waarschuwt als het terrein tegen de rand van het zoekvak loopt
  (dan lekt de sloot ergens). `TERREIN_DEBUG=3 node tools/geo/genereer.mjs`
  drukt het masker af en volgt een lek terug naar de bron;
- het hek volgt de landkant van de oeverrand uit de BGT, 0,7 m het gras op:
  789 m spijlenhek van 2 m in panelen van 2,5 m, met de schuifpoort op de
  toegangsweg (BGT-rijbaan) en botsingsdozen zodat je er niet doorheen loopt;
  de poort staat 1,4 m open;
- de bezinkbakken en opslagtanks komen uit `bgt_overigbouwwerk` (`bgt_type`):
  een bezinkbak wordt een ronde betonnen bak van 1,6 m met water en een
  ruimerbrug, een opslagtank een stalen silo van 6 m;
- de gebouwen op het terrein krijgen bedrijfstypen (`rwzi`, `rwzi_blauw` met
  damwandprofiel, `rwzi_kantoor`) met de bedrijfsgevel aan alle kanten; lage
  muren onder 2,6 m blijven kale steen; de grijze buitentrap is een los object
  aan het bedieningsgebouw; bomen om de 9 m langs het hek, lantaarns langs het
  erf; de bos- en parkregels slaan het terrein over.

**Voorkant en dakkapellen (stap 4, foto's Molenkrite 47 en de kap-rij).**
De voorkant van een woning was de richting naar de dichtstbijzijnde weg; bij
hoekwoningen en woningen aan een voetpad wees die naar de kopse kant of de
zijkant, met een kale voorgevel of een voorgevel op de bouwmuur als gevolg.
Nu loopt de voorkant langs een as van de omsluitende rechthoek, nooit door een
bouwmuur naar een buurpand (dat staat in de BGT), en naar de kant met de
dichtstbijzijnde rijbaan, gewogen met de straat van het huisnummer. De
huisnummerlabels zelf liggen bijna altijd midden in het pand en helpen niet.
Dakkapellen zitten in 3D BAG maar bij een deel van de woningen; in een rij
waar één woning er een heeft aan de voorkant, bouwt het spel er nu een op
elke woning van die rij (`kapel` in kaart.js), met het kozijn van het type.

Bij deze stap kwam een oude fout in de gevelprojectie boven: bij muren breder
dan één woning liet de texture alleen de laatste pixelkolom zien (strepen). Dat
raakte alle brede panden (school, RWZI) en is verholpen.

**Het verhaal en de opslag (stap 8, GTA-besturing).**
Het verhaal staat in `js/verhaal.js` en gebruikt de kaartdata als bron: het
pand met huisnummer **15** aan de Molenkrite (steile kap met dakkapel, het
vierde huis na de knik) en het pand **20** schuin tegenover. Uit die twee panden
komen het beginpunt van de speler (op de berm voor 15, met de buurman recht
vooruit), de plek van de buurman (op de stoep, 6,1 m voor de voorgevel), het
tafeltje met de radio en de vier stoelen in de voortuin van 20, en de plek waar
de buurman blijft staan. In het bestand staat geen enkele coördinaat, alleen de
twee adressen en de afstanden vanaf de voorgevel; verhuist een pand in de
brondata, dan verhuist de scène mee. `js/persoon.js` is één los poppetje dat kan
staan, zwaaien, lopen en de speler aankijken — de voetgangers uit `npc.js` zijn
instanced meshes en kunnen dat niet.

Het gezelschap met de bierflesjes stond tot nu toe als vijf objecten in
`data.js`, in pixels van de oude kaart, bij wat daar 19 Molenkrite was; in de
BGT-kaart ligt dat pand veertig meter verderop, dus stonden ze op het gras van
niemand. Ze horen bij het verhaal en worden nu door `verhaal.js` op het adres
geplaatst. Daarmee is het eerste stuk van openstaand punt 3 hieronder opgelost.

Opslaan en laden zit in `js/opslag.js`: één plek in de localStorage, F5 bewaart
en F9 zet terug (positie, kijkrichting, munitie, de auto waar je in zat, tijd,
weer en de stand van het verhaal). De wijk uit de editor heeft zijn eigen
opslag, zodat een gewone opslag geen werk aan de wijk overschrijft.

**De missies.** Het verhaal is uitgegroeid tot vijf missies, allemaal op
plekken uit de data:

1. *Molenkrite 15* — Mark (de broer van de speler) voor het pand met huisnummer
   15, en het gezelschap in de voortuin van nummer 20.
2. *Naar de waterzuivering* — er staat een auto op de rijbaanas naast het
   gezelschap; `js/navigatie.js` maakt van de 751 wegassen uit `kaart.js` één
   graaf (3278 knopen) en zoekt met Dijkstra de kortste route naar de
   schuifpoort van de RWZI aan de Buitenroede (657 m). De HUD tekent die route
   op de minikaart en op de grote kaart. Bij de poort stapt de speler
   automatisch uit.
3. *De bewaking* — vijf bewakers (`js/bewaking.js`) patrouilleren over posten
   die uit het poortstelsel van het terrein volgen (vooruit/rechts vanaf het
   midden van de poort). Binnen het hek (het hekwerk uit `kaart.js` als
   polygoon) zien ze de speler binnen 34 m in hun gezichtsveld, mits er vrij
   zicht is (`zichtVrij` in `world.js`), en een schot horen ze tot 90 m. Dan
   slaat het alarm, komen ze op je af en vuren ze; de levensbalk in de HUD loopt
   leeg en bij nul begin je bij je laatste opgeslagen spel. Eén treffer legt een
   bewaker neer. Liggen alle vijf, dan schuift het hekblad van de poort open
   (daarvoor is de poort in `kaartwereld.js` een eigen groep met een eigen
   botsingsdoos geworden, zie `poortBladen`) en wordt de vrachtwagen
   bestuurbaar.
4. *Afleveren* — de bakwagen (nieuw model in `carmodel.js`, 7,2 m, met eigen
   botsingscirkels en stoelhoogte in `vehicles.js`) naar de grote schuur van de
   boerderij in de zuidwesthoek (BAG-pand 0683100000288962, 621 m²), 1283 m over
   het wegennet. Binnen 20 m van de schuur staat *MISSION COMPLETED* in beeld.

5. *Het telefoontje van Johan* — meteen na de boerderij belt Johan van
   **Kruirad 62** (BAG-huisnummer 62 aan het Kruirad): zijn kop komt in beeld,
   met een ringtone uit `audio.js` en een portretje dat `hud.js` tekent. Op het
   tegelpad voor zijn deur (zeven en een halve meter voor de voorgevel, waar hij
   heen en weer ijsbeert) volgt de briefing, met Erik als tweede spreker in de
   tekstbalk. De dief woont op **De
   Wieken 27** en slentert over het trottoir voor dat pand (vijf meter voor de
   voorgevel, gemeten: daar liggen de tegels). Ziet hij je binnen
   vijftien meter, dan vlucht hij over de wegassen van `navigatie.js` — steeds
   een knoop van zestig tot honderdzeventig meter ver, van jou af, dus hij duikt
   vanzelf de brandgangen in. Hij rent 7,3 m/s tegen jouw sprint van 7,5 m/s;
   een simulatie van een rechte achtervolging pakt hem in 23 seconden, in het
   echt duurt het langer, en na negentig seconden is hij op en wankelt hij
   verder op 1,75 m/s. Onder de achtervolging loopt een gesynthetiseerd deuntje
   (`geluid.jacht` in `audio.js`, één beeld per aanroep vooruit gepland zoals de
   radio): een achtstenbas in d-klein met een halve toon erboven en een
   trommeltje, dat aanzwelt bij de vlucht en uitdooft zodra de achtervolging
   voorbij is. Schiet je hem neer, dan vaagt het beeld naar grijs
   (MISSIE MISLUKT) en begin je bij je laatste opgeslagen spel — precies wat
   Johan gevraagd had. De duizend euro uit de envelop staat als buit in de HUD
   en levert na aflevering vijfhonderd euro in de portemonnee op; dat geld gaat
   mee in de opslag.

**Een fout in de voorgevel.** Johan stond eerst tegen zijn eigen muur geplakt,
tussen de heg en de berging van de buren, en was vanaf de straat niet te zien.
De oorzaak zat in `voorgevel()` in `verhaal.js`: die nam altijd `rect.hz` als
halve maat langs `front`, maar `front` loopt langs één van de twee assen van de
omsluitende rechthoek (zie `genereer.mjs`) en bij een rijtjeswoning is dat juist
de lange as. Bij Molenkrite 15 zat het "gevelmidden" daardoor 4,3 m binnen het
pand, bij Kruirad 62 2,1 m. Alle afstanden waren daar met de hand op ingemeten,
dus de scènes stonden goed; alleen sloten ze niet aan op de echte gevel.
`voorgevel()` kijkt nu welke as het is en neemt `hx` of `hz`, en de afstanden
zijn omgerekend naar echte meters vanaf de gevel: Mark 6,1 m, de speler 9,3 m,
het tafeltje 2,0 m, Mark bij de bende 4,6 m, de dief 5,2 m. Johan staat nu op
7,5 m, waar het tegelpad over de volle breedte vrij ligt; `verhaaltest` toetst
dat hij ruim voor de gevel op de tegels staat en vanaf de rijbaan te zien is.

**Achter de voordeur (`js/interieur.js`).** Bij de voordeur van Molenkrite 15
zet E je binnen. De 3D BAG-huls van het pand is hol en heeft geen vloeren, dus
de woning staat als losse, dichte ruimte ruim buiten het kaartgebied
(`gebied.x1 + 520`, `gebied.z1 + 520`); naar binnen en naar buiten gaan is een
teleport. Zo staat hij ook niet op het bovenaanzicht en blijft `geo:boven` op
1,31 %.

De maten komen uit de data. Het grondvlak `voet` van het pand wordt omgerekend
naar kamercoördinaten (x langs de gevel, z de diepte in), per as op elkaar
geklikt binnen 12 cm zodat de plattegrond haaks is, en dan met een
scanlijn-ontleding in banden geknipt: bij nummer 15 een voorhuis van 5,42 ×
9,48 m en een aanbouw van 2,42 × 4,58 m. De buitenmuren (24 cm) staan binnen
die contour, met de deur- en raamgaten erin; de goot van 3,38 m laat één
woonlaag toe, binnen 2,60 m plafond. De voordeur staat op dezelfde plek als in
de geveltexture (50 cm uit de zijkant, 95 cm breed, uitgerekt naar de echte
gevelbreedte), zodat de deur binnen en de deur buiten dezelfde deur zijn.

De indeling volgt de foto's van de verbouwing: een gang van 1,30 m met
zwart-witte blokjes langs de zijmuur, met achterin de (dichte) deur naar de
trap; een L-vormige woonkamer met bruin laminaat, een bank van 2,10 × 0,90 m
met de zitting op 44 cm tegen de zijmuur en daartegenover een 55-inch tv op een
dressoir, beeldmidden op 86 cm; en in de aanbouw een keukenblok in één rij —
onderkasten van 60 cm diep, werkblad op 90 cm met spoelbak en kookplaat, witte
wandtegels tot 1,45 m, bovenkasten tot 2,15 m en een wasemkap boven de plaat.
Alleen de begane grond is ingericht.

Er komt geen enkele lamp in de scene: een paar puntlichten laat three.js alle
materialen van de wijk opnieuw compileren en kost buiten rekenkracht. In plaats
daarvan krijgt elk vlak zijn helderheid in de hoekpunten mee, uit de richting
waar het naar kijkt (fel door de pui, zachter door de tuindeur en het
keukenraam, wat daglicht van boven). Daardoor lopen de hoeken zichtbaar uit
elkaar en ziet de kamer er altijd hetzelfde uit — ook 's nachts.

Terwijl je binnen bent zegt de HUD *Molenkrite 15* en tekent de minikaart de
Molenkrite: `hud.kaartVanaf` neemt dan de plek van de voordeur als middelpunt
in plaats van die van de kamer. Of je binnen bent volgt uit je positie, dus
opslaan en laden werkt binnen zonder extra vlag.

**Twee panden die geen woning zijn.**
De stijlcatalogus koos tot nu toe alleen op straatnaam en op de meetwaarden uit
3D BAG, en alles boven 300 m² grondvlak kreeg het naamloze `spil`-type. Daardoor
stonden de twee gebouwen die geen woning zijn er als een blok bij. `straten.json`
heeft nu een blok **`panden`**: per BAG-pandnummer een type, en als de generator
de voorkant niet goed kan raden ook een punt waar de voorgevel naartoe moet
kijken (`voorkantNaar`) en losse objecten die voor het pand horen te staan
(`objecten`, uitgezet vanaf het midden van de voorgevel). `kiesType` in
`genereer.mjs` kijkt daar eerst.

- **De supermarkt (Jumbo, Molenkrite 1 in de adressering, BAG-pand
  0091100000015898 met huisnummerlabel 171).** Het 3D BAG-model heeft de rij
  puntdaken al: een goot op 2,64 m en een nok op 7,06 m over een grondvlak van
  37 bij 31 m, met een hoger glazen blok bij de ingang. Het nieuwe type `jumbo`
  zet daar de winkelpui onder: donkere plint, glas met witte stijlen, een witte
  luifelband en de gele huisstijlband met het woordmerk. Omdat een bedrijfsgevel
  in `kaartwereld.js` over de hele muurhoogte uitgerekt wordt, staan die banden
  in verhoudingen van de muurhoogte en niet in vaste meters; zo werkt dezelfde
  texture op de lage gevel onder de luifel én op het hoge blok. `metaaldak`
  geeft de puntdaken dakplaten in plaats van pannen. De voorgevel wees eerst
  naar de dichtstbijzijnde rijbaan; `voorkantNaar` zet hem naar het
  parkeerterrein aan de noordkant, met 1239 m² het grootste van de wijk en
  daarmee het bewijs dat dit de winkel is. Voor de ingang staan drie
  vlaggenmasten van 8,4 m (`jumbovlag` in `props.js`, met het doek als texture).
- **De boerderij (Tinga State, Molenkrite 115, BAG-pand 0091100000006680).** Een
  stelp: 517 m² grondvlak, een nok op 13,32 m en wanden die maar 2,1 tot 3,9 m
  hoog zijn — één steile piramidekap over het hele huis. Het type `tinga_state`
  geeft die kap rode pannen met dakramen erin (`pannenMetDakramen`: het dakvlak
  loopt op 0,25 texture per meter, dus één dakraam per canvas van 4 bij 4 m geeft
  de rijen van de foto) en daaronder een lage bakstenen wand met witte kozijnen,
  een zwarte schuurdeur en een groene staldeur. De wand wordt niet op de goot
  afgeknipt (`industrieel`), want de gemeten goot van 1,94 m ligt lager dan elke
  echte dakvoet; en hij loopt rondom, want een boerderij heeft geen achtergevel.

Controle: `npm run adresshots` maakt van elk pand uit dat blok een foto, met de
uitsnede uit de catalogus of anders vanaf een standpunt dat het gereedschap zelf
zoekt (rondom het pand, zo ver mogelijk van de bomen). `npm run propcheck` geeft
nog dezelfde vijf oude meldingen en `npm run geo:boven` blijft op 1,31 %.

Bij de vierde missie kwam een oude fout boven: bruggen en duikers liggen in de
BGT boven het waterdeel, dus het waterpolygoon loopt eronderdoor. `pointInWater`
zei daardoor "water" midden op een brug en je kwam nergens overheen — niet naar
de boerderij en niet over de dam naar de RWZI. Nu tellen de klassen brug,
duiker, steiger en overbrugging niet als water.

Controle: `npm run verhaaltest` loopt alle vijf de missies na (het startpunt
hoort bij het pand met huisnummer 15, Mark zwaait en kijkt je aan, het gesprek
opent en klikt door met E, hij komt bij het gezelschap aan, een schot met het
pistool legt een drinker om, de briefing volgt, er staat een auto, de kaart
navigeert naar de poort, je stapt automatisch uit, de vijf bewakers zien je en
schieten, je gaat neer en begint bij de opslag, na vijf treffers gaat de poort
open, de vrachtwagen rijdt het terrein af en levert af, en opslaan/laden zet
alles terug, en dat schieten op de dief de missie laat mislukken), plus het
deuntje bij de achtervolging en de woning achter de voordeur (de maten tegen de
kaartdata, de teleport heen en terug, de wanden die je binnenhouden, en de
hoogtes van deur, aanrecht, bank en tv) — 123 controles. Bij het
maken van de foto's kwam nog een fout boven die het spelen raakte: de tekstbalk
kreeg `display: flex` voor het portretje, en dat verslaat de standaardstijl van
het `hidden`-attribuut — de balk ging daardoor nooit meer uit beeld.
`npm run geo:boven` blijft op 1,31 %.

**Rijden, de camera achter je en voetgangers aanrijden (stap 8).**
De auto's waren dozen met een kleinere doos erop, en je zat er met je neus op de
voorruit in. Drie dingen zijn aangepakt, met steeds de 329 geparkeerde auto's in
het achterhoofd: alles wat per auto een mesh kost, telt 329 keer mee.

- **Het model** (`js/carmodel.js`) is opgebouwd uit lagen die naar boven toe
  smaller worden — dorpel, flank met een taille, schouderlijn, motorkap,
  kofferklep, dak — met schuine A- en C-stijlen, wielkasten (halve ringen om de
  wielen), spiegels op een steeltje, portiernaden, grepen en een uitlaat. Dat
  kost alleen driehoeken, en de geometrie wordt per soort één keer gemaakt en
  door alle auto's gedeeld; het aantal meshes per geparkeerde auto blijft zeven.
- **Wat beweegt zit in een tweede uitvoering** die alleen de auto krijgt waar je
  in stapt (`Vehicles.maakBestuurbaar`): losse wielen in eigen groepjes (de
  voorste sturen, alle vier rollen), een carrosserie in een tussengroep die
  overhelt in de bocht en duikt bij het remmen, en losse rem- en
  achteruitrijlichten. Dat zijn tien meshes extra voor één auto in plaats van
  ruim tweeduizend voor allemaal.
- **Het rijgedrag** (`Vehicles.drive`) heeft nu een trekkracht die met de
  snelheid afneemt, motorrem en luchtweerstand, een stuuruitslag die kleiner
  wordt naarmate je harder rijdt, en een rijrichting die achterloopt op de neus.
  Die laatste is wat drift geeft: met de handrem loopt de rijrichting zóver
  achter dat de kont uitbreekt. Bij het schrijven kwam een oude fout boven die
  ook het vorige model raakte: de luchtweerstand werd per beeld afgetrokken in
  plaats van per seconde, dus op een snelle machine remde een auto veel harder
  af dan op een trage. Nu gaat hij maal `dt`.

**De camera achter je** (`js/derdepersoon.js`, toets V) hangt aan een hengel die
elk beeld wordt ingekort tot het eerste obstakel dat hoger is dan de camera zelf.
Dat kan niet met een raycast over de hele scene — dat zijn duizenden meshes — maar
wel met de botsingsdozen die er toch al zijn: `vrijeCamera` in `world.js` maakt
eerst een korte lijst van de dozen binnen bereik (van de 4832 blijven er meestal
een handvol over) en loopt daarna met stapjes van 25 cm langs de straal. Kan de
hengel niet ver genoeg — je staat met je rug tegen een muur — dan klimt de camera
omhoog in plaats van naar binnen. In de auto hangt de lengte aan de lengte van het
voertuig, zodat je bij een bakwagen van zeven meter niet in de laadbak kijkt, en
draait de camera vanzelf terug tot recht achter de auto zodra je zelf niet meer
rondkijkt. Te voet krijg je een `Persoon` als poppetje; het richten blijft
kloppen doordat de kogel uit zijn schouder komt en naar het punt onder het kruisje
gaat.

**Voetgangers aanrijden**: `NPCs.aanrijden` legt iedereen binnen een straal neer,
aangeroepen vanuit `drive` voor drie punten langs de auto, zodat een bakwagen over
zijn hele lengte raakt. Onder 1,6 m/s gebeurt er niets, zodat je stapvoets langs
iemand kunt manoeuvreren. Wie geraakt wordt schuift nog een paar meter door in de
richting van de klap en staat een halve minuut later ergens anders in de wijk weer
op — dezelfde respawn als na een schot.

**De buurt schrikt** (`NPCs.paniek`). Een schot (28 m) of een aanrijding (20 m)
zet iedereen in de buurt in beweging. Het gedrag hangt aan de segmenten waarover
de mensen toch al lopen, dus er komt geen padzoeker aan te pas: bij de schrik
wordt de looprichting omgekeerd als die naar de knal toe wijst, en op elke hoek
kiest `pickSegment` de aftakking waarvan het uiteinde het verst van de knal ligt.
Drie dingen maken dat het er echt uitziet: een reactietijd van 0,15 tot 0,5
seconde voordat iemand zich omdraait, een snelheid die niet springt maar in een
seconde oploopt (`vNu` schuift naar de gewenste snelheid toe, remmen gaat harder
dan optrekken), en een pas die met die snelheid meeloopt — de armen en benen
zwaaien sneller en verder naarmate er harder gerend wordt. Hollen is 4,2 à 4,8
m/s voor een volwassene tegen 1,0 à 1,6 wandelend; fietsers trappen naar 7 à 8.
Wie rent slaat pauzes en oversteken over. Na negen seconden (korter naarmate je
verder van de knal stond) is het over.

**Auto's raakten elkaar niet.** Botsingen liepen alleen langs `resolveCollisions`,
en daar zitten gebouwen, hekken en bomen in — geen auto's. Je reed dus dwars door
de geparkeerde rij. `Vehicles.botsAutos` toetst nu dezelfde drie cirkels langs je
eigen auto aan drie cirkels langs elke andere auto binnen twaalf meter (verder
kijken heeft geen zin en kost bij 329 auto's te veel), en duwt wat overlapt uit
elkaar. Een geparkeerde auto die je hard raakt krijgt een snelheid mee en rolt in
`rolUit` een halve meter uit — langs `resolveCollisions`, zodat hij niet een
gevel in schuift.

**Geluid** (`js/audio.js`). De motor liep met één rechte lijn van stationair naar
topsnelheid mee: dat klinkt als één eindeloze eerste versnelling. Er zit nu een
bak van vijf verzetten in, met grenzen als deel van de topsnelheid van dít
voertuig. Binnen een verzet lopen de toeren van een derde naar vol, bij het
schakelen valt het gas 0,16 s weg, klikt de pook en beginnen de toeren onderaan
het volgende verzet. Nieuw is ook de autoradio: een vervormde powerchord-riff in
e-klein (`WaveShaper` met een tanh-kromme), bas en drumstel, alles door een
hoogdoorlaat en een laagdoorlaat zodat het uit een portierspeaker lijkt te komen.
Hij staat op 0,20 en zakt naar 0,07 zolang het jachtdeuntje van het verhaal
speelt.

Controle: `npm run rijtest` (42 controles: het model in beide uitvoeringen, de
meshtelling, optrekken, topsnelheid, motorrem, remmen, achteruit, stuuruitslag,
drift met de handrem, rollende en sturende wielen, overhellen en duiken, de rem-
en achteruitrijlichten, de camera achter speler en auto, het inkorten bij een
muur, het richten vanaf de schouder, het aanrijden met en zonder vaart, de
reactietijd en het looptempo bij paniek, de vluchtrichting, en het blik-op-blik
rijden). `npm run rijshots` maakt de foto's. `npm run geo:boven` blijft op 1,31 %
en `npm run verhaaltest` op "Alles goed" — met één aangepaste toets: de
vrachtwagen die de poort uit rijdt loopt buiten tegen de auto aan waarmee je zelf
naar de waterzuivering bent gereden, dus daar wordt nu de hoogste snelheid
onderweg gemeten in plaats van die bij het laatste beeld.

**Vastlopen bij de school, en de gevels van De Spil en Jeugdhulp Friesland
(stap 8).** Op het plein van de school aan de Molenkrite kwam je klem te staan,
te voet en met de auto, en soms drukte de botsingsafhandeling je het gebouw in.
De oorzaak zat in `bouwPanden`: elk pand kreeg één botsingsdoos, de omhullende
rechthoek `p.rect`. Voor een rijtjeshuis is dat precies goed, maar de school is
een U om een plein heen en die rechthoek is 6600 m² — het plein, de
fietsenstalling en de paden ertussen telden dus mee als muur.

`pandDozen` in `js/kaartwereld.js` legt de dozen nu op de echte voetafdruk. Het
is een trapeziumontleding: in het assenstelsel van de **langste gevel** (niet
dat van de omhullende rechthoek, want die staat bij een hoekig complex scheef op
de muren) is elke hoekpunt-x een snijlijn, en per strook geeft een verticale
scanlijn de stukken die binnen de voetafdruk vallen. Stroken met hetzelfde stuk
worden aan elkaar geplakt, en een strook waarin de gevel schuin wegloopt wordt
in stukjes van een halve meter gehakt zodat er geen gat in de muur valt. Vult de
voetafdruk de rechthoek voor meer dan 97 % (vrijwel elk rijtjeshuis), dan blijft
het bij die ene doos — anders waren het er duizenden meer. Zo staat het op 8966
dozen tegen 4832 eerst, en dat is te meten: `resolveCollisions` is een rechte
lijst, en `player.update` staat in `npm run audit` nog steeds op 0,01 ms.

Nieuw gereedschap: `npm run looptest` toetst het van twee kanten. Eerst elk punt
binnen de omhullende rechthoek van de grotere panden dat buiten élke voetafdruk
ligt (met anderhalve meter marge voor de gevel) — dat moet vrij zijn. Daarna een
echte wandeling: vanaf een open plek op het binnenterrein van de vier grootste
panden acht kanten op lopen, in stapjes van tien centimeter langs dezelfde
botsingsafhandeling als de speler; je mag nergens klem komen en nooit binnen een
voetafdruk eindigen. Van de 4235 open punten zijn er nog 69 dicht (bomen en
struiken op het plein, geen muren).

Bij dezelfde plek horen twee gevels die er als een naamloos blok bij stonden.
**De Spil** (Molenkrite 169) krijgt in `facade()` een schoolgevel: een
doorlopende raamstrook met felblauwe kozijnen en gele gordijnen, een gele
plaatband onder een lichte dakrand, om de drie traveeën de ingang met een geel
bord erboven, en een donkere plint. **Jeugdhulp Friesland** (Molenkrite 234)
wordt een laag gebouw met plat dak in donkerbruine steen. Daar hoort een hek en
een speeltuin bij, en dat botste op de bronregel: de BGT-laag `scheiding` bevat
in Tinga alleen kademuren, dus dit hek staat nergens in de data. Het staat nu in
`data/stijl/omgeving.json` onder `hekken`, met de foto als bron — maar niet als
een lijst met de hand ingetypte punten: de generator legt de lijn om de
omhullende rechthoek van het pand heen (`omPand`, `marge`) en laat alles
vervallen wat op een rijbaan, inrit, fietspad, voetpad of water zou komen.
Daardoor ontstaat de opening bij de inrit vanzelf en staat er nooit een hek
dwars over de weg. De speeltuin zijn gewone objecten uit `js/props.js` bij het
pand in `straten.json`.

Controle: `npm run looptest` eindigt op "Alles goed", `npm run geo:boven` blijft
op 1,31 %, `npm run propcheck` geeft nog dezelfde vijf oude meldingen en
`npm run verhaaltest` en `npm run rijtest` blijven groen. `npm run adresshots`
maakt de foto's van de vier panden met een eigen aanzien.

**Wat nog niet af is (in volgorde).**

1. De achterkant van het Kruirad (groene panelen, balkons) en dakdetails als
   zonnepanelen en schoorstenen als losse elementen op de 3D BAG-daken.
2. Straten nog zonder foto: Windbord, Voorzoom, Buitenroede (de woningen 40–74;
   de RWZI op nr 1 is wel gedaan), Zeskanter, Omloop.
3. De editor (F2) en de overige oude objecten uit `data.js` werken nog in pixels van de
   oude kaart; enkele objecten staan daardoor een paar meter verkeerd. Omrekenen kan met
   drie ijkpunten in `oorsprong.json` (`rd.mjs px`). Het tuinfeest is al verhuisd: dat
   komt nu uit `js/verhaal.js`, op het adres uit de kaartdata.
4. Koepel- en samengestelde daken (`multiple horizontal`) en de 75 nieuwbouwwoningen
   zonder 3D-model.
5. Tweede 3D BAG-tegel voor het zuidoosten van de wijk.
6. De overzichtsbladen `docs/screenshots/objecten.png` en `woningtypen.png` zijn
   nog van vóór de supermarkt en de boerderij: de vlaggenmast en de twee nieuwe
   woningtypen staan er nog niet op. Bijwerken kan met `npm run propshots` en
   `npm run assets` plus `python3 tools/contactblad.py objecten|woningen`, maar
   dat zijn 78 losse renders en dat duurt op software-rendering een uur.
7. De overige panden die geen woning zijn en nog het naamloze `spil`-type
   dragen: de school aan de Molenkrite (BAG-pand 0091100000007732, 1462 m² met
   een golvende plattegrond), de rij aan de Ligger/de Loper (0091100000014651,
   3485 m²) en het blok aan de Krans. Ze kunnen op dezelfde manier als de
   supermarkt en de boerderij een eigen type krijgen in het blok `panden` van
   `data/stijl/straten.json`, zodra er een foto van is.
