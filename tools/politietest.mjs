/*
 Toetst de politie en het gezocht-systeem (js/politie.js).

 1. Melden is een kans, geen zekerheid: één slachtoffer waar niemand bij is
    blijft vaak onopgemerkt, met getuigen erbij gaat de telefoon veel vaker, en
    wie het nog eens doet valt sneller op.
 2. Sterren: de verdenking loopt op met wat je doet, tot vijf sterren.
 3. Eenheden: bij één ster komen ze te voet, daarboven met surveillanceauto's
    met zwaailicht, en ze komen naar de plaats delict.
 4. Zien en schieten: staat de speler in het zicht, dan schieten ze en loopt de
    levensbalk leeg.
 5. Ontsnappen: blijf je uit het zicht, dan zakt de verdenking en zijn ze je na
    de aftelling kwijt; daarna is de wijk weer leeg.
 6. Een agent neerschieten kost meteen een paar sterren extra.

 Gebruik: python3 -m http.server 8123 &  node tools/politietest.mjs 8123
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
  const { KAART } = await import('./js/kaart.js');
  localStorage.removeItem('tinga.spel.v1');
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  // een recht stuk Molenkrite als plaats delict
  const as = KAART.wegassen.filter(w => w.drive && w.naam === 'Molenkrite' && w.lengte > 60)[0];
  const a = as.pts[Math.floor(as.pts.length / 2)];
  window.__pd = { x: a[0], z: a[1] };
  window.__zetSpeler = (x, z) => { g.player.pos.set(x, 0, z); g.player.applyCamera(); };
  window.__stap = (n, dt = 1 / 30) => { let schade = 0; for (let i = 0; i < n; i++) schade += g.politie.update(dt); return schade; };
});
await page.waitForTimeout(600);

// ---------- 1. melden is een kans ----------
kop('een misdaad wordt niet altijd gemeld');
const kans = await page.evaluate(() => {
  const g = window.__game;
  const pd = window.__pd;
  // ver van iedereen vandaan: bijna geen getuigen
  const stil = { x: pd.x + 3000, z: pd.z + 3000 };
  let gemeldStil = 0;
  for (let i = 0; i < 200; i++) { g.politie.reset(); if (g.politie.misdaad('neergeschoten', stil.x, stil.z)) gemeldStil++; }
  // en nu midden tussen de mensen
  const p = g.npcs.people.find(q => q.alive);
  let gemeldDruk = 0;
  for (let i = 0; i < 200; i++) { g.politie.reset(); if (g.politie.misdaad('neergeschoten', p.x, p.z)) gemeldDruk++; }
  // twee keer achter elkaar in de leegte: de tweede valt eerder op
  let tweede = 0;
  for (let i = 0; i < 300; i++) {
    g.politie.reset();
    for (let k = 0; k < 4 && g.politie.ster === 0; k++) { if (g.politie.misdaad('neergeschoten', stil.x, stil.z)) { tweede += k + 1; break; } }
  }
  g.politie.reset();
  return { stil: gemeldStil / 200, druk: gemeldDruk / 200, gemiddeldeBeurt: tweede / 300 };
});
ok(kans.stil > 0.02 && kans.stil < 0.35, 'in je eentje zonder getuigen blijft het vaak onopgemerkt',
  `${Math.round(kans.stil * 100)} % gemeld`);
ok(kans.druk > kans.stil + 0.2, 'met getuigen erbij gaat de telefoon veel vaker',
  `${Math.round(kans.druk * 100)} % tegen ${Math.round(kans.stil * 100)} %`);
ok(kans.gemiddeldeBeurt < 3, 'wie het nog eens doet valt sneller op',
  `gemiddeld bij slachtoffer ${kans.gemiddeldeBeurt.toFixed(1)}`);

// ---------- 2. sterren ----------
kop('sterren');
const sterren = await page.evaluate(() => {
  const g = window.__game;
  g.politie.reset();
  const rij = [];
  for (const h of [0, 29, 30, 100, 200, 300, 400]) { g.politie.zetHeat(h); rij.push(g.politie.ster); }
  const el = document.getElementById('ster');
  g.politie.zetHeat(200);
  g.hud.zetSterren(g.politie.ster, true);
  const tekst = el.textContent, zichtbaar = !el.hidden;
  g.politie.reset();
  g.hud.zetSterren(0, false);
  return { rij, tekst, zichtbaar, naReset: el.hidden };
});
ok(JSON.stringify(sterren.rij) === JSON.stringify([0, 0, 1, 2, 3, 4, 5]), 'de verdenking loopt op tot vijf sterren',
  sterren.rij.join(','));
ok(sterren.zichtbaar && sterren.tekst.startsWith('★★★'), 'de sterren staan in beeld', sterren.tekst);
ok(sterren.naReset, 'en verdwijnen als je niet meer gezocht wordt');

// ---------- 3. eenheden komen eraan ----------
kop('de eenheden komen eraan');
const komst = await page.evaluate(() => {
  const g = window.__game;
  const pd = window.__pd;
  g.politie.reset();
  window.__zetSpeler(pd.x, pd.z);
  g.politie.zetHeat(160);                      // drie sterren
  g.politie.misdaad('neergeschoten', pd.x, pd.z);
  const na = (s) => { window.__stap(Math.round(s * 30)); const p = g.politie.plekken; return p.length ? Math.min(...p.map(q => Math.hypot(q.x - pd.x, q.z - pd.z))) : 999; };
  const start = { ...g.politie.eenheden };
  const d10 = na(10), d25 = na(15), d45 = na(20);
  const zwaai = g.politie.intern.wagens.map(w => w.links.material.emissiveIntensity !== w.rechts.material.emissiveIntensity);
  return { start, d10: Math.round(d10), d25: Math.round(d25), d45: Math.round(d45),
    eenheden: g.politie.eenheden, zwaailicht: zwaai.every(Boolean) && zwaai.length > 0 };
});
ok(komst.eenheden.wagens >= 1 && komst.eenheden.voet + komst.eenheden.inWagen >= 3,
  'bij drie sterren rukken er auto\'s en agenten uit',
  `${komst.eenheden.wagens} wagens, ${komst.eenheden.voet + komst.eenheden.inWagen} agenten`);
ok(komst.zwaailicht, 'de zwaailichten knipperen om beurten');
ok(komst.d45 < komst.d10, 'ze komen dichterbij', `${komst.d10} m → ${komst.d25} m → ${komst.d45} m`);
ok(komst.d45 < 60, 'en bereiken de plaats delict', `dichtstbij ${komst.d45} m`);

// ---------- 4. zien en schieten ----------
kop('zien en schieten');
const vuur = await page.evaluate(() => {
  const g = window.__game;
  const pd = window.__pd;
  // een agent vlak naast de speler zetten: die moet gaan schieten
  const a = g.politie.intern.agenten.find(q => q.staat !== 'neer');
  a.persoon.zetNeer(pd.x + 6, pd.z, Math.atan2(-(pd.x - (pd.x + 6)), 0));
  a.persoon.groep.visible = true;
  a.staat = 'jacht'; a.zicht = true; a.vuurT = 0;
  window.__zetSpeler(pd.x, pd.z);
  let schade = 0;
  for (let i = 0; i < 300; i++) schade += g.politie.update(1 / 30);
  return { schade: Math.round(schade), staat: a.staat };
});
ok(vuur.schade > 0, 'een agent die je ziet schiet op je', `${vuur.schade} levenspunten in tien seconden`);

// ---------- 5. een agent neerschieten ----------
kop('een agent neerschieten');
const agentRaak = await page.evaluate(() => {
  const g = window.__game;
  const a = g.politie.intern.agenten.find(q => q.staat !== 'neer');
  const voor = g.politie.heat;
  let obj = null;
  a.persoon.groep.traverse(o => { if (!obj && o.isMesh) obj = o; });
  const geraakt = g.politie.raak(obj);
  return { geraakt, voor: Math.round(voor), na: Math.round(g.politie.heat), staat: a.staat };
});
ok(agentRaak.geraakt && agentRaak.staat === 'neer', 'je kunt een agent neerschieten');
ok(agentRaak.na > agentRaak.voor + 30, 'en dat kost je flink wat extra verdenking',
  `${agentRaak.voor} → ${agentRaak.na}`);

// ---------- 6. ontsnappen ----------
kop('ontsnappen');
const weg = await page.evaluate(() => {
  const g = window.__game;
  const pd = window.__pd;
  // ver weg gaan staan waar niemand je ziet, en wachten
  window.__zetSpeler(pd.x + 2000, pd.z + 2000);
  const voor = g.politie.ster;
  window.__stap(30 * 40);
  const na40 = { ster: g.politie.ster, heat: Math.round(g.politie.heat) };
  window.__stap(30 * 60);
  const na100 = { ster: g.politie.ster, heat: Math.round(g.politie.heat), eenheden: g.politie.eenheden,
    ziet: g.politie.intern.agenten.filter(a => a.zicht && a.persoon.groep.visible).length,
    gezienT: +g.politie.intern.gezienT.toFixed(1),
    staten: g.politie.intern.agenten.map(a => a.staat).join(','),
    wagens: g.politie.intern.wagens.map(w => w.staat).join(',') };
  return { voor, na40, na100 };
});
ok(weg.voor > 0 && weg.na100.ster === 0, 'uit het zicht blijven laat de verdenking wegzakken',
  `${weg.voor} sterren → ${weg.na40.ster} (heat ${weg.na40.heat}) na 40 s → ${weg.na100.ster} (heat ${weg.na100.heat}) na 100 s · ziet=${weg.na100.ziet} · gezienT=${weg.na100.gezienT} · ${weg.na100.staten} · wagens ${weg.na100.wagens}`);
ok(weg.na100.eenheden.wagens === 0 && weg.na100.eenheden.voet === 0,
  'en daarna is de wijk weer leeg',
  `${weg.na100.eenheden.wagens} wagens, ${weg.na100.eenheden.voet} agenten`);

await browser.close();
console.log(fouten === 0 ? '\nAlles goed.' : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
