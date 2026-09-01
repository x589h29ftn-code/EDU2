# Grand Party Auto — Sneek 🎉

Een first-person open-world verjaardagsspel in GTA-stijl, dat zich afspeelt in
de binnenstad van **Sneek**. De jarige is de hoofdpersoon: loop door de
Waterpoort de stad in, "leen" een auto, vaar... eh, rij langs de grachten en
verken de stad. De missies/spellen volgen binnenkort.

## Starten op Windows

1. Download deze map (of clone de repository).
2. Dubbelklik op **`Start Spel.bat`** — of open `index.html` rechtstreeks in
   Chrome of Edge.
3. Vul de naam van de jarige in en klik op **Start het feest!**

Er is geen installatie nodig en het spel werkt volledig offline
(Three.js zit meegeleverd in `lib/`).

## Besturing

| Toets | Actie |
|---|---|
| W A S D / pijltjes | lopen of rijden |
| Muis | rondkijken |
| Shift | sprinten |
| Spatie | springen (te voet) / handrem (in de auto) |
| E | auto in- en uitstappen |
| R | claxon |
| Esc | pauze |

## Wat is er nagebouwd?

- **De Waterpoort** over de stadsgracht bij de Kolk (met zeilbootjes — Sneekweek!)
- De **stadsgracht** rondom de binnenstad (met de brede **Kolk** bij de Waterpoort), zes bruggen en rondvarende bootjes
- **Grootzand** (met een spandoek voor de jarige!), **Kleinzand** mét kanaal
  en bootjes, **Marktstraat** met terrasjes, **Oosterdijk**, **Wijde/Nauwe Burgstraat**,
  **Kruizebroederstraat**, **Gedempte Pol**, **Leeuwenburg**, **Singel**, **Suupmarkt**, **Oude Koemarkt**, **Zuidend**, **Kerkgracht**, **Prins Hendrikkade**, **Harinxmakade** en **Bothniakade** — de plattegrond volgt de echte kaart van het centrum
- Het **Stadhuis** (rococo-gevel) aan de Marktstraat
- De **Martinikerk** op de terp
- Het **Fries Scheepvaart Museum** aan het Kleinzand
- **Schaapmarktplein** en **Oud Kerkhof** met terrasjes, parasols en gasten
- **Sint-Martinuskerk** (RK) aan de oostkant en **Theater Sneek** + parkeerterrein **P-zuid Waterpoort** buiten de gracht
- Winkelstraten met trap-, klok- en tuitgevels, dakpannen, dakkapellen, vlaggetjes, fietsen, wandelende en zittende mensen (met echte loopanimatie),
  geparkeerde auto's met gele kentekens (instappen met E!) en verkeer dat over de Singel-route en de uitvalswegen rijdt

Onder in beeld zie je steeds de naam van de straat waar je bent; linksonder
staat de plattegrond van Sneek.

O ja: rijd voorzichtig. Wie voetgangers omver rijdt krijgt de politie
achter zich aan... 👮

## Techniek

- HTML5 + [Three.js](https://threejs.org/) (r149, meegeleverd in `lib/`)
- Eén statische pagina, geen dependencies of build-stap
- `game.js` bevat de volledige stad (datagedreven plattegrond), de
  first-person besturing, autofysica, voetgangers, politie en audio
  (WebAudio, zonder geluidsbestanden)
