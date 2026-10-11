/*
 Foto's bij stap 138 (npm run onderdoorgangshots): de bak van de N7 bij (719, −156)
 vanuit de hoeken van de schermafdrukken van de gebruiker (6.webp: op de rijbaan,
 oostwaarts; 7.webp: hoog achter een auto, de bak in) en een paar andere, en de
 muurtjes bij (960, −195) 's nachts (4.png).

 Gebruik: node tools/onderdoorgangshots.mjs 8123 [voor|na]
   → docs/screenshots/viaduct_<voor|na>_1.png … _6.png
*/
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const poort = process.argv[2] || '8123';
const wanneer = process.argv[3] || 'na';
const map = 'docs/screenshots';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = false; window.__autoplay = false;
  window.__W = await import('/js/world.js');
  window.__KW = await import('/js/kaartwereld.js');
  g.reliëfAf();
  // het verkeer en de geparkeerde auto's uit beeld; dit gaat om de weg zelf
  for (const t of g.vehicles.traffic) if (t.mesh) { t.mesh.visible = false; t.mesh.position.x += 5000; }
});

// een eigen camera, recht in het canvas (de hud hoort er niet bij)
const opname = async (nr, van, naar, uur = 13) => {
  const data = await page.evaluate(({ van, naar, uur }) => {
    const g = window.__game, C = g.camera, W = window.__W;
    g.sfeer.uur = uur; g.sfeer.weer = 'helder';
    for (let i = 0; i < 5; i++) g.sfeer.update(0.1, van[0], van[2]);
    if (g.werkOmgevingBij) g.werkOmgevingBij(7);
    C.position.set(van[0], van[1], van[2]); C.lookAt(naar[0], naar[1], naar[2]); C.updateMatrixWorld(true);
    W.updateLOD(C.position.x, C.position.z);
    g.vehicles.lod(C.position.x, C.position.z);
    if (g.grasVeld) g.grasVeld.update(C.position.x, C.position.z, true);
    if (g.zetSchaduwDoos) g.zetSchaduwDoos(C.position.x, C.position.z);
    if (g.werkLantaarnsBij) g.werkLantaarnsBij(0.1, C.position.x, C.position.z);
    g.scene.updateMatrixWorld(true); g.renderer.shadowMap.needsUpdate = true;
    g.renderer.render(g.scene, C);
    return g.renderer.domElement.toDataURL('image/png');
  }, { van, naar, uur });
  const pad = `${map}/viaduct_${wanneer}_${nr}.png`;
  writeFileSync(pad, Buffer.from(data.split(',')[1], 'base64'));
  console.log(pad);
};
const gh = (x, z) => page.evaluate(({ x, z }) => window.__W.grondHoogte(x, z, -Infinity), { x, z });

// 1. zoals 6.webp: op de rijbaan in de bak op (719.3, −156.2), oostwaarts
{ const y = await gh(719.3, -156.2); await opname(1, [719.3, y + 1.6, -156.2], [790, y + 0.6, -152]); }
// 2. zoals 7.webp: hoog achter een auto, schuin de bak in naar het oosten
{ const y = await gh(712, -157); await opname(2, [706, y + 8.5, -158.5], [745, y - 1, -155]); }
// 3. van opzij op maaiveld, vanaf de zuidkant de bak in (de oprit en het fietstunneltje)
await opname(3, [728, 4.5, -186], [742, -4, -152]);
// 4. van boven, recht over de bak bij de fietstunnels
await opname(4, [725, 38, -175], [742, -5, -152]);
// 5. vanaf het noorden, westwaarts de bak uit
{ const y = await gh(749, -147); await opname(5, [749, y + 1.7, -147], [700, y + 1, -155]); }

// 6. zoals 4.png: 's nachts langs het water bij (960, −194.9), de muurtjes links van de weg
{
  const r = await page.evaluate(() => {
    const K = window.__KW.KAART, KW = window.__KW;
    // de richting van de dichtstbijzijnde weg-as
    let best = null, bd = 1e9;
    for (const a of K.wegassen) {
      const p = a.pts || a.p || a.punten; if (!p) continue;
      for (let i = 1; i < p.length; i++) {
        const A = p[i - 1], B = p[i], dx = B[0] - A[0], dz = B[1] - A[1], L2 = dx * dx + dz * dz || 1e-9;
        let t = ((960 - A[0]) * dx + (-194.9 - A[1]) * dz) / L2; t = Math.max(0, Math.min(1, t));
        const d = Math.hypot(960 - A[0] - dx * t, -194.9 - A[1] - dz * t);
        if (d < bd) { bd = d; const L = Math.sqrt(L2); best = [dx / L, dz / L]; }
      }
    }
    if (!best) best = [0.95, 0.3];
    // water links: links van de kijkrichting is (fz, −fx)
    let f = best;
    const water = (x, z) => { const v = KW.vlakOp(x, z); return v && v.k === 'water'; };
    let links = 0, rechts = 0;
    for (let d = 5; d < 40; d += 2) { if (water(960 + f[1] * d, -194.9 - f[0] * d)) links++; if (water(960 - f[1] * d, -194.9 + f[0] * d)) rechts++; }
    if (rechts > links) f = [-f[0], -f[1]];
    return { f, bd };
  });
  const [fx, fz] = r.f;
  await opname(6, [960 - fx * 9, 4.2, -194.9 - fz * 9], [960 + fx * 14, 0, -194.9 + fz * 14], 23);
}
console.log('EINDE');
await browser.close();
