# Missie 18 — De uitzending (ontwerp, 3 okt 2026, nog niet gebouwd)

Gevraagd: "Erik en Mark voeren op het laatst een usb-stick in bij radiozender Tinga in Sneek, op het
station, en dan speelt hij een fragment af waarin zogenaamd aan iedereen in Sneek gezegd wordt dat
Erik en Mark de drugs regelen. De Veteraan en Bouwman zijn verleden tijd." Het fragment staat in
`audio/radio/uitzending.mp3` (aangeleverd als Birthday_Announcement_Broadcast.mp3; 40,2 s, 128 kbit/s,
44,1 kHz, gemeten aan de mp3-frames).

## De draad uit missie 17

Ronald (of het schriftje uit zijn kluis) zegt: zaterdag haalt Bouwman 's nachts alles weg bij zijn
loods, met de boot. Erik heeft de sleutel van **container 3**. Mark: "Zaterdag kopen wij terug." In
het filmbeeld bij de loods zegt Bouwman: "Zaterdag is alles weg. En zij ook."

## Verloop

0. **Het telefoontje.** Een minuut na de ochtend van missie 17 belt Mark: "Het is zaterdag." Er komt
   een M bij de Wieken 29.
1. **Het plan** (binnen, Mark op de bank, Johan aan tafel). Vannacht zijn ze bij de loods vóór
   Bouwman. Johan houdt een usb-stick omhoog: "En zondagochtend luistert heel Sneek naar Radio Tinga."
2. **"Die nacht…"** (01:00, de klok staat stil). Erik en Mark in de Golf bij de loods aan het water
   (js/schaduw.js: loods, container, kade, steiger, boot).
   - E bij container 3 met de sleutel: de tassen gaan in de kofferbak.
   - Filmbeeld: een lamp op het water, de boot van Bouwman legt aan, met twee man op de kade.
   - Bouwman praat, trekt als eerste, en het wordt een vuurgevecht (`Bewaking` met `rustig`, zoals op
     de brug).
   - Bouwman vlucht de steiger op naar zijn boot. Je raakt hem voor hij wegvaart. Filmbeeld: de boot
     drijft stuurloos de vaart in.
3. **De ochtend** (zondag 07:45). Radio Tinga zit in de **toren aan de Blaustraat**: het hoge pand van
   26 m uit 2012, op (843, −242) in de kaart. Op het dak komt een zendmast, en bij de ingang een
   ON AIR-bord.
   - Johan leidt de portier af met een praatje bij de ingang.
   - Erik gaat via de achterdeur en het trappenhuis naar de studio. De studio is een losse kamer
     buiten de kaart, zoals de woningen: een mengtafel, microfoons, een rode ON AIR-lamp en een raam
     op Tinga.
   - De dj is koffie halen. De balk telt 90 s af. Ziet de dj je, dan gaat er alarm.
   - E bij de mengtafel: de stick erin. E nog een keer: de schuif omhoog.
4. **De uitzending** (filmbeeld, de volle 40 s van de mp3). Een montage over de kaart:
   - de rode lamp;
   - een auto bij de BP met de radio aan;
   - de radio op het dressoir in je eigen huis;
   - Ronald die in zijn schuur stil blijft staan;
   - Sjoerd achter de balie van het Autohuis;
   - het gat in de Dúvelsrak;
   - en terug naar de toren met de mast.

   De andere radio's gaan zachter zolang hij speelt.
5. **Het einde.** Op het dak van de toren of terug bij de Wieken:
   - Mark: "Nu weten ze het." Erik: "Tinga is van ons."
   - € 10.000 en **EINDE**, met een korte titelrol: de achttien missies en wat je verdiend hebt.
   - Daarna kun je vrij verder spelen. Radio Tinga zendt het fragment af en toe opnieuw uit.

## Hoe het gebouwd wordt

- `js/zender.js`: de toren, de mast en het bord, de studio (kamer buiten de kaart) en de dj.
- In js/verhaal.js het blok van missie 18:
  - constanten `UITZENDING_WACHT`, `UITZENDING_NACHT`, `UITZENDING_OCHTEND`;
  - fases;
  - filmbeelden `boot`, `uitzending` en `einde`;
  - opslag `uitzendingKlaar`;
  - in `KLUS_WACHT` en bij `stopNaloop`.
- In js/audio.js `speelUitzending()`, die de autoradio en de huisradio laat zakken.
- Een sneltoets om hem los te starten, plus `npm run uitzendingtest` en `uitzendingshots`.

## Open vragen aan de gebruiker

1. **"Op het station"** lees ik als de studio van Radio Tinga (de zender heet in het spel al zo). Het
   treinstation van Sneek ligt buiten de kaart: geschat een halve kilometer voorbij de noordrand
   (z0 = −789), ten noordoosten van Tinga. Daar kan het dus niet zonder de kaart te vergroten.
2. **Bouwman**: neergeschoten bij de loods, zoals hierboven? Of gearresteerd, met de foto's van
   missie 15 en de telefoon van "R." anoniem naar de recherche?
3. **De tekst van het fragment**: ik kan de mp3 niet beluisteren. Voor ondertitels tijdens de
   uitzending is de tekst nodig. Anders loopt het fragment zonder ondertitel, met alleen
   "♪ Radio Tinga".
