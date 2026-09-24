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
