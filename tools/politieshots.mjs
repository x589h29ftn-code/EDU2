/*
 Foto's van de politie-inzet: hoeveel eenheden er bij vijf sterren uitrukken en
 hoe ver ze over de wijk uitwaaieren.

   politie.png        straatbeeld met een surveillanceauto en agenten, de
                      sterren rechtsboven en de blauwe stipjes op de minikaart
   politie_zoekt.png  de grote kaart: de eenheden zoeken niet op één kluitje
                      maar in een ring rond de laatst bekende plek

 Gebruik: python3 -m http.server 8123 &  node tools/politieshots.mjs 8123 [map]
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

// ---------- opzet: speler op een recht stuk Molenkrite, vijf sterren ----------
await page.evaluate(async () => {
  const { KAART } = await import('./js/kaart.js');
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
  const as = KAART.wegassen.filter(w => w.drive && w.naam === 'Molenkrite' && w.lengte > 60)[0];
  const a = as.pts[Math.floor(as.pts.length / 2)];
  const b = as.pts[as.pts.length - 1];
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  window.__pd = { x: a[0], z: a[1], rx: (b[0] - a[0]) / l, rz: (b[1] - a[1]) / l };
  g.player.pos.set(a[0], 0, a[1]); g.player.applyCamera();
  // vooruitspoelen zonder te renderen: anders duurt het in swiftshader uren
  window.__spoel = (sec) => {
    const g = window.__game;
    for (let i = 0; i < Math.round(sec * 30); i++) { g.politie.update(1 / 30); g.npcs.update(1 / 30, i / 30); }
    g.hud.zetSterren(g.politie.ster, g.politie.gezocht);
    g.hud.zetPolitie(g.politie.plekken);
  };
});
await page.waitForTimeout(1200);

// vijf sterren, en de eenheden de tijd geven om uit te rukken en uit te waaieren
const inzet = await page.evaluate(() => {
  const g = window.__game;
  g.politie.zetHeat(400);
  window.__spoel(70);
  return { ster: g.politie.ster, ...g.politie.eenheden };
});
console.log(`${inzet.ster} sterren · ${inzet.wagens} wagens · ${inzet.voet + inzet.inWagen} agenten`);

// ---------- 1. straatbeeld ----------
// De eenheden zoeken rond de speler, dus voor de foto stappen we een straat
// verderop en kijken we terug: zo staan ze in beeld in plaats van tegen de lens.
await page.evaluate(() => {
  const g = window.__game, pd = window.__pd;
  const AF = 15;
  g.player.pos.set(pd.x + pd.rx * AF, 0, pd.z + pd.rz * AF);
  g.player.yaw = Math.atan2(pd.rx, pd.rz);      // terug de straat in kijken
  g.player.pitch = -0.03;
  g.player.applyCamera();
});
await page.waitForTimeout(2500);
await page.screenshot({ path: `${map}/politie.png` });
console.log(`${map}/politie.png`);

// ---------- 2. de grote kaart ----------
// tussen de gebouwen en de bomen door zie je van bovenaf weinig; op de kaart
// staat wél in één oogopslag hoe wijd ze uitwaaieren
const spreiding = await page.evaluate(() => {
  const g = window.__game, pd = window.__pd;
  g.hud.toggleBig();
  const ds = g.politie.plekken.map(q => Math.hypot(q.x - pd.x, q.z - pd.z));
  return { n: ds.length, dichtst: Math.min(...ds), verst: Math.max(...ds) };
});
await page.waitForTimeout(2500);
await page.screenshot({ path: `${map}/politie_zoekt.png` });
console.log(`${map}/politie_zoekt.png`);
console.log(`${spreiding.n} eenheden op de kaart, van ${Math.round(spreiding.dichtst)} tot ${Math.round(spreiding.verst)} m van de plaats delict`);

await browser.close();
