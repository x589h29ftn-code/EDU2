# Tinga Sneek – open-wereld FPS

Een GTA-achtig first-person spel dat zich afspeelt in de wijk **Tinga in Sneek**. De plattegrond is
overgenomen van de echte wijk: alle straten liggen op ware grootte en op de juiste plek ten opzichte
van elkaar, met de echte straatnamen, het groen, de vijvers, de parkeerhavens en de huizenrijen in de
stijl van de betreffende straat.

## Spelen

Het spel staat online op GitHub Pages: **https://x589h29ftn-code.github.io/EDU2/**

Lokaal draaien kan ook. Het spel heeft geen build-stap, maar omdat het ES-modules gebruikt moet het
via een webserver geladen worden (niet via `file://`):

```bash
python3 -m http.server 8000
# open daarna http://localhost:8000/
```

Of gebruik een andere statische server (`npx serve`, VS Code Live Server, GitHub Pages).

| Toets | Actie |
|---|---|
| W A S D | lopen (shift = sprinten, spatie = springen) |
| muis | rondkijken · linkermuisknop = schieten · R = herladen |
| E | in- en uitstappen bij een auto |
| in de auto: W/S, A/D, spatie | gas/rem, sturen, handrem |
| M | grote kaart van de wijk met straatnamen |
| [ ] | klok een uur terug / vooruit · `\` laat de klok lopen (een dag in vier minuten) |
| Y | weer: helder, bewolkt, regen |
| U | geluid uit en aan |
| **F2** | wijkeditor: huizen verplaatsen en toevoegen |
| Esc | muis vrijgeven |

Op een telefoon of tablet verschijnt vanzelf touchbesturing: links een joystick om te lopen, rechts
vegen om rond te kijken, en knoppen voor vuren, springen, herladen, in-/uitstappen, de kaart en pauze.

## Windows-app en wijkeditor

Naast de webversie is er een Windows-app met dezelfde wereld, waarin je **zelf huizenrijen kunt
verplaatsen, draaien, toevoegen en verwijderen** en die wijzigingen naar schijf kunt opslaan.

```bash
npm install
npm run desktop      # meteen draaien (Windows, macOS of Linux)
npm run dist:win     # bouwt dist/Tinga-win32-x64/Tinga.exe
```

De GitHub-workflow **Windows-app** bouwt bij elke push een kant-en-klare zip; die staat onder
*Actions → de run → Artifacts*.

De editor werkt ook in de browser (F2), alleen kan die het bestand niet zelf wegschrijven en krijg je
`rows.user.js` als download. Alle toetsen en de werkwijze staan in **[docs/EDITOR.md](docs/EDITOR.md)**.

![De editor in acht stappen](docs/screenshots/editor-doorloop.png)

Met **T** wissel je tussen vijftien woningtypen:

![Alle woningtypen](docs/screenshots/woningtypen.png)

En met **O** ga je naar de objecten: carports, bergingen, aanbouwen, hagen en hekken, verkeersborden,
containers, speeltoestellen, bomen en zittende buren met een biertje — 60 stuks, nagebouwd naar
de street-viewfoto's van de wijk:

![Alle objecten](docs/screenshots/objecten.png)

## Dag, nacht en weer

De zon draait van oost naar west, met bijpassende kleuren voor licht, lucht en mist. Wordt het donker,
dan springen de straatlantaarns aan. Bij regen zakt het zicht van 900 naar 320 meter, wordt het water
dof en hoor je het op je jas.

![Dag, nacht en weer](docs/screenshots/sfeer.png)

Alle geluid is gesynthetiseerd met de Web Audio API, er zijn geen geluidsbestanden: wind, vogels
overdag en krekels 's avonds, regen, voetstappen die verschillen op klinkers, tegels en gras, een
motor waarvan de toonhoogte met de snelheid meeloopt, schoten, herladen en portieren. In de
voortuin van 19 Molenkrite staat een radio op een tafeltje die echt speelt: hoe dichter je erbij
staat, hoe harder je hem hoort.

## Straten in het spel

Molenkrite · Monnikmolen · Kruirad · Binnenroede · Buitenroede · Jasker · Molenpaal · Spinnekop ·
Omloop · De Wieken · Windbord · Voorzoom · Bovenas · Grootwiel · Bonkelaar · het Tinga Parkje met
vijver, zorgcomplex Tinga State en de N7 met afrit 21 aan de noordkant.

## Opbouw

- `index.html` – pagina, HUD en startscherm
- `js/data.js` – de kaart: wegen, kruispuntplateaus, water, groen en huizenrijen in pixelcoördinaten van de bronkaart
- `js/rows.user.js` – eigen huizenrijen uit de editor; staat dit bestand er, dan gaat het voor op `data.js`
- `js/editor.js` – de wijkeditor (F2): huizenrijen en objecten
- `js/props.js` – de objectenbibliotheek (carports, borden, speeltoestellen, zittende buren met een biertje, ...)
- `js/sfeer.js` – tijd van de dag, weer, wind, stromend water en straatverlichting
- `js/audio.js` – alle geluid, volledig gesynthetiseerd
- `tools/audit.mjs` – meet draw calls, geheugen en laadtijd door
- `js/touch.js` – touchbesturing voor telefoon en tablet
- `desktop/` – de Electron-schil voor de Windows-app
  (3.26 px per meter, oorsprong op het kruispunt Molenkrite/Monnikmolen/Jasker)
- `js/textures.js` – procedureel gegenereerde textures: baksteen, dakpannen, klinkers (grijs en rood
  keperverband), stoeptegels, asfalt, gras, water, heggen en complete gevels met ramen en deuren
- `js/world.js` – bouwt het straatprofiel (smalle rijbaan, trottoirband, grasberm met bomen en
  parkeerhavens, tegeltrottoir tegen de voortuinen), huizenrijen met daken, dakkapellen,
  schoorstenen en zonnepanelen, voortuinen met heggen, achtertuinen met schuttingen en schuurtjes,
  lantaarnpalen, straatnaamborden, kliko's, de speeltuin en de parkjes met slingerpad, bomen,
  struiken en bankjes. Elke woning krijgt een eigen voortuintje: de een met een ligusterhaag, de
  ander met een houten kruishekje, een rode berberishaag, een conifeer of gewoon gras met struiken,
  een grindvak of een sierboompje. Elke woning wordt vóór plaatsing getoetst op overlap met wegen,
  water, parken en andere woningen; tuinen krijgen alleen de diepte die werkelijk beschikbaar is
- `js/player.js` – first-person besturing, botsingen en het pistool
- `js/vehicles.js`, `js/carmodel.js` – geparkeerde en bestuurbare auto's, verkeer op de N7 en in de wijk
- `js/npc.js` – voetgangers als instanced meshes (honderddertig mensen kosten samen zeven draw calls)
- `js/hud.js` – straatnaambord, minimap, snelheid en munitie
- `lib/three.module.js` – Three.js r160 (lokaal meegeleverd)
- `tools/screenshot.mjs` – maakt testscreenshots met headless Chromium (Playwright)
- `.github/workflows/pages.yml` – publiceert `index.html`, `js/` en `lib/` naar GitHub Pages

## Bronnen

De geometrie is handmatig overgenomen van satelliet- en kaartschermafbeeldingen van de wijk en de
huisstijlen van streetview-foto's per straat (Molenkrite, Monnikmolen, Kruirad, De Wieken, Jasker,
Molenpaal, Bonkelaar).

## Screenshots

| Monnikmolen | Bonkelaar | Jasker | Kruirad |
|---|---|---|---|
| ![Monnikmolen](docs/screenshots/monnikmolen.png) | ![Bonkelaar](docs/screenshots/bonkelaar.png) | ![Jasker](docs/screenshots/jasker.png) | ![Kruirad](docs/screenshots/kruirad.png) |

| Parkje De Wieken | De Wieken | Molenkrite | Bovenas |
|---|---|---|---|
| ![Parkje](docs/screenshots/parkje.png) | ![De Wieken](docs/screenshots/dewieken.png) | ![Molenkrite](docs/screenshots/molenkrite.png) | ![Bovenas](docs/screenshots/bovenas.png) |

| Overzicht vanaf Molenpaal | Kaart (toets M) |
|---|---|
| ![Overzicht](docs/screenshots/overzicht3.png) | ![Kaart](docs/screenshots/kaart.png) |

Testscreenshots maken (vereist Playwright en de meegeleverde Chromium):

```bash
python3 -m http.server 8123 &
node tools/screenshot.mjs 8123 shots
```
