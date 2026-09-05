/*
 Foto's van het viaduct over de rondweg (js/viaduct.js), met dezelfde
 gezichtspunten als de foto's die de opdracht gaven:

   viaduct_onder.png    vanaf de N7 eronder, tegen de houten boog aan
   viaduct_dek.png      op het dek, kijkend over de brug
   viaduct_oprit.png    onderaan de oprit bij de Jumbo, kijkend omhoog
   viaduct_zij.png      van opzij: het dijklichaam en de brug in één beeld
   viaduct_rijden.png   met de auto over het dek

 Gebruik: python3 -m http.server 8123 &  node tools/viaductshots.mjs 8123 [map]
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

const feiten = await page.evaluate(async () => {
  localStorage.removeItem('tinga.spel.v1');
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  g.sfeer.uur = 13;
  g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
  const { KAART } = await import('/js/kaartwereld.js');
  const w = await import('/js/world.js');
  window.__V = KAART.viaducten[0];
  window.__grond = w.grondHoogte;
  // De speler op (x,z) zetten, kijkend naar (kx,kz); y volgt de grond. `boven`
  // = op het brugdek in plaats van eronder.
  window.__zet = (x, z, kx, kz, pitch = 0, yBoven = 0, boven = false) => {
    const y = boven ? w.grondHoogte(x, z) : w.grondHoogte(x, z, yBoven + 0.9);
    g.player.inCar = null; g.player.zit = false;
    g.player.pos.set(x, y + yBoven, z);
    g.player.vy = 0;
    g.player.yaw = Math.atan2(-(kx - x), -(kz - z));
    g.player.pitch = pitch;
    g.player.applyCamera();
  };
  const V = window.__V;
  const mid = V.as[Math.round((V.dekVan + V.dekTot) / 2)];
  return { naam: V.naam, hoogte: V.hoogte, mid: [mid[0], mid[1]], stations: V.as.length };
});
console.log(`${feiten.naam}: dek op ${feiten.hoogte} m, ${feiten.stations} stations, midden ${feiten.mid.map(v => v.toFixed(0)).join(', ')}`);

const foto = async (naam) => {
  await page.waitForTimeout(2400);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 180000 });
  console.log(`${map}/${naam}.png`);
};

// 1. vanaf de rijksweg eronder, schuin omhoog tegen de boog aan
await page.evaluate(() => {
  const V = window.__V, m = V.as[Math.round((V.dekVan + V.dekTot) / 2)];
  window.__zet(m[0] - 34, m[1] - 2, m[0] + 4, m[1], 0.18);
});
await foto('viaduct_onder');

// 2. op het dek, kijkend naar het noorden over de brug
await page.evaluate(() => {
  const V = window.__V, a = V.as[V.dekVan + 4], b = V.as[V.dekTot];
  window.__zet(a[0], a[1], b[0], b[1], -0.02, 0, true);
});
await foto('viaduct_dek');

// 3. onderaan de oprit, kijkend omhoog naar de brug
await page.evaluate(() => {
  const V = window.__V, a = V.as[34], b = V.as[V.dekVan];
  window.__zet(a[0], a[1], b[0], b[1], 0.05, 0, true);
});
await foto('viaduct_oprit');

// 4. van opzij: het hele dijklichaam met de brug erachter
await page.evaluate(() => {
  const V = window.__V, m = V.as[Math.round((V.dekVan + V.dekTot) / 2)];
  window.__zet(m[0] - 46, m[1] + 6, m[0], m[1], 0.02, 9);
});
await foto('viaduct_zij');

// 5. met de auto het dek op
const rit = await page.evaluate(async () => {
  const g = window.__game, V = window.__V;
  const a = V.as[V.dekVan - 70], b = V.as[V.dekVan - 66];
  // de oprit vrijmaken: een geparkeerde of rijdende auto ervoor houdt hem tegen
  for (const c of g.vehicles.cars) {
    if (V.as.some(s2 => Math.hypot(s2[0] - c.x, s2[1] - c.z) < 14)) { c.x += 500; g.vehicles.zetInstantie(c); }
  }
  // het verkeer staat stil zolang de hoofdlus niet draait; zet het opzij
  for (const t of g.vehicles.traffic) if (t.mesh) { t.mesh.visible = false; t.mesh.position.x += 500; }
  const yaw = Math.atan2(-(b[0] - a[0]), -(b[1] - a[1]));
  const auto = g.vehicles.voegToe({ x: a[0], z: a[1], yaw, soort: 'hatch', kleur: 0x9c1f1f });
  if (!auto) return { er: false };
  auto.speed = 0;
  g.player.inCar = auto;
  g.player.yaw = auto.yaw; g.player.pitch = -0.05;
  g.vehicles.zetNeer(auto, 0.016, auto.yaw);
  // gas erop en de as volgen: de auto klimt de dijk op en rijdt het dek over
  const volg = () => {
    let bi = 0, bd = 1e9;
    V.as.forEach((s2, i) => { const d = Math.hypot(s2[0] - auto.x, s2[1] - auto.z); if (d < bd) { bd = d; bi = i; } });
    const t = V.as[Math.min(V.as.length - 1, bi + 12)];
    let e = Math.atan2(-(t[0] - auto.x), -(t[1] - auto.z)) - auto.yaw;
    while (e > Math.PI) e -= Math.PI * 2;
    while (e < -Math.PI) e += Math.PI * 2;
    return { KeyW: true, KeyA: e > 0.012, KeyD: e < -0.012 };
  };
  for (let i = 0; i < 395; i++) {
    g.vehicles.drive(auto, volg(), 1 / 60, g.aanrijden);
    g.vehicles.zetNeer(auto, 1 / 60, auto.yaw);
  }
  g.derde.aan = true;
  g.derde.update(0.1, auto);
  return { er: true, x: auto.x, z: auto.z, y: auto.mesh.position.y, snelheid: auto.speed };
});
if (rit.er) console.log(`  auto op ${rit.x.toFixed(0)}, ${rit.z.toFixed(0)} — ${rit.y.toFixed(2)} m hoog, ${rit.snelheid.toFixed(1)} m/s`);
await foto('viaduct_rijden');

await browser.close();
