/*
 Foto's bij stap 159 (npm run aaffshots): het kantoor aan het water naast de loods van Bouwman. In docs/screenshots/:

   aaff_water.png        vanaf de overkant, waar de gebruiker stond (1541.9, −136.4)
   aaff_hoek.png         schuin van voren, met de hal erachter
   aaff_nacht.png        's nachts: de logo's aaff. en Excellente lichtgevend
   aaff_logo_nacht.png   's nachts dichtbij de waterkant

 Gebruik: npm run server &  node tools/aaffshots.mjs [poort] [map]
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
    if (g.aaff) g.aaff.update(10, g.sfeer.nacht);
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

await foto('aaff_water', [1541.9, 1.7, -136.4], [1561, 4, -168]);
await foto('aaff_hoek', [1580, 2.5, -147], [1563, 5, -167]);
await foto('aaff_nacht', [1550, 2.0, -142], [1561, 5, -165], 1);
await foto('aaff_logo_nacht', [1561, 8, -151], [1561, 9.8, -161], 1);

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);
