/*
 Foto's van de bende van De Veteraan op straat, na missie 10:

   bende_hangen.png    een groepje dat op de stoep rondhangt, knuppels en een pistool
   bende_aanval.png    te dichtbij gekomen: een knuppel haalt uit, een pistool mikt

 Gebruik: npm run server &   node tools/bendeshots.mjs 8123 [map]
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
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 600000 });
await page.waitForFunction(() => window.__game, null, { timeout: 600000 });

const foto = async (naam, wacht = 900) => {
  await page.evaluate(() => {
    const g = window.__game;
    g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
    g.hud.melding('', '', 0);
    g.hud.flitsT = 0; if (g.hud.flitsEl) g.hud.flitsEl.style.opacity = 0;
    if (g.uitleg) g.uitleg.update(999);
    g.player.health = 100; g.hud.zetLeven(100);
  });
  await page.waitForTimeout(wacht);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 600000 });
  console.log(`${map}/${naam}.png`);
};

await page.evaluate(async () => {
  const { zichtVrij } = await import('/js/world.js');
  const g = window.__game;
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true;
  window.__autoplay = true;
  g.sfeer.uur = 16; g.sfeer.weer = 'helder';
  g.player.wapenUit = true; if (g.player.gun) g.player.gun.visible = false;
  g.verhaal.herstel({ missie: 'klaar', fase: 'klaar', huis: 'Koningsspil 20', veteraanKlaar: true, geld: 1000 });
  const b = g.verhaal.bendes;
  b.opduiken = false;
  b.reset();
  // een plek met vrij zicht vanaf veertien meter: daar komt de camera
  let p = null, cam = null;
  for (const a of b.plekken) {
    for (let i = 0; i < 16 && !cam; i++) {
      const h = (i / 16) * Math.PI * 2;
      const c = { x: a.x + Math.cos(h) * 14, z: a.z + Math.sin(h) * 14 };
      if (zichtVrij(c.x, c.z, a.x, a.z, 1.4) && zichtVrij(c.x, c.z, a.x, a.z, 0.6)) cam = c;
    }
    if (cam) { p = a; break; }
  }
  window.__plek = { p, cam };
  const gr = b.zetGroep(p.x, p.z, 4);
  window.__groep = gr;
  // camera en speler op veertien meter: net buiten TE_DICHT (13 m)
  g.player.inCar = null; g.player.pos.set(cam.x, 0, cam.z);
  g.player.yaw = Math.atan2(-(p.x - cam.x), -(p.z - cam.z));
  g.player.pitch = -0.04;
  g.player.applyCamera();
  for (let i = 0; i < 40; i++) g.verhaal.update(0.05);
});
await foto('bende_hangen');

// dichterbij: ze vallen aan. Stilzetten op het moment dat een knuppel uithaalt.
await page.evaluate(() => {
  const g = window.__game;
  const { p, cam } = window.__plek;
  const ux = (p.x - cam.x) / 14, uz = (p.z - cam.z) / 14;
  g.player.pos.set(cam.x + ux * 6, 0, cam.z + uz * 6);
  g.player.applyCamera();
  const gr = window.__groep;
  for (let i = 0; i < 200; i++) {
    g.verhaal.update(0.05);
    // wie staat er met de knuppel omhoog?
    if (gr.leden.some(l => l.slag > 0.25 && l.slag < 0.4)) break;
  }
  g.player.health = 100;
  const v = g.verhaal; v.__echteUpdate = v.update; v.update = () => {};
});
await foto('bende_aanval', 300);

await browser.close();
