# Beelden voor het laadscherm

Het laadscherm laat een beeld uit de wijk zien terwijl de wereld wordt opgebouwd.
Zet hier je schermafdrukken neer en noem ze in `beelden.json`:

```json
{
  "beelden": [
    { "bestand": "molenkrite.jpg", "plek": "Molenkrite" },
    { "bestand": "rondweg.jpg",    "plek": "Lemmerweg" }
  ]
}
```

- **liggend**, het liefst 1920 × 1080 of groter — het beeld wordt beeldvullend
  geschaald en onderin komt een donkere band met de titel, een tip en de
  voortgangsbalk eroverheen;
- `.jpg` of `.png`; jpg op kwaliteit 80 is ruim genoeg en scheelt een paar
  honderd kilobyte per beeld;
- `plek` is optioneel en doet op dit moment niets in beeld; het staat er zodat
  duidelijk blijft waar een afdruk vandaan komt.

Is de lijst leeg, ontbreekt een bestand of gaat het ophalen mis, dan tekent
`js/menu.js` zelf een achtergrond op een canvas — een silhouet van de wijk bij
zonsondergang. Het spel start dus ook zonder dat hier iets staat.
