/*
 Toetst wat de politie er op 14 september 2026 bij kreeg: onderscheppen,
 de wegversperring vanaf drie sterren, en de helikopter.

 1. Onderscheppen — een surveillanceauto die achter je hangt rijdt niet naar
    waar je bent maar naar waar je zó bent. De dichtstbijzijnde blijft wél
    achter je aan rijden, anders is je spiegel leeg.
 2. Wegversperring — die stond op vier sterren en staat nu op drie, en hij wordt
    op je voorspelde route gezet: buiten je zicht, ver genoeg vooruit.
 3. De helikopter — komt vanaf vier sterren, cirkelt boven de plek waar ze je
    vermoeden, en werkt die plek bij zolang hij je ziet.
 4. En wat hem tegenhoudt: gehurkt zien ze je niet, onder een boomkroon niet,
    in een bosvlak niet en onder een brugdek al helemaal niet.

 Gebruik: npm run server &  node tools/helitest.mjs 8123
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
});

// ---------- 1. de helikopter komt vanaf vier sterren ----------
kop('vanaf vier sterren hangt hij boven de wijk');
const komt = await page.evaluate(async () => {
  const g = window.__game, P = g.politie;
  const H = await import('/js/helikopter.js');
  const loop = (n, dt = 0.1) => { for (let i = 0; i < n; i++) P.update(dt); };
  P.reset();
  // drie sterren: nog geen heli
  P.zetHeat(200); loop(20);
  const bijDrie = { ster: P.ster, actief: P.heli.actief };
  // vier sterren: hij komt aanvliegen en gaat cirkelen
  P.zetHeat(300); loop(30);
  const komtAan = { ster: P.ster, fase: P.heli.fase };
  loop(400);                                   // veertig seconden: ruim de tijd
  const boven = P.heli;
  const sp = g.player.pos;
  const hoogte = boven.y - sp.y;
  const zij = Math.hypot(boven.x - sp.x, boven.z - sp.z);
  // en weer weg als de sterren zakken
  P.zetHeat(0); loop(300);
  const weg = { fase: P.heli.fase, actief: P.heli.actief };
  P.reset();
  return { bijDrie, komtAan, boven, hoogte, zij, weg, drempel: H.HELI_STER };
});
ok(komt.bijDrie.ster === 3 && !komt.bijDrie.actief,
  `bij drie sterren komt hij niet (hij hoort vanaf ${komt.drempel})`,
  `${komt.bijDrie.ster} sterren, heli ${komt.bijDrie.actief ? 'in de lucht' : 'aan de grond'}`);
ok(komt.komtAan.ster >= 4 && komt.komtAan.fase === 'komt',
  'bij vier sterren komt hij aanvliegen', `fase "${komt.komtAan.fase}"`);
ok(komt.boven.fase === 'cirkelt', 'en daarna cirkelt hij', `fase "${komt.boven.fase}"`);
ok(komt.hoogte > 45 && komt.hoogte < 90,
  'op een hoogte waar je hem hoort en ziet hangen', `${komt.hoogte.toFixed(0)} m boven je`);
ok(komt.zij > 20 && komt.zij < 90,
  'en in een rondje eromheen, niet als een ballon aan een touwtje',
  `${komt.zij.toFixed(0)} m opzij`);
ok(komt.weg.fase === 'weg' && !komt.weg.actief,
  'zijn de sterren weg, dan draait hij af', `fase "${komt.weg.fase}"`);

// ---------- 2. wat hem tegenhoudt ----------
kop('waar hij je niet ziet');
const dekking = await page.evaluate(async () => {
  const g = window.__game, P = g.politie;
  const W = await import('/js/world.js');
  const V = await import('/js/viaduct.js');
  const K = await import('/js/kaartwereld.js');
  const loop = (n, dt = 0.1) => { for (let i = 0; i < n; i++) P.update(dt); };
  P.reset();
  P.zetHeat(300);
  loop(430);                                   // hij moet eerst boven je hangen
  const sp = { x: g.player.pos.x, z: g.player.pos.z, y: g.player.pos.y };

  // a. gewoon op straat
  g.player.hurk = 0;
  const open = P.heliZicht(sp.x, sp.z, sp.y);
  // b. gehurkt
  g.player.hurk = 1;
  const gehurkt = P.heliZicht(sp.x, sp.z, sp.y);
  g.player.hurk = 0;

  // c. onder een boomkroon: de dichtstbijzijnde boom bij de speler
  let boom = null, bd = Infinity;
  for (const t of W.treePositions) {
    const d = Math.hypot(t.x - sp.x, t.z - sp.z);
    if (d < bd) { bd = d; boom = t; }
  }
  const onderBoom = boom ? P.heliZicht(boom.x, boom.z, 0) : null;
  const naastBoom = boom ? P.heliZicht(boom.x + 9, boom.z + 9, 0) : null;

  /*
   d. onder een dek. De viaducten staan in js/viaduct.js met hun hele as erin;
   loop die punten af en pak het eerste waar de bovenkant echt boven het
   maaiveld ligt — dat is een plek waar je eronderdoor kunt.
  */
  let dek = null;
  for (const Vi of V.viaducten()) {
    for (const punt of Vi.as) {
      const onder = V.grondHoogte(punt[0], punt[1], -Infinity);
      const boven = V.grondHoogte(punt[0], punt[1], Infinity);
      if (boven > onder + 3) { dek = { x: punt[0], z: punt[1], onder, boven }; break; }
    }
    if (dek) break;
  }
  const onderDek = dek ? P.heliZicht(dek.x, dek.z, dek.onder) : null;

  // e. in een bosvlak uit de kaart
  let bos = null;
  const G = K.KAART ? K.KAART.gebied : null;
  if (K.KAART) {
    for (const v of K.KAART.vlakken) {
      if (v.k !== 'bos') continue;
      // het zwaartepunt van de buitenring
      let x = 0, z = 0;
      for (const p of v.r[0]) { x += p[0]; z += p[1]; }
      x /= v.r[0].length; z /= v.r[0].length;
      if (K.vlakOp(x, z) && K.vlakOp(x, z).k === 'bos') { bos = { x, z }; break; }
    }
  }
  const inBos = bos ? P.heliZicht(bos.x, bos.z, 0) : null;

  // f. en de afstand: aan de andere kant van de wereld ziet hij je niet
  const ver = P.heliZicht(sp.x + 600, sp.z, 0);
  P.reset();
  return { open, gehurkt, onderBoom, naastBoom, boomAfstand: bd, onderDek, dek, inBos, bos, ver };
});
ok(dekking.open === true, 'op straat, rechtop, ziet hij je gewoon');
ok(dekking.gehurkt === false, 'gehurkt (toets C) niet meer — dat is de uitweg te voet');
ok(dekking.onderBoom === false,
  `onder een boomkroon ook niet`, `boom op ${dekking.boomAfstand.toFixed(0)} m van de speler`);
ok(dekking.naastBoom === true, 'maar negen meter naast diezelfde boom sta je weer vrij');
ok(dekking.onderDek === false,
  'onder een dek (het viaduct) ziet hij je niet',
  dekking.dek ? `maaiveld ${dekking.dek.onder.toFixed(1)} m, dek ${dekking.dek.boven.toFixed(1)} m` : 'geen dek gevonden');
ok(dekking.inBos === false, 'en in een bosvlak uit de kaart evenmin',
  dekking.bos ? `${dekking.bos.x.toFixed(0)}, ${dekking.bos.z.toFixed(0)}` : 'geen bos gevonden');
ok(dekking.ver === false, 'ver buiten zijn bereik houdt het ook op');

// ---------- 3. ziet hij je, dan weten ze weer waar je bent ----------
kop('wat hij doorgeeft');
const meldt = await page.evaluate(() => {
  const g = window.__game, P = g.politie;
  const loop = (n, dt = 0.1) => { for (let i = 0; i < n; i++) P.update(dt); };
  P.reset();
  P.zetHeat(300);
  loop(430);
  // de speler verplaatsen zonder dat iemand het ziet; alleen de heli hangt boven hem
  g.player.hurk = 1;
  loop(20);
  const gehurkt = { ziet: P.heli.ziet };
  g.player.hurk = 0;
  loop(20);
  const rechtop = { ziet: P.heli.ziet, bekend: P.intern.laatstBekend };
  const afwijking = rechtop.bekend
    ? Math.hypot(rechtop.bekend.x - g.player.pos.x, rechtop.bekend.z - g.player.pos.z) : null;
  P.reset();
  return { gehurkt, rechtop, afwijking };
});
ok(meldt.gehurkt.ziet === false, 'gehurkt meldt hij niets');
ok(meldt.rechtop.ziet === true, 'sta je op, dan ziet hij je');
ok(meldt.afwijking !== null && meldt.afwijking < 2,
  'en dan staat de laatst bekende plek weer precies op jou',
  `${meldt.afwijking === null ? '—' : meldt.afwijking.toFixed(1)} m ernaast`);

// ---------- 4. de wegversperring staat nu op drie sterren ----------
kop('de wegversperring');
const blok = await page.evaluate(async () => {
  const g = window.__game, P = g.politie;
  const K = await import('/js/kaartwereld.js');
  const B = await import('/js/politie.js');
  P.reset();
  P.zetHeat(200);                         // drie sterren
  /*
   Rijden over een echte straat, met de bochten erin: een kaarsrechte straat
   heeft geen punt buiten je zicht en daar zet hij dus nooit een versperring —
   terecht, want dan zie je hem aankomen.
  */
  const wegen = K.KAART.wegassen.filter(w => w.drive && w.lengte > 250);
  let gezet = 0, plekken = [];
  for (const weg of wegen.slice(0, 6)) {
    // de speler over de knikpunten van de straat laten rijden, 12 m/s
    let i = 1, t = 0;
    for (let beeld = 0; beeld < 260 && i < weg.pts.length; beeld++) {
      const a = weg.pts[i - 1], b = weg.pts[i];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      t += 12 * 0.05;
      if (t > L) { t = 0; i++; continue; }
      g.player.pos.set(a[0] + (b[0] - a[0]) * (t / L), 0, a[1] + (b[1] - a[1]) * (t / L));
      P.update(0.05);
      if (P.intern.blokkades.length > gezet) {
        gezet = P.intern.blokkades.length;
        plekken = P.intern.blokkades.map(x => ({
          afstand: Math.hypot(x.x - g.player.pos.x, x.z - g.player.pos.z),
          wagens: x.cars.length,
        }));
      }
    }
    if (gezet) break;
  }
  const ster = P.ster;
  P.reset();
  return { ster, bijDrie: gezet, plekken, drempel: B.BLOKKADE_STER };
});
ok(blok.ster === 3 && blok.drempel === 3, 'de drempel staat op drie sterren', `${blok.ster} sterren, drempel ${blok.drempel}`);
ok(blok.bijDrie >= 1, 'en bij drie sterren zetten ze een straat dicht', `${blok.bijDrie} versperring(en)`);
ok(blok.plekken.every(p => p.wagens === 2), 'met twee wagens neus aan neus',
  blok.plekken.map(p => `${p.wagens}`).join(', '));
ok(blok.plekken.every(p => p.afstand > 80),
  'ruim vooruit, zodat je er tegenaan rijdt in plaats van hem te zien verschijnen',
  blok.plekken.map(p => `${p.afstand.toFixed(0)} m`).join(', '));

// ---------- 5. onderscheppen ----------
kop('vooruit denken in plaats van achteraan rijden');
const onder = await page.evaluate(async () => {
  const g = window.__game, P = g.politie;
  const K = await import('/js/kaartwereld.js');
  P.reset();
  const rij = K.KAART.wegassen.find(w => w.drive && w.lengte > 400);
  const a = rij.pts[1], b = rij.pts[2];
  const ux = b[0] - a[0], uz = b[1] - a[1], L = Math.hypot(ux, uz) || 1;
  const rx = ux / L, rz = uz / L;
  const zet = (t) => { g.player.pos.set(a[0] + rx * t, 0, a[1] + rz * t); };
  P.zetHeat(300);
  // op gang komen: de speler rijdt hard over de straat
  for (let i = 0; i < 40; i++) { zet(i * 0.9); P.update(0.05); }
  // alle wagens achter de speler zetten en aan het jagen
  const sp = { x: g.player.pos.x, z: g.player.pos.z };
  const wagens = P.intern.wagens;
  wagens.forEach((w, i) => {
    w.car.x = sp.x - rx * (30 + i * 14);
    w.car.z = sp.z - rz * (30 + i * 14);
    w.staat = 'jacht'; w.kwijtT = 0; w.route = null;
  });
  for (let i = 0; i < 12; i++) { zet(40 * 0.9 + i * 0.9); P.update(0.05); }
  const rollen = P.intern.wagens.map(w => ({
    onderschept: !!w.onderschept,
    achter: ((w.car.x - g.player.pos.x) * rx + (w.car.z - g.player.pos.z) * rz) < 0,
    doelVooruit: w.routeDoel
      ? ((w.routeDoel.x - g.player.pos.x) * rx + (w.routeDoel.z - g.player.pos.z) * rz)
      : null,
  }));
  P.reset();
  return { aantal: rollen.length, rollen };
});
ok(onder.aantal >= 2, 'er rijden meerdere wagens achter je aan', `${onder.aantal} wagens`);
ok(onder.rollen.some(r => r.onderschept),
  'en een deel daarvan gaat je voor in plaats van achter je aan',
  onder.rollen.map(r => (r.onderschept ? 'onderschept' : 'volgt')).join(', '));
ok(onder.rollen.some(r => !r.onderschept),
  'terwijl er altijd één gewoon in je spiegel blijft hangen');
ok(onder.rollen.filter(r => r.onderschept).every(r => r.doelVooruit === null || r.doelVooruit > 0),
  'wie onderschept mikt op een punt vóór je, niet erachter',
  onder.rollen.filter(r => r.onderschept).map(r => (r.doelVooruit === null ? '—' : `${r.doelVooruit.toFixed(0)} m vooruit`)).join(', '));

console.log(`\n${fouten === 0 ? 'alles goed.' : `${fouten} fout(en).`}`);
await browser.close();
process.exit(fouten ? 1 : 0);
