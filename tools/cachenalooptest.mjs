/*
 Proef bij stap 211 (npm run cachenalooptest). Gevraagd (17 okt 2026): "Loop de geocache-missies nog eens na of alle hints logisch
 en duidelijk zijn en je overal bij kan. Of je alles goed kan invullen in de GPS en aflezen."

 De Tinga Cache (js/geocache.js) zoals een speler hem doet, naast tools/geocachetest.mjs (die de plekken en de beloning meet):

  1. Aflezen: elk raadsel past op het scherm van de GPS, bij elke cache, met en zonder ingetikt doel (geen regel afgekapt, geen
     regel te breed, de letter niet kleiner dan 9 px). Het scherm van elke stap als foto (docs/screenshots/cache_gps_<n>.png).
  2. De raadsels zelf: cache 2 noemt de straat van Mark en zegt dat het drie cijfers zijn; cache 3 houdt na het bordje vast wat
     erop stond; cache 4 zegt waar de sloep ligt; cache 5 heeft de logboeken in de GPS (letter en cijfer van 1–4).
  3. Invullen met de echte toetsen: N pakt de GPS, 1–6 komen in het doel (en kiezen geen wapen), backspace wist er één, een
     zevende cijfer begint opnieuw; zonder GPS in de hand doen de cijfers niets met het doel.
  4. Overal bij kunnen: van de dichtstbijzijnde straat of het dichtstbijzijnde pad te voet naar cache 1, 2, 3, 5 en het bordje
     (de looproute om hekken en gebouwen heen, js/looppad.js, tot op `CACHE.open` m); cache 4 met de sloep van IJlst over het water
     tot op `CACHE.vanafBoot` m (`sloepPast`, zoals de boot zelf vaart).
  5. De hints van Sjors: bij elke cache zegt hij iets dat het raadsel oplost (Molenkrite 15, de Tiger, 87.9; het bordje; de sloep;
     de logboeken in de GPS).

 Gebruik: npm run server &  node tools/cachenalooptest.mjs [poort]
*/
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => { console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`); if (!goed) fouten++; };
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
page.setDefaultTimeout(900000);
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  for (const k of Object.keys(localStorage)) if (k.startsWith('tinga.spel')) localStorage.removeItem(k);
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, P = g.player, v = g.verhaal;
  P.active = true; window.__autoplay = true;
  g.politie.proefStil = true;
  window.__W = await import('/js/world.js');
  window.__stap = (n = 1, dt = 0.05) => { for (let i = 0; i < n; i++) { P.health = 100; v.update(dt); g.geocache.update(dt); } };
  window.__zet = (x, z) => { if (P.inCar) { P.inCar.speed = 0; P.inCar = null; } P.zit = false; P.pos.set(x, window.__W.grondHoogte(x, z), z); P.applyCamera(); };
  // vrij spelen na het einde, met de GPS en het gesprek met Sjors gehad
  const s = v.bewaar(); Object.assign(s, { missie: 'klaar', fase: 'klaar', volgende: null, uitzendingKlaar: true, invalKlaar: true, ronaldKlaar: true, roanKlaar: true, noMercyKlaar: true, noMercyGebeld: true, geld: 0 });
  v.herstel(s); window.__stap(2);
  g.geocache.herstel({ gps: true, intro: true, gevonden: 0 });
  window.__stap(2);
});

kop('1 en 2. het scherm en de raadsels, bij elke stap');
const schermen = await page.evaluate(() => {
  const g = window.__game, C = g.geocache;
  const uit = [];
  const stappen = [
    { naam: '1', gevonden: 0, invoer: '' },
    { naam: '2', gevonden: 1, invoer: '' }, { naam: '2_doel', gevonden: 1, invoer: '151944879' },
    { naam: '3', gevonden: 2, invoer: '' }, { naam: '3_doel', gevonden: 2, invoer: '123456' },
    { naam: '3_bordje', gevonden: 2, invoer: '', stap1: true }, { naam: '3_bordje_doel', gevonden: 2, invoer: '654321', stap1: true },
    { naam: '4', gevonden: 3, invoer: '' }, { naam: '4_doel', gevonden: 3, invoer: '111222' },
    { naam: '5', gevonden: 4, invoer: '' }, { naam: '5_doel', gevonden: 4, invoer: '123456' },
  ];
  for (const s of stappen) {
    C.herstel({ gps: true, intro: true, gevonden: s.gevonden, invoer: s.invoer, stap1: !!s.stap1 });
    const pas = C.teken();
    uit.push({ ...s, pas, raadsel: C.raadsel(), beeld: C.lcd.toDataURL('image/png') });
  }
  const st = C.stand;
  const cv = document.createElement('canvas').getContext('2d'); cv.font = '11px monospace';
  const invoerBreed = cv.measureText('tik 6 cijfers: N, dan E').width;
  return { invoerBreed, uit, caches: st.caches.map(c => ({ nr: c.nr, letter: c.letter, cijfer: c.cijfer, n: c.n, e: c.e })), bordje: C.bordje.userData.regels, rest: st.rest };
});
mkdirSync('docs/screenshots', { recursive: true });
for (const s of schermen.uit) {
  const p = s.pas || {};
  ok(p.getekend === p.regels && p.breed <= 0.5 && p.letter >= 9, `cache ${s.naam.replace(/_/g, ' ')}: het raadsel past op het scherm`, `${p.getekend}/${p.regels} regels, ${p.letter} px`);
  if (['1', '2_doel', '3', '3_bordje', '4', '5'].includes(s.naam)) writeFileSync(`docs/screenshots/cache_gps_${s.naam}.png`, Buffer.from(s.beeld.split(',')[1], 'base64'));
}
ok(schermen.invoerBreed <= 216, 'de uitleg bij het intikken past op het scherm', `${schermen.invoerBreed.toFixed(0)} van 216 px`);
const R = Object.fromEntries(schermen.uit.map(s => [s.naam, s.raadsel.join(' | ')]));
ok(/Molenkrite/.test(R['2']) && /A, B en C/.test(R['2']) && /\(B [−+] \d+\)/.test(R['2']) && /\(C \+ A [−+] \d+\)/.test(R['2']), 'cache 2: de straat van Mark, A, B en C intikken, en de twee sommen', R['2']);
const bord = schermen.bordje.join('  ');
const bordN = /\.(\d{3})/.exec(schermen.bordje[0])[1], bordE = /\.(\d{3})/.exec(schermen.bordje[1])[1];
ok(R['3_bordje'].includes(`.${bordN}`) && R['3_bordje'].includes(`.${bordE}`), 'cache 3: na het bordje staat wat erop stond in de GPS', `${bord} → ${R['3_bordje']}`);
ok(/Stap 1: N \d+° \d+\.\d{3}\s+E/.test(R['3']) && /vishandel/i.test(R['3']), 'cache 3: stap 1 met de coördinaten van het bordje bij de vishandel', R['3']);
ok(/sloep/.test(R['4']) && /IJlst/.test(R['4']), 'cache 4: waar de sloep ligt', R['4']);
const log = schermen.caches.slice(0, 4).every(c => R['5'].includes(`${c.nr}: ${c.letter} ${c.cijfer}`));
ok(log && R['5'].includes(`[4]${schermen.rest}`) && /logboek n/.test(R['5']), 'cache 5: de logboeken in de GPS, [1][2][3] en [4] uitgelegd', R['5']);

kop('3. invullen met de echte toetsen');
const toetsen = await page.evaluate(() => {
  const g = window.__game, C = g.geocache, P = g.player, D = g.derde;
  if (D.aan) D.wissel();
  C.herstel({ gps: true, intro: true, gevonden: 2, invoer: '' });
  window.__zet(g.studio.plekken.stoep.x + 30, g.studio.plekken.stoep.z);
  P.wapenUit = false; P.aanTafel = false; P.gpsInHand = false;
  window.__stap(2);
  return { wapenNr: P.wapenNr, wapens: P.wapens.length };
});
await page.keyboard.press('KeyN');
await page.evaluate(() => window.__stap(3));
const aan = await page.evaluate(() => window.__game.geocache.aan);
for (const k of ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6']) { await page.keyboard.press(k); await page.evaluate(() => window.__stap(1)); }
const na6 = await page.evaluate(() => ({ invoer: window.__game.geocache.stand.invoer, wapenNr: window.__game.player.wapenNr, doel: !!window.__game.geocache.doel() }));
await page.keyboard.press('Backspace'); await page.evaluate(() => window.__stap(1));
const naTerug = await page.evaluate(() => window.__game.geocache.stand.invoer);
await page.keyboard.press('Digit9'); await page.keyboard.press('Digit0'); await page.evaluate(() => window.__stap(1));
const na7 = await page.evaluate(() => window.__game.geocache.stand.invoer);
await page.keyboard.press('Numpad7'); await page.evaluate(() => window.__stap(1));
const numpad = await page.evaluate(() => window.__game.geocache.stand.invoer);
await page.keyboard.press('KeyN'); await page.evaluate(() => window.__stap(3));
const uit = await page.evaluate(() => window.__game.geocache.aan);
await page.keyboard.press('Digit4'); await page.evaluate(() => window.__stap(1));
const zonder = await page.evaluate(() => window.__game.geocache.stand.invoer);
ok(aan, 'N pakt de GPS');
ok(na6.invoer === '123456' && na6.doel, 'de cijfers 1–6 komen in het doel, en de GPS heeft een doel', na6.invoer);
ok(na6.wapenNr === toetsen.wapenNr, 'met de GPS in de hand kiezen de cijfers geen wapen', `wapen ${toetsen.wapenNr} → ${na6.wapenNr}`);
ok(naTerug === '12345', 'backspace wist het laatste cijfer', naTerug);
ok(na7 === '1234590' || na7 === '0', 'na zes cijfers begint een nieuw cijfer opnieuw', `${naTerug} + 9, 0 → ${na7}`);
ok(numpad.endsWith('7'), 'het numerieke toetsenbord doet mee', numpad);
ok(!uit && zonder === numpad, 'GPS weggestopt: de cijfers raken het doel niet', `${numpad} → ${zonder}`);

kop('3b. cache 2: de antwoorden intikken (stap 213)');
await page.evaluate(() => { const C = window.__game.geocache; C.herstel({ gps: true, intro: true, gevonden: 1, invoer: '' }); window.__stap(2); });
await page.keyboard.press('KeyN'); await page.evaluate(() => window.__stap(3));
for (const ch of '151944879') { await page.keyboard.press(`Digit${ch}`); await page.evaluate(() => window.__stap(1)); }
const c2 = await page.evaluate(() => {
  const C = window.__game.geocache, c = C.stand.caches[1], d = C.doel();
  const pas = C.teken();
  return { invoer: C.stand.invoer, af: d ? +Math.hypot(d.x - c.punt.x, d.z - c.punt.z).toFixed(3) : null, pas };
});
await page.keyboard.press('KeyN'); await page.evaluate(() => window.__stap(3));
ok(c2.invoer === '151944879' && c2.af !== null && c2.af < 0.01, '15, 1944 en 879 ingetikt: de GPS wijst precies naar het punt uit het raadsel', `${c2.invoer} → ${c2.af} m`);
ok(c2.pas.getekend === c2.pas.regels, 'en het raadsel past nog op het scherm', `${c2.pas.getekend}/${c2.pas.regels}, ${c2.pas.letter} px`);

kop('4. overal bij kunnen');
const bij = await page.evaluate(async () => {
  const g = window.__game, C = g.geocache, W = window.__W;
  const L = await import('/js/looppad.js'), B = await import('/js/boot.js'), K = (await import('/js/kaart.js')).KAART;
  C.herstel({ gps: true, intro: true, gevonden: 0 });
  const st = C.stand, CC = C.CACHE;
  const vrij = (x, z) => { if (W.pointInWater(x, z)) return false; const [a, b] = W.resolveCollisions(x, z, 0.4); return Math.hypot(a - x, b - z) < 0.01; };
  // het dichtstbijzijnde punt op een straat of pad (een wegas, ook een voetpad) dat vrij is
  const straatBij = (p) => {
    let best = null, d = Infinity;
    for (const w of K.wegassen) {
      const pts = w.pts;
      for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1], [bx, bz] = pts[i], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.z - az) * dz) / L2));
        const x = ax + dx * t, z = az + dz * t, e = Math.hypot(x - p.x, z - p.z);
        if (e < d && e > 6 && vrij(x, z)) { d = e; best = { x, z }; }
      }
    }
    return best ? { ...best, d } : null;
  };
  const uit = [];
  const doelen = st.caches.filter(c => c.nr !== 4).map(c => ({ wat: `cache ${c.nr}`, p: c.plek }));
  doelen.push({ wat: 'het bordje', p: st.caches[2].stap1 });
  for (const { wat, p } of doelen) {
    const s = straatBij(p);
    const pad = s ? L.zoekLooppad({ x: s.x, z: s.z }, { x: p.x, z: p.z }) : null;
    const eind = pad && pad.length ? pad[pad.length - 1] : null;
    const ex = eind ? (eind.x ?? eind[0]) : null, ez = eind ? (eind.z ?? eind[1]) : null;
    uit.push({ wat, straat: s ? +s.d.toFixed(1) : null, pad: pad ? pad.length : 0, rest: eind ? +Math.hypot(ex - p.x, ez - p.z).toFixed(2) : null });
  }
  // cache 4: met de sloep van IJlst over het water (breedte eerst over een raster van 1,5 m, zoals de boot vaart)
  const c4 = st.caches[3].plek, boot = g.boten.ruw(1);
  const start = { x: boot.x, z: boot.z };
  const CEL = 1.5, M = 150;
  const x0 = Math.min(start.x, c4.x) - M, z0 = Math.min(start.z, c4.z) - M;
  const nx = Math.ceil((Math.max(start.x, c4.x) + M - x0) / CEL), nz = Math.ceil((Math.max(start.z, c4.z) + M - z0) / CEL);
  const past = (x, z) => { for (let k = 0; k < 4; k++) if (B.sloepPast(x, z, k * Math.PI / 4)) return true; return false; };
  const gezien = new Uint8Array(nx * nz), rij = [];
  const i0 = Math.round((start.x - x0) / CEL), j0 = Math.round((start.z - z0) / CEL);
  rij.push([i0, j0]); gezien[j0 * nx + i0] = 1;
  let gevonden = null, n = 0, dichtst = Infinity;
  let rondPaal = 0; for (let dx = -5; dx <= 5; dx += 0.5) for (let dz = -5; dz <= 5; dz += 0.5) if (Math.hypot(dx, dz) < CC.vanafBoot - 0.3 && past(c4.x + dx, c4.z + dz)) rondPaal++;
  while (rij.length && !gevonden && n < 400000) {
    const [i, j] = rij.shift(); n++;
    const x = x0 + i * CEL, z = z0 + j * CEL;
    dichtst = Math.min(dichtst, Math.hypot(x - c4.x, z - c4.z));
    if (Math.hypot(x - c4.x, z - c4.z) < CC.vanafBoot - 0.3) { gevonden = { x, z }; break; }
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= nx || b >= nz || gezien[b * nx + a]) continue;
      gezien[b * nx + a] = 1;
      if (past(x0 + a * CEL, z0 + b * CEL)) rij.push([a, b]);
    }
  }
  // en vanaf daar met de boot E: gaat hij open?
  // (Erik zit aan het roer, achter in de sloep: js/boot.js zet hem daar in `update`; leg de boot dus zo dat het roer naast de paal
  // komt, zoals een speler zou doen, op een plek waar de sloep past)
  let open4 = false, roer = null;
  if (gevonden) {
    C.herstel({ gps: true, intro: true, gevonden: 3 });
    g.boten.stapIn(boot);
    zoek: for (let r = 1; r <= 6; r += 0.5) for (let k = 0; k < 16; k++) for (let y = 0; y < 8; y++) {
      const a = k / 16 * Math.PI * 2, x = c4.x + Math.cos(a) * r, z = c4.z + Math.sin(a) * r, yaw = y / 8 * Math.PI * 2;
      if (!B.sloepPast(x, z, yaw)) continue;
      boot.x = x; boot.z = z; boot.yaw = yaw; boot.vx = 0; boot.vz = 0;
      g.boten.update(0.02, null); window.__stap(1);
      if (C.hint() === 'E — cache openen') { open4 = true; roer = +Math.hypot(g.player.pos.x - c4.x, g.player.pos.z - c4.z).toFixed(1); break zoek; }
    }
    g.boten.herstel({});
  }
  return { uit, boot: { start: { x: +start.x.toFixed(1), z: +start.z.toFixed(1) }, afstand: +Math.hypot(start.x - c4.x, start.z - c4.z).toFixed(0), gevonden: !!gevonden, open4, roer, dichtst: +dichtst.toFixed(1), rondPaal, n, startPast: past(start.x, start.z), paal: { x: +c4.x.toFixed(1), z: +c4.z.toFixed(1) } } };
});
for (const b of bij.uit) ok(b.pad > 0 && b.rest !== null && b.rest < 1.7, `${b.wat}: te voet te bereiken vanaf de straat of het pad (${b.straat} m verderop)`, `${b.pad} punten, eindigt ${b.rest} m ervan`);
ok(bij.boot.gevonden && bij.boot.open4, 'cache 4: met de sloep van IJlst over het water tot naast de paal, en dan E', `${bij.boot.afstand} m van de steiger; ${JSON.stringify(bij.boot)}`);

kop('5. de hints van Sjors');
const hints = await page.evaluate(() => {
  const g = window.__game, C = g.geocache;
  const uit = [];
  const dicht = () => document.getElementById('dialoog').hidden;
  for (let k = 0; k < 5; k++) {
    C.herstel({ gps: true, intro: true, gevonden: k, stap1: false });
    const s = C.sjors && C.sjors.plek;
    if (!s) { uit.push(''); continue; }
    window.__zet(s.x + 1.2, s.z);
    window.__stap(3);
    C.toets(); window.__stap(1);
    uit.push(dicht() ? '' : document.getElementById('dialoogTekst').textContent);
    for (let i = 0; i < 20 && !dicht(); i++) { g.verhaal.toets(); window.__stap(1); }
  }
  return uit;
});
const H = [
  [/Geeuwbrug/, 'cache 1: de Geeuwbrug'],
  [/Molenkrite 15/, /Tiger/, /879/, 'cache 2: Molenkrite 15, de Tiger en 879'],
  [/vishandel/i, 'cache 3: het bordje bij de vishandel'],
  [/sloep/, /IJlst/, 'cache 4: de sloep in IJlst'],
  [/logboek/i, /GPS/, 'cache 5: de logboeken in de GPS'],
];
H.forEach((h, i) => { const wat = h[h.length - 1], res = h.slice(0, -1); ok(res.every(re => re.test(hints[i] || '')), `Sjors bij ${wat}`, hints[i]); });

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);
