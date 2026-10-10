/*
 Toetst de drone-klus (js/klusjes.js, stap 132): een auto volgen met je drone, de deal fotograferen en
 de foto terugbrengen.

 1. Het aanbod: zonder drone nooit de soort 'drone'; met een drone komt hij wel; en nooit twee keer
    dezelfde soort achter elkaar (200 keer het aanbod laten trekken, met en zonder drone).
 2. Volgen binnen afstand en hoogte: de auto rijdt over zijn lijn naar de deal, de klus blijft lopen,
    de balk staat in beeld; de deal begint.
 3. De foto: vóór de deal telt hij niet, met de deal buiten beeld niet, te ver weg niet, en midden in
    beeld wel ("FOTO" en de flits).
 4. Terugbrengen: E bij de opdrachtgever betaalt.
 5. Te ver, te laag (gezien) en te hoog langer dan de grens: mislukt; net daaronder nog niet. Zonder
    drone in de lucht: na de grens kwijt.
 6. X ruimt op (de balk weg, de auto's weg zodra je ze niet meer ziet), en `reset` (laden, een missie)
    ruimt meteen op.

 Gebruik: npm run server &   node tools/droneklustest.mjs 8123
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
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const K = await import('/js/klusjes.js');
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, v = g.verhaal, D = g.drone;
  g.player.active = false;
  window.__autoplay = false; window.__geenDownload = true;
  g.sfeer.uur = 14;
  window.__KAART = KAART; window.__KD = K.KLUS_DRONE;
  window.__meld = [];
  const echt = g.hud.melding.bind(g.hud);
  g.hud.melding = (k, o, t) => { window.__meld.push(`${k}|${o}`); return echt(k, o, t); };
  window.__stap = (n = 20, dt = 0.05) => {
    for (let i = 0; i < n; i++) { g.player.health = 100; v.update(dt); }
  };
  window.__klik = (max = 40) => {
    for (let i = 0; i < max && !document.getElementById('dialoog').hidden; i++) { v.toets(); window.__stap(1); }
  };
  window.__zet = (x, z) => { g.player.inCar = null; g.player.pos.set(x, 0, z); g.player.applyCamera(); };
  window.__klaar = () => {
    if (D.actief) D.terug();
    // (wie van de vorige klus nog staat, gaat weg: anders is er niemand meer vrij voor een aanbod)
    v.klusjes.reset();
    const s = v.bewaar(); s.missie = 'klaar'; s.fase = 'klaar'; s.volgende = null;
    v.herstel(s); v.__geenVolgende(); g.politie.reset();
    const st = KAART.start; window.__zet(st.x, st.z);
  };
  window.__neemAan = (soort) => {
    const kl = v.klusjes;
    kl.__soort(soort);
    if (!kl.__nieuwAanbod()) return null;
    const a = kl.aanbod;
    window.__zet(a.x + 1.2, a.z);
    window.__stap(2);
    v.toets();
    window.__klik();
    return kl.klus;
  };
  // de drone op een plek zetten en laten kijken naar een punt (zoals js/drone.js de camera zet)
  window.__richt = (x, y, z, tx, ty, tz) => {
    const P = g.player;
    D.pos.set(x, y, z);
    const dx = tx - x, dz = tz - z;
    P.yaw = Math.atan2(-dx, -dz);
    P.pitch = Math.atan2(ty - y, Math.hypot(dx, dz));
    D.update(0);
    g.camera.position.set(x, y, z);
    g.camera.rotation.set(P.pitch, P.yaw, 0, 'YXZ');
    g.camera.updateMatrixWorld();
  };
  // de drone boven de auto houden: `opzij` m ernaast, `hoog` m boven de auto, kijkend naar de auto
  window.__boven = (opzij, hoog) => {
    const d = v.klusjes.deal; if (!d) return;
    const a = d.auto, y = a.mesh ? a.mesh.position.y : 0;
    window.__richt(a.x + opzij, y + hoog, a.z, a.x, y, a.z);
  };
  // in de lucht en de klus tot 'volgen'
  window.__opstijgen = () => {
    const P = g.player;
    P.drone = true; D.accu = 300; P.inCar = null; P.binnen = false; P.zit = false;
    if (!D.actief) D.start();
    window.__boven(10, 28);
    for (let i = 0; i < 30 && v.klusjes.klus && v.klusjes.klus.fase !== 'volgen'; i++) { window.__boven(10, 28); window.__stap(1, 0.1); }
    return v.klusjes.klus ? v.klusjes.klus.fase : null;
  };
  // n tellen volgen met een vaste afstand en hoogte
  window.__volg = (tellen, opzij, hoog, dt = 0.1) => {
    for (let i = 0; i < Math.round(tellen / dt) && v.klusjes.klus; i++) { window.__boven(opzij, hoog); window.__stap(1, dt); }
    return !!v.klusjes.klus;
  };
  window.__klaar();
});

// ------------------------------------------------------------------ 1. het aanbod
kop('het aanbod: de drone alleen met een drone, nooit twee keer dezelfde');
const trek = await page.evaluate(() => {
  const g = window.__game, kl = g.verhaal.klusjes;
  const uit = {};
  for (const metDrone of [false, true]) {
    g.player.drone = metDrone;
    const reeks = [];
    let dubbel = 0;
    for (let i = 0; i < 200; i++) {
      if (!kl.__nieuwAanbod()) continue;
      const s = kl.aanbod.soort;
      if (reeks.length && reeks[reeks.length - 1] === s) dubbel++;
      reeks.push(s);
    }
    const tel = {};
    for (const s of reeks) tel[s] = (tel[s] || 0) + 1;
    uit[metDrone ? 'met' : 'zonder'] = { n: reeks.length, dubbel, tel };
  }
  return uit;
});
ok(trek.zonder.n >= 150 && !trek.zonder.tel.drone, 'zonder drone nooit een drone-klus', `${trek.zonder.n} keer: ${JSON.stringify(trek.zonder.tel)}`);
ok(trek.met.n >= 150 && trek.met.tel.drone > 10, 'met een drone komt hij wel', `${trek.met.n} keer: ${JSON.stringify(trek.met.tel)}`);
ok(trek.zonder.dubbel === 0 && trek.met.dubbel === 0, 'nooit twee keer dezelfde soort achter elkaar',
  `zonder drone ${trek.zonder.dubbel}, met ${trek.met.dubbel}`);
const geenDrone = await page.evaluate(() => {
  // een drone-aanbod, en dan is de drone kwijt: dan een andere klus
  const g = window.__game, kl = g.verhaal.klusjes;
  window.__klaar();
  g.player.drone = true;
  kl.__soort('drone');
  if (!kl.__nieuwAanbod()) return null;
  g.player.drone = false;
  const a = kl.aanbod;
  window.__zet(a.x + 1.2, a.z); window.__stap(2);
  g.verhaal.toets(); window.__klik();
  const s = kl.klus ? kl.klus.soort : null;
  g.verhaal.klusAfbreken();
  return s;
});
ok(geenDrone && geenDrone !== 'drone', 'drone kwijt na het aanbod: dan draait er een andere klus', `${geenDrone}`);

// ------------------------------------------------------------------ 2. volgen, 3. de foto, 4. terugbrengen
kop('volgen binnen afstand en hoogte, de foto, terugbrengen');
const goed = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, kl = v.klusjes, KD = window.__KD;
  window.__klaar();
  g.player.drone = true;
  const geld0 = v.geld;
  const k = window.__neemAan('drone');
  if (!k) return { geen: true };
  const uit = { soort: k.soort, loon: k.loon, fase0: k.fase, deal: !!kl.deal };
  const d = kl.deal;
  uit.autos = d ? [d.auto, d.koperAuto].every(c => g.vehicles.cars.includes(c)) : false;
  uit.lengte = d ? Math.round(d.L.lengte) : 0;
  // zonder drone in de lucht: de hint, en de auto blijft staan
  window.__stap(20, 0.1);
  uit.hint = document.getElementById('praat') ? document.getElementById('praat').textContent : '';
  uit.staatStil = d.fase === 'wacht' && kl.klus.fase === 'wachten';
  uit.fase1 = window.__opstijgen();
  // een foto vóór de deal telt niet
  const vooraf = kl.foto();
  uit.fotoVooraf = vooraf && !vooraf.ok;
  // volgen tot de deal: 15 m opzij, 28 m hoog
  let balkGezien = false, slecht = 0, stappen = 0;
  for (let i = 0; i < 3000 && kl.klus && kl.deal && kl.deal.fase !== 'deal'; i++) {
    window.__boven(15, 28); window.__stap(1, 0.1); stappen++;
    if (!document.getElementById('droneklus').hidden) balkGezien = true;
    if (kl.klus && kl.klus.staat && kl.klus.staat !== 'goed') slecht++;
  }
  uit.tijd = Math.round(stappen * 0.1);
  uit.balk = balkGezien; uit.slecht = slecht;
  uit.nogBezig = !!kl.klus; uit.dealFase = kl.deal ? kl.deal.fase : null;
  const st = kl.deal;
  if (!st || st.fase !== 'deal') return uit;
  uit.autoStil = Math.abs(st.auto.speed) < 0.01;
  uit.afstandKoper = Math.round(Math.hypot(st.auto.x - st.koperAuto.x, st.auto.z - st.koperAuto.z) * 10) / 10;
  const a = st.auto;
  const P = { x: 0, y: 0, z: 0 };
  // de twee mannen zijn de enige zichtbare personen bij het midden van de deal
  const m = st.midden;
  P.x = m.x; P.z = m.z; P.y = (a.mesh ? a.mesh.position.y : 0) + 1.1;
  // weggekeken: de deal staat er niet op
  window.__richt(m.x + 12, P.y + 22, m.z, m.x + 80, P.y, m.z + 60);
  const weg = kl.foto();
  uit.fotoWeg = weg && !weg.ok;
  // te ver: 75 m opzij (en die ene tel telt nog niet als kwijt)
  window.__richt(m.x + 72, P.y + 25, m.z, P.x, P.y, P.z);
  const ver = kl.foto();
  uit.fotoVer = ver && !ver.ok;
  // midden in beeld, 14 m opzij en 24 m hoog
  window.__richt(m.x + 14, P.y + 24, m.z, P.x, P.y, P.z);
  uit.meldVoor = window.__meld.length;
  const goedeFoto = kl.foto();
  uit.fotoGoed = goedeFoto && goedeFoto.ok;
  uit.fotoMelding = window.__meld.slice(uit.meldVoor).some(x => x.startsWith('FOTO|De deal staat erop'));
  uit.flits = document.getElementById('fotoflits').classList.contains('aan');
  uit.faseNaFoto = kl.klus ? kl.klus.fase : null;
  uit.balkNaFoto = document.getElementById('droneklus').hidden;
  // terug naar de opdrachtgever, te voet, E
  g.drone.terug();
  const gp = kl.klus.gever.groep.position;
  window.__zet(gp.x + 1.4, gp.z);
  window.__stap(3);
  uit.prompt = document.getElementById('praat') ? document.getElementById('praat').textContent : '';
  v.toets(); window.__klik();
  window.__stap(3);
  uit.betaald = v.geld - geld0;
  uit.naKlus = kl.bezig;
  uit.geslaagd = window.__meld.some(x => x.startsWith('KLUS GESLAAGD'));
  return uit;
});
if (goed.geen) ok(false, 'een drone-klus aannemen');
else {
  ok(goed.soort === 'drone' && goed.fase0 === 'wachten' && goed.deal && goed.autos, 'de drone-klus aangenomen: de auto en de koper staan klaar',
    `${goed.lengte} m rijden, € ${goed.loon}`);
  ok(goed.loon >= 600 && goed.loon <= 900 && goed.loon % 50 === 0, 'de beloning tussen € 600 en € 900', `€ ${goed.loon}`);
  ok(goed.staatStil && /drone/i.test(goed.hint), 'zonder drone in de lucht: "start je drone (B)" en de auto wacht', goed.hint);
  ok(goed.fase1 === 'volgen', 'met de drone in de lucht rijdt hij weg', `${goed.fase1}`);
  ok(goed.fotoVooraf, 'een foto vóór de deal telt niet');
  ok(goed.nogBezig && goed.dealFase === 'deal' && goed.slecht === 0 && goed.balk,
    'binnen afstand en hoogte volgen tot de deal: de klus loopt door, de balk in beeld', `${goed.tijd} s, fase ${goed.dealFase}, ${goed.slecht} keer niet goed`);
  ok(goed.autoStil && goed.afstandKoper > 6 && goed.afstandKoper < 16, 'de auto staat stil bij de auto van de koper', `${goed.afstandKoper} m`);
  ok(goed.fotoWeg, 'een foto met de deal buiten beeld telt niet');
  ok(goed.fotoVer, 'een foto van te ver weg telt niet');
  ok(goed.fotoGoed && goed.fotoMelding && goed.flits, 'een foto met de deal midden in beeld telt: FOTO en de flits');
  ok(goed.faseNaFoto === 'terug' && goed.balkNaFoto, 'daarna: de foto terugbrengen, de balk weg');
  ok(/foto/i.test(goed.prompt), 'bij de opdrachtgever: "E — foto laten zien"', goed.prompt);
  ok(goed.betaald === goed.loon && !goed.naKlus && goed.geslaagd, 'E bij hem betaalt', `+ € ${goed.betaald}`);
}

// ------------------------------------------------------------------ 5. te ver, te laag, te hoog
kop('te ver, te laag, te hoog, niet in de lucht');
const grenzen = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, kl = v.klusjes, KD = window.__KD;
  const uit = {};
  const proef = (naam, opzij, hoog, vlak, erover) => {
    window.__klaar();
    g.player.drone = true;
    const k = window.__neemAan('drone');
    if (!k) { uit[naam] = { geen: true }; return; }
    window.__opstijgen();
    window.__volg(4, 10, 28);                   // eerst goed, hij rijdt al
    const m0 = window.__meld.length;
    const nogBezig = window.__volg(vlak, opzij, hoog);
    const bezigNa = window.__volg(erover, opzij, hoog);
    uit[naam] = { nogBezig, bezigNa, meld: window.__meld.slice(m0).filter(x => x.startsWith('KLUS MISLUKT')) };
    if (kl.bezig) v.klusAfbreken();
  };
  proef('ver', 90, 28, KD.kwijt - 1, 2);
  proef('laag', 8, 8, KD.gezien - 1, 1.5);
  proef('hoog', 5, 70, KD.kwijt - 1, 2);
  // niet in de lucht: de drone terug terwijl hij rijdt
  window.__klaar();
  g.player.drone = true;
  if (window.__neemAan('drone')) {
    window.__opstijgen();
    window.__volg(3, 10, 28);
    g.drone.terug();
    const m0 = window.__meld.length;
    window.__stap(Math.round((KD.kwijt - 1) / 0.1), 0.1);
    const nogBezig = kl.bezig;
    window.__stap(25, 0.1);
    uit.niet = { nogBezig, bezigNa: kl.bezig, meld: window.__meld.slice(m0).filter(x => x.startsWith('KLUS MISLUKT')) };
    if (kl.bezig) v.klusAfbreken();
  }
  return uit;
});
for (const [naam, wat] of [['ver', `verder dan ${90} m`], ['laag', 'te laag (8 m): gezien'], ['hoog', 'te hoog (70 m)'], ['niet', 'zonder drone in de lucht']]) {
  const r = grenzen[naam];
  ok(r && !r.geen && r.nogBezig && !r.bezigNa && r.meld.length > 0, `${wat}: net onder de grens loopt hij nog, erover mislukt`,
    r ? ((r.meld && r.meld[0]) || JSON.stringify(r)) : 'geen');
}

// ------------------------------------------------------------------ 6. X en reset
kop('afbreken en opruimen');
const ruim = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, kl = v.klusjes, KAART = window.__KAART;
  const uit = {};
  window.__klaar();
  g.player.drone = true;
  if (!window.__neemAan('drone')) return { geen: true };
  window.__opstijgen();
  window.__volg(5, 10, 28);
  const d = kl.deal, autos = [d.auto, d.koperAuto];
  uit.balkVoor = !document.getElementById('droneklus').hidden;
  const m0 = window.__meld.length;
  uit.afgebroken = v.klusAfbreken();
  uit.meld = window.__meld.slice(m0).some(x => x.startsWith('KLUS AFGEBROKEN'));
  uit.bezig = kl.bezig;
  uit.balkNa = document.getElementById('droneklus').hidden;
  uit.dealNogEven = !!kl.deal;   // hij rijdt door zolang je hem ziet
  // weg met de drone en ver weg met Erik: dan gaan de auto's weg
  g.drone.terug();
  let ver = null;
  for (const c of [[KAART.start.x, KAART.start.z], [KAART.start.x + 600, KAART.start.z], [KAART.start.x, KAART.start.z + 600], [KAART.start.x - 600, KAART.start.z]]) {
    if (autos.every(a => Math.hypot(a.x - c[0], a.z - c[1]) > 300)) { ver = c; break; }
  }
  window.__zet(ver[0], ver[1]);
  window.__stap(5, 0.1);
  uit.dealWeg = !kl.deal && autos.every(a => !g.vehicles.cars.includes(a));
  // reset (laden, een missie): meteen
  window.__klaar();
  if (window.__neemAan('drone')) {
    window.__opstijgen();
    window.__volg(3, 10, 28);
    const d2 = kl.deal, autos2 = [d2.auto, d2.koperAuto];
    kl.reset();
    uit.reset = !kl.bezig && !kl.deal && autos2.every(a => !g.vehicles.cars.includes(a)) && document.getElementById('droneklus').hidden;
  }
  if (g.drone.actief) g.drone.terug();
  return uit;
});
if (ruim.geen) ok(false, 'een drone-klus voor het afbreken');
else {
  ok(ruim.balkVoor && ruim.afgebroken && ruim.meld && !ruim.bezig && ruim.balkNa, 'X breekt de drone-klus af: geen klus meer, de balk weg');
  ok(ruim.dealWeg, 'de auto\'s van de deal gaan weg als je ze niet meer ziet', `nog even: ${ruim.dealNogEven}`);
  ok(ruim.reset, 'reset (laden, een nieuwe missie) ruimt meteen alles op');
}

console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
await browser.close();
process.exit(fouten ? 1 : 0);
