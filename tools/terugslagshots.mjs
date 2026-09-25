/*
 De terugslag van het pistool als filmstrook (ronde van 25 sep 2026: "schieten
 met het handpistool lijkt raar qua recoil en animatie").

   wapen_terugslag.png   vijf momenten na één schot — 0, 20, 50, 110 en 250 ms —
                         bij 60 beelden per seconde, zoals in het spel: de loop
                         draait om de pols omhoog, de onderarm gaat maar een
                         klein stukje mee, en het wapen komt zonder wiebelen terug

 Met een tweede argument (een pad naar een andere versie van js/wapen.js, op de
 server) maak je dezelfde strook van die versie, om te vergelijken:

   node tools/terugslagshots.mjs 8123 docs/screenshots /js/wapen_oud.js wapen_terugslag_oud

 Laadt alleen js/wapen.js op een lege pagina, net als tools/wapenechttest.mjs,
 dus het duurt seconden in plaats van minuten.

 Gebruik: npm run server &   node tools/terugslagshots.mjs 8123 [map] [module] [naam]
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const poort = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
const module = process.argv[4] || '/js/wapen.js';
const naam = process.argv[5] || 'wapen_terugslag';
mkdirSync(map, { recursive: true });

const B = 300, H = 300, MOMENTEN = [0, 0.020, 0.050, 0.110, 0.250];
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: B * MOMENTEN.length, height: H + 28 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${poort}/terugslagbank`, { waitUntil: 'load', timeout: 120000 });
await page.setContent(`<!doctype html><html><head>
<style>body{margin:0;background:#20242a;font:13px sans-serif;color:#dde}#strook{display:block}.m{position:absolute;top:${H + 6}px;width:${B}px;text-align:center}</style>
<script type="importmap">{ "imports": { "three": "/lib/three.module.js" } }</script></head><body>
<canvas id="strook" width="${B * MOMENTEN.length}" height="${H}"></canvas>
<script type="module">
  import * as THREE from 'three';
  import * as W from '${module}';
  const geluid = new Proxy({}, { get: () => () => {} });
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setSize(${B}, ${H}); r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x8fa6b8);
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x4a4238, 1.6));
  const zon = new THREE.DirectionalLight(0xfff2dc, 2.2); zon.position.set(2, 3, 1); scene.add(zon);
  // een vloer en een muur erachter, zodat je ziet hoe het wapen beweegt
  const vloer = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x6d6a62 }));
  vloer.rotation.x = -Math.PI / 2; vloer.position.y = -1.6; scene.add(vloer);
  const cam = new THREE.PerspectiveCamera(72, 1, 0.05, 50); scene.add(cam);
  const w = W.maakPistool(geluid); cam.add(w.groep);
  const strook = document.getElementById('strook').getContext('2d');
  const momenten = ${JSON.stringify(MOMENTEN)};
  for (let i = 0; i < 60; i++) w.update(1 / 60);
  const echt = Math.random; Math.random = () => 0.5;   // elk schot hetzelfde, voor de vergelijking
  w.vuur();
  Math.random = echt;
  let t = 0;
  for (let k = 0; k < momenten.length; k++) {
    while (t + 1e-6 < momenten[k]) { const d = Math.min(1 / 60, momenten[k] - t); w.update(d); t += d; }
    w.delen.flits.visible = false;                     // het vuur verbergt de beweging
    r.render(scene, cam);
    strook.drawImage(r.domElement, k * ${B}, 0);
    const lab = document.createElement('div'); lab.className = 'm'; lab.style.left = (k * ${B}) + 'px';
    lab.textContent = Math.round(momenten[k] * 1000) + ' ms — loop ' + (w.veer.x * 57.3).toFixed(1) + '°';
    document.body.appendChild(lab);
  }
  window.__klaar = true;
</script></body></html>`);
await page.waitForFunction(() => window.__klaar, null, { timeout: 120000 });
await page.screenshot({ path: `${map}/${naam}.png` });
console.log(`${map}/${naam}.png`);
await browser.close();
