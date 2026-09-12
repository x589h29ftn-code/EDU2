/*
 Foto's van het tankstation aan de Lemmerweg. De standpunten komen uit de kaart
 zelf (het hart van de luifel en de plek van de prijzenzuil), dus ze blijven
 kloppen als de luifel in de brondata verschuift.

 Gebruik: python3 -m http.server 8123 &  node tools/tankshots.mjs 8123 [map]
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
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });

const T = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  if (!g.player.wapenUit) g.player.wisselWapen();
  g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
  window.__W = await import('/js/world.js');
  const s = (KAART.tankstations || [])[0];
  return s ? { cx: s.cx, cz: s.cz, as: s.as, L: s.lengte, B: s.breedte, zuil: s.zuil, naam: s.naam } : null;
});
if (!T) { console.log('geen tankstation in de kaart'); await browser.close(); process.exit(1); }
console.log(`${T.naam}: luifel ${T.L} × ${T.B} m op ${T.cx}, ${T.cz}`);

const schot = async (naam, x, z, yaw, pitch, hoog, uur = 11.5) => {
  await page.evaluate(([x, z, yaw, pitch, hoog, uur]) => {
    const g = window.__game;
    g.sfeer.uur = uur; g.sfeer.weer = 'helder';
    g.player.inCar = null; g.player.zit = false;
    g.player.pos.set(x, hoog, z); g.player.yaw = yaw; g.player.pitch = pitch;
    g.player.applyCamera();
    window.__W.updateLOD(x, z);
  }, [x, z, yaw, pitch, hoog, uur]);
  await page.waitForTimeout(2200);
  const pad = `${map}/${naam}.png`;
  await page.screenshot({ path: pad, timeout: 300000 });
  console.log(pad);
};

// langs de lange as en dwars erop; kijkrichting steeds naar het hart van de luifel
const kijk = async (naam, x, z, pitch, hoog, uur) => {
  const L = Math.hypot(T.cx - x, T.cz - z) || 1;
  await schot(naam, x, z, Math.atan2(-(T.cx - x) / L, -(T.cz - z) / L), pitch, hoog, uur);
};
const ax = T.as[0], az = T.as[1];          // langs
const bx = -T.as[1], bz = T.as[0];         // dwars
// vanaf de wegkant (bij de prijzenzuil), niet de slootkant
await kijk('tank_voor', T.zuil.x + (T.zuil.x - T.cx) * 0.35, T.zuil.z + (T.zuil.z - T.cz) * 0.35, 0.02, 0, 11.5);
await kijk('tank_onder', T.cx + ax * 16, T.cz + az * 16, 0.05, 0, 11.5);
await kijk('tank_pompen', T.cx + bx * 9 + ax * 9, T.cz + bz * 9 + az * 9, 0.0, 0, 11.5);
await kijk('tank_nacht', T.cx - bx * 20 - ax * 8, T.cz - bz * 20 - az * 8, 0.03, 0, 21.5);
// de prijzenzuil vanaf de weg
await schot('tank_zuil', T.zuil.x + Math.sin(T.zuil.yaw) * 9, T.zuil.z + Math.cos(T.zuil.yaw) * 9,
  T.zuil.yaw + Math.PI, 0.10, 0, 11.5);
await browser.close();
