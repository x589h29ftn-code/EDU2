# Steekproef ronde 3 — twintig nieuwe plekken

Hoe dit werkt (zie ook docs/METHODIEK.md, stap 6): hieronder staan twintig
standpunten. Elke link opent Street View op **precies het punt en in precies de
richting** waar het spel straks vanaf rendert — negen meter voor de voorgevel
bij een adres, en op de dichtstbijzijnde rijbaan bij een plek. Zo is de foto die
jij maakt en het beeld dat `npm run geo:steekproef` maakt één op één te
vergelijken.

Wat er aan de hand is: de wereld is doorgetrokken tot IJlst, Duinterpen en de
nieuwbouw ten oosten van Tinga, maar **elke straat daar wordt nu met het
Molenkrite-woningtype getekend** — de gele baksteen en de kap van Tinga uit de
jaren zeventig. Dat is de aanname die deze ronde moet vervangen. Daarnaast staan
er vier adressen in de noordoosthoek bij, waar het 3D BAG-dakmodel ontbreekt en
het pand dus als opgetrokken grondvlak in het spel staat.

De lijst staat ook in `data/stijl/steekproef.json` (ronde 3); met
`node tools/geo/steekproeflinks.mjs 3` komt deze tabel er weer uit, en met
`npm run geo:steekproef` rendert het spel dezelfde standpunten.

## Adressen (ronde 3)

| # | adres | nu in het spel | meting uit 3D BAG | wat ik wil zien | Street View |
|---|---|---|---|---|---|
| 1 | Duizendblad 33 | molenkrite_kap | goot 2.75 m, nok 9.21 m, slanted | de hele oostkant is nu met de Molenkrite-steen getekend: welke steen, kozijnen, deuren en dakpannen staan er echt? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.020893,5.656847&heading=93&pitch=5&fov=80) |
| 2 | Zilverschoon 64 | molenkrite_kap | goot 2.85 m, nok 8.93 m, slanted | kap of plat, dakkapellen, kleur van steen en kozijnen | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.020267,5.659465&heading=49&pitch=5&fov=80) |
| 3 | Walstro 44 | molenkrite_kap | goot 2.24 m, nok 9.01 m, slanted | rijtjes of twee-onder-een-kap, garages, voortuinen | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.020796,5.659218&heading=3&pitch=5&fov=80) |
| 4 | Rode Klaver 2 | molenkrite_kap | goot 3.07 m, nok 8.99 m, slanted | hoekwoning: hoe ziet de zijgevel eruit (blind, ramen, schuur)? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.020569,5.660457&heading=48&pitch=5&fov=80) |
| 5 | Koolwitje 14 | molenkrite | **geen 3D BAG-dak** — opgetrokken grondvlak | geen 3D BAG-dak: hoe hoog is de goot en wat voor dak zit erop? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.016275,5.665746&heading=182&pitch=5&fov=80) |
| 6 | Dagpauwoog 10 | molenkrite_kap | goot 2.65 m, nok 11.09 m, slanted | steen en kozijnen, en of er zonnepanelen op liggen | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.017684,5.658299&heading=293&pitch=5&fov=80) |
| 7 | Ylostinslaan 62 | molenkrite_kap | goot 2.48 m, nok 8.67 m, slanted | IJlst is nu Tinga-steen: welke steen en kozijnen horen hier? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.012203,5.613061&heading=142&pitch=5&fov=80) |
| 8 | Sikko Sjaerdemalaan 27 | molenkrite_kap | goot 2.89 m, nok 9.57 m, slanted | naoorlogse rijtjes in IJlst: steen, dakvorm, kozijnkleur | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.011028,5.613635&heading=326&pitch=5&fov=80) |
| 9 | Eegracht 10 | molenkrite | goot 7.4 m, nok 11.39 m, slanted | grachtenpand aan het water: gevelvorm (tuitgevel? lijstgevel?), steen, ramen | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.010125,5.622370&heading=217&pitch=5&fov=80) |
| 10 | Uilenburg 56 | spil | goot 2.8 m, nok 12.47 m, slanted | nu getekend als 'spil'; klopt dat, of is dit ook een historisch pand? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.010294,5.618202&heading=261&pitch=5&fov=80) |
| 11 | Galamagracht 37 | molenkrite_bung | goot 2.64 m, nok 7.51 m, slanted | nu een bungalowtype: klopt de goothoogte en het dak? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.009372,5.623806&heading=96&pitch=5&fov=80) |
| 12 | Morrahemstraat 176 | molenkrite | goot 5.88 m, nok 9.12 m, slanted | de noordoosthoek: welke steen, welk dak, hoeveel lagen? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.024077,5.650192&heading=275&pitch=5&fov=80) |
| 13 | Scherwolderhemstraat 76 | molenkrite | **geen 3D BAG-dak** — opgetrokken grondvlak | geen 3D BAG-dak: goothoogte, dakvorm en dakkapellen | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.025621,5.649397&heading=5&pitch=5&fov=80) |
| 14 | Rijperahemstraat 44 | molenkrite | **geen 3D BAG-dak** — opgetrokken grondvlak | geen enkel dakmodel in deze straat: dakvorm en hoogte | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.026019,5.652042&heading=185&pitch=5&fov=80) |
| 15 | Oosthemstraat 3 | molenkrite | **geen 3D BAG-dak** — opgetrokken grondvlak | geen dakmodel: kopgevel van de rij, steen en dak | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.026594,5.652678&heading=95&pitch=5&fov=80) |

## Plekken (ronde 3)

| # | plek | soort | straat | wat ik wil zien | Street View |
|---|---|---|---|---|---|
| 16 | Straatprofiel Duizendblad | profiel | Duizendblad | nieuwbouwstraat: breedte, stoep, parkeervakken, berm, lantaarns — is dit hetzelfde profiel als Tinga of anders? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.021383,5.657735&heading=290&pitch=5&fov=80) |
| 17 | Straatprofiel Ylostinslaan | profiel | Ylostinslaan | IJlst: straatprofiel, bestrating, bomen, parkeren | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.011653,5.611821&heading=232&pitch=5&fov=80) |
| 18 | Kade van de Eegracht | kade | Eegracht | kademuur, bolders, bomenrij, hoe dicht het water aan de straat ligt | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.010371,5.622016&heading=21&pitch=5&fov=80) |
| 19 | Fietstunnel onder de oprit | tunnel | Stadsrondweg-Zuid | beton: gestort of met bekisting, verlichting in de tunnel, en staat er graffiti op? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.022193,5.654782&heading=3&pitch=5&fov=80) |
| 20 | Stoepranden en kliko's Monnikmolen | rommel | Monnikmolen | waar staan de rolcontainers (in de berm, op de stoep, aan de weg?), hoeveel onkruid staat er langs de band, en hoe vies zijn de plinten van de gevels? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.022473,5.644766&heading=342&pitch=5&fov=80) |

20 plekken.
