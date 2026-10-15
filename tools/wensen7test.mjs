/*
 Proef bij stap 182 (npm run wensen7test). Gevraagd op 15 okt 2026:
   1. met de Tiger blaas je mensen op in een straal rond de inslag (voetgangers, agenten), niet alleen wie er pal op staat;
   2. de regen duurt niet meer dagen: ook als de klok stilstaat wisselt het weer, en een bui heeft een maximum;
   3. uit een boot stap je op de wal met marge: niet in een botsdoos en niet met een voet in het water.

 Gebruik: npm run server &  node tools/wensen7test.mjs [poort]
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => { console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`); if (!goed) fouten++; };
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.setDefaultTimeout(900000);
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  for (const k of Object.keys(localStorage)) if (k.startsWith('tinga.spel')) localStorage.removeItem(k);
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  window.__W = await import('/js/world.js');
  g.player.active = false; window.__autoplay = false; g.sfeer.uur = 14;
});

// ------------------------------------------------------------------ 1. de knal van de Tiger
kop('1. de granaat van de Tiger raakt wie in de straal staat');
const knal = await page.evaluate(() => {
  const g = window.__game, P = g.politie, N = g.npcs;
  g.politie.proefStil = true;
  // een voetganger die echt op straat loopt, en de knal op 5 m van hem
  const q = N.people.find(p => p.alive && !p.slaapt && !p.fietst && !p.verborgen);
  const x = q.x + 5, z = q.z;
  const y = window.__W.grondHoogte(x, z, 3);
  // twee agenten: één op 4 m van de knal, één op 25 m
  const dicht = P.proef.agent(x - 1, z + 4), ver = P.proef.agent(x + 25, z);
  g.scene.updateMatrixWorld(true);
  const leven0 = g.player.health;
  g.player.pos.set(x + 60, 0, z + 60);
  const neer = g.explosieRaakt(x, y, z, 9);
  // en via de echte inslag van de granaat (js/main.js tigerInslag), met een tweede voetganger
  const q2 = N.people.find(p => p.alive && !p.slaapt && !p.fietst && !p.verborgen && Math.hypot(p.x - x, p.z - z) > 40);
  const x2 = q2.x - 6, z2 = q2.z;
  g.tigerInslag({ x: x2, y: window.__W.grondHoogte(x2, z2, 3), z: z2 });
  return { q: !q.alive, dicht: dicht.staat, ver: ver.staat, neer, leven: g.player.health === leven0, q2: !q2.alive, afstand2: 6 };
});
ok(knal.q, "een voetganger op 5 m van de knal gaat neer (was: hitPersoon(q, 99) = 99 treffers nodig, dus nooit)");
ok(knal.dicht === 'neer', 'een agent op 4 m ook', knal.dicht);
ok(knal.ver !== 'neer', 'een agent op 25 m niet', knal.ver);
ok(knal.q2, 'de echte inslag van de granaat (tigerInslag) neemt een voetganger op 6 m mee');
ok(knal.leven, 'Erik, ver weg, merkt er niets van');

// ------------------------------------------------------------------ 2. het weer
kop('2. de regen duurt niet eindeloos');
const weer = await page.evaluate(() => {
  const S = window.__game.sfeer;
  const voor = S.autoWeer;
  S.autoWeer = true; S.loopt = false;          // de klok staat stil, zoals in een missie 's nachts
  S.weer = 'regen';
  const dt = 2, totaal = 4 * 3600;             // vier uur echte tijd
  let langst = 0, nu = 0, wissel = 0, vorig = S.weerDoel;
  for (let t = 0; t < totaal; t += dt) {
    S.update(dt, 0, 0);
    if (Math.round(S.weerDoel) === 2) { nu += dt; langst = Math.max(langst, nu); } else nu = 0;
    if (S.weerDoel !== vorig) { wissel++; vorig = S.weerDoel; }
  }
  const uit = { langst, wissel, echt: S.WEER_ECHT, max: S.REGEN_MAX };
  S.autoWeer = voor; S.weer = 'helder'; S.uur = 14;
  return uit;
});
ok(weer.wissel >= 4, 'met de klok stil wisselt het weer toch', `${weer.wissel} keer in vier uur`);
ok(weer.langst <= (weer.max + 1) * weer.echt + 2, 'en een bui duurt hoogstens een paar uur op de klok', `langste bui ${(weer.langst / 60).toFixed(0)} min echte tijd (${(weer.langst / weer.echt).toFixed(1)} uur op de klok, grens ${weer.max + 1})`);

// ------------------------------------------------------------------ 3. uit de boot
kop('3. uitstappen uit de boot met marge');
const boot = await page.evaluate(async () => {
  const { vlakOp } = await import('/js/kaartwereld.js');
  const g = window.__game, B = g.boten, W = window.__W, P = g.player;
  const uit = { pogingen: 0, gelukt: 0, inDoos: [], natteVoet: [], inWater: [] };
  for (let i = 0; B.ruw(i); i++) {
    const b = B.ruw(i), x0 = b.x, z0 = b.z, yaw0 = b.yaw;
    // langs de kant: punten op het water binnen 4 m van land, rond de ligplaats
    const plekken = [];
    for (let r = 2; r <= 40 && plekken.length < 14; r += 2) for (let a = 0; a < 16; a++) {
      const x = x0 + Math.cos(a / 16 * 6.283) * r, z = z0 + Math.sin(a / 16 * 6.283) * r;
      if (!W.vaarbaar(x, z)) continue;
      let land = false;
      for (let k = 0; k < 8 && !land; k++) if (!W.vaarbaar(x + Math.cos(k / 8 * 6.283) * 3.5, z + Math.sin(k / 8 * 6.283) * 3.5)) land = true;
      if (land) plekken.push([x, z]);
    }
    for (const [x, z] of plekken) {
      b.x = x; b.z = z;
      B.stapIn(b);
      uit.pogingen++;
      if (!B.stapUit()) continue;
      uit.gelukt++;
      const px = P.pos.x, pz = P.pos.z;
      const [qx, qz] = W.resolveCollisions(px, pz, 0.45, 0, P.pos.y);
      if (Math.hypot(qx - px, qz - pz) > 0.05) uit.inDoos.push(`${px.toFixed(1)},${pz.toFixed(1)}`);
      if (W.pointInWater(px, pz)) uit.inWater.push(`${px.toFixed(1)},${pz.toFixed(1)}`);
      // (op een smalle steiger is water binnen een halve meter niet te vermijden: daar telt 0,3 m, het midden)
      else for (let k = 0, steiger = (vlakOp(px, pz) || {}).k === 'steiger'; k < 8; k++) if (W.pointInWater(px + Math.cos(k / 8 * 6.283) * (steiger ? 0.3 : 0.5), pz + Math.sin(k / 8 * 6.283) * (steiger ? 0.3 : 0.5))) { const v = vlakOp(px, pz); uit.natteVoet.push(`${px.toFixed(1)},${pz.toFixed(1)} (${v ? v.k : '-'}, boot ${i})`); break; }
    }
    b.x = x0; b.z = z0; b.yaw = yaw0;
  }
  return uit;
});
ok(boot.pogingen >= 20 && boot.gelukt >= boot.pogingen * 0.6, 'langs de kant kun je uitstappen', `${boot.gelukt} van ${boot.pogingen} plekken`);
ok(boot.inDoos.length === 0, 'nooit in een botsdoos (kademuur, hek, paal)', `${boot.inDoos.length}× ${boot.inDoos.slice(0, 4).join(' ')}`);
ok(boot.inWater.length === 0 && boot.natteVoet.length <= Math.max(1, boot.gelukt * 0.05), 'en niet met een voet in het water (op een smalle steiger: in het midden)', `${boot.inWater.length} in het water, ${boot.natteVoet.length} binnen 0,5 m ervan ${boot.natteVoet.slice(0, 6).join(' ')}`);

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);
