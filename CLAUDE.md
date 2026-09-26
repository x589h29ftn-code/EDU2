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
| `js/verhaal.js` | de negen missies, Mark, de gesprekken, de opslag van het verhaal |
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

Een paar dingen die niet vanzelf spreken:

- **Licht zit in de hoekpunten.** Er staan geen lampen in de scene; `schaduw(geo)`
  bakt de belichting in de vertexkleuren en dag/nacht gaat via materiaaltinten.
- **Binnenruimtes staan buiten de kaart.** Elke woning is een losse kamer ver
  buiten het gebied (`NUL`), met een "kijkdoos" van nagebouwde buren eromheen.
  De voordeur teleporteert. Daarom hoort alles wat je binnen ziet te kloppen met
  het adres, en zijn de ramen dichtgemaakt.
- **NPC's leven op wegvakken.** `p.seg` en `p.t` bepalen x/z, elk beeld opnieuw.
  Een handmatig gezette positie overleeft één beeld.
- **De wijk slaapt 's nachts** (stap 73). `sfeer.drukte` (1 overdag, 22:30→23:30
  naar 0,16, 05:00→06:30 terug) schaalt het aantal mensen en auto's;
  `sfeer.lampenAan` dooft na middernacht tweederde van de lantaarns in
  woonstraten (twee stapels koppen, `MAT.lamp` en `MAT.lampNacht`). De drie
  straatlampen zijn een vaste pool in js/sfeer.js (`zetLampen`), nooit aan/uit.
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
9. **een eigen stek** — drie woningen kopen (laatst gebouwd)

Missie 9 in het kort: Mark belt, staat bij de Wieken 29, noemt drie adressen met
bedrag (**1, 2 of 3** kiest en zet de navigatie), en je koopt er aan tafel een
met E. Te weinig geld houdt het aanbod open; alle drie bekeken zonder kopen rondt
de missie af en laat het aanbod staan.

De drie woningen: **Zeskanter 16** (€ 5.000), **Molenkrite 130c** (€ 2.500),
**Koningsspil 20** (€ 1.000). Binnen: hoekbank met tv, eettafel om aan te zitten,
keuken met koelkast (bier = leven), twee katten, dichte ramen, tuin met terras,
schutting, schuurtje, **barbecue** (E → vlees → 28 leven), **radio op het
dressoir** (E aan/uit, zachter naarmate je verder weg staat, uit als je het huis
uit gaat) en naast de voordeur een **oprit** waar je auto blijft staan.

## 6 · Proeven en foto's

Er is één `npm run <naam>test` en meestal een `<naam>shots` per onderwerp; ze
staan allemaal in `tools/` en draaien via Playwright op een headless Chromium.
De laatste die ertoe doen: `npm run huistest` (missie 9 en de woningen),
`npm run huisshots` (vijf foto's) en `npm run vloeiendtest` (beeldtijden en het
aantal shaders dat three erbij vertaalt — dat laatste hoort nul te zijn).

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
- **Lege schermafdrukken** komen meestal doordat de camera niet bij de mensen
  staat of doordat NPC's hun positie uit `p.seg` herleiden; zet de camera en
  bevries npcs/voertuigen voor de foto.
- **Een zelfgemaakt wegvak heeft `w` en `walkOff` nodig.** js/npc.js rekent de
  afstand tot de as uit met `s.walkOff || s.w / 2 + 0.8`; zonder die velden wordt
  dat NaN en staat de voetganger nergens.
- **Meerdere schoten achter elkaar vragen om een beeld ertussen.** De terugslag
  wordt in `player.update` gedempt; vuur je in één keer acht keer, dan stapelt hij
  op tot ruim tien graden en mis je alles.
- **`pgrep -f` vindt zichzelf.** Een wachtlus als
  `until ! pgrep -f "node tools/x.mjs"` staat zelf met die tekst in de
  proceslijst en eindigt dus nooit; en `pkill -f` met zo'n patroon schiet de
  eigen shell af (exit 144). Wacht op een regel in het log
  (`until grep -q "het oordeel" log`) en stop processen op hun PID.
- **Absolute tijden zeggen hier niets** (één beeld duurt ~3,5 s). Meet
  aantallen: shaderprogramma's, draw calls, driehoeken, en de verhouding
  tussen javascript-posten. `node tools/optimeer.mjs 8123` geeft per klasse
  (auto's, bomen, gevels …) calls en driehoeken op vier standpunten, en de
  kosten van de javascript per beeld.

**Twee regels die uit stap 73 komen en overal gelden:**

- **Verander tijdens het spelen nooit het aantal zichtbare lichtbronnen.** Three
  vertaalt dan élk materiaal opnieuw. Regel met `intensity`, niet met `visible`,
  en laat het aantal hoogstens bij zonsopkomst en zonsondergang veranderen.
- **Werk dat aan de positie van de speler hangt is verdacht.** Rondkijken en
  lopen tekenen hetzelfde beeld; hapert alleen lopen, dan zit het in wat er bij
  het bewegen gebeurt (verhuizen, zichtlijnen, lampen).

**En uit stap 74:**

- **Een InstancedMesh met instanties op schaal nul kost nog steeds al zijn
  hoekpunten.** De GPU rekent ze allemaal door. Zet wat je wilt tekenen vooraan
  en regel het met `mesh.count` (de geparkeerde auto's doen dat nu:
  `vehicles.herschik(stap)`). De boundingsphere één keer op het volle aantal
  uitrekenen, anders valt de mesh verkeerd buiten beeld.
- **Periodiek werk verdelen over de beelden.** `updateLOD(x, z, deel)` loopt
  met een wijzer telkens een vijftiende van de groepen door in plaats van alles
  om de kwart seconde; zo'n piek eens in de zoveel beelden is precies een
  hapering.

## 6b · De lopende ronde (stap 74): optimalisatie en kwaliteit

Gevraagd: "neem de wereld verder door op optimalisatie en kwaliteit". Wat er
in deze ronde veranderd is — **nog niet alles is door de proef gegaan**, dus
begin met `npm run vloeiendtest` (en daarna `node tools/optimeer.mjs 8123`):

| Wat | Waar | Proef |
|---|---|---|
| Omgevingsmap (PMREM) opnieuw gebakken als lucht of weer wezenlijk verandert; zelfde doelmaat, dus geen hervertaling | `bakOmgeving` in js/main.js, sleutel onderaan `pasToe()` in js/sfeer.js | vloeiendtest "de omgevingsmap" |
| Geparkeerde auto's: alleen de getekende (≤170 m, zichtbaar, niet bestuurd) staan vooraan in de stapel, `count` = dat aantal. Was 1,2 miljoen driehoeken per beeld | `wilSlot`/`herschik`/`zetInstantie` in js/vehicles.js, `teken(n)` in js/carmodel.js | vloeiendtest "de geparkeerde auto's" |
| Fout gevonden en hersteld: `verf()` zocht de stapel op `car.inst.soort` in plaats van `sleutel`, dus overspuiten van een geparkeerde auto deed niets | js/vehicles.js | idem |
| LOD-ronde elk beeld een vijftiende in plaats van alles per 0,25 s | `updateLOD` in js/world.js, aanroep in js/main.js | optimeer |
| Boomstammen zonder deksels (helft van hun driehoeken) | `buildTrees` in js/world.js | optimeer |
| Voetgangers: houding boven 60 m om het beeld, boven 140 m om de vier; lichaamsdraai één keer per persoon i.p.v. per deel. `p.getekend = false` bij verhuizen dwingt tekenen af | `update`/`zetLichaam` in js/npc.js | vloeiendtest "de voetgangers ver weg" |

Nog te doen in deze ronde: de proeven groen krijgen, meten wat het scheelt,
het blok "stap 74" in `docs/METHODIEK.md` aanvullen met de getallen, en een
foto van de Vang (open punt 14 — waarschijnlijk al opgelost door de
GOOT_MIN-fix van 19 sep; alle zestien woningen daar hebben een 3D-model).
Volgende kandidaten: de gevels (615 draw calls voor 29.000 driehoeken, dat
vraagt een textuuratlas — eerst aan de gebruiker voorleggen) en de struiken.

**Wacht op de gebruiker:**

- **Missie 10 — nog geen keuze.** Voorgesteld: **"Een wederdienst"**. De
  Veteraan (tot nu toe alleen een naam; Mark praat namens hem) belt voor het
  eerst zelf, kort na de aankoop: *"Sleutelgeld is sleutelgeld. Maar een huis in
  Tinga krijg je niet voor niets, broeder."* Etappes: (1) met een auto een
  sporttas ophalen bij de RWZI, Buitenroede 1 — te voet zegt de man "waar is je
  auto?"; (2) thuis de auto op je oprit, zonder sterren (aangehouden = tas kwijt,
  etappe opnieuw), tas met E in het schuurtje; (3) op je bank zitten, beeld
  doezelt weg, ochtend; (4) politieauto in de straat, Mark: "niet de voordeur
  uit" — alleen in deze missie gaat een poort in de achterschutting open, achter
  het achterpad staat een tweede auto; (5) afleveren bij de molen, De Veteraan
  voor het eerst in beeld. Beloning: geld, en het schuurtje wordt je
  **bergplaats** (wat je er neerlegt blijft liggen). Nieuw te bouwen: tas als
  prop, poort in de schutting, overgang avond→ochtend, schuurtje als opslag, De
  Veteraan als personage. Alternatieven: **"De inwijding"** (Mark en Johan
  komen langs, bier bij de Poiesz, barbecue, iemand komt over de schutting) en
  **"De verhuizing"** (bestelbus, drie ritten van de Wieken 29 naar je huis;
  wild rijden = spul valt uit de laadbak).
- **De wapenmelding** ("kogels doen geen schade na in/uit de auto") is in de
  proef niet te reproduceren (`npm run wapentest`, sectie 5, groen). Gevraagd:
  welk wapen, eerste of derde persoon, zie je het schot, reageren mensen?

## 7 · Wat er nog open staat

Kort; de volledige lijst met uitleg staat onderaan `docs/METHODIEK.md`.

1. 3D BAG-tegels aan de noordoostrand en aan de westkant van IJlst.
2. Wegblokkades aan de rand van de wereld (het mechanisme staat er, de plekken
   moeten van de gebruiker komen — **K** zet je positie op het klembord).
3. Steekproef van adressen: woningtype, goothoogte, voorgevelrichting.
4. Alleen bouwen wat in de buurt is (nu wordt de hele wereld bij het starten
   opgebouwd, ~31 s headless).
5. Dakdetails en de achterkant van het Kruirad.
6. Straten zonder foto: Windbord, Voorzoom, Buitenroede 40–74, Zeskanter, Omloop.
7. De editor (F2) en de oude objecten uit `data.js` rekenen nog in pixels.
8. Koepeldaken en de 75 nieuwbouwwoningen zonder 3D-model.
9. Rechtenvrije muziek voor de autoradio (wat er staat is een plaatshouder).
10. De overzichtsbladen `docs/screenshots/objecten.png` en `woningtypen.png`.
11. Panden die nog het naamloze `spil`-type dragen (de school, de Ligger/Loper).
12. Onder de zuilengang door kunnen lopen, en een deur de Poiesz in.
13. Belichting: ambient occlusion en scherpere schaduw dichtbij (de
    omgevingsreflectie met de klok mee is in stap 74 gedaan).
14. **Voorgevel de Vang**: alleen steen, geen deur of ramen (oude melding).

## 8 · Waar wat gedocumenteerd wordt

- `README.md` — voor de speler: wat er in het spel zit, per missie en per
  onderwerp, met schermafdrukken uit `docs/screenshots/`.
- `docs/METHODIEK.md` — voor de bouwer: per stap wat er gemaakt is, wat er
  misging en waarom het nu zo is. Elke ronde krijgt hier een blok, inclusief de
  fouten — dat is het nuttigste deel van het bestand.
