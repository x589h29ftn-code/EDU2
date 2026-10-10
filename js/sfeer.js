// Sfeer: tijd van de dag, weer, wind in de bomen, stromend water en
// straatverlichting die 's avonds echt aangaat.
//
// De tijd loopt van 0 tot 24 uur. Zonnestand, luchtkleuren, mist en de
// sterkte van het licht volgen daaruit. Met T zet je de klok een paar uur
// vooruit, met Y wissel je van weertype.
import * as THREE from 'three';
import { sfeerMaterialen, lampPosities } from './world.js';
import { nachtUniform, tijdUniform, aandeelUniform } from './licht.js';
import { zetKoplampen } from './carmodel.js';
import { zetLichtpoelen } from './kaartwereld.js';
import { geluid } from './audio.js';

const WEER = ['helder', 'bewolkt', 'regen'];

// kleurstalen per moment van de dag: [zonkleur, hemelboven, hemelmidden, horizon, sterkte]
const DAGKLEUREN = [
  { u: 0,  zon: 0x2a3c66, top: 0x08111f, mid: 0x122036, bot: 0x1b2b40, kracht: 0.05, hemel: 0.10 },
  { u: 5,  zon: 0x5b5470, top: 0x1d2f52, mid: 0x3f4f70, bot: 0x6d6a72, kracht: 0.18, hemel: 0.25 },
  { u: 7,  zon: 0xffb066, top: 0x3a6ba8, mid: 0x9db6cf, bot: 0xe8c0a0, kracht: 1.10, hemel: 0.55 },
  { u: 10, zon: 0xfff1de, top: 0x2f6fc4, mid: 0x8fbde6, bot: 0xdae8f2, kracht: 2.20, hemel: 0.75 },
  { u: 14, zon: 0xfff3e0, top: 0x2c69bd, mid: 0x8dbbe4, bot: 0xd8e6f0, kracht: 2.30, hemel: 0.78 },
  { u: 18, zon: 0xffd7a2, top: 0x3a6ba8, mid: 0x9cb8d6, bot: 0xe6cbb0, kracht: 1.40, hemel: 0.60 },
  { u: 20, zon: 0xff9a5a, top: 0x2a4a7d, mid: 0x76729a, bot: 0xd88f62, kracht: 0.55, hemel: 0.35 },
  { u: 22, zon: 0x35406b, top: 0x111c33, mid: 0x1d2b44, bot: 0x2b3a52, kracht: 0.10, hemel: 0.15 },
  { u: 24, zon: 0x2a3c66, top: 0x08111f, mid: 0x122036, bot: 0x1b2b40, kracht: 0.05, hemel: 0.10 },
];

/*
 Onweer (stap 131: "Onweer ook als kans als het regent, wel realistisch"). Zolang het echt regent gooit het weer elk
 beeld een dobbelsteen met `kans` per minuut; valt hij, dan begint er een bui van `duur` tellen. Daarin om de `tussen`
 tellen een bliksem: de lucht en het licht een flits van `flits` tellen fel wit-blauw (één tot drie ontladingen na
 elkaar, zoals een echte bliksem flakkert), en na `vertraging` tellen de donder — geluid gaat 343 m/s, dus een tel is
 een derde kilometer. Over de bui komt hij dichterbij en trekt weer weg: de vertraging zakt van zes naar één tel en
 loopt weer op. Er komt GEEN lichtbron bij (CLAUDE.md: het aantal lichten mag tijdens het spelen niet veranderen);
 de flits zit in de sterkte van de hemel- en vullamp die er al zijn, in de lucht, de mist en de wolken.
 Stopt het met regenen, dan is de bui voorbij (wat nog onderweg is, rommelt nog na).
*/
export const ONWEER = {
  kans: 0.25,              // per minuut regen
  duur: [150, 300],        // tellen
  tussen: [15, 60],        // tellen tussen twee bliksems
  eerste: [4, 12],         // tellen tot de eerste
  flits: [0.1, 0.2],       // tellen
  vertraging: [1, 6],      // tellen tussen flits en donder
  geluid: 343,             // m/s
  hemel: 2.4,              // zoveel sterkte erbij voor de hemellamp bij een volle flits
  vul: 1.3,                // en voor de vullamp
  lucht: 0.75,             // zover gaat de lucht naar de flitskleur
  binnen: 0.3,             // zoveel ervan binnen (dichte ramen)
};
const FLITS_KLEUR = new THREE.Color(0xdde6ff);

/*
 De wind (stap 131, voor de zeilbootjes van js/zeilen.js): een richting die langzaam draait rond het zuidwesten
 (hij waait naar het noordoosten: +x is oost, −z is noord), en een kracht van 0 tot 1 die met het weer meegaat.
 `x` en `z` zijn de richting waar hij naartoe waait.
*/
export const WIND = { hoek: -Math.PI / 4, draai: 0.5, kracht: [0.35, 0.55, 0.8] };

function meng(u) {
  let a = DAGKLEUREN[0], b = DAGKLEUREN[DAGKLEUREN.length - 1];
  for (let i = 0; i < DAGKLEUREN.length - 1; i++) {
    if (u >= DAGKLEUREN[i].u && u <= DAGKLEUREN[i + 1].u) { a = DAGKLEUREN[i]; b = DAGKLEUREN[i + 1]; break; }
  }
  const t = (u - a.u) / Math.max(0.001, b.u - a.u);
  const kl = (x, y) => new THREE.Color(x).lerp(new THREE.Color(y), t);
  return {
    zon: kl(a.zon, b.zon), top: kl(a.top, b.top), mid: kl(a.mid, b.mid), bot: kl(a.bot, b.bot),
    kracht: a.kracht + (b.kracht - a.kracht) * t,
    hemel: a.hemel + (b.hemel - a.hemel) * t,
  };
}

/*
 Hoe dik de ochtendmist is (stap 124), 0 tot 1: van half vijf tot half zes komt hij op, tot tien voor
 zeven hangt hij er vol, en om acht is hij weg. Bij regen niet.
*/
export function ochtendMist(uur, weer = 'helder') {
  if (weer === 'regen') return 0;
  const s = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  return s(4.5, 5.5, uur) * (1 - s(6.8, 8.0, uur)) * (weer === 'bewolkt' ? 0.8 : 1);
}

/*
 Het dag-en-nachtritme (stap 125: "zorg dat er standaard een dag en nacht ritme loopt met de tijd").
 De klok loopt vanaf een nieuw spel mee: een dag duurt `DAG_MINUTEN` echte minuten, dus een uur in het
 spel twee minuten. Licht is het van zes tot zes (de zon in `pasToe`); de straatlantaarns gaan aan als
 het schemert. Wie het niet wil, zet het in de instellingen uit (`voorkeur`, bewaard in de browser).

 `TIJDEN` zijn de standen van de schakelaar onder T: ochtend, middag, avond en nacht, in die volgorde.
*/
export const DAG_MINUTEN = 48;
export const TIJDEN = [
  { naam: 'ochtend', uur: 8 },
  { naam: 'middag', uur: 13 },
  { naam: 'avond', uur: 18.25 },
  { naam: 'nacht', uur: 0.5 },
];
const VOORKEUR = 'tinga.dagnacht';
function leesVoorkeur() {
  try { return localStorage.getItem(VOORKEUR) !== 'stil'; } catch { return true; }
}
// welke stand van de schakelaar het nu is (de laatste die al begonnen is)
export function tijdNaam(uur) {
  if (uur >= 5.5 && uur < 11.5) return 'ochtend';
  if (uur >= 11.5 && uur < 17) return 'middag';
  if (uur >= 17 && uur < 22.5) return 'avond';
  return 'nacht';
}

export function initSfeer(ctx) {
  const { scene, camera, renderer, sun, hemi, fill, skyUniforms, hud } = ctx;
  const mats = sfeerMaterialen();

  let uur = 13.5;          // begint op een heldere middag
  let weer = 'helder';
  /*
   Wisselend weer (stap 126). `zwaar` is het weer als getal: helder 0, bewolkt 1, regen 2. Met de hand (Y, het
   menu) springt het meteen; vanzelf schuift het in `WEER_OVERGANG` tellen naar het nieuwe weer, zodat het zicht,
   de lucht en de zon niet in één beeld omslaan. `weer` zelf (de regen, het natte wegdek) gaat halverwege om.
   Elk heel uur in het spel (twee minuten) gooit het weer een dobbelsteen, alleen als de klok loopt.
  */
  const WEER_OVERGANG = 45;
  let zwaar = 0, zwaarDoel = 0;
  let autoWeer = (() => { try { return localStorage.getItem('tinga.weer') !== 'vast'; } catch { return true; } })();
  const W3 = (a, b, c) => (zwaar <= 1 ? a + (b - a) * zwaar : b + (c - b) * (zwaar - 1));
  function dobbelWeer() {
    const r = Math.random();
    const nu = Math.round(zwaarDoel);
    // meestal blijft het zoals het is; een bui duurt een uur of twee
    let naar = nu;
    if (nu === 0 && r < 0.12) naar = 1;
    else if (nu === 1) naar = r < 0.22 ? 2 : r < 0.5 ? 0 : 1;
    else if (nu === 2 && r < 0.45) naar = 1;
    zwaarDoel = naar;
  }
  // de klok loopt standaard mee (stap 125); `voorkeur` is wat de speler in de instellingen koos
  let voorkeur = leesVoorkeur();
  let loopt = voorkeur;
  const wind = { x: Math.cos(WIND.hoek), z: Math.sin(WIND.hoek), kracht: WIND.kracht[0], hoek: WIND.hoek };
  let windKlok = 0;

  // ---------- onweer (stap 131) ----------
  const tussen = ([a, b]) => a + Math.random() * (b - a);
  const onweer = { actief: false, rest: 0, lengte: 0, volgende: 0, bliksems: 0, donders: 0, buien: 0, flitsMax: 0, laatste: null };
  const donders = [];                 // { t, afstand }: onderweg
  let flits = null;                   // { t, duur, pulsen: [[begin, lengte]], sterkte }
  let flitsWas = false;
  function beginOnweer(eersteNa = tussen(ONWEER.eerste)) {
    onweer.actief = true;
    onweer.lengte = onweer.rest = tussen(ONWEER.duur);
    onweer.volgende = eersteNa;
    onweer.buien++;
  }
  function bliksem() {
    // waar in de bui we zijn: 0 aan het begin, 1 aan het eind; in het midden is hij het dichtst bij
    const v = 1 - Math.max(0, Math.min(1, onweer.rest / Math.max(1, onweer.lengte)));
    const [v0, v1] = ONWEER.vertraging;
    const vertraging = Math.max(v0, Math.min(v1, v1 - (v1 - v0) * Math.sin(Math.PI * v) + (Math.random() - 0.5) * 1.6));
    const afstand = vertraging * ONWEER.geluid;
    const duur = tussen(ONWEER.flits);
    const n = 1 + Math.floor(Math.random() * 3);
    const pulsen = [[0, Math.min(duur, 0.05 + Math.random() * 0.03)]];
    for (let i = 1; i < n; i++) {
      const b = duur * (0.35 + 0.6 * i / n) * (0.85 + Math.random() * 0.15);
      pulsen.push([Math.min(b, duur - 0.03), 0.03 + Math.random() * 0.03]);
    }
    flits = { t: 0, duur, pulsen, sterkte: Math.max(0.3, Math.min(1, 1.2 - vertraging * 0.13)) };
    donders.push({ t: vertraging, afstand });
    onweer.bliksems++;
    onweer.laatste = { vertraging: +vertraging.toFixed(2), afstand: Math.round(afstand), duur: +duur.toFixed(3), pulsen: n };
  }
  function flitsSterkte() {
    if (!flits) return 0;
    let s = 0;
    for (const [b, l] of flits.pulsen) {
      const u = (flits.t - b) / l;
      if (u >= 0 && u <= 1) s = Math.max(s, Math.sqrt(1 - u));
    }
    return s * flits.sterkte;
  }
  // de flits over wat `pasToe` net zette: alleen sterktes en kleuren, geen lichtbron erbij
  function flitsOver(s) {
    hemi.intensity += ONWEER.hemel * s;
    fill.intensity += ONWEER.vul * s;
    const l = ONWEER.lucht * s;
    skyUniforms.top.value.lerp(FLITS_KLEUR, l);
    skyUniforms.mid.value.lerp(FLITS_KLEUR, l);
    skyUniforms.bot.value.lerp(FLITS_KLEUR, l * 0.9);
    scene.fog.color.lerp(FLITS_KLEUR, l * 0.6);
    if (ctx.wolken) for (const m of ctx.wolken) m.color.lerp(FLITS_KLEUR, l * 0.8);
  }
  function werkOnweerBij(dt) {
    const regent = weer === 'regen' && zwaar >= 1.5;
    if (!onweer.actief) {
      if (regent && Math.random() < ONWEER.kans * dt / 60) beginOnweer();
    } else {
      onweer.rest -= dt;
      if (!regent || onweer.rest <= 0) onweer.actief = false;
      else if ((onweer.volgende -= dt) <= 0) { bliksem(); onweer.volgende = tussen(ONWEER.tussen); }
    }
    // de donder die nog onderweg is
    for (let i = donders.length - 1; i >= 0; i--) {
      const d = donders[i];
      if ((d.t -= dt) > 0) continue;
      donders.splice(i, 1);
      onweer.donders++;
      if (api.opDonder) api.opDonder(d.afstand); else geluid.donder(d.afstand);
    }
    // de flits: elk beeld opnieuw over `pasToe`, en na afloop één keer terug
    if (flits) { flits.t += dt; if (flits.t > flits.duur) flits = null; }
    const s = flitsSterkte() * (geluid.binnen ? ONWEER.binnen : 1);
    if (s > 0 || flitsWas) {
      pasToe();
      if (s > 0) { flitsOver(s); onweer.flitsMax = Math.max(onweer.flitsMax, s); }
      flitsWas = s > 0;
    }
    onweer.flits = s;
  }

  // ---------- wind in het blad ----------
  // Een kleine verschuiving per hoekpunt in de vertex shader; kost niets en
  // haalt de dode stilte uit de bomen.
  const windUniform = { value: 0 };
  const sterkte = { value: 0.16 };
  /*
   Twee dingen die er later bij kwamen (25 sep 2026):
   - `waai` zette `onBeforeCompile` en gooide weg wat er al stond. De haag heeft
     sinds deze ronde omgevingsschaduw aan de voet (js/licht.js), en die zou dan
     verdwijnen. Nu wordt het vorige eerst uitgevoerd.
   - Bij een InstancedMesh (de kronen, het riet, het gras) nam de fase de plek van
     de mesh en niet van de boom: alle bomen in een tegel van 240 m zwaaiden in de
     maat. Nu de plek van de instantie.
  */
  function waai(m) {
    if (!m || m.userData.waait) return;
    m.userData.waait = true;
    const oud = m.onBeforeCompile;
    const oudeSleutel = m.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : () => '';
    m.onBeforeCompile = (sh, r) => {
      if (oud) oud(sh, r);
      sh.uniforms.uTijd = windUniform;
      sh.uniforms.uWind = sterkte;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTijd;\nuniform float uWind;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec3 wp = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          #else
            vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
          #endif
          float zwaai = sin(uTijd * 1.6 + wp.x * 0.25 + wp.z * 0.2) + 0.5 * sin(uTijd * 2.7 + wp.z * 0.4);
          transformed.x += zwaai * uWind * max(0.0, transformed.y * 0.35 + 0.25);
          transformed.z += zwaai * uWind * 0.6 * max(0.0, transformed.y * 0.35 + 0.25);`);
    };
    m.customProgramCacheKey = () => oudeSleutel() + '|waai';
    m.needsUpdate = true;
  }
  for (const m of mats.blad) waai(m);
  ctx.waai = waai;
  if (mats.hedge) waai(mats.hedge);

  // ---------- regen ----------
  const REGEN = 3500;
  const regenGeo = new THREE.BufferGeometry();
  {
    const pos = new Float32Array(REGEN * 6);   // lijnstukjes
    regenGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  }
  const regenMat = new THREE.LineBasicMaterial({ color: 0xbfd4e2, transparent: true, opacity: 0.42, fog: false });
  const regen = new THREE.LineSegments(regenGeo, regenMat);
  regen.frustumCulled = false; regen.visible = false;
  scene.add(regen);
  const druppels = [];
  for (let i = 0; i < REGEN; i++) {
    druppels.push({ x: (Math.random() - 0.5) * 70, y: Math.random() * 26, z: (Math.random() - 0.5) * 70, v: 22 + Math.random() * 14 });
  }

  /*
   ---------- straatverlichting ----------
   Een handvol lampen in een pool die naar de dichtstbijzijnde palen springen,
   zodat er nooit meer dan `POOL` echte lichtbronnen in de scène staan.

   Het waren er acht, en dat was de reden dat het spel 's avonds inzakte
   (melding beta-test 12 sep 2026). Gemeten op de proefopstelling: overdag 1702
   ms per beeld, 's nachts 4812 — bijna drie keer zo traag bij hetzelfde aantal
   draw calls en dezelfde driehoeken. Het zit dus niet in wat er getekend wordt
   maar in hoe duur elk beeldpunt wordt: elke puntlamp telt mee in de
   belichtingslus van élk materiaal, en de kaart moest er ook nog eens
   negentien extra shaderprogramma's voor vertalen (32 → 51).

   Drie lampen geven op straat hetzelfde beeld — je staat altijd in de plas van
   één paal met twee in de verte — voor ruim de helft minder rekenwerk.
  */
  const POOL = 3;
  const lichten = [];
  for (let i = 0; i < POOL; i++) {
    const l = new THREE.PointLight(0xffdca8, 0, 26, 1.8);
    l.visible = false;
    scene.add(l);
    lichten.push(l);
  }
  let lichtTeller = 0;

  /*
   Proberen de programma's van de avondstand vooraf te laten vertalen met
   `renderer.compile` hielp niet: de kaart maakte er zesendertig varianten bij
   die daarna niet eens gebruikt werden (32 → 68 programma's overdag), en het
   beeld werd er langzamer van in plaats van sneller. Wat wel werkt is gewoon
   minder lampen, zie POOL hierboven.
  */
  /*
   Het aantal zíchtbare lampen mag tijdens het spelen niet veranderen. Three
   bouwt de shader van elk materiaal om het aantal lichtbronnen heen: gaat er
   eentje aan of uit, dan wordt élk materiaal opnieuw vertaald. Dat kostte een
   hapering van tientallen milliseconden, en omdat de palen om de paar tellen
   in en uit de straal van vijfenveertig meter liepen gebeurde dat de hele tijd
   dat je 's nachts liep of reed (melding 25 sep 2026). Alle drie de lampen
   staan daarom 's nachts aan; een lamp die niets te verlichten heeft krijgt
   sterkte nul en wordt onder de grond geparkeerd. Dan verandert het aantal nog
   maar twee keer per etmaal: bij het invallen en bij het opkomen.
  */
  function zetLampen(camX, camZ, kracht) {
    /*
     De lampen komen in de scene zodra het begint te schemeren (kracht 0,45) maar
     met sterkte nul; ze lichten pas op naarmate het donkerder wordt. Zo valt het
     ene moment waarop het aantal lichtbronnen verandert — en three dus één keer
     alles opnieuw vertaalt — samen met een beeld waarin je niets ziet gebeuren.
     En het aangaan zelf is een overgang in plaats van een schakelaar.
    */
    const aan = kracht < 0.45;
    const sterkte = Math.max(0, Math.min(1, (0.45 - kracht) / 0.20));
    for (const l of lichten) if (l.visible !== aan) l.visible = aan;
    if (!aan) {
      for (const l of lichten) l.intensity = 0;
      return;
    }
    /*
     Na middernacht gaat een deel van de straatverlichting in de woonstraten uit
     (verzoek 25 sep 2026). Welke palen dat zijn staat in de kaartwereld
     (`nachtUit`); hoe ver het al is, zegt `lampenAan` hieronder. Het loopt
     geleidelijk van 1 naar 0, dus je ziet de straat langzaam donkerder worden
     in plaats van dat er een knop omgaat.
    */
    const f = lampFactor();
    const dichtbij = [];
    for (const p of lampPosities) {
      if (p.nachtUit && f < 0.04) continue;
      const d2 = (p.x - camX) ** 2 + (p.z - camZ) ** 2;
      if (d2 < 45 * 45) dichtbij.push({ p, d2 });
    }
    dichtbij.sort((a, b) => a.d2 - b.d2);
    for (let i = 0; i < POOL; i++) {
      const l = lichten[i];
      if (i < dichtbij.length) {
        const p = dichtbij[i].p;
        l.position.set(p.x, p.y, p.z);
        l.intensity = 11 * sterkte * (p.nachtUit ? f : 1);
      } else {
        // niets te verlichten: sterkte nul, en onder de grond zodat hij ook
        // niets kán raken. Zichtbaar blijft hij, zie de uitleg hierboven.
        l.position.set(camX, -60, camZ);
        l.intensity = 0;
      }
    }
  }

  // ---------- toepassen ----------
  const MIST_KLEUR = new THREE.Color(0xdfe3e5);
  function pasToe() {
    const k = meng(uur);
    const nacht = k.kracht < 0.35;
    const wolk = Math.min(1, zwaar);                  // 0 helder … 1 bewolkt of zwaarder
    const demping = W3(1, 0.62, 0.42);

    // zon: hoogte volgt de tijd, richting draait mee van oost naar west
    const hoek = (uur - 6) / 12 * Math.PI;                 // 0 bij zonsopgang, pi bij ondergang
    const hoogte = Math.max(-0.15, Math.sin(hoek));
    const richting = new THREE.Vector3(-Math.cos(hoek) * 0.75, Math.max(0.08, hoogte), 0.5).normalize();
    ctx.zonRichting.copy(richting);
    skyUniforms.sunDir.value.copy(richting);

    sun.color.copy(k.zon);
    sun.intensity = k.kracht * demping;
    sun.castShadow = k.kracht * demping > 0.25;
    hemi.intensity = Math.max(0.12, k.hemel * (1 + 0.15 * wolk));
    fill.intensity = 0.8 * k.hemel * (1 + 0.3 * wolk);

    const top = k.top.clone(), mid = k.mid.clone(), bot = k.bot.clone();
    if (zwaar > 0) {
      const grijs = new THREE.Color(0x8d959c).lerp(new THREE.Color(0x5d666e), Math.max(0, zwaar - 1));
      const f = W3(0, 0.5, 0.75);
      top.lerp(grijs, f); mid.lerp(grijs, f * 0.9); bot.lerp(grijs, f * 0.8);
    }
    // de ochtendmist (stap 124) kleurt ook de onderkant van de lucht: een witte waas aan de horizon
    const mist = ochtendMist(uur, weer);
    if (mist > 0) { bot.lerp(MIST_KLEUR, mist * 0.75); mid.lerp(MIST_KLEUR, mist * 0.35); }
    skyUniforms.top.value.copy(top);
    skyUniforms.mid.value.copy(mid);
    skyUniforms.bot.value.copy(bot);
    // sterren en maan (stap 124): hoe donkerder hoe meer, en achter de wolken bijna niets
    if (skyUniforms.nacht) {
      skyUniforms.nacht.value = Math.max(0, Math.min(1, (0.45 - k.kracht) / 0.35)) * W3(1, 0.2, 0);
      skyUniforms.maanDir.value.set(Math.cos(hoek) * 0.6, 0.42, -0.55).normalize();
    }
    /*
     Ochtendmist (stap 124): tussen half vijf en acht hangt er mist over de wijk en de weilanden,
     op zijn dikst van half zes tot tien voor zeven. De mist komt dichterbij en wordt witter; bij
     regen niet, dan is het zicht al slecht.
    */
    const m = mist;
    scene.fog.color.copy(bot).lerp(MIST_KLEUR, m * 0.85);
    scene.fog.near = W3(180, 180, 40) * (1 - m) + 6 * m;
    scene.fog.far = W3(900, 620, 320) * (1 - m) + 200 * m;
    /*
     Het achtervlak van de camera loopt met de mist mee. Het stond vast op 1200 m
     terwijl de mist bij helder weer al op 900 dicht is en bij regen op 320: alles
     daartussen werd wél getekend maar was niet te zien. In een wereld van vier
     kilometer scheelt dat een hoop; in de kleine wijk viel het niet op omdat de
     wereld daar toch al eerder ophield.
    */
    const wil = scene.fog.far + 60;
    if (Math.abs(camera.far - wil) > 1) { camera.far = wil; camera.updateProjectionMatrix(); }

    /*
     De gloed van de lampkoppen loopt mee met dezelfde schemerkromme als de
     lichtbronnen hierboven: van 0,15 overdag naar 2,4 als het echt donker is,
     in plaats van een schakelaar op één uur. De palen die na middernacht uitgaan
     hebben hun eigen materiaal, zodat ze los kunnen doven.
    */
    const donker = Math.max(0, Math.min(1, (0.45 - k.kracht) / 0.20));
    mats.lamp.emissiveIntensity = 0.15 + 2.25 * donker;
    if (mats.lampNacht) mats.lampNacht.emissiveIntensity = 0.15 + 2.25 * donker * lampFactor();

    // water: donkerder en doffer bij regen, spiegelend bij helder weer. De
    // kleur is die van het water zelf (donker groenblauw); het licht erop komt
    // uit de spiegeling van de lucht (zie MAT.water in js/world.js)
    mats.water.roughness = W3(0.07, 0.14, 0.32);
    mats.water.color.set(nacht ? 0x121c22 : weer === 'helder' ? 0x2f5560 : 0x3b4f56);

    /*
     De wolken. Ze waren MeshBasicMaterial in vast wit, dus 's nachts hing er
     een laag spierwitte wolken tegen een zwarte lucht (omgevingshots, 25 sep
     2026). Nu de kleur van het licht: overdag wit, bij zonsondergang met de
     kleur van de zon erin, 's nachts donkergrijs-blauw.
    */
    if (ctx.wolken) {
      const helder = Math.max(0.10, Math.min(1, k.kracht / 1.6));
      const kleur = new THREE.Color(1, 1, 1).lerp(k.zon, k.kracht < 1.6 ? 0.45 : 0.12).multiplyScalar(helder);
      if (wolk > 0) kleur.lerp(new THREE.Color(0.55, 0.58, 0.62).multiplyScalar(helder), 0.5 * wolk);
      for (const m of ctx.wolken) m.color.copy(kleur);
    }
    // hoe nacht het is, voor de verlichte ramen (js/licht.js)
    nachtUniform.value = Math.max(0, Math.min(1, (0.75 - k.kracht) / 0.55));
    // en welk deel van de ramen nog brandt: na middernacht gaan de meeste uit
    aandeelUniform.value = 0.48 * raamFactor();
    // de plassen licht onder de palen en de lampen van wat rijdt gaan mee
    // (met dezelfde schemerkromme als de koppen; de palen die na middernacht
    // uitgaan doven hun plas mee)
    zetLichtpoelen(donker, lampFactor());
    zetKoplampen(nachtUniform.value > 0.35);

    /*
     Nat wegdek. Asfalt en klinkers staan droog op ruwheid 0,95 en spiegelen dus
     niets; bij regen gaan ze naar 0,35 en dan vangen ze de lucht uit de
     environment map die er al is (js/main.js). Dat is de goedkoopste
     weersverandering die er is — één getal per materiaal, geen extra texture,
     geen extra tekenwerk — en het is meteen het duidelijkst te zien.

     Ze worden er ook een tikje donkerder van, want nat asfalt is donker asfalt.
     De kleur staat op de eigen tint van het materiaal, dus die wordt niet
     overschreven maar met een factor vermenigvuldigd: de oorspronkelijke kleur
     ligt in userData, zodat opdrogen weer bij het origineel uitkomt.
    */
    for (const m of mats.weg || []) {
      if (m.userData.droogRuw === undefined) {
        m.userData.droogRuw = m.roughness;
        m.userData.droogKleur = m.color.getHex();
      }
      const nat = weer === 'regen';
      m.roughness = nat ? Math.min(m.userData.droogRuw, 0.35) : m.userData.droogRuw;
      m.color.setHex(m.userData.droogKleur);
      if (nat) m.color.multiplyScalar(0.72);
      m.metalness = nat ? 0.12 : 0;
    }

    regen.visible = weer === 'regen';
    sterkte.value = W3(0.16, 0.22, 0.30);
    ctx.onWeer && ctx.onWeer(weer, nacht);
  }

  // ---------- per beeld ----------
  let lampKlok = 0;
  function update(dt, camX, camZ) {
    if (loopt) {
      const was = uur;
      uur = (uur + dt * (24 / (DAG_MINUTEN * 60))) % 24;     // een dag in 48 minuten (stap 125)
      if (autoWeer && Math.floor(uur) !== Math.floor(was)) dobbelWeer();
      pasToe();
    }
    // het weer schuift naar zijn doel (stap 126)
    if (zwaar !== zwaarDoel) {
      const stap = dt * 2 / WEER_OVERGANG;
      zwaar = zwaar < zwaarDoel ? Math.min(zwaarDoel, zwaar + stap) : Math.max(zwaarDoel, zwaar - stap);
      const naam = WEER[Math.round(zwaar)];
      if (naam !== weer) weer = naam;
      if (!loopt) pasToe();
    }
    windUniform.value += dt;
    tijdUniform.value = windUniform.value;       // de tv's achter de ramen
    // de wind draait langzaam en gaat met het weer mee (stap 131)
    windKlok += dt;
    wind.hoek = WIND.hoek + WIND.draai * Math.sin(windKlok / 600) + 0.2 * Math.sin(windKlok / 170);
    wind.x = Math.cos(wind.hoek); wind.z = Math.sin(wind.hoek);
    wind.kracht = Math.min(1, W3(...WIND.kracht) * (0.85 + 0.15 * Math.sin(windKlok * 0.7) * Math.sin(windKlok * 0.23)) + (onweer.actief ? 0.1 : 0));
    werkOnweerBij(dt);

    // water laten stromen: de rimpels (normal map) schuiven langzaam
    const golf = mats.water.normalMap || mats.water.map;
    if (golf) { golf.offset.x += dt * 0.010; golf.offset.y += dt * 0.017; }

    // regen valt en blijft rond de camera hangen
    if (regen.visible) {
      const pos = regenGeo.attributes.position.array;
      for (let i = 0; i < REGEN; i++) {
        const d = druppels[i];
        d.y -= d.v * dt;
        d.x += dt * 2.5;
        if (d.y < -2) { d.y = 24 + Math.random() * 6; d.x = (Math.random() - 0.5) * 70; d.z = (Math.random() - 0.5) * 70; }
        const k = i * 6;
        pos[k] = camX + d.x; pos[k + 1] = d.y; pos[k + 2] = camZ + d.z;
        pos[k + 3] = camX + d.x - 0.12; pos[k + 4] = d.y - 0.9; pos[k + 5] = camZ + d.z;
      }
      regenGeo.attributes.position.needsUpdate = true;
    }

    lampKlok += dt;
    if (lampKlok > 0.4) { lampKlok = 0; zetLampen(camX, camZ, meng(uur).kracht); }
  }

  // ---------- bediening ----------
  window.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    /*
     Met shift zijn [, ] en \ de missies 13, 14 en 15 (js/main.js). Zonder deze regel
     schoof shift+] de klok ook een uur op, en zette shift+\ hem aan het lopen: in
     missie 15 werd het dan midden in de nacht licht (melding 28 sep 2026).
    */
    if (e.shiftKey && (e.code === 'BracketLeft' || e.code === 'BracketRight' || e.code === 'Backslash')) return;
    if (e.code === 'KeyY') {
      weer = WEER[(WEER.indexOf(weer) + 1) % WEER.length];
      zwaar = zwaarDoel = WEER.indexOf(weer);
      pasToe(); hud.show(`Weer: ${weer}`, 2);
    } else if (e.code === 'BracketRight') {
      uur = (uur + 1) % 24; pasToe(); hud.show(`${String(Math.floor(uur)).padStart(2, '0')}:${String(Math.floor(uur % 1 * 60)).padStart(2, '0')} uur`, 2);
    } else if (e.code === 'BracketLeft') {
      uur = (uur + 23) % 24; pasToe(); hud.show(`${String(Math.floor(uur)).padStart(2, '0')}:${String(Math.floor(uur % 1 * 60)).padStart(2, '0')} uur`, 2);
    } else if (e.code === 'Backslash') {
      // (dit is nu de voorkeur zelf, net als in de instellingen; tijdens een missie zet het verhaal hem stil)
      zetVoorkeur(!voorkeur); hud.show(voorkeur ? `Dag en nacht lopen mee (een dag in ${DAG_MINUTEN} minuten)` : 'Klok stil', 2.5);
    }
  });

  /*
   ---------- hoe laat het is, en wat dat betekent ----------
   Twee krommen die de rest van het spel gebruikt, allebei met een zachte
   overgang (`soepel`) zodat er nergens een schakelaar omgaat.

   `drukte`   hoeveel verkeer en voetgangers de wijk om je heen wil hebben.
              Overdag vol; tussen half elf en half twaalf zakt het weg naar een
              zesde, en tussen vijf en half zeven 's ochtends komt het terug
              (verzoek 25 sep 2026).
   `lampenAan` hoeveel van de straatverlichting in de woonstraten nog brandt.
              Tot middernacht alles; in het uur daarna gaat het naar een derde,
              en tegen zessen staat alles weer aan.
  */
  const soepel = (a, b, x) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  function drukteFactor() {
    if (uur >= 6.5 && uur < 22.5) return 1;
    if (uur >= 22.5) return 1 - 0.84 * soepel(22.5, 23.5, uur);
    if (uur < 5) return 0.16;
    return 0.16 + 0.84 * soepel(5, 6.5, uur);
  }
  /*
   De ramen (verzoek 26 sep 2026: "vanaf 24:00 minder lampen aan in de woningen,
   dat meer mensen slapen"). Tot elf uur brandt bijna de helft, tussen elf en één
   gaat driekwart daarvan uit, tot vijf uur blijft het een kwart, en tussen vijf
   en zeven gaan ze weer aan voor wie vroeg op moet.
  */
  function raamFactor() {
    if (uur >= 7 && uur < 23) return 1;
    if (uur >= 23) return 1 - 0.75 * soepel(23, 25, uur);
    if (uur < 1) return 1 - 0.75 * soepel(23, 25, uur + 24);
    if (uur < 5) return 0.25;
    return 0.25 + 0.75 * soepel(5, 7, uur);
  }
  function lampFactor() {
    if (uur >= 6) return 1;                       // vóór middernacht brandt alles
    if (uur < 1) return 1 - 0.68 * soepel(0, 1, uur);
    if (uur < 5) return 0.32;
    return 0.32 + 0.68 * soepel(5, 6, uur);
  }

  pasToe();
  const api = {
    update, pasToe,
    get drukte() { return drukteFactor(); },
    get lampenAan() { return lampFactor(); },
    get ramenAan() { return raamFactor(); },
    get uur() { return uur; }, set uur(v) { uur = v % 24; pasToe(); },
    get mist() { return ochtendMist(uur, weer); },
    get weer() { return weer; }, set weer(v) { if (WEER.includes(v)) { weer = v; zwaar = zwaarDoel = WEER.indexOf(v); pasToe(); } },
    // wisselend weer (stap 126): aan of uit (bewaard in de browser), het weer als getal, en het doel
    get autoWeer() { return autoWeer; },
    set autoWeer(v) { autoWeer = !!v; try { localStorage.setItem('tinga.weer', autoWeer ? 'wisselt' : 'vast'); } catch { /* alleen voor nu */ } },
    get weerZwaar() { return zwaar; }, get weerDoel() { return zwaarDoel; },
    dobbelWeer, naarWeer(naam) { if (WEER.includes(naam)) zwaarDoel = WEER.indexOf(naam); },
    get nacht() { return meng(uur).kracht < 0.35; },
    get loopt() { return loopt; }, set loopt(v) { loopt = v; },
    // de keuze van de speler: loopt de klok mee als er geen missie is (stap 125)
    get voorkeur() { return voorkeur; }, zetVoorkeur,
    // de schakelaar onder T: naar de volgende stand (ochtend → middag → avond → nacht → ochtend)
    volgendeTijd() {
      const i = TIJDEN.findIndex(t => t.naam === tijdNaam(uur));
      const t = TIJDEN[(i + 1) % TIJDEN.length];
      uur = t.uur; pasToe();
      return t;
    },
    zetTijd(naam) { const t = TIJDEN.find(q => q.naam === naam); if (t) { uur = t.uur; pasToe(); } return t || null; },
    get tijdNaam() { return tijdNaam(uur); },
    // de wind (stap 131): { x, z } waar hij naartoe waait, `kracht` 0…1, `hoek`; één object, elk beeld bijgewerkt
    get wind() { return wind; },
    /*
     Onweer (stap 131). `onweer` is de stand voor een proef (actief, rest, bliksems, donders, buien, flits, flitsMax,
     laatste); `bliksems` de teller. `opDonder` (afstand in meter) vervangt het geluid: zonder roept sfeer zelf
     `geluid.donder` aan. `forceerOnweer` zet het voor een proef meteen op regen met een bui die begint, de eerste
     bliksem na `flitsNa` tellen.
    */
    get onweer() { return onweer; },
    get bliksems() { return onweer.bliksems; },
    opDonder: null,
    forceerOnweer({ flitsNa = 0.2 } = {}) {
      if (weer !== 'regen') { weer = 'regen'; zwaar = zwaarDoel = 2; pasToe(); }
      beginOnweer(flitsNa);
      return onweer;
    },
  };
  return api;
  function zetVoorkeur(v) {
    voorkeur = !!v; loopt = voorkeur;
    try { localStorage.setItem(VOORKEUR, voorkeur ? 'loopt' : 'stil'); } catch { /* geen opslag: alleen voor nu */ }
  }
}
