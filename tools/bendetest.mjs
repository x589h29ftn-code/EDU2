/*
 De bende van De Veteraan op straat, na missie 10 (verzoek 23 sep 2026).

   node tools/server.mjs 8123 &   node tools/bendetest.mjs [poort]

 1. De plekken: langs de straten van Tinga en de Lemmerweg, op de stoep, niet in
    een botsdoos, niet in het water.
 2. Vóór missie 10 staat er niemand; daarna verschijnen er groepjes van twee tot
    vier man, op afstand, en nooit meer dan drie tegelijk.
 3. Ze hebben een pistool of een knuppel, en in een groepje van drie of vier
    allebei.
 4. Op twintig meter laten ze je met rust; op tien meter vallen ze aan, en wie
    blijft staan wordt geslagen en beschoten.
 5. Loop je door, dan komen ze achter je aan; na een tijdje geven ze het op en
    slenteren ze terug. Sprint je weg, dan ben je ze eerder kwijt.
 6. Een treffer legt een man neer en een pistool blijft liggen; omverrijden kan
    ook.
 7. Ga je neer, dan word je wakker voor je eigen voordeur. En tijdens een missie
    staan ze er niet.
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fout = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fout++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 600000 });
await page.waitForFunction(() => window.__game, null, { timeout: 600000 });
await page.evaluate(async () => {
  const { geluid } = await import('/js/audio.js');
  localStorage.removeItem('tinga.spel.v1');
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  g.player.wapenSlot = false; g.player.wapenUit = false;
  geluid.start();
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) g.verhaal.update(dt); };
  window.__zet = (x, z) => { g.player.inCar = null; g.player.pos.set(x, 0, z); g.player.applyCamera(); };
  window.__loting = (zaad) => {
    let a = zaad >>> 0;
    Math.random = () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  // na missie 10, met Koningsspil 20 als eigen huis
  window.__naMissie10 = (klaar = true) => g.verhaal.herstel({ missie: 'klaar', fase: 'klaar',
    huis: 'Koningsspil 20', veteraanKlaar: klaar, geld: 1000 });
  window.__loting(3);
});

// ------------------------------------------------------------ de plekken
kop('waar ze staan');
const plek = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const { resolveCollisions, pointInWater } = await import('/js/world.js');
  const { BENDE_STRATEN } = await import('/js/bendes.js');
  const b = window.__game.verhaal.bendes;
  const p = b.plekken;
  const rijbanen = KAART.wegassen.filter(a => a.drive);
  let inDoos = 0, nat = 0, verStraat = 0, opRijbaan = 0, buiten = 0;
  const straten = new Set();
  for (const q of p) {
    const [kx, kz] = resolveCollisions(q.x, q.z, 0.4);
    if (Math.hypot(kx - q.x, kz - q.z) > 0.01) inDoos++;
    if (pointInWater(q.x, q.z)) nat++;
    if (Math.hypot(q.x, q.z) > 1100) buiten++;
    straten.add(q.straat);
    // de dichtstbijzijnde rijbaan: hoort bij een straat uit de lijst, en je staat er niet op
    let best = Infinity, naam = null, breed = 5;
    for (const a of rijbanen) for (let i = 1; i < a.pts.length; i++) {
      const u = a.pts[i - 1], v = a.pts[i];
      const dx = v[0] - u[0], dz = v[1] - u[1], L2 = dx * dx + dz * dz || 1;
      const s = Math.max(0, Math.min(1, ((q.x - u[0]) * dx + (q.z - u[1]) * dz) / L2));
      const d = Math.hypot(u[0] + dx * s - q.x, u[1] + dz * s - q.z);
      if (d < best) { best = d; naam = a.naam; breed = a.w || 5; }
    }
    if (best > 12) verStraat++;
    if (best < breed / 2 + 0.5) opRijbaan++;
  }
  return { n: p.length, inDoos, nat, verStraat, opRijbaan, buiten, straten: [...straten], lijst: BENDE_STRATEN.length };
});
ok(plek.n > 80, 'er zijn genoeg plekken', `${plek.n}`);
ok(plek.straten.includes('Lemmerweg') && plek.straten.includes('Molenkrite') && plek.straten.length > 10,
  'in Tinga en langs de Lemmerweg', `${plek.straten.length} straten`);
ok(plek.inDoos === 0 && plek.nat === 0, 'geen enkele in een botsdoos of in het water', `${plek.inDoos} / ${plek.nat}`);
ok(plek.opRijbaan === 0 && plek.verStraat === 0, 'allemaal op de stoep naast de rijbaan',
  `${plek.opRijbaan} op de rijbaan, ${plek.verStraat} te ver ervan`);
ok(plek.buiten === 0, 'en binnen het stuk bij Tinga');

// ------------------------------------------------- vóór en na missie 10
kop('pas na missie 10');
const tijd = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const g = window.__game, b = g.verhaal.bendes;
  const huis = KAART.panden.find(p => p.straat === 'Molenkrite' && (p.nr || []).includes('15'));
  window.__zet(huis.rect.cx + 12, huis.rect.cz + 12);
  window.__naMissie10(false);
  window.__stap(200, 0.1);
  const voor = b.groepen.length;
  window.__naMissie10(true);
  const sp = g.player.pos;
  let max = 0, t = -1;
  const afstanden = [];
  for (let i = 0; i < 600; i++) {
    const n0 = b.groepen.length;
    g.verhaal.update(0.1);
    if (b.groepen.length > n0) {
      for (const gr of b.groepen.slice(n0)) afstanden.push(Math.hypot(gr.plek.x - sp.x, gr.plek.z - sp.z));
    }
    if (b.groepen.length && t < 0) t = i * 0.1;
    max = Math.max(max, b.groepen.length);
  }
  const maten = b.groepen.map(gr => gr.leden.length);
  return { voor, t, max, maten, afstanden };
});
ok(tijd.voor === 0, 'vóór missie 10 staat er niemand', `${tijd.voor} groepjes`);
ok(tijd.t >= 0 && tijd.t < 10, 'daarna verschijnt er al snel een groepje', `na ${tijd.t.toFixed(1)} s`);
ok(tijd.max >= 2 && tijd.max <= 3, 'nooit meer dan drie tegelijk', `hoogstens ${tijd.max}`);
ok(tijd.maten.every(n => n >= 2 && n <= 4), 'van twee tot vier man', tijd.maten.join(', '));
ok(tijd.afstanden.every(d => d >= 60 && d <= 240), 'en ze verschijnen op afstand',
  tijd.afstanden.map(d => d.toFixed(0)).join(', '));

// -------------------------------------------------------- de bewapening
kop('pistool of knuppel');
const wapens = await page.evaluate(() => {
  const g = window.__game, b = g.verhaal.bendes;
  b.reset();
  let pistool = 0, knuppel = 0, gemengd = true;
  for (let i = 0; i < 30; i++) {
    const gr = b.zetGroep(5000 + i * 20, 5000, 2 + (i % 3));
    for (const l of gr.leden) {
      if (l.soort === 'pistool') pistool++; else knuppel++;
      if (l.persoon.wapenSoort !== l.soort) gemengd = false;
    }
    if (gr.leden.length >= 3 && new Set(gr.leden.map(l => l.soort)).size < 2) gemengd = false;
  }
  b.reset();
  return { pistool, knuppel, gemengd };
});
const aandeel = wapens.pistool / (wapens.pistool + wapens.knuppel);
ok(aandeel > 0.25 && aandeel < 0.55, 'soms een pistool, meestal een knuppel',
  `${wapens.pistool} pistolen, ${wapens.knuppel} knuppels`);
ok(wapens.gemengd, 'wat ze dragen is wat ze hebben, en in een groepje van drie of vier allebei');

// ------------------------------------------------ te dichtbij: aanval
kop('te dichtbij');
const aanval = await page.evaluate(async () => {
  const { zichtVrij } = await import('/js/world.js');
  const g = window.__game, b = g.verhaal.bendes;
  // vanaf hier alleen de groepjes die de proef zelf neerzet
  b.opduiken = false;
  /*
   Een plek op straat met een tweede plek op acht tot twaalf meter en vrij zicht
   ertussen: daar staat de speler, zoals hij er zelf ook zou staan. Op een
   willekeurig punt tien meter verderop stond hij de eerste keer achter een heg.
  */
  let p = null, q = null;
  for (const a of b.plekken) {
    q = b.plekken.find(c => { const d = Math.hypot(c.x - a.x, c.z - a.z); return d > 8 && d < 12 && zichtVrij(a.x, a.z, c.x, c.z, 1.2); });
    if (q) { p = a; break; }
  }
  const ux = (q.x - p.x) / Math.hypot(q.x - p.x, q.z - p.z), uz = (q.z - p.z) / Math.hypot(q.x - p.x, q.z - p.z);
  b.reset();
  const gr = b.zetGroep(p.x, p.z, 4);
  // twintig meter verderop
  window.__zet(p.x + ux * 20, p.z + uz * 20);
  g.player.health = 100;
  window.__stap(40, 0.05);
  const op20 = gr.staat;
  window.__zet(q.x, q.z);
  window.__stap(10, 0.05);
  const op10 = gr.staat;
  // blijven staan: hoe snel gaat het leven eraf?
  let t = 0, eersteKlap = -1;
  const ks = gr.leden.filter(l => l.soort === 'knuppel');
  let dichtst = Infinity;
  for (; t < 12 && g.player.health > 0; t += 0.05) {
    g.verhaal.update(0.05);
    for (const l of ks) dichtst = Math.min(dichtst, Math.hypot(l.persoon.groep.position.x - g.player.pos.x, l.persoon.groep.position.z - g.player.pos.z));
    if (eersteKlap < 0 && ks.some(l => l.slag > 0)) eersteKlap = t;
  }
  const leven = g.player.health;
  window.__stap(80, 0.05);                  // ging je neer, dan loopt dat eerst af
  return { leven, op20, op10, eersteKlap, dichtst, soorten: gr.leden.map(l => l.soort) };
});
ok(aanval.op20 === 'hangen', 'op twintig meter laten ze je met rust', aanval.op20);
ok(aanval.op10 === 'jacht', 'op tien meter vallen ze aan', aanval.op10);
ok(aanval.eersteKlap >= 0 && aanval.dichtst < 1.8, 'de knuppels komen bij je en halen uit',
  `eerste slag na ${aanval.eersteKlap.toFixed(1)} s, dichtstbij ${aanval.dichtst.toFixed(1)} m`);
ok(aanval.leven < 70, 'en wie blijft staan wordt in elkaar geslagen', `nog ${aanval.leven} leven na 12 s`);

// ----------------------------------------- doorlopen, en ze geven het op
kop('achtervolgen en opgeven');
const jacht = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const g = window.__game, b = g.verhaal.bendes;
  // een lang recht stuk Lemmerweg om over weg te lopen
  const as = KAART.wegassen.filter(a => a.drive && a.naam === 'Lemmerweg')
    .map(a => ({ a, L: Math.hypot(a.pts[a.pts.length - 1][0] - a.pts[0][0], a.pts[a.pts.length - 1][1] - a.pts[0][1]) }))
    .filter(x => Math.hypot(x.a.pts[0][0], x.a.pts[0][1]) < 1100)
    .sort((p, q) => q.L - p.L)[0].a;
  const A = as.pts[0], B = as.pts[as.pts.length - 1];
  const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const ux = (B[0] - A[0]) / L, uz = (B[1] - A[1]) / L;
  const loop = (v, maxT) => {
    b.reset();
    g.player.health = 1e9;                    // de meting gaat over hoelang, niet over overleven
    // het groepje naast de weg, de speler tien meter verderop
    const gx = A[0] + ux * 20 - uz * 6, gz = A[1] + uz * 20 + ux * 6;
    const gr = b.zetGroep(gx, gz, 3);
    let s = 30;
    window.__zet(A[0] + ux * s, A[1] + uz * s);
    let tAlarm = -1, tOp = -1, bijgebleven = 0, t = 0;
    for (; t < maxT; t += 0.1) {
      s = Math.min(L - 5, s + v * 0.1);
      g.player.pos.set(A[0] + ux * s, 0, A[1] + uz * s);
      g.verhaal.update(0.1);
      if (gr.staat === 'jacht' && tAlarm < 0) tAlarm = t;
      const d = Math.min(...gr.leden.map(l => Math.hypot(l.persoon.groep.position.x - g.player.pos.x,
        l.persoon.groep.position.z - g.player.pos.z)));
      if (t < 8 && tAlarm >= 0 && d < 14) bijgebleven += 0.1;
      if (gr.staat === 'terug' && tOp < 0) { tOp = t; break; }
    }
    // en daarna slenteren ze terug naar hun plek
    let thuis = -1;
    for (let i = 0; i < 900 && thuis < 0; i++) {
      g.verhaal.update(0.1);
      if (gr.staat === 'hangen') thuis = i * 0.1;
    }
    const bij = Math.max(...gr.leden.map(l => Math.hypot(l.persoon.groep.position.x - l.thuis.x,
      l.persoon.groep.position.z - l.thuis.z)));
    g.player.health = 100;
    return { tAlarm, tOp, bijgebleven, thuis, bij };
  };
  const lopen = loop(4.2, 60);
  const sprint = loop(7.5, 60);
  b.reset();
  return { lopen, sprint };
});
ok(jacht.lopen.tAlarm >= 0 && jacht.lopen.tAlarm < 1, 'langslopen: ze komen achter je aan', `na ${jacht.lopen.tAlarm.toFixed(1)} s`);
ok(jacht.lopen.bijgebleven > 4, 'en lopend houden ze je bij', `${jacht.lopen.bijgebleven.toFixed(1)} s binnen 14 m`);
ok(jacht.lopen.tOp > 10 && jacht.lopen.tOp < 32, 'na een tijdje geven ze het op', `na ${jacht.lopen.tOp.toFixed(0)} s`);
ok(jacht.sprint.tOp >= 0 && jacht.sprint.tOp < jacht.lopen.tOp, 'sprinten: dan ben je ze eerder kwijt',
  `na ${jacht.sprint.tOp.toFixed(0)} s`);
ok(jacht.lopen.thuis >= 0 && jacht.lopen.bij < 2.5, 'en ze slenteren terug naar hun plek',
  `na ${jacht.lopen.thuis.toFixed(0)} s, op ${jacht.lopen.bij.toFixed(1)} m`);

// ------------------------------------------------ schieten en omverrijden
kop('neerleggen');
const neer = await page.evaluate(() => {
  const g = window.__game, b = g.verhaal.bendes;
  const p = b.plekken[60];
  b.reset();
  const gr = b.zetGroep(p.x, p.z, 4);
  const gevallen = [];
  const echt = g.buit.laatVallen;
  g.buit.laatVallen = (soort, x, z, w) => { gevallen.push(soort); return echt.call(g.buit, soort, x, z, w); };
  window.__zet(p.x + 30, p.z);
  const doelVoor = g.verhaal.doelen().length;
  const pistool = gr.leden.find(l => l.soort === 'pistool');
  const raak = g.verhaal.raak(pistool.persoon.groep.children[0]);
  window.__stap(4);
  const na = { raak, staat: gr.staat, neer: pistool.staat, doelen: g.verhaal.doelen().length };
  // en omverrijden
  const knuppel = gr.leden.find(l => l.soort === 'knuppel' && l.staat !== 'neer');
  const kp = knuppel.persoon.groep.position;
  const auto = g.vehicles.cars.find(c => c.driveable !== false && c.zichtbaar !== false);
  const oud = { x: auto.x, z: auto.z, speed: auto.speed };
  g.player.inCar = auto;
  auto.x = kp.x + 0.5; auto.z = kp.z; auto.speed = 12;
  g.verhaal.update(0.05);
  const omver = knuppel.staat;
  auto.x = oud.x; auto.z = oud.z; auto.speed = 0;
  g.player.inCar = null;
  g.buit.laatVallen = echt;
  b.reset();
  return { doelVoor, ...na, gevallen, omver };
});
ok(neer.raak && neer.neer === 'neer', 'een treffer legt een man neer');
ok(neer.staat === 'jacht', 'en de rest komt op je af');
ok(neer.doelen === neer.doelVoor - 1, 'wie ligt is geen doel meer', `${neer.doelVoor} → ${neer.doelen}`);
ok(neer.gevallen.includes('pistool'), 'het pistool blijft liggen', neer.gevallen.join(', '));
ok(neer.omver === 'neer', 'omverrijden kan ook');

// ------------------------------------------ neergaan, en tijdens een missie
kop('neergaan en missies');
const dood = await page.evaluate(() => {
  const g = window.__game, b = g.verhaal.bendes;
  const p = b.plekken[40];
  b.reset();
  b.zetGroep(p.x, p.z, 4);
  window.__zet(p.x + 3, p.z);
  g.player.health = 12;
  let t = 0;
  for (; t < 20 && g.player.active; t += 0.05) g.verhaal.update(0.05);
  window.__stap(80, 0.05);                  // de dood loopt af
  const w = g.woningen.find(x => x.naam === 'Koningsspil 20');
  const d = w.plekken.deurBuiten;
  const uit = { t, bijDeur: Math.hypot(g.player.pos.x - d.x, g.player.pos.z - d.z), leven: g.player.health,
    groepjes: b.groepen.filter(gr => Math.hypot(gr.plek.x - p.x, gr.plek.z - p.z) < 5).length };
  // en een missie: dan staan ze er niet
  g.verhaal.startMissie('bx');
  window.__stap(4);
  uit.tijdensMissie = b.groepen.length;
  window.__stap(300, 0.1);
  uit.tijdensMissieLater = b.groepen.length;
  return uit;
});
ok(dood.t < 20, 'ze kunnen je neerleggen', `na ${dood.t.toFixed(1)} s`);
ok(dood.bijDeur < 3 && dood.leven === 100, 'en je wordt wakker voor je eigen voordeur', `${dood.bijDeur.toFixed(1)} m`);
ok(dood.groepjes === 0, 'zonder de bende die je neerlegde ernaast');
ok(dood.tijdensMissie === 0 && dood.tijdensMissieLater === 0, 'tijdens een missie staan ze er niet');

console.log(`\n${fout ? fout + ' fout' : 'alles goed'}`);
await browser.close();
process.exit(fout ? 1 : 0);
