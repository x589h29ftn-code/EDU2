/*
 De intro, het wapen dat je later pas krijgt, en de uitleg onderweg.

   npm run server &   node tools/introtest.mjs [poort]

 Zeven dingen (verzoek 20 sep 2026, met de aanvullingen van dezelfde avond):

 1. Bij een nieuw spel komt er eerst een filmpje langs de plekken van de wijk en
    de omgeving, dat eindigt op het standpunt waar je begint.
 2. Het duurt even lang als het muziekje eronder.
 3. Met de titels RED EAGLE PRODUCTIONS → presents → GTA VI / TINGA, en de
    eerste en de laatste staan er lang in beeld.
 4. De camera zakt nergens door een dak of een kruin heen.
 5. Het wapen hangt niet in beeld tijdens het filmpje.
 6. Erik loopt zonder wapen rond tot hij bij het gezelschap staat; dáár krijgt
    hij het, met de uitleg over H, de muisknoppen en R.
 7. De eerste keer in een auto komt de uitleg over de radio en de camera.
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

// ------------------------------------------------------------ de cameraweg
console.log('\nde beelden en de plekken');
/*
 Niet met een stopwatch maar met de functie die de lus zelf gebruikt:
 `beeldOp(t)` zegt waar de camera op seconde t staat, en `zoekPlekken` welke
 plekken het filmpje aandoet. Zo is elk beeld te toetsen zonder dat er een
 minuut film langs hoeft.
*/
const weg = await page.evaluate(async () => {
  const I = await import('/js/intro.js');
  const { KAART } = await import('/js/kaart.js');
  const start = window.__game.start;
  const P = I.zoekPlekken(KAART, start);
  const eind = I.beeldOp(0, KAART, start).totaal;
  const laatste = I.beeldOp(eind - 0.01, KAART, start);
  const dx = laatste.kijk.x - laatste.pos.x, dz = laatste.kijk.z - laatste.pos.z;
  const yaw = Math.atan2(-dx, -dz);
  const hoekverschil = Math.abs(((yaw - start.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  /*
   Clipping. Voor elk moment: staat de camera binnen het grondvlak van een pand
   dat hoger is dan zij zelf? Dan vliegt ze door dat pand heen. Hetzelfde voor
   de bomen, met een kruin van achttien meter als maat.
  */
  const inRing = (r, x, z) => {
    let b = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const a = r[i], c = r[j];
      if ((a[1] > z) !== (c[1] > z) && x < (c[0] - a[0]) * (z - a[1]) / (c[1] - a[1]) + a[0]) b = !b;
    }
    return b;
  };
  const dozen = KAART.panden.map(p => {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const v of p.voet) {
      if (v[0] < x0) x0 = v[0]; if (v[0] > x1) x1 = v[0];
      if (v[1] < z0) z0 = v[1]; if (v[1] > z1) z1 = v[1];
    }
    return { p, x0, x1, z0, z1, hoog: p.nok || p.goot || 6 };
  });
  let doorPand = 0, doorBoom = 0, laagst = Infinity, hoogst = 0;
  const KRUIN = 18;
  for (let t = 0; t <= eind; t += 0.25) {
    const b = I.beeldOp(t, KAART, start);
    const { x, y, z } = b.pos;
    laagst = Math.min(laagst, y); hoogst = Math.max(hoogst, y);
    for (const d of dozen) {
      if (y > d.hoog + 1 || x < d.x0 || x > d.x1 || z < d.z0 || z > d.z1) continue;
      if (inRing(d.p.voet, x, z)) { doorPand++; break; }
    }
    // de bomen: alleen als de camera lager hangt dan een kruin
    if (y < KRUIN) {
      for (const boom of KAART.bomen) {
        if (Math.hypot(boom.x - x, boom.z - z) < 3.5) { doorBoom++; break; }
      }
    }
  }
  // de duur van het muziekje erbij, uit het bestand zelf
  const duurMuziek = await new Promise(r => {
    const a = new Audio(I.MUZIEK);
    a.addEventListener('loadedmetadata', () => r(a.duration));
    a.addEventListener('error', () => r(null));
    setTimeout(() => r(null), 8000);
  });
  return {
    totaal: eind, beelden: I.beeldOp(0, KAART, start).beelden, duurMuziek,
    plekken: Object.fromEntries(Object.entries(P).map(([k, v]) => [k, v ? { x: +(v.x ?? 0).toFixed(0), z: +(v.z ?? 0).toFixed(0) } : null])),
    doorPand, doorBoom, laagst: +laagst.toFixed(1), hoogst: +hoogst.toFixed(0),
    eindAfstand: Math.hypot(laatste.pos.x - start.x, laatste.pos.z - start.z),
    eindY: laatste.pos.y, eindHoek: +hoekverschil.toFixed(3),
    molenUitKaart: (KAART.molens || []).map(m => ({ x: +m.cx.toFixed(0), z: +m.cz.toFixed(0) })),
  };
});
ok('het filmpje bestaat uit een reeks beelden', weg.beelden >= 8, `${weg.beelden} beelden`);
ok('en duurt ongeveer een minuut', weg.totaal > 55 && weg.totaal < 75, `${weg.totaal.toFixed(1)} s`);
ok('even lang als het muziekje eronder',
  weg.duurMuziek == null || Math.abs(weg.duurMuziek - weg.totaal) < 4,
  weg.duurMuziek == null ? 'muziekduur niet te lezen' : `film ${weg.totaal.toFixed(1)} s, muziek ${weg.duurMuziek.toFixed(1)} s`);
for (const [naam, sleutel] of [['de Molenkrite', 'molenkrite'], ['de Jumbo', 'jumbo'], ['het Tinga-bosje', 'bosje'],
  ['het Viaduct Tinga', 'viaduct'], ['de waterzuivering', 'rwzi'], ['de Geeuw', 'geeuw'], ['de molen', 'molen'],
  ['het Sneekerpad', 'sneekerpad'], ['het hoofdveld van VV Sneek', 'voetbal']]) {
  const p = weg.plekken[sleutel];
  ok(`${naam} is in de kaart gevonden`, !!p, p ? `(${p.x}, ${p.z})` : 'niet gevonden');
}
ok('de molen is dezelfde als die in de kaart staat',
  weg.molenUitKaart.some(m => Math.hypot(m.x - weg.plekken.molen.x, m.z - weg.plekken.molen.z) < 3),
  JSON.stringify(weg.molenUitKaart));
/*
 Het viaductbeeld is er een van een andere soort: geen zwenk om een punt heen
 maar een rechte lijn erop af (verzoek 20 sep 2026). Dat is te meten — de
 afwijking van de lijn tussen begin- en eindpunt blijft nul, de afstand tot het
 dek loopt terug, en de camera blijft erboven.
*/
const viaduct = await page.evaluate(async () => {
  const I = await import('/js/intro.js');
  const { KAART } = await import('/js/kaart.js');
  const start = window.__game.start;
  const P = I.zoekPlekken(KAART, start);
  if (!P.viaduct) return null;
  const totaal = I.beeldOp(0, KAART, start).totaal;
  const punten = [];
  for (let t = 0; t < totaal; t += 0.1) {
    const b = I.beeldOp(t, KAART, start);
    if (b.beeldNr !== 4) continue;
    punten.push({ x: b.pos.x, y: b.pos.y, z: b.pos.z,
      d: Math.hypot(b.pos.x - P.viaduct.x, b.pos.z - P.viaduct.z) });
  }
  if (punten.length < 3) return null;
  const a = punten[0], e = punten[punten.length - 1];
  const L = Math.hypot(e.x - a.x, e.z - a.z) || 1;
  let scheef = 0;
  for (const p of punten) {
    scheef = Math.max(scheef, Math.abs((p.x - a.x) * (e.z - a.z) - (p.z - a.z) * (e.x - a.x)) / L);
  }
  return { n: punten.length, scheef, dVan: a.d, dTot: e.d, yVan: a.y, yTot: e.y,
    laagst: Math.min(...punten.map(p => p.y)), dek: P.viaduct.y };
});
ok('het vijfde beeld is het viaduct', !!viaduct, viaduct ? `${viaduct.n} momenten` : 'geen viaduct in de kaart');
if (viaduct) {
  ok('de camera vliegt er in een rechte lijn op af, hij draait er niet omheen',
    viaduct.scheef < 0.01 && viaduct.dTot < viaduct.dVan * 0.4,
    `${viaduct.scheef.toFixed(3)} m van de lijn, ${viaduct.dVan.toFixed(0)} → ${viaduct.dTot.toFixed(0)} m`);
  ok('en zakt daarbij, maar blijft boven het dek',
    viaduct.yTot < viaduct.yVan && viaduct.laagst > viaduct.dek + 0.8,
    `${viaduct.yVan.toFixed(1)} → ${viaduct.yTot.toFixed(1)} m boven een dek van ${viaduct.dek.toFixed(1)} m`);
}

/*
 Stap 119: het voorlaatste beeld is het hoofdveld van VV Sneek in plaats van de Poiesz. Een kraan die
 terugtrekt: laag voor een bord van Radio Spannenburg, dan omhoog over het veld. Even lang als het beeld
 van de Poiesz (6,0 s), dus de film blijft 65,3 s, net als de muziek.
*/
console.log('\nhet voetbalveld (stap 119)');
const veld = await page.evaluate(async () => {
  const THREE = await import('three');
  const I = await import('/js/intro.js');
  const { KAART } = await import('/js/kaart.js');
  const g = window.__game, start = g.start, cam = g.camera;
  const P = I.zoekPlekken(KAART, start);
  const totaal = I.beeldOp(0, KAART, start).totaal;
  const F = P.voetbal;
  if (!F || !F.bord) return { geen: true, totaal };
  let t0 = null, t1 = null;
  for (let t = 0; t < totaal; t += 0.05) if (I.beeldOp(t, KAART, start).soort === 'kraan') { if (t0 === null) t0 = t; t1 = t; }
  if (t0 === null) return { geenBeeld: true, totaal };
  const zet = (t) => { const b = I.beeldOp(t, KAART, start); cam.position.set(b.pos.x, b.pos.y, b.pos.z); cam.lookAt(b.kijk.x, b.kijk.y, b.kijk.z); cam.updateMatrixWorld(); cam.updateProjectionMatrix(); return b; };
  const fr = new THREE.Frustum(), m = new THREE.Matrix4();
  const inBeeld = (x, y, z) => { m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); fr.setFromProjectionMatrix(m); return fr.containsPoint(new THREE.Vector3(x, y, z)); };
  const bw = F.w(F.bord.u, F.bord.v);
  // het begin: het bord van Radio Spannenburg in beeld, dichtbij, en niet te schuin
  const b0 = zet(t0 + 0.02);
  const bordIn = inBeeld(bw.x, 0.55, bw.z);
  const bordAfstand = Math.hypot(bw.x - b0.pos.x, bw.z - b0.pos.z);
  // de voorkant van het bord kijkt naar het veld (normaal -s langs v), de camera moet daarvoor staan
  const nx = -F.s * -Math.sin(F.veld.hoek), nz = -F.s * Math.cos(F.veld.hoek);
  const rx = (b0.pos.x - bw.x) / (bordAfstand || 1), rz = (b0.pos.z - bw.z) / (bordAfstand || 1);
  const schuin = Math.acos(Math.max(-1, Math.min(1, rx * nx + rz * nz))) * 180 / Math.PI;
  // onderweg: laagste punt, en hoe ver de kijkrichting draait
  let laagst = Infinity, yaw0 = null, draai = 0;
  for (let t = t0; t <= t1; t += 0.1) {
    const b = I.beeldOp(t, KAART, start);
    laagst = Math.min(laagst, b.pos.y);
    const yaw = Math.atan2(b.kijk.x - b.pos.x, b.kijk.z - b.pos.z);
    if (yaw0 === null) yaw0 = yaw;
    draai = Math.max(draai, Math.abs(((yaw - yaw0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI));
  }
  // het eind: hoog, en het veld in beeld (het midden en de vier hoeken)
  const b1 = zet(t1);
  const hoeken = [[0, 0], [F.hl, F.hb], [F.hl, -F.hb], [-F.hl, F.hb], [-F.hl, -F.hb]].map(([u, v]) => F.w(u, v));
  const veldIn = hoeken.filter(h => inBeeld(h.x, 0, h.z)).length;
  // de wedstrijd speelt tijdens de film, ook buiten de speeltijd
  const W = g.wedstrijd;
  let spelers = 0, aanwezig = false, zichtbaar = false;
  if (W) {
    W.weg();
    const uurWas = g.sfeer.uur;
    g.sfeer.uur = 20;
    zet((t0 + t1) / 2);
    for (let i = 0; i < 10; i++) g.wedstrijdInFilm(0.1);
    aanwezig = W.aanwezig; zichtbaar = W.groep.visible;
    zet((t0 + t1) / 2);
    spelers = W.spelers.filter(s => { const q = s.p.groep.position; return inBeeld(q.x, q.y + 1, q.z); }).length;
    g.sfeer.uur = uurWas;
  }
  return { totaal, duur: t1 - t0, y0: b0.pos.y, y1: b1.pos.y, bordIn, bordAfstand, schuin, laagst, draai: draai * 180 / Math.PI,
    veldIn, aanwezig, zichtbaar, spelers, bord: { u: F.bord.u, v: F.bord.v } };
});
ok('het voetbalveld en een bord van Radio Spannenburg gevonden', !veld.geen && !veld.geenBeeld, JSON.stringify(veld.bord || veld));
if (!veld.geen && !veld.geenBeeld) {
  ok('de film is niet langer dan hij was (65,3 s)', veld.totaal <= 65.3 + 1e-6, `${veld.totaal.toFixed(2)} s`);
  ok('het beeld van het veld duurt zo lang als dat van de Poiesz (6,0 s)', Math.abs(veld.duur - 6.0) < 0.15, `${veld.duur.toFixed(2)} s`);
  ok('het begint laag en eindigt hoog: een kraan', veld.y0 < 3 && veld.y1 > 20, `${veld.y0.toFixed(1)} → ${veld.y1.toFixed(1)} m`);
  ok('altijd boven de hoofden van de spelers', veld.laagst > 2.2, `${veld.laagst.toFixed(2)} m`);
  ok('zonder zwaai: de kijkrichting draait weinig', veld.draai < 60, `${veld.draai.toFixed(0)}°`);
  ok('bij het begin het bord van Radio Spannenburg in beeld, van voren', veld.bordIn && veld.bordAfstand < 16 && veld.schuin < 55,
    `${veld.bordAfstand.toFixed(1)} m, ${veld.schuin.toFixed(0)}° uit het midden`);
  ok('aan het eind de wedstrijd in beeld: het midden en de overkant tot in de hoeken', veld.veldIn >= 3, `${veld.veldIn} van 5 punten`);
  ok('tijdens de film speelt er een wedstrijd, ook om acht uur \'s avonds', veld.aanwezig && veld.zichtbaar, `aanwezig ${veld.aanwezig}, zichtbaar ${veld.zichtbaar}`);
  ok('met spelers in beeld', veld.spelers >= 10, `${veld.spelers} van 22`);
}

ok('de camera vliegt nergens door een pand heen', weg.doorPand === 0, `${weg.doorPand} momenten`);
ok('en nergens door een boomkruin', weg.doorBoom === 0, `${weg.doorBoom} momenten`);
ok('het hoogste beeld kijkt over de hele wijk', weg.hoogst > 150, `${weg.hoogst} m`);
ok('en hij eindigt op het standpunt van de speler',
  weg.eindAfstand < 0.6 && Math.abs(weg.eindY - 1.7) < 0.2,
  `${weg.eindAfstand.toFixed(2)} m ernaast, ${weg.eindY.toFixed(2)} m hoog`);
ok('kijkend dezelfde kant op als waar het spel begint', weg.eindHoek < 0.25, `${weg.eindHoek} rad verschil`);

// ----------------------------------------------------------------- de titels
console.log('\nde titels');
const titels = await page.evaluate(async () => {
  const I = await import('/js/intro.js');
  const { KAART } = await import('/js/kaart.js');
  const start = window.__game.start;
  const rij = [];
  for (let t = 0; t < I.beeldOp(0, KAART, start).totaal; t += 0.2) {
    const T = I.beeldOp(t, KAART, start).titel;
    const tekst = T ? [T.klein, T.groot, T.sub].filter(Boolean).join(' ') : '';
    if (!rij.length || rij[rij.length - 1].tekst !== tekst) rij.push({ t: +t.toFixed(1), tekst });
  }
  return rij;
});
const gezien = titels.filter(r => r.tekst).map(r => r.tekst);
ok('er staan drie titels in het filmpje', gezien.length === 3, gezien.join(' → '));
ok('en ze staan in de goede volgorde',
  gezien[0] === 'RED EAGLE PRODUCTIONS' && gezien[1] === 'presents' && gezien[2] === 'GTA VI TINGA');
ok('met leeg beeld ertussen', titels.filter(r => !r.tekst).length >= 3,
  `${titels.filter(r => !r.tekst).length} stukken zonder titel`);
/*
 Hoe lang elke titel er staat. Red Eagle en de filmtitel moeten er lang in
 blijven (verzoek 20 sep 2026); "presents" is een tussenzin en mag kort.
*/
const duurVan = (tekst) => {
  let van = null, tot = null;
  for (let i = 0; i < titels.length; i++) {
    if (titels[i].tekst === tekst && van === null) van = titels[i].t;
    if (van !== null && titels[i].tekst !== tekst && tot === null && titels[i].t > van) { tot = titels[i].t; break; }
  }
  return tot === null ? null : tot - van;
};
const dRed = duurVan('RED EAGLE PRODUCTIONS'), dTitel = duurVan('GTA VI TINGA');
ok('RED EAGLE PRODUCTIONS staat er ruim in', dRed !== null && dRed >= 6, `${dRed && dRed.toFixed(1)} s`);
ok('en de filmtitel nog langer', (dTitel === null /* loopt door tot het eind */) || dTitel >= 10,
  dTitel === null ? 'tot het eind van het filmpje' : `${dTitel.toFixed(1)} s`);

// ------------------------------------------------- het filmpje in het spel
console.log('\nhet filmpje bij het starten');
await page.evaluate(() => {
  const b = [...document.querySelectorAll('#overlay button')].find(x => x.textContent.trim() === 'Start spel');
  b.click();
});
await page.waitForTimeout(900);
await page.evaluate(async () => { const m = await import('/js/menu.js'); m.__start(); });
/*
 Vóór het filmpje maakt `voorFilm` (js/main.js) de gevels af en tekent hij elk
 stuk film één keer, achter zwart; headless duurt dat een minuut. Dus wachten tot
 hij echt draait, in plaats van een vaste tijd.
*/
const zwartVooraf = await page.evaluate(() => document.getElementById('intro').classList.contains('aan'));
// (niet met waitForFunction: een async functie geeft een belofte terug, en die telt als waar)
for (let i = 0; i < 1200; i++) {
  if (await page.evaluate(async () => (await import('/js/intro.js')).bezig())) break;
  await page.waitForTimeout(500);
}
await page.waitForTimeout(700);
const draait = await page.evaluate(async () => {
  const I = await import('/js/intro.js');
  const g = window.__game;
  return { bezig: I.bezig(), actief: g.player.active, laag: document.getElementById('intro').classList.contains('aan'),
    wapen: g.player.gun ? g.player.gun.visible : null };
});
ok('de intro draait en het spel staat nog stil', draait.bezig === true && draait.actief === false);
ok('en de filmlaag staat in beeld (al tijdens het voorbereiden: dan zwart)', draait.laag === true && zwartVooraf === true);
ok('het wapen hangt niet in beeld', draait.wapen === false, `gun.visible = ${draait.wapen}`);

// overslaan met een toets
await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' })));
/*
 Wachten tot de hoofdlus de camera heeft teruggezet, en niet een vast aantal
 tellen: met softwarerendering haalt hij maar een paar beelden per seconde, en
 dan is "drie seconden" soms één beeld. Dit kijkt gewoon of het al zover is.
*/
await page.waitForFunction(() => {
  const g = window.__game;
  return g.player.active && Math.hypot(g.camera.position.x - g.start.x, g.camera.position.z - g.start.z) < 1.5;
}, null, { timeout: 30000 }).catch(() => {});
const na = await page.evaluate(async () => {
  const I = await import('/js/intro.js');
  const g = window.__game;
  return { bezig: I.bezig(), actief: g.player.active, laag: document.getElementById('intro').classList.contains('aan'),
    cam: { x: g.camera.position.x, z: g.camera.position.z }, start: g.start };
});
ok('met een toets sla je hem over', na.bezig === false && na.laag === false);
ok('en dan begint het spel', na.actief === true);
ok('met de camera op het beginpunt',
  Math.hypot(na.cam.x - na.start.x, na.cam.z - na.start.z) < 1.5,
  `${Math.hypot(na.cam.x - na.start.x, na.cam.z - na.start.z).toFixed(2)} m ernaast`);

// ------------------------------------------------------------- het wapen
console.log('\nhet wapen komt later');
const wapen = await page.evaluate(async () => {
  const g = window.__game;
  const uit = { slot: g.player.wapenSlot, weg: g.player.wapenUit };
  // H doet niets zolang het slot erop zit
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH' }));
  await new Promise(r => requestAnimationFrame(r));
  uit.naH = g.player.wapenUit;
  uit.melding = document.getElementById('msg').textContent;
  // en dan het moment uit het verhaal waarop hij hem krijgt
  g.verhaal.__geefWapen();
  await new Promise(r => requestAnimationFrame(r));
  uit.naVerhaal = g.player.wapenUit;
  uit.slotNa = g.player.wapenSlot;
  const u = document.getElementById('uitleg');
  uit.uitlegAan = u.classList.contains('zichtbaar');
  uit.uitlegTekst = u.textContent;
  uit.kruis = document.getElementById('crosshair').style.display;
  return uit;
});
ok('bij het begin heeft Erik geen wapen in beeld', wapen.slot === true && wapen.weg === true);
ok('en H haalt hem er niet uit', wapen.naH === true, wapen.melding);
ok('bij het gezelschap krijgt hij hem wel', wapen.naVerhaal === false && wapen.slotNa === false);
ok('met het richtkruis erbij', wapen.kruis === '');
ok('en met de uitleg over de toetsen', wapen.uitlegAan === true
  && /H/.test(wapen.uitlegTekst) && /LMB/.test(wapen.uitlegTekst)
  && /RMB/.test(wapen.uitlegTekst) && /R/.test(wapen.uitlegTekst), wapen.uitlegTekst.trim());

// ------------------------------------------------------------ in de auto
console.log('\nde uitleg in de auto');
const auto = await page.evaluate(async () => {
  const g = window.__game;
  const u = document.getElementById('uitleg');
  // eerst de vorige uitleg wegklikken
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }));
  await new Promise(r => requestAnimationFrame(r));
  /*
   Instappen zoals een speler dat doet: naast een auto gaan staan en op E
   drukken (dat is wat `toggleCar` doet). `player.inCar` zelf zetten werkt niet
   — de hoofdlus zet je er meteen weer uit als je niet bij de auto staat.
  */
  const car = g.vehicles.voegToe({ x: g.player.pos.x + 2.4, z: g.player.pos.z, yaw: 0, soort: 'hatch', kleur: 0x2a3f8f });
  if (!car) return { geenAuto: true };
  g.player.inCar = null;
  g.toggleCar();
  for (let i = 0; i < 8; i++) await new Promise(r => requestAnimationFrame(r));
  const uit = { aan: u.classList.contains('zichtbaar'), tekst: u.textContent, inAuto: !!g.player.inCar };
  if (g.player.inCar) g.toggleCar();
  return uit;
});
ok('de eerste keer in een auto komt er uitleg', auto.aan === true,
  `${auto.inAuto ? 'in de auto' : 'niet ingestapt'}: ${(auto.tekst || '').trim()}`);
ok('over de radiozenders en de camera',
  /←/.test(auto.tekst || '') && /→/.test(auto.tekst || '') && /V/.test(auto.tekst || ''));

console.log(`\nfouten in de pagina: ${fouten.length ? fouten.join(' | ') : 'geen'}`);
console.log(`\n${goed} goed, ${fout} fout`);
await browser.close();
process.exit(fout ? 1 : 0);
