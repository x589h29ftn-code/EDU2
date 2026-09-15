/*
 De politiehelikopter.

 Vanaf vier sterren komt er een heli over de wijk. Hij cirkelt boven de plek
 waar ze je vermoeden en werkt `laatstBekend` bij zolang hij je ziet — en dat
 laatste is het hele punt: in één klap krijgt alles wat er al lag betekenis.
 Onder het viaduct, in het bos bij de Buitenroede, onder de bomen langs de
 Wieken of gewoon gehurkt achter een schutting ben je uit zijn zicht, en dat is
 waar je dan heen rent. Te voet wegrennen over een open parkeerterrein is met
 een heli boven je hoofd geen plan meer.

 Wat hem tegenhoudt staat in `zichtbaar()` hieronder, en het is expres een korte
 lijst die je op straat kunt navertellen:

   - gehurkt zien ze je niet (toets C);
   - onder een boomkroon of in een bos- of heestervlak uit de kaart ook niet;
   - en onder een dak — een brugdek, het viaduct — al helemaal niet.

 Verder is het een model en een cirkelbaan. Het model is met de hand in doosjes
 en cilinders gebouwd, net als de auto's: een romp met een cockpitruit, een
 staartboom met een vin en een staartrotor, vier bladen op een mast, en twee
 landingssleden. Er komt geen plaatjesbestand aan te pas — de belettering is
 geverfd met vlakken, zoals alles in dit spel.

 Het geluid (`geluid.heli`) hangt aan de afstand, dus je hoort hem aankomen
 voordat je hem ziet, en je hoort hem afdraaien als hij je kwijt is.
*/
import * as THREE from 'three';
import { treePositions } from './world.js';
import { KAART, vlakOp } from './kaartwereld.js';
import { grondHoogte } from './viaduct.js';
import { geluid } from './audio.js';

// ---------- baan ----------
export const HELI_STER = 4;          // vanaf zoveel sterren komt hij
const HOOGTE = 62;                   // hoe hoog hij cirkelt (m boven maaiveld)
const STRAAL = 48;                   // de straal van zijn rondje (m)
const RONDJE = 26;                   // seconden per rondje
const AANVLIEG = 34;                 // (m/s) waarmee hij komt en gaat
const VER_WEG = 520;                 // vanaf zover buiten beeld komt hij aanvliegen
const ZICHT = 210;                   // verder dan dit ziet hij je niet (m)
const KROON = 2.2;                   // de straal van een boomkroon bij schaal 1 (js/world.js)
const GROEN = new Set(['bos', 'heesters', 'bodembedekker']);
// ---------- hem neerhalen ----------
/*
 Twintig kogels en hij gaat neer. Dat is het dubbele van een politieauto (tien,
 zie js/main.js) en dat hoort ook: hij hangt op tweeënzestig meter en je schiet
 met een pistool omhoog naar een doel dat rondjes vliegt. Het is geen kwestie van
 even richten.

 Daarna valt hij niet als een steen. Hij verliest zijn staartrotor, gaat om zijn
 eigen as tollen, zakt met een dikke rookpluim naar beneden en slaat op de grond
 kapot. Dat duurt een paar tellen, en in die tellen ziet hij je niet meer.
*/
const HELI_HP = 20;                  // zoveel treffers houdt hij
const TOL = 3.6;                     // rad/s waarmee hij om zijn as gaat
const VAL = 15;                      // (m/s) waarmee hij naar beneden komt
const VAL_AAN = 9;                   // en zo hard versnelt hij daarbij (m/s²)
const NA_DE_KLAP = 6;                // zoveel seconden blijft de vuurbal staan
const TERUG = 45;                    // en zo lang duurt het voor er een nieuwe komt
const HURK_GRENS = 0.55;             // vanaf hier tel je als gehurkt
const DAK_BOVEN = 1.6;               // zoveel meter dak boven je is genoeg (m)

// ---------- model ----------
const BLAUW = 0x14346e, WIT = 0xe8ecf2, DONKER = 0x1b1f26, GLAS = 0x16202e;

function mat(kleur, ruw = 0.55, metaal = 0.15) {
  return new THREE.MeshStandardMaterial({ color: kleur, roughness: ruw, metalness: metaal });
}

/*
 Het toestel. De romp ligt met de neus op −z, net als de auto's, zodat "vooruit"
 overal in het spel hetzelfde betekent.
*/
function bouwHeli() {
  const groep = new THREE.Group();
  const wit = mat(WIT, 0.5), blauw = mat(BLAUW, 0.5), donker = mat(DONKER, 0.7, 0.3);
  const glas = new THREE.MeshStandardMaterial({ color: GLAS, roughness: 0.15, metalness: 0.6 });

  const doos = (m, b, h, d, x, y, z) => {
    const g = new THREE.Mesh(new THREE.BoxGeometry(b, h, d), m);
    g.position.set(x, y, z); groep.add(g); return g;
  };

  // romp: een blok van 2,2 bij 2,0 bij 4,6 met een afgeschuinde neus erop
  doos(wit, 2.2, 2.0, 4.6, 0, 0, 0.2);
  doos(blauw, 2.24, 0.46, 4.6, 0, -0.55, 0.2);          // de blauwe streep over de flank
  const neus = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), glas);
  neus.scale.set(1.0, 0.86, 1.25); neus.position.set(0, 0.05, -2.2);
  groep.add(neus);
  doos(glas, 1.9, 0.85, 0.12, 0, 0.55, -2.05);          // dakruit boven de cockpit
  for (const sx of [-1, 1]) doos(glas, 0.10, 0.95, 1.5, sx * 1.11, 0.15, -0.5);   // zijruiten

  // staartboom en vin
  doos(wit, 0.5, 0.46, 4.4, 0, 0.35, 4.6);
  doos(blauw, 0.52, 0.20, 4.4, 0, 0.35, 4.6);
  const vin = doos(wit, 0.14, 1.5, 0.9, 0, 1.05, 6.6);
  vin.rotation.x = -0.12;
  doos(wit, 1.7, 0.12, 0.5, 0, 0.35, 6.3);              // het horizontale vlakje

  // staartrotor: twee bladen die om de lengteas draaien
  const staartRotor = new THREE.Group();
  staartRotor.position.set(0.28, 1.0, 6.75);
  for (const r of [0, Math.PI / 2]) {
    const blad = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.5, 0.16), donker);
    blad.rotation.z = r; staartRotor.add(blad);
  }
  staartRotor.rotation.y = Math.PI / 2;
  groep.add(staartRotor);

  // de mast en vier hoofdbladen
  doos(donker, 0.34, 0.5, 0.34, 0, 1.2, 0.1);
  const rotor = new THREE.Group();
  rotor.position.set(0, 1.5, 0.1);
  for (let i = 0; i < 4; i++) {
    const blad = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.06, 11.0), donker);
    blad.rotation.y = i * Math.PI / 2;
    rotor.add(blad);
  }
  /*
   Een draaiende rotor zie je niet als vier bladen maar als een schijf: op
   toeren lopen de bladen zo snel dat er alleen een waas overblijft. Vier
   doorzichtige balken die met de rotor meedraaien doen dat werk — goedkoper
   dan een schijf met transparantie over de hele wereld heen, en van onderaf
   (en van onderaf kijk je ernaar) niet van elkaar te onderscheiden.
  */
  const waasMat = new THREE.MeshBasicMaterial({ color: 0x8a93a2, transparent: true, opacity: 0.16, depthWrite: false });
  for (let i = 0; i < 4; i++) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.02, 11.0), waasMat);
    w.rotation.y = i * Math.PI / 4 + Math.PI / 8;
    rotor.add(w);
  }
  groep.add(rotor);

  // landingssleden
  for (const sx of [-1, 1]) {
    const slee = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 4.0, 6), donker);
    slee.rotation.x = Math.PI / 2;
    slee.position.set(sx * 0.95, -1.35, 0.2);
    groep.add(slee);
    for (const dz of [-1.2, 1.4]) {
      const stut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 6), donker);
      stut.position.set(sx * 0.72, -0.92, 0.2 + dz);
      stut.rotation.z = sx * 0.28;
      groep.add(stut);
    }
  }

  // POLITIE op de flank, in blokletters van blauwe balkjes — geen plaatje
  const letters = new THREE.Group();
  letters.position.set(0, -0.05, 1.4);
  groep.add(letters);

  // zwaailichten onder de romp en een positielicht op de vin
  const lampMat = (kleur) => new THREE.MeshStandardMaterial({ color: kleur, emissive: kleur, emissiveIntensity: 2.4, roughness: 0.4 });
  const links = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), lampMat(0x2f6bff));
  links.position.set(-0.9, -1.05, -0.9); groep.add(links);
  const rechts = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), lampMat(0x2f6bff));
  rechts.position.set(0.9, -1.05, -0.9); groep.add(rechts);

  /*
   Het zoeklicht: een kegel die van de buik naar beneden wijst, additief
   opgeteld bij wat eronder ligt. Hij hangt aan de romp, dus hij kantelt mee —
   precies zoals een echte lichtbundel meedraait als de heli overhelt.
  */
  const bundelMat = new THREE.MeshBasicMaterial({
    color: 0xfff3c4, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const bundel = new THREE.Mesh(new THREE.ConeGeometry(11, HOOGTE, 12, 1, true), bundelMat);
  bundel.position.set(0, -1.2 - HOOGTE / 2, -0.6);
  groep.add(bundel);
  const lampGlas = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), lampMat(0xfff3c4));
  lampGlas.position.set(0, -1.2, -0.6);
  groep.add(lampGlas);

  groep.visible = false;
  return { groep, rotor, staartRotor, links, rechts, bundel, bundelMat, lampGlas };
}

/**
 * De helikopter opzetten. `player` is js/player.js; de politie (js/politie.js)
 * roept `update` aan en leest terug of hij de speler ziet.
 */
export function initHelikopter({ scene, player }) {
  const H = bouwHeli();
  scene.add(H.groep);

  /*
   Een rooster van de bomen, zodat "sta ik onder een kroon" geen lus over
   dertigduizend bomen is maar een handvol. Het wordt pas gevuld als de heli voor
   het eerst opstijgt — wie nooit vier sterren haalt betaalt er niets voor — en
   het hangt aan de lijst uit js/world.js, dus het klopt met wat er werkelijk
   staat.
  */
  const HOK = 24;
  let rooster = null;
  function bomenRooster() {
    if (rooster && rooster.n === treePositions.length) return rooster;
    const kaart = new Map();
    for (const t of treePositions) {
      const k = `${Math.floor(t.x / HOK)}:${Math.floor(t.z / HOK)}`;
      if (!kaart.has(k)) kaart.set(k, []);
      kaart.get(k).push(t);
    }
    rooster = { kaart, n: treePositions.length };
    return rooster;
  }

  /** Sta je onder een boomkroon? */
  function onderBoom(x, z) {
    const r = bomenRooster();
    const i0 = Math.floor((x - 6) / HOK), i1 = Math.floor((x + 6) / HOK);
    const j0 = Math.floor((z - 6) / HOK), j1 = Math.floor((z + 6) / HOK);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const lijst = r.kaart.get(`${i}:${j}`);
      if (!lijst) continue;
      for (const t of lijst) {
        const straal = KROON * (t.s || 1) * (t.tall ? 0.6 : 1);
        if ((t.x - x) ** 2 + (t.z - z) ** 2 < straal * straal) return true;
      }
    }
    return false;
  }

  /** Ligt er een dak boven je — een brugdek, het viaduct? */
  function onderDak(x, z, y) {
    const boven = grondHoogte(x, z, Infinity);
    return boven > y + DAK_BOVEN;
  }

  /*
   Ziet de heli je?

   Dit is de kern van de hele toevoeging, en het is expres een lijst die je kunt
   navertellen: gehurkt niet, onder groen niet, onder een dak niet, te ver weg
   niet. Alles daarbuiten wel — hij hangt op tweeënzestig meter recht boven je,
   en een schutting helpt daar niet tegen.
  */
  function zichtbaar(x, z, y) {
    if (!H.groep.visible) return false;
    const d = Math.hypot(H.groep.position.x - x, H.groep.position.z - z);
    if (d > ZICHT) return false;
    if ((player.hurk || 0) > HURK_GRENS) return false;
    if (onderDak(x, z, y)) return false;
    const v = KAART ? vlakOp(x, z) : null;
    if (v && GROEN.has(v.k)) return false;
    if (onderBoom(x, z)) return false;
    return true;
  }

  // ---------- de baan ----------
  let actief = false;           // hoort hij er te zijn?
  // 'weg' | 'komt' | 'cirkelt' | 'gaat' | 'stort' (geraakt, op weg naar beneden)
  // | 'wrak' (ligt te branden)
  let fase = 'weg';
  let hoek = 0;                 // waar hij op zijn rondje staat
  let ziet = false;
  let klok = 0;
  let hp = HELI_HP;             // wat er nog over is van de twintig
  let valT = 0;                 // hoe lang hij al valt
  let tol = 0;                  // de hoek waarover hij tolt
  let wachtT = 0;               // zoveel seconden geen nieuwe heli na een crash
  let ontploft = null;          // {x, y, z} waar hij insloeg, voor js/politie.js

  /*
   De rookpluim achter een geraakte heli en de vuurbal bij de klap. Allebei
   getekend met de bollen die er toch al zijn — er zitten geen plaatjes in dit
   spel. De pluim is een handvol bollen die achterblijven en uitdijen, de vuurbal
   één grote die opzwelt en wegzakt.
  */
  const PLUIM = 14;
  const pluim = [];
  const rookGeo = new THREE.SphereGeometry(1, 7, 5);
  for (let i = 0; i < PLUIM; i++) {
    const m = new THREE.Mesh(rookGeo, new THREE.MeshBasicMaterial({
      color: 0x2a2724, transparent: true, opacity: 0, depthWrite: false,
    }));
    m.visible = false;
    scene.add(m);
    pluim.push({ mesh: m, t: 0, maat: 1 });
  }
  let pluimKlok = 0;
  const vuurbal = new THREE.Mesh(rookGeo, new THREE.MeshBasicMaterial({
    color: 0xff8a2a, transparent: true, opacity: 0, depthWrite: false,
  }));
  vuurbal.visible = false;
  scene.add(vuurbal);

  function rookNa(x, y, z, vuur = false) {
    const p = pluim.find(o => o.t <= 0);
    if (!p) return;
    p.t = 1; p.maat = vuur ? 3.2 : 1.4 + Math.random() * 1.2;
    p.mesh.position.set(x, y, z);
    p.mesh.material.color.setHex(vuur ? 0xff7a1a : 0x2a2724);
    p.mesh.visible = true;
  }
  function werkRookBij(dt) {
    for (const p of pluim) {
      if (p.t <= 0) continue;
      p.t -= dt * 0.28;
      if (p.t <= 0) { p.mesh.visible = false; continue; }
      const g = p.maat * (1 + (1 - p.t) * 2.4);
      p.mesh.scale.setScalar(g);
      p.mesh.position.y += dt * 1.6;                  // rook stijgt
      p.mesh.material.opacity = 0.55 * p.t;
    }
  }

  function startPlek(doel) {
    // hij komt van buiten de wijk aanvliegen, altijd van dezelfde kant als waar
    // hij de vorige keer heen ging — het is één toestel
    const a = Math.random() * Math.PI * 2;
    return { x: doel.x + Math.cos(a) * VER_WEG, z: doel.z + Math.sin(a) * VER_WEG };
  }

  /**
   * Eén beeld.
   *
   * `aan` zegt of hij er hoort te zijn (vier sterren of meer), `doel` is de plek
   * waarboven hij hoort te cirkelen — de laatst bekende plek van de speler — en
   * `donker` of het zoeklicht aan moet.
   *
   * Levert terug of hij de speler op dit moment ziet; js/politie.js werkt
   * daarmee `laatstBekend` bij.
   */
  function update(dt, { aan = false, doel = null, donker = false } = {}) {
    klok += dt;
    werkRookBij(dt);
    const sp = player.inCar || player.pos;
    const mik = doel || { x: sp.x, z: sp.z };

    /*
     ---- neergehaald ----
     Storten en branden gaan hun eigen gang: of er nog vier sterren staan doet er
     even niet toe, en zolang hij valt ziet hij je niet. Na de klap blijft de
     vuurbal een paar tellen liggen en duurt het TERUG seconden voor er een nieuw
     toestel komt — ze hebben er niet tien.
    */
    if (fase === 'stort' || fase === 'wrak') { stortStap(dt); return false; }
    if (wachtT > 0) { wachtT -= dt; geluid.heli(null); ziet = false; return false; }

    if (aan && !actief) {
      actief = true;
      fase = 'komt';
      hp = HELI_HP;
      const p = startPlek(mik);
      H.groep.position.set(p.x, HOOGTE + 40, p.z);
      H.groep.rotation.set(0, 0, 0);
      H.groep.visible = true;
      if (H.staartRotor) H.staartRotor.visible = true;
    } else if (!aan && actief) {
      actief = false;
      fase = 'gaat';
    }
    if (fase === 'weg') { geluid.heli(null); return false; }

    const pos = H.groep.position;
    let doelPos;
    if (fase === 'gaat') {
      // hij draait af naar buiten de wijk en klimt weg
      const dx = pos.x - mik.x, dz = pos.z - mik.z;
      const L = Math.hypot(dx, dz) || 1;
      doelPos = new THREE.Vector3(mik.x + (dx / L) * VER_WEG, HOOGTE + 60, mik.z + (dz / L) * VER_WEG);
      if (L > VER_WEG * 0.8) { fase = 'weg'; H.groep.visible = false; geluid.heli(null); return false; }
    } else {
      // op zijn rondje boven het doel; zolang hij aan komt vliegen snijdt hij
      // de bocht af en komt hij er vanzelf op uit
      hoek += (dt / RONDJE) * Math.PI * 2;
      const grond = grondHoogte(mik.x, mik.z, -Infinity);
      doelPos = new THREE.Vector3(
        mik.x + Math.cos(hoek) * STRAAL,
        grond + HOOGTE,
        mik.z + Math.sin(hoek) * STRAAL,
      );
      if (fase === 'komt' && pos.distanceTo(doelPos) < 30) fase = 'cirkelt';
    }

    // ernaartoe, met een vaart die past bij wat hij aan het doen is
    const stap = (fase === 'cirkelt' ? AANVLIEG * 0.55 : AANVLIEG) * dt;
    const naar = doelPos.clone().sub(pos);
    const afst = naar.length();
    if (afst > 1e-4) pos.add(naar.multiplyScalar(Math.min(1, stap / afst)));

    /*
     De neus wijst waar hij heen gaat, en hij helt de bocht in. Een heli die
     recht blijft hangen in een bocht ziet eruit als een speeltje aan een
     touwtje; overhellen is wat hem een toestel maakt.
    */
    const gaat = doelPos.clone().sub(pos);
    if (gaat.lengthSq() > 1e-4) {
      const wil = Math.atan2(-gaat.x, -gaat.z);
      let d = wil - H.groep.rotation.y;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      H.groep.rotation.y += d * Math.min(1, dt * 1.6);
      H.groep.rotation.z = -Math.max(-0.28, Math.min(0.28, d * 0.9));
      H.groep.rotation.x = fase === 'cirkelt' ? 0.06 : 0.12;   // neus omlaag als hij vaart maakt
    }

    // rotoren
    H.rotor.rotation.y += dt * 34;
    H.staartRotor.rotation.x += dt * 52;
    // zwaailichten, om beurten
    const links = Math.floor(klok * 4) % 2 === 0;
    H.links.material.emissiveIntensity = links ? 3.4 : 0.15;
    H.rechts.material.emissiveIntensity = links ? 0.15 : 3.4;

    // zoeklicht: alleen in het donker, en alleen als hij ergens boven hangt
    const licht = donker && fase === 'cirkelt';
    H.bundelMat.opacity = licht ? 0.10 : 0;
    H.bundel.visible = licht;
    H.lampGlas.material.emissiveIntensity = licht ? 3.0 : 0.1;

    const spY = player.inCar ? (player.inCar.y || 0) : player.pos.y;
    ziet = fase !== 'gaat' && zichtbaar(sp.x, sp.z, spY);

    geluid.heli(Math.hypot(pos.x - sp.x, pos.z - sp.z));
    return ziet;
  }

  /*
   ---- de crash ----
   Eén beeld van het storten of van het wrak. Hij tolt om zijn as (de staartrotor
   is eraf, dus er is niets meer wat de romp tegenhoudt), zakt steeds sneller en
   laat rook achter. Bij de grond klapt hij en blijft er een vuurbal liggen.
  */
  function stortStap(dt) {
    const pos = H.groep.position;
    if (fase === 'stort') {
      valT += dt;
      tol += TOL * dt;
      H.groep.rotation.y = tol;
      H.groep.rotation.z = Math.sin(tol * 0.7) * 0.35;
      H.groep.rotation.x = 0.28;
      if (H.rotor) H.rotor.rotation.y += dt * 6;      // de rotor loopt uit
      pos.y -= (VAL + VAL_AAN * valT) * dt;
      pluimKlok -= dt;
      if (pluimKlok <= 0) { pluimKlok = 0.06; rookNa(pos.x, pos.y, pos.z); }
      const grond = grondHoogte(pos.x, pos.z, -Infinity);
      if (pos.y <= grond + 1.6) {
        pos.y = grond + 1.6;
        fase = 'wrak';
        valT = 0;
        ontploft = { x: pos.x, y: grond, z: pos.z };
        H.groep.visible = false;
        vuurbal.position.set(pos.x, grond + 2.2, pos.z);
        vuurbal.visible = true;
        for (let i = 0; i < 8; i++) {
          const a2 = i / 8 * 6.283;
          rookNa(pos.x + Math.cos(a2) * 2.5, grond + 1.5, pos.z + Math.sin(a2) * 2.5, true);
        }
        geluid.klap();
        geluid.heli(null);
      } else {
        // hoe lager hij komt, hoe harder je hem hoort — en dan is het stil
        geluid.heli(Math.hypot(pos.x - (player.inCar || player.pos).x, pos.z - (player.inCar || player.pos).z));
      }
      return;
    }
    // fase === 'wrak': de vuurbal zakt weg en daarna is er even geen heli
    valT += dt;
    const f = Math.max(0, 1 - valT / NA_DE_KLAP);
    vuurbal.scale.setScalar(3.5 + (1 - f) * 3);
    vuurbal.material.opacity = 0.85 * f * f;
    if (valT > 0.25 && valT < NA_DE_KLAP * 0.6 && Math.random() < dt * 6) {
      rookNa(vuurbal.position.x + (Math.random() - 0.5) * 4, vuurbal.position.y,
        vuurbal.position.z + (Math.random() - 0.5) * 4);
    }
    if (valT >= NA_DE_KLAP) {
      vuurbal.visible = false;
      fase = 'weg';
      actief = false;
      wachtT = TERUG;
    }
  }

  /**
   * Een kogel. Levert true als hij de heli raakte, zodat js/main.js weet dat hij
   * niet ook nog iets anders moet doen met dezelfde treffer.
   */
  function raak(obj, hoeveel = 1) {
    if (fase === 'weg' || fase === 'stort' || fase === 'wrak') return false;
    let hit = false;
    H.groep.traverse(o => { if (o === obj) hit = true; });
    if (!hit) return false;
    hp -= hoeveel;
    if (hp > 0) {
      // je hoort en ziet dat je hem raakt, ook al gaat hij nog niet neer
      geluid.raak();
      if (hp <= HELI_HP * 0.4) rookNa(H.groep.position.x, H.groep.position.y, H.groep.position.z);
      return true;
    }
    // op: de staartrotor eraf en naar beneden
    fase = 'stort';
    valT = 0; tol = H.groep.rotation.y; ziet = false;
    if (H.staartRotor) H.staartRotor.visible = false;
    geluid.klap();
    return true;
  }

  // waar de kogels op mogen stuiten (js/main.js zet dit bij de doelen)
  function doelen() {
    return (fase === 'weg' || fase === 'wrak' || !H.groep.visible) ? [] : [H.groep];
  }

  function reset() {
    actief = false; fase = 'weg'; ziet = false;
    hp = HELI_HP; valT = 0; wachtT = 0; ontploft = null;
    H.groep.visible = false;
    H.groep.rotation.set(0, 0, 0);
    if (H.staartRotor) H.staartRotor.visible = true;
    vuurbal.visible = false;
    for (const p of pluim) { p.t = 0; p.mesh.visible = false; }
    geluid.heli(null);
  }

  return {
    update, reset, raak, doelen, groep: H.groep,
    // voor js/hud.js en de proeven
    get actief() { return fase !== 'weg'; },
    get fase() { return fase; },
    get ziet() { return ziet; },
    get positie() { return H.groep.position; },
    get hp() { return hp; },
    get maxHp() { return HELI_HP; },
    // waar hij insloeg, één keer op te halen; js/politie.js maakt er een melding van
    pakOntploft() { const o = ontploft; ontploft = null; return o; },
    zichtbaar, onderBoom, onderDak,
  };
}
