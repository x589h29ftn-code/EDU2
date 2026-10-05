/*
 Wat de wijk levendiger maakt (stap 113). Gevraagd op 3 okt 2026: "Voeg random her en der inderdaad
 een feestje in de tuin (heel toevallig, niet vaak), een pizzascooter van Pizzeria Sneek of
 Cappadocia, een plezierboot op de Geeuw."

 Het tuinfeest
   Van FEEST.van tot FEEST.tot uur komt er met kans FEEST.kans per FEEST.elke seconden een feestje
   in een tuin (een tegelvlak uit de kaart, `tuinvlakken`) op FEEST.min–FEEST.max meter van je,
   uit beeld. Zeven, acht man rond een tafel met drank, lampionnen in een kring (die 's avonds
   gloeien) en muziek die je tot tachtig meter hoort. Wie schiet in de buurt, laat ze wegrennen;
   na FEEST.duur seconden, of als je ver weg bent, is het uit, en dan uit beeld weg.

 De pizzascooter
   Rond etenstijd (PIZZA.tijden) komt er om de zoveel minuten een bezorger op een scooter, met een
   pizzadoos van Pizzeria Sneek (rood) of Cappadocia (blauw met goud) achterop. Hij begint ver weg
   op een weg die je niet ziet, rijdt over de weg naar een adres (`huisnummers`) bij jou in de
   buurt, zet de scooter neer, loopt met de doos naar de deur en terug, en rijdt weer weg. Hij is
   met een auto aan te rijden, en dan valt hij om.

 De plezierboot
   Overdag (BOOT.van–BOOT.tot) vaart de "Zondagskind", een sloep met vier man en een vlag, heen en
   weer over de Geeuw tussen de Geeuwkade en IJlst (js/vaart.js `vaarRoute`), op vier meter per
   seconde, en ligt aan elk eind even stil. 's Avonds ligt hij aan de Geeuwkade.
*/
import * as THREE from 'three';
import { Persoon } from './persoon.js';
import { grondHoogte, resolveCollisions } from './world.js';
import { lijnDoor } from './schaduw.js';
import { profiel, puntOp } from './inval.js';
import { bouwSloep, SLOEP, LIGPLAATSEN } from './boot.js';
import { vaarRoute } from './vaart.js';
import { inBouwvlak } from './bouwvlak.js';
import { geluid } from './audio.js';
import { maakVuilniswagen } from './vuilniswagen.js';
import { zoekLooppad } from './looppad.js';

export const FEEST = { van: 15, tot: 1.5, elke: 45, kans: 0.07, min: 110, max: 280, duur: 600, gasten: 8 };
export const PIZZA = { tijden: [[11.5, 14], [16.5, 23.5]], elke: [150, 330], van: 280, tot: 420, top: 11, adresVan: 40, adresTot: 260, lopen: 1.8, wachtT: 6 };
export const BOOT = { van: 10, tot: 20, snel: 4, wachtT: 30 };
// stap 124: de vuilniswagen 's ochtends, en het terras bij de Poiesz in IJlst overdag
export const VUILNIS = { van: 7, tot: 10.5, elke: [200, 420], van_: 260, tot_: 420, top: 7, stopOm: 38, stopT: 5 };
export const TERRAS = { van: 10, tot: 18.5, gasten: 5 };

const KLEUREN = [0x2f4a7a, 0x8a2f3a, 0x2f6a3a, 0xd8c23a, 0x6a3a8a, 0xe08a3a, 0x3a8aa0, 0xf0f0f0, 0x222222];
const HUID = [0xd9b48f, 0xc79a72, 0xe0bfa0, 0x8d5f3f, 0xd2a77f];
const HAAR = [0x2a1d12, 0x5a3a22, 0x9a8a72, 0x111111, 0xb08a52, 0xc8a060];

// ---- doeken ----
function doosDoek(merk) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  const cap = merk === 'Cappadocia';
  g.fillStyle = cap ? '#1f2f5a' : '#f4efe6'; g.fillRect(0, 0, 256, 256);
  if (!cap) {
    // een groen-wit-rode band, zoals de Italiaanse vlag
    [['#2a8a3a', 0], ['#f4efe6', 85], ['#c8202a', 170]].forEach(([k, x]) => { g.fillStyle = k; g.fillRect(x, 200, 86, 30); });
  } else {
    g.strokeStyle = '#d6b04a'; g.lineWidth = 8; g.strokeRect(14, 14, 228, 228);
  }
  g.fillStyle = cap ? '#d6b04a' : '#c8202a';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 44px Georgia, serif';
  g.fillText(cap ? 'Cappadocia' : 'Pizzeria', 128, cap ? 110 : 90);
  g.font = 'bold 40px Georgia, serif';
  g.fillText(cap ? 'Sneek' : 'Sneek', 128, cap ? 160 : 145);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function vlagDoek() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 42;
  const g = c.getContext('2d');
  [['#ae1c28', 0], ['#ffffff', 14], ['#21468b', 28]].forEach(([k, y]) => { g.fillStyle = k; g.fillRect(0, y, 64, 14); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// in een bepaald tijdvak (ook over middernacht heen)
const binnen = (uur, van, tot) => van <= tot ? uur >= van && uur < tot : uur >= van || uur < tot;

export function initLeven({ scene, KAART, sfeer = null, vehicles = null, poiesz = null }) {
  if (!KAART) return null;
  const nacht = () => !!(sfeer && sfeer.nacht);

  // ================================================================ het tuinfeest
  const feestGroep = new THREE.Group(); feestGroep.name = 'tuinfeest'; feestGroep.visible = false;
  scene.add(feestGroep);
  const gasten = [];
  for (let i = 0; i < FEEST.gasten; i++) {
    const p = new Persoon({ shirt: KLEUREN[i % KLEUREN.length], broek: i % 3 ? 0x24303f : 0x3a3a3a, huid: HUID[i % HUID.length], haar: HAAR[(i * 2) % HAAR.length],
      hoogte: 0.94 + (i % 4) * 0.025, korteMouw: i % 2 === 0 });
    feestGroep.add(p.groep);
    gasten.push({ p, x: 0, z: 0, yaw: 0, neer: false, omT: 0, vlucht: null, vastT: 0, binnen: false, dans: Math.random() * 6 });
  }
  // de tafel met drank
  const tafel = new THREE.Group();
  {
    const hout = new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.8 });
    const blad = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 0.8), hout); blad.position.y = 0.75; tafel.add(blad);
    for (const [x, z] of [[-0.8, -0.32], [0.8, -0.32], [-0.8, 0.32], [0.8, 0.32]]) {
      const poot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.75, 0.06), hout); poot.position.set(x, 0.375, z); tafel.add(poot);
    }
    const fles = new THREE.MeshStandardMaterial({ color: 0x2f6a2f, roughness: 0.2, metalness: 0.1 });
    const blik = new THREE.MeshStandardMaterial({ color: 0xc8c8cc, roughness: 0.3, metalness: 0.7 });
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, i % 2 ? 0.12 : 0.28, 8), i % 2 ? blik : fles);
      m.position.set(-0.6 + i * 0.24, 0.775 + (i % 2 ? 0.06 : 0.14), (i % 3 - 1) * 0.18);
      tafel.add(m);
    }
  }
  feestGroep.add(tafel);
  // lampionnen in een kring, aan een draad van paaltje naar paaltje
  const lampionMats = [0xff5a3a, 0xffc23a, 0x5ac8ff, 0x8aff6a, 0xff6ad2].map(k => new THREE.MeshStandardMaterial({ color: k, emissive: k, emissiveIntensity: 0.3, roughness: 0.6 }));
  const lampions = [];
  const lampGeo = new THREE.SphereGeometry(0.14, 10, 8);
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(lampGeo, lampionMats[i % lampionMats.length]);
    feestGroep.add(m); lampions.push(m);
  }
  const feest = { aan: false, x: 0, z: 0, t: 0, keurT: FEEST.elke, beatT: 0, tel: 0, gevlucht: false, aantal: 0, plek: null };

  function vrijeTuin(sp) {
    const kandidaten = [];
    for (const t of KAART.tuinvlakken || []) {
      if (t.m !== 'tegels' || !t.r || t.r.length < 3) continue;
      let cx = 0, cz = 0; for (const [x, z] of t.r) { cx += x; cz += z; } cx /= t.r.length; cz /= t.r.length;
      const d = Math.hypot(cx - sp.x, cz - sp.z);
      if (d < FEEST.min || d > FEEST.max) continue;
      // groot genoeg: de kleinste maat van het vlak
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const [x, z] of t.r) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
      if (Math.min(maxX - minX, maxZ - minZ) < 4.5) continue;
      if (inBouwvlak(cx, cz)) continue;
      kandidaten.push({ x: cx, z: cz, r: Math.min(2.8, Math.min(maxX - minX, maxZ - minZ) / 2 - 0.6) });
    }
    // de eerste waar iedereen vrij kan staan
    for (let i = kandidaten.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [kandidaten[i], kandidaten[j]] = [kandidaten[j], kandidaten[i]]; }
    for (const k of kandidaten.slice(0, 40)) {
      const [rx, rz] = resolveCollisions(k.x, k.z, 1.2);
      if (Math.hypot(rx - k.x, rz - k.z) > 0.05) continue;
      return k;
    }
    return null;
  }
  function begin(plek) {
    feest.aan = true; feest.x = plek.x; feest.z = plek.z; feest.t = 0; feest.gevlucht = false; feest.plek = plek; feest.aantal++;
    const gy = grondHoogte(plek.x, plek.z);
    tafel.position.set(plek.x, gy, plek.z); tafel.rotation.y = Math.random() * Math.PI;
    gasten.forEach((g, i) => {
      const a = i / gasten.length * Math.PI * 2 + Math.random() * 0.3, r = Math.max(1.3, plek.r) * (0.75 + Math.random() * 0.35);
      let x = plek.x + Math.cos(a) * r, z = plek.z + Math.sin(a) * r;
      [x, z] = resolveCollisions(x, z, 0.3);
      g.x = x; g.z = z; g.neer = false; g.omT = 0; g.vlucht = null; g.vastT = 0; g.binnen = false;
      g.p.groep.visible = true; g.p.legNeer(0);
      // naar het midden kijkend, of naar een buur
      g.yaw = Math.atan2(-(plek.x - x), -(plek.z - z)) + (Math.random() - 0.5) * 0.8;
      g.p.zetNeer(x, z, g.yaw);
    });
    lampions.forEach((m, i) => {
      const a = i / lampions.length * Math.PI * 2, r = Math.max(1.6, plek.r + 0.4);
      m.position.set(plek.x + Math.cos(a) * r, gy + 2.15 + Math.sin(i * 1.7) * 0.08, plek.z + Math.sin(a) * r);
    });
    feestGroep.visible = true;
  }
  function eindFeest() { feest.aan = false; feestGroep.visible = false; }
  function feestVlucht(x, z) {
    if (!feest.aan || feest.gevlucht) return;
    feest.gevlucht = true;
    for (const g of gasten) {
      if (g.neer) continue;
      let dx = g.x - x, dz = g.z - z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
      g.vlucht = { x: g.x + dx * 40, z: g.z + dz * 40 };
    }
  }
  function werkFeestBij(dt, sp, ziet, uur) {
    if (!feest.aan) {
      feest.keurT -= dt;
      if (feest.keurT <= 0) {
        feest.keurT = FEEST.elke;
        if (binnen(uur, FEEST.van, FEEST.tot) && Math.random() < FEEST.kans) {
          const plek = vrijeTuin(sp);
          if (plek && !ziet(plek.x, plek.z)) begin(plek);
        }
      }
      return;
    }
    feest.t += dt;
    const d = Math.hypot(feest.x - sp.x, feest.z - sp.z);
    // uit: na de duur, buiten de tijd, of gevlucht; dan weg zodra je het niet ziet
    const klaar = feest.t > FEEST.duur || !binnen(uur, FEEST.van, FEEST.tot) || feest.gevlucht || d > 450;
    if (klaar && !ziet(feest.x, feest.z)) { eindFeest(); return; }
    // de lampionnen gloeien 's avonds
    const gloei = nacht() ? 2.4 : 0.3;
    for (const m of lampionMats) m.emissiveIntensity = gloei;
    // de muziek
    if (!feest.gevlucht) {
      feest.beatT -= dt;
      if (feest.beatT <= 0) { feest.beatT += 0.5; feest.tel++; if (d < 85) geluid.feestTik(d, feest.tel); }
    }
    if (d > 200) return;
    for (const g of gasten) {
      const p = g.p;
      if (g.neer) { if (g.omT < 1) { g.omT = Math.min(1, g.omT + dt * 2); p.legNeer(g.omT); } continue; }
      if (g.binnen) continue;
      if (g.vlucht) {
        const pos = p.groep.position, dx = g.vlucht.x - pos.x, dz = g.vlucht.z - pos.z, dd = Math.hypot(dx, dz);
        if (dd > 0.4) {
          const stap = Math.min(dd, 5 * dt);
          const [nx, nz] = resolveCollisions(pos.x + dx / dd * stap, pos.z + dz / dd * stap, 0.3);
          // een tuin heeft een schutting en een huis eromheen: wie vastloopt, rent het huis in
          if (Math.hypot(nx - pos.x, nz - pos.z) < stap * 0.3) g.vastT += dt; else g.vastT = 0;
          pos.x = nx; pos.z = nz; p.draaiNaar(Math.atan2(-dx, -dz), dt, 8);
          if (g.vastT > 0.8) { g.binnen = true; p.groep.visible = false; continue; }
        }
        p.update(dt, { loopt: dd > 0.4, snelheid: 5 });
        g.x = pos.x; g.z = pos.z;
        continue;
      }
      // dansen: op de tel een wipje, af en toe de arm omhoog
      g.dans += dt;
      p.update(dt, { zwaait: Math.sin(g.dans * 0.7) > 0.85 });
      p.groep.position.y = p.grond + Math.abs(Math.sin(feest.tel * Math.PI / 2 + g.dans)) * 0.04;
      p.draaiNaar(g.yaw + Math.sin(g.dans * 0.9) * 0.3, dt, 2);
    }
  }

  // ================================================================ de pizzascooter
  const scooter = new THREE.Group(); scooter.name = 'pizzascooter'; scooter.visible = false;
  scene.add(scooter);
  const romp = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.35, metalness: 0.2 });
  const zwart = new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.7 });
  {
    const wiel = new THREE.TorusGeometry(0.2, 0.06, 6, 14);
    for (const z of [-0.62, 0.55]) { const w = new THREE.Mesh(wiel, zwart); w.rotation.y = Math.PI / 2; w.position.set(0, 0.26, z); scooter.add(w); }
    const vloer = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.8), romp); vloer.position.set(0, 0.32, 0.02); scooter.add(vloer);
    const kap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.34, 0.6), romp); kap.position.set(0, 0.55, 0.42); scooter.add(kap);
    const zadel = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.5), zwart); zadel.position.set(0, 0.76, 0.38); scooter.add(zadel);
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.7, 0.12), romp); front.position.set(0, 0.62, -0.5); front.rotation.x = -0.25; scooter.add(front);
    const stuur = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), zwart); stuur.rotation.z = Math.PI / 2; stuur.position.set(0, 1.0, -0.56); scooter.add(stuur);
  }
  // de pizzadoos achterop (een eigen mesh per merk) en de doos in zijn handen
  const doosGeo = new THREE.BoxGeometry(0.42, 0.36, 0.42);
  const merken = ['Pizzeria Sneek', 'Cappadocia'];
  const doosMat = { 'Pizzeria Sneek': new THREE.MeshStandardMaterial({ map: doosDoek('Pizzeria'), roughness: 0.8 }),
    Cappadocia: new THREE.MeshStandardMaterial({ map: doosDoek('Cappadocia'), roughness: 0.8 }) };
  const achterDoos = new THREE.Mesh(doosGeo, doosMat['Pizzeria Sneek']); achterDoos.position.set(0, 1.0, 0.68); scooter.add(achterDoos);
  const rijder = new Persoon({ shirt: 0x2a2c30, broek: 0x24303f, pet: true, petKleur: 0xc8202a, hoogte: 0.97 });
  rijder.groep.visible = false; scene.add(rijder.groep);
  const handDoos = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.36), doosMat['Pizzeria Sneek']);
  handDoos.position.set(0, 1.1, -0.35); rijder.groep.add(handDoos); handDoos.visible = false;
  const zitPlek = new THREE.Group(); zitPlek.position.set(0, 0.36, 0.3); scooter.add(zitPlek);

  const pizza = { fase: 'weg', merk: merken[0], lijn: null, s: 0, v: 0, prof: null, adres: null, wachtT: 0, volgende: PIZZA.elke[0] * 0.5, ritten: 0,
    bezorgd: 0, omgevallen: false, omT: 0 };

  /*
   Een punt op een weg voor auto's: de dichtstbijzijnde bij (x, z), of op afstand [van, tot]. Alleen
   op de hoogte van het doel (stap 113): de dichtstbijzijnde weg lag soms op het dek van het viaduct,
   vijf meter boven wie er lag, en dan liep de bemanning door de lucht.
  */
  function wegPunt(x, z, { van = 0, tot = 120, weg = null, niet = [] } = {}) {
    const hDoel = grondHoogte(x, z);       // (zoals de voetgangers: het bovenste vlak)
    let beste = null;
    for (const as of KAART.wegassen || []) {
      if (!as.drive) continue;
      for (const q of as.pts) {
        const d = Math.hypot(q[0] - x, q[1] - z);
        if (d < van || d > tot) continue;
        if (weg && Math.hypot(q[0] - weg.x, q[1] - weg.z) < weg.min) continue;
        if (Math.abs(grondHoogte(q[0], q[1]) - hDoel) > 1.5) continue;
        if (niet.some(n => Math.hypot(q[0] - n.x, q[1] - n.z) < 40)) continue;
        const sc = van ? Math.abs(d - (van + tot) / 2) + Math.random() * (60 + niet.length * 60) : d;
        if (!beste || sc < beste.sc) beste = { sc, x: q[0], z: q[1] };
      }
    }
    return beste;
  }
  function kiesAdres(sp) {
    const lijst = (KAART.huisnummers || []).filter(h => { const d = Math.hypot(h.x - sp.x, h.z - sp.z); return d > PIZZA.adresVan && d < PIZZA.adresTot; });
    return lijst.length ? lijst[Math.floor(Math.random() * lijst.length)] : null;
  }
  function startPizza(sp, ziet, { zeker = false } = {}) {
    // (een paar adressen en per adres een paar vertrekpunten: het eerste adres had soms geen weg
    // in de buurt, en zes bijna gelijke vertrekpunten gaven soms alle zes geen route)
    for (let a = 0; a < 5; a++) {
      const adres = kiesAdres(sp);
      if (!adres) return false;
      const aan = wegPunt(adres.x, adres.z, { tot: 60 });
      if (!aan) continue;
      const geprobeerd = [];
      for (let poging = 0; poging < 6; poging++) {
        const b = wegPunt(adres.x, adres.z, { van: PIZZA.van, tot: PIZZA.tot, weg: { x: sp.x, z: sp.z, min: 150 }, niet: geprobeerd });
        if (!b) break;
        geprobeerd.push(b);
        if (!zeker && ziet(b.x, b.z)) continue;
        const L = lijnDoor(KAART, [[b.x, b.z], [aan.x, aan.z]]);
        if (!L || L.n < 4 || L.lengte > 1200) continue;
        if (beginRit(L, adres)) return true;
      }
    }
    return false;
  }
  function beginRit(L, adres) {
    pizza.merk = merken[Math.floor(Math.random() * merken.length)];
    achterDoos.material = doosMat[pizza.merk]; handDoos.material = doosMat[pizza.merk];
    pizza.lijn = L; pizza.s = 0; pizza.v = 0; pizza.prof = profiel(L, { top: PIZZA.top, dwars: 3.2 });
    pizza.adres = adres; pizza.fase = 'heen'; pizza.ritten++; pizza.omgevallen = false; pizza.omT = 0; pizza.pad = null; pizza.deur = null;
    pizza.van = { x: L.x[0], z: L.z[0] };
    scooter.visible = true; achterDoos.visible = true;
    rijder.groep.visible = true; rijder.legNeer(0);
    zitOp();
    return true;
  }
  function zitOp() {
    if (rijder.groep.parent !== zitPlek) { zitPlek.add(rijder.groep); }
    rijder.groep.position.set(0, 0, 0); rijder.groep.rotation.set(0, 0, 0); rijder.yaw = 0;
    handDoos.visible = false;
  }
  function stapAf() {
    scene.add(rijder.groep);
    const zx = Math.cos(scooter.rotation.y), zz = -Math.sin(scooter.rotation.y);
    rijder.zetNeer(scooter.position.x + zx * 0.7, scooter.position.z + zz * 0.7, scooter.rotation.y);
    achterDoos.visible = false; handDoos.visible = true;
    /*
     Naar de deur over een looproute om heggen en schuttingen heen (js/looppad.js).
     Recht op het adres af bleef hij tegen een heg staan, twaalf meter voor de deur.
    */
    const p = rijder.groep.position;
    pizza.deur = deurVan(pizza.adres, p);
    pizza.pad = zoekLooppad({ x: p.x, z: p.z }, pizza.deur);
    pizza.padI = 1;
  }
  /*
   De voordeur. Het adrespunt uit de BGT is de plek van het huisnummer op de kaart,
   en die ligt midden in het pand: daar liep hij naartoe en bleef hij twaalf meter
   ervoor tegen de gevel staan. Nu: het punt van de omtrek van dat pand dat het
   dichtst bij de scooter ligt, een halve meter naar buiten.
  */
  let pandVanId = null;
  function deurVan(adres, vanaf) {
    if (!pandVanId) { pandVanId = new Map(); for (const q of KAART.panden || []) pandVanId.set(q.id, q); }
    const pand = pandVanId.get(adres.pand);
    if (!pand || !pand.voet || pand.voet.length < 3) return { x: adres.x, z: adres.z };
    const V = pand.voet;
    let beste = null;
    for (let i = 0; i < V.length; i++) {
      const [ax, az] = V[i], [bx, bz] = V[(i + 1) % V.length];
      const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez || 1;
      const t = Math.max(0, Math.min(1, ((vanaf.x - ax) * ex + (vanaf.z - az) * ez) / l2));
      const x = ax + ex * t, z = az + ez * t, d = Math.hypot(vanaf.x - x, vanaf.z - z);
      if (!beste || d < beste.d) beste = { x, z, d };
    }
    const k = beste.d || 1;
    return { x: beste.x + (vanaf.x - beste.x) / k * 0.5, z: beste.z + (vanaf.z - beste.z) / k * 0.5 };
  }
  // de looproute af (heen of terug); zonder route recht naar `eind`
  function loopPad(dt, eind) {
    const pad = pizza.pad;
    if (!pad || pizza.padI >= pad.length) return loopNaar(eind, dt);
    const [x, z] = pad[pizza.padI];
    const laatste = pizza.padI === pad.length - 1;
    if (loopNaar({ x, z }, dt)) {
      if (laatste) return true;
      pizza.padI++;
    }
    return false;
  }
  function rij(dt, top) {
    const L = pizza.lijn;
    const i = Math.min(L.n - 1, Math.max(0, Math.round(pizza.s / 2)));
    const doel = Math.min(top, pizza.prof[Math.min(L.n - 1, i + 1)]);
    pizza.v += Math.max(-6 * dt, Math.min(2.5 * dt, doel - pizza.v));
    pizza.v = Math.max(1.2, pizza.v);
    pizza.s = Math.min(L.lengte, pizza.s + pizza.v * dt);
    // rechts van de weg, een meter van de as
    const p = puntOp(L, pizza.s, 1.4);
    scooter.position.set(p.x, grondHoogte(p.x, p.z, scooter.position.y + 1), p.z);
    scooter.rotation.y = p.yaw;
    return pizza.s >= L.lengte - 0.3;
  }
  function loopNaar(doel, dt) {
    const pos = rijder.groep.position, dx = doel.x - pos.x, dz = doel.z - pos.z, d = Math.hypot(dx, dz);
    if (d < 0.6) { rijder.update(dt, {}); return true; }
    const stap = Math.min(d, PIZZA.lopen * dt);
    const [nx, nz] = resolveCollisions(pos.x + dx / d * stap, pos.z + dz / d * stap, 0.3);
    // vast tegen een gevel: dan is hij er
    if (Math.hypot(nx - pos.x, nz - pos.z) < stap * 0.2) { rijder.update(dt, {}); return true; }
    pos.x = nx; pos.z = nz;
    rijder.draaiNaar(Math.atan2(-dx, -dz), dt, 8);
    rijder.update(dt, { loopt: true, snelheid: PIZZA.lopen });
    return false;
  }
  function pizzaWeg() {
    pizza.fase = 'weg'; scooter.visible = false; rijder.groep.visible = false;
    if (rijder.groep.parent !== scene) scene.add(rijder.groep);
    pizza.volgende = PIZZA.elke[0] + Math.random() * (PIZZA.elke[1] - PIZZA.elke[0]);
    geluid.brommer(null);
  }
  function werkPizzaBij(dt, sp, ziet, uur) {
    const tijd = PIZZA.tijden.some(([a, b]) => binnen(uur, a, b));
    if (pizza.fase === 'weg') {
      if (!tijd) return;
      pizza.volgende -= dt;
      if (pizza.volgende <= 0) { if (!startPizza(sp, ziet)) pizza.volgende = 20; }
      return;
    }
    const d = Math.hypot(scooter.position.x - sp.x, scooter.position.z - sp.z);
    if (pizza.omgevallen) {
      geluid.brommer(null);
      if (pizza.omT < 1) { pizza.omT = Math.min(1, pizza.omT + dt * 2); rijder.legNeer(pizza.omT); scooter.rotation.z = pizza.omT * 1.4; }
      if (!ziet(scooter.position.x, scooter.position.z) && d > 60) { scooter.rotation.z = 0; pizzaWeg(); }
      return;
    }
    if (pizza.fase === 'heen' || pizza.fase === 'terug') {
      const klaar = rij(dt, pizza.fase === 'heen' ? PIZZA.top : PIZZA.top * 1.1);
      geluid.brommer(d, pizza.v);
      if (pizza.fase === 'heen' && klaar) { pizza.fase = 'afstappen'; geluid.brommer(null); stapAf(); }
      else if (pizza.fase === 'terug' && (klaar || d > 350) && !ziet(scooter.position.x, scooter.position.z)) pizzaWeg();
      if (pizza.fase === 'terug' || pizza.fase === 'heen') {
        // (een Persoon zet zijn eigen hoogte op de grond; op het zadel hoort hij op nul)
        // (Persoon.update zet y op grond + wip; alleen de wip hoort erbij: dan zit de heup op het zadel)
        rijder.update(dt, { zit: 0.4 });
        rijder.groep.position.set(0, rijder.groep.position.y - rijder.grond, 0);
      }
      return;
    }
    if (pizza.fase === 'afstappen') {
      if (loopPad(dt, pizza.deur || pizza.adres)) { pizza.fase = 'deur'; pizza.wachtT = PIZZA.wachtT; }
      return;
    }
    if (pizza.fase === 'deur') {
      pizza.wachtT -= dt;
      rijder.update(dt, {});
      if (pizza.wachtT < PIZZA.wachtT / 2) handDoos.visible = false;     // afgegeven
      if (pizza.wachtT <= 0) {
        pizza.fase = 'terugLopen'; pizza.bezorgd++;
        // dezelfde route terug, naar de scooter
        if (pizza.pad) { pizza.pad = pizza.pad.slice().reverse(); pizza.padI = 1; }
      }
      return;
    }
    if (pizza.fase === 'staat') {
      rijder.update(dt, {});
      if (!ziet(scooter.position.x, scooter.position.z)) pizzaWeg();
      return;
    }
    if (pizza.fase === 'terugLopen') {
      const zx = Math.cos(scooter.rotation.y), zz = -Math.sin(scooter.rotation.y);
      if (loopPad(dt, { x: scooter.position.x + zx * 0.7, z: scooter.position.z + zz * 0.7 })) {
        // terug naar waar hij vandaan kwam (de pizzeria): die weg bestaat, hij reed hem net
        const x = scooter.position.x, z = scooter.position.z;
        let L = pizza.van ? lijnDoor(KAART, [[x, z], [pizza.van.x, pizza.van.z]]) : null;
        if (!L) { const naar = wegPunt(x, z, { van: 350, tot: 520 }); L = naar ? lijnDoor(KAART, [[x, z], [naar.x, naar.z]]) : null; }
        // geen weg terug: dan blijft hij staan tot je het niet ziet (niet verdwijnen voor je neus)
        if (!L) { pizza.fase = 'staat'; return; }
        pizza.lijn = L; pizza.s = 0; pizza.v = 0; pizza.prof = profiel(L, { top: PIZZA.top * 1.1, dwars: 3.2 });
        achterDoos.visible = true; zitOp(); pizza.fase = 'terug';
      }
    }
  }

  // ================================================================ de plezierboot
  const boot = { groep: null, route: null, s: 0, richting: 1, wachtT: 0, lengte: 0, mensen: [], heen: 0 };
  {
    const L0 = LIGPLAATSEN.find(l => l.naam === 'Geeuw'), L1 = LIGPLAATSEN.find(l => l.naam === 'IJlst');
    const pad = L0 && L1 ? vaarRoute({ x: L0.x, z: L0.z }, { x: L1.x, z: L1.z }, { dun: 1 }) : null;
    if (pad && pad.length > 4) {
      // niet precies op de ligplaatsen van de sloepen van de speler: aan beide kanten wat eraf
      const pts = pad.slice(1, -1);
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      boot.route = { pts, cum };
      boot.lengte = cum[cum.length - 1];
      boot.groep = bouwSloep({ naam: 'Zondagskind', kleur: 0x7a1f2b, romp: 0xf3efe6 });
      boot.groep.name = 'plezierboot';
      scene.add(boot.groep);
      // vier man aan boord, zittend, in houders op de banken
      for (let i = 0; i < 4; i++) {
        const houder = new THREE.Group();
        houder.position.set((i % 2 ? 0.45 : -0.45), (SLOEP.VLOER || 0.2) + 0.05, -0.3 + Math.floor(i / 2) * 1.2);
        const p = new Persoon({ shirt: KLEUREN[(i + 3) % KLEUREN.length], broek: 0x2a2c30, huid: HUID[(i + 1) % HUID.length], haar: HAAR[i % HAAR.length],
          korteMouw: true, pet: i === 0, petKleur: 0xf2f2f2 });
        houder.add(p.groep);
        p.groep.rotation.y = p.yaw = i % 2 ? Math.PI / 2 : -Math.PI / 2;
        boot.groep.add(houder);
        boot.mensen.push(p);
        zitAanBoord(p, 0);   // meteen zittend, ook als je nog ver weg bent
      }
      // de vlag achterop
      const stok = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.1, 6), new THREE.MeshStandardMaterial({ color: 0x6a4a2a }));
      stok.position.set(0, 0.9, 2.2); boot.groep.add(stok);
      const vlag = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.4), new THREE.MeshStandardMaterial({ map: vlagDoek(), side: THREE.DoubleSide, roughness: 0.8 }));
      vlag.position.set(0, 1.25, 2.52); vlag.rotation.y = Math.PI / 2; boot.groep.add(vlag);
      boot.vlag = vlag;
      boot.s = boot.lengte * 0.15;
    }
  }
  /*
   Zittend op de bank. Persoon.update zet y op de grond daar plus de wip van de
   zithouding; in een houder hoort alleen de wip erbij. Eerst werd y tussen −0,2 en
   0,2 geklemd: dan bleef de heup 30 cm boven de bank en stonden ze rechtop.
  */
  function zitAanBoord(m, dt) {
    m.update(dt, { zit: 0.42 });
    m.groep.position.set(0, m.groep.position.y - m.grond, 0);
  }
  function bootPunt(s) {
    const { pts, cum } = boot.route;
    s = Math.max(0, Math.min(boot.lengte, s));
    let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
    const f = (s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
    return { x: pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, z: pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f };
  }
  let bootYaw = 0, klok = 0;
  function werkBootBij(dt, sp, uur) {
    if (!boot.groep) return;
    klok += dt;
    const vaart = binnen(uur, BOOT.van, BOOT.tot);
    if (vaart) {
      if (boot.wachtT > 0) boot.wachtT -= dt;
      else {
        boot.s += boot.richting * BOOT.snel * dt;
        if (boot.s >= boot.lengte || boot.s <= 0) { boot.s = Math.max(0, Math.min(boot.lengte, boot.s)); boot.richting *= -1; boot.wachtT = BOOT.wachtT; boot.heen++; }
      }
    } else if (boot.s > 0) {
      // 's avonds terug naar de Geeuwkade (het begin van de route) en daar liggen
      boot.s = Math.max(0, boot.s - BOOT.snel * dt);
      boot.richting = -1;
    }
    const p = bootPunt(boot.s), q = bootPunt(boot.s + boot.richting * 6);
    const wil = Math.atan2(-(q.x - p.x), -(q.z - p.z));
    let d = wil - bootYaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    bootYaw += d * Math.min(1, dt * 0.8);
    const wy = SLOEP.WATER_Y ?? -0.35;
    boot.groep.position.set(p.x, wy + Math.sin(klok * 1.3) * 0.03, p.z);
    boot.groep.rotation.set(Math.sin(klok * 0.9) * 0.015, bootYaw, Math.sin(klok * 1.1) * 0.02);
    if (boot.vlag) boot.vlag.rotation.y = Math.PI / 2 + Math.sin(klok * 3) * 0.15;
    if (Math.hypot(p.x - sp.x, p.z - sp.z) < 150) for (const m of boot.mensen) zitAanBoord(m, dt);
  }

  // ================================================================ de vuilniswagen (stap 124)
  /*
   Tussen zeven en half elf 's ochtends komt er om de paar minuten een vuilniswagen door een straat bij
   je in de buurt: een groene bakwagen uit js/vehicles.js (`voegToe`, zodat je er niet doorheen rijdt),
   die over een lijn langs de weg rijdt (`lijnDoor`) en om de 38 m vijf tellen stilstaat om de
   kliko's te legen — dat hoor je. Begin en eind liggen buiten je zicht, net als bij de pizzascooter.
  */
  const vuil = { fase: 'weg', lijn: null, prof: null, s: 0, v: 0, volgende: VUILNIS.elke[0] * 0.4, stopT: 0, volgendeStop: VUILNIS.stopOm, ritten: 0, stops: 0, wagen: null };
  const vuilWeg = { x: 1e5, z: 1e5 };
  /*
   Sinds stap 125 een eigen model: de gele DAF van Súdwest-Fryslân (js/vuilniswagen.js), naar foto's van de
   gebruiker. Hij wordt meteen bij het opstarten gemaakt en buiten de wereld geparkeerd, zodat zijn
   materialen meegaan als de shaders vooraf vertaald worden.
  */
  function vuilWagen() {
    if (vuil.wagen || !vehicles) return vuil.wagen;
    vuil.wagen = vehicles.voegToe({ x: vuilWeg.x, z: vuilWeg.z, soort: 'vuilnis', kleur: 0xf4cf12, driveable: false, mesh: maakVuilniswagen() });
    vuil.wagen.vuilnis = true;
    return vuil.wagen;
  }
  vuilWagen();
  function startVuilnis(sp, ziet, { zeker = false } = {}) {
    const w = vuilWagen();
    if (!w) { vuil.reden = 'geen wagen'; return false; }
    vuil.reden = 'geen weg';
    for (let poging = 0; poging < 10; poging++) {
      const a = wegPunt(sp.x, sp.z, { van: 40, tot: 160 });
      const b = wegPunt(sp.x, sp.z, { van: VUILNIS.van_, tot: VUILNIS.tot_, weg: { x: sp.x, z: sp.z, min: 150 } });
      if (!a || !b) continue;
      vuil.reden = 'in zicht';
      if (!zeker && ziet(b.x, b.z)) continue;
      vuil.reden = 'geen route';
      // van ver weg, langs je, en weer ver weg: over het punt bij jou heen
      const c = wegPunt(sp.x, sp.z, { van: VUILNIS.van_, tot: VUILNIS.tot_, weg: { x: b.x, z: b.z, min: 250 } });
      let L = c ? lijnDoor(KAART, [[b.x, b.z], [a.x, a.z], [c.x, c.z]]) : null;
      // lukt de lijn over drie punten niet (een punt op een los stuk weg), dan van ver weg tot bij jou
      if (!L || L.n < 4 || L.lengte > 1800) L = lijnDoor(KAART, [[b.x, b.z], [a.x, a.z]]);
      if (!L || L.n < 4 || L.lengte > 1800) continue;
      vuil.reden = null;
      vuil.lijn = L; vuil.prof = profiel(L, { top: VUILNIS.top, dwars: 2.6 });
      vuil.s = 0; vuil.v = 0; vuil.stopT = 0; vuil.volgendeStop = VUILNIS.stopOm; vuil.fase = 'rijdt'; vuil.ritten++;
      w.hp = 100; w.speed = 0;
      zetWagen();
      return true;
    }
    return false;
  }
  function zetWagen() {
    const w = vuil.wagen, L = vuil.lijn;
    const p = puntOp(L, vuil.s, 1.6);
    w.x = p.x; w.z = p.z; w.yaw = p.yaw; w.speed = vuil.v;
    w.mesh.position.set(p.x, grondHoogte(p.x, p.z, w.mesh.position.y + 1), p.z);
    w.mesh.rotation.y = p.yaw;
  }
  function vuilnisWeg() {
    vuil.fase = 'weg'; vuil.lijn = null;
    vuil.volgende = VUILNIS.elke[0] + Math.random() * (VUILNIS.elke[1] - VUILNIS.elke[0]);
    if (vuil.wagen) { vuil.wagen.x = vuilWeg.x; vuil.wagen.z = vuilWeg.z; vuil.wagen.speed = 0; vuil.wagen.mesh.position.set(vuilWeg.x, 0, vuilWeg.z); }
  }
  function werkVuilnisBij(dt, sp, ziet, uur) {
    if (!vehicles) return;
    if (vuil.fase === 'weg') {
      if (!binnen(uur, VUILNIS.van, VUILNIS.tot)) return;
      vuil.volgende -= dt;
      if (vuil.volgende <= 0) { if (!startVuilnis(sp, ziet)) vuil.volgende = 25; }
      return;
    }
    const w = vuil.wagen;
    // stukgeschoten of in brand: dan is zijn ronde voorbij (het wrak doet js/vehicles.js)
    if (!w || w.hp <= 0 || w.wrak) { vuil.fase = 'weg'; vuil.lijn = null; vuil.volgende = VUILNIS.elke[1]; vuil.wagen = null; return; }
    const d = Math.hypot(w.x - sp.x, w.z - sp.z);
    if (vuil.stopT > 0) {
      vuil.stopT -= dt; vuil.v = 0;
    } else {
      const L = vuil.lijn;
      const i = Math.min(L.n - 1, Math.max(0, Math.round(vuil.s / 2)));
      const doel = Math.min(VUILNIS.top, vuil.prof[Math.min(L.n - 1, i + 1)], vuil.volgendeStop - vuil.s < 6 ? 1.6 : VUILNIS.top);
      vuil.v += Math.max(-4 * dt, Math.min(1.4 * dt, doel - vuil.v));
      vuil.v = Math.max(0.8, vuil.v);
      vuil.s = Math.min(L.lengte, vuil.s + vuil.v * dt);
      if (vuil.s >= vuil.volgendeStop && vuil.s < L.lengte - 20) {
        vuil.stopT = VUILNIS.stopT; vuil.volgendeStop += VUILNIS.stopOm; vuil.stops++;
        if (d < 90 && geluid.kliko) geluid.kliko(d);
      }
    }
    zetWagen();
    if (vuil.s >= vuil.lijn.lengte - 0.5 && (!ziet(w.x, w.z) || d > 300)) vuilnisWeg();
    else if (d > 600 && !ziet(w.x, w.z)) vuilnisWeg();
  }

  // ================================================================ het terras bij de Poiesz (stap 124)
  /*
   Overdag, als het droog is, staan er naast de ingang van de Poiesz in IJlst twee tafels met een
   parasol, en zitten er vijf mensen met een kop koffie. Waar precies wordt bij het opstarten gezocht:
   naast de stoep voor de schuifdeuren, op een plek waar niets in de weg staat en geen rijbaan ligt.
  */
  const terras = { groep: new THREE.Group(), plek: null, gasten: [] };
  terras.groep.name = 'terras'; terras.groep.visible = false;
  scene.add(terras.groep);
  if (poiesz && poiesz.deur && poiesz.f) {
    const f = poiesz.f, r = [-f[1], f[0]];
    const vrij = (x, z) => {
      const [ux, uz] = resolveCollisions(x, z, 1.6);
      if (Math.hypot(ux - x, uz - z) > 0.05) return false;
      for (const as of KAART.wegassen || []) {
        if (!as.drive) continue;
        for (const q of as.pts) if (Math.hypot(q[0] - x, q[1] - z) < 5) return false;
      }
      return true;
    };
    outer: for (const zij of [6, -6, 8, -8, 10, -10, 5, -5]) for (const voor of [0.5, 1.5, 2.5]) {
      const x = poiesz.deur.x + f[0] * (voor + 2) + r[0] * zij, z = poiesz.deur.z + f[1] * (voor + 2) + r[1] * zij;
      const x2 = x + r[0] * Math.sign(zij) * 2.6, z2 = z + r[1] * Math.sign(zij) * 2.6;
      if (vrij(x, z) && vrij(x2, z2)) { terras.plek = { x, z, x2, z2 }; break outer; }
    }
  }
  if (terras.plek) {
    const hout = new THREE.MeshStandardMaterial({ color: 0x9a7a52, roughness: 0.8 });
    const metaal = new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.5, metalness: 0.5 });
    const doek = new THREE.MeshStandardMaterial({ color: 0xc8302a, roughness: 0.85, side: THREE.DoubleSide });
    const blad = new THREE.CylinderGeometry(0.45, 0.45, 0.04, 18), poot = new THREE.CylinderGeometry(0.035, 0.035, 0.74, 8);
    const zitting = new THREE.BoxGeometry(0.42, 0.04, 0.42), leuning = new THREE.BoxGeometry(0.42, 0.42, 0.04), stoelPoot = new THREE.CylinderGeometry(0.018, 0.018, 0.45, 6);
    const kopGeo = new THREE.CylinderGeometry(0.04, 0.035, 0.08, 10), kopMat = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.4 });
    const P = terras.plek;
    let nr = 0;
    for (const [tx, tz] of [[P.x, P.z], [P.x2, P.z2]]) {
      const ty = grondHoogte(tx, tz);
      const t = new THREE.Group(); t.position.set(tx, ty, tz);
      const b = new THREE.Mesh(blad, hout); b.position.y = 0.74; t.add(b);
      const pt = new THREE.Mesh(poot, metaal); pt.position.y = 0.37; t.add(pt);
      // de parasol
      const stok = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.3, 6), metaal); stok.position.y = 1.15; t.add(stok);
      const kap = new THREE.Mesh(new THREE.ConeGeometry(1.35, 0.45, 8, 1, true), doek); kap.position.y = 2.25; t.add(kap);
      // drie of twee stoelen, met iemand erop
      const n = nr === 0 ? 3 : 2;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + nr * 0.6;
        const sx = Math.sin(a) * 0.78, sz = Math.cos(a) * 0.78;
        const stoel = new THREE.Group(); stoel.position.set(sx, 0, sz); stoel.rotation.y = a;
        const zt = new THREE.Mesh(zitting, metaal); zt.position.y = 0.45; stoel.add(zt);
        const ln = new THREE.Mesh(leuning, metaal); ln.position.set(0, 0.68, 0.2); stoel.add(ln);
        for (const [px, pz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) { const q = new THREE.Mesh(stoelPoot, metaal); q.position.set(px, 0.225, pz); stoel.add(q); }
        t.add(stoel);
        const kop = new THREE.Mesh(kopGeo, kopMat); kop.position.set(Math.sin(a) * 0.28, 0.8, Math.cos(a) * 0.28); t.add(kop);
        if (terras.gasten.length < TERRAS.gasten) {
          const i = terras.gasten.length;
          const p = new Persoon({ shirt: KLEUREN[(i + 5) % KLEUREN.length], broek: i % 2 ? 0x24303f : 0x3a3a3a, huid: HUID[(i + 2) % HUID.length], haar: HAAR[(i + 3) % HAAR.length],
            hoogte: 0.95 + (i % 3) * 0.03, korteMouw: i % 2 === 1 });
          // de leuning staat naar buiten; de gast kijkt naar het midden van de tafel (zijn −z)
          p.groep.position.set(tx + sx, ty, tz + sz);
          p.groep.rotation.y = a; p.yaw = a;
          terras.groep.add(p.groep);
          terras.gasten.push({ p, t: Math.random() * 6 });
        }
      }
      terras.groep.add(t);
      nr++;
    }
  }
  function werkTerrasBij(dt, sp, uur) {
    if (!terras.plek) return;
    const aan = binnen(uur, TERRAS.van, TERRAS.tot) && !(sfeer && sfeer.weer === 'regen');
    if (terras.groep.visible !== aan) terras.groep.visible = aan;
    if (!aan) return;
    if (Math.hypot(terras.plek.x - sp.x, terras.plek.z - sp.z) > 120) return;
    for (const g of terras.gasten) { g.t += dt; g.p.update(dt, { zit: 0.46 }); }
  }

  return {
    feest, gasten, pizza, scooter, rijder, boot,
    /*
     Eén beeld. `sp` waar de speler is, `ziet(x, z)` of de camera daar kan kijken, `uur` de klok.
    */
    update(dt, sp, ziet, uur) {
      werkFeestBij(dt, sp, ziet, uur);
      werkPizzaBij(dt, sp, ziet, uur);
      werkBootBij(dt, sp, uur);
      werkVuilnisBij(dt, sp, ziet, uur);
      werkTerrasBij(dt, sp, uur);
    },
    // stap 124: de vuilniswagen en het terras
    get vuilnis() { return { reden: vuil.reden, fase: vuil.fase, ritten: vuil.ritten, stops: vuil.stops, wagen: vuil.wagen, s: vuil.s, v: vuil.v, stil: vuil.stopT > 0, lengte: vuil.lijn ? vuil.lijn.lengte : 0 }; },
    startVuilnis: (sp, opties) => startVuilnis(sp, () => false, opties), vuilnisWeg,
    get terras() { return { aan: terras.groep.visible, plek: terras.plek, gasten: terras.gasten.length, groep: terras.groep }; },
    // een schot of een knal: wie op het feest staat rent weg
    schrik(x, z) { if (feest.aan && Math.hypot(feest.x - x, feest.z - z) < 60) feestVlucht(x, z); },
    // een auto: gasten op het feest en de bezorger (te voet of op de scooter) gaan omver
    aanrijden(x, z, straal = 1.5, snelheid = 0) {
      if (snelheid < 3.5) return 0;
      let n = 0;
      if (feest.aan) for (const g of gasten) {
        if (g.neer) continue;
        const q = g.p.groep.position;
        if (Math.hypot(q.x - x, q.z - z) < straal) { g.neer = true; g.omT = 0; n++; feestVlucht(x, z); }
      }
      if (pizza.fase !== 'weg' && !pizza.omgevallen) {
        const q = rijder.groep.parent === scene ? rijder.groep.position : scooter.position;
        if (Math.hypot(q.x - x, q.z - z) < straal + 0.4) {
          pizza.omgevallen = true; pizza.omT = 0; n++;
          if (rijder.groep.parent !== scene) stapAf();
        }
      }
      return n;
    },
    // de kogel van de speler (js/main.js): gasten en de bezorger
    doelen() {
      const uit = [];
      // (wie het huis in rende is weg; three raakt ook wat onzichtbaar is)
      if (feest.aan) for (const g of gasten) if (!g.neer && !g.binnen) uit.push(g.p.groep);
      if (pizza.fase !== 'weg' && !pizza.omgevallen) uit.push(rijder.groep);
      return uit;
    },
    raak(obj) {
      for (let o = obj; o; o = o.parent) {
        const g = feest.aan && gasten.find(q => q.p.groep === o);
        if (g && !g.neer) {
          g.neer = true; g.omT = 0; feestVlucht(g.x, g.z);
          return { x: g.p.groep.position.x, z: g.p.groep.position.z, herstel: () => { g.neer = false; g.omT = 0; g.p.legNeer(0); } };
        }
        if (o === rijder.groep && pizza.fase !== 'weg' && !pizza.omgevallen) {
          pizza.omgevallen = true; pizza.omT = 0;
          if (rijder.groep.parent !== scene) stapAf();
          const q = rijder.groep.position;
          return { x: q.x, z: q.z, herstel: null };
        }
      }
      return null;
    },
    // voor de proeven
    beginFeest: (plek) => begin(plek), vrijeTuin, eindFeest, startPizza, pizzaWeg,
    bootPunt: (s) => boot.route ? bootPunt(s) : null,
  };
}
