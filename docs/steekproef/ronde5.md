# Steekproef ronde 5 — IJlst, de Lemmerweg en wat er nog niet staat

Hoe dit werkt (zie ook docs/METHODIEK.md, stap 6): hieronder staan
vierentwintig standpunten. Elke link opent Street View op **precies het punt en
in precies de richting** waar het spel straks vanaf rendert — negen meter voor de
voorgevel bij een adres, en op de dichtstbijzijnde rijbaan bij een plek. Zo zijn
de foto die jij maakt en het beeld uit `npm run geo:steekproef` één op één te
vergelijken.

Waarom déze vierentwintig. De vorige rondes gingen over rijtjeshuizen: steen,
dakvorm, kozijnkleur. Die zijn nu redelijk op orde. Wat overblijft zijn de
gebouwen die *niet* in een rijtje passen, en die het spel daarom in een
standaardjasje heeft gestoken. Drie groepen:

1. **IJlst, de oude stad.** Zeven adressen aan de Eegracht, de Galamagracht, de
   Popmawal, de Geeuwkade, de Uilenburg en de Stadslaan. De grachtenpanden van
   1850 worden op dit moment getekend als gewone Tinga-rijtjeshuizen met een kap
   (`molenkrite_kap`), en dat is precies wat ze níet zijn. Uilenburg 56 is
   helemaal een raadsel: 620 m² grondvlak, twaalfeneenhalve meter hoog en uit
   1850 — dat is geen woonhuis.

2. **De bedrijfspanden.** Drie hallen op het terrein aan de Roodhemsterweg, De
   Finne en de Trompmoledyk, plus zes panden aan of vlak bij de Lemmerweg. Het
   spel tekent ze allemaal als `spil`, het algemene type, met een geschatte kap.
   Bij **Lemmerweg 130B** en **Lemmerweg 51** is er zelfs geen 3D BAG-meting: daar
   staat nu een gok van goot 5,8 en nok 8,8 m. Bij een bedrijfspand is de gevel het
   halve verhaal — damwandplaat, baksteen, de kleur, waar de overheaddeuren zitten
   en hoeveel kantoor er aan de voorkant zit.

3. **Wat er nog helemaal niet staat.** Acht omgevingsplekken. De belangrijkste is
   het **sportpark van IJlst**: in de kaart ligt daar 7700 m² kunstgras, maar er
   staat niets op — geen doelen, geen belijning, geen ballenvangers, geen
   clubgebouw. In het spel bestaat alleen het sportpark van VV Sneek Wit Zwart
   aan de Molenkrite echt; dit is een groen vlak. Verder de twee grachten, het
   bedrijventerrein, de grootste hal van IJlst (6100 m² zonder adres in de kaart),
   het profiel van de Lemmerweg, de brug daarin, en de kade waar de sloep ligt.

Vragen mogen kort beantwoord worden: een foto met een zin eronder is genoeg. Wat
er niet op de foto staat verzin ik niet — dan blijft het zoals het nu is.


## Adressen (ronde 5)

| # | adres | nu in het spel | meting uit 3D BAG | wat ik wil zien | Street View |
|---|---|---|---|---|---|
| 1 | Uilenburg 56 | spil | goot 2.8 m, nok 12.47 m, slanted | 1850, nok 12,5 m en 620 m² grondvlak — dat is geen woonhuis. Wat voor gebouw is dit (pakhuis, kerk, school?), van welk materiaal en met welke gevel? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.010294,5.618202&heading=261&pitch=5&fov=80) |
| 2 | Eegracht 28-29 | molenkrite_kap | goot 2.99 m, nok 11.77 m, slanted | 1898 aan de gracht: hoeveel panden zijn dit, wat voor gevels (trap-, tuit- of lijstgevel), welke steen en welke kleuren? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.009620,5.623565&heading=263&pitch=5&fov=80) |
| 3 | Galamagracht 5 | molenkrite_kap | goot 2.68 m, nok 11.16 m, slanted | 1850 aan het water: gevelvorm, steen, luiken, en of er een stoep met stoeppalen voor ligt | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.010422,5.622583&heading=23&pitch=5&fov=80) |
| 4 | Popmawal 2 | molenkrite_kap | goot 2.74 m, nok 8.87 m, slanted | 1850 op de wal: gevel, dakpannen, en hoe het pand op de kade staat — met of zonder voortuin | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.010820,5.622374&heading=113&pitch=5&fov=80) |
| 5 | Geeuwkade 17 | molenkrite_kap | goot 3.3 m, nok 10.43 m, slanted | 1933 aan de Geeuw: steen, kozijnen, en of de kade ervoor van hout, beton of steen is | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.011896,5.623147&heading=305&pitch=5&fov=80) |
| 6 | Stadslaan 42 | molenkrite_kap | goot 3.02 m, nok 10.19 m, slanted | 1955 aan de doorgaande straat: steen en dak, en zitten er winkels of bedrijven op de begane grond? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.012888,5.617519&heading=308&pitch=5&fov=80) |
| 7 | Julianastraat 75 | spil | goot 6.42 m, nok 14.19 m, slanted | 1985, 1480 m² en nok 14,2 m: is dit een school, een sporthal of een bedrijf? En welke gevel? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.014417,5.617772&heading=229&pitch=5&fov=80) |
| 8 | Roodhemsterweg 7 | spil | goot 7.55 m, nok 7.95 m, slanted | 1991, 3980 m² onder één dak: wat voor bedrijf, welke gevel- en dakbeplating, welke kleur, en waar zitten de overheaddeuren? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.015303,5.620470&heading=208&pitch=5&fov=80) |
| 9 | De Finne 2 | spil | goot 3.64 m, nok 10.49 m, slanted | 2002, 3290 m², nok 10,5 m: bedrijfshal of iets anders? Kleur van de damwandplaat en hoeveel kantoor er aan de voorkant zit | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.014339,5.620000&heading=208&pitch=5&fov=80) |
| 10 | Trompmoledyk 6-6A | spil | goot 7.06 m, nok 15.2 m, slanted | 1996, nok 15,2 m — de hoogste hal van het terrein. Wat staat hier, en hoe ziet hij eruit? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.015572,5.623483&heading=26&pitch=5&fov=80) |
| 11 | Lemmerweg 130a | sudwester | goot 6.25 m, nok 12.32 m, slanted | 1980, 2975 m², nok 12,3 m: welk bedrijf zit hier, welke gevelplaat en welke kleur? En hoe ziet het terrein ervoor eruit? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.019321,5.653044&heading=5&pitch=5&fov=80) |
| 12 | Lemmerweg 130B | spil | **geen 3D BAG-dak** — opgetrokken grondvlak | hier is géén 3D BAG: het spel gokt goot 5,8 en nok 8,8 m. Hoe hoog is het echt, hoeveel lagen, en wat zit erin? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.018757,5.653604&heading=185&pitch=5&fov=80) |
| 13 | Lemmerweg 84 | spil | goot -0.12 m, nok 13.86 m, slanted | 1858, nok 13,9 m en 1560 m²: een boerderij? Kop-hals-romp of stelp, riet of pannen, en welke kleur staldeuren? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.009223,5.658401&heading=68&pitch=5&fov=80) |
| 14 | Lemmerweg 51 | spil | **geen 3D BAG-dak** — opgetrokken grondvlak | ook geschat (goot 5,8, nok 8,8). Wat staat hier aan de zuidkant bij de N7, en hoe hoog is het werkelijk? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.026690,5.655793&heading=285&pitch=5&fov=80) |
| 15 | Quirijn de Blaustraat 50-50B | spil | goot 3.23 m, nok 25.92 m, slanted | 2012, nok 25,9 m — het hoogste pand aan deze kant van de Lemmerweg. Hoeveel lagen, welk materiaal, en balkons of galerijen? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.023023,5.656854&heading=275&pitch=5&fov=80) |
| 16 | Potterzijlstraat 11 | spil | goot 3.9 m, nok 8.88 m, multiple horizontal | 1968, 1834 m², nok 8,9 m langs de Lemmerweg: wat voor gebouw is dit en welke gevel heeft het? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.023299,5.653724&heading=189&pitch=5&fov=80) |

## Plekken (ronde 5)

| # | plek | soort | straat | wat ik wil zien | Street View |
|---|---|---|---|---|---|
| 17 | Sportpark IJlst | sport | De Terpen | hier ligt 7700 m² kunstgras in de kaart, maar er staat nog níets op: geen doelen, geen belijning, geen ballenvangers, geen clubgebouw. Hoeveel velden zijn het, waar staan de lichtmasten en de dug-outs, hangen er reclameborden, en hoe ziet het clubhuis en het hek eruit? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.011819,5.630478&heading=263&pitch=5&fov=80) |
| 18 | Bedrijventerrein IJlst | terrein | Roodhemsterweg | de hallen samen: kleuren van de damwand, hoogte en soort hekwerk, opslag in de open lucht, bedrijfsborden en wat voor lantaarnpalen er staan | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.015226,5.619859&heading=135&pitch=5&fov=80) |
| 19 | De grote hal aan de Sneekerpad-kant | gebouw | Geeuwkade | 6100 m² onder één dak uit 1960, nok 17 m, en zonder adres in de kaart — het grootste gebouw van IJlst. Wat is dit, en hoe ziet het eruit? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.012744,5.622974&heading=51&pitch=5&fov=80) |
| 20 | De Eegracht | profiel | Eegracht | het grachtprofiel: kademuur of houten beschoeiing, bomen, ligplaatsen, bruggetjes naar de voordeuren, en welke verharding de rijbaan en de stoep hebben | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.009246,5.623337&heading=270&pitch=5&fov=80) |
| 21 | De Galamagracht | profiel | Galamagracht | zelfde vraag als de Eegracht, maar dan aan de andere kant: hoe breed is het water, waar staan de bomen, en hoe zien de bruggetjes en de kade eruit? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.010369,5.622831&heading=294&pitch=5&fov=80) |
| 22 | De Lemmerweg bij het tankstation | profiel | Lemmerweg | het wegprofiel: hoeveel rijstroken, vrijliggend fietspad of niet, middenberm, bomenrij, lantaarns, geleiderail en bebording | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.020024,5.654940&heading=185&pitch=5&fov=80) |
| 23 | De brug in de Lemmerweg | brug | Lemmerweg | de brug over het water: leuningen (kleur en model), of er een apart fietspad overheen loopt, en of het een vaste brug of een beweegbare is | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.023256,5.655373&heading=135&pitch=5&fov=80) |
| 24 | De kop van de Geeuw bij IJlst | water | De Dassenboarch | de kade waar de sloep ligt: steigers, bolders, afmeerpalen, hoe de oever eruitziet en wat er langs de kant staat | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.011001,5.625106&heading=271&pitch=5&fov=80) |

24 plekken.
