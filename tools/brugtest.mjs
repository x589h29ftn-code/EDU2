/*
 Missie 12: de Dúvelsrak (verzoek 27 sep 2026).

   node tools/server.mjs 8123 &   node tools/brugtest.mjs [poort]

 De missie, in de volgorde waarin je hem speelt:

 1. Na missie 11 een M bij Molenkrite 15, geen telefoon. Binnen vertelt Mark het
    plan: De Veteraan gaat naar de Spil, over de Dúvelsrak, een wegversperring met
    C4 die op een gewone controle lijkt.
 2. Zwart, "Die avond…": buiten voor de deur, avond, Mark en Erik in politiepak,
    de politieauto ernaast. Naar de brug, aan de kant van Tinga.
 3. Op de brug: de auto dwars, zwaailicht aan; drie dranghekken en vier ladingen
    C4 met E op gele markeringen. Mark kijkt of je 100 kogels en 100 leven hebt,
    en geeft je anders een machinegeweer en een pistool. Johan komt, in pak.
 4. Zwart, "Even later…", en het filmbeeld: vier auto's rijden rustig vanaf de
    Lemmerweg-kant de brug op, lampen aan, en stoppen voor de hekken. Niemand
    schiet: voor hen is het een controle.
 5. De Veteraan praat, herkent Erik, Mark roept, E: vier knallen, de achterkant
    van de brug is weg, maar iedereen leeft nog. Het vuurgevecht; auto's zijn
    dekking. Daarna vier man van de achterkant.
 6. Vier sterren, maar de politie komt en schiet pas als Mark uitgepraat is; dan
    twee wagens van de Molenkrite-kant. In het Tinga-bos ben je ze kwijt: geslaagd.

 En daaromheen: shift+= start hem los, opslaan en laden midden in de missie,
 een hek dat omvalt als je erdoorheen rijdt, en opnieuw na het neergaan.
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fout = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fout++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);

/*
 js/verhaal.js is één groot bereik. Een functie met een naam die er al is
 overschrijft de andere zonder foutmelding: `beginGevecht` en `naarDeC4` van deze
 missie namen zo stil die van missie 10 en 11 over (veteraantest, 27 sep 2026).
*/
kop('geen dubbele namen in js/verhaal.js');
{
  const { readFileSync } = await import('node:fs');
  const bron = readFileSync(new URL('../js/verhaal.js', import.meta.url), 'utf8');
  const namen = [...bron.matchAll(/^\s*function ([A-Za-z0-9_]+)\s*\(/gm)].map(m => m[1]);
  const dubbel = [...new Set(namen.filter((n, i) => namen.indexOf(n) !== i))];
  ok(dubbel.length === 0, 'elke functie heeft een eigen naam', dubbel.length ? dubbel.join(', ') : `${namen.length} functies`);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  const { geluid } = await import('/js/audio.js');
  const W = await import('/js/world.js');
  const P = await import('/js/politie.js');
  localStorage.removeItem('tinga.spel.v1');
  localStorage.removeItem('tinga.checkpoint.v1');
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  geluid.start();
  window.__W = W; window.__UNIFORM = P.UNIFORM;
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
  window.__zet = (x, z, y = 0) => { g.player.inCar = null; g.player.pos.set(x, y, z); g.player.applyCamera(); };
  window.__hint = () => { const el = document.getElementById('praat'); return el.hidden ? '' : el.textContent; };
  // loopt het zwart? Tot het beeld terug is, met de tekst die er stond
  window.__zwart = () => {
    const el = document.getElementById('overgang'), t = document.getElementById('overgangtekst');
    let tekst = '', max = 0;
    for (let i = 0; i < 200; i++) {
      g.verhaal.update(0.05);
      const d = parseFloat(el.style.opacity || '0');
      if (d > max) { max = d; if (d > 0.99) tekst = t.textContent; }
      if (max > 0.99 && d < 0.001) break;
    }
    return { tekst, max };
  };
  // heeft dit poppetje het politieshirt aan?
  window.__inPak = (p) => {
    let ja = false;
    p.groep.traverse(o => { if (o.isMesh && o.material && o.material.color && o.material.color.getHex() === P.UNIFORM.shirt) ja = true; });
    return ja;
  };
});

// ------------------------------------------- na missie 11: een M, geen telefoon
kop('na missie 11: een M bij Molenkrite 15');
const begin = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  g.player.c4 = 4;
  v.herstel({ missie: 'politieauto', fase: 'brengen', geld: 0, veteraanKlaar: true });
  window.__stap(4);
  const a = v.politieauto, t = v.plekken.thuis;
  a.x = t.x + 3; a.z = t.z + 2; a.speed = 0;
  a.mesh.position.set(a.x, a.mesh.position.y, a.z);
  window.__zet(a.x + 1.5, a.z);
  window.__stap(6);
  const na11 = v.missie;
  window.__gesprek();
  let telefoon = false, t0 = -1;
  for (let i = 0; i < 300; i++) {
    v.update(0.1);
    if (!window.__balkDicht() && document.getElementById('dialoog').classList.contains('telefoon')) telefoon = true;
    if (v.missie === 'brug') { t0 = i * 0.1; break; }
  }
  window.__stap(3);
  const deur = g.woningen[0].plekken.deurBuiten, nav = window.__nav();
  return { na11, t0, telefoon, missie: v.missie, fase: v.fase, nav, navD: nav ? Math.hypot(nav.x - deur.x, nav.z - deur.z) : -1,
    opdracht: document.getElementById('opdracht').textContent, mark: v.mark.groep.visible, brug: !!v.brug };
});
ok(begin.brug, 'de Dúvelsrak is gevonden (het viaduct in de kaart)');
ok(begin.na11 === 'klaar' && begin.missie === 'brug' && begin.fase === 'wacht' && begin.t0 >= 0,
  'na missie 11 begint missie 12 vanzelf', `na ${begin.t0.toFixed(1)} s`);
ok(!begin.telefoon, 'zonder telefoontje');
ok(begin.nav && begin.nav.letter === 'M' && begin.navD < 3 && /Molenkrite 15/.test(begin.opdracht) && !begin.mark,
  'een M bij Molenkrite 15, en Mark is binnen', begin.opdracht);

// --------------------------------------------------------- het plan
kop('binnen: het plan');
const plan = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, w = g.woningen[0];
  window.__zet(w.plekken.deurBinnen.x, w.plekken.deurBinnen.z);
  window.__stap(3);
  const bank = w.plekken.bank, m = v.mark.groep.position;
  const opBank = Math.hypot(m.x - bank.x, m.z - bank.z);
  const regels = window.__gesprek();
  const zwart = window.__zwart();
  window.__stap(2);
  const buitenRegels = window.__gesprek();
  window.__stap(2);
  const b = v.brug, sp = g.player.pos, deur = w.plekken.deurBuiten, a = v.politieauto, nav = window.__nav();
  return { opBank, regels, zwart, buitenRegels, fase: v.fase, uur: g.sfeer.uur,
    buiten: Math.hypot(sp.x - deur.x, sp.z - deur.z), auto: a ? Math.hypot(a.x - sp.x, a.z - sp.z) : -1,
    markPak: window.__inPak(b.mark), markZicht: b.mark.groep.visible, pak: g.derde.pak,
    nav, navD: nav ? Math.hypot(nav.x - b.autoPlek.x, nav.z - b.autoPlek.z) : -1,
    opdracht: document.getElementById('opdracht').textContent,
    // de gele markering op de plek van de auto (melding 27 sep 2026: "geef aan waar de auto moet staan")
    autoMerk: (() => { const m = b.autoMerk; return m && m.zichtbaar ? Math.hypot(m.groep.position.x - b.autoPlek.x, m.groep.position.z - b.autoPlek.z) : -1; })() };
});
const planTekst = plan.regels.map(r => r.tekst).join(' ');
ok(plan.opBank < 0.8 && plan.regels[0] && plan.regels[0].wie === 'Mark', 'Mark zit op de bank en begint vanzelf', `${plan.regels.length} regels`);
ok(/Johan/.test(planTekst) && /Veteraan/.test(planTekst) && /Spil/.test(planTekst) && /Dúvelsrak/.test(planTekst),
  'Johan hoorde dat De Veteraan vanavond naar de Spil gaat, over de Dúvelsrak');
ok(/wegversperring/.test(planTekst) && /politiecontrole/.test(planTekst) && /argwaan/.test(planTekst) && /C4 afgaan/.test(planTekst),
  'een wegversperring met C4 die op een gewone politiecontrole lijkt');
ok(/grasveld/.test(planTekst) && /Briljant/.test(planTekst) && /versperring nog opzetten/.test(planTekst),
  '"De Veteraan op het grasveld. Briljant!" — maar eerst de versperring');
ok(plan.zwart.max > 0.99 && /Die avond/.test(plan.zwart.tekst), 'zwart: "Die avond…"', plan.zwart.tekst);
ok(plan.fase === 'naarBrug' && Math.abs(plan.uur - 22.5) < 0.01 && plan.buiten < 8,
  'het is avond, en jullie staan buiten voor Molenkrite 15', `${plan.uur} uur, ${plan.buiten.toFixed(1)} m van de deur`);
ok(plan.markZicht && plan.markPak && plan.pak === 'politie', 'Mark en Erik in politiepak', `Erik: ${plan.pak}`);
ok(plan.auto > 0 && plan.auto < 30, 'de politieauto staat erbij', `${plan.auto.toFixed(1)} m`);
ok(plan.nav && plan.nav.letter === 'D' && plan.navD < 3 && /Dúvelsrak/.test(plan.opdracht),
  'de kaart wijst naar de Dúvelsrak, aan de kant van Tinga', plan.opdracht);
ok(plan.autoMerk >= 0 && plan.autoMerk < 0.1, 'en een gele markering op de plek waar de auto moet komen', `${plan.autoMerk.toFixed(2)} m`);

/*
 Wat er op het dek staat, van boven af bekeken. Midden op de brug liep de leuning
 schuin dwars over de weg, op 1,36 m: de as van het viaduct liep daar een paar
 centimeter terug, en de normaal klapte om (melding 27 sep 2026, "een houten
 balk overdwars").
*/
const dek = await page.evaluate(async () => {
  const THREE = await import('/lib/three.module.js');
  const g = window.__game, b = g.verhaal.brug, A = b.assen;
  const rc = new THREE.Raycaster(), neer = new THREE.Vector3(0, -1, 0);
  const hout = [];
  for (let s = 0; s <= A.L; s += 0.1) for (const u of [-3, -1, 1, 3]) {
    const p = b.punt(s, u);
    rc.set(new THREE.Vector3(p.x, A.hoogte + 4, p.z), neer); rc.far = 6;
    const q = rc.intersectObjects(g.scene.children, true).find(h => h.object.visible !== false);
    if (q && q.point.y > A.hoogte + 0.3 && q.point.y < A.hoogte + 3 && q.object.material && q.object.material.color
      && q.object.material.color.getHexString() === '8d6f4c') hout.push(`s${s.toFixed(1)}/u${u}`);
  }
  return { hout };
});
ok(dek.hout.length === 0, 'geen houten balk of leuning dwars over het dek', dek.hout.slice(0, 6).join(' ') || 'vrij');

// --------------------------------------------------------- op de brug
kop('de versperring');
const brug = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, b = v.brug, a = v.politieauto;
  // met de auto op de plek: in de auto, een paar meter ernaast, stilstaand
  const p = b.punt(4.2, 1.8);
  a.x = p.x; a.z = p.z; a.speed = 0; a.yaw = b.assen.noord + 0.3;
  a.mesh.position.set(p.x, b.assen.hoogte, p.z);
  g.player.inCar = a;
  window.__stap(3);
  const r = window.__gesprek();
  const verschil = Math.abs(Math.atan2(Math.sin(a.yaw - b.assen.noord), Math.cos(a.yaw - b.assen.noord)));
  const merken = b.merken.filter(m => m.zichtbaar).map(m => m.groep.position);
  const opMerk = merken.every((m, i) => Math.hypot(m.x - b.hekPlekken[i].x, m.z - b.hekPlekken[i].z) < 0.1);
  const mk = b.mark.groep.position;
  return { fase: v.fase, regels: r, dwars: verschil, opDek: b.assen.opDek(a.x, a.z), y: a.mesh.position.y,
    bijPlek: Math.hypot(a.x - b.autoPlek.x, a.z - b.autoPlek.z), merken: merken.length, opMerk,
    markOpBrug: b.assen.opDek(mk.x, mk.z), knipper: a.zwaailicht ? a.zwaailicht.links.material.emissiveIntensity : -1 };
});
ok(brug.fase === 'versperren' && brug.bijPlek < 0.05 && Math.abs(brug.dwars - Math.PI / 2) < 0.01 && brug.opDek && brug.y > 5,
  'de politieauto staat dwars over de weg, op het dek aan de Tinga-kant', `${brug.bijPlek.toFixed(2)} m, ${(brug.dwars * 57.3).toFixed(0)}°, ${brug.y.toFixed(2)} m hoog`);
ok(brug.regels.some(r => /dranghekken/.test(r.tekst)) && brug.regels.some(r => /Lemmerweg/.test(r.tekst) && /open/.test(r.tekst)),
  'Mark: hekken aan onze kant, de Lemmerweg-kant open');
ok(brug.merken === 3 && brug.opMerk, 'drie gele markeringen voor de hekken', `${brug.merken}`);
ok(brug.markOpBrug && brug.knipper > 0, 'Mark staat bij de auto, het zwaailicht is aan');

const uitstap = await page.evaluate(() => {
  // uitstappen op het dek: je staat erop, niet eronder op de N7 (melding 27 sep 2026)
  const g = window.__game, v = g.verhaal, b = v.brug, a = v.politieauto;
  g.player.inCar = a;
  g.toggleCar();
  const p = g.player.pos;
  const uit = { y: p.y, opDek: b.assen.opDek(p.x, p.z, 3), inAuto: !!g.player.inCar, merk: b.autoMerk.zichtbaar };
  // en het zwaailicht is 's avonds meer dan een blauw blokje: een gloed en een plas licht
  let gloed = 0, plas = 0;
  for (let i = 0; i < 30; i++) {
    v.update(0.05);
    gloed = Math.max(gloed, a.zwaailicht.links.userData.gloed.opacity, a.zwaailicht.rechts.userData.gloed.opacity);
    plas = Math.max(plas, a.zwaailicht.links.userData.plas.opacity);
  }
  uit.gloed = gloed; uit.plas = plas;
  return uit;
});
ok(!uitstap.inAuto && uitstap.opDek && uitstap.y > 5, 'uitstappen op het dek: je staat op de brug, niet eronder', `${uitstap.y.toFixed(2)} m hoog`);
ok(!uitstap.merk, 'de markering voor de auto is weg zodra hij staat');
ok(uitstap.gloed > 0.9 && uitstap.plas > 0.5, 'het zwaailicht gloeit, en werpt blauw licht op de weg',
  `gloed ${uitstap.gloed.toFixed(2)}, plas ${uitstap.plas.toFixed(2)}`);

const hekken = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, b = v.brug, y = b.assen.hoogte;
  const uit = { hints: [], gezet: [] };
  // eerst te ver weg: dan niets (midden op de weg, ruim voor de hekken)
  const p0 = b.punt(10.5, 0);
  window.__zet(p0.x, p0.z, y); window.__stap(2);
  uit.teVer = window.__hint();
  for (let i = 0; i < 3; i++) {
    const p = b.hekPlekken[i];
    window.__zet(p.x + 0.5, p.z, y); window.__stap(2);
    uit.hints.push(window.__hint());
    g.praat(); window.__stap(2);
    uit.gezet.push(v.brug.hekken[i]);      // (v.brug is een momentopname: steeds opnieuw halen)
  }
  const regels = window.__gesprek();
  window.__stap(2);
  const hek = b.hekStukken[1];
  const merken = b.merken.filter(m => m.zichtbaar).map(m => m.groep.position);
  const opC4 = merken.every((m, i) => Math.hypot(m.x - b.c4Plekken[i].x, m.z - b.c4Plekken[i].z) < 0.1);
  const l = b.assen.lokaal(b.c4Plekken[0].x, b.c4Plekken[0].z);
  return { ...uit, regels, fase: v.fase, zichtbaar: b.hekStukken.every(h => h.zichtbaar),
    hekY: hek.groep.position.y, merken: merken.length, opC4, c4S: l.s, L: b.assen.L };
});
ok(hekken.teVer === '' && hekken.hints.every(h => /dranghek/.test(h)), 'bij een markering "E — dranghek neerzetten", ernaast niet', hekken.hints[0]);
ok(hekken.gezet.every(Boolean) && hekken.zichtbaar && hekken.hekY > 5, 'E zet ze neer, op het dek', `${hekken.hekY.toFixed(2)} m`);
ok(hekken.fase === 'c4leggen' && hekken.merken === 4 && hekken.opC4, 'daarna vier markeringen voor de C4');
ok(hekken.c4S > hekken.L * 0.7 && hekken.regels.some(r => /achter op de brug/.test(r.tekst)),
  'achter op de brug, aan de kant van de Lemmerweg', `${hekken.c4S.toFixed(1)} van ${hekken.L.toFixed(1)} m`);

kop('opslaan en laden op de brug');
const laad1 = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, b = v.brug;
  const s = v.bewaar();
  v.herstel(s);
  window.__stap(2);
  const nu = v.brug, a = v.politieauto;
  return { missie: v.missie, fase: v.fase, hekken: nu.hekken.every(Boolean), merken: b.merken.filter(m => m.zichtbaar).length,
    pak: g.derde.pak, c4: g.player.c4, autoY: a.mesh.position.y, autoOp: b.assen.opDek(a.x, a.z) };
});
ok(laad1.missie === 'brug' && laad1.fase === 'c4leggen' && laad1.hekken && laad1.merken === 4 && laad1.pak === 'politie',
  'na het laden staan de hekken er en ligt de C4 nog klaar', `${laad1.fase}, ${laad1.c4} × C4`);
// (de eerste fotoronde vond hem onder het dek, op de N7: hij sprong van 0 m hierheen)
ok(laad1.autoOp && laad1.autoY > 5, 'en de politieauto staat op het dek, niet eronder', `${laad1.autoY.toFixed(2)} m`);

kop('de C4, en Mark kijkt of je klaar bent');
const c4 = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, b = v.brug, y = b.assen.hoogte, pl = g.player;
  const uit = { hints: [] };
  const voor = pl.c4;
  // weinig kogels en een tik gehad: dan moet Mark bijspringen
  pl.reserve = 10;
  for (const w of Object.keys(pl.magazijnen)) pl.magazijnen[w] = Math.min(pl.magazijnen[w], 4);
  pl.health = 64;
  for (let i = 0; i < 4; i++) {
    const p = b.c4Plekken[i];
    window.__zet(p.x - 0.4, p.z, y); window.__stap(2);
    uit.hints.push(window.__hint());
    g.praat(); window.__stap(2);
  }
  uit.gelegd = v.brug.c4.every(Boolean);
  uit.blokken = b.blokken.every(k => k.zichtbaar && k.groep.position.y > 5);
  uit.c4Voor = voor; uit.c4Na = pl.c4;
  uit.regels = window.__gesprek();
  let kogels = pl.reserve;
  for (const w of pl.wapens) kogels += pl.magazijnen[w] || 0;
  uit.kogels = kogels; uit.wapens = pl.wapens.slice(); uit.leven = pl.health; uit.fase = v.fase;
  return uit;
});
ok(c4.hints.every(h => /C4 plaatsen/.test(h)) && c4.gelegd && c4.blokken, 'vier keer "E — C4 plaatsen", vier blokken op het dek');
ok(c4.c4Voor === 4 && c4.c4Na === 0, 'de vier stuks van de balie zijn op', `${c4.c4Voor} → ${c4.c4Na}`);
ok(c4.regels.some(r => r.wie === 'Mark' && /machinegeweer en een pistool/.test(r.tekst)), 'te weinig: Mark geeft een machinegeweer en een pistool');
ok(c4.wapens.includes('mitrailleur') && c4.wapens.includes('pistool') && c4.kogels >= 100 && c4.leven === 100,
  'met minstens honderd kogels, en je leven is weer vol', `${c4.wapens.join(', ')} · ${c4.kogels} kogels · ${c4.leven} leven`);

const genoeg = await page.evaluate(() => {
  // en met genoeg bij je laat hij het zo
  const g = window.__game, v = g.verhaal, pl = g.player;
  const s = v.bewaar();
  s.fase = 'controle';
  const wapens = pl.wapens.slice(), reserve = pl.reserve;
  pl.reserve = 300; pl.health = 100;
  v.herstel(s);
  window.__stap(2);
  const regels = window.__gesprek();
  return { regels, fase: v.fase, reserve: pl.reserve, gelijk: pl.wapens.length === wapens.length };
});
ok(genoeg.regels.some(r => /Genoeg kogels/.test(r.tekst)) && genoeg.reserve === 300,
  'met genoeg kogels en vol leven: "Goed zo", en er verandert niets', `${genoeg.reserve} kogels`);

kop('Johan komt helpen');
const johan = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, b = v.brug;
  const j0 = b.johan.groep.position.clone();
  let regels = [];
  for (let i = 0; i < 600 && window.__balkDicht(); i++) v.update(0.05);
  const j1 = b.johan.groep.position.clone();
  const pak = window.__inPak(b.johan);
  const johanY = j1.y, johanOp = b.assen.opDek(j1.x, j1.z);
  regels = window.__gesprek();
  const zwart = window.__zwart();
  return { liep: Math.hypot(j1.x - j0.x, j1.z - j0.z), pak, regels, zwart, fase: v.fase, johanY, johanOp, j0Y: j0.y };
});
ok(johan.liep > 15 && johan.pak, 'Johan komt de helling op lopen, in politiepak', `${johan.liep.toFixed(1)} m gelopen`);
// (hij begon naast de oprit, op maaiveld, en liep onder het dek door: je zag hem niet)
ok(johan.j0Y > 3 && johan.johanOp && johan.johanY > 5, 'over de oprit, en hij staat óp het dek',
  `begon op ${johan.j0Y.toFixed(1)} m, staat op ${johan.johanY.toFixed(2)} m`);
ok(johan.regels.some(r => r.wie === 'Johan' && /help mee/.test(r.tekst)), 'hij zegt dat hij meehelpt');
ok(johan.zwart.max > 0.99 && /Even later/.test(johan.zwart.tekst), 'zwart: "Even later…"', johan.zwart.tekst);

// ---------------------------------------------------------- het filmbeeld
kop('het filmbeeld: De Veteraan komt eraan');
const film = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, b = v.brug, cam = g.camera, pl = g.player;
  const uit = { fase: v.fase, film: b.film, balk: parseFloat(document.getElementById('filmboven').style.height) || 0 };
  const L = b.assen.L;
  uit.start = b.konvooi.map(a => b.assen.lokaal(a.x, a.z).s);
  uit.soorten = b.konvooi.map(a => a.soort);
  const leven = pl.health;
  const standen = [];
  let maxV = 0;
  for (let i = 0; i < 400 && v.brug.film; i++) {
    v.update(0.05);
    for (const a of b.konvooi) maxV = Math.max(maxV, a.speed || 0);
    if (i % 20 === 0) {
      /*
       Staat de voorste auto in beeld, en de camera boven de leuning of binnen
       het dek? Het tweede standpunt stond eerst buiten de leuning, op 1,2 m: je
       zag alleen hout (brugshots, 27 sep 2026).
      */
      const a = v.brug.konvooi[0], p = a.mesh.position.clone(); p.y += 0.8;
      cam.updateMatrixWorld();
      const q = p.clone().project(cam);
      const l = b.assen.lokaal(cam.position.x, cam.position.z);
      standen.push({ x: cam.position.x, y: cam.position.y, z: cam.position.z, t: v.brug.filmT,
        dSp: Math.hypot(cam.position.x - pl.pos.x, cam.position.z - pl.pos.z),
        inBeeld: Math.abs(q.x) < 1 && Math.abs(q.y) < 1 && q.z < 1,
        vrij: Math.abs(l.u) < 4.8 || cam.position.y > b.assen.hoogte + 1.5 });
    }
  }
  uit.duur = standen.length;
  uit.slotFilm = g.player.vuurSlot;
  uit.standen = standen;
  uit.maxV = maxV;
  uit.stop = b.konvooi.map(a => b.assen.lokaal(a.x, a.z).s);
  uit.opDek = b.konvooi.every(a => a.mesh.position.y > 5);
  uit.stil = b.konvooi.every(a => a.speed === 0);
  uit.balkNa = parseFloat(document.getElementById('filmboven').style.height) || 0;
  uit.leven = pl.health - leven;
  uit.nacht = !!g.sfeer.nacht;
  uit.L = L;
  return uit;
});
const camVerschil = new Set(film.standen.map(s => `${Math.round(s.x)},${Math.round(s.z)}`)).size;
ok(film.fase === 'film' && film.film && film.balk > 5, 'zwarte balken boven en onder: het filmbeeld', `${film.balk} vh`);
ok(film.start.every(s => s > film.L) && film.soorten.length === 4, 'vier auto\'s, nog op de helling aan de kant van de Lemmerweg',
  film.start.map(s => s.toFixed(0)).join(', '));
ok(film.standen.every(s => s.dSp > 2) && camVerschil >= 3, 'de camera staat los van Erik, op drie plekken', `${camVerschil} standpunten`);
const laat = film.standen.filter(s => s.t >= 6);
ok(laat.length >= 3 && laat.every(s => s.inBeeld && s.vrij), 'vanaf het tweede standpunt staat de voorste auto in beeld, niet achter de leuning',
  `${laat.filter(s => s.inBeeld).length} van ${laat.length}`);
ok(film.maxV > 5 && film.maxV <= 7.01, 'ze rijden rustig', `${(film.maxV * 3.6).toFixed(0)} km/u`);
ok(film.stil && film.opDek && film.stop.every((s, i) => Math.abs(s - [11, 18, 25, 32][i]) < 0.6),
  'en staan stil op de brug, achter elkaar voor de hekken', film.stop.map(s => s.toFixed(1)).join(', '));
ok(film.nacht && film.leven === 0 && film.balkNa === 0, 'het is donker, er is niet geschoten, en het beeld is terug');

kop('De Veteraan bij de hekken');
const stop = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, b = v.brug, s = v.schutters, pl = g.player;
  const leven = pl.health;
  for (let i = 0; i < 200 && window.__balkDicht(); i++) v.update(0.05);
  const vet = b.veteraan.veteraan.groep.position;
  const slotStop = g.player.vuurSlot;
  const uit = { slotStop, aantal: s ? s.aantal : 0, rustig: s ? s.rustig : false, vetZicht: b.veteraan.veteraan.groep.visible,
    vetS: b.assen.lokaal(vet.x, vet.z).s, hond: b.veteraan.hond.visible, leven: pl.health - leven };
  // halverwege zijn verhaal kun je nog niet schieten
  uit.slotPraat = g.player.vuurSlot && !g.player.magSchieten();
  uit.regels = window.__gesprek();
  window.__stap(3);
  uit.slotNa = g.player.vuurSlot;
  uit.hint = window.__hint();
  uit.fase = v.fase;
  uit.nogRustig = s.rustig;
  return uit;
});
const vetTekst = stop.regels.map(r => r.tekst).join(' ');
ok(stop.aantal === 10 && stop.rustig && stop.vetZicht && !stop.hond, 'De Veteraan en negen man stappen uit (het hondje is thuis)', `${stop.aantal}`);
ok(stop.vetS > 7 && stop.vetS < 10, 'De Veteraan loopt naar de hekken', `op ${stop.vetS.toFixed(1)} m`);
ok(stop.leven === 0 && stop.nogRustig, 'ze zien jullie niet als vijand: er wordt niet geschoten');
ok(film.slotFilm && stop.slotStop && stop.slotPraat && !stop.slotNa, 'en jij kunt pas schieten als De Veteraan uitgepraat is');
ok(/niet genoeg geld van mij/.test(vetTekst) && /door te laten gaan/.test(vetTekst) && /Jou ken ik/.test(vetTekst),
  '"Hebben jullie niet genoeg geld van mij gekregen…" en "Jou ken ik!"');
ok(stop.regels.some(r => r.wie === 'Mark' && /C4 afgaan/.test(r.tekst)) && /C4 laten afgaan/.test(stop.hint) && stop.fase === 'ontsteken',
  'Mark roept, en E laat de C4 afgaan', stop.hint);

kop('boem');
const boem = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, b = v.brug, s = v.schutters;
  g.praat();
  window.__stap(10);
  const nu = v.brug;
  const sch = b.schade.groep.position, l = b.assen.lokaal(sch.x, sch.z);
  // wie je achter de auto's niet ziet gaat zoeken; stil blijft er niemand staan
  return { ontploft: nu.ontploft, knallen: nu.knallen, schade: b.schade.zichtbaar, schadeS: l.s, L: b.assen.L,
    blokken: b.blokken.some(k => k.zichtbaar), neer: s.neer, rustig: s.rustig, alarm: s.alarm,
    aanval: s.wachters.filter(w => w.staat === 'aanval' || w.staat === 'zoekt').length, fase: v.fase };
});
ok(boem.ontploft && boem.knallen === 4 && !boem.blokken, 'vier knallen, de C4 is weg');
ok(boem.schade && boem.schadeS > boem.L * 0.75, 'de achterkant van de brug is kapot', `gat op ${boem.schadeS.toFixed(1)} m`);
ok(boem.neer === 0 && !boem.rustig && boem.alarm && boem.aanval === 10 && boem.fase === 'gevecht',
  'maar De Veteraan en zijn mannen leven nog, en komen in actie', `${boem.aanval} van de 10`);

// ------------------------------------------------------ auto's als dekking
kop('auto\'s zijn dekking');
const dekking = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, W = window.__W, a = v.politieauto, b = v.brug;
  /*
   De politieauto staat dwars op s = 2,6. Een schutter op de helling aan de
   Tinga-kant (s = −12) en jij aan de andere kant van de auto, op dezelfde lijn
   langs de weg: de auto zit ertussen. Een stap opzij (u = −3,6) niet meer. Aan
   deze kant van de auto staat verder niets: de hekken zijn geen botsdoos en de
   auto's van De Veteraan staan verder weg.
  */
  const schutter = b.punt(-12, 1.0), achter = b.punt(4.4, 1.0), naast = b.punt(4.4, -3.6);
  const inAuto = { x: a.x, z: a.z };
  return {
    achter: W.zichtVrij(schutter.x, schutter.z, achter.x, achter.z, 1.2),
    gehurkt: W.zichtVrij(schutter.x, schutter.z, achter.x, achter.z, 0.75),
    naast: W.zichtVrij(schutter.x, schutter.z, naast.x, naast.z, 1.2),
    inAuto: g.vehicles.blokkeertZicht(schutter.x, schutter.z, inAuto.x, inAuto.z, 1.2),
    // en een bus is hoger: daar kun je rechtop achter staan
    bus: g.vehicles.blokkeertZicht(0, -10, 0, 10, 1.8),
  };
});
ok(!dekking.achter && !dekking.gehurkt, 'achter de auto zien ze je niet, staand of gehurkt');
ok(dekking.naast, 'een stap ernaast wel');
ok(!dekking.inAuto, 'in de auto zelf ben je niet onzichtbaar');

const pijler = await page.evaluate(() => {
  /*
   De pijler onder het dek is een botsdoos van 0 tot 4,7 m, dwars over de hele
   breedte (s = 30,8). Wie erboven staat en zijn hoogte meegeeft, kijkt en loopt
   er overheen; zonder hoogte stond hij als een muur midden op het dek, en de
   mannen bij de achterste auto's zaten erachter vast (stap 90).
  */
  const g = window.__game, W = window.__W, b = g.verhaal.brug, y = b.assen.hoogte;
  const a = b.punt(34, -2), c = b.punt(26, -2), m = b.punt(30.8, -2);
  const [kx, kz] = W.resolveCollisions(m.x, m.z, 0.34, 0, y);
  return { met: W.zichtVrij(a.x, a.z, c.x, c.z, 1.2, y), zonder: W.zichtVrij(a.x, a.z, c.x, c.z, 1.2),
    lopen: Math.hypot(kx - m.x, kz - m.z) };
});
ok(pijler.met && pijler.lopen < 0.01, 'de pijler onder het dek houdt op het dek zicht en lopen niet tegen',
  `zonder hoogte: ${pijler.zonder ? 'vrij' : 'een muur'}`);

const gevecht = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, b = v.brug, s = v.schutters;
  // De Veteraan is een doel zoals de rest (tenzij Mark of Johan hem al raakte)
  const vetDoel = s.wachters[0].staat === 'neer' || v.doelen().includes(s.wachters[0].persoon.groep);
  // de eerste ploeg neer, De Veteraan als laatste
  for (let i = 1; i < s.wachters.length; i++) v.raak(s.wachters[i].persoon.groep.children[0] || s.wachters[i].persoon.groep);
  window.__stap(2);
  const nogEen = s.aantal - s.neer;
  v.raak(s.wachters[0].persoon.groep);
  window.__stap(3);
  const nieuw = s.wachters.slice(10);
  const L = b.assen.L;
  const uit = { nogEen, vetDoel, aantal: s.aantal, fase: v.fase,
    achter: nieuw.map(w => b.assen.lokaal(w.persoon.groep.position.x, w.persoon.groep.position.z).s - L),
    aanval: nieuw.filter(w => w.staat === 'aanval').length, regel: document.getElementById('dialoogTekst').textContent };
  for (const w of nieuw) v.raak(w.persoon.groep);
  window.__stap(3);
  // wat ze lieten vallen ligt op het dek, niet beneden op de N7
  const buit = g.buit.dingen.filter(d => d.soort === 'pistool' && b.assen.opDek(d.groep.position.x, d.groep.position.z, 2));
  uit.buit = buit.length; uit.buitLaag = buit.filter(d => d.groep.position.y < b.assen.hoogte).length;
  for (let i = 0; i < 100 && !window.__balkDicht() && v.fase !== 'chaos'; i++) v.update(0.1);
  window.__stap(3);
  uit.faseNa = v.fase;
  uit.ster = g.politie.ster;
  uit.rust = g.politie.rust;
  // de politie wacht: ook na een paar tellen komt er niemand
  for (let i = 0; i < 40; i++) g.politie.update(0.1);
  uit.eenheden = g.politie.eenheden;
  uit.regels = window.__gesprek();
  uit.rustNa = g.politie.rust;
  const route = b.politieRoute;
  uit.wagens = g.politie.intern.wagens.map(w => Math.hypot(w.car.x - route[0][0], w.car.z - route[0][1]));
  uit.voet = Math.hypot(route[1][0] - b.assen.voetTinga.x, route[1][1] - b.assen.voetTinga.z);
  for (let i = 0; i < 60; i++) g.politie.update(0.1);
  uit.wagensLater = g.politie.intern.wagens.length;
  const nav = window.__nav(), bos = v.bos;
  uit.nav = nav; uit.navD = nav && bos ? Math.hypot(nav.x - bos.x, nav.z - bos.z) : -1;
  uit.opdracht = document.getElementById('opdracht').textContent;
  uit.faseEind = v.fase;
  return uit;
});
// (nogEen is 0 als Mark of Johan De Veteraan al raakte: zij schieten ook)
ok(gevecht.vetDoel && gevecht.nogEen <= 1 && gevecht.aantal === 14 && gevecht.fase === 'versterking',
  'De Veteraan is ook raak te schieten; de eerste ploeg neer: er komen er vier bij', `${gevecht.aantal} man in totaal`);
ok(gevecht.achter.every(d => d > 20) && gevecht.aanval === 4, 'van de achterkant, in de verte', gevecht.achter.map(d => `+${d.toFixed(0)} m`).join(', '));
ok(gevecht.buit > 0 && gevecht.buitLaag === 0, 'hun pistolen liggen op het dek', `${gevecht.buit} op het dek, ${gevecht.buitLaag} eronder`);
ok(gevecht.faseNa === 'chaos' && gevecht.ster === 4, 'daarna vier sterren');
ok(gevecht.rust && gevecht.eenheden.wagens === 0 && gevecht.eenheden.voet === 0, 'maar zolang Mark praat komt er geen politie', JSON.stringify(gevecht.eenheden));
ok(gevecht.regels.some(r => /Shit, wat een chaos/.test(r.tekst)) && gevecht.regels.some(r => /de auto in en wegwezen/.test(r.tekst) && /Tinga-bos/.test(r.tekst)),
  '"Shit, wat een chaos." — "Mannen, de auto in en wegwezen. Op naar het Tinga-bos!"');
ok(!gevecht.rustNa && gevecht.wagens.length === 2 && gevecht.wagens.every(d => d < 25) && gevecht.voet < 1,
  'dan twee wagens, van de Molenkrite-kant', gevecht.wagens.map(d => d.toFixed(0) + ' m').join(', '));
ok(gevecht.wagensLater === 2, 'de rest komt pas als die er zijn (gewoon vier sterren daarna)', `${gevecht.wagensLater} wagens na 6 s`);
ok(gevecht.faseEind === 'vluchten' && gevecht.nav && gevecht.nav.letter === 'B' && gevecht.navD < 3 && /Tinga-bos/.test(gevecht.opdracht),
  'de kaart wijst naar het Tinga-bos', gevecht.opdracht);

kop('het Tinga-bos');
const bos = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, b = v.brug, bos = v.bos;
  const geld = v.geld;
  window.__zet(bos.x, bos.z);
  window.__stap(3);
  const ster = g.politie.ster;
  const regels = window.__gesprek();
  window.__stap(3);
  return { ster, regels, missie: v.missie, klaar: v.brug.klaar, geld: v.geld - geld, melding: document.getElementById('missie').textContent,
    pak: g.derde.pak, mark: b.mark.groep.visible, johan: b.johan.groep.visible, gat: b.schade.zichtbaar };
});
ok(bos.ster === 0, 'in het bos zijn ze je kwijt');
ok(bos.regels.some(r => r.wie === 'Johan' && /Veteraan/.test(r.tekst)) && bos.mark && bos.johan, 'Mark en Johan zijn mee, en praten na');
ok(bos.missie === 'klaar' && bos.klaar && bos.geld === 5000 && /GESLAAGD/i.test(bos.melding) && /Dúvelsrak/i.test(bos.melding),
  'geslaagd: € 5.000', `${bos.melding.slice(0, 50)}`);
ok(bos.pak === 'gewoon' && bos.gat, 'het politiepak is uit, en de brug houdt zijn gat');

// --------------------------------------- los starten, omvallen, opnieuw
kop('los starten, een hek omrijden, en opnieuw na het neergaan');
const los = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, b = v.brug;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Equal', key: '+', shiftKey: true, bubbles: true }));
  window.__stap(2);
  const gestart = { missie: v.missie, fase: v.fase, c4: g.player.c4 };
  // meteen door naar de brug met de hekken (herstel naar 'c4leggen')
  const s = v.bewaar(); s.fase = 'c4leggen';
  v.herstel(s);
  window.__stap(2);
  const hek = b.hekStukken[0], hp = hek.groep.position, a = v.politieauto;
  // een auto die er met vaart doorheen rijdt
  g.player.inCar = a; a.x = hp.x; a.z = hp.z + 1; a.speed = 6;
  window.__stap(12);
  const om = hek.om, hoek = hek.groep.rotation.x;
  a.speed = 0; g.player.inCar = null;
  // en neergaan tijdens het gevecht: terug naar vlak voor "even later"
  const s2 = v.bewaar(); s2.fase = 'klaarstaan';
  v.herstel(s2);
  for (let i = 0; i < 200 && v.fase !== 'film'; i++) v.update(0.05);
  for (let i = 0; i < 400 && v.brug.film; i++) v.update(0.05);
  for (let i = 0; i < 200 && window.__balkDicht(); i++) v.update(0.05);
  window.__gesprek();
  g.praat(); window.__stap(4);
  const voor = v.fase;
  g.player.health = 5;
  v.dood();
  for (let i = 0; i < 200 && v.fase !== 'film' && v.fase !== 'klaarstaan'; i++) v.update(0.1);
  return { gestart, om, hoek, voor, na: v.fase, schutters: v.schutters ? v.schutters.aantal : 0 };
});
ok(los.gestart.missie === 'brug' && los.gestart.fase === 'wacht' && los.gestart.c4 === 4, 'shift+= begint missie 12 (met de C4 van missie 11)', JSON.stringify(los.gestart));
ok(los.om && los.hoek < -1, 'een auto die door een dranghek rijdt gooit hem om', `${(los.hoek * 57.3).toFixed(0)}°`);
ok(los.voor === 'gevecht' && (los.na === 'klaarstaan' || los.na === 'film'), 'neergaan in het gevecht: opnieuw vanaf "even later"', `${los.voor} → ${los.na}`);

console.log(`\n${fout ? fout + ' fout' : 'alles goed'}`);
await browser.close();
process.exit(fout ? 1 : 0);
