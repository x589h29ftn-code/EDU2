/*
 Toetst hoe de auto's van de computer door de bocht gaan (stap 98, "kan je auto's die
 door AI bestuurd worden ook bochten soepeler laten nemen?").

 1. De lijn: elke rijbaan is om de twee meter bemonsterd en gladgestreken, en blijft
    dicht bij de BGT-as (js/vehicles.js, `gladPad`).
 2. Het verkeer rijdt twintig seconden: geen draai in één beeld, geen sprong opzij,
    en nergens harder de bocht door dan de banden houden (dwarsversnelling).
 3. Eén wijkauto voor een scherpe bocht: hij remt er rustig voor af en rijdt door.
 4. Eén wijkauto aan het eind van zijn straat: hij keert met een halve cirkel in
    plaats van in één beeld om te draaien.
 5. De politie stuurt naar verhouding (`keys.stuur`) en slingert niet.
 6. De lijn van Bouwman (en zo ook die van de race): de neus draait ook tussen twee
    monsters door.

 Gebruik: npm run server &   node tools/bochtentest.mjs 8123
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fouten++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(() => {
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = false;
  window.__autoplay = false;
  g.sfeer.uur = 14;
  g.vehicles.drukte = 1;
});

// ------------------------------------------------------------------ 1. de lijn
kop('de lijn: gladgestreken en dicht bij de as');
const lijn = await page.evaluate(async () => {
  const { gladPad } = await import('/js/vehicles.js');
  const g = window.__game, V = g.vehicles;
  const assen = [...V.rijbanen, ...new Set(V.traffic.map(t => t.path))];
  const afst = (p, pts) => {
    let m = Infinity;
    for (let i = 1; i < pts.length; i++) {
      const A = pts[i - 1], B = pts[i], dx = B.x - A.x, dz = B.y - A.y, l2 = dx * dx + dz * dz || 1e-9;
      const t = Math.max(0, Math.min(1, ((p.x - A.x) * dx + (p.y - A.y) * dz) / l2));
      m = Math.min(m, Math.hypot(A.x + dx * t - p.x, A.y + dz * t - p.y));
    }
    return m;
  };
  let monsters = 0, maxAf = 0, maxStap = 0, zonderRaak = 0, glad = 0;
  for (const pts of assen) {
    const gp = pts.raak ? pts : gladPad(pts);
    if (!gp.raak || !gp.vmax) { zonderRaak++; continue; }
    if (gp === pts) { glad++; continue; }      // een verkeerspad: dat is al de gladde lijn
    for (let i = 0; i < gp.length; i++) {
      monsters++;
      if (i % 3 === 0) maxAf = Math.max(maxAf, afst(gp[i], pts));
      if (i) maxStap = Math.max(maxStap, gp[i].distanceTo(gp[i - 1]));
    }
  }
  // en elk rijdend verkeer rijdt op een gladde lijn
  const ruwVerkeer = V.traffic.filter(t => !t.path.raak).length;
  return { assen: assen.length, monsters, maxAf, maxStap, zonderRaak, ruwVerkeer, glad };
});
ok(lijn.zonderRaak === 0 && lijn.monsters > 20000, 'elke rijbaan heeft een gladde lijn met raaklijn en bochtsnelheid',
  `${lijn.assen} assen, ${lijn.monsters} monsters`);
// (om de twee meter bemonsterd; het gladstrijken rekt dat bij de uiteinden iets op)
ok(lijn.maxStap <= 2.5, 'om de twee meter een monster', `grootste stap ${lijn.maxStap.toFixed(2)} m`);
ok(lijn.maxAf <= 2.5, 'de gladde lijn blijft binnen 2,5 m van de BGT-as', `hoogstens ${lijn.maxAf.toFixed(2)} m`);
ok(lijn.ruwVerkeer === 0, 'al het rijdende verkeer rijdt over de gladde lijn', `${lijn.ruwVerkeer} op een ruwe as`);

// ------------------------------------------------------------------ 2. twintig seconden verkeer
kop('twintig seconden verkeer');
const rit = await page.evaluate(() => {
  const g = window.__game, V = g.vehicles, dt = 1 / 30;
  const hoek = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const uit = { beelden: 0, maxDraai: 0, maxDraaiWaar: '', maxSprong: 0, maxDwars: 0, maxDwarsWaar: '', teHard: 0, keren: 0, maxKeerDraai: 0 };
  let vorig = V.traffic.map(t => ({ x: t.mesh.position.x, z: t.mesh.position.z, yaw: t.mesh.rotation.y, keer: !!t.keer }));
  V.updateTraffic(dt);
  vorig = V.traffic.map(t => ({ x: t.mesh.position.x, z: t.mesh.position.z, yaw: t.mesh.rotation.y, keer: !!t.keer }));
  for (let stap = 0; stap < 600; stap++) {
    V.updateTraffic(dt);
    V.traffic.forEach((t, i) => {
      const o = vorig[i];
      const p = { x: t.mesh.position.x, z: t.mesh.position.z, yaw: t.mesh.rotation.y, keer: !!t.keer };
      vorig[i] = p;
      if (t.slaapt) return;
      const weg = Math.hypot(p.x - o.x, p.z - o.z);
      if (weg > 15) return;                        // de N7 begint weer vooraan: buiten de wereld
      uit.beelden++;
      const draai = Math.abs(hoek(p.yaw - o.yaw)) / dt;
      const v = Math.abs(t.snelheid);
      uit.maxSprong = Math.max(uit.maxSprong, weg - v * dt * 1.02 - 0.02);
      if (p.keer || o.keer) {
        uit.maxKeerDraai = Math.max(uit.maxKeerDraai, draai);
        if (!o.keer && p.keer) uit.keren++;
        return;
      }
      if (draai > uit.maxDraai) { uit.maxDraai = draai; uit.maxDraaiWaar = `${Math.round(p.x)},${Math.round(p.z)} op ${v.toFixed(1)} m/s`; }
      const dwars = draai * v;
      if (dwars > uit.maxDwars) { uit.maxDwars = dwars; uit.maxDwarsWaar = `${Math.round(p.x)},${Math.round(p.z)}${t.haast > 0 ? ' (haast)' : ''}`; }
      // op het stuk tussen twee monsters geldt de ruimste van de twee: de strengste is de bocht die nog komt
      const j0 = Math.max(0, Math.min(t.path.length - 2, Math.floor(t.t)));
      const vm = t.path.vmax ? Math.max(t.path.vmax[j0], t.path.vmax[j0 + 1]) : Infinity;
      if (!(t.haast > 0) && v > vm + 0.4) uit.teHard++;
    });
  }
  uit.rijdend = V.traffic.filter(t => !t.slaapt).length;
  return uit;
});
ok(rit.beelden > 5000, 'het verkeer rijdt', `${rit.rijdend} auto's, ${rit.beelden} auto-beelden`);
ok(rit.maxDraai < 1.4, 'geen draai in één beeld: hoogstens 1,4 rad/s', `${rit.maxDraai.toFixed(2)} rad/s bij ${rit.maxDraaiWaar}`);
ok(rit.maxSprong < 0.08, 'geen sprong opzij: een auto verplaatst zich niet verder dan hij rijdt', `${rit.maxSprong.toFixed(3)} m te veel`);
ok(rit.maxDwars < 4.5, 'dwarsversnelling in de bocht onder 4,5 m/s²', `${rit.maxDwars.toFixed(2)} m/s² bij ${rit.maxDwarsWaar}`);
ok(rit.teHard === 0, 'niemand rijdt harder dan de bochtsnelheid van de plek (behalve met haast)', `${rit.teHard} beelden te hard`);

// ------------------------------------------------------------------ 3. een scherpe bocht
kop('een wijkauto voor een scherpe bocht');
const bocht = await page.evaluate(async () => {
  const { gladPad } = await import('/js/vehicles.js');
  const g = window.__game, V = g.vehicles, dt = 1 / 30;
  // een bocht met een bochtsnelheid onder 5 m/s en zestig meter rechte aanloop ervoor
  let keus = null;
  for (const pts of V.rijbanen) {
    const gp = gladPad(pts);
    for (let i = 35; i < gp.length - 10 && !keus; i++) {
      if (gp.vmax[i] > 4.5 || gp.vmax[i] < 3) continue;
      let recht = true;
      for (let j = i - 32; j < i - 4; j++) if (gp.vmax[j] < 12) { recht = false; break; }
      if (recht) keus = { gp, i };
    }
    if (keus) break;
  }
  if (!keus) return null;
  const t = V.traffic.find(q => q.lokaal);
  const slapers = V.traffic.filter(q => q !== t && !q.slaapt);
  for (const q of slapers) q.slaapt = true;          // niemand anders in de weg
  t.slaapt = false; t.mesh.visible = true;
  t.path = keus.gp; t.t = keus.i - 30; t.dir = 1; t.keer = null; t.haast = 0; t.achteruit = 0;
  t.speed = 8; t.snelheid = 8; t.doel = 8;
  const vb = keus.gp.vmax[keus.i];
  let vBocht = Infinity, vMin = Infinity, maxRem = 0, vorige = t.snelheid, voorbij = false;
  for (let stap = 0; stap < 400 && !voorbij; stap++) {
    V.updateTraffic(dt);
    const v = t.snelheid;
    maxRem = Math.max(maxRem, (vorige - v) / dt);
    vorige = v;
    vMin = Math.min(vMin, v);
    if (Math.abs(t.t - keus.i) < 1) vBocht = Math.min(vBocht, v);
    if (t.t > keus.i + 8) voorbij = true;
  }
  for (const q of slapers) q.slaapt = false;
  const p = keus.gp[keus.i];
  return { vb, vBocht, vMin, maxRem, voorbij, waar: `${Math.round(p.x)},${Math.round(p.y)}` };
});
ok(!!bocht, 'er is een scherpe bocht met een rechte aanloop', bocht ? `bij ${bocht.waar}, bochtsnelheid ${bocht.vb.toFixed(1)} m/s` : 'niet gevonden');
if (bocht) {
  ok(bocht.vBocht <= bocht.vb + 0.4, 'in de bocht niet harder dan de bochtsnelheid', `${bocht.vBocht.toFixed(1)} m/s (van 8)`);
  ok(bocht.maxRem <= 4, 'rustig ervoor afgeremd, geen noodstop', `hoogstens ${bocht.maxRem.toFixed(1)} m/s²`);
  ok(bocht.voorbij && bocht.vMin > 1.5, 'en hij rijdt door', `laagste snelheid ${bocht.vMin.toFixed(1)} m/s`);
}

// ------------------------------------------------------------------ 4. keren aan het eind
kop('keren aan het eind van de straat');
const keer = await page.evaluate(() => {
  const g = window.__game, V = g.vehicles, dt = 1 / 30;
  const t = V.traffic.find(q => q.lokaal && q.bounce);
  const slapers = V.traffic.filter(q => q !== t && !q.slaapt);
  for (const q of slapers) q.slaapt = true;
  const n = t.path.length;
  t.t = n - 12; t.dir = 1; t.keer = null; t.haast = 0; t.achteruit = 0; t.snelheid = t.speed; t.doel = t.speed;
  V.updateTraffic(dt);
  const hoek = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  let o = { x: t.mesh.position.x, z: t.mesh.position.z, yaw: t.mesh.rotation.y };
  const yaw0 = o.yaw;
  let yawKeer = yaw0, gezien = false, klaar = false, maxDraai = 0, maxSprong = 0, vKeer = 0, draaiTot = 0;
  for (let stap = 0; stap < 600 && !klaar; stap++) {
    V.updateTraffic(dt);
    const p = { x: t.mesh.position.x, z: t.mesh.position.z, yaw: t.mesh.rotation.y };
    const d = hoek(p.yaw - o.yaw);
    maxDraai = Math.max(maxDraai, Math.abs(d) / dt);
    maxSprong = Math.max(maxSprong, Math.hypot(p.x - o.x, p.z - o.z) - Math.abs(t.snelheid) * dt * 1.02 - 0.02);
    if (t.keer && !gezien) yawKeer = o.yaw;       // de richting waarmee hij aan het keren begint
    if (t.keer) { gezien = true; vKeer = Math.max(vKeer, t.snelheid); draaiTot += d; }
    if (gezien && !t.keer) klaar = true;
    o = p;
  }
  for (const q of slapers) q.slaapt = false;
  return { gezien, klaar, maxDraai, maxSprong, vKeer, draaiTot, dir: t.dir, omgedraaid: Math.abs(hoek(o.yaw - yawKeer)) };
});
ok(keer.gezien && keer.klaar, 'hij keert met een halve cirkel en rijdt terug', `richting nu ${keer.dir}, ${Math.abs(keer.draaiTot).toFixed(2)} rad gedraaid tijdens het keren`);
ok(keer.omgedraaid > 2.9, 'en rijdt daarna de andere kant op', `${keer.omgedraaid.toFixed(2)} rad t.o.v. het begin van het keren`);
ok(keer.maxDraai < 3, 'geen halve draai in één beeld (hoogstens 3 rad/s)', `${keer.maxDraai.toFixed(2)} rad/s`);
ok(keer.maxSprong < 0.08, 'en geen sprong naar de andere strook', `${keer.maxSprong.toFixed(3)} m te veel`);
ok(keer.vKeer <= 3.3, 'stapvoets gekeerd', `${keer.vKeer.toFixed(1)} m/s`);

// ------------------------------------------------------------------ 5. de politie
kop('de politie stuurt naar verhouding');
const pol = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const g = window.__game, dt = 1 / 30;
  const as = KAART.wegassen.filter(w => w.drive && w.naam === 'Molenkrite' && w.lengte > 60)
    .sort((p, q) => { const m = (w) => { const t = w.pts[Math.floor(w.pts.length / 2)]; return Math.hypot(t[0], t[1]); }; return m(p) - m(q); })[0];
  const a = as.pts[Math.floor(as.pts.length / 2)];
  g.player.pos.set(a[0], 0, a[1]);
  g.player.health = 100;
  g.politie.reset();
  g.politie.misdaad('neergeschoten', a[0], a[1]);
  const wagenSteer = new Map();
  let beelden = 0, zwaai = 0, wissel = 0, vol = 0;
  for (let stap = 0; stap < 900; stap++) {
    g.politie.zetHeat(170);
    g.player.health = 100;
    g.politie.update(dt);
    for (const w of g.politie.intern.wagens) {
      const c = w.car;
      if (!c || w.klemT > 0 || Math.abs(c.speed) < 3) continue;
      const vorig = wagenSteer.get(w);
      wagenSteer.set(w, c.steer);
      if (vorig === undefined) continue;
      beelden++;
      zwaai += Math.abs(c.steer - vorig);
      if (Math.sign(c.steer) !== Math.sign(vorig) && Math.abs(c.steer) > 0.08 && Math.abs(vorig) > 0.08) wissel++;
    }
  }
  g.politie.reset();
  return { beelden, zwaai: beelden ? zwaai / (beelden * dt) : 0, wissel: beelden ? wissel / (beelden * dt) : 0 };
});
ok(pol.beelden > 200, 'er rijden surveillancewagens', `${pol.beelden} wagen-beelden`);
ok(pol.zwaai < 0.8, 'het stuur beweegt rustig (gemiddeld onder 0,8 rad/s)', `${pol.zwaai.toFixed(2)} rad/s`);
ok(pol.wissel < 0.5, 'geen slingeren: minder dan eens per twee tellen van links naar rechts', `${pol.wissel.toFixed(2)} keer per seconde`);

// ------------------------------------------------------------------ 6. de lijn van Bouwman
kop('de lijn van Bouwman: de neus draait tussen de monsters door');
const lijnB = await page.evaluate(() => {
  const S = window.__game.verhaal.schaduw.wereld;
  const L = S.lijn;
  const hoek = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  let maxFijn = 0, maxGrof = 0;
  let o = S.punt(0, 1.5);
  for (let s = 0.25; s < L.lengte; s += 0.25) {
    const p = S.punt(s, 1.5);
    maxFijn = Math.max(maxFijn, Math.abs(hoek(p.yaw - o.yaw)));
    o = p;
  }
  for (let i = 1; i < L.n; i++) maxGrof = Math.max(maxGrof, Math.abs(hoek(Math.atan2(-L.tx[i], -L.tz[i]) - Math.atan2(-L.tx[i - 1], -L.tz[i - 1]))));
  return { maxFijn, maxGrof, lengte: L.lengte };
});
ok(lijnB.maxFijn < lijnB.maxGrof * 0.3, 'per kwart meter draait de neus een fractie van een monsterstap',
  `${lijnB.maxFijn.toFixed(3)} rad per 0,25 m, tegen ${lijnB.maxGrof.toFixed(3)} rad per monster`);

console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
await browser.close();
process.exit(fouten ? 1 : 0);
