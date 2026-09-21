/*
 Missie 8: de deal bij houtzaagmolen De Rat (verzoek 21 sep 2026).

   node tools/server.mjs 8123 &   node tools/dealtest.mjs [poort]

 De missie, in de volgorde waarin je hem speelt:

 1. Een minuut na de bom belt Johan: koop een sniper bij Tinga State en kom
    naar de Geeuwkade achter de waterzuivering.
 2. Heb je al een sniper, dan wijst de kaart meteen naar Johan.
 3. Bij het bootje praat Johan je bij en vaar jij naar IJlst.
 4. Bij de molen ligt een gele cirkel op het water: daarbinnen blijven.
 5. Je krijgt de sniper in handen en mag wél kijken maar niet schieten.
 6. Na vijftien seconden gaat het mis: vijf man openen het vuur op De Veteraan
    en pas dan mag je zelf schieten.
 7. Daarna terug naar de Geeuw met drie waterpolitieboten achter je aan.
 8. Terug bij de kade: € 500.

 De plekken worden niet ingetikt maar gezocht in de kaart: open water op een
 meter of zestig van de molen, met vrij zicht op de kade ertegenover.
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
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });
await page.evaluate(async () => {
  const { geluid } = await import('/js/audio.js');
  localStorage.removeItem('tinga.spel.v1');
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  g.player.wapenSlot = false; g.player.wapenUit = false;
  geluid.start();
  await geluid.laadMissieMuziek();
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) g.verhaal.update(dt); };
  // doorklikken tot de tekstbalk leeg is
  window.__klik = (n = 20) => {
    for (let i = 0; i < n; i++) {
      if (!document.getElementById('dialoogTekst').textContent) break;
      g.praat(); window.__stap(2);
    }
  };
});

// --------------------------------------------------- de plek bij de molen
kop('de plek bij de molen komt uit de kaart');
const plek = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const { vaarbaar, zichtVrij } = await import('/js/world.js');
  const g = window.__game;
  const p = g.verhaal.snipPlek;
  const mol = (KAART.molens || []).find(m => /rat/i.test(m.naam || ''));
  if (!p || !mol) return null;
  return {
    boot: p.boot, kade: p.kade, afstand: p.afstand,
    opWater: vaarbaar(p.boot.x, p.boot.z),
    kadeOpLand: !vaarbaar(p.kade.x, p.kade.z),
    zicht: zichtVrij(p.boot.x, p.boot.z, p.kade.x, p.kade.z, 1.6),
    bijMolen: Math.hypot(p.kade.x - mol.cx, p.kade.z - mol.cz),
    ruim: [4, 8, 12].every(r => [0, 1.57, 3.14, 4.71].every(h =>
      vaarbaar(p.boot.x + Math.cos(h) * r, p.boot.z + Math.sin(h) * r))),
  };
});
ok(!!plek, 'er is een plek gevonden bij houtzaagmolen De Rat');
if (plek) {
  ok(plek.opWater, 'de boot ligt op vaarwater', `${plek.boot.x.toFixed(0)}, ${plek.boot.z.toFixed(0)}`);
  ok(plek.ruim, 'met ruimte om te dobberen');
  ok(plek.kadeOpLand, 'de kade ligt op de wal', `${plek.kade.x.toFixed(0)}, ${plek.kade.z.toFixed(0)}`);
  ok(plek.afstand >= 46 && plek.afstand <= 78, 'op ruime afstand van de molen',
    `${plek.afstand.toFixed(0)} m`);
  ok(plek.zicht, 'en met vrij zicht op de kade');
  ok(plek.bijMolen < 45, 'de ontmoeting is bij de molen', `${plek.bijMolen.toFixed(0)} m van de molen`);
}

// ------------------------------------------------------- het telefoontje
kop('Johan belt');
const bel = await page.evaluate(async () => {
  const { geluid } = await import('/js/audio.js');
  const g = window.__game;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit8', shiftKey: true }));
  window.__stap(4);
  const beginFase = g.verhaal.fase;
  window.__stap(40);                       // de telefoon gaat na ruim een seconde
  const eerste = document.getElementById('dialoogTekst').textContent;
  const regels = [];
  for (let i = 0; i < 12; i++) {
    const t = document.getElementById('dialoogTekst').textContent;
    if (!t) break;
    regels.push(t);
    g.praat(); window.__stap(2);
  }
  window.__stap(4);
  return {
    beginFase, eerste, regels, fase: g.verhaal.fase,
    opdracht: document.getElementById('opdracht').textContent,
    nav: g.hud.nav ? g.hud.nav.naam : null,
    muziek: geluid.missieStand().aan,
    heeftSniper: g.player.wapens.includes('sniper'),
  };
});
ok(bel.beginFase === 'telefoon', 'missie 8 begint met de telefoon', bel.beginFase);
ok(/Telegram/i.test(bel.eerste || ''), 'Johan begint over zijn bericht op Telegram',
  (bel.eerste || '').slice(0, 45));
ok(bel.regels.some(r => /steady handjes/i.test(r)) && bel.regels.some(r => /sniper/i.test(r))
  && bel.regels.some(r => /zwembroek/i.test(r)),
  'hij vraagt om steady handjes, een sniper, en maakt de grap over de zwembroek');
ok(!bel.heeftSniper && bel.fase === 'kopen' && /sniper/i.test(bel.opdracht),
  'zonder sniper stuurt hij je eerst naar Tinga State', `${bel.fase} · ${bel.opdracht}`);
ok(/Tinga State/i.test(bel.nav || ''), 'en de kaart wijst Tinga State aan', bel.nav || 'geen vlag');
ok(bel.muziek === true, 'de missiemuziek loopt');

// --------------------------------------------------------- de sniper kopen
kop('de sniper kopen');
const koop = await page.evaluate(() => {
  const g = window.__game;
  g.player.krijgWapen('sniper');            // zoals de toonbank bij Tinga State het doet
  window.__stap(4);
  return {
    fase: g.verhaal.fase, opdracht: document.getElementById('opdracht').textContent,
    nav: g.hud.nav ? g.hud.nav.naam : null,
    johan: g.verhaal.johanPersoon ? {
      x: g.verhaal.johanPersoon.groep.position.x, z: g.verhaal.johanPersoon.groep.position.z,
      zichtbaar: g.verhaal.johanPersoon.groep.visible,
    } : null,
  };
});
ok(koop.fase === 'naar_johan', 'met een sniper op zak stuurt hij je door naar de Geeuw', koop.fase);
ok(/Johan/i.test(koop.nav || ''), 'de kaart wijst Johan aan', koop.nav || 'geen vlag');
ok(!!koop.johan && koop.johan.zichtbaar, 'en Johan staat bij het bootje');

// ------------------------------------------------------- de briefing aan de kade
kop('de briefing aan de kade');
const brief = await page.evaluate(async () => {
  const { LIGPLAATSEN } = await import('/js/boot.js');
  const g = window.__game;
  const j = g.verhaal.johanPersoon.groep.position;
  g.player.inCar = null;
  g.player.pos.set(j.x + 1.5, 0, j.z + 1.5);
  window.__stap(6);
  const eerste = document.getElementById('dialoogTekst').textContent;
  const regels = [];
  for (let i = 0; i < 12; i++) {
    const t = document.getElementById('dialoogTekst').textContent;
    if (!t) break;
    regels.push(t);
    g.praat(); window.__stap(2);
  }
  window.__stap(6);
  const ring = g.verhaal.snipRing;
  return {
    eerste, regels, fase: g.verhaal.fase,
    opdracht: document.getElementById('opdracht').textContent,
    ring: ring ? { zichtbaar: ring.zichtbaar, straal: ring.straal,
      x: ring.groep.position.x, z: ring.groep.position.z } : null,
    sloep: LIGPLAATSEN[0].naam,
  };
});
ok(/goed dat je er bent/i.test(brief.eerste || ''), 'Johan: "goed dat je er bent"',
  (brief.eerste || '').slice(0, 40));
ok(brief.regels.some(r => /Veteraan/.test(r)) && brief.regels.some(r => /maffia/i.test(r))
  && brief.regels.some(r => /jij vaart/i.test(r)),
  'hij noemt De Veteraan, de IJlster maffia en dat jij vaart');
ok(brief.fase === 'varen' && /cirkel/i.test(brief.opdracht), 'daarna moet je varen',
  `${brief.fase} · ${brief.opdracht}`);
ok(!!brief.ring && brief.ring.zichtbaar, 'en er ligt een gele cirkel op het water',
  brief.ring ? `straal ${brief.ring.straal} m` : 'geen cirkel');

// --------------------------------------------------------- naar de molen varen
kop('in de cirkel bij de molen');
const varen = await page.evaluate(async () => {
  const { LIGPLAATSEN } = await import('/js/boot.js');
  const g = window.__game;
  const plek = g.verhaal.snipPlek;
  // in de sloep aan de Geeuwkade stappen en hem naar de plek bij de molen varen
  const sloep = g.boten.ruw(0);
  g.boten.stapIn(sloep);
  const inBoot = !!g.player.inBoot;
  window.__stap(3);                          // een paar beelden: dan stapt Johan mee
  const johanWeg = !g.verhaal.johanPersoon.groep.visible;
  g.boten.verplaats(sloep, plek.boot.x, plek.boot.z, 0);
  window.__stap(8);
  const na = {
    fase: g.verhaal.fase,
    wapen: g.player.wapenSoort,
    vuurSlot: g.player.vuurSlot,
    magSchieten: g.player.magSchieten(),
    deal: !!g.verhaal.deal,
    tekst: document.getElementById('dialoogTekst').textContent,
  };
  window.__klik();
  window.__stap(4);
  return { inBoot, johanWeg, na, opdracht: document.getElementById('opdracht').textContent,
    ligplaats: LIGPLAATSEN[0].naam };
});
ok(varen.inBoot, 'je stapt in de sloep aan de Geeuwkade');
ok(varen.johanWeg, 'Johan vaart mee en staat niet meer op de kade');
ok(varen.na.fase === 'kijken', 'in de cirkel begint het kijken', varen.na.fase);
ok(varen.na.wapen === 'sniper', 'de sniper zit automatisch in je handen', varen.na.wapen);
ok(varen.na.vuurSlot === true && varen.na.magSchieten === false,
  'kijken mag, schieten nog niet');
ok(varen.na.deal, 'en op de kade staat het gezelschap klaar');
ok(/scope|kijker/i.test(varen.opdracht), 'de opdracht wijst naar de kijker', varen.opdracht);

// ------------------------------------------------------------- de deal
kop('de deal en wat er misgaat');
const scene = await page.evaluate(async () => {
  const g = window.__game;
  const d = g.verhaal.deal;
  const vet = d.veteraan.groep.position;
  const voor = { x: vet.x, z: vet.z };
  const mensen = d.aantal;
  const hond = { x: d.hond.position.x, z: d.hond.position.z };
  const bijBaas = Math.hypot(hond.x - vet.x, hond.z - vet.z);
  const schietVoor = d.schiet;
  // vijftien seconden meekijken
  for (let i = 0; i < 340 && g.verhaal.fase === 'kijken'; i++) g.verhaal.update(0.05);
  const tekst = document.getElementById('dialoogTekst').textContent;
  const schietNa = d.schiet;
  const vuurSlot = g.player.vuurSlot;
  window.__klik();
  window.__stap(20);
  /*
   Even echte tijd laten lopen: het wapen komt in de hoofdlus omhoog (de
   trekbeweging in js/player.js loopt op de klok van het spel, niet op de
   stapjes die deze proef zelf zet), en zolang dat duurt mag je niet schieten.
  */
  await new Promise(r => setTimeout(r, 1300));
  const na = d.veteraan.groep.position;
  return {
    mensen, bijBaas, schietVoor, schietNa, tekst, vuurSlot,
    magSchieten: g.player.magSchieten(),
    fase: g.verhaal.fase,
    deinst: Math.hypot(na.x - voor.x, na.z - voor.z),
    opdracht: document.getElementById('opdracht').textContent,
  };
});
ok(scene.mensen === 5, 'er staan vijf man tegenover De Veteraan', `${scene.mensen} man`);
ok(scene.bijBaas < 2, 'De Veteraan heeft zijn hondje bij zich', `${scene.bijBaas.toFixed(1)} m`);
ok(scene.schietVoor === false, 'eerst staan ze te praten');
ok(scene.schietNa === true, 'na een seconde of vijftien trekken ze hun wapens');
ok(/gaat fout/i.test(scene.tekst || '') || /schiet ze neer/i.test(scene.tekst || ''),
  'Johan: "shit, dit gaat fout"', (scene.tekst || '').slice(0, 40));
ok(scene.vuurSlot === false && scene.magSchieten, 'en dan mag jij ook schieten');
ok(scene.deinst > 0.5, 'De Veteraan deinst achteruit', `${scene.deinst.toFixed(1)} m`);
ok(scene.fase === 'vuurgevecht' && /maffia/i.test(scene.opdracht), 'het vuurgevecht loopt',
  `${scene.fase} · ${scene.opdracht}`);

// -------------------------------------------------------- de maffia neerhalen
kop('de maffia neerhalen en terug naar de Geeuw');
const terug = await page.evaluate(() => {
  const g = window.__game;
  const d = g.verhaal.deal;
  for (const m of [...d.mensen]) g.verhaal.raak(m.persoon.groep);
  window.__stap(10);
  const neer = d.neer;
  window.__klik();
  window.__stap(10);
  const fase = g.verhaal.fase;
  const opdracht = document.getElementById('opdracht').textContent;
  const boten = g.verhaal.snipBoten.length;
  // de boten komen pas in beeld als ze de kans krijgen: even laten varen
  for (let i = 0; i < 120; i++) g.verhaal.update(0.05);
  const actief = g.verhaal.snipBoten.filter(b => b.actief).length;
  return { neer, fase, opdracht, boten, actief, nav: g.hud.nav ? g.hud.nav.naam : null };
});
ok(terug.neer === 5, 'alle vijf gaan neer', `${terug.neer} neer`);
ok(terug.fase === 'terug' && /Geeuw/i.test(terug.nav || ''), 'daarna terug naar de Geeuwkade',
  `${terug.fase} · ${terug.nav}`);
ok(terug.boten === 3, 'er komen drie waterpolitieboten achter je aan', `${terug.boten} boten`);
ok(terug.actief > 0, 'en die varen ook echt uit', `${terug.actief} in het water`);

// ------------------------------------------------------------- de beloning
kop('terug bij de kade');
const eind = await page.evaluate(async () => {
  const { LIGPLAATSEN } = await import('/js/boot.js');
  const g = window.__game;
  // eerst zonder de politie uit te schakelen terug: dan is het nog niet klaar.
  // Terug naar de ligplaats zelf: daar past de romp, een paar meter ernaast
  // kan de wal zijn en dan blijft de boot staan waar hij lag.
  const lig = LIGPLAATSEN[0];
  const kade = lig.wal;
  const verzet = g.boten.verplaats(g.player.inBoot, lig.x, lig.z, lig.yaw);
  window.__stap(8);
  const bij = Math.hypot(g.player.inBoot.x - kade.x, g.player.inBoot.z - kade.z);
  const teVroeg = { fase: g.verhaal.fase, opdracht: document.getElementById('opdracht').textContent };
  // en dan de drie boten uitschakelen, zoals je ze met de sniper neerhaalt
  for (const b of g.verhaal.snipBoten) {
    for (const doel of b.doelen()) g.verhaal.raak(doel);
  }
  window.__stap(12);
  const fases = g.verhaal.snipBoten.map(b => (b.actief ? b.fase : 'weg'));
  const geldVoor = g.verhaal.geld;
  window.__stap(8);
  const regels = [];
  for (let i = 0; i < 12; i++) {
    const t = document.getElementById('dialoogTekst').textContent;
    if (!t) break;
    regels.push(t);
    g.praat(); window.__stap(2);
  }
  window.__stap(6);
  return {
    teVroeg, regels, geldVoor, geldNa: g.verhaal.geld, verzet, bij, fases,
    missie: g.verhaal.missie, fase: g.verhaal.fase,
    melding: document.getElementById('missie').textContent,
    ring: g.verhaal.snipRing ? g.verhaal.snipRing.zichtbaar : false,
  };
});
ok(eind.verzet && eind.bij < 18, 'je vaart terug naar de kade aan de Geeuw',
  `${eind.bij.toFixed(1)} m van de wal`);
ok(eind.teVroeg.fase === 'terug' && /waterpolitie/i.test(eind.teVroeg.opdracht),
  'met de politie nog op het water ben je nog niet klaar', eind.teVroeg.opdracht);
ok(eind.fases.every(f => f === 'wrak' || f === 'weg'), 'de drie boten gaan uit',
  eind.fases.join(', '));
ok(eind.regels.some(r => /Bedankt Erik/i.test(r)), 'Johan bedankt je',
  (eind.regels[0] || '').slice(0, 40));
ok(eind.geldNa - eind.geldVoor === 500, 'de beloning is € 500',
  `€ ${eind.geldVoor} → € ${eind.geldNa}`);
ok(/MISSIE VOLTOOID/.test(eind.melding) && /MOLEN/i.test(eind.melding),
  'MISSIE VOLTOOID – DE DEAL BIJ DE MOLEN', (eind.melding || '').slice(0, 45));
ok(eind.missie === 'klaar' && eind.fase === 'klaar', 'en de missie is afgerond',
  `${eind.missie}/${eind.fase}`);
ok(eind.ring === false, 'de gele cirkel is weer weg');

console.log(`\n${fout ? fout + ' fout' : 'alles goed'}`);
await browser.close();
process.exit(fout ? 1 : 0);
