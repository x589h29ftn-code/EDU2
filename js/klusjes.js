/*
 Klusjes: optionele opdrachten tussen de missies door (stap 99).

 Gevraagd (28 sep 2026): "random missies om geld te verdienen. Optionele klusjes die je
 tussen elke missie door kan doen. Zo kan je voorafgaand aan huis koop missie geld
 opbouwen. Drugstas of auto van a naar b met random politie of gangs, auto overspuiten
 en ergens parkeren, iemand omleggen en dan 3 sterren afschudden. Beloning tussen 250 en
 1000 afhankelijk van zwaarte. Mag niet overlappen met andere missie. Missiegebied niet
 op de randen."

 Hoe het loopt:

   1. Is het verhaal vrij (tussen twee missies, of een missie die op je wacht onder zijn
      M; `api.vrij`), dan staat er na een paar tellen iemand op een willekeurige stoep:
      Mark of Johan, met een groen speldje K op de kaart.
   2. E bij hem: hij vertelt wat er moet gebeuren, en de klus loopt. Zolang hij loopt
      wacht het verhaal (js/verhaal.js): er komt geen telefoontje en de M doet niets.
   3. Klaar: hij belt, het geld staat erop, en er wordt een checkpoint geschreven.
      Mislukt of afgebroken (X): niets verdiend, en even later staat er een nieuwe.

 De vier soorten, van licht naar zwaar:

   tas       een tas afleveren bij iemand aan de andere kant van de stad; onderweg soms
             een ster, of een groepje dat bij de overdracht op je wacht       € 250–500
   auto      een auto naar de andere kant van de stad brengen, heel; soms staat
             hij als gestolen opgegeven (twee sterren)                         € 400–650
   spuiten   een auto stelen (een ster), laten overspuiten bij de BP (op rekening) en
             ergens langs de stoep neerzetten                                  € 550–750
   omleggen  iemand op straat neerleggen, soms met een lijfwacht; daarna drie
             sterren afschudden                                                € 750–1000

 Plekken: een stoep langs een gewone rijbaan (geen N7, geen viaduct, geen water, niet
 op een bouwvlak), minstens KLUS.rand van de rand van de wereld en KLUS.bezet van alles
 waar het verhaal iets heeft staan (`api.bezet`). Ophalen en afleveren van een auto: een
 plek langs de stoeprand waar geen auto staat (`kantPlek`; de vakken uit de kaart staan
 allemaal vol: 1781 geparkeerde auto's op 1755 vakken). Elke plek moet over de weg te
 bereiken zijn (`api.route`), en een rit is niet langer dan KLUS.maxRoute.
*/
import { Persoon } from './persoon.js';
import { Bewaking } from './bewaking.js';
import { maakMarkering } from './bom.js';
import { resolveCollisions, pointInWater, grondHoogte } from './world.js';
import { inBouwvlak } from './bouwvlak.js';
import { euro } from './hud.js';

export const KLUS = {
  rand: 350,              // zo ver van de rand van de wereld blijft elke plek (m)
  wacht: 12,              // zoveel seconden na een missie of een klus komt er een nieuw aanbod
  verplaats: 600,         // een aanbod dat zo lang ligt gaat naar een andere plek (s)
  gever: [220, 850],      // hoe ver de opdrachtgever van je af staat (m, hemelsbreed)
  bezet: 160,             // zo ver van wat het verhaal ergens heeft staan (m)
  praat: 3.4,             // zo dichtbij kun je hem aanspreken (m)
  rit: {                  // hemelsbreed van ophalen tot afleveren (m)
    tas: [650, 1300], auto: [700, 1400], spuiten: [300, 700], parkeer: [450, 1000], omleggen: [400, 900],
  },
  maxRoute: 2400,         // langer mag een rit over de weg niet zijn (m)
  loon: { tas: [250, 500], auto: [400, 650], spuiten: [550, 750], omleggen: [750, 1000] },
  aflever: 5,             // zo dicht bij de ontvanger geef je de tas af (m)
  vak: 3.6,               // zo dicht bij de groene ruit staat de auto neergezet (m)
  voorval: 0.55,          // bij dit deel van de afstand gebeurt er onderweg iets
};
export const SOORTEN = ['tas', 'auto', 'spuiten', 'omleggen'];

// hoe Mark en Johan eruitzien: dezelfde maten als in js/verhaal.js
const MARK = { shirt: 0x2f5d8a, broek: 0x39312a, huid: 0xd9b48f, haar: 0x6b5a45, hoogte: 1.03 };
const JOHAN = { shirt: 0x3d6b3a, broek: 0x2b3542, huid: 0xd3a273, haar: 0x3a2a1c, hoogte: 1.05 };
const LAK = [[0x9b1c1c, 'rode'], [0x1f4f8f, 'blauwe'], [0x2e6b35, 'groene'], [0xe8e6df, 'witte'],
  [0x16171a, 'zwarte'], [0xc9a227, 'gele'], [0x6b2e7a, 'paarse']];
const MODEL = { hatch: 'hatchback', van: 'bestelbus', bx: 'BX' };

const rond50 = (v) => Math.round(v / 50) * 50;
const kies = (lijst) => lijst[Math.floor(Math.random() * lijst.length)];
const afst = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/*
 De teksten. {straat}, {auto}, {bedrag} en {doel} worden ingevuld; `wie` is wie de klus
 geeft. Kort: een klus is geen missie, en je hoort ze vaker.
*/
const TEKST = {
  tas: [
    'Mooi dat je er bent. Ik heb een tas die weg moet.',
    'Naar {doel}. Daar staat iemand op je te wachten. Niet openmaken.',
    'Lever je hem af, dan is het {bedrag}.',
  ],
  auto: [
    'Zie je die {auto} daar? Die moet weg.',
    'Naar {doel}. Zet hem bij de groene ruit langs de stoep en loop weg. Geen krassen.',
    '{bedrag} als hij er heel staat.',
  ],
  spuiten: [
    'Aan {straat} staat een {auto}. Die is nog niet van ons.',
    'Haal hem op en laat hem overspuiten bij de wasbox achter de BP. Dat staat op mijn rekening.',
    'Daarna zet je hem neer aan {doel}, bij de groene ruit. {bedrag}.',
  ],
  omleggen: [
    'Er loopt iemand rond aan {straat}. Hij heeft te veel gezien.',
    'Leg hem om. Daarna zitten ze achter je aan, drie sterren. Schud ze af en ik betaal {bedrag}.',
  ],
  lijfwacht: 'Hij loopt niet alleen. Er is iemand bij hem die een wapen draagt.',
  politie: 'Shit, er rijdt politie achter je. Schud ze af voor je aflevert.',
  gestolen: 'Die auto staat als gestolen opgegeven. Raak ze kwijt voor je hem neerzet.',
  bende: 'Ze weten dat je komt. Kijk uit bij de overdracht.',
  klaar: 'Netjes gedaan. {bedrag} staat voor je klaar.',
  ontvanger: 'Mooi. Doe de groeten.',
  nietMetPolitie: 'Niet met die blauwe achter je aan. Raak ze eerst kwijt.',
};
const vul = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => (v[k] != null ? v[k] : ''));

export function initKlusjes({ scene, player, vehicles, hud, KAART, api }) {
  const g = KAART.gebied;
  const R = KLUS.rand;
  const binnen = (x, z) => x > g.x0 + R && x < g.x1 - R && z > g.z0 + R && z < g.z1 - R;

  // gewone straten: geen snelweg of afrit, niet te smal en niet te breed
  const straten = KAART.wegassen.filter(w => w.drive && w.naam && !/^(N\d|A\d|Afrit|Rijksweg)/.test(w.naam)
    && w.w >= 4 && w.w <= 12 && w.lengte > 60 && w.pts.length >= 2);

  // de mensen en de markering: één keer gemaakt, zodat er tijdens het spelen niets
  // nieuws hoeft te worden vertaald (stap 83)
  const gevers = { mark: new Persoon(MARK), johan: new Persoon(JOHAN) };
  const ontvanger = new Persoon({ shirt: 0x5a4a3a, broek: 0x1f2328, huid: 0xc79a72, haar: 0x1a1410, hoogte: 1.0, pet: true, petKleur: 0x202225 });
  for (const p of [gevers.mark, gevers.johan, ontvanger]) { p.groep.visible = false; scene.add(p.groep); }
  const merk = maakMarkering(scene, 0x39d353);
  merk.toon(false);

  let aanbod = null;          // { soort, wie, plek, t }
  let klus = null;            // de lopende klus
  let wachtT = KLUS.wacht;
  let vorigeSoort = null;
  let gedaan = 0, verdiend = 0;
  let wegNaT = [];            // wie nog even blijft staan tot je weg bent
  let vastSoort = null;       // voor de proef: deze soort als volgende
  // waar een groepje van een klus staat: dat blijft er tot je uit de buurt bent, ook na de
  // klus (js/bendes.js haalt anders alles in één keer weg, ook wat je ziet)
  let bendePlek = null;

  // ---------------------------------------------------------------- plekken
  // een punt op een wegas, op een deel `f` van zijn lengte, met de richting daar
  function langsAs(w, f) {
    const pts = w.pts;
    let tot = 0;
    const lengtes = [];
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); lengtes.push(l); tot += l; }
    let s = f * tot;
    for (let i = 1; i < pts.length; i++) {
      const l = lengtes[i - 1];
      if (s <= l || i === pts.length - 1) {
        const t = l > 0 ? Math.min(1, s / l) : 0;
        const dx = (pts[i][0] - pts[i - 1][0]) / (l || 1), dz = (pts[i][1] - pts[i - 1][1]) / (l || 1);
        return { x: pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, z: pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t, dx, dz };
      }
      s -= l;
    }
    return null;
  }
  function vrijVanVerhaal(x, z) {
    for (const b of api.bezet()) if (Math.hypot(b.x - x, b.z - z) < (b.r || KLUS.bezet)) return false;
    return true;
  }
  function goedePlek(x, z) {
    return binnen(x, z) && !pointInWater(x, z) && !inBouwvlak(x, z) && grondHoogte(x, z, Infinity) < 0.5 && vrijVanVerhaal(x, z);
  }
  // een plek op de stoep langs een gewone straat
  function stoepPlek() {
    const w = kies(straten);
    const p = langsAs(w, 0.25 + Math.random() * 0.5);
    if (!p) return null;
    const kant = Math.random() < 0.5 ? 1 : -1;
    const o = w.w / 2 + 1.7;
    const nx = -p.dz * kant, nz = p.dx * kant;          // opzij van de as
    const [x, z] = resolveCollisions(p.x + nx * o, p.z + nz * o, 0.4);
    if (Math.hypot(x - (p.x + nx * o), z - (p.z + nz * o)) > 1.2) return null;   // in een gebouw of een heg
    if (!goedePlek(x, z)) return null;
    return { x, z, yaw: Math.atan2(nx, nz), as: { x: p.x, z: p.z }, langs: { x: p.dx, z: p.dz }, straat: w.naam, w: w.w, kant };
  }
  function routeLengte(a, b) {
    const r = api.route(a, b);
    if (!r || r.length < 2) return Infinity;
    let l = 0;
    for (let i = 1; i < r.length; i++) l += Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]);
    return l;
  }
  // zoek een plek in een ring om `van`, die over de weg te bereiken is
  function zoekPlek(van, [dMin, dMax], maak = stoepPlek, pogingen = 400) {
    let routes = 0;
    for (let i = 0; i < pogingen; i++) {
      const p = maak();
      if (!p) continue;
      const d = afst(p, van);
      if (d < dMin || d > dMax) continue;
      if (routes++ > 8) break;
      if (routeLengte(van, p) <= KLUS.maxRoute) return p;
    }
    return null;
  }
  /*
   Een plek langs de stoeprand, op de weg, waar een auto kan staan: geen auto binnen vier
   meter, geen muur of paal. `kant` +1 is rechts van de richting van de as, en daar staat
   een auto met zijn neus die kant op (rechts rijden). Zonder `rond` een willekeurige
   straat; met `rond` (een stoepplek) dezelfde straat, een paar meter ernaast.
  */
  function kantOp(w, p, kant) {
    const o = w / 2 - 1.15;
    const nx = -p.dz * kant, nz = p.dx * kant;
    const x = p.x + nx * o, z = p.z + nz * o;
    if (!goedePlek(x, z)) return null;
    const [rx, rz] = resolveCollisions(x, z, 1.0, 3.5);
    if (Math.hypot(rx - x, rz - z) > 0.3) return null;
    for (const c of vehicles.cars) if (Math.abs(c.x - x) < 4 && Math.abs(c.z - z) < 4) return null;
    const yaw = kant > 0 ? Math.atan2(-p.dx, -p.dz) : Math.atan2(p.dx, p.dz);
    return { x, z, yaw, straat: null };
  }
  function kantPlek() {
    const w = kies(straten);
    const p = langsAs(w, 0.2 + Math.random() * 0.6);
    return p ? kantOp(w.w, p, Math.random() < 0.5 ? 1 : -1) : null;
  }
  function kantBij(rond) {
    for (const stap of [7, -7, 12, -12, 18, -18, 25, -25]) {
      const p = { x: rond.as.x + rond.langs.x * stap, z: rond.as.z + rond.langs.z * stap, dx: rond.langs.x, dz: rond.langs.z };
      const q = kantOp(rond.w, p, rond.kant);
      if (q) { q.straat = rond.straat; return q; }
    }
    return null;
  }
  // de straat erbij pas als de plek gekozen is: dat zoeken loopt alle straten af
  const metStraat = (p) => { if (p && !p.straat) p.straat = straatBij(p.x, p.z); return p; };
  // welke straat hoort hierbij: de dichtstbijzijnde as met een naam
  function straatBij(x, z) {
    let beste = null, bd = Infinity;
    for (const w of straten) {
      const pts = w.pts;
      for (let i = 1; i < pts.length; i++) {
        const ax = pts[i - 1][0], az = pts[i - 1][1], bx = pts[i][0] - ax, bz = pts[i][1] - az;
        const l2 = bx * bx + bz * bz || 1e-9;
        const t = Math.max(0, Math.min(1, ((x - ax) * bx + (z - az) * bz) / l2));
        const d = Math.hypot(ax + bx * t - x, az + bz * t - z);
        if (d < bd) { bd = d; beste = w.naam; }
      }
    }
    return beste || 'de stad';
  }
  const deStraat = (naam) => (/^(de|het) /i.test(naam) ? naam : `de ${naam}`);

  // ---------------------------------------------------------------- het aanbod
  function kiesSoort() {
    if (vastSoort) { const s = vastSoort; vastSoort = null; return s; }
    const kan = SOORTEN.filter(s => s !== vorigeSoort);
    return kies(kan);
  }
  function maakAanbod() {
    const sp = api.spelerPunt();
    const plek = zoekPlek(sp, KLUS.gever);
    if (!plek) return false;
    // Johan pas als je hem kent, en niet wie er voor het verhaal al ergens staat
    // (en niet wie van de vorige klus nog in beeld staat: die springt anders voor je ogen weg)
    const kan = ['mark', 'johan'].filter(w => (w === 'mark' || api.johanBekend()) && !api.inBeeld(w)
      && !wegNaT.includes(gevers[w]));
    if (!kan.length) return false;
    const wie = kies(kan);
    aanbod = { soort: kiesSoort(), wie, plek, t: 0 };
    const p = gevers[wie];
    p.zetNeer(plek.x, plek.z, plek.yaw);
    p.groep.visible = true;
    hud.zetKlus({ x: plek.x, z: plek.z, wie });
    return true;
  }
  function haalAanbodWeg() {
    if (!aanbod) return;
    wegNa(gevers[aanbod.wie]);
    aanbod = null;
    hud.zetKlus(null);
    api.praat(null);
  }
  // iemand die er staat verdwijnt pas als je uit de buurt bent: voor je ogen weg leest als een fout
  function wegNa(persoon) { if (persoon && persoon.groep.visible && !wegNaT.includes(persoon)) wegNaT.push(persoon); }
  function ruimWegNa(sp) {
    for (let i = wegNaT.length - 1; i >= 0; i--) {
      const p = wegNaT[i];
      if (aanbod && gevers[aanbod.wie] === p) { wegNaT.splice(i, 1); continue; }
      if (klus && klus.ontvanger === p) { wegNaT.splice(i, 1); continue; }
      if (afst(sp, p.groep.position) > 70) { p.groep.visible = false; wegNaT.splice(i, 1); }
    }
  }

  // ---------------------------------------------------------------- een klus beginnen
  function kop(wie) { return wie === 'johan' ? api.KOPPEN.johan : api.KOPPEN.mark; }
  function naam(wie) { return wie === 'johan' ? 'Johan' : 'Mark'; }
  function zegt(wie, tekst, telefoon = false) { return { wie: naam(wie), kop: kop(wie), tekst, telefoon }; }
  // een regel onderweg: als de balk open is, wacht hij tot hij dicht is
  function meld(wie, tekst) {
    if (!klus) return;
    klus.meldingen.push(zegt(wie, tekst, true));
  }

  function neemAan() {
    const a = aanbod;
    aanbod = null;
    hud.zetKlus(null);
    api.praat(null);
    klus = { soort: a.soort, wie: a.wie, gever: gevers[a.wie], van: a.plek, fase: 'uitleg', t: 0, meldingen: [], navT: 0 };
    api.pauzeer(true);
    const k = klus;
    const ok = k.soort === 'tas' ? zetTas(k) : k.soort === 'auto' ? zetAuto(k) : k.soort === 'spuiten' ? zetSpuiten(k) : zetOmleggen(k);
    if (!ok) {
      // geen plek gevonden (dat hoort niet te gebeuren, maar een klus die niet kan gaat niet door)
      klus = null; api.pauzeer(false);
      api.zeg([zegt(a.wie, 'Laat maar. Er is vandaag niets.')]);
      wegNa(gevers[a.wie]);
      wachtT = KLUS.wacht;
      return;
    }
    const v = { straat: deStraat(k.straat || ''), doel: deStraat(k.doelStraat || ''), auto: k.autoNaam || '', bedrag: euro(k.loon) };
    const regels = TEKST[k.soort].map(t => zegt(a.wie, vul(t, v)));
    if (k.lijfwacht) regels.splice(1, 0, zegt(a.wie, TEKST.lijfwacht));
    api.zeg(regels, () => { if (klus === k) begin(k); });
  }

  // -- de tas
  function zetTas(k) {
    const doel = zoekPlek(k.van, KLUS.rit.tas);
    if (!doel) return false;
    k.doel = doel; k.doelStraat = doel.straat;
    k.d0 = afst(k.van, doel);
    const r = Math.random();
    k.voorval = r < 0.35 ? 'politie' : r < 0.7 ? 'bende' : null;
    const f = Math.max(0, Math.min(1, (k.d0 - KLUS.rit.tas[0]) / (KLUS.rit.tas[1] - KLUS.rit.tas[0])));
    k.loon = rond50(Math.min(KLUS.loon.tas[1], KLUS.loon.tas[0] + f * 150 + (k.voorval ? 100 : 0)));
    return true;
  }
  // -- een auto naar de andere kant van de stad
  function zetAuto(k) {
    const op = kantBij(k.van);
    if (!op) return false;
    const doel = metStraat(zoekPlek(op, KLUS.rit.auto, kantPlek, 600));
    if (!doel) return false;
    const [kleur, kleurNaam] = kies(LAK);
    const soort = kies(['hatch', 'hatch', 'van']);
    k.op = op; k.doel = doel; k.doelStraat = doel.straat;
    k.kleur = kleur; k.autoNaam = `${kleurNaam} ${MODEL[soort]}`; k.autoSoort = soort;
    k.d0 = afst(op, doel);
    k.voorval = Math.random() < 0.5 ? 'gestolen' : null;
    const f = Math.max(0, Math.min(1, (k.d0 - KLUS.rit.auto[0]) / (KLUS.rit.auto[1] - KLUS.rit.auto[0])));
    k.loon = rond50(Math.min(KLUS.loon.auto[1], KLUS.loon.auto[0] + f * 150 + (k.voorval ? 100 : 0)));
    return true;
  }
  // -- stelen, overspuiten, neerzetten
  function zetSpuiten(k) {
    const op = metStraat(zoekPlek(k.van, KLUS.rit.spuiten, kantPlek, 600));
    const bp = (KAART.tankstations || [])[0];
    if (!op || !bp) return false;
    const bpP = { x: bp.x ?? bp.cx, z: bp.z ?? bp.cz };
    // het vak moet een eind van de BP af liggen, en dan hoeft het zelf niet bij de start te liggen
    const doel = metStraat(zoekPlek(bpP, KLUS.rit.parkeer, kantPlek, 600));
    if (!doel) return false;
    const [kleur, kleurNaam] = kies(LAK);
    const soort = kies(['hatch', 'bx', 'van']);
    k.op = op; k.bp = bpP; k.doel = doel; k.straat = op.straat; k.doelStraat = doel.straat;
    k.kleur = kleur; k.autoNaam = `${kleurNaam} ${MODEL[soort]}`; k.autoSoort = soort;
    const d = afst(k.van, op) + afst(op, bpP) + afst(bpP, doel);
    const f = Math.max(0, Math.min(1, (d - 1000) / 1800));
    k.loon = rond50(KLUS.loon.spuiten[0] + f * (KLUS.loon.spuiten[1] - KLUS.loon.spuiten[0]));
    return true;
  }
  // -- iemand omleggen
  function zetOmleggen(k) {
    const doel = zoekPlek(k.van, KLUS.rit.omleggen);
    if (!doel) return false;
    k.doel = doel; k.straat = doel.straat;
    k.lijfwacht = Math.random() < 0.5;
    k.loon = k.lijfwacht ? KLUS.loon.omleggen[1] : KLUS.loon.omleggen[0];
    return true;
  }

  function begin(k) {
    k.fase = 'loopt';
    wegNa(k.gever);
    if (k.soort === 'tas') {
      ontvanger.zetNeer(k.doel.x, k.doel.z, k.doel.yaw + Math.PI);
      ontvanger.groep.visible = true;
      k.ontvanger = ontvanger;
      merk.zet(k.doel.x, 0, k.doel.z); merk.toon(true);
      api.nav(k.doel.x, k.doel.z, `klus · ${k.doel.straat}`, 'K');
      api.zetOpdracht(`breng de tas naar ${deStraat(k.doel.straat)} · X: afbreken`);
      api.melding('KLUS', `De tas naar ${deStraat(k.doel.straat)} · ${euro(k.loon)}`, 5);
    } else if (k.soort === 'auto' || k.soort === 'spuiten') {
      k.auto = vehicles.voegToe({ x: k.op.x, z: k.op.z, yaw: k.op.yaw, soort: k.autoSoort, kleur: k.kleur });
      k.kleur0 = k.auto.kleur;
      k.fase = 'ophalen';
      api.nav(k.op.x, k.op.z, `klus · ${k.autoNaam}`, 'K');
      api.zetOpdracht(k.soort === 'auto'
        ? `stap in de ${k.autoNaam} · X: afbreken`
        : `steel de ${k.autoNaam} aan ${deStraat(k.straat)} · X: afbreken`);
      api.melding('KLUS', k.soort === 'auto' ? `De ${k.autoNaam} wegbrengen · ${euro(k.loon)}` : `Stelen, overspuiten, neerzetten · ${euro(k.loon)}`, 5);
    } else {
      const a = k.doel, l = k.doel.langs;
      const b = { x: a.x + l.x * 9, z: a.z + l.z * 9 };
      const [bx, bz] = resolveCollisions(b.x, b.z, 0.4);
      const posten = [{ a: [a.x, a.z], b: [bx, bz] }];
      if (k.lijfwacht) {
        const [cx, cz] = resolveCollisions(a.x - l.x * 1.4 + l.z * 0.9, a.z - l.z * 1.4 - l.x * 0.9, 0.4);
        posten.push({ a: [cx, cz], b: [bx - l.x * 1.4, bz - l.z * 1.4] });
      }
      k.bewaking = new Bewaking(scene, posten, {
        vest: null, pet: 'om de beurt', schade: 4, zicht: 24, vuurbereik: 28, dekking: 8,
        // het doelwit in een grijs jasje (zo staat het in de opdracht), de lijfwacht in het donker
        kleuren: [{ shirt: 0x767b82, broek: 0x2a2d33 }, { shirt: 0x1f2328, broek: 0x1a1c20 }],
      });
      api.nav(a.x, a.z, `klus · ${deStraat(k.straat)}`, 'K');
      api.zetOpdracht(`leg de man in het grijze jasje om, aan ${deStraat(k.straat)} · X: afbreken`);
      api.melding('KLUS', `Iemand omleggen aan ${deStraat(k.straat)} · ${euro(k.loon)}`, 5);
    }
  }

  // ---------------------------------------------------------------- tijdens de klus
  function werkTasBij(k, sp, dt) {
    const d = afst(sp, k.doel);
    ontvanger.kijkNaar(sp.x, sp.z, dt, 2);
    ontvanger.update(dt, {});
    if (!k.gebeurd && d < k.d0 * KLUS.voorval) {
      k.gebeurd = true;
      if (k.voorval === 'politie') {
        api.sterGeven(1, sp.x, sp.z);
        meld(k.wie, TEKST.politie);
      } else if (k.voorval === 'bende') {
        // een groepje een paar huizen voor de ontvanger, op dezelfde stoep
        const l = k.doel.langs, kant = Math.random() < 0.5 ? 1 : -1;
        const [x, z] = resolveCollisions(k.doel.x + l.x * 16 * kant, k.doel.z + l.z * 16 * kant, 0.4);
        api.bende.zetGroep(x, z, 2 + Math.floor(Math.random() * 2));
        k.bende = true;
        bendePlek = { x, z };
        meld(k.wie, TEKST.bende);
      }
    }
    if (d < KLUS.aflever + 2 && api.balkDicht()) {
      if (player.inCar) api.praat('stap uit om de tas af te geven');
      else if (api.sterren() > 0) api.praat('eerst de politie kwijt — dan pas afgeven');
      else api.praat('E — tas afgeven');
    } else if (k.bijOntvanger) api.praat(null);
    k.bijOntvanger = d < KLUS.aflever + 2;
  }
  function tasToets(k, sp) {
    if (afst(sp, k.doel) > KLUS.aflever + 2 || player.inCar) return false;
    if (api.sterren() > 0) { api.zeg([{ wie: 'Koper', tekst: TEKST.nietMetPolitie }]); return true; }
    api.praat(null);
    api.zeg([{ wie: 'Koper', tekst: TEKST.ontvanger }], () => geslaagd(k));
    return true;
  }

  function werkAutoBij(k, sp, dt) {
    const auto = k.auto;
    if (!auto || auto.wrak || auto.hp <= 0) { mislukt('De auto is total loss.'); return; }
    if (k.fase === 'ophalen') {
      if (player.inCar === auto) {
        if (k.soort === 'spuiten') {
          k.fase = 'spuiten';
          api.sterGeven(1, auto.x, auto.z);
          api.nav(k.bp.x, k.bp.z, 'BP · wasbox', 'S');
          api.zetOpdracht('laat hem overspuiten bij de wasbox achter de BP · X: afbreken');
        } else {
          k.fase = 'rijden';
          naarHetVak(k);
          if (k.voorval === 'gestolen') k.gebeurdNa = true;
        }
      }
      return;
    }
    if (k.fase === 'spuiten') {
      if (auto.kleur !== k.kleur0) { k.fase = 'rijden'; naarHetVak(k); }
      return;
    }
    if (k.fase === 'rijden') {
      const d = afst(auto, k.doel);
      if (k.gebeurdNa && !k.gebeurd && d < k.d0 * KLUS.voorval) {
        k.gebeurd = true;
        api.sterGeven(2, auto.x, auto.z);
        meld(k.wie, TEKST.gestolen);
      }
      const staat = d < KLUS.vak && Math.abs(auto.speed || 0) < 0.6;
      if (staat && !player.inCar) {
        if (api.sterren() > 0) {
          if (!k.teVroeg) { k.teVroeg = true; api.zetOpdracht('schud eerst de politie af, dan pas neerzetten', true); }
          return;
        }
        merk.toon(false);
        geslaagd(k);
      } else if (k.teVroeg && api.sterren() === 0) {
        k.teVroeg = false;
        api.zetOpdracht(`zet de ${k.autoNaam} bij de groene ruit aan ${deStraat(k.doelStraat)} en stap uit · X: afbreken`);
      }
    }
  }
  function naarHetVak(k) {
    k.d0 = afst(k.auto, k.doel);
    merk.zet(k.doel.x, 0, k.doel.z); merk.toon(true);
    api.nav(k.doel.x, k.doel.z, `klus · ${k.doelStraat}`, 'K');
    api.zetOpdracht(`zet de ${k.autoNaam} bij de groene ruit aan ${deStraat(k.doelStraat)} en stap uit · X: afbreken`);
  }

  function werkOmleggenBij(k, sp, dt) {
    const bw = k.bewaking;
    const doelwit = bw.wachters[0];
    const pos = doelwit.persoon.groep.position;
    const dSp = afst(sp, pos);
    k.schade += bw.update(dt, player, dSp < 32);
    if (!k.gedood) {
      k.navT -= dt;
      if (k.navT <= 0) { k.navT = 2; api.nav(pos.x, pos.z, `klus · ${deStraat(k.straat)}`, 'K'); }
      if (doelwit.staat === 'neer') {
        k.gedood = true; k.naT = 0;
        api.sterGeven(3, pos.x, pos.z);
        api.navUit();
        api.zetOpdracht('schud de politie af · X: afbreken');
        api.melding('Raak', 'Nu weg hier: drie sterren.', 4);
      }
      return;
    }
    k.naT += dt;
    if (k.naT > 2 && api.sterren() === 0) geslaagd(k);
  }

  // ---------------------------------------------------------------- einde
  function ruimKlusOp(k, { direct = false } = {}) {
    merk.toon(false);
    api.praat(null);
    if (k.bewaking) {
      // wie er ligt blijft even liggen; wie nog staat mag weg zodra je uit beeld bent
      if (direct) k.bewaking.verwijder();
      else { const bw = k.bewaking; k.bewakingWeg = bw; }
    }
    if (k.ontvanger) { if (direct) k.ontvanger.groep.visible = false; else wegNa(k.ontvanger); }
    k.bende = false;
  }
  let oudeBewaking = [];
  function geslaagd(k) {
    if (klus !== k) return;
    ruimKlusOp(k);
    if (k.bewakingWeg) oudeBewaking.push(k.bewakingWeg);
    klus = null;
    gedaan++; verdiend += k.loon;
    vorigeSoort = k.soort;
    wachtT = KLUS.wacht;
    api.navUit();
    api.zetOpdracht('');
    api.telefoon();
    api.zeg([zegt(k.wie, vul(TEKST.klaar, { bedrag: euro(k.loon) }), true)], () => {
      api.verdien(k.loon);
      api.melding('KLUS GESLAAGD', `+ ${euro(k.loon)}`, 6);
      api.pauzeer(false);
      api.checkpoint();
    });
  }
  function mislukt(reden, kopTekst = 'KLUS MISLUKT') {
    const k = klus;
    if (!k) return;
    ruimKlusOp(k);
    if (k.bewakingWeg) oudeBewaking.push(k.bewakingWeg);
    klus = null;
    vorigeSoort = k.soort;
    wachtT = KLUS.wacht * 2;
    api.navUit();
    api.zetOpdracht('');
    api.melding(kopTekst, reden, 5);
    api.pauzeer(false);
  }

  // ---------------------------------------------------------------- elk beeld
  function update(dt) {
    const sp = api.spelerPunt();
    ruimWegNa(sp);
    if (bendePlek && !(klus && klus.bende) && afst(sp, bendePlek) > 160) bendePlek = null;
    for (let i = oudeBewaking.length - 1; i >= 0; i--) {
      const bw = oudeBewaking[i];
      const w = bw.wachters[0];
      if (!w || afst(sp, w.persoon.groep.position) > 90) { bw.verwijder(); oudeBewaking.splice(i, 1); }
      else bw.update(dt, player, false);
    }
    if (!klus) {
      if (!api.vrij()) { if (aanbod) haalAanbodWeg(); wachtT = Math.max(wachtT, KLUS.wacht); return 0; }
      if (!aanbod) {
        wachtT -= dt;
        if (wachtT <= 0) { if (!maakAanbod()) wachtT = 4; }
        return 0;
      }
      aanbod.t += dt;
      const p = gevers[aanbod.wie];
      const d = afst(sp, p.groep.position);
      if (aanbod.t > KLUS.verplaats && d > 250) { haalAanbodWeg(); wachtT = 1; return 0; }
      if (d < 30) p.kijkNaar(sp.x, sp.z, dt, 2);
      p.update(dt, { zwaait: d < 22 && d > KLUS.praat });
      if (d < KLUS.praat && api.balkDicht()) api.praat(`E — klus van ${naam(aanbod.wie)}`);
      else if (d < KLUS.praat + 3) api.praat(null);
      return 0;
    }
    const k = klus;
    k.t += dt;
    k.schade = 0;
    if (k.gever.groep.visible) { k.gever.kijkNaar(sp.x, sp.z, dt, 2); k.gever.update(dt, {}); }
    if (k.fase === 'uitleg') return 0;
    // wat er onderweg gezegd wordt, als de balk vrij is
    if (k.meldingen.length && api.balkDicht()) api.zeg(k.meldingen.splice(0), null, { auto: 3.4 });
    if (k.fase !== 'uitleg' && k.soort !== 'omleggen') {
      k.navT -= dt;
      if (k.navT <= 0) { k.navT = 2; api.navBij(); }
    }
    if (k.soort === 'tas') werkTasBij(k, sp, dt);
    else if (k.soort === 'auto' || k.soort === 'spuiten') werkAutoBij(k, sp, dt);
    else werkOmleggenBij(k, sp, dt);
    if (merk.zichtbaar) merk.update(dt);
    return k.schade || 0;
  }

  function toets() {
    const sp = api.spelerPunt();
    if (!klus && aanbod && api.vrij()) {
      const p = gevers[aanbod.wie];
      if (afst(sp, p.groep.position) < KLUS.praat) { neemAan(); return true; }
      return false;
    }
    if (klus && klus.soort === 'tas' && klus.fase === 'loopt') return tasToets(klus, sp);
    return false;
  }

  function reset() {
    if (klus) ruimKlusOp(klus, { direct: true });
    for (const bw of oudeBewaking) bw.verwijder();
    oudeBewaking = [];
    klus = null; aanbod = null; bendePlek = null;
    for (const p of [gevers.mark, gevers.johan, ontvanger]) p.groep.visible = false;
    wegNaT = [];
    hud.zetKlus(null);
    wachtT = KLUS.wacht;
  }

  return {
    update, toets, reset,
    afbreken() { if (!klus) return false; mislukt('Je hebt de klus laten lopen.', 'KLUS AFGEBROKEN'); return true; },
    doelen() {
      const uit = [];
      if (klus && klus.bewaking) uit.push(...klus.bewaking.doelen());
      for (const bw of oudeBewaking) uit.push(...bw.doelen());
      return uit;
    },
    raak(obj) {
      if (klus && klus.bewaking && klus.bewaking.raak(obj)) return true;
      for (const bw of oudeBewaking) if (bw.raak(obj)) return true;
      return false;
    },
    hoorSchot(x, z) { if (klus && klus.bewaking) klus.bewaking.hoorSchot(x, z); },
    // het overspuiten van de klusauto staat op rekening (js/spuiterij.js)
    spuitPrijs(auto) { return klus && klus.soort === 'spuiten' && auto && auto === klus.auto ? 0 : null; },
    get bezig() { return !!klus; },
    get bende() { return !!((klus && klus.bende) || bendePlek); },
    get aanbod() { return aanbod ? { soort: aanbod.soort, wie: aanbod.wie, x: aanbod.plek.x, z: aanbod.plek.z, straat: aanbod.plek.straat, t: aanbod.t } : null; },
    get klus() { return klus; },
    // wie de klus aanbiedt (een Persoon), voor de foto's
    get gever() { return aanbod ? gevers[aanbod.wie] : null; },
    get wachtT() { return wachtT; },
    get gedaan() { return gedaan; },
    get verdiend() { return verdiend; },
    get binnenGebied() { return binnen; },
    // voor de proef
    __soort(s) { vastSoort = s; },
    __plek: () => stoepPlek(),
    __vak: () => metStraat(kantPlek()),
    // (de vorige opdrachtgever gaat meteen weg: in de proef sta je er vaak nog naast)
    __nieuwAanbod() {
      if (aanbod) gevers[aanbod.wie].groep.visible = false;
      haalAanbodWeg();
      wegNaT = wegNaT.filter(p => p.groep.visible);
      wachtT = 0;
      return maakAanbod();
    },
    __zetAanbodBij(x, z) {
      if (!aanbod) return false;
      const p = gevers[aanbod.wie];
      aanbod.plek = { ...aanbod.plek, x, z };
      p.zetNeer(x, z, aanbod.plek.yaw);
      hud.zetKlus({ x, z, wie: aanbod.wie });
      return true;
    },
  };
}
