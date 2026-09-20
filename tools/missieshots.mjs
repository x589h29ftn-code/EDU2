/*
 Foto's van de ronde van 20 september 2026 (derde lijst):

   uitleg_winkels.png   de balk na de beloning van Johan: waar je je geld kwijt kunt
   sterren_voor.png     vier sterren op je dak, vlak voor het afleveren
   sterren_weg.png      MISSION COMPLETED, en de sterren zijn van het scherm

 Gebruik: npm run server &   node tools/missieshots.mjs 8123 [map]
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

const foto = async (naam, wacht = 800) => {
  await page.waitForTimeout(wacht);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 300000 });
  console.log(`${map}/${naam}.png`);
};

await page.evaluate(async () => {
  const { geluid } = await import('/js/audio.js');
  const g = window.__game;
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true;
  g.sfeer.uur = 15; g.sfeer.weer = 'helder';
  geluid.start();
  await geluid.laadMissieMuziek();
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) g.verhaal.update(dt); };
});

// -------------------------------------------------- de balk over de winkels
await page.evaluate(async () => {
  const uitleg = window.__game.uitleg;
  uitleg.reset();
  /*
   In het spel staat het blokje dertien seconden in beeld; hier veel langer,
   want een schermafdruk maken kost op deze machine meer dan dertien seconden en
   dan is de balk alweer weg voor de foto genomen is.
  */
  uitleg.toon('winkels', 'Wat je met je geld kunt',
    'Bij <b>Tinga State</b> aan de Molenkrite koop je wapens en munitie · '
    + 'bij de <b>Poiesz</b> in IJlst en Duinterpen vul je je health aan', 600);
  /*
   En de dekking hard zetten. In het spel fadet het blokje in een derde seconde
   aan; in een headless browser blijft die overgang hangen op nul zolang er
   verder niets aan de stijl verandert, en dan staat er op de foto niets.
  */
  document.getElementById('uitleg').style.opacity = '1';
});
const balk = await page.evaluate(async () => {
  const uitleg = window.__game.uitleg;
  const el = document.getElementById('uitleg');
  return { inBeeld: uitleg.inBeeld(), klassen: el ? el.className : 'geen element',
    dekking: el ? getComputedStyle(el).opacity : null, zicht: el ? getComputedStyle(el).display : null };
});
console.log('uitlegbalk:', JSON.stringify(balk));
await foto('uitleg_winkels', 700);

// ----------------------------------------- de sterren: eerst op, dan weg
await page.evaluate(async () => {
  const g = window.__game;
  const uitleg = g.uitleg;
  uitleg.reset();
  document.getElementById('uitleg').style.opacity = '0';
  for (let i = 0; i < 6; i++) g.politie.misdaad('agent', g.player.pos.x, g.player.pos.z);
  await new Promise(r => requestAnimationFrame(r));
});
await foto('sterren_voor', 900);

await page.evaluate(async () => {
  const g = window.__game;
  // wat het verhaal doet zodra de vrachtwagen bij de schuur staat
  g.politie.reset();
  g.hud.melding('MISSION COMPLETED', 'De lading staat bij de boerderij.', 30);
  await new Promise(r => requestAnimationFrame(r));
});
await foto('sterren_weg', 900);

await browser.close();
