// Fotografeert elk woningtype apart, op een leeg stuk veld buiten de wijk.
// Levert shots/assets/<type>.png en een overzichtsblad.
// Gebruik: node tools/assets.mjs [poort]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const port = process.argv[2] || '8123';
const uit = 'shots/assets';
mkdirSync(uit, { recursive: true });

// leeg veld ver ten oosten van de wijk (kaartpixels)
const PLEK = [2400, 800];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 90000 });
await page.evaluate(() => {
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('ui').style.display = 'none';
});
await page.waitForTimeout(600);

const typen = await page.evaluate(async () => Object.keys((await import('./js/textures.js')).HOUSE_STYLES));
console.log(`${typen.length} woningtypen:`, typen.join(', '));

const gegevens = [];
for (const type of typen) {
  const info = await page.evaluate(async ({ type, PLEK }) => {
    const { ROWS, PX_PER_M, toWorld } = await import('./js/data.js');
    const { HOUSE_STYLES } = await import('./js/textures.js');
    const w = await import('./js/world.js');
    const g = window.__game;
    const st = HOUSE_STYLES[type];

    // alleen deze ene rij bouwen, op een leeg veld
    if (!window.__bewaardeRijen) window.__bewaardeRijen = ROWS.slice();
    const lengte = (st.detached ? 3 : st.semi ? 4 : 6) * (st.w || 5.5) * PX_PER_M;
    ROWS.length = 0;
    ROWS.push({ src: 0, showroom: true, a: [PLEK[0], PLEK[1]], b: [PLEK[0] + lengte, PLEK[1]], off: 10, depth: st.detached ? 11 : 9, type });

    w.resetWorld(g.scene); w.buildWorld(g.scene);

    // Bij een positieve off staat het blok ten noorden van de lijn en kijkt de
    // voorgevel naar het zuiden. De camera staat dus ten zuiden van de rij.
    const [cx, cz] = toWorld(PLEK[0] + lengte / 2, PLEK[1]);
    const dx = 13, dz = 16 + lengte / PX_PER_M * 0.30;
    g.player.fly = true;
    g.player.pos.set(cx + dx, 6.5, cz + dz);
    g.player.yaw = Math.atan2(dx, dz);       // kijkt naar het midden van de rij
    g.player.pitch = -0.10;
    g.camera.fov = 50; g.camera.updateProjectionMatrix();   // rustiger dan de 72 van het spel
    // De luchtkoepel staat vast op de oorsprong; zo ver van de wijk kijk je er
    // tegen de buitenkant aan. Even meeverhuizen met de camera.
    g.scene.traverse(o => { if (o.isMesh && o.material && o.material.type === 'ShaderMaterial') o.position.copy(g.player.pos); });
    return {
      type,
      lagen: st.storeys, breedte: st.w,
      dak: st.roofType, dakkapel: !!st.dormer, dakraam: !!st.skylight,
      zonnepanelen: !!st.solar, schoorsteen: !!st.chimney,
      soort: st.detached ? 'vrijstaand' : st.semi ? 'twee onder een kap' : 'rijtje',
    };
  }, { type, PLEK });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${uit}/${type}.png` });
  gegevens.push(info);
  console.log('geschoten', type, `· ${info.lagen} laag/lagen · ${info.soort}`);
}

// wereld terugzetten
await page.evaluate(async () => {
  const { ROWS } = await import('./js/data.js');
  const w = await import('./js/world.js');
  ROWS.length = 0; window.__bewaardeRijen.forEach(r => ROWS.push(r));
  window.__game.camera.fov = 72; window.__game.camera.updateProjectionMatrix();
  w.resetWorld(window.__game.scene); w.buildWorld(window.__game.scene);
  window.__game.player.fly = false;
});

console.log(JSON.stringify(gegevens, null, 1));
await browser.close();
