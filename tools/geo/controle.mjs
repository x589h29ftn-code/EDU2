// Controleert de brondata in data/geo/ vóór er iets mee gebouwd wordt:
// zijn alle bestanden er, staan ze in RD (EPSG:28992), vallen ze binnen het
// gebied, en wat zit erin (aantallen per objecttype en per functie)?
//
// De uitkomst is een leesbaar verslag. Dat verslag — en niet een plaatje — is
// wat je aan Claude geeft om mee verder te werken.
//
//   node tools/geo/controle.mjs            controleert data/geo/
//   node tools/geo/controle.mjs <map>      controleert een andere map
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { leesOorsprong, rdNaarWgs } from './rd.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const MAP = process.argv[2] || join(HIER, '..', '..', 'data', 'geo');

// Verwachte bronbestanden (GeoJSON, EPSG:28992) en het attribuut dat de
// objecten indeelt. PDOK/QGIS gebruikt per export nét andere kolomnamen;
// daarom staan er meerdere kandidaten.
const BRONNEN = [
  { naam: 'bgt_wegdeel.geojson',              omschrijving: 'BGT wegdeel (rijbaan, voetpad, fietspad, parkeervlak, inrit)', klasse: ['functie', 'bgt_functie', 'function'], extra: ['fysiekVoorkomen', 'bgt_fysiekvoorkomen', 'surfaceMaterial'], verplicht: true },
  { naam: 'bgt_ondersteunendwegdeel.geojson', omschrijving: 'BGT ondersteunend wegdeel (berm, verkeerseiland)', klasse: ['functie', 'bgt_functie', 'function'], extra: ['fysiekVoorkomen', 'bgt_fysiekvoorkomen', 'surfaceMaterial'], verplicht: true },
  { naam: 'bgt_begroeidterreindeel.geojson',  omschrijving: 'BGT begroeid terreindeel (gras, groenvoorziening, bosplantsoen)', klasse: ['fysiekVoorkomen', 'bgt_fysiekvoorkomen', 'class'], extra: ['plus_fysiekVoorkomen', 'plus_fysiekvoorkomen'], verplicht: true },
  { naam: 'bgt_onbegroeidterreindeel.geojson', omschrijving: 'BGT onbegroeid terreindeel (erf, open verharding, zand)', klasse: ['fysiekVoorkomen', 'bgt_fysiekVoorkomen', 'bgt_fysiekvoorkomen', 'class'], extra: ['plus_fysiekVoorkomen'], verplicht: true },
  { naam: 'bgt_waterdeel.geojson',            omschrijving: 'BGT waterdeel (sloot, vijver, kanaal)', klasse: ['type', 'bgt_type', 'class'], verplicht: true },
  { naam: 'bgt_ondersteunendwaterdeel.geojson', omschrijving: 'BGT ondersteunend waterdeel (oever, slootkant)', klasse: ['type', 'bgt_type', 'class'], verplicht: false },
  { naam: 'bgt_pand.geojson',                 omschrijving: 'BGT pand (grondvlak van elk gebouw)', klasse: ['bgt_status', 'status'], verplicht: true },
  { naam: 'bgt_overigbouwwerk.geojson',       omschrijving: 'BGT overig bouwwerk (schuur, overkapping, bassin)', klasse: ['type', 'bgt_type', 'class'], verplicht: false },
  { naam: 'bgt_vegetatieobject.geojson',      omschrijving: 'BGT vegetatieobject (losse bomen, hagen)', klasse: ['type', 'bgt_type', 'class'], extra: ['plus_type', 'plus_Type'], verplicht: true },
  { naam: 'bgt_paal.geojson',                 omschrijving: 'BGT paal (lichtmast, verkeersbordpaal, afsluitpaal)', klasse: ['type', 'bgt_type', 'class'], verplicht: false },
  { naam: 'bgt_bak.geojson',                  omschrijving: 'BGT bak (afvalbak, container)', klasse: ['type', 'bgt_type', 'class'], verplicht: false },
  { naam: 'bgt_straatmeubilair.geojson',      omschrijving: 'BGT straatmeubilair (bank, speeltoestel, fietsenrek)', klasse: ['type', 'bgt_type', 'class'], verplicht: false },
  { naam: 'bgt_scheiding.geojson',            omschrijving: 'BGT scheiding (hek, muur, damwand)', klasse: ['type', 'bgt_type', 'class'], verplicht: false },
  { naam: 'bgt_kunstwerkdeel.geojson',        omschrijving: 'BGT kunstwerkdeel (brug, duiker)', klasse: ['type', 'bgt_type', 'class'], verplicht: false },
  { naam: 'bgt_weginrichtingselement.geojson', omschrijving: 'BGT weginrichtingselement (drempel, wegmarkering)', klasse: ['type', 'bgt_type', 'class'], verplicht: false },
  { naam: 'bgt_openbareruimtelabel.geojson',  omschrijving: 'BGT openbareruimtelabel (straatnaam op de kaart)', klasse: ['openbareRuimteType', 'openbareruimtetype', 'type'], extra: ['tekst', 'text', 'label'], verplicht: true },
  { naam: 'bgt_functioneelgebied.geojson',    omschrijving: 'BGT functioneel gebied (speeltuin, park, begraafplaats)', klasse: ['bgt_type', 'type'], extra: ['naam'], verplicht: false },
  { naam: 'bgt_overbruggingsdeel.geojson',    omschrijving: 'BGT overbruggingsdeel (brugdek, viaduct)', klasse: ['bgt_type', 'type', 'class'], verplicht: false },
  { naam: 'bgt_spoor.geojson',                omschrijving: 'BGT spoor', klasse: ['function', 'functie'], verplicht: false },
  // BAG-adressen zijn welkom maar niet nodig: 3D BAG levert identificatie, bouwjaar en status,
  // en de BGT zet de huisnummers al op het pand (nummeraanduidingreeks).
  { naam: 'bag_pand.geojson',                 omschrijving: 'BAG pand (identificatie, bouwjaar, status)', klasse: ['status'], extra: ['bouwjaar', 'oorspronkelijkBouwjaar', 'oorspronkelijkbouwjaar'], verplicht: false },
  { naam: 'bag_verblijfsobject.geojson',      omschrijving: 'BAG verblijfsobject (huisnummer, straat, gebruiksdoel)', klasse: ['gebruiksdoel'], extra: ['openbare_ruimte', 'openbareRuimteNaam', 'openbareruimtenaam', 'straatnaam'], verplicht: false },
  { naam: 'bag3d_pand.geojson',               omschrijving: '3D BAG (daktype, goot- en nokhoogte, bouwjaar per pand)', klasse: ['b3_dak_type'], extra: ['goothoogte', 'nokhoogte', 'b3_h_maaiveld', 'oorspronkelijkbouwjaar', 'status', 'identificatie'], verplicht: true },
];

const problemen = [], waarschuwingen = [];
const uit = [];
const regel = (s = '') => uit.push(s);

function leesJson(pad) {
  try { return JSON.parse(readFileSync(pad, 'utf8')); }
  catch (e) { problemen.push(`${basename(pad)}: geen geldige JSON (${e.message})`); return null; }
}

// Loopt door alle coördinaten van een geometrie (ook multi- en polygonen).
function* coords(g) {
  if (!g) return;
  if (g.type === 'GeometryCollection') { for (const s of g.geometries) yield* coords(s); return; }
  const diep = (a) => typeof a[0] === 'number';
  const loop = function* (a) { if (diep(a)) yield a; else for (const b of a) yield* loop(b); };
  yield* loop(g.coordinates);
}

function bbox(features) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const f of features) for (const [x, y] of coords(f.geometry)) {
    if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y;
  }
  return b;
}

// RD-coördinaten liggen voor Nederland ruwweg tussen x 0..300 km en y 300..620 km.
const isRd = ([x, y]) => x > -7000 && x < 300000 && y > 289000 && y < 629000;
const isGraden = ([x, y]) => Math.abs(x) <= 180 && Math.abs(y) <= 90;

function overlapt(a, b) { return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]; }
function binnen(a, b) { return a[0] >= b[0] && a[1] >= b[1] && a[2] <= b[2] && a[3] <= b[3]; }

function kolom(features, kandidaten) {
  for (const k of kandidaten) if (features.some(f => f.properties && f.properties[k] !== undefined && f.properties[k] !== null)) return k;
  return null;
}

function telling(features, k) {
  const t = new Map();
  for (const f of features) { const v = String(f.properties?.[k] ?? '(leeg)'); t.set(v, (t.get(v) || 0) + 1); }
  return [...t.entries()].sort((a, b) => b[1] - a[1]);
}

// ------------------------------------------------------------------ gebied
regel(`# Controle brondata — ${MAP}`);
regel();

let gebiedBbox = null;
const gebiedPad = join(MAP, 'gebied.geojson');
if (!existsSync(gebiedPad)) {
  problemen.push('gebied.geojson ontbreekt (stap 1 van docs/METHODIEK.md)');
} else {
  const g = leesJson(gebiedPad);
  const fs = g?.features || (g?.type === 'Feature' ? [g] : []);
  if (!fs.length) problemen.push('gebied.geojson bevat geen polygoon');
  else {
    const eerste = coords(fs[0].geometry).next().value;
    if (!isRd(eerste)) problemen.push(`gebied.geojson staat niet in RD (eerste punt ${eerste}); exporteer in EPSG:28992`);
    gebiedBbox = bbox(fs);
    const [w, h] = [gebiedBbox[2] - gebiedBbox[0], gebiedBbox[3] - gebiedBbox[1]];
    regel(`## Gebied`);
    regel(`- omhullende RD: X ${gebiedBbox[0].toFixed(0)}–${gebiedBbox[2].toFixed(0)}, Y ${gebiedBbox[1].toFixed(0)}–${gebiedBbox[3].toFixed(0)} (${w.toFixed(0)} × ${h.toFixed(0)} m)`);
    if (isRd(eerste)) {
      const [la, lo] = rdNaarWgs((gebiedBbox[0] + gebiedBbox[2]) / 2, (gebiedBbox[1] + gebiedBbox[3]) / 2);
      regel(`- middelpunt WGS84: ${la.toFixed(6)}, ${lo.toFixed(6)}`);
      if (w > 3000 || h > 3000) waarschuwingen.push(`gebied is ${w.toFixed(0)} × ${h.toFixed(0)} m; dat is groter dan een wijk. Klopt de buffer?`);
    }
  }
}

const oorsprongPad = join(MAP, 'oorsprong.json');
let oorsprong = null;
try { oorsprong = leesOorsprong(oorsprongPad); } catch (e) { problemen.push(e.message); }
if (!oorsprong) problemen.push('oorsprong.json ontbreekt (stap 1 van docs/METHODIEK.md)');
else {
  regel(`- oorsprong spelwereld: ${oorsprong.naam || '(onbenoemd)'} op RD ${oorsprong.rd[0]}, ${oorsprong.rd[1]}`);
  if (!isRd(oorsprong.rd)) problemen.push('oorsprong.json: "rd" is geen RD-coördinaat');
  else if (gebiedBbox && !binnen([...oorsprong.rd, ...oorsprong.rd], gebiedBbox)) problemen.push('oorsprong ligt buiten het gebied');
  if (oorsprong.ijkpunten && oorsprong.ijkpunten.length < 3) waarschuwingen.push('oorsprong.json: minder dan drie ijkpunten; de oude pixelkaart is dan niet om te rekenen');
}
regel();

// ------------------------------------------------------------------ bronnen
regel(`## Bronbestanden (${join(MAP, 'bron')})`);
regel();
regel('| bestand | objecten | geometrie | indeling | status |');
regel('|---|---|---|---|---|');

const bronMap = join(MAP, 'bron');
const aanwezig = existsSync(bronMap) ? new Set(readdirSync(bronMap)) : new Set();
const details = [];
let bagPanden = null, bag3dPanden = null, bgtPanden = null;

for (const b of BRONNEN) {
  const pad = join(bronMap, b.naam);
  if (!aanwezig.has(b.naam)) {
    regel(`| ${b.naam} | – | – | – | ${b.verplicht ? '**ontbreekt**' : 'ontbreekt (optioneel)'} |`);
    if (b.verplicht) problemen.push(`${b.naam} ontbreekt — ${b.omschrijving}`);
    continue;
  }
  aanwezig.delete(b.naam);
  const j = leesJson(pad);
  if (!j) { regel(`| ${b.naam} | – | – | – | **onleesbaar** |`); continue; }
  const fs = j.features || [];
  if (!fs.length) { regel(`| ${b.naam} | 0 | – | – | **leeg** |`); problemen.push(`${b.naam} bevat geen objecten`); continue; }

  const typen = telling(fs.map(f => ({ properties: { t: f.geometry?.type } })), 't').map(([t, n]) => `${t} ${n}`).join(', ');
  const eerste = coords(fs[0].geometry).next().value;
  let status = 'ok';
  if (!eerste) { status = '**geen coördinaten**'; problemen.push(`${b.naam}: geometrie zonder coördinaten`); }
  else if (isGraden(eerste)) { status = '**in graden, niet RD**'; problemen.push(`${b.naam} staat in WGS84 (graden); exporteer opnieuw in EPSG:28992`); }
  else if (!isRd(eerste)) { status = '**onbekend stelsel**'; problemen.push(`${b.naam}: coördinaten passen niet in RD (${eerste})`); }
  else if (gebiedBbox) {
    const bb = bbox(fs);
    if (!overlapt(bb, gebiedBbox)) { status = '**buiten gebied**'; problemen.push(`${b.naam} ligt volledig buiten het gebied`); }
    else if (bb[2] - bb[0] > (gebiedBbox[2] - gebiedBbox[0]) * 3 || bb[3] - bb[1] > (gebiedBbox[3] - gebiedBbox[1]) * 3) {
      // Lange wegen, sloten en de N7 lopen door tot ver buiten het gebied; de generator knipt ze.
      status = 'ok, loopt door buiten gebied';
    }
  }
  const k = kolom(fs, b.klasse);
  const indeling = k ? `${k}: ${telling(fs, k).slice(0, 6).map(([v, n]) => `${v} ${n}`).join(', ')}${telling(fs, k).length > 6 ? ', …' : ''}` : '(indelingskolom niet gevonden)';
  if (!k) waarschuwingen.push(`${b.naam}: geen van de kolommen ${b.klasse.join('/')} gevonden; kolommen zijn: ${Object.keys(fs[0].properties || {}).slice(0, 12).join(', ')}`);
  regel(`| ${b.naam} | ${fs.length} | ${typen} | ${indeling} | ${status} |`);

  const extraKol = (b.extra || []).map(e => [e, kolom(fs, [e])]).filter(([, kk]) => kk);
  if (extraKol.length) details.push(`- **${b.naam}** — ${b.omschrijving}. Extra kolommen: ${extraKol.map(([e]) => e).join(', ')}.` +
    (b.naam.startsWith('bgt_wegdeel') || b.naam.startsWith('bgt_begroeid') ? ` ${extraKol[0][0]}: ${telling(fs, extraKol[0][0]).map(([v, n]) => `${v} ${n}`).join(', ')}` : ''));
  if (b.naam === 'bag_pand.geojson') bagPanden = fs;
  if (b.naam === 'bag3d_pand.geojson') bag3dPanden = fs;
  if (b.naam === 'bgt_pand.geojson') bgtPanden = fs;
}
for (const rest of aanwezig) {
  if (rest.endsWith('.geojson')) waarschuwingen.push(`${rest} staat in bron/ maar wordt niet gebruikt (naam niet herkend)`);
}
regel();
if (details.length) { regel('## Bijzonderheden per bestand'); regel(); details.forEach(regel); regel(); }

// ------------------------------------------------------------------ samenhang
regel('## Samenhang');
regel();
if (bagPanden && bag3dPanden) {
  const idKol = kolom(bagPanden, ['identificatie', 'pand_id', 'id']);
  const id3d = kolom(bag3dPanden, ['identificatie', 'pand_id', 'id']);
  if (idKol && id3d) {
    const norm = (v) => String(v).replace(/^NL\.IMBAG\.Pand\./, '').replace(/-0$/, '');
    const set3d = new Set(bag3dPanden.map(f => norm(f.properties[id3d])));
    const zonder = bagPanden.filter(f => !set3d.has(norm(f.properties[idKol])));
    regel(`- BAG-panden: ${bagPanden.length}; 3D BAG-panden: ${bag3dPanden.length}; BAG-panden zonder 3D-model: ${zonder.length}`);
    if (zonder.length > bagPanden.length * 0.05) waarschuwingen.push(`${zonder.length} BAG-panden hebben geen 3D BAG-tegenhanger (nieuwbouw of andere tegel?)`);
  } else regel('- kon BAG en 3D BAG niet koppelen: geen kolom identificatie');
}
if (bagPanden && bgtPanden) regel(`- BGT-panden: ${bgtPanden.length} tegenover BAG-panden: ${bagPanden.length} (hoort ongeveer gelijk te zijn)`);
if (bgtPanden && bag3dPanden) {
  const idBgt = kolom(bgtPanden, ['identificatieBAGPND', 'identificatiebagpnd']);
  const id3d = kolom(bag3dPanden, ['identificatie', 'pand_id', 'id']);
  if (idBgt && id3d) {
    const norm = (v) => String(v).replace(/^NL\.IMBAG\.Pand\./, '');
    const set3d = new Set(bag3dPanden.map(f => norm(f.properties[id3d])));
    const zonder = bgtPanden.filter(f => !set3d.has(norm(f.properties[idBgt])));
    const metNummer = zonder.filter(f => f.properties.huisnummers?.length).length;
    regel(`- BGT-panden: ${bgtPanden.length}; met 3D BAG-model: ${bgtPanden.length - zonder.length}; zonder: ${zonder.length}, waarvan ${metNummer} met huisnummer (de rest zijn meestal schuurtjes en garages, die krijgen een standaardhoogte)`);
    if (metNummer > 0) waarschuwingen.push(`${metNummer} BGT-panden met huisnummer hebben geen 3D BAG-model (nieuwbouw na de 3D BAG-versie?)`);
  }
}
regel();

// ------------------------------------------------------------------ uitkomst
regel('## Uitkomst');
regel();
if (waarschuwingen.length) { regel('Waarschuwingen:'); waarschuwingen.forEach(w => regel(`- ${w}`)); regel(); }
if (problemen.length) { regel('**Problemen (eerst oplossen):**'); problemen.forEach(p => regel(`- ${p}`)); }
else regel('**Geen problemen.** De brondata is compleet en staat in RD; de generator kan ermee aan de slag.');

console.log(uit.join('\n'));
process.exit(problemen.length ? 1 : 0);
