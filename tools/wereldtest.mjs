/*
 Toetst wat je in beeld ziet en niet in een van de andere proeven past.

 1. De lucht: nergens een gat. De luchtbol heeft een straal van 1000 m; stond
    hij op de oorsprong, dan viel zijn achterkant aan de rand van de wijk buiten
    het achtervlak van de camera en keek je door dat gat tegen de zwarte
    achtergrond aan — een zwarte koepel die met je meedraaide.
 2. Het pistool: zichtbaar in de eerste persoon, met een arm die tot in de
    rechteronderhoek doorloopt, en met H stop je hem weg (dan schiet je niet en
    staat het kruisje uit).
 3. Erfscheidingen: in de vakken uit data/stijl/omgeving.json →
    `lageErfscheidingen` staat geen schutting van 1,8 m maar een lage haag.
 4. De vlaggen bij de supermarkt: het doek is twee panelen rug aan rug, zodat
    het woordmerk van beide kanten goed leest.
 5. Gaten in de ondergrond: nergens kijk je tussen de vlakken door naar beneden.

 Gebruik: python3 -m http.server 8123 &  node tools/wereldtest.mjs 8123
*/
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

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
const page = await browser.newPage({ viewport: { width: 400, height: 260 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
await page.evaluate(() => {
  localStorage.removeItem('tinga.spel.v1');
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  window.__game.player.active = true;
});

// ---------- 1. gaten in de lucht ----------
kop('de lucht');
const lucht = await page.evaluate(async () => {
  const g = window.__game;
  const cv = document.createElement('canvas'); cv.width = 400; cv.height = 260;
  const ctx = cv.getContext('2d');
  // de hoeken van de wijk: daar is de camera het verst van de oorsprong.
  // Er wordt niet zelf gerenderd: de hoofdlus van js/main.js moet het doen,
  // want dáár schuift de luchtbol met de camera mee.
  const beeld = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const plekken = [[380, -420], [-320, -400], [360, 420], [-300, 430]];
  let ergste = 0, waar = null;
  for (const [x, z] of plekken) {
    for (let k = 0; k < 4; k++) {
      g.player.pos.set(x, 0, z);
      g.player.yaw = k * Math.PI / 2; g.player.pitch = 0.3;
      g.player.applyCamera();
      await beeld();
      ctx.drawImage(g.renderer.domElement, 0, 0, 400, 260);
      const d = ctx.getImageData(0, 0, 400, 110).data;      // bovenste deel = lucht
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] < 24 && d[i + 1] < 24 && d[i + 2] < 24) n++;
      if (n > ergste) { ergste = n; waar = [x, z, Math.round(k * 90)]; }
    }
  }
  return { ergste, waar };
});
ok(lucht.ergste < 40, 'nergens een zwart gat in de lucht',
  lucht.waar ? `ergste plek ${lucht.waar[0]},${lucht.waar[1]} kijkend ${lucht.waar[2]}°: ${lucht.ergste} beeldpunten` : 'geen');

// ---------- 2. het pistool ----------
kop('het pistool in beeld');
const wapen = await page.evaluate(async () => {
  const THREE = await import('three');
  const g = window.__game;
  g.player.inCar = null; g.derde.aan = false;
  g.player.pos.set(96, 0, -58); g.player.yaw = 0; g.player.pitch = 0;
  g.player.update(1 / 60);
  // maten in cameraruimte: het wapen hangt aan de camera, dus een gewone
  // wereld-Box3 zou de plek van de speler teruggeven. Het model is genest
  // (wapen, hand en arm in eigen groepen), dus alles omrekenen via de
  // wereldmatrix en dan terug naar de camera.
  g.camera.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(g.camera.matrixWorld).invert();
  const doos = new THREE.Box3();
  const v = new THREE.Vector3();
  g.player.gun.traverse(o => {
    if (!o.isMesh || !o.visible) return;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z);
      v.applyMatrix4(o.matrixWorld).applyMatrix4(inv);
      doos.expandByPoint(v);
    }
  });
  const grootte = doos.getSize(new THREE.Vector3());
  const zichtbaar = g.player.gun.visible;
  // de arm moet naar rechtsonder uit beeld lopen
  const armEind = doos.max.z, armRechts = doos.max.x, armOnder = doos.min.y;
  g.player.wisselWapen();
  g.player.update(1 / 60);
  const naH = { zichtbaar: g.player.gun.visible, kruis: getComputedStyle(document.getElementById('crosshair')).display };
  const munitieVoor = g.player.ammo;
  g.player.shoot();
  const geschoten = g.player.ammo !== munitieVoor;
  g.player.wisselWapen();
  g.player.update(1 / 60);
  return { zichtbaar, lengte: +grootte.z.toFixed(3), hoogte: +grootte.y.toFixed(3),
    armEind: +armEind.toFixed(2), armRechts: +armRechts.toFixed(2), armOnder: +armOnder.toFixed(2),
    naH, geschoten, weerTerug: g.player.gun.visible,
    kruisTerug: getComputedStyle(document.getElementById('crosshair')).display };
});
ok(wapen.zichtbaar, 'het pistool staat in beeld');
ok(wapen.lengte > 0.55, 'het is groot genoeg om iets van te zien', `${wapen.lengte} m van loop tot elleboog`);
ok(wapen.armEind > 0.05 && wapen.armRechts > 0.2 && wapen.armOnder < -0.25,
  'de arm loopt naar de rechteronderhoek uit beeld',
  `tot x ${wapen.armRechts}, y ${wapen.armOnder}, z ${wapen.armEind}`);
ok(!wapen.naH.zichtbaar && wapen.naH.kruis === 'none', 'met H stop je hem weg, met het kruisje erbij');
ok(!wapen.geschoten, 'weggestopt schiet je niet');
ok(wapen.weerTerug && wapen.kruisTerug !== 'none', 'en met H komt hij weer terug');

// ---------- 3. erfscheidingen ----------
kop('erfscheidingen');
const omgeving = JSON.parse(readFileSync('data/stijl/omgeving.json', 'utf8'));
const vakken = omgeving.lageErfscheidingen || [];
const erf = await page.evaluate(async (vakken) => {
  const { KAART } = await import('./js/kaart.js');
  const uit = [];
  for (const v of vakken) {
    const inVak = (x, z) => x >= v.x0 && x <= v.x1 && z >= v.z0 && z <= v.z1;
    const hoog = KAART.schuttingen.filter(s => inVak((s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2));
    const laag = KAART.heggen.filter(s => inVak((s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2));
    uit.push({ naam: v.naam, hoog: hoog.length, laag: laag.length,
      hoogste: laag.reduce((m, s) => Math.max(m, s.h), 0) });
  }
  return uit;
}, vakken);
for (const v of erf) {
  ok(v.hoog === 0, `geen schutting van 1,8 m bij "${v.naam}"`, `${v.hoog} gevonden`);
  ok(v.laag > 0 && v.hoogste < 1.1, 'wel een lage haag of hekje', `${v.laag} stuks, hoogste ${v.hoogste} m`);
}

// ---------- 4. de vlaggen bij de supermarkt ----------
kop('de vlaggen bij de supermarkt');
const vlag = await page.evaluate(() => {
  const g = window.__game;
  let doek = null;
  g.scene.traverse(o => {
    if (doek || !o.isMesh || !o.material || !o.material.map) return;
    if (o.material.map.image && o.material.map.image.width === 128 && o.material.map.image.height === 512) doek = o;
  });
  if (!doek) return { gevonden: false };
  const n = doek.geometry.attributes.position.count / 3;
  return { gevonden: true, driehoeken: n };
});
ok(vlag.gevonden, 'het vlaggendoek zit in de wereld');
ok(vlag.gevonden && vlag.driehoeken >= 24,
  'het doek is twee panelen rug aan rug, dus het woordmerk leest van beide kanten goed',
  `${vlag.driehoeken} driehoeken`);

// ---------- de voordeur aan de Wieken ----------
/*
 Aan de Wieken zit de voordeur bij alle woningen rechts, met de woonkamerpui
 links ernaast. In de geveltexture stond hij om en om links en rechts, zoals bij
 de meeste rijtjes; de stijl zet daarom `deurRechts`. We kijken naar de texture
 zelf: waar zitten de beeldpunten met de deurkleur?
*/
kop('de voordeur aan de Wieken');
const deur = await page.evaluate(async () => {
  const T = await import('./js/textures.js');
  const meet = (type) => {
    const st = T.HOUSE_STYLES[type];
    const doel = st.door.map(h => h.replace('#', '').toLowerCase());
    const rgb = doel.map(h => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]);
    const uit = [];
    for (const n of [1, 2, 3]) {
      const c = T.facade(type, n, 1, false, 0).image;
      const g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const breed = c.width / n;
      const perWoning = new Array(n).fill(0).map(() => ({ som: 0, aantal: 0 }));
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        if (!rgb.some(q => Math.abs(d[i] - q[0]) < 12 && Math.abs(d[i + 1] - q[1]) < 12 && Math.abs(d[i + 2] - q[2]) < 12)) continue;
        const w = Math.min(n - 1, Math.floor(x / breed));
        perWoning[w].som += (x - w * breed) / breed; perWoning[w].aantal++;
      }
      uit.push(perWoning.map(q => (q.aantal ? q.som / q.aantal : -1)));
    }
    return uit;
  };
  return { wieken: meet('wieken_white'), gewoon: meet('molenkrite') };
});
const alleRechts = deur.wieken.flat().filter(q => q >= 0);
ok(alleRechts.length >= 5, 'de deuren zijn in de texture te vinden', `${alleRechts.length} woningen bekeken`);
ok(alleRechts.every(q => q > 0.5), 'aan de Wieken zit de voordeur bij elke woning rechts',
  alleRechts.map(q => q.toFixed(2)).join(', '));
const gewoon = deur.gewoon.flat().filter(q => q >= 0);
ok(gewoon.some(q => q < 0.5) && gewoon.some(q => q > 0.5),
  'en in een gewoon rijtje spiegelen ze nog steeds om elkaar heen',
  gewoon.map(q => q.toFixed(2)).join(', '));

// ---------- heggen en schuttingen van de goede kant ----------
/*
 De vier hoeken van een heg of schutting worden in js/kaartwereld.js in één
 volgorde gezet, en die volgorde bepaalt welke kant de zijvlakken op kijken.
 Stonden ze naar binnen, dan zag je de zijkant van een heg niet: je keek er
 dwars doorheen tegen de binnenkant van de overkant aan.
*/
kop('heggen en schuttingen');
const heg = await page.evaluate(async () => {
  const THREE = await import('./lib/three.module.js');
  const g = window.__game;
  const uit = {};
  for (const klasse of ['heg', 'schutting']) {
    // Alle meshes van deze klasse: ze staan sinds de optimalisatieronde per
    // tegel van 240 m in de scene in plaats van als één mesh voor de hele kaart.
    const meshes = [];
    g.scene.traverse(o => { if (o.userData && o.userData.klasse === klasse) meshes.push(o); });
    if (!meshes.length) { uit[klasse] = null; continue; }
    // zwaartepunt van elk blokje kennen we niet, maar wel dat van het hele
    // stuk: neem per zijvlak het punt en kijk of de normaal ervandaan wijst
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), n = new THREE.Vector3(), vn = new THREE.Vector3();
    let zij = 0, klopt = 0;
    for (const mesh of meshes) {
      const pos = mesh.geometry.getAttribute('position');
      const nor = mesh.geometry.getAttribute('normal');
      for (let i = 0; i < pos.count; i += 3) {
        a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
        e1.subVectors(b, a); e2.subVectors(c, a); n.crossVectors(e1, e2).normalize();
        if (Math.abs(n.y) > 0.9) continue;                 // bovenvlak
        vn.fromBufferAttribute(nor, i);
        zij++;
        if (n.dot(vn) > 0.5) klopt++;
      }
    }
    const mat = meshes[0].material;
    uit[klasse] = { zij, klopt, meshes: meshes.length, side: mat.side, dubbel: mat.side === THREE.DoubleSide };
  }
  /*
   En de proef op de som: staat er bij één heg een zijvlak dat naar buiten kijkt?
   De heggen zitten in tegelmeshes, dus we moeten de driehoeken van déze heg
   uit al die meshes bij elkaar pikken. Sinds de wereld groter is staan er buurheggen op ruim twee meter,
   en hún buitenkant kijkt naar de hartlijn van deze heg toe. Daarom zoeken we niet
   op afstand tot het midden maar op afstand tot de hartlijn zelf: alles wat verder
   dan een halve meter naast de lijn ligt of buiten de uiteinden valt, is een buur.
  */
  const { KAART } = await import('./js/kaart.js');
  /*
   Een heg die op zichzelf staat. Alle heggen zitten in dezelfde mesh, dus de
   driehoeken van de buurman zitten ertussen — en heggen sluiten kop aan kop op
   elkaar aan, dus die liggen precies op dezelfde hartlijn. Zoek er daarom een
   waar binnen vijf meter geen andere staat; met twaalfduizend heggen in de
   wereld gaat dat via een rooster in plaats van iedereen met iedereen.
  */
  const alle = (KAART.heggen || []).filter(q => q.soort !== 'hekje');
  const CEL = 5;
  const rooster = new Map();
  const cellenVan = (q) => {
    const uit = [];
    for (let i = Math.floor(Math.min(q.a[0], q.b[0]) / CEL) - 1; i <= Math.floor(Math.max(q.a[0], q.b[0]) / CEL) + 1; i++)
      for (let j = Math.floor(Math.min(q.a[1], q.b[1]) / CEL) - 1; j <= Math.floor(Math.max(q.a[1], q.b[1]) / CEL) + 1; j++) uit.push(i + ':' + j);
    return uit;
  };
  for (const q of alle) for (const k of cellenVan(q)) { if (!rooster.has(k)) rooster.set(k, []); rooster.get(k).push(q); }
  const h = alle.find(q => {
    if (Math.hypot(q.b[0] - q.a[0], q.b[1] - q.a[1]) < 4) return false;
    const buren = new Set();
    for (const k of cellenVan(q)) for (const b of (rooster.get(k) || [])) if (b !== q) buren.add(b);
    return buren.size === 0;
  });
  let buiten = 0, binnen = 0;
  if (h) {
    /*
     Alle heggenmeshes langs, niet één. Sinds de optimalisatieronde staan de
     heggen per tegel van 240 m in de scene in plaats van als één mesh voor de
     hele kaart, dus deze ene heg zit in precies één van die elf meshes. Deze
     proef pakte de laatste die hij tegenkwam en vond daar niets in: nul
     vlakken naar buiten én nul naar binnen, en dan slaagt de toets ten
     onrechte niet. Het spel is hier niet veranderd, de aanname van de proef
     was verouderd.
    */
    const meshes = [];
    g.scene.traverse(o => { if (o.userData && o.userData.klasse === 'heg') meshes.push(o); });
    const lx = h.b[0] - h.a[0], lz = h.b[1] - h.a[1];
    const L = Math.hypot(lx, lz) || 1;
    const ax = lx / L, az = lz / L;              // langs de heg
    const dx = -az, dz = ax;                     // dwars erop
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), n = new THREE.Vector3();
    for (const mesh of meshes) {
      const pos = mesh.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i += 3) {
        a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
        e1.subVectors(b, a); e2.subVectors(c, a); n.crossVectors(e1, e2).normalize();
        if (Math.abs(n.y) > 0.9) continue;                          // bovenvlak
        if (Math.abs(n.x * ax + n.z * az) > 0.9) continue;          // kopse kant
        const cx = (a.x + b.x + c.x) / 3 - h.a[0], cz = (a.z + b.z + c.z) / 3 - h.a[1];
        const langs = cx * ax + cz * az, dwars = cx * dx + cz * dz;
        // ruim binnen de uiteinden blijven: heggen sluiten kop aan kop op elkaar
        // aan, en dan liggen de kopse vlakken van de buurman óók op deze hartlijn
        if (langs < 0.6 || langs > L - 0.6 || Math.abs(dwars) > 0.4) continue;
        const naarBuiten = (n.x * dx + n.z * dz) * Math.sign(dwars);
        if (naarBuiten > 0.001) buiten++; else if (naarBuiten < -0.001) binnen++;
      }
    }
  }
  return { ...uit, buiten, binnen };
});
ok(heg.heg && heg.heg.zij > 100, 'de heggen hebben zijvlakken', `${heg.heg ? heg.heg.zij : 0} driehoeken`);
ok(heg.binnen === 0 && heg.buiten > 0, 'en die kijken naar buiten, niet naar binnen',
  `${heg.buiten} naar buiten, ${heg.binnen} naar binnen`);
ok(heg.heg && heg.heg.klopt === heg.heg.zij, 'met een normaal die bij het vlak past',
  `${heg.heg ? heg.heg.klopt : 0} van ${heg.heg ? heg.heg.zij : 0}`);
ok(!heg.schutting || heg.schutting.klopt === heg.schutting.zij,
  'de schuttingen ook', `${heg.schutting ? heg.schutting.klopt : 0} van ${heg.schutting ? heg.schutting.zij : 0}`);

// ---------- scherpte (G) ----------
/*
 MSAA vangt gekartelde randen, maar de dunne dingen op afstand — hekspijlen,
 dakranden, belijning — flikkeren daar doorheen. Daar helpt alleen op meer
 beeldpunten renderen dan het scherm heeft. Op een gewoon 1x-scherm stond de
 teller op precies 1,00, dus gebeurde er niets. Met G loop je door drie standen.
*/
kop('scherpte');
const scherp = await page.evaluate(async () => {
  const g = window.__game;
  const T = await import('./js/textures.js');
  const rij = [];
  for (let i = 0; i < 4; i++) {
    rij.push({
      stand: localStorage.getItem('tinga.scherpte') || '(nog niet gezet)',
      ratio: +g.renderer.getPixelRatio().toFixed(2),
    });
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyG' }));
    await new Promise(r => setTimeout(r, 40));
  }
  // hoe scherp staan de texturen bij schuine kijkhoek?
  let anis = 0;
  g.scene.traverse(o => {
    const m = o.material;
    for (const q of (Array.isArray(m) ? m : [m])) if (q && q.map) anis = Math.max(anis, q.map.anisotropy || 0);
  });
  return { rij, anis, max: g.renderer.capabilities.getMaxAnisotropy(), aa: g.renderer.getContext().getContextAttributes().antialias };
});
const standen = scherp.rij.map(q => `${q.stand} ${q.ratio}x`).join(' · ');
ok(scherp.aa, 'de randen worden gladgemaakt door de kaart zelf (MSAA)');
ok(scherp.rij.some(q => q.ratio > 1.2), 'met G kun je scherper renderen dan het scherm', standen);
ok(scherp.rij.some(q => q.ratio < 0.9), 'en zuiniger, voor een trage machine', standen);
ok(new Set(scherp.rij.map(q => q.stand)).size >= 3, 'de stand blijft bewaard en loopt rond', standen);
ok(scherp.anis >= Math.min(16, scherp.max), 'de texturen staan op het maximale anisotroop filteren',
  `${scherp.anis} van maximaal ${scherp.max}`);

/*
 ---------- gaten in de ondergrond ----------
 De opstaande rand langs een verhoogd vlak (berm, stoep, plantsoen) wordt in
 js/kaartwereld.js per rand als vierhoek opgebouwd, en de volgorde van de
 hoekpunten klapt om als de ring andersom loopt. Liep hij verkeerd om, dan keek
 de wand naar binnen, werd hij als achterkant weggeknipt en keek je onder het
 gras door tot op het grondvlak op −1 m.

 Meten gaat zo: het grondvlak wordt felroze gemaakt. Elk roze beeldpunt is dan
 een gat. Ter controle staat er één standpunt buiten het gebied, waar het
 grondvlak juist wél hoort te zien te zijn.

 De camera kijkt daarbij steil naar beneden, naar de grond binnen een meter of
 tien.
 Dat is nodig omdat de BGT-dekking niet overal doorloopt: ten zuidwesten van IJlst
 houdt hij op, en daar is het grondvlak gewoon de ondergrond en geen gat. Kijk je
 vooruit, dan staat die kale strook in beeld en meet de proef 2712 beeldpunten die
 niets met een kier te maken hebben.
*/
kop('gaten in de ondergrond');
await page.evaluate(async () => { window.__W = await import('/js/world.js'); });
const gaten = await page.evaluate(() => {
  const g = window.__game;
  let platen = 0, watervlakken = 0;
  g.scene.traverse(o => {
    // Het water is doorzichtig en ligt op −0,35, dus je kijkt er zo doorheen naar
    // het grondvlak op −1. Dat is geen gat — de speler ziet water. Voor de proef
    // maken we het ondoorzichtig.
    if (o.isMesh && o.userData && o.userData.klasse === 'water') {
      o.material = o.material.clone();
      o.material.transparent = false; o.material.opacity = 1; o.material.depthWrite = true;
      watervlakken++;
    }
    if (!o.isMesh || o.geometry.type !== 'PlaneGeometry') return;
    if (Math.abs(o.position.y + 1.0) > 0.01) return;
    o.material = o.material.clone();
    o.material.color.setHex(0xff00ff);
    if (o.material.emissive) o.material.emissive.setHex(0xff00ff);
    platen++;
  });
  const tel = (x, z, yaw, pitch, hoog) => {
    g.sfeer.uur = 12; g.sfeer.weer = 'helder';
    g.player.inCar = null; g.player.zit = false;
    g.player.pos.set(x, hoog, z); g.player.yaw = yaw; g.player.pitch = pitch; g.player.applyCamera();
    window.__W.updateLOD(x, z);      // anders staat de LOD nog op de vorige plek
    g.renderer.render(g.scene, g.camera);
    const gl = g.renderer.getContext();
    const w = g.renderer.domElement.width, h = g.renderer.domElement.height;
    const buf = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    let roze = 0;
    for (let i = 0; i < buf.length; i += 4) if (buf[i] > 140 && buf[i + 1] < 90 && buf[i + 2] > 140) roze++;
    return { roze, deel: +(roze / (w * h) * 100).toFixed(3),
      camY: +g.camera.position.y.toFixed(2), derde: !!(g.derde && g.derde.aan) };
  };
  const plekken = [
    ['Molenkrite', 30, -20], ['Jasker', -180, 120], ['Lemmerweg', 700, 330],
    ['IJlst', 1180, 700], ['Duinterpen', 1320, 300], ['Bonkelaar', 210, 60],
  ];
  const uit = [];
  for (const [naam, x, z] of plekken) {
    for (const [yaw, pitch, hoog] of [[0.4, -1.00, 2.0], [2.5, -0.95, 3.0], [4.2, -1.05, 1.6]]) {
      uit.push({ naam, ...tel(x, z, yaw, pitch, hoog) });
    }
  }
  const ijk = tel(-2400, -700, 0, -1.00, 2.0);   // buiten het gebied
  return { platen, watervlakken, uit, ijk };
});
ok(gaten.platen === 1, 'het grondvlak onder alles is gevonden', `${gaten.platen} plaat`);
ok(gaten.ijk.deel > 20, 'de proef werkt: buiten het gebied zie je het grondvlak wél',
  `${gaten.ijk.deel} % van het beeld`);
/*
 Een enkel beeldpunt mag: de BGT laat tussen twee vlakken af en toe een spleet van
 een paar decimeter open (0,04 % van het open terrein in Tinga, gemeten op een
 raster van twee meter), en daar is het grondvlak gewoon de ondergrond. Waar het
 om gaat is een hele wand die ontbreekt, en dat is een heel andere orde: vóór de
 draairichting rechtgezet werd stond er 0,58 % van het beeld vol.
*/
const ergste = gaten.uit.reduce((a, b) => (b.deel > a.deel ? b : a), gaten.uit[0]);
ok(gaten.uit.every(u => u.deel < 0.1), 'nergens kijk je tussen het gras en de weg door naar beneden',
  `${gaten.uit.length} standpunten, ergste ${ergste.naam} met ${ergste.deel} % van het beeld ` +
  `(${ergste.roze} beeldpunten)`);

await browser.close();
console.log(fouten === 0 ? '\nAlles goed.' : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
