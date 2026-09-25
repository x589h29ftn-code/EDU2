/*
 Foto's van bomen, struiken en gras (ronde van 24 sep 2026):

   groen_boom.png      de straatboom het dichtst bij het begin, van dichtbij:
                       stam met takken en schors, bobbelige kroon met bladdoek
   groen_struik.png    struiken van dichtbij: rond, onderin donker
   groen_veld.png      het grootste grasveld in de buurt, over de hele breedte:
                       de variatie over tientallen meters in plaats van tegels

 Gebruik: npm run server &   node tools/groenshots.mjs 8123 [map]
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
await page.evaluate(async () => { window.__W = await import('/js/world.js'); });

const plekken = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const W = await import('/js/world.js');
  const { kaartTelling } = await import('/js/kaartwereld.js');
  const g = window.__game, s = g.start;
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true; window.__autoplay = true;
  g.player.wapenUit = true; if (g.player.gun) g.player.gun.visible = false;
  g.reliëfAf();
  g.sfeer.uur = 15; g.sfeer.weer = 'helder';
  for (let i = 0; i < 5; i++) g.sfeer.update(0.1, s.x, s.z);
  g.werkOmgevingBij(7);
  const dichtbij = (lijst) => lijst.map(p => ({ p, d: Math.hypot(p.x - s.x, p.z - s.z) })).filter(o => o.d > 8).sort((a, b) => a.d - b.d)[0].p;
  const boom = dichtbij(W.treePositions.filter(t => !t.tall && t.s > 1));
  const struik = dichtbij(KAART.struiken);
  // het grootste grasvlak binnen 600 m
  let veld = null;
  for (const v of KAART.vlakken) {
    if (v.m !== 'gras') continue;
    const ring = v.r[0];
    let a = 0, cx = 0, cz = 0;
    for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; const k = p[0] * q[1] - q[0] * p[1]; a += k; cx += (p[0] + q[0]) * k; cz += (p[1] + q[1]) * k; }
    a /= 2; if (Math.abs(a) < 1) continue;
    cx /= 6 * a; cz /= 6 * a;
    if (Math.hypot(cx - s.x, cz - s.z) > 600) continue;
    if (!veld || Math.abs(a) > veld.a) veld = { a: Math.abs(a), cx, cz, ring };
  }
  // aan de rand van het veld, kijkend naar het midden
  let rand = veld.ring[0], ver = 0;
  for (const p of veld.ring) { const d = Math.hypot(p[0] - veld.cx, p[1] - veld.cz); if (d > ver) { ver = d; rand = p; } }
  console.log(`zeef: ${kaartTelling.bomenWeg} bomen en ${kaartTelling.struikenWeg} struiken in een pand of op de rijbaan weggelaten`);
  return { boom, struik, veld: { x: rand[0] + (veld.cx - rand[0]) * 0.06, z: rand[1] + (veld.cz - rand[1]) * 0.06, nx: veld.cx, nz: veld.cz, m2: Math.round(veld.a) },
    zeef: { bomen: kaartTelling.bomenWeg, struiken: kaartTelling.struikenWeg } };
});
console.log(JSON.stringify(plekken.zeef), `veld van ${plekken.veld.m2} m²`);

const foto = async (naam, x, z, naarX, naarZ, pitch, oog = 0) => {
  await page.evaluate(({ x, z, naarX, naarZ, pitch, oog }) => {
    const g = window.__game, p = g.player;
    p.inCar = null; p.pos.set(x, oog, z);
    p.yaw = Math.atan2(-(naarX - x), -(naarZ - z)); p.pitch = pitch;
    p.applyCamera();
    g.zetSchaduwDoos(g.camera.position.x, g.camera.position.z);
    // de hoofdlus loopt headless nauwelijks: de LOD zelf bijwerken, anders
    // staan de verre kronen ook dichtbij aan
    window.__W && window.__W.updateLOD(g.camera.position.x, g.camera.position.z);
    g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
    if (g.uitleg) g.uitleg.update(999);
  }, { x, z, naarX, naarZ, pitch, oog });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 600000 });
  console.log(`${map}/${naam}.png`);
};
const { boom, struik, veld } = plekken;
await foto('groen_boom', boom.x + 6.5, boom.z + 3.5, boom.x, boom.z, 0.28);
await foto('groen_struik', struik.x + 2.6, struik.z + 1.6, struik.x, struik.z, -0.35);
await foto('groen_veld', veld.x, veld.z, veld.nx, veld.nz, -0.05);
await browser.close();
