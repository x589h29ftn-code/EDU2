/*
 De drone (stap 124). Te koop aan de toonbank van Tinga State voor € 1.000, en daarna van jou:
 de opslag onthoudt dat je hem hebt (`player.drone`).

 B laat hem opstijgen. Erik blijft staan met de afstandsbediening en het beeld is van de camera
 onder de drone; B of E haalt hem terug. Vliegen: WASD, spatie omhoog, C omlaag, de muis kijkt
 rond en shift gaat sneller. Hij zweeft een beetje na en helt over in de bocht.

 De grenzen, op verzoek van de gebruiker: niet hoger dan 150 m, niet dichter dan 100 m bij de rand
 van de wereld, en niet verder dan 800 m van Erik. In de buurt van een grens komt er ruis in beeld;
 erover staat er OUT OF RANGE met tien tellen. Niet op tijd terug: het signaal is weg, de drone stort
 neer en is kwijt. De drone geeft geen politiester: vliegen is niet strafbaar.

 Licht zit hier niet in een lamp (de regel van stap 83: het aantal lichtbronnen nooit veranderen).
 Het lampje eronder is een gloeiend bolletje, en de plas licht op de grond is een doorzichtige schijf
 die meeschuift, net als de lantaarns.
*/
import * as THREE from 'three';
import { resolveCollisions } from './world.js';
import { grondHoogte } from './viaduct.js';

export const DRONE = {
  prijs: 1000,
  maxHoog: 150,       // m boven het maaiveld
  rand: 100,          // m van de rand van de wereld
  bereik: 800,        // m van Erik
  aftel: 10,          // s om terug binnen bereik te komen
  accu: 300,          // s vliegen op een volle accu
  laad: 90,           // s om hem op te laden van leeg tot vol
  snel: 12, sneller: 26, klim: 5,
};

export function initDrone({ scene, camera, player, geluid, gebied, nacht = () => false, melding = () => {} }) {
  // ---------- het model: een kleine quadcopter, 36 cm van as tot as ----------
  const groep = new THREE.Group();
  const grijs = new THREE.MeshStandardMaterial({ color: 0x34383d, roughness: 0.55, metalness: 0.2 });
  const licht = new THREE.MeshStandardMaterial({ color: 0xd8dbde, roughness: 0.4, metalness: 0.1 });
  const romp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.24), licht);
  groep.add(romp);
  const armGeo = new THREE.BoxGeometry(0.36 * Math.SQRT2, 0.022, 0.03);
  for (const a of [Math.PI / 4, -Math.PI / 4]) {
    const arm = new THREE.Mesh(armGeo, grijs); arm.rotation.y = a; groep.add(arm);
  }
  const motorGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.04, 10);
  const schijfGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.004, 20);
  const schijfMat = new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.32, depthWrite: false });
  const rotors = [];
  for (const [x, z] of [[0.18, 0.18], [-0.18, 0.18], [0.18, -0.18], [-0.18, -0.18]]) {
    const m = new THREE.Mesh(motorGeo, grijs); m.position.set(x, 0.02, z); groep.add(m);
    const s = new THREE.Mesh(schijfGeo, schijfMat); s.position.set(x, 0.045, z); groep.add(s); rotors.push(s);
  }
  const camGeo = new THREE.SphereGeometry(0.03, 10, 8);
  const lens = new THREE.Mesh(camGeo, grijs); lens.position.set(0, -0.05, -0.1); groep.add(lens);
  // de lampjes: rood links, groen rechts, en wit eronder (dat ene gloeit 's nachts)
  const ledGeo = new THREE.SphereGeometry(0.012, 6, 4);
  const rood = new THREE.Mesh(ledGeo, new THREE.MeshBasicMaterial({ color: 0xff2a1a })); rood.position.set(-0.18, 0, -0.2);
  const groen = new THREE.Mesh(ledGeo, new THREE.MeshBasicMaterial({ color: 0x2aff4a })); groen.position.set(0.18, 0, -0.2);
  const onderMat = new THREE.MeshBasicMaterial({ color: 0xfff6dd });
  const onder = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), onderMat); onder.position.set(0, -0.045, 0);
  groep.add(rood, groen, onder);
  groep.visible = false;
  scene.add(groep);

  // de plas licht op de grond, 's nachts
  const plasDoek = document.createElement('canvas');
  plasDoek.width = plasDoek.height = 64;
  {
    const g = plasDoek.getContext('2d');
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,244,214,1)'); r.addColorStop(0.5, 'rgba(255,240,200,0.45)'); r.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  }
  const plasTex = new THREE.CanvasTexture(plasDoek);
  plasTex.colorSpace = THREE.SRGBColorSpace;
  const plasMat = new THREE.MeshBasicMaterial({ map: plasTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const plas = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), plasMat);
  plas.rotation.x = -Math.PI / 2;
  plas.renderOrder = 2;
  plas.visible = false;
  scene.add(plas);

  // ---------- het scherm: de rand, de waarden, de ruis, de waarschuwing ----------
  const scherm = document.getElementById('droneScherm');
  const ruisDoek = scherm ? scherm.querySelector('canvas') : null;
  const ruisCtx = ruisDoek ? ruisDoek.getContext('2d') : null;
  const waardeEl = scherm ? scherm.querySelector('.waarden') : null;
  const waarschuwEl = scherm ? scherm.querySelector('.bereik') : null;
  let ruisBeeld = null;

  // ---------- de toestand ----------
  const pos = new THREE.Vector3();
  const vel = new THREE.Vector3();
  let actief = false;
  let accu = DRONE.accu;
  let aftel = null;          // null: binnen bereik; anders de tellen die nog over zijn
  let ruis = 0;              // 0–1, hoeveel ruis er in beeld staat
  let kantel = 0;
  let t = 0;
  let erikYaw = 0, erikPitch = 0, erikLeven = 100;
  let verlorenT = 0;         // het beeld na het neerstorten: alleen ruis
  let laatsteReden = null;
  let fotos = 0;

  function randAfstand(x, z) {
    return Math.min(x - gebied.x0, gebied.x1 - x, z - gebied.z0, gebied.z1 - z);
  }
  function hoogte() { return pos.y - grondHoogte(pos.x, pos.z, pos.y); }
  function afstand() { return Math.hypot(pos.x - player.pos.x, pos.z - player.pos.z); }
  // waarom hij nu buiten bereik is, of null
  function buiten() {
    if (hoogte() > DRONE.maxHoog) return 'te hoog';
    if (randAfstand(pos.x, pos.z) < DRONE.rand) return 'te dicht bij de rand';
    if (afstand() > DRONE.bereik) return 'te ver van Erik';
    return null;
  }

  function start() {
    if (actief) return 'al';
    if (!player.drone) return 'geen';
    if (accu < 15) return 'accu';
    actief = true;
    player.inDrone = true;
    erikYaw = player.yaw; erikPitch = player.pitch; erikLeven = player.health;
    // hij stijgt op uit Eriks handen, een halve meter voor hem
    pos.set(player.pos.x - Math.sin(player.yaw) * 0.8, player.pos.y + 1.5, player.pos.z - Math.cos(player.yaw) * 0.8);
    vel.set(0, 2.5, 0);
    aftel = null; ruis = 0.35; kantel = 0; verlorenT = 0;
    player.pitch = -0.15;
    if (player.gun) player.gun.visible = false;
    const kruis = document.getElementById('crosshair');
    if (kruis) kruis.style.display = 'none';
    if (scherm) scherm.hidden = false;
    groep.visible = true;
    return null;
  }

  // terug naar Erik. `reden` is voor de melding; 'kwijt' betekent dat hij neergestort is
  function terug(reden = null) {
    if (!actief) return false;
    actief = false;
    player.inDrone = false;
    player.yaw = erikYaw; player.pitch = erikPitch;
    if (player.keys) player.keys = {};
    groep.visible = false; plas.visible = false;
    if (scherm) scherm.hidden = true;
    const kruis = document.getElementById('crosshair');
    if (kruis && !player.wapenUit) kruis.style.display = '';
    geluid.drone(null);
    laatsteReden = reden;
    if (reden === 'kwijt') {
      player.drone = false;
      geluid.klap && geluid.klap();
      melding('Signaal kwijt', 'De drone is neergestort en kwijt. Een nieuwe kost € ' + DRONE.prijs + ' bij Tinga State.', 5);
    } else if (reden === 'accu') melding('Accu leeg', 'De drone is teruggevlogen naar Erik. Hij laadt weer op.', 4);
    else if (reden === 'geraakt') melding('Erik wordt geraakt', 'Je laat de drone terugkomen.', 3);
    return true;
  }

  function teken(dt) {
    if (!scherm || scherm.hidden) return;
    // de ruis: een klein doek vol willekeurige grijswaarden, groot over het scherm getrokken
    if (ruisCtx) {
      const sterk = verlorenT > 0 ? 1 : ruis;
      ruisDoek.style.opacity = String(Math.min(0.9, sterk * 0.85));
      if (sterk > 0.02) {
        if (!ruisBeeld) ruisBeeld = ruisCtx.createImageData(ruisDoek.width, ruisDoek.height);
        const d = ruisBeeld.data;
        for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
        ruisCtx.putImageData(ruisBeeld, 0, 0);
      }
    }
    if (waardeEl) {
      const accuPct = Math.max(0, Math.round(accu / DRONE.accu * 100));
      waardeEl.textContent = `H ${Math.round(hoogte())} m   ·   D ${Math.round(afstand())} m   ·   ACCU ${accuPct}%`;
      waardeEl.classList.toggle('laag', accuPct <= 20);
    }
    if (waarschuwEl) {
      if (aftel !== null) {
        waarschuwEl.hidden = false;
        waarschuwEl.textContent = `OUT OF RANGE · ${Math.ceil(aftel)}`;
        waarschuwEl.style.visibility = (t % 0.7) < 0.45 ? 'visible' : 'hidden';
      } else if (verlorenT > 0) {
        waarschuwEl.hidden = false; waarschuwEl.style.visibility = 'visible';
        waarschuwEl.textContent = 'SIGNAAL KWIJT';
      } else waarschuwEl.hidden = true;
    }
  }

  function update(dt) {
    if (!actief) {
      accu = Math.min(DRONE.accu, accu + dt * DRONE.accu / DRONE.laad);
      return;
    }
    t += dt;
    // het neerstorten: een tel ruis, dan terug naar Erik
    if (verlorenT > 0) {
      verlorenT -= dt;
      teken(dt);
      if (verlorenT <= 0) terug('kwijt');
      return;
    }
    // Erik wordt geraakt: dan laat je de drone los
    if (player.health < erikLeven - 0.5) { terug('geraakt'); return; }
    erikLeven = player.health;

    const k = player.keys || {};
    const snel = (k.ShiftLeft || k.ShiftRight);
    const v = snel ? DRONE.sneller : DRONE.snel;
    const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
    const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
    const vooruit = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
    const opzij = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    const op = (k.Space ? 1 : 0) - (k.KeyC ? 1 : 0);
    const doelX = (fx * vooruit + rx * opzij) * v, doelZ = (fz * vooruit + rz * opzij) * v;
    const doelY = op * DRONE.klim * (snel ? 1.6 : 1);
    // traag bijsturen: de drone zweeft een beetje na
    const a = Math.min(1, dt * 2.2);
    vel.x += (doelX - vel.x) * a; vel.z += (doelZ - vel.z) * a;
    vel.y += (doelY - vel.y) * Math.min(1, dt * 3);
    pos.addScaledVector(vel, dt);

    // de grond en de daken: niet erdoorheen
    const grond = grondHoogte(pos.x, pos.z, pos.y);
    if (pos.y < grond + 0.5) { pos.y = grond + 0.5; if (vel.y < 0) vel.y = 0; }
    const [nx, nz] = resolveCollisions(pos.x, pos.z, 0.45, pos.y - grond - 0.2, pos.y - 0.9);
    pos.x = nx; pos.z = nz;
    // een harde grens ver voorbij de zachte: wie doorvliegt, valt toch uit de lucht
    pos.y = Math.min(pos.y, grond + DRONE.maxHoog + 40);
    pos.x = Math.min(gebied.x1 - 10, Math.max(gebied.x0 + 10, pos.x));
    pos.z = Math.min(gebied.z1 - 10, Math.max(gebied.z0 + 10, pos.z));

    // de accu
    accu -= dt * (snel ? 1.4 : 1);
    if (accu <= 0) { accu = 0; terug('accu'); return; }

    // het bereik: ruis vanaf de buurt van een grens, aftellen erover
    const h = hoogte(), ra = randAfstand(pos.x, pos.z), af = afstand();
    const bijna = Math.max((h - DRONE.maxHoog * 0.82) / (DRONE.maxHoog * 0.18), (DRONE.rand * 1.4 - ra) / (DRONE.rand * 0.4),
      (af - DRONE.bereik * 0.85) / (DRONE.bereik * 0.15), 0);
    const wat = buiten();
    if (wat) {
      if (aftel === null) { aftel = DRONE.aftel; melding('OUT OF RANGE', `De drone is ${wat}. Binnen ${DRONE.aftel} tellen terug, anders is het signaal weg.`, 4); }
      aftel -= dt;
      ruis = 0.55 + 0.35 * (1 - aftel / DRONE.aftel);
      if (aftel <= 0) { aftel = null; verlorenT = 1.4; geluid.drone(null); return; }
    } else {
      aftel = null;
      ruis += (Math.min(0.5, bijna * 0.5) - ruis) * Math.min(1, dt * 3);
    }

    // overhellen in de bocht, en een klein beetje deinen
    const zij = vel.x * rx + vel.z * rz;
    kantel += (-zij / DRONE.sneller * 0.22 - kantel) * Math.min(1, dt * 3);
    camera.position.set(pos.x, pos.y + Math.sin(t * 1.7) * 0.04, pos.z);
    camera.rotation.set(0, 0, 0, 'YXZ');
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;
    camera.rotation.z = kantel;
    // het model zelf (voor wie van buiten kijkt, en voor de foto's)
    groep.position.copy(pos);
    groep.rotation.set(-(vel.x * fx + vel.z * fz) / DRONE.sneller * 0.25, player.yaw, kantel, 'YXZ');
    for (let i = 0; i < rotors.length; i++) rotors[i].rotation.y += dt * 60;
    rood.visible = groen.visible = (t % 1.2) < 0.6;
    // het lampje eronder en zijn plas licht, 's nachts
    const donker = nacht();
    onder.visible = donker;
    const opGrond = pos.y - grond;
    plas.visible = donker && opGrond < 40;
    if (plas.visible) {
      const r = 2 + opGrond * 0.35;
      plas.position.set(pos.x, grond + 0.05, pos.z);
      plas.scale.set(r, r, 1);
      plasMat.opacity = Math.max(0, 0.5 * (1 - opGrond / 40));
    }
    geluid.drone(af, Math.min(1, Math.hypot(vel.x, vel.y, vel.z) / DRONE.sneller));
    teken(dt);
  }

  return {
    update, start, terug,
    get actief() { return actief; },
    get erikYaw() { return erikYaw; },
    get pos() { return pos; },
    get hoogte() { return actief ? hoogte() : 0; },
    get afstand() { return actief ? afstand() : 0; },
    get accu() { return accu; }, set accu(v) { accu = v; },
    get aftel() { return aftel; },
    get ruis() { return ruis; },
    get verloren() { return verlorenT > 0; },
    get reden() { return laatsteReden; },
    get groep() { return groep; },
    get plas() { return plas; },
    get fotos() { return fotos; }, telFoto() { fotos++; },
    buiten,
  };
}
