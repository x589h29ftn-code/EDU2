# Wijkeditor

Met de wijkeditor verplaats, draai, verwijder en plaats je zelf huizenrijen,
zonder de code aan te raken. Hij zit zowel in de browserversie als in de
Windows-app en gaat aan met **F2**.

## Wat is een rij?

De wijk bestaat uit *huizenrijen*. Elke rij is één lijnstuk op de kaart met
daaraan een blok woningen:

| veld | betekenis |
|---|---|
| `a`, `b` | begin- en eindpunt in kaartpixels (3,26 px = 1 meter) |
| `off` | afstand van de wegas tot de voorgevel, in meters. Positief = links van a→b, negatief = rechts |
| `depth` | diepte van de woningen in meters |
| `type` | woningtype, bepaalt steen, kozijnen, dak, dakkapel, aantal lagen |
| `flip` | gevel de andere kant op |

De rest — voortuinen, achtertuinen met schuttingen, schuurtjes, stoepen,
parkeerhavens, straatbomen — komt er automatisch bij. Verzet je een rij, dan
worden die opnieuw uitgerekend.

## Besturing

| toets | wat het doet |
|---|---|
| **F2** | editor aan / uit |
| W A S D | vliegen · shift = snel · Q en E omlaag en omhoog |
| linkermuisknop | rij kiezen waar het vizier op staat |
| Tab / shift+Tab | volgende / vorige rij |
| **G** | rij verplaatsen: hij volgt het vizier, klik om neer te zetten, Esc breekt af |
| pijltjes | 1 pixel verschuiven, shift = 5 |
| `[` `]` | draaien om het midden, 1° · shift = 5° |
| `,` `.` | dichter bij / verder van de weg (0,5 m · shift = 2 m) |
| `-` `=` | korter / langer (2 m · shift = 10 m) |
| `9` `0` | diepte kleiner / groter |
| **T** | volgend woningtype · shift+T vorige |
| **F** | gevel omdraaien |
| **N** | nieuwe rij van 30 m op het vizier |
| Delete | rij weghalen |
| Ctrl+D | dezelfde rij aan de overkant van de straat |
| Ctrl+Z | ongedaan maken (60 stappen) |
| **Ctrl+S** | opslaan naar `js/rows.user.js` |
| Ctrl+E | alle rijen naar het klembord |
| Ctrl+Alt+R | lokale wijzigingen wissen en terug naar de originele kaart |

Tijdens het bewerken zijn voetgangers en verkeer even uit; ze komen terug als
je de editor sluit.

## Waar blijven je wijzigingen?

1. **Tijdens het werken** in de opslag van de browser. Sluit je het venster,
   dan staat alles er de volgende keer nog.
2. **Met Ctrl+S** in `js/rows.user.js`. Dat bestand krijgt bij het opstarten
   voorrang boven de rijen in `js/data.js`; de originele kaart blijft dus
   ongemoeid. Verwijder `rows.user.js` om terug te vallen op het origineel.

In de **Windows-app** schrijft Ctrl+S het bestand meteen naar schijf (met een
`.bak` van de vorige versie). In de **browser** kan dat niet: daar krijg je
`rows.user.js` als download en zet je hem zelf in de map `js/`.

## Woningtypen

`molenkrite`, `molenkrite_bung`, `monnik`, `kruirad`, `molenpaal`,
`jasker_flat`, `jasker_gable`, `wieken_white`, `wieken_yellow`, `bonkelaar`
(twee onder één kap), `detached` (vrijstaand), `appart` (drie lagen),
`bovenas_bung`, `bovenas_gal`, `spil`.

Ze staan in `js/textures.js` in `HOUSE_STYLES`; daar pas je steenkleur,
kozijnkleur, deurkleuren, dakpannen, aantal lagen, dakkapel, dakraam,
zonnepanelen en schoorsteen aan.

## Waarom verdwijnt er soms een woning?

Een rij wordt per woning geplaatst. Botst een woning met een weg, met water,
met een bosschage of met een andere woning, dan wordt hij overgeslagen. In de
console zie je dan bijvoorbeeld:

```
rij 49 wieken_yellow [102,1422]-[148,1439] off -10: 3/3 woningen weggelaten (botsing)
```

Meestal betekent dat `off` te klein is (de rij staat op de weg) of dat er al
een andere rij staat. Met `.` schuif je hem verder van de weg af.

Wil je weten hoeveel voor- en achtertuin een rij overhoudt en wat de ruimte
opeet, zet dan in de console `globalThis.__gprobe = true` en herlaad.

## Windows-app zelf bouwen

```
npm install
npm run desktop      # meteen draaien
npm run dist:win     # dist/Tinga-win32-x64/Tinga.exe
```

Of laat GitHub het doen: de workflow **Windows-app** bouwt bij elke push een
zip die je onder *Actions → de run → Artifacts* kunt downloaden.

Zet de uitgepakte map ergens waar je zelf mag schrijven (bureaublad of
Documenten, niet in Program Files), anders kan Ctrl+S `rows.user.js` niet
wegschrijven.
