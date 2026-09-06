/*
 Toetst Houtzaagmolen De Rat aan het Sneekerpad 16 (js/molen.js) en supermarkt
 Poiesz aan De Dassenboarch 32 (js/textures.js), allebei in IJlst:

   - staat de molen in de kaart, met de stelling op de goot en de nok van het
     BAG-pand, en ligt zijn hart binnen het grondvlak?
   - is het opgetrokken 3D BAG-model van dat pand vervangen door de molen, en
     staat het op de platte controleplaat wél gewoon als pand?
   - staat de molen er van onder naar boven: zaagloodsen, geteerde onderbouw,
     stelling, rieten achtkant, kap, gevlucht?
   - draait het gevlucht, en hoe snel?
   - blijven de roeden boven de stelling en reiken ze tot de halve vlucht?
   - houdt de molen je tegen als je ertegenaan loopt, en zie je hem vanaf de weg?
   - heeft de Poiesz het eigen woningtype met de groene huisstijl, en staat er
     baksteen boven de pui in plaats van glas tot aan het dak?

 Gebruik: python3 -m http.server 8123 &  node tools/molentest.mjs 8123
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
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });
await page.evaluate(async () => {
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  const { KAART } = await import('/js/kaartwereld.js');
  window.__K = KAART;
  window.__W = await import('/js/world.js');
  window.__M = await import('/js/molen.js');
  window.__T = await import('/js/textures.js');
  window.__inRing = (p, ring) => {
    let in_ = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) in_ = !in_;
    }
    return in_;
  };
});
await page.waitForTimeout(400);

// ---------- 1. de molen in de kaart ----------
kop('de molen in de kaart');
const kaart = await page.evaluate(() => {
  const K = window.__K;
  const M = (K.molens || [])[0];
  if (!M) return { er: false };
  const p = K.panden.find(q => q.id === M.pand);
  return {
    er: true, naam: M.naam, aantal: K.molens.length,
    stelling: M.stelling, top: M.top, romp: M.romp, vlucht: M.vlucht, toeren: M.toeren,
    goot: p && p.goot, nok: p && p.nok, jaar: p && p.jaar,
    inVoet: p ? window.__inRing([M.cx, M.cz], p.voet) : false,
    nr: p && p.nr, ringPunten: M.loods ? M.loods.ring.length : 0,
  };
});
ok(kaart.er, 'er staat een molen in js/kaart.js', kaart.er ? `${kaart.aantal}: ${kaart.naam}` : 'KAART.molens is leeg');
ok(kaart.er && Math.abs(kaart.stelling - kaart.goot) < 0.01,
  'de stelling is de goot van het BAG-pand', `${kaart.stelling} m tegen goot ${kaart.goot} m`);
ok(kaart.er && Math.abs(kaart.top - kaart.nok) < 0.01,
  'de nok van de molen is de nok van het pand', `${kaart.top} m`);
ok(kaart.er && kaart.top > 18 && kaart.top < 24, 'en dat is een molenhoogte', `${kaart.top} m`);
ok(kaart.er && kaart.inVoet, 'het hart van de romp ligt binnen het grondvlak');
ok(kaart.er && (kaart.nr || []).includes('16'), 'het is het pand met huisnummer 16', (kaart.nr || []).join(', '));
ok(kaart.er && kaart.jaar < 1800, 'en het is een oud pand', `bouwjaar ${kaart.jaar}`);
ok(kaart.er && kaart.ringPunten >= 4, 'het grondvlak van de zaagloodsen zit erbij', `${kaart.ringPunten} punten`);

// ---------- 2. het opgetrokken BAG-model is weg ----------
/*
 De molen komt in de plaats van het pand. Dat is niet met een vlag te toetsen,
 dus we kijken of er nog gevel- of dakvlakken van dat pand in de scene staan:
 hoekpunten van een pandmesh binnen tien meter van het hart, boven de stelling.
 De molen zelf staat in eigen meshes met een eigen naam.
*/
kop('het BAG-model is vervangen');
const meshes = await page.evaluate(() => {
  const g = window.__game, M = window.__K.molens[0];
  const namen = new Set();
  let pandPunten = 0;
  g.scene.traverse(o => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
    if (o.name) namen.add(o.name);
    const molenMesh = /molen|zaagloods|roeden|hekwerk/.test(o.name || '');
    if (molenMesh || o.isInstancedMesh) return;
    const pos = o.geometry.attributes.position;
    // alleen de gevel- en dakmeshes van panden hebben een klasse
    const kl = o.userData && o.userData.klasse;
    if (!kl || !['muur', 'voorgevel', 'achtergevel', 'dak', 'platdak', 'topgevel', 'dakkapel'].includes(kl)) return;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (y > M.stelling && Math.hypot(x - M.cx, z - M.cz) < 10) { pandPunten++; break; }
    }
  });
  return { namen: [...namen].filter(n => /molen|zaagloods|roeden|hekwerk/.test(n)), pandPunten };
});
ok(meshes.pandPunten === 0, 'er staat geen opgetrokken pand meer op de plek van de molen',
  `${meshes.pandPunten} pandmeshes met punten boven de stelling`);
for (const deel of ['zaagloods', 'molen-onderbouw', 'molen-stelling', 'molen-riet', 'molen-kap', 'roeden', 'hekwerk']) {
  ok(meshes.namen.includes(deel) || meshes.namen.some(n => n.startsWith(deel)), `${deel} staat in de wereld`);
}

// ---------- 3. de maten van wat er staat ----------
kop('de maten van de molen');
const maten = await page.evaluate(() => {
  const g = window.__game, M = window.__K.molens[0];
  const grens = {};
  g.scene.traverse(o => {
    if (!o.isMesh || !o.geometry || !o.name) return;
    if (!/molen|zaagloods/.test(o.name)) return;
    const pos = o.geometry.attributes.position;
    let hoog = -Infinity, laag = Infinity, ver = 0;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > hoog) hoog = y;
      if (y < laag) laag = y;
      ver = Math.max(ver, Math.hypot(pos.getX(i) - M.cx, pos.getZ(i) - M.cz));
    }
    grens[o.name] = { hoog: +hoog.toFixed(2), laag: +laag.toFixed(2), ver: +ver.toFixed(2) };
  });
  return { grens, top: M.top, stelling: M.stelling, romp: M.romp };
});
const kapG = maten.grens['molen-kap'] || {};
ok(Math.abs((kapG.hoog ?? 0) - maten.top) < 0.05, 'de kap loopt tot de nok', `${kapG.hoog} m van ${maten.top} m`);
const teerG = maten.grens['molen-onderbouw'] || {};
ok((teerG.laag ?? 9) < 0.05 && Math.abs((teerG.hoog ?? 0) - maten.stelling) < 0.2,
  'de geteerde onderbouw loopt van het maaiveld tot de stelling', `${teerG.laag} tot ${teerG.hoog} m`);
const dekG = maten.grens['molen-stelling'] || {};
ok(Math.abs((dekG.hoog ?? 0) - maten.stelling) < 0.05 && (dekG.ver ?? 0) > maten.romp + 1.5,
  'de omloop steekt rondom uit', `tot ${dekG.ver} m uit het hart, op ${dekG.hoog} m`);
const loodsG = maten.grens['zaagloods'] || {};
ok((loodsG.hoog ?? 99) < maten.stelling, 'de zaagloodsen blijven onder de stelling',
  `nok ${loodsG.hoog} m tegen stelling ${maten.stelling} m`);

// ---------- 4. het gevlucht ----------
kop('het gevlucht');
const wiek = await page.evaluate(async () => {
  const { molenIntern, draaiMolens } = window.__M;
  const M = window.__K.molens[0];
  const lijst = molenIntern();
  if (!lijst.length) return { er: false };
  const groep = lijst[0].groep;
  const voor = groep.rotation.z;
  draaiMolens(60);                       // een volle minuut
  const na = groep.rotation.z;
  groep.rotation.z = voor;
  groep.updateMatrixWorld(true);
  // waar hangt het gevlucht in de wereld?
  let laagste = Infinity, hoogste = -Infinity, verste = 0;
  for (const kind of groep.children) {
    const pos = kind.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const v = { x: pos.getX(i), y: pos.getY(i), z: pos.getZ(i) };
      const w = kind.localToWorld ? kind.localToWorld(new groep.position.constructor(v.x, v.y, v.z)) : v;
      laagste = Math.min(laagste, w.y); hoogste = Math.max(hoogste, w.y);
      verste = Math.max(verste, Math.hypot(w.x - M.cx, w.z - M.cz));
    }
  }
  return {
    er: true, omwentelingen: (na - voor) / (Math.PI * 2), toeren: M.toeren,
    laagste: +laagste.toFixed(2), hoogste: +hoogste.toFixed(2), verste: +verste.toFixed(2),
    stelling: M.stelling, vlucht: M.vlucht, top: M.top,
  };
});
ok(wiek.er, 'het gevlucht staat in een eigen groep die kan draaien');
ok(wiek.er && Math.abs(wiek.omwentelingen - wiek.toeren) < 0.01,
  'het draait op het aantal toeren uit de stijlcatalogus', `${wiek.omwentelingen.toFixed(2)} omwentelingen per minuut`);
ok(wiek.er && wiek.omwentelingen > 1 && wiek.omwentelingen < 12,
  'en dat is langzaam: ruim tien seconden per rondje', `${(60 / wiek.omwentelingen).toFixed(1)} s`);
ok(wiek.er && wiek.laagste > wiek.stelling,
  'de roeden strijken over de stelling en raken hem niet', `laagste punt ${wiek.laagste} m, stelling ${wiek.stelling} m`);
ok(wiek.er && wiek.hoogste > wiek.top,
  'en ze komen boven de kap uit', `${wiek.hoogste} m tegen nok ${wiek.top} m`);
ok(wiek.er && Math.abs(wiek.verste - wiek.vlucht / 2) < 1.2,
  'de vlucht klopt: van tip tot tip de opgegeven maat', `${(wiek.verste * 2).toFixed(1)} m tegen ${wiek.vlucht} m`);

// ---------- 5. tegen de molen aan lopen, en hem zien ----------
kop('de molen op straat');
const straat = await page.evaluate(() => {
  const W = window.__W, M = window.__K.molens[0];
  // van tien meter uit het hart naar het hart toe lopen
  const stap = 0.25;
  let x = M.cx + 14, z = M.cz, dichtst = 14;
  for (let i = 0; i < 200; i++) {
    const px = x - stap, pz = z;
    const [nx, nz] = W.resolveCollisions(px, pz, 0.35);
    x = nx; z = nz;
    dichtst = Math.min(dichtst, Math.hypot(x - M.cx, z - M.cz));
  }
  /*
   En het uitzicht vanaf de dichtstbijzijnde rijbaan. Rechtstreeks `zichtVrij`
   naar het hart van de molen vragen heeft geen zin: de molen staat zelf in de
   weg — het pand heeft een botsingsdoos over het hele grondvlak van de
   loodsen. De vraag is of er iets ánders tussen staat, dus we lopen de lijn van
   de weg naar de molen af en kijken waar het zicht voor het eerst breekt.
  */
  let best = null, bd = 1e9;
  for (const as of window.__K.wegassen) {
    if (!as.drive) continue;
    for (const q of as.pts) { const d = Math.hypot(q[0] - M.cx, q[1] - M.cz); if (d < bd) { bd = d; best = q; } }
  }
  let breek = bd;
  for (let t = 0.05; t <= 1.0; t += 0.02) {
    const px = best[0] + (M.cx - best[0]) * t, pz = best[1] + (M.cz - best[1]) * t;
    if (!W.zichtVrij(best[0], best[1], px, pz, 3)) { breek = Math.hypot(px - M.cx, pz - M.cz); break; }
  }
  return { dichtst: +dichtst.toFixed(2), romp: M.romp, weg: +bd.toFixed(1), breek: +breek.toFixed(1) };
});
ok(straat.dichtst > 3, 'je loopt niet dwars door de molen heen',
  `je komt tot ${straat.dichtst} m van het hart (romp ${straat.romp} m)`);
ok(straat.weg < 60, 'de molen staat vlak aan het Sneekerpad', `${straat.weg} m`);
ok(straat.breek < 15, 'en er staat vanaf de weg niets voor: het eerste wat het zicht breekt is de molen zelf',
  `het zicht breekt op ${straat.breek} m van het hart`);

// ---------- 6. de Poiesz ----------
kop('supermarkt Poiesz');
const winkel = await page.evaluate(() => {
  const T = window.__T, K = window.__K;
  const p = K.panden.find(q => q.type === 'poiesz');
  const st = T.HOUSE_STYLES.poiesz;
  if (!p || !st) return { er: false };
  // het gevelblad zelf uitlezen: staat het woordmerk erop, en hoeveel van de
  // gevel is glas en hoeveel baksteen?
  const im = T.facade('poiesz', 3, 2, false, 1).image;
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  const d = g.getImageData(0, 0, im.width, im.height).data;
  let groen = 0, steen = 0, totaal = 0;
  for (let y = 0; y < im.height; y += 2) for (let x = 0; x < im.width; x += 2) {
    const i = (y * im.width + x) * 4, r = d[i], gr = d[i + 1], b = d[i + 2];
    totaal++;
    if (gr > r + 30 && gr > b + 30 && gr > 90) groen++;                     // het woordmerk
    if (r > gr + 18 && r > b + 24 && r > 70 && r < 190) steen++;            // bruinrode baksteen
  }
  return {
    er: true, type: p.type, merk: st.merk, merkKleur: st.merkKleur, puiDeel: st.puiDeel,
    front: p.front, nr: p.nr, groen: +(100 * groen / totaal).toFixed(2), steen: +(100 * steen / totaal).toFixed(1),
    hoogte: im.height, breedte: im.width,
  };
});
ok(winkel.er, 'de Poiesz heeft een eigen woningtype', winkel.er ? `${winkel.type}, merk ${winkel.merk}` : 'niet gevonden');
ok(winkel.er && (winkel.nr || []).includes('32'), 'het is het pand met huisnummer 32', (winkel.nr || []).join(', '));
ok(winkel.er && winkel.merk === 'POIESZ' && winkel.merkKleur.length === 7, 'het woordmerk staat in de stijl', `${winkel.merk} in ${winkel.merkKleur}`);
ok(winkel.er && winkel.groen > 0.05, 'en het staat groen op de gevel', `${winkel.groen} % van het gevelblad is groen`);
ok(winkel.er && winkel.steen > 12, 'boven de pui zit baksteen, geen glas tot aan het dak', `${winkel.steen} % baksteen`);
ok(winkel.er && winkel.puiDeel > 0 && winkel.puiDeel < 1, 'de pui beslaat maar een deel van de gevel', `${winkel.puiDeel}`);
ok(winkel.er && winkel.front && winkel.front[0] > 0.8, 'de voorgevel kijkt naar het parkeerterrein aan de oostkant',
  winkel.front ? winkel.front.join(', ') : '');

console.log(fouten ? `\n${fouten} fout(en).` : '\nAlles goed.');
await browser.close();
process.exit(fouten ? 1 : 0);
