/*
 Toetst wat er in de ronde van 14 september 2026 bij het richten en het schap
 kwam.

 1. Over het vizier kijken (rechtermuisknop). Het wapen komt op x = 0 te staan
    en zakt precies zover als de korrel boven de kast staat, zodat de vizierlijn
    door het midden van het scherm loopt. De beeldhoek versmalt mee en het
    kruisje gaat uit.
 2. De terugslag en de spreiding nemen af zolang je aangeslagen bent, en het
    beeld loopt per schot meetbaar minder omhoog.
 3. Wisselen van wapen is een beweging: het wapen zakt eerst onder de onderrand
    (wegbergen) en het andere komt weer omhoog. Ondertussen schiet je niet.
 4. Het schap bij Tinga State staat als kaartjes in beeld, met per artikel een
    getekend plaatje, het nummer en de prijs.
 5. En er groeit geen onkruid meer op de rijbaan.

 Gebruik: npm run server &  node tools/richttest.mjs 8123
*/
import { chromium } from 'playwright';

const port = process.argv[2] || '8123';
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
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });
await page.evaluate(() => {
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  window.__game.player.active = true;
  window.__game.player.pointerLocked = true;
  // een handje om de speler ergens neer te zetten
  window.__zet = (p) => {
    const g = window.__game;
    g.player.pos.set(p.x, 0, p.z);
    g.player.applyCamera();
  };
});

// ---------- 1. over het vizier ----------
kop('over het vizier kijken');
const mik = await page.evaluate(async () => {
  const g = window.__game, p = g.player;
  const W = await import('/js/wapen.js');
  const laat = (n = 30, dt = 0.03) => { for (let i = 0; i < n; i++) p.update(dt); };
  laat(40);                                  // eerst alles tot rust laten komen
  const heup = { x: +p.gun.position.x.toFixed(4), y: +p.gun.position.y.toFixed(4), fov: g.camera.fov };
  p.richten(true);
  laat(30);
  const aan = {
    mik: +p.mik.toFixed(3),
    x: +p.gun.position.x.toFixed(4),
    y: +p.gun.position.y.toFixed(4),
    rotY: +p.gun.rotation.y.toFixed(4),
    rotZ: +p.gun.rotation.z.toFixed(4),
    fov: +g.camera.fov.toFixed(2),
    kruis: getComputedStyle(document.getElementById('crosshair')).display,
  };
  const vizierY = p.wapen.houding.vizierY;
  p.richten(false);
  laat(30);
  const uit = { mik: +p.mik.toFixed(3), x: +p.gun.position.x.toFixed(4), fov: +g.camera.fov.toFixed(2) };
  return { heup, aan, uit, vizierY, hoortY: +(-vizierY).toFixed(4), pistoolVizier: vizierY };
});
ok(mik.aan.mik === 1 && mik.uit.mik === 0,
  'de rechtermuisknop slaat aan en laat weer zakken', `aan ${mik.aan.mik}, uit ${mik.uit.mik}`);
ok(Math.abs(mik.aan.x) < 0.002,
  'aangeslagen staat het wapen precies in het midden van het beeld', `x = ${mik.aan.x} m`);
/*
 De kern van "accuraat": de korrel en de keep liggen allebei `vizierY` boven de
 kast, dus het wapen hoort exact zoveel te zakken. Dan — en alleen dan — kijk je
 er werkelijk overheen en valt de korrel op het midden van het scherm.
*/
ok(Math.abs(mik.aan.y - mik.hoortY) < 0.002,
  `de vizierlijn loopt door het midden van het scherm (korrel op ${(mik.pistoolVizier * 100).toFixed(1)} cm)`,
  `wapen op y = ${mik.aan.y} m, hoort ${mik.hoortY} m`);
ok(Math.abs(mik.aan.rotY) < 0.002 && Math.abs(mik.aan.rotZ) < 0.002,
  'en het staat recht: geen kanteling meer die het vizier scheef zet',
  `y ${mik.aan.rotY}, z ${mik.aan.rotZ} rad`);
ok(mik.aan.fov < mik.heup.fov - 10 && mik.uit.fov === mik.heup.fov,
  'de beeldhoek versmalt mee en komt daarna weer terug',
  `${mik.heup.fov}° → ${mik.aan.fov}° → ${mik.uit.fov}°`);
ok(mik.aan.kruis === 'none', 'het kruisje gaat uit — je kijkt over de korrel', mik.aan.kruis);

// ---------- 2. minder terugslag ----------
kop('minder terugslag en minder spreiding');
const kick = await page.evaluate(async () => {
  const g = window.__game, p = g.player;
  const laat = (n = 20, dt = 0.03) => { for (let i = 0; i < n; i++) p.update(dt); };
  p.krijgWapen('mitrailleur');
  laat(30);                                  // het trekken afmaken
  p.reserve = 2000; p.ammo = 30;
  const meet = (richten) => {
    p.richten(richten); laat(30);
    const factor = p.mikFactor;
    // tien schoten achter elkaar en kijken hoever het beeld omhoog loopt
    p.kickPitch = 0; p.ammo = 30; p.vuurKlok = 0;
    let som = 0;
    for (let i = 0; i < 10; i++) { const v = p.kickPitch; p.shoot(); som += p.kickPitch - v; p.vuurKlok = 0; }
    return { som: +som.toFixed(4), factor: { kick: +factor.kick.toFixed(3), spreiding: +factor.spreiding.toFixed(3) } };
  };
  const heup = meet(false);
  const aan = meet(true);
  p.richten(false); laat(20);
  return { heup, aan };
});
ok(kick.aan.factor.kick < 0.5 && kick.aan.factor.spreiding < 0.4,
  'aangeslagen blijft er nog geen halve terugslag en een derde spreiding over',
  `kick ×${kick.aan.factor.kick}, spreiding ×${kick.aan.factor.spreiding}`);
ok(kick.aan.som < kick.heup.som * 0.6,
  'en tien schoten tillen het beeld dus een stuk minder op',
  `${kick.heup.som.toFixed(3)} rad uit de heup, ${kick.aan.som.toFixed(3)} aangeslagen`);

// ---------- 3. wegbergen bij het wisselen ----------
kop('het wapen opbergen bij een wissel');
const wissel = await page.evaluate(() => {
  const g = window.__game, p = g.player;
  const laat = (n, dt = 0.02) => { for (let i = 0; i < n; i++) p.update(dt); };
  p.zetWapen('pistool'); p.wisselT = 0; p.holster = 0; laat(20);
  const voor = p.wapenSoort;
  const naar = p.kiesWapen(1);
  // beeld voor beeld meekijken: hoe ver zakt hij weg, en wanneer wisselt het model?
  const rij = [];
  let schootTijdens = 0;
  for (let i = 0; i < 40; i++) {
    p.update(0.02);
    rij.push({ h: +p.holster.toFixed(3), soort: p.wapenSoort, y: +p.gun.position.y.toFixed(3), mag: p.magSchieten() });
    if (p.magSchieten() && p.wisselT > 0) schootTijdens++;
  }
  const diepste = rij.reduce((a, b) => (b.h > a.h ? b : a));
  const wisselBeeld = rij.findIndex(r => r.soort !== voor);
  return {
    voor, naar, na: p.wapenSoort, diepste, wisselBeeld,
    holsterBijWissel: wisselBeeld >= 0 ? rij[wisselBeeld].h : null,
    eind: +p.holster.toFixed(3), eindY: +p.gun.position.y.toFixed(3), schootTijdens,
    rustY: p.wapen.houding.rust.y,
  };
});
ok(wissel.naar === 'mitrailleur' && wissel.na === 'mitrailleur',
  'het scrollwiel wisselt naar het andere wapen', `${wissel.voor} → ${wissel.na}`);
ok(wissel.diepste.h > 0.95,
  'hij wordt onderweg helemaal weggeborgen', `diepste stand ${wissel.diepste.h}`);
ok(wissel.diepste.y < wissel.rustY - 0.3,
  'en zakt daarbij onder de onderrand van het beeld uit',
  `van ${wissel.rustY} m naar ${wissel.diepste.y} m`);
ok(wissel.holsterBijWissel !== null && wissel.holsterBijWissel > 0.9,
  'het model wisselt pas als je niets meer ziet — geen wapen dat in je hand verspringt',
  `wegberging ${wissel.holsterBijWissel} op het moment van wisselen`);
ok(wissel.schootTijdens === 0, 'en zolang je aan het wisselen bent schiet je niet');
ok(wissel.eind === 0 && Math.abs(wissel.eindY - wissel.rustY) < 0.01,
  'daarna ligt het nieuwe wapen weer gewoon in de aanslag',
  `y = ${wissel.eindY} m`);

// ---------- 4. het schap met plaatjes ----------
kop('het schap aan de toonbank');
const schap = await page.evaluate(async () => {
  const g = window.__game, b = g.boerderij;
  g.player.pos.set(b.plekken.toonbank.x, 0, b.plekken.toonbank.z);
  g.player.health = 40;
  b.update(0.1, false);
  const el = document.getElementById('schap');
  const kaarten = [...el.querySelectorAll('.kaart')].map(k => ({
    nr: k.querySelector('.nr').textContent,
    naam: k.querySelector('.naam').textContent,
    prijs: (k.querySelector('.prijs') || k.querySelector('.bezitlabel')).textContent,
    beeld: !!k.querySelector('canvas'),
    breed: k.querySelector('canvas') ? k.querySelector('canvas').width : 0,
    getekend: (() => {
      const c = k.querySelector('canvas');
      if (!c) return false;
      // staat er werkelijk iets op? tel de beeldpunten die niet doorzichtig zijn
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 10) n++;
      return n;
    })(),
    bezit: k.classList.contains('bezit'),
  }));
  const verborgen = (() => {
    g.player.pos.set(b.plekken.deurBuiten.x + 30, 0, b.plekken.deurBuiten.z + 30);
    b.update(0.1, false);
    return document.getElementById('schap').hidden;
  })();
  return { kaarten, verborgen };
});
ok(schap.kaarten.length >= 4, 'er staan kaartjes aan de toonbank', `${schap.kaarten.length} stuks`);
ok(schap.kaarten.every(k => k.beeld && k.getekend > 200),
  'met op elk een getekend plaatje van het artikel',
  schap.kaarten.map(k => `${k.naam}: ${k.getekend} px`).join(', '));
ok(schap.kaarten.filter(k => !k.bezit).every((k, i) => k.nr === String(i + 1)),
  'genummerd zoals je ze indrukt',
  schap.kaarten.map(k => k.nr).join(' '));
ok(schap.kaarten.filter(k => !k.bezit).every(k => /^€ \d+$/.test(k.prijs)),
  'met de prijs eronder',
  schap.kaarten.map(k => k.prijs).join(' · '));
ok(schap.kaarten.some(k => k.bezit && k.prijs === 'in bezit'),
  'en wat je al hebt staat er grijs bij');
ok(schap.verborgen, 'loop je weg van de toonbank, dan verdwijnt het schap');

// ---------- 5. geen onkruid op de rijbaan ----------
kop('onkruid groeit niet op de weg');
const gras = await page.evaluate(async () => {
  const K = await import('/js/kaartwereld.js');
  const T = window.__game.scene;
  // alle pollen onkruid uit de scene halen en kijken waar ze staan
  const punten = [];
  const m = new (await import('three')).Matrix4();
  T.traverse(o => {
    if (!o.isInstancedMesh || o.userData.klasse !== 'onkruid') return;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m);
      punten.push([m.elements[12], m.elements[14]]);
    }
  });
  const fout = [];
  const verboden = new Set(['rijbaan', 'autoweg', 'parkeervlak', 'asfaltvlak', 'fietspad', 'brug', 'water']);
  for (const [x, z] of punten) {
    const v = K.vlakOp(x, z);
    if (v && verboden.has(v.k)) fout.push({ x: +x.toFixed(1), z: +z.toFixed(1), k: v.k });
  }
  return { totaal: punten.length, fout: fout.length, eerste: fout.slice(0, 4) };
});
ok(gras.totaal > 5000, 'er staat nog volop onkruid langs de straten', `${gras.totaal} pollen`);
ok(gras.fout === 0, 'maar geen enkele pol staat op de rijbaan of het fietspad',
  gras.fout ? JSON.stringify(gras.eerste) : `0 van ${gras.totaal}`);

console.log(`\n${fouten === 0 ? 'alles goed.' : `${fouten} fout(en).`}`);
await browser.close();
process.exit(fouten ? 1 : 0);
