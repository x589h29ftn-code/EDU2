/*
 Foto's van stap 113 (js/leven.js):

   buurt_feest.png      een tuinfeest 's avonds: gasten rond de tafel, lampionnen in een kring
   buurt_pizza.png      de pizzabezorger op zijn scooter, met de doos achterop
   buurt_boot.png       de plezierboot op de Geeuw

 Gebruik: npm run server &   node tools/buurtshots.mjs 8123 [map]
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

const foto = async (naam, { wacht = 1500 } = {}) => {
  await page.evaluate(() => {
    const g = window.__game;
    g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
    document.getElementById('dialoog').hidden = true;
    const h = document.getElementById('hint'); if (h) { h.textContent = ''; h.style.visibility = 'hidden'; }
    const u = document.getElementById('uitleg'); if (u) u.style.visibility = 'hidden';
    if (g.renderer && g.renderer.shadowMap) g.renderer.shadowMap.needsUpdate = true;
  });
  await page.waitForTimeout(wacht);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 600000 });
  console.log(`${map}/${naam}.png`);
};
// de camera op (x, y, z) boven de grond daar, kijkend naar (kx, ky, kz) boven de grond daar
const kamera = (x, y, z, kx, ky, kz) => page.evaluate(async ({ x, y, z, kx, ky, kz }) => {
  const W = await import('/js/world.js');
  y += W.grondHoogte(x, z, 50); ky += W.grondHoogte(kx, kz, 50);
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
  await g.reliëfAf();
  window.__autoplay = false; g.player.active = false;
  g.sfeer.weer = 'helder';
});

// ------------------------------------------------------ het tuinfeest, 's avonds
{
  const p = await page.evaluate(() => {
    const g = window.__game, l = g.leven;
    g.sfeer.uur = 21.5;
    const sp = { x: 900, z: -150 };
    const plek = l.vrijeTuin(sp);
    l.beginFeest(plek);
    for (let i = 0; i < 30; i++) l.update(0.1, { x: plek.x + 12, z: plek.z }, () => true, 21.5);
    // de hoofdlus mag het feest niet laten wisselen
    l.feest.t = 0;
    return plek;
  });
  // schuin van boven, een meter of negen van het midden
  await kamera(p.x + 7, 3.4, p.z + 6, p.x, 1.0, p.z);
  await foto('buurt_feest', { wacht: 2500 });
  await page.evaluate(() => window.__game.leven.eindFeest());
}
// ------------------------------------------------------ de pizzascooter, overdag
{
  const p = await page.evaluate(() => {
    const g = window.__game, l = g.leven;
    g.sfeer.uur = 18.5;
    const sp = { x: 900, z: -150 };
    l.pizzaWeg();
    l.startPizza(sp, () => false, { zeker: true });
    for (let i = 0; i < 2000 && l.pizza.fase === 'heen' && l.pizza.s < l.pizza.lijn.lengte - 60; i++) l.update(0.1, sp, () => false, 18.5);
    const s = l.scooter;
    return { x: s.position.x, z: s.position.z, yaw: s.rotation.y };
  });
  // schuin voor hem, op de stoep
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  await page.evaluate(() => { const l = window.__game.leven; l.__u = l.update; l.update = () => {}; });
  await kamera(p.x + fx * 6 + fz * 3, 1.5, p.z + fz * 6 - fx * 3, p.x, 0.9, p.z);
  await foto('buurt_pizza');
  await page.evaluate(() => { const l = window.__game.leven; l.update = l.__u; });
}
// ------------------------------------------------------ de plezierboot
{
  const p = await page.evaluate(() => {
    const g = window.__game, l = g.leven, b = l.boot;
    g.sfeer.uur = 14;
    b.s = b.lengte * 0.35; b.richting = 1; b.wachtT = 0;
    for (let i = 0; i < 40; i++) l.update(0.1, { x: 0, z: 0 }, () => false, 14);
    const q = b.groep.position;
    return { x: q.x, z: q.z, yaw: b.groep.rotation.y };
  });
  const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);   // opzij van de boot
  await page.evaluate(() => { const l = window.__game.leven; l.__u = l.update; l.update = () => {}; });
  await kamera(p.x + rx * 9, 2.4, p.z + rz * 9, p.x, 0.6, p.z);
  await foto('buurt_boot');
}

await browser.close();
