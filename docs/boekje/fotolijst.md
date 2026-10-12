# Fotolijst boekje

Alle foto's staan in `docs/boekje/foto/`, als JPEG op kwaliteit 0,92. Ze zijn gemaakt met `npm run boekjeshots`
(tools/boekjeshots.mjs): de fotoscripts van het spel opnieuw gedraaid, met de stand van het spel van nu. Het boekje is A5;
over de volle breedte van een pagina (148 mm) heeft een foto op 300 dpi 1748 px nodig, en elke foto hieronder haalt dat.

De kaart van het hele speelgebied voor achterin staat in `docs/kaart/` (`npm run kaart:print`): `tinga-speelgebied.jpg`
in kleur en `tinga-speelgebied-licht.jpg` met de herkenningspunten, allebei 13.140 × 7500 px (3 px per meter). Voor het
boekje staan er twee op 1 px per meter in deze map: `kaart_speelgebied.jpg` en `kaart_speelgebied_licht.jpg` (4380 × 2500,
A4 liggend op ruim 370 dpi).

| Bestand | Hoofdstuk | Onderschrift | Maat | Gemaakt door |
|---|---|---|---|---|
| 01_welkom.jpg | Welkom | Molenkrite, het begin van alles. | 2400 × 1350 (412 dpi op A5-breedte) | `introshots` → intro_molenkrite |
| 02_lopen.jpg | Besturing | Erik te voet in Tinga. | 1920 × 1080 (330 dpi op A5-breedte) | `rijshots` → lopen_derdepersoon |
| 03_vishandel.jpg | Gezondheid | Martens Vishandel op het Jumbo-terrein: kibbeling voor € 20. | 2400 × 1350 (412 dpi op A5-breedte) | `wensen5shots` → wensen5_vishandel |
| 04_tinga_state.jpg | Wapens | Tinga State aan de Molenkrite. | 2400 × 1350 (412 dpi op A5-breedte) | `winkelshots` → tinga_state_deur |
| 04b_schap.jpg | Wapens | Het schap van Tinga State, met de prijzen van nu. | 2400 × 1350 (412 dpi op A5-breedte) | `richtshots` → boerderij_schap |
| 05_m1_garand.jpg | Wapens | De M1 Garand. | 2400 × 1350 (412 dpi op A5-breedte) | `m1shots` → m1_hand |
| 05b_sniper.jpg | Wapens | De sniper. | 2400 × 1350 (412 dpi op A5-breedte) | `echtshots` → wapen_echt_sniper |
| 05c_mes.jpg | Wapens | Het mes: altijd bij de hand. | 2400 × 1350 (412 dpi op A5-breedte) | `zespuntenshots` → mes_in_hand |
| 06_drone.jpg | Wapens (drone) | Door de camera van de drone. | 2400 × 1350 (412 dpi op A5-breedte) | `droneshots` → drone_beeld |
| 07_autohuis.jpg | Auto's | Autohuis Lemmerweg, tegenover de BP. | 2400 × 1350 (412 dpi op A5-breedte) | `garageshots` → garage_buiten |
| 07b_ferrari.jpg | Auto's | De Ferrari. | 2400 × 1350 (412 dpi op A5-breedte) | `garageshots` → garage_ferrari |
| 08_tuning.jpg | Auto's (tuning) | Tuning en decals bij Sjoerd. | 2400 × 1350 (412 dpi op A5-breedte) | `wensen5shots` → wensen5_tuning |
| 09_wasbox.jpg | Auto's / Politie | De wasbox achter de BP: nieuwe kleur, geen sterren. | 2400 × 1350 (412 dpi op A5-breedte) | `spuitshots` → spuiterij_open |
| 09b_bp.jpg | Auto's | BP Slump Oil aan de Lemmerweg. | 2400 × 1350 (412 dpi op A5-breedte) | `tankshots` → tank_voor |
| 10_klusje.jpg | Geld verdienen | Mark wijst je een klusje aan, met een K op de kaart. | 2400 × 1350 (412 dpi op A5-breedte) | `klusjesshots` → klus_aanbod |
| 11_pizza.jpg | Geld verdienen | Pizza bezorgen op de scooter. | 2400 × 1350 (412 dpi op A5-breedte) | `buurtshots` → buurt_pizza |
| 12_tennis.jpg | Geld verdienen | Tennis op het park. | 1920 × 1080 (330 dpi op A5-breedte) | `tennisshots` → tennis_park |
| 13_race.jpg | Geld verdienen | Aan de start van de race. | 1920 × 1080 (330 dpi op A5-breedte) | `raceshots` → race_grid |
| 14_radio_tinga.jpg | Geld verdienen | De studio van Radio Tinga. | 1920 × 1080 (330 dpi op A5-breedte) | `uitzendingshots` → studio_tafel |
| 15_politie_blokkade.jpg | Politie | Wegversperring vanaf drie sterren. | 1920 × 1080 (330 dpi op A5-breedte) | `politieshots` → politie_blokkade |
| 15b_politie_heli.jpg | Politie | Vanaf vier sterren komt de heli. | 1920 × 1080 (330 dpi op A5-breedte) | `helishots` → heli_zoeklicht |
| 15c_sterren.jpg | Politie | De sterren onder de minikaart. | 1920 × 1080 (330 dpi op A5-breedte) | `missieshots` → sterren_voor |
| 15d_verstopt.jpg | Politie | Gehurkt in een struik: VERSTOPT. Ze lopen je op een paar meter voorbij. | 1920 × 1080 (330 dpi op A5-breedte) | `politieslimshots` → politie_verstopt |
| 15e_zaklamp.jpg | Politie | 's Nachts zoeken ze met een zaklamp: in de bundel zien ze je, ernaast niet. | 1920 × 1080 (330 dpi op A5-breedte) | `politieslimshots` → politie_zaklamp |
| 16_kaart_legenda.jpg | Plekken / speldjes | De grote kaart met de legenda onderaan. | 1920 × 1080 (330 dpi op A5-breedte) | `legendatest` → legenda |
| 16b_kaart_route.jpg | Plekken | Een paarse route naar je doel. | 1920 × 1080 (330 dpi op A5-breedte) | `verhaalshots` → kaart_route |
| 17_molenkrite15.jpg | Plekken | Molenkrite 15. | 1920 × 1080 (330 dpi op A5-breedte) | `verhaalshots` → molenkrite15 |
| 17b_wieken29.jpg | Plekken | De woonkamer van de Wieken 29. | 1920 × 1080 (330 dpi op A5-breedte) | `woningshots` → wieken29_woonkamer |
| 17c_duvelsrak.jpg | Plekken | De Dúvelsrak (Viaduct Tinga). | 1920 × 1080 (330 dpi op A5-breedte) | `viaductshots` → viaduct_dek |
| 18_tv_thuis.jpg | Handig | Tinga Nieuws op de tv thuis. | 512 × 288 (inzet: 4.3 cm op 300 dpi) | `wensen5shots` → wensen5_tinganieuws |
| 18b_nacht.jpg | Handig | Tinga bij nacht. | 1920 × 1080 (330 dpi op A5-breedte) | `nachtshots` → nacht_straat |
| 18c_ochtend.jpg | Handig | Een ochtend in de wijk. | 1920 × 1080 (330 dpi op A5-breedte) | `omgevingshots` → licht_ochtend |
| 19_nomercy.jpg | Geld verdienen | No Mercy 4: de set in het Tinga-bos. | 1920 × 1080 (330 dpi op A5-breedte) | `nomercyshots` → nomercy_flak |
| 19b_nomercy_kamp.jpg | Geld verdienen | No Mercy 4: het bunkerdorp, met de stafauto. | 1920 × 1080 (330 dpi op A5-breedte) | `nomercyshots` → nomercy_kamp |
| 19c_nomercy5.jpg | Geld verdienen | No Mercy 5: de overtocht naar molen De Rat. | 1920 × 1080 (330 dpi op A5-breedte) | `nomercy5shots` → nomercy5_overtocht |
| 19d_nomercy5_molen.jpg | Geld verdienen | No Mercy 5: de Duitse post bij de molen. | 1920 × 1080 (330 dpi op A5-breedte) | `nomercy5shots` → nomercy5_molen |
| 19e_stafauto.jpg | Auto's | De stafauto uit No Mercy: houd hem, of neem de gage. | 1920 × 1080 (330 dpi op A5-breedte) | `stafautoshots` → nomercy5_stafauto |
| 19f_zijspan.jpg | Geld verdienen | Het zijspan uit de rit van No Mercy 5. | 1920 × 1080 (330 dpi op A5-breedte) | `stafautoshots` → nomercy5_zijspan |
| 20_poiesz.jpg | Gezondheid | De Poiesz in IJlst, met het terras: bier voor € 5. | 2400 × 1350 (412 dpi op A5-breedte) | `droneshots` → terras_poiesz |
| 21_ambulance.jpg | Gezondheid / sfeer | De ambulance rijdt uit. | 1920 × 1080 (330 dpi op A5-breedte) | `ambulanceshots` → ambulance_dag |
| 22_postbode.jpg | Handig | De postbode van Post Tinga, 's ochtends langs de deuren. | 1920 × 1080 (330 dpi op A5-breedte) | `postbodeshots` → postbode |
| 23_menu_besturing.jpg | Besturing | De besturing in het menu (Esc). | 1920 × 1080 (330 dpi op A5-breedte) | `menushots` → menu_besturing |
| kaart_speelgebied.jpg | Plekken (kaart) | Het hele speelgebied van boven, met de straatnamen en een maatverdeling langs de randen. | 4380 × 2500 | `printkaart` op 1 px/m |
| kaart_speelgebied_licht.jpg | Plekken (kaart) | Dezelfde kaart, licht, met de herkenningspunten: hierop teken je. | 4380 × 2500 | `printkaart` op 1 px/m |
