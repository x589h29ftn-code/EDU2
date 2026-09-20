/*
 Foto's van missie 6, de groene BX:

   bx_marker.png     de M op de kaart bij Tinga State, met Mark eronder
   bx_briefing.png   de briefing: "Een Citroën BX."
   bx_groen.png      de groene BX op het parkeerterrein van VV Sneek
   bx_nieuw.png      dezelfde auto in zijn nieuwe kleur, bij Mark in IJlst

 Gebruik: npm run server &   node tools/bxshots.mjs 8123 [map]
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
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });

const foto = async (naam, wacht = 800) => {
  await page.waitForTimeout(wacht);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 300000 });
  console.log(`${map}/${naam}.png`);
};

// de camera van de speler op een plek zetten en de wereld laten bijtrekken
const kijk = async (px, pz, kx, kz, hoog = 1.7, kijkY = 1.6) => {
  await page.evaluate(({ px, pz, kx, kz, hoog, kijkY }) => {
    const g = window.__game;
    g.player.inCar = null;
    g.player.fly = true;
    g.player.pos.set(px, hoog, pz);
    g.player.yaw = Math.atan2(-(kx - px), -(kz - pz));
    g.player.pitch = Math.atan2(kijkY - hoog, Math.hypot(kx - px, kz - pz));
    g.player.updateFly(0);
  }, { px, pz, kx, kz, hoog, kijkY });
};

await page.evaluate(async () => {
  const { geluid } = await import('/js/audio.js');
  const g = window.__game;
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true;
  window.__autoplay = true;
  g.sfeer.uur = 15; g.sfeer.weer = 'helder';
  g.player.wapenUit = true; if (g.player.gun) g.player.gun.visible = false;
  geluid.start();
  await geluid.laadMissieMuziek();
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) g.verhaal.update(dt); };
  g.verhaal.__startMissie('bx');
  window.__stap(4);
});

// ---------------------------------------------- de M en Mark bij Tinga State
const bijMark = await page.evaluate(() => {
  const m = window.__game.verhaal.mark.groep.position;
  return { x: m.x, z: m.z };
});
await page.evaluate(() => { document.getElementById('uitleg').style.opacity = '1'; });
await kijk(bijMark.x + 5.5, bijMark.z + 5.5, bijMark.x, bijMark.z, 1.75, 1.5);
await foto('bx_marker', 900);

// -------------------------------------------------------------- de briefing
await page.evaluate(() => {
  const g = window.__game;
  const m = g.verhaal.mark.groep.position;
  g.player.fly = false;
  g.player.pos.set(m.x + 2.0, 0, m.z + 2.0);
  g.player.yaw = Math.atan2(-(m.x - g.player.pos.x), -(m.z - g.player.pos.z));
  g.player.applyCamera();
  g.praat();                                  // E: de briefing begint
  // doorklikken tot de regel over de auto zelf
  for (let i = 0; i < 6; i++) g.praat();
});
await foto('bx_briefing', 900);

// --------------------------------------------- de groene BX bij VV Sneek
const bx = await page.evaluate(async () => {
  const g = window.__game;
  // de uitleg van het spel zelf (window.__game.uitleg), niet een tweede
  // exemplaar van de module: alleen die heeft het blokje in beeld gezet
  const uitleg = g.uitleg;
  for (let i = 0; i < 40 && g.verhaal.fase === 'briefing'; i++) g.praat();
  window.__stap(6);
  // het blokje uitleg en de melding weg: die staan al op hun eigen foto
  uitleg.reset();
  // in een headless browser blijft de fade van het blokje hangen; hard zetten
  document.getElementById('uitleg').style.opacity = '0';
  g.hud.melding('', '', 0);
  const a = g.verhaal.bx;
  return { x: a.x, z: a.z, yaw: a.yaw };
});
// schuin van voren: daar zie je de aflopende neus
await kijk(bx.x - Math.sin(bx.yaw + 0.8) * 7.5, bx.z - Math.cos(bx.yaw + 0.8) * 7.5, bx.x, bx.z, 1.9, 0.85);
await foto('bx_groen', 900);

// ------------------------------------------- overgespoten, bij Mark in IJlst
const klaar = await page.evaluate(() => {
  const g = window.__game;
  const a = g.verhaal.bx;
  // instappen, overspuiten zoals de wasbox het doet, en naar IJlst
  g.player.fly = false;
  g.player.pos.set(a.x + 1.2, 0, a.z + 1.2);
  g.praat();
  window.__stap(4);
  g.verhaal.betaal(500);
  g.vehicles.verf(a, g.vehicles.andereKleur(a.kleur));
  window.__stap(6);
  const plek = g.verhaal.bxPlek;
  a.x = plek.x; a.z = plek.z; a.yaw = plek.yaw; a.speed = 0;
  a.mesh.position.set(a.x, 0, a.z); a.mesh.rotation.y = a.yaw;
  g.player.inCar = null;
  g.player.pos.set(a.x + 2, 0, a.z + 2);
  window.__stap(6);
  return { x: a.x, z: a.z, yaw: a.yaw, kleur: a.kleur, fase: g.verhaal.fase };
});
console.log(`nieuwe kleur: #${klaar.kleur.toString(16)} · fase ${klaar.fase}`);
await kijk(klaar.x - Math.sin(klaar.yaw + 0.8) * 8, klaar.z - Math.cos(klaar.yaw + 0.8) * 8, klaar.x, klaar.z, 2.0, 1.0);
await foto('bx_nieuw', 900);

await browser.close();
