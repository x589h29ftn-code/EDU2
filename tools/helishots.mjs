/*
 Foto's van de politiehelikopter:

   1. het toestel van opzij, boven de wijk
   2. van onderaf, zoals je hem ziet als hij boven je hangt
   3. met het zoeklicht aan, 's nachts
   4. en de wegversperring: twee wagens dwars over de straat

 Gebruik: npm run server &   node tools/helishots.mjs 8123 [map]
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
  document.getElementById('ui').style.display = 'none';
  g.player.active = true;
  g.sfeer.uur = 13; g.sfeer.weer = 'helder';
  g.player.wapenUit = true; g.player.gun.visible = false;
  // vier sterren: de heli komt en gaat boven je cirkelen
  g.politie.zetHeat(320);
  window.__vlieg = (n = 450) => { for (let i = 0; i < n; i++) g.politie.update(0.1); };
  window.__vlieg();
  /*
   De vrije camera van de editor (player.fly): de hoofdlus zet de camera elk
   beeld terug op de speler, dus hem los neerzetten heeft geen zin — de speler
   zelf moet daar gaan staan. Vliegend is dat precies wat deze stand doet.
  */
  g.player.fly = true;
  window.__kijk = (afst, hoogte, hoek = 0) => {
    const h = g.politie.heli;
    const x = h.x + Math.cos(hoek) * afst, y = h.y + hoogte, z = h.z + Math.sin(hoek) * afst;
    g.player.pos.set(x, y, z);
    g.player.yaw = Math.atan2(-(h.x - x), -(h.z - z));
    g.player.pitch = Math.atan2(h.y - y, Math.hypot(h.x - x, h.z - z));
    g.player.updateFly(0);
  };
});

// ---- 1: van opzij
await page.evaluate(() => window.__kijk(26, 2));
await foto('heli_opzij');

// ---- 2: van onderaf, zoals je hem vanaf de stoep ziet
await page.evaluate(() => {
  // vanaf de stoep omhoog kijken, zoals je hem in het spel ziet hangen
  const g = window.__game, h = g.politie.heli;
  g.player.fly = false;
  g.player.pos.set(h.x + 8, 0, h.z + 8);
  g.player.yaw = Math.atan2(-(h.x - g.player.pos.x), -(h.z - g.player.pos.z));
  g.player.pitch = Math.atan2(h.y - 1.7, Math.hypot(h.x - g.player.pos.x, h.z - g.player.pos.z));
  g.player.applyCamera();
  g.player.fly = true;
});
await foto('heli_vanonder');

// ---- 3: het zoeklicht 's nachts
await page.evaluate(() => {
  const g = window.__game;
  g.sfeer.uur = 23;
  for (let i = 0; i < 40; i++) g.politie.update(0.1);
  window.__kijk(34, 6, 1.1);
});
await foto('heli_zoeklicht');

// ---- 4: de wegversperring
await page.evaluate(async () => {
  const g = window.__game, P = g.politie;
  const K = await import('/js/kaartwereld.js');
  g.sfeer.uur = 13;
  P.reset(); P.zetHeat(200);
  const wegen = K.KAART.wegassen.filter(w => w.drive && w.lengte > 250);
  for (const weg of wegen.slice(0, 6)) {
    let i = 1, t = 0;
    for (let beeld = 0; beeld < 260 && i < weg.pts.length; beeld++) {
      const a = weg.pts[i - 1], b = weg.pts[i];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      t += 12 * 0.05;
      if (t > L) { t = 0; i++; continue; }
      g.player.pos.set(a[0] + (b[0] - a[0]) * (t / L), 0, a[1] + (b[1] - a[1]) * (t / L));
      P.update(0.05);
      if (P.intern.blokkades.length) break;
    }
    if (P.intern.blokkades.length) break;
  }
  const b = P.intern.blokkades[0];
  if (b) {
    g.player.fly = true;
    g.player.pos.set(b.x + 15, 5.0, b.z + 15);
    g.player.yaw = Math.atan2(-(b.x - g.player.pos.x), -(b.z - g.player.pos.z));
    g.player.pitch = Math.atan2(1.2 - 5.0, Math.hypot(b.x - g.player.pos.x, b.z - g.player.pos.z));
    g.player.updateFly(0);
  }
});
await foto('politie_wegversperring');

await browser.close();
