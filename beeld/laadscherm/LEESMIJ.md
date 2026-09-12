# Beelden voor het laadscherm

Het laadscherm en het startscherm laten hetzelfde beeld zien terwijl de wereld
wordt opgebouwd. Zet hier je afbeeldingen neer en noem ze in `beelden.json`:

```json
{
  "beelden": [
    { "bestand": "tinga_vi.jpg", "titel": "Tinga VI", "focus": "50% 10%", "zoom": 1.1 },
    { "bestand": "molenkrite.jpg", "plek": "Molenkrite" }
  ]
}
```

- **liggend**, het liefst 1920 × 1080 of groter — het beeld wordt beeldvullend
  geschaald en onderin komt een donkere band met de titel, een tip en de
  voortgangsbalk eroverheen;
- `.jpg` of `.png`; jpg op kwaliteit 80 is ruim genoeg en scheelt een paar
  honderd kilobyte per beeld;
- `titel` vervangt het woord TINGA onderin het laadscherm. Weglaten mag;
- `focus` is de CSS `background-position`: welk deel van het beeld in beeld
  blijft als het scherm een andere verhouding heeft dan de afbeelding. `50% 10%`
  houdt de bovenkant vast en snijdt onderaan weg, `50% 50%` snijdt boven en
  onder evenveel weg;
- `zoom` is hoever er in achtentwintig seconden ingezoomd wordt: `1.1` is tien
  procent. Dat is met opzet weinig — je moet het zien als je erop let en niet
  als je ernaar kijkt, net als op een echt GTA-laadscherm. Zet `1` om het beeld
  stil te zetten; wie in zijn systeem "beweging beperken" aan heeft staan krijgt
  sowieso een stilstaand beeld;
- `plek` is optioneel en doet niets in beeld; het staat er zodat duidelijk
  blijft waar een afdruk vandaan komt.

Staan er meer beelden in de lijst, dan komt er elke keer een ander in beeld (en
nooit twee keer achter elkaar hetzelfde).

Is de lijst leeg, ontbreekt een bestand of gaat het ophalen mis, dan tekent
`js/menu.js` zelf een achtergrond op een canvas — een silhouet van de wijk bij
zonsondergang. Het spel start dus ook zonder dat hier iets staat.

Let op: een beeld dat je hier neerzet gaat mee in de repository. Voor een
openbare versie hoort daar dus eigen of rechtenvrij werk te staan, net als bij
de muziek in `audio/radio/`.
