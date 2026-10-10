/*
 Zeilbootjes (stap 131: "Paar zeilbootjes"). Vier kleine zeilboten — valkjes en een schouw, een romp van zes meter met
 een grootzeil en een fok — die overdag rustig over het brede water kruisen.

 Waar: bij het opstarten wordt het water uit de kaart (de BGT-vlakken `water`, met steigers en bruggen eruit) op een
 rooster van `CEL` meter gelegd, en per cel de afstand tot de wal uitgerekend (in cellen, breedte eerst). Open water is
 waar die afstand minstens `ZEILEN.open` cellen is (een meter of twintig tot dertig van de kant); de grootste twee
 stukken krijgen elk twee boten. Dat zijn in deze kaart de plas ten westen van Tinga en het water in de zuidoosthoek;
 de smalle vaarten (de Geeuw, de Zwette) zijn voor de plezierboot van js/leven.js.

 Hoe: geen vaste route maar zeilen. Een boot houdt een koers tot er minder dan `ZEILEN.vrij` meter open water voor hem
 ligt, of tot hij er na een minuut of anderhalf zin in heeft, en kiest dan een nieuwe uit zestien richtingen: nooit
 recht tegen de wind in (binnen `ZEILEN.inDeWind` graden is het de dode hoek), liefst veel water voor de boeg en niet
 te ver van de oude koers. Zo kruisen ze heen en weer, overstag of gijpend, en zwaait de giek over als de wind van
 kant wisselt. De snelheid komt uit een eenvoudige polaire kromme (aan de wind langzamer, halve wind het snelst) en
 uit de kracht van de wind in js/sfeer.js (`sfeer.wind`).

 Het zeil is één keer gebold getekend; met de schaal opzij gaat het naar lij en bolt het meer of minder met de wind
 (geen hoekpunten per beeld). De boot helt naar lij, meer bij halve wind en harde wind, en deint op het water.

 's Nachts en bij onweer gaan ze niet het water op: wie al vaart dobbert uit, en verdwijnt zodra hij verder dan
 `ZEILEN.uitZicht` meter van de camera ligt (dan zie je het niet). Overdag komt hij pas terug als hij ook zo ver
 weg ligt. Alles wordt bij het opstarten gemaakt (de materialen zijn gewone MeshStandardMaterials, zoals die van de
 sloepen), en per beeld is het een handvol optellingen per boot.
*/
import * as THREE from 'three';

export const ZEILEN = {
  aantal: 4,
  van: 9, tot: 20.5,     // uren dat er gevaren wordt
  snel: 2.4,             // m/s bij halve wind en een gewone wind
  draai: 0.3,            // rad/s
  open: 3,               // cellen van de wal om te mogen varen
  vrij: 35,              // zoveel meter water voor de boeg, anders een nieuwe koers
  inDeWind: 45,          // graden: de dode hoek
  uitZicht: 260,         // zo ver van de camera mag een boot verdwijnen of terugkomen
  ver: 950,              // verder dan dit wordt er niets getekend (de mist is daar al dicht)
};
const CEL = 10;

// de boten: rompkleur, zeil, fokkleur
const SOORTEN = [
  { romp: 0xf2f0ea, zeil: 0xf4f2ec, fok: 0xf4f2ec, dek: 0xb08a5a },   // een wit valkje
  { romp: 0x1f3550, zeil: 0xf1eee4, fok: 0xd9473a, dek: 0xa88252 },   // donkerblauw, rode fok
  { romp: 0x2f4a36, zeil: 0x8c4428, fok: 0x8c4428, dek: 0x9a7448 },   // een schouw met taanrode zeilen
  { romp: 0xa8312a, zeil: 0xefeadc, fok: 0xefeadc, dek: 0xb08a5a },   // rood
];
const SHIRTS = [0xe2c13a, 0x2b5d9c, 0xd0d4d8, 0xc4502e];
const HUID = [0xe0b394, 0xc89272, 0xeac3a6, 0x9a6a4c];

/*
 De romp: spanten van de boeg naar de spiegel, elk spant vijf punten (boord, kim, kiel, kim, boord), en daartussen
 vlakken. Lengte 6,2 m, breedte 2 m, 45 cm boven het water en 25 cm eronder; de boeg loopt spits toe en steekt iets
 omhoog (zeeg). De boeg wijst naar −z, zoals bij alles wat in dit spel vaart.
*/
const L = 6.2, B = 2.0;
function rompGeo() {
  const N = 12, pos = [], idx = [];
  const spant = [];
  for (let i = 0; i <= N; i++) {
    const f = i / N;                                   // 0 boeg, 1 spiegel
    const z = -L / 2 + f * L;
    const b = (B / 2) * Math.min(1, Math.sin(Math.PI / 2 * Math.min(1, f / 0.55))) * (1 - 0.12 * Math.max(0, f - 0.8) / 0.2);
    const boord = 0.42 + 0.14 * (1 - f) ** 2;          // zeeg: de boeg iets hoger
    const kiel = -0.25 * Math.min(1, f / 0.25 + 0.15);
    const pts = [[-b, boord], [-b * 0.8, kiel * 0.3], [0, kiel], [b * 0.8, kiel * 0.3], [b, boord]];
    spant.push(pos.length / 3);
    for (const [x, y] of pts) pos.push(x, y, z);
  }
  for (let i = 0; i < N; i++) for (let k = 0; k < 4; k++) {
    const a = spant[i] + k, b = spant[i] + k + 1, c = spant[i + 1] + k, d = spant[i + 1] + k + 1;
    idx.push(a, c, b, b, c, d);
  }
  // de spiegel
  const s = spant[N];
  idx.push(s, s + 1, s + 2, s, s + 2, s + 4, s + 2, s + 3, s + 4);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return { g, spanten: pos };
}
// het dek: het vlak tussen de boorden, net onder de rand, met een open kuip achterin (die is donkerder: een tweede vlak lager)
function dekGeo(N = 12) {
  const pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const f = i / N, z = -L / 2 + f * L;
    const b = (B / 2) * Math.min(1, Math.sin(Math.PI / 2 * Math.min(1, f / 0.55))) * (1 - 0.12 * Math.max(0, f - 0.8) / 0.2) - 0.04;
    const y = 0.40 + 0.14 * (1 - f) ** 2 - (f > 0.5 ? 0.18 : 0);
    pos.push(-Math.max(0, b), y, z, Math.max(0, b), y, z);
  }
  for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/*
 Een zeil tussen drie hoeken: A onderaan het voorlijk (bij de mast of de boeg), H de top, C de schoothoek. Een rooster
 van punten, met een bolling opzij (+x) die in het midden van het koord het diepst is en naar boven toe vlakker wordt.
*/
function zeilGeo(A, H, C, diepte, nu = 6, nv = 8) {
  const pos = [], idx = [];
  for (let j = 0; j <= nv; j++) {
    const v = j / nv;
    const lx = A[0] + (H[0] - A[0]) * v, ly = A[1] + (H[1] - A[1]) * v, lz = A[2] + (H[2] - A[2]) * v;
    const rx = C[0] + (H[0] - C[0]) * v, ry = C[1] + (H[1] - C[1]) * v, rz = C[2] + (H[2] - C[2]) * v;
    const koord = Math.hypot(rx - lx, ry - ly, rz - lz);
    for (let i = 0; i <= nu; i++) {
      const u = i / nu;
      const bol = diepte * koord * Math.sin(Math.PI * u) * (1 - 0.35 * v) * (0.8 + 0.2 * (1 - u));
      pos.push(lx + (rx - lx) * u + bol, ly + (ry - ly) * u, lz + (rz - lz) * u);
    }
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- het water als rooster
function waterRooster(KAART) {
  const G = KAART.gebied;
  const W = Math.ceil((G.x1 - G.x0) / CEL), H = Math.ceil((G.z1 - G.z0) / CEL);
  const nat = new Uint8Array(W * H);
  // scanlijnen door elk vlak, alleen de rijen binnen zijn omtrek; daarna steigers en bruggen weer droog
  function vul(v, waarde) {
    let z0 = Infinity, z1 = -Infinity;
    for (const p of v.r[0]) { if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1]; }
    const j0 = Math.max(0, Math.floor((z0 - G.z0) / CEL)), j1 = Math.min(H - 1, Math.ceil((z1 - G.z0) / CEL));
    const xs = [];
    for (let j = j0; j <= j1; j++) {
      const z = G.z0 + (j + 0.5) * CEL;
      xs.length = 0;
      for (const ring of v.r) for (let i = 0, n = ring.length; i < n; i++) {
        const p = ring[i], q = ring[(i + 1) % n];
        if ((p[1] > z) !== (q[1] > z)) xs.push(p[0] + (z - p[1]) / (q[1] - p[1]) * (q[0] - p[0]));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        // droog maken mag ruim (een cel die het vlak raakt), nat maken alleen als het midden erin ligt
        const i0 = waarde ? Math.ceil((xs[k] - G.x0) / CEL - 0.5) : Math.floor((xs[k] - G.x0) / CEL);
        const i1 = waarde ? Math.floor((xs[k + 1] - G.x0) / CEL - 0.5) : Math.floor((xs[k + 1] - G.x0) / CEL);
        for (let i = Math.max(0, i0), e = Math.min(W - 1, i1); i <= e; i++) nat[j * W + i] = waarde;
      }
    }
  }
  for (const v of KAART.vlakken || []) if (v.k === 'water' && v.r && v.r[0]) vul(v, 1);
  for (const v of KAART.vlakken || []) if ((v.k === 'steiger' || v.k === 'brug') && v.r && v.r[0]) vul(v, 0);
  // afstand tot de wal, in cellen (breedte eerst vanaf alle droge cellen)
  const d = new Int16Array(W * H).fill(-1), rij = new Int32Array(W * H);
  let a = 0, b = 0;
  for (let k = 0; k < W * H; k++) if (!nat[k]) { d[k] = 0; rij[b++] = k; }
  while (a < b) {
    const k = rij[a++], i = k % W, j = (k - i) / W;
    if (i > 0 && d[k - 1] < 0) { d[k - 1] = d[k] + 1; rij[b++] = k - 1; }
    if (i < W - 1 && d[k + 1] < 0) { d[k + 1] = d[k] + 1; rij[b++] = k + 1; }
    if (j > 0 && d[k - W] < 0) { d[k - W] = d[k] + 1; rij[b++] = k - W; }
    if (j < H - 1 && d[k + W] < 0) { d[k + W] = d[k] + 1; rij[b++] = k + W; }
  }
  // de stukken open water, groot naar klein
  const stuk = new Int32Array(W * H).fill(-1), stukken = [];
  for (let k = 0; k < W * H; k++) {
    if (d[k] < ZEILEN.open || stuk[k] >= 0) continue;
    const cellen = [];
    a = 0; b = 0; rij[b++] = k; stuk[k] = stukken.length;
    while (a < b) {
      const c = rij[a++], i = c % W, j = (c - i) / W;
      cellen.push(c);
      for (const n of [i > 0 ? c - 1 : -1, i < W - 1 ? c + 1 : -1, j > 0 ? c - W : -1, j < H - 1 ? c + W : -1]) {
        if (n >= 0 && stuk[n] < 0 && d[n] >= ZEILEN.open) { stuk[n] = stukken.length; rij[b++] = n; }
      }
    }
    stukken.push(cellen);
  }
  stukken.sort((p, q) => q.length - p.length);
  const afstand = (x, z) => {
    const i = Math.floor((x - G.x0) / CEL), j = Math.floor((z - G.z0) / CEL);
    return i < 0 || j < 0 || i >= W || j >= H ? 0 : d[j * W + i];
  };
  const midden = c => { const i = c % W, j = (c - i) / W; return { x: G.x0 + (i + 0.5) * CEL, z: G.z0 + (j + 0.5) * CEL }; };
  return { afstand, stukken, midden, d };
}

// ---------------------------------------------------------------- de boten
export function initZeilen({ scene, KAART, sfeer }) {
  const boten = [];
  if (!KAART || !KAART.gebied || !KAART.vlakken) return { update() {}, boten };
  const water = waterRooster(KAART);
  const stukken = water.stukken.filter(s => s.length >= 50).slice(0, 2);
  if (!stukken.length) return { update() {}, boten };
  const waterY = ((KAART.vlakken.find(v => v.k === 'water') || {}).y) ?? -0.35;

  let zaad = 40517;
  const rnd = () => { zaad = (zaad * 1664525 + 1013904223) >>> 0; return zaad / 4294967296; };

  // gedeeld
  const romp = rompGeo().g, dek = dekGeo();
  const MAST_Z = -0.9, GIEK_Y = 1.15, MAST_H = 7.2, GIEK_L = 3.3;
  const grootGeo = zeilGeo([0, GIEK_Y + 0.05, 0.05], [0, MAST_H - 0.1, 0.05], [0, GIEK_Y + 0.05, GIEK_L - 0.1], 0.11);
  // de fok: van de boeg (het draaipunt) naar een punt op de mast, schoothoek achter de mast langs
  const FOK_Z = -L / 2 + 0.35;
  const fokTop = [0, MAST_H * 0.78 - 0.5, MAST_Z - FOK_Z];
  const fokGeo = zeilGeo([0, 0.05, 0], fokTop, [0, 0.35, (MAST_Z - FOK_Z) + 0.9], 0.13, 5, 7);
  const mastGeo = new THREE.CylinderGeometry(0.045, 0.06, MAST_H, 6); mastGeo.translate(0, MAST_H / 2, 0);
  const giekGeo = new THREE.CylinderGeometry(0.04, 0.04, GIEK_L, 6); giekGeo.rotateX(Math.PI / 2); giekGeo.translate(0, GIEK_Y, GIEK_L / 2);
  const lijfGeo = new THREE.CylinderGeometry(0.17, 0.2, 0.62, 7); lijfGeo.translate(0, 0.31, 0);
  const kopGeo = new THREE.SphereGeometry(0.12, 8, 6); kopGeo.translate(0, 0.76, 0);
  const std = (kleur, ruw = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color: kleur, roughness: ruw, metalness: 0, ...extra });
  const mastMat = std(0xc9cdd2, 0.35, { metalness: 0.4 });

  for (let n = 0; n < ZEILEN.aantal; n++) {
    const S = SOORTEN[n % SOORTEN.length];
    const cellen = stukken[n % stukken.length];
    // een begincel zo ver mogelijk van de kant: een paar keer loten, de ruimste nemen
    let beste = cellen[0], bd = -1;
    for (let k = 0; k < 12; k++) {
      const c = cellen[Math.floor(rnd() * cellen.length)];
      const p = water.midden(c), a = water.afstand(p.x, p.z);
      if (a > bd) { bd = a; beste = c; }
    }
    const p0 = water.midden(beste);

    const groep = new THREE.Group(); groep.name = 'zeilboot';
    const helling = new THREE.Group(); groep.add(helling);
    const r = new THREE.Mesh(romp, std(S.romp, 0.38, { side: THREE.DoubleSide }));
    const dk = new THREE.Mesh(dek, std(S.dek, 0.7, { side: THREE.DoubleSide }));
    const mast = new THREE.Mesh(mastGeo, mastMat); mast.position.set(0, 0.35, MAST_Z);
    const giekGroep = new THREE.Group(); giekGroep.position.set(0, 0.35, MAST_Z);
    const giek = new THREE.Mesh(giekGeo, mastMat);
    const groot = new THREE.Mesh(grootGeo, std(S.zeil, 0.85, { side: THREE.DoubleSide }));
    giekGroep.add(giek, groot);
    const fokGroep = new THREE.Group(); fokGroep.position.set(0, 0.5, FOK_Z);
    // het voorlijk van de fok staat scheef (van de boeg omhoog naar de mast): draaien om die lijn, niet om de y-as
    fokGroep.userData.as = new THREE.Vector3(...fokTop).normalize();
    const fok = new THREE.Mesh(fokGeo, std(S.fok, 0.85, { side: THREE.DoubleSide }));
    fokGroep.add(fok);
    // de schipper in de kuip, bij het roer
    const lijf = new THREE.Mesh(lijfGeo, std(SHIRTS[n % SHIRTS.length], 0.8));
    const kop = new THREE.Mesh(kopGeo, std(HUID[n % HUID.length], 0.7));
    const mens = new THREE.Group(); mens.add(lijf, kop); mens.position.set(0.45, 0.22, 2.1);
    helling.add(r, dk, mast, giekGroep, fokGroep, mens);
    for (const m of [r, groot, fok, mast]) m.castShadow = true;
    r.receiveShadow = true; dk.receiveShadow = true;
    scene.add(groep);

    boten.push({
      x: p0.x, z: p0.z, yaw: rnd() * Math.PI * 2, doelYaw: 0, v: 0, zij: 1, zijGlad: 1, hel: 0, fase: rnd() * 6.28,
      kiesKlok: rnd() * 0.5, wisselKlok: 30 + rnd() * 60, varen: true, zichtbaar: true, gekozen: 0,
      groep, helling, giekGroep, fokGroep, groot, fok, mens, stuk: n % stukken.length,
    });
  }
  for (const b of boten) b.doelYaw = b.yaw;

  // ---------- zeilen ----------
  const DODE = ZEILEN.inDeWind * Math.PI / 180;
  const vast = { x: Math.cos(-Math.PI / 4), z: Math.sin(-Math.PI / 4), kracht: 0.45 };
  const windNu = () => (sfeer && sfeer.wind) || vast;
  // de hoek tussen de koers en waar de wind vandaan komt (0 = recht ertegenin)
  const windHoek = (yaw, w) => Math.acos(Math.max(-1, Math.min(1, Math.sin(yaw) * w.x + Math.cos(yaw) * w.z)));
  function polair(theta) {
    if (theta < DODE - 0.09) return 0.12;              // in de wind: het zeil klappert, hij drijft nog wat door
    const g = theta * 180 / Math.PI;
    return g <= 100 ? 0.72 + 0.28 * Math.min(1, (g - 40) / 60) : 1 - 0.22 * (g - 100) / 80;
  }
  // hoeveel meter open water er in een richting ligt
  function vrijVoor(x, z, yaw, tot = 200) {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    let s = 0;
    while (s < tot && water.afstand(x + fx * (s + 8), z + fz * (s + 8)) >= ZEILEN.open - 1) s += 8;
    return s;
  }
  const wrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  function kiesKoers(b, w) {
    let best = b.yaw, score = -Infinity;
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2 + (rnd() - 0.5) * 0.2;
      const theta = windHoek(a, w);
      const vrij = vrijVoor(b.x, b.z, a);
      let s = Math.min(vrij, 160) + rnd() * 50 - Math.abs(wrap(a - b.yaw)) * 18;
      if (theta < DODE + 0.05) s -= 400;               // niet in de dode hoek
      if (vrij < ZEILEN.vrij) s -= 200;
      if (s > score) { score = s; best = a; }
    }
    b.gekozen++;
    return best;
  }

  let t = 0;
  const as = new THREE.Vector3();
  function update(dt, camX, camZ) {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.25);
    t += dt;
    const uur = sfeer && typeof sfeer.uur === 'number' ? sfeer.uur : 13;
    const nacht = sfeer && typeof sfeer.uur !== 'number' ? !!sfeer.nacht : (uur < ZEILEN.van || uur >= ZEILEN.tot);
    const onweer = !!(sfeer && sfeer.onweer && sfeer.onweer.actief);
    const magVaren = !nacht && !onweer;
    const w = windNu();
    for (const b of boten) {
      const ver = Math.hypot(b.x - camX, b.z - camZ);
      // 's nachts weg zodra je hem niet ziet, overdag pas terug als je hem niet ziet
      if (!magVaren && b.varen && ver > ZEILEN.uitZicht) b.varen = false;
      else if (magVaren && !b.varen && ver > ZEILEN.uitZicht) b.varen = true;
      const theta = windHoek(b.yaw, w);
      // ---- koers en vaart
      let vWil = 0;
      if (b.varen && magVaren) {
        b.kiesKlok -= dt; b.wisselKlok -= dt;
        if (b.kiesKlok <= 0) {
          b.kiesKlok = 0.5;
          if (vrijVoor(b.x, b.z, b.doelYaw, ZEILEN.vrij + 8) < ZEILEN.vrij || b.wisselKlok <= 0 || windHoek(b.doelYaw, w) < DODE) {
            b.doelYaw = kiesKoers(b, w);
            b.wisselKlok = 40 + rnd() * 60;
          }
        }
        const dy = wrap(b.doelYaw - b.yaw);
        b.yaw = wrap(b.yaw + Math.max(-ZEILEN.draai * dt, Math.min(ZEILEN.draai * dt, dy)));
        vWil = ZEILEN.snel * polair(theta) * (0.7 + 0.5 * w.kracht) * (Math.abs(dy) > 0.6 ? 0.75 : 1);
      }
      b.v += (vWil - b.v) * Math.min(1, dt * 0.35);
      const fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw);
      const nx = b.x + fx * b.v * dt, nz = b.z + fz * b.v * dt;
      // nooit de kant op: is het water daar te krap, dan blijft hij liggen en zoekt hij meteen een andere koers
      if (water.afstand(nx, nz) >= ZEILEN.open - 1) { b.x = nx; b.z = nz; }
      else { b.v *= 0.5; b.kiesKlok = 0; b.wisselKlok = 0; }

      b.zichtbaar = b.varen && ver < ZEILEN.ver;
      if (b.groep.visible !== b.zichtbaar) b.groep.visible = b.zichtbaar;
      if (!b.zichtbaar) continue;

      // ---- de wind in de boot: waar is lij (+1 stuurboord, −1 bakboord)
      const lx = w.x * Math.cos(b.yaw) - w.z * Math.sin(b.yaw);
      b.zij = lx >= 0 ? 1 : -1;
      b.zijGlad += (b.zij - b.zijGlad) * Math.min(1, dt * 1.2);      // de giek zwaait over, niet in één beeld
      const inDeWind = theta < DODE - 0.09;
      const vier = Math.max(0.14, Math.min(1.35, (theta - 0.6) * 0.62));   // aan de wind dicht, voor de wind ver uit
      const bol = inDeWind ? 0.18 * Math.sin(t * 11 + b.fase) : (0.35 + 0.75 * w.kracht) * Math.min(1, Math.abs(b.zijGlad) * 1.3);
      b.giekGroep.rotation.y = b.zijGlad * vier;
      b.groot.scale.x = (inDeWind ? 1 : Math.sign(b.zijGlad) || 1) * bol;
      as.copy(b.fokGroep.userData.as);
      b.fokGroep.quaternion.setFromAxisAngle(as, b.zijGlad * vier * 0.55);
      b.fok.scale.x = b.groot.scale.x * 1.1;
      // hellen naar lij: het meest met halve wind en harde wind
      const helWil = inDeWind ? 0 : -b.zij * (0.04 + 0.16 * w.kracht) * Math.sin(Math.min(theta, Math.PI / 2)) * Math.min(1, b.v / ZEILEN.snel + 0.2);
      b.hel += (helWil - b.hel) * Math.min(1, dt * 0.6);
      // ---- op het water
      const deining = Math.sin(t * 1.25 + b.fase) * 0.035;
      b.groep.position.set(b.x, waterY + deining, b.z);
      b.groep.rotation.set(0, b.yaw, 0);
      b.helling.rotation.set(Math.sin(t * 0.9 + b.fase) * 0.018, 0, b.hel + Math.sin(t * 1.1 + b.fase * 2) * 0.012);
      b.mens.position.x = -b.zij * 0.55;              // hij zit hoog, aan de loefkant
    }
  }

  return { update, boten, water };
}
