/*
 Licht: omgevingsschaduw aan de voet van een muur (verzoek 24 sep 2026).

 Waar een gevel de stoep raakt is het in het echt donkerder: het licht uit de
 lucht komt daar maar van één kant, want de grond en de muur houden de rest
 tegen. Zonder dat staat een huis er als een doos die net op de tegels is
 gezet. Echte ambient occlusion over het hele beeld (SSAO) vraagt een tweede
 renderpas en een bibliotheek die niet in lib/three.module.js zit; dit is de
 goedkope variant die het meeste doet: het indirecte licht (lucht en
 omgeving) op een muur loopt onder `TOT` meter boven de grond af naar `MIN`.
 Het directe zonlicht blijft zoals het is — daar zorgt de schaduwkaart voor.

 Het gaat per materiaal via `onBeforeCompile`, met een eigen sleutel voor de
 shadercache, zodat alle muren één programma delen.
*/

export const GROND_AO = { VAN: 0.12, TOT: 1.1, MIN: 0.55 };

export function grondAO(mat) {
  if (!mat || mat.userData.grondAO) return mat;
  mat.userData.grondAO = true;
  const vorige = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    if (vorige) vorige(shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vAoY;')
      .replace('#include <project_vertex>', `#include <project_vertex>
  vec4 aoW = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    aoW = instanceMatrix * aoW;
  #endif
  vAoY = ( modelMatrix * aoW ).y;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vAoY;')
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
  float aoGrond = mix( ${GROND_AO.MIN.toFixed(3)}, 1.0, smoothstep( ${GROND_AO.VAN.toFixed(3)}, ${GROND_AO.TOT.toFixed(3)}, vAoY ) );
  reflectedLight.indirectDiffuse *= aoGrond;
  reflectedLight.indirectSpecular *= aoGrond;`);
  };
  const sleutel = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : null;
  mat.customProgramCacheKey = () => `${sleutel ? sleutel() : ''}|grondAO`;
  mat.needsUpdate = true;
  return mat;
}

/*
 Verlichte ramen 's avonds (ronde van 25 sep 2026). Om elf uur 's avonds was
 de hele wijk donker: gevels van zwart glas onder een zwarte lucht. In een
 echte woonwijk brandt achter de helft van de ramen licht.

 Zonder extra doek: de gevels zijn samen al het grootste deel van het
 texturegeheugen, en een lichtkaart per gevel zou dat verdubbelen. De shader
 herkent het glas aan de kleur van het doek zelf — blauwgrijs en donker, anders
 dan baksteen (warm), pleister (grijs) of een blauw kozijn (verzadigd) — en
 verdeelt de gevel in vakken: per woning twee ramen breed en per verdieping één
 hoog. Per vak een vaste kans dat het licht aan is en een eigen tint, dus het
 is elke avond hetzelfde raam dat brandt.

   nachtUniform  0 overdag, 1 's nachts; js/sfeer.js zet hem
   vakken        [breed, hoog] in vakken over de hele uv (huizen × 2, lagen)
*/
export const nachtUniform = { value: 0 };

export function nachtRamen(mat, vakken = [2, 2]) {
  if (!mat || mat.userData.nachtRamen) return mat;
  mat.userData.nachtRamen = true;
  const vorige = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    if (vorige) vorige(shader, renderer);
    shader.uniforms.uNacht = nachtUniform;
    shader.uniforms.uVakken = { value: new Float32Array(vakken) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRaamW;\nattribute float wandId;\nvarying float vWand;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vRaamW = (modelMatrix * vec4(transformed, 1.0)).xyz;\n  vWand = wandId;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNacht;\nuniform vec2 uVakken;\nvarying vec3 vRaamW;\nvarying float vWand;\nfloat raamRuis(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  #ifdef USE_MAP
  if (uNacht > 0.0) {
    vec3 c = diffuseColor.rgb;
    float lum = dot(c, vec3(0.3, 0.55, 0.15));
    // glas: blauwer dan rood, niet verzadigd (groen dicht bij blauw), en donker
    float glas = step(0.012, c.b - c.r) * step(c.b * 0.62, c.g) * step(lum, 0.40);
    // het vak op de gevel, plus het nummer van het muurvlak (elke woning in een
    // rij is een eigen vlak met dezelfde vakken), plus voor een dakkapel (één
    // vak) de plek in de wereld
    // (het nummer eerst afronden: de ruisfunctie vergroot het kleinste verschil
    // uit de interpolatie tot een ander getal, en dan wordt het ruis per pixel)
    float wand = floor(vWand * 997.0 + 0.5);
    vec2 vak = floor(vMapUv * uVakken) + vec2(wand, floor(wand * 0.37)) + floor(vRaamW.xz / 3.0) * step(uVakken.x, 1.5);
    float aan = step(raamRuis(vak), 0.50);
    float tint = raamRuis(vak + 17.31);
    // warm en gedempt: te sterk en de tonemapping maakt er wit van
    vec3 licht = mix(vec3(1.0, 0.58, 0.26), vec3(1.0, 0.74, 0.45), tint) * (0.45 + 0.4 * raamRuis(vak + 3.7));
    totalEmissiveRadiance += licht * glas * aan * uNacht * 0.85;
  }
  #endif`);
  };
  const sleutel = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : null;
  mat.customProgramCacheKey = () => `${sleutel ? sleutel() : ''}|nachtRamen`;
  mat.needsUpdate = true;
  return mat;
}
