/*
 Foto's van missie 15, Bouwman schaduwen:

   schaduw_volgen.png   die avond in Duinterpen: achter de politieauto van Bouwman aan,
                        met de afstandsbalk linksboven
   schaduw_loods.png    de loods aan het water vanaf de weg: de roldeur half open,
                        de bestelbus, de container, Bouwman en zijn twee mannen
   schaduw_bord.png     door het raam in de oostgevel: het bord met de namen
   schaduw_boot.png     de kade achter de loods, de steiger en de STAVOREN 7
   schaduw_dag.png      de loods overdag, van boven: erf, kade en het brede water

 Gebruik: npm run server &   node tools/schaduwshots.mjs 8123 [map]
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const poort = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
mkdirSync(map, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

const foto = async (naam, { balk = false, wacht = 1500 } = {}) => {
  await page.evaluate((balk) => {
    const g = window.__game;
    g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
    g.hud.melding('', '', 0);
    if (g.uitleg) g.uitleg.update(999);
    document.getElementById('dialoog').hidden = true;
    document.getElementById('praat').hidden = true;
    if (!balk) document.getElementById('schaduwbalk').hidden = true;
    const h = document.getElementById('hint'); if (h) { h.textContent = ''; h.style.visibility = 'hidden'; }
    const u = document.getElementById('uitleg'); if (u) u.style.visibility = 'hidden';
    if (g.renderer && g.renderer.shadowMap) g.renderer.shadowMap.needsUpdate = true;
  }, balk);
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
  window.__autoplay = true; window.__game.player.active = true;
});
// de camera op (x, y, z), kijkend naar (kx, ky, kz); zie tools/raceshots.mjs
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
  const { geluid } = await import('/js/audio.js');
  const g = window.__game;
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true;
  window.__autoplay = true;
  g.sfeer.weer = 'helder'; g.sfeer.uur = 15;
  g.reliëfAf();
  geluid.start();
  window.__stap = (n = 20, dt = 0.05) => {
    const v = g.verhaal, f = v.__echteUpdate || v.update;
    for (let i = 0; i < n; i++) f.call(v, dt);
  };
  window.__klik = (max = 40) => {
    for (let i = 0; i < max && !document.getElementById('dialoog').hidden; i++) { g.praat(); window.__stap(2); }
  };
  // die avond, bij het Autohuis
  g.verhaal.startMissie('schaduw');
  window.__stap(3);
  const v = g.verhaal, s = v.bewaar(); s.missie = 'schaduw'; s.fase = 'volgen';
  v.herstel(s);
  window.__stap(3);
  window.__klik();
  window.__stap(130);
});

// ------------------------------------------------------ achter hem aan
{
  const p = await page.evaluate(() => {
    const g = window.__game, v = g.verhaal, S = v.schaduw.wereld, rit = v.schaduw.rit;
    // in Duinterpen, vlak voor zijn stop bij Parelmoervlinder 3
    const s = Math.max(60, S.stopS - 140);
    rit.s = s; rit.v = 11;
    S.rijd(rit, v.schaduw.auto, 0.05);
    const golf = v.schaduw.golf, q = S.punt(s - 42, S.opzij(s - 42));
    golf.x = q.x; golf.z = q.z; golf.yaw = q.yaw; golf.speed = 10;
    golf.mesh.position.set(q.x, golf.mesh.position.y, q.z); golf.mesh.rotation.y = q.yaw;
    g.player.inCar = golf; g.player.pos.set(q.x, 0, q.z);
    window.__stap(1);
    const achter = S.punt(s - 50, S.opzij(s - 50) * 0.5), voor = S.punt(s + 4, S.opzij(s));
    return { achter, voor };
  });
  await bevries();
  await kamera(p.achter.x, 2.6, p.achter.z, p.voor.x, 1.1, p.voor.z);
  // (de balk rekent met waar de camera staat: vlak achter de Golf, dus dat klopt)
  await page.evaluate(() => {
    const el = document.getElementById('schaduwbalk'), d = window.__game.verhaal.schaduw.afstand;
    el.hidden = false;
    el.querySelector('.tekst').textContent = `Bouwman · ${Math.round(d || 46)} m · goed zo`;
  });
  await foto('schaduw_volgen', { balk: true });
  await ontdooi();
}

// ------------------------------------------------------ de loods
await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  const s = v.bewaar(); s.missie = 'schaduw'; s.fase = 'loods'; s.schaduwFotos = [false, false, false]; s.schaduwGezien = false;
  v.herstel(s);
  window.__stap(3);
  document.getElementById('dialoog').hidden = true;
  window.__stap(40);                         // de mannen lopen hun post
});
await bevries();
await kamera(1421.5, 2.1, -215.5, 1404.5, 2.0, -193);
await foto('schaduw_loods');
// (de gele ruiten staan vlak voor de lens: die weg voor het bord en de boot)
await page.evaluate(() => { for (const m of window.__game.verhaal.schaduw.merken) m.toon(false); });
await kamera(1420.9, 1.72, -185.5, 1414.6, 1.72, -185.5);
await foto('schaduw_bord');
await kamera(1403.6, 1.5, -168.6, 1410.2, 0.2, -162.8);
await foto('schaduw_boot');
await page.evaluate(() => { const g = window.__game; g.sfeer.uur = 14; if (g.sfeer.update) g.sfeer.update(0.1, 1420, -200); });
await kamera(1436, 15, -226, 1405, 0, -189);
await foto('schaduw_dag', { wacht: 2500 });
await ontdooi();

await browser.close();
