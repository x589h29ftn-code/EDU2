/*
 Foto's bij de gebouwtest (24 sep 2026): een steekproef van woningen vanaf de
 straat, na het herstel van de muren, de gevels en de daken.

   gebouw_ijlst.png        Sikko Sjaerdemalaan (IJlst): de muren die uit het 3D
                           BAG-model het huis in keken staan nu naar buiten
   gebouw_tiny.png         de tiny houses aan de Molenkrite: smalle muurvlakken
                           met de deur en het raam op hun maat, niet ingedrukt
   gebouw_steekproef_1-8   acht willekeurige woningen (vast zaadje, dus elke
                           keer dezelfde acht), negen meter voor de voorgevel
   straat_1-4              vier willekeurige straten in Tinga, vanaf de stoep
                           de straat in gekeken

 Gebruik: npm run server &   node tools/gebouwshots.mjs 8123 [map]
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { camera } from './geo/steekproefplek.mjs';

const poort = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
mkdirSync(map, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

// de panden uit de kaart: de adressen van de vaste foto's en vier willekeurige
const panden = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const T = await import('/js/textures.js');
  const g = window.__game;
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true; window.__autoplay = true;
  g.player.wapenUit = true; if (g.player.gun) g.player.gun.visible = false;
  g.reliëfAf();
  g.sfeer.uur = 14; g.sfeer.weer = 'helder';
  for (let i = 0; i < 5; i++) g.sfeer.update(0.1, 0, 0);
  const kaal = (p) => ({ id: p.id, straat: p.straat, nr: p.nr, voet: p.voet, front: p.front, type: p.type });
  const zoek = (straat, nr) => KAART.panden.find(p => p.straat === straat && (p.nr || []).includes(nr));
  const woningen = KAART.panden.filter(p => p.nr && p.nr.length && p.front && T.HOUSE_STYLES[p.type] && p.type !== 'tinyhouse');
  let s = 20260924;
  const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const vier = [];
  while (vier.length < 8) { const p = woningen[Math.floor(r() * woningen.length)]; if (!vier.includes(p)) vier.push(p); }
  const tiny = KAART.panden.find(p => p.type === 'tinyhouse' && p.front);
  // straten: een punt op een willekeurige rijbaanas binnen 700 m van het
  // begin, een paar meter opzij van de as, kijkend langs de straat
  const assen = KAART.wegassen.filter(w => w.drive && w.naam && w.naam !== 'N7' && w.pts.length > 2
    && Math.hypot(w.pts[0][0] - g.start.x, w.pts[0][1] - g.start.z) < 700);
  const straten = [];
  while (straten.length < 4) {
    const w = assen[Math.floor(r() * assen.length)], i = 1 + Math.floor(r() * (w.pts.length - 2));
    if (straten.some(q => q.naam === w.naam)) continue;
    const [a, b] = [w.pts[i - 1], w.pts[i]], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
    straten.push({ naam: w.naam, x: a[0] - uz * 3.2, z: a[1] + ux * 3.2, yaw: Math.atan2(-ux, -uz) });
  }
  return [
    ...straten.map((q, i) => [`straat_${i + 1}`, null, q]),
    ['gebouw_ijlst', kaal(zoek('Sikko Sjaerdemalaan', '41') || zoek('Sikko Sjaerdemalaan', '67'))],
    ['gebouw_tiny', kaal(tiny)],
    ...vier.map((p, i) => [`gebouw_steekproef_${i + 1}`, kaal(p)]),
  ];
});

for (const [naam, pand, straat] of panden) {
  if (!straat && (!pand || !pand.voet)) { console.log(`${naam}: pand niet gevonden`); continue; }
  const c = straat ? { x: straat.x, z: straat.z, yaw: straat.yaw } : camera(pand);
  await page.evaluate(({ c }) => {
    const g = window.__game;
    g.player.inCar = null;
    g.player.pos.set(c.x, 0, c.z);
    g.player.yaw = c.yaw; g.player.pitch = c.pitch ?? 0.06;
    g.player.applyCamera();
    g.zetSchaduwDoos(g.camera.position.x, g.camera.position.z);
    g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
    if (g.uitleg) g.uitleg.update(999);
  }, { c });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 600000 });
  console.log(`${map}/${naam}.png  ${straat ? straat.naam : `${pand.straat} ${(pand.nr || [])[0] || ''} (${pand.type})`}`);
}
await browser.close();
