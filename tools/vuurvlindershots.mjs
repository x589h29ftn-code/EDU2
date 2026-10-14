/*
 Foto's bij stap 166 (npm run vuurvlindershots): de kubistische woningen aan de Vuurvlinder in Duinterpen
 (oneven 1–17, 31, 33). In docs/screenshots/:

   vuurvlinder_straat.png   vanaf de stoep voor nummer 3, waar de gebruiker stond (906.5, 324.5), in de blik van Street View
   vuurvlinder_rij.png      dezelfde plek, iets naar rechts: 5, 7 en 9 erachter
   vuurvlinder_schuin.png   schuin van boven, met de lage achterbouw en de hoge achterkant
   vuurvlinder_nacht.png    's avonds vanaf de straat

 Met `oud` als derde argument alleen vuurvlinder_oud.png (de stand van vóór de stap).
 Gebruik: npm run server &  node tools/vuurvlindershots.mjs [poort] [map] [oud]
*/
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const poort = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
const oud = process.argv[4] === 'oud';
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

const alleen = process.env.FOTO;   // FOTO=vuurvlinder_schuin maakt alleen die ene
const foto = async (naam, van, naar, uur = 13) => {
  if (alleen && alleen !== naam) return;
  const data = await page.evaluate(([van, naar, uur]) => {
    const g = window.__game, C = g.camera;
    document.getElementById('overlay').style.display = 'none'; document.getElementById('ui').style.display = 'none';
    g.player.active = false; g.sfeer.uur = uur; g.sfeer.weer = 'helder';
    for (let i = 0; i < (uur < 6 || uur > 20 ? 30 : 3); i++) g.sfeer.update(0.1, van[0], van[2]);
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

if (oud) {
  await foto('vuurvlinder_oud', [906.5, 1.7, 324.5], [931, 5.5, 326]);
} else {
  await foto('vuurvlinder_straat', [906.5, 1.7, 324.5], [931, 5.5, 326]);
  await foto('vuurvlinder_rij', [906.5, 1.7, 324.5], [928, 5, 340]);
  await foto('vuurvlinder_schuin', [911, 14, 362], [931, 4, 322]);
  await foto('vuurvlinder_nacht', [906.5, 1.7, 324.5], [931, 5.5, 326], 22.5);
}

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);
