/*
 Stap 127: de wensen van 9 en 10 okt 2026, nagemeten.

   node tools/server.mjs 8123 &   node tools/wensentest.mjs [poort]   (npm run wensentest)

 1. De geluiden van de gebruiker: explosie, heli, twee achtergronden (dag en nacht), de portofoon bij de eerste ster
    (een kort willekeurig stuk, in en uit), en het muziekje in de heli dat opnieuw begint.
 2. Missie 18 in de heli: het wapen in beeld, kogels die niet opraken, de wieken luider.
 3. Bouwman rijdt harder, in de heli en in de achtervolging; de handlangers: twee auto's, later twee scooters,
    ze schieten, en wie neergaat schiet niet meer.
 4. Het gevecht bij de loods is zwaarder: zes bodyguards, taaier, drie machinegeweren, plekken buiten de muren;
    zonder kogels gooit Johan je een doos toe.
 5. De Dúvelsrak: de knal klinkt (opname, harder) en de camera schudt fors; daarna de route naar Radio Tinga.
 6. Het einde: om tien uur, vuurwerk, en het muziekje van de intro.
 7. De Ferrari van binnen: kuipstoelen onder het dak, geen achterbank, leer, koolstof en het gele schildje.
 8. Je auto bij huis: niet op een andere auto, en op de grond.
 9. Voetbal: aannemen, dribbelen, afpakken, overspelen naar iemand die de bal gaat halen.
10. De mouw van het wapen en het mes eindigt achter de camera.
11. De drone komt buiten bereik snel terug, ook vanzelf.
12. Volledig scherm in de instellingen, F11 in de besturing, geen menu Wijk in de app.
13. Opgeslagen spellen: meer dan één, met de missie en het moment van de dag; Spel laden geeft de lijst.
14. De BP: een vloer onder de luifel, waar de kaart een gat had.
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
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
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

const wacht = (ms) => new Promise(r => setTimeout(r, ms));

// ------------------------------------------------------------------ 1. de geluiden
kop('de geluiden van de gebruiker');
const gl = await page.evaluate(async () => {
  const g = window.__game, G = g.geluid;
  G.start();
  await G.laadOpnames();
  const uit = { opnames: G.opnameStand() };
  // de achtergrond: overdag de lange, 's nachts de korte
  G.omgeving(0.1, { nacht: false });
  for (let i = 0; i < 30; i++) { G.omgeving(0.1, { nacht: false }); await new Promise(r => setTimeout(r, 30)); }
  uit.dag = G.achtergrondStand();
  for (let i = 0; i < 60; i++) { G.omgeving(0.1, { nacht: true }); await new Promise(r => setTimeout(r, 30)); }
  uit.nacht = G.achtergrondStand();
  G.omgeving(0.1, { nacht: true, binnen: true });
  await new Promise(r => setTimeout(r, 300));
  uit.binnen = G.achtergrondStand();
  // de explosie
  const e0 = G.explosieTeller; G.explosie(5); G.explosie(30, 2.2); uit.knallen = G.explosieTeller - e0;
  // de portofoon: bij de eerste ster, niet bij de tweede
  g.politie.reset(); g.politie.update(0.1);
  const r0 = G.politieRadioTeller;
  g.politie.zetSter(1, g.player.pos.x + 30, g.player.pos.z); g.politie.update(0.1);
  uit.radioEerste = G.politieRadioTeller - r0;
  uit.radio = G.laatsteRadio;
  g.politie.zetSter(2, g.player.pos.x + 30, g.player.pos.z); g.politie.update(0.1);
  uit.radioTweede = G.politieRadioTeller - r0;
  g.politie.reset(); g.politie.update(0.1);
  // de politieheli met de opname, zachter en doffer op afstand
  G.heli(20); await new Promise(r => setTimeout(r, 600)); uit.heliDicht = G.heliStand();
  G.heli(250); await new Promise(r => setTimeout(r, 1500)); uit.heliVer = G.heliStand();
  G.heli(null);
  return uit;
});
ok(gl.opnames.explosie > 2.5 && gl.opnames.heli > 9 && gl.opnames.politieRadio > 30, 'de opnames zijn binnen', JSON.stringify(gl.opnames));
ok(gl.dag && gl.dag.dag.bestand === 'achtergrond1.mp3' && gl.dag.dag.aan && !gl.dag.dag.stuk && gl.dag.dag.volume > 0.1, 'overdag de lange achtergrond', JSON.stringify(gl.dag && gl.dag.dag));
ok(gl.nacht && gl.nacht.nacht.aan && gl.nacht.nacht.volume > 0.1 && gl.nacht.dag.volume < 0.1, "'s nachts de korte, de dag vloeit weg", `${JSON.stringify(gl.nacht.nacht)} / dag ${gl.nacht.dag.volume}`);
ok(gl.binnen && gl.binnen.filter < 2000, 'binnen doffer', String(gl.binnen && gl.binnen.filter));
ok(gl.knallen === 2, 'de explosie speelt de opname', `${gl.knallen}`);
ok(gl.radioEerste === 1 && gl.radioTweede === 1 && gl.radio && gl.radio.duur >= 5 && gl.radio.duur <= 8 && gl.radio.in <= 0.5 && gl.radio.uit <= 1,
  'de eerste ster: een kort stuk portofoon, met een korte fade; de tweede ster niet nog eens', JSON.stringify(gl.radio));
ok(gl.heliDicht && gl.heliDicht.opname && gl.heliVer && gl.heliVer.volume < gl.heliDicht.volume * 0.5 && gl.heliVer.filter < gl.heliDicht.filter,
  'de heli: de opname, op afstand zachter en doffer', `${JSON.stringify(gl.heliDicht)} → ${JSON.stringify(gl.heliVer)}`);

// ------------------------------------------------------------------ 2. de heli van missie 18
kop('missie 18: de heli');
const hl = await page.evaluate(async () => {
  const g = window.__game, v = g.verhaal, P = g.player, G = g.geluid;
  window.__bij('heli');
  window.__stap(40);
  const uit = { fase: v.fase, gun: !!(P.gun && P.gun.visible), oneindig: P.oneindig, muziek: v.avond.muziek(), afstand: v.avond.heliAfstand() };
  P.wisselWapen && P.wapenUit && P.wisselWapen();
  const a0 = P.ammo, r0 = P.reserve;
  for (let i = 0; i < 25; i++) { P.vuurKlok = 0; P.shoot(); window.__stap(1); }
  uit.ammo = [a0, P.ammo, r0, P.reserve];
  await new Promise(r => setTimeout(r, 800));
  window.__stap(5);
  uit.rotor = G.heliRondStand();
  uit.tops = v.avond.tops;
  // hoe hard Bouwman rijdt met de heli boven zich (gemeten over 20 s)
  let vmax = 0, s0 = v.avond.rit ? v.avond.rit.s : 0;
  for (let i = 0; i < 400 && (v.fase === 'heli' || v.fase === 'heliStart'); i++) { window.__stap(1); const r = v.avond.rit; if (r) vmax = Math.max(vmax, r.v); }
  uit.vmax = vmax; uit.weg = (v.avond.rit ? v.avond.rit.s : 0) - s0;
  return uit;
});
ok((hl.fase === 'heli' || hl.fase === 'heliStart') && hl.gun, 'in de deur van de heli: je wapen in beeld', `${hl.fase}, wapen ${hl.gun}`);
ok(hl.oneindig && hl.ammo[1] === hl.ammo[0] && hl.ammo[3] === hl.ammo[2], 'kogels raken niet op', JSON.stringify(hl.ammo));
ok(hl.muziek && hl.afstand <= 3, 'het muziekje, en de wieken van dichtbij', `${hl.muziek}, ${hl.afstand}`);
ok(hl.rotor && hl.rotor.volume > 0.3, 'de wieken luid (de opname, ruim boven de politieheli)', JSON.stringify(hl.rotor));
ok(hl.vmax > 18 && hl.tops.heli >= 20, 'Bouwman rijdt onder de heli harder dan 65 km/u', `${(hl.vmax * 3.6).toFixed(0)} km/u, ${hl.weg.toFixed(0)} m`);

// ------------------------------------------------------------------ 3. de achtervolging
kop('de achtervolging en de handlangers');
const av = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player, W = window.__W;
  window.__bij('naarAuto');
  window.__klik();
  const a = v.avond;
  P.inCar = a.auto; a.auto.speed = 0;
  window.__stap(2);
  const uit = { fase: v.fase, oneindig: P.oneindig };
  const H = v.avond.handlangers;
  uit.autos = H.mannen.filter(m => m.soort === 'auto').length;
  // de speler rijdt mee, net achter de laatste handlanger
  let vmax = 0, schoten0 = H.schoten, minHp = 100, scooters = false, scooterNa = null;
  for (let i = 0; i < 3600 && v.fase === 'achtervolging'; i++) {
    const r = v.avond.rit;
    const B = v.avond.B;
    const ach = H.mannen.length ? Math.min(...H.mannen.map(m => m.s)) : r.s;
    const sP = Math.max(0, ach - 28), k = Math.min(B.n - 1, Math.round(sP / 2));
    a.auto.x = B.x[k]; a.auto.z = B.z[k]; a.auto.speed = r.v;
    if (a.auto.mesh) a.auto.mesh.position.set(B.x[k], W.grondHoogte(B.x[k], B.z[k]), B.z[k]);
    P.health = 100;
    window.__stap(1, 0.05);
    vmax = Math.max(vmax, r.v);
    if (!scooters && H.scootersErbij) { scooters = true; scooterNa = r.s / r.lengte; }
  }
  uit.vmax = vmax; uit.schoten = H.schoten - schoten0; uit.raak = H.raak;
  uit.scooters = H.mannen.filter(m => m.soort === 'scooter').length; uit.scooterNa = scooterNa;
  uit.eind = v.fase;
  return uit;
});
ok(av.fase === 'achtervolging' && av.oneindig, 'in de auto: de achtervolging, en kogels die niet opraken', `${av.fase}`);
ok(av.autos === 2, "twee auto's met handlangers achter Bouwman", `${av.autos}`);
ok(av.vmax > 28, 'Bouwman rijdt harder dan 100 km/u', `${(av.vmax * 3.6).toFixed(0)} km/u`);
ok(av.schoten > 10 && av.raak > 0, 'de handlangers schieten op je, en raken soms', `${av.schoten} schoten, ${av.raak} raak`);
ok(av.scooters === 2 && av.scooterNa > 0.4, 'later op de weg twee scooters erbij', `${av.scooters} na ${((av.scooterNa || 0) * 100).toFixed(0)} %`);
ok(av.eind === 'gevecht', 'bij de loods: het gevecht', av.eind);
const hd = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, H = v.avond.handlangers;
  // na het gevecht-begin: niemand schiet meer
  const s0 = H.schoten;
  for (let i = 0; i < 100; i++) H.update(0.05, { bouwman: { s: 0, v: 0 }, speler: { x: H.mannen[0].auto.x + 5, z: H.mannen[0].auto.z, v: 0 } });
  const stil = H.schoten === s0;
  // en wie neergaat schiet niet meer: opnieuw beginnen, een auto stuk
  H.start(v.avond.B, 60);
  const m = H.mannen[0];
  m.auto.hp = 0;
  const s1 = H.schoten;
  for (let i = 0; i < 200; i++) H.update(0.05, { bouwman: { s: 80, v: 10 }, speler: { x: m.auto.x + 8, z: m.auto.z, v: 0 } });
  const dood = m.dood, vanM = H.mannen.indexOf(m);
  const rest = H.schoten - s1;
  H.ruim();
  return { stil, dood, rest, leeg: H.mannen.length === 0 };
});
ok(hd.stil, 'bij de loods schieten de handlangers niet meer');
ok(hd.dood && hd.leeg, 'een handlanger met een kapotte auto ligt eruit, en opruimen haalt ze weg', JSON.stringify(hd));

// ------------------------------------------------------------------ 4. het gevecht
kop('het gevecht bij de loods');
const gv = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player, W = window.__W;
  window.__bij('gevecht');
  window.__stap(2);
  const M = v.avond.mannen, a = v.avond;
  const posten = a.posten.map(([p, q]) => [p, q].map(([x, z]) => { const [rx, rz] = W.resolveCollisions(x, z, 0.4); return Math.hypot(rx - x, rz - z); }));
  const uit = { fase: v.fase, man: M ? M.wachters.length : 0, leven: a.leven, mg: a.mg, duw: Math.max(...posten.flat()) };
  // geen kogels: Johan gooit een doos
  P.inCar = null;
  for (const w of P.wapens) P.magazijnen[w] = 0;
  P.ammo = 0; P.reserve = 0;
  window.__stap(30);
  uit.naLeeg = P.reserve;
  return uit;
});
ok(gv.fase === 'gevecht' && gv.man === 7, 'Bouwman en zes bodyguards', `${gv.man}`);
ok(gv.leven[0] >= 5 && gv.leven.slice(1).every(l => l >= 4) && gv.mg.length === 3, 'taaier: Bouwman vijf treffers, de rest vier, drie machinegeweren', `${gv.leven.join(',')}, mg ${gv.mg.join(',')}`);
ok(gv.duw < 0.05, 'alle plekken liggen buiten de muren', `${gv.duw.toFixed(2)} m`);
ok(gv.naLeeg > 0, 'zonder kogels: Johan gooit je een doos toe', `${gv.naLeeg}`);

// ------------------------------------------------------------------ 5. de Dúvelsrak en de route naar Radio Tinga
kop('de Dúvelsrak');
const br = await page.evaluate(async () => {
  const g = window.__game, v = g.verhaal, P = g.player, G = g.geluid;
  window.__bij('politie');
  const a = v.avond, B = a.brugAssen, auto = a.auto;
  const p = B.p(4, 0);
  auto.yaw = B.noord; auto.x = p.x; auto.z = p.z; auto.speed = 17;
  if (auto.mesh) { auto.mesh.visible = true; auto.mesh.position.set(p.x, B.hoogte, p.z); auto.mesh.rotation.y = B.noord; }
  P.inCar = auto;
  window.__stap(1);
  const e0 = G.explosieTeller;
  let schud = 0, film = v.fase;
  for (let t = 0; t < 12 && v.fase === 'brugFilm'; t += 0.05) { window.__stap(1, 0.05); schud = Math.max(schud, v.avond.schud); }
  const knal = G.explosieTeller - e0;
  window.__klik();
  window.__tot('naarStudio', 25);
  window.__stap(50, 0.05);
  const nav = g.hud.nav;
  const { Navigatie } = await import('/js/navigatie.js');
  const st = v.uitzending.studio;
  const N = new Navigatie(window.__K.wegassen);
  const r = N.route([P.pos.x, P.pos.z], [st.plekken.stoep.x, st.plekken.stoep.z]);
  const eind = r ? r[r.length - 2] : null;
  return { film, schud, knal, fase: v.fase, nav: nav && { naam: nav.naam, n: nav.route ? nav.route.length : 0 },
    eindAfstand: eind ? Math.hypot(eind[0] - st.plekken.stoep.x, eind[1] - st.plekken.stoep.z) : null };
});
ok(br.film === 'brugFilm' && br.knal >= 1, 'de C4 op het dek: een knal', `${br.knal}`);
ok(br.schud > 0.3, 'de camera schudt fors', `${br.schud.toFixed(2)} m`);
ok(br.fase === 'naarStudio' && br.nav && br.nav.naam === 'Radio Tinga' && br.nav.n > 5, 'daarna: de navigatie naar Radio Tinga heeft een route', JSON.stringify(br.nav));
ok(br.eindAfstand !== null && br.eindAfstand < 120, 'de route eindigt dicht bij de stoep (het voetpad sluit nergens op aan)', `${br.eindAfstand && br.eindAfstand.toFixed(0)} m`);

// ------------------------------------------------------------------ 6. het einde
kop('het einde: vuurwerk en het muziekje');
const ei = await page.evaluate(async () => {
  const g = window.__game, v = g.verhaal, G = g.geluid;
  const s = v.bewaar(); s.missie = 'uitzending'; s.fase = 'avond'; s.uitzendingKlaar = true;
  g.politie.reset(); v.herstel(s);
  window.__stap(2);
  const vw = v.avond.vuurwerk;
  const uit = { uur: g.sfeer.uur, film: v.uitzending.film, actief: vw.actief, muziek: v.avond.muziek() };
  for (let i = 0; i < 160; i++) window.__stap(1, 0.05);
  uit.pijlen = vw.pijlen; uit.bollen = vw.bollen; uit.vonken = vw.aantal; uit.zicht = vw.mesh.visible;
  uit.heliMuz = G.heliMuziekStand();
  return uit;
});
ok(Math.abs(ei.uur - 22) < 0.2 && ei.film === 'einde', 'het einde om tien uur', `${ei.uur.toFixed(2)}, ${ei.film}`);
ok(ei.actief && ei.pijlen >= 4 && ei.bollen >= 2 && ei.vonken > 50 && ei.zicht, 'vuurwerk de lucht in', `${ei.pijlen} pijlen, ${ei.bollen} open, ${ei.vonken} vonken`);
ok(ei.muziek && ei.heliMuz && ei.heliMuz.aan, 'het muziekje van de intro speelt', JSON.stringify(ei.heliMuz && { aan: ei.heliMuz.aan, bestand: ei.heliMuz.bestand }));

// ------------------------------------------------------------------ 7. de Ferrari van binnen
kop('de Ferrari van binnen');
const fe = await page.evaluate(async () => {
  const { makeCar, autoMaat } = await import('/js/carmodel.js');
  const THREE = await import('/lib/three.module.js');
  const m = makeCar(0xc81e1e, 'ferrari', true);
  const b = m.userData.binnen;
  b.groep.visible = true;
  m.updateMatrixWorld(true);
  const bak = m.userData.bak;
  const doos = new THREE.Box3();
  let hoogst = -Infinity, stof = 0, leer = 0, carbon = 0, geel = 0;
  const kleuren = new Set();
  // (kleuren met een marge: three rekent ze om naar lineair en terug)
  const is = (c, h) => [16, 8, 0].every(k => Math.abs(((c >> k) & 255) - ((h >> k) & 255)) <= 2);
  b.groep.traverse(o => {
    if (!o.isMesh) return;
    doos.setFromObject(o);
    const c = o.material.color ? o.material.color.getHex() : 0;
    if (is(c, 0x646975)) stof++;
    if (is(c, 0x8a1717)) { leer++; hoogst = Math.max(hoogst, doos.max.y - bak.position.y); }
    if (is(c, 0x26282d)) carbon++;
    if (is(c, 0xf2c418)) geel++;
  });
  const dak = m.userData.oog ? null : null;
  return { stof, leer, carbon, geel, hoogst, dakY: 1.15 };
});
ok(fe.stof === 0, 'geen stoffen stoelen en geen achterbank meer', `${fe.stof}`);
ok(fe.leer >= 4 && fe.carbon >= 4 && fe.geel >= 1, 'rood leer, koolstof en het gele schildje', `${fe.leer} leer, ${fe.carbon} koolstof, ${fe.geel} geel`);
ok(fe.hoogst < fe.dakY - 0.04, 'de stoelen blijven onder het dak', `${fe.hoogst.toFixed(2)} m tegen ${fe.dakY} m`);

// ------------------------------------------------------------------ 8. je auto bij huis
kop('je auto bij huis');
const hu = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player, W = window.__W, V = g.vehicles;
  window.__na17();
  window.__stap(2);
  const t = v.thuisDoel;
  const o = t.w.plekken.oprit;
  // een andere auto op de oprit, en jij komt in een Ferrari die hoog in de lucht hangt (van het viaduct)
  const ander = V.voegToe({ x: o.x, z: o.z, yaw: o.yaw, soort: 'hatch', kleur: 0x335577 });
  V.zetNeer(ander, 0, o.yaw);
  const fer = V.voegToe({ x: o.x + 40, z: o.z, yaw: 0, soort: 'ferrari', kleur: 0xc81e1e });
  fer.mesh.position.y = 5.6;
  P.inCar = fer;
  v.springNaarHuis();
  for (let i = 0; i < 10; i++) { V.zetNeer(fer, 0.05, fer.yaw); }
  const d = Math.hypot(fer.x - ander.x, fer.z - ander.z);
  const grond = W.grondHoogte(fer.x, fer.z);
  const uit = { d, y: fer.mesh.position.y - grond, uit: !P.inCar, naarHuis: Math.hypot(fer.x - o.x, fer.z - o.z) };
  V.verwijder(ander); V.verwijder(fer);
  return uit;
});
ok(hu.uit && hu.d > 3, 'je auto komt niet op de auto die er al stond', `${hu.d.toFixed(1)} m ertussen`);
ok(Math.abs(hu.y) < 0.6 && hu.naarHuis < 12, 'en staat op de grond, vlak bij de oprit', `${hu.y.toFixed(2)} m boven de grond, ${hu.naarHuis.toFixed(1)} m van de oprit`);

// ------------------------------------------------------------------ 9. voetbal
kop('voetbal');
const vb = await page.evaluate(() => {
  const g = window.__game, w = g.wedstrijd, V = w.veld, P = g.player;
  g.sfeer.uur = 13; w.st.dag = -1;
  const kijk = (x, z, kx, kz) => { P.inCar = null; P.pos.set(x, 0, z); P.yaw = Math.atan2(-(kx - x), -(kz - z)); P.pitch = 0; P.applyCamera(); g.camera.updateMatrixWorld(); };
  kijk(V.cx + 600, V.cz + 600, V.cx + 1200, V.cz + 1200);
  g.werkWedstrijdBij(0.1); g.werkWedstrijdBij(0.1);
  kijk(V.cx - 80, V.cz - 80, V.cx - 200, V.cz - 200);
  const s0 = { ...w.st };
  let bijBal = 0, n = 0, metBal = 0, richting = 0, rn = 0, links = 0, rechts = 0;
  const vorig = new Map();
  // tien minuten, net als tools/wedstrijdtest.mjs (een schot valt er een paar keer per tien minuten)
  for (let i = 0; i < 6000; i++) {
    g.werkWedstrijdBij(0.1);
    if (i % 5) continue;
    n++;
    const d = Math.min(...w.spelers.filter(s => !s.keeper).map(s => Math.hypot(s.u - w.bal.u, s.v - w.bal.v)));
    if (d < 1.5) bijBal++;
    if (w.bal.bezit) metBal++;
    // lopen ze allemaal dezelfde kant op? het gemiddelde van hun looprichting langs het veld
    let som = 0, k = 0;
    for (const s of w.spelers) { const p = vorig.get(s); if (p) { const du = s.u - p; if (Math.abs(du) > 0.05) { som += Math.sign(du); k++; } } vorig.set(s, s.u); }
    if (k > 4) { richting += Math.abs(som) / k; rn++; }
    if (w.bal.u > 0) rechts++; else links++;
  }
  return { aangenomen: (w.st.aangenomen || 0) - (s0.aangenomen || 0), afgepakt: (w.st.afgepakt || 0) - (s0.afgepakt || 0),
    passes: w.st.passes - s0.passes, schoten: w.st.schoten - s0.schoten, bijBal: bijBal / n, metBal: metBal / n, eenKant: richting / Math.max(1, rn), helften: Math.min(links, rechts) / Math.max(1, links + rechts) };
});
ok(vb.aangenomen > 20 && vb.passes > 15, 'de bal wordt aangenomen en overgespeeld', `${vb.aangenomen} aangenomen, ${vb.passes} passes, ${vb.schoten} schoten`);
ok(vb.afgepakt > 2, 'de tegenstander zet druk en pakt de bal af', `${vb.afgepakt} keer`);
ok(vb.bijBal > 0.45 && vb.metBal > 0.3, 'er is bijna altijd iemand bij de bal, en vaak heeft iemand hem aan de voet', `${(vb.bijBal * 100).toFixed(0)} % bij de bal, ${(vb.metBal * 100).toFixed(0)} % in bezit`);
// (samen één kant op lopen is voetbal: wie aanvalt schuift op, de ander zakt terug; wat telt is dat de bal heen en weer gaat)
ok(vb.helften > 0.2 && vb.schoten >= 3, 'de bal gaat beide helften in, en er wordt geschoten', `${(vb.helften * 100).toFixed(0)} % in de kleinste helft, ${vb.schoten} schoten, ${(vb.eenKant * 100).toFixed(0)} % van de lopers dezelfde kant op`);

// ------------------------------------------------------------------ 10. de mouw
kop('de mouw van het wapen en het mes');
const mw = await page.evaluate(async () => {
  const g = window.__game, P = g.player, THREE = await import('/lib/three.module.js');
  const uit = {};
  for (const w of ['pistool', 'mes']) {
    const mod = P.modellen[w];
    if (!mod) continue;
    mod.groep.updateMatrixWorld(true);
    // het verst naar achteren van alles in stof (de mouw), in de assen van de camera
    let achter = -Infinity;
    const inv = new THREE.Matrix4().copy(g.camera.matrixWorld).invert();
    const v3 = new THREE.Vector3();
    mod.groep.traverse(o => {
      if (!o.isMesh || !o.visible) return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) { v3.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv); achter = Math.max(achter, v3.z); }
    });
    uit[w] = achter;
  }
  return uit;
});
ok(mw.pistool > 0.05, 'de mouw bij het pistool loopt tot achter de camera', `${mw.pistool && mw.pistool.toFixed(2)} m`);
ok(mw.mes > 0.05, 'de mouw bij het mes ook', `${mw.mes && mw.mes.toFixed(2)} m`);

// ------------------------------------------------------------------ 11. de drone
kop('de drone komt terug in bereik');
const dr = await page.evaluate(() => {
  const g = window.__game, P = g.player, D = g.drone;
  window.__na17(); window.__stap(2);
  P.drone = true; P.inCar = null; P.binnen = false; P.health = 100;
  if (D.actief) D.terug && D.terug('proef');
  D.start();
  // 860 m van Erik, niets aanraken
  D.pos.set(P.pos.x + 860, 30, P.pos.z);
  P.keys = {};
  let t = 0;
  while (D.actief && D.buiten() && t < 15) { D.update(0.05); t += 0.05; }
  const vanzelf = t;
  // met W naar Erik toe: hoe hard
  D.pos.set(P.pos.x + 860, 30, P.pos.z);
  P.yaw = Math.PI / 2;          // kijkt naar −x, naar Erik
  P.keys = { KeyW: true };
  let vmax = 0, t2 = 0;
  while (D.actief && D.buiten() && t2 < 15) { const x0 = D.pos.x; D.update(0.05); vmax = Math.max(vmax, Math.abs(D.pos.x - x0) / 0.05); t2 += 0.05; }
  P.keys = {};
  const binnen = D.actief && !D.buiten();
  D.terug && D.terug('proef');
  return { vanzelf, metW: t2, vmax, binnen };
});
ok(dr.vanzelf < 6, 'zonder sturen drijft hij binnen een paar tellen terug in bereik', `${dr.vanzelf.toFixed(1)} s`);
ok(dr.vmax > 40 && dr.metW < 3 && dr.binnen, 'met W naar Erik toe gaat hij hard terug', `${dr.vmax.toFixed(0)} m/s, ${dr.metW.toFixed(1)} s`);

// ------------------------------------------------------------------ 12. volledig scherm en het appmenu
kop('volledig scherm en het menu van de app');
const vs = await page.evaluate(() => {
  const g = window.__game;
  document.getElementById('overlay').style.display = 'flex';
  document.getElementById('menuInstellingen').click();
  const knop = document.getElementById('instel_volledig');
  const uit = { knop: !!knop, tekst: knop ? knop.textContent : '' };
  document.getElementById('menuBesturing').click();
  uit.f11 = /F11/.test(document.querySelector('.menuzij').textContent);
  document.getElementById('overlay').style.display = 'none';
  return uit;
});
const { readFileSync } = await import('node:fs');
const app = readFileSync(new URL('../desktop/main.cjs', import.meta.url), 'utf8');
ok(vs.knop && /aan|uit/.test(vs.tekst), 'Instellingen: Volledig scherm', vs.tekst);
ok(vs.f11, 'Besturing: F11');
ok(!/label: 'Wijk'/.test(app) && /setFullScreen/.test(app) && /F11/.test(app), "de app: geen menu Wijk meer, F11 en volledig scherm");

// ------------------------------------------------------------------ 13. opgeslagen spellen
kop('opgeslagen spellen');
const os = await page.evaluate(async () => {
  const g = window.__game, v = g.verhaal, P = g.player;
  const O = await import('/js/opslag.js');
  for (let n = 1; n <= 15; n++) localStorage.removeItem(n === 1 ? 'tinga.spel.v1' : `tinga.spel.v1.${n}`);
  O.kiesPlek(1);
  window.__na17(); window.__stap(2);
  g.sfeer.uur = 9.25;
  P.active = true;
  g.opslaan();
  // een nieuw spel, verder in het verhaal
  O.startNieuwSpel();
  window.__bij('heli'); window.__stap(2);
  // (in de heli mag het niet: dan eerst eruit, vrij spelen na het einde)
  const s = v.bewaar(); s.missie = 'klaar'; s.fase = 'klaar'; s.uitzendingKlaar = true; v.herstel(s); window.__stap(2);
  g.sfeer.uur = 21.5;
  g.opslaan();
  P.active = false;
  const lijst = O.opslagen();
  // het menu: Spel laden geeft de lijst
  document.getElementById('overlay').style.display = 'flex';
  g.pauzeer ? null : null;
  const menu = await import('/js/menu.js');
  menu.toonMenu({ pauze: false, heeftOpslag: true, opslag: O.opslagInfo(), staat: 'ok' });
  document.getElementById('menuLaden').click();
  const knoppen = [...document.querySelectorAll('.opslagplek')].map(b => ({ plek: +b.dataset.plek, tekst: b.textContent }));
  // kiezen zet die plek klaar
  if (knoppen.length > 1) { const b = document.querySelector(`.opslagplek[data-plek="${lijst[1].plek}"]`); b.dispatchEvent(new MouseEvent('click')); }
  const gekozen = O.actievePlek();
  menu.verbergMenu();
  document.getElementById('overlay').style.display = 'none';
  return { lijst: lijst.map(o => ({ plek: o.plek, missie: o.missie, uur: o.uur })), knoppen, gekozen, verwacht: lijst[1] && lijst[1].plek };
});
ok(os.lijst.length === 2 && os.lijst[0].plek !== os.lijst[1].plek, 'twee spellen, elk op een eigen plek', JSON.stringify(os.lijst));
ok(os.lijst.every(o => o.missie), 'met de missie erbij', os.lijst.map(o => o.missie).join(' / '));
ok(os.knoppen.length === 2 && os.knoppen.every(k => /\d\d:\d\d/.test(k.tekst) && /(ochtend|middag|avond|nacht)/.test(k.tekst)),
  'Spel laden geeft de lijst, met het moment van de dag', os.knoppen.map(k => k.tekst).join(' | '));
ok(os.gekozen === os.verwacht, 'kiezen zet dat spel klaar om te laden', `${os.gekozen} / ${os.verwacht}`);

// ------------------------------------------------------------------ 14. de BP
kop('de BP');
const bp = await page.evaluate(async () => {
  const g = window.__game, K = window.__K, THREE = await import('/lib/three.module.js');
  const s = K.tankstations[0];
  let vloer = null;
  g.scene.traverse(o => { if (o.isMesh && o.geometry.parameters && Math.abs(o.geometry.parameters.height - 0.06) < 1e-6 && o.parent && Math.abs(o.parent.position.x - s.cx) < 0.1) vloer = o; });
  if (!vloer) return { vloer: false };
  vloer.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(vloer);
  // de gaten van vóór deze stap (gemeten met een straal recht naar beneden, stap 127)
  const gaten = [[-12, 3], [-10, -5], [-10, 0], [-7, 3], [8, 0], [10, -2], [10, 5], [13, -2]];
  const gedekt = gaten.filter(([dx, dz]) => b.containsPoint(new THREE.Vector3(s.cx + dx, (b.min.y + b.max.y) / 2, s.cz + dz))).length;
  return { vloer: true, gedekt, n: gaten.length, top: b.max.y, zicht: vloer.visible };
});
ok(bp.vloer && bp.zicht && bp.gedekt === bp.n && bp.top < 0.1, 'een vloer onder de luifel, over de gaten in de kaart', JSON.stringify(bp));

console.log(fouten ? `\n${fouten} fout(en)` : '\nAlles goed.');
await browser.close();
process.exit(fouten ? 1 : 0);
