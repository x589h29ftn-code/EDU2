/*
 Foto's bij stap 177 (npm run tigershots): de gedenkplek voor de Slag om Sneek aan de Sudergoweg en de Tiger. In docs/screenshots/:

   tiger_plek.png     vanaf het fietspad bij de dam: de tegelvloer, de steen en de Tiger in het weiland
   tiger_voor.png     schuin van voren: de voorplaat, het kanon met de mondingsrem, de rupsen
   tiger_zij.png      van opzij: de geschachtelde loopwielen, het aandrijfwiel, het spanwiel, de koepel
   tiger_achter.png   schuin van achteren: de uitlaten, de luchtfilters, de Rommelkiste
   tiger_steen.png    de gedenksteen met de bronzen plaat
   tiger_binnen.png          erin: langs de loop, de koepel naar rechts gedraaid, met het vizier
   tiger_binnen_schot.png    binnen net na het schot: de vlam, de terugslag, HERLADEN
   tiger_binnen_herladen.png vier tellen later, de balk half
   tiger_schot.png           van buiten, net na een schot (de mondingsvlam)
   tiger_inslag.png          de inslag op een auto op 45 m
   tiger_kritiek.png         bijna kapot: rook, vlammen en het rode alarm

 Gebruik: npm run server &  node tools/tigershots.mjs [poort] [map]   (FOTO=<naam> voor één foto)
*/
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const poort = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
const alleen = process.env.FOTO || null;
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

const render = async (naam, zet, metHud = false) => {
  if (alleen && alleen !== naam && !(alleen === 'binnen' && naam.startsWith('tiger_binnen'))) return;
  const data = await page.evaluate(([zetStr]) => {
    const g = window.__game, C = g.camera, T = g.tiger;
    document.getElementById('overlay').style.display = 'none';
    g.sfeer.uur = 14; g.sfeer.weer = 'helder';
    const s = T.stand, fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw), rx = Math.cos(s.yaw), rz = -Math.sin(s.yaw);
    const zet = new Function('g', 'C', 'T', 's', 'fx', 'fz', 'rx', 'rz', zetStr);
    zet(g, C, T, s, fx, fz, rx, rz);
    for (let i = 0; i < 3; i++) g.sfeer.update(0.1, C.position.x, C.position.z);
    g.scene.traverse(o => { if (o.material && o.material.uniforms && o.material.uniforms.maanDir) o.position.copy(C.position); });
    window.__W.updateLOD(C.position.x, C.position.z); g.scene.updateMatrixWorld(true); g.renderer.shadowMap.needsUpdate = true;
    C.updateMatrixWorld(true);
    g.renderer.render(g.scene, C); g.renderer.render(g.scene, C);
    return g.renderer.domElement.toDataURL('image/png');
  }, [zet]);
  // met de hud (het vizier, herladen, het alarm): een schermafdruk van de pagina, met het beeld net getekend
  if (metHud) await page.screenshot({ path: `${map}/${naam}.png` });
  else writeFileSync(`${map}/${naam}.png`, Buffer.from(data.split(',')[1], 'base64'));
  console.log(`${map}/${naam}.png`);
};
const kijk = (van, naar) => `C.position.set(${van}); C.lookAt(${naar});`;

await render('tiger_plek', `T.zetTerug(); T.update(0.05); C.position.set(48.5, 1.7, 1079.5); C.lookAt(T.gedenk.groep.position.x, 1.2, T.gedenk.groep.position.z);`);
await render('tiger_voor', `T.update(0.05); C.position.set(s.x + fx * 8.5 + rx * 4.5, 2.2, s.z + fz * 8.5 + rz * 4.5); C.lookAt(s.x + fx * 1.5, 1.5, s.z + fz * 1.5);`);
await render('tiger_zij', `T.update(0.05); C.position.set(s.x + rx * 8.5 - fx * 0.5, 1.4, s.z + rz * 8.5 - fz * 0.5); C.lookAt(s.x, 1.3, s.z);`);
await render('tiger_achter', `T.update(0.05); C.position.set(s.x - fx * 8.5 - rx * 4.5, 3.0, s.z - fz * 8.5 - rz * 4.5); C.lookAt(s.x, 1.5, s.z);`);
await render('tiger_steen', `const st = T.gedenk.steen; st.updateMatrixWorld(true); const p = st.getWorldPosition(new C.position.constructor()); const q = st.localToWorld(new C.position.constructor(0, 0.9, 2.4)); C.position.copy(q); C.lookAt(p.x, p.y + 0.75, p.z);`);
await page.evaluate(() => { const ui = document.getElementById('ui'); if (ui) ui.style.display = ''; for (const id of ['hud', 'minimap', 'kaart']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } });
await render('tiger_binnen', `
  window.__autoplay = true; g.player.active = true; g.player.inCar = null;
  g.player.pos.set(s.x + rx * 2.8, 0.2, s.z + rz * 2.8);
  T.toets();
  g.player.yaw = s.yaw + 0.5; g.player.pitch = 0.02;
  for (let i = 0; i < 40; i++) T.update(0.05);
  T.zetCamera();`, true);
// net na het schot, binnen: de vlam voor de loop, het oog schiet terug, HERLADEN 8,0 s
await render('tiger_binnen_schot', `
  g.player.yaw = s.yaw; g.player.pitch = 0.03;
  for (let i = 0; i < 60; i++) T.update(0.05);
  T.vuur(); T.update(0.03); T.zetCamera();`, true);
// vier seconden later: de balk half vol
await render('tiger_binnen_herladen', `for (let i = 0; i < 80; i++) T.update(0.05); T.zetCamera();`, true);
// van buiten, recht na het schot
await render('tiger_schot', `
  g.player.yaw = s.yaw; g.player.pitch = 0.04;
  for (let i = 0; i < 40; i++) T.update(0.05);
  T.vuur(); T.update(0.02);
  C.position.set(s.x + rx * 9 + fx * 3, 2.6, s.z + rz * 9 + fz * 3); C.lookAt(s.x + fx * 4, 2.0, s.z + fz * 4);`);

// de inslag: een auto op 45 m voor de loop, van buiten gezien
await render('tiger_inslag', `
  for (let i = 0; i < 180; i++) T.update(0.05);
  const q = T.stand, fx2 = -Math.sin(q.yaw + q.koepel), fz2 = -Math.cos(q.yaw + q.koepel);
  const o = T.T.monding.getWorldPosition(C.position.clone());
  const auto = g.vehicles.voegToe({ x: o.x + fx2 * 45, z: o.z + fz2 * 45, yaw: 0, soort: 'hatch' });
  auto.mesh.position.set(auto.x, 0, auto.z); g.scene.updateMatrixWorld(true);
  g.player.pitch = -0.035; for (let i = 0; i < 30; i++) T.update(0.05);
  T.vuur(); for (const k of g.tigerKnallen) k.update(0.15);
  if (!g.derde.aan) g.derde.wissel();
  g.player.yaw = q.yaw + q.koepel + 0.35; g.player.pitch = -0.05;
  T.zetCamera();`, true);
// bijna kapot: rook, vlammen en het rode alarm
await render('tiger_kritiek', `
  T.raak(T.leven - 35);
  g.player.yaw = T.stand.yaw + 0.6; g.player.pitch = -0.12;
  for (let i = 0; i < 30; i++) T.update(0.05);
  T.zetCamera();`, true);

await page.evaluate(() => { const T = window.__game.tiger; T.uit(); window.__autoplay = false; window.__game.player.active = false; });
await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);
