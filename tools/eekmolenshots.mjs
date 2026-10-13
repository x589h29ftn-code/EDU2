/*
 Foto's bij stap 165 (npm run eekmolenshots): de garageboxen aan de Eekmolen en de puntgevels van het plan
 Eekmolen / de Loper / Molenkrite. In docs/screenshots/:

   eekmolen_garages.png       vanaf het parkeerterrein waar de gebruiker stond (332.0, 296.5), recht op de boxen
   eekmolen_garages_schuin.png schuin langs de rij
   eekmolen_punt.png          vanaf (323.5, 278.9) naar Eekmolen 1–3 aan de overkant
   eekmolen_punt_schuin.png   schuin langs de even kant (Eekmolen 4–8) met de bergingen
   eekmolen_loper.png         vanaf (325.9, 193.3) naar de Loper 29–31
   eekmolen_molenkrite.png    vanaf (435.3, 75.6) naar Molenkrite 135–143

 Gebruik: npm run server &  node tools/eekmolenshots.mjs [poort] [map]
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

await foto('eekmolen_garages', [332.0, 1.7, 296.5], [334, 1.8, 284]);
await foto('eekmolen_garages_schuin', [322, 1.7, 293], [340, 1.6, 284]);
await foto('eekmolen_punt', [323.5, 1.7, 278.9], [306, 4.5, 276]);
await foto('eekmolen_punt_schuin', [321, 1.7, 290], [332, 4.5, 268]);
await foto('eekmolen_loper', [325.9, 1.7, 193.3], [305, 4.5, 190]);
await foto('eekmolen_molenkrite', [435.3, 1.7, 75.6], [409, 4.5, 82]);

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);
