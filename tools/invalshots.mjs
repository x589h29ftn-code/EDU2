/*
 Foto's van missie 16, De inval (stap 101):

   inval_straat.png   het filmbeeld van de inval: twee politieauto's en een zwart busje
                      draaien de Molenkrite in, naar Molenkrite 15
   inval_brug.png     het filmbeeld op de Dúvelsrak: Bouwman rijdt 's nachts het dek op
   inval_ruil.png     de ruil: Johan voor de politieauto, Bouwman en zijn twee mannen, de tas
                      op de gele ruit in het midden
   inval_dak.png      "Nu!": vanaf het dak van Mark, de twee mannen op het dek
   inval_crash.png    Bouwman in de berm, en hij rent het weiland in

 Gebruik: npm run server &   node tools/invalshots.mjs 8123 [map]
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
    document.getElementById('praat').hidden = true;
    document.getElementById('schaduwbalk').hidden = true;
    const h = document.getElementById('hint'); if (h) { h.textContent = ''; h.style.visibility = 'hidden'; }
    const u = document.getElementById('uitleg'); if (u) u.style.visibility = 'hidden';
    if (g.renderer && g.renderer.shadowMap) g.renderer.shadowMap.needsUpdate = true;
  });
  await page.waitForTimeout(wacht);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 600000 });
  console.log(`${map}/${naam}.png`);
};
const bevries = () => page.evaluate(() => {
  const v = window.__game.verhaal;
  if (!v.__echteUpdate) { v.__echteUpdate = v.update; v.update = () => {}; }
});
const ontdooi = () => page.evaluate(() => {
  const v = window.__game.verhaal;
  if (v.__echteUpdate) { v.update = v.__echteUpdate; v.__echteUpdate = null; }
});
// de camera op (x, y, z), kijkend naar (kx, ky, kz): via de speler, zoals in tools/brugshots.mjs
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
// het filmbeeld: waar het verhaal de camera zette
const filmFoto = async (naam) => {
  const c = await page.evaluate(() => window.__game.verhaal.inval.filmCam);
  await bevries();
  if (c) await kamera(c.pos[0], c.pos[1], c.pos[2], c.kijk[0], c.kijk[1], c.kijk[2]);
  await page.evaluate(() => document.body.classList.add('film'));
  await foto(naam);
  await ontdooi();
};

await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  g.reliëfAf();
  window.__autoplay = false; g.player.active = false;
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) { g.player.health = 100; (v.__echteUpdate || v.update).call(v, dt); } };
  window.__klik = (max = 60) => { for (let i = 0; i < max && !document.getElementById('dialoog').hidden; i++) { v.toets(); window.__stap(1); } };
  window.__tot = (fase, maxS = 30) => { for (let t = 0; t < maxS && v.fase !== fase; t += 0.05) { window.__stap(1); if (!document.getElementById('dialoog').hidden) v.toets(); } return v.fase === fase; };
  window.__zet = (x, z, y = 0) => { if (g.player.inCar) { g.player.inCar.speed = 0; g.player.inCar = null; } g.player.pos.set(x, y, z); g.player.applyCamera(); };
  window.__opFase = (fase, keus = 0) => {
    const s = v.bewaar(); s.missie = 'inval'; s.fase = fase; s.invalKeus = keus; s.invalTelefoon = false; s.schriftKwijt = false; s.invalKlaar = false;
    g.politie.reset();
    v.herstel(s);
  };
  // de ochtend: de inval gebeurt overdag
  g.sfeer.weer = 'helder'; g.sfeer.uur = 10;
  v.startMissie('inval');
  window.__stap(40); window.__klik(); window.__stap(2);
  const d = v.inval.merkPlek;
  window.__zet(d[0].x + 0.4, d[0].z); window.__stap(2); window.__klik(); v.toets(); window.__stap(2); window.__klik();
  window.__zet(d[1].x + 0.4, d[1].z); window.__stap(2); v.toets(); window.__stap(2); window.__klik();
  const nav = g.hud.nav;
  window.__zet(nav.doel[0] + 1.5, nav.doel[1] + 1.5); window.__stap(6);
  const sp = g.player.pos;
  let auto = null, ad = Infinity;
  for (const c of g.vehicles.cars) { if (!c.driveable || c.wrak) continue; const dd = Math.hypot(c.x - sp.x, c.z - sp.z); if (dd < ad) { ad = dd; auto = c; } }
  g.player.inCar = auto; window.__auto = auto;
  window.__stap(2);
  for (let i = 0; i < 200 && !v.inval.film; i++) window.__stap(1);
  // tot het tweede standpunt, de politie vlak voor de deur
  for (let i = 0; i < 200 && v.inval.film === 'inval' && v.inval.filmT < 4.6; i++) window.__stap(1);
});
await filmFoto('inval_straat');

// ------------------------------------------------------ die nacht op de brug
await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__opFase('brugFilm', 2);
  for (let i = 0; i < 400 && v.inval.film === 'brug' && v.inval.filmT < 6.5; i++) window.__stap(1);
});
await filmFoto('inval_brug');

// ------------------------------------------------------ de ruil
{
  const p = await page.evaluate(() => {
    const g = window.__game, v = g.verhaal;
    for (let i = 0; i < 400 && v.inval.film; i++) window.__stap(1);
    window.__klik();
    const I = v.inval, r = I.brugPunt(I.S.ruit, 0);
    g.player.wapenUit = true;
    window.__zet(r.x, r.z, g.player.pos.y);
    window.__stap(2); v.toets(); window.__stap(2);
    const t = I.brugPunt(I.S.ruit - 7, 0.8);
    window.__zet(t.x, t.z, g.player.pos.y);
    window.__stap(4); window.__klik();
    const cam = I.brugPunt(I.S.ruit - 9, 1.6), kijk = I.brugPunt(I.S.johan, -1.4);
    return { cam, kijk, y: g.player.pos.y + 1.65 };
  });
  await bevries();
  await kamera(p.cam.x, p.y, p.cam.z, p.kijk.x, p.y - 0.4, p.kijk.z);
  await foto('inval_ruil');
  await ontdooi();
}

// ------------------------------------------------------ "Nu!"
await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__tot('nuFilm', 30);
  for (let i = 0; i < 200 && v.inval.film === 'nu' && v.inval.filmT < 1.9; i++) window.__stap(1);
});
await filmFoto('inval_dak');

// ------------------------------------------------------ de crash
await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__tot('achtervolging', 10);
  window.__stap(Math.ceil(9 / 0.05));
  const I = v.inval, car = I.auto, a = window.__auto;
  const vx = -Math.sin(car.yaw), vz = -Math.cos(car.yaw);
  a.x = car.x - vx * 2.8; a.z = car.z - vz * 2.8; a.yaw = car.yaw;
  if (a.mesh) a.mesh.position.set(a.x, car.mesh.position.y, a.z);
  a.driveable = true; g.player.inCar = a; a.speed = 20;
  window.__stap(1);
  for (let i = 0; i < 200 && v.inval.film === 'crash' && v.inval.filmT < 2.4; i++) window.__stap(1);
});
await filmFoto('inval_crash');

await browser.close();
