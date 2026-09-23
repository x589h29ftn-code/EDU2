/*
 Foto's van missie 9, de drie woningen van De Veteraan:

   huis_zeskanter.png  Zeskanter 16, de dure: vrijstaand, 8,9 × 20,6 m
   huis_spinnekop.png  Molenkrite 130c, een brede bungalow van achttien meter
   huis_grootwiel.png  Koningsspil 20, de goedkoopste, diep en rustig
   huis_tafel.png      aan tafel, met de koopregel in beeld
   huis_tuin.png       de tuin achter Zeskanter 16, vanaf het achterhek

 Gebruik: npm run server &   node tools/huisshots.mjs 8123 [map]
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
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });
console.log('spel geladen');

const foto = async (naam, wacht = 900, schoon = true) => {
  await page.evaluate((schoon) => {
    const g = window.__game;
    g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
    g.hud.flitsT = 0; if (g.hud.flitsEl) g.hud.flitsEl.style.opacity = 0;
    g.hud.melding('', '', 0);
    // de balken van het verhaal horen niet op een foto van een woonkamer
    if (schoon) for (const id of ['dialoog', 'opdracht', 'hint', 'praat', 'uitleg']) {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    }
  }, schoon);
  await page.waitForTimeout(wacht);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 300000 });
  console.log(`${map}/${naam}.png`);
};

/*
 De camera achter de eettafel, kijkend naar de bank en de tv aan de overkant.

 De eerste poging zette hem bij de voordeur met een hoek de kamer in; dat werd
 een close-up van de gangwand, want de gang loopt bij alle drie de woningen
 langs de zijmuur. Nu gaat hij van twee plekken uit die altijd in de woonkamer
 liggen — de tafel en de bank — en staat hij een meter achter de tafel op de
 lijn ertussen. Dan staat de tafel op de voorgrond en de bank erachter, hoe de
 kamer verder ook loopt.
*/
const kijkNaarBank = async (i, terug = 1.0, kijkY = 0.95) => {
  await page.evaluate(({ i, terug, kijkY }) => {
    const g = window.__game;
    const w = g.woningen.filter(x => x.stek)[i];
    const t = w.plekken.tafel, b = w.plekken.bank;
    const dx = b.x - t.x, dz = b.z - t.z;
    const L = Math.hypot(dx, dz) || 1;
    const px = t.x - dx / L * terug, pz = t.z - dz / L * terug;
    g.player.inCar = null; g.player.zit = false; g.player.fly = false;
    g.player.pos.set(px, 0, pz);
    g.player.eye = g.player.eyeStaand;
    const oog = g.player.eyeStaand || 1.7;
    g.player.yaw = Math.atan2(-(b.x - px), -(b.z - pz));
    g.player.pitch = Math.atan2(kijkY - oog, Math.hypot(b.x - px, b.z - pz));
    g.player.applyCamera();
  }, { i, terug, kijkY });
};

await page.evaluate(() => {
  const g = window.__game;
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true;
  window.__autoplay = true;
  g.sfeer.uur = 15; g.sfeer.weer = 'helder';
  g.player.wapenUit = true; if (g.player.gun) g.player.gun.visible = false;
  g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
  window.__stek = () => g.woningen.filter(w => w.stek);
  window.__maat = (i) => {
    const w = window.__stek()[i];
    return { naam: w.naam, breed: w.maten.breed, diep: w.maten.diep,
      deur: { x: w.plekken.deurBinnen.x - w.plekken.nul.x, z: w.plekken.deurBinnen.z - w.plekken.nul.z },
      tafel: { x: w.plekken.tafel.x - w.plekken.nul.x, z: w.plekken.tafel.z - w.plekken.nul.z } };
  };
});

const namen = ['huis_zeskanter', 'huis_spinnekop', 'huis_grootwiel'];
for (let i = 0; i < 3; i++) {
  const m = await page.evaluate((i) => window.__maat(i), i);
  console.log(`${m.naam}: ${m.breed.toFixed(1)} × ${m.diep.toFixed(1)} m`);
  await kijkNaarBank(i, 1.0, 0.95);
  await foto(namen[i]);
}

// en de tafel met de koopregel erbij
await page.evaluate(() => {
  const g = window.__game;
  g.verhaal.__startMissie('huis');
  for (let i = 0; i < 60; i++) g.verhaal.update(0.05);
  for (let i = 0; i < 30; i++) {
    if (document.getElementById('dialoog').hidden) break;
    g.praat(); for (let k = 0; k < 2; k++) g.verhaal.update(0.05);
  }
  const m = g.verhaal.mark.groep.position;
  g.player.pos.set(m.x + 1.5, 0, m.z + 1.5);
  for (let i = 0; i < 6; i++) g.verhaal.update(0.05);
  for (let i = 0; i < 30; i++) {
    if (document.getElementById('dialoog').hidden) break;
    g.praat(); for (let k = 0; k < 2; k++) g.verhaal.update(0.05);
  }
});
{
  // eerst de camera, dan de speler naar de stoel: de koopregel hangt aan waar
  // de spéler staat, en die staat op de foto toch niet in beeld
  await kijkNaarBank(0, 1.15, 0.85);
  const m = await page.evaluate(() => {
    const g = window.__game;
    const w = window.__stek()[0];
    const cam = { x: g.player.pos.x, z: g.player.pos.z, yaw: g.player.yaw, pitch: g.player.pitch };
    g.player.pos.set(w.plekken.stoel.x, 0, w.plekken.stoel.z);
    // Mark zegt bij aankomst eerst wat hij van het huis vindt; dat eerst laten aflopen
    for (let i = 0; i < 6; i++) g.verhaal.update(0.05);
    for (let i = 0; i < 200 && !document.getElementById('dialoog').hidden; i++) g.verhaal.update(0.1);
    for (let i = 0; i < 6; i++) g.verhaal.update(0.05);
    const el = document.getElementById('praat');
    const hint = el.hidden ? '' : el.textContent;
    // en de camera terug op de plek van hierboven
    g.player.pos.set(cam.x, 0, cam.z);
    g.player.yaw = cam.yaw; g.player.pitch = cam.pitch;
    g.player.applyCamera();
    return { naam: w.naam, hint, fase: g.verhaal.fase };
  });
  console.log(`aan tafel (${m.fase}): "${m.hint}"`);
  await page.evaluate((tekst) => {
    // de koopregel blijft staan, de rest van de HUD gaat weg
    for (const id of ['dialoog', 'opdracht', 'hint', 'uitleg']) {
      const el = document.getElementById(id); if (el) el.hidden = true;
    }
    const el = document.getElementById('praat');
    if (tekst) { el.textContent = tekst; el.hidden = false; }
  }, m.hint);
  await foto('huis_tafel', 900, false);
}

/*
 En de tuin. Achterin bij de schutting staan, met de rug naar het hek, kijkend
 naar het terras en de achtergevel: dan staan het gras, het tegelpad, de tafel
 met de parasol en het schuurtje op één foto. De eerste poging stond mét de rug
 naar het huis en keek de lege tuin in — dan zie je alleen schutting.
*/
{
  const m = await page.evaluate(() => {
    const g = window.__game;
    const w = window.__stek().find(x => x.plekken.tuindeur) || window.__stek()[0];
    const d = w.plekken.tuindeur, h = w.plekken.hek;
    const tr = w.plekken.tuintafel || w.plekken.terras;   // op de tuintafel richten
    if (!d || !h || !tr) return null;
    // anderhalve meter vóór het achterhek, op de lijn hek → terras
    const dx = tr.x - h.x, dz = tr.z - h.z;
    const L = Math.hypot(dx, dz) || 1;
    const px = h.x + dx / L * 1.5, pz = h.z + dz / L * 1.5;
    g.player.inCar = null; g.player.zit = false; g.player.fly = false;
    g.player.pos.set(px, 0, pz);
    g.player.eye = g.player.eyeStaand;
    const oog = g.player.eyeStaand || 1.7;
    g.player.yaw = Math.atan2(-(tr.x - px), -(tr.z - pz));
    g.player.pitch = Math.atan2(1.3 - oog, Math.hypot(tr.x - px, tr.z - pz));
    g.player.applyCamera();
    for (let i = 0; i < 20; i++) g.verhaal.update(0.05);
    return { naam: w.naam, diep: +Math.hypot(tr.x - px, tr.z - pz).toFixed(1) };
  });
  if (m) {
    console.log(`tuin bij ${m.naam}: ${m.diep} m tot het terras`);
    await foto('huis_tuin');
  } else {
    console.log('geen tuin gevonden');
  }
}

await browser.close();
