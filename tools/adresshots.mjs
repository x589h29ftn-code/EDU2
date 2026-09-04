/*
 Foto's van de panden die met naam en al in de stijlcatalogus staan
 (data/stijl/straten.json, blok `panden`): de supermarkt aan de Molenkrite en de
 boerderij Tinga State. Voor elk pand wordt de voorgevel opgezocht in
 js/kaart.js en gaat de camera ervoor staan; `foto` in de catalogus bepaalt de
 uitsnede (afstand, verschuiving langs de gevel, kijkhoek), en zonder die regel
 zoekt het gereedschap zelf een standpunt met vrij zicht — een plek rondom het
 pand waar geen boom in de weg staat.

 Gebruik: python3 -m http.server 8123 &  node tools/adresshots.mjs 8123 [map]
*/
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';

const port = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
mkdirSync(map, { recursive: true });

const STIJL = JSON.parse(readFileSync('data/stijl/straten.json', 'utf8'));
const PANDEN = Object.entries(STIJL.panden || {}).filter(([k]) => !k.startsWith('_'));
if (!PANDEN.length) { console.log('geen panden in data/stijl/straten.json'); process.exit(0); }

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
  g.hud.msgT = 0; g.hud.msg.style.opacity = 0;
  g.hud.missieT = 0; g.hud.missieEl.style.opacity = 0;
});
await page.waitForTimeout(1500);

for (const [id, regel] of PANDEN) {
  const naam = regel.type || id;
  const plek = await page.evaluate(async ({ id, foto }) => {
    const { KAART } = await import('./js/kaart.js');
    const W = await import('./js/world.js');
    const p = KAART.panden.find(q => q.id === id);
    if (!p) return null;
    const r = p.rect, u = [Math.cos(r.hoek), Math.sin(r.hoek)];
    const diep = Math.abs(p.front[0] * u[0] + p.front[1] * u[1]) > 0.7 ? r.hx : r.hz;
    const gevel = { x: r.cx + p.front[0] * diep, z: r.cz + p.front[1] * diep };
    const langs = [p.front[1], -p.front[0]];
    if (foto) {
      return {
        x: gevel.x + p.front[0] * foto.voor + langs[0] * (foto.langs || 0),
        z: gevel.z + p.front[1] * foto.voor + langs[1] * (foto.langs || 0),
        doel: gevel, pitch: foto.pitch || 0,
      };
    }
    // zelf een standpunt zoeken: rondom het pand, zo ver mogelijk van de bomen
    let best = null;
    for (let a = 0; a < 360; a += 4) for (const d of [24, 28, 32, 36]) {
      const x = r.cx + Math.cos(a * Math.PI / 180) * d, z = r.cz + Math.sin(a * Math.PI / 180) * d;
      if (W.pointInWater(x, z)) continue;
      const [kx, kz] = W.resolveCollisions(x, z, 0.4);
      if (Math.hypot(kx - x, kz - z) > 0.05) continue;
      let vrij = 1e9;
      for (const b of KAART.bomen) {
        vrij = Math.min(vrij, Math.hypot(b.x - x, b.z - z));
        const t = ((b.x - x) * (r.cx - x) + (b.z - z) * (r.cz - z)) / (d * d);
        if (t > 0.05 && t < 0.9) {
          const px = x + (r.cx - x) * t, pz = z + (r.cz - z) * t;
          vrij = Math.min(vrij, Math.hypot(b.x - px, b.z - pz));
        }
      }
      if (!best || vrij > best.vrij) best = { vrij, x, z, doel: { x: r.cx, z: r.cz }, pitch: 0.13 };
    }
    return best;
  }, { id, foto: regel.foto || null });
  if (!plek) { console.log(`${id}: niet in de kaartdata`); continue; }
  await page.evaluate((pl) => {
    const g = window.__game;
    g.player.pos.set(pl.x, 0, pl.z);
    g.player.yaw = Math.atan2(-(pl.doel.x - pl.x), -(pl.doel.z - pl.z));
    g.player.pitch = pl.pitch;
    g.player.applyCamera();
  }, plek);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${map}/${naam}.png` });
  console.log(`${map}/${naam}.png`);
}

await browser.close();
