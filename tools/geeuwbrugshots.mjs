/*
 Foto's bij stap 161 (npm run geeuwbrugshots): de oude Geeuwbrug, het betonnen landhoofd met het brugwachtershuisje aan
 de Geeuw. In docs/screenshots/:

   geeuwbrug_lang.png    de lange zijkant met de graffiti en het torentje rechts, vanaf waar de gebruiker stond
                         (−77,4, −459,8), net als zijn schermafdruk
   geeuwbrug_kop.png     de kop aan het water met het torentje en het bordje "Geeuwbrug"
   geeuwbrug_boven.png   van boven, om naast de luchtfoto te leggen
   geeuwbrug_cabine.png  de cabine dichtbij: blauwe kozijnen, kapotte ruiten, het bordje naar het fietspad

 Gebruik: node tools/server.mjs 8125 &  node tools/geeuwbrugshots.mjs [poort] [map]
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

/*
 `van` en `naar` zijn [x, y, z] in de wereld, of { u, y, v } in het assenstelsel van het landhoofd (u langs, 0 aan de
 landkant; v dwars, 0 aan de zijde van de toren).
*/
const foto = async (naam, van, naar, { fov = 60, uur = 13 } = {}) => {
  const data = await page.evaluate(([van, naar, fov, uur]) => {
    const g = window.__game, C = g.camera, A = g.geeuwbrug;
    const pt = (p) => Array.isArray(p) ? p : (() => { const w = A.wereld(p.u, p.y, p.v); return [w.x, w.y, w.z]; })();
    const v = pt(van), n = pt(naar);
    document.getElementById('overlay').style.display = 'none'; document.getElementById('ui').style.display = 'none';
    g.player.active = false; g.sfeer.uur = uur; g.sfeer.weer = 'helder';
    for (let i = 0; i < 3; i++) g.sfeer.update(0.1, v[0], v[2]);
    C.fov = fov; C.updateProjectionMatrix();
    C.up.set(0, 1, 0);
    if (Math.abs(v[0] - n[0]) < 0.01 && Math.abs(v[2] - n[2]) < 0.01) C.up.set(A.assen.e[0], 0, A.assen.e[1]);
    C.position.set(...v); C.lookAt(...n); C.updateMatrixWorld(true);
    // de hemelbol hangt om de camera
    g.scene.traverse(o => { if (o.material && o.material.uniforms && o.material.uniforms.maanDir) o.position.copy(C.position); });
    window.__W.updateLOD(v[0], v[2]); g.scene.updateMatrixWorld(true); g.renderer.shadowMap.needsUpdate = true;
    g.renderer.render(g.scene, C); g.renderer.render(g.scene, C);
    const url = g.renderer.domElement.toDataURL('image/png');
    C.up.set(0, 1, 0); C.fov = 60; C.updateProjectionMatrix();
    return url;
  }, [van, naar, fov, uur]);
  writeFileSync(`${map}/${naam}.png`, Buffer.from(data.split(',')[1], 'base64'));
  console.log(`${map}/${naam}.png`);
};

const er = await page.evaluate(async () => { await window.__game.voorbereidSpel(); return !!window.__game.geeuwbrug; });
if (!er) { console.log('FOUT: de Geeuwbrug is niet gebouwd'); await browser.close(); process.exit(1); }
await foto('geeuwbrug_lang', [-77.4, 1.7, -459.8], { u: 15.5, y: 2.6, v: 4 }, { fov: 75 });
await foto('geeuwbrug_kop', { u: 44, y: 3.2, v: -6 }, { u: 27, y: 5.0, v: 2.5 });
await foto('geeuwbrug_boven', { u: 14.6, y: 75, v: 4.1 }, { u: 14.6, y: 0, v: 4.1 }, { fov: 35 });
await foto('geeuwbrug_cabine', { u: 25, y: 6.5, v: 10.5 }, { u: 28.6, y: 6.6, v: 1.6 });

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);
