/*
 Foto's bij stap 142 (npm run nomercy5shots): No Mercy 5, "De Overtocht". In docs/screenshots/:

   nomercy5_overtocht.png  de sloep met de twee figuranten op het water, de camera-boot ernaast, het zoeklicht van de
                           stelling en de lichtkogels, De Rat erachter (01:00);
   nomercy5_molen.png      de voet van de molen: de Duitsers achter de zandzakken, de vlag, de sluipschutter op de stelling;
   nomercy5_rit.png        de rit: de camera-auto met de camera op het dak, de stafauto, en een zijspan erachter;
   nomercy5_premiere.png   een week later op de kade: Erik Jan en de cameraman.
*/
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const poort = process.argv[2] || '8123';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: +(process.env.SHOT_B || 1280), height: +(process.env.SHOT_H || 720) } });
let fouten = 0;
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
page.on('console', m => { if (/^rit:/.test(m.text())) console.log(m.text()); });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  const W = await import('/js/world.js');
  const V = await import('/js/viaduct.js');
  const I = await import('/js/inval.js');
  for (let n = 1; n <= 15; n++) localStorage.removeItem(n === 1 ? 'tinga.spel.v1' : `tinga.spel.v1.${n}`);
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, v = g.verhaal;
  g.player.active = false;
  window.__autoplay = false;
  window.__W = W; window.__I = I;
  g.sfeer.weer = 'helder';
  if (g.reliëfAf) g.reliëfAf();
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) { g.player.health = 100; v.update(dt); } };
  window.__klik = (max = 80) => { for (let i = 0; i < max && !document.getElementById('dialoog').hidden; i++) { v.toets(); window.__stap(1); } };
  window.__zet = (x, z) => { const [rx, rz] = W.resolveCollisions(x, z, 0.4); g.player.inCar = null; g.player.pos.set(rx, V.grondHoogte(rx, rz), rz); g.player.applyCamera(); };
  // vrij spelen na missie 12 en No Mercy 4, dan bij Erik Jan op de kade
  const s = v.bewaar(); s.missie = 'klaar'; s.fase = 'klaar'; s.volgende = null; s.brugKlaar = true; s.noMercyKlaar = true; s.noMercyGebeld = true;
  v.herstel(s); v.__geenVolgende(); v.klusjes.reset();
  window.__stap(2);
  const p = v.noMercy5.ejPlek;
  window.__zet(p.x + 2, p.z + 1); window.__stap(2);
  v.toets(); window.__stap(1); window.__klik(); window.__stap(90); window.__klik(); window.__stap(2);
});

const map = process.env.SHOT_MAP || process.argv[3] || 'docs/screenshots';
const kijk = `(van, naar) => {
  const g = window.__game, C = g.camera;
  C.position.set(van[0], van[1], van[2]); C.lookAt(naar[0], naar[1], naar[2]); C.updateMatrixWorld(true);
  // de luchtbol gaat in de hoofdlus met de camera mee; headless niet, en dan kijk je er na een sprong van honderden meters buiten
  g.scene.traverse(o => { if (o.material && o.material.uniforms && o.material.uniforms.maanDir) o.position.copy(C.position); });
  window.__W.updateLOD(C.position.x, C.position.z);
  g.scene.updateMatrixWorld(true); g.renderer.shadowMap.needsUpdate = true;
  g.renderer.render(g.scene, C);
  g.renderer.render(g.scene, C);
  return g.renderer.domElement.toDataURL('image/png');
}`;
const opname = async (naam, code) => {
  const data = await page.evaluate(new Function(code));
  writeFileSync(`${map}/${naam}.png`, Buffer.from(data.split(',')[1], 'base64'));
  console.log(`${map}/${naam}.png`);
};

// 1. de overtocht: halverwege het water, de camera achter en boven de sloep, naar de molen
await opname('nomercy5_overtocht', `
  const g = window.__game, v = g.verhaal, n = v.noMercy5, B = g.boten, b = n.sloep;
  for (let i = 0; i < 300 && b.x < -1205; i++) {
    if (!B.verplaats(b, b.x + 0.3, b.z, -Math.PI / 2)) break;
    g.player.pos.set(b.x, 0, b.z); v.update(0.05);
  }
  window.__stap(30);
  const M = n.molen;
  return (${kijk})([b.x - 9, 3.4, b.z + 7], [M.cx, 6, M.cz]);
`);

// 2. de molen: aan wal, de Duitsers achter de zandzakken, de sluipschutter op de stelling, de vlag
await opname('nomercy5_molen', `
  const g = window.__game, v = g.verhaal, n = v.noMercy5, B = g.boten, b = n.sloep;
  for (let i = 0; i < 600; i++) {
    const dx = -1133 - b.x, dz = 884 - b.z, d = Math.hypot(dx, dz);
    if (d < 0.5 || !B.verplaats(b, b.x + dx / d * 0.3, b.z + dz / d * 0.3, Math.atan2(-dx, -dz))) break;
    g.player.pos.set(b.x, 0, b.z); v.update(0.05);
  }
  B.stapUit(); window.__stap(2); window.__klik();
  window.__stap(60);
  const M = n.molen;
  const e = { x: M.cx - 17, z: M.cz - 14 };
  window.__zet(e.x, e.z);
  g.derde.aan = true; g.derde.update(0.016, null);
  return (${kijk})([M.cx - 26, 3.2, M.cz - 22], [M.cx - 4, 4.2, M.cz - 2]);
`);

// 3. de rit: alles neer, de vlag, de stafauto, en een stuk rijden achter de camera-auto
await opname('nomercy5_rit', `
  const g = window.__game, v = g.verhaal, P = g.player;
  let n = v.noMercy5;
  for (const grp of [n.groepA, n.groepB]) for (const w of grp.wachters) {
    let k = 0; while (w.staat !== 'neer' && k++ < 6) { v.raak(w.persoon.groep.children[0], 99); window.__stap(1); }
  }
  window.__stap(4); window.__klik();
  const vl = n.set.vlag; window.__zet(vl.x + 1, vl.z); window.__stap(2); v.toets(); window.__stap(60); window.__klik(); window.__stap(2);
  const st = v.noMercy5.staf; window.__zet(st.x + 2, st.z); g.player.active = true; g.toggleCar(); g.player.active = false; window.__stap(2); window.__klik(); window.__stap(2);
  n = v.noMercy5;
  const L = n.lijn, c = n.staf;
  let s = 0;
  for (let i = 0; i < 400 && s < 150; i++) {
    const doel = Math.max(0, v.noMercy5.camS - 14);
    s += Math.max(0, Math.min(doel - s, 0.8));
    const p = window.__I.puntOp(L, s, 1.0);
    c.x = p.x; c.z = p.z; c.yaw = p.yaw; c.speed = 14; c.mesh.position.set(p.x, 0, p.z); c.mesh.rotation.y = p.yaw;
    v.update(0.05);
  }
  window.__klik();
  // naast het voorste zijspan, gericht op de camera-auto: dan staan ze alle drie in één lijn (het zijspan voorin, de stafauto, de camera-auto)
  const ca = v.noMercy5.camAuto, mo = v.noMercy5.motoren[0].mesh.position;
  const dx = ca.x - mo.x, dz = ca.z - mo.z, d = Math.hypot(dx, dz) || 1;
  console.log('rit: zijspan (' + mo.x.toFixed(1) + ', ' + mo.z.toFixed(1) + ') zichtbaar ' + v.noMercy5.motoren[0].mesh.visible + ', stafauto (' + c.x.toFixed(1) + ', ' + c.z.toFixed(1) + '), camera-auto (' + ca.x.toFixed(1) + ', ' + ca.z.toFixed(1) + '), ' + d.toFixed(1) + ' m');
  const van = [mo.x - dx / d * 3 + dz / d * 2.6, 2.3, mo.z - dz / d * 3 - dx / d * 2.6];
  return (${kijk})(van, [ca.x, 0.9, ca.z]);
`);

// 4. de première: de rit afmaken op de ruit, "Een week later…", Erik Jan en de cameraman op de kade
await opname('nomercy5_premiere', `
  const g = window.__game, v = g.verhaal, P = g.player;
  const n = v.noMercy5, L = n.lijn, c = n.staf, ruitS = L.lengte - 18;
  let s = v.noMercy5.sP;
  for (let i = 0; i < 4000 && v.noMercy5.fase === 'rit'; i++) {
    const doel = Math.min(ruitS, Math.max(0, v.noMercy5.camS - 14));
    const ds = Math.max(0, Math.min(doel - s, 0.9));
    s += ds;
    const p = window.__I.puntOp(L, s, 1.0);
    c.x = p.x; c.z = p.z; c.yaw = p.yaw; c.speed = ds / 0.05; c.mesh.position.set(p.x, 0, p.z); c.mesh.rotation.y = p.yaw;
    v.update(0.05);
  }
  window.__klik(); window.__stap(110); window.__klik(); window.__stap(4);
  const m = v.noMercy5, e = m.ej.groep.position;
  window.__stap(10);
  return (${kijk})([P.pos.x + (P.pos.x - e.x) * 0.9, 1.75, P.pos.z + (P.pos.z - e.z) * 0.9], [e.x, 1.3, e.z]);
`);

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);
