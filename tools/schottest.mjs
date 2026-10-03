/*
 Het schot als opname, en het machinegeweer als automaat (stap 105, verzoek 1 okt 2026: "test eens
 hoe dit geluidje als geweerschot klinkt voor de wapens; voor de machinegeweer even zien hoe je dat
 automatisch maakt").

   node tools/server.mjs 8123 &   node tools/schottest.mjs [poort]   (npm run schottest)

 1. audio/wapen/schot.mp3 laadt; het spel vindt waar de knal begint (het bestand begint met 80 ms
    stilte) en speelt vanaf daar.
 2. Per wapen: de sniper lager en voller, het machinegeweer hoger; van ver weg zachter en doffer.
 3. Een salvo kapt de naklank van het vorige schot af: één stem tegelijk per bron.
 4. Het machinegeweer schiet door zolang de knop ingedrukt is: met een vergrendelde muis, zonder
    (slepen), en op de vuurknop van een aanraakscherm. Het pistool en de sniper niet: één klik is
    één schot, ook als je de knop vasthoudt.
 5. De keuze in het menu: terug naar het gemaakte schot.
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
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1100, height: 680 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  const g = window.__game, pl = g.player;
  document.getElementById('overlay').style.display = 'none';
  window.__autoplay = false;
  g.geluid.start();
  await g.geluid.laadSchot();
  // de speler met alle drie de wapens, vol, en klaar om te schieten
  pl.wapens = ['pistool', 'mitrailleur', 'sniper'];
  window.__wapen = (soort) => {
    pl.wapenNr = pl.wapens.indexOf(soort);
    pl.ammo = 200; pl.reserve = 500; pl.reloading = 0; pl.vuurKlok = 0; pl.wisselT = 0;
    pl.wapenUit = false; pl.vuurSlot = false; pl.inCar = null; pl.binnen = false; pl.vuurAan = false; pl.dragging = false;
  };
  // een paar beelden van de speler zelf (daar zit het doorschieten in)
  window.__beelden = (s, dt = 1 / 60) => { for (let t = 0; t < s; t += dt) pl.update(dt); };
  window.__muis = (soort, knop = 0) => document.dispatchEvent(new MouseEvent(soort, { button: knop, bubbles: true, clientX: 500, clientY: 300 }));
});

// ------------------------------------------------------------------ 1. de opname
kop('de opname');
const laad = await page.evaluate(() => window.__game.geluid.schotStand());
ok(laad.geladen && Math.abs(laad.duur - 1.056) < 0.02, 'audio/wapen/schot.mp3 is geladen', `${laad.duur.toFixed(3)} s`);
ok(laad.begin > 0.05 && laad.begin < 0.09, 'hij begint bij de knal, niet bij de stilte ervoor', `vanaf ${(laad.begin * 1000).toFixed(0)} ms`);

// ------------------------------------------------------------------ 2. per wapen
kop('per wapen, en van ver weg');
const per = await page.evaluate(() => {
  const g = window.__game, pl = g.player, uit = {};
  for (const w of ['pistool', 'mitrailleur', 'sniper']) {
    window.__wapen(w);
    pl.shoot();
    uit[w] = { ...g.geluid.schotStand().laatste };
  }
  g.geluid.schot(5, { bron: 'test' }); uit.dichtbij = { ...g.geluid.schotStand().laatste };
  g.geluid.schot(60, { bron: 'test2' }); uit.ver = { ...g.geluid.schotStand().laatste };
  return uit;
});
ok(per.pistool.opname && per.pistool.bron === 'speler' && Math.abs(per.pistool.offset - laad.begin) < 1e-6, 'het pistool speelt de opname, vanaf de knal', `snelheid ${per.pistool.rate.toFixed(2)}`);
ok(per.sniper.rate < 0.9 && per.sniper.gain > per.pistool.gain, 'de sniper: lager en voller', `snelheid ${per.sniper.rate.toFixed(2)}, volume ${per.sniper.gain.toFixed(2)}`);
ok(per.mitrailleur.rate > 1.0, 'het machinegeweer: iets hoger en feller', `snelheid ${per.mitrailleur.rate.toFixed(2)}`);
ok(per.ver.gain < per.dichtbij.gain * 0.4 && per.ver.lp < 5000 && per.dichtbij.lp > 10000, 'op zestig meter zachter en doffer', `volume ${per.dichtbij.gain.toFixed(2)} → ${per.ver.gain.toFixed(2)}, toppen ${per.dichtbij.lp.toFixed(0)} → ${per.ver.lp.toFixed(0)} Hz`);

// ------------------------------------------------------------------ 3. een salvo
kop('een salvo kapt de naklank af');
const salvo = await page.evaluate(() => {
  const g = window.__game;
  for (let i = 0; i < 12; i++) g.geluid.schot(0, { wapen: 'mitrailleur', bron: 'salvo' });
  return g.geluid.schotStand('salvo').stemmen;
});
ok(salvo === 1, 'twaalf schoten achter elkaar: er klinkt er nog één (de andere elf zijn afgekapt)', `${salvo} stem`);

// ------------------------------------------------------------------ 4. doorschieten
kop('doorschieten');
const auto = await page.evaluate(() => {
  const g = window.__game, pl = g.player, uit = {};
  pl.active = true;
  const tel = (f) => { const n0 = pl.schoten || 0; f(); return (pl.schoten || 0) - n0; };
  // (a) met een vergrendelde muis: een seconde ingedrukt
  window.__wapen('mitrailleur'); pl.pointerLocked = true;
  uit.vast = tel(() => { window.__muis('mousedown'); window.__beelden(1); window.__muis('mouseup'); });
  uit.vastNa = tel(() => window.__beelden(0.5));
  // (b) zonder vergrendeling: slepen kijkt rond, en een automaat vuurt toch
  window.__wapen('mitrailleur'); pl.pointerLocked = false;
  uit.sleep = tel(() => { window.__muis('mousedown'); window.__beelden(1); window.__muis('mouseup'); });
  uit.sleepNa = tel(() => window.__beelden(0.5));
  // (c) het pistool: één klik is één schot, ook vastgehouden, met en zonder vergrendeling
  window.__wapen('pistool'); pl.pointerLocked = true;
  uit.pistoolVast = tel(() => { window.__muis('mousedown'); window.__beelden(1); window.__muis('mouseup'); });
  window.__wapen('pistool'); pl.pointerLocked = false;
  uit.pistoolKlik = tel(() => { window.__muis('mousedown'); window.__muis('mouseup'); window.__beelden(0.2); });
  window.__wapen('sniper'); pl.pointerLocked = true;
  uit.sniperVast = tel(() => { window.__muis('mousedown'); window.__beelden(2); window.__muis('mouseup'); });
  pl.pointerLocked = false; pl.active = false;
  return uit;
});
ok(auto.vast >= 9 && auto.vast <= 13 && auto.vastNa === 0, 'met een vergrendelde muis: doorschieten zolang je drukt, en dan stoppen', `${auto.vast} schoten in een seconde`);
ok(auto.sleep >= 9 && auto.sleep <= 13 && auto.sleepNa === 0, 'zonder vergrendeling (slepen) ook', `${auto.sleep} schoten`);
ok(auto.pistoolVast === 1 && auto.pistoolKlik === 1, 'het pistool: één klik is één schot', `vastgehouden ${auto.pistoolVast}, klik ${auto.pistoolKlik}`);
ok(auto.sniperVast === 1, 'de sniper ook', `${auto.sniperVast}`);

// de vuurknop van een aanraakscherm (js/touch.js, op deze pagina los opgezet)
const tik = await page.evaluate(async () => {
  const g = window.__game, pl = g.player;
  const { initTouchControls } = await import('/js/touch.js');
  if (!document.getElementById('tfire')) return { geen: true };
  initTouchControls(pl, {});
  const knop = document.getElementById('tfire');
  const tel = (f) => { const n0 = pl.schoten || 0; f(); return (pl.schoten || 0) - n0; };
  pl.active = true;
  window.__wapen('mitrailleur');
  const n = tel(() => {
    knop.dispatchEvent(new Event('touchstart', { bubbles: true, cancelable: true }));
    window.__beelden(1);
    knop.dispatchEvent(new Event('touchend', { bubbles: true, cancelable: true }));
  });
  const na = tel(() => window.__beelden(0.5));
  window.__wapen('pistool');
  const p = tel(() => {
    knop.dispatchEvent(new Event('touchstart', { bubbles: true, cancelable: true }));
    window.__beelden(1);
    knop.dispatchEvent(new Event('touchend', { bubbles: true, cancelable: true }));
  });
  pl.active = false;
  return { n, na, p };
});
ok(!tik.geen && tik.n >= 9 && tik.na === 0 && tik.p === 1, 'de vuurknop op een aanraakscherm: ingedrukt is doorschieten (pistool: één)', `${tik.n} schoten, pistool ${tik.p}`);

// ------------------------------------------------------------------ 5. de keuze
kop('terug naar het gemaakte schot');
const keuze = await page.evaluate(() => {
  const g = window.__game, pl = g.player;
  g.geluid.zetSchotSoort('gemaakt');
  window.__wapen('pistool'); pl.shoot();
  const gemaakt = g.geluid.schotStand().laatste.opname === false;
  g.geluid.zetSchotSoort('opname');
  window.__wapen('pistool'); pl.shoot();
  return { gemaakt, opname: g.geluid.schotStand().laatste.opname === true };
});
ok(keuze.gemaakt && keuze.opname, '"Schotgeluid: gemaakt" speelt het oude schot, "opname" de opname');

console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
await browser.close();
process.exit(fouten ? 1 : 0);
