/*
 De zuilengang onder een woonblok — de twee gebogen blokken aan de Keizersmantel
 in Duinterpen (401-437 met de Poiesz erin, en 441-485 ernaast), en elk ander
 pand dat in data/stijl/straten.json een `zuilengang` heeft.

 Waarom een eigen module en niet gewoon een gevel: bij deze blokken ligt de
 begane grond een paar meter achter de rooilijn en staan de twee woonlagen
 erboven op een rij ronde zuilen. Een gevelplaat is één plat vlak op de
 rooilijn, dus die kan die terugliggende pui niet laten zien — je zou tegen een
 dichte wand met een tekening van winkelramen aankijken. Hier wordt daarom het
 stuk onder de gang echt gebouwd:

   - de zuilen zelf, op de boog uit KAART.zuilengangen (die boog komt uit het
     grondvlak in de BGT, zie tools/geo/genereer.mjs);
   - de pui erachter, `diepte` meter naar binnen: donker glas met lichte stijlen,
     en bij de Poiesz het groene woordmerk boven de ingang;
   - het plafond van de gang tussen de pui en de zuilen, met een lichte band
     langs de voorkant;
   - de vloer van de gang, een tint donkerder dan de bestrating ervoor.

 En `js/kaartwereld.js` laat de muren van zo'n pand pas op `hoogte` beginnen, met
 `knipOpHoogte`. Zonder dat zou de gewone gevel over deze hele bouw heen staan.

 Wat waar vandaan komt: de boog, de hoogte van de gang (de goot van het pand,
 3,95 en 4,01 m) en de plaats van de zuilen komen uit de geodata; de dikte van
 een zuil, hun onderlinge afstand, de diepte van de pui en alle kleuren zijn van
 de foto afgemeten. Dat staat per pand in de `bron` bij de stijlcatalogus.
*/
import * as THREE from 'three';

const HOEKEN = 12;          // een zuil is een twaalfhoek: rond genoeg op straat

// ---------------------------------------------------------------- texturen
// Alles op een canvas getekend; er zit geen enkel plaatje in het spel.
function doek(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/*
 De winkelpui: donker glas in lichte stijlen. Het glas is niet egaal maar met
 een verloop van boven donker naar onder lichter, want zo staat het op de foto —
 bovenin spiegelt het de luifel, onderin zie je de winkel erdoorheen.
*/
let puiDoek = null;
function pui() {
  if (puiDoek) return puiDoek;
  const S = 512, c = doek(S, S), g = c.getContext('2d');
  const vl = g.createLinearGradient(0, 0, 0, S);
  vl.addColorStop(0, '#1d2a33');
  vl.addColorStop(0.55, '#2c3d47');
  vl.addColorStop(1, '#46595f');
  g.fillStyle = vl; g.fillRect(0, 0, S, S);
  // stijlen: vier verticale en één horizontale, in lichtgrijs aluminium
  g.fillStyle = '#c9cdcd';
  for (let i = 0; i <= 4; i++) g.fillRect(Math.round(i * (S - 10) / 4), 0, 10, S);
  g.fillRect(0, Math.round(S * 0.62), S, 8);
  g.fillRect(0, 0, S, 12);                       // bovendorpel
  g.fillRect(0, S - 16, S, 16);                  // onderdorpel
  // een streepje weerspiegeling over het glas
  g.fillStyle = 'rgba(255,255,255,0.10)';
  g.beginPath(); g.moveTo(0, S * 0.30); g.lineTo(S, S * 0.14); g.lineTo(S, S * 0.22); g.lineTo(0, S * 0.38); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  puiDoek = t;
  return t;
}

/*
 Het woordmerk POIESZ: groene letters met een schuine oranje I, op een lichte
 band. Dezelfde opbouw als in js/textures.js, maar hier op een eigen bord zodat
 het boven de ingang van de gang kan hangen.
*/
let merkDoek = null;
function merk() {
  if (merkDoek) return merkDoek;
  const W = 512, H = 128, c = doek(W, H), g = c.getContext('2d');
  g.fillStyle = '#f2f4f3'; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, H - 7, W, 7);
  const letters = 'POIESZ'.split('');
  g.font = 'bold 84px sans-serif';
  g.textBaseline = 'middle';
  const breed = letters.map(l => g.measureText(l).width);
  const totaal = breed.reduce((a, b) => a + b, 0) + (letters.length - 1) * 8;
  let x = (W - totaal) / 2;
  letters.forEach((l, i) => {
    const schuin = i === 2;                       // de derde letter is de oranje I
    g.save();
    g.translate(x + breed[i] / 2, H / 2);
    if (schuin) g.transform(1, 0, -0.26, 1, 0, 0);
    g.fillStyle = schuin ? '#e8511f' : '#43b02a';
    g.textAlign = 'center';
    g.fillText(l, 0, 4);
    g.restore();
    x += breed[i] + 8;
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  merkDoek = t;
  return t;
}

// ---------------------------------------------------------------- bouwen
/*
 Een vierhoek met een gegeven buitenrichting. Net als in js/molen.js draait hij
 zichzelf om als de normaal de verkeerde kant op wijst: een vlak met zijn
 normaal in de muur is onzichtbaar, en bij een gebogen boog is de goede volgorde
 niet uit de code af te lezen.
*/
function quad(bak, P, Q, R, S, uv, uit) {
  const ax = Q[0] - P[0], ay = Q[1] - P[1], az = Q[2] - P[2];
  const bx = S[0] - P[0], by = S[1] - P[1], bz = S[2] - P[2];
  let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
  const L = Math.hypot(nx, ny, nz) || 1;
  nx /= L; ny /= L; nz /= L;
  const om = (nx * uit[0] + ny * uit[1] + nz * uit[2]) < 0;
  if (om) { nx = -nx; ny = -ny; nz = -nz; }
  const hoek = om ? [P, S, R, P, R, Q] : [P, Q, R, P, R, S];
  const uvs = om ? [uv[0], uv[3], uv[2], uv[0], uv[2], uv[1]] : [uv[0], uv[1], uv[2], uv[0], uv[2], uv[3]];
  for (let i = 0; i < 6; i++) {
    bak.pos.push(hoek[i][0], hoek[i][1], hoek[i][2]);
    bak.nor.push(nx, ny, nz);
    bak.uv.push(uvs[i][0], uvs[i][1]);
  }
}

function mesh(bak, mat, klasse, schaduw = true) {
  if (!bak.pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(bak.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(bak.nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(bak.uv, 2));
  const m = new THREE.Mesh(g, mat);
  m.castShadow = schaduw; m.receiveShadow = true;
  m.userData.klasse = klasse;
  return m;
}

export function bouwZuilengangen(scene, W, gangen, panden) {
  if (!gangen || !gangen.length) return 0;
  const pandVan = new Map((panden || []).map(p => [p.id, p]));

  const MAT = {
    zuil: new THREE.MeshStandardMaterial({ color: 0xe7e6e0, roughness: 0.55, metalness: 0.05 }),
    pui: new THREE.MeshStandardMaterial({ map: pui(), roughness: 0.22, metalness: 0.12 }),
    plafond: new THREE.MeshStandardMaterial({ color: 0xd9d6cd, roughness: 0.9 }),
    vloer: new THREE.MeshStandardMaterial({ color: 0x8d8781, roughness: 0.95 }),
    band: new THREE.MeshStandardMaterial({ color: 0xece6d6, roughness: 0.7 }),
    merk: new THREE.MeshStandardMaterial({ map: merk(), roughness: 0.6 }),
  };

  let gebouwd = 0;
  for (const gang of gangen) {
    const boog = gang.boog;
    if (!boog || boog.length < 2) continue;
    const H = gang.hoogte, D = gang.diepte, R = gang.straal;
    const pand = pandVan.get(gang.pand);

    /*
     Naar welke kant ligt "buiten"? De boog loopt langs de rooilijn; de pui ligt
     `diepte` meter naar de andere kant. Welke kant dat is volgt uit het
     zwaartepunt van de boog tegenover het hart van het pand: het pand zit
     áchter de gang.
     */
    let bx = 0, bz = 0;
    for (const p of boog) { bx += p[0]; bz += p[1]; }
    bx /= boog.length; bz /= boog.length;
    const hx = pand && pand.rect ? pand.rect.cx : bx;
    const hz = pand && pand.rect ? pand.rect.cz : bz;
    let ix = hx - bx, iz = hz - bz;
    const iL = Math.hypot(ix, iz) || 1;
    ix /= iL; iz /= iL;                       // van de boog naar binnen

    const puiBak = { pos: [], nor: [], uv: [] };
    const plafondBak = { pos: [], nor: [], uv: [] };
    const vloerBak = { pos: [], nor: [], uv: [] };
    const bandBak = { pos: [], nor: [], uv: [] };

    // per stuk boog: pui, plafond, vloer en de band langs de voorkant
    let langs = 0;
    for (let i = 0; i < boog.length - 1; i++) {
      const a = boog[i], b = boog[i + 1];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const L = Math.hypot(dx, dz);
      if (L < 0.05) continue;
      // de vier hoeken: voor (op de rooilijn) en achter (bij de pui)
      const av = [a[0], 0, a[1]], bv = [b[0], 0, b[1]];
      const aa = [a[0] + ix * D, 0, a[1] + iz * D], ba = [b[0] + ix * D, 0, b[1] + iz * D];
      const u0 = langs / 4, u1 = (langs + L) / 4;      // 4 m per herhaling
      langs += L;

      // de pui: van de vloer tot het plafond, kijkend naar buiten
      quad(puiBak,
        [aa[0], 0, aa[2]], [ba[0], 0, ba[2]], [ba[0], H, ba[2]], [aa[0], H, aa[2]],
        [[u0, 0], [u1, 0], [u1, 1], [u0, 1]], [-ix, 0, -iz]);
      // het plafond van de gang, kijkend naar beneden
      quad(plafondBak,
        [av[0], H, av[2]], [bv[0], H, bv[2]], [ba[0], H, ba[2]], [aa[0], H, aa[2]],
        [[u0, 0], [u1, 0], [u1, 1], [u0, 1]], [0, -1, 0]);
      // de vloer, kijkend naar boven; een centimeter boven de stoep
      quad(vloerBak,
        [av[0], 0.01, av[2]], [bv[0], 0.01, bv[2]], [ba[0], 0.01, ba[2]], [aa[0], 0.01, aa[2]],
        [[u0, 0], [u1, 0], [u1, 1], [u0, 1]], [0, 1, 0]);
      // de lichte band langs de voorkant van het plafond, 24 cm hoog
      quad(bandBak,
        [av[0], H - 0.24, av[2]], [bv[0], H - 0.24, bv[2]], [bv[0], H, bv[2]], [av[0], H, av[2]],
        [[u0, 0], [u1, 0], [u1, 1], [u0, 1]], [-ix, 0, -iz]);
    }

    for (const [bak, mat, klasse, schaduw] of [
      [puiBak, MAT.pui, 'winkelpui', false],
      [plafondBak, MAT.plafond, 'gangplafond', false],
      [vloerBak, MAT.vloer, 'gangvloer', false],
      [bandBak, MAT.band, 'gangband', true],
    ]) {
      const m = mesh(bak, mat, klasse, schaduw);
      if (m) scene.add(m);
    }

    /*
     De zuilen. Eén instanced mesh per gang: een twaalfhoekige cilinder is
     tweeënzeventig driehoeken, en met een stuk of tien zuilen per blok is dat
     één draw call in plaats van tien.
     */
    const geo = new THREE.CylinderGeometry(R, R, H, HOEKEN, 1, false);
    geo.translate(0, H / 2, 0);
    const im = new THREE.InstancedMesh(geo, MAT.zuil, gang.zuilen.length);
    const m4 = new THREE.Matrix4();
    gang.zuilen.forEach((z, i) => {
      m4.makeTranslation(z[0], 0, z[1]);
      im.setMatrixAt(i, m4);
      // je loopt niet door een zuil heen
      W.addCollider(z[0], z[1], R * 1.1, R * 1.1, 0, H);
    });
    im.castShadow = true;
    im.computeBoundingSphere();
    im.userData.klasse = 'zuil';
    scene.add(im);

    /*
     Het woordmerk boven de ingang, alleen bij een pand dat een winkel is. Het
     hangt tegen de pui in het midden van de boog, want daar zit op de foto de
     ingang: 2,4 m breed en 60 cm hoog, met de onderkant op 2,6 m.
     */
    if (gang.merk) {
      const mid = Math.floor((boog.length - 1) / 2);
      const a = boog[mid], b = boog[mid + 1] || boog[mid];
      const mx = (a[0] + b[0]) / 2 + ix * (D - 0.06);
      const mz = (a[1] + b[1]) / 2 + iz * (D - 0.06);
      const bord = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), MAT.merk);
      bord.position.set(mx, 2.9, mz);
      // het bord kijkt naar buiten, dus tegen de looprichting van de gang in
      bord.rotation.y = Math.atan2(-ix, -iz);
      bord.userData.klasse = 'winkelmerk';
      scene.add(bord);
    }

    /*
     Botsingsdozen voor de pui, zodat je niet de winkel in loopt waar geen deur
     is. Per stuk boog één doos van de pui-dikte; de gang zelf blijft vrij, want
     daar hoor je onder te kunnen lopen.
     */
    for (let i = 0; i < boog.length - 1; i++) {
      const a = boog[i], b = boog[i + 1];
      const ax = a[0] + ix * D, az = a[1] + iz * D;
      const bx2 = b[0] + ix * D, bz2 = b[1] + iz * D;
      const dx = bx2 - ax, dz = bz2 - az, L = Math.hypot(dx, dz);
      if (L < 0.3) continue;
      W.addCollider((ax + bx2) / 2, (az + bz2) / 2, L / 2, 0.12, -Math.atan2(dz, dx), H);
    }

    gebouwd++;
  }
  return gebouwd;
}
