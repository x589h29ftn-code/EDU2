/*
 Stap 117: opslaan en laden betrouwbaar (ronde 1 van de steekproef van 4 okt 2026).

   node tools/server.mjs 8123 &   node tools/opslagtest.mjs [poort]   (npm run opslagtest)

 1. F5 slaat niets op in het menu, tijdens een gesprek of een filmbeeld; daarbuiten wel.
 2. Laden van een opslag midden in een gesprek: geen "missie 1" meer bij een latere missie; missie 1
    na het gezelschap, missie 2 bij de poort en missie 3 na de bewaking gaan door naar de volgende.
 3. Na missie 4 (fase 'klaar') belt Johan na het laden alsnog.
 4. Missie 6, 8 en 9 midden in laden: weer een opdracht en een doel op de kaart.
 5. Missie 7 laden zet het geld terug.
 6. Een checkpoint bij het begin van missie 2 tot 6, en niet midden in een gesprek.
 7. Vóór missie 6 kan er een klus komen (missie 5 wacht in 'naar_kruirad').
 8. Doorgaan uit het pauzemenu houdt het checkpoint.
 9. Shift + cijfer: niet tijdens het lopen, en een open keuze gaat voor.
10. Wegklikken laat de toetsen los.
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
await page.evaluate(() => {
  localStorage.removeItem('tinga.spel.v1'); localStorage.removeItem('tinga.checkpoint.v1');
  const g = window.__game, v = g.verhaal;
  window.__autoplay = false;
  window.__toon = [];
  const show = g.hud.show.bind(g.hud);
  g.hud.show = (t, d) => { window.__toon.push(t); return show(t, d); };
  const dicht = () => document.getElementById('dialoog').hidden;
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) { g.player.health = 100; v.update(dt); } };
  window.__klik = (max = 80) => { for (let i = 0; i < max && !dicht(); i++) { v.toets(); window.__stap(1); } };
  window.__toets = (code, extra = {}) => window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true, ...extra }));
  window.__opslag = () => localStorage.getItem('tinga.spel.v1');
  // een opslag van het verhaal in deze stand (zonder de rest van js/opslag.js)
  window.__laad = (extra) => {
    const s = v.bewaar(); s.volgende = null;
    Object.assign(s, extra);
    g.politie.reset();
    v.herstel(s);
    window.__stap(2);
  };
  window.__opdracht = () => (document.getElementById('opdracht').hidden ? '' : document.getElementById('opdracht').textContent);
});

// ------------------------------------------------------------------ 1. F5
kop('F5');
const f5 = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  const uit = {};
  // in het menu (de speler staat stil)
  P.active = false;
  window.__toets('F5');
  uit.menu = window.__opslag();
  P.active = true;
  // tijdens een gesprek (de balk open, zoals elk gesprek hem zet)
  const balk = document.getElementById('dialoog');
  balk.hidden = false;
  uit.gesprekOpen = !balk.hidden;
  window.__toon.length = 0;
  window.__toets('F5');
  uit.gesprek = window.__opslag();
  uit.gesprekMelding = window.__toon.slice(-1)[0] || '';
  balk.hidden = true;
  // tijdens een filmbeeld (de klasse die elk filmbeeld zet)
  localStorage.removeItem('tinga.spel.v1');
  document.body.classList.add('film');
  window.__toets('F5');
  uit.film = window.__opslag();
  document.body.classList.remove('film');
  // en gewoon
  window.__toets('F5');
  uit.gewoon = window.__opslag();
  uit.reden = v.waaromNietOpslaan();
  P.active = false;
  return uit;
});
ok(f5.menu === null, 'in het menu slaat F5 niets op (geen vers spel over je opslag heen)');
ok(f5.gesprekOpen && f5.gesprek === null && /Nu niet opslaan: tijdens een gesprek/.test(f5.gesprekMelding), 'tijdens een gesprek niet, met een melding', f5.gesprekMelding);
ok(f5.film === null, 'tijdens een filmbeeld niet');
ok(!!f5.gewoon && f5.reden === null, 'daarbuiten wel');

// ------------------------------------------------------------------ 2. laden midden in een gesprek
kop('laden midden in een gesprek');
const gesprek = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  const uit = {};
  const vlag = { veteraanKlaar: true, politieautoKlaar: true, brugKlaar: true, huis: 'Koningsspil 20' };
  window.__laad({ ...vlag, missie: 'schrift', fase: 'briefing' });
  uit.schrift = `${v.missie}/${v.fase}`;
  window.__laad({ ...vlag, brugKlaar: false, missie: 'brug', fase: 'plan' });
  uit.brug = `${v.missie}/${v.fase}`;
  window.__laad({ veteraanKlaar: true, huis: 'Koningsspil 20', missie: 'politieauto', fase: 'gesprek' });
  uit.politieauto = `${v.missie}/${v.fase}`;
  // missie 1: het eerste gesprek begint opnieuw, de briefing gaat door naar missie 2
  window.__laad({ missie: 'molenkrite', fase: 'gesprek', huis: null, veteraanKlaar: false, politieautoKlaar: false, brugKlaar: false });
  uit.m1gesprek = `${v.missie}/${v.fase}`;
  window.__laad({ missie: 'molenkrite', fase: 'briefing' });
  uit.m1briefing = `${v.missie}/${v.fase}`;
  uit.m1opdracht = window.__opdracht();
  // missie 2 bij de poort ("Shit, bewaking"), missie 3 na de bewaking
  window.__laad({ missie: 'rijden', fase: 'aangekomen' });
  uit.m2 = `${v.missie}/${v.fase}`;
  uit.m2opdracht = window.__opdracht();
  window.__laad({ missie: 'bewaking', fase: 'poort' });
  uit.m3 = `${v.missie}/${v.fase}`;
  uit.m3opdracht = window.__opdracht();
  return uit;
});
ok(gesprek.schrift === 'schrift/wacht' || gesprek.schrift.startsWith('schrift/'), 'missie 13 in de briefing blijft missie 13 (was: missie 1)', gesprek.schrift);
ok(gesprek.brug.startsWith('brug/') && gesprek.politieauto.startsWith('politieauto/'), 'missie 11 en 12 in een gesprek ook', `${gesprek.politieauto}, ${gesprek.brug}`);
ok(gesprek.m1gesprek === 'molenkrite/wacht', 'missie 1 in het eerste gesprek: opnieuw bij Mark', gesprek.m1gesprek);
ok(gesprek.m1briefing.startsWith('rijden/') && /rij naar de waterzuivering/.test(gesprek.m1opdracht), 'missie 1 in de briefing na het gezelschap: door naar missie 2', `${gesprek.m1briefing} · ${gesprek.m1opdracht}`);
ok(gesprek.m2 === 'bewaking/vechten' && /schakel de bewaking uit/.test(gesprek.m2opdracht), 'missie 2 bij de poort: door naar missie 3, met bewaking', `${gesprek.m2} · ${gesprek.m2opdracht}`);
ok(gesprek.m3.startsWith('afleveren/') && /boerderij/.test(gesprek.m3opdracht), 'missie 3 na de bewaking: door naar missie 4', `${gesprek.m3} · ${gesprek.m3opdracht}`);

// ------------------------------------------------------------------ 3. na missie 4
kop('na missie 4');
const m4 = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__laad({ missie: 'afleveren', fase: 'klaar', volgende: 'johan' });
  let t = 0;
  for (; t < 30 && v.missie !== 'johan'; t += 0.5) window.__stap(10);
  return { missie: v.missie, t };
});
ok(m4.missie === 'johan', 'opgeslagen op MISSION COMPLETED: Johan belt na het laden alsnog', `na ${m4.t} s`);

// ------------------------------------------------------------------ 4. missie 6, 8 en 9
kop('missie 6, 8 en 9');
const midden = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  const uit = {};
  // missie 6: eerst normaal beginnen zodat er een BX staat, dan opslaan in 'ophalen'
  v.__startMissie('bx'); window.__stap(2);
  const s = v.bewaar();
  window.__laad({ missie: 'bx', fase: 'ophalen', bx: { x: 560, z: -40, yaw: 0, kleur: 0x2e6b3a, gestolen: false } });
  uit.bx = { fase: v.fase, opdracht: window.__opdracht(), nav: g.hud.nav && g.hud.nav.letter };
  // overgespoten en op weg naar IJlst
  window.__laad({ missie: 'bx', fase: 'wegbrengen', bx: { x: 560, z: -40, yaw: 0, kleur: 0x8a1f2a, gestolen: true } });
  window.__stap(4);
  uit.bxWeg = { fase: v.fase, opdracht: window.__opdracht(), mark: v.mark.groep.visible };
  window.__laad({ missie: 'sniper', fase: 'kopen', bx: null });
  uit.sniper = { fase: v.fase, opdracht: window.__opdracht() };
  window.__laad({ missie: 'huis', fase: 'naar_mark' });
  uit.huis = { fase: v.fase, opdracht: window.__opdracht() };
  return uit;
});
ok(midden.bx.fase === 'ophalen' && /haal de groene/.test(midden.bx.opdracht) && midden.bx.nav === 'A', 'missie 6 bij het ophalen: opdracht en de A op de kaart', `${midden.bx.opdracht}`);
ok(midden.bxWeg.fase === 'wegbrengen' && /IJlst/.test(midden.bxWeg.opdracht) && midden.bxWeg.mark, 'overgespoten: door naar IJlst, Mark staat er', `${midden.bxWeg.opdracht}`);
ok(/sniper/.test(midden.sniper.opdracht), 'missie 8: weer een opdracht (eerst had hij er geen)', midden.sniper.opdracht);
ok(midden.huis.fase === 'naar_mark' && /Wieken/.test(midden.huis.opdracht), 'missie 9: naar Mark bij de Wieken', midden.huis.opdracht);

// ------------------------------------------------------------------ 5. missie 7 en het geld
kop('missie 7');
const bom = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__laad({ missie: 'bom', fase: 'planten', geld: 4321, buit: 0 });
  return { geld: v.bewaar().geld, fase: v.fase, missie: v.missie };
});
ok(bom.geld === 4321 && bom.missie === 'bom' && bom.fase === 'wacht', 'laden midden in missie 7: opnieuw bij de M, met het geld van de opslag', `€ ${bom.geld}, ${bom.fase}`);

// ------------------------------------------------------------------ 6. checkpoints bij missie 2 tot 6
kop('checkpoints');
const cp = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  const uit = {};
  for (const [van, naar] of [['molenkrite', 'rijden'], ['rijden', 'bewaking'], ['bewaking', 'afleveren'], ['afleveren', 'johan'], ['johan', 'bx']]) {
    window.__laad({ missie: van, fase: van === 'molenkrite' ? 'opdracht' : van === 'johan' ? 'terug' : 'rijden', bx: null });
    window.__stap(2);
    localStorage.removeItem('tinga.checkpoint.v1');
    v.__startMissie(naar);
    window.__klik();
    window.__stap(40);
    const c = JSON.parse(localStorage.getItem('tinga.checkpoint.v1') || 'null');
    uit[naar] = c ? (c.verhaal ? c.verhaal.missie : (c.missie || '?')) : null;
  }
  // een gesprek open: dan wacht het checkpoint tot het dicht is
  window.__laad({ missie: 'molenkrite', fase: 'opdracht' });
  window.__stap(2);
  localStorage.removeItem('tinga.checkpoint.v1');
  v.__startMissie('rijden');
  // (een gesprek nagebootst: de balk open, zoals elk gesprek hem zet)
  const balk = document.getElementById('dialoog');
  balk.hidden = false;
  window.__stap(40);
  uit.tijdens = localStorage.getItem('tinga.checkpoint.v1');
  balk.hidden = true; window.__stap(40);
  uit.erna = !!localStorage.getItem('tinga.checkpoint.v1');
  return uit;
});
ok(['rijden', 'bewaking', 'afleveren', 'johan', 'bx'].every(m => cp[m] !== null), 'een checkpoint bij het begin van missie 2, 3, 4, 5 en 6', JSON.stringify(cp));
ok(cp.tijdens === null && cp.erna, 'niet midden in een gesprek, wel als het dicht is', `${cp.tijdens === null ? 'gewacht' : cp.tijdens}`);

// ------------------------------------------------------------------ 7. een klus vóór missie 6
kop('klus vóór missie 6');
const klus = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__laad({ missie: 'johan', fase: 'naar_kruirad' });
  return { fase: v.fase, vrij: v.klusVrij, wacht: v.klusWacht.johan };
});
ok(klus.fase === 'naar_kruirad' && klus.vrij && klus.wacht.includes('naar_kruirad'), 'missie 5 wacht in naar_kruirad: daar mag een klus', JSON.stringify(klus));

// ------------------------------------------------------------------ 8. Doorgaan houdt het checkpoint
kop('Doorgaan');
const door = await page.evaluate(async () => {
  const g = window.__game, v = g.verhaal, P = g.player;
  document.getElementById('overlay').style.display = '';
  localStorage.setItem('tinga.checkpoint.v1', localStorage.getItem('tinga.spel.v1'));
  const voor = !!localStorage.getItem('tinga.checkpoint.v1');
  P.active = true;
  window.__toets('Escape');
  await new Promise(r => setTimeout(r, 400));
  const pauze = !P.active;
  const knop = document.getElementById('menuDoorgaan');
  if (knop) knop.click();
  await new Promise(r => setTimeout(r, 600));
  const na = !!localStorage.getItem('tinga.checkpoint.v1');
  const r = { voor, pauze, knop: !!knop, na, actief: P.active, missie: v.missie };
  P.active = false;
  return r;
});
ok(door.voor && door.pauze && door.knop, 'Esc: het pauzemenu, met Doorgaan', JSON.stringify(door));
ok(door.na && door.actief, 'Doorgaan: weer spelen, en het checkpoint staat er nog');

// ------------------------------------------------------------------ 9. shift + cijfer
kop('shift en een cijfer');
const shift = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  const uit = {};
  P.active = true;
  window.__laad({ missie: 'klaar', fase: 'klaar' });
  // rennend (W ingedrukt): geen missie
  P.keys.KeyW = true; P.keys.ShiftLeft = true;
  window.__toets('Digit2', { shiftKey: true });
  uit.rennend = v.missie;
  P.keys.KeyW = false; P.keys.ShiftLeft = false;
  // stilstaand: wel (zo starten de proeven en de bouwer een missie los)
  window.__toets('Digit2', { shiftKey: true });
  uit.stil = v.missie;
  // een open keuze (missie 9: het aanbod van drie huizen) gaat voor
  window.__laad({ missie: 'huis', fase: 'kiezen', aanbod: true, huis: null });
  window.__toets('Digit1', { shiftKey: true });
  uit.keuze = v.missie;
  // wegklikken laat de toetsen los
  P.keys.KeyW = true;
  window.dispatchEvent(new Event('blur'));
  uit.losgelaten = !P.keys.KeyW;
  P.active = false;
  return uit;
});
ok(shift.rennend === 'klaar', 'rennend shift + 2: geen missie 2', shift.rennend);
ok(shift.stil === 'rijden', 'stilstaand shift + 2: missie 2 (de sneltoets blijft)', shift.stil);
ok(shift.keuze === 'huis', 'met een open keuze gaat shift + 1 naar de keuze, niet naar missie 1', shift.keuze);
ok(shift.losgelaten, 'wegklikken (blur) laat de looptoetsen los');

console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
await browser.close();
process.exit(fouten ? 1 : 0);
