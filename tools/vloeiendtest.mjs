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
  /*
   Springt er ergens iets? Per vijf minuten de grootste stap. Een kromme die
   over een uur loopt stapt per kwartier vanzelf een kwart — dat is geen
   schakelaar maar een grove meting. Waar het om gaat is dat er nergens een
   sprong in zit: een knop die omgaat zou hier 0,84 laten zien.
  */
  let sprongD = 0, sprongL = 0, vorig = null;
  for (let u = 0; u < 24; u += 1 / 12) {
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
ok(nacht.sprongD < 0.12 && nacht.sprongL < 0.12, 'allebei lopen ze geleidelijk, zonder schakelaar',
  `grootste stap per vijf minuten: drukte ${nacht.sprongD}, lampen ${nacht.sprongL}`);
ok(nacht.snachts < nacht.overdag * 0.6, "en de straat loopt 's nachts ook echt leeg",
  `${nacht.overdag} mensen overdag, ${nacht.snachts} 's nachts`);

// ------------------------------------------------- de geparkeerde auto's
/*
 De stapels geparkeerde auto's tekenen alleen nog wie in de buurt staat: die
 staan vooraan en `count` gaat omlaag (js/vehicles.js, `herschik`). Hier wordt
 nagerekend dat de telling klopt met wat er binnen het zicht staat, dat een
 kogel via het instantienummer nog steeds de goede auto raakt, dat verbergen en
 terugzetten werkt, en dat overspuiten een geparkeerde auto echt van kleur doet
 verschieten — dat deed het niet, want de stapel werd op de verkeerde sleutel
 gezocht.
*/
kop("de geparkeerde auto's");
const park = await page.evaluate(() => {
  const g = window.__game, V = g.vehicles;
  window.__zetNeer();
  const cx = g.camera.position.x, cz = g.camera.position.z;
  V.lod(cx, cz);
  let getekend = 0, totaal = 0, verwacht = 0, fouteSlot = 0;
  for (const k of Object.keys(V.stapels)) {
    const st = V.stapels[k];
    const n = st.stapel.meshes[0].count;
    totaal += st.autos.length;
    if (st.aan === false) continue;
    getekend += n;
    for (const c of st.autos) {
      if (!c || c.mesh || c.zichtbaar === false) continue;
      if (Math.hypot(c.x - cx, c.z - cz) < 170) verwacht++;
    }
    for (let i = 0; i < n; i++) if (!st.slot[i] || st.slot[i].inst.i !== i) fouteSlot++;
  }
  // een auto in beeld raken via zijn instantie, zoals een kogel dat doet
  let raak = null;
  for (const k of Object.keys(V.stapels)) {
    const st = V.stapels[k];
    if (st.aan === false || !st.slot.length) continue;
    const doel = st.slot[0];
    const hpVoor = doel.hp;
    const terug = V.hit(st.stapel.meshes[0], 0);
    raak = { goed: terug === doel, schade: hpVoor - doel.hp };
    doel.hp = hpVoor;
    break;
  }
  // overspuiten van een geparkeerde auto
  let verf = null;
  for (const k of Object.keys(V.stapels)) {
    const st = V.stapels[k];
    if (st.aan === false || !st.slot.length) continue;
    const doel = st.slot[0], lak = st.stapel.meshes[0];
    const oud = doel.kleur;
    V.verf(doel, 0x2e7d32);
    const a = lak.instanceColor.array, j = doel.inst.i * 3;
    verf = { g: +a[j + 1].toFixed(2), r: +a[j].toFixed(2) };
    V.verf(doel, oud);
    break;
  }
  // verbergen en terug
  V.zichtbaarheid(false);
  let naVerbergen = 0;
  for (const k of Object.keys(V.stapels)) naVerbergen += V.stapels[k].stapel.meshes[0].count;
  V.zichtbaarheid(true);
  V.lod(cx, cz);
  let naTerug = 0;
  for (const k of Object.keys(V.stapels)) if (V.stapels[k].aan !== false) naTerug += V.stapels[k].stapel.meshes[0].count;
  return { getekend, totaal, verwacht, fouteSlot, raak, verf, naVerbergen, naTerug };
});
ok(park.getekend === park.verwacht, "de stapels tekenen precies de auto's binnen het zicht",
  `${park.getekend} getekend, ${park.verwacht} binnen 170 m, ${park.totaal} in totaal`);
ok(park.getekend < park.totaal * 0.25, "dat is een fractie van alle geparkeerde auto's",
  `${Math.round(park.getekend / park.totaal * 100)}%`);
ok(park.fouteSlot === 0, 'en elke plek in een stapel wijst naar zijn eigen auto', `${park.fouteSlot} mis`);
ok(park.raak && park.raak.goed && park.raak.schade === 10, 'een kogel raakt via de instantie de goede auto',
  park.raak ? `schade ${park.raak.schade}` : 'geen auto in beeld');
ok(park.verf && park.verf.g > park.verf.r, 'overspuiten verandert de kleur van een geparkeerde auto',
  park.verf ? `groen ${park.verf.g} tegen rood ${park.verf.r}` : 'geen auto in beeld');
ok(park.naVerbergen === 0 && park.naTerug === park.getekend, 'verbergen en terugzetten werkt',
  `${park.naVerbergen} na verbergen, ${park.naTerug} na terugzetten`);

// ------------------------------------------ de omgevingsmap met de klok mee
/*
 De omgevingsmap wordt opnieuw gebakken als de lucht wezenlijk verandert. Dat
 mag geen enkel materiaal laten hervertalen: het doel heeft dezelfde maat, dus
 `envMapCubeUVHeight` blijft gelijk. En midden op de dag hoort er niet
 voortdurend gebakken te worden.
*/
kop('de omgevingsmap');
const omg = await page.evaluate(() => new Promise((klaar) => {
  const g = window.__game;
  g.sfeer.uur = 12;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const voor = { bak: g.__envBakken(), prog: g.renderer.info.programs.length, tex: g.scene.environment };
    g.sfeer.uur = 12.25;                            // midden op de dag: geen nieuwe bak
    const middag = g.__envBakken() - voor.bak;
    g.sfeer.uur = 1;                                // 's nachts: wel
    requestAnimationFrame(() => requestAnimationFrame(() => {
      klaar({
        middag, nacht: g.__envBakken() - voor.bak,
        andereKaart: g.scene.environment !== voor.tex,
        programmas: g.renderer.info.programs.length - voor.prog,
      });
      g.sfeer.uur = 12;
    }));
  }));
}));
ok(omg.middag === 0, 'midden op de dag wordt er niet opnieuw gebakken', `${omg.middag} keer`);
ok(omg.nacht >= 1 && omg.andereKaart, "'s nachts krijgt de wijk een eigen omgevingsmap", `${omg.nacht} keer gebakken`);
ok(omg.programmas === 0, 'en dat wisselen vertaalt geen enkele shader opnieuw', `${omg.programmas} nieuwe programma's`);

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
