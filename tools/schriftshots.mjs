/*
 Foto's van missie 13, het schrift:

   schrift_mark.png   een paar dagen later: Mark voor de deur van Parelmoervlinder 3
                      in Duinterpen
   schrift_kade.png   de kade in IJlst: politielint, twee agenten, de sloep
   schrift_boek.png   het schrift op de bank van de sloep, met de markering
   schrift_eind.png   Mark met het schrift: "goud waard"

 Gebruik: npm run server &   node tools/schriftshots.mjs 8123 [map]
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

const foto = async (naam, { gesprek = false, wacht = 1500 } = {}) => {
  await page.evaluate((gesprek) => {
    const g = window.__game;
    g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
    g.hud.melding('', '', 0);
    if (g.uitleg) g.uitleg.update(999);
    if (!gesprek) document.getElementById('dialoog').hidden = true;
    document.getElementById('praat').hidden = true;
    const h = document.getElementById('hint'); if (h) h.textContent = '';
  }, gesprek);
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
  window.__autoplay = true; window.__game.player.active = true;
});
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
}, { x, y, z, kx, ky, kz });

await page.evaluate(async () => {
  const { geluid } = await import('/js/audio.js');
  const g = window.__game;
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true;
  window.__autoplay = true;
  g.sfeer.weer = 'helder'; g.sfeer.uur = 14.5;
  g.reliëfAf();
  geluid.start();
  window.__stap = (n = 20, dt = 0.05) => {
    const v = g.verhaal, f = v.__echteUpdate || v.update;
    for (let i = 0; i < n; i++) f.call(v, dt);
  };
  window.__klik = (max = 40) => {
    for (let i = 0; i < max && !document.getElementById('dialoog').hidden; i++) { g.praat(); window.__stap(2); }
  };
  g.verhaal.startMissie('schrift');
  window.__stap(3);
});

// ------------------------------------------------ Mark in Duinterpen
{
  const d = await page.evaluate(() => {
    const s = window.__game.verhaal.schrift;
    return { d: s.deur, straat: s.deur.straat };
  });
  const dx = d.straat.x - d.d.x, dz = d.straat.z - d.d.z, l = Math.hypot(dx, dz) || 1;
  // vanaf de straat, zeven meter voor de deur en een stukje opzij
  const cx = d.d.x + dx / l * 7 - dz / l * 2.5, cz = d.d.z + dz / l * 7 + dx / l * 2.5;
  await bevries();
  await kamera(cx, 1.7, cz, d.d.x, 1.3, d.d.z);
  await foto('schrift_mark');
  await ontdooi();
}

// ------------------------------------------------- de kade in IJlst
await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, d = v.schrift.deur;
  g.player.inCar = null; g.player.pos.set(d.x + 3, 0, d.z + 1);
  window.__stap(3);
  window.__klik();
  window.__stap(4);
  // de agenten staan stil voor de foto, en kijken niet
  for (const w of v.schutters.wachters) w.kijkT = 999;
});
{
  const k = await page.evaluate(() => window.__game.verhaal.schrift.kade);
  // van de wal af, schuin op de sloep en het lint
  const cx = k.x - k.nx * 11 + k.lx * 6, cz = k.z - k.nz * 11 + k.lz * 6;
  await bevries();
  await kamera(cx, 2.4, cz, k.x + k.nx * 2, 0.4, k.z + k.nz * 2);
  await foto('schrift_kade');
  await ontdooi();
}

// ------------------------------------------------- het schrift in de sloep
{
  const b = await page.evaluate(() => {
    const s = window.__game.verhaal.schrift, p = new (s.boek.groep.position.constructor)();
    s.boek.groep.getWorldPosition(p);
    return { b: { x: p.x, y: p.y, z: p.z }, k: s.kade };
  });
  const cx = b.k.x - b.k.nx * 0.4, cz = b.k.z - b.k.nz * 0.4;
  await bevries();
  await kamera(cx, 1.9, cz, b.b.x, b.b.y, b.b.z);
  await foto('schrift_boek');
  await ontdooi();
}

// ---------------------------------------------- Mark met het schrift
await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, m = v.schrift.merk.groep.position;
  g.player.inCar = null; g.player.pos.set(m.x + 0.4, 0, m.z);
  window.__stap(2); g.praat(); window.__stap(3);
  window.__klik();
  g.politie.reset();
  const d = v.schrift.deur;
  g.player.pos.set(d.x + 3, 0, d.z + 1);
  window.__stap(4);
  for (let i = 0; i < 8 && !/goud waard/.test(document.getElementById('dialoogTekst').textContent); i++) { g.praat(); window.__stap(2); }
});
{
  // vanaf waar Erik staat (daar kijkt Mark naar), een stap terug
  const d = await page.evaluate(() => {
    const g = window.__game, v = g.verhaal, m = v.mark.groep.position, e = g.player.pos;
    return { m: { x: m.x, z: m.z }, e: { x: e.x, z: e.z } };
  });
  const dx = d.e.x - d.m.x, dz = d.e.z - d.m.z, l = Math.hypot(dx, dz) || 1;
  await bevries();
  await kamera(d.m.x + dx / l * (l + 1.2), 1.7, d.m.z + dz / l * (l + 1.2), d.m.x, 1.55, d.m.z);
  await foto('schrift_eind', { gesprek: true });
  await ontdooi();
}

await browser.close();
