// Tinga Sneek – open-wereld FPS in de wijk Tinga.
import * as THREE from 'three';
import { buildWorld, buildWorldStap, nearestRoadName, colliders, updateLOD, updateProps, radioPlekken, vaarbaar, waaitMee } from './world.js';
import { maakGrasVeld } from './groen.js';
import { Player, WAPEN_LAAG } from './player.js';
import { Vehicles } from './vehicles.js';
import { NPCs } from './npc.js';
import { HUD } from './hud.js';
import { isTouchDevice, initTouchControls } from './touch.js';
import { START, toWorld, ROWS, PROPS } from './data.js';
import { initSfeer } from './sfeer.js';
import { initVerhaal, verhaalStart } from './verhaal.js';
import { initInterieur, WONINGEN } from './interieur.js';
import { initBoerderij } from './boerderij.js';
import { initSpuiterij } from './spuiterij.js';
import { initBoten } from './boot.js';
import { initSupermarkt } from './supermarkt.js';
import { initDerdePersoon } from './derdepersoon.js';
import { initPolitie } from './politie.js';
import { initPolitieboot } from './politieboot.js';
import { initVaart } from './vaart.js';
import { bewaarSpel, laadSpel, opslagInfo } from './opslag.js';
import { geluid } from './audio.js';
import { zetKaart, zetStand, startKaart, KAART, raakLantaarn, werkLantaarnsBij, lantaarnsOm, vlakOp } from './kaartwereld.js';
import { KLEUR } from './kaartkleuren.js';
import { zetAnisotropie, reliëfStappen, zetUitstel, bordSpannenburg, logoTinga, wapenIcoon, inslagPluim, bloedSpatDoek, bloedPlasDoek } from './textures.js';
import { bouwSporen, zetSpoor, werkSporenBij, sporenTeller } from './sporen.js';
import { grondHoogte } from './viaduct.js';
import { maakBuit, zakgeld, agentMunitie } from './buit.js';
import * as menu from './menu.js';
import * as intro from './intro.js';
import * as uitleg from './uitleg.js';
import { maakPandWijzer, pandRegel } from './pandwijzer.js';

const canvas = document.getElementById('game');
const IS_TOUCH = isTouchDevice();
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !IS_TOUCH, powerPreference: 'high-performance' });
/*
 Scherpte (G wisselt ertussen).

 MSAA staat op de pc al aan, maar dat helpt alleen tegen gekartelde randen van
 driehoeken. Wat je in deze wijk vooral ziet flikkeren zijn dunne dingen op
 afstand — spijlen van hekken, dakranden, belijning — en daar is maar één echt
 middel tegen: op meer beeldpunten renderen dan het scherm heeft en de browser
 het laten verkleinen. Op een gewoon 1×-scherm stond de teller op precies 1,00
 en gebeurde er dus niets; 'scherp' rendert nu op anderhalf keer zoveel.

 Op een telefoon is dat natuurlijk geen goed idee: die heeft al een hoge
 pixeldichtheid en weinig vulkracht. Daar is 'normaal' het maximum, en 'zuinig'
 rendert onder de schermresolutie voor wie het te traag vindt.
*/
const SCHERPTE = { zuinig: 0.75, normaal: 1.0, scherp: 1.5 };
const SCHERPTE_RIJ = ['zuinig', 'normaal', 'scherp'];
function pixelVerhouding(niveau) {
  const basis = Math.min(window.devicePixelRatio || 1, IS_TOUCH ? 1 : 1.5);
  return Math.min(2, basis * (SCHERPTE[niveau] || 1));
}
let scherpte = localStorage.getItem('tinga.scherpte');
// De proefgereedschappen draaien in een headless browser op een softwarekaart;
// daar is anderhalf keer zoveel beeldpunten alleen maar wachten.
const HEADLESS = typeof navigator !== 'undefined' && navigator.webdriver === true;
if (!SCHERPTE[scherpte]) scherpte = (IS_TOUCH || HEADLESS) ? 'normaal' : 'scherp';
renderer.setPixelRatio(pixelVerhouding(scherpte));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// de schaduwkaart om het beeld bijwerken in plaats van elk beeld; zie de
// hoofdlus onderaan dit bestand
renderer.shadowMap.autoUpdate = false;
let schaduwBeeld = 0;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.outputColorSpace = THREE.SRGBColorSpace;
// asfalt en stoeptegels die schuin weglopen blijven scherp in plaats van grijs
zetAnisotropie(renderer.capabilities.getMaxAnisotropy());

const scene = new THREE.Scene();
scene.background = null;
scene.fog = new THREE.Fog(0xc3d9ec, 180, 900);

/*
 Het voorvlak op 15 cm in plaats van 5. De diepte-nauwkeurigheid schaalt met het
 voorvlak: bij 5 cm konden twee grondlagen met 2 mm ertussen (klinkers op het
 plateau, belijning op het veld) vanaf 41 m niet meer uit elkaar worden
 gehouden en flikkerden ze; bij 15 cm is dat drie keer zo ver. Dichterbij dan
 15 cm komt de wereld niet: je botsstraal is 35 cm. Alleen het wapen in je hand
 zit dichterbij, en dat wordt apart getekend (`tekenWapen` hieronder).
*/
const CAMERA_NEAR = 0.15;
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, CAMERA_NEAR, 1200);
scene.add(camera);

// ---------- Lucht met zonneschijf en horizonwaas ----------
// De sfeermodule draait deze vector met de tijd van de dag mee.
const SUN_DIR = new THREE.Vector3(0.42, 0.62, 0.66).normalize();
const skyUniforms = {
  top: { value: new THREE.Color(0x2f6fc4) },
  mid: { value: new THREE.Color(0x8fbde6) },
  bot: { value: new THREE.Color(0xdae8f2) },
  sunDir: { value: SUN_DIR },
};
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyUniforms,
  vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform vec3 top, mid, bot, sunDir;
    varying vec3 vP;
    void main(){
      vec3 dir = normalize(vP);
      float h = dir.y;
      vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.55)) : mix(mid, bot, clamp(-h * 5.0, 0.0, 1.0));
      // waas rond de horizon
      c = mix(c, bot, pow(1.0 - abs(h), 12.0) * 0.7);
      // zonneschijf met halo
      float d = max(dot(dir, normalize(sunDir)), 0.0);
      c += vec3(1.0, 0.95, 0.84) * pow(d, 7000.0) * 2.6;
      c += vec3(1.0, 0.92, 0.76) * pow(d, 22.0) * 0.16;
      gl_FragColor = vec4(c, 1.0);
    }`,
});
/*
 De luchtbol heeft straal 1 en wordt met de camera meegeschaald tot net binnen
 het achtervlak (js/sfeer.js zet dat op de mistafstand + 60 m). Hij stond op een
 vaste straal van 1000 m; toen het achtervlak met de mist mee omlaag ging naar
 960 m viel de achterkant van de bol erbuiten en keek je door dat gat tegen de
 zwarte achtergrond aan.
*/
const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), skyMat);
sky.frustumCulled = false;
scene.add(sky);
sky.scale.setScalar(camera.far * 0.92);

// ---------- Wolkendek ----------
// Zachte cumulusvlekken op twee hoogtes. Ze liggen horizontaal, want vanaf de
// grond zie je de onderkant; dat scheelt billboarden en houdt het op twee calls.
function cloudTexture(seed, wisps) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  let s2 = seed >>> 0 || 1;
  const rnd = () => { s2 = (s2 * 1664525 + 1013904223) >>> 0; return s2 / 4294967296; };
  g.clearRect(0, 0, 256, 256);
  const puffs = wisps ? 14 : 26;
  for (let i = 0; i < puffs; i++) {
    const x = 128 + (rnd() - 0.5) * (wisps ? 210 : 150);
    const y = 128 + (rnd() - 0.5) * (wisps ? 70 : 120);
    const r = (wisps ? 16 : 30) + rnd() * (wisps ? 26 : 46);
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const a = wisps ? 0.16 : 0.5;
    grad.addColorStop(0, `rgba(255,255,255,${a})`);
    grad.addColorStop(0.55, `rgba(252,253,255,${a * 0.55})`);
    grad.addColorStop(1, 'rgba(250,252,255,0)');
    g.fillStyle = grad; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const clouds = [];
function buildCloudLayer(count, tex, yMin, yMax, sizeMin, sizeMax, opacity, drift) {
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, opacity, depthWrite: false, fog: false,
    side: THREE.DoubleSide, blending: THREE.NormalBlending,
  });
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, count);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  const items = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < count; i++) {
    const it = {
      x: (Math.random() - 0.5) * 3000,
      z: (Math.random() - 0.5) * 3000,
      y: yMin + Math.random() * (yMax - yMin),
      s: sizeMin + Math.random() * (sizeMax - sizeMin),
      rot: Math.random() * Math.PI,
      ar: 0.55 + Math.random() * 0.5,
    };
    items.push(it);
    e.set(-Math.PI / 2, 0, it.rot);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.s, it.s * it.ar, 1));
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);
  clouds.push({ mesh, items, drift, m, q, e });
  return mesh;
}
buildCloudLayer(46, cloudTexture(7, false), 240, 340, 160, 420, 0.95, 3.2);
buildCloudLayer(26, cloudTexture(23, true), 460, 620, 380, 900, 0.5, 1.5);

function updateClouds(dt, camX, camZ) {
  for (const layer of clouds) {
    const { mesh, items, drift, m, q, e } = layer;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      it.x += drift * dt;
      // laat de wolken meelopen met de speler, zodat de lucht nooit leegloopt
      if (it.x - camX > 1600) it.x -= 3200;
      if (it.x - camX < -1600) it.x += 3200;
      if (it.z - camZ > 1600) it.z -= 3200;
      if (it.z - camZ < -1600) it.z += 3200;
      e.set(-Math.PI / 2, 0, it.rot);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.s, it.s * it.ar, 1));
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------- Verlichting ----------
// Omgevingslicht komt uit een environment map die uit de lucht zelf wordt
// gerenderd; dat geeft baksteen, glas en lak veel natuurlijker aanzetten dan
// een vlakke hemisphere light.
/*
 En die omgeving loopt met de klok mee (verzoek 24 sep 2026). Hij werd één keer
 gebakken en bleef daarna staan, dus bij zonsondergang en 's nachts spiegelden
 ruiten en lak nog een blauwe middaglucht. De luchtbol in de omgevingsscène
 deelt nu de uniforms van de echte lucht (js/sfeer.js zet kleuren en zon), de
 grond eronder wordt 's nachts donker, en `werkOmgevingBij` bakt hem opnieuw
 zodra de zon twee graden verder staat — hoogstens eens per zes seconden, want
 één keer bakken kost een paar honderdste seconde.
*/
const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
const envScene = new THREE.Scene();
const envSkyMat = skyMat.clone();
envSkyMat.uniforms = skyUniforms;
envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), envSkyMat));
const ENV_GROND = new THREE.Color(0x5d7a46);
const envGrondMat = new THREE.MeshBasicMaterial({ color: ENV_GROND.clone(), side: THREE.DoubleSide });
{
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), envGrondMat);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -6;
  envScene.add(ground);
}
let envRT = null, envT = 0, envBakken = 0;
const envZon = new THREE.Vector3(), envLucht = new THREE.Color();
function bakOmgeving() {
  // de grond: vol bij daglicht, bijna zwart als de zon onder is
  const dag = Math.max(0.06, Math.min(1, SUN_DIR.y * 2.5 + 0.35));
  envGrondMat.color.copy(ENV_GROND).multiplyScalar(dag);
  const rt = pmrem.fromScene(envScene, 0, 0.1, 200);
  scene.environment = rt.texture;
  if (envRT) envRT.dispose();
  envRT = rt;
  envZon.copy(SUN_DIR);
  envLucht.copy(skyUniforms.mid.value);
  envBakken++;
}
bakOmgeving();
/*
 De schaduwdoos: een stuk vóór je, en vastgeklikt op het raster van de kaart
 gezien vanuit de zon. Alleen de twee richtingen dwars op de zonnestraal tellen;
 langs de straal maakt het voor de kaart niet uit waar het midden ligt.
*/
const _zonR = new THREE.Vector3(), _zonO = new THREE.Vector3(), _zonM = new THREE.Vector3();
function zetSchaduwDoos(cx, cz) {
  const kijk = new THREE.Vector3();
  camera.getWorldDirection(kijk);
  kijk.y = 0;
  if (kijk.lengthSq() > 1e-6) kijk.normalize();
  _zonM.set(cx + kijk.x * SHADOW_VOORUIT, 0, cz + kijk.z * SHADOW_VOORUIT);
  const texel = (2 * SHADOW_R) / SHADOW_MAP;
  _zonR.crossVectors(SUN_DIR, _zonO.set(0, 1, 0));
  if (_zonR.lengthSq() < 1e-6) _zonR.set(1, 0, 0);
  _zonR.normalize();
  _zonO.crossVectors(_zonR, SUN_DIR).normalize();
  const a = _zonM.dot(_zonR), b = _zonM.dot(_zonO);
  _zonM.addScaledVector(_zonR, Math.round(a / texel) * texel - a);
  _zonM.addScaledVector(_zonO, Math.round(b / texel) * texel - b);
  sun.position.set(_zonM.x + SUN_DIR.x * 150, _zonM.y + SUN_DIR.y * 150, _zonM.z + SUN_DIR.z * 150);
  sun.target.position.copy(_zonM); sun.target.updateMatrixWorld();
}
function werkOmgevingBij(dt) {
  envT -= dt;
  if (envT > 0) return;
  envT = 6;
  // ook bij ander weer: dan verandert de lucht zonder dat de zon beweegt
  const lucht = skyUniforms.mid.value;
  const anders = Math.abs(lucht.r - envLucht.r) + Math.abs(lucht.g - envLucht.g) + Math.abs(lucht.b - envLucht.b);
  if (SUN_DIR.angleTo(envZon) > 0.035 || anders > 0.06) bakOmgeving();
}

const hemi = new THREE.HemisphereLight(0xd2e2f6, 0x6e8154, 0.75);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3e0, 2.2);
sun.castShadow = true;
// 2048 over een strakkere doos is vier keer goedkoper dan 4096 over 156 m en
// nauwelijks van elkaar te onderscheiden; op een telefoon scheelt dat het meest.
/*
 Scherpere schaduw dichtbij (verzoek 24 sep 2026). Eén kaart van 2048 over een
 doos van 104 m is 5,1 cm per beeldpunt, en dat is te grof voor de rand van een
 dakkapel of een lantaarnpaal op de stoep. Op de pc nu 3072 over 76 m: 2,5 cm.
 De doos is kleiner, dus hij schuift twintig meter mee in je kijkrichting — wat
 achter je ligt zie je toch niet — en hij springt per beeldpunt van de kaart,
 zodat de schaduwranden niet gaan zwemmen als je loopt. Op een telefoon blijft
 het zoals het was.
*/
const SHADOW_MAP = IS_TOUCH ? 1024 : 3072;
sun.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
sun.shadow.camera.near = 8; sun.shadow.camera.far = 230;
const SHADOW_R = IS_TOUCH ? 52 : 38;
const SHADOW_VOORUIT = IS_TOUCH ? 0 : 20;
sun.shadow.camera.left = -SHADOW_R; sun.shadow.camera.right = SHADOW_R;
sun.shadow.camera.top = SHADOW_R; sun.shadow.camera.bottom = -SHADOW_R;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.035;
sun.shadow.radius = 2.2;
scene.add(sun); scene.add(sun.target);
// zwak tegenlicht zodat schaduwzijden niet dichtlopen
const fill = new THREE.DirectionalLight(0xcfe0f2, 0.8);
fill.position.set(-SUN_DIR.x * 150, 90, -SUN_DIR.z * 150);
scene.add(fill);

/*
 De koplampen van de auto waar je in zit. Ze waren tot nu toe alleen een
 oplichtend vlakje aan de neus: de lamp zelf was te zien, maar er kwam geen
 licht uit en 's nachts reed je door het donker met twee gloeiende stipjes
 voor je (verzoek 20 sep 2026).

 Eén spot, niet twee. Elke lamp telt mee in de belichtingslus van élk materiaal
 en kost de kaart een eigen shaderprogramma — dat staat uitgerekend in
 js/sfeer.js, waar de straatlantaarns om die reden van negentien naar drie
 gingen. Eén brede spot vanaf het midden van de neus geeft op straat hetzelfde
 beeld als twee smalle; wat je mist is de dubbele lichtbundel op een muur vlak
 voor je, en dat is het niet waard.

 Hij hangt aan een eigen `target` die elke beeld voor de auto uit wordt gezet;
 zonder zo'n doel wijst een spot altijd naar de oorsprong.
*/
const koplamp = new THREE.SpotLight(0xfff0cf, 0, 62, 0.52, 0.55, 1.1);
koplamp.visible = false;
scene.add(koplamp); scene.add(koplamp.target);

// Kaart uit BGT en 3D BAG (js/kaart.js). Met ?kaart=oud draait de oude,
// handgetekende kaart uit data.js; met ?boven=1 komt er een orthografisch
// bovenaanzicht van het hele gebied (en met &plat=1 in egale controlekleuren).
const URLP = new URLSearchParams(location.search);
const BOVEN = URLP.has('boven');
if (URLP.get('kaart') !== 'oud') {
  try {
    const k = await import('./kaart.js');
    zetKaart(k.KAART);
    if (BOVEN && URLP.has('plat')) zetStand('plat');
    console.log(`kaart.js van ${k.KAART.gemaakt}: ${k.KAART.panden.length} panden, ${k.KAART.vlakken.length} vlakken`);
  } catch (e) { console.warn('geen js/kaart.js, de oude kaart uit data.js wordt gebruikt', e); }
}

/*
 De wereld opbouwen.

 Dit kostte drieënveertig seconden in één blok, en al die tijd stond de pagina
 stil: geen menu, geen teller, een zwart scherm. Nu is het een generator die
 tussen de fases en binnen de twee grootste lussen teruggeeft (js/world.js), en
 draaien we er hier per beeld een stukje van. Daardoor:

   - staat het menu er meteen, en laadt de wereld terwijl je ernaar kijkt;
   - kan er een voortgangsbalk mee, want er is nu voortgang om te tonen;
   - blijft het tabblad reageren in plaats van een halve minuut te bevriezen.

 `BUDGET` is hoeveel milliseconde er per stuk gebouwd mag worden. Tussen de
 stukken door geven we het beeld terug met een `setTimeout` en niet met een
 `requestAnimationFrame`: de hoofdlus draait nog niet, en in een browser zonder
 grafische kaart (de proefopstelling) haalt die maar een paar beelden per
 seconde — dan zou de opbouw uren duren in plaats van een minuut.
*/
const BUDGET = 24;
/*
 Het beeld teruggeven tussen twee stukken opbouw. Een `setTimeout(0)` wacht in
 Chrome na een paar keer minstens vier milliseconde, en bij honderden stukken
 was dat 12,9 van de 72 seconden stilstand (profiel 24 sep 2026). Een bericht
 over een MessageChannel komt meteen terug. Eens per tiende seconde toch een
 echte setTimeout, zodat het laadscherm ook echt getekend wordt.
*/
let laatsteEchtePauze = 0;
const geefBeeldTerug = () => new Promise(klaar => {
  const nu = performance.now();
  if (nu - laatsteEchtePauze > 100) { laatsteEchtePauze = nu; setTimeout(klaar, 0); return; }
  const kanaal = new MessageChannel();
  kanaal.port1.onmessage = () => klaar();
  kanaal.port2.postMessage(0);
});
menu.bouwMenu({
  heeftOpslag: !!opslagInfo(),
  opAfsluiten: () => afsluiten(),
});
menu.laadBeelden();
menu.laadMuziek();          // het menudeuntje uit audio/menu/, op herhaling
menu.toonMenu();
let keuzeBelofte = menu.wachtOpKeuze();
let laadBalk = null;
// zodra je iets kiest schuift het laadscherm ervoor, ook als de wereld nog bouwt
keuzeBelofte.then(() => { if (!laadBalk) laadBalk = menu.toonLaadscherm(); });

/*
 Hoelang elke fase van het opstarten duurt, voor tools/opstarttest.mjs: per
 fase de naam en de milliseconden. De opbouw van de wereld meldt zijn eigen
 fases (`wat`), de rest komt uit `adem` hieronder.
*/
const OPSTART = window.__opstart = [];
// de eerste fase telt vanaf het openen van de pagina: modules, kaart.js en het menu
let opstartFase = { wat: 'pagina, modules en kaart.js', t: 0 };
const opstartStap = (wat) => {
  const nu = performance.now();
  if (opstartFase && opstartFase.wat !== wat) {
    OPSTART.push({ wat: opstartFase.wat, ms: Math.round(nu - opstartFase.t) });
    opstartFase = { wat, t: nu };
  }
};
const t0 = performance.now();
opstartStap('wereld');
// de gevels worden pas na het opstarten getekend (zie `maakAf` in js/textures.js)
zetUitstel(true);
const world = await (async () => {
  const stappen = buildWorldStap(scene);
  let klaar = null;
  while (true) {
    const grens = performance.now() + BUDGET;
    let r;
    do { r = stappen.next(); } while (!r.done && performance.now() < grens);
    if (r.done) { klaar = r.value; break; }
    opstartStap(`wereld: ${r.value.wat}`);
    if (laadBalk) laadBalk(r.value.deel, r.value.wat);
    await geefBeeldTerug();
  }
  return klaar;
})();
zetUitstel(false);
console.log(`Wereld gebouwd in ${Math.round(performance.now() - t0)} ms, ${colliders.length} colliders, ${world.parkSpots.length} auto's`);

/*
 Reliëf en glans (js/textures.js). Elk kleurdoek van een soort met reliëf krijgt
 er een normal map bij, en elke gevel een roughness map waarin het glas glad is
 en het metselwerk mat. Dat is de pc-kant van de kwaliteit: het kost een extra
 textuurophaling per materiaal en een stuk of veertig megabyte, en dat is op een
 telefoon net te veel — vandaar dat het aan `IS_TOUCH` hangt. Met `?relief=0`
 gaat het uit; daarmee zijn de voor-en-na-foto's en de audit gemaakt.
*/
/*
 Vanaf hier is de wereld er, maar het spel nog niet: het reliëf, de speler, de
 auto's, de voetgangers en de binnenruimtes moeten nog. Gemeten kostte dat stuk
 achtentwintig seconden — meer dan de helft van het wachten — en het stond als
 één blok achter de laatste stap van de opbouw. `adem` zet de balk een stukje
 verder en geeft het beeld terug, zodat het laadscherm ook hier blijft lopen.
*/
const adem = async (wat, deel) => {
  opstartStap(wat);
  if (laadBalk) laadBalk(deel, wat);
  await geefBeeldTerug();
};

const RELIEF_AAN = !IS_TOUCH && new URLSearchParams(location.search).get('relief') !== '0';
/*
 Het reliëf komt ná het opstarten (zie `reliëfStappen` in js/textures.js): het
 kostte hier 13,7 van de 72 seconden. De stappen worden hieronder klaargezet
 zodra het beginpunt bekend is en in `loop` per beeld een paar milliseconde
 afgewerkt; `reliëfAf` doet de rest in één keer, voor de proeven.
*/
let reliëf = null, reliëfT = 0, reliëfMs = 0;
function reliëfAf() {
  if (!reliëf) return null;
  let r; do { r = reliëf.next(); } while (!r.done);
  reliëf = null;
  meldReliëf(r.value);
  return r.value;
}
function meldReliëf(v) {
  console.log(`reliëf: ${v.normalen} normal maps en ${v.glans} roughness maps over ${v.materialen} materialen, en ${v.gevels} gevels, na het opstarten in ${Math.round(reliëfMs)} ms`);
}
/*
 De gevels en het reliëf komen ná het opstarten, maar welke materialen erbij
 horen ligt hier vast: dezelfde als toen het reliëf hier nog in één keer ging.
 Het beginpunt komt verderop pas; de volgorde wordt bij de eerste stap bepaald.
*/
reliëf = reliëfStappen(scene, () => beginpunt, RELIEF_AAN);

/*
 Omgevingslicht sterker laten meewegen. three r160 heeft nog geen
 `scene.environmentIntensity`, dus het gaat per materiaal.

 Dit liep over de hele scène in één keer en was met tien seconden het langste
 blok dat er na de opbouw nog over was. Het gaat nu per honderd takken van de
 scène, met een adempauze ertussen; `seen` houdt bij welke materialen al gehad
 zijn, dus opknippen verandert niets aan de uitkomst.
*/
async function applyEnvIntensity(root, v = 1.7, stapsgewijs = false) {
  const seen = new Set();
  const doe = (o) => {
    const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    for (const m of mats) {
      if (!m || seen.has(m) || !m.isMeshStandardMaterial) continue;
      seen.add(m);
      m.envMapIntensity = m.metalness > 0.4 ? v * 0.8 : v;
      m.needsUpdate = true;
    }
  };
  if (!stapsgewijs) { root.traverse(doe); return; }
  const takken = root.children.slice();
  for (let i = 0; i < takken.length; i++) {
    takken[i].traverse(doe);
    if ((i % 100) === 99) await adem('licht', 0.962 + 0.004 * (i / takken.length));
  }
}
await adem('licht', 0.962);
await applyEnvIntensity(scene, 1.7, true);
await adem('de speler', 0.966);

// Beginpunt: op de berm voor Molenkrite 15, met de buurman recht vooruit (zie
// js/verhaal.js). Zonder kaartdata valt het terug op het punt uit de kaart of
// op START uit de oude data.js.
const [ox, oz] = toWorld(START.at[0], START.at[1]);
const beginpunt = verhaalStart() || (KAART ? startKaart() : { x: ox, z: oz, yaw: START.yaw });
const player = new Player(camera, scene, beginpunt.x, beginpunt.z, beginpunt.yaw);
await adem('verkeer', 0.97);
const vehicles = new Vehicles(scene, world.parkSpots);
await adem('voetgangers', 0.978);
/*
 De claxon van een bestuurder die voor je staat te wachten (js/vehicles.js telt
 af hoe lang je er al staat). Het geluid hoort hier en niet daar: dat bestand
 gaat over rijden en botsen en heeft geen weet van de audioketen.
*/
vehicles.opClaxon = (x, z) => geluid.claxon(Math.hypot(player.pos.x - x, player.pos.z - z));

const npcs = new NPCs(scene, world.roadSegments, 130);
player.applyCamera();   // meteen op ooghoogte op de Molenkrite, ook voor het startscherm
const hud = new HUD();
await adem('het verhaal', 0.984);
// Het verhaal: broer Mark voor Molenkrite 15, het gezelschap schuin tegenover,
// de rit naar de waterzuivering, de bewaking en het afleveren bij de boerderij.
// Zonder kaartdata (?kaart=oud) speelt het niet en doet alles niets.
const verhaal = initVerhaal({
  scene, player, hud, vehicles,
  // Ga je neer, dan begint het verhaal bij het laatst opgeslagen spel; is er
  // niets opgeslagen, dan zegt laadSpel false en begint de missie opnieuw.
  opnieuw: () => laadSpel({ player, sfeer, vehicles, verhaal, boten, vaart }),
  /*
   Twee dingen die het verhaal niet zelf kan: de camera terug naar de eerste
   persoon (bij het uitstappen op de waterzuivering) en de sterren eenmalig
   weghalen (na het afleveren van de vrachtwagen). Allebei als functie, want
   `derde` en `politie` bestaan hieronder pas.
  */
  eersteP: () => { if (derde.aan) derde.wissel(); },
  sterrenWeg: () => politie.reset(),
  // en één ster geven, zonder loting: dat hoort bij het stelen van de BX
  sterGeven: (n, x, z) => politie.zetSter(n, x, z),
  /*
   Missie 7 speelt zich deels binnen af: in het huis aan de Wieken (waar Mark
   op de bank zit) en in de Poiesz in Duinterpen (waar de bom komt). Allebei
   worden ze verderop pas gemaakt, dus ze gaan als functie mee. `schokken` is
   de camerabeving van de knal.
  */
  // wat een neergeschoten schutter laat liggen (js/buit.js)
  laatVallen: (soort, x, z, waarde) => buit.laatVallen(soort, x, z, waarde),
  /*
   De buurt laten schrikken. Een autoknal en elk schot doen dit al (zie
   `PANIEK_KLAP` hierboven); de bom in de Poiesz en het vuurgevecht dat erop
   volgt deden het niet, en dan loopt de wijk onbewogen langs een pand dat net
   de lucht in is gegaan (verzoek 22 sep 2026).
  */
  paniek: (x, z, straal) => npcs.paniek(x, z, straal),
  // de sloepen: missie 8 speelt zich grotendeels op het water af
  boten: () => boten,
  wieken: () => woningen[1] || null,
  poiesz: () => (supermarkt && supermarkt.ingangen ? supermarkt : null),
  // de drie woningen van missie 9 (js/interieur.js)
  stekken: () => woningen.filter(w => w.stek),
  schokken: (kracht) => schok(kracht),
}) || {
  update() {}, toets() { return false; }, doelen() { return []; }, raak() { return false; },
  bewaar() { return null; }, herstel() {}, meldAan() {}, schotGehoord() {}, dood() {}, mislukt() {},
  beginGesprek() {},
  hinder: { alive: false, opWeg: false, x: 0, z: 0 },
  missie: 'geen', fase: 'geen', aanspreekbaar: false,
};
// De woning achter de voordeur van Molenkrite 15: een losse kamer ruim buiten
// het kaartgebied, met de maten van het echte pand. Bij de deur zet E je naar
// binnen en weer naar buiten (js/interieur.js).
const LEEG = {
  update() {}, toets() { return false; }, binnen() { return false; }, meldAan() {}, kaart() { return null; },
  winkels: [],
};
/*
 Achter de voordeuren van Molenkrite 15 en de Wieken 29 (js/interieur.js). De
 sfeermodule wordt verderop pas gemaakt, dus hij gaat als kijkvenster mee: de
 kamers vragen alleen of het buiten donker is, en dat pas als de lus draait.
*/
const dagKlok = { get nacht() { return sfeer ? sfeer.nacht : false; } };
await adem('woningen van binnen', 0.988);
const woningen = WONINGEN.map(h => initInterieur({ scene, player, sfeer: dagKlok, hud, huis: h })).filter(Boolean);
const interieur = woningen[0] || LEEG;
// En achter de schuurdeur van Tinga State: de deel met de toonbank waar je
// munitie koopt (js/boerderij.js).
await adem('de boerderij', 0.992);
const boerderij = initBoerderij({ scene, player, hud, verhaal }) || LEEG;
// en achter de schuifdeuren van de Poiesz in IJlst, waar je bier koopt
// (js/supermarkt.js).
await adem('de supermarkt', 0.996);
const supermarkt = initSupermarkt({ scene, player, hud, verhaal }) || LEEG;
opstartStap('de rest van de opzet');
// Alle binnenruimtes bij elkaar; ze werken allemaal op dezelfde manier.
const binnenruimtes = [...woningen, boerderij, supermarkt];
const ergensBinnen = (x, z) => binnenruimtes.some(r => r.binnen(x, z));
// en sta je in de tuin van een van de woningen? Dan ben je buiten (js/interieur.js)
const inTuin = (x, z) => binnenruimtes.some(r => r.tuin && r.tuin(x, z));
/*
 Winkeltjes op de minikaart en op de grote kaart, en daar komen tijdens missie 9
 de drie te koop staande woningen bij (js/verhaal.js levert ze; js/hud.js tekent
 ze als huisje in plaats van als winkelspeldje). De lijst wordt alleen opnieuw
 gezet als hij verandert — elk beeld een nieuwe array doorgeven zou de kaart
 nergens sneller van maken.
*/
const vasteWinkels = binnenruimtes.flatMap(r => r.winkels || []);
let winkelsNu = '';
function werkKaartvlaggenBij() {
  const huizen = verhaal.huisMarkeringen ? verhaal.huisMarkeringen() : [];
  const sleutel = huizen.map(h => `${h.naam}@${h.x.toFixed(0)},${h.z.toFixed(0)}`).join('|');
  if (sleutel === winkelsNu) return;
  winkelsNu = sleutel;
  hud.zetWinkels([...vasteWinkels, ...huizen]);
}
werkKaartvlaggenBij();
// Binnen wijst de HUD nog steeds de straat buiten aan (zie hud.kaartVanaf).
function straatOf(x, z) {
  let k = null;
  for (const r of binnenruimtes) { k = r.kaart(x, z); if (k) break; }
  hud.kaartVanaf = k ? k.punt : null;
  return k ? k.naam : nearestRoadName(x, z);
}
// Camera over de schouder (V): handig met de auto, en te voet zie je jezelf
// lopen. De hengel wordt ingekort zodra er een muur achter je staat.
const derde = initDerdePersoon({ scene, camera, player });

// Politie en het gezocht-systeem: schieten en aanrijden leveren verdenking op,
// en boven een drempel komen er eenheden op je af (zie js/politie.js).
// `sfeer` gaat mee voor de helikopter: die doet zijn zoeklicht alleen 's nachts aan.
const politie = initPolitie({ scene, player, npcs, vehicles, hud, sfeer: dagKlok });

/*
 De wasboxen achter BP Slump Oil (js/spuiterij.js). Ze komen ná de politie,
 want ze hebben hem nodig: de roldeur blijft dicht als er blauw naast staat, en
 een overspuiting wist de sterren.
*/
const spuiterij = initSpuiterij({ scene, player, vehicles, hud, verhaal, politie }) || null;

/*
 De twee sloepen op het water (js/boot.js): één aan de Geeuwkade achter de
 waterzuivering, één aan de steiger in IJlst. Je stapt er met E in, net als in
 een auto.
*/
const boten = initBoten({ scene, player, hud }) || null;
/*
 Voetgangers steken pas over als er geen auto aankomt, en auto's remmen voor wie
 al oversteekt (js/npc.js en js/vehicles.js). De twee weten niets van elkaar; ze
 worden hier aan elkaar geknoopt.
*/
npcs.magOversteken = (x, z) => !vehicles.autoDichtbij(x, z, 16);
/*
 De politie op het water (js/politieboot.js). Eén sloep, en alleen als je zelf
 op het water zit én er verdenking is; aan de wal valt er niets te patrouilleren
 en zonder sterren is er niets aan de hand.
*/
const politieboot = initPolitieboot({ scene, player, hud, politie, boten });
/*
 De lading over het water (js/vaart.js): ophalen in IJlst, afleveren aan de
 Geeuwkade bij de waterzuivering. Hij meldt zich vanzelf als het verhaal
 uitgespeeld is.
*/
const vaart = initVaart({ scene, player, hud, boten, politie, verhaal });

/*
 Wat er op straat blijft liggen (js/buit.js): geld uit de zak van een
 voetganger, munitie van een agent. Het ligt er echt en je pakt het op door er
 langs te lopen.
*/
const buit = maakBuit(scene, (x, z) => grondHoogte(x, z, -Infinity));

// Het verkeer moet ook voor de buurman remmen als hij oversteekt. De lijst met
// voetgangers heeft een vaste lengte, dus die zetten we één keer klaar.
const opDeWeg = npcs.people.concat([verhaal.hinder]);
// Te voet loop je niet door auto's heen; js/player.js kent de auto's niet, dus
// het duwtje komt hiervandaan (de auto waar je zelf in zit telt niet mee).
player.blokkade = (x, z, r) => vehicles.duwUit(x, z, r, player.inCar, player.pos.y);
// remsporen: js/vehicles.js legt ze neer via deze haak
bouwSporen(scene);
vehicles.spoor = zetSpoor;
// nog een keer: de speler, de auto's en de binnenruimtes zijn er ná de eerste
// ronde bij gekomen en hebben hun eigen materialen
opstartStap('omgevingslicht');
await applyEnvIntensity(scene);
opstartStap('de rest van de opzet (2)');

/*
 Botsgevoel: de camera schudt van een klap.

 Een aanrijding was tot nu toe alleen een getal — je snelheid ging eraf en dat
 was het. `schok(kracht)` zet een uitslag die in een halve seconde uitdempt en
 die vlak voor het renderen bij de camera wordt opgeteld. De uitslag is een
 sinus met drie snelheden door elkaar, want één zuivere trilling leest als een
 defect beeldscherm en niet als een klap.

 Het wordt op de camera zelf gezet en niet op de speler: anders schuift je
 botsdoos mee en loop je door een muur heen.
*/
const SCHOK = { t: 0, kracht: 0 };
function schok(kracht) { SCHOK.kracht = Math.max(SCHOK.kracht, Math.min(1.2, kracht)); SCHOK.t = 0; }
function schokCamera(cam, dt) {
  if (SCHOK.kracht <= 0.001) return;
  SCHOK.t += dt;
  const over = Math.max(0, 1 - SCHOK.t / 0.55);
  SCHOK.kracht *= Math.max(0, 1 - dt * 3.2);
  const a = SCHOK.kracht * over * over;
  if (a <= 0.001) { SCHOK.kracht = 0; return; }
  const t = SCHOK.t;
  const dx = (Math.sin(t * 61) * 0.6 + Math.sin(t * 37) * 0.4) * a * 0.20;
  const dy = (Math.sin(t * 53 + 1.1) * 0.6 + Math.sin(t * 29) * 0.4) * a * 0.16;
  cam.position.x += dx; cam.position.y += dy;
  cam.rotation.z += Math.sin(t * 44) * a * 0.035;
}

// Hoe ver de schrik reikt. Een schot hoor je door de hele straat, een klap van
// een aanrijding wat minder ver; wie binnen die straal loopt, gaat ervandoor.
const PANIEK_SCHOT = 28;
const PANIEK_KLAP = 20;

// afstand van de speler tot een punt in de wereld, voor het volume van een kreet
const afstandTot = (p) => Math.hypot(player.pos.x - p.x, player.pos.z - p.z);

// Schieten: raycast op auto's en voetgangers
const raycaster = new THREE.Raycaster();

/*
 Waar de kogel aankomt.

 Hier stond een zwart bolletje van vier centimeter dat acht seconden bleef
 liggen. Dat was op twee manieren fout. De straal raakt namelijk alleen dingen
 die bewégen — auto's, voetgangers, agenten; de gebouwen zitten niet in de
 lijst — dus het bolletje bleef hangen op de plek waar de auto wás, en je zag
 een rij zwarte kraaltjes in de lucht staan waar iemand net gereden of gelopen
 had. En een bol is sowieso geen kogelinslag: een inslag is een flits en een
 wolkje, en dat is een kwart seconde te zien en geen acht.

 Het is nu een stofwolkje: twee kruislingse vlakjes met een getekende pluim
 erop, die in een kwart seconde uitzetten, omhoog drijven en wegvagen, met een
 kort vonkje erbij op metaal. Ze komen uit een vaste voorraad van twaalf — meer
 zie je nooit tegelijk — dus er wordt niets bijgemaakt en niets vergeten op te
 ruimen, en ze lopen mee met de hoofdlus in plaats van met een `setTimeout`:
 zet je het spel op pauze, dan staat de wolk ook stil.
*/
const INSLAG_TIJD = 0.28;
const inslagen = [];
{
  /*
   Elk wolkje heeft zijn eigen materiaal. Dat lijkt verkwistend voor twaalf
   vlakjes, maar de doorzichtigheid loopt per wolk terug, en met één gedeeld
   materiaal zou de jongste inslag de doorzichtigheid van alle andere
   overschrijven — dan knipperen ze samen in plaats van ieder voor zich weg te
   vagen. De textuur wordt wél gedeeld.
  */
  const doek = inslagPluim();
  const pluim = new THREE.PlaneGeometry(1, 1);
  const bol = new THREE.SphereGeometry(0.045, 5, 4);
  for (let i = 0; i < 12; i++) {
    const stofMat = new THREE.MeshBasicMaterial({
      map: doek, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
    });
    const vonkMat = new THREE.MeshBasicMaterial({
      color: 0xffd08a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const groep = new THREE.Group();
    for (const r of [0, Math.PI / 2]) {
      const v = new THREE.Mesh(pluim, stofMat);
      v.rotation.y = r;
      groep.add(v);
    }
    const vonk = new THREE.Mesh(bol, vonkMat);
    groep.add(vonk);
    groep.visible = false;
    groep.renderOrder = 3;
    scene.add(groep);
    inslagen.push({ groep, vonk, stofMat, vonkMat, t: 0, maat: 1 });
  }
}
let inslagNr = 0;

/*
 Bloed (verzoek 20 sep 2026: "voeg ook bloedeffecten toe bij iemand die
 beschoten is").

 Twee dingen, want een treffer en een dode zien er anders uit. De **spat** komt
 op het moment van de kogel uit het lichaam: een rode wolk die een halve seconde
 uitzet en wegzakt in plaats van op te drijven, want bloed valt. De **plas**
 blijft liggen onder wie neergaat: een platte vlek op de grond die in een halve
 seconde groeit, een halve minuut blijft en daarna wegtrekt.

 Dezelfde aanpak als bij de inslagwolkjes hierboven: een vaste voorraad, eigen
 materiaal per stuk (de doorzichtigheid loopt per vlek terug) en meelopen met de
 hoofdlus, zodat er niets bijgemaakt wordt en er niets blijft hangen als je
 pauzeert. Tien spatten en acht plassen: meer zie je nooit tegelijk.
*/
const SPAT_TIJD = 0.55, PLAS_TIJD = 32;
const spatten = [], plassen = [];
{
  const spatDoek = bloedSpatDoek();
  const plasDoek = bloedPlasDoek();
  const vlak = new THREE.PlaneGeometry(1, 1);
  for (let i = 0; i < 10; i++) {
    const mat = new THREE.MeshBasicMaterial({
      map: spatDoek, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
    });
    const groep = new THREE.Group();
    for (const r of [0, Math.PI / 2]) {
      const v = new THREE.Mesh(vlak, mat);
      v.rotation.y = r;
      groep.add(v);
    }
    groep.visible = false;
    groep.renderOrder = 3;
    scene.add(groep);
    spatten.push({ groep, mat, t: 0, maat: 1 });
  }
  for (let i = 0; i < 8; i++) {
    const mat = new THREE.MeshBasicMaterial({
      map: plasDoek, transparent: true, opacity: 0, depthWrite: false,
    });
    const m = new THREE.Mesh(vlak, mat);
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    m.renderOrder = 2;
    scene.add(m);
    plassen.push({ mesh: m, mat, t: 0, maat: 1 });
  }
}
let spatNr = 0, plasNr = 0;

/** De rode wolk op de plek waar de kogel iemand raakte. */
function toonSpat(punt, richting) {
  const o = spatten[spatNr = (spatNr + 1) % spatten.length];
  o.groep.position.copy(punt);
  // een stukje mee met de kogel: de spat komt aan de achterkant naar buiten
  if (richting) o.groep.position.addScaledVector(richting, 0.12);
  o.groep.rotation.y = Math.random() * Math.PI * 2;
  o.t = SPAT_TIJD;
  o.maat = 0.62 + Math.random() * 0.3;
  o.groep.visible = true;
  o.mat.opacity = 0.9;
}

/** De plas die blijft liggen bij wie neergaat. Op de grond, niet op de heup. */
function toonPlas(x, z, y = 0) {
  const o = plassen[plasNr = (plasNr + 1) % plassen.length];
  o.mesh.position.set(x, y + 0.035, z);
  o.mesh.rotation.z = Math.random() * Math.PI * 2;
  o.t = PLAS_TIJD;
  o.maat = 0.85 + Math.random() * 0.5;
  o.mesh.visible = true;
}

function werkBloedBij(dt) {
  for (const o of spatten) {
    if (o.t <= 0) continue;
    o.t -= dt;
    if (o.t <= 0) { o.groep.visible = false; continue; }
    const f = 1 - o.t / SPAT_TIJD;                  // 0 bij de treffer, 1 als hij weg is
    const s = (0.18 + f * 0.55) * o.maat;
    o.groep.scale.set(s, s, s);
    o.groep.position.y -= dt * 0.5;                 // bloed valt, stof drijft op
    o.mat.opacity = 0.9 * (1 - f) ** 1.4;
  }
  for (const o of plassen) {
    if (o.t <= 0) continue;
    o.t -= dt;
    if (o.t <= 0) { o.mesh.visible = false; continue; }
    const groei = Math.min(1, (PLAS_TIJD - o.t) / 0.45);      // loopt in een halve seconde uit
    const s = (0.35 + groei * 0.75) * o.maat;
    o.mesh.scale.set(s, s, 1);
    // de laatste vier seconden trekt hij weg
    o.mat.opacity = 0.85 * Math.min(1, groei) * Math.min(1, o.t / 4);
  }
}


/** Een wolkje op de plek waar de kogel aankwam. `hard` = metaal, dus met vonk. */
function toonInslag(punt, hard = true, maat = 1) {
  const o = inslagen[inslagNr = (inslagNr + 1) % inslagen.length];
  o.groep.position.copy(punt);
  o.groep.rotation.y = Math.random() * Math.PI * 2;
  o.t = INSLAG_TIJD;
  o.maat = maat;
  o.vonk.visible = hard;
  o.groep.visible = true;
}

function werkInslagenBij(dt) {
  for (const o of inslagen) {
    if (o.t <= 0) continue;
    o.t -= dt;
    if (o.t <= 0) { o.groep.visible = false; continue; }
    const f = 1 - o.t / INSLAG_TIJD;                 // 0 bij de knal, 1 als hij weg is
    const s = (0.12 + f * 0.34) * o.maat;
    o.groep.scale.set(s, s, s);
    o.groep.position.y += dt * 0.35;                 // het wolkje drijft op
    o.stofMat.opacity = 0.85 * (1 - f) ** 1.5;
    o.vonkMat.opacity = Math.max(0, 1 - f * 4);
  }
}
/*
 Wat er te zien is als een kogel iemand raakt: altijd een spat, en bij wie
 neergaat ook een plas op de grond. De plas komt op de plek van de persoon en
 niet op het punt van de kogel — een treffer in de borst hoort geen plas op
 borsthoogte te geven.
*/
function bloedBij(punt, richting, raak) {
  toonSpat(punt, richting);
  if (!raak || !raak.neer) return;
  const x = raak.x ?? punt.x, z = raak.z ?? punt.z;
  /*
   De hoogte van de grond ónder zijn voeten, en dat is niet hetzelfde als het
   maaiveld: een stoep, een tuin en een grasberm liggen twaalf centimeter boven
   de rijbaan (KERB_Y in js/kaartwereld.js). Met alleen `grondHoogte` lag de
   plas onder de tegels en zag je er niets van. `vlakOp` geeft het vlak waar je
   op staat, en dat weet zijn eigen hoogte.
  */
  const vlak = vlakOp(x, z);
  toonPlas(x, z, grondHoogte(x, z) + (vlak ? vlak.y || 0 : 0));
}

player.shootCb = (camOrigin, camDir) => {
  // in de derde persoon komt de kogel uit de schouder van je poppetje en niet
  // uit de camera, anders schiet je langs jezelf heen
  const { origin, dir } = derde.mikpunt(camOrigin, camDir);
  verhaal.schotGehoord(origin.x, origin.z);      // de bewaking hoort je schieten
  politie.hoorSchot(origin.x, origin.z);         // en de politie ook
  /*
   De buurt rent weg — en schreeuwt. Eén of twee kreten per schot, niet per
   voetganger: een straat vol mensen die allemaal tegelijk gillen is lawaai en
   geen schrik. Ze komen een tiende seconde later, want zo snel schrik je niet.
  */
  const gevlucht = npcs.paniek(origin.x, origin.z, PANIEK_SCHOT);
  if (gevlucht) {
    const hoeveel = Math.min(2, gevlucht);
    for (let i = 0; i < hoeveel; i++) {
      setTimeout(() => geluid.kreet('schrik', 6 + Math.random() * 16), 120 + Math.random() * 260);
    }
  }
  politie.misdaad('schot', origin.x, origin.z);
  raycaster.set(origin, dir); raycaster.far = 120;
  /*
   Niet op je eigen auto schieten. Zat je erin, dan begon de kogel bij je hoofd
   en raakte hij als eerste de binnenkant van je eigen dak of motorkap — je
   schoot je eigen auto (en de vrachtwagen van de missie) aan gort van binnenuit
   (melding 20 sep 2026). Het voertuig waar je in zit gaat daarom uit de lijst
   met doelen; de kogel vliegt er gewoon doorheen naar buiten.
  */
  const eigen = player.inCar && player.inCar.mesh ? player.inCar.mesh : null;
  const targets = [...vehicles.doelen(), ...npcs.targets, ...verhaal.doelen(), ...politie.doelen(),
    ...(politieboot ? politieboot.doelen() : [])].filter(o => !eigen || o !== eigen);
  const hits = raycaster.intersectObjects(targets, true);
  if (hits.length) {
    const h = hits[0];
    /*
     Geen meldingen meer bij een treffer ("Raak!", "Agent neer!"): je ziet het
     gebeuren en het balkje stond er voortdurend (melding beta-test 12 sep 2026).
     Wat er wél bij komt is een kreet — dat vertelt hetzelfde zonder tekst.
    */
    /*
     Hoeveel kogels deze persoon nodig heeft hangt aan het wapen in je hand:
     één met de sniper, twee met het machinegeweer, en met het pistool één of
     twee (js/player.js, `dodelijk`). Het slachtoffer onthoudt dat getal, dus
     een tweede kogel maakt het af en trekt niet opnieuw.
    */
    const nodig = player.kogelsNodig();
    const raakMens = npcs.hit(h.object, h.instanceId, nodig);
    let raakAgent = null, raakVerhaal = false;
    if (raakMens) {
      geluid.raak();
      geluid.kreet('pijn', afstandTot(h.point));
      bloedBij(h.point, dir, raakMens);
      if (raakMens.neer) {
        politie.misdaad('neergeschoten', h.point.x, h.point.z);
        // wat iemand op zak had: vaak niets, hooguit een tientje (js/buit.js)
        buit.laatVallen('geld', h.point.x, h.point.z, zakgeld());
      }
    } else if ((raakAgent = politie.raak(h.object, nodig))) {
      geluid.raak(); geluid.kreet('pijn', afstandTot(h.point));
      bloedBij(h.point, dir, raakAgent);
      // een agent draagt munitie bij zich: drie tot vijftien kogels, en die
      // passen in elk wapen
      if (raakAgent.neer) buit.laatVallen('kogels', h.point.x, h.point.z, agentMunitie());
    }
    /*
     De helikopter. Twintig kogels en hij gaat tollend naar beneden
     (js/helikopter.js). Hij staat vóór de auto's in de rij, want anders zou een
     treffer in de romp ook nog als "op een auto geschoten" tellen.
    */
    else if (politie.raakHeli(h.object)) {
      schok(0.25);
    }
    /*
     De politieboot en de twee agenten aan boord. Ze staan hier vóór de auto's,
     net als de helikopter, anders telt een kogel in de romp ook nog als "op een
     auto geschoten". Een agent aan boord is een agent: dat kost je net zoveel
     verdenking als een agent op straat.
    */
    else if (politieboot && politieboot.raakAgent(h.object)) {
      geluid.raak(); geluid.kreet('pijn', afstandTot(h.point));
      bloedBij(h.point, dir, { neer: true, x: h.point.x, z: h.point.z });
      politie.misdaad('agent', h.point.x, h.point.z);
    }
    else if (politieboot && politieboot.raak(h.object)) {
      geluid.klap();
      politie.misdaad('schot', h.point.x, h.point.z);
    }
    else if ((raakVerhaal = verhaal.raak(h.object))) {
      geluid.raak(); geluid.kreet('pijn', afstandTot(h.point));
      bloedBij(h.point, dir, { neer: true, x: h.point.x, z: h.point.z });
    }
    else {
      /*
       Op een auto schieten. Een politieauto gaat eerst langs js/politie.js: die
       telt de schade en zet meteen de melding uit — er wordt op ons geschoten en
       we weten vanwaar. Tien kogels en hij vliegt in brand.
      */
      const politiewagen = politie.raakWagen(h.object, 10);
      const car = politiewagen || vehicles.hit(h.object, h.instanceId);
      if (car) {
        geluid.klap();
        if (Math.random() < 0.4) geluid.glas();     // een ruit die het begeeft
        if (car.hp <= 0 && !car.wrak) {
          vehicles.laatOntploffen(car);
          if (politiewagen) politie.wagenOp(car);
          autoOntploft(car);
        }
      }
    }
    /*
     Het wolkje op de plek van de inslag. Op blik en glas slaat een vonk af, op
     steen en hout blijft het bij stof.

     Op een mens komt er niets meer bij: daar staat sinds 20 september de spat
     bloed, en het grijze stofwolkje legde zich er precies overheen — op de foto
     werd de rode spat daardoor een bleke vlek. Eén ding per treffer is genoeg.
    */
    const opMens = raakMens || raakAgent || raakVerhaal;
    if (!opMens) toonInslag(h.point, true, 1);
  }
};

/*
 Wat een ontploffing verder losmaakt: een knal die de buurt laat schrikken en de
 politie op de plek afstuurt, en schade voor wie er te dicht bij staat.
*/
function autoOntploft(car) {
  const d = Math.hypot(player.pos.x - car.x, player.pos.z - car.z);
  geluid.explosie(d);
  geluid.glas();
  npcs.paniek(car.x, car.z, 34);
  politie.hoorSchot(car.x, car.z);
  politie.misdaad('schot', car.x, car.z);
  /*
   Schudden naar afstand. Dit liep lineair uit tot veertig meter, en daardoor
   kreeg een knal een straat verderop nog een flinke duw mee terwijl je hem
   nauwelijks hoorde (punt 12 van 13 sep 2026). Nu telt het kwadraat: naast de
   auto voel je alles, op twintig meter nog een kwart, en op zestig meter niets
   meer — dezelfde vorm als waarmee het geluid uitdooft.
  */
  const nabij = Math.max(0, 1 - d / 60);
  if (nabij > 0) schok(1.2 * nabij * nabij);
  // wie het ziet gebeuren schreeuwt
  for (let i = 0; i < 3; i++) geluid.kreet('schrik', d + i * 6);
  if (d < 9) {
    player.health -= Math.round(38 * (1 - d / 9));
    hud.zetLeven(player.health); hud.flits();
  }
}

// In- en uitstappen
let derdeTeVoet = false;     // stond de camera te voet al achter je?
function toggleCar() {
  if (!player.active) return;
  if (player.inCar) {
    const car = player.inCar; player.inCar = null;
    // het interieur hoort alleen te staan als je erin zit
    if (car.mesh && car.mesh.userData.binnen) car.mesh.userData.binnen.groep.visible = false;
    // buiten weer door je eigen ogen, als je te voet zo liep
    if (derde.aan && !derdeTeVoet) derde.wissel();
    vehicles.ruiten(car, true);          // buiten hoort het glas er weer in
    const side = new THREE.Vector3(Math.cos(car.yaw), 0, -Math.sin(car.yaw)).multiplyScalar(-1.6);
    player.pos.set(car.x + side.x, 0, car.z + side.z); player.yaw = car.yaw; player.pitch = 0;
    geluid.portier(); geluid.motorUit();
    hud.show('Uitgestapt');
  } else {
    const car = vehicles.nearestDriveable(player.pos.x, player.pos.z);
    if (car) {
      vehicles.maakBestuurbaar(car);   // losse wielen, remlichten, verende carrosserie
      player.inCar = car; player.carLook = 0;
      /*
       In de auto standaard de camera achter de auto: je ziet de neus, je
       achterwielen en het stuk weg eromheen, en dat stuurt een stuk prettiger.
       Hoe je te voet liep wordt onthouden, zodat je bij het uitstappen weer
       door je eigen ogen kijkt als je zo liep.
      */
      derdeTeVoet = derde.aan;
      if (!derde.aan) derde.wissel();
      derde.achterAuto(car);
      geluid.portier(); geluid.motorAan();
      /*
       Elke auto heeft zijn eigen radio. Stap je in een ándere auto, dan begint
       een doorlopende zender ergens willekeurig in de uitzending; stap je weer
       in dezelfde, dan loopt hij door waar hij was. Het logo komt kort in beeld.
      */
      toonZenderLogo(geluid.radioInstap(car.id ?? car.uuid ?? vehicles.cars.indexOf(car)));
      hud.show('Ingestapt – W om te rijden · V voor de camera vanuit je ogen', 3);
    }
  }
}

// Voetgangers aanrijden: js/vehicles.js roept dit aan voor drie punten langs de
// auto zodra hij hard genoeg gaat.
function aanrijden(x, z, straal, snelheid) {
  // een agent aanrijden telt net zo hard als hem neerschieten (js/politie.js)
  const blauw = politie.aanrijden(x, z, straal, snelheid);
  if (blauw) {
    geluid.klap();
    geluid.kreet('pijn', Math.hypot(player.pos.x - x, player.pos.z - z));
    npcs.paniek(x, z, PANIEK_KLAP);
    schok(0.5 + Math.min(0.5, snelheid / 26));
  }
  const n = npcs.aanrijden(x, z, straal, snelheid);
  if (n) {
    geluid.klap();
    geluid.kreet('pijn', Math.hypot(player.pos.x - x, player.pos.z - z));
    npcs.paniek(x, z, PANIEK_KLAP);   // wie het ziet gebeuren rent weg
    politie.misdaad('aangereden', x, z);
    schok(0.45 + Math.min(0.5, snelheid / 26));
  }
  return n;
}

// Camera wisselen tussen eerste en derde persoon.
function wisselCamera() {
  if (!player.active && !window.__autoplay) return;
  const aan = derde.wissel();
  if (aan && player.inCar) derde.achterAuto(player.inCar);
  hud.show(aan ? 'Camera achter je' : 'Camera vanuit je ogen', 1.6);
}
window.addEventListener('keydown', e => {
  if (e.code === 'KeyV' && !e.ctrlKey && !e.metaKey) wisselCamera();
});
// E doet vier dingen, in deze volgorde: een gesprek doorklikken, iemand
// aanspreken die naast je staat, door de voordeur van Molenkrite 15 gaan, en
// anders in- of uitstappen bij een auto.
function praatOfAuto() {
  if (!player.active && !window.__autoplay) return;   // op het startscherm niet
  if (verhaal.toets()) return;
  for (const r of binnenruimtes) if (r.toets()) return;
  if (toggleBoot()) return;
  toggleCar();
}

/*
 In- en uitstappen bij een boot. Zit je erin, dan brengt E je aan wal; sta je
 naast een sloep en niet in een auto, dan stap je in. Staat er geen boot naast
 je, dan geeft dit niets terug en gaat E gewoon door naar de auto.
*/
function toggleBoot() {
  if (!boten) return false;
  if (boten.inBoot) {
    if (!boten.stapUit()) return true;            // te ver van de kant: E doet verder niets
    if (derde.aan && !derdeTeVoet) derde.wissel();
    hud.show('Uitgestapt', 2);
    return true;
  }
  if (player.inCar) return false;                 // eerst uit de auto
  const boot = boten.dichtstbij(player.pos.x, player.pos.z);
  if (!boot) return false;
  /*
   Een boot pak je van verder weg dan een auto (je staat op de kade, hij ligt in
   het water), en daardoor kan hij een auto wegkapen die vlak naast je staat.
   Staat er een bestuurbare auto dichterbij, dan wint die.
  */
  const auto = vehicles.nearestDriveable(player.pos.x, player.pos.z);
  if (auto && Math.hypot(auto.x - player.pos.x, auto.z - player.pos.z)
    < Math.hypot(boot.x - player.pos.x, boot.z - player.pos.z)) return false;
  boten.stapIn(boot);
  derdeTeVoet = derde.aan;
  if (!derde.aan) derde.wissel();
  player.yaw = boot.yaw; player.pitch = -0.08;
  hud.show('Aan boord – W om te varen · E om aan wal te gaan', 4);
  return true;
}
window.addEventListener('keydown', e => {
  if (e.code === 'KeyE' && !e.ctrlKey && !e.metaKey) praatOfAuto();
});

/*
 De cijfers 1 tot en met 4 kopen aan de toonbank bij Tinga State het artikel met
 dat nummer: kogels, een verbandtrommel, een pistool, een machinegeweer. F doet
 nog steeds het machinegeweer, want daar zat hij op.

 Het gaat rechtstreeks naar de boerderij en niet langs `binnenruimtes`: de
 andere ruimtes kennen alleen E en zouden op een cijfer hun eigen deur opendoen.
*/
window.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.shiftKey) return;   // shift+cijfer kiest een missie
  if (!player.active && !window.__autoplay) return;
  if (!boerderij.toets) return;
  if (e.code === 'KeyF') { boerderij.toets('F'); return; }
  const cijfer = /^Digit([1-9])$/.exec(e.code) || /^Numpad([1-9])$/.exec(e.code);
  if (cijfer) boerderij.toets(cijfer[1]);
});

/*
 ---------- een missie los starten (testfase) ----------

 Om missie 7 te bekijken hoefde je niet eerst zes missies te spelen (verzoek
 21 sep 2026). Elke missie is los te beginnen:

   shift + 1 … shift + 9   in het spel, en shift + 0 voor missie 10
   index.html?missie=bom   bij het starten

 Twee ingangen, want de Windows-app heeft geen adresbalk. Het verhaal ruimt
 daarbij zelf op wat er van de vorige missie nog stond (zie `startMissie` in
 js/verhaal.js); hier gaan alleen de sterren eraf, want met de politie achter
 je aan begint geen enkele missie prettig.

 Dit is gereedschap voor de testfase. Is het spel af, dan kan dit blok eruit —
 of achter dezelfde schakelaar als het startgeld van € 1.000.
*/
const MISSIES = [
  { nr: 1, naam: 'molenkrite', titel: 'Molenkrite 15' },
  { nr: 2, naam: 'rijden', titel: 'naar de waterzuivering' },
  { nr: 3, naam: 'bewaking', titel: 'de bewaking' },
  { nr: 4, naam: 'afleveren', titel: 'afleveren bij de boerderij' },
  { nr: 5, naam: 'johan', titel: 'het telefoontje van Johan' },
  { nr: 6, naam: 'bx', titel: 'de groene BX' },
  { nr: 7, naam: 'bom', titel: 'de bom bij de Poiesz' },
  { nr: 8, naam: 'sniper', titel: 'de deal bij de molen' },
  { nr: 9, naam: 'huis', titel: 'een eigen stek' },
  { nr: 10, naam: 'veteraan', titel: 'De Veteraan' },
];
function startMissieLos(naam) {
  const m = MISSIES.find(x => x.naam === naam || String(x.nr) === String(naam));
  if (!m || !verhaal.startMissie) return false;
  politie.reset();
  if (politieboot) politieboot.reset();
  verhaal.startMissie(m.naam);
  hud.show(`Missie ${m.nr} — ${m.titel}`, 3.5);
  return true;
}
/*
 1, 2 en 3 zonder shift: de keuze uit de drie woningen van missie 9. Mark noemt
 ze in de gespreksbalk met adres en bedrag, en de navigatie gaat naar wat je
 kiest (verzoek 23 sep 2026). Buiten die missie doen de cijfers niets.
*/
window.addEventListener('keydown', e => {
  if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
  if (!player.active && !window.__autoplay) return;
  const k = /^Digit([123])$/.exec(e.code) || /^Numpad([123])$/.exec(e.code);
  if (!k || !verhaal.kiesHuis) return;
  if (verhaal.kiesHuis(+k[1])) e.preventDefault();
});
window.addEventListener('keydown', e => {
  if (!e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
  if (!player.active && !window.__autoplay) return;
  // op de toetscode en niet op de letter: shift+1 geeft op een Nederlands
  // toetsenbord een '!' en op een ander een '1'
  const cijfer = /^Digit([0-9])$/.exec(e.code) || /^Numpad([0-9])$/.exec(e.code);
  if (!cijfer) return;
  e.preventDefault();
  // de nul staat achter de negen op het toetsenbord, dus die is missie 10
  startMissieLos(cijfer[1] === '0' ? '10' : cijfer[1]);
});

/*
 Het wapenicoon: draai je met het scrollwiel naar een ander wapen, dan staat er
 twee tellen een tekening van dat wapen rechtsonder. Hetzelfde idee als het
 zenderlogo hierboven.
*/
function toonWapenIcoon(soort) {
  hud.toonWapen(wapenIcoon(soort).image);
}
player.wisselCb = toonWapenIcoon;

/*
 H terwijl het wapen nog op slot zit. Aan het begin van een nieuw spel loopt
 Erik zonder wapen rond tot hij bij het gezelschap aan de Molenkrite staat; druk
 je dan toch op H, dan hoor je waaróm er niets gebeurt in plaats van dat de
 toets dood aanvoelt.
*/
window.addEventListener('keydown', e => {
  if (e.code !== 'KeyH' || e.ctrlKey || e.metaKey) return;
  if (!player.active || !player.wapenSlot) return;
  hud.show('Erik houdt zijn wapen weg — eerst met Mark mee', 3);
});

/*
 K: je eigen plek, in het berichtbalkje én op het klembord. Bedoeld om plekken
 door te geven — waar een onzichtbare muur moet komen, waar een wegblokkade
 hoort, waar een object moet staan. De grote kaart (M) laat dezelfde twee
 getallen linksonder zien, voor op de telefoon.
*/
window.addEventListener('keydown', e => {
  if (e.code !== 'KeyK' || e.ctrlKey || e.metaKey) return;
  const p = player.inCar || player.pos;
  const tekst = `${(p.x).toFixed(1)}, ${(p.z).toFixed(1)}`;
  hud.show(`plek ${tekst} — staat op het klembord`, 3);
  if (navigator.clipboard) navigator.clipboard.writeText(tekst).catch(() => {});
  console.log('plek', tekst);
});

/*
 P: welk pand kijk je aan. Hetzelfde idee als K, maar dan het gebouw in plaats
 van de plek — met het BAG-pandnummer voorop, want dat is de sleutel waarmee een
 pand in data/stijl/straten.json een eigen stijl krijgt.

 Dit is er gekomen omdat een plek niet genoeg is. "Het grote pand langs de
 rondweg" waren er twee, en de Ranzijn-stijl kwam op de verkeerde te staan
 (20 sep 2026). Met P is daar niets meer aan te raden.
*/
let wijzer = null;
window.addEventListener('keydown', e => {
  if (e.code !== 'KeyP' || e.ctrlKey || e.metaKey) return;
  if (!KAART) { hud.show('geen kaart geladen', 2); return; }
  if (!wijzer) wijzer = maakPandWijzer(KAART);
  // in de auto kijk je met dezelfde yaw rond; alleen de plek is die van de auto
  const p = player.inCar || player.pos;
  const raak = wijzer.zoek(p.x, p.z, player.yaw);
  const regel = pandRegel(raak);
  if (!regel) { hud.show('geen pand in zicht', 2); return; }
  hud.show(`${regel} — staat op het klembord`, 8);
  if (navigator.clipboard) navigator.clipboard.writeText(regel).catch(() => {});
  console.log('pand', regel, `(${raak.hoe}, ${raak.afstand.toFixed(1)} m)`);
});

// Scherpte wisselen (G). Blijft bewaard, zodat je hem maar één keer hoeft te zetten.
window.addEventListener('keydown', e => {
  if (e.code !== 'KeyG' || e.ctrlKey || e.metaKey) return;
  scherpte = SCHERPTE_RIJ[(SCHERPTE_RIJ.indexOf(scherpte) + 1) % SCHERPTE_RIJ.length];
  localStorage.setItem('tinga.scherpte', scherpte);
  renderer.setPixelRatio(pixelVerhouding(scherpte));
  resize();
  hud.show(`Scherpte: ${scherpte} (${pixelVerhouding(scherpte).toFixed(2)}×)`, 2);
});

/*
 De radiozender: met de pijltjes naar links en rechts wissel je van zender
 zolang je achter het stuur zit. Sturen doe je met A en D — de pijltjes deden
 dat in de auto ook, en die taak nemen ze hier over; te voet blijven ze gewoon
 zijwaarts lopen.
*/
function toonZenderLogo(z) {
  if (!z) return;
  const doek = (z.logo === 'spannenburg' ? bordSpannenburg() : logoTinga()).image;
  hud.toonZender(doek);
}
window.addEventListener('keydown', e => {
  if (!player.inCar || e.ctrlKey || e.metaKey) return;
  if (e.code !== 'ArrowLeft' && e.code !== 'ArrowRight') return;
  e.preventDefault();
  toonZenderLogo(geluid.zenderWissel(e.code === 'ArrowRight' ? 1 : -1));
});

// Geluid uit en aan
let stil = false;
window.addEventListener('keydown', e => {
  if (e.code !== 'KeyU' || e.ctrlKey || e.metaKey) return;
  stil = !stil; geluid.demp(stil); menu.zetGeluid(!stil);
  hud.show(stil ? 'Geluid uit' : 'Geluid aan', 1.8);
});

// ---------- Starten, pauzeren en muisbesturing ----------
// Het spel hangt niet af van muisvergrendeling. Lukt die niet, bijvoorbeeld
// omdat de browser hem blokkeert of de pagina in een frame staat, dan kijk je
// rond door te slepen met de linkerknop en is een korte klik een schot.
let dragHint = false;

// Op een aanraakscherm is er geen muis om vast te zetten: dan verschijnt er een
// joystick links en veeg je rechts om rond te kijken.
const touch = IS_TOUCH ? initTouchControls(player, {
  onCar: praatOfAuto,
  onMap: () => hud.kaartStap(),
  onPause: () => pauseGame(),
  onCamera: wisselCamera,
  onWapen: () => { const s = player.kiesWapen(1); if (s) toonWapenIcoon(s); },
}) : null;

/*
 Het spel beginnen. `vervolg` betekent: een opgeslagen spel laden. `metIntro`
 staat alleen aan bij de allereerste start van een nieuw spel — dan draait
 eerst het filmpje (js/intro.js) en zit het wapen op slot tot het verhaal het
 vrijgeeft. Na Esc → Doorgaan komt hij hier ook langs, en dan hoort er geen
 filmpje meer te komen.
*/
async function startGame(vervolg = false, metIntro = false) {
  if (vervolg) laadSpelNu();
  gepauzeerd = false;
  menu.verbergMenu();
  geluid.start();
  geluid.pauzeer(false);
  geluid.laadRadio();                      // muziek voor de autoradio, als die er is
  geluid.laadMissieMuziek();               // en de spanningsmuziek onder de missies
  /*
   De muis vastzetten (of op een telefoon: volledig scherm) gebeurt vóór het
   filmpje en niet erna. Een browser geeft die twee dingen alleen op vertoon van
   een verse klik of toetsaanslag, en dat is de Enter waarmee je net het
   laadscherm doorklikte. Na twintig seconden film is die toestemming verlopen
   en zou je in het sleepmodus-vangnet belanden.
  */
  if (touch) volledigScherm(); else vergrendelMuis();
  if (metIntro && !vervolg) {
    uitleg.reset();
    // Erik loopt zonder wapen rond tot hij bij het gezelschap staat
    player.wapenUit = true;
    player.wapenSlot = true;
    const kruis = document.getElementById('crosshair');
    if (kruis) kruis.style.display = 'none';
    await intro.speelIntro({ camera, KAART, start: beginpunt, geluidAan: !stil, wapen: player.gun });
  }
  player.active = true;
  /*
   En Mark begint meteen te praten. Een nieuw spel begon met een stilstaand
   beeld van je broer en de vraag of je toevallig E zou indrukken; nu neemt hij
   zelf het woord (verzoek 20 sep 2026). Bij een vervolg niet: daar sta je
   midden in een missie.
  */
  if (!vervolg) verhaal.beginGesprek(metIntro ? 1.4 : 0.8);
  /*
   ?missie=bom (of ?missie=7) begint meteen bij die missie — dezelfde ingang
   als shift+7, maar dan zonder eerst het spel in te hoeven. Alleen bij een
   nieuw spel: bij een vervolg sta je al middenin iets.
  */
  const gevraagd = new URLSearchParams(location.search).get('missie');
  if (gevraagd && !vervolg && !startMissieLos(gevraagd)) {
    hud.show(`Onbekende missie: ${gevraagd}`, 4);
  }
  if (touch) {
    touch.setVisible(true);
    hud.show('Links lopen · rechts kijken', 4);
  }
}

/*
 Hoe dicht zit je bij het water, en bij de molen? Twee getallen van nul tot één
 voor de omgevingslagen in js/audio.js (verzoek 22 sep 2026).

 Water zoeken is een polygoontoets, dus dat gebeurt niet elk beeld maar twee
 keer per seconde: acht richtingen op drie afstanden rond de camera. Zit je zelf
 in een boot, dan is het antwoord altijd één — dan lig je erin.
*/
let waterT = 0, waterNu = 0;
function waterNabij(dt, x, z) {
  if (boten && boten.inBoot) return (waterNu = 1);
  waterT -= dt;
  if (waterT > 0) return waterNu;
  waterT = 0.5;
  let dichtst = 999;
  for (const r of [5, 12, 22]) {
    for (let i = 0; i < 8; i++) {
      const h = (i / 8) * Math.PI * 2;
      if (vaarbaar(x + Math.cos(h) * r, z + Math.sin(h) * r)) { dichtst = r; break; }
    }
    if (dichtst < 999) break;
  }
  waterNu = dichtst > 100 ? 0 : Math.max(0, 1 - dichtst / 26);
  return waterNu;
}

/*
 En de molen: hout kraakt alleen als je eronder staat. Houtzaagmolen De Rat
 staat in de kaart, dus de afstand is een hypotenuse en geen ingetikte cirkel.
*/
let deRat;                      // pas opzoeken als de kaart geladen is
function molenNabij(x, z) {
  if (deRat === undefined) deRat = (KAART.molens || []).find(m => /rat/i.test(m.naam || '')) || null;
  if (!deRat) return 0;
  const d = Math.hypot(x - deRat.cx, z - deRat.cz);
  return d > 45 ? 0 : 1 - d / 45;
}

// De muis vastzetten; lukt dat niet, dan kijk je rond door te slepen.
function vergrendelMuis() {
  const req = canvas.requestPointerLock({ unadjustedMovement: true });
  const fallback = () => {
    const again = canvas.requestPointerLock();
    if (again && again.catch) again.catch(() => useDragMode());
  };
  if (req && req.catch) req.catch(fallback);
  // Lukt de vergrendeling binnen een halve seconde niet, dan slepen we.
  setTimeout(() => { if (!document.pointerLockElement) useDragMode(); }, 500);
}

// Op een telefoon: volledig scherm en dwars, dat scheelt de halve browserbalk.
function volledigScherm() {
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
}

/*
 Auto's die langskomen (verzoek 20 sep 2026). Te voet hoor je het verkeer nu
 ook als het vlak langs je heen rijdt: op het moment dat een auto het dichtst
 bij is — de afstand liep terug en begint weer op te lopen — klinkt het
 bandengeluid van js/audio.js, met het volume naar de afstand en de snelheid.

 Dat "dichtst bij" is precies het moment dat je hem hoort passeren; zonder die
 voorwaarde zou elke auto in de buurt voortdurend ruis maken. Per auto wordt de
 vorige afstand onthouden, en na een passage houdt hij een paar tellen zijn
 mond zodat een file er niet als een waterval uitkomt.
*/
const langsKlok = new Map();
function langsrijders(dt) {
  if (player.inCar || !vehicles.traffic) return;
  const px = player.pos.x, pz = player.pos.z;
  for (const t of vehicles.traffic) {
    if (!t._pos || !t.mesh || !t.mesh.visible) continue;
    const d = Math.hypot(t._pos.x - px, t._pos.y - pz);
    const v = t.snelheid === undefined ? t.speed : t.snelheid;
    let st = langsKlok.get(t);
    if (!st) { st = { vorige: d, rust: 0 }; langsKlok.set(t, st); }
    if (st.rust > 0) st.rust -= dt;
    // het dichtste punt: hij kwam dichterbij en gaat nu weer weg
    if (d < 26 && v > 2.5 && st.rust <= 0 && d > st.vorige) {
      geluid.passeer(d, v);
      st.rust = 2.5;
    }
    st.vorige = d;
  }
}

function useDragMode() {
  if (dragHint) return;
  dragHint = true;
  hud.show('Sleep met de linkermuisknop om rond te kijken', 5);
}

function pauseGame() {
  if (gepauzeerd) return;
  player.active = false;
  if (touch) touch.setVisible(false);
  /*
   De twee balkjes die zeggen wat je hier kunt doen — de hint bij een deur en
   het schap aan de toonbank van Tinga State — worden elk beeld door de module
   zelf gezet. Maar de hoofdlus staat stil zolang je in het menu staat, dus dan
   wordt er niets meer gezet en bleven ze onderin het scherm staan: je kocht
   iets, drukte op Esc, en de kaartjes van het schap stonden er nog. Hier gaan
   ze uit; komt de lus weer op gang, dan zet de module ze meteen weer neer als
   je nog steeds aan de toonbank staat.
  */
  for (const id of ['praat', 'schap']) {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  }
  gepauzeerd = true;
  // Zonder dit bromt de motor door zolang je in het menu staat: de oscillator
  // loopt door en `motorToeren` wordt niet meer aangeroepen, dus hij blijft op
  // zijn laatste stand hangen (melding beta-test 12 sep 2026).
  geluid.pauzeer(true);
  menu.toonMenu({ pauze: true, heeftOpslag: !!opslagInfo() });
  wachtOpMenu(true);
}

/*
 Wachten tot er in het menu iets gekozen wordt, en dat uitvoeren. Bij het
 opstarten gaat het om Start spel of Spel laden; na Esc komt Doorgaan erbij.
 Bij Spel laden komt het laadscherm er nog even voor — niet omdat het laden lang
 duurt (de wereld staat er dan al), maar omdat je anders midden in de wijk
 gepootd wordt zonder dat je weet dat er iets gebeurd is.
*/
async function wachtOpMenu(pauze = false) {
  const wat = await menu.volgendeKeuze();
  if (wat === 'doorgaan') { startGame(false); return; }
  const balk = menu.toonLaadscherm();
  balk(0.15, wat === 'laden' ? 'opgeslagen spel' : 'nieuw spel');
  await new Promise(r => setTimeout(r, 260));
  balk(1, 'klaar');
  await new Promise(r => setTimeout(r, 240));
  await menu.wachtOpStart();          // ook hier eerst op enter wachten
  if (pauze && wat === 'nieuw') { location.reload(); return; }   // nieuw spel vanuit de pauze
  startGame(wat === 'laden', wat !== 'laden');
}

/*
 Afsluiten. In een tabblad mag `window.close()` alleen als de pagina zelf met een
 script is geopend, dus dat lukt meestal niet; in de bureaubladversie (Electron)
 wel. Lukt het niet, dan zeggen we eerlijk dat je het venster zelf kunt sluiten
 in plaats van te doen alsof er iets gebeurt.
*/
function afsluiten() {
  if (player.active) pauseGame();
  geluid.demp(true);
  window.close();
  setTimeout(() => {
    const w = document.getElementById('overlay');
    if (!w) return;
    w.innerHTML = '<div class="menupaneel"><h1>TOT ZIENS</h1>'
      + '<div class="menuonder">Je kunt dit venster nu sluiten</div></div>';
  }, 220);
}

// ---------- Opslaan en laden ----------
// Eén opslagplek: F5 bewaart, F9 zet terug. Staat er iets, dan biedt het menu
// 'Spel laden' aan; anders begin je als Erik voor Molenkrite 15.
let gepauzeerd = false;

function bewaarSpelNu() {
  const gelukt = bewaarSpel({
    player, sfeer, vehicles, verhaal, boten, vaart,
    straat: nearestRoadName(camera.position.x, camera.position.z),
  });
  hud.show(gelukt ? 'Spel opgeslagen' : 'Opslaan lukte niet', 2);
}

function laadSpelNu() {
  politie.reset();          // een opgeslagen spel begint zonder achtervolging
  if (politieboot) politieboot.reset();
  const gelukt = laadSpel({ player, sfeer, vehicles, verhaal, boten, vaart });
  hud.show(gelukt ? 'Spel geladen' : 'Er is nog geen opgeslagen spel', 2.5);
  return gelukt;
}

window.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.code === 'F5') { e.preventDefault(); bewaarSpelNu(); }
  else if (e.code === 'F9') { e.preventDefault(); laadSpelNu(); }
});

window.addEventListener('keydown', e => {
  if (e.code !== 'Escape') return;
  if (player.active && !document.pointerLockElement) pauseGame();
});

/*
 De instellingen in het menu. Ze staan hier en niet in js/menu.js, want ze gaan
 over het spel: de scherpte, het geluid, het weer en de klok. Elke regel is een
 naam, wat er nu staat, en wat er gebeurt als je erop klikt.
*/
const WEER_RIJ = ['helder', 'bewolkt', 'regen'];
menu.zetInstellingen(() => [
  {
    id: 'scherpte', naam: 'Scherpte',
    waarde: () => `${scherpte} (${pixelVerhouding(scherpte).toFixed(2)}×)`,
    volgende: () => {
      scherpte = SCHERPTE_RIJ[(SCHERPTE_RIJ.indexOf(scherpte) + 1) % SCHERPTE_RIJ.length];
      localStorage.setItem('tinga.scherpte', scherpte);
      renderer.setPixelRatio(pixelVerhouding(scherpte));
      resize();
    },
  },
  { id: 'geluid', naam: 'Geluid', waarde: () => (stil ? 'uit' : 'aan'), volgende: () => { stil = !stil; geluid.demp(stil); menu.zetGeluid(!stil); } },
  {
    id: 'weer', naam: 'Weer', waarde: () => sfeer.weer,
    volgende: () => { sfeer.weer = WEER_RIJ[(WEER_RIJ.indexOf(sfeer.weer) + 1) % WEER_RIJ.length]; },
  },
  {
    id: 'camera', naam: 'Camera', waarde: () => (derde.aan ? 'achter je' : 'vanuit je ogen'),
    volgende: () => { derde.wissel(); if (derde.aan && player.inCar) derde.achterAuto(player.inCar); },
  },
  {
    id: 'klok', naam: 'Klok', waarde: () => `${String(Math.floor(sfeer.uur)).padStart(2, '0')}:${String(Math.round(sfeer.uur % 1 * 60)).padStart(2, '0')}`,
    volgende: () => { sfeer.uur = (sfeer.uur + 1) % 24; },
  },
]);
document.addEventListener('pointerlockchange', () => {
  // Esc geeft de muis vrij; dan pauzeren we ook echt.
  if (!document.pointerLockElement && player.active && !dragHint) pauseGame();
});

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);
// draaien van de telefoon meldt zich soms pas na de resize
window.addEventListener('orientationchange', () => setTimeout(resize, 250));

// Sfeer: tijd van de dag, weer, wind, stromend water en straatverlichting
/*
 Gras in 3D rond de speler (js/groen.js): pollen op het gazon binnen 26 m,
 bijgewerkt met de LOD. Alleen op gras en bodembedekker, niet in de platte
 kaart of het bovenaanzicht. Het materiaal waait mee (js/sfeer.js), dus het
 moet vóór initSfeer bestaan.
*/
const grasVeld = (KAART && !BOVEN) ? maakGrasVeld(scene,
  (x, z) => { const v = vlakOp(x, z); return !!(v && (v.m === 'gras' || v.m === 'bodembedekker')); },
  (x, z) => { const v = vlakOp(x, z); return v ? v.y : 0; }) : null;
if (grasVeld) waaitMee(grasVeld.mat);

const sfeer = initSfeer({
  scene, camera, renderer, sun, hemi, fill, skyUniforms, hud,
  zonRichting: SUN_DIR,
  // de wolken kleuren mee met het licht (zie js/sfeer.js)
  wolken: clouds.map(l => l.mesh.material),
});

// Hoofdlus
let last = performance.now(); let time = 0; let lodKlok = 0;
let laatsteRadio = null;     // welk nummer er als laatste in het balkje stond
let stekRadio = false;       // staat de radio in een van de woningen aan (missie 9)
// Afstand tot de dichtstbijzijnde radio in de wijk; audio.js bepaalt daarmee
// het volume. Null als er geen radio staat.
function afstandTotRadio(x, z) {
  let best = null;
  for (const r of radioPlekken) {
    const d = Math.hypot(x - r.x, z - r.z);
    if (best == null || d < best) best = d;
  }
  return best;
}

function loop() {
  requestAnimationFrame(loop);
  /*
   Het reliëf aanvullen: vier milliseconde per beeld, en twaalf zolang het spel
   stilstaat (menu, laadscherm, pauze) — dan is er tijd genoeg.
  */
  if (reliëf) {
    const t = performance.now();
    const grens = t + (player.active ? 4 : 12);
    let r;
    do { r = reliëf.next(); } while (!r.done && performance.now() < grens);
    reliëfMs += performance.now() - t;
    if (r.done) {
      meldReliëf(r.value);
      reliëf = null;
    }
  }
  const now = performance.now(); const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
  if (player.active || window.__autoplay) {
    player.update(dt);
    /*
     De boten. Ook als je er niet in zit deinen ze mee met het water, dus dit
     staat vóór de keuze tussen te voet, in de auto en aan boord; alleen de
     stuurinvoer gaat er alleen heen als je er zelf in staat.
    */
    if (boten) boten.update(dt, boten.inBoot ? player.driveInput() : null);
    if (player.inCar) {
      const car = player.inCar;
      vehicles.drive(car, player.driveInput(), dt, aanrijden);
      geluid.motorToeren(car.speed, car.topSnelheid || 24);
      geluid.gier(car.gierNiveau || 0);
      if (car.botsKracht) {
        geluid.klap();
        schok(0.35 + Math.min(0.85, car.botsKracht / 16));
        car.botsKracht = 0;
      }
      // een schutting of heg die het begeeft: hout, geen blik, en een lichte tik
      if (car.brakKracht) {
        geluid.kraak();
        schok(0.18 + Math.min(0.2, car.brakKracht * 0.05));
        car.brakKracht = 0;
      }
      /*
       Een lantaarnpaal omver rijden. De neus van de auto is het punt dat hem
       raakt, dus daar wordt gekeken; de paal valt in de richting waarin je reed.
      */
      if (Math.abs(car.speed) > 5) {
        const nx = car.x - Math.sin(car.yaw) * ((car.as || 1.4) + 0.5);
        const nz = car.z - Math.cos(car.yaw) * ((car.as || 1.4) + 0.5);
        if (raakLantaarn(nx, nz, car.rij, car.speed)) {
          geluid.klap(); geluid.glas();
          schok(0.5);
          car.speed *= 0.7;
        }
      }
      // yaw van speler volgt de auto (relatief kijken), zodat de camera vanzelf
      // achter de auto blijft hangen
      if (player.lastCarYaw !== undefined) player.yaw += car.yaw - player.lastCarYaw;
      player.lastCarYaw = car.yaw;
      /*
       De eerste keer dat je in een auto zit: wat er in een auto anders is dan
       te voet (verzoek 20 sep 2026). Eén keer per spel, en hij loopt vanzelf
       weer weg — zie js/uitleg.js.
      */
      uitleg.toon('auto', 'In de auto',
        '<kbd>←</kbd><kbd>→</kbd> andere radiozender · <kbd>V</kbd> camera vanuit je ogen of achter de auto', 10);
      /*
       De koplampen aan als het donker is. De spot staat op de neus van de auto
       en kijkt twintig meter vooruit naar de grond — daar ligt de plas licht.

       Hij hangt op 1,9 m en niet op de 0,62 m van een echte koplamp, en dat is
       geen slordigheid maar het verschil tussen wél en niet te zien. Vanaf
       koplamphoogte strijkt de bundel zo scheer over het asfalt dat de cosinus
       van de invalshoek er bijna alles van opeet: gemeten aan het beeld was het
       strookje weg vóór de motorkap 90,2 met lamp en 83,8 zonder — zeven
       procent, niets dus. Vanaf 1,9 m valt hij schuiner in en is datzelfde
       strookje 111 tegen 84. De lamp zelf zie je niet, alleen wat hij verlicht,
       dus die hoogte kost niets.
      */
      if (sfeer && sfeer.nacht) {
        const vx = -Math.sin(car.yaw), vz = -Math.cos(car.yaw);
        const neus = (car.as || 1.4) + 0.6;
        koplamp.position.set(car.x + vx * neus, (car.mesh ? car.mesh.position.y : 0) + 1.9, car.z + vz * neus);
        koplamp.target.position.set(car.x + vx * 20, -0.1, car.z + vz * 20);
        koplamp.target.updateMatrixWorld();
        // ook de sterkte is uitgemeten en niet op gevoel gekozen; zie hierboven
        koplamp.intensity = 300;
        if (!koplamp.visible) koplamp.visible = true;
      } else if (koplamp.visible) { koplamp.visible = false; koplamp.intensity = 0; }
      /*
       Het interieur: alleen zichtbaar als je erin zit en vanuit je ogen kijkt.
       Met de camera over je schouder zou je door het dak heen tegen de
       binnenkant van het dashboard aankijken.
      */
      const binnen = car.mesh && car.mesh.userData.binnen;
      if (binnen) {
        binnen.groep.visible = !derde.aan;
        if (!derde.aan) binnen.update(car, dt);
      }
      if (!derde.update(dt, car)) {
        // camera op de bestuurdersstoel (links), meekijken met muis; een
        // bakwagen heeft zijn eigen, hogere stoel (zie vehicles.voegToe).
        // De ruiten gaan uit zolang je erachter zit: het glas is van buiten
        // donker getint, en van binnen keek je door twee van die vlakken naar
        // buiten — de hele voorruit werd een grauwe plaat.
        vehicles.ruiten(car, false);
        const st = car.stoel || car.mesh.userData.oog || { x: -0.34, y: 1.32, z: -0.87 };
        const seat = new THREE.Vector3(st.x, st.y, st.z);
        seat.applyAxisAngle(new THREE.Vector3(0, 1, 0), car.yaw);
        camera.position.set(car.x + seat.x, (car.mesh ? car.mesh.position.y : 0) + st.y, car.z + seat.z);
        camera.rotation.set(0, 0, 0, 'YXZ');
        camera.rotation.y = player.yaw; camera.rotation.x = player.pitch;
      } else vehicles.ruiten(car, true);       // van buiten hoort het glas er wel te zitten
      /*
       Het pistool is in de auto te zien zolang je naar voren of opzij kijkt —
       dan hang je uit het raam en kun je ook schieten. Kijk je achterom, dan
       gaat hij weg: over de achterbank heen richten kan niet, en een wapen dat
       in beeld staat terwijl er niets gebeurt leest als een fout.
      */
      player.gun.visible = !player.wapenUit && !derde.aan && !player.inScope && player.magSchieten();
    } else if (boten && boten.inBoot) {
      /*
       Aan boord. Het gaat net als in de auto: de boot bepaalt waar je bent, de
       camera hangt erachter, en je kijkrichting draait met de romp mee (dat
       laatste doet js/boot.js zelf). Uit je ogen kijken kan ook — dan sta je
       achter de console, iets achter het midden van de kuip.
      */
      player.lastCarYaw = undefined;
      // uit de auto: de koplampen gaan mee uit
      if (koplamp.visible) { koplamp.visible = false; koplamp.intensity = 0; }
      const boot = boten.inBoot;
      if (!derde.update(dt, boot)) {
        // vanuit je ogen sta je achter de console; js/boot.js heeft player.pos
        // daar al neergezet, dus de ooghoogte komt er gewoon bovenop
        camera.position.set(player.pos.x, player.pos.y + player.eye, player.pos.z);
        camera.rotation.set(0, 0, 0, 'YXZ');
        camera.rotation.y = player.yaw + player.kickYaw;
        camera.rotation.x = player.pitch + player.kickPitch;
      }
      // aan boord sta je in de open lucht: het wapen mag alle kanten op — maar
      // door de kijker zie je het niet, net als te voet
      player.gun.visible = !player.wapenUit && !derde.aan && !player.inScope;
      geluid.gier(0);
    } else {
      player.lastCarYaw = undefined;
      // uit de auto: de koplampen gaan mee uit
      if (koplamp.visible) { koplamp.visible = false; koplamp.intensity = 0; }
      derde.update(dt, null);
      geluid.gier(0);
    }
    werkSporenBij(dt);
    werkInslagenBij(dt);        // de stofwolkjes van de kogelinslagen
    werkBloedBij(dt);           // de spatten en de plassen
    uitleg.update(dt);          // de eenmalige uitleg die in beeld staat
    werkLantaarnsBij(dt, player.pos.x, player.pos.z);
    // wat er op straat ligt: loop je erlangs, dan pak je het op (js/buit.js)
    buit.update(dt, player, (soort, waarde) => {
      if (soort === 'geld') {
        verhaal.verdien(waarde);
        hud.show(`€ ${waarde} opgeraapt`, 2);
      } else if (soort === 'pistool') {
        /*
         Een pistool van iemand die je hebt neergelegd. Heb je er al een, dan
         houd je het wapen dat je vasthebt en gaan alleen de kogels erin in je
         voorraad — twee pistolen dragen kan niet in dit spel.
        */
        player.reserve += waarde;
        const nieuw = !player.wapens.includes('pistool');
        if (nieuw) player.krijgWapen('pistool');
        hud.show(nieuw ? 'Pistool opgeraapt' : `Pistool opgeraapt · ${waarde} kogels`, 2.5);
      } else {
        player.reserve += waarde;
        hud.show(`${waarde} kogels opgeraapt`, 2);
      }
      geluid.raak();
    });
    vehicles.updateTraffic(dt, player, opDeWeg, camera.position.x, camera.position.z);
    npcs.update(dt, time, camera.position.x, camera.position.z);
    verhaal.update(dt);
    for (const r of binnenruimtes) r.update(dt, verhaal.aanspreekbaar);
    if (spuiterij) spuiterij.update(dt);      // de roldeuren van de wasboxen
    /*
     De politie loopt alleen buiten rond; binnen sta je stil in een andere ruimte.
     Binnen loopt de politie niet mee: je staat dan in een andere ruimte. Maar
     dan wordt `politie.update` ook niet aangeroepen, en dus ook de sirene niet
     bijgewerkt — die bleef binnen op zijn laatste stand doorloeien (melding
     beta-test 12 sep 2026). Binnen zetten we hem daarom zelf uit.
    */
    /*
     Binnen gaat ook het wapen uit beeld (verzoek 19 sep 2026). Dat staat hier
     en niet in js/player.js omdat alleen main.js alle binnenruimtes kent; de
     speler zelf hoeft er niets van te weten behalve de vlag.
    */
    player.binnen = ergensBinnen(player.pos.x, player.pos.z);
    if (player.binnen) {
      geluid.sirene(null);
      geluid.gier(0);
      geluid.heli(null);      // en de heli hoor je binnen ook niet doorklapperen
    } else {
      vehicles.werkKnallenBij(dt, player.pos.x, player.pos.z);   // vuurballen en wrakken
      let schade = politie.update(dt);
      if (politieboot) schade += politieboot.update(dt);
      if (vaart) vaart.update(dt);
      // Zonder deze twee regels merk je er niets van dat er op je geschoten
      // wordt: de levensbalk wordt alleen bijgewerkt als iemand hem bijwerkt,
      // en de rode flits komt uit js/hud.js — net als bij de bewaking op de RWZI.
      if (schade > 0) { player.health -= schade; hud.zetLeven(player.health); hud.flits(); }
      /*
       Een neergehaalde helikopter slaat ergens in de wijk in. Dat hoor en voel
       je: de camera schudt naar de afstand, de buurt rent weg en wie er vlak
       naast staat krijgt het te verduren. Dezelfde vorm als bij een auto die
       ontploft (`autoOntploft` hierboven).
      */
      const inslag = politie.heliOntploft();
      if (inslag) {
        const d = Math.hypot(player.pos.x - inslag.x, player.pos.z - inslag.z);
        const nabij = Math.max(0, 1 - d / 140);
        if (nabij > 0) schok(2.0 * nabij * nabij);
        geluid.klap();
        npcs.paniek(inslag.x, inslag.z, PANIEK_KLAP);
        for (let i = 0; i < 3; i++) geluid.kreet('schrik', d + i * 8);
        if (d < 14) {
          player.health -= Math.round(55 * (1 - d / 14));
          hud.zetLeven(player.health); hud.flits();
        }
        /*
         Hier stond 'Helikopter neergehaald'. Weg (verzoek 19 sep 2026): er valt
         een brandende helikopter uit de lucht, de grond schudt en je hoort de
         klap — een regel tekst die dat nog eens navertelt voegt niets toe en
         leest als een scorebericht. Net als bij het neerschieten en aanrijden
         van mensen laat het spel het beeld het werk doen.
        */
      }
    }
    hud.zetSterren(politie.ster, politie.gezocht);
    /*
     De blauwe stippen op de kaart. De politieboot hoort erbij — hij telt als een
     wagen, want hij is even groot en je wilt hem op de kaart net zo goed zien
     aankomen als een surveillancewagen.
    */
    const blauw = politie.gezocht ? politie.plekken : null;
    if (blauw && politieboot && politieboot.plek) blauw.push({ ...politieboot.plek, wagen: true });
    hud.zetPolitie(blauw);
    if (player.health <= 0) { politie.reset(); if (politieboot) politieboot.reset(); verhaal.dood(); }
    // zon en schaduwcamera volgen de speler
    const cx = camera.position.x, cz = camera.position.z;
    zetSchaduwDoos(cx, cz);
    updateClouds(dt, cx, cz);
    werkOmgevingBij(dt);
    sfeer.update(dt, cx, cz);
    updateProps(dt);
    langsrijders(dt);          // een auto die voorbijkomt hoor je ook
    geluid.omgeving(dt, {
      /*
       In de tuin achter het huis ben je binnen voor de kaart en de politie, maar
       buiten voor je oren: daar hoort geen kamergalm (verzoek 23 sep 2026).
      */
      weer: sfeer.weer, nacht: sfeer.nacht,
      binnen: !!player.inCar || (player.binnen && !inTuin(cx, cz)),
      water: waterNabij(dt, cx, cz), molen: molenNabij(cx, cz),
    });
    geluid.radio(afstandTotRadio(cx, cz));
    /*
     Muziek uit audio/radio/, anders het riffje. Behalve in de auto speelt hij nu
     ook in de drie woningen van missie 9: daar staat de tv aan op Radio
     Spannenburg (verzoek 22 sep 2026). Binnen zet de galmtak van vorige ronde er
     vanzelf een kamer omheen.
    */
    /*
     De radio op het dressoir (verzoek 23 sep 2026). Hij speelt alleen als je hem
     met E hebt aangezet, hij wordt zachter naarmate je verder van het kastje af
     staat, en hij gaat uit zodra je het huis uit loopt — ook als dat via de
     opslag of een teleport gaat, want dan staat hij nog aan terwijl jij weg bent.
    */
    let radioSterk = 0;
    for (const r of binnenruimtes) {
      if (!r.radioSterkte) continue;
      if (r.radioAan && !r.binnen(player.pos.x, player.pos.z)) r.zetRadio(false);
      radioSterk = Math.max(radioSterk, r.radioSterkte(player.pos.x, player.pos.z));
    }
    const radioHier = !!player.inCar || radioSterk > 0;
    if (radioSterk > 0 && !stekRadio) { geluid.zetZender('Spannenburg'); stekRadio = true; }
    if (radioSterk <= 0) stekRadio = false;
    geluid.autoradio(radioHier, player.inCar ? 1 : radioSterk);
    werkKaartvlaggenBij();
    /*
     Titel van het nummer in het balkje, net als een autoradio die het
     scherm bijwerkt. Alleen als het nummer verandert, en alleen in de auto.
    */
    if (player.inCar) {
      const nu2 = geluid.radioNummer();
      const naam = nu2 ? `${nu2.titel} — ${nu2.artiest}` : null;
      if (naam && naam !== laatsteRadio) { laatsteRadio = naam; hud.show(`♪ ${naam}`, 3.5); }
    } else laatsteRadio = null;
    lodKlok += dt;
    if (lodKlok > 0.25) { lodKlok = 0; updateLOD(cx, cz); vehicles.lod(cx, cz); if (grasVeld) grasVeld.update(cx, cz); }
    hud.update(dt, player, vehicles, npcs, straatOf(cx, cz), verhaal.aanspreekbaar);
  }
  if (!player.active && !window.__autoplay) {
    /*
     Staat het spel stil (startscherm, menu, muis vrijgegeven), dan draaien de
     wolken en de minikaart door — en moeten de binnenruimtes hun eigen
     schermwerk opruimen. Zonder deze regel werd `update` van de boerderij niet
     meer aangeroepen en bleef het schap met de wapens onderin staan zodra je
     bij de toonbank op Esc drukte; ook als je daarna wegliep (melding 20 sep
     2026). `true` betekent hier: bezet, dus alles weg.
    */
    for (const r of binnenruimtes) r.update(dt, true);
    // tijdens de intro zet js/intro.js de camera; die niet overschrijven
    if (!intro.bezig()) player.applyCamera();
    updateClouds(dt, camera.position.x, camera.position.z);
    sfeer.update(dt, camera.position.x, camera.position.z);
    npcs.update(dt, time, camera.position.x, camera.position.z);
    vehicles.updateTraffic(dt, player, opDeWeg, camera.position.x, camera.position.z);
    verhaal.update(dt);
    hud.update(dt, player, vehicles, npcs, straatOf(camera.position.x, camera.position.z), verhaal.aanspreekbaar);
  }
  // De luchtbol meeschuiven met de camera. Hij heeft een straal van 1000 m en
  // stond op de oorsprong: aan de oostkant van de wijk viel zijn achterkant
  // buiten het achtervlak van de camera (1200 m), en door dat gat keek je tegen
  // de zwarte achtergrond aan — een zwarte koepel in de lucht die met je
  // meedraaide. Meeschuiven houdt hem altijd op 1000 m.
  const kijker = window.__bovenCam || camera;
  sky.position.copy(kijker.position);
  // het achtervlak loopt met de mist mee (js/sfeer.js), dus de bol ook
  if (Math.abs(sky.scale.x - kijker.far * 0.92) > 1) sky.scale.setScalar(kijker.far * 0.92);
  /*
   De schaduwkaart om het beeld. Hij kostte gemeten 386 draw calls en bijna een
   miljoen driehoeken per beeld — een vijfde van al het tekenwerk — en dat is
   een hele pas die niets met het beeld zelf te maken heeft. Een beeld oud is
   hij nooit te zien: de doos volgt de speler, en op vijf meter per seconde
   staat hij na één beeld acht centimeter mis.

   Let op: three telt de schaduwpas niet in `renderer.info`, want `info.reset()`
   staat in `render()` ná `shadowMap.render()` (lib/three.module.js:29594 en
   :29600). Wie dit wil meten moet `info.autoReset` uitzetten en zelf resetten,
   zoals tools/optimeer.mjs doet.
  */
  schaduwBeeld++;
  renderer.shadowMap.needsUpdate = (schaduwBeeld & 1) === 0;
  // de klap van een botsing, vlak voor het tekenen op de camera gezet
  if (kijker === camera) schokCamera(kijker, dt);
  renderer.render(scene, kijker);
  if (kijker === camera && player.gun && player.gun.visible) tekenWapen();
}

/*
 Het wapen in je hand, na de wereld en eroverheen. De dieptebuffer gaat leeg,
 dus geen muur of paal kan er nog doorheen steken, en het krijgt een eigen
 voorvlak van een centimeter. Alle lampen staan ook op laag 1, zodat het wapen
 hetzelfde licht krijgt als de wereld — en dezelfde shaders, want three maakt
 een nieuw programma zodra het aantal lampen verschilt.
*/
const WAPEN_NEAR = 0.01;
let lampenOpWapenlaag = 0;
function tekenWapen() {
  if (lampenOpWapenlaag-- <= 0) {
    lampenOpWapenlaag = 120;
    scene.traverse(o => { if (o.isLight) o.layers.enable(WAPEN_LAAG); });
  }
  const oudClear = renderer.autoClear;
  renderer.autoClear = false;
  renderer.shadowMap.needsUpdate = false;
  renderer.clearDepth();
  const masker = camera.layers.mask;
  camera.layers.set(WAPEN_LAAG);
  camera.near = WAPEN_NEAR; camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  camera.layers.mask = masker;
  camera.near = CAMERA_NEAR; camera.updateProjectionMatrix();
  renderer.autoClear = oudClear;
}
opstartStap('het eerste beeld');
loop();
opstartStap('na het eerste beeld');

/*
 De wereld staat er; nu wachten we op de keuze uit het menu. Die kan al gemaakt
 zijn terwijl er nog gebouwd werd — dan staat het laadscherm er al en gaat het
 spel meteen beginnen.
*/
(async () => {
  const wat = await keuzeBelofte;
  if (!laadBalk) laadBalk = menu.toonLaadscherm();
  laadBalk(1, 'klaar');
  await new Promise(r => setTimeout(r, 400));
  await menu.wachtOpStart();          // "klik op enter om te beginnen"
  startGame(wat === 'laden', wat !== 'laden');
})();

// Testhaak voor automatische screenshots
opstartStap('klaar');
window.__game = {
  // de wapenpas en het voorvlak, voor tools/cliptest.mjs
  tekenWapen, cameraNear: CAMERA_NEAR,
  // het reliëf in één keer afmaken (de proeven), en hoever het is
  reliëfAf, get reliëfBezig() { return !!reliëf; },
  // licht (tools/lichttest.mjs): de omgeving opnieuw bakken en de schaduwdoos
  bakOmgeving, werkOmgevingBij, zetSchaduwDoos, get omgevingGebakken() { return envBakken; }, sun,
  schaduw: { map: SHADOW_MAP, r: SHADOW_R, vooruit: SHADOW_VOORUIT },
  grasVeld, wolken: clouds,
  scene, camera, player, vehicles, npcs, renderer, hud, sfeer, verhaal, interieur, woningen, boerderij, supermarkt, derde, politie,
  // de vlaggen op de kaart bijwerken; de lus doet dit zelf, de proef roept het aan
  kaartvlaggen: werkKaartvlaggenBij,
  opslaan: bewaarSpelNu, laden: laadSpelNu, praat: praatOfAuto, toggleCar, aanrijden, wisselCamera,
  geluid, pauzeer: pauseGame, hervat: startGame, schok, sporen: sporenTeller, spuiterij, boten, politieboot, vaart,
  raakLantaarn, werkLantaarnsBij, lantaarnsOm, buit,
  // het beginpunt van de speler, voor de intro en de fotogereedschappen
  start: beginpunt, intro, uitleg,
  // haken voor tools/puntentest.mjs: een knal laten afgaan en de uitslag lezen
  __ontplof: autoOntploft, __schokNul: () => { SCHOK.kracht = 0; SCHOK.t = 0; },
  __schokKracht: () => SCHOK.kracht,
  // voor tools/meldtest.mjs: hoeveel stofwolkjes van kogelinslagen er nu leven
  __inslagen: () => inslagen.filter(o => o.t > 0).length,
  // en hoeveel bloedspatten; op een mens komt er bloed in plaats van stof
  __bloed: () => spatten.filter(o => o.t > 0).length,
};

// Bovenaanzicht (?boven=1&schaal=4[&plat=1]): het hele gebied recht van boven,
// op exact `schaal` pixels per meter, met dezelfde omhullende als de kaartplaat
// uit tools/geo/plaat.mjs. tools/geo/bovenaanzicht.mjs maakt er een PNG van.
if (BOVEN && KAART) {
  const G = KAART.gebied, S = Number(URLP.get('schaal') || 4);
  const W = Math.round((G.x1 - G.x0) * S), H = Math.round((G.z1 - G.z0) * S);
  /*
   WebGL tekent niet groter dan MAX_VIEWPORT_DIMS (hier 8192 px per kant). Het
   hele gebied is op 2 px/m 8760 px breed; die ene grote opname liep stil tegen
   die grens aan. Chrome verkleint het tekenvlak dan zelf, met behoud van de
   verhouding, en rekt het beeld daarna weer uit naar de maat van het doek: de
   plaat zag er nog goed uit maar stond 7 % te groot en een paar honderd pixels
   verschoven. `geo:boven` meldde daardoor 48 % verschil terwijl er niets mis
   was met de wereld. Daarom nu in stukken van hoogstens MAX px, die
   tools/geo/bovenaanzicht.mjs weer aan elkaar plakt.
  */
  const gl = renderer.getContext();
  const vp = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
  const MAX = Math.min(renderer.capabilities.maxTextureSize, vp[0], vp[1], 8192);
  /*
   Niet alleen de zijde telt, ook het oppervlak. Op 3 px/m paste het gebied in
   twee stukken van 6570×7500 — elke kant ruim onder de 8192, maar samen 49
   megapixel. Swiftshader gaf daar zonder één foutmelding een leeg beeld op
   terug: de kaart kwam spierwit uit de molen. Onder de 16 megapixel per stuk
   gaat het goed, dus daar knippen we desnoods een rij of kolom extra voor.
  */
  const MAX_OPP = 16e6;
  let KOLOMMEN = Math.ceil(W / MAX), RIJEN = Math.ceil(H / MAX);
  while ((W / KOLOMMEN) * (H / RIJEN) > MAX_OPP) {
    if (W / KOLOMMEN >= H / RIJEN) KOLOMMEN++; else RIJEN++;
  }
  const grens = (i, n, tot) => Math.round(i * tot / n);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 600);
  ortho.up.set(0, 0, -1);            // noorden boven
  scene.fog = null;
  const plat = URLP.has('plat');
  if (plat) { renderer.toneMapping = THREE.NoToneMapping; scene.background = new THREE.Color(KLEUR.achtergrond); }
  else { scene.background = new THREE.Color(0xdfe6ee); }
  renderer.shadowMap.enabled = !plat;
  window.__bovenRaster = { W, H, kolommen: KOLOMMEN, rijen: RIJEN, max: MAX, schaal: S };
  /*
   Eén stuk van het raster. Zonder argumenten (raster 1×1) is dat het geheel.
   Met `bewaar` blijft de opname in de bladzijde staan (window.__bovenStukken)
   in plaats van als tekst mee terug te reizen naar node: bij acht stukken van
   twaalf megapixel is dat een paar honderd megabyte die anders twee keer over
   de draad gaat. Dan komt er ook een `gevuld` bij: het deel van de proefpunten
   dat niet de achtergrondkleur heeft, zodat een leeg stuk meteen opvalt.
  */
  window.__boven = (ix = 0, iy = 0, bewaar = false) => {
    const px0 = grens(ix, KOLOMMEN, W), px1 = grens(ix + 1, KOLOMMEN, W);
    const py0 = grens(iy, RIJEN, H), py1 = grens(iy + 1, RIJEN, H);
    const bw = px1 - px0, bh = py1 - py0;
    // pixelgrenzen terug naar spelmeters; beeldrij 0 is de noordkant (kleinste z)
    const wx0 = G.x0 + px0 / S, wx1 = G.x0 + px1 / S;
    const wz0 = G.z0 + py0 / S, wz1 = G.z0 + py1 / S;
    const cx = (wx0 + wx1) / 2, cz = (wz0 + wz1) / 2;
    ortho.left = -(wx1 - wx0) / 2; ortho.right = (wx1 - wx0) / 2;
    ortho.top = (wz1 - wz0) / 2; ortho.bottom = -(wz1 - wz0) / 2;
    ortho.position.set(cx, 300, cz);
    ortho.lookAt(cx, 0, cz);
    ortho.updateProjectionMatrix();
    renderer.setPixelRatio(1);
    renderer.setSize(bw, bh, false);
    // verkeer en voetgangers uit beeld
    vehicles.zichtbaarheid(false);
    for (const m of Object.values(npcs.meshes)) m.visible = false;
    npcs.fiets.visible = false;
    player.gun.visible = false;
    if (verhaal.buurman) verhaal.buurman.groep.visible = false;   // hij hoort bij de mensen
    for (const l of clouds) l.mesh.visible = false;
    if (!plat) { sun.position.set(cx + 60, 300, cz + 40); sun.target.position.set(cx, 0, cz); sun.target.updateMatrixWorld(); }
    window.__bovenCam = ortho;
    sky.position.copy(ortho.position);
    // de schaduwkaart staat op handmatig bijwerken (zie de hoofdlus); voor een
    // losse opname als deze moet hij dus zelf om een verversing vragen
    renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, ortho);
    // meteen uitlezen, in dezelfde tik als het tekenen
    const png = renderer.domElement.toDataURL('image/png');
    const stuk = { W: bw, H: bh, x: px0, y: py0, geheel: [W, H] };
    if (!bewaar) return { ...stuk, png };
    (window.__bovenStukken || (window.__bovenStukken = [])).push({ ...stuk, png });
    return { ...stuk, gevuld: proef(bw, bh) };
  };
  /*
   Hoeveel staat er op dit stuk? We lezen veertig beeldrijen uit het net
   getekende beeld en tellen welk deel van de proefpunten een andere kleur
   heeft dan het eerste punt. Nul betekent één egale vlakte: een leeg stuk.
  */
  function proef(bw, bh) {
    const rij = new Uint8Array(bw * 4);
    let eerste = null, anders = 0, tel = 0;
    for (let j = 0; j < 40; j++) {
      gl.readPixels(0, Math.floor((j + 0.5) * bh / 40), bw, 1, gl.RGBA, gl.UNSIGNED_BYTE, rij);
      for (let i = 0; i < 40; i++) {
        const p = Math.floor((i + 0.5) * bw / 40) * 4;
        const k = (rij[p] << 16) | (rij[p + 1] << 8) | rij[p + 2];
        if (eerste === null) eerste = k;
        else if (Math.abs(k - eerste) > 0) anders++;
        tel++;
      }
    }
    return +(anders / tel).toFixed(3);
  }
}
