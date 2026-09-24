/*
 Foto's van de ronde clipping en licht (24 sep 2026):

   clip_wapen.png     vlak voor de gevel van Molenkrite 15: het pistool staat
                      heel in beeld in plaats van half in de stenen
   licht_middag.png   de Molenkrite om vier uur: omgevingsschaduw aan de voet van
                      de gevels en de scherpere schaduw op de stoep
   licht_avond.png    dezelfde plek om acht uur 's avonds: de ruiten spiegelen een
                      avondlucht in plaats van de middag

 Gebruik: npm run server &   node tools/lichtshots.mjs 8123 [map]
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
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

const foto = async (naam, wacht = 1500) => {
  await page.evaluate(() => {
    const g = window.__game;
    g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
    g.hud.melding('', '', 0);
    if (g.uitleg) g.uitleg.update(999);
  });
  await page.waitForTimeout(wacht);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 600000 });
  console.log(`${map}/${naam}.png`);
};
// het uur zetten en de lucht, de zon en de omgeving meteen laten volgen
const uur = (u) => page.evaluate((u) => {
  const g = window.__game;
  g.sfeer.uur = u; g.sfeer.weer = 'helder';
  for (let i = 0; i < 5; i++) g.sfeer.update(0.1, g.camera.position.x, g.camera.position.z);
  g.werkOmgevingBij(7);
  g.zetSchaduwDoos(g.camera.position.x, g.camera.position.z);
}, u);

const plek = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const g = window.__game;
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true; window.__autoplay = true;
  g.player.wapenSlot = false; g.player.wapenUit = false;
  g.reliëfAf();
  const p = KAART.panden.find(q => q.straat === 'Molenkrite' && (q.nr || []).includes('15'));
  const L = Math.hypot(p.front[0], p.front[1]); const fx = p.front[0] / L, fz = p.front[1] / L;
  const u = [Math.cos(p.rect.hoek), Math.sin(p.rect.hoek)];
  const diep = Math.abs(fx * u[0] + fz * u[1]) > 0.7 ? p.rect.hx : p.rect.hz;
  return { gx: p.rect.cx + fx * diep, gz: p.rect.cz + fz * diep, fx, fz };
});

// ---- het wapen vlak voor de gevel
await uur(15);
await page.evaluate(({ gx, gz, fx, fz }) => {
  const g = window.__game;
  g.player.inCar = null;
  g.player.pos.set(gx + fx * 0.4, 0, gz + fz * 0.4);
  g.player.yaw = Math.atan2(fx, fz); g.player.pitch = -0.05;
  g.player.zetWapen && g.player.zetWapen('pistool');
  g.player.wapenUit = false; if (g.player.gun) g.player.gun.visible = true;
  g.player.applyCamera();
}, plek);
await foto('clip_wapen');

// ---- de straat om vier uur en om acht uur, vanaf de overkant schuin op de gevels
await page.evaluate(({ gx, gz, fx, fz }) => {
  const g = window.__game;
  g.player.wapenUit = true; if (g.player.gun) g.player.gun.visible = false;
  const px = gx + fx * 16 - fz * 9, pz = gz + fz * 16 + fx * 9;
  g.player.pos.set(px, 0, pz);
  g.player.yaw = Math.atan2(-(gx - px), -(gz - pz)); g.player.pitch = -0.08;
  g.player.applyCamera();
}, plek);
await uur(16);
await foto('licht_middag');
await uur(20);
await foto('licht_avond');

await browser.close();
