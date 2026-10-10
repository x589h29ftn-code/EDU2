/*
 Stap 128: de tweede ronde wensen van 10 okt 2026, nagemeten.

   node tools/server.mjs 8123 &   node tools/wensen2test.mjs [poort]   (npm run wensen2test)

 1. Geluid: de achtergronden minstens 75 % zachter, de explosie zachter, de heli zachter tegen het muziekje, en een
    AudioParam die een NaN krijgt blijft heel (na de hapering rond 18:00 viel al het geluid weg).
 2. De mouw met een elleboog: geen schijf onder in beeld, ook niet bij het richten; rennen met het pistool zonder
    schokken als de beelden ongelijk komen.
 3. Shift: de auto 15 % harder, de boot ook sneller.
 4. Geen oeverwanden midden in het water; de camera klimt niet bij een boomstam.
 5. De eerste keer thuis: uitleg; het vlees gaar en jij weg: waar je heen moet.
 6. Missie 7: Mark praat vanzelf onderweg, over De Veteraan, en houdt op bij de Poiesz; de gele cirkel bij de ingang.
 7. Na missie 7 en 8: niet wachten op de telefoon, een J bij Johan (en een M bij Mark) start de missie.
 8. Missie 8: € 2.500 en kogels van Johan; missie 9 zonder spanningsmuziek.
 9. In een boot gaat de route over het water.
10. Meer ambulances en vrachtwagens.
11. Missie 18: vuur van beneden met tracers, niet hard; zwaailichten op de auto van Bouwman; de handlangers raken minder;
    bij de loods komen ze naar buiten rennen en blijven ze op afstand.
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
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
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

// ------------------------------------------------------------------ 1. geluid
kop('geluid');
const gl = await page.evaluate(async () => {
  const A = await import('/js/audio.js');
  const ctx = new AudioContext();
  const gn = ctx.createGain(); gn.gain.value = 0.5;
  let gooit = false;
  try { gn.gain.value = NaN; gn.gain.setTargetAtTime(NaN, 0, 0.1); gn.gain.linearRampToValueAtTime(Infinity, 1); } catch (e) { gooit = true; }
  const bron = await fetch('/js/audio.js').then(r => r.text());
  const expl = (bron.match(/g\.gain\.value = Math\.min\(([\d.]+), ([\d.]+) \* v\)/) || []).slice(1).map(Number);
  return { dag: A.ACHTERGROND.dag.vol, nacht: A.ACHTERGROND.nacht.vol, heli: A.HELI_ROND.luid, muziek: A.HELI_MUZIEK.vol,
    nan: gn.gain.value, gooit, expl };
});
ok(gl.dag <= 0.55 * 0.25 && gl.nacht <= 0.30 * 0.25, 'de achtergronden minstens 75 % zachter', `dag ${gl.dag} (was 0,55), nacht ${gl.nacht} (was 0,30)`);
ok(gl.expl.length === 2 && gl.expl[1] < 0.95, 'de explosie zachter', `${gl.expl.join(' / ')} (was 0,95 per luid)`);
ok(gl.muziek / gl.heli > (0.5 / 2.6) * 2.5, 'de heli zachter tegen het muziekje', `muziek ${gl.muziek}, wieken ${gl.heli} (was 0,5 en 2,6)`);
ok(gl.nan === 0.5 && !gl.gooit, 'een NaN in een AudioParam wordt geweigerd', `waarde ${gl.nan}`);

// ------------------------------------------------------------------ 2. de mouw en het rennen
kop('de mouw en het rennen');
const mw = await page.evaluate(async () => {
  const g = window.__game, P = g.player, THREE = await import('/lib/three.module.js');
  const cam = g.camera;
  cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
  const inv = new THREE.Matrix4().copy(cam.matrixWorld).invert();
  const uit = {};
  for (const w of ['pistool', 'mes']) {
    const mod = P.modellen[w];
    if (!mod) continue;
    for (const mik of [0, 1]) {
      if (mod.update) for (let i = 0; i < 60; i++) mod.update(1 / 60, { mik, bob: 0 });
      mod.groep.updateMatrixWorld(true);
      // wat van het model vlak voor je oog in beeld komt (< 18 cm): dat was de blauwe schijf
      let dichtbij = 0, achter = -Infinity;
      const v3 = new THREE.Vector3();
      mod.groep.traverse(o => {
        if (!o.isMesh || !o.visible) return;
        const pos = o.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          v3.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
          achter = Math.max(achter, v3.z);
          if (v3.z > -0.18 || v3.z < -cam.near) {
            if (v3.z < -cam.near && v3.z > -0.18) {
              const p = v3.clone().applyMatrix4(cam.projectionMatrix);
              if (Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1) dichtbij++;
            }
          }
        }
      });
      uit[`${w}${mik}`] = { dichtbij, achter };
    }
  }
  // rennen met het pistool: dezelfde pas, gelijke en ongelijke beelden
  const mod = P.modellen.pistool;
  const ren = (ongelijk) => {
    for (let i = 0; i < 120; i++) mod.update(1 / 60, { bob: 0 });
    let bob = 0, t = 0, vorig = null, sprong = 0, n = 0;
    while (t < 4) {
      const dt = ongelijk ? (n % 3 === 0 ? 0.034 : 0.011) : 1 / 60;
      bob += 14 * dt; t += dt; n++;
      mod.update(dt, { bob, yaw: 0, pitch: 0 });
      const p = mod.groep.position.clone();
      // de verplaatsing per seconde, in beelden van verschillende lengte
      if (vorig && t > 1) sprong = Math.max(sprong, p.distanceTo(vorig) / dt);
      vorig = p;
    }
    return sprong;
  };
  uit.renGelijk = ren(false); uit.renOngelijk = ren(true);
  return uit;
});
for (const k of ['pistool0', 'pistool1', 'mes0']) if (mw[k]) {
  ok(mw[k].dichtbij === 0, `geen mouw vlak voor je oog in beeld (${k.replace('0', ', uit de heup').replace('1', ', richtend')})`, `${mw[k].dichtbij} punten, het verst ${mw[k].achter.toFixed(2)} m achter het oog`);
}
ok(mw.pistool0 && mw.pistool0.achter > 0.05, 'de mouw loopt nog steeds tot achter de camera', `${mw.pistool0 && mw.pistool0.achter.toFixed(2)} m`);
ok(mw.renOngelijk < mw.renGelijk * 1.6 + 0.05, 'rennen met het pistool: ongelijke beelden schokken niet', `${r1(mw.renOngelijk)} tegen ${r1(mw.renGelijk)} m/s`);

// ------------------------------------------------------------------ 3. shift
kop('shift: boost');
const bs = await page.evaluate(async () => {
  const g = window.__game, V = await import('/js/vehicles.js'), B = await import('/js/boot.js');
  const top = (shift) => {
    const c = g.vehicles.voegToe({ x: -9000 - (shift ? 60 : 0), z: -9000, yaw: 0, soort: 'hatch', kleur: 0x888888, driveable: true });
    const keys = { KeyW: true, ShiftLeft: shift };
    let max = 0;
    for (let i = 0; i < 900; i++) { g.vehicles.drive(c, keys, 1 / 30); max = Math.max(max, c.speed); }
    g.vehicles.verwijder(c);
    return max;
  };
  const zonder = top(false), met = top(true);
  // de boot: de evenwichtssnelheid uit stuw en weerstand
  const S = B.SLOEP;
  const evenwicht = (s) => Math.min(S.TOP * s, Math.sqrt(Math.max(0, S.STUW * s - S.LANGS_VAST) / S.LANGS));
  return { zonder, met, boost: V.BOOST, boot: evenwicht(B.BOOT_BOOST) / evenwicht(1) };
});
ok(bs.met / bs.zonder > 1.12 && bs.met / bs.zonder < 1.18, 'de auto met shift 15 % harder', `${r1(bs.zonder * 3.6)} → ${r1(bs.met * 3.6)} km/u`);
ok(bs.boot > 1.15, 'de boot met shift sneller', `× ${bs.boot.toFixed(2)}`);

// ------------------------------------------------------------------ 4. oevers en de camera bij een stam
kop('oevers en de camera');
const ov = await page.evaluate(() => {
  const g = window.__game, W = window.__W;
  // water zoals de bouw het ziet: de vlakken uit de kaart, met hun gaten (eilanden)
  const inRing = (x, z, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  const vl = (window.__K.vlakken || []).filter(v => v.k === 'water').map(v => {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of v.r[0]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    return { v, x0, x1, z0, z1 };
  });
  const nat = (x, z) => vl.some(w => x >= w.x0 && x <= w.x1 && z >= w.z0 && z <= w.z1 && inRing(x, z, w.v.r[0]) && !w.v.r.slice(1).some(g => inRing(x, z, g)));
  let n = 0, beide = 0;
  g.scene.traverse(o => {
    if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
    const m = o.material._bron || o.material;
    if (!m.color || m.color.getHex() !== 0x5f5140 || m.side !== 2) return;
    const pos = o.geometry.attributes.position;
    for (let t = 0; t + 2 < pos.count; t += 3 * 5) {
      const ax = pos.getX(t), az = pos.getZ(t), bx = pos.getX(t + 1), bz = pos.getZ(t + 1), cx = pos.getX(t + 2), cz = pos.getZ(t + 2);
      // de horizontale lijn van de driehoek
      let dx = bx - ax, dz = bz - az;
      if (Math.hypot(dx, dz) < 0.05) { dx = cx - ax; dz = cz - az; }
      const L = Math.hypot(dx, dz);
      if (L < 0.05) continue;
      const mx = (ax + bx + cx) / 3, mz = (az + bz + cz) / 3, nx = dz / L * 0.4, nz = -dx / L * 0.4;
      n++;
      if (nat(mx + nx, mz + nz) && nat(mx - nx, mz - nz)) beide++;
    }
  });
  // de camera: een stam van 40 cm om het draaipunt, en ter controle een muur erachter
  W.addCollider(-9000, -9000, 0.2, 0.2, 0, 8);
  const d = Math.hypot(0, 0.3, 1);
  const stam = W.vrijeCamera(-9000, 1.5, -9000, 0, 0.3 / d, 1 / d, 6);
  W.addCollider(-9100, -9097, 3, 0.4, 0, 8);
  const muur = W.vrijeCamera(-9100, 1.5, -9100, 0, 0.3 / d, 1 / d, 6);
  return { n, beide, stam, muur };
});
ok(ov.n > 1000 && ov.beide / ov.n < 0.004, 'geen oeverwand met water aan beide kanten', `${ov.beide} van ${ov.n} gemeten driehoeken`);
ok(ov.stam > 5.9, 'in een boomstam blijft de camera op zijn plek', `${r1(ov.stam)} m van de 6`);
ok(ov.muur < 3.5, 'tegenproef: een muur erachter trekt de camera wel in', `${r1(ov.muur)} m`);

// ------------------------------------------------------------------ 5. thuis
kop('thuis');
const th = await page.evaluate(async () => {
  const main = await fetch('/js/main.js').then(r => r.text());
  const i = main.indexOf("uitleg.toon('thuis'");
  const stuk = i < 0 ? '' : main.slice(i, i + 900).toLowerCase();
  const inter = await fetch('/js/interieur.js').then(r => r.text());
  return { uitleg: i >= 0, woorden: ['bank', 'radio', 'bier', 'barbecue', 'opslaan'].filter(w => stuk.includes(w)), bbq: /Ga terug naar \$\{HUIS\.naam/.test(inter) };
});
ok(th.uitleg && th.woorden.length >= 4, 'de eerste keer thuis: wat je er kunt doen', th.woorden.join(', '));
ok(th.bbq, 'het vlees gaar en jij weg: ga terug naar je huis om te eten');

// ------------------------------------------------------------------ 6. missie 7 onderweg
kop('missie 7: onderweg');
const bm = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  const s = v.bewaar(); s.missie = 'bom'; s.fase = 'instappen'; s.punt = { missie: 'bom', fase: 'instappen' };
  g.politie.reset();
  v.herstel(s);
  v.stap128.hervatBom('instappen');
  window.__stap(2);
  const x = v.stap128, ing = x.ingang;
  const uit = { fase: v.fase, merk: !!(x.ingangMerk && x.ingangMerk.zichtbaar) };
  if (x.ingangMerk) { const p = x.ingangMerk.groep.position; uit.merkAf = Math.hypot(p.x - ing.stoep.x, p.z - ing.stoep.z); }
  // in een auto, een eind van de Poiesz
  const auto = g.vehicles.voegToe({ x: P.pos.x + 3, z: P.pos.z, yaw: 0, soort: 'hatch', kleur: 0x777777, driveable: true });
  P.inCar = auto; auto.speed = 8;
  const zinnen = new Set();
  let klik = 0;
  for (let t = 0; t < 45; t += 0.05) {
    g.player.health = 100;
    v.update(0.05);
    const d = document.getElementById('dialoog');
    if (!d.hidden) zinnen.add(document.getElementById('dialoogTekst').textContent);
  }
  uit.zinnen = [...zinnen];
  uit.praatI = v.stap128.bomPraatI;
  // aangekomen bij de ingang, stilstaand
  const open = !document.getElementById('dialoog').hidden;
  auto.x = ing.stoep.x; auto.z = ing.stoep.z; auto.speed = 0;
  if (auto.mesh) auto.mesh.position.set(auto.x, auto.mesh.position.y, auto.z);
  v.update(0.05);
  uit.naAankomst = v.fase;
  uit.praatNa = v.stap128.bomPraatI;
  for (let t = 0; t < 10; t += 0.05) { v.update(0.05); }
  uit.praatLater = v.stap128.bomPraatI;
  uit.merkNa = !!(x.ingangMerk && x.ingangMerk.zichtbaar);
  uit.wasOpen = open;
  P.inCar = null; g.vehicles.verwijder(auto);
  return uit;
});
ok(bm.merk && bm.merkAf < 1, 'een gele cirkel bij de ingang van de Poiesz', `${bm.merk}, ${r1(bm.merkAf)} m van de stoep`);
ok(bm.praatI >= 5, 'onderweg praat Mark vanzelf, zonder te klikken', `${bm.praatI} zinnen in 45 s`);
const tekst = bm.zinnen.join(' ');
ok(/Top 1 Toys/.test(tekst) || /Duitsers/.test(tekst) || /No Mercy/.test(tekst), 'over De Veteraan: Top 1 Toys, de Duitsers, No Mercy', bm.zinnen.slice(0, 3).join(' | ').slice(0, 160));
ok(bm.naAankomst !== 'instappen' && bm.praatLater === bm.praatNa && !bm.merkNa, 'bij aankomst houdt het praten op en gaat de cirkel weg', `${bm.naAankomst}, ${bm.praatNa} → ${bm.praatLater}`);

// ------------------------------------------------------------------ 7. niet wachten op de telefoon
kop('na missie 7 en 8: een J en een M');
const vr = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  const uit = {};
  for (const [naam, letter] of [['sniper', 'J'], ['huis', 'M']]) {
    const s = v.bewaar(); s.missie = 'klaar'; s.fase = 'klaar';
    g.politie.reset();
    v.herstel(s);
    P.inCar = null;
    v.stap128.zetWacht(naam, 120);
    for (let i = 0; i < 4; i++) v.update(0.05);
    const nav = g.hud.nav;
    const r = { letter: nav && nav.letter, doel: nav && nav.doel, missieVoor: v.missie };
    // erheen lopen
    if (nav && nav.doel) { P.pos.set(nav.doel[0] + 1.2, P.pos.y, nav.doel[1] + 1.2); }
    for (let i = 0; i < 10; i++) { g.player.health = 100; v.update(0.05); }
    r.missie = v.missie; r.fase = v.fase; r.wacht = v.stap128.naMissieT;
    uit[naam] = r;
    window.__klik(200);
  }
  return uit;
});
ok(vr.sniper.letter === 'J' && vr.sniper.missieVoor === 'klaar', 'tijdens het wachten op missie 8 een J bij Johan', JSON.stringify(vr.sniper.doel));
ok(vr.sniper.missie === 'sniper' && vr.sniper.wacht === 0, 'erheen gaan begint missie 8', `${vr.sniper.missie}/${vr.sniper.fase}`);
ok(vr.huis.letter === 'M', 'tijdens het wachten op missie 9 een M bij Mark');
ok(vr.huis.missie === 'huis' && vr.huis.wacht === 0, 'erheen gaan begint missie 9', `${vr.huis.missie}/${vr.huis.fase}`);

// ------------------------------------------------------------------ 8. missie 8 en 9
kop('missie 8 en 9');
const sn = await page.evaluate(async () => {
  const bron = await fetch('/js/verhaal.js').then(r => r.text());
  const g = window.__game, v = g.verhaal;
  return { beloning: Number((bron.match(/const SNIP_BELONING = (\d+)/) || [])[1]), doos: Number((bron.match(/const SNIP_DOOS = (\d+)/) || [])[1]),
    huisSpanning: v.missie === 'huis' ? v.spanning : null };
});
ok(sn.beloning === 2500, 'missie 8 levert € 2.500 op', `${sn.beloning}`);
ok(sn.doos > 0, 'zonder kogels gooit Johan je een doos toe', `${sn.doos}`);
if (sn.huisSpanning !== null && sn.huisSpanning !== undefined) ok(!sn.huisSpanning, 'missie 9 zonder spanningsmuziek');

// ------------------------------------------------------------------ 9. de route met de boot
kop('de route met de boot');
const bt = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player, W = window.__W;
  const B = typeof g.boten === 'function' ? g.boten() : g.boten;
  if (!B) return { geen: true };
  const a = B.ruw(0), b = B.ruw(1);
  const inWater = (x, z) => W.pointInWater(x, z);
  const deel = (route) => { let n = 0, nat = 0; for (let i = 0; i + 1 < route.length; i++) for (let k = 1; k <= 4; k++) { const f = k / 5, x = route[i][0] + (route[i + 1][0] - route[i][0]) * f, z = route[i][1] + (route[i + 1][1] - route[i][1]) * f; n++; if (inWater(x, z)) nat++; } return n ? nat / n : 0; };
  P.pos.set(a.x, P.pos.y, a.z);
  v.stap128.navNaar(b.x, b.z);
  const land = g.hud.nav && g.hud.nav.route ? deel(g.hud.nav.route) : -1;
  B.stapIn(a);
  v.stap128.navNaar(b.x, b.z);
  const water = g.hud.nav && g.hud.nav.route ? deel(g.hud.nav.route) : -1;
  B.stapUit();
  g.hud.zetNavigatie(null);
  return { land, water };
});
ok(!bt.geen && bt.water > 0.85, 'in een boot gaat de route over het water', `${Math.round(bt.water * 100)} % op het water (te voet ${Math.round(bt.land * 100)} %)`);

// ------------------------------------------------------------------ 10. ambulances en vrachtwagens
kop('ambulances en vrachtwagens');
const av = await page.evaluate(async () => {
  const A = await import('/js/ambulance.js');
  const g = window.__game;
  return { kans: A.AMB.kans, rust: A.AMB.rust, trucks: g.vehicles.traffic.filter(t => t.soort === 'truck').length, n: g.vehicles.traffic.length };
});
ok(av.kans >= 0.8 && av.rust <= 60, 'vaker een ambulance', `kans ${av.kans} (was 0,4), rust ${av.rust} s (was 120)`);
ok(av.trucks >= 4, 'vrachtwagens in het verkeer', `${av.trucks} van ${av.n}`);

// ------------------------------------------------------------------ 11. missie 18
kop('missie 18: de heli');
const hl = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  window.__bij('heli');
  window.__tot('heli', 12);
  const a = v.avond, G = a.grondvuur;
  const uit = { fase: v.fase, mannen: G.mannen.length };
  P.health = 100;
  let strepen = 0, minLeven = 100, lampen = new Set(), gezien = 0;
  for (let t = 0; t < 70 && v.fase === 'heli'; t += 0.05) {
    v.update(0.05);
    strepen = Math.max(strepen, G.strepen);
    minLeven = Math.min(minLeven, P.health);
    if (P.health < 40) P.health = 100;
    const ra = v.avond.ritAuto, z = ra && ra.zwaailicht;
    if (z) { gezien++; lampen.add(Math.round(z.links.material.emissiveIntensity * 10)); }
  }
  uit.schoten = G.schoten; uit.raak = G.treffers; uit.strepen = strepen; uit.schade = 100 - minLeven; uit.lampen = [...lampen]; uit.gezien = gezien;
  return uit;
});
ok(hl.fase === 'heli' && hl.mannen >= 5, 'mannen langs de weg van Bouwman', `${hl.mannen}`);
ok(hl.schoten >= 5 && hl.strepen >= 1, 'ze schieten omhoog, met tracers', `${hl.schoten} schoten, ${hl.strepen} strepen tegelijk`);
ok(hl.raak <= Math.max(2, hl.schoten * 0.2), 'en ze raken zelden', `${hl.raak} van ${hl.schoten}`);
ok(hl.gezien > 0 && hl.lampen.length >= 2, 'de auto van Bouwman met zwaailicht', `${hl.lampen.join(',')}`);

kop('missie 18: de achtervolging en de loods');
const hd = await page.evaluate(async () => {
  const H = await import('/js/handlangers.js');
  return { kans: H.HANDLANGERS.kans, schade: H.HANDLANGERS.schade, min: H.HANDLANGERS.kansMin };
});
ok(hd.kans <= 0.2 && hd.schade <= 3 && hd.min < 0.06, 'de handlangers raken minder hard', `kans ${hd.kans} (was 0,30), schade ${hd.schade} (was 4), minimaal ${hd.min}`);
const ld = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  window.__bij('gevecht');
  window.__stap(2);
  const M = v.avond.mannen;
  const inLoods = (p) => p.x > 1396 && p.x < 1418 && p.z > -194 && p.z < -182;
  const pos = () => M.wachters.map(w => ({ x: w.persoon.groep.position.x, z: w.persoon.groep.position.z }));
  const begin = pos().filter(inLoods).length;
  // de speler staat op de oprit, uit de auto
  if (P.inCar) P.inCar = null;
  P.pos.set(1412, P.pos.y, -214);
  let minAf = Infinity, buitenOp = null;
  for (let t = 0; t < 25; t += 0.05) {
    g.player.health = 100;
    v.update(0.05);
    const p = pos();
    if (buitenOp === null && p.filter(inLoods).length === 0) buitenOp = t;
    if (t > 8) for (const q of p) minAf = Math.min(minAf, Math.hypot(q.x - 1412, q.z - -214));
  }
  return { begin, buitenOp, minAf, n: M.wachters.length };
});
ok(ld.begin >= 4, 'bij het begin staan ze binnen in de loods', `${ld.begin} van ${ld.n}`);
ok(ld.buitenOp !== null && ld.buitenOp < 15, 'en komen ze naar buiten rennen', `na ${r1(ld.buitenOp)} s`);
ok(ld.minAf >= 12, 'ze blijven op afstand: ruimte voor dekking', `dichtstbij ${r1(ld.minAf)} m`);

console.log(fouten ? `\n${fouten} fout(en)` : '\nAlles goed.');
console.log('EINDE');
await browser.close();
process.exit(fouten ? 1 : 0);
