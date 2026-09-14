/*
 Foto's van de ronde "over het vizier, opbergen en een schap met plaatjes":

   1. het pistool uit de heup
   2. hetzelfde pistool over het vizier — korrel in de keep, midden in beeld
   3. het machinegeweer uit de heup
   4. het machinegeweer over het vizier
   5. halverwege het wegbergen: het wapen zakt onder de onderrand weg
   6. het schap aan de toonbank bij Tinga State, met plaatjes, nummers en prijzen

 Gebruik: npm run server &   node tools/richtshots.mjs 8123 [map]
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
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });
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
  g.player.krijgWapen('mitrailleur');
  window.__laat = (n = 40, dt = 0.03) => { for (let i = 0; i < n; i++) g.player.update(dt); };
  window.__laat(60);
});

// ---- 1 en 2: het pistool
await page.evaluate(() => {
  const g = window.__game;
  g.player.zetWapen('pistool'); g.player.wisselT = 0; g.player.holster = 0;
  g.player.richten(false); window.__laat(60);
});
await foto('wapen_pistool_heup');
await page.evaluate(() => { window.__game.player.richten(true); window.__laat(40); });
await foto('wapen_pistool_vizier');

// ---- 3 en 4: het machinegeweer
await page.evaluate(() => {
  const g = window.__game;
  g.player.richten(false); window.__laat(30);
  g.player.zetWapen('mitrailleur'); g.player.wisselT = 0; g.player.holster = 0;
  window.__laat(40);
});
await foto('wapen_mp_heup');
await page.evaluate(() => { window.__game.player.richten(true); window.__laat(40); });
await foto('wapen_mp_vizier');

// ---- 5: halverwege het wegbergen
await page.evaluate(() => {
  const g = window.__game;
  g.player.richten(false); window.__laat(40);
  g.player.kiesWapen(1);
  // tot net over de helft van het wegbergen: dan hangt hij het diepst in beeld
  window.__laat(9, 0.02);
});
await foto('wapen_opbergen');

// ---- 5b: het herladen, in drie standen
await page.evaluate(() => {
  const g = window.__game;
  g.player.zetWapen('pistool'); g.player.wisselT = 0; g.player.holster = 0;
  g.player.reserve = 200; g.player.ammo = 0;
  window.__laat(40);
  /*
   De stand van de herlaadbeweging met de hand zetten. De hoofdlus draait door,
   dus `reloading` wordt elk beeld bijgewerkt; dit zet hem telkens terug en
   tekent de bijbehorende houding.
  */
  window.__stand = (f) => {
    const p = g.player;
    p.reloading = p.wapen.herlaadtijd * (1 - f);
    p.wapen.update(0.016, { herlaad: p.reloading, bob: 0, mik: 0, holster: 0 });
  };
});
for (const [naam, f] of [['wapen_herlaad_uit', 0.26], ['wapen_herlaad_hand', 0.56], ['wapen_herlaad_erin', 0.70]]) {
  await page.evaluate(v => window.__stand(v), f);
  await foto(naam);
}
await page.evaluate(() => { window.__game.player.reloading = 0; window.__laat(40); });

// ---- 6: het schap bij Tinga State
await page.evaluate(() => {
  const g = window.__game, b = g.boerderij;
  window.__laat(60);
  g.player.health = 55;            // dan ligt de verbandtrommel er ook bij
  g.hud.zetLeven(55);
  const t = b.plekken.toonbank;
  g.player.pos.set(t.x, 0, t.z);
  g.player.wapenUit = true; g.player.gun.visible = false;
  // naar de toonbank kijken
  const bank = b.maten ? b.maten.toonbank : null;
  g.player.yaw = Math.PI;
  g.player.applyCamera();
  b.update(0.1, false);
});
await foto('boerderij_schap');

await browser.close();
