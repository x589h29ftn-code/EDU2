/*
 Foto's van missie 12, de Dúvelsrak:

   brug_avond.png        die avond voor Molenkrite 15: Mark in politiepak bij de
                         politieauto
   brug_c4.png           achter op de brug: twee ladingen liggen er, twee gele
                         markeringen wachten nog
   brug_versperring.png  de versperring aan de Tinga-kant: de auto dwars, drie
                         dranghekken, Mark, en Johan die de helling op komt
   brug_film.png         het filmbeeld: de auto's van De Veteraan rijden met hun
                         lampen aan de brug op
   brug_veteraan.png     De Veteraan bij de hekken: "Jou ken ik!"
   brug_boem.png         de C4 gaat af, achter op de brug
   brug_gat.png          wat er van de achterkant over is

 Gebruik: npm run server &   node tools/brugshots.mjs 8123 [map]
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

const foto = async (naam, { gesprek = false, wacht = 1200 } = {}) => {
  await page.evaluate((gesprek) => {
    const g = window.__game;
    g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
    g.hud.melding('', '', 0);
    g.hud.flitsT = 0; if (g.hud.flitsEl) g.hud.flitsEl.style.opacity = 0;
    if (g.uitleg) g.uitleg.update(999);
    if (!gesprek) document.getElementById('dialoog').hidden = true;
    document.getElementById('praat').hidden = true;
    const h = document.getElementById('hint'); if (h) h.textContent = '';
  }, gesprek);
  await page.waitForTimeout(wacht);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 600000 });
  console.log(`${map}/${naam}.png`);
};
// het verhaal stilzetten tijdens het afdrukken (zie tools/bomshots.mjs)
const bevries = () => page.evaluate(() => {
  const v = window.__game.verhaal;
  if (!v.__echteUpdate) { v.__echteUpdate = v.update; v.update = () => {}; }
});
const ontdooi = () => page.evaluate(() => {
  const v = window.__game.verhaal;
  if (v.__echteUpdate) { v.update = v.__echteUpdate; v.__echteUpdate = null; }
  window.__autoplay = true; window.__game.player.active = true;
});
/*
 De camera op een vast punt (x, y, z), kijkend naar (kx, ky, kz). De speler staat
 stil (niet actief, geen autoplay): dan zet de hoofdlus de camera elk beeld uit
 zijn positie, zijn ogen en zijn kijkrichting, en daar zetten we hem op.
*/
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
}, { x, y, z, kx, ky, kz });

await page.evaluate(async () => {
  const { geluid } = await import('/js/audio.js');
  const g = window.__game;
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true;
  window.__autoplay = true;
  g.sfeer.weer = 'helder';
  g.reliëfAf();
  geluid.start();
  window.__stap = (n = 20, dt = 0.05) => {
    const v = g.verhaal, f = v.__echteUpdate || v.update;
    for (let i = 0; i < n; i++) f.call(v, dt);
  };
  window.__klik = (max = 40) => {
    for (let i = 0; i < max && !document.getElementById('dialoog').hidden; i++) { g.praat(); window.__stap(2); }
  };
  window.__zwartUit = () => {
    const el = document.getElementById('overgang');
    let max = 0;
    for (let i = 0; i < 200; i++) {
      window.__stap(1);
      const d = parseFloat(el.style.opacity || '0');
      max = Math.max(max, d);
      if (max > 0.99 && d < 0.001) break;
    }
  };
  g.verhaal.startMissie('brug');
  window.__stap(3);
  const w = g.woningen[0];
  g.player.pos.set(w.plekken.deurBinnen.x, 0, w.plekken.deurBinnen.z);
  window.__stap(3);
  window.__klik();
  window.__zwartUit();
  window.__stap(2);
});

// ------------------------------------------- die avond, voor Molenkrite 15
{
  const p = await page.evaluate(() => {
    const g = window.__game, v = g.verhaal, m = v.brug.mark.groep.position, a = v.politieauto, e = g.player.pos;
    return { m: { x: m.x, z: m.z }, a: { x: a.x, z: a.z }, e: { x: e.x, z: e.z } };
  });
  // vanaf de stoep waar Erik staat, anderhalve meter terug, naar Mark bij de auto
  const dx = p.a.x - p.e.x, dz = p.a.z - p.e.z, l = Math.hypot(dx, dz) || 1;
  const kx = (p.m.x + p.a.x) / 2, kz = (p.m.z + p.a.z) / 2;
  await bevries();
  await kamera(p.e.x - dx / l * 1.5, 1.75, p.e.z - dz / l * 1.5, kx, 1.0, kz);
  await foto('brug_avond', { gesprek: true });
  await ontdooi();
}

// ------------------------------------------------- de C4 achter op de brug
await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__klik();
  const s = v.bewaar(); s.fase = 'c4leggen';
  v.herstel(s);
  window.__stap(2);
  // twee ladingen neer, twee te gaan
  const b = v.brug, y = b.assen.hoogte;
  for (const i of [0, 2]) {
    const p = b.c4Plekken[i];
    g.player.inCar = null; g.player.pos.set(p.x - 0.4, y, p.z);
    window.__stap(2); g.praat(); window.__stap(2);
  }
  window.__stap(10);
});
{
  const b = await page.evaluate(() => {
    const b = window.__game.verhaal.brug;
    // midden op de weg: links en rechts een lading, verderop de twee markeringen
    return { p: b.punt(38.5, 0), k: b.punt(46, 0), y: b.assen.hoogte };
  });
  await bevries();
  await kamera(b.p.x, b.y + 1.8, b.p.z, b.k.x, b.y + 0.2, b.k.z);
  await foto('brug_c4');
  await ontdooi();
}

// ------------------------------------------------------- de versperring
await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, b = v.brug, y = b.assen.hoogte;
  for (const i of [1, 3]) {
    const p = b.c4Plekken[i];
    g.player.inCar = null; g.player.pos.set(p.x - 0.4, y, p.z);
    window.__stap(2); g.praat(); window.__stap(2);
  }
  window.__klik();                      // Mark kijkt naar je wapens
  window.__stap(160);                   // Johan loopt de helling op
});
{
  const b = await page.evaluate(() => {
    const b = window.__game.verhaal.brug;
    return { p: b.punt(15, 3.0), k: b.punt(0, -0.5), y: b.assen.hoogte };
  });
  await bevries();
  await kamera(b.p.x, b.y + 1.75, b.p.z, b.k.x, b.y + 0.9, b.k.z);
  await foto('brug_versperring');
  await ontdooi();
}

// ---------------------------------------------------------- het filmbeeld
await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, b = v.brug;
  for (let i = 0; i < 400 && document.getElementById('dialoog').hidden; i++) window.__stap(1);
  window.__klik();                      // Johan helpt mee
  window.__zwartUit();                  // "Even later…"
  // (verhaal.brug is een momentopname: elke stap opnieuw halen)
  for (let i = 0; i < 400 && v.brug.film && v.brug.filmT < 8.6; i++) window.__stap(1);
});
{
  // het tweede standpunt van het filmbeeld: naast de weg, de auto's komen eraan
  const b = await page.evaluate(() => {
    const b = window.__game.verhaal.brug, a = b.konvooi[0];
    return { p: b.punt(20, 3.6), k: { x: a.x, z: a.z }, y: b.assen.hoogte };
  });
  await bevries();
  await kamera(b.p.x, b.y + 1.5, b.p.z, b.k.x, b.y + 0.9, b.k.z);
  await foto('brug_film');
  await ontdooi();
}

// -------------------------------------------------- De Veteraan bij de hekken
await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, b = v.brug;
  for (let i = 0; i < 500 && v.brug.film; i++) window.__stap(1);
  for (let i = 0; i < 200 && document.getElementById('dialoog').hidden; i++) window.__stap(1);
  // door tot "Wacht eens… Jou ken ik!"
  for (let i = 0; i < 8 && !/ken ik/.test(document.getElementById('dialoogTekst').textContent); i++) { g.praat(); window.__stap(2); }
});
{
  const b = await page.evaluate(() => {
    const b = window.__game.verhaal.brug, v = b.veteraan.veteraan.groep.position;
    // vlak achter de hekken, schuin op De Veteraan en zijn auto
    return { p: b.punt(4.2, -2.6), k: { x: v.x, z: v.z }, y: b.assen.hoogte };
  });
  await bevries();
  await kamera(b.p.x, b.y + 1.7, b.p.z, b.k.x, b.y + 1.4, b.k.z);
  await foto('brug_veteraan', { gesprek: true });
  await ontdooi();
}

// ---------------------------------------------------------------- boem
await page.evaluate(() => {
  const g = window.__game;
  window.__klik();
  g.praat();                            // E: de C4
  window.__stap(8);
});
{
  const b = await page.evaluate(() => {
    const b = window.__game.verhaal.brug;
    return { p: b.punt(-2, -3.8), k: b.punt(45, 0), y: b.assen.hoogte };
  });
  await bevries();
  await kamera(b.p.x, b.y + 2.4, b.p.z, b.k.x, b.y + 3.0, b.k.z);
  await foto('brug_boem');
  await ontdooi();
}

// ------------------------------------------------------------ het gat
await page.evaluate(() => {
  // de mannen neer (anders schieten ze op de foto), en even laten branden
  const v = window.__game.verhaal, s = v.schutters;
  if (s) for (const w of s.wachters) v.raak(w.persoon.groep);
  window.__stap(90);
});
{
  const b = await page.evaluate(() => {
    const b = window.__game.verhaal.brug;
    return { p: b.punt(35, 2.6), k: b.punt(45.5, -0.3), y: b.assen.hoogte };
  });
  await bevries();
  await kamera(b.p.x, b.y + 3.6, b.p.z, b.k.x, b.y, b.k.z);
  await foto('brug_gat');
  await ontdooi();
}

await browser.close();
