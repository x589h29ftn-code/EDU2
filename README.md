# Tinga Sneek – open-wereld FPS

Een GTA-achtig first-person spel dat zich afspeelt in de wijk **Tinga in Sneek**. De plattegrond is
overgenomen van de echte wijk: alle straten liggen op ware grootte en op de juiste plek ten opzichte
van elkaar, met de echte straatnamen, het groen, de vijvers, de parkeerhavens en de huizenrijen in de
stijl van de betreffende straat.

## Spelen

Het spel draait volledig in de browser en heeft geen build-stap. Omdat het ES-modules gebruikt, moet
het via een webserver geladen worden (niet via `file://`):

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
| Esc | muis vrijgeven |

## Straten in het spel

Molenkrite · Monnikmolen · Kruirad · Binnenroede · Buitenroede · Jasker · Molenpaal · Spinnekop ·
Omloop · De Wieken · Windbord · Voorzoom · Bovenas · Bonkelaar · het Tinga Parkje met vijver en de
N7 met afrit 21 aan de noordkant.

## Opbouw

- `index.html` – pagina, HUD en startscherm
- `js/data.js` – de kaart: wegen, water, groen en huizenrijen in pixelcoördinaten van de bronkaart
  (3.26 px per meter, oorsprong op het kruispunt Molenkrite/Monnikmolen/Jasker)
- `js/textures.js` – procedureel gegenereerde textures: baksteen, dakpannen, klinkers (grijs en rood
  keperverband), stoeptegels, asfalt, gras, water, heggen en complete gevels met ramen en deuren
- `js/world.js` – bouwt het straatprofiel (smalle rijbaan, trottoirband, grasberm met bomen en
  parkeerhavens, tegeltrottoir tegen de voortuinen), huizenrijen met daken, dakkapellen,
  schoorstenen en zonnepanelen, voortuinen met heggen, achtertuinen met schuttingen en schuurtjes,
  lantaarnpalen, straatnaamborden, kliko's en de speeltuin. Elke woning wordt vóór plaatsing
  getoetst op overlap met wegen, water en andere woningen; tuinen krijgen alleen de diepte die
  werkelijk beschikbaar is
- `js/player.js` – first-person besturing, botsingen en het pistool
- `js/vehicles.js`, `js/carmodel.js` – geparkeerde en bestuurbare auto's, verkeer op de N7 en in de wijk
- `js/npc.js` – voetgangers
- `js/hud.js` – straatnaambord, minimap, snelheid en munitie
- `lib/three.module.js` – Three.js r160 (lokaal meegeleverd)
- `tools/screenshot.mjs` – maakt testscreenshots met headless Chromium (Playwright)

## Bronnen

De geometrie is handmatig overgenomen van satelliet- en kaartschermafbeeldingen van de wijk en de
huisstijlen van streetview-foto's per straat (Molenkrite, Monnikmolen, Kruirad, De Wieken, Jasker,
Molenpaal, Bonkelaar).

## Screenshots

| Monnikmolen | Bonkelaar | Jasker | Kruirad |
|---|---|---|---|
| ![Monnikmolen](docs/screenshots/monnikmolen.png) | ![Bonkelaar](docs/screenshots/bonkelaar.png) | ![Jasker](docs/screenshots/jasker.png) | ![Kruirad](docs/screenshots/kruirad.png) |

| Overzicht vanaf Molenpaal | Kaart (toets M) |
|---|---|
| ![Overzicht](docs/screenshots/overzicht3.png) | ![Kaart](docs/screenshots/kaart.png) |

Testscreenshots maken (vereist Playwright en de meegeleverde Chromium):

```bash
python3 -m http.server 8123 &
node tools/screenshot.mjs 8123 shots
```
