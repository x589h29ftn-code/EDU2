/*
 No Mercy 4 (stap 140, verzoek 11 okt 2026): de bijmissie na missie 5. Erik Jan filmt in het Tinga-bos
 deel vier van zijn oorlogsfilm, en Erik figureert als Amerikaanse soldaat. Hier staan de bouwstukken;
 het verloop (het speldje EJ, het telefoontje, de set, de golven, de bruikleen) staat in js/verhaal.js.

   - de set rond de plek uit de foto van de gebruiker (−150,8, −180,6), op de open plek die js/bouwvlak.js
     vrijhoudt (`NOMERCY_SET`): een nagebouwde 8,8 cm Flak op zijn kruisvormige onderstel, met de lange loop
     schuin omhoog en het schild, in feldgrau; kisten met granaten, een camouflagenet op palen, een filmlamp
     en de regisseursstoel. Na de knal staat hij scheef, met een hangende loop en verkoold (`knal`);
     `herstel` zet hem weer rechtop voor de volgende poging;
   - Erik Jan (de regisseur, met pet), de cameraman met de camera op zijn schouder, en negen "Duitsers"
     in feldgrau met een stahlhelm en een M1 Garand (de film heeft er geen Mausers voor);
   - Eriks eigen uniform en helm: `zetHelm` voor het poppetje in js/derdepersoon.js;
   - het bos zelf als een kaart van vakjes van vier meter met minstens twee stammen binnen zes meter, vanaf
     de set aaneengesloten (`bosKaart`): daar komt Erik "buiten het Tinga-bos".

 Alles wordt bij het opstarten gemaakt en verborgen (zie `soortenVoorbereid` in js/world.js), zodat er
 tijdens het spelen geen shader bij komt. Geen afbeeldingen: de verf, de kisten, het net en de stoel zijn
 doeken op canvas.
*/
import * as THREE from 'three';
import { Persoon } from './persoon.js';
import { MAAT } from './lichaam.js';
import { NOMERCY_SET, NOMERCY_KAMP } from './bouwvlak.js';

export const NOMERCY = {
  set: NOMERCY_SET,
  kamp: NOMERCY_KAMP,    // de tweede scène, "Het bunkerdorp" (stap 141)
  naam: 'No Mercy 4',
  belNa: 30,             // s na missie 5 belt Erik Jan, als je nog niet bij hem bent geweest
  praat: 6,              // zo dicht bij Erik Jan begint het gesprek (m)
  kogels: 200,           // in bruikleen, met de M1
  beloning: 1000,        // na de tweede scène (stap 141; was € 500 na de eerste)
  golf1: 4, golf2: 5,    // Duitsers
  treffers: [1, 3],      // zoveel treffers heeft een Duitser nodig (per man willekeurig)
  bomBereik: 2.2,        // zo dicht bij de gele ruit plaats je de C4 (m)
  afstand: 15,           // zo ver van het kanon gaat hij af (m)
  bomUiterlijk: 10,      // en anders na zoveel tellen toch
  cameraAfstand: 3.2,    // zo ver loopt de cameraman achter je
  weg: 160,              // verder van de set vóór het einde: van de set gelopen (m); in de tweede scène van het kamp
  // de tweede scène (stap 141)
  wachten: 2,            // schildwachten
  figuranten: 6,         // die na de kaart en het alarm komen
  wachtZicht: 16,        // zo ver zien de schildwachten je zolang er geen alarm is (m)
  radioAfstand: 12,      // zo ver van de radiopost gaat de C4 af (m)
  closeup: 3,            // zo lang stil op de gele ruit (s)
  stil: 0.25,            // en dat is stil: langzamer dan dit (m/s)
  closeupBereik: 1.0,    // zo dicht bij het midden van de ruit (m)
  kaartBereik: 2.0,      // zo dicht bij de ingang van de tent pak je de kaart (m)
  stafKleur: 0x55594a,   // de stafauto in feldgrau
  duits: { shirt: 0x5b614f, broek: 0x4f5345, schoen: 0x1c1a18, helm: 0x535a4a },
  amerikaans: { shirt: 0x6b6a44, broek: 0x6d664a, schoen: 0x5a3e28, helm: 0x5c5b3b },
};

const rand = (a, b) => a + Math.random() * (b - a);

// ---------------------------------------------------------------- doeken
function doek(w, h, teken, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  teken(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
// feldgrau op staal: vlekkerige verf, lasnaden, krassen tot op het metaal en een roestveeg
function verfDoek() {
  return doek(256, 256, (c, w, h) => {
    c.fillStyle = '#7d8270'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const v = Math.random();
      c.fillStyle = v < 0.5 ? `rgba(60,64,52,${rand(0.04, 0.12)})` : `rgba(150,154,138,${rand(0.03, 0.09)})`;
      const r = rand(2, 14);
      c.beginPath(); c.arc(rand(0, w), rand(0, h), r, 0, Math.PI * 2); c.fill();
    }
    c.strokeStyle = 'rgba(40,42,36,0.35)'; c.lineWidth = 1.5;
    for (let y = 48; y < h; y += 64) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y + rand(-2, 2)); c.stroke(); }
    for (let i = 0; i < 40; i++) {
      c.strokeStyle = `rgba(185,182,168,${rand(0.2, 0.5)})`; c.lineWidth = rand(0.6, 1.4);
      const x = rand(0, w), y = rand(0, h);
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + rand(-14, 14), y + rand(-5, 5)); c.stroke();
    }
    for (let i = 0; i < 4; i++) {
      const x = rand(0, w), g = c.createLinearGradient(x, 0, x, h);
      g.addColorStop(0, 'rgba(110,62,30,0.0)'); g.addColorStop(0.5, 'rgba(110,62,30,0.18)'); g.addColorStop(1, 'rgba(110,62,30,0.0)');
      c.fillStyle = g; c.fillRect(x, 0, rand(3, 7), h);
    }
  });
}
// een groene munitiekist met witte opdruk
function kistDoek() {
  return doek(256, 128, (c, w, h) => {
    c.fillStyle = '#4c5a3a'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) { c.fillStyle = 'rgba(20,24,14,0.35)'; c.fillRect(0, y, w, 2); }
    for (let i = 0; i < 300; i++) { c.fillStyle = `rgba(30,36,22,${rand(0.05, 0.15)})`; c.fillRect(rand(0, w), rand(0, h), rand(4, 30), 1); }
    c.fillStyle = 'rgba(232,228,210,0.9)'; c.font = 'bold 30px sans-serif'; c.textAlign = 'center';
    c.fillText('8,8 cm Sprgr.', w / 2, 58);
    c.font = 'bold 18px sans-serif'; c.fillText('Flak 36 · 3 Stück', w / 2, 90);
    c.strokeStyle = '#2b2f22'; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6);
  });
}
// het camouflagenet: touw in ruiten met lapjes jute en blad; de rest is doorzichtig
function netDoek() {
  return doek(256, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.strokeStyle = 'rgba(58,52,36,1)'; c.lineWidth = 2.2;
    for (let i = -w; i < w * 2; i += 18) {
      c.beginPath(); c.moveTo(i, 0); c.lineTo(i + h, h); c.stroke();
      c.beginPath(); c.moveTo(i, 0); c.lineTo(i - h, h); c.stroke();
    }
    const kl = ['#55613a', '#6b6a43', '#3f4a2c', '#7a6b48', '#4a5a34'];
    for (let i = 0; i < 260; i++) {
      c.fillStyle = kl[i % kl.length];
      c.save(); c.translate(rand(0, w), rand(0, h)); c.rotate(rand(0, Math.PI));
      c.beginPath(); c.ellipse(0, 0, rand(5, 13), rand(3, 7), 0, 0, Math.PI * 2); c.fill();
      c.restore();
    }
  });
}
// de regisseursstoel: zwart doek met de titel
function stoelDoek() {
  return doek(256, 96, (c, w, h) => {
    c.fillStyle = '#18181b'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#e8e2cf'; c.font = 'bold 34px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('NO MERCY 4', w / 2, h / 2 - 8);
    c.font = '16px sans-serif'; c.fillText('regie · Erik Jan', w / 2, h / 2 + 24);
  });
}

function doos(b, h, d, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(b, h, d), m);
  o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true;
  return o;
}
function cil(r1, r2, l, m, x = 0, y = 0, z = 0, as = 'y', seg = 14) {
  const g = new THREE.CylinderGeometry(r1, r2, l, seg);
  if (as === 'z') g.rotateX(Math.PI / 2);
  if (as === 'x') g.rotateZ(Math.PI / 2);
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true;
  return o;
}

// ---------------------------------------------------------------- de Flak
/*
 De 8,8 cm Flak 36 op schaal: het kruisonderstel (twee balken van zes meter met stelvoeten), de voet,
 de draaischijf, de bovenaffuit met twee zijplaten, en daarop de wieg met de loop van bijna vijf meter,
 30 graden omhoog. Het schild staat ervoor met een sleuf voor de loop. Lokaal wijst de loop naar −z.
*/
function maakFlak() {
  const verf = new THREE.MeshStandardMaterial({ color: 0xc8ccbc, roughness: 0.78, metalness: 0.15, map: verfDoek() });
  const donker = new THREE.MeshStandardMaterial({ color: 0x3a3d36, roughness: 0.6, metalness: 0.35 });
  const groep = new THREE.Group();
  const romp = new THREE.Group();          // alles wat kantelt bij de knal
  groep.add(romp);
  // het kruis
  romp.add(doos(0.34, 0.26, 6.4, verf, 0, 0.22, 0));
  romp.add(doos(6.0, 0.26, 0.34, verf, 0, 0.22, 0));
  for (const [x, z] of [[0, 3.15], [0, -3.15], [2.95, 0], [-2.95, 0]]) {
    romp.add(cil(0.30, 0.34, 0.07, donker, x, 0.035, z));
    romp.add(cil(0.055, 0.055, 0.42, donker, x, 0.27, z));
  }
  // voet, draaischijf
  romp.add(cil(0.40, 0.55, 0.72, verf, 0, 0.70, 0));
  romp.add(cil(0.78, 0.78, 0.12, verf, 0, 1.12, 0, 'y', 20));
  // de bovenaffuit
  for (const x of [-0.43, 0.43]) romp.add(doos(0.08, 0.95, 1.55, verf, x, 1.62, 0.05));
  romp.add(doos(0.94, 0.12, 1.4, verf, 0, 1.22, 0.05));
  romp.add(cil(0.07, 0.07, 1.05, donker, 0, 1.88, 0.1, 'x'));
  // handwielen en zitjes
  for (const x of [-0.62, 0.62]) {
    const wiel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 6, 16), donker);
    wiel.position.set(x, 1.45, 0.45); wiel.rotation.y = Math.PI / 2; wiel.castShadow = true;
    romp.add(wiel);
    romp.add(doos(0.30, 0.05, 0.26, donker, x * 1.25, 1.18, 0.7));
  }
  // de wieg met de loop: draait om de tap
  const wieg = new THREE.Group();
  wieg.position.set(0, 1.88, 0.1);
  wieg.rotation.x = 0.52;
  romp.add(wieg);
  wieg.add(doos(0.36, 0.30, 2.3, verf, 0, -0.18, -0.6));                  // wieg en remcilinders
  wieg.add(doos(0.38, 0.38, 0.62, verf, 0, 0.0, 0.62));                    // het sluitstuk
  wieg.add(cil(0.135, 0.135, 1.7, verf, 0, 0.02, -1.0, 'z'));              // de mantel om de loop
  wieg.add(cil(0.075, 0.088, 3.4, verf, 0, 0.02, -3.5, 'z'));              // de loop
  wieg.add(cil(0.095, 0.095, 0.18, donker, 0, 0.02, -5.18, 'z'));          // de mond
  for (const x of [-0.30, 0.30]) wieg.add(cil(0.075, 0.075, 1.25, donker, x, -0.12, -0.15, 'z'));   // vereffenaars
  // het schild, met een sleuf voor de loop, en de twee vleugels
  const schild = new THREE.Group();
  schild.position.set(0, 0, -1.05);
  romp.add(schild);
  schild.add(doos(0.95, 1.55, 0.04, verf, -0.66, 1.95, 0));
  schild.add(doos(0.95, 1.55, 0.04, verf, 0.66, 1.95, 0));
  schild.add(doos(0.40, 0.55, 0.04, verf, 0, 1.45, 0));
  for (const s of [-1, 1]) {
    const v = doos(0.75, 1.35, 0.04, verf, s * 1.42, 1.9, 0.26);
    v.rotation.y = -s * 0.55;
    schild.add(v);
  }
  groep.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  const kleur = { verf: verf.color.getHex(), donker: donker.color.getHex() };
  const ZWART = new THREE.Color(0x1c1b19);
  return {
    groep, wieg, schild, romp,
    // na de knal: scheef, de loop hangt, het schild ligt half af en alles is zwartgeblakerd
    knal(t = 1) {
      romp.rotation.z = 0.13 * t; romp.rotation.x = -0.05 * t;
      romp.position.y = -0.08 * t;
      wieg.rotation.x = 0.52 - 0.62 * t;
      schild.rotation.x = 0.55 * t; schild.position.y = -0.35 * t;
      verf.color.setHex(kleur.verf).lerp(ZWART, 0.82 * t);
      donker.color.setHex(kleur.donker).lerp(ZWART, 0.6 * t);
    },
    herstel() { this.knal(0); },
  };
}

// ---------------------------------------------------------------- de set
/*
 De set rond de Flak. `x`, `z` het midden, `yaw` zo dat de loop naar `richting` wijst (van de aanloop af).
 Levert de plekken: de gele ruit voor de C4 (aan de kant van de aanloop), waar Erik Jan staat te regisseren
 en waar de cameraman begint.
*/
export function maakSet(scene) {
  const groep = new THREE.Group();
  groep.visible = false;
  scene.add(groep);
  const flak = maakFlak();
  groep.add(flak.groep);
  // drie kisten met granaten, rechtsachter
  const kist = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, map: kistDoek() });
  const kisten = [[2.6, 0.18, 1.9, 0.2], [2.7, 0.18, 2.5, -0.1], [2.65, 0.53, 2.2, 0.05]];
  for (const [x, y, z, r] of kisten) { const k = doos(0.95, 0.36, 0.48, kist, x, y, z); k.rotation.y = r; groep.add(k); }
  // het camouflagenet op vier palen, over de kisten: doorzien kan, het net hangt door
  const paal = new THREE.MeshStandardMaterial({ color: 0x6b5236, roughness: 0.9 });
  const net = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, map: netDoek(), alphaTest: 0.4, side: THREE.DoubleSide });
  const nx = 3.0, nz = 2.6, nw = 3.4, nd = 3.0, nh = 2.35;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) groep.add(cil(0.045, 0.05, nh, paal, nx + sx * nw / 2, nh / 2, nz + sz * nd / 2));
  {
    const g = new THREE.PlaneGeometry(nw + 0.4, nd + 0.4, 12, 10);
    g.rotateX(-Math.PI / 2);
    const P = g.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i) / ((nw + 0.4) / 2), z = P.getZ(i) / ((nd + 0.4) / 2);
      P.setY(i, -0.35 * (1 - x * x) * (1 - z * z) - (Math.abs(x) > 0.95 || Math.abs(z) > 0.95 ? 0.25 : 0));
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, net);
    m.position.set(nx, nh + 0.02, nz); m.castShadow = true;
    groep.add(m);
  }
  // de filmlamp op zijn statief, schuin op het kanon gericht (alleen een gloeiend vlak: geen echt licht)
  const zwart = new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.5, metalness: 0.4 });
  const gloei = new THREE.MeshStandardMaterial({ color: 0xfff4dc, emissive: 0xfff1d2, emissiveIntensity: 1.2, roughness: 0.4 });
  const lamp = new THREE.Group();
  lamp.position.set(-4.4, 0, 3.6);
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3;
    const poot = cil(0.018, 0.018, 1.9, zwart, Math.sin(a) * 0.35, 0.9, Math.cos(a) * 0.35);
    poot.rotation.set(Math.cos(a) * 0.2, 0, -Math.sin(a) * 0.2);
    lamp.add(poot);
  }
  lamp.add(cil(0.02, 0.02, 0.6, zwart, 0, 2.0, 0));
  const kop = new THREE.Group(); kop.position.set(0, 2.35, 0); kop.rotation.set(-0.25, 0.85, 0);
  kop.add(doos(0.55, 0.45, 0.32, zwart));
  const vlak = doos(0.48, 0.38, 0.02, gloei, 0, 0, -0.165);
  kop.add(vlak);
  lamp.add(kop);
  groep.add(lamp);
  // de regisseursstoel met de titel op de rugleuning
  const stoel = new THREE.Group();
  stoel.position.set(-5.2, 0, 1.2); stoel.rotation.y = 0.9;
  const hout = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.8 });
  const titel = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, map: stoelDoek() });
  for (const [x, z] of [[-0.25, -0.2], [0.25, -0.2], [-0.25, 0.2], [0.25, 0.2]]) stoel.add(doos(0.04, 0.95, 0.04, hout, x, 0.47, z));
  stoel.add(doos(0.54, 0.03, 0.42, titel, 0, 0.55, 0));
  stoel.add(doos(0.56, 0.24, 0.02, titel, 0, 0.98, 0.2));
  groep.add(stoel);
  groep.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  const plek = { x: 0, z: 0, yaw: 0 };
  const naarWereld = (lx, lz) => {
    const c = Math.cos(plek.yaw), s = Math.sin(plek.yaw);
    return { x: plek.x + lx * c + lz * s, z: plek.z - lx * s + lz * c };
  };
  return {
    groep, flak,
    get zichtbaar() { return groep.visible; },
    toon(v) { groep.visible = !!v; },
    // neerzetten; `richting` {x,z} is waar de loop naartoe wijst
    zet(x, y, z, richting) {
      plek.x = x; plek.z = z; plek.yaw = Math.atan2(-richting.x, -richting.z);
      groep.position.set(x, y, z); groep.rotation.y = plek.yaw;
    },
    naarWereld,
    get yaw() { return plek.yaw; },
    // de gele ruit: achter het kanon aan de kant van de aanloop, naast het sluitstuk
    get ruit() { return naarWereld(1.2, 2.2); },
    get regisseur() { return naarWereld(-5.8, 2.4); },
    get start() { return naarWereld(-1.0, 13.0); },
    knal: (t) => flak.knal(t),
    herstel: () => flak.herstel(),
  };
}

// ---------------------------------------------------------------- helmen en mensen
const HELM = {};
/*
 Een helm op het hoofd van een Persoon (de stahlhelm van de Duitsers, de M1 van de Amerikanen): een draaivorm
 uit een profiel, op de plek van de pet. De stahlhelm loopt laag over de oren en de nek en waaiert onderaan
 uit; de M1 is een ronde kom met een smalle rand.
*/
export function zetHelm(persoon, soort = 'stahl', kleur = null) {
  const k = kleur ?? (soort === 'stahl' ? NOMERCY.duits.helm : NOMERCY.amerikaans.helm);
  const sleutel = `${soort}|${k}`;
  if (!HELM[sleutel]) {
    const profiel = soort === 'stahl'
      ? [[0.001, 0.158], [0.06, 0.152], [0.105, 0.128], [0.132, 0.088], [0.142, 0.040], [0.145, 0.0], [0.148, -0.035], [0.166, -0.062], [0.172, -0.070]]
      : [[0.001, 0.160], [0.065, 0.153], [0.112, 0.124], [0.138, 0.078], [0.146, 0.030], [0.150, -0.002], [0.168, -0.010], [0.170, -0.018]];
    const g = new THREE.LatheGeometry(profiel.map(([r, y]) => new THREE.Vector2(r, y)), 24);
    g.scale(1.0, 1.0, 1.08);
    HELM[sleutel] = { geo: g, mat: new THREE.MeshStandardMaterial({ color: k, roughness: 0.72, metalness: 0.12, side: THREE.DoubleSide }) };
  }
  const h = new THREE.Mesh(HELM[sleutel].geo, HELM[sleutel].mat);
  // iets naar achteren gekanteld, zodat de rand vóór boven de ogen blijft en achter de nek dekt
  h.position.set(0, soort === 'stahl' ? 0.03 : 0.022, 0.006);
  h.rotation.x = soort === 'stahl' ? 0.26 : 0.18;
  h.castShadow = true; h.receiveShadow = true;
  h.name = 'helm';
  persoon.hoofd.add(h);
  return h;
}

// een Duitser uit de film: feldgrau, stahlhelm, een M1 Garand
export function maakDuitser(i = 0) {
  const D = NOMERCY.duits;
  const p = new Persoon({ shirt: D.shirt, broek: D.broek, schoen: D.schoen, huid: i % 3 === 1 ? 0xc79a72 : 0xd9b48f,
    haar: 0x6a5a40, hoogte: 0.98 + (i % 4) * 0.02 });
  zetHelm(p, 'stahl');
  p.geefWapen('garand');
  return p;
}

// Erik Jan, de regisseur: donkerrode trui, pet achterstevoren zou te veel zijn; gewoon een pet
export function maakErikJan() {
  return new Persoon({ shirt: 0x7a2f2a, broek: 0x2a2f3a, huid: 0xdcb08c, haar: 0x2b2620, hoogte: 1.04, pet: true, petKleur: 0x1b1b20 });
}

// de cameraman: zwart shirt, en de camera op zijn rechterschouder, de lens naar voren
export function maakCameraman() {
  const p = new Persoon({ shirt: 0x26272b, broek: 0x3b4250, huid: 0xd3a273, haar: 0x3a2a1c, hoogte: 1.0, pet: true, petKleur: 0x2a2a2e });
  const zwart = new THREE.MeshStandardMaterial({ color: 0x1d1e21, roughness: 0.45, metalness: 0.35 });
  const glas = new THREE.MeshStandardMaterial({ color: 0x0d1420, roughness: 0.1, metalness: 0.6 });
  const rood = new THREE.MeshStandardMaterial({ color: 0xc81e1e, emissive: 0x8a0a0a, emissiveIntensity: 1.0, roughness: 0.4 });
  const cam = new THREE.Group();
  cam.name = 'filmcamera';
  cam.add(doos(0.15, 0.20, 0.40, zwart, 0, 0, 0));
  cam.add(cil(0.062, 0.07, 0.20, zwart, 0, 0.0, -0.28, 'z'));
  cam.add(cil(0.05, 0.05, 0.01, glas, 0, 0.0, -0.385, 'z'));
  cam.add(doos(0.06, 0.06, 0.14, zwart, -0.10, 0.04, 0.12));          // zoeker, naar zijn oog
  cam.add(doos(0.03, 0.04, 0.24, zwart, 0, 0.14, -0.02));             // handgreep bovenop
  cam.add(doos(0.02, 0.02, 0.02, rood, 0.055, 0.09, -0.15));          // het rode lampje: hij draait
  cam.position.set(0.17, MAAT.schouder + 0.14, -0.06);
  cam.traverse(o => { if (o.isMesh) o.castShadow = true; });
  p.groep.add(cam);
  p.camera = cam;
  return p;
}

// ---------------------------------------------------------------- het bos
/*
 Waar is het Tinga-bos? In de kaart staat maar een klein bosvlak (1.800 m²); de bomen zelf staan ook op het
 gras eromheen. Dus: vakjes van vier meter, "bos" als er binnen zes meter twee stammen of meer staan, en dan
 alles wat vanaf de set aaneengesloten is (ruim 24.000 m², een strook van zuidwest naar noordoost). Een vakje
 ernaast telt nog mee: buiten het bos ben je pas als er geen bosvakje naast je ligt.
*/
export function bosKaart(bomen, mid, R = 320, C = 4) {
  const N = Math.ceil(2 * R / C);
  const x0 = mid.x - R, z0 = mid.z - R;
  const bak = new Map();
  for (const b of bomen) {
    if (Math.abs(b.x - mid.x) > R + 8 || Math.abs(b.z - mid.z) > R + 8) continue;
    const k = `${Math.floor(b.x / 6)}:${Math.floor(b.z / 6)}`;
    if (!bak.has(k)) bak.set(k, []);
    bak.get(k).push(b);
  }
  const dicht = new Uint8Array(N * N);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = x0 + (i + 0.5) * C, z = z0 + (j + 0.5) * C;
    const bi = Math.floor(x / 6), bj = Math.floor(z / 6);
    let n = 0;
    for (let a = -1; a <= 1 && n < 2; a++) for (let b = -1; b <= 1 && n < 2; b++) {
      for (const t of bak.get(`${bi + a}:${bj + b}`) || []) if (Math.hypot(t.x - x, t.z - z) < 6) n++;
    }
    dicht[i * N + j] = n >= 2 ? 1 : 0;
  }
  const bos = new Uint8Array(N * N);
  const si = Math.floor((mid.x - x0) / C), sj = Math.floor((mid.z - z0) / C);
  const stapel = [[si, sj]];
  // de set zelf is gekapt: rond het midden telt alles als bos
  for (let i = si - 3; i <= si + 3; i++) for (let j = sj - 3; j <= sj + 3; j++) if (i >= 0 && j >= 0 && i < N && j < N) dicht[i * N + j] = 1;
  while (stapel.length) {
    const [i, j] = stapel.pop();
    if (i < 0 || j < 0 || i >= N || j >= N) continue;
    const k = i * N + j;
    if (bos[k] || !dicht[k]) continue;
    bos[k] = 1;
    stapel.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]);
  }
  const cel = (x, z) => [Math.floor((x - x0) / C), Math.floor((z - z0) / C)];
  const isBos = (i, j) => i >= 0 && j >= 0 && i < N && j < N && bos[i * N + j] === 1;
  function inBos(x, z) {
    const [i, j] = cel(x, z);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (isBos(i + a, j + b)) return true;
    return false;
  }
  // de dichtstbijzijnde plek buiten het bos, vanaf (x, z): in 36 richtingen tot het bos ophoudt, plus een paar meter
  function uitgang(x, z, buiten = null) {
    let beste = null;
    for (let r = 0; r < 36; r++) {
      const a = r / 36 * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
      for (let d = 2; d < R; d += 2) {
        const px = x + dx * d, pz = z + dz * d;
        if (inBos(px, pz)) continue;
        if (buiten && !buiten(px + dx * 4, pz + dz * 4)) break;
        if (!beste || d < beste.d) beste = { d, x: px + dx * 4, z: pz + dz * 4, richting: { x: dx, z: dz } };
        break;
      }
    }
    return beste;
  }
  let opp = 0;
  for (let k = 0; k < bos.length; k++) opp += bos[k];
  return { inBos, uitgang, oppervlak: opp * C * C };
}

// ---------------------------------------------------------------- de tweede scène: het bunkerdorp (stap 141)
/*
 "Het bunkerdorp": een Duits kampement op een tweede open plek dieper in het bos (`NOMERCY_KAMP` in
 js/bouwvlak.js). Alles staat in wereldrichtingen rond het midden (geen draaiing: de botsdozen in js/verhaal.js
 zijn dan gewone rechthoeken). Erik komt van het westen (`start`), dus de ingang van de tent kijkt naar het westen.

   - de tent: een nokkentent van zeildoek (een doek op canvas met naden en vlekken), open aan de voorkant, met
     palen, scheerlijnen en binnen een klaptafel met de kaart (die je pakt) en een stormlamp;
   - de radiopost: een kist als tafel met een veldradio (wijzers en knoppen op een doek), een veldtelefoon, een
     zweepantenne, een krukje en een handsirene op een paal; na de C4 kantelt hij en is alles zwartgeblakerd;
   - kisten, twee vaten en een muurtje van zandzakken waar de eerste schildwacht achter staat;
   - de stafauto zelf is een auto uit js/vehicles.js (`voegToe`, zie js/verhaal.js), hier staat alleen zijn plek.

 De plekken (ten opzichte van het midden, x naar het oosten, z naar het zuiden) staan in `KAMP`.
*/
export const KAMP = {
  tent: { x: -6, z: 0, l: 4.2, b: 3.2, h: 2.2 },     // l langs x, de ingang aan de westkant
  ingang: { x: -9.0, z: 0 },                           // hier pak je de kaart (E)
  radio: { x: 3, z: 6 },
  radioRuit: { x: 1.6, z: 6 },                         // de C4 aan de westkant van de radiopost
  staf: { x: 2, z: -7, yaw: Math.PI / 2 },
  closeup: { x: 0, z: 3 },                             // de gele ruit voor de camera
  camera: { x: -3.4, z: 3 },                           // waar de cameraman de close-up draait
  regisseur: { x: -13, z: 7 },
  ejSlot: { x: -3.0, z: 4.8 },                         // Erik Jan met het klapbord, naast de camera
  // de schildwachten: A staat achter de zandzakken en kijkt naar het oosten, B loopt aan de oostkant heen en weer
  wachten: [{ a: [8, -0.6], b: [8.4, -0.6] }, { a: [11, -8], b: [11, 8] }],
};

// zeildoek van de tent: olijfgrauw met een weefsel, naden, vlekken en vouwen
function tentDoek() {
  return doek(256, 256, (c, w, h) => {
    c.fillStyle = '#6d6b4f'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) { c.fillStyle = `rgba(40,40,26,${rand(0.04, 0.1)})`; c.fillRect(0, y, w, 1); }
    for (let x = 0; x < w; x += 2) { c.fillStyle = `rgba(150,148,110,${rand(0.02, 0.06)})`; c.fillRect(x, 0, 1, h); }
    for (let i = 0; i < 40; i++) {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 1);
      c.save(); c.translate(rand(0, w), rand(0, h)); c.scale(rand(8, 30), rand(6, 20));
      g.addColorStop(0, `rgba(48,44,30,${rand(0.08, 0.2)})`); g.addColorStop(1, 'rgba(48,44,30,0)');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, 1, 0, Math.PI * 2); c.fill(); c.restore();
    }
    c.strokeStyle = 'rgba(38,36,24,0.55)'; c.lineWidth = 2;
    for (const x of [64, 192]) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    c.strokeStyle = 'rgba(160,156,120,0.25)'; c.lineWidth = 1;
    for (const x of [67, 195]) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
  });
}
// de stafkaart: vergeeld papier, hoogtelijnen, water, wegen, rode pijlen en een stempel
function stafkaartDoek() {
  return doek(256, 192, (c, w, h) => {
    c.fillStyle = '#d9cfa8'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) { c.fillStyle = `rgba(120,100,60,${rand(0.03, 0.08)})`; c.fillRect(rand(0, w), rand(0, h), rand(1, 6), rand(1, 3)); }
    c.strokeStyle = 'rgba(140,100,60,0.55)'; c.lineWidth = 1;
    for (let k = 0; k < 6; k++) {
      c.beginPath();
      for (let a = 0; a <= 40; a++) {
        const t = a / 40 * Math.PI * 2, r = 18 + k * 11 + Math.sin(t * 3 + k) * 5;
        const x = 150 + Math.cos(t) * r * 1.3, y = 90 + Math.sin(t) * r;
        if (a) c.lineTo(x, y); else c.moveTo(x, y);
      }
      c.stroke();
    }
    c.strokeStyle = '#4c7fb0'; c.lineWidth = 7;
    c.beginPath(); c.moveTo(0, 150); c.bezierCurveTo(60, 120, 90, 175, 160, 150); c.bezierCurveTo(200, 135, 230, 160, w, 140); c.stroke();
    c.fillStyle = '#2d5a86'; c.font = 'italic 11px serif'; c.fillText('Geeuw', 40, 168);
    c.strokeStyle = '#3a3226'; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(20, 0); c.lineTo(70, 90); c.lineTo(60, h); c.stroke();
    c.beginPath(); c.moveTo(0, 60); c.lineTo(w, 75); c.stroke();
    c.fillStyle = '#2a2219'; c.font = 'bold 14px serif'; c.fillText('SNEEK', 82, 58);
    c.font = '10px serif'; c.fillText('Tinga-Wald', 150, 108);
    c.strokeStyle = '#b3241c'; c.fillStyle = '#b3241c'; c.lineWidth = 4;
    for (const [x0, y0, x1, y1] of [[230, 30, 170, 70], [220, 120, 175, 95]]) {
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
      const a = Math.atan2(y1 - y0, x1 - x0);
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 - Math.cos(a - 0.5) * 12, y1 - Math.sin(a - 0.5) * 12);
      c.lineTo(x1 - Math.cos(a + 0.5) * 12, y1 - Math.sin(a + 0.5) * 12); c.closePath(); c.fill();
    }
    c.save(); c.translate(52, 28); c.rotate(-0.18);
    c.strokeStyle = 'rgba(170,30,30,0.8)'; c.lineWidth = 2; c.strokeRect(-36, -12, 72, 24);
    c.fillStyle = 'rgba(170,30,30,0.8)'; c.font = 'bold 15px sans-serif'; c.textAlign = 'center'; c.fillText('GEHEIM', 0, 6);
    c.restore();
    c.strokeStyle = '#6b5a3c'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, w - 3, h - 3);
  });
}
// de voorkant van de veldradio: grijs paneel, drie wijzers met schaalverdeling, knoppen en een typeplaatje
function radioDoek() {
  return doek(256, 160, (c, w, h) => {
    c.fillStyle = '#5c6152'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(30,32,26,${rand(0.04, 0.12)})`; c.fillRect(rand(0, w), rand(0, h), rand(1, 4), 1); }
    c.strokeStyle = '#2b2d26'; c.lineWidth = 4; c.strokeRect(4, 4, w - 8, h - 8);
    const wijzers = [[52, 62, 0.4], [128, 62, -0.6], [204, 62, 0.9]];
    for (const [x, y, a] of wijzers) {
      c.fillStyle = '#e9e2c8'; c.beginPath(); c.arc(x, y, 30, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#1d1d1a'; c.lineWidth = 3; c.stroke();
      c.lineWidth = 1.2;
      for (let k = 0; k <= 10; k++) {
        const t = Math.PI * (1.15 + k * 0.07);
        c.beginPath(); c.moveTo(x + Math.cos(t) * 24, y + Math.sin(t) * 24); c.lineTo(x + Math.cos(t) * (k % 5 ? 27 : 29), y + Math.sin(t) * (k % 5 ? 27 : 29)); c.stroke();
      }
      c.strokeStyle = '#b3241c'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x, y + 8); c.lineTo(x + Math.sin(a) * 24, y + 8 - Math.cos(a) * 26); c.stroke();
      c.fillStyle = '#1d1d1a'; c.beginPath(); c.arc(x, y + 8, 3, 0, Math.PI * 2); c.fill();
    }
    for (let k = 0; k < 5; k++) {
      const x = 40 + k * 44;
      c.fillStyle = '#17171a'; c.beginPath(); c.arc(x, 124, 11, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#8c8c86'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, 124); c.lineTo(x + 7, 118); c.stroke();
    }
    c.fillStyle = '#c9c2a4'; c.fillRect(96, 100, 64, 12);
    c.fillStyle = '#26261f'; c.font = 'bold 10px sans-serif'; c.textAlign = 'center'; c.fillText('Torn.Fu.d2', 128, 110);
  });
}
// jute van de zandzakken
function juteDoek() {
  return doek(128, 128, (c, w, h) => {
    c.fillStyle = '#9b8a62'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) { c.fillStyle = `rgba(70,58,36,${rand(0.1, 0.22)})`; c.fillRect(0, y, w, 1); }
    for (let x = 0; x < w; x += 3) { c.fillStyle = `rgba(190,176,140,${rand(0.06, 0.14)})`; c.fillRect(x, 0, 1, h); }
    for (let i = 0; i < 30; i++) { c.fillStyle = `rgba(60,50,30,${rand(0.06, 0.16)})`; c.beginPath(); c.arc(rand(0, w), rand(0, h), rand(4, 14), 0, Math.PI * 2); c.fill(); }
  });
}

// een nokkentent: twee dakvlakken en een achterwand, de voorkant (−x) open
function tentGeo(l, b, h) {
  const x0 = -l / 2, x1 = l / 2, z = b / 2;
  const pos = [], uv = [];
  const drie = (a, bb, cc, ua, ub, uc) => { pos.push(...a, ...bb, ...cc); uv.push(...ua, ...ub, ...uc); };
  const vier = (a, bb, cc, d) => { drie(a, bb, cc, [0, 0], [1, 0], [1, 1]); drie(a, cc, d, [0, 0], [1, 1], [0, 1]); };
  vier([x0, 0, -z], [x1, 0, -z], [x1, h, 0], [x0, h, 0]);
  vier([x1, 0, z], [x0, 0, z], [x0, h, 0], [x1, h, 0]);
  drie([x1, 0, -z], [x1, 0, z], [x1, h, 0], [0, 0], [1, 0], [0.5, 1]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv.map((v, i) => v * (i % 2 ? 1.2 : 1.6)), 2));
  g.computeVertexNormals();
  return g;
}

export function maakKamp(scene) {
  const groep = new THREE.Group();
  groep.visible = false;
  scene.add(groep);
  const T = KAMP.tent;
  // ---- de tent ----
  const zeil = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, map: tentDoek(), side: THREE.DoubleSide });
  const hout = new THREE.MeshStandardMaterial({ color: 0x7a5c3a, roughness: 0.85 });
  const touw = new THREE.MeshStandardMaterial({ color: 0xb6a77e, roughness: 0.9 });
  const tent = new THREE.Group();
  tent.position.set(T.x, 0, T.z);
  groep.add(tent);
  tent.add(new THREE.Mesh(tentGeo(T.l, T.b, T.h), zeil));
  for (const x of [-T.l / 2, T.l / 2]) tent.add(cil(0.035, 0.04, T.h + 0.12, hout, x, (T.h + 0.12) / 2, 0));
  // het opgerolde voorzeil langs de twee schuine randen van de ingang
  for (const s of [-1, 1]) {
    const lang = Math.hypot(T.b / 2, T.h);
    const rol = cil(0.07, 0.07, lang * 0.92, zeil, -T.l / 2 - 0.04, T.h / 2, s * T.b / 4);
    rol.rotation.x = s * Math.atan2(T.b / 2, T.h);
    tent.add(rol);
  }
  // scheerlijnen naar haringen voor en achter
  for (const [x, dx] of [[-T.l / 2, -1], [T.l / 2, 1]]) {
    const lijn = cil(0.008, 0.008, Math.hypot(1.3, T.h), touw, x + dx * 0.65, T.h / 2, 0);
    lijn.rotation.z = dx * Math.atan2(1.3, T.h);
    tent.add(lijn);
    tent.add(doos(0.04, 0.12, 0.04, hout, x + dx * 1.3, 0.05, 0));
  }
  // grondzeil, klaptafel met de kaart, een stormlamp en een kist
  tent.add(doos(T.l - 0.2, 0.01, T.b - 0.3, new THREE.MeshStandardMaterial({ color: 0x4a4834, roughness: 1 }), 0, 0.006, 0));
  const tafel = new THREE.Group();
  tafel.position.set(-T.l / 2 + 0.9, 0, 0);
  tent.add(tafel);
  tafel.add(doos(0.7, 0.04, 0.95, hout, 0, 0.74, 0));
  for (const [x, z] of [[-0.3, -0.42], [0.3, -0.42], [-0.3, 0.42], [0.3, 0.42]]) tafel.add(doos(0.035, 0.74, 0.035, hout, x, 0.37, z));
  const kaartMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, map: stafkaartDoek() });
  const kaart = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.84), kaartMat);
  kaart.rotation.x = -Math.PI / 2; kaart.rotation.z = Math.PI / 2;
  kaart.position.set(0, 0.765, 0);
  kaart.name = 'stafkaart';
  tafel.add(kaart);
  const glim = new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffc870, emissiveIntensity: 0.9, roughness: 0.4 });
  const zwart = new THREE.MeshStandardMaterial({ color: 0x1d1e1c, roughness: 0.55, metalness: 0.4 });
  const lamp = new THREE.Group(); lamp.position.set(0.2, 0.76, -0.36); tafel.add(lamp);
  lamp.add(cil(0.07, 0.08, 0.03, zwart, 0, 0.015, 0), cil(0.055, 0.055, 0.13, glim, 0, 0.1, 0), cil(0.03, 0.07, 0.04, zwart, 0, 0.18, 0));
  const kistMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, map: kistDoek() });
  tent.add(doos(0.95, 0.36, 0.48, kistMat, 1.1, 0.18, 0.9));

  // ---- de radiopost ----
  const R = KAMP.radio;
  const post = new THREE.Group();
  post.position.set(R.x, 0, R.z);
  groep.add(post);
  const romp = new THREE.Group();                    // alles wat kantelt bij de knal
  post.add(romp);
  const kistR = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, map: kistMat.map });
  const grijs = new THREE.MeshStandardMaterial({ color: 0x5c6152, roughness: 0.6, metalness: 0.25 });
  const front = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.2, map: radioDoek() });
  const metaal = new THREE.MeshStandardMaterial({ color: 0x3d3f39, roughness: 0.45, metalness: 0.6 });
  romp.add(doos(0.55, 0.62, 0.95, kistR, 0, 0.31, 0));
  const radio = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.52), [grijs, front, grijs, grijs, grijs, grijs]);
  radio.position.set(0, 0.79, 0.05); radio.castShadow = radio.receiveShadow = true;
  radio.name = 'radio';
  romp.add(radio);
  romp.add(doos(0.18, 0.13, 0.22, grijs, 0.05, 0.685, -0.36));                  // de veldtelefoon
  romp.add(cil(0.02, 0.02, 0.18, zwart, -0.02, 0.77, -0.36, 'z'));              // de hoorn
  const antenne = new THREE.Group(); antenne.position.set(0.1, 0.96, 0.25); romp.add(antenne);
  antenne.add(cil(0.006, 0.01, 2.6, metaal, 0, 1.3, 0, 'y', 6));
  antenne.add(cil(0.025, 0.025, 0.03, metaal, 0, 2.62, 0, 'y', 8));
  // het krukje van de marconist
  const kruk = new THREE.Group(); kruk.position.set(-0.85, 0, 0); romp.add(kruk);
  kruk.add(doos(0.36, 0.04, 0.36, hout, 0, 0.46, 0));
  for (const [x, z] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) kruk.add(doos(0.03, 0.46, 0.03, hout, x, 0.23, z));
  // de handsirene op een paal, naast de post
  const sirene = new THREE.Group(); sirene.position.set(0.5, 0, 1.05); post.add(sirene);
  sirene.add(cil(0.035, 0.04, 2.0, metaal, 0, 1.0, 0, 'y', 8));
  sirene.add(cil(0.13, 0.13, 0.2, grijs, 0, 2.08, 0, 'x', 14));
  sirene.add(cil(0.09, 0.19, 0.22, grijs, -0.21, 2.08, 0, 'x', 14));
  sirene.add(doos(0.03, 0.24, 0.03, metaal, 0.12, 1.9, 0.1));                   // de slinger

  // ---- kisten, vaten en zandzakken ----
  for (const [x, y, z, r] of [[6.2, 0.18, 2.2, 0.15], [6.7, 0.18, 2.9, -0.2], [6.45, 0.54, 2.55, 0.05], [-1.5, 0.18, 7.2, 0.6]]) {
    const k = doos(0.95, 0.36, 0.48, kistMat, x, y, z); k.rotation.y = r; groep.add(k);
  }
  const vat = new THREE.MeshStandardMaterial({ color: 0x55594a, roughness: 0.6, metalness: 0.3 });
  for (const [x, z] of [[5.5, -3.5], [6.15, -3.15]]) groep.add(cil(0.29, 0.29, 0.88, vat, x, 0.44, z, 'y', 16));
  const jute = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, map: juteDoek() });
  const zak = new THREE.SphereGeometry(1, 12, 8);
  for (let rij = 0; rij < 3; rij++) {
    for (let i = 0; i < 6 - rij; i++) {
      const m = new THREE.Mesh(zak, jute);
      m.scale.set(0.26, 0.13, 0.42);
      m.position.set(9.2 + (rij % 2) * 0.05, 0.12 + rij * 0.23, -2.1 + i * 0.78 + rij * 0.39);
      m.rotation.y = rand(-0.12, 0.12);
      m.castShadow = m.receiveShadow = true;
      groep.add(m);
    }
  }
  groep.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  // na de knal: de post kantelt, de antenne knikt, alles zwartgeblakerd (kleuren, geen nieuw materiaal)
  const ZWART = new THREE.Color(0x1a1917);
  const verkoold = [kistR, grijs, front, metaal];
  const kleur = verkoold.map(m => m.color.getHex());
  function radioKnal(t = 1) {
    romp.rotation.z = -0.42 * t; romp.rotation.x = 0.12 * t; romp.position.y = -0.05 * t; romp.position.x = 0.15 * t;
    antenne.rotation.z = 0.9 * t;
    sirene.rotation.x = 0.25 * t;
    verkoold.forEach((m, i) => m.color.setHex(kleur[i]).lerp(ZWART, 0.85 * t));
  }
  const plek = { x: 0, y: 0, z: 0 };
  const naarWereld = (p) => ({ x: plek.x + p.x, z: plek.z + p.z });
  return {
    groep, kaart, radio, post, KAMP,
    get zichtbaar() { return groep.visible; },
    toon(v) { groep.visible = !!v; },
    zet(x, y, z) { plek.x = x; plek.y = y; plek.z = z; groep.position.set(x, y, z); },
    naarWereld,
    get midden() { return { x: plek.x, z: plek.z }; },
    get ingang() { return naarWereld(KAMP.ingang); },
    get radioPlek() { return naarWereld(KAMP.radio); },
    get radioRuit() { return naarWereld(KAMP.radioRuit); },
    get closeup() { return naarWereld(KAMP.closeup); },
    get cameraPlek() { return naarWereld(KAMP.camera); },
    get regisseur() { return naarWereld(KAMP.regisseur); },
    get ejSlot() { return naarWereld(KAMP.ejSlot); },
    get staf() { return { ...naarWereld(KAMP.staf), yaw: KAMP.staf.yaw }; },
    get tent() { return naarWereld(KAMP.tent); },
    // de posten van de schildwachten, in wereldcoördinaten
    wachtPosten() {
      return KAMP.wachten.map(w => ({ a: [plek.x + w.a[0], plek.z + w.a[1]], b: [plek.x + w.b[0], plek.z + w.b[1]] }));
    },
    toonKaart(v) { kaart.visible = !!v; },
    radioKnal,
    herstel() { radioKnal(0); kaart.visible = true; },
  };
}

// ---------------------------------------------------------------- het klapbord
/*
 Het klapbord dat Erik Jan aan het eind omhoog houdt: een zwart lei met krijtwitte vakken (NO MERCY 4,
 SCÈNE 2 · TAKE 1, regie, camera, datum) en de gestreepte klap erboven, een eindje open. Hangt aan de
 regisseur (js/verhaal.js), verborgen tot het applaus.
*/
function klapbordDoek() {
  return doek(256, 200, (c, w, h) => {
    c.fillStyle = '#17181a'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 200; i++) { c.fillStyle = `rgba(255,255,255,${rand(0.01, 0.04)})`; c.fillRect(rand(0, w), rand(0, h), rand(2, 18), 1); }
    c.strokeStyle = '#e8e6df'; c.lineWidth = 2.5;
    c.strokeRect(6, 6, w - 12, h - 12);
    for (const y of [64, 120, 160]) { c.beginPath(); c.moveTo(6, y); c.lineTo(w - 6, y); c.stroke(); }
    c.beginPath(); c.moveTo(128, 64); c.lineTo(128, 160); c.stroke();
    c.fillStyle = '#f2f0e8'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = 'bold 38px serif'; c.fillText('NO MERCY 4', w / 2, 36);
    c.font = '11px sans-serif'; c.fillText('SCÈNE', 67, 76); c.fillText('TAKE', 192, 76);
    c.font = 'bold 34px sans-serif'; c.fillText('2', 67, 102); c.fillText('1', 192, 102);
    c.font = '13px sans-serif'; c.fillText('REGIE  Erik Jan', 67, 140); c.fillText('CAMERA  Bas', 192, 140);
    c.font = 'italic 13px sans-serif'; c.fillText('No Mercy 4 · Take 1 · het bunkerdorp', w / 2, 180);
  });
}
function streepDoek() {
  return doek(256, 32, (c, w, h) => {
    c.fillStyle = '#f2f0e8'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#17181a';
    for (let x = -32; x < w + 32; x += 40) { c.beginPath(); c.moveTo(x, h); c.lineTo(x + 20, h); c.lineTo(x + 40, 0); c.lineTo(x + 20, 0); c.closePath(); c.fill(); }
  });
}
export function maakKlapbord() {
  const groep = new THREE.Group();
  groep.name = 'klapbord';
  const zw = new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.7 });
  const lei = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, map: klapbordDoek() });
  const streep = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, map: streepDoek() });
  // het lei: de voorkant (+z) naar de camera; de groep draait de regisseur zelf om
  const bord = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.33, 0.018), [zw, zw, zw, zw, lei, zw]);
  groep.add(bord);
  const onder = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.045, 0.022), [zw, zw, zw, zw, streep, zw]);
  onder.position.set(0, 0.19, 0);
  groep.add(onder);
  const klap = new THREE.Group(); klap.position.set(-0.21, 0.215, 0); klap.rotation.z = 0.32;
  const boven = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.045, 0.022), [zw, zw, zw, zw, streep, zw]);
  boven.position.set(0.21, 0.022, 0);
  klap.add(boven);
  groep.add(klap);
  groep.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  groep.userData.klap = klap;
  groep.visible = false;
  return groep;
}
