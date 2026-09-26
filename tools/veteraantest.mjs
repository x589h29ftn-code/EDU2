/*
 Missie 10: De Veteraan (verzoek 23 sep 2026).

   node tools/server.mjs 8123 &   node tools/veteraantest.mjs [poort]

 De missie, in de volgorde waarin je hem speelt:

 1. Na het kopen van een huis belt De Veteraan zelf, binnen VET_WACHT tellen.
 2. Hij staat met zijn hondje op het Sneekerpad bij het kleine molentje (De
    Terpensmole); bij hem begint het gesprek vanzelf: hij bedankt je voor de
    molen in IJlst en stuurt je om een tas bij de tribune van VV Sneek.
 3. Dan wordt het zwart, zacht en zonder sprong, met "Enkele uren later" op het
    zwart; daarna sta je voor je eigen huis, te voet, om één uur 's nachts
    (verzoek 26 sep 2026). Zonder gekocht huis is dat de Wieken 29.
 4. De tas staat voor de tribune, niet in een botsdoos, en E pakt hem op. De
    Veteraan is dan allang van het pad.
 5. Dan rijden vier auto's over de weg voor het sportpark aan — óver de weg,
    niet door de gevels — en stappen er tien man uit, aan de kant van de
    tribune. Ze komen het veld niet op: ze gaan rond de ingang staan, met zicht
    op het pad naar buiten, en wachten je daar op. Bij de tas ben je buiten hun
    bereik.
 6. Het vuurgevecht bij de ingang is te winnen en niet gratis: met een vaste
    loting haalt een speler die om de drieënhalve tel iemand raakt die hij kan
    zien het, en een speler die op het pad blijft staan gaat neer — en begint
    dan opnieuw bij de tas, met de bende al uit de auto's.
 7. Terug bij het molentje is hij weg en belt Mark: omleggen, te snel in de
    rangen, ben je veilig, ga naar huis — met het adres dat je gekocht hebt.
 8. Thuis levert € 250 op.

 En daaromheen: shift+0 start de missie los, een opgeslagen spel midden in de
 missie hervat hem, en een opslag tussen het kopen en het telefoontje laat de
 telefoon na het laden alsnog gaan.
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
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  g.player.wapenSlot = false; g.player.wapenUit = false;
  geluid.start();
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) g.verhaal.update(dt); };
  window.__balkDicht = () => document.getElementById('dialoog').hidden;
  // Een gesprek doorklikken en de regels bewaren. Op `hidden` letten en niet op
  // de tekst: dialoogTekst houdt de laatste zin vast (zie CLAUDE.md).
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
  // stappen tot een voorwaarde waar is, met de verstreken tijd erbij
  window.__tot = (vw, max = 400, dt = 0.2) => {
    for (let i = 0; i < max; i++) { if (vw()) return i * dt; g.verhaal.update(dt); }
    return vw() ? max * dt : -1;
  };
  window.__zet = (x, z) => { g.player.inCar = null; g.player.pos.set(x, 0, z); g.player.applyCamera(); };
  // een vaste loting, zodat het vuurgevecht elke keer hetzelfde afloopt
  window.__loting = (zaad) => {
    let a = zaad >>> 0;
    Math.random = () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
});

// ------------------------------------------------------------ de plekken
kop('het molentje, het pad en de tribune');
const plek = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const { resolveCollisions } = await import('/js/world.js');
  const v = window.__game.verhaal;
  const p = v.veteraanPlek, t = v.tribune;
  const mol = KAART.molens.find(m => /terpensmole/i.test(m.naam));
  const rat = KAART.molens.find(m => /rat/i.test(m.naam));
  // het pad onder hem: waar begint en eindigt dat?
  let pad = null, padD = Infinity;
  for (const as of KAART.wegassen) {
    if (as.drive) continue;
    for (let i = 1; i < as.pts.length; i++) {
      const a = as.pts[i - 1], b = as.pts[i];
      const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1;
      const s = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.z - a[1]) * dz) / L2));
      const d = Math.hypot(a[0] + dx * s - p.x, a[1] + dz * s - p.z);
      if (d < padD) { padD = d; pad = as; }
    }
  }
  const eind = pad ? [pad.pts[0], pad.pts[pad.pts.length - 1]] : [];
  const ratD = eind.length ? Math.min(...eind.map(q => Math.hypot(q[0] - rat.cx, q[1] - rat.cz))) : -1;
  const sneekD = eind.length ? Math.min(...eind.map(q => Math.hypot(q[0], q[1]))) : -1;
  const [tx, tz] = resolveCollisions(t.tas.x, t.tas.z, 0.3);
  const veld = KAART.sportvelden.find(q => q.tribune && /vv sneek/i.test(q.naam));
  return {
    molen: p.naam, molenD: Math.hypot(p.x - mol.cx, p.z - mol.cz), padD, padLang: pad ? pad.pts.length : 0,
    ratD, sneekD,
    tasVrij: Math.hypot(tx - t.tas.x, tz - t.tas.z),
    tribuneD: Math.hypot(t.tas.x - veld.tribune.vx, t.tas.z - veld.tribune.vz),
    veldD: Math.hypot(t.tas.x - veld.cx, t.tas.z - veld.cz),
    tribuneVeldD: Math.hypot(veld.tribune.vx - veld.cx, veld.tribune.vz - veld.cz),
    weg: t.weg, wegD: t.weg ? Math.hypot(t.weg.x - t.tas.x, t.weg.z - t.tas.z) : -1,
  };
});
ok(/terpensmole/i.test(plek.molen || ''), 'het kleine molentje is De Terpensmole', plek.molen);
ok(plek.molenD < 25, 'De Veteraan staat bij de molen', `${plek.molenD.toFixed(1)} m ervandaan`);
ok(plek.padD < 3, 'en op het fietspad', `${plek.padD.toFixed(1)} m van de as`);
ok(plek.ratD >= 0 && plek.ratD < 120 && plek.sneekD < 600,
  'dat pad loopt van Tinga naar IJlst: het Sneekerpad',
  `eind bij De Rat op ${plek.ratD.toFixed(0)} m, bij de wijk op ${plek.sneekD.toFixed(0)} m van het nulpunt`);
ok(plek.tasVrij < 0.05, 'de tas staat niet in een botsdoos', `${plek.tasVrij.toFixed(2)} m verschoven`);
ok(plek.tribuneD < 8 && plek.veldD < plek.tribuneVeldD,
  'hij staat voor de tribune, aan de kant van het veld', `${plek.tribuneD.toFixed(1)} m van de gevel`);
ok(plek.weg && plek.wegD > 30 && plek.wegD < 140, 'de weg voor het sportpark is gevonden',
  plek.weg ? `${plek.wegD.toFixed(0)} m van de tas` : 'geen weg');

// ------------------------------------------------ shift+0 start missie 10
kop('los te starten');
const los = await page.evaluate(() => {
  const g = window.__game;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit0', shiftKey: true }));
  const na = g.verhaal.missie;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', shiftKey: true }));
  return { na, terug: g.verhaal.missie };
});
ok(los.na === 'veteraan', 'shift+0 begint missie 10', los.na);
ok(los.terug === 'molenkrite', 'en shift+1 zet je weer bij het begin', los.terug);

// --------------------------------------- een huis kopen, en dan de telefoon
kop('na het kopen belt De Veteraan');
const koop = await page.evaluate(() => {
  const g = window.__game;
  const w = g.woningen.find(x => x.stek && x.prijs === 1000);
  g.verhaal.herstel({ missie: 'huis', fase: 'kiezen', aanbod: true, geld: 3000 });
  window.__stap(4);
  g.player.inCar = null;
  g.player.pos.set(w.plekken.stoel.x, 0, w.plekken.stoel.z);
  /*
   Binnenkomen laat Mark iets over de woning zeggen; zolang dat in beeld staat
   klikt E dat weg in plaats van te kopen. Dus eerst uitwachten.
  */
  window.__tot(() => window.__balkDicht() && g.verhaal.aanspreekbaar, 120);
  g.praat();                                  // kopen aan tafel
  window.__stap(2);
  const klaar = window.__gesprek();           // "Gefeliciteerd..."
  const volgende = g.verhaal.volgendeMissie;
  // en opslaan in de tussentijd: na het laden moet de telefoon alsnog gaan
  const opslag = g.verhaal.bewaar();
  g.verhaal.herstel(opslag);
  const naLaden = g.verhaal.volgendeMissie;
  const na = window.__tot(() => g.verhaal.missie === 'veteraan' && !window.__balkDicht(), 400);
  const eerste = { wie: document.getElementById('dialoogNaam').textContent,
    telefoon: document.getElementById('dialoog').classList.contains('telefoon') };
  const regels = window.__gesprek();
  window.__stap(4);
  const nav = g.hud.nav ? { letter: g.hud.nav.letter, doel: g.hud.nav.doel } : null;
  const p = g.verhaal.veteraanPlek;
  const vet = g.verhaal.veteraan;
  return {
    stek: g.verhaal.stek, klaar: klaar.length, volgende, naLaden, opslagVolgende: opslag.volgende, na, eerste, regels,
    fase: g.verhaal.fase, nav, navD: nav ? Math.hypot(nav.doel[0] - p.x, nav.doel[1] - p.z) : -1,
    zichtbaar: !!(vet && vet.veteraan.groep.visible && vet.hond.visible),
    hondD: vet ? Math.hypot(vet.hond.position.x - vet.veteraan.groep.position.x,
      vet.hond.position.z - vet.veteraan.groep.position.z) : -1,
    geld: g.verhaal.geld,
  };
});
ok(koop.stek === 'Koningsspil 20', 'het huis is gekocht', String(koop.stek));
ok(koop.volgende && koop.volgende.naam === 'veteraan' && koop.volgende.over <= 45.01,
  'en daarna staat missie 10 klaar', koop.volgende ? `over ${koop.volgende.over.toFixed(0)} s` : 'niets');
ok(koop.opslagVolgende === 'veteraan' && koop.naLaden && koop.naLaden.naam === 'veteraan',
  'ook na opslaan en laden in de tussentijd', JSON.stringify(koop.naLaden));
ok(koop.na >= 0, 'de telefoon gaat', `na ${koop.na.toFixed(1)} s`);
ok(koop.eerste.wie === 'De Veteraan' && koop.eerste.telefoon, 'en De Veteraan belt zelf', koop.eerste.wie);
ok(koop.regels.some(r => /sneekerpad/i.test(r.tekst) && /molentje/i.test(r.tekst)),
  'hij noemt het Sneekerpad en het molentje');
ok(koop.fase === 'naar_veteraan' && koop.nav && koop.nav.letter === 'V' && koop.navD < 3,
  'de navigatie wijst naar hem', `${koop.fase}, ${koop.nav ? koop.nav.letter : '-'} op ${koop.navD.toFixed(1)} m`);
ok(koop.zichtbaar && koop.hondD > 0.3 && koop.hondD < 1.5, 'hij staat er, met zijn hondje naast zich',
  `hond op ${koop.hondD.toFixed(2)} m`);

// ------------------------------------------------------ het gesprek
kop('het gesprek bij het molentje');
const gesprek = await page.evaluate(() => {
  const g = window.__game;
  const p = g.verhaal.veteraanPlek;
  window.__zet(p.x + p.langs.x * 3.5, p.z + p.langs.z * 3.5);
  g.sfeer.uur = 15;                           // het gesprek is overdag
  window.__stap(4);
  const regels = window.__gesprek();
  window.__stap(1);
  const faseNa = g.verhaal.fase;
  // de overgang afspelen, om de 0,05 s: de dekking van het zwart en de tekst
  const el = document.getElementById('overgang'), tk = document.getElementById('overgangtekst');
  let max = 0, sprong = 0, vorig = +el.style.opacity || 0, tekst = '', tekstMax = 0, tijd = 0, zwartT = 0, tekstBijLicht = 0;
  let schuttersInZwart = -1;
  for (let i = 0; i < 400 && (g.verhaal.zwart || i < 2); i++) {
    g.verhaal.update(0.05); tijd += 0.05;
    const o = +el.style.opacity || 0, to = +tk.style.opacity || 0;
    max = Math.max(max, o); sprong = Math.max(sprong, Math.abs(o - vorig)); vorig = o;
    if (o > 0.999) { zwartT += 0.05; if (schuttersInZwart < 0 && g.verhaal.fase === 'naar_tas') schuttersInZwart = g.verhaal.schutters ? g.verhaal.schutters.aantal : 0; }
    if (to > 0.05) { tekst = tk.textContent; if (o < 0.99) tekstBijLicht++; }
    tekstMax = Math.max(tekstMax, to);
  }
  window.__stap(4);
  const huis = g.woningen.find(w => w.naam === g.verhaal.stek);
  const st = huis.plekken.stoep;
  const overgang = { faseNa, max, sprong, tekst, tekstMax, tekstBijLicht, tijd, zwartT, schuttersInZwart,
    eind: +el.style.opacity || 0, zicht: el.style.visibility,
    uur: g.sfeer.uur, nacht: g.sfeer.nacht, voorDeur: Math.hypot(g.player.pos.x - st.x, g.player.pos.z - st.z),
    teVoet: !g.player.inCar, vetWeg: !g.verhaal.veteraan.veteraan.groep.visible, huis: huis.naam };
  const t = g.verhaal.tribune;
  const nav = g.hud.nav ? { letter: g.hud.nav.letter, doel: g.hud.nav.doel } : null;
  const tas = g.verhaal.tas;
  return {
    regels, fase: g.verhaal.fase, overgang,
    nav, navD: nav ? Math.hypot(nav.doel[0] - t.tas.x, nav.doel[1] - t.tas.z) : -1,
    tas: !!(tas && tas.zichtbaar),
    opdracht: document.getElementById('opdracht').textContent,
  };
});
const tekst = gesprek.regels.map(r => r.tekst).join(' ');
ok(gesprek.regels.length >= 6 && gesprek.regels[0].wie === 'De Veteraan', 'het gesprek begint vanzelf',
  `${gesprek.regels.length} regels`);
ok(/molen in IJlst/i.test(tekst) && /dank/i.test(tekst), 'hij bedankt je voor de molen in IJlst');
ok(/voetbalveld/i.test(tekst) && /tribune/i.test(tekst) && /terugbrengen/i.test(tekst),
  'en stuurt je om de tas bij de tribune, en terug');

kop('enkele uren later');
const og = gesprek.overgang;
ok(og.faseNa === 'overgang', 'na het gesprek wordt het zwart', og.faseNa);
ok(og.max > 0.999 && og.sprong < 0.08, 'zacht: helemaal zwart, en nergens een sprong',
  `grootste stap ${og.sprong.toFixed(3)} per 0,05 s`);
ok(og.tekst === 'Enkele uren later' && og.tekstMax > 0.99 && og.tekstBijLicht === 0,
  '"Enkele uren later", alleen op het zwart', `${og.tekst} · ${og.zwartT.toFixed(1)} s zwart`);
ok(og.eind === 0 && og.zicht === 'hidden' && og.tijd < 8, 'daarna komt het beeld weer terug', `na ${og.tijd.toFixed(1)} s`);
ok(og.voorDeur < 1.5 && og.teVoet, 'je staat te voet voor je eigen huis', `${og.huis}, ${og.voorDeur.toFixed(2)} m van de stoep`);
ok(og.uur === 1 && og.nacht, 'om één uur \'s nachts, in het donker', `${og.uur} uur`);
ok(og.vetWeg, 'De Veteraan staat niet meer op het pad');
ok(og.schuttersInZwart === 0, 'de bende is er nog niet: die komt pas na de tas');
ok(gesprek.fase === 'naar_tas' && gesprek.tas && gesprek.nav && gesprek.nav.letter === 'T' && gesprek.navD < 3
  && /voetbalveld/.test(gesprek.opdracht),
  'dan naar het voetbalveld: de tas staat klaar en de kaart wijst erheen', `${gesprek.fase} · ${gesprek.opdracht}`);

// ------------------------------------------------ opslaan midden in de missie
kop('opslaan en laden');
const laad = await page.evaluate(() => {
  const g = window.__game;
  const s = g.verhaal.bewaar();
  g.verhaal.herstel(s);
  window.__stap(2);
  return { missie: g.verhaal.missie, fase: g.verhaal.fase, tas: !!(g.verhaal.tas && g.verhaal.tas.zichtbaar),
    letter: g.hud.nav ? g.hud.nav.letter : null, stek: g.verhaal.stek };
});
ok(laad.missie === 'veteraan' && laad.fase === 'naar_tas' && laad.tas && laad.letter === 'T',
  'na het laden sta je weer voor de tas', `${laad.missie}/${laad.fase}`);
ok(laad.stek === 'Koningsspil 20', 'en je huis is nog van jou', String(laad.stek));

// --------------------------------------------------- de tas en de hinderlaag
kop('de tas, en de vier auto\'s');
const tas = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const g = window.__game;
  const t = g.verhaal.tribune;
  // eerst weg van het molentje: hij is weg zodra je niet meer kijkt
  window.__zet(t.tas.x + 1.2, t.tas.z + 0.4);
  window.__stap(4);
  const vetWeg = !g.verhaal.veteraan.veteraan.groep.visible;
  const el = document.getElementById('praat');
  const hint = el.hidden ? '' : el.textContent;
  g.praat();
  window.__stap(2);
  const na = { fase: g.verhaal.fase, tasBij: g.verhaal.tasBij, tasZicht: g.verhaal.tas.zichtbaar };
  // de rit: elke auto moet op de rijbaan blijven
  const assen = KAART.wegassen.filter(a => a.drive);
  const opWeg = (x, z) => {
    let best = Infinity, breed = 0;
    for (const a of assen) for (let i = 1; i < a.pts.length; i++) {
      const p = a.pts[i - 1], q = a.pts[i];
      const dx = q[0] - p[0], dz = q[1] - p[1], L2 = dx * dx + dz * dz || 1;
      const s = Math.max(0, Math.min(1, ((x - p[0]) * dx + (z - p[1]) * dz) / L2));
      const d = Math.hypot(p[0] + dx * s - x, p[1] + dz * s - z);
      if (d < best) { best = d; breed = a.w || 5; }
    }
    return best - breed / 2;           // hoever buiten de rijbaan
  };
  let buiten = 0, stappen = 0;
  for (let i = 0; i < 200 && g.verhaal.fase === 'hinderlaag'; i++) {
    window.__stap(1, 0.1);
    if (i % 3 === 0) for (const a of g.verhaal.schutterAutos) { buiten = Math.max(buiten, opWeg(a.x, a.z)); }
    // wat Erik zegt klikt zichzelf weg
    stappen++;
  }
  const autos = g.verhaal.schutterAutos.map(a => ({ x: a.x, z: a.z, speed: a.speed || 0 }));
  const sch = g.verhaal.schutters;
  const mannen = sch ? sch.wachters.map(w => ({ x: w.persoon.groep.position.x, z: w.persoon.groep.position.z })) : [];
  // uitgestapt aan de kant van de tribune: dichter bij de tas dan hun auto
  const kant = g.verhaal.aanrijders.every((a, k) => {
    return (t.tas.x - a.auto.x) * a.zij.x + (t.tas.z - a.auto.z) * a.zij.z > 0;
  });
  const afstand = autos.map(a => Math.hypot(a.x - t.tas.x, a.z - t.tas.z));
  const zegt = window.__balkDicht() ? '' : document.getElementById('dialoogTekst').textContent;
  return { vetWeg, hint, na, buiten, stappen, autos: autos.length, stil: autos.every(a => a.speed < 0.1), zegt,
    mannen: mannen.length, kant, afstand: [Math.min(...afstand), Math.max(...afstand)],
    fase: g.verhaal.fase, opdracht: document.getElementById('opdracht').textContent,
    vest: sch ? sch.wachters.some(w => w.persoon.groep.getObjectByName && false) : null };
});
ok(tas.vetWeg, 'De Veteraan is van het pad zodra je bij de tribune staat');
ok(/tas pakken/i.test(tas.hint), 'bij de tas staat "E — de tas pakken"', tas.hint || 'geen hint');
ok(tas.na.fase === 'hinderlaag' && tas.na.tasBij && !tas.na.tasZicht, 'met E heb je de tas',
  JSON.stringify(tas.na));
ok(tas.autos === 4, 'er komen vier auto\'s', `${tas.autos}`);
ok(tas.buiten < 1.5, 'en die rijden over de weg, niet door de gevels',
  `hoogstens ${tas.buiten.toFixed(2)} m buiten de rijbaan`);
ok(tas.stil && tas.afstand[0] > 30 && tas.afstand[1] < 160, 'ze stoppen op de weg voor het sportpark',
  `${tas.afstand[0].toFixed(0)}–${tas.afstand[1].toFixed(0)} m van de tas`);
ok(tas.mannen === 10 && tas.fase === 'vuurgevecht', 'en er stappen tien man uit', `${tas.mannen} man, ${tas.fase}`);
ok(tas.kant, 'aan de kant van de tribune');
ok(/10 te gaan/.test(tas.opdracht), 'de opdracht telt ze af', tas.opdracht);

kop('ze wachten je op bij de ingang');
const ingang = await page.evaluate(async () => {
  const { zichtVrij } = await import('/js/world.js');
  const g = window.__game, ing = g.verhaal.ingang, sch = g.verhaal.schutters, t = g.verhaal.tribune;
  // twintig tellen bij de tas blijven staan
  g.player.health = 100;
  // (hoe dicht komt iemand bij de tribune? de auto's staan tot 25 m langs de weg,
  // dus de afstand tot de weg zegt niets; die tot de tas wel)
  let dichtst = Infinity;
  for (let i = 0; i < 200; i++) {
    g.verhaal.update(0.1);
    for (const w of sch.wachters) {
      const p = w.persoon.groep.position;
      dichtst = Math.min(dichtst, Math.hypot(p.x - t.tas.x, p.z - t.tas.z));
    }
  }
  const pos = (w) => w.persoon.groep.position;
  return {
    n: sch.wachters.length, dichtst, lijst: ing.lijst.length,
    plekVerst: Math.max(...sch.wachters.map(w => Math.hypot(w.post.b[0] - ing.weg.x, w.post.b[1] - ing.weg.z))),
    opPlek: sch.wachters.filter(w => Math.hypot(pos(w).x - w.post.b[0], pos(w).z - w.post.b[1]) < 1).length,
    zicht: sch.wachters.filter(w => zichtVrij(w.post.b[0], w.post.b[1], ing.kijk.x, ing.kijk.z, 1.2)).length,
    dTas: Math.min(...sch.wachters.map(w => Math.hypot(w.post.b[0] - t.tas.x, w.post.b[1] - t.tas.z))),
    leven: g.player.health, fase: g.verhaal.fase,
  };
});
ok(/ingang/i.test(tas.zegt), 'Erik ziet het: ze blijven bij de ingang staan', tas.zegt || 'niets');
ok(ingang.plekVerst < 16 && ingang.dichtst > ingang.dTas - 1, 'ze komen het veld niet op: elke plek ligt bij de weg, en niemand komt dichter bij de tribune',
  `plekken tot ${ingang.plekVerst.toFixed(1)} m van de weg; dichtst bij de tas ${ingang.dichtst.toFixed(0)} m`);
ok(ingang.opPlek === ingang.n, 'na twintig tellen staat iedereen op zijn plek rond de ingang', `${ingang.opPlek} van ${ingang.n}`);
ok(ingang.zicht === ingang.n, 'en van elke plek kijk je het pad op, waar je langs moet', `${ingang.zicht} van ${ingang.n} (${ingang.lijst} plekken)`);
ok(ingang.leven === 100 && ingang.dTas > 70, 'bij de tas sta je buiten hun bereik', `dichtstbij ${ingang.dTas.toFixed(0)} m, ${ingang.leven} leven`);
ok(ingang.fase === 'vuurgevecht', 'en het gevecht wacht op jou', ingang.fase);

// --------------------------------------------------------- het vuurgevecht
kop('het vuurgevecht');
// eerst niets doen: dan moet je neergaan, en daarna opnieuw beginnen bij de tas
const niets = await page.evaluate(() => {
  const g = window.__game;
  window.__loting(7);
  g.player.health = 100;
  // op het pad naar buiten blijven staan, waar ze naar kijken
  const ing = g.verhaal.ingang;
  window.__zet(ing.kijk.x, ing.kijk.z);
  let t = 0;
  for (; t < 180 && g.player.health > 0; t += 0.1) g.verhaal.update(0.1);
  const neer = g.player.health <= 0;
  // de dood loopt af en de missie hervat bij het laatste punt
  window.__stap(60, 0.1);
  const sch = g.verhaal.schutters;
  const tt = g.verhaal.tribune;
  return { neer, t, fase: g.verhaal.fase, mannen: sch ? sch.aantal - sch.neer : 0,
    bijTas: Math.hypot(g.player.pos.x - tt.tas.x, g.player.pos.z - tt.tas.z), leven: g.player.health };
});
ok(niets.neer, 'wie op het pad blijft staan gaat neer', `na ${niets.t.toFixed(0)} s`);
ok(niets.fase === 'vuurgevecht' && niets.mannen === 10 && niets.bijTas < 2 && niets.leven === 100,
  'en begint opnieuw bij de tas, met de bende al uit de auto\'s',
  `${niets.fase}, ${niets.mannen} man, ${niets.bijTas.toFixed(1)} m van de tas`);

/*
 En dan om de drieënhalve tel de dichtstbijzijnde neerleggen die je kunt zien,
 binnen zeventig meter. Alleen wie je ziet: door de kantine heen raken kan een
 speler ook niet, en toen de proef dat wel deed was de bende dood voor ze om de
 hoek kwam.
*/
const winst = await page.evaluate(async () => {
  const { zichtVrij } = await import('/js/world.js');
  const g = window.__game;
  window.__loting(1);
  g.player.health = 100;
  const sch = g.verhaal.schutters;
  // vanaf hetzelfde punt op het pad: daar zie je ze allemaal
  const ing = g.verhaal.ingang;
  window.__zet(ing.kijk.x, ing.kijk.z);
  let t = 0, volgende = 3.5, laagst = 100;
  for (; t < 150 && !sch.alleNeer && g.player.health > 0; t += 0.1) {
    g.verhaal.update(0.1);
    laagst = Math.min(laagst, g.player.health);
    if (t >= volgende) {
      let doel = null, d = Infinity;
      for (const w of sch.wachters) {
        if (w.staat === 'neer') continue;
        const p = w.persoon.groep.position;
        const a = Math.hypot(p.x - g.player.pos.x, p.z - g.player.pos.z);
        if (a < 70 && a < d && zichtVrij(g.player.pos.x, g.player.pos.z, p.x, p.z, 1.2)) { d = a; doel = w; }
      }
      if (doel) { g.verhaal.raak(doel.persoon.groep); volgende = t + 3.5; }
    }
  }
  // wat ze laten vallen ligt er even later
  window.__stap(10, 0.1);
  return { t, alle: sch.alleNeer, laagst, leven: g.player.health };
});
ok(winst.alle && winst.leven > 0, 'om de 3,5 tel een treffer op wie je ziet: je haalt het',
  `na ${winst.t.toFixed(0)} s, nog ${winst.leven} leven`);
ok(winst.laagst < 90, 'maar het kost je wel wat: het is een echt vuurgevecht', `laagste stand ${winst.laagst}`);

// ------------------------------------ terug naar het molentje: hij is weg
kop('terug bij het molentje');
const leeg = await page.evaluate(() => {
  const g = window.__game;
  const ten = window.__tot(() => g.verhaal.fase === 'terug' && window.__balkDicht(), 100);
  const nav = g.hud.nav ? g.hud.nav.letter : null;
  const p = g.verhaal.veteraanPlek;
  window.__zet(p.x + p.langs.x * 6, p.z + p.langs.z * 6);
  const bel = window.__tot(() => document.getElementById('dialoog').classList.contains('telefoon'), 100, 0.1);
  const zichtbaar = g.verhaal.veteraan.veteraan.groep.visible;
  const regels = window.__gesprek();
  window.__stap(4);
  const thuis = g.verhaal.thuisDoel;
  const hn = g.hud.nav ? { letter: g.hud.nav.letter, doel: g.hud.nav.doel } : null;
  return { ten, nav, bel, zichtbaar, regels, fase: g.verhaal.fase,
    thuis: thuis ? thuis.naam : null,
    navD: hn && thuis ? Math.hypot(hn.doel[0] - thuis.deur.x, hn.doel[1] - thuis.deur.z) : -1,
    letter: hn ? hn.letter : null, opdracht: document.getElementById('opdracht').textContent };
});
const mark = leeg.regels.map(r => r.tekst).join(' ');
ok(leeg.ten >= 0 && leeg.nav === 'V', 'na het gevecht wijst de kaart terug naar De Veteraan');
ok(!leeg.zichtbaar, 'maar hij is er niet');
ok(leeg.bel >= 0, 'en de telefoon gaat vanzelf', `na ${leeg.bel.toFixed(1)} s`);
ok(leeg.regels.some(r => r.wie === 'Mark' && r.telefoon), 'Mark belt');
ok(/om te leggen/i.test(mark) && /rangen/i.test(mark), 'De Veteraan wilde je omleggen: te snel in de rangen');
ok(/veilig/i.test(mark) && /naar huis/i.test(mark) && /plan/i.test(mark), 'ben je veilig, ga naar huis, een plan');
ok(mark.includes('Koningsspil 20'), 'hij noemt je eigen adres', leeg.thuis);
ok(leeg.fase === 'naar_huis' && leeg.letter === 'H' && leeg.navD < 3,
  'de kaart wijst naar het huis dat je gekocht hebt', `${leeg.opdracht} · ${leeg.navD.toFixed(1)} m`);

// ------------------------------------------------------------- thuis
kop('thuis');
const thuis = await page.evaluate(() => {
  const g = window.__game;
  const voor = g.verhaal.geld;
  const t = g.verhaal.thuisDoel;
  // eerst bij de verkeerde voordeur: de Wieken 29 telt niet meer als thuis
  const w = g.woningen[1].plekken.deurBuiten;
  window.__zet(w.x, w.z);
  window.__stap(6);
  const nietHier = g.verhaal.fase;
  window.__zet(t.deur.x + 1, t.deur.z);
  window.__stap(6);
  return { nietHier, na: g.verhaal.geld - voor, missie: g.verhaal.missie, klaar: g.verhaal.veteraanKlaar,
    melding: document.getElementById('missie').textContent };
});
ok(thuis.nietHier === 'naar_huis', 'bij de Wieken 29 ben je niet thuis', thuis.nietHier);
ok(thuis.na === 250 && thuis.missie === 'klaar' && thuis.klaar, 'thuis: € 250 en de missie is geslaagd',
  `+${thuis.na}`);
ok(/geslaagd/i.test(thuis.melding) && /veteraan/i.test(thuis.melding), 'MISSIE GESLAAGD in beeld',
  thuis.melding.slice(0, 60));

// ---------------------------------- zonder gekocht huis: dan de Wieken 29
kop('zonder eigen huis');
const wieken = await page.evaluate(() => {
  const g = window.__game;
  g.verhaal.herstel({ missie: 'veteraan', fase: 'naar_veteraan', geld: 0 });
  window.__stap(4);
  const p = g.verhaal.veteraanPlek;
  window.__zet(p.x + p.langs.x * 3.5, p.z + p.langs.z * 3.5);
  window.__stap(4);
  window.__gesprek();
  for (let i = 0; i < 400 && (g.verhaal.zwart || i < 2); i++) g.verhaal.update(0.05);
  const t = g.verhaal.thuisDoel;
  const st = t.w.plekken.stoep;
  return { stek: g.verhaal.stek, naam: t.naam, d: Math.hypot(g.player.pos.x - st.x, g.player.pos.z - st.z),
    fase: g.verhaal.fase, uur: g.sfeer.uur };
});
ok(!wieken.stek && /wieken 29/i.test(wieken.naam) && wieken.d < 1.5 && wieken.fase === 'naar_tas' && wieken.uur === 1,
  'dan begin je voor de Wieken 29', `${wieken.naam}, ${wieken.d.toFixed(2)} m, ${wieken.fase}, ${wieken.uur} uur`);

console.log(`\n${fout ? fout + ' fout' : 'alles goed'}`);
await browser.close();
process.exit(fout ? 1 : 0);
