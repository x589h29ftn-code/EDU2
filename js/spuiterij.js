/*
 De wasboxen achter BP Slump Oil — en wat je er écht doet.

 Op het terrein achter het tankstation aan de Lemmerweg staan drie wasboxen: een
 rij hokken onder één doorlopend dak, met de groene band van BP erboven en
 "JET WASH" erop (foto's Street View, chat 14 sep 2026). In het echt zijn het
 open boxen met alleen zijschotten. Hier zijn het **gesloten** boxen met een
 roldeur, en dat is met opzet: een gesloten deur is het hele idee.

 Wat er gebeurt:

   1. Je rijdt er met de auto naartoe. Binnen twaalf meter, met de neus de goede
      kant op, gaat de roldeur omhoog — segment voor segment, zoals een roldeur
      dat doet, in anderhalve seconde.
   2. Je rijdt naar binnen. De deur gaat achter je dicht.
   3. Een paar tellen later rijd je er in een andere kleur weer uit, en zijn ze
      je kwijt: alle sterren weg. Dat kost honderd euro per ster.
   4. Staat er politie vlak naast de box, dan gaat de deur níét open. Ze zien je
      naar binnen rijden, en dan heeft het geen zin.

 Waar het staat komt uit de kaart: het tankstation zelf (`KAART.tankstations`)
 en de voetafdruk van de shop (BAG-pand 0091100000004556). Die voetafdruk heeft
 aan de noordwestkant een inham — daar is in het echt de doorgang naar de
 wasstraat — en precies daar passen de boxen, met hun rug tegen het lage deel
 van de shop en hun deuren naar het achterterrein. De maten van de boxen zelf
 staan hieronder; die staan nergens in de BGT, net zoals de doorrijhoogte van de
 luifel en de maten van de deel bij Tinga State dat niet doen.
*/
import * as THREE from 'three';
import { KAART } from './kaartwereld.js';
import { addCollider } from './world.js';
import { geluid } from './audio.js';

const PAND = '0091100000004556';       // BP Slump Oil, Lemmerweg 63

// ---------- maten (m) ----------
const AANTAL = 3;               // drie boxen, net als op de foto
const BREED = 3.10;             // hart op hart per box
const DIEP = 7.60;              // diep genoeg om een auto helemaal binnen te zetten
const HOOG = 3.30;              // vrije hoogte onder het dak
const MUUR = 0.16;              // de schotten tussen de boxen
const BUITEN = 0.24;            // de buitenwanden
const DEUR_B = 2.78;            // de opening
const DEUR_H = 2.70;
const BAND = 0.62;              // de groene band boven de deuren
const DAK = 0.22;

/*
 De botsdozen zijn vier meter hoog en het gebouw is er drie. Dat is geen fout:
 een auto negeert alles onder de drieënhalve meter (`resolveCollisions` met
 `ignoreLowH = 3.5`, zodat hij over stoepranden en door struiken kan), dus een
 muur van drie meter zou hij dwars doorheen rijden. Onzichtbaar en vier meter is
 wat een muur hier moet zijn om een muur te zijn.
*/
const BOTS_H = 4.2;

// ---------- het spel ----------
const OPEN_AFSTAND = 12;        // zo dichtbij gaat de deur open (m)
const OPEN_HOEK = 0.62;         // en alleen als je er zo'n beetje naartoe rijdt
const DEUR_TIJD = 1.5;          // seconden voor de deur helemaal open of dicht is
const BLAUW_STRAAL = 26;        // staat er politie binnen deze straal? dan niet
const SPUITEN = 4.2;            // hoe lang het overspuiten duurt (s)
const PRIJS_PER_STER = 100;     // 1 ster € 100, 5 sterren € 500

// ---------- materialen ----------
let MAT = null;
function materialen() {
  if (MAT) return MAT;
  const std = (kleur, extra = {}) => new THREE.MeshStandardMaterial({ color: kleur, roughness: 0.75, ...extra });
  MAT = {
    wand: std(0xd9dad6, { roughness: 0.85 }),        // geprofileerde staalplaat
    schot: std(0xb9bcb8, { roughness: 0.8 }),
    band: std(0x009640, { roughness: 0.5 }),         // BP-groen
    dak: std(0xc8cac6, { roughness: 0.9 }),
    deur: std(0x9aa0a4, { roughness: 0.55, metalness: 0.45 }),
    rib: std(0x7d8488, { roughness: 0.6, metalness: 0.4 }),
    vloer: std(0x6e6f6b, { roughness: 0.95 }),
    zuiltje: std(0xc0392b, { roughness: 0.6 }),      // de rode betaalzuil
    lamp: new THREE.MeshStandardMaterial({ color: 0xfff4d8, emissive: 0xffe9b0, emissiveIntensity: 0.9, roughness: 1 }),
  };
  return MAT;
}

/*
 "JET WASH" op de groene band, getekend op een canvas — er zitten geen
 plaatjesbestanden in dit spel.
*/
function bandDoek(breed = 1024, hoog = 128) {
  const c = document.createElement('canvas'); c.width = breed; c.height = hoog;
  const g = c.getContext('2d');
  g.fillStyle = '#009640'; g.fillRect(0, 0, breed, hoog);
  g.fillStyle = '#ffffff';
  g.font = `bold ${Math.round(hoog * 0.52)}px sans-serif`;
  g.textBaseline = 'middle'; g.textAlign = 'left';
  g.fillText('JET WASH', breed * 0.06, hoog * 0.52);
  // en rechts het zonnetje als een simpele ronde vlek met punten
  const m = hoog * 0.34, cx = breed * 0.93, cy = hoog * 0.5;
  for (let i = 0; i < 16; i++) {
    const a0 = (i / 16) * Math.PI * 2, a1 = ((i + 0.6) / 16) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a0) * m, cy + Math.sin(a0) * m);
    g.lineTo(cx + Math.cos(a1) * m, cy + Math.sin(a1) * m);
    g.closePath();
    g.fillStyle = i % 2 ? '#ffe500' : '#ffffff';
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/*
 Waar de rij boxen staat en welke kant hij op kijkt.

 De voetafdruk van de shop heeft aan de noordwestkant een inham: het lage deel
 loopt tot z ≈ 156,6 en het hoge deel begint pas bij x ≈ 714,9. In die hoek is
 in het echt de doorgang naar de wasstraat, en daar zetten we de rij neer — met
 de rug tegen het lage deel en de deuren naar het achterterrein. Alle getallen
 komen uit de voetafdruk zelf, zodat hij meeschuift als de kaart verandert.
*/
function plek() {
  const pand = (KAART && KAART.panden || []).find(p => p.id === PAND);
  if (!pand) return null;
  // de noordwesthoek van het lage deel: het punt met de kleinste x
  let west = pand.voet[0];
  for (const v of pand.voet) if (v[0] < west[0]) west = v;
  // en de hoek waar het lage deel in het hoge overgaat: de grootste x op die z
  let knik = west;
  for (const v of pand.voet) {
    if (Math.abs(v[1] - west[1]) < 2.5 && v[0] > knik[0]) knik = v;
  }
  const dx = knik[0] - west[0], dz = knik[1] - west[1];
  const L = Math.hypot(dx, dz) || 1;
  const ux = dx / L, uz = dz / L;          // langs de achterwand, van west naar oost
  const nx = -uz, nz = ux;                 // haaks erop, het achterterrein in
  const totaal = AANTAL * BREED;
  // het hart van de rij: op de achterwand, halverwege, en dan DIEP/2 naar buiten
  const hx = west[0] + ux * (totaal / 2) + nx * (DIEP / 2 + 0.6);
  const hz = west[1] + uz * (totaal / 2) + nz * (DIEP / 2 + 0.6);
  return { x: hx, z: hz, ux, uz, nx, nz, yaw: Math.atan2(nx, nz) };
}

/**
 * De spuiterij opzetten. `player` en `vehicles` zijn de gebruikelijke,
 * `politie` is js/politie.js (voor de sterren en het blauw in de buurt),
 * `verhaal` voor de portemonnee en `hud` voor de meldingen.
 *
 * Levert { update, plekken, boxen, get bezig } — of null als het tankstation
 * niet in de kaart staat.
 */
export function initSpuiterij({ scene, player, vehicles, hud, verhaal, politie }) {
  const P = plek();
  if (!P) return null;
  const M = materialen();
  const doek = bandDoek();

  const groep = new THREE.Group();
  groep.position.set(P.x, 0, P.z);
  groep.rotation.y = P.yaw;
  scene.add(groep);

  /*
   In de groep wijst +z naar buiten (het achterterrein op) en +x langs de rij.
   De deuropening zit dus op z = +DIEP/2 en de achterwand op z = −DIEP/2.
  */
  const totaal = AANTAL * BREED;
  const boxen = [];

  // ---- vloer ----
  const vloer = new THREE.Mesh(new THREE.BoxGeometry(totaal + BUITEN * 2, 0.10, DIEP + 0.4), M.vloer);
  vloer.position.set(0, 0.05, 0);
  vloer.receiveShadow = true;
  groep.add(vloer);

  // ---- achterwand ----
  const achter = new THREE.Mesh(new THREE.BoxGeometry(totaal + BUITEN * 2, HOOG, BUITEN), M.wand);
  achter.position.set(0, HOOG / 2, -DIEP / 2 - BUITEN / 2);
  achter.castShadow = true; achter.receiveShadow = true;
  groep.add(achter);

  // ---- de schotten tussen de boxen, en de twee buitenwanden ----
  for (let i = 0; i <= AANTAL; i++) {
    const rand = i === 0 || i === AANTAL;
    const dik = rand ? BUITEN : MUUR;
    const x = -totaal / 2 + i * BREED + (i === 0 ? -dik / 2 : i === AANTAL ? dik / 2 : 0);
    const wand = new THREE.Mesh(new THREE.BoxGeometry(dik, HOOG, DIEP), rand ? M.wand : M.schot);
    wand.position.set(x, HOOG / 2, 0);
    wand.castShadow = true; wand.receiveShadow = true;
    groep.add(wand);
  }

  // ---- dak, met een kleine overstek boven de deuren ----
  const dak = new THREE.Mesh(new THREE.BoxGeometry(totaal + BUITEN * 2 + 0.3, DAK, DIEP + 0.9), M.dak);
  dak.position.set(0, HOOG + DAK / 2, 0.25);
  dak.castShadow = true;
  groep.add(dak);

  // ---- de groene band met JET WASH boven de deuren ----
  const band = new THREE.Mesh(new THREE.BoxGeometry(totaal + BUITEN * 2 + 0.3, BAND, 0.14), M.band);
  band.position.set(0, HOOG - BAND / 2 + 0.06, DIEP / 2 + 0.68);
  groep.add(band);
  const tekst = new THREE.Mesh(
    new THREE.PlaneGeometry(totaal + BUITEN * 2, BAND * 0.86),
    new THREE.MeshBasicMaterial({ map: doek }),
  );
  tekst.position.set(0, HOOG - BAND / 2 + 0.06, DIEP / 2 + 0.755);
  groep.add(tekst);

  // ---- per box: de roldeur, een lamp en een betaalzuiltje ----
  for (let i = 0; i < AANTAL; i++) {
    const cx = -totaal / 2 + BREED * (i + 0.5);

    /*
     De roldeur. Een roldeur is geen plaat maar een stapel latten, en dat zie je
     als hij opgaat: hij rolt zichzelf op. Hier zijn het acht latten in een
     groep die omhoog schuift en waarbij de bovenste latten in elkaar zakken —
     `zetDeur` hieronder doet dat elk beeld.
    */
    const deur = new THREE.Group();
    deur.position.set(cx, 0, DIEP / 2 + 0.12);
    const latten = [];
    const N = 8, latH = DEUR_H / N;
    for (let k = 0; k < N; k++) {
      const lat = new THREE.Mesh(new THREE.BoxGeometry(DEUR_B, latH * 0.94, 0.08), k % 2 ? M.deur : M.rib);
      lat.position.set(0, latH * (k + 0.5), 0);
      lat.castShadow = true;
      deur.add(lat);
      latten.push(lat);
    }
    groep.add(deur);

    // een lamp binnenin, zodat je in een gesloten box niet in het donker staat
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(BREED * 0.5, 0.06, 0.5), M.lamp);
    lamp.position.set(cx, HOOG - 0.14, -0.6);
    groep.add(lamp);


    // ---- waar dit alles in de wereld staat ----
    const wx = P.x + P.ux * cx, wz = P.z + P.uz * cx;                    // hart van de box
    const dx = wx + P.nx * (DIEP / 2), dz = wz + P.nz * (DIEP / 2);      // midden van de deur
    const binnenX = wx - P.nx * (DIEP * 0.22), binnenZ = wz - P.nz * (DIEP * 0.22);

    /*
     De botsdoos van de deur. Hij staat er altijd, maar zijn hoogte gaat naar
     nul zodra de deur open is: `resolveCollisions` slaat alles over wat lager
     is dan wat de aanroeper negeert, dus een doos van hoogte nul bestaat voor
     iedereen niet meer. Zo hoeft er niets uit de lijst gehaald te worden.
    */
    const bots = addCollider(dx, dz, DEUR_B / 2 + 0.1, 0.18, -Math.atan2(P.uz, P.ux), BOTS_H);

    boxen.push({
      i, deur, latten, latH, N, lamp,
      x: wx, z: wz, deurX: dx, deurZ: dz, binnenX, binnenZ,
      bots, open: 0, staat: 'dicht', t: 0, auto: null, klaarVoor: null, kleurVoor: null,
    });
  }

  /*
   De twee rode betaalzuiltjes, buiten tegen de kopse wanden. Ze stonden eerst
   per box naast de deur, maar de boxen zijn drie meter breed en de schotten
   zestien centimeter: daar past niets tussen, en het zuiltje kwam achter de
   roldeur terecht. Aan de koppen staan ze waar je ze ziet, en dat is ook waar
   ze in het echt staan.
  */
  for (const kant of [-1, 1]) {
    const zuil = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.30, 0.28), M.zuiltje);
    zuil.position.set(kant * (totaal / 2 + BUITEN + 0.30), 0.75, DIEP / 2 + 0.55);
    zuil.castShadow = true;
    groep.add(zuil);
    const kop = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.20, 0.04), M.lamp);
    kop.position.set(kant * (totaal / 2 + BUITEN + 0.30), 1.12, DIEP / 2 + 0.70);
    groep.add(kop);
  }

  // ---- botsingen van de wanden ----
  const wandYaw = -Math.atan2(P.uz, P.ux);
  for (let i = 0; i <= AANTAL; i++) {
    const rand = i === 0 || i === AANTAL;
    const dik = rand ? BUITEN : MUUR;
    const lok = -totaal / 2 + i * BREED + (i === 0 ? -dik / 2 : i === AANTAL ? dik / 2 : 0);
    addCollider(P.x + P.ux * lok, P.z + P.uz * lok, dik / 2 + 0.05, DIEP / 2, wandYaw, BOTS_H);
  }
  addCollider(
    P.x + P.nx * -(DIEP / 2 + BUITEN / 2), P.z + P.nz * -(DIEP / 2 + BUITEN / 2),
    totaal / 2 + BUITEN, BUITEN / 2 + 0.05, wandYaw, BOTS_H,
  );

  // ---------- de beweging van de deur ----------
  /*
   `f` loopt van 0 (dicht) tot 1 (open). Een roldeur rolt van boven af op: de
   bovenste latten verdwijnen als eerste in de kast en de rest schuift na. Dat
   is hier zo nagedaan dat elke lat zijn eigen stukje van de beweging heeft.
  */
  function zetDeur(box, f) {
    box.open = f;
    const top = box.N * box.latH;
    for (let k = 0; k < box.N; k++) {
      const lat = box.latten[k];
      const eigen = Math.max(0, Math.min(1, (f * box.N - (box.N - 1 - k)) / 1.6));
      const y = box.latH * (k + 0.5) + eigen * (top - box.latH * (k + 0.5));
      lat.position.y = y;
      // opgerold staat hij plat tegen het plafond; dat is wat je van beneden ziet
      lat.scale.y = 1 - eigen * 0.55;
      lat.visible = eigen < 0.995;
    }
    box.bots.h = f > 0.55 ? 0 : BOTS_H;
  }
  for (const b of boxen) zetDeur(b, 0);

  // ---------- meldingen ----------
  const praatEl = () => document.getElementById('praat');
  let hint = null;
  function zegHint(tekst) {
    const el = praatEl();
    if (!el) return;
    if (tekst) { el.textContent = tekst; el.hidden = false; hint = tekst; }
    else if (hint) { el.hidden = true; hint = null; }
  }

  /*
   Wat het kost. Normaal honderd euro per ster, met een minimum van één ster —
   ook zonder blauw op je dak kun je hem laten overspuiten. Het verhaal mag er
   een eigen prijs voor vragen: de groene BX uit missie 6 gaat voor een vast
   bedrag over de kop, precies het geld dat Mark je meegaf (js/verhaal.js).
  */
  const prijsVoor = (sterren, auto = null) => {
    const eigen = verhaal && verhaal.spuitPrijs ? verhaal.spuitPrijs(auto || player.inCar) : null;
    if (eigen != null) return eigen;
    return Math.max(1, sterren) * PRIJS_PER_STER;
  };

  // ---------- per beeld ----------
  let bezig = null;          // de box waar op dit moment iets gebeurt

  function update(dt) {
    const auto = player.inCar;
    let wilHint = null;

    for (const box of boxen) {
      const dAuto = auto ? Math.hypot(auto.x - box.deurX, auto.z - box.deurZ) : Infinity;

      /*
       Staat de auto in déze box? Niet met een cirkel om het hart — de boxen
       staan drie meter uit elkaar en een cirkel van bijna vier meter pakt de
       buurman er zo bij — maar met de plaatselijke maten: hoever hij langs de
       rij staat, en hoe diep hij erin staat.
      */
      let binnen = false;
      if (auto) {
        const dx = auto.x - box.x, dz = auto.z - box.z;
        const langs = dx * P.ux + dz * P.uz;          // langs de rij
        const diep = dx * P.nx + dz * P.nz;           // de box uit, naar buiten toe
        binnen = Math.abs(langs) < BREED / 2 + 0.2 && diep < DIEP / 2 - 1.1 && diep > -DIEP / 2;
      }

      if (box.staat === 'dicht') {
        /*
         Gaat de deur open? Je moet er met een auto naartoe rijden, dichtbij
         genoeg zijn, en er ongeveer naartoe wijzen — anders gaan alle drie de
         deuren open als je langs het terrein rijdt.
        */
        if (auto && dAuto < OPEN_AFSTAND) {
          const naar = Math.hypot(box.deurX - auto.x, box.deurZ - auto.z) || 1;
          const nx = (box.deurX - auto.x) / naar, nz = (box.deurZ - auto.z) / naar;
          const neus = { x: -Math.sin(auto.yaw), z: -Math.cos(auto.yaw) };
          const recht = nx * neus.x + nz * neus.z;
          /*
           En hij moet vóór déze box staan. Zonder deze regel gingen alle drie
           de deuren tegelijk open: de boxen staan drie meter uit elkaar, dus
           wie voor de middelste stopt staat ook binnen twaalf meter van de twee
           ernaast en kijkt er nog schuin naartoe ook. Je lijnt je uit met één
           box, en dan gaat die ene open.
          */
          const zij = Math.abs((auto.x - box.x) * P.ux + (auto.z - box.z) * P.uz);
          if (zij < BREED * 0.75 && (recht > OPEN_HOEK || binnen)) {
            const blauw = politie && politie.blauwBij ? politie.blauwBij(box.deurX, box.deurZ, BLAUW_STRAAL) : 0;
            if (blauw > 0) {
              wilHint = 'De politie staat ernaast — de deur blijft dicht';
            } else {
              const sterren = politie ? politie.ster : 0;
              wilHint = `Overspuiten € ${prijsVoor(sterren)}${sterren ? ` — ${sterren} ster${sterren > 1 ? 'ren' : ''} kwijt` : ''}`;
              box.staat = 'gaatOpen';
              geluid.roldeur();
            }
          }
        }
      } else if (box.staat === 'gaatOpen') {
        zetDeur(box, Math.min(1, box.open + dt / DEUR_TIJD));
        if (box.open >= 1) { box.staat = 'open'; box.t = 0; }
        if (auto && dAuto < OPEN_AFSTAND) {
          const sterren = politie ? politie.ster : 0;
          wilHint = `Rij naar binnen — overspuiten € ${prijsVoor(sterren)}`;
        }
      } else if (box.staat === 'open') {
        box.t += dt;
        /*
         Een auto die net overgespoten is staat nog in de box. Zonder dit zou
         hij meteen opnieuw aan de beurt zijn — deur dicht, spuiten, betalen —
         en zo achter elkaar door tot je portemonnee leeg was. Rijd je eruit,
         dan vervalt het en kun je gewoon weer naar binnen.
        */
        if (box.klaarVoor && (!binnen || box.klaarVoor !== auto)) box.klaarVoor = null;
        if (binnen && box.klaarVoor === auto) {
          wilHint = 'Klaar — rij maar naar buiten';
        } else if (binnen && !bezig) {
          // hij staat binnen: deur dicht en aan de slag
          box.staat = 'gaatDicht';
          box.auto = auto;
          bezig = box;
          geluid.roldeur();
        } else if (binnen && bezig && bezig !== box) {
          wilHint = 'Er staat er al een binnen';
        } else if (!binnen && box.t > 6 && (!auto || dAuto > OPEN_AFSTAND + 4)) {
          // niemand komt: de deur gaat weer dicht
          box.staat = 'gaatDichtLeeg';
          geluid.roldeur();
        } else if (!binnen && auto && dAuto < OPEN_AFSTAND) {
          const sterren = politie ? politie.ster : 0;
          wilHint = `Rij naar binnen — overspuiten € ${prijsVoor(sterren)}`;
        }
      } else if (box.staat === 'gaatDicht' || box.staat === 'gaatDichtLeeg') {
        zetDeur(box, Math.max(0, box.open - dt / DEUR_TIJD));
        if (box.open <= 0) {
          if (box.staat === 'gaatDichtLeeg') { box.staat = 'dicht'; }
          else { box.staat = 'spuiten'; box.t = 0; }
        }
      } else if (box.staat === 'spuiten') {
        box.t += dt;
        const sterren = politie ? politie.ster : 0;
        wilHint = `Overspuiten… (€ ${prijsVoor(sterren)})`;
        /*
         Stilstaan terwijl het gebeurt. De motor uitzetten zou logisch zijn,
         maar dan hoor je hem ook niet meer aanslaan; afremmen tot nul is
         genoeg en leest als "er wordt aan je auto gewerkt".
        */
        if (box.auto) { box.auto.speed *= Math.max(0, 1 - dt * 6); box.auto.steer = 0; }
        if (box.t >= SPUITEN) {
          klaarMet(box);
          box.staat = 'gaatOpenUit';
          geluid.roldeur();
        }
      } else if (box.staat === 'gaatOpenUit') {
        zetDeur(box, Math.min(1, box.open + dt / DEUR_TIJD));
        if (box.open >= 1) {
          box.klaarVoor = box.auto;      // deze auto is geweest; eerst naar buiten
          box.staat = 'open'; box.t = 0; bezig = null; box.auto = null;
        }
        wilHint = 'Klaar — rij maar naar buiten';
      }
    }

    zegHint(wilHint);
  }

  /*
   Het overspuiten zelf: betalen, een andere kleur, en de sterren kwijt. Kun je
   het niet betalen, dan gebeurt er niets behalve dat de deur weer opengaat —
   met een lege portemonnee spuit niemand je auto over.
  */
  function klaarMet(box) {
    const sterren = politie ? politie.ster : 0;
    const prijs = prijsVoor(sterren, box.auto || player.inCar);
    if (!verhaal || !verhaal.betaal || !verhaal.betaal(prijs)) {
      if (hud) hud.melding('Te weinig geld', `Overspuiten kost € ${prijs}.`, 3);
      return;
    }
    const auto = box.auto || player.inCar;
    if (auto && vehicles && vehicles.verf) {
      box.kleurVoor = auto.kleur;
      vehicles.verf(auto, vehicles.andereKleur(auto.kleur));
    }
    if (politie && politie.vergeet) politie.vergeet();
    if (hud) {
      hud.melding('Overgespoten', sterren
        ? `€ ${prijs} betaald. Ze zoeken een auto in een andere kleur.`
        : `€ ${prijs} betaald voor een nieuwe kleur.`, 4);
    }
    geluid.spuitbus();
  }

  return {
    update,
    get bezig() { return !!bezig; },
    get boxen() {
      return boxen.map(b => ({
        i: b.i, staat: b.staat, open: +b.open.toFixed(3),
        x: b.x, z: b.z, deurX: b.deurX, deurZ: b.deurZ,
        binnen: { x: b.binnenX, z: b.binnenZ }, botsH: b.bots.h,
      }));
    },
    get plek() { return { ...P, breed: totaal, diep: DIEP, hoog: HOOG }; },
    prijsVoor,
  };
}
