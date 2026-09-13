/*
 Foto's van de ronde met de twaalf punten van 13 september 2026:

   1. het startscherm zonder de twee uitlegregels (punt 9)
   2. het laadscherm met "klik op enter om te beginnen" (punt 3)
   3. het machinegeweer in de hand, met het icoon rechtsonder (punt 5)
   4. geld en kogels op straat (punt 2 en 6)
   5. de neus van een auto van schuin voren: grille en koplampen (punt 4)

 Gebruik: npm run server &   node tools/puntenshots.mjs 8123 [map]
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

// 1. het startscherm
await page.waitForSelector('#menuNieuw', { state: 'attached', timeout: 300000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${map}/punten_startscherm.png`, timeout: 300000 });
console.log(`${map}/punten_startscherm.png`);

// 2. het laadscherm dat op enter wacht
await page.evaluate(() => document.getElementById('menuNieuw').click());
await page.waitForSelector('#laadklaar:not([hidden])', { timeout: 300000 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${map}/punten_laadscherm.png`, timeout: 300000 });
console.log(`${map}/punten_laadscherm.png`);
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__game && window.__game.player.active, null, { timeout: 300000 });

await page.evaluate(async () => {
  const g = window.__game;
  g.sfeer.uur = 12; g.sfeer.weer = 'helder';
  g.hud.msgT = 0; g.hud.msg.style.opacity = 0;
  g.hud.missieT = 0; g.hud.missieEl.style.transition = 'none'; g.hud.missieEl.style.opacity = 0;
  window.__W = await import('/js/world.js');
});

// 3. het machinegeweer in de hand
await page.evaluate(async () => {
  const g = window.__game;
  const T = await import('/js/textures.js');
  g.verhaal.verdien(600);
  g.boerderij.koopWapen();
  // de overgang uitzetten: headless haalt één beeld per seconde en dan blijft een
  // CSS-fade van drie tienden hangen op nul
  document.getElementById('wapen').style.transition = 'none';
  g.hud.toonWapen(T.wapenIcoon('mitrailleur').image, 60);
  g.player.pitch = -0.05;
  g.player.applyCamera();
});
await page.waitForTimeout(900);
await page.screenshot({ path: `${map}/punten_machinegeweer.png`, timeout: 300000 });
console.log(`${map}/punten_machinegeweer.png`);

// 4. de buit op straat
await page.evaluate(() => {
  const g = window.__game;
  const p = g.player;
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  g.hud.missieEl.style.display = 'none';
  g.buit.laatVallen('geld', p.pos.x + fx * 1.7 - fz * 0.45, p.pos.z + fz * 1.7 + fx * 0.45, 8);
  g.buit.laatVallen('kogels', p.pos.x + fx * 1.8 + fz * 0.45, p.pos.z + fz * 1.8 - fx * 0.45, 11);
  p.wapenUit = true; p.gun.visible = false;
  p.pitch = -0.42;
  p.applyCamera();
});
await page.waitForTimeout(900);
await page.screenshot({ path: `${map}/punten_buit.png`, timeout: 300000 });
console.log(`${map}/punten_buit.png`);

// 5. de neus van een auto van schuin voren
await page.evaluate(async () => {
  const g = window.__game;
  const { KAART } = await import('/js/kaart.js');
  // een verse auto met een eigen model: de geparkeerde auto's staan in een
  // instantiestapel en die is na een sprong door de wereld nog niet bijgewerkt
  const as = KAART.wegassen.filter(w => w.drive && w.naam === 'Molenkrite' && w.lengte > 60)[0];
  const p0 = as.pts[0], p1 = as.pts[as.pts.length - 1];
  const yaw = Math.atan2(-(p1[0] - p0[0]), -(p1[1] - p0[1]));
  const auto = g.vehicles.voegToe({ x: p0[0], z: p0[1], yaw, soort: 'hatch', kleur: 0x9c1f1f });
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  // drie meter schuin voor de auto, zodat je de neus van opzij ziet
  const x = auto.x + fx * 3.4 - fz * 2.2, z = auto.z + fz * 3.4 + fx * 2.2;
  g.player.pos.set(x, 0, z);
  g.player.yaw = Math.atan2(-(auto.x - x), -(auto.z - z));
  g.player.pitch = -0.10;
  g.player.wapenUit = true; g.player.gun.visible = false;
  g.player.applyCamera();
  g.hud.missieEl.style.display = 'none';
});
await page.waitForTimeout(900);
await page.screenshot({ path: `${map}/punten_koplampen.png`, timeout: 300000 });
console.log(`${map}/punten_koplampen.png`);

await browser.close();
