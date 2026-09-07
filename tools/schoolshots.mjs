/*
 Foto's van kindcentrum De Wynpôlle, Keizersmantel 1 in Duinterpen.

 De standpunten komen uit de kaart: het hart van het pand en de richting van de
 voorgevel (`front`, gezet met `voorkantNaar` in data/stijl/straten.json), zodat
 de opname blijft kloppen als het grondvlak of de voorkant verandert.

 Gebruik: python3 -m http.server 8123 &  node tools/schoolshots.mjs 8123 [map]
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const port = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
mkdirSync(map, { recursive: true });
const PAND = '0091100000004552';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });

const plek = await page.evaluate(async (PAND) => {
  const { KAART } = await import('/js/kaart.js');
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  if (!g.player.wapenUit) g.player.wisselWapen();
  g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
  const p = KAART.panden.find(q => q.id === PAND);
  let cx = 0, cz = 0;
  for (const a of p.voet) { cx += a[0]; cz += a[1]; }
  cx /= p.voet.length; cz /= p.voet.length;
  const f = p.front || [0, -1];
  /*
   Vanaf het hart naar buiten lopen tot je het grondvlak uit bent. Bij dit
   complex van 7937 m² met 131 hoeken ligt het hart middenin het gebouw, dus een
   standpunt "zesentwintig meter vanaf het hart" stond binnen: op de foto zag je
   een binnenmuur en niet de school. `rand` is de afstand waarop je er net uit
   bent.
  */
  const ring = p.voet;
  const binnen = (x, z) => {
    let in_ = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) in_ = !in_;
    }
    return in_;
  };
  let rand = 0;
  for (let d = 0; d < 200; d += 1) { if (!binnen(cx + f[0] * d, cz + f[1] * d)) { rand = d; break; } }
  return { cx, cz, fx: f[0], fz: f[1], rand, nok: p.nok, goot: p.goot };
}, PAND);

const schot = async (naam, x, z, yaw, pitch, hoog, uur) => {
  await page.evaluate(([x, z, yaw, pitch, hoog, uur]) => {
    const g = window.__game;
    g.sfeer.uur = uur; g.sfeer.weer = 'helder';
    g.player.inCar = null; g.player.zit = false;
    g.player.pos.set(x, hoog, z); g.player.yaw = yaw; g.player.pitch = pitch;
    g.player.applyCamera();
  }, [x, z, yaw, pitch, hoog, uur]);
  await page.waitForTimeout(2200);
  const pad = `${map}/${naam}.png`;
  await page.screenshot({ path: pad, timeout: 300000 });
  console.log(pad);
};

/*
 Kijkrichting: van het plein naar het gebouw toe, dus tegen `front` in. De
 camera kijkt langs (-sin yaw, -cos yaw), en die moet gelijk zijn aan -front,
 dus sin yaw = fx en cos yaw = fz. Met een min ervoor keek de opname juist van
 het gebouw af, naar de parkeerplaats.
*/
const yaw = Math.atan2(plek.fx, plek.fz);
console.log(`het grondvlak eindigt op ${plek.rand} m vanaf het hart`);
for (const [naam, ver, pitch] of [['plein', 46, 0.10], ['dichtbij', 16, 0.22]]) {
  const d = plek.rand + ver;
  await schot(`school_${naam}`, plek.cx + plek.fx * d, plek.cz + plek.fz * d, yaw, pitch, 0, 11.0);
}
// en schuin langs de gebogen vleugel, waar de luifels achter elkaar staan
const d2 = plek.rand + 14;
await schot('school_luifels', plek.cx + plek.fx * d2 + plek.fz * 30, plek.cz + plek.fz * d2 - plek.fx * 30,
  yaw + 0.80, 0.14, 0, 11.0);
await browser.close();
