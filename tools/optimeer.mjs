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

     En de schaduwpas moet er ook echt zijn: js/main.js zet `autoUpdate` uit en
     vraagt hem om het andere beeld aan met `needsUpdate`. Deze meting zette dat
     niet, dus de schaduw kostte hier altijd nul (ronde van 25 sep 2026).
    */
    const R = g.renderer;
    const meet = () => {
      R.info.autoReset = false; R.info.reset(); R.shadowMap.needsUpdate = true;
      R.render(g.scene, g.camera);
      const alles = { calls: R.info.render.calls, tris: R.info.render.triangles };
      R.info.autoReset = true; R.shadowMap.needsUpdate = false;
      R.render(g.scene, g.camera);
      return { alles, beeld: { calls: R.info.render.calls, tris: R.info.render.triangles } };
    };
    const nu = meet(), alles = nu.alles, beeld = nu.beeld;

    /*
     Per soort, zonder vaste lijst: de oude lijst herkende bomen en struiken aan
     hun geometrie (IcosahedronGeometry, SphereGeometry), en sinds js/groen.js
     vielen die er allemaal buiten. Nu de `klasse`, anders de stapel of de soort
     geometrie, zodat er niets buiten de telling valt.
    */
    const npc = new Set(Object.values(g.npcs.meshes || {}));
    const soortVan = (o) => o.userData.klasse || (o.userData.autoStapel ? 'geparkeerde auto' : null)
      || (npc.has(o) ? 'voetganger' : null) || (o.parent && o.parent.userData && o.parent.userData.klasse)
      || `${o.isInstancedMesh ? 'inst ' : ''}${o.geometry.type}`;
    const zichtbaar = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
    const groepen = new Map();
    g.scene.traverse(o => {
      if (!o.isMesh || !zichtbaar(o)) return;
      const k = soortVan(o);
      if (!groepen.has(k)) groepen.set(k, []);
      groepen.get(k).push(o);
    });
    /*
     Eén keer tekenen en per tekenopdracht bijhouden wat hij kostte: na elke
     opdracht (`onAfterRender`, en `onAfterShadow` in de schaduwpas) is het
     verschil in `renderer.info` wat dát object tekende. Eerst werd elke soort
     uitgezet en het beeld opnieuw getekend, twee keer per soort, en met een paar
     honderd soorten duurde één plek zo een uur.
    */
    const telling = new Map();
    let laatste = { tris: 0, calls: 0 };
    const tel = (o, schaduw) => {
      const nu = { tris: R.info.render.triangles, calls: R.info.render.calls };
      const k = o.userData._soort;
      if (!telling.has(k)) telling.set(k, { wat: k, tris: 0, calls: 0, schaduw: 0, objecten: new Set() });
      const t = telling.get(k);
      const dt = nu.tris - laatste.tris;
      if (schaduw) t.schaduw += dt; else t.tris += dt;
      t.calls += nu.calls - laatste.calls;
      t.objecten.add(o);
      laatste = nu;
    };
    const oud = [];
    for (const [wat, objecten] of groepen) for (const o of objecten) {
      o.userData._soort = wat;
      oud.push([o, o.onAfterRender, o.onAfterShadow]);
      const r0 = o.onAfterRender, s0 = o.onAfterShadow;
      o.onAfterRender = function (...a) { r0.apply(this, a); tel(this, false); };
      o.onAfterShadow = function (...a) { s0.apply(this, a); tel(this, true); };
    }
    R.info.autoReset = false; R.info.reset(); R.shadowMap.needsUpdate = true;
    R.render(g.scene, g.camera);
    for (const [o, r0, s0] of oud) { o.onAfterRender = r0; o.onAfterShadow = s0; delete o.userData._soort; }
    const lijst = [...telling.values()].map(t => ({ wat: t.wat, tris: t.tris + t.schaduw, schaduw: t.schaduw, calls: t.calls, objecten: t.objecten.size }));
    R.info.autoReset = true;
    lijst.sort((a, b) => b.tris - a.tris);
    return { beeld, alles, lijst: lijst.slice(0, 28) };
  }, { px, pz, yaw, WEEG });

  console.log(`\n=== ${naam} ===`);
  console.log(`  beeldpas                  : ${String(r.beeld.calls).padStart(5)} calls, ${r.beeld.tris.toLocaleString('nl-NL').padStart(10)} driehoeken`);
  console.log(`  beeldpas + schaduwpas     : ${String(r.alles.calls).padStart(5)} calls, ${r.alles.tris.toLocaleString('nl-NL').padStart(10)} driehoeken`);
  console.log(`  de schaduw kost dus       : ${String(r.alles.calls - r.beeld.calls).padStart(5)} calls, ${(r.alles.tris - r.beeld.tris).toLocaleString('nl-NL').padStart(10)} driehoeken`);
  console.log('  wat elke soort kost (uitgezet en opnieuw getekend, beide passen; de schaduw apart):');
  console.log(`    ${'wat'.padEnd(26)} ${'calls'.padStart(6)} ${'driehoeken'.padStart(11)} ${'schaduw'.padStart(10)} ${'meshes'.padStart(7)}`);
  for (const e of r.lijst) {
    if (!e.tris && !e.calls) continue;
    console.log(`    ${String(e.wat).slice(0, 26).padEnd(26)} ${String(e.calls).padStart(6)} ${e.tris.toLocaleString('nl-NL').padStart(11)} ${e.schaduw.toLocaleString('nl-NL').padStart(10)} ${String(e.objecten).padStart(7)}`);
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
  t('world.updateLOD', () => W.updateLOD(g.camera.position.x, g.camera.position.z));
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
