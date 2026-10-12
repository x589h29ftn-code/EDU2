/*
 Foto's bij stap 140 (npm run nomercyshots): No Mercy 4 in het Tinga-bos. De set met de 8,8 cm Flak, Erik Jan en de
 cameraman (nomercy_flak.png), de knal (nomercy_knal.png) en de Duitsers die eraan komen, met Erik in uniform
 (nomercy_duitsers.png). In docs/screenshots/.

 Stap 141, de tweede scène "Het bunkerdorp": het kamp met de tent, de stafauto, de radiopost en de schildwachten
 (nomercy_kamp.png), de radiopost die de lucht in gaat (nomercy_radio.png), en Erik Jan met het klapbord na de
 close-up (nomercy_klapbord.png).
*/
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const poort = process.argv[2] || '8123';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: +(process.env.SHOT_B || 1280), height: +(process.env.SHOT_H || 720) } });
let fouten = 0;
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
page.on('console', m => { if (/^(kamp|radio|klapbord):/.test(m.text())) console.log(m.text()); });
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

const map = process.env.SHOT_MAP || process.argv[3] || 'docs/screenshots';
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

// 4. het bunkerdorp: de tent, de stafauto, de radiopost, de schildwachten; Erik aan de rand
await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  v.noMercy.naarKamp();
  window.__stap(2); window.__klik(); window.__stap(40);
});
await opname('nomercy_kamp', `
  const g = window.__game, v = g.verhaal, n = v.noMercy, P = g.player, K = n.kamp.midden;
  const e = n.kamp.naarWereld({ x: -9.6, z: 2.6 });
  window.__zet(e.x, e.z);
  P.yaw = Math.atan2(-(K.x - e.x), -(K.z - e.z));
  const c = n.kamp.naarWereld({ x: -8.4, z: 4.6 });
  n.cam.zetNeer(c.x, c.z, Math.atan2(-(e.x - c.x), -(e.z - c.z))); n.cam.update(0.05, { mikt: true });
  g.derde.aan = true; g.derde.update(0.016, null);
  const k = n.kamp.naarWereld({ x: -10.5, z: 5.5 });
  console.log('kamp: fase ' + n.fase + ', camera ' + Math.hypot(k.x - K.x, k.z - K.z).toFixed(1) + ' m van het midden');
  return (${kijk})([k.x, 2.9, k.z], [K.x + 2, 0.8, K.z - 1.5]);
`);

// 5. de radiopost gaat de lucht in
await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, n = v.noMercy;
  const i = n.kamp.ingang; window.__zet(i.x, i.z); window.__stap(2); v.toets(); window.__stap(2);
  for (const w of v.noMercy.golf.wachters) { let k = 0; while (w.staat !== 'neer' && k++ < 10) { v.raak(w.persoon.groep.children[0], 99); window.__stap(1); } }
  window.__stap(4); window.__klik();
  const r = v.noMercy.kamp.radioRuit; window.__zet(r.x, r.z); window.__stap(2); v.toets();
  const rp = v.noMercy.kamp.radioPlek; window.__zet(rp.x - 13, rp.z - 3);
  for (let i = 0; i < 120 && v.noMercy.fase !== 'radioKnal'; i++) window.__stap(1);
  // de vuurbal is na een seconde uit; dan de rook, de vonken op de grond en de post scheef
  window.__stap(24);
  console.log('radio: fase ' + v.noMercy.fase);
});
await opname('nomercy_radio', `
  const g = window.__game, v = g.verhaal, n = v.noMercy, r = n.kamp.radioPlek, P = g.player;
  g.derde.aan = true; g.derde.update(0.016, null);
  const k = n.kamp.naarWereld({ x: -5, z: 8.5 });
  return (${kijk})([k.x, 2.0, k.z], [r.x, 1.4, r.z]);
`);

// 6. de close-up, het applaus en het klapbord
await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  for (let i = 0; i < 80 && v.noMercy.fase !== 'closeup'; i++) window.__stap(1);
  window.__klik();
  const c = v.noMercy.kamp.closeup; window.__zet(c.x, c.z);
  for (let i = 0; i < 120 && v.noMercy.fase === 'closeup'; i++) window.__stap(1);
  // Erik Jan loopt naar de camera en houdt het klapbord omhoog
  window.__stap(60);
  const n = v.noMercy, ej = n.ej.groep.position, s = n.kamp.ejSlot;
  console.log('klapbord: fase ' + n.fase + ', Erik Jan ' + (n.ej.groep.visible ? 'zichtbaar' : 'weg') + ' op ' + Math.hypot(ej.x - s.x, ej.z - s.z).toFixed(1) + ' m van zijn plek, bord ' + n.klapbord.visible);
});
await opname('nomercy_klapbord', `
  const g = window.__game, v = g.verhaal, n = v.noMercy, P = g.player, ej = n.ej.groep.position;
  const c = n.kamp.closeup;
  P.yaw = Math.atan2(-(ej.x - P.pos.x), -(ej.z - P.pos.z));
  g.derde.aan = true; g.derde.update(0.016, null);
  n.ej.kijkNaar(P.pos.x + 1.5, P.pos.z, 1, 99); n.ej.update(0.05, { mikt: true });
  // van schuin voor Erik Jan, met Erik op de ruit erachter
  const yaw = n.ej.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const k = { x: ej.x + fx * 2.3 - fz * 0.9, z: ej.z + fz * 2.3 + fx * 0.9 };
  return (${kijk})([k.x, 1.75, k.z], [ej.x, 1.55, ej.z]);
`);

await browser.close();
console.log(fouten ? `\n${fouten} fout` : '\nalles goed');
process.exit(fouten ? 1 : 0);
