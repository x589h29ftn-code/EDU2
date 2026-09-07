/*
 Voor en na van het reliëf en de glans (js/textures.js `zetReliëf`).

 Elke plek wordt twee keer gefotografeerd: één keer met `?relief=0` (alleen
 kleurdoeken, zoals het was) en één keer zoals het nu staat. De bestanden heten
 `beeld_<plek>_zonder.png` en `beeld_<plek>_met.png`, zodat je ze naast elkaar
 kunt leggen.

 Reliëf zie je alleen bij strijklicht: staat de zon recht op een vlak, dan is
 een normal map bijna niet te onderscheiden van een vlakke muur. Daarom heeft
 elke plek zijn eigen klokstand, gekozen op de stand van de zon ten opzichte
 van dát vlak. De zon staat in `js/sfeer.js` op
 (-cos((uur-6)/12*pi)*0,75 ; sin(...) ; 0,5), dus:

   straat    09:00  overzicht van de Molenkrite: gevels, klinkers en pannen
   kopgevel  09:00  kale baksteen van een kopgevel, zon er schuin overheen
   klinkers  07:36  laag zonnetje over de bestrating, vlak boven de stenen
   dak       09:00  pannendaken van boven, de helften naar het oosten in strijklicht
   gevel     09:00  dicht op een voorgevel in de schaduw: het glas spiegelt de
                    lucht, dus hier zie je de glansmap en niet het reliëf
                    (gevels krijgen geen normal map, zie js/textures.js)

 En alleen in de reliëfronde nog een paar dat niet over reliëf gaat maar over
 het natte wegdek uit dezelfde ronde: `beeld_wegdek_droog.png` tegenover
 `beeld_wegdek_nat.png`. Dat staat niet achter `?relief=0`, dus een voor/na met
 die schakelaar zou twee gelijke plaatjes geven.

 Gebruik: python3 -m http.server 8123 &
          node tools/beeldshots.mjs 8123 [map] [plek,plek,...]

 Het derde argument beperkt de ronde tot een paar plekken, handig als je één
 standpunt aan het bijstellen bent.
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const port = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
const alleen = process.argv[4] ? process.argv[4].split(',') : null;
mkdirSync(map, { recursive: true });

// naam, x, z, yaw, pitch, hoogte, uur
const PLEKKEN = [
  ['straat', 10.0, -7.0, -0.88, 0.02, 0, 9.0],
  ['kopgevel', -39.2, -29.1, 0.222, 0.30, 0, 9.0],
  ['klinkers', 10.7, -7.1, -0.88, -0.62, 0, 7.6],
  ['dak', 4.0, 6.0, -0.70, -0.42, 13, 9.0],
  ['gevel', 20.9, -5.1, -2.386, 0.20, 0, 12.5],
];

// naam, x, z, yaw, pitch, hoogte, uur, weer — alleen met reliëf
const WEGDEK = [
  ['wegdek_droog', 10.0, -7.0, -0.88, -0.34, 0, 9.0, 'helder'],
  ['wegdek_nat', 10.0, -7.0, -0.88, -0.34, 0, 9.0, 'regen'],
];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

async function serie(relief) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  let melding = '';
  page.on('console', m => { if (m.text().startsWith('reliëf:')) melding = m.text(); });
  await page.goto(`http://127.0.0.1:${port}/index.html${relief ? '' : '?relief=0'}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game, null, { timeout: 300000 });
  await page.evaluate(() => {
    localStorage.removeItem('tinga.spel.v1');
    document.getElementById('overlay').style.display = 'none';
    const g = window.__game;
    g.player.active = true;
    if (!g.player.wapenUit) g.player.wisselWapen();   // pistool en kruisje uit beeld
    g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
  });
  if (melding) console.log(`  ${melding}`);

  const schot = async ([naam, x, z, yaw, pitch, hoog, uur, weer = 'helder'], merk) => {
    await page.evaluate(([x, z, yaw, pitch, hoog, uur, weer]) => {
      const g = window.__game;
      g.sfeer.uur = uur;
      g.sfeer.weer = weer;
      g.player.inCar = null; g.player.zit = false;
      g.player.pos.set(x, hoog, z); g.player.yaw = yaw; g.player.pitch = pitch;
      g.player.applyCamera();
    }, [x, z, yaw, pitch, hoog, uur, weer]);
    await page.waitForTimeout(2200);
    const pad = `${map}/beeld_${naam}${merk ? '_' + merk : ''}.png`;
    await page.screenshot({ path: pad, timeout: 300000 });
    console.log(pad);
  };

  const kies = (lijst) => lijst.filter(p => !alleen || alleen.includes(p[0]));
  for (const p of kies(PLEKKEN)) await schot(p, relief ? 'met' : 'zonder');
  if (relief) for (const p of kies(WEGDEK)) await schot(p, '');
  await page.close();
}

await serie(false);
await serie(true);
await browser.close();
