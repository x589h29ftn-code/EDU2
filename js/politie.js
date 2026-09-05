/*
 Politie en het gezocht-systeem.

 De wijk reageert nu op wat je doet. Elke misdaad levert *verdenking* op, maar
 niet elke misdaad wordt gemeld: dat hangt af van hoeveel mensen het zien.

   - Eén iemand neerschieten waar niemand bij is, gaat vaak ongemerkt voorbij.
   - Sta je midden op straat, dan belt de eerste de beste omstander.
   - En wie er al eentje op zijn geweten heeft, valt bij de tweede veel eerder
     op: de kans loopt op met het aantal getuigen én met wat je al deed.

 De verdenking staat in `heat`, en die vertaalt zich in sterren (1 tot 5).
 Zodra je gezocht wordt komen er eenheden: te voet bij één ster, met auto's en
 zwaailicht daarboven. Ze rijden naar de plaats delict — de laatste plek waar ze
 jou wisten — en gaan daar zoeken. Zien ze je (kijkhoek plus vrij zicht) of
 horen ze je schieten, dan zetten ze de achtervolging in, te voet of met de
 auto, en schieten ze op je zodra ze dichtbij genoeg zijn.

 Ontsnappen doe je door uit het zicht te blijven: zolang niemand je ziet loopt
 de verdenking terug, en na de aftelling zijn ze je kwijt en rijden ze weg. Zien
 ze je opnieuw, dan begint dat aftellen overnieuw.

 Een agent neerschieten is de duurste misdaad die er is.
*/
import * as THREE from 'three';
import { Persoon } from './persoon.js';
import { resolveCollisions, zichtVrij } from './world.js';
import { KAART } from './kaartwereld.js';
import { Navigatie } from './navigatie.js';
import { geluid } from './audio.js';

// ---- verdenking ----
const MISDADEN = {
  schot:         { heat: 5,  straal: 32, ernst: 0.6 },   // je hebt geschoten
  neergeschoten: { heat: 34, straal: 46, ernst: 1.0 },   // iemand doodgeschoten
  aangereden:    { heat: 26, straal: 40, ernst: 0.9 },   // iemand aangereden
  agent:         { heat: 70, straal: 70, ernst: 1.0 },   // een agent neergeschoten
};
const STERREN = [30, 80, 150, 240, 350];   // heat-drempels voor 1 t/m 5 sterren
const MAX_HEAT = 420;
const VERGETEN = 18;      // seconden uit het zicht voor de eerste ster wegvalt
const KOEL = 26;          // heat per seconde die eraf gaat als niemand je ziet

// ---- eenheden ----
// Hoe meer sterren, hoe meer blauw op straat. Bij één ster rijdt er al een
// surveillancewagen rond; bij vijf is de halve wijk aan het zoeken.
const TE_VOET = [0, 3, 4, 5, 6, 8];        // agenten te voet per ster
const WAGENS = [0, 1, 2, 3, 4, 5];         // surveillanceauto's per ster
// Hoe wijd ze zoeken rond de laatst bekende plek (m). Met meer sterren wordt
// het net groter: ze kammen dan ook de straten eromheen uit.
const ZOEKSTRAAL = [0, 55, 85, 120, 155, 195];
const ZICHT = 42;                          // hoe ver een agent je ziet (m)
const GEZICHTSVELD = 1.15;                 // halve openingshoek (rad)
const GEHOOR = 65;                         // een schot horen ze verder (m)
const REN = 4.3;                           // rennende agent (m/s)
const LOOP = 1.7;                          // zoekende agent (m/s)
const DEKKING = 11;                        // dichterbij komen ze niet, ze schieten
const VUURTIJD = 1.8;                      // seconden tussen twee schoten
const VUURDERS = 3;                        // zoveel agenten schieten er tegelijk op je
const VUURBEREIK = 34;
const SCHADE = 4;
const SPAWN_MIN = 55, SPAWN_MAX = 150;     // afstand waarop ze opduiken (m)
/*
 Een surveillanceauto waar de agenten uit gestapt zijn blijft staan en is te
 stelen. Hij verdwijnt weer, anders staat de wijk na een lange achtervolging vol
 met lege politieauto's: na LEEG_WEG seconden (of meteen zodra ze je kwijt zijn),
 en alleen als je er niet vlakbij staat — een auto die voor je neus oplost is
 erger dan een auto te veel.
*/
const LEEG_WEG = 45;
const LEEG_KWIJT = 8;                      // zodra de sterren weg zijn gaat het sneller
const LEEG_AFSTAND = 45;
const UNIFORM = { shirt: 0x1b2a4a, broek: 0x141c2c };

export function initPolitie({ scene, player, npcs, vehicles, hud }) {
  let heat = 0;
  let gezienT = 0;             // seconden sinds een agent je voor het laatst zag
  let laatstBekend = null;     // { x, z } waar ze jou het laatst wisten
  const agenten = [];          // { persoon, staat, ... }
  const wagens = [];           // { car, licht, agenten, staat }
  const verlaten = [];         // lege surveillanceauto's: { car, balk, links, rechts, t, knipper }
  let meldT = 0;               // korte pauze tussen twee meldingen in beeld
  let stille = 0;              // misdaden die (nog) niemand meldde
  const rijbanen = (KAART && KAART.wegassen ? KAART.wegassen.filter(w => w.drive && w.lengte > 40) : []);

  const spelerPlek = () => (player.inCar ? { x: player.inCar.x, z: player.inCar.z } : { x: player.pos.x, z: player.pos.z });
  /*
   Waar zoeken ze? Niet waar je bent, maar waar ze je het laatst wisten. Dat is
   het hele verschil tussen een politie die je kunt afschudden en een die je
   magisch blijft vinden: nieuwe eenheden komen rond dát punt aanrijden, en zie
   je kans om ongezien weg te komen, dan zoeken ze op de verkeerde plek.
  */
  const anker = () => laatstBekend || spelerPlek();
  const ster = () => { let n = 0; for (const g of STERREN) if (heat >= g) n++; return n; };

  /*
   Het wegennet, om routes over te rijden en te lopen. Recht op de speler af
   rijden werkt in een wijk niet: dan staat er na dertig meter een woonblok in de
   weg en blijft de wagen tegen de gevel duwen. De graaf wordt pas gebouwd als er
   voor het eerst een eenheid nodig is — wie nooit iets uitspookt betaalt er ook
   niets voor.
  */
  let nav = null;
  const wegennet = () => {
    if (!nav && KAART && KAART.wegassen) nav = new Navigatie(KAART.wegassen, { padFactor: 1.8 });
    return nav;
  };

  /*
   Het eerstvolgende punt op de route naar `doel`. De route wordt opnieuw
   uitgerekend als het doel is verschoven, als hij op is, of om de paar seconden
   — de speler beweegt immers ook. Vlakbij (of met vrij zicht) gaat de eenheid
   er rechtstreeks op af.
  */
  function volgPunt(e, pos, doel, dt, vooruit) {
    const recht = Math.hypot(doel.x - pos.x, doel.z - pos.z);
    if (recht < 30 && zichtVrij(pos.x, pos.z, doel.x, doel.z, 1.2)) { e.route = null; return doel; }
    e.routeT = (e.routeT || 0) - dt;
    const verschoven = !e.routeDoel || Math.hypot(e.routeDoel.x - doel.x, e.routeDoel.z - doel.z) > 22;
    if (!e.route || verschoven || e.routeT <= 0) {
      const net = wegennet();
      const r = net ? net.route([pos.x, pos.z], [doel.x, doel.z]) : null;
      e.route = r && r.length > 1 ? r : null;
      e.routeI = 0;
      e.routeDoel = { x: doel.x, z: doel.z };
      e.routeT = 4;
    }
    if (!e.route) return doel;
    /*
     Waar op de route staat hij nu? Zoek het dichtstbijzijnde punt vanaf waar
     hij de vorige keer was — niet vanaf het begin, anders springt hij terug —
     en mik dan op een punt dat `vooruit` meter verderop ligt. Dat laatste is de
     truc: recht op het eerstvolgende punt aansturen geeft geslinger, een punt
     verderop geeft een vloeiende lijn.
    */
    let best = e.routeI, bd = Infinity;
    for (let i = e.routeI; i < Math.min(e.route.length, e.routeI + 40); i++) {
      const d = Math.hypot(e.route[i][0] - pos.x, e.route[i][1] - pos.z);
      if (d < bd) { bd = d; best = i; }
    }
    e.routeI = best;
    // route op? dan de laatste meters rechtstreeks
    if (best >= e.route.length - 1) return doel;
    let j = best, som = 0;
    while (j < e.route.length - 1 && som < vooruit) {
      som += Math.hypot(e.route[j + 1][0] - e.route[j][0], e.route[j + 1][1] - e.route[j][1]);
      j++;
    }
    return { x: e.route[j][0], z: e.route[j][1] };
  }

  /*
   Een zoekpunt voor één eenheid.

   Alle eenheden naar dezelfde plek sturen geeft een kluitje politie op de
   plaats delict en verder een lege wijk — precies wat je niet wilt. Elke
   eenheid krijgt daarom een eigen sector rond het anker (verdeeld met de gulden
   snede, zodat ze mooi over de windroos verspreid staan) en zoekt daarin. De
   straal groeit met het aantal sterren: bij één ster blijven ze in de buurt van
   de melding, bij vijf kammen ze de halve wijk uit.

   Het punt wordt naar de dichtstbijzijnde weg getrokken, want daar rijden en
   lopen ze; een zoekpunt midden in een achtertuin levert alleen maar geduw
   tegen schuttingen op.
  */
  let sectorTeller = 0;
  function nieuwZoekpunt(e, dichtbij = false) {
    const ank = anker();
    const s = Math.max(1, ster());
    if (e.sector === undefined) e.sector = (sectorTeller++ * 0.618034) % 1;
    const straal = ZOEKSTRAAL[s] * (dichtbij ? 0.2 : 0.35 + Math.random() * 0.65);
    const hoek = (e.sector + (Math.random() - 0.5) * 0.18) * Math.PI * 2;
    let x = ank.x + Math.cos(hoek) * straal, z = ank.z + Math.sin(hoek) * straal;
    const net = wegennet();
    if (net) {
      const i = net.naaste(x, z, 200, true);
      if (i >= 0) {
        // Op het knooppunt zelf gaan staan geeft een kluitje: twee eenheden die
        // vanuit dezelfde hoek zoeken vallen op hetzelfde punt samen. Ieder
        // krijgt daarom een eigen plekje van een paar meter eromheen.
        const eigen = e.sector * Math.PI * 2;
        const r = 3 + (e.sector * 7) % 5;
        x = net.punten[i][0] + Math.cos(eigen) * r;
        z = net.punten[i][1] + Math.sin(eigen) * r;
      }
    }
    e.doel = { x, z };
    e.zoekT = 14 + Math.random() * 12;
    e.route = null;
    return e.doel;
  }

  // ---------------------------------------------------------------- misdaad
  /*
   Een misdaad melden. `soort` staat in MISDADEN hierboven. Of het gemeld wordt
   hangt af van de getuigen: levende mensen binnen de straal die vrij zicht op
   de plek hebben. Bij nul getuigen is er nog een kleine kans (iemand achter een
   raam), bij drie is het vrijwel zeker.
  */
  function misdaad(soort, x, z) {
    const M = MISDADEN[soort];
    if (!M) return false;
    let getuigen = 0;
    for (const p of npcs.people) {
      if (!p.alive) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d > M.straal) continue;
      if (d < 12 || zichtVrij(p.x, p.z, x, z, 1.5)) getuigen++;
    }
    // agenten die het zien zijn altijd een getuige
    for (const a of agenten) if (a.staat !== 'neer' && Math.hypot(a.persoon.groep.position.x - x, a.persoon.groep.position.z - z) < ZICHT) getuigen += 2;

    /*
     De kans dat het gemeld wordt. Eén iemand neerschieten waar niemand bij is
     gaat vaak ongemerkt voorbij; doe je het nog eens, dan valt het veel eerder
     op — iemand mist zijn buurman, iemand hoort het tweede schot. `stille`
     telt de misdaden die tot nu toe onopgemerkt bleven en zakt langzaam weg.
     Word je al gezocht, dan telt alles meteen mee.
    */
    const kans = ster() > 0 ? 1 : Math.min(0.96, (0.08 + 0.26 * getuigen + 0.20 * stille) * M.ernst);
    if (Math.random() > kans) { stille += M.ernst; return false; }
    stille = 0;

    const voor = ster();
    heat = Math.min(MAX_HEAT, heat + M.heat);
    gezienT = 0;
    laatstBekend = { x, z };
    const na = ster();
    if (na > voor && hud) {
      hud.show(na === 1 ? 'De politie is gebeld' : `Gezocht: ${na} sterren`, 2.2);
      meldT = 2;
    }
    return true;
  }

  // ---------------------------------------------------------------- eenheden
  // Een plek op een rijbaan die ver genoeg weg is en liefst uit het zicht.
  function spawnPlek() {
    const sp = anker();
    let beste = null, besteScore = -1;
    for (let poging = 0; poging < 40 && rijbanen.length; poging++) {
      const as = rijbanen[Math.floor(Math.random() * rijbanen.length)];
      const k = Math.floor(Math.random() * as.pts.length);
      const p = as.pts[k];
      const d = Math.hypot(p[0] - sp.x, p[1] - sp.z);
      if (d < SPAWN_MIN || d > SPAWN_MAX) continue;
      // uit het zicht is beter, maar niet noodzakelijk
      const score = d * (zichtVrij(sp.x, sp.z, p[0], p[1], 1.6) ? 0.4 : 1);
      if (score > besteScore) {
        besteScore = score;
        // met de neus in de richting van de weg, anders begint hij met een
        // manoeuvre door de voortuin van de buren
        const q = as.pts[Math.min(as.pts.length - 1, k + 1)] || p;
        beste = { x: p[0], z: p[1], yaw: Math.atan2(-(q[0] - p[0]), -(q[1] - p[1])) };
      }
    }
    if (beste) return beste;
    const hoek = Math.random() * 6.28;
    return { x: sp.x + Math.sin(hoek) * SPAWN_MIN, z: sp.z + Math.cos(hoek) * SPAWN_MIN };
  }

  function maakAgent(x, z, inWagen = null) {
    const persoon = new Persoon({ ...UNIFORM, huid: Math.random() < 0.5 ? 0xd9b48f : 0xc79a72, hoogte: 0.99 + Math.random() * 0.04, wapen: true, pet: true });
    scene.add(persoon.groep);
    persoon.zetNeer(x, z, Math.random() * 6.28);
    const a = {
      persoon, staat: 'naarPlek', vuurT: VUURTIJD * Math.random(), kijkT: Math.random() * 0.3,
      zicht: false, doel: null, wacht: 0, omT: 0, wagen: inWagen,
    };
    persoon.groep.visible = !inWagen;
    agenten.push(a);
    return a;
  }

  /*
   Een surveillanceauto: een donkerblauwe auto met een balk met twee lampen op
   het dak. Hij is niet in te stappen (`driveable: false`), want hij is van de
   politie. De twee lampen knipperen om beurten.
  */
  function maakWagen(x, z, yaw = Math.random() * 6.28) {
    const car = vehicles.voegToe({ x, z, yaw, soort: 'hatch', kleur: 0x1b3a7a, driveable: false });
    const balk = new THREE.Group();
    const voet = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.22), new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.8 }));
    voet.position.set(0, 1.44, 0.1);
    const lampMat = (kleur) => new THREE.MeshStandardMaterial({ color: kleur, emissive: kleur, emissiveIntensity: 2.4 });
    const links = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.18), lampMat(0x2b6bff));
    const rechts = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.18), lampMat(0x2b6bff));
    links.position.set(-0.24, 1.53, 0.1); rechts.position.set(0.24, 1.53, 0.1);
    balk.add(voet, links, rechts);
    car.mesh.add(balk);
    const w = { car, balk, links, rechts, agenten: [], staat: 'naarPlek', knipper: 0, uitstapT: 0,
                klemT: 0, stilT: 0, route: null, routeI: 1, routeDoel: null, routeT: 0 };
    // twee agenten zitten erin tot ze uitstappen
    w.agenten.push(maakAgent(x, z, w), maakAgent(x, z, w));
    wagens.push(w);
    return w;
  }

  function ruimAgent(a) {
    scene.remove(a.persoon.groep);
    a.persoon.verwijder?.();
    const i = agenten.indexOf(a); if (i >= 0) agenten.splice(i, 1);
  }

  function ruimWagen(w) {
    for (const a of [...w.agenten]) ruimAgent(a);
    scene.remove(w.car.mesh);
    const i = vehicles.cars.indexOf(w.car); if (i >= 0) vehicles.cars.splice(i, 1);
    const j = wagens.indexOf(w); if (j >= 0) wagens.splice(j, 1);
  }

  /*
   De agenten zijn eruit. Een auto die daarna vrolijk verder rijdt is raar, dus
   hij blijft staan waar hij staat, met zijn zwaailicht aan — en hij is te
   stelen: `driveable` gaat aan en hij verhuist naar de lijst `verlaten`, waar
   alleen zijn licht nog knippert en de klok voor het opruimen loopt.
  */
  function verlaatWagen(w) {
    const car = w.car;
    car.driveable = true;
    car.speed = 0; car.steer = 0;
    for (const a of w.agenten) a.wagen = null;   // ze tellen nu mee als agent te voet
    w.agenten.length = 0;
    const j = wagens.indexOf(w); if (j >= 0) wagens.splice(j, 1);
    verlaten.push({ car, balk: w.balk, links: w.links, rechts: w.rechts, t: 0, knipper: w.knipper });
    return car;
  }

  function ruimVerlaten(v) {
    scene.remove(v.car.mesh);
    const i = vehicles.cars.indexOf(v.car); if (i >= 0) vehicles.cars.splice(i, 1);
    const j = verlaten.indexOf(v); if (j >= 0) verlaten.splice(j, 1);
  }

  // Hoeveel eenheden horen er bij deze ster? Aanvullen gaat één per keer, zodat
  // ze binnendruppelen in plaats van allemaal tegelijk te verschijnen.
  let vulT = 0;
  function vulAan(dt) {
    const s = ster();
    const wilVoet = TE_VOET[s], wilWagens = WAGENS[s];
    const nuVoet = agenten.filter(a => !a.wagen).length;
    vulT -= dt;
    if (vulT > 0) return;
    if (wagens.length < wilWagens) { const p = spawnPlek(); maakWagen(p.x, p.z, p.yaw); vulT = 1.6; return; }
    if (nuVoet < wilVoet) { const p = spawnPlek(); maakAgent(p.x, p.z); vulT = 1.4; return; }
    // te veel, of te ver van het zoekgebied? die eenheid gaat weg
    const sp = anker();
    if (wagens.length > wilWagens) {
      const ver = wagens.slice().sort((a, b) => Math.hypot(b.car.x - sp.x, b.car.z - sp.z) - Math.hypot(a.car.x - sp.x, a.car.z - sp.z))[0];
      if (ver && Math.hypot(ver.car.x - sp.x, ver.car.z - sp.z) > 60) { ruimWagen(ver); vulT = 1; }
    } else if (nuVoet > wilVoet) {
      /*
       Te veel agenten te voet. Dat kan hard oplopen: elke wagen zet er twee af
       en verdwijnt daarna uit de lijst, waarna er een verse wagen komt. Zonder
       bovengrens loopt de wijk in een lange achtervolging vol met agenten.
       Normaal gaat de verste weg zolang hij ver van het zoekgebied staat; zit je
       er ruim boven, dan gaat de verste van jóu weg — maar nooit iemand die je
       vlak voor je neus ziet staan.
      */
      const los = agenten.filter(a => !a.wagen);
      const pl = spelerPlek();
      const verstVan = (p) => los.slice().sort((a, b) =>
        Math.hypot(b.persoon.groep.position.x - p.x, b.persoon.groep.position.z - p.z)
        - Math.hypot(a.persoon.groep.position.x - p.x, a.persoon.groep.position.z - p.z))[0];
      const ver = verstVan(sp);
      if (ver && Math.hypot(ver.persoon.groep.position.x - sp.x, ver.persoon.groep.position.z - sp.z) > 60) { ruimAgent(ver); vulT = 1; }
      else if (nuVoet > wilVoet + 4) {
        const weg = verstVan(pl);
        if (weg && Math.hypot(weg.persoon.groep.position.x - pl.x, weg.persoon.groep.position.z - pl.z) > 25) { ruimAgent(weg); vulT = 1; }
      }
    }
  }

  // ---------------------------------------------------------------- lopen
  function loopNaar(a, doel, dt, snelheid) {
    const pos = a.persoon.groep.position;
    let dx = doel.x - pos.x, dz = doel.z - pos.z;
    const afst = Math.hypot(dx, dz);
    if (afst < 0.7) return true;
    dx /= afst; dz /= afst;
    const stap = Math.min(afst, snelheid * dt);
    // botst hij, dan probeert hij er schuin omheen te lopen
    for (const draai of [0, 0.6, -0.6, 1.2, -1.2, 2.0, -2.0]) {
      const c = Math.cos(draai), s = Math.sin(draai);
      const rx = dx * c - dz * s, rz = dx * s + dz * c;
      const nx = pos.x + rx * stap, nz = pos.z + rz * stap;
      const [kx, kz] = resolveCollisions(nx, nz, 0.34);
      if (Math.hypot(kx - nx, kz - nz) < 0.02) {
        pos.x = kx; pos.z = kz;
        a.persoon.draaiNaar(Math.atan2(-rx, -rz), dt, 6);
        return false;
      }
    }
    return false;
  }

  /*
   Een surveillanceauto naar een punt rijden. In plaats van een eigen
   rijnatuurkunde te schrijven doet de agent alsof hij op de toetsen drukt: dan
   loopt hij door dezelfde `Vehicles.drive` als de speler en heeft hij
   automatisch botsingen, wielen die meesturen en remlichten.
  */
  function rijNaar(w, eindDoel, dt, haast) {
    const car = w.car;
    const eind = Math.hypot(eindDoel.x - car.x, eindDoel.z - car.z);
    const punt = volgPunt(w, car, eindDoel, dt, 6);
    const dx = punt.x - car.x, dz = punt.z - car.z;
    const doelYaw = Math.atan2(-dx, -dz);
    let d = doelYaw - car.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const keys = {};
    // vastgereden? even achteruit en dan opnieuw sturen
    if (w.klemT > 0) {
      w.klemT -= dt;
      keys.KeyS = true;
      if (d > 0) keys.KeyD = true; else keys.KeyA = true;      // achteruit stuur je andersom
      vehicles.drive(car, keys, dt);
      return eind;
    }
    if (d > 0.06) keys.KeyA = true;
    else if (d < -0.06) keys.KeyD = true;
    // hoe scherper de bocht en hoe dichter bij het doel, hoe langzamer
    const wens = Math.min(haast, 4 + eind * 0.5) * Math.max(0.25, 1 - Math.abs(d) * 0.7);
    if (car.speed < wens) keys.KeyW = true;
    else if (car.speed > wens + 1.5) keys.KeyS = true;
    vehicles.drive(car, keys, dt);
    /*
     Vastgereden. Een wijk zit vol tuinmuurtjes en geparkeerde auto's, dus een
     surveillancewagen komt er weleens niet uit. Eerst probeert hij het met
     achteruit en een andere lijn; lukt dat een paar keer niet, dan is hij
     'onderweg via een andere route' — hij verdwijnt uit beeld en er komt
     verderop een verse wagen aan. Dat is precies wat een spel als GTA doet, en
     het is beter dan een politieauto die eeuwig tegen een schutting staat te
     duwen.
    */
    if (keys.KeyW && Math.abs(car.speed) < 1.2 && eind > 12) {
      w.stilT = (w.stilT || 0) + dt;
      w.klemTotaal = (w.klemTotaal || 0) + dt;
      if (w.stilT > 1.2) { w.klemT = 1.0; w.stilT = 0; w.route = null; w.pogingen = (w.pogingen || 0) + 1; }
    } else { w.stilT = 0; w.klemTotaal = Math.max(0, (w.klemTotaal || 0) - dt * 0.5); }
    return eind;
  }

  // ---------------------------------------------------------------- kijken
  function zietSpeler(pos, yaw, altijdRondom = false) {
    const sp = spelerPlek();
    const d = Math.hypot(sp.x - pos.x, sp.z - pos.z);
    if (d > ZICHT) return false;
    if (!altijdRondom) {
      const hoek = Math.atan2(-(sp.x - pos.x), -(sp.z - pos.z));
      let v = hoek - yaw;
      while (v > Math.PI) v -= Math.PI * 2;
      while (v < -Math.PI) v += Math.PI * 2;
      if (Math.abs(v) > GEZICHTSVELD) return false;
    }
    return zichtVrij(pos.x, pos.z, sp.x, sp.z, 1.3);
  }

  // Een schot van de speler horen ze in de wijde omtrek.
  function hoorSchot(x, z) {
    let gehoord = false;
    for (const a of agenten) {
      const pos = a.persoon.groep.position;
      if (a.staat === 'neer') continue;
      if (Math.hypot(pos.x - x, pos.z - z) < GEHOOR) { a.staat = 'jacht'; gehoord = true; }
    }
    for (const w of wagens) if (Math.hypot(w.car.x - x, w.car.z - z) < GEHOOR) w.staat = 'jacht';
    if (gehoord || wagens.length) laatstBekend = { x, z };
    return gehoord;
  }

  // ---------------------------------------------------------------- treffer
  // Een agent neerschieten: hij gaat neer en dat kost je een flinke verdenking.
  function raak(obj) {
    for (const a of agenten) {
      if (a.staat === 'neer') continue;
      let hit = false;
      a.persoon.groep.traverse(o => { if (o === obj) hit = true; });
      if (!hit) continue;
      a.staat = 'neer';
      a.persoon.groep.userData.neer = true;
      const pos = a.persoon.groep.position;
      misdaad('agent', pos.x, pos.z);
      return true;
    }
    return false;
  }

  function doelen() {
    return agenten.filter(a => a.staat !== 'neer' && a.persoon.groep.visible).map(a => a.persoon.groep);
  }

  // ---------------------------------------------------------------- per beeld
  function update(dt) {
    const s = ster();
    let schade = 0;
    const sp = spelerPlek();
    if (meldT > 0) meldT -= dt;
    if (stille > 0) stille = Math.max(0, stille - dt / 90);   // na anderhalve minuut vergeten

    if (s > 0) vulAan(dt);

    let iemandZiet = false;
    let dichtsteSirene = null;
    /*
     Wie mag er schieten? Met acht agenten om je heen die allemaal om de anderhalve
     seconde vuren is je levensbalk in tien tellen leeg en valt er niets meer te
     spelen. Alleen de dichtstbijzijnde paar schieten; de rest komt aanlopen en
     wacht op zijn beurt. Dat is ook wat je in GTA ziet gebeuren.
    */
    const schutters = new Set(agenten
      .filter(a => a.staat === 'jacht' && a.zicht && a.persoon.groep.visible)
      .sort((a, b) => Math.hypot(a.persoon.groep.position.x - sp.x, a.persoon.groep.position.z - sp.z)
                    - Math.hypot(b.persoon.groep.position.x - sp.x, b.persoon.groep.position.z - sp.z))
      .slice(0, VUURDERS));

    // ---- agenten te voet ----
    for (const a of agenten) {
      const persoon = a.persoon;
      const pos = persoon.groep.position;

      if (a.staat === 'neer') {
        if (a.omT < 1) { a.omT = Math.min(1, a.omT + dt * 1.8); persoon.legNeer(a.omT); }
        continue;
      }
      if (a.wagen && !persoon.groep.visible) continue;      // zit nog in de auto

      const dSp = Math.hypot(sp.x - pos.x, sp.z - pos.z);
      a.kijkT -= dt;
      if (a.kijkT <= 0) {
        a.kijkT = 0.25;
        a.zicht = zietSpeler(pos, persoon.yaw, a.staat === 'jacht' && dSp < 18);
        if (a.zicht) { a.staat = 'jacht'; laatstBekend = { x: sp.x, z: sp.z }; }
        else if (a.staat === 'jacht' && dSp > 8) { a.staat = 'zoekt'; a.doel = laatstBekend ? { ...laatstBekend } : null; }
      }
      if (a.zicht) iemandZiet = true;

      if (a.staat === 'jacht') {
        const dichtbij = dSp < DEKKING;
        if (!dichtbij) loopNaar(a, volgPunt(a, pos, sp, dt, 4), dt, REN);
        persoon.kijkNaar(sp.x, sp.z, dt, 7);
        persoon.update(dt, { loopt: !dichtbij, mikt: true, snelheid: REN });
        a.vuurT -= dt;
        if (a.vuurT <= 0 && dSp < VUURBEREIK && a.zicht && schutters.has(a)) {
          a.vuurT = VUURTIJD * (0.8 + Math.random() * 0.6);
          persoon.vuur();
          geluid.schot();
          const kans = Math.max(0.10, 0.5 - dSp * 0.011);
          if (Math.random() < kans) schade += SCHADE;
        }
        continue;
      }

      if (a.staat === 'zoekt' || a.staat === 'naarPlek') {
        // komt hij al een tijd nergens meer? dan is hij 'omgelopen' en komt er
        // verderop een verse collega aan (zie de wagens hieronder)
        const vorige = a.vorigePlek || (a.vorigePlek = { x: pos.x, z: pos.z, t: 0 });
        vorige.t += dt;
        if (vorige.t > 3) {
          if (Math.hypot(pos.x - vorige.x, pos.z - vorige.z) < 2 && dSp > 70 && !a.wagen) { ruimAgent(a); continue; }
          vorige.x = pos.x; vorige.z = pos.z; vorige.t = 0;
        }
        // een eigen zoekpunt: de eerste ligt dicht bij de melding, daarna gaan
        // ze de straten eromheen af
        a.zoekT = (a.zoekT || 0) - dt;
        if (!a.doel || a.zoekT <= 0) nieuwZoekpunt(a, a.staat === 'naarPlek' && !a.zoekT);
        const eindDoel = a.doel;
        const snelheid = a.staat === 'naarPlek' ? REN : LOOP;
        const doel = volgPunt(a, pos, eindDoel, dt, 4);
        const erIs = loopNaar(a, doel, dt, snelheid)
          && Math.hypot(eindDoel.x - pos.x, eindDoel.z - pos.z) < 6;
        // het wapen komt pas omhoog waar hij daadwerkelijk staat te zoeken, of
        // als je in de buurt bent; onderweg naar zijn zoekpunt loopt hij gewoon
        persoon.update(dt, { loopt: !erIs, mikt: a.staat === 'zoekt' && (erIs || dSp < 40), snelheid });
        if (erIs) {
          // ter plekke rondkijken, dan verderop verder zoeken
          a.wacht += dt;
          persoon.draaiNaar(persoon.yaw + 1.1, dt, 1.1);
          if (a.wacht > 2.5) { a.wacht = 0; a.staat = 'zoekt'; nieuwZoekpunt(a); }
        }
        continue;
      }
    }

    /*
     Elkaar niet in de weg lopen. Twee agenten die naar hetzelfde punt zoeken
     komen anders in elkaar te staan — je ziet dan één poppetje met vier armen.
     Een zacht duwtje uit elkaar is genoeg; het is dezelfde truc als bij de
     voetgangers in js/npc.js.
    */
    const zichtbaar = agenten.filter(a => a.staat !== 'neer' && a.persoon.groep.visible);
    for (let i = 0; i < zichtbaar.length; i++) {
      for (let j = i + 1; j < zichtbaar.length; j++) {
        const p = zichtbaar[i].persoon.groep.position, q = zichtbaar[j].persoon.groep.position;
        let dx = q.x - p.x, dz = q.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d > 1.1) continue;
        if (d < 0.001) { dx = Math.cos(i * 2.4); dz = Math.sin(i * 2.4); }
        const duw = (1.1 - Math.min(d, 1.1)) * 0.5;
        const nx = dx / (d || 1), nz = dz / (d || 1);
        p.x -= nx * duw; p.z -= nz * duw;
        q.x += nx * duw; q.z += nz * duw;
      }
    }

    // ---- surveillanceauto's ----
    for (const w of [...wagens]) {
      const car = w.car;
      // iedereen eruit: deze wagen rijdt niet meer, hij blijft leeg staan
      if (w.agenten.length && w.agenten.every(a => a.persoon.groep.visible)) { verlaatWagen(w); continue; }
      const dSp = Math.hypot(sp.x - car.x, sp.z - car.z);
      // zwaailicht: de twee lampen om beurten, twee keer per seconde
      w.knipper += dt;
      const aanLinks = Math.floor(w.knipper * 4) % 2 === 0;
      w.links.material.emissiveIntensity = aanLinks ? 3.2 : 0.15;
      w.rechts.material.emissiveIntensity = aanLinks ? 0.15 : 3.2;
      if (dichtsteSirene === null || dSp < dichtsteSirene) dichtsteSirene = dSp;

      const ziet = zietSpeler({ x: car.x, z: car.z }, car.yaw, dSp < 30);
      if (ziet) { iemandZiet = true; laatstBekend = { x: sp.x, z: sp.z }; w.staat = 'jacht'; w.kwijtT = 0; }
      else if (w.staat === 'jacht') {
        // een paar seconden blijven ze nog achter je aan rijden — je kunt niet
        // ontsnappen door één keer een hoek om te gaan — maar daarna rijden ze
        // naar de plek waar ze je het laatst zagen en gaan ze daar zoeken
        w.kwijtT = (w.kwijtT || 0) + dt;
        if (w.kwijtT > 4) { w.staat = 'naarPlek'; w.route = null; }
      }

      if (w.staat === 'wegwezen') {
        const weg = w.wegDoel || (w.wegDoel = spawnPlek());
        const afst = rijNaar(w, weg, dt, 16);
        w.wegT = (w.wegT || 0) + dt;
        // hij is vertrokken zodra hij er is, ver genoeg weg is, of het te lang duurt
        if (afst < 12 || (dSp > 80 && w.wegT > 4) || w.wegT > 18) ruimWagen(w);
        continue;
      }

      // achter je aan, of anders zijn eigen ronde door de wijk rijden
      if (w.staat !== 'jacht') {
        w.zoekT = (w.zoekT || 0) - dt;
        if (!w.doel || w.zoekT <= 0) nieuwZoekpunt(w, w.staat === 'naarPlek' && !w.doel);
      }
      const doel = w.staat === 'jacht' ? sp : w.doel;
      const afst = rijNaar(w, doel, dt, w.staat === 'jacht' ? 20 : 15);
      if (w.staat !== 'jacht' && afst < 12) { w.staat = 'zoekt'; nieuwZoekpunt(w); }
      if ((w.pogingen || 0) >= 3 && dSp > 55) { ruimWagen(w); continue; }   // hopeloos vast: verderop komt een verse wagen
      // ver buiten het zoekgebied verdwaald? die eenheid is uitgeschakeld
      const ank = anker();
      if (Math.hypot(car.x - ank.x, car.z - ank.z) > 420 && dSp > 120) { ruimWagen(w); continue; }

      // bij de speler in de buurt stappen ze uit en gaan ze te voet verder
      if (dSp < 40 && w.agenten.some(a => !a.persoon.groep.visible)) {
        w.uitstapT += dt;
        if (w.uitstapT > 0.4 || dSp < 22) {
          const zij = new THREE.Vector3(Math.cos(car.yaw), 0, -Math.sin(car.yaw));
          w.agenten.forEach((a, i) => {
            if (a.persoon.groep.visible) return;
            const k = i === 0 ? -1.5 : 1.5;
            a.persoon.zetNeer(car.x + zij.x * k, car.z + zij.z * k, car.yaw);
            a.persoon.groep.visible = true;
            a.staat = 'zoekt';
            a.doel = { x: sp.x, z: sp.z };
          });
          geluid.portier();
        }
      }
    }

    /*
     ---- lege surveillanceauto's ----
     Ze rijden niet meer, het zwaailicht knippert door en je kunt erin stappen.
     Doe je dat, dan is hij van jou: hij gaat uit de lijst, de lampen gaan uit en
     de politie bemoeit zich er niet meer mee. Doe je het niet, dan verdwijnt hij
     vanzelf — snel zodra ze je kwijt zijn, en anders na drie kwartier minuut.
    */
    for (let i = verlaten.length - 1; i >= 0; i--) {
      const v = verlaten[i];
      const gestolen = player.inCar === v.car;
      /*
       Instappen bouwt de carrosserie opnieuw op (vehicles.maakBestuurbaar), en
       de lichtbalk hing aan het oude model. Hem opnieuw aanhaken kost niets en
       is meteen de reden dat een gestolen politieauto zijn balk houdt.
      */
      if (v.car.mesh && v.balk.parent !== v.car.mesh) v.car.mesh.add(v.balk);
      v.knipper += dt;
      const links = Math.floor(v.knipper * 4) % 2 === 0;
      v.links.material.emissiveIntensity = gestolen ? 0.12 : (links ? 3.2 : 0.15);
      v.rechts.material.emissiveIntensity = gestolen ? 0.12 : (links ? 0.15 : 3.2);
      if (gestolen) { verlaten.splice(i, 1); continue; }
      v.t += dt;
      const dLeeg = Math.hypot(sp.x - v.car.x, sp.z - v.car.z);
      const opTijd = v.t > (ster() === 0 ? LEEG_KWIJT : LEEG_WEG);
      if (opTijd && dLeeg > LEEG_AFSTAND) ruimVerlaten(v);
    }

    // ---- verdenking bijwerken ----
    if (iemandZiet) {
      // let op: `laatstBekend` wordt alleen bijgewerkt op het moment dat iemand
      // je écht ziet (in de kijklus hierboven). Dat hier ook doen zou betekenen
      // dat een agent met een verouderde zichtvlag jouw huidige plek doorgeeft —
      // dan weten ze altijd waar je bent en kun je nooit ontsnappen.
      gezienT = 0;
    } else if (s > 0) {
      gezienT += dt;
      const wachten = VERGETEN + s * 6;
      if (gezienT > wachten) heat = Math.max(0, heat - KOEL * dt);
    }

    // geen sterren meer: iedereen gaat weg
    if (ster() === 0 && (agenten.length || wagens.length)) {
      for (const w of wagens) if (w.staat !== 'wegwezen') { w.staat = 'wegwezen'; w.wegDoel = null; }
      for (const a of [...agenten]) if (!a.wagen) ruimAgent(a);
      if (wagens.length === 0 && agenten.length === 0 && laatstBekend) {
        laatstBekend = null;
        if (hud) hud.show('Je bent ze kwijt', 2);
      }
    }

    // sirene: alleen als er een wagen achter je aan zit
    geluid.sirene(wagens.length && ster() > 0 ? dichtsteSirene : null);
    return schade;
  }

  function reset() {
    for (const w of [...wagens]) ruimWagen(w);
    // een lege wagen waar de speler in zit is van hem; die laten we staan
    for (const v of [...verlaten]) { if (player.inCar !== v.car) ruimVerlaten(v); }
    for (const a of [...agenten]) ruimAgent(a);
    heat = 0; gezienT = 0; laatstBekend = null; stille = 0;
    geluid.sirene(null);
  }

  return {
    misdaad, update, raak, doelen, hoorSchot, reset,
    get ster() { return ster(); },
    get heat() { return heat; },
    get gezocht() { return ster() > 0; },
    get eenheden() { return { voet: agenten.filter(a => !a.wagen).length, inWagen: agenten.filter(a => a.wagen).length, wagens: wagens.length, verlaten: verlaten.length }; },
    get stille() { return stille; },
    get plekken() {
      // voor de minikaart: waar staan de eenheden?
      const uit = agenten.filter(a => a.staat !== 'neer' && a.persoon.groep.visible)
        .map(a => ({ x: a.persoon.groep.position.x, z: a.persoon.groep.position.z }));
      for (const w of wagens) uit.push({ x: w.car.x, z: w.car.z, wagen: true });
      return uit;
    },
    // voor de proef: dwing een bepaalde verdenking af en kijk binnen
    zetHeat(v) { heat = Math.max(0, Math.min(MAX_HEAT, v)); },
    get intern() { return { wagens, agenten, verlaten, laatstBekend, gezienT, stille }; },
  };
}
