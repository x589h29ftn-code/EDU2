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
- **Ontwikkelen en pushen op de tak `claude/gta-tinga-game-setup-lcm1jy`.**
  Nooit een andere tak zonder dat het gevraagd is.
- **Pushen als de gebruiker het zegt.** "push" betekent pushen, **"Build"**
  betekent de Windows-app bouwen: `windows.yml` via `workflow_dispatch` op de
  werktak.
- **Geen afbeeldingsbestanden in het spel.** Elke textuur wordt op een canvas
  getekend (`js/textures.js` en de doek-functies boven in de modules). Bewuste
  uitzonderingen: de mp3's onder `audio/` en de laadschermen onder
  `beeld/laadscherm/`.
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
| `js/verhaal.js` | de tien missies, Mark, de gesprekken, de opslag van het verhaal |
| `js/kaart.js` | **gegenereerd**: panden, wegen, water, straten uit de geodata |
| `js/kaartwereld.js` | daar de wereld van bouwen (tegels, bomen, riet, auto's) |
| `js/textures.js` | alle geveltextures, dakpannen, baksteen — op canvas |
| `js/world.js` | botsingsdozen, `addCollider` / `resolveCollisions` |
| `js/interieur.js` | de woningen van binnen, inclusief tuin, radio en barbecue |
| `js/politie.js` | sterren, onderscheppen, wegversperring, helikopter |
| `js/vehicles.js` | geparkeerde auto's, verkeer, rijgedrag, `voegToe()` |
| `js/npc.js` | voetgangers en fietsers op wegvakken |
| `js/audio.js` | alles synthetisch, plus de mp3-radio; `autoradio(actief, sterkte)` |
| `js/hud.js` | minimap, grote kaart, meldingen, vlaggen |
| `js/bewaking.js` | schutters: bewaking, de bende van missie 7 en 10 (met opties) |
| `js/looppad.js` | een looproute te voet om hekken en gebouwen heen (A*) |
| `js/bendes.js` | na missie 10: groepjes van De Veteraan op straat in Tinga en langs de Lemmerweg |
| `js/deal.js` | missie 8, en `maakVeteraan()`: De Veteraan met zijn hondje |
| `js/wapen.js` | het wapen in je hand: afgeronde delen, eigen doeken, veer-terugslag, hulzen, grendel |
| `js/carmodel.js` | automodellen (gedeelde geometrie, instanced), lak met clearcoat, kenteken |
| `js/lichaam.js` | maten, onderdelen en doeken van alle mensen; `lichaamMat`, `doekVoor` |
| `js/groen.js` | bomen, struiken, gras: `bolGeo`, `stamGeo`, blad- en schorsdoek, `grasVariatie`, riet, `maakGrasVeld` (gras in 3D) |
| `js/licht.js` | omgevingsschaduw aan de voet van de muren (`grondAO`), verlichte ramen 's avonds (`nachtRamen`) |

Een paar dingen die niet vanzelf spreken:

- **Licht zit in de hoekpunten.** Er staan geen lampen in de scene; `schaduw(geo)`
  bakt de belichting in de vertexkleuren en dag/nacht gaat via materiaaltinten.
- **Binnenruimtes staan buiten de kaart.** Elke woning is een losse kamer ver
  buiten het gebied (`NUL`), met een "kijkdoos" van nagebouwde buren eromheen.
  De voordeur teleporteert. Daarom hoort alles wat je binnen ziet te kloppen met
  het adres, en zijn de ramen dichtgemaakt.
- **NPC's leven op wegvakken.** `p.seg` en `p.t` bepalen x/z, elk beeld opnieuw.
  Een handmatig gezette positie overleeft één beeld.
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
10. **De Veteraan** — de tas bij VV Sneek en de hinderlaag (laatst gebouwd)

Missie 9 in het kort: Mark belt, staat bij de Wieken 29, noemt drie adressen met
bedrag (**1, 2 of 3** kiest en zet de navigatie), en je koopt er aan tafel een
met E. Te weinig geld houdt het aanbod open; alle drie bekeken zonder kopen rondt
de missie af en laat het aanbod staan.

Missie 10 begint 45 s na het kopen: De Veteraan belt, staat met zijn hondje op
het fietspad bij De Terpensmole, stuurt je om een tas voor de tribune van VV
Sneek; bij het oppakken komen vier auto's met tien man naar het inritje aan de
Molenkrite, die via een looproute om de kantine heen komen. Daarna is hij weg,
belt Mark (omleggen, te snel in de rangen, ga naar huis) en is het thuis — het
gekochte huis — klaar voor € 250. **shift+0** start hem los.

Daarna hangen er groepjes van twee tot vier man van De Veteraan rond in Tinga en
langs de Lemmerweg (js/bendes.js): knuppel of pistool, aanvallen binnen 13 m,
achtervolgen, na een tijdje opgeven. Alleen buiten de missies om.

De drie woningen: **Zeskanter 16** (€ 5.000), **Molenkrite 130c** (€ 2.500),
**Koningsspil 20** (€ 1.000). Binnen: hoekbank met tv, eettafel om aan te zitten,
keuken met koelkast (bier = leven), twee katten, dichte ramen, tuin met terras,
schutting, schuurtje, **barbecue** (E → vlees → 28 leven), **radio op het
dressoir** (E aan/uit, zachter naarmate je verder weg staat, uit als je het huis
uit gaat) en naast de voordeur een **oprit** waar je auto blijft staan.

## 6 · Proeven en foto's

Er is één `npm run <naam>test` en meestal een `<naam>shots` per onderwerp; ze
staan allemaal in `tools/` en draaien via Playwright op een headless Chromium.
De laatste die ertoe doen: `npm run schaduwtest` (de schaduwpas: bomen bij de
doos, lantaarns per tegel) en `npm run nachttest` (plassen licht, lampen van de
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
`npm run bendeshots` (twee foto's), `npm run veteraantest` (zevenenveertig controles,
groen), `npm run veteraanshots` (drie foto's), `npm run huistest`
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
- **De schaduwpas telt alleen met `shadowMap.needsUpdate = true`.** js/main.js
  zet `autoUpdate` uit; een meting of foto die de schaduw wil zien zet hem zelf.
  De bomen werpen hun schaduw via `werkSchaduwBomenBij` (rond de schaduwdoos),
  niet via hun tegels.
- **Het wapen staat op laag 1** en wordt apart getekend (`tekenWapen`); een eigen
  render van de scène laat het dus weg, tenzij de camera die laag aanzet.
- **Lege schermafdrukken** komen meestal doordat de camera niet bij de mensen
  staat of doordat NPC's hun positie uit `p.seg` herleiden; zet de camera en
  bevries npcs/voertuigen voor de foto.

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

## 8 · Waar wat gedocumenteerd wordt

- `README.md` — voor de speler: wat er in het spel zit, per missie en per
  onderwerp, met schermafdrukken uit `docs/screenshots/`.
- `docs/METHODIEK.md` — voor de bouwer: per stap wat er gemaakt is, wat er
  misging en waarom het nu zo is. Elke ronde krijgt hier een blok, inclusief de
  fouten — dat is het nuttigste deel van het bestand.
