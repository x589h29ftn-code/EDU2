/*
 Foto van stap 141 (js/postbode.js):

   postbode.png   de postbode van Post Tinga bij een deur, de arm met de envelop naar de brievenbus

 Gebruik: npm run server &   node tools/postbodeshots.mjs 8123 [map]
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const poort = process.argv[2] || '8123';
const map = process.env.SHOT_MAP || process.argv[3] || 'docs/screenshots';
mkdirSync(map, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: +(process.env.SHOT_B || 1280), height: +(process.env.SHOT_H || 720) } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

await page.evaluate(async () => {
  const g = window.__game;
  document.getElementById('overlay').style.display = 'none';
  await g.reliëfAf();
  window.__autoplay = false; g.player.active = false;
  g.sfeer.weer = 'helder';
  g.sfeer.uur = 9.3;
});

// een straat bij het begin, door tot de tweede deur, net voor de klep
const p = await page.evaluate(async () => {
  const g = window.__game, pb = g.leven.postbode, K = (await import('/js/kaart.js')), LP = await import('/js/looppad.js');
  const KA = K.KAART || K.default;
  const sp = { x: KA.start.x, z: KA.start.z };
  for (let poging = 0; poging < 8; poging++) {
    pb.weg(false);
    if (!pb.start(sp, {})) continue;
    for (let i = 0; i < 3000; i++) {
      pb.update(0.05, sp, () => false, 9.3);
      const s = pb.stand;
      if (s.fase === 'weg' || s.fase === 'klaar') break;
      if (s.fase === 'deur' && s.nr >= 1 && pb.envelop.visible && pb.persoon.armRechts.boven.rotation.x > 0.95) {
        const d = s.deuren[s.nr];
        // alleen een deur die je van de straat af vrij ziet
        const ux = s.x - d.gx, uz = s.z - d.gz, l = Math.hypot(ux, uz) || 1;
        const cx = s.x + ux / l * 1.5 + (uz / l) * 2.5, cz = s.z + uz / l * 1.5 + (-ux / l) * 2.5;   // rechts van hem: de arm naar de bus
        if (!LP.rechtBeloopbaar(cx, cz, s.x, s.z, 0.25)) continue;
        return { x: s.x, z: s.z, gx: d.gx, gz: d.gz, cx, cz };
      }
    }
  }
  return null;
});
if (!p) { console.log('FOUT: geen deur gevonden'); await browser.close(); process.exit(1); }
// schuin achter hem, van de straatkant
await page.evaluate(async ({ p }) => {
  const W = await import('/js/world.js');
  const g = window.__game, pl = g.player;
  const cx = p.cx, cz = p.cz;    // van de straatkant, iets opzij
  g.sfeer.uur = 9.3;
  const y = 1.6 + W.grondHoogte(cx, cz, 50), ky = 1.05 + W.grondHoogte(p.x, p.z, 50);
  pl.inCar = null; pl.zit = false; pl.fly = false;
  pl.wapenUit = true; if (pl.gun) pl.gun.visible = false;
  pl.pos.set(cx, y - pl.eye, cz);
  pl.yaw = Math.atan2(-(p.x - cx), -(p.z - cz));
  pl.pitch = Math.atan2(ky - y, Math.hypot(p.x - cx, p.z - cz));
  pl.applyCamera();
  W.updateLOD(cx, cz); g.vehicles.lod(cx, cz);
  if (g.grasVeld) g.grasVeld.update(cx, cz, true);
  // de hoofdlus mag hem niet verder laten lopen
  const l2 = g.leven; l2.__u = l2.update; l2.update = () => {};
  g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
  document.getElementById('dialoog').hidden = true;
  const h = document.getElementById('hint'); if (h) { h.textContent = ''; h.style.visibility = 'hidden'; }
  const u = document.getElementById('uitleg'); if (u) u.style.visibility = 'hidden';
  if (g.renderer && g.renderer.shadowMap) g.renderer.shadowMap.needsUpdate = true;
}, { p });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${map}/postbode.png`, timeout: 600000 });
console.log(`${map}/postbode.png`);
await browser.close();
