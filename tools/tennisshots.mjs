/*
 Foto's van het tennispark aan de Molenkrite. De standpunten komen uit de kaart
 zelf (het hart en de as van elk grindblok), dus ze blijven kloppen als de
 blokken in de brondata verschuiven.

 Gebruik: python3 -m http.server 8123 &  node tools/tennisshots.mjs 8123 [map]
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

const P = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
  window.__W = await import('/js/world.js');
  return (KAART.tennisparken || [])[0] || null;
});
if (!P) { console.log('geen tennispark in de kaart'); await browser.close(); process.exit(1); }
console.log(`${P.naam}: ${P.blokken.length} blokken, ${P.blokken.reduce((s, b) => s + b.banen, 0)} banen`);

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

// kijken naar een punt toe, vanaf een plek
const kijk = async (naam, x, z, dx, dz, pitch, hoog, uur) => {
  const L = Math.hypot(dx - x, dz - z) || 1;
  await schot(naam, x, z, Math.atan2(-(dx - x) / L, -(dz - z) / L), pitch, hoog, uur);
};

// het grootste blok (vier banen) van opzij, en een blok van dichtbij
const groot = P.blokken.slice().sort((a, b) => b.banen - a.banen)[0];
const klein = P.blokken.find(b => b !== groot) || groot;
const eenheid = (b) => {
  const l = Math.hypot(b.as[0], b.as[1]) || 1;
  return { ax: b.as[0] / l, az: b.as[1] / l, bx: -b.as[1] / l, bz: b.as[0] / l };
};

{
  const { ax, az, bx, bz } = eenheid(groot);
  // langs de lange kant, op ooghoogte buiten het hek
  await kijk('tennis_hek', groot.cx + bx * (groot.breedte / 2 + 14), groot.cz + bz * (groot.breedte / 2 + 14),
    groot.cx, groot.cz, 0.02, 0, 11.5);
  // over de banen heen vanaf de korte kant
  await kijk('tennis_banen', groot.cx + ax * (groot.lengte / 2 + 16), groot.cz + az * (groot.lengte / 2 + 16),
    groot.cx, groot.cz, 0.06, 0, 11.5);
  // van bovenaf: de belijning en het aantal banen
  await schot('tennis_boven', groot.cx, groot.cz, Math.atan2(-ax, -az), -1.05, 46, 11.5);
  /*
   's Avonds, vanaf de baan zelf. Van buitenaf heeft het geen zin: de blokken
   liggen tegen elkaar aan, dus dan sta je altijd tegen het hek van de buren aan
   te kijken in plaats van naar de banen.
  */
  await kijk('tennis_avond', groot.cx + ax * (groot.lengte / 2 - 2) + bx * (groot.breedte / 2 - 6),
    groot.cz + az * (groot.lengte / 2 - 2) + bz * (groot.breedte / 2 - 6),
    groot.cx, groot.cz, 0.04, 0, 21.0);
}
{
  const { ax, az, bx, bz } = eenheid(klein);
  /*
   Pal achter de achterlijn van één baan. Een halve baanbreedte opzij, want het
   hart van het blok is bij een even aantal banen juist de naad ertussen — daar
   kijk je langs beide netten heen in plaats van er recht op.
  */
  const zij = klein.breedte / (2 * klein.banen);
  const px = klein.cx + ax * (klein.lengte / 2 - 1) + bx * zij;
  const pz = klein.cz + az * (klein.lengte / 2 - 1) + bz * zij;
  await kijk('tennis_net', px, pz, klein.cx + bx * zij, klein.cz + bz * zij, -0.05, 0, 11.5);
}
// het hele park van veraf, met het sportpark ernaast
{
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const b of P.blokken) { x0 = Math.min(x0, b.cx); x1 = Math.max(x1, b.cx); z0 = Math.min(z0, b.cz); z1 = Math.max(z1, b.cz); }
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  await kijk('tennis_park', cx - 120, cz - 60, cx, cz, -0.28, 55, 11.5);
}
await browser.close();
