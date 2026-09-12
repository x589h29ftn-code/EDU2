/*
 Foto's van de panden uit de steekproefronde: de bungalows aan de Westhemstraat,
 de twee galerijflats en de twee hoogbouwflats aan de Potterzijlstraat, Sûdwester
 aan de Lemmerweg en de loods aan het Sneekerpad.

 De standpunten komen uit de kaart zelf — het `rect` van het pand en zijn
 `front` — dus ze blijven kloppen als het grondvlak in de brondata verschuift.
 Per pand geeft `foto` in data/stijl/straten.json de afstand en de kijkhoek.

 Gebruik: python3 -m http.server 8123 &  node tools/steekproefshots.mjs 8123 [map]
*/
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';

const port = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
mkdirSync(map, { recursive: true });
// de uitsnede per pand (afstand tot de gevel en kijkhoek) staat bij het pand zelf
const STIJL = JSON.parse(readFileSync('data/stijl/straten.json', 'utf8'));

// naam van het beeld -> pand-id uit data/stijl/straten.json
const PANDEN = [
  ['westhemstraat', '0091100000009703'],
  ['potterzijl_galerij', '0091100000019604'],
  ['potterzijl_hoog', '0091100000004654'],
  ['sudwester', '0091100000013880'],
  ['sneekerpad_loods', '0683100000293900'],
];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });
await page.evaluate(async () => {
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
  window.__W = await import('/js/world.js');
});

for (const [naam, id] of PANDEN) {
  const regel = (STIJL.panden || {})[id] || {};
  const plek = await page.evaluate(async ({ id, foto }) => {
    const { KAART } = await import('/js/kaart.js');
    const p = KAART.panden.find(q => q.id === id);
    if (!p || !p.rect) return null;
    const r = p.rect, u = [Math.cos(r.hoek), Math.sin(r.hoek)];
    // hoe diep het pand is gezien vanaf de voorkant
    const langsLangeAs = Math.abs(p.front[0] * u[0] + p.front[1] * u[1]) > 0.7;
    const diep = langsLangeAs ? r.hx : r.hz;
    const voor = (foto && foto.voor) || 30, pitch = (foto && foto.pitch) || 0.08;
    // `langs` schuift het standpunt langs de gevel op. Nodig bij de twee
    // hoogbouwflats: recht voor de gevel, op de afstand die je nodig hebt om ze
    // in beeld te krijgen, sta je midden in de galerijflat aan de overkant.
    const langs = [p.front[1], -p.front[0]], zij = (foto && foto.langs) || 0;
    const gevel = { x: r.cx + p.front[0] * diep, z: r.cz + p.front[1] * diep };
    return {
      x: gevel.x + p.front[0] * voor + langs[0] * zij,
      z: gevel.z + p.front[1] * voor + langs[1] * zij,
      doel: gevel, pitch,
    };
  }, { id, foto: regel.foto || null });
  if (!plek) { console.log(`${id}: niet in de kaartdata`); continue; }
  await page.evaluate((pl) => {
    const g = window.__game;
    g.sfeer.uur = 11.5; g.sfeer.weer = 'helder';
    g.player.inCar = null; g.player.zit = false;
    g.player.pos.set(pl.x, 0, pl.z);
    g.player.yaw = Math.atan2(-(pl.doel.x - pl.x), -(pl.doel.z - pl.z));
    g.player.pitch = pl.pitch;
    g.player.applyCamera();
    window.__W.updateLOD(pl.x, pl.z);
  }, plek);
  await page.waitForTimeout(2400);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 300000 });
  console.log(`${map}/${naam}.png`);
}
await browser.close();
