/*
 Waar gaat het geld heen? Dit gereedschap splitst de drie dure dingen uit naar
 hun oorzaak, zodat een optimalisatieronde niet op gevoel begint:

   1. driehoeken en draw calls **per klasse**, exact gemeten: een klasse wordt
      uitgezet, het beeld opnieuw getekend, en het verschil is wat die klasse
      kost. Een frustumtest nabootsen leverde getallen op die tot veertig
      procent van `renderer.info` afweken (bij instanced meshes gebruikt three
      een andere omhullende), dus dat is vervangen door dit.
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
await page.evaluate(async () => { window.__W = await import('/js/world.js'); });

const PLEKKEN = [
  ['Molenkrite begin', 10, -7, -0.88],
  ['Jasker knoop', 0, 0, -0.5],
  ['Bonkelaar', 132, 173, 1.6],
  ['sportpark Molenkrite', 555, -64, -0.62],
];

// ---------- 1 + 2. per klasse, en wat de schaduw kost ----------
/*
 De klassen die het waard zijn om apart te wegen. `klasse` staat in
 `userData.klasse` (js/kaartwereld.js en js/world.js zetten hem); de instanced
 meshes van de bomen, struiken en geparkeerde auto's hebben er geen, dus die
 worden aan hun geometrie herkend.
*/
const WEEG = [
  ['boomkronen', 'geo:IcosahedronGeometry'],
  ['boomstammen', 'geo:CylinderGeometry'],
  ['struiken', 'geo:SphereGeometry'],
  ['geparkeerde autos', 'inst-overig'],
  ['riet', 'klasse:riet'],
  ['stoepbanden', 'klasse:rand'],
  ['muren', 'klasse:muur'],
  ['daken', 'klasse:dak'],
  ['platte daken', 'klasse:platdak'],
  ['dakkapellen', 'klasse:dakkapel'],
  ['schuttingen', 'klasse:schutting'],
  ['heggen', 'klasse:heg'],
  ['gevels', 'klasse:voorgevel,achtergevel'],
  ['bermen', 'klasse:berm'],
  ['voetpaden', 'klasse:voetpad'],
  ['hekjes', 'klasse:hekje'],
  ['tegelpaden', 'klasse:tegelpad'],
  ['grindtuinen', 'klasse:grindtuin'],
  ['tegeltuinen', 'klasse:tegeltuin'],
  ['belijning', 'klasse:belijning'],
  ['hagen', 'klasse:haag'],
  ['drempels', 'klasse:drempel'],
  ['oeverwanden', 'klasse:oeverwand'],
  ['oevers', 'klasse:oever'],
  ['erven', 'klasse:erf'],
  ['gras', 'klasse:gras'],
  ['parkeervlakken', 'klasse:parkeervlak'],
  ['water', 'klasse:water'],
];

for (const [naam, px, pz, yaw] of PLEKKEN) {
  const r = await page.evaluate(({ px, pz, yaw, WEEG }) => {
    const g = window.__game;
    g.player.inCar = null;
    g.player.pos.set(px, 0, pz);
    g.player.yaw = yaw; g.player.pitch = 0;
    g.player.applyCamera();
    g.camera.updateMatrixWorld(true);
    g.vehicles.lod(g.camera.position.x, g.camera.position.z);
    // ook de afstandstegels bijwerken, zoals de hoofdlus doet (js/main.js:728).
    // Zonder dit staat alles wat `lodAan` heeft aangemeld nog op zijn
    // beginstand — en dan tekenen de fijne én de grove boomkroon tegelijk.
    window.__W.updateLOD(g.camera.position.x, g.camera.position.z);
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

    /*
     Alles tellen, dus ook de schaduwpas: `info.autoReset` uit en zelf resetten
     vóór het tekenen. Three reset zelf een paar regels ná `shadowMap.render()`
     (lib/three.module.js:29594 en :29600), dus met de standaardinstelling valt
     de schaduw buiten de telling.
    */
    g.renderer.info.autoReset = false;
    const meet = () => {
      g.renderer.info.reset();
      g.renderer.render(g.scene, g.camera);
      return { calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles };
    };
    // en de beeldpas apart, zoals three zelf telt
    g.renderer.info.autoReset = true;
    g.renderer.render(g.scene, g.camera);
    const beeld = { calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles };
    g.renderer.info.autoReset = false;

    const alles = meet();

    // welke objecten horen bij een keuze?
    const kies = (sleutel) => {
      const uit = [];
      g.scene.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return;
        if (sleutel.startsWith('klasse:')) {
          const namen = sleutel.slice(7).split(',');
          if (namen.includes(o.userData.klasse)) uit.push(o);
        } else if (sleutel.startsWith('geo:')) {
          if (o.isInstancedMesh && o.geometry.type === sleutel.slice(4)) uit.push(o);
        } else if (sleutel === 'inst-overig') {
          if (o.isInstancedMesh && !['IcosahedronGeometry', 'CylinderGeometry', 'SphereGeometry'].includes(o.geometry.type)) uit.push(o);
        }
      });
      return uit;
    };

    const lijst = [];
    for (const [wat, sleutel] of WEEG) {
      const objecten = kies(sleutel).filter(o => o.visible);
      if (!objecten.length) { lijst.push({ wat, objecten: 0, calls: 0, tris: 0 }); continue; }
      for (const o of objecten) o.visible = false;
      const zonder = meet();
      for (const o of objecten) o.visible = true;
      lijst.push({ wat, objecten: objecten.length, calls: alles.calls - zonder.calls, tris: alles.tris - zonder.tris });
    }
    g.renderer.info.autoReset = true;
    lijst.sort((a, b) => b.tris - a.tris);
    return { beeld, alles, lijst };
  }, { px, pz, yaw, WEEG });

  console.log(`\n=== ${naam} ===`);
  console.log(`  beeldpas                  : ${String(r.beeld.calls).padStart(5)} calls, ${r.beeld.tris.toLocaleString('nl-NL').padStart(10)} driehoeken`);
  console.log(`  beeldpas + schaduwpas     : ${String(r.alles.calls).padStart(5)} calls, ${r.alles.tris.toLocaleString('nl-NL').padStart(10)} driehoeken`);
  console.log(`  de schaduw kost dus       : ${String(r.alles.calls - r.beeld.calls).padStart(5)} calls, ${(r.alles.tris - r.beeld.tris).toLocaleString('nl-NL').padStart(10)} driehoeken`);
  console.log('  wat elke klasse kost (uitgezet en opnieuw getekend, beide passen):');
  console.log(`    ${'wat'.padEnd(20)} ${'calls'.padStart(6)} ${'driehoeken'.padStart(11)} ${'meshes'.padStart(7)}`);
  for (const e of r.lijst) {
    if (!e.tris && !e.calls) continue;
    console.log(`    ${e.wat.padEnd(20)} ${String(e.calls).padStart(6)} ${e.tris.toLocaleString('nl-NL').padStart(11)} ${String(e.objecten).padStart(7)}`);
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
