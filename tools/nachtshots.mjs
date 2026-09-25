/*
 Foto's van de nacht op straat (ronde van 25 sep 2026):

   nacht_straat.png     de Molenkrite om elf uur: plassen licht onder de palen,
                        de geparkeerde auto's met hun lampen uit
   nacht_verkeer.png    een wijkauto die 's nachts aan komt rijden, met zijn
                        lampen aan en de bundel op de weg

 Gebruik: npm run server &   node tools/nachtshots.mjs 8123 [map]
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
  window.__W = await import('/js/world.js');
  const g = window.__game;
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true; window.__autoplay = true;
  g.player.wapenUit = true; if (g.player.gun) g.player.gun.visible = false;
  g.reliëfAf();
});
const zet = (x, z, naarX, naarZ, pitch, oogY = 0) => page.evaluate(({ x, z, naarX, naarZ, pitch, oogY }) => {
  const g = window.__game, p = g.player;
  g.sfeer.uur = 23; g.sfeer.weer = 'helder';
  for (let i = 0; i < 5; i++) g.sfeer.update(0.1, x, z);
  g.werkOmgevingBij(7);
  p.inCar = null; p.pos.set(x, oogY, z);
  p.yaw = Math.atan2(-(naarX - x), -(naarZ - z)); p.pitch = pitch;
  p.applyCamera();
  window.__W.updateLOD(g.camera.position.x, g.camera.position.z);
  g.vehicles.lod(g.camera.position.x, g.camera.position.z);
  if (g.grasVeld) g.grasVeld.update(g.camera.position.x, g.camera.position.z, true);
  g.zetSchaduwDoos(g.camera.position.x, g.camera.position.z);
  if (g.werkLantaarnsBij) g.werkLantaarnsBij(0.1, x, z);
  g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
  if (g.uitleg) g.uitleg.update(999);
}, { x, z, naarX, naarZ, pitch, oogY });
const foto = async (naam) => {
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 600000 });
  console.log(`${map}/${naam}.png`);
};

const s = await page.evaluate(() => ({ x: window.__game.start.x, z: window.__game.start.z, yaw: window.__game.start.yaw || 0 }));
const vx = -Math.sin(s.yaw), vz = -Math.cos(s.yaw);
// een paal aan een rechte straat: een punt zestien meter ervandaan op de rijbaan,
// en aan de andere kant van de paal ligt de rijbaan ook — daar kijken we langs
const plek = await page.evaluate(async () => {
  const W = window.__W, KW = await import('/js/kaartwereld.js'), s = window.__game.start;
  const rijbaan = (x, z) => { const v = KW.vlakOp(x, z); return v && v.k === 'rijbaan'; };
  const L = W.lampPosities.map(l => ({ l, d: Math.hypot(l.x - s.x, l.z - s.z) })).filter(o => o.d < 400).sort((a, b) => a.d - b.d);
  for (const { l } of L) for (let k = 0; k < 24; k++) {
    const h = k / 24 * Math.PI * 2, dx = Math.cos(h), dz = Math.sin(h);
    const ok = [16, 12, 8, -8, -16, -24].every(t => rijbaan(l.x + dx * t - dz * 3, l.z + dz * t + dx * 3));
    if (ok) return { x: l.x + dx * 16 - dz * 3, z: l.z + dz * 16 + dx * 3, nx: l.x - dx * 30, nz: l.z - dz * 30 };
  }
  return null;
});
if (plek) await zet(plek.x, plek.z, plek.nx, plek.nz, -0.1);
console.log(plek ? `straat: (${plek.x.toFixed(0)}, ${plek.z.toFixed(0)})` : 'geen rechte straat met een paal gevonden');
await foto('nacht_straat');

// een wijkauto: het verkeer stilzetten, en de camera een meter of twintig vóór hem op de weg
const auto = await page.evaluate(() => {
  const g = window.__game, v = g.vehicles;
  // eerst een paar seconden rijden, zodat ze op hun baan staan
  for (let i = 0; i < 30; i++) v.updateTraffic(0.05, null, [], g.start.x, g.start.z);
  const t = v.traffic.filter(q => q.lokaal && q._pos).sort((a, b) => Math.hypot(a._pos.x - g.start.x, a._pos.y - g.start.z) - Math.hypot(b._pos.x - g.start.x, b._pos.y - g.start.z))[0];
  v.updateTraffic = () => {};                       // bevriezen voor de foto
  return { x: t._pos.x, z: t._pos.y, dx: t._dir.x, dz: t._dir.y };
});
await zet(auto.x + auto.dx * 22 + auto.dz * 2.5, auto.z + auto.dz * 22 - auto.dx * 2.5, auto.x, auto.z, -0.1);
await foto('nacht_verkeer');
await browser.close();
