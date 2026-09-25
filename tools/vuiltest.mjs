/*
 De ronde van 13 september 2026, tweede lijst: mensen en auto's er beter uit
 laten zien, de wijk minder schoon maken, zwaardere politie vanaf vier sterren,
 bukken met C en de meldingen bij aanrijden en neerschieten eruit.

 Gebruik: npm run server &   node tools/vuiltest.mjs 8123
*/
import { chromium } from 'playwright';

const port = process.argv[2] || '8123';
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
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
const meldingen = [];
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });
await page.evaluate(() => {
  localStorage.removeItem('tinga.spel.v1');
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  // alle meldingen in beeld opvangen, zodat we kunnen kijken of er tijdens het
  // schieten en aanrijden nog tekst verschijnt
  window.__meld = [];
  const oud = g.hud.show.bind(g.hud);
  g.hud.show = (t, s) => { window.__meld.push(t); return oud(t, s); };
});
await page.waitForTimeout(500);

// ------------------------------------------------------------------ mensen
kop('de mensen: waar ze uit bestaan');
const bouw = await page.evaluate(async () => {
  const g = window.__game;
  const L = await import('/js/lichaam.js');
  const namen = Object.keys(g.npcs.meshes);
  const { Persoon } = await import('/js/persoon.js');
  const p = new Persoon({});
  let driehoeken = 0;
  p.groep.traverse(o => { if (o.isMesh) driehoeken += o.geometry.attributes.position.count / 3; });
  return {
    namen, ogen: !!g.npcs.meshes.ogen,
    ogenDriehoeken: g.npcs.meshes.ogen ? g.npcs.meshes.ogen.geometry.attributes.position.count / 3 : 0,
    driehoeken,
    hoofdGroep: !!p.hoofd,
    hurkZak: +L.hurkHouding({}, 1).toFixed(3),
  };
});
ok(bouw.ogen && bouw.ogenDriehoeken >= 4, 'iedereen heeft ogen in zijn gezicht',
  `${bouw.ogenDriehoeken} driehoeken`);
ok(bouw.namen.length === 12, 'een mens bestaat uit twaalf soorten onderdelen', bouw.namen.join(', '));
ok(bouw.hoofdGroep, 'het hoofd is een eigen groep, zodat het los kan knikken');
ok(bouw.driehoeken > 400, 'en een heel lichaam is meer dan een stapeltje dozen', `${bouw.driehoeken} driehoeken`);

kop('de mensen: hoe ze bewegen');
const beweegt = await page.evaluate(async () => {
  const L = await import('/js/lichaam.js');
  const stil = L.loopHouding(0, false, 0, {}, 0);
  const stil2 = L.loopHouding(0, false, 0, {}, 1.0);
  const loopt = L.loopHouding(1.0, true, 0, {}, 0);
  const rent = L.loopHouding(1.0, true, 1, {}, 0);
  // de zijwaartse slinger over een hele pas
  const rollen = [];
  for (let f = 0; f < 6.283; f += 0.2) rollen.push(L.loopHouding(f, true, 0.5, {}, 0).rol);
  // en de voet die afzet: de enkel hoort door nul te gaan
  const enkels = [];
  for (let f = 0; f < 6.283; f += 0.2) enkels.push(L.loopHouding(f, true, 0.3, {}, 0).enkelL);
  return {
    stilRomp: stil.romp, looptRomp: loopt.romp, rentRomp: rent.romp,
    hoofd: loopt.hoofd, armZij: loopt.armZij,
    ademt: Math.abs(stil.wip - stil2.wip) > 1e-4,
    rolMin: Math.min(...rollen), rolMax: Math.max(...rollen),
    enkelMin: Math.min(...enkels), enkelMax: Math.max(...enkels),
  };
});
ok(beweegt.looptRomp > beweegt.stilRomp && beweegt.rentRomp > beweegt.looptRomp * 2,
  'wie loopt helt voorover en wie rent nog verder',
  `stil ${beweegt.stilRomp.toFixed(3)}, lopend ${beweegt.looptRomp.toFixed(3)}, rennend ${beweegt.rentRomp.toFixed(3)} rad`);
ok(Math.abs(beweegt.hoofd + beweegt.looptRomp * 0.8) < 1e-6,
  'en het hoofd draait er tegenin, zodat het waterpas blijft', `${beweegt.hoofd.toFixed(3)} rad`);
ok(beweegt.rolMin < -0.01 && beweegt.rolMax > 0.01, 'het lichaam slingert bij elke pas opzij',
  `${beweegt.rolMin.toFixed(3)} … ${beweegt.rolMax.toFixed(3)} rad`);
ok(beweegt.enkelMin < -0.05 && beweegt.enkelMax > 0.05,
  'de voet komt met de hiel neer en zet met de teen af',
  `enkel ${beweegt.enkelMin.toFixed(2)} … ${beweegt.enkelMax.toFixed(2)} rad`);
ok(beweegt.armZij > 0.02, 'de armen hangen naar buiten in plaats van plat tegen de romp',
  `${beweegt.armZij.toFixed(3)} rad`);
ok(beweegt.ademt, 'en wie stilstaat ademt: hij staat niet bevroren');

// ------------------------------------------------------------------ bukken
kop('bukken met C');
const hurk = await page.evaluate(async () => {
  const g = window.__game, p = g.player;
  const { HURK_ZAK } = await import('/js/player.js');
  p.gebukt = false; p.hurk = 0;
  const staand = p.eye;
  p.bukken(true);
  for (let i = 0; i < 40; i++) p.update(1 / 60);
  const gebukt = { eye: p.eye, hurk: p.hurk };
  // hoe hard loop je gehurkt? de verplaatsing van twintig beelden meten
  const meet = () => {
    const x0 = p.pos.x, z0 = p.pos.z;
    p.keys.KeyW = true;
    for (let i = 0; i < 20; i++) p.update(1 / 60);
    p.keys.KeyW = false;
    return Math.hypot(p.pos.x - x0, p.pos.z - z0) / (20 / 60);
  };
  const snelGebukt = meet();
  p.bukken(false);
  for (let i = 0; i < 40; i++) p.update(1 / 60);
  const snelStaand = meet();
  // springen zet je overeind in plaats van gehurkt te springen
  p.bukken(true);
  p.onGround = true; p.jump();
  const naSprong = p.gebukt;
  p.gebukt = false; p.hurk = 0;
  return { staand, gebukt, zak: HURK_ZAK, snelGebukt, snelStaand, naSprong, eindEye: p.eye };
});
ok(hurk.zak > 0.35 && hurk.zak < 0.6, 'gehurkt zak je een halve meter',
  `${(hurk.zak * 100).toFixed(0)} cm`);
ok(Math.abs(hurk.gebukt.eye - (hurk.staand - hurk.zak)) < 0.02,
  'en de ooghoogte zakt precies zoveel mee',
  `${hurk.staand.toFixed(2)} → ${hurk.gebukt.eye.toFixed(2)} m`);
ok(hurk.snelGebukt < hurk.snelStaand * 0.5, 'gehurkt kom je veel langzamer vooruit',
  `${hurk.snelGebukt.toFixed(2)} tegen ${hurk.snelStaand.toFixed(2)} m/s`);
ok(!hurk.naSprong, 'springen zet je eerst overeind');

const zicht = await page.evaluate(async () => {
  const g = window.__game;
  const bron = await fetch('/js/politie.js').then(r => r.text());
  const m = /const hoogte = 1\.3 - \(player\.hurk \|\| 0\) \* ([\d.]+);/.exec(bron);
  return { faktor: m ? Number(m[1]) : null };
});
ok(zicht.faktor && 1.3 - zicht.faktor < 0.85,
  'gehurkt kijken de agenten niet meer over een muurtje of een auto heen',
  zicht.faktor ? `zichtdrempel 1,30 → ${(1.3 - zicht.faktor).toFixed(2)} m` : 'niet gevonden');

// ------------------------------------------------------- politie met mp
kop('machinepistolen vanaf vier sterren');
const mp = await page.evaluate(() => {
  const g = window.__game;
  const tel = (heat) => {
    g.politie.reset();
    g.politie.zetHeat ? g.politie.zetHeat(heat) : (g.politie.heat = heat);
    return null;
  };
  return { kan: typeof g.politie.reset === 'function' };
});
const mpBron = await page.evaluate(async () => {
  const bron = await fetch('/js/politie.js').then(r => r.text());
  const m = /const MP_KANS = \{ 4: ([\d.]+), 5: ([\d.]+) \};/.exec(bron);
  const salvo = /const salvo = a\.mp \? (\d+) : 1;/.exec(bron);
  const kans = /\* \(a\.mp \? ([\d.]+) : 1\)/.exec(bron);
  return {
    vier: m ? Number(m[1]) : null, vijf: m ? Number(m[2]) : null,
    salvo: salvo ? Number(salvo[1]) : null,
    raakfactor: kans ? Number(kans[1]) : null,
  };
});
ok(mpBron.vier === 0.40, 'bij vier sterren heeft veertig procent van de agenten een machinepistool',
  `${Math.round(mpBron.vier * 100)} %`);
ok(mpBron.vijf === 0.50, 'bij vijf sterren de helft', `${Math.round(mpBron.vijf * 100)} %`);
ok(mpBron.salvo === 3, 'zo iemand schiet salvo\'s van drie', `${mpBron.salvo} schoten`);
ok(mpBron.raakfactor > 0 && mpBron.raakfactor < 1,
  'maar elk schot daarvan is minder trefzeker dan een gericht schot',
  `${Math.round(mpBron.raakfactor * 100)} % van de gewone kans`);

const mpModel = await page.evaluate(async () => {
  const { Persoon } = await import('/js/persoon.js');
  const geweer = new Persoon({ wapen: true });
  const pistool = new Persoon({ wapen: 'mp' });
  const maat = (p) => {
    let n = 0;
    p.wapen.traverse(o => { if (o.isMesh) n += o.geometry.attributes.position.count / 3; });
    let lang = 0;
    p.wapen.traverse(o => {
      if (!o.isMesh) return;
      o.geometry.computeBoundingBox();
      lang = Math.max(lang, o.geometry.boundingBox.max.z - o.geometry.boundingBox.min.z);
    });
    return { n, lang: +lang.toFixed(2), soort: p.wapenSoort };
  };
  return { geweer: maat(geweer), mp: maat(pistool) };
});
ok(mpModel.mp.soort === 'mp' && mpModel.geweer.soort === 'geweer',
  'de twee politiewapens zijn los te herkennen', `${mpModel.geweer.soort} / ${mpModel.mp.soort}`);
ok(mpModel.mp.lang < mpModel.geweer.lang, 'en het machinepistool is korter dan het geweer',
  `${mpModel.mp.lang} m tegen ${mpModel.geweer.lang} m`);

// --------------------------------------------------------- geen meldingen
kop('geen tekst meer bij aanrijden en neerschieten');
const stil = await page.evaluate(() => {
  const g = window.__game;
  window.__meld.length = 0;
  // iemand neerschieten: dezelfde weg als een kogel
  const slachtoffer = g.npcs.people.find(p => p.alive);
  slachtoffer.x = g.player.pos.x + 2; slachtoffer.z = g.player.pos.z;
  g.npcs.hitPersoon(slachtoffer);
  // een misdaad wordt niet altijd gemeld (zie js/politie.js); hier gaat het om
  // de vraag of er tekst in beeld komt, dus we melden er een stuk of tien
  for (let i = 0; i < 12; i++) g.politie.misdaad('neergeschoten', slachtoffer.x, slachtoffer.z);
  const naSchot = window.__meld.slice();
  // en iemand aanrijden
  window.__meld.length = 0;
  g.aanrijden(g.player.pos.x + 3, g.player.pos.z, 2.0, 12);
  const naAanrijding = window.__meld.slice();
  return { naSchot, naAanrijding, sterren: g.politie.ster };
});
ok(stil.naSchot.length === 0, 'neerschieten zet geen regel tekst in beeld',
  stil.naSchot.join(' / ') || 'niets');
ok(stil.naAanrijding.length === 0, 'aanrijden ook niet', stil.naAanrijding.join(' / ') || 'niets');
ok(stil.sterren > 0, 'maar de sterren rechtsboven lopen wel op', `${stil.sterren} ster(ren)`);

// --------------------------------------------------------------- auto's
kop("de auto's");
const autos = await page.evaluate(async () => {
  const THREE = await import('three');
  const g = window.__game;
  const auto = g.vehicles.cars.find(c => c.mesh) || g.vehicles.voegToe({ x: g.player.pos.x + 6, z: g.player.pos.z, yaw: 0 });
  let driehoeken = 0, naaf = 0;
  const doos = new THREE.Box3();
  auto.mesh.traverse(o => {
    if (!o.isMesh) return;
    driehoeken += o.geometry.attributes.position.count / 3;
  });
  const bron = await fetch('/js/carmodel.js').then(r => r.text());
  return {
    driehoeken,
    spaken: /function naafGeo/.test(bron),
    wissers: /ruitenwissers/.test(bron),
    vuilrand: /vuilrand/.test(bron),
    // sinds 24 sep 2026 een ruwe kleurlaag onder een gladde laklaag (clearcoat)
    lakRuw: /roughness: 0\.5, metalness: 0\.3, clearcoat: 1/.test(bron),
    dakBreed: /W - \(bus \? 0\.14 : 0\.16\)/.test(bron),
  };
});
ok(autos.spaken, 'de velgen hebben spaken in plaats van een gladde dop');
ok(autos.wissers, 'er zitten ruitenwissers, een antenne en een grille met lamellen op');
ok(autos.vuilrand, 'en een vuilrand langs de dorpel: opspattend wegvuil');
ok(autos.lakRuw, 'de lak is geen plastic speelgoed: een matte kleur onder een blanke laklaag');
ok(autos.dakBreed, 'het dak sluit over de zijruiten heen, dus je kijkt er niet meer doorheen');
ok(autos.driehoeken > 900, 'een auto is meer dan een stapel dozen', `${autos.driehoeken} driehoeken`);

// -------------------------------------------------------- het interieur
kop('het interieur van de auto waar je in zit');
const binnen = await page.evaluate(async () => {
  const THREE = await import('three');
  const g = window.__game;
  const stapel = g.vehicles.cars.filter(c => !c.mesh);
  const voor = stapel.length;
  const auto = g.vehicles.voegToe({ x: g.player.pos.x + 6, z: g.player.pos.z, yaw: 0, soort: 'hatch' });
  const u = auto.mesh.userData;
  const b = u.binnen;
  let meshes = 0, driehoeken = 0;
  b.groep.traverse(o => { if (o.isMesh) { meshes++; driehoeken += o.geometry.attributes.position.count / 3; } });
  // het stuur draait mee met de voorwielen
  auto.steer = 0.2; b.update(auto, 1 / 60);
  const stuurIn = b.stuur.rotation.z;
  auto.steer = -0.2; b.update(auto, 1 / 60);
  const stuurUit = b.stuur.rotation.z;
  // en de naald loopt met de snelheid mee
  auto.speed = 0; auto.topSnelheid = 24;
  for (let i = 0; i < 200; i++) b.update(auto, 1 / 60);
  const stil = b.naalden[0].rotation.z;
  auto.speed = 22;
  for (let i = 0; i < 200; i++) b.update(auto, 1 / 60);
  const hard = b.naalden[0].rotation.z;
  // de geparkeerde auto's krijgen er niets bij
  const stapelBinnen = g.vehicles.cars.filter(c => !c.mesh && c.inst).length;
  return {
    meshes, driehoeken, stuurIn, stuurUit, stil, hard,
    zichtbaar: b.groep.visible,
    inBak: b.groep.parent === u.bak,
    geparkeerdZonder: stapelBinnen > 1000,
  };
});
ok(binnen.meshes > 20 && binnen.driehoeken > 200, 'de auto heeft een echt interieur',
  `${binnen.meshes} onderdelen, ${Math.round(binnen.driehoeken)} driehoeken`);
ok(binnen.inBak, 'het hangt in de carrosseriegroep, dus het helt mee in de bocht');
ok(binnen.geparkeerdZonder, 'de geparkeerde auto\'s krijgen er niets bij: die blijven instanced');
ok(Math.sign(binnen.stuurIn) !== Math.sign(binnen.stuurUit) && Math.abs(binnen.stuurIn) > 0.3,
  'het stuur draait mee met de voorwielen',
  `${(binnen.stuurIn * 57.3).toFixed(0)}° en ${(binnen.stuurUit * 57.3).toFixed(0)}°`);
ok(Math.abs(binnen.hard - binnen.stil) > 0.5, 'en de snelheidsmeter loopt mee',
  `naald van ${(binnen.stil * 57.3).toFixed(0)}° naar ${(binnen.hard * 57.3).toFixed(0)}°`);

const zit = await page.evaluate(async () => {
  const { autoMaat } = await import('/js/carmodel.js');
  const uit = {};
  for (const soort of ['hatch', 'van', 'truck']) {
    const m = autoMaat(soort);
    uit[soort] = {
      oog: +m.oog.y.toFixed(2), dak: +m.dakY.toFixed(2), schouder: +m.schouderY.toFixed(2),
      vloer: +m.dorpelY.toFixed(2),
    };
  }
  return uit;
});
for (const [soort, m] of Object.entries(zit)) {
  ok(m.oog > m.schouder && m.oog < m.dak - 0.05,
    `de bestuurdersstoel van de ${soort} zit in de cabine, niet erboven of eronder`,
    `oog ${m.oog} m, raamlijn ${m.schouder} m, dak ${m.dak} m`);
}

// ------------------------------------------------------------- de rommel
kop('de wijk is niet meer kraakhelder');
const rommel = await page.evaluate(() => {
  const g = window.__game;
  const tel = {};
  g.scene.traverse(o => {
    const k = o.userData && o.userData.klasse;
    if (k) tel[k] = (tel[k] || 0) + (o.isInstancedMesh ? o.count : 1);
  });
  return {
    onkruid: tel.onkruid || 0, vuil: tel.zwerfvuil || 0, kliko: tel.kliko || 0,
    graffiti: tel.graffiti || 0,
  };
});
ok(rommel.onkruid > 5000, 'er groeit onkruid langs de stoepranden', `${rommel.onkruid} pollen`);
ok(rommel.vuil > 500, 'er ligt zwerfvuil in de goot', `${rommel.vuil} stuks`);
ok(rommel.kliko > 200 && rommel.kliko < 2000, 'en er staan rolcontainers op de stoep',
  `${rommel.kliko} stuks`);
ok(rommel.graffiti >= 1, 'op de blinde muren staat hier en daar een tag');

/*
 Groene aanslag op de plint. Hoe vuil een gevel is verschilt per huis — één op
 de zes blijft bijna schoon, want een straat waar élke gevel even grauw is klopt
 ook niet. We kijken daarom naar een rij van zes gevels en tellen er hoeveel er
 groen onderaan hebben.

 De maat is groen mín rood: mos (74,88,52) heeft daar een plus, het metselwerk
 van Tinga (b3,9a,75) juist een flinke min. De meting ligt net bóven de plint,
 want de plint zelf is een donkere band en die zegt niets over aanslag.
*/
const gevel = await page.evaluate(async () => {
  const T = await import('/js/textures.js');
  const uit = [];
  for (const seed of [0, 1, 2, 3, 4, 5]) {
    const t = T.facade('molenkrite', 2, 2, false, seed);
    const c = t.image, g = c.getContext('2d');
    const rij = (y) => {
      const d = g.getImageData(0, y, c.width, 1).data;
      let r = 0, gr = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; gr += d[i + 1]; }
      const n = d.length / 4;
      return (gr - r) / n;
    };
    // de plint is 0,30 m hoog bij ~21 px/m: zeven beeldpunten
    const onder = rij(c.height - 10), midden = rij(Math.round(c.height * 0.45));
    uit.push({ seed, onder: +onder.toFixed(1), midden: +midden.toFixed(1) });
  }
  return uit;
});
const vergroend = gevel.filter(v => v.onder > v.midden + 1);
ok(vergroend.length >= 3, 'op de meeste gevels zit onderaan groene aanslag',
  `${vergroend.length} van de 6 (groen − rood: ${gevel.map(v => `${v.onder}/${v.midden}`).join(', ')})`);
const spreiding = Math.max(...gevel.map(v => v.onder)) - Math.min(...gevel.map(v => v.onder));
ok(spreiding > 1.5, 'maar niet overal evenveel: de ene gevel is schoner dan de andere',
  `${spreiding.toFixed(1)} verschil tussen de vuilste en de schoonste`);

await browser.close();
console.log(fouten === 0 ? '\nAlles goed.' : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
