/*
 Foto's van de geparkeerde auto's op afstand (ronde van 25 sep 2026):

   autolod_straat.png      de Molenkrite in, zoals het spel hem nu tekent: tot
                           45 m het volle model, daarachter de grove uitvoering
   autolod_vol.png         precies hetzelfde beeld met alle auto's vol, om te
                           zien dat je de overgang niet ziet

 In het onderschrift van de uitvoer staat wat elk beeld aan driehoeken kostte.

 Gebruik: npm run server &   node tools/autolodshots.mjs 8123 [map]
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

await page.evaluate(async () => {
  const W = await import('/js/world.js');
  const g = window.__game, p = g.player, s = g.start;
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  p.active = true; window.__autoplay = true;
  p.wapenUit = true; if (p.gun) p.gun.visible = false;
  g.reliëfAf();
  g.sfeer.uur = 14; g.sfeer.weer = 'helder';
  for (let i = 0; i < 5; i++) g.sfeer.update(0.1, s.x, s.z);
  g.werkOmgevingBij(7);
  // de straat in: de rij auto's die het verst doorloopt vanaf het begin
  const autos = g.vehicles.cars.filter(c => c.inst && Math.hypot(c.x - s.x, c.z - s.z) < 140);
  let beste = null;
  for (let a = 0; a < 64; a++) {
    const yaw = a / 64 * Math.PI * 2, vx = -Math.sin(yaw), vz = -Math.cos(yaw);
    let n = 0;
    for (const c of autos) {
      const dx = c.x - s.x, dz = c.z - s.z, voor = dx * vx + dz * vz, zij = Math.abs(dx * vz - dz * vx);
      if (voor > 15 && voor < 130 && zij < 14) n++;
    }
    if (!beste || n > beste.n) beste = { n, yaw };
  }
  p.inCar = null; p.pos.set(s.x, 0, s.z); p.yaw = beste.yaw; p.pitch = -0.04;
  p.applyCamera();
  W.updateLOD(g.camera.position.x, g.camera.position.z);
  g.vehicles.lod(g.camera.position.x, g.camera.position.z);
  if (g.grasVeld) g.grasVeld.update(g.camera.position.x, g.camera.position.z, true);
  g.zetSchaduwDoos(g.camera.position.x, g.camera.position.z);
  g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
  if (g.uitleg) g.uitleg.update(999);
  window.__meet = () => { g.renderer.info.reset(); g.renderer.render(g.scene, g.camera); return g.renderer.info.render.triangles; };
  // alles vol: dezelfde auto's, zonder de grove uitvoering
  window.__vol = (aan) => {
    for (const k in g.vehicles.stapels) {
      const st = g.vehicles.stapels[k];
      for (const c of st.autos) if (c && !c.mesh) st.stapel.zet(c.inst.i, c.x, c.z, c.yaw, c.getekend, aan ? false : c.opAfstand);
      st.stapel.klaar();
    }
  };
});
const foto = async (naam) => {
  await page.waitForTimeout(2500);
  const tri = await page.evaluate(() => window.__meet());
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 600000 });
  console.log(`${map}/${naam}.png — ${(tri / 1e6).toFixed(2)} miljoen driehoeken`);
};
await foto('autolod_straat');
await page.evaluate(() => window.__vol(true));
await foto('autolod_vol');
await page.evaluate(() => window.__vol(false));
await browser.close();
