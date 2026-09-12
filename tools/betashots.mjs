/*
 Foto's van de beta-ronde: de wegafsluiting aan de Lemmerweg en een omvergereden
 lantaarnpaal.

 Gebruik: python3 -m http.server 8123 &  node tools/betashots.mjs 8123 [map]
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
await page.evaluate(async () => {
  const g = window.__game;
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true; g.sfeer.uur = 11.5; g.sfeer.weer = 'helder';
  g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
  window.__W = await import('/js/world.js');
});

// 1. de afsluiting, gezien vanaf de weg
await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const g = window.__game;
  const A = KAART.wegafsluitingen[0];
  const x = A.x - A.as[0] * 15, z = A.z - A.as[1] * 15;
  g.player.pos.set(x, 0, z);
  g.player.yaw = Math.atan2(-(A.x - x), -(A.z - z));
  g.player.pitch = -0.04;
  g.player.applyCamera();
  window.__W.updateLOD(A.x, A.z);
});
await page.waitForTimeout(2400);
await page.screenshot({ path: `${map}/afsluiting.png`, timeout: 300000 });
console.log(`${map}/afsluiting.png`);

// 2. een omvergereden lantaarnpaal, van dichtbij
await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const g = window.__game;
  // een paal langs de Molenkrite, dicht bij het startpunt
  const S = KAART.start;
  const l = KAART.lantaarns
    .map(q => ({ q, d: Math.hypot(q.x - S.x, q.z - S.z) }))
    .sort((a, b) => a.d - b.d)[0].q;
  g.raakLantaarn(l.x, l.z, 1.2, 16);
  for (let i = 0; i < 120; i++) g.werkLantaarnsBij(0.05, l.x, l.z);
  g.player.pos.set(l.x + 7, 0, l.z + 5);
  g.player.yaw = Math.atan2(-(l.x - (l.x + 7)), -(l.z - (l.z + 5)));
  g.player.pitch = -0.28;
  g.player.applyCamera();
  window.__W.updateLOD(l.x, l.z);
});
await page.waitForTimeout(2400);
await page.screenshot({ path: `${map}/lantaarn_om.png`, timeout: 300000 });
console.log(`${map}/lantaarn_om.png`);

await browser.close();
