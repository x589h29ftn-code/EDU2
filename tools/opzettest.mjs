/*
 Stap 118: de opzet voor een nieuwe speler (ronde 2 van de steekproef van 4 okt 2026).

   node tools/server.mjs 8123 &   node tools/opzettest.mjs [poort]   (npm run opzettest)

 1. De besturing in het menu is compleet (X, 1 2 3, rechtermuisknop, sniper, Opslaan in het menu).
 2. Spel laden zegt wanneer en waar je opsloeg, en is dan de hoofdknop.
 3. Een onleesbare opslag krijgt een regel in het menu in plaats van stil te verdwijnen.
 4. Start spel vraagt eerst of het echt moet als er een opslag is.
 5. Opslaan in het pauzemenu: slaat op, en weigert tijdens een gesprek.
 6. Een ander tabblad zet het spel op pauze.
 7. Een keuze (missie 9) staat als knoppen klaar voor een aanraakscherm, en een knop kiest.
 8. Een mislukte missie begint opnieuw en laadt niet stil je eigen opslag.
 9. Het eerste checkpoint legt opslaan uit; MISSIE VOLTOOID in plaats van MISSION COMPLETED.
10. Geen voorwerpen uit de oude lijst in de rijbaan of in het water.
11. Geen 404 (favicon).
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
const missers = [];
page.on('response', r => { if (r.status() >= 400) missers.push(`${r.status()} ${r.url()}`); });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  localStorage.removeItem('tinga.spel.v1'); localStorage.removeItem('tinga.checkpoint.v1');
  const g = window.__game, v = g.verhaal;
  window.__autoplay = false;
  window.__menu = await import('/js/menu.js');
  window.__opsl = await import('/js/opslag.js');
  window.__uitleg = await import('/js/uitleg.js');
  window.__W = await import('/js/world.js');
  window.__toon = [];
  const show = g.hud.show.bind(g.hud);
  g.hud.show = (t, d) => { window.__toon.push(t); return show(t, d); };
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) { g.player.health = 100; v.update(dt); } };
  window.__opslag = () => localStorage.getItem('tinga.spel.v1');
  // (checkVisibility: ook een knop in een verborgen menu telt als weg)
  window.__zie = (id) => { const e = document.getElementById(id); return !!e && !e.hidden && e.checkVisibility(); };
  window.__menuNu = () => window.__menu.toonMenu({ heeftOpslag: !!window.__opsl.opslagInfo(), opslag: window.__opsl.opslagInfo(), staat: window.__opsl.opslagStaat() });
});
const klik = (id) => page.evaluate((id) => document.getElementById(id).click(), id);
const wacht = (ms) => page.waitForTimeout(ms);

// ------------------------------------------------------------------ 1. besturing
kop('de besturing in het menu');
await klik('menuBesturing');
const besturing = await page.evaluate(() => document.querySelector('.menuzij').innerText);
for (const [w, re] of [['X (klus afbreken)', /\bX\b/], ['1 2 3 (een keuze)', /1 2 3/], ['rechtermuisknop', /rechtermuisknop/],
  ['de sniper', /sniper/i], ['Opslaan in dit menu', /Opslaan in dit menu/], ['de kaart: eigen doel', /eigen doel/]]) ok(re.test(besturing), `besturing noemt ${w}`);
await klik('menuBesturing');
ok(!(await page.evaluate(() => window.__zie('menuOpslaan'))), 'op het startscherm geen knop Opslaan (er is nog geen spel)');

// ------------------------------------------------------------------ 2. Spel laden met datum
kop('Spel laden');
const laden = await page.evaluate(() => {
  const g = window.__game, P = g.player;
  P.active = true;
  g.opslaan();
  P.active = false;
  window.__menuNu();
  const b = document.getElementById('menuLaden');
  return { opslag: !!window.__opslag(), tekst: b.innerText, hoofd: b.classList.contains('hoofd'),
    nieuwHoofd: document.getElementById('menuNieuw').classList.contains('hoofd'), zie: window.__zie('menuLaden') };
});
ok(laden.opslag && laden.zie, 'met een opslag staat Spel laden er', laden.tekst.replace(/\s+/g, ' '));
ok(/\d\d:\d\d/.test(laden.tekst), 'Spel laden zegt wanneer je opsloeg');
ok(laden.hoofd && !laden.nieuwHoofd, 'Spel laden is de hoofdknop, Start spel niet');

// ------------------------------------------------------------------ 3. onleesbaar
kop('een onleesbare opslag');
const kapot = await page.evaluate(() => {
  const goed = window.__opslag();
  localStorage.setItem('tinga.spel.v1', '{"versie": 1, "speler": kapot');
  window.__menuNu();
  const uit = { staat: window.__opsl.opslagStaat(), melding: window.__zie('menuOpslagMelding'),
    tekst: document.getElementById('menuOpslagMelding').innerText, laden: window.__zie('menuLaden') };
  localStorage.setItem('tinga.spel.v1', goed);
  window.__menuNu();
  uit.daarna = window.__zie('menuOpslagMelding');
  return uit;
});
ok(kapot.staat === 'onleesbaar', 'opslagStaat ziet een kapotte opslag', kapot.staat);
ok(kapot.melding && /niet lezen/.test(kapot.tekst), 'het menu meldt het', kapot.tekst);
ok(!kapot.laden, 'en biedt geen Spel laden aan dat niets doet');
ok(!kapot.daarna, 'met een goede opslag is de regel weer weg');

// ------------------------------------------------------------------ 4. Start spel vraagt
kop('Start spel met een opslag');
await klik('menuNieuw');
const vraag = await page.evaluate(() => ({ tekst: document.getElementById('menuNieuw').innerText,
  uitleg: window.__zie('menuNieuwUitleg'), laad: window.__zie('laadscherm') }));
ok(/Echt een nieuw spel/.test(vraag.tekst), 'de eerste klik vraagt het', vraag.tekst);
ok(!vraag.laad, 'en begint nog niet');
await page.evaluate(() => window.__menuNu());
ok(await page.evaluate(() => document.getElementById('menuNieuw').innerText === 'Start spel'), 'het menu opnieuw: de vraag is weg');

// ------------------------------------------------------------------ 5. opslaan in de pauze
kop('Opslaan in het pauzemenu');
await page.evaluate(() => { window.__menu.verbergMenu(); window.__game.player.active = true; window.__game.pauzeer(); });
const pauze = await page.evaluate(() => ({ zie: window.__zie('menuOpslaan'), doorgaan: window.__zie('menuDoorgaan') }));
ok(pauze.zie && pauze.doorgaan, 'in de pauze staan Doorgaan en Opslaan');
await page.evaluate(() => localStorage.removeItem('tinga.spel.v1'));
await klik('menuOpslaan');
const opgeslagen = await page.evaluate(() => ({ opslag: !!window.__opslag(), tekst: document.getElementById('menuOpslaan').innerText }));
ok(opgeslagen.opslag, 'de knop slaat op', opgeslagen.tekst);
const weiger = await page.evaluate(() => {
  localStorage.removeItem('tinga.spel.v1');
  const balk = document.getElementById('dialoog');
  balk.hidden = false;
  document.getElementById('menuOpslaan').click();
  const uit = { opslag: !!window.__opslag(), tekst: document.getElementById('menuOpslaan').innerText };
  balk.hidden = true;
  return uit;
});
ok(!weiger.opslag && /gesprek/.test(weiger.tekst), 'tijdens een gesprek niet, en dat staat erbij', weiger.tekst);
await klik('menuDoorgaan');
await wacht(300);
ok(await page.evaluate(() => window.__game.player.active && !window.__zie('menuDoorgaan')), 'Doorgaan speelt verder');

// ------------------------------------------------------------------ 6. tabblad weg
kop('een ander tabblad');
const tab = await page.evaluate(() => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  document.dispatchEvent(new Event('visibilitychange'));
  const uit = { actief: window.__game.player.active, menu: window.__zie('menuDoorgaan') };
  delete document.hidden;
  return uit;
});
ok(!tab.actief && tab.menu, 'het spel staat op pauze, met het menu', JSON.stringify(tab));
await klik('menuDoorgaan');
await wacht(300);

// ------------------------------------------------------------------ 7. keuzeknoppen
kop('een keuze op een aanraakscherm');
const keuze = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  g.player.active = true;
  const s = v.bewaar(); s.volgende = null;
  Object.assign(s, { missie: 'huis', fase: 'kiezen', aanbod: true, huis: null });
  v.herstel(s);
  window.__stap(2);
  const open = v.openKeuze;
  g.werkKeuzeKnoppenBij(true);
  const knoppen = [...document.querySelectorAll('#keuzeknoppen button')].map(b => b.innerText);
  const zie = window.__zie('keuzeknoppen');
  document.querySelectorAll('#keuzeknoppen button')[1].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
  const opdracht = document.getElementById('opdracht').textContent;
  return { open, knoppen, zie, opdracht };
});
ok(Array.isArray(keuze.open) && keuze.open.length === 3, 'missie 9: drie keuzes open', JSON.stringify(keuze.open));
ok(keuze.zie && keuze.knoppen.length === 3 && /^1 · /.test(keuze.knoppen[0]), 'drie knoppen in beeld', keuze.knoppen.join(' | '));
ok(/ga kijken bij/.test(keuze.opdracht), 'knop 2 kiest een woning', keuze.opdracht);
const geenKeuze = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  v.__startMissie('rijden');
  window.__stap(2);
  g.werkKeuzeKnoppenBij(true);
  return { open: v.openKeuze, zie: window.__zie('keuzeknoppen') };
});
ok(geenKeuze.open === null && !geenKeuze.zie, 'zonder keuze geen knoppen');

// ------------------------------------------------------------------ 8. mislukt
kop('een mislukte missie');
const mis = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  // een eigen opslag van een eerder moment, ver van hier
  v.__startMissie('molenkrite');
  P.pos.set(g.start.x, 0, g.start.z);
  P.active = true;
  g.opslaan();
  const opslag = !!window.__opslag();
  v.__startMissie('schrift');
  window.__stap(4);
  P.pos.set(P.pos.x + 400, 0, P.pos.z);
  const voor = { x: P.pos.x, z: P.pos.z };
  window.__toon.length = 0;
  v.__mislukt('proef');
  window.__stap(140, 0.05);
  return { opslag, missie: v.missie, fase: v.fase, toon: window.__toon.slice(), weg: Math.hypot(P.pos.x - g.start.x, P.pos.z - g.start.z),
    actief: P.active, voor };
});
ok(mis.opslag, 'er staat een eigen opslag (missie 1)');
ok(mis.missie === 'schrift', 'na het mislukken: dezelfde missie opnieuw', `${mis.missie}/${mis.fase}`);
ok(mis.weg > 100, 'niet teruggezet naar de plek van de opslag', `${mis.weg.toFixed(0)} m van het begin`);
ok(mis.toon.some(t => /begint opnieuw/.test(t) && /F9/.test(t)), 'en de melding zegt dat F9 je opslag laadt', mis.toon.join(' | '));
ok(mis.actief, 'je speelt weer');

// ------------------------------------------------------------------ 9. checkpoint en uitleg
kop('het eerste checkpoint');
const cp = await page.evaluate(async () => {
  const g = window.__game, v = g.verhaal;
  window.__uitleg.reset();
  localStorage.removeItem('tinga.checkpoint.v1');
  v.__startMissie('molenkrite');
  window.__stap(2);
  v.__startMissie('rijden');
  window.__stap(40);
  const bron = await (await fetch('/js/verhaal.js')).text();
  return { cp: !!localStorage.getItem('tinga.checkpoint.v1'), gehad: window.__uitleg.gehadHebben(),
    tekst: document.getElementById('uitleg').innerText, engels: /MISSION COMPLETED/.test(bron), nl: /MISSIE VOLTOOID/.test(bron) };
});
ok(cp.cp, 'bij het begin van missie 2 een checkpoint');
ok(cp.gehad.includes('opslaan') && /F5/.test(cp.tekst) && /F9/.test(cp.tekst), 'en de uitleg over opslaan', cp.tekst.replace(/\s+/g, ' ').slice(0, 120));
ok(!cp.engels && cp.nl, 'MISSIE VOLTOOID, geen MISSION COMPLETED');

// ------------------------------------------------------------------ 10. voorwerpen
kop('voorwerpen uit de oude lijst');
const props = await page.evaluate(() => {
  const g = window.__game, W = window.__W;
  let staan = 0, fout = [];
  g.scene.traverse(o => {
    if (o.userData.prop === undefined || o.parent !== g.scene) return;
    staan++;
    const b = W.vrijeObjectPlek(o.position.x, o.position.z);
    if (b === 'rijbaan' || b === 'water') fout.push(`${o.userData.prop} ${b}`);
  });
  return { staan, fout, over: W.overgeslagenProps.length, soorten: [...new Set(W.overgeslagenProps.map(p => p.type))].slice(0, 8) };
});
ok(props.fout.length === 0, 'geen voorwerp in de rijbaan of het water', `${props.staan} staan er, ${props.over} overgeslagen (${props.soorten.join(', ')})${props.fout.length ? ' · ' + props.fout.slice(0, 5).join(', ') : ''}`);

// ------------------------------------------------------------------ 11. 404
kop('geen 404');
ok(await page.evaluate(() => !!document.querySelector('link[rel="icon"]')), 'een favicon in de kop');
ok(!missers.some(m => /favicon/.test(m)), 'geen vraag naar favicon.ico', missers.filter(m => /favicon/.test(m)).join(', '));
ok(missers.length === 0, 'geen enkel bestand mist', missers.slice(0, 5).join(', '));

// ------------------------------------------------------------------ 4b. Start spel, tweede klik
kop('Start spel: de tweede klik');
await page.evaluate(() => { window.__game.player.active = true; window.__game.pauzeer(); });
await klik('menuNieuw');
const eerste = await page.evaluate(() => ({ tekst: document.getElementById('menuNieuw').innerText, laad: window.__zie('laadscherm') }));
ok(/Echt/.test(eerste.tekst) && !eerste.laad, 'vanuit de pauze ook eerst de vraag');
await klik('menuNieuw');
await wacht(400);
ok(await page.evaluate(() => window.__zie('laadscherm')), 'de tweede klik begint een nieuw spel (het laadscherm)');

console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
await browser.close();
process.exit(fouten ? 1 : 0);
