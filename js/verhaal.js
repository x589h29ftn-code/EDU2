/*
 Het verhaal in de Molenkrite.

 De speler heet Erik. Hij begint op de berm voor **Molenkrite 15** — in de
 kaartdata het pand met huisnummer 15 aan de Molenkrite, een woning met steile
 kap en dakkapel, het vierde huis na de knik in de straat. Op de stoep voor dat
 huis staat een buurman die je aankijkt en zwaait; met E spreek je hem aan. Het
 gesprek staat onderin het scherm en klik je met E door. Daarna loopt hij naar
 het gezelschap dat schuin tegenover, in de voortuin van **Molenkrite 20**, bier
 zit te drinken, en roept hij je de opdracht toe.

 Er staat geen enkele coördinaat in dit bestand. Alle plekken komen uit
 js/kaart.js (BGT en 3D BAG): het pand met dat huisnummer, zijn voorgevelmidden
 en zijn voorkantrichting. Verhuist een pand in de brondata, dan verhuist de
 scène mee. Dat is de regel uit docs/METHODIEK.md: geometrie uit de data, en
 verwijzen naar adressen in plaats van naar posities.

 De fases:
   wacht     – hij staat voor zijn huis en zwaait zodra je in de buurt komt
   gesprek   – de tekstbalk onderin loopt regel voor regel door (E)
   loopt     – hij steekt de Molenkrite over naar de bierdrinkers
   bevel     – bij het gezelschap draait hij zich naar je om: "Schiet ze neer!"
   opdracht  – de vier bierdrinkers zijn nu doelen voor het pistool
   klaar     – alle vier omgevallen
*/
import { KAART } from './kaartwereld.js';
import { drinkArmen, radioPlekken, resolveCollisions, addCollider } from './world.js';
import { maakProp, PROP_TYPES } from './props.js';
import { Persoon } from './persoon.js';

// De adressen waar de scène zich afspeelt.
const HUIS = { straat: 'Molenkrite', nr: '15' };    // het huis van de buurman
const OVERKANT = { straat: 'Molenkrite', nr: '20' }; // schuin tegenover: de bierdrinkers

// Afstanden vanaf het voorgevelmidden, in meters. Voor 15 is de stoep gemeten
// op 9,8 tot 11,0 m en de rijbaan begint op 14,8 m; voor 20 loopt de voortuin
// van 3,5 tot 7,5 m.
const BUURMAN_VOOR = 10.4;   // op de stoep voor zijn eigen voortuin
const SPELER_VOOR = 13.6;    // in de berm, met de buurman recht vooruit
const TAFEL_VOOR = 5.0;      // het tafeltje met de radio in de voortuin
const STOP_VOOR = 7.6;       // waar de buurman blijft staan, naast het gezelschap
const STOEL_RING = 1.15;     // de vier stoelen rond het tafeltje

const PRAAT_AFSTAND = 5.5;   // op zoveel meter kun je hem aanspreken
const ZWAAI_AFSTAND = 26;    // vanaf hier zwaait hij naar je
const ROEP_AFSTAND = 30;     // pas als je zo dichtbij bent roept hij de opdracht
const LOOPSNELHEID = 1.45;   // m/s

const NAAM = 'Buurman';
const GESPREK = [
  'Erik, kom met mij mee. Ik ben helemaal klaar met de bende die voor hun huis bier zitten te drinken.',
];
const BEVEL = 'Schiet ze neer!';
const AFSLUITING = 'Zo. Nu is het eindelijk weer rustig in de Molenkrite.';

const ZITTERS = ['zit_rood', 'zit_blauw', 'zit_groen', 'zit_geel'];

// ---------- de scène uit de kaartdata halen ----------
function pandVan({ straat, nr }) {
  if (!KAART || !KAART.panden) return null;
  return KAART.panden.find(p => p.straat === straat && (p.nr || []).includes(nr)) || null;
}

// Het midden van de voorgevel en de richting waarin die kijkt. `front` komt uit
// de generator: de kant van het pand waar de voordeur en de straat liggen.
function voorgevel(p) {
  return { x: p.rect.cx + p.front[0] * p.rect.hz, z: p.rect.cz + p.front[1] * p.rect.hz, fx: p.front[0], fz: p.front[1] };
}
function voorPunt(p, meter) {
  const v = voorgevel(p);
  return { x: v.x + v.fx * meter, z: v.z + v.fz * meter };
}
// kijkrichting van a naar b, in de conventie van de speler (yaw 0 = naar -Z)
function kijkHoek(a, b) { return Math.atan2(-(b.x - a.x), -(b.z - a.z)); }

// Startpunt van de speler: op de berm voor Molenkrite 15, kijkend naar de
// buurman. main.js gebruikt dit in plaats van KAART.start.
export function verhaalStart() {
  const p = pandVan(HUIS);
  if (!p) return null;
  const s = voorPunt(p, SPELER_VOOR);
  const b = voorPunt(p, BUURMAN_VOOR);
  return { x: s.x, z: s.z, yaw: kijkHoek(s, b) };
}

export function initVerhaal({ scene, player }) {
  const balk = document.getElementById('dialoog');
  const naamEl = document.getElementById('dialoogNaam');
  const tekstEl = document.getElementById('dialoogTekst');
  const verderEl = document.getElementById('dialoogVerder');
  const praatEl = document.getElementById('praat');
  const opdrachtEl = document.getElementById('opdracht');

  const huis = pandVan(HUIS);
  const overkant = pandVan(OVERKANT);
  // Zonder kaartdata (bijvoorbeeld met ?kaart=oud) speelt het verhaal niet.
  if (!huis || !overkant) {
    console.warn(`verhaal: ${HUIS.straat} ${HUIS.nr} of ${OVERKANT.straat} ${OVERKANT.nr} niet in de kaartdata gevonden`);
    return null;
  }

  const thuis = voorPunt(huis, BUURMAN_VOOR);
  const tafel = voorPunt(overkant, TAFEL_VOOR);
  const stop = voorPunt(overkant, STOP_VOOR);
  const straatkant = kijkHoek(thuis, voorPunt(huis, SPELER_VOOR + 6));  // van het huis af, naar de straat

  // ---------- de buurman ----------
  const buurman = new Persoon({ shirt: 0x2f5d8a, broek: 0x39312a, huid: 0xd9b48f, haar: 0x6b5a45, hoogte: 1.03 });
  scene.add(buurman.groep);
  buurman.zetNeer(thuis.x, thuis.z, straatkant);

  // ---------- het gezelschap in de voortuin van de overkant ----------
  // Het tafeltje met de radio in het midden, de vier stoelen eromheen, naar
  // binnen gedraaid. De arm met het flesje beweegt (drinkArmen in world.js) en
  // de radio speelt harder naarmate je dichterbij komt (radioPlekken).
  const bende = [];
  {
    const grond = Math.atan2(-overkant.front[0], -overkant.front[1]);   // van de straat naar het huis
    const tafelObj = maakProp('radiotafel');
    tafelObj.position.set(tafel.x, 0, tafel.z);
    tafelObj.rotation.y = grond + 0.7;
    scene.add(tafelObj);
    bende.push({ i: -1, soort: 'radiotafel', obj: tafelObj });
    ZITTERS.forEach((soort, i) => {
      const hoek = grond + Math.PI / 4 + i * Math.PI / 2;
      const x = tafel.x - Math.sin(hoek) * STOEL_RING;
      const z = tafel.z - Math.cos(hoek) * STOEL_RING;
      const obj = maakProp(soort);
      obj.position.set(x, 0, z);
      obj.rotation.y = hoek + Math.PI;      // met het gezicht naar het tafeltje
      scene.add(obj);
      bende.push({ i, soort, obj });
    });
    for (const b of bende) b.obj.traverse(o => { o.castShadow = true; o.receiveShadow = true; });
  }

  const drinkers = bende.filter(b => b.i >= 0);
  const omgevallen = new Set();      // index van de neergeschoten drinkers
  const vallen = [];                 // {obj, t} – de val duurt even

  /*
   drinkArmen, radioPlekken en de botsingsdozen horen bij de wereld en worden
   door resetWorld leeggegooid (de editor bouwt de wereld opnieuw op). Onze
   objecten blijven staan, dus melden we ze daarna opnieuw aan.
  */
  function meldAan() {
    for (const b of bende) {
      const def = PROP_TYPES[b.soort];
      if (def) addCollider(b.obj.position.x, b.obj.position.z, def.maat[0] / 2, def.maat[1] / 2, -b.obj.rotation.y, def.h);
      const arm = b.obj.getObjectByName('drinkarm');
      if (arm && !omgevallen.has(b.i) && !drinkArmen.some(a => a.obj === arm)) {
        drinkArmen.push({ obj: arm, fase: arm.userData.drinkfase || 0, duur: 7 + (b.i % 5) * 1.7 });
      }
    }
    if (!radioPlekken.some(r => Math.hypot(r.x - tafel.x, r.z - tafel.z) < 0.1)) {
      radioPlekken.push({ x: tafel.x, z: tafel.z });
    }
  }
  meldAan();

  let fase = 'wacht';
  let regel = 0;
  let wachtNaAankomst = 0;
  // pseudo-voetganger: het verkeer remt hiervoor af als hij oversteekt
  const hinder = { alive: true, opWeg: false, x: thuis.x, z: thuis.z };

  // ---------- omvallen ----------
  function legNeer(obj, t) {
    obj.rotation.x = -t * 1.4;
    obj.position.y = -t * 0.18;
    if (t >= 1) stopDrinkarm(obj);
  }

  // De arm met het flesje wordt door world.js aangedreven; wie omvalt, drinkt niet meer.
  function stopDrinkarm(obj) {
    for (let i = drinkArmen.length - 1; i >= 0; i--) {
      let p = drinkArmen[i].obj;
      while (p) { if (p === obj) { drinkArmen.splice(i, 1); break; } p = p.parent; }
    }
  }

  // ---------- tekstbalk onderin ----------
  function toonRegel(tekst, verder = 'E — verder') {
    naamEl.textContent = NAAM;
    tekstEl.textContent = tekst;
    verderEl.textContent = verder;
    balk.hidden = false;
    praatEl.hidden = true;
  }
  function sluitBalk() { balk.hidden = true; }

  function zetOpdracht(tekst) {
    opdrachtEl.textContent = tekst ? `Opdracht: ${tekst}` : '';
    opdrachtEl.hidden = !tekst;
  }
  function teGaan() { return drinkers.length - omgevallen.size; }

  function afstandTotSpeler() {
    const p = player.inCar ? player.inCar : player.pos;
    return Math.hypot(p.x - buurman.groep.position.x, p.z - buurman.groep.position.z);
  }

  // ---------- E: aanspreken en doorklikken ----------
  // Geeft true als het verhaal de toets gebruikt heeft; dan stapt main.js niet
  // ook nog in een auto.
  function toets() {
    if (!balk.hidden) {
      if (fase === 'gesprek') {
        regel++;
        if (regel < GESPREK.length) { toonRegel(GESPREK[regel]); return true; }
        sluitBalk();
        fase = 'loopt';
        zetOpdracht('ga met de buurman mee');
        return true;
      }
      if (fase === 'bevel') {
        sluitBalk();
        fase = 'opdracht';
        zetOpdracht(`${BEVEL} (${teGaan()} te gaan)`);
        return true;
      }
      sluitBalk();                       // de afsluitende regel
      if (fase === 'klaar') zetOpdracht('');
      return true;
    }
    if (fase === 'wacht' && afstandTotSpeler() < PRAAT_AFSTAND) {
      fase = 'gesprek'; regel = 0;
      toonRegel(GESPREK[0]);
      return true;
    }
    return false;
  }

  // ---------- schieten op de bende ----------
  function doelen() {
    if (fase !== 'opdracht' && fase !== 'klaar') return [];
    return drinkers.filter(b => !omgevallen.has(b.i)).map(b => b.obj);
  }

  // obj is de aangeraakte mesh; loop omhoog tot we een van de drinkers vinden.
  function raak(obj) {
    if (fase !== 'opdracht') return false;
    let p = obj;
    while (p) {
      const treffer = drinkers.find(b => b.obj === p);
      if (treffer) {
        if (omgevallen.has(treffer.i)) return false;
        omgevallen.add(treffer.i);
        vallen.push({ obj: treffer.obj, t: 0 });
        if (teGaan() > 0) {
          zetOpdracht(`${BEVEL} (${teGaan()} te gaan)`);
        } else {
          zetOpdracht('');
          fase = 'klaar';
          toonRegel(AFSLUITING, 'E — sluiten');
        }
        return true;
      }
      p = p.parent;
    }
    return false;
  }

  // ---------- lopen ----------
  // Recht op het doel af; staat er iets in de weg (een boom, een lantaarnpaal),
  // dan probeert hij het schuin. Geeft true als hij er is.
  function loopNaar(doel, dt) {
    const pos = buurman.groep.position;
    let dx = doel.x - pos.x, dz = doel.z - pos.z;
    const afst = Math.hypot(dx, dz);
    if (afst < 0.4) return true;
    dx /= afst; dz /= afst;
    const stap = Math.min(afst, LOOPSNELHEID * dt);
    for (const draai of [0, 0.6, -0.6, 1.2, -1.2]) {
      const c = Math.cos(draai), s = Math.sin(draai);
      const rx = dx * c - dz * s, rz = dx * s + dz * c;
      const nx = pos.x + rx * stap, nz = pos.z + rz * stap;
      const [kx, kz] = resolveCollisions(nx, nz, 0.34);
      if (Math.hypot(kx - nx, kz - nz) < 0.02) {
        pos.x = kx; pos.z = kz;
        buurman.draaiNaar(Math.atan2(-rx, -rz), dt, 6);
        return false;
      }
    }
    // helemaal klem: dan de gecorrigeerde stap, dan schuift hij er langs
    const [kx, kz] = resolveCollisions(pos.x + dx * stap, pos.z + dz * stap, 0.34);
    pos.x = kx; pos.z = kz;
    return false;
  }

  // ---------- per beeld ----------
  function update(dt) {
    const p = player.inCar ? player.inCar : player.pos;
    const d = afstandTotSpeler();

    if (fase === 'wacht' || fase === 'gesprek') {
      if (d < ZWAAI_AFSTAND) buurman.kijkNaar(p.x, p.z, dt);
      buurman.update(dt, { zwaait: fase === 'wacht' && d < ZWAAI_AFSTAND });
      // niet op het startscherm: daar kun je nog niet praten
      const bezig = player.active || window.__autoplay;
      praatEl.hidden = !(bezig && fase === 'wacht' && d < PRAAT_AFSTAND && balk.hidden);
    } else if (fase === 'loopt') {
      const erIs = loopNaar(stop, dt);
      buurman.update(dt, { loopt: !erIs, snelheid: LOOPSNELHEID });
      if (erIs) { fase = 'bevel'; wachtNaAankomst = 0.8; }
      hinder.opWeg = !erIs;
    } else if (fase === 'bevel') {
      hinder.opWeg = false;
      if (wachtNaAankomst > 0) {
        // eerst even naar het gezelschap kijken, dan naar de speler
        wachtNaAankomst -= dt;
        buurman.kijkNaar(tafel.x, tafel.z, dt, 3);
        buurman.update(dt, {});
      } else {
        buurman.kijkNaar(p.x, p.z, dt, 3);
        buurman.update(dt, {});
        if (balk.hidden && d < ROEP_AFSTAND) { toonRegel(BEVEL, 'E — sluiten'); zetOpdracht(''); }
        else if (balk.hidden) zetOpdracht('ga met de buurman mee');
      }
    } else {
      hinder.opWeg = false;
      buurman.kijkNaar(p.x, p.z, dt, 2);
      buurman.update(dt, {});
    }

    hinder.x = buurman.groep.position.x;
    hinder.z = buurman.groep.position.z;

    // de neergeschoten drinkers kantelen om
    for (let i = vallen.length - 1; i >= 0; i--) {
      const v = vallen[i];
      v.t = Math.min(1, v.t + dt * 1.8);
      legNeer(v.obj, v.t);
      if (v.t >= 1) vallen.splice(i, 1);
    }
  }

  // ---------- opslaan en laden ----------
  function bewaar() {
    return {
      fase, regel,
      buurman: { x: buurman.groep.position.x, z: buurman.groep.position.z, yaw: buurman.yaw },
      om: [...omgevallen],
    };
  }

  function herstel(s) {
    if (!s) return;
    fase = s.fase || 'wacht';
    regel = s.regel || 0;
    if (fase === 'gesprek') { fase = 'wacht'; regel = 0; }   // een half gesprek slaan we niet op
    if (s.buurman) buurman.zetNeer(s.buurman.x, s.buurman.z, s.buurman.yaw || 0);
    omgevallen.clear();
    for (const i of s.om || []) omgevallen.add(i);
    vallen.length = 0;
    for (const b of drinkers) {
      if (omgevallen.has(b.i)) legNeer(b.obj, 1);
      else { b.obj.rotation.x = 0; b.obj.position.y = 0; }
    }
    meldAan();
    sluitBalk();
    praatEl.hidden = true;
    if (fase === 'opdracht') zetOpdracht(teGaan() > 0 ? `${BEVEL} (${teGaan()} te gaan)` : '');
    else if (fase === 'loopt' || fase === 'bevel') zetOpdracht('ga met de buurman mee');
    else zetOpdracht('');
  }

  // Op een aanraakscherm klik je het gesprek door met een tik op de balk. Met
  // de muis niet: een klik is in dit spel een schot.
  balk.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    e.preventDefault();
    toets();
  });

  zetOpdracht('');
  sluitBalk();
  praatEl.hidden = true;

  return {
    update, toets, doelen, raak, hinder, bewaar, herstel, meldAan,
    get fase() { return fase; },
    get buurman() { return buurman; },
    get plekken() { return { thuis, tafel, stop, huis: voorgevel(huis), overkant: voorgevel(overkant) }; },
    // true zolang E over praten gaat: er loopt een gesprek, of er staat iemand
    // naast je die je kunt aanspreken
    get aanspreekbaar() {
      return !balk.hidden || (fase === 'wacht' && afstandTotSpeler() < PRAAT_AFSTAND);
    },
  };
}
