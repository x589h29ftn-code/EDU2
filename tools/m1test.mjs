/*
 De M1 Garand bij Tinga State (verzoek 10 okt 2026), nagemeten.

   node tools/server.mjs 8123 &   node tools/m1test.mjs [poort]   (npm run m1test)

 1. Kopen: met te weinig geld niet, met genoeg € 1.500 eraf en het wapen in je hand, met patronen erbij.
 2. Eén schot per klik: de trekker vasthouden schiet niet door.
 3. De terugslag is groter dan die van het pistool en het machinegeweer (het beeld én het wapen in je hand).
 4. Acht schoten, dan leeg: een negende klik schiet niet; na de achtste de ping en de lege clip die wegvliegt,
    en de grendel blijft open.
 5. Herladen: de laadhand met de clip boven de kast, erin gedrukt, de klak van de grendel, en weer acht.
 6. Herladen met een halve clip: de clip springt eruit (ping), en de rest gaat terug in je voorraad.
 7. De naam en de patronen in beeld ("M1 Garand · 8 / …").
 8. Opslaan en laden houdt het wapen.
 9. Geen nieuwe shader: het model is bij het opstarten gemaakt.
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fouten++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);
const r3 = (n) => (n == null || !isFinite(n)) ? String(n) : n.toFixed(3);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(() => {
  for (const k of Object.keys(localStorage)) if (k.startsWith('tinga.spel')) localStorage.removeItem(k);
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, P = g.player;
  P.active = false;
  window.__autoplay = false;
  // geen treffers in de wereld: dit gaat over het wapen, niet over wie er geraakt wordt
  window.__shootCb = P.shootCb; P.shootCb = null;
  P.wapenUit = false; P.binnen = false; P.vuurSlot = false; P.wapenSlot = false; P.oneindig = false;
  P.pitch = 0.6;
  window.__tel = { klak: 0, clipIn: 0 };
  const G = g.geluid;
  const klak = G.m1Klak.bind(G), clipIn = G.m1ClipIn.bind(G);
  G.m1Klak = () => { window.__tel.klak++; klak(); };
  G.m1ClipIn = () => { window.__tel.clipIn++; clipIn(); };
  // een beeld verder: de speler (met het wapen) en zijn wisselbeweging
  window.__stap = (n = 1, dt = 0.05) => { for (let i = 0; i < n; i++) { P.health = 100; P.update(dt); } };
  window.__klaar = () => { for (let i = 0; i < 60 && (P.wisselT > 0 || P.vuurKlok > 0 || P.reloading > 0); i++) window.__stap(1); };
});

// ------------------------------------------------------------------ 1. kopen
kop('kopen bij Tinga State');
const koop = await page.evaluate(async () => {
  const g = window.__game, P = g.player, v = g.verhaal;
  const { GARAND } = await import('/js/boerderij.js');
  v.betaal(v.geld);
  const armGeld = v.geld;
  const arm = g.boerderij.koopWapen('garand');
  const naArm = P.wapens.includes('garand');
  const inSchap = g.boerderij.schap.find(a => a.sleutel === 'garand');
  v.verdien(2000);
  const voor = v.geld, reserveVoor = P.reserve;
  const uit = g.boerderij.koopWapen('garand');
  window.__klaar();
  return {
    prijs: GARAND.prijs, armGeld, arm, naArm, inSchap, voor, na: v.geld, uit,
    heeft: P.wapens.includes('garand'), soort: P.wapenSoort, ammo: P.ammo, reserveVoor, reserve: P.reserve,
    nogmaals: g.boerderij.koopWapen('garand'), inBezit: g.boerderij.inBezit,
  };
});
ok(koop.prijs === 1500, 'de M1 Garand kost € 1.500', `€ ${koop.prijs}`);
ok(!!koop.inSchap && koop.inSchap.prijs === 1500, 'hij ligt in het schap van Tinga State', koop.inSchap ? `${koop.inSchap.naam}, € ${koop.inSchap.prijs}` : 'niet gevonden');
ok(koop.arm === 'arm' && !koop.naArm, 'met te weinig geld koop je hem niet', `€ ${koop.armGeld} op zak: ${koop.arm}`);
ok(koop.uit === 'ok' && koop.na === koop.voor - 1500, 'met genoeg geld gaat er € 1.500 af', `€ ${koop.voor} → € ${koop.na}`);
ok(koop.heeft && koop.soort === 'garand', 'en hij zit meteen in je hand', `${koop.soort}`);
ok(koop.ammo === 8, 'met een volle clip van acht', `${koop.ammo}`);
ok(koop.reserve - koop.reserveVoor === 48, 'en zes clips erbij in je tas', `${koop.reserveVoor} → ${koop.reserve}`);
ok(koop.nogmaals === 'heeft' && koop.inBezit.includes('M1 Garand'), 'een tweede kopen kan niet; hij staat "in bezit"', `${koop.nogmaals}`);

// ------------------------------------------------------------------ 2. één per klik
kop('halfautomatisch');
const semi = await page.evaluate(async () => {
  const g = window.__game, P = g.player;
  const { WAPENS } = await import('/js/player.js');
  const voor = P.schoten || 0;
  P.vuurAan = true; P.shoot();
  window.__stap(30);                       // anderhalve seconde de trekker vast
  P.vuurAan = false;
  const na = P.schoten || 0;
  window.__klaar();
  return { auto: WAPENS.garand.auto, mag: WAPENS.garand.mag, dodelijk: WAPENS.garand.dodelijk, schoten: na - voor, ammo: P.ammo };
});
ok(semi.mag === 8 && semi.auto === false, 'acht patronen, niet automatisch', `mag ${semi.mag}, auto ${semi.auto}`);
ok(semi.schoten === 1, 'de trekker vasthouden geeft één schot', `${semi.schoten} schoten in 1,5 s`);
ok(semi.dodelijk === 1, 'een .30-06: één treffer is genoeg', `${semi.dodelijk}`);

// ------------------------------------------------------------------ 3. terugslag
kop('terugslag');
const kick = await page.evaluate(() => {
  const g = window.__game, P = g.player;
  for (const w of ['mitrailleur']) if (!P.wapens.includes(w)) P.wapens.push(w);
  if (!P.reserve) P.reserve = 100;
  const meet = (soort) => {
    P.magazijnen[P.wapenSoort] = P.ammo;
    P.zetWapen(soort); P.ammo = Math.max(P.ammo, 3); P.wisselT = 0; P.holster = 0;
    window.__stap(40);                     // alles tot rust
    const beeld = [], hand = [];
    for (let k = 0; k < 3; k++) {
      P.kickPitch = 0; P.zicht.pitch = 0; P.vuurKlok = 0;
      P.shoot();
      beeld.push(P.kickPitch);
      let max = 0;
      for (let i = 0; i < 12; i++) { window.__stap(1, 1 / 60); max = Math.max(max, P.wapen.veer.x); }
      hand.push(max);
      window.__stap(30);
    }
    const gem = (a) => a.reduce((s, x) => s + x, 0) / a.length;
    return { beeld: gem(beeld), hand: gem(hand) };
  };
  const uit = { pistool: meet('pistool'), mitrailleur: meet('mitrailleur'), garand: meet('garand') };
  P.ammo = 8; P.reserve = Math.max(P.reserve, 100);
  return uit;
});
ok(kick.garand.beeld > kick.pistool.beeld * 2 && kick.garand.beeld > kick.mitrailleur.beeld * 2,
  'het beeld schiet bij de M1 meer dan twee keer zo ver omhoog als bij pistool en machinegeweer',
  `M1 ${r3(kick.garand.beeld)}, pistool ${r3(kick.pistool.beeld)}, mg ${r3(kick.mitrailleur.beeld)} rad`);
ok(kick.garand.hand > kick.pistool.hand && kick.garand.hand > kick.mitrailleur.hand,
  'en het wapen in je hand slaat verder omhoog',
  `M1 ${r3(kick.garand.hand)}, pistool ${r3(kick.pistool.hand)}, mg ${r3(kick.mitrailleur.hand)} rad`);

// ------------------------------------------------------------------ 4. acht schoten en de ping
kop('acht schoten, dan de ping');
const acht = await page.evaluate(() => {
  const g = window.__game, P = g.player, G = g.geluid;
  P.zetWapen('garand'); P.ammo = 8; P.wisselT = 0; P.holster = 0;
  window.__stap(10);
  const W = P.wapen;
  const pingVoor = W.pings, geluidVoor = G.m1Pings || 0, schotVoor = P.schoten || 0;
  const zichtbaar = [];
  let pingNaZeven = null;
  for (let i = 0; i < 8; i++) {
    window.__klaar();
    P.shoot();
    window.__stap(1, 0.016);
    zichtbaar.push(W.patronenZichtbaar);
    if (i === 6) { window.__stap(5, 0.02); pingNaZeven = W.pings - pingVoor; }
  }
  window.__stap(4, 0.02);
  const r = {
    schoten: (P.schoten || 0) - schotVoor, ammo: P.ammo, zichtbaar, pingNaZeven,
    pings: W.pings - pingVoor, geluid: (G.m1Pings || 0) - geluidVoor, vliegt: W.clipInDeLucht,
    grendel: W.grendelOpen, clipZit: W.delen.clip.visible,
  };
  // vliegt hij ook echt weg: omhoog en naar rechts, ten opzichte van de camera
  const pos = () => { W.delen.legeClip.updateMatrixWorld(true); const e = W.delen.legeClip.matrixWorld.elements; return [e[12], e[13], e[14]]; };
  P.camera.updateMatrixWorld(true);
  const a = pos();
  window.__stap(8, 0.02);
  P.camera.updateMatrixWorld(true);
  const b = pos();
  const inv = P.camera.matrixWorld.clone().invert().elements;
  const lok = (q) => [inv[0] * q[0] + inv[4] * q[1] + inv[8] * q[2], inv[1] * q[0] + inv[5] * q[1] + inv[9] * q[2]];
  const la = lok(a), lb = lok(b);
  r.wegX = lb[0] - la[0]; r.wegY = lb[1] - la[1];
  // de negende klik
  window.__stap(60);                       // de clip is weg, de grendel staat open
  r.grendelLater = W.grendelOpen; r.clipLater = W.delen.clip.visible;
  const s9 = P.schoten || 0;
  P.vuurKlok = 0; P.reloading = 0;
  P.shoot();
  r.negende = (P.schoten || 0) - s9;
  r.herlaadtNa9 = P.reloading > 0;
  return r;
});
ok(acht.schoten === 8 && acht.ammo === 0, 'acht schoten, dan leeg', `${acht.schoten} schoten, ${acht.ammo} over`);
ok(acht.zichtbaar.join(',') === '7,6,5,4,3,2,1,0', 'in de clip zie je er na elk schot één minder', acht.zichtbaar.join(','));
ok(acht.pingNaZeven === 0, 'na het zevende nog geen ping', `${acht.pingNaZeven}`);
ok(acht.pings === 1 && acht.geluid === 1, 'na het achtste de ping: één keer, en te horen', `model ${acht.pings}, geluid ${acht.geluid}`);
ok(acht.vliegt && !acht.clipZit, 'de lege clip springt uit het wapen', `vliegt ${acht.vliegt}, zit nog ${acht.clipZit}`);
ok(acht.wegY > 0.02 && acht.wegX > 0.005, 'omhoog en naar rechts', `x ${r3(acht.wegX)} m, y ${r3(acht.wegY)} m in 0,16 s`);
ok(acht.grendel > 0.95 && acht.grendelLater > 0.95 && !acht.clipLater, 'de grendel blijft open staan, zonder clip', `${r3(acht.grendel)} → ${r3(acht.grendelLater)}`);
ok(acht.negende === 0, 'een negende klik schiet niet', `${acht.negende} schoten`);
ok(acht.herlaadtNa9, 'maar begint het herladen');

// ------------------------------------------------------------------ 5. herladen
kop('herladen: de clip van boven');
const laad = await page.evaluate(async () => {
  const g = window.__game, P = g.player;
  const { GARAND_HERLAAD } = await import('/js/wapen.js');
  const W = P.wapen;
  if (!(P.reloading > 0)) P.reload();
  const reserveVoor = P.reserve, tel = { ...window.__tel };
  let handGezien = false, clipBoven = 0, grendelOpenTijdensDuw = 1, pingsVoor = W.pings, laadtijd = P.reloading;
  let n = 0;
  while (P.reloading > 0 && n < 400) {
    window.__stap(1, 0.02); n++;
    const t = 1 - P.reloading / GARAND_HERLAAD;
    if (W.delen.laadhand.visible) handGezien = true;
    if (W.delen.clip.visible) clipBoven = Math.max(clipBoven, W.delen.clip.position.y);
    if (t > 0.42 && t < 0.58) grendelOpenTijdensDuw = Math.min(grendelOpenTijdensDuw, W.grendelOpen);
  }
  window.__stap(3);
  return {
    laadtijd, handGezien, clipBoven, grendelOpenTijdensDuw, ammo: P.ammo, reserve: reserveVoor - P.reserve,
    klak: window.__tel.klak - tel.klak, clipIn: window.__tel.clipIn - tel.clipIn, ping: W.pings - pingsVoor,
    grendel: W.grendelOpen, zichtbaar: W.patronenZichtbaar, hand: W.delen.laadhand.visible,
  };
});
ok(laad.laadtijd > 1.8, 'herladen duurt ruim anderhalve seconde', `${r3(laad.laadtijd)} s`);
ok(laad.handGezien && laad.clipBoven > 0.04, 'de hand brengt de clip van boven', `hoogste stand ${r3(laad.clipBoven)} m boven de kast`);
ok(laad.grendelOpenTijdensDuw > 0.95, 'de grendel staat open terwijl de clip erin gaat', r3(laad.grendelOpenTijdensDuw));
ok(laad.clipIn === 1 && laad.klak === 1, 'een klik van de clip en de klak van de grendel', `klik ${laad.clipIn}, klak ${laad.klak}`);
ok(laad.ping === 0, 'een lege grendel herladen geeft geen tweede ping', `${laad.ping}`);
ok(laad.ammo === 8 && laad.reserve === 8 && laad.zichtbaar === 8, 'weer acht in het wapen, acht uit de tas', `${laad.ammo} erin, ${laad.reserve} uit de tas, ${laad.zichtbaar} te zien`);
ok(laad.grendel < 0.05 && !laad.hand, 'grendel dicht, de hand terug aan de greep', `grendel ${r3(laad.grendel)}`);

// ------------------------------------------------------------------ 6. halve clip
kop('herladen met een halve clip');
const half = await page.evaluate(() => {
  const g = window.__game, P = g.player, W = P.wapen;
  for (let i = 0; i < 3; i++) { window.__klaar(); P.shoot(); window.__stap(1); }
  window.__klaar();
  const ammo = P.ammo, reserve = P.reserve, pings = W.pings;
  P.reload();
  let vloog = false;
  for (let i = 0; i < 200 && P.reloading > 0; i++) { window.__stap(1, 0.02); if (W.clipInDeLucht) vloog = true; }
  window.__stap(3);
  return { ammo, na: P.ammo, uitTas: reserve - P.reserve, ping: W.pings - pings, vloog };
});
ok(half.ammo === 5, 'drie schoten: vijf over', `${half.ammo}`);
ok(half.ping === 1 && half.vloog, 'R werpt de halve clip uit, met een ping', `ping ${half.ping}`);
ok(half.na === 8 && half.uitTas === 3, 'en laadt een volle; de vijf gaan terug in de tas', `${half.na} erin, ${half.uitTas} uit de tas`);

// ------------------------------------------------------------------ 7. HUD
kop('in beeld');
const hud = await page.evaluate(() => {
  const g = window.__game, P = g.player;
  try { g.hud.update(0.016, P, g.vehicles, g.npcs, 'Molenkrite'); } catch (e) { return { fout: e.message }; }
  return { tekst: document.getElementById('ammo').textContent, reserve: P.reserve };
});
ok(!hud.fout && hud.tekst === `M1 Garand · 8 / ${hud.reserve}`, 'de naam en de patronen', hud.fout || `"${hud.tekst}"`);

// ------------------------------------------------------------------ 8. opslaan en laden
kop('opslaan en laden');
const opslag = await page.evaluate(async () => {
  const g = window.__game, P = g.player;
  const O = await import('/js/opslag.js');
  P.ammo = 6;
  const gelukt = O.bewaarSpel({ player: P, sfeer: g.sfeer, vehicles: g.vehicles, verhaal: g.verhaal });
  P.wapens = ['pistool', 'mes']; P.zetWapen('pistool');
  const geladen = O.laadSpel({ player: P, sfeer: g.sfeer, vehicles: g.vehicles, verhaal: g.verhaal });
  window.__stap(10);
  const r = { gelukt, geladen, wapens: P.wapens.slice(), soort: P.wapenSoort, ammo: P.ammo };
  for (const k of Object.keys(localStorage)) if (k.startsWith('tinga.spel')) localStorage.removeItem(k);
  return r;
});
ok(opslag.geladen !== false && opslag.wapens.includes('garand'), 'na laden heb je de M1 Garand nog', opslag.wapens.join(', '));
ok(opslag.soort === 'garand' && opslag.ammo === 6, 'in je hand, met de patronen die erin zaten', `${opslag.soort}, ${opslag.ammo}`);

// ------------------------------------------------------------------ 9. shaders
kop('geen nieuwe shader');
const sh = await page.evaluate(async () => {
  const g = window.__game, P = g.player, R = g.renderer;
  if (!R || !g.tekenWapen) return { overgeslagen: true };
  // wachten tot het voorvertalen bij het opstarten klaar is
  for (let i = 0; i < 600 && !(R.info.programs && R.info.programs.length > 20); i++) await new Promise(r => setTimeout(r, 100));
  P.zetWapen('garand'); P.wisselT = 0; P.holster = 0; P.binnen = false; P.wapenUit = false;
  window.__stap(2);
  R.render(g.scene || P.scene, P.camera);
  /*
   Eerst het pistool een keer schieten en herladen: het mondingsvuur en de damp (MeshBasicMaterial) worden in deze
   omgeving bij het eerste schot nog vertaald, ook zonder de M1 (nagemeten 10 okt 2026: 98 → 100 met alleen het
   pistool). Dat is de tegenproef; daarna mag de M1 er niets meer bij doen.
  */
  const wapenRonde = (soort) => {
    P.zetWapen(soort); P.wisselT = 0; P.holster = 0; P.reserve = Math.max(P.reserve, 50);
    window.__stap(2);
    P.ammo = 1; P.vuurKlok = 0; P.shoot();
    for (let i = 0; i < 6; i++) { window.__stap(1, 0.03); P.gun.visible = true; g.tekenWapen(); }
    P.reload();
    for (let i = 0; i < 60; i++) { window.__stap(1, 0.04); P.gun.visible = true; g.tekenWapen(); }
  };
  const begin = R.info.programs.length;
  wapenRonde('pistool');
  const voor = R.info.programs.length;
  P.zetWapen('garand'); P.wisselT = 0; P.holster = 0;
  window.__stap(2);
  wapenRonde('garand');
  window.__pistoolErbij = voor - begin;
  return { voor, na: R.info.programs.length, pistool: window.__pistoolErbij };
});
if (sh.overgeslagen) ok(false, 'geen renderer of tekenWapen in __game');
else ok(sh.na === sh.voor, 'het wapen tekenen vertaalt geen nieuwe shader', `${sh.voor} → ${sh.na} programma's (het pistool ervoor: +${sh.pistool})`);

await page.evaluate(() => { const P = window.__game.player; P.shootCb = window.__shootCb; });
await browser.close();
console.log(fouten ? `\n${fouten} fout` : '\nalles goed');
process.exit(fouten ? 1 : 0);
