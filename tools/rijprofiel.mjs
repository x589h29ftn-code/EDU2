/*
 Waar gaat het javascript van een beeld naartoe terwijl je rijdt? (ronde van 26
 sep 2026: "het beeld hapert").

   node tools/server.mjs 8123 &   node tools/rijprofiel.mjs [poort]

 De hoofdlus draait, het tekenen staat uit (headless tekent swiftshader, en dan
 meet je de processor als grafische kaart), en de auto rijdt met W ingedrukt en
 af en toe een stuurbeweging. Twee uitkomsten: de beeldtijden met de pieken en
 welk onderdeel er dan het meest kostte, en een profiel van Chrome met de
 zelftijd per functie. Daarmee zijn in die ronde de camera achter de auto (alle
 botsdozen van de wereld), de straatnaam (alle wegvakken, elk beeld) en de
 voetgangers aan het eind van hun wegvak (een filter over alle wegvakken)
 gevonden. Geen proef: er staat niets in dat groen of rood wordt.
*/
import { chromium } from 'playwright';
const poort = process.argv[2] || '8123';
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 640, height: 360 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(() => window.__game.voorbereidSpel());
const cdp = await page.context().newCDPSession(page);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
await page.exposeFunction('__profielAan', async () => { await cdp.send('Profiler.start'); });
let profiel = null;
await page.exposeFunction('__profielUit', async () => { profiel = (await cdp.send('Profiler.stop')).profile; });
const r = await page.evaluate(async () => {
  const g = window.__game, P = g.player;
  localStorage.removeItem('tinga.spel.v1');
  window.__autoplay = true; document.getElementById('overlay').style.display = 'none';
  P.active = true;
  // tekenen uit: alleen het javascript van een beeld telt
  g.renderer.render = () => {};
  // per onderdeel de tijd bijhouden
  const tijd = {}, beeld = {};
  const meet = (obj, naam, label) => {
    const f = obj[naam]; if (typeof f !== 'function') return;
    obj[naam] = function (...a) { const t0 = performance.now(); const u = f.apply(this, a); const d = performance.now() - t0; beeld[label] = (beeld[label] || 0) + d; return u; };
  };
  meet(g.npcs, 'update', 'npcs'); meet(g.vehicles, 'updateTraffic', 'verkeer'); meet(g.vehicles, 'lod', 'autoLod');
  meet(g.vehicles, 'drive', 'rijden'); meet(g.verhaal, 'update', 'verhaal'); meet(g.sfeer, 'update', 'sfeer');
  meet(g.hud, 'update', 'hud'); meet(g.politie, 'update', 'politie'); meet(g.derde, 'update', 'derde');
  if (g.grasVeld) meet(g.grasVeld, 'update', 'gras');
  meet(g, 'werkLantaarnsBij', 'lantaarns');
  P.inCar = null; P.pos.set(10, 0, -7); P.yaw = -0.88; P.pitch = 0; P.applyCamera();
  g.vehicles.voegToe({ x: 12.4, z: -7, yaw: P.yaw, soort: 'hatch' });
  g.toggleCar();
  const c = P.inCar;
  P.keys.KeyW = true;
  const raf = () => new Promise(r => requestAnimationFrame(r));
  const frames = [];
  for (let f = 0; f < 30; f++) await raf();
  await window.__profielAan();
  let vorig = performance.now();
  for (let f = 0; f < 900; f++) {
    for (const k in beeld) beeld[k] = 0;
    await raf();
    const nu = performance.now();
    frames.push({ dt: nu - vorig, ...beeld, snel: c.speed, x: c.x, z: c.z });
    vorig = nu;
    // om de 120 beelden even bijsturen zodat hij op de weg blijft rijden
    if (f % 60 === 30) { P.keys.KeyA = Math.random() < 0.5; P.keys.KeyD = !P.keys.KeyA; }
    if (f % 60 === 40) { P.keys.KeyA = false; P.keys.KeyD = false; }
  }
  await window.__profielUit();
  P.keys.KeyW = false;
  const dts = frames.slice(30).map(f => f.dt).sort((a, b) => a - b);
  const med = dts[Math.floor(dts.length / 2)];
  const pieken = frames.slice(30).filter(f => f.dt > med * 1.8 + 3).map(f => {
    const onderdelen = Object.entries(f).filter(([k]) => !['dt', 'snel', 'x', 'z'].includes(k)).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v.toFixed(1)}`);
    return `${f.dt.toFixed(1)} ms: ${onderdelen.join(', ')}`;
  });
  const gem = {};
  for (const f of frames.slice(30)) for (const [k, v] of Object.entries(f)) if (!['dt', 'snel', 'x', 'z'].includes(k)) gem[k] = (gem[k] || 0) + v / (frames.length - 30);
  return { med, p95: dts[Math.floor(dts.length * 0.95)], max: dts[dts.length - 1], snel: c.speed, afgelegd: Math.hypot(c.x - 12.4, c.z + 7), aantalPieken: pieken.length, pieken: pieken.slice(0, 25),
    gem: Object.fromEntries(Object.entries(gem).map(([k, v]) => [k, +v.toFixed(2)])) };
});
console.log(JSON.stringify(r, null, 1));
// zelftijd per functie
const zelf = new Map(), knoop = new Map(profiel.nodes.map(n => [n.id, n]));
const dt = profiel.timeDeltas; let tot = 0;
profiel.samples.forEach((id, i) => { const n = knoop.get(id); const cf = n.callFrame; const k = `${cf.functionName || '(anoniem)'} ${cf.url.split('/').pop()}:${cf.lineNumber + 1}`; const t = (dt[i] || 0) / 1000; zelf.set(k, (zelf.get(k) || 0) + t); tot += t; });
console.log('totaal', tot.toFixed(0), 'ms');
for (const [k, v] of [...zelf].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(`${(v / tot * 100).toFixed(1).padStart(5)} %  ${v.toFixed(0).padStart(6)} ms  ${k}`);
await b.close();
