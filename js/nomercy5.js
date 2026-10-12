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
   - de stafauto (`maakStafauto`): een eigen model, een open stafwagen in de trant van de Kübelwagen, voor
     js/vehicles.js `voegToe({ mesh })`;
   - de zijspannen (`maakZijspan`): een motor in de trant van de BMW R75 met een zijspan, een Duitser aan het stuur en
     een in het zijspan, voor de rit in de stafauto.

 Alles wordt bij het opstarten gebouwd (verborgen) en gebruikt alleen soorten materiaal die er al zijn
 (MeshStandardMaterial, MeshBasicMaterial): er komt tijdens het spelen geen shader bij.
*/
import * as THREE from 'three';
import { doek, doos, cil, juteDoek, kistDoek, verfDoek } from './nomercy.js';
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

// ---------------------------------------------------------------- de stafauto en het zijspan: doeken
/*
 Stap 142, gevraagd: "Geef de stafauto en de zijspan motor meer detail en betere textures", en daarna "bouw anders een
 nieuw speciaal model". De stafauto was een BX in feldgrau; nu is het een eigen model: een open Duitse stafwagen in de
 trant van de Kübelwagen (Typ 82): een kuip van platte panelen met ribbels, vier deurtjes, een schuine voorkap met het
 reservewiel erop, een rechtopstaande voorruit, de opgevouwen kap achterin, vier stoelen, het stuur, koplampen op de
 spatborden met een Notek-camouflagelamp, buisbumpers, een jerrycan en een schop. Het zijspan (BMW R75-achtig) kreeg een
 boxermotor met koelribben, uitlaten, spatborden, een veerzadel, spaakwielen, een kuip van een zijspan met een MG op de
 neus en een reservewiel achterop.

 Alle doeken zijn op canvas getekend. Er komt geen nieuwe soort materiaal bij: alleen MeshStandardMaterial, met of zonder
 kaart, enkelzijdig met een kaart (een tweezijdig materiaal met een kaart vertaalde 's nachts een eigen programma, zie
 de vlag), en het doorzichtige glas zoals dat van de auto's.
*/
const VELD = '#6f7462', VELD_DONKER = '#565a4a', VELD_LICHT = '#8a8e7a';

// de feldgrauwe verf: vlekkerig, met stof onderaan, krassen tot op het metaal en wat roest bij de randen
function verfLaag(c, w, h, { stof = 0.5 } = {}) {
  c.fillStyle = VELD; c.fillRect(0, 0, w, h);
  for (let i = 0; i < w * h / 90; i++) {
    const v = Math.random();
    c.fillStyle = v < 0.5 ? `rgba(60,64,52,${rand(0.03, 0.09)})` : `rgba(150,154,138,${rand(0.03, 0.07)})`;
    c.beginPath(); c.arc(rand(0, w), rand(0, h), rand(2, 12), 0, Math.PI * 2); c.fill();
  }
  // stof en modder: van onder naar boven minder
  const g = c.createLinearGradient(0, h, 0, h * (1 - stof));
  g.addColorStop(0, 'rgba(104,88,62,0.55)'); g.addColorStop(1, 'rgba(104,88,62,0)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    c.fillStyle = `rgba(92,76,52,${rand(0.08, 0.3)})`;
    const y = h - Math.pow(Math.random(), 2.2) * h * stof;
    c.beginPath(); c.arc(rand(0, w), y, rand(1, 5), 0, Math.PI * 2); c.fill();
  }
  // krassen
  for (let i = 0; i < 70; i++) {
    c.strokeStyle = `rgba(190,188,176,${rand(0.15, 0.45)})`; c.lineWidth = rand(0.5, 1.3);
    const x = rand(0, w), y = rand(0, h);
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + rand(-18, 18), y + rand(-4, 4)); c.stroke();
  }
}
function balkenkruis(c, cx, cy, a, b) {
  c.fillStyle = '#ffffff'; c.fillRect(cx - a - 5, cy - b - 5, (a + 5) * 2, (b + 5) * 2); c.fillRect(cx - b - 5, cy - a - 5, (b + 5) * 2, (a + 5) * 2);
  c.fillStyle = '#151515'; c.fillRect(cx - a, cy - b, a * 2, b * 2); c.fillRect(cx - b, cy - a, b * 2, a * 2);
}
/*
 De zijkant van de stafauto. ExtrudeGeometry geeft de zijvlakken uv = (z, y) in meters; de kaart wordt met repeat en
 offset precies over de zijplaat gelegd (STAF.uv), dus wat hier op (z, y) getekend wordt, staat daar op de auto: de
 vier deurtjes met hun naden, scharnieren en hendels, de ribbels in de onderbouw, het balkenkruis en de stof onderaan.
*/
const STAF = {
  L: 3.74, B: 1.56, R: 0.345, as: 1.20, spoor: 0.69,
  zij: { z0: -1.87, z1: 1.87, y0: 0.30, y1: 1.02 },      // het vlak waar het zijdoek overheen ligt
  riem: 0.98,                                             // de bovenrand van de kuip
  ruit: { z: -0.62, y0: 0.98, h: 0.46 },                  // de voorruit
  oog: { x: -0.36, y: 1.32, z: -0.1 },                    // de ogen van de bestuurder (js/main.js zet daar de camera)
};
function stafZijDoek() {
  const Z = STAF.zij, W = 1024, H = Math.round(W * (Z.y1 - Z.y0) / (Z.z1 - Z.z0));
  return doek(W, H, (c, w, h) => {
    verfLaag(c, w, h, { stof: 0.45 });
    const X = (z) => (z - Z.z0) / (Z.z1 - Z.z0) * w, Y = (y) => (1 - (y - Z.y0) / (Z.y1 - Z.y0)) * h;
    // de ribbels in de onderbouw: twee lange persnaden, licht boven en donker onder
    for (const y of [0.55, 0.64]) {
      c.fillStyle = 'rgba(40,42,34,0.55)'; c.fillRect(X(-1.7), Y(y) + 2, X(1.7) - X(-1.7), 3);
      c.fillStyle = 'rgba(170,172,156,0.45)'; c.fillRect(X(-1.7), Y(y) - 1, X(1.7) - X(-1.7), 2);
    }
    // de deurtjes: voor van −0,62 tot 0,02, achter van 0,08 tot 0,74, tussen de dorpel en de riem
    for (const [a, b] of [[-0.62, 0.02], [0.08, 0.74]]) {
      c.strokeStyle = 'rgba(28,30,24,0.85)'; c.lineWidth = 3;
      c.strokeRect(X(a), Y(0.96), X(b) - X(a), Y(0.47) - Y(0.96));
      c.strokeStyle = 'rgba(160,162,146,0.5)'; c.lineWidth = 1;
      c.strokeRect(X(a) + 3, Y(0.96) + 3, X(b) - X(a) - 6, Y(0.47) - Y(0.96) - 6);
      // twee scharnieren aan de voorkant en een hendel aan de achterkant
      c.fillStyle = '#2b2d26';
      for (const y of [0.88, 0.58]) c.fillRect(X(a) - 4, Y(y) - 6, 10, 12);
      c.fillRect(X(b) - 30, Y(0.86) - 3, 22, 6);
    }
    // het balkenkruis op het achterdeurtje, en een tactisch teken (staf) op de voorste
    balkenkruis(c, X(0.41), Y(0.72), 30, 9);
    // (symmetrisch: het zijdoek ligt aan beide kanten, en aan de rechterkant gespiegeld; een vlaggetje aan een stok werd daar een 9)
    c.strokeStyle = '#efece2'; c.lineWidth = 3;
    const tx = X(-0.3), ty = Y(0.80);
    c.strokeRect(tx - 18, ty - 10, 36, 20); c.beginPath(); c.moveTo(tx - 18, ty - 10); c.lineTo(tx + 18, ty + 10);
    c.moveTo(tx + 18, ty - 10); c.lineTo(tx - 18, ty + 10); c.moveTo(tx, ty + 10); c.lineTo(tx, ty + 26); c.stroke();
    // de wielkasten: een donkere rand en roest
    for (const z of [-STAF.as, STAF.as]) {
      c.strokeStyle = 'rgba(40,30,20,0.55)'; c.lineWidth = 6;
      c.beginPath(); c.arc(X(z), Y(0.345), (X(0.44) - X(0)), Math.PI, Math.PI * 2); c.stroke();
    }
  });
}
// de voorkap: verf, de luchtsleuven onder de ruit en de spanbanden van het reservewiel
function stafKapDoek() {
  return doek(512, 512, (c, w, h) => {
    verfLaag(c, w, h, { stof: 0.15 });
    c.strokeStyle = 'rgba(28,30,24,0.7)'; c.lineWidth = 3;
    c.strokeRect(10, 10, w - 20, h - 20);
    for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(25,27,22,0.75)'; c.fillRect(w * 0.18 + i * w * 0.11, 26, w * 0.07, 14); }
    c.fillStyle = 'rgba(40,36,28,0.8)'; c.fillRect(w * 0.47, 0, w * 0.06, h);
  });
}
// het motordeksel achter: de koelsleuven van de luchtgekoelde motor, en het kenteken van de Wehrmacht
function stafAchterDoek() {
  return doek(512, 512, (c, w, h) => {
    verfLaag(c, w, h, { stof: 0.25 });
    c.strokeStyle = 'rgba(28,30,24,0.75)'; c.lineWidth = 3; c.strokeRect(12, 12, w - 24, h - 24);
    for (let r = 0; r < 4; r++) for (let i = 0; i < 9; i++) {
      const x = w * 0.12 + i * w * 0.085, y = h * 0.12 + r * h * 0.09;
      c.fillStyle = 'rgba(18,19,16,0.85)'; c.fillRect(x, y, w * 0.055, h * 0.05);
      c.fillStyle = 'rgba(160,162,146,0.45)'; c.fillRect(x, y + h * 0.05, w * 0.055, 2);
    }
    // het divisieteken: een verzonnen teken, een witte ruit met een streep erdoor (een Y in een rondje leek op een automerk)
    c.strokeStyle = '#efece2'; c.lineWidth = 6;
    const dx = w * 0.78, dy = h * 0.72;
    c.beginPath(); c.moveTo(dx, dy - 36); c.lineTo(dx + 30, dy); c.lineTo(dx, dy + 36); c.lineTo(dx - 30, dy); c.closePath(); c.stroke();
    c.beginPath(); c.moveTo(dx, dy - 22); c.lineTo(dx, dy + 22); c.stroke();
  });
}
function kentekenDoek(tekst) {
  return doek(256, 64, (c, w, h) => {
    c.fillStyle = '#e9e6dc'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#151515'; c.lineWidth = 5; c.strokeRect(3, 3, w - 6, h - 6);
    c.fillStyle = '#151515'; c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(tekst, w / 2, h / 2 + 2);
  });
}
// een band: het loopvlak met noppen (het veldprofiel), donker rubber met stof
function bandDoek() {
  return doek(256, 64, (c, w, h) => {
    c.fillStyle = '#1e1e1c'; c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) {
      c.fillStyle = '#2c2b28'; c.fillRect(x + 2, 6, 10, h / 2 - 9); c.fillRect(x + 10, h / 2 + 3, 10, h / 2 - 9);
    }
    for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(120,104,80,${rand(0.05, 0.2)})`; c.fillRect(rand(0, w), rand(0, h), rand(1, 4), rand(1, 3)); }
  });
}
// de velg van de stafauto: een schijfwiel met een naafdop en vijf moeren, in feldgrau
function velgDoek() {
  return doek(256, 256, (c, w, h) => {
    c.fillStyle = '#1b1b19'; c.fillRect(0, 0, w, h);
    const g = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.48);
    g.addColorStop(0, VELD_LICHT); g.addColorStop(0.55, VELD); g.addColorStop(0.92, VELD_DONKER); g.addColorStop(1, '#1b1b19');
    c.fillStyle = g; c.beginPath(); c.arc(w / 2, h / 2, w * 0.46, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#3d3f35'; c.beginPath(); c.arc(w / 2, h / 2, w * 0.16, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; c.fillStyle = '#25261f'; c.beginPath(); c.arc(w / 2 + Math.cos(a) * w * 0.22, h / 2 + Math.sin(a) * w * 0.22, 7, 0, Math.PI * 2); c.fill(); }
  });
}
// een spaakwiel voor het zijspan: velgrand, veertig spaken, de naaf
function spaakDoek() {
  return doek(256, 256, (c, w, h) => {
    c.fillStyle = '#1b1b19'; c.fillRect(0, 0, w, h);
    c.strokeStyle = VELD; c.lineWidth = 14; c.beginPath(); c.arc(w / 2, h / 2, w * 0.43, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#9a9c94'; c.lineWidth = 1.6;
    for (let i = 0; i < 40; i++) {
      const a = i / 40 * Math.PI * 2, b = a + (i % 2 ? 0.35 : -0.35);
      c.beginPath(); c.moveTo(w / 2 + Math.cos(b) * w * 0.07, h / 2 + Math.sin(b) * w * 0.07); c.lineTo(w / 2 + Math.cos(a) * w * 0.41, h / 2 + Math.sin(a) * w * 0.41); c.stroke();
    }
    c.fillStyle = VELD_DONKER; c.beginPath(); c.arc(w / 2, h / 2, w * 0.09, 0, Math.PI * 2); c.fill();
  });
}
// leer: bruin, gerimpeld, met stiksels
function leerDoek() {
  return doek(256, 256, (c, w, h) => {
    c.fillStyle = '#4a3423'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? '30,20,12' : '110,82,58'},${rand(0.05, 0.16)})`; c.fillRect(rand(0, w), rand(0, h), rand(2, 9), 1); }
    c.strokeStyle = 'rgba(190,170,130,0.5)'; c.setLineDash([5, 5]); c.lineWidth = 1.5;
    c.strokeRect(10, 10, w - 20, h - 20); c.setLineDash([]);
  });
}
// het zeil van de opgevouwen kap en de stoelen: grof katoen in olijf
function zeilDoek() {
  return doek(256, 256, (c, w, h) => {
    c.fillStyle = '#5d5c45'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) { c.fillStyle = `rgba(40,40,28,${rand(0.05, 0.14)})`; c.fillRect(0, y, w, 1); }
    for (let x = 0; x < w; x += 3) { c.fillStyle = `rgba(120,118,92,${rand(0.03, 0.09)})`; c.fillRect(x, 0, 1, h); }
    for (let i = 0; i < 14; i++) { c.strokeStyle = 'rgba(30,30,20,0.35)'; c.lineWidth = rand(1, 3); c.beginPath(); c.moveTo(rand(0, w), 0); c.lineTo(rand(0, w), h); c.stroke(); }
  });
}
// de jerrycan: de drie pershoeken in een X, de verf en "Wehrmacht 1943"
function jerrycanDoek() {
  return doek(256, 256, (c, w, h) => {
    verfLaag(c, w, h, { stof: 0.2 });
    c.strokeStyle = 'rgba(30,32,26,0.6)'; c.lineWidth = 8;
    c.beginPath(); c.moveTo(20, 20); c.lineTo(w - 20, h - 20); c.moveTo(w - 20, 20); c.lineTo(20, h - 20); c.stroke();
    c.strokeStyle = 'rgba(160,162,146,0.4)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(24, 16); c.lineTo(w - 16, h - 24); c.moveTo(w - 24, 16); c.lineTo(16, h - 24); c.stroke();
    c.fillStyle = 'rgba(232,228,210,0.8)'; c.font = 'bold 18px sans-serif'; c.textAlign = 'center';
    c.fillText('Wehrmacht', w / 2, h * 0.86); c.fillText('1943', w / 2, h * 0.94);
  });
}
// het dashboard: de snelheidsmeter, twee schakelaars en een typeplaatje
function dashDoek() {
  return doek(256, 64, (c, w, h) => {
    verfLaag(c, w, h, { stof: 0 });
    c.fillStyle = '#121210'; c.beginPath(); c.arc(w * 0.32, h / 2, 22, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#d8d4c4'; c.lineWidth = 1.5; c.beginPath(); c.arc(w * 0.32, h / 2, 17, Math.PI * 0.8, Math.PI * 2.2); c.stroke();
    c.beginPath(); c.moveTo(w * 0.32, h / 2); c.lineTo(w * 0.32 + 12, h / 2 - 8); c.stroke();
    for (const x of [0.55, 0.63]) { c.fillStyle = '#1b1b19'; c.beginPath(); c.arc(w * x, h / 2, 6, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#2b2d26'; c.fillRect(w * 0.72, h * 0.3, w * 0.18, h * 0.4);
  });
}

// de gedeelde materialen (één keer, bij het opstarten: een auto die je later krijgt gebruikt dezelfde)
let MAT5 = null;
function mat5() {
  if (MAT5) return MAT5;
  const kaart = (t, rx = 1, ry = 1, ox = 0, oy = 0) => { t.repeat.set(rx, ry); t.offset.set(ox, oy); return t; };
  const Z = STAF.zij;
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0.15, ...o });
  MAT5 = {
    // de zijplaten krijgen uv = (z, y) in meters: de kaart over het vlak van Z leggen
    zij: std({ color: 0xffffff, map: kaart(stafZijDoek(), 1 / (Z.z1 - Z.z0), 1 / (Z.y1 - Z.y0), -Z.z0 / (Z.z1 - Z.z0), -Z.y0 / (Z.y1 - Z.y0)) }),
    kap: std({ color: 0xffffff, map: stafKapDoek() }),
    achter: std({ color: 0xffffff, map: stafAchterDoek() }),
    // (het doek van de Flak is lichter dan het zijdoek van de stafauto: met een tint ertegen staan ze naast elkaar gelijk)
    verf: std({ color: 0xb2b6a4, map: verfDoek() }),
    veld: std({ color: 0x6f7462 }),
    donker: std({ color: 0x2a2c26, roughness: 0.6, metalness: 0.4 }),
    zwart: std({ color: 0x171716, roughness: 0.85, metalness: 0.1 }),
    chroom: std({ color: 0x9a9c94, roughness: 0.3, metalness: 0.8 }),
    band: std({ color: 0xffffff, roughness: 0.95, metalness: 0, map: kaart(bandDoek(), 3, 1) }),
    velg: std({ color: 0xffffff, map: velgDoek() }),
    spaak: std({ color: 0xffffff, map: spaakDoek() }),
    leer: std({ color: 0xffffff, roughness: 0.6, metalness: 0, map: leerDoek() }),
    zeil: std({ color: 0xffffff, roughness: 0.95, metalness: 0, map: zeilDoek() }),
    jerry: std({ color: 0xffffff, map: jerrycanDoek() }),
    dash: std({ color: 0xffffff, map: dashDoek() }),
    // (stap 145) de wijzerplaat en de naald van de snelheidsmeter, voor het interieur
    klok: std({ color: 0xffffff, map: klokDoek(), roughness: 0.5, metalness: 0 }),
    wijzer: std({ color: 0xe8e2c8, roughness: 0.4, metalness: 0, emissive: 0x2a2618 }),
    hout: std({ color: 0x7a5a3a, roughness: 0.85, metalness: 0 }),
    lens: std({ color: 0xd8d6c8, roughness: 0.2, metalness: 0.3 }),
    rem: new THREE.MeshStandardMaterial({ color: 0xff2a1a, emissive: 0xff2010, emissiveIntensity: 1.4, roughness: 0.4 }),
    achterlicht: std({ color: 0x5a1410, roughness: 0.3 }),
    glas: new THREE.MeshStandardMaterial({ color: 0xa8bcc4, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.3 }),
    kenteken: std({ color: 0xffffff, roughness: 0.6, metalness: 0, map: kentekenDoek('WH-217 402') }),
    kentekenZ: std({ color: 0xffffff, roughness: 0.6, metalness: 0, map: kentekenDoek('WH-48 113') }),
    // de spatborden van het zijspan: tweezijdig zonder kaart (zoals de helmen), want je ziet ze van onder en van boven
    bord: new THREE.MeshStandardMaterial({ color: 0x6f7462, roughness: 0.6, metalness: 0.25, side: THREE.DoubleSide }),
    // de opdruk op de kuip: dezelfde soort als de beplakking van de ambulance
    kruis: new THREE.MeshStandardMaterial({ map: kruisDoek(), transparent: true, alphaTest: 0.35, roughness: 0.45, polygonOffset: true, polygonOffsetFactor: -2 }),
  };
  return MAT5;
}

// een zijplaat van de kuip: het zijprofiel als vorm (z, y), met de wielkasten erin, 3 cm dik
function zijplaatGeo() {
  const s = new THREE.Shape();
  const a = STAF.as, r = 0.43;
  s.moveTo(-1.84, 0.40);
  s.lineTo(-1.87, 0.62); s.lineTo(-1.80, 0.74);                 // de neus
  s.lineTo(-0.66, STAF.riem);                                    // de kap naar de voorruit
  s.lineTo(0.92, STAF.riem);                                     // de riem langs de deurtjes
  s.lineTo(1.80, 0.82); s.lineTo(1.87, 0.66); s.lineTo(1.84, 0.42); // het motordeksel en de achterkant
  // de onderrand, met de achterste wielkast
  s.lineTo(a + r, 0.42); s.absarc(a, 0.36, r, 0.14, Math.PI - 0.14, false);
  s.lineTo(-a + r, 0.42); s.absarc(-a, 0.36, r, 0.14, Math.PI - 0.14, false);
  s.lineTo(-1.84, 0.40);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false, curveSegments: 14 });
  // de vorm ligt in (x = z, y = y): draaien zodat x naar z wijst, en de dikte naar opzij
  g.rotateY(-Math.PI / 2);
  return g;
}

/*
 De stafauto: een eigen model voor js/vehicles.js `voegToe({ mesh })`, met dezelfde userData als de auto's van
 js/carmodel.js: `bak` (de carrosserie, die overhelt), `wielen` ({ groep, band, stuur }), `R`, `length`, `oog` en
 `glas` (de voorruit, die uitgaat als je erin zit). De neus wijst naar −z; de grond ligt op 0.
*/
export function maakStafauto() {
  const M = mat5();
  const g = new THREE.Group(); g.name = 'stafauto';
  const bak = new THREE.Group(); g.add(bak);
  const B = STAF.B / 2;
  const plaat = zijplaatGeo();
  for (const kant of [-1, 1]) {
    const p = new THREE.Mesh(plaat, M.zij);
    p.position.x = kant * B + (kant < 0 ? 0.03 : 0);
    p.castShadow = true; p.receiveShadow = true;
    bak.add(p);
  }
  // de voorkap: een schuine plaat van de neus naar de voorruit
  const kapA = { z: -1.80, y: 0.74 }, kapB = { z: -0.66, y: STAF.riem };
  const kapL = Math.hypot(kapB.z - kapA.z, kapB.y - kapA.y), kapHoek = Math.atan2(kapB.y - kapA.y, kapB.z - kapA.z);
  const kap = doos(STAF.B, 0.03, kapL, M.kap, 0, (kapA.y + kapB.y) / 2, (kapA.z + kapB.z) / 2);
  kap.rotation.x = -kapHoek; bak.add(kap);           // (een positieve draai om x laat +z dalen; de kap loopt naar achter op)
  // de neus (verticaal) en de bodem
  bak.add(doos(STAF.B, 0.24, 0.03, M.verf, 0, 0.52, -1.855));
  bak.add(doos(STAF.B - 0.06, 0.03, 3.4, M.donker, 0, 0.43, 0));
  // het motordeksel achter, schuin, met de koelsleuven
  const dekA = { z: 0.92, y: STAF.riem }, dekB = { z: 1.80, y: 0.82 };
  const dekL = Math.hypot(dekB.z - dekA.z, dekB.y - dekA.y), dekHoek = Math.atan2(dekB.y - dekA.y, dekB.z - dekA.z);
  const dek = doos(STAF.B, 0.03, dekL, M.achter, 0, (dekA.y + dekB.y) / 2, (dekA.z + dekB.z) / 2);
  dek.rotation.x = -dekHoek; bak.add(dek);
  bak.add(doos(STAF.B, 0.18, 0.03, M.verf, 0, 0.74, 1.86));
  // de ribbel om de kuip: een omgezette rand bovenop de zijkanten en een dwarsbalk achter de voorstoelen
  for (const kant of [-1, 1]) bak.add(doos(0.05, 0.03, 1.6, M.veld, kant * (B - 0.01), STAF.riem + 0.015, 0.13));
  // het dashboard en het schutbord
  bak.add(doos(STAF.B - 0.08, 0.22, 0.03, M.verf, 0, 0.88, -0.66));
  const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.15), M.dash);
  dash.position.set(-0.35, 0.9, -0.64); bak.add(dash);
  // de voorruit: een buizen frame met het glas, rechtop
  const R0 = STAF.ruit;
  for (const kant of [-1, 1]) bak.add(cil(0.018, 0.018, R0.h, M.donker, kant * (B - 0.05), R0.y0 + R0.h / 2, R0.z, 'y', 8));
  bak.add(cil(0.018, 0.018, STAF.B - 0.08, M.donker, 0, R0.y0 + R0.h, R0.z, 'x', 8));
  const glas = new THREE.Mesh(new THREE.BoxGeometry(STAF.B - 0.14, R0.h - 0.05, 0.012), M.glas);
  glas.position.set(0, R0.y0 + R0.h / 2, R0.z); glas.raycast = () => {};
  bak.add(glas);
  // het stuur (links), op een kolom
  const stuur = new THREE.Group(); stuur.position.set(-0.36, 1.02, -0.42); stuur.rotation.x = -0.95; bak.add(stuur);
  // (stap 145) de rand, de spaken en de claxon draaien mee met het sturen: zie `maakStafBinnen`
  const draai = new THREE.Group(); stuur.add(draai);
  draai.add(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.014, 6, 24), M.zwart));
  draai.add(doos(0.32, 0.018, 0.018, M.zwart, 0, 0, 0));
  draai.add(doos(0.018, 0.17, 0.018, M.zwart, 0, -0.085, 0));
  draai.add(cil(0.035, 0.035, 0.03, M.donker, 0, 0, 0.012, 'z', 14));
  const kolom = cil(0.02, 0.02, 0.4, M.zwart, -0.36, 0.9, -0.53, 'y', 8); kolom.rotation.x = 0.6; bak.add(kolom);   // van het stuur schuin naar het dashboard
  // vier stoelen: twee kuipstoelen voor, een bank achter, van zeil op een buizen frame
  const stoel = (x, z, b) => {
    const s = new THREE.Group(); s.position.set(x, 0.45, z); bak.add(s);
    s.add(doos(b, 0.09, 0.44, M.zeil, 0, 0.12, 0));
    const rug = doos(b, 0.46, 0.08, M.zeil, 0, 0.38, 0.22); rug.rotation.x = 0.12; s.add(rug);
    for (const dx of [-b / 2 + 0.03, b / 2 - 0.03]) s.add(cil(0.012, 0.012, 0.2, M.donker, dx, 0.05, 0, 'y', 6));
  };
  stoel(-0.36, -0.18, 0.46); stoel(0.36, -0.18, 0.46); stoel(0, 0.62, 1.30);
  // de opgevouwen kap achter de bank: een rol zeil en de twee spriegels
  const rol = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, STAF.B - 0.4, 4, 12), M.zeil);
  rol.rotation.z = Math.PI / 2; rol.position.set(0, 1.06, 0.98); rol.castShadow = true; bak.add(rol);
  for (const dz of [0.9, 1.05]) bak.add(cil(0.012, 0.012, STAF.B - 0.04, M.donker, 0, 1.0, dz, 'x', 6));
  // de koplampen op de spatborden, met een Notek-camouflagelamp links op het spatbord
  for (const kant of [-1, 1]) {
    const lamp = new THREE.Group(); lamp.position.set(kant * 0.56, 0.88, -1.48); bak.add(lamp);
    lamp.add(cil(0.09, 0.09, 0.12, M.veld, 0, 0, 0, 'z', 16));
    lamp.add(cil(0.08, 0.08, 0.01, M.lens, 0, 0, -0.065, 'z', 16));
    lamp.add(cil(0.02, 0.03, 0.08, M.donker, 0, -0.08, 0.02, 'y', 6));
  }
  const notek = new THREE.Group(); notek.position.set(-0.66, 0.84, -1.68); bak.add(notek);
  notek.add(cil(0.055, 0.055, 0.07, M.veld, 0, 0, 0, 'z', 12));
  notek.add(doos(0.08, 0.012, 0.01, M.lens, 0, -0.01, -0.04));
  // de bumpers: een buis met twee steunen, voor en achter
  for (const [z, y] of [[-1.95, 0.45], [1.94, 0.46]]) {
    bak.add(cil(0.035, 0.035, STAF.B - 0.1, M.donker, 0, y, z, 'x', 10));
    for (const kant of [-1, 1]) bak.add(cil(0.02, 0.02, 0.1, M.donker, kant * 0.45, y, z + (z < 0 ? 0.06 : -0.06), 'z', 6));
  }
  // de kentekens (voor op de bumper, achter onder het motordeksel) en de achterlichten met remlicht
  const kv = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.11), M.kenteken); kv.position.set(0, 0.6, -1.875); kv.rotation.y = Math.PI; bak.add(kv);
  const ka = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.11), M.kentekenZ); ka.position.set(0, 0.62, 1.877); bak.add(ka);
  for (const kant of [-1, 1]) bak.add(doos(0.08, 0.05, 0.02, M.achterlicht, kant * 0.6, 0.76, 1.875));
  const rem = new THREE.Group(); rem.visible = false; bak.add(rem);
  for (const kant of [-1, 1]) rem.add(doos(0.08, 0.05, 0.01, M.rem, kant * 0.6, 0.76, 1.888));
  // de jerrycan op het motordeksel, de schop langs de linkerkant, en een antenne achter
  const jerry = doos(0.34, 0.47, 0.16, M.jerry, 0.42, 1.1, 1.3); jerry.rotation.x = -dekHoek * 0.6; bak.add(jerry);
  bak.add(doos(0.03, 0.04, 0.03, M.donker, 0.42, 1.36, 1.3));
  // de schop ligt langs de linkerflank, op de dorpel onder de deurtjes: de steel naar achter, het blad naar voren
  const schop = new THREE.Group(); schop.position.set(-B - 0.025, 0.52, 0.12); bak.add(schop);
  schop.add(cil(0.016, 0.016, 0.8, M.hout, 0, 0, 0.12, 'z', 6));
  schop.add(doos(0.012, 0.18, 0.22, M.donker, 0, 0, -0.38));
  bak.add(cil(0.006, 0.012, 1.7, M.donker, 0.68, 1.65, 1.6, 'y', 6));
  bak.add(cil(0.03, 0.03, 0.06, M.donker, 0.68, 0.82, 1.6, 'y', 8));
  // het reservewiel op de voorkap, plat op de schuine plaat
  const reserve = maakWiel5(M.velg);
  reserve.rotation.x = -kapHoek; reserve.rotation.z = Math.PI / 2;
  reserve.position.set(0, (kapA.y + kapB.y) / 2 + 0.11, (kapA.z + kapB.z) / 2 + 0.02);
  bak.add(reserve);
  // de vier wielen: de voorste sturen, alle vier rollen (vehicles.zetNeer)
  const wielen = [[-STAF.spoor, -STAF.as, true], [STAF.spoor, -STAF.as, true], [-STAF.spoor, STAF.as, false], [STAF.spoor, STAF.as, false]].map(([x, z, stuurt]) => {
    const groep = new THREE.Group(); groep.position.set(x, STAF.R, z); g.add(groep);
    const band = maakWiel5(M.velg, x < 0 ? -1 : 1); groep.add(band);
    return { groep, band, stuur: stuurt };
  });
  // (stap 145) het interieur voor wie erin zit en uit zijn ogen kijkt; js/main.js zet het aan en roept `update` aan
  const binnen = maakStafBinnen(draai);
  binnen.groep.visible = false;
  bak.add(binnen.groep);
  g.userData = { length: STAF.L, bak, glas, wielen, rem, R: STAF.R, oog: STAF.oog, stafauto: true, binnen };
  return g;
}

/*
 De stafauto van binnen (stap 145, gevraagd: "Heeft de auto ook een interieur voor first person view? Zo niet, bouw dit
 dan"). Er stond al een dashboard, een stuur en vier stoelen, maar niets bewoog en de binnenkant van de zijplaten
 droeg het zijdoek van buiten, gespiegeld. Dit is wat je ziet als je erin zit en uit je ogen kijkt (V), net als het
 interieur van de gewone auto's (js/autobinnen.js): `groep` staat uit tot js/main.js hem aanzet, `update(car, dt)` zet
 het stuur en de naald van de snelheidsmeter.

 - binnenpanelen in veldgrijs over de zijplaten, met een deurgreep;
 - de snelheidsmeter als echte klok over de getekende op het dashboard: wijzerplaat tot 100 km/u, een rand, een naald;
 - twee schakelaars, een handgreep voor de bijrijder, drie pedalen, de pook en de handrem tussen de stoelen;
 - een binnenspiegel boven aan het ruitframe.
 Alleen MeshStandardMaterial, enkelzijdig: geen nieuw programma (tools/stafautotest.mjs).
*/
const KLOK = { x: -0.461, y: 0.9, z: -0.636, r: 0.052, max: 100 };      // over de getekende klok van dashDoek
function klokDoek() {
  return doek(128, 128, (c, w, h) => {
    const m = w / 2;
    c.fillStyle = '#141412'; c.beginPath(); c.arc(m, m, m, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#d9d4c0'; c.fillStyle = '#d9d4c0'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = 'bold 15px sans-serif';
    for (let v = 0; v <= KLOK.max; v += 10) {
      const a = stafKlokHoek(v / KLOK.max);
      const lang = v % 20 === 0;
      c.lineWidth = lang ? 3 : 1.5;
      c.beginPath(); c.moveTo(m + Math.cos(a) * (m - 4), m - Math.sin(a) * (m - 4));
      c.lineTo(m + Math.cos(a) * (m - (lang ? 16 : 11)), m - Math.sin(a) * (m - (lang ? 16 : 11))); c.stroke();
      if (lang) c.fillText(String(v), m + Math.cos(a) * (m - 30), m - Math.sin(a) * (m - 30));
    }
    c.font = 'bold 12px sans-serif'; c.fillText('km/h', m, m + 30);
  });
}
// de hoek van de naald bij een fractie van de schaal: van linksonder (225°) met de klok mee naar rechtsonder (−45°)
export function stafKlokHoek(f) { return Math.PI * 1.25 - Math.max(0, Math.min(1, f)) * Math.PI * 1.5; }

export function maakStafBinnen(draai = null) {
  const M = mat5();
  const groep = new THREE.Group(); groep.name = 'stafBinnen';
  const B = STAF.B / 2;
  // binnenpanelen: van het schutbord tot het motorschot, van de vloer tot de riem, naar binnen gekeerd
  const pz0 = -0.64, pz1 = 0.9, py0 = 0.46, py1 = STAF.riem - 0.01;
  const paneelGeo = new THREE.PlaneGeometry(pz1 - pz0, py1 - py0);
  for (const kant of [-1, 1]) {
    const p = new THREE.Mesh(paneelGeo, M.verf);
    p.position.set(kant * (B - 0.035), (py0 + py1) / 2, (pz0 + pz1) / 2);
    p.rotation.y = kant > 0 ? -Math.PI / 2 : Math.PI / 2;
    p.name = 'binnenpaneel';
    groep.add(p);
    // de naad van het deurtje en een greep
    groep.add(doos(0.012, py1 - py0 - 0.06, 0.012, M.donker, kant * (B - 0.045), (py0 + py1) / 2, 0.02));
    groep.add(doos(0.025, 0.02, 0.12, M.chroom, kant * (B - 0.05), STAF.riem - 0.12, -0.3));
  }
  // de snelheidsmeter: een wijzerplaat met een rand, en een naald die om het midden draait
  const plaat = new THREE.Mesh(new THREE.CircleGeometry(KLOK.r, 32), M.klok);
  plaat.position.set(KLOK.x, KLOK.y, KLOK.z); plaat.name = 'klok';
  groep.add(plaat);
  const rand = new THREE.Mesh(new THREE.TorusGeometry(KLOK.r + 0.004, 0.006, 6, 32), M.chroom);
  rand.position.set(KLOK.x, KLOK.y, KLOK.z + 0.002); groep.add(rand);
  const naald = new THREE.Group(); naald.position.set(KLOK.x, KLOK.y, KLOK.z + 0.004); naald.name = 'naald';
  const wijzer = doos(KLOK.r * 0.85, 0.004, 0.002, M.wijzer, KLOK.r * 0.42, 0, 0);
  naald.add(wijzer); naald.add(cil(0.006, 0.006, 0.004, M.donker, 0, 0, 0, 'z', 10));
  naald.rotation.z = stafKlokHoek(0);
  groep.add(naald);
  // twee schakelaars en het lampje, over de getekende
  for (const x of [-0.319, -0.269]) groep.add(cil(0.009, 0.009, 0.025, M.donker, x, KLOK.y, KLOK.z + 0.01, 'z', 10));
  // de handgreep voor de bijrijder, boven op het dashboard
  groep.add(cil(0.012, 0.012, 0.36, M.chroom, 0.36, 1.04, -0.64, 'x', 8));
  for (const dx of [-0.17, 0.17]) groep.add(cil(0.01, 0.01, 0.05, M.chroom, 0.36 + dx, 1.015, -0.64, 'y', 6));
  // drie pedalen voor de bestuurder, schuin op de vloer
  for (const [x, b] of [[-0.48, 0.06], [-0.38, 0.06], [-0.27, 0.07]]) {
    const ped = doos(b, 0.09, 0.012, M.zwart, x, 0.53, -0.55); ped.rotation.x = 0.5; groep.add(ped);
    groep.add(cil(0.008, 0.008, 0.12, M.donker, x, 0.56, -0.6, 'y', 6));
  }
  // de pook en de handrem tussen de stoelen
  const pook = cil(0.009, 0.009, 0.32, M.donker, 0, 0.6, -0.36, 'y', 8); pook.rotation.x = -0.25; groep.add(pook);
  groep.add(new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), M.zwart).translateX(0).translateY(0.76).translateZ(-0.4));
  const rem = cil(0.012, 0.012, 0.26, M.donker, 0.05, 0.56, -0.05, 'y', 8); rem.rotation.x = 1.0; groep.add(rem);
  // de binnenspiegel boven aan het ruitframe, naar achteren gekeerd
  const R0 = STAF.ruit;
  groep.add(cil(0.006, 0.006, 0.05, M.donker, 0, R0.y0 + R0.h - 0.03, R0.z + 0.01, 'y', 6));
  groep.add(doos(0.17, 0.055, 0.015, M.donker, 0, R0.y0 + R0.h - 0.075, R0.z + 0.02));
  groep.add(doos(0.155, 0.042, 0.004, M.chroom, 0, R0.y0 + R0.h - 0.075, R0.z + 0.029));

  let getoond = 0;
  function update(car, dt = 1 / 60) {
    if (draai) draai.rotation.z = -((car && car.steer) || 0) * 4.2;
    const kmu = Math.abs((car && car.speed) || 0) * 3.6;
    getoond += (Math.min(1, kmu / KLOK.max) - getoond) * Math.min(1, dt * 8);
    naald.rotation.z = stafKlokHoek(getoond);
  }
  return { groep, naald, draai, update };
}
// een wiel: de band (een cilinder met het loopvlak en twee afgeronde schouders) en de velg, de as langs x
function maakWiel5(velgMat, kant = 1, R = STAF.R, breed = 0.16) {
  const M = mat5();
  const w = new THREE.Group();
  const loop = new THREE.Mesh(new THREE.CylinderGeometry(R, R, breed, 28, 1, true), M.band);
  loop.rotation.z = Math.PI / 2; loop.castShadow = true; w.add(loop);
  for (const s of [-1, 1]) {
    const schouder = new THREE.Mesh(new THREE.TorusGeometry(R - 0.035, 0.035, 8, 28), M.zwart);
    schouder.rotation.y = Math.PI / 2; schouder.position.x = s * (breed / 2 - 0.01); w.add(schouder);
  }
  const velg = new THREE.Mesh(new THREE.CircleGeometry(R - 0.06, 24), velgMat);
  velg.rotation.y = kant * Math.PI / 2; velg.position.x = kant * (breed / 2 - 0.005); w.add(velg);
  const binnen = new THREE.Mesh(new THREE.CircleGeometry(R - 0.06, 18), M.donker);
  binnen.rotation.y = -kant * Math.PI / 2; binnen.position.x = -kant * (breed / 2 - 0.005); w.add(binnen);
  return w;
}

// ---------------------------------------------------------------- het zijspan
/*
 Een motor met zijspan in de trant van de BMW R75. Het frame, het stuur en het zadel van de scooters uit
 js/handlangers.js (`stuurDelen`, `SCOOTER`), zodat de rijder het stuur kan pakken met `Persoon.opScooter`; daaromheen
 een eigen motor: spaakwielen met noppenbanden, spatborden, een vork, een druppeltank met kniestukken, een boxermotor
 met twee cilinders opzij vol koelribben, twee uitlaten met dempers, een koplamp met Notek-kap, een veerzadel en een
 duozit. Het zijspan: een kuip met een opening, een MG 34 op een draaipunt op de neus, een reservewiel achterop, het
 balkenkruis en een kenteken. Neus naar −z, grond op 0.
*/
export function maakZijspan(rijder, bijrijder) {
  const M = mat5();
  const g = new THREE.Group(); g.name = 'n5Zijspan';
  g.visible = false;
  const R = 0.3;
  const wielOp = (x, z, kant) => { const w = maakWiel5(M.spaak, kant, R, 0.11); w.position.set(x, R, z); g.add(w); return w; };
  wielOp(0, -0.74, 1); wielOp(0, 0.62, 1); wielOp(1.08, 0.12, 1);
  // spatborden: een halve open cilinder boven elk wiel (tweezijdig zonder kaart, zoals de helmen)
  for (const [x, z, van, lang] of [[0, -0.74, -0.2, Math.PI * 0.75], [0, 0.62, 0.15, Math.PI * 0.8], [1.08, 0.12, 0.1, Math.PI * 0.8]]) {
    const geo = new THREE.CylinderGeometry(R + 0.06, R + 0.06, 0.15, 18, 1, true, van, lang);
    const b = new THREE.Mesh(geo, M.bord); b.rotation.z = Math.PI / 2; b.position.set(x, R, z); b.castShadow = true; g.add(b);
  }
  // de vork en het frame: buizen
  for (const s of [-1, 1]) {
    const v = cil(0.022, 0.022, 0.62, M.donker, s * 0.08, 0.6, -0.68, 'y', 8); v.rotation.x = 0.35; g.add(v);
  }
  for (const [x0, y0, z0, x1, y1, z1, r] of [
    [0, 0.84, -0.56, 0, 0.78, 0.36, 0.024],   // de bovenbuis
    [0, 0.84, -0.56, 0, 0.32, -0.12, 0.026],  // de voorbuis naar de motor
    [0, 0.32, -0.12, 0, 0.34, 0.62, 0.024],   // de onderbuis naar de achteras
    [0, 0.78, 0.36, 0, 0.34, 0.62, 0.022],    // de achtervork
    [0.05, 0.4, -0.2, 1.08, 0.38, -0.2, 0.022], [0.05, 0.4, 0.45, 1.08, 0.38, 0.45, 0.022], // de buizen naar het zijspan
  ]) {
    const d = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
    const b = cil(r, r, d, M.donker, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, 'y', 8);
    b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3((x1 - x0) / d, (y1 - y0) / d, (z1 - z0) / d));
    g.add(b);
  }
  // de tank: een afgeplatte druppel met de vuldop en de kniestukken
  const tank = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), M.verf);
  tank.scale.set(0.16, 0.12, 0.34); tank.position.set(0, 0.86, -0.18); tank.castShadow = true; g.add(tank);
  g.add(cil(0.03, 0.03, 0.025, M.chroom, 0, 0.98, -0.26, 'y', 10));
  for (const s of [-1, 1]) { const k = doos(0.02, 0.1, 0.16, M.zwart, s * 0.15, 0.84, -0.08); g.add(k); }
  // de boxermotor: het carter en twee cilinders opzij met koelribben en een kop
  g.add(doos(0.26, 0.24, 0.32, M.donker, 0, 0.42, -0.12));
  for (const s of [-1, 1]) {
    for (let i = 0; i < 6; i++) g.add(cil(0.085, 0.085, 0.014, M.donker, s * (0.16 + i * 0.026), 0.46, -0.24, 'x', 14));
    g.add(doos(0.09, 0.16, 0.16, M.veld, s * 0.34, 0.46, -0.24));
    // de uitlaat: van de kop omlaag en naar achter, met een demper
    const u = cil(0.02, 0.02, 0.86, M.zwart, s * 0.2, 0.28, 0.18, 'z', 8); g.add(u);
    g.add(cil(0.045, 0.04, 0.32, M.zwart, s * 0.2, 0.3, 0.62, 'z', 10));
  }
  // de koplamp met de Notek-kap, en het kenteken op het voorspatbord
  const kop = cil(0.075, 0.075, 0.1, M.veld, 0, 0.92, -0.66, 'z', 14); g.add(kop);
  g.add(doos(0.12, 0.03, 0.02, M.zwart, 0, 0.95, -0.72));
  const kv = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.07), M.kenteken); kv.position.set(0, 0.66, -1.02); kv.rotation.y = Math.PI; kv.rotation.x = -0.5; g.add(kv);
  // het zadel (stuur en zadel van de scooters, zodat de rijder goed zit) met veren, en de duozit
  const zadel = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.42), M.leer); zadel.position.set(0, 0.78, 0.36); g.add(zadel);
  for (const s of [-1, 1]) g.add(cil(0.02, 0.02, 0.1, M.chroom, s * 0.09, 0.7, 0.48, 'y', 6));
  g.add(doos(0.24, 0.06, 0.24, M.leer, 0, 0.74, 0.72));
  for (const m of stuurDelen(M.zwart, M.zwart)) g.add(m);
  // het zijspan: de kuip, de opening, de neus met de MG, een reservewiel achterop, balkenkruis en kenteken
  const kuip = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.9, 6, 16), M.verf);
  kuip.rotation.x = Math.PI / 2; kuip.scale.set(1, 1, 0.78); kuip.position.set(1.08, 0.62, 0.08); kuip.castShadow = true; g.add(kuip);
  const gat = new THREE.Mesh(new THREE.CircleGeometry(1, 20), M.zwart);
  gat.rotation.x = -Math.PI / 2; gat.scale.set(0.22, 0.34, 1); gat.position.set(1.08, 0.86, 0.18); g.add(gat);
  g.add(doos(0.5, 0.04, 0.05, M.leer, 1.08, 0.86, -0.18));                          // de rand van de opening
  const mgVoet = cil(0.02, 0.02, 0.2, M.donker, 1.08, 0.94, -0.36, 'y', 8); g.add(mgVoet);
  const mg = new THREE.Group(); mg.position.set(1.08, 1.05, -0.38); g.add(mg);
  mg.add(cil(0.02, 0.02, 0.72, M.donker, 0, 0, -0.26, 'z', 8));
  mg.add(cil(0.032, 0.032, 0.36, M.zwart, 0, 0, -0.14, 'z', 10));
  mg.add(doos(0.06, 0.09, 0.3, M.donker, 0, 0, 0.12));
  mg.add(doos(0.05, 0.08, 0.2, M.hout, 0, -0.02, 0.34));
  mg.add(cil(0.07, 0.07, 0.05, M.donker, 0.07, -0.03, 0.04, 'x', 14));            // de trommel
  const res = maakWiel5(M.spaak, 1, R, 0.11); res.rotation.y = Math.PI / 2; res.position.set(1.08, 0.62, 0.94); g.add(res);   // achter de kuip (die loopt tot z = 0,83)
  const kruis = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.26), M.kruis);
  kruis.rotation.y = Math.PI / 2; kruis.position.set(1.08 + 0.305, 0.62, 0.05); kruis.raycast = () => {}; g.add(kruis);
  const ka = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.07), M.kentekenZ); ka.position.set(0, 0.52, 0.94); g.add(ka);
  // de mannen: de rijder op het zadel van de scooters, de bijrijder in de kuip
  const zit = new THREE.Group(); zit.position.set(0, 0.36, 0.3); g.add(zit); zit.add(rijder.groep);
  const zitBak = new THREE.Group(); zitBak.position.set(1.08, 0.4, 0.22); g.add(zitBak); zitBak.add(bijrijder.groep);
  rijder.groep.visible = true; bijrijder.groep.visible = true;
  return { mesh: g, rijder, bijrijder, zit, zitBak, s: 0, vuurT: 0, kant: 0, S: SCOOTER };
}
// het balkenkruis als losse opdruk (voor het zijspan: de kuip is een draaivorm, daar past geen zijdoek op)
function kruisDoek() {
  return doek(128, 128, (c, w, h) => { c.clearRect(0, 0, w, h); balkenkruis(c, w / 2, h / 2, 46, 14); });
}
