/*
 De politie op het water.

 Op de Geeuw was je veilig. De politie rijdt over de weg, en zodra je de sloep
 nam stond de hele achtervolging langs de kant te kijken: de wagens reden een
 eind mee over de Oppenhuizerweg en verderop hield de weg op. Wie met een boot
 vlucht hoort met een boot achterna gezeten te worden.

 Eén politieboot, en alleen als hij ergens op slaat:
 - je zit zelf in een sloep (aan de wal is er niets te patrouilleren), en
 - er is verdenking (één ster is genoeg).

 Hij komt uit de richting van het diepe water, gaat langszij en de twee agenten
 aan boord schieten zodra ze je zien. Ga je van boord of ben je ze kwijt, dan
 draait hij af en verdwijnt; hij komt terug zodra je weer op het water zit.

 De vaartechniek is die van js/boot.js — dezelfde romp, dezelfde weerstand,
 dezelfde toets of de romp er nog past — met een stuurautomaat in plaats van een
 toetsenbord. Wat hij níet deelt is de topsnelheid: een politiesloep met een
 zware buitenboordmotor loopt harder dan de sloep die jij losmaakt, anders is
 wegvaren geen keuze maar een garantie.
*/
import * as THREE from 'three';
import { vaarbaar, zichtVrij } from './world.js';
import { bouwSloep, sloepPast, SLOEP } from './boot.js';
import { Persoon } from './persoon.js';
import { geluid } from './audio.js';

const UNIFORM = { shirt: 0x1b2a4a, broek: 0x141c2c, vest: 0xd6dc46, schoen: 0x14161c };

/*
 ---- varen ----

 Sneller dan jouw sloep, want een achtervolging die je op topsnelheid gewoon
 uitzit is geen achtervolging. Hij liep 22 % harder; sinds jouw sloep twee keer
 zo snel is (js/boot.js) is dat te weinig om nog echt in te lopen — op veertien
 meter per seconde scheelt 22 % drie meter per seconde, en dan blijft hij op
 een rechte vaart achter je hangen. Het is nu 40 % harder, met meer stuwkracht
 om het gat ook echt dicht te rijden (verzoek 21 sep 2026).
*/
const TOP = SLOEP.TOP * 1.4;       // ruim 70 km/u: hij haalt je in
const STUW = SLOEP.STUW * 1.45;
const ROER = 0.62;                 // rad/s bij volle vaart
const ROER_TRAAG = 3.0;

// ---- opkomen en afzwaaien ----
const KOM_MIN = 85;                // zo ver weg komt hij in beeld
const KOM_MAX = 150;
const WEG = 260;                   // verder dan dit heeft het geen zin meer
const VERTREK_MAX = 25;            // en zolang duurt afzwaaien hoogstens (s)
const LANGSZIJ = 16;               // zo dichtbij wil hij komen en niet dichterbij

// ---- schieten ----
const VUURBEREIK = 42;
const VUURTIJD = 1.5;
const SCHADE = 5;

// ---- er zelf aan gaan ----
const HP = 14;

/*
 `jaagtOok` is een haakje voor het verhaal: een functie die true geeft als deze
 boot ook zonder verdenking achter je aan moet. Missie 8 zet er drie op het
 water terwijl je geen enkele ster hebt — daar is de waterpolitie de missie, en
 niet het gevolg van iets wat je misdaan hebt.
*/
export function initPolitieboot({ scene, player, hud = null, politie = null, boten = null,
  jaagtOok = null, melding = true }) {
  if (!scene || !boten) return null;

  let boot = null;                 // { groep, x, z, yaw, vx, vz, ... }
  let fase = 'weg';                // 'weg' | 'jaagt' | 'vertrekt' | 'wrak'
  let komT = 2;                    // hoelang nog voor er een komt
  let vuurT = 0;
  /*
   Hoelang hij al aan het afzwaaien is. Hij verdwijnt als hij ver genoeg weg is
   (WEG hierboven), maar op een smalle vaart komt hij daar niet altijd: dan
   ligt er wal in de richting waar hij heen wil en blijft hij rondjes varen in
   beeld. Na een halve minuut afzwaaien is hij hoe dan ook vertrokken.
  */
  let vertrekT = 0;
  let knipper = 0;
  let schade = 0;                  // wat de speler dit beeld oploopt

  const sp = () => (player.inBoot
    ? { x: player.inBoot.x, z: player.inBoot.z }
    : { x: player.pos.x, z: player.pos.z });

  const gezocht = () => !!(politie && politie.ster > 0) || !!(jaagtOok && jaagtOok());
  const opHetWater = () => !!boten.inBoot;

  /*
   Het zwaailicht: dezelfde blauwe kap als op de lichtbalk van een wagen
   (js/politie.js), maar dan één, op de stuurconsole. Hij knippert door de
   emissieve sterkte heen en weer te zetten — niet door hem aan en uit te zetten,
   want een lamp die weg is leest als een kapotte lamp en niet als een zwaailicht.
  */
  function zwaailicht() {
    const g = new THREE.Group();
    const donker = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.8 });
    /*
     Op een stokje. Op de console zelf is hij op dertig meter een blauwe stip van
     vier beeldpunten die achter de schouder van een agent verdwijnt; een halve
     meter hoger steekt hij overal bovenuit, en dat is ook waar hij op een echte
     politieboot zit.
    */
    const paal = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.46, 6), donker);
    paal.position.y = 0.23;
    g.add(paal);
    const voet = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.05, 10), donker);
    voet.position.y = 0.47;
    g.add(voet);
    /*
     `toneMapped = false` haalt de kap uit de belichtingscurve van de renderer.
     Zonder dat wordt een fel blauw op een zonnige dag teruggerekend naar iets
     grijzigs en lees je hem als een doosje op een stokje in plaats van als een
     zwaailicht.
    */
    const mat = new THREE.MeshStandardMaterial({ color: 0x2b6bff, emissive: 0x2b6bff, emissiveIntensity: 2.6 });
    mat.toneMapped = false;
    const kap = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.22, 12), mat);
    kap.position.y = 0.60;
    g.add(kap);
    return { groep: g, mat };
  }

  function maakBoot() {
    const groep = bouwSloep({
      naam: 'POLITIE',
      romp: 0x16325e,          // donkerblauw, zoals de wagens
      kleur: 0xeef1f5,
    });
    scene.add(groep);
    /*
     Het zwaailicht komt op de stuurconsole. Niet met een plek in de buitenste
     groep: daarin is −z de vaarrichting, terwijl de romp zelf een kwartslag
     gedraaid in een binnengroep zit (js/boot.js) — zet je hem daar neer, dan
     staat hij dwars. De console zit in die binnengroep en wordt door `bouwSloep`
     doorgegeven, dus hij gaat eraan vast: (0, 1,05, 0) is net boven het blad.
    */
    const licht = zwaailicht();
    licht.groep.position.set(0, 1.18, 0);
    (groep.userData.console || groep).add(licht.groep);

    /*
     Twee agenten aan boord: een aan het roer en een voorin, want in je eentje
     kun je niet varen én richten. Ze staan met opzet uit elkaar — naast elkaar
     achter de console stonden ze allebei vóór het zwaailicht, en dan zie je van
     de hele boot alleen twee ruggen. Hun plek is in scheepscoördinaten
     (langsscheeps, dwarsscheeps) en wordt elk beeld omgerekend.
    */
    const bemanning = [[-1.35, 0.34], [0.60, -0.28]].map(([l, d], i) => {
      const p = new Persoon({
        ...UNIFORM, huid: i ? 0xc79a72 : 0xd9b48f,
        hoogte: 0.99 + i * 0.03, wapen: true, pet: true,
      });
      scene.add(p.groep);
      return { persoon: p, l, d };
    });

    return {
      groep, licht, bemanning,
      x: 0, z: 0, yaw: 0, vx: 0, vz: 0, roer: 0, gas: 0, snelheid: 0,
      hp: HP, deining: Math.random() * 6.28,
    };
  }

  /*
   Waar komt hij vandaan? Ergens op het water tussen KOM_MIN en KOM_MAX meter,
   bij voorkeur achter je — een politieboot die vóór je uit de rietkraag komt
   varen is geen achtervolging. Er wordt rondom geprobeerd en de plek met de
   beste score wint: ver genoeg, uit het zicht, en achter je.
  */
  function komPlek() {
    const p = sp();
    const jij = player.inBoot;
    const fx = jij ? -Math.sin(jij.yaw) : 0, fz = jij ? -Math.cos(jij.yaw) : 0;
    let beste = null;
    for (let i = 0; i < 160; i++) {
      const hoek = Math.random() * 6.283;
      const d = KOM_MIN + Math.random() * (KOM_MAX - KOM_MIN);
      const x = p.x + Math.cos(hoek) * d, z = p.z + Math.sin(hoek) * d;
      if (!vaarbaar(x, z)) continue;
      // kijkt hij jouw kant op, en past hij daar?
      const yaw = Math.atan2(-(p.x - x), -(p.z - z));
      if (!sloepPast(x, z, yaw)) continue;
      // achter je is beter, en uit het zicht is beter
      const achter = jij ? -((x - p.x) * fx + (z - p.z) * fz) / d : 0;
      const gezien = zichtVrij(p.x, p.z, x, z, 1.4);
      const score = achter * 40 + (gezien ? 0 : 25) + d * 0.1;
      if (!beste || score > beste.score) beste = { x, z, yaw, score };
    }
    return beste;
  }

  /*
   De stuurautomaat. Hij wil naar een punt LANGSZIJ meter van je vandaan, en
   stuurt daarheen met het roer; het gas hangt aan hoe recht hij ligt, want vol
   gas dwars op je koers levert alleen een ruime bocht op.

   En hij moet langs de kant. Recht op je af varen werkt op de Geeuw en niet in
   een sloot met een knik erin, dus er wordt bij een blokkade een waaier van
   koersen geprobeerd — dezelfde truc als waarmee de sloep van de speler zijn
   ligplaats vindt.
  */
  function stuur(b, doel, dt) {
    const naarX = doel.x - b.x, naarZ = doel.z - b.z;
    const d = Math.hypot(naarX, naarZ) || 1;
    let wens = Math.atan2(-naarX, -naarZ);

    // ligt er wal in de weg? zoek dan de vrijste koers die er nog bij in de
    // buurt ligt; om de 15° naar links en rechts, de eerste die vrij is wint
    const vrij = (yaw, ver) => {
      for (let r = 4; r <= ver; r += 4) {
        if (!sloepPast(b.x - Math.sin(yaw) * r, b.z - Math.cos(yaw) * r, yaw)) return r;
      }
      return ver + 1;
    };
    const ruim = Math.min(22, d);
    if (vrij(wens, ruim) <= ruim) {
      let beste = null;
      for (let i = 1; i <= 11; i++) for (const teken of [1, -1]) {
        const y = wens + teken * i * Math.PI / 12;
        const r = vrij(y, ruim);
        if (!beste || r > beste.r) beste = { y, r };
        if (r > ruim) { beste = { y, r }; i = 99; break; }
      }
      if (beste) wens = beste.y;
    }

    let af = (wens - b.yaw + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    const doelRoer = Math.max(-1, Math.min(1, af * 1.8));
    b.roer += (doelRoer - b.roer) * Math.min(1, dt * ROER_TRAAG);

    // gas: minder als hij scheef ligt of als hij er al is
    const recht = Math.max(0, 1 - Math.abs(af) / 1.4);
    const dichtbij = Math.max(0, Math.min(1, (d - LANGSZIJ * 0.6) / LANGSZIJ));
    b.gas += (recht * dichtbij - b.gas) * Math.min(1, dt * 2.2);
    return d;
  }

  function vaarStap(b, dt) {
    const fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw);
    const rx = Math.cos(b.yaw), rz = -Math.sin(b.yaw);
    let vl = b.vx * fx + b.vz * fz;
    let vd = b.vx * rx + b.vz * rz;
    vl += STUW * b.gas * dt;
    vl -= vl * Math.abs(vl) * SLOEP.LANGS * dt;
    vl -= Math.sign(vl) * Math.min(Math.abs(vl), SLOEP.LANGS_VAST * dt);
    vd -= vd * Math.min(1, SLOEP.DWARS * dt);
    vl = Math.max(0, Math.min(TOP, vl));
    b.yaw += b.roer * ROER * Math.max(-1, Math.min(1, vl / (TOP * 0.5))) * dt;
    b.vx = fx * vl + rx * vd;
    b.vz = fz * vl + rz * vd;
    const nx = b.x + b.vx * dt, nz = b.z + b.vz * dt;
    if (sloepPast(nx, nz, b.yaw)) { b.x = nx; b.z = nz; }
    else if (sloepPast(nx, b.z, b.yaw)) { b.x = nx; b.vz *= 0.2; }
    else if (sloepPast(b.x, nz, b.yaw)) { b.z = nz; b.vx *= 0.2; }
    else { b.vx *= 0.1; b.vz *= 0.1; }
    b.snelheid = vl;
  }

  function zetBeeld(b, dt, t) {
    b.deining += dt * 1.35;
    const rust = Math.max(0, 1 - b.snelheid / 3);
    const y = SLOEP.WATER_Y + Math.sin(b.deining) * 0.035 * (0.4 + rust * 0.6);
    b.groep.position.set(b.x, y, b.z);
    b.groep.rotation.y = b.yaw;
    b.groep.rotation.z = -b.roer * 0.22 * Math.min(1, b.snelheid / (TOP * 0.6));
    b.groep.rotation.x = -b.snelheid / TOP * 0.055;
    const u = b.groep.userData;
    if (u && u.schroef) u.schroef.rotation.x += (b.gas * 26 + 1) * dt;

    // het zwaailicht knippert; bij een wrak blijft hij uit
    knipper += dt;
    const aan = fase !== 'wrak' && Math.floor(knipper * 4) % 2 === 0;
    b.licht.mat.emissiveIntensity = aan ? 3.4 : 0.2;

    b.dekY = y + SLOEP.VLOER;
    void t;
  }

  /*
   De bemanning op zijn plek zetten. Dit moet ná `persoon.update`, niet ervoor:
   die rekent elk beeld zelf uit waar de grond onder iemand ligt (js/persoon.js
   doet dat voor het viaduct) en zet hem daarop. Boven water is die grond nul, en
   dan staan de agenten tot hun middel in de Geeuw naast hun eigen boot.
  */
  function zetBemanning(b) {
    const fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw);
    const rx = Math.cos(b.yaw), rz = -Math.sin(b.yaw);
    for (const m of b.bemanning) {
      if (m.neer) continue;
      m.persoon.grond = b.dekY;
      m.persoon.groep.position.set(b.x + fx * m.l + rx * m.d, b.dekY, b.z + fz * m.l + rz * m.d);
    }
  }

  function ruim() {
    if (!boot) return;
    scene.remove(boot.groep);
    for (const m of boot.bemanning) scene.remove(m.persoon.groep);
    boot = null;
    fase = 'weg';
    komT = 6 + Math.random() * 6;
  }

  function update(dt) {
    schade = 0;
    const water = opHetWater(), jacht = water && gezocht();

    if (!boot) {
      if (!jacht) { komT = 2; return 0; }
      komT -= dt;
      if (komT > 0) return 0;
      const plek = komPlek();
      if (!plek) { komT = 2; return 0; }        // nergens water genoeg: later weer
      boot = maakBoot();
      boot.x = plek.x; boot.z = plek.z; boot.yaw = plek.yaw;
      fase = 'jaagt';
      if (hud && melding) hud.show('Politie te water', 2.6);
      return 0;
    }

    const p = sp();
    const d = Math.hypot(p.x - boot.x, p.z - boot.z);

    if (fase === 'jaagt' && !jacht) { fase = 'vertrekt'; vertrekT = 0; }
    if (fase === 'vertrekt' && jacht && boot.hp > 0) fase = 'jaagt';

    if (fase === 'jaagt') {
      stuur(boot, p, dt);
    } else if (fase === 'vertrekt') {
      // van je weg varen: het spiegelbeeld van je eigen plek
      stuur(boot, { x: boot.x * 2 - p.x, z: boot.z * 2 - p.z }, dt);
      vertrekT += dt;
      if (d > WEG || vertrekT > VERTREK_MAX) { ruim(); return 0; }
    } else if (fase === 'wrak') {
      boot.gas = 0; boot.roer *= 0.98;
      if (d > WEG) { ruim(); return 0; }
    }
    if (d > WEG + 60) { ruim(); return 0; }     // hopeloos ver: opnieuw beginnen

    vaarStap(boot, dt);
    zetBeeld(boot, dt, 0);

    // ---- schieten ----
    const mag = fase === 'jaagt' && d < VUURBEREIK && zichtVrij(boot.x, boot.z, p.x, p.z, 1.4);
    vuurT -= dt;
    for (const m of boot.bemanning) {
      if (m.neer) continue;
      m.persoon.kijkNaar(p.x, p.z, dt, 6);
      m.persoon.update(dt, { loopt: false, mikt: mag });
    }
    zetBemanning(boot);
    if (mag && vuurT <= 0) {
      vuurT = VUURTIJD * (0.8 + Math.random() * 0.6);
      const schutter = boot.bemanning.find(m => !m.neer);
      if (!schutter) return 0;
      schutter.persoon.vuur();
      geluid.schot();
      /*
       Raak schieten vanaf een deinende boot naar een deinende boot is lastiger
       dan vanaf de kant; de kans ligt daarom lager dan bij een agent te voet
       (js/politie.js), en hij loopt harder terug met de afstand.
      */
      if (Math.random() < Math.max(0.10, 0.42 - d * 0.009)) schade += SCHADE;
    }
    return schade;
  }

  /*
   Erop schieten. Veertien treffers en de motor geeft het op: hij blijft liggen,
   het zwaailicht gaat uit en er wordt niet meer geschoten. Elke treffer telt als
   een schot op de politie, net als bij een wagen en de helikopter — dat regelt
   de aanroeper (js/main.js), want die weet wie er schoot.

   `obj` is het ding waar de straal op landde, net als bij `politie.raak`. De
   bemanning gaat vóór de romp: raak je een agent, dan is dat een agent en niet
   "de boot geraakt".
  */
  function raak(obj, hoeveel = 1) {
    if (!boot || fase === 'wrak') return false;
    let hit = false;
    boot.groep.traverse(o => { if (o === obj) hit = true; });
    if (!hit) return false;
    boot.hp -= hoeveel;
    if (boot.hp <= 0) {
      fase = 'wrak';
      geluid.klap();
      // Geen tekst in beeld (verzoek 19 sep 2026, net als bij de helikopter):
      // de klap en een boot die stil komt te liggen vertellen het al.
    }
    return true;
  }

  // waar kun je op mikken? js/main.js zet dit in de lijst waar de straal op zoekt
  function doelen() {
    if (!boot) return [];
    const uit = [boot.groep];
    if (fase !== 'wrak') for (const m of boot.bemanning) uit.push(m.persoon.groep);
    return uit;
  }

  /*
   Een agent aan boord neergeschoten. Twee van de twee en er wordt niet meer
   geschoten; de boot vaart dan als een wrak verder, want er staat niemand meer
   aan het roer.
  */
  function raakAgent(obj) {
    if (!boot) return false;
    for (const m of boot.bemanning) {
      if (m.neer) continue;
      let hit = false;
      m.persoon.groep.traverse(o => { if (o === obj) hit = true; });
      if (!hit) continue;
      m.neer = true;
      m.persoon.groep.visible = false;
      if (boot.bemanning.every(q => q.neer)) fase = 'wrak';
      return true;
    }
    return false;
  }

  function reset() { ruim(); komT = 2; vertrekT = 0; }

  return {
    update, raak, raakAgent, doelen, reset,
    get actief() { return !!boot; },
    get fase() { return fase; },
    get plek() { return boot ? { x: boot.x, z: boot.z } : null; },
    get hp() { return boot ? boot.hp : 0; },
    get maxHp() { return HP; },
    get vaart() { return boot ? boot.snelheid : 0; },
    get top() { return TOP; },
  };
}
