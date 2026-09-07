// Meet de motor door: draw calls, driehoeken, texturegeheugen, objecten in de
// scene, laadtijd en de tijd die JavaScript per beeld kost.
// Gebruik: node tools/audit.mjs [poort] [zoekreeks]
//
// De zoekreeks gaat achter index.html, zodat je twee standen naast elkaar kunt
// meten: `node tools/audit.mjs 8123 '?relief=0'` laat het reliëf weg.
import { chromium } from 'playwright';

const port = process.argv[2] || '8123';
const vraag = process.argv[3] || '';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
let bouwtijd = '';
page.on('console', m => { if (m.text().startsWith('Wereld gebouwd')) bouwtijd = m.text(); });
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${port}/index.html${vraag}`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });
console.log(`laadtijd tot speelbaar: ${Date.now() - t0} ms`);
console.log(bouwtijd);
await page.evaluate(() => { window.__autoplay = true; document.getElementById('overlay').style.display = 'none'; });
await page.waitForTimeout(1200);

const alg = await page.evaluate(() => {
  const g = window.__game;
  let meshes = 0, groepen = 0, instanced = 0, verts = 0, geos = new Set(), mats = new Set(), texs = new Set();
  g.scene.traverse(o => {
    if (o.isInstancedMesh) instanced++;
    else if (o.isMesh) meshes++;
    if (o.isGroup) groepen++;
    if (o.geometry) { geos.add(o.geometry); verts += o.geometry.attributes.position ? o.geometry.attributes.position.count : 0; }
    const ms = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    for (const m of ms) { mats.add(m); for (const k of ['map', 'normalMap', 'roughnessMap']) if (m[k]) texs.add(m[k]); }
  });
  // Een kloon van een texture deelt wel het plaatje maar krijgt op de kaart
  // een eigen kopie. Tel daarom zowel per texture-object als per uniek plaatje.
  let texBytes = 0;
  const perImage = new Map();
  for (const t of texs) {
    const im = t.image;
    if (!im || !im.width) continue;
    const b = im.width * im.height * 4 * 1.33;
    texBytes += b;
    const k = `${im.width}x${im.height}`;
    const e = perImage.get(im) || { n: 0, maat: k, bytes: b };
    e.n++; perImage.set(im, e);
  }
  let unieke = 0;
  const top = [];
  for (const [, e] of perImage) { unieke += e.bytes; top.push(e); }
  top.sort((a, b) => b.n * b.bytes - a.n * a.bytes);
  const grootverbruik = top.slice(0, 8).map(e => `${e.maat} x${e.n} = ${(e.n * e.bytes / 1048576).toFixed(0)} MB`);
  return {
    kinderenVanScene: g.scene.children.length,
    meshes, instanced, groepen,
    unieke_geometrieen: geos.size, unieke_materialen: mats.size, unieke_textures: texs.size,
    hoekpunten: verts,
    texturegeheugen_MB: +(texBytes / 1048576).toFixed(1),
    unieke_plaatjes: perImage.size,
    zonder_klonen_MB: +(unieke / 1048576).toFixed(1),
    grootverbruikers: grootverbruik,
    renderer_geheugen: { ...g.renderer.info.memory },
    programmas: g.renderer.info.programs ? g.renderer.info.programs.length : 0,
    schaduwkaart: g.scene.children.filter(c => c.isDirectionalLight && c.castShadow).map(l => l.shadow.mapSize.width + 'x' + l.shadow.mapSize.height),
  };
});
console.log('\n--- scene ---');
for (const [k, v] of Object.entries(alg)) console.log(' ', k.padEnd(22), JSON.stringify(v));

/*
 Draw calls op een paar plekken. Let op `applyCamera`: zonder die regel bleef de
 camera staan waar hij stond en gaf elke plek exact hetzelfde getal — dan meet je
 niet wat er vanaf die plek getekend wordt maar één keer hetzelfde beeld.
 De plekken staan in spelmeters vanaf het kruispunt Molenkrite/Monnikmolen/Jasker.
*/
const plekken = [
  ['Molenkrite begin', 10, -7, -0.88],
  ['De Wieken midden', -58, 61, 1.44],
  ['Jasker knoop', 0, 0, -0.5],
  ['Bonkelaar', 132, 173, 1.6],
  ['sportpark Molenkrite', 555, -64, -0.62],
  ['Lemmerweg oost', 1500, 500, 2.4],
  ['IJlst centrum', -1800, 1100, 0.8],
  ['polder ertussen', -900, 700, 1.2],
];
console.log('\n--- draw calls per plek ---');
// de hoofdlus uit: met autoplay aan rijdt de speler zelf weg en meet je telkens
// dezelfde plek in plaats van de acht hieronder
await page.evaluate(() => { window.__autoplay = false; window.__game.player.active = false; });
for (const [naam, px, pz, yaw] of plekken) {
  await page.evaluate(({ px, pz, yaw }) => {
    const g = window.__game;
    g.player.inCar = null;
    g.player.pos.set(px, 0, pz);
    g.player.yaw = yaw; g.player.pitch = 0;
    g.player.applyCamera();
  }, { px, pz, yaw });
  /*
   Zelf één beeld tekenen en de teller daaromheen op nul zetten. Met de hoofdlus
   uit tekent het spel niets meer, en dan bleef `renderer.info` staan op het
   laatste beeld van dáárvoor — elke plek gaf dan hetzelfde getal.
  */
  const r = await page.evaluate(() => {
    const g = window.__game;
    g.camera.updateMatrixWorld(true);
    g.vehicles.lod(g.camera.position.x, g.camera.position.z);
    g.renderer.info.reset();
    g.renderer.render(g.scene, g.camera);
    return { calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles };
  });
  console.log(' ', naam.padEnd(22), String(r.calls).padStart(5), 'calls', String(r.tris).padStart(9), 'driehoeken');
}

// hoeveel tijd kost het javascript per beeld (los van het tekenen)
const cpu = await page.evaluate(async () => {
  const g = window.__game;
  const n = 40;
  const meet = {};
  const t = (naam, fn) => { const a = performance.now(); for (let i = 0; i < n; i++) fn(); meet[naam] = +((performance.now() - a) / n).toFixed(3); };
  t('npcs.update', () => g.npcs.update(0.016, performance.now() / 1000));
  t('vehicles.updateTraffic', () => g.vehicles.updateTraffic(0.016));
  t('player.update', () => g.player.update(0.016));
  t('hud.update', () => g.hud.update(0.016, g.player, g.vehicles, g.npcs, 'Molenkrite'));
  return meet;
});
console.log('\n--- javascript per beeld (ms) ---');
for (const [k, v] of Object.entries(cpu)) console.log(' ', k.padEnd(24), v);
console.log('  som'.padEnd(26), +Object.values(cpu).reduce((a, b) => a + b, 0).toFixed(3));

// wat ontbreekt er nog?
const ontbreekt = await page.evaluate(() => ({
  geluid: typeof window.AudioContext !== 'undefined' && !document.querySelector('audio') && !window.__geluid,
  aantalAutos: window.__game.vehicles.cars.length,
  aantalMensen: window.__game.npcs.people.length,
  fogVer: window.__game.scene.fog ? window.__game.scene.fog.far : null,
  schaduwVer: 340,
  pixelRatio: window.__game.renderer.getPixelRatio(),
}));
console.log('\n--- wereld ---');
for (const [k, v] of Object.entries(ontbreekt)) console.log(' ', k.padEnd(22), JSON.stringify(v));

await browser.close();
