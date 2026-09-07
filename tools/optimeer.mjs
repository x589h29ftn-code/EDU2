/*
 Waar gaat het geld heen? Dit gereedschap splitst de drie dure dingen uit naar
 hun oorzaak, zodat een optimalisatieronde niet op gevoel begint:

   1. driehoeken en draw calls **per klasse** op een paar standpunten. `renderer.info`
      geeft één totaal; hier wordt de frustumtest van three nagedaan (dezelfde
      `frustumCulled`-regel en dezelfde bounding sphere) en per `userData.klasse`
      geteld. De uitkomst hoort dicht bij `renderer.info` te liggen — dat wordt
      erbij gemeld, zodat je ziet of de nabootsing klopt.
   2. wat de **schaduwpas** kost. Let op: `renderer.info` telt die *niet* mee.
      In r160 staat `info.reset()` in `WebGLRenderer.render()` een paar regels
      ná `shadowMap.render()` (lib/three.module.js:29594 en :29600), dus alles
      wat de schaduwkaart tekent wordt meteen weer op nul gezet. Elk getal dat
      `audit.mjs` ooit gemeld heeft is dus alleen de beeldpas. Hier wordt
      `info.autoReset` uitgezet en zelf gereset, en dan komt de schaduwpas er
      wel bij; het verschil tussen die twee is precies wat de schaduw kost.
   3. de **javascripttijd**, fijner dan `audit.mjs`: de minikaart apart van de
      rest van de hud, en de lussen van de wereld erbij.

 Gebruik: python3 -m http.server 8123 &  node tools/optimeer.mjs 8123
*/
import { chromium } from 'playwright';

const port = process.argv[2] || '8123';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
let bouwtijd = '';
page.on('console', m => { if (m.text().startsWith('Wereld gebouwd')) bouwtijd = m.text(); });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });
console.log(bouwtijd);
await page.evaluate(() => {
  document.getElementById('overlay').style.display = 'none';
  window.__autoplay = false;
  window.__game.player.active = false;
});
await page.evaluate(async () => { window.__THREE = await import('/lib/three.module.js'); });

const PLEKKEN = [
  ['Molenkrite begin', 10, -7, -0.88],
  ['Jasker knoop', 0, 0, -0.5],
  ['Bonkelaar', 132, 173, 1.6],
  ['sportpark Molenkrite', 555, -64, -0.62],
];

// ---------- 1 + 2. per klasse, en wat de schaduw kost ----------
for (const [naam, px, pz, yaw] of PLEKKEN) {
  const r = await page.evaluate(({ px, pz, yaw }) => {
    const THREE = window.__THREE;
    const g = window.__game;
    g.player.inCar = null;
    g.player.pos.set(px, 0, pz);
    g.player.yaw = yaw; g.player.pitch = 0;
    g.player.applyCamera();
    g.camera.updateMatrixWorld(true);
    g.vehicles.lod(g.camera.position.x, g.camera.position.z);
    // de zon meeverhuizen zoals de hoofdlus doet (js/main.js:719), anders blijft
    // de schaduwdoos staan waar hij stond en meet je overal dezelfde schaduwpas
    const zon = g.scene.children.find(c => c.isDirectionalLight && c.castShadow);
    if (zon) {
      // de richting van de zon houden zoals hij staat, alleen de doos verplaatsen
      const dx = zon.position.x - zon.target.position.x;
      const dy = zon.position.y - zon.target.position.y;
      const dz = zon.position.z - zon.target.position.z;
      const cx = g.camera.position.x, cz = g.camera.position.z;
      zon.target.position.set(cx, 0, cz); zon.target.updateMatrixWorld();
      zon.position.set(cx + dx, dy, cz + dz); zon.updateMatrixWorld();
    }

    // alleen de beeldpas: zo telt three zelf, want hij reset na de schaduwpas
    g.renderer.render(g.scene, g.camera);
    const beeld = { calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles };

    // en nu allebei: zelf resetten vóór het tekenen in plaats van three erna
    g.renderer.info.autoReset = false;
    g.renderer.info.reset();
    g.renderer.render(g.scene, g.camera);
    const alles = { calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles };
    g.renderer.info.autoReset = true;

    // de frustumtest van three nadoen en per klasse tellen
    const frustum = new THREE.Frustum();
    frustum.setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(g.camera.projectionMatrix, g.camera.matrixWorldInverse));
    const bol = new THREE.Sphere();
    const per = new Map();
    const tel = (k, tris, calls, objecten) => {
      const e = per.get(k) || { tris: 0, calls: 0, objecten: 0 };
      e.tris += tris; e.calls += calls; e.objecten += objecten; per.set(k, e);
    };
    let zichtbaar = 0;
    g.scene.traverse(o => {
      if (!o.visible || !o.isMesh && !o.isInstancedMesh && !o.isLine && !o.isPoints) return;
      // een onzichtbare ouder telt niet mee
      for (let p = o.parent; p; p = p.parent) if (!p.visible) return;
      const geo = o.geometry;
      if (!geo) return;
      if (o.frustumCulled) {
        if (!geo.boundingSphere) geo.computeBoundingSphere();
        bol.copy(geo.boundingSphere).applyMatrix4(o.matrixWorld);
        if (!frustum.intersectsSphere(bol)) return;
      }
      const index = geo.index ? geo.index.count : (geo.attributes.position ? geo.attributes.position.count : 0);
      let tris = index / 3;
      if (o.isInstancedMesh) tris *= o.count;
      if (o.isLine || o.isPoints) tris = 0;
      // een instanced mesh zonder klasse is aan zijn materiaal te herkennen
      const klasse = o.userData.klasse || o.name
        || (o.isInstancedMesh ? `inst:${(o.material && o.material.name) || o.geometry.userData.naam || o.geometry.type}` : 'onbenoemd');
      tel(klasse, tris, 1, 1);
      zichtbaar++;
    });
    const lijst = [...per.entries()].map(([k, e]) => ({ klasse: k, ...e, tris: Math.round(e.tris) }))
      .sort((a, b) => b.tris - a.tris);
    const som = lijst.reduce((n, e) => n + e.tris, 0);
    return { beeld, alles, lijst, som, zichtbaar };
  }, { px, pz, yaw });

  console.log(`\n=== ${naam} ===`);
  console.log(`  beeldpas (wat audit meldt): ${String(r.beeld.calls).padStart(5)} calls, ${r.beeld.tris.toLocaleString('nl-NL').padStart(10)} driehoeken`);
  console.log(`  beeldpas + schaduwpas     : ${String(r.alles.calls).padStart(5)} calls, ${r.alles.tris.toLocaleString('nl-NL').padStart(10)} driehoeken`);
  console.log(`  de schaduw kost dus       : ${String(r.alles.calls - r.beeld.calls).padStart(5)} calls, ${(r.alles.tris - r.beeld.tris).toLocaleString('nl-NL').padStart(10)} driehoeken`);
  console.log(`  nagebootst in de frustum  : ${r.zichtbaar} objecten, ${r.som.toLocaleString('nl-NL')} driehoeken`);
  console.log('  de tien zwaarste klassen:');
  for (const e of r.lijst.slice(0, 10)) {
    console.log(`    ${String(e.klasse).padEnd(18)} ${String(e.tris.toLocaleString('nl-NL')).padStart(11)} driehoeken  ${String(e.objecten).padStart(4)} objecten`);
  }
}

// ---------- 3. javascript per beeld, fijner ----------
const cpu = await page.evaluate(async () => {
  const g = window.__game;
  const W = await import('/js/world.js');
  g.player.pos.set(10, 0, -7); g.player.yaw = -0.88; g.player.applyCamera();
  const n = 40, meet = {};
  const t = (naam, fn) => {
    fn(); // een keer warmdraaien
    const a = performance.now();
    for (let i = 0; i < n; i++) fn();
    meet[naam] = +((performance.now() - a) / n).toFixed(3);
  };
  t('npcs.update', () => g.npcs.update(0.016, performance.now() / 1000));
  t('vehicles.updateTraffic', () => g.vehicles.updateTraffic(0.016));
  t('vehicles.lod', () => g.vehicles.lod(g.player.pos.x, g.player.pos.z));
  t('player.update', () => g.player.update(0.016));
  t('hud.drawMap', () => g.hud.drawMap(g.player, g.vehicles, g.npcs));
  t('hud.update (alles)', () => g.hud.update(0.016, g.player, g.vehicles, g.npcs, 'Molenkrite'));
  t('world.updateProps', () => W.updateProps(0.016, performance.now() / 1000));
  t('world.updateLOD', () => W.updateLOD(g.camera));
  t('resolveCollisions', () => W.resolveCollisions(g.player.pos, 0.35));
  return meet;
});
console.log('\n=== javascript per beeld (ms) ===');
for (const [k, v] of Object.entries(cpu)) console.log(' ', k.padEnd(26), String(v).padStart(7));

// ---------- hoeveel werk staat er in de lussen? ----------
const tellingen = await page.evaluate(async () => {
  const g = window.__game;
  const W = await import('/js/world.js');
  return {
    autos: g.vehicles.cars.length,
    mensen: g.npcs.people.length,
    colliders: W.colliders.length,
    labels: (g.hud.labels || []).length,
    kinderenVanScene: g.scene.children.length,
  };
});
console.log('\n=== hoeveel werk staat er in de lussen ===');
for (const [k, v] of Object.entries(tellingen)) console.log(' ', k.padEnd(20), v);

await browser.close();
