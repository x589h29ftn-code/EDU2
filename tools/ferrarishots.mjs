/*
 Foto's van de Ferrari zelf, los van de wereld (js/carmodel.js, `sportGeoms`):

   ferrari_voor.png    schuin van voren: de neus, de koplampen, de splitter
   ferrari_achter.png  schuin van achteren: de vleugel, de ronde lichten, de uitlaten
   ferrari_zij.png     van opzij: het profiel, de wielkasten, de luchthapper

 Laadt alleen het model, dus snel (zoals tools/autoechttest.mjs).
 Gebruik: npm run server &   node tools/ferrarishots.mjs 8123 [map] [kleur]
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const poort = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
const kleur = process.argv[4] || '0xc40a12';
mkdirSync(map, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1100, height: 620 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('[console]', m.text()); });
await page.goto(`http://127.0.0.1:${poort}/autobank`, { waitUntil: 'load', timeout: 120000 });
await page.setContent(`<!doctype html><html><head><style>body{margin:0;background:#000}</style>
<script type="importmap">{ "imports": { "three": "/lib/three.module.js" } }</script></head><body>
<script type="module">
  import * as THREE from 'three';
  import * as C from '/js/carmodel.js';
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setSize(1100, 620); r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
  r.shadowMap.enabled = true;
  document.body.appendChild(r.domElement);
  const scene = new THREE.Scene();
  // een lucht om in te spiegelen: blauw boven, licht aan de horizon, donker onder
  const lucht = new THREE.Scene();
  const bol = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide,
    vertexShader: 'varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'varying vec3 p; void main(){ float h = normalize(p).y; vec3 c = h > 0. ? mix(vec3(0.85,0.9,0.95), vec3(0.25,0.45,0.8), pow(h,0.6)) : mix(vec3(0.5,0.5,0.48), vec3(0.12), -h); gl_FragColor = vec4(c,1.); }' }));
  lucht.add(bol);
  const pm = new THREE.PMREMGenerator(r);
  scene.environment = pm.fromScene(lucht, 0.02).texture;
  scene.background = new THREE.Color(0x9fb7cf);
  scene.add(new THREE.HemisphereLight(0xdfe9f5, 0x5a5a50, 0.9));
  const zon = new THREE.DirectionalLight(0xffffff, 2.2); zon.position.set(6, 9, 4); zon.castShadow = true;
  zon.shadow.mapSize.set(2048, 2048); Object.assign(zon.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 });
  scene.add(zon);
  const vloer = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.85 }));
  vloer.rotation.x = -Math.PI / 2; vloer.receiveShadow = true; scene.add(vloer);
  const auto = C.makeCar(${kleur}, 'ferrari', true);
  auto.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(auto);
  const cam = new THREE.PerspectiveCamera(34, 1100 / 620, 0.1, 100);
  window.__foto = (x, y, z, ky = 0.55) => { cam.position.set(x, y, z); cam.lookAt(0, ky, 0); r.render(scene, cam); };
  window.__t = { THREE, C, auto };
</script></body></html>`);
await page.waitForFunction(() => window.__t, null, { timeout: 120000 });
const maat = await page.evaluate(() => {
  const { THREE, auto } = window.__t;
  const b = new THREE.Box3().setFromObject(auto);
  let driehoeken = 0;
  auto.traverse(o => { if (o.isMesh) driehoeken += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  return { lengte: +(b.max.z - b.min.z).toFixed(2), breedte: +(b.max.x - b.min.x).toFixed(2), hoogte: +b.max.y.toFixed(2), driehoeken: Math.round(driehoeken) };
});
console.log(JSON.stringify(maat));
for (const [naam, x, y, z] of [['ferrari_voor', -4.6, 1.5, -5.4], ['ferrari_achter', 4.4, 1.9, 5.6], ['ferrari_zij', -7.2, 0.9, 0.2]]) {
  await page.evaluate(({ x, y, z }) => window.__foto(x, y, z), { x, y, z });
  await page.screenshot({ path: `${map}/${naam}.png` });
  console.log(`${map}/${naam}.png`);
}
await browser.close();
