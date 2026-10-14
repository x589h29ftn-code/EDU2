/*
 Stap 166: de kubistische woningen aan de Vuurvlinder in Duinterpen (npm run vuurvlindertest).
 Gevraagd: "Ook locatie: 906.5, 324.5 die huizen", met de Street View van Vuurvlinder 3.

   1. de acht panden van de oneven rij 1–15 hebben hun eigen type (vuurvlinder, en vuurvlinder_grijs voor het hoekpand 1),
      en geen ander pand in de kaart;
   2. de straatgevel gemeten met stralen: per pand een rooster van stralen vanaf de stoep op de voorgevel, en op elk
      raakpunt de kleur van het doek — overwegend antraciet, niets warms (geel, beige, rood), geen witte gevel;
   3. ramen met lichte kaders op de straatgevel: crèmewit in het rooster, en glas;
   4. de blinde zijgevels zijn ook antraciet;
   5. de daken: een straal recht naar beneden op elk dakvlak van het 3D BAG-model raakt het op de hoogte van de BAG; de
      platte vlakken zijn plat dak, het schuine vlak is donkere plaat en geen pannen; geen witte kapelwangen boven de achterbouw;
   6. de botsdozen van de panden blijven;
   7. geen nieuw shaderprogramma als de rij in beeld komt (dag en nacht).

 Gebruik: npm run server &  node tools/vuurvlindertest.mjs [poort]
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
  const g = window.__game, W = await import('./js/world.js');
  const T = await import('./js/textures.js');
  const { KAART } = await import('./js/kaart.js');
  document.getElementById('overlay').style.display = 'none';
  g.player.active = false; window.__autoplay = false;
  await g.voorbereidSpel();
  g.reliëfAf();
  const RIJ = { '0091100000002678': 'vuurvlinder_grijs', '0091100000002968': 'vuurvlinder', '0091100000004743': 'vuurvlinder', '0091100000002387': 'vuurvlinder',
    '0091100000002385': 'vuurvlinder', '0091100000003700': 'vuurvlinder', '0091100000002659': 'vuurvlinder', '0091100000019011': 'vuurvlinder' };
  const uit = {};
  // ---- 1. de types
  uit.types = Object.keys(RIJ).map(id => { const p = KAART.panden.find(q => q.id === id); return { id, nr: p && p.nr.join(','), type: p && p.type, goed: !!p && p.type === RIJ[id] }; });
  uit.anderen = KAART.panden.filter(p => /^vuurvlinder/.test(p.type || '') && !RIJ[p.id]).map(p => p.id);
  uit.stijl = ['vuurvlinder', 'vuurvlinder_grijs'].map(t => !!T.HOUSE_STYLES[t]);

  W.updateLOD(925, 340); g.scene.updateMatrixWorld(true);
  const lijst = [];
  g.scene.traverse(o => { if (o.isMesh && o.visible && !o.isInstancedMesh && o.geometry && o.geometry.attributes.uv && o.userData.klasse) lijst.push(o); });
  // de kleur van het doek op een raakpunt (de canvassen zijn na reliëfAf echt), plus de kleur van het materiaal
  const texel = (h) => {
    const m = h.object.material, kleur = m.color ? m.color : new THREE.Color(1, 1, 1);
    let c = [255, 255, 255];
    const img = m.map && m.map.image;
    if (img && img.getContext && h.uv) {
      const fu = h.uv.x - Math.floor(h.uv.x), fv = h.uv.y - Math.floor(h.uv.y);
      const x = Math.min(img.width - 1, Math.floor(fu * img.width)), y = Math.min(img.height - 1, Math.floor((m.map.flipY ? 1 - fv : fv) * img.height));
      const d = img.getContext('2d').getImageData(x, y, 1, 1).data; c = [d[0], d[1], d[2]];
    }
    // de kleur van het materiaal is lineair, het doek sRGB: het materiaal terug naar sRGB voor de vermenigvuldiging
    const k = kleur.clone().convertLinearToSRGB();
    return [c[0] * k.r, c[1] * k.g, c[2] * k.b].map(Math.round);
  };
  const soort = (c) => {
    const [R, G, B] = c, l = (R + G + B) / 3, sat = Math.max(R, G, B) - Math.min(R, G, B);
    if (R - B > 35 && l > 60) return 'warm';
    if (l < 95 && sat < 30) return 'antraciet';
    if (l < 150 && sat < 30) return 'grijs';
    if (l > 185 && R >= B - 5 && R - B <= 35) return 'creme';
    if (B > R + 8) return 'glas';
    return 'anders';
  };
  const straal = (o, d, max = 30) => new THREE.Raycaster(o, d, 0, max).intersectObjects(lijst, false)[0] || null;
  const newell = (pts) => { let nx = 0, ny = 0, nz = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]); } const l = Math.hypot(nx, ny, nz) || 1; return [nx / l, ny / l, nz / l]; };
  const binnen = (x, z, v) => { let c = false; for (let i = 0, j = v.length - 1; i < v.length; j = i++) { const a = v[i], b = v[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };

  uit.panden = Object.keys(RIJ).map(id => {
    const p = KAART.panden.find(q => q.id === id);
    const F = p.front, pt = (i) => [p.v[3 * i], p.v[3 * i + 1], p.v[3 * i + 2]];
    const vlakken = p.f.map((f, k) => ({ k, s: p.s[k], pts: f[0].map(pt) }));
    const muren = vlakken.filter(v => v.pts.some(q => q[1] < 0.1) && Math.abs(newell(v.pts)[1]) < 0.3).map(v => {
      const n = newell(v.pts), xs = v.pts.map(q => q[0]), zs = v.pts.map(q => q[2]), ys = v.pts.map(q => q[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
      const breed = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
      return { ...v, n, cx, cz, breed, top: Math.max(...ys), kant: Math.abs(n[0] * F[0] + n[2] * F[1]), voor: cx * F[0] + cz * F[1] };
    });
    // ---- 2/3. de straatgevel: het muurvlak dat het verst naar de straat ligt
    const voorkant = muren.filter(m => m.kant > 0.6 && m.breed > 2.4).sort((a, b) => b.voor - a.voor)[0];
    const telling = { antraciet: 0, grijs: 0, creme: 0, glas: 0, warm: 0, anders: 0, mis: 0 };
    const naarBinnen = new THREE.Vector3(-F[0], 0, -F[1]);
    if (voorkant) {
      const rx = -F[1], rz = F[0];
      for (let u = -0.4; u <= 0.4001; u += 0.08) for (let y = 0.45; y < voorkant.top - 0.3; y += 0.3) {
        const o = new THREE.Vector3(voorkant.cx + rx * u * voorkant.breed + F[0] * 6, y, voorkant.cz + rz * u * voorkant.breed + F[1] * 6);
        const h = straal(o, naarBinnen, 9);
        if (!h || Math.abs(h.distance - 6) > 0.5) { telling.mis++; continue; }
        telling[soort(texel(h))]++;
      }
    }
    // ---- 4. een blinde zijgevel: het muurvlak haaks op de straat, van buiten aangestraald
    const zij = muren.filter(m => m.kant < 0.3 && m.breed > 2.4).sort((a, b) => b.breed - a.breed);
    const zijT = { antraciet: 0, grijs: 0, creme: 0, glas: 0, warm: 0, anders: 0, mis: 0 };
    for (const m of zij.slice(0, 2)) {
      // naar buiten: de kant waar het grondvlak niet is
      let nx = m.n[0], nz = m.n[2];
      if (binnen(m.cx + nx * 0.5, m.cz + nz * 0.5, p.voet)) { nx = -nx; nz = -nz; }
      for (let y = 0.6; y < Math.min(m.top, 6) - 0.2; y += 0.5) {
        const o = new THREE.Vector3(m.cx + nx * 1.2, y, m.cz + nz * 1.2);
        const h = straal(o, new THREE.Vector3(-nx, 0, -nz), 2.5);
        if (!h || Math.abs(h.distance - 1.2) > 0.4) { zijT.mis++; continue; }
        zijT[soort(texel(h))]++;
      }
    }
    // ---- 5. de daken uit het 3D BAG-model
    const daken = vlakken.filter(v => v.pts.every(q => q[1] > 0.5) && Math.abs(newell(v.pts)[1]) > 0.3).map(v => {
      const ys = v.pts.map(q => q[1]);
      // plat zoals js/kaartwereld.js het ziet: een bijna horizontaal vlak (de BAG geeft een plat dak soms een paar cm scheef)
      const plat = Math.abs(newell(v.pts)[1]) > 0.97;
      const laag = Math.min(...ys), hoogst = Math.max(...ys);
      // een punt in het vlak: het gemiddelde van de hoekpunten, of anders een stukje van een hoek naar binnen
      const n = v.pts.length; let m = v.pts.reduce((s, q) => [s[0] + q[0] / n, s[1] + q[1] / n, s[2] + q[2] / n], [0, 0, 0]);
      const ring = v.pts.map(q => [q[0], q[2]]);
      if (!binnen(m[0], m[2], ring)) {
        let gevonden = null;
        for (let i = 0; i < n && !gevonden; i++) for (const t of [0.15, 0.3, 0.5]) { const q = v.pts[i]; const c = [q[0] + (m[0] - q[0]) * t, 0, q[2] + (m[2] - q[2]) * t]; if (binnen(c[0], c[2], ring)) { gevonden = c; break; } }
        if (!gevonden) return null;
        // de hoogte van het vlak op dat punt: een vlak door drie hoekpunten
        const [a, b, c] = v.pts, ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const nn = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
        gevonden[1] = a[1] - (nn[0] * (gevonden[0] - a[0]) + nn[2] * (gevonden[2] - a[2])) / nn[1];
        m = gevonden;
      }
      const h = straal(new THREE.Vector3(m[0], 40, m[2]), new THREE.Vector3(0, -1, 0), 60);
      const mat = h && h.object.material;
      return { plat, bag: +m[1].toFixed(2), laag: +laag.toFixed(2), hoogst: +hoogst.toFixed(2), y: h ? +h.point.y.toFixed(2) : null, klasse: h ? h.object.userData.klasse : null,
        pannen: !!(mat && mat.map), donker: mat && mat.color ? +mat.color.getHSL({}).l.toFixed(2) : null };
    }).filter(Boolean);
    // geen witte wangen: de muurvlakken die boven de lage achterbouw beginnen
    const hoog = vlakken.filter(v => v.pts.every(q => q[1] > 2.4) && Math.abs(newell(v.pts)[1]) < 0.3);
    const wangen = [];
    for (const v of hoog) {
      const n = newell(v.pts), xs = v.pts.map(q => q[0]), zs = v.pts.map(q => q[2]), ys = v.pts.map(q => q[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      for (const s of [1, -1]) {
        const h = straal(new THREE.Vector3(cx + n[0] * s * 1.0, cy, cz + n[2] * s * 1.0), new THREE.Vector3(-n[0] * s, 0, -n[2] * s), 2);
        if (h && Math.abs(h.distance - 1) < 0.3) { wangen.push(h.object.userData.klasse); break; }
      }
    }
    // ---- 6. de botsdoos: een rooster van punten binnen het grondvlak, elk hoort naar buiten geduwd te worden
    const xs6 = p.voet.map(q => q[0]), zs6 = p.voet.map(q => q[1]);
    let binnenPt = 0, dicht = 0;
    for (let x = Math.min(...xs6) + 0.5; x < Math.max(...xs6); x += 1) for (let z = Math.min(...zs6) + 0.5; z < Math.max(...zs6); z += 1) {
      if (!binnen(x, z, p.voet)) continue;
      binnenPt++; const [cx2, cz2] = W.resolveCollisions(x, z, 0.4); if (Math.hypot(cx2 - x, cz2 - z) > 0.3) dicht++;
    }
    return { id, nr: p.nr.join(','), voorkant: voorkant ? { breed: +voorkant.breed.toFixed(1), top: +voorkant.top.toFixed(1) } : null, telling, zijT, daken, wangen,
      bots: +(dicht / Math.max(1, binnenPt)).toFixed(2) };
  });

  // ---- 7. shaders: van de rij af en naar de rij toe, dag en nacht
  const C = g.camera, R = g.renderer;
  const kijk = (uur, zien) => {
    g.sfeer.uur = uur; for (let i = 0; i < (uur < 6 ? 30 : 3); i++) g.sfeer.update(0.1, 906.5, 324.5);
    C.position.set(906.5, 1.7, 324.5); C.lookAt(zien ? 931 : 880, zien ? 5.5 : 1.7, zien ? 326 : 324.5); C.updateMatrixWorld(true);
    W.updateLOD(906.5, 324.5); g.scene.updateMatrixWorld(true); R.render(g.scene, C);
    return R.info.programs.length;
  };
  /*
   Het kantoor aan het water (js/aaff.js) ligt 650 m verder in dezelfde kijkrichting, en zijn logo's krijgen de eerste
   nacht een eigen programma (open punt 30, stap 159). Dat is niet van deze rij: voor de meting even uit beeld.
  */
  const aaff = g.scene.getObjectByName('aaff'); if (aaff) aaff.visible = false;
  kijk(13, false); kijk(1, false);
  uit.prog = [kijk(13, false), kijk(13, true), kijk(1, false)];
  const voor = new Set(R.info.programs);
  uit.prog.push(kijk(1, true));
  // welk materiaal draagt een programma dat er net bij kwam? (om te zien of het van deze panden is)
  const nieuw = new Set(R.info.programs.filter(q => !voor.has(q)));
  uit.nieuw = [];
  g.scene.traverse(o => { if (!o.isMesh || !o.visible) return; for (const m of [].concat(o.material)) { const pr = R.properties.get(m).currentProgram; if (pr && nieuw.has(pr)) uit.nieuw.push(`${o.userData.klasse || o.name || o.type} ${m.type} kaart:${!!m.map} kleur:${m.color ? m.color.getHexString() : '-'}`); } });
  uit.nieuw = [...new Set(uit.nieuw)].slice(0, 12);
  if (aaff) aaff.visible = true;
  return uit;
});

kop('1. de types');
ok(r.stijl.every(Boolean), 'vuurvlinder en vuurvlinder_grijs staan in HOUSE_STYLES');
ok(r.types.every(t => t.goed), 'de oneven rij 1–15 heeft het eigen type (uit data/stijl/straten.json, via geo:genereer)', r.types.map(t => `${t.nr}:${t.type}`).join(' '));
ok(r.anderen.length === 0, 'geen ander pand heeft dat type', JSON.stringify(r.anderen));
kop('2. de straatgevel: antraciete baksteen');
for (const p of r.panden) {
  const t = p.telling, n = t.antraciet + t.grijs + t.creme + t.glas + t.warm + t.anders;
  const grijs = p.nr.startsWith('1-'), donker = grijs ? t.antraciet + t.grijs : t.antraciet;
  ok(p.voorkant && n > 30 && t.mis < n * 0.15, `${p.nr}: de voorgevel geraakt vanaf de stoep`, `${JSON.stringify(p.voorkant)}, ${n} raak, ${t.mis} mis`);
  ok(donker / n > 0.45 && t.warm === 0, `${p.nr}: overwegend ${grijs ? 'grijs' : 'antraciet'}, niets geel, beige of rood`, JSON.stringify(t));
  ok(t.creme / n > 0.04 && t.creme / n < 0.35 && t.glas > 0, `${p.nr}: ramen in lichte kaders op de straatgevel, geen witte gevel`, `creme ${(t.creme / n).toFixed(2)}, glas ${t.glas}`);
}
kop('4. de zijgevels');
for (const p of r.panden) {
  const t = p.zijT, n = t.antraciet + t.grijs + t.creme + t.glas + t.warm + t.anders;
  const grijs = p.nr.startsWith('1-'), donker = grijs ? t.antraciet + t.grijs : t.antraciet;
  ok(n >= 4 && donker / n > 0.8 && t.warm === 0, `${p.nr}: de blinde zijgevel is ${grijs ? 'grijs' : 'antraciet'}`, JSON.stringify(t));
}
kop('5. de daken uit het 3D BAG-model');
for (const p of r.panden) {
  const plat = p.daken.filter(d => d.plat), schuin = p.daken.filter(d => !d.plat);
  ok(p.daken.length >= 2 && p.daken.every(d => d.y !== null && (Math.abs(d.y - d.bag) < 0.2 || (d.plat && d.y > d.laag - 0.1 && d.y < d.hoogst + 0.1))), `${p.nr}: elk dakvlak op de hoogte van de BAG`, JSON.stringify(p.daken.map(d => [d.bag, d.y])));
  ok(plat.length >= 1 && plat.every(d => d.klasse === 'platdak'), `${p.nr}: de platte vlakken (achterbouw) zijn plat dak`, JSON.stringify(plat.map(d => [d.bag, d.klasse])));
  ok(schuin.every(d => d.klasse === 'dak' && !d.pannen && d.donker < 0.3), `${p.nr}: het schuine vlak is donkere plaat, geen pannen`, JSON.stringify(schuin.map(d => [d.klasse, d.pannen, d.donker])));
  ok(p.wangen.length > 0 && !p.wangen.includes('dakkapel'), `${p.nr}: boven de achterbouw muur, geen witte kapelwangen`, JSON.stringify(p.wangen));
}
kop('6. botsdozen');
ok(r.panden.every(p => p.bots > 0.8), 'alle acht panden zijn dicht (het deel van de punten binnen het grondvlak dat naar buiten geduwd wordt)', r.panden.map(p => `${p.nr}:${p.bots}`).join(' '));
kop('7. shaders');
ok(r.prog[1] === r.prog[0] && r.prog[3] === r.prog[2], 'de rij in beeld: geen nieuw programma, overdag en \'s nachts', `dag ${r.prog[0]} → ${r.prog[1]}, nacht ${r.prog[2]} → ${r.prog[3]}`);
if (r.nieuw.length) console.log('       nieuw:', r.nieuw.join(' | '));

await browser.close();
console.log(fout ? `\n${fout} fout(en)` : '\nalles goed');
process.exit(fout ? 1 : 0);
