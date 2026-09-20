/*
 Foto's van de ronde van 20 september 2026 (tweede lijst):

   bloed.png             een voetganger op het moment van de treffer, met de spat
   bloed_plas.png        dezelfde plek anderhalve seconde later: de plas
   blaustraat_toren.png  de woontoren aan de Quirijn de Blaustraat 50-50B
   hospice.png           hospice De Kime, Westhemstraat 46
   scherwolderhem.png    de galerijflat aan de Scherwolderhemstraat 27-73

 Gebruik: npm run server &   node tools/spatshots.mjs 8123 [map]
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

const foto = async (naam, wacht = 900) => {
  await page.waitForTimeout(wacht);
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
  /*
   Een standpunt vóór een pand: `front` uit de kaart wijst de voorgevel uit. De
   pandwijzer (js/pandwijzer.js) controleert daarna of er ook werkelijk dát pand
   in beeld staat en niet de buurman — die fout is op deze kaart al eens gemaakt.
  */
  window.__voorPand = async (id, afst, hoog, mikY) => {
    const { KAART } = await import('/js/kaart.js');
    const { maakPandWijzer } = await import('/js/pandwijzer.js');
    const p = KAART.panden.find(q => q.id === id);
    if (!p) return null;
    let x = 0, z = 0;
    for (const q of p.voet) { x += q[0]; z += q[1]; }
    const hart = { x: x / p.voet.length, z: z / p.voet.length };
    const f = p.front || [0, -1];
    const hoek = Math.atan2(f[1], f[0]);
    const px = hart.x + Math.cos(hoek) * afst, pz = hart.z + Math.sin(hoek) * afst;
    g.player.pos.set(px, hoog, pz);
    g.player.yaw = Math.atan2(-(hart.x - px), -(hart.z - pz));
    g.player.pitch = Math.atan2(mikY - hoog, Math.hypot(hart.x - px, hart.z - pz));
    g.player.updateFly(0);
    window.__wijzer = window.__wijzer || maakPandWijzer(KAART);
    const raak = window.__wijzer.zoek(px, pz, g.player.yaw);
    return { type: p.type, x: hart.x, z: hart.z, inBeeld: raak && raak.p.id === id };
  };
});

const shot = async (naam, id, afst, hoog, mikY) => {
  const p = await page.evaluate(([i, a, h, m]) => window.__voorPand(i, a, h, m), [id, afst, hoog, mikY]);
  if (!p) { console.log(`${naam}: geen pand gevonden`); return; }
  console.log(`${naam}: ${id} (${p.type}) op (${p.x.toFixed(0)}, ${p.z.toFixed(0)})${p.inBeeld ? '' : ' — LET OP: ander pand in beeld'}`);
  await foto(naam);
};

// ---- de drie panden ----
await shot('blaustraat_toren', '1900100000313266', 78, 5, 16);
await shot('hospice', '0091100000007740', 44, 3, 4);
await shot('scherwolderhem', '0091100000019596', 40, 4, 7);

// ---- bloed ----
/*
 Een voetganger op een paar meter afstand, met de sniper neergeschoten: dan is
 er één kogel nodig en staan de spat en de plas er allebei op hetzelfde moment.
 De foto wordt kort na het schot genomen, want de spat is na een halve seconde
 weg.
*/
const bloed = await page.evaluate(async () => {
  const THREE = await import('three');
  const g = window.__game;
  const p = g.player;
  p.fly = false;
  p.reserve = 100;
  p.wapenUit = false;
  p.krijgWapen('sniper');
  for (let i = 0; i < 40; i++) p.update(1 / 60);
  /*
   Pas hierna richten. De wisselbeweging kost veertig beelden, en in die tijd
   loopt de voetganger door: mikte de foto op de plek van daarvoor, dan ging de
   kogel achter hem langs en stond er geen druppel bloed op de foto.
  */
  const mens = g.npcs.people.find(q => q.alive && Math.abs(q.x) < 900 && Math.abs(q.z) < 900);
  if (!mens) return null;
  const van = new THREE.Vector3(mens.x + 3.6, 1.6, mens.z - 3.6);
  p.pos.set(van.x, 0, van.z);
  p.yaw = Math.atan2(-(mens.x - van.x), -(mens.z - van.z));
  p.pitch = -0.16;
  p.applyCamera();
  const naar = new THREE.Vector3(mens.x - van.x, 1.2 - 1.6, mens.z - van.z).normalize();
  p.shootCb(van, naar);
  /*
   En daarna erop neerkijken. Hij valt om, dus vanaf ooghoogte recht vooruit
   kijk je over hem heen: de plas ligt op de grond en die zie je alleen als de
   camera een stuk omlaag staat.
  */
  p.pos.set(mens.x + 2.6, 0, mens.z - 2.6);
  p.yaw = Math.atan2(-(mens.x - p.pos.x), -(mens.z - p.pos.z));
  p.pitch = -0.52;
  p.applyCamera();
  return { x: mens.x, z: mens.z, neer: !mens.alive };
});
if (bloed) {
  console.log(`bloed bij (${bloed.x.toFixed(0)}, ${bloed.z.toFixed(0)})${bloed.neer ? ', neer' : ' — MIS'}`);
  await foto('bloed', 260);
  // en anderhalve seconde later: de spat is weg, de plas ligt er
  await foto('bloed_plas', 1400);
  const na = await page.evaluate(() => {
    const g = window.__game;
    return { cam: [ +g.camera.position.x.toFixed(1), +g.camera.position.z.toFixed(1) ],
      speler: [ +g.player.pos.x.toFixed(1), +g.player.pos.z.toFixed(1) ], derde: !!(g.derde && g.derde.aan) };
  });
  console.log('  camera na de foto:', JSON.stringify(na));
}

await browser.close();
