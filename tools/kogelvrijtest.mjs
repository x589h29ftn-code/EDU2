/*
 Proef bij stap 210 (npm run kogelvrijtest). Gemeld (17 okt 2026): "In de laatste missie kan ik mijn eigen Ferrari kapot schieten."

 Missie 18, na het landen: de zwarte Ferrari waarmee je achter Bouwman aan gaat. Stond je ernaast (het gevecht bij de loods),
 dan schoot je hem zelf in brand, en zonder auto kom je niet bij de Dúvelsrak.

  1. Na het landen is de zwarte Ferrari kogelvrij voor je eigen schoten.
  2. Dertig echte schoten van 7 m op de Ferrari: geraakt (gaten), maar geen schade, geen wrak.
  3. Ter vergelijking een gewone geparkeerde auto: twaalf schoten en hij gaat wel kapot (de rest van het spel blijft zoals het was).
  4. Rij je de achtervolging met een andere auto, dan is díe kogelvrij (en de Ferrari niet meer).
  5. Buiten missie 18 (vrij spelen) is niets kogelvrij.

 Gebruik: npm run server &  node tools/kogelvrijtest.mjs [poort]
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
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
  for (const k of Object.keys(localStorage)) if (k.startsWith('tinga.spel')) localStorage.removeItem(k);
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, v = g.verhaal, P = g.player;
  P.active = false; window.__autoplay = false;
  g.politie.proefStil = true;
  const stap = (n = 2, dt = 0.05) => { for (let i = 0; i < n; i++) { P.health = 100; v.update(dt); } };
  // schieten op een auto vanaf 7 m opzij, zoals in tools/avondtest.mjs
  const schietOp = (auto, n) => {
    const yaw0 = auto.yaw || 0;
    const sx = auto.x + Math.cos(yaw0) * 7, sz = auto.z - Math.sin(yaw0) * 7;
    const [px, pz] = W.resolveCollisions(sx, sz, 0.4);
    P.inCar = null; P.zit = false; P.binnen = false;
    P.pos.set(px, W.grondHoogte(px, pz), pz);
    P.wapens = ['pistool']; P.wapenNr = 0; P.wapenUit = false; P.aanTafel = false; P.gpsInHand = false;
    let geschoten = 0;
    for (let i = 0; i < n; i++) {
      const gy = W.grondHoogte(auto.x, auto.z) + 0.7;
      const ey = P.pos.y + P.eye;
      const dx = auto.x - P.pos.x, dy = gy - ey, dz = auto.z - P.pos.z;
      P.yaw = Math.atan2(-dx, -dz); P.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      P.applyCamera();
      P.vuurKlok = 0; P.kickPitch = 0; P.kickYaw = 0; P.ammo = 12; P.reserve = 100; P.reloading = 0;
      g.scene.updateMatrixWorld(true);
      const was = P.active; P.active = true; P.shoot(); P.active = was; geschoten++;
      stap(1, 0.05);
    }
    return geschoten;
  };
  const uit = {};
  // missie 18, net geland: de Ferrari staat klaar
  const s = v.bewaar(); s.missie = 'uitzending'; s.fase = 'heliStart';
  v.herstel(s); stap(4);
  v.avond.naLanden(); stap(4);
  const fer = v.avond.auto;
  uit.na = { fase: v.fase, soort: fer && fer.soort, kogelvrij: !!(fer && fer.kogelvrij), dezelfde: v.avond.kogelvrij === fer, hp: fer && fer.hp };
  // 2. dertig schoten op de Ferrari
  const gaten0 = fer && fer.mesh ? fer.mesh.userData.gaten || 0 : 0;
  const hp0 = fer.hp;
  let geraakt = 0; const echtHit = g.vehicles.hit.bind(g.vehicles);
  g.vehicles.hit = (m, i) => { const c = echtHit(m, i); if (c === fer) geraakt++; return c; };
  uit.schoten = schietOp(fer, 30);
  uit.ferrari = { geraakt, hp0, hp: fer.hp, wrak: !!fer.wrak };
  // 3. een gewone geparkeerde auto ernaast
  const auto = g.vehicles.voegToe({ x: fer.x + 14, z: fer.z, yaw: 0, soort: 'hatch', kleur: 0x7a2a2a });
  stap(2);
  let geraaktGewoon = 0;
  g.vehicles.hit = (m, i) => { const c = echtHit(m, i); if (c === auto) geraaktGewoon++; return c; };
  schietOp(auto, 14);
  uit.gewoon = { geraakt: geraaktGewoon, hp: auto.hp, wrak: !!auto.wrak, kogelvrij: !!auto.kogelvrij };
  g.vehicles.hit = echtHit;
  // 4. de achtervolging met een andere auto
  const ander = g.vehicles.voegToe({ x: fer.x - 14, z: fer.z, yaw: 0, soort: 'hatch', kleur: 0x2a4a7a });
  stap(2);
  if (g.vehicles.zetNeer) g.vehicles.zetNeer(ander, 0, 0);
  P.inCar = ander;
  // (de achtervolging begint als Marks zin weg is: tot 10 tellen)
  for (let i = 0; i < 200 && v.fase === 'naarAuto'; i++) stap(1, 0.05);
  stap(4);
  uit.ander = { fase: v.fase, kogelvrij: !!ander.kogelvrij, ferrari: !!fer.kogelvrij, dezelfde: v.avond.kogelvrij === ander };
  P.inCar = null;
  // 5. vrij spelen
  const s2 = v.bewaar(); s2.missie = 'klaar'; s2.fase = 'klaar'; s2.uitzendingKlaar = true;
  v.herstel(s2); stap(4);
  uit.vrij = { ferrari: !!fer.kogelvrij, ander: !!ander.kogelvrij, nu: v.avond.kogelvrij };
  return uit;
});

kop('1. na het landen');
ok(r.na.soort === 'ferrari' && r.na.kogelvrij && r.na.dezelfde, 'de zwarte Ferrari is kogelvrij voor je eigen schoten', JSON.stringify(r.na));
kop('2. dertig schoten op de Ferrari');
ok(r.ferrari.geraakt >= 15, 'de kogels raken hem wel', `${r.ferrari.geraakt} van ${r.schoten} raak`);
ok(r.ferrari.hp === r.ferrari.hp0 && !r.ferrari.wrak, 'maar hij heeft geen schade en brandt niet', `hp ${r.ferrari.hp0} → ${r.ferrari.hp}`);
kop('3. een gewone auto');
ok(!r.gewoon.kogelvrij && r.gewoon.geraakt >= 8 && (r.gewoon.wrak || r.gewoon.hp <= 0), 'een gewone auto gaat wel kapot', JSON.stringify(r.gewoon));
kop('4. een andere auto in de achtervolging');
ok(r.ander.kogelvrij && r.ander.dezelfde && !r.ander.ferrari, 'de auto waar je in zit is nu kogelvrij, de Ferrari niet meer', JSON.stringify(r.ander));
kop('5. vrij spelen');
ok(!r.vrij.ferrari && !r.vrij.ander && !r.vrij.nu, 'na de missie is niets kogelvrij', JSON.stringify(r.vrij));

await browser.close();
console.log(fout ? `\n${fout} fout(en)` : '\nalles goed');
process.exit(fout ? 1 : 0);
