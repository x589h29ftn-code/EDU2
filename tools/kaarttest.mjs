/*
 De kaarten: wijst alles de goede kant op?

   npm run server &   node tools/kaarttest.mjs [poort]

 De minimap houdt jouw kijkrichting boven; de grote kaart (M) houdt noorden boven
 en laat alleen het pijltje meedraaien. Allebei waren ze mis, en op een manier die
 je makkelijk over het hoofd ziet: de minimap draaide met `-yaw + π` in plaats van
 `yaw`, en dat is niet een halve slag maar een spiegeling. De twee vallen samen
 bij yaw = ±π/2, dus pal oost en west klopte het en overal daartussen draaide de
 kaart de verkeerde kant op. Het pijltje op de grote kaart wees precies achteruit.

 Deze toets rekent niet na wat de code doet maar meet wat er op het doek staat:
 hij zoekt de rode noordpijl op de minimap en het gele pijltje op de grote kaart
 op, en kijkt onder welke hoek ze staan.
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let goed = 0, fout = 0;
const ok = (naam, waar, extra = '') => {
  if (waar) { goed++; console.log(`  ✓ ${naam}`); }
  else { fout++; console.log(`  ✗ ${naam}${extra ? ' — ' + extra : ''}`); }
};
// het verschil tussen twee hoeken, altijd tussen −π en π
const hoekVerschil = (a, b) => {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};
const graden = (r) => `${(r * 180 / Math.PI).toFixed(0)}°`;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const fouten = [];
page.on('pageerror', e => fouten.push(e.message));
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });

await page.evaluate(() => {
  const g = window.__game;
  g.player.active = true;
  g.player.inCar = null;
  g.player.pos.set(0, 0, 0);
  /*
   De hoek waaronder een kleur op het doek staat, gerekend met de klok mee vanaf
   recht boven het midden. Zo lezen we de noordpijl (rood) en het spelerpijltje
   (geel) van het beeld af in plaats van uit de code.
  */
  window.__hoekVan = (doek, raak, straalMin, straalMax) => {
    const c = doek.getContext('2d');
    const W = doek.width, H = doek.height;
    const d = c.getImageData(0, 0, W, H).data;
    let sx = 0, sz = 0, n = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (!raak(d[i], d[i + 1], d[i + 2], d[i + 3])) continue;
      const dx = x - W / 2, dy = y - H / 2, r = Math.hypot(dx, dy);
      if (r < straalMin || r > straalMax) continue;
      sx += dx; sz += dy; n++;
    }
    if (!n) return null;
    // met de klok mee vanaf boven: atan2(x, −y)
    return { hoek: Math.atan2(sx / n, -(sz / n)), punten: n };
  };
});

// ---------- de minimap: jouw kijkrichting boven ----------
console.log('\nde minimap houdt je kijkrichting boven');
for (const graad of [0, 45, 90, 135, 180, 225, 270, 315]) {
  const yaw = graad * Math.PI / 180;
  const uit = await page.evaluate(async (y) => {
    const g = window.__game;
    g.player.yaw = y;
    g.hud.update(0.016, g.player, g.vehicles, g.npcs, '', null);
    /*
     De noordpijl is de rode 'N' langs de rand. Wereldnoord is −z, en met de
     kaart over `rot` gedraaid komt dat op het doek uit onder de hoek `rot`
     gerekend met de klok mee vanaf boven. Staat de kaart goed, dan is `rot`
     gelijk aan yaw.
    */
    const doek = g.hud.canvas;
    const rood = (r, gg, b, a) => a > 100 && r > 180 && gg < 130 && b < 120;
    const N = window.__hoekVan(doek, rood, doek.width * 0.28, doek.width * 0.5);
    return { N: N ? N.hoek : null, punten: N ? N.punten : 0, rot: g.hud._kaartRot };
  }, yaw);
  ok(`bij ${graad}° staat de noordpijl op ${graad}° van boven`,
    uit.N !== null && Math.abs(hoekVerschil(uit.N, yaw)) < 0.20,
    uit.N === null ? 'geen noordpijl gevonden' : `gemeten ${graden(uit.N)}, verwacht ${graden(yaw)}`);
}

/*
 ---------- de grote kaart: noorden boven, pijltje draait ----------
 Het spelerpijltje is geel (#ffd400) en de punt van de driehoek steekt verder uit
 dan de basis: het verste gele beeldpunt vanaf de speler is dus de punt, en de
 hoek daarvan hoort gelijk te zijn aan je kijkrichting.

 Kijk uit met "geel". Deze toets zei eerst dat het pijltje bij 180° de verkeerde
 kant op wees, en dat was de toets zelf: het bordje boven een winkel staat in
 #f2b632 en dat haalde een ruime kleurtest (r > 200, g > 160, b < 110) net zo goed
 als het pijltje. Het verste "gele" punt was dan een letter van een winkelnaam een
 eind verderop in plaats van de punt van de driehoek. Vandaar de nauwe test om
 #ffd400 heen, en een venster van 22 in plaats van 40 beeldpunten — het pijltje
 zelf is er 13 lang.
*/
console.log('\nop de grote kaart wijst het pijltje jouw kant op');
const HOEKEN = [0, 45, 90, 135, 180, 225, 270, 315];
const draai = await page.evaluate(async (hoeken) => {
  const { KAART } = await import('/js/kaart.js');
  const g = window.__game;
  const geel = (r, gg, b, a) => a > 100 && r > 246 && gg > 196 && gg < 228 && b < 40;
  const meet = (y) => {
    g.player.yaw = y;
    g.hud.drawBig(g.player, g.vehicles);
    const doek = g.hud.big;
    const c = doek.getContext('2d');
    const W = doek.width, H = doek.height;
    const d = c.getImageData(0, 0, W, H).data;
    const G = KAART.gebied;
    const schaal = Math.min(W / (G.x1 - G.x0), H / (G.z1 - G.z0));
    /*
     Waar staat het pijltje? Op dezelfde plek als js/hud.js hem tekent, en dat is
     niet altijd de speler: staat `kaartVanaf` gezet (de laatst bekende plek),
     dan gaat die voor. Zonder dat mee te nemen zoek je in het verkeerde venster.
    */
    const ax = g.hud.kaartVanaf ? g.hud.kaartVanaf.x : g.player.pos.x;
    const az = g.hud.kaartVanaf ? g.hud.kaartVanaf.z : g.player.pos.z;
    const mx = W / 2 - (G.x0 + G.x1) / 2 * schaal + ax * schaal;
    const my = H / 2 - (G.z0 + G.z1) / 2 * schaal + az * schaal;
    let n = 0; const punten = [];
    for (let y2 = Math.max(0, Math.round(my - 22)); y2 < Math.min(H, my + 22); y2++)
      for (let x = Math.max(0, Math.round(mx - 22)); x < Math.min(W, mx + 22); x++) {
        const i = (y2 * W + x) * 4;
        if (!geel(d[i], d[i + 1], d[i + 2], d[i + 3])) continue;
        n++; punten.push([x, y2]);
      }
    if (!n) return null;
    /*
     Het pijltje wordt getekend met de speler als oorsprong, en de punt steekt er
     het verst uit (13 tegen 10,6 voor de achterhoeken). Het gele beeldpunt dat
     het verst van de speler ligt is dus de punt, en de hoek daarvan is je
     kijkrichting. Het gele oppervlak houdt aan de randen een paar beeldpunten
     over aan de donkere omlijning — de gemeten punt ligt daardoor rond de 7 à 8
     beeldpunten van het midden in plaats van 13, en dat hoort zo.
    */
    let ver = null, verD = -1;
    for (const [x, y2] of punten) {
      const dd = Math.hypot(x - mx, y2 - my);
      if (dd > verD) { verD = dd; ver = [x, y2]; }
    }
    return { hoek: Math.atan2(ver[0] - mx, -(ver[1] - my)), punten: n, ver: verD };
  };
  const uit = {};
  for (const graad of hoeken) uit[graad] = meet(graad * Math.PI / 180);
  return uit;
}, HOEKEN);
/*
 Let op het teken. Op een kaart met noorden boven is x naar rechts en z naar
 beneden, en je kijkrichting is (−sin yaw, −cos yaw). Bij yaw = 90° kijk je dus
 naar het westen, en west is op zo'n kaart naar links. De hoek van de punt,
 met de klok mee vanaf boven, is daarom −yaw en niet +yaw. (Op de minimap draait
 de kaart zelf mee en komt de noordpijl juist op +yaw uit; die twee horen elkaars
 spiegelbeeld te zijn.)
*/
for (const graad of HOEKEN) {
  const verwacht = -graad * Math.PI / 180;
  const m = draai[graad];
  ok(`bij ${graad}° wijst de punt ${graad}° van noord`,
    m && Math.abs(hoekVerschil(m.hoek, verwacht)) < 0.35,
    m ? `gemeten ${graden(m.hoek)}, verwacht ${graden(verwacht)} (${m.punten} punten, punt op ${m.ver.toFixed(1)} px)` : 'niet gevonden');
}

console.log(`\nfouten in de pagina: ${fouten.length ? fouten.join(' | ') : 'geen'}`);
if (fouten.length) fout++;
console.log(`\n${goed} goed, ${fout} fout`);
await browser.close();
process.exit(fout ? 1 : 0);
