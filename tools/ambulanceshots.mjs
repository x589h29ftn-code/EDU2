/*
 Foto's van de ambulance (stap 112):

   ambulance_dag.png     overdag: de ambulance op straat, de bemanning geknield bij iemand die ligt
   ambulance_nacht.png   's nachts onderweg: de blauwe zwaailichten en hun licht op straat
   ambulance_achter.png  van achteren: de schuine strepen op de deuren

 Gebruik: npm run server &   node tools/ambulanceshots.mjs 8123 [map]
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
// (y en ky boven de grond daar: de weg kan hoger liggen, op een talud)
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
  // (eerst het reliëf helemaal af: zonder te wachten stond op elke foto alleen de lucht)
  await g.reliëfAf();
  window.__autoplay = false; g.player.active = false;
  g.sfeer.weer = 'helder'; g.sfeer.uur = 14;
  const A = await import('/js/ambulance.js');
  A.AMB.kans = 1;
  // iemand op de Molenkrite neer, de ambulance erheen tot ze geknield zitten
  const p = g.npcs.people.find(q => q.alive && !q.slaapt && Math.hypot(q.x - 560, q.z + 10) < 300) || g.npcs.people.find(q => q.alive);
  g.player.pos.set(p.x + 30, 0, p.z + 30); g.player.applyCamera();
  g.npcs.hitPersoon(p, 1); p.fall = 1;
  const a = g.ambulance;
  a.melding(p.x, p.z, null, g.player.pos, { zeker: true });
  for (let t = 0; t < 200 && a.fase !== 'helpt'; t += 0.1) a.update(0.1, g.player.pos, () => false);
  for (let i = 0; i < 15; i++) a.update(0.1, g.player.pos, () => false);
  window.__p = { x: p.x, z: p.z };
  window.__a = { x: a.auto.x, z: a.auto.z, yaw: a.auto.yaw };
});
// ------------------------------------------------------ overdag, bij de patiënt
{
  const q = await page.evaluate(() => ({ p: window.__p, a: window.__a }));
  const mx = (q.p.x + q.a.x) / 2, mz = (q.p.z + q.a.z) / 2;
  const dx = q.a.x - q.p.x, dz = q.a.z - q.p.z, d = Math.hypot(dx, dz) || 1;
  // van opzij op de lijn ambulance–patiënt
  await kamera(mx - dz / d * 11, 2.6, mz + dx / d * 11, mx, 0.8, mz);
  // de update van de ambulance even stil (de bemanning blijft geknield)
  await page.evaluate(() => { const a = window.__game.ambulance; a.__u = a.update; a.update = () => {}; });
  await foto('ambulance_dag');
}
// ------------------------------------------------------ van achteren
{
  const q = await page.evaluate(() => window.__a);
  const ax = Math.sin(q.yaw), az = Math.cos(q.yaw);   // achter is +z in het model
  await kamera(q.x + ax * 7 + az * 2.5, 1.7, q.z + az * 7 - ax * 2.5, q.x, 1.2, q.z);
  await foto('ambulance_achter');
}
// ------------------------------------------------------ 's nachts onderweg
await page.evaluate(() => {
  const g = window.__game, a = g.ambulance;
  a.update = a.__u;
  g.sfeer.uur = 1;
  a.verstop(); a.st.rust = 0;
  const p = g.npcs.people.find(q => q.alive && !q.slaapt && Math.hypot(q.x - 560, q.z + 10) < 400) || g.npcs.people.find(q => q.alive);
  g.npcs.hitPersoon(p, 1);
  a.melding(p.x, p.z, null, g.player.pos, { zeker: true });
  // een flink stuk de rit in
  for (let i = 0; i < 120; i++) a.update(0.1, g.player.pos, () => false);
  window.__a = { x: a.auto.x, z: a.auto.z, yaw: a.auto.yaw };
});
{
  const q = await page.evaluate(() => window.__a);
  const fx = -Math.sin(q.yaw), fz = -Math.cos(q.yaw);   // vooruit
  await kamera(q.x + fx * 14 + fz * 3, 2.2, q.z + fz * 14 - fx * 3, q.x, 1.2, q.z);
  await page.evaluate(() => { const a = window.__game.ambulance; a.update = (dt, sp) => a.__u(0, sp, () => true); });
  await foto('ambulance_nacht', { wacht: 2500 });
}

await browser.close();
