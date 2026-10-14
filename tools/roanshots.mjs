/*
 Foto's bij stap 178 (npm run roanshots): Roan naar Ma. In docs/screenshots/:

   roan_speeltuin.png   Roan bij de speeltoestellen naast de school (Radio Tinga)
   roan_volgt.png       Roan loopt achter Erik aan (van achteren gezien)
   roan_ma.png          Ma op de stoep van Molenkrite 15, Roan bij haar

 Gebruik: npm run server &  node tools/roanshots.mjs [poort] [map]
*/
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const poort = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
mkdirSync(map, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(900000);
let fouten = 0;
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  window.__W = await import('/js/world.js'); const g = window.__game; g.reliëfAf();
  document.getElementById('overlay').style.display = 'none'; document.getElementById('ui').style.display = 'none';
  const v = g.verhaal;
  // na missie 5, en meteen Marks telefoontje
  const s = v.bewaar(); s.missie = 'bx'; s.fase = 'wacht'; s.noMercyKlaar = true; s.noMercyGebeld = true; s.roanKlaar = false;
  v.herstel(s); v.__geenVolgende();
  v.roan.zetBel(0);
  for (let i = 0; i < 80; i++) v.update(0.05);
  for (let i = 0; i < 12 && !document.getElementById('dialoog').hidden; i++) { v.toets(); v.update(0.05); }
  g.sfeer.uur = 14; g.sfeer.weer = 'helder';
});
const foto = async (naam, zet) => {
  const data = await page.evaluate((zetStr) => {
    const g = window.__game, C = g.camera, v = g.verhaal, P = g.player;
    new Function('g', 'C', 'v', 'P', zetStr)(g, C, v, P);
    for (let i = 0; i < 3; i++) g.sfeer.update(0.1, C.position.x, C.position.z);
    g.scene.traverse(o => { if (o.material && o.material.uniforms && o.material.uniforms.maanDir) o.position.copy(C.position); });
    window.__W.updateLOD(C.position.x, C.position.z); g.scene.updateMatrixWorld(true); g.renderer.shadowMap.needsUpdate = true;
    C.updateMatrixWorld(true); g.renderer.render(g.scene, C); g.renderer.render(g.scene, C);
    return g.renderer.domElement.toDataURL('image/png');
  }, zet);
  writeFileSync(`${map}/${naam}.png`, Buffer.from(data.split(',')[1], 'base64'));
  console.log(`${map}/${naam}.png`);
};
await foto('roan_speeltuin', `const k = v.roan.kind.groep.position; for (let i = 0; i < 10; i++) v.update(0.05);
  C.position.set(k.x + 3.2, 1.5, k.z + 3.0); C.lookAt(k.x, 0.6, k.z);`);
await foto('roan_volgt', `const k = v.roan.kind.groep.position;
  P.pos.set(k.x + 1.6, 0, k.z); for (let i = 0; i < 80; i++) v.update(0.05);
  for (let i = 0; i < 12 && !document.getElementById('dialoog').hidden; i++) { v.toets(); v.update(0.05); }
  // tien meter naar het oosten lopen, Roan erachteraan
  for (let i = 0; i < 70; i++) { P.yaw = -Math.PI / 2; const [x, z] = window.__W.resolveCollisions(P.pos.x + 0.15, P.pos.z, 0.4); P.pos.set(x, 0, z); v.update(0.05); }
  g.derde.aan || g.derde.wissel(); g.derde.update(0.05, null);
  C.position.set(P.pos.x - 7, 2.2, P.pos.z + 3); C.lookAt(P.pos.x - 1.2, 0.8, P.pos.z);`);
await foto('roan_ma', `const m = v.roan.maPlek; const ma = v.roan.ma, k = v.roan.kind;
  ma.groep.visible = true; ma.zetNeer(m.x, m.z, m.yaw); k.groep.visible = true;
  const fx = -Math.sin(m.yaw), fz = -Math.cos(m.yaw);
  k.zetNeer(m.x + fx * 1.1 + 0.6, m.z + fz * 1.1, m.yaw + Math.PI); ma.update(0.05, {}); k.update(0.05, {});
  C.position.set(m.x + fx * 5 + 2, 1.6, m.z + fz * 5 + 2); C.lookAt(m.x, 1.0, m.z);`);
await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);
