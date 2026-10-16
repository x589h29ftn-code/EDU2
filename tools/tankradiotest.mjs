/*
 Proef bij stap 202 (npm run tankradiotest). Gevraagd (16 okt 2026): "Tijdens No Mercy kan je radio draaien in de stafauto, dit
 tijdelijk uit. Je ziet Erik ook niet zitten in de stafauto. Claxonneren tussen auto's max 2 keer. De tank maakt geen motorgeluid
 en kan geen lantaarn omver rijden."

  1. De radio: tijdens No Mercy 4 en No Mercy 5 is er geen autoradio (`verhaal.geenRadio`, en js/main.js gebruikt die ook);
     daarbuiten wel.
  2. Erik in de stafauto: de stafauto heeft een bestuurder (Erik), met het hoofd boven de voorruit-rand en onder niets, de billen
     op de zitting van de linker voorstoel, de handen bij het stuur; van buiten (derde persoon) te zien, van binnen niet, en zonder
     speler niet.
  3. Toeteren: een auto die vaststaat achter een andere toetert hoogstens twee keer, ook als hij een minuut staat; rijdt hij weer
     en staat hij opnieuw stil, dan mag het weer twee keer.
  4. De tank: instappen zet de motor aan (een lage toon), harder rijden geeft een hogere toon, uitstappen zet hem uit; rijdend
     tegen een lantaarnpaal valt die om en rijdt de tank door.
  5. (16 okt, ook gevraagd) Twaalf keer snel van zender wisselen: de radio speelt daarna nog steeds een mp3 uit audio/radio/ en is
     niet als kapot gemarkeerd (een afgebroken play() telde als een kapot bestand, en dan speelde het deuntje voortaan).

 Gebruik: npm run server &  node tools/tankradiotest.mjs [poort]
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => { console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`); if (!goed) fouten++; };
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
page.setDefaultTimeout(900000);
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

const r = await page.evaluate(async () => {
  const g = window.__game, v = g.verhaal, P = g.player, uit = {};
  document.getElementById('overlay').style.display = 'none';
  P.active = true; window.__autoplay = true;
  const stap = (n, dt = 0.05) => { for (let i = 0; i < n; i++) { P.health = 100; v.update(dt); } };

  // ---- 1. de radio
  const bron = await (await fetch('/js/main.js')).text();
  uit.mainGebruikt = /radioHier\s*=\s*\(!!player\.inCar\s*&&\s*!verhaal\.geenRadio\)/.test(bron);
  uit.voor = v.geenRadio;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Period', key: '>', shiftKey: true, bubbles: true }));
  stap(4);
  uit.nm4 = { bezig: v.noMercy.bezig, geenRadio: v.geenRadio };
  // en No Mercy 5 (shift+komma)
  { const s = v.bewaar(); Object.assign(s, { missie: 'klaar', fase: 'klaar', volgende: null, uitzendingKlaar: true, noMercyKlaar: true, brugKlaar: true }); v.herstel(s); }
  stap(2);
  uit.naHerstel = v.geenRadio;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Comma', key: '<', shiftKey: true, bubbles: true }));
  stap(4);
  uit.nm5 = { bezig: v.noMercy5 && v.noMercy5.bezig, geenRadio: v.geenRadio };
  { const s = v.bewaar(); Object.assign(s, { missie: 'klaar', fase: 'klaar', volgende: null, uitzendingKlaar: true }); v.herstel(s); }
  stap(2);
  uit.daarna = v.geenRadio;

  // ---- 2. Erik in de stafauto
  const N5 = await import('/js/nomercy5.js'), AD = await import('/js/autodetail.js');
  const staf = N5.maakStafauto();
  const b = staf.userData.bestuurder;
  uit.bestuurder = !!b;
  if (b) {
    const p = b.userData.plek || b.geometry.userData.plek;
    uit.plek = p ? { hoofd: p.hoofd, heup: p.heup, zit: p.zitTop, handL: p.handL, handR: p.handR, stuur: p.stuur } : null;
    uit.erik = !!b.userData.erik;
    const car = { mesh: staf, x: 0, z: 0, yaw: 0, speed: 0, steer: 0, as: 1.2 };
    AD.spelerInAuto(car, true); AD.werkAutoBij(car, 0.05, {}); uit.derde = b.visible;
    AD.spelerInAuto(car, false); AD.werkAutoBij(car, 0.05, {}); uit.binnen = b.visible;
    const leeg = { mesh: staf, x: 0, z: 0, yaw: 0, speed: 0, steer: 0, as: 1.2 };
    staf.userData.bestuurder.visible = false;
    AD.werkAutoBij(leeg, 0.05, {}); uit.leeg = staf.userData.bestuurder.visible;
  }

  // ---- 3. toeteren
  const R = g.vehicles.regels;
  const was = { blok: R.blokkadeVoor, uit: R.uitwijkPlan, keer: R.keerHier, achter: R.iemandAchter, claxon: R.V.opClaxon };
  let toet = 0;
  const vast = { speed: 0 };
  R.blokkadeVoor = () => ({ gap: 3, c: vast, wie: 'auto' });
  R.uitwijkPlan = () => null; R.keerHier = () => false; R.iemandAchter = () => true;
  R.V.opClaxon = () => { toet++; };
  const t = { snelheid: 0, _pos: { x: 0, y: 0 }, path: null, lane: 0 };
  for (let i = 0; i < 600; i++) R.blokDoel(t, 10, 0.1);     // een minuut stilstaan
  uit.eenMinuut = toet;
  t.snelheid = 3; R.blokDoel(t, 10, 0.1); t.snelheid = 0;    // even rijden, dan weer vast
  toet = 0;
  for (let i = 0; i < 600; i++) R.blokDoel(t, 10, 0.1);
  uit.opnieuw = toet;
  Object.assign(R, { blokkadeVoor: was.blok, uitwijkPlan: was.uit, keerHier: was.keer, iemandAchter: was.achter }); R.V.opClaxon = was.claxon;

  // ---- 4. de tank
  // het geluid aan, zoals na de eerste klik in het spel (zonder start zet motorAan niets aan)
  g.geluid.start();
  const T = g.tiger, W = await import('/js/world.js'), K = await import('/js/kaartwereld.js');
  const { TIGER } = await import('/js/tiger.js');
  // een lantaarn waar de tank in een rechte lijn op af kan: 14 m aanloop zonder botsdoos of water
  let proef = null;
  for (const L of W.lampPosities) {
    if (proef) break;
    for (let k = 0; k < 16 && !proef; k++) {
      const a = k / 16 * Math.PI * 2, fx = Math.sin(a), fz = Math.cos(a);
      let vrij = true;
      for (let d = 3.5; d <= 16 && vrij; d += 0.5) {
        for (const u of [-1.7, 0, 1.7]) {
          const x = L.x + fx * d + fz * u, z = L.z + fz * d - fx * u;
          if (W.pointInWater(x, z)) { vrij = false; break; }
          const [rx, rz] = W.resolveCollisions(x, z, 0.4);
          if (Math.hypot(rx - x, rz - z) > 0.01) { vrij = false; break; }
        }
      }
      if (vrij) proef = { L, a, fx, fz };
    }
  }
  uit.lantaarnGevonden = !!proef;
  T.zetTerug();
  P.pos.set(T.plek.x + 1, 0, T.plek.z + 1);
  const s0 = T.stand;
  P.pos.set(s0.x + 2.5, 0, s0.z);
  const inGestapt = T.toets();
  uit.instap = { gelukt: inGestapt && T.actief, motor: g.geluid.motorStand ? g.geluid.motorStand() : null };
  // stil: de stationaire toon; dan gas
  for (let i = 0; i < 10; i++) T.update(0.05);
  const stilToon = g.geluid.motorStand() && g.geluid.motorStand().toon;
  P.keys = { KeyW: true };
  for (let i = 0; i < 80; i++) T.update(0.05);
  const gasToon = g.geluid.motorStand() && g.geluid.motorStand().toon;
  P.keys = {};
  const { motorToon } = await import('/js/audio.js');
  uit.toon = { stil: stilToon && +stilToon.f1.toFixed(1), gas: gasToon && +gasToon.f1.toFixed(1), auto: +motorToon({ toeren: 850 }).f1.toFixed(1) };
  if (proef) {
    const { L, fx, fz, a } = proef;
    // de tank 14 m voor de paal, met de neus ernaartoe (vooruit is (−sin yaw, −cos yaw))
    T.toets();                                                   // eerst uit
    T.__zet(L.x + fx * 14, L.z + fz * 14, a);
    P.pos.set(L.x + fx * 14 + 2.5, 0, L.z + fz * 14);
    T.toets();
    const om0 = K.lantaarnsOm();
    P.keys = { KeyW: true };
    let voorbij = false;
    let maxToon = 0, vMax = 0;
    for (let i = 0; i < 400; i++) {
      T.update(0.05);
      const st = T.stand;
      const ms = g.geluid.motorStand(); if (ms && ms.toon) maxToon = Math.max(maxToon, ms.toon.f1);
      vMax = Math.max(vMax, Math.abs(st.v));
      // voorbij de paal: de tank ligt aan de andere kant van de plek waar hij stond
      if ((st.x - L.x) * fx + (st.z - L.z) * fz < -2) { voorbij = true; break; }
    }
    P.keys = {};
    uit.lantaarn = { om: K.lantaarnsOm() - om0, voorbij, telt: T.stand.lantaarns || 0 };
    uit.toon.gas = +maxToon.toFixed(1); uit.toon.vMax = +vMax.toFixed(1);
  }
  T.toets();
  uit.uit = { actief: T.actief, motor: g.geluid.motorStand ? g.geluid.motorStand() : null };

  // ---- 5. snel van zender wisselen (16 okt): de mp3's blijven, geen terugval op het deuntje
  const { geluid } = await import('/js/audio.js');
  const slaap = (ms) => new Promise(r => setTimeout(r, ms));
  geluid.start();
  await geluid.laadRadio();
  geluid.autoradio(true);
  await slaap(1200); geluid.autoradio(true);
  const radioVoor = geluid.radioStand();
  const zenders = geluid.radioZenders().length;
  for (let i = 0; i < 12; i++) { geluid.zenderWissel(1); geluid.autoradio(true); await slaap(40); }
  for (let i = 0; i < 20; i++) { geluid.autoradio(true); await slaap(100); }
  const radioNa = geluid.radioStand();
  geluid.autoradio(false);
  uit.radio = { zenders, voor: { stuk: radioVoor.stuk, bron: radioVoor.bron }, na: { stuk: radioNa.stuk, bron: radioNa.bron, speelt: radioNa.speelt, zender: radioNa.zender } };
  return uit;
});

kop('1. de radio tijdens No Mercy');
ok(r.mainGebruikt, 'js/main.js zet de autoradio uit met verhaal.geenRadio');
ok(!r.voor && r.nm4.bezig && r.nm4.geenRadio, 'No Mercy 4: geen autoradio', JSON.stringify(r.nm4));
ok(r.nm5.bezig && r.nm5.geenRadio, 'No Mercy 5: geen autoradio', JSON.stringify(r.nm5));
ok(!r.naHerstel && !r.daarna, 'daarbuiten wel', JSON.stringify({ voor: r.voor, naHerstel: r.naHerstel, daarna: r.daarna }));

kop('2. Erik in de stafauto');
const p = r.plek;
ok(r.bestuurder && r.erik && !!p, 'de stafauto heeft een bestuurder: Erik');
if (p) {
  ok(Math.abs(p.heup.y - p.zit) < 0.12 && Math.abs(p.zit - 0.615) < 0.03, 'de billen op de zitting van de linker voorstoel', `heup ${p.heup.y.toFixed(2)}, zitting ${p.zit.toFixed(2)}`);
  ok(Math.abs(p.hoofd.x + 0.36) < 0.05 && p.hoofd.y > 1.15 && p.hoofd.y < 1.4, 'het hoofd links op ooghoogte', `(${p.hoofd.x.toFixed(2)}, ${p.hoofd.y.toFixed(2)}, ${p.hoofd.z.toFixed(2)})`);
  const dL = Math.hypot(p.handL.x + 0.36 - 0, p.handL.y - 1.02, p.handL.z + 0.42), dR = Math.hypot(p.handR.x + 0.36, p.handR.y - 1.02, p.handR.z + 0.42);
  ok(dL < 0.3 && dR < 0.3, 'de handen bij het stuur', `${dL.toFixed(2)} en ${dR.toFixed(2)} m van het midden van het stuur`);
}
ok(r.derde && !r.binnen && !r.leeg, 'van buiten te zien, van binnen niet, en zonder speler niet', JSON.stringify({ derde: r.derde, binnen: r.binnen, leeg: r.leeg }));

kop('3. toeteren');
ok(r.eenMinuut <= 2 && r.eenMinuut >= 1, 'een minuut vast achter een auto: hoogstens twee keer toeteren', `${r.eenMinuut} keer`);
ok(r.opnieuw <= 2 && r.opnieuw >= 1, 'weer gereden en opnieuw vast: weer hoogstens twee keer', `${r.opnieuw} keer`);

kop('4. de tank');
ok(r.instap.gelukt && !!r.instap.motor, 'instappen zet de motor aan', JSON.stringify(r.instap));
ok(r.toon.stil && r.toon.gas && r.toon.gas > r.toon.stil && r.toon.stil < r.toon.auto * 0.85, 'een lage toon stil (lager dan een stationaire auto), hoger met gas', JSON.stringify(r.toon));
ok(r.lantaarnGevonden, 'een lantaarnpaal met vrije aanloop gevonden');
if (r.lantaarn) ok(r.lantaarn.om >= 1 && r.lantaarn.voorbij, 'tegen een lantaarnpaal: hij valt om en de tank rijdt door', JSON.stringify(r.lantaarn));
ok(!r.uit.actief && !r.uit.motor, 'uitstappen zet de motor uit', JSON.stringify(r.uit));

kop('5. snel van zender wisselen');
const rd = r.radio;
ok(rd.zenders >= 2 && !rd.voor.stuk && /\.mp3$/.test(rd.voor.bron || ''), 'de autoradio speelt een mp3 uit audio/radio/', JSON.stringify(rd.voor));
ok(!rd.na.stuk && /\.mp3$/.test(rd.na.bron || ''), 'twaalf keer snel gewisseld: nog steeds een mp3, niet terug naar het deuntje', JSON.stringify(rd.na));

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);
