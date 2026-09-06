// Zet de BGT-download (CityGML, zoals de PDOK-downloadviewer die levert) om in
// GeoJSON per objecttype, geknipt op het gebied, alleen actuele objecten.
//
//   node tools/geo/bgt2geojson.mjs [download.zip]
//
// Zonder argument leest hij álle bgt_*.zip in data/geo/bron/ en voegt ze samen;
// dubbele objecten (een pand dat in twee downloads zit) gaan er op lokaalID uit.
// Zo is een tweede stad erbij zetten een kwestie van de download in bron/ zetten
// en de keten opnieuw draaien.
//
// Leest data/geo/gebied.geojson voor de omhullende, schrijft
// data/geo/bron/bgt_<type>.geojson en drukt een telling af. Objecten met een
// eindRegistratie (historie) worden overgeslagen; bogen (gml:Arc) worden in
// stukjes van een halve meter benaderd. Geen afhankelijkheden buiten Node en
// het programma `unzip`.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const GEO = join(HIER, '..', '..', 'data', 'geo');
const bronnen = process.argv[2]
  ? [process.argv[2]]
  : readdirSync(join(GEO, 'bron')).filter(n => /^bgt_.*\.zip$/.test(n)).sort().map(n => join(GEO, 'bron', n));
const uitMap = process.argv[3] || join(GEO, 'bron');
if (!bronnen.length) throw new Error('geen bgt_*.zip in data/geo/bron/');

// ------------------------------------------------------------ gebied
function gebiedBbox() {
  const pad = join(GEO, 'gebied.geojson');
  if (!existsSync(pad)) throw new Error('data/geo/gebied.geojson ontbreekt');
  const g = JSON.parse(readFileSync(pad, 'utf8'));
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  const loop = (a) => { if (typeof a[0] === 'number') { b[0] = Math.min(b[0], a[0]); b[1] = Math.min(b[1], a[1]); b[2] = Math.max(b[2], a[0]); b[3] = Math.max(b[3], a[1]); } else for (const c of a) loop(c); };
  for (const f of g.features || [g]) loop(f.geometry.coordinates);
  return b;
}
const GEBIED = gebiedBbox();

// ------------------------------------------------------------ GML-geometrie
const getallen = (s) => s.trim().split(/\s+/).map(Number);
const paren = (s) => { const n = getallen(s); const p = []; for (let i = 0; i + 1 < n.length; i += 2) p.push([n[i], n[i + 1]]); return p; };

// Boog door drie punten, benaderd met punten om de halve meter.
function boog(p0, p1, p2) {
  const [ax, ay] = p0, [bx, by] = p1, [cx, cy] = p2;
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-9) return [p0, p1, p2];
  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
  const r = Math.hypot(ax - ux, ay - uy);
  let a0 = Math.atan2(ay - uy, ax - ux), a1 = Math.atan2(by - uy, bx - ux), a2 = Math.atan2(cy - uy, cx - ux);
  // draairichting zo kiezen dat p1 tussen p0 en p2 ligt
  const norm = (a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  let sweep = norm(a2 - a0), mid = norm(a1 - a0);
  if (mid > sweep) { sweep = sweep - 2 * Math.PI; }
  const n = Math.max(4, Math.ceil(Math.abs(sweep) * r / 0.5));
  const uit = [];
  for (let i = 0; i <= n; i++) { const a = a0 + sweep * i / n; uit.push([ux + r * Math.cos(a), uy + r * Math.sin(a)]); }
  return uit;
}

// Een ring: LinearRing met posList, of Ring met curveMember/Curve/segments.
function ring(xml) {
  const lr = /<gml:LinearRing>[\s\S]*?<gml:posList[^>]*>([^<]*)<\/gml:posList>/.exec(xml);
  if (lr) return paren(lr[1]);
  const pts = [];
  const seg = /<gml:(LineStringSegment|Arc|ArcString|LineString)\b[^>]*>[\s\S]*?<gml:posList[^>]*>([^<]*)<\/gml:posList>/g;
  let m;
  while ((m = seg.exec(xml))) {
    const p = paren(m[2]);
    let stuk = p;
    if (m[1] === 'Arc' || m[1] === 'ArcString') {
      stuk = [];
      for (let i = 0; i + 2 < p.length; i += 2) { const b = boog(p[i], p[i + 1], p[i + 2]); stuk.push(...(i ? b.slice(1) : b)); }
    }
    for (const q of stuk) { const l = pts[pts.length - 1]; if (!l || Math.hypot(l[0] - q[0], l[1] - q[1]) > 1e-4) pts.push(q); }
  }
  if (pts.length && (pts[0][0] !== pts[pts.length - 1][0] || pts[0][1] !== pts[pts.length - 1][1])) pts.push(pts[0]);
  return pts;
}

function polygoon(xml) {
  const ringen = [];
  const ext = /<gml:exterior>([\s\S]*?)<\/gml:exterior>/.exec(xml);
  if (!ext) return null;
  ringen.push(ring(ext[1]));
  const intr = /<gml:interior>([\s\S]*?)<\/gml:interior>/g;
  let m; while ((m = intr.exec(xml))) ringen.push(ring(m[1]));
  return ringen.filter(r => r.length >= 4);
}

function geometrie(xml) {
  if (!xml) return null;
  if (/<gml:MultiSurface/.test(xml)) {
    const polys = [];
    const re = /<gml:Polygon\b[^>]*>[\s\S]*?<\/gml:Polygon>/g; let m;
    while ((m = re.exec(xml))) { const p = polygoon(m[0]); if (p?.length) polys.push(p); }
    if (!polys.length) return null;
    return polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys };
  }
  if (/<gml:Polygon/.test(xml)) { const p = polygoon(xml); return p?.length ? { type: 'Polygon', coordinates: p } : null; }
  if (/<gml:Point/.test(xml)) { const m = /<gml:pos[^>]*>([^<]*)</.exec(xml); return m ? { type: 'Point', coordinates: getallen(m[1]) } : null; }
  if (/<gml:(LineString|Curve)\b/.test(xml)) {
    const pts = ring(xml.replace(/<gml:posList/, '<gml:posList')); // ring() verzamelt segmenten en LineStrings
    if (pts.length >= 2 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1] && !/<gml:Ring|<gml:LinearRing/.test(xml)) pts.pop();
    return pts.length >= 2 ? { type: 'LineString', coordinates: pts } : null;
  }
  return null;
}

const rond = (g) => {
  const r = (a) => typeof a[0] === 'number' ? a.map(v => Math.round(v * 1000) / 1000) : a.map(r);
  return { type: g.type, coordinates: r(g.coordinates) };
};

function bboxVan(g) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  const loop = (a) => { if (typeof a[0] === 'number') { b[0] = Math.min(b[0], a[0]); b[1] = Math.min(b[1], a[1]); b[2] = Math.max(b[2], a[0]); b[3] = Math.max(b[3], a[1]); } else for (const c of a) loop(c); };
  loop(g.coordinates);
  return b;
}
const overlapt = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

// ------------------------------------------------------------ attributen
const OVERSLAAN = new Set(['namespace', 'LV_publicatiedatum', 'tijdstipRegistratie', 'creationDate', 'terminationDate', 'inOnderzoek', 'plus_status', 'bronhouder', 'identificatie', 'NEN3610ID', 'posList', 'pos']);

function attributen(xml) {
  // geometrie eruit, dan alle bladelementen met tekst
  const kaal = xml.replace(/<imgeo:(geometrie[\w]*|kruinlijn[\w]*|positie|nummeraanduidingreeks)\b[\s\S]*?<\/imgeo:\1>/g, '')
    .replace(/<imgeo:(geometrie[\w]*|kruinlijn[\w]*)\b[^>]*\/>/g, '');
  const props = {};
  const re = /<(?:imgeo:)?([\w-]+)(?:\s[^>]*)?>([^<]+)<\/(?:imgeo:)?\1>/g;
  let m;
  while ((m = re.exec(kaal))) {
    const k = m[1].replace(/-/g, '_');
    if (OVERSLAAN.has(k)) continue;
    const v = m[2].trim();
    if (v === '' || v === 'geenWaarde' || v === 'waardeOnbekend') continue;
    // BAG-identificaties (16 cijfers, beginnen met 0) blijven tekst; de rest wordt getal.
    const getal = /^-?\d+(\.\d+)?$/.test(v) && !/identificatie/i.test(k) && !/^0\d/.test(v);
    props[k] = getal ? Number(v) : v;
  }
  const id = /<imgeo:lokaalID>([^<]+)</.exec(xml);
  if (id) props.lokaalID = id[1];
  return props;
}

// Labelposities (straatnaamlabels, huisnummers): plaatsingspunt + hoek (+ tekst).
function labelposities(xml) {
  const uit = [];
  const re = /<imgeo:Labelpositie>([\s\S]*?)<\/imgeo:Labelpositie>/g; let m;
  while ((m = re.exec(xml))) {
    const p = /<gml:pos[^>]*>([^<]*)</.exec(m[1]);
    const h = /<imgeo:hoek>([^<]*)</.exec(m[1]);
    if (p) uit.push({ pos: getallen(p[1]), hoek: h ? Number(h[1]) : 0 });
  }
  return uit;
}

// ------------------------------------------------------------ per bestand
function verwerk(gmlPad) {
  const xml = readFileSync(gmlPad, 'utf8');
  const type = basename(gmlPad, '.gml').replace(/^bgt_/, '');
  const features = [];
  let totaal = 0, historisch = 0, buiten = 0, zonderGeom = 0;
  const leden = xml.split('<cityObjectMember>').slice(1);
  for (const lid of leden) {
    totaal++;
    if (/<imgeo:eindRegistratie>/.test(lid)) { historisch++; continue; }
    const props = attributen(lid);
    const tag = /<imgeo:(\w+) gml:id/.exec(lid)?.[1];
    if (tag) props.objecttype = tag;

    if (type === 'openbareruimtelabel') {
      // één punt per labelpositie
      for (const lp of labelposities(lid)) {
        if (!overlapt([...lp.pos, ...lp.pos], GEBIED)) { buiten++; continue; }
        features.push({ type: 'Feature', properties: { ...props, hoek: lp.hoek }, geometry: rond({ type: 'Point', coordinates: lp.pos }) });
      }
      continue;
    }

    const gm = /<imgeo:(geometrie2d\w*|geometrie\w*)\b[^>]*>([\s\S]*?)<\/imgeo:\1>/.exec(lid);
    const g = gm ? geometrie(gm[2]) : null;
    if (!g) { zonderGeom++; continue; }
    if (!overlapt(bboxVan(g), GEBIED)) { buiten++; continue; }

    if (type === 'pand') {
      // huisnummers die de gemeente op het pand heeft gezet
      const nrs = [];
      const re = /<imgeo:Nummeraanduidingreeks>([\s\S]*?)<\/imgeo:Nummeraanduidingreeks>/g; let m;
      while ((m = re.exec(lid))) {
        const t = /<imgeo:tekst>([^<]*)</.exec(m[1]);
        for (const lp of labelposities(m[1])) nrs.push({ tekst: t ? t[1] : '', pos: lp.pos.map(v => Math.round(v * 1000) / 1000), hoek: lp.hoek });
      }
      if (nrs.length) props.huisnummers = nrs;
    }
    features.push({ type: 'Feature', properties: props, geometry: rond(g) });
  }
  return { type, features, totaal, historisch, buiten, zonderGeom };
}

// ------------------------------------------------------------ hoofdprogramma
mkdirSync(uitMap, { recursive: true });
const gebied = GEBIED.map(v => v.toFixed(0));
console.log(`gebied RD X ${gebied[0]}–${gebied[2]}, Y ${gebied[1]}–${gebied[3]}`);
console.log(`downloads: ${bronnen.map(b => basename(b)).join(', ')}\n`);

// per objecttype alles uit alle downloads bij elkaar, ontdubbeld op lokaalID
const perType = new Map();
for (const bron of bronnen) {
  let map = bron;
  if (bron.endsWith('.zip')) {
    map = join(tmpdir(), 'bgt_uitgepakt', basename(bron).replace(/\W+/g, '_'));
    mkdirSync(map, { recursive: true });
    execFileSync('unzip', ['-q', '-o', bron, '-d', map]);
  }
  for (const f of readdirSync(map).filter(n => n.endsWith('.gml')).sort()) {
    const r = verwerk(join(map, f));
    let t = perType.get(r.type);
    if (!t) perType.set(r.type, t = { type: r.type, features: [], gezien: new Set(), totaal: 0, historisch: 0, buiten: 0, zonderGeom: 0 });
    t.totaal += r.totaal; t.historisch += r.historisch; t.buiten += r.buiten; t.zonderGeom += r.zonderGeom;
    for (const q of r.features) {
      /*
       Ontdubbelen op lokaalID én plek. Alleen op het lokaalID kan niet: een
       straatnaam staat een paar keer langs dezelfde straat en die punten delen
       hun lokaalID, dus dan hield je van de 123 labels er nog 54 over. Twee
       downloads die hetzelfde object bevatten leveren wél precies hetzelfde
       eerste punt op.
      */
      const id = q.properties && q.properties.lokaalID;
      if (id) {
        let p = q.geometry.coordinates;
        while (Array.isArray(p) && Array.isArray(p[0])) p = p[0];
        const sleutel = `${id}|${(p[0] || 0).toFixed(2)},${(p[1] || 0).toFixed(2)}`;
        if (t.gezien.has(sleutel)) continue;
        t.gezien.add(sleutel);
      }
      t.features.push(q);
    }
  }
}

console.log('| type | in download | historisch | buiten gebied | zonder geometrie | **geschreven** |');
console.log('|---|---|---|---|---|---|');
let geschreven = 0;
for (const r of [...perType.values()].sort((a, b) => a.type.localeCompare(b.type))) {
  if (!r.features.length) { console.log(`| ${r.type} | ${r.totaal} | ${r.historisch} | ${r.buiten} | ${r.zonderGeom} | – |`); continue; }
  const uit = join(uitMap, `bgt_${r.type}.geojson`);
  writeFileSync(uit, JSON.stringify({ type: 'FeatureCollection', name: `bgt_${r.type}`, crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::28992' } }, features: r.features }));
  console.log(`| ${r.type} | ${r.totaal} | ${r.historisch} | ${r.buiten} | ${r.zonderGeom} | **${r.features.length}** |`);
  geschreven++;
}
console.log(`\n${geschreven} bestanden geschreven naar ${uitMap}`);
