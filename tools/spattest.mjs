/*
 De ronde van 20 september 2026 (tweede lijst).

   npm run server &   node tools/spattest.mjs [poort]

 Zes punten:

 1. Bloed bij wie beschoten wordt: een spat bij elke treffer, een plas bij wie
    neergaat.
 2. Het machinegeweer velt pas met de tweede kogel.
 3. Het pistool heeft er één of twee nodig, willekeurig per slachtoffer.
 4. De sniper velt met één kogel.
 5. Door de kijker beweegt de muis trager, en hoe verder ingezoomd hoe trager.
 6. Het schap van de wapenhandel blijft niet in beeld staan als je weg bent.

 En de drie panden uit dezelfde lijst: de toren aan de Quirijn de Blaustraat,
 hospice De Kime aan de Westhemstraat en de galerijflat aan de
 Scherwolderhemstraat.
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let goed = 0, fout = 0;
const ok = (naam, waar, extra = '') => {
  if (waar) { goed++; console.log(`  ✓ ${naam}${extra ? ' — ' + extra : ''}`); }
  else { fout++; console.log(`  ✗ ${naam}${extra ? ' — ' + extra : ''}`); }
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const fouten = [];
page.on('pageerror', e => fouten.push(e.message));
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });
await page.evaluate(() => {
  const g = window.__game;
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true;
});

// ------------------------------------------------- hoeveel kogels iemand kost
console.log('\nhoeveel kogels er nodig zijn');
const kogels = await page.evaluate(async () => {
  const { WAPENS } = await import('/js/player.js');
  const g = window.__game;
  const p = g.player;
  p.reserve = 500;
  const uit = { tabel: {} };
  for (const soort of ['pistool', 'mitrailleur', 'sniper']) uit.tabel[soort] = WAPENS[soort].dodelijk;
  /*
   Niet de tabel maar de uitkomst toetsen: iemand raken met het wapen in de
   hand en kijken of hij blijft staan of niet. `npcs.hit` krijgt het getal dat
   het wapen oplevert, precies zoals js/main.js het doorgeeft.
  */
  const proef = (soort, mens) => {
    p.krijgWapen(soort);
    const nodig = p.kogelsNodig();
    // (`hitPersoon`: de instantie is niet meer het nummer van de persoon, sinds
    // alleen wie binnen tweehonderd meter is een lichaam heeft)
    let n = 0;
    while (n < 6) {
      const raak = g.npcs.hitPersoon(g.npcs.people[mens], nodig);
      n++;
      if (!raak) return n;                 // al neer
      if (raak.neer) return n;
    }
    return n;
  };
  // tien verschillende mensen per wapen, zodat de loting van het pistool telt
  const levend = [];
  for (let i = 0; i < g.npcs.people.length && levend.length < 40; i++) {
    if (g.npcs.people[i].alive) levend.push(i);
  }
  uit.mitrailleur = levend.slice(0, 8).map(i => proef('mitrailleur', i));
  uit.sniper = levend.slice(8, 16).map(i => proef('sniper', i));
  uit.pistool = levend.slice(16, 40).map(i => proef('pistool', i));
  // en een half neergeschoten iemand blijft staan
  const half = levend[40] ?? levend[0];
  return uit;
});
ok('het machinegeweer staat op twee kogels', kogels.tabel.mitrailleur === 2, `${kogels.tabel.mitrailleur}`);
ok('de sniper op één', kogels.tabel.sniper === 1, `${kogels.tabel.sniper}`);
ok('en het pistool op één of twee', Array.isArray(kogels.tabel.pistool)
  && kogels.tabel.pistool.join(',') === '1,2', `${kogels.tabel.pistool}`);
ok('met het machinegeweer gaan ze pas bij de tweede neer',
  kogels.mitrailleur.length > 0 && kogels.mitrailleur.every(n => n === 2), kogels.mitrailleur.join(' '));
ok('met de sniper bij de eerste',
  kogels.sniper.length > 0 && kogels.sniper.every(n => n === 1), kogels.sniper.join(' '));
const een = kogels.pistool.filter(n => n === 1).length, twee = kogels.pistool.filter(n => n === 2).length;
ok('en met het pistool komt het allebei voor', een > 0 && twee > 0 && een + twee === kogels.pistool.length,
  `${een}× één kogel, ${twee}× twee`);

// ------------------------------------------------------------------- bloed
console.log('\nbloed');
const bloed = await page.evaluate(async () => {
  const T = await import('/js/textures.js');
  const g = window.__game;
  const spatDoek = T.bloedSpatDoek(), plasDoek = T.bloedPlasDoek();
  const tel = (doek) => {
    let n = 0;
    g.scene.traverse(o => {
      if (!o.isMesh || !o.material || o.material.map !== doek) return;
      // een spat zit in een groepje van twee vlakken; tel de groep één keer
      const zicht = o.visible && (!o.parent || o.parent.visible);
      if (zicht && o.material.opacity > 0.02) n++;
    });
    return n;
  };
  const uit = { doeken: !!spatDoek && !!plasDoek, spatVoor: tel(spatDoek), plasVoor: tel(plasDoek) };
  // iemand neerschieten met de sniper: één kogel, dus spat én plas
  const p = g.player;
  p.reserve = 200; p.krijgWapen('sniper');
  const mens = g.npcs.people.findIndex(q => q.alive);
  const persoon = g.npcs.people[mens];
  p.pos.set(persoon.x, 0, persoon.z - 6);
  const THREE = await import('three');
  const van = new THREE.Vector3(persoon.x, 1.5, persoon.z - 6);
  const naar = new THREE.Vector3(persoon.x - van.x, 1.25 - 1.5, persoon.z - van.z).normalize();
  p.shootCb(van, naar);
  await new Promise(r => requestAnimationFrame(r));
  uit.spatNa = tel(spatDoek);
  uit.plasNa = tel(plasDoek);
  uit.neer = !persoon.alive;
  return uit;
});
ok('er zijn doeken voor de spat en de plas', bloed.doeken === true);
ok('vooraf is er geen bloed te zien', bloed.spatVoor === 0 && bloed.plasVoor === 0,
  `${bloed.spatVoor} spatten, ${bloed.plasVoor} plassen`);
ok('een treffer geeft een spat', bloed.spatNa > 0, `${bloed.spatNa} vlakken zichtbaar`);
ok('en wie neergaat laat een plas achter', bloed.neer === true && bloed.plasNa > 0,
  `${bloed.plasNa} plas(sen)`);

// ---------------------------------------------------------- de kijker en de muis
console.log('\ndoor de kijker richten');
const muis = await page.evaluate(async () => {
  const g = window.__game;
  const p = g.player;
  p.reserve = 200;
  p.krijgWapen('sniper');
  for (let i = 0; i < 60; i++) p.update(1 / 60);
  /*
   Meten langs de echte weg: de handler in js/player.js hangt aan `document` en
   doet alleen iets als de muis vergrendeld is of je aan het slepen bent. Met
   `dragging` aan telt een gewone mousemove dus mee, en meten we precies wat een
   speler zou krijgen — en niet een formule die we hier nog eens overschrijven.
  */
  p.dragging = true;
  const doeMuis = () => {
    const voor = p.yaw;
    document.dispatchEvent(new MouseEvent('mousemove', { movementX: 100, movementY: 0 }));
    const d = Math.abs(p.yaw - voor);
    p.yaw = voor;
    return d;
  };
  const uit = {};
  uit.heup = +doeMuis().toFixed(5);
  // aangeslagen op de kleinste vergroting
  p.zoomPer.sniper = 4;
  p.richten(true);
  for (let i = 0; i < 40; i++) p.update(1 / 60);
  uit.mik = +p.mik.toFixed(2);
  uit.zoom4 = +p.zoom.toFixed(1);
  uit.bij4 = +doeMuis().toFixed(5);
  p.zoomPer.sniper = 12;
  for (let i = 0; i < 10; i++) p.update(1 / 60);
  uit.zoom12 = +p.zoom.toFixed(1);
  uit.bij12 = +doeMuis().toFixed(5);
  // en met het pistool over het vizier blijft het bij de gewone gevoeligheid
  p.richten(false);
  for (let i = 0; i < 30; i++) p.update(1 / 60);
  p.zetWapen('pistool');
  for (let i = 0; i < 40; i++) p.update(1 / 60);
  p.richten(true);
  for (let i = 0; i < 40; i++) p.update(1 / 60);
  uit.pistool = +doeMuis().toFixed(5);
  p.richten(false);
  p.dragging = false;
  return uit;
});
ok('de kijker staat aan', muis.mik > 0.9 && muis.zoom4 === 4, `mik ${muis.mik}, ${muis.zoom4}×`);
ok('uit de heup kijk je gewoon rond', muis.heup > 0.1, `${muis.heup} rad per 100 tellen muis`);
ok('op 4× beweegt de muis trager dan uit de heup', muis.bij4 < muis.heup * 0.55,
  `${muis.bij4} tegen ${muis.heup} rad`);
ok('en op 12× nog trager', muis.bij12 < muis.bij4 * 0.65 && muis.zoom12 === 12,
  `${muis.bij12} tegen ${muis.bij4} rad`);
ok('met het pistool over het vizier blijft het bij de gewone maat',
  muis.pistool > muis.bij4 * 2, `${muis.pistool} rad`);

// ------------------------------------------------------- het schap in beeld
console.log('\nhet schap van de wapenhandel');
const schap = await page.evaluate(async () => {
  const g = window.__game;
  const el = document.getElementById('schap');
  const stap = async (n = 8) => { for (let i = 0; i < n; i++) await new Promise(r => requestAnimationFrame(r)); };
  const P = g.boerderij.plekken;
  g.player.inCar = null;
  g.player.pos.set(P.toonbank.x, 0, P.toonbank.z);
  await stap();
  const uit = { bij: !el.hidden };
  // het menu open (muis vrijgegeven) — dit was de fout: het schap bleef staan
  g.player.active = false;
  await stap();
  uit.metMenu = !el.hidden;
  // en dan weglopen en weer verder spelen
  g.player.pos.set(P.deurBuiten.x + 40, 0, P.deurBuiten.z + 40);
  await stap();
  uit.weg = !el.hidden;
  g.player.active = true;
  await stap();
  uit.terugInSpel = !el.hidden;
  return uit;
});
ok('aan de toonbank staat het schap in beeld', schap.bij === true);
ok('met het menu open verdwijnt het', schap.metMenu === false);
ok('en het blijft weg als je vertrekt', schap.weg === false && schap.terugInSpel === false);

// ------------------------------------------------------------- de drie panden
console.log('\nde drie panden uit de lijst');
const panden = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const T = await import('/js/textures.js');
  const zoek = (id) => {
    const p = KAART.panden.find(q => q.id === id);
    if (!p) return null;
    let opp = 0;
    for (let i = 0; i < p.voet.length; i++) {
      const u = p.voet[i], v = p.voet[(i + 1) % p.voet.length];
      opp += u[0] * v[1] - v[0] * u[1];
    }
    return { type: p.type, straat: p.straat, goot: p.goot, nok: p.nok, opp: Math.round(Math.abs(opp / 2)) };
  };
  return {
    toren: zoek('1900100000313266'),
    hospice: zoek('0091100000007740'),
    flat: zoek('0091100000019596'),
    stijlen: {
      toren: T.HOUSE_STYLES.blaustraat_toren,
      hospice: T.HOUSE_STYLES.hospice,
      flat: T.HOUSE_STYLES.scherwolderhem,
    },
  };
});
ok('de toren aan de Quirijn de Blaustraat heeft zijn eigen type',
  panden.toren && panden.toren.type === 'blaustraat_toren',
  panden.toren ? `${panden.toren.straat}, ${panden.toren.opp} m², nok ${panden.toren.nok} m` : 'niet gevonden');
ok('met penanten over de volle hoogte en genoeg lagen voor 26 meter',
  panden.stijlen.toren.penanten === true && panden.stijlen.toren.maxLagen >= 9,
  `${panden.stijlen.toren.storeys} lagen van ${panden.stijlen.toren.storeyH} m`);
ok('hospice De Kime is één laag met een plat dak',
  panden.hospice && panden.hospice.type === 'hospice' && panden.hospice.nok < 5,
  panden.hospice ? `${panden.hospice.straat}, goot ${panden.hospice.goot} nok ${panden.hospice.nok}` : 'niet gevonden');
ok('met strookramen en een oranjerode deur',
  panden.stijlen.hospice.strookramen === true && panden.stijlen.hospice.door[0] === '#d2572a');
ok('de galerijflat aan de Scherwolderhemstraat staat er',
  panden.flat && panden.flat.type === 'scherwolderhem',
  panden.flat ? `${panden.flat.straat}, ${panden.flat.opp} m², goot ${panden.flat.goot} m` : 'niet gevonden');
ok('met een galerij en een donkere onderbouw',
  panden.stijlen.flat.galerij === true && panden.stijlen.flat.storeys === 4,
  `hek ${panden.stijlen.flat.railing}`);

console.log(`\nfouten in de pagina: ${fouten.length ? fouten.join(' | ') : 'geen'}`);
console.log(`\n${goed} goed, ${fout} fout`);
await browser.close();
process.exit(fout ? 1 : 0);
