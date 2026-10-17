# Tinga — waar dit spel staat, en hoe eraan gewerkt wordt

Dit bestand is de overdracht naar een nieuwe sessie. Het vertelt wat het spel is,
hoe het in elkaar zit, welke afspraken er gelden en wat er nog open staat. Lees
dit eerst; `README.md` (spelersuitleg, per missie) en `docs/METHODIEK.md`
(bouwverslag, per stap) zijn de diepte in.

## 1 · Wat het is

Een GTA-achtig spel in de wijk **Tinga in Sneek**, in de browser. Three.js r160,
ES-modules, **geen buildstap**: `index.html` laadt `js/main.js` en dat is het.
`lib/three.module.js` staat in de repo. Er draait ook een Electron-schil
(`desktop/`) en een Windows-app via GitHub Actions.

Starten: `npm run server` (poort 8123) en dan `http://127.0.0.1:8123/index.html`.

## 2 · Werkafspraken

Deze gelden altijd, ook als ze niet opnieuw genoemd worden.

- **Alles in het Nederlands.** Code-commentaar, commitberichten, `README.md`,
  `docs/METHODIEK.md` en de uitvoer van de proeven. Ook de gesprekken in het
  spel.
- **Ontwikkelen en pushen op de tak `claude/gta-tinga-veteran-mission-1aoypq`.**
  Nooit een andere tak zonder dat het gevraagd is. Hier stond eerst
  `claude/gta-tinga-game-setup-lcm1jy`; op die tak is tot 26 sep in een oude
  sessie verder gewerkt vanaf de stand van 23 sep, en dat is in stap 85 hier
  samengevoegd. Kijk bij twijfel eerst met `git log` op beide takken.
- **Pushen als de gebruiker het zegt.** "push" betekent pushen, **"Build"**
  betekent de Windows-app bouwen: `windows.yml` via `workflow_dispatch` op de
  werktak. Die levert sinds stap 185 ook de installer; met de invoer `dvd: true`
  ook de dvd-inhoud en een ISO om te branden.
- **Geen afbeeldingsbestanden in het spel.** Elke textuur wordt op een canvas
  getekend (`js/textures.js` en de doek-functies boven in de modules). Bewuste
  uitzonderingen: de mp3's onder `audio/` en de laadschermen onder
  `beeld/laadscherm/`, sinds stap 105 het schot (`audio/wapen/schot.mp3`), en sinds stap 127 de explosie,
  de heli, de twee achtergronden en de portofoon (`audio/explosie`, `audio/heli`, `audio/sfeer`, `audio/politie`), en sinds stap 129
  Kali (`audio/radio/kali.mp3`: het radiootje van missie 1 en Radio Tinga), en sinds stap 130 `audio/missie/missie2.mp3`
  en `audio/radio/ren-lenny-ren.mp3` (Radio Tinga en 100% NL), en sinds stap 139 `audio/wapen/m1_schot.mp3`,
  `audio/wapen/m1_clip.mp3` (de M1 Garand) en `audio/sfeer/stad.mp3` (de stadsachtergrond), en sinds stap 174 `audio/auto/claxon.mp3` (de claxon), en sinds stap 181 drie nummers op 100% NL (`audio/radio/niet-of-nooit-geweest.mp3`, `het-regent-zonnestralen.mp3`, `suzanne.mp3`) en `audio/missie/nomercy.mp3` (Medal of Honor onder No Mercy), en sinds stap 186 vijf nummers op Radio Tinga (`sultans-of-swing`, `rainbow-in-the-sky`, `under-the-bridge`, `whatever-you-want`, `knockin-on-heavens-door`), en sinds stap 190 het pompgeweer (`audio/wapen/shotgun_schot.mp3`, `shotgun_pomp.mp3`).
- **`js/kaart.js` is gegenereerd** door `npm run geo:genereer` uit de geodata.
  Nooit met de hand aanpassen. Geometrie komt uit BGT en 3D BAG; foto's mogen
  alleen kleur, detail en indeling bepalen.
- **Elke ronde krijgt een proef en foto's.** Een nieuwe functie zonder
  `npm run <iets>test` is niet af, en de proef moet groen zijn vóór de push.
- **Zuinig met tokens.** Meten in plaats van gokken, maar niet meer lezen dan
  nodig.
- **Meten, niet kijken.** Bijna elke fout in dit project kwam uit een maat die
  niet klopte, niet uit iets wat je kon zien. Schrijf de controle als proef.

## 3 · Hoe het in elkaar zit

| Bestand | Waarvoor |
|---|---|
| `js/main.js` | de hoofdlus, de invoer, de mixer, alles aan elkaar |
| `js/verhaal.js` | de achttien missies, Mark, de gesprekken, de opslag van het verhaal |
| `js/kaart.js` | **gegenereerd**: panden, wegen, water, straten uit de geodata |
| `js/kaartwereld.js` | daar de wereld van bouwen (tegels, bomen, riet, auto's) |
| `js/textures.js` | alle geveltextures, dakpannen, baksteen — op canvas |
| `js/world.js` | botsingsdozen, `addCollider` / `resolveCollisions` |
| `js/interieur.js` | de woningen van binnen, inclusief tuin, radio en barbecue |
| `js/politie.js` | sterren, onderscheppen, wegversperring, helikopter; sinds stap 144 dekking (aanvallers), `voetPunt` (de looproute dichtbij), `omsingel` (posten), `ramHandig`/`ramKlapNu` (rammen, `pakRam` voor js/main.js), insluiten, terug naar de auto (`eigenAuto`, `naarAuto`/`inAuto`, `weerInDeWagen`), `proefStil` en `proef` voor proeven |
| `js/aaff.js` | stap 159: het kantoor aan het water naast de loods (BAG 1900100010087325, Stadsrondweg-Zuid 121–121A): koperen kubus, glazen pui, hal, kade, de logo's aaff. en Excellente op canvas, 's nachts lichtgevend (`update(dt, nacht)`, alleen `emissiveIntensity`); `EIGEN_PANDEN`: js/kaartwereld.js slaat de geometrie van zo'n pand over en houdt de botsdozen; `AAFF_PAND.nu` |
| `js/grafisch.js` | stap 157: de grafische standen laag/normaal/hoog (`GRAFISCH`: LOD-schaal, schaduwkaart, gras, `npcs.ZICHT`/`ZICHT_GROF`); js/main.js `zetGrafisch`; normaal = het oude spel |
| `js/moeilijk.js` | stap 157: makkelijk/normaal/moeilijk (`MOEILIJK`: schade, raak, koel); `koppelLeven` maakt `player.health` een eigenschap die elke daling schaalt; laden via `zetLevenRuw` |
| `js/politieslim.js` | stap 144: de losse stukken van de slimmere politie — `verstop` (struik, bos, kroon, lantaarn), `zichtAfstand` (nacht 20, lantaarn 34, zaklamp 32, regen, struik 2,5 gehurkt), `struikOpLijn`, `zoekDekking`, `raakKans`, `ZoekGeheugen` (vakken van 20 m, vluchtrichting), `maakZaklamp` (sinds stap 156 niet meer aan de agenten), alle getallen in `SLIM`; sinds stap 156 `langsVrij` (dekking aan de eigen kant) en `flankStap` (in een boog om de speler) |
| `js/autobinnen.js` | het interieur van de auto waar je in zit (`maakAutoBinnen(maat)`, één schil voor alle soorten, de maten uit `autoMaat` in js/carmodel.js; de Ferrari met `sportBinnen`); sinds stap 146 een ronde pook en spiegelglas; sinds stap 147 doeken op canvas (`DOEK`, `doekMat` met `userData.tegel`, `schaalUv` in `doos`: uv in meters) en veel meer onderdelen. Getextureerde materialen hier zijn enkelzijdig (tweezijdig met een kaart is een nieuw programma). Sinds stap 148 afgeronde vormen (`rond`, `profiel`: het dashboard is één doorsnede), een klokkenhuis met ronde klokken, een console uit het dashboard, en `update(car, dt, { nacht, zender, nummer })`: de radio toont de zender en het nummer, 's nachts brandt de dashboardverlichting (`klokDoeken`, `knopLicht`). Het stuur staat op cabZ − cabL/2 + 0,565 en de bestuurder op cabZ + 0,04: een nieuwe soort heeft een cabine van ~2 m nodig (`npm run binnentest`). Sinds stap 149 komen de voet van de voorruit en het dak van binnen uit `maat.ruit` (`{ z, y, tan }`) en `maat.dakZ` in js/carmodel.js: `voor` is de **bovenkant** van de voorruit, niet de voet; een nieuwe soort geeft die twee mee. Sinds stap 150 de kijkhoek van de bestuurder: `autoKijk`/`AUTO_KIJK` (instappen recht vooruit, 78° via `player.autoBeeld`, terugdraaien tijdens het rijden; js/main.js `autoOgenWas`). Sinds stap 151 ook `maat.achterRuit`, en voor de Ferrari `maat.binnenX`/`hemelB`; `stuurX` = `oog.x`; `binnentest` schiet van buiten op elke soort en niets van het interieur mag eruit steken |
| `js/verkeersregels.js` | stap 173: het verkeer gedraagt zich — kruisingen uit de BGT (`knopen`, `knopenOp` per pad), voorrang (wie op de kruising staat, de N7, een meter breder, anders rechts; `gaatVoor`, vangnet `_forceerK` na `KRUIS.vangnet` s), rotondes (`rondje`: een eigen stuk pad tegen de klok in om het eiland, `passages`, wachten voor de ring; ringassen uit `V.rijbanen`), de speler te voet (`spelerDoel`), auto's op de rijbaan met maat en draaiing (`blokkadeVoor`: stoppen, toeteren, `uitwijkPlan` of `keerHier`), en wie 15 s vaststaat keert (`BLOK.vast`); js/vehicles.js roept `voorbereid`, `doel`, `naStap` aan en draait het model met `zijHoek`; `regels.aan = false` is het oude verkeer |
| `js/rijgedrag.js` | stap 171: het rijgedrag van de auto van de speler (`vehicles.spelerVan()` in `drive`): `botsReactie` (de klap langs de normaal: frontaal remmen en `BOTS.terug` terugkaatsen, schampen met wrijving, `car.tol` draai die uitdempt, `car.duw` zijwaarts, `car.botsVoor`; `botsKracht` is de snelheid recht op het obstakel, met `klapRust`), `werkNaBij`, `werkBakBij`/`BAK` (vijf versnellingen per soort als deel van de topsnelheid, `car.versnelling`, `car.toeren`, de vijfde gasfactor 1 zodat `RIJ` en de tuning blijven), `RijCamera`/`CAM` (tot 9° wijder op snelheid en een trilling; js/main.js `werkRijCamBij`, `player.snelBeeld`); js/audio.js `motorToon`, js/autobinnen.js de toerenteller uit `car.toeren` |
| `js/vehicles.js` | geparkeerde auto's, verkeer (over `gladPad`: gladde lijn, remmen voor de bocht, keren), rijgedrag, `voegToe()`; sinds stap 211 `doelen(binnen)`: voor een schot alleen de auto's in zijn baan (js/main.js `shootCb`, één lijst per schot) |
| `js/npc.js` | voetgangers en fietsers op wegvakken; sinds stap 154 `kenmerken` (man/vrouw, kind, oud, kapsel, baard, rok, negen huidskleuren, jas en paraplu: uit het nummer, niet uit `r()`), `zetRegen`, `extraHouding` (zitten, hurken, bellen met `armZijR`, voorover), `zetExtras` (telefoon, paraplu, `grof`: een figuurtje tussen `ZICHT` 200 en `ZICHT_GROF` 350 m); varianten op schaal nul |
| `js/gedrag.js` | stap 154: wat voetgangers doen behalve lopen (`GEDRAG`): `p.doe` neemt het wegvak over — een bankje (`plekken` uit KAART.objecten), de Poiesz in Duinterpen in en uit (`verborgen`, `bijDeur` voor de schuifdeuren), de fiets in het rek naast de ingang (`rek`, `fietsen`), bellen (`p.belt`); terug naar hetzelfde punt op het wegvak. js/main.js zet hem als `npcs.gedrag` |
| `js/audio.js` | (stap 127: `OPNAMES` — explosie, heli, portofoon — als buffers via `laadOpnames`; `ACHTERGROND` sinds stap 139 één streamend element, `stad.mp3`, heel zacht, buiten de stad en 's nachts zachter, in `achtergrond`; stap 139: de garand met een eigen opname (`SCHOT.garand.url`, alleen het eerste schot, `terug` zonder opname) en de ping van de clip als opname (`M1_CLIP`, synthetisch als terugval), via `laadWapenOpnames` en `knipOpname`; `politieRadio` bij de eerste ster, `POLITIE_RADIO`; `heliRond` voor de heli van Wiebe; `vuurwerk`) alles synthetisch, plus het muziekje van de intro in de heli van missie 18 (`heliMuziek(actief)`, `HELI_MUZIEK`: 4 s aanzwellen, 7 s uit, stap 119), de mp3-radio (`autoradio(actief, sterkte)`) en het schot als opname (`schot(afstand, { wapen, bron })`, `SCHOT` per wapen, afkappen per bron, `zetSchotSoort`) |
| `js/hud.js` | minimap (bijzondere plekken op de rand: `opRand` in `drawMap`), grote kaart met legenda (`zetLegenda`, iconen per soort in `HUD.PICTO`) en een eigen doel (`kaartKlik`, `zetEigenNav`, paars), meldingen, vlaggen |
| `js/bewaking.js` | schutters: bewaking, de bende van missie 7 en 10 (met opties; `leven` en `mg` sinds stap 110: taaier volk en machinegeweren in salvo's; sinds stap 143 `uitElkaar` (m: levende mannen schuiven uit elkaar, `duwUitElkaar`) en `raakNu` (treffers geteld, ook met `schade: 0`)) |
| `js/looppad.js` | een looproute te voet om hekken en gebouwen heen (A*) |
| `js/bendes.js` | van missie 10 tot 12: groepjes van De Veteraan op straat in Tinga en langs de Lemmerweg |
| `js/deal.js` | missie 8, en `maakVeteraan()`: De Veteraan met zijn hondje |
| `js/wapen.js` | het wapen in je hand: afgeronde delen, eigen doeken, veer-terugslag, hulzen, grendel; het mes (`maakMes`, stap 123); de M1 Garand (`maakGarand`, stap 132: 8 patronen, de ping, de en-bloc-clip van boven, `KICK`); het pompgeweer (`maakTrenchgun`, stap 189, sinds stap 190 op de maten van de Winchester M1897 trench gun in `MAAT`, met het schild boven de loop en 6 × 29 gaten; sinds stap 191 de doeken van de M1 plus `stempel97Doek`, `hulsDoek` en de leren riem: 6 patronen, `POMP`, `laadKamer`, laden per patroon met `SHOTGUN_PATROON`; in js/player.js `korrels`, `hagel`, `bereik`, `perPatroon`; js/main.js `shootCb` met `korrels`) |
| `js/carmodel.js` | automodellen (gedeelde geometrie, instanced), lak met clearcoat, kenteken; eigen modellen via een geëxtrudeerd zijprofiel (`uitProfiel`): de Ferrari (`sportGeoms`) en de ambulance (`ambulanceGeoms`) |
| `js/lichaam.js` | maten, onderdelen en doeken van alle mensen; `lichaamMat`, `doekVoor`; sinds stap 153 een glad hoofd met kaak en kin, `oogwit` als eigen onderdeel (wit in het doek wordt huidkleurig), een haarlijn op een ring, een hand met vier vingers; sinds stap 154 armen en benen als draaiprofiel (`ledProfiel`), `KAPSEL`/`haarGeo` (halflang, lang, staart), `rok`, `baardVol`; ≤ 4000 driehoeken per mens (`mensechttest`); `js/persoon.js` kent `vrouw`, `kapsel`, `baard`, `rok` (`LIJF_VROUW`) |
| `js/zuilengang.js` | de zuilengang van de Poiesz in Duinterpen en zijn buurpand: zuilen, pui, plafond, woordmerk; sinds stap 152 de schuifdeuren (`SCHUIFDEUREN`, `werkSchuifdeurenBij`); de dozen van het pand liggen langs de boog achter de pui (`gangVrij` in js/kaartwereld.js), geen gras in de gang (`inZuilengang`) |
| `js/groen.js` | bomen, struiken, gras: `bolGeo`, `stamGeo`, blad- en schorsdoek, `grasVariatie`, riet, `maakGrasVeld` (gras in 3D) |
| `js/licht.js` | omgevingsschaduw aan de voet van de muren (`grondAO`), verlichte ramen 's avonds (`nachtRamen`; het masker uit een vervaagde mip met zachte drempels, `RAAM_ZACHT`, stap 116) |
| `js/schrift.js` | missie 13: het schrift van De Veteraan en politielint |
| `js/brug.js` | missie 12: het dek van de Dúvelsrak als assenstelsel (`brugAssen`), dranghekken, C4, de schade na de knal |
| `js/garage.js` | Autohuis Lemmerweg: glazen showroom, Ferrari's en BX kopen, gekochte auto's in de opslag |
| `js/race.js` | missie 14: het parcours van de BP naar IJlst (routeplanner + de hoofdweg uit de BGT), gele ringen, finish, tegenstanders langs de lijn |
| `js/bouwvlak.js` | plekken waar het spel zelf bouwt (de showroom, de loods): daar geen bomen, struiken of gras |
| `js/inval.js` | missie 16: de route van de inval over de Molenkrite, de vlucht van Bouwman van de Dúvelsrak naar een rotonde (`vluchtLijn`, `rijdVlucht`), de schuif na de klap met botsing (`crashSchuif`, `renVrij`); de lijnen via `lijnDoor` uit js/schaduw.js |
| `js/schuur.js` | missie 17: het erf van Ronald aan de Lemmerweg 80 in het assenstelsel van het huis (`erfAssen`): caravan met kluis, de zwaaiende camera met zijn kegel (`kegelRaakt`), de hond aan de ketting, de worst; de hoogte uit de kaartvlakken (`grondPeiler`) |
| `js/klusjes.js` | klusjes tussen de missies door: Mark of Johan met een K op de kaart, tas, auto, overspuiten, omleggen (€ 250–1000), en sinds stap 132 de drone (`KLUS_DRONE`: een auto volgen, de deal fotograferen, € 600–900; alleen met `player.drone`); nooit twee keer dezelfde soort achter elkaar |
| `js/studio.js` | missie 18: Radio Tinga aan de Tinga — de zendmast op het dak, de zuil, ON AIR, en de studio als binnenruimte naar een foto (gebogen bureau, schermen, mengpanelen met usb-poort en schuif, de dj Sjors); `plekken`, `bijTafel`, `zetUsb`, `zetSchuif`, `zetOnAir`, `zetSlot` |
| `js/rondvlucht.js` | missie 18, de avond: de heli van Wiebe (model uit js/helikopter.js, `bouwHeli`), Erik in de open deur, de buitencamera (`camera`, `begrens`), rustig volgen (`volg`: afstand en deur naar het doel, `RONDVLUCHT.versnel`), `landNaar`, het zoeklicht als kegel (`richtLicht`) |
| `js/intro.js` | het filmpje bij een nieuw spel: tien beelden via `beeldOp(t)` (de camera op seconde t, met `soort`), plekken uit de kaart (`zoekPlekken`; sinds stap 119 `voetbal`: het hoofdveld met een bord van Radio Spannenburg, `bordPlekken` uit js/sportveld.js), 65,3 s gelijk met `audio/intro/intro.mp3` |
| `js/wedstrijd.js` | de wedstrijd op het hoofdveld van VV Sneek, elke dag 12–15 uur: twee elftallen (4-4-2), keepers, scheids, publiek (tribune in houders), de bal; komen en gaan alleen uit beeld (`zieJe`); `aanrijden`, `raak`, `slachtoffers`; js/main.js `werkWedstrijdBij` met `wedDag`, en tijdens de intro `wedstrijdInFilm` (altijd een wedstrijd, gerekend vanaf de camera) |
| `js/ambulance.js` | de ambulance (stap 112): sinds stap 116 een eigen model (`ambulanceGeoms` in js/carmodel.js, soort 'ambulance', `maat.amb` zegt waar de zijden liggen) met de beplakking als doorzichtige doeken (`zijDoek`, `kapDoek`, `achterDoek`), zes zwaailichten met `maakGloed` uit js/politie.js, twee verpleegkundigen; `melding(x, z, wie)` met kans `AMB.kans` en rust `AMB.rust`, de rit over `lijnDoor`/`rijdVlucht`, knielen, `herstel` of een voetganger weer `alive`; js/main.js `ambulanceMelding` |
| `js/nieuws.js` | (stap 131: ook Tinga Nieuws op de tv thuis: `kopteksten`, `onthoud`, het tv-doek in js/interieur.js `tvKop`/`zetTv`) het nieuws op Radio Tinga (stap 112): `meld(soort, x, z)` uit js/main.js, na `NIEUWS.vertraag` voorgelezen als je naar Radio Tinga luistert (`update(dt, luistert)`), met de straat (`nearestRoadName`) en de muziek zachter (`demp`) |
| `js/leven.js` | stap 113 (en 124: de vuilniswagen `VUILNIS` als `voegToe`-truck, het terras `TERRAS` bij de Poiesz in IJlst): het tuinfeest (`FEEST`: kans per 45 s, een tegelvlak uit `tuinvlakken`, gasten, lampionnen, `geluid.feestTik`), de pizzascooter (`PIZZA`: Pizzeria Sneek of Cappadocia, over `lijnDoor` naar een adres uit `huisnummers`, `geluid.brommer`) en de plezierboot op de Geeuw (`BOOT`, `bouwSloep`, `vaarRoute(…, { dun: 1 })`); `doelen`, `raak`, `aanrijden`, `schrik` vanuit js/main.js |
| `js/drone.js` | stap 124: de drone (€ 1.000 bij Tinga State, `player.drone`): B/E, `start`, `terug(reden)`, de grenzen in `DRONE` (150 m, 100 m van de rand, 800 m van Erik, 10 s), `buiten()`, accu, het scherm `#droneScherm`; js/main.js `droneToets`, `waaromGeenDrone`, `droneFoto`, `laadZonderDrone` |
| `js/vogels.js` | stap 124: eenden en zwanen op het water rond de camera (`vaarbaar`), meeuwen boven de haven van IJlst; `vulAan` voor proeven |
| `js/knipper.js` | stap 124: rode knipperlichten op hoge platte daken (goot ≥ 11 m) en het lampje op de mast van Radio Tinga (`studio.topLampMat`) |
| `js/vuilniswagen.js` | stap 125: de gele DAF van Súdwest-Fryslân (`maakVuilniswagen`, `tekenLogo`: het logo op canvas), via `voegToe({ mesh })` in js/leven.js, soort `vuilnis` |
| `js/autoschade.js` | stap 124: deuken, kogelgaten en barsten als doeken in de `bak` van een auto (`botsing`, `kogel`); `vehicles.verf` en `herstelWrak` halen ze weg |
| `js/handlangers.js` | stap 127: de handlangers van Bouwman in de achtervolging van missie 18: twee auto's, later twee scooters, op lijn B achter hem (`start`, `update` → schade, `stop`, `ruim`), `HANDLANGERS` |
| `js/vuurwerk.js` | stap 127: vuurwerk aan het eind van missie 18 (één InstancedMesh, additief; `start(plekken)`, `stop`, `wis`), `VUURWERK` |
| `js/grondvuur.js` | stap 128: de mannen langs de weg van Bouwman die in missie 18 op de heli schieten, met tracers (`start(lijn)`, `update(dt, heli)` → schade, `doelen`, `raak`, `ruim`), `GRONDVUUR` |
| `js/pizzabaan.js` | stap 131: pizza bezorgen vanuit Pizzeria Sneek en Cappadocia (`PIZZABAAN`): een rit naar een adres, paarse route, € 40 + fooi, koud bij te laat; `toets`, `update(dt, { vrij })`, `afbreken`, `stand` |
| `js/tennisspel.js` | stap 131: tennis als minispel op de banen van js/tennis.js (`TENNIS`): een game, slaan in een venster, winst € 50; `toets`, `slag`, `update`, `totRaak`/`naarBal` voor proeven |
| `js/vishandel.js` | stap 131: Martens Vishandel op het parkeerterrein van de Jumbo aan de Molenkrite (`VIS`: kibbeling € 20, +25 leven, 9–18 uur); speldje `vis` |
| `js/zeilen.js` | stap 131: vier zeilbootjes die op de wind laveren (`ZEILEN`, `WIND` uit js/sfeer.js); 's nachts en bij onweer binnen, alleen uit beeld |
| `js/tuning.js` | stap 131: tuning bij Sjoerd in het Autohuis, alleen aan een gekochte auto (`TUNING`; sinds stap 170 aan de balie zelf, `balieBereik`, met de race voor geld als 6 via `geldrace.kan`/`start`; de zuil is weg): motor, vering, spoiler, velgen, decals (roosters op de flank); `#tuningMenu`, `kies(n)`, in `garage.bewaar` |
| `js/djdienst.js` | stap 131: aan de knoppen van Radio Tinga buiten de missies (`DJ`): een verzoeknummer (`geluid.radioVerzoek`), ON AIR, de schuif, € 75 |
| `js/nomercy.js` | stap 140, de bijmissie No Mercy 4 na missie 5: de set in het Tinga-bos (`maakSet`: de 8,8 cm Flak met `knal`/`herstel`, kisten, net, filmlamp, stoel; de open plek is `NOMERCY_SET` in js/bouwvlak.js), Erik Jan, de cameraman, negen Duitsers (`maakDuitser`: feldgrau, `zetHelm`, `geefWapen('garand')`), het bos als vakjeskaart (`bosKaart`: `inBos`, `uitgang`), `NOMERCY`; sinds stap 141 de tweede scène (`maakKamp`, `KAMP`: tent, radiopost met `radioKnal`, kisten, zandzakken; `maakKlapbord`; `NOMERCY_KAMP` in js/bouwvlak.js); het verloop in js/verhaal.js (`nm`, `werkNoMercyBij`, `nmKampBij`) |
| `js/tennishal.js` | stap 162: Tennishal Sneek aan de Lemmerweg 130a (BAG 0091100000013880): de hal op de maten van de 3D BAG (zadeldak van golfplaat, nok over de lengte), lichtgrijze panelen met donkere diagonalen (losse stroken, `knip`), de zwarte plint met staanders, de witte aanbouw met de entree en de blauwe luifel, het bord "tennishal SNEEK" op canvas (`tekenBord`); zet zijn pand-id zelf in `EIGEN_PANDEN` van js/aaff.js; `TENNISHAL_PAND.nu` |
| `js/molenflat.js` | stap 163: de twee flats aan de Molenkrite (BAG 0091100000006034, nrs 134–182, en 0091100000006042, nrs 184–232): de platte dakvlakken van de 3D BAG als delen (`regios`: bergingen < 4,5 m, woningen in trappen), muren tot de goot (`mansard` 2,6 m of `mansardLaag` 1,9 m onder de dakhoogte) en een mansardekap met een witte, schuin overstekende rand en een donker dakschild; donkerbruine baksteen (`steenDoek`), ramen met blauwe kozijnen en loggia's in echte gaten (`muur`, `raam`, `loggia`), bergingen met een blauwe boeiboord, schoorstenen, het trappenhuis (`torens`, een eigen BAG-pand); randen tegen een hoger deel zijn `binnen`; zet zijn pand-id's in `EIGEN_PANDEN` van js/aaff.js; 's nachts licht achter een derde van de ramen (`update(dt, nacht)`, alleen `emissiveIntensity`); `MOLENFLAT_PAND.nu`, `__game.molenflat` |
| `js/nomercy5.js` | stap 142, de bijmissie No Mercy 5 "De Overtocht" na missie 12 en No Mercy 4: de set bij Houtzaagmolen De Rat in IJlst (`maakMolenSet`: MG-nest, zandzakken, de vlag met `vlagNeer`, het zoeklicht op de stelling met bundel en vlek (`zoekAan`, `update` → de vlek), lichtkogels), de camera-boot (`maakCameraBoot`, een `bouwSloep`), de camera op het dak (`maakCameraRig`), de stafauto als eigen model (`maakStafauto`: een open Kübelwagen-achtige wagen, via `voegToe({ mesh })`, het zijdoek over een `ExtrudeGeometry` met uv = (z, y) in meters; sinds stap 145 een interieur voor de eerste persoon, `maakStafBinnen` als `userData.binnen` met het draaiende stuur en de klok, `STAF.oog`), het zijspan (`maakZijspan`, R75-achtig), de gedeelde materialen (`mat5`), `NOMERCY5`; het verloop in js/verhaal.js (het blok `n5`, `werkNoMercy5Bij`), de sluipschutter op de stelling via `Persoon.vasteGrond` (js/persoon.js), de stafauto als cadeau via `garage.schenk` |
| `js/postbode.js` | stap 141: de postbode van "Post Tinga" (verzonnen, geen merk), 8:00–11:30 (`POST`): één tegelijk, een straat bij de speler aan één kant van de weg, deur naar deur (`deurVan` uit js/pizzabaan.js, `zoekLooppad`), arm met envelop naar de brievenbus, `geluid.brievenbus`; alleen uit beeld; via js/leven.js (`leven.postbode`, `doelen`/`raak`/`aanrijden`/`schrik`: vlucht of neer, `vandaag` tot de volgende ochtend) |
| `js/bpwinkel.js` | stap 160: de shop van de BP (BAG 0091100000004556, Lemmerweg 63) van binnen, in het assenstelsel `BP_WINKEL` van js/bouwvlak.js (`bpWereld`/`bpLokaal`, u langs de voorgevel, w naar achteren; de voorkant kijkt naar de luifel): baksteen, de groene boeiboord met "shop" (`boeiDoek`, het zonnetje uit `heliosDoek` in js/tankstation.js), de glazen pui, schuifdeuren (`update(dt, punten)`: open binnen `BP.deurBereik`, de botsdoos van de deur gaat mee), tegelvloer, systeemplafond, gondels, koelvitrine, ZOETWAREN, "Bedankt voor uw bezoek", ijsvriezer, koffiehoek, de balie met de medewerker (een `Persoon` in BP-groen, `kijkNaar`); js/kaartwereld.js slaat geometrie én botsdozen van het pand over (`BINNEN_PANDEN`), het groen blijft weg via `inBpWinkel`; `BP_SHOP.nu`, `__game.bpshop` |
| `js/bpkassa.js` | stap 169: de kassa van de BP-shop (`BP_KASSA`): E voor de balie (`vak`), 1 = energydrank (€ 3, +10 leven, `player.renBoost` +5 % tot 20 %, 90 s en dan in 15 s weg; js/player.js vermenigvuldigt alleen het rennen), 2 = kraslot (€ 25, `lot.prijzen` van 0 tot 150; sinds stap 170 het kaartje `#kraslot` (`kraskaart`) en `geluid.kraslot`); `keuzes` voor een aanraakscherm, `trek` en `stand` voor proeven, `reset` bij neergaan; js/main.js `bpKassa`, `werkBpHintBij`, `__game.bpKassa` |
| `js/tiger.js` | stap 177: de gedenkplek voor de Slag om Sneek, 1944, aan de Sudergoweg (`TIGER.plek`: het weiland achter de dam bij (46, 1080); tegels, de granieten steen met de bronzen plaat, `TEKST`/`DONATIE`) en een berijdbare Tiger I op de echte maten (`maakTiger`: geëxtrudeerde zijprofielen, `bandPunten` voor de rupsband, een doek per kant dat meeschuift, de koepel als hoefijzer, het 88 mm-kanon). `initTiger`: E in en uit (`player.inTiger`, zoals de drone), W/S/A/D als een tank, de koepel en het kanon volgen de muis (`TIGER.koepel`, `TIGER.richt`), klik = `vuur` (een granaat in stappen langs de loop, js/main.js `tigerInslag`), `TIGER.herladen` 8 s, `zetCamera` (binnen langs de loop, V van buiten), een losse botsdoos (`beweegt`), `blok` voor het verkeer (`vehicles.extraBlokkades`); `__game.tiger` |
| `js/geeuwbrug.js` | stap 161: de oude Geeuwbrug aan de Geeuw (BAG 0091100000016709): het betonnen landhoofd op het BGT-bouwwerk (`geeuwAssen`: richting, breedte, het eind aan het water, de zijde van de toren), graffiti op canvas (`tekenGraffiti`, `tekenKop`, `tekenVoet`), de cabine met blauwe kozijnen en het bordje "Geeuwbrug" (`tekenBord`), eigen botsdozen; js/kaartwereld.js slaat geometrie én botsdozen van het pand over (`GEEUW_PANDEN`), het groen blijft weg via `GEEUWBRUG` in js/bouwvlak.js; `__game.geeuwbrug` |
| `js/autodetail.js` | stap 172: remlicht, achteruitrijlicht, wielen en bestuurder van een rijdende auto, afgelezen aan de beweging (niet aan de rijcode): `werkAutoBij(car, dt, invoer)` uit `zetNeer` (met toetsen de rem, anders de vertraging > `remDrempel` 1,6 m/s², blijft aan bij stilstand na remmen), `werkVerkeerBij(t, dt, camX, camZ)` aan het eind van `updateTraffic`, `zetVer` (voorbij 90 m de samengevoegde wielen, geen bestuurder), `spelerInAuto(car, derde)` uit js/main.js (Erik zichtbaar in de derde persoon), `car.metBestuurder` om het af te dwingen; rolhoek = afstand langs de neus / straal, de stuurhoek uit `car.steer` of uit de draai; `AUTODETAIL` |
| `js/bestuurder.js` | stap 172: de bestuurder als grof, gedeeld figuur (één mesh, ~1200 driehoeken, hoekpuntkleuren, acht varianten en `erik`): `bestuurderPlek(maat)` uit de regels van js/autobinnen.js (zitting, stuur, hemel, `oog`), `maakBestuurder(kind, maat, variant)`; geen doel voor kogels. js/carmodel.js `makeCar(kleur, soort, 'verkeer', variant)` geeft het verkeer losse wielen, rem- en achteruitrijlicht, de bestuurder en de rode `remgloed` (die hangt aan het remlicht, `zetKoplampen` zet zijn sterkte); de naaf rolt nu mee (`wielen[i].naaf`) |
| `js/vouwwagen.js` | stap 184: een uitgeklapte vouwwagen op het gras aan de Wieken (`maakVouwwagen`, `initVouwwagen`; de plek `VOUWWAGEN` in js/bouwvlak.js, gezocht over de kaartdata, met een gedraaide doos in `inBouwvlak`; op de `y` van het grasvlak via `vlakOp`); `__game.vouwwagen` |
| `js/omstanders.js` | stap 188: omstanders die je kunt raken buiten de vaste doelenlijsten: `registreer(persoon, { wie, mag, opNeer, opTerug })` (alleen gewone omstanders: de zeilers, de plezierboot, het terras, de klanten van de supermarkt; wie een rol heeft, zoals Sjoerd, de BP-medewerker, de verkopers en het personeel, bewust niet), `doelen`/`raak` in het schot, het mes en `explosieRaakt`, `update` na de modules (omvallen, na `OMSTANDER.terug` weer op), `isNeer` |
| `js/praatjes.js` | stap 192: de praatjes van Mark en Johan (`PRAATJES`, regels als [wie, tekst]) en `kiesPraatje` (nooit een van de laatste vier); js/verhaal.js zet `praatMark` op de stoep van Molenkrite 15 en `praatJohan` op de oprit van Kruirad 62 als het verhaal ze niet nodig heeft (`praatHoort`, `praatBotst`, alleen uit de buurt wisselen), E = `praatjeToets`; na het einde keuze 3 in het uitje; `verhaal.praatjes` voor proeven |
| `js/yugo.js` | stap 204: sushi eten bij Yugo met Johan — de zaal buiten de kaart (`NUL` = gebied + (800, 1250)) naar de foto's: steenstrips met het verlichte penseellogo (`tekenWandLogo`), blauwe bank, emmerlampen, hek, ronde tafels, sushibar met keukendeur, gasten; de tablet (`#yugoTablet`, `tekenLogo`, `tekenGerecht`: 1–4 sushi uit `SUSHI`, 5 `DRANK` Pornstar Martini, 0 wissen, 6/E bestellen, hoogstens `YUGO.maxSushi`), de ober over `OBER_PAD`, de plankjes op tafel (`plekOpTafel`), eten met stokjes aan de camera (E, `werkStokjesBij`), Q een slok, Johan eet zelf en bestelt altijd meer (`johanKeuze`), vijf rondes, `YUGO_TEKST`; een binnenruimte in js/main.js (`yugoZaal`), het verloop in js/verhaal.js (het blok `yugo`: het voorstel bij het eerste praatje met Johan en na elk praatje over Yugo, 1/2 via `kiesHuis`, "Die avond, bij Yugo in Sneek…" om 19:00 met de klok stil, X = `yugoAfbreken`, terug op de oprit van Kruirad 62; opslag `yugoGevraagd`, `yugoKeer`); sinds stap 205 `player.aanTafel` (geen wapen trekken, wisselen, herladen, richten of schieten tot je weg bent) en de gesprekken tussen Johan en Erik (`YUGO_TEKST.gesprekken` met `als`, de stand uit `onderwerpen` in js/verhaal.js; `kiesGesprek`); sinds stap 211 **shift+Y** (`verhaal.startYugoLos`) meteen aan tafel; sinds stap 206 achttien gasten die zelf eten (`gasten`, `werkGastenBij`, `eetArm`; de zithouding als `zitting / hoogte`); het muziekje `geluid.yugoMuziek` (`YUGO_MUZIEK`, koto en fluit, gemaakt) |
| `js/statistiek.js` | stap 195: de statistieken over het hele spel (`werkBij` uit de hoofdlus, `tel` uit `shootCb` en `autoOntploft`, `regels`, `bewaar`/`herstel` in de opslag, `opnieuw` na een checkpoint, `nieuw`); het paneel in het pauzemenu (`menu.zetStatistiek`), "Jouw spel in cijfers" in de titelrol (`verhaal.voortgang`); `__game.statistiek`. Het ontwerp voor de geocache staat in docs/ontwerp-geocache.md (nog niet gebouwd) |
| `js/geocache.js` | stap 196: de Tinga Cache — vijf caches (`CACHE`, `zoekVrij` met `inPand`), de omrekening naar graden en minuten (`maakOmrekening`, `tekstN`/`tekstE`), de GPS op canvas (`#gpsToestel`, N aan/uit, cijfers en backspace via js/main.js), Sjors op de stoep van Radio Tinga (`hud.zetSjors`), de posters (BP-balie, prikbord Radio Tinga, eettafels), het bordje van de multi, de beloning (€ 2.500 en `zetGoud` op de M1 in js/wapen.js); de GPS aan de BP-kassa (3, `gps` in js/bpkassa.js); opslag via `registreerOpslag` (js/opslag.js); `__game.geocache`; sinds stap 197 de GPS in 3D in je linkerhand (`maakToestel`, `GPS3D`, op de wapenlaag aan de camera, het scherm het canvas `lcd`; js/main.js tekent de wapenlaag ook als `geocache.inBeeld`) met `player.gpsInHand`/`gpsPak`/`gpsWeg`/`opGpsWeg`/`gpsDichtbij` in js/player.js (geen wapen, niet schieten; klikken, R, een wapen kiezen of H stopt hem weg; rechts dichterbij), en de gouden M1 met echte doeken van goud (`goudDoek`, `goudStempelDoek`, `stempelLetters` in js/wapen.js); sinds stap 198 de posters bij het opstarten (ook zonder GPS) en de caches pas met GPS én na Sjors (`st.intro` in `huidig` en `werkZichtBij`); `npm run cacheplekshots` fotografeert de vijf plekken; sinds stap 199 pas na missie 5 (`kan` = `verhaal.na5`: de GPS aan de kassa via `gps.kan`, en de posters), niet in missie 18 (`sjorsWeg` = `verhaal.sjorsInStudio`), bij Sjors wijkt de R van Roan (`verhaal.zetRoanWijkt`), en met een keuze open laat de GPS de cijfers met rust; sinds stap 200 staat cache 4 op een meerpaal in het water (`zoekPaal`, `PAAL`: bevaarbaar, ≥ 3 m van de oever); sinds stap 207 geen GPS in de derde persoon, te voet en in de auto (`derde` uit js/main.js in `magVasthouden`); sinds stap 211 past het raadsel altijd op het scherm (kleinere letter, `pas`), blijven het bordje en de logboeken in de GPS staan |
| `js/schaduw.js` | missie 15: de route van Bouwman (BP → Duinterpen → N7), zijn rit met een stop, de loods aan het water met container, kade, steiger en boot, de fotoplekken |

Een paar dingen die niet vanzelf spreken:

- **Licht zit in de hoekpunten.** Er staan geen lampen in de scene; `schaduw(geo)`
  bakt de belichting in de vertexkleuren en dag/nacht gaat via materiaaltinten.
- **Binnenruimtes staan buiten de kaart.** Elke woning is een losse kamer ver
  buiten het gebied (`NUL`), met een "kijkdoos" van nagebouwde buren eromheen.
  De voordeur teleporteert. Daarom hoort alles wat je binnen ziet te kloppen met
  het adres, en zijn de ramen dichtgemaakt.
- **NPC's leven op wegvakken.** `p.seg` en `p.t` bepalen x/z, elk beeld opnieuw.
  Een handmatig gezette positie overleeft één beeld.
- **De wijk slaapt 's nachts** (stap 83, 87). `sfeer.drukte` (1 overdag, 22:30→23:30
  naar 0,16, 05:00→06:30 terug) schaalt het aantal mensen en auto's: wie boven
  zijn vaste drempel zit krijgt `slaapt` (geen lichaam, geen update, geen getuige,
  een auto ver buiten de wereld); dat wisselt alleen uit het zicht. Wie door
  `npcs.people` of `vehicles.traffic` loopt, slaat slapers over;
  `sfeer.lampenAan` dooft na middernacht tweederde van de lantaarns in
  woonstraten (per tegel twee stapels koppen, `MAT.lamp` en `MAT.lampNacht`, en
  hun plas licht dooft mee). De drie straatlampen zijn een vaste pool in
  js/sfeer.js (`zetLampen`): 's nachts altijd zichtbaar, alleen hun sterkte gaat.
- **De plattegrond komt uit het grondvlak.** `plattegrond(pand)` en
  `banden(punten)` maken van een BAG-voetafdruk kamerbanden; de woonkamer is de
  eerste band over de volle diepte.

## 4 · De geodata-keten

Bron in `data/geo/bron/` (BGT `.gpkg`, 3D BAG `.city.json`) → `npm run geo:bgt`
en `geo:bag3d` → `npm run geo:genereer` → `js/kaart.js`. Stijl per straat en per
pand staat in `data/stijl/straten.json`, omgevingsobjecten in `omgeving.json`.
`npm run geo:steekproef` rendert twaalf vaste adressen vanaf de straat met de
Street View-link erbij.

## 5 · De missies

1. Molenkrite 15 — kennismaking met Mark (sinds stap 129 speelt Kali uit het radiootje: `kaliRadio`, `geluid.kali`; sinds stap 119 springt er na de eerste treffer een op en schiet terug: `springOp`, een `Bewaking` van één man)
2. naar de waterzuivering — rijden (Mark praat onderweg: `RIJDEN_ONDERWEG`)
3. de bewaking
4. afleveren bij de boerderij — vrachtwagen (110 m van de poort een ster, `AFLEVER_ALARM`; Mark wacht bij de schuur, `markBijDeBoerderij`; zonder sterren € 500)
5. het telefoontje van Johan — achtervolging te voet (de dief 6,7 m/s; met een auto achter hem aan de tuinen in: `TUIN` en `kiesTuin` in js/dief.js, `tuinPuntenBij` in js/verhaal.js)
6. de groene BX — stelen en overspuiten
7. de bom bij de Poiesz — Duinterpen
8. de deal bij de molen — sniper en boten
9. **een eigen stek** — drie woningen kopen
10. **De Veteraan** — de tas bij VV Sneek en de hinderlaag
11. **de politieauto en de C4** — stelen aan de Lemmerweg, C4 bij Tinga State
12. **de Dúvelsrak** — de wegversperring met C4 op de brug, De Veteraan
13. **het schrift** — Mark in Duinterpen, het schrift uit de sloep in IJlst
14. **Ronald en de race** — Lemmerweg 80, Bouwman, de race van de BP naar IJlst
15. **Bouwman schaduwen** — Mark en het schrift, Bouwman volgen, foto's bij zijn loods
16. **De inval** — drie minuten om Mark weg te halen, de ruil op de Dúvelsrak, Ronald is ???
17. **Wie is R.** — het erf van Ronald 's nachts: camera, hond, de kluis in de caravan, Ronald met zijn geweer
18. **De uitzending** — 's avonds de heli boven Bouwman, de achtervolging, de loods, de C4 op de Dúvelsrak; zondag de usb-stick bij Radio Tinga, het fragment over heel Sneek, het einde en vrij spelen (laatst gebouwd)

Missie 9 in het kort: Mark belt, staat bij de Wieken 29, noemt drie adressen met
bedrag (**1, 2 of 3** kiest en zet de navigatie), en je koopt er aan tafel een
met E. Te weinig geld houdt het aanbod open; alle drie bekeken zonder kopen rondt
de missie af en laat het aanbod staan.

Missie 10 begint een tussenpoos (`TUSSENPOOS`, 150 s) na het kopen: De Veteraan belt, staat met zijn hondje op
het fietspad bij De Terpensmole, stuurt je om een tas voor de tribune van VV
Sneek. Dan zacht naar zwart, "Enkele uren later", en je staat om 01:00 voor je
eigen huis (of de Wieken 29); dat regelt `werkZwartBij` in js/verhaal.js op
`update(dt)`, met de laag `#overgang` in index.html. Bij het oppakken komen vier
auto's met tien man naar het inritje aan de Molenkrite; die komen het veld niet
op maar gaan rond de ingang staan (`ingang()`, Bewaking met `houden`) en wachten
je op. Daarna is hij weg,
belt Mark (omleggen, te snel in de rangen, ga naar huis) en is het thuis — het
gekochte huis — klaar voor € 250. **shift+0** start hem los.

Missie 11 begint 25 s na missie 10, zonder telefoon: alleen een M bij Molenkrite
15. Binnen zit Mark op de bank (`opDeBank`, `update(dt, { zit })`, de zithouding
uit js/lichaam.js) en vraagt om een politieauto en C4. De auto staat aan de
Lemmerweg (`politieautoPlek`, `politie.parkeerAuto`); instappen geeft twee
sterren, en pas zonder sterren gaat de nav naar Tinga State. Daar liggen vier
blokken C4 op de toonbank (`boerderij.toonC4`), E aan de balie: "Mark had al
gebeld", gratis, `player.c4 = 4` (bewaard). Auto en C4 bij Molenkrite 15:
€ 1.000, en Mark zegt dat hij binnen zijn plan vertelt. **shift+min** start hem los.

Missie 12 begint als Mark na missie 11 uitgepraat is: weer een M, binnen het
plan op de bank. De Dúvelsrak heet in de kaart "Viaduct Tinga" (het dek van 51 m
op 5,6 m; `brugAssen` in js/brug.js, s vanaf de Tinga-kant, u opzij). Zwart
("Die avond…", `zwartMet`), politiepak (`derde.pak`, eigen poppetjes `brugMark` en
`brugJohan`), de politieauto dwars op het dek, drie dranghekken en vier C4 met E op
gele markeringen, Mark kijkt naar 100 kogels en 100 leven, Johan komt. Zwart
("Even later…"), het filmbeeld (`werkFilmBij` zet de camera; `body.film`), vier
auto's van de Lemmerweg-kant, `Bewaking` met `rustig` en De Veteraan als wachter 0.
E laat de C4 afgaan, het gevecht, vier van de achterkant (`voegToe`), vier sterren
met `politie.rust` tot Mark uitgepraat is, dan `stuurWagens` van de Molenkrite-kant.
Tinga-bos: € 5.000, en de brug houdt zijn gat. **shift+=** start hem los.

Missie 13 (bedacht bij het verzoek "bedenk een verhaal dat haalbaar is"): in het
bos zegt Mark dat ze op de achtergrond blijven; vijf tellen na MISSIE GESLAAGD
zwart ("Een paar dagen later", `naarDeMiddag`: 14:30, voor je eigen huis). Mark
staat voor Parelmoervlinder 3 in Duinterpen (`SCHRIFT_HUIS`), bij hem begint het
gesprek vanzelf. Het schrift ligt in de sloep aan de IJlster ligplaats
(`boten().ruw(1)`, op het kussen van een bank), met politielint (js/schrift.js) en
twee agenten (`Bewaking` in uniform; gezien = twee sterren). Terug bij Mark, niet
met sterren: € 2.500. **shift+[** start hem los.

Missie 14: een tussenpoos na het schrift belt Ronald (`RACE_WACHT`), R op de kaart bij de
Lemmerweg 80. Bij zijn schuur: Bouwman, de races; geen Ferrari (`eigenFerrari`, uit
js/garage.js) dan een A bij het Autohuis en legt Ronald bij wat je tekortkomt. Gekocht:
hij belt, "Die nacht…", 01:00 op de grid (`opDeStart`, `ctx.stapIn`), Bouwman en Ronald
langs de kant met zijn politieauto. Aftellen, de race (js/race.js), eerste bij de finish in
IJlst: stoppen bij Bouwman, € 2.000. Lichtpijlen op de weg (`race.toonPijlen`); de tegenstanders
blijven bij (`RACE.bijblijven`) en wijken uit. Verloren (`raceVerloren`, niet via `mislukt`, dat de
opslag laadt): Bouwman, dan 1 dubbel of niks of 2 de schuld betalen (`raceKeuze`, via `kiesHuis`).
Een kleinere ring in de top van elke scherpe bocht (`RACE.bochtRing`; de eerste rotonde), piepjes
bij het aftellen (`geluid.aftelPiep`), geen wijkverkeer op de route (`vehicles.vrijeZone =
race.opRoute`, `maakVrij`). Na GESLAAGD of betalen vijf tellen, dan "De volgende ochtend"
(`naDeRace`, `naarDeOchtend`: 09:30, `springNaarHuis`). **shift+]** start hem los.
Daarna **racen voor geld** (stap 114): Ronald belt `GELDRACE_TIP` s na de ochtend (vóór missie 15); E bij Sjoerd aan de balie
(`geldraceToets`, `garage().plekken.balie`), 1/2/3 via `kiesHuis` → `geldKeuze` (`GELDRACE_INLEG` 500/1000/2500), dan
`missie = 'race'` met `geldInleg`: dezelfde `opDeStart` en race zonder Bouwman, `geldUitslag`/`geldVerloren` in plaats van
het verhaal, `geldKlaar` → fase `geldKlaar` → vrij spelen. De tussenpoos staat stil zolang `geldInleg`; `bewaar` slaat een
geldrace op als vrij spelen.
Tot stap 96 heette brigadier Bouwman "De Boer" (gevraagd: "net wat anders").

Missie 15 (stap 96): een tussenpoos na de ochtend belt Mark (`SCHADUW_WACHT`), M bij Molenkrite 15,
binnen op de bank het schrift ("B. — opslag aan het water"). "Die avond…" om 23:00 in de grijze
Golf van Mark op het voorterrein van het Autohuis; Bouwman (`raceBouwmanAuto`, `bouwman` uit missie
14) bij de pomp van de BP. Hij rijdt de lijn uit js/schaduw.js (`rijd`, 2,2 km door Duinterpen, stop
bij Parelmoervlinder 3); volgen met de balk `#schaduwbalk`: dichter dan 22 m (Ferrari 45, stilstaand 40) drie tellen =
gezien, twee sterren, `mislukt`; verder dan 170 m vijf tellen = kwijt. Bij de loods
(`LOODS` in js/bouwvlak.js, x 1396–1418, z −194…−182) drie foto's met E op een gele ruit, recht naar
het onderwerp kijkend (`fotoHier`); de twee mannen zijn een `Bewaking` (`schaduwMannen`). Gezien bij de
loods: Bouwman vlucht (`rit.vlucht`), Mark geeft de helft. Terug op de bank: € 1.500, "blijf hier
maar even slapen", zwart, "De volgende ochtend" (`wakkerBijMark`: 10:00, voor de deur). Van "Die
avond…" tot de ochtend staat de klok stil (`klokLoopt` in de ctx). Rotondes neemt hij tegen de klok
in (`rotondes`, `eenrichtingRotondes` in js/schaduw.js). **shift+\\** start hem los.

Missie 16 (stap 101): een tussenpoos na de ochtend bij Mark belt Johan (`INVAL_WACHT`), een inval op
Molenkrite 15. De balk `#schaduwbalk` telt drie minuten af (`INVAL_TIJD`); binnen E bij de bank (schrift)
en de radio op het dressoir (foto's), Mark gaat mee naar buiten en stapt in (anders de Golf van Mark voor
de deur, `plekVoorDeDeur`). Dan het filmbeeld `invalFilm.soort === 'inval'` (twee politieauto's met
`zwaailicht` en een zwart busje over `invalRoute` uit js/inval.js), drie sterren en `stuurPolitie`.
Afgeschud: de Wieken 29, Bouwman belt, 1 of 2 via `kiesHuis` (`invalKeuze`). "Die nacht…" (01:00, klok
stil): filmbeeld `brug` (de auto van Bouwman over `brug.vanLemmerweg` tot s = 34), zijn twee mannen als
`Bewaking` met `rustig` in `schutters`; wapen weg binnen 40 m, E op de ruit (s = 18): de tas. Bij 1:
`schriftKwijt`, Johan vrij, Bouwman rijdt weg, € 1.000. Bij 2: filmbeeld `nu` vanaf het dak, twee man
neer, `vluchtLijn` (een draai op het dek, de helling af, naar de rotonde), ram hem (drie klappen of één
boven 60 km/u): filmbeeld `crash`, E bij zijn auto: de telefoon ("— R."), € 3.000; kwijt € 2.000.
Daarna "De volgende ochtend" (09:30, `invalOchtend`). **shift+;** start hem los.

Missie 17 (stap 103): een tussenpoos na de ochtend belt Mark (`RONALD_WACHT`); voor Molenkrite 15 hangt
lint (`molenLint`, zolang `invalKlaar` en nog niet `uitzendingKlaar`). M bij de Wieken 29, binnen Mark op de bank en Johan (`invalJohan`)
bij de tafel; E bij de koelkast (`ronaldBijKoelkast`, ook in `aanspreekbaar`) geeft de worst. Naar buiten:
"Die nacht…" (01:00, klok stil), naast de Golf van Mark aan de weg Tinga (`golfPlek`). Het erf staat in
js/schuur.js: argwaan in `#schaduwbalk` (kegel 0,55/s, blaffen 0,09/s, zakt 0,04/s; vol of een schot =
`erfAlarm`), E op ≤ 10 m van de hond gooit de worst, E bij de caravan kraakt (7 s, blijven staan). Dan het
filmbeeld `ronaldFilm.soort === 'koplampen'`: Ronald (de `ronald` uit missie 14) in zijn BX over `erfRoute`
(met de hand: de Tinga heeft in de kaart geen knooppunt met de Lemmerweg; `gladLijn`), bij alarm twee auto's
en vier man (`Bewaking`, `rustig` tot het eind). Stil: het gesprek (niet schieten: `schietSlot`), € 2.500;
gezien: het gevecht, Ronald rent weg (`loopt`), thuis zonder sterren, € 1.500. Ronald is nooit een doelwit.
Daarna "Aan het water…" (`LOODS_ZWART`) en het filmbeeld `loods` (Bouwman bij `schaduw.bouwmanStaat`), en
"De volgende ochtend". Opslag: `ronaldKlaar`, `ronaldPraatte`, `ronaldWeg`, `ronaldSchrift` (het schrift
terug na de ruil), `erfHeeftWorst`. **shift+'** start hem los.

Missie 18 (stap 107, de laatste): een tussenpoos na de ochtend van missie 17 belt Mark (`UITZENDING_WACHT`), M bij
de Wieken 29, binnen Mark op de bank en Johan met de usb-stick. Naar buiten: eerst **de avond** (stap 109;
sinds stap 110 "Die nacht…", 01:00, klok stil, `startAvond`): Erik in de deur van de heli (`avondHeli`, js/rondvlucht.js;
`player.zit`, de camera via `werkDeurBij`) boven Bouwman, die over lijn A (`avondLijnen`: loods → BP) rijdt;
schoten tellen (`avondTreffers`) maar zijn auto blijft heel. Onder de luifel van de BP (`luifel`) landt Wiebe
bij het Autohuis (`landPlek`), `naLanden`: een zwarte Ferrari met Mark en Johan. Instappen: de achtervolging
over lijn B (`avondTweede`; verder dan `AVOND_KWIJT` 300 m tien tellen = `mislukt`), bij de loods het gevecht
(`AVOND_POSTEN`, Bouwman wachter 0; `AVOND_LEVEN` 2 en 3 treffers, `AVOND_MG` twee met een machinegeweer — `leven`
en `mg` in `Bewaking`, de sniper legt iedereen in één keer neer; Mark en Johan raken om de 3,5–5,5 s een man, nooit
Bouwman; opnieuw na het neergaan begin je bij de loods, `startGevechtOpnieuw`), dan `politieKomt`:
vier sterren, de nav naar de Dúvelsrak. Over het dek (`werkPolitieBij`, in de rijrichting, genoeg dek voor
25 m): het filmbeeld `brugFilm` met Johans laatste C4 (`avondC4`), de politie remt ervoor, `sterrenWeg`. Tot
het gevecht geen sterren (`AVOND_ZONDER_STERREN`); in de heli en op de brug doet E niets (`AVOND_VAST`) en houdt
`werkDeurBij` de camera in de eerste persoon (V); de achtervolging gaat met de auto waar je in zit; Johan vult je
kogels aan tot `AVOND_KOGELS`. Dan "Zondagochtend" (07:45, `naarDeStudio`, thuis). Radio Tinga staat in js/studio.js: het pand van type `zorg` aan het voetpad Tinga
(de auto parkeer je aan de Molenkrite, ~40 m), de deur op de gevel het dichtst bij de Tinga, de mast op
het dak; binnen een losse kamer (`NUL` = gebied + (640, 1250)). Johan wacht bij de ingang; de deur zit
dicht (`zetSlot`) tot hij belt; dan `UITZENDING_TIJD` (60 s) in `#schaduwbalk`, E aan de tafel
(`bijTafel`) de stick, E de schuif: het filmbeeld `uitzFilm` met `montageShots` (zeven shots over
de stad, buiten de botsdozen uit geduwd, elk met een `vast` voor de LOD) zolang `audio/radio/uitzending.mp3`
duurt (`geluid.uitzending`, 40,2 s; autoradio, huisradio en missiemuziek zwijgen eronder). Te laat:
Sjors komt terug, `mislukt`. Buiten Mark en Johan, € 10.000, "Die avond…" (`startEindFilm`, 20:30, klok
stil), de titelrol (`#titelrol`, z-index 7 en buiten `#ui`, E slaat over) en `naDeTitelrol`: `missie = 'klaar'`, geen
volgende missie, `geluid.zetHerhaling(true)` (het fragment in de lijst van Radio Tinga). Opslag:
`uitzendingKlaar`. **shift+/** start hem los. De ondertitels van het fragment (`UITZENDING_ONDERTITELS`): Erik en
Mark de eigenaren van de drugshandel in Tinga, en "Erik: van harte gefeliciteerd met je verjaardag" (echt: het
spel is een cadeau); de titelrol eindigt daar ook mee.

**Na het einde: een middag met Mark** (stap 115, het `uitje` in js/verhaal.js, geen missie: `missie` blijft
'klaar'). `UITJE_WACHT` na de titelrol (en `UITJE_OPNIEUW` na een uitje) een M-vlag zonder route (`zetMarker`)
bij Molenkrite 15; het lint is weg zodra `uitzendingKlaar`. Binnen Mark op de bank, 1/2 via `kiesHuis` →
`uitjeKeuze`. 1: "Die middag…" (`UITJE_AFTRAP` 12:12, klok stil; "De volgende middag…" na twaalven, "Even
later…" als hij al loopt), `ctx.wedstrijdKlaar(morgen)` in js/main.js zet de wedstrijd klaar (`wedDag`), de
Golf van Mark voor de deur (`plekVoorDeDeur`, `stapIn`), nav V naar `tribune().weg`; daar loopt Mark over
`zoekLooppad` naar `uitjePlek()` (voor de tribune, `UITJE_LIJN`: tussen de zijlijn en de borden), E = bier
(`UITJE_BIER`), juichen op `wedstrijd.stand`, na `UITJE_KIJK` of verder dan `UITJE_WEG` of gestaakt: `uitjeEinde`.
2: `gaZitten`, "Een paar uur later…" (+3 uur). Tijdens het uitje geen klus (`uitjeBezig` in `vrijVoorKlus`);
laden ruimt op (`ruimUitjeOp` in `stopNaloop`).

**Bijmissie No Mercy 4** (stap 140, js/nomercy.js en het blok `nm` in js/verhaal.js): na missie 5 staat Erik Jan
bij de poort van de waterzuivering (`nmEJPlek`, de gele ruit EJ: `hud.zetEJ`); ga je er niet heen, dan belt hij
`NOMERCY.belNa` (30 s) na missie 5, niet tijdens een klus of een missie. `missie` blijft wat hij was (missie 6 wacht
onder zijn M); zolang de opnames lopen (`nmBezig`) wacht het verhaal als bij een klus (`vrijVoorKlus`, `wachtOpKlus`,
`toets`, de tussenpoos) en kan er niet opgeslagen worden. "Even omkleden…": uniform (`derde.pak = 'soldaat'`), M1 en
200 patronen in bruikleen (`nmLeenUit`/`nmLeenTerug`: alles boven je eigen voorraad gaat terug, een eigen M1 blijft),
met de cameraman (`nmCamBij`) naar de Flak, C4 op de ruit (E), de knal op 15 m, vier Duitsers (`Bewaking` met
`schade: 0`, `leven` 1–3 per man, `klank: 'garand'`; `raak` telt elke treffer als één), het bos uit (`bosKaart`),
vijf erbij (sinds stap 143 ieder een eigen doel om je heen en `uitElkaar: NM_UIT_ELKAAR`; een treffer geeft een rode flits zonder schade, `nmRaakFlits`), en sinds stap 141 geen "Cut!" maar `take2` ("Goed zo — nu de tweede take!", zwart) en **het bunkerdorp**:
`NOMERCY_KAMP` in js/bouwvlak.js (−63, −214, r 12; `start` 32 m west), `maakKamp`/`KAMP` en `maakKlapbord` in js/nomercy.js,
de stafauto `nmStaf` (sinds stap 143 het eigen model `maakStafauto` uit js/nomercy5.js, niet bestuurbaar, op 1e5 als hij niet nodig is), botsdozen `nmTentDoos`
en `nmRadioDoos`. Twee schildwachten (`zicht` NOMERCY.wachtZicht 16 tot het alarm, `nmAlarm` zet 48); gezien of gehoord
(`nmSchot` in `schotGehoord`) = gevecht, nooit opnieuw. E bij de tent (`nmKaartPakken`): `nm.stil`, `geluid.luchtalarm`,
zes figuranten; alles neer → de radiopost (C4, `NOMERCY.radioAfstand`, `radioKnal`), de close-up (3 s stil op de ruit,
`nm.stilT`, `#schaduwbalk`), `geluid.applaus`, het klapbord, de keuze `nm.fase === 'keuze'` (in `kiesHuis` en `openKeuze`):
1 = € 1.000 en de bruikleen terug, 2 = de M1 en de overgebleven patronen houden (`nm.m1`); met een eigen M1 geen keuze.
De fasen staan in `NM_KAMP_FASEN`; daar telt de grens van 160 m vanaf het kamp; in `NM_VRIJ` (take2, applaus, keuze) geen
grens en geen X. `noMercy.naarKamp()` springt erheen (proeven, foto's). Mislukt (te ver, in een auto, X), neergaan, laden
en `startMissie` ruimen op (`nmRuimOp` → `nmRuimKampOp`).
Opslag: `noMercyKlaar`, `noMercyGebeld`, `noMercyBel` (een oude opslag van na missie 5 krijgt alleen de EJ, geen telefoontje),
`noMercyM1` (de M1 zelf zit in de wapens van js/opslag.js). **shift+.** start hem los.

**Bijmissie No Mercy 5, "De Overtocht"** (stap 142, js/nomercy5.js en het blok `n5` in js/verhaal.js): na missie 12 (De
Veteraan is dood) én No Mercy 4 staat Erik Jan op de kade in IJlst (`n5EJPlek`: het dichtstbijzijnde echte land bij de steiger
van de sloep, want de `wal` van die ligplaats ligt op de steiger boven het water) met de EJ (`hud.zetEJ`) en één melding
(`n5.gemeld`). **Hij belt nooit** (gevraagd: "puur op de kaart"); E bij hem begint het. Een eerbetoon: De Veteraan speelde sergeant
Van der Wal in deel 1–3. "Die nacht…" (01:00, klok stil via `klokVastDoorVerhaal`), uniform en de bruikleen van No Mercy 4
(`nmLeenUit`/`nmLeenTerug`), in de sloep van IJlst (`SCHRIFT_BOOT`, `n5NaarBoot`) met twee figuranten aan boord en de camera-boot
met Erik Jan en de cameraman ernaast (`n5BootBij`, nooit de wal op: `boten.pastHier`); mensen in een boot zijn kinderen van de
boot met `vasteGrond`. Het zoeklicht op de stelling (de vlek kost het filmpunt `licht`), lichtkogels, het MG en de sluipschutter
(`groepA`, `houden`, `schade: 0`, de sluipschutter met `vasteGrond` = de stelling). Aan wal bij de ruit (`NOMERCY5.aanleg`; te vroeg
van boord = mislukt): drie man aan de voet (`groepB`), alles neer (binnen 60 s = filmpunt `snel`), de vlag (E), dan de rit: de
stafauto op het begin van `NOMERCY5.rit` (553 m door IJlst, het begin precies op het eind van de as van het Sneekerpad, anders keert
de routeplanner eerst), de camera-auto ervoor (`n5CamAutoBij`: wacht als je achterblijft), twee zijspannen erachter
(`n5MotorenBij`); tussen 8 en 25 m blijven (`#schaduwbalk`), anders na 3 s "Cut!" en de rit opnieuw (`n5Cut`, `n5RitKlaar`;
filmpunt `take1` weg). Stil op de ruit (`n5Wrap`, filmpunt `stop` binnen 1,5 m), "Een week later…" (`n5Premiere`, 20:00 op de kade,
"Opgedragen aan De Veteraan"), keuze 1 = € 2.000, 2 = de stafauto (`garage.schenk`, in de opslag als eigen auto). Mislukt (te ver,
een andere auto, X), neergaan, laden en `startMissie` ruimen op (`n5RuimOp`). Opslag: `noMercy5Klaar`, `noMercy5Gemeld`,
`noMercy5Staf`. **shift+,** start hem los. Sinds stap 167 ziet de sluipschutter je echt (de stelling ligt in de botsdozen van het
molenpand: `dozenOp`/`negeer` in `zichtVrij`, de romp via `zichtMag`), staan de posten op een gemeten vrije plek (`n5VrijePost`), en
staan bij No Mercy 4 en 5 de laatste één of twee als rood ruitje op de kaart (`zetLaatsteVijanden`, `hud.zetVijanden`); in No Mercy 4
komen Duitsers die je 12 s niet zien je zoeken (`jagen` in js/bewaking.js) en lopen ze het water niet in (`droog`).

**Bijmissie Roan naar Ma** (stap 178, het blok `roan` in js/verhaal.js): na missie 5 een R (`hud.zetRoan`) op de stoep van
Radio Tinga (het pand is ook een school). `ROAN.belNa` (90 s) na missie 5 kan het: sinds stap 193 vóór het einde alleen met E bij de R (`roanToets`, `ROAN.bijR` 6 m; langsrijden
onder een wachtende missie belde eerst vanzelf en nam de navigatie van die missie over), en in vrij spelen na het einde belt Mark vanzelf. Roan (een `Persoon` op 0,58, hoofd 1,28) staat dan bij de speeltoestellen (315, −85) en volgt je spoor
(`roanVolg`, ook mee de auto in) naar Ma op de stoep van Molenkrite 15 (`roanMaPlek`): € 450. `roanBezig` telt als `nmBezig`
(het verhaal wacht, niet opslaan). Opslag: `roanKlaar`.

**De tussenpoos** (stap 108): elke missie die met de telefoon begint, belt `TUSSENPOOS` (150 s) na de
vorige; die telt niet af tijdens een klus. Een nieuwe missie gebruikt die ook, en hoort met zijn
wachtfase in `KLUS_WACHT`; `npm run tempotest` controleert beide.

**Klusjes** (stap 99, js/klusjes.js): tussen de missies door, en als een missie onder zijn M
op je wacht (`KLUS_WACHT` in js/verhaal.js: de fase waarin nog niets begonnen is, ook missie 9
zolang je geen huis hebt), staat na KLUS.wacht tellen Mark of Johan op een willekeurige stoep met
een groen speldje K (`hud.zetKlus`). E: tas (€ 250–500, onderweg soms een ster of een groepje via
`bendes.zetGroep`), auto (€ 400–650, soms twee sterren), overspuiten (€ 550–750, stelen = een
ster, de wasbox op rekening via `spuitPrijs`), omleggen (€ 750, met lijfwacht € 1.000, daarna
drie sterren). Plekken: stoep langs een gewone straat of een lege parkeerplek, KLUS.rand (350 m)
van de rand, KLUS.bezet van `api.bezet`, over de weg bereikbaar. Tijdens een klus wacht het
verhaal (`wachtOpKlus`: de pauze telt niet af, de werk…Bij van een wachtende missie draait niet,
E gaat niet naar de missie), daarna zet `pauzeerVoorKlus(false)` de M en de opdracht terug.
Geslaagd: telefoon, geld, checkpoint. X breekt af; laden en `startMissie` ruimen op (`reset`).

Daarna hangen er groepjes van twee tot vier man van De Veteraan rond in Tinga en
langs de Lemmerweg (js/bendes.js): knuppel of pistool, aanvallen binnen 13 m,
achtervolgen, na een tijdje opgeven. Alleen buiten de missies om, en alleen tot
missie 12: met De Veteraan dood valt zijn bende uit elkaar (`!brugKlaar`).

Buiten de missies: **Autohuis Lemmerweg** (js/garage.js), de glazen showroom tegenover BP. E naast
een auto koopt hem: rode of gele Ferrari € 3.000 (soort `ferrari`, `RIJ` in js/vehicles.js: ruim
200 km/u), rode BX € 250. Hij staat dan op het voorterrein; de opslag neemt gekochte auto's mee
(`garage.bewaar`/`herstel`, `auto.eigen` in js/opslag.js). De Ferrari is een eigen model
(`sportGeoms` in js/carmodel.js, een geëxtrudeerd zijprofiel), geen `autoGeoms` met andere maten.
Sturen is op snelheid begrensd door de grip (`STUUR_GRIP` in js/vehicles.js, 26 m/s²; de Ferrari
50 via `RIJ.ferrari.grip`, en met de toetsen bouwt het stuur op snelheid in 0,3 s op, stap 106).

De drie woningen: **Zeskanter 16** (€ 5.000), **Molenkrite 130c** (€ 2.500),
**Koningsspil 20** (€ 1.000). Binnen: hoekbank met tv, eettafel om aan te zitten,
keuken met koelkast (bier = leven), twee katten, dichte ramen, tuin met terras,
schutting, schuurtje, **barbecue** (E → vlees → 28 leven), **radio op het
dressoir** (E aan/uit, zachter naarmate je verder weg staat, uit als je het huis
uit gaat) en naast de voordeur een **oprit** waar je auto blijft staan.

## 6 · Proeven en foto's

Er is één `npm run <naam>test` en meestal een `<naam>shots` per onderwerp; ze
staan allemaal in `tools/` en draaien via Playwright op een headless Chromium.
De laatste die ertoe doen: `npm run cachenalooptest` (stap 211: de Tinga Cache zoals een speler hem doet — elk raadsel past op het scherm van de GPS, met foto's `cache_gps_<n>.png`, de raadsels en de hints van Sjors lossen het op, intikken met de echte toetsen, alles te voet of met de sloep te bereiken); `npm run shotguntijdtest` (stap 211: de tijd van één schot, pistool tegen pompgeweer, en het beeld erna); `npm run yugosneltest` (stap 211: shift+Y zet je meteen aan tafel bij Yugo); `npm run kogelvrijtest` (stap 210: in missie 18 is de auto van de avond kogelvrij voor je eigen schoten, `kogelvrij` in `vehicles.hit`, `werkKogelvrijBij`); `npm run natplektest` (stap 209: elke fase die je kunt laden, 113 stuks uit de `hervat…`-functies, nooit Erik, Mark of Johan in het water buiten een boot, en de wal van de ligplaatsen; `watertest` is iets anders: de politieboot); `npm run helilandtest` (stap 208: in missie 18 landt de heli bij het Autohuis op het droge, met Erik, Mark, Johan en de Ferrari, ook na laden; `landPlek`, `droogRond`, `droogBij`); `npm run gpsderdetest` (stap 207: de GPS alleen in de eerste persoon, te voet en in de auto); `npm run yugotest` (stap 204: de zaal, Johans voorstel en de vraag na een praatje over Yugo, aan tafel gemeten — Johan en het logo in beeld —, de tablet met de echte toetsen, de ober nooit door een doos, eten met de stokjes en drinken, een ronde met de echte tijden ≈ een kwartier voor vijf, het einde, X, opslaan en laden, het muziekje, geen nieuw programma) met `yugoshots` (yugo_zaal, yugo_tafel, yugo_tablet, yugo_eten); `npm run politievuurtest` (stap 203: de eerste vijf tellen van een vuurgevecht, oud tegen nieuw `AANVAL` in js/politie.js); `npm run tankradiotest` (stap 202: geen autoradio in No Mercy 4 en 5, Erik zichtbaar in de stafauto, hoogstens twee keer toeteren per opstopping, de motor van de Tiger en lantaarnpalen omver, snel van zender wisselen zonder terugval op het deuntje); `npm run menubeeldtest` (het menubeeld met de linkerfiguur van de hoes); `npm run geocachetest` (stap 196: de omrekening, posters, kassa, Sjors, GPS, de vijf plekken, alle vijf achter elkaar, beloning, opslag, geen programma) met `geocacheshots`; `npm run statistiektest` (stap 195: de teller, schot en voetganger, opslaan, checkpoint, het menu, de titelrol) met `statistiekshots`; `npm run praatjestest` (stap 192: Mark en Johan tussendoor, de praatjes, wanneer ze er wel en niet staan, keuze 3 na het einde) met `praatjesshots`; `npm run shotguntest` (stap 189: het pompgeweer — kopen, hagel, pompen, laden per patroon, raak, hud, opslaan, geen programma; stap 190: de lengte, de loop, het schild boven de loop, de twee opnames; stap 191: de doeken naast die van de M1) met `shotgunshots`; stap 179 maakte `vierpuntentest`, `racetest` en `nachttest` groen (een toets stuurt op snelheid de eerste 0,15 s zacht aan, `car.stuurHoud`; 's nachts 12 % drukte, `NACHT_DRUKTE`; de proef kijkt halverwege de nacht om); `npm run roantest` (stap 178: de bijmissie Roan naar Ma — de R, Mark belt na 90 s, Roan bij de speeltoestellen, volgen zonder muren of water, de auto, Ma, € 450, opslaan, neergaan, shaders) met `roanshots`; `npm run tigertest` (stap 177: de gedenkplek op het weiland aan de Sudergoweg, de maten van de Tiger, rijden, de koepel en het kanon, schieten en herladen, de camera langs de loop, over de dam de weg op zonder water, de muur, uitstappen, geen nieuw shaderprogramma) met `tigershots`; `npm run zeilintrotest` (stap 176: vóór het spelen, in het menu en de intro, liggen de zeilboten op het water en niet op (0, 0) bij het beginpunt); `npm run haperingtest` (sinds stap 175 weer groen: de lus in de proef kent de stam-uitzondering van stap 128) en `npm run rijprofiel` (sinds stap 175 ook `traag`: elke aanroep in js/vehicles.js en js/verkeersregels.js boven 6 ms; een kale functie daarin is de vuilnisophaal); `npm run claxonwraktest` (stap 174: de claxon als opname, zachter op afstand; het politiewrak zonder zwarte vlakken boven het dak, `car.lakUit`) en `npm run nomercy5test` (sinds stap 174 ook: de zijspannen van voren en neer te schieten, de camera-auto nooit in een botsdoos, de stafauto bij het Autohuis, jij niet in het water); `npm run autodetailtest` (stap 172: per soort de bestuurder — links, hoofd onder de hemel, billen op de zitting, handen ≤ 15 cm van de krans van het echte stuur, niets door de carrosserie —, wie wanneer in de auto zit, de wielen afstand/straal en achteruit andersom, de voorwielen met de bocht mee, het remlicht met en zonder toetsen, het witte licht, de gloed; in het spel bestuurders in al het verkeer, dichtbij en ver, een geparkeerde auto leeg, remmen en achteruit in het verkeer, geen nieuw programma dag en nacht, de lichtbronnen gelijk; deel A laadt alleen de modules) met `autodetailshots` (auto_rem_avond, _rem_dag, _achteruit, _bestuurder_hatch, _bestuurder_bus, _wielen; `FOTO=a,b`); `npm run rijgedragtest` (stap 171: frontaal, schampend, in de flank en tegen een stilstaande auto — nooit in de muur, de draai dempt uit —, schakelen met het toerental, de toon en de toerenteller, de topsnelheid gelijk aan het oude rijgedrag met en zonder tuning, de beeldhoek wijder en terug, de 78°, de trilling begrensd, niets in een filmbeeld, geen nieuw programma; rijdt ver buiten de kaart, dus vrij snel); `npm run baliestest` (stap 170: de mat van de BP niet in de vloer, het kraslot als kaartje met bedrag en geluid, de afzetting op de Stadsrondweg-Zuid bij (1708, −110), de tuning bij Sjoerd aan de balie en de zuil weg); `npm run bpkassatest` (stap 169: de kassa van de BP — waar, E, de energydrank met leven en boost tot 20 %, de boost gemeten als afstand, het verloop, het kraslot met geld en kansen over 20.000 trekkingen, te weinig geld, weglopen); `npm run molenkritetest` (stap 168: Molenkrite 145–157 als `molenkrite_balkon` uit een tweede `plan`, het balkon om de woning, de borstwering geen glas, de strook beschot in de top van 133–143; laadt alleen de modules) met `molenkriteshots`; `npm run vuurvlindertest` (stap 166: de oneven rij Vuurvlinder 1–15 — het eigen type uit data/stijl/straten.json, de straatgevel met stralen gemeten op antraciet en lichte kaders, de zijgevels, elk dakvlak op de BAG-hoogte, plat dak en donkere plaat, geen kapelwangen, de botsdozen, geen nieuw programma dag en nacht) met `vuurvlindershots` (vuurvlinder_straat, _rij, _schuin, _nacht; `FOTO=<naam>` voor één foto); `npm run nm5duitsertest` (stap 167: elke Duitser van No Mercy 5 en 4 gemeten — plek, pand, botsdoos, water, hoogte, zichtlijn vanaf een plek waar je komt, te voet bereikbaar —, twee minuten gevecht beeld voor beeld, de sluipschutter die ziet en schiet, de rode ruitjes bij twee over, echte schoten op de laatste twee, X en opnieuw niet dubbel, het bos met `jagen` en `droog`, het bunkerdorp); `npm run eekmolentest` (stap 165: de garageboxen aan de Eekmolen en de puntgeveltypen `eekmolen_punt`, `loper_punt`, `molenkrite_punt` uit een `plan` in data/stijl/straten.json, met `puntgevel`, `laagType` en `rabat` in js/textures.js) met `eekmolenshots`; `npm run molenflattest` (stap 163: de flats aan de Molenkrite — op de voetafdruk, het oude blok weg, elk deel op zijn hoogte uit de 3D BAG, elk raam van voren en een waaier vanaf waar de gebruiker stond, de witte dakrand die uitsteekt, loggia's van ruim een meter diep, bergingen met een blauwe boeiboord, botsdozen, licht 's nachts, geen nieuw programma) met `molenflatshots`; `npm run bptest` (stap 160: de shop van de BP — het dak op de voetafdruk, de schuifdeuren en hun botsdoos, naar binnen door de open deur en niet door de dichte, de pui en de muren van buiten en binnen dicht, rondlopen tussen de gondels en naar de balie, de medewerker achter de balie die je aankijkt, geen groen binnen, de pompen met displays, zes slangen en een nummer, geen nieuw programma dag en nacht) met `bpshots` (bp_buiten, bp_deur, bp_binnen, bp_balie, bp_nacht, bp_details, bp_pomp, bp_pompen); `npm run aafftest` (stap 159) met `aaffshots`; `npm run standentest` (stap 157: de grafische standen en de moeilijkheid); `npm run politie2test` (stap 156: dekking en flanken niet langs Erik, ook als hij beweegt, geen zaklamp); `node tools/geo/steekproef.mjs 8123 --ronde 6` (stap 158: één ronde naar docs/steekproef/RONDE6.md met plek, RD, graden en Street View); `npm run voorgeveltest` (stap 155: zeven stralen op deurhoogte over de voorkant van elke woning, ≥ 97,5 % op een gevel met openingen (`nachtRamen`), de Vang 28/10/12 van 0,5 tot 2,6 m, en de lijst per straat); `npm run opstarttest` (sinds stap 155 ook: de avondstand niet meer in het opstarten, en na `avondBelofte` vertaalt een heel avondbeeld niets meer); `npm run voetgangertest` (stap 154: variatie, schaal nul, ≤ 4000 driehoeken, jas en paraplu, bankje, de Poiesz in en uit met de deuren, de fiets in het rek, bellen, schrik, grof tussen 200 en 350 m, geen nieuw programma) met `voetgangershots`; `npm run zuilengangtest` (stap 152: door de gang lopen, de winkel en het pand dicht, geen gras, de schuifdeuren, E naar binnen en buiten) met `zuilengangshots`; `npm run mensechttest` (sinds stap 153 ook oogwit, irissen op het gezicht, vier vingers, de haarlijn) met `gezichtshots`; `npm run autoechttest` (sinds stap 151 ook: portiergrepen plat in de flank, de uitlaat niet ver achter de bumper; de plas licht telt niet meer als mesh, dus weer groen); `npm run binnentest` (stap 151: van buiten steekt niets van het interieur uit; stap 150: de klokken niet ingezonken, de pookknop, de kijkhoek van de bestuurder en 78° in het spel; stap 149: het dashboard tot aan de voorruit, de hemel, spiegel en kleppen binnen de ruiten; `ALLEEN_MODELLEN=1` slaat het deel in het spel over; stap 146–148: ook de klokken te zien, de radio per zender, de nacht, één dashboard; het interieur van elke soort uit de ogen gemeten — het stuur vóór je, de klokken in beeld, vrij zicht door de voorruit, stuur en naald die meelopen, de pook; de doeken, de onderdelen, de stijlbekleding, de stoelen onder de hemel, het aantal driehoeken; en in het spel geen nieuw programma) met `binnenshots` (binnen_<soort>.png, met `BUITEN=1` van buiten, met `NACHT=1` 's nachts); `npm run politieslimtest` (stap 144, 49 controles: het zicht als getal, verstoppen aan een echte struik en in het bos, de hud VERSTOPT, 's nachts de zaklamp, de raakkans, dekking gezocht en gebruikt zonder schot vanuit de dekking, gericht zoeken, een achtertuin via de looproute, terug naar de auto, rammen, insluiten, omsingelen, de zaklamp vangt geen kogels, geen nieuwe shader) met `politieslimshots` (politie_dekking, politie_zaklamp, politie_verstopt); `npm run figurantentest` (stap 143: de stafauto in het bunkerdorp is het eigen model, de Duitsers van No Mercy 4 nooit door elkaar en ieder een eigen doel, rode flitsen zonder schade in No Mercy 4 en 5, een gewone Bewaking ongemoeid, het MG met schade 0); `npm run stafautotest` (stap 142, en sinds stap 145 het interieur: uit tot je erin zit, ogen, klok, stuur, panelen, naald, spiegel; de stafauto en het zijspan als eigen modellen — de userData voor js/vehicles.js, de maten, de wielen op de grond, het zijdoek over de zijplaat, de materiaalregels, de kap de goede kant op, het reservewiel; laadt alleen js/nomercy5.js) met `stafautoshots` (drie foto's, eigen zon op een lege pagina); `npm run nomercy5test` (stap 142: No Mercy 5 — pas na missie 12 en No Mercy 4, de EJ en één melding en nooit een telefoon, de plekken gemeten (kade, water, MG-nest, posten, vlag, de stelling, de route zonder keerpunt), de nacht, de bruikleen, varen met de camera-boot ernaast en op het water, het zoeklicht, de molen met 1–3 treffers zonder schade, de vlag, de rit met een automaat (camera-auto op de weg, zijspannen, geen Cut), de wrap, de première, beide keuzes met opslaan en laden, drie soorten Cut, opruimen bij mislukken, neergaan, X, laden en een nieuwe missie, shift+komma, de tussenpoos, geen nieuwe shader) met `nomercy5shots` (vier foto's); `npm run postbodetest` (stap 141: de postbode alleen 8–11:30 en bij de speler, minstens drie deuren, stil bij de deur met arm en envelop, de klep, elk beeld buiten de botsdozen en panden en geen stap door een muur, nooit in beeld ontstaan of verdwijnen, raken/aanrijden/schrikken en de volgende ochtend terug, geen nieuwe shader) met `postbodeshots` (`postbode.png`); `npm run nomercy2test` (stap 141: No Mercy 4, het bunkerdorp — de plek gemeten tegen bomen, water, grond en botsdozen, sluipen achter de schildwachten langs, de kaart, het luchtalarm, zes figuranten zonder schade, de radiopost, de close-up waar bewegen niet telt, het klapbord, beide keuzes met opslaan en laden, gezien en gehoord zonder herstart, een eigen M1, de grens vanaf het kamp, opruimen, geen nieuwe shader) met nomercy_kamp, nomercy_radio en nomercy_klapbord in `nomercyshots`; `npm run nomercytest` (stap 140: No Mercy 4 — het EJ-speldje na missie 5, het telefoontje na 30 s en niet tijdens een klus, de bruikleen, de set gemeten tegen bomen en botsdozen, de cameraman < 8 m, de knal, Duitsers die schieten zonder schade en neergaan na hun eigen 1–3 treffers, het bos uit, sinds stap 141 "nu de tweede take!" en het bunkerdorp in (het einde en een eigen M1 staan in nomercy2test), opruimen bij mislukken, neergaan, X en laden, de tussenpoos, opslaan, geen nieuwe shader) met `nomercyshots` (drie foto's); `npm run m1geluidtest` (stap 139: de opnames van de M1 en de stad gemeten, gains, afstand, afkappen; laadt alleen js/audio.js, dus snel); `npm run droneklustest` en `npm run m1test` (stap 132: de drone-klus en de M1 Garand) met `droneklusshots` en `m1shots`; `npm run wensen5test` (stap 131: Martens Vishandel, pizza bezorgen, tennis, zeilbootjes, onweer, tuning met decals, Tinga Nieuws op de tv, aan de knoppen van Radio Tinga) met `wensen5shots` (vier foto's); `npm run wensen4test` (stap 130: missiemuziek 2 en de schuif, Ren Lenny Ren en de zender 100% NL, de muren van de rondweg en de grens op de N7, niet verdwijnen in beeld, paniek bij de inslag, de achtergrond per stad en nacht, de vlag naar missie 15–18, achtergelaten auto's terug, schieten op Bouwman in missie 15, aanval en flank bij de politie) met `wensen4shots` (één foto); `npm run wensen3test` (stap 129: spelen in volledig scherm als blijvende keuze, Kali uit het radiootje van missie 1 en op Radio Tinga, gele ringen onder de schutters, Wiebe, Mark en Johan schieten uit de auto, de Ferrari wendbaarder en harder remmen, meer verkeer, de ambulancebroeders te raken) met `wensen3shots` (één foto); `npm run wensen2test` (stap 128: achtergronden 75 % zachter, NaN geweigerd in een AudioParam, de mouw met een elleboog, rennen zonder schokken, shift-boost in auto en boot, geen oeverwanden in het water, de camera bij een boomstam, de uitleg thuis, Mark praat onderweg in missie 7 met de gele cirkel, de J of M vóór het telefoontje, missie 8 € 2.500, de boot over het water, ambulances en vrachtwagens, vuur van beneden met tracers, zwaailichten bij Bouwman, de loods op afstand) met `wensen2shots` (drie foto's); `npm run wensentest` (stap 127: de geluiden van de gebruiker, de heli met wapen en kogels die niet opraken, Bouwman harder, de handlangers, het zwaardere gevecht, het schudden op de Dúvelsrak en de route naar Radio Tinga, vuurwerk om tien uur, de Ferrari van binnen, je auto bij huis, voetbal met balbezit, de mouw achter de camera, de drone terug in bereik, volledig scherm, opgeslagen spellen, de vloer bij de BP) met `wensenshots` (zeven foto's); `npm run kleinwinsttest` (stap 126: het klokje, slapen tot de ochtend met Z, de minikaart op de drone, wisselend weer — geleidelijk, met de hand meteen, uit te zetten —, kliko's langs de vuilniswagen, twinkelende sterren; punt 9 en 10 staan in `huistest` en `verhaaltest`); `npm run tijdtest` (stap 125: de klok loopt vanaf het begin, 48 minuten per dag, T als schakelaar, de instellingen, een missie overdag en stil, wachten onder de M, laden zonder sprong, de nacht van de race, de vuilniswagen van Súdwest-Fryslân); `npm run dronetest` (stap 124: de drone — kopen, opslag, vliegen, gebouwen, de drie grenzen met OUT OF RANGE en tien tellen, kwijt, accu, E/B, foto, nooit een ster —, vogels in het water, meeuwen bij IJlst, sterren, ochtendmist, knipperlichten, joggers, vuilniswagen, terras, autoschade, remsporen, geen nieuwe shaders) met `droneshots` (negen foto's); `npm run zespuntentest` (stap 123: het mes — altijd, vanzelf bij alles leeg, een steek op 1,6 m raak en op 6 m niet, geen schot te horen —, de GTI, de uitleg bij de eerste ster en de grote kaart, de wapens van de anderen, oversteken in plaats van springen, missie opnieuw vanuit het pauzemenu) met `zespuntenshots` (drie foto's); `npm run naloop3test` (stap 122, missie 16–18 en het uitje nagelopen: laden tijdens de montage en het filmbeeld op het dek, na de montage buiten bij Mark en Johan, neergaan bij de loods en op de brug, het uitje dat niet meer vastloopt, auto's die niet stapelen, te voet op het dek na laden, de worst en de kluis van missie 17, niet opslaan net na een missie); `npm run naloop2test` (stap 121, missie 11–15 nagelopen: missie 12 klaar ook na neergaan in Marks gesprek, de hekken van missie 12 in de opslag en door naar de C4, het konvooi stapelt niet, laden ruimt het dek, de race en het volgen op, "Een paar dagen later" blijft zwart, laden na de finish of na het verliezen, laden midden in de race op de grid, neergaan in een race voor geld, mislukt zonder sterren); `npm run nalooptest` (stap 120, missie 6–10 nagelopen: de BX heel terug bij opnieuw beginnen en na een knal, missie 6 laden in een nieuwe sessie zonder tweede BX, missie 7 zonder muziek bij de M en zonder achtergebleven auto's, missie 8 opnieuw vanaf 'terug' in de sloep met de waterpolitie, opruimen bij laden, het herstelpunt in de opslag, missie 9 gezien/klus/knoppen/toonbank, neergaan sluit een gesprek); `npm run beginmissietest` (stap 119: missie 1 de man die opspringt en terugschiet, missie 2 Mark praat onderweg, missie 4 alarm, Mark bij de boerderij en € 500, missie 5 de dief langzamer te voet en de tuinen in voor een auto, het muziekje van de intro in de heli van missie 18 met fade in en fade out) met `beginmissieshots` (vijf foto's), en `npm run introtest` (sinds stap 119 ook het beeld bij VV Sneek: even lang als de Poiesz ervoor, een kraan, het bord van Radio Spannenburg, de wedstrijd in de film); `npm run opzettest` (de opzet voor een nieuwe speler: de besturing in het menu, Spel laden met datum, een onleesbare opslag, Start spel vraagt eerst, Opslaan in de pauze, een ander tabblad pauzeert, keuzeknoppen voor een aanraakscherm, een mislukte missie laadt niet je opslag, de uitleg bij het eerste checkpoint, geen voorwerpen in de rijbaan, geen 404; stap 118); `npm run opslagtest` (F5 niet in het menu, een gesprek of een filmbeeld; laden midden in een; `npm run voorrangtest` (stap 173: voorrang op een kruising bij gelijke en bij bredere wegen, de rotonde tegen de klok in en wachten voor de ring, de voetganger en de speler te voet op ≥ 2 m, de auto van de speler dwars/langs/wrak met elk beeld de botsdoos, vier auto's en het vangnet, drie minuten verkeer met en zonder regels met de tijd per beeld, geen nieuw programma) met `voorrangshots`; `npm run rijgedragtest` (stap 171: frontaal, schampend, in de flank en tegen een stilstaande auto — nooit in de muur, de draai dempt uit —, schakelen met het toerental, de toon en de toerenteller, de topsnelheid gelijk aan het oude rijgedrag met en zonder tuning, de beeldhoek wijder en terug, de 78°, de trilling begrensd, niets in een filmbeeld, geen nieuw programma; rijdt ver buiten de kaart, dus vrij snel); `npm run baliestest` (stap 170: de mat van de BP niet in de vloer, het kraslot als kaartje met bedrag en geluid, de afzetting op de Stadsrondweg-Zuid bij (1708, −110), de tuning bij Sjoerd aan de balie en de zuil weg); `npm run bpkassatest` (stap 169: de kassa van de BP — waar, E, de energydrank met leven en boost tot 20 %, de boost gemeten als afstand, het verloop, het kraslot met geld en kansen over 20.000 trekkingen, te weinig geld, weglopen); `npm run molenkritetest` (stap 168: Molenkrite 145–157 als `molenkrite_balkon` uit een tweede `plan`, het balkon om de woning, de borstwering geen glas, de strook beschot in de top van 133–143; laadt alleen de modules) met `molenkriteshots`; `npm run vuurvlindertest` (stap 166: de oneven rij Vuurvlinder 1–15 — het eigen type uit data/stijl/straten.json, de straatgevel met stralen gemeten op antraciet en lichte kaders, de zijgevels, elk dakvlak op de BAG-hoogte, plat dak en donkere plaat, geen kapelwangen, de botsdozen, geen nieuw programma dag en nacht) met `vuurvlindershots` (vuurvlinder_straat, _rij, _schuin, _nacht; `FOTO=<naam>` voor één foto); `npm run nm5duitsertest` (stap 167: elke Duitser van No Mercy 5 en 4 gemeten — plek, pand, botsdoos, water, hoogte, zichtlijn vanaf een plek waar je komt, te voet bereikbaar —, twee minuten gevecht beeld voor beeld, de sluipschutter die ziet en schiet, de rode ruitjes bij twee over, echte schoten op de laatste twee, X en opnieuw niet dubbel, het bos met `jagen` en `droog`, het bunkerdorp); `npm run eekmolentest` (stap 165: de garageboxen aan de Eekmolen en de puntgeveltypen `eekmolen_punt`, `loper_punt`, `molenkrite_punt` uit een `plan` in data/stijl/straten.json, met `puntgevel`, `laagType` en `rabat` in js/textures.js) met `eekmolenshots`; `npm run molenflattest` (stap 163: de flats aan de Molenkrite — op de voetafdruk, het oude blok weg, elk deel op zijn hoogte uit de 3D BAG, elk raam van voren en een waaier vanaf waar de gebruiker stond, de witte dakrand die uitsteekt, loggia's van ruim een meter diep, bergingen met een blauwe boeiboord, botsdozen, licht 's nachts, geen nieuw programma) met `molenflatshots`; `npm run bptest` (stap 160: de shop van de BP — het dak op de voetafdruk, de schuifdeuren en hun botsdoos, naar binnen door de open deur en niet door de dichte, de pui en de muren van buiten en binnen dicht, rondlopen tussen de gondels en naar de balie, de medewerker achter de balie die je aankijkt, geen groen binnen, de pompen met displays, zes slangen en een nummer, geen nieuw programma dag en nacht) met `bpshots` (bp_buiten, bp_deur, bp_binnen, bp_balie, bp_nacht, bp_details, bp_pomp, bp_pompen); `npm run aafftest` (stap 159) met `aaffshots`; `npm run standentest` (stap 157: de grafische standen en de moeilijkheid); `npm run politie2test` (stap 156: dekking en flanken niet langs Erik, ook als hij beweegt, geen zaklamp); `node tools/geo/steekproef.mjs 8123 --ronde 6` (stap 158: één ronde naar docs/steekproef/RONDE6.md met plek, RD, graden en Street View); `npm run voorgeveltest` (stap 155: zeven stralen op deurhoogte over de voorkant van elke woning, ≥ 97,5 % op een gevel met openingen (`nachtRamen`), de Vang 28/10/12 van 0,5 tot 2,6 m, en de lijst per straat); `npm run opstarttest` (sinds stap 155 ook: de avondstand niet meer in het opstarten, en na `avondBelofte` vertaalt een heel avondbeeld niets meer); `npm run voetgangertest` (stap 154: variatie, schaal nul, ≤ 4000 driehoeken, jas en paraplu, bankje, de Poiesz in en uit met de deuren, de fiets in het rek, bellen, schrik, grof tussen 200 en 350 m, geen nieuw programma) met `voetgangershots`; `npm run zuilengangtest` (stap 152: door de gang lopen, de winkel en het pand dicht, geen gras, de schuifdeuren, E naar binnen en buiten) met `zuilengangshots`; `npm run mensechttest` (sinds stap 153 ook oogwit, irissen op het gezicht, vier vingers, de haarlijn) met `gezichtshots`; `npm run autoechttest` (sinds stap 151 ook: portiergrepen plat in de flank, de uitlaat niet ver achter de bumper; de plas licht telt niet meer als mesh, dus weer groen); `npm run binnentest` (stap 151: van buiten steekt niets van het interieur uit; stap 150: de klokken niet ingezonken, de pookknop, de kijkhoek van de bestuurder en 78° in het spel; stap 149: het dashboard tot aan de voorruit, de hemel, spiegel en kleppen binnen de ruiten; `ALLEEN_MODELLEN=1` slaat het deel in het spel over; stap 146–148: ook de klokken te zien, de radio per zender, de nacht, één dashboard; het interieur van elke soort uit de ogen gemeten — het stuur vóór je, de klokken in beeld, vrij zicht door de voorruit, stuur en naald die meelopen, de pook; de doeken, de onderdelen, de stijlbekleding, de stoelen onder de hemel, het aantal driehoeken; en in het spel geen nieuw programma) met `binnenshots` (binnen_<soort>.png, met `BUITEN=1` van buiten, met `NACHT=1` 's nachts); `npm run politieslimtest` (stap 144, 49 controles: het zicht als getal, verstoppen aan een echte struik en in het bos, de hud VERSTOPT, 's nachts de zaklamp, de raakkans, dekking gezocht en gebruikt zonder schot vanuit de dekking, gericht zoeken, een achtertuin via de looproute, terug naar de auto, rammen, insluiten, omsingelen, de zaklamp vangt geen kogels, geen nieuwe shader) met `politieslimshots` (politie_dekking, politie_zaklamp, politie_verstopt); `npm run figurantentest` (stap 143: de stafauto in het bunkerdorp is het eigen model, de Duitsers van No Mercy 4 nooit door elkaar en ieder een eigen doel, rode flitsen zonder schade in No Mercy 4 en 5, een gewone Bewaking ongemoeid, het MG met schade 0); `npm run stafautotest` (stap 142, en sinds stap 145 het interieur: uit tot je erin zit, ogen, klok, stuur, panelen, naald, spiegel; de stafauto en het zijspan als eigen modellen — de userData voor js/vehicles.js, de maten, de wielen op de grond, het zijdoek over de zijplaat, de materiaalregels, de kap de goede kant op, het reservewiel; laadt alleen js/nomercy5.js) met `stafautoshots` (drie foto's, eigen zon op een lege pagina); `npm run nomercy5test` (stap 142: No Mercy 5 — pas na missie 12 en No Mercy 4, de EJ en één melding en nooit een telefoon, de plekken gemeten (kade, water, MG-nest, posten, vlag, de stelling, de route zonder keerpunt), de nacht, de bruikleen, varen met de camera-boot ernaast en op het water, het zoeklicht, de molen met 1–3 treffers zonder schade, de vlag, de rit met een automaat (camera-auto op de weg, zijspannen, geen Cut), de wrap, de première, beide keuzes met opslaan en laden, drie soorten Cut, opruimen bij mislukken, neergaan, X, laden en een nieuwe missie, shift+komma, de tussenpoos, geen nieuwe shader) met `nomercy5shots` (vier foto's); `npm run postbodetest` (stap 141: de postbode alleen 8–11:30 en bij de speler, minstens drie deuren, stil bij de deur met arm en envelop, de klep, elk beeld buiten de botsdozen en panden en geen stap door een muur, nooit in beeld ontstaan of verdwijnen, raken/aanrijden/schrikken en de volgende ochtend terug, geen nieuwe shader) met `postbodeshots` (`postbode.png`); `npm run nomercy2test` (stap 141: No Mercy 4, het bunkerdorp — de plek gemeten tegen bomen, water, grond en botsdozen, sluipen achter de schildwachten langs, de kaart, het luchtalarm, zes figuranten zonder schade, de radiopost, de close-up waar bewegen niet telt, het klapbord, beide keuzes met opslaan en laden, gezien en gehoord zonder herstart, een eigen M1, de grens vanaf het kamp, opruimen, geen nieuwe shader) met nomercy_kamp, nomercy_radio en nomercy_klapbord in `nomercyshots`; `npm run nomercytest` (stap 140: No Mercy 4 — het EJ-speldje na missie 5, het telefoontje na 30 s en niet tijdens een klus, de bruikleen, de set gemeten tegen bomen en botsdozen, de cameraman < 8 m, de knal, Duitsers die schieten zonder schade en neergaan na hun eigen 1–3 treffers, het bos uit, sinds stap 141 "nu de tweede take!" en het bunkerdorp in (het einde en een eigen M1 staan in nomercy2test), opruimen bij mislukken, neergaan, X en laden, de tussenpoos, opslaan, geen nieuwe shader) met `nomercyshots` (drie foto's); `npm run m1geluidtest` (stap 139: de opnames van de M1 en de stad gemeten, gains, afstand, afkappen; laadt alleen js/audio.js, dus snel); `npm run droneklustest` en `npm run m1test` (stap 132: de drone-klus en de M1 Garand) met `droneklusshots` en `m1shots`; `npm run wensen5test` (stap 131: Martens Vishandel, pizza bezorgen, tennis, zeilbootjes, onweer, tuning met decals, Tinga Nieuws op de tv, aan de knoppen van Radio Tinga) met `wensen5shots` (vier foto's); `npm run wensen4test` (stap 130: missiemuziek 2 en de schuif, Ren Lenny Ren en de zender 100% NL, de muren van de rondweg en de grens op de N7, niet verdwijnen in beeld, paniek bij de inslag, de achtergrond per stad en nacht, de vlag naar missie 15–18, achtergelaten auto's terug, schieten op Bouwman in missie 15, aanval en flank bij de politie) met `wensen4shots` (één foto); `npm run wensen3test` (stap 129: spelen in volledig scherm als blijvende keuze, Kali uit het radiootje van missie 1 en op Radio Tinga, gele ringen onder de schutters, Wiebe, Mark en Johan schieten uit de auto, de Ferrari wendbaarder en harder remmen, meer verkeer, de ambulancebroeders te raken) met `wensen3shots` (één foto); `npm run wensen2test` (stap 128: achtergronden 75 % zachter, NaN geweigerd in een AudioParam, de mouw met een elleboog, rennen zonder schokken, shift-boost in auto en boot, geen oeverwanden in het water, de camera bij een boomstam, de uitleg thuis, Mark praat onderweg in missie 7 met de gele cirkel, de J of M vóór het telefoontje, missie 8 € 2.500, de boot over het water, ambulances en vrachtwagens, vuur van beneden met tracers, zwaailichten bij Bouwman, de loods op afstand) met `wensen2shots` (drie foto's); `npm run wensentest` (stap 127: de geluiden van de gebruiker, de heli met wapen en kogels die niet opraken, Bouwman harder, de handlangers, het zwaardere gevecht, het schudden op de Dúvelsrak en de route naar Radio Tinga, vuurwerk om tien uur, de Ferrari van binnen, je auto bij huis, voetbal met balbezit, de mouw achter de camera, de drone terug in bereik, volledig scherm, opgeslagen spellen, de vloer bij de BP) met `wensenshots` (zeven foto's); `npm run kleinwinsttest` (stap 126: het klokje, slapen tot de ochtend met Z, de minikaart op de drone, wisselend weer — geleidelijk, met de hand meteen, uit te zetten —, kliko's langs de vuilniswagen, twinkelende sterren; punt 9 en 10 staan in `huistest` en `verhaaltest`); `npm run tijdtest` (stap 125: de klok loopt vanaf het begin, 48 minuten per dag, T als schakelaar, de instellingen, een missie overdag en stil, wachten onder de M, laden zonder sprong, de nacht van de race, de vuilniswagen van Súdwest-Fryslân); `npm run dronetest` (stap 124: de drone — kopen, opslag, vliegen, gebouwen, de drie grenzen met OUT OF RANGE en tien tellen, kwijt, accu, E/B, foto, nooit een ster —, vogels in het water, meeuwen bij IJlst, sterren, ochtendmist, knipperlichten, joggers, vuilniswagen, terras, autoschade, remsporen, geen nieuwe shaders) met `droneshots` (negen foto's); `npm run zespuntentest` (stap 123: het mes — altijd, vanzelf bij alles leeg, een steek op 1,6 m raak en op 6 m niet, geen schot te horen —, de GTI, de uitleg bij de eerste ster en de grote kaart, de wapens van de anderen, oversteken in plaats van springen, missie opnieuw vanuit het pauzemenu) met `zespuntenshots` (drie foto's); `npm run naloop3test` (stap 122, missie 16–18 en het uitje nagelopen: laden tijdens de montage en het filmbeeld op het dek, na de montage buiten bij Mark en Johan, neergaan bij de loods en op de brug, het uitje dat niet meer vastloopt, auto's die niet stapelen, te voet op het dek na laden, de worst en de kluis van missie 17, niet opslaan net na een missie); `npm run naloop2test` (stap 121, missie 11–15 nagelopen: missie 12 klaar ook na neergaan in Marks gesprek, de hekken van missie 12 in de opslag en door naar de C4, het konvooi stapelt niet, laden ruimt het dek, de race en het volgen op, "Een paar dagen later" blijft zwart, laden na de finish of na het verliezen, laden midden in de race op de grid, neergaan in een race voor geld, mislukt zonder sterren); `npm run nalooptest` (stap 120, missie 6–10 nagelopen: de BX heel terug bij opnieuw beginnen en na een knal, missie 6 laden in een nieuwe sessie zonder tweede BX, missie 7 zonder muziek bij de M en zonder achtergebleven auto's, missie 8 opnieuw vanaf 'terug' in de sloep met de waterpolitie, opruimen bij laden, het herstelpunt in de opslag, missie 9 gezien/klus/knoppen/toonbank, neergaan sluit een gesprek); `npm run beginmissietest` (stap 119: missie 1 de man die opspringt en terugschiet, missie 2 Mark praat onderweg, missie 4 alarm, Mark bij de boerderij en € 500, missie 5 de dief langzamer te voet en de tuinen in voor een auto, het muziekje van de intro in de heli van missie 18 met fade in en fade out) met `beginmissieshots` (vijf foto's), en `npm run introtest` (sinds stap 119 ook het beeld bij VV Sneek: even lang als de Poiesz ervoor, een kraan, het bord van Radio Spannenburg, de wedstrijd in de film); `npm run opzettest` (de opzet voor een nieuwe speler: de besturing in het menu, Spel laden met datum, een onleesbare opslag, Start spel vraagt eerst, Opslaan in de pauze, een ander tabblad pauzeert, keuzeknoppen voor een aanraakscherm, een mislukte missie laadt niet je opslag, de uitleg bij het eerste checkpoint, geen voorwerpen in de rijbaan, geen 404; stap 118); `npm run opslagtest` (F5 niet in het menu, een gesprek of een filmbeeld; laden midden in een
gesprek per missie, doorschuiven na missie 1–3, Johan na missie 4, missie 6, 8 en 9 midden, het geld van missie 7, checkpoints
bij het begin van missie 2–6 en niet in een gesprek, een klus vóór missie 6, Doorgaan, shift + cijfer, blur; stap 117); `npm run ramentest` (de ramen 's avonds van dichtbij, oud tegen nieuw op dezelfde gevel: evenveel licht,
minder harde sprongen, een kortere rand; maakt ramen_oud.png en ramen_nieuw.png; stap 116); `npm run uitjetest` (na het einde de M bij Molenkrite 15: de keuze, de wedstrijd op het
juiste uur, de kijkplek gemeten, Mark die naar de lijn loopt, bier, juichen, het einde, de bank, laden; stap 115) met
`uitjeshots` (twee foto's); `npm run geldracetest` (racen voor geld na missie 14: de tip van Ronald vóór missie 15, de balie,
te weinig geld, winnen en verliezen, de missie die wacht, opslaan; stap 114); `npm run buurttest` (het tuinfeest, de pizzascooter
en de plezierboot; stap 113) met `buurtshots` (drie foto's); `npm run ambulancetest` (de ambulance: het model, de rit met zwaailicht en sirene, knielen en
reanimeren, weg en verdwijnen, de rust, de nacht, de kans over 200 keer, een speler bij VV Sneek, stukgeschoten; en het nieuws
op Radio Tinga; stap 112) met `ambulanceshots` (drie foto's); `npm run wedstrijdtest` (de terugslag van de sniper tegen de oude, de wedstrijd bij VV Sneek: komen en gaan
uit beeld, tien minuten spelen, een doelpunt, het publiek, aanrijden, een kogel, de borden; stap 111) met `wedstrijdshots`
(drie foto's); `npm run avondtest` (missie 18, de avond: de lijnen, de heli elke tiende seconde — boven
de daken, van de rand, naast Bouwman met de deur naar hem, rustig, de camera buiten de romp —, echte schoten uit de
deur, de luifel en het landen, de auto, de achtervolging en kwijtraken, het gevecht, de politie, het filmbeeld op de
brug, Zondagochtend, opnieuw per fase; stap 109) met `avondshots` (vijf foto's; stap 110 erbij: 01:00, taaie bodyguards en machinegeweren, een echt pistoolschot,
E en V in de heli, een andere auto, kogels, opnieuw bij de loods); `npm run tempotest` (de tussenpoos tussen de missies: in de code, het eerste klusaanbod en de rijtijd ernaartoe, stilstaan tijdens een klus, en per missie of hij na het telefoontje op je wacht; stap 108); `npm run uitzendingtest` (missie 18 van het telefoontje tot vrij spelen: de studio gemeten — de ingang aan de Tinga, de mast op het dak, de weg van de deur naar de tafel —, het fragment van 40,2 s, de deur dicht tot Johan belt, de stick en de schuif, de montage zonder camera in een muur, het einde, de titelrol, te laat, de opslag; stap 107) met `uitzendingshots` (zes foto's); `npm run vierpuntentest` (het sturen van de Ferrari gemeten tegen het oude, het schap van Tinga State met `getComputedStyle` en geen enkel hidden-element in beeld, de schuif van Bouwman na de klap tegen echte schuurtjes, 200 kogels bij een nieuw spel; stap 106); `npm run schottest` (het schot als opname: laden, vanaf de knal, per wapen, op afstand, afkappen in een salvo; doorschieten met en zonder vergrendelde muis en op de vuurknop, het pistool en de sniper één per klik, de keuze in het menu; stap 105); `npm run kaartdoeltest` (ondertitels in een filmbeeld: in de balk, contrast, niets eroverheen; plekken op de rand van de minikaart; een eigen doel op de grote kaart aanwijzen, bij een speldje, weghalen, de route over de weg en bijgewerkt, aankomen, geen schot; maakt drie foto's; stap 104); `npm run ronaldtest` (missie 17: het lint, het plan, de worst, het erf gemeten — kraakplek nooit in de kegel, de weg ernaartoe lopend soms vrij, de kegel boven de grond, niets in het water, de route van Ronald zonder knik —, sluipen, beide afloopen met de filmbeelden, het neergaan, de opslag; stap 103) met `ronaldshots` (zes foto's); `npm run overgangtest` (laden of een nieuwe missie tijdens het klokje en het zwart na missie 12, 14 en 16, met een tegenproef; `zetNeer` op een geparkeerde auto; missie 16 in zo'n auto; en vooraf, zonder browser, geen functienaam twee keer in js/verhaal.js en js/main.js; stap 102); `npm run invaltest` (missie 16 van Johan aan de lijn tot de ochtend: de drie minuten en te laat, leeghalen, de inval en zijn filmbeeld, de Wieken, beide keuzes, de hinderlaag met de vlucht over het dek en de rotonde, rammen, de crash, de telefoon, ontsnappen, Johan geraakt, wapen niet weg, de auto total loss, opslaan; stap 101) met `invalshots` (vijf foto's, vier filmbeelden); `npm run legendatest` (de legenda onderaan de grote kaart: acht regels, de bedragen tegen de modules, elk icoon in zijn kleur, niets afgekapt, geen speldjes over elkaar, smal scherm; maakt ook de foto; stap 100); `npm run klusjestest` (de klusjes: plekken binnen de rand, het aanbod, alle vier de soorten van aannemen tot betaald, een wachtende missie die stil staat en terugkomt, de pauze die niet aftelt, afbreken, mislukken, laden, de beloning; stap 99) met `klusjesshots` (vier foto's); `npm run bochtentest` (het verkeer, de politie en de lijnen van race en Bouwman door de bocht: gladde lijn, geen draai of sprong in één beeld, dwarsversnelling, remmen voor een scherpe bocht, keren; stap 98) met `bochtenshots` (twee foto's); `npm run schaduwtest` (missie 15 van het telefoontje tot de € 1.500:
de route, de loods, een automaat die volgt, te dichtbij, te ver, de Ferrari, de foto's, gezien
worden; stap 96) met `schaduwshots` (vijf foto's); `npm run racetest` (missie 14 van het telefoontje tot de € 2.000,
met een automaat die de Ferrari over het parcours rijdt, goed en slordig, het verliezen, de ring
op de rotonde, piepjes, vrij parcours, sturen, pauze en de ochtend erna; stap 93–95) met
`raceshots` (vijf foto's); `npm run garagetest` (de showroom aan de Lemmerweg: plek, glas, deur,
kopen, Ferrari-model en topsnelheid, opslaan; stap 92, 95) met `garageshots` (vier foto's) en
`ferrarishots` (het model los, drie foto's in een paar seconden); `npm run missietest` (ook de
wissel van de missiemuziek); `npm run schrifttest` (het einde van missie 12 en
missie 13; stap 91) met `schriftshots` (vier foto's); `npm run brugtest` (missie 12 van de M tot de € 5.000,
met de dekking achter een auto gemeten, 65 controles; stap 89) met `brugshots` (zeven foto's);
`npm run politieautotest` (missie 11, van de M tot de
€ 1.000, en of Mark echt zit) met `politieautoshots` (drie foto's; stap 88);
`npm run haperingtest` (de camera achter de auto, de
buren van een wegvak, de schaduw elk beeld tijdens het rijden; stap 87) met
`npm run rijprofiel` (geen proef: de zelftijd per functie terwijl je rijdt),
`npm run checkpointtest` (het checkpoint na een missie en de keuze na het
neergaan) en `npm run plattegrondshots` (woningen van bovenaf); `npm run vloeiendtest` (het aantal shaders dat three
tijdens het spelen erbij vertaalt — hoort nul te zijn — en de nacht; stap 83–85),
`npm run schaduwpastest` (de schaduwpas: bomen bij de
doos, lantaarns per tegel; tot stap 102 overschreven door die van missie 15) en `npm run nachttest` (plassen licht, lampen van de
auto's) met `nachtshots`, stap 82; `npm run lodtest` (LOD verder weg en vervagend,
het voorvlak, de intro voorbereid en met de LOD mee, het verkeer; stap 81),
`npm run autolodtest` (geparkeerde auto's en
voetgangers op afstand, treffers via `nummer`/`slotNaar`; stap 80) en
`wapenechttest` (ook de terugslag bij elk beeldtempo) met `terugslagshots`,
`npm run omgevingtest` (wind, water, riet, gras in
3D, hagen, ramen 's avonds; stap 79) met `omgevingshots`, `npm run groentest` (bomen, struiken, gras en de
driehoeken in beeld; stap 78) met `groenshots`, `npm run gebouwtest` (elke driehoek van de wereld:
muurrichting, uitgerekte en afgekapte doeken; stap 76), `wapenechttest` en
`autoechttest` en `mensechttest` (laden alleen de module, dus snel; stap 77
meet ook de ramen) met `gebouwshots` en
`echtshots`; `npm run cliptest`, `opstarttest` en `lichttest`
(clipping, opstarten en licht; stap 75), `npm run bendetest` (tweeëndertig controles, groen) en
`npm run bendeshots` (twee foto's), `npm run veteraantest` (tweeënzestig controles,
groen), `npm run veteraanshots` (vijf foto's), `npm run huistest`
(negenenzestig controles) en `npm run huisshots` (vijf foto's).

**Valkuilen van deze omgeving — hier is veel tijd in gaan zitten:**

- De container is sterk vertraagd. **Eén proef of fotoronde duurt 10 tot 30
  minuten.** Start hem op de achtergrond en zet er een Monitor op die filtert op
  `FOUT|fout$|alles goed|pageerror`; niet pollen.
- **De hoofdlus loopt headless nauwelijks.** Een proef moet zelf
  `verhaal.update(dt)` aanroepen, anders gebeurt er niets.
- **`dialoogTekst` houdt de laatste zin vast** nadat de balk verborgen is. Tel
  nooit door op `textContent` — kijk naar `document.getElementById('dialoog').hidden`.
  Twee lussen die dat wel deden drukten daarna dertig keer E: dat kocht een keer
  ongevraagd een huis en liet de speler een keer aan tafel zitten.
- **De audioklok loopt headless ongeveer drie keer trager.** Metingen aan geluid
  moeten lang genoeg zijn (tientallen stappen van 80 ms).
- **Gevels en reliëf komen na het opstarten.** Een proef die naar texturen,
  normal maps of roughness maps kijkt roept eerst `window.__game.reliëfAf()` aan.
- **Wat waait staat in `sfeerMaterialen().blad`** (js/world.js). Een nieuw
  bladmateriaal dat daar niet bij staat, staat stil.
- **De LOD draait headless niet vanzelf.** `updateLOD` zit in de hoofdlus; een
  foto of proef roept hem zelf aan, anders staan fijne en grove versies door
  elkaar in beeld. Zonder `{ zacht: true }` gaat hij meteen om (zo willen proeven
  en foto's het); de hoofdlus vervaagt, en een vervagende tegel draagt dan even
  een kópie van zijn materialen (`_bron` is het origineel).
- **Een instantie is geen nummer meer.** Geparkeerde auto's en voetgangers
  staan compact in hun meshes (stap 80): instantie `j` is `stapel.nummer(mesh, j)`
  of `npcs.slotNaar[j]`. Een proef die iemand wil raken gebruikt `hitPersoon`.
  En een instanced mesh waarvan de inhoud verschuift moet elk beeld
  `boundingSphere = null` krijgen: three rekent die bol bij de eerste raycast
  één keer uit, en daarna ging elke kogel langs de voetgangers (stap 85).
- **Een nieuw soort materiaal wordt vooraf vertaald** door `soortenVoorbereid`
  (js/world.js), achter het laadscherm. Een materiaal dat na het opstarten pas
  gemaakt wordt valt daarbuiten; `npm run vloeiendtest` ziet dat als een nieuw
  programma.
- **De schaduwpas telt alleen met `shadowMap.needsUpdate = true`.** js/main.js
  zet `autoUpdate` uit; een meting of foto die de schaduw wil zien zet hem zelf.
  De bomen werpen hun schaduw via `werkSchaduwBomenBij` (rond de schaduwdoos),
  niet via hun tegels.
- **De avondstand wordt na het opstarten in stukjes vertaald** (stap 155, `warmDeAvondOpInStukjes` in js/main.js, `avondBelofte`):
  zolang dat loopt slaat de hoofdlus in het menu zijn beeld over (`avondBezig`). Een proef die de avond meet of
  shaderprogramma's telt over een `await` heen, wacht eerst op `__game.avondBelofte` (of `voorbereidSpel`, dat erop wacht).
- **Verander tijdens het spelen nooit het aantal zichtbare lichtbronnen** (stap 83).
  Three vertaalt dan élk materiaal opnieuw. Regel met `intensity`, niet met
  `visible`, en laat het aantal hoogstens bij zonsopkomst en zonsondergang
  veranderen. Wat nieuwe materialen maakt (de kopieën van het vervagen) moet ook
  met de avondlampen aan voorvertaald worden (`metAvondlampen`).
- **Werk dat aan de positie van de speler hangt is verdacht.** Rondkijken en lopen
  tekenen hetzelfde beeld; hapert alleen lopen, dan zit het in wat er bij het
  bewegen gebeurt (verhuizen, zichtlijnen, lampen).
- **`pgrep -f` en `pkill -f` vinden zichzelf.** Een wachtlus op een procesnaam
  eindigt nooit, en `pkill -f` met zo'n patroon schiet de eigen shell af (exit 144).
  Wacht op een regel in het log en stop processen op hun PID.
- **Een zelfgemaakt wegvak heeft `w` en `walkOff` nodig**, anders staat een
  voetganger op NaN. **Meerdere schoten achter elkaar vragen om een beeld
  ertussen**: de terugslag wordt per beeld gedempt.
- **Auto's zijn dekking, maar geen botsdoos** (stap 89). `zichtVrij` vraagt js/vehicles.js
  om `blokkeertZicht` (`zetZichtBlokker`): een auto houdt de kijklijn tegen, behalve
  als een eindpunt erin staat. Vijanden raken met een dobbelsteen zodra ze je
  zien; wie niet ziet, schiet niet.
- **Op het viaduct telt de hoogte altijd mee** (stap 90). `grondHoogte(x, z, y)` geeft
  onder het dek het maaiveld; wie iets neerzet met y = 0 of `-Infinity` (uitstappen,
  buit, een startpunt naast de oprit) zet het op de N7. Geef ook `resolveCollisions`
  en `zichtVrij(…, grondY)` de hoogte mee: de pijler onder het dek is een doos van 0
  tot 4,7 m over de hele breedte. Plekken voorbij de einden van het dek: `langsAs`.
- **Een auto naar het dek verplaatsen: eerst de hoogte.** `vehicles.zetNeer` peilt
  de grond vanaf `mesh.position.y`; een auto die van 0 m op het viaduct springt
  komt onder het dek op de N7 uit. Zet `mesh.position.y` eerst op dekhoogte.
- **Een gekochte auto heeft geen vaste plek in `vehicles.cars`** (stap 92). De opslag zoekt de auto
  waar je in zat op zijn index; voor een auto uit de showroom is dat `auto.eigen` en `garage.autoVan`.
  Topsnelheid en trek komen uit `RIJ[soort]` in `voegToe`, dus een auto die op de oprit teruggezet
  wordt is ook weer snel.
- **Niet elke rijbaan heeft een wegas** (stap 93). De hoofdweg ten zuiden van de rotonde
  bij de Lemmerweg is in de BGT een rijbaanvlak zonder as, dus de routeplanner
  (js/navigatie.js) neemt de smalle parallelweg ernaast. Een route voor iets dat hard
  moet (de race) altijd uittekenen en nameten; js/race.js meet dat stuk uit het vlak.
- **De hoofdlus roept `verhaal.update` ook aan als het spel stilstaat** (het zwart en het
  filmbeeld op het startscherm), maar niet in het pauzemenu (`gepauzeerd`, stap 95). Wat
  in een missie met de tijd loopt, hoort daar dus in; een eigen timer in js/main.js niet.
- **`voor` in js/autobinnen.js is de bovenkant van de voorruit** (stap 149, 151), niet de voet: de motorkap liep tot daar, dertig
  centimeter onder het glas door de cabine, met de wissers erachter. Gebruik `maat.ruit` (binnen) en `ruitVoet().buiten`.
- **Een geëxtrudeerde vorm is groter dan zijn profiel** (stap 95): de afronding
  (`bevelSize`) legt er rondom plaat omheen. Koplampen verdwenen daardoor in de romp van
  de Ferrari, en zijn wielkasten zijn vijf centimeter krapper dan getekend.
- **Een melding blijft in de DOM staan** (`hud.melding`): alleen de doorzichtigheid gaat na
  een paar tellen naar nul. Een proef die op `#missie` naar "MISLUKT" kijkt, ziet dat daarna voor
  altijd; vang de melding zelf af (tools/schaduwtest.mjs `__misluktNu`).
- **`raceNaloop` ruimt de auto van Bouwman op** zodra je buiten missie 14 ver weg bent. Een
  missie die hem hergebruikt (15, 16, 17, 18) moet daar uitgezonderd zijn, anders verdwijnt hij onder het
  volgen. In stap 109 reed hij zo onzichtbaar onder de heli.
- **Een kogel in een proef raakt alleen wat zijn wereldmatrix heeft bijgewerkt** (stap 109). Headless tekent
  de lus niet, dus een auto die verplaatst is staat voor de straal nog op zijn oude plek: roep
  `scene.updateMatrixWorld(true)` aan vóór `player.shoot()` (tools/avondtest.mjs).
- **Auto's rijden door alles lager dan 3,5 m** (`resolveCollisions(…, 3.5, …)` in js/vehicles.js): borden, hekken
  en heggen houden een auto niet tegen, ook al zei de README tot stap 111 van wel. Wie iets "auto-dicht" wil, maakt de
  doos hoger.
- **`player.wapenSoort` is een getter** (`wapens[wapenNr]`): een proef die een wapen wil kiezen zet `wapens` en
  `wapenNr`, anders schiet hij stil met het pistool (stap 111).
- **Shift met [, ] of \\ is een missie**, niet de klok (stap 97). js/sfeer.js zette met
  \\ de klok aan en schoof met [ en ] een uur op, ook met shift erbij: missie 15 starten zette
  de dag in vier minuten aan het lopen. Een nieuwe sneltoets: kijk of sfeer.js hem niet ook pakt.
- **Een instantie heeft geen mesh**: geparkeerde auto's staan in `vehicles.cars` maar zonder
  eigen `mesh`; wie op `c.mesh.visible` filtert ziet ze niet, `botsAutos` wel (stap 97: Bouwman
  reed door geparkeerde auto's heen, en de speler erachter botste ertegen). `vehicles.zetNeer` geeft
  zo'n auto sinds stap 102 zelf het losse model (`maakBestuurbaar`); daarvoor viel hij erop om.
- **De routeplanner kent geen rijrichting** (stap 97): rotondes nam hij de korte kant, met de
  klok mee. js/schaduw.js herkent rotondes aan een rijbaanvlak met een rond gat en geeft de ring
  één richting (alleen de stukken langs de ring; een in- of uitrit blijft twee kanten op, anders
  werd een uitrit doodlopend). De race gaat al goed over zijn rotonde.
- **De routeplanner kent geen hoogte** (stap 96). Het knooppunt van de Stadsrondweg op de
  Dúvelsrak ligt 5,6 m hoog, maar de Stadsrondweg-Zuid oostwaarts en de N7 liggen eronder en
  raken het dek in de plattegrond: een route reed van het dek zo die weg op. js/schaduw.js knipt
  assen door waar ze onder een open dek lopen; meet een route voor iets dat hem rijdt altijd met
  `grondHoogte` na (de lijn draagt `sprong`).
- **Het verkeer rijdt niet over de BGT-as maar over `gladPad(as)`** (stap 98): om de twee meter
  een monster, gladgestreken, met `raak` en `vmax`. `t.t` is een index in die gladde lijn, niet in
  de as; wie een auto op een as zet gebruikt `zetOp` (die zoekt het monster erbij). Een computer-
  bestuurder die `drive` gebruikt stuurt met `keys.stuur` (−1…1), niet met A/D: dat slingert.
- **De grond ligt niet overal op nul** (stap 103). Een erf ligt op 12 cm, gras op 4 (de `y` van de
  vlakken in de kaart). Iets plats op de grond (de kegel van missie 17) lag op 7 cm dus ónder het erf;
  js/schuur.js peilt de hoogte uit de vlakken (`grondPeiler`), en tools/ronaldtest.mjs meet het na met
  een straal recht naar beneden.
- **Een straatnaam is niet altijd een rijweg** (stap 107). "Tinga" is bij het pand van Radio Tinga een
  voetpad (`drive: false`); de rijweg met die naam ligt 75 m verder. Wie een plek "aan de X" zoekt,
  kijkt naar alle assen met die naam, en apart naar de dichtstbijzijnde weg voor auto's.
- **Een camera in een filmbeeld buiten kan in een schuurtje staan** (stap 107): Molenkrite 15 plus
  (14, 8) m was een tuinhuis. Zet hem op of langs de weg (`plekVoorDeDeur`), duw hem de botsdozen uit,
  en meet in de proef elk beeld (onder de 6 m; daarboven hangt hij boven de daken).
- **Kijk of een proefnaam al bestaat** (stap 106): `tools/puntentest.mjs` van 13 sep werd bijna
  overschreven door een nieuwe proef met dezelfde naam. Eerst `ls tools/` en `grep` in package.json.
- **`addCollider` draait de andere kant op dan `rotation.y`** (stap 154): de doos van het fietsenrek stond een kwartslag
  gedraaid over de plekken van de fietsen. Meet een nieuwe botsdoos na met `resolveCollisions` langs beide assen.
- **Een voetganger met `p.doe` staat niet op zijn wegvak** (stap 154): js/gedrag.js zet x, z en yaw; wie door `npcs.people`
  loopt en iemand wil verplaatsen, maakt eerst `npcs.gedrag.afmaken(p)`. Wie `verborgen` is (in de winkel) krijgt geen
  lichaam en wordt niet aangereden.
- **`hidden` is niet hetzelfde als weg** (stap 106). Een id-selector met `display` (`#schap { display:
  flex }`) wint van de browserregel voor `[hidden]`: het schap stond na een bezoek aan Tinga State
  altijd in beeld, terwijl de proef `.hidden === true` zag. Geef zo'n element een eigen
  `#naam[hidden] { display: none }`, en meet in een proef met `getComputedStyle`.
- **Doorschieten hangt aan `player.vuurAan`** (stap 105). Dat ging alleen aan met een vergrendelde muis;
  slepen (geen vergrendeling) en de vuurknop op een aanraakscherm schoten één keer. Een nieuwe manier
  van vuren zet `vuurAan` aan en uit; `update` doet het doorschieten voor elk wapen met `auto`.
- **`position: fixed` maakt een eigen laag** (stap 104). `#ui` had geen z-index, dus lag hij op 0 en
  schoven de filmbalken (4) over het gesprek heen, ook al had `#dialoog` zelf z-index 5. Nu is `#ui`
  5; een nieuwe laag boven of onder de hud hoort tussen de filmbalken (4) en de overgang (6).
- **Een eigen doel (stap 104) loopt naast de missie**: js/main.js (`eigenDoel`, `werkEigenDoelBij`) rekent
  met een eigen `Navigatie` en zet `hud.zetEigenNav`; `hud.zetNavigatie` blijft van js/verhaal.js. Zolang
  de grote kaart open is, is de muis van de kaart (`player.kaartMuis`), niet van rondkijken en schieten.
- **Een filmbeeld van missie 16 zet zijn camera elk beeld** (`werkInvalFilmBij`, vóór de vroege returns
  van `update`) en houdt de speler of zijn auto vast (`invalFilm.vast`). Een foto van een filmbeeld leest
  `verhaal.inval.filmCam` en zet de camera via de speler (tools/invalshots.mjs), net als bij missie 12.
- **Een nieuwe winkel of plek op de kaart** (stap 100) levert `winkels` met een `wat` dat in
  `HUD.PICTO` en `HUD.PICTO_KLEUR` staat, en een regel in de legenda (js/main.js, `zetLegenda`)
  met zijn bedragen uit de module zelf; `npm run legendatest` kijkt of elk speldje een icoon heeft.
- **Een nieuwe missie met een wachtfase hoort in `KLUS_WACHT`** (stap 99), anders komt er
  daar geen klus; en een nieuwe `werk…Bij` van een missie die op je kan wachten hoort achter
  `!wachtOpKlus`, anders gaat hij tijdens een klus gewoon door.
- **Opslaan kan niet altijd** (stap 117). `verhaal.waaromNietOpslaan()` weigert tijdens een gesprek, een filmbeeld
  (`body.film`), het zwart, de titelrol en het neergaan; F5 vraagt het, en het checkpoint wacht erop. Een nieuwe
  missie hoort in `herstel` een tak te hebben (`hervat…`), en een gesprek dat na het laden weg is moet daar naar
  een stap kunnen die zonder dat gesprek verder kan (`doorNaar`). Tot stap 117 hadden missie 6, 8 en 9 er geen,
  en werd elk gesprek "missie 1". Een mislukte missie begint altijd zichzelf opnieuw (`herstartMissie`), ook
  als er een opslag is (stap 118); laden is F9 of het menu.
- **Laden ruimt eerst op** (stap 120–122): `herstel` roept de opruimers van missie 7, 8 en 10–18 aan, met de
  klokjes die ze bewaren eerst leeg (de opslag heeft de klok al gezet), en zet het herstelpunt (`punt`) uit de opslag. Een nieuwe missie die iets in de wereld zet dat
  schiet of de speler vastzet (`vuurSlot`), hoort daar ook een opruimer te hebben. En `dood` sluit een open gesprek.
- **js/opslag.js zet je ná het verhaal in de auto van het opslaan** (stap 121). Zet een `hervat…` je zelf in een
  auto (de grid, de Golf van Mark), dan houdt `verhaal.naLaden()` je daar; je eigen Ferrari bestaat pas na
  `garage.herstel`, dus de race zet de grid daar opnieuw neer. Bij missie 16–18 zet `naLaden` je te voet neer als
  `hervat…` je verplaatste (stap 122).
- **Een auto vervangen of opruimen** gaat met `vervangAuto` of `vehicles.verwijder`, niet met verstoppen: verstopte
  auto's blijven in `vehicles.cars` staan en stapelen bij elke poging (stap 121, 122). De auto van Bouwman niet.
- **Net na een missie kan er niet opgeslagen worden** zolang `brugNaT`, `raceNaT`, `invalNaT`, `ronaldNaT` of `uitzNaT`
  loopt (stap 122); het checkpoint wacht tot na de ochtend.
- **Een missie die in het zwart begint** (`startMissie` vanuit de callback van `zwartMet`) houdt dat zwart: binnen
  de callback knipt `stopNaloop` het niet weg (`inZwartSprong`, stap 121).
- **Het aftellen naar de volgende missie (`naMissieT`) wacht op een open gesprek** (stap 121). Zet hem vóór het
  gesprek, niet alleen in zijn callback: neergaan sluit het gesprek zonder callback.
- **Een nieuwe keuze met 1, 2 of 3** hoort ook in `verhaal.openKeuze` (stap 118): daar maakt js/main.js op een
  aanraakscherm knoppen van; zonder regel daar zit een telefoon vast.
- **js/verhaal.js is één groot bereik.** Een `function` met een naam die er al is
  overschrijft de andere stil (hoisting): in stap 89 namen `beginGevecht` en
  `naarDeC4` zo die van missie 10 en 11 over, en van stap 96 tot 102 reed missie 12 na het plan de
  avond van missie 15 in (`naarDeAvond`). `npm run overgangtest` kijkt er vooraf naar, zonder browser.
- **Een klokje na een missie** (`brugNaT`, `raceNaT`, `invalNaT`) en het zwart erna horen bij het
  laden en bij een nieuwe missie weg: `stopNaloop` (stap 102). Een nieuwe missie met zo'n klokje
  zet het daar bij, anders springt zijn ochtend in de volgende.
- **De klok loopt standaard mee** (stap 125: `sfeer.voorkeur`, een dag in `DAG_MINUTEN` = 48 minuten).
  js/verhaal.js `werkMissieKlokBij`: in een missie die echt bezig is (`missieBezig`: niet klaar en niet in zijn
  `KLUS_WACHT`-fase) loopt hij alleen van 7 tot 18 uur (`MISSIE_AVOND`; 's nachts stil), en hij staat stil
  zolang het verhaal de tijd vasthoudt (`klokVastDoorVerhaal`: het zwart, de
  klokjes na een missie, de `…KlokWas`-waarden, de titelrol, het uitje), en zet hem anders terug op de
  voorkeur. Een proef die `sfeer.loopt` zelf zet, wordt bij de volgende `verhaal.update` overschreven; zet
  `sfeer.zetVoorkeur` of de tijd zelf. Begint een missie 's nachts, dan springt het naar 9:00
  (`MISSIE_OCHTEND`), behalve in het zwart en direct na laden (`naHerstel`). Een nieuwe missie met een
  nacht zet die zelf, in het zwart, zoals de bestaande.
- **Het weer is een getal** (stap 126): `zwaar` in js/sfeer.js (helder 0, bewolkt 1, regen 2) schuift vanzelf naar
  `weerDoel` in `WEER_OVERGANG` tellen; zicht, lucht en zon mengen mee (`W3`), `weer` (regen, nat wegdek) gaat
  halverwege om. `sfeer.weer = …` zet het meteen, dus proeven die een weer willen, blijven gewoon werken; een proef
  die `sfeer.update` met de klok aan over een heel uur laat lopen, kan het weer zien wisselen (`autoWeer`).
- **De routeplanner kent eilanden** (stap 127): een doel op een los stuk pad (de stoep van Radio Tinga) gaf `null`.
  `Navigatie.route` gaat nu naar het bereikbare punt het dichtst bij het doel; een lijn voor iets dat rijdt
  (`lijnDoor`) controleert nog steeds zelf.
- **De lange achtergrondopname kan een proef platleggen** (stap 128): in deze container duurden dertig beelden
  `geluid.omgeving` 604 s (ook met de code van stap 127), en `wensentest` en de muziekregels van `dealtest` kwamen
  daardoor niet verder. Hangt een proef zonder melding, loop de stap dan los na met een logboek in de pagina
  (`window.__log`), en zet de oude versie ernaast.
- **Er zijn meer opslagplekken** (stap 127, js/opslag.js): `tinga.spel.v1` is plek 1, daarna `tinga.spel.v1.n`, en
  `tinga.spel.actief` zegt welke. Een proef die de opslag wist, wist alle plekken (zie tools/wensentest.mjs), en een
  nieuw spel (`startNieuwSpel`) schrijft bij de eerste F5 naar een nieuwe plek.
- **Een geluid van de gebruiker is een opname** (stap 127): `geluid.explosie`, `heli` en de portofoon gebruiken de
  buffers zodra `laadOpnames` klaar is, anders het gemaakte geluid. De politieheli zet zijn bron elk beeld op stil
  buiten vier sterren; een andere heli heeft daarom een eigen bron (`heliBron(sleutel, …)`).
- **Met de drone in de lucht is de camera van de drone** (stap 124): `player.inDrone`, `player.update` draait niet
  (Erik staat stil), spatie/C/schieten doen niets voor Erik, en de stille tak van de hoofdlus zet de camera dan niet
  terug. Een filmbeeld, een auto, zitten, binnen, laden en geraakt worden halen hem vanzelf terug; een nieuwe plek
  die de speler verplaatst of de camera zet, hoort `drone.terug()` aan te roepen.
- **Een auto uit `voegToe` buiten beeld parkeren** (de vuilniswagen van stap 124 staat op 100 km als hij niet
  rijdt): hij blijft in `vehicles.cars`. Een proef die `cars[i]` zoekt, kijkt naar `driveable`.
- **Een getter die een object teruggeeft is een momentopname** (`verhaal.brug`):
  lees hem na elke stap opnieuw, anders toets je een oude stand.
- **Het wapen staat op laag 1** en wordt apart getekend (`tekenWapen`); een eigen
  render van de scène laat het dus weg, tenzij de camera die laag aanzet.
- **Lege schermafdrukken** komen meestal doordat de camera niet bij de mensen
  staat of doordat NPC's hun positie uit `p.seg` herleiden; zet de camera en
  bevries npcs/voertuigen voor de foto.

**Wacht op de gebruiker:** de wapenmeldingen ("kogels doen geen schade na in/uit de
auto", en op 26 sep "vanaf de auto schieten schiet ik niemand meer neer") zijn in de
proef niet te reproduceren (`npm run wapentest`, ook vanuit de auto in beide camera's,
groen). Gevraagd: welk wapen, eerste of derde persoon, stilstaand of rijdend, zie je
het schot, reageren mensen?

## 7 · Wat er nog open staat

Kort; de volledige lijst met uitleg staat onderaan `docs/METHODIEK.md`.

1. 3D BAG-tegels aan de noordoostrand en aan de westkant van IJlst.
2. Wegblokkades aan de rand van de wereld (het mechanisme staat er, de plekken
   moeten van de gebruiker komen — **K** zet je positie op het klembord). Sinds stap 130 ook een grens zonder hek
   (`GRENZEN` in js/afsluiting.js), de eerste op de N7 bij (−364, −614). Sinds stap 170 ook een afzetting op de Stadsrondweg-Zuid bij (1708, −110).
3. Steekproef van adressen: woningtype, goothoogte, voorgevelrichting. Sinds stap 155 meet `npm run voorgeveltest` de voorkant
   van elke woning (98,0 % met openingen) en noemt per straat wat nog met foto's nagelopen moet worden.
4. Alleen bouwen wat in de buurt is. Het opstarten is van 72 naar ~46 s headless
   (gevels en reliëf komen na het opstarten, stap 75; de avondshaders na het opstarten in stukjes, stap 155); wat er
   nog zit: het eerste beeld (~15 s, het vertalen van de shaders), de gebouwen (7 s), de ondergrond en de straten (5 s elk).
5. Dakdetails en de achterkant van het Kruirad.
6. Straten zonder foto: Windbord, Voorzoom, Buitenroede 40–74, Zeskanter, Omloop.
7. De editor (F2) en de oude objecten uit `data.js` rekenen nog in pixels.
8. Koepeldaken en de 75 nieuwbouwwoningen zonder 3D-model.
9. Rechtenvrije muziek voor de autoradio (wat er staat is een plaatshouder).
10. De overzichtsbladen `docs/screenshots/objecten.png` en `woningtypen.png`.
11. Panden die nog het naamloze `spil`-type dragen (de school, de Ligger/Loper).
12. ~~Onder de zuilengang door kunnen lopen, en een deur de Poiesz in~~: sinds stap 152, met schuifdeuren.
13. `npm run relieftest` meet 343 MB texturegeheugen tegen een grens van 260 —
    al van vóór stap 75.
14. Belichting: echte SSAO (nu alleen omgevingsschaduw aan de voet van de muren,
    js/licht.js). Scherpere schaduw en de reflectie met de klok mee zijn af.
15. ~~Voorgevel de Vang~~: sinds stap 155 nagemeten, de voorgevel met deur en ramen loopt van de grond tot 2,6 m (`voorgeveltest`).
16. Dakkapellen: het doek van de voorkant wordt over de hele kapel uitgerekt
    (13 % van de kapeldriehoeken wijkt meer dan 1,8 keer af; gebouwtest).
17. ~~De wapens van de NPC's~~: sinds stap 123 afgeronde, gedeelde modellen (`npcWapen` in js/persoon.js).
18. ~~Voetgangers op afstand~~: sinds stap 154 een grof figuurtje tussen 200 en 350 m vóór je (`zetExtras`).
19. ~~Molenkrite 130c: de tuindeur achter de hoekbank~~: sinds stap 126 houdt de bank een doorgang van 0,9 m
    voor een tuindeur in dezelfde wand (`DEUR_ACHTER` in js/interieur.js); `huistest` groen.
20. Wat een beeld op de grafische kaart kost is headless niet te meten
    (swiftshader). Sinds stap 87 loopt de schaduwpas rijdend elk beeld; hapert
    het op een zwakke kaart nog, dan is een kleinere schaduwkaart de eerste stap.
21. ~~Een voetganger die aan het eind van zijn wegvak naar de overkant sprong~~: sinds stap 123 een
    oversteek (`steek`) in `pickSegment`.
22. `npm run bevolkingtest` is sinds stap 89 op één controle rood: rijdend over de
    Wieken één meting van 22 zonder mensen binnen 80 m. Gezocht (METHODIEK, stap
    89): het zit niet in één bestand, het neerzetten is chaotisch gevoelig.
23. `npm run missietest` is in deze container rood op alles waar de muziek echt moet
    spelen (zes controles, en de twee van stap 95 over de wissel): na 1,4 s staat het
    volume op 0,004. Met audio.js van vóór stap 95 precies dezelfde zes (27 sep 2026,
    nagemeten); het ligt aan het afspelen in deze omgeving, niet aan de code. Op een
    machine met geluid opnieuw draaien.
24. **Missie 18** staat er helemaal (stap 107 en 109). Uit het oude ontwerp niet gebouwd: de boot van
    Bouwman over de vaart en een wisseltoets tussen de deur en van buiten (de gebruiker koos de
    buitencamera). De ondertitels zijn samengevat uit de opdracht, niet woordelijk uit de mp3.
25. Een `Bewaking` heeft geen vluchtgedrag: de man die in missie 1 opspringt schiet terug; wie wil dat er een
    wegrent, bouwt dat in js/bewaking.js (stap 119 koos terugschieten).
26. ~~`npm run verhaaltest` rood op de bank en de tv van Molenkrite 15~~: de proef toetste de maten van vóór de
    inrichting van 23 sep (een hoekbank naar de kamer gemeten, een tv van 1,28 m); sinds stap 126 toetst hij de
    regels van die inrichting.
27. **Kermis** (gevraagd 5 okt 2026 om te onthouden als latere uitbreiding): een kermis op een plein of
    parkeerterrein, met attracties, kraampjes en geluid. Nog niets van gebouwd.
29. **Geluid weg na de hapering rond 18:00** (stap 128): niet na te spelen. js/audio.js weigert nu NaN in een AudioParam en zet
    een stilgevallen context weer aan; komt het terug, dan `geluidNaN.geweigerd` en `ctx.state` uitlezen.
30. **De eerste nacht ver van het beginpunt** vertaalt three de nachtvarianten van wat daar staat (bij het kantoor aan het
    water tientallen, stap 159): het voorvertalen van de avond (`warmDeAvondOpInStukjes`) tekent alleen wat vanaf het
    beginpunt in beeld is. Een los `renderer.compile` met de avondlampen hielp niet; mogelijk hangt het aan meer dan de lampen. Stap 160: ook het voorvertalen zonder wegknippen (de hele kaart) hielp niet; bij de BP-shop twee eigen programma's.
28. Het einde van missie 18 staat sinds stap 127 om 22:00 (vuurwerk). De handlangers hebben geen eigen lichaam in de
    auto (de flits zit aan het raam); de scooters wel.

## 8 · Waar wat gedocumenteerd wordt

- `README.md` — voor de speler: wat er in het spel zit, per missie en per
  onderwerp, met schermafdrukken uit `docs/screenshots/`.
- `docs/METHODIEK.md` — voor de bouwer: per stap wat er gemaakt is, wat er
  misging en waarom het nu zo is. Elke ronde krijgt hier een blok, inclusief de
  fouten — dat is het nuttigste deel van het bestand.
