/*
 Maakt de foto's van het verhaal: het startpunt voor Molenkrite 15, het gesprek
 met Mark, de opdracht bij de bierdrinkers, de route op de kaart, de bewaking op
 het RWZI-terrein, de afgeleverde lading bij de boerderij, en dan missie 5: het
 telefoontje van Johan, zijn briefing op de oprit van Kruirad 62, de dief van De
 Wieken 27, de achtervolging en de beloning. Tot slot de woning achter de
 voordeur van Molenkrite 15: de gang, de woonkamer, de tv en het keukenblok.

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
  // met de grote kaart open duurt één beeld in swiftshader soms een minuut;
  // de standaard van dertig seconden is dan te kort
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 180000 });
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

// ---------- missie 5: Johan en de dief ----------
// 8. het telefoontje
await page.evaluate(() => { window.__stap(230); });     // vijf seconden pauze, dan de telefoon
await foto('johan_telefoon');

// 9. de briefing op de oprit van Kruirad 62
await page.keyboard.press('KeyE');
await page.evaluate(() => {
  const g = window.__game;
  const j = g.verhaal.plekken.johan, f = g.verhaal.plekken.johanFront;
  g.player.inCar = null;
  g.player.pos.set(j.x + f[0] * 5, 0, j.z + f[1] * 5);   // op de stoep, kijkend naar zijn oprit
  window.__stap(20);
  const p = g.verhaal.johan.groep.position;
  window.__kijk(g.player.pos.x, g.player.pos.z, p.x, p.z, -0.02);
  window.__stap(10);
});
await foto('johan_briefing');

// 10. de dief op het trottoir van De Wieken
for (let i = 0; i < 4; i++) await page.keyboard.press('KeyE');
await page.evaluate(() => {
  const g = window.__game;
  const d = g.verhaal.dief.positie;
  window.__kijk(d.x + 8, d.z + 8, d.x, d.z, -0.04);
  window.__stap(6);
});
await foto('dief_wieken');

// 11. de achtervolging: rood knipperende opdracht en de dief op de vlucht
await page.evaluate(() => {
  const g = window.__game;
  const d = g.verhaal.dief;
  window.__stap(80);                                    // schrikken en wegklikken
  // een paar seconden meerennen
  for (let i = 0; i < 90; i++) {
    g.verhaal.update(1 / 30);
    const p = d.positie;
    let dx = p.x - g.player.pos.x, dz = p.z - g.player.pos.z;
    const a = Math.hypot(dx, dz);
    if (a > 6) {
      const stap = Math.min(a - 6, 7.5 / 30);
      g.player.pos.set(g.player.pos.x + dx / a * stap, 0, g.player.pos.z + dz / a * stap);
    }
    window.__kijk(g.player.pos.x, g.player.pos.z, p.x, p.z, -0.04);
  }
});
await foto('dief_achtervolging');

// 12. gepakt, en de beloning bij Johan
await page.evaluate(() => {
  const g = window.__game;
  const d = g.verhaal.dief;
  d.vluchtT = 95;
  for (let i = 0; i < 60; i++) g.verhaal.update(0.05);
  g.player.pos.set(d.positie.x + 1.2, 0, d.positie.z + 0.6);
  window.__stap(10);
  window.__kijk(g.player.pos.x + 1.5, g.player.pos.z + 1.5, d.positie.x, d.positie.z, -0.18);
  window.__stap(5);
});
await foto('dief_gepakt');

await page.keyboard.press('KeyE');
await page.evaluate(() => {
  const g = window.__game;
  window.__stap(60);
  const j = g.verhaal.plekken.johan, f = g.verhaal.plekken.johanFront;
  g.player.pos.set(j.x + f[0] * 5, 0, j.z + f[1] * 5);
  window.__stap(15);
});
for (let i = 0; i < 3; i++) await page.keyboard.press('KeyE');
await page.evaluate(() => {
  const g = window.__game;
  const p = g.verhaal.johan.groep.position;
  window.__kijk(g.player.pos.x, g.player.pos.z, p.x, p.z, -0.02);
  window.__stap(8);
});
await foto('johan_beloning');

// ---------- achter de voordeur van Molenkrite 15 ----------
// De meldingen van de vorige missie staan er in een trage browser nog: die
// faden op beeldsnelheid en niet op de klok. Even wegzetten.
const schoonHud = () => page.evaluate(() => {
  const h = window.__game.hud;
  h.msgT = 0; h.msg.style.opacity = 0;
  h.missieT = 0; h.missieEl.style.opacity = 0;
});

// 13. buiten voor de deur, met de hint in beeld
await page.evaluate(() => {
  const g = window.__game, p = g.interieur.plekken;
  g.player.inCar = null;
  window.__kijk(p.stoep.x, p.stoep.z, p.deurBuiten.x, p.deurBuiten.z, -0.02);
  g.interieur.update(0.05, false);
});
await schoonHud();
await foto('molenkrite15_voordeur');

// 14. binnen: de gang met de blokjes en de voordeur
await page.evaluate(() => {
  const g = window.__game, n = g.interieur.plekken.nul;
  g.praat();                                     // E: naar binnen
  window.__kijk(n.x + 0.98, n.z + 3.3, n.x + 0.98, n.z + 0.2, -0.02);
  g.hud.kaartVanaf = g.interieur.kaart(g.player.pos.x, g.player.pos.z).punt;
  g.interieur.update(0.05, false);
});
await schoonHud();
await foto('binnen_gang');

// 15. de woonkamer met de bank en de tuindeur
await page.evaluate(() => {
  const g = window.__game, n = g.interieur.plekken.nul;
  window.__kijk(n.x + 1.7, n.z + 4.2, n.x + 4.7, n.z + 6.8, -0.06);
});
await schoonHud();
await foto('binnen_woonkamer');

// 16. de tv aan de andere kant, met de keuken achterin
await page.evaluate(() => {
  const g = window.__game, n = g.interieur.plekken.nul;
  window.__kijk(n.x + 4.6, n.z + 6.4, n.x + 0.4, n.z + 6.4, -0.02);
});
await schoonHud();
await foto('binnen_tv');

// 17. het keukenblok in de aanbouw
await page.evaluate(() => {
  const g = window.__game, n = g.interieur.plekken.nul;
  window.__kijk(n.x + 1.4, n.z + 8.7, n.x + 0.9, n.z + 13.0, -0.03);
});
await schoonHud();
await foto('binnen_keuken');

await browser.close();
