/*
 Foto's van missie 11, de politieauto en de C4:

   politieauto_mark.png    Mark op de bank in Molenkrite 15, waar hij over De
                           Veteraan begint
   politieauto_lemmerweg.png  de politieauto aan de Lemmerweg, met de lichtbalk
   politieauto_balie.png   de balie van Tinga State, waar de C4 klaarligt

 Gebruik: npm run server &   node tools/politieautoshots.mjs 8123 [map]
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
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 600000 });
await page.waitForFunction(() => window.__game, null, { timeout: 600000 });

const foto = async (naam, wacht = 900) => {
  await page.evaluate(() => {
    const g = window.__game;
    g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
    g.hud.melding('', '', 0);
    if (g.uitleg) g.uitleg.update(999);
  });
  await page.waitForTimeout(wacht);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 600000 });
  console.log(`${map}/${naam}.png`);
};
// het verhaal stilzetten tijdens het afdrukken (zie tools/veteraanshots.mjs)
const bevries = () => page.evaluate(() => {
  const v = window.__game.verhaal;
  if (!v.__echteUpdate) { v.__echteUpdate = v.update; v.update = () => {}; }
});
const ontdooi = () => page.evaluate(() => {
  const v = window.__game.verhaal;
  if (v.__echteUpdate) { v.update = v.__echteUpdate; v.__echteUpdate = null; }
});
const kijk = async (px, pz, kx, kz, kijkY = 1.4) => {
  await page.evaluate(async ({ px, pz, kx, kz, kijkY }) => {
    const W = await import('/js/world.js');
    const g = window.__game;
    g.player.inCar = null; g.player.zit = false; g.player.fly = false;
    g.player.wapenUit = true; if (g.player.gun) g.player.gun.visible = false;
    g.player.pos.set(px, 0, pz);
    const oog = g.player.eyeStaand || 1.7;
    g.player.yaw = Math.atan2(-(kx - px), -(kz - pz));
    g.player.pitch = Math.atan2(kijkY - oog, Math.hypot(kx - px, kz - pz));
    g.player.applyCamera();
    W.updateLOD(px, pz); g.vehicles.lod(px, pz);
  }, { px, pz, kx, kz, kijkY });
};

await page.evaluate(async () => {
  const { geluid } = await import('/js/audio.js');
  const g = window.__game;
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true;
  window.__autoplay = true;
  g.sfeer.uur = 15; g.sfeer.weer = 'helder';
  g.reliëfAf();
  geluid.start();
  window.__stap = (n = 20, dt = 0.05) => {
    const v = g.verhaal, f = v.__echteUpdate || v.update;
    for (let i = 0; i < n; i++) f.call(v, dt);
  };
  g.verhaal.startMissie('politieauto');
  window.__stap(4);
});

// ------------------------------------------ Mark op de bank in Molenkrite 15
{
  const plek = await page.evaluate(() => {
    const g = window.__game, w = g.woningen[0];
    g.player.inCar = null;
    g.player.pos.set(w.plekken.deurBinnen.x, 0, w.plekken.deurBinnen.z);
    window.__stap(40);                        // het gesprek begint, en Mark zakt op de bank
    const b = w.plekken.bank, k = w.plekken.bankKijk;
    return { bank: b, k, fase: g.verhaal.fase };
  });
  console.log(`fase ${plek.fase}`);
  // vóór de bank, tussen de bank en de tv, iets opzij: dan zie je hoe hij zit
  const fx = -Math.sin(plek.k), fz = -Math.cos(plek.k), zx = Math.cos(plek.k), zz = -Math.sin(plek.k);
  await kijk(plek.bank.x + fx * 2.0 + zx * 0.9, plek.bank.z + fz * 2.0 + zz * 0.9, plek.bank.x, plek.bank.z, 0.8);
  await bevries();
  await foto('politieauto_mark');
  await ontdooi();
}

// --------------------------------------------- de politieauto aan de Lemmerweg
{
  const a = await page.evaluate(() => {
    const g = window.__game;
    // het gesprek doorklikken: dan staat de auto er
    for (let i = 0; i < 40 && !document.getElementById('dialoog').hidden; i++) { g.praat(); window.__stap(2); }
    window.__stap(4);
    const a = g.verhaal.politieauto;
    return { x: a.x, z: a.z, yaw: a.yaw, fase: g.verhaal.fase };
  });
  console.log(`fase ${a.fase}`);
  // schuin voor de auto, zeven meter weg
  const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw);
  const zx = Math.cos(a.yaw), zz = -Math.sin(a.yaw);
  await kijk(a.x + fx * 6 + zx * 3.5, a.z + fz * 6 + zz * 3.5, a.x, a.z, 0.9);
  await page.evaluate(() => { window.__stap(2); });
  await bevries();
  await foto('politieauto_lemmerweg');
  await ontdooi();
}

// ------------------------------------------------- de balie van Tinga State
{
  const b = await page.evaluate(() => {
    const g = window.__game, bo = g.boerderij;
    bo.toonC4(true);                          // de C4 ligt klaar op de toonbank
    const vk = bo.verkoper.groep.position;
    let plek = null;
    for (let r = 1.0; r <= 3.5 && !plek; r += 0.25) for (let k = 0; k < 16 && !plek; k++) {
      const x = vk.x + Math.cos(k / 16 * 6.283) * r, z = vk.z + Math.sin(k / 16 * 6.283) * r;
      if (bo.bijToonbank(x, z)) plek = { x, z };
    }
    return { vk: { x: vk.x, z: vk.z }, plek };
  });
  if (b.plek) {
    // een stap achter de plek aan de toonbank, naar de verkoper kijkend
    const dx = b.plek.x - b.vk.x, dz = b.plek.z - b.vk.z, l = Math.hypot(dx, dz) || 1;
    await kijk(b.plek.x + dx / l * 1.2, b.plek.z + dz / l * 1.2, b.vk.x, b.vk.z, 1.3);
    await bevries();
    await foto('politieauto_balie');
    await ontdooi();
  } else console.log('geen plek aan de toonbank gevonden');
}

await browser.close();
