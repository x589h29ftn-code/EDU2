# Tinga — waar dit spel staat, en hoe eraan gewerkt wordt

Dit bestand is de overdracht naar een nieuwe sessie. Het vertelt wat het spel is,
hoe het in elkaar zit, welke afspraken er gelden en wat er nog open staat. Lees
dit eerst; `README.md` (spelersuitleg, per missie) en `docs/METHODIEK.md`
(bouwverslag, per stap) zijn de diepte in.

## 1 · Wat het is

Een GTA-achtig spel in de wijk **Tinga in Sneek**, in de browser. Three.js r160,
ES-modules, **geen buildstap**: `index.html` laadt `js/main.js` en dat is het.
`lib/three.module.js` staat in de repo. Er draait ook een Electron-schil
(`desktop/`) en een Windows-app via GitHub Actions.

Starten: `npm run server` (poort 8123) en dan `http://127.0.0.1:8123/index.html`.

## 2 · Werkafspraken

Deze gelden altijd, ook als ze niet opnieuw genoemd worden.

- **Alles in het Nederlands.** Code-commentaar, commitberichten, `README.md`,
  `docs/METHODIEK.md` en de uitvoer van de proeven. Ook de gesprekken in het
  spel.
- **Ontwikkelen en pushen op de tak `claude/gta-tinga-veteran-mission-1aoypq`.**
  Nooit een andere tak zonder dat het gevraagd is. Hier stond eerst
  `claude/gta-tinga-game-setup-lcm1jy`; op die tak is tot 26 sep in een oude
  sessie verder gewerkt vanaf de stand van 23 sep, en dat is in stap 85 hier
  samengevoegd. Kijk bij twijfel eerst met `git log` op beide takken.
- **Pushen als de gebruiker het zegt.** "push" betekent pushen, **"Build"**
  betekent de Windows-app bouwen: `windows.yml` via `workflow_dispatch` op de
  werktak.
- **Geen afbeeldingsbestanden in het spel.** Elke textuur wordt op een canvas
  getekend (`js/textures.js` en de doek-functies boven in de modules). Bewuste
  uitzonderingen: de mp3's onder `audio/` en de laadschermen onder
  `beeld/laadscherm/`, en sinds stap 105 het schot (`audio/wapen/schot.mp3`).
- **`js/kaart.js` is gegenereerd** door `npm run geo:genereer` uit de geodata.
  Nooit met de hand aanpassen. Geometrie komt uit BGT en 3D BAG; foto's mogen
  alleen kleur, detail en indeling bepalen.
- **Elke ronde krijgt een proef en foto's.** Een nieuwe functie zonder
  `npm run <iets>test` is niet af, en de proef moet groen zijn vóór de push.
- **Zuinig met tokens.** Meten in plaats van gokken, maar niet meer lezen dan
  nodig.
- **Meten, niet kijken.** Bijna elke fout in dit project kwam uit een maat die
  niet klopte, niet uit iets wat je kon zien. Schrijf de controle als proef.

## 3 · Hoe het in elkaar zit

| Bestand | Waarvoor |
|---|---|
| `js/main.js` | de hoofdlus, de invoer, de mixer, alles aan elkaar |
| `js/verhaal.js` | de achttien missies, Mark, de gesprekken, de opslag van het verhaal |
| `js/kaart.js` | **gegenereerd**: panden, wegen, water, straten uit de geodata |
| `js/kaartwereld.js` | daar de wereld van bouwen (tegels, bomen, riet, auto's) |
| `js/textures.js` | alle geveltextures, dakpannen, baksteen — op canvas |
| `js/world.js` | botsingsdozen, `addCollider` / `resolveCollisions` |
| `js/interieur.js` | de woningen van binnen, inclusief tuin, radio en barbecue |
| `js/politie.js` | sterren, onderscheppen, wegversperring, helikopter |
| `js/vehicles.js` | geparkeerde auto's, verkeer (over `gladPad`: gladde lijn, remmen voor de bocht, keren), rijgedrag, `voegToe()` |
| `js/npc.js` | voetgangers en fietsers op wegvakken |
| `js/audio.js` | alles synthetisch, plus de mp3-radio (`autoradio(actief, sterkte)`) en het schot als opname (`schot(afstand, { wapen, bron })`, `SCHOT` per wapen, afkappen per bron, `zetSchotSoort`) |
| `js/hud.js` | minimap (bijzondere plekken op de rand: `opRand` in `drawMap`), grote kaart met legenda (`zetLegenda`, iconen per soort in `HUD.PICTO`) en een eigen doel (`kaartKlik`, `zetEigenNav`, paars), meldingen, vlaggen |
| `js/bewaking.js` | schutters: bewaking, de bende van missie 7 en 10 (met opties; `leven` en `mg` sinds stap 110: taaier volk en machinegeweren in salvo's) |
| `js/looppad.js` | een looproute te voet om hekken en gebouwen heen (A*) |
| `js/bendes.js` | van missie 10 tot 12: groepjes van De Veteraan op straat in Tinga en langs de Lemmerweg |
| `js/deal.js` | missie 8, en `maakVeteraan()`: De Veteraan met zijn hondje |
| `js/wapen.js` | het wapen in je hand: afgeronde delen, eigen doeken, veer-terugslag, hulzen, grendel |
| `js/carmodel.js` | automodellen (gedeelde geometrie, instanced), lak met clearcoat, kenteken |
| `js/lichaam.js` | maten, onderdelen en doeken van alle mensen; `lichaamMat`, `doekVoor` |
| `js/groen.js` | bomen, struiken, gras: `bolGeo`, `stamGeo`, blad- en schorsdoek, `grasVariatie`, riet, `maakGrasVeld` (gras in 3D) |
| `js/licht.js` | omgevingsschaduw aan de voet van de muren (`grondAO`), verlichte ramen 's avonds (`nachtRamen`) |
| `js/schrift.js` | missie 13: het schrift van De Veteraan en politielint |
| `js/brug.js` | missie 12: het dek van de Dúvelsrak als assenstelsel (`brugAssen`), dranghekken, C4, de schade na de knal |
| `js/garage.js` | Autohuis Lemmerweg: glazen showroom, Ferrari's en BX kopen, gekochte auto's in de opslag |
| `js/race.js` | missie 14: het parcours van de BP naar IJlst (routeplanner + de hoofdweg uit de BGT), gele ringen, finish, tegenstanders langs de lijn |
| `js/bouwvlak.js` | plekken waar het spel zelf bouwt (de showroom, de loods): daar geen bomen, struiken of gras |
| `js/inval.js` | missie 16: de route van de inval over de Molenkrite, de vlucht van Bouwman van de Dúvelsrak naar een rotonde (`vluchtLijn`, `rijdVlucht`), de schuif na de klap met botsing (`crashSchuif`, `renVrij`); de lijnen via `lijnDoor` uit js/schaduw.js |
| `js/schuur.js` | missie 17: het erf van Ronald aan de Lemmerweg 80 in het assenstelsel van het huis (`erfAssen`): caravan met kluis, de zwaaiende camera met zijn kegel (`kegelRaakt`), de hond aan de ketting, de worst; de hoogte uit de kaartvlakken (`grondPeiler`) |
| `js/klusjes.js` | klusjes tussen de missies door: Mark of Johan met een K op de kaart, tas, auto, overspuiten, omleggen (€ 250–1000) |
| `js/studio.js` | missie 18: Radio Tinga aan de Tinga — de zendmast op het dak, de zuil, ON AIR, en de studio als binnenruimte naar een foto (gebogen bureau, schermen, mengpanelen met usb-poort en schuif, de dj Sjors); `plekken`, `bijTafel`, `zetUsb`, `zetSchuif`, `zetOnAir`, `zetSlot` |
| `js/rondvlucht.js` | missie 18, de avond: de heli van Wiebe (model uit js/helikopter.js, `bouwHeli`), Erik in de open deur, de buitencamera (`camera`, `begrens`), rustig volgen (`volg`: afstand en deur naar het doel, `RONDVLUCHT.versnel`), `landNaar`, het zoeklicht als kegel (`richtLicht`) |
| `js/schaduw.js` | missie 15: de route van Bouwman (BP → Duinterpen → N7), zijn rit met een stop, de loods aan het water met container, kade, steiger en boot, de fotoplekken |

Een paar dingen die niet vanzelf spreken:

- **Licht zit in de hoekpunten.** Er staan geen lampen in de scene; `schaduw(geo)`
  bakt de belichting in de vertexkleuren en dag/nacht gaat via materiaaltinten.
- **Binnenruimtes staan buiten de kaart.** Elke woning is een losse kamer ver
  buiten het gebied (`NUL`), met een "kijkdoos" van nagebouwde buren eromheen.
  De voordeur teleporteert. Daarom hoort alles wat je binnen ziet te kloppen met
  het adres, en zijn de ramen dichtgemaakt.
- **NPC's leven op wegvakken.** `p.seg` en `p.t` bepalen x/z, elk beeld opnieuw.
  Een handmatig gezette positie overleeft één beeld.
- **De wijk slaapt 's nachts** (stap 83, 87). `sfeer.drukte` (1 overdag, 22:30→23:30
  naar 0,16, 05:00→06:30 terug) schaalt het aantal mensen en auto's: wie boven
  zijn vaste drempel zit krijgt `slaapt` (geen lichaam, geen update, geen getuige,
  een auto ver buiten de wereld); dat wisselt alleen uit het zicht. Wie door
  `npcs.people` of `vehicles.traffic` loopt, slaat slapers over;
  `sfeer.lampenAan` dooft na middernacht tweederde van de lantaarns in
  woonstraten (per tegel twee stapels koppen, `MAT.lamp` en `MAT.lampNacht`, en
  hun plas licht dooft mee). De drie straatlampen zijn een vaste pool in
  js/sfeer.js (`zetLampen`): 's nachts altijd zichtbaar, alleen hun sterkte gaat.
- **De plattegrond komt uit het grondvlak.** `plattegrond(pand)` en
  `banden(punten)` maken van een BAG-voetafdruk kamerbanden; de woonkamer is de
  eerste band over de volle diepte.

## 4 · De geodata-keten

Bron in `data/geo/bron/` (BGT `.gpkg`, 3D BAG `.city.json`) → `npm run geo:bgt`
en `geo:bag3d` → `npm run geo:genereer` → `js/kaart.js`. Stijl per straat en per
pand staat in `data/stijl/straten.json`, omgevingsobjecten in `omgeving.json`.
`npm run geo:steekproef` rendert twaalf vaste adressen vanaf de straat met de
Street View-link erbij.

## 5 · De missies

1. Molenkrite 15 — kennismaking met Mark
2. naar de waterzuivering — rijden
3. de bewaking
4. afleveren bij de boerderij — vrachtwagen
5. het telefoontje van Johan — achtervolging te voet
6. de groene BX — stelen en overspuiten
7. de bom bij de Poiesz — Duinterpen
8. de deal bij de molen — sniper en boten
9. **een eigen stek** — drie woningen kopen
10. **De Veteraan** — de tas bij VV Sneek en de hinderlaag
11. **de politieauto en de C4** — stelen aan de Lemmerweg, C4 bij Tinga State
12. **de Dúvelsrak** — de wegversperring met C4 op de brug, De Veteraan
13. **het schrift** — Mark in Duinterpen, het schrift uit de sloep in IJlst
14. **Ronald en de race** — Lemmerweg 80, Bouwman, de race van de BP naar IJlst
15. **Bouwman schaduwen** — Mark en het schrift, Bouwman volgen, foto's bij zijn loods
16. **De inval** — drie minuten om Mark weg te halen, de ruil op de Dúvelsrak, Ronald is ???
17. **Wie is R.** — het erf van Ronald 's nachts: camera, hond, de kluis in de caravan, Ronald met zijn geweer
18. **De uitzending** — 's avonds de heli boven Bouwman, de achtervolging, de loods, de C4 op de Dúvelsrak; zondag de usb-stick bij Radio Tinga, het fragment over heel Sneek, het einde en vrij spelen (laatst gebouwd)

Missie 9 in het kort: Mark belt, staat bij de Wieken 29, noemt drie adressen met
bedrag (**1, 2 of 3** kiest en zet de navigatie), en je koopt er aan tafel een
met E. Te weinig geld houdt het aanbod open; alle drie bekeken zonder kopen rondt
de missie af en laat het aanbod staan.

Missie 10 begint een tussenpoos (`TUSSENPOOS`, 150 s) na het kopen: De Veteraan belt, staat met zijn hondje op
het fietspad bij De Terpensmole, stuurt je om een tas voor de tribune van VV
Sneek. Dan zacht naar zwart, "Enkele uren later", en je staat om 01:00 voor je
eigen huis (of de Wieken 29); dat regelt `werkZwartBij` in js/verhaal.js op
`update(dt)`, met de laag `#overgang` in index.html. Bij het oppakken komen vier
auto's met tien man naar het inritje aan de Molenkrite; die komen het veld niet
op maar gaan rond de ingang staan (`ingang()`, Bewaking met `houden`) en wachten
je op. Daarna is hij weg,
belt Mark (omleggen, te snel in de rangen, ga naar huis) en is het thuis — het
gekochte huis — klaar voor € 250. **shift+0** start hem los.

Missie 11 begint 25 s na missie 10, zonder telefoon: alleen een M bij Molenkrite
15. Binnen zit Mark op de bank (`opDeBank`, `update(dt, { zit })`, de zithouding
uit js/lichaam.js) en vraagt om een politieauto en C4. De auto staat aan de
Lemmerweg (`politieautoPlek`, `politie.parkeerAuto`); instappen geeft twee
sterren, en pas zonder sterren gaat de nav naar Tinga State. Daar liggen vier
blokken C4 op de toonbank (`boerderij.toonC4`), E aan de balie: "Mark had al
gebeld", gratis, `player.c4 = 4` (bewaard). Auto en C4 bij Molenkrite 15:
€ 1.000, en Mark zegt dat hij binnen zijn plan vertelt. **shift+min** start hem los.

Missie 12 begint als Mark na missie 11 uitgepraat is: weer een M, binnen het
plan op de bank. De Dúvelsrak heet in de kaart "Viaduct Tinga" (het dek van 51 m
op 5,6 m; `brugAssen` in js/brug.js, s vanaf de Tinga-kant, u opzij). Zwart
("Die avond…", `zwartMet`), politiepak (`derde.pak`, eigen poppetjes `brugMark` en
`brugJohan`), de politieauto dwars op het dek, drie dranghekken en vier C4 met E op
gele markeringen, Mark kijkt naar 100 kogels en 100 leven, Johan komt. Zwart
("Even later…"), het filmbeeld (`werkFilmBij` zet de camera; `body.film`), vier
auto's van de Lemmerweg-kant, `Bewaking` met `rustig` en De Veteraan als wachter 0.
E laat de C4 afgaan, het gevecht, vier van de achterkant (`voegToe`), vier sterren
met `politie.rust` tot Mark uitgepraat is, dan `stuurWagens` van de Molenkrite-kant.
Tinga-bos: € 5.000, en de brug houdt zijn gat. **shift+=** start hem los.

Missie 13 (bedacht bij het verzoek "bedenk een verhaal dat haalbaar is"): in het
bos zegt Mark dat ze op de achtergrond blijven; vijf tellen na MISSIE GESLAAGD
zwart ("Een paar dagen later", `naarDeMiddag`: 14:30, voor je eigen huis). Mark
staat voor Parelmoervlinder 3 in Duinterpen (`SCHRIFT_HUIS`), bij hem begint het
gesprek vanzelf. Het schrift ligt in de sloep aan de IJlster ligplaats
(`boten().ruw(1)`, op het kussen van een bank), met politielint (js/schrift.js) en
twee agenten (`Bewaking` in uniform; gezien = twee sterren). Terug bij Mark, niet
met sterren: € 2.500. **shift+[** start hem los.

Missie 14: een tussenpoos na het schrift belt Ronald (`RACE_WACHT`), R op de kaart bij de
Lemmerweg 80. Bij zijn schuur: Bouwman, de races; geen Ferrari (`eigenFerrari`, uit
js/garage.js) dan een A bij het Autohuis en legt Ronald bij wat je tekortkomt. Gekocht:
hij belt, "Die nacht…", 01:00 op de grid (`opDeStart`, `ctx.stapIn`), Bouwman en Ronald
langs de kant met zijn politieauto. Aftellen, de race (js/race.js), eerste bij de finish in
IJlst: stoppen bij Bouwman, € 2.000. Lichtpijlen op de weg (`race.toonPijlen`); de tegenstanders
blijven bij (`RACE.bijblijven`) en wijken uit. Verloren (`raceVerloren`, niet via `mislukt`, dat de
opslag laadt): Bouwman, dan 1 dubbel of niks of 2 de schuld betalen (`raceKeuze`, via `kiesHuis`).
Een kleinere ring in de top van elke scherpe bocht (`RACE.bochtRing`; de eerste rotonde), piepjes
bij het aftellen (`geluid.aftelPiep`), geen wijkverkeer op de route (`vehicles.vrijeZone =
race.opRoute`, `maakVrij`). Na GESLAAGD of betalen vijf tellen, dan "De volgende ochtend"
(`naDeRace`, `naarDeOchtend`: 09:30, `springNaarHuis`). **shift+]** start hem los.
Tot stap 96 heette brigadier Bouwman "De Boer" (gevraagd: "net wat anders").

Missie 15 (stap 96): een tussenpoos na de ochtend belt Mark (`SCHADUW_WACHT`), M bij Molenkrite 15,
binnen op de bank het schrift ("B. — opslag aan het water"). "Die avond…" om 23:00 in de grijze
Golf van Mark op het voorterrein van het Autohuis; Bouwman (`raceBouwmanAuto`, `bouwman` uit missie
14) bij de pomp van de BP. Hij rijdt de lijn uit js/schaduw.js (`rijd`, 2,2 km door Duinterpen, stop
bij Parelmoervlinder 3); volgen met de balk `#schaduwbalk`: dichter dan 22 m (Ferrari 45, stilstaand 40) drie tellen =
gezien, twee sterren, `mislukt`; verder dan 170 m vijf tellen = kwijt. Bij de loods
(`LOODS` in js/bouwvlak.js, x 1396–1418, z −194…−182) drie foto's met E op een gele ruit, recht naar
het onderwerp kijkend (`fotoHier`); de twee mannen zijn een `Bewaking` (`schaduwMannen`). Gezien bij de
loods: Bouwman vlucht (`rit.vlucht`), Mark geeft de helft. Terug op de bank: € 1.500, "blijf hier
maar even slapen", zwart, "De volgende ochtend" (`wakkerBijMark`: 10:00, voor de deur). Van "Die
avond…" tot de ochtend staat de klok stil (`klokLoopt` in de ctx). Rotondes neemt hij tegen de klok
in (`rotondes`, `eenrichtingRotondes` in js/schaduw.js). **shift+\\** start hem los.

Missie 16 (stap 101): een tussenpoos na de ochtend bij Mark belt Johan (`INVAL_WACHT`), een inval op
Molenkrite 15. De balk `#schaduwbalk` telt drie minuten af (`INVAL_TIJD`); binnen E bij de bank (schrift)
en de radio op het dressoir (foto's), Mark gaat mee naar buiten en stapt in (anders de Golf van Mark voor
de deur, `plekVoorDeDeur`). Dan het filmbeeld `invalFilm.soort === 'inval'` (twee politieauto's met
`zwaailicht` en een zwart busje over `invalRoute` uit js/inval.js), drie sterren en `stuurPolitie`.
Afgeschud: de Wieken 29, Bouwman belt, 1 of 2 via `kiesHuis` (`invalKeuze`). "Die nacht…" (01:00, klok
stil): filmbeeld `brug` (de auto van Bouwman over `brug.vanLemmerweg` tot s = 34), zijn twee mannen als
`Bewaking` met `rustig` in `schutters`; wapen weg binnen 40 m, E op de ruit (s = 18): de tas. Bij 1:
`schriftKwijt`, Johan vrij, Bouwman rijdt weg, € 1.000. Bij 2: filmbeeld `nu` vanaf het dak, twee man
neer, `vluchtLijn` (een draai op het dek, de helling af, naar de rotonde), ram hem (drie klappen of één
boven 60 km/u): filmbeeld `crash`, E bij zijn auto: de telefoon ("— R."), € 3.000; kwijt € 2.000.
Daarna "De volgende ochtend" (09:30, `invalOchtend`). **shift+;** start hem los.

Missie 17 (stap 103): een tussenpoos na de ochtend belt Mark (`RONALD_WACHT`); voor Molenkrite 15 hangt
lint (`molenLint`, zolang `invalKlaar`). M bij de Wieken 29, binnen Mark op de bank en Johan (`invalJohan`)
bij de tafel; E bij de koelkast (`ronaldBijKoelkast`, ook in `aanspreekbaar`) geeft de worst. Naar buiten:
"Die nacht…" (01:00, klok stil), naast de Golf van Mark aan de weg Tinga (`golfPlek`). Het erf staat in
js/schuur.js: argwaan in `#schaduwbalk` (kegel 0,55/s, blaffen 0,09/s, zakt 0,04/s; vol of een schot =
`erfAlarm`), E op ≤ 10 m van de hond gooit de worst, E bij de caravan kraakt (7 s, blijven staan). Dan het
filmbeeld `ronaldFilm.soort === 'koplampen'`: Ronald (de `ronald` uit missie 14) in zijn BX over `erfRoute`
(met de hand: de Tinga heeft in de kaart geen knooppunt met de Lemmerweg; `gladLijn`), bij alarm twee auto's
en vier man (`Bewaking`, `rustig` tot het eind). Stil: het gesprek (niet schieten: `schietSlot`), € 2.500;
gezien: het gevecht, Ronald rent weg (`loopt`), thuis zonder sterren, € 1.500. Ronald is nooit een doelwit.
Daarna "Aan het water…" (`LOODS_ZWART`) en het filmbeeld `loods` (Bouwman bij `schaduw.bouwmanStaat`), en
"De volgende ochtend". Opslag: `ronaldKlaar`, `ronaldPraatte`, `ronaldWeg`, `ronaldSchrift` (het schrift
terug na de ruil), `erfHeeftWorst`. **shift+'** start hem los.

Missie 18 (stap 107, de laatste): een tussenpoos na de ochtend van missie 17 belt Mark (`UITZENDING_WACHT`), M bij
de Wieken 29, binnen Mark op de bank en Johan met de usb-stick. Naar buiten: eerst **de avond** (stap 109;
sinds stap 110 "Die nacht…", 01:00, klok stil, `startAvond`): Erik in de deur van de heli (`avondHeli`, js/rondvlucht.js;
`player.zit`, de camera via `werkDeurBij`) boven Bouwman, die over lijn A (`avondLijnen`: loods → BP) rijdt;
schoten tellen (`avondTreffers`) maar zijn auto blijft heel. Onder de luifel van de BP (`luifel`) landt Wiebe
bij het Autohuis (`landPlek`), `naLanden`: een zwarte Ferrari met Mark en Johan. Instappen: de achtervolging
over lijn B (`avondTweede`; verder dan `AVOND_KWIJT` 300 m tien tellen = `mislukt`), bij de loods het gevecht
(`AVOND_POSTEN`, Bouwman wachter 0; `AVOND_LEVEN` 2 en 3 treffers, `AVOND_MG` twee met een machinegeweer — `leven`
en `mg` in `Bewaking`, de sniper legt iedereen in één keer neer; Mark en Johan raken om de 3,5–5,5 s een man, nooit
Bouwman; opnieuw na het neergaan begin je bij de loods, `startGevechtOpnieuw`), dan `politieKomt`:
vier sterren, de nav naar de Dúvelsrak. Over het dek (`werkPolitieBij`, in de rijrichting, genoeg dek voor
25 m): het filmbeeld `brugFilm` met Johans laatste C4 (`avondC4`), de politie remt ervoor, `sterrenWeg`. Tot
het gevecht geen sterren (`AVOND_ZONDER_STERREN`); in de heli en op de brug doet E niets (`AVOND_VAST`) en houdt
`werkDeurBij` de camera in de eerste persoon (V); de achtervolging gaat met de auto waar je in zit; Johan vult je
kogels aan tot `AVOND_KOGELS`. Dan "Zondagochtend" (07:45, `naarDeStudio`, thuis). Radio Tinga staat in js/studio.js: het pand van type `zorg` aan het voetpad Tinga
(de auto parkeer je aan de Molenkrite, ~40 m), de deur op de gevel het dichtst bij de Tinga, de mast op
het dak; binnen een losse kamer (`NUL` = gebied + (640, 1250)). Johan wacht bij de ingang; de deur zit
dicht (`zetSlot`) tot hij belt; dan `UITZENDING_TIJD` (60 s) in `#schaduwbalk`, E aan de tafel
(`bijTafel`) de stick, E de schuif: het filmbeeld `uitzFilm` met `montageShots` (zeven shots over
de stad, buiten de botsdozen uit geduwd, elk met een `vast` voor de LOD) zolang `audio/radio/uitzending.mp3`
duurt (`geluid.uitzending`, 40,2 s; autoradio, huisradio en missiemuziek zwijgen eronder). Te laat:
Sjors komt terug, `mislukt`. Buiten Mark en Johan, € 10.000, "Die avond…" (`startEindFilm`, 20:30, klok
stil), de titelrol (`#titelrol`, z-index 7 en buiten `#ui`, E slaat over) en `naDeTitelrol`: `missie = 'klaar'`, geen
volgende missie, `geluid.zetHerhaling(true)` (het fragment in de lijst van Radio Tinga). Opslag:
`uitzendingKlaar`. **shift+/** start hem los. De ondertitels van het fragment (`UITZENDING_ONDERTITELS`): Erik en
Mark de eigenaren van de drugshandel in Tinga, en "Erik: van harte gefeliciteerd met je verjaardag" (echt: het
spel is een cadeau); de titelrol eindigt daar ook mee.

**De tussenpoos** (stap 108): elke missie die met de telefoon begint, belt `TUSSENPOOS` (150 s) na de
vorige; die telt niet af tijdens een klus. Een nieuwe missie gebruikt die ook, en hoort met zijn
wachtfase in `KLUS_WACHT`; `npm run tempotest` controleert beide.

**Klusjes** (stap 99, js/klusjes.js): tussen de missies door, en als een missie onder zijn M
op je wacht (`KLUS_WACHT` in js/verhaal.js: de fase waarin nog niets begonnen is, ook missie 9
zolang je geen huis hebt), staat na KLUS.wacht tellen Mark of Johan op een willekeurige stoep met
een groen speldje K (`hud.zetKlus`). E: tas (€ 250–500, onderweg soms een ster of een groepje via
`bendes.zetGroep`), auto (€ 400–650, soms twee sterren), overspuiten (€ 550–750, stelen = een
ster, de wasbox op rekening via `spuitPrijs`), omleggen (€ 750, met lijfwacht € 1.000, daarna
drie sterren). Plekken: stoep langs een gewone straat of een lege parkeerplek, KLUS.rand (350 m)
van de rand, KLUS.bezet van `api.bezet`, over de weg bereikbaar. Tijdens een klus wacht het
verhaal (`wachtOpKlus`: de pauze telt niet af, de werk…Bij van een wachtende missie draait niet,
E gaat niet naar de missie), daarna zet `pauzeerVoorKlus(false)` de M en de opdracht terug.
Geslaagd: telefoon, geld, checkpoint. X breekt af; laden en `startMissie` ruimen op (`reset`).

Daarna hangen er groepjes van twee tot vier man van De Veteraan rond in Tinga en
langs de Lemmerweg (js/bendes.js): knuppel of pistool, aanvallen binnen 13 m,
achtervolgen, na een tijdje opgeven. Alleen buiten de missies om, en alleen tot
missie 12: met De Veteraan dood valt zijn bende uit elkaar (`!brugKlaar`).

Buiten de missies: **Autohuis Lemmerweg** (js/garage.js), de glazen showroom tegenover BP. E naast
een auto koopt hem: rode of gele Ferrari € 3.000 (soort `ferrari`, `RIJ` in js/vehicles.js: ruim
200 km/u), rode BX € 250. Hij staat dan op het voorterrein; de opslag neemt gekochte auto's mee
(`garage.bewaar`/`herstel`, `auto.eigen` in js/opslag.js). De Ferrari is een eigen model
(`sportGeoms` in js/carmodel.js, een geëxtrudeerd zijprofiel), geen `autoGeoms` met andere maten.
Sturen is op snelheid begrensd door de grip (`STUUR_GRIP` in js/vehicles.js, 26 m/s²; de Ferrari
50 via `RIJ.ferrari.grip`, en met de toetsen bouwt het stuur op snelheid in 0,3 s op, stap 106).

De drie woningen: **Zeskanter 16** (€ 5.000), **Molenkrite 130c** (€ 2.500),
**Koningsspil 20** (€ 1.000). Binnen: hoekbank met tv, eettafel om aan te zitten,
keuken met koelkast (bier = leven), twee katten, dichte ramen, tuin met terras,
schutting, schuurtje, **barbecue** (E → vlees → 28 leven), **radio op het
dressoir** (E aan/uit, zachter naarmate je verder weg staat, uit als je het huis
uit gaat) en naast de voordeur een **oprit** waar je auto blijft staan.

## 6 · Proeven en foto's

Er is één `npm run <naam>test` en meestal een `<naam>shots` per onderwerp; ze
staan allemaal in `tools/` en draaien via Playwright op een headless Chromium.
De laatste die ertoe doen: `npm run avondtest` (missie 18, de avond: de lijnen, de heli elke tiende seconde — boven
de daken, van de rand, naast Bouwman met de deur naar hem, rustig, de camera buiten de romp —, echte schoten uit de
deur, de luifel en het landen, de auto, de achtervolging en kwijtraken, het gevecht, de politie, het filmbeeld op de
brug, Zondagochtend, opnieuw per fase; stap 109) met `avondshots` (vijf foto's; stap 110 erbij: 01:00, taaie bodyguards en machinegeweren, een echt pistoolschot,
E en V in de heli, een andere auto, kogels, opnieuw bij de loods); `npm run tempotest` (de tussenpoos tussen de missies: in de code, het eerste klusaanbod en de rijtijd ernaartoe, stilstaan tijdens een klus, en per missie of hij na het telefoontje op je wacht; stap 108); `npm run uitzendingtest` (missie 18 van het telefoontje tot vrij spelen: de studio gemeten — de ingang aan de Tinga, de mast op het dak, de weg van de deur naar de tafel —, het fragment van 40,2 s, de deur dicht tot Johan belt, de stick en de schuif, de montage zonder camera in een muur, het einde, de titelrol, te laat, de opslag; stap 107) met `uitzendingshots` (zes foto's); `npm run vierpuntentest` (het sturen van de Ferrari gemeten tegen het oude, het schap van Tinga State met `getComputedStyle` en geen enkel hidden-element in beeld, de schuif van Bouwman na de klap tegen echte schuurtjes, 200 kogels bij een nieuw spel; stap 106); `npm run schottest` (het schot als opname: laden, vanaf de knal, per wapen, op afstand, afkappen in een salvo; doorschieten met en zonder vergrendelde muis en op de vuurknop, het pistool en de sniper één per klik, de keuze in het menu; stap 105); `npm run kaartdoeltest` (ondertitels in een filmbeeld: in de balk, contrast, niets eroverheen; plekken op de rand van de minikaart; een eigen doel op de grote kaart aanwijzen, bij een speldje, weghalen, de route over de weg en bijgewerkt, aankomen, geen schot; maakt drie foto's; stap 104); `npm run ronaldtest` (missie 17: het lint, het plan, de worst, het erf gemeten — kraakplek nooit in de kegel, de weg ernaartoe lopend soms vrij, de kegel boven de grond, niets in het water, de route van Ronald zonder knik —, sluipen, beide afloopen met de filmbeelden, het neergaan, de opslag; stap 103) met `ronaldshots` (zes foto's); `npm run overgangtest` (laden of een nieuwe missie tijdens het klokje en het zwart na missie 12, 14 en 16, met een tegenproef; `zetNeer` op een geparkeerde auto; missie 16 in zo'n auto; en vooraf, zonder browser, geen functienaam twee keer in js/verhaal.js en js/main.js; stap 102); `npm run invaltest` (missie 16 van Johan aan de lijn tot de ochtend: de drie minuten en te laat, leeghalen, de inval en zijn filmbeeld, de Wieken, beide keuzes, de hinderlaag met de vlucht over het dek en de rotonde, rammen, de crash, de telefoon, ontsnappen, Johan geraakt, wapen niet weg, de auto total loss, opslaan; stap 101) met `invalshots` (vijf foto's, vier filmbeelden); `npm run legendatest` (de legenda onderaan de grote kaart: acht regels, de bedragen tegen de modules, elk icoon in zijn kleur, niets afgekapt, geen speldjes over elkaar, smal scherm; maakt ook de foto; stap 100); `npm run klusjestest` (de klusjes: plekken binnen de rand, het aanbod, alle vier de soorten van aannemen tot betaald, een wachtende missie die stil staat en terugkomt, de pauze die niet aftelt, afbreken, mislukken, laden, de beloning; stap 99) met `klusjesshots` (vier foto's); `npm run bochtentest` (het verkeer, de politie en de lijnen van race en Bouwman door de bocht: gladde lijn, geen draai of sprong in één beeld, dwarsversnelling, remmen voor een scherpe bocht, keren; stap 98) met `bochtenshots` (twee foto's); `npm run schaduwtest` (missie 15 van het telefoontje tot de € 1.500:
de route, de loods, een automaat die volgt, te dichtbij, te ver, de Ferrari, de foto's, gezien
worden; stap 96) met `schaduwshots` (vijf foto's); `npm run racetest` (missie 14 van het telefoontje tot de € 2.000,
met een automaat die de Ferrari over het parcours rijdt, goed en slordig, het verliezen, de ring
op de rotonde, piepjes, vrij parcours, sturen, pauze en de ochtend erna; stap 93–95) met
`raceshots` (vijf foto's); `npm run garagetest` (de showroom aan de Lemmerweg: plek, glas, deur,
kopen, Ferrari-model en topsnelheid, opslaan; stap 92, 95) met `garageshots` (vier foto's) en
`ferrarishots` (het model los, drie foto's in een paar seconden); `npm run missietest` (ook de
wissel van de missiemuziek); `npm run schrifttest` (het einde van missie 12 en
missie 13; stap 91) met `schriftshots` (vier foto's); `npm run brugtest` (missie 12 van de M tot de € 5.000,
met de dekking achter een auto gemeten, 65 controles; stap 89) met `brugshots` (zeven foto's);
`npm run politieautotest` (missie 11, van de M tot de
€ 1.000, en of Mark echt zit) met `politieautoshots` (drie foto's; stap 88);
`npm run haperingtest` (de camera achter de auto, de
buren van een wegvak, de schaduw elk beeld tijdens het rijden; stap 87) met
`npm run rijprofiel` (geen proef: de zelftijd per functie terwijl je rijdt),
`npm run checkpointtest` (het checkpoint na een missie en de keuze na het
neergaan) en `npm run plattegrondshots` (woningen van bovenaf); `npm run vloeiendtest` (het aantal shaders dat three
tijdens het spelen erbij vertaalt — hoort nul te zijn — en de nacht; stap 83–85),
`npm run schaduwpastest` (de schaduwpas: bomen bij de
doos, lantaarns per tegel; tot stap 102 overschreven door die van missie 15) en `npm run nachttest` (plassen licht, lampen van de
auto's) met `nachtshots`, stap 82; `npm run lodtest` (LOD verder weg en vervagend,
het voorvlak, de intro voorbereid en met de LOD mee, het verkeer; stap 81),
`npm run autolodtest` (geparkeerde auto's en
voetgangers op afstand, treffers via `nummer`/`slotNaar`; stap 80) en
`wapenechttest` (ook de terugslag bij elk beeldtempo) met `terugslagshots`,
`npm run omgevingtest` (wind, water, riet, gras in
3D, hagen, ramen 's avonds; stap 79) met `omgevingshots`, `npm run groentest` (bomen, struiken, gras en de
driehoeken in beeld; stap 78) met `groenshots`, `npm run gebouwtest` (elke driehoek van de wereld:
muurrichting, uitgerekte en afgekapte doeken; stap 76), `wapenechttest` en
`autoechttest` en `mensechttest` (laden alleen de module, dus snel; stap 77
meet ook de ramen) met `gebouwshots` en
`echtshots`; `npm run cliptest`, `opstarttest` en `lichttest`
(clipping, opstarten en licht; stap 75), `npm run bendetest` (tweeëndertig controles, groen) en
`npm run bendeshots` (twee foto's), `npm run veteraantest` (tweeënzestig controles,
groen), `npm run veteraanshots` (vijf foto's), `npm run huistest`
(negenenzestig controles) en `npm run huisshots` (vijf foto's).

**Valkuilen van deze omgeving — hier is veel tijd in gaan zitten:**

- De container is sterk vertraagd. **Eén proef of fotoronde duurt 10 tot 30
  minuten.** Start hem op de achtergrond en zet er een Monitor op die filtert op
  `FOUT|fout$|alles goed|pageerror`; niet pollen.
- **De hoofdlus loopt headless nauwelijks.** Een proef moet zelf
  `verhaal.update(dt)` aanroepen, anders gebeurt er niets.
- **`dialoogTekst` houdt de laatste zin vast** nadat de balk verborgen is. Tel
  nooit door op `textContent` — kijk naar `document.getElementById('dialoog').hidden`.
  Twee lussen die dat wel deden drukten daarna dertig keer E: dat kocht een keer
  ongevraagd een huis en liet de speler een keer aan tafel zitten.
- **De audioklok loopt headless ongeveer drie keer trager.** Metingen aan geluid
  moeten lang genoeg zijn (tientallen stappen van 80 ms).
- **Gevels en reliëf komen na het opstarten.** Een proef die naar texturen,
  normal maps of roughness maps kijkt roept eerst `window.__game.reliëfAf()` aan.
- **Wat waait staat in `sfeerMaterialen().blad`** (js/world.js). Een nieuw
  bladmateriaal dat daar niet bij staat, staat stil.
- **De LOD draait headless niet vanzelf.** `updateLOD` zit in de hoofdlus; een
  foto of proef roept hem zelf aan, anders staan fijne en grove versies door
  elkaar in beeld. Zonder `{ zacht: true }` gaat hij meteen om (zo willen proeven
  en foto's het); de hoofdlus vervaagt, en een vervagende tegel draagt dan even
  een kópie van zijn materialen (`_bron` is het origineel).
- **Een instantie is geen nummer meer.** Geparkeerde auto's en voetgangers
  staan compact in hun meshes (stap 80): instantie `j` is `stapel.nummer(mesh, j)`
  of `npcs.slotNaar[j]`. Een proef die iemand wil raken gebruikt `hitPersoon`.
  En een instanced mesh waarvan de inhoud verschuift moet elk beeld
  `boundingSphere = null` krijgen: three rekent die bol bij de eerste raycast
  één keer uit, en daarna ging elke kogel langs de voetgangers (stap 85).
- **Een nieuw soort materiaal wordt vooraf vertaald** door `soortenVoorbereid`
  (js/world.js), achter het laadscherm. Een materiaal dat na het opstarten pas
  gemaakt wordt valt daarbuiten; `npm run vloeiendtest` ziet dat als een nieuw
  programma.
- **De schaduwpas telt alleen met `shadowMap.needsUpdate = true`.** js/main.js
  zet `autoUpdate` uit; een meting of foto die de schaduw wil zien zet hem zelf.
  De bomen werpen hun schaduw via `werkSchaduwBomenBij` (rond de schaduwdoos),
  niet via hun tegels.
- **Verander tijdens het spelen nooit het aantal zichtbare lichtbronnen** (stap 83).
  Three vertaalt dan élk materiaal opnieuw. Regel met `intensity`, niet met
  `visible`, en laat het aantal hoogstens bij zonsopkomst en zonsondergang
  veranderen. Wat nieuwe materialen maakt (de kopieën van het vervagen) moet ook
  met de avondlampen aan voorvertaald worden (`metAvondlampen`).
- **Werk dat aan de positie van de speler hangt is verdacht.** Rondkijken en lopen
  tekenen hetzelfde beeld; hapert alleen lopen, dan zit het in wat er bij het
  bewegen gebeurt (verhuizen, zichtlijnen, lampen).
- **`pgrep -f` en `pkill -f` vinden zichzelf.** Een wachtlus op een procesnaam
  eindigt nooit, en `pkill -f` met zo'n patroon schiet de eigen shell af (exit 144).
  Wacht op een regel in het log en stop processen op hun PID.
- **Een zelfgemaakt wegvak heeft `w` en `walkOff` nodig**, anders staat een
  voetganger op NaN. **Meerdere schoten achter elkaar vragen om een beeld
  ertussen**: de terugslag wordt per beeld gedempt.
- **Auto's zijn dekking, maar geen botsdoos** (stap 89). `zichtVrij` vraagt js/vehicles.js
  om `blokkeertZicht` (`zetZichtBlokker`): een auto houdt de kijklijn tegen, behalve
  als een eindpunt erin staat. Vijanden raken met een dobbelsteen zodra ze je
  zien; wie niet ziet, schiet niet.
- **Op het viaduct telt de hoogte altijd mee** (stap 90). `grondHoogte(x, z, y)` geeft
  onder het dek het maaiveld; wie iets neerzet met y = 0 of `-Infinity` (uitstappen,
  buit, een startpunt naast de oprit) zet het op de N7. Geef ook `resolveCollisions`
  en `zichtVrij(…, grondY)` de hoogte mee: de pijler onder het dek is een doos van 0
  tot 4,7 m over de hele breedte. Plekken voorbij de einden van het dek: `langsAs`.
- **Een auto naar het dek verplaatsen: eerst de hoogte.** `vehicles.zetNeer` peilt
  de grond vanaf `mesh.position.y`; een auto die van 0 m op het viaduct springt
  komt onder het dek op de N7 uit. Zet `mesh.position.y` eerst op dekhoogte.
- **Een gekochte auto heeft geen vaste plek in `vehicles.cars`** (stap 92). De opslag zoekt de auto
  waar je in zat op zijn index; voor een auto uit de showroom is dat `auto.eigen` en `garage.autoVan`.
  Topsnelheid en trek komen uit `RIJ[soort]` in `voegToe`, dus een auto die op de oprit teruggezet
  wordt is ook weer snel.
- **Niet elke rijbaan heeft een wegas** (stap 93). De hoofdweg ten zuiden van de rotonde
  bij de Lemmerweg is in de BGT een rijbaanvlak zonder as, dus de routeplanner
  (js/navigatie.js) neemt de smalle parallelweg ernaast. Een route voor iets dat hard
  moet (de race) altijd uittekenen en nameten; js/race.js meet dat stuk uit het vlak.
- **De hoofdlus roept `verhaal.update` ook aan als het spel stilstaat** (het zwart en het
  filmbeeld op het startscherm), maar niet in het pauzemenu (`gepauzeerd`, stap 95). Wat
  in een missie met de tijd loopt, hoort daar dus in; een eigen timer in js/main.js niet.
- **Een geëxtrudeerde vorm is groter dan zijn profiel** (stap 95): de afronding
  (`bevelSize`) legt er rondom plaat omheen. Koplampen verdwenen daardoor in de romp van
  de Ferrari, en zijn wielkasten zijn vijf centimeter krapper dan getekend.
- **Een melding blijft in de DOM staan** (`hud.melding`): alleen de doorzichtigheid gaat na
  een paar tellen naar nul. Een proef die op `#missie` naar "MISLUKT" kijkt, ziet dat daarna voor
  altijd; vang de melding zelf af (tools/schaduwtest.mjs `__misluktNu`).
- **`raceNaloop` ruimt de auto van Bouwman op** zodra je buiten missie 14 ver weg bent. Een
  missie die hem hergebruikt (15, 16, 17, 18) moet daar uitgezonderd zijn, anders verdwijnt hij onder het
  volgen. In stap 109 reed hij zo onzichtbaar onder de heli.
- **Een kogel in een proef raakt alleen wat zijn wereldmatrix heeft bijgewerkt** (stap 109). Headless tekent
  de lus niet, dus een auto die verplaatst is staat voor de straal nog op zijn oude plek: roep
  `scene.updateMatrixWorld(true)` aan vóór `player.shoot()` (tools/avondtest.mjs).
- **Shift met [, ] of \\ is een missie**, niet de klok (stap 97). js/sfeer.js zette met
  \\ de klok aan en schoof met [ en ] een uur op, ook met shift erbij: missie 15 starten zette
  de dag in vier minuten aan het lopen. Een nieuwe sneltoets: kijk of sfeer.js hem niet ook pakt.
- **Een instantie heeft geen mesh**: geparkeerde auto's staan in `vehicles.cars` maar zonder
  eigen `mesh`; wie op `c.mesh.visible` filtert ziet ze niet, `botsAutos` wel (stap 97: Bouwman
  reed door geparkeerde auto's heen, en de speler erachter botste ertegen). `vehicles.zetNeer` geeft
  zo'n auto sinds stap 102 zelf het losse model (`maakBestuurbaar`); daarvoor viel hij erop om.
- **De routeplanner kent geen rijrichting** (stap 97): rotondes nam hij de korte kant, met de
  klok mee. js/schaduw.js herkent rotondes aan een rijbaanvlak met een rond gat en geeft de ring
  één richting (alleen de stukken langs de ring; een in- of uitrit blijft twee kanten op, anders
  werd een uitrit doodlopend). De race gaat al goed over zijn rotonde.
- **De routeplanner kent geen hoogte** (stap 96). Het knooppunt van de Stadsrondweg op de
  Dúvelsrak ligt 5,6 m hoog, maar de Stadsrondweg-Zuid oostwaarts en de N7 liggen eronder en
  raken het dek in de plattegrond: een route reed van het dek zo die weg op. js/schaduw.js knipt
  assen door waar ze onder een open dek lopen; meet een route voor iets dat hem rijdt altijd met
  `grondHoogte` na (de lijn draagt `sprong`).
- **Het verkeer rijdt niet over de BGT-as maar over `gladPad(as)`** (stap 98): om de twee meter
  een monster, gladgestreken, met `raak` en `vmax`. `t.t` is een index in die gladde lijn, niet in
  de as; wie een auto op een as zet gebruikt `zetOp` (die zoekt het monster erbij). Een computer-
  bestuurder die `drive` gebruikt stuurt met `keys.stuur` (−1…1), niet met A/D: dat slingert.
- **De grond ligt niet overal op nul** (stap 103). Een erf ligt op 12 cm, gras op 4 (de `y` van de
  vlakken in de kaart). Iets plats op de grond (de kegel van missie 17) lag op 7 cm dus ónder het erf;
  js/schuur.js peilt de hoogte uit de vlakken (`grondPeiler`), en tools/ronaldtest.mjs meet het na met
  een straal recht naar beneden.
- **Een straatnaam is niet altijd een rijweg** (stap 107). "Tinga" is bij het pand van Radio Tinga een
  voetpad (`drive: false`); de rijweg met die naam ligt 75 m verder. Wie een plek "aan de X" zoekt,
  kijkt naar alle assen met die naam, en apart naar de dichtstbijzijnde weg voor auto's.
- **Een camera in een filmbeeld buiten kan in een schuurtje staan** (stap 107): Molenkrite 15 plus
  (14, 8) m was een tuinhuis. Zet hem op of langs de weg (`plekVoorDeDeur`), duw hem de botsdozen uit,
  en meet in de proef elk beeld (onder de 6 m; daarboven hangt hij boven de daken).
- **Kijk of een proefnaam al bestaat** (stap 106): `tools/puntentest.mjs` van 13 sep werd bijna
  overschreven door een nieuwe proef met dezelfde naam. Eerst `ls tools/` en `grep` in package.json.
- **`hidden` is niet hetzelfde als weg** (stap 106). Een id-selector met `display` (`#schap { display:
  flex }`) wint van de browserregel voor `[hidden]`: het schap stond na een bezoek aan Tinga State
  altijd in beeld, terwijl de proef `.hidden === true` zag. Geef zo'n element een eigen
  `#naam[hidden] { display: none }`, en meet in een proef met `getComputedStyle`.
- **Doorschieten hangt aan `player.vuurAan`** (stap 105). Dat ging alleen aan met een vergrendelde muis;
  slepen (geen vergrendeling) en de vuurknop op een aanraakscherm schoten één keer. Een nieuwe manier
  van vuren zet `vuurAan` aan en uit; `update` doet het doorschieten voor elk wapen met `auto`.
- **`position: fixed` maakt een eigen laag** (stap 104). `#ui` had geen z-index, dus lag hij op 0 en
  schoven de filmbalken (4) over het gesprek heen, ook al had `#dialoog` zelf z-index 5. Nu is `#ui`
  5; een nieuwe laag boven of onder de hud hoort tussen de filmbalken (4) en de overgang (6).
- **Een eigen doel (stap 104) loopt naast de missie**: js/main.js (`eigenDoel`, `werkEigenDoelBij`) rekent
  met een eigen `Navigatie` en zet `hud.zetEigenNav`; `hud.zetNavigatie` blijft van js/verhaal.js. Zolang
  de grote kaart open is, is de muis van de kaart (`player.kaartMuis`), niet van rondkijken en schieten.
- **Een filmbeeld van missie 16 zet zijn camera elk beeld** (`werkInvalFilmBij`, vóór de vroege returns
  van `update`) en houdt de speler of zijn auto vast (`invalFilm.vast`). Een foto van een filmbeeld leest
  `verhaal.inval.filmCam` en zet de camera via de speler (tools/invalshots.mjs), net als bij missie 12.
- **Een nieuwe winkel of plek op de kaart** (stap 100) levert `winkels` met een `wat` dat in
  `HUD.PICTO` en `HUD.PICTO_KLEUR` staat, en een regel in de legenda (js/main.js, `zetLegenda`)
  met zijn bedragen uit de module zelf; `npm run legendatest` kijkt of elk speldje een icoon heeft.
- **Een nieuwe missie met een wachtfase hoort in `KLUS_WACHT`** (stap 99), anders komt er
  daar geen klus; en een nieuwe `werk…Bij` van een missie die op je kan wachten hoort achter
  `!wachtOpKlus`, anders gaat hij tijdens een klus gewoon door.
- **js/verhaal.js is één groot bereik.** Een `function` met een naam die er al is
  overschrijft de andere stil (hoisting): in stap 89 namen `beginGevecht` en
  `naarDeC4` zo die van missie 10 en 11 over, en van stap 96 tot 102 reed missie 12 na het plan de
  avond van missie 15 in (`naarDeAvond`). `npm run overgangtest` kijkt er vooraf naar, zonder browser.
- **Een klokje na een missie** (`brugNaT`, `raceNaT`, `invalNaT`) en het zwart erna horen bij het
  laden en bij een nieuwe missie weg: `stopNaloop` (stap 102). Een nieuwe missie met zo'n klokje
  zet het daar bij, anders springt zijn ochtend in de volgende.
- **Een getter die een object teruggeeft is een momentopname** (`verhaal.brug`):
  lees hem na elke stap opnieuw, anders toets je een oude stand.
- **Het wapen staat op laag 1** en wordt apart getekend (`tekenWapen`); een eigen
  render van de scène laat het dus weg, tenzij de camera die laag aanzet.
- **Lege schermafdrukken** komen meestal doordat de camera niet bij de mensen
  staat of doordat NPC's hun positie uit `p.seg` herleiden; zet de camera en
  bevries npcs/voertuigen voor de foto.

**Wacht op de gebruiker:** de wapenmeldingen ("kogels doen geen schade na in/uit de
auto", en op 26 sep "vanaf de auto schieten schiet ik niemand meer neer") zijn in de
proef niet te reproduceren (`npm run wapentest`, ook vanuit de auto in beide camera's,
groen). Gevraagd: welk wapen, eerste of derde persoon, stilstaand of rijdend, zie je
het schot, reageren mensen?

## 7 · Wat er nog open staat

Kort; de volledige lijst met uitleg staat onderaan `docs/METHODIEK.md`.

1. 3D BAG-tegels aan de noordoostrand en aan de westkant van IJlst.
2. Wegblokkades aan de rand van de wereld (het mechanisme staat er, de plekken
   moeten van de gebruiker komen — **K** zet je positie op het klembord).
3. Steekproef van adressen: woningtype, goothoogte, voorgevelrichting.
4. Alleen bouwen wat in de buurt is. Het opstarten is van 72 naar 39 s headless
   (gevels en reliëf komen na het opstarten, stap 75); wat er nog zit zijn de
   gebouwen (13 s), het riet (5 s) en het eerste beeld (10 s).
5. Dakdetails en de achterkant van het Kruirad.
6. Straten zonder foto: Windbord, Voorzoom, Buitenroede 40–74, Zeskanter, Omloop.
7. De editor (F2) en de oude objecten uit `data.js` rekenen nog in pixels.
8. Koepeldaken en de 75 nieuwbouwwoningen zonder 3D-model.
9. Rechtenvrije muziek voor de autoradio (wat er staat is een plaatshouder).
10. De overzichtsbladen `docs/screenshots/objecten.png` en `woningtypen.png`.
11. Panden die nog het naamloze `spil`-type dragen (de school, de Ligger/Loper).
12. Onder de zuilengang door kunnen lopen, en een deur de Poiesz in.
13. `npm run relieftest` meet 343 MB texturegeheugen tegen een grens van 260 —
    al van vóór stap 75.
14. Belichting: echte SSAO (nu alleen omgevingsschaduw aan de voet van de muren,
    js/licht.js). Scherpere schaduw en de reflectie met de klok mee zijn af.
15. **Voorgevel de Vang**: alleen steen, geen deur of ramen (oude melding).
16. Dakkapellen: het doek van de voorkant wordt over de hele kapel uitgerekt
    (13 % van de kapeldriehoeken wijkt meer dan 1,8 keer af; gebouwtest).
17. De wapens van de NPC's (js/persoon.js) zijn nog de oude blokjes; alleen
    het wapen in je eigen hand is in stap 76 vernieuwd.
18. Voetgangers: sinds stap 80 geen lichaam verder dan 200 m, sinds stap 82 ook
    niet achter je (buiten 75° van de kijkrichting, verder dan 15 m). Een grove
    uitvoering op afstand is de volgende stap als het nodig is.
19. Molenkrite 130c: de tuindeur staat achter de hoekbank (de bank staat daar
    tegen de achterwand) en is niet te halen (`huistest`, de regel "tuindeur").
20. Wat een beeld op de grafische kaart kost is headless niet te meten
    (swiftshader). Sinds stap 87 loopt de schaduwpas rijdend elk beeld; hapert
    het op een zwakke kaart nog, dan is een kleinere schaduwkaart de eerste stap.
21. Een voetganger die aan het eind van zijn wegvak naar de overkant wisselt
    (`p.side *= -1` in `pickSegment`, js/npc.js) springt in één beeld tien tot
    twintig meter opzij. Hoort een oversteek te worden zoals `steek`.
22. `npm run bevolkingtest` is sinds stap 89 op één controle rood: rijdend over de
    Wieken één meting van 22 zonder mensen binnen 80 m. Gezocht (METHODIEK, stap
    89): het zit niet in één bestand, het neerzetten is chaotisch gevoelig.
23. `npm run missietest` is in deze container rood op alles waar de muziek echt moet
    spelen (zes controles, en de twee van stap 95 over de wissel): na 1,4 s staat het
    volume op 0,004. Met audio.js van vóór stap 95 precies dezelfde zes (27 sep 2026,
    nagemeten); het ligt aan het afspelen in deze omgeving, niet aan de code. Op een
    machine met geluid opnieuw draaien.
24. **Missie 18** staat er helemaal (stap 107 en 109). Uit het oude ontwerp niet gebouwd: de boot van
    Bouwman over de vaart en een wisseltoets tussen de deur en van buiten (de gebruiker koos de
    buitencamera). De ondertitels zijn samengevat uit de opdracht, niet woordelijk uit de mp3.

## 8 · Waar wat gedocumenteerd wordt

- `README.md` — voor de speler: wat er in het spel zit, per missie en per
  onderwerp, met schermafdrukken uit `docs/screenshots/`.
- `docs/METHODIEK.md` — voor de bouwer: per stap wat er gemaakt is, wat er
  misging en waarom het nu zo is. Elke ronde krijgt hier een blok, inclusief de
  fouten — dat is het nuttigste deel van het bestand.
