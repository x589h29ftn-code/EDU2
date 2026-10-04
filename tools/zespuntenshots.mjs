/*
 Foto's van stap 123:

   mes_in_hand.png        het mes in je hand, net na een steek
   gti_showroom.png       de GTI achterin de showroom van Autohuis Lemmerweg
   wapen_bewaker.png      een bewaker van de waterzuivering met het nieuwe geweer
   menu_herspeel.png      het pauzemenu met de lijst om een missie opnieuw te spelen

 Gebruik: npm run server &   node tools/zespuntenshots.mjs 8123 [map] [alleen]
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const poort = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
const alleen = process.argv[4] || null;
const doe = (naam) => !alleen || alleen.split(',').some(a => naam.startsWith(a));
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
  const g = window.__game, v = g.verhaal;
  document.getElementById('overlay').style.display = 'none';
  await g.reliëfAf();
  window.__autoplay = false;
  window.__W = await import('/js/world.js');
  g.sfeer.uur = 13.5;
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) { g.player.health = 100; v.update(dt); } };
  window.__cam = (pos, kijk, ui = false) => {
    const P = g.player;
    P.fly = true;
    P.pos.set(pos.x, pos.y, pos.z);
    P.yaw = Math.atan2(-(kijk.x - pos.x), -(kijk.z - pos.z));
    P.pitch = Math.atan2(kijk.y - pos.y, Math.hypot(kijk.x - pos.x, kijk.z - pos.z));
    P.updateFly(0);
    P.applyCamera();
    window.__W.updateLOD(pos.x, pos.z); g.vehicles.lod(pos.x, pos.z);
    if (g.grasVeld) g.grasVeld.update(pos.x, pos.z, true);
    g.zetSchaduwDoos(kijk.x, kijk.z);
    if (g.renderer.shadowMap) g.renderer.shadowMap.needsUpdate = true;
    document.getElementById('ui').style.display = ui ? '' : 'none';
  };
});
const foto = async (naam) => {
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 600000 });
  console.log(`${map}/${naam}.png`);
};

// ---- het mes in de hand
if (doe('mes')) {
  await page.evaluate(() => {
    const g = window.__game, P = g.player;
    const s = g.start || { x: 0, z: 0 };
    window.__cam({ x: s.x, y: 1.7, z: s.z }, { x: s.x + 10, y: 1.4, z: s.z + 4 }, true);
    P.fly = false; P.wapenUit = false; P.binnen = false;
    if (!P.wapens.includes('mes')) P.wapens.push('mes');
    P.zetWapen('mes');
    P.active = true;
    // in rust, net voor een steek: het lemmet naar voren
  });
  await foto('mes_in_hand');
  await page.evaluate(() => { window.__game.player.active = false; });
}

// ---- de GTI in de showroom
if (doe('gti')) {
  await page.evaluate(() => {
    const g = window.__game;
    window.__cam({ x: 777.5, y: 1.75, z: 127.0 }, { x: 783.6, y: 0.7, z: 132.0 });
  });
  await foto('gti_showroom');
}

// ---- een bewaker met het geweer
if (doe('wapen')) {
  await page.evaluate(async () => {
    const THREE = await import('three');
    const g = window.__game, v = g.verhaal;
    v.__startMissie('bewaking'); window.__stap(4);
    // de bewakers bevroren, en van voren schuin op de eerste
    const d = v.doelen()[0];
    const q = d.getWorldPosition(new THREE.Vector3());
    const voor = d.getWorldDirection(new THREE.Vector3());
    const zij = new THREE.Vector3(-voor.z, 0, voor.x);
    window.__cam({ x: q.x + voor.x * 2.0 + zij.x * 0.9, y: 1.5, z: q.z + voor.z * 2.0 + zij.z * 0.9 }, { x: q.x, y: 1.1, z: q.z });
  });
  await foto('wapen_bewaker');
}

// ---- het pauzemenu met de lijst
if (doe('menu')) {
  await page.evaluate(() => {
    const g = window.__game, v = g.verhaal;
    const s = v.bewaar(); s.volgende = null; s.punt = null;
    Object.assign(s, { missie: 'klaar', fase: 'klaar', huis: 'Koningsspil 20', veteraanKlaar: true, politieautoKlaar: true, brugKlaar: true,
      schriftKlaar: true, raceKlaar: true, schaduwKlaar: true, invalKlaar: true, invalKeus: 2, ronaldKlaar: true, uitzendingKlaar: true });
    g.politie.reset(); v.herstel(s); v.__geenVolgende();
    document.getElementById('ui').style.display = '';
    g.player.active = true;
    g.pauzeer();
  });
  await page.evaluate(() => document.getElementById('menuHerspeel').click());
  await foto('menu_herspeel');
}

await browser.close();
