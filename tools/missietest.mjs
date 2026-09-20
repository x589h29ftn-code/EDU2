/*
 De ronde van 20 september 2026 (derde lijst): alles wat met de missies te maken
 heeft.

   node tools/server.mjs 8123 &   node tools/missietest.mjs [poort]

 Zes punten:

 1. Je kunt je eigen auto (en de vrachtwagen van de missie) niet van binnenuit
    stukschieten — een andere auto wél, anders bewijst het niets.
 2. Mark begint uit zichzelf te praten als het spel begint.
 3. Bij de waterzuivering stap je uit in de eerste persoon, ook als je met de
    camera over je schouder reed.
 4. Na het afleveren van de vrachtwagen ben je de politie eenmalig kwijt.
 5. De spanningsmuziek (audio/missie/) speelt van het instappen tot even na
    MISSION COMPLETED, en verder nergens; hij begint elke keer op een andere
    plek in het nummer en zwelt aan in plaats van in te vallen.
 6. De autoradio zakt weg zolang die muziek speelt.
 7. Sta je voor de neus van een auto, dan claxonneert de bestuurder — maar pas
    na een paar seconden, en niet aan één stuk door.

 Let op de server: gebruik tools/server.mjs. `python3 -m http.server` kent geen
 Range-verzoeken, en dan kan de browser niet in een bestand van drie kwartier
 springen — het "willekeurige fragment" begint dan altijd bij nul.
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
  // zonder deze vlag speelt de browser geen muziek af zonder klik; in het spel
  // zelf heb je die klik gegeven op het startscherm
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });
await page.evaluate(async () => {
  const { geluid } = await import('/js/audio.js');
  localStorage.removeItem('tinga.spel.v1');
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  window.__game.player.active = true;
  geluid.start();
  await geluid.laadMissieMuziek();
  await geluid.laadRadio();              // de radio moet er zijn om te kunnen wegzakken
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) window.__game.verhaal.update(dt); };
});

// ------------------------------------------------ het bestand met de muziek
kop('de spanningsmuziek in audio/missie/');
const bestand = await page.evaluate(async () => {
  const r = await fetch('audio/missie/nummers.json');
  const j = await r.json();
  const uit = [];
  for (const n of j.nummers || []) {
    const h = await fetch('audio/missie/' + n.bestand, { method: 'HEAD' });
    uit.push({ ...n, ok: h.ok, mb: +(Number(h.headers.get('content-length') || 0) / 1048576).toFixed(1),
      range: h.headers.get('accept-ranges') });
  }
  return uit;
});
ok(bestand.length > 0, 'er staat muziek in audio/missie/', `${bestand.length} nummer(s)`);
ok(bestand.every(n => n.ok), 'en elk bestand uit de lijst bestaat ook echt',
  bestand.map(n => `${n.bestand} ${n.mb} MB`).join(', '));
ok(bestand.every(n => n.range === 'bytes'), 'de server kan erin springen (Range)',
  bestand.map(n => n.range).join(','));

// --------------------------------------------- willekeurig fragment en fade
kop('elke keer een ander fragment');
const fragment = await page.evaluate(async () => {
  const { geluid } = await import('/js/audio.js');
  const wacht = (ms) => new Promise(r => setTimeout(r, ms));
  const plekken = [];
  let aanzwellen = null, stil = null;
  for (let k = 0; k < 3; k++) {
    geluid.missiemuziek(true);
    await wacht(1400);
    const s = geluid.missieStand();
    if (k === 0) aanzwellen = s.volume;
    plekken.push(s.tijd);
    // uitzetten en de fade afwachten
    geluid.missiemuziek(false);
    for (let i = 0; i < 40; i++) { geluid.missiemuziek(false); await wacht(90); }
    stil = geluid.missieStand();
  }
  return { plekken, aanzwellen, stil, duur: geluid.missieStand().duur };
});
ok(fragment.plekken.every(t => t > 0), 'de muziek loopt als hij aanstaat',
  fragment.plekken.map(t => `${t}s`).join(' · '));
ok(new Set(fragment.plekken.map(t => Math.round(t / 30))).size >= 2,
  'en hij begint niet elke keer op dezelfde plek in het nummer',
  `${fragment.plekken.map(t => Math.round(t)).join('s, ')}s van ${fragment.duur}s`);
ok(fragment.aanzwellen > 0.02 && fragment.aanzwellen < 0.30,
  'hij zwelt aan en valt niet met volle kracht in', `na 1,4 s op ${fragment.aanzwellen}`);
ok(fragment.stil && !fragment.stil.speelt && fragment.stil.volume < 0.01,
  'en na het uitfaden staat hij stil', `volume ${fragment.stil.volume}, speelt ${fragment.stil.speelt}`);

// ------------------------------------------------------- Mark begint zelf
kop('Mark begint zelf te praten');
const praat = await page.evaluate(() => {
  const g = window.__game;
  const voor = { fase: g.verhaal.fase, balk: !document.getElementById('dialoog').hidden };
  g.verhaal.beginGesprek(0.1);
  window.__stap(10);                     // een halve seconde
  return {
    voor, fase: g.verhaal.fase,
    naam: document.getElementById('dialoogNaam').textContent,
    tekst: document.getElementById('dialoogTekst').textContent,
  };
});
ok(praat.voor.fase === 'wacht' && !praat.voor.balk, 'het spel begint met Mark die staat te wachten');
ok(praat.fase === 'gesprek', 'zonder dat er een toets aan te pas komt begint hij te praten', praat.fase);
ok(/Erik, kom met mij mee/.test(praat.tekst), 'en het is zijn eerste regel',
  `${praat.naam}: ${praat.tekst.slice(0, 40)}`);

// ------------------------------------------------ door naar missie 'rijden'
kop('naar de auto');
await page.keyboard.press('KeyE');       // regel 2
await page.keyboard.press('KeyE');       // gesprek uit, Mark loopt
await page.evaluate(() => {
  const g = window.__game;
  for (let i = 0; i < 2000 && g.verhaal.fase === 'loopt'; i++) {
    g.verhaal.update(0.05);
    const p = g.verhaal.mark.groep.position;
    g.player.pos.set(p.x + 2.2, 0, p.z + 2.2);
  }
  window.__stap(80);
});
await page.keyboard.press('KeyE');       // "Schiet ze neer!" wegklikken
await page.evaluate(() => {
  const g = window.__game;
  for (const o of [...g.verhaal.doelen()]) g.verhaal.raak(o);
  window.__stap(40);
});
for (let i = 0; i < 3; i++) await page.keyboard.press('KeyE');   // de briefing
const rijklaar = await page.evaluate(async () => {
  const { geluid } = await import('/js/audio.js');
  const g = window.__game;
  window.__stap(200);                    // Mark loopt naar de auto
  return { missie: g.verhaal.missie, fase: g.verhaal.fase, auto: !!g.verhaal.auto,
    muziek: geluid.missieStand() };
});
ok(rijklaar.missie === 'rijden' && rijklaar.auto, `missie 'rijden', er staat een auto`,
  `${rijklaar.missie}/${rijklaar.fase}`);
ok(!rijklaar.muziek.aan, 'naast de auto speelt er nog geen missiemuziek',
  `aan: ${rijklaar.muziek.aan}`);

// ------------------------------------------------- instappen: muziek en radio
kop('instappen');
const instap = await page.evaluate(async () => {
  const { geluid } = await import('/js/audio.js');
  const g = window.__game;
  const auto = g.verhaal.auto;
  g.player.pos.set(auto.x + 1.2, 0, auto.z + 1.2);
  g.praat();                             // E: instappen
  const inAuto = g.player.inCar === auto;
  window.__stap(10);
  // de radio doet in de auto zijn werk; hij wordt elk beeld aangeroepen
  for (let i = 0; i < 25; i++) { geluid.autoradio(true); await new Promise(r => setTimeout(r, 90)); }
  return { inAuto, muziek: geluid.missieStand(), stand: geluid.stand(), radio: geluid.radioStand() };
});
ok(instap.inAuto, 'met E stap je in de auto');
ok(instap.muziek.aan && instap.muziek.speelt, 'en de muziek zet in',
  `${instap.muziek.bron} op ${instap.muziek.tijd}s, volume ${instap.muziek.volume}`);
ok(instap.stand.muziek != null && instap.stand.muziek <= 0.12 && instap.stand.missie > instap.stand.muziek,
  'de autoradio zakt eronder weg', `radio op ${instap.stand.muziek}, missie op ${instap.stand.missie}`);

// --------------------------------------- niet op je eigen auto kunnen schieten
kop('van binnenuit schieten');
const eigen = await page.evaluate(async () => {
  const THREE = await import('three');
  const g = window.__game;
  const auto = g.player.inCar;
  const p = g.player;
  p.reserve = 500; p.krijgWapen('mitrailleur'); p.ammo = 60; p.reloading = 0;
  /*
   Precies dezelfde kogels, twee keer: één keer terwijl je in de auto zit en één
   keer terwijl je er niet in zit. Alleen dát verschil mag tellen — schoten van
   een andere plek af zeggen niets, want dan kan er ook iemand tussen staan.
  */
  /*
   Eerst door je eigen ogen kijken. In een auto staat de camera standaard achter
   de auto, en dan komt de kogel uit de schouder van je poppetje (derde.mikpunt)
   in plaats van uit het punt dat we hieronder meegeven — dan meet je iets
   anders dan je denkt.
  */
  if (g.derde.aan) g.wisselCamera();
  const vx = -Math.sin(auto.yaw), vz = -Math.cos(auto.yaw);      // de neus van de auto
  const salvo = () => {
    // recht over de motorkap, met een beetje omlaag: precies de kogels die
    // eerder hun eigen blik raakten
    for (const helling of [-0.05, -0.15, -0.3, -0.45]) {
      const van = new THREE.Vector3(auto.x, 1.2, auto.z);
      const naar = new THREE.Vector3(vx, helling, vz).normalize();
      p.shootCb(van, naar);
    }
  };
  await new Promise(r => requestAnimationFrame(r));     // matrices bij de tijd
  const hpVoor = auto.hp;
  salvo();                                  // vanuit de stoel
  const hpNa = auto.hp;
  g.player.inCar = null;
  salvo();                                  // dezelfde kogels, maar nu niet van jou
  const hpBuiten = auto.hp;
  g.player.inCar = auto;
  return { hpVoor, hpNa, hpBuiten };
});
ok(eigen.hpNa === eigen.hpVoor, 'van binnenuit raak je je eigen auto niet',
  `hp ${eigen.hpVoor} → ${eigen.hpNa}`);
ok(eigen.hpBuiten < eigen.hpVoor, 'dezelfde kogels raken hem wél als je er niet in zit (de proef klopt)',
  `hp ${eigen.hpNa} → ${eigen.hpBuiten}`);

// --------------------------------------------- aankomen bij de waterzuivering
kop('aankomen bij de waterzuivering');
const aankomst = await page.evaluate(() => {
  const g = window.__game;
  const auto = g.player.inCar;
  // met de camera over je schouder rijden
  if (!g.derde.aan) g.wisselCamera();
  const derdeTijdensRit = g.derde.aan;
  const nav = g.hud.nav;
  const punt = nav.route[Math.max(0, nav.route.length - 4)];
  auto.x = punt[0]; auto.z = punt[1]; auto.speed = 4;
  window.__stap(40);
  return {
    derdeTijdensRit, derdeNa: g.derde.aan, uitgestapt: g.player.inCar === null,
    fase: g.verhaal.fase,
  };
});
ok(aankomst.derdeTijdensRit, 'je rijdt met de camera over je schouder');
ok(aankomst.uitgestapt && aankomst.fase === 'aangekomen', 'bij het terrein stap je automatisch uit',
  aankomst.fase);
ok(aankomst.derdeNa === false, 'en dat gebeurt in de eerste persoon',
  `derde persoon: ${aankomst.derdeNa}`);

// -------------------------------------------- de bewaking en het afleveren
kop('de bewaking en de vrachtwagen');
await page.keyboard.press('KeyE');
const bewaking = await page.evaluate(async () => {
  const { geluid } = await import('/js/audio.js');
  const g = window.__game;
  window.__stap(20);
  const tijdensBewaking = geluid.missieStand();
  g.player.health = 100;
  for (const o of [...g.verhaal.bewaking.doelen()]) g.verhaal.raak(o);
  window.__stap(40);
  return { missie: g.verhaal.missie, neer: g.verhaal.bewaking.neer, muziek: tijdensBewaking };
});
ok(bewaking.neer === 5, 'de vijf bewakers liggen neer', `${bewaking.neer} neer`);
ok(bewaking.muziek.aan, 'de muziek loopt door op het terrein', `aan: ${bewaking.muziek.aan}`);

await page.keyboard.press('KeyE');
const afgeleverd = await page.evaluate(async () => {
  const { geluid } = await import('/js/audio.js');
  const g = window.__game;
  window.__stap(20);
  const truck = g.verhaal.truck, schuur = g.verhaal.plekken.schuur;
  // de politie op je dak zetten: vier sterren, precies wat je na zo'n rit hebt
  for (let i = 0; i < 6; i++) g.politie.misdaad('agent', g.player.pos.x, g.player.pos.z);
  const sterrenVoor = g.politie.ster;
  // en de vrachtwagen bij de schuur zetten
  truck.x = schuur.x + 14; truck.z = schuur.z + 8; truck.speed = 0;
  truck.mesh.position.set(truck.x, 0, truck.z);
  g.player.pos.set(truck.x, 0, truck.z);
  window.__stap(20);
  const muziekBijMelding = geluid.missieStand();
  const sterrenNa = g.politie.ster;
  const fase = g.verhaal.fase;
  const melding = document.getElementById('missie').textContent;
  /*
   De muziek loopt zes seconden door en dooft dan uit. Hier telt de echte klok en
   niet het aantal beeldjes: de fade hangt aan de AudioContext. Dus het verhaal
   in stapjes van 60 ms bijwerken, precies zo snel als de klok loopt.
  */
  for (let i = 0; i < 200; i++) { g.verhaal.update(0.06); await new Promise(r => setTimeout(r, 60)); }
  return { fase, melding, sterrenVoor, sterrenNa, muziekBijMelding, muziekNa: geluid.missieStand() };
});
ok(afgeleverd.fase === 'klaar' && /MISSION COMPLETED/.test(afgeleverd.melding),
  'de vrachtwagen staat bij de boerderij', afgeleverd.melding.slice(0, 30));
ok(afgeleverd.sterrenVoor >= 3, `je had ${afgeleverd.sterrenVoor} sterren op je dak`);
ok(afgeleverd.sterrenNa === 0, 'en die ben je na de missie eenmalig kwijt',
  `${afgeleverd.sterrenVoor} → ${afgeleverd.sterrenNa}`);
ok(afgeleverd.muziekBijMelding.aan, 'de muziek loopt over MISSION COMPLETED heen');
ok(!afgeleverd.muziekNa.aan && afgeleverd.muziekNa.volume < 0.01,
  'en daarna dooft hij uit', `volume ${afgeleverd.muziekNa.volume}, speelt ${afgeleverd.muziekNa.speelt}`);

// ------------------------------------------------- voor de neus van een auto
kop('voor de auto staan');
const claxon = await page.evaluate(() => {
  const g = window.__game;
  const V = g.vehicles;
  const echt = V.opClaxon;
  let klok = 0;
  const tijden = [];
  V.opClaxon = () => tijden.push(+klok.toFixed(2));
  const dt = 0.05;
  // één keer bijwerken, zodat elke auto zijn plek en richting van dit beeld heeft
  V.updateTraffic(dt, g.player, null, g.player.pos.x, g.player.pos.z);
  g.player.inCar = null;
  const rondes = [];
  for (let n = 0; n < 5 && n < V.traffic.length; n++) {
    const t = V.traffic[n];
    if (!t || !t._pos) continue;
    t.blokSpeler = 0; t.claxonRust = 0; t.claxonNa = null;
    tijden.length = 0; klok = 0;
    // vijftien seconden pal voor zijn neus blijven staan
    for (let i = 0; i < 300; i++) {
      g.player.pos.set(t._pos.x + t._dir.x * 3, 0, t._pos.y + t._dir.y * 3);
      t.snelheid = 0; t.doel = 0;                 // hij staat stil, want jij staat er
      V.updateTraffic(dt, g.player, null, g.player.pos.x, g.player.pos.z);
      klok += dt;
    }
    rondes.push({ eerste: tijden.length ? tijden[0] : null, aantal: tijden.length });
  }
  V.opClaxon = echt;
  return rondes;
});
const metClaxon = claxon.filter(r => r.eerste != null);
ok(claxon.length >= 3, `vijf auto's waar je voor gaat staan`, `${claxon.length} gemeten`);
ok(metClaxon.length >= Math.ceil(claxon.length / 2), 'de meeste bestuurders claxonneren',
  `${metClaxon.length} van de ${claxon.length}`);
ok(metClaxon.every(r => r.eerste >= 1.5), 'maar nooit meteen',
  metClaxon.map(r => `${r.eerste}s`).join(', ') || 'geen enkele');
ok(metClaxon.every(r => r.aantal <= 4), 'en ze blijven er niet op staan',
  metClaxon.map(r => `${r.aantal}×`).join(', ') || '-');

console.log(`\n${fout ? fout + ' fout' : 'alles goed'}`);
await browser.close();
process.exit(fout ? 1 : 0);
