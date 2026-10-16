/*
 Foto's bij stap 204 (npm run yugoshots): Yugo van binnen.

   yugo_zaal     de zaal vanaf de ingang: het logo, de blauwe bank, de emmerlampen, het hek, de ronde tafels
   yugo_tafel    aan tafel: Johan op de bank, het verlichte logo achter hem, de sushi en de cocktails op tafel
   yugo_tablet   de tablet met het menu open
   yugo_eten     een stuk sushi tussen de stokjes

 Gebruik: npm run server &  node tools/yugoshots.mjs [poort]   (FOTO=yugo_tafel voor één foto)
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
const alleen = process.env.FOTO ? process.env.FOTO.split(',') : null;
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(900000);
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, v = g.verhaal;
  await g.voorbereidSpel();
  g.player.active = false; window.__autoplay = false;
  g.politie.proefStil = true;
  v.startYugo();
  for (let i = 0; i < 10; i++) v.update(0.05);
  // alle balken weg voor de foto's
  window.__schoon = () => { for (const id of ['dialoog', 'praat', 'opdracht']) { const e = document.getElementById(id); if (e) e.hidden = true; }
    // binnen is het wapen weg (in het spel zet de hoofdlus `binnen`; hier staat het spel stil)
    g.player.binnen = true; if (g.player.gun) g.player.gun.visible = false; };
  window.__teken = () => { g.scene.updateMatrixWorld(true); g.renderer.render(g.scene, g.camera); };
});
// de hoofdlus tekent het beeld (een eigen render zonder preserveDrawingBuffer komt zwart op de foto); het verhaal staat even stil
const foto = async (naam) => {
  await page.evaluate(() => { const v = window.__game.verhaal; if (!v.__echt) { v.__echt = v.update; v.update = () => {}; } window.__schoon(); });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `docs/screenshots/${naam}.png` });
  await page.evaluate(() => { const v = window.__game.verhaal; if (v.__echt) { v.update = v.__echt; v.__echt = null; } });
  console.log('foto', naam);
};
const wil = (n) => !alleen || alleen.includes(n);

if (wil('yugo_tablet')) {
  await page.evaluate(() => { const g = window.__game; window.__schoon(); g.yugo.kies(1); g.yugo.kies(3); g.yugo.kies(3); g.yugo.kies(5); g.player.applyCamera(); window.__teken(); });
  await foto('yugo_tablet');
}
// bestellen en wachten tot alles op tafel staat
await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, y = g.yugo;
  y.kies(6);
  for (let i = 0; i < 3000 && y.stand.fase !== 'eten'; i++) v.update(0.05);
  for (let i = 0; i < 4; i++) v.update(0.05);
});
if (wil('yugo_tafel')) {
  await page.evaluate(() => { const g = window.__game; window.__schoon(); g.player.yaw = 0; g.player.pitch = -0.22; g.player.applyCamera(); window.__teken(); });
  await foto('yugo_tafel');
}
if (wil('yugo_eten')) {
  await page.evaluate(() => {
    const g = window.__game, v = g.verhaal, y = g.yugo;
    g.player.yaw = 0; g.player.pitch = -0.22; g.player.applyCamera();
    y.eet();
    // halverwege naar de mond: het stuk zit tussen de stokjes
    for (let i = 0; i < 40 && y.stand.stok !== 'mond'; i++) v.update(0.03);
    for (let i = 0; i < 6; i++) v.update(0.03);
    window.__schoon(); window.__teken();
  });
  await foto('yugo_eten');
}
if (wil('yugo_zaal')) {
  await page.evaluate(() => {
    const g = window.__game, y = g.yugo, n = y.plekken.nul, P = g.player;
    // vanaf de ingang, op ooghoogte, schuin over de zaal naar het logo (via de speler: de hoofdlus zet de camera)
    P.zit = false; P.eye = P.eyeStaand;
    P.pos.set(n.x + 3.6, 0, n.z + 8.9);
    P.yaw = Math.atan2(-(9.5 - 3.6), -(0.5 - 8.9)); P.pitch = -0.08;
    P.applyCamera();
    document.getElementById('yugoTablet').hidden = true;
  });
  await foto('yugo_zaal');
}
await browser.close();
console.log('klaar');
