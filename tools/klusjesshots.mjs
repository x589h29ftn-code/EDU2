/*
 Foto's van de klusjes (js/klusjes.js, stap 99):

   klus_aanbod.png    Mark op de stoep met een klus, en de groene K op de minikaart
   klus_kaart.png     de grote kaart met het speldje "klus · Mark"
   klus_tas.png       de ontvanger van de tas, op de groene ruit waar je aflevert
   klus_omleggen.png  het doelwit in zijn grijze jasje, met zijn lijfwacht

 Gebruik: npm run server &   node tools/klusjesshots.mjs 8123 [map]
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
// de camera op (x, y, z), kijkend naar (kx, ky, kz); zie tools/schaduwshots.mjs
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
  const { KAART } = await import('/js/kaart.js');
  const g = window.__game, v = g.verhaal;
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  g.sfeer.weer = 'helder'; g.sfeer.uur = 15;
  g.reliëfAf();
  window.__autoplay = false; g.player.active = false;
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) { g.player.health = 100; v.update(dt); } };
  window.__klik = (max = 40) => { for (let i = 0; i < max && !document.getElementById('dialoog').hidden; i++) { v.toets(); window.__stap(1); } };
  window.__zet = (x, z) => { g.player.inCar = null; g.player.pos.set(x, 0, z); g.player.applyCamera(); };
  window.__klaar = () => {
    const s = v.bewaar(); s.missie = 'klaar'; s.fase = 'klaar'; s.volgende = null;
    v.herstel(s); v.__geenVolgende(); g.politie.reset();
    window.__zet(KAART.start.x, KAART.start.z);
  };
  window.__neemAan = (soort) => {
    const kl = v.klusjes;
    kl.__soort(soort);
    if (!kl.__nieuwAanbod()) return null;
    const a = kl.aanbod;
    window.__zet(a.x + 1.2, a.z);
    window.__stap(2); v.toets(); window.__klik();
    return kl.klus;
  };
  window.__klaar();
});

// ------------------------------------------------------ het aanbod
{
  const p = await page.evaluate(() => {
    const g = window.__game, v = g.verhaal, kl = v.klusjes;
    // tot Mark het aanbod doet (Johan kan ook: we willen Mark op de foto)
    for (let i = 0; i < 10; i++) { kl.__soort('tas'); kl.__nieuwAanbod(); if (kl.aanbod && kl.aanbod.wie === 'mark') break; }
    const a = kl.aanbod;
    // camera: zeven meter verderop langs de stoep, op ooghoogte, naar hem toe
    const yaw = kl.gever ? kl.gever.groep.rotation.y : 0;
    const vx = -Math.sin(yaw), vz = -Math.cos(yaw);            // waar hij heen kijkt: de straat
    return { a, cam: { x: a.x + vx * 6.5 + vz * 2.5, z: a.z + vz * 6.5 - vx * 2.5 } };
  });
  // hij zwaait als je dichterbij komt: een paar beelden bijwerken met de speler daar
  await page.evaluate(({ cam }) => { window.__zet(cam.x, cam.z); window.__stap(30); }, p);
  await kamera(p.cam.x, 1.65, p.cam.z, p.a.x, 1.25, p.a.z);
  await foto('klus_aanbod');
  // de grote kaart
  await page.evaluate(() => { const g = window.__game, h = g.hud; if (!h.bigOpen) h.toggleBig(); h.drawBig(g.player, g.vehicles); });
  await foto('klus_kaart', { wacht: 2500 });
  await page.evaluate(() => { window.__game.hud.toggleBig(); });
}

// ------------------------------------------------------ de ontvanger van de tas
{
  const p = await page.evaluate(() => {
    const k = window.__neemAan('tas');
    const d = k.doel;
    return { d, cam: { x: d.x + d.langs.x * 7 + Math.sin(d.yaw) * 3, z: d.z + d.langs.z * 7 + Math.cos(d.yaw) * 3 } };
  });
  await page.evaluate(({ cam }) => { window.__zet(cam.x, cam.z); window.__stap(4); document.getElementById('dialoog').hidden = true; }, p);
  await kamera(p.cam.x, 1.7, p.cam.z, p.d.x, 1.0, p.d.z);
  await foto('klus_tas');
  await page.evaluate(() => { window.__game.verhaal.klusAfbreken(); window.__stap(2); });
}

// ------------------------------------------------------ het doelwit met zijn lijfwacht
{
  const p = await page.evaluate(() => {
    const v = window.__game.verhaal;
    let k = null;
    for (let i = 0; i < 8; i++) {
      window.__klaar();
      k = window.__neemAan('omleggen');
      if (k && k.lijfwacht) break;
      v.klusAfbreken();
    }
    // ze lopen een paar tellen hun rondje, en de camera staat buiten hun zicht
    window.__stap(20);
    const w = k.bewaking.wachters[0].persoon.groep.position;
    const d = k.doel;
    return { w: { x: w.x, z: w.z }, cam: { x: w.x + d.langs.x * 11 + Math.sin(d.yaw) * 4, z: w.z + d.langs.z * 11 + Math.cos(d.yaw) * 4 } };
  });
  await page.evaluate(() => {
    // bevriezen: anders lopen ze uit beeld terwijl de foto gemaakt wordt
    const v = window.__game.verhaal;
    if (!v.__echteUpdate) { v.__echteUpdate = v.update; v.update = () => {}; }
  });
  await kamera(p.cam.x, 1.7, p.cam.z, p.w.x, 1.1, p.w.z);
  await foto('klus_omleggen');
}

await browser.close();
