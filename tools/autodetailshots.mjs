/*
 Foto's bij stap 172 (npm run autodetailshots): de auto's zelf. In docs/screenshots/:

   auto_rem_avond.png        een remmende auto van achteren, 's avonds: het remlicht feller dan het achterlicht
   auto_rem_dag.png          dezelfde auto overdag: het remlicht is ook dan te zien
   auto_achteruit.png        een auto die achteruit rijdt: het witte licht
   auto_bestuurder_hatch.png de bestuurder door de zijruit, in een hatchback
   auto_bestuurder_bus.png   en in een bus
   auto_wielen.png           de voorwielen ingedraaid

 Gebruik: node tools/server.mjs 8132 &  node tools/autodetailshots.mjs 8132 [map]   (FOTO=<naam>[,<naam>] voor een paar foto's)
*/
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const poort = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
const alleen = process.env.FOTO ? process.env.FOTO.split(',') : null;
mkdirSync(map, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(1800000);
let fouten = 0;
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 1800000 });

// een rechte straat bij het beginpunt, en twee auto's erop (een hatchback en een bus)
await page.evaluate(async () => {
  window.__W = await import('/js/world.js');
  const { KAART } = await import('/js/kaart.js');
  const g = window.__game;
  document.getElementById('overlay').style.display = 'none'; document.getElementById('ui').style.display = 'none';
  g.player.active = false; window.__autoplay = false;
  await g.voorbereidSpel();
  g.reliëfAf();
  const s = g.start || { x: g.player.pos.x, z: g.player.pos.z };
  let best = null;
  for (const w of KAART.wegassen) {
    if (!w.drive || w.lengte < 70 || w.naam === 'N7') continue;
    for (let i = 0; i + 1 < w.pts.length; i++) {
      const a = w.pts[i], b = w.pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 30) continue;
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, d = Math.hypot(mx - s.x, mz - s.z);
      if (!best || d < best.d) best = { d, mx, mz, dx: (b[0] - a[0]) / L, dz: (b[1] - a[1]) / L };
    }
  }
  const yaw = Math.atan2(-best.dx, -best.dz);
  // het verkeer en de voetgangers uit de buurt
  for (const t of g.vehicles.traffic) t.mesh.position.set(1e5, -50, 1e5);
  if (g.npcs && g.npcs.people) for (const p of g.npcs.people) if (Math.hypot(p.x - best.mx, p.z - best.mz) < 30) { p.slaapt = true; if (p.groep) p.groep.visible = false; }
  const zij = { x: best.dz, z: -best.dx };   // rechts van de rijrichting
  const plek = (k) => ({ x: best.mx + zij.x * 1.6 + best.dx * k, z: best.mz + zij.z * 1.6 + best.dz * k });
  const p1 = plek(0), p2 = plek(-14);
  const hatch = g.vehicles.voegToe({ x: p1.x, z: p1.z, yaw, soort: 'hatch', kleur: 0x2f5d9a, driveable: false });
  const bus = g.vehicles.voegToe({ x: p2.x, z: p2.z, yaw, soort: 'van', kleur: 0xd8d9dc, driveable: false });
  for (const c of [hatch, bus]) g.vehicles.zetNeer(c, 0, yaw);
  window.__shot = { best, yaw, hatch, bus, zij };
});

const foto = async (naam, opzet) => {
  if (alleen && !alleen.includes(naam)) return;
  const data = await page.evaluate(([opzet]) => {
    const g = window.__game, C = g.camera, S = window.__shot;
    const { hatch, bus, yaw } = S;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);         // vooruit
    const rx = -fz, rz = fx;                                 // rechts (gezien vanuit de bestuurder)
    for (const c of [hatch, bus]) {
      const u = c.mesh.userData;
      u.rem.visible = false; u.achteruit.visible = false; u.bestuurder.visible = false;
      for (const w of u.wielen) w.groep.rotation.y = 0;
      c.metBestuurder = undefined;
    }
    const c = opzet.auto === 'bus' ? bus : hatch, u = c.mesh.userData;
    if (opzet.rem) u.rem.visible = true;
    if (opzet.achteruit) u.achteruit.visible = true;
    if (opzet.bestuurder) { u.bestuurder.visible = true; }
    if (opzet.stuur) for (const w of u.wielen) if (w.stuur) w.groep.rotation.y = opzet.stuur;
    // (de koplampen en achterlichten volgen de klok via js/sfeer.js)
    g.sfeer.uur = opzet.uur; g.sfeer.weer = 'helder';
    for (let i = 0; i < 3; i++) g.sfeer.update(0.1, c.x, c.z);
    const [a, h, z] = opzet.cam;                            // a: achter (+) of voor (−), h: hoogte, z: opzij (links −)
    const y0 = c.mesh.position.y;
    C.position.set(c.x - fx * a + rx * z, y0 + h, c.z - fz * a + rz * z);
    const [ka, kh, kz] = opzet.kijk || [0, 0.9, 0];
    C.lookAt(c.x - fx * ka + rx * kz, y0 + kh, c.z - fz * ka + rz * kz);
    if (opzet.fov) { C.fov = opzet.fov; C.updateProjectionMatrix(); }
    C.updateMatrixWorld(true);
    g.scene.traverse(o => { if (o.material && o.material.uniforms && o.material.uniforms.maanDir) o.position.copy(C.position); });
    window.__W.updateLOD(C.position.x, C.position.z); g.scene.updateMatrixWorld(true); g.renderer.shadowMap.needsUpdate = true;
    g.renderer.render(g.scene, C); g.renderer.render(g.scene, C);
    const url = g.renderer.domElement.toDataURL('image/png');
    if (opzet.fov) { C.fov = 72; C.updateProjectionMatrix(); }
    return url;
  }, [opzet]);
  writeFileSync(`${map}/${naam}.png`, Buffer.from(data.split(',')[1], 'base64'));
  console.log(`${map}/${naam}.png`);
};

await foto('auto_rem_avond', { rem: true, uur: 21.5, cam: [6.5, 1.5, -1.2], kijk: [0, 0.8, 0] });
await foto('auto_rem_dag', { rem: true, uur: 13, cam: [6.5, 1.5, -1.2], kijk: [0, 0.8, 0] });
await foto('auto_achteruit', { achteruit: true, uur: 21.5, cam: [6, 1.3, 1.4], kijk: [0, 0.7, 0] });
await foto('auto_bestuurder_hatch', { bestuurder: true, uur: 13, cam: [0.3, 1.25, -2.6], kijk: [0.15, 1.0, -0.4], fov: 50 });
await foto('auto_bestuurder_bus', { auto: 'bus', bestuurder: true, uur: 13, cam: [-0.3, 1.95, -3.1], kijk: [-0.45, 1.65, -0.5], fov: 50 });
await foto('auto_wielen', { stuur: 0.5, bestuurder: true, uur: 13, cam: [-5.2, 0.75, -1.5], kijk: [-1.32, 0.35, -0.8], fov: 50 });

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);
