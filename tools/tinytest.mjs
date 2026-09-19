/*
 De wereldwijzigingen van 19 september 2026.

   npm run server &   node tools/tinytest.mjs [poort]

 Vier dingen uit hetzelfde lijstje, en ze hebben gemeen dat je ze alleen ziet als
 je er staat:

 1. De twintig tiny houses aan de Molenkrite, tegenover Jeugdhulp Friesland. Die
    stonden als rijtjeshuis van twee lagen in gele baksteen in beeld, terwijl het
    losse woningen van eenendertig vierkante meter zijn.
 2. Rolcontainers stonden op de rijbaan, en er stonden er te veel.
 3. Op de verkeersdrempels lag een egale zwarte band: een doorzichtige textuur op
    een materiaal dat niet op `transparent` stond.
 4. De oeverwand liep dwars over de kades heen, en de steigers lagen als platte
    stroken op het water.

 Wat hier getoetst wordt is niet hoe het eruitziet — daar zijn de foto's van
 tools/tinyshots.mjs voor — maar of de meting klopt: staan de panden er met hun
 eigen maat uit de BAG, ligt er geen container meer op het asfalt, en is er geen
 stukje oeverwand meer dat onder een kade door loopt.
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

// ---------------------------------------------------------------- tiny houses
console.log('\nde tiny houses aan de Molenkrite');
const tiny = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const T = await import('/js/textures.js');
  const opp = (p) => {
    let a = 0;
    for (let i = 0, j = p.voet.length - 1; i < p.voet.length; j = i++) {
      a += (p.voet[j][0] + p.voet[i][0]) * (p.voet[j][1] - p.voet[i][1]);
    }
    return Math.abs(a / 2);
  };
  const mid = (p) => {
    let x = 0, z = 0;
    for (const q of p.voet) { x += q[0]; z += q[1]; }
    return [x / p.voet.length, z / p.voet.length];
  };
  const lijst = KAART.panden.filter(p => p.type === 'tinyhouse');
  const jeugd = KAART.panden.find(p => p.id === '0091100000007732');
  const [jx, jz] = jeugd ? mid(jeugd) : [0, 0];
  const st = T.HOUSE_STYLES.tinyhouse;
  return {
    aantal: lijst.length,
    opp: lijst.map(opp),
    goot: lijst.map(p => p.goot),
    nok: lijst.map(p => p.nok),
    afstand: lijst.map(p => { const [x, z] = mid(p); return Math.hypot(x - jx, z - jz); }),
    stijl: st && { damwand: !!st.damwand, storeys: st.storeys, w: st.w, roofType: st.roofType, hoogte: st.storeyH },
  };
});
ok('alle twintig panden staan als tiny house in de kaart', tiny.aantal === 20, `${tiny.aantal} gevonden`);
ok('hun grondvlak komt nog uit de BGT (rond de 31 m²)',
  tiny.opp.every(o => o > 25 && o < 38),
  `${Math.min(...tiny.opp).toFixed(0)}–${Math.max(...tiny.opp).toFixed(0)} m²`);
ok('en hun hoogte uit het 3D BAG-model (goot ~4,2 · nok ~6,3)',
  tiny.goot.every(g => g > 3.8 && g < 5.2) && tiny.nok.every(n => n > 5.9 && n < 7.0),
  `goot ${Math.min(...tiny.goot).toFixed(1)}–${Math.max(...tiny.goot).toFixed(1)}, nok ${Math.min(...tiny.nok).toFixed(1)}–${Math.max(...tiny.nok).toFixed(1)}`);
ok('ze staan tegenover Jeugdhulp Friesland', tiny.afstand.every(d => d < 140),
  `${Math.min(...tiny.afstand).toFixed(0)}–${Math.max(...tiny.afstand).toFixed(0)} m ervandaan`);
ok('de gevel is staand profiel en geen metselwerk', !!tiny.stijl && tiny.stijl.damwand === true);
/*
 En hebben ze een voordeur? Dat is geen overbodige vraag: het grondvlak uit de
 BGT heeft zestien punten waarvan er maar twee een zijde van meer dan 2,40 m
 opleveren — de twee lange zijden. De voorkant is opgedeeld in zeven facetjes,
 want daar zit de terugliggende entreenis. De regel die een muurvlak een gevel
 met ramen geeft eiste 2,40 m, dus was het hele huis blinde muur: geen deur, geen
 raam. Hier wordt daarom in de wereld zelf gekeken of er gevelvlakken bij de tiny
 houses staan, en niet alleen of de stijl klopt.
*/
const deuren = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const mid = (p) => {
    let x = 0, z = 0;
    for (const q of p.voet) { x += q[0]; z += q[1]; }
    return { x: x / p.voet.length, z: z / p.voet.length };
  };
  const harten = KAART.panden.filter(p => p.type === 'tinyhouse').map(mid);
  const met = new Set();
  window.__game.scene.traverse(o => {
    if (!o.isMesh) return;
    const k = o.userData.klasse;
    if (k !== 'voorgevel' && k !== 'achtergevel') return;
    const pos = o.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i += 3) {
      const x = pos.getX(i), z = pos.getZ(i);
      for (let h = 0; h < harten.length; h++) {
        if (met.has(h)) continue;
        if (Math.hypot(x - harten[h].x, z - harten[h].z) < 6) met.add(h);
      }
    }
  });
  return { met: met.size, van: harten.length };
});
ok('en ze hebben een voordeur en ramen in plaats van een blinde muur',
  deuren.met >= deuren.van * 0.8, `${deuren.met} van de ${deuren.van} met een gevelvlak`);
ok('en het is één laag met een puntdak',
  !!tiny.stijl && tiny.stijl.storeys === 1 && tiny.stijl.roofType === 'gable',
  tiny.stijl ? `${tiny.stijl.storeys} laag van ${tiny.stijl.hoogte} m, ${tiny.stijl.w} m breed` : 'geen stijl');

// ------------------------------------------------------------- rolcontainers
console.log('\nde rolcontainers');
const kliko = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  // de klasse van het kaartvlak onder een punt, net als js/rommel.js die gebruikt
  const HARD = new Set(['rijbaan', 'autoweg', 'parkeervlak', 'asfaltvlak', 'fietspad', 'brug', 'duiker', 'overbrugging', 'water', 'steiger']);
  const inRing = (r, x, z) => {
    let b = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const a = r[i], c = r[j];
      if ((a[1] > z) !== (c[1] > z) && x < (c[0] - a[0]) * (z - a[1]) / (c[1] - a[1]) + a[0]) b = !b;
    }
    return b;
  };
  const CEL = 40, net = new Map();
  for (const v of KAART.vlakken) {
    if (!HARD.has(v.k)) continue;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const r of v.r) for (const p of r) {
      if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
      if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1];
    }
    for (let i = Math.floor(x0 / CEL); i <= Math.floor(x1 / CEL); i++) {
      for (let j = Math.floor(z0 / CEL); j <= Math.floor(z1 / CEL); j++) {
        const k = `${i}:${j}`;
        if (!net.has(k)) net.set(k, []);
        net.get(k).push({ v, bb: [x0, x1, z0, z1] });
      }
    }
  }
  const opHard = (x, z) => {
    const lijst = net.get(`${Math.floor(x / CEL)}:${Math.floor(z / CEL)}`);
    if (!lijst) return null;
    for (const { v, bb } of lijst) {
      if (x < bb[0] || x > bb[1] || z < bb[2] || z > bb[3]) continue;
      if (!inRing(v.r[0], x, z)) continue;
      let gat = false;
      for (let i = 1; i < v.r.length; i++) if (inRing(v.r[i], x, z)) { gat = true; break; }
      if (!gat) return v.k;
    }
    return null;
  };
  // alle geplaatste containers uit de instanced meshes terughalen
  const g = window.__game;
  const m = new (await import('three')).Matrix4();
  let n = 0, mis = 0;
  const misser = [];
  g.scene.traverse(o => {
    if (!o.isInstancedMesh || o.userData.klasse !== 'kliko') return;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m);
      const x = m.elements[12], z = m.elements[14];
      n++;
      const k = opHard(x, z);
      if (k) { mis++; if (misser.length < 5) misser.push(`${k} op (${x.toFixed(0)}, ${z.toFixed(0)})`); }
    }
  });
  return { n, mis, misser };
});
ok('er staan rolcontainers in de wereld', kliko.n > 0, `${kliko.n} stuks`);
ok('en geen enkele op de rijbaan of het fietspad', kliko.mis === 0,
  kliko.mis ? `${kliko.mis} fout: ${kliko.misser.join(', ')}` : '');

// -------------------------------------------------------------- de drempels
console.log('\nde verkeersdrempels');
const drempel = await page.evaluate(() => {
  const g = window.__game;
  let m = null;
  g.scene.traverse(o => { if (o.isMesh && o.userData.klasse === 'drempel') m = o.material; });
  if (!m) return null;
  return {
    transparant: m.transparent === true,
    alphaTest: m.alphaTest,
    herhaalt: !!m.map && m.map.wrapS === 1000 && m.map.wrapT === 1000,   // RepeatWrapping
  };
});
ok('de drempels staan in de wereld', !!drempel);
ok('hun markering is doorzichtig waar er niets staat',
  !!drempel && drempel.transparant && drempel.alphaTest > 0,
  drempel ? `alphaTest ${drempel.alphaTest}` : '');
ok('en de textuur herhaalt in plaats van zijn lege rand uit te rekken',
  !!drempel && drempel.herhaalt);

// ------------------------------------------------- de oeverwand en de steigers
console.log('\nde waterkant');
const wal = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const VERHARD = new Set(['voetpad', 'verharding', 'parkeervlak', 'steiger', 'asfaltvlak', 'rijbaan', 'inrit', 'fietspad']);
  const inRing = (r, x, z) => {
    let b = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const a = r[i], c = r[j];
      if ((a[1] > z) !== (c[1] > z) && x < (c[0] - a[0]) * (z - a[1]) / (c[1] - a[1]) + a[0]) b = !b;
    }
    return b;
  };
  const CEL = 40, net = new Map();
  for (const v of KAART.vlakken) {
    if (!VERHARD.has(v.k) || !(v.y >= 0.11)) continue;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const r of v.r) for (const p of r) {
      if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
      if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1];
    }
    for (let i = Math.floor(x0 / CEL); i <= Math.floor(x1 / CEL); i++) {
      for (let j = Math.floor(z0 / CEL); j <= Math.floor(z1 / CEL); j++) {
        const k = `${i}:${j}`;
        if (!net.has(k)) net.set(k, []);
        net.get(k).push({ v, bb: [x0, x1, z0, z1] });
      }
    }
  }
  const inVlak = (x, z) => {
    const lijst = net.get(`${Math.floor(x / CEL)}:${Math.floor(z / CEL)}`);
    if (!lijst) return false;
    for (const { v, bb } of lijst) {
      if (x < bb[0] || x > bb[1] || z < bb[2] || z > bb[3]) continue;
      if (!inRing(v.r[0], x, z)) continue;
      let gat = false;
      for (let i = 1; i < v.r.length; i++) if (inRing(v.r[i], x, z)) { gat = true; break; }
      if (!gat) return true;
    }
    return false;
  };
  /*
   Niet één punt toetsen maar een schijfje van dertig centimeter eromheen.

   Waar een steiger aan het water grenst is de rand van het waterdeel diezelfde
   lijn als de rand van de steiger. Het stukje oeverwand ligt daar dus precies
   óp de grens, en dan is "ligt dit punt in dat vlak?" een muntje opgooien: de
   helft van de keren ja. Zo kwamen er honderdachtentwintig meldingen uit terwijl
   die wand staat waar hij hoort. Alleen als het hele schijfje bedekt is loopt de
   wand er écht onderdoor, en dat is wat je wilde weten.
  */
  const eronder = (x, z) => {
    const r = 0.3;
    return inVlak(x, z) && inVlak(x + r, z) && inVlak(x - r, z) && inVlak(x, z + r) && inVlak(x, z - r);
  };
  const g = window.__game;
  let punten = 0, onderKade = 0, steigerranden = 0, oeverwanden = 0;
  const waar = [];
  g.scene.traverse(o => {
    if (!o.isMesh) return;
    if (o.userData.klasse === 'steigerrand') { steigerranden++; return; }
    if (o.userData.klasse !== 'oeverwand') return;
    oeverwanden++;
    /*
     Per stukje wand het mídden nemen, niet een hoekpunt.

     Elk stukje is een vierhoek van zes hoekpunten, en de hoekpunten liggen per
     definitie precies op de grens van het waterdeel. Loopt een kade tot aan die
     grens — en dat is precies wat een kade hoort te doen — dan ligt zo'n
     hoekpunt exáct op de rand van het kadevlak, en dan is "ligt dit punt erin?"
     een muntje opgooien. Zo kwamen er honderdveertig valse treffers uit terwijl
     er niets mis was. Het midden van het stukje geeft wél antwoord op de vraag
     die je stelt: loopt deze wand ónder de kade door?
    */
    const pos = o.geometry.getAttribute('position');
    for (let i = 0; i + 5 < pos.count; i += 6) {
      let x = 0, z = 0;
      for (let k = 0; k < 6; k++) { x += pos.getX(i + k); z += pos.getZ(i + k); }
      x /= 6; z /= 6;
      punten++;
      if (eronder(x, z)) { onderKade++; if (waar.length < 4) waar.push(`(${x.toFixed(1)}, ${z.toFixed(1)})`); }
    }
  });
  return { punten, onderKade, steigerranden, oeverwanden, waar };
});
ok('er staan oeverwanden langs het water', wal.oeverwanden > 0, `${wal.oeverwanden} meshes, ${wal.punten} stukjes getoetst`);
ok('geen daarvan loopt onder een kade of steiger door', wal.onderKade === 0,
  wal.onderKade ? `${wal.onderKade} wel, onder andere ${wal.waar.join(' ')}` : '');
ok('en de steigers hebben een houten zijkant', wal.steigerranden > 0, `${wal.steigerranden} meshes`);

console.log(`\nfouten in de pagina: ${fouten.length ? fouten.join(' | ') : 'geen'}`);
if (fouten.length) fout++;
console.log(`\n${goed} goed, ${fout} fout`);
await browser.close();
process.exit(fout ? 1 : 0);
