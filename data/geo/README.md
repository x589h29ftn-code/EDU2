# data/geo — brondata van de wijk

Hier staat alles waaruit de kaart van Tinga gegenereerd wordt. Zie
`docs/METHODIEK.md` voor het waarom en de volgorde; dit bestand zegt alleen wat
waar hoort. Controleer de map altijd met:

```bash
node tools/geo/controle.mjs
```

## Bestanden in deze map

| bestand | inhoud |
|---|---|
| `gebied.geojson` | één polygoon: CBS-buurt Tinga met 150 m buffer, EPSG:28992 |
| `oorsprong.json` | RD-coördinaat van de oorsprong van de spelwereld (kruispunt Molenkrite / Monnikmolen / Jasker) en drie of meer ijkpunten voor de oude pixelkaart; zie `oorsprong.voorbeeld.json` |
| `bron/` | de gedownloade lagen, zie hieronder |

## Ruwe downloads en omzetting

De ruwe downloads staan ook in `bron/`, zodat alles opnieuw te maken is:

| bestand | wat | omzetten met |
|---|---|---|
| `bgt_tinga.zip.zip` | BGT als CityGML uit de PDOK-downloadviewer (getekend gebied rond Tinga) | `node tools/geo/bgt2geojson.mjs data/geo/bron/bgt_tinga.zip.zip` |
| `9-632-1008.gpkg` | 3D BAG-tegel als GeoPackage (attributen en 2D-vlakken) | `node tools/geo/bag3d2geojson.mjs data/geo/bron/9-632-1008.gpkg` |
| `9-632-1008.city.json` | dezelfde tegel als CityJSON (3D-dakmodellen, LoD 2.2) | wordt in stap 4 direct gelezen |

De omzetters knippen op `gebied.geojson`, laten historische objecten weg en
schrijven de GeoJSON-bestanden hieronder. Daarna: `node tools/geo/plaat.mjs` voor
de kaartplaat (`bgt-plaat.png` + `.pgw`) en `node tools/geo/controle.mjs`.

## Bestanden in `bron/`

Alle vectorbestanden zijn **GeoJSON in EPSG:28992** (RD New), geknipt op
`gebied.geojson`. Wie ze met QGIS maakt in plaats van met de omzetters: rechtsklik
op de laag → Exporteren → Objecten opslaan als… → formaat GeoJSON, CRS EPSG:28992.
Kolomnamen mogen afwijken; `controle.mjs` zoekt de gangbare varianten en zegt het
als hij ze niet vindt. De omzetter uit CityGML houdt de IMGeo-namen aan: `function`,
`surfaceMaterial`, `class`, `plus_fysiekVoorkomen`, `bgt_type`, `bgt_status`,
`identificatieBAGPND`, en op panden een lijst `huisnummers`.

| bestand | bron | nodig | belangrijkste kolommen |
|---|---|---|---|
| `bgt_wegdeel.geojson` | BGT | ja | `functie` (rijbaan lokale weg, voetpad, fietspad, parkeervlak, inrit, voetgangersgebied), `fysiekVoorkomen` (gesloten verharding = asfalt, open verharding = klinkers/tegels) |
| `bgt_ondersteunendwegdeel.geojson` | BGT | ja | `functie` (berm, verkeerseiland), `fysiekVoorkomen` |
| `bgt_begroeidterreindeel.geojson` | BGT | ja | `fysiekVoorkomen` (grasland overig, groenvoorziening, bosplantsoen, loofbos, houtwal), `plus_fysiekVoorkomen` (gras- en kruidachtigen, bosplantsoen, haag, …) |
| `bgt_onbegroeidterreindeel.geojson` | BGT | ja | `fysiekVoorkomen` (erf, open verharding, gesloten verharding, zand) |
| `bgt_waterdeel.geojson` | BGT | ja | `type` (waterloop, watervlakte, greppel/droge sloot) |
| `bgt_ondersteunendwaterdeel.geojson` | BGT | nee | `type` (oever/slootkant) |
| `bgt_pand.geojson` | BGT | ja | grondvlak per pand, `identificatieBAGPND` |
| `bgt_overigbouwwerk.geojson` | BGT | nee | `type` (overkapping, schuur, bassin) |
| `bgt_vegetatieobject.geojson` | BGT | ja | `type` (boom, haag), `plus_type` |
| `bgt_paal.geojson` | BGT | nee | `type` (lichtmast, verkeersbordpaal, afsluitpaal, poller, vlaggenmast) |
| `bgt_bak.geojson` | BGT | nee | `type` (afvalbak, afval apart plaats, container) |
| `bgt_straatmeubilair.geojson` | BGT | nee | `type` (bank, picknicktafel, fietsenrek, speeltoestel, abri) |
| `bgt_scheiding.geojson` | BGT | nee | `type` (hek, muur, damwand, kademuur) |
| `bgt_kunstwerkdeel.geojson` | BGT | nee | `type` (duiker, brug, stuw) |
| `bgt_weginrichtingselement.geojson` | BGT | nee | `type` (verkeersdrempel, wegmarkering) |
| `bgt_openbareruimtelabel.geojson` | BGT | ja | `tekst` (de straatnaam), `openbareRuimteType` (Weg, Water) — punt met hoek, op de plek waar de naam op de kaart staat |
| `bag_pand.geojson` | BAG | nee | `identificatie`, `bouwjaar`, `status` — 3D BAG levert dit al |
| `bag_verblijfsobject.geojson` | BAG | nee | `openbare_ruimte` (straat), `huisnummer`, `gebruiksdoel` — de BGT zet de huisnummers al op het pand |
| `bag3d_pand.geojson` | 3D BAG (GeoPackage-laag `pand` plus de dakvlakken uit `lod22_2d`) | ja | `identificatie`, `oorspronkelijkbouwjaar`, `status`, `b3_dak_type`, `b3_h_maaiveld`, `goothoogte` en `nokhoogte` (meters boven maaiveld), `b3_h_goot_nap`, `b3_h_nok_nap` |
| `9-632-1008.city.json` | 3D BAG (CityJSON, dezelfde tegel) | later | het 3D-model van elk dak; hoeft niet geknipt |
| `luchtfoto.tif` | PDOK luchtfoto 8 cm, uitsnede van het gebied als GeoTIFF in EPSG:28992 | later | alleen voor het bovenaanzicht-overlay en kleurreferentie |

Optionele bestanden zijn niet minder waar, ze zijn alleen niet altijd door de
gemeente gevuld. Wat er is, wordt gebruikt.

## Waar het vandaan komt

- BGT: `https://api.pdok.nl/lv/bgt/download/v1_0/ui/` (Custom, polygoon als WKT, alle
  objecttypen, formaat CityGML of GML-light) en dan in QGIS met de plug-in **BGT
  Import** omzetten naar GeoPackage; of met de plug-in **BGT Downloader** direct als
  GeoPackage-lagen ophalen.
- BAG: QGIS plug-in **PDOK Services** → BAG WFS → lagen `pand` en `verblijfsobject`.
- 3D BAG: `https://3dbag.nl/en/download` → tegel kiezen → GeoPackage en CityJSON.
- Luchtfoto: PDOK Services → Luchtfoto Actueel Ortho HR (WMTS) → Raster → Uitsnede →
  op het gebied → opslaan als GeoTIFF.
- Gebied: PDOK Services → CBS Wijken en Buurten → buurt Tinga → Vector → Buffer 150 m.

## Wat hier niet hoort

Schermafbeeldingen, Street View-foto's en met de hand overgetypte coördinaten.
Foto's die voor de stijl gebruikt worden, krijgen hun antwoord in
`data/stijl/straten.json` (stap 6 van de methodiek), niet een plek in deze map.
