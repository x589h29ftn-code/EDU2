/*
 Foto's van missie 10, De Veteraan:

   veteraan_molentje.png    De Veteraan met zijn hondje op het Sneekerpad, met
                            De Terpensmole achter hem
   veteraan_tas.png         de tas voor de tribune van VV Sneek, met het gele ruitje
   veteraan_hinderlaag.png  de vier auto's op de weg voor het sportpark en de
                            tien man die uitstappen

 Gebruik: npm run server &   node tools/veteraanshots.mjs 8123 [map]
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
    g.hud.flitsT = 0; if (g.hud.flitsEl) g.hud.flitsEl.style.opacity = 0;
    // en het uitlegblokje over het pistool, dat de missie bij het begin toont
    if (g.uitleg) g.uitleg.update(999);
  });
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
});

const kijk = async (px, pz, kx, kz, kijkY = 1.6) => {
  await page.evaluate(({ px, pz, kx, kz, kijkY }) => {
    const g = window.__game;
    g.player.inCar = null; g.player.zit = false; g.player.fly = false;
    // het pistool weg: de missie geeft het je terug bij het begin
    g.player.wapenUit = true; if (g.player.gun) g.player.gun.visible = false;
    g.player.pos.set(px, 0, pz);
    const oog = g.player.eyeStaand || 1.7;
    g.player.yaw = Math.atan2(-(kx - px), -(kz - pz));
    g.player.pitch = Math.atan2(kijkY - oog, Math.hypot(kx - px, kz - pz));
    g.player.applyCamera();
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
  g.player.wapenUit = true; if (g.player.gun) g.player.gun.visible = false;
  geluid.start();
  window.__stap = (n = 20, dt = 0.05) => {
    const v = g.verhaal, f = v.__echteUpdate || v.update;
    for (let i = 0; i < n; i++) f.call(v, dt);
  };
  window.__klik = (max = 40) => {
    for (let i = 0; i < max && !document.getElementById('dialoog').hidden; i++) { g.praat(); window.__stap(2); }
  };
  // missie 10 los, en het telefoontje wegklikken
  g.verhaal.startMissie('veteraan');
  for (let i = 0; i < 40 && document.getElementById('dialoog').hidden; i++) window.__stap(4);
  window.__klik();
  window.__stap(4);
});

// ----------------------------------------- De Veteraan bij het molentje
const vet = await page.evaluate(() => {
  const g = window.__game;
  const v = g.verhaal.veteraan.veteraan.groep.position;
  const p = g.verhaal.veteraanPlek;
  return { x: v.x, z: v.z, langs: p.langs, molen: p.molen };
});
{
  /*
   Op het pad, met de molen achter hem. Verder dan PRAAT_AFSTAND (5,5 m): anders
   begint hij te praten terwijl de foto gemaakt wordt, en dan staat het gesprek
   open voor de rest van de foto's.
  */
  const ax = vet.x - vet.molen.x, az = vet.z - vet.molen.z, l = Math.hypot(ax, az) || 1;
  const cx = vet.x + (ax / l) * 6.2 + vet.langs.x * 2.2, cz = vet.z + (az / l) * 6.2 + vet.langs.z * 2.2;
  await kijk(cx, cz, (vet.x + vet.molen.x) / 2, (vet.z + vet.molen.z) / 2, 1.8);
  await page.evaluate(() => { window.__stap(2); });
  await bevries();
  await foto('veteraan_molentje');
  await ontdooi();
}

// ------------------------------------------------ de tas voor de tribune
const tas = await page.evaluate(() => {
  const g = window.__game;
  const p = g.verhaal.veteraanPlek;
  g.player.inCar = null;
  g.player.pos.set(p.x + p.langs.x * 3, 0, p.z + p.langs.z * 3);
  window.__stap(6);
  window.__klik();                         // het gesprek
  window.__stap(6);
  const t = g.verhaal.tribune;
  return { tas: t.tas, veld: t.veld, weg: t.weg, fase: g.verhaal.fase };
});
console.log(`fase ${tas.fase}`);
{
  // vanaf het veld, een meter of zeven voor de tas
  const dx = tas.veld.x - tas.tas.x, dz = tas.veld.z - tas.tas.z, l = Math.hypot(dx, dz) || 1;
  await kijk(tas.tas.x + (dx / l) * 6.5 + (dz / l) * 2, tas.tas.z + (dz / l) * 6.5 - (dx / l) * 2,
    tas.tas.x, tas.tas.z, 0.7);
  await page.evaluate(() => { window.__stap(2); });
  await foto('veteraan_tas');
}

// --------------------------------------------- de vier auto's en tien man
const bende = await page.evaluate(async () => {
  const { zichtVrij } = await import('/js/world.js');
  const g = window.__game;
  const t = g.verhaal.tribune;
  g.player.inCar = null;
  g.player.pos.set(t.tas.x + 0.8, 0, t.tas.z);
  window.__stap(4);
  g.praat();                               // de tas pakken
  for (let i = 0; i < 400 && g.verhaal.fase === 'hinderlaag'; i++) window.__stap(1, 0.05);
  window.__stap(30, 0.05);                 // ze zijn net uitgestapt en lopen weg van de auto's
  const autos = g.verhaal.schutterAutos.map(a => ({ x: a.x, z: a.z }));
  const mannen = g.verhaal.schutters ? g.verhaal.schutters.wachters.map(w => w.persoon.groep.position) : [];
  const alles = [...autos, ...mannen.map(p => ({ x: p.x, z: p.z }))];
  const mx = alles.reduce((s, a) => s + a.x, 0) / alles.length;
  const mz = alles.reduce((s, a) => s + a.z, 0) / alles.length;
  /*
   Een plek met vrij zicht op de auto's én de mannen: rond het midden van de
   groep, op achttien tot dertig meter. Recht tussen de weg en de tribune staat
   een schuurtje van de club, en daar keek de eerste foto tegenaan.
  */
  let beste = null;
  for (let r = 18; r <= 30; r += 4) for (let i = 0; i < 24; i++) {
    const h = (i / 24) * Math.PI * 2;
    const x = mx + Math.cos(h) * r, z = mz + Math.sin(h) * r;
    const zien = alles.filter(p => zichtVrij(x, z, p.x, p.z, 1.4)).length;
    if (!beste || zien > beste.zien) beste = { x, z, zien };
  }
  return { mx, mz, beste, fase: g.verhaal.fase, mannen: mannen.length };
});
console.log(`${bende.mannen} man · fase ${bende.fase} · camera ziet ${bende.beste.zien} van ${bende.mannen + 4}`);
{
  await kijk(bende.beste.x, bende.beste.z, bende.mx, bende.mz, 1.2);
  await page.evaluate(() => { const g = window.__game; g.player.health = 100; g.hud.zetLeven(100); });
  await bevries();
  await foto('veteraan_hinderlaag', 300);
  await ontdooi();
}

await browser.close();
