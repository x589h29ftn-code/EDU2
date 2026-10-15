/*
 Foto's bij stap 196 (npm run geocacheshots): de Tinga Cache. In docs/screenshots/:
   cache_gps.png       de GPS in beeld bij cache 2 (het raadsel), met de wereld erachter
   cache_poster_bp.png de poster op de balie van de BP-shop
   cache_poster_tafel.png de poster op de eettafel thuis
   cache_kistje.png    een cache bij de oude Geeuwbrug
   cache_sjors.png     Sjors en het prikbord bij Radio Tinga
   cache_goud.png      de gouden M1 Garand in je handen

 Gebruik: npm run server &  node tools/geocacheshots.mjs [poort] [map]
*/
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const poort = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(900000);
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  window.__W = await import('/js/world.js'); const g = window.__game; g.reliëfAf();
  document.getElementById('overlay').style.display = 'none';
  const v = g.verhaal, P = g.player;
  P.active = true; window.__autoplay = true;
  const s = v.bewaar(); Object.assign(s, { missie: 'klaar', fase: 'klaar', volgende: null, uitzendingKlaar: true, invalKlaar: true, ronaldKlaar: true, roanKlaar: true, noMercyKlaar: true, geld: 5000 });
  v.herstel(s);
  g.geocache.herstel({ gps: true, intro: true, gevonden: 1, invoer: '' });
  g.sfeer.uur = 14; g.sfeer.weer = 'helder';
  window.__beeld = (C) => {
    for (let i = 0; i < 3; i++) g.sfeer.update(0.1, C.position.x, C.position.z);
    window.__W.updateLOD(C.position.x, C.position.z); g.scene.updateMatrixWorld(true); g.renderer.shadowMap.needsUpdate = true;
    C.updateMatrixWorld(true); g.renderer.render(g.scene, C); g.renderer.render(g.scene, C);
    return g.renderer.domElement.toDataURL('image/png');
  };
});
const schrijf = (naam, data) => { writeFileSync(`${map}/${naam}.png`, Buffer.from(data.split(',')[1], 'base64')); console.log(`${map}/${naam}.png`); };
const foto = async (naam, zet) => schrijf(naam, await page.evaluate((z) => {
  const g = window.__game, C = g.camera, P = g.player, Gc = g.geocache;
  new Function('g', 'C', 'P', 'Gc', z)(g, C, P, Gc);
  return window.__beeld(C);
}, zet));

// de GPS: de hele pagina, met de wereld erachter (bij cache 2, het raadsel)
await page.evaluate(() => {
  const g = window.__game, C = g.camera, P = g.player, Gc = g.geocache;
  const c = Gc.stand.caches[1];
  P.pos.set(c.plek.x + 40, 0, c.plek.z + 25); P.yaw = Math.atan2(40, 25); P.pitch = -0.05; P.applyCamera();
  for (let i = 0; i < 4; i++) Gc.update(0.05);
  if (!Gc.aan) Gc.wissel();
  for (const d of '123456') Gc.cijfer(+d);
  for (let i = 0; i < 3; i++) Gc.update(0.05);
  window.__beeld(C);
});
await page.waitForTimeout(400);
await page.screenshot({ path: `${map}/cache_gps.png` }); console.log(`${map}/cache_gps.png`);
await page.evaluate(() => { const Gc = window.__game.geocache; if (Gc.aan) Gc.wissel(); document.getElementById('ui').style.display = 'none'; });

await foto('cache_poster_bp', `const B = Gc.posters.find(m => m.geometry.type === 'PlaneGeometry' && m.position.y > 1.0 && m.position.y < 1.4);
  const p = B.position, n = new g.camera.position.constructor(0, 0, 1).applyQuaternion(B.quaternion);
  C.position.set(p.x + n.x * 0.9 + 0.25, p.y + 0.2, p.z + n.z * 0.9); C.lookAt(p.x, p.y - 0.05, p.z);`);
await foto('cache_poster_tafel', `const w = g.woningen.find(w => /Koningsspil/.test(w.adres || w.naam || ''));
  const t = w.plekken.tafel; C.position.set(t.x - 0.7, 1.55, t.z + 0.8); C.lookAt(t.x + 0.18, 0.74, t.z - 0.06);`);
await foto('cache_kistje', `const c = Gc.stand.caches[0];
  const y = c.plek.y || 0; C.position.set(c.plek.x + 1.6, 1.1, c.plek.z + 1.3); C.lookAt(c.plek.x, 0.15, c.plek.z);`);
await foto('cache_sjors', `const s = Gc.sjors; for (let i = 0; i < 6; i++) Gc.update(0.05);
  const p = s.groep.position; P.pos.set(p.x + 30, 0, p.z + 30); for (let i = 0; i < 4; i++) Gc.update(0.05);
  P.pos.set(p.x + 2.5, 0, p.z + 1.2); for (let i = 0; i < 20; i++) Gc.update(0.05);
  C.position.set(p.x + 3.6, 1.65, p.z + 2.4); C.lookAt(p.x, 1.2, p.z);`);
// de gouden M1 in je handen: de wereld en het wapen in één beeld, en meteen uitlezen (anders is de tekening weg)
schrijf('cache_goud', await page.evaluate(() => {
  const g = window.__game, P = g.player;
  P.modellen.garand.zetGoud(true);
  if (!P.wapens.includes('garand')) P.krijgWapen('garand');
  P.zetWapen('garand'); P.wisselT = 0; P.holster = 0;
  P.pos.set(46, 0, 1112); P.yaw = 0; P.pitch = 0.05; P.applyCamera();
  for (let i = 0; i < 20; i++) P.update(0.05);
  window.__beeld(g.camera);
  P.gun.visible = true; g.tekenWapen();
  return g.renderer.domElement.toDataURL('image/png');
}));
await browser.close();
