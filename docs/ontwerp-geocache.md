# Ontwerp: Tinga Cache (geocachen) — gebouwd in stap 196

Gevraagd op 15 okt 2026: "Optie 5 doe dit als een geocache. Bedenk hier eerst een systematiek voor. Vaak een raadsel en dan
coördinaten. En dan moet je op een gps tracker de locatie kunnen vinden. Misschien niet exact want dan is het makkelijk maar kleine
radius. … Bedenk ook hoe dit start. Het is puur een extra activiteit. … gps tracker kopen bij de bp, 250 euro … raadsels via Ronald
… of kies iemand anders. … hoe geocache werkt met opdrachtjes. Moet ook bekend zijn dat er 5 in de wereld zitten."

Gekozen (15 okt): Sjors, de gouden M1 Garand en € 2.500, de plekken zoals hieronder; de medewerker van de BP verwijst naar Sjors,
de poster ook op een prikbord bij Radio Tinga en op de eettafel thuis. De GPS is N (G was al de scherpte). Gebouwd in js/geocache.js.

## 1 · Wie: Sjors van Radio Tinga (in plaats van Ronald)

Ronald past slecht: hij is "R.", die Mark en Erik verraadt (missie 16–17), en na missie 17 kan hij weggerend zijn
(`ronaldWeg`). Hij zou dan in de ene opslag wel en in de andere niet bestaan.

**Sjors**, de dj van Radio Tinga, staat al in het spel, is in elke afloop een bondgenoot (missie 18), en zijn studio is ook een
school met een stoep, waar de R van Roan al staat. Een dj die op zondagochtend geocacht en raadsels voorleest is geloofwaardig, en
het geeft Radio Tinga een rol: na elke gevonden cache noemt hij je naam op de radio.

(Kan ook: Erik Jan, de regisseur van No Mercy, of Johan.)

## 2 · Hoe het begint

- Vanaf **na missie 5** (zoals de andere bijmissies), en altijd in vrij spelen. Nooit tijdens een missie: niets belt, niets
  neemt de navigatie over (de les van stap 193).
- In de **BP-shop** hangt bij de kassa een poster: *"TINGA CACHE — vijf caches verstopt in Tinga en IJlst. Vind ze alle vijf.
  GPS te koop aan de kassa, € 250. Vraag Sjors bij Radio Tinga."* De kassa (js/bpkassa.js) krijgt **3 = GPS (€ 250)**.
- Met de GPS staat er een **S** op de kaart bij de stoep van Radio Tinga. E bij Sjors: hij legt het uit en geeft cache 1.
- Het **aantal is altijd zichtbaar**: op de poster, bovenin de GPS ("Tinga Cache 2/5"), in het pauzemenu bij de
  statistieken en in de titelrol ("Caches: 2 van 5").

## 3 · De GPS (G)

Een handapparaat rechtsonder in beeld (getekend op canvas, geen plaatje), aan en uit met **G** (vrij: de drone heeft B):

```
 ┌──────── TINGA CACHE 2/5 ────────┐
 │ JIJ    N 53° 01.254  E 005° 38.612│
 │ DOEL   N 53° 01.3__  E 005° 38.7__│   ← nog in te vullen
 │        ↗  186 m   ± 4 m           │
 │ [1-9,0 cijfers]  [E bevestig]     │
 └───────────────────────────────────┘
```

- **Coördinaten** zoals echte geocachers ze schrijven (graden en minuten met drie decimalen, WGS84), omgerekend uit de kaart: die
  kent zijn oorsprong in graden (`KAART.oorsprong.wgs84` = 53,020904 N, 5,643757 O). Eén duizendste minuut is ~1,85 m noord-zuid
  en ~1,1 m oost-west: precies genoeg.
- **Je eigen plek** staat er altijd, met ±3–5 m schommeling, zoals een echte GPS.
- **Het doel invullen** doe je met de cijfertoetsen terwijl de GPS open is (dan zijn 1–9 en 0 van de GPS, niet van keuzes).
  Is het doel ingevuld, dan geeft de GPS een **pijl en een afstand**, nooit een speldje op de kaart.
- **Niet exact**: de cache ligt **binnen 6 m** van het punt uit het raadsel, op een vaste plek per cache. Vanaf 15 m zegt de GPS
  "dichtbij — zoek!", de pijl begint te zwalken en je moet zelf kijken: onder een struik, achter een paaltje, bij een bankje. Op
  1,5 m: "E — cache openen".
- Een verkeerd ingevuld doel wijst gewoon ergens anders heen, en daar ligt niets. Na twee keer mis geeft Sjors (E bij hem, of
  via de GPS "hint") een duwtje.

## 4 · De vijf caches (oplopend in moeilijkheid)

Elke cache is een ander soort, zoals bij echt geocachen. In elk logboek staat **een letter**; de vier letters samen zijn de sleutel
van de vijfde.

| # | Soort | Hoe | Waar (voorstel) |
|---|---|---|---|
| 1 | **Traditional** | Sjors geeft de coördinaten gewoon: leren werken met de GPS | onder het landhoofd van de oude Geeuwbrug, tussen de graffiti |
| 2 | **Mystery** (raadsel) | de cijfers zijn antwoorden uit de wereld: kijk zelf. Bijv. A = het huisnummer van Mark, B = het laatste cijfer van het jaar op de gedenksteen aan de Sudergoweg (1944 → 4), C = het aantal zuilen van de zuilengang bij de Poiesz | bij de speeltoestellen of de vijver in Duinterpen |
| 3 | **Multi** (in stappen) | op het eerste punt hangt een bordje met een getal (op canvas); dat getal maakt het tweede punt af | stap 1 bij Martens Vishandel, stap 2 achter de tennishal |
| 4 | **Opdracht** | de cache is alleen te halen met een opdracht: **met de boot** (hij hangt aan een steiger die je alleen vanaf het water bereikt) of **met de drone** (het laatste getal staat op een plat dak) | aan het water in IJlst, bij de molen De Rat |
| 5 | **Finale** | de vier letters uit de logboeken vormen een woord; dat woord is het antwoord op Sjors' laatste raadsel en geeft de laatste coördinaten | bij de Tiger aan de Sudergoweg |

**Een cache openen**: een klein figuurtje (munitiekistje, filmbusje, tupperware op canvas) op een vaste plek. E opent hem: je
tekent het logboek (melding "Gelogd: cache 2/5 — letter K"), Sjors meldt het op Radio Tinga ("de cache bij de vijver is gevonden
door Erik!") en de volgende ligt klaar.

## 5 · Beloning en afronding

- Per cache een klein bedrag (€ 100–300) en de letter; de laatste geeft **€ 2.500** en een **eigen item**, bijvoorbeeld een gouden
  pompgeweer of een "Tinga Cacher"-pet op Erik in de derde persoon.
- Op Radio Tinga een **opgedragen nummer** voor Erik.
- In de statistieken en de titelrol: **"Caches: 5 van 5"**.

## 6 · Bouwkundig (als we het bouwen)

- `js/geocache.js`: de vijf caches als gegevens (punt, verschuiving binnen 6 m, soort, raadseltekst, letter, beloning), de
  omrekening kaart ↔ graden, de GPS-staat, het openen. Geen missie: `missie` blijft wat hij is, net als de klusjes; tijdens een
  missie werkt het gewoon door, maar niets begint vanzelf.
- js/bpkassa.js: 3 = GPS € 250 (`player.gps`), de poster in js/bpwinkel.js.
- js/verhaal.js: Sjors op de stoep (een eigen figuur zoals de praatjes van stap 192), E = uitleg of hint.
- Opslag: welke caches gevonden, het ingevulde doel, de letters, `player.gps`.
- Proef `geocachetest`: elke cache op een bereikbare plek (te voet, of met de boot of drone waar dat moet), niet in een botsdoos
  of in het water, de raadselantwoorden kloppen met wat er in de wereld staat, de omrekening op een paar bekende punten (de oorsprong,
  Molenkrite 15) tegen de echte coördinaten, de GPS-pijl, verkeerd invullen, opslaan, de finale. Foto's: de GPS in beeld, een
  cache onder een struik.

## 7 · Open vragen voor de gebruiker

1. Sjors akkoord, of toch Ronald / iemand anders?
2. De beloning van de finale: geld, een gouden pompgeweer, een pet, of iets anders?
3. De vier plekken en raadsels hierboven goed, of zijn er plekken die voor jullie iets betekenen?
