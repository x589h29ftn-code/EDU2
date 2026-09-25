/*
 De schaduwpas en de lantaarns (ronde van 25 sep 2026: "neem de wereld verder
 door op verbeteringen, optimalisatie en spelbeleving").

   node tools/server.mjs 8123 &   node tools/schaduwtest.mjs [poort]

 tools/optimeer.mjs tekende de schaduwpas nooit (js/main.js zet `autoUpdate`
 uit), dus die stond altijd op nul. Echt gemeten was hij 574.000 driehoeken aan
 de Molenkrite, en bijna de helft daarvan waren bomen van tegels die de
 schaduwdoos maar net raakten. En de lantaarns waren één stapel voor de hele
 wereld: 244.000 driehoeken op elke meetplek.

 1. De bomen werpen hun schaduw via een kleine stapel rond de schaduwdoos:
    elke boom binnen 60 m van het midden zit erin, geen van verder dan 70 m.
 2. De schaduwpas is een stuk goedkoper dan met de oude tegels.
 3. En in beeld is de schaduw gelijk gebleven: evenveel schaduw op de grond.
 4. De lantaarns staan per tegel: de verre gaan uit, een omgereden paal valt nog
    steeds om, en dichtbij werpen ze nog schaduw.
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
  const THREE = await import('three');
  const W = await import('/js/world.js');
  const KW = await import('/js/kaartwereld.js');
  const g = window.__game, s = g.start, R = g.renderer, gl = R.getContext();
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  g.player.wapenUit = true; if (g.player.gun) g.player.gun.visible = false;
  // de hoofdlus zet de camera elk beeld op de speler; hier beslist de proef
  g.player.applyCamera = () => {};
  g.sfeer.uur = 15; g.sfeer.weer = 'helder';
  for (let i = 0; i < 3; i++) g.sfeer.update(0.1, s.x, s.z);
  const cam = g.camera;
  const plaats = (x, z, yaw, pitch) => {
    cam.position.set(x, 1.7, z); cam.rotation.set(pitch, yaw, 0, 'YXZ'); cam.updateMatrixWorld(true);
    W.updateLOD(x, z); g.vehicles.lod(x, z);
    g.zetSchaduwDoos(x, z);
  };
  const uit = {};

  // ---- 1. de schaduwbomen rond de doos
  plaats(s.x, s.z, s.yaw || 0, -0.25);
  W.werkSchaduwBomenBij(g.sun.target.position.x, g.sun.target.position.z, true);
  const st = W.schaduwBomenStand();
  const c = st.bij;
  // alle bomen van de tegels: welke staan binnen 60 m, en zitten die in de stapel?
  const tegels = [], stapels = [];
  g.scene.traverse(o => {
    if (!o.isInstancedMesh) return;
    if ((o.userData.klasse === 'kroon' || o.userData.klasse === 'stam')) tegels.push(o);
    if (o.userData.klasse === 'schaduwboom') stapels.push(o);
  });
  const m = new THREE.Matrix4();
  const inStapel = [];
  for (const sb of stapels) for (let i = 0; i < sb.count; i++) { sb.getMatrixAt(i, m); inStapel.push([m.elements[12], m.elements[14]]); }
  let nodig = 0, gevonden = 0, teVer = 0;
  for (const t of tegels) for (let i = 0; i < t.count; i++) {
    t.getMatrixAt(i, m);
    const x = m.elements[12], z = m.elements[14];
    if (Math.hypot(x - c.x, z - c.z) > 60) continue;
    nodig++;
    if (inStapel.some(p => Math.abs(p[0] - x) < 1e-3 && Math.abs(p[1] - z) < 1e-3)) gevonden++;
  }
  for (const p of inStapel) if (Math.hypot(p[0] - c.x, p[1] - c.z) > W.SCHADUW_R + 1e-3) teVer++;
  uit.stapel = { ...st, nodig, gevonden, teVer, tegelsSchaduw: tegels.filter(t => t.castShadow).length, stapelsSchaduw: stapels.filter(s2 => s2.castShadow).length,
    schrijftNiets: stapels.every(s2 => s2.material.colorWrite === false && s2.material.depthWrite === false) };

  // ---- 2 + 3. schaduwpas en beeld: nieuw tegen oud (de tegels weer met schaduw, de stapel uit)
  const teken = () => {
    R.info.autoReset = false; R.info.reset(); R.shadowMap.needsUpdate = true;
    R.setRenderTarget(null); R.render(g.scene, cam);
    const alles = R.info.render.triangles;
    R.info.autoReset = true; R.shadowMap.needsUpdate = false;
    R.render(g.scene, cam);
    const beeld = R.info.render.triangles;
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, a = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a);
    return { schaduw: alles - beeld, a };
  };
  const oud = (aan) => {
    for (const t of tegels) t.castShadow = aan;
    for (const sb of stapels) sb.visible = !aan;
  };
  uit.plekken = [];
  const vergelijk = (a, b) => {
    // grond in de schaduw: donkere beeldpunten in de onderste helft
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    let da = 0, db = 0, verschil = 0, n = 0;
    for (let y = 0; y < h / 2; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const la = a[i] + a[i + 1] + a[i + 2], lb = b[i] + b[i + 1] + b[i + 2];
      if (la < 180) da++; if (lb < 180) db++;
      if (Math.abs(la - lb) > 90) verschil++;
      n++;
    }
    return { schaduwOud: da / n, schaduwNieuw: db / n, anders: verschil / n };
  };
  for (const [naam, x, z, yaw] of [['Molenkrite', s.x, s.z, s.yaw || 0], ['Jasker', 0, 0, -0.5]]) {
    plaats(x, z, yaw, -0.3);
    const nieuw = teken();
    oud(true); const was = teken(); oud(false);
    uit.plekken.push({ naam, schaduwNu: nieuw.schaduw, schaduwWas: was.schaduw, ...vergelijk(was.a, nieuw.a) });
  }

  // ---- 4. de lantaarns per tegel
  const palen = [];
  g.scene.traverse(o => { if (o.isInstancedMesh && o.userData.klasse === 'lantaarn' && o.castShadow) palen.push(o); });
  plaats(s.x, s.z, s.yaw || 0, 0);
  const zicht = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  const aan = palen.filter(zicht);
  const driehoek = (o) => (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
  let lampTris = 0;
  g.scene.traverse(o => { if (o.isInstancedMesh && /^lantaarn/.test(o.userData.klasse || '') && zicht(o)) lampTris += o.count * driehoek(o); });
  // een paal omrijden: zijn eigen tegel verandert, op zijn eigen plek
  const L = W.lampPosities[5];
  const paal = KW.lantaarnBij(L.x, L.z, 2);
  const tegel = palen.find(p => { for (let i = 0; i < p.count; i++) { p.getMatrixAt(i, m); if (Math.hypot(m.elements[12] - paal.x, m.elements[14] - paal.z) < 0.01) return true; } return false; });
  let voor = null, na = null;
  if (tegel) {
    let j = -1; for (let i = 0; i < tegel.count; i++) { tegel.getMatrixAt(i, m); if (Math.hypot(m.elements[12] - paal.x, m.elements[14] - paal.z) < 0.01) j = i; }
    tegel.getMatrixAt(j, m); voor = m.elements[5];                   // de y-as van de paal: 1 = rechtop
    KW.raakLantaarn(paal.x, paal.z, 0, 20);
    KW.werkLantaarnsBij(0.5, paal.x, paal.z);
    tegel.getMatrixAt(j, m); na = m.elements[5];
    KW.werkLantaarnsBij(60, paal.x + 500, paal.z); KW.werkLantaarnsBij(60, paal.x + 500, paal.z);
  }
  uit.lantaarns = { tegels: palen.length, aan: aan.length, lampTris, gevonden: !!tegel, voor, na };
  return uit;
});

kop('de bomen werpen schaduw bij de doos');
ok(r.stapel.tegelsSchaduw === 0 && r.stapel.stapelsSchaduw === r.stapel.stapels && r.stapel.schrijftNiets,
  'de tegels werpen geen schaduw meer; de kleine stapel wel, en die schrijft in het beeld niets', `${r.stapel.stapels} stapels`);
ok(r.stapel.nodig > 0 && r.stapel.gevonden === r.stapel.nodig, 'elke boom binnen 60 m van de doos zit erin',
  `${r.stapel.gevonden} van ${r.stapel.nodig}, ${r.stapel.getekend} in de stapel (van ${r.stapel.bron})`);
ok(r.stapel.teVer === 0, 'en geen van verder dan 70 m', `${r.stapel.teVer}`);

kop('de schaduwpas');
for (const p of r.plekken) {
  ok(p.schaduwNu < p.schaduwWas * 0.75, `${p.naam}: de schaduwpas is een stuk goedkoper`,
    `${(p.schaduwWas / 1000).toFixed(0)}k → ${(p.schaduwNu / 1000).toFixed(0)}k driehoeken`);
  ok(Math.abs(p.schaduwNieuw - p.schaduwOud) < 0.01 && p.anders < 0.01, `${p.naam}: en er ligt evenveel schaduw op de grond`,
    `${(p.schaduwOud * 100).toFixed(1)} % → ${(p.schaduwNieuw * 100).toFixed(1)} % donker, ${(p.anders * 100).toFixed(2)} % van de beeldpunten anders`);
}

kop('de lantaarns');
ok(r.lantaarns.tegels > 10 && r.lantaarns.aan < r.lantaarns.tegels / 2, 'per tegel, en de verre tegels staan uit',
  `${r.lantaarns.aan} van ${r.lantaarns.tegels} tegels aan`);
ok(r.lantaarns.lampTris < 60000, 'wat er van de lantaarns getekend wordt is een fractie van de 180.000 van één stapel', `${r.lantaarns.lampTris} driehoeken`);
ok(r.lantaarns.gevonden && r.lantaarns.voor > 0.99 && r.lantaarns.na < 0.9, 'een omgereden paal valt nog steeds om, in zijn eigen tegel',
  `rechtop ${r.lantaarns.voor?.toFixed(2)} → ${r.lantaarns.na?.toFixed(2)}`);

console.log(`\n${fout ? fout + ' fout' : 'alles goed'}`);
await browser.close();
process.exit(fout ? 1 : 0);
