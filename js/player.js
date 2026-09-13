// Speler: first-person besturing, botsingen, wapens.
import * as THREE from 'three';
import { resolveCollisions, pointInWater, ondergrondOp, grondHoogte } from './world.js';
import { geluid } from './audio.js';
import { maakPistool, maakMitrailleur, HERLAADTIJD } from './wapen.js';
import { hurkHouding } from './lichaam.js';

/*
 Hoeveel je zakt als je bukt. Hetzelfde getal als waarmee het poppetje in de
 derde persoon zakt, want dat is hetzelfde lichaam: js/lichaam.js rekent het uit
 de beenlengte en de knik in de knie uit.
*/
export const HURK_ZAK = hurkHouding({}, 1);


/*
 De twee wapens. Het pistool heb je vanaf het begin; het machinegeweer koop je
 voor vijfhonderd euro bij Tinga State.

 - `mag` is de magazijngrootte; de reserve is voor allebei dezelfde voorraad;
 - `auto` betekent dat hij doorschiet zolang je de knop ingedrukt houdt;
 - `tempo` is de tijd tussen twee schoten (0 = zo snel als je klikt);
 - `spreiding` is hoeveel de loop afwijkt — het machinegeweer schiet harder maar
   slordiger, anders is er geen reden om het pistool ooit nog te pakken;
 - `kick` is hoeveel het beeld per schot omhoog loopt.
*/
export const WAPENS = {
  // het pistool heeft `tempo` nul: zo snel als je klikt, precies zoals het was
  pistool: { naam: 'Pistool', mag: 12, auto: false, tempo: 0, spreiding: 0, kick: 1 },
  mitrailleur: { naam: 'Machinegeweer', mag: 30, auto: true, tempo: 0.085, spreiding: 0.022, kick: 0.62 },
};

export class Player {
  get locked() { return this.active; }
  set locked(v) { this.active = v; }

  constructor(camera, scene, startX, startZ, yaw) {
    this.camera = camera;
    this.scene = scene;
    this.pos = new THREE.Vector3(startX, 0, startZ);
    this.yaw = yaw; this.pitch = 0;
    this.vy = 0; this.onGround = true;
    this.eye = 1.7;
    this.keys = {};
    // analoge loopinvoer van de touch-joystick: x = zijwaarts, y = vooruit
    this.moveAxis = { x: 0, y: 0 };
    this.sprint = false;
    this.inCar = null;
    this.health = 100;
    /*
     Bier. `dronken` loopt van 0 tot 1 en zakt in een minuut terug naar nul
     (js/supermarkt.js zet hem omhoog vanaf het derde flesje). Zolang hij
     uitstaat deint het beeld: de camera rolt en dobbert wat, en js/hud.js legt
     er een warme waas overheen.
    */
    this.dronken = 0;
    this.dronkenT = 0;
    /*
     Wapens. Je begint met het pistool; het machinegeweer koop je bij Tinga
     State (js/boerderij.js) en staat daarna in `wapens`. Met het scrollwiel
     wissel je. `ammo` is wat er in het magazijn van het wapen in je hand zit,
     `magazijnen` houdt bij wat er in het andere magazijn was blijven zitten, en
     `reserve` is de voorraad kogels — die is voor alle wapens dezelfde, dus een
     doos kogels of de munitie van een agent past altijd.
    */
    this.wapens = ['pistool'];
    this.wapenNr = 0;
    this.magazijnen = { pistool: 12, mitrailleur: 0 };
    this.ammo = 12; this.reserve = 60; this.reloading = 0;
    this.vuurAan = false;       // trekker ingedrukt (voor het automatische vuur)
    this.vuurKlok = 0;          // tijd tot het volgende schot mag
    // wordt door main.js gevuld: duwt je te voet uit de auto's (js/vehicles.js)
    this.blokkade = null;
    // zit je ergens op? dan staat de ooghoogte lager en loop je niet
    this.zit = false;
    this.eyeStaand = this.eye;
    /*
     Bukken (toets C). `gebukt` is wat je wilt, `hurk` is waar hij nu staat: de
     overgang loopt in een derde seconde, want in één beeld van staand naar
     gehurkt schieten leest als een storing. Gehurkt zak je achtenveertig
     centimeter, loop je op een derde van je snelheid en zien de agenten je niet
     meer over een muurtje of een geparkeerde auto heen (js/politie.js).
    */
    this.gebukt = false;
    this.hurk = 0;
    this.recoil = 0; this.flashT = 0;
    /*
     Camera-terugslag. Een schot tilt het beeld even op en zet het een tikje
     opzij; het zakt daarna vanzelf terug. Het is alleen beeld: `pitch` en `yaw`
     blijven staan waar jij ze hebt gezet, zodat je richten er niet door
     verschuift en een tweede schot op dezelfde plek aankomt.
    */
    this.kickPitch = 0; this.kickYaw = 0;
    this.active = false;        // spel gestart
    this.pointerLocked = false; // muis vastgezet door de browser
    this.dragging = false; this.dragDist = 0;
    this.kijkT = 0;             // tijd sinds je voor het laatst rondkeek
    this.shootCb = null;
    this.wisselCb = null;       // js/main.js: het wapenicoon kort in beeld

    this.buildGun();
    this.bindInput();
  }

  /*
   Het pistool in beeld. Het model, de hand en de hele herlaadbeweging staan in
   js/wapen.js; hier hangt alleen de aansturing.
  */
  buildGun() {
    // allebei de modellen staan er meteen; wisselen is een kwestie van zichtbaar
    // maken. Dat is een paar honderd driehoeken en het scheelt een hapering op
    // het moment dat je het scrollwiel draait.
    this.modellen = { pistool: maakPistool(geluid), mitrailleur: maakMitrailleur(geluid) };
    for (const k of Object.keys(this.modellen)) {
      this.modellen[k].groep.visible = false;
      this.camera.add(this.modellen[k].groep);
    }
    this.wapen = this.modellen.pistool;
    this.gun = this.wapen.groep;
    this.gun.visible = true;
    this.wapenUit = false;      // wapen weggestopt (toets H)
  }

  // Wat het wapen in je hand kan: magazijngrootte, vuursnelheid en terugslag.
  get wapenSoort() { return this.wapens[this.wapenNr] || 'pistool'; }
  get wapenInfo() { return WAPENS[this.wapenSoort]; }

  /*
   Van wapen wisselen met het scrollwiel. `stap` is +1 of −1; heb je er maar
   één, dan gebeurt er niets. Het magazijn van het wapen dat je wegdoet blijft
   erin zitten: leg je het pistool met drie kogels weg, dan zitten er drie in
   als je het weer pakt. Levert de nieuwe soort terug, of null.
  */
  kiesWapen(stap) {
    if (this.wapens.length < 2 || this.reloading > 0) return null;
    this.magazijnen[this.wapenSoort] = this.ammo;
    const n = this.wapens.length;
    this.wapenNr = ((this.wapenNr + stap) % n + n) % n;
    return this.zetWapen(this.wapenSoort);
  }

  // Het wapen van een soort in de hand nemen (ook gebruikt door het laden van
  // een opgeslagen spel en door het kopen van het machinegeweer).
  zetWapen(soort) {
    if (!this.modellen[soort]) return null;
    const nr = this.wapens.indexOf(soort);
    if (nr < 0) return null;
    this.wapenNr = nr;
    this.gun.visible = false;
    this.wapen = this.modellen[soort];
    this.gun = this.wapen.groep;
    this.gun.visible = !this.wapenUit;
    this.ammo = Math.min(this.magazijnen[soort] ?? 0, WAPENS[soort].mag);
    this.vuurAan = false;
    return soort;
  }

  // Een wapen erbij (gekocht bij Tinga State). Het komt meteen in je hand, met
  // een vol magazijn uit je eigen voorraad als je die hebt.
  krijgWapen(soort) {
    if (!WAPENS[soort]) return false;
    this.magazijnen[this.wapenSoort] = this.ammo;        // eerst wegleggen wat je vasthebt
    if (!this.wapens.includes(soort)) this.wapens.push(soort);
    const vul = Math.min(WAPENS[soort].mag - (this.magazijnen[soort] || 0), this.reserve);
    if (vul > 0) { this.magazijnen[soort] = (this.magazijnen[soort] || 0) + vul; this.reserve -= vul; }
    this.zetWapen(soort);
    return true;
  }

  // Pistool trekken of wegstoppen. Weggestopt schiet je niet en staat het
  // kruisje uit; in de auto blijft het hoe dan ook uit beeld (zie main.js).
  wisselWapen() {
    this.wapenUit = !this.wapenUit;
    const kruis = document.getElementById('crosshair');
    if (kruis) kruis.style.display = this.wapenUit ? 'none' : '';
    return !this.wapenUit;
  }

  /*
   Bukken aan- of uitzetten. In de auto en zittend op de bank doet hij niets;
   springen zet je vanzelf weer rechtop, want gehurkt spring je niet.
  */
  bukken(aan = !this.gebukt) {
    if (this.inCar || this.zit) return false;
    this.gebukt = !!aan;
    return this.gebukt;
  }

  bindInput() {
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (e.code === 'KeyR') this.reload();
      if (e.code === 'KeyH' && this.active) this.wisselWapen();
      if (e.code === 'KeyC' && this.active && !e.ctrlKey && !e.metaKey) this.bukken();
      // meteen springen, zodat een korte tik nooit tussen twee beelden valt
      if (e.code === 'Space' && this.active) this.jump();
      // scrollen met de spatiebalk voorkomen zodra het spel loopt
      if (this.active && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });

    // Rondkijken. Met muisvergrendeling gaat dat vanzelf; lukt die niet, dan
    // kijk je rond door met de linkerknop ingedrukt te slepen.
    document.addEventListener('mousemove', e => {
      if (!this.active) return;
      if (!this.pointerLocked && !this.dragging) return;
      this.lookBy(e.movementX, e.movementY, this.pointerLocked ? 0.0022 : 0.0032);
      if (this.dragging) this.dragDist += Math.abs(e.movementX) + Math.abs(e.movementY);
    });
    document.addEventListener('mousedown', e => {
      if (!this.active || e.button !== 0) return;
      if (this.pointerLocked) { this.vuurAan = true; this.shoot(); return; }
      this.dragging = true; this.dragDist = 0;
    });
    document.addEventListener('mouseup', e => {
      if (!this.active || e.button !== 0) return;
      this.vuurAan = false;
      if (this.pointerLocked) return;
      // een korte klik zonder slepen is een schot
      if (this.dragDist < 8) this.shoot();
      this.dragging = false;
    });
    /*
     Wapen wisselen met het scrollwiel. `wisselCb` wordt door js/main.js gezet en
     laat het icoon van het wapen kort in beeld komen.
    */
    window.addEventListener('wheel', e => {
      if (!this.active) return;
      const soort = this.kiesWapen(e.deltaY > 0 ? 1 : -1);
      if (soort && this.wisselCb) this.wisselCb(soort);
    }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement != null;
    });
  }

  // Vrije camera voor de editor: geen zwaartekracht, geen botsingen, en je
  // kunt met Q en E omhoog en omlaag.
  updateFly(dt) {
    const speed = (this.keys.ShiftLeft || this.keys.ShiftRight) ? 46 : 14;
    const f = new THREE.Vector3(); this.camera.getWorldDirection(f);
    const r = new THREE.Vector3(f.z, 0, -f.x).normalize();
    const move = new THREE.Vector3();
    if (this.keys.KeyW || this.keys.ArrowUp) move.add(f);
    if (this.keys.KeyS || this.keys.ArrowDown) move.sub(f);
    if (this.keys.KeyD || this.keys.ArrowRight) move.sub(r);
    if (this.keys.KeyA || this.keys.ArrowLeft) move.add(r);
    if (this.keys.KeyE) move.y += 1;
    if (this.keys.KeyQ) move.y -= 1;
    if (this.moveAxis.y) move.addScaledVector(f, this.moveAxis.y);
    if (this.moveAxis.x) move.addScaledVector(r, -this.moveAxis.x);
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed * dt);
    this.pos.add(move);
    this.pos.y = Math.max(1.5, this.pos.y);
    this.vy = 0; this.onGround = true;
    this.camera.position.copy(this.pos);
    this.camera.rotation.set(0, 0, 0, 'YXZ');
    this.camera.rotation.y = this.yaw; this.camera.rotation.x = this.pitch;
    this.gun.visible = false;
  }

  jump() {
    if (this.inCar || !this.onGround) return;
    if (this.gebukt) { this.gebukt = false; return; }   // eerst overeind
    this.vy = 4.6; this.onGround = false;
    geluid.sprong();
  }

  // Rondkijken vanuit muis of touch: dx/dy in schermpixels. `kijkT` telt af na
  // de laatste beweging; de camera achter de auto gebruikt dat om te weten of
  // je zelf aan het rondkijken bent (zie js/derdepersoon.js).
  lookBy(dx, dy, k = 0.0032) {
    this.yaw -= dx * k;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - dy * k));
    if (dx || dy) this.kijkT = 1.6;
  }

  // Stuurinvoer voor de auto: toetsen plus de touch-joystick.
  driveInput() {
    const a = this.moveAxis;
    if (!a.x && !a.y) return this.keys;
    const k = Object.assign({}, this.keys);
    if (a.y > 0.30) k.KeyW = true;
    if (a.y < -0.30) k.KeyS = true;
    if (a.x > 0.35) k.KeyD = true;
    if (a.x < -0.35) k.KeyA = true;
    return k;
  }

  reload() {
    if (this.reloading > 0 || this.ammo === this.wapenInfo.mag || this.reserve <= 0) return;
    // de klikken horen bij de beweging en komen uit js/wapen.js
    this.reloading = this.wapen.herlaadtijd || HERLAADTIJD;
  }

  /*
   Schieten. Achter het stuur kan dat ook, maar alleen naar voren en opzij
   (verzoek beta-test 12 sep 2026): je hangt uit het raam en niet over de
   achterbank heen. De grens ligt op honderdvijftig graden — je mag dus iets
   voorbij dwars mikken, maar niet naar achteren.

   Hoeveel je opzij kijkt is het verschil tussen waar jij kijkt en waar de neus
   van de auto heen wijst. `player.yaw` loopt met de auto mee (zie de hoofdlus in
   js/main.js), dus dat verschil is precies je kijkrichting in de auto.
  */
  magSchieten() {
    if (this.reloading > 0 || this.wapenUit) return false;
    if (!this.inCar) return true;
    let d = this.yaw - this.inCar.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return Math.abs(d) < Math.PI * (150 / 180);
  }

  shoot() {
    if (!this.magSchieten()) return;
    if (this.vuurKlok > 0) return;
    if (this.ammo <= 0) { geluid.leegKlik(); this.reload(); return; }
    const W = this.wapenInfo;
    this.ammo--;
    this.vuurKlok = W.tempo;
    this.recoil = 1; this.flashT = 0.06;
    // beeld omhoog en een willekeurig tikje opzij
    this.kickPitch += (0.026 + Math.random() * 0.010) * W.kick;
    this.kickYaw += (Math.random() - 0.5) * 0.014 * W.kick;
    if (this.wapen) this.wapen.vuur();
    geluid.schot();
    const dir = new THREE.Vector3(); this.camera.getWorldDirection(dir);
    // het machinegeweer schiet slordiger: de kogel gaat een fractie naast de
    // richting waar je in kijkt
    if (W.spreiding) {
      const zij = new THREE.Vector3(dir.z, 0, -dir.x).normalize();
      const op = new THREE.Vector3().crossVectors(zij, dir).normalize();
      dir.addScaledVector(zij, (Math.random() - 0.5) * W.spreiding);
      dir.addScaledVector(op, (Math.random() - 0.5) * W.spreiding);
      dir.normalize();
    }
    const origin = this.camera.getWorldPosition(new THREE.Vector3());
    if (this.shootCb) this.shootCb(origin, dir);
  }

  // Zet de camera op de speler zonder te bewegen. Nodig op het startscherm,
  // want anders staat de camera nog op het nulpunt en kijk je tegen de
  // onderkant van de luchtkoepel aan.
  applyCamera() {
    this.camera.position.set(this.pos.x, this.pos.y + this.eye, this.pos.z);
    this.camera.rotation.set(0, 0, 0, 'YXZ');
    this.camera.rotation.y = this.yaw + this.kickYaw;
    this.camera.rotation.x = this.pitch + this.kickPitch;
    if (this.dronken > 0) {
      // drie trage golven met verschillende perioden: dan komt het deinen nooit
      // op hetzelfde punt terug en blijft het onrustig aanvoelen
      const d = this.dronken, t = this.dronkenT;
      this.camera.rotation.z = Math.sin(t * 1.15) * 0.085 * d;
      this.camera.rotation.y += Math.sin(t * 0.73) * 0.055 * d;
      this.camera.rotation.x += Math.sin(t * 1.47 + 1.2) * 0.030 * d;
    }
  }

  // De terugslag zakt terug naar nul; hoe verder hij nog uitstaat, hoe sneller.
  demptTerugslag(dt) {
    const f = Math.exp(-dt * 9);
    this.kickPitch *= f; this.kickYaw *= f;
    if (Math.abs(this.kickPitch) < 1e-4) this.kickPitch = 0;
    if (Math.abs(this.kickYaw) < 1e-4) this.kickYaw = 0;
  }

  update(dt) {
    this.demptTerugslag(dt);
    // het bier zakt weg: van vol naar nuchter duurt een minuut
    if (this.dronken > 0) {
      this.dronkenT += dt;
      this.dronken = Math.max(0, this.dronken - dt / 60);
    }
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        const need = this.wapenInfo.mag - this.ammo;
        const take = Math.min(need, this.reserve);
        this.ammo += take; this.reserve -= take; this.reloading = 0;
      }
    }
    /*
     Doorschieten. Het machinegeweer vuurt zolang je de knop ingedrukt houdt;
     het pistool niet — daar is `auto` false en telt `vuurKlok` alleen hoe snel
     je achter elkaar kunt klikken.
    */
    this.vuurKlok = Math.max(0, this.vuurKlok - dt);
    if (this.vuurAan && this.wapenInfo.auto && this.reloading <= 0) this.shoot();
    if (this.inCar) return; // camera wordt door de auto bestuurd

    /*
     Zitten (op de bank, zie js/interieur.js). Je blijft waar je bent en kijkt
     alleen rond; de ooghoogte staat lager, want je zit. Lopen doe je pas weer
     als je opstaat.
    */
    if (this.zit) { this.applyCamera(); return; }

    if (this.fly) { this.updateFly(dt); return; }


    /*
     Gebukt: de ooghoogte zakt naar de hurkhoogte en je komt maar op een derde
     van je snelheid vooruit. Rennen kan niet — wie hurkt rent niet.
    */
    const naarHurk = this.gebukt ? 1 : 0;
    this.hurk += (naarHurk - this.hurk) * Math.min(1, dt * 9);
    if (Math.abs(this.hurk - naarHurk) < 0.01) this.hurk = naarHurk;
    this.eye = this.eyeStaand - HURK_ZAK * this.hurk;

    const running = (this.keys.ShiftLeft || this.keys.ShiftRight || this.sprint) && this.hurk < 0.3;
    const speed = (running ? 7.5 : 4.2) * (1 - this.hurk * 0.62);
    const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const r = new THREE.Vector3(-f.z, 0, f.x);
    const move = new THREE.Vector3();
    if (this.keys.KeyW || this.keys.ArrowUp) move.add(f);
    if (this.keys.KeyS || this.keys.ArrowDown) move.sub(f);
    if (this.keys.KeyD || this.keys.ArrowRight) move.add(r);
    if (this.keys.KeyA || this.keys.ArrowLeft) move.sub(r);
    // touch-joystick: analoog, dus een halve uitslag loopt ook half zo snel
    if (this.moveAxis.y) move.addScaledVector(f, this.moveAxis.y);
    if (this.moveAxis.x) move.addScaledVector(r, this.moveAxis.x);
    if (move.lengthSq() > 1) move.normalize();
    move.multiplyScalar(speed * dt);

    let nx = this.pos.x + move.x, nz = this.pos.z + move.z;
    [nx, nz] = resolveCollisions(nx, nz, 0.35, 0, this.pos.y);
    /*
     Auto's staan niet in resolveCollisions — die lijst is voor de vaste wereld
     en auto's bewegen. Zonder deze stap loop je er dwars doorheen. main.js hangt
     `blokkade` op js/vehicles.js; daarna nog één keer langs de vaste wereld,
     zodat een duwtje uit een auto je niet een gevel in werkt.
    */
    if (this.blokkade) {
      const [bx, bz] = this.blokkade(nx, nz, 0.35);
      if (bx !== nx || bz !== nz) [nx, nz] = resolveCollisions(bx, bz, 0.35, 0, this.pos.y);
    }
    // op het viaduct loop je over de rondweg heen; het water eronder telt niet
    if (this.pos.y < 1.5 && pointInWater(nx, nz)) { // niet het water in: probeer per as
      if (!pointInWater(nx, this.pos.z)) nz = this.pos.z; else if (!pointInWater(this.pos.x, nz)) nx = this.pos.x; else { nx = this.pos.x; nz = this.pos.z; }
    }
    this.pos.x = nx; this.pos.z = nz;

    /*
     Springen en zwaartekracht. De grond is bijna overal 0, maar op het viaduct
     (js/viaduct.js) loopt hij op tot ruim vijf meter. Loop je de helling op,
     dan tilt `grondHoogte` je mee; loop je van de brug af, dan val je.
    */
    if (this.keys.Space) this.jump();
    const grond = grondHoogte(this.pos.x, this.pos.z, this.pos.y + 0.9);
    this.vy -= 12 * dt; this.pos.y += this.vy * dt;
    if (this.pos.y <= grond) { this.pos.y = grond; this.vy = 0; this.onGround = true; }

    // Voetstappen volgen de kop-beweging: elke halve slag zet je een voet neer,
    // en de klank hangt af van waar je op loopt.
    const vorigeBob = this.bob || 0;
    // hoofdbeweging bij lopen
    this.bob = (this.bob || 0) + (move.lengthSq() > 0 ? dt * (speed > 5 ? 13 : 9) : 0);
    if (this.onGround && Math.floor(vorigeBob / Math.PI) !== Math.floor(this.bob / Math.PI)) {
      geluid.voetstap(ondergrondOp(this.pos.x, this.pos.z), running);
    }
    if (!this.wasInLucht && !this.onGround) this.wasInLucht = true;
    else if (this.wasInLucht && this.onGround) { this.wasInLucht = false; geluid.landing(); }
    const bobY = move.lengthSq() > 0 ? Math.sin(this.bob) * 0.035 : 0;

    this.camera.position.set(this.pos.x, this.pos.y + this.eye + bobY, this.pos.z);
    this.camera.rotation.set(0, 0, 0, 'YXZ');
    this.camera.rotation.y = this.yaw + this.kickYaw;
    this.camera.rotation.x = this.pitch + this.kickPitch;

    // wapenanimatie: schot, terugslag en de vijf stappen van het herladen
    this.recoil = Math.max(0, this.recoil - dt * 6);
    this.flashT -= dt;
    this.wapen.update(dt, { herlaad: this.reloading, bob: this.bob });
    this.gun.visible = !this.wapenUit;
  }
}
