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
3. 3D BAG-tegels downloaden. Zoek op `https://3dbag.nl/en/download` alle tegels op
   die het gebied raken — de tegels zijn een quadtree met wisselende maten, dus je
   kunt de buurtegel niet uit het nummer afleiden — en bewaar van elke tegel
   **beide** bestanden ongeknipt in `data/geo/bron/`: `<tegel>.gpkg` (attributen en
   2D-vlakken) en `<tegel>.city.json` (het LoD 2.2-dakmodel). `npm run geo:bag3d`
   loopt langs alle `.gpkg` in die map, knipt op het gebied, ontdubbelt op
   BAG-identificatie en schrijft `bag3d_pand.geojson`; `genereer.mjs` leest alle
   `.city.json` en slaat er een over zodra zijn `geographicalExtent` het gebied niet
   raakt.
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
| Lucht, wapen, erfscheidingen, vlaggen (stap 8) | `npm run wereldtest` | eindigt op "Alles goed" |
| Politie, gezocht-sterren en de inzet per ster (stap 9–10) | `npm run politietest` | eindigt op "Alles goed" |
| De boerderijwinkel en het geld (stap 11) | `npm run winkeltest` | eindigt op "Alles goed" |
| Scherpte, heggen en schuttingen (stap 13) | `npm run wereldtest` | eindigt op "Alles goed" |
| De Wieken 29, zitten, licht en het speeltuintje (stap 14) | `npm run woningtest` | eindigt op "Alles goed" |
| Het viaduct over de rondweg (stap 15) | `npm run viaducttest` | eindigt op "Alles goed" |
| Het pistool, de kogels en de explosies (stap 16) | `npm run wapentest` | eindigt op "Alles goed" |
| Het sportpark en de volkstuinen (stap 20–21) | `npm run sporttest` | eindigt op "Alles goed" |
| Houtzaagmolen De Rat (stap 25) | `npm run molentest` | eindigt op "Alles goed" |
| De Poiesz van binnen en het bier (stap 26) | `npm run poiesztest` | eindigt op "Alles goed" |
| Reliëf, glans en nat wegdek (stap 27) | `npm run relieftest` | eindigt op "Alles goed" |
| Tankstation BP Slump Oil (stap 39) | `npm run tanktest` | eindigt op "Alles goed" |
| Tennispark Molenkrite (stap 40) | `npm run tennistest` | eindigt op "Alles goed" |
| De vijf panden uit de steekproef (stap 41) | `npm run steekproeftest` | eindigt op "Alles goed" |
| Botsgevoel en geluid (stap 42) | `npm run gevoeltest` | eindigt op "Alles goed" |
| Startscherm, laadscherm en opbouw (stap 43, 45) | `npm run menutest` | eindigt op "Alles goed" |
| De losse punten uit de beta-test (stap 44) | `npm run betatest` | eindigt op "Alles goed" |
| De rotonde over de N7 (stap 46) | `npm run rotondetest` | eindigt op "Alles goed" |
| Muren, hekken en vangrails (stap 47) | `npm run scheidingtest` | eindigt op "Alles goed" |
| Snelheid: draw calls, driehoeken, geheugen | `npm run audit` (met `?relief=0` voor de kale stand) | de wereld is sinds stap 22 zes keer zo groot; de meting is nu een vergelijking met de vorige ronde, geen vaste bovengrens |

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
`data/geo/gebied.geojson` is het werkgebied: RD X 169750–174130, Y 557650–560150
(4380 × 2500 m = 10,95 km²) — heel Tinga, de buurt aan de overkant van de N7, de
Lemmerweg naar het oosten, de polder ten zuidwesten en de stad IJlst. Dat is
precies zover als de BGT-download reikt, en daarmee de buitengrens van de wereld.
`data/geo/oorsprong.json` legt het kruispunt Molenkrite / Monnikmolen / Jasker op
RD 172214.98, 559360.95 — die oorsprong staat vast, dus het gebied vergroten laat
alle bestaande coördinaten ongemoeid. Het gebied is in twee stappen gegroeid van
1330 × 1300 m naar wat het nu is; de ronde waarin dat gebeurde staat onderaan bij
*De Lemmerweg en IJlst erbij*.

Het gebied is groter dan één 3D BAG-tegel. Die tegels zijn een quadtree met
wisselende maten (9-632-1008 is 743 × 987 m, 7-624-992 vier keer zo groot), dus
buurtegels zijn niet uit te rekenen — je zoekt ze op de kaart van 3dbag.nl op.
Er liggen er nu vijf onder het gebied: **9-632-1008** (de kern van Tinga),
**9-632-1012**, **9-636-1008**, **8-624-1008** en **7-624-992** — die laatste is
vier keer zo groot als de andere en bevat de hele stad IJlst (2005 panden).
De omzetters lezen álle `.gpkg`- en
`.city.json`-bestanden in `bron/` en ontdubbelen op BAG-identificatie, dus een
tegel erbij zetten is genoeg — er hoeft niets aan de gereedschappen veranderd te
worden.

De ruwe downloads (BGT-CityGML, 3D BAG GeoPackage en CityJSON) staan in
`data/geo/bron/`, de omzetters `bgt2geojson.mjs` en `bag3d2geojson.mjs` maken er
GeoJSON van, en `controle.mjs` keurt het geheel ("Geen problemen").

**Nog niet gedekt.** In de noordoosthoek (RD X 172608–172979, Y 559900–560001)
staan 183 panden aan de Morrahemstraat, Rijperahemstraat, Oosthemstraat,
Folsgaarsterhemstraat en Scherwolderhemstraat die buiten alle vijf de tegels
vallen. Ze staan er nu als opgetrokken grondvlak. Tegel **9-636-1012** vult dat
gat. Aan de westkant van IJlst ligt vermoedelijk hetzelfde probleem: het meest
westelijke pand staat 12 m van de rand van `7-624-992`.

**Generator (stap 3 en 4).**
`tools/geo/genereer.mjs` schrijft `js/kaart.js` (18,4 MB) met:

- 10 889 vlakken ondergrond met klasse, materiaal en hoogte (rijbaan en parkeervlak op
  0, stoep, berm, gras en erf op +12 cm zodat de trottoirband vanzelf ontstaat, water
  op −35 cm met een oeverwand);
- 1161 rijbaanassen (75,2 km) en 3190 padassen, afgeleid uit de vlakken met een
  skelet-algoritme (`skelet.mjs`), met per punt de gemeten breedte en de straatnaam
  uit de BGT-labels; de N7 is met de hand benoemd omdat rijkswegen geen label hebben;
- 7885 panden: 5467 met het LoD 2.2-dakmodel uit 3D BAG (hoekpunten en vlakken per
  pand, gedeelde punten), 2418 zonder model als opgetrokken grondvlak (schuurtjes 2,5 m,
  woningen met huisnummer 5,8 m goot). Dat is 31 % geschat;
- 1781 parkeerplekken uit de parkeervlakken (langs- of haaks naar de breedte van het
  vak), 11 652 bomen gestrooid in bosplantsoen, 19 173 struiken in heestervakken,
  139 hagen, en 2064 lantaarns volgens een plaatsingsregel (om de 30 m langs een
  rijbaanas, alleen op stoep of berm);
- 414 straatnaamlabels en 4658 huisnummers;
- vier sportvelden en de volkstuinen achter de Wieken (zie *Het sportpark en de
  volkstuinen*);
- de houtzaagmolen aan het Sneekerpad in IJlst (zie *Een molen en een supermarkt
  in IJlst*);
- het viaduct Tinga als hoogteveld met stations per meter (zie *Het viaduct*).

`js/kaartwereld.js` bouwt daar de wereld van; `main.js` laadt `kaart.js` en valt
met `?kaart=oud` terug op de oude kaart.

**Controle.**
`tools/geo/bovenaanzicht.mjs` rendert het spel orthografisch van boven op 2 px/m
(4 px/m over 4380 × 2500 m zou 175 megapixels zijn), op dezelfde omhullende als de
kaartplaat, eenmaal in egale klassekleuren en eenmaal zoals het er echt uitziet, en
vergelijkt het eerste pixel voor pixel met `bgt-plaat-kaal.png`, die rechtstreeks
uit de brondata komt. Omdat WebGL niet groter tekent dan 8192 px per kant gaat dat
in stukken, die de tool weer aan elkaar plakt (zie *Bovenaanzicht in stukken*).

| meting | uitkomst |
|---|---|
| afwijkende pixels kaartplaat ↔ spel | **1,59 %** (doel < 2 %) |
| waarvan | randpixels door anti-aliasing; één pand met koepeldak; enkele dakvlakken |

De uitkomst staat in `data/geo/spel-boven.png` (het spel van boven) en
`data/geo/verschil.png` (rood = afwijking). Beide ontstaan met `npm run geo:boven`
bij een draaiende webserver (`npm start`).

Die twee staan **niet in versiebeheer**, en dat is met reden. `spel-boven.png` is
8760 × 5000 px en zesenveertig megabyte, en hij wordt bij elke controle opnieuw
geschreven: hij stond eenenveertig keer in de geschiedenis, samen bijna twee
gigabyte, en daar liep het opslagquotum van GitHub op stuk. Hetzelfde geldt voor
`bgt-plaat.png`. Het zijn uitkomsten van een controle en geen bron; wie ze wil
hebben draait de controle. Voor in de README staat er een verkleinde JPEG van een
halve megabyte in `docs/spel-van-boven.jpg`, gemaakt met
`node tools/geo/verkleinplaat.mjs`.

*En daarna ook uit de geschiedenis.* Ze uit versiebeheer halen stopte de groei
maar haalde niets weg: de `.git`-map was 1,9 GB en bleef dat, want de oude
versies stonden er nog in. Een gewone `git gc --prune=now` haalde er 0,1 GB af —
dat zijn alleen de onbereikbare objecten. De rest zit in de commits zelf en gaat
er alleen uit door de geschiedenis te herschrijven.

Gedaan met `git filter-repo --invert-paths` op de drie platen
(`spel-boven.png` 1153 MB over 25 versies, `verschil.png` 92 MB,
`bgt-plaat.png` 47 MB). Wat er daarna staat is te controleren: de boom van de
laatste commit heeft **exact dezelfde hash** als ervoor, dus aan de inhoud van de
repo is niets veranderd — alleen de historie is lichter. Van 1,9 GB naar 618 MB,
en één commit minder (die bevatte alleen nog maar een plaat en werd leeg).

Let op de laatste stap, want die wordt makkelijk vergeten: de drie takken op
GitHub moesten allemaal opnieuw gepusht worden. Zolang één tak de oude
geschiedenis nog vasthoudt, blijven die 1,3 GB daar gewoon staan en is het
quotum niets opgeschoten.

*En dat was niet waar het quotum op vastliep.* De melding die het pushen en de
build blokkeerde luidde "Artifact storage quota has been hit", en dat gaat over de
**artifactopslag van Actions** — een andere teller dan de grootte van de repo. Het
herschrijven van de geschiedenis hierboven was op zichzelf de moeite waard, maar
het loste deze melding niet op; dat had eerst uitgezocht moeten worden.

Wat er wél aan de hand was: de workflow `windows.yml` bouwde de Windows-app bij
elke push en bewaarde elke build dertig dagen. Eén build is 112 tot 278 MB (de
oudste dateren van vóór de `ignore`-lijst in `tools/pack.mjs`). Op 16 september
stonden er **vierennegentig, samen 18,8 GB**. De build slaagde nog steeds — alleen
`upload-artifact` weigerde, dus er kwam geen .exe meer uit.

Twee ingrepen. De workflow draait voortaan alleen op `workflow_dispatch` en op een
tag `v*`, met `retention-days: 5` in plaats van 30: een .exe maak je op het moment
dat je er een wilt. En er staat een knop bij om op te ruimen
(`.github/workflows/opruimen.yml`): hij haalt alle artifacts weg op de N nieuwste
na, met `alleen_tonen: ja` om eerst te kijken. Die knop moet in de repo staan en
kan niet vanaf hier: verwijderen vraagt `actions: write`, en dat heeft alleen het
token dat GitHub aan een workflow zelf geeft — een gewoon token krijgt 403.

De teller van GitHub loopt zes tot twaalf uur achter, dus vlak na het opruimen kan
het nog even lijken alsof de opslag vol blijft.

**Wat de data zegt.**

- Rijbanen zijn klinkers: in de Tinga-uitsnede waren 603 van de 670 wegdelen open
  verharding, met onderscheid tussen betonstraatstenen (grijs) en gebakken klinkers
  (rood). De N7 en de Buitenroede zijn asfalt. De straatkleur komt dus uit de data,
  niet uit een foto.
- Verkeersdrempels staan erin (27 stuks in Tinga).
- Huisnummers staan op het pand: 4658 in het hele gebied. Een adres opzoeken is een
  tabelvraag.
- Bomen en lantaarnpalen staan er niet in: Súdwest-Fryslân vult de optionele
  BGT-objecten paal, bak en straatmeubilair niet, en van vegetatieobjecten zijn er
  alleen hagen (139 over het hele gebied). Bosplantsoen en heesters staan wél als
  vlakken. Losse bomen en lichtmasten komen daarom uit een plaatsingsregel (nu) of
  uit luchtfoto/OSM (later).
- 2418 van de 7885 BGT-panden hebben geen 3D BAG-model (31 %): grotendeels kleine
  bijgebouwen, de woningen ten noorden van de Buitenroede (vermoedelijk nieuwbouw na
  de 3D BAG-versie), de 183 panden in de noordoosthoek waar nog een tegel ontbreekt,
  en de westrand van IJlst.

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

**Een zwarte koepel in de lucht, en vier dingen die in beeld niet klopten
(stap 8).** Aan de rand van de wijk hing er een zwarte koepel in de lucht die
met de camera meedraaide. Het bleek geen object te zijn: de luchtbol heeft een
straal van 1000 m en stond op de oorsprong, terwijl het achtervlak van de camera
op 1200 m ligt. Sta je 300 m ten oosten van de oorsprong en kijk je naar het
oosten, dan ligt de achterkant van die bol op 1300 m — buiten het achtervlak —
en kijk je door het gat tegen de zwarte achtergrond aan. De bol schuift nu elk
beeld met de camera mee, dus hij staat altijd op 1000 m. De diagnose kwam van
een pixeltelling: tel de zwarte beeldpunten in de bovenste helft van het beeld,
schuif de bol mee, tel opnieuw — 1417 werd 0.

Verder in dezelfde ronde: het **pistool** was klein en de hand hing er los bij;
het model is nu op ware grootte (19 cm) met een vuist om de kolf en een
onderarm die naar de rechteronderhoek uit beeld loopt, en met H stop je het weg
(dan gaat het kruisje uit en schiet je niet). De **vlaggen** bij de supermarkt
lazen aan één kant in spiegelschrift, want één texture op één doos leest aan de
achterkant altijd omgekeerd; het doek bestaat nu uit twee panelen rug aan rug,
net als een echte dubbelzijdig bedrukte banier. En de **achtertuinen tegenover
Molenkrite 15** kregen een schutting van 1,8 m omdat ze met hun achterkant aan
de straat staan; `lageErfscheidingen` in `omgeving.json` maakt daar een lage haag
van, zoals in de rest van de wijk.

Controle: `npm run wereldtest` toetst deze vier dingen (zwarte beeldpunten in de
lucht vanaf de vier hoeken van de wijk, de maten en de H-toets van het pistool,
geen schutting in de vakken met lage erfscheidingen, en het dubbele vlaggendoek)
en eindigt op "Alles goed".

**Sneller maken, en een politie die je kunt afschudden (stap 9).** Het spel
wordt op een telefoon getest en straks op een pc gespeeld, dus eerst is er
gemeten in plaats van gegokt (`npm run audit`, in de wijk bij Molenkrite 15):
1649 draw calls, 1,69 M driehoeken per beeld, 187 MB texturegeheugen. Een
uitsplitsing per herkomst wees drie dingen aan.

*De 329 geparkeerde auto's* stonden er als losse groepjes van zeven meshes — op
straat waren er zeshonderd van in beeld, meer dan de helft van alle draw calls.
Ze zijn nu instanced: zeven meshes per soort voor de hele wijk, met de lakkleur
per instantie (`maakAutoStapel` in `js/carmodel.js`). De auto waar je in stapt
krijgt zijn eigen model met wielen en die instantie gaat op schaal nul.

*De wereldgeometrie* werd per materiaal in één mesh samengevoegd. Dat is zuinig
in draw calls, maar zo'n mesh ligt over de hele wijk en valt dus nooit buiten
beeld: de GPU kreeg elk beeld de complete wijk, ook wat achter je lag. Ondergrond,
trottoirbanden en de 3177 bomen liggen nu in tegels van 240 m. Gevels bleven per
materiaal samengevoegd — die meshes zijn al klein, en tegels erbovenop leverden
alleen draw calls op. Instanced meshes hebben hetzelfde probleem, dus ook de
bomen gingen per tegel en de auto's verdwijnen voorbij 170 m (met de LOD-klok
mee, vier keer per seconde).

*Het texturegeheugen* zat op 187 MB — rond of over wat Safari op een telefoon
aankan, en precies waar haperingen en een herladende pagina vandaan komen. De
gevelplaten gingen van 40 naar 26 beeldpunten per meter met een bovengrens van
2048 px (een blok van vijftien woningen was in zijn eentje 6 MB), en de steen- en
dakpandoeken — tientallen kleurvarianten van 512×512 — worden na het tekenen
verkleind naar 288. Resultaat: **595 draw calls, 1,28 M driehoeken, 82 MB**.

**De politie** (`js/politie.js`) is erbij gekomen, met het gezocht-systeem uit
GTA als voorbeeld. Drie ontwerpkeuzes zijn de moeite waard.

1. *Melden is een kans, geen zekerheid.* Elke misdaad heeft een straal en een
   ernst; de kans dat er gebeld wordt loopt met het aantal getuigen (levende
   mensen binnen die straal met vrij zicht) en met het aantal eerdere misdaden
   die onopgemerkt bleven. Eén slachtoffer in een lege straat komt er vaak mee
   weg, de tweede bijna nooit.
2. *Ze zoeken waar ze je het laatst zagen, niet waar je bent.* Nieuwe eenheden
   duiken op rond dat punt. Hier zat de belangrijkste fout van deze ronde: aan
   het eind van elke beeldstap werd de laatst bekende plek bijgewerkt zolang
   iemand je "zag", en die zichtvlag werd maar vier keer per seconde ververst.
   Eén verouderde vlag gaf dus jouw actuele plek door, en dan kun je nooit
   ontsnappen — de proef liet zien dat vier sterren na honderd seconden nog
   steeds vier sterren waren. Nu wordt die plek alleen geschreven op het moment
   dat iemand je écht ziet.
3. *Rijden doen ze over de weg.* Recht op de speler af rijden loopt na dertig
   meter dood tegen een woonblok. De wagens gebruiken de wegengraaf uit
   `js/navigatie.js` (die er al was voor de routelijn op de kaart) en volgen die
   met een vooruitblik van zes meter — dat geeft een vloeiende lijn in plaats van
   geslinger. Komt een wagen toch klem te staan, dan probeert hij het eerst
   achteruit; lukt dat drie keer niet, dan verdwijnt hij uit beeld en komt er
   verderop een verse aanrijden. Dat is precies wat GTA doet, en beter dan een
   politieauto die eeuwig tegen een schutting staat te duwen.

Controle: `npm run politietest` (zestien controles over meldkans, sterren,
uitrukken, aankomen, schieten, een agent neerschieten en ontsnappen).
`npm run rijtest`, `npm run verhaaltest`, `npm run wereldtest` en
`npm run looptest` blijven groen; `npm run geo:boven` staat nog op 1,31 %.

**Meer blauw op straat, en zoeken in plaats van wachten (stap 10).** Op de
telefoon was de politie nauwelijks te zien met sterren in beeld: er reed één
wagen rond en de agenten stonden op een kluitje bij de melding. Vier dingen
zijn aangepakt.

1. *Meer eenheden, oplopend met de sterren.* Van 3 agenten en 1 wagen bij één
   ster naar 8 agenten en 5 wagens bij vijf — met twee inzittenden per wagen
   zijn dat een stuk of twintig eenheden. De agenten in een wagen stappen uit
   zodra je binnen veertig meter komt.
2. *Ze waaieren uit.* Alle eenheden naar hetzelfde punt sturen gaf een kluitje
   politie op één hoek terwijl de rest van de wijk leeg bleef. Iedere eenheid
   krijgt nu een eigen sector rond de laatst bekende plek (verdeeld met de
   gulden snede, zodat opeenvolgende eenheden nooit naast elkaar uitkomen) en
   een eigen afstand binnen een zoekring die met de sterren meegroeit: 55 m bij
   één ster tot 195 m bij vijf. Dat punt wordt op het dichtstbijzijnde
   wegknooppunt gelegd — anders lopen ze een tuin in — en om de 14 à 26 seconden
   verlegd, zodat ze de straten aflopen in plaats van stil te staan.
3. *Niet in elkaar staan.* Twee eenheden die hetzelfde wegknooppunt kozen kwamen
   op precies dezelfde coördinaat terecht: één poppetje met vier armen. Er komt
   nu een eigen plekje van drie tot acht meter rond dat knooppunt bij (afgeleid
   van de sector, dus vast per eenheid), plus een zacht duwtje uit elkaar als ze
   binnen 1,1 m van elkaar komen — dezelfde truc als bij de voetgangers.
4. *Op de kaart te vinden.* Gewone auto's stonden met hetzelfde blauw op de
   minikaart als de politie. Verkeer is nu grijs en blauw betekent politie; de
   stipjes staan bovendien ook op de grote kaart (M), op een vaste maat in
   beeldpunten, want de hele wijk past daar op nog geen anderhalve pixel per
   meter.

Onderweg viel nog een oude fout op die met twintig agenten in beeld niet meer te
missen was: bij het richten (`mikt` in `js/persoon.js`) draaiden de armen om de
verkeerde kant om de schouder, dus ze staken hun armen naar achteren en van
opzij las je een kruispose. Het teken van die draai is omgedraaid en het wapen
draait mee — dat scheelt ook voor de bewaking op het RWZI-terrein en voor de
dief, die dezelfde poppetjes gebruiken.

Kosten: een volle jacht met vijf sterren kost ongeveer 1,5 ms rekentijd per
beeld en verandert niets aan de 595 draw calls van de wijk zelf.

Controle: `npm run politietest` telt nu twintig controles (in stap 11 komen er
twee bij); de vier nieuwe meten
het aantal eenheden bij één tegen vijf sterren, hoe ver ze van de melding
zoeken, hoeveel er verder dan zestig meter van de melding rondgaan, en dat er
geen twee agenten binnen negentig centimeter van elkaar staan. `npm run
politieshots` maakt de twee foto's. De andere proeven blijven groen.

**De munitiewinkel in de boerderij, en twee fouten die daarbij boven kwamen
(stap 11).** Tinga State is de tweede plek waar je naar binnen kunt. De aanpak
is dezelfde als bij de woning in stap 8: een losse, dichte ruimte ruim buiten
het kaartgebied, met E bij de deur als teleport heen en terug. De maten komen
weer uit de kaart — het grondvlak van 27,9 bij 19,1 m, de goot op 1,94 m en de
nok op 13,32 m — en de piramidekap wordt van binnen als vier schuine vlakken
naar een nokbalk gebouwd. `plattegrond()` en `banden()` uit `js/interieur.js`
worden nu gedeeld in plaats van overgeschreven. In `js/main.js` staan de
binnenruimtes in één lijstje, zodat de deur, de HUD-naam en de botsingsdozen
voor allebei op dezelfde manier werken.

Handel: € 50 voor honderd kogels. Het geld zit in `js/verhaal.js` (daar staat de
portemonnee al voor de beloning van Johan) en er is één methode bijgekomen,
`betaal(bedrag)`, die false geeft als je het niet hebt. Je begint met € 1000 —
ruim, zolang het spel in de testfase zit — en de rest verdien je met de missies.

Twee dingen die pas opvielen doordat er nu naar dit pand gekeken werd:

1. *De politie liep in het echte spel helemaal niet.* In de hoofdlus stond
   `if (!interieur.binnen) player.health -= politie.update(dt)`, en `binnen` is
   een functie — dus altijd waar, en `politie.update` werd nooit aangeroepen.
   Alle proeven riepen `politie.update` zélf aan en zagen het daarom niet: de
   sterren verschenen, maar er kwam nooit iemand opdagen. Dat verklaart precies
   wat er over stap 9 en 10 gemeld werd. Er staat nu een controle bij die naar
   de lus kijkt in plaats van naar de module: vier beelden laten draaien en
   tellen hoe vaak `politie.update` langskomt, buiten én binnenshuis.
2. *Het pannendak van de boerderij had zwarte gaten.* `pannenMetDakramen()`
   tekent het pannendoek op een canvas van 512 px, maar sinds de textures in
   stap 9 verkleind worden is dat doek zelf 288 px — en zonder maat bleef de
   rest van het canvas zwart. Eén `drawImage` met de doelmaat erbij.

Op de kaart staat de winkel als een amberkleurig speldje, op de plek van de
schuurdeur. Op de minikaart wordt de kaartrotatie er weer uitgedraaid en op de
grote kaart wordt hij op een vaste maat in beeldpunten getekend — hetzelfde
recept als bij de politiestippen, om dezelfde reden. `js/hud.js` weet niet welke
winkels er zijn: `main.js` haalt ze bij de binnenruimtes op en geeft ze door met
`zetWinkels`.

Controle: `npm run winkeltest` (drieëntwintig controles over het beginkapitaal,
de deur heen en terug, de maten van de deel, de wanden, de prijs, het geld en de
kogels, de lege portemonnee, en het icoontje op allebei de kaarten — geteld in
amberkleurige beeldpunten op het kaartdoek). `npm run winkelshots` maakt de foto's. De
verhaalproef telt na de beloning nu € 550 in plaats van € 500; verder blijven
alle proeven groen en staat `npm run geo:boven` nog op 1,31 %. Het
texturegeheugen loopt met de binnenruimte mee van 82 naar 83 MB, de draw calls
in de wijk veranderen niet — de deel staat buiten het kaartgebied en valt dus
altijd buiten beeld.


**Lege surveillanceauto's, en schade die je ook ziet (stap 12).** Drie dingen
uit het spelen zelf.

1. *Een wagen waar de agenten uit gestapt zijn reed vrolijk verder.* Dat kwam
   doordat het uitstappen aan het eind van de wagenlus stond en de wagen daarna
   gewoon zijn ronde bleef rijden. Zodra iedereen eruit is gaat hij nu uit de
   lijst `wagens` en over naar `verlaten`: hij staat stil, `driveable` gaat aan
   en het zwaailicht knippert door. Stap je in, dan is hij van jou — de lichtbalk
   wordt opnieuw aan de carrosserie gehangen, want `vehicles.maakBestuurbaar`
   bouwt het model opnieuw op, en de lampen gaan uit.
2. *Ze moeten ook weer weg.* Een lege wagen ruimt zichzelf op na 45 seconden, of
   na 8 zodra de sterren weg zijn — maar alleen als je er niet binnen 45 meter
   staat, want een auto die voor je neus oplost is erger dan een auto te veel.
   Wegrijdende wagens geven het ook eerder op (18 s in plaats van 25). En omdat
   elke wagen twee agenten afzet en daarna uit de lijst verdwijnt, waarna er een
   verse komt, kon het aantal agenten te voet in een lange achtervolging blijven
   oplopen: bij meer dan vier boven het gewenste aantal gaat nu de verste van de
   speler weg, mits hij minstens 25 meter van je vandaan staat.
3. *De politie deed geen schade.* Of beter: je zag er niets van. `politie.update`
   levert de schade terug en `main.js` trok die van `player.health` af, maar
   niemand werkte de levensbalk bij — `hud.update` doet dat niet uit zichzelf.
   Nu gaan `hud.zetLeven` en `hud.flits` mee, net als bij de bewaking op de RWZI.

Controle: `npm run politietest` telt nu drieëndertig controles. De twaalf nieuwe kijken
of de wagen echt blijft staan als de agenten eruit zijn, of je erin kunt stappen,
of hij zichzelf opruimt, of een gestolen wagen blijft staan met zijn lichtbalk,
en of een treffer in de levensbalk en de rode flits terechtkomt.


**Zes dingen uit het spelen (stap 13).**

1. *Je liep dwars door auto's heen.* Te voet gaat de speler alleen langs
   `resolveCollisions` uit `js/world.js`, en daar staan alleen de vaste dingen
   in — auto's bewegen. `js/vehicles.js` heeft er nu `duwUit()` bij: dezelfde rij
   van drie cirkels langs de as die de auto's onderling al gebruiken. `main.js`
   hangt hem als `player.blokkade` aan de speler; na het duwtje gaat de plek nog
   één keer langs de vaste wereld, zodat een auto je niet een gevel in werkt.
   Kosten: onmeetbaar (`player.update` blijft op 0,01 ms).
2. *Er stond ineens politie achter je.* De plaats delict is niet waar jij bent:
   schiet je iemand neer en rijd je weg, dan blijft het zoekgebied achter en kan
   een punt dat keurig zestig meter van de melding ligt vlak achter je rug
   uitkomen. Een nieuwe eenheid begint nu altijd op een rijbaan, minstens 62
   meter van de spéler, en het liefst uit zijn zicht. Die zichteis is zacht: sta
   je midden op een lange rechte straat, dan is bijna alles in de buurt
   zichtbaar en zou er nooit meer iemand komen — dan mag het toch, want de harde
   ondergrens van 62 meter is wat het probleem oploste. En de terugvalplek buiten
   het wegennet is weg: geen agent die uit een voortuin komt.
3. *Agenten kon je niet omverrijden.* `politie.aanrijden()` erbij, met dezelfde
   drempel als bij de voetgangers (stapvoets mag), en `main.js` stuurt de drie
   meetpunten van de auto nu naar allebei. Het kost net zoveel verdenking als
   hem neerschieten.
4. *Verstoppen werkte niet.* Het zicht zelf klopte al — `zietSpeler` gaat langs
   `zichtVrij` — maar wat ze met dat zicht deden niet. Een schot hóren zette
   iedereen binnen 65 meter op 'jacht', en 'jacht' betekende: ren naar de plek
   waar de speler nú staat. Achter een gebouw gaan staan hielp dus niets. Nu
   gaan ze bij een schot naar het geluid en zoeken ze daar, en zonder zicht
   loopt een achtervolger naar de laatst bekende plek in plaats van naar jou —
   met twee seconden speling, zodat hij niet afhaakt zodra je achter een
   lantaarnpaal langs komt.
5. *En ze denken mee.* Op het moment dat de laatste je uit het oog verliest
   schuift de laatst bekende plek 2,5 seconde mee in de richting waarin je
   wegliep, tot het dichtstbijzijnde punt op een straat. Daarna staat hij stil —
   hoe langer je uit beeld blijft, hoe schever hun beeld — en de eenheden
   waaieren er met hun eigen sectoren omheen uit. Dat is het verschil tussen een
   politie die de hoek waar je omging staat aan te staren en een die de straat
   erachter uitkamt.
6. *Heggen en schuttingen misten een zijkant.* De vier hoeken van zo'n balk
   stonden in de verkeerde volgorde, waardoor alle zijvlakken naar binnen keken
   en met een gewoon materiaal wegvielen; je keek er dwars doorheen tegen de
   binnenkant van de overkant aan. Eén regel omgedraaid — het bovenvlak trekt
   zich er niets van aan, want `vlakGeometrie` draait dat zelf recht.

**Scherpte op de pc (G).** MSAA staat er al aan, maar dat vangt alleen gekartelde
randen van driehoeken. Wat in deze wijk flikkert zijn de dunne dingen op afstand:
hekspijlen, dakranden, belijning. Daar helpt alleen op meer beeldpunten renderen
dan het scherm heeft. De teller stond op `min(devicePixelRatio, 1.5)` en dat is
op een gewoon 1×-scherm precies 1,00 — er gebeurde dus niets. Er zijn nu drie
standen (0,75× / 1× / 1,5×), G loopt erdoorheen en de keuze blijft bewaard;
telefoons beginnen op 1× en de proefgereedschappen ook, want anderhalf keer
zoveel beeldpunten op een softwarekaart is alleen maar wachten. De texturen staan
bovendien op het maximale anisotrope filter van de kaart (16 in plaats van 8).

Onderweg viel nog iets op aan de proef zelf: sinds de schade van de politie
écht van je leven af gaat, ging de proefspeler halverwege `politietest` neer,
waarna `main.js` het opgeslagen spel laadt en `politie.reset()` aanroept — en er
nooit meer een eenheid kwam. De hoofdlus staat in die proef nu uit; alleen het
stukje dat juist naar de lus kijkt zet hem voor een paar beelden aan.

Controle: `npm run politietest` (zevenveertig controles), `npm run rijtest` (drie
nieuwe over te voet langs de auto's), `npm run wereldtest` (vier over de
zijvlakken van heggen en schuttingen, vijf over de scherpte). Verhaaltest,
looptest en winkeltest blijven groen, `geo:boven` staat nog op 1,31 % en de draw
calls in de wijk veranderen niet.


**Een tweede woning, licht en uitzicht, en een speeltuintje (stap 14).**

*De Wieken 29.* De woning achter de voordeur van Molenkrite 15 was aan één
adres vastgeschroefd, terwijl de bouwer zelf niets adresspecifieks doet: hij
leest het grondvlak, deelt het met `banden()` in een voorhuis en een aanbouw, en
zet daar de indeling in. De Wieken 29 heeft precies dezelfde vorm (5,38 × 9,58 m
met een aanbouw van 2,37 × 4,49 m, tegen 5,42 × 9,48 en 2,44 × 4,59 aan de
Molenkrite), alleen gespiegeld — de aanbouw zit aan de andere kant. `initInterieur`
krijgt daarom een adres mee en `WONINGEN` somt ze op; `main.js` maakt er één per
regel. De kamers staan 140 m uit elkaar, ver buiten het kaartgebied.

*Uitzicht door het glas.* De ruit was een dicht, licht vlak — logisch, want
achter de kamer was niets. Nu is het glas doorzichtig en staat de buurt eromheen:
de panden binnen vijftig meter worden op hun echte plek, maat en goothoogte uit
de kaart als blokken opnieuw neergezet, omgerekend met een nieuwe
`plan.naarKamer()`, met de straat, de stoep, gras en een paar bomen erbij. Elke
buur krijgt een eigen tint uit zijn pand-id, anders is het één bruine muur aan de
overkant. Het staat in een eigen groep, los van de kamer, zodat de proef die de
omhullende doos van de kamer meet er geen last van heeft.

*Zitten.* `player.zit` slaat het lopen over en zet de ooghoogte op 1,05 m; E bij
de bank zet je erop, met je gezicht naar de tv, en E zet je er weer af.

*Licht.* Er staan geen lampen in de scene — de helderheid zit in de hoekpunten
en in de materiaalkleur — dus 's avonds gaat er een tint over alle vlakken:
binnen warm en iets gedempt (×0,74 / 0,63 / 0,47), buiten donkerblauw
(×0,17 / 0,21 / 0,32). De lampenkap doet niet mee: die springt van gebroken wit
naar vol warm wit en is dan het felste vlak in de kamer. Dat is geen licht dat
schijnt, maar het leest wel zo, en het kost niets: een paar materiaalkleuren per
keer dat de dag omslaat.

*Het speeltuintje achter de Wieken 144.* Vier nieuwe objecten in
`js/props.js` — schommel, speelhuisje, wipwap en glijbaan — plus de zandbak en
het bankje die er al waren. Ze staan in `data/stijl/straten.json` uitgezet vanaf
de voorgevel van 144, met een negatieve `voor` (dus achter het huis) en een
`langs` erlangs; de generator rekent dat om naar wereldcoördinaten. Zo schuiven ze
mee als het grondvlak in de brondata verandert, en staat er geen enkele
coördinaat in de code.

De eerste plaatsing kwam op twintig meter achter het huis uit, en dat is daar nog
de zone van de achtertuinen met de schuttingen en de bomenrand — niet het veld.
De plek is daarom uitgerekend in plaats van geschat: over een raster van een meter
achter het huis is gezocht naar het punt op gras dat zo ver mogelijk van het
dichtstbijzijnde pand, van de rand van het dichtstbijzijnde `erf`-vlak (de tuinen)
en van de bomen af ligt, binnen een redelijke loopafstand. Dat wordt 37 m achter
de gevel: 25 m van het dichtstbijzijnde pand en 18 m van de dichtstbijzijnde tuin.
De proef toetst nu op die twee afstanden, zodat "in het veld en niet in de tuin"
een getal is en geen indruk.

Kosten: 597 → 598 draw calls in de wijk, texturegeheugen 83 → 85 MB, meshes
1256 → 1516. De tweede kamer en de twee kijkdozen staan buiten het kaartgebied en
vallen dus altijd buiten beeld.

Controle: `npm run woningtest` (zevenentwintig controles over de tweede woning,
de deur, het zitten, de lamp, het glas en het speeltuintje). `npm run
verhaaltest` loopt de woning aan de Molenkrite nog steeds helemaal na en blijft
groen, net als rijtest, wereldtest, looptest, winkeltest en politietest;
`geo:boven` staat nog op 1,31 %.


**Het uitzicht echt maken, de gevel rechtzetten en katten (stap 15).**

*Door het raam zag je geen huizen.* De buren stonden er als effen dozen: van
binnen las dat als een lange bruine muur. Ze krijgen nu de échte geveltexture
van hun eigen woningtype mee — dezelfde die de wijk buiten gebruikt en dus uit
dezelfde cache, wat geen geheugen kost. Een doos van three.js legt zijn uv per
zijde van 0 tot 1 en zo'n geveltexture bevat alle woningen van het rijtje naast
elkaar, dus hij past precies over de gevel, net als bij de echte muren.

Twee dingen zaten daarbij in de weg. Ten eerste: welke kant is de gevel? Bij een
rijtje is dat de lange kant van de rechthoek, maar een losse woning in een rij
staat met zijn diepte langs die as, en dan ligt de gevel op de korte kant. Zonder
die toets keek de halve straat je met een blinde zijmuur aan en stonden de nokken
dwars op de weg. `pand.front` weet welke kant het is; komt die overeen met de as
van de rechthoek, dan draait de doos een kwartslag mee. Ten tweede stond het dak
er als een platte doos van soms vijf meter hoog — dat leest als een muur. Het is
nu een echt zadeldak: twee schuine vlakken naar een nok, met de pannentexture en
de uv in meters, en twee gemetselde topgevels op de kop.

*De voordeur aan de Wieken zat aan de verkeerde kant.* In de geveltexture
spiegelen twee woningen om hun bouwmuur heen, zoals in de meeste rijtjes — de een
met de deur links, de buurman met de deur rechts. Aan de Wieken zit hij bij álle
woningen rechts. De stijl zet daarom `deurRechts` en dan vervalt dat om en om.
De proef kijkt naar de texture zelf: waar liggen de beeldpunten met de deurkleur
binnen elke woningbreedte? Aan de Wieken moet dat overal voorbij de helft zijn,
en bij een gewoon rijtje juist om en om.

*Katten.* Eén aan de Molenkrite, twee aan de Wieken (`js/kat.js`). Zwart-wit, 45
cm lang met een schofthoogte van 25 cm — precies de maat van een echte kat, want
naast een bank van 2,10 m valt tien centimeter te groot meteen op. Zitten is geen
tweede model: de achterpoten klappen in, het achterlijf zakt en de staart krult
naar voren. Ze lopen naar een punt dat in de vloervakken van de plattegrond wordt
geprikt en daarna langs `resolveCollisions` gaat: staat er een bank of een
keukenblok, dan komt het punt niet vrij en wordt er een nieuw geprikt. Zo hoeft er
nergens een looproute ingetekend te worden. Eén op de vier keer springen ze op de
bank. Hun materialen zijn dezelfde soort als de kamer (`MeshBasicMaterial` met
licht in de hoekpunten), zodat ze meegaan in de dag- en nachttint — met een
standaardmateriaal zouden ze 's avonds zwart worden in een verlichte kamer.

Kosten: draw calls in de wijk onveranderd (598), texturegeheugen 85 MB, meshes
1516 → 1615.

Controle: `npm run woningtest` (drieëndertig controles; zes nieuwe over de
katten) en `npm run wereldtest` (drie nieuwe over de voordeur aan de Wieken).
Verhaaltest, rijtest, looptest, winkeltest en politietest blijven groen en
`geo:boven` staat nog op 1,31 %.

**Het viaduct over de rondweg (stap 16).**

De weg tegenover de Jumbo (Molenkrite 171) gaat in werkelijkheid over de N7 heen,
met een dijklichaam en een houten boogbrug erbovenop. In het spel lag hij plat.
Dit is de eerste plek waar de wereld hoogte krijgt, en dat raakt meer dan alleen
de meetkunde: de ondergrond, de auto's, de voetgangers, de politie en de speler
moeten het allemaal met hetzelfde antwoord doen.

*Waar het viaduct staat, weet de BGT zelf.* Wegvakken die over iets heen liggen
hebben `relatieveHoogteligging 1`. Rond de Molenkrite zijn dat zes vakken —
rijbaan, twee fietspaden, trottoir en het overbruggingsdeel — plus een `pijler`
in de middenberm. Die eigenschap werd tot nu toe weggegooid; hij gaat nu mee als
`hl` op het vlak. Wat de BGT níét weet is de hoogte: het is een tweedimensionale
kaart. In `data/stijl/omgeving.json` staat daarom alleen wat je van de foto's
afleest — de doorrijhoogte (4,7 m), de dikte van het dek (0,9 m), de twee punten
waar de oprit weer op maaiveld ligt, de helling van het grastalud en de maten van
de houten boog.

*De rest rekent de generator uit.* Tussen de twee voetpunten zoekt hij met
Dijkstra de route over de wegassen — die loopt vanzelf over het dek, want elke
andere weg is honderden meters om. Om de meter komt er een station op met de
hoogte uit een profiel dat recht omhoog loopt met afgeronde uiteinden (de
steilste helling is daardoor een derde meer dan de gemiddelde: 8 %). Per station
tast hij dwars op de as af hoe breed de verharding is en hoe ver het gras
daarnaast doorloopt; dat worden de halve breedte van de kruin en van de teen van
het talud, links en rechts apart. Op het dek telt alleen het dek zelf mee —
zijwaarts ligt daar de rijksweg, en die hoort bij het maaiveld. De middellijn uit
het skelet slingert bij elke aansluiting een halve meter heen en weer; over het
dek wordt hij daarom met kleinste kwadraten rechtgetrokken en gaan de breedtes
door een mediaanfilter, anders staat er een slingerende brug.

*Eén vraag voor de rest van het spel.* `js/viaduct.js` leest dat hoogteveld en
beantwoordt `grondHoogte(x, z, y)`: hoe hoog ligt de grond hier? Buiten het
viaduct is dat nul, en één omhullende-rechthoektest is genoeg om dat vast te
stellen — het kost dus niets in de rest van de wijk. Het derde argument is waar
je nu bent: onder de brug is de grond de rondweg, erboven het dek. Daarmee lopen
de speler (zwaartekracht), de auto's (hoogte en de neus omhoog op de helling),
de voetgangers, de losse poppetjes en de politie allemaal op hetzelfde antwoord.

*De ondergrond gaat mee omhoog.* De BGT-vlakken langs de route worden niet
platgelegd maar per hoekpunt op hoogte gebracht, en driehoeken die langer zijn
dan 2,5 m worden eerst opgedeeld — anders loopt één driehoek van de voet tot de
top van de dijk. Omdat de grasstroken naast de oprit gewoon BGT-vlakken zijn,
ontstaat het talud vanzelf. Twee dingen moesten apart: het dek ligt vlak (een
hoekpunt dat net buiten de gemeten kruin valt zou anders naar het maaiveld
zakken, en dan hangt er een scherf rood fietspad van de brug af), en de vlakken
die eronderdoor lopen vragen de hoogte op y = 0 op, zodat de rijksweg blijft
liggen. Het overbruggingsdeel is één vlak over het hele dek en lag hoger dan de
rijbaan erop; in de wereld zakt het onder het wegdek en dient het als sluitlaag,
op de controleplaat telt het gewoon mee, zodat `geo:boven` niet verschuift.

*Wat erbovenop staat.* Twee houten bogen op de dekranden, elk een parabool van
26 rechte stukken, met zeven trekstangen naar de dekligger en vijf dwarsportalen
tussen de bogen. Daaronder de dekligger met zijn randen dicht, twee landhoofden
tot op de grond en de pijler op het grondvlak dat de BGT tekent. Langs de rand
een houten leuning met palen om de twee meter. De rode fietsstroken komen uit de
BGT-fietspadvakken zelf; alleen de kleur staat in de stijl, want de BGT kent daar
alleen "gesloten verharding".

*Botsen in twee lagen.* De botsingsdozen van het spel zijn plat: ze weten van x
en z, niet van hoogte. De leuning van de brug zou daarmee een onzichtbare muur op
de rondweg zijn, en de pijler eronder zou de auto's op het dek tegenhouden. Een
botsingsdoos kan daarom een `y0` krijgen, en wie eronder of erboven zit loopt er
gewoon langs. Auto's onderling kregen dezelfde test: staat er meer dan 2,5 m
hoogteverschil tussen, dan raken ze elkaar niet.

Kosten: 598 → 599 draw calls in de wijk, 1,28 → 1,36 miljoen driehoeken,
9069 botsingsdozen (103 erbij).

Controle: `npm run viaducttest` (negenendertig controles over de plek uit de
BGT, het hoogteveld, lopen, de leuning, rijden, de houten boog en de wereld
eromheen) en `npm run viaductshots` voor de foto's. Rijtest, verhaaltest,
wereldtest, looptest, politietest, winkeltest en woningtest blijven groen, en
`geo:boven` staat nog op 1,31 %.


**Het wapen en de mensen (stap 17).**

*De boog van het viaduct klopte niet.* Op de foto vanaf het dek zie je twee
brede houten wangen die naar elkaar toe hellen en boven het midden van de
rijbaan bijna samenkomen — een spitsboog. Wat er stond waren twee rechte bogen
op de dekranden met dwarsbalken ertussen, en die balken hingen op ooghoogte:
je reed er bovenop de brug tegen een pergola aan. De wangen hellen nu naar
binnen (bij de voet op de dekrand, bij de top vlak naast de hartlijn), elke wang
is twee evenwijdige gebogen liggers met latten ertussen, en de enige dwarsdelen
zijn twee trekstangen helemaal bovenin. De boogpunten worden tussen de stations
van de as geïnterpoleerd in plaats van op een heel station afgerond, anders zit
er om de meter een knik in.

*En er groeide een boom door de brug heen.* De bomen komen uit de BGT-groenvakken
en die lopen onder het viaduct door; een kroon is ruim vier meter breed en het
dek ligt op 5,6 m. Bomen in de strook onder het dek (plus drie meter marge)
vervallen nu.

*Het pistool.* Het was een slede, een kolf, een vuistje en een mouw — vijf dozen
waar je in de eerste persoon de hele tijd tegenaan kijkt. Nu heeft het de
onderdelen die een pistool werkelijk heeft (slede met grepen en uitwerpopening,
loop, onderstel met stofkap, trekkerbeugel met trekker, korrel en keep, greep met
ribbels, los magazijn) en zit er een hand omheen met vier vingers, een duim en
een wijsvinger aan de trekker. Dat zijn 530 driehoeken tegen 200, maar niet 43
draw calls: alle blokjes van hetzelfde materiaal binnen één onderdeel gaan samen
in één geometrie, dus het blijft bij vijftien meshes.

*Herladen is een beweging geworden.* Vijf stappen in anderhalve seconde — het
wapen kantelt naar je toe, de magazijnknop gaat in, het lege magazijn valt eruit,
een vol magazijn komt van onderen omhoog, de slede gaat naar achteren en weer
naar voren. De stappen staan als fracties in één tabel boven in `js/wapen.js`, en
de geluiden hangen aan diezelfde tabel: zo kunnen beeld en klank niet uit elkaar
lopen. De knal zelf is opnieuw opgebouwd (kraak, gasklap, naijl en een huls die
tikt) met een beetje toonhoogteverschil per schot.

*Terugslag.* Bij elk schot komt er een schok op de camera: ruim anderhalve graad
omhoog en een willekeurig tikje opzij, in een halve seconde terug naar nul. Het
is bewust alleen beeld — `pitch` en `yaw` van de speler blijven staan. Zou de
terugslag je kijkrichting echt verschuiven, dan moet je na elk schot
nacorrigeren, en dan verschuiven ook alle proeven die op een vast punt mikken.

*De mensen.* De voetgangers en de losse poppetjes hadden allebei hun eigen
stapeltje dozen, met andere maten, en armen en benen uit één stuk. Een been dat
van heup tot voet één plank is zwaait als een klok. `js/lichaam.js` is nu de
enige maatvoering: een volwassene van 1,75 m met borstkas en taille, een bekken,
een hoofd met neus en oren, handen, schoenen, en ledematen met een elleboog, een
knie en een enkel. `loopHouding()` geeft de stand van alle gewrichten bij een
gegeven pas; npc.js en persoon.js gebruiken allebei die uitkomst, dus een
wandelaar en een agent lopen precies gelijk.

Twee dingen die je meteen ziet als je ze niet doet. De knie mag maar één kant op
— anders knikt hij bij de helft van de pas achterstevoren. En het lichaam moet
bij elke pas een centimeter of vijf zakken: met gespreide benen sta je lager dan
rechtop, en zonder die zak zweven de voeten boven de stoep. De proef rekent dat
na en laat er hoogstens een centimeter van over.

*Kosten.* Bij de voetgangers zijn het nu elf soorten onderdelen in plaats van
acht. Delen die links én rechts zitten kregen niet twee instanced meshes maar één
met twee instanties per persoon, anders waren het er zeventien geworden. En de
oude tekenlus maakte per lichaamsdeel per persoon twee nieuwe quaternionen —
tweeduizend allocaties per beeld; die zijn eruit. Netto is `npcs.update`
sneller geworden (1,31 → 0,90 ms) terwijl er meer te tekenen valt.

Draw calls in de wijk: 599 → 606, driehoeken 1,36 → 1,39 miljoen.

*Twee wankele proeven eruit.* `npm run politietest` viel na deze ronde één op
de drie keer om, op twee plekken: hoeveel eenheden er verderop zoeken, en of er
een lege surveillanceauto achterblijft. Dat leek een regressie, maar was het
niet: de proef doet dezelfde twee metingen aan een systeem dat op `Math.random()`
draait, en de terugslag en het mondingsvuur trekken elk schot een paar getallen
extra uit die reeks. Met de oude code op een verse werkkopie viel dezelfde proef
net zo goed om zodra je hem vaak genoeg draaide (2 van de 6 metingen onder de
drempel). Het aantal eenheden verder dan zestig meter is nu het hoogste getal
over de hele meting in plaats van een momentopname, en de proef met de lege
wagen meldt tot drie keer opnieuw in plaats van eindeloos door te stappen.

Controle: `npm run wapentest` (veertig controles over het model, het schieten,
de terugslag, het herladen met zijn geluidsvolgorde, de bouw van een mens, de
looppas en een agent) en `npm run viaducttest` (nu ook: geen boom door het dek).
Rijtest, verhaaltest, wereldtest, looptest, politietest, winkeltest en
woningtest blijven groen en `geo:boven` staat nog op 1,31 %.


**De wereld vergroot (stap 18).**

De wereld ging van 730 × 870 m naar **1330 × 1300 m**: heel Tinga plus de buurt
aan de overkant van de N7. Puur uitbreiding — de oorsprong ligt vast op het
kruispunt Molenkrite / Monnikmolen / Jasker, dus geen enkele bestaande coördinaat
verschuift. Dat is ook gemeten: tegenover de vorige versie is er geen pand
verdwenen, staan 1238 van de 1327 panden byte-voor-byte gelijk, en van de 89
gewijzigde kregen er 26 een echt 3D-dak in plaats van een schatting, werden er 42
compleet (hun grondvlak liep vroeger de oude rand uit) en veranderde bij 55 de
gevelrichting minder dan een graad. Alle 118 gewijzigde vlakken liggen precies op
de oude gebiedsgrens.

De BGT-download in de repo bleek al 4,3 × 2,5 km te dekken, dus daar was niets
voor nodig. De 3D BAG-tegels wel: `data.3dbag.nl` is vanaf hier niet bereikbaar
(de netwerkpolitie van de omgeving blokkeert het), dus die zijn met de hand
aangeleverd. `bag3d2geojson.mjs` en `genereer.mjs` lezen nu álle tegels in
`data/geo/bron/` en ontdubbelen op BAG-identificatie; zie
[data/geo/README.md](../data/geo/README.md) voor welke tegels er liggen en welke
er nog ontbreekt.

Wat de wereld nu is: 3695 vlakken, 401 rijbaanassen (22,2 km), 2506 panden (1839
met 3D-dak), 49 straten, 779 auto's en 14 980 botsingsdozen. `js/kaart.js` groeide
van 2,9 naar 5,5 MB.

*Twee dingen die pas bij deze omvang stukgingen.*

De **minikaart** tekende elk beeld álle wegvakken, waterpartijen, auto's en mensen
van de hele wereld, ook wat honderden meters buiten het kaartje viel. Dat kostte
2,9 ms per beeld. `js/hud.js` knipt nu eerst weg wat buiten de getekende cirkel
ligt (`nabij` en `doosNabij`, met de waterpolygonen één keer voorgerekend). Wat
eruit valt was toch niet te zien, dus het beeld blijft precies hetzelfde:
`hud.update` ging naar 0,9 ms en het totaal aan JavaScript per beeld van 5,4 naar
ongeveer 3,0 ms — minder dan de kleine wereld vóór deze ronde kostte. Op de grote
kaart (M) liepen bovendien de straatnamen door elkaar heen: dat waren er 65 en het
zijn er nu 123. `drawLabels` legt de langste straten eerst neer en slaat een naam
over die over een al geplaatste heen zou vallen, zodat wat er staat leesbaar is.

De **politie** kwam niet meer opdagen, om twee redenen die allebei met de omvang
te maken hebben. `spawnPlek` trok zestig keer een willekeurig punt van een
willekeurige rijbaan en keek of het toevallig in de ring van 55–150 m rond de
melding lag; in een wereld die vier keer zo groot is lukt dat bijna nooit meer,
dus viel de zoektocht met de zichteis leeg en week hij uit naar "dan maar in het
zicht" — er dook politie voor je neus op. Er ligt nu een rooster van 50 m over de
rijbaanpunten, zodat er meteen uit de buurt getrokken wordt en de kans op een
goede plek niet meer van de wereldgrootte afhangt. En een eenheid die uitrukte
kreeg alleen zijn éérste doel bij de melding; haalde hij dat niet binnen zijn
zoektijd van veertien tot zesentwintig seconden, dan kreeg hij een punt op de
volle zoekstraal. In de kleine wijk viel zo'n punt nog terug op een straat in de
buurt, maar nu liggen daar echte straten en reed de hele ploeg langs je heen de
wijk uit in plaats van bij je uit te stappen. Uitrukken houdt nu vast aan de
melding (tot `UITRUK_STRAAL` = 22 m, want een vijfde van de zoekstraal was bij
vijf sterren 39 m — net buiten de veertig meter waarop ze uitstappen), en wie het
niet binnen zijn zoektijd haalt geeft de melding op en gaat zoeken.

*En twee proeven die aan de wereld vastzaten in plaats van aan het spel.* De
wereldtest keek of de zijvlakken van een heg naar buiten kijken door alle
driehoeken binnen drie meter van het midden te pakken; in de dichtere wereld
staan daar nu vier andere heggen, en die kijken vanaf dat midden gezien naar
binnen. De proef zoekt nu op afstand tot de hartlijn van díe heg. De politietest
koos als plaats delict "de eerste Molenkrite-as in de lijst", en die volgorde komt
uit de gegenereerde kaart: de proef schoof daardoor vanzelf vijfhonderd meter naar
het oosten, naar een lus waar een surveillancewagen die honderd meter verderop
begint een kilometer moet omrijden. Hij kiest nu de Molenkrite-as die het dichtst
bij de nulmeter ligt.

Foto's: `npm run wereldshots` maakt de grote kaart en twee straten aan de overkant
van de N7.

Controle: rijtest, verhaaltest, wereldtest, looptest, politietest, winkeltest,
woningtest, viaducttest en wapentest zijn groen (politietest vier keer achter
elkaar), `geo:boven` staat op **1,28 %** (na het sportpark 1,29 %) en `propcheck` geeft dezelfde vijf
meldingen als vóór deze ronde. Let op: draai de proeven **één voor één**. Drie
headless browsers tegelijk op software-rendering maakt ze zo traag dat
tijdgevoelige controles omvallen aan de machine, niet aan het spel.

**Het sportpark en de volkstuinen (stap 19).**

Twee plekken die als leeg groen in het spel lagen terwijl er in werkelijkheid
iets staat. Allebei op dezelfde manier gebouwd als het viaduct: het vlak komt
uit de BGT, in `data/stijl/omgeving.json` staat alleen een punt erin en hoe het
eruitziet, `tools/geo/genereer.mjs` rekent de rest uit de brondata uit, en
`js/sportveld.js` en `js/volkstuin.js` bouwen de wereld.

*Kunstgras stond in de data, maar niet in het spel.* De twee velden van VV Sneek
Wit Zwart en de twee hockeyvelden ernaast staan in de BGT als `gesloten
verharding` met `plus_fysiekVoorkomen` **`kunststof`** — de IMGeo-term voor een
kunstgrasmat. De keten keek alleen naar `bgt_fysiekVoorkomen`, dus lagen die
27 743 m² als grijs asfalt in de wereld. Er is nu een klasse `kunstgras`, in
`genereer.mjs` én in `plaat.mjs`, zodat de kaartplaat en het spel het er nog
steeds over eens zijn en `geo:boven` er niet op reageert.

*De velden van VV Sneek Wit Zwart (Molenkrite 132).* Een BGT-vlak is een
polygoon zonder richting; om er lijnen, doelen en borden omheen te zetten moet je
weten hoe het veld ligt. De generator zoekt daarom per veld de **kleinste
omhullende rechthoek** — bij een convexe vorm ligt één zijde daarvan altijd langs
een zijde van de vorm zelf, dus het is genoeg om elke zijde als richting te
proberen — en dat geeft het midden, de lange as en de maten. Het speelveld ligt
daarbinnen met een uitloopstrook van 3,5 m en nooit groter dan de 105 × 68 m die
de KNVB toestaat; wat eruit komt is 105 × 68, 100 × 64, 103 × 68 en 100 × 64 m.
`js/sportveld.js` zet daarop de belijning (middencirkel 9,15 m,
strafschopgebied 16,5 × 40,32 m, doelgebied 5,5 × 18,32 m, strafschopstip op
11 m, hoekcirkels van 1 m), twee doelen van 7,32 × 2,44 m met een net, en rond
het hoofdveld een ring van 120 reclameborden, een ballenvanger van 6 m achter de
doelen, een spijlenhek langs de kant, twee dugouts en vier lichtmasten. Om de vijf borden staat dat
van **Radio Spannenburg**, de lokale omroep die de club sponsort: het logo wordt
op een canvas getekend (`bordSpannenburg` in js/textures.js), net als het
Jumbo-woordmerk, want er zitten geen plaatjesbestanden in dit spel. De overige
borden dragen geen bestaand merk: dat zijn de gekleurde vlakken en woordbeelden
die je op een sportpark ziet.

Twee dingen aan die borden klopten niet en zijn meteen rechtgezet. Het doek was
512 bij 96 px voor een bord van 3 bij 0,9 m, dus alles wat erop stond werd in de
breedte samengeknepen; het is nu 512 bij 154, dezelfde verhouding als het bord.
En de achtergrondkleur werd uit de toevalsreeks getrokken, wat bij vier van de zes
varianten dezelfde amberkleur opleverde — er stonden rijen van vier gele borden
naast elkaar. Elke variant heeft nu zijn eigen kleur.

*Volkstuinen achter de Wieken.* Het perceel tussen de twee sloten staat in de
BGT als één stuk gras van ruim 18 000 m²; de tuintjes zelf zijn te klein om
geregistreerd te worden. De generator legt het perceel op zijn eigen richting
(de langste zijde), houdt 8 m grasrand vrij langs de sloot en zet in wat
overblijft rijen tuintjes rug aan rug met een pad ertussen — 58 stuks van 8,2 bij
14,2 m. Een tuintje komt er alleen als het er hélemaal in past, dus de randen
volgen vanzelf de bocht van de sloot. `js/volkstuin.js` bouwt per tuintje
omgespitte grond met bedden gewas, een lage haag of een gaashekje met een poortje
aan de padkant, bij 33 een schuurtje, bij 22 een kasje met een aluminium frame en
een zadeldakje, en hier en daar een regenton of een bonenstaakrek. Je kunt overal
tussen de bedden door lopen; alleen de randen, de schuurtjes en de kassen houden
je tegen.

*Drie dingen die misgingen en wat ze leren.* Een driehoek die je van boven ziet
moet **met de klok mee** gewonden zijn, anders wijst zijn normaal de grond in en
zie je hem niet: de belijning, de maaibanen, de paden en de bedden waren
aanvankelijk allemaal onzichtbaar. Een **PlaneGeometry** legt zijn texture één
keer over het hele vlak, dus een ballenvanger van 76 bij 6 m werd een paar brede
balken in plaats van een net; `gaasVlak` rekent de uv nu in meters om. En de
maaibanen kunnen niet in de texture van de ondergrond zitten, want die krijgt
zijn uv uit de wereldcoördinaten en de velden liggen schuin — dan lopen de banen
diagonaal over het veld. Ze liggen er nu als aparte banen overheen, in de
richting van het veld zelf.

Controle: `npm run sporttest` (38 controles over de brondata, de vier velden, de
belijning, de doelen, de bordenring inclusief de borden van Radio Spannenburg aan
alle vier de kanten, het erlangs en erop lopen, en de volkstuinen: binnen het perceel, de grasrand, de paden, de schuurtjes, en of je
er doorheen kunt lopen). `npm run sportshots` maakt de foto's.

**Het doel omgekeerd, bomen op het veld, en de BGT-omzetter voor meer steden
(stap 20).**

Twee fouten die de gebruiker op zijn telefoon zag, allebei terug te voeren op één
regel code.

*Het doel stond met zijn rug naar de goede kant.* Het net hangt achter het doel,
dus buiten het speelveld. In `js/sportveld.js` telt `dw` zijn eerste getal op bij
de doellijn `s * hl`, en daar stond `-s * diep`: het net hing het veld ín. Naar
buiten is dezelfde kant op als `s`. De proef kijkt nu of alle hoekpunten van het
net voorbij de doellijn liggen, dus dit kan niet meer stil terugkomen.

*Er groeiden bomen midden op het veld.* De twee grasvelden staan in de BGT als
groenvoorziening van meer dan 600 m², en dat is precies waar de parkbomenregel
grote bomen in strooit — er stonden er vijfentwintig op het ene veld en negentien
op het andere, plus achttien struiken. Een voetbalveld is geen gazon: alles wat
binnen het BGT-vlak van een sportveld terechtkomt gaat er nu weer af (36 stuks),
dezelfde aanpak als bij de bomen onder het brugdek. Wat vlak achter de doellijn
staat blijft staan; dat is gewoon de bomenrij achter het veld.

*En de BGT-omzetter kan nu meer dan één download aan.* `bgt2geojson.mjs` las één
zip; zonder argument leest hij nu álle `bgt_*.zip` in `data/geo/bron/` en voegt ze
samen, ontdubbeld op lokaalID plus plek. Dat laatste is nodig omdat een
straatnaam een paar keer langs dezelfde straat staat en die punten hun lokaalID
delen — op het lokaalID alleen hielden we van de 123 labels er 54 over. Met de
ene download die er nu ligt komt er byte-voor-byte hetzelfde uit als eerst; het is
puur voorbereiding op een tweede stad (zie *Wat nog niet af is*, punt 2).

Controle: `npm run sporttest` (41 controles; erbij: het net achter het doel, en
er groeit niets op de velden). Alle proeven blijven groen.

**De tribune, en het veld op kunnen komen (stap 21).**

*De tribune was een bakstenen muur.* Langs de zijlijn van het hoofdveld staat een
overdekte tribune, en die stond in het spel als een gewoon pand: een blok van 45
bij 14 m met een baksteengevel. Wat je er in het echt van ziet — betonnen
traptreden met stoeltjes, een vlak luifeldak op kolommen met een reclamerand —
staat nergens in de brondata.

De aanpak is dezelfde als bij de rest van het sportpark: in
`data/stijl/omgeving.json` staat onder het veld alleen het **BAG-pandnummer** van
de tribune plus hoe diep de treden zijn, hoeveel er zijn en hoever het dak
uitsteekt. `genereer.mjs` zoekt dat pand op, kijkt welke kant van het veld het op
ligt, en levert de voorgevel, de lengte (45,3 m) en de goothoogte (5,84 m).
`js/sportveld.js` zet de treden vóór die gevel neer, in de strook tussen de
zijlijn en het pand — precies wat je op de foto vanaf het veld ziet: eerst de
reclameborden, dan de treden met stoeltjes, dan de gevel van de kantine, en het
luifeldak eroverheen. Het pand zelf blijft gewoon staan en is de achterwand. Het
hek loopt niet door vóór de tribune, want daar is de tribune de afscheiding.

*En je kon het veld niet op.* De ring reclameborden en het spijlenhek sloten het
veld helemaal af. Twee dingen erbij:

- Bij de **middenlijn** zit nu een opening van 5 m in het hek, zoals het poortje
  waar de spelers het veld op komen.
- Over de **reclameborden** spring je heen. Een bord is 90 cm hoog, maar zijn
  botsingsdoos krijgt een `y0` en een hoogte van 60 cm. Een sprong komt tot 88 cm
  (`vy` 4,6 m/s tegen 12 m/s² in `js/player.js`), en een doos met `y0` telt niet
  meer zodra je voeten boven `y0 + h` zitten — dat geeft een ruime halve seconde
  waarin je eroverheen bent. Lopend word je nog steeds tegengehouden, en auto's
  ook: die geven geen hoogte mee aan `resolveCollisions`, en dan geldt de doos
  onverkort.

*Het doel stond al goed.* De omgekeerde doelen die op de telefoon te zien waren,
waren de bouw van vóór stap 20; die fout was in dezelfde ronde al verholpen.

*En nog een proef die op geluk dreef.* De politietest wacht op een wagen die zijn
bemanning laat uitstappen, en die viel één op de drie keer om: een wagen kan
onderweg vast komen te staan, en dan komt er op díe plek nooit iemand uit. De
proef schuift nu bij elke nieuwe poging vijfentwintig meter op langs de rijbaan
(vier pogingen in plaats van drie), zodat hij niet van één plek afhangt. Dat de
politie zelf vast kan lopen blijft staan — dat hoort bij de overhaul die onder
*Wat nog niet af is* punt 3 staat.

Controle: `npm run sporttest` (46 controles; erbij: lopend kom je niet over de
borden, springend wel, er zit een opening in het hek, de rest van het hek houdt je
tegen, en aan de tribunekant kom je er niet langs). Alle tien de proeven zijn
groen, politietest drie keer achter elkaar.

**De Lemmerweg en IJlst erbij — de wereld op zijn volle maat (stap 22).**

*De brondata was al veel groter dan het werkgebied.* Bij de vorige ronde stond
hier dat de BGT niet tot IJlst reikt. Dat klopte niet: de GeoJSON-bestanden in
`data/geo/bron/` zijn geknipt op `gebied.geojson`, dus die zeiden alleen iets over
het gebied van toen. De ruwe download (`bgt_tinga.zip.zip`) blijkt **4,3 bij 2,5
km** te beslaan: Tinga, de Lemmerweg naar het oosten, de polder ten zuidwesten, en
in de zuidwesthoek de hele stad **IJlst**. Les voor de volgende keer: meet de bron,
niet wat de keten ervan heeft overgehouden.

Het werkgebied is nu die volle uitsnede: RD X 169750–174130, Y 557650–560150,
**4380 × 2500 m = 10,95 km²**, zes keer zo groot als daarvoor. Verder naar buiten
is er geen ondergrond meer, dus dat is meteen de buitengrens van de wereld.

| | Tinga + overkant N7 | nu, met Lemmerweg en IJlst |
|---|---|---|
| gebied | 1,73 km² | **10,95 km²** |
| panden | 2506 | **7885** (5467 met 3D-dak) |
| rijbaan | 22,2 km | **75,2 km** |
| straten | 49 | **155** |
| `js/kaart.js` | 5,8 MB | 18,4 MB |

*Drie meshes die de hele wereld beslaan, en dus nooit buiten beeld vallen.* Het
tekenen liep van 2,7 naar 7,8 miljoen driehoeken per beeld, en dat kwam niet
doordat er meer in beeld staat maar doordat drie dingen in één mesh voor de hele
wereld zaten: het **riet** langs het water (2,1 miljoen driehoeken in één mesh),
de **struiken** (19 173 bollen in één InstancedMesh) en de **geparkeerde auto's**
(bijna achttienhonderd, in één stapel per soort — en die stapels zetten
`frustumCulled` zelfs expliciet uit). Alle drie staan nu per tegel, net als de
ondergrond en de bomen, en de auto's mogen weer gecullld worden. Daar kwam nog
bij dat het **achtervlak van de camera** vaststond op 1200 m terwijl de mist bij
helder weer al op 900 dichtslaat: dat loopt nu met de mist mee (en de luchtbol
schaalt mee, anders kijk je door zijn achterkant heen tegen een zwart gat aan).

*Twee lussen die met de wereld meegroeiden.* `resolveCollisions` liep elk beeld
door álle botsingsdozen — 55 889 nu — voor de speler én voor elke voetganger en
auto. Er ligt een rooster van 12 m overheen; alleen de schuifpoort van de
waterzuivering staat er buiten, want die verhuist. En de minimap liep door alle
wegvakken en sloten van de wereld; die hebben nu ook een rooster.

*En de gevels.* 155 straten geven veel meer verschillende rijtjes, en elk rijtje
is een eigen doek: het texturegeheugen liep naar 215 MB. Op 21 px/m in plaats van
26, en afgekapt op 1600 in plaats van 2048 px, komt het op 157 MB — nauwelijks
meer dan de 141 MB die de kleine wereld kostte.

Wat het nu kost, gemeten met `npm run audit`:

| | klein | nu |
|---|---|---|
| driehoeken (Molenkrite, het drukste punt) | 2,71 M | 4,33 M |
| draw calls | 837 | 1467 |
| texturegeheugen | 141 MB | 157 MB |
| botsingsdozen | 15 479 | 55 889 |
| JavaScript per beeld | ~3,0 ms | 4,5 ms |
| wereld bouwen (headless) | 5,4 s | ~31 s |

Die bouwtijd is het punt dat blijft staan: hij loopt recht evenredig met de
oppervlakte, en de hele wereld wordt bij het starten opgebouwd terwijl je er maar
negenhonderd meter van ziet. Dat vraagt om alleen bouwen wat in de buurt is, en
dat is een verbouwing op zich (zie *Wat nog niet af is*).

*De audit mat al die tijd één plek.* Hij zette wel `player.pos` maar riep nooit
`applyCamera()` aan, en las `renderer.info` terwijl de hoofdlus stillag — dus
gaven alle plekken exact hetzelfde getal. Hij tekent nu zelf één beeld per plek
met de teller op nul, en er staan vier plekken bij in het nieuwe gebied.

Controle: alle tien de proeven zijn groen. Drie ervan zaten aan de oude
wereldgrootte vast en zijn rechtgezet: de rijtest telde op veertien meshes voor
alle geparkeerde auto's (nu per tegel), de wereldtest pakte voor de heggenproef de
eerste heg uit de lijst en kreeg de kopse vlakken van de buurman mee (hij zoekt nu
een heg waar binnen vijf meter geen andere staat), en de sporttest ging uit van
precies vier kunstgrasvelden — IJlst heeft zijn eigen sportpark.

**Bovenaanzicht in stukken: de meting was stuk, niet de wereld (stap 23).**

Meteen na die ronde meldde `npm run geo:boven` **48,41 %** afwijkende pixels,
terwijl de eis < 2 % is. Dat is het soort getal waar je niet omheen kunt: óf de
wereld deugt niet, óf de meting niet.

Hoe het gevonden is, in deze volgorde — elke stap sloot iets uit:

1. **De kleurhistogrammen van beide platen naast elkaar.** Ze kwamen bijna
   overeen (gras 20,9 tegen 22,1 miljoen pixels, water 4,7 tegen 3,7). Als de
   generator een klasse verkeerd zou indelen, zou juist dáár een gat zitten. Dus
   geen klassefout.
2. **De verschilparen.** Water → gras kwam net zo vaak voor als gras → water. Zo
   symmetrisch is alleen een verschuiving.
3. **Zoeken naar die verschuiving,** ±14 px in beide richtingen. Het vlak was
   overal 48,2–48,8 %: geen kleine verschuiving.
4. **Dezelfde uitsnede uit beide platen naast elkaar gezet.** Twee heel andere
   plekken — en dát was het moment dat duidelijk werd dat het om veel meer dan
   een paar pixels ging.
5. **Grof zoeken over schaal én verschuiving.** Schaal 1,00 gaf 57 % gelijk,
   schaal 1,069 gaf 65 %. En 1,069 = 8760 / 8192.

`MAX_VIEWPORT_DIMS` is in deze browser 8192 px. Het gebied is 4380 m breed, op
2 px/m dus 8760 px. Chrome verkleint het tekenvlak dan zelf, met behoud van de
verhouding, en rekt het beeld daarna weer uit naar de maat van het doek. Het
resultaat *zag er goed uit* — Sneek rechtsboven, IJlst linksonder, alles op zijn
plek — maar stond 7 % te groot en een paar honderd pixels verschoven, en dus was
langs elke weg, sloot en perceelgrens alles rood. Geen enkele foutmelding.

`js/main.js` tekent het bovenaanzicht nu in stukken van hoogstens 8192 px
(`window.__bovenRaster` zegt hoeveel er nodig zijn, `window.__boven(ix, iy)`
tekent er één), en `tools/geo/bovenaanzicht.mjs` plakt ze op een canvas weer aan
elkaar. Uitkomst: **1,59 %** in 2×1 stukken.

Twee lessen. Ten eerste: een controle die met de wereld meegroeit moet zelf ook
gecontroleerd worden — deze had een harde bovengrens waar niemand aan dacht. Ten
tweede: geloof een groot getal niet meteen als een oordeel over het werk. Het
verschilbeeld liet rode lijnen zien langs *alles*, en dat patroon hoort bij een
systematische fout in de meting, niet bij een wereld die op honderd plekken
verkeerd staat.

**Slimmere agenten (stap 24).**

De vier punten van de politie-wensenlijst uit de vorige ronde, alle vier in
`js/politie.js`:

- **Een schot is een aanwijzing.** `meldTreffer()` zet de laatst bekende plek op
  waar de speler op dat moment staat en draait alle eenheden die kant op. Hij
  wordt aangeroepen als een agent geraakt wordt (`raak`) én als een
  surveillanceauto geraakt wordt (`raakWagen`) — ook als die kogel alleen de lak
  raakt. Vanuit een hoekje blijven schieten kan dus niet meer.
- **Niet iedereen stapt uit.** Uitstappen gebeurt alleen binnen veertig meter
  én onder `UITSTAP_SNELHEID` = 8,3 m/s (30 km/u). Daarboven blijven ze zitten en
  gaat de achtervolging in de auto door.
- **Wegblokkades** vanaf vier sterren: twee wagens dwars over de rijbaan, tussen
  110 en 260 m vóór de speler, op een punt waar hij géén zicht op heeft
  (`zichtVrij` moet vals zijn) en dat vóór hem ligt gemeten aan zijn snelheid.
  Hoogstens twee tegelijk, en ze worden opgeruimd zodra de verdenking onder de
  vier sterren zakt of de achtervolging voorbij is. De twee wagens staan kop aan
  staart dwars over de rijbaan en spannen samen bijna negen meter. Ze stonden
  eerst achter elkaar, allebei dwars, met 1,9 m ertussen — dat blokkeert de weg
  niet breder dan één auto lang, en op de foto zag je er ook maar één. Het was de
  foto die dat aan het licht bracht.
- **Auto's kunnen ontploffen.** Tien kogels van elk tien schade op honderd, en
  `js/vehicles.js` zet de auto zwart, zet `wrak`, maakt hem onbestuurbaar en
  hangt er een vuurbal met rook overheen die in 2,6 s uitdooft
  (`werkKnallenBij`). De knal laat de buurt schrikken, geldt voor de politie als
  een schot en doet binnen negen meter zeer. Wrakken van politieauto's gaan mee
  in het opruimen van de achtervolging.

Waar de eenheden en de blokkades vandaan komen kwam eerst uit de hele lijst
rijbaanassen; dat leverde in de grote wereld punten aan de andere kant van IJlst
op. Er ligt nu een rooster van 50 m over de rijbaanpunten (`puntenRond`), zodat
er alleen in de buurt gezocht wordt.

Controle: `npm run politietest` telt nu 64 controles — achttien nieuwe in een
negende hoofdstuk, één per gedrag. Foto's: `npm run politieshots` maakt er twee
bij, `politie_blokkade.png` en `politie_wrak.png`.

*Wat het toetsen zelf opleverde.* De nieuwe proeven vielen de eerste keren om, en
in drie gevallen lag dat aan de proef en in twee aan het spel:

- **De verste eenheid** werd als momentopname aan het eind gemeten. De speler
  staat op de plaats delict, dus na twee minuten hebben ze hem gevonden en staan
  ze om hem heen — verste 50 m, terwijl er onderweg elf eenheden verder dan
  zestig meter zochten. Nu is het het hoogste getal over de hele proef.
- **De uitstapproef liet de speler eerst stilstaan** tot er een wagen in de buurt
  was, en ging daarna pas rijden. Maar stilstaan is precies de toestand waarin ze
  wél uitstappen: in de snelle proef stonden ze al buiten voordat het rijden
  begon. Heen en weer rijden hielp niet (bij elke ommekeer zakt de geschatte
  snelheid door nul) en rondjes rijden ook niet (bij 50 km/u haalt geen wagen je
  in, dus dan is er niets te meten). Nu wordt de wagen met de hand
  vijfentwintig meter achter de speler gehouden: de regel gaat over de snelheid,
  niet over de vraag of de achtervolging aankomt.
- **Er werd geteld op `w.agenten`** — maar zodra de laatste eruit stapt haalt
  `verlaatWagen` de wagen uit de lijst en maakt hij die array leeg, dus het leek
  alsof er niemand was uitgestapt. De bemanning wordt nu vooraf apart gezet.
- **In het spel:** een teleport vervuilde de snelheidsschatting. Naar binnen en
  naar buiten gaan is een teleport (`js/interieur.js`), en zo'n sprong gedeeld
  door een zestigste seconde is honderden meters per seconde. Daarna zette de
  politie een wegblokkade "vóór" de speler in een richting waar hij nooit heen
  ging. Sprongen die geen auto kan maken (meer dan 60 m/s) tellen nu niet mee, en
  `reset()` begint de schatting opnieuw.
- **In het spel:** zonder richting geen blokkade. Sta je stil, dan is er geen
  "vóór je", en telde elke kant even zwaar — dan kon hij dus net zo goed áchter
  je komen te staan. Nu wacht hij tot je ergens heen gaat.

Eén oude controle was wisselvallig: die op de lege surveillanceauto mislukte
ongeveer één op de drie keer omdat een wagen vast kan komen te staan. Hij schuift
nu per poging 25 m op langs de weg. Alle tien de proeven zijn groen, politietest
twee keer achter elkaar.

**Een molen en een supermarkt in IJlst (stap 25).**

Twee panden die er als naamloos blok bij stonden, allebei in IJlst: **De
Dassenboarch 32** (supermarkt Poiesz) en **Sneekerpad 16**.

*De Poiesz* gaat zoals elk bijzonder pand: een regel met het BAG-pandnummer in
`data/stijl/straten.json` en een eigen woningtype in `HOUSE_STYLES`. Wat er
veranderd moest worden aan de winkelgevel die de Jumbo al had: die was
Jumbo-geel ingebakken. De band heet nu `huisstijl` in plaats van `geel`, met
`merk` en `merkKleur` erbij — de Poiesz krijgt een zilvergrijze band met het
groene woordmerk. En er is een `puiDeel` bijgekomen: de Jumbo is onder de luifel
helemaal glas, maar de Poiesz is voor het grootste deel gewoon een bakstenen
doos met onderlangs een glazen pui. Zonder dat getal stond er een winkel van
zesenveertig bij dertig meter volledig in het glas.

*De molen* kon niet als pand. Het 3D BAG-model van een molen is een puntenwolk
die de roeden meevangt: in de hoogteband van 8,7 tot 11,1 m boven het maaiveld
lopen de stralen van 1,35 tot 6,63 m uit het hart. Opgetrokken tot een gebouw
leverde dat de witte klomp van twintig meter op die de gebruiker in het spel
zag staan. Daarom bouwt `js/molen.js` er een echte molen, en slaat
`js/kaartwereld.js` het pand over — behalve op de platte controleplaat, want
`geo:boven` vergelijkt grondvlakken en daar hoort de molen gewoon als pand mee
te doen.

Wat er wél uit de data komt, en dat is meer dan je zou denken:

| uit de data | |
|---|---|
| het hart van de romp | het zwaartepunt van de 3D BAG-punten net boven de goot, 26 cm van het middelpunt van de omhullende rechthoek — de twee bevestigen elkaar |
| de stelling | de goot van het pand: 7,52 m. Bij een stellingmolen ís de goot de stelling |
| de tophoogte | de nok: 20,66 m |
| de zaagloodsen | het grondvlak (28,0 x 13,6 m) en de richting van de omhullende rechthoek (134°) |
| dat het een monument is | bouwjaar 1683 |

En wat niet: de straal van het achtkant, de vlucht van het gevlucht (19,4 m) en
de kruirichting. Die staan als opgemeten waarden in `data/stijl/straten.json`,
met erbij waaróm ze daar staan. De kruirichting kán ook niet uit een bestand
komen: een kap draait met de wind mee. Hij staat op 78°, naar het Sneekerpad
toe, zodat je vanaf de weg het hele gevlucht ziet draaien in plaats van de
zijkant ervan.

Het gevlucht draait op 4,5 omwentelingen per minuut — ruim dertien seconden per
rondje. Het hangt in een eigen `THREE.Group` aan de kop van de bovenas, met de
lokale z-as langs die as (volgorde `YXZ`: buiten de kruirichting, daarbinnen de
helling van de as, en daarbinnen het draaien zelf). `js/world.js` werkt het bij
vanuit `updateProps()`, waar de drinkende figuren ook al in staan.

*Twee dingen die bij het bouwen misgingen.* De eerste: `plaats()` gaf een
gedeelde matrix terug, net als in js/sportveld.js. Dat gaat goed zolang je hem
meteen gebruikt, maar in `plaats(...).multiply(plaats(...))` overschrijft de
tweede aanroep de eerste voordat er vermenigvuldigd is, en dan staat het
hekwerk in het hart van de molen in plaats van aan het eind van de roede. Hij
maakt er nu elke keer een nieuwe. De tweede: de kap was net als de romp met riet
gedekt en liep er naadloos in door, zodat je niet meer zag dát het een losse kap
was. Hij is nu met hout beschoten en steekt een halve meter over de romp heen.

Verder is elk vlak in `js/molen.js` zelfcorrigerend: je geeft mee waar "buiten"
ligt en het vlak draait zichzelf om als de normaal de andere kant op wijst. Dat
is niet uit netheid — het is de derde ronde waarin een vlak onzichtbaar bleek
omdat zijn normaal de grond in wees, en bij een achtkant is de goede volgorde
niet uit de code af te lezen.

Controle: `npm run molentest` (vierendertig controles: de maten uit de data, dat
het opgetrokken pand echt weg is, dat elk onderdeel er staat, dat het gevlucht
draait op het opgegeven aantal toeren, dat de roeden over de stelling strijken
zonder hem te raken, dat je niet door de molen heen loopt en dat er vanaf de weg
niets vóór staat, en voor de Poiesz dat het woordmerk groen op de gevel staat
met baksteen erboven). `npm run molenshots` maakt de foto's. Alle elf de proeven
zijn groen en `npm run geo:boven` blijft op 1,59 %.


**De Poiesz van binnen (stap 26).**

De supermarkt in IJlst was tot nu toe een gevel. Nu kun je er naar binnen, en
daar staat een winkel: `js/supermarkt.js`, de derde binnenruimte na de woning
(`js/interieur.js`) en de boerderij (`js/boerderij.js`) en op precies dezelfde
manier gebouwd — het pand op de kaart is een holle 3D BAG-huls, dus de ruimte
staat als losse dichte doos vierduizend meter buiten het kaartgebied, en de deur
is een teleport. Zo staat hij ook niet op de controleplaat en blijft `geo:boven`
op 1,59 %.

De maat komt uit de kaart (41,6 bij 30,7 m hal, plafond op 3,4 m onder een goot
van 4,63 m); de inrichting komt van vier foto's van deze winkel:

| op de foto | in het spel |
|---|---|
| oranje kopschotten met *Extra voordeel* aan elk gangpad | zeven dubbele schappenrijen met aan beide einden een kopschot |
| blauwe diepvrieswand met glasdeuren en een fotobalk | de rechterwand, met twee eilanden met vrieskisten ervoor |
| groene Poiesz-wand boven de versbalie | de achterwand links, met de balie eronder |
| blauwe zuivelwand | de achterwand rechts |
| kassa's met lopende banden | vijf, vlak bij de ingang |
| personeel in groen met oranje | vijf medewerkers, met het logo op de borst |

*Het logo op een poppetje.* De eerste poging zette een gevelbreed shirtdoek als
texture op de romp van de `Persoon`. Dat werd een medewerker met een wit shirt en
groene mouwen: de romp is uit drie dozen samengevoegd, en dan valt niet te
zeggen welk stukje van de tekening op de borst uitkomt. Het logo hangt nu op een
eigen lapje van 22 bij 8 cm vóór de romp, met het groene shirt en het oranje
schort van de `Persoon` zelf eronder. Een vlak waarvan je de uv kent is meer
waard dan een vlak dat toevallig groot genoeg is.

*Bier.* Vijf euro per flesje, tien levenspunten erbij, niet boven de honderd.
Vanaf het derde flesje deint het beeld: `js/player.js` houdt `dronken` bij (0 tot
1), de camera rolt en dobbert op drie golven met verschillende perioden zodat het
nooit op hetzelfde punt terugkomt, en `js/hud.js` legt er een warme waas
overheen (`backdrop-filter`, met een vignet eronder voor browsers die dat niet
kunnen). Het zakt in een minuut weg.

Twee dingen die het toetsen opleverde, allebei in het spel en niet in de proef:

- **de flesjesteller liep door.** Wie eerder op de dag drie flesjes op had, was
  van het eerstvolgende flesje meteen weer scheef — ook een half uur later,
  allang nuchter. De teller gaat nu terug op nul als je een minuut lang niets
  gedronken hebt.
- **er bleef een restje waas hangen.** `zetDronken` sloeg veranderingen kleiner
  dan 0,02 over om niet elk beeld aan de stijl te zitten, en de laatste sprong
  van 0,018 naar nul haalde die drempel niet. Nul is nu altijd nul.

Eén oude controle in `politietest` was wisselvallig: die keek na het stelen van
een lege surveillanceauto naar het *aantal* lege wagens in plaats van naar díe
wagen, en terwijl je instapt kan er verderop een tweede ploeg uitstappen. Hij
kijkt nu naar de wagen zelf.

Controle: `npm run poiesztest` (vierendertig controles) en `npm run poieszshots`
voor de foto's. Alle twaalf de proeven zijn groen, politietest en poiesztest
twee keer achter elkaar, en `npm run geo:boven` blijft op 1,59 %.


**Reliëf en glans uit de kleurdoeken (stap 27).**

De vraag was hoe de belichting en de texturen op de pc beter kunnen. Er kwamen
vijf punten uit; dit is punt 1 (normal maps) en punt 2 (roughness maps, en het
natte wegdek dat daar meteen uit volgt). Punt 3 (ambient occlusion), 4 (scherpere
schaduw dichtbij) en 5 (de omgevingsreflectie met de klok mee opnieuw bakken)
staan nog open.

*Het idee.* Er zit geen enkel plaatje in dit spel: elke texture wordt op een
canvas getekend. Een canvas geeft kleur, en kleur alleen is vlak. Wat ontbrak is
niet meer detail in de tekening maar de andere twee doeken die een
`MeshStandardMaterial` kan gebruiken: de richting van het oppervlak en de
ruwheid. Die zijn nergens vandaan te halen — behalve uit het kleurdoek zelf. Dus
worden ze op de pc bij het opstarten **afgeleid**, in `zetReliëf()` in
`js/textures.js`, en kost het geen enkel bestand.

| doek | waar het uit komt | wat het doet |
|---|---|---|
| normal map | luminantie van het kleurdoek → Sobel → normaal | licht valt op de bovenkant van de steen, de voeg blijft donker; het reliëf draait met de zon mee |
| roughness map | kwart maat, 1 px vervaging, dan drie soorten uit elkaar gehaald | ruiten spiegelen de lucht (0,10), verf zit ertussen (0,55), steen blijft mat (0,92) |

Elk kleurdoek krijgt bij het tekenen een *soort* mee (`baksteen`, `dakpan`,
`klinkers`, …) in een `WeakMap`. Die soort bepaalt of er reliëf op komt en hoe
sterk: baksteen 2,2, damwand 1,5, riet 1,3, planken 1,2, asfalt en gras 0,5. Een
doelnet of een reclamebord staat niet in de lijst en houdt zijn vlakke doek.

Vier dingen die niet vanzelf goed gingen, alle vier gemeten en niet geraden:

- **Het groene kanaal moest `+dy`, niet `-dy`.** Op een canvas loopt y naar
  beneden, maar three zet `flipY` op een texture, dus v loopt in de shader naar
  boven. De proef zet daarom een lichte blok op een donker doek en kijkt of de
  normaal aan de linkerrand naar links wijst en aan de bovenrand naar boven.
- **Baksteen moet van de *omgekeerde* hoogte komen.** `brick()` tekent de voeg
  lichter dan de steen; recht overgenomen werd elke voeg een randje in plaats van
  een groef. De proef rekent beide varianten uit en eist dat de map op de
  omgekeerde uitkomt (afwijking 0,0 tegen 135,3).
- **Gevels krijgen geen normal map.** In een gevelplaat is het licht al
  meegetekend: dorpels, negge, slagschaduw onder de dakrand. Een normaal die je
  daaruit haalt vecht met de zon. Een gevel krijgt dus alleen de glansmap. Van de
  785 materialen kregen er 111 reliëf en 643 glans.
- **Op halve maat was er niets te zien.** De eerste ronde leverde
  voor-en-naplaatjes op die nauwelijks verschilden. Een voeg in het metselwerk is
  1,3 cm en het steendoek staat op 111 beeldpunten per meter, dus die voeg is
  anderhalve pixel breed; halveer je dat doek voor de hoogtelezing, dan verdwijnt
  hij in de vervaging en houd je een vlakke muur over. De normal maps gaan nu op
  volle maat (de doeken zijn ≤ 512 px, dus dat kost een paar MB). De glansmap mag
  wél op een kwart: die scheidt vlakken, geen lijntjes.

*Nat wegdek.* Met de ruwheid in de hand is regen op straat bijna gratis:
`js/world.js` geeft de vijf wegmaterialen (asfalt, grijze en rode klinkers,
stoeptegels en fietspad) door aan `sfeerMaterialen()`, en
`js/sfeer.js` zet bij regen de ruwheid op 0,35, de kleur 28 % omlaag en de
metalness op 0,12. De oude waarden staan in `userData.droogRuw` en
`userData.droogKleur`, zodat het opdrogen exact terugzet in plaats van ongeveer.

*Wat het kost,* met `npm run audit` twee keer gemeten, met en zonder `?relief=0`:

| | zonder | met |
|---|---|---|
| texturegeheugen | 169,4 MB | 212,9 MB |
| doeken | 784 | 1501 |
| texturen in de GPU | 496 | 966 |
| shaderprogramma's | 31 | 33 |
| wereld bouwen | 28,9 s | 36,0 s |
| javascript per beeld | 4,14 ms | 4,16 ms |
| draw calls / driehoeken | 1467 / 4,33 M | onveranderd |

Dus 44 MB en 5,5 s bij het opstarten — waarvan het uitlezen van de 643
gevelplaten het grootste deel is — en per beeld niets. Daarom staat het op een
telefoon uit (`!IS_TOUCH`) en is er `?relief=0` om het op de pc ook uit te zetten;
dat is tegelijk de schakelaar waarmee de proef en de voor-en-naplaatjes de twee
standen naast elkaar zetten.

*Standpunten kiezen.* Reliëf zie je alleen bij strijklicht, en de zon staat in
`js/sfeer.js` op een vaste baan met een noordcomponent. Voor `tools/beeldshots.mjs`
zijn de standpunten daarom niet op het oog gekozen maar gerekend: uit `js/kaart.js`
de muurvlakken die niet met een buur gedeeld worden, met de vrije ruimte ervoor,
en daarbij de klokstand waarop de zon er onder een hoek van 20 tot 30 graden
overheen strijkt. Voor de gevel-close-up hielp dat niet: welke muur een gevelplaat
krijgt en welke kale steen hangt van `kant` in `kaartwereld.js` af, niet van de
lengte, dus twee gerekende standpunten leverden allebei een kale kopgevel op. Dat
is uiteindelijk met een straal­proef in de draaiende wereld gevonden (schiet
stralen rond en meld `userData.klasse`).

Controle: `npm run relieftest` (drieëndertig controles: zijn de maps er, staan ze
lineair, wijzen de normalen naar buiten, klopt de richting op een kunstmatig blok,
komt baksteen van de omgekeerde hoogte, glimt het glas en blijft de steen mat,
wordt het wegdek nat en precies weer droog, blijft het geheugen onder 260 MB, en
geeft `?relief=0` nul maps) en `npm run beeldshots` voor de paren. Alle dertien de
proeven zijn groen en `npm run geo:boven` blijft op 1,59 % — het bovenaanzicht
rendert in platte klassekleuren, dus daar kan reliëf per definitie niet aan zitten.

**Eerst meten: waar de tijd heen gaat (stap 28, begin van de optimalisatieronde).**

Het spel werd trager na de vergroting van de wereld (stap 22). Voor er één regel
verbeterd wordt, is uitgesplitst waar het werk zit: `npm run optimeer`
(`tools/optimeer.mjs`) telt driehoeken en draw calls per klasse op vier
standpunten, meet de schaduwpas apart, en zet de javascripttijd fijner uiteen dan
`audit.mjs` deed.

*De eerste vondst is dat de meting zelf een gat had.* In `WebGLRenderer.render()`
van de gevendorde three staat `info.reset()` een paar regels **ná**
`shadowMap.render()` (`lib/three.module.js:29594` en `:29600`). De schaduwpas
tekent dus wel, maar zijn tellers worden meteen weer op nul gezet. Elk getal dat
`audit.mjs` ooit gemeld heeft — ook de tabel in de README — was alleen de
beeldpas. Met `info.autoReset = false` en zelf resetten vóór het tekenen komt de
schaduw er wel bij. Bijkomende fout in de meting: de zon werd niet meeverhuisd
naar het standpunt, zodat de schaduwdoos bleef staan waar de hoofdlus hem het
laatst had gezet en elke plek precies dezelfde schaduwpas gaf. Beide
gereedschappen zetten de doos nu zelf om de camera, zoals `js/main.js:719` doet.

Wat er per beeld werkelijk staat te gebeuren, op het zwaarste standpunt
(Molenkrite begin, 1280 × 720):

| | beeldpas | schaduwpas | samen |
|---|---|---|---|
| draw calls | 1467 | 416 | **1883** |
| driehoeken | 4,33 M | 1,50 M | **5,83 M** |

En de javascripttijd per beeld:

| lus | ms |
|---|---|
| `hud.drawMap` (de minikaart) | **2,97** |
| `vehicles.updateTraffic` (1781 auto's) | 1,14 |
| `npcs.update` (130 mensen) | 0,72 |
| `player.update` | 0,33 |
| `world.updateProps`, `updateLOD`, `resolveCollisions` | 0,005 elk |
| som | **~6,3** |

Op 60 beelden per seconde is het budget 16,7 ms, dus het javascript eet er nu al
ruim een derde van — en op een telefoon is dat drie tot vijf keer zoveel.
`resolveCollisions` staat er met 56.036 colliders op 0,005 ms: dat is dus al
netjes geïndexeerd en geen probleem.

Waar de driehoeken zitten, over de hele wereld geteld:

| bron | aantal | driehoeken elk | totaal |
|---|---|---|---|
| geparkeerde auto's (instanced, 7 delen) | 1781 | ~1116 | **2,0 M** |
| boomkronen (`IcosahedronGeometry`, twee schalen) | 15.635 | 80 + 20 | **1,56 M** |
| riet langs de sloten (193 losse meshes) | — | — | **1,17 M** |
| struiken (`SphereGeometry`) | 19.173 | 36 | 0,69 M |
| stoepbanden (`rand`, 162 meshes) | — | — | 0,51 M |
| boomstammen (`CylinderGeometry`) | 7665 | 24 | 0,18 M |

*En de belangrijkste structurele vondst.* De ondergrond, de bomen en de
geparkeerde auto's staan per tegel van 240 of 480 m, zodat frustum culling zijn
werk kan doen. **De panden niet.** `groep()` in `js/kaartwereld.js` bundelt per
materiaalsleutel over de hele kaart, dus er is één mesh met alle muren van dat
type, één met alle dakkapellen, één met alle schuttingen en één met alle heggen.
Hun omhullende bol is 2200 tot 2400 m — de halve wereld:

| klasse | meshes | driehoeken | grootste bol |
|---|---|---|---|
| `muur` | 75 | 166.379 | 2350 m |
| `schutting` | 1 | 123.360 | 2227 m |
| `heg` | 1 | 102.440 | 2223 m |
| `dak` | 13 | 49.413 | 2358 m |
| `dakkapel` | 5 | 42.830 | 2286 m |
| `platdak` | — | 31.479 | 2329 m |

Dat is een halve miljoen driehoeken die van élke plek in de wereld getekend
worden, in de beeldpas én in de schaduwpas, ook als je in IJlst staat en er geen
enkele van in beeld is. Het is dezelfde fout die bij de ondergrond al eens is
opgelost, alleen bij de panden nooit gemaakt.

**De optimalisatieronde (stap 29).**

Van de zeven punten uit stap 28 zijn er zes opgepakt; de geparkeerde auto's
eenvoudiger maken (punt 3) heeft de gebruiker laten liggen. Wat er per ingreep
uitkwam, allemaal gemeten met `npm run optimeer` op het zwaarste standpunt
(Molenkrite begin, 1280 × 720), niet beredeneerd:

*Het javascript.* Van 6,3 naar 1,83 ms per beeld.

| lus | voor | na |
|---|---|---|
| `hud.update` (de minikaart) | 4,06 | **0,31** |
| `vehicles.updateTraffic` | 1,14 | **0,53** |
| `npcs.update` | 0,72 | 0,60 |
| `player.update` | 0,33 | 0,29 |
| som | 6,3 | **1,83** |

De minikaart was het niet aan zijn tekenwerk kwijt maar aan de straatnamen:
`drawLabels` liep elk beeld door alle vierhonderdveertien labels van de hele
wereld, elk met een botsingstoets tegen alles wat er al stond, terwijl er in het
rondje van eenennegentig meter dertien passen. Met een rooster over de labels —
hetzelfde middel dat de wegen en de sloten al hadden — gaat dat van 2,02 naar
0,07 ms. Een tempolimiet op de kaart, die in het plan stond, is daarmee niet meer
nodig: hij blijft elk beeld meedraaien en dus vloeiend.

Bij het verkeer zat de eerste poging ernaast. Twintig rijdende auto's die elk de
lijst van 1781 geparkeerde auto's afgingen zijn 35.620 toetsen per beeld, dus
kwam er een rooster over de geparkeerde auto's. Dat hielp niets (1,14 → 1,29 ms).
Nameten binnen de functie wees uit dat het niet de toets was maar het *aflopen*
van de lijst — en daar stond na de verbouwing nog een lus over alle 1781 in, om
de auto's met een eigen model eruit te vissen, twintig keer per beeld. Die lijst
wordt nu één keer per beeld gemaakt: 0,53 ms.

*Het tekenwerk.* Van 1830 naar 1752 draw calls en van 5,83 naar 3,84 miljoen
driehoeken (beeldpas + schaduwpas samen).

| klasse | voor | na |
|---|---|---|
| geparkeerde auto's | 2.063.632 / 183 | (nog te doen, punt 3) |
| boomkronen | 1.046.200 / 128 | **537.640 / 66** |
| struiken | 482.436 / 32 | **113.580 / 5** |
| boomstammen | 342.104 / 68 | **258.500 / 26** |
| muren | 319.319 / 90 | **141.880 / 162** |
| stoepbanden | 272.816 / 36 | **52.074 / 6** |
| schuttingen | 246.720 / 2 | **33.820 / 10** |
| heggen | 204.880 / 2 | **22.910 / 11** |
| riet | 123.160 / 33 | **33.240 / 7** |
| daken | 97.036 / 15 | **40.612 / 36** |
| dakkapellen | 85.660 / 10 | **34.676 / 25** |
| platte daken | 63.598 / 6 | **33.132 / 13** |
| gevels | 57.102 / 628 | 57.102 / 628 |
| schaduwpas | 1.499.252 / 363 | **936.525 / 386** |

Wat er veranderd is:

- **Bomen op twee maten.** Elke boomtegel heeft nu dezelfde kronen twee keer,
  fijn (tachtig vlakken) en grof (twintig), met dezelfde matrices; `updateLOD`
  laat er één van staan en klapt om op honderdzeventig meter. De grove is zes
  procent groter, want een icosaëder van detail 0 ligt binnen die van detail 1
  en anders krimpt het silhouet bij de overgang. Stammen en de bobbel bovenop
  gaan bij tweehonderdzestig respectievelijk honderdzeventig meter helemaal uit.
- **Afstandsgrenzen op wat te klein is om te zien.** Een trottoirband is dertien
  centimeter, een schuttingplank zes, een rietpol twintig; op tweehonderd meter
  is dat minder dan een beeldpunt. Stoepbanden, oeverwanden, struiken, riet,
  schuttingen en heggen gaan per tegel uit. Het vlák van de stoep blijft staan,
  dus er valt geen gat in de grond.
- **Heggen en schuttingen in tegels van 240 m.** Die stonden als één mesh voor de
  hele kaart in de scene, samen 451.600 driehoeken met een omhullende bol van
  2227 m.
- **De panden in tegels.** Kale baksteen, dakpannen, platte daken en
  dakkapelwangen delen hun materiaal met honderden panden, dus dat was één mesh
  met alle muren van Sneek én IJlst: 319.319 driehoeken met een bol van 2350 m,
  die van élke plek in de wereld getekend werden. De gevels blijven bewust per
  materiaal samengevoegd: elke gevelplaat is een eigen materiaal dat maar bij een
  handvol panden voorkomt, dus die meshes zijn al klein.
- **De schaduwkaart om het beeld.** Die kostte een vijfde van al het tekenwerk en
  heeft niets met het beeld zelf te maken. Een beeld oud is hij nooit te zien:
  de doos volgt de speler en die staat na één beeld acht centimeter mis. Riet,
  struiken en de grove boomkronen werpen geen schaduw meer — een rietpol geeft
  een vlekje dat tegen het gras wegvalt, en de grove kroon komt nooit binnen de
  schaduwdoos van tweeënvijftig meter.

*Twee dingen die niet werkten en waarom.* Ze staan hier omdat het meten ze
uitwees en het beredeneren ze had gemist.

- **Tegels zijn niet altijd goed.** Het vlakke tuinspul — tegelpaden,
  grindtuinen, tegeltuinen, hekjes, belijning — is samen maar 22.000 driehoeken.
  Opgeknipt in tegels kostte dat 149 draw calls in plaats van 5, en dat is de
  verkeerde kant op: een telefoon is gevoeliger voor draw calls dan voor
  driehoeken. Alleen de twee zware (heg en schutting, samen 451.600) zijn
  getegeld; de rest is teruggedraaid.
- **De maat van de pandtegel is een ruil.** Fijner knippen haalt driehoeken weg
  en kost draw calls, want een muurmateriaal komt in veel tegels voor. Gemeten
  over de vier standpunten samen:

  | pandtegel | draw calls | driehoeken |
  |---|---|---|
  | 240 m | 6333 | 10,00 M |
  | 480 m | 5860 | 10,20 M |
  | **960 m** | **5627** | **10,48 M** |

  Van 240 naar 960 m is dat 706 draw calls minder voor 482.000 driehoeken meer.
  Een draw call kost op een telefoon in de orde van tien microseconden en een
  half miljoen driehoeken ruim minder, dus 960 m. Het staat als `PAND_CEL` in
  `js/kaartwereld.js` en is met dit tabelletje na te meten.

*En twee gaten in de meting zelf.* Beide zaten er al voordat deze ronde begon.

- `optimeer` en `audit` riepen `updateLOD` nooit aan, zodat alles wat met
  `lodAan` is aangemeld nog op zijn beginstand stond — en dan tekenen de fijne
  én de grove boomkroon tegelijk. De eerste meting na de bomenronde was daardoor
  *slechter* dan ervoor (1.162.600 in plaats van 1.046.200 driehoeken kroon).
  Beide gereedschappen doen nu wat de hoofdlus doet.
- `bouwKaartWereld` krijgt geen module maar een handgeschreven lijstje mee, en
  `lodAan` stond daar niet in. De aanroepen in `kaartwereld.js` hadden een
  `if (W.lodAan && …)` ervoor en werden dus stil overgeslagen: stoepbanden en
  oeverwanden bleven 272.816 driehoeken kosten terwijl de code er al stond. De
  guard is weg — ontbreekt `lodAan`, dan hoort dat een fout te zijn en geen
  stilte.

**De twee blokken aan de Keizersmantel in Duinterpen (stap 30).**

Op Keizersmantel 437 zit een Poiesz op de begane grond van een gebogen blok van
drie lagen, en het blok ernaast (441-485) is in dezelfde trant. Beide staan op
een rij ronde zuilen met de winkelpui een paar meter naar achteren.

*Wat uit de data komt.* De twee BAG-panden 0091100000019594 en 0091100000019595
hebben 46 en 45 hoeken in hun grondvlak — dat is de gebogen plattegrond — en een
3D BAG-model dat als muur tot 11,73 en 11,53 m doorloopt met maar vijf
dakvlakken. De goot op 3,95 en 4,01 m is niet een dakrand maar precies de rand
van de zuilengang. Beide blokken buigen om hun eigen parkeerterrein heen: het
zwaartepunt van de parkeervakken ligt op (1297, 296) en (1349, 305), aan de holle
kant, en dat is waar de zuilen en de ingang aan liggen. Ze vielen tot nu toe
onder de regel voor een grondvlak boven 300 m² en kregen daarmee het naamloze
`spil`-type (open punt 10 hieronder, nu voor deze twee weg).

*Wat van de foto komt:* de kleuren (roodbruine steen, cremekleurige band langs
de dakrand, antracietgrijze kozijnen bij de Poiesz en witte bij de buur), de
dikte van een zuil, hun onderlinge afstand en de diepte van de pui. Dat staat per
pand in de `bron` in `data/stijl/straten.json`.

*Waarom een eigen module.* Een gevelplaat is één plat vlak op de rooilijn, en die
kan een terugliggende pui niet laten zien — je zou tegen een dichte wand met een
tekening van winkelramen aankijken. `tools/geo/genereer.mjs` haalt daarom de boog
uit het grondvlak en zet de zuilen erop; `js/zuilengang.js` bouwt de zuilen, de
pui, het plafond van de gang en het woordmerk; en `js/kaartwereld.js` knipt de
muur van zo'n pand op de ganghoogte af met het bestaande `knipOpHoogte`.

Vier dingen die niet vanzelf goed gingen, alle vier gevonden door te meten of te
kijken en niet door te beredeneren:

- **De boog werd niet gevonden.** De eerste versie zocht randen waarvan de
  buitennormaal naar het parkeerterrein wijst, met een drempel van 0,35 op het
  inproduct. Bij de Poiesz kwam de hoogste waarde niet boven 0,29 uit en meldde
  de generator "geen boog gevonden". Dat komt doordat het blok *om* zijn
  parkeerterrein heen buigt: het doel ligt er vlak naast, dus de richting erheen
  loopt bijna langs de gevel. Wat de boog eruit haalt is niet de scherpte van de
  hoek maar de eis dat een rand minstens 2,5 m lang is — de gebogen voorgevel
  bestaat uit stukken van zeven meter, de kopse kanten uit stukjes van
  anderhalf. Met dubbele hoekpunten eruit (de BGT zet er soms twee op een paar
  centimeter) geeft dat bij beide blokken een boog van 56 m over negen punten.
- **De pui stond op de parkeerplaats.** "Naar binnen" werd uitgerekend als de
  richting van de boog naar het hart van de omhullende rechthoek. Bij een
  halvemaanvormig grondvlak ligt dat hart in de holte, aan dezelfde kant als het
  parkeerterrein, dus wees die richting naar buiten en kwam de hele winkelpui
  2,4 m vóór de zuilen langs te staan. De richting komt nu per stuk boog uit de
  generator, met de punt-in-veelhoektoets die daar toch al staat.
- **Twee woonlagen in wit plaatmateriaal.** Na het afknippen valt de onderkant
  van de muur samen met de goot, en `muurKeuze` houdt elk vlak dat boven de goot
  begint voor de wang van een dakkapel — 3D BAG trekt die namelijk door tot de
  grond. Het blok stond daarmee als een wit gebouw met donkere lintramen in het
  spel. De vlag `gang` gaat nu bij de bron op het pand en niet pas na het
  knippen: vlakken die al boven de gang beginnen gaan die knip niet in en hadden
  de vlag anders niet.
- **Spleten in de pui.** Elk stuk boog werd langs zijn eigen normaal naar binnen
  geschoven. Dat klinkt goed, maar dan sluiten twee stukken op een knik in de
  boog niet op elkaar aan en staat er een verticale spleet tussen — je zag het
  gras achter de winkel erdoorheen. Het verschuiven gaat nu per hóekpunt, met
  het gemiddelde van de twee stukken eromheen, zodat opeenvolgende vlakken hun
  hoekpunten delen.

En twee dingen die de proef zelf verkeerd deed, wat de moeite van het vermelden
waard is omdat het dezelfde valkuil twee keer is:

- een omhullende doos om dit grondvlak is 59 bij 69 m en vangt dus de buren en
  het parkeerterrein mee. Muren, gevels en dakkapellen staan per materiaal
  samengevoegd in één mesh per tegel van 960 m, dus daarmee telde de proef de
  dakkapellen van de hele buurt aan dit blok toe;
- een punt-in-veelhoektoets valt op de grens willekeurig uit, en een
  muurhoekpunt ligt juist precies op die grens. De proef telt nu de hoekpunten
  die binnen 60 cm van de omtrek liggen.

Controle: `npm run duinterpentest` (vierendertig controles: de boog, de
richtingen, de zuilen, de gevel erboven en het lopen eromheen) en
`npm run duinterpenshots` voor de foto's.

**Twee fouten uit het spel gehaald (stap 31).**

*Het spel werd traag zodra je een ster had.* `zichtVrij` in `js/world.js` liep
voor élk stapje langs de kijklijn door álle botsingsdozen: dertig stappen maal
zesenvijftigduizend dozen is 1,7 miljoen toetsen voor één kijklijn. Gemeten
kostte één aanroep over zestig meter **19,2 ms**, en omdat elke agent en elke
wagen per beeld kijkt of hij je ziet — en `spawnPlek` zestig kandidaten toetst —
stond `politie.update` bij drie sterren op **13,1 ms per beeld**. Dat is het hele
budget van 16,7 ms, dus het spel zakte in zodra de politie uitrukte.

Het rooster dat `resolveCollisions` gebruikt (0,001 ms bij dezelfde
zesenvijftigduizend dozen) lag er al. Elke doos staat daarin in alle cellen die
zijn omhullende cirkel raakt, dus een punt kan alleen in een doos liggen die in
de cel van dát punt staat: per stapje hoeven er maar een paar dozen getoetst te
worden en het antwoord blijft precies hetzelfde.

| | voor | na |
|---|---|---|
| `zichtVrij` over 60 m | 14,7 ms | **0,005 ms** |
| `politie.update` bij 3 sterren | 13,1 ms | **1,05 ms** |

Dat het antwoord gelijk blijft is niet aangenomen maar nagerekend: drieduizend
willekeurige kijklijnen door de bewoonde wereld, met vier verschillende
kijkhoogtes, gaven **3000 van 3000** dezelfde uitkomst — waarvan 1060
geblokkeerd, dus de toets is niet triviaal.

*De Poiesz stond aan de achterkant open.* Het afknippen van de muur onder de
zuilengang (stap 30) gold voor élk muurvlak van het pand, dus ook voor de
achterkant en de kopse kanten: daar stond de onderste vier meter muur niet meer
en keek je onder het gebouw door. De gang loopt alleen langs de gebogen
voorgevel, dus een vlak wordt nu pas geknipt als zijn hart binnen 1,2 m van de
boog ligt. `duinterpentest` legt dat aan twee kanten vast: op de boog begint de
muur op 3,95 m, en daarbuiten op 0,00 m.

De proef had daar zelf een valkuil. De boog begint en eindigt op een hoek van het
grondvlak, en de kopse muur die daar op aansluit loopt wél tot de grond door;
die hoekpunten liggen binnen een meter van de boog en maakten de meting nul. De
toets kijkt daarom naar het midden van de gevel en laat de eerste en laatste vier
meter van de boog buiten beschouwing.

**Kindcentrum De Wynpôlle, Keizersmantel 1 (stap 32).**

*Eerst het pand vinden.* Op naam zoeken leverde niets: het huisnummerlabel "1"
van dit complex ligt elf meter van het pad Schoenlapper en tweehonderd meter van
het westelijke uiteinde van de Keizersmantel-as, dus de generator zet het aan de
Schoenlapper. Ook zoeken in een doos rond de Poiesz gaf niets, en in de brondata
stonden daar maar vier grote panden. Wat het wél opleverde was zoeken langs de
hele Keizersmantel-as: het grootste pand binnen 250 m daarvan is
**0091100000004552** — 3846 m² grondvlak (7937 m² als je de omhullende doos
neemt, want het gebouw buigt), 131 hoeken, bouwjaar 2007, goot 7,49 m, nok
14,61 m, huisnummer 1. Dat is de school.

*Wat uit de data komt.* De 131 hoeken zijn de zwierige gebogen plattegrond van
de foto's. En de tweedeling van het gebouw zit in het 3D BAG-model: de
bovenkanten van de 228 muurvlakken liggen in twee groepen, 85 vlakken tot 9,5 m
(de lage vleugel, goot 7,49 m) en 143 erboven tot de nok op 14,61 m. `steenBoven`
in HOUSE_STYLES legt die grens en `bovenType` zegt welke stijl de hoge vlakken
krijgen, dus welk deel hout en welk deel baksteen wordt is gemeten en niet
verzonnen. `voorkantNaar` is het zwaartepunt van de 66 bestrate vakken binnen
45 m die buiten het grondvlak liggen — het schoolplein.

*Wat van de foto komt:* het liggende houten beschot, de vijf luifelkleuren en
hun regenboogorde langs de bocht, de lichte kozijnen, de oranje entree en de
roodbruine steen van de hoge delen.

*Nieuw in `facade()`.* Twee dingen: `hout` legt een liggend beschot van
`planks()` als achtergrond in plaats van metselwerk (1,2 m per doek in plaats van
2,6 m), en `luifels` tekent per lokaal een brede raamstrook met een gekleurde
luifel erboven. De kleur hangt af van zowel het lokaal als de verdieping
(`(i + s * 2) % 5`), want op de foto verschilt de rij boven van de rij onder. Een
luifel wordt als band met een slagschaduw op het glas getekend en niet als
uitstekend zeil: van de straat gezien is dat precies wat je ziet, en dat kan een
plat vlak.

Vier dingen die niet vanzelf goed gingen:

- **Bijna het hele complex kwam als kale bleke steen in beeld.** Een gevel
  vraagt in `muurKeuze` dat het vlak naar voren of naar achteren kijkt
  (`|kant| > 0,6`), en `voorkantNaar` wijst maar één richting aan. Bij een
  grondvlak met 131 hoeken haalt dat een handvol vlakken. De vlag `industrieel`,
  die bij de waterzuivering al bestond, geeft elke muur boven 2,6 m een gevel —
  en dat is voor een school ook juist, die heeft naar alle kanten ramen.
- **De camera van het opnamegereedschap stond ín het gebouw.** Het hart van een
  complex van 7937 m² ligt middenin, dus "zesentwintig meter vanaf het hart" was
  een binnenmuur. Het gereedschap loopt nu vanaf het hart naar buiten tot het
  grondvlak uit is (37 m) en rekent de standpunten daarvandaan.
- **En hij keek de verkeerde kant op.** De camera kijkt langs
  (-sin yaw, -cos yaw), en die moet gelijk zijn aan -front, dus sin yaw = fx en
  cos yaw = fz. Met een min ervoor stond de opname met zijn rug naar de school.
- **Zes oranje deuren op de bakstenen vleugel.** De gewone geveltak zet op elke
  begane grond een deur in de deurkleur van het type. Voor de houten vleugel is
  oranje juist, voor de bakstenen delen niet: die hebben op de foto donkere
  entrees. Die stijl heeft nu zijn eigen deurkleur. De proef ving dit doordat de
  oranje luifelkleur ook in het bakstenen doek opdook.

*Wat er blijft.* De smalle facetten van de gebogen wand blijven kale steen: een
gevel vraagt 2,4 m breed en een gebogen wand bestaat uit stukken die daar deels
onder blijven (471 van de 983 muurhoekpunten op de omtrek). Ze krijgen het
metselwerk van het pand zelf, dus dezelfde roodbruine steen als de hoge delen, en
vallen niet uit de toon. Een gebogen wand die één doorlopende gevel deelt kan
niet met een texture per vlak.

Controle: `npm run schooltest` en `npm run schoolshots`.

**De buurt verhuist met je mee (stap 33).**

*"Het lijkt als ik hard rijd dat er ook minder mensen spawnen en auto's. Hoeft
ook niet enorm druk te zijn maar miss heeft dit een reden."* — er was een reden,
en die was erger dan het leek: **er spawnde helemaal niets**, niet als je hard
reed en niet als je stilstond.

*Eerst meten.* Bij het opstarten worden de honderddertig voetgangers één keer met
`pickSegment(p, true)` op een willekeurig wegvak in de héle wereld gezet, en
daarna nooit meer. Over 10,95 km² is dat twaalf mensen per vierkante kilometer.
Gemeten op zes standpunten stond er binnen tachtig meter **nul of één** iemand,
en binnen tweehonderd meter drie tot elf; in IJlst nul binnen tweehonderd meter.
Het verkeer was net zo: van de twintig rijdende auto's zitten er veertien op de
N7 en zes op acht assen in Tinga (Molenkrite, Jasker, Monnikmolen, De Wieken,
Buitenroede, Bonkelaar), dus in IJlst, langs de Lemmerweg en in Duinterpen reed
er geen enkele auto. Rijd je hard, dan laat je die paar achter, en er komt niets
voor terug.

*De oplossing is verhuizen, niet bijmaken.* Wie meer dan 380 m achter je ligt
(auto's 520 m) wordt in een band om je heen opnieuw neergezet: `verhuisNaarBuurt`
in `js/npc.js` en `vulBuurtAan` in `js/vehicles.js`. Het aantal blijft dus
precies gelijk — 130 mensen, 20 auto's, 7 draw calls voor de mensen — en het kost
niets. Alleen staan ze nu waar jij bent. De auto's kunnen daarbij op elke rijbaan
van de kaart terecht (355 assen, N7 en afrit uitgezonderd, want daar rijdt het
snelwegverkeer al).

Drie dingen bleken nodig, en elk daarvan kwam uit een meting:

- **Niet vóór je neus.** `zichtVrij` uit `js/world.js` — sinds stap 31 gerasterd
  en dus 2900× sneller — kijkt of er een gebouw tussen jou en de plek staat. Ligt
  er niets tussen, dan moet het minstens 110 m van je af (auto's 130 m); staat er
  wél iets tussen, dan mag het dichterbij, want je ziet het niet gebeuren. Van de
  kandidaten wint de plek achter een gebouw, en daarvan de dichtstbijzijnde.
- **Een tweede, binnenste ring.** Met alleen een doel van achttien mensen binnen
  tweehonderd meter bleef het bij nul tot vier mensen binnen tachtig meter: die
  achttien zitten verdeeld over een schijf waarvan het stuk bij jou maar een
  zesde is, en wie op 110 m wordt neergezet moet eerst nog naar je toe lopen. Er
  is nu ook een doel voor de straat waar je staat: vier binnen honderd meter,
  neergezet in de band 45–105 m. Daar wordt niemand in het open veld gezet — is
  er geen plek achter een gebouw, dan gebeurt er niets.
- **En die binnenste ring mag de buitenste niet uithongeren.** Dat ging meteen
  mis: in IJlst, waar de straten breed en open zijn, lukt het bijna nooit iemand
  dichtbij achter een gebouw te zetten, en het spel bleef dat proberen. Uitkomst:
  IJlst zakte van 21 naar **1** mens binnen tweehonderd meter — slechter dan
  vóór de hele ronde. Lukt de binnenste ring niet, dan gaat dezelfde poging nu
  door naar de buitenste ring.

*Wat het oplevert.* Rijdend met 50 km/u over de Wieken: gemiddeld **7 mensen
binnen tachtig meter** (minimaal 3, hoogstens 10, was 0 tot 1) en zes van de
tweeëntwintig metingen met een auto binnen tachtig meter. Stilstaand na een
minuut: 18 tot 23 mensen binnen tweehonderd meter in elke wijk, inclusief IJlst
(0 → 18) en Duinterpen (6 → 23), en overal 1 tot 3 rijdende auto's. De kosten
zijn niet te meten: 1,45 → 1,29 ms voor `npcs.update` plus `updateTraffic`
samen — dat is ruis, want het bijvullen loopt hoogstens twee keer per seconde en
verzet dan één of twee mensen.

Het is bewust rustig gehouden ("hoeft niet enorm druk"): de doelen stonden eerst
op 22 en 5 en gaven pieken van veertien mensen binnen tachtig meter, wat voor een
Sneker woonwijk te veel is. Op 18 en 4 zit het maximum op tien.

Controle: `npm run bevolkingtest` (twintig controles, waaronder tweehonderd keer
verhuizen met de eis dat niets binnen 110 m in het vrije zicht landt), plus
`looptest`, `rijtest`, `politietest`, `verhaaltest`, `wereldtest` en `winkeltest`
opnieuw.

**De bijbouw van de school, op 1A (stap 34).**

*"Bij de school die je texture hebt gegeven keizersmantel heb je het gebouw
ernaast gemist dat is ook onderdeel van de school."*

*Eerst zoeken welk gebouw dat is.* Dat ging in eerste instantie mis, doordat ik
in de verkeerde maat zocht: ik keek naar een gebouw *van formaat* naast de
school en vond op 48 m een pand van 152 m² met huisnummer 1-15 aan de
Vuurvlinder, dus een rij woningen. Conclusie toen: "de school is in de data één
pand". Dat was voorbarig. Het gebouw ernaast is klein en staat er wél:

**1900100010087850** — 87 m² (15,0 × 5,8 m, vier hoeken), plat dak op 3,49 m uit
3D BAG, bouwjaar 2023, huisnummer **1A**, en het raakt de school op 4,9 m. Dat
huisnummer is het bewijs uit de data zelf: 1A hangt aan 1. Het is het enige pand
binnen 45 m van de school.

*Wat het was.* Het viel onder de standaardregel voor de straat: een plat pand
aan de Schoenlapper wordt `jasker_flat`, het type van de portiekflats aan de
Jasker. Naast een school van beschot en luifels stond dus een losse flat van drie
lagen in het klein.

*Wat het wordt.* Een eigen type `dewynpolle_bij`: het houten beschot en de
kozijnen van de lage schoolvleugel, één laag van 3,4 m, een donkere deur, plat
dak. Zonder luifels — die zitten op de foto's op de lange vleugel van de school
en niet op een bijgebouw van één laag. Uit de data komen het grondvlak, de
hoogte, het bouwjaar en het huisnummer; dat het bij de school hoort komt van de
gebruiker, en dat staat zo in het `bron`-veld in `data/stijl/straten.json`.

*Wat er onderweg misging.* De eerste opname gaf een grote grijze roldeur midden
op het schoolplein. `industrieel` (nodig, want een bijgebouw van vier hoeken kan
naar alle kanten kijken) stuurt `facade()` naar de bedrijfstak, en die zet in
elke derde travee een overheaddeur: op vijftien meter gevel is dat er precies
één, pontificaal in het midden. De vlag `kantoor` zet die tak op gewone ramen met
lichte kozijnen en alleen een stalen deur, en dat is wat een bijgebouw van een
school heeft.

Controle: `npm run schooltest` — nu achttien controles, met zeven over de
bijbouw (type, huisnummer, afstand tot de school, maat en hoogte uit de data,
hetzelfde beschot, en géén luifelkleuren in het doek) — en `npm run schoolshots`,
dat nu ook de bijbouw fotografeert. Die opnamen kregen een stap zijwaarts langs
de gevel (`langs`) en kijken vandaar terug naar het hart van het pand: recht
vooruit staat de camera in een parkeervak van de school, en dan vulde een
geparkeerde auto het halve beeld.

**Drie fouten uit het spel, gevonden door ze te meten (stap 35).**

De gebruiker meldde drie dingen na het spelen. Alle drie bleken echt, en alle
drie zijn ze met een meting vastgepind voordat er een regel veranderde.

*1. "Fietsers en wandelaars lopen heel vaak achteruit."* Klopt, en niet vaak
maar altijd. Het lichaam uit `js/lichaam.js` kijkt langs zijn eigen −z: de neus
zit op z = −0,108, de klep van de pet op −0,155, de neus van de schoen op
−0,045. Een draai `yaw` om de y-as zet die −z op (−sin yaw, −cos yaw), dus voor
een looprichting (vx, vz) hoort yaw = atan2(−vx, −vz) — precies wat er in
`js/persoon.js`, `js/verhaal.js`, `js/bewaking.js` en `js/dief.js` staat. In
`js/npc.js` stond er `+ Math.PI` achter: een halve slag, dus iedereen liep met
het gezicht naar waar hij vandaan kwam. De fiets keek dezelfde kant op (stuur op
z = −0,44), dus die reed ook achterstevoren.

Gemeten met het inproduct van de kijkrichting en de verplaatsing over een
seconde, over alle honderddertig voetgangers, waarbij wie net een hoek omsloeg
niet meetelt (dan is de sprong geen looprichting): **95 vooruit, 0 achteruit**.
Vóór de wijziging was dat andersom.

*2. "Zijkant auto en voorkant geven clipping met onder andere banden en
chassis."* Drie fouten in `js/carmodel.js`, alle drie na te rekenen uit de
maten:

- de **sierlijst langs de dorpel** was L − 1,5 = 2,80 m lang en liep dus van
  z = −1,40 tot 1,40, terwijl de wielen op z = ±1,32 staan met een straal van
  0,32 (band van z = 1,00 tot 1,64). De lijst stak veertig centimeter dwars door
  beide banden. Hij loopt nu alleen tussen de wielkasten door;
- het **chassis van de bakwagen** was 2,25 m breed over de volle lengte, met de
  wielen op x = ±1,00 en een band van 0,30 breed: 27 van de 30 centimeter band
  zat in het chassis. Een bakwagen heeft een ladderchassis dat smaller is dan de
  spoorbreedte — nu 1,66 m, met de wielen ernaast;
- **grille, koplampen, achterlichten en kentekenplaten** hingen los vóór het
  plaatwerk. De flank is L − 0,12 lang, dus zijn voorkant ligt op −L/2 + 0,06,
  en de grille stond op −L/2 − 0,035: drieënhalve centimeter ertussen, waar je
  van schuin voren doorheen keek. Bij de bakwagen was het erger: de achterkant
  van de laadbak ligt op 3,40 en de achterlichten stonden op 3,62, twintig
  centimeter achter de wagen in de lucht, en de kentekenplaat zat juist ín de
  bumper. Alles zit nu een centimeter in het plaatwerk.

Dezelfde ronde: de **wielkasten** stonden op wielX + 0,02 = W/2 − 0,07, dus
binnen de flank, waar je ze niet ziet; ze staan nu op W/2 + 0,01. De bakwagen
had er helemaal geen en heeft ze nu ook. En de dorpel reikte tot 0,569 m terwijl
de flank op 0,570 begint — een naad van één millimeter over de hele lengte.

*3. "Ik zie ruimte tussen gras en wegen alsof je door de wereld heen kan
kijken."* Dat klopte letterlijk. Om dat te meten is het grondvlak onder alles
(een plaat op y = −1,0) felroze gemaakt; elk roze beeldpunt is dan een plek waar
je tussen de vlakken door naar beneden kijkt. Op vijf standpunten was **0,14 %
tot 0,58 % van het beeld roze** — dunne lijnen langs elke berm, elk plantsoen en
elke slootkant. Ter controle: buiten het gebied, waar het grondvlak hóórt te
staan, is 70 % van het beeld roze.

De oorzaak zit in `randGeometrie` in `js/kaartwereld.js`. De opstaande rand van
een verhoogd vlak wordt per rand als vierhoek opgebouwd, en zowel de normaal
(dz, 0, −dx) als de volgorde van de hoekpunten klapt om als de ring andersom
loopt. De brondata houdt zich niet aan één draairichting, dus de helft van de
randen keek naar binnen en werd als achterkant weggeknipt. Eerst getoetst met
een proef — de randen dubbelzijdig maken maakte alle roze pixels weg — en toen
netjes opgelost: de draairichting wordt nu per ring rechtgezet (buitenring
linksom, gaten rechtsom), zodat het bij één zijde per vlak blijft en er dus geen
driehoek bij komt. De oeverwand van een sloot en de binnenwand van een
bezinkbak zie je juist van de andere kant, en die krijgen `naarBinnen: true`;
zonder die vlag werden IJlst en de Lemmerweg juist slechter (823 → 2451 en
852 → 4864 roze beeldpunten), want daar is veel water in beeld. Na afloop:
**nul roze beeldpunten** op alle standpunten.

Het was niet de LOD: met alle stoepbanden geforceerd aan bleef het beeld
hetzelfde (3315 tegen 3315 roze beeldpunten).

**De school na de tweede reeks foto's, en het schoolplein (stap 36).**

Twee foto's van Keizersmantel 1 (de voorkant met de luifels, en de hoek met de
bakstenen kop) lieten drie dingen zien die anders waren dan wat er stond:

- de luifels zijn **losse zeilen per raam**, niet één doorlopende gekleurde balk.
  Ze staan schuin naar voren, dus van de straat gezien is hun bovenrand smaller
  dan hun onderrand — als vlakke vierhoek prima te tekenen;
- de kleuren lopen **in blokken van een paar lokalen** (een rij gele naast een
  rij oranje, dan blauw, dan groen) en niet om en om per lokaal. Vandaar
  `KLEURVAK = 3` in `facade()`, met een verschuiving per verdieping;
- het beschot is **warmer roodbruin** dan het olijfbruin dat erop zat
  (#8a6a45 → #8a5c39).

Op de foto's staan ook twee vlaggenmasten met banieren bij de glazen entree,
rijen fietsen ervoor, en aan de kant van de bakstenen kop een speelplein met
klimtoestel, glijbaan, speelhuisje en pergola achter een zwart spijlenhek. Dat
staat er nu, en daarvoor is de generator op twee punten uitgebreid:

1. **een object mag zijn eigen plek krijgen** (`x`/`z` in spelmeters) in plaats
   van een maat vanaf de voorgevel. Bij dit pand moest dat wel: het plein ligt
   achter de bocht, en in de maat vanaf de voorgevel is dat `voor: -60`, wat
   niemand kan nalezen. De plekken zijn gekozen op een raster van een meter met
   de eis dat ze buiten elk grondvlak liggen, op verharding of gras, en minstens
   3,5 m van een gevel af;
2. **`hekken`**: een rij hekwerkjes van A naar B, in stukken van drie meter, met
   de kop in de richting van de lijn. Daarvoor is er een nieuwe prop
   `spijlenhek` (staande spijlen met een punt, twee liggers, zwaardere
   staanders).

Wat er misging: de eerste reeks plekken kwam uit een raster van vijf meter, en
daar stond een bank net ín het grondvlak van de school en een glijbaan op de
rijbaan. Nu rekent `npm run schooltest` (drieëntwintig controles, waarvan vijf
over het plein) na dat geen enkel object in een gebouw of op de rijbaan staat.
`npm run schoolshots` maakt er twee opnamen bij, vanaf het plein en langs het
hek; het standpunt komt uit de toestellen zelf.

*Nog niet gedaan:* op de foto's zijn de banieren aan de masten paars-blauwe
schoolvlaggen. Er staat nu de gewone vlaggenmast uit `js/props.js`, met een
Nederlandse vlag.

**Plekken doorgeven: waar moeten de muren komen (stap 37)?**

Voor de onzichtbare muren en de wegblokkades aan de rand van de wereld is één
ding nodig dat er nog niet was: een manier om een plek dóór te geven. Die zit er
nu in, op twee manieren:

- **K** zet je eigen plek in het berichtbalkje én op het klembord, als
  `x, z` in spelmeters (`js/main.js`);
- de **grote kaart (M)** laat diezelfde twee getallen linksonder zien, want op de
  telefoon is er geen toetsenbord en geen klembord.

Beide getallen zijn spelmeters vanaf de oorsprong (het kruispunt Molenkrite /
Monnikmolen / Jasker, zie stap 1), dus ze zijn stabiel: de kaart opnieuw
genereren verschuift ze niet.

**Muziek op de autoradio, en de kaart die het spel ophield (stap 38).**

*Muziek.* De radio in de auto speelt nu een bestand uit `audio/radio/` in plaats
van het gesynthetiseerde riffje. Het gaat door dezelfde smalle band (hoogdoorlaat
190 Hz, laagdoorlaat 3,4 kHz), dus het blijft uit de speakers in het portier
klinken en niet als een concert, en het zakt weg onder het jachtdeuntje. Het
bestand loopt via een `<audio>`-element dat als bron in de geluidsketen hangt —
dan hoeft er niets in het geheugen gedecodeerd te worden. Welke nummers er zijn
staat in `audio/radio/nummers.json`; er een bij zetten is een regel in dat
bestand. Lukt het laden niet, dan komt het riffje terug: dat blijft de terugval.
De titel verschijnt kort in het berichtbalkje, zoals een radio die zijn scherm
bijwerkt. Controle: `npm run radiotest`.

Het eerste nummer is *Snow (Hey Oh)* van de Red Hot Chili Peppers, aangeleverd
als plaatshouder. Dat is geen rechtenvrije muziek en de repo is openbaar; voor
een blijvende versie hoort daar eigen of rechtenvrij werk te staan.

*De kaart.* "Als ik de map open wordt het spel ineens enorm traag" — dat klopte,
en het was te meten: `drawBig` bouwde de hele kaart elk beeld opnieuw op en
kostte **15,55 ms per beeld**, bovenop het spel zelf. Daar zat alles in: de
ondergrond, het water, 1161 wegassen, 414 straatnaamlabels met een rand eromheen,
de winkels, en 1781 auto's als evenzoveel losse `fillRect`-opdrachten.

Het vaste deel gaat nu één keer op een eigen doek en wordt daarna alleen nog
gekopieerd; opnieuw tekenen gebeurt alleen als het venster van maat verandert of
als de route wijzigt. Wat elk beeld overblijft is het bewegende werk: de auto's
(nu als één pad in plaats van 1781 opdrachten), de politie en je eigen pijltje.
Uitkomst: **15,55 → 0,55 ms**, achtentwintig keer zo snel.

*Wat niet oploopt.* Om zeker te weten dat het niet ergens anders aan ligt is er
drie minuten spel gesimuleerd (voetgangers, verkeer, politie en props) met een
telling ervoor en erna: 4537 objecten in de scène, 5645 meshes, 1287
geometrieën, 989 texturen, 1781 auto's, 130 mensen, 56.097 colliders — vóór en
ná exact gelijk. Er lekt dus niets weg tijdens het spelen.

**Tankstation, derdepersoonscamera, snellere politie en een echte knal (stap 39).**

*Tankstation BP Slump Oil, Lemmerweg 63.* Aan de rondweg naast het sportpark.
Wat uit de data komt: de **luifel** staat als los bouwwerk in de BGT
(`bgt_overigbouwwerk`, klasse `bouwwerk`) — een vierhoek van 24,6 × 10,8 m,
waaruit de generator de plek, de richting (de langste zijde) en de maat haalt; en
de **shop** is pand 0091100000004556 (236 m², plat op 4,88 m), dat via
`data/stijl/straten.json` het type `bp_shop` krijgt: donkere bruine steen, een
doorlopende groene band over de glazen pui, en `shop` in het groen. De
pompeilanden liggen op een derde en twee derde van de breedte, evenwijdig aan de
lange as — zo staan ze onder elke luifel, want je rijdt er langs de lange kant
onderdoor. De prijzenzuil komt bij de hoek van de luifel die het dichtst bij een
rijbaan ligt, vier meter naar de weg toe. In `data/stijl/omgeving.json` staan
alleen de maten die nergens in de data zitten: de doorrijhoogte (5,2 m), de
dikte van het dek, het aantal pompen en de prijzen van de foto.

Het zonnetje van BP en de prijsborden worden op een canvas getekend, net als alle
andere texturen in dit spel — er komt geen plaatje bij.

Wat er misging: de botsdozen van de pompeilanden stonden **dwars** over het
plein. `addCollider` wil de hoek van de lange as zelf (−atan2(dz, dx)) en niet de
draaiing om de y-as van het model; die twee schelen negentig graden. De proef
mat het meteen: 1,97 m wegduwen midden onder de luifel, waar je juist vrij moet
kunnen rijden. Controle: `npm run tanktest` (acht controles) en
`npm run tankshots`.

*Camera.* Stap je in een auto, dan staat de camera nu standaard achter de auto —
je ziet de neus, je achterwielen en het stuk weg eromheen, en dat stuurt een stuk
prettiger. Hoe je te voet liep wordt onthouden: stap je uit, dan kijk je weer
door je eigen ogen als je zo liep.

*De wijkeditor is eruit.* Hij werd niet gebruikt en hield wel overal haakjes in
de gang: een module, een paneel in `index.html`, vier `if (editor.actief)`-poorten
in de hoofdlus, drie gereedschappen en een eigen opslagpad naast die van het
spel. Weg is weg — `js/editor.js`, `docs/EDITOR.md`, `tools/editortest.mjs`,
`tools/editorshots.mjs`, `tools/proptest.mjs` en `tools/desktoptest.mjs`.

*De politie rijdt harder.* Een surveillancewagen had dezelfde topsnelheid als de
speler (24 m/s), en dan haalt hij je nooit meer in zodra je een rechte weg hebt:
hij blijft eeuwig een straat achter je hangen. Nu 29 m/s — 104 tegen 86 km/u — en
tijdens een jacht mag hij ook harder willen rijden (26 in plaats van 20). Genoeg
om in te lopen, niet zoveel dat wegkomen onbegonnen werk wordt.

*Het schot.* Een pistoolschot is geen "boem" maar een knal: een drukgolf van een
paar milliseconden met energie tot ver boven de 10 kHz, dan een korte lage klap
van het uitstromende gas, en dan de straat die het terugkaatst. Er stonden drie
gefilterde ruisstootjes op 2600, 900 en 240 Hz plus een vierkante toon, en dat
klonk dof — meer een dichtslaande deur. Nu vier lagen: de knal (ongefilterde ruis
van vier milliseconden met een piek op 3,2 kHz), de gasklap (laagdoorlaat plus
een sinus van 180 naar 50 Hz), drie kaatsingen tegen de gevels op 38, 74 en
130 ms die steeds zachter en doffer worden, en een naijl van een halve seconde.

**Tennispark Molenkrite en tuincentrum Ranzijn (stap 40).**

*De tennisbanen bij Molenkrite 130.* De gebruiker: "rond Molenkrite 130 is een
tennisbaan, daar heb je nu al groene velden gemaakt, vlak naast het voetbalveld."
In de data staat het er gewoon: vier vlakken **halfverhard** (BGT `fysiek
voorkomen = half verhard`, in het spel `grind`) van 1276 tot 2535 m², pal naast
het sportpark, met het clubgebouw (688 m², bouwjaar 2012) ertussen en tien
parkeervakken ervoor. Halfverhard is in Nederland precies wat een tennisbaan is:
een gravelbaan. Daar komt ook de kleur vandaan — roodbruin en niet grijs.

Wat uit de data komt: plek, maat en richting van elk blok (de langste zijde geeft
de as, de omhullende rechthoek de maat). Wat er niet uit komt is hoeveel banen er
in zo'n blok liggen, en dat rekent de generator erbij met de maat van een echte
baan: 36,6 × 18,3 m inclusief uitloop, speelvlak 23,77 × 10,97 m. De korte kant
van het blok is de lengte van één baan, over de lange kant passen er
`rij / 18,3` naast elkaar — 2 + 2 + 2 + 4 = tien banen. Opgemeten waarden in
`data/stijl/omgeving.json`: de hekhoogte (3,6 m) en of er lichtmasten staan.

De belijning gaat als één doek per blok de wereld in, niet als losse balkjes.
Dat scheelt ruim honderd objecten per park, en het is scherper ook: een lijn van
vijf centimeter is als plat vlakje op deze schaal een paar beeldpunten breed.

Twee dingen gingen mis, en allebei zag je ze pas op een foto:

- **Het hele blok stond een kwartslag gedraaid.** `rotation.y` legt de
  plaatselijke **z**-as op een richting, en de baanvloer was langs de plaatselijke
  **x**-as gebouwd. Gevolg: het blok van vier banen werd 73 m lang in plaats van
  35, en de banen lagen over het pad en de bomen ernaast heen. De botsdozen
  klopten wél, want die rekenen met de as zelf — dezelfde valkuil als bij de
  pompeilanden van het tankstation een stap eerder, maar nu andersom. De proef
  meet het nu na: de hoek van de vloer wordt in de wereld opgezocht en langs de
  as en dwars erop uitgedrukt; dat moet een halve lengte en een halve breedte
  zijn en niet omgekeerd.
- **Er stonden bomen op de baan.** Grind is voor de strooiregels zachte grond,
  dus er kwamen achtendertig bomen en struiken binnen het hek te staan — met een
  stam dwars door de uitloop. Die worden er bij het genereren weer afgehaald,
  dezelfde opruimactie als eerder op de voetbalvelden (dertig stuks). Het
  opruimvlak is de omheinde rechthoek en niet het BGT-vlak zelf: het hek staat om
  die rechthoek, dus dat is wat vrij hoort te zijn.

Het net was eerst een dunne donkere doos, en die viel tegen het hek op de
achtergrond volledig weg. Nu is het één vlak met een fijne maas en de witte band
erboven — dat is ook wat je in het echt van een afstand ziet. Controle:
`npm run tennistest` (zestien controles) en `npm run tennisshots`.

*Ranzijn Tuin & Dier, Akkerwinde 1.* De gebruiker: "grote pand langs de rondweg
Zonnedauw is een Ranzijn tuin- en dierenwinkel." Uit de data: één pand van
3112 m² (81,4 × 45,3 m), goot 3,94 en nok 6,44 m, bouwjaar 1980, met de voorkant
naar het westen — naar het parkeerterrein aan de rondweg. Dat is dus een lage,
brede doos met een flauw dak, en die maat komt onveranderd uit de BGT en 3D BAG.
Van de foto komen alleen kleur en indeling, zoals de regel voorschrijft:
lichtgrijze gevelbeplating op een donkere plint, een glazen pui over de voorkant
en daarboven de gele band met het woordmerk in het groen. Dat is het type
`tuincentrum` in `js/textures.js`, gekoppeld in `data/stijl/straten.json`.

**De eerste vijf foto's van de steekproef (stap 41).**

De gebruiker had achttien panden gefotografeerd die er volgens hun eigen maten
uitspringen en die nog als generiek blok (`spil`) in het spel stonden. De eerste
vijf lagen in de wacht tot de rest binnen was; dit is die ronde. Steeds hetzelfde
recept: **maat, hoogte en richting uit de BGT en het 3D BAG, kleur en indeling
uit de foto** — en niets anders.

*Westhemstraat 55-61.* Vier panden van 13,2 × 7,1 m, goot 2,8-3,1 en nok
6,6-6,7 m, bouwjaar 1972: bungalows van één laag, diep en smal, met de nok
evenwijdig aan de straat. Van de foto: lichte zandkleurige steen, witte kozijnen
met blauwe deuren en blauwe draaidelen, een brede woonkamerpui. En het beeld dat
deze rij maakt: een gemetselde schoorsteen per woning op de nok, en zonnepanelen
die het hele voordakvlak vullen.

Die twee waren er nog niet. De rijtjes die het spel zelf uitzet hebben ze al
(`js/world.js`), maar een pand uit de BGT had alleen een kaal dakvlak. Dat zit nu
in `dakDetails` in `js/kaartwereld.js`, en het staat per stijl aan (`dakdetail`)
en niet voor alle panden tegelijk — anders komen er in één klap honderden
schoorstenen bij, en dat is een andere beslissing dan deze ene straat.

Het paneel ligt op het dakvlak met een eigen assenstelsel: één as langs de nok,
één van de nok naar de goot, en de derde er loodrecht op. Met drie losse
draaiingen om x en y klopt het teken maar in de helft van de windrichtingen —
dezelfde soort fout als bij het tennispark een stap eerder, en de proef meet het
nu na: de schoorsteen moet boven de nok uitsteken en op het hart van de nok
staan, en het paneel moet tussen goot en nok blijven.

*Potterzijlstraat 2-48 en 3-49.* Galerijflats van 1966, 69 × 10,6 m met een plat
dak op 11,1 m — bij 2,8 m per laag zijn dat vier lagen, waarvan de onderste de
open onderbouw is. Van de foto: roodbruine steen, lichte kozijnen, een donkere
onderbouw met bergingen op poten, en voor elke woonlaag langs een donker stalen
galerijhek. Dat laatste is een nieuwe geveltekening (`galerij`): per laag een
brede pui met een keukenraam ernaast, een borstwering eronder, en daarvoor het
hek met spijlen.

*Potterzijlstraat 51-177 en 157-241.* Met goot 25,6 m de twee hoogste gebouwen
van de kaart; je ziet ze vanaf de rondweg overal bovenuit komen. Negen lagen.
Juist op die afstand telt alleen de grote streping, en dat is wat `balkonband`
tekent: over de volle breedte een doorlopende witte balkonplaat per laag, glas
erachter, de schaduw eronder, een donkere onderbouw en een gele trappentoren.

Hier kwam een oude aanname naar boven. Een gevel werd altijd op **vier lagen**
afgekapt — hoger wordt er in deze wijk niet gewoond, en meer lagen kosten alleen
geheugen. Op een muur van 25 meter werden dat lagen van ruim zes meter. Een stijl
kan nu `maxLagen` zetten; alleen deze twee doen dat.

*Sûdwester, Lemmerweg 130a.* 77 × 44 m, goot 6,25 en nok 12,32 m, bouwjaar 1980,
negentien dakvlakken — de gebogen kap van de foto zit dus in de brondata. Van de
foto: een lange, vrijwel dichte wand in donkergroen met hoog in de gevel één
strook korte ramen, en bij de entree een glazen pui met houtkleurige stijlen. Dat
laatste is `strookramen`: geen rij bedrijfsramen per laag, want dat maakt van
deze wand een fabriek.

*Sneekerpad 25.* De grote loods naast houtzaagmolen De Rat, 63 × 55 m, goot 3,57
en nok 8,34 m, bouwjaar 1981. Van de foto: roodbruine steen onder een dak van
donkergrijze felsplaten, en verder een dichte wand met alleen hoog een strook
ramen. Wat er **niet** in zit: het steile dak dat op de foto bijna tot de grond
komt, en de oranje houten aanbouw met het terras ernaast. Het 3D BAG-model van
dit pand is een doos, en de aanbouw is in de brondata niet van de loods te
onderscheiden — dus dat blijft staan zoals de data het zegt.

Controle: `npm run steekproeftest` (zestien controles) en
`npm run steekproefshots`.

*De toetsenlijst onderin is weg.* Er stond permanent een regel in beeld met alle
toetsen. Je leest hem één keer en daarna staat hij alleen maar voor de wijk. Wat
blijft is wat je nú kunt doen — "Druk E om in te stappen" als je naast een auto
staat. De lijst zelf staat nog in het start- en pauzescherm (Esc) en in de README.

**Botsgevoel en geluid (stap 42).**

Uit de beta-test kwam een lijst met meldingen, en daarnaast twee punten uit het
voorstel voor de spelbeleving: het gevoel van een botsing, en geluiden die er
nog niet waren. Deze stap doet die twee.

*De klap.* Een aanrijding was tot nu toe alleen een getal — `car.speed *= 0.25`
en verder veranderde er niets. Nu zet `drive` de snelheid waarmee je erin reed in
`botsKracht`, en maakt js/main.js daar een schok van: een uitslag die in een
halve seconde uitdempt en vlak voor het renderen bij de camera wordt opgeteld.
De uitslag is een sinus met drie snelheden door elkaar; één zuivere trilling
leest als een defect beeldscherm en niet als een klap. Hij zit op de camera en
niet op de speler, want anders schuift de botsdoos mee en loop je door een muur.

*Remsporen.* Honderdtwintig vierhoekjes in één buffer die als ringbuffer
hergebruikt worden: er komt nooit geometrie bij, er wordt alleen in bestaande
hoekpunten geschreven. Dat kost één draw call voor alle sporen samen, ook als je
de halve wijk hebt rondgeslipt. Vervagen gaat via een eigen hoekpuntwaarde in een
kleine shader, want een materiaal dat per spoor van doorzichtigheid verandert is
een materiaal per spoor. Er zijn drie manieren om ze te maken — de handrem, hard
remmen vanaf snelheid, en dwars door een bocht glijden — en samen geven die het
`gierNiveau` waar ook het geluid op meeloopt.

*Wrakken.* Een uitgebrande auto bleef er eeuwig staan. Nu komt hij na een minuut
terug als gewone auto op zijn eigen parkeerplek, maar alleen als de speler er
meer dan tachtig meter vandaan is: iets zien verdwijnen waar je naar kijkt leest
als een fout. Daarvoor moest een geparkeerde auto onthouden waar hij stond
(`start`) en wat zijn lak was. Bij het opblazen bleek een geparkeerde auto
trouwens helemaal niet zwart te worden: die zit in een instanced stapel en had
geen eigen materiaal om te vervangen. Dat gaat nu via de kleur van de instantie.

*Vier nieuwe geluiden.* Een auto die ontploft speelde `klap()` af — hetzelfde
blikken geluid als een kogel in een portier. Een benzinetank is vooral láág en
lang; de scherpte zit alleen in de eerste vijftig milliseconden. De `explosie`
heeft dus vier lagen, net als het schot: de flits, een sinus die van 90 naar
28 Hz zakt, anderhalve seconde uitdovend vuur, en brokken die op straat vallen.
Daarnaast `glas` (scherven als hoge tikjes over een halve seconde), `kreet`
(een zaagtand op stemhoogte door drie formantbanden — dat maakt er een klinker
van in plaats van een zoemer, met `schrik` en `pijn` als varianten) en `gier`
(één doorlopende bron waarvan sterkte en toonhoogte met het slippen meelopen).

*Vier meldingen uit de beta-test.*

1. **De sirene loeide door zodra je een gebouw in liep.** Binnen wordt
   `politie.update` niet aangeroepen — je staat dan in een andere ruimte — en dus
   werd de sirene ook niet meer bijgewerkt; hij bleef op zijn laatste stand
   hangen. Binnen wordt hij nu zelf op stil gezet.
2. **De motor bromde door in het pauzescherm.** Zelfde soort oorzaak: de
   oscillator loopt door en `motorToeren` wordt niet meer aangeroepen. Er is nu
   een `geluid.pauzeer` die het hoofdvolume dichtdraait en de muziek echt stilzet.
3. **De motor overstemde de radio.** De muziek stond op 0,22 en de motor liep tot
   0,11 met een open filter erbij. Muziek naar 0,32, motor naar hoogstens 0,074.
4. **"Raak!" en "Agent neer!" zijn weg.** Je ziet het gebeuren, en het balkje
   stond er voortdurend. Wat ervoor in de plaats komt is de kreet: dat vertelt
   hetzelfde zonder tekst.

Controle: `npm run gevoeltest` (dertien controles) en `npm run gevoelshots`.

**Startscherm, laadscherm en de opbouw in stukjes (stap 43).**

*Wat er mis was.* Je opende de pagina en keek achtenzestig seconden naar zwart.
De wereld werd in één blok opgebouwd — drieënveertig seconden — en pas daarna
verscheen het startscherm. Er was geen teller, geen menu, en het tabblad
reageerde nergens op; een browser die zo lang niets doet krijgt van het systeem
een "wilt u deze pagina sluiten"-melding.

*Het menu eerst.* `js/menu.js` bouwt nu meteen een startscherm: Start spel,
Doorgaan, Spel laden, Instellingen, Besturing, Afsluiten. Dat staat er na 2,8
seconden. De wereld bouwt eronder door; kies je iets, dan schuift het laadscherm
ervoor met een beeld uit de wijk en een voortgangsbalk. Met Esc komt hetzelfde
menu terug, nu met Doorgaan bovenaan — en daar zitten ook de instellingen
(scherpte, geluid, weer, camera, klok) en de toetsenlijst, die daardoor niet meer
permanent onderin het beeld hoeven te staan.

De wortel houdt de naam `overlay`, want alle gereedschappen in `tools/` zetten
dat element op `display: none` om een foto zonder menu te maken.

*De opbouw in stukjes.* `bouwKaartWereld` en `buildWorld` zijn generators
geworden die tussen de fases en binnen de grootste lussen `yield`en: om de 250
vlakken, om de 60 panden, om de 6 gevelmeshes. `js/main.js` laat er
vierentwintig milliseconde per keer van draaien en geeft het beeld daarna terug
met een `setTimeout` — niet met een `requestAnimationFrame`, want de hoofdlus
draait dan nog niet en op de proefopstelling zonder grafische kaart haalt die
maar een paar beelden per seconde; dan zou de opbouw uren duren.

Ook het stuk ná de wereld is opgeknipt: het reliëf, het omgevingslicht, de
speler, het verkeer, de voetgangers, het verhaal en de binnenruimtes. Dat was bij
elkaar achtentwintig seconden en stond als één blok achter de balk.

*Wat de meting opleverde.* De proef meet hoe lang de pagina achter elkaar niet
reageert. Dat bracht meteen een echte rem boven water: `nearBuilding` —
"staat hier een gebouw?" — liep **alle 56.128 botsdozen** langs. Die functie is
geschreven toen het er vijftig waren; het riet langs het water vraagt het voor
elke pol opnieuw, en dat kostte **negenentwintig seconden** voor het riet alleen.
Verderop in hetzelfde bestand lag al een rooster over de botsdozen voor
`resolveCollisions`; dat wordt nu ook hier gebruikt. Riet: 29 → 4,3 s.

| | vóór | ná |
|---|---|---|
| menu in beeld | 68 s | 2,8 s |
| wereld opbouwen | 43,3 s | 28,1 s |
| laadtijd tot speelbaar | 67,8 s | 44,4 s |
| langste bevriezing tijdens de opbouw | 43 s | 4,1 s |

Wat er niet op te knippen valt is het eerste beeld: de kaart moet dan zijn dertig
programma's vertalen en tweehonderdvijftig megabyte textuur versturen. Op de
softwarerenderer van de proefopstelling is dat tien seconden, op een machine met
een grafische kaart een fractie daarvan — en je kijkt er naar het laadscherm en
niet naar een bevroren wereld.

*De beelden.* `beeld/laadscherm/` met een lijstje in `beelden.json`, net als de
muziek in `audio/radio/`. Staat er niets, dan tekent `js/menu.js` zelf een
achtergrond op een canvas: een rij daken bij zonsondergang met verlichte ramen.
Zo werkt het scherm ook leeg, en het blijft waar: dit is naast de radio de enige
plek in het spel waar een afbeelding uit een bestand mag komen.

Controle: `npm run menutest` (achttien controles) en `npm run menushots`.

*Het beeld erop (stap 45).* De gebruiker leverde er een aan: een GTA-VI-affiche
van de wijk. Het staat nu op het startscherm én op het laadscherm, en het zoomt
in achtentwintig seconden tien procent in met de vaart er langzaam uit
(`cubic-bezier(.17,.67,.35,1)`), zoals een echt laadscherm van dat spel. Drie
dingen bleken te moeten kloppen:

- *het verloop mag niet meezoomen.* Het stond als `::after` op het doek zelf, en
  dan schaalt het mee: de donkere onderrand schuift het scherm af en de
  voortgangsbalk wordt onleesbaar. Het is nu een eigen laag eroverheen;
- *het zoompunt ligt hoog* (`transform-origin: 50% 18%`). Het affiche is vier
  staand op vijf breed en het scherm zestien op negen, dus er gaat hoe dan ook
  dertig procent van de hoogte af. Zoom je om het midden, dan loopt de bovenkant
  — met de titel van het affiche erin — binnen een halve minuut uit beeld;
- *de animatie moet opnieuw kunnen starten.* Een CSS-animatie begint alleen
  opnieuw als hij eerst van het element af is; daar staat in `js/menu.js` een
  `void doel.offsetWidth` tussen, die de browser tot herberekenen dwingt.

Het beeld zelf is met de meegeleverde Chromium van 2,4 MB PNG naar 411 kB JPEG
gebracht (kwaliteit 0,88) — er is in dit project geen beeldgereedschap, maar een
canvas kan het ook.

*En de muziek erbij (stap 47).* Eén nummer uit `audio/menu/` op herhaling, voor
het startscherm, het laadscherm én het pauzescherm. Het moet vooral **doorlopen**
als je van het startscherm naar het laadscherm gaat — daarom staat de speler in
`js/menu.js` en niet in het scherm zelf, en zet `toonLaadscherm` hem niet stil
maar juist aan. Hij fadet in ruim een seconde uit als het spel begint en komt
terug bij Esc.

Twee dingen die anders misgaan: een browser weigert geluid vóór de eerste klik
(dan hangt er een eenmalige luisteraar aan `pointerdown`/`keydown` die het alsnog
probeert), en het geluid van het spel staat los van dit element — `U` en de
instelling Geluid roepen daarom `menu.zetGeluid()` aan, anders speelt het menu
vrolijk door terwijl de rest stil is. De proef in `menutest` meet het nummer op
vier plekken: in het startscherm, tijdens het laden (dezelfde `currentTime`, dus
hij is niet opnieuw begonnen), in het spel (stil) en na Esc (weer aan).

**De losse punten uit de beta-test (stap 44).**

De overige meldingen uit het beta-testverslag gingen niet over één onderwerp maar
over zeven losse dingen. Ze staan hier bij elkaar omdat ze in één ronde zijn
gedaan, met de redenering per punt.

*1. De avond kostte de halve snelheid.* "Als de klok het donker in loopt wordt
het spel heel traag." Dat is geen gevoel maar rekenwerk: in een forward renderer
telt **elke puntlamp mee in de shader van elk materiaal dat hij kan raken**. Acht
straatlampen rond de speler is dus acht keer belichting uitrekenen per oppervlak,
bovenop de zon. Gemeten kostte de nacht **+183 %** per beeld. De pool in
`js/sfeer.js` is van acht naar **drie** lampen terug (`const POOL = 3`), met de
sterkte per lamp van 9 naar 11 zodat de straat er even licht uit blijft zien:
**+96 %**. Meer dan de helft van de nachtprijs weg, zonder dat het donkerder
oogt — de lampen staan nu alleen dichter bij de speler geconcentreerd.

Wat níét werkte en er daarom uit is: `renderer.compile()` vooraf draaien om de
schaderhaperingen weg te nemen. Dat maakte 36 programmavarianten die daarna
nergens meer gebruikt werden (32 → 68 programma's) en het werd er langzamer van.
De meting staat als commentaar op de plek waar de functie stond, zodat de
volgende die het probeert het niet nog eens hoeft te ontdekken.

*2. Uit de auto schieten.* Kon niet. `player.magSchieten()` is nieuw: zit je in
een auto, dan mag je binnen **150°** van de neus schieten — naar voren en opzij
dus, en recht naar achteren niet. De redenering is de houding: je hangt uit het
raam, niet over de achterbank.

*3. De koplampen staken uit de neus.* Vijf centimeter vóór het plaatwerk, en van
schuin voren zag je ze als los blokje naast de auto zweven. In `js/carmodel.js`
worden de lampdoosjes nu **in** het blik gezet (`lampUit = 0.015`, dus anderhalve
centimeter blijft zichtbaar), voor koplampen, achterlichten, achteruitrijlichten,
de grille en de lampen van de vrachtwagen. De controle meet het na tegen de lak
**en de bumpers** samen: de kentekenplaat hoort op de bumper te zitten en steekt
dus terecht voorbij de lak uit — meten tegen alleen de lak wees die plaat als
fout aan.

*4. Lantaarnpalen.* "Palen die je omver kunt rijden en die dan buiten beeld weer
terugkomen." Ze stonden als losse mesh met een botsdoos en werden bij een aanraking
meteen teruggezet. Nu houdt `js/kaartwereld.js` een lijstje `LANTAARNS` bij:
`raakLantaarn(x, z, richting, snelheid)` kantelt de paal versneld om — een halve
seconde — zodra je boven de 5 m/s komt, en zet zijn botsdoos mee omlaag naar
0,35 m. Een
auto negeert botsdozen lager dan 3,5 m (`ignoreLowH`, hetzelfde mechanisme
waarmee je over een stoeprand en onder een luifel door rijdt), dus je rijdt er
daarna overheen; te voet loop je er nog tegenaan, en dat hoort ook. Overeind
komen gebeurt pas **veertig seconden later én meer dan zestig meter verderop**:
iets zien opstaan waar je naar kijkt leest als een fout.

*5. De onzichtbare muur op (800.9, −554.2).* Dit is punt 2 van de lijst hieronder,
nu voor het eerst echt gebruikt. `data/stijl/omgeving.json` heeft een blok
`wegafsluitingen` met `{naam, punt, muur}`; de generator zoekt de dichtstbijzijnde
**drijfbare** rijbaan-as, neemt daar de richting en de breedte van, en schrijft
`wegafsluitingen` naar de kaart. `js/afsluiting.js` bouwt er rood-wit gestreepte
schrikhekken van (de streping op een canvas, zoals alle textuur in dit spel) met
een baken aan weerszijden, en zet er een botsdoos van `muur` meter breed en vier
meter hoog achter. Die breedte is het hele punt: zonder dat rij je er via de berm
omheen en is de afzetting een decorstuk. `addCollider` wil de hoek van de **lange
as** zelf (`−atan2(dz, dx)`) en niet de draaiing van het model; dat scheelt een
kwartslag, en de doos lag er de eerste keer dwars overheen.

*6. Het verhoogde platform bij het tankstation.* Op de foto lag er een betonnen
verhoging midden op het pompplein. Dat was het BGT-vlak van het bouwwerk **van de
luifel zelf**: de generator zoekt dat bouwwerk op om de luifel te plaatsen, maar
liet het daarna ook nog als `bouwwerk` in `VLAKKEN` staan, en een bouwwerk wordt
in de wereld een plaat van een halve meter hoog. Eén regel: het vlak gaat uit de
lijst zodra het als luifel is gebruikt. `tanktest` toetste tot nu toe of er een
bouwwerk-vlak bij het zwaartepunt van de luifel lag — dat is precies het vlak dat
er nu níét meer hoort te zijn, dus die controle kijkt nu naar de ring die het
tankstation zelf bewaart en eist dat er géén vlak meer overheen ligt.

*7. Wat er niet is gedaan.* "Op locatie screenshot op Lemmerweg loopt het omhoog
de rotonde, onder rotonde loopt de andere weg door." Op de foto is niet te zien
welke van de rotondes aan de Lemmerweg het is, en het hoogteveld op de verkeerde
plek verbouwen maakt het alleen erger. Dit wacht op twee getallen uit het spel
(**K**).

Controle: `npm run betatest` (negentien controles) en `npm run betashots`.

**De rotonde over de N7 (stap 46).**

Het laatste punt uit de beta-test: *"op lemmerweg loopt het omhoog de rotonde,
onder rotonde loopt de andere weg door"*. De gebruiker stuurde er drie
schermafdrukken van Google Maps bij, en de derde gaf het antwoord: de rijksweg
ligt daar in een **bak**, met twee viaducten erboven. De rotonde zelf ligt
gewoon op maaiveld.

*Wat het is.* Eén rotonde met twee halve middeneilanden: de ring spant over de
N7 heen met twee brugdekken, west en oost, en tussen de eilanden door loopt de
rijksweg eronder. In de BGT staat dat er precies zo in — de twee dekken hebben
relatieveHoogteligging 1 — maar de BGT kent geen hoogte, dus het lag in het spel
allemaal plat op elkaar.

*De eerste poging was verkeerd om.* Die tilde de hele ring vijf en een halve
meter op (een nieuw soort hoogtestuk: een plateau, een rechthoek die overal even
hoog ligt). Dat klopte niet met de foto's en het werkte ook niet: de BGT tekent
hier één groot wegvlak waar zowel de rijksweg als alle op- en afritten in
zitten, en dat vlak half optillen geeft scherven asfalt en grasheuvels over de
rijbaan. Bovendien moest dan élke aansluitende weg mee omhoog. Die weg is
teruggedraaid.

*Wat er wel staat.* De bestaande viaductmachinerie met een minteken ervoor:
`verdiept`. Een viaduct is een weg die ergens overheen gaat — een lijn met een
hoogte erlangs, een kruin en een talud. Een verdiepte weg is precies hetzelfde,
maar de hoogtes zijn negatief en het dek ligt niet bovenop de weg maar erboven
op maaiveld. Daarmee verandert er maar één ding aan de wereld: de rijksweg zelf
zakt over driehonderdvijftig meter weg tot −5,6 m en komt er weer uit. De
rotonde, de op- en afritten en de hele wijk blijven waar ze lagen.

Vier dingen moesten erbij:

1. *de as met de hand.* Het skelet van de rijbaanvlakken heeft onder de brug een
   gat, dus de kortste weg van west naar oost loopt over de rotonde in plaats
   van eronderdoor. Voor deze ene weg staat de middellijn daarom in
   `data/stijl/omgeving.json`, om de twintig meter uit de BGT-vlakken gelezen —
   het midden van de twee rijbanen samen;
2. *de bak moet zo breed zijn als de weg.* Een rijksweg is twee rijbanen met
   gras ertussen; meet je alleen tot waar de verharding ophoudt, dan krijg je
   twee smalle geulen met een richel ertussen. `kruinGat` laat de meting over
   een middenberm heen stappen, `kruinMax` houdt hem van de rotonde af, en onder
   het dek is de bak precies zo breed als het dek spant (`bakBreed`);
3. *een gat in het grondvlak.* Onder de hele wereld ligt een vlak op −1 m voor
   de kieren. Dat lag als een deksel over de bak: je keek op gras in plaats van
   in de tunnelbak. Het is nu een vorm met een gat erin (`ShapeGeometry`), met
   een tweede vlak onder de bak;
4. *−Infinity als "de grond zelf".* `grondHoogte(x, z, y)` gebruikt `y` om te
   weten of je op een brug staat of eronder. Alles wat op de grond hoort te
   staan — bomen, straatmeubilair, lantaarnpalen, en de wereldopbouw zelf —
   vroeg dat met `y = 0`, en dat betekende in de bak "ik sta op maaiveld", dus
   boven de weg. Twee lantaarnpalen zweefden zo vijf meter boven de middenberm,
   mét botsdoos: de proefauto reed er middenin de bak tegenaan. Die aanroepen
   vragen nu `-Infinity`, wat voor de bestaande brug precies hetzelfde oplevert.

Gemeten: 351 m bak, 53 m onder de dekken, steilste helling 6 %, doorrijhoogte
4,7 m. Het bovenaanzicht bleef op 1,59 % — de controleplaat rendert plat, dus de
hoogte telt daar niet mee.

*En het fietspad eronderdoor (stap 46b).* De gebruiker stuurde er nog twee foto's
bij: het fietspad langs de rijksweg duikt onder de oprit door, met een keermuur
ernaast. De BGT heeft dat ook zo — onder de twee brugdekken van de opritten
liggen fietspad- en voetpadvlakken — maar het lag plat op elkaar. Twee verdiepte
paden erbij, met 2,5 m doorrijhoogte en een dek van 70 cm; de as is met de hand
uit de padvlakken gelezen, want het skelet maakt alleen middellijnen voor
rijbanen. Aan de kant van de rijksweg lopen ze door tot ín de bak, zodat de klim
eruit wegvalt onder de diepere bak in plaats van als muurtje in beeld te komen.

Eén ding brak daarvan: het gat in het grondvlak. Twee overlappende gaten in één
`Shape` geven een driehoeksverdeling waar je niets aan hebt — het fietstunneltje
ligt binnen de bak van de rijksweg — en dan blijft het deksel op −1 m gewoon
liggen. Overlappende gaten worden nu eerst samengevoegd tot hun omhullende.

Controle: `npm run rotondetest` (drieëntwintig controles) en `npm run rotondeshots`.

**Muren, hekken en vangrails uit de BGT (stap 47).**

Twee lagen bleven liggen. In `scheiding` zitten muren, hekken, kademuren,
walbeschermingen en damwanden; in `weginrichtingselement` de vangrails
(`geleideconstructie`) en de balustrades op de bruggen. De generator sloeg ze
over met de opmerking dat er in Tinga alleen kademuren in stonden — dat klopte
toen, maar met IJlst en Duinterpen erbij zijn het 111 objecten en ruim acht
kilometer.

Wat er bij kwam kijken:

- *een muur is een vlak, geen lijn.* De BGT tekent hem als lang, smal polygoon.
  Die wordt hier teruggebracht tot zijn hartlijn: de ring wordt op zijn langste
  as geprojecteerd en om de twee meter wordt het midden dwars daarop genomen.
  De breedte van de omhullende rechthoek is meteen de dikte van de muur;
- *de punten worden uitgedund.* De BGT zet er om de halve meter een; voor een
  rechte muur van tachtig meter zijn twee genoeg. Een hek van 480 m is daardoor
  één doorzichtig vlak met een herhalende textuur;
- *een vangrail hangt.* Het blad zit op 52 cm op paaltjes van 72 cm, en je kijkt
  eronderdoor. Een dichte balk op de grond leest als een stoeprand. De paaltjes
  vielen er de eerste keer uit: ze werden gebouwd als doos van een millimeter
  lang, en dat viel precies weg tegen de ondergrens voor lengte in de
  doosfunctie;
- *botsdozen per segment.* Te voet loop je niet door een muur of een hek. Een
  auto negeert alles onder 3,5 m (`ignoreLowH`), dus dwars door een hek rijden
  kan nog steeds — dat is dezelfde afspraak als bij de tuinhekken.

Alles van één soort gaat in één mesh: vier draw calls voor acht kilometer.

Controle: `npm run scheidingtest` (achttien controles) en `npm run
scheidingshots`.

**Een tweede zender op de autoradio (stap 48).**

De radio had één zender met één nummer. Er kwam een tweede bij: **Radio
Spannenburg**, een uitzending van een uur (`audio/radio/spannenburg.mp3`).
`audio/radio/zenders.json` is nu de lijst, met per zender een naam, een logo en
zijn nummers; ontbreekt dat bestand, dan valt `js/audio.js` terug op de oude
`nummers.json`. Met **←** en **→** wissel je van zender zolang je in een auto
zit, en het logo van de zender komt drie seconden bovenaan het scherm
(`#zenderlogo` in `index.html`, gevuld vanuit `hud.toonZender()` met een doek dat
`T.logoTinga()` of `T.bordSpannenburg()` tekent — ook een logo is hier geen
plaatje maar een canvas).

Drie dingen die niet vanzelf goed gingen:

- *een uur duurt een uur.* Een uitzending die elke keer op 0 begint, hoor je
  drie keer hetzelfde begin van. Een zender met `doorlopend: true` loopt door
  alsof hij echt uitzendt: stap je in een auto waar je nog niet in zat, dan valt
  hij ergens willekeurig in het uur binnen (`Math.random() * (duur - 60)`), en
  `zenderStand[]` onthoudt per zender waar je gebleven was, per auto
  (`radioInstap(sleutel)`). Dezelfde auto weer in betekent verder waar je was;
- *`src` opnieuw zetten zet `currentTime` terug op nul.* De speler laadde bij elk
  nummerbesluit dezelfde bron opnieuw, en daarmee viel de onthouden plek weg.
  Nu wordt `src` alleen toegekend als de URL écht anders is, en de plek wordt
  meteen gezet als `readyState >= 1`, anders bij `loadedmetadata`;
- *springen in een mp3 vraagt om Range.* `python3 -m http.server` kan geen
  `Range: bytes=…` en stuurt het hele bestand met status 200; de browser springt
  dan niet en `currentTime` blijft nul. Daarom staat er nu een eigen servertje,
  `tools/server.mjs` (`npm run server`), dat 206 met `Content-Range` antwoordt, en
  heeft `desktop/main.cjs` hetzelfde gekregen voor de Windows-app. GitHub Pages
  kon het al.

De pijltoetsen stuurden tot nu toe ook de auto; dat doen nu alleen nog **A** en
**D**, zodat ← en → vrij zijn voor de zender.

Controle: `npm run radiotest` (achttien controles, waaronder: twee zenders in de
lijst, → wisselt, de nieuwe zender speelt op 3322 s, het logo staat er, een
andere auto begint ergens anders in het uur, en de server antwoordt Range met
206).

**De twaalf punten uit het Word-document (stap 49).**

Een lijst van twaalf losse punten, net als de beta-test van een ronde eerder.
Punt 11 (Radio Spannenburg) staat hierboven als stap 48; de andere elf zijn deze
ronde gedaan. Wat er bij een paar ervan kwam kijken:

- *het laadscherm wacht op enter* (punt 3). De balk stond vol en het spel begon
  vanzelf; nu komt er onderaan "klik op enter om te beginnen" te staan en blijft
  het beeld staan tot je drukt. Op een aanraakscherm is er geen enter, dus daar
  staat er "tik op het scherm" en luistert hij op `pointerdown`. Twee proeven
  liepen erop vast (menutest en touchtest wachtten op een spel dat vanzelf
  begon); die klikken hem nu door;
- *het machinegeweer* (punt 5). De verleiding was een tweede wapenmodel naast het
  pistool te zetten. Het is één functie geworden met een schakelaar: de greep, de
  hand, de onderarm, het mondingsvuur en de hele herlaadbeweging in vijf stappen
  zijn voor allebei hetzelfde — dat is waar de speler aan vastzit — en alleen wat
  erboven zit verschilt. `maakPistool` en `maakMitrailleur` zijn twee regels om
  `maakWapen(geluid, soort)` heen. De magazijnen liggen per wapen apart
  (`magazijnen`), de voorraad kogels is er één voor allebei — zo past de munitie
  van een agent altijd;
- *"het pistool schiet niet meer"*. Het automatische vuur kreeg een klok tussen
  twee schoten, en die zette ik ook op het pistool. De wapenproef viel er meteen
  over: die vuurt vierentwintig keer achter elkaar zonder een beeld te draaien,
  dus de klok liep nooit af en er kwam één schot uit. Het pistool heeft nu tempo
  nul — zo snel als je klikt, precies zoals het was;
- *de koplampen clippen nog* (punt 4). Dit was al een keer "opgelost" door de
  lampen ondieper te maken, en toch flikkerde het. De lampen waren ook niet het
  probleem: de **grille** lag op precies dezelfde diepte en was zo breed dat er
  een kwart meter van over de lampen heen lag. Twee vlakken op dezelfde plek
  flikkeren over elkaar heen zodra je langs de neus loopt. De grille houdt nu op
  waar de lamp begint en ligt een centimeter dieper;
- *achteruit wegrijden* (punt 1). Het verkeer rijdt op rails, dus achteruit is
  dezelfde baan de andere kant op — dat deel was makkelijk. Wat niet lukte: een
  auto die met tachtig over de N7 rijdt, remt in anderhalve seconde niet naar
  achteruit. De klok liep af voordat hij ooit achteruit reed. Een aanrijding zet
  zijn snelheid nu vrijwel op nul, want dat is ook wat een klap doet;
- *op een rijdende auto schieten* (punt 10) kon helemaal niet: het verkeer stond
  niet in de doelenlijst waar de kogel op mikt. Nu wel — de bestuurder geeft gas,
  maar de auto gaat niet in vlammen op: een wrak midden op de N7 sluit de rij
  erachter op;
- *meer omgevingsgeluid* (punt 8). Negen geluiden in plaats van één, op dezelfde
  manier gemaakt als de rest: een meeuw is een zaagtand met een knik erin, een
  kraai een ruisstoot door een smal filter, een torenklok drie tonen die samen
  uitdoven. Overdag een andere verzameling dan 's nachts, en nooit twee keer
  achter elkaar hetzelfde;
- *schudden naar afstand* (punt 12). Dat liep lineair uit tot veertig meter, dus
  een knal een straat verderop gaf nog een flinke duw terwijl je hem nauwelijks
  hoorde. Nu telt het kwadraat, en het geluid van de explosie zakt op dezelfde
  manier weg — dat was tot nu toe overal even hard;
- *buit op straat* (punt 2 en 6). Een nieuw bestandje, `js/buit.js`: een
  stapeltje briefjes of een doosje patronen dat ronddraait en dobbert, en dat je
  oppakt door erlangs te lopen. Levensgroot was het niet te zien (een pakje
  briefjes is vijftien centimeter), dus het staat er op 170 % — dezelfde
  overdrijving die GTA gebruikt.

Controle: `npm run puntentest` (vijfenveertig controles) en `npm run puntenshots`.

**Mensen, auto's en een wijk die geleefd heeft (stap 50).**

Een tweede lijst dezelfde dag: de mensen en de auto's er beter uit laten zien,
de wijk minder schoon maken, zwaardere politie vanaf vier sterren, bukken met C,
en de meldingen bij aanrijden en neerschieten eruit.

*De mensen.* Het model was niet het probleem — dat had al een skelet met
ellebogen en knieën. Wat ontbrak was dat het **lichaam zelf** meedeed: armen en
benen zwaaiden en de romp stond er kaarsrecht en doodstil bij. Vier dingen erbij
in `loopHouding` (js/lichaam.js), en daarmee in één klap voor de voetgangers
(instanced) én voor de losse poppetjes: voorover hellen, een zijwaartse slinger
op het dubbele van de pasfrequentie, een hoofd dat er tegenin draait, en armen
die een paar graden naar buiten hangen. Plus een enkel die afzet in plaats van
de knie te volgen, en ademhalen voor wie stilstaat.

Dat laatste vroeg twee dingen van de aanroepers: de voetgangers geven nu
`time + i` mee, zodat niet honderddertig mensen als één man staan te deinen, en
de zijwaartse slinger moest in de euler van elk onderdeel — met de volgorde YXZ
is dat de binnenste draai, dus hij kantelt om de lengteas van het lichaam en
niet om een wereldas. Bij de armen kwam er een correctie bij: die naar buiten
draaien verschuift de elleboog met `sin(zij)` en verkort de projectie met
`cos(zij)`; zonder dat knikt de arm bij de elleboog.

Aan het uiterlijk: ogen (een eigen onderdeel, want een eigen kleur), een kaak met
een kin, schouders, een broekband, een duim, een zool, en korte mouwen voor ruim
de helft. Eén ding ging mis en was leerzaam: de eerste versie had ook
wenkbrauwen, en op tien meter liepen die met de ogen samen tot één donkere band
over het gezicht — een blinddoek. Twee kleine ogen doen het werk.

*De auto's.* Het dak was smaller dan de zijruiten; aan weerskanten bleef tien
centimeter open en van schuin voren leek elke auto een cabriolet. Verder velgen
met spaken (aan beide kanten van de band — een schijf in het midden verdwijnt
erin), wissers, een antenne, lamellen in de grille en een vuilrand langs de
dorpel. Twee van die nieuwe details liepen meteen tegen de proef aan: de
vuilrand sneed dwars door de banden (nu tussen de wielkasten door, net als de
sierlijst) en de wissers hingen vijftien centimeter boven de motorkap in de lucht
(nu in hun ruststand erop). Dat de rijtest die twee eruit haalt is precies
waarvoor hij er is.

*Minder schoon.* Dit was de open vraag van de gebruiker en er zat een keuze in:
alles vuil maken is net zo verkeerd als alles schoon. Wat er gekomen is:

- een **verweerlaag over elke gevel** (js/textures.js): groene aanslag op de
  plint met een rafelige bovenrand, regenstrepen onder de vensterbanken — daar
  worden de ramen tijdens het tekenen voor bijgehouden — roet onder de dakrand,
  vlekken en haarscheurtjes. Hoe vuil hangt per huis af, en één op de zes blijft
  bijna schoon;
- **js/rommel.js**: 28.625 pollen onkruid langs de trottoirbanden, 3427 stuks
  zwerfvuil in de goot en 936 rolcontainers, allemaal per tegel in instanced
  meshes met een afstandsgrens. Waar het staat komt uit een dobbelsteen die aan
  de plek hangt, dus dezelfde kaart geeft dezelfde rommel en er hoeft niets van
  bewaard te worden;
- **tags op de blinde muren** uit de BGT (js/scheiding.js): een vlak vijf
  centimeter voor de muur, met de uv's op een van de vier tags van het doek.

Kosten: 45 draw calls, zes megabyte textuur en anderhalve seconde opbouwtijd.
Niets meetbaars per beeld.

*Bukken.* Hoeveel je zakt is niet geschat maar uitgerekend: met een heup van
1,45 en een knie van 2,15 radialen houdt het been
`bovenbeen·cos(h) + onderbeen·cos(h−k)` aan hoogte over, en dat is achtenveertig
centimeter minder dan rechtop. Datzelfde getal zakt de camera én het poppetje in
de derde persoon — het is hetzelfde lichaam. Waar het voor dient zit in
js/politie.js: de zichtlijn wordt op 0,75 m getoetst in plaats van 1,30 m, en
dus houdt een tuinmuurtje of een geparkeerde auto je uit het zicht.

*Machinepistolen vanaf vier sterren.* Veertig procent bij vier sterren, de helft
bij vijf, per agent bepaald op het moment dat hij uitrukt. Salvo's van drie, en
elk schot daarvan op 45 % van de gewone trefkans — zonder die verzwakking is
vier sterren geen uitdaging meer maar een executie.

Controle: `npm run vuiltest` (vierenveertig controles) en `npm run vuilshots`.

**Een interieur in de auto, en twintig nieuwe steekproefplekken (stap 51).**

*Het interieur.* De vraag was of het slim kon, en dat kan: er komt géén
interieur in elk automodel. De 1781 geparkeerde auto's zijn instanced meshes en
krijgen er niets bij; er is maar één auto tegelijk waar je in zit, en alleen die
ene krijgt js/autobinnen.js erin gehangen — aan de carrosseriegroep, zodat het
meehelt in de bocht. Eenenveertig onderdelen, 353 driehoeken, en buiten die auto
kost het niets.

Twee dingen die eruit kwamen rollen en die groter waren dan het interieur zelf:

- *het oogpunt lag buiten de auto.* Het stond vóór de voorruit en vlak onder de
  dakrand — boven de motorkap dus. Dat was ooit een noodgreep: er was geen
  interieur, en vanaf de stoel keek je door twee getinte ruiten naar een leeg
  gat. Nu zit het waar een stoel staat, en voor de bestelbus apart uitgerekend,
  want die heeft een hoge neus: op de gewone hoogte keek de bestuurder tegen
  zijn eigen motorkap aan;
- *de carrosserie was massief.* De flank en de schouderlijn liepen als dichte
  blokken door de hele auto, en de cabine van de bakwagen was één blok. Zodra de
  camera erin zat, keek je tegen de bovenkant van zo'n blok aan: een rode vlakte
  waar het interieur hoort te zitten. `holleKoker()` in js/carmodel.js haalt het
  middenstuk eruit en laat twee zijwanden plus een vulling voor en achter staan.
  Van buiten is er niets aan veranderd — de buitenvlakken liggen op precies
  dezelfde plek, en de rijproef bevestigt dat.

Twee proeven moesten mee. "Het rijdende model kost meshes voor die ene auto en
verder niets" telde er achttien; dat zijn er nu achtenvijftig, waarvan
eenenveertig interieur — de proef telt die apart, zodat de carrosserie zelf nog
steeds niet mag groeien. En "vanachter het stuur kijk je vrij naar buiten" keek
recht vooruit vanuit een punt dat buiten de auto lag; nu zit die straal ín de
auto, dus hij telt alleen wat zíchtbaar is (de ruiten staan uit) en er is een
tweede controle bij: naar beneden kijkend móet je het dashboard zien.

*Twintig nieuwe steekproefplekken.* De wereld is doorgetrokken tot IJlst,
Duinterpen en de nieuwbouw ten oosten van Tinga, maar elke straat daar wordt nog
met het Molenkrite-woningtype getekend: de gele baksteen en de kap van Tinga uit
de jaren zeventig. Dat is de grootste openstaande aanname in de hele kaart. Ronde
3 in `data/stijl/steekproef.json` zet er vijftien adressen en vijf plekken
tegenover: zes in de nieuwbouw, vijf in IJlst, vier in de noordoosthoek (waar
het 3D BAG-dak ontbreekt en het pand als opgetrokken grondvlak in het spel
staat), en vijf omgevingsplekken waaronder één die uitsluitend over de
vuilronde van stap 50 gaat — waar staan de rolcontainers echt, hoeveel onkruid
staat er langs de band, en hoe vies zijn de plinten.

De rekensom voor het camerapunt is uit tools/geo/steekproef.mjs gehaald en staat
nu in tools/geo/steekproefplek.mjs, zodat het nieuwe
`node tools/geo/steekproeflinks.mjs 3` (dat alleen de lijst met Street
View-links maakt, zonder browser) gegarandeerd hetzelfde standpunt gebruikt als
het gereedschap dat er een foto van het spel bij rendert. De lijst staat in
`docs/steekproef/ronde3.md`.

**Het schap bij Tinga State (stap 52).**

Er lag één doos kogels op toets E, en daar kwam het machinegeweer op F bij. Met
een verbandtrommel en een pistool erbij wordt dat een toetsenbord vol losse
afspraken. Het is nu een lijst: elk artikel weet zelf wat het kost, of het nog
zin heeft om aangeboden te worden, en wat er gebeurt als je het koopt. Aan de
toonbank staat die lijst genummerd in beeld en je koopt met de cijfertoets van
dat nummer. Er kan iets bij zonder dat er een toets bij hoeft.

Twee keuzes die er in zitten. De **verbandtrommel** vult altijd tot precies vol
en geen punt meer; wie al fit is krijgt hem niet verkocht en betaalt dus ook
niets — die staat dan ook niet meer in de lijst, en de nummers schuiven op. Wat
je ziet is wat je indrukt. Het **pistool** ligt in het schap maar je hebt er al
een bij het begin van het spel, dus hij staat er grijs bij als *in bezit*; raak
je er ooit een kwijt — bijvoorbeeld bij een aanhouding, zie docs/PLAN.md — dan
staat hij vanzelf weer op de lijst.

Controle: `npm run winkeltest` (de negen nieuwe controles staan onder *het schap
aan de toonbank*).

**Over het vizier, opbergen, en een politie die vooruitdenkt (stap 53).**

Zeven punten, waarvan er twee in vijf minuten zaten en vijf echt werk waren.

**Het startgeld** ging van € 50 naar € 1000. Dat is geen spelbalans maar een
testinstelling: het schap van Tinga State hoort in één keer uit te proberen te
zijn zonder eerst het verhaal uit te spelen. Drie proeven gingen ervan om (ze
gingen uit van een lege portemonnee na één doos kogels) en die maken de
portemonnee nu expliciet leeg waar dat de vraag is.

**Onkruid op de rijbaan.** De pollen uit stap 50 stonden op een vaste afstand
uit het hart van de weg-as, en die as weet alleen hoe breed het weglichaam
*ongeveer* is. In een bocht, bij een inham en bij een verbreding voor een
kruising ligt het echte asfalt meters verder, en daar stond dus gras midden op
de weg. Elke pol wordt nu getoetst aan het kaartvlak waar hij op valt
(`vlakOp` uit js/kaartwereld.js): op een rijbaan, fietspad, parkeervlak of brug
schuift hij per stap veertig centimeter naar buiten tot hij eraf is, en lukt dat
binnen een paar meter niet, dan vervalt hij. 28.625 pollen werden er 24.425.
Verharding waar je alleen loopt — voetpad, erf, inrit — staat expres niet in die
lijst: dáár groeit het juist tussen de tegels door.

**Over het vizier richten** was de grootste. Het zit hem in één getal: de korrel
en de keep van het model staan allebei op dezelfde hoogte boven de kast en
allebei op x = 0, dus het wapen hoeft alleen maar op x = 0 en y = −die hoogte
gezet te worden om de vizierlijn precies door het midden van het scherm te laten
lopen. Dat getal is niet het hart van de korrel maar de **bovenkant** ervan
(4,8 cm bij het pistool, 6,2 bij het machinepistool): mik je op het hart, dan
ligt de bovenkant van de slede exact op ooghoogte, kijk je er van opzij tegenaan
en is het één zwart blok. Een halve centimeter hoger kijk je er overheen.

De tweede les kwam uit de foto's: het pistool moest bij het richten **verder van
je af** (gestrekte armen, −0,54 m in plaats van −0,42), en het machinepistool
ook, omdat de ingeklapte schouderstut eenentwintig centimeter achter de kast
uitsteekt en anders in je oog staat. Verder: beeldhoek 72° → 54°, muis 42 %
trager, lopen op 55 % en rennen uit, terugslag op 42 % en spreiding op 30 %.
Tien schoten met het machinegeweer tillen het beeld aangeslagen 0,08 rad op in
plaats van 0,19.

**Wisselen is een beweging geworden.** Het was een omschakeling in één beeld, en
dat is geen wisselen maar toveren. Nu gaat het in twee stukken: 0,24 s wegbergen
(het wapen zakt met de loop omlaag en de kolf naar binnen onder de onderrand
weg), dán wisselt het model — op het moment dat je niets meer ziet, dus je ziet
nooit een wapen in je hand verspringen — en 0,28 s trekken. Ondertussen schiet
en herlaad je niet. Een wapen dat je koopt maakt alleen de tweede helft.

**Het schap kreeg plaatjes.** Eén regel tekst leest als een menu in een
terminal; het is nu een rij kaartjes met een getekende afbeelding, het nummer in
een geel blokje en de prijs eronder. De plaatjes zijn getekend op een canvas
(`schapIcoon` in js/textures.js) — een doos patronen, een verbandtrommel, en de
zijkanten van de twee wapens, elk op een plank met een schaduwtje. De kaartjes
worden alleen opnieuw opgebouwd als de lijst verandert; een handtekening van
namen en prijzen zegt of dat zo is.

**De politie: onderscheppen, versperren, en een helikopter.** Dit zijn de punten
1.2, 1.3 en 1.4 uit docs/PLAN.md.

*Onderscheppen.* Een wagen reed naar `laatstBekend` — de plek waar je wás — en
op snelheid is dat per definitie te laat. `onderschepPunt()` trekt je snelheid
en richting door (zes en een halve seconde vooruit, geplakt op het wegennet) en
de jagers rijden daarheen. Drie regels houden het eerlijk: er moet vaart in
zitten (5,6 m/s), de wagen moet achter je hangen, en het punt mag niet veel
verder van hem liggen dan van jou. De dichtstbijzijnde jager blijft expres
gewoon achter je aan rijden — anders is je spiegel leeg en merk je van de hele
achtervolging niets.

*De wegversperring* ging van vier naar drie sterren (bij vier ben je meestal al
te voet, en dan kwam hij nooit voor) en wordt nu op je voorspelde route gezet in
plaats van op een willekeurig punt vóór je: de routezoeker rekent uit hoe je
naar het onderscheppunt rijdt, en de wagens komen op het eerste punt van díe
route dat ver genoeg vooruit ligt en dat je nog niet kunt zien. Lukt dat niet,
dan valt hij terug op de oude manier.

*De helikopter* (js/helikopter.js) is nieuw. Vanaf vier sterren vliegt hij aan,
cirkelt op 62 m in een rondje van 48 m boven `anker()` — de plek waar ze je
vermoeden, niet waar je bent — en werkt die plek bij zolang hij je ziet. Wat hem
tegenhoudt is expres een kort lijstje dat je kunt navertellen: gehurkt, onder
een boomkroon, in een bos- of heestervlak uit de kaart, of onder een dek. Die
eerste maakt toets C in één klap veel belangrijker; de tweede en derde geven de
bomen langs de Wieken en het bosje bij de Buitenroede een reden om er te staan.
"Onder een boom" is een rooster over `treePositions` uit js/world.js met de
kroonstraal van 2,2 m maal de schaal; "onder een dek" is `grondHoogte(x, z, ∞)`
tegen de hoogte waar je staat. Het model is met de hand gebouwd — witte romp met
een blauwe streep, staartboom met vin en staartrotor, vier bladen met een
doorzichtige waas eroverheen, twee sleden — en het geluid is het slaan van de
bladen: een lage zaagtand door een laagdoorlaat met ruis die op diezelfde
slagfrequentie open- en dichtgaat, allebei zachter en doffer met de afstand.

Twee bestaande proeven gingen hiervan om, en dat is precies wat je wilt zien:
`politietest` ging ervan uit dat ze bij vier sterren niet weten waar je staat als
niemand je ziet — met een heli boven je hoofd klopt dat niet meer, dus daar
hurkt de speler nu; en `puntentest` wisselde twee keer van wapen in één beeld,
wat nu niet meer kan.

Controle: `npm run richttest` (achttien controles: de vizierlijn, de beeldhoek,
het kruisje, de terugslag, de wisselbeweging, het schap en het onkruid) en
`npm run helitest` (twintig: de heli, de dekking, de versperring en het
onderscheppen). Foto's: `npm run richtshots` en `npm run helishots`.

**Ronde 4 van de steekproef.** Twintig nieuwe standpunten in
`docs/steekproef/ronde4.md`: twaalf adressen in Sneek buiten Tinga (die nu
allemaal met het Molenkrite- of Jasker-type getekend worden), vier metingen die
vreemd zijn (een goot op 5,70 met een nok op 5,76, een nok van 3,40 m, een blok
van 11,5 m en een nok op 14,4 m) en vijf plekken die het spel uit regels opbouwt
en die nog nooit tegen een foto zijn gelegd: het tankstation, het tennispark,
het sportpark, de volkstuinen en de houtzaagmolen.

**De Terpensmole en de houtkolk (stap 61).** Twee dingen uit dezelfde set foto's
(16 sep 2026), en allebei zaten ze al in de data — alleen verkeerd gelezen.

*Een molen die als schuur in de kaart stond.* Halverwege het Sneekerpad, het
slingerweggetje van Sneek naar IJlst, staat een spinnenkopmolen. In de BAG is dat
pand 1900100010085318: zestien vierkante meter grondvlak, nok 10,35 m, bouwjaar
1981. Zo werd het ook getekend — een schuurtje van vijf bij vijf, tien meter hoog,
midden in de wei. Een schuur met die maatverhouding bestaat niet, en dat is precies
hoe je zo'n pand terugvindt: zoek in de polder naar een klein grondvlak met een
grote nok.

De meting vertelt ook waar het misging. Die 10,35 m is niet de kap: de twee punten
boven de acht meter zitten allebei op een hóek van het grondvlak en niet in het
midden, dus dat is een roede en geen bovenhuis. De kap komt uit de dichte wolk
punten tussen 7,0 en 8,1 m en staat op 8,2. De vlucht (12 m) staat als opgemeten
waarde in de stijlcatalogus, van de foto — bij een molen is de puntenwolk voor het
gevlucht onbruikbaar, precies zoals bij De Rat.

`KAART.molens` heeft daarom nu een `soort`. Bij `stelling` (De Rat) blijft alles
zoals het was; bij `spinnenkop` vervallen de stelling en de zaagloodsen en komt het
vierkant van de romp uit de omhullende rechthoek van het grondvlak (3,96 × 3,94 m
onder −71,6°). Dat levert twee draaiingen op die niet samenvallen — de romp staat
in de richting van het pand, het bovenhuis op de wind — en dat is het kenmerk van
dit type: bij een achtkant zie je het verschil niet.

*De houtkolk achter De Rat.* Achter de zaagmolen ligt een waterdeel van 857 m² dat
met twee punten aan de Geeuw vastzit: geen vijver maar een aftakking. Daar lagen de
boomstammen te drijven. De kolk wordt gezocht als de **grootste** waterpartij binnen
tachtig meter tussen 300 en 4000 m², en alle drie die grenzen doen werk: zonder
bovengrens wint de Geeuw zelf (16.624 m²), zonder ondergrens de sloot pal naast de
molen (88 m² over veertig meter lengte, dus een greppel), en op "de dichtstbijzijnde"
wint diezelfde greppel omdat hij zes meter dichterbij ligt.

Elke stam wordt gepast voordat hij er ligt. De kolk heeft een knik, dus een stam van
zes meter langs de gemiddelde lengterichting steekt daar aan twee kanten de wal in.
Er wordt gekeken of allebei de uiteinden nog in het water liggen; zo niet draait hij
een stukje bij, en past hij nergens dan blijft die plek leeg. Zo volgen de stammen
vanzelf de vorm van de kolk in plaats van er dwars overheen te liggen. Ze drijven
ook echt: het hart ligt ónder de waterlijn, want nat hout ligt diep.

Eén ding kostte onnodig tijd. De nieuwe bakken voor de meshes kregen de naam `g`,
en verderop in dezelfde lus staat al een `const g` voor het gevlucht — dan valt de
eerste in de dode zone van dat blok en viel de hele pagina om met "Cannot access 'g'
before initialization", nog voor de wereld er stond. Hij heet nu `bakken`.

Controle: `npm run terptest` (zeventien controles) en `npm run terpshots`.

**Ronde 5 van de steekproef.** Vierentwintig standpunten in
`docs/steekproef/ronde5.md`, en deze ronde gaat over wat er *niet* in een rijtje
past. De vorige rondes gingen over steen, dakvorm en kozijnkleur van
rijtjeshuizen; die zijn nu redelijk op orde. Wat overblijft:

- **De oude stad van IJlst** (zeven adressen). De grachtenpanden van 1850 aan de
  Eegracht, de Galamagracht, de Popmawal en de Geeuwkade worden getekend als
  gewone Tinga-rijtjeshuizen met een kap (`molenkrite_kap`) — precies wat ze niet
  zijn. Uilenburg 56 is helemaal onduidelijk: 620 m² grondvlak, 12,5 m hoog, 1850.
- **De bedrijfspanden** (negen adressen). Drie hallen aan de Roodhemsterweg, De
  Finne en de Trompmoledyk, en zes panden aan of vlak bij de Lemmerweg. Allemaal
  `spil`, het algemene type. Bij Lemmerweg 130B en Lemmerweg 51 is er niet eens
  een 3D BAG-meting: daar staat een gok van goot 5,8 en nok 8,8 m.
- **Wat er nog niet staat** (acht plekken). De belangrijkste is het sportpark van
  IJlst: in de kaart ligt daar 7700 m² kunstgras, maar `KAART.sportvelden` kent
  alleen de vier velden van VV Sneek Wit Zwart aan de Molenkrite. In IJlst is het
  dus een groen vlak zonder doelen, belijning, ballenvangers of clubgebouw.
  Verder de twee grachten, het bedrijventerrein, de grootste hal van IJlst (6100
  m², zonder adres in de kaart), het profiel van de Lemmerweg, de brug daarin en
  de kade waar de sloep ligt.

**Vijf dingen die opvielen bij het spelen (stap 54).**

**Het schap bleef staan.** Kocht je iets bij Tinga State en drukte je op Esc,
dan bleven de kaartjes onderin het scherm hangen. Ze worden elk beeld door
js/boerderij.js gezet — maar de hoofdlus staat stil zolang je in het menu staat,
dus dan wordt er niets meer gezet en blijft staan wat er stond. `pauseGame` zet
ze nu uit, samen met het hintbalkje dat hetzelfde probleem had; komt de lus weer
op gang, dan staan ze er meteen weer als je nog aan de toonbank staat.

**De kogels die in de lucht bleven hangen** waren zwarte bolletjes van vier
centimeter die acht seconden bleven liggen, neergezet op het raakpunt van de
straal. Die straal raakt alleen dingen die *bewegen* — auto's, voetgangers,
agenten; de gebouwen zitten niet in de doelenlijst — dus het bolletje bleef
hangen op de plek waar de auto wás. Vandaar de rij zwarte kraaltjes in de lucht.
Het is nu een stofwolkje van 0,28 s uit een vaste voorraad van twaalf, met een
vonk erbij op blik en glas, dat met de hoofdlus meeloopt in plaats van met een
`setTimeout` — op pauze staat de wolk dus ook stil. Er blijft niets liggen.

**De herlaadbeweging.** Die deed mechanisch al het goede — magazijn eruit, nieuw
erin — maar je zag er niets van, en dat had twee oorzaken die elkaar versterkten.
Het wapen *zákte* drie centimeter bij het herladen, en de onderrand van het beeld
ligt op die afstand een kwart meter onder het midden: de magazijnschacht hing er
al tegenaan en alles wat eronder gebeurde viel buiten beeld. En het kantelde naar
rechts, recht in je eigen onderarm. Nu komt het tien centimeter omhoog, kantelt
het naar links, en draait de onderarm tegen de kanteling in mee (je elleboog
blijft staan als je je pols draait). Daar kwam een **linkerhand** bij die het
nieuwe magazijn brengt: dat is wat het van "een wapen dat zichzelf laadt" tot een
handeling maakt. Het lege magazijn valt nu ook echt — met de versnelling van de
zwaartekracht en een tuimeling erin — in plaats van weg te zakken.

**De portofoon (PLAN 1.1, half).** Ziet één agent je, dan wisten de anderen dat
niet: `laatstBekend` verschoof wel, maar wie aan het zoeken was liep zijn sector
af tot zijn zoektijd om was. Je kon dus in het volle zicht van een agent langs
vier collega's lopen die niets deden. Elke waarneming — van een agent, een
surveillanceauto of de helikopter — is nu een melding via `meldDoor()`, die na
0,9 s wordt uitgedeeld aan iedereen binnen 420 m die nog niet aan het jagen was.
Die gaan op `naarPlek`, en dat betekent rennen. `hoorSchot` en `meldTreffer`
lopen door dezelfde functie, zodat er één mechanisme is in plaats van drie
bijna-kopieën.

**Schieten verraadt je alleen nog als iemand het ziet.** In `misdaad()` stond
`kans = ster() > 0 ? 1 : …`: werd je al gezocht, dan was elke misdaad meteen een
melding, en de melding zette `laatstBekend` op de plek die werd doorgegeven. Voor
een lichaam klopt dat (dat ligt er en wordt gevonden), maar bij een schot is die
plek jóuw plek — dus elk schot in een lege steeg verraadde je. Nu geldt voor
'schot' dat er een getuige moet zijn: een voetganger binnen 32 m met vrij zicht,
of een agent in de buurt. De agenten kregen daarbij dezelfde zichteis als de
voetgangers; die telden eerst puur op afstand mee, dus ook dwars door een
huizenblok heen.

Twee proeven gingen hiervan om, en één bleek al die tijd op het randje te staan:
de meting "met getuigen erbij gaat de telefoon veel vaker" trok tweehonderd
monsters voor een verschil van twintig procentpunt, en dat viel om de zoveel
keer om zonder dat er iets veranderd was. Nu zeshonderd. En de wegversperring
uit stap 53 kon op vijftig meter uitkomen: die zocht honderdtien meter *asfalt*
vooruit, en een route die om een huizenblok buigt ligt daarna nog steeds bij je
om de hoek. Nu moeten allebei de afstanden kloppen.

Controle: `npm run meldtest` (tweeëntwintig controles over deze vijf punten),
plus de drie nieuwe foto's van het herladen in `npm run richtshots`.

**De wasboxen achter het tankstation, en wat je er doet (stap 55).**

Op de foto's van de Lemmerweg staan achter BP Slump Oil drie open wasboxen met
de groene band van BP erboven. Hier zijn het **gesloten** boxen met een roldeur
geworden, en dat verschil is het hele punt: je rijdt naar binnen, de deur gaat
achter je dicht, en je komt er in een andere kleur weer uit zonder sterren.
Honderd euro per ster.

**Waar ze staan.** Dit was het lastigste stuk, en het antwoord kwam uit de
kaart. Het terrein van het station is in de BGT krap: de luifel beslaat
z 127–140, de shop z 146–161, en alles daaromheen is rijbaan met een weg-as
erin — daar kun je niets neerzetten zonder het verkeer door een muur te laten
rijden. Maar de voetafdruk van de shop (pand 0091100000004556) heeft aan de
noordwestkant een inham: het lage deel loopt tot z ≈ 156,6 en het hoge deel
begint pas bij x ≈ 714,9. In het echt is dat de doorgang naar de wasstraat, en
daar past een rij van 9,3 bij 7,6 m precies, met de rug tegen het lage deel.
`plek()` in js/spuiterij.js leidt dat af uit de voetafdruk zelf — het westelijke
punt en de knik ernaast — zodat de rij meeschuift als de kaart verandert.

**De roldeur.** Een roldeur is geen plaat maar een stapel latten, en dat zie je
als hij opgaat. Het zijn er acht, elk met zijn eigen stukje van de beweging: de
bovenste verdwijnt als eerste in de kast en de rest schuift na.

De botsdoos eronder gaat mee, en daar zat een adder onder het gras. Een auto
negeert in `resolveCollisions` alles onder de drieënhalve meter (`ignoreLowH`),
zodat hij over stoepranden en door struiken kan — een muur van drie meter zou
hij dus dwars doorheen rijden. De wanden en de deur hebben daarom een botsdoos
van 4,2 m, onzichtbaar boven het dak uit. Opendoen is dan een kwestie van die
hoogte op nul zetten: `resolveCollisions` slaat hem over en er hoeft niets uit
de lijst gehaald te worden.

**Welke deur opengaat.** Eerst gingen alle drie tegelijk open. De boxen staan
drie meter uit elkaar, dus wie voor de middelste stopt staat ook binnen twaalf
meter van de twee ernaast en kijkt er nog schuin naartoe ook. Er is een tweede
eis bij gekomen: je moet met de box uitgelijnd staan, binnen driekwart
boxbreedte van zijn hartlijn. Dat is ook wat je in het echt doet.

**Eén keer per bezoek.** De tweede fout was erger: een auto die na het
overspuiten in de box bleef staan werd meteen opnieuw aan de beurt genomen —
deur dicht, spuiten, betalen — en zo door tot de portemonnee leeg was. De box
onthoudt nu welke auto er geweest is en laat hem pas weer toe als hij naar
buiten gereden is.

**Twee dingen die er nieuw voor waren.** `vehicles.verf(car, kleur)` spuit een
auto over: het lakmateriaal wordt per kleur gedeeld tussen alle auto's, dus het
wordt omgeruild en niet bijgemaakt, en de carrosseriedelen die de lak dragen
zijn in js/carmodel.js gemerkt met `userData.lak`. En `politie.vergeet()` zet de
verdenking op nul en laat de plek die ze wisten vervallen; de rest — wagens die
wegrijden, agenten die inrukken, blokkades die weggehaald worden — doet
`update` al zelf zodra er geen sterren meer zijn. `politie.blauwBij(x, z, r)`
telt wat er aan blauw in de buurt staat; daarmee blijft de deur dicht als ze
ernaast staan.

Controle: `npm run spuittest` (zesentwintig controles) en `npm run spuitshots`.

**Een kaart om af te drukken (stap 56).**

`tools/geo/printkaart.mjs` maakt het speelgebied als drukwerk: het hele spel van
boven op drie beeldpunten per meter (13.140 × 7500 px, op A1 dus bijna 400 dpi),
met een maatverdeling langs alle vier de randen, de straatnamen,
herkenningspunten, een schaalbalk, een noordpijl en een legenda.

De opname is dezelfde als bij `geo:boven` — het spel tekent zichzelf
orthografisch (`?boven=1&schaal=…`) in stukken — en alles wat erbovenop komt
wordt op een canvas in de browser getekend; er zitten geen beeldpakketten in dit
project.

Waar het om gaat is de **maatverdeling**: de cijfers langs de randen zijn
spelmeters, dezelfde die de K-toets afdrukt. Wat je op papier aanwijst is dus
meteen een coördinaat, en dat is precies wat er nodig is om de grens van het
speelgebied door te geven (tot nu toe ging dat punt voor punt via de K-toets).

Drie dingen die onderweg bijgesteld zijn. De maten van alles wat geen kaart is
hingen eerst aan de schaal in px/m; dat is fout — een afdruk op A1 is even groot
of je hem nu op één of op twee beeldpunten per meter maakt, dus de letters en de
lijnen horen aan de bladbreedte te hangen. Van de vierhonderd straatnamen vallen
er in de dichte buurten veel over elkaar heen, dus wat al bezet is wordt
overgeslagen — dat kost een stuk of honderd namen en levert een leesbare kaart
op. En er komt een tweede blad uit met een witte waas over de kaart: een stift op
een volle groene polder is niet te zien, en het scheelt een halve cartridge inkt.

Bewaard wordt de JPEG — op papier is het verschil er niet, en een blad van
honderdtwintig megapixel is per keer meer dan een gigabyte aan
opslaggeschiedenis. Met `--png` komt het lossless origineel er ook uit.

Na de eerste afdruk kwamen er twee dingen bij (zelfde stap). De **straatnamen**
zijn geschift: een straat krijgt alleen een naam als hij opgeteld 250 m lang is
óf ergens 9 m breed, dezelfde naam komt hoogstens drie keer voor en dan nog
minstens vierhonderd meter uit elkaar. Van de 414 bordjes blijven er ruim 150
over, en de zestien namen die helemaal wegvallen zijn stuk voor stuk steegjes
van onder de honderdvijftig meter. En de **herkenningspunten** staan nu alleen
nog op het lichte blad: op het blad waarop je tekent wil je weten waar Tinga
State en het startpunt liggen, op de kleurenplaat zitten die punten alleen in de
weg.

**Hoger en zonder raster (stap 57).**

Twee wensen aan dezelfde kaart: het raster eruit en wat meer beeldpunten. Het
**raster** van honderd meter over de hele plaat is vervangen door streepjes langs
de vier randen — kort om de honderd meter, lang om de vijfhonderd, met daar het
vette cijfer bij. Dat leest op papier beter: je tekent je grens niet meer dwars
door tweehonderd lijntjes heen. De **schaal** is van twee naar drie beeldpunten
per meter gegaan (13.140 × 7500 px, bijna 400 dpi op A1) en de straatnamen zijn
een maatje groter.

En toen kwam er een spierwitte kaart uit. Geen foutmelding, geen waarschuwing:
straatnamen, streepjes, schaalbalk en legenda stonden er keurig op, maar de kaart
zelf was leeg. De oorzaak zat in het opnemen: een stuk mag niet groter zijn dan
8192 px per kant, en op 3 px/m paste het gebied in twee stukken van 6570 × 7500.
Elke kant ruim binnen de grens — maar samen negenveertig megapixel, en zoveel
tekenvlak geeft swiftshader stilzwijgend leeg terug. Nu geldt er **ook een grens
op het oppervlak** (zestien megapixel per stuk, `js/main.js`), en knipt het spel
er zo nodig een rij of kolom bij; op 3 px/m zijn het acht stukken van 3285 × 3750.

Om dat nooit meer stil te laten gebeuren meldt `window.__boven` per stuk hoeveel
van de proefpunten een andere kleur heeft dan het eerste punt — nul betekent één
egale vlakte, dus een leeg stuk — en stopt `printkaart.mjs` met een foutmelding
in plaats van een lege plaat weg te schrijven. Bij dezelfde ingreep blijven de
opnamen in de bladzijde staan in plaats van als tekst naar node en weer terug te
reizen (dat scheelt honderden megabytes over de draad), en wordt de PNG van het
blad alleen nog gemaakt als er om gevraagd wordt.

**Varen (stap 58).**

Twee bestuurbare sloepen op het water — één aan de Geeuwkade achter de
waterzuivering, één aan de steiger in IJlst — als voorbereiding op een missie
waarbij er iets vervoerd moet worden dat niet over de weg kan. `js/boot.js`.

*De romp.* Een boot is geen doos en met een doos ziet het er ook naar uit. De
romp wordt **gelofd**: tweeëntwintig spanten over de lengte, elk spant een halve
superellips van het boord naar de kiel, en daartussen een vel. Drie functies doen
het werk — hoe breed dat spant is, hoe diep, en hoe hoog het boord er ligt (de
zeeg) — en die lopen van een scherpe steven naar een vlakke spiegel. De macht van
de superellips (2,7) bepaalt de kim: twee geeft een halve cirkel, hoger maakt de
bodem vlakker en de zij steiler. Daar komen bij: een berghout, een boord, een
houten vlonder, twee doften, een stuurconsole met een wiel, een
buitenboordmotor, navigatielichten, stootwillen, een bolder en de naam op de
spiegel — allemaal getekend, geen enkel plaatje.

*De natuurkunde.* De snelheid wordt uiteengelegd in **langsscheeps** en
**dwarsscheeps**. Langsscheeps is de weerstand klein en kwadratisch (traag op
gang, traag uitlopen — er zit geen rem op een boot), dwarsscheeps groot en
lineair: dat is de kiel. Daardoor zwenkt de achtersteven in een bocht naar buiten
en zeilt hij de bocht uit nadat het roer al recht staat. Het roer werkt met de
snelheid mee (stilliggend niets, achteruit andersom) en daar bovenop kan de
schroef hem op zijn plek ronddraaien zolang er gas op staat — anders kom je nooit
van de kant. Top achtentwintig meter per seconde vooruit, bijna negen achteruit (was zeven en twee;
sinds missie 8 over de Geeuw naar IJlst vaart is de sloep in twee stappen vier keer zo snel, en de
politiesloep veertig procent harder in plaats van tweeëntwintig). Het roer ging mee: een bocht is
snelheid gedeeld door draaisnelheid, dus zonder een groter roer werd de boog vierenvijftig meter en
paste hij niet meer in de vaart.

*De vaarweg.* `vaarbaar(x, z)` in `js/world.js`, naast het bestaande
`pointInWater`. Het verschil is één klasse: te voet ligt een brug bóven het water
en loop je eroverheen, varend ga je eronderdoor. Zonder dat onderscheid houdt de
Geeuw bij elke brug op. Een steiger en een duiker houden een boot wél tegen.
Vanaf de Geeuwkade hangt er 250.000 m² aan bevaarbaar water aan elkaar, vanaf
IJlst 185.000 m².

*De ligplaatsen.* Uit de kaart gemeten (ruim water, de oever ernaast, de as van
de vaargeul), maar de gemeten koers geldt midden op het water. Zodra de boot naar
de kade schuift klopt hij niet meer: bij allebei de ligplaatsen stak de steven de
wal in en kwam je drie meter ver. Daarom zoekt de module de koers **ter plekke**,
om de tien graden rond de meting, en wint de richting met de meeste ruimte zowel
vóór als achter. Past de plek aan de kade niet, dan blijft de boot op het gemeten
punt in het ruime water liggen.

*Twee dingen die het water afdwong.* De waterspiegel is één vlak vlak dwars door
de wereld; alles van de boot eronder is dus onzichtbaar. De vlonder lag eerst
26 cm ónder de waterlijn en je keek zo door je eigen boot het water in — nu ligt
hij er negen centimeter bóven, met een voordek, een achterdek en een schot
eronder. En het schuim in het kielzog was onzichtbaar omdat het water zelf half
doorzichtig is (opacity 0,94): één waterpolygoon van tweehonderd meter heeft zijn
middelpunt dichter bij de camera dan de vlek achter je boot, en werd er dus
overheen getekend. Een hogere `renderOrder` zet het schuim als laatste op het
scherm.

*Instappen.* Negen meter, want de speler kan het water niet in lopen
(`js/player.js` houdt hem tegen) en vanaf de kade is het hart van de romp al gauw
zes meter weg. Staat er een bestuurbare auto dichterbij, dan wint die — anders
kaapt een boot aan de overkant de auto weg waar je naast staat.

Controle: `npm run boottest` (achtendertig controles) en `npm run bootshots`.

**De wal, schieten vanaf de boot, en steekproef ronde 4 (stap 59).**

*De wal.* Met een boot kijk je van het water naar de kant, en dat is een
gezichtspunt waar de wereld nooit op gebouwd is. Vier dingen:

1. **De boot voer de wal in.** De proefpunten van `pastHier` lagen op 46 % van de
   lengte, ruim binnen de huid, terwijl de steven tot 3,47 m vooruit steekt (de
   overhang). De boeg zat dus een halve meter in het gras voordat er iets
   tegenhield. De punten liggen nu op de buitenkant: steven, spiegel en het
   breedste punt, met een paar ertussen.
2. **Er stond van alles in het water.** De BGT-lagen overlappen: een vak
   `heesters` loopt over een sloot heen en een straat langs een vaart heeft zijn
   goot boven het water. Bij de struiken zat het venijn in een detail — de plek
   van de bóóm werd nagekeken en de struik eronder kreeg daarna nog een zetje van
   1,25 m opzij dat níét meer werd nagekeken (`tools/geo/genereer.mjs`).
3. **De rommel keek naar het verkeerde vlak.** `vlakOp` geeft het bovenste vlak
   en over een sloot ligt vaak nog een strook oever of berm; een punt midden op
   het water las dan als gras. `js/rommel.js` krijgt nu een aparte toets op de
   waterpolygonen zelf mee.
4. **Door de oever heen kijken.** De oeverwand staat op de rand van het
   waterdeel met zijn normaal naar het water; zijn achterkant werd weggeknipt, en
   bij een waterdeel met een eiland erin kijkt hij de verkeerde kant op. Nu
   tweezijdig.

Wat hier het meeste tijd kostte was het níét vinden van een vijfde ding. De
donkere strook langs elke waterlijn die er als een gat uitziet, is geen gat: dat
is de oeverwand plus de damwand, achtenveertig centimeter muur tussen het gras op
0,12 en de waterspiegel op −0,35, van dichtbij en onder een scherende hoek. Een
A/B-opname met de oeverwand eenzijdig en tweezijdig gaf twee praktisch gelijke
beelden; pas toen was duidelijk dat het daar niet aan lag.

Controle: `npm run waltest` (acht controles).

*Schieten vanaf de boot.* Mechanisch kon het al — `magSchieten` kijkt alleen naar
de auto — maar het zag er niet naar uit. De **wapenanimatie** stond onderaan in
`player.update`, ná de afslagen voor auto en boot, dus in een voertuig bewoog het
wapen niet, kwam er geen mondingsvuur en was herladen een stilstaand plaatje
(dat gold ook in de auto). En **het poppetje** werd verborgen zodra je in een
voertuig zat: in een auto klopt dat, op een open sloep krijg je een boot die in
zijn eentje vaart en schiet. Een voertuig met `openDek` houdt het poppetje in
beeld, en `player.pos` staat aan boord op de stuurstand in plaats van in het hart
van de romp — dat is waar het poppetje staat, waar de camera vanuit je ogen hangt
en waar de kogel vandaan komt.

Bij hetzelfde werk kwam de **waterspiegel** goed te staan: de sloep ging uit van
−0,15 (de oude handgetekende kaart) terwijl elk van de 529 waterdelen in de BGT
op −0,35 ligt. De boot zweefde twintig centimeter.

*Steekproef ronde 4.* Tien foto's uit de vierde ronde (15 sep 2026) — Age
Piersstraat, Jonkvrouw, De Dassenboarch, Willem Santemastraat, Kaatsland,
Pripperstraat, Bockamastraat, Wilgeroosje, Apollovlinder en Jutrijpstraat —
hebben elk een eigen woningtype in `HOUSE_STYLES` gekregen en een regel in
`data/stijl/straten.json`. Deze straten liggen buiten Tinga zelf en wijken meer
van elkaar af dan de Tinga-rijtjes: er zit wit geschilderde steen bij
(Kaatsland), rode steen met een grijze betonband en een plat dak (Age
Piersstraat), een eenlaags rijtje met groene kozijnen (De Dassenboarch) en twee
straten met rode kozijnaccenten (Pripperstraat, Jutrijpstraat). Samen goed voor
504 panden.

**Erfscheidingen en de heli (stap 60).**

*Hekken, heggen en schuttingen.* Ze werden getekend en kregen geen botsdoos: je
liep er doorheen en de politie keek er doorheen. Alle 26.300 erfscheidingen
(samen 124 km) hebben er nu een, met hun hoogte erbij — een schutting van 1,80
breekt de kijklijn op 1,20 m, een heg van een halve meter niet.

Daarmee was het nog niet klaar, en het tweede stuk was het echte probleem.
`zichtVrij` toetste om de twee meter één punt: ligt dít punt in een doos? Dat
werkt voor een huis en niet voor een plank van zes centimeter — een kijklijn van
zes meter krijgt drie stapjes en die vallen er vrijwel altijd naast. Mét
botsdozen brak nog steeds maar een vijfde van de schuttingen de lijn. Meer
stapjes is geen oplossing (bij zes centimeter zou je om de paar centimeter
moeten proeven, duizenden toetsen over tweehonderd meter); het lijnstuk wordt nu
tegen de doos gesneden met de gewone slab-toets in het assenstelsel van de doos.
Exact, en goedkoper dan dertig punten proeven omdat er met een stempel geen doos
twee keer aan de beurt komt.

Gemeten: 120 van 120 schuttingen houden je tegen en breken de kijklijn (was 121
tegen en 22 zicht), `resolveCollisions` blijft op 0,002 ms per beeld bij 82.029
dozen. `npm run looptest` telt de punten die in een heg of schutting vallen nu
apart (4778 van 74.007) en kijkt voor "klem" alleen naar de dozen boven de twee
meter — een punt in een schutting is geen fout maar een schutting.

*De helikopter neerhalen.* Twintig treffers, het dubbele van een politieauto: hij
hangt op tweeënzestig meter en je schiet met een pistool omhoog naar iets dat
rondjes vliegt. Elke treffer telt als een schot op de politie. Bij de twintigste
verliest hij zijn staartrotor, tolt om zijn as, zakt met een rookpluim naar
beneden en slaat kapot; onderweg ziet hij je niet meer. De klap schudt de camera
tot op honderdveertig meter, laat de buurt wegrennen en kost leven binnen veertien
meter. Daarna duurt het vijfenveertig seconden voor er een nieuw toestel komt.

Controle: `npm run helitest` (twaalf controles erbij).

*De pijltjes op de kaart.* "Op de minimap lijkt hij verkeerd te richten", en dat
klopte — allebei de kaarten stonden fout, en op een manier die je makkelijk over
het hoofd ziet.

De minimap houdt jouw kijkrichting boven en draaide daarvoor over `-yaw + π`. Dat
is niet een halve slag mis maar een spiegeling: `-yaw + π` en `yaw` vallen alleen
samen bij yaw = ±π/2. Pal oost en pal west klopte de kaart dus, en daartussen
draaide hij de verkeerde kant op — twee keer zo hard, want wat je ziet is het
verschil 2·yaw. Narekenen: een punt één meter vóór je ligt op (−sin yaw, −cos yaw)
ten opzichte van jou, en na `rotate(θ)` komt dat op het doek uit op
(sin(θ − yaw), −cos(θ − yaw)). Recht boven het midden betekent x = 0 en y < 0, en
dat geldt alleen voor θ = yaw.

Op de grote kaart staat noorden boven en draait alleen het pijltje. Daar stond
dezelfde `-yaw + π`, en omdat de kaart zelf niet meedraait komt dat neer op
precies achteruit wijzen: de punt hoort op −yaw te staan (bij yaw 90° kijk je
naar het westen, en west is op een noord-boven kaart naar links). En de maat was
mis: binnen de `c.scale(schaal, schaal)` van de kaart stond de driehoek nog in
spelmeters, dus dertien eenheden was dertien méter — op een kaart van 0,25
beeldpunt per meter een vlekje van drie pixels. De stippen van de politie delen
daarom door de schaal en de winkels zetten hem terug op 1; dit pijltje deed geen
van beide. Nu zet hij de schaal terug en is hij een driehoek met een hap uit de
achterkant, met donkere omlijning.

Controle: `npm run kaarttest`, en die rekent niets na maar meet wat er op het doek
staat: waar staat de rode 'N' op de minimap, en waar de punt van het gele pijltje
op de grote kaart, in acht richtingen (0, 45, 90, 135, 180, 225, 270, 315°).
Zestien controles.

De toets zelf had ook nog een les. Hij zei eerst dat het pijltje bij 180° de
verkeerde kant op wees, en dat was de toets: "geel" stond er ruim in (r > 200,
g > 160, b < 110) en het bordje boven een winkel is #f2b632, wat daar net zo goed
aan voldoet. Het verste "gele" beeldpunt was dan een letter van een winkelnaam een
eind verderop. Met een nauwe test om #ffd400 heen kloppen alle acht richtingen.

*De boot in het opgeslagen spel.* F5 bewaarde de auto waar je in zat en wist
niets van de sloepen. Voer je naar IJlst en drukte je F9, dan stond je op de kant
en lag de boot weer op zijn ligplaats. Nu bewaart `js/opslag.js` waar allebei de
sloepen liggen en of jij aan het roer stond, en zet `js/boot.js` dat terug — mét
de koers, en zonder de walcontrole van het gewone uitstappen, want die weigert
midden op het water en dat is bij het laden van een opslag geen reden om aan
boord te blijven. Een opslag van vóór de boten heeft het veld niet; dan blijven
de sloepen staan waar ze staan, want terugzetten naar de ligplaats zou een boot
verplaatsen op grond van iets wat we juist niet weten.

Controle: `npm run boottest` (zes controles erbij, 45 in totaal).

*Schuttingen die breken.* Sinds de erfscheidingen botsdozen hebben houden ze je
tegen en breken ze de kijklijn, maar auto's negeren alles onder de 3,5 meter en
reden er nog dwars doorheen. De oplossing is niet dat een schutting een auto
tegenhoudt — achttien millimeter plank doet dat niet — maar dat hij het begeeft.

Twee dingen gebeuren er. De botsdoos krijgt hoogte nul, en daarmee is hij weg
voor iedereen tegelijk: `duwUit` laat hem los en `zichtVrij` toetst op hoogte, dus
de agent kijkt er voortaan overheen. Dat hoort ook: waar de schutting plat ligt is
geen dekking meer.

En de tekening klapt om. Dat was het lastige stuk: heggen en schuttingen staan
niet als losse meshes in de scene maar samengevoegd per tegel van 240 meter —
zesentwintigduizend losse objecten zou het spel niet trekken — dus er is geen
object om te draaien. Wat er nu wél is: elke erfscheiding onthoudt welk stukje van
welke hoekpuntenlijst van hem is. Die punten worden om de voet gescharnierd (hoe
hoger een punt zat, hoe verder het naar buiten komt) en dat is een paneel dat
omvalt, in de richting waarin de auto reed. Eén `needsUpdate` op de buffer en het
staat op het scherm.

Stilstaand gebeurt er niets (anders sloop je een tuin door ertegenaan te leunen),
het kost vaart naar het aantal panelen dat je meeneemt, en het klinkt naar hout:
`kraak()` in js/audio.js is drie droge knappen kort na elkaar met een lage bons
eronder, geen blikken `klap()`. De politie rijdt met dezelfde `drive`, dus een
achtervolging door de achtertuinen laat een spoor na.

Controle: `npm run breektest` (vijftien controles).

*Voetgangers die overal doorheen liepen.* Dat kwam niet door een fout in de
botsingen maar doordat ze er niet aan meededen: `js/npc.js` riep
`resolveCollisions` nooit aan. Hun plek wordt elk beeld uit hun wegvak berekend,
dus er viel niets op te lossen. Zolang ze over de stoep liepen viel het niet op;
bij het oversteken, na een aanrijding en overal waar de stoep langs een tuin loopt
wel.

Het wegvak blijft leidend — ze worden alleen uit de doos geduwd waar ze in zouden
staan. Daardoor schuiven ze langs een schutting in plaats van erdoorheen, en
vastlopen kan niet, want hun plek op het wegvak telt gewoon door. Wie neer ligt
blijft liggen. Gemeten: 0 van de 130 mensen staat nog in een heg, schutting of
muur, en het kost 0,102 ms per beeld voor alle honderddertig.

Controle: `npm run looptest` (twee controles erbij).

*De politie op het water.* Op de Geeuw was je veilig: de politie rijdt over de
weg, dus wie de sloep nam was van de achtervolging af. Er komt nu één
politiesloep achter je aan — donkerblauw, met een zwaailicht op de console en
twee agenten aan boord — en alleen als het ergens op slaat: je zit zélf in een
boot én er is verdenking. Aan de wal met vijf sterren komt er geen boot, en op het
water zonder sterren ook niet.

Hij komt op vijfentachtig tot honderdvijftig meter in beeld, bij voorkeur achter
je en uit het zicht, en vaart met dezelfde natuurkunde als jouw sloep: dezelfde
romp, dezelfde weerstand, dezelfde toets of de romp er nog past. Wat hij níet
deelt is de topsnelheid — 8,5 tegen 7,0 m/s — want anders is wegvaren geen keuze
maar een garantie. In plaats van een toetsenbord zit er een stuurautomaat op:
hij wil tot zestien meter naderen, en ligt er wal in de weg dan probeert hij een
waaier van koersen om de vijftien graden en neemt de vrijste. Veertien treffers
en de motor geeft het op.

Daar zat wel een prijs aan, en die was hoog. `vaarbaar(x, z)` liep door álle 529
waterpolygonen van de wereld met een volledige punt-in-polygoon-toets. Voor de
voetstappen viel dat niet op; met boten erbij is het de duurste lus van het spel
— de romp van een sloep wordt op negen punten getoetst en die koerswaaier komt
neer op honderden toetsen per beeld. Er ligt nu een rooster van veertig meter
overheen, net als bij de botsdozen. Gemeten: 2,89 µs per toets, en de vaarroute
over de hele overtocht ging van 810 naar 190 ms.

Controle: `npm run watertest` (veertien controles) en `npm run watershots`.

*De lading over het water.* Hier waren de boten voor. Ophalen in IJlst, over de
Geeuw naar de kade bij de waterzuivering, en de verdenking loopt onderweg op.

Eerst de vraag of het überhaupt kon: liggen die twee ligplaatsen aan hetzelfde
water? Dat was geen gegeven — IJlst en de Geeuw zijn aparte waterdelen in de BGT,
met in totaal 185.000 en 250.000 m² eraan vast. Gemeten met een breedte-eerst
zoektocht over `vaarbaar`: **ja**, 2532 meter vaarwater tegen 1773 meter
hemelsbreed. Zonder dat antwoord was de hele missie een onmogelijke opdracht
geweest.

Diezelfde zoektocht levert meteen de route op de kaart. De navigatie van het spel
loopt over wegassen en die houden bij de kade op, dus hier gaat er een rooster van
zes meter over het water — zes omdat de sloep 2,16 breed is en de smalste vaart
waar hij door moet een meter of acht.

Het verloop: je krijgt een telefoontje zodra het verhaal uitgespeeld is, de lading
komt aan boord zodra je in de sloep in IJlst stapt (en niet in die andere), en
vanaf dat moment loopt de verdenking van één ster naar drie. Met verdenking én een
boot onder je komt de politiesloep het water op. Bij de kade is de lading over,
en dan zijn ze je ook kwijt. Stap je onderweg uit, dan mislukt er niets — hij
wacht gewoon; dat is het verschil tussen een missie en een strafexpeditie.

Controle: `npm run vaarttest` (tweeëntwintig controles) en `npm run vaartshots`.

*De steekproeffoto's als JPEG.* Eén ronde steekproef is eenentachtig
schermafdrukken van 1280 × 720, en als PNG is dat tweeënzestig megabyte — elke
ronde opnieuw, in de git-geschiedenis. Het zijn foto's van een 3D-beeld met lucht,
gras en baksteen erop, precies waar JPEG voor gemaakt is. Op kwaliteit 82 gaat er
ruim tachtig procent af en zie je aan een gevel niets terug.
`tools/geo/steekproef.mjs` schrijft ze voortaan zo, en
`npm run geo:steekproefjpg` zet een bestaande map om (op een canvas in de
browser — er zitten geen beeldpakketten in dit project).

*Een pand dat te groot in beeld stond.* De twintig tiny houses aan de Molenkrite
kwamen niet uit een foto maar uit de data, en dat is het patroon dat hier steeds
terugkomt: zoek het pand dat niet kán kloppen. Eenendertig vierkante meter
grondvlak, goot op 4,2 m, nok op 6,3 m — en het stond in beeld als een rijtje
van twee lagen in gele baksteen, want dat is het standaardtype van die straat.
Hetzelfde argument als bij De Terpensmole: een schuur van vijf bij vijf met een
nok op tien meter bestaat niet, en een rijtjeswoning van eenendertig vierkante
meter ook niet. De foto van de gebruiker bevestigde het en leverde de kleuren; de
maat is niet aangeraakt.

Eraan vast zaten twee fouten die er al langer zaten. De eerste: een **blinde
muur** kreeg altijd metselwerk. De voor- en achtergevel gaan door `T.facade`, en
die kijkt naar `damwand` en `hout` in de stijl; de kop- en zijgevels gingen
rechtstreeks naar `T.brick`. Bij elk pand met baksteen viel dat niet op. Bij het
eerste pand zonder baksteen wel, en precies op de gevel die je vanaf de straat
ziet.

De tweede: **geen voordeur**. Een muurvlak krijgt pas een gevel met ramen als het
minstens 2,40 m breed is, want smaller is meestal een hoekje van het grondvlak.
Het grondvlak van een tiny house heeft zestien punten waarvan er twee een zijde
van meer dan 2,40 m opleveren — de twee lange zijden van 9,47 m. De voorkant is
opgedeeld in zeven facetjes van 0,07 tot 1,89 m, want daar zit de terugliggende
entreenis. De brede zijden kijken niet naar de straat en de straatkant was overal
te smal: het hele huis werd blinde muur. Die grens is nu per stijl instelbaar. Op
1,5 m kregen zeven van de twintig een gevel en dertien niet — de muurvlakken komen
namelijk niet uit het grondvlak maar uit het 3D BAG-model, en dat deelt dezelfde
nis nog eens verder op. Op 1,0 m hebben alle twintig een deur.

Dat is ook de reden om zo'n drempelwaarde per stijl te zetten en niet in het
algemeen te verlagen: 2,40 m is voor de 7885 andere panden precies goed, en één
wijk met een bijzondere plattegrond hoort daar geen uitzondering voor af te
dwingen.

*De verhouding tussen twee materialen is belangrijker dan de kleuren zelf.* De
eerste versie van deze tiny houses kreeg één warmbruine tint met een lichtgrijs
dak, en het oordeel van de gebruiker was kort: "lijkt er qua texture niet eens
op". Terecht, en de les is algemener dan deze wijk. Op de foto is het gebouw
grotendeels donker — de lange zijgevels en de tussenstukken zijn antraciet — en
alleen de kopgevel met de voordeur is licht hout, onder een donker dak. Eén tint
voor alles draait die verhouding om, en dan helpt het niet meer of die ene tint
goed gekozen is: je kijkt naar een ander gebouw.

Wat het mogelijk maakte om het wél te doen was iets dat er al lag. `muurKeuze`
weet per muurvlak met `kant` of het naar de straat kijkt of opzij — dat is
precies hetzelfde onderscheid dat de foto maakt. Een stijl mag nu een aparte
kleur voor zijn blinde zijden zetten; naar de straat blijft het de gevelkleur.
Daardoor blijft de punt boven de voordeur licht en gaan alleen de flanken het
donker in, zonder dat er iets nieuws aan geometrie bij hoefde.

En twee kleuren staan er met opzet naast de meting. Het hout staat warmer en
donkerder dan de foto zegt, want `damwand` tekent per ribbel een lichte flank en
de hemelbelichting is blauwig: op de gemeten kleur kwam er een bleke groenige
tint uit. Het dak staat donkerder, want een metaaldak met `metalness: 0.35` vangt
de lucht en werd op middengrijs bijna wit. Dat is geen vrijheid nemen met de
bron maar het omgekeerde: invoeren wat eruit moet komen. De glans is daarbij ook
per stijl instelbaar geworden, want voor de blanke puntdaken van de supermarkt
was die 0,35 juist goed — één stijl die uit de toon valt hoort de andere niet mee
te trekken.

*Een doorzichtige textuur op een dicht materiaal.* Op sommige verkeersdrempels lag
een egale zwarte band. De oorzaak is er een om te onthouden, want hij kan overal
terugkomen: een canvas dat met `clearRect` leeg wordt gemaakt is
`rgba(0,0,0,0)`, en een `MeshStandardMaterial` zonder `transparent: true`
negeert die alpha en tekent dus zwart. Dat het een egale band was en niet een
strepenpatroon komt erbovenop: een `CanvasTexture` staat standaard op
ClampToEdge, en de laatste kolom van dat doek is leeg, dus zodra een drempel
breder was dan één herhaling werd die lege kolom over de rest uitgerekt.

Dit was niet te vinden met zoeken naar zwarte materialen — die zijn er niet. Het
werd gevonden door in de draaiende wereld alle materialen langs te lopen op
lichtheid en oppervlak, wat drie kandidaten opleverde die het geen van drieën
waren, en daarna te redeneren vanuit wat de gebruiker schreef: "overgangen op de
weg". Een verkeersdrempel is precies dat.

*Meten waar het muntje op zijn kant valt.* De oeverwand rond elk waterdeel loopt
van 0,13 tot −0,60 m, en de BGT kent waterdelen die onder een kade of een steiger
door lopen: 498 van de 33.478 hoekpunten, 1,5 %. Die stukjes wand steken één
centimeter boven de tegels uit, en dat leest vanaf ooghoogte als een bruine strook
van een meter breed. Ze worden nu weggelaten.

De les zit in de toets erop. Een eerste versie toetste één hoekpunt per stukje
wand en meldde 228 fouten; met de uiteinden erbij 140; met het midden 128 — en de
overgebleven punten bleken bij navraag gewoon goed te staan. Waar een steiger aan
het water grenst is de rand van het waterdeel *dezelfde lijn* als de rand van de
steiger. Het stukje wand ligt daar precies óp de grens, en "ligt dit punt in dat
vlak?" is dan een muntje opgooien. De toets kijkt nu naar een schijfje van dertig
centimeter: alleen als dat helemaal bedekt is loopt de wand er écht onderdoor.
Dat is geen test die naar de code toe geschreven is maar een test die de goede
vraag stelt — het verschil is dat de nieuwe vraag ook zonder de code te kennen de
juiste is.

*Waar iemand terugkomt die je hebt neergeschoten.* De vraag van de gebruiker was
of het spel elders wel mensen bijzet. Het antwoord was: ja, maar op de verkeerde
plek. Levende voetgangers werden al naar een band om de speler verhuisd, maar wie
dood op straat lag telde nergens in mee en kwam na zijn respawn op een willekeurig
wegvak in de hele wereld terug. Over 10,95 km² is dat hetzelfde als niet
terugkomen. Dezelfde verhuizing gebruiken voor de respawn was één regel.

*Een zoekactie die blijft staan waar hij begon.* Het anker van de politie is de
plek waar ze je het laatst zagen. Dat is precies goed zolang je in de buurt
blijft, en precies fout als je er met vijf sterren twee kilometer vandaan rijdt.
Het anker schuift nu met 45 m/s bij tot een afstand die met de sterren meeloopt:
800 m bij één ster, 210 m bij vijf. Dat bewaart allebei de dingen die je wilt —
bij één ster schud je ze af door weg te rijden, bij vijf niet.

*Een tweede maat die geen maat is.* De goot uit het 3D BAG-model wordt op drie
plekken gebruikt: om de gevel van de kopgevel te knippen, om te bepalen of een
muurvlak een dakkapelwang is, en om een dakkapel op het dakvlak te zetten. Aan de
Vang loopt het dak tot vlak boven de grond door en geeft het model een goot van
0,51 m. Alle drie die regels sloegen daardoor om: de gevelstrook werd een halve
meter hoog, elke wand die op een halve meter begon werd een kapelwang, en de
kapel kwam op kniehoogte te staan. Het resultaat was een bakstenen driehoek van
tien meter zonder deur of raam.

Dat is het patroon om te onthouden: een afgeleide maat als "de goot" is geen
meting maar een aanname over de vórm, en zodra de vorm afwijkt klopt hij niet
meer. Een ondergrens per gebruik is dan geen smoesje maar precies de ontbrekende
regel — met één les erbij: die ondergrens moet gelijk zijn aan de maat waarmee
het doek getekend wordt (`storeyH`, 2,90 m) en niet aan een rond getal. Op 2,60 m
werd het doek van 2,90 m over 2,60 m uitgerekt en viel de onderdorpel van de
voordeur er net buiten.

Eerlijk over de afloop: de gevel is terug — gemeten staat er nu een gevelvlak van
0 tot 3,24 m — maar in beeld zie je hem niet, want het BAG-model heeft op dit
adres óók een uitbouw van 0,53 tot 3,30 m met een plat dakje die er als witte
kapelwang voor staat. Twee van de drie regels zijn aangepast en toch verandert
er niets aan dat blok, dus de oorzaak zit ergens die ik nog niet gevonden heb. De
meetmethode staat er in elk geval: de meshes rond één pand opsommen met hun
klasse en hun hoogtebereik zegt in één oogopslag wát er staat, en dat had ik
eerder moeten doen dan vier keer een kleur of een grens verschuiven en opnieuw
een foto maken.

**De ronde van 20 september (stap 62).** Ranzijn Tuin & Dier, koplampen die licht
geven, een sniper met kijker, de houding van de fietsers en een steekproef van
tien plekken. Drie lessen, alle drie over toetsen die groen stonden terwijl het
beeld iets anders liet zien.

*Een toets die dezelfde som maakt als het spel, toetst niets.* De fietsers zaten
naast hun fiets. De fiets is daarna om de rijder heen gebouwd: het zadel op de
plek waar de heup uitkomt, de trapas in het midden van de voetbeweging, het stuur
waar de handen liggen. De toets rekende die drie punten uit de gewrichtshoeken
uit, kantelde ze over de voorovergebogen stand van 0,22 rad, en meldde dat ze
precies klopten. In beeld zat de rijder veertig centimeter achter zijn zadel.

De fout zat in het teken. Een punt bóven de oorsprong draait met een positieve
hoek om de X-as naar achteren; een arm of een been hangt ónder zijn gewricht en
draait dus de andere kant op. In `js/npc.js` stond +0,22 waar −0,22 hoort, en de
toets maakte exact dezelfde fout — hij was uit dezelfde redenering geschreven als
de code. Twee keer dezelfde som uitvoeren is geen controle, hoe netjes de tweede
ook is opgeschreven.

Wat het wel vastlegt: de instantiematrices uit de scene lezen — de plek waar de
fietser werkelijk getekend wordt — en die terugrekenen naar het assenstelsel van
de fiets. Dan staan er twee onafhankelijke dingen naast elkaar: wat er getekend
wordt en welke maat het moest worden. Dezelfde regel geldt overal waar een toets
een formule uit de broncode overneemt in plaats van het resultaat te meten.

*Natuurkundig kloppen is niet hetzelfde als zien.* De koplamp hing eerst op 0,62 m
— de hoogte van een echte koplamp — en scheen zesentwintig meter vooruit. De lamp
stond aan, wees de goede kant op en reikte ver genoeg; alle vier de toetsen
stonden groen. Er was alleen geen licht te zien. Bij die stand strijkt de bundel
zo scheer over het asfalt dat de cosinus van de invalshoek er bijna alles van
opeet: op vijftien meter is dat nog een veertigste.

Dat is niet met redeneren op te lossen maar met meten aan het beeld zelf. Het
canvas in een tweede canvas tekenen en de gemiddelde lichtheid van een strookje
weg uitlezen geeft een getal: 90,2 met lamp en 83,8 zonder. Zeven procent, en
daarmee was de vraag beantwoord. Met de lamp op 1,9 m en twintig meter vooruit is
het 111 tegen 84. Die meting staat nu als toets in `tools/sniptest.mjs`, want
"brandt de lamp" is een andere vraag dan "valt er licht op de weg" — en de
gebruiker vroeg het tweede.

*Een grens die maar in één tak staat, geldt maar in één tak.* Een muurvlak dat
boven de goot begint wordt een dakkapel: witte wangen, of het kozijn van de kapel
als het naar de straat kijkt. De ronde ervoor kreeg de wangtak een bovengrens —
breder dan 3,40 m is geen kapel — maar alleen de tak voor panden met een
verdieping. De andere tak had dezelfde vorm: eerst de voorkant met een
breedtegrens, en daarna een `return` naar de wang voor al het overige. Dat "al het
overige" was ongegrensd, dus daar kon een kopgevel van vijfenvijftig meter alsnog
witte planken krijgen.

De toets vond dat ook pas na een omweg. Alle dakkapellen van de kaart zitten in
eenenzestig samengevoegde meshes; de omhullende daarvan is honderden meters breed
en zegt niets. Per driehoek meten wél — mits je de index van de geometrie
afloopt en niet de hoekpunten in volgorde, want dan meet je drie willekeurige
punten uit de hele kaart als één driehoek (55,5 m bleek zo'n meting; na het
aflopen van de index 3,4 m).

**De pandwijzer (stap 63).** Het vervolg op de ronde hierboven: een correctie
en het gereedschap dat die correctie overbodig maakt.

*Een plek is geen pand.* De Ranzijn-stijl kwam op het verkeerde gebouw terecht.
De melding was "op de Zonnedauw tegen de rondweg", en daar staan er twee van
vijfduizend vierkante meter naast elkaar; ik koos 0091100000015459 en het was
0091100000019457, honderd meter naar het oosten. Dat is geen slordigheid die je
met beter lezen oplost — uit die zin viel het niet af te leiden, en dus werd het
raden.

De oplossing is niet preciezer vragen maar een ander soort antwoord mogelijk
maken. Er zat al een toets **K** in het spel die je eigen plek op het klembord
zet; daar is **P** bij gekomen die het pand op het klembord zet waar je naar
kijkt, met het BAG-pandnummer voorop. Dat nummer is precies de sleutel in
`data/stijl/straten.json`, dus er zit geen vertaalstap meer tussen wat de
gebruiker aanwijst en wat ik aanpas.

Het zoeken gaat niet met een raycast op de meshes — die zijn per tegel
samengevoegd en weten niet bij welk pand ze horen — maar met een straal over de
plattegrond: stapjes van veertig centimeter vanaf je eigen positie de
kijkrichting op, en het eerste grondvlak dat geraakt wordt is het pand. Dat is
tegelijk robuuster dan een raycast: de hoogte doet niet mee, dus de stoep vóór
een huis levert ook dat huis op.

Het algemene patroon: als ik iets moet raden, is dat een gat in het gereedschap
en niet in de vraag. Twee keer eerder ging het net zo — de plek van een object
en de plek van een wegblokkade — en daar loste K het op.

*Een teken dat overal doorwerkt.* Op de gevel van de hal stond het woordmerk
gespiegeld: NIJZNAR. De verleiding is dan om naar de textuur te kijken. Het zat
in de normaal van het muurvlak. Voor een pand dat uit zijn grondvlak wordt
opgetrokken (2418 van de 7885 panden hebben geen 3D BAG-model) stond er
`[dz/L, 0, −dx/L]`, en die wijst naar bínnen: alle grondvlakken in de kaart
lopen dezelfde kant rond, en dat is nagemeten op elke zijde van de hal, van de
Jumbo en van een rijtjeshuis — 19, 10 en 6 van de 19, 10 en 6.

Eén verkeerd teken deed drie dingen tegelijk: de belichting rekende met de
verkeerde kant, `kant` (kijkt dit vlak naar de straat?) kreeg het omgekeerde
teken zodat de vóórgevel als achterkant werd behandeld, en de u-richting van het
doek liep achterstevoren. Alleen dat laatste viel op, en alleen op de twee
panden met tekst op de gevel. De driehoeken zelf stonden goed — hun winding komt
uit de volgorde van de hoekpunten — dus de reparatie was één min.

Wat dit leert over toetsen: dit was niet te vinden met een toets op het
eindresultaat, want "ziet de gevel er goed uit" is geen getal. Het was wél vast
te leggen op het niveau eronder. De normaal is nu een geëxporteerde functie
(`muurNormaal`) en de toets zet er een half metertje langs vanaf het midden van
elke zijde en kijkt of dat punt buiten het grondvlak valt: 1347 zijden van 214
panden, nul fout. Een tekenfout in een formule vang je met een eigenschap van
die formule, niet met een foto.

**Bloed, kogels en drie panden (stap 64).** De tweede lijst van 20 september.
Drie dingen die het onthouden waard zijn.

*Twee effecten op dezelfde plek zijn er één te veel.* De bloedspat werkte meteen
— en was op de foto een bleke vlek. De oorzaak stond er al een maand: elke
kogelinslag geeft een grijs stofwolkje, ook op een mens, en dat wolkje kwam
precies over de rode spat te liggen. Het was niet zichtbaar fout zolang er niets
anders op die plek stond.

Het patroon: een nieuw effect kan een oud effect onzichtbaar maken zonder dat er
iets kapot is. Bij een treffer op een mens komt er nu één ding, en dat is bloed.
Het stof blijft voor blik, steen en hout.

*Een plas hoort op de grond, en "de grond" is niet het maaiveld.* De plas lag
onder de tegels. Een stoep, een tuin en een grasberm liggen in deze wereld
twaalf centimeter boven de rijbaan (KERB_Y), en `grondHoogte` geeft het
terrein, niet het vlak waar je op staat. `vlakOp` doet dat wel — het levert het
BGT-vlak inclusief zijn eigen hoogte.

En daarmee kwam er iets anders boven water dat er al die tijd zat: de
voetgangers zelf staan óók op de terreinhoogte. Wie op de stoep loopt zakt er
twaalf centimeter in, en dat zie je nu je weet waar je moet kijken. Dat is niet
in deze ronde gerepareerd, want het raakt iedereen die loopt en het verdient een
eigen ronde met een eigen toets. Het staat als zodanig in README.md — een
half-afgemaakte reparatie die stilletjes doorwerkt is erger dan een bekend gat.

*Meten door de echte handler heen.* De muis moest trager gaan door de kijker.
De eerste toets rekende de gevoeligheid zelf na met de formule uit de
broncode — dezelfde fout als bij de fietsers vorige week, en net zo waardeloos.
De tweede versie stuurt een echte `mousemove` naar `document`, precies waar de
handler van js/player.js aan hangt, en meet hoeveel de kijkrichting opschuift:
0,32 rad uit de heup, 0,068 op vier keer en 0,030 op twaalf keer per honderd
tellen muis. Dan staat er een getal dat een speler ook echt krijgt.

Eén detail dat daarbij tijd kostte: die handler hangt aan `document` en niet aan
`window`, en hij doet alleen iets als de muis vergrendeld is of je sleept.
`window.dispatchEvent` bereikt een listener op `document` niet — de eerste
meting was overal nul, en dat is geen trage muis maar een toets die langs de
code heen schiet.

**De intro en de eerste stappen (stap 65).** Een filmpje bij het begin, een
wapen dat pas komt als je het nodig hebt, en uitleg op het moment zelf. Twee
lessen.

*Een filmpje is een functie van de tijd, geen lus.* De eerste opzet was een
`requestAnimationFrame`-lus die de camera elke beeld een stukje verder zette.
Dat werkt, maar er valt niets aan te toetsen: "waar staat de camera op seconde
dertien" is dan een vraag die je alleen kunt beantwoorden door dertien seconden
te wachten — en op de softwarerenderer van de proeven duurt dat drie keer zo
lang, of helemaal niet, want de eerste versie telde beeldtijden op met een
bovengrens van een tiende seconde per beeld. Bij drie beelden per seconde loopt
zo'n filmpje van twintig seconden ruim een minuut.

Nu is `beeldOp(t)` een gewone functie: tijd erin, camerastand en titel eruit. De
lus gebruikt hem met de klok (`performance.now`), de toets roept hem aan voor
t = 2, 8, 13 en 20, en het fotogereedschap zet de camera op precies die standen.
Zo staat er van elk beeld een foto die écht dat beeld is, en meet de toets de
hele cameraweg zonder dat er film langs hoeft.

Dezelfde regel als eerder bij de fietsers en de kijker, maar nu van de andere
kant: niet "meet het echte resultaat" maar "maak van het resultaat iets dat te
meten valt".

*Toestemming van de browser verloopt.* De muis vastzetten en volledig scherm
mogen alleen op vertoon van een verse klik of toetsaanslag. Het filmpje zit
precies tussen die toetsaanslag (Enter op het laadscherm) en het begin van het
spel in, en twintig seconden later is die toestemming verlopen: het spel begon
in het sleepmodus-vangnet, met de muis los. De vergrendeling gebeurt daarom vóór
het filmpje en niet erna — je kijkt dan naar een filmpje met een vastgezette
muis, en dat merk je niet, want de speler staat toch stil.

Het patroon om te onthouden: alles wat een browser alleen "na een klik" toestaat
hoort in dezelfde tel als die klik, en niet achter een `await` die er seconden
tussen zet.

**De intro, tweede ronde (stap 66).** Tien beelden langs de herkenningspunten,
muziek eronder, en geen camera meer door een dak.

*Een filmpje meet je niet met je ogen alleen.* De tweede ronde van de intro
vroeg om tien beelden langs echte plekken — de molen in IJlst, de Poiesz, de
Jumbo, de brug, de Geeuw, de waterzuivering, het Tinga-bosje — en om geen
clipping van bovenaf. Dat eerste is een kwestie van opzoeken in de kaart; het
tweede van nameten.

De toets loopt het hele filmpje af in stapjes van een kwart seconde en vraagt
zich bij elk moment af: zit de camera binnen het grondvlak van een pand dat
hóger is dan zijzelf, of binnen drie en een halve meter van een boom terwijl ze
onder de kruinhoogte hangt? Twee vragen, 262 momenten, nul treffers. Dat is
iets anders dan "het zag er goed uit op de vier foto's die ik gemaakt heb" — en
het blijft werken als de kaart verandert.

Wat dat mogelijk maakt is dezelfde vorm als bij de eerste ronde: de camerastand
is een functie van de tijd, geen toestand in een lus. Daardoor kan een toets
langs het hele filmpje lopen in een paar milliseconden.

*Een plek opzoeken is beter dan een plek onthouden.* Elk van de tien beelden
wordt afgeleid uit de kaart: een pand op zijn type, de molen uit `KAART.molens`,
een straat op zijn naam, de waterzuivering als het midden van de vijf
`rwzi`-panden, en het bos, de brug en het water als het grootste vlak van die
klasse in de buurt van waar we willen kijken.

Twee beelden waren daarmee nog niet goed: de Jumbo stond achter een rij bomen en
de waterzuivering achter een bos. Allebei opgelost met wat er al in de data zat
en niet met een handmatig standpunt — `front` van het pand wijst waar de ingang
en het parkeerterrein liggen, en het terrein van de zuivering heeft een open
noordkant. De regel die daarachter zit: als een beeld niet klopt, kijk eerst of
de kaart het antwoord al bevat.

**Missiemuziek, een claxon en de camera terug (stap 67).** De derde lijst van
20 september: geen kogels meer in je eigen auto, uitstappen in de eerste
persoon, de sterren eenmalig weg na de vrachtwagen, muziek onder de missie, een
balk over de winkels, een ander beeld in de intro, Mark die zelf begint, en het
verkeer dat weer te horen is.

*Wie schiet, schiet ergens vandaan.* De kogel begon bij je hoofd, en zat je in
een auto dan stond je eigen dak als eerste in de baan. Het is verleidelijk om
dat op te lossen door de kogel verderop te laten beginnen — een halve meter voor
de neus, zeg — maar dan klopt het schot niet meer met wat je ziet, en schiet je
ineens dóór een muur waar je tegenaan staat. De oplossing die wél klopt is een
regel over doelen en niet over meetkunde: het voertuig waar je in zit staat niet
in de lijst met dingen die geraakt kunnen worden. Eén regel, en de kogel vliegt
gewoon naar buiten.

*Een proef die alleen het verschil meet.* De eerste versie van de toets schoot
van binnenuit op de auto (geen schade — goed) en daarna van zeven meter afstand
(ook geen schade — dus wat bewees het eigenlijk?). Er kan van alles tussen
staan: Mark, een voetganger, een lantaarnpaal. De tweede versie vuurt twéé keer
exact dezelfde acht kogels vanaf exact hetzelfde punt, en verandert er maar één
ding tussenin: zit de speler in die auto of niet. Dan meet je het verschil en
niets anders. Dat is dezelfde les als bij de fietsende voetgangers: een toets
die iets anders doet dan de code, of iets anders meet dan de verandering, kan
groen staan zonder ergens over te gaan.

*Muziek die niet elke keer hetzelfde is.* Het aangeleverde nummer duurt drie
kwartier. Bij elke missie bij nul beginnen zou betekenen dat je het spel leert
kennen aan de eerste twintig seconden ervan. Het spel springt daarom naar een
willekeurige plek, met één voorwaarde: minstens twee minuten van de vorige
vandaan. Dat springen kost niets aan geheugen — het bestand loopt door een
`<audio>`-element — maar het stelt wel een eis aan de server: hij moet
Range-verzoeken kennen. `python3 -m http.server` kan dat niet, `tools/server.mjs`
wel, en dat staat nu in de kop van de toets zodat niemand zich erop verkijkt.

En muziek die begint moet ook kúnnen ophouden. De fade-out is twee en een halve
seconde, en het element gaat pas ná die tijd op pauze; zet je het meteen stil,
dan hak je je eigen fade eraf. Datzelfde gold voor de proef: de fade hangt aan
de klok van de AudioContext, dus een toets die het verhaal in stapjes van een
tiende seconde vooruitspoelt meet een fade die in werkelijkheid nog maar net
begonnen is. De toets loopt nu mee met de echte klok.

*Een andere beweging leest anders dan een ander onderwerp.* Voor de intro vroeg
de gebruiker om een ander beeld dan de brug én een andere camerahoek. Alle negen
overige beelden zijn zwenken om een punt heen — een koorde op een cirkel. Het
nieuwe beeld is daarom geen cirkel maar een rechte lijn: de camera vliegt over
de rondweg ónder het Viaduct Tinga er recht op af, en zakt daarbij van elf naar
zeven meter.

Dat het van díe kant moest bleek uit het nakijken van de foto. De eerste opzet
vloog langs het dek zelf, en daar is een viaduct geen vorm: je ziet asfalt dat
wat oploopt, met bomen ervoor. Dwars erop staat de boog in beeld. Welke weg dat
is wordt opgezocht en niet ingetypt: het langste stuk rijbaan binnen zeventig
meter van het hoogste punt van de as dat dwárs op het dek ligt.

Ook dit is te meten en niet alleen te bekijken: de toets bemonstert het beeld,
legt een lijn tussen het begin- en eindpunt en kijkt hoe ver de camera daar
tussenuit wijkt (nul), of de afstand tot het viaduct terugloopt (150 → 52 m) en
of hij boven het dek blijft.

*Een spel dat op de speler wacht, wacht soms eeuwig.* Het verhaal begon met
Erik tegenover zijn broer en de stille aanname dat je op E zou drukken. Wie dat
niet deed liep de wijk in en kwam het verhaal nooit tegen. De oplossing is niet
een grotere hint maar een andere volgorde: Mark begint zelf te praten,
anderhalve seconde nadat het filmpje voorbij is. Daarna loopt alles zoals het
liep. Dezelfde gedachte als bij de uitleg-blokjes uit stap 65: leg iets uit op
het moment dat het aan de orde is, in plaats van te hopen dat iemand het zelf
bedenkt.

*Stilte is een instelling die wegzakt.* "Ik hoor de vogels niet meer" bleek geen
kapotte laag maar een optelsom: de omgevingslagen stonden zo zacht dat ze onder
de voetstappen verdwenen. Erbij gekomen is wat er op straat hoort: een auto die
langs je heen rijdt, herkend aan het moment dat de afstand ophoudt met kleiner
worden, en een claxon van de bestuurder voor wie je in de weg staat — maar pas
na anderhalve tot vier seconden, en niet door iedereen. "Niet gelijk
claxonneren" was de vraag, en dat is precies het verschil tussen een grap en een
alarmbel.

**De groene BX (stap 68).** Missie 6, en meteen een ander soort missie: hij
begint niet vanzelf maar staat als **M** op de kaart.

*Een missie die wacht tot jij begint.* De eerste vijf missies rijgen zichzelf
aan elkaar — de een eindigt en de volgende start. Dat werkt zolang het verhaal
de speler aan de hand meeneemt, maar het maakt van de wijk een gang. De BX
begint anders: na Johan komt er één balk in beeld die vertelt dát missies
voortaan bij een M beginnen, en daarna is het aan jou. Dezelfde gedachte als bij
Mark die zelf begint te praten (stap 67): vertel het op het moment dat het aan
de orde is, en laat de speler daarna zelf kiezen.

*Een auto die er al stond.* De eerste opzet zette de BX als extra auto neer op
het parkeerterrein van VV Sneek, in het dichtstbijzijnde vak uit de kaartdata.
In de proef bleek dat je met E níét in de BX stapte maar in de auto ernaast — en
toen pas viel op wat er echt aan de hand was: **elk vak in de wijk is bezet**.
De geparkeerde auto's komen uit dezelfde `parkeerplekken` als de vakken zelf, dus
"zoek een leeg vak" levert per definitie niets op; de zoektocht liep er
vierhonderd meter naast op zoek naar een vak dat niet bestond.

De oplossing komt uit de wereld zelf: de auto die het dichtst bij het hoofdveld
staat *wordt* de BX. Ander model, groene lak, en in plaats van de instantie het
losse model met wielen. Bij het afleveren gebeurt het omgekeerde: de auto die op
het afleverkvak in IJlst stond is weggereden, zodat er plek is. Beide keren geen
nieuwe auto die uit de lucht komt vallen, en geen dubbele auto's op één vak.

*Een model uit maten, niet uit een tekening.* De BX is geen apart bestand maar
dezelfde parametrische opbouw als de andere auto's, met de maten van het echte
ding: 4,23 × 1,69 m, wielbasis 2,65, dak op 1,37 — dertig centimeter lager dan
de rest — plus een steilere voorruit en een motorkap die naar voren afloopt.
Alles wat daarvan wordt afgeleid (stijlen, ruiten, bumpers, lampen, het
interieur) schuift vanzelf mee. Eén `kind` erbij in js/carmodel.js, en de toets
leest de maten terug uit `autoMaat('bx')`.

*Prijzen horen bij de plek, niet bij de missie.* Het overspuiten kost normaal
honderd euro per ster. Voor de BX is het een vast bedrag — precies het geld dat
Mark meegeeft. Dat is geen speciaal geval in de wasbox geworden maar een vraag
die de wasbox aan het verhaal stelt (`verhaal.spuitPrijs(auto)`): het verhaal
weet welke auto van hem is, de wasbox weet hoe overspuiten werkt, en geen van
beide hoeft iets van de ander te weten.

*Eén ster, gegarandeerd.* Verdenking werkt in dit spel met getuigen en kansen:
een misdaad die niemand ziet wordt vaak niet gemeld. Voor het stelen van de BX
hoort er gewoon een ster te staan, altijd. Dat is een aparte ingang in
js/politie.js (`zetSter`) geworden en geen uitzondering in de kansberekening —
zo blijft het model voor alle andere misdaden intact.

**De bom (stap 69).** Missie 7, en vier dingen die het spel nog niet kon: een
missie die binnen begint, een aanwijzing in een ruimte zonder kaart, een
ontploffing die niet aan een auto hangt, en een bondgenoot die meeschiet.

*Een M die binnen staat.* De vlag wijst het pand aan de Wieken 29 aan, maar het
gesprek begint pas achter de voordeur: de binnenruimte ligt ruim buiten het
kaartgebied, dus de vlag kan niet op Mark zelf staan. De missie kijkt daarom
niet naar de afstand tot Mark maar naar `woning.binnen(x, z)` — ben je in de
kamer, dan zet hij Mark op de bank en begint hij te praten. Dezelfde truc als
bij de winkel: de wereldcoördinaten van een binnenruimte zijn gewoon
coördinaten, ze liggen alleen een paar kilometer verderop.

*"Bij de schappen" is geen aanwijzing.* De Poiesz in Duinterpen is binnen een
hal van veertig bij dertig meter met zeventien schappenrijen. Een vlag op de
kaart kan er niet staan (zie hierboven), dus staat de aanwijzing in de ruimte
zelf: een gele ruit die boven een lichtvlek dobbert, op de plek die het spel al
kende — het bierschap. Een oppakpunt zoals elk spel dat heeft, en het scheelt
een speler die tien minuten door een supermarkt loopt te zoeken.

*Een ontploffing zonder auto eronder.* De vuurbal die er al was hangt aan een
voertuig dat uitbrandt. Deze staat los in `js/bom.js`: een bol die in negen
tiende seconde tot 6,5 m openklapt, veertien vonken met zwaartekracht, en negen
rookbollen die in 3,4 s tot twaalf meter stijgen en tot acht meter uitwaaieren.
Die maten zijn niet willekeurig — Mark staat aan de overkant van het
parkeerterrein, en van daar moet de pluim bóven de gevel uitkomen. Getekend,
niet ingeladen, zoals alles in dit spel.

*Ze komen aanrijden, en stappen pas uit als ze staan.* "Ineens komen er drie
auto's aan met 6 man" en "pas daarna stappen de personen uit" is een volgorde,
en die volgorde is het halve effect. In de eerste opzet stonden de auto's er
opeens; nu zetten ze zeventig meter verderop in, rijden achter elkaar aan en
remmen op de laatste twintig meter piepend af. De koers komt uit de wegas onder
hun stopplek (js/navigatie.js) en niet uit een richting die in de missie
bedacht wordt — anders rijden ze dwars over het gras of door een gevel. Pas als
ze alle drie stilstaan én de balk van Mark leeg is, stappen de mannen uit: twee
per auto, aan de kant waar de speler staat. De bewaking uit `js/bewaking.js`
(dezelfde als bij de vrachtwagen) doet daarna het vechten. Hergebruik van wat er
al stond: een nieuwe vijandklasse zou hetzelfde gedrag nog eens opschrijven.

*Remmen zoals een auto remt.* De eerste opzet remde op een vaste afstand naar
een ondergrens en legde de laatste meters stapvoets af; dat zag er traag uit.
Nu telt de natuurkunde: de snelheid die nog past om precies op de plek stil te
staan is v = √(2·a·d). Zolang die boven de rijsnelheid ligt rijdt hij vol gas,
daaronder remt hij. Met 20 m/s en 7,5 m/s² is dat zevenentwintig meter uitloop,
en staat hij zonder gekruip stil.

*Mark rijdt mee in plaats van dat hij instapt.* Na het vuurgevecht bleef hij op
straat staan terwijl jij wegreed. Hem naar de auto laten lopen en laten
instappen is een animatie die niets toevoegt en die stukloopt zodra jij
wegrijdt; hij is nu gewoon uit beeld zodra jij achter het stuur zit, en staat
weer naast je als je uitstapt. Dezelfde gedachte als Mark die na de BX
verdwijnt zodra je wegkijkt: laat het spel niet iets naspelen wat de speler
toch niet ziet.

*Piepende banden zijn een los geluid geworden.* Er wás al bandengier, maar dat
is één doorlopende bron die aan jouw auto hangt en elk beeld op nul wordt gezet
zodra je te voet bent (js/main.js). Deze auto's remmen terwijl jij ernaast
staat, dus daar hoort een losse klap bij: `piependeBanden` in js/audio.js, ruis
door een band die van 1,5 kHz naar 700 Hz zakt met een zaagtand die meeglijdt.

*Een wapen in de hand van wie er een hoort te hebben.* Mark stond met lege
handen terug te schieten. De bewaking en de politie kregen hun wapen bij het
bouwen mee; dat is nu een methode (`geefWapen` in js/persoon.js) die ook later
nog kan, met een derde vorm erbij: een handpistool. Mark trekt het als het
vuurgevecht begint en bergt het op als het voorbij is.

*En wie neergaat laat het liggen.* Je kon van een neergelegde schutter niets
oppakken. Nu valt zijn pistool op straat, met zes tot dertien kogels erin — een
vierde soort buit in js/buit.js, naast geld en munitie. Heb je zelf nog geen
pistool, dan krijg je het in handen; heb je er al een, dan gaan alleen de kogels
in je voorraad. Twee pistolen dragen kan dit spel niet, en dat hoeft ook niet.

*Het wapenslot van missie 1.* Wie met shift+7 midden in het verhaal springt,
liep rond zonder wapen en kreeg het met H ook niet tevoorschijn: het slot dat de
intro dichtzet gaat pas open bij het gezelschap aan de Molenkrite. Een missie
los starten opent het nu, behalve als je missie 1 zelf kiest.

*Een bondgenoot die niet kan sneuvelen.* Mark schiet mee — elke 0,7 à 1,3
seconde op de dichtstbijzijnde, ongeveer één op de zes raak. Genoeg om te zien
dat hij meedoet, te weinig om het vuurgevecht voor je te winnen. Hij heeft geen
levensbalk: een verhaal dat op hem verdergaat kan niet afhangen van een verdwaalde
kogel.

*De politie kwijtraken op een plek in plaats van na een tijd.* Sterren zakken
normaal met de tijd. Hier niet: zolang je buiten het bos bent blijven het er
twee, en zodra je in het bosvlak naast de waterzuivering komt — rijdend of
stilstaand — zijn ze weg. Dat vlak komt uit de kaartdata (`bos` bij de poort van
de rwzi), niet uit een met de hand getikte cirkel.

*De radio gaat voor.* Wie tijdens een missie zelf aan de radio draait, wil de
radio horen. `radioVoor` in js/audio.js onthoudt die keuze: de missiemuziek
loopt door maar staat op nul, zodat hij zonder sprong terugkomt zodra je
uitstapt — en uitstappen wist de keuze, want dan ben je van de radio af. Het
wissen staat bewust vóór alle afhaakpunten in `muziek()`: staan er geen mp3's in
`audio/radio/`, dan bleef de vlag anders hangen en zweeg de missiemuziek de rest
van de missie.

*Iemand laten verdwijnen zonder dat je het ziet.* Mark vertrekt na de BX met de
auto. Hem ter plekke laten oplossen ziet er slecht uit, en hem laten weglopen
kost een route. Het compromis: hij blijft staan zolang hij in beeld is, en is
weg zodra je wegkijkt (buiten een hoek van zeventig graden) of verder dan
zeventig meter bent. Hetzelfde principe als bij het opruimen van verkeer dat je
niet ziet.

*En de bootmissie staat uit.* Niet weggegooid maar op een schakelaar
(`VAART_AAN` in js/vaart.js): de boten, de politiesloep en het vaargebied
blijven, alleen belt Sander niet meer. Een missie die later terugkomt hoort niet
uit de code gesloopt te worden.

*Een missie los kunnen starten.* Om deze missie te bekijken moest je eerst zes
missies uitspelen. Dat is nu **shift + 1 … 7** (of `index.html?missie=bom`), en
het verhaal ruimt bij zo'n sprong zelf op wat er van de vorige missie nog stond.
Testgereedschap hoort in het spel zelf te zitten en niet alleen in de
proefbestanden: een controle die door een browser wordt afgespeeld ziet iets
anders dan iemand die het zelf naspeelt, en juist dat naspelen moest eenvoudig
worden.

*Wat de foto's aan het licht brachten.* Twee dingen die geen enkele toets zou
hebben gevonden. De vuurbal was op de opname telkens verdwenen — een
softwarerenderer doet seconden over één beeld, dus een effect van drieënhalve
seconde is voorbij voordat het beeld staat; het fototool zet het verhaal nu stil
en stapt er zelf doorheen. En bij de schappen stond "E — flesje bier kopen" in
beeld terwijl E daar de bom plant: elke binnenruimte maakte het hintbalkje leeg
zodra het verhaal "bezet" meldde, en omdat de binnenruimtes ná het verhaal
worden bijgewerkt wiste dat ook de regel van het verhaal zelf. Ze halen nu
alleen hun eigen balkje weg — dat gold net zo goed voor "E — praten" bij Mark.

`npm run bomtest` houdt de hele keten vast (achtenvijftig controles, van de
bootmissie die uitstaat tot de € 300 bij Molenkrite 15), `npm run bomshots`
maakt de foto's.

**De deal bij de molen (stap 70).** Missie 8, en de eerste missie die zich
grotendeels op het water afspeelt — met een kijker in plaats van een vuistvuurwapen.

*Een plek die gezocht wordt, geen coördinaat die ingetikt wordt.* De missie
vraagt om "op ruime afstand bij de Houtmolen, in het water". Dat is geen
coördinaat maar een verzameling eisen: open vaarwater, ruimte om in te
dobberen, een oever ertussen, en vrij zicht op de kade — anders kijk je door
een kijker tegen een loods aan. Rond houtzaagmolen De Rat wordt daarom een ring
van kandidaten afgelopen (46 tot 78 meter, 64 richtingen), elke kandidaat
getoetst met `vaarbaar` en `zichtVrij`, en de beste is die het dichtst bij
zestig meter ligt. De kade voor de ontmoeting volgt uit dezelfde lijn: vanaf het
water naar de molen lopen tot het land begint, en dan tweeënhalve meter verder.
Verplaatst de kaart, dan verplaatst de missie mee.

*Wel kijken, niet schieten.* De scène vraagt om vijftien seconden meekijken
zonder in te grijpen. Het wapen weghalen kan niet — je moet er juist doorheen
kijken — dus is er een tweede slot bij gekomen: `vuurSlot` in js/player.js.
Richten, zoomen en de scope werken gewoon; `magSchieten()` geeft false. Eén
regel in de speler, en de missie hoeft niets van het wapen te weten.

*Drie politieboten zonder ster.* De waterpolitie bestond al, maar kwam alleen
opdagen bij verdenking en telde daarbij als "je hebt iets misdaan". Hier is de
achtervolging de missie zelf. `initPolitieboot` heeft daarom een haakje
gekregen (`jaagtOok`) waarmee het verhaal dezelfde boot drie keer inzet, en de
treffers lopen via het verhaal in plaats van via js/main.js — want daar zou een
agent aan boord meteen sterren opleveren.

*Een schot van vijftig meter.* Elk schot klonk even hard, want er werd tot nu
toe alleen vlakbij geschoten. Bij deze deal kijk je van een afstand mee, en dan
hoort het geknal ook van die afstand te komen: `geluid.schot(afstand)` schaalt
de knal, de echo's en de naijl, en boven de tachtig meter blijft er een dof
tikje over.

*De mensen op de kade.* De Veteraan heeft een baard (een blokje aan het hoofd —
Persoon kent geen gezichtshaar en dat hoeft ook niet voor één man), een
olijfgroen uniform met pet, en een dik hondje: dezelfde vorm als de hondjes aan
de lijn in de wijk, anderhalf keer zo breed. Ze blijven staan waar ze staan als
het schieten begint. Dat is geen luiheid maar een keuze: wie op vijftig meter
dekking zoekt is door een kijker niet meer te vinden, en dan wordt de scène een
zoekplaatje in plaats van een schot.

*Wat de proefsessie er nog uit haalde.* Vijf dingen, en drie ervan zaten niet in
de missie maar in het spel eronder. De sniper stond half in het vizier zodra je
in een boot of een auto zat: de scope verbergt het wapen, maar die twee takken
in js/main.js zetten de zichtbaarheid elk beeld opnieuw — er is nu één getter
(`player.inScope`) die alle drie de plekken gebruiken. De sirene kon maar door
één ding tegelijk geclaimd worden en de volgorde in de hoofdlus bepaalde wie je
hoorde; nu wint de dichtstbijzijnde claim. En de missiemuziek begon steeds op
dezelfde plek: het springen naar een willekeurig stuk werd één keer geprobeerd
en lukte dat niet — de lengte nog onbekend, of het bestand nog niet te
doorzoeken — dan begon hij stil bij nul. De gewenste plek blijft nu staan tot
hij er ook echt staat, en de proef toetst dat hij daar speelt en niet alleen
dat hij het wilde.

`npm run dealtest` loopt de hele keten na, van het telefoontje tot de € 500:
vijfenvijftig controles.

**De wijk reageert (stap 71).** Vijf punten die niet in één missie zitten maar
eronder (verzoek 22 sep 2026), en bij elk was de winst dat er al iets bestond
dat alleen niet werd aangeroepen.

*Paniek hoort bij de knal, niet bij de auto.* De schrikgolf (`paniek`) zat sinds
stap 40 aan het ontploffen van een auto vast. De bom in de Poiesz is de grootste
knal van het spel en liet iedereen doorlopen — niet omdat het gedrag ontbrak
maar omdat het verhaal er niet bij kon. Eén haakje in de context van
`js/verhaal.js` erbij, en de bom (zeventig meter) en de aanrijders met piepende
banden (tweeënveertig) roepen hetzelfde aan als een brandende auto.

*Herstelpunten zonder een tweede toestand.* De verleiding is een opslagpunt: de
hele missie wegschrijven en terugzetten. Dat is een tweede weergave van de
missie die je bij elke wijziging mee moet onderhouden. Hier staat er alleen
`{missie, fase}` in, en het opnieuw beginnen roept dezelfde opbouwfuncties aan
die die etappe de eerste keer neerzetten (`hervatBom`, `hervatSniper`). Een
etappe die verandert, verandert daarmee vanzelf mee; wat er niet in staat —
waar precies je stond, hoeveel kogels je nog had — was ook niet het punt.

*Een verbod dat uit de missie komt.* Wie De Veteraan neerschiet, schiet de man
neer die hij moet beschermen. De toets zit in js/deal.js (`raakVeteraan`, die
ook het hondje meeneemt) en niet in het wapen: de missie weet wie er
onschendbaar is, de speler hoeft dat niet te weten.

*Voorrang is twee curves, geen ruimere blik.* Eerst is geprobeerd de voetganger
mee te nemen in dezelfde vooruitblik met een grotere `kijk`-afstand. Dat leek te
werken en deed niets: de remcurve deelde nog steeds door de elf meter van het
gewone remmen, dus een voetganger op dertien meter gold als "vrij zicht". De
proef zag het (27,9 → 25,6 m/s waar het 0,6 keer had moeten zijn) en de tweede
ronde scheidde de twee: `vrij` voor auto's en palen, `vrijMens` voor wie
oversteekt, elk met een eigen curve, en het strengste wint. Andersom kijken de
voetgangers ook voor ze de stoep af stappen (`autoDichtbij`, haakje
`magOversteken` in js/npc.js) — wie iets ziet aankomen wacht een paar tellen en
probeert het opnieuw.

*Ruimte in het geluid.* Een galmtak naast de droge (drie vertragingen van 31,
57 en 89 ms met terugkoppeling, een lowpass erover), binnen ver open en buiten
op een vleugje; het verkeersgeruis dat binnen doffer wordt gefilterd; een
waterlaag die meeloopt met hoeveel vaarwater er om je heen ligt (acht
richtingen, drie afstanden, twee keer per seconde bemonsterd in `waterNabij`);
en het kraken van een molen als je eronder staat.

*Wat de proef leerde over de proef.* Twee controles faalden op de meting en niet
op het spel. De auto die moest afremmen was de snelste van de wijk — met honderd
over de N7 is hij de voetganger in een halve seconde voorbij, en dan meet je het
optrekken erna; nu wordt de rustigste rijdende auto genomen en de laagste
snelheid onderweg. En de galm schuift met een tijdconstante van bijna een
seconde naar zijn stand, terwijl de klok van de audio in deze kale browser zo'n
drie keer langzamer loopt dan de echte: twaalf tellen van 60 ms was te kort en
mat het onderweg zijn. Beide keren was het spel goed en de vraag verkeerd
gesteld.

`npm run belevingtest`: achttien controles.

**Een eigen stek (stap 72).** Missie 9, een dag na de notitie hieronder gebouwd
(verzoek 23 sep 2026). De kortste missie tot nu toe, en de eerste waarin je iets
kiest in plaats van iets doet.

*Drie adressen die de bouwer aankan.* De eerste keuze ging op grondvlak: de drie
grootste woningen van Tinga volgens de kaart. Dat bleek de verkeerde maat. De
kamer die js/interieur.js bouwt is niet het grondvlak maar de eerste band van de
plattegrond (`banden()`) in de volle diepte, en bij een brede woning met een
inspringende hoek is dat een stuk minder. Spinnekop 127 heeft 132 m² grondvlak en
werd binnen een kamer van 4,8 bij 16,3 — nauwelijks meer dan de Wieken 29. De
tweede ronde toetste daarom wat de bouwer er écht van maakt: een scriptje met
dezelfde `plattegrond()` en `banden()` over alle panden binnen zevenhonderd meter
van het kruispunt, met per pand de kamermaat én de vraag of de keuken breed
genoeg is voor een keukenblok. Wat overbleef: Zeskanter 16 (8,9 × 20,6),
Molenkrite 130c (18,1 × 6,8, een bungalow zonder aanbouw) en Koningsspil 20
(5,6 × 21,6). Alle drie fors groter dan de 5,4 × 14,1 van de Wieken 29.

*De koelkast leerde waar hij moest staan.* Eerst stond hij tegen de wand
tegenover het keukenblok. Dat paste in twee van de drie woningen en in de derde
niet — een aanbouw van nog geen twee meter breed heeft geen overkant. Nu staat
hij aan het begin van de keukenrij en begint de kastenrij erachter, zoals in elke
Nederlandse keuken. Eén maat minder om over na te denken, en hij past overal.

*Wat er nieuw in de woning staat.* Een eettafel met vier stoelen waar je aan kunt
zitten (dezelfde `player.zit` als de bank, met een eigen plek om weer op te
staan), de koelkast met bier — je eigen bier, dus zonder afrekenen maar met
hetzelfde leven erbij als bij de Poiesz — en een tv die aanstaat. Het beeld is
een eigen doek dat langzaam doorschuift (geen plaatje in de repo) en het geluid
is Radio Spannenburg, dezelfde zender als in de groene BX: js/main.js zet de
autoradio ook aan als je in een van de drie woningen staat, en de galmtak van
stap 71 maakt er vanzelf een kamer van. De katten waren er al.

*Kiezen zonder een tweede toestand.* De drie vlaggen op de kaart lopen via
`hud.zetWinkels` — hetzelfde mechanisme als de winkeltjes, met een blauw huisje
in plaats van een speldje. Het verhaal levert de lijst (`huisMarkeringen`) en
js/main.js zet hem alleen opnieuw als hij verandert. Wat je gekocht hebt staat
als één adres in de opslag; daarna is dat de enige vlag die overblijft. Heb je
het geld niet, dan belt Mark en blijft de missie staan waar hij staat: dat is
geen mislukking maar een open eind, en het is de eerste missie in het spel die
dat kan.

*Mark loopt niet mee.* Hij staat er eerder dan jij. Kom je binnen vijfenvijftig
meter van een van de drie, dan staat hij op het tegelpad; bij veertien meter zegt
hij wat hij ervan vindt. Een tweede routezoeker voor een man die alleen
commentaar levert zou meer code zijn dan de hele missie.

*En toen de inrichting.* De eerste foto's lieten zien wat de proef niet kon
zien: een kamer van honderdtachtig vierkante meter met één bank, één tv en één
tafel erin leest als een showroom (melding 23 sep 2026). Erbij gekomen zijn een
schilderij (een Fries landschap met een molen, getekend op een doek van 128 bij
96), een salontafel op een vloerkleed, een dressoir met drie fotolijstjes, een
schemerlamp en een plantje, een grote kamerplant in de hoek, een fauteuil in een
brede kamer, en spullen op het aanrecht: waterkoker, snijplank, fruitschaal,
afdruiprek en een theedoek. Alleen de grote stukken hebben een botsdoos; de
dingen op het blad en op het dressoir niet — daar loop je niet tegenaan, daar
kijk je naar.

Twee maten moesten mee veranderen. De bank stond op een vaste 2,10 m, en dat was
in een diepe kamer te klein en in de ondiepe bungalow aan de Molenkrite te lang
(hij stak de gang in). Nu wordt eerst het vrije stuk wand bepaald en vult de bank
dat tot hoogstens 2,55. En het dressoir paste in diezelfde bungalow langs geen
enkele wand naast de tv, dus daar staat hij tegen de achterwand, een kwartslag
gedraaid. Allebei kwamen ze uit de proef en niet uit het oog.

*En daarna de kamer zelf.* De tweede ronde foto's liet zien dat een bank van
2,55 in een kamer van negen meter nog steeds een bankje is, dat de tv van acht
meter afstand een postzegel was, en dat gebroken witte wanden een wachtkamer
maken (melding 23 sep 2026). Drie dingen kwamen daaruit:

*De zithoek is één groep geworden.* Een hoekbank (lange poot plus chaise longue,
ruim vijf vierkante meter zitvlak tegen 1,9 eerst), de tv op drie meter twintig
recht ervoor, de salontafel op het kleed ertussen, een staande lamp aan het
uiteinde en een poef. Waar die groep staat hangt van de vorm van de kamer af:
normaal tegen de zijwand, maar in de bungalow aan de Molenkrite — achttien bij
zeven — is die wand maar 1,8 m lang en gaat de hele groep tegen de achterwand.
Om dat niet twee keer uit te hoeven schrijven staat alles in maten *langs* de
bank en *vanaf* de wand, en rekent één functie (`dB`) dat om naar de kamer. Dat
is dezelfde truc als bij de plattegrond: eerst een assenstelsel kiezen waarin het
probleem simpel is.

*De wanden hebben kleur gekregen.* Vijf schema's, één per woning: een warme
wandkleur met een accentkleur voor de wand achter de bank, over een fijn
behangdessin van 96 bij 96. De accentwand is geen aparte muur maar een paneel
van acht millimeter ervoor — de wanden komen uit de plattegrond en die wil je
niet per stuk anders gaan kleuren.

*En er staat meer in.* Boekenkast met vier planken boeken (de ruggen zijn een
doek van 128 bij 64), gordijnen naast de pui, een klok, een kattenmand, een
pedaalemmer en een plantje op de vensterbank in de keuken.

Wat de proef eruit haalde: in de ondiepe bungalow was het zitvlak niet
verdubbeld (de bank stond tegen de verkeerde wand), en in de smalle woning aan de
Koningsspil stond de tv op 1,9 m. Dat laatste kwam door een verkeerde aanname —
de gang zou de kamer smaller maken — terwijl de gang ophoudt vóór de bank begint.
Allebei gemeten, niet gezien.

`npm run huistest` (tweeënzestig controles) en `npm run huisshots`.

*Naar buiten kijken, en naar buiten kunnen.* Zes punten uit de derde ronde
melding (23 sep 2026), waarvan er één een echte fout was.

*De verkeerde deur.* Stap je uit een van de drie aangeboden woningen, dan kwam je
voor de Molenkrite 15 te staan — het eerste huis in de lijst, niet het huis waar
je in zat. De uitgang zelf klopte: een proefje in de browser liet zien dat de
teleportatie precies het juiste adres teruggaf. De fout zat een regel eerder. De
`toets()` van elke binnenruimte begint met "zit je? sta dan op", en die tak stond
vóór de vraag of je wel in *dit* huis bent. Molenkrite 15 wordt als eerste
gevraagd, ving het opstaan af, en zette je op zijn eigen stoep. Eén regel erbij
(`if (!binnen(...)) return false`) en elk huis handelt weer zijn eigen tafel af.
Dat is de vaste les van dit soort bugs: het onderdeel dat de verkeerde uitkomst
oplevert is meestal niet het onderdeel dat de fout maakt.

*Ramen die je van binnen ziet.* De zijwanden waren blinde muren. Nu krijgen ze
gaten van 1,35 breed op 1,45 tot 2,25 hoog met halfdoorzichtig glas erin. Waar ze
níet mogen komen is het lastige deel: niet in het stuk wand waar de hoekbank
staat, niet achter het keukenblok, en niet in de eerste anderhalve meter bij de
voorgevel. Daarvoor moesten de bankmaten omhoog in het bestand, boven de lus die
de wanden zet — de indeling van de kamer bepaalt nu waar de ramen kunnen, in
plaats van andersom.

*Een tuin waar je in kunt.* Achter elke woning ligt nu 6,6 m tuin, 1,1 m breder
dan het huis: een terras van tegels tegen de achtergevel, gras erachter, en een
schutting van 1,78 m met een botsdoos eromheen. Er staat een tafel met twee
stoelen en een parasol, een schuurtje en twee potten. De tuindeur was de eerste
poging een gesloten deur: een drempel van vijf centimeter leek onschuldig, maar
een gat in een wand wordt hier een botsdoos over de volle wanddikte, en met de
straal van de speler erbij duwde die je 46 cm terug — precies MUUR/2 plus 0,34.
De drempel eruit en het gat loopt weer tot de vloer. Waar de deur zit hangt van
de vorm af: meestal in de achtergevel, maar heeft de woning een aanbouw die de
achterkant in beslag neemt, dan zoekt een voorscan eerst een zijwand met genoeg
ruimte. `binnen()` is uitgebreid tot over de tuin, zodat je niet halverwege het
gras uit de binnenruimte valt. De eerste foto liet zien wat de proef niet kan
zien: het terras leende de zwart-witte blokjes van de gang en werd een dambord
op het gras, en het gras zelf was één vlakke groene kleur. Er zijn nu twee eigen
doeken bij: betontegels van 45 cm met korrel en voeg, en vlekkerig gras met
sprietjes.

*Kiezen vóórdat je gaat lopen.* Mark noemt nu de drie adressen mét bedrag in de
tekstbox en je drukt 1, 2 of 3; de navigatie gaat naar dat adres. Dat kostte
geen nieuwe toestand: de toetsen lezen dezelfde lijst als de kaartvlaggen.

*Mark verdwijnt van de stoep.* Hij stond bij de Wieken 29 te wachten terwijl je
al twee straten verder was. Nu staat hij bij het dichtstbijzijnde van de drie
huizen als je binnen vijfenvijftig meter bent, en nergens als je onderweg bent —
dat leest als meelopen, zonder dat er een tweede routezoeker voor nodig is.

*Geen keuze is ook een einde.* De missie bleef openstaan als je niets kocht.
Nu onthoudt het verhaal welke van de drie je binnen bent geweest; zijn dat er
drie, dan zegt Mark dat je er rustig over na kunt denken en is de missie
voltooid. Het aanbod blijft los van de missie bestaan: de vlaggen blijven staan
en aan tafel kun je alsnog kopen. Daarvoor moesten de koopregels loskomen van de
missiefase — ze kijken nu naar `huisAanbod` in plaats van naar waar missie 9
staat.

*Wat de proef zelf kapot maakte.* Twee lussen in `tools/huistest.mjs` telden door
op `dialoogTekst.textContent`, en dat element houdt de laatste zin vast nadat de
balk allang weg is. Ze drukten daarna nog tot dertig keer op E. Eén keer kocht
dat het huis dat de proef net wilde bekijken; de andere keer liet het de speler
aan tafel *zitten*, en `player.zit` zet de koopregel uit — dus leek het alsof de
koopregel stuk was. Beide lussen kijken nu naar `dialoog.hidden`, en dezelfde
twee stonden in `tools/huisshots.mjs`. Les voor de volgende proef: een element
dat je leegmaakt door het te verbergen is geen toestand om op te tellen.

`npm run huistest` en `npm run huisshots` (vijf foto's).

*Het huis als plek, niet als decor.* Negen punten uit de vierde ronde melding
(23 sep 2026), waarvan er drie echte bouwfouten waren.

*De keuken stond in de gangdeur.* Zonder aanbouw komt de keukenrij tegen de
linkerwand achterin. Die wand is vóóraan de gang, en in een ondiepe woning —
Molenkrite 130c is maar 6,8 m diep — begon de rij op 2,2 m terwijl de gang tot
4,4 m doorloopt: de koelkast stond in de deuropening. De rij begint nu nooit
eerder dan een derde meter achter de gang. Dat vroeg om één verplaatsing in het
bestand: `HAL` wordt nu berekend vóór `KEUKEN`, want de keuken moet weten waar de
gang ophoudt en niet andersom. Een kortere gang heeft daar meteen een tweede
gevolg: de zijwand van de woonkamer werd 3,1 m in plaats van 1,9, dus de bank
staat aan de Molenkrite nu ook gewoon tegen de zijwand. De achterwand-variant uit
stap 72 blijft staan als terugval voor een kamer die écht te ondiep is.

`npm run huistest`: negenenzestig controles.

*Bij de Koningsspil liep je door de muur van de buren.* De kamer ligt ver buiten
het kaartgebied en de buurt eromheen is daar nagebouwd uit de kaartdata: alle
panden binnen tweeënvijftig meter. Maar bij een rijtje of een schuin grondvlak
valt de rechthoek van de buurman deels over die van jezelf, en dan staat er een
nagebouwde muur dwars door je eigen woonkamer. Buren waarvan de omhullende cirkel
het eigen erf raakt — de kamer plus de tuin plus de stoep — worden nu overgeslagen.
De proef meet dat: `kijkdoosRaakt()` zet een punt om naar de lokale maten van elk
blok in de kijkdoos en kijkt of het erin ligt, en vijf punten per woning (de
deur, de stoel, de bank, de tafel, het terras) moeten vrij zijn.

*De ramen zijn dichtgegaan.* Ze waren halfdoorzichtig, en dat was precies het
probleem: door het glas zag je de nagebouwde buurt, die naast je eigen adres
ligt maar er niet hetzelfde uitziet. Er zit nu een doek in met een luchtverloop
en twee schuine weerspiegelingen — het leest als een raam, maar je kijkt er niet
doorheen. Op één na: de ruit in de achtergevel kijkt op je eigen tuin, en daar
klopt wat je ziet, dus die blijft doorzichtig.

*Het huis had geen bovenkant.* Vanuit de tuin hield de woning bij de goot op.
Elke band van de plattegrond krijgt nu een zadeldak met de nok over de langste
kant en een topgevel op de kop, in de pannen van het eigen woningtype; de aanbouw
een lagere kap dan het voorhuis. Het staat in de kijkdoos, dus zonder botsdoos en
alleen van buiten te zien. Achter de schutting staan bovendien twee schuurtjes en
vier heggen: een rij achtertuinen in plaats van een leeg veld.

*De barbecue.* Op het terras staat een ketelbarbecue op drie poten. E legt het
vlees erop, na zesentwintig tellen is het gaar en met E eet je het op: 28 leven,
meer dan de twaalf van een flesje uit de koelkast. Het is de enige plek in het
spel waar leven uit de tuin komt, en de enige waar je even moet wachten.

*De radio op het dressoir.* Het plantje op het dressoir is een radiootje
geworden — een kastje met een luidsprekerrooster, een schermpje dat oplicht en
twee knoppen. E zet hem aan en uit. Het geluid komt uit dezelfde tak als de
autoradio; `geluid.autoradio()` heeft er een tweede argument bij gekregen, een
factor tussen nul en één. Die factor rekent de binnenruimte zelf uit uit de
afstand tot het kastje (vol tot anderhalve meter, uitgedoofd na zes en een halve
meter), en buiten de kamer is hij nul. De deur uit betekent dus stilte, en dat is
geen aparte regel maar hetzelfde sommetje.

*De auto op de oprit.* Naast elke voordeur ligt nu een strook klinkers, in de
échte wereld en niet in de kijkdoos, met twee witte lijnen erop. Zet je daar een
auto neer en stap je uit, dan onthoudt het verhaal welke auto dat was; bij het
laden staat hij er weer, tenzij er al een staat. Auto's verdwijnen in dit spel
verder niet, dus dit is precies het stuk dat ontbrak: de opslag.

*En raden hoe je verder komt.* Na het bekijken van een woning stond er niets meer
in beeld en moest je maar weten dat 1, 2 en 3 nog werkten. Stap je nu naar buiten
terwijl er nog woningen over zijn, dan noemt een melding de cijfers die nog te
kiezen zijn met adres en bedrag, staat het in de opdrachtbalk, en gaat de
navigatie alvast naar de dichtstbijzijnde die je nog niet zag.

**De Veteraan (stap 73).** Missie 10 (verzoek 23 sep 2026): na het kopen van een
huis belt De Veteraan zelf, bedankt je op het Sneekerpad bij De Terpensmole voor
de molen in IJlst en stuurt je om een tas bij de tribune van VV Sneek. Daar
wacht een hinderlaag van vier auto's en tien man; daarna is hij weg van het pad,
belt Mark dat hij je heeft willen omleggen, en is de missie thuis klaar — in het
huis dat je gekocht hebt — voor € 250.

*Alles uit de kaart.* Het kleine molentje is de spinnenkop uit `KAART.molens`;
De Veteraan staat op het dichtstbijzijnde punt van het fietspad ernaast (in de
BGT heet dat pad "Tinga" en het gaat bij De Rat over in het Sneekerpad — de
proef kijkt na dat het ene eind bij De Rat ligt en het andere bij de wijk). De
tas staat op de maten van de tribune uit `KAART.sportvelden`, met dezelfde
rekensom als js/sportveld.js. De Veteraan zelf en zijn hondje staan sindsdien
in `maakVeteraan()` in js/deal.js, zodat de molen in IJlst en het Sneekerpad
hetzelfde poppetje gebruiken; het portretje in de gespreksbalk kreeg een baard.

*Drie keer stond de bende stil.* Dit was het werk van de ronde, en geen van de
drie was te zien geweest zonder te meten.
1. De auto's stopten op de rijbaan die het dichtst bij de tribune ligt. Die ligt
   áchter de kantine: honderdtachtig tellen lang viel er geen schot, want de
   mannen liepen recht tegen het gebouw op en zagen je nooit.
2. Toen de plek op de weg met vrij zicht (`zichtVrij`, dezelfde kijklijn als de
   schutters). Nu zagen ze je, maar ze bleven op 71 m tegen het hek rond het
   veld staan — één meter buiten hun vuurbereik.
3. Een looproute dan, en die bestond niet. Een vulling vanaf de tas leverde
   7.500 m² op en geen uitgang, ook met de straal van de speler: rond het
   hoofdveld staat een gesloten ring reclameborden met een botsdoos van zestig
   centimeter. De speler springt eroverheen (dat is waarom die doos zo laag is);
   de schutters konden niet springen.
Nu stapt de bende uit bij het inritje van het clubparkeerterrein — de echte
voorkant — en loopt een route die js/looppad.js één keer zoekt: A* over een
raster van een meter, met dezelfde `resolveCollisions` als waar de mensen tegen
lopen, en daarna strakgetrokken tot vijf punten om de kantine heen. Wat lager
is dan zeventig centimeter stappen ze over, net als jij. js/bewaking.js kreeg
daarvoor opties (schade, zicht, vuurbereik, dekking, kleding, looppad,
`overLaag`); zonder opties gedragen de bewaking en de bende uit missie 7 zich
als voorheen.

*Aanrijden over de weg.* De auto's van missie 7 reden in een rechte lijn naar hun
plek. Op de rechte straat voor de Poiesz ging dat goed, maar de Molenkrite buigt
langs het sportpark. Ze volgen nu de wegas: bij elke knoop de tak die het meest
rechtdoor gaat, met de neus mee in de bocht. De proef meet elke derde stap hoe
ver elke auto buiten de rijbaan staat: 0,00 m.

*De balans is nagerekend, niet gegokt.* Tien man met de schade van de bewaking
(6) houdt niemand vol. Met een vaste loting over vier zaden: schade 3 en
twintig meter dekking geeft 46 tot 76 leven over voor wie om de drieënhalve tel
iemand raakt, 73 tot 91 om de tweeënhalve tel, en neer na een kleine vijftig
tellen voor wie niets doet. De eerste versie van die proef raakte de
dichtstbijzijnde man, ook door de kantine heen — dan is de bende dood voor ze om
de hoek komt en kost het gevecht niets. Nu alleen wie je kunt zien.

*Twee dingen in de opslag die voor elke missie golden.* De pauze tussen twee
missies (`naMissieT`) werd niet bewaard: sloeg je op tussen het kopen en het
telefoontje, dan belde er na het laden nooit meer iemand. De opslag heeft nu een
veld `volgende`, en een opslag van vóór deze missie met een gekocht huis krijgt
De Veteraan alsnog aan de lijn. En `herstel()` zet een spel dat in een fase
`briefing` is opgeslagen terug naar missie 1; voor missie 10 niet meer. Voor de
andere missies staat die regel er nog — bij Johan en bij missie 9 is dat
vermoedelijk ook niet de bedoeling, maar het hoort niet bij deze ronde.

*Uit de proef zelf.* Het kopen in de proef mislukte de eerste keer: binnenkomen
laat Mark iets over de woning zeggen, en zolang dat in beeld staat klikt E dat
weg in plaats van te kopen — dezelfde valkuil waar `huistest` `__rust` voor
heeft. `npm run veteraantest`: zevenenveertig controles, alles groen.

**De bende op straat (stap 74).** Na missie 10 hangen er groepjes van De
Veteraan rond in Tinga en langs de Lemmerweg (verzoek 23 sep 2026): twee tot vier
man, met een pistool of een knuppel, die aanvallen als je te dichtbij komt, je
achtervolgen en het na een tijdje opgeven. Alles staat in js/bendes.js; het
verhaal zet ze aan zodra missie 10 voorbij is en er geen missie loopt, en deelt
de doelen, de treffers, het horen van schoten en de schade.

*De plekken.* Punten om de 22 meter langs de rijbaanassen van 26 straten, 2,6 m
naast de rand van de rijbaan, binnen 1,1 km van het kruispunt (de Lemmerweg loopt
kilometers door). De eerste lijst had 34 van de 317 punten óp een rijbaan: bij een
kruising ligt de stoep van de ene straat op de rijbaan van de andere. Nu wordt elk
punt tegen alle rijbanen getoetst, via een raster van twintig meter. En één punt
lag tussen twee heggen die bij een straal van 1,4 m precies even hard
terugduwden, zodat `resolveCollisions` het punt vrij verklaarde; nu met twee
stralen.

*De knuppel* is een nieuw wapen in js/persoon.js — blank hout, 82 cm, met tape om
de greep — met een slag als houding: `update(dt, { slaat })` brengt de arm in
het eerste derde boven het hoofd en slaat hem daarna naar voren. De klap telt op
60 % van de slag, als je dan nog binnen bereik staat.

*Achtervolgen en opgeven.* Ze rennen 4,6 m/s: sneller dan jij loopt (4,2),
langzamer dan je sprint (7,5). Dat maakte de eerste regel — "opgeven na zoveel
tellen als je verder dan zes meter weg bent" — zinloos: lopend houden ze je bij,
dus die afstand haalde je nooit. Nu geven ze het op als je van hun plek bent
weggelopen (35 m) en de tijd erop zit, of als ze je drie tellen lang kwijt zijn
op dertig meter; sprinten is daarmee na een tel of negen voorbij, lopen na een
kleine twintig.

*Vast tegen een heg.* De eerste proef zette de speler tien meter verderop en de
knuppels bleven op 2,1 m hangen: er stond een heg tussen. Wie in 1,2 tel niet
dichterbij is gekomen en zelf ook nauwelijks bewogen heeft, zoekt nu een route
met js/looppad.js (hoogstens om de twee tellen, en opnieuw als je meer dan zes
meter verschuift). Hetzelfde op de terugweg; wie na anderhalve minuut nog niet
thuis is, staat er weer zodra je niet kijkt.

*Neergaan buiten een missie om* zette je voor Molenkrite 15, waar het spel begon.
Nu voor je eigen voordeur. `npm run bendetest`: dertig controles, alles groen.

*Minder schade (24 sep 2026).* Op verzoek omlaag. De proef meet nu hoelang je het
uithoudt als je stil blijft staan naast een groepje van vier: met 7 per klap en 5
per kogel een tel of tien, met 4 en 3 negentien tellen — nog te kort. Nu 3 per
klap met een pauze van 1,6 in plaats van 1,1 tel tussen twee slagen, en 2 per
kogel: tweeëndertig tellen. De proef eist er minstens vijfentwintig, en dat je
uiteindelijk wel neergaat.

**Clipping, opstarten en licht (stap 75).** Op verzoek na een meting van 24 sep
2026 (binnen 1,1 km van Tinga). Vijf bronnen van clipping, het opstarten en drie
punten licht. Drie nieuwe proeven: `cliptest`, `opstarttest` en `lichttest`.

*Het wapen.* Het stak 0,69 m voor de camera uit bij een botsstraal van 0,35 m;
tegen een gevel was nog 45 % van zijn beeldpunten te zien. Het staat nu op laag 1
(`WAPEN_LAAG` in js/player.js) en `tekenWapen` in js/main.js tekent het na de
wereld, met een gewiste dieptebuffer en een voorvlak van 1 cm. De lampen staan
ook op laag 1: three maakt een nieuw shaderprogramma zodra het aantal lampen
verschilt, en het wapen hoort hetzelfde licht te krijgen als de wereld.

*Het voorvlak* ging daarmee van 5 naar 15 cm. De hoek van het voorvlak ligt op
25,5 cm van het oog, binnen de botsstraal, dus de wereld wordt nergens afgesneden;
de nauwkeurigheid van de dieptebuffer wordt drie keer zo groot en een gat van
2 mm flikkert pas vanaf 71 m in plaats van 41 m.

*Voetgangers.* De statische meting zei dat 395 wegvakken met 1324 m door een
botsdoos liepen. Dynamisch viel het mee: ze worden al elk beeld uit de dozen
geduwd, en er dwars doorheen springen gebeurde een keer of vijf per minuut voor
130 mensen. Wat wél vaak gebeurde: half in een heg staan of tegen een schutting
aan geduwd worden, 73 keer per minuut. `stoepProfiel` in js/npc.js zoekt per
wegvak en per kant om de halve meter een vrije afstand tot de as; waar nergens
plek is steekt iemand over, en kan dat niet, dan keert hij één keer om. Nu 0.

Drie fouten onderweg, alle drie door een proef gevonden. De eerste versie liet
op fietspaden en woonerven geen plek over — daar ligt de looplijn óp de
verharding (walkOff 0,3 bij 2,6 m breed) en de ondergrens was de stoeprand — dus
98 % van de profielen stond dicht en 109 van de 130 mensen stonden stil
(`looptest`). Mijn eigen `cliptest` zag dat niet, want stilstaan telt als "niet
door een doos"; die meet nu ook hoeveel er lopen. Daarna keerde iedereen bij
elk dicht punt om, en wie op een ingesloten stukje stoep liep bleef daar
pendelen: de buurt kwam niet meer bij je (`bevolkingtest`, 2 van de 6 wijken in
plaats van 4). Nu één keer omkeren per wegvak. En het profiel per wegvak bij het
eerste gebruik uitrekenen kwam precies op het moment dat de buurt wordt
bijgevuld; alle 4695 bij het maken van de voetgangers kost een paar tiende
seconde.

*Wat al mis was.* `relieftest` eist hoogstens 260 MB texturegeheugen en meet er
343 — ook op de vorige versie, zonder deze ronde (gemeten met een tweede kopie
van de repo naast deze). Die staat nog open.

*De kaart.* Een laatste zeef in de generator, na alle plaatsingsregels: schuttingen
en heggen geknipt waar ze meer dan 30 cm in een pand liepen, lantaarns van de
rijbaan geschoven, parkeerplekken, bomen en struiken in een pand of op de rijbaan
weggehaald. Eerst gecontroleerd dat de generator `js/kaart.js` precies
terugmaakt (op de datum na); daarna is dit het enige verschil.

*Opstarten.* Een profiel over de hele opstart gaf 72 s headless, en het meeste zat
niet in de meetkunde maar in het tekenen op canvas. Een doek wordt pas echt
getekend als iemand het leest, dus de tijd verhuisde steeds naar wie er als eerste
aan kwam: eerst leek `kleiner` (het verkleinen van de baksteen) 16 s te kosten,
maar de baksteen direct op 288 px tekenen hielp niets. Wat het echt was: 1145
gevels (elk rijtje een eigen doek) en het reliëf. Allebei komen ze nu ná het
opstarten, per materiaal en dichtstbij eerst (`reliëfStappen` en `maakAf` in
js/textures.js); een gevel is tot die tijd een doekje van 4×4 in de steenkleur.
Het aantal gevels verminderen deed ik niet: dan zou elk huis in een rij hetzelfde
zijn. Daarbij rondt Chrome een `setTimeout(0)` na een paar keer af op 4 ms, en bij
honderden stukken opbouw was dat een groot deel van de 12,9 s "idle" in het
profiel; een MessageChannel komt meteen terug. Resultaat: 39 s, waarvan de
gebouwen 13 s (was 32) en het eerste beeld 10 s — shaders compileren en texturen
uploaden op de softwarekaart van deze omgeving. `window.__opstart` houdt de tijd
per fase bij.

*Licht.* Omgevingsschaduw aan de voet van elke muur via `onBeforeCompile`
(js/licht.js): alleen het indirecte licht, want het directe komt uit de
schaduwkaart. De omgevingskaart deelt nu de uniforms van de lucht en wordt
opnieuw gebakken als de zon twee graden verschuift of de lucht van kleur
verandert, hoogstens eens per zes seconden. De schaduw: 3072 px over 76 m op de
pc (2,5 cm per beeldpunt), twintig meter vooruit in je kijkrichting en vastgeklikt
op het raster van de kaart gezien vanuit de zon.

**Het idee zoals het een dag eerder was vastgelegd.** Erik verdient
inmiddels aan missies maar kan er alleen wapens, munitie, health en een
spuitbeurt van kopen — terwijl Mark belooft dat ze "grotere spelers in Tinga"
worden. Het idee, op verzoek vastgelegd maar toen nog niet gebouwd (22 sep 2026):
een korte missie tussen twee grote in waarin Erik een eigen huis kiest. Twee of
drie panden in de wijk staan te koop, je loopt er binnen, en wat je kiest wordt je
vaste stek — opslagpunt, plek om te herstellen, en de plaats waar een auto blijft
staan. De onderdelen liggen er al: js/interieur.js kan een woning van binnen
bouwen uit het grondvlak, het verhaal kan panden aanwijzen met een M, en de
opslag bewaart al waar je spullen staan.

**Wat nog niet af is (in volgorde).

Van de vijf punten die de gebruiker expliciet voor later had laten liggen zijn er
twee af: IJlst staat er (stap 22) en de politie is bijgewerkt (stap 24). Wat er
van dat lijstje over is staat hieronder als 1, 2 en 3.

1. **3D BAG-tegels aan de randen.** Twee gaten:
   - de **noordoosthoek** (RD X 172608–172979, Y 559900–560001): 183 panden aan
     de Morrahemstraat, Rijperahemstraat, Oosthemstraat, Folsgaarsterhemstraat en
     Scherwolderhemstraat vallen buiten alle tegels die er nu liggen. Tegel
     **9-636-1012** vult dat;
   - de **westkant van IJlst**: het meest westelijke pand ligt 12 m van de
     westrand van tegel `7-624-992`, dus daar ligt vermoedelijk nog een rij
     panden zonder dakmodel. Welke tegel dat is, is op de kaart van 3dbag.nl op
     te zoeken.
   Beide bestanden (`.gpkg` en `.city.json`) in `data/geo/bron/` zetten en de
   keten opnieuw draaien is genoeg; aan de gereedschappen hoeft niets te
   veranderen. Panden zonder model staan nu als opgetrokken grondvlak in het
   spel, zonder hun echte kap.
2. **Wegblokkades aan de rand van de wereld**, zodat je er niet uit kunt lopen of
   rijden. Het mechanisme staat er sinds stap 44: een blok `wegafsluitingen` in
   `data/stijl/omgeving.json` met per plek `{naam, punt, muur}`, waarbij de
   generator de dichtstbijzijnde drijfbare rijbaan-as opzoekt en er haaks een
   schrikhek op zet met een onzichtbare wand van `muur` meter breed erachter
   (`js/afsluiting.js`). Er staat er nu **één**, op (800.9, −554.2). Wat er nog
   moet komen zijn de overige plekken, en die moeten van de gebruiker komen:
   **K** zet je plek op het klembord en de grote kaart laat hem linksonder zien.
   Drie soorten aanwijzing werken: twee getallen uit het spel, een straatnaam met
   een herkenningspunt ("de Lemmerweg net na de rotonde"), of een streep op een
   schermafdruk van de kaart. Een muur zonder hek — alleen een collider, voor
   een oever of een spoordijk — kan met hetzelfde blok als er een `type`
   bijkomt; dat is nog niet nodig geweest.
3. **Gebouwen steekproeven** als fijnafstelling. Nu de wereld zes keer zo groot
   is en er 7885 panden in staan, moet er een ronde langs een steekproef van
   adressen: klopt het woningtype per straat, de goothoogte, de voorgevelrichting
   en de gevel? `npm run geo:steekproef` rendert twaalf vaste adressen vanaf de
   straat met de Street View-link erbij; dat is de plek om die steekproef uit te
   breiden naar de nieuwe buurten.
4. **Alleen bouwen wat in de buurt is.** De hele wereld wordt bij het starten
   opgebouwd (headless ~31 s) terwijl je er hooguit negenhonderd meter van ziet,
   en die tijd loopt recht evenredig met de oppervlakte. De ondergrond, de bomen,
   de struiken, het riet en de geparkeerde auto's staan al per tegel van 240 of
   480 m; die tegels in en uit beeld laten laden is de volgende stap. Dat is een
   verbouwing van `js/kaartwereld.js` op zich.
5. De achterkant van het Kruirad (groene panelen, balkons) en dakdetails als
   zonnepanelen en schoorstenen als losse elementen op de 3D BAG-daken.
6. Straten nog zonder foto: Windbord, Voorzoom, Buitenroede (de woningen 40–74;
   de RWZI op nr 1 is wel gedaan), Zeskanter, Omloop.
7. De editor (F2) en de overige oude objecten uit `data.js` werken nog in pixels van de
   oude kaart; enkele objecten staan daardoor een paar meter verkeerd. Omrekenen kan met
   drie ijkpunten in `oorsprong.json` (`rd.mjs px`). Het tuinfeest is al verhuisd: dat
   komt nu uit `js/verhaal.js`, op het adres uit de kaartdata.
8. Koepel- en samengestelde daken (`multiple horizontal`) en de 75 nieuwbouwwoningen
   zonder 3D-model.
9. **Rechtenvrije muziek voor de autoradio.** De speler is er (stap 38), maar
   het enige nummer dat erin staat is een plaatshouder waarop rechten rusten.
   Formaat voor een vervanger: **mp3** werkt overal, ogg/opus is kleiner maar
   niet op elke oudere iPhone, m4a/aac kan ook; richtlijn 128 kbps en een paar
   megabyte per nummer, want alles gaat mee over GitHub Pages.
10. De overzichtsbladen `docs/screenshots/objecten.png` en `woningtypen.png` zijn
   nog van vóór de supermarkt en de boerderij: de vlaggenmast en de twee nieuwe
   woningtypen staan er nog niet op. Bijwerken kan met `npm run propshots` en
   `npm run assets` plus `python3 tools/contactblad.py objecten|woningen`, maar
   dat zijn 78 losse renders en dat duurt op software-rendering een uur.
10. De overige panden die geen woning zijn en nog het naamloze `spil`-type
   dragen: de school aan de Molenkrite (BAG-pand 0091100000007732, 1462 m² met
   een golvende plattegrond), de rij aan de Ligger/de Loper (0091100000014651,
   3485 m²) en het blok aan de Krans. Ze kunnen op dezelfde manier als de
   supermarkt en de boerderij een eigen type krijgen in het blok `panden` van
   `data/stijl/straten.json`, zodra er een foto van is.
11. **Onder de zuilengang door kunnen lopen, en een deur de Poiesz in.** De
   botsingsdozen van een pand volgen het grondvlak, en de zuilen staan op die
   lijn: je loopt nu tot aan de zuilen en houdt daar op, net als bij elke andere
   gevel. Om onder de gang door te kunnen lopen moeten de dozen van deze twee
   panden op de puilijn gelegd worden in plaats van op het grondvlak. Dat is pas
   de moeite als er ook een deur de winkel in komt — dan kan deze Poiesz dezelfde
   binnenruimte krijgen als die in IJlst (`js/supermarkt.js`).
12. **De drie punten belichting die na stap 27 overbleven.** Punt 1 (normal maps)
   en 2 (roughness maps) zijn af; wat er nog ligt:
   - **ambient occlusion.** Onder een dakrand, in een portiek en in de hoek van
     twee muren hoort het donkerder te zijn. Echte SSAO vraagt een
     `EffectComposer`, en die zit niet in `lib/three.module.js` (er is geen
     buildstap en `three/addons` is er niet). Het kan dus of met een vendored
     bestand, of — goedkoper en beter voor de telefoon — door de omgevingsfactor
     per hoekpunt in de vertexkleur te bakken, zoals de binnenruimtes al doen.
   - **scherpere schaduw dichtbij.** Eén schaduwkaart van 2048² over een doos van
     104 m is 5,1 cm per texel; dat is te grof voor de rand van een dakkapel. Met
     twee of drie cascades (dichtbij fijn, ver grof) wordt dat een centimeter.
     CSM zit ook niet in de vendored three, dus dat is met de hand op te zetten.
   - **de omgevingsreflectie met de klok mee.** De PMREM-map wordt één keer uit de
     luchtshader gebakken en blijft daarna staan, dus bij zonsondergang spiegelen
     de ruiten nog een middaglucht. Hem elke paar minuten spelletijd opnieuw
     bakken kost ~40 ms; dat kan op een vast moment in de dag-nachtcyclus.
