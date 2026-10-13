/*
 Het kantoor aan het water naast de loods van Bouwman (stap 159, Stadsrondweg-Zuid 121–121A, BAG 1900100010087325).
 Gevraagd met vier foto's: "waar ik nu naar kijk: 1541.9, -136.4 is het pand vlak naast de loods van bouwman. Ziet in het
 echt zo uit. Maak het logo Excellente en aaff in de nacht lichtgevend."

 Wat er op de foto's staat, en hoe het hier gebouwd is (de maten uit de BAG-voetafdruk, de indeling uit de foto's):

   de kubus     het voorste deel van de voetafdruk, aan het water (de noordkant): een begane grond van glas onder een
                overstek, met dunne donkere staanders, en daarboven twee lagen in koperkleurige verticale lamellen
                (`koperDoek`). Aan de waterkant een groot donker raam over twee lagen en twee groepjes van drie smalle
                ramen per laag; op de zijgevels groepjes van drie.
   de hal       het achterste deel: een donkere, vlakke doos van acht meter (`halDoek`, verticale naden), met een paar
                hoge smalle ramen.
   de kade      een betonnen plaat langs de waterkant met twee treden naar het water.
   de logo's    "aaff." in paars met een groene punt op de waterkant boven het grote raam, "Excellente" in rood
                schrijfschrift bovenaan de oostgevel. Allebei op canvas getekend (geen afbeeldingsbestanden) en 's nachts
                lichtgevend: hetzelfde doek als `emissiveMap`, alleen de sterkte gaat (`update`), dus geen lamp erbij en
                geen nieuw programma (zie de valkuil van stap 83 in CLAUDE.md).

 js/kaartwereld.js slaat de geometrie van dit pand over (`EIGEN_PANDEN`, net als de molens) maar houdt zijn botsdozen.
 Het assenstelsel: `u` langs de waterkant (naar het oosten), `w` de diepte het pand in (0 aan het water), `y` omhoog.
*/
import * as THREE from 'three';

export const AAFF = {
  pand: '1900100010087325',
  pui: 3.3,            // de begane grond van glas
  top: 10.6,           // bovenkant van de kubus (de goot in de BAG is 5,8: geschat; de foto's tonen drie hoge lagen)
  kubus: 12.5,         // de breedte van de koperen kubus; de glazen begane grond loopt links verder door (de foto's)
  inspring: 0.8,       // zo ver ligt het glas terug onder de overstek
  hal: 8.8,            // de hoogte van de hal (op de foto's iets lager dan de kubus)
  gloedNacht: 2.6,     // de sterkte van de logo's 's nachts (het doek is donkerpaars en rood: dat moet ver omhoog)
  gloedDag: 0.0,
};
export const EIGEN_PANDEN = new Set([AAFF.pand]);

// ------------------------------------------------------------------ doeken
const doek = (b, h, teken) => {
  const c = document.createElement('canvas'); c.width = b; c.height = h;
  teken(c.getContext('2d'), b, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};
let zaad = 11;
const ruis = () => { zaad = (zaad * 16807) % 2147483647; return zaad / 2147483647; };
// koperkleurige lamellen: één meter breed, rib om de 12,5 cm (een tegel van 1 × 1 m)
function koperDoek() {
  return doek(256, 256, (g, b, h) => {
    g.fillStyle = '#b06a42'; g.fillRect(0, 0, b, h);
    const n = 8, w = b / n;
    for (let i = 0; i < n; i++) {
      const gr = g.createLinearGradient(i * w, 0, (i + 1) * w, 0);
      gr.addColorStop(0, '#8e4f2f'); gr.addColorStop(0.18, '#c27b51'); gr.addColorStop(0.5, '#b56f46');
      gr.addColorStop(0.82, '#a35f3a'); gr.addColorStop(1, '#7d4428');
      g.fillStyle = gr; g.fillRect(i * w, 0, w, h);
    }
    for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(${ruis() < 0.5 ? '60,30,15' : '230,170,120'},${0.05 * ruis()})`; g.fillRect(ruis() * b, ruis() * h, 1 + ruis() * 2, 3 + ruis() * 10); }
  });
}
// de hal: antraciet met een verticale naad om de meter
function halDoek() {
  return doek(256, 256, (g, b, h) => {
    g.fillStyle = '#34383d'; g.fillRect(0, 0, b, h);
    for (let i = 0; i < 1200; i++) { g.fillStyle = `rgba(255,255,255,${0.025 * ruis()})`; g.fillRect(ruis() * b, ruis() * h, 2, 2); }
    g.fillStyle = '#1f2226'; g.fillRect(0, 0, 4, h);
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(4, 0, 2, h);
  });
}
// de glazen pui: een vak van 1,2 m breed en 3,3 m hoog, met een stijl, een dorpel en een spiegeling
function puiDoek() {
  return doek(128, 352, (g, b, h) => {
    const gr = g.createLinearGradient(0, 0, b, h);
    gr.addColorStop(0, '#5d6f76'); gr.addColorStop(0.45, '#2f3d43'); gr.addColorStop(1, '#46565c');
    g.fillStyle = gr; g.fillRect(0, 0, b, h);
    g.fillStyle = 'rgba(220,235,240,0.18)'; g.beginPath(); g.moveTo(b * 0.2, 0); g.lineTo(b * 0.55, 0); g.lineTo(b * 0.15, h * 0.6); g.lineTo(0, h * 0.6); g.fill();
    g.fillStyle = '#1e2124'; g.fillRect(0, 0, 6, h); g.fillRect(0, 0, b, 6); g.fillRect(0, h - 10, b, 10); g.fillRect(0, h * 0.72, b, 4);
  });
}
// beton van de kade: grijs met voegen om de 1,5 m
function kadeDoek() {
  return doek(256, 256, (g, b, h) => {
    g.fillStyle = '#8f908c'; g.fillRect(0, 0, b, h);
    for (let i = 0; i < 2500; i++) { const c = 110 + ruis() * 60; g.fillStyle = `rgba(${c},${c},${c - 4},0.25)`; g.fillRect(ruis() * b, ruis() * h, 2, 2); }
    g.fillStyle = 'rgba(40,40,40,0.5)'; g.fillRect(0, 0, b, 3); g.fillRect(0, 0, 3, h);
  });
}
/*
 De logo's. "aaff." in een vette, ronde letter, paars, met een groene punt; "Excellente" in rood schrijfschrift. Een
 doorzichtige achtergrond (alphaTest), en het doek is ook de `emissiveMap`: 's nachts geven alleen de letters licht.
*/
export function tekenAaff(g, b, h) {
  g.clearRect(0, 0, b, h);
  g.font = `900 ${Math.round(h * 0.86)}px "Arial Rounded MT Bold", "Nunito", "Varela Round", "Trebuchet MS", "Verdana", sans-serif`;
  g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  const tekst = 'aaff', w = g.measureText(tekst).width, x = (b - w - h * 0.28) / 2, y = h * 0.8;
  g.fillStyle = '#3d2d7c'; g.fillText(tekst, x, y);
  g.fillStyle = '#20b48f'; g.beginPath(); g.arc(x + w + h * 0.14, y - h * 0.06, h * 0.085, 0, Math.PI * 2); g.fill();
}
export function tekenExcellente(g, b, h) {
  g.clearRect(0, 0, b, h);
  g.font = `italic 700 ${Math.round(h * 0.78)}px "Brush Script MT", "Segoe Script", "Lucida Handwriting", "URW Chancery L", cursive`;
  g.textBaseline = 'alphabetic'; g.textAlign = 'center';
  g.fillStyle = '#c43a2c'; g.fillText('Excellente', b / 2, h * 0.76);
}
function logoMat(teken) {
  const t = doek(1024, 256, teken);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return new THREE.MeshStandardMaterial({
    map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: AAFF.gloedDag,     // 's nachts gloeien de letters in hun eigen kleur
    alphaTest: 0.4, roughness: 0.45, metalness: 0.1,
  });
}

// ------------------------------------------------------------------ bouwen
/**
 * Bouwt het pand op zijn voetafdruk. Geeft `{ groep, logos, update(dt, nacht), maten }` terug, of null als het pand
 * niet in de kaart staat.
 */
export function bouwAaff(scene, K) {
  const p = (K.panden || []).find(q => q.id === AAFF.pand);
  if (!p) return null;
  // de kubus: de punten van de voetafdruk aan het water; de hal: de rest (de knik ligt rond z = −170,5)
  const knikZ = -170.5;
  const kubusPt = p.voet.filter(q => q[1] > knikZ - 0.7), halPt = p.voet.filter(q => q[1] < knikZ + 0.7);
  // de richting van de waterkant: de langste rand van de kubus aan de noordkant
  let e = [1, 0], best = 0;
  for (let i = 0; i < p.voet.length; i++) {
    const a = p.voet[i], b = p.voet[(i + 1) % p.voet.length];
    if (a[1] < knikZ || b[1] < knikZ) continue;
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
    if (l > best && Math.abs(dz) < l * 0.3) { best = l; e = [dx / l, dz / l]; }
  }
  if (e[0] < 0) e = [-e[0], -e[1]];
  const n = [-e[1], e[0]];                                  // loodrecht erop, naar het water (+z)
  if (n[1] < 0) { n[0] = -n[0]; n[1] = -n[1]; }
  const proj = (pts) => {
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const q of pts) { const u = q[0] * e[0] + q[1] * e[1], v = q[0] * n[0] + q[1] * n[1]; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    return { u0, u1, v0, v1 };
  };
  const pk = proj(kubusPt), ph = proj(halPt);
  // oorsprong: de noordwesthoek van de kubus; w loopt het pand in (tegen n in)
  const O = { u: pk.u0, v: pk.v1 };
  const B = pk.u1 - pk.u0, D = pk.v1 - pk.v0;             // breedte en diepte van de kubus
  const hal = { u0: ph.u0 - O.u, u1: ph.u1 - O.u, w0: O.v - ph.v1, w1: O.v - ph.v0 };
  const wereld = (u, y, w) => new THREE.Vector3((O.u + u) * e[0] + (O.v - w) * n[0], y, (O.u + u) * e[1] + (O.v - w) * n[1]);

  const MAT = {
    koper: new THREE.MeshStandardMaterial({ map: koperDoek(), roughness: 0.55, metalness: 0.25 }),
    hal: new THREE.MeshStandardMaterial({ map: halDoek(), roughness: 0.7, metalness: 0.15 }),
    pui: new THREE.MeshStandardMaterial({ map: puiDoek(), roughness: 0.12, metalness: 0.35 }),
    raam: new THREE.MeshStandardMaterial({ color: 0x1d2327, roughness: 0.1, metalness: 0.45 }),
    donker: new THREE.MeshStandardMaterial({ color: 0x23262a, roughness: 0.6, metalness: 0.3 }),
    kade: new THREE.MeshStandardMaterial({ map: kadeDoek(), roughness: 0.92 }),
    plafond: new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 0.8 }),
  };
  // de lamellen en de naden in meters: een tegel per meter (de pui: per vak van 1,2 × 3,3 m)
  MAT.pui.map.repeat.set(1 / 1.2, 1 / AAFF.pui);
  MAT.kade.map.repeat.set(1 / 1.5, 1 / 1.5);

  // per materiaal één geometrie; een vlak is vier hoeken (u, y, w) met uv in meters langs het vlak
  const bak = new Map();
  const vlak = (mat, a, b, c, d) => {
    if (!bak.has(mat)) bak.set(mat, { pos: [], uv: [] });
    const g = bak.get(mat);
    const P = [a, b, c, d].map(q => wereld(q[0], q[1], q[2]));
    const breed = P[0].distanceTo(P[1]), hoog = P[1].distanceTo(P[2]);
    const uv = [[0, 0], [breed, 0], [breed, hoog], [0, hoog]];
    for (const i of [0, 1, 2, 0, 2, 3]) { g.pos.push(P[i].x, P[i].y, P[i].z); g.uv.push(uv[i][0], uv[i][1]); }
  };
  // een doos van u0..u1, y0..y1, w0..w1 (alle zes kanten naar buiten, of `kanten` een deel ervan)
  const doos = (mat, u0, u1, y0, y1, w0, w1, kanten = 'nzowob') => {
    if (kanten.includes('n')) vlak(mat, [u0, y0, w0], [u1, y0, w0], [u1, y1, w0], [u0, y1, w0]);   // waterkant
    if (kanten.includes('z')) vlak(mat, [u1, y0, w1], [u0, y0, w1], [u0, y1, w1], [u1, y1, w1]);
    if (kanten.includes('o')) vlak(mat, [u1, y0, w0], [u1, y0, w1], [u1, y1, w1], [u1, y1, w0]);
    if (kanten.includes('w')) vlak(mat, [u0, y0, w1], [u0, y0, w0], [u0, y1, w0], [u0, y1, w1]);
    if (kanten.includes('b')) vlak(mat, [u0, y1, w0], [u1, y1, w0], [u1, y1, w1], [u0, y1, w1]);
    if (kanten.includes('d')) vlak(mat, [u0, y0, w1], [u1, y0, w1], [u1, y0, w0], [u0, y0, w0]);  // onderkant
  };
  const I = AAFF.inspring, PUI = AAFF.pui, TOP = AAFF.top;
  // de kubus: rechts op de voetafdruk, de bovenste twee lagen, met de onderkant (het plafond van de overstek)
  const K0 = Math.max(0, B - AAFF.kubus);
  doos(MAT.koper, K0, B, PUI, TOP, 0, D, 'nzowb');
  doos(MAT.plafond, 0, B, PUI, PUI, 0, D, 'd');
  // de dakrand: een smalle donkere lijst; links van de kubus een plat dakje over de glazen uitbouw
  doos(MAT.donker, K0 - 0.03, B + 0.03, TOP, TOP + 0.12, -0.03, D + 0.03, 'nzowb');
  if (K0 > 0.5) doos(MAT.donker, 0, K0, PUI, PUI + 0.35, 0, D, 'nwb');
  // de begane grond van glas, ingesprongen, en de staanders op de hoeken van de overstek
  doos(MAT.pui, I, B - I, 0, PUI, I, D, 'now');
  for (const u of [0.25, K0, (K0 + B) / 2, B - 0.25]) doos(MAT.donker, u - 0.09, u + 0.09, 0, PUI, 0.16, 0.34);
  doos(MAT.donker, B - 0.34, B - 0.16, 0, PUI, D / 2 - 0.09, D / 2 + 0.09);
  // de ramen: donker glas, een paar centimeter voor de gevel
  const vr = 0.03, ramen = [];
  const raamN = (u0, u1, y0, y1) => { doos(MAT.raam, u0, u1, y0, y1, -vr, 0, 'n'); ramen.push({ kant: 'n', u0, u1, y0, y1 }); };
  const raamO = (w0, w1, y0, y1) => { doos(MAT.raam, B, B + vr, y0, y1, w0, w1, 'o'); ramen.push({ kant: 'o', w0, w1, y0, y1 }); };
  const raamW = (w0, w1, y0, y1) => { doos(MAT.raam, K0 - vr, K0, y0, y1, w0, w1, 'w'); ramen.push({ kant: 'w', w0, w1, y0, y1 }); };
  // aan de waterkant: links het grote raam over twee lagen, rechts twee groepjes van drie smalle per laag
  const KB = B - K0;
  const groot = { u0: K0 + 0.6, u1: K0 + 0.6 + Math.min(4.2, KB * 0.34) };
  raamN(groot.u0, groot.u1, PUI + 0.7, TOP - 1.25);
  const laag1 = [PUI + 0.9, PUI + 2.9], laag2 = [PUI + 4.05, PUI + 6.05];
  const vrij = KB - (groot.u1 - K0) - 0.6, groepB = 3 * 0.7 + 2 * 0.3, tussen = (vrij - 2 * groepB) / 3;
  const groepN = [groot.u1 + tussen, groot.u1 + 2 * tussen + groepB];
  for (const [y0, y1] of [laag1, laag2]) for (const g0 of groepN) for (let k = 0; k < 3; k++) raamN(g0 + k * 1.0, g0 + k * 1.0 + 0.7, y0, y1);
  // op de zijgevels één groepje van drie, naar de waterkant toe
  for (const [y0, y1] of [laag1, laag2]) for (let k = 0; k < 3; k++) {
    raamO(D * 0.42 + k * 1.0, D * 0.42 + k * 1.0 + 0.7, y0, y1);
    raamW(D * 0.3 + k * 1.0, D * 0.3 + k * 1.0 + 0.7, y0, y1);
  }
  // de hal: een donkere doos achter de kubus, met een paar hoge smalle ramen op de oostkant
  // (ook de noordkant: boven de glazen uitbouw links van de kubus is hij te zien)
  doos(MAT.hal, hal.u0, hal.u1, 0, AAFF.hal, Math.max(D, hal.w0), hal.w1, 'nzowb');
  for (let k = 0; k < 4; k++) {
    const w0 = Math.max(D, hal.w0) + 2 + k * 3.2;
    if (w0 + 0.6 > hal.w1 - 1) break;
    doos(MAT.raam, hal.u1, hal.u1 + vr, 1.2, AAFF.hal - 1.4, w0, w0 + 0.6, 'o');
  }
  // de kade: een plaat langs het water met twee treden
  doos(MAT.kade, -1.0, B + 1.5, 0, 0.38, -3.4, I, 'nowb');
  doos(MAT.kade, -1.0, B + 1.5, 0, 0.24, -3.9, -3.4, 'nowb');
  doos(MAT.kade, -1.0, B + 1.5, -0.3, 0.1, -4.4, -3.9, 'nowb');

  const groep = new THREE.Group();
  groep.name = 'aaff';
  for (const [mat, g] of bak) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true; m.receiveShadow = true;
    m.userData.klasse = 'aaff';
    groep.add(m);
  }
  // de logo's: een vlak een paar centimeter voor de gevel
  const logos = [];
  const logo = (mat, naam, u, w, y, breed, hoog, kant) => {
    const geo = new THREE.PlaneGeometry(breed, hoog);
    const m = new THREE.Mesh(geo, mat);
    const pos = wereld(u, y, w);
    m.position.copy(pos);
    // het vlak kijkt langs zijn +z; de waterkant kijkt naar n, de oostgevel naar e
    const naar = kant === 'n' ? new THREE.Vector3(n[0], 0, n[1]) : new THREE.Vector3(e[0], 0, e[1]);
    m.lookAt(pos.clone().add(naar));
    m.name = naam; m.userData.klasse = 'logo';
    groep.add(m); logos.push(m);
  };
  const matAaff = logoMat(tekenAaff), matExc = logoMat(tekenExcellente);
  logo(matAaff, 'aaff', (groot.u0 + groot.u1) / 2, -0.05, TOP - 0.62, 3.6, 0.9, 'n');
  logo(matExc, 'Excellente', B + 0.05, D * 0.6, TOP - 0.62, 3.6, 0.9, 'o');
  scene.add(groep);

  let gloed = AAFF.gloedDag;
  const api = {
    groep, logos, ramen, materialen: MAT, logoMaterialen: [matAaff, matExc],
    maten: { B, D, top: TOP, pui: PUI, hal, e, n, oorsprong: wereld(0, 0, 0) },
    wereld,
    /** 's nachts gaan de logo's aan: naar de sterkte toe in een paar tellen (alleen `emissiveIntensity`). */
    update(dt, nacht) {
      const doel = nacht ? AAFF.gloedNacht : AAFF.gloedDag;
      gloed += (doel - gloed) * Math.min(1, dt * 1.5);
      if (Math.abs(gloed - doel) < 0.01) gloed = doel;
      for (const m of api.logoMaterialen) m.emissiveIntensity = gloed;
    },
    get gloed() { return gloed; },
  };
  AAFF_PAND.nu = api;
  return api;
}
// het gebouwde pand, voor js/main.js en de proeven
export const AAFF_PAND = { nu: null };
