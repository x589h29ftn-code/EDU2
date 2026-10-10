/*
 Foto's bij stap 127 (npm run wensenshots): de heli met het wapen in beeld, een handlanger in de achtervolging,
 de Ferrari van binnen, het vuurwerk aan het eind, de mouw op een breed scherm, de lijst bij Spel laden, en de
 BP met de vloer onder de luifel. In docs/screenshots/.
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

// 1. in de deur van de heli, met het wapen
await page.evaluate(() => { window.__bij('heli'); window.__stap(120); window.__klik(); window.__stap(20); });
await lod();
await foto('wensen_heli');

// 2. de achtervolging: een handlanger voor je
await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player, W = window.__W;
  window.__bij('naarAuto'); window.__klik();
  const a = v.avond; P.inCar = a.auto; window.__stap(2);
  for (let i = 0; i < 240; i++) {
    const B = v.avond.B, H = v.avond.handlangers;
    const ach = H.mannen.length ? Math.min(...H.mannen.map(m => m.s)) : 0;
    const k = Math.min(B.n - 1, Math.max(0, Math.round((ach - 18) / 2)));
    a.auto.x = B.x[k]; a.auto.z = B.z[k]; a.auto.yaw = Math.atan2(-B.tx[k], -B.tz[k]); a.auto.speed = v.avond.rit.v;
    if (a.auto.mesh) { a.auto.mesh.position.set(B.x[k], W.grondHoogte(B.x[k], B.z[k]), B.z[k]); a.auto.mesh.rotation.y = a.auto.yaw; }
    P.health = 100; window.__stap(1);
  }
  P.yaw = a.auto.yaw; P.pitch = -0.05;
  g.derde.aan || g.derde.wissel();
});
await page.evaluate(() => { const g = window.__game; g.werkWedstrijdBij && 0; });
await lod();
await foto('wensen_handlangers');

// 3. de Ferrari van binnen: zelf tekenen vanaf de stoel en meteen uitlezen (headless zet de hoofdlus de camera niet in de auto)
{
  const data = await page.evaluate(() => {
    const g = window.__game, P = g.player, V = g.vehicles;
    window.__na17(); window.__stap(2);
    g.sfeer.uur = 13; g.sfeer.weer = 'helder';
    if (g.derde.aan) g.derde.wissel();
    const f = V.voegToe({ x: P.pos.x + 4, z: P.pos.z, yaw: 0, soort: 'ferrari', kleur: 0xc81e1e });
    V.zetNeer(f, 0, 0);
    const m = f.mesh; m.updateMatrixWorld(true);
    const b = m.userData.binnen; if (b) b.groep.visible = true;
    if (V.ruiten) V.ruiten(f, false);
    const o = m.userData.oog;
    const C = g.camera;
    C.position.copy(m.localToWorld(C.position.clone().set(o.x, o.y, o.z)));
    C.rotation.set(-0.36, f.yaw + 0.38, 0, 'YXZ');
    C.updateMatrixWorld(true);
    window.__W.updateLOD(C.position.x, C.position.z);
    P.gun.visible = false;
    document.getElementById('ui') && (document.getElementById('ui').style.visibility = 'hidden');
    g.renderer.render(g.scene, C);
    const url = g.renderer.domElement.toDataURL('image/png');
    document.getElementById('ui') && (document.getElementById('ui').style.visibility = '');
    V.verwijder(f);
    return url;
  });
  const { writeFileSync } = await import('node:fs');
  writeFileSync(`${map}/wensen_ferrari_binnen.png`, Buffer.from(data.split(',')[1], 'base64'));
  console.log(`${map}/wensen_ferrari_binnen.png`);
}

// 4. het vuurwerk
await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  P.inCar = null;
  const s = v.bewaar(); s.missie = 'uitzending'; s.fase = 'avond'; s.uitzendingKlaar = true;
  g.politie.reset(); v.herstel(s);
  for (let i = 0; i < 150; i++) window.__stap(1, 0.05);
});
await lod();
await foto('wensen_vuurwerk');

// 5. de mouw op een breed scherm, met het mes
await page.setViewportSize({ width: 1600, height: 640 });
await page.evaluate(() => {
  const g = window.__game, P = g.player;
  const v = g.verhaal; const s = v.bewaar(); s.missie = 'klaar'; s.fase = 'klaar'; s.uitzendingKlaar = true; v.herstel(s); window.__stap(2);
  P.inCar = null; g.sfeer.uur = 13;
  if (g.derde.aan) g.derde.wissel();
  P.wapenUit = false;
  if (P.wapens.includes('mes')) { P.wapenNr = P.wapens.indexOf('mes'); P.zetWapen && P.zetWapen('mes'); }
  P.pitch = 0.1; P.applyCamera();
  if (P.steek) P.steek();
  for (let i = 0; i < 6; i++) { P.wapenStap && P.wapenStap(0.03); }
});
await lod();
await foto('wensen_mes_breed');
await page.setViewportSize({ width: 1280, height: 720 });

// 6. Spel laden: de lijst
await page.evaluate(async () => {
  const g = window.__game, P = g.player, v = g.verhaal;
  const O = await import('/js/opslag.js');
  for (let n = 1; n <= 15; n++) localStorage.removeItem(n === 1 ? 'tinga.spel.v1' : `tinga.spel.v1.${n}`);
  O.kiesPlek(1); P.active = true;
  window.__na17(); window.__stap(2); g.sfeer.uur = 9.25; g.opslaan();
  O.startNieuwSpel();
  const s = v.bewaar(); s.missie = 'klaar'; s.fase = 'klaar'; s.uitzendingKlaar = true; v.herstel(s); window.__stap(2);
  g.sfeer.uur = 21.5; g.opslaan();
  O.startNieuwSpel(); v.startMissie('race'); window.__stap(2); window.__klik(); g.sfeer.uur = 14.1; g.opslaan();
  P.active = false;
  const menu = await import('/js/menu.js');
  document.getElementById('overlay').style.display = 'flex';
  menu.toonMenu({ pauze: false, heeftOpslag: true, opslag: O.opslagInfo(), staat: 'ok' });
  document.getElementById('menuLaden').click();
});
await foto('wensen_spel_laden');
await page.evaluate(async () => { const menu = await import('/js/menu.js'); menu.verbergMenu(); document.getElementById('overlay').style.display = 'none'; });

// 7. de BP
await page.evaluate(() => {
  const g = window.__game, P = g.player, K = window.__K, s = K.tankstations[0];
  P.inCar = null; g.sfeer.uur = 12; g.sfeer.weer = 'helder';
  P.pos.set(s.cx - 24, 0, s.cz); P.yaw = -Math.PI / 2; P.pitch = -0.2; P.applyCamera();
});
await lod();
await foto('wensen_bp');
await browser.close();
