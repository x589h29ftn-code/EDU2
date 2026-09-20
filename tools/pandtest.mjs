/*
 De pandwijzer (toets P) en het juiste Ranzijn-pand.

   npm run server &   node tools/pandtest.mjs [poort]

 Waar het om gaat: uit "het grote pand langs de rondweg" viel niet af te leiden
 wélk pand bedoeld werd, en de Ranzijn-stijl kwam op de buurman terecht. De
 pandwijzer haalt het raden eruit — je kijkt het pand aan en het BAG-pandnummer
 staat op je klembord. Deze toets controleert dat wat hij aanwijst klopt met de
 kaart, vanaf plekken waarvan we weten wat er staat.
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let goed = 0, fout = 0;
const ok = (naam, waar, extra = '') => {
  if (waar) { goed++; console.log(`  ✓ ${naam}${extra ? ' — ' + extra : ''}`); }
  else { fout++; console.log(`  ✗ ${naam}${extra ? ' — ' + extra : ''}`); }
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const fouten = [];
page.on('pageerror', e => fouten.push(e.message));
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });
await page.evaluate(() => {
  const g = window.__game;
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true;
});

// ---------------------------------------------------------- de pandwijzer
console.log('\nde pandwijzer (P)');
const w = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const { maakPandWijzer, pandRegel } = await import('/js/pandwijzer.js');
  const wijzer = maakPandWijzer(KAART);
  const uit = { aantal: wijzer.aantal, panden: KAART.panden.length };
  /*
   De plek die de gebruiker doorgaf: 1451,7 / -55,3, vier en een halve meter
   vóór de zuidgevel van de hal. Vooruit is (−sin yaw, −cos yaw), dus met
   yaw = π kijk je naar +z en dat is de hal in.
  */
  const t0 = performance.now();
  const raak = wijzer.zoek(1451.7, -55.3, Math.PI);
  uit.ms = +(performance.now() - t0).toFixed(2);
  uit.ranzijn = raak && { id: raak.p.id, type: raak.p.type, hoe: raak.hoe, afstand: +raak.afstand.toFixed(1),
    opp: Math.round(raak.opp) };
  uit.regel = pandRegel(raak);
  // andersom kijken: dan staat er niets binnen honderdzestig meter vóór je...
  const achter = wijzer.zoek(1451.7, -55.3, 0);
  uit.achter = achter && { id: achter.p.id, hoe: achter.hoe, afstand: +achter.afstand.toFixed(1) };
  // ...en vanaf het midden van een grondvlak wijst hij dat pand zelf aan
  const p = KAART.panden.find(q => q.id === '0091100000019457');
  let cx = 0, cz = 0;
  for (const q of p.voet) { cx += q[0]; cz += q[1]; }
  const midden = wijzer.zoek(cx / p.voet.length, cz / p.voet.length, 0);
  uit.midden = midden && { id: midden.p.id, afstand: +midden.afstand.toFixed(1) };
  /*
   En een plek waar echt niets staat. Die wordt opgezocht in plaats van
   opgeschreven: een vast punt dat vandaag leeg is kan morgen bebouwd zijn.
  */
  const dozen = KAART.panden.map(q => {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const v of q.voet) {
      if (v[0] < x0) x0 = v[0]; if (v[0] > x1) x1 = v[0];
      if (v[1] < z0) z0 = v[1]; if (v[1] > z1) z1 = v[1];
    }
    return [x0, x1, z0, z1];
  });
  const vrij = (x, z, marge) => dozen.every(([x0, x1, z0, z1]) =>
    Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1)) > marge);
  let leegPunt = null;
  for (let x = KAART.gebied.x0 + 100; x < KAART.gebied.x1 && !leegPunt; x += 120) {
    for (let z = KAART.gebied.z0 + 100; z < KAART.gebied.z1 && !leegPunt; z += 120) {
      if (vrij(x, z, 200)) leegPunt = { x, z };
    }
  }
  uit.leegPunt = leegPunt;
  uit.leeg = leegPunt ? wijzer.zoek(leegPunt.x, leegPunt.z, 0) : 'geen leeg punt gevonden';
  // een woning waarvan we het nummer kennen: Molenkrite 15 (de voordeur waar je naar binnen kunt)
  const huis = KAART.panden.find(q => q.straat === 'Molenkrite' && (q.nr || []).includes('15'));
  if (huis) {
    let hx = 0, hz = 0;
    for (const q of huis.voet) { hx += q[0]; hz += q[1]; }
    const h = wijzer.zoek(hx / huis.voet.length, hz / huis.voet.length, 0);
    uit.huis = { gezocht: huis.id, gevonden: h && h.p.id, regel: pandRegel(h) };
  }
  return uit;
});
ok('hij kent alle panden van de kaart', w.aantal === w.panden, `${w.aantal} van de ${w.panden}`);
ok('vanaf de plek die is doorgegeven wijst hij de hal aan',
  w.ranzijn && w.ranzijn.id === '0091100000019457',
  w.ranzijn ? `${w.ranzijn.id} (${w.ranzijn.type}), ${w.ranzijn.afstand} m vooruit` : 'niets');
ok('en dat is het grote pand, geen schuurtje', w.ranzijn && w.ranzijn.opp > 4000, w.ranzijn ? `${w.ranzijn.opp} m²` : '');
ok('het zoeken kost geen merkbare tijd', w.ms < 30, `${w.ms} ms`);
ok('de regel begint met het BAG-pandnummer',
  typeof w.regel === 'string' && w.regel.startsWith('0091100000019457'), w.regel || '');
ok('en noemt het type, de maat en de hoogtes',
  typeof w.regel === 'string' && w.regel.includes('tuincentrum') && w.regel.includes('m2') && w.regel.includes('goot'));
ok('de andere kant op valt hij terug op het dichtstbijzijnde pand',
  w.achter && w.achter.hoe === 'dichtstbij', w.achter ? `${w.achter.id} op ${w.achter.afstand} m` : 'niets');
ok('sta je erin, dan wijst hij het pand zelf aan',
  w.midden && w.midden.id === '0091100000019457' && w.midden.afstand === 0);
ok('waar niets staat wijst hij ook niets aan', w.leeg === null,
  w.leegPunt ? `gekeken vanaf ${w.leegPunt.x} / ${w.leegPunt.z}` : '');
if (w.huis) ok('en een gewone woning komt er ook uit',
  w.huis.gevonden === w.huis.gezocht, w.huis.regel || '');

// ------------------------------------------------------------- de toets zelf
console.log('\nP in het spel');
const toets = await page.evaluate(async () => {
  const g = window.__game;
  // op de plek gaan staan die de gebruiker doorgaf, kijkend naar de hal
  g.player.fly = false;
  g.player.inCar = null;
  g.player.pos.set(1451.7, 0, -55.3);
  g.player.yaw = Math.PI; g.player.pitch = 0;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
  await new Promise(r => requestAnimationFrame(r));
  const tekst = document.getElementById('msg').textContent;
  // en ergens waar niets staat
  g.player.pos.set(-2364.98, 0, -689.05);
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
  await new Promise(r => requestAnimationFrame(r));
  return { tekst, leeg: document.getElementById('msg').textContent };
});
ok('P zet het pand in beeld',
  toets.tekst.startsWith('0091100000019457') && toets.tekst.includes('klembord'), toets.tekst);
ok('en zegt het eerlijk als er niets staat', toets.leeg.includes('geen pand'), toets.leeg);

// -------------------------------------------------- de normaal van een muur
console.log('\nde buitenkant van een opgetrokken pand');
/*
 Het woordmerk stond gespiegeld op de gevel: NIJZNAR. De oorzaak zat niet in de
 textuur maar in de normaal van het muurvlak — die wees naar binnen, en dan loopt
 de u-richting van het doek achterstevoren (en rekent de belichting met de
 verkeerde kant, en wordt de voorgevel als achterkant behandeld). Deze toets legt
 het teken vast: de normaal die js/kaartwereld.js voor een muur uitrekent moet
 buiten het grondvlak uitkomen, op elke zijde van elk pand in de steekproef.
*/
const nrm = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const { muurNormaal } = await import('/js/kaartwereld.js');
  const inRing = (r, x, z) => {
    let b = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const a = r[i], c = r[j];
      if ((a[1] > z) !== (c[1] > z) && x < (c[0] - a[0]) * (z - a[1]) / (c[1] - a[1]) + a[0]) b = !b;
    }
    return b;
  };
  let zijden = 0, naarBinnen = 0, panden = 0;
  for (let i = 0; i < KAART.panden.length; i += 37) {
    const v = KAART.panden[i].voet;
    if (!v || v.length < 3) continue;
    panden++;
    for (let k = 0; k < v.length; k++) {
      const a = v[k], b = v[(k + 1) % v.length];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.4) continue;
      const n = muurNormaal(a, b);
      zijden++;
      // een halve meter langs de normaal vanaf het midden van de zijde
      if (inRing(v, (a[0] + b[0]) / 2 + n[0] * 0.25, (a[1] + b[1]) / 2 + n[2] * 0.25)) naarBinnen++;
    }
  }
  // en de gevel van de Ranzijn-hal kijkt dezelfde kant op als `front`
  const hal = KAART.panden.find(q => q.id === '0091100000019457');
  let beste = -2;
  for (let k = 0; k < hal.voet.length; k++) {
    const a = hal.voet[k], b = hal.voet[(k + 1) % hal.voet.length];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 4) continue;
    const n = muurNormaal(a, b);
    beste = Math.max(beste, n[0] * hal.front[0] + n[2] * hal.front[1]);
  }
  return { panden, zijden, naarBinnen, kant: +beste.toFixed(2) };
});
ok('geen enkele muurnormaal wijst naar binnen', nrm.naarBinnen === 0,
  `${nrm.zijden} zijden van ${nrm.panden} panden, ${nrm.naarBinnen} fout`);
ok('en de voorgevel van de hal kijkt dezelfde kant op als `front`',
  nrm.kant > 0.9, `kant ${nrm.kant}`);

// ------------------------------------------------------ het Ranzijn-pand
console.log('\nRanzijn staat op het juiste pand');
const r = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const T = await import('/js/textures.js');
  const lijst = KAART.panden.filter(q => q.type === 'tuincentrum');
  const p = lijst[0];
  const buur = KAART.panden.find(q => q.id === '0091100000015459');
  let opp = 0;
  for (let i = 0; i < p.voet.length; i++) {
    const u = p.voet[i], v = p.voet[(i + 1) % p.voet.length];
    opp += u[0] * v[1] - v[0] * u[1];
  }
  const st = T.HOUSE_STYLES.tuincentrum;
  return { n: lijst.length, id: p.id, opp: Math.round(Math.abs(opp / 2)), goot: p.goot, nok: p.nok,
    front: p.front, buur: buur && buur.type, merk: st.merk, pui: st.puiDeel };
});
ok('er is precies één tuincentrum', r.n === 1, `${r.n}`);
ok('en dat is 0091100000019457', r.id === '0091100000019457', `${r.id}, ${r.opp} m²`);
ok('het buurpand is geen tuincentrum meer', r.buur !== 'tuincentrum', `0091100000015459 is nu ${r.buur}`);
ok('de voorgevel kijkt naar de kant waar de melding vandaan kwam',
  r.front && r.front[1] < -0.9, r.front ? `front ${r.front[0]} / ${r.front[1]}` : '');
ok('met het woordmerk en de glazen pui', r.merk === 'RANZIJN' && r.pui > 0.8);

console.log(`\nfouten in de pagina: ${fouten.length ? fouten.join(' | ') : 'geen'}`);
console.log(`\n${goed} goed, ${fout} fout`);
await browser.close();
process.exit(fout ? 1 : 0);
