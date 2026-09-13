/*
 Foto's van de ronde "mensen, auto's en een wijk die geleefd heeft":

   1. drie mensen van voren: stilstaand, lopend en een agent die mikt
   2. dezelfde drie van schuin opzij, zodat je de looppas en de houding ziet
   3. een auto van schuin voren: velgen met spaken, wissers, vuilrand
   4. de stoeprand met onkruid, zwerfvuil en rolcontainers
   5. gebukt achter een muurtje (toets C)
   6. een agent met een machinepistool

 Gebruik: npm run server &   node tools/vuilshots.mjs 8123 [map]
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const port = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
mkdirSync(map, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });
const foto = async (naam) => {
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 300000 });
  console.log(`${map}/${naam}.png`);
};

await page.evaluate(async () => {
  const g = window.__game;
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('ui').style.display = 'none';
  g.player.active = true;
  g.sfeer.uur = 12; g.sfeer.weer = 'helder';
  g.player.wapenUit = true; g.player.gun.visible = false;
  window.__W = await import('/js/world.js');
});

// ---- 1 en 2: drie mensen op een rij
await page.evaluate(async () => {
  const g = window.__game;
  const { Persoon } = await import('/js/persoon.js');
  const x0 = g.player.pos.x, z0 = g.player.pos.z - 10;
  window.__rij = [
    new Persoon({ shirt: 0xc85a2a, broek: 0x1f2a44, huid: 0xd9b48f, haar: 0x2a1d12, korteMouw: true }),
    new Persoon({ shirt: 0x2f3a56, broek: 0x333333, huid: 0xc48a5a, haar: 0x8a6a3a }),
    new Persoon({ shirt: 0x1d2634, broek: 0x1d2634, huid: 0xf0d5b8, haar: 0x141414,
      pet: true, vest: 0xd8e84a, wapen: 'mp' }),
  ];
  window.__rij.forEach((p, i) => {
    g.scene.add(p.groep);
    p.zetNeer(x0 + (i - 1) * 1.5, z0, Math.PI);
  });
  window.__pose = () => {
    for (let k = 0; k < 60; k++) {
      window.__rij[0].update(1 / 30, { loopt: false });
      window.__rij[1].update(1 / 30, { loopt: true, snelheid: 1.5 });
      window.__rij[2].update(1 / 30, { loopt: false, mikt: true });
    }
  };
  window.__pose();
  window.__kijk = (hoek, afst) => {
    const cx = x0 + Math.sin(hoek) * afst, cz = z0 + Math.cos(hoek) * afst;
    g.player.pos.set(cx, 0, cz);
    g.player.yaw = Math.atan2(-(x0 - cx), -(z0 - cz));
    g.player.pitch = -0.06;
    g.player.applyCamera();
  };
  window.__kijk(0, 3.4);
});
await foto('mensen_voor');

// een driekwartblik: van opzij staan ze precies achter elkaar
await page.evaluate(() => { window.__pose(); window.__kijk(0.85, 4.4); });
await foto('mensen_zij');

// ---- 3: een auto van schuin voren
await page.evaluate(async () => {
  const g = window.__game;
  for (const p of window.__rij) g.scene.remove(p.groep);
  const { KAART } = await import('/js/kaart.js');
  const as = KAART.wegassen.filter(w => w.drive && w.naam === 'Molenkrite' && w.lengte > 60)[0];
  const p0 = as.pts[0], p1 = as.pts[as.pts.length - 1];
  const yaw = Math.atan2(-(p1[0] - p0[0]), -(p1[1] - p0[1]));
  const auto = g.vehicles.voegToe({ x: p0[0], z: p0[1], yaw, soort: 'hatch', kleur: 0x2f4a6e });
  const hoek = 2.3, afst = 4.6;
  const cx = auto.x + Math.sin(yaw + hoek) * afst, cz = auto.z + Math.cos(yaw + hoek) * afst;
  g.player.pos.set(cx, 0, cz);
  g.player.yaw = Math.atan2(-(auto.x - cx), -(auto.z - cz));
  g.player.pitch = -0.16;
  g.player.applyCamera();
});
await foto('auto_detail');

// ---- 4: de stoeprand met rommel
await page.evaluate(async () => {
  const THREE = await import('three');
  const g = window.__game;
  const m = new THREE.Matrix4(), v = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler();
  let best = null, bd = 1e9, bestYaw = 0;
  g.scene.traverse(o => {
    if (!o.isInstancedMesh || !o.userData || o.userData.klasse !== 'zwerfvuil') return;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m); v.setFromMatrixPosition(m);
      const d = Math.hypot(v.x - g.player.pos.x, v.z - g.player.pos.z);
      if (d < bd) {
        bd = d; best = v.clone();
        q.setFromRotationMatrix(m); e.setFromQuaternion(q, 'YXZ'); bestYaw = e.y;
      }
    }
  });
  if (!best) return;
  // een papiertje in de goot als onderwerp; van daaruit kijk je de straat in,
  // met het onkruid langs de band en de containers verderop
  const yaw = bestYaw;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  g.player.pos.set(best.x + fx * 2.1 + fz * 0.6, 0, best.z + fz * 2.1 - fx * 0.6);
  g.player.yaw = Math.atan2(-(best.x - g.player.pos.x), -(best.z - g.player.pos.z));
  g.player.pitch = -0.42;
  g.player.applyCamera();
});
await foto('stoeprand_rommel');

/*
 ---- 5: gebukt, van achteren gezien. In de eerste persoon zie je alleen dat het
 beeld zakt; met de camera over je schouder zie je het poppetje door zijn knieën
 gaan, en dat is waar het om gaat.
*/
await page.evaluate(() => {
  const g = window.__game;
  if (!g.derde.aan) g.derde.wissel();
  g.player.wapenUit = true;
  g.player.bukken(true);
  for (let i = 0; i < 90; i++) { g.player.update(1 / 60); g.derde.update(1 / 60, null); }
  g.player.pitch = -0.12;
  g.derde.update(1 / 60, null);
});
await foto('gebukt');

await browser.close();
