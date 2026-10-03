/*
 Vier punten van 3 okt 2026 (stap 106):

   "de Ferrari draait nu wel heel lastig links en rechts"
   "als je bij de Tinga State wapens koopt zie je onderin de te kopen wapens met icoontjes en
    prijs; dit overzicht verdwijnt niet als je wegloopt"
   "als Bouwman geramd wordt kan hij soms in een hokje van een huis terechtkomen, lijkt geen
    collision tijdens rammen"
   "laat de speler beginnen met 200 kogels voor het gemak"

   node tools/server.mjs 8123 &   node tools/puntentest.mjs [poort]   (npm run puntentest)

 1. Het sturen van de Ferrari gemeten: de draai in een seconde vol naar links op 120 en 200 km/u,
    de dwarsversnelling, een tikje van een tiende seconde, en de hatchback die bleef wat hij was.
 2. Het schap: niet het hidden-attribuut tellen maar wat er in beeld staat (getComputedStyle).
    De oude proef (tools/meldtest.mjs) keek naar `.hidden` en was groen terwijl het schap bleef
    staan: `#schap { display: flex }` won van het attribuut. Daarom ook: elk element in de hele
    pagina met hidden heeft display none.
 3. De schuif na de klap tegen echte schuren en muren uit de wereld: een plek naast een hokje
    waar de oude schuif (zeven meter opzij) erdoorheen ging; nu stopt hij ervoor of gaat de
    andere kant op, en elk stukje van de baan is vrij. Bouwman rent daarna een vrije kant op.
 4. Een nieuw spel: 12 in het pistool en 200 in reserve.
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
const page = await browser.newPage({ viewport: { width: 1100, height: 680 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

// ------------------------------------------------------------------ 4. kogels (eerst: nog niets veranderd)
kop('een nieuw spel');
const kogels = await page.evaluate(() => {
  const p = window.__game.player;
  return { ammo: p.ammo, reserve: p.reserve, opslag: localStorage.getItem('tinga.spel.v1') };
});
ok(kogels.opslag === null, 'geen opgeslagen spel in deze browser');
ok(kogels.ammo === 12 && kogels.reserve === 200, 'je begint met 12 in het pistool en 200 in reserve', `${kogels.ammo} / ${kogels.reserve}`);

await page.evaluate(() => {
  document.getElementById('overlay').style.display = 'none';
  window.__game.player.active = true;
});

// ------------------------------------------------------------------ 1. de Ferrari
kop('sturen');
const stuur = await page.evaluate(() => {
  const V = window.__game.vehicles;
  // op een lege vlakte buiten de kaart; de snelheid vast, alleen het stuur
  // `oud`: zoals vóór stap 106, de grip van een hatchback en het stuur meteen vol (keys.stuur
  // houdt het snelle tempo van toen)
  const meet = (soort, kmh, tik, grip = null, oud = false) => {
    const car = V.voegToe({ x: 4000 + Math.random() * 50, z: 4000, yaw: 0, soort, kleur: 0xc40a12 });
    if (grip) car.grip = grip;
    const v0 = kmh / 3.6, dt = 1 / 60, y0 = car.yaw;
    car.speed = v0; car.steer = 0;
    let maxDwars = 0, vorig = car.yaw;
    for (let i = 0; i < 60; i++) {
      car.speed = v0; V.drive(car, oud ? { stuur: i * dt < tik ? 1 : 0 } : { KeyA: i * dt < tik }, dt);
      maxDwars = Math.max(maxDwars, Math.abs(car.yaw - vorig) / dt * v0); vorig = car.yaw;
    }
    const uit = { draai: car.yaw - y0, dwars: maxDwars, grip: car.grip };
    car.driveable = false; car.mesh.visible = false; car.x = car.z = 1e5; car.mesh.position.set(1e5, 0, 1e5);
    return uit;
  };
  return {
    f120: meet('ferrari', 120, 1), f200: meet('ferrari', 200, 1), tik200: meet('ferrari', 200, 0.1),
    oud120: meet('ferrari', 120, 1, 26, true), oud200: meet('ferrari', 200, 1, 26, true), oudTik200: meet('ferrari', 200, 0.1, 26, true),
    f40: meet('ferrari', 40, 1), h80: meet('hatch', 80, 1), h40: meet('hatch', 40, 1),
  };
});
const r = (x) => x.toFixed(2);
ok(stuur.f120.draai > 1.0 && stuur.f120.draai > stuur.oud120.draai * 1.3, 'de Ferrari op 120 km/u: een seconde vol naar links draait hij een stuk verder', `${r(stuur.f120.draai)} rad (was ${r(stuur.oud120.draai)})`);
ok(stuur.f200.draai > 0.6 && stuur.f200.draai > stuur.oud200.draai * 1.3, 'en op 200 km/u ook', `${r(stuur.f200.draai)} rad (was ${r(stuur.oud200.draai)})`);
ok(stuur.f200.dwars <= stuur.f200.grip + 1 && stuur.f120.dwars <= stuur.f120.grip + 1, 'niet harder dan zijn banden houden', `${stuur.f200.dwars.toFixed(1)} m/s² bij een grip van ${stuur.f200.grip}`);
ok(stuur.tik200.draai < 0.06, 'een tikje op 200 km/u blijft een kleine koerswijziging', `${(stuur.tik200.draai * 180 / Math.PI).toFixed(1)}° (was ${(stuur.oudTik200.draai * 180 / Math.PI).toFixed(1)}°)`);
ok(stuur.f40.draai > 1.0, 'langzaam stuurt hij gewoon', `${r(stuur.f40.draai)} rad op 40 km/u`);
ok(stuur.h80.grip === 26 && stuur.h80.dwars <= 27, 'de hatchback houdt zijn grip van 26', `${stuur.h80.dwars.toFixed(1)} m/s² op 80 km/u, ${r(stuur.h80.draai)} rad`);

// ------------------------------------------------------------------ 2. het schap
kop('het schap van Tinga State');
const schap = await page.evaluate(() => {
  const g = window.__game, b = g.boerderij, el = document.getElementById('schap');
  const inBeeld = () => getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
  g.player.pos.set(b.plekken.toonbank.x, 0, b.plekken.toonbank.z);
  b.update(0.1, false);
  const aan = inBeeld(), kaartjes = el.querySelectorAll('.kaart').length;
  g.player.pos.set(b.plekken.deurBuiten.x + 40, 0, b.plekken.deurBuiten.z + 40);
  b.update(0.1, false);
  const weg = !inBeeld();
  // terug naar de toonbank: hij komt terug; en weg in een auto ook
  g.player.pos.set(b.plekken.toonbank.x, 0, b.plekken.toonbank.z);
  b.update(0.1, false);
  const terug = inBeeld();
  b.update(0.1, true);
  const bezet = !inBeeld();
  // de hele pagina: wat hidden draagt, staat niet in beeld
  const fout = [];
  for (const e of document.querySelectorAll('[hidden]')) {
    if (getComputedStyle(e).display !== 'none') fout.push(e.id || e.className || e.tagName);
  }
  return { aan, kaartjes, weg, terug, bezet, fout, n: document.querySelectorAll('[hidden]').length };
});
ok(schap.aan && schap.kaartjes >= 2, 'aan de toonbank: de kaartjes met plaatje en prijs', `${schap.kaartjes} kaartjes`);
ok(schap.weg, 'weglopen: het schap is echt weg (getComputedStyle, niet alleen het attribuut)');
ok(schap.terug && schap.bezet, 'terug aan de toonbank weer in beeld, en weg in een gesprek');
ok(schap.fout.length === 0, 'geen enkel element met hidden staat toch in beeld', schap.fout.length ? schap.fout.join(', ') : `${schap.n} verborgen elementen nagekeken`);

// ------------------------------------------------------------------ 3. de crash
kop('de klap van Bouwman');
const crash = await page.evaluate(async () => {
  const W = await import('/js/world.js');
  const I = await import('/js/inval.js');
  const car = { as: 1.4, botsRadius: 1.0, mesh: { position: { y: 0 } } };
  const sp = window.__game.player.pos;
  // de drie cirkels van de auto op een stand (e) van de baan
  const raakt = (c, kant, e) => {
    const x = c.van.x + (c.zij.x * 7 * kant + c.voor.x * 5) * e, z = c.van.z + (c.zij.z * 7 * kant + c.voor.z * 5) * e;
    const yaw = c.yaw - 1.1 * kant * e, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    let diep = 0;
    for (const off of [-car.as, 0, car.as]) {
      const px = x + fx * off, pz = z + fz * off;
      const [rx, rz] = W.resolveCollisions(px, pz, car.botsRadius, 3.5, 0);
      diep = Math.max(diep, Math.hypot(rx - px, rz - pz));
    }
    return diep;
  };
  // hokjes in de buurt van het begin: kleine dozen, hoog genoeg om tegenaan te schuiven
  const hokjes = W.colliders.filter(c => c.h >= 1.8 && c.h < 6 && Math.max(c.hx, c.hz) < 3
    && Math.hypot(c.cx - sp.x, c.cz - sp.z) < 600);
  const plekken = [];
  for (const h of hokjes) {
    for (let k = 0; k < 8 && plekken.length < 12; k++) {
      const a = k * Math.PI / 4, dx = Math.cos(a), dz = Math.sin(a);
      const afst = Math.max(h.hx, h.hz) + 2.6;
      const x = h.cx + dx * afst, z = h.cz + dz * afst;
      // de auto met zijn linkerkant (zij) naar het hokje: zij = (cos yaw, −sin yaw) = −richting
      const yaw = Math.atan2(dz, -dx);
      const tx = -Math.sin(yaw), tz = -Math.cos(yaw);
      const c = { van: { x, z }, zij: { x: -tz, z: tx }, voor: { x: tx, z: tz }, yaw };
      if (raakt(c, 1, 0) > 0.01 || W.pointInWater(x, z)) continue;          // hij moet vrij beginnen
      let oud = 0;
      for (let e = 0; e <= 1.0001; e += 0.01) oud = Math.max(oud, raakt(c, 1, e));
      if (oud < 0.5) continue;                                               // de oude schuif moet erin gaan
      plekken.push(c);
      break;
    }
    if (plekken.length >= 12) break;
  }
  const uit = [];
  for (const c of plekken) {
    const links = I.crashSchuif(car, c, 1), rechts = I.crashSchuif(car, c, -1);
    const kant = rechts > links + 0.05 ? -1 : 1, ver = Math.max(links, rechts);
    let diep = 0;
    for (let e = 0; e <= ver + 1e-6; e += 0.005) diep = Math.max(diep, raakt(c, kant, e));
    // Bouwman rent: van naast de auto naar een vrije kant, en elk stukje is vrij
    const ex = c.van.x + (c.zij.x * 7 * kant + c.voor.x * 5) * ver, ez = c.van.z + (c.zij.z * 7 * kant + c.voor.z * 5) * ver;
    const zij = { x: c.zij.x * kant, z: c.zij.z * kant };
    const [bx, bz] = W.resolveCollisions(ex + zij.x * 1.6, ez + zij.z * 1.6, 0.4);
    let best = -1, ren = null;
    for (const k of [zij, c.voor, { x: -c.voor.x, z: -c.voor.z }, { x: -zij.x, z: -zij.z }]) {
      const d = I.renVrij(bx, bz, k.x, k.z, 16);
      if (d > best + 0.01) { best = d; ren = k; }
      if (d >= 16) break;
    }
    let renDiep = 0;
    for (let d = 0; d <= best; d += 0.1) {
      const px = bx + ren.x * d, pz = bz + ren.z * d;
      const [rx, rz] = W.resolveCollisions(px, pz, 0.4);
      renDiep = Math.max(renDiep, Math.hypot(rx - px, rz - pz));
    }
    uit.push({ links, rechts, ver, diep, best, renDiep });
  }
  return { hokjes: hokjes.length, plekken: uit };
});
const P = crash.plekken;
ok(P.length >= 5, 'plekken naast een hokje waar de oude schuif erdoorheen ging', `${P.length} plekken bij ${crash.hokjes} hokjes`);
const diepst = Math.max(0, ...P.map(p => p.diep));
ok(P.length && diepst < 0.12, 'nu raakt de auto onderweg niets meer (gemeten om de 0,5 %)', `diepste ${(diepst * 100).toFixed(0)} cm`);
ok(P.length && P.every(p => p.links < 1), 'naar het hokje toe stopt de schuif ervoor', P.map(p => r(p.links)).join(' '));
ok(P.filter(p => p.ver > 0.4).length >= P.length * 0.6, 'hij schuift toch een flink stuk: tot ertegenaan, of de andere kant op', P.map(p => r(p.ver)).join(' '));
const renDiep = Math.max(0, ...P.map(p => p.renDiep));
ok(P.length && renDiep < 0.05 && P.filter(p => p.best >= 8).length >= P.length * 0.6, 'en Bouwman rent een vrije kant op, niet door een muur', `${P.map(p => p.best.toFixed(0)).join(' ')} m vrij`);

console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
await browser.close();
process.exit(fouten ? 1 : 0);
