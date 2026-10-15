/*
 Proef bij stap 187 (npm run bootwaltest): de boot tegen de wal. Gevraagd: "kijk of er nog problemen zijn met de boot, bijvoorbeeld
 als je tegen de wal botst, dat je niet vast komt te zitten".

 Voor elke boot, vanaf een plek op het water bij zijn ligplaats, naar de dichtstbijzijnde kant onder vijf hoeken (recht erop en
 schuin van beide kanten): vol gas tegen de wal (4 s), dan vol gas met het roer tegen de kant aan (3 s, links en rechts), en dan
 achteruit en draaien (5 s). Elk beeld:
   - de romp past (`pastHier` op de eigen plek en draaiing): nooit met een stuk van de boot op het land;
   - na het achteruitvaren is hij minstens 2 m van de plek waar hij vastliep: hij komt los.

 Gebruik: npm run server &  node tools/bootwaltest.mjs [poort]
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => { console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`); if (!goed) fouten++; };

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
page.setDefaultTimeout(900000);
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

const r = await page.evaluate(async () => {
  const g = window.__game, B = g.boten, W = await import('/js/world.js');
  g.player.active = false; window.__autoplay = false;
  const dt = 1 / 30;
  const proeven = [];
  for (let i = 0; B.ruw(i); i++) {
    const b = B.ruw(i), x0 = b.x, z0 = b.z, yaw0 = b.yaw;
    // de dichtstbijzijnde kant: stralen rond de ligplaats tot het water ophoudt
    let kant = null;
    for (let a = 0; a < 32; a++) {
      const h = a / 32 * Math.PI * 2;
      for (let d = 3; d < 60; d += 0.5) {
        if (!W.vaarbaar(x0 + Math.cos(h) * d, z0 + Math.sin(h) * d)) { if (!kant || d < kant.d) kant = { h, d }; break; }
      }
    }
    if (!kant) continue;
    for (const hoek of [0, 0.5, -0.5, 1.0, -1.0]) {
      for (const roer of ['KeyA', 'KeyD']) {
        // beginnen op 9 m van de kant, met de neus naar de kant onder `hoek`
        const h = kant.h + hoek * 0.3;
        const yaw = Math.atan2(-Math.cos(h), -Math.sin(h));     // de neus (-sin yaw, -cos yaw) wijst naar h
        // een startplek op de lijn naar de kant: zo ver mogelijk (tot 9 m) ervandaan waar de boot met die draaiing past
        let sx = null, sz = null;
        for (let terugD = 9; terugD >= 2.5 && sx === null; terugD -= 0.5) {
          const x = x0 + Math.cos(kant.h) * (kant.d - terugD), z = z0 + Math.sin(kant.h) * (kant.d - terugD);
          if (B.pastHier(x, z, yaw)) { sx = x; sz = z; }
        }
        if (sx === null) continue;
        b.x = sx; b.z = sz; b.yaw = yaw; b.vx = 0; b.vz = 0; b.gas = 0; b.roer = 0;
        B.stapIn(b);
        let nietPassen = 0, n = 0;
        const stap = (keys, sec) => { for (let k = 0; k < sec / dt; k++) { B.update(dt, keys); n++; if (!B.pastHier(b.x, b.z, b.yaw)) nietPassen++; } };
        stap({ KeyW: true }, 4);
        stap({ KeyW: true, [roer]: true }, 3);
        const vast = { x: b.x, z: b.z };
        stap({ KeyS: true }, 3);
        stap({ KeyS: true, [roer === 'KeyA' ? 'KeyD' : 'KeyA']: true }, 2);
        const los = Math.hypot(b.x - vast.x, b.z - vast.z);
        proeven.push({ boot: i, hoek, roer, nietPassen, n, los: +los.toFixed(2) });
        B.herstel({});            // van boord (zonder `stapUit`, dat een stuk wal zoekt)
      }
    }
    // van boord en terug op de ligplaats
    b.x = x0; b.z = z0; b.yaw = yaw0; b.vx = 0; b.vz = 0;
  }
  return proeven;
});
const vast = r.filter(p => p.los < 2), slecht = r.filter(p => p.nietPassen > 0);
console.log(`\n--- ${r.length} keer tegen de wal, ${new Set(r.map(p => p.boot)).size} boten ---`);
ok(r.length >= 20, 'genoeg proeven', `${r.length}`);
ok(slecht.length === 0, 'nooit met een stuk van de boot op het land', slecht.slice(0, 5).map(p => `boot ${p.boot} hoek ${p.hoek} ${p.roer}: ${p.nietPassen} van ${p.n} beelden`).join('; '));
ok(vast.length === 0, 'achteruit komt hij altijd los (minstens 2 m)', vast.slice(0, 6).map(p => `boot ${p.boot} hoek ${p.hoek} ${p.roer}: ${p.los} m`).join('; ') || `minst ${Math.min(...r.map(p => p.los)).toFixed(1)} m`);
await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);
