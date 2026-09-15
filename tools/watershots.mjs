/*
 Foto's van de politie op het water:

   1. de politiesloep van opzij, met het zwaailicht en de twee agenten
   2. de achtervolging: hij komt achter je aan over de Geeuw
   3. langszij, zoals je hem vanaf je eigen helmstok ziet
   4. en wat je op de kaart ziet: de blauwe stip komt over het water mee

 Let op de camera. Zit je in een boot, dan zet js/boot.js elk beeld je plek op de
 boot terug — een losse vliegcamera wordt dus meteen weer overschreven. Daarom is
 hier de sloep zélf de camera: hij wordt met `verplaats` neergezet en jij kijkt
 vanaf de stuurstand. Je eigen boeg staat daardoor in beeld, en dat is precies
 wat je ook ziet als het je overkomt.

 Gebruik: npm run server &   node tools/watershots.mjs 8123 [map]
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
await page.waitForFunction(() => window.__game && window.__game.politieboot, null, { timeout: 300000 });

const foto = async (naam) => {
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 300000 });
  console.log(`${map}/${naam}.png`);
};

await page.evaluate(() => {
  const g = window.__game;
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true;
  g.sfeer.uur = 13; g.sfeer.weer = 'helder';
  g.player.wapenUit = true; if (g.player.gun) g.player.gun.visible = false;
  g.boten.stapIn(g.boten.ruw(0));
  g.boten.verplaats(g.boten.inBoot, 1650, 1390, -0.785);
  g.politie.zetHeat(300);
  window.__loop = (n) => { for (let i = 0; i < n; i++) { g.boten.update(1 / 30, null); g.politieboot.update(1 / 30); } };
  /*
   De eigen sloep op een plek `afst` meter van de politieboot zetten, onder hoek
   `hoek`, met de blik erop. `pitch` is een beetje omlaag: je staat op negentig
   centimeter en het water ligt lager.
  */
  window.__kijkVanaf = (afst, hoek, pitch = -0.04) => {
    const p = g.politieboot.plek, jij = g.boten.inBoot;
    const x = p.x + Math.cos(hoek) * afst, z = p.z + Math.sin(hoek) * afst;
    const yaw = Math.atan2(-(p.x - x), -(p.z - z));
    g.boten.verplaats(jij, x, z, yaw);
    g.boten.update(1 / 30, null);
    g.player.yaw = yaw; g.player.pitch = pitch;
    g.player.applyCamera();
  };
});

// hij moet er eerst zijn, en een eind onderweg
await page.evaluate(() => window.__loop(150));

// ---- 1: van opzij
await page.evaluate(() => {
  document.getElementById('ui').style.display = 'none';
  window.__kijkVanaf(8, 1.9, -0.05);
});
await foto('politieboot_opzij');

// ---- 2: hij komt achter je aan
await page.evaluate(() => {
  window.__loop(60);
  window.__kijkVanaf(21, 0.4, -0.03);
});
await foto('politieboot_achtervolging');

// ---- 3: langszij
await page.evaluate(() => {
  window.__loop(40);
  window.__kijkVanaf(8.5, 2.6, -0.06);
});
await foto('politieboot_langszij');

// ---- 4: en op de kaart
await page.evaluate(() => {
  const g = window.__game;
  document.getElementById('ui').style.display = '';
  g.hud.zetPolitie([...g.politie.plekken, { ...g.politieboot.plek, wagen: true }]);
  g.hud.update(0.016, g.player, g.vehicles, g.npcs, '', null);
});
await foto('politieboot_kaart');

await browser.close();
