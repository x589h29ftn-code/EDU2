/*
 Foto's bij stap 160 (npm run bpshots): de shop van de BP aan de Lemmerweg. In docs/screenshots/:

   bp_buiten.png     van onder de luifel naar de shop: baksteen, de groene boeiboord met "shop", de glazen pui
   bp_deur.png       vlak voor de schuifdeuren, open
   bp_binnen.png     binnen vanaf de deur: de gondels, de koelvitrine, ZOETWAREN achterin
   bp_balie.png      de balie met de medewerker, de tabakswand erachter
   bp_nacht.png      's avonds van buiten
   bp_pomp.png       een pomp van dichtbij: display, producten, pistolen en slangen
   bp_pompen.png     de pompeilanden onder de luifel
   bp_details.png    binnen: de mandjes, de deurmat, het tijdschriftenrek, het menubord

 Gebruik: npm run server &  node tools/bpshots.mjs [poort] [map]
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
await page.evaluate(async () => { window.__W = await import('/js/world.js'); window.__game.reliëfAf(); await window.__game.voorbereidSpel(); });

// van en naar in het eigen assenstelsel van de shop: [u, y, w]
const foto = async (naam, van, naar, uur = 13, deurOpen = false) => {
  const data = await page.evaluate(([van, naar, uur, deurOpen]) => {
    const g = window.__game, C = g.camera, S = g.bpshop, P = S.wereld;
    document.getElementById('overlay').style.display = 'none'; document.getElementById('ui').style.display = 'none';
    g.player.active = false; g.sfeer.uur = uur; g.sfeer.weer = 'helder';
    const [vx, vz] = P(van[0], van[2]), [nx, nz] = P(naar[0], naar[2]);
    for (let i = 0; i < 30; i++) g.sfeer.update(0.1, vx, vz);
    const deur = deurOpen ? { x: S.deur.x, z: S.deur.z, y: 0 } : { x: S.deur.x + 99, z: S.deur.z, y: 0 };
    for (let i = 0; i < 40; i++) S.update(0.05, [deur]);
    S.update(0.05, [deur, { x: vx, z: vz, y: 0 }].slice(deurOpen ? 0 : 1));
    S.medewerker.kijkNaar(vx, vz, 10, 10);
    C.position.set(vx, van[1], vz); C.lookAt(nx, naar[1], nz); C.updateMatrixWorld(true);
    g.scene.traverse(o => { if (o.material && o.material.uniforms && o.material.uniforms.maanDir) o.position.copy(C.position); });
    window.__W.updateLOD(vx, vz); g.scene.updateMatrixWorld(true); g.renderer.shadowMap.needsUpdate = true;
    g.renderer.render(g.scene, C); g.renderer.render(g.scene, C);
    return g.renderer.domElement.toDataURL('image/png');
  }, [van, naar, uur, deurOpen]);
  writeFileSync(`${map}/${naam}.png`, Buffer.from(data.split(',')[1], 'base64'));
  console.log(`${map}/${naam}.png`);
};

await foto('bp_buiten', [6, 1.7, -14], [11, 2.4, 0]);
await foto('bp_deur', [14.7, 1.7, -4.5], [14.7, 1.4, 4], 13, true);
await foto('bp_binnen', [14.2, 1.65, 0.4], [14.2, 1.2, 12]);
await foto('bp_balie', [8.6, 1.65, 2.2], [4.8, 1.3, 7.5]);
await foto('bp_nacht', [8, 1.7, -16], [11, 2.4, 0], 22);

// de pompen: vanaf de eerste pomp gerekend (dx, y, dz) en kijkend naar (dx, y, dz)
const fotoPomp = async (naam, van, naar) => {
  const data = await page.evaluate(([van, naar]) => {
    const g = window.__game, C = g.camera; let pm = null;
    g.scene.traverse(o => { if (!pm && o.name === 'pomp') pm = o; });
    const THREE = C.position.constructor, w = new THREE(); pm.getWorldPosition(w);
    g.player.active = false; g.sfeer.uur = 13; for (let i = 0; i < 30; i++) g.sfeer.update(0.1, w.x, w.z);
    C.position.set(w.x + van[0], van[1], w.z + van[2]); C.lookAt(w.x + naar[0], naar[1], w.z + naar[2]); C.updateMatrixWorld(true);
    g.scene.traverse(o => { if (o.material && o.material.uniforms && o.material.uniforms.maanDir) o.position.copy(C.position); });
    window.__W.updateLOD(w.x, w.z); g.scene.updateMatrixWorld(true); g.renderer.shadowMap.needsUpdate = true;
    g.renderer.render(g.scene, C); g.renderer.render(g.scene, C);
    return g.renderer.domElement.toDataURL('image/png');
  }, [van, naar]);
  writeFileSync(`${map}/${naam}.png`, Buffer.from(data.split(',')[1], 'base64'));
  console.log(`${map}/${naam}.png`);
};
await foto('bp_details', [11.5, 1.6, 2.2], [6.5, 0.9, 0.6]);
// welke kant de displays op kijken hangt aan de draaiing van de luifel: twee standpunten, schuin
await fotoPomp('bp_pomp', [1.6, 1.5, 1.9], [0, 1.0, 0]);
await fotoPomp('bp_pompen', [9, 2.6, 7], [0, 1.0, 0]);

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);
