/*
 Foto's van de sloepen:

   1. de ligplaats aan de Geeuwkade, van de wal af
   2. de boot van schuin voren, laag boven het water
   3. de kuip: console, doften en de buitenboordmotor
   4. varend, met het schuim achter de schroef
   5. de steiger in IJlst met de tweede sloep

 Gebruik: npm run server &   node tools/bootshots.mjs 8123 [map]
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
await page.waitForFunction(() => window.__game && window.__game.boten, null, { timeout: 300000 });

const foto = async (naam) => {
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 300000 });
  console.log(`${map}/${naam}.png`);
};

await page.evaluate(() => {
  const g = window.__game;
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('ui').style.display = 'none';
  g.player.active = true;
  g.sfeer.uur = 13; g.sfeer.weer = 'helder';
  g.player.wapenUit = true; g.player.gun.visible = false;
  // de vrije camera: de hoofdlus zet de camera elk beeld op de speler terug
  g.player.fly = true;
  window.__kijk = (doel, afst, hoog, hoek = 0, mikY = 0.4) => {
    const x = doel.x + Math.cos(hoek) * afst, z = doel.z + Math.sin(hoek) * afst;
    g.player.pos.set(x, hoog, z);
    g.player.yaw = Math.atan2(-(doel.x - x), -(doel.z - z));
    g.player.pitch = Math.atan2(mikY - hoog, Math.hypot(doel.x - x, doel.z - z));
    g.player.updateFly(0);
  };
  window.__boot = (i) => g.boten.ruw(i);
  window.__vaar = (toetsen, n) => { for (let k = 0; k < n; k++) g.boten.update(1 / 60, toetsen); };
});

const geeuw = await page.evaluate(() => { const b = window.__boot(0); return { x: b.x, z: b.z }; });

// ---- 1: de ligplaats, van de wal af
await page.evaluate((b) => window.__kijk(b, 15, 4.2, 0.9, 0.3), geeuw);
await foto('boot_ligplaats');

// ---- 2: van schuin voren, laag boven het water
await page.evaluate((b) => window.__kijk(b, 9, 1.4, 2.4, 0.4), geeuw);
await foto('boot_voren');

// ---- 3: de kuip van bovenaf
await page.evaluate((b) => window.__kijk(b, 6.5, 4.6, 4.1, 0.1), geeuw);
await foto('boot_kuip');

/*
 4: varend, met het schuim erachter.

 Zolang je aan boord staat zet de hoofdlus de camera zelf achter de boot, dus de
 vrije cameraman moet eerst van boord. Daarom een stuk de Geeuw op varen en dan
 aan wal stappen: het schuim blijft nog even liggen, en dat is precies wat er op
 de foto moet.
*/
await page.evaluate(() => {
  const g = window.__game;
  g.boten.stapIn(window.__boot(0));
  window.__vaar({ KeyW: true }, 260);
  window.__vaar({ KeyW: true, KeyA: true }, 70);
  g.boten.stapUit();
  const b = window.__boot(0);
  // schuin van achteren: daar zie je het schuim achter de schroef liggen
  window.__kijk({ x: b.x, z: b.z }, 16, 5.0, Math.atan2(Math.cos(b.yaw), Math.sin(b.yaw)) + 0.6, 0.4);
});
await foto('boot_varend');

// ---- 5: IJlst
await page.evaluate(() => {
  const g = window.__game;
  g.boten.stapUit();
  const b = window.__boot(1);
  window.__kijk({ x: b.x, z: b.z }, 14, 3.8, 1.9, 0.4);
});
await foto('boot_ijlst');

await browser.close();
