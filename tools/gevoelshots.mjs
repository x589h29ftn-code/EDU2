/*
 Foto van de remsporen.

 In het spel komen de sporen uit `vehicles.drive`: die roept `zetSpoor` aan zodra
 de banden slippen. Voor een fóto is een echte proefrit onhandig — een auto die
 zichzelf bestuurt rijdt zich binnen een paar seconden vast op de auto vóór hem,
 en dan liggen er drie streepjes die je van boven niet terugvindt. Dit
 gereedschap legt daarom zelf een remspoor neer met dezelfde functie die de auto
 gebruikt, over de Molenkrite vanaf het startpunt van het spel, en fotografeert
 dat van boven. Dát de auto ze bij het slippen neerlegt en dat ze weer vervagen
 wordt nagerekend in `npm run gevoeltest`; dit beeld laat zien hoe ze eruitzien.

 Gebruik: python3 -m http.server 8123 &  node tools/gevoelshots.mjs 8123 [map]
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

const aantal = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const W = await import('/js/world.js');
  const g = window.__game;
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true;
  g.sfeer.uur = 11.5; g.sfeer.weer = 'helder';
  g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;

  const S = KAART.start;
  // vooruit is (-sin yaw, -cos yaw), net als bij de auto's; dwars staat er haaks op
  const fx = -Math.sin(S.yaw), fz = -Math.cos(S.yaw);
  const rx = Math.cos(S.yaw), rz = -Math.sin(S.yaw);
  // twee sporen naast elkaar zoals de achterwielen ze achterlaten, en steeds
  // donkerder naarmate de auto verder in de remming zit
  for (let i = 0; i < 40; i++) {
    const d = i * 0.8, kracht = 0.45 + 0.55 * (i / 39);
    for (const kant of [-0.71, 0.71]) {
      g.vehicles.spoor(S.x + fx * d + rx * kant, S.z + fz * d + rz * kant, S.yaw, 0.24, 0.9, kracht);
    }
  }
  g.player.pos.set(S.x + fx * 16, 30, S.z + fz * 16);
  g.player.yaw = S.yaw; g.player.pitch = -1.45;
  g.player.applyCamera();
  W.updateLOD(S.x, S.z);
  return g.sporen();
});
console.log(`${aantal} remsporen`);
await page.waitForTimeout(2400);
await page.screenshot({ path: `${map}/remsporen.png`, timeout: 300000 });
console.log(`${map}/remsporen.png`);
await browser.close();
