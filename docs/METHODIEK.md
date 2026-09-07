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
`betaal(bedrag)`, die false geeft als je het niet hebt. Je begint met € 50, dus
één doos zit er altijd in; de rest verdien je met de missies.

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

**Wat nog niet af is (in volgorde).**

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
2. **Onzichtbare muren** aan de rand van de wereld, zodat je er niet uit kunt
   lopen of rijden. Het werkgebied ligt nu vast — verder dan de BGT-download
   reikt is er geen ondergrond — dus dit kan.
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
9. De overzichtsbladen `docs/screenshots/objecten.png` en `woningtypen.png` zijn
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
11. **De drie punten belichting die na stap 27 overbleven.** Punt 1 (normal maps)
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
