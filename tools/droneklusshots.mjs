/*
 Foto van de drone-klus (js/klusjes.js, stap 132):

   droneklus.png   vanuit de drone op de deal: de twee mannen tussen hun auto's, de balk met afstand
                   en hoogte linksboven, het scherm van de drone eromheen

 Gebruik: npm run server &   node tools/droneklusshots.mjs 8123 [map]
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

const klaar = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const W = await import('/js/world.js');
  const g = window.__game, v = g.verhaal, kl = v.klusjes, D = g.drone, P = g.player;
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  g.sfeer.weer = 'helder'; g.sfeer.uur = 15;
  g.reliëfAf();
  window.__autoplay = false; P.active = false; window.__geenDownload = true;
  const stap = (n = 1, dt = 0.1) => { for (let i = 0; i < n; i++) { P.health = 100; v.update(dt); } };
  const zet = (x, z) => { P.inCar = null; P.pos.set(x, 0, z); P.applyCamera(); };
  const s = v.bewaar(); s.missie = 'klaar'; s.fase = 'klaar'; s.volgende = null;
  v.herstel(s); v.__geenVolgende(); g.politie.reset();
  zet(KAART.start.x, KAART.start.z);
  P.drone = true; D.accu = 300;
  kl.__soort('drone');
  if (!kl.__nieuwAanbod()) return 'geen aanbod';
  const a = kl.aanbod;
  zet(a.x + 1.2, a.z); stap(2);
  v.toets();
  for (let i = 0; i < 40 && !document.getElementById('dialoog').hidden; i++) { v.toets(); stap(1); }
  if (!kl.klus || kl.klus.soort !== 'drone') return 'geen klus';
  const richt = (x, y, z, tx, ty, tz) => {
    D.pos.set(x, y, z);
    P.yaw = Math.atan2(-(tx - x), -(tz - z));
    P.pitch = Math.atan2(ty - y, Math.hypot(tx - x, tz - z));
    D.update(0);
  };
  const boven = () => { const c = kl.deal.auto, y = c.mesh ? c.mesh.position.y : 0; richt(c.x + 14, y + 26, c.z, c.x, y, c.z); };
  D.start();
  for (let i = 0; i < 4000 && kl.klus && kl.deal && kl.deal.fase !== 'deal'; i++) { boven(); stap(1); }
  if (!kl.deal || kl.deal.fase !== 'deal') return 'geen deal';
  stap(40);   // de tas halverwege de overdracht
  const m = kl.deal.midden, y = (kl.deal.auto.mesh ? kl.deal.auto.mesh.position.y : 0);
  // schuin erboven, 22 m hoog, de deal midden in beeld
  richt(m.x + m.tz * 16 - m.tx * 6, y + 22, m.z - m.tx * 16 - m.tz * 6, m.x, y + 1, m.z);
  stap(1, 0.016);
  richt(m.x + m.tz * 16 - m.tx * 6, y + 22, m.z - m.tx * 16 - m.tz * 6, m.x, y + 1, m.z);
  W.updateLOD(D.pos.x, D.pos.z); g.vehicles.lod(D.pos.x, D.pos.z);
  if (g.grasVeld) g.grasVeld.update(D.pos.x, D.pos.z, true);
  g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
  g.hud.missieT = 0; g.hud.missieEl.style.transition = 'none'; g.hud.missieEl.style.opacity = 0;
  const u = document.getElementById('uitleg'); if (u) u.style.visibility = 'hidden';
  if (g.renderer.shadowMap) g.renderer.shadowMap.needsUpdate = true;
  g.scene.updateMatrixWorld(true);
  g.renderer.render(g.scene, g.camera);
  return 'ok';
});
console.log('stand:', klaar);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${map}/droneklus.png`, timeout: 600000 });
console.log(`${map}/droneklus.png`);
await browser.close();
