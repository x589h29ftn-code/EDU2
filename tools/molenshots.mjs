/*
 Foto's van de twee nieuwe gebouwen in IJlst:

   molen_pad.png      Houtzaagmolen De Rat vanaf het Sneekerpad, zoals je hem
                      ziet als je vanuit Sneek de stad in rijdt
   molen_dichtbij.png van onder de stelling af omhoog, met het gevlucht
   molen_draait.png   hetzelfde beeld een paar tellen later: de wieken staan
                      dan ergens anders
   molen_boven.png    van bovenaf, met de zaagloodsen eromheen
   poiesz.png         supermarkt Poiesz aan De Dassenboarch 32
   poiesz_pui.png     de pui van dichtbij, met het woordmerk

 Gebruik: python3 -m http.server 8123 &  node tools/molenshots.mjs 8123 [map]
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const port = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
mkdirSync(map, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });

const opzet = await page.evaluate(async () => {
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  g.sfeer.uur = 13;
  g.player.wapenUit = true;
  g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
  const { KAART } = await import('/js/kaartwereld.js');
  window.__K = KAART;
  window.__zet = (x, z, yaw, pitch = 0, hoog = 0) => {
    g.player.inCar = null; g.player.zit = false;
    g.player.pos.set(x, hoog, z); g.player.yaw = yaw; g.player.pitch = pitch;
    g.player.applyCamera();
  };
  window.__kijk = (px, pz, tx, tz) => Math.atan2(-(tx - px), -(tz - pz));
  const M = KAART.molens && KAART.molens[0];
  const p = KAART.panden.find(q => q.type === 'poiesz');
  return { molen: M ? { naam: M.naam, cx: M.cx, cz: M.cz, top: M.top } : null,
    poiesz: p ? { cx: p.rect.cx, cz: p.rect.cz, front: p.front } : null };
});
console.log(opzet.molen ? `molen: ${opzet.molen.naam} op ${opzet.molen.cx}, ${opzet.molen.cz}` : 'geen molen in de kaart');
await page.waitForTimeout(1500);

const foto = async (naam) => {
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 300000 });
  console.log(`${map}/${naam}.png`);
};

if (opzet.molen) {
  // 1. vanaf het Sneekerpad: het dichtstbijzijnde punt van de rijbaan, met de
  //    camera naar de molen toe
  await page.evaluate(() => {
    const M = window.__K.molens[0];
    let best = null, bd = 1e9;
    for (const as of window.__K.wegassen) {
      if (!as.drive) continue;
      for (const q of as.pts) { const d = Math.hypot(q[0] - M.cx, q[1] - M.cz); if (d < bd) { bd = d; best = q; } }
    }
    window.__zet(best[0], best[1], window.__kijk(best[0], best[1], M.cx, M.cz), 0.22);
  });
  await foto('molen_pad');

  // 2. van onder de stelling omhoog kijken
  await page.evaluate(() => {
    const M = window.__K.molens[0];
    const k = M.kruihoek * Math.PI / 180;
    // ruim buiten de zaagloodsen gaan staan: die zijn achtentwintig meter lang,
    // en van dichterbij kijk je alleen tegen hun wand aan
    const x = M.cx + Math.cos(k) * 26, z = M.cz + Math.sin(k) * 26;
    window.__zet(x, z, window.__kijk(x, z, M.cx, M.cz), 0.34);
  });
  await foto('molen_dichtbij');

  // 3. hetzelfde beeld, maar het gevlucht een paar tellen verder. Doorspoelen
  //    doen we met de hand: in een headless browser loopt de klok traag, en dan
  //    zou het verschil te klein zijn om te zien.
  const gedraaid = await page.evaluate(async () => {
    const { molenIntern, draaiMolens } = await import('/js/molen.js');
    const voor = molenIntern()[0].groep.rotation.z;
    for (let i = 0; i < 150; i++) draaiMolens(1 / 30);      // vijf seconden
    return { voor, na: molenIntern()[0].groep.rotation.z };
  });
  console.log(`gevlucht gedraaid: ${(gedraaid.na - gedraaid.voor).toFixed(2)} rad in vijf seconden`);
  await foto('molen_draait');

  // 4. van bovenaf, zodat de zaagloodsen eromheen te zien zijn
  await page.evaluate(() => {
    const M = window.__K.molens[0];
    const k = (M.kruihoek + 40) * Math.PI / 180;
    const x = M.cx + Math.cos(k) * 34, z = M.cz + Math.sin(k) * 34;
    window.__zet(x, z, window.__kijk(x, z, M.cx, M.cz), -0.30, 26);
  });
  await foto('molen_boven');
}

if (opzet.poiesz) {
  // de winkel vanaf het parkeerterrein, recht op de voorgevel
  await page.evaluate(() => {
    const p = window.__K.panden.find(q => q.type === 'poiesz');
    const f = p.front, r = p.rect;
    const diep = Math.abs(f[0] * Math.cos(r.hoek) + f[1] * Math.sin(r.hoek)) > 0.7 ? r.hx : r.hz;
    const gx = r.cx + f[0] * diep, gz = r.cz + f[1] * diep;
    window.__zet(gx + f[0] * 30, gz + f[1] * 30, window.__kijk(gx + f[0] * 30, gz + f[1] * 30, gx, gz), 0.05);
  });
  await foto('poiesz');
  await page.evaluate(() => {
    const p = window.__K.panden.find(q => q.type === 'poiesz');
    const f = p.front, r = p.rect;
    const diep = Math.abs(f[0] * Math.cos(r.hoek) + f[1] * Math.sin(r.hoek)) > 0.7 ? r.hx : r.hz;
    const gx = r.cx + f[0] * diep, gz = r.cz + f[1] * diep;
    window.__zet(gx + f[0] * 11, gz + f[1] * 11, window.__kijk(gx + f[0] * 11, gz + f[1] * 11, gx, gz), 0.10);
  });
  await foto('poiesz_pui');
}

await browser.close();
