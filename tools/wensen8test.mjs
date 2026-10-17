/*
 Proef bij stap 214 (npm run wensen8test). Gemeld (17 okt 2026):
   "Als ik doorga van de auto naar de missie No Mercy blijft het autogeluid hangen."
   "Geef een betere ingang aan voor tennis, het is nu een willekeurig stuk hekwerk waar je moet staan."
   "Zorg dat je ook meerdere saved games kunt maken."

  1. De motor: zolang je in de auto zit loopt hij; haalt het verhaal je eruit (`player.inCar = null`, zoals No Mercy doet), dan
     zet de hoofdlus hem binnen een paar beelden uit. Ook als je No Mercy 4 echt start terwijl je in de auto zit.
  2. Tennis: bij elke plek een gele ring op de grond en een bordje "TENNIS" ernaast (naar wie eraan komt, buiten het hek, niet in
     een botsdoos). E in de ring begint het potje, de ring is weg tijdens het spelen en terug na afloop. Foto: tennis_ingang.png.
  3. Opslaan: in de pauze "Opslaan als nieuw spel". Opslaan, dan als nieuw spel: twee spellen. Daarna schrijft Opslaan naar het
     nieuwe (nog steeds twee). Spel laden laat ze allebei zien. Tijdens een gesprek gaat het niet door, en dan schrijft de volgende
     Opslaan niet stiekem naar een nieuwe plek.

 Gebruik: npm run server &  node tools/wensen8test.mjs [poort]
*/
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => { console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`); if (!goed) fouten++; };
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
page.setDefaultTimeout(900000);
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  for (const k of Object.keys(localStorage)) if (k.startsWith('tinga.spel')) localStorage.removeItem(k);
  window.__menu = await import('/js/menu.js');
  window.__opsl = await import('/js/opslag.js');
  window.__W = await import('/js/world.js');
  window.__menu.verbergMenu();
  const g = window.__game, v = g.verhaal, P = g.player;
  g.politie.proefStil = true;
  window.__stap = (n = 1, dt = 0.05) => { for (let i = 0; i < n; i++) { P.health = 100; v.update(dt); } };
  const s = v.bewaar(); Object.assign(s, { missie: 'klaar', fase: 'klaar', volgende: null, uitzendingKlaar: true, invalKlaar: true, ronaldKlaar: true, roanKlaar: true, noMercyKlaar: false, noMercyGebeld: true });
  v.herstel(s); window.__stap(2);
  P.active = true;
});

kop('1. de motor');
const m1 = await page.evaluate(async () => {
  const g = window.__game, P = g.player, G = g.geluid;
  G.start();
  const auto = g.vehicles.voegToe({ x: P.pos.x + 4, z: P.pos.z, yaw: 0, soort: 'hatch', kleur: 0x446688 });
  window.__auto = auto;
  P.inCar = auto; G.motorAan();
  const aan = G.motorLoopt();
  // een paar echte beelden van de hoofdlus in de auto
  await new Promise(r => { let n = 0; const f = () => (++n >= 4 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  const nogAan = G.motorLoopt();
  // het verhaal haalt je eruit, zonder de motor uit te zetten
  P.inCar.speed = 0; P.inCar = null;
  let n = 0;
  await new Promise(r => { const f = () => { n++; if (!G.motorLoopt() || n > 60) r(); else requestAnimationFrame(f); }; requestAnimationFrame(f); });
  return { aan, nogAan, uit: !G.motorLoopt(), beelden: n };
});
ok(m1.aan && m1.nogAan, 'in de auto loopt de motor (ook na een paar beelden van de hoofdlus)');
ok(m1.uit && m1.beelden <= 10, 'uit de auto gehaald: de motor is uit', `na ${m1.beelden} beelden`);
const m2 = await page.evaluate(async () => {
  const g = window.__game, P = g.player, G = g.geluid, v = g.verhaal;
  P.inCar = window.__auto; G.motorAan();
  const aan = G.motorLoopt();
  // No Mercy 4 met shift+punt, en dan het verhaal tot je niet meer in de auto zit (bij Erik Jan: E)
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Period', key: '>', shiftKey: true, bubbles: true }));
  for (let i = 0; i < 400 && P.inCar; i++) {
    window.__stap(1);
    if (i % 20 === 10) v.toets();
  }
  const uitAuto = !P.inCar;
  let n = 0;
  await new Promise(r => { const f = () => { n++; if (!G.motorLoopt() || n > 60) r(); else requestAnimationFrame(f); }; requestAnimationFrame(f); });
  return { aan, uitAuto, uit: !G.motorLoopt(), beelden: n, nm: v.noMercy ? v.noMercy.fase : null };
});
ok(m2.aan && m2.uitAuto && m2.uit, 'No Mercy 4 vanuit de auto: daarna geen motorgeluid meer', JSON.stringify(m2));
await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  const s = v.bewaar(); Object.assign(s, { missie: 'klaar', fase: 'klaar', volgende: null, noMercyKlaar: true });
  v.herstel(s); window.__stap(4);
});

kop('2. de ingang van de tennis');
const t = await page.evaluate(() => {
  const g = window.__game, T = g.tennisspel, W = window.__W, P = g.player;
  const uit = { n: T.plekken.length, ingangen: T.ingangen.length, plekken: [] };
  T.plekken.forEach((p, i) => {
    const { ring, bord } = T.ingangen[i];
    const grond = W.grondHoogte(p.x, p.z);
    const [rx, rz] = W.resolveCollisions(p.x, p.z, 0.4);
    const L = Math.hypot(p.kijk.x, p.kijk.z), kx = p.kijk.x / L, kz = p.kijk.z / L;
    const voor = { x: Math.sin(bord.rotation.y), z: Math.cos(bord.rotation.y) };
    uit.plekken.push({
      ring: +Math.hypot(ring.position.x - p.x, ring.position.z - p.z).toFixed(2), hoog: +(ring.position.y - grond).toFixed(2),
      bord: +Math.hypot(bord.position.x - p.x, bord.position.z - p.z).toFixed(2), richting: +(voor.x * kx + voor.z * kz).toFixed(2),
      vrij: Math.hypot(rx - p.x, rz - p.z) < 0.02, zicht: ring.visible && bord.visible,
    });
  });
  // niet ingesloten: vanaf de plek kom je over een raster van 1 m (vrij van botsdozen en water) minstens 50 m ver
  const vrijL = (x, z) => { if (W.pointInWater(x, z)) return false; const [rx, rz] = W.resolveCollisions(x, z, 0.45); return Math.hypot(rx - x, rz - z) < 0.01; };
  uit.lopen = T.plekken.map(q => {
    const gezien = new Set(['0,0']), rij = [[0, 0]]; let ver = 0, n = 0;
    while (rij.length && ver < 50 && n++ < 20000) {
      const [a, b] = rij.shift(); ver = Math.max(ver, Math.hypot(a, b));
      for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${a + da},${b + db}`; if (gezien.has(k)) continue; gezien.add(k);
        if (vrijL(q.x + a + da, q.z + b + db)) rij.push([a + da, b + db]);
      }
    }
    return +ver.toFixed(0);
  });
  // E in de ring
  const p = T.plekken[0];
  P.inCar = null; P.pos.set(p.x + 0.5, W.grondHoogte(p.x, p.z), p.z); P.applyCamera();
  T.update(0.6);
  const begon = T.toets();
  T.update(0.05);
  uit.spel = { begon, bezig: T.bezig, ringWeg: !T.ingangen[0].ring.visible };
  T.afbreken(); T.update(0.05);
  uit.spel.ringTerug = T.ingangen[0].ring.visible;
  // een foto: vijf meter van de ring, ernaar kijkend
  const L = Math.hypot(p.kijk.x, p.kijk.z), kx = p.kijk.x / L, kz = p.kijk.z / L;
  P.pos.set(p.x - kx * 3.5 + kz * 0.6, W.grondHoogte(p.x, p.z), p.z - kz * 3.5 - kx * 0.6);
  P.yaw = Math.atan2(-(p.x - P.pos.x), -(p.z - P.pos.z)); P.pitch = -0.25; P.applyCamera();
  g.scene.updateMatrixWorld(true);
  g.renderer.render(g.scene, g.camera);
  uit.foto = g.renderer.domElement.toDataURL('image/png');
  return uit;
});
writeFileSync('docs/screenshots/tennis_ingang.png', Buffer.from(t.foto.split(',')[1], 'base64'));
ok(t.n > 0 && t.ingangen === t.n, 'bij elke plek een ingang', `${t.n} plekken`);
ok(t.plekken.every(q => q.ring < 0.05 && q.hoog > 0.1 && q.hoog < 0.2 && q.zicht), 'een gele ring precies op de plek, net boven het gras', JSON.stringify(t.plekken.map(q => [q.ring, q.hoog])));
ok(t.plekken.every(q => q.bord > 1 && q.bord < 1.6 && q.richting < -0.9), 'een bordje ernaast, met de voorkant naar wie eraan komt', JSON.stringify(t.plekken.map(q => [q.bord, q.richting])));
ok(t.plekken.every(q => q.vrij), 'de plek is vrij: buiten het hek, in geen botsdoos');
ok(t.lopen.every(d => d >= 50), 'geen plek is ingesloten: je loopt er van alle kanten vrij heen', `${JSON.stringify(t.lopen)} m`);
ok(t.spel.begon && t.spel.bezig && t.spel.ringWeg && t.spel.ringTerug, 'E in de ring begint het potje; de ring is weg tijdens het spelen en terug daarna', JSON.stringify(t.spel));

kop('3. meer opgeslagen spellen');
const o = await page.evaluate(() => {
  const g = window.__game, O = window.__opsl;
  for (const k of Object.keys(localStorage)) if (k.startsWith('tinga.spel')) localStorage.removeItem(k);
  O.kiesPlek(1);
  g.pauzeer();
  const zie = (id) => { const e = document.getElementById(id); return !!e && !e.hidden && e.checkVisibility(); };
  const uit = { knop: zie('menuOpslaanNieuw') };
  document.getElementById('menuOpslaan').click();
  uit.na1 = O.opslagen().length;
  document.getElementById('menuOpslaanNieuw').click();
  uit.na2 = O.opslagen().length; uit.tekst = document.getElementById('menuOpslaanNieuw').innerText; uit.actief = O.actievePlek();
  g.player.pos.x += 3;
  document.getElementById('menuOpslaan').click();
  uit.na3 = O.opslagen().length; uit.actief3 = O.actievePlek();
  // tijdens een gesprek
  const balk = document.getElementById('dialoog'); balk.hidden = false;
  document.getElementById('menuOpslaanNieuw').click();
  uit.gesprek = { n: O.opslagen().length, tekst: document.getElementById('menuOpslaanNieuw').innerText };
  balk.hidden = true;
  document.getElementById('menuOpslaan').click();
  uit.naGesprek = { n: O.opslagen().length, actief: O.actievePlek() };
  // Spel laden: de lijst
  document.getElementById('menuLaden').click();
  uit.lijst = document.querySelectorAll('.opslagplek').length;
  return uit;
});
ok(o.knop, 'in de pauze staat "Opslaan als nieuw spel"');
ok(o.na1 === 1 && o.na2 === 2 && /nieuw spel/.test(o.tekst) && o.actief !== 1, 'Opslaan en dan als nieuw spel: twee spellen, en je speelt in het nieuwe', JSON.stringify(o));
ok(o.na3 === 2 && o.actief3 === o.actief, 'daarna schrijft Opslaan naar het nieuwe spel', `${o.na3} spellen, plek ${o.actief3}`);
ok(o.gesprek.n === 2 && /Nu niet/.test(o.gesprek.tekst) && o.naGesprek.n === 2 && o.naGesprek.actief === o.actief, 'tijdens een gesprek niet, en daarna geen stiekeme nieuwe plek', JSON.stringify(o.gesprek));
ok(o.lijst === 2, 'Spel laden laat beide spellen zien', `${o.lijst} in de lijst`);

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);
