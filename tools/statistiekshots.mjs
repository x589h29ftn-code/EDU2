/*
 Foto's bij stap 195 (npm run statistiekshots): de statistieken in het pauzemenu (statistiek_menu.png) en in de titelrol aan
 het eind (statistiek_titelrol.png), met voorbeeldcijfers van een heel spel.

 Gebruik: npm run server &  node tools/statistiekshots.mjs [poort] [map]
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(900000);
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  const g = window.__game;
  // voorbeeldcijfers van een heel spel
  g.statistiek.herstel({ tijd: 6 * 3600 + 23 * 60, voet: 18400, auto: 212300, boot: 6100, schoten: 2841, mensen: 57, agenten: 23, autos: 14,
    verdiend: 61450, uitgegeven: 14200, klusjes: 11, sterren: 5, neer: 9 });
  const M = await import('/js/menu.js');
  M.toonMenu({ pauze: true });
  document.getElementById('menuStatistiek').click();
});
await page.waitForTimeout(800);
await page.screenshot({ path: `${map}/statistiek_menu.png` });
console.log(`${map}/statistiek_menu.png`);
await page.evaluate(async () => {
  const M = await import('/js/menu.js'); M.verbergMenu();
  document.getElementById('overlay').style.display = 'none';
  const v = window.__game.verhaal;
  v.__titelrol(true);
  // de rol zo schuiven dat het blok met de cijfers midden in beeld staat
  const rol = document.querySelector('#titelrol .rol'), kop = [...rol.querySelectorAll('h2')].find(h => /cijfers/.test(h.textContent));
  rol.style.transform = 'translateY(0)';
  const r = rol.getBoundingClientRect(), k = kop.getBoundingClientRect();
  rol.style.transform = `translateY(${window.innerHeight * 0.18 - (k.top - r.top)}px)`;
});
await page.waitForTimeout(500);
await page.screenshot({ path: `${map}/statistiek_titelrol.png` });
console.log(`${map}/statistiek_titelrol.png`);
await browser.close();
