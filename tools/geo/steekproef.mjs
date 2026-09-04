// Steekproef voor de stijlcontrole: rendert per adres uit
// data/stijl/steekproef.json het spel vanaf de straat, recht voor de
// voorgevel, en schrijft docs/steekproef/<straat>-<nr>.png plus een
// README.md met per adres de meetwaarden uit 3D BAG, het gekozen woningtype en
// de Street View-link van hetzelfde camerapunt.
//
//   node tools/geo/steekproef.mjs [poort]
//
// Vereist een draaiende webserver (npm start) en Playwright.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rdNaarWgs, spelNaarRd, leesOorsprong } from './rd.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HIER, '..', '..');
const poort = process.argv[2] || '8123';
const { KAART } = await import(join(ROOT, 'js', 'kaart.js'));
const STEEK = JSON.parse(readFileSync(join(ROOT, 'data', 'stijl', 'steekproef.json'), 'utf8'));
const oorsprong = leesOorsprong();
const UIT = join(ROOT, 'docs', 'steekproef');
mkdirSync(UIT, { recursive: true });

const zwaartepunt = (ring) => { let x = 0, z = 0; for (const p of ring) { x += p[0]; z += p[1]; } return [x / ring.length, z / ring.length]; };

// Camerapunt: negen meter vóór de voorgevel, op ooghoogte, kijkend naar de gevel.
function camera(pand) {
  const [cx, cz] = zwaartepunt(pand.voet);
  const f = pand.front || [0, 1];
  let dmax = 0;
  for (const [x, z] of pand.voet) dmax = Math.max(dmax, (x - cx) * f[0] + (z - cz) * f[1]);
  const afstand = dmax + 9;
  const x = cx + f[0] * afstand, z = cz + f[1] * afstand;
  // kijkrichting -f; speler kijkt langs (-sin yaw, -cos yaw)
  const yaw = Math.atan2(f[0], f[1]);
  // kompaskoers van de kijkrichting (noorden = -z)
  const koers = ((Math.atan2(-f[0], f[1]) * 180 / Math.PI) + 360) % 360;
  return { x, z, yaw, koers, gevel: [cx + f[0] * dmax, cz + f[1] * dmax] };
}

function zoek(straat, nr) {
  const kandidaten = KAART.panden.filter(p => p.straat === straat && p.nr.includes(String(nr)));
  return kandidaten.sort((a, b) => (b.v ? 1 : 0) - (a.v ? 1 : 0))[0] || null;
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
await page.evaluate(() => {
  document.getElementById('overlay').style.display = 'none';
  window.__autoplay = true;
  const g = window.__game;
  // stil beeld: geen verkeer of voetgangers voor de gevel
  for (const t of g.vehicles.traffic) t.mesh.visible = false;
  for (const m of Object.values(g.npcs.meshes)) m.visible = false;
  g.npcs.fiets.visible = false;
  g.player.gun.visible = false;
});

const regels = [];
for (const a of STEEK.adressen) {
  const pand = zoek(a.straat, a.nr);
  const naam = `${a.straat.replace(/\s+/g, '_')}-${a.nr}`;
  if (!pand) { console.log(`${a.straat} ${a.nr}: niet gevonden`); regels.push(`| ${a.straat} ${a.nr} | niet gevonden in kaart.js | | | | |`); continue; }
  const cam = camera(pand);
  await page.evaluate((c) => {
    const g = window.__game;
    g.player.pos.set(c.x, 0, c.z); g.player.yaw = c.yaw; g.player.pitch = 0.06; g.player.applyCamera();
    // geparkeerde auto's vlak voor de camera even weg
    for (const car of g.vehicles.cars) car.mesh.visible = Math.hypot(car.x - c.x, car.z - c.z) > 6;
  }, cam);
  await page.waitForTimeout(600);
  const bestand = join(UIT, `${naam}.png`);
  await page.screenshot({ path: bestand });
  let link = '';
  if (oorsprong) {
    const [X, Y] = spelNaarRd([cam.x, cam.z], oorsprong);
    const [lat, lon] = rdNaarWgs(X, Y);
    link = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat.toFixed(6)},${lon.toFixed(6)}&heading=${cam.koers.toFixed(0)}&pitch=5&fov=80`;
  }
  const meet = pand.v ? `goot ${pand.goot} m, nok ${pand.nok} m, ${pand.dak}` : `geschat (geen 3D BAG)`;
  console.log(`${a.straat} ${a.nr}: ${pand.type}, ${meet}, bouwjaar ${pand.jaar || '?'} -> ${naam}.png`);
  regels.push(`| ${a.straat} ${a.nr} | ${pand.type} | ${meet} | ${pand.jaar || '?'} | ![](${naam}.png) | ${link ? `[Street View](${link})` : ''} |`);
}
await browser.close();

const readme = `# Steekproef stijl

Per adres: het spel vanaf de straat, negen meter voor de voorgevel, en de Street
View-link van hetzelfde camerapunt (zelfde plek, zelfde kijkrichting). Gemaakt met
\`node tools/geo/steekproef.mjs\`; adressen in \`data/stijl/steekproef.json\`, de
gekozen typen in \`data/stijl/straten.json\`.

Kijk per adres naar: steenkleur, kozijnkleur, deurkleur, dakpannen, dakkapel of
dakraam, zonnepanelen, voortuin (heg, hekje, grind). Wat afwijkt, komt als regel in
de stijlcatalogus; positie, breedte en hoogte komen uit de data en worden hier niet
beoordeeld.

| adres | type | 3D BAG | bouwjaar | spel | foto |
|---|---|---|---|---|---|
${regels.join('\n')}
`;
writeFileSync(join(UIT, 'README.md'), readme);
console.log(`\n${join(UIT, 'README.md')} geschreven`);
