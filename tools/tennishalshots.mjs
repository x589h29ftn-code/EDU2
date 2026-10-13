/*
 Foto's bij stap 162 (npm run tennishalshots): Tennishal Sneek aan de Lemmerweg 130a. In docs/screenshots/:

   tennishal_entree.png   vanaf het pad bij de entree, waar de gebruiker stond (597.5, 158.2): de puntgevel en de witte aanbouw
   tennishal_lang.png     de lange zuidgevel recht van voren, met de kruisen en de plint
   tennishal_boven.png    van boven, ter vergelijking met de luchtfoto (noord boven)

 Gebruik: npm run server &  node tools/tennishalshots.mjs [poort] [map]
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
const maten = await page.evaluate(async () => {
  window.__W = await import('/js/world.js');
  const { TENNISHAL_PAND } = await import('/js/tennishal.js');
  window.__T = TENNISHAL_PAND.nu;
  window.__game.reliëfAf();
  const A = window.__T, M = A.maten;
  const pt = (u, y, w) => { const v = A.wereld(u, y, w); return [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)]; };
  return { midden: pt(M.L / 2, 0, M.D / 2), langVan: pt(M.L * 0.45, 3.0, M.D + 32), langNaar: pt(M.L * 0.45, 4.5, M.D) };
});

const foto = async (naam, van, naar, { uur = 13, boven = false, fov = null } = {}) => {
  const data = await page.evaluate(([van, naar, uur, boven, fov]) => {
    const g = window.__game, C = g.camera;
    document.getElementById('overlay').style.display = 'none'; document.getElementById('ui').style.display = 'none';
    g.player.active = false; g.sfeer.uur = uur; g.sfeer.weer = 'helder';
    for (let i = 0; i < 3; i++) g.sfeer.update(0.1, van[0], van[2]);
    const fovWas = C.fov; if (fov) { C.fov = fov; C.updateProjectionMatrix(); }
    C.up.set(0, 1, 0); if (boven) C.up.set(0, 0, -1);
    C.position.set(...van); C.lookAt(...naar); C.updateMatrixWorld(true);
    // de hemelbol hangt om de camera
    g.scene.traverse(o => { if (o.material && o.material.uniforms && o.material.uniforms.maanDir) o.position.copy(C.position); });
    window.__W.updateLOD(boven ? naar[0] : van[0], boven ? naar[2] : van[2]); g.scene.updateMatrixWorld(true); g.renderer.shadowMap.needsUpdate = true;
    g.renderer.render(g.scene, C); g.renderer.render(g.scene, C);
    const url = g.renderer.domElement.toDataURL('image/png');
    C.up.set(0, 1, 0); if (fov) { C.fov = fovWas; C.updateProjectionMatrix(); }
    return url;
  }, [van, naar, uur, boven, fov]);
  writeFileSync(`${map}/${naam}.png`, Buffer.from(data.split(',')[1], 'base64'));
  console.log(`${map}/${naam}.png`);
};

await foto('tennishal_entree', [597.5, 1.7, 158.2], [618, 4.5, 143]);
await foto('tennishal_lang', maten.langVan, maten.langNaar);
await foto('tennishal_boven', [maten.midden[0] - 8, 120, maten.midden[2] + 6], [maten.midden[0] - 8, 0, maten.midden[2] + 5.9], { boven: true, fov: 45 });

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);
