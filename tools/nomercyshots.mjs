/*
 Foto's bij stap 140 (npm run nomercyshots): No Mercy 4 in het Tinga-bos. De set met de 8,8 cm Flak, Erik Jan en de
 cameraman (nomercy_flak.png), de knal (nomercy_knal.png) en de Duitsers die eraan komen, met Erik in uniform
 (nomercy_duitsers.png). In docs/screenshots/.
*/
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const poort = process.argv[2] || '8123';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
let fouten = 0;
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  const W = await import('/js/world.js');
  for (let n = 1; n <= 15; n++) localStorage.removeItem(n === 1 ? 'tinga.spel.v1' : `tinga.spel.v1.${n}`);
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, v = g.verhaal;
  g.player.active = false;
  window.__autoplay = false;
  window.__W = W;
  g.sfeer.uur = 13; g.sfeer.weer = 'helder';
  if (g.reliëfAf) g.reliëfAf();
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) { g.player.health = 100; v.update(dt); } };
  window.__klik = (max = 80) => { for (let i = 0; i < max && !document.getElementById('dialoog').hidden; i++) { v.toets(); window.__stap(1); } };
  window.__zet = (x, z) => { const [rx, rz] = W.resolveCollisions(x, z, 0.4); g.player.inCar = null; g.player.pos.set(rx, 0, rz); g.player.applyCamera(); };
  // na missie 5, en dan los naar Erik Jan
  const s = v.bewaar(); s.missie = 'bx'; s.fase = 'wacht'; s.noMercyKlaar = false; v.herstel(s);
  window.__stap(2);
  v.startNoMercy(); window.__klik(); window.__stap(90);
  const f = v.noMercy.set.groep.position;
  window.__zet(f.x - 3, f.z + 10.5); window.__stap(3); window.__klik();
});

const map = 'docs/screenshots';
const kijk = `(van, naar) => {
  const g = window.__game, C = g.camera;
  C.position.set(van[0], van[1], van[2]); C.lookAt(naar[0], naar[1], naar[2]); C.updateMatrixWorld(true);
  window.__W.updateLOD(C.position.x, C.position.z);
  g.scene.updateMatrixWorld(true); g.renderer.shadowMap.needsUpdate = true;
  g.renderer.render(g.scene, C);
  g.renderer.render(g.scene, C);
  return g.renderer.domElement.toDataURL('image/png');
}`;
const opname = async (naam, code) => {
  const data = await page.evaluate(new Function(code));
  writeFileSync(`${map}/${naam}.png`, Buffer.from(data.split(',')[1], 'base64'));
  console.log(`${map}/${naam}.png`);
};

// 1. de set: de Flak schuin van voren, Erik bij het kanon, de cameraman op hem, Erik Jan bij zijn stoel
await opname('nomercy_flak', `
  const g = window.__game, v = g.verhaal, n = v.noMercy, f = n.set.groep.position, S = n.set;
  const e = S.naarWereld(-2.6, 1.2);
  window.__zet(e.x, e.z);
  g.player.yaw = Math.atan2(-(f.x - e.x), -(f.z - e.z));
  const c = S.naarWereld(-4.4, 3.6);
  n.cam.zetNeer(c.x, c.z, Math.atan2(-(e.x - c.x), -(e.z - c.z))); n.cam.update(0.05, { mikt: true });
  g.derde.aan = true; g.derde.update(0.016, null);
  const k = S.naarWereld(-7.5, -3.2);
  return (${kijk})([k.x, 2.3, k.z], [f.x - 0.5, 1.5, f.z]);
`);

// 2. de knal
await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, n = v.noMercy, f = n.set.groep.position;
  const r = n.set.ruit;
  window.__zet(r.x + 0.8, r.z); window.__stap(1); v.toets();
  const dx = r.x - f.x, dz = r.z - f.z, d = Math.hypot(dx, dz);
  window.__zet(f.x + dx / d * 17, f.z + dz / d * 17);
  for (let i = 0; i < 80 && v.noMercy.fase !== 'knal'; i++) window.__stap(1);
  window.__stap(5);
});
await opname('nomercy_knal', `
  const g = window.__game, v = g.verhaal, n = v.noMercy, f = n.set.groep.position;
  const k = n.set.naarWereld(-7, -4.5);
  return (${kijk})([k.x, 2.2, k.z], [f.x, 2.6, f.z]);
`);

// 3. de Duitsers komen eraan; Erik in uniform op de voorgrond
await page.evaluate(() => { window.__stap(70); });
await opname('nomercy_duitsers', `
  const g = window.__game, v = g.verhaal, n = v.noMercy, P = g.player, W = window.__W;
  const ws = n.golf.wachters.filter(w => w.staat !== 'neer');
  // Erik op de open plek, twee Duitsers op zes en negen meter voor hem, de camera opzij
  const f = n.set.groep.position, S = n.set;
  const e = S.naarWereld(-4.5, -4.0);
  window.__zet(e.x, e.z);
  const voor = { x: e.x - f.x, z: e.z - f.z }, d0 = Math.hypot(voor.x, voor.z);   // van het kanon af, het bos in
  const ux = voor.x / d0, uz = voor.z / d0;
  P.yaw = Math.atan2(-ux, -uz);
  [[6, -1.2], [9, 1.6]].forEach(([a, b], i) => {
    const w = ws[i]; if (!w) return;
    const [x, z] = W.resolveCollisions(e.x + ux * a - uz * b, e.z + uz * a + ux * b, 0.4);
    w.persoon.legNeer(0); w.persoon.groep.visible = true;
    w.persoon.zetNeer(x, z, Math.atan2(-(e.x - x), -(e.z - z)));
    w.persoon.update(0.05, { mikt: true });
    if (i === 0) w.persoon.vuur();
  });
  g.derde.aan = true; g.derde.update(0.016, null);
  const cx = e.x + ux * 3 + uz * 5.5, cz = e.z + uz * 3 - ux * 5.5;
  return (${kijk})([cx, 1.7, cz], [e.x + ux * 4, 1.2, e.z + uz * 4]);
`);

await browser.close();
console.log(fouten ? `\n${fouten} fout` : '\nalles goed');
process.exit(fouten ? 1 : 0);
