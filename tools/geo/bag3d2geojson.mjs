// Haalt uit de 3D BAG-GeoPackage de laag `pand` (grondvlak plus daktype,
// maaiveld-, goot- en nokhoogte, bouwjaar, status) binnen het gebied en
// schrijft data/geo/bron/bag3d_pand.geojson.
//
//   node tools/geo/bag3d2geojson.mjs data/geo/bron/9-632-1008.gpkg
//
// Leest de GeoPackage met de ingebouwde SQLite van Node (22+) en ontleedt de
// WKB-geometrie zelf; geen GDAL nodig.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const GEO = join(HIER, '..', '..', 'data', 'geo');
const gpkg = process.argv[2] || join(GEO, 'bron', '9-632-1008.gpkg');
const uit = process.argv[3] || join(GEO, 'bron', 'bag3d_pand.geojson');

const gebied = (() => {
  const g = JSON.parse(readFileSync(join(GEO, 'gebied.geojson'), 'utf8'));
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  const loop = (a) => { if (typeof a[0] === 'number') { b[0] = Math.min(b[0], a[0]); b[1] = Math.min(b[1], a[1]); b[2] = Math.max(b[2], a[0]); b[3] = Math.max(b[3], a[1]); } else for (const c of a) loop(c); };
  for (const f of g.features) loop(f.geometry.coordinates);
  return b;
})();

// GeoPackage-geometrie: kop (magic 'GP', versie, vlaggen, srs_id, envelop) en dan WKB.
export function gpkgNaarGeoJSON(buf) {
  if (buf[0] !== 0x47 || buf[1] !== 0x50) throw new Error('geen GeoPackage-geometrie');
  const vlaggen = buf[3];
  const envType = (vlaggen >> 1) & 7;
  const envBytes = [0, 32, 48, 48, 64][envType] ?? 0;
  let p = 8 + envBytes;
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const lees = () => {
    const le = buf[p] === 1; p += 1;
    let type = dv.getUint32(p, le); p += 4;
    // Z/M in EWKB-vlaggen of als 1000/2000/3000-offset
    let dims = 2;
    if (type & 0x80000000) { dims++; type &= ~0x80000000; }
    if (type & 0x40000000) { dims++; type &= ~0x40000000; }
    if (type >= 3000) { dims = 4; type -= 3000; } else if (type >= 2000) { dims = 3; type -= 2000; } else if (type >= 1000) { dims = 3; type -= 1000; }
    const punt = () => { const c = [dv.getFloat64(p, le), dv.getFloat64(p + 8, le)]; p += 8 * dims; return c.map(v => Math.round(v * 1000) / 1000); };
    const ring = () => { const n = dv.getUint32(p, le); p += 4; const r = []; for (let i = 0; i < n; i++) r.push(punt()); return r; };
    switch (type) {
      case 1: return { type: 'Point', coordinates: punt() };
      case 2: return { type: 'LineString', coordinates: ring() };
      case 3: { const n = dv.getUint32(p, le); p += 4; const rs = []; for (let i = 0; i < n; i++) rs.push(ring()); return { type: 'Polygon', coordinates: rs }; }
      case 6: { const n = dv.getUint32(p, le); p += 4; const ps = []; for (let i = 0; i < n; i++) ps.push(lees().coordinates); return { type: 'MultiPolygon', coordinates: ps }; }
      default: throw new Error(`WKB-type ${type} niet ondersteund`);
    }
  };
  return lees();
}

const bboxVan = (g) => { const b = [Infinity, Infinity, -Infinity, -Infinity]; const loop = (a) => { if (typeof a[0] === 'number') { b[0] = Math.min(b[0], a[0]); b[1] = Math.min(b[1], a[1]); b[2] = Math.max(b[2], a[0]); b[3] = Math.max(b[3], a[1]); } else for (const c of a) loop(c); }; loop(g.coordinates); return b; };
const overlapt = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

if (!existsSync(gpkg)) { console.error(`${gpkg} bestaat niet`); process.exit(1); }
const db = new DatabaseSync(gpkg, { readOnly: true });
const KOLOMMEN = ['identificatie', 'oorspronkelijkbouwjaar', 'status', 'b3_dak_type', 'b3_bouwlagen', 'b3_h_maaiveld', 'b3_h_nok', 'b3_n_nok', 'b3_n_vlakken',
  'b3_opp_grond', 'b3_opp_dak_plat', 'b3_opp_dak_schuin', 'b3_volume_lod22', 'b3_kwaliteitsindicator', 'b3_pw_bron'];
const rijen = db.prepare(`select geom, ${KOLOMMEN.join(', ')} from pand`).all();

// De goothoogte staat niet in de laag pand, maar in lod22_2d per dakvlak; de
// laagste b3_h_min van de dakvlakken van een pand is de goot, de hoogste
// b3_h_max de nok (boven NAP).
const dak = new Map();
for (const r of db.prepare('select identificatie, min(b3_h_min) goot, max(b3_h_max) nok, avg(b3_hellingshoek) helling from lod22_2d group by identificatie').all()) dak.set(r.identificatie, r);

const features = [];
let buiten = 0;
for (const r of rijen) {
  const g = gpkgNaarGeoJSON(r.geom);
  if (!overlapt(bboxVan(g), gebied)) { buiten++; continue; }
  const props = {};
  for (const k of KOLOMMEN) if (r[k] !== null && r[k] !== undefined) props[k] = r[k];
  const d = dak.get(r.identificatie);
  if (d) {
    props.b3_h_goot_nap = Math.round(d.goot * 100) / 100;
    props.b3_h_nok_nap = Math.round(d.nok * 100) / 100;
    if (props.b3_h_maaiveld !== undefined) {
      props.goothoogte = Math.round((d.goot - props.b3_h_maaiveld) * 100) / 100;
      props.nokhoogte = Math.round((d.nok - props.b3_h_maaiveld) * 100) / 100;
    }
  }
  features.push({ type: 'Feature', properties: props, geometry: g });
}
writeFileSync(uit, JSON.stringify({ type: 'FeatureCollection', name: 'bag3d_pand', crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::28992' } }, features }));

const tel = (k) => { const t = {}; for (const f of features) { const v = f.properties[k] ?? '(leeg)'; t[v] = (t[v] || 0) + 1; } return Object.entries(t).sort((a, b) => b[1] - a[1]).map(([v, n]) => `${v} ${n}`).join(', '); };
console.log(`3D BAG: ${rijen.length} panden in de tegel, ${buiten} buiten het gebied, ${features.length} geschreven naar ${uit}`);
console.log(`daktype: ${tel('b3_dak_type')}`);
console.log(`bouwlagen: ${tel('b3_bouwlagen')}`);
console.log(`status: ${tel('status')}`);
const jaren = features.map(f => f.properties.oorspronkelijkbouwjaar).filter(Boolean);
console.log(`bouwjaar: ${Math.min(...jaren)}–${Math.max(...jaren)}`);
