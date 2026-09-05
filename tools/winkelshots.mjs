/*
 Foto's van de boerderijwinkel bij Tinga State (js/boerderij.js).

   tinga_state_deur.png   buiten voor de schuurdeur, met de hint in beeld
   boerderij_deel.png     binnen: de deel met de kap van de stelpboerderij
   boerderij_toonbank.png de verkoper achter zijn toonbank, met de prijs

 Gebruik: python3 -m http.server 8123 &  node tools/winkelshots.mjs 8123 [map]
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
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
await page.evaluate(() => {
  localStorage.removeItem('tinga.spel.v1');
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
  // kijk vanaf `van` naar `naar`
  window.__kijk = (van, naar, pitch = 0) => {
    g.player.inCar = null;
    g.player.pos.set(van.x, 0, van.z);
    g.player.yaw = Math.atan2(-(naar.x - van.x), -(naar.z - van.z));
    g.player.pitch = pitch;
    g.player.applyCamera();
  };
});
await page.waitForTimeout(1500);

const foto = async (naam) => {
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 180000 });
  console.log(`${map}/${naam}.png`);
};

// 1. buiten voor de schuurdeur
await page.evaluate(() => {
  const g = window.__game, p = g.boerderij.plekken;
  const ver = { x: p.deurBuiten.x + (p.stoep.x - p.deurBuiten.x) * 1.4,
                z: p.deurBuiten.z + (p.stoep.z - p.deurBuiten.z) * 1.4 };
  window.__kijk(ver, p.deurBuiten, 0.06);
  g.boerderij.update(0.1, false);
});
await foto('tinga_state_deur');

// 2. binnen op de deel, met de kap in beeld
await page.evaluate(() => {
  const g = window.__game, b = g.boerderij, p = b.plekken, m = b.maten;
  window.__kijk({ x: p.nul.x + m.breed * 0.72, z: p.nul.z + m.diep * 0.72 }, p.toonbank, 0.04);
  b.update(0.1, false);
});
await foto('boerderij_deel');

// 3. aan de toonbank
await page.evaluate(() => {
  const g = window.__game, b = g.boerderij, p = b.plekken;
  const v = b.verkoper.groep.position;
  window.__kijk({ x: p.toonbank.x, z: p.toonbank.z - 1.4 }, { x: v.x, z: v.z }, -0.02);
  b.update(0.1, false);
});
await foto('boerderij_toonbank');

await browser.close();
