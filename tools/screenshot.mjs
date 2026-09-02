// Maakt testscreenshots van de wereld met headless Chromium (Playwright).
// Gebruik: node tools/screenshot.mjs [poort] [uitvoermap]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const port = process.argv[2] || '8123';
const out = process.argv[3] || 'shots';
mkdirSync(out, { recursive: true });

// Kijkpunten: [px, py] in kaartcoordinaten (zie js/data.js), yaw (rad), pitch, hoogte
// yaw 0 = naar het noorden, +pi/2 = naar het westen, -pi/2 = naar het oosten

// Vaste controlepunten
const FIXED = [
  { name: 'plan_wieken', at: [209, 1426], yaw: 0, pitch: -1.5708, h: 106, fov: 60 },
];

// ---- willekeurige steekproef langs De Wieken en de Molenkrite ----
// De camera gaat een paar meter naast de as staan, anders sta je in een auto.
const LIJNEN = {
  wieken: [
    [[-215,880],[-210,950],[-204,1000],[-195,1060],[-175,1130],[-145,1185]],
    [[-145,1185],[-105,1240],[-60,1290],[-10,1345]],
    [[-10,1345],[20,1355],[50,1380],[100,1420],[150,1440],[230,1450],[305,1460]],
  ],
  molenkrite: [
    [[370,1245],[450,1190],[500,1140],[550,1090]],
    [[550,1090],[600,1045],[650,1005],[688,980],[788,972],[888,972],[988,975],[1088,990]],
    [[370,1245],[355,1290],[340,1350],[322,1400],[310,1440],[305,1460]],
    [[305,1460],[302,1520],[300,1600],[300,1650],[300,1690],[310,1730],[340,1780],[380,1830],[430,1880]],
  ],
};

// deterministische ruis, zodat een herhaalde run dezelfde plekken pakt
let seed = Number(process.argv[4] || 20260902);
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

function langsLijn(pts, t) {
  const lens = [];
  let tot = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i+1][0] - pts[i][0], pts[i+1][1] - pts[i][1]);
    lens.push(l); tot += l;
  }
  let d = t * tot;
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const u = Math.min(1, d / lens[i]);
      const a = pts[i], b = pts[i+1];
      return { x: a[0] + (b[0]-a[0])*u, y: a[1] + (b[1]-a[1])*u, dx: (b[0]-a[0])/lens[i], dy: (b[1]-a[1])/lens[i] };
    }
    d -= lens[i];
  }
}

const steekproef = [];
for (const [naam, lijnen] of Object.entries(LIJNEN)) {
  for (let k = 0; k < 6; k++) {
    const lijn = lijnen[Math.floor(rnd() * lijnen.length)];
    const p = langsLijn(lijn, 0.08 + rnd() * 0.84);
    // 4 m naast de as, willekeurige kant
    const kant = rnd() < 0.5 ? 1 : -1;
    const off = 13 * kant;
    const at = [p.x + p.dy * off, p.y - p.dx * off];
    // kijkrichting: langs de straat, of dwars naar de overkant
    const dwars = rnd() < 0.4;
    let dx = p.dx, dy = p.dy;
    if (rnd() < 0.5) { dx = -dx; dy = -dy; }
    if (dwars) { const t2 = dx; dx = -dy * kant * -1; dy = t2 * kant * -1; }
    const yaw = Math.atan2(-dx, -dy) + (rnd() - 0.5) * 0.35;
    steekproef.push({ name: `${naam}_${k + 1}`, at: [Math.round(at[0]), Math.round(at[1])], yaw: +yaw.toFixed(3), pitch: 0.03 });
  }
}

const VIEWS = [...steekproef, ...FIXED];
console.log('steekproef:', steekproef.map(v => `${v.name} [${v.at}] yaw ${v.yaw}`).join('\n           '));

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[browser]', m.text()); });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
await page.evaluate(() => { window.__autoplay = true; document.getElementById('overlay').style.display = 'none'; });
await page.waitForTimeout(1500);
// Een luchtshot (h gezet) zet de camera zelf neer: de speler valt anders naar
// beneden. Daarvoor leggen we player.update tijdelijk stil.
await page.evaluate(() => {
  const g = window.__game;
  g.player.__update = g.player.update.bind(g.player);
  window.__air = null;
  g.player.update = function (dt) {
    if (!window.__air) return this.__update(dt);
    const a = window.__air;
    this.camera.position.set(a.x, a.y, a.z);
    this.camera.rotation.set(0, 0, 0, 'YXZ');
    this.camera.rotation.y = a.yaw; this.camera.rotation.x = a.pitch;
    this.gun.visible = false;
  };
});
for (const v of VIEWS) {
  await page.evaluate(({ at, yaw, pitch, h, map, fov }) => {
    const g = window.__game;
    const PX = 3.26, OX = 370, OY = 1245;
    const x = (at[0] - OX) / PX, z = (at[1] - OY) / PX;
    g.camera.fov = fov || 60; g.camera.updateProjectionMatrix();
    if (h) {
      window.__air = { x, y: h, z, yaw, pitch };
    } else {
      window.__air = null;
      g.player.pos.set(x, 0, z);
      g.player.yaw = yaw; g.player.pitch = pitch; g.player.vy = 0;
      g.player.gun.visible = true;
    }
    g.player.keys = {};
    g.hud.bigOpen = !!map; document.getElementById('bigmap').style.display = map ? 'block' : 'none';
    document.getElementById('ui').style.display = h ? 'none' : 'block';
  }, v);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/${v.name}.png` });
  console.log('shot', v.name);
}
const stats = await page.evaluate(() => {
  const bad = [];
  window.__game.scene.traverse(o => { if (o.isMesh) { o.geometry.computeBoundingSphere(); if (!isFinite(o.geometry.boundingSphere.radius)) bad.push(`${o.geometry.type} n=${o.geometry.attributes.position.count} y=${o.geometry.attributes.position.array[1]} first=${Array.from(o.geometry.attributes.position.array.slice(0, 12)).map(v => v.toFixed(2)).join(',')}`); } });
  return { calls: window.__game.renderer.info.render.calls, tris: window.__game.renderer.info.render.triangles, nanGeoms: bad };
});
console.log('render stats', stats);
await browser.close();
