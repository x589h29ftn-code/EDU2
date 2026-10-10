/*
 Stap 129: de derde ronde wensen van 10 okt 2026, nagemeten.

   node tools/server.mjs 8123 &   node tools/wensen3test.mjs [poort]   (npm run wensen3test)

 1. Spelen in volledig scherm: een keuze in de instellingen die blijft.
 2. Kali uit het radiootje van missie 1: aan vanaf het gesprek met Mark, na de schietpartij nog even, dan weg;
    aanzwellen en wegsterven; ook op Radio Tinga.
 3. Missie 18: gele ringen onder de schutters langs de weg, Wiebe zegt het, Mark en Johan schieten uit de auto.
 4. De Ferrari: wendbaarder op hoge snelheid en harder remmen.
 5. Meer auto's in de wijk overdag.
 6. De ambulancebroeders zijn te raken.
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fouten++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);
const r1 = (n) => (n == null || !isFinite(n)) ? String(n) : n.toFixed(1);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  const W = await import('/js/world.js');
  const { KAART } = await import('/js/kaartwereld.js');
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, v = g.verhaal;
  g.player.active = false;
  window.__autoplay = false;
  window.__W = W; window.__K = KAART;
  window.__meld = [];
  const echt = g.hud.melding.bind(g.hud);
  g.hud.melding = (k, o, t) => { window.__meld.push(`${k}|${o}`); return echt(k, o, t); };
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) { g.player.health = 100; v.update(dt); } };
  window.__klik = (max = 80) => { for (let i = 0; i < max && !document.getElementById('dialoog').hidden; i++) { v.toets(); window.__stap(1); } };
  window.__tot = (fase, maxS = 20, dt = 0.05) => {
    for (let t = 0; t < maxS && v.fase !== fase; t += dt) { window.__stap(1, dt); if (!document.getElementById('dialoog').hidden) v.toets(); }
    return v.fase === fase;
  };
  window.__na17 = () => {
    const s = v.bewaar(); s.missie = 'klaar'; s.fase = 'klaar'; s.volgende = null;
    Object.assign(s, { schaduwKlaar: true, raceKlaar: true, brugKlaar: true, schriftKlaar: true, invalKlaar: true, invalKeus: 2,
      invalTelefoon: true, ronaldKlaar: true, ronaldPraatte: true, uitzendingKlaar: false, huisGekozen: s.huisGekozen || 'Koningsspil 20' });
    g.politie.reset();
    v.herstel(s);
  };
  // missie 18 op een fase hervatten (zoals het laden en het neergaan dat doen)
  window.__bij = (fase) => {
    if (v.missie !== 'uitzending') { window.__na17(); v.startMissie('uitzending'); window.__stap(2); }
    const s = v.bewaar(); s.missie = 'uitzending'; s.fase = fase;
    g.politie.reset();
    v.herstel(s);
    window.__stap(2);
  };
});

// ------------------------------------------------------------------ 1. volledig scherm
kop('spelen in volledig scherm');
const vs = await page.evaluate(() => {
  try { localStorage.removeItem('tinga.volledig'); } catch { /* */ }
  document.getElementById('overlay').style.display = 'flex';
  document.getElementById('menuInstellingen').click();
  const zoek = () => document.getElementById('instel_volledig');
  const uit = { naam: zoek() && zoek().closest('*') ? document.querySelector('.menuzij').textContent : '', voor: zoek() && zoek().textContent };
  zoek().click(); uit.na1 = localStorage.getItem('tinga.volledig'); uit.tekst1 = zoek().textContent;
  zoek().click(); uit.na2 = localStorage.getItem('tinga.volledig');
  document.getElementById('overlay').style.display = 'none';
  return uit;
});
ok(/volledig scherm/i.test(vs.naam), 'de instelling "Spelen in volledig scherm"');
ok(vs.voor === 'uit' && vs.na1 === '1' && vs.tekst1 === 'aan' && vs.na2 === '0', 'aan en uit, en hij onthoudt het', JSON.stringify(vs).slice(0, 120));
const bron = await page.evaluate(() => fetch('/js/main.js').then(r => r.text()));
ok((bron.match(/if \(volledigVoorkeur\(\)\) zetVolledig\(true\)/g) || []).length >= 2, 'bij Start spel en Doorgaan gaat het scherm dan vanzelf vol');

// ------------------------------------------------------------------ 2. Kali
kop('Kali uit het radiootje van missie 1');
const ka = await page.evaluate(async () => {
  const g = window.__game, v = g.verhaal, P = g.player, A = await import('/js/audio.js');
  const uit = { klaar: v.kaliRadio };
  v.__startMissie('molenkrite');
  window.__stap(2);
  uit.wacht = !!v.kaliRadio;
  const M = v.mark.groep.position;
  P.pos.set(M.x + 1, P.pos.y, M.z + 1);
  v.toets(); window.__stap(1);
  uit.fase = v.fase; uit.gesprek = v.kaliRadio ? { x: v.kaliRadio.x, z: v.kaliRadio.z } : null;
  // het geluid: aan, vooraan, aanzwellen
  g.geluid.start();
  g.geluid.kali(8);
  uit.stand = g.geluid.kaliStand();
  uit.KALI = A.KALI;
  // de schietpartij: iedereen neer
  const s = v.bewaar(); s.missie = 'molenkrite'; s.fase = 'opdracht'; s.volgende = null;
  g.politie.reset(); v.herstel(s); window.__stap(2);
  uit.opdracht = !!v.kaliRadio;
  for (let k = 0; k < 12 && v.fase === 'opdracht'; k++) {
    for (const o of v.doelen()) { v.raak(o, 99); window.__stap(1); }
    window.__stap(2);
  }
  uit.naFase = v.fase;
  uit.direct = !!v.kaliRadio;
  window.__stap(60, 0.05);    // drie tellen
  uit.na3 = !!v.kaliRadio;
  window.__stap(120, 0.05);   // nog zes
  uit.na9 = !!v.kaliRadio;
  g.geluid.kali(null);
  uit.uit = g.geluid.kaliStand();
  window.__klik(200);
  const z = await fetch('/audio/radio/zenders.json').then(r => r.json());
  uit.tinga = z.zenders.find(q => q.naam === 'Radio Tinga').nummers.map(n => n.bestand);
  uit.bestand = (await fetch('/audio/radio/kali.mp3', { method: 'HEAD' })).status;
  return uit;
});
ok(ka.klaar === null && !ka.wacht, 'buiten missie 1 en vóór het gesprek zwijgt het radiootje');
ok(ka.fase === 'gesprek' && ka.gesprek, 'vanaf het gesprek met Mark speelt Kali', ka.fase);
ok(ka.stand && ka.stand.aan && ka.stand.keer === 1 && !ka.stand.stuk, 'het nummer gaat aan, vooraan', JSON.stringify(ka.stand));
ok(ka.KALI.in > 1 && ka.KALI.uit > 2 && ka.KALI.ver >= 40, 'aanzwellen, wegsterven, en luider naarmate je dichterbij staat', `in ${ka.KALI.in} s, uit ${ka.KALI.uit} s, hoorbaar tot ${ka.KALI.ver} m`);
ok(ka.opdracht && ka.naFase === 'briefing' && ka.direct && ka.na3 && !ka.na9, 'na de schietpartij nog even, dan weg', `${ka.naFase}: direct ${ka.direct}, na 3 s ${ka.na3}, na 9 s ${ka.na9}`);
ok(ka.uit && !ka.uit.aan, 'en dan sterft hij weg', JSON.stringify(ka.uit));
ok(ka.tinga.includes('kali.mp3') && ka.bestand === 200, 'Kali staat ook op Radio Tinga', ka.tinga.join(', '));

// ------------------------------------------------------------------ 3. missie 18
kop('missie 18');
const hl = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  window.__bij('heli');
  window.__tot('heli', 12);
  const G = v.avond.grondvuur;
  const uit = { ringen: G.mannen.filter(m => m.ring && m.ring.visible && m.ring.material.color.getHexString() === 'ffd21a').length, n: G.mannen.length };
  const zinnen = [];
  for (let t = 0; t < 60 && G.schoten < 2; t += 0.05) {
    v.update(0.05); P.health = 100;
    if (!document.getElementById('dialoog').hidden) zinnen.push(document.getElementById('dialoogTekst').textContent);
  }
  for (let i = 0; i < 20; i++) { v.update(0.05); if (!document.getElementById('dialoog').hidden) zinnen.push(document.getElementById('dialoogTekst').textContent); }
  uit.wiebe = zinnen.some(z => /gele kringen/.test(z));
  const m = G.mannen[0];
  v.raak(m.p.groep.children[0], 1);
  uit.ringWeg = !m.ring.visible;
  return uit;
});
ok(hl.n >= 5 && hl.ringen === hl.n, 'een gele ring onder elke schutter langs de weg', `${hl.ringen} van ${hl.n}`);
ok(hl.wiebe, 'Wiebe zegt dat ze vanaf de weg schieten');
ok(hl.ringWeg, 'neer: de ring gaat weg');
const rh = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player, W = window.__W;
  window.__bij('naarAuto'); window.__klik();
  const a = v.avond; P.inCar = a.auto; window.__stap(2);
  const fase = v.fase;
  const H = v.avond.handlangers, G = v.avond.grondvuur;
  let strepen = 0;
  const hp0 = H.mannen.reduce((s, m) => s + Math.max(0, m.auto.hp), 0);
  for (let i = 0; i < 400; i++) {
    const B = v.avond.B;
    const ach = H.mannen.length ? Math.min(...H.mannen.map(m => m.s)) : 0;
    const k = Math.min(B.n - 1, Math.max(0, Math.round((ach - 20) / 2)));
    a.auto.x = B.x[k]; a.auto.z = B.z[k]; a.auto.yaw = Math.atan2(-B.tx[k], -B.tz[k]); a.auto.speed = v.avond.rit ? v.avond.rit.v : 10;
    if (a.auto.mesh) { a.auto.mesh.position.set(B.x[k], W.grondHoogte(B.x[k], B.z[k]), B.z[k]); a.auto.mesh.rotation.y = a.auto.yaw; }
    P.health = 100; window.__stap(1);
    strepen = Math.max(strepen, G.strepen);
    if (v.fase !== 'achtervolging') break;
  }
  const hp1 = H.mannen.reduce((s, m) => s + Math.max(0, m.auto.hp), 0);
  return { fase, strepen, hp0, hp1, neer: H.mannen.filter(m => m.dood).length };
});
ok(rh.fase === 'achtervolging', 'de achtervolging', rh.fase);
ok(rh.strepen >= 1 && rh.hp1 < rh.hp0, 'Mark en Johan schieten uit de rijdende auto op de handlangers', `${rh.strepen} strepen; hp ${rh.hp0} → ${rh.hp1}, ${rh.neer} neer`);
const hulp = await page.evaluate(async () => (await fetch('/js/verhaal.js').then(r => r.text())).match(/const AVOND_HULP = \[([\d.]+), ([\d.]+)\]/).slice(1).map(Number));
ok(hulp[1] <= 5, 'bij de loods schieten ze vaker', `om de ${hulp[0]}–${hulp[1]} s (was 5,5–8)`);

// ------------------------------------------------------------------ 4. de Ferrari
kop('de Ferrari');
const fe = await page.evaluate(() => {
  const g = window.__game, V = g.vehicles;
  const proef = (oud) => {
    const c = V.voegToe({ x: -9000, z: -9000 - (oud ? 80 : 0), yaw: 0, soort: 'ferrari', kleur: 0xc81e1e, driveable: true });
    if (oud) { c.grip = 50; c.remKracht = 15; c.stuurOpbouw = 1; }
    c.speed = 60; c.steer = 0;
    const y0 = c.yaw;
    for (let i = 0; i < 30; i++) V.drive(c, { KeyA: true, KeyW: true }, 1 / 30);
    const draai = Math.abs(c.yaw - y0);
    c.speed = 50; c.steer = 0;
    for (let i = 0; i < 45; i++) V.drive(c, { KeyS: true }, 1 / 30);
    const rem = 50 - c.speed;
    V.verwijder(c);
    return { draai, rem };
  };
  return { nieuw: proef(false), oud: proef(true) };
});
ok(fe.nieuw.draai > fe.oud.draai * 1.2, 'op 216 km/u een seconde sturen: wendbaarder', `${fe.oud.draai.toFixed(2)} → ${fe.nieuw.draai.toFixed(2)} rad`);
ok(fe.nieuw.rem > fe.oud.rem * 1.4, 'anderhalve seconde remmen: harder', `${r1(fe.oud.rem * 3.6)} → ${r1(fe.nieuw.rem * 3.6)} km/u eraf`);

// ------------------------------------------------------------------ 5. verkeer
kop('verkeer');
const vk = await page.evaluate(() => ({ lokaal: window.__game.vehicles.traffic.filter(t => t.lokaal).length }));
ok(vk.lokaal >= 18, 'meer auto\'s in de wijk', `${vk.lokaal} (was 12)`);

// ------------------------------------------------------------------ 6. de ambulance
kop('de ambulancebroeders');
const am = await page.evaluate(() => {
  const A = window.__game.ambulance;
  if (!A) return { geen: true };
  const p = A.bemanning[0];
  A.st.fase = 'helpt'; A.st.doel = { x: p.groep.position.x, z: p.groep.position.z };
  for (const q of A.bemanning) q.groep.visible = true;
  const voor = A.doelen().length;
  let mesh = null; p.groep.traverse(o => { if (!mesh && o.isMesh) mesh = o; });
  const r = A.raak(mesh);
  const na = A.doelen().length;
  for (let i = 0; i < 20; i++) A.update(0.05, { x: 0, z: 0 }, () => true);
  const uit = { voor, raak: !!r, na, neer: p.neer, fase: A.fase, zichtbaar: p.groep.visible };
  A.verstop();
  uit.opgeruimd = !p.neer;
  return uit;
});
ok(!am.geen && am.voor === 2 && am.raak && am.neer && am.zichtbaar, 'een broeder is te raken en blijft liggen', JSON.stringify(am));
ok(am.na === 0, 'wie ligt is geen doel meer, en zijn collega zit weer in de ambulance', `${am.na} doelen`);
ok(am.fase === 'terug', 'de ambulance vertrekt dan zonder te helpen', am.fase);
ok(am.opgeruimd, 'uit beeld wordt hij weer opgeruimd');
const mainBron = await page.evaluate(() => fetch('/js/main.js').then(r => r.text()));
ok((mainBron.match(/ambulance \? ambulance\.doelen\(\)/g) || []).length >= 2 && /ambulance && ambulance\.raak\(h\.object\)/.test(mainBron), 'de kogel en het mes kennen de broeders');

console.log(fouten ? `\n${fouten} fout(en)` : '\nAlles goed.');
console.log('EINDE');
await browser.close();
process.exit(fouten ? 1 : 0);
