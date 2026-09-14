/*
 Foto's van de wasboxen achter BP Slump Oil:

   1. de rij van schuin voren, met het tankstation ernaast
   2. recht ervoor, alle deuren dicht
   3. één deur halverwege open
   4. de auto binnen, deur dicht — het overspuiten
   5. dezelfde auto in een andere kleur, deur weer open

 Gebruik: npm run server &   node tools/spuitshots.mjs 8123 [map]
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
  /*
   De vrije camera van de editor: de hoofdlus zet de camera elk beeld terug op
   de speler, dus de speler zelf moet daar gaan staan.
  */
  g.player.fly = true;
  window.__kijk = (afst, hoog, opzij = 0, mikY = 2.0) => {
    const P = g.spuiterij.plek;
    const x = P.x + P.nx * afst + P.ux * opzij, z = P.z + P.nz * afst + P.uz * opzij;
    g.player.pos.set(x, hoog, z);
    g.player.yaw = Math.atan2(-(P.x - x), -(P.z - z));
    g.player.pitch = Math.atan2(mikY - hoog, Math.hypot(P.x - x, P.z - z));
    g.player.updateFly(0);
  };
  window.__stap = (n, dt = 0.05) => { for (let i = 0; i < n; i++) g.spuiterij.update(dt); };
  window.__auto = (nr, afst) => {
    const S = g.spuiterij, P = S.plek, box = S.boxen[nr];
    const x = box.deurX + P.nx * afst, z = box.deurZ + P.nz * afst;
    if (!window.__wagen) {
      window.__wagen = g.vehicles.voegToe({ x, z, yaw: Math.atan2(P.nx, P.nz), soort: 'hatch', kleur: 0x9c1f1f });
      g.vehicles.maakBestuurbaar(window.__wagen);
    }
    const w = window.__wagen;
    w.x = x; w.z = z; w.yaw = Math.atan2(P.nx, P.nz);
    if (w.mesh) { w.mesh.position.set(x, w.mesh.position.y, z); w.mesh.rotation.y = w.yaw; }
    return w;
  };
});

// ---- 1: van schuin voren, met het tankstation erbij
await page.evaluate(() => window.__kijk(21, 8, 10, 2.5));
await foto('spuiterij_terrein');

// ---- 2: recht ervoor, dicht
await page.evaluate(() => window.__kijk(14, 2.6, 0, 2.2));
await foto('spuiterij_dicht');

// ---- 3: één deur halverwege open
await page.evaluate(() => {
  const g = window.__game;
  g.player.inCar = window.__auto(1, 8);
  window.__stap(18);
  g.player.inCar = null;
  window.__kijk(14, 2.6, 0, 2.2);
});
await foto('spuiterij_open');

// ---- 4: de auto binnen, deur dicht
await page.evaluate(() => {
  const g = window.__game, S = g.spuiterij;
  g.player.inCar = window.__auto(1, 8);
  window.__stap(60);
  const box = S.boxen[1];
  const w = window.__wagen;
  w.x = box.binnen.x; w.z = box.binnen.z;
  if (w.mesh) w.mesh.position.set(w.x, w.mesh.position.y, w.z);
  window.__stap(40);
  g.player.inCar = null;
  window.__kijk(13, 2.4, 0, 2.2);
});
await foto('spuiterij_binnen');

// ---- 5: klaar, andere kleur, deur open
await page.evaluate(() => {
  const g = window.__game;
  g.verhaal.verdien(2000);
  g.player.inCar = window.__wagen;
  window.__stap(240);
  g.player.inCar = null;
  const w = window.__wagen;
  if (w.mesh) w.mesh.position.set(w.x, w.mesh.position.y, w.z);
  window.__kijk(13, 2.4, 0, 2.2);
});
await foto('spuiterij_klaar');

await browser.close();
