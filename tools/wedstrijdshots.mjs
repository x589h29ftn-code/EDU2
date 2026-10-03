/*
 Foto's van de wedstrijd bij VV Sneek (stap 111):

   wedstrijd_overzicht.png   het hoofdveld om één uur, van achter de hoekvlag: twee elftallen, de bal
   wedstrijd_bal.png         laag bij de bal, tussen de spelers
   wedstrijd_tribune.png     het publiek op de tribune

 Gebruik: npm run server &   node tools/wedstrijdshots.mjs 8123 [map]
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

const foto = async (naam, { wacht = 1500 } = {}) => {
  await page.evaluate(() => {
    const g = window.__game;
    g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
    g.hud.missieT = 0; g.hud.missieEl.style.transition = 'none'; g.hud.missieEl.style.opacity = 0;
    document.getElementById('dialoog').hidden = true;
    const h = document.getElementById('hint'); if (h) { h.textContent = ''; h.style.visibility = 'hidden'; }
    const u = document.getElementById('uitleg'); if (u) u.style.visibility = 'hidden';
    if (g.renderer && g.renderer.shadowMap) g.renderer.shadowMap.needsUpdate = true;
  });
  await page.waitForTimeout(wacht);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 600000 });
  console.log(`${map}/${naam}.png`);
};
// de camera op (x, y, z), kijkend naar (kx, ky, kz), via de speler; de wedstrijd staat dan stil
const kamera = (x, y, z, kx, ky, kz) => page.evaluate(async ({ x, y, z, kx, ky, kz }) => {
  const W = await import('/js/world.js');
  const g = window.__game, pl = g.player;
  window.__autoplay = false; pl.active = false;
  pl.inCar = null; pl.zit = false; pl.fly = false;
  pl.wapenUit = true; if (pl.gun) pl.gun.visible = false;
  pl.pos.set(x, y - pl.eye, z);
  pl.yaw = Math.atan2(-(kx - x), -(kz - z));
  pl.pitch = Math.atan2(ky - y, Math.hypot(kx - x, kz - z));
  pl.applyCamera();
  W.updateLOD(x, z); g.vehicles.lod(x, z);
  if (g.grasVeld) g.grasVeld.update(x, z, true);
  // de hoofdlus mag de wedstrijd niet laten wisselen terwijl we kijken
  window.__wedVast = true;
}, { x, y, z, kx, ky, kz });

// de wedstrijd laten beginnen (uit beeld) en een minuut laten spelen
const spel = await page.evaluate(() => {
  const g = window.__game, w = g.wedstrijd, V = w.veld;
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  g.reliëfAf();
  window.__autoplay = false; g.player.active = false;
  g.sfeer.weer = 'helder'; g.sfeer.uur = 13;
  const P = g.player;
  P.pos.set(V.cx + 600, 0, V.cz + 600); P.yaw = Math.atan2(-600, -600); P.applyCamera(); g.camera.updateMatrixWorld();
  for (let i = 0; i < 3; i++) g.werkWedstrijdBij(0.1);
  // dichtbij, met de rug naar het veld: dan speelt hij
  P.pos.set(V.cx - 80, 0, V.cz - 80); P.yaw = Math.atan2(80, 80); P.applyCamera(); g.camera.updateMatrixWorld();
  for (let i = 0; i < 600; i++) g.werkWedstrijdBij(0.1);
  const b = w.balWereld;
  // wie staat er het dichtst bij de bal, en waar is de tribune
  return { kant: V.tribune ? V.tribune.kant : 1, V: { cx: V.cx, cz: V.cz, hoek: V.hoek, vl: V.vl, vb: V.vb }, bal: b, trib: V.tribune ? { x: V.tribune.vx, z: V.tribune.vz } : null };
});

// ------------------------------------------------------ overzicht van achter de hoek
{
  const { V } = spel;
  const ex = Math.cos(V.hoek), ez = Math.sin(V.hoek);
  const wx = (u, v) => V.cx + ex * u - ez * v, wz = (u, v) => V.cz + ez * u + ex * v;
  // aan de overkant van de tribune, boven het hek, hoog genoeg om over de bomen langs de lijn te kijken
  const kant = spel.kant || 1;
  const u = -V.vl * 0.18, v = -kant * (V.vb / 2 + 9);
  await kamera(wx(u, v), 15, wz(u, v), V.cx + (V.cx - wx(u, v)) * 0.15, 0, V.cz + (V.cz - wz(u, v)) * 0.15);
  await foto('wedstrijd_overzicht');
}
// ------------------------------------------------------ bij de bal
{
  const b = spel.bal;
  const { V } = spel;
  const p = await page.evaluate(({ b }) => {
    const w = window.__game.wedstrijd;
    // de camera een meter of twaalf van de bal, aan de kant van de zijlijn
    const uv = w.naarUV(b.x, b.z);
    const v = uv.v > 0 ? uv.v + 11 : uv.v - 11;
    return { x: w.wx(uv.u - 4, v), z: w.wz(uv.u - 4, v) };
  }, { b });
  await kamera(p.x, 1.6, p.z, b.x, 0.6, b.z);
  await foto('wedstrijd_bal');
}
// ------------------------------------------------------ de tribune
if (spel.trib) {
  const { V, trib } = spel;
  const dx = V.cx - trib.x, dz = V.cz - trib.z, d = Math.hypot(dx, dz);
  await kamera(trib.x + dx / d * 16, 2.4, trib.z + dz / d * 16, trib.x, 1.4, trib.z);
  await foto('wedstrijd_tribune');
}

await browser.close();
