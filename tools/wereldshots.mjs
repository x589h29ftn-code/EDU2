/*
 Foto's van de vergrote wereld (1330 × 1300 m, heel Tinga plus de buurt aan de
 overkant van de N7):

   wereld_kaart.png       de grote kaart (M) met de hele wereld erop
   wereld_overkant.png    een straat in de buurt aan de overkant van de N7
   wereld_zuid.png        de Partuurstraat, de zuidrand van het nieuwe gebied

 Gebruik: python3 -m http.server 8123 &  node tools/wereldshots.mjs 8123 [map]
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const port = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
mkdirSync(map, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });

await page.evaluate(() => {
  localStorage.removeItem('tinga.spel.v1');
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  g.sfeer.uur = 13;
  g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
  window.__zet = (x, z, yaw, pitch = 0) => {
    g.player.inCar = null; g.player.zit = false;
    g.player.pos.set(x, 0, z); g.player.yaw = yaw; g.player.pitch = pitch;
    g.player.applyCamera();
  };
});
await page.waitForTimeout(1500);

const foto = async (naam) => {
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 300000 });
  console.log(`${map}/${naam}.png`);
};

// 1. de grote kaart: hierop zie je in één keer hoe ver de wereld reikt
await page.evaluate(() => {
  const g = window.__game;
  window.__zet(0, 0, 0);
  g.hud.toggleBig();
});
await foto('wereld_kaart');
await page.evaluate(() => window.__game.hud.toggleBig());

// 2 en 3. twee straten in het nieuwe gebied, aan de overkant van de rondweg
for (const [naam, x, z, yaw] of [
  ['wereld_overkant', 443.64, -422.68, 3.05],   // Morrahemstraat
  ['wereld_zuid', 72.64, -548.43, 2.45],        // Partuurstraat
]) {
  await page.evaluate(([x, z, yaw]) => window.__zet(x, z, yaw, -0.03), [x, z, yaw]);
  await foto(naam);
}

await browser.close();
