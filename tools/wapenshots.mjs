/*
 Foto's van het pistool (js/wapen.js) en van de poppetjes (js/lichaam.js):

   wapen_rust.png       het pistool in de aanslag
   wapen_schot.png      op het moment van het schot, met mondingsvuur
   wapen_magazijn.png   halverwege het herladen: het lege magazijn valt eruit
   wapen_slede.png      de slede gaat naar achteren
   mensen_straat.png    voetgangers op straat
   mensen_agent.png     een agent van dichtbij

 Gebruik: python3 -m http.server 8123 &  node tools/wapenshots.mjs 8123 [map]
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
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });

await page.evaluate(() => {
  localStorage.removeItem('tinga.spel.v1');
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  g.sfeer.uur = 13;
  g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
  window.__zet = (x, z, yaw, pitch = 0) => {
    g.player.inCar = null; g.player.zit = false;
    g.player.pos.set(x, 0, z); g.player.yaw = yaw; g.player.pitch = pitch;
    g.player.applyCamera();
  };
});
await page.waitForTimeout(1200);

const foto = async (naam) => {
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 180000 });
  console.log(`${map}/${naam}.png`);
};

// vanaf de stoep de Molenkrite in kijken: een rustige achtergrond waar het
// wapen goed tegen afsteekt
await page.evaluate(() => window.__zet(34, -30, -0.62, -0.02));

// 1. in de aanslag
await page.evaluate(() => { const g = window.__game; g.player.update(1 / 60); });
await foto('wapen_rust');

// 2. het schot zelf: de slede staat achterin en het mondingsvuur brandt
await page.evaluate(() => {
  const g = window.__game;
  g.player.reloading = 0; g.player.ammo = 12;
  g.player.shoot();
  g.player.update(1 / 240);
});
await foto('wapen_schot');

// 3 en 4. het herladen, op twee momenten in de beweging
for (const [naam, deel] of [['wapen_magazijn', 0.26], ['wapen_slede', 0.78]]) {
  await page.evaluate((d) => {
    const g = window.__game;
    g.player.ammo = 2; g.player.reserve = 60;
    g.player.reloading = 0;
    g.player.reload();
    const totaal = g.player.reloading;
    // tot vlak vóór het gewenste punt doorspoelen en dan één beeld tekenen
    g.player.reloading = totaal * (1 - d);
    g.player.wapen.update(1 / 60, { herlaad: g.player.reloading, bob: 0 });
    g.player.applyCamera();
  }, deel);
  await foto(naam);
}

// 5. voetgangers op straat
const mensen = await page.evaluate(() => {
  const g = window.__game;
  g.player.reloading = 0;
  g.player.wapen.update(1 / 60, { herlaad: 0, bob: 0 });
  // de dichtstbijzijnde wandelaar opzoeken en ervoor gaan staan
  let best = null, bd = 1e9;
  for (const p of g.npcs.people) {
    if (!p.alive || p.fietst) continue;
    const d = Math.hypot(p.x - 34, p.z + 30);
    if (d < bd) { bd = d; best = p; }
  }
  if (!best) return { er: false };
  // schuin vóór hem gaan staan. Let op: een voetganger krijgt in js/npc.js zijn
  // yaw met een halve slag erbij, dus zijn looprichting is (sin yaw, cos yaw).
  const vx = Math.sin(best.yaw), vz = Math.cos(best.yaw);
  const px = best.x + vx * 3.0 - vz * 1.2, pz = best.z + vz * 3.0 + vx * 1.2;
  // hoofdlus uit, anders is hij weggelopen tegen de tijd dat de foto valt
  window.__autoplay = false; g.player.active = false;
  window.__zet(px, pz, Math.atan2(-(best.x - px), -(best.z - pz)), -0.05);
  g.player.gun.visible = false;
  return { er: true, x: best.x, z: best.z };
});
if (mensen.er) console.log(`  wandelaar op ${mensen.x.toFixed(0)}, ${mensen.z.toFixed(0)}`);
await foto('mensen_straat');

// 6. een agent van dichtbij
const agent = await page.evaluate(() => {
  const g = window.__game;
  g.politie.reset();
  g.politie.zetHeat(60);
  g.politie.misdaad('schot', g.player.pos.x, g.player.pos.z);
  for (let i = 0; i < 120; i++) g.politie.update(1 / 30);
  const lijst = g.politie.intern.agenten.filter(a => !a.wagen);
  if (!lijst.length) return { er: false };
  // de hoofdlus uitzetten, anders loopt hij weg tussen het plaatsen en de foto
  window.__autoplay = false; g.player.active = false;
  const a = lijst[0].persoon.groep.position;
  window.__zet(a.x + 2.2, a.z + 1.2, Math.atan2(2.2, 1.2), -0.06);
  g.player.gun.visible = false;
  return { er: true, n: lijst.length };
});
if (agent.er) console.log(`  ${agent.n} agenten`);
await foto('mensen_agent');

await browser.close();
