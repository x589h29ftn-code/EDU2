/*
 Proef bij stap 211 (npm run shotguntijdtest). Gemeld (17 okt 2026): "De shotgun lijkt bij schieten lag te veroorzaken."

 Meet de tijd die één schot kost (`player.shoot()` met alles wat erachter zit: de stralen, de treffers, de inslagen, de gaten in
 een auto), voor het pistool en voor het pompgeweer (negen korrels hagel, elk een eigen straal), op drie plekken: de lucht in, een
 straat in met auto's en mensen, en van dichtbij op een geparkeerde auto. Daarna het eerste beeld na het schot (de render), en of
 er een nieuw shaderprogramma bij komt.

  1. Het pompgeweer (negen stralen) kost per schot hoogstens negen keer het pistool en headless een mediaan onder GRENS.mediaan
     ms (vóór stap 211 15–20 ms op straat en bij een auto, met de lijst van alle ~680 auto's per korrel); de lucht in hoogstens
     twee keer het pistool.
  2. Het beeld na een schot met het pompgeweer is niet trager dan na een schot met het pistool (± marge).
  3. Geen nieuw shaderprogramma bij het schieten (ook niet de eerste keer op een auto).
  4. Van dichtbij op een auto raken pistool en hagel hem nog (de doelen zonder de auto's buiten bereik, stap 211).

 Gebruik: npm run server &  node tools/shotguntijdtest.mjs [poort]
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
// Een schot hagel is negen stralen: hoogstens negen pistoolschoten, met de mediaan headless onder `mediaan` ms en geen schot boven
// `maxMs` (vóór stap 211: 15,4 en 19,8 ms op straat en bij de auto). De lucht in raakt een straal niets: daar hoogstens `lucht`
// keer het pistool (vóór stap 211: 5,1 tegen 0,9 ms, want elke korrel liep toch alle auto's af).
const GRENS = { korrels: 9, mediaan: 10, maxMs: 20, lucht: 2, beeld: 1.5 };
let fout = 0;
const ok = (goed, wat, extra = '') => { console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`); if (!goed) fout++; };
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
page.setDefaultTimeout(900000);
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

const r = await page.evaluate(async () => {
  const W = await import('/js/world.js');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, v = g.verhaal, P = g.player, R = g.renderer;
  await g.voorbereidSpel();
  P.active = false; window.__autoplay = false;
  g.politie.proefStil = true;
  const start = { x: P.pos.x, z: P.pos.z, yaw: P.yaw };
  // een geparkeerde auto 6 m voor je, voor de derde plek
  const fx = -Math.sin(start.yaw), fz = -Math.cos(start.yaw);
  const auto = g.vehicles.voegToe({ x: start.x + fx * 6, z: start.z + fz * 6, yaw: start.yaw + Math.PI / 2, soort: 'hatch', kleur: 0x8a8f96 });
  for (let i = 0; i < 4; i++) v.update(0.05);
  const kies = (soort) => { if (!P.wapens.includes(soort)) P.wapens.push(soort); P.wapenNr = P.wapens.indexOf(soort); if (P.zetWapen) P.zetWapen(soort); };
  const render = () => { g.scene.updateMatrixWorld(true); const t = performance.now(); R.render(g.scene, g.camera); return performance.now() - t; };
  let raakAuto = 0; const echtHit = g.vehicles.hit.bind(g.vehicles);
  g.vehicles.hit = (m, i) => { const c = echtHit(m, i); if (c === auto) raakAuto++; return c; };
  const meetSchoten = (soort, plek, n) => {
    kies(soort); raakAuto = 0;
    const tijden = [], beelden = [];
    for (let i = 0; i < n; i++) {
      P.pos.set(start.x, W.grondHoogte(start.x, start.z), start.z);
      P.yaw = start.yaw + (plek === 'auto' ? 0 : (i % 5 - 2) * 0.08);
      P.pitch = plek === 'lucht' ? 1.2 : plek === 'auto' ? -0.12 : -0.02;
      P.applyCamera();
      P.vuurKlok = 0; P.kickPitch = 0; P.kickYaw = 0; P.ammo = 6; P.reserve = 100; P.reloading = 0; P.wisselT = 0; P.pompT = 0;
      if (auto.wrak) { auto.wrak = false; auto.hp = 100; }
      auto.hp = 100;
      g.scene.updateMatrixWorld(true);
      const was = P.active; P.active = true;
      const t = performance.now(); P.shoot(); tijden.push(performance.now() - t);
      P.active = was;
      beelden.push(render());
      v.update(0.05);
    }
    tijden.sort((a, b) => a - b); beelden.sort((a, b) => a - b);
    const mid = (a) => a[Math.floor(a.length / 2)];
    return { mediaan: +mid(tijden).toFixed(2), max: +tijden[tijden.length - 1].toFixed(2), beeld: +mid(beelden).toFixed(1), raakAuto };
  };
  // eerst één keer opwarmen (de opnames laden, de eerste straal)
  meetSchoten('pistool', 'straat', 2); meetSchoten('shotgun', 'straat', 2);
  const programmasVoor = R.info.programs.length;
  const uit = {};
  for (const plek of ['lucht', 'straat', 'auto']) {
    uit[plek] = { pistool: meetSchoten('pistool', plek, 12), shotgun: meetSchoten('shotgun', plek, 12) };
  }
  uit.programmas = { voor: programmasVoor, na: R.info.programs.length };
  // hoeveel doelen een straal afloopt (voor het verslag)
  uit.doelen = g.vehicles.doelen().length;
  return uit;
});

for (const plek of ['lucht', 'straat', 'auto']) {
  const p = r[plek].pistool, s = r[plek].shotgun;
  kop(`${plek}`);
  console.log(`  pistool: mediaan ${p.mediaan} ms, max ${p.max} ms, beeld erna ${p.beeld} ms`);
  console.log(`  shotgun: mediaan ${s.mediaan} ms, max ${s.max} ms, beeld erna ${s.beeld} ms`);
  const grens = plek === 'lucht' ? p.mediaan * GRENS.lucht + 1 : Math.min(p.mediaan * GRENS.korrels + 1, GRENS.mediaan);
  ok(s.mediaan <= grens && s.max <= GRENS.maxMs, `een schot met het pompgeweer kost niet veel meer dan met het pistool`, `${s.mediaan} tegen ${p.mediaan} ms (grens ${grens.toFixed(1)}), max ${s.max} ms`);
  ok(s.beeld <= p.beeld * GRENS.beeld + 5, 'het beeld na het schot is niet trager', `${s.beeld} tegen ${p.beeld} ms`);
  if (plek === 'auto') ok(p.raakAuto >= 8 && s.raakAuto >= 12, 'de auto van dichtbij wordt nog geraakt (pistool en hagel)', `pistool ${p.raakAuto}, hagel ${s.raakAuto} treffers die tellen`);
}
kop('shaders');
ok(r.programmas.na === r.programmas.voor, 'geen nieuw shaderprogramma bij het schieten', `${r.programmas.voor} → ${r.programmas.na}`);
console.log(`\n  (${r.doelen} auto's in de doelenlijst van elke straal)`);

await browser.close();
console.log(fout ? `\n${fout} fout(en)` : '\nalles goed');
process.exit(fout ? 1 : 0);
