/*
 Het haperen van het beeld (melding 26 sep 2026: "de auto zelf beweegt smooth,
 maar de camera of het beeld is hakkerig; ook de schaduw van de auto hapert").

   node tools/server.mjs 8123 &   node tools/haperingtest.mjs [poort]

 Gemeten met de profiler van Chrome terwijl de auto rijdt en het tekenen uit
 staat (tools/_haper.mjs in de ronde zelf): de camera achter de auto liep elk
 beeld door alle 56.000 botsdozen van de wereld, de straatnaam werd elk beeld over
 alle wegvakken gezocht, en een voetganger aan het eind van zijn wegvak filterde
 alle wegvakken van de wereld. Dit toetst dat die drie nu hetzelfde antwoord
 geven voor een fractie van het werk, dat een dunne paal de camera niet meer laat
 verspringen, en dat de schaduw elk beeld bijgewerkt wordt zolang je rijdt.
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
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

const r = await page.evaluate(async () => {
  const W = await import('/js/world.js');
  const g = window.__game, s = g.start;
  const uit = {};

  // ---- 1. de camera achter de auto: hetzelfde antwoord als de lus over alles
  const oud = (px, py, pz, dx, dy, dz, maxD, marge = 0.35) => {
    const kand = [], bereik = maxD + 3;
    for (const c of W.colliders) {
      if (c.h < 0.6 || (c.hx < 0.35 && c.hz < 0.35)) continue;
      if (Math.abs(c.cx - px) > bereik + c.hx || Math.abs(c.cz - pz) > bereik + c.hz) continue;
      kand.push(c);
    }
    if (!kand.length) return maxD;
    for (let d = 0.25; d <= maxD; d += 0.25) {
      const x = px + dx * d, y = py + dy * d, z = pz + dz * d;
      if (y < 0.35) return Math.max(0, d - 0.25 - marge * 0.5);
      for (const c of kand) {
        if (c.h < y) continue;
        const ax = x - c.cx, az = z - c.cz;
        const lx = ax * c.cos - az * c.sin, lz = ax * c.sin + az * c.cos;
        if (Math.abs(lx) < c.hx + marge && Math.abs(lz) < c.hz + marge) return Math.max(0, d - 0.25 - marge * 0.5);
      }
    }
    return maxD;
  };
  let a = 12345;
  const rnd = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; };
  const proeven = [];
  for (let i = 0; i < 400; i++) {
    const h = rnd() * Math.PI * 2, p = -0.1 - rnd() * 0.3;
    proeven.push([s.x + (rnd() - 0.5) * 400, 1.6, s.z + (rnd() - 0.5) * 400, -Math.sin(h) * Math.cos(p), -Math.sin(p), -Math.cos(h) * Math.cos(p), 6.5]);
  }
  let anders = 0;
  let t0 = performance.now();
  const nieuwUit = proeven.map(q => W.vrijeCamera(...q));
  const tNieuw = (performance.now() - t0) / proeven.length;
  t0 = performance.now();
  const oudUit = proeven.map(q => oud(...q));
  const tOud = (performance.now() - t0) / proeven.length;
  for (let i = 0; i < proeven.length; i++) if (Math.abs(nieuwUit[i] - oudUit[i]) > 1e-9) anders++;
  uit.camera = { anders, tNieuw, tOud, ingekort: nieuwUit.filter(v => v < 6.5).length, dozen: W.colliders.length };

  // een dunne paal (een lantaarn) recht achter de camera kort de hengel niet in
  const L = W.lampPosities[0];
  uit.paal = W.vrijeCamera(L.x + 3, 1.6, L.z, -1, 0, 0, 6.5);

  // ---- 2. de voetgangers: de buren van een wegvak, zoals `filter` ze gaf
  const N = g.npcs;
  let burenAnders = 0;
  t0 = performance.now();
  for (let i = 0; i < 300; i++) {
    const seg = N.segs[Math.floor(rnd() * N.segs.length)], end = rnd() < 0.5 ? seg.a : seg.b;
    const nu = N.buren(end, seg).slice();
    const toen = N.segs.filter(q => q !== seg && (Math.hypot(q.a[0] - end[0], q.a[1] - end[1]) < 1.5 || Math.hypot(q.b[0] - end[0], q.b[1] - end[1]) < 1.5));
    if (nu.length !== toen.length || nu.some((q, k) => q !== toen[k])) burenAnders++;
  }
  uit.buren = { anders: burenAnders, segs: N.segs.length };

  // ---- 3. de schaduw: rijdend elk beeld bijgewerkt, stilstaand om het beeld
  const R = g.renderer, echt = R.render;
  const stand = [];
  R.render = function () { stand.push(R.shadowMap.needsUpdate); };
  const raf = () => new Promise(q => requestAnimationFrame(q));
  window.__autoplay = true; document.getElementById('overlay').style.display = 'none';
  g.player.active = true; g.player.inCar = null;
  g.player.pos.set(10, 0, -7); g.player.applyCamera();
  for (let i = 0; i < 6; i++) await raf();
  stand.length = 0;
  for (let i = 0; i < 8; i++) await raf();
  uit.stil = stand.filter(v => v === true).length / Math.max(1, stand.length);
  g.vehicles.voegToe({ x: 12.4, z: -7, yaw: g.player.yaw, soort: 'hatch' });
  g.toggleCar();
  stand.length = 0;
  for (let i = 0; i < 8; i++) await raf();
  uit.rijdend = stand.filter(v => v === true).length / Math.max(1, stand.length);
  g.toggleCar();
  R.render = echt;
  return uit;
});

kop('de camera achter de auto');
ok(r.camera.anders === 0, 'hetzelfde antwoord als de lus over alle botsdozen', `${r.camera.anders} van 400 anders, ${r.camera.ingekort} ingekort`);
ok(r.camera.tNieuw < r.camera.tOud / 10, 'voor een fractie van het werk',
  `${(r.camera.tNieuw * 1000).toFixed(0)} µs tegen ${(r.camera.tOud * 1000).toFixed(0)} µs per keer (${r.camera.dozen} dozen)`);
ok(r.paal > 6.4, 'een lantaarnpaal achter de camera laat hem niet naar voren springen', `${r.paal.toFixed(2)} m`);

kop('de voetgangers aan het eind van hun wegvak');
ok(r.buren.anders === 0, 'dezelfde buren als het filter over alle wegvakken', `${r.buren.anders} van 300 anders (${r.buren.segs} wegvakken)`);

kop('de schaduw');
ok(r.rijdend === 1, 'rijdend wordt de schaduw elk beeld bijgewerkt', `${(r.rijdend * 100).toFixed(0)} % van de beelden`);
ok(r.stil < 0.75, 'stilstaand om het beeld', `${(r.stil * 100).toFixed(0)} % van de beelden`);

console.log(`\n${fout ? fout + ' fout' : 'alles goed'}`);
await browser.close();
process.exit(fout ? 1 : 0);
