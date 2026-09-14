# Waar het spel heen kan

Dit is geen verslag maar een plan: wat er nog niet in zit, waarom het de moeite
waard is, en in welke volgorde het het meeste oplevert. Wat er wél in zit staat
in [README.md](../README.md); hoe de wereld gebouwd is in
[METHODIEK.md](METHODIEK.md), met onderaan een lijst *wat nog niet af is* — dat
zijn de openstaande punten van de kaart. Dit gaat over het spel.

De volgorde binnen elk stuk is die van opbrengst per uur werk: wat bovenaan
staat verandert het meest aan hoe het speelt, en kost het minst.

---

## 1. De politie slimmer maken

Wat er nu gebeurt is niet dom, maar het is wel steeds hetzelfde: ze rennen naar
de laatste plek waar ze je zagen en waaieren daarvandaan uit in sectoren. Wat
eraan ontbreekt is dat het voelt alsof ze *nadenken over jou*. Zes dingen, in
volgorde:

### 1.1 Omsingelen in plaats van erop af rennen — **half af (14 sep 2026)**

*Wat er af is:* de portofoon. Ziet één eenheid je, dan gaat dat rond en komt
iedereen binnen vierhonderd meter er rennend op af in plaats van zijn eigen
sector af te lopen (`meldDoor` in js/politie.js). *Wat er nog ligt:* de rollen —
twee die je van voren bezighouden en de rest naar een flankpunt aan de andere
kant van het blok, zodat er iemand áchter je vandaan komt. Dat staat hieronder.


Nu mogen de drie dichtstbijzijnde agenten schieten en lopen de rest naar
dezelfde plek. Daardoor komt alles altijd uit één richting, en is wegrennen naar
achteren gratis.

Geef ze **rollen** zodra er meer dan drie in de buurt zijn: twee houden je van
voren bezig (die schieten), de rest krijgt een *flankpunt* toegewezen — een punt
op het wegennet aan de andere kant van het huizenblok, uitgerekend met dezelfde
routezoeker die ze nu al gebruiken. Het effect is dat er ineens iemand achter je
vandaan komt, en dat is precies waar het gevoel "ze zijn slim" vandaan komt.

Kosten: middelgroot. De routezoeker en de sectoren zijn er al; het is vooral een
kwestie van de sectorkeuze vervangen door een verdeling van rollen.

### 1.2 Vooruit denken in plaats van achteraan rijden — **af (14 sep 2026)**

De surveillanceauto's reden naar `laatstBekend` — de plek waar je wás. Op
snelheid is dat altijd te laat en zag je ze in je spiegel hangen.

Ze **onderscheppen** nu: `onderschepPunt()` in js/politie.js neemt je snelheid
en richting, loopt zes en een halve seconde vooruit over het wegennet, en de
jagers rijden naar dát punt. Op een kruising nemen ze de andere tak, zodat ze
van opzij de straat in komen. Drie regels houden het eerlijk: er moet vaart in
zitten, de wagen moet achter je hangen, en de dichtstbijzijnde jager blijft
gewoon achter je aan rijden — anders is je spiegel leeg.

### 1.3 Wegversperring vanaf drie sterren — **af (14 sep 2026)**

Twee wagens neus aan neus dwars over de straat waar je heen rijdt. Hij stond op
vier sterren en staat nu op drie — bij vier ben je meestal al te voet, en dan
kwam hij bijna nooit voor. En de keuze *waar* komt nu van de voorspelde route:
de routezoeker rekent uit hoe je naar het onderscheppunt van 1.2 rijdt en de
wagens komen op het eerste punt van díe route dat ver genoeg vooruit ligt en dat
je nog niet kunt zien.

Dit is het punt waarop een achtervolging een besluit wordt in plaats van een
gaspedaal: doorrijden en eromheen, of de wijk in en te voet verder.

### 1.4 Een helikopter vanaf vier sterren — **af (14 sep 2026)**

Eén heli (js/helikopter.js) die op 62 m in een rondje van 48 m boven `anker()`
cirkelt en `laatstBekend` bijwerkt zolang hij je ziet. Dat maakt in één klap
alles wat er al ligt betekenisvol: **gehurkt** (toets C), onder een boomkroon,
in een bos- of heestervlak uit de kaart of onder een dek ben je uit zijn zicht,
en dat is waar je dan heen rent. Met een zoeklicht in het donker en een geluid —
het slaan van de bladen — dat met de afstand meeloopt.

Wat er nog bij kan: een gebouw telt nog niet als dak (binnen sta je in dit spel
in een andere ruimte, dus dat gaat vanzelf goed), en de heli reageert nog niet
op beschieting.

### 1.5 Aanhouden in plaats van alleen schieten

Nu is er maar één afloop: je gaat neer. Op één ster hoort een agent je eerst
**staande te houden** — aanroepen, wapen getrokken, langzaam naderen — en pas te
schieten als jij schiet of wegrent. Sta je stil, gehurkt, zonder wapen in je
handen, binnen een paar meter, dan word je **aangehouden**: je raakt je wapens
en de helft van je geld kwijt en komt bij het bureau weer buiten.

Dat geeft de politie iets om te wíllen (jou pakken) in plaats van alleen iets om
te doen (schieten), en het maakt lage sterren spannend zonder dat je doodgaat.
Het maakt ook het pistool in het schap bij Tinga State echt betekenisvol: na een
aanhouding moet je een nieuwe kopen.

### 1.6 Kleine dingen die veel doen

- **Ze reageren op je auto, niet alleen op jou.** Stap je uit en loop je weg,
  dan zetten ze zich rond de auto — want dat is wat ze zoeken. Nu volgt de
  aandacht altijd de speler.
- **Getuigen die wegkomen bellen.** Dat zit er half in (het aantal getuigen
  bepaalt de meldkans); maak er een zichtbare regel van: de voetganger die het
  zag rent naar de rand van je blikveld, en hálen ze dat, dan komt er een ster
  bij. Dat geeft je een keuze op het moment zelf.
- **Radiopraat.** Korte, gesynthetiseerde meldingen ("verdachte te voet richting
  de Molenkrite") als er iets verandert. Het is geluid, geen intelligentie, maar
  het laat hóren dat er gecoördineerd wordt.
- **Spijkermat** vanaf vier sterren: een agent legt er een op de rijbaan; erover
  rijden knalt een band (lagere topsnelheid en trekken naar één kant — de
  natuurkunde daarvoor zit al in `js/vehicles.js`).
- **PIT-manoeuvre**: een wagen die naast je komt duwt je achterkant weg. De
  botsingen tussen auto's bestaan al; dit is een stuurcommando erbovenop.
- **Perimeter in plaats van rondjes.** Zijn ze je kwijt, dan gaan ze niet
  dwalen maar zetten ze zich op de uitgangen van de wijk — de plekken waar de
  wegafsluitingen ook staan.

---

## 2. Wat er verder bij kan

### 2.1 Dingen die de wereld af maken

- **Een fiets als voertuig.** In Sneek is dat geen grap maar het gewone
  vervoermiddel, en het model staat er al: de voetgangers fietsen erop. Een
  fiets pakken, ermee over de stoep, en de politie die je in de smalle paden
  niet met de auto kan volgen — dat is een spelmechaniek op zich.
- **Een boot.** De Geeuw, de Houkesloot en het water bij IJlst liggen er, met
  kades en beschoeiing uit de BGT. Een sloep die je bij een steiger meeneemt
  opent de helft van de kaart die nu alleen decor is.
- **Een garage die je auto repareert** (en je sterren kwijtraakt als je hem
  overspuit). Dat laatste is de klassieke uitweg uit een achtervolging en maakt
  de politie meteen interessanter.
- **Het ziekenhuis.** Ga je neer, dan begin je nu bij je laatste opgeslagen
  spel. Bij het Antonius weer buiten komen — zonder wapens, met minder geld —
  is een betere straf en zet het ziekenhuis op de kaart.
- **Winkels die open- en dichtgaan** met de klok, en een Poiesz die 's avonds
  dicht is.

### 2.2 Dingen om te doen

- **Klusjes met een auto**: taxiritten (iemand oppikken en binnen de tijd
  afzetten), een bestelrit met de bakwagen, een test "hoe snel van Tinga naar
  IJlst". Ze gebruiken alles wat er al is: het wegennet, de navigatie, de klok.
- **Verstopte molentjes.** Vijftig kleine molentjes door de hele wereld, in
  hoekjes waar je anders nooit komt. Elke tien levert iets op bij je huis aan de
  Molenkrite. Dit is de goedkoopste manier om de wereld te laten verkennen.
- **Stunts.** Een sprong over de oprit van de N7, de duiker bij de rotonde, de
  kade bij IJlst — met een meting (hoe ver, hoe hoog) en een lijstje met je
  beste sprongen.
- **Een tweede verhaallijn** die in IJlst begint, zodat die kant van de kaart
  een reden krijgt.

### 2.3 Dingen die het spel beter laten *voelen*

- **Een kogelvrij vest** (€ 200) als tweede balkje boven je leven: het vangt de
  schade tot het op is. Past precies bij het schap dat er nu ligt.
- **Wapens in de derde persoon zichtbaar** aan je poppetje, zodat je ziet wat je
  vasthebt.
- **Een minimap die met je meedraait** in de auto, en een route-lijn naar je
  missiedoel.
- **Regen op de weg**: minder grip, langere remweg, en sporen die blijven staan.
- **Gevecht zonder wapen**: slaan, en een agent die je met een wapenstok
  benadert. Dat maakt "aanhouden" (1.5) pas compleet.

---

## 3. Wat ik als eerste zou doen

Als er tijd is voor drie dingen, dan deze — ze veranderen samen het meest en
bijten elkaar niet:

1. **Omsingelen** (1.1). Onderscheppen (1.2) is af en dat scheelde al veel;
   rollen verdelen zodat er iemand áchter je vandaan komt is de andere helft.
2. **Aanhouden** (1.5). Er komt een tweede afloop bij, en lage sterren worden
   spannend in plaats van hinderlijk.
3. **De fiets** (2.1). Eén voertuig erbij dat past bij de stad, gebruikmaakt van
   een model dat er al is, en de smalle paden van de wijk ineens nuttig maakt.

*Stand op 14 september 2026: 1.2, 1.3 en 1.4 zijn af; van 1.1 is de portofoon af
en de rolverdeling nog niet.*
