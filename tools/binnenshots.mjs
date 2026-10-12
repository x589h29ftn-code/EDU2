/*
 Het interieur van elke soort auto, uit de ogen van de bestuurder (stap 146): npm run binnenshots.
 Laadt alleen js/carmodel.js (en de vuilniswagen en de stafauto) op een lege pagina, met een eigen zon, lucht en grond.
 In docs/screenshots/: binnen_<soort>.png voor hatch, van, bx, gti, truck, ferrari, ambulance, vuilnis en staf.
*/
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const poort = process.argv[2] || '8123';
const B = +(process.env.SHOT_B || 1280), H = +(process.env.SHOT_H || 720);
const map = process.env.SHOT_MAP || process.argv[3] || 'docs/screenshots';
const BUITEN = !!process.env.BUITEN;   // van buiten, schuin voor (om te zien of de carrosserie niet verandert)
const NACHT = !!process.env.NACHT;     // 's nachts: de scène donker, het dashboard verlicht, een zender op de radio
const alleen = process.env.SOORTEN ? process.env.SOORTEN.split(',') : null;
mkdirSync(map, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: B, height: H } });
page.setDefaultTimeout(600000);
let fouten = 0;
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/binnenbank`, { waitUntil: 'load', timeout: 120000 });
await page.setContent(`<!doctype html><html><head><style>body{margin:0}</style>
<script type="importmap">{ "imports": { "three": "/lib/three.module.js" } }</script></head><body>
<script type="module">
  import * as THREE from 'three';
  import { makeCar } from '/js/carmodel.js';
  import { maakVuilniswagen } from '/js/vuilniswagen.js';
  import { maakStafauto } from '/js/nomercy5.js';
  import { AUTO_KIJK } from '/js/autobinnen.js';
  const R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  R.setSize(${B}, ${H}); R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping;
  document.body.appendChild(R.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fb4c4);
  scene.add(new THREE.HemisphereLight(0xdfe8f0, 0x5a5440, 1.4));
  const zon = new THREE.DirectionalLight(0xfff2dc, 2.2); zon.position.set(-6, 9, -4); scene.add(zon);
  const grond = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x6d6a58, roughness: 0.95 }));
  grond.rotation.x = -Math.PI / 2; scene.add(grond);
  // een paar paaltjes vóór de auto, zodat je ziet waar je heen kijkt
  for (let i = 0; i < 8; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1, 0.15), new THREE.MeshStandardMaterial({ color: 0xb04020 })); p.position.set(-6 + i * 1.7, 0.5, -14); scene.add(p); }
  const cam = new THREE.PerspectiveCamera(70, ${B} / ${H}, 0.03, 300);
  window.__t = { THREE, R, scene, cam, makeCar, maakVuilniswagen, maakStafauto, AUTO_KIJK };
</script></body></html>`);
await page.waitForFunction(() => window.__t, null, { timeout: 120000 });
if (BUITEN) await page.evaluate(() => { window.__buiten = true; });
if (NACHT) await page.evaluate(() => {
  const { scene } = window.__t; window.__nacht = true;
  scene.background.setHex(0x0b1020);
  scene.traverse(o => { if (o.isLight) o.intensity *= 0.12; });
});

const soorten = ['hatch', 'van', 'bx', 'gti', 'truck', 'ferrari', 'ambulance', 'vuilnis', 'staf'].filter(s => !alleen || alleen.includes(s));
for (const soort of soorten) {
  const uit = await page.evaluate((soort) => {
    const { THREE, R, scene, cam, makeCar, maakVuilniswagen, maakStafauto, AUTO_KIJK } = window.__t;
    const g = soort === 'vuilnis' ? maakVuilniswagen() : soort === 'staf' ? maakStafauto() : makeCar(0x3b6ea8, soort, true);
    const mesh = g.mesh || g;
    scene.add(mesh); mesh.updateMatrixWorld(true);
    const u = mesh.userData;
    const zender = window.__nacht ? { naam: 'Radio Spannenburg', logo: 'spannenburg' } : { naam: 'Radio Tinga', logo: 'tinga' };
    const nummer = { artiest: 'Kali', titel: 'Tinga' };
    if (u.binnen) { u.binnen.groep.visible = true; for (let i = 0; i < 20; i++) u.binnen.update({ steer: 0.15, speed: 13.9, topSnelheid: 30 }, 0.1, { nacht: !!window.__nacht, zender, nummer }); }
    if (u.glas) (Array.isArray(u.glas) ? u.glas : [u.glas]).forEach(gl => { if (gl && gl.isObject3D) gl.visible = false; });
    const o = u.oog || { x: -0.34, y: 1.32, z: -0.87 };
    if (window.__buiten) { if (u.binnen) u.binnen.groep.visible = false; if (u.glas) (Array.isArray(u.glas) ? u.glas : [u.glas]).forEach(gl => { if (gl && gl.isObject3D) gl.visible = true; }); cam.position.set(-4.5, 2.2, -5.5); cam.lookAt(0, 1.1, -0.5); }
    // (stap 150) precies wat je in het spel ziet: recht vooruit, AUTO_KIJK.pitch omlaag, met de beeldhoek van de auto
    else { cam.position.set(o.x, o.y, o.z); cam.rotation.set(AUTO_KIJK.pitch, 0, 0, 'YXZ'); }
    cam.fov = window.__buiten ? 70 : AUTO_KIJK.beeld; cam.updateProjectionMatrix();
    mesh.updateMatrixWorld(true);
    R.render(scene, cam); R.render(scene, cam);
    const url = R.domElement.toDataURL('image/png');
    scene.remove(mesh);
    return { url, binnen: !!u.binnen, oog: o };
  }, soort);
  writeFileSync(`${map}/${BUITEN ? 'buiten' : 'binnen'}_${soort}${NACHT ? '_nacht' : ''}.png`, Buffer.from(uit.url.split(',')[1], 'base64'));
  console.log(`${map}/${BUITEN ? "buiten" : "binnen"}_${soort}${NACHT ? "_nacht" : ""}.png — interieur: ${uit.binnen ? 'ja' : 'nee'}, ogen ${JSON.stringify(uit.oog)}`);
}
await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);
