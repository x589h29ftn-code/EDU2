/*
 Waar komt het haperen vandaan? (melding 25 sep 2026: "beeld met de muis is
 prima, maar met lopen en rijden zie je lag; 's nachts ook, en bij in- en
 uitstappen".)

   node tools/server.mjs 8123 &   node tools/vloeiendtest.mjs [poort]

 De proef meet drie dingen, en het derde is waar het om gaat:

 1. **Beeldtijden.** Per situatie (stilstaan, rondkijken, lopen, rijden — overdag
    en 's nachts) de mediaan, de traagste vijf procent en het aantal haperingen
    boven 33 ms. Rondkijken hoort net zo vlot te zijn als stilstaan; loopt het
    daar al uit elkaar, dan zit het in het tekenen en niet in het bewegen.
 2. **Hoeveel shaderprogramma's three erbij vertaalt.** Elke keer dat het aantal
    zichtbare lampen verandert, moet three élk materiaal opnieuw vertalen — dat
    is een hapering van tientallen milliseconden die je als schok ziet. Loopt
    dit getal op tijdens het lopen of bij het instappen, dan is dát de oorzaak.
 3. **De kosten van in- en uitstappen**, apart gemeten, overdag en 's nachts.

 De container is sterk vertraagd, dus de absolute getallen zeggen niets. Het
 gaat om de verhoudingen en om het aantal vertalingen: dat laatste hoort nul te
 zijn zodra de wereld er staat.
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

await page.evaluate(() => {
  const g = window.__game;
  localStorage.removeItem('tinga.spel.v1');
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true;
  g.player.inCar = null;
  g.sfeer.weer = 'helder';

  /*
   Een stukje spelen en meten. `beweeg` krijgt per beeld de speler in handen; de
   lus zelf draait gewoon door, dus wat we meten is het echte beeld. De eerste
   tien beelden gaan niet mee: daar zit het opstarten van de meting in.
  */
  window.__meet = (beelden, beweeg) => new Promise((klaar) => {
    const tijden = [];
    const progVoor = g.renderer.info.programs ? g.renderer.info.programs.length : 0;
    let n = 0, vorig = performance.now();
    const stap = () => {
      const nu = performance.now();
      if (n > 6) tijden.push(nu - vorig);
      vorig = nu;
      if (beweeg) beweeg(n);
      if (++n < beelden + 6) requestAnimationFrame(stap);
      else {
        tijden.sort((a, b) => a - b);
        const p = (q) => +tijden[Math.min(tijden.length - 1, Math.floor(tijden.length * q))].toFixed(1);
        /*
         Een hapering is hier niet "boven 33 ms" — deze container haalt die
         drempel nooit — maar "ruim twee keer zo lang als een gewoon beeld". Dat
         is wat je als schok ziet, en het is ongevoelig voor hoe traag de machine
         zelf is.
        */
        const med = p(0.5);
        klaar({
          mediaan: med, p95: p(0.95), max: +tijden[tijden.length - 1].toFixed(1),
          haperingen: tijden.filter(t => t > med * 2 + 4).length, beelden: tijden.length,
          programmas: (g.renderer.info.programs ? g.renderer.info.programs.length : 0) - progVoor,
        });
      }
    };
    requestAnimationFrame(stap);
  });

  // op de Molenkrite neerzetten, met een rijbaan onder je voeten
  window.__zetNeer = () => {
    g.player.inCar = null;
    g.player.pos.set(10, 0, -7); g.player.yaw = -0.88; g.player.pitch = 0;
    g.player.applyCamera();
  };
  window.__uur = (u) => { g.sfeer.uur = u; g.sfeer.update(0.016, g.camera.position.x, g.camera.position.z); };
});

// een situatie meten: stilstaan, rondkijken, lopen
const meet = async (naam, stand) => {
  const r = await page.evaluate(async ({ stand }) => {
    const g = window.__game;
    window.__zetNeer();
    await window.__meet(10, null);            // even laten bezinken
    const loop = (n) => {
      if (stand === 'kijk') { g.player.yaw += 0.02; g.player.applyCamera(); }
      if (stand === 'loop') {
        g.player.pos.x += Math.sin(g.player.yaw) * -0.09;
        g.player.pos.z += Math.cos(g.player.yaw) * -0.09;
        g.player.applyCamera();
      }
      if (stand === 'rijd') {
        const c = g.player.inCar;
        if (c) { c.x -= Math.sin(c.yaw) * 0.32; c.z -= Math.cos(c.yaw) * 0.32; }
      }
    };
    return window.__meet(45, stand === 'stil' ? null : loop);
  }, { stand });
  console.log(`  ${naam.padEnd(22)} mediaan ${String(r.mediaan).padStart(6)} ms · p95 ${String(r.p95).padStart(6)} ms`
    + ` · max ${String(r.max).padStart(6)} ms · ${String(r.haperingen).padStart(3)} haperingen`
    + ` · ${r.programmas} nieuwe programma's`);
  return r;
};

kop('overdag (12 uur)');
await page.evaluate(() => window.__uur(12));
const dagStil = await meet('stilstaan', 'stil');
const dagKijk = await meet('rondkijken', 'kijk');
const dagLoop = await meet('lopen', 'loop');

kop("'s nachts (1 uur)");
await page.evaluate(() => window.__uur(1));
const nachtStil = await meet('stilstaan', 'stil');
const nachtKijk = await meet('rondkijken', 'kijk');
const nachtLoop = await meet('lopen', 'loop');

kop('in- en uitstappen');
const auto = await page.evaluate(async () => {
  const g = window.__game;
  const uit = {};
  for (const [naam, uur] of [['dag', 12], ['nacht', 1]]) {
    window.__uur(uur);
    window.__zetNeer();
    await window.__meet(8, null);
    // een auto naast je neerzetten, zodat instappen altijd lukt
    const car = g.vehicles.voegToe({ x: g.player.pos.x + 2.4, z: g.player.pos.z, yaw: 0, soort: 'hatch' });
    await window.__meet(8, null);
    const voorIn = g.renderer.info.programs.length;
    // alleen het werk van het in- en uitstappen zelf timen, niet de beelden
    // daarna: die duren in deze container seconden en zeggen niets
    const a = performance.now(); g.toggleCar(); const in1 = performance.now() - a;
    await window.__meet(3, null);
    const naIn = g.renderer.info.programs.length;
    const b = performance.now(); g.toggleCar(); const uit1 = performance.now() - b;
    await window.__meet(3, null);
    uit[naam] = { instap: +in1.toFixed(1), uitstap: +uit1.toFixed(1), programmas: naIn - voorIn };
  }
  return uit;
});
for (const [k, v] of Object.entries(auto)) {
  console.log(`  ${k.padEnd(22)} instappen ${String(v.instap).padStart(6)} ms · uitstappen ${String(v.uitstap).padStart(6)} ms`
    + ` · ${v.programmas} nieuwe programma's`);
}

// --------------------------------------------------- de wijk 's nachts
/*
 De tweede helft van de melding: na elven hoort het buiten leeg te lopen, en na
 middernacht hoort een deel van de straatverlichting uit te gaan — allebei
 geleidelijk. Dit rekent alleen aan de krommen en aan het verhuizen, dus het
 kost geen beelden.
*/
kop("de wijk 's nachts");
const nacht = await page.evaluate(() => {
  const g = window.__game;
  const krom = {};
  for (const u of [12, 22, 22.75, 23, 23.5, 1, 4, 5.75, 6.5]) {
    g.sfeer.uur = u;
    krom[u] = { drukte: +g.sfeer.drukte.toFixed(2), lampen: +g.sfeer.lampenAan.toFixed(2) };
  }
  // springt er ergens iets? per kwartier de grootste stap
  let sprongD = 0, sprongL = 0, vorig = null;
  for (let u = 0; u < 24; u += 0.25) {
    g.sfeer.uur = u;
    const nu = { d: g.sfeer.drukte, l: g.sfeer.lampenAan };
    if (vorig) {
      sprongD = Math.max(sprongD, Math.abs(nu.d - vorig.d));
      sprongL = Math.max(sprongL, Math.abs(nu.l - vorig.l));
    }
    vorig = nu;
  }
  // en loopt de straat echt leeg? het verhuizen zestig keer laten draaien
  const tel = (x, z) => g.npcs.people.filter(p => p.alive && Math.hypot(p.x - x, p.z - z) < 200).length;
  const px = g.player.pos.x, pz = g.player.pos.z;
  g.npcs.drukte = 1;
  for (let i = 0; i < 60; i++) { g.npcs.vulBuurtAan(px, pz, 1); g.npcs.update(0.05, i, px, pz); }
  const overdag = tel(px, pz);
  g.npcs.drukte = 0.16;
  for (let i = 0; i < 60; i++) { g.npcs.vulBuurtAan(px, pz, 1); g.npcs.update(0.05, i, px, pz); }
  const snachts = tel(px, pz);
  g.sfeer.uur = 12; g.npcs.drukte = 1;
  return { krom, sprongD: +sprongD.toFixed(3), sprongL: +sprongL.toFixed(3), overdag, snachts };
});
console.log('  krommen:', JSON.stringify(nacht.krom));
ok(nacht.krom[12].drukte === 1 && nacht.krom[22].drukte === 1,
  'overdag is het gewoon druk', `${nacht.krom[12].drukte} om twaalf uur`);
ok(nacht.krom[23.5].drukte < 0.25 && nacht.krom[1].drukte < 0.25 && nacht.krom[4].drukte < 0.25,
  "tussen half twaalf en vijven is het buiten leeg",
  `${nacht.krom[23.5].drukte} · ${nacht.krom[1].drukte} · ${nacht.krom[4].drukte}`);
ok(nacht.krom[6.5].drukte === 1, "en om half zeven 's ochtends is het weer vol");
ok(nacht.krom[23].lampen === 1 && nacht.krom[1].lampen < 0.5 && nacht.krom[6.5].lampen === 1,
  'na middernacht brandt een deel van de straatverlichting niet meer',
  `23 u: ${nacht.krom[23].lampen} · 1 u: ${nacht.krom[1].lampen} · 6.5 u: ${nacht.krom[6.5].lampen}`);
ok(nacht.sprongD < 0.25 && nacht.sprongL < 0.25, 'allebei lopen ze geleidelijk, zonder schakelaar',
  `grootste stap per kwartier: drukte ${nacht.sprongD}, lampen ${nacht.sprongL}`);
ok(nacht.snachts < nacht.overdag * 0.6, "en de straat loopt 's nachts ook echt leeg",
  `${nacht.overdag} mensen overdag, ${nacht.snachts} 's nachts`);

kop('het oordeel');
ok(dagKijk.programmas === 0 && dagLoop.programmas === 0,
  'overdag vertaalt three geen nieuwe shaders tijdens het spelen',
  `${dagKijk.programmas} bij kijken, ${dagLoop.programmas} bij lopen`);
ok(nachtKijk.programmas === 0 && nachtLoop.programmas === 0,
  "'s nachts ook niet — dat is de bron van het haperen bij het lopen",
  `${nachtKijk.programmas} bij kijken, ${nachtLoop.programmas} bij lopen`);
ok(auto.dag.programmas === 0 && auto.nacht.programmas === 0,
  'en in- en uitstappen vertaalt er ook geen',
  `dag ${auto.dag.programmas}, nacht ${auto.nacht.programmas}`);
/*
 Lopen mag best iets duurder zijn dan rondkijken — er komt botsing en
 wereldwerk bij — maar niet de helft erbij. Het gaat om de verhouding, want de
 container zelf is traag.
*/
ok(dagLoop.mediaan < dagKijk.mediaan * 1.5 + 2, 'lopen kost niet veel meer dan rondkijken (dag)',
  `${dagKijk.mediaan} → ${dagLoop.mediaan} ms`);
ok(nachtLoop.mediaan < nachtKijk.mediaan * 1.5 + 2, "lopen kost niet veel meer dan rondkijken (nacht)",
  `${nachtKijk.mediaan} → ${nachtLoop.mediaan} ms`);
ok(nachtLoop.haperingen <= dagLoop.haperingen + 2, "'s nachts hapert het niet meer dan overdag",
  `${dagLoop.haperingen} overdag, ${nachtLoop.haperingen} 's nachts`);

console.log(fout ? `\n${fout} fout` : '\nalles goed');
await browser.close();
process.exit(fout ? 1 : 0);
