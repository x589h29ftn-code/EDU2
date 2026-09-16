/*
 Foto's van De Terpensmole en de houtkolk:

   terpensmole_pad.png       de spinnenkop vanaf het fietspad langs het
                             Sneekerpad, zoals je hem ziet als je van Sneek
                             naar IJlst fietst
   terpensmole_dichtbij.png  van opzij: de taps toelopende romp, de staart die
                             tot bij de grond komt, het kruirad en de trap
   houtkolk.png              de inham achter De Rat, met de stammen in het water
   houtkolk_met_molen.png    dezelfde kolk met de zaagmolen erachter

 De camera vliegt hier (`player.fly`), want de mooiste standpunten liggen midden
 in het weiland en midden op het water.

 Gebruik: npm run server &   node tools/terpshots.mjs 8123 [map]
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
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });

const foto = async (naam) => {
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 300000 });
  console.log(`${map}/${naam}.png`);
};

const molens = await page.evaluate(async () => {
  const g = window.__game;
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('ui').style.display = 'none';
  g.player.active = true;
  g.sfeer.uur = 13; g.sfeer.weer = 'helder';
  g.player.wapenUit = true; if (g.player.gun) g.player.gun.visible = false;
  g.player.fly = true;
  window.__kijk = (doel, afst, hoog, hoek, mikY = 4) => {
    const x = doel.x + Math.cos(hoek) * afst, z = doel.z + Math.sin(hoek) * afst;
    g.player.pos.set(x, hoog, z);
    g.player.yaw = Math.atan2(-(doel.x - x), -(doel.z - z));
    g.player.pitch = Math.atan2(mikY - hoog, Math.hypot(doel.x - x, doel.z - z));
    g.player.updateFly(0);
  };
  const { KAART } = await import('/js/kaart.js');
  const uit = {};
  for (const m of KAART.molens) {
    uit[m.soort] = { naam: m.naam, x: m.cx, z: m.cz, kruihoek: m.kruihoek, top: m.top,
      kolk: m.kolk ? { x: m.kolk.cx, z: m.kolk.cz, opp: m.kolk.opp } : null };
  }
  return uit;
});
console.log('molens:', Object.entries(molens).map(([s, m]) => `${m.naam} (${s})`).join(', '));

// ---- De Terpensmole ----
const T = molens.spinnenkop;
if (T) {
  // vanaf het fietspad: dat ligt aan de kant waar het gevlucht naartoe kijkt
  await page.evaluate((t) => window.__kijk(t, 24, 1.7, t.kruihoek * Math.PI / 180, 5.5), T);
  await foto('terpensmole_pad');
  // en van opzij, laag, zodat de staart en het kruirad in beeld komen
  await page.evaluate((t) => window.__kijk(t, 13, 2.0, (t.kruihoek + 125) * Math.PI / 180, 4.5), T);
  await foto('terpensmole_dichtbij');
}

// ---- de houtkolk ----
const R = molens.stelling;
if (R && R.kolk) {
  console.log(`houtkolk: ${R.kolk.opp} m² op (${R.kolk.x}, ${R.kolk.z})`);
  await page.evaluate((k) => {
    // laag boven het water, vanaf de molenkant de kolk in kijkend
    const hoek = Math.atan2(k.z - k.kolk.z, k.x - k.kolk.x);
    window.__kijk(k.kolk, 27, 3.2, hoek, 0.1);
  }, R);
  await foto('houtkolk');
  await page.evaluate((k) => {
    /*
     Van de andere kant van de kolk, met de zaagmolen erachter. Van veel verder
     weg kijk je over de daken van het Sneekerpad heen en zie je van de kolk
     niets meer, dus dit standpunt ligt vlak achter het water.
    */
    const hoek = Math.atan2(k.kolk.z - k.z, k.kolk.x - k.x) + 0.55;
    window.__kijk(k.kolk, 34, 5.0, hoek, 2.5);
  }, R);
  await foto('houtkolk_met_molen');
}

await browser.close();
