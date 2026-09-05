/*
 Toetst het viaduct over de rondweg (js/viaduct.js, tools/geo/genereer.mjs):
 ligt het waar de BGT het zet, klopt het hoogteveld, kun je erover lopen en
 rijden, blijft de rijksweg eronder op maaiveld, en staat de houten boog er.

 Gebruik: python3 -m http.server 8123 &  node tools/viaducttest.mjs 8123
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
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
await page.evaluate(async () => {
  localStorage.removeItem('tinga.spel.v1');
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  const { KAART } = await import('/js/kaartwereld.js');
  window.__W = await import('/js/world.js');
  window.__K = KAART;
  window.__V = KAART.viaducten && KAART.viaducten[0];
});
await page.waitForTimeout(400);

// ---------- 1. staat hij waar de BGT hem zet ----------
kop('de plek');
const plek = await page.evaluate(() => {
  const V = window.__V, K = window.__K;
  if (!V) return null;
  const mid = V.as[Math.round((V.dekVan + V.dekTot) / 2)];
  // de Jumbo aan de Molenkrite 171: het viaduct hoort er tegenover te liggen
  const jumbo = K.panden.find(p => p.type === 'jumbo');
  const voetZuid = V.as[0], voetNoord = V.as[V.as.length - 1];
  // hoeveel wegvakken met relatieveHoogteligging 1 liggen op het dek?
  const dekVakken = K.vlakken.filter(v => v.hl === 1 && v.dekh);
  return {
    naam: V.naam, mid: [mid[0], mid[1]],
    jumbo: jumbo ? [jumbo.rect.cx, jumbo.rect.cz, jumbo.nr[0]] : null,
    lengte: V.as.length - 1, dekLengte: V.dekTot - V.dekVan,
    voetZuid: voetZuid[2], voetNoord: voetNoord[2], hoogte: V.hoogte,
    voetPunt: [voetZuid[0], voetZuid[1]],
    dekVakken: dekVakken.length, dekRingen: V.dek.length, pijlers: (V.pijlers || []).length,
  };
});
ok(!!plek, 'de kaart kent een viaduct', plek ? plek.naam : 'geen');
if (plek) {
  const dJumbo = plek.jumbo ? Math.hypot(plek.jumbo[0] - plek.voetPunt[0], plek.jumbo[1] - plek.voetPunt[1]) : 1e9;
  ok(plek.jumbo && plek.jumbo[2] === '171', 'de Jumbo staat op Molenkrite 171', plek.jumbo ? `${plek.jumbo[0].toFixed(0)}, ${plek.jumbo[1].toFixed(0)}` : '-');
  ok(dJumbo < 70, 'de oprit begint tegenover de Jumbo', `${dJumbo.toFixed(0)} m van het pand`);
  ok(plek.dekVakken >= 6, 'het dek komt uit de BGT: wegvakken met relatieveHoogteligging 1', `${plek.dekVakken} vakken, ${plek.dekRingen} ringen`);
  ok(plek.pijlers === 1, 'met de pijler die de BGT eronder tekent', `${plek.pijlers}`);
  ok(plek.dekLengte > 45 && plek.dekLengte < 70, 'het dek is een meter of vijftig lang', `${plek.dekLengte} m`);
  ok(plek.lengte > 220 && plek.lengte < 320, 'met aan weerskanten een oprit', `${plek.lengte} m van voet tot voet`);
  ok(plek.voetZuid === 0 && plek.voetNoord === 0, 'die aan beide kanten op maaiveld begint');
  ok(plek.hoogte > 5 && plek.hoogte < 6.5, 'het wegdek ligt hoog genoeg om er met een vrachtwagen onderdoor te kunnen', `${plek.hoogte} m`);
}

// ---------- 2. het hoogteveld ----------
kop('het hoogteveld');
const veld = await page.evaluate(() => {
  const V = window.__V, w = window.__W;
  const mid = V.as[Math.round((V.dekVan + V.dekTot) / 2)];
  const opr = V.as[Math.round(V.dekVan / 2)];
  const nrm = (i) => {
    const a = V.as[Math.max(0, i - 1)], b = V.as[Math.min(V.as.length - 1, i + 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
    return [-dz / L, dx / L];
  };
  const io = Math.round(V.dekVan / 2), n = nrm(io);
  // steilste helling per meter langs de as
  let steil = 0;
  for (let i = 1; i < V.as.length; i++) {
    const d = Math.hypot(V.as[i][0] - V.as[i - 1][0], V.as[i][1] - V.as[i - 1][1]) || 1;
    steil = Math.max(steil, Math.abs(V.as[i][2] - V.as[i - 1][2]) / d);
  }
  return {
    dek: w.grondHoogte(mid[0], mid[1]),
    onderDek: w.grondHoogte(mid[0], mid[1], 1.0),
    naastDek: w.grondHoogte(mid[0] + 14, mid[1]),
    oprit: [w.grondHoogte(opr[0], opr[1]), opr[2]],
    talud: w.grondHoogte(opr[0] + n[0] * 8, opr[1] + n[1] * 8),
    naastTalud: w.grondHoogte(opr[0] + n[0] * 22, opr[1] + n[1] * 22),
    ver: w.grondHoogte(0, 0),
    steil: Math.round(steil * 1000) / 10,
    opViaduct: w.opViaduct(mid[0], mid[1]),
    opStraat: w.opViaduct(0, 0),
  };
});
ok(Math.abs(veld.dek - plek.hoogte) < 0.02, 'boven op de brug ligt de grond op dekhoogte', `${veld.dek.toFixed(2)} m`);
ok(veld.onderDek === 0, 'maar wie eronder staat, staat op de rondweg', `${veld.onderDek.toFixed(2)} m`);
ok(veld.naastDek === 0, 'naast de brug is er geen grond op hoogte', `${veld.naastDek.toFixed(2)} m`);
ok(Math.abs(veld.oprit[0] - veld.oprit[1]) < 0.02, 'op de oprit klopt de hoogte met het profiel', `${veld.oprit[0].toFixed(2)} m`);
ok(veld.talud > 0.1 && veld.talud < veld.oprit[0], 'het talud loopt van de kruin af naar beneden', `${veld.talud.toFixed(2)} m bij ${veld.oprit[0].toFixed(2)} m op de weg`);
ok(veld.naastTalud === 0, 'en verderop is het weer gewoon maaiveld');
ok(veld.ver === 0, 'de rest van de wijk blijft plat');
ok(veld.steil > 3 && veld.steil < 10, 'de oprit klimt in een tempo dat je fietsend nog haalt', `${veld.steil} % op het steilste stuk`);
ok(veld.opViaduct && !veld.opStraat, 'opViaduct weet waar het weglichaam ligt');

// ---------- 3. te voet ----------
kop('te voet');
const lopen = await page.evaluate(async () => {
  const g = window.__game, V = window.__V;
  const zet = (i) => {
    const s = V.as[i];
    g.player.inCar = null; g.player.vy = 0;
    g.player.pos.set(s[0], window.__W.grondHoogte(s[0], s[1]), s[1]);
  };
  // de oprit op lopen: richting geven en een tijdje vooruit
  zet(20);
  const start = g.player.pos.y;
  const doel = V.as[70];
  g.player.yaw = Math.atan2(-(doel[0] - g.player.pos.x), -(doel[1] - g.player.pos.z));
  g.player.keys = { KeyW: true, ShiftLeft: true };
  for (let i = 0; i < 900; i++) g.player.update(1 / 60);
  const na = { x: g.player.pos.x, y: g.player.pos.y, z: g.player.pos.z, grond: g.player.onGround };
  g.player.keys = {};
  // van de brug af springen: dan val je
  const m = V.as[Math.round((V.dekVan + V.dekTot) / 2)];
  const nx = -(V.as[V.dekTot][1] - V.as[V.dekVan][1]), nz = V.as[V.dekTot][0] - V.as[V.dekVan][0];
  const L = Math.hypot(nx, nz) || 1;
  g.player.pos.set(m[0] + nx / L * 16, 5.6, m[1] + nz / L * 16);
  g.player.vy = 0;
  let hoogste = g.player.pos.y;
  for (let i = 0; i < 120; i++) g.player.update(1 / 60);
  const val = { y: g.player.pos.y, van: hoogste };
  // onder de brug door lopen blijft op maaiveld
  g.player.pos.set(m[0], 0, m[1]);
  g.player.vy = 0;
  for (let i = 0; i < 30; i++) g.player.update(1 / 60);
  const onder = g.player.pos.y;
  return { start, na, val, onder };
});
ok(lopen.na.y > lopen.start + 1.5, 'lopend de oprit op kom je omhoog', `${lopen.start.toFixed(2)} → ${lopen.na.y.toFixed(2)} m`);
ok(lopen.na.grond, 'en je blijft met je voeten op de grond');
ok(lopen.val.y < 1, 'naast de brug val je naar beneden', `${lopen.val.van.toFixed(1)} → ${lopen.val.y.toFixed(2)} m`);
ok(lopen.onder === 0, 'onder de brug loop je gewoon over de rondweg', `${lopen.onder.toFixed(2)} m`);

// ---------- 4. de leuning ----------
kop('de leuning');
const leuning = await page.evaluate(() => {
  const g = window.__game, V = window.__V, w = window.__W;
  const i = Math.round((V.dekVan + V.dekTot) / 2);
  const s = V.as[i];
  const a = V.as[i - 1], b = V.as[i + 1];
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
  const nx = -dz / L, nz = dx / L;
  // op het dek naar de rand toe lopen
  g.player.inCar = null; g.player.vy = 0;
  g.player.pos.set(s[0], w.grondHoogte(s[0], s[1]), s[1]);
  g.player.yaw = Math.atan2(-nx, -nz);
  g.player.keys = { KeyW: true };
  for (let k = 0; k < 240; k++) g.player.update(1 / 60);
  g.player.keys = {};
  const opzij = (g.player.pos.x - s[0]) * nx + (g.player.pos.z - s[1]) * nz;
  const opDek = g.player.pos.y;
  // dezelfde plek, maar dan op maaiveld onder de brug
  g.player.pos.set(s[0], 0, s[1]); g.player.vy = 0;
  g.player.yaw = Math.atan2(-nx, -nz);
  g.player.keys = { KeyW: true };
  for (let k = 0; k < 240; k++) g.player.update(1 / 60);
  g.player.keys = {};
  const opzijOnder = (g.player.pos.x - s[0]) * nx + (g.player.pos.z - s[1]) * nz;
  return { opzij, opDek, opzijOnder, kruin: V.as[i][3] };
});
ok(leuning.opzij < leuning.kruin + 0.8, 'de leuning houdt je op het dek', `tot ${leuning.opzij.toFixed(2)} m uit de as, kruin ${leuning.kruin} m`);
ok(leuning.opDek > 4, 'en je staat er nog steeds op', `${leuning.opDek.toFixed(2)} m`);
ok(leuning.opzijOnder > leuning.kruin + 2, 'onder de brug loop je er zo langs', `${leuning.opzijOnder.toFixed(2)} m uit de as`);

// ---------- 5. met de auto ----------
kop('met de auto');
const rit = await page.evaluate(() => {
  const g = window.__game, V = window.__V;
  for (const c of g.vehicles.cars) if (V.as.some(s => Math.hypot(s[0] - c.x, s[1] - c.z) < 14)) { c.x += 500; g.vehicles.zetInstantie(c); }
  for (const t of g.vehicles.traffic) if (t.mesh) t.mesh.position.x += 500;
  const a = V.as[V.dekVan - 70], b = V.as[V.dekVan - 66];
  const yaw = Math.atan2(-(b[0] - a[0]), -(b[1] - a[1]));
  const auto = g.vehicles.voegToe({ x: a[0], z: a[1], yaw, soort: 'hatch', kleur: 0x9c1f1f });
  const volg = () => {
    let bi = 0, bd = 1e9;
    V.as.forEach((s, i) => { const d = Math.hypot(s[0] - auto.x, s[1] - auto.z); if (d < bd) { bd = d; bi = i; } });
    const t = V.as[Math.min(V.as.length - 1, bi + 12)];
    let e = Math.atan2(-(t[0] - auto.x), -(t[1] - auto.z)) - auto.yaw;
    while (e > Math.PI) e -= Math.PI * 2;
    while (e < -Math.PI) e += Math.PI * 2;
    return { KeyW: true, KeyA: e > 0.012, KeyD: e < -0.012 };
  };
  let hoogste = 0, kanteling = 0, opDek = 0, dekBeelden = 0;
  for (let i = 0; i < 760; i++) {
    g.vehicles.drive(auto, volg(), 1 / 60, g.aanrijden);
    hoogste = Math.max(hoogste, auto.mesh.position.y);
    kanteling = Math.max(kanteling, Math.abs(auto.mesh.rotation.x));
    // hoe hard rijdt hij terwijl hij op het dek zit?
    if (auto.mesh.position.y > 5) { opDek = Math.max(opDek, auto.speed); dekBeelden++; }
  }
  return { hoogste, kanteling, opDek, dekBeelden, eind: auto.mesh.position.y, snelheid: auto.speed };
});
ok(rit.hoogste > 5.3, 'met de auto rijd je over de brug heen', `hoogste punt ${rit.hoogste.toFixed(2)} m`);
ok(rit.opDek > 8, 'zonder ergens tegenaan te lopen', `${(rit.opDek * 3.6).toFixed(0)} km/u op het dek, ${(rit.dekBeelden / 60).toFixed(1)} s erop`);
ok(rit.kanteling > 0.03, 'en op de helling wijst de neus omhoog', `${(rit.kanteling * 57.3).toFixed(1)}° op het steilste stuk`);
ok(rit.eind < 3, 'aan de andere kant kom je weer beneden', `${rit.eind.toFixed(2)} m`);

// ---------- 6. wat je ziet ----------
kop('de houten brug');
const bouw = await page.evaluate(() => {
  const g = window.__game, V = window.__V;
  const uit = {};
  g.scene.traverse(o => {
    const k = o.userData && o.userData.klasse;
    if (!k || !k.startsWith('viaduct_')) return;
    const p = o.geometry.attributes.position;
    let maxY = -1e9, minY = 1e9;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > maxY) maxY = y; if (y < minY) minY = y; }
    uit[k] = { driehoeken: p.count / 3, minY: +minY.toFixed(2), maxY: +maxY.toFixed(2) };
  });
  // rode fietsstroken op het dek: vakken met het fietspadmateriaal op dekhoogte
  const rood = window.__K.vlakken.filter(v => v.dekh && v.m === 'fietspad').length;
  const dekh = window.__K.vlakken.filter(v => v.dekh).length;
  return { uit, rood, dekh, pijl: V.boog.pijl, hoogte: V.hoogte };
});
ok(!!bouw.uit.viaduct_boog, 'er staat een houten boog op de brug', bouw.uit.viaduct_boog ? `${bouw.uit.viaduct_boog.driehoeken} driehoeken` : 'geen');
if (bouw.uit.viaduct_boog) {
  const top = bouw.uit.viaduct_boog.maxY;
  ok(top > bouw.hoogte + bouw.pijl - 0.9 && top < bouw.hoogte + bouw.pijl + 0.9,
    'die net zo hoog boven het dek uitkomt als opgegeven', `top op ${top.toFixed(2)} m, dek ${bouw.hoogte} + pijl ${bouw.pijl}`);
}
ok(!!bouw.uit.viaduct_dijk, 'de opritten staan op een dijklichaam', bouw.uit.viaduct_dijk ? `${bouw.uit.viaduct_dijk.driehoeken} driehoeken` : 'geen');
ok(!!bouw.uit.viaduct_dekligger && bouw.uit.viaduct_dekligger.minY < 1,
  'met een dekligger en landhoofden tot op de grond', bouw.uit.viaduct_dekligger ? `${bouw.uit.viaduct_dekligger.minY} tot ${bouw.uit.viaduct_dekligger.maxY} m` : 'geen');
ok(bouw.rood >= 4, 'op het dek liggen rode fietsstroken', `${bouw.rood} van ${bouw.dekh} vakken`);

// ---------- 7. de wereld eromheen ----------
kop('de wereld eromheen');
const om = await page.evaluate(async () => {
  const g = window.__game, V = window.__V, w = window.__W;
  // hoe hoog liggen de vlakken die op de dijk staan?
  const mid = V.as[Math.round((V.dekVan + V.dekTot) / 2)];
  let opgetild = 0, plat = 0;
  g.scene.traverse(o => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    const k = o.userData && o.userData.klasse;
    if (k !== 'rijbaan' && k !== 'fietspad' && k !== 'gras' && k !== 'berm') return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i += 3) { if (p.getY(i) > 1) opgetild++; else plat++; }
  });
  // de rijksweg onder de brug ligt op maaiveld
  const onder = w.grondHoogte(mid[0], mid[1], 0);
  // een boom op de dijk
  const boom = window.__K.bomen.filter(b => w.grondHoogte(b.x, b.z, 0) > 1).length;
  // en geen boom die dwars door het brugdek heen groeit
  const doorDek = window.__K.bomen.filter(b => w.onderBrug(b.x, b.z, 2.0)).length;
  const kw = (await import('/js/kaartwereld.js')).kaartTelling;
  return { opgetild, plat, onder, boom, doorDek, weggelaten: kw.bomenOnderBrug };
});
ok(om.opgetild > 200, 'de weg en het gras op de dijk zijn mee omhoog gegaan', `${om.opgetild} driehoeken boven 1 m`);
ok(om.onder === 0, 'de rijksweg eronder is blijven liggen');
ok(om.boom > 0, 'de bomen op de dijk staan op de dijk', `${om.boom} bomen`);
ok(om.weggelaten > 0, 'en de bomen onder het brugdek zijn weggelaten', `${om.weggelaten} van de ${om.doorDek} in de brugstrook`);

console.log(fouten ? `\n${fouten} fout(en).` : '\nAlles goed.');
await browser.close();
process.exit(fouten ? 1 : 0);
