/*
 Close-ups van een persoon (stap 153, npm run gezichtshots): het gezicht van voren en schuin, en de hand. Laadt alleen
 js/persoon.js op een lege pagina met een eigen zon, dus een paar seconden.

   gezicht_voor.png, gezicht_schuin.png, gezicht_hand.png, gezicht_rij.png (vijf mensen naast elkaar op 4 m),
   gezicht_lijf.png (het hele lichaam schuin van voren), gezicht_achter.png (van achteren)

 Gebruik: npm run server &  node tools/gezichtshots.mjs [poort] [map]
*/
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const poort = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
mkdirSync(map, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
let fouten = 0;
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/x`, { waitUntil: 'load' });
await page.setContent(`<!doctype html><html><head><script type="importmap">{ "imports": { "three": "/lib/three.module.js" } }</script></head><body style="margin:0">
<script type="module">
  import * as THREE from 'three';
  import { Persoon } from '/js/persoon.js';
  const R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  R.setSize(960, 720); R.outputColorSpace = THREE.SRGBColorSpace; document.body.appendChild(R.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x9fb3c2);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b6450, 1.1));
  const zon = new THREE.DirectionalLight(0xfff4e0, 1.8); zon.position.set(-2, 4, -3); scene.add(zon);
  // (stap 154) een gevarieerde rij: mannen en vrouwen, huidskleuren, kapsels, baarden, een rok
  const mensen = [
    new Persoon({ shirt: 0x2a6b3a, huid: 0xf3dcc8, haar: 0xb8945a, vrouw: true, kapsel: 'lang', rok: true, broek: 0x2b2b44 }),
    new Persoon({ shirt: 0x8a2d2d, huid: 0x7a4a2e, haar: 0x111111, korteMouw: true, baard: 'vol' }),
    new Persoon({ shirt: 0x2d4f8a, huid: 0xd9b48f, haar: 0x2a1d12 }),
    new Persoon({ shirt: 0xd8c27a, huid: 0x3f2718, haar: 0x1a120c, vrouw: true, kapsel: 'staart' }),
    new Persoon({ shirt: 0x444444, huid: 0xc89a74, haar: 0x9a9a9a, kapsel: 'kaal', baard: 'stoppels' }),
  ];
  mensen.forEach((p, i) => { p.groep.position.set((i - 2) * 0.75, 0, 0); p.groep.rotation.y = Math.PI; p.update(0.016, {}); scene.add(p.groep); });
  window.__t = { THREE, R, scene, mensen };
</script></body></html>`);
await page.waitForFunction(() => window.__t);
const foto = async (naam, van, naar, fov = 30) => {
  const url = await page.evaluate(([van, naar, fov]) => {
    const { THREE, R, scene } = window.__t;
    const cam = new THREE.PerspectiveCamera(fov, 960 / 720, 0.02, 50);
    cam.position.set(...van); cam.lookAt(...naar);
    R.render(scene, cam); return R.domElement.toDataURL('image/png');
  }, [van, naar, fov]);
  writeFileSync(`${map}/${naam}.png`, Buffer.from(url.split(',')[1], 'base64'));
  console.log(`${map}/${naam}.png`);
};
// de middelste staat op x = 0 en kijkt naar +z (rotation π): de camera staat voor hem
await foto('gezicht_voor', [0, 1.62, 0.75], [0, 1.6, 0], 22);
await foto('gezicht_schuin', [0.5, 1.64, 0.6], [0, 1.6, 0], 22);
const hand = await page.evaluate(() => { const v = new window.__t.THREE.Vector3(); window.__t.mensen[2].armRechts.eind.getWorldPosition(v); return v.toArray(); });
await foto('gezicht_hand', [hand[0] + 0.25, hand[1] + 0.05, hand[2] + 0.30], [hand[0], hand[1] - 0.05, hand[2]], 30);
await foto('gezicht_rij', [0, 1.5, 4.2], [0, 1.15, 0], 36);
await foto('gezicht_lijf', [0.9, 1.3, 2.3], [0, 0.95, 0], 42);
await foto('gezicht_achter', [-0.8, 1.4, -2.2], [0, 0.95, 0], 42);
await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);
