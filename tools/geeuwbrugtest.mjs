/*
 Stap 161: de oude Geeuwbrug, het betonnen landhoofd met het brugwachtershuisje aan de Geeuw (npm run geeuwbrugtest).
 Gevraagd: "herbouw ook locatie -77.4, -459.8 zie foto ingame. dit is een deel van de oude geeuw brug. Zie torentje met
 tekst geeuwbrug."

   1. op de voetafdruk: het landhoofd ligt op het BGT-bouwwerk binnen BAG 0091100000016709, en het oude geschatte blok
      is weg (een straal van boven op het landhoofd raakt het nieuwe bouwsel, op het deel van de BAG-voetafdruk ernaast
      niets meer);
   2. de maten: het basement 2–3 m hoog, lang en smal; de cabine op de voet bovenop het eind aan het water (gemeten aan de
      waterpolygonen van de kaart);
   3. het bordje "Geeuwbrug": donkere letters op een licht vlak, op de cabine onder de ramen;
   4. de cabine: blauwe kozijnen, ramen rondom, een paar kapot;
   5. graffiti op de wanden: veel verschillende, verzadigde tinten op het wanddoek;
   6. de botsdozen: dicht langs beide assen, de toren ook, en geen onzichtbare muur meer op het gras van de oude doos;
   7. geen gras, struik of boom binnen het basement (js/bouwvlak.js `GEEUWBRUG` klopt met het bouwsel);
   8. geen nieuw shaderprogramma als het in beeld komt overdag; 's nachts hoogstens zijn ene eigen (zie onderaan).

 Gebruik: node tools/server.mjs 8125 &  node tools/geeuwbrugtest.mjs [poort]
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
page.setDefaultTimeout(900000);
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

const r = await page.evaluate(async () => {
  const THREE = await import('three');
  const g = window.__game, W = await import('./js/world.js');
  const { KAART } = await import('./js/kaart.js');
  const { GEEUW } = await import('./js/geeuwbrug.js');
  const { GEEUWBRUG, inBouwvlak } = await import('./js/bouwvlak.js');
  const { geenGroen } = await import('./js/kaartwereld.js');
  document.getElementById('overlay').style.display = 'none';
  g.player.active = false; window.__autoplay = false;
  await g.voorbereidSpel();
  const A = g.geeuwbrug, uit = { er: !!A };
  if (!A) return uit;
  const M = A.maten, MAT = A.materialen;
  const p = KAART.panden.find(q => q.id === GEEUW.pand);
  const binnen = (x, z, v) => { let c = false; for (let i = 0, j = v.length - 1; i < v.length; j = i++) { const a = v[i], b = v[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  const randAfst = (x, z, v) => { let best = Infinity; for (let i = 0, j = v.length - 1; i < v.length; j = i++) { const a = v[j], b = v[i], dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l)); best = Math.min(best, Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z)); } return best; };
  const mid = A.wereld(M.L / 2, 0, M.B / 2);
  W.updateLOD(mid.x, mid.z); g.scene.updateMatrixWorld(true);

  // ---- 1. op de voetafdruk
  const ring = A.assen.bouwwerk.r[0];
  uit.hoeken = [[0.05, 0.05], [M.L - 0.05, 0.05], [M.L - 0.05, M.B - 0.05], [0.05, M.B - 0.05]].map(([u, v]) => {
    const w = A.wereld(u, 0, v); return binnen(w.x, w.z, ring) || randAfst(w.x, w.z, ring) < 0.3;
  });
  uit.inBag = binnen(mid.x, mid.z, p.voet);
  const vanBoven = (w) => {
    const rc = new THREE.Raycaster(new THREE.Vector3(w.x, 40, w.z), new THREE.Vector3(0, -1, 0), 0, 60);
    return rc.intersectObjects(g.scene.children, true).filter(h => h.object.visible && h.object.isMesh && !h.object.isInstancedMesh)
      .slice(0, 3).map(h => ({ klasse: h.object.userData.klasse || h.object.name || '?', y: +h.point.y.toFixed(2) }));
  };
  uit.boven = vanBoven(A.wereld(M.L * 0.4, 0, M.B / 2));
  // het deel van de BAG-voetafdruk naast het landhoofd (daar stond het oude blok van 3,4 m)
  let naast = null;
  for (const v of [-4, -6, -8, -10]) for (const u of [6, 10, 14, 18]) { const w = A.wereld(u, 0, v); if (!naast && binnen(w.x, w.z, p.voet) && randAfst(w.x, w.z, p.voet) > 1.5) naast = w; }
  uit.naast = naast ? { boven: vanBoven(naast), p: [+naast.x.toFixed(1), +naast.z.toFixed(1)] } : null;

  // ---- 2. maten en de cabine aan het water
  uit.maten = { L: +M.L.toFixed(2), B: +M.B.toFixed(2), top: +M.top.toFixed(2), Y0: M.Y0, cab: M.cabine, voet: M.voet };
  uit.dakY = uit.boven.length ? uit.boven[0].y : null;
  // van opzij op 1,2 m: de wand (of een dichtgemetselde opening, het deurtje)
  const n = A.assen.n, e = A.assen.e;
  const zij = (u, y) => {
    const w = A.wereld(u, y, M.B + 10), d = new THREE.Vector3(-n[0], 0, -n[1]);
    const h = new THREE.Raycaster(w, d, 0, 30).intersectObjects(A.groep.children, false)[0];
    return h ? { mat: h.object.name, afst: +h.distance.toFixed(2) } : null;
  };
  uit.zij = [zij(3, 1.2), zij(M.L / 2, 1.2), zij(M.L / 2, 3.2)];
  const water = KAART.vlakken.filter(v => v.k === 'water');
  const totWater = (w) => { let b = Infinity; for (const v of water) { const r0 = v.r[0]; if (binnen(w.x, w.z, r0)) return 0; b = Math.min(b, randAfst(w.x, w.z, r0)); } return b; };
  const cabMid = A.wereld(M.cabine.u, 0, M.cabine.v), land = A.wereld(0, 0, M.B / 2), eind = A.wereld(M.L, 0, M.B / 2);
  uit.water = { cabine: +totWater(cabMid).toFixed(1), land: +totWater(land).toFixed(1), eind: +totWater(eind).toFixed(1) };

  // ---- 3. het bordje
  const img = MAT.bord.map.image, px = img.getContext('2d').getImageData(0, 0, img.width, img.height).data;
  let donker = 0, licht = 0, tot = px.length / 4;
  for (let i = 0; i < px.length; i += 4) { const l = 0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]; if (l < 70) donker++; else if (l > 200) licht++; }
  // de letters zelf: het middenstuk van het bord (zonder het randje)
  let dMid = 0, nMid = 0;
  for (let y = Math.round(img.height * 0.25); y < img.height * 0.8; y++) for (let x = Math.round(img.width * 0.12); x < img.width * 0.88; x++) { const i = (y * img.width + x) * 4; nMid++; if (0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2] < 70) dMid++; }
  uit.bord = { donker: +(donker / tot).toFixed(3), licht: +(licht / tot).toFixed(3), letters: +(dMid / nMid).toFixed(3) };
  const C = M.cabine;
  uit.borden = A.borden.map(b => {
    const du = (b.midden.x - cabMid.x) * e[0] + (b.midden.z - cabMid.z) * e[1], dv = (b.midden.x - cabMid.x) * n[0] + (b.midden.z - cabMid.z) * n[1];
    const y = b.midden.y - M.Y0;
    // de onderkant van het raam: de onderdorpel
    return { kant: b.kant, du: +du.toFixed(2), dv: +dv.toFixed(2), y: +y.toFixed(2),
      opCabine: Math.abs(du) <= C.b / 2 + 0.1 && Math.abs(dv) <= C.d / 2 + 0.1 && (Math.abs(Math.abs(du) - C.b / 2) < 0.1 || Math.abs(Math.abs(dv) - C.d / 2) < 0.1),
      onderRaam: y > C.y1 && y < C.y1 + GEEUW.raam.y0 - 0.08 };
  });
  const bordMesh = A.groep.children.find(m => m.material === MAT.bord);
  uit.bordMesh = !!bordMesh && bordMesh.visible;

  // ---- 4. de cabine
  const kc = MAT.kozijn.color;
  const kozMesh = A.groep.children.find(m => m.material === MAT.kozijn);
  let kozBinnen = true;
  if (kozMesh) { const pa = kozMesh.geometry.attributes.position; for (let i = 0; i < pa.count; i++) { const y = pa.getY(i) - M.Y0; if (y < C.y1 - 0.01 || y > C.y2 + 0.01) kozBinnen = false; } }
  uit.kozijn = { rgb: [kc.r, kc.g, kc.b].map(v => +v.toFixed(2)), mesh: !!kozMesh, binnen: kozBinnen, ramen: A.ramen.length, kapot: A.ramen.filter(q => q.kapot).length, kanten: [...new Set(A.ramen.map(q => q.kant))].length };

  // ---- 5. graffiti
  const wi = MAT.wand.map.image, wp = wi.getContext('2d').getImageData(0, 0, wi.width, wi.height).data;
  const emmers = new Map(); let verzadigd = 0;
  for (let i = 0; i < wp.length; i += 4) {
    const k = (wp[i] >> 4) << 8 | (wp[i + 1] >> 4) << 4 | (wp[i + 2] >> 4);
    emmers.set(k, (emmers.get(k) || 0) + 1);
    if (Math.max(wp[i], wp[i + 1], wp[i + 2]) - Math.min(wp[i], wp[i + 1], wp[i + 2]) > 80) verzadigd++;
  }
  // tinten: de verzadigde beeldpunten per kleurtoon in twaalf vakken
  const tonen = new Array(12).fill(0);
  for (let i = 0; i < wp.length; i += 4) {
    const rr = wp[i] / 255, gg = wp[i + 1] / 255, bb = wp[i + 2] / 255, mx = Math.max(rr, gg, bb), mn = Math.min(rr, gg, bb);
    if (mx - mn < 0.3) continue;
    let h = mx === rr ? (gg - bb) / (mx - mn) : mx === gg ? 2 + (bb - rr) / (mx - mn) : 4 + (rr - gg) / (mx - mn);
    h = ((h * 60) + 360) % 360; tonen[Math.floor(h / 30)]++;
  }
  uit.graffiti = { emmers: [...emmers.values()].filter(c => c >= 50).length, verzadigd: +(verzadigd / (wp.length / 4)).toFixed(3), tonen: tonen.filter(c => c > 200).length,
    opWand: A.groep.children.some(m => m.material === MAT.wand), kop: A.groep.children.some(m => m.material === MAT.kop) };

  // ---- 6. botsdozen, langs beide assen
  const rad = 0.4;
  const duw = (u, v) => { const w = A.wereld(u, 0, v); const [x2, z2] = W.resolveCollisions(w.x, w.z, rad); const du = (x2 - w.x) * e[0] + (z2 - w.z) * e[1], dv = (x2 - w.x) * n[0] + (z2 - w.z) * n[1]; return { u: u + du, v: v + dv }; };
  const d1 = duw(M.L * 0.45, M.B - 0.2), d2 = duw(M.L * 0.45, 0.2), d3 = duw(0.2, M.B / 2), d4 = duw(M.L / 2, M.B / 2);
  uit.bots = {
    noord: +d1.v.toFixed(2), zuid: +d2.v.toFixed(2), land: +d3.u.toFixed(2),
    midden: d4.u < -0.3 || d4.u > M.L + 0.3 || d4.v < -0.3 || d4.v > M.B + 0.3,
  };
  // de toren: een punt onder de cabine die over het water steekt
  const tw = A.wereld(C.u + C.b / 2 - 0.3, 0, C.v), [tx, tz] = W.resolveCollisions(tw.x, tw.z, rad);
  uit.bots.toren = Math.hypot(tx - tw.x, tz - tw.z) > 0.2;
  if (naast) { const [x2, z2] = W.resolveCollisions(naast.x, naast.z, rad); uit.bots.naast = +Math.hypot(x2 - naast.x, z2 - naast.z).toFixed(2); }

  // ---- 7. geen groen
  let rooster = 0, vrij = 0, bv = 0;
  for (let u = 0; u <= M.L; u += 1) for (let v = 0; v <= M.B; v += 1) { const w = A.wereld(u, 0, v); rooster++; if (geenGroen(w.x, w.z)) vrij++; if (inBouwvlak(w.x, w.z)) bv++; }
  for (const [u, v] of [[C.u + C.b / 2, C.v], [C.u, C.v + C.d / 2]]) { const w = A.wereld(u, 0, v); rooster++; if (geenGroen(w.x, w.z)) vrij++; if (inBouwvlak(w.x, w.z)) bv++; }
  const inRect = (x, z) => { const du = (x - A.assen.O[0]) * e[0] + (z - A.assen.O[1]) * e[1], dv = (x - A.assen.O[0]) * n[0] + (z - A.assen.O[1]) * n[1]; return du > -0.5 && du < M.L + 0.5 && dv > -0.5 && dv < M.B + 0.5; };
  const bomen = (KAART.bomen || []).filter(b => inRect(b.x, b.z)).length + (KAART.struiken || []).filter(b => inRect(b.x ?? b[0], b.z ?? b[1])).length;
  // en de instanties van bomen en gras in de scène
  let inst = 0;
  const m4 = new THREE.Matrix4(), pp = new THREE.Vector3();
  g.scene.traverse(o => {
    if (!o.isInstancedMesh || !o.visible) return;
    const naam = `${o.name} ${o.userData.klasse || ''}`.toLowerCase();
    if (!/gras|boom|bomen|struik|kroon|stam|riet|blad|pol/.test(naam)) return;
    for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); pp.setFromMatrixPosition(m4); if (pp.y > -50 && inRect(pp.x, pp.z)) inst++; }
  });
  uit.groen = { rooster, vrij, bv, bomen, inst, constante: { dx: +(GEEUWBRUG.cx - mid.x).toFixed(2), dz: +(GEEUWBRUG.cz - mid.z).toFixed(2), dh: +(GEEUWBRUG.hoek - Math.atan2(e[1], e[0])).toFixed(3) } };

  // ---- 8. shaders
  const Cam = g.camera, R = g.renderer;
  const kijk = (uur, zien) => {
    // (dertig keer bijwerken: met drie stappen was de nachtstand soms nog niet helemaal door, en sloeg de omgeving pas om
    // bij de meting mét het landhoofd: 207 → 237)
    g.sfeer.uur = uur; for (let i = 0; i < 30; i++) g.sfeer.update(0.1, -77.4, -459.8);
    A.groep.visible = zien;
    Cam.position.set(-77.4, 1.7, -459.8); Cam.lookAt(mid.x, 3, mid.z); Cam.updateMatrixWorld(true);
    W.updateLOD(-77.4, -459.8); g.scene.updateMatrixWorld(true); R.render(g.scene, Cam);
    return R.info.programs.length;
  };
  kijk(13, false); kijk(1, false);
  uit.prog = [kijk(13, false), kijk(13, true), kijk(1, false), kijk(1, true)];
  A.groep.visible = true;
  return uit;
});

kop('1. op de voetafdruk');
ok(r.er, 'het landhoofd is gebouwd');
if (!r.er) { await browser.close(); console.log(`\n${fout + 1} fout(en)`); process.exit(1); }
ok(r.hoeken.every(Boolean) && r.inBag, 'de hoeken op het BGT-bouwwerk, het midden binnen de BAG-voetafdruk', JSON.stringify(r.hoeken));
ok(r.boven.length && r.boven[0].klasse === 'geeuwbrug' && r.boven.every(h => h.klasse === 'geeuwbrug' || h.y < 0.6),
  'van boven: het nieuwe landhoofd, geen oud blok eronder', JSON.stringify(r.boven));
ok(r.naast && r.naast.boven.every(h => h.y < 0.6), 'op de BAG-voetafdruk naast het landhoofd staat niets meer', r.naast && JSON.stringify(r.naast));
kop('2. de maten');
const m = r.maten;
ok(m.top >= 2 && m.top <= 3 && r.dakY - m.Y0 >= 2 && r.dakY - m.Y0 <= 3, 'het basement 2–3 m hoog', `${m.top} m (dak gemeten op ${r.dakY} m)`);
ok(m.L > 25 && m.L < 34 && m.B > 6 && m.B < 10 && m.L > 3 * m.B, 'lang en smal', `${m.L} × ${m.B} m`);
ok(r.zij[0] && r.zij[1] && ['wand', 'blok', 'roest'].includes(r.zij[0].mat) && ['wand', 'blok', 'roest'].includes(r.zij[1].mat) && Math.abs(r.zij[1].afst - 10) < 0.2 && !r.zij[2],
  'van opzij op 1,2 m de wand, op 3,2 m (midden) eroverheen', JSON.stringify(r.zij));
ok(r.water.cabine < r.water.land && r.water.eind < r.water.land && r.water.eind < 3, 'de cabine op het eind aan het water', JSON.stringify(r.water));
ok(m.voet.y0 >= m.top - 0.05 && m.cab.y0 >= m.voet.y1 - 0.01 && m.voet.u1 > m.L - 1 && m.cab.u > m.L - 2.5, 'op de voet bovenop het basement', `voet ${m.voet.y0.toFixed(2)}–${m.voet.y1.toFixed(2)} m, cabine ${m.cab.y0.toFixed(2)}–${m.cab.top.toFixed(2)} m`);
kop('3. het bordje "Geeuwbrug"');
ok(r.bord.licht > 0.5 && r.bord.donker > 0.04 && r.bord.letters > 0.08, 'donkere letters op een licht vlak', JSON.stringify(r.bord));
ok(r.borden.length >= 1 && r.borden.every(b => b.opCabine && b.onderRaam) && r.bordMesh, 'op de cabine, onder de ramen', JSON.stringify(r.borden));
kop('4. de cabine');
const k = r.kozijn;
ok(k.mesh && k.rgb[2] > k.rgb[0] + 0.2 && k.rgb[2] > k.rgb[1] + 0.1, 'blauwe kozijnen', JSON.stringify(k.rgb));
ok(k.binnen && k.ramen >= 12 && k.kanten === 4 && k.kapot >= 1, 'ramen rondom in de cabine, een paar kapot', JSON.stringify(k));
kop('5. graffiti');
const gr = r.graffiti;
ok(gr.opWand && gr.kop && gr.emmers > 80 && gr.verzadigd > 0.07 && gr.tonen >= 6, 'veel verschillende tinten op het wanddoek', JSON.stringify(gr));
kop('6. botsdozen');
const b = r.bots;
ok(b.noord >= m.B + 0.04 + 0.39 && b.zuid <= -0.04 - 0.39 && b.land <= -0.04 - 0.39 && b.midden, 'dicht langs beide assen', JSON.stringify(b));
ok(b.toren, 'het torentje ook (waar het over het water steekt)');
ok(b.naast === 0, 'geen onzichtbare muur meer op het gras van de oude doos', `${b.naast} m`);
kop('7. geen groen');
const gn = r.groen;
ok(gn.vrij === gn.rooster && gn.bv === gn.rooster, 'geen gras of boom binnen het basement (geenGroen en inBouwvlak)', `${gn.vrij}/${gn.rooster}, ${gn.bv}/${gn.rooster}`);
ok(gn.bomen === 0 && gn.inst === 0, 'geen boom, struik of pol gras in de scène binnen het basement', `${gn.bomen} uit de kaart, ${gn.inst} instanties`);
ok(Math.abs(gn.constante.dx) < 0.1 && Math.abs(gn.constante.dz) < 0.1 && Math.abs(gn.constante.dh) < 0.01, 'GEEUWBRUG in js/bouwvlak.js klopt met het bouwsel', JSON.stringify(gn.constante));
kop('8. shaders');
// (overdag geen enkel nieuw programma. 's Nachts hoogstens één: alle elf materialen van het landhoofd delen één programma,
// en three geeft de nachtvariant daarvan vrij zodra ze een beeld overdag getekend zijn; wie ze 's nachts voor het eerst
// weer tekent, vertaalt hem opnieuw. Dat is hetzelfde als bij het kantoor aan het water (aafftest: hoogstens twee) en
// open punt 30; hier gemeten met de omgeving eerst 's nachts getekend zonder het landhoofd)
ok(r.prog[1] === r.prog[0] && r.prog[3] - r.prog[2] <= 1, 'het landhoofd in beeld: overdag geen nieuw programma, \'s nachts hoogstens zijn ene eigen', `dag ${r.prog[0]} → ${r.prog[1]}, nacht ${r.prog[2]} → ${r.prog[3]}`);

await browser.close();
console.log(fout ? `\n${fout} fout(en)` : '\nalles goed');
process.exit(fout ? 1 : 0);
