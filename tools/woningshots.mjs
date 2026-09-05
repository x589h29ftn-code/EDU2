/*
 Foto's van de twee woningen waar je naar binnen kunt (js/interieur.js).

   wieken29_voordeur.png  buiten voor de deur van de Wieken 29
   wieken29_woonkamer.png binnen: de woonkamer met uitzicht door de pui
   wieken29_keuken.png    het keukenblok in de aanbouw
   wieken29_bank.png      vanaf de bank, met de tv voor je
   wieken29_avond.png     dezelfde kamer als het buiten donker is
   wieken29_uitzicht.png  van binnen door de pui: de overkant van de straat
   wieken29_katten.png    de twee katten in de kamer
   binnen_uitzicht.png    Molenkrite 15: de buren door de tuindeur

 Gebruik: python3 -m http.server 8123 &  node tools/woningshots.mjs 8123 [map]
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
  const g = window.__game;
  g.player.active = true;
  g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
  // vanaf `van` naar `naar` kijken, in kamermaten van woning `i`
  window.__inKamer = (i, van, naar, pitch = 0) => {
    const h = g.woningen[i], nul = h.plekken.nul;
    const p = { x: nul.x + van[0], z: nul.z + van[1] };
    const q = { x: nul.x + naar[0], z: nul.z + naar[1] };
    g.player.zit = false; g.player.eye = g.player.eyeStaand;
    g.player.inCar = null;
    g.player.pos.set(p.x, 0, p.z);
    g.player.yaw = Math.atan2(-(q.x - p.x), -(q.z - p.z));
    g.player.pitch = pitch;
    g.player.applyCamera();
    h.update(0.1, false);
  };
  window.__buiten = (van, naar, pitch = 0) => {
    g.player.zit = false; g.player.eye = g.player.eyeStaand;
    g.player.inCar = null;
    g.player.pos.set(van.x, 0, van.z);
    g.player.yaw = Math.atan2(-(naar.x - van.x), -(naar.z - van.z));
    g.player.pitch = pitch;
    g.player.applyCamera();
  };
});
await page.waitForTimeout(1500);

const foto = async (naam) => {
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 180000 });
  console.log(`${map}/${naam}.png`);
};

// 1. buiten voor de deur van de Wieken 29
await page.evaluate(() => {
  const g = window.__game, p = g.woningen[1].plekken;
  const ver = { x: p.deurBuiten.x + (p.stoep.x - p.deurBuiten.x) * 1.05,
                z: p.deurBuiten.z + (p.stoep.z - p.deurBuiten.z) * 1.05 };
  window.__buiten(ver, p.deurBuiten, 0.05);
  g.woningen[1].update(0.1, false);
});
await foto('wieken29_voordeur');

// 2. de woonkamer, met de pui in beeld
const maten = await page.evaluate(() => {
  const m = window.__game.woningen[1].maten;
  window.__inKamer(1, [m.breed - 1.4, m.diep - 6.2], [m.breed / 2 + 0.6, 0.3], -0.02);
  return m;
});
await foto('wieken29_woonkamer');

// 2b. vlak voor de pui: wat zie je door het glas?
await page.evaluate(() => {
  const g = window.__game, m = g.woningen[1].maten;
  window.__inKamer(1, [m.breed * 0.66, 2.4], [m.breed * 0.66, -8], 0.02);
});
await foto('wieken29_uitzicht');

// 3. de keuken in de aanbouw
await page.evaluate(() => {
  const g = window.__game, k = g.woningen[1].plekken.keuken;
  window.__inKamer(1, [k.x1 - 0.2, k.z0 + 0.6], [k.x0, k.z1 - 0.9], -0.06);
});
await foto('wieken29_keuken');

// 4. op de bank
await page.evaluate(() => {
  const g = window.__game, h = g.woningen[1];
  const nul = h.plekken.nul;
  g.player.pos.set(h.plekken.bank.x + 1.2, 0, h.plekken.bank.z);
  g.player.applyCamera();
  h.toets();                                    // gaat zitten
  h.update(0.1, false);
  return { zit: g.player.zit, oog: g.player.eye };
});
await foto('wieken29_bank');

// 5. dezelfde kamer 's avonds. De klok van het spel gaat naar middernacht;
// js/interieur.js kijkt elk beeld of het buiten donker is en doet de lamp aan.
const avond = await page.evaluate(() => {
  const g = window.__game, h = g.woningen[1], m = h.maten;
  h.toets();                                    // opstaan
  g.sfeer.uur = 0;
  window.__inKamer(1, [m.breed - 1.4, m.diep - 6.2], [m.breed / 2 + 0.6, 0.3], -0.02);
  h.update(0.1, false);
  return { nacht: g.sfeer.nacht, lampAan: h.nacht };
});
console.log(`  nacht: ${avond.nacht}, lamp aan: ${avond.lampAan}`);
await foto('wieken29_avond');

// 5b. de katten. Ze lopen rond, dus we draaien de kamer even door en gaan
// daarna bij de dichtstbijzijnde kijken.
const kat = await page.evaluate(() => {
  const g = window.__game, h = g.woningen[1];
  g.sfeer.uur = 13;
  for (let i = 0; i < 900; i++) h.update(1 / 30, false);
  const lijst = h.katten;
  if (!lijst.length) return { er: false };
  const nul = h.plekken.nul;
  const m = h.maten;
  const k = lijst[0];
  // vanaf het midden van de kamer naar de kat toe, op twee meter afstand
  const mx = m.breed / 2, mz = m.diep * 0.4;
  const dx = mx - k.x, dz = mz - k.z, d = Math.hypot(dx, dz) || 1;
  const van = { x: k.x + dx / d * 2.1, z: k.z + dz / d * 2.1 };
  window.__inKamer(1, [van.x, van.z], [k.x, k.z], -0.22);
  return { er: true, aantal: lijst.length, staat: lijst.map(q => `${q.staat}${q.opBank ? '/bank' : ''}`).join(', ') };
});
console.log(`  katten: ${kat.aantal} — ${kat.staat}`);
await foto('wieken29_katten');

// 6. Molenkrite 15: door de tuindeur naar de buren
await page.evaluate(() => {
  const g = window.__game, h = g.woningen[0], m = h.maten;
  g.sfeer.uur = 13;
  window.__inKamer(0, [m.breed / 2, m.diep - 8.4], [m.breed - 0.6, m.diep - 4.4], 0.0);
});
await foto('binnen_uitzicht');

await browser.close();
