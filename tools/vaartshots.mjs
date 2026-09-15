/*
 Foto's van de lading over het water:

   1. de sloep in IJlst, waar de partij klaarligt
   2. de lading in de kuip, van de stuurstand af
   3. onderweg over de Geeuw, met de vaarroute op de kaart
   4. de kade bij de waterzuivering, waar hij van boord gaat

 De camera is hier de sloep zelf: zit je in een boot, dan zet js/boot.js elk beeld
 je plek op de boot terug, dus een losse vliegcamera wordt meteen overschreven.

 Gebruik: npm run server &   node tools/vaartshots.mjs 8123 [map]
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const poort = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
mkdirSync(map, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game && window.__game.vaart, null, { timeout: 300000 });

const foto = async (naam) => {
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 300000 });
  console.log(`${map}/${naam}.png`);
};

await page.evaluate(() => {
  const g = window.__game;
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true;
  g.sfeer.uur = 12; g.sfeer.weer = 'helder';
  g.player.wapenUit = true; if (g.player.gun) g.player.gun.visible = false;
  window.__loop = (n) => { for (let i = 0; i < n; i++) { g.boten.update(1 / 30, null); g.vaart.update(1 / 30); } };
  // vanaf de wal naar een punt kijken, zonder boot eronder
  window.__kijkVanaf = (doel, afst, hoog, hoek, mikY = 0.6) => {
    const x = doel.x + Math.cos(hoek) * afst, z = doel.z + Math.sin(hoek) * afst;
    g.player.fly = true;
    g.player.pos.set(x, hoog, z);
    g.player.yaw = Math.atan2(-(doel.x - x), -(doel.z - z));
    g.player.pitch = Math.atan2(mikY - hoog, Math.hypot(doel.x - x, doel.z - z));
    g.player.updateFly(0);
  };
});

// ---- 1: de sloep in IJlst, met de opdracht in beeld
await page.evaluate(() => {
  const g = window.__game;
  g.vaart.herstel(null);
  g.boten.naarLigplaats(1);
  g.vaart.forceer('ophalen');
  window.__loop(10);
  const b = g.boten.ruw(1);
  window.__kijkVanaf({ x: b.x, z: b.z }, 14, 4.0, 2.4, 0.4);
});
await foto('vaart_ijlst');

// ---- 2: de lading in de kuip
await page.evaluate(() => {
  const g = window.__game;
  g.boten.stapIn(g.boten.ruw(1));
  window.__loop(10);
  const b = g.boten.inBoot;
  g.player.fly = false;
  g.player.yaw = b.yaw;
  g.player.pitch = -0.45;               // naar je voeten kijken: daar ligt het
  g.player.applyCamera();
});
await foto('vaart_lading');

// ---- 3: onderweg over de Geeuw
await page.evaluate(() => {
  const g = window.__game;
  const b = g.boten.inBoot;
  g.boten.verplaats(b, 1650, 1390, -0.785);
  window.__loop(10);
  g.player.yaw = b.yaw; g.player.pitch = -0.03;
  g.player.applyCamera();
  g.hud.update(0.016, g.player, g.vehicles, g.npcs, '', null);
});
await foto('vaart_onderweg');

// ---- 4: de kade bij de waterzuivering
await page.evaluate(() => {
  const g = window.__game;
  const b = g.boten.inBoot, doel = g.vaart.afleverPlek;
  // net buiten de afleverafstand, met de kade recht vooruit
  const hoek = Math.atan2(b.z - doel.z, b.x - doel.x);
  g.boten.verplaats(b, doel.x + Math.cos(hoek) * 16, doel.z + Math.sin(hoek) * 16,
    Math.atan2(-(doel.x - b.x), -(doel.z - b.z)));
  window.__loop(2);
  const c = g.boten.inBoot;
  g.player.yaw = c.yaw; g.player.pitch = -0.05;
  g.player.applyCamera();
});
await foto('vaart_kade');

await browser.close();
