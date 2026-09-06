/*
 Foto's van de binnenkant van supermarkt Poiesz, De Dassenboarch 32 in IJlst:

   poiesz_binnen.png    vanaf de schuifdeuren de winkel in
   poiesz_kassa.png     de rij kassa's met de lopende banden
   poiesz_gangpad.png   een gangpad tussen de schappen, met de oranje kopschotten
   poiesz_vries.png     de diepvriesafdeling
   poiesz_vers.png      de versbalie en de zuivelwand achterin
   poiesz_bier.png      het bierschap, waar je op E drukt
   poiesz_dronken.png   hetzelfde beeld na drie flesjes

 Gebruik: python3 -m http.server 8123 &  node tools/poieszshots.mjs 8123 [map]
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
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });

const opzet = await page.evaluate(() => {
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  g.sfeer.uur = 13;
  g.player.wapenUit = true;
  g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
  const w = g.supermarkt;
  if (!w || !w.plekken) return null;
  const P = w.plekken, m = w.maten;
  window.__W = w;
  window.__zet = (x, z, yaw, pitch = 0, hoog = 0) => {
    g.player.inCar = null; g.player.zit = false;
    g.player.pos.set(x, hoog, z); g.player.yaw = yaw; g.player.pitch = pitch;
    g.player.applyCamera();
  };
  window.__kijk = (px, pz, tx, tz) => Math.atan2(-(tx - px), -(tz - pz));
  // lokaal punt in de winkel naar de wereld
  window.__lok = (x, z) => ({ x: P.nul.x + x, z: P.nul.z + z });
  return { nul: P.nul, maten: m };
});
if (!opzet) { console.log('geen supermarkt in de wereld'); await browser.close(); process.exit(1); }
console.log(`winkel ${opzet.maten.hal.toFixed(1)} x ${opzet.maten.diep.toFixed(1)} m · ${opzet.maten.kassas} kassa's · ${opzet.maten.rijen} schappenrijen · ${opzet.maten.mensen} mensen`);
await page.waitForTimeout(1200);

const foto = async (naam) => {
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 300000 });
  console.log(`${map}/${naam}.png`);
};
const kijkVan = async (x, z, tx, tz, pitch = 0) => {
  await page.evaluate(([x, z, tx, tz, pitch]) => {
    const a = window.__lok(x, z), b = window.__lok(tx, tz);
    window.__zet(a.x, a.z, window.__kijk(a.x, a.z, b.x, b.z), pitch);
  }, [x, z, tx, tz, pitch]);
};

// 1. net binnen, de winkel in kijken
await kijkVan(opzet.maten.hal / 2, 3.0, opzet.maten.hal / 2, 26, 0.02);
await foto('poiesz_binnen');

// 2. de kassa's
await kijkVan(19.5, 5.0, 4.0, 6.5, -0.02);
await foto('poiesz_kassa');

// 3. een gangpad
await kijkVan(9.2, 10.0, 9.2, 25.0, 0.0);
await foto('poiesz_gangpad');

// 4. de diepvries
await kijkVan(opzet.maten.hal - 9.5, 14.5, opzet.maten.hal - 0.5, 14.5, 0.03);
await foto('poiesz_vries');

// 5. de versbalie en de zuivelwand
await kijkVan(13.0, 25.0, 9.0, opzet.maten.diep - 0.5, 0.04);
await foto('poiesz_vers');

// 6. het bier
await kijkVan(5.4, 15.0, 0.4, 15.0, 0.02);
await foto('poiesz_bier');

// 7. drie flesjes op
const na = await page.evaluate(() => {
  const g = window.__game;
  // geld in de portemonnee: dezelfde weg als de opslag gebruikt
  g.verhaal.herstel({ ...g.verhaal.bewaar(), geld: 500 });
  const uit = [window.__W.koop(), window.__W.koop(), window.__W.koop()];
  g.hud.zetDronken(g.player.dronken);
  g.player.applyCamera();
  return { uit, dronken: +g.player.dronken.toFixed(2), leven: g.player.health, flesjes: window.__W.flesjes };
});
console.log(`drie flesjes: ${na.uit.join(', ')} · dronken ${na.dronken} · leven ${na.leven}`);
await foto('poiesz_dronken');

await browser.close();
