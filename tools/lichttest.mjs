/*
 Licht (verzoek 24 sep 2026).

   node tools/server.mjs 8123 &   node tools/lichttest.mjs [poort]

 1. Omgevingsschaduw aan de voet van een muur: elke muur en gevel heeft hem, en
    in het shaderprogramma zit hij ook echt.
 2. De omgevingsreflectie loopt met de klok mee: 's avonds is hij opnieuw
    gebakken en donkerder dan 's middags.
 3. Scherpere schaduw dichtbij: kleiner dan 3 cm per beeldpunt op de pc, de
    doos staat vóór je, en hij verschuift in hele beeldpunten van de kaart.
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
await page.evaluate(() => { document.getElementById('overlay').style.display = 'none'; window.__game.player.active = true; });

kop('omgevingsschaduw aan de voet van de muur');
const ao = await page.evaluate(() => {
  const g = window.__game, r = g.renderer, gl = r.getContext();
  let muren = 0, zonder = 0;
  const gezien = new Set();
  g.scene.traverse(o => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m || gezien.has(m) || !m.map || !m.map.image) continue;
      gezien.add(m);
      if (m.userData.grondAO) muren++;
    }
  });
  // de programma's na één beeld: zit de omgevingsschaduw erin?
  r.render(g.scene, g.camera);
  let metAO = 0;
  for (const p of r.info.programs || []) {
    const sh = gl.getAttachedShaders(p.program) || [];
    if (sh.some(s => (gl.getShaderSource(s) || '').includes('aoGrond'))) metAO++;
  }
  return { muren, metAO };
});
ok(ao.muren > 1000, 'alle muren en gevels hebben omgevingsschaduw aan de voet', `${ao.muren} materialen`);
ok(ao.metAO > 0, 'en het shaderprogramma rekent hem ook echt', `${ao.metAO} programma's`);

kop('de omgevingsreflectie met de klok mee');
const omg = await page.evaluate(async () => {
  const THREE = await import('three');
  const g = window.__game, r = g.renderer;
  // de gemiddelde helderheid van de omgevingskaart, uit het doel van de PMREM
  const helder = () => {
    const t = g.scene.environment;
    const W = 64, H = 64;
    const doel = new THREE.WebGLRenderTarget(W, H);
    const sc = new THREE.Scene();
    const bol = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, envMap: t, envMapIntensity: 1 }));
    sc.add(bol);
    const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 10); cam.position.set(0, 0, 3.2);
    r.setRenderTarget(doel); r.render(sc, cam);
    const b = new Uint8Array(W * H * 4); r.readRenderTargetPixels(doel, 0, 0, W, H, b);
    r.setRenderTarget(null); doel.dispose();
    let s = 0; for (let i = 0; i < b.length; i += 4) s += b[i] + b[i + 1] + b[i + 2];
    return s / (W * H * 3);
  };
  const zet = (uur) => { g.sfeer.uur = uur; for (let i = 0; i < 5; i++) g.sfeer.update(0.1, g.camera.position.x, g.camera.position.z); g.werkOmgevingBij(7); };
  zet(13);
  const n0 = g.omgevingGebakken, dag = helder();
  zet(22.5);
  const n1 = g.omgevingGebakken, avond = helder();
  zet(13);
  return { dag, avond, gebakken: n1 - n0 };
});
ok(omg.gebakken >= 1, 'bij een ander uur wordt de omgeving opnieuw gebakken', `${omg.gebakken} keer`);
ok(omg.avond < omg.dag * 0.6, 's avonds spiegelt er een donkere lucht in plaats van de middag',
  `helderheid ${omg.dag.toFixed(0)} overdag, ${omg.avond.toFixed(0)} om half elf`);

kop('scherpere schaduw dichtbij');
const sch = await page.evaluate(() => {
  const g = window.__game, s = g.schaduw, sun = g.sun;
  const texel = (2 * s.r) / s.map;
  const cam = g.camera;
  // de doos ligt vóór de camera
  const kijk = { x: -Math.sin(g.player.yaw), z: -Math.cos(g.player.yaw) };
  g.zetSchaduwDoos(cam.position.x, cam.position.z);
  const t = sun.target.position;
  const voor = (t.x - cam.position.x) * kijk.x + (t.z - cam.position.z) * kijk.z;
  return { texel, map: s.map, r: s.r, voor, vooruit: s.vooruit, mapSize: sun.shadow.mapSize.x,
    doos: sun.shadow.camera.right - sun.shadow.camera.left };
});
ok(sch.texel < 0.03, 'minder dan 3 cm per beeldpunt van de schaduwkaart', `${(sch.texel * 100).toFixed(1)} cm (was 5,1 cm)`);
ok(sch.mapSize === sch.map && Math.abs(sch.doos - 2 * sch.r) < 0.01, 'kaart en doos zijn echt zo ingesteld', `${sch.mapSize} px over ${sch.doos} m`);
ok(sch.voor > sch.vooruit * 0.5, 'de doos ligt vóór je, in je kijkrichting', `${sch.voor.toFixed(1)} m vooruit`);

const klik = await page.evaluate(async () => {
  const THREE = await import('three');
  const g = window.__game, sun = g.sun, s = g.schaduw;
  const texel = (2 * s.r) / s.map;
  const dir = new THREE.Vector3().subVectors(sun.position, sun.target.position).normalize();
  const rechts = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
  const op = new THREE.Vector3().crossVectors(rechts, dir).normalize();
  const rest = [];
  // een stukje lopen, en na elke stap kijken of het midden op het raster ligt
  for (let i = 0; i < 12; i++) {
    g.player.pos.x += 0.137; g.player.pos.z += 0.071; g.player.applyCamera();
    // het volgen van de zon gebeurt in de hoofdlus; hier dezelfde functie
    g.zetSchaduwDoos && g.zetSchaduwDoos(g.camera.position.x, g.camera.position.z);
    const t = sun.target.position;
    const a = t.dot(rechts) / texel, b = t.dot(op) / texel;
    rest.push(Math.max(Math.abs(a - Math.round(a)), Math.abs(b - Math.round(b))));
  }
  return { rest: Math.max(...rest), kan: !!g.zetSchaduwDoos };
});
ok(klik.kan && klik.rest < 0.02, 'hij verschuift in hele beeldpunten, dus de randen zwemmen niet',
  `afwijking van het raster hoogstens ${klik.rest.toFixed(3)} beeldpunt`);

console.log(`\n${fout ? fout + ' fout' : 'alles goed'}`);
await browser.close();
process.exit(fout ? 1 : 0);
