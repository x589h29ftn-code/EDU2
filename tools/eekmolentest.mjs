/*
 Stap 165: de garageboxen aan de Eekmolen en de puntgevels van het plan Eekmolen / de Loper / Molenkrite
 (npm run eekmolentest). Gevraagd: "locatie 332.0, 296.5 zijn garageboxen", "323.5, 278.9 locatie eekmolen zijn
 niet goed", "325.9, 193.3 Idem eekmolen" en "Pas ook 435.3, 75.6 locatie zie foto aan de molenkrite".

   1. de typen uit de generator: negen garageboxen (Eekmolen 2a–2i), en elke woning van het plan (Eekmolen en de
      Loper 1976–1981 met de nok onder 9 m, Molenkrite 133–143) een puntgeveltype; de rest van die straten niet;
   2. de doeken: de garagebox zonder één ruit en met kanteldeuren in meer dan één kleur; de puntgevel met ramen op de
      begane grond én op de eerste en tweede verdieping; de berging zonder woonkamerpui;
   3. de garagerij in de wereld: per box een straal op 1,0 m tegen de deur (garagebox-gevel, de kleur van de deur),
      op 2,55 m de witte boeiboord, van boven het platte dak op de hoogte uit de BAG;
   4. de puntgevels in de wereld: over de hele voorkant van elke woning een raster van stralen van 1 m tot de top;
      geen witte houten topgevel en geen kapelwang of kapelkozijn meer, het hoogste vlak van de voorgevel (de punt)
      is steen of gevel van het eigen type, en de lage muren vooraan zijn bergingen;
   5. de nok haaks op de straat, uit de dakvlakken van het 3D BAG-model gemeten (ter informatie per straat);
   6. de botsdozen van alle panden blijven;
   7. geen nieuw shaderprogramma, overdag en 's nachts, met de nieuwe gevels verborgen en zichtbaar.

 Gebruik: npm run server &  node tools/eekmolentest.mjs [poort]
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fout = 0;
const ok = (goed, wat, extra = '') => { console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`); if (!goed) fout++; };
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
page.setDefaultTimeout(1800000);
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 1800000 });

const r = await page.evaluate(async () => {
  const THREE = await import('three');
  const g = window.__game, W = await import('./js/world.js'), T = await import('./js/textures.js');
  const { KAART } = await import('./js/kaart.js');
  document.getElementById('overlay').style.display = 'none';
  g.player.active = false; window.__autoplay = false;
  await g.voorbereidSpel();
  g.reliëfAf();
  const uit = {};
  const PUNT = ['eekmolen_punt', 'loper_punt', 'molenkrite_punt'];
  const NIEUW = [...PUNT, 'garagebox', 'eekmolen_berging', 'loper_berging', 'molenkrite_berging'];

  // ---- 1. de typen
  const nrLaag = (p) => Math.min(...p.nr.map(n => parseInt(n, 10)).filter(n => !isNaN(n)));
  const garages = KAART.panden.filter(p => p.type === 'garagebox');
  const punt = KAART.panden.filter(p => PUNT.includes(p.type));
  uit.garages = garages.map(p => p.straat + ' ' + p.nr.join()).sort();
  uit.punt = {}; for (const p of punt) uit.punt[p.type] = (uit.punt[p.type] || 0) + 1;
  const hoort = (p) => p.dak !== 'horizontal' && p.type !== 'schuur' && p.type !== 'tinyhouse' && (
    ((p.straat === 'Eekmolen' || p.straat === 'de Loper') && p.jaar >= 1976 && p.jaar <= 1981 && p.nok >= 7.5 && p.nok < 9)
    || (p.straat === 'Molenkrite' && p.jaar === 1979 && nrLaag(p) >= 133 && nrLaag(p) <= 143));
  uit.gemist = KAART.panden.filter(p => hoort(p) && !PUNT.includes(p.type)).map(p => `${p.straat} ${p.nr} (${p.type})`);
  uit.teVeel = punt.filter(p => !hoort(p)).map(p => `${p.straat} ${p.nr}`);
  uit.eekmolenRest = KAART.panden.filter(p => p.straat === 'Eekmolen' && p.type === 'eekmolen').length;

  // ---- 2. de doeken
  const doek = (type, n, lagen, achter, seed) => { const t = T.facade(type, n, lagen, achter, seed); T.maakAf(t); return t.image; };
  const isGlas = (r, gr, b) => (b - r) > 3 && gr >= b * 0.62 && (0.3 * r + 0.55 * gr + 0.15 * b) < 0.40 * 255;
  const telGlas = (img, y0 = 0, y1 = 1) => {
    const c = img.getContext('2d').getImageData(0, Math.floor(img.height * y0), img.width, Math.max(1, Math.floor(img.height * (y1 - y0)))).data;
    let n = 0; for (let i = 0; i < c.length; i += 4) if (isGlas(c[i], c[i + 1], c[i + 2])) n++;
    return n / (c.length / 4);
  };
  const kleurOp = (img, u, v, half = 3) => {
    const x = Math.max(0, Math.min(img.width - 1, Math.round(u * img.width))), y = Math.max(0, Math.min(img.height - 1, Math.round((1 - v) * img.height)));
    const c = img.getContext('2d').getImageData(Math.max(0, x - half), Math.max(0, y - half), half * 2 + 1, half * 2 + 1).data;
    let s = [0, 0, 0], n = 0; for (let i = 0; i < c.length; i += 4) { s[0] += c[i]; s[1] += c[i + 1]; s[2] += c[i + 2]; n++; }
    return s.map(v2 => Math.round(v2 / n));
  };
  uit.garageDoek = [0, 1, 2, 3, 4, 5].map(s => { const img = doek('garagebox', 1, 1, false, s); return { glas: telGlas(img), deur: kleurOp(img, 0.5, 0.35), band: kleurOp(img, 0.5, 0.96) }; });
  uit.puntDoek = PUNT.map(type => { const img = doek(type, 1, 3, false, 0); return { type, onder: telGlas(img, 2 / 3, 1), eerste: telGlas(img, 1 / 3, 2 / 3), tweede: telGlas(img, 0, 1 / 3) }; });
  uit.bergingDoek = ['eekmolen_berging', 'loper_berging', 'molenkrite_berging'].map(type => [0, 1, 2].map(s => +telGlas(doek(type, 1, 1, false, s)).toFixed(3)));
  uit.oudeDoek = +telGlas(doek('eekmolen', 1, 1, false, 0)).toFixed(3);   // ter vergelijking: de oude gevel met pui

  // ---- hulpjes voor de stralen
  const zichtbaar = (o) => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
  let doelen = [], lodBij = null;
  const verzamel = () => { doelen = []; g.scene.traverse(o => { if (o.isMesh && !o.isInstancedMesh && zichtbaar(o) && o.material && o.material.userData && o.material.userData.sleutel) doelen.push(o); }); };
  const naarLOD = (x, z) => { if (!lodBij || Math.hypot(x - lodBij[0], z - lodBij[1]) > 100) { W.updateLOD(x, z); g.scene.updateMatrixWorld(true); verzamel(); lodBij = [x, z]; } };
  const randAfst = (x, z, v) => { let best = Infinity; for (let i = 0, j = v.length - 1; i < v.length; j = i++) { const a = v[j], b = v[i], dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l)); best = Math.min(best, Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z)); } return best; };
  const binnen = (x, z, v) => { let c = false; for (let i = 0, j = v.length - 1; i < v.length; j = i++) { const a = v[i], b = v[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  const rc = new THREE.Raycaster();
  const straal = (o, d, p, max = 30) => {
    rc.set(o, d.clone().normalize()); rc.far = max;
    const h = rc.intersectObjects(doelen, false)[0];
    if (!h) return null;
    const bij = binnen(h.point.x, h.point.z, p.voet) || randAfst(h.point.x, h.point.z, p.voet) < 0.8;
    const mat = h.object.material, sl = (mat.userData.sleutel) || (mat.userData._bron && mat.userData._bron.userData.sleutel) || '?';
    const img = mat.map && mat.map.image;
    const kleur = (img && img.getContext && h.uv) ? kleurOp(img, ((h.uv.x % 1) + 1) % 1, ((h.uv.y % 1) + 1) % 1) : null;
    return { sl, bij, y: h.point.y, kleur, klasse: h.object.userData.klasse };
  };
  const normaal = (pts) => { let nx = 0, ny = 0, nz = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]); } const L = Math.hypot(nx, ny, nz) || 1; return [nx / L, ny / L, nz / L, L / 2]; };
  const vlakken = (p) => { const V = (i) => [p.v[3 * i], p.v[3 * i + 1], p.v[3 * i + 2]]; return p.f.map((f, k) => { const ring = f[0].map(V); const n = normaal(ring); return { ring, n, s: p.s[k], top: Math.max(...ring.map(q => q[1])), laag: Math.min(...ring.map(q => q[1])) }; }); };

  // ---- 3. de garagerij
  uit.garageRij = garages.map(p => {
    const [cx, cz] = [p.rect.cx, p.rect.cz]; naarLOD(cx, cz);
    const f = new THREE.Vector3(p.front[0], 0, p.front[1]).normalize();
    // het voorvlak uit het model: zijn midden
    const voor = vlakken(p).filter(v => v.s === 1 && Math.abs(v.n[1]) < 0.3 && v.n[0] * f.x + v.n[2] * f.z > 0.6).sort((a, b) => b.ring.length - a.ring.length)[0];
    const m = voor.ring.reduce((s, q) => [s[0] + q[0] / voor.ring.length, s[1] + q[2] / voor.ring.length], [0, 0]);
    const o = (y) => new THREE.Vector3(m[0] + f.x * 5, y, m[1] + f.z * 5);
    const deur = straal(o(1.0), f.clone().negate(), p), band = straal(o(2.55), f.clone().negate(), p);
    const dak = straal(new THREE.Vector3(cx, 12, cz), new THREE.Vector3(0, -1, 0), p);
    return { nr: p.nr.join(), deur, band, dak, hoogte: p.goot };
  });

  // ---- 4. de puntgevels: een raster van stralen over de hele voorkant
  const puntUit = [];
  for (const p of punt) {
    const st = T.HOUSE_STYLES[p.type];
    naarLOD(p.rect.cx, p.rect.cz);
    const f = new THREE.Vector3(p.front[0], 0, p.front[1]).normalize(), rr = new THREE.Vector3(f.z, 0, -f.x);
    const vl = vlakken(p);
    const voor = vl.filter(v => v.s === 1 && Math.abs(v.n[1]) < 0.3 && v.n[0] * f.x + v.n[2] * f.z > 0.6);
    // over de breedte van het pand (loodrecht op de voorkant) en van 1 m tot de top
    let b0 = Infinity, b1 = -Infinity, a1 = -Infinity;
    for (const q of p.voet) { const b = q[0] * rr.x + q[1] * rr.z, a = q[0] * f.x + q[1] * f.z; b0 = Math.min(b0, b); b1 = Math.max(b1, b); a1 = Math.max(a1, a); }
    const top = Math.max(...voor.map(v => v.top));
    const tel = { stralen: 0, raak: 0, wit: 0, kapel: 0, eigen: 0, berging: 0, pui: 0 }, witte = [];
    for (let b = b0 + 0.4; b < b1 - 0.3; b += 0.7) for (let y = 1.0; y < top - 0.3; y += 1.0) {
      const o = new THREE.Vector3(rr.x * b + f.x * (a1 + 6), y, rr.z * b + f.z * (a1 + 6));
      const h = straal(o, f.clone().negate(), p, 25); tel.stralen++;
      if (!h || !h.bij || !/^(gevel|steen|planken|dakkapel|pleister|damwand)\|/.test(h.sl)) continue;
      tel.raak++;
      if (h.sl.startsWith('planken|') || h.sl.startsWith('dakkapel|wang')) { tel.wit++; witte.push(`${h.sl}@${y.toFixed(1)}`); }
      if (h.sl.startsWith('dakkapel|')) tel.kapel++;
      if (h.sl.includes(`|${p.type}|`)) tel.eigen++;
      if (h.sl.includes('_berging|')) tel.berging++;
    }
    // de punt zelf: in het midden van het hoogste voorvlak, een meter onder zijn top
    // (over de breedte van dat vlak, want een punt is smal bovenin en het midden van zijn hoeken ligt er niet altijd op)
    // (de hoogste muur die op de grond begint en minstens een meter breed is: het 3D BAG-model heeft ook naar voren
    // kijkende strookjes midden op het dak, waar een trede in de nok zit)
    const breedte = (v) => { let a0 = Infinity, a2 = -Infinity; for (const q of v.ring) { const u = q[0] * rr.x + q[2] * rr.z; a0 = Math.min(a0, u); a2 = Math.max(a2, u); } return a2 - a0; };
    // (hoger dan een berging; begint het huis zelf in het model pas boven de berging, dan het hoogste brede vlak)
    const opTop = (l) => l.sort((a, b) => b.top - a.top)[0];
    const hoog = opTop(voor.filter(v => v.laag < 0.5 && breedte(v) >= 1.0 && v.top > st.laagTot))
      || opTop(voor.filter(v => breedte(v) >= 1.0 && v.top > st.laagTot)) || opTop(voor);
    let hu0 = Infinity, hu1 = -Infinity, ha = 0;
    for (const q of hoog.ring) { const u = q[0] * rr.x + q[2] * rr.z; hu0 = Math.min(hu0, u); hu1 = Math.max(hu1, u); ha += (q[0] * f.x + q[2] * f.z) / hoog.ring.length; }
    const puntRaak = [];
    // (op 1,0, 1,5 en 2,0 m onder de top: bij een paar modellen steekt het dak bovenin vóór de muur uit)
    for (const dy of [1.0, 1.5, 2.0]) for (let u = hu0 + 0.05; u <= hu1 - 0.05 + 1e-6; u += Math.max(0.1, (hu1 - hu0 - 0.1) / 8)) {
      const h = straal(new THREE.Vector3(rr.x * u + f.x * (ha + 6), hoog.top - dy, rr.z * u + f.z * (ha + 6)), f.clone().negate(), p, 25);
      if (h && h.bij) puntRaak.push(h.sl.split('|').slice(0, 2).join('|'));
    }
    const ph = puntRaak.length ? { sl: puntRaak.find(sl => sl === `gevel|${p.type}` || sl === `steen|${p.type}`) || puntRaak[0], alle: [...new Set(puntRaak)], bij: true, y: hoog.top - 1.0 } : null;
    // de lage muren vooraan: bergingen, geen woonkamerpui
    const lage = voor.filter(v => v.top <= st.laagTot && v.top > 2.0);
    const bergingen = lage.map(v => {
      const m = v.ring.reduce((s, q) => [s[0] + q[0] / v.ring.length, s[1] + q[2] / v.ring.length], [0, 0]);
      const h = straal(new THREE.Vector3(m[0] + f.x * 4, 1.2, m[1] + f.z * 4), f.clone().negate(), p, 12);
      return h ? h.sl.split('|').slice(0, 2).join('|') : '-';
    });
    // het schuine dakje van een berging: welke pannen
    const bergDak = vl.filter(v => v.s === 2 && v.n[1] > 0.2 && v.n[1] < 0.97 && v.top <= st.laagTot + 1.0).map(v => {
      const m = v.ring.reduce((s, q) => [s[0] + q[0] / v.ring.length, s[1] + q[1] / v.ring.length, s[2] + q[2] / v.ring.length], [0, 0, 0]);
      const h = straal(new THREE.Vector3(m[0], 12, m[2]), new THREE.Vector3(0, -1, 0), p, 20);
      return h ? h.sl : '-';
    });
    // de nok uit het 3D BAG-model: welk deel van het schuine dak kijkt opzij (nok haaks op de straat)
    let zij = 0, voorD = 0;
    for (const v of vl) { if (v.s !== 2 || v.n[1] > 0.97 || v.n[1] < 0.1) continue; const h = Math.hypot(v.n[0], v.n[2]); const c = Math.abs((v.n[0] * f.x + v.n[2] * f.z) / h); if (c < 0.5) zij += v.n[3]; else voorD += v.n[3]; }
    puntUit.push({ id: p.id, naam: `${p.straat} ${p.nr.join()}`, type: p.type, tel, witte: witte.slice(0, 3), punt: ph ? { sl: ph.sl, alle: ph.alle, bij: ph.bij, y: +ph.y.toFixed(2) } : null,
      puntTot: +(top - p.nok).toFixed(2), bergingen, bergDak, nokHaaks: zij / Math.max(1e-6, zij + voorD) });
  }
  uit.puntgevels = puntUit;

  // ---- 6. botsdozen
  const dicht = (x, z) => { const [cx, cz] = W.resolveCollisions(x, z, 0.4); return Math.hypot(cx - x, cz - z) > 0.3; };
  // (een raster van halve meters binnen het grondvlak, op minstens 0,8 m van de rand: het midden van de omhullende
  // rechthoek ligt bij een L-vormig pand soms in de tuin)
  uit.bots = [...garages, ...punt].map(p => {
    const xs = p.voet.map(q => q[0]), zs = p.voet.map(q => q[1]); let n = 0, d = 0;
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.5) for (let z = Math.min(...zs); z <= Math.max(...zs); z += 0.5) {
      if (!binnen(x, z, p.voet) || randAfst(x, z, p.voet) < 0.8) continue; n++; if (dicht(x, z)) d++;
    }
    return { naam: `${p.straat} ${p.nr}`, n, d };
  }).filter(b => !b.n || b.d / b.n < 0.75).map(b => `${b.naam} (${b.d}/${b.n})`);

  // ---- 7. shaders: de nieuwe gevels verborgen en zichtbaar, dag en nacht, op de vier plekken
  const C = g.camera, R = g.renderer;
  const plekken = [[[332, 1.7, 296.5], [332, 2, 283]], [[323.5, 1.7, 278.9], [305, 5, 277]], [[325.9, 1.7, 193.3], [305, 5, 192]], [[435.3, 1.7, 75.6], [410, 5, 85]]];
  const nieuwe = [];
  g.scene.traverse(o => { const sl = o.isMesh && o.material && o.material.userData && o.material.userData.sleutel; if (sl && NIEUW.some(t => sl.includes(`|${t}|`) || sl.endsWith(`|${t}`))) nieuwe.push(o); });
  uit.nieuweMeshes = nieuwe.length;
  const kijk = (uur, zien) => {
    for (const m of nieuwe) m.visible = zien;
    for (const [van, naar] of plekken) {
      g.sfeer.uur = uur; for (let i = 0; i < 30; i++) g.sfeer.update(0.1, van[0], van[2]);
      C.position.set(...van); C.lookAt(...naar); C.updateMatrixWorld(true);
      W.updateLOD(van[0], van[2]); g.scene.updateMatrixWorld(true); R.render(g.scene, C);
    }
    return R.info.programs.length;
  };
  kijk(13, false); kijk(1, false);
  uit.prog = [kijk(13, false), kijk(13, true), kijk(1, false), kijk(1, true)];
  for (const m of nieuwe) m.visible = true;
  return uit;
});

kop('1. de typen uit de generator');
ok(r.garages.length === 9 && r.garages.join() === ['2a', '2b', '2c', '2d', '2e', '2f', '2g', '2h', '2i'].map(n => 'Eekmolen ' + n).join(), 'negen garageboxen: Eekmolen 2a–2i', r.garages.join(', '));
const nPunt = Object.values(r.punt).reduce((a, b) => a + b, 0);
ok(nPunt >= 45, `${nPunt} woningen met een puntgeveltype`, JSON.stringify(r.punt));
ok(r.gemist.length === 0, 'geen woning van het plan met het oude type', r.gemist.join(', ') || 'geen');
ok(r.teVeel.length === 0, 'geen puntgeveltype buiten het plan', r.teVeel.join(', ') || 'geen');
ok(r.eekmolenRest > 0, `de rest van de Eekmolen houdt zijn type (${r.eekmolenRest} panden eekmolen)`);

kop('2. de doeken');
// (een ruit is al gauw 5 % van het doek; wat eronder blijft zijn losse vlekjes van het verweren op de blauwe deur)
ok(r.garageDoek.every(d => d.glas < 0.005), 'de garagebox heeft geen ruit (geen raam, geen deur met glas; < 0,5 % losse vlekjes)', r.garageDoek.map(d => (d.glas * 100).toFixed(2) + '%').join(' '));
const sleutelKleur = (k) => k.map(v => Math.round(v / 40)).join(',');
const deurKleuren = new Set(r.garageDoek.map(d => sleutelKleur(d.deur)));
ok(deurKleuren.size >= 3, `kanteldeuren in ${deurKleuren.size} kleuren over de zes varianten`, r.garageDoek.map(d => `rgb(${d.deur})`).join(' '));
ok(r.garageDoek.every(d => d.band.every(v => v > 200)), 'bovenaan de witte boeiboord', `rgb(${r.garageDoek[0].band})`);
for (const d of r.puntDoek) ok(d.onder > 0.01 && d.eerste > 0.002 && d.tweede > 0.002, `${d.type}: ramen op de begane grond, de eerste en de tweede verdieping`,
  `glas ${(d.onder * 100).toFixed(1)} / ${(d.eerste * 100).toFixed(1)} / ${(d.tweede * 100).toFixed(1)} %`);
ok(r.bergingDoek.flat().every(v => v < 0.03), 'de bergingen hebben hoogstens een smal raampje, geen woonkamerpui', `${JSON.stringify(r.bergingDoek)} (de oude eekmolen-gevel: ${r.oudeDoek})`);

kop('3. de garagerij in de wereld');
for (const b of r.garageRij) {
  const goed = b.deur && b.deur.bij && b.deur.sl.startsWith('gevel|garagebox|') && b.band && b.band.kleur && b.band.kleur.every(v => v > 190)
    && b.dak && b.dak.sl.startsWith('dak|plat') && Math.abs(b.dak.y - b.hoogte) < 0.25;
  ok(goed, `Eekmolen ${b.nr}: kanteldeur, boeiboord en plat dak`, `deur ${b.deur && b.deur.sl} rgb(${b.deur && b.deur.kleur}), band rgb(${b.band && b.band.kleur}), dak ${b.dak && b.dak.sl} op ${b.dak && b.dak.y.toFixed(2)} m (BAG ${b.hoogte})`);
}
const rijKleuren = new Set(r.garageRij.filter(b => b.deur && b.deur.kleur).map(b => sleutelKleur(b.deur.kleur)));
ok(rijKleuren.size >= 3, `in de rij ${rijKleuren.size} verschillende deurkleuren`);

kop('4. de puntgevels in de wereld');
let tot = { stralen: 0, raak: 0, wit: 0, kapel: 0, eigen: 0, berging: 0 };
for (const p of r.puntgevels) for (const k of Object.keys(tot)) tot[k] += p.tel[k];
console.log(`       ${r.puntgevels.length} woningen, ${tot.stralen} stralen, ${tot.raak} op de eigen voorkant: ${tot.eigen} gevel of steen van het eigen type, ${tot.berging} berging, ${tot.wit} wit hout, ${tot.kapel} kapel`);
const metWit = r.puntgevels.filter(p => p.tel.wit || p.tel.kapel);
ok(metWit.length === 0, 'geen witte houten topgevel, kapelwang of kapelkozijn op een voorkant', metWit.map(p => `${p.naam}: ${p.witte.join(' ')}`).join('; ') || 'geen');
const zonderRaak = r.puntgevels.filter(p => p.tel.raak < 3);
ok(zonderRaak.length === 0, 'elke voorkant is door minstens drie stralen geraakt', zonderRaak.map(p => p.naam).join(', ') || 'alle');
const puntFout = r.puntgevels.filter(p => !p.punt || !(p.punt.sl === `gevel|${p.type}` || p.punt.sl === `steen|${p.type}`) || p.punt.alle.some(sl => /^(planken|dakkapel)/.test(sl)));
ok(puntFout.length === 0, 'het hoogste voorvlak vanaf de grond (de punt), 1 tot 2 m onder zijn top: steen of gevel van het eigen type, nergens wit hout of een kapel', puntFout.map(p => `${p.naam}: ${p.punt ? p.punt.alle.join('/') : 'niet geraakt'}`).join('; ') || 'alle');
const naarTop = r.puntgevels.filter(p => p.puntTot > -1.3).length;
console.log(`       de voorgevel loopt bij ${naarTop} van de ${r.puntgevels.length} tot op 1,3 m van de nok (de puntgevel uit het 3D BAG-model)`);
ok(naarTop >= r.puntgevels.length * 0.6, 'bij de meeste woningen loopt de voorgevel als punt tot onder de nok');
const lageMuren = r.puntgevels.flatMap(p => p.bergingen.map(b => ({ naam: p.naam, b })));
const geenBerging = lageMuren.filter(x => x.b.startsWith('gevel|') && !x.b.includes('_berging'));
ok(geenBerging.length === 0, `de ${lageMuren.length} lage muren vooraan zijn berging of steen, nooit de woonkamerpui van het huis`, geenBerging.map(x => `${x.naam}: ${x.b}`).join('; ') || `${lageMuren.filter(x => x.b.includes('_berging')).length} bergingsgevels`);
const daken = r.puntgevels.flatMap(p => p.bergDak);
ok(daken.length > 0 && daken.filter(d => d.startsWith('dak|')).every(d => ['#5a2f26', '#4a4440'].some(k => d.includes(k))), `de schuine dakjes van de bergingen hebben eigen pannen (${daken.length} vlakken)`, [...new Set(daken)].join(', '));

kop('5. de nok uit het 3D BAG-model');
const perType = {};
for (const p of r.puntgevels) { const t = perType[p.type] || (perType[p.type] = { n: 0, haaks: 0 }); t.n++; if (p.nokHaaks >= 0.5) t.haaks++; }
for (const [t, v] of Object.entries(perType)) console.log(`       ${t}: bij ${v.haaks} van de ${v.n} kijkt het meeste schuine dak opzij (nok haaks op de straat)`);
const haaks = r.puntgevels.filter(p => p.nokHaaks >= 0.5).length;
ok(haaks >= r.puntgevels.length / 2, `bij ${haaks} van de ${r.puntgevels.length} woningen staat de nok volgens het model haaks op de straat`);

kop('6. botsdozen');
ok(r.bots.length === 0, 'alle garageboxen en woningen houden hun botsdoos (≥ 75 % van de punten binnen het grondvlak; de dozen zijn rechthoeken om het grondvlak)', r.bots.join(', ') || 'alle dicht');

kop('7. shaders');
ok(r.nieuweMeshes > 0, `${r.nieuweMeshes} meshes met de nieuwe gevels`);
ok(r.prog[0] === r.prog[1] && r.prog[2] === r.prog[3], 'geen nieuw shaderprogramma als de nieuwe gevels in beeld komen (dag, nacht)', `programma's ${r.prog.join(' / ')}`);

await browser.close();
console.log(fout ? `\n${fout} fout(en)` : '\nalles goed');
process.exit(fout ? 1 : 0);
