/*
 De woningen van bovenaf, onder het plafond door (ronde van 26 sep 2026: "de
 Wieken is heel krap, bank voor de keuken"; en Koningsspil 20, waar de keuken
 los in de tuin stond):

   plattegrond_wieken29.png       de Wieken 29
   plattegrond_koningsspil20.png  Koningsspil 20, met de tuin erachter

 Een orthografische camera net onder het plafond, recht naar beneden, met de
 lange kant van het huis verticaal (de voorgevel boven). Het beeld komt uit het
 doek zelf, direct na het tekenen: de hoofdlus tekent anders zijn eigen beeld
 eroverheen.

 Gebruik: npm run server &   node tools/plattegrondshots.mjs 8123 [map]
*/
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
const poort = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
mkdirSync(map, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 700, height: 1400 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
for (const [naam, bestand] of [['de Wieken 29', 'plattegrond_wieken29'], ['Koningsspil 20', 'plattegrond_koningsspil20']]) {
const r = await page.evaluate(async (naam) => {
  const THREE = await import('three');
  const g = window.__game;
  document.getElementById('overlay').style.display = 'none';
  for (const el of document.querySelectorAll('body > div')) if (el.id !== 'overlay') el.style.visibility = 'hidden';
  const w = g.woningen.find(q => q.naam === naam);
  const D = w.botsdozen, P = w.plekken;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const d of D) { x0 = Math.min(x0, d.x - d.hx); x1 = Math.max(x1, d.x + d.hx); z0 = Math.min(z0, d.z - d.hz); z1 = Math.max(z1, d.z + d.hz); }
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, hw = (x1 - x0) / 2 + 0.3, hd = (z1 - z0) / 2 + 0.3;
  const asp = 700 / 1400;
  // de lange kant verticaal
  const lang = (z1 - z0) > (x1 - x0);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 4);
  const G = w.groep; G.updateMatrixWorld(true);
  const wp = (x, y, z) => G.localToWorld(new THREE.Vector3(x, y, z));
  const boven = wp(cx, 2.42, cz), onder = wp(cx, 0, cz);
  const upW = (lang ? wp(cx, 0, cz - 1) : wp(cx + 1, 0, cz)).sub(onder).normalize();
  cam.position.copy(boven);
  cam.up.copy(upW);
  cam.lookAt(onder);
  const halfH = lang ? hd : hw, halfW = lang ? hw : hd;
  const s = Math.max(halfH, halfW / asp);
  cam.left = -s * asp; cam.right = s * asp; cam.top = s; cam.bottom = -s; cam.updateProjectionMatrix();
  g.sfeer.uur = 13;
  g.renderer.setRenderTarget(null);
  g.renderer.render(g.scene, cam);
  const png = g.renderer.domElement.toDataURL('image/png');
  const f = (p) => p ? [+p.x.toFixed(2), +p.z.toFixed(2)] : null;
  return { png, bbox: [x0, x1, z0, z1].map(v => +v.toFixed(2)), up: lang ? '-z boven' : '+x boven',
    plekken: Object.fromEntries(Object.entries(P).filter(([k, v]) => v && typeof v.x === 'number').map(([k, v]) => [k, f(v)])),
    dozen: D.filter(d => !d.muur).map(d => [+(d.x - d.hx).toFixed(2), +(d.x + d.hx).toFixed(2), +(d.z - d.hz).toFixed(2), +(d.z + d.hz).toFixed(2), +d.h.toFixed(2)]) };
}, naam);
writeFileSync(`${map}/${bestand}.png`, Buffer.from(r.png.split(',')[1], 'base64'));
console.log(`${map}/${bestand}.png`);
}
await b.close();
