/*
 Missie 11: de politieauto en de C4 (verzoek 26 sep 2026).

   node tools/server.mjs 8123 &   node tools/politieautotest.mjs [poort]

 De missie, in de volgorde waarin je hem speelt:

 1. Na missie 10 gaat er geen telefoon: er staat alleen een M bij Molenkrite 15.
 2. Binnen zit Mark op de bank en begint vanzelf: De Veteraan moet uitgeschakeld
    worden, het is niet meer veilig op straat, hij heeft een idee — steel een
    politieauto aan de Lemmerweg en haal de C4 bij Tinga State.
 3. De politieauto staat aan de Lemmerweg, aan de kant van de rijbaan, niet in een
    botsdoos, met de lichtbalk erop. Instappen kost twee sterren, en zolang je
    gezocht wordt gaat de missie niet verder.
 4. Aan de balie van Tinga State zegt de verkoper dat Mark al gebeld had: vier
    stuks verse C4, gratis.
 5. De auto en de C4 bij Molenkrite 15: geslaagd, € 1.000, en Mark zegt dat hij
    binnen zijn plan vertelt.

 En daaromheen: shift+min start de missie los, een opgeslagen spel midden in de
 missie hervat hem, en een kapotte politieauto is een mislukte missie.
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
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 600000 });
await page.waitForFunction(() => window.__game, null, { timeout: 600000 });
await page.evaluate(async () => {
  const { geluid } = await import('/js/audio.js');
  localStorage.removeItem('tinga.spel.v1');
  localStorage.removeItem('tinga.checkpoint.v1');
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  geluid.start();
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) g.verhaal.update(dt); };
  window.__balkDicht = () => document.getElementById('dialoog').hidden;
  window.__gesprek = (max = 40) => {
    const regels = [];
    for (let i = 0; i < max && !window.__balkDicht(); i++) {
      regels.push({ wie: document.getElementById('dialoogNaam').textContent,
        tekst: document.getElementById('dialoogTekst').textContent,
        telefoon: document.getElementById('dialoog').classList.contains('telefoon') });
      g.praat();
      window.__stap(2);
    }
    return regels;
  };
  window.__nav = () => (g.hud.nav ? { letter: g.hud.nav.letter, x: g.hud.nav.doel[0], z: g.hud.nav.doel[1] } : null);
  window.__zet = (x, z) => { g.player.inCar = null; g.player.pos.set(x, 0, z); g.player.applyCamera(); };
});

// --------------------------------------------- na missie 10: alleen een M
kop('na missie 10: een M, geen telefoon');
const begin = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  // missie 10 afronden: thuis aankomen in het gekochte huis
  v.herstel({ missie: 'veteraan', fase: 'naar_huis', huis: 'Koningsspil 20', geld: 0 });
  window.__stap(4);
  const t = v.thuisDoel;
  window.__zet(t.deur.x + 1, t.deur.z);
  window.__stap(6);
  const na10 = { missie: v.missie, volgende: v.volgendeMissie };
  // en dan wachten tot de M er staat
  let telefoon = false, t0 = -1;
  for (let i = 0; i < 400; i++) {
    v.update(0.1);
    if (!window.__balkDicht() && document.getElementById('dialoog').classList.contains('telefoon')) telefoon = true;
    if (v.missie === 'politieauto') { t0 = i * 0.1; break; }
  }
  window.__stap(4);
  const deur = g.woningen[0].plekken.deurBuiten, nav = window.__nav();
  return { na10, t0, telefoon, missie: v.missie, fase: v.fase, nav, navD: nav ? Math.hypot(nav.x - deur.x, nav.z - deur.z) : -1,
    balk: window.__balkDicht(), opdracht: document.getElementById('opdracht').textContent, mark: v.mark.groep.visible };
});
ok(begin.na10.missie === 'klaar' && begin.na10.volgende && begin.na10.volgende.naam === 'politieauto',
  'na missie 10 staat missie 11 klaar', JSON.stringify(begin.na10.volgende));
ok(begin.missie === 'politieauto' && begin.fase === 'wacht' && begin.t0 >= 0, 'even later begint hij', `na ${begin.t0.toFixed(1)} s`);
ok(!begin.telefoon && begin.balk, 'zonder telefoontje');
ok(begin.nav && begin.nav.letter === 'M' && begin.navD < 3 && /Molenkrite 15/.test(begin.opdracht),
  'maar met een M bij Molenkrite 15', `${begin.opdracht} · ${begin.navD.toFixed(1)} m van de voordeur`);
ok(!begin.mark, 'Mark staat niet buiten: hij zit binnen');

// --------------------------------------------------- binnen bij Mark
kop('binnen: Mark op de bank');
const binnen = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, w = g.woningen[0];
  window.__zet(w.plekken.deurBinnen.x, w.plekken.deurBinnen.z);
  window.__stap(3);
  const bank = w.plekken.bank, m = v.mark.groep.position;
  const opBank = Math.hypot(m.x - bank.x, m.z - bank.z);
  // hoe hij zit: de heup op de zitting (0,46), de enkel op de vloer en vóór de
  // voorkant van de bank (0,98 diep, de zitplek ligt 0,46 van de wand)
  v.mark.groep.updateMatrixWorld(true);
  const heup = v.mark.beenLinks.boven.getWorldPosition(m.clone()), enkel = v.mark.beenLinks.eind.getWorldPosition(m.clone());
  const k = w.plekken.bankKijk, fx = -Math.sin(k), fz = -Math.cos(k);
  const zit = { heup: heup.y, enkel: enkel.y, voor: (enkel.x - bank.x) * fx + (enkel.z - bank.z) * fz, kijk: Math.abs(Math.atan2(Math.sin(v.mark.yaw - k), Math.cos(v.mark.yaw - k))) };
  const regels = window.__gesprek();
  window.__stap(4);
  const a = v.politieauto, nav = window.__nav();
  return { regels, opBank, zit, fase: v.fase, nav, auto: !!a, navD: a && nav ? Math.hypot(nav.x - a.x, nav.z - a.z) : -1,
    opdracht: document.getElementById('opdracht').textContent };
});
const tekst = binnen.regels.map(r => r.tekst).join(' ');
ok(binnen.opBank < 0.8 && binnen.regels.length >= 8 && binnen.regels[0].wie === 'Mark' && !binnen.regels.some(r => r.telefoon),
  'Mark zit op de bank en begint vanzelf', `${binnen.regels.length} regels, ${binnen.opBank.toFixed(2)} m van de bank`);
ok(Math.abs(binnen.zit.heup - 0.47) < 0.06 && binnen.zit.enkel > 0.03 && binnen.zit.enkel < 0.13 && binnen.zit.voor > 0.52 && binnen.zit.kijk < 0.05,
  'hij zit echt: de heup op de zitting, de voeten vóór de bank op de vloer, naar de tv',
  `heup ${binnen.zit.heup.toFixed(2)} m, enkel ${binnen.zit.enkel.toFixed(2)} m hoog en ${binnen.zit.voor.toFixed(2)} m voor de zitplek`);
ok(/Veteraan/.test(tekst) && /uitgeschakeld/.test(tekst) && /niet meer veilig op straat/i.test(tekst) && /dit kan gewoon niet/i.test(tekst),
  'De Veteraan moet uitgeschakeld worden: het is niet meer veilig op straat');
ok(/broeden op een idee/.test(tekst) && /regelen/.test(tekst), 'hij heeft zitten broeden op een idee, jij moet dingen regelen');
ok(/politieauto/i.test(tekst) && /Lemmerweg/.test(tekst) && /C4/.test(tekst) && /Tinga State/.test(tekst) && /meesterplan/.test(tekst),
  'een politieauto aan de Lemmerweg, C4 bij Tinga State, en dan het meesterplan');
ok(binnen.fase === 'stelen' && binnen.auto && binnen.nav && binnen.nav.letter === 'P' && binnen.navD < 3,
  'daarna wijst de kaart naar de politieauto', `${binnen.fase} · ${binnen.opdracht}`);

// ------------------------------------------------ de politieauto zelf
kop('de politieauto aan de Lemmerweg');
const auto = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const W = await import('/js/world.js');
  const g = window.__game, a = g.verhaal.politieauto;
  let d = Infinity, breed = 0;
  for (const as of KAART.wegassen) {
    if (!as.drive || !/lemmerweg/i.test(as.naam || '')) continue;
    for (let i = 1; i < as.pts.length; i++) {
      const p = as.pts[i - 1], q = as.pts[i], dx = q[0] - p[0], dz = q[1] - p[1], L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((a.x - p[0]) * dx + (a.z - p[1]) * dz) / L2));
      const e = Math.hypot(p[0] + dx * t - a.x, p[1] + dz * t - a.z);
      if (e < d) { d = e; breed = as.w || 5; }
    }
  }
  const [kx, kz] = W.resolveCollisions(a.x, a.z, 1.0);
  let balk = false;
  a.mesh.traverse(o => { if (o.isMesh && o.material && o.material.emissive && o.material.emissive.b > 0.8 && o.material.emissive.r < 0.3) balk = true; });
  return { d, breed, vrij: Math.hypot(kx - a.x, kz - a.z), balk, rijdbaar: !!a.driveable, top: a.topSnelheid };
});
ok(auto.d < auto.breed / 2 + 0.5, 'hij staat aan de Lemmerweg, op de rand van de rijbaan', `${auto.d.toFixed(2)} m van de as, weg ${auto.breed} m breed`);
ok(auto.vrij < 0.05, 'niet in een botsdoos', `${auto.vrij.toFixed(2)} m verschoven`);
ok(auto.balk && auto.rijdbaar && auto.top > 25, 'met de blauwe lichtbalk, en je kunt erin rijden', `topsnelheid ${auto.top} m/s`);

// --------------------------------------------------------- stelen
kop('stelen: twee sterren');
const stelen = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, a = v.politieauto;
  window.__zet(a.x + Math.cos(a.yaw) * 1.6, a.z - Math.sin(a.yaw) * 1.6);
  g.toggleCar();
  const erin = g.player.inCar === a;
  window.__stap(4);
  const na = { fase: v.fase, ster: g.politie.ster };
  // zolang ze je zoeken gaat het niet verder
  window.__stap(100, 0.1);
  const blijft = v.fase;
  // en als je ze kwijt bent wel
  g.politie.reset();
  window.__stap(4);
  // wat Erik dan zegt klikt zichzelf weg; zolang het er staat is E "verder"
  for (let i = 0; i < 100 && !window.__balkDicht(); i++) v.update(0.1);
  const d = g.boerderij.winkels[0], nav = window.__nav();
  return { erin, na, blijft, fase: v.fase, nav, navD: nav ? Math.hypot(nav.x - d.x, nav.z - d.z) : -1,
    opdracht: document.getElementById('opdracht').textContent };
});
ok(stelen.erin && stelen.na.fase === 'afschudden' && stelen.na.ster === 2, 'instappen in de politieauto kost twee sterren',
  `${stelen.na.fase}, ${stelen.na.ster} sterren`);
ok(stelen.blijft === 'afschudden', 'zolang ze je zoeken gaat de missie niet verder');
ok(stelen.fase === 'c4' && stelen.nav && stelen.nav.letter === 'T' && stelen.navD < 3 && /C4/.test(stelen.opdracht),
  'politie kwijt: de kaart wijst naar Tinga State', stelen.opdracht);

// --------------------------------------------------- de C4 aan de balie
kop('de C4 aan de balie van Tinga State');
const balie = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, b = g.boerderij;
  // een plek voor de toonbank: rond de verkoper zoeken
  const vk = b.verkoper.groep.position;
  let plek = null;
  for (let r = 0.5; r <= 3 && !plek; r += 0.25) for (let k = 0; k < 16 && !plek; k++) {
    const x = vk.x + Math.cos(k / 16 * 6.283) * r, z = vk.z + Math.sin(k / 16 * 6.283) * r;
    if (b.bijToonbank(x, z)) plek = { x, z };
  }
  const c4Klaar = b.c4Zichtbaar;
  window.__zet(plek.x, plek.z);
  window.__stap(3);
  const el = document.getElementById('praat');
  const hint = el.hidden ? '' : el.textContent;
  const geldVoor = v.geld;
  g.praat();
  window.__stap(2);
  const regels = window.__gesprek();
  window.__stap(4);
  const nav = window.__nav();
  return { hint, regels, c4: g.player.c4, betaald: geldVoor - v.geld, fase: v.fase, nav, c4Klaar, c4Weg: !b.c4Zichtbaar,
    navD: nav ? Math.hypot(nav.x - v.plekken.thuis.x, nav.z - v.plekken.thuis.z) : -1,
    opdracht: document.getElementById('opdracht').textContent };
});
const baliTekst = balie.regels.map(r => r.tekst).join(' ');
ok(/C4 ophalen/.test(balie.hint), 'aan de balie staat "E — de C4 ophalen"', balie.hint || 'geen hint');
ok(balie.regels[0] && balie.regels[0].wie === 'Verkoper' && /Mark had al gebeld/.test(baliTekst) && /Verse C4 voor jou/.test(baliTekst),
  'de verkoper: Mark had al gebeld, verse C4 voor jou', baliTekst.slice(0, 90));
ok(balie.c4Klaar, 'de vier blokken liggen op de toonbank klaar');
ok(balie.c4 === 4 && balie.betaald === 0 && balie.c4Weg, 'vier stuks, gratis, en ze gaan mee van de toonbank', `${balie.c4} × C4, € ${balie.betaald} betaald`);
ok(balie.fase === 'brengen' && balie.nav && balie.nav.letter === 'M' && balie.navD < 3,
  'en dan terug naar Molenkrite 15', balie.opdracht);

// ---------------------------------------------- opslaan en laden, en kapot
kop('opslaan en laden');
const laad = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  const s = v.bewaar();
  const c4Opslag = g.player.c4;
  g.player.c4 = 0;
  v.herstel(s);
  g.player.c4 = c4Opslag;       // (dat doet js/opslag.js: de speler staat niet in het verhaal)
  window.__stap(2);
  return { missie: v.missie, fase: v.fase, letter: window.__nav() ? window.__nav().letter : null, auto: !!v.politieauto };
});
ok(laad.missie === 'politieauto' && laad.fase === 'brengen' && laad.letter === 'M' && laad.auto,
  'na het laden breng je de auto en de C4 nog steeds naar Mark', `${laad.missie}/${laad.fase}`);

// --------------------------------------------------------- brengen
kop('alles bij Molenkrite 15');
const klaar = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, a = v.politieauto, t = v.plekken.thuis;
  const voor = v.geld;
  a.x = t.x + 3; a.z = t.z + 2; a.speed = 0;
  a.mesh.position.set(a.x, a.mesh.position.y, a.z);
  window.__zet(a.x + 1.5, a.z);
  window.__stap(6);
  const melding = document.getElementById('missie').textContent;
  const regels = window.__gesprek();
  return { na: v.geld - voor, missie: v.missie, klaar: v.politieautoKlaar, melding, regels, mark: v.mark.groep.visible };
});
ok(klaar.na === 1000 && klaar.missie === 'klaar' && klaar.klaar, 'geslaagd: € 1.000', `+${klaar.na}`);
ok(/geslaagd/i.test(klaar.melding) && /politieauto/i.test(klaar.melding), 'MISSIE GESLAAGD in beeld', klaar.melding.slice(0, 60));
ok(klaar.mark && klaar.regels.some(r => r.wie === 'Mark' && /plan/.test(r.tekst) && /binnen/.test(r.tekst)),
  'Mark komt kijken en vertelt binnen zijn plan', klaar.regels.map(r => r.tekst).join(' | ').slice(0, 120));

// -------------------------------------------- los starten, en een wrak
kop('los te starten, en een kapotte auto');
const los = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Minus', key: '_', shiftKey: true, bubbles: true }));
  window.__stap(2);
  const gestart = { missie: v.missie, fase: v.fase };
  // de briefing overslaan: naar binnen en doorklikken
  const w = g.woningen[0];
  window.__zet(w.plekken.deurBinnen.x, w.plekken.deurBinnen.z);
  window.__stap(3);
  window.__gesprek();
  window.__stap(2);
  const a = v.politieauto;
  a.hp = 0;
  window.__stap(3);
  return { gestart, mislukt: document.getElementById('missie').textContent };
});
ok(los.gestart.missie === 'politieauto' && los.gestart.fase === 'wacht', 'shift+min begint missie 11', JSON.stringify(los.gestart));
ok(/mislukt/i.test(los.mislukt) && /politieauto/i.test(los.mislukt), 'een kapotte politieauto is een mislukte missie', los.mislukt.slice(0, 60));

console.log(`\n${fout ? fout + ' fout' : 'alles goed'}`);
await browser.close();
process.exit(fout ? 1 : 0);
