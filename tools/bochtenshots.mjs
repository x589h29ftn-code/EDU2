/*
 Foto's van het verkeer in de bocht (stap 98):

   bocht_lijn.png   een scherpe bocht van boven: rood de oude lijn (de BGT-as met de strook
                    ernaast, per stuk, met de sprong in elke knik), groen de gladde lijn waar
                    het verkeer nu over rijdt, met een wijkauto erop
   bocht_keren.png  het eind van een straat: de halve cirkel waarmee een wijkauto keert,
                    en de auto halverwege

 Gebruik: npm run server &   node tools/bochtenshots.mjs 8123 [map]
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

const foto = async (naam) => {
  await page.evaluate(() => {
    const g = window.__game;
    g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
    document.getElementById('dialoog').hidden = true;
    const h = document.getElementById('hint'); if (h) { h.textContent = ''; h.style.visibility = 'hidden'; }
    const u = document.getElementById('uitleg'); if (u) u.style.visibility = 'hidden';
    if (g.renderer && g.renderer.shadowMap) g.renderer.shadowMap.needsUpdate = true;
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 600000 });
  console.log(`${map}/${naam}.png`);
};
// de camera op (x, y, z), kijkend naar (kx, ky, kz); zie tools/schaduwshots.mjs
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
}, { x, y, z, kx, ky, kz });

await page.evaluate(async () => {
  const THREE = await import('three');
  const { gladPad } = await import('/js/vehicles.js');
  const g = window.__game, V = g.vehicles;
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  g.sfeer.weer = 'helder'; g.sfeer.uur = 14;
  g.reliëfAf();
  window.__autoplay = false; g.player.active = false;
  // alle verkeer weg, behalve de auto die op de foto moet
  for (const t of V.traffic) { t.slaapt = true; t.mesh.visible = false; }
  const lijn = (pts, kleur, y = 0.45) => {
    const geo = new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(p.x, y, p.z)));
    const m = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: kleur, depthTest: false }));
    m.renderOrder = 10;
    g.scene.add(m);
    // en een tweede, net iets verschoven: een lijn van één pixel is op de foto niet te zien
    const m2 = m.clone(); m2.position.x += 0.06; m2.position.z += 0.06; g.scene.add(m2);
  };
  // dezelfde keus als tools/bochtentest.mjs: een bocht onder 4,5 m/s met een rechte aanloop
  let keus = null;
  for (const pts of V.rijbanen) {
    const gp = gladPad(pts);
    for (let i = 35; i < gp.length - 10 && !keus; i++) {
      if (gp.vmax[i] > 4.5 || gp.vmax[i] < 3) continue;
      let recht = true;
      for (let j = i - 32; j < i - 4; j++) if (gp.vmax[j] < 12) { recht = false; break; }
      if (recht) keus = { pts, gp, i };
    }
    if (keus) break;
  }
  const LANE = 1.4;
  // de oude lijn: elk stuk van de as met de strook ernaast, los (de sprong zit in de knik)
  const midden = keus.gp[keus.i];
  for (let j = 1; j < keus.pts.length; j++) {
    const a = keus.pts[j - 1], b = keus.pts[j];
    if (Math.hypot(a.x - midden.x, a.y - midden.y) > 60 && Math.hypot(b.x - midden.x, b.y - midden.y) > 60) continue;
    const l = a.distanceTo(b) || 1, nx = -(b.y - a.y) / l, nz = (b.x - a.x) / l;
    lijn([{ x: a.x + nx * LANE, z: a.y + nz * LANE }, { x: b.x + nx * LANE, z: b.y + nz * LANE }], 0xe23b2e, 0.5);
  }
  // de nieuwe: de gladde lijn met dezelfde strook
  const groen = [];
  for (let j = Math.max(0, keus.i - 30); j < Math.min(keus.gp.length, keus.i + 30); j++) {
    const p = keus.gp[j], tx = keus.gp.raak.tx[j], tz = keus.gp.raak.tz[j];
    groen.push({ x: p.x - tz * LANE, z: p.y + tx * LANE });
  }
  lijn(groen, 0x39d353, 0.55);
  // een wijkauto in de top van de bocht
  const t = V.traffic.find(q => q.lokaal);
  t.slaapt = false; t.mesh.visible = true;
  t.path = keus.gp; t.t = keus.i - 1.5; t.dir = 1; t.lane = LANE; t.keer = null; t.snelheid = 0; t.doel = 0; t.speed = 0;
  V.updateTraffic(1e-4);
  window.__bocht = { x: midden.x, z: midden.y };
});
{
  const b = await page.evaluate(() => window.__bocht);
  await kamera(b.x + 14, 26, b.z + 20, b.x, 0, b.z);
  await foto('bocht_lijn');
}

// ------------------------------------------------------ keren
await page.evaluate(async () => {
  const THREE = await import('three');
  const g = window.__game, V = g.vehicles;
  const t = V.traffic.find(q => q.lokaal && q.bounce);
  t.slaapt = false; t.mesh.visible = true;
  t.path = V.traffic.find(q => q.lokaal && q.bounce && q !== t)?.path || t.path;
  const n = t.path.length;
  t.t = n - 6; t.dir = 1; t.keer = null; t.haast = 0; t.achteruit = 0; t.speed = 7; t.snelheid = 3; t.doel = 3;
  // rijden tot hij halverwege de halve cirkel is; onderweg de sporen neerleggen
  const spoor = [];
  for (let i = 0; i < 400 && !(t.keer && t.keer.f > 0.5); i++) {
    V.updateTraffic(1 / 30);
    if (i % 3 === 0) spoor.push(new THREE.Vector3(t.mesh.position.x, 0.5, t.mesh.position.z));
  }
  // en de rest van de cirkel, voorspeld uit de keer zelf
  const k = t.keer;
  for (let f = k.f; f <= 1.001; f += 0.05) {
    const a = Math.PI * f;
    spoor.push(new THREE.Vector3(k.cx + k.ux * Math.cos(a) + k.vx * Math.sin(a), 0.5, k.cz + k.uz * Math.cos(a) + k.vz * Math.sin(a)));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(spoor);
  const m = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x39d353, depthTest: false }));
  m.renderOrder = 10; g.scene.add(m);
  const m2 = m.clone(); m2.position.x += 0.06; g.scene.add(m2);
  window.__keer = { x: k.cx, z: k.cz };
});
{
  const b = await page.evaluate(() => window.__keer);
  await kamera(b.x + 10, 16, b.z + 12, b.x, 0, b.z);
  await foto('bocht_keren');
}

await browser.close();
