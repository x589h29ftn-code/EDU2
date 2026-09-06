/*
 Foto's van het sportpark aan de Molenkrite en van de volkstuinen achter de
 Wieken:

   veld_boven.png     het hoofdveld van bovenaf, met de reclamering
   veld_midden.png    vanaf de middenstip
   veld_doel.png      achter het doel, door de ballenvanger heen
   veld_reclame.png   de reclameborden langs de lijn, met Radio Spannenburg
   veld_tribune.png   de overdekte tribune langs de zijlijn
   tuinen_boven.png   het volkstuincomplex van bovenaf
   tuinen_pad.png     over het schelpenpad tussen de tuintjes
   tuinen_schuur.png  een tuintje van dichtbij, met schuurtje en kas

 Gebruik: python3 -m http.server 8123 &  node tools/sportshots.mjs 8123 [map]
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

await page.evaluate(async () => {
  localStorage.removeItem('tinga.spel.v1');
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  g.sfeer.uur = 13;
  g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
  const { KAART } = await import('/js/kaartwereld.js');
  window.__K = KAART;
  window.__zet = (x, z, yaw, pitch = 0, hoog = 0) => {
    g.player.inCar = null; g.player.zit = false;
    g.player.pos.set(x, hoog, z); g.player.yaw = yaw; g.player.pitch = pitch;
    g.player.applyCamera();
  };
  // het pistool weg (net als met H): deze foto's gaan over de wereld, niet over
  // het wapen, en anders staat de loop dwars door het veld heen
  g.player.wapenUit = true;
  // kijkrichting van het ene punt naar het andere
  window.__kijk = (px, pz, tx, tz) => Math.atan2(-(tx - px), -(tz - pz));
});
await page.waitForTimeout(1500);

const foto = async (naam) => {
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 300000 });
  console.log(`${map}/${naam}.png`);
};

// ---- het sportpark ----
const punten = await page.evaluate(() => {
  const V = window.__K.sportvelden.find(v => v.hoofd);
  const ex = Math.cos(V.hoek), ez = Math.sin(V.hoek);
  const wx = (u, v) => V.cx + ex * u - ez * v, wz = (u, v) => V.cz + ez * u + ex * v;
  return {
    mid: [V.cx, V.cz],
    // schuin van bovenaf, net binnen de hoek achter het doel: verder naar achteren
    // sta je in het bosplantsoen en kijk je tegen de kruinen aan
    boven: [wx(-V.vl / 2 - 6, -V.vb / 2 - 6), wz(-V.vl / 2 - 6, -V.vb / 2 - 6)],
    doel: [wx(-V.vl / 2 - 14, 0), wz(-V.vl / 2 - 14, 0)],
    // vanaf het veld naar de bordenrij langs de zijlijn kijken
    reclame: [wx(-6, -V.vb / 2 + 4), wz(-6, -V.vb / 2 + 4)],
    reclameDoel: [wx(-6, -V.vb / 2 - 4), wz(-6, -V.vb / 2 - 4)],
    // schuin voor de tribune, vanaf het veld
    tribune: V.tribune ? [wx(-14, -V.tribune.kant * 24), wz(-14, -V.tribune.kant * 24)] : null,
    tribuneDoel: V.tribune ? [wx(6, V.tribune.kant * 40), wz(6, V.tribune.kant * 40)] : null,
    hoek: V.hoek,
  };
});
await page.evaluate((p) => window.__zet(p.boven[0], p.boven[1], window.__kijk(p.boven[0], p.boven[1], p.mid[0], p.mid[1]), -0.30, 34), punten);
await foto('veld_boven');
await page.evaluate((p) => window.__zet(p.mid[0], p.mid[1], p.hoek, -0.02), punten);
await foto('veld_midden');
await page.evaluate((p) => window.__zet(p.doel[0], p.doel[1], window.__kijk(p.doel[0], p.doel[1], p.mid[0], p.mid[1]), 0.02), punten);
await foto('veld_doel');
await page.evaluate((p) => window.__zet(p.reclame[0], p.reclame[1],
  window.__kijk(p.reclame[0], p.reclame[1], p.reclameDoel[0], p.reclameDoel[1]), 0), punten);
await foto('veld_reclame');
if (punten.tribune) {
  await page.evaluate((p) => window.__zet(p.tribune[0], p.tribune[1],
    window.__kijk(p.tribune[0], p.tribune[1], p.tribuneDoel[0], p.tribuneDoel[1]), 0.10), punten);
  await foto('veld_tribune');
}

// ---- de volkstuinen ----
const tuin = await page.evaluate(() => {
  const C = window.__K.volkstuinen[0];
  const p = C.paden[Math.floor(C.paden.length / 2)];
  // een tuintje met zowel een schuurtje als een kas
  const t = C.tuinen.find(q => q.schuur && q.kas) || C.tuinen[0];
  const mid = C.tuinen.reduce((s, q) => [s[0] + q.x / C.tuinen.length, s[1] + q.z / C.tuinen.length], [0, 0]);
  return { pad: [p.a, p.b], tuin: [t.x, t.z], hoek: t.hoek, kant: t.kant, mid };
});
await page.evaluate((t) => {
  const b = [t.mid[0] - 60, t.mid[1] + 70];
  window.__zet(b[0], b[1], window.__kijk(b[0], b[1], t.mid[0], t.mid[1]), -0.36, 38);
}, tuin);
await foto('tuinen_boven');
await page.evaluate((t) => {
  const a = [t.pad[0][0], t.pad[0][1]];
  window.__zet(a[0], a[1], window.__kijk(a[0], a[1], t.pad[1][0], t.pad[1][1]), -0.03);
}, tuin);
await foto('tuinen_pad');
await page.evaluate((t) => {
  // schuin voor het tuintje, vanaf de padkant
  const ex = Math.cos(t.hoek), ez = Math.sin(t.hoek);
  const px = t.tuin[0] - ez * t.kant * 13, pz = t.tuin[1] + ex * t.kant * 13;
  window.__zet(px, pz, window.__kijk(px, pz, t.tuin[0], t.tuin[1]), -0.06);
}, tuin);
await foto('tuinen_schuur');

await browser.close();
