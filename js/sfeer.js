// Sfeer: tijd van de dag, weer, wind in de bomen, stromend water en
// straatverlichting die 's avonds echt aangaat.
//
// De tijd loopt van 0 tot 24 uur. Zonnestand, luchtkleuren, mist en de
// sterkte van het licht volgen daaruit. Met T zet je de klok een paar uur
// vooruit, met Y wissel je van weertype.
import * as THREE from 'three';
import { sfeerMaterialen, lampPosities } from './world.js';
import { nachtUniform, tijdUniform } from './licht.js';
import { zetKoplampen } from './carmodel.js';
import { zetLichtpoelen } from './kaartwereld.js';

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

export function initSfeer(ctx) {
  const { scene, camera, renderer, sun, hemi, fill, skyUniforms, hud } = ctx;
  const mats = sfeerMaterialen();

  let uur = 13.5;          // begint op een heldere middag
  let weer = 'helder';
  let loopt = false;       // klok laten doorlopen
  const wind = { value: 0 };

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
  function pasToe() {
    const k = meng(uur);
    const nacht = k.kracht < 0.35;
    const bewolkt = weer !== 'helder';
    const demping = weer === 'regen' ? 0.42 : weer === 'bewolkt' ? 0.62 : 1;

    // zon: hoogte volgt de tijd, richting draait mee van oost naar west
    const hoek = (uur - 6) / 12 * Math.PI;                 // 0 bij zonsopgang, pi bij ondergang
    const hoogte = Math.max(-0.15, Math.sin(hoek));
    const richting = new THREE.Vector3(-Math.cos(hoek) * 0.75, Math.max(0.08, hoogte), 0.5).normalize();
    ctx.zonRichting.copy(richting);
    skyUniforms.sunDir.value.copy(richting);

    sun.color.copy(k.zon);
    sun.intensity = k.kracht * demping;
    sun.castShadow = k.kracht * demping > 0.25;
    hemi.intensity = Math.max(0.12, k.hemel * (bewolkt ? 1.15 : 1));
    fill.intensity = 0.8 * k.hemel * (bewolkt ? 1.3 : 1);

    const top = k.top.clone(), mid = k.mid.clone(), bot = k.bot.clone();
    if (bewolkt) {
      const grijs = new THREE.Color(weer === 'regen' ? 0x5d666e : 0x8d959c);
      const f = weer === 'regen' ? 0.75 : 0.5;
      top.lerp(grijs, f); mid.lerp(grijs, f * 0.9); bot.lerp(grijs, f * 0.8);
    }
    skyUniforms.top.value.copy(top);
    skyUniforms.mid.value.copy(mid);
    skyUniforms.bot.value.copy(bot);
    scene.fog.color.copy(bot);
    scene.fog.near = weer === 'regen' ? 40 : 180;
    scene.fog.far = weer === 'regen' ? 320 : weer === 'bewolkt' ? 620 : 900;
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
    mats.water.roughness = weer === 'regen' ? 0.32 : weer === 'bewolkt' ? 0.14 : 0.07;
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
      if (bewolkt) kleur.lerp(new THREE.Color(0.55, 0.58, 0.62).multiplyScalar(helder), 0.5);
      for (const m of ctx.wolken) m.color.copy(kleur);
    }
    // hoe nacht het is, voor de verlichte ramen (js/licht.js)
    nachtUniform.value = Math.max(0, Math.min(1, (0.75 - k.kracht) / 0.55));
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
    sterkte.value = weer === 'regen' ? 0.30 : weer === 'bewolkt' ? 0.22 : 0.16;
    ctx.onWeer && ctx.onWeer(weer, nacht);
  }

  // ---------- per beeld ----------
  let lampKlok = 0;
  function update(dt, camX, camZ) {
    if (loopt) { uur = (uur + dt * (24 / 240)) % 24; pasToe(); }   // een dag in vier minuten
    windUniform.value += dt;
    tijdUniform.value = windUniform.value;       // de tv's achter de ramen

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
    if (e.code === 'KeyY') {
      weer = WEER[(WEER.indexOf(weer) + 1) % WEER.length];
      pasToe(); hud.show(`Weer: ${weer}`, 2);
    } else if (e.code === 'BracketRight') {
      uur = (uur + 1) % 24; pasToe(); hud.show(`${String(Math.floor(uur)).padStart(2, '0')}:${String(Math.floor(uur % 1 * 60)).padStart(2, '0')} uur`, 2);
    } else if (e.code === 'BracketLeft') {
      uur = (uur + 23) % 24; pasToe(); hud.show(`${String(Math.floor(uur)).padStart(2, '0')}:${String(Math.floor(uur % 1 * 60)).padStart(2, '0')} uur`, 2);
    } else if (e.code === 'Backslash') {
      loopt = !loopt; hud.show(loopt ? 'Klok loopt (een dag in vier minuten)' : 'Klok stil', 2.5);
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
  function lampFactor() {
    if (uur >= 6) return 1;                       // vóór middernacht brandt alles
    if (uur < 1) return 1 - 0.68 * soepel(0, 1, uur);
    if (uur < 5) return 0.32;
    return 0.32 + 0.68 * soepel(5, 6, uur);
  }

  pasToe();
  return {
    update, pasToe,
    get drukte() { return drukteFactor(); },
    get lampenAan() { return lampFactor(); },
    get uur() { return uur; }, set uur(v) { uur = v % 24; pasToe(); },
    get weer() { return weer; }, set weer(v) { if (WEER.includes(v)) { weer = v; pasToe(); } },
    get nacht() { return meng(uur).kracht < 0.35; },
    get loopt() { return loopt; }, set loopt(v) { loopt = v; },
  };
}
