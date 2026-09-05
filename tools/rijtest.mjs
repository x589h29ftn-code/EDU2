/*
 Toetst het rijden: het automodel, het rijgedrag, de camera achter je en het
 aanrijden van voetgangers.

 1. Model: een geparkeerde auto is de zuinige uitvoering (zeven meshes, 329 keer
    in de wijk); de auto waar je in stapt krijgt losse wielen, remlichten en een
    carrosserie die kan overhellen.
 2. Rijden: optrekken, topsnelheid, motorrem, remmen, achteruit, stuuruitslag
    die met de snelheid afneemt, en de handrem die de auto laat glijden.
 3. Meebewegen: voorwielen sturen, alle wielen rollen, de carrosserie helt over
    en duikt, en de rem- en achteruitrijlichten gaan aan.
 4. Camera achter je (V): achter de speler, achter de auto, korter bij een muur,
    het poppetje te voet zichtbaar en in de auto niet, en richten vanaf de
    schouder in plaats van vanaf de camera.
 5. Voetgangers aanrijden: raak boven de drempelsnelheid, niet bij stapvoets, en
    ze staan later verderop weer op.
 6. Schrikken: van een schot en van een aanrijding rent iedereen in de buurt
    weg, met een reactietijd, een realistisch looptempo en van de knal af.
 7. Auto's raken elkaar in plaats van door elkaar heen te rijden.

 Gebruik: python3 -m http.server 8123 &  node tools/rijtest.mjs 8123
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
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
await page.evaluate(() => {
  localStorage.removeItem('tinga.spel.v1');
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  // Headless haalt maar een beeld per seconde, dus de beelden worden hier met
  // de hand gedraaid; dezelfde volgorde als in de hoofdlus van js/main.js.
  window.__rij = (n, keys = {}, dt = 1 / 30) => {
    const p = g.player;
    for (let i = 0; i < n; i++) {
      Object.assign(p.keys, keys);
      if (p.inCar) {
        g.vehicles.drive(p.inCar, p.keys, dt, g.aanrijden);
        if (p.lastCarYaw !== undefined) p.yaw += p.inCar.yaw - p.lastCarYaw;
        p.lastCarYaw = p.inCar.yaw;
      }
      g.vehicles.updateTraffic(dt, p, g.npcs.people);
      g.npcs.update(dt, 0);
      g.derde.update(dt, p.inCar || null);
    }
    for (const k of Object.keys(keys)) p.keys[k] = false;
  };
  // een verse auto op een recht stuk, zodat de proef niet van de omgeving afhangt
  window.__rechtstuk = null;
  window.__verseAuto = async () => {
    const { KAART } = await import('./js/kaart.js');
    const as = KAART.wegassen.filter(w => w.drive && w.naam === 'Molenkrite' && w.lengte > 60)[0];
    const a = as.pts[0], b = as.pts[as.pts.length - 1];
    window.__rechtstuk = { x: a[0], z: a[1], yaw: Math.atan2(-(b[0] - a[0]), -(b[1] - a[1])) };
    const auto = g.vehicles.voegToe({ ...window.__rechtstuk, soort: 'hatch', kleur: 0x9c1f1f });
    g.player.inCar = auto; g.player.lastCarYaw = auto.yaw;
    g.player.pos.set(a[0], 0, a[1]);
    window.__auto = auto;
    return auto;
  };
  // ver buiten de wijk, waar niets in de weg staat: daar is het rijgedrag zelf
  // te meten zonder dat een gevel of een boom de proef verstoort
  window.__leegveld = () => {
    const c = window.__auto;
    c.x = 2500; c.z = 2500; c.yaw = 0; c.rij = 0; c.speed = 0; c.steer = 0;
    g.player.inCar = c; g.player.lastCarYaw = c.yaw;
    return c;
  };
  // de auto terugzetten op dat rechte stuk, los van waar hij beland is
  window.__terug = () => {
    const c = window.__auto, s = window.__rechtstuk;
    c.x = s.x; c.z = s.z; c.yaw = s.yaw; c.rij = s.yaw; c.speed = 0; c.steer = 0;
    g.player.inCar = c; g.player.lastCarYaw = c.yaw;
    c.mesh.userData.bak.rotation.set(0, 0, 0);
    return c;
  };
});
await page.waitForTimeout(800);

// ---------- 1. het model ----------
kop('het automodel');
const model = await page.evaluate(() => {
  const g = window.__game;
  const stil = g.vehicles.cars.find(c => c.driveable && !c.mesh.userData.wielen);
  const tel = (o) => { let n = 0; o.traverse(q => { if (q.isMesh) n++; }); return n; };
  const voor = tel(stil.mesh);
  const voorTotaal = (() => { let n = 0; g.scene.traverse(q => { if (q.isMesh) n++; }); return n; })();
  g.vehicles.maakBestuurbaar(stil);
  const naTotaal = (() => { let n = 0; g.scene.traverse(q => { if (q.isMesh) n++; }); return n; })();
  const u = stil.mesh.userData;
  return {
    stilMeshes: voor, rijdendMeshes: tel(stil.mesh), erbij: naTotaal - voorTotaal,
    wielen: u.wielen ? u.wielen.length : 0,
    stuurwielen: u.wielen ? u.wielen.filter(w => w.stuur).length : 0,
    remlicht: !!u.rem, achteruit: !!u.achteruit, bak: !!u.bak,
    lengte: u.length, autos: g.vehicles.cars.length,
    driehoeken: stil.mesh.userData.bak.children[0].geometry.attributes.position.count / 3,
  };
});
ok(model.stilMeshes === 7, `een geparkeerde auto is zeven meshes (${model.autos} stuks in de wijk)`, `${model.stilMeshes}`);
ok(model.wielen === 4 && model.stuurwielen === 2, 'de auto waar je in stapt heeft vier losse wielen, waarvan twee sturen',
  `${model.wielen} wielen, ${model.stuurwielen} gestuurd`);
ok(model.remlicht && model.achteruit && model.bak, 'met remlichten, achteruitrijlichten en een kantelende carrosserie');
ok(model.erbij <= 12, 'en dat kost maar een handvol meshes extra', `${model.erbij} erbij`);
ok(model.driehoeken > 120, `de carrosserie is meer dan een doos (${model.driehoeken} driehoeken lak)`);

// ---------- 2. rijden ----------
kop('rijgedrag');
await page.evaluate(async () => { window.__auto = await window.__verseAuto(); });
const optrekken = await page.evaluate(() => {
  const c = window.__leegveld();
  const v = [];
  for (const n of [15, 15, 60, 400]) { window.__rij(n, { KeyW: true }); v.push(+c.speed.toFixed(2)); }
  return { na05: v[0], na1: v[1], na3: v[2], top: v[3], ingesteld: c.topSnelheid || 24 };
});
ok(optrekken.na05 > 1 && optrekken.na05 < optrekken.na1, 'gas geven trekt op', `${optrekken.na05} → ${optrekken.na1} m/s`);
ok(optrekken.na3 > optrekken.na1 && optrekken.na3 < optrekken.top, 'en blijft doortrekken', `${optrekken.na3} m/s na drie seconden`);
ok(optrekken.top > optrekken.ingesteld * 0.9 && optrekken.top <= optrekken.ingesteld,
  'tot net onder de topsnelheid', `${optrekken.top} van ${optrekken.ingesteld} m/s`);

const uitrollen = await page.evaluate(() => {
  const c = window.__game.player.inCar;
  const voor = c.speed;
  window.__rij(60);                        // gas los
  const na = c.speed;
  window.__rij(6, { KeyS: true });         // remmen, nog wel vooruit
  const remlicht = c.mesh.userData.rem.visible;
  window.__rij(9, { KeyS: true });
  const geremd = c.speed;
  return { voor: +voor.toFixed(2), na: +na.toFixed(2), geremd: +geremd.toFixed(2), remlicht };
});
ok(uitrollen.na < uitrollen.voor - 1, 'los gas remt af op de motor en de lucht', `${uitrollen.voor} → ${uitrollen.na} m/s`);
ok(uitrollen.geremd < uitrollen.na - 3, 'de rem gaat harder dan uitrollen', `${uitrollen.na} → ${uitrollen.geremd} m/s`);
ok(uitrollen.remlicht, 'en de remlichten branden');

const achteruit = await page.evaluate(() => {
  const c = window.__game.player.inCar;
  window.__rij(90, { KeyS: true });
  const licht = c.mesh.userData.achteruit.visible;
  const traag = c.speed;
  window.__rij(30, { KeyW: true });
  return { snelheid: +traag.toFixed(2), licht, weerVooruit: +c.speed.toFixed(2) };
});
ok(achteruit.snelheid < -2 && achteruit.snelheid > -9, 'achteruit rijdt hij langzamer dan vooruit', `${achteruit.snelheid} m/s`);
ok(achteruit.licht, 'met de achteruitrijlichten aan');
ok(achteruit.weerVooruit > achteruit.snelheid, 'gas geven remt hem eerst af', `${achteruit.weerVooruit} m/s`);

const sturen = await page.evaluate(() => {
  const c = window.__leegveld();
  window.__rij(30, { KeyA: true });
  const stil = Math.abs(c.steer);
  c.speed = 22; c.steer = 0; window.__rij(30, { KeyA: true });
  const snel = Math.abs(c.steer);
  return { stil: +stil.toFixed(3), snel: +snel.toFixed(3) };
});
ok(sturen.stil > sturen.snel * 1.6, 'de stuuruitslag wordt kleiner naarmate je harder rijdt',
  `${sturen.stil} rad stil, ${sturen.snel} rad op 22 m/s`);

const drift = await page.evaluate(() => {
  const c = window.__leegveld();
  c.speed = 12;
  window.__rij(25, { KeyW: true, KeyA: true });
  const grip = Math.abs(c.slip);
  window.__leegveld(); c.speed = 12;
  window.__rij(25, { KeyA: true, Space: true });
  const hand = Math.abs(c.slip);
  return { grip: +grip.toFixed(3), hand: +hand.toFixed(3) };
});
ok(drift.hand > drift.grip * 1.5, 'met de handrem breekt de kont uit', `slip ${drift.grip} → ${drift.hand} rad`);

// ---------- 3. het model beweegt mee ----------
kop('het model beweegt mee');
const beweegt = await page.evaluate(() => {
  const c = window.__leegveld(), u = c.mesh.userData;
  u.bak.rotation.set(0, 0, 0);
  const rolVoor = u.wielen[0].band.rotation.x;
  window.__rij(40, { KeyW: true });
  const gerold = Math.abs(u.wielen[0].band.rotation.x - rolVoor);
  window.__rij(30, { KeyW: true, KeyD: true });
  const stuurhoek = u.wielen[0].groep.rotation.y, stuur = c.steer;
  const overhelling = u.bak.rotation.z;
  window.__rij(12, { KeyS: true });
  const duik = u.bak.rotation.x;
  return { gerold: +gerold.toFixed(2), stuurhoek: +stuurhoek.toFixed(3),
    overhelling: +overhelling.toFixed(3), duik: +duik.toFixed(3), stuur: +stuur.toFixed(3) };
});
ok(beweegt.gerold > 5, 'de wielen rollen mee met de afgelegde weg', `${beweegt.gerold} rad`);
ok(Math.abs(beweegt.stuurhoek - beweegt.stuur) < 0.06, 'de voorwielen staan in de stuurhoek',
  `wiel ${beweegt.stuurhoek}, stuur ${beweegt.stuur}`);
ok(Math.abs(beweegt.overhelling) > 0.01, 'de carrosserie helt over in de bocht', `${beweegt.overhelling} rad`);
ok(Math.abs(beweegt.duik) > 0.004, 'en duikt bij het remmen', `${beweegt.duik} rad`);

// ---------- 4. de camera achter je ----------
kop('camera achter je (V)');
const inAuto = await page.evaluate(() => {
  const g = window.__game, c = g.player.inCar;
  g.derde.aan = false;
  g.derde.achterAuto(c);
  g.derde.aan = true;
  c.speed = 0;
  window.__rij(60);
  const cam = g.camera.position;
  // achter de auto = tegenover de rijrichting
  const vx = -Math.sin(c.yaw), vz = -Math.cos(c.yaw);
  const dx = cam.x - c.x, dz = cam.z - c.z;
  return { achter: -(dx * vx + dz * vz), hoog: +cam.y.toFixed(2), afstand: +g.derde.afstand.toFixed(2),
    pop: g.derde.pop.groep.visible };
});
ok(inAuto.achter > 3, 'in de auto staat de camera achter de auto', `${inAuto.achter.toFixed(1)} m erachter`);
ok(inAuto.hoog > 1.5 && inAuto.hoog < 5, 'en wat hoger', `${inAuto.hoog} m`);
ok(!inAuto.pop, 'het poppetje is dan onzichtbaar');

const teVoet = await page.evaluate(() => {
  const g = window.__game;
  g.player.inCar = null; g.player.lastCarYaw = undefined;
  window.__rij(40);
  const cam = g.camera.position, p = g.player.pos;
  const vx = -Math.sin(g.player.yaw), vz = -Math.cos(g.player.yaw);
  return { achter: -((cam.x - p.x) * vx + (cam.z - p.z) * vz), pop: g.derde.pop.groep.visible,
    afstand: +g.derde.afstand.toFixed(2),
    popX: +g.derde.pop.groep.position.x.toFixed(2), spelerX: +p.x.toFixed(2) };
});
ok(teVoet.achter > 2, 'te voet staat hij achter je', `${teVoet.achter.toFixed(1)} m`);
ok(teVoet.pop, 'en zie je jezelf lopen');
ok(Math.abs(teVoet.popX - teVoet.spelerX) < 0.01, 'het poppetje staat op de plek van de speler');

const muur = await page.evaluate(async () => {
  const { KAART } = await import('./js/kaart.js');
  const g = window.__game;
  // pal voor de gevel van Molenkrite 15 gaan staan, met de rug naar het huis
  const p = KAART.panden.find(q => q.straat === 'Molenkrite' && (q.nr || []).includes('15'));
  const u = [Math.cos(p.rect.hoek), Math.sin(p.rect.hoek)];
  const f = p.front, diep = Math.abs(f[0] * u[0] + f[1] * u[1]) > 0.7 ? p.rect.hx : p.rect.hz;
  const gx = p.rect.cx + f[0] * diep, gz = p.rect.cz + f[1] * diep;
  g.player.pos.set(gx + f[0] * 1.4, 0, gz + f[1] * 1.4);
  g.player.yaw = Math.atan2(-f[0], -f[1]);             // van het huis af: de camera wil erin
  g.player.pitch = 0;
  window.__rij(60);
  const kort = g.derde.afstand;
  // omdraaien: nu wil de camera het vrije gras op
  g.player.yaw = Math.atan2(f[0], f[1]);
  window.__rij(80);
  return { kort: +kort.toFixed(2), vrij: +g.derde.afstand.toFixed(2) };
});
ok(muur.kort < 2.2, 'staat er een muur achter je, dan kort de camera in', `${muur.kort} m`);
ok(muur.vrij > 3, 'en schuift hij weer uit zodra het vrij is', `${muur.vrij} m`);

const mikken = await page.evaluate(async () => {
  const THREE = await import('three');
  const g = window.__game;
  const origin = g.camera.getWorldPosition(new THREE.Vector3());
  const dir = new THREE.Vector3(); g.camera.getWorldDirection(dir);
  const m = g.derde.mikpunt(origin, dir);
  const bijSpeler = Math.hypot(m.origin.x - g.player.pos.x, m.origin.z - g.player.pos.z);
  const doel = origin.clone().addScaledVector(dir, 80);
  const langs = m.origin.clone().addScaledVector(m.dir, m.origin.distanceTo(doel));
  return { bijSpeler: +bijSpeler.toFixed(2), mist: +langs.distanceTo(doel).toFixed(2), hoogte: +m.origin.y.toFixed(2) };
});
ok(mikken.bijSpeler < 0.2, 'de kogel komt uit je schouder en niet uit de camera', `${mikken.bijSpeler} m ernaast`);
ok(mikken.mist < 0.05, 'en gaat precies naar het punt onder het kruisje', `${mikken.mist} m mis`);

// ---------- 5. voetgangers aanrijden ----------
kop('voetgangers aanrijden');
const omver = await page.evaluate(() => {
  const g = window.__game;
  const zet = (snelheid) => {
    const p = g.npcs.people.find(q => q.alive);
    const c = g.player.inCar || window.__auto;
    g.player.inCar = c; g.player.lastCarYaw = c.yaw;
    c.x = p.x - 4; c.z = p.z;
    c.yaw = Math.atan2(-(p.x - c.x), -(p.z - c.z)); c.rij = c.yaw; c.speed = snelheid;
    return p;
  };
  // stapvoets: hij blijft staan
  let p = zet(0.8);
  window.__rij(40);
  const stapvoets = p.alive;
  // met vaart: hij gaat neer en schuift door
  p = zet(11);
  const voor = g.npcs.people.filter(q => q.alive).length;
  window.__rij(30, { KeyW: true });
  const na = g.npcs.people.filter(q => q.alive).length;
  const geraakt = !p.alive;
  const smak = p.smak ? +(p.smak.weg || 0).toFixed(2) : 0;
  // en na een halve minuut staat hij weer ergens op
  p.respawn = 0.05;
  g.npcs.update(0.1, 0);
  return { stapvoets, geraakt, aantal: voor - na, smak, weerOp: p.alive, smakNa: !!p.smak };
});
ok(omver.stapvoets, 'stapvoets rijd je niemand omver');
ok(omver.geraakt && omver.aantal >= 1, 'met vaart gaat hij tegen de vlakte', `${omver.aantal} geraakt`);
ok(omver.smak > 0.2, 'en schuift hij een stuk door', `${omver.smak} m`);
ok(omver.weerOp && !omver.smakNa, 'later staat hij verderop weer op');

const geluid = await page.evaluate(() => {
  const el = document.getElementById('msg');
  return { tekst: el.textContent, zichtbaar: el.style.opacity !== '0' };
});
ok(/aangereden/i.test(geluid.tekst), 'de HUD meldt het', geluid.tekst);

// ---------- 6. schrikken en wegrennen ----------
kop('schrikken en wegrennen');
const schrik = await page.evaluate(() => {
  const g = window.__game;
  g.player.inCar = null; g.player.lastCarYaw = undefined;
  const p = g.npcs.people.find(q => q.alive && !q.fietst && q.steek === 0);
  const ver = g.npcs.people.find(q => q.alive && q !== p && Math.hypot(q.x - p.x, q.z - p.z) > 90);
  const bron = { x: p.x, z: p.z };
  const wandel = p.speed;
  const aantal = g.npcs.paniek(bron.x, bron.z, 26);
  const meteen = { paniek: p.paniek, schrik: p.schrik, vNu: p.vNu };
  window.__rij(6);                                    // eerste vijfde seconde: schrikken
  const netNa = p.vNu;
  window.__rij(60);                                   // twee seconden later rent hij
  const rent = p.vNu;
  const halverwege = Math.hypot(p.x - bron.x, p.z - bron.z);
  window.__rij(90);                                   // en nog eens drie seconden
  const weg = Math.hypot(p.x - bron.x, p.z - bron.z);
  const verPaniek = ver ? ver.paniek : 0;
  // uitrazen: de paniek loopt af en hij gaat weer wandelen
  p.paniek = 0.01; p.bron = null;
  window.__rij(90);
  return { aantal, meteen, netNa: +netNa.toFixed(2), rent: +rent.toFixed(2), wandel: +wandel.toFixed(2),
    halverwege: +halverwege.toFixed(1), weg: +weg.toFixed(1), verPaniek,
    daarna: +p.vNu.toFixed(2), alive: p.alive };
});
ok(schrik.aantal >= 1 && schrik.meteen.paniek > 4, 'een knal laat de buurt schrikken',
  `${schrik.aantal} mensen, ${schrik.meteen.paniek.toFixed(1)} s paniek`);
ok(schrik.meteen.schrik > 0.1 && schrik.netNa < 1.2, 'eerst een tel van schrik, dan pas rennen', `${schrik.netNa} m/s na 0,2 s`);
ok(schrik.rent > 3.6 && schrik.rent < 8, 'daarna rent hij in een realistisch tempo',
  `${schrik.rent} m/s tegen ${schrik.wandel} m/s wandelen`);
ok(schrik.weg > schrik.halverwege && schrik.weg > 14, 'en hij rent bij de knal vandaan',
  `${schrik.halverwege} m → ${schrik.weg} m`);
ok(schrik.verPaniek === 0, 'wie ver weg loopt merkt er niets van');
ok(schrik.daarna < 2 && schrik.alive, 'als de schrik voorbij is wandelt hij weer', `${schrik.daarna} m/s`);

const aanrijPaniek = await page.evaluate(() => {
  const g = window.__game;
  const p = g.npcs.people.find(q => q.alive && !q.fietst);
  // een buurman op een paar meter afstand, zodat hij het ziet gebeuren
  const buur = g.npcs.people.find(q => q.alive && q !== p && Math.hypot(q.x - p.x, q.z - p.z) < 18);
  const voor = buur ? buur.paniek : -1;
  g.aanrijden(p.x, p.z, 1.4, 11);
  return { neer: !p.alive, buurVoor: voor, buurNa: buur ? buur.paniek : -1 };
});
ok(aanrijPaniek.neer && aanrijPaniek.buurNa > aanrijPaniek.buurVoor,
  'wie een aanrijding ziet, rent ook weg', `paniek ${aanrijPaniek.buurVoor.toFixed(1)} → ${aanrijPaniek.buurNa.toFixed(1)} s`);

const schotPaniek = await page.evaluate(async () => {
  const THREE = await import('three');
  const g = window.__game;
  const p = g.npcs.people.find(q => q.alive && !q.fietst && q.paniek === 0);
  g.player.pos.set(p.x + 3, 0, p.z);
  const origin = new THREE.Vector3(p.x + 3, 1.5, p.z);
  const dir = new THREE.Vector3(0, 0, 1).normalize();
  g.player.shootCb(origin, dir);
  return { paniek: p.paniek };
});
ok(schotPaniek.paniek > 0, 'en van een schot schrikt de hele straat', `${schotPaniek.paniek.toFixed(1)} s`);

// ---------- 7. auto's rijden niet door elkaar heen ----------
kop("auto's tegen elkaar");
const blik = await page.evaluate(() => {
  const g = window.__game;
  const c = window.__leegveld();
  // een tweede auto acht meter recht vooruit (bij yaw 0 is dat -z)
  const doel = g.vehicles.voegToe({ x: c.x, z: c.z - 8, yaw: 0, soort: 'hatch', kleur: 0x2a3f8f });
  doel.speed = 0;
  const zVoor = doel.z;
  let dichtst = 99, doorheen = false;
  for (let i = 0; i < 120; i++) {
    window.__rij(1, { KeyW: true });
    const d = Math.hypot(c.x - doel.x, c.z - doel.z);
    if (d < dichtst) dichtst = d;
    if (c.z < doel.z) doorheen = true;           // voorbij hem = er dwars doorheen
  }
  const geduwd = zVoor - doel.z;
  g.scene.remove(doel.mesh);
  g.vehicles.cars.splice(g.vehicles.cars.indexOf(doel), 1);
  return { dichtst: +dichtst.toFixed(2), doorheen, snelheid: +c.speed.toFixed(2), geduwd: +geduwd.toFixed(2) };
});
ok(!blik.doorheen, 'je rijdt niet meer dwars door een andere auto heen');
ok(blik.dichtst > 2.5 && blik.dichtst < 5, 'de bumpers houden elkaar op afstand', `${blik.dichtst} m hart op hart`);
ok(blik.snelheid < 6, 'en de klap haalt de vaart eruit', `${blik.snelheid} m/s`);
ok(blik.geduwd > 0.02, 'een geparkeerde auto krijgt een zetje', `${blik.geduwd} m opgeschoven`);

await browser.close();
console.log(fouten === 0 ? '\nAlles goed.' : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
