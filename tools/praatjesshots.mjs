/*
 Foto's bij stap 192 (npm run praatjesshots): Mark op de stoep voor Molenkrite 15 en Johan op zijn oprit aan het Kruirad 62,
 tussen twee missies, van waar je met ze praat. In docs/screenshots/: praatje_mark.png, praatje_johan.png.

 Gebruik: npm run server &  node tools/praatjesshots.mjs [poort] [map]
*/
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const poort = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(900000);
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  window.__W = await import('/js/world.js'); const g = window.__game; g.reliëfAf();
  document.getElementById('overlay').style.display = 'none'; document.getElementById('ui').style.display = 'none';
  const v = g.verhaal;
  // tussen missie 5 en 6, ver weg, zodat ze verschijnen
  const s = v.bewaar(); s.missie = 'bx'; s.fase = 'wacht'; s.noMercyKlaar = true; s.noMercyGebeld = true; s.roanKlaar = true;
  v.herstel(s); v.__geenVolgende && v.__geenVolgende();
  const m = v.praatjes.mark.plek;
  g.player.pos.set(m.x + 200, 0, m.z + 200);
  for (let i = 0; i < 20; i++) v.update(0.05);
  g.sfeer.uur = 15; g.sfeer.weer = 'helder';
});
for (const wie of ['mark', 'johan']) {
  const data = await page.evaluate((wie) => {
    const g = window.__game, C = g.camera, v = g.verhaal, P = g.player;
    const q = v.praatjes[wie];
    // de speler 2,4 m voor hem (hij draait zich naar je toe), de camera op ooghoogte naast je schouder
    const dx = Math.sin(q.plek.yaw), dz = Math.cos(q.plek.yaw);
    P.pos.set(q.x - dx * 2.4, 0, q.z - dz * 2.4);
    for (let i = 0; i < 40; i++) v.update(0.05);
    C.position.set(q.x - dx * 3.0 + dz * 0.7, 1.65, q.z - dz * 3.0 - dx * 0.7); C.lookAt(q.x, 1.25, q.z);
    for (let i = 0; i < 3; i++) g.sfeer.update(0.1, C.position.x, C.position.z);
    window.__W.updateLOD(C.position.x, C.position.z); g.scene.updateMatrixWorld(true); g.renderer.shadowMap.needsUpdate = true;
    C.updateMatrixWorld(true); g.renderer.render(g.scene, C); g.renderer.render(g.scene, C);
    return g.renderer.domElement.toDataURL('image/png');
  }, wie);
  writeFileSync(`${map}/praatje_${wie}.png`, Buffer.from(data.split(',')[1], 'base64'));
  console.log(`${map}/praatje_${wie}.png`);
}
await browser.close();
