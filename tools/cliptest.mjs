/*
 Clipping: waar steekt iets door iets anders heen? (verzoek 24 sep 2026)

   node tools/server.mjs 8123 &   node tools/cliptest.mjs [poort]

 De meting van 24 sep vond vijf bronnen; elk ervan wordt hier nagemeten.

 1. Het wapen in je hand stak 0,69 m voor de camera uit terwijl je tot 0,35 m
    bij een muur kunt komen. Het staat nu op een eigen laag en wordt na de
    wereld getekend: tegen een gevel moet het net zo goed te zien zijn als op
    straat.
 2. Grondlagen met 2 mm ertussen flikkerden vanaf 41 m. Het voorvlak ging van
    5 naar 15 cm, dus dat is nu drie keer zo ver — zonder dat de wereld zelf
    wordt afgesneden als je tegen een muur staat.
 3. Voetgangers sprongen door schuttingen die dwars over de stoep staan. Een
    minuut lopen met en zonder het stoepprofiel: hoe vaak gaat iemand door een
    botsdoos heen?
 4. Schuttingen en heggen door panden, lantaarns op de rijbaan, geparkeerde
    auto's in een gevel, bomen en struiken in een pand of op de weg: nul, binnen
    1,1 km van Tinga.
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fout = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fout++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(() => {
  const g = window.__game;
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true;
  g.player.wapenSlot = false; g.player.wapenUit = false;
  g.reliëfAf();
});

// ------------------------------------------------------------ het wapen
kop('het wapen tegen een muur');
const wapen = await page.evaluate(async () => {
  const THREE = await import('three');
  const { KAART } = await import('/js/kaart.js');
  const { WAPEN_LAAG } = await import('/js/player.js');
  const g = window.__game, cam = g.camera, r = g.renderer;
  // alles van het wapen op de wapenlaag, en de camera kijkt normaal niet naar die laag
  let fouteLaag = 0, stukken = 0;
  for (const k of Object.keys(g.player.modellen)) g.player.modellen[k].groep.traverse(o => { stukken++; if (o.layers.mask !== (1 << WAPEN_LAAG)) fouteLaag++; });
  const camZietWapen = cam.layers.test({ mask: 1 << WAPEN_LAAG });
  // tegen de gevel van Molenkrite 15 gaan staan, 0,36 m ervan af, er recht tegenaan kijkend
  const p = KAART.panden.find(q => q.straat === 'Molenkrite' && (q.nr || []).includes('15'));
  const L = Math.hypot(p.front[0], p.front[1]); const fx = p.front[0] / L, fz = p.front[1] / L;
  const u = [Math.cos(p.rect.hoek), Math.sin(p.rect.hoek)];
  const diep = Math.abs(fx * u[0] + fz * u[1]) > 0.7 ? p.rect.hx : p.rect.hz;
  const gx = p.rect.cx + fx * diep, gz = p.rect.cz + fz * diep;
  g.player.inCar = null;
  g.player.pos.set(gx + fx * 0.36, 0, gz + fz * 0.36);
  g.player.yaw = Math.atan2(fx, fz);       // met het gezicht naar de gevel
  g.player.pitch = 0;
  g.player.applyCamera();
  g.player.gun.visible = true;
  cam.updateMatrixWorld(true);
  const W = 320, H = 200;
  const rt = new THREE.WebGLRenderTarget(W, H);
  const lees = () => { const b = new Uint8Array(W * H * 4); r.readRenderTargetPixels(rt, 0, 0, W, H, b); return b; };
  const verschil = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 24) n++; return n; };
  const oudAC = r.autoClear;
  r.setRenderTarget(rt);
  // A: alleen de wereld
  r.autoClear = true; r.render(g.scene, cam); const A = lees();
  // B: de wereld en dan het wapen eroverheen (zoals nu)
  r.autoClear = true; r.render(g.scene, cam); g.tekenWapen(); const B = lees();
  // C: zoals het was — wapen en wereld in één pas, voorvlak 5 cm
  const masker = cam.layers.mask;
  cam.layers.enable(WAPEN_LAAG); cam.near = 0.05; cam.updateProjectionMatrix();
  r.autoClear = true; r.render(g.scene, cam); const C = lees();
  cam.layers.mask = masker; cam.near = g.cameraNear; cam.updateProjectionMatrix();
  r.setRenderTarget(null); r.autoClear = oudAC;
  rt.dispose();
  // hoe ver steekt het wapen voor de camera uit?
  const box = new THREE.Box3().setFromObject(g.player.gun);
  let voor = 0;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z])
    voor = Math.max(voor, -new THREE.Vector3(x, y, z).applyMatrix4(cam.matrixWorldInverse).z);
  return { fouteLaag, stukken, camZietWapen, nu: verschil(A, B), vroeger: verschil(A, C), voor, near: cam.near,
    straal: 0.35, fov: cam.fov, aspect: cam.aspect };
});
ok(wapen.stukken > 20 && wapen.fouteLaag === 0, 'het hele wapen staat op de wapenlaag', `${wapen.stukken} stukken, ${wapen.fouteLaag} verkeerd`);
ok(!wapen.camZietWapen, 'en in de gewone pas tekent de camera het niet');
ok(wapen.nu > 1500, 'tegen de gevel is het wapen in beeld', `${wapen.nu} beeldpunten`);
ok(wapen.vroeger < wapen.nu * 0.8, 'waar het vroeger half in de muur verdween',
  `vroeger ${wapen.vroeger} beeldpunten (${Math.round(100 * wapen.vroeger / Math.max(1, wapen.nu))} %)`);
ok(wapen.voor > wapen.straal, 'het steekt ook echt verder uit dan je botsstraal', `${wapen.voor.toFixed(2)} m voor de camera`);

// ------------------------------------------------------------ het voorvlak
kop('voorvlak en flikkeren');
const vlak = await page.evaluate(() => {
  const g = window.__game, cam = g.camera;
  const v = Math.tan(cam.fov * Math.PI / 360), h = v * cam.aspect;
  // de hoek van het voorvlak: zover van het oog raakt het afsnijden de wereld
  const hoek = cam.near * Math.sqrt(1 + v * v + h * h);
  // flikkerafstand van een gat van 2 mm in een 24-bits dieptebuffer
  const flikker = (near) => Math.sqrt(0.002 * near * 16777216);
  return { near: cam.near, hoek, nu: flikker(cam.near), was: flikker(0.05) };
});
ok(vlak.near >= 0.15, 'het voorvlak staat op 15 cm', `${vlak.near} m`);
ok(vlak.hoek < 0.33, 'en zelfs de hoek ervan blijft binnen je botsstraal van 35 cm', `${vlak.hoek.toFixed(3)} m`);
ok(vlak.nu > vlak.was * 1.7, 'twee lagen met 2 mm ertussen flikkeren pas veel verder weg',
  `vanaf ${vlak.nu.toFixed(0)} m in plaats van ${vlak.was.toFixed(0)} m`);

// ------------------------------------------------------------ voetgangers
kop('voetgangers door schuttingen');
const lopen = await page.evaluate(async () => {
  const W = await import('/js/world.js');
  const g = window.__game, n = g.npcs;
  // iedereen een lichaam, ook verder dan tweehonderd meter: sinds stap 80 botst
  // alleen wie getekend wordt, en hier gaat het om de looplijn, niet om het zicht
  // (en sinds stap 82 ook zonder kijkkegel: wie achter je loopt botst dan ook niet)
  const zicht = n.ZICHT, kijk = n.kijk; n.ZICHT = Infinity; n.kijk = null;
  const meet = (vrij) => {
    n.stoepVrij = vrij;
    // iedereen opnieuw neerzetten in de wijk, en een minuut laten lopen
    for (const p of n.people) { n.pickSegment(p, true); p.steek = 0; }
    let door = 0, stappen = 0, lopend = 0, tegen = 0;
    const vorig = new Map();
    for (let i = 0; i < 600; i++) {
      n.update(0.1, i * 0.1, 0, 0);
      for (const p of n.people) {
        if (!p.alive || p.steek > 0 || p.smak) { vorig.delete(p); continue; }
        const v = vorig.get(p);
        const stap = v ? Math.hypot(p.x - v.x, p.z - v.z) : 0;
        if (v && stap < 2) {
          stappen++;
          if (stap > 0.03) lopend++;
          if (!W.zichtVrij(v.x, v.z, p.x, p.z, 0.6)) door++;
          // staat hij met zijn lijf in een heg of tegen een schutting aan?
          const [kx, kz] = W.resolveCollisions(p.x, p.z, 0.3);
          if (Math.hypot(kx - p.x, kz - p.z) > 0.01) tegen++;
        }
        vorig.set(p, { x: p.x, z: p.z });
      }
    }
    return { door, stappen, tegen, lopend: lopend / Math.max(1, stappen) };
  };
  const zonder = meet(false);
  const met = meet(true);
  n.stoepVrij = true; n.ZICHT = zicht; n.kijk = kijk;
  return { zonder, met };
});
ok(lopen.zonder.door > 0, 'zonder stoepprofiel gaat er wel eens iemand door een doos', `${lopen.zonder.door} keer in ${lopen.zonder.stappen} stappen`);
/*
 Er dwars doorheen springen is zeldzaam — een paar keer per minuut voor 130
 mensen, want ze worden elk beeld al uit de dozen geduwd. Wat vaker gebeurt is
 half in een heg staan, of tegen een schutting aan geduwd worden: dat telt
 `tegen`. Dat moet flink minder, en doorheen mag niet vaker.
*/
ok(lopen.met.door <= lopen.zonder.door, 'met stoepprofiel niet vaker erdoorheen',
  `${lopen.met.door} keer in ${lopen.met.stappen} stappen`);
ok(lopen.met.tegen <= lopen.zonder.tegen * 0.5, 'en veel minder vaak half in een heg of tegen een schutting',
  `${lopen.met.tegen} keer, zonder profiel ${lopen.zonder.tegen}`);
/*
 En ze lopen nog. De eerste versie van het profiel liet op fietspaden en
 woonerven geen plek over (98 % dicht): wie daar liep keerde elk beeld om en
 stond stil, en dat telde hier als "niet door een doos".
*/
ok(lopen.met.lopend > lopen.zonder.lopend * 0.85, 'en er lopen er even veel als zonder profiel',
  `${Math.round(100 * lopen.met.lopend)} % van de stappen in beweging, zonder ${Math.round(100 * lopen.zonder.lopend)} %`);

// ------------------------------------------------------------ de kaart
kop('schuttingen, lantaarns, auto\'s en bomen');
const kaart = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const g = window.__game;
  const bij = (x, z) => Math.hypot(x, z) < 1100;
  const C = 25, raster = new Map(), sl = (i, j) => i * 100003 + j;
  for (const p of KAART.panden) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of p.voet) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    p._b = [x0, z0, x1, z1];
    for (let i = Math.floor(x0 / C); i <= Math.floor(x1 / C); i++) for (let j = Math.floor(z0 / C); j <= Math.floor(z1 / C); j++) {
      const k = sl(i, j); if (!raster.has(k)) raster.set(k, []); raster.get(k).push(p); }
  }
  const inPoly = (x, z, poly) => { let r = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) r = !r; } return r; };
  const inPand = (x, z, marge) => (raster.get(sl(Math.floor(x / C), Math.floor(z / C))) || []).some(p => {
    const b = p._b; if (x < b[0] || x > b[2] || z < b[1] || z > b[3] || !inPoly(x, z, p.voet)) return false;
    let d = Infinity;
    for (let i = 0, j = p.voet.length - 1; i < p.voet.length; j = i++) { const a = p.voet[j], c = p.voet[i]; const dx = c[0] - a[0], dz = c[1] - a[1], L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2)); d = Math.min(d, Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z)); }
    return d > marge; });
  const R = new Map();
  for (const a of KAART.wegassen) { if (!a.drive) continue; for (let i = 1; i < a.pts.length; i++) {
    const s = { a: a.pts[i - 1], b: a.pts[i], h: ((a.pts[i - 1][2] || a.w) + (a.pts[i][2] || a.w)) / 4 };
    for (let ii = Math.floor((Math.min(s.a[0], s.b[0]) - 8) / 20); ii <= Math.floor((Math.max(s.a[0], s.b[0]) + 8) / 20); ii++)
      for (let jj = Math.floor((Math.min(s.a[1], s.b[1]) - 8) / 20); jj <= Math.floor((Math.max(s.a[1], s.b[1]) + 8) / 20); jj++) {
        const k = sl(ii, jj); if (!R.has(k)) R.set(k, []); R.get(k).push(s); } } }
  const opBaan = (x, z, marge) => (R.get(sl(Math.floor(x / 20), Math.floor(z / 20))) || []).some(s => {
    const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - s.a[0]) * dx + (z - s.a[1]) * dz) / L2));
    return Math.hypot(s.a[0] + dx * t - x, s.a[1] + dz * t - z) < s.h - marge; });
  const lijnDoor = (lijst) => { let n = 0; for (const l of lijst) { const mx = (l.a[0] + l.b[0]) / 2, mz = (l.a[1] + l.b[1]) / 2; if (!bij(mx, mz)) continue;
    const L = Math.hypot(l.b[0] - l.a[0], l.b[1] - l.a[1]); let binnen = 0;
    for (let s = 0.25; s < L; s += 0.5) { const t = s / L; if (inPand(l.a[0] + (l.b[0] - l.a[0]) * t, l.a[1] + (l.b[1] - l.a[1]) * t, 0.35)) binnen += 0.5; }
    if (binnen > 0.4) n++; } return n; };
  const tel = (lijst, marge) => { let pand = 0, baan = 0; for (const o of lijst) { if (!bij(o.x, o.z)) continue; if (inPand(o.x, o.z, marge)) pand++; else if (opBaan(o.x, o.z, 0.3)) baan++; } return { pand, baan }; };
  let autoPand = 0;
  for (const c of g.vehicles.cars) {
    if (c.zichtbaar === false || !bij(c.x, c.z)) continue;
    const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw), rx = -fz, rz = fx;
    if ([[2, 0.85], [2, -0.85], [-2, 0.85], [-2, -0.85]].some(([f, s]) => inPand(c.x + fx * f + rx * s, c.z + fz * f + rz * s, 0.25))) autoPand++;
  }
  return { schuttingen: lijnDoor(KAART.schuttingen), heggen: lijnDoor(KAART.heggen), lantaarns: tel(KAART.lantaarns, 0.1),
    bomen: tel(KAART.bomen, 0.3), struiken: tel(KAART.struiken, 0.3), autoPand,
    aantallen: { schuttingen: KAART.schuttingen.length, lantaarns: KAART.lantaarns.length } };
});
ok(kaart.schuttingen === 0 && kaart.heggen === 0, 'geen schutting of heg meer door een pand',
  `${kaart.schuttingen} schuttingen, ${kaart.heggen} heggen (was 134 en 17)`);
ok(kaart.lantaarns.baan === 0 && kaart.lantaarns.pand === 0, 'geen lantaarn op de rijbaan', `${kaart.lantaarns.baan} (was 28)`);
ok(kaart.autoPand === 0, 'geen geparkeerde auto in een gevel', `${kaart.autoPand} (was 7)`);
ok(kaart.bomen.pand + kaart.bomen.baan + kaart.struiken.pand + kaart.struiken.baan === 0, 'geen boom of struik in een pand of op de weg',
  `bomen ${kaart.bomen.pand}/${kaart.bomen.baan}, struiken ${kaart.struiken.pand}/${kaart.struiken.baan} (was 7 en 17)`);
ok(kaart.aantallen.schuttingen > 10000 && kaart.aantallen.lantaarns > 1900, 'en er is niet te veel weggehaald',
  `${kaart.aantallen.schuttingen} schuttingstukken, ${kaart.aantallen.lantaarns} lantaarns`);

console.log(`\n${fout ? fout + ' fout' : 'alles goed'}`);
await browser.close();
process.exit(fout ? 1 : 0);
