/*
 Stap 180 (npm run rondgang): een steekproef door het spel op fouten. Gevraagd: "loop steekproefgewijs het spel door op
 fouten". De echte hoofdlus draait (requestAnimationFrame) op een handvol plekken, overdag en 's nachts, te voet, in een
 auto, in de Tiger; elke fout in de console telt, en per plek wordt gekeken of er niets onmogelijks is:
   - geen NaN in de speler, de camera, het verkeer of de voetgangers;
   - de speler niet in een botsdoos of onder de grond, de camera niet onder de grond;
   - geen nieuw shaderprogramma ná het eerste beeld op die plek (een tweede ronde over dezelfde plek vertaalt niets);
   - de beeldtijd van de hoofdlus.
 Van elke plek een foto in docs/rondgang/.

 Gebruik: npm run server &  node tools/rondgang.mjs [poort]
*/
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const poort = process.argv[2] || '8123';
const map = 'docs/rondgang';
mkdirSync(map, { recursive: true });
let fout = 0;
const ok = (goed, wat, extra = '') => { console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`); if (!goed) fout++; };

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 320, height: 180 } });
page.setDefaultTimeout(900000);
const consoleFouten = [];
page.on('pageerror', e => consoleFouten.push(`[pageerror] ${e.message}`));
page.on('console', m => { if (m.type() === 'error') consoleFouten.push(`[console] ${m.text().slice(0, 200)}`); });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  const g = window.__game;
  window.__W = await import('/js/world.js'); window.__V = await import('/js/viaduct.js');
  await g.voorbereidSpel();
  document.getElementById('overlay').style.display = 'none';
  window.__autoplay = true; g.player.active = true;
  // geen missie die tussendoor iets start: vrij spelen na het einde
  const v = g.verhaal, s = v.bewaar(); s.missie = 'klaar'; s.fase = 'klaar'; s.volgende = null; s.uitzendingKlaar = true; s.roanKlaar = true; s.noMercyKlaar = true;
  v.herstel(s); v.__geenVolgende && v.__geenVolgende();
});

// een plek: neerzetten, de echte lus `sec` seconden laten lopen met de toetsen erbij, meten, foto
async function plek(naam, opzet) {
  const consoleVoor = consoleFouten.length;
  const r = await page.evaluate(async ({ opzetStr }) => {
    const g = window.__game, P = g.player, W = window.__W, V = window.__V, R = g.renderer;
    const raf = () => new Promise(q => requestAnimationFrame(q));
    const stel = new Function('g', 'P', 'W', opzetStr)(g, P, W) || {};
    const sec = stel.sec || 6;
    for (let i = 0; i < 8; i++) await raf();          // de eerste beelden op de plek mogen vertalen (en de overgang naar de nacht)
    const programmas0 = R.info.programs.length;
    const t0 = performance.now(); let n = 0, slechtst = 0, vorig = t0;
    const nan = new Set(), muur = [], onder = [];
    while (performance.now() - t0 < sec * 1000) {
      if (stel.elkBeeld) stel.elkBeeld(g, P, (performance.now() - t0) / 1000);
      await raf(); n++;
      const nu = performance.now(); slechtst = Math.max(slechtst, nu - vorig); vorig = nu;
      const c = g.camera.position;
      if (![P.pos.x, P.pos.y, P.pos.z].every(Number.isFinite)) nan.add('speler');
      if (![c.x, c.y, c.z].every(Number.isFinite)) nan.add('camera');
      for (const t of g.vehicles.traffic) if (!t.slaapt && t.mesh && ![t.mesh.position.x, t.mesh.position.z].every(Number.isFinite)) nan.add('verkeer');
      for (const q of g.npcs.people) if (!q.slaapt && q.alive && ![q.x, q.z].every(Number.isFinite)) nan.add('voetganger');
      // te voet: niet in een botsdoos en niet onder de grond
      if (!P.inCar && !P.inTiger && !P.binnen) {
        const [qx, qz] = W.resolveCollisions(P.pos.x, P.pos.z, 0.2, 0, P.pos.y);
        if (Math.hypot(qx - P.pos.x, qz - P.pos.z) > 0.15) muur.push(`${P.pos.x.toFixed(1)},${P.pos.z.toFixed(1)}`);
        const gy = V.grondHoogte(P.pos.x, P.pos.z, P.pos.y + 1);
        if (P.pos.y < gy - 0.3) onder.push(`${P.pos.y.toFixed(2)} < ${gy.toFixed(2)}`);
      }
      const gyc = V.grondHoogte(c.x, c.z, c.y + 0.5);
      if (c.y < gyc - 0.05 && !P.binnen) onder.push(`camera ${c.y.toFixed(2)} < ${gyc.toFixed(2)}`);
    }
    const extra = stel.meet ? stel.meet(g, P) : null;   // vóór `na`: die stapt uit de auto
    if (stel.na) stel.na(g, P);
    const uit = { n, ms: Math.round((performance.now() - t0) / n), slechtst: Math.round(slechtst), nan: [...nan], muur: muur.slice(0, 3), muurN: muur.length,
      onder: onder.slice(0, 3), onderN: onder.length, programmas: R.info.programs.length - programmas0, plek: [Math.round(P.pos.x), Math.round(P.pos.z)],
      extra };
    return uit;
  }, { opzetStr: opzet });
  const nieuweFouten = consoleFouten.slice(consoleVoor);
  await page.screenshot({ path: `${map}/${naam}.png` });
  console.log(`\n--- ${naam} (${r.plek}) — ${r.n} beelden, ${r.ms} ms gemiddeld, slechtst ${r.slechtst} ms${r.extra ? ' · ' + JSON.stringify(r.extra) : ''}`);
  ok(nieuweFouten.length === 0, 'geen fout in de console', nieuweFouten.slice(0, 3).join(' | '));
  ok(r.nan.length === 0, 'geen NaN', r.nan.join(', '));
  ok(r.muurN === 0, 'de speler niet in een botsdoos', `${r.muurN}× ${r.muur.join(' ')}`);
  ok(r.onderN === 0, 'niets onder de grond', `${r.onderN}× ${r.onder.join(' ')}`);
  ok(r.programmas === 0, 'geen nieuw shaderprogramma na het eerste beeld', `${r.programmas}`);
  return r;
}

const zet = (x, z, yaw, extra = '') => `g.player.inCar = null; g.player.pos.set(${x}, window.__V.grondHoogte(${x}, ${z}, 5), ${z}); g.player.yaw = ${yaw}; g.player.pitch = -0.05; g.sfeer.uur = 13; ${extra}`;

// 1. het beginpunt, rondlopen
await plek('1_beginpunt', `${zet(10.7, -7.1, -0.88)} return { sec: 6, elkBeeld: (g, P, t) => { P.keys = { KeyW: true, ShiftLeft: t > 3 }; P.yaw += 0.01; } };`);
// 2. de BP: naar binnen lopen
await plek('2_bp', `const S = g.bpshop; const [x, z] = S.wereld(5.3, -6); ${zet('x', 'z', 0)} const [bx, bz] = S.wereld(5.3, 3);
  P.yaw = Math.atan2(-(bx - x), -(bz - z)); return { sec: 6, elkBeeld: (g, P) => { P.keys = { KeyW: true }; } };`);
// 3. de school en Radio Tinga
await plek('3_school', `${zet(330, -70, -1.2)} return { sec: 5, elkBeeld: (g, P) => { P.keys = { KeyW: true }; } };`);
// 4. rijden over de Lemmerweg in een auto
await plek('4_rijden', `${zet(10.7, -7.1, -0.88)}
  const c = g.vehicles.voegToe({ x: 12, z: -7, yaw: P.yaw, soort: 'hatch' }); P.pos.set(11.5, 0, -7); g.toggleCar();
  return { sec: 10, elkBeeld: (g, P, t) => { P.keys = { KeyW: true, KeyA: t % 4 > 3, KeyD: t % 4 < 0.6 }; }, na: (g, P) => { P.keys = {}; if (P.inCar) g.toggleCar(); },
    meet: (g, P) => ({ snel: Math.round((P.inCar ? P.inCar.speed : 0) * 3.6) }) };`);
// 5. de Tiger bij de gedenkplek: instappen, rijden, schieten
await plek('5_tiger', `const T = g.tiger; T.zetTerug(); const s = T.stand; ${zet('s.x + Math.cos(s.yaw) * 3', 's.z - Math.sin(s.yaw) * 3', 0)} T.toets();
  P.yaw = s.yaw; P.pitch = 0.02;
  return { sec: 10, elkBeeld: (g, P, t) => { P.keys = { KeyW: t > 1 && t < 6, KeyA: t > 6 }; if (t > 3 && !T.__geschoten) { T.vuur(); T.__geschoten = true; } },
    na: (g, P) => { P.keys = {}; T.uit(); }, meet: () => ({ tiger: [Math.round(T.stand.x), Math.round(T.stand.z)], herlaad: +T.stand.herlaad.toFixed(1) }) };`);
// 6. IJlst, de haven
await plek('6_ijlst', `${zet(-1133, 884, 1.2)} return { sec: 5, elkBeeld: (g, P) => { P.keys = { KeyW: true }; P.yaw += 0.008; } };`);
// 7. Duinterpen, de Poiesz
await plek('7_duinterpen', `${zet(150, 640, 0)} return { sec: 5, elkBeeld: (g, P) => { P.keys = { KeyW: true }; P.yaw -= 0.006; } };`);
// 8. 's nachts in de wijk
await plek('8_nacht', `${zet(10.7, -7.1, -0.88, 'g.sfeer.uur = 1;')} return { sec: 8, elkBeeld: (g, P) => { g.sfeer.uur = 1; P.keys = { KeyW: true }; } };`);
// 9. de Dúvelsrak, op het dek
await plek('9_duvelsrak', `g.player.inCar = null; g.player.pos.set(281, window.__V.grondHoogte(281, -214.5, 7), -214.5); g.player.yaw = -0.13; g.player.pitch = -0.05; g.sfeer.uur = 13; return { sec: 5, elkBeeld: (g, P) => { g.sfeer.uur = 13; P.keys = { KeyW: true }; } };`);
// 10. de tweede ronde over het beginpunt: niets meer te vertalen
await plek('10_beginpunt_weer', `${zet(10.7, -7.1, 2.2)} return { sec: 4, elkBeeld: (g, P) => { P.keys = { KeyW: true }; } };`);

console.log(`\nfouten in de console in totaal: ${consoleFouten.length}`);
writeFileSync(`${map}/console.txt`, consoleFouten.join('\n') + '\n');
await browser.close();
console.log(fout ? `\n${fout} fout(en)` : '\nalles goed');
process.exit(fout ? 1 : 0);
