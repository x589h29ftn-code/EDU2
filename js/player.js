// Speler: first-person besturing, botsingen, pistool.
import * as THREE from 'three';
import { resolveCollisions, pointInWater, ondergrondOp, grondHoogte } from './world.js';
import { geluid } from './audio.js';
import { maakPistool, HERLAADTIJD } from './wapen.js';

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
    this.ammo = 12; this.reserve = 60; this.reloading = 0;
    // wordt door main.js gevuld: duwt je te voet uit de auto's (js/vehicles.js)
    this.blokkade = null;
    // zit je ergens op? dan staat de ooghoogte lager en loop je niet
    this.zit = false;
    this.eyeStaand = this.eye;
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

    this.buildGun();
    this.bindInput();
  }

  /*
   Het pistool in beeld. Het model, de hand en de hele herlaadbeweging staan in
   js/wapen.js; hier hangt alleen de aansturing.
  */
  buildGun() {
    this.wapen = maakPistool(geluid);
    this.gun = this.wapen.groep;
    this.wapenUit = false;      // pistool weggestopt (toets H)
    this.camera.add(this.gun);
  }

  // Pistool trekken of wegstoppen. Weggestopt schiet je niet en staat het
  // kruisje uit; in de auto blijft het hoe dan ook uit beeld (zie main.js).
  wisselWapen() {
    this.wapenUit = !this.wapenUit;
    const kruis = document.getElementById('crosshair');
    if (kruis) kruis.style.display = this.wapenUit ? 'none' : '';
    return !this.wapenUit;
  }

  bindInput() {
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (e.code === 'KeyR') this.reload();
      if (e.code === 'KeyH' && this.active) this.wisselWapen();
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
      if (this.pointerLocked) { this.shoot(); return; }
      this.dragging = true; this.dragDist = 0;
    });
    document.addEventListener('mouseup', e => {
      if (!this.active || e.button !== 0 || this.pointerLocked) return;
      // een korte klik zonder slepen is een schot
      if (this.dragDist < 8) this.shoot();
      this.dragging = false;
    });
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
    if (this.reloading > 0 || this.ammo === 12 || this.reserve <= 0) return;
    // de klikken horen bij de beweging en komen uit js/wapen.js
    this.reloading = HERLAADTIJD;
  }

  shoot() {
    if (this.inCar || this.reloading > 0 || this.wapenUit) return;
    if (this.ammo <= 0) { geluid.leegKlik(); this.reload(); return; }
    this.ammo--;
    this.recoil = 1; this.flashT = 0.06;
    // beeld omhoog en een willekeurig tikje opzij
    this.kickPitch += 0.026 + Math.random() * 0.010;
    this.kickYaw += (Math.random() - 0.5) * 0.014;
    if (this.wapen) this.wapen.vuur();
    geluid.schot();
    const dir = new THREE.Vector3(); this.camera.getWorldDirection(dir);
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
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) { const need = 12 - this.ammo; const take = Math.min(need, this.reserve); this.ammo += take; this.reserve -= take; this.reloading = 0; }
    }
    if (this.inCar) return; // camera wordt door de auto bestuurd

    /*
     Zitten (op de bank, zie js/interieur.js). Je blijft waar je bent en kijkt
     alleen rond; de ooghoogte staat lager, want je zit. Lopen doe je pas weer
     als je opstaat.
    */
    if (this.zit) { this.applyCamera(); return; }

    if (this.fly) { this.updateFly(dt); return; }


    const running = this.keys.ShiftLeft || this.keys.ShiftRight || this.sprint;
    const speed = running ? 7.5 : 4.2;
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
