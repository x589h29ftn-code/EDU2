/*
 Foto's van Autohuis Lemmerweg (js/garage.js):

   garage_buiten.png   vanaf de Lemmerweg: de glazen gevel, de luifel met de naam,
                       de zuil aan de weg
   garage_binnen.png   binnen, vlak achter de deur: de rode Ferrari op de
                       draaischijf, de gele erachter, de balie
   garage_ferrari.png  de gekochte rode Ferrari op het voorterrein
   garage_avond.png    's avonds vanaf de weg: binnen brandt het licht

 Gebruik: npm run server &   node tools/garageshots.mjs 8123 [map]
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const poort = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
mkdirSync(map, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

const foto = async (naam, { wacht = 1500 } = {}) => {
  await page.evaluate(() => {
    const g = window.__game;
    g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
    g.hud.melding('', '', 0);
    if (g.uitleg) g.uitleg.update(999);
    document.getElementById('dialoog').hidden = true;
    document.getElementById('praat').hidden = true;
    const h = document.getElementById('hint'); if (h) h.textContent = '';
    g.renderer && g.renderer.shadowMap && (g.renderer.shadowMap.needsUpdate = true);
  });
  await page.waitForTimeout(wacht);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 600000 });
  console.log(`${map}/${naam}.png`);
};
// de camera op (x, y, z), kijkend naar (kx, ky, kz); zie tools/brugshots.mjs
const kamera = (x, y, z, kx, ky, kz) => page.evaluate(async ({ x, y, z, kx, ky, kz }) => {
  const W = await import('/js/world.js');
  const g = window.__game, pl = g.player;
  window.__autoplay = false; pl.active = false;
  pl.inCar = null; pl.zit = false; pl.fly = false;
  pl.wapenUit = true; if (pl.gun) pl.gun.visible = false;
  pl.pos.set(x, y - pl.eye, z);
  pl.yaw = Math.atan2(-(kx - x), -(kz - z));
  pl.pitch = Math.atan2(ky - y, Math.hypot(kx - x, kz - z));
  pl.applyCamera();
  W.updateLOD(x, z); g.vehicles.lod(x, z);
  if (g.grasVeld) g.grasVeld.update(x, z, true);
}, { x, y, z, kx, ky, kz });

await page.evaluate(async () => {
  const g = window.__game;
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true;
  window.__autoplay = true;
  g.sfeer.weer = 'helder'; g.sfeer.uur = 14.5;
  g.reliëfAf();
  // de draaischijf een kwartslag verder, dan staat de Ferrari schuin naar de deur
  for (let i = 0; i < 40; i++) g.garage.update(0.1, true);
});

// ------------------------------------------------------------ vanaf de weg
{
  const m = await page.evaluate(() => window.__game.garage.maten);
  await kamera(m.x0 - 24, 1.7, m.z0 - 12, m.x0 + 4, 2.6, (m.z0 + m.z1) / 2 + 2);
  await foto('garage_buiten');
}

// ------------------------------------------------------------------ binnen
{
  const d = await page.evaluate(() => window.__game.garage.deur);
  await kamera(d.x + 1.2, 1.65, d.z - 3.6, d.x + 9, 0.9, d.z + 3.5);
  await foto('garage_binnen');
}

// ---------------------------------------------------- de gekochte Ferrari
{
  const f = await page.evaluate(() => {
    const g = window.__game, G = g.garage, v = g.verhaal;
    v.verdien(10000);
    const m = G.modellen.find(a => a.id === 'ferrari_rood');
    g.player.pos.set(m.bord.x + 0.4, 0, m.bord.z);
    G.koop(m);
    const car = G.eigen[G.eigen.length - 1].car;
    return { x: car.x, z: car.z };
  });
  await kamera(f.x - 4.2, 1.35, f.z - 4.4, f.x, 0.55, f.z);
  await foto('garage_ferrari');
}

// ------------------------------------------------------------------ avond
{
  await page.evaluate(() => { const g = window.__game; g.sfeer.uur = 22.2; for (let i = 0; i < 3; i++) g.garage.update(0.05, true); });
  const m = await page.evaluate(() => window.__game.garage.maten);
  await kamera(m.x0 - 22, 1.7, m.z1 + 10, m.x0 + 5, 2.4, (m.z0 + m.z1) / 2);
  await foto('garage_avond');
}

await browser.close();
