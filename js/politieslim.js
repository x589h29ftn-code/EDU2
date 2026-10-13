/*
 De politie slimmer (stap 144). Gevraagd: "Bouw 1, 2, 3, 4, 5, 8. Zorg wel dat het nog te doen is om weg te komen.
 Dus verstoppen in bosjes, het bos, gehurkt ergens achter. Moet allemaal bijdragen. Laat politie ook terug naar auto
 keren om achter je aan te gaan als je vol uit beeld bent. Laat ze je ook proberen te rammen indien handig."

 Hier staan de losse stukken; js/politie.js haakt ze in. Alles is te meten zonder het spel (tools/politieslimtest.mjs):

   verstop        waar sta je: in een struik, in het bos, onder een kroon, onder een lantaarn
   zichtAfstand   hoe ver een agent je dan nog ziet (dag/nacht, weer, zaklamp, verstopt, gehurkt, rennen)
   struikOpLijn   een bosje vlak voor je houdt de kijklijn tegen als je gehurkt zit
   zoekDekking    een plek voor een agent waar hij gehurkt gedekt zit en staand over de dekking heen kan schieten
   raakKans       hoe vaak een agent raak schiet: eerst mis, dan zekerder; minder op wie rent, rijdt of gedekt zit
   ZoekGeheugen   welke vakken van twintig meter ze al afgezocht hebben, en de richting waarin je verdween
   maakZaklamp    een lichtbundel voor de agent te voet, 's nachts

 Wegkomen moet te doen blijven, en dat is hier de rode draad: elke regel die ze slimmer maakt heeft een tegenzet.
 Ze zoeken eerst in de richting waarin je verdween — dus sla een hoek om en ga de andere kant op. Ze kammen ook
 tuinen uit — maar wie gehurkt in een struik zit, zien ze pas op een paar meter. 's Nachts is het donker, maar
 hun zaklamp verraadt waar ze kijken.
*/
import * as THREE from 'three';
import { treePositions, zichtVrij, resolveCollisions, pointInWater } from './world.js';
import { KAART, lantaarnBij } from './kaartwereld.js';

export const SLIM = {
  zicht: 42,            // overdag, zoals altijd (m)
  nacht: 20,            // 's nachts zonder licht
  lamp: 34,             // 's nachts onder een brandende lantaarn
  zaklamp: 32,          // 's nachts in de bundel van een zaklamp (sinds stap 156 alleen nog de koplampen van een politieauto)
  langsMin: 5,          // (stap 156) zo dicht komt de weg naar dekking niet bij de speler
  langsVoorbij: 0.75,   // (stap 156) dekking hoogstens driekwart van de weg naar de speler
  flankBoog: 0.5,       // (stap 156) zoveel rad per stap om de speler heen
  zaklampHoek: 0.3,     // halve openingshoek van die bundel (rad)
  koplampen: 36,        // een auto 's nachts: die zie je aan zijn lampen
  regen: 0.8,           // zicht maal dit bij regen (zwaar 2), bewolkt de helft daarvan
  struikGehurkt: 2.5,   // gehurkt in een struik: zo dichtbij moeten ze komen (m)
  struikStaand: 0.35,   // staand in een struik: het zicht maal dit
  bosGehurkt: 0.3,      // gehurkt in het bos
  bosStaand: 0.55,      // staand in het bos
  bosBomen: 5,          // zoveel bomen binnen bosStraal is bos
  bosStraal: 8,
  kroon: 0.9,           // alleen onder een boomkroon
  hurk: 0.85,           // gehurkt, verder nergens in
  rennen: 1.15,         // wie rent valt op (niet verder dan het gewone zicht)
  // dekking
  dekkingPogingen: 14,
  dekkingMin: 7, dekkingMax: 28,   // afstand tot de speler (m)
  dekkingOpnieuw: 3,    // om de zoveel tellen kijkt hij of het beter kan
  opstaan: 0.55,        // zo lang staat hij op voor een schot (s)
  onderdrukt: 1.6,      // na een schot vlakbij blijft hij zo lang laag (s)
  onderdrukStraal: 18,  // zo dichtbij moet het schot zijn (m)
  // zoeken
  vak: 20,              // de vakken van het geheugen (m)
  vergeet: 45,          // na zoveel tellen telt een vak weer als niet doorzocht
  vluchtDuur: 40,       // zo lang telt de richting waarin je verdween mee (s)
  // terug naar de auto
  terugNa: 5,           // zoveel tellen helemaal uit beeld, en je reed weg …
  terugAltijd: 16,      // … of zoveel tellen, ook te voet
  terugMax: 110,        // verder dan dit van hun auto lopen ze niet terug (m)
  // rammen en insluiten
  ramSter: 2,           // vanaf zoveel sterren rammen ze
  ramAfstand: 38,       // zo dichtbij moet hij zijn (m)
  ramRust: 2.6,         // na een klap zoveel tellen afstand nemen
  ramHoek: 0.7,         // hij moet ongeveer naar je toe rijden (rad)
  insluitSter: 3,       // vanaf zoveel sterren zetten ze je klem als je stilstaat
  insluitVaart: 4,      // langzamer dan dit (m/s)
};

// ---------------------------------------------------------------- waar sta je
/*
 Een rooster over de struiken en de bomen, één keer opgebouwd. De struiken komen uit de kaart (`KAART.struiken`,
 19.000 stuks; ze hebben geen botsdoos, je loopt er gewoon in), de bomen uit js/world.js.
*/
const HOK = 16;
let struikRooster = null, boomRooster = null, boomN = -1;
function rooster(lijst) {
  const r = new Map();
  for (const t of lijst) {
    const k = `${Math.floor(t.x / HOK)}:${Math.floor(t.z / HOK)}`;
    let l = r.get(k); if (!l) r.set(k, l = []); l.push(t);
  }
  return r;
}
function rond(r, x, z, straal, fn) {
  const i0 = Math.floor((x - straal) / HOK), i1 = Math.floor((x + straal) / HOK);
  const j0 = Math.floor((z - straal) / HOK), j1 = Math.floor((z + straal) / HOK);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const l = r.get(`${i}:${j}`); if (!l) continue;
    for (const t of l) if (fn(t) === true) return true;
  }
  return false;
}
const struiken = () => struikRooster || (struikRooster = rooster((KAART && KAART.struiken) || []));
const bomen = () => {
  if (!boomRooster || boomN !== treePositions.length) { boomRooster = rooster(treePositions); boomN = treePositions.length; }
  return boomRooster;
};
// de straal van een struik: js/kaartwereld.js zet een bol van 0,7 m op schaal `s`
const struikStraal = (s) => 0.7 * (s || 1);

/**
 * Waar sta je? `{ struik, bos, kroon, lamp }`. Een struik telt als je er met je schouders in staat; het bos als er
 * genoeg bomen om je heen staan. `lamp` alleen als `lampenAan` (0…1) zegt dat de straatverlichting brandt.
 */
export function verstop(x, z, { lampenAan = 1 } = {}) {
  let struik = false;
  rond(struiken(), x, z, 2, (s) => {
    const r = struikStraal(s.s) + 0.3;
    if ((s.x - x) ** 2 + (s.z - z) ** 2 < r * r) { struik = true; return true; }
  });
  let n = 0, kroon = false;
  const R2 = SLIM.bosStraal * SLIM.bosStraal;
  rond(bomen(), x, z, SLIM.bosStraal, (t) => {
    const d2 = (t.x - x) ** 2 + (t.z - z) ** 2;
    if (d2 < R2) n++;
    const k = 3.2 * (t.s || 1) * (t.tall ? 0.6 : 1);
    if (d2 < k * k) kroon = true;
  });
  const L = lampenAan > 0.3 ? lantaarnBij(x, z, 7) : null;
  return { struik, bos: n >= SLIM.bosBomen, bomen: n, kroon, lamp: !!(L && !L.om) };
}

/**
 * Hoe ver ziet een agent je? `v` is de uitkomst van `verstop`, `nacht` een vlag, `zwaar` het weer (0 helder,
 * 1 bewolkt, 2 regen), `inBundel` of je in de bundel van zijn zaklamp staat.
 */
export function zichtAfstand({ v = null, nacht = false, zwaar = 0, inBundel = false, inAuto = false, hurk = 0, vaart = 0 } = {}) {
  let z = SLIM.zicht;
  if (nacht) z = inAuto ? SLIM.koplampen : Math.max(v && v.lamp ? SLIM.lamp : SLIM.nacht, inBundel ? SLIM.zaklamp : 0);
  z *= 1 - (1 - SLIM.regen) * Math.min(2, Math.max(0, zwaar)) / 2;
  if (inAuto || !v) return z;
  const gehurkt = hurk > 0.5;
  if (v.struik) return gehurkt ? Math.min(z, SLIM.struikGehurkt) : z * SLIM.struikStaand;
  if (v.bos) return z * (gehurkt ? SLIM.bosGehurkt : SLIM.bosStaand);
  if (v.kroon) z *= SLIM.kroon;
  if (gehurkt) z *= SLIM.hurk;
  else if (vaart > 4) z = Math.min(SLIM.zicht, z * SLIM.rennen);
  return z;
}

/**
 * Houdt een struik vlak bij de speler (b) de kijklijn van a naar b tegen? Alleen als hij gehurkt zit: een bosje is
 * een meter hoog, staand kijken ze eroverheen. Struiken hebben geen botsdoos, dus `zichtVrij` ziet ze niet.
 */
export function struikOpLijn(ax, az, bx, bz, hurk = 0) {
  if (hurk <= 0.5) return false;
  const dx = ax - bx, dz = az - bz, L = Math.hypot(dx, dz);
  if (L < 1) return false;
  const ux = dx / L, uz = dz / L;
  return rond(struiken(), bx, bz, 3.5, (s) => {
    const px = s.x - bx, pz = s.z - bz;
    const langs = px * ux + pz * uz;
    if (langs < 0.2 || langs > 3.5) return false;            // tussen jou en hem, vlak bij jou
    const dwars = Math.abs(px * uz - pz * ux);
    return dwars < struikStraal(s.s) * 0.9;
  });
}

// ---------------------------------------------------------------- dekking
/**
 * Een plek waar een agent dekking heeft: gehurkt ziet hij de speler niet (er staat iets tussen), staand wel — of een
 * stapje opzij wel (`piek`, om een hoek kijken). `{ x, z, piek }` of null. `pos` is de agent, `sp` de speler.
 */
export function zoekDekking(pos, sp, { rnd = Math.random, pogingen = SLIM.dekkingPogingen, zonderLangs = false } = {}) {
  let beste = null, besteScore = -Infinity;
  for (let i = 0; i < pogingen; i++) {
    const hoek = rnd() * Math.PI * 2, r = 1.5 + rnd() * 9;
    const px = pos.x + Math.cos(hoek) * r, pz = pos.z + Math.sin(hoek) * r;
    const [cx, cz] = resolveCollisions(px, pz, 0.4);
    if (Math.hypot(cx - px, cz - pz) > 0.05 || pointInWater(cx, cz)) continue;
    const dS = Math.hypot(sp.x - cx, sp.z - cz);
    if (dS < SLIM.dekkingMin || dS > SLIM.dekkingMax) continue;
    if (zichtVrij(cx, cz, sp.x, sp.z, 0.7)) continue;              // gehurkt moet hij gedekt zitten
    /*
     (stap 156) Niet langs de speler heen: de dekking ligt aan de kant van de agent (verder dan driekwart van de weg naar
     de speler telt niet), en de rechte weg ernaartoe komt niet dichter dan `langsMin` bij de speler. Eerst koos hij
     soms een plek achter je en liep hij er dwars langs je heen.
    */
    if (!zonderLangs && !langsVrij(pos, { x: cx, z: cz }, sp)) continue;      // (`zonderLangs`: de oude regel, voor de tegenproef)
    let piek = null;
    const staand = zichtVrij(cx, cz, sp.x, sp.z, 1.45);
    if (!staand) {
      // een stap opzij, haaks op de lijn naar de speler: om de hoek van een muur of een auto kijken
      const ux = (sp.x - cx) / dS, uz = (sp.z - cz) / dS;
      for (const k of [1.1, -1.1]) {
        const qx = cx - uz * k, qz = cz + ux * k;
        const [rx, rz] = resolveCollisions(qx, qz, 0.4);
        if (Math.hypot(rx - qx, rz - qz) > 0.05) continue;
        if (zichtVrij(rx, rz, sp.x, sp.z, 1.3)) { piek = { x: rx, z: rz }; break; }
      }
      if (!piek) continue;
    }
    // dichtbij de agent zelf, liefst op een meter of veertien van de speler
    const score = -Math.hypot(cx - pos.x, cz - pos.z) - Math.abs(dS - 14) * 0.4 + (staand ? 1.5 : 0);
    if (score > besteScore) { besteScore = score; beste = { x: cx, z: cz, piek }; }
  }
  return beste;
}

/**
 * (stap 156) Mag een agent van `pos` naar `doel` zonder langs de speler `sp` te lopen? Het doel ligt aan zijn kant (de
 * projectie op de lijn naar de speler is hoogstens `SLIM.langsVoorbij` van de weg), en de rechte lijn komt niet dichter
 * dan `SLIM.langsMin` bij de speler — of niet dichter dan hij al was, als hij al dichterbij staat.
 */
export function langsVrij(pos, doel, sp) {
  const ux = sp.x - pos.x, uz = sp.z - pos.z, L2 = ux * ux + uz * uz;
  if (L2 < 1e-6) return true;
  const t = ((doel.x - pos.x) * ux + (doel.z - pos.z) * uz) / L2;
  if (t > SLIM.langsVoorbij) return false;
  // de kortste afstand van de speler tot het stuk pos → doel
  const dx = doel.x - pos.x, dz = doel.z - pos.z, l2 = dx * dx + dz * dz || 1;
  const s = Math.max(0, Math.min(1, ((sp.x - pos.x) * dx + (sp.z - pos.z) * dz) / l2));
  const d = Math.hypot(pos.x + dx * s - sp.x, pos.z + dz * s - sp.z);
  return d >= Math.min(SLIM.langsMin, Math.sqrt(L2) - 0.01);
}

/**
 * (stap 156) De flankeerder in een boog om de speler heen: het volgende punt op de cirkel om `mik` van straal
 * `max(afst, waar hij nu staat)`, hoogstens `SLIM.flankBoog` rad verder richting `hoek`. Zo komt hij nooit dichter bij je
 * dan hij al was, en loopt hij niet meer in een rechte lijn langs je heen naar de overkant.
 */
export function flankStap(pos, mik, hoek, afst) {
  const nu = Math.atan2(pos.z - mik.z, pos.x - mik.x), dNu = Math.hypot(pos.x - mik.x, pos.z - mik.z);
  let v = hoek - nu;
  while (v > Math.PI) v -= Math.PI * 2;
  while (v < -Math.PI) v += Math.PI * 2;
  const stap = Math.max(-SLIM.flankBoog, Math.min(SLIM.flankBoog, v));
  // dichterbij dan de flankafstand: eerst naar buiten, dan pas rond
  const r = dNu < afst - 0.5 ? Math.min(afst, dNu + 3) : afst;
  const a = nu + (dNu < afst - 0.5 ? stap * 0.3 : stap);
  return { x: mik.x + Math.cos(a) * r, z: mik.z + Math.sin(a) * r };
}

// ---------------------------------------------------------------- raak schieten
/**
 * Hoe vaak raakt een agent? Het oude getal (op afstand, minder met een machinepistool) maal wat er gebeurt:
 * de eerste schoten op een nieuw doel gaan vaker mis (`richtT`: zoveel tellen ziet hij je al), wie rent of rijdt is
 * moeilijker te raken, wie gehurkt of gedekt zit ook, en wie stil in het open staat juist makkelijker.
 */
export function raakKans({ d = 10, richtT = 3, mp = false, vaart = 0, inAuto = false, hurk = 0, gedekt = false, onderdrukt = false, donker = false } = {}) {
  let k = Math.max(0.14, 0.58 - d * 0.0105) * (mp ? 0.45 : 1);
  k *= 0.35 + 0.65 * Math.min(1, Math.max(0, richtT) / 3);
  if (inAuto) k *= vaart > 20 ? 0.35 : vaart > 8 ? 0.55 : 0.9;
  else k *= vaart > 4 ? 0.6 : vaart > 1.5 ? 0.85 : (hurk > 0.5 ? 1 : 1.2);
  if (hurk > 0.5) k *= 0.75;
  if (gedekt) k *= 0.5;
  if (onderdrukt) k *= 0.5;
  if (donker) k *= 0.8;
  return Math.min(0.8, k);
}

// ---------------------------------------------------------------- zoeken
/*
 Welke vakken hebben ze al gezien? Elke eenheid stempelt het vak waar ze staat; een nieuw zoekpunt gaat liever naar
 een vak dat nog niet (of lang geleden) bekeken is. En de richting waarin je uit beeld verdween telt de eerste
 veertig tellen zwaar mee: eerst kijken ze daar.
*/
export class ZoekGeheugen {
  constructor() { this.vakken = new Map(); this.klok = 0; this.vlucht = null; }
  sleutel(x, z) { return `${Math.floor(x / SLIM.vak)}:${Math.floor(z / SLIM.vak)}`; }
  tik(dt) { this.klok += dt; }
  stempel(x, z) { this.vakken.set(this.sleutel(x, z), this.klok); }
  // 1 = net doorzocht, 0 = niet of lang geleden
  vers(x, z) {
    const t = this.vakken.get(this.sleutel(x, z));
    return t == null ? 0 : Math.max(0, 1 - (this.klok - t) / SLIM.vergeet);
  }
  verdween(x, z, rx, rz) {
    const L = Math.hypot(rx, rz);
    this.vlucht = L > 0.5 ? { x, z, rx: rx / L, rz: rz / L, t: this.klok } : { x, z, rx: 0, rz: 0, t: this.klok };
  }
  // hoe zwaar de vluchtrichting nog telt (1 → 0 over vluchtDuur)
  vluchtGewicht() { return this.vlucht ? Math.max(0, 1 - (this.klok - this.vlucht.t) / SLIM.vluchtDuur) : 0; }
  // een punt rond het anker beoordelen: hoger is beter
  score(ax, az, x, z, andereDoelen = []) {
    let s = -this.vers(x, z) * 60;
    const g = this.vluchtGewicht();
    if (g > 0 && (this.vlucht.rx || this.vlucht.rz)) {
      const dx = x - ax, dz = z - az, L = Math.hypot(dx, dz) || 1;
      s += ((dx * this.vlucht.rx + dz * this.vlucht.rz) / L) * 30 * g;
    }
    for (const d of andereDoelen) if (d && Math.hypot(d.x - x, d.z - z) < 20) s -= 25;
    return s;
  }
  wis() { this.vakken.clear(); this.vlucht = null; }
}

// ---------------------------------------------------------------- de zaklamp
/*
 Een bundel licht uit de hand van een agent, 's nachts. Hetzelfde soort materiaal als het zoeklicht van de heli
 (js/helikopter.js: MeshBasicMaterial, additief, dubbelzijdig, zonder doek), dus three vertaalt er geen nieuw
 programma voor. Eén materiaal voor alle agenten; `zetZaklampen` zet de sterkte.
*/
const ZL = 14;     // lengte van de bundel (m)
let zaklampMat = null, zaklampGeo = null;
export function zaklampMateriaal() {
  return zaklampMat || (zaklampMat = new THREE.MeshBasicMaterial({
    color: 0xfff1cf, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide,
  }));
}
export function maakZaklamp() {
  if (!zaklampGeo) {
    zaklampGeo = new THREE.ConeGeometry(Math.tan(SLIM.zaklampHoek) * ZL, ZL, 12, 1, true);
    zaklampGeo.translate(0, -ZL / 2, 0);       // de punt op de oorsprong
    zaklampGeo.rotateX(Math.PI / 2);           // de opening naar voren (−z, de kijkrichting van een Persoon)
  }
  const m = new THREE.Mesh(zaklampGeo, zaklampMateriaal());
  m.position.set(0.22, 1.25, -0.25);
  m.rotation.x = -0.2;                         // een beetje naar beneden
  m.renderOrder = 3;
  m.visible = false;
  m.userData.zaklamp = true;
  return m;
}
export function zetZaklampen(sterkte) { zaklampMateriaal().opacity = 0.2 * sterkte; }
/** Staat (x, z) in de bundel van iemand op `pos` die naar `yaw` kijkt? */
export function inBundel(pos, yaw, x, z, lengte = SLIM.zaklamp) {
  const dx = x - pos.x, dz = z - pos.z, d = Math.hypot(dx, dz);
  if (d > lengte || d < 0.3) return d < 0.3;
  let v = Math.atan2(-dx, -dz) - yaw;
  while (v > Math.PI) v -= Math.PI * 2;
  while (v < -Math.PI) v += Math.PI * 2;
  return Math.abs(v) < SLIM.zaklampHoek;
}
