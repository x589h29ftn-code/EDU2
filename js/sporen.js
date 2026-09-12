/*
 Remsporen op het wegdek.

 Een auto die op de rem gaat of dwars door een bocht glijdt laat rubber achter.
 Zonder dat voelt hard remmen als niets: het beeld verandert niet en de auto
 staat gewoon stil. Met sporen zie je achteraf waar je vandaan komt, en dat is
 precies wat een aanrijding of een achtervolging spannend maakt om terug te
 kijken.

 Hoe het werkt. Honderdtwintig vierhoekjes in één buffer, die als een ringbuffer
 hergebruikt worden: er komt nooit geometrie bij, er wordt alleen in bestaande
 hoekpunten geschreven. Dat kost één draw call voor alle sporen bij elkaar, ook
 als je de halve wijk hebt rondgeslipt. Oude sporen vervagen door hun hoekkleur
 naar nul te laten lopen; het materiaal is doorzichtig en schrijft niet in de
 dieptebuffer, zodat ze plat op de weg blijven liggen.

 Het spoor komt op y = 0,02 boven het wegdek. Lager verdwijnt het in de weg
 (z-fighting), hoger zie je hem van opzij zweven.
*/
import * as THREE from 'three';

const MAX = 120;            // vierhoekjes in de ring
const LEEFTIJD = 14;        // seconden tot een spoor helemaal weg is
const HOOGTE = 0.02;

let mesh = null, pos = null, kleur = null;
let beurt = 0;
const leeft = new Float32Array(MAX);      // resterende tijd per vierhoek

export function bouwSporen(scene) {
  if (mesh) return mesh;
  const g = new THREE.BufferGeometry();
  pos = new Float32Array(MAX * 6 * 3);    // twee driehoeken per vierhoek
  kleur = new Float32Array(MAX * 6);      // één waarde per hoekpunt: hoe donker
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('vervaag', new THREE.BufferAttribute(kleur, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    vertexShader: `
      attribute float vervaag;
      varying float vV;
      void main() {
        vV = vervaag;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying float vV;
      void main() {
        if (vV <= 0.001) discard;
        gl_FragColor = vec4(0.06, 0.055, 0.05, vV * 0.72);
      }`,
  });
  mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;             // de sporen liggen door de hele wijk
  mesh.renderOrder = 2;
  scene.add(mesh);
  return mesh;
}

/*
 Eén stukje spoor neerleggen: een vierhoek van `lengte` bij `breed` meter, met
 zijn hart op (x, z) en zijn lengte langs `yaw`. `kracht` (0..1) bepaalt hoe
 donker hij begint.
*/
export function zetSpoor(x, z, yaw, breed = 0.22, lengte = 0.9, kracht = 1) {
  if (!mesh) return;
  const i = beurt % MAX; beurt++;
  leeft[i] = LEEFTIJD;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  // langs de rijrichting en er dwars op
  const lx = s * lengte / 2, lz = c * lengte / 2;
  const bx = c * breed / 2, bz = -s * breed / 2;
  const hoeken = [
    [x - lx - bx, z - lz - bz], [x + lx - bx, z + lz - bz], [x + lx + bx, z + lz + bz],
    [x - lx - bx, z - lz - bz], [x + lx + bx, z + lz + bz], [x - lx + bx, z - lz + bz],
  ];
  const k = Math.max(0, Math.min(1, kracht));
  for (let j = 0; j < 6; j++) {
    const o = (i * 6 + j) * 3;
    pos[o] = hoeken[j][0]; pos[o + 1] = HOOGTE; pos[o + 2] = hoeken[j][1];
    kleur[i * 6 + j] = k;
  }
  mesh.geometry.attributes.position.needsUpdate = true;
  mesh.geometry.attributes.vervaag.needsUpdate = true;
}

// De sporen laten vervagen. js/main.js roept dit elk beeld aan.
export function werkSporenBij(dt) {
  if (!mesh) return;
  let veranderd = false;
  for (let i = 0; i < MAX; i++) {
    if (leeft[i] <= 0) continue;
    leeft[i] -= dt;
    const v = Math.max(0, leeft[i] / LEEFTIJD);
    for (let j = 0; j < 6; j++) {
      const idx = i * 6 + j;
      // de beginkracht zit al in de waarde; alleen naar beneden schalen
      kleur[idx] = Math.min(kleur[idx], v);
    }
    veranderd = true;
  }
  if (veranderd) mesh.geometry.attributes.vervaag.needsUpdate = true;
}

// waar ligt het laatst neergelegde spoor? Voor tools/gevoelshots.mjs, zodat de
// camera het beeld ook echt op de sporen richt.
export function laatsteSpoor() {
  if (!mesh || !beurt) return null;
  const i = (beurt - 1) % MAX;
  const o = i * 6 * 3;
  return { x: pos[o], z: pos[o + 2] };
}

// voor de proef: hoeveel sporen liggen er nu?
export function sporenTeller() {
  let n = 0;
  for (let i = 0; i < MAX; i++) if (leeft[i] > 0) n++;
  return n;
}
