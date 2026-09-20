/*
 Foto's van de ronde van 20 september 2026:

   ranzijn.png          Ranzijn Tuin & Dier aan de Zonnedauw
   koplampen_nacht.png  de koplampen op de weg, rond middernacht
   sniper_kijker.png    door de kijker van de sniper
   sniper_hand.png      de sniper in de hand, zonder te richten
   fietser.png          een fietser van opzij
   zeskanter.png        de Zeskanter: geen witte wangen meer boven de gevels

 Gebruik: npm run server &   node tools/snipshots.mjs 8123 [map]
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

await page.evaluate(() => {
  const g = window.__game;
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('ui').style.display = 'none';
  g.player.active = true;
  g.sfeer.uur = 13; g.sfeer.weer = 'helder';
  g.player.wapenUit = true; if (g.player.gun) g.player.gun.visible = false;
  g.player.fly = true;
  window.__kijk = (doel, afst, hoog, hoek, mikY = 3) => {
    const x = doel.x + Math.cos(hoek) * afst, z = doel.z + Math.sin(hoek) * afst;
    g.player.pos.set(x, hoog, z);
    g.player.yaw = Math.atan2(-(doel.x - x), -(doel.z - z));
    g.player.pitch = Math.atan2(mikY - hoog, Math.hypot(doel.x - x, doel.z - z));
    g.player.updateFly(0);
  };
  window.__voorPand = async (kies, afst, hoog, mikY) => {
    const { KAART } = await import('/js/kaart.js');
    const test = /^\d+$/.test(kies) ? (q) => q.id === kies : new Function('q', `return ${kies}`);
    const p = KAART.panden.find(test);
    if (!p) return null;
    let x = 0, z = 0;
    for (const q of p.voet) { x += q[0]; z += q[1]; }
    const hart = { x: x / p.voet.length, z: z / p.voet.length };
    const f = p.front || [0, -1];
    window.__kijk(hart, afst, hoog, Math.atan2(f[1], f[0]), mikY);
    return { id: p.id, type: p.type, x: hart.x, z: hart.z };
  };
});

const shot = async (naam, kies, afst, hoog, mikY) => {
  const p = await page.evaluate(([k, a, h, m]) => window.__voorPand(k, a, h, m), [kies, afst, hoog, mikY]);
  if (!p) { console.log(`${naam}: geen pand gevonden`); return; }
  console.log(`${naam}: ${p.id} (${p.type}) op (${p.x.toFixed(0)}, ${p.z.toFixed(0)})`);
  await foto(naam);
};

// ---- Ranzijn Tuin & Dier en de Zeskanter ----
await shot('ranzijn', "q.type === 'tuincentrum'", 34, 3.0, 5.0);
await shot('zeskanter', "q.straat === 'Zeskanter' && q.nok > 7", 20, 3.0, 5.0);

// ---- een fietser van opzij ----
/*
 De camera blijft aan de fietser vastzitten tot de foto genomen is: een fietser
 rijdt vier meter per seconde en staat anders allang buiten beeld tegen de tijd
 dat de opname klaar is. Vandaar een eigen rAF-lus in de pagina.
*/
const fiets = await page.evaluate(() => {
  const g = window.__game;
  const p = g.npcs.people.find(q => q.fietst && q.alive !== false);
  if (!p) return null;
  const volg = () => {
    if (!window.__volgAan) return;
    // opzij en iets achter: dan zie je het been, het zadel én het stuur
    const zij = { x: -Math.cos(p.yaw), z: Math.sin(p.yaw) };
    g.player.pos.set(p.x + zij.x * 4.2 - Math.sin(p.yaw) * 1.2, 1.35,
      p.z + zij.z * 4.2 - Math.cos(p.yaw) * 1.2);
    g.player.yaw = Math.atan2(-(p.x - g.player.pos.x), -(p.z - g.player.pos.z));
    g.player.pitch = -0.08;
    g.player.updateFly(0);
    requestAnimationFrame(volg);
  };
  window.__volgAan = true; volg();
  return { x: p.x, z: p.z, snelheid: +p.vNu.toFixed(1) };
});
if (fiets) { console.log(`fietser op (${fiets.x.toFixed(0)}, ${fiets.z.toFixed(0)})`); await foto('fietser'); }
await page.evaluate(() => { window.__volgAan = false; });

// ---- de sniper in de hand en door de kijker ----
await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const g = window.__game;
  g.player.fly = false;
  g.player.pos.set(KAART.start.x, 0, KAART.start.z);
  g.player.yaw = KAART.start.yaw; g.player.pitch = 0;
  g.player.wapenUit = false;
  g.player.reserve = 200;
  g.player.krijgWapen('sniper');
  document.getElementById('ui').style.display = '';
  for (let i = 0; i < 60; i++) g.player.update(1 / 60);
});
await foto('sniper_hand');
await page.evaluate(() => {
  const g = window.__game;
  g.player.richten(true);
  for (let i = 0; i < 60; i++) g.player.update(1 / 60);
});
await foto('sniper_kijker');

// ---- de koplampen in het donker ----
/*
 Op een rechte straat en niet op het startpunt: de bundel ligt op het asfalt
 vóór de auto, en die zie je alleen als je daar ook langs kijkt. Het stuk weg
 wordt uit KAART.wegassen gekozen — het langste rechte vak van een straat waar
 je mag rijden — zodat de auto er precies op staat en de neus de goede kant op.
*/
const nacht = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const g = window.__game;
  g.player.richten(false);
  g.player.wapenUit = true;
  for (let i = 0; i < 30; i++) g.player.update(1 / 60);
  let beste = null;
  for (const w of KAART.wegassen) {
    if (!w.drive) continue;
    for (let i = 0; i + 1 < w.pts.length; i++) {
      const a = w.pts[i], b = w.pts[i + 1];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L > 60 && L < 200 && (!beste || L > beste.L)) beste = { a, b, L, naam: w.naam };
    }
  }
  if (!beste) return null;
  const { a, b } = beste;
  const dx = (b[0] - a[0]) / beste.L, dz = (b[1] - a[1]) / beste.L;
  const x = a[0] + dx * 6, z = a[1] + dz * 6;
  const yaw = Math.atan2(-dx, -dz);
  const car = g.vehicles.voegToe({ x, z, yaw, soort: 'hatch', kleur: 0x2a3f8f });
  if (!car) return null;
  g.player.pos.set(car.x, 0, car.z);
  g.player.inCar = car;
  // meekijken met de neus van de auto; anders staar je tegen de deurstijl aan
  g.player.yaw = car.yaw; g.player.pitch = -0.06;
  g.sfeer.uur = 23.4;
  for (let i = 0; i < 40; i++) await new Promise(r => requestAnimationFrame(r));
  return { x, z, straat: beste.naam, lengte: +beste.L.toFixed(0) };
});
if (nacht) { console.log(`koplampen op de ${nacht.straat} (${nacht.lengte} m recht) bij (${nacht.x.toFixed(0)}, ${nacht.z.toFixed(0)})`); await foto('koplampen_nacht'); }

await browser.close();
