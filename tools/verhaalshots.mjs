/*
 Maakt de foto's van het verhaal: het startpunt voor Molenkrite 15, het gesprek
 met Mark, de opdracht bij de bierdrinkers, de route op de kaart, de bewaking op
 het RWZI-terrein en de afgeleverde lading bij de boerderij.

 Gebruik: python3 -m http.server 8123 &  node tools/verhaalshots.mjs 8123 [map]
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const port = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
mkdirSync(map, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
await page.evaluate(() => {
  localStorage.removeItem('tinga.spel.v1');
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  window.__game.player.active = true;
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) window.__game.verhaal.update(dt); };
  // camera op een punt zetten en naar een doel laten kijken
  window.__kijk = (x, z, dx, dz, pitch = -0.05) => {
    const g = window.__game;
    g.player.pos.set(x, 0, z);
    g.player.yaw = Math.atan2(-(dx - x), -(dz - z));
    g.player.pitch = pitch;
    g.player.applyCamera();
  };
});
await page.waitForTimeout(2000);

const foto = async (naam) => {
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${map}/${naam}.png` });
  console.log(`${map}/${naam}.png`);
};

// 1. het startpunt: Mark staat voor Molenkrite 15 en zwaait
await page.evaluate(() => window.__stap(30));
await foto('molenkrite15');

// 2. het gesprek
await page.keyboard.press('KeyE');
await foto('molenkrite15_gesprek');

// 3. de opdracht bij de bierdrinkers
await page.keyboard.press('KeyE');
await page.evaluate(() => {
  const g = window.__game;
  for (let i = 0; i < 2000 && g.verhaal.fase === 'loopt'; i++) {
    g.verhaal.update(0.05);
    const p = g.verhaal.mark.groep.position;
    g.player.pos.set(p.x + 2.8, 0, p.z + 2.6);
  }
  window.__stap(60);
  const b = g.verhaal.mark.groep.position;
  window.__kijk(g.player.pos.x, g.player.pos.z, b.x, b.z);
});
await foto('molenkrite15_bevel');

// 4. de kaart met de route naar de waterzuivering (missie 2)
await page.keyboard.press('KeyE');                       // "Schiet ze neer!" wegklikken
await page.evaluate(() => {
  const g = window.__game;
  for (const o of [...g.verhaal.doelen()]) g.verhaal.raak(o);
  window.__stap(40);
});
for (let i = 0; i < 3; i++) await page.keyboard.press('KeyE');   // de briefing doorklikken
await page.evaluate(() => {
  const g = window.__game;
  window.__stap(60);
  g.hud.toggleBig();
});
await foto('kaart_route');

// 5. de bewaking op het RWZI-terrein
await page.evaluate(() => {
  const g = window.__game;
  g.hud.toggleBig();
  const auto = g.verhaal.auto;
  g.player.pos.set(auto.x + 1.2, 0, auto.z + 1.2);
  g.praat();                                             // instappen
  const nav = g.hud.nav;
  const punt = nav.route[Math.max(0, nav.route.length - 4)];
  auto.x = punt[0]; auto.z = punt[1]; auto.speed = 3;
  window.__stap(40);                                     // aankomen en uitstappen
});
await page.keyboard.press('KeyE');                       // "Shit, bewaking" wegklikken
await page.evaluate(() => {
  const g = window.__game;
  window.__stap(60);
  // vanaf de poort het terrein in kijken, met de vrachtwagen en de bewakers
  const poort = g.verhaal.plekken.poort, v = g.verhaal.plekken.poortVooruit;
  const truck = g.verhaal.truck;
  window.__kijk(poort.x - v[0] * 6, poort.z - v[1] * 6, truck.x, truck.z, 0.0);
  window.__stap(30);
});
await foto('rwzi_bewaking');

// 6. het vuurgevecht: binnen het hek komen ze op je af
await page.evaluate(() => {
  const g = window.__game;
  const w = g.verhaal.bewaking.wachters[1].persoon.groep.position;
  window.__kijk(w.x + 9, w.z + 9, w.x, w.z, -0.03);
  g.player.health = 100;
  for (let i = 0; i < 200 && g.player.health > 55; i++) {
    g.verhaal.update(0.05);
    const p = g.verhaal.bewaking.wachters[1].persoon.groep.position;
    window.__kijk(g.player.pos.x, g.player.pos.z, p.x, p.z, -0.03);
  }
});
await foto('rwzi_vuurgevecht');

// 7. afleveren bij de boerderij
await page.evaluate(() => {
  const g = window.__game;
  for (const o of [...g.verhaal.bewaking.doelen()]) g.verhaal.raak(o);
  window.__stap(40);
});
await page.keyboard.press('KeyE');                       // "Alle vijf neer" wegklikken
await page.evaluate(() => {
  const g = window.__game;
  window.__stap(20);
  const truck = g.verhaal.truck, schuur = g.verhaal.plekken.schuur;
  // de vrachtwagen op het laatste stuk van de route naar de schuur zetten,
  // net binnen de afleverafstand
  const route = g.hud.nav && g.hud.nav.route ? g.hud.nav.route : [];
  let plek = { x: schuur.x + 14, z: schuur.z + 10 };
  for (let i = route.length - 1; i >= 0; i--) {
    const d = Math.hypot(route[i][0] - schuur.x, route[i][1] - schuur.z);
    if (d > 15 && d < 19) { plek = { x: route[i][0], z: route[i][1] }; break; }
  }
  truck.x = plek.x; truck.z = plek.z; truck.speed = 0;
  truck.mesh.position.set(truck.x, 0, truck.z);
  truck.yaw = Math.atan2(-(schuur.x - truck.x), -(schuur.z - truck.z));
  truck.mesh.rotation.y = truck.yaw;
  g.player.pos.set(truck.x, 0, truck.z);
  window.__stap(20);                                     // dit voltooit de missie
  // vanaf achter de vrachtwagen naar de schuur kijken
  const terug = { x: truck.x + Math.sin(truck.yaw) * 12, z: truck.z + Math.cos(truck.yaw) * 12 };
  window.__kijk(terug.x, terug.z, schuur.x, schuur.z, 0.03);
  window.__stap(10);
});
await foto('boerderij_afgeleverd');

await browser.close();
