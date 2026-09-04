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

## Bestanden in `bron/`

Alle vectorbestanden zijn **GeoJSON in EPSG:28992** (RD New), geknipt op
`gebied.geojson`. In QGIS: rechtsklik op de laag → Exporteren → Objecten opslaan
als… → formaat GeoJSON, CRS EPSG:28992, alleen geselecteerde objecten (na
selectie op locatie binnen het gebied). Kolomnamen mogen afwijken; `controle.mjs`
zoekt de gangbare varianten en zegt het als hij ze niet vindt.

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
| `bag_pand.geojson` | BAG | ja | `identificatie`, `bouwjaar`, `status` |
| `bag_verblijfsobject.geojson` | BAG | ja | `openbare_ruimte` (straat), `huisnummer`, `huisletter`, `toevoeging`, `postcode`, `gebruiksdoel`, `pandidentificatie` |
| `bag3d_pand.geojson` | 3D BAG (GeoPackage-laag `pand`, LoD 2.2) | ja | `identificatie`, `b3_dak_type`, `b3_h_maaiveld`, `b3_h_dak_min`, `b3_h_dak_50p`, `b3_h_dak_70p`, `b3_h_dak_max`, `b3_bouwlagen` |
| `bag3d_tegel.city.json` | 3D BAG (CityJSON, dezelfde tegel) | later | het 3D-model van elk dak; hoeft niet geknipt |
| `luchtfoto.tif` | PDOK luchtfoto 8 cm, uitsnede van het gebied als GeoTIFF in EPSG:28992 | ja | alleen voor het bovenaanzicht-overlay en kleurreferentie |

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
