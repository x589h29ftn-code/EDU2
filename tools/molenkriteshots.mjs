/*
 Foto's bij stap 168 (npm run molenkriteshots): de woningen aan de Molenkrite nog eens nagelopen. In docs/screenshots/:

   molenkrite_punt_voor.png   Molenkrite 133–143 recht van voren, vanaf het parkeerterrein (zoals "139 Molenkrite")
   molenkrite_balkon.png      Molenkrite 145–157: grijsbruine steen met om de woning een balkon
   molenkrite_gras.png        vanaf waar de gebruiker stond (435.3, 75.6), beide rijen

 Gebruik: npm run server &  node tools/molenkriteshots.mjs [poort] [map]
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
await page.evaluate(async () => { window.__W = await import('/js/world.js'); window.__game.reliëfAf(); });

const foto = async (naam, van, naar, uur = 13) => {
  const data = await page.evaluate(([van, naar, uur]) => {
    const g = window.__game, C = g.camera;
    document.getElementById('overlay').style.display = 'none'; document.getElementById('ui').style.display = 'none';
    g.player.active = false; g.sfeer.uur = uur; g.sfeer.weer = 'helder';
    for (let i = 0; i < 3; i++) g.sfeer.update(0.1, van[0], van[2]);
    C.position.set(...van); C.lookAt(...naar); C.updateMatrixWorld(true);
    // de hemelbol hangt om de camera
    g.scene.traverse(o => { if (o.material && o.material.uniforms && o.material.uniforms.maanDir) o.position.copy(C.position); });
    window.__W.updateLOD(van[0], van[2]); g.scene.updateMatrixWorld(true); g.renderer.shadowMap.needsUpdate = true;
    g.renderer.render(g.scene, C); g.renderer.render(g.scene, C);
    return g.renderer.domElement.toDataURL('image/png');
  }, [van, naar, uur]);
  writeFileSync(`${map}/${naam}.png`, Buffer.from(data.split(',')[1], 'base64'));
  console.log(`${map}/${naam}.png`);
};

await foto('molenkrite_punt_voor', [423.5, 1.7, 105], [404, 4.8, 93]);
await foto('molenkrite_balkon', [438, 1.7, 52], [415, 4.2, 54]);
await foto('molenkrite_gras', [435.3, 1.7, 75.6], [409, 4.5, 82]);

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);
