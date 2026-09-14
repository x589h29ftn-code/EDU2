# Steekproef ronde 4 — twintig nieuwe plekken

Hoe dit werkt (zie ook docs/METHODIEK.md, stap 6): hieronder staan twintig
standpunten. Elke link opent Street View op **precies het punt en in precies de
richting** waar het spel straks vanaf rendert — negen meter voor de voorgevel
bij een adres, en op de dichtstbijzijnde rijbaan bij een plek. Zo zijn de foto
die jij maakt en het beeld dat `npm run geo:steekproef` maakt één op één te
vergelijken.

Wat deze ronde wil weten, in drie groepen:

1. **Sneek buiten Tinga.** Twaalf van de vijftien adressen liggen in de wijken
   rondom: de Kaatsland-buurt, de bloemen- en vlinderbuurt, de Partuurstraat en
   de Pripperstraat. Ze worden allemaal met het Molenkrite- of het Jasker-type
   getekend, want dat is wat we hebben gezien. Die aanname moet deze ronde eraf.
2. **Vier metingen die vreemd zijn.** Age Piersstraat 33 heeft een goot van 5,70
   en een nok van 5,76 m — dus plat, wat in zo'n rij raar is. Julianastraat 15
   komt niet verder dan 3,40 m en is dus vermoedelijk een garagebox. De
   Liaukemastraat staat als een blok van elf en een halve meter in de kaart, en
   Holtropweg 14 heeft een nok op 14,4 m. Vier keer dezelfde vraag: klopt die
   meting, en wat staat er dan eigenlijk?
3. **Vijf plekken die het spel uit regels opbouwt** en die nog nooit tegen een
   foto zijn gelegd: het tankstation, het tennispark, het sportpark, de
   volkstuinen en de houtzaagmolen in IJlst. Kleuren, hoogtes en wat er
   omheen staat.

De lijst staat ook in `data/stijl/steekproef.json` (ronde 4); met
`node tools/geo/steekproeflinks.mjs 4` komt deze tabel er weer uit, en met
`npm run geo:steekproef` rendert het spel dezelfde standpunten.

## Adressen (ronde 4)

| # | adres | nu in het spel | meting uit 3D BAG | wat ik wil zien | Street View |
|---|---|---|---|---|---|
| 1 | Jonkvrouw 45 | molenkrite_kap | goot 2.86 m, nok 9.09 m, slanted | nieuwbouw in de noordoosthoek, nu met de Molenkrite-kap: welke steen, dakpannen, kozijnen en voordeur staan er echt? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.015156,5.664067&heading=22&pitch=5&fov=80) |
| 2 | Age Piersstraat 33 | molenkrite | goot 5.7 m, nok 5.76 m, slanted | goot 5,70 en nok 5,76 m — dat is dus plat. Klopt dat, of zit er een flauwe kap op? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.025584,5.658348&heading=95&pitch=5&fov=80) |
| 3 | De Dassenboarch 8 | molenkrite_bung | goot 3.96 m, nok 7.61 m, slanted | nu een bungalowtype: één laag met een kap? En wat voor steen en kozijnen? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.009678,5.626552&heading=261&pitch=5&fov=80) |
| 4 | Liaukemastraat 2-14 | appart | goot 11.48 m, nok 11.53 m, multiple horizontal | appartementen, goot 11,5 m: hoeveel lagen, galerij of portiek, balkons aan de straat of aan de achterkant? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.024679,5.656464&heading=95&pitch=5&fov=80) |
| 5 | Willem Santemastraat 30 | jasker_flat | goot 6.18 m, nok 6.26 m, horizontal | nu getekend als flat met de Jasker-steen: klopt de steen, en hoeveel lagen zijn het? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.023217,5.659196&heading=95&pitch=5&fov=80) |
| 6 | Gajus Nautastraat 1 | jasker_flat | goot 5.93 m, nok 6.02 m, multiple horizontal | kop van de rij, ook als flat getekend: is het een flat of een rijtje eengezinswoningen? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.025158,5.660051&heading=5&pitch=5&fov=80) |
| 7 | Partuurstraat 98 | molenkrite_kap | goot 3.42 m, nok 8.35 m, slanted | rijtjeshuis met kap: steen, dakpannen, kozijnkleur, dakkapel of niet | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.025171,5.643748&heading=314&pitch=5&fov=80) |
| 8 | Julianastraat 15 | jasker_flat | goot 3.38 m, nok 3.4 m, horizontal | nok 3,40 m — dat is te laag voor een woning. Is dit een garagebox, een berging of iets anders? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.013832,5.617913&heading=122&pitch=5&fov=80) |
| 9 | Kaatsland 160 | molenkrite | goot 6.04 m, nok 9.21 m, slanted | goot 6,0 en nok 9,2: twee lagen met een kap. Welke steen, en liggen er zonnepanelen? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.023250,5.652739&heading=275&pitch=5&fov=80) |
| 10 | Pripperstraat 58 | molenkrite_kap | goot 3.47 m, nok 8.32 m, slanted | steen en kozijnen, en of de voortuinen hier heggen of schuttingen hebben | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.025452,5.645433&heading=314&pitch=5&fov=80) |
| 11 | Bockamastraat 48 | molenkrite_kap | goot 3.24 m, nok 8.62 m, slanted | twee-onder-een-kap of rijtje? En wat voor bergingen staan er aan de zijkant? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.011391,5.612067&heading=177&pitch=5&fov=80) |
| 12 | Wilgeroosje 50 | molenkrite_kap | goot 2.81 m, nok 8.68 m, slanted | de bloemenbuurt: steen, dak en hoe breed de voortuinen zijn | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.019360,5.660745&heading=272&pitch=5&fov=80) |
| 13 | Apollovlinder 41 | molenkrite_kap | goot 2.93 m, nok 9.66 m, slanted | de vlinderbuurt, nok 9,7 m: hoeveel lagen, welk dak, welke steen? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.016436,5.660159&heading=103&pitch=5&fov=80) |
| 14 | Holtropweg 14 | spil | goot 2.37 m, nok 14.42 m, slanted | nu getekend als "spil" met een nok op 14,4 m: is dit werkelijk zo hoog, en wat voor pand is het? | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.009948,5.612128&heading=168&pitch=5&fov=80) |
| 15 | Jutrijpstraat 20 | molenkrite | goot 5.66 m, nok 8.41 m, slanted | steen, dakvorm en of er dakkapellen aan de straatkant zitten | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.023262,5.649113&heading=185&pitch=5&fov=80) |

## Plekken (ronde 4)

| # | plek | soort | straat | wat ik wil zien | Street View |
|---|---|---|---|---|---|
| 16 | Tankstation BP Slump Oil | tankstation | Lemmerweg | de luifel: kleur, hoogte, hoeveel pompen eronder, en hoe de shop en de wasstraat erbij staan | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.019608,5.654477&heading=7&pitch=5&fov=80) |
| 17 | Tennispark Molenkrite | sport | Molenkrite | kleur van de banen, hoogte en kleur van de hekken, vangnetten, en wat er langs de banen staat | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.019474,5.650241&heading=102&pitch=5&fov=80) |
| 18 | Sportpark VV Sneek Wit Zwart | sport | Molenkrite | lichtmasten, reclameborden langs het veld, dug-outs en de tribune: kleuren en maten | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.021886,5.651425&heading=139&pitch=5&fov=80) |
| 19 | Volkstuinen achter de Wieken | tuin | de Wieken | de schuurtjes en kassen: kleur, maat, en hoe de paden en de scheidingen ertussen lopen | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.022000,5.640379&heading=256&pitch=5&fov=80) |
| 20 | Houtzaagmolen De Rat | molen | Sneekerpad | de wieken en de stelling: kleur van het hekwerk, de riet- of houtbekleding van de romp, en de loodsen ernaast | [Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=53.012651,5.627170&heading=317&pitch=5&fov=80) |

20 plekken.
