/*
 Foto bij stap 129 (npm run wensen3shots): de schutters langs de weg van Bouwman met hun gele ring, vanuit de
 hoogte van de heli. In docs/screenshots/.
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fouten++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);
const r1 = (n) => (n == null || !isFinite(n)) ? String(n) : n.toFixed(1);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  const W = await import('/js/world.js');
  const { KAART } = await import('/js/kaartwereld.js');
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, v = g.verhaal;
  g.player.active = false;
  window.__autoplay = false;
  window.__W = W; window.__K = KAART;
  window.__meld = [];
  const echt = g.hud.melding.bind(g.hud);
  g.hud.melding = (k, o, t) => { window.__meld.push(`${k}|${o}`); return echt(k, o, t); };
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) { g.player.health = 100; v.update(dt); } };
  window.__klik = (max = 80) => { for (let i = 0; i < max && !document.getElementById('dialoog').hidden; i++) { v.toets(); window.__stap(1); } };
  window.__tot = (fase, maxS = 20, dt = 0.05) => {
    for (let t = 0; t < maxS && v.fase !== fase; t += dt) { window.__stap(1, dt); if (!document.getElementById('dialoog').hidden) v.toets(); }
    return v.fase === fase;
  };
  window.__na17 = () => {
    const s = v.bewaar(); s.missie = 'klaar'; s.fase = 'klaar'; s.volgende = null;
    Object.assign(s, { schaduwKlaar: true, raceKlaar: true, brugKlaar: true, schriftKlaar: true, invalKlaar: true, invalKeus: 2,
      invalTelefoon: true, ronaldKlaar: true, ronaldPraatte: true, uitzendingKlaar: false, huisGekozen: s.huisGekozen || 'Koningsspil 20' });
    g.politie.reset();
    v.herstel(s);
  };
  // missie 18 op een fase hervatten (zoals het laden en het neergaan dat doen)
  window.__bij = (fase) => {
    if (v.missie !== 'uitzending') { window.__na17(); v.startMissie('uitzending'); window.__stap(2); }
    const s = v.bewaar(); s.missie = 'uitzending'; s.fase = fase;
    g.politie.reset();
    v.herstel(s);
    window.__stap(2);
  };
});

const map = 'docs/screenshots';
const foto = async (naam) => {
  await page.evaluate(() => { const g = window.__game; g.scene.updateMatrixWorld(true); g.renderer.shadowMap.needsUpdate = true; g.renderer.render(g.scene, g.camera); if (g.tekenWapen && g.player.gun && g.player.gun.visible) g.tekenWapen(); });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 600000 });
  console.log(`${map}/${naam}.png`);
};
const lod = () => page.evaluate(() => { const c = window.__game.camera.position; window.__W.updateLOD(c.x, c.z); });

// een eigen camera, recht in het canvas (de hud hoort er hier niet bij)
const opname = async (naam, zet) => {
  const data = await page.evaluate(zet);
  const { writeFileSync } = await import('node:fs');
  writeFileSync(`${map}/${naam}.png`, Buffer.from(data.split(',')[1], 'base64'));
  console.log(`${map}/${naam}.png`);
};
const kijk = `(van, naar) => {
  const g = window.__game, C = g.camera;
  C.position.set(van[0], van[1], van[2]); C.lookAt(naar[0], naar[1], naar[2]); C.updateMatrixWorld(true);
  window.__W.updateLOD(C.position.x, C.position.z);
  g.scene.updateMatrixWorld(true); g.renderer.shadowMap.needsUpdate = true;
  g.renderer.render(g.scene, C);
  return g.renderer.domElement.toDataURL('image/png');
}`;

// de heli: wachten tot er strepen in de lucht hangen, dan van opzij naar de schutter kijken
await opname('wensen3_ringen', new Function(`
  const g = window.__game, v = g.verhaal;
  window.__bij('heli'); window.__klik();
  let n = 0;
  for (let i = 0; i < 2400; i++) {
    window.__stap(1); if (!document.getElementById('dialoog').hidden) v.toets();
    const G = v.avond.grondvuur;
    if (v.fase === 'heli' && G.strepen >= 3 && ++n > 2) break;
  }
  const h = v.avond.heli.pos, G = v.avond.grondvuur;
  const m = G.mannen.map(q => q.p.groep.position).sort((a, b) => Math.hypot(a.x - h.x, a.z - h.z) - Math.hypot(b.x - h.x, b.z - h.z))[0];
  const mid = [(h.x + m.x) / 2, (h.y + m.y) / 2, (h.z + m.z) / 2];
  const dx = h.x - m.x, dz = h.z - m.z, L = Math.hypot(dx, dz) || 1;
  const vx = m.x - h.x, vy = m.y - h.y, vz = m.z - h.z, Ln = Math.hypot(vx, vy, vz) || 1;
  return (${kijk})([h.x + vx / Ln * 12, h.y + vy / Ln * 12 + 2, h.z + vz / Ln * 12], [m.x, m.y + 1, m.z]);
`));

console.log(fouten ? `\n${fouten} fout(en)` : '\nAlles goed.');
console.log('EINDE');
await browser.close();
process.exit(fouten ? 1 : 0);
