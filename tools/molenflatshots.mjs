/*
 Foto's bij stap 163 (npm run molenflatshots): de flats aan de Molenkrite. In docs/screenshots/:

   molenflat_straat.png      waar de gebruiker stond (399.9, -26.9), naar de westpunt van het zuidelijke blok
   molenflat_molenkrite.png  vanaf de Molenkrite tussen de twee blokken, naar het noordelijke: de lage vleugel links, de
                             berging met zijn blauwe boeiboord rechts en het trappenhuis ertussen (de Street View-foto)
   molenflat_noord.png       een paar meter westelijker: de hoge vleugel links, de lage rechts, de struiken ervoor (de
                             samenstelling van de schermafdruk van de gebruiker)
   molenflat_schuin.png      schuin van boven over beide blokken: de molenvorm, de trappen, de witte randen en de kappen
   molenflat_nacht.png       hetzelfde als de eerste, 's nachts: licht achter een derde van de ramen

 Gebruik: npm run server &  node tools/molenflatshots.mjs [poort] [map]
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
page.setDefaultTimeout(1800000);
let fouten = 0;
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 1800000 });
await page.evaluate(async () => {
  window.__W = await import('/js/world.js');
  await window.__game.voorbereidSpel();
  window.__game.reliëfAf();
});

const foto = async (naam, van, naar, { uur = 13, fov = null } = {}) => {
  const data = await page.evaluate(([van, naar, uur, fov]) => {
    const g = window.__game, C = g.camera, A = g.molenflat;
    document.getElementById('overlay').style.display = 'none'; document.getElementById('ui').style.display = 'none';
    g.player.active = false; g.sfeer.uur = uur; g.sfeer.weer = 'helder';
    for (let i = 0; i < 30; i++) g.sfeer.update(0.1, van[0], van[2]);
    for (let i = 0; i < 10; i++) A.update(0.5, g.sfeer.nacht);
    const fovWas = C.fov; if (fov) { C.fov = fov; C.updateProjectionMatrix(); }
    C.position.set(...van); C.lookAt(...naar); C.updateMatrixWorld(true);
    // de hemelbol hangt om de camera
    g.scene.traverse(o => { if (o.material && o.material.uniforms && o.material.uniforms.maanDir) o.position.copy(C.position); });
    window.__W.updateLOD(van[0], van[2]); g.scene.updateMatrixWorld(true); g.renderer.shadowMap.needsUpdate = true;
    g.renderer.render(g.scene, C); g.renderer.render(g.scene, C);
    const url = g.renderer.domElement.toDataURL('image/png');
    if (fov) { C.fov = fovWas; C.updateProjectionMatrix(); }
    return url;
  }, [van, naar, uur, fov]);
  writeFileSync(`${map}/${naam}.png`, Buffer.from(data.split(',')[1], 'base64'));
  console.log(`${map}/${naam}.png`);
};

const alleen = process.env.ALLEEN ? process.env.ALLEEN.split(',') : null;
const lijst = [
  ['molenflat_straat', [399.9, 1.7, -26.9], [417, 4.5, -37]],
  ['molenflat_molenkrite', [438, 1.7, -61.5], [429, 6, -86]],
  ['molenflat_noord', [418, 1.7, -57], [421, 4.5, -80]],
  ['molenflat_schuin', [388, 26, -8], [428, 3, -58], { fov: 55 }],
  ['molenflat_nacht', [399.9, 1.7, -26.9], [417, 4.5, -37], { uur: 1 }],
];
// EXTRA='[["naam", [x, y, z], [x, y, z]], …]' voor een paar losse standpunten (zoeken naar de kijkrichting)
if (process.env.EXTRA) lijst.push(...JSON.parse(process.env.EXTRA));
for (const [naam, van, naar, opties] of lijst) if (!alleen || alleen.includes(naam)) await foto(naam, van, naar, opties || {});

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);
