/*
 Foto's van de omgeving: hagen, water en riet, gras van dichtbij, en de
 belichting op vier tijden (ronde van 25 sep 2026).

   omgeving_heg.png        een ligusterhaag van dichtbij
   omgeving_water.png      een sloot met de oever en het riet
   omgeving_gras.png       een grasveld op kniehoogte: het doek en de pollen gras
   licht_ochtend.png       de Molenkrite om acht uur
   licht_middag2.png       om één uur
   licht_avond2.png        om half acht 's avonds
   licht_nacht.png         om elf uur 's avonds

 Gebruik: npm run server &   node tools/omgevingshots.mjs 8123 [map]
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const poort = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
mkdirSync(map, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

const plek = await page.evaluate(async () => {
  window.__W = await import('/js/world.js');
  const { KAART } = await import('/js/kaart.js');
  const KW = await import('/js/kaartwereld.js');
  const g = window.__game, s = g.start;
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true; window.__autoplay = true;
  g.player.wapenUit = true; if (g.player.gun) g.player.gun.visible = false;
  g.reliëfAf();
  const afstand = (x, z) => Math.hypot(x - s.x, z - s.z);
  // een haag: het dichtstbijzijnde stuk haag met een lange zijde
  let heg = null;
  for (const ring of KAART.hagen) for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 4) continue;
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, d = afstand(mx, mz);
    if (d > 15 && (!heg || d < heg.d)) heg = { d, mx, mz, nx: -(b[1] - a[1]) / L, nz: (b[0] - a[0]) / L };
  }
  // water: het dichtstbijzijnde punt op een waterrand, en de camera een paar meter landinwaarts
  let wat = null;
  for (const poly of KW.waterRingen) for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 6) continue;
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, d = afstand(mx, mz);
    if (d > 30 && (!wat || d < wat.d)) {
      let nx = -(b[1] - a[1]) / L, nz = (b[0] - a[0]) / L;
      const v = KW.vlakOp(mx + nx * 3, mz + nz * 3);
      if (v && v.k === 'water') { nx = -nx; nz = -nz; }         // die kant is water: de andere kant op
      wat = { d, mx, mz, nx, nz };
    }
  }
  // een grasveld: het midden van het dichtstbijzijnde grote grasvlak
  let veld = null;
  for (const v of KAART.vlakken) {
    if (v.m !== 'gras') continue;
    const r = v.r[0]; let a = 0, cx = 0, cz = 0;
    for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length], k = p[0] * q[1] - q[0] * p[1]; a += k; cx += (p[0] + q[0]) * k; cz += (p[1] + q[1]) * k; }
    a /= 2; if (Math.abs(a) < 900) continue; cx /= 6 * a; cz /= 6 * a;
    if (KW.vlakOp(cx, cz)?.m !== 'gras') continue;
    const d = afstand(cx, cz); if (!veld || d < veld.d) veld = { d, cx, cz };
  }
  return { heg, wat, veld };
});
console.log(JSON.stringify(plek));

const zet = (x, z, naarX, naarZ, pitch, oogY = 0, uur = 14) => page.evaluate(({ x, z, naarX, naarZ, pitch, oogY, uur }) => {
  const g = window.__game, p = g.player;
  g.sfeer.uur = uur; g.sfeer.weer = 'helder';
  for (let i = 0; i < 5; i++) g.sfeer.update(0.1, x, z);
  g.werkOmgevingBij(7);
  p.inCar = null; p.pos.set(x, oogY, z);
  p.yaw = Math.atan2(-(naarX - x), -(naarZ - z)); p.pitch = pitch;
  p.applyCamera();
  window.__W.updateLOD(g.camera.position.x, g.camera.position.z);
  if (g.grasVeld) g.grasVeld.update(g.camera.position.x, g.camera.position.z, true);
  g.zetSchaduwDoos(g.camera.position.x, g.camera.position.z);
  if (g.werkLantaarnsBij) g.werkLantaarnsBij(0.1, x, z);
  g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
  if (g.uitleg) g.uitleg.update(999);
}, { x, z, naarX, naarZ, pitch, oogY, uur });
const foto = async (naam) => {
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 600000 });
  console.log(`${map}/${naam}.png`);
};
const { heg, wat, veld } = plek;
await zet(heg.mx + heg.nx * 3.2 + heg.nz * 1.5, heg.mz + heg.nz * 3.2 - heg.nx * 1.5, heg.mx, heg.mz, -0.25);
await foto('omgeving_heg');
await zet(wat.mx + wat.nx * 4, wat.mz + wat.nz * 4, wat.mx - wat.nx * 6, wat.mz - wat.nz * 6, -0.28);
await foto('omgeving_water');
await zet(veld.cx, veld.cz, veld.cx + 10, veld.cz + 3, -0.18, -1.1);
await foto('omgeving_gras');
// de belichting: vanaf de stoep aan de Molenkrite, schuin de straat in
const s = await page.evaluate(() => ({ x: window.__game.start.x, z: window.__game.start.z, yaw: window.__game.start.yaw || 0 }));
const vx = -Math.sin(s.yaw), vz = -Math.cos(s.yaw);
for (const [naam, uur] of [['licht_ochtend', 8], ['licht_middag2', 13], ['licht_avond2', 19.5], ['licht_nacht', 23]]) {
  await zet(s.x - vx * 6, s.z - vz * 6, s.x + vx * 30, s.z + vz * 30, -0.05, 0, uur);
  await foto(naam);
}
await browser.close();
