/*
 Foto's van missie 18, De uitzending (stap 107):

   studio_binnen.png      de studio van Radio Tinga, vanuit de hoek bij de deur (zoals de foto van
                          de gebruiker): het gebogen bureau, de schermen, de microfoons, de luidsprekers
   studio_tafel.png       achter de stoel: de usb-stick in het mengpaneel, de rode schuif omhoog
   studio_buiten.png      het pand aan de Tinga met de zuil en de zendmast op het dak
   uitzending_mast.png    het laatste shot van de montage: hoog over Tinga naar de mast
   uitzending_einde.png   het einde: Erik, Mark en Johan voor de Wieken 29 bij zonsondergang
   uitzending_titelrol.png  de titelrol

 Gebruik: npm run server &   node tools/uitzendingshots.mjs 8123 [map]
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

const foto = async (naam, { wacht = 1500, ui = false } = {}) => {
  await page.evaluate((ui) => {
    const g = window.__game;
    g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
    g.hud.missieT = 0; g.hud.missieEl.style.transition = 'none'; g.hud.missieEl.style.opacity = 0;
    if (!ui) document.getElementById('dialoog').hidden = true;
    document.getElementById('praat').hidden = true;
    document.getElementById('schaduwbalk').hidden = true;
    const h = document.getElementById('hint'); if (h) { h.textContent = ''; h.style.visibility = 'hidden'; }
    const u = document.getElementById('uitleg'); if (u) u.style.visibility = 'hidden';
    if (g.renderer && g.renderer.shadowMap) g.renderer.shadowMap.needsUpdate = true;
  }, ui);
  await page.waitForTimeout(wacht);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 600000 });
  console.log(`${map}/${naam}.png`);
};
const bevries = () => page.evaluate(() => {
  const v = window.__game.verhaal;
  if (!v.__echteUpdate) { v.__echteUpdate = v.update; v.update = () => {}; }
});
const ontdooi = () => page.evaluate(() => {
  const v = window.__game.verhaal;
  if (v.__echteUpdate) { v.update = v.__echteUpdate; v.__echteUpdate = null; }
});
// de camera op (x, y, z), kijkend naar (kx, ky, kz): via de speler, zoals in tools/invalshots.mjs
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
  g.studio.update(0.1, true);
}, { x, y, z, kx, ky, kz });

await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  g.reliëfAf();
  window.__autoplay = false; g.player.active = false;
  g.sfeer.weer = 'helder'; g.sfeer.uur = 9;
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) { g.player.health = 100; (v.__echteUpdate || v.update).call(v, dt); g.studio.update(dt, false); if (v.uitzending.filmCam) window.__cam = v.uitzending.filmCam; } };
});
const P = await page.evaluate(() => {
  const st = window.__game.studio;
  return { ...st.plekken, maten: st.maten };
});
const N = P.nul, C = { x: N.x + P.maten.stoel.x, z: N.z + P.maten.stoel.z };

// ------------------------------------------------------------------ binnen
await kamera(N.x + 1.9, 1.62, N.z + 1.35, C.x + 0.6, 0.95, C.z + 0.9);
await foto('studio_binnen');

await page.evaluate(() => { const st = window.__game.studio; st.zetUsb(true); st.zetSchuif(1); st.zetOnAir(true); st.dj.groep.visible = false; st.djStaat(); });
{
  const pan = await page.evaluate(() => {
    const st = window.__game.studio, v = st.panelen[0].position, g = st.groep.position;
    return { x: g.x + v.x, z: g.z + v.z };
  });
  await kamera(C.x - 0.75, 1.32, C.z - 0.55, pan.x + 0.05, 0.82, pan.z);
  await foto('studio_tafel');
}

// ------------------------------------------------------------------ buiten
{
  const d = P.deurBuiten, f = P.f, r = P.r;
  await kamera(d.x + f[0] * 17 - r[0] * 7, 1.75, d.z + f[1] * 17 - r[1] * 7, d.x + r[0] * 4 - f[0] * 8, 5.5, d.z + r[1] * 4 - f[1] * 8);
  await foto('studio_buiten');
  // en het laatste shot van de montage: hoog over Tinga naar de mast (zie montageShots in js/verhaal.js)
  const m = P.mast;
  await kamera(m.x - 140, 64, m.z + 105, m.x, m.top - 4, m.z);
  await foto('uitzending_mast');
}
await page.evaluate(() => { const st = window.__game.studio; st.zetUsb(false); st.zetSchuif(0); st.zetOnAir(false); st.djAanTafel(); });

// ------------------------------------------------------------------ het einde
await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  v.startMissie('uitzending');
  const s = v.bewaar(); s.missie = 'uitzending'; s.fase = 'einde'; s.uitzendingKlaar = true; s.ronaldKlaar = true;
  v.herstel(s);
  window.__cam = null;
  window.__stap(Math.round(8.5 / 0.05));
});
{
  const c = await page.evaluate(() => window.__cam);
  await bevries();
  if (c) await kamera(c.pos[0], c.pos[1], c.pos[2], c.kijk[0], c.kijk[1], c.kijk[2]);
  await page.evaluate(() => document.body.classList.add('film'));
  await foto('uitzending_einde', { ui: true });
  await ontdooi();
}
await page.evaluate(() => {
  const v = window.__game.verhaal;
  for (let t = 0; t < 30 && !v.uitzending.titelrol; t += 0.1) window.__stap(1, 0.1);
  window.__stap(Math.round(4 / 0.1), 0.1);
});
await foto('uitzending_titelrol', { wacht: 600 });

await browser.close();
