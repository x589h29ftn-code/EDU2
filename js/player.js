// Speler: first-person besturing, botsingen, pistool.
import * as THREE from 'three';
import { resolveCollisions, pointInWater, ondergrondOp } from './world.js';
import { geluid } from './audio.js';

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
    this.recoil = 0; this.flashT = 0;
    this.active = false;        // spel gestart
    this.pointerLocked = false; // muis vastgezet door de browser
    this.dragging = false; this.dragDist = 0;
    this.kijkT = 0;             // tijd sinds je voor het laatst rondkeek
    this.shootCb = null;

    this.buildGun();
    this.bindInput();
  }

  /*
   Het pistool in beeld. Het hing er klein en los bij: een blokje hand met een
   mouwtje erachter dat nergens naartoe liep. Nu is het model groter (schaal 1,
   dus een pistool van 19 cm) en zit er een hele onderarm aan die vanuit de
   rechteronderhoek van het beeld naar de vuist loopt — zoals het in een
   first-personspel hoort. Met H stop je het weg (`wapenUit`).
  */
  buildGun() {
    const g = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.45, metalness: 0.65 });
    const grip = new THREE.MeshStandardMaterial({ color: 0x2b2420, roughness: 0.9 });
    const huid = new THREE.MeshStandardMaterial({ color: 0xd0a480, roughness: 0.95 });
    const stof = new THREE.MeshStandardMaterial({ color: 0x2f3a56, roughness: 0.95 });
    const S = 1.0; // schaal: het pistool is ~19 cm lang
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.032 * S, 0.044 * S, 0.190 * S), dark); slide.position.set(0, 0.018 * S, -0.045 * S);
    const kast = new THREE.Mesh(new THREE.BoxGeometry(0.030 * S, 0.030 * S, 0.120 * S), dark); kast.position.set(0, -0.012 * S, -0.010 * S);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.006 * S, 0.006 * S, 0.05 * S, 8), dark); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.022 * S, -0.15 * S);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.030 * S, 0.090 * S, 0.040 * S), grip); handle.position.set(0, -0.058 * S, 0.020 * S); handle.rotation.x = 0.22;
    const beugel = new THREE.Mesh(new THREE.BoxGeometry(0.014 * S, 0.026 * S, 0.008 * S), dark); beugel.position.set(0, -0.030 * S, -0.028 * S);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.005 * S, 0.007 * S, 0.007 * S), dark); sight.position.set(0, 0.043 * S, -0.132 * S);
    const korrel = new THREE.Mesh(new THREE.BoxGeometry(0.010 * S, 0.007 * S, 0.006 * S), dark); korrel.position.set(0, 0.043 * S, 0.038 * S);
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.024 * S, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffd080, transparent: true, opacity: 0 }));
    flash.position.set(0, 0.022 * S, -0.190 * S);
    // de vuist om de kolf, met een duim langs de kast
    const vuist = new THREE.Mesh(new THREE.BoxGeometry(0.055 * S, 0.075 * S, 0.070 * S), huid);
    vuist.position.set(0.002 * S, -0.062 * S, 0.024 * S); vuist.rotation.x = 0.18;
    const duim = new THREE.Mesh(new THREE.BoxGeometry(0.020 * S, 0.026 * S, 0.060 * S), huid);
    duim.position.set(-0.026 * S, -0.030 * S, 0.006 * S); duim.rotation.x = -0.25;
    // pols en onderarm: lopen schuin naar de rechteronderhoek uit beeld
    const pols = new THREE.Mesh(new THREE.BoxGeometry(0.052 * S, 0.058 * S, 0.070 * S), huid);
    pols.position.set(0.016 * S, -0.088 * S, 0.082 * S); pols.rotation.set(-0.26, 0.22, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.076 * S, 0.082 * S, 0.44 * S), stof);
    arm.position.set(0.086 * S, -0.150 * S, 0.300 * S); arm.rotation.set(-0.26, 0.34, 0.06);
    const manchet = new THREE.Mesh(new THREE.BoxGeometry(0.084 * S, 0.090 * S, 0.034 * S), new THREE.MeshStandardMaterial({ color: 0x27314a, roughness: 0.95 }));
    manchet.position.set(0.030 * S, -0.104 * S, 0.112 * S); manchet.rotation.set(-0.26, 0.34, 0.06);
    g.add(slide, kast, barrel, handle, beugel, sight, korrel, flash, vuist, duim, pols, arm, manchet);
    this.flash = flash;
    g.position.set(0.15, -0.13, -0.42);
    g.rotation.set(0, 0.10, 0.06);
    this.gun = g;
    this.wapenUit = false;      // pistool weggestopt (toets H)
    this.camera.add(g);
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
    this.reloading = 1.4;
    geluid.herladen();
  }

  shoot() {
    if (this.inCar || this.reloading > 0 || this.wapenUit) return;
    if (this.ammo <= 0) { this.reload(); return; }
    this.ammo--;
    this.recoil = 1; this.flashT = 0.06;
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
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  update(dt) {
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) { const need = 12 - this.ammo; const take = Math.min(need, this.reserve); this.ammo += take; this.reserve -= take; this.reloading = 0; }
    }
    if (this.inCar) return; // camera wordt door de auto bestuurd

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
    [nx, nz] = resolveCollisions(nx, nz, 0.35);
    /*
     Auto's staan niet in resolveCollisions — die lijst is voor de vaste wereld
     en auto's bewegen. Zonder deze stap loop je er dwars doorheen. main.js hangt
     `blokkade` op js/vehicles.js; daarna nog één keer langs de vaste wereld,
     zodat een duwtje uit een auto je niet een gevel in werkt.
    */
    if (this.blokkade) {
      const [bx, bz] = this.blokkade(nx, nz, 0.35);
      if (bx !== nx || bz !== nz) [nx, nz] = resolveCollisions(bx, bz, 0.35);
    }
    if (pointInWater(nx, nz)) { // niet het water in: probeer per as
      if (!pointInWater(nx, this.pos.z)) nz = this.pos.z; else if (!pointInWater(this.pos.x, nz)) nx = this.pos.x; else { nx = this.pos.x; nz = this.pos.z; }
    }
    this.pos.x = nx; this.pos.z = nz;

    // springen / zwaartekracht
    if (this.keys.Space) this.jump();
    this.vy -= 12 * dt; this.pos.y += this.vy * dt;
    if (this.pos.y <= 0) { this.pos.y = 0; this.vy = 0; this.onGround = true; }

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
    this.camera.rotation.y = this.yaw; this.camera.rotation.x = this.pitch;

    // wapenanimatie
    this.recoil = Math.max(0, this.recoil - dt * 6);
    this.gun.position.z = -0.42 + this.recoil * 0.05;
    this.gun.rotation.x = this.recoil * 0.25 + (this.reloading > 0 ? 0.6 : 0);
    this.gun.position.y = -0.13 + Math.sin(this.bob) * 0.006;
    this.flashT -= dt; this.flash.material.opacity = this.flashT > 0 ? 0.9 : 0;
    this.gun.visible = !this.wapenUit;
  }
}
