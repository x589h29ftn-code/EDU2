/*
 Stap 130: de vierde ronde wensen van 10 okt 2026, nagemeten.

   node tools/server.mjs 8123 &   node tools/wensen4test.mjs [poort]   (npm run wensen4test)

 1. Missiemuziek 2: twee nummers, nooit twee keer achter elkaar hetzelfde; een schuif voor het volume.
 2. Ren Lenny Ren op Radio Tinga, en de zender 100% NL (Ren Lenny Ren en Kali) met een eigen logo.
 3. De muren op de rondweg bij (−168, −484) weg; een grens op de N7 bij (−364, −614).
 4. Mensen en auto's verdwijnen niet meer waar je ze ziet; een schot van ver laat ook de omstanders wegrennen.
 5. De achtergrond alleen vol in de stad, op het platteland en 's nachts zachter.
 6. Na missie 15 tot 17 meteen een vlag naar de volgende missie; erheen gaan begint hem.
 7. Achtergelaten auto's na een speeldag terug in hun vak.
 8. Missie 15: op Bouwman schieten laat de missie mislukken.
 9. De agenten in paren: de een komt op je af, de ander flankeert.
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

// ------------------------------------------------------------------ 1. missiemuziek
kop('missiemuziek');
const mm = await page.evaluate(async () => {
  const g = window.__game, G = g.geluid;
  const lijst = await fetch('/audio/missie/nummers.json').then(r => r.json());
  const bestaat = await Promise.all(lijst.nummers.map(n => fetch('/audio/missie/' + n.bestand, { method: 'HEAD' }).then(r => r.status)));
  const bron = await fetch('/js/audio.js').then(r => r.text());
  // de schuif
  try { localStorage.removeItem('tinga.missievolume'); } catch { /* */ }
  document.getElementById('overlay').style.display = 'flex';
  document.getElementById('menuInstellingen').click();
  const s = document.getElementById('instel_missievolume');
  const uit = { nummers: lijst.nummers.map(n => n.bestand), bestaat, nooitZelfde: /filter\(n => n !== m\.vorige\)/.test(bron), schuif: s ? s.type : null };
  if (s) { s.value = '40'; s.dispatchEvent(new Event('input')); }
  uit.volume = G.missieVolume; uit.bewaard = localStorage.getItem('tinga.missievolume');
  if (s) { s.value = '100'; s.dispatchEvent(new Event('input')); }
  document.getElementById('overlay').style.display = 'none';
  return uit;
});
ok(mm.nummers.length === 2 && mm.nummers.includes('missie2.mp3') && mm.bestaat.every(x => x === 200), 'twee nummers onder de missies', mm.nummers.join(', '));
ok(mm.nooitZelfde, 'nooit twee keer achter elkaar hetzelfde nummer');
ok(mm.schuif === 'range' && Math.abs(mm.volume - 0.4) < 0.01 && mm.bewaard === '0.4', 'een schuif in de instellingen, en hij onthoudt hem', `${mm.volume}, bewaard ${mm.bewaard}`);

// ------------------------------------------------------------------ 2. de radio
kop('de radio');
const rd = await page.evaluate(async () => {
  const z = await fetch('/audio/radio/zenders.json').then(r => r.json());
  const T = await import('/js/textures.js');
  const logo = T.logo100nl();
  const nl = z.zenders.find(q => q.naam === '100% NL');
  return { tinga: z.zenders[0].nummers.map(n => n.bestand), nl: nl ? nl.nummers.map(n => n.bestand) : null, logoNaam: nl && nl.logo,
    logo: logo.image.width, ren: (await fetch('/audio/radio/ren-lenny-ren.mp3', { method: 'HEAD' })).status };
});
ok(rd.tinga.includes('ren-lenny-ren.mp3') && rd.ren === 200, 'Ren Lenny Ren op Radio Tinga', rd.tinga.join(', '));
ok(rd.nl && rd.nl.length === 2 && rd.nl.includes('kali.mp3') && rd.nl.includes('ren-lenny-ren.mp3') && rd.logoNaam === '100nl' && rd.logo === 512, 'de zender 100% NL met eigen logo', JSON.stringify(rd.nl));

// ------------------------------------------------------------------ 3. de rondweg en de grens
kop('de rondweg en de grens');
const rw = await page.evaluate(async () => {
  const W = window.__W, S = await import('/js/scheiding.js');
  // over de rondweg bij (−168, −484): elke meter een auto-botsing (3,5 m hoog en hoger telt voor een auto)
  let geraakt = 0, n = 0;
  for (let t = -20; t <= 20; t += 1) {
    const x = -168.4 + t * 0.85, z = -484.3 + t * 0.53;
    const [rx, rz] = W.resolveCollisions(x, z, 0.9, 0);
    n++; if (Math.hypot(rx - x, rz - z) > 0.05) geraakt++;
  }
  // de grens: dwars over de N7 (de richting die bouwGrenzen uit de rijbaan-as nam), tot 60 m opzij
  const Gr = (await import('/js/afsluiting.js')).GRENZEN[0];
  const grens = [];
  for (const t of [0, 10, -10, 30, -30, 60, -60]) {
    const x = -364.3 + Gr.dwars[0] * t, z = -613.5 + Gr.dwars[1] * t;
    const [rx, rz] = W.resolveCollisions(x, z, 0.4);
    grens.push(+Math.hypot(rx - x, rz - z).toFixed(2));
  }
  return { overgeslagen: S.muurOpWeg, geraakt, n, grens };
});
ok(rw.overgeslagen > 0, 'muurstukken midden op een rijbaan zijn weggelaten', `${rw.overgeslagen} stukken`);
ok(rw.geraakt <= 2, 'de rondweg bij (−168, −484) is vrij (hoogstens een lantaarnpaal)', `${rw.geraakt} van ${rw.n} punten botsen`);
ok(rw.grens.every(d => d > 0.1), 'bij (−364, −614) staat een wand dwars over de N7', rw.grens.join(' · '));

// ------------------------------------------------------------------ 4. verdwijnen en paniek
kop('verdwijnen en paniek');
const vp = await page.evaluate(async () => {
  const npc = await fetch('/js/npc.js').then(r => r.text());
  const veh = await fetch('/js/vehicles.js').then(r => r.text());
  const main = await fetch('/js/main.js').then(r => r.text());
  return {
    mensen: /const uitZicht = d > this\.ZICHT/.test(npc) && /d > 50 && uitZicht/.test(npc),
    autos: /if \(weg && wd < VER && zichtVrij\(/.test(veh),
    paniek: /npcs\.paniek\(h\.point\.x, h\.point\.z, PANIEK_INSLAG\)/.test(main),
  };
});
ok(vp.mensen, 'wie naar huis gaat, staat achter je of buiten de tweehonderd meter');
ok(vp.autos, 'een auto die je ziet rijden verdwijnt niet');
// paniek bij de inslag van een schot van ver: iemand op 60 m, en de omstanders
const pk = await page.evaluate(() => {
  const g = window.__game, N = g.npcs;
  const levend = N.people.filter(p => p.alive && !p.slaapt);
  const p0 = levend[0];
  const om = levend.filter(q => q !== p0 && Math.hypot(q.x - p0.x, q.z - p0.z) < 30);
  for (const q of levend) q.paniek = 0;
  N.paniek(p0.x, p0.z, 32);
  return { omstanders: om.length, rennen: om.filter(q => q.paniek > 0).length };
});
ok(pk.rennen >= Math.min(1, pk.omstanders), 'de omstanders bij de inslag rennen weg', `${pk.rennen} van ${pk.omstanders}`);

// ------------------------------------------------------------------ 5. de achtergrond
kop('de achtergrond');
const ag = await page.evaluate(async () => {
  const g = window.__game, A = await import('/js/audio.js');
  const stad = g.stadNabij(g.player.pos.x, g.player.pos.z);
  const land = g.stadNabij(-2200, 1500);
  return { stad, land, nachtStil: A.ACHTERGROND.nachtStil, bron: /\(0\.2 \+ 0\.8 \* stad\)/.test(await fetch('/js/audio.js').then(r => r.text())) };
});
ok(ag.stad > 0.7 && ag.land < 0.2, 'in Tinga stad, in de polder niet', `Tinga ${ag.stad.toFixed(2)}, polder ${ag.land.toFixed(2)}`);
ok(ag.bron && ag.nachtStil <= 0.5, 'buiten de stad een vijfde, \'s nachts nog eens de helft', `nacht ×${ag.nachtStil}`);

// ------------------------------------------------------------------ 6. de volgende missie
kop('na missie 15 tot 17: de volgende missie op de kaart');
const vm = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  const uit = {};
  for (const [naam, vlag] of [['schaduw', { raceKlaar: true, brugKlaar: true, schriftKlaar: true }],
    ['inval', { raceKlaar: true, brugKlaar: true, schriftKlaar: true, schaduwKlaar: true }],
    ['ronald', { raceKlaar: true, brugKlaar: true, schriftKlaar: true, schaduwKlaar: true, invalKlaar: true, invalKeus: 2, invalTelefoon: true }],
    ['uitzending', { raceKlaar: true, brugKlaar: true, schriftKlaar: true, schaduwKlaar: true, invalKlaar: true, invalKeus: 2, invalTelefoon: true, ronaldKlaar: true, ronaldPraatte: true }]]) {
    const s = v.bewaar(); s.missie = 'klaar'; s.fase = 'klaar'; s.volgende = null;
    Object.assign(s, vlag, { huisGekozen: s.huisGekozen || 'Koningsspil 20' });
    g.politie.reset(); v.herstel(s);
    P.inCar = null;
    P.pos.set(P.pos.x + 400, P.pos.y, P.pos.z + 300);     // ver van elke deur
    v.stap128.zetWacht(naam, 120);
    for (let i = 0; i < 4; i++) v.update(0.05);
    const nav = g.hud.nav;
    const r = { wacht: v.stap128.naMissieNaam, letter: nav && nav.letter, doel: nav && nav.doel };
    if (nav && nav.doel) P.pos.set(nav.doel[0] + 1, P.pos.y, nav.doel[1] + 1);
    for (let i = 0; i < 6; i++) { P.health = 100; v.update(0.05); }
    r.missie = v.missie;
    uit[naam] = r;
    window.__klik(200);
  }
  return uit;
});
for (const naam of ['schaduw', 'inval', 'ronald', 'uitzending']) {
  const r = vm[naam];
  ok(r.letter && r.doel && r.missie === naam, `tijdens het wachten op ${naam}: een ${r.letter || '?'} op de kaart, en erheen gaan begint hem`, `${r.wacht} → ${r.missie}`);
}

// ------------------------------------------------------------------ 7. achtergelaten auto's
kop('achtergelaten auto\'s');
const aa = await page.evaluate(() => {
  const g = window.__game, V = g.vehicles;
  const c = V.cars.find(q => q.inst && !q.mesh && q.driveable);
  V.maakBestuurbaar(c);
  const thuis = { ...c.thuis };
  c.x += 60; c.z += 40; if (c.mesh) c.mesh.position.set(c.x, c.mesh.position.y, c.z);
  c.verlatenOp = 0;
  const vroeg = V.ruimVerlatenOp(100, thuis.x + 1000, thuis.z + 1000, 2880);
  const laat = V.ruimVerlatenOp(3000, thuis.x + 1000, thuis.z + 1000, 2880);
  return { thuis: !!c.thuis, vroeg, laat, terug: Math.hypot(c.x - thuis.x, c.z - thuis.z) };
});
ok(aa.thuis && aa.vroeg === 0, 'binnen een speeldag blijft hij staan', `${aa.vroeg}`);
ok(aa.laat >= 1 && aa.terug < 0.1, 'na een speeldag staat hij weer in zijn vak', `${r1(aa.terug)} m van zijn vak`);

// ------------------------------------------------------------------ 8. missie 15
kop('missie 15: niet op Bouwman schieten');
const sc = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  const mis = window.__meld.length;
  v.__startMissie('schaduw'); window.__stap(2);
  const s = v.bewaar(); s.missie = 'schaduw'; s.fase = 'volgen'; s.punt = { missie: 'schaduw', fase: 'volgen' };
  g.politie.reset(); v.herstel(s); window.__stap(4);
  const voor = v.fase;
  const car = v.race && v.race.bouwmanAuto ? v.race.bouwmanAuto : null;
  const auto = car;
  if (auto) auto.hp = 88;
  for (let i = 0; i < 6; i++) v.update(0.05);
  return { voor, gevonden: !!auto, mislukt: window.__meld.slice(mis).some(m => /MISLUKT/.test(m) && /Bouwman/.test(m)) };
});
ok(sc.gevonden && sc.mislukt, 'een kogel in de auto van Bouwman: missie mislukt', `${sc.voor}, ${sc.mislukt}`);

// ------------------------------------------------------------------ 9. de agenten
kop('de agenten in paren');
const ag2 = await page.evaluate(async () => {
  const g = window.__game, P = g.player, Po = g.politie, W = window.__W, A = (await import('/js/politie.js')).FLANK;
  window.__klik(100);
  Po.reset(); P.inCar = null;
  // een open stuk: het voorterrein van de sporthal is te krap; neem de plek van de speler en twee agenten op 28 m
  Po.zetSter(2, P.pos.x, P.pos.z);
  for (let i = 0; i < 10; i++) Po.update(1 / 30);
  const lijst = Po.agentenLijst.filter(a => a.staat !== 'neer');
  const aanval = lijst.find(a => a.rol === 'aanval'), flank = lijst.find(a => a.rol === 'flank');
  if (!aanval || !flank) return { rollen: lijst.map(a => a.rol) };
  for (const [a, dx] of [[aanval, 26], [flank, 28]]) {
    a.wagen = null; a.persoon.groep.visible = true; a.staat = 'jacht';
    const [x, z] = W.resolveCollisions(P.pos.x + dx, P.pos.z + 2, 0.4);
    a.persoon.groep.position.set(x, P.pos.y, z);
  }
  let schade = 0;
  for (let i = 0; i < 240; i++) { P.health = 100; schade += Po.update(1 / 30); for (const a of [aanval, flank]) { a.staat = 'jacht'; } }
  const hoek = (a) => Math.atan2(a.persoon.groep.position.z - P.pos.z, a.persoon.groep.position.x - P.pos.x);
  let dh = Math.abs(hoek(aanval) - hoek(flank)); if (dh > Math.PI) dh = 2 * Math.PI - dh;
  const d = (a) => Math.hypot(a.persoon.groep.position.x - P.pos.x, a.persoon.groep.position.z - P.pos.z);
  Po.reset();
  return { rollen: lijst.map(a => a.rol), dAanval: d(aanval), dFlank: d(flank), hoek: dh * 180 / Math.PI, afst: A.afst };
});
ok(ag2.rollen && ag2.rollen.includes('aanval') && ag2.rollen.includes('flank'), 'twee rollen in een wagen', (ag2.rollen || []).join(', '));
ok(ag2.dAanval < ag2.dFlank && ag2.hoek > 35, 'de een komt dichterbij, de ander gaat er een boog omheen', `aanval ${r1(ag2.dAanval)} m, flank ${r1(ag2.dFlank)} m, ${r1(ag2.hoek)}° uit elkaar`);

console.log(fouten ? `\n${fouten} fout(en)` : '\nAlles goed.');
console.log('EINDE');
await browser.close();
process.exit(fouten ? 1 : 0);
