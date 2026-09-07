/*
 Foto's van de twee blokken aan de Keizersmantel in Duinterpen: het blok met de
 Poiesz op de begane grond (401-437) en het blok ernaast (441-485).

 De standpunten worden niet met de hand ingetikt maar uit KAART.zuilengangen
 gerekend: het midden van de boog, en vandaar een stuk naar buiten langs de
 normaal. Zo blijft de opname kloppen als de boog verandert.

 Gebruik: python3 -m http.server 8123 &
          node tools/duinterpenshots.mjs 8123 [map]
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
page.on('console', m => { if (/zuilengang/.test(m.text())) console.log(`  ${m.text()}`); });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });

const plekken = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  if (!g.player.wapenUit) g.player.wisselWapen();
  g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;

  // per zuilengang: het midden van de boog en de richting naar buiten
  const uit = [];
  for (const z of KAART.zuilengangen || []) {
    const b = z.boog;
    // booglengte, om het echte midden te vinden en niet het gemiddelde van de hoeken
    const langs = [0];
    for (let i = 1; i < b.length; i++) langs.push(langs[i - 1] + Math.hypot(b[i][0] - b[i - 1][0], b[i][1] - b[i - 1][1]));
    const half = langs[langs.length - 1] / 2;
    let i = 1; while (i < langs.length - 1 && langs[i] < half) i++;
    const t = (half - langs[i - 1]) / Math.max(1e-6, langs[i] - langs[i - 1]);
    const mx = b[i - 1][0] + (b[i][0] - b[i - 1][0]) * t;
    const mz = b[i - 1][1] + (b[i][1] - b[i - 1][1]) * t;
    // naar buiten = van het hart van het pand af
    const p = KAART.panden.find(q => q.id === z.pand);
    const hx = p && p.rect ? p.rect.cx : mx, hz = p && p.rect ? p.rect.cz : mz;
    let nx = mx - hx, nz = mz - hz;
    const L = Math.hypot(nx, nz) || 1; nx /= L; nz /= L;
    uit.push({ pand: z.pand, merk: !!z.merk, mx, mz, nx, nz, hoogte: z.hoogte, zuilen: z.zuilen.length });
  }
  return uit;
});

console.log(`${plekken.length} zuilengang(en) in de kaart`);

const schot = async (naam, x, z, yaw, pitch, hoog, uur) => {
  await page.evaluate(([x, z, yaw, pitch, hoog, uur]) => {
    const g = window.__game;
    g.sfeer.uur = uur;
    g.sfeer.weer = 'helder';
    g.player.inCar = null; g.player.zit = false;
    g.player.pos.set(x, hoog, z); g.player.yaw = yaw; g.player.pitch = pitch;
    g.player.applyCamera();
  }, [x, z, yaw, pitch, hoog, uur]);
  await page.waitForTimeout(2200);
  const pad = `${map}/${naam}.png`;
  await page.screenshot({ path: pad, timeout: 300000 });
  console.log(pad);
};

for (const p of plekken) {
  const merk = p.merk ? 'poiesz' : 'buur';
  // kijkrichting: van buiten naar de boog toe, dus tegen de normaal in
  const yaw = Math.atan2(p.nx, p.nz);
  for (const [naam, ver, pitch] of [['ver', 34, 0.06], ['dichtbij', 12, 0.16]]) {
    await schot(`duinterpen_${merk}_${naam}`, p.mx + p.nx * ver, p.mz + p.nz * ver, yaw, pitch, 0, 11.5);
  }
}
// en één schuin langs de gang, waar de zuilen achter elkaar staan
const poiesz = plekken.find(p => p.merk);
if (poiesz) {
  const yaw = Math.atan2(poiesz.nx, poiesz.nz) - 1.05;
  await schot('duinterpen_poiesz_gang', poiesz.mx + poiesz.nx * 9, poiesz.mz + poiesz.nz * 9, yaw, 0.10, 0, 11.5);
}

await browser.close();
