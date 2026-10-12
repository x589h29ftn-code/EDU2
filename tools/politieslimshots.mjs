/*
 Foto's bij stap 144 (npm run politieslimshots): de politie slimmer. In docs/screenshots/:

   politie_dekking.png   een agent gehurkt achter een geparkeerde auto, en een tweede die net omhoog komt voor een schot
   politie_zaklamp.png   01:00: twee agenten zoeken met hun zaklamp een straat af
   politie_verstopt.png  gehurkt in een struik, VERSTOPT onder de sterren, een agent loopt op een paar meter voorbij

 Gebruik: npm run server &  node tools/politieslimshots.mjs 8123 [map]
*/
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const port = process.argv[2] || '8123';
const map = process.env.SHOT_MAP || process.argv[3] || 'docs/screenshots';
mkdirSync(map, { recursive: true });
const B = +(process.env.SHOT_B || 1280), H = +(process.env.SHOT_H || 720);
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: B, height: H } });
page.setDefaultTimeout(900000);
let fouten = 0;
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 600000 });
await page.evaluate(async () => {
  const { KAART } = await import('./js/kaart.js');
  window.__W = await import('./js/world.js');
  window.__KW = await import('./js/kaartwereld.js');
  window.__K = KAART;
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = false;
  window.__autoplay = false;
  if (g.reliëfAf) await g.reliëfAf();
  g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
  const as = KAART.wegassen.filter(w => w.drive && w.naam === 'Molenkrite' && w.lengte > 60)
    .sort((p, q) => {
      const m = (w) => { const t = w.pts[Math.floor(w.pts.length / 2)]; return Math.hypot(t[0], t[1]); };
      return m(p) - m(q);
    })[0];
  const a = as.pts[Math.floor(as.pts.length / 2)], b = as.pts[Math.min(as.pts.length - 1, Math.floor(as.pts.length / 2) + 3)];
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  window.__pd = { x: a[0], z: a[1] }; window.__langs = { x: (b[0] - a[0]) / L, z: (b[1] - a[1]) / L };
  window.__uur = (u) => { g.sfeer.uur = u; g.sfeer.weer = 'helder'; for (let i = 0; i < 3; i++) g.sfeer.update(0.1, a[0], a[1]); };
  g.politie.reset(); g.politie.proefStil = true;
});

const kijk = `(van, naar) => {
  const g = window.__game, C = g.camera;
  C.position.set(van[0], van[1], van[2]); C.lookAt(naar[0], naar[1], naar[2]); C.updateMatrixWorld(true);
  g.scene.traverse(o => { if (o.material && o.material.uniforms && o.material.uniforms.maanDir) o.position.copy(C.position); });
  window.__W.updateLOD(C.position.x, C.position.z);
  g.scene.updateMatrixWorld(true); g.renderer.shadowMap.needsUpdate = true;
  g.renderer.render(g.scene, C);
  g.renderer.render(g.scene, C);
  return g.renderer.domElement.toDataURL('image/png');
}`;
const opname = async (naam, code) => {
  const data = await page.evaluate(new Function(code));
  if (!data) { console.log(`${naam}: geen plek gevonden`); fouten++; return; }
  writeFileSync(`${map}/${naam}.png`, Buffer.from(data.split(',')[1], 'base64'));
  console.log(`${map}/${naam}.png`);
};

// 1. dekking: een geparkeerde auto vlak bij de Molenkrite, de speler aan de overkant, twee agenten erachter
await opname('politie_dekking', `
  const g = window.__game, P = g.politie, W = window.__W, pd = window.__pd;
  window.__uur(15);
  P.reset(); P.proefStil = true;
  const auto = g.vehicles.cars.filter(c => !c.mesh && Math.hypot(c.x - pd.x, c.z - pd.z) < 220)
    .sort((p, q) => Math.hypot(p.x - pd.x, p.z - pd.z) - Math.hypot(q.x - pd.x, q.z - pd.z))
    .find(c => {
      const fx = Math.cos(c.yaw), fz = -Math.sin(c.yaw);
      for (const k of [1, -1]) {
        const sx = c.x + fx * 13 * k, sz = c.z + fz * 13 * k;
        const [rx, rz] = W.resolveCollisions(sx, sz, 0.4);
        if (Math.hypot(rx - sx, rz - sz) < 0.05 && W.zichtVrij(sx, sz, c.x - fx * 2.5 * k, c.z - fz * 2.5 * k, 1.6)) { c.__k = k; return true; }
      }
      return false;
    });
  if (!auto) return null;
  const fx = Math.cos(auto.yaw), fz = -Math.sin(auto.yaw), lx = -Math.sin(auto.yaw), lz = -Math.cos(auto.yaw), k = auto.__k;
  const sp = { x: auto.x + fx * 13 * k, z: auto.z + fz * 13 * k };
  g.player.pos.set(sp.x, 0, sp.z); g.player.hurk = 0;
  P.zetSter(2, sp.x, sp.z);
  const zet = (a, x, z, hurk) => {
    a.persoon.zetNeer(x, z, 0); a.persoon.groep.visible = true; a.staat = 'jacht'; a.rol = 'aanval';
    a.persoon.kijkNaar(sp.x, sp.z, 1, 99);
    for (let i = 0; i < 20; i++) a.persoon.update(0.05, { mikt: true, hurkt: hurk });
  };
  const a1 = P.proef.agent(0, 0), a2 = P.proef.agent(0, 0);
  zet(a1, auto.x - fx * 1.7 * k + lx * 0.9, auto.z - fz * 1.7 * k + lz * 0.9, 0.6);
  zet(a2, auto.x - fx * 1.7 * k - lx * 2.6, auto.z - fz * 1.7 * k - lz * 2.6, 0);
  // zes meter van de auto, een stap opzij: de gehurkte achter de motorkap, de staande ernaast
  const van = [auto.x + fx * 6.5 * k - lx * 2.5, 1.5, auto.z + fz * 6.5 * k - lz * 2.5];
  return (${kijk})(van, [auto.x - fx * 1.0 * k - lx * 0.6, 0.8, auto.z - fz * 1.0 * k - lz * 0.6]);
`);

// 2. de zaklamp: 01:00, twee agenten op straat, de camera een eind verderop
await opname('politie_zaklamp', `
  const g = window.__game, P = g.politie, pd = window.__pd, l = window.__langs;
  P.reset(); P.proefStil = true;
  window.__uur(1);
  g.player.pos.set(pd.x + 900, 0, pd.z + 900);
  P.zetSter(1, pd.x, pd.z);
  const yaw = Math.atan2(l.x, l.z);
  const zet = (x, z, draai) => {
    const a = P.proef.agent(x, z);
    a.persoon.zetNeer(x, z, yaw + draai); a.persoon.groep.visible = true; a.staat = 'zoekt';
    for (let i = 0; i < 20; i++) a.persoon.update(0.05, { mikt: false });
    return a;
  };
  zet(pd.x - l.z * 1.5, pd.z + l.x * 1.5, 0.35);
  zet(pd.x + l.z * 2.5 + l.x * 4, pd.z - l.x * 2.5 + l.z * 4, -0.45);
  P.update(0.001);
  return (${kijk})([pd.x + l.x * 17 + l.z * 3, 2.1, pd.z + l.z * 17 - l.x * 3], [pd.x, 0.9, pd.z]);
`);

// 3. verstopt: gehurkt in een struik, de hud met VERSTOPT, een agent loopt voorbij (een schermafdruk van de pagina)
const verstopt = await page.evaluate(`(() => {
  const g = window.__game, P = g.politie, K = window.__K, W = window.__W, KW = window.__KW, pd = window.__pd;
  P.reset(); P.proefStil = true;
  window.__uur(16);
  const s = K.struiken.filter(t => Math.hypot(t.x - pd.x, t.z - pd.z) < 500 && !KW.inPand(t.x, t.z) && !KW.geenGroen(t.x, t.z))
    .sort((p, q) => Math.hypot(p.x - pd.x, p.z - pd.z) - Math.hypot(q.x - pd.x, q.z - pd.z))
    .find(t => { for (let k = 0; k < 8; k++) { const h = k * Math.PI / 4, x = t.x + Math.cos(h) * 6, z = t.z + Math.sin(h) * 6;
      const [rx, rz] = W.resolveCollisions(x, z, 0.4); if (Math.hypot(rx - x, rz - z) < 0.05 && W.zichtVrij(t.x, t.z, x, z, 1.2)) { t.__h = h; return true; } } return false; });
  if (!s) return null;
  const h = s.__h;
  g.player.pos.set(s.x, 0, s.z); g.player.hurk = 1;
  P.zetSter(2, s.x + Math.cos(h) * 20, s.z + Math.sin(h) * 20);
  P.update(0.001);
  g.hud.zetSterren(P.ster, true); g.hud.zetVerstopt(P.gezocht && P.verstopt);
  const ax = s.x + Math.cos(h) * 6 - Math.sin(h) * 1.5, az = s.z + Math.sin(h) * 6 + Math.cos(h) * 1.5;
  const a = P.proef.agent(ax, az);
  a.persoon.zetNeer(ax, az, Math.atan2(Math.sin(h), -Math.cos(h)) ); a.persoon.groep.visible = true; a.staat = 'zoekt';
  for (let i = 0; i < 20; i++) a.persoon.update(0.05, { loopt: true, mikt: true, snelheid: 1.7 });
  // (de hoofdlus tekent ook headless een beeld met de camera van de speler: dus de speler zelf zo neerzetten)
  g.player.yaw = Math.atan2(-(ax - s.x), -(az - s.z)); g.player.pitch = 0.02;
  g.player.applyCamera();
  W.updateLOD(s.x, s.z);
  return { ziet: P.zietSpeler({ x: ax, z: az }, a.persoon.yaw, false, true), hud: !document.getElementById('verstopt').hidden };
})()`);
if (verstopt) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${map}/politie_verstopt.png`, timeout: 600000 });
  console.log(`${map}/politie_verstopt.png — ziet hij je: ${verstopt.ziet}, VERSTOPT in beeld: ${verstopt.hud}`);
} else { console.log('politie_verstopt: geen struik gevonden'); fouten++; }

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);
