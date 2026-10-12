/*
 Foto's bij stap 152 (npm run zuilengangshots): onder de zuilengang van de Poiesz in Duinterpen. In docs/screenshots/:

   zuilengang_gang.png    in de gang, langs de zuilen en de pui gekeken
   zuilengang_deuren.png  voor de schuifdeuren onder het woordmerk, de deuren open

 Gebruik: npm run server &  node tools/zuilengangshots.mjs [poort] [map]
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
  const g = window.__game;
  window.__W = await import('./js/world.js');
  window.__K = (await import('./js/kaart.js')).KAART;
  document.getElementById('overlay').style.display = 'none';
  g.player.active = false; window.__autoplay = false;
  if (g.reliëfAf) await g.reliëfAf();
  g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
  g.sfeer.uur = 15; g.sfeer.weer = 'helder';
  for (let i = 0; i < 3; i++) g.sfeer.update(0.1, 1290, 285);
});

const foto = async (naam, code) => {
  const data = await page.evaluate(new Function(`
    const g = window.__game, W = window.__W, K = window.__K, C = g.camera;
    const gang = K.zuilengangen.find(z => z.merk);
    const ing = g.supermarkt.ingangen.find(i => /duinterpen/i.test(i.naam));
    const deur = g.schuifdeuren[0];
    const kijk = (van, naar) => {
      C.position.set(van[0], van[1], van[2]); C.lookAt(naar[0], naar[1], naar[2]); C.updateMatrixWorld(true);
      // de hemelbol hangt om de camera (zie tools/politieslimshots.mjs)
      g.scene.traverse(o => { if (o.material && o.material.uniforms && o.material.uniforms.maanDir) o.position.copy(C.position); });
      W.updateLOD(C.position.x, C.position.z);
      g.scene.updateMatrixWorld(true); g.renderer.shadowMap.needsUpdate = true;
      g.renderer.render(g.scene, C); g.renderer.render(g.scene, C);
      return g.renderer.domElement.toDataURL('image/png');
    };
    ${code}
  `));
  writeFileSync(`${map}/${naam}.png`, Buffer.from(data.split(',')[1], 'base64'));
  console.log(`${map}/${naam}.png`);
};

// in de gang: bij een uiteinde van de boog, halverwege de diepte, langs de gang naar het midden
await foto('zuilengang_gang', `
  const b = gang.boog, n = gang.binnen[1], D = gang.diepte;
  const van = [b[1][0] + n[0] * D * 0.45, 1.65, b[1][1] + n[1] * D * 0.45];
  const m = b[Math.floor(b.length / 2) + 1], nm = gang.binnen[Math.floor(b.length / 2)];
  g.werkSchuifdeurenBij(2, [{ x: 1e5, z: 1e5 }]);
  return kijk(van, [m[0] + nm[0] * D * 0.55, 1.4, m[1] + nm[1] * D * 0.55]);
`);
// voor de deuren, open
await foto('zuilengang_deuren', `
  g.werkSchuifdeurenBij(2, [ing.stoep]);
  const van = [ing.deur.x + ing.f[0] * 7.5 + ing.f[1] * 2.0, 1.7, ing.deur.z + ing.f[1] * 7.5 - ing.f[0] * 2.0];
  return kijk(van, [ing.deur.x, 1.6, ing.deur.z]);
`);

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);
