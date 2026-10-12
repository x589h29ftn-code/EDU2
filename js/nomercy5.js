/*
 No Mercy 5, "De Overtocht" (stap 142, gevraagd op 12 okt 2026: "Bedenk een tweede bijmissie voor No Mercy",
 en daarna "Laat Erik Jan niet bellen in deze missie maar puur op de kaart").

 Een eerbetoon aan De Veteraan, die in deel één tot drie sergeant Van der Wal speelde en sinds missie 12 dood is.
 Erik Jan staat na missie 12 (en na No Mercy 4) op de kade in IJlst met zijn gele EJ, en wacht daar: hij belt niet.
 De film speelt bij Houtzaagmolen De Rat aan het Sneekerpad, de enige echte stellingmolen in de kaart: in de film een
 Duitse observatiepost aan de overkant van een rivier, het water ten westen van de molen.

 Wat hier staat, en wat js/verhaal.js (het blok `n5`) ermee doet:

   - de set bij de molen (`maakMolenSet`): een MG-nest van zandzakken aan de waterkant, drie muurtjes van zandzakken
     aan de voet van de molen, een vlaggenmast met een Duitse oorlogsvlag (het balkenkruis op wit; geen hakenkruis),
     een zoeklicht op de stelling dat over het water zwaait (een lichtbundel en een vlek op het water, gewone kleuren,
     geen lamp: het aantal lichtbronnen verandert nooit, zie CLAUDE.md), en drie lichtkogels die om beurten boven het
     water hangen;
   - de camera-boot (`maakCameraBoot`): een sloep uit js/boot.js met NO MERCY op de spiegel en een filmcamera op een
     statief; Erik Jan en de cameraman staan erin;
   - de filmcamera op het dak van de camera-auto (`maakCameraRig`);
   - de zijspannen (`maakZijspan`): een motor in feldgrau met een zijspan, een Duitser aan het stuur en een in het
     zijspan, voor de rit in de stafauto.

 Alles wordt bij het opstarten gebouwd (verborgen) en gebruikt alleen soorten materiaal die er al zijn
 (MeshStandardMaterial, MeshBasicMaterial): er komt tijdens het spelen geen shader bij.
*/
import * as THREE from 'three';
import { doek, doos, cil, juteDoek, kistDoek } from './nomercy.js';
import { bouwSloep } from './boot.js';
import { SCOOTER } from './lichaam.js';
import { stuurDelen } from './leven.js';

export const NOMERCY5 = {
  naam: 'No Mercy 5',
  molen: 'Houtzaagmolen De Rat',
  praat: 3.5,            // zo dicht bij Erik Jan kun je hem met E aanspreken (m)
  beloning: 2000,        // de gage (of de stafauto)
  /*
   De overtocht, gemeten uit de BGT (tools/nomercy5test.mjs meet het na): op z = 884 loopt het water van x = −1276
   tot −1137. De sloep begint veertien meter uit de westelijke wal, met de steven naar het oosten; de gele ruit ligt
   aan de overkant op het gras, ten zuiden van de loods van de molen.
  */
  start: { x: -1262, z: 884, yaw: -Math.PI / 2 },
  aanleg: { x: -1133, z: 884 },
  aanlegBereik: 6,       // zo dicht bij de ruit telt aan wal gaan als aangekomen (m)
  vroegVanBoord: 14,     // verder van de ruit van boord gaan: mislukt (m)
  // ten opzichte van het hart van de molen (m), in wereldrichtingen
  mg: [-24, -2],                                 // het MG-nest aan de waterkant
  mgKijk: [-60, -10],                            // waar het MG naar wijst: het water
  voet: [[-6, -11], [3, -15], [-13, -7]],        // drie Duitsers achter de zandzakken aan de voet
  vlag: [-9, -5],                                // de vlaggenmast
  sluipHoek: Math.atan2(-0.87, -0.5),            // de sluipschutter op de stelling, naar de ruit toe
  lampHoek: Math.PI,                             // het zoeklicht op de stelling, aan de westkant
  // het zoeklicht: zwaait rond het westen, en de vlek op het water komt dichterbij en gaat weer weg
  zoek: { zwaai: 0.6, tijd: 9.5, dicht: 38, ver: 112, diepTijd: 6.3, r: 7.5 },
  lichtGrens: 0.5,       // zo lang in de vlek, en het filmpunt voor de overtocht is weg (s)
  lichtRoep: 6,          // en zo vaak roept Erik Jan hoogstens "weg uit het licht" (s)
  lichtkogel: { om: 4.2, hoog: [38, 55], duur: 7, zak: 1.6 },
  // de molen
  molenTijd: 60,         // binnen zo veel tellen na het aanleggen alles neer: een filmpunt
  sluipZicht: 150,       // de sluipschutter en het MG zien je van ver
  vlagBereik: 2.2,       // zo dicht bij de mast haal je de vlag neer (m)
  vlagTijd: 2.2,         // zo lang zakt hij (s)
  /*
   De rit: van het eind van het Sneekerpad bij de molen door IJlst, ruim een halve kilometer. Het begin ligt precies
   op het eind van de as: een punt ervóór liet de routeplanner eerst een stukje terug en dan keren (stap 142, gemeten).
  */
  rit: [[-1093, 907], [-1178, 1100], [-1052, 1107], [-950, 1090], [-881, 1069]],
  camVoor: 18,           // zo ver vóór de stafauto begint de camera-auto (m)
  camVenster: [8, 25],   // zo ver achter de camera-auto hoor je te blijven (m)
  camDoel: 15,           // en hier rijdt hij naar toe
  camTop: 16,            // de camera-auto rijdt nooit harder (m/s, 58 km/u)
  cutNa: 3,              // zo lang buiten het venster, uit de auto of te ver voorbij de ruit: "Cut!" (s)
  motorAchter: [13, 20], // de zijspannen: zo ver achter je (m)
  motorVanaf: 25,        // ze komen pas als je zo ver gereden hebt (m)
  motorVuur: [0.5, 1.1], // tussen twee schoten (s)
  ruitVoorEind: 18,      // de gele ruit ligt zo ver voor het eind van de lijn, waar de camera-auto stopt: stil op de ruit sta je dan nog in het venster
  stopBereik: 3,         // stilstaan binnen zo ver van de ruit is een wrap (m)…
  stopMooi: 1.5,         // …en binnen zo ver een filmpunt
  stil: 0.6,             // en stilstaan is langzamer dan dit (m/s)
  voorbij: 14,           // zo ver voorbij de ruit en niet gestopt: "Cut!" (m)
  weg: 230,              // verder van de molen in de eerste twee scènes: van de set gelopen (m)
  stafKleur: 0x55594a,   // de stafauto, in feldgrau (net als in No Mercy 4)
  camKleur: 0x1d1f24,    // de camera-auto, zwart
};

const rand = (a, b) => a + Math.random() * (b - a);

// ---------------------------------------------------------------- doeken
// de Duitse oorlogsvlag van de film: wit met een zwart balkenkruis met witte randen, en een zwarte rand
function vlagDoek() {
  return doek(256, 160, (c, w, h) => {
    c.fillStyle = '#efece2'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(90,84,70,${rand(0.02, 0.07)})`; c.fillRect(rand(0, w), rand(0, h), rand(3, 24), 1); }
    c.strokeStyle = '#1a1a1a'; c.lineWidth = 10; c.strokeRect(5, 5, w - 10, h - 10);
    const cx = w / 2, cy = h / 2, a = 52, b = 15;
    c.fillStyle = '#ffffff'; c.fillRect(cx - a - 6, cy - b - 6, (a + 6) * 2, (b + 6) * 2); c.fillRect(cx - b - 6, cy - a - 6, (b + 6) * 2, (a + 6) * 2);
    c.fillStyle = '#141414'; c.fillRect(cx - a, cy - b, a * 2, b * 2); c.fillRect(cx - b, cy - a, b * 2, a * 2);
  });
}
// het typeplaatje van het zoeklicht en de opdruk op de camera
function plaatjeDoek(tekst) {
  return doek(128, 32, (c, w, h) => {
    c.fillStyle = '#2b2d2a'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#e8e4d6'; c.font = 'bold 16px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(tekst, w / 2, h / 2 + 1);
  });
}

// een muurtje zandzakken in een boog: `n` per rij, drie rijen, langs een cirkel met straal `r` over `boog` radialen
function zandzakken(mat, n, r, boog, rijen = 3) {
  const g = new THREE.Group();
  const zak = new THREE.SphereGeometry(1, 12, 8);
  for (let rij = 0; rij < rijen; rij++) {
    const m = n - rij;
    for (let i = 0; i < m; i++) {
      const t = m > 1 ? (i / (m - 1) - 0.5) * boog : 0;
      const o = new THREE.Mesh(zak, mat);
      o.scale.set(0.42, 0.13, 0.26);
      o.position.set(Math.sin(t) * r, 0.13 + rij * 0.24, -Math.cos(t) * r);
      o.rotation.y = -t + rand(-0.08, 0.08);
      o.castShadow = true; o.receiveShadow = true;
      g.add(o);
    }
  }
  return g;
}

// ---------------------------------------------------------------- de set bij de molen
/*
 `M` is de molen uit KAART.molens ({ cx, cz, romp, stelling }). Alles staat in wereldcoördinaten in één groep op
 de grond; de hoogte per onderdeel komt van `hoogte(x, z)` (js/verhaal.js geeft grondHoogte mee).
*/
export function maakMolenSet(scene, M, hoogte = () => 0) {
  const groep = new THREE.Group();
  groep.visible = false;
  scene.add(groep);
  const plek = (d) => ({ x: M.cx + d[0], z: M.cz + d[1] });
  const opStelling = (hoek, extra = 0) => {
    const r = M.romp + 0.12 + 0.9 + extra;
    return { x: M.cx + Math.cos(hoek) * r, z: M.cz + Math.sin(hoek) * r, y: M.stelling };
  };

  const jute = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, map: juteDoek() });
  const metaal = new THREE.MeshStandardMaterial({ color: 0x2c2e2b, roughness: 0.5, metalness: 0.55 });
  const grijs = new THREE.MeshStandardMaterial({ color: 0x55594a, roughness: 0.6, metalness: 0.3 });
  const hout = new THREE.MeshStandardMaterial({ color: 0x7a5c3a, roughness: 0.85 });
  const kistMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, map: kistDoek() });

  // ---- het MG-nest aan de waterkant: een ring zandzakken, een MG 42 op een driepoot, een munitiekist ----
  const mg = plek(NOMERCY5.mg);
  const nest = new THREE.Group();
  nest.position.set(mg.x, hoogte(mg.x, mg.z), mg.z);
  nest.rotation.y = Math.atan2(-(NOMERCY5.mgKijk[0] - NOMERCY5.mg[0]), -(NOMERCY5.mgKijk[1] - NOMERCY5.mg[1]));
  groep.add(nest);
  nest.add(zandzakken(jute, 8, 1.35, 2.6));
  const mg42 = new THREE.Group(); mg42.position.set(0, 0.78, -1.05); nest.add(mg42);
  mg42.add(cil(0.035, 0.035, 1.15, metaal, 0, 0, -0.1, 'z', 10));               // de loop met de mantel
  mg42.add(doos(0.09, 0.12, 0.42, metaal, 0, 0, 0.36));                          // het huis
  mg42.add(doos(0.06, 0.1, 0.28, hout, 0, -0.03, 0.66));                         // de kolf
  for (const s of [-1, 1]) {                                                     // de tweepoot
    const poot = cil(0.012, 0.012, 0.42, metaal, s * 0.08, -0.2, -0.45, 'y', 6); poot.rotation.z = s * 0.35; mg42.add(poot);
  }
  nest.add(doos(0.5, 0.28, 0.24, kistMat, 0.8, 0.14, -0.2));

  // ---- de voet van de molen: drie korte muurtjes zandzakken, elk naar het water ----
  const voetPlekken = NOMERCY5.voet.map(plek);
  const kijkWater = { x: M.cx - 60, z: M.cz - 10 };
  for (const v of voetPlekken) {
    const muur = zandzakken(jute, 5, 2.2, 1.1);
    muur.position.set(v.x, hoogte(v.x, v.z), v.z);
    muur.rotation.y = Math.atan2(-(kijkWater.x - v.x), -(kijkWater.z - v.z));
    // het muurtje staat een meter vóór de man (naar het water), hij erachter
    muur.translateZ(1.2);
    groep.add(muur);
  }
  // een paar kisten en een vat bij de loods
  for (const [dx, dz, r] of [[-4, -9, 0.3], [-3.3, -9.6, -0.2]]) {
    const k = doos(0.95, 0.36, 0.48, kistMat, M.cx + dx, 0.18 + hoogte(M.cx + dx, M.cz + dz), M.cz + dz); k.rotation.y = r; groep.add(k);
  }
  groep.add(cil(0.29, 0.29, 0.88, grijs, M.cx - 5.2, 0.44 + hoogte(M.cx - 5.2, M.cz - 8.2), M.cz - 8.2, 'y', 16));

  // ---- de vlaggenmast met de vlag; de vlag zakt (`vlagNeer`) ----
  const vl = plek(NOMERCY5.vlag);
  const mast = new THREE.Group();
  mast.position.set(vl.x, hoogte(vl.x, vl.z), vl.z);
  groep.add(mast);
  mast.add(cil(0.05, 0.07, 6.2, new THREE.MeshStandardMaterial({ color: 0xd9d6cc, roughness: 0.6 }), 0, 3.1, 0, 'y', 10));
  mast.add(cil(0.09, 0.09, 0.08, metaal, 0, 6.24, 0, 'y', 10));
  /*
   Enkelzijdig, met een tweede vlak met de rug ertegen: een tweezijdig materiaal met een kaart vertaalde 's nachts een
   eigen programma (nomercy5test, 216 → 217); deze soort bestaat al overal in de wereld.
  */
  const vlagMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, map: vlagDoek() });
  const vlagGeo = new THREE.PlaneGeometry(1.6, 1.0, 8, 4);
  const vlag = new THREE.Mesh(vlagGeo, vlagMat);
  vlag.castShadow = true;
  const vlagAchter = new THREE.Mesh(vlagGeo, vlagMat);
  vlagAchter.rotation.y = Math.PI;
  vlag.add(vlagAchter);
  const vlagHoog = 5.6, vlagLaag = 1.05;
  vlag.position.set(0.82, vlagHoog, 0);
  mast.add(vlag);
  const vlagBasis = vlagGeo.attributes.position.array.slice();

  // ---- het zoeklicht op de stelling: een trommel op een voet, de bundel en de vlek op het water ----
  const L = opStelling(NOMERCY5.lampHoek, 0.2);
  const lamp = new THREE.Group();
  lamp.position.set(L.x, L.y, L.z);
  groep.add(lamp);
  lamp.add(cil(0.05, 0.08, 0.9, metaal, 0, 0.45, 0, 'y', 8));
  const trommel = new THREE.Group(); trommel.position.set(0, 1.05, 0); lamp.add(trommel);
  trommel.add(cil(0.32, 0.32, 0.55, grijs, 0, 0, 0, 'z', 18));
  const glas = cil(0.29, 0.29, 0.02, new THREE.MeshBasicMaterial({ color: 0xfff6d8 }), 0, 0, -0.285, 'z', 18);
  glas.raycast = () => {};
  trommel.add(glas);
  const plaatje = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.075), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, map: plaatjeDoek('Flakscheinwerfer') }));
  plaatje.position.set(0.33, 0, 0); plaatje.rotation.y = Math.PI / 2; trommel.add(plaatje);
  const bundelMat = new THREE.MeshBasicMaterial({ color: 0xfff1c4, transparent: true, opacity: 0.11, depthWrite: false, side: THREE.DoubleSide });
  // een open kegel van 1 m hoog met de punt boven; in de lus geschaald tot hij van de lamp tot het water reikt
  const bundelGeo = new THREE.CylinderGeometry(0.28, 1, 1, 20, 1, true);
  bundelGeo.translate(0, -0.5, 0);
  const bundel = new THREE.Mesh(bundelGeo, bundelMat);
  bundel.raycast = () => {};
  bundel.renderOrder = 3;
  groep.add(bundel);
  const vlekMat = new THREE.MeshBasicMaterial({ color: 0xfff1c4, transparent: true, opacity: 0.33, depthWrite: false });
  const vlek = new THREE.Mesh(new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2), vlekMat);
  vlek.raycast = () => {};
  vlek.renderOrder = 2;
  groep.add(vlek);
  const zoek = { x: L.x, z: L.z, r: NOMERCY5.zoek.r, t: 0, aan: false };

  // ---- de lichtkogels: een felle kern en een zachte gloed, drie keer ----
  const kernMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const gloedMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.28, depthWrite: false });
  const kernGeo = new THREE.SphereGeometry(0.35, 10, 8), gloedGeo = new THREE.SphereGeometry(2.4, 14, 10);
  const kogels = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group(); g.visible = false;
    const k = new THREE.Mesh(kernGeo, kernMat), h = new THREE.Mesh(gloedGeo, gloedMat);
    k.raycast = () => {}; h.raycast = () => {}; h.renderOrder = 3;
    g.add(k, h); groep.add(g);
    kogels.push({ g, t: -1, x: 0, z: 0, top: 0 });
  }
  let kogelT = 0, kogelI = 0;

  // ---- de sluipschutter: zijn plek op de stelling ----
  const sluip = opStelling(NOMERCY5.sluipHoek);

  /*
   Het zoeklicht bijwerken: de richting zwaait rond het westen, de afstand ademt in en uit. Geeft de vlek terug
   ({ x, z, r }), of null als hij uit staat.
  */
  function werkZoekBij(dt) {
    if (!zoek.aan) { bundel.visible = false; vlek.visible = false; return null; }
    zoek.t += dt;
    const Z = NOMERCY5.zoek;
    const hoek = NOMERCY5.lampHoek + Math.sin(zoek.t * Math.PI * 2 / Z.tijd) * Z.zwaai;
    const d = Z.dicht + (Z.ver - Z.dicht) * (0.5 + 0.5 * Math.sin(zoek.t * Math.PI * 2 / Z.diepTijd + 1.1));
    const x = L.x + Math.cos(hoek) * d, z = L.z + Math.sin(hoek) * d;
    const wy = -0.3;                                             // net boven de waterspiegel (−0,35)
    const ly = L.y + 1.05;
    const dx = x - L.x, dy = wy - ly, dz = z - L.z;
    const lengte = Math.hypot(dx, dy, dz);
    bundel.visible = true; vlek.visible = true;
    bundel.position.set(L.x, ly, L.z);
    bundel.scale.set(Z.r * 0.8, lengte, Z.r * 0.8);
    // de kegel wijst langs −y; draai −y naar de richting van de lamp naar de vlek
    bundel.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(dx / lengte, dy / lengte, dz / lengte));
    vlek.position.set(x, wy, z);
    vlek.scale.set(Z.r, 1, Z.r);
    trommel.rotation.set(Math.atan2(-dy, Math.hypot(dx, dz)) * -1, Math.atan2(-dx, -dz), 0, 'YXZ');
    zoek.x = x; zoek.z = z;
    return { x, z, r: Z.r };
  }
  function werkKogelsBij(dt, aan) {
    const K = NOMERCY5.lichtkogel;
    if (aan) {
      kogelT -= dt;
      if (kogelT <= 0) {
        kogelT = K.om;
        const k = kogels[kogelI++ % kogels.length];
        k.t = 0; k.top = rand(K.hoog[0], K.hoog[1]);
        k.x = M.cx - rand(30, 100); k.z = M.cz + rand(-35, 25);
      }
    }
    for (const k of kogels) {
      if (k.t < 0) { k.g.visible = false; continue; }
      k.t += dt;
      if (k.t > K.duur) { k.t = -1; k.g.visible = false; continue; }
      // een tel omhoog, dan langzaam zakken
      const y = k.t < 1 ? k.top * (1 - (1 - k.t) * (1 - k.t)) : k.top - (k.t - 1) * K.zak;
      k.g.visible = true;
      k.g.position.set(k.x, y, k.z);
      const fel = k.t < 1 ? 0.6 : 1 - Math.max(0, (k.t - K.duur + 1.2) / 1.2);
      k.g.scale.setScalar(0.6 + 0.4 * fel + Math.sin(k.t * 23) * 0.04);
    }
  }
  function vlagNeer(t) {
    const u = Math.max(0, Math.min(1, t));
    vlag.position.y = vlagHoog - (vlagHoog - vlagLaag) * u;
  }
  // de vlag wappert een beetje: de hoekpunten golven, de mastkant staat stil
  let wapperT = 0;
  function wapper(dt) {
    wapperT += dt;
    const p = vlagGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const bx = vlagBasis[i * 3], u = (bx + 0.8) / 1.6;
      p.array[i * 3 + 2] = Math.sin(wapperT * 3.1 + u * 4.2) * 0.09 * u;
    }
    p.needsUpdate = true;
  }

  return {
    groep,
    get zichtbaar() { return groep.visible; },
    toon(v) { groep.visible = !!v; if (!v) { zoek.aan = false; for (const k of kogels) { k.t = -1; k.g.visible = false; } } },
    herstel() { vlagNeer(0); zoek.t = 0; kogelT = 0; for (const k of kogels) { k.t = -1; k.g.visible = false; } },
    zoekAan(v) { zoek.aan = !!v; if (!v) { bundel.visible = false; vlek.visible = false; } },
    get zoekAanStaat() { return zoek.aan; },
    update(dt, { kogels: kogelsAan = false } = {}) {
      if (!groep.visible) return null;
      wapper(dt);
      werkKogelsBij(dt, kogelsAan);
      return werkZoekBij(dt);
    },
    vlagNeer,
    get vlagY() { return vlag.position.y; },
    get vlagHoog() { return vlagHoog; },
    get mg() { return { ...mg }; },
    get mgKijk() { return { x: M.cx + NOMERCY5.mgKijk[0], z: M.cz + NOMERCY5.mgKijk[1] }; },
    get voet() { return voetPlekken.map(v => ({ ...v })); },
    get kijkWater() { return { ...kijkWater }; },
    get vlag() { return { ...vl }; },
    get sluip() { return { ...sluip }; },
    get lamp() { return { ...L }; },
    get vlek() { return zoek.aan ? { x: zoek.x, z: zoek.z, r: zoek.r } : null; },
    get kogelsInLucht() { return kogels.filter(k => k.t >= 0).length; },
  };
}

// ---------------------------------------------------------------- de camera
// een filmcamera op een statief: de body, het objectief, twee filmspoelen en de matte box
export function maakCameraRig() {
  const g = new THREE.Group(); g.name = 'n5Camera';
  const zwart = new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.5, metalness: 0.4 });
  const metaal = new THREE.MeshStandardMaterial({ color: 0x8a8d90, roughness: 0.35, metalness: 0.7 });
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2;
    const poot = cil(0.015, 0.02, 1.25, metaal, Math.cos(a) * 0.25, 0.6, Math.sin(a) * 0.25, 'y', 6);
    poot.rotation.z = Math.cos(a) * 0.22; poot.rotation.x = -Math.sin(a) * 0.22;
    g.add(poot);
  }
  const kop = new THREE.Group(); kop.position.set(0, 1.25, 0); g.add(kop);
  kop.add(doos(0.22, 0.26, 0.42, zwart, 0, 0.1, 0));
  kop.add(cil(0.07, 0.08, 0.24, zwart, 0, 0.1, -0.32, 'z', 14));
  kop.add(doos(0.26, 0.2, 0.04, zwart, 0, 0.1, -0.46));
  for (const z of [-0.1, 0.16]) kop.add(cil(0.13, 0.13, 0.05, zwart, 0, 0.33, z, 'x', 18));
  g.userData.kop = kop;
  return g;
}

// de camera-boot: een sloep met NO MERCY op de spiegel en de camera op het voordek
export function maakCameraBoot(scene) {
  const mesh = bouwSloep({ naam: 'NO MERCY', kleur: 0x2a2b2e, romp: 0xd8d4c8 });
  mesh.visible = false;
  const rig = maakCameraRig();
  rig.position.set(0, 0.32, -1.6);
  mesh.add(rig);
  scene.add(mesh);
  return { mesh, rig, x: 0, z: 0, yaw: 0 };
}

// ---------------------------------------------------------------- het zijspan
/*
 Een motor met zijspan in feldgrau: het frame en het zadel van de scooters uit js/handlangers.js (zodat de
 rijder het stuur kan pakken met `Persoon.opScooter`), een grotere tank en een bak met een eigen wiel rechts.
 De twee mannen komen van buiten (js/verhaal.js: `maakDuitser`).
*/
export function maakZijspan(rijder, bijrijder) {
  const g = new THREE.Group(); g.name = 'n5Zijspan';
  g.visible = false;
  const verf = new THREE.MeshStandardMaterial({ color: 0x5a5f4c, roughness: 0.55, metalness: 0.25 });
  const zwart = new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.7 });
  const wiel = new THREE.TorusGeometry(0.28, 0.07, 6, 16);
  for (const [x, z] of [[0, -0.72], [0, 0.62], [1.05, 0.1]]) { const w = new THREE.Mesh(wiel, zwart); w.rotation.y = Math.PI / 2; w.position.set(x, 0.33, z); g.add(w); }
  for (const [w, h, d, x, y, z] of [[0.3, 0.12, 1.2, 0, 0.42, 0], [0.34, 0.26, 0.5, 0, 0.62, -0.05], [0.12, 0.5, 0.12, 0, 0.62, -0.62]]) {
    g.add(doos(w, h, d, verf, x, y, z));
  }
  const zadel = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.5), zwart); zadel.position.set(0, 0.76, 0.38); g.add(zadel);
  for (const m of stuurDelen(zwart, zwart)) g.add(m);
  // de bak van het zijspan, op een buis naar het frame
  const bak = new THREE.Group(); bak.position.set(1.05, 0.45, 0.1); g.add(bak);
  bak.add(doos(0.66, 0.44, 1.5, verf, 0, 0.22, 0));
  bak.add(doos(0.6, 0.06, 0.5, zwart, 0, 0.46, 0.3));
  g.add(cil(0.03, 0.03, 1.0, zwart, 0.52, 0.4, -0.3, 'x', 6));
  g.add(cil(0.03, 0.03, 1.0, zwart, 0.52, 0.4, 0.5, 'x', 6));
  const zit = new THREE.Group(); zit.position.set(0, 0.36, 0.3); g.add(zit); zit.add(rijder.groep);
  const zitBak = new THREE.Group(); zitBak.position.set(1.05, 0.28, 0.25); g.add(zitBak); zitBak.add(bijrijder.groep);
  rijder.groep.visible = true; bijrijder.groep.visible = true;
  return { mesh: g, rijder, bijrijder, zit, zitBak, s: 0, vuurT: 0, kant: 0, S: SCOOTER };
}
