/*
 Foto's van de nieuwe modellen van No Mercy 5 (stap 142, npm run stafautoshots): alleen js/nomercy5.js op een lege
 pagina, met een eigen zon, lucht en grond, dus in een paar seconden. In docs/screenshots/:

   nomercy5_stafauto.png         de stafauto schuin van voren: de kap met het reservewiel, de ruit, de lampen, het Notek
   nomercy5_stafauto_achter.png  schuin van achteren: het motordeksel met de koelsleuven, de kap, de jerrycan, het kenteken
   nomercy5_zijspan.png          het zijspan met de twee mannen: de boxermotor, de spaakwielen, de MG op de kuip
*/
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const poort = process.argv[2] || '8123';
// (stap 143: resolutie en map instelbaar, voor de foto's van het boekje)
const B = +(process.env.SHOT_B || 1280), H = +(process.env.SHOT_H || 720);
const map = process.env.SHOT_MAP || process.argv[3] || 'docs/screenshots';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: B, height: H } });
let fouten = 0;
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/stafautobank`, { waitUntil: 'load', timeout: 120000 });
await page.setContent(`<!doctype html><html><head><style>body{margin:0}</style>
<script type="importmap">{ "imports": { "three": "/lib/three.module.js" } }</script></head><body>
<script type="module">
  import * as THREE from 'three';
  import * as N from '/js/nomercy5.js';
  import { maakDuitser } from '/js/nomercy.js';
  const R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  R.setSize(${B}, ${H}); R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
  document.body.appendChild(R.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fb4c4);
  scene.add(new THREE.HemisphereLight(0xdfe8f0, 0x5a5440, 1.4));
  const zon = new THREE.DirectionalLight(0xfff2dc, 2.4);
  zon.position.set(-6, 9, -4); zon.castShadow = true; zon.shadow.mapSize.set(2048, 2048);
  Object.assign(zon.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
  scene.add(zon);
  const grond = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x6d6a58, roughness: 0.95 }));
  grond.rotation.x = -Math.PI / 2; grond.receiveShadow = true; scene.add(grond);
  const cam = new THREE.PerspectiveCamera(38, ${B} / ${H}, 0.05, 100);
  const schaduw = (o) => o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  window.__t = { THREE, N, maakDuitser, R, scene, cam, schaduw };
</script></body></html>`);
await page.waitForFunction(() => window.__t, null, { timeout: 120000 });

const opname = async (naam, code) => {
  const data = await page.evaluate(new Function(code));
  writeFileSync(`${map}/${naam}.png`, Buffer.from(data.split(',')[1], 'base64'));
  console.log(`${map}/${naam}.png`);
};
const foto = `(van, naar) => {
  const { R, scene, cam } = window.__t;
  cam.position.set(van[0], van[1], van[2]); cam.lookAt(naar[0], naar[1], naar[2]);
  R.render(scene, cam); R.render(scene, cam);
  return R.domElement.toDataURL('image/png');
}`;

await page.evaluate(() => {
  const { N, scene, schaduw } = window.__t;
  window.__staf = N.maakStafauto(); schaduw(window.__staf); scene.add(window.__staf);
});
await opname('nomercy5_stafauto', `return (${foto})([-4.2, 1.9, -4.6], [0, 0.75, -0.2]);`);
await opname('nomercy5_stafauto_achter', `return (${foto})([3.8, 2.2, 4.4], [0, 0.8, 0.3]);`);
await opname('nomercy5_zijspan', `
  const { N, scene, schaduw, maakDuitser } = window.__t;
  scene.remove(window.__staf);
  const m = N.maakZijspan(maakDuitser(5), maakDuitser(7));
  m.mesh.visible = true; schaduw(m.mesh); scene.add(m.mesh);
  if (m.rijder.wapen) m.rijder.wapen.visible = false;
  m.bijrijder.vasteGrond = 0;
  for (let i = 0; i < 30; i++) { m.rijder.opScooter(0.05, m.zit.position); m.bijrijder.update(0.05, { zit: 0.3, mikt: true }); }
  return (${foto})([-2.6, 1.6, -3.0], [0.5, 0.6, 0]);
`);

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);
