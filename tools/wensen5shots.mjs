/*
 Foto's bij stap 131 (npm run wensen5shots): Martens Vishandel voor de Jumbo, een getunede GTI met Radio Markant en Tinga Racing,
 een zeilbootje en Tinga Nieuws op de tv. In docs/screenshots/.
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

// de rondweg: overdag, de camera boven de weg zoals op de schermafdruk
// het verhaal klaar en de middag
await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__na17();
  const s = v.bewaar(); s.uitzendingKlaar = true; v.herstel(s);
  g.sfeer.uur = 13; g.sfeer.weer = 'helder';
  window.__stap(2);
});

// 1. Martens Vishandel voor de Jumbo
await opname('wensen5_vishandel', new Function(`
  const g = window.__game, s = g.vishandel.stand;
  const vx = Math.sin(s.yaw), vz = Math.cos(s.yaw);
  return (${kijk})([s.x + vx * 9 + vz * 3, 2.4, s.z + vz * 9 - vx * 3], [s.x, 1.5, s.z]);
`));

// 2. een eigen GTI met tuning: velgen, spoiler, vering, Radio Markant en Tinga Racing
await page.evaluate(async () => {
  const g = window.__game, t = g.tuning, ga = g.garage, v = g.verhaal, p = g.player;
  const { TE_KOOP } = await import('/js/garage.js');
  v.verdien(20000);
  p.active = true; p.inCar = null;
  ga.koop(TE_KOOP.find(q => q.id === 'gti'));
  p.pos.set(783.4, 0, 144.0);
  t.update(0.1);
  t.toets();
  t.kies(4); t.kies(1); t.kies(0);   // velgen
  t.kies(3);                         // spoiler
  t.kies(2);                         // vering
  t.kies(5); t.kies(2); t.kies(6); t.kies(0);   // Radio Markant op de deur, Tinga Racing op de kap
  t.kies(0);
  p.active = false;
  const c = ga.eigen[ga.eigen.length - 1].car;
  window.__gti = { x: c.x, z: c.z, yaw: c.yaw };
});
await opname('wensen5_tuning', new Function(`
  const c = window.__gti;
  const zx = Math.cos(c.yaw), zz = -Math.sin(c.yaw);
  // (van de straatkant, niet door het glas van de showroom)
  return (${kijk})([c.x - zx * 4.2 + Math.sin(c.yaw) * 1.8, 1.5, c.z - zz * 4.2 + Math.cos(c.yaw) * 1.8], [c.x, 0.7, c.z]);
`));

// 3. een zeilbootje
await opname('wensen5_zeilboot', new Function(`
  const g = window.__game, Z = g.zeilen;
  for (let i = 0; i < 20; i++) Z.update(0.1, Z.boten[0].x, Z.boten[0].z);
  const b = Z.boten[0];
  return (${kijk})([b.x + 16, 5, b.z + 12], [b.x, 2.5, b.z]);
`));

// 4. Tinga Nieuws: het doek van de tv
await page.evaluate(async () => {
  const g = window.__game, n = await import('/js/nieuws.js');
  n.onthoud('schietpartij', 'Molenkrite');
  n.onthoud('afgeschud', 'Lemmerweg', { sterren: 3 });
  const w = g.woningen.find(q => q.tvPunt);
  w.zetTv(true);
  for (let i = 0; i < 10; i++) w.update(0.1);
  window.__tvDoek = w.tvDoek.toDataURL('image/png');
  w.zetTv(false);
});
await opname('wensen5_tinganieuws', () => window.__tvDoek);

console.log(fouten ? `\n${fouten} fout(en)` : '\nAlles goed.');
console.log('EINDE');
await browser.close();
process.exit(fouten ? 1 : 0);
