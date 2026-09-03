// Sfeer: tijd van de dag, weer, wind in de bomen, stromend water en
// straatverlichting die 's avonds echt aangaat.
//
// De tijd loopt van 0 tot 24 uur. Zonnestand, luchtkleuren, mist en de
// sterkte van het licht volgen daaruit. Met T zet je de klok een paar uur
// vooruit, met Y wissel je van weertype.
import * as THREE from 'three';
import { sfeerMaterialen, lampPosities } from './world.js';

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
  function waai(m) {
    if (!m || m.userData.waait) return;
    m.userData.waait = true;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTijd = windUniform;
      sh.uniforms.uWind = sterkte;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTijd;\nuniform float uWind;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
          float zwaai = sin(uTijd * 1.6 + wp.x * 0.25 + wp.z * 0.2) + 0.5 * sin(uTijd * 2.7 + wp.z * 0.4);
          transformed.x += zwaai * uWind * max(0.0, transformed.y * 0.35 + 0.25);
          transformed.z += zwaai * uWind * 0.6 * max(0.0, transformed.y * 0.35 + 0.25);`);
    };
    m.needsUpdate = true;
  }
  for (const m of mats.blad) waai(m);
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

  // ---------- straatverlichting ----------
  // Acht lampen in een pool: die springen naar de dichtstbijzijnde palen, zodat
  // je nooit meer dan acht echte lichtbronnen hebt.
  const POOL = 8;
  const lichten = [];
  for (let i = 0; i < POOL; i++) {
    const l = new THREE.PointLight(0xffdca8, 0, 26, 1.8);
    l.visible = false;
    scene.add(l);
    lichten.push(l);
  }
  let lichtTeller = 0;

  function zetLampen(camX, camZ, aan) {
    if (!aan) {
      for (const l of lichten) if (l.visible) { l.visible = false; l.intensity = 0; }
      return;
    }
    // dichtstbijzijnde palen zoeken, niet elk beeld
    const dichtbij = [];
    for (const p of lampPosities) {
      const d2 = (p.x - camX) ** 2 + (p.z - camZ) ** 2;
      if (d2 < 45 * 45) dichtbij.push({ p, d2 });
    }
    dichtbij.sort((a, b) => a.d2 - b.d2);
    for (let i = 0; i < POOL; i++) {
      const l = lichten[i];
      if (i < dichtbij.length) {
        l.position.set(dichtbij[i].p.x, dichtbij[i].p.y, dichtbij[i].p.z);
        l.visible = true; l.intensity = 9;
      } else { l.visible = false; l.intensity = 0; }
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

    // lampen gloeien alleen als het donker is
    mats.lamp.emissiveIntensity = nacht ? 2.4 : 0.15;

    // water: donkerder en doffer bij regen, spiegelend bij helder weer
    mats.water.roughness = weer === 'regen' ? 0.55 : 0.25;
    mats.water.color.set(nacht ? 0x40525e : weer === 'helder' ? 0xa8cfd6 : 0x8fa4ad);

    regen.visible = weer === 'regen';
    sterkte.value = weer === 'regen' ? 0.30 : weer === 'bewolkt' ? 0.22 : 0.16;
    ctx.onWeer && ctx.onWeer(weer, nacht);
  }

  // ---------- per beeld ----------
  let lampKlok = 0;
  function update(dt, camX, camZ) {
    if (loopt) { uur = (uur + dt * (24 / 240)) % 24; pasToe(); }   // een dag in vier minuten
    windUniform.value += dt;

    // water laten stromen
    if (mats.water.map) { mats.water.map.offset.x += dt * 0.012; mats.water.map.offset.y += dt * 0.02; }

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
    if (lampKlok > 0.4) { lampKlok = 0; zetLampen(camX, camZ, meng(uur).kracht < 0.35); }
  }

  // ---------- bediening ----------
  window.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'KeyY') {
      weer = WEER[(WEER.indexOf(weer) + 1) % WEER.length];
      pasToe(); hud.show(`Weer: ${weer}`, 2);
    } else if (e.code === 'BracketRight' && !window.__game?.editor?.actief) {
      uur = (uur + 1) % 24; pasToe(); hud.show(`${String(Math.floor(uur)).padStart(2, '0')}:${String(Math.floor(uur % 1 * 60)).padStart(2, '0')} uur`, 2);
    } else if (e.code === 'BracketLeft' && !window.__game?.editor?.actief) {
      uur = (uur + 23) % 24; pasToe(); hud.show(`${String(Math.floor(uur)).padStart(2, '0')}:${String(Math.floor(uur % 1 * 60)).padStart(2, '0')} uur`, 2);
    } else if (e.code === 'Backslash') {
      loopt = !loopt; hud.show(loopt ? 'Klok loopt (een dag in vier minuten)' : 'Klok stil', 2.5);
    }
  });

  pasToe();
  return {
    update, pasToe,
    get uur() { return uur; }, set uur(v) { uur = v % 24; pasToe(); },
    get weer() { return weer; }, set weer(v) { if (WEER.includes(v)) { weer = v; pasToe(); } },
    get nacht() { return meng(uur).kracht < 0.35; },
    get loopt() { return loopt; }, set loopt(v) { loopt = v; },
  };
}
