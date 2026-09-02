// Speler: first-person besturing, botsingen, pistool.
import * as THREE from 'three';
import { resolveCollisions, pointInWater } from './world.js';

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
    this.inCar = null;
    this.health = 100;
    this.ammo = 12; this.reserve = 60; this.reloading = 0;
    this.recoil = 0; this.flashT = 0;
    this.active = false;        // spel gestart
    this.pointerLocked = false; // muis vastgezet door de browser
    this.dragging = false; this.dragDist = 0;
    this.shootCb = null;

    this.buildGun();
    this.bindInput();
  }

  buildGun() {
    const g = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.45, metalness: 0.65 });
    const grip = new THREE.MeshStandardMaterial({ color: 0x2b2420, roughness: 0.9 });
    const S = 0.5; // schaal: het pistool is ~17 cm lang
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.030 * S, 0.042 * S, 0.185 * S), dark); slide.position.set(0, 0.018 * S, -0.045 * S);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.005 * S, 0.005 * S, 0.05 * S, 8), dark); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.022 * S, -0.15 * S);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.028 * S, 0.085 * S, 0.038 * S), grip); handle.position.set(0, -0.042 * S, 0.018 * S); handle.rotation.x = 0.22;
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.004 * S, 0.006 * S, 0.006 * S), dark); sight.position.set(0, 0.042 * S, -0.13 * S);
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.022 * S, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffd080, transparent: true, opacity: 0 }));
    flash.position.set(0, 0.022 * S, -0.185 * S);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.052 * S, 0.062 * S, 0.075 * S), new THREE.MeshStandardMaterial({ color: 0xd0a480, roughness: 0.95 }));
    hand.position.set(0, -0.052 * S, 0.020 * S);
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.060 * S, 0.068 * S, 0.11 * S), new THREE.MeshStandardMaterial({ color: 0x2f3a56, roughness: 0.95 }));
    sleeve.position.set(0.004 * S, -0.078 * S, 0.10 * S);
    g.add(slide, barrel, handle, sight, flash, hand, sleeve);
    this.flash = flash;
    g.position.set(0.19, -0.185, -0.45);
    g.rotation.y = -0.06;
    this.gun = g;
    this.camera.add(g);
  }

  bindInput() {
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (e.code === 'KeyR') this.reload();
      // scrollen met de spatiebalk voorkomen zodra het spel loopt
      if (this.active && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });

    // Rondkijken. Met muisvergrendeling gaat dat vanzelf; lukt die niet, dan
    // kijk je rond door met de linkerknop ingedrukt te slepen.
    document.addEventListener('mousemove', e => {
      if (!this.active) return;
      if (!this.pointerLocked && !this.dragging) return;
      const k = this.pointerLocked ? 0.0022 : 0.0032;
      this.yaw -= e.movementX * k;
      this.pitch -= e.movementY * k;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
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

  reload() {
    if (this.reloading > 0 || this.ammo === 12 || this.reserve <= 0) return;
    this.reloading = 1.4;
  }

  shoot() {
    if (this.inCar || this.reloading > 0) return;
    if (this.ammo <= 0) { this.reload(); return; }
    this.ammo--;
    this.recoil = 1; this.flashT = 0.06;
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


    const speed = (this.keys.ShiftLeft || this.keys.ShiftRight) ? 7.5 : 4.2;
    const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const r = new THREE.Vector3(-f.z, 0, f.x);
    const move = new THREE.Vector3();
    if (this.keys.KeyW || this.keys.ArrowUp) move.add(f);
    if (this.keys.KeyS || this.keys.ArrowDown) move.sub(f);
    if (this.keys.KeyD || this.keys.ArrowRight) move.add(r);
    if (this.keys.KeyA || this.keys.ArrowLeft) move.sub(r);
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed * dt);

    let nx = this.pos.x + move.x, nz = this.pos.z + move.z;
    [nx, nz] = resolveCollisions(nx, nz, 0.35);
    if (pointInWater(nx, nz)) { // niet het water in: probeer per as
      if (!pointInWater(nx, this.pos.z)) nz = this.pos.z; else if (!pointInWater(this.pos.x, nz)) nx = this.pos.x; else { nx = this.pos.x; nz = this.pos.z; }
    }
    this.pos.x = nx; this.pos.z = nz;

    // springen / zwaartekracht
    if ((this.keys.Space) && this.onGround) { this.vy = 4.6; this.onGround = false; }
    this.vy -= 12 * dt; this.pos.y += this.vy * dt;
    if (this.pos.y <= 0) { this.pos.y = 0; this.vy = 0; this.onGround = true; }

    // hoofdbeweging bij lopen
    this.bob = (this.bob || 0) + (move.lengthSq() > 0 ? dt * (speed > 5 ? 13 : 9) : 0);
    const bobY = move.lengthSq() > 0 ? Math.sin(this.bob) * 0.035 : 0;

    this.camera.position.set(this.pos.x, this.pos.y + this.eye + bobY, this.pos.z);
    this.camera.rotation.set(0, 0, 0, 'YXZ');
    this.camera.rotation.y = this.yaw; this.camera.rotation.x = this.pitch;

    // wapenanimatie
    this.recoil = Math.max(0, this.recoil - dt * 6);
    this.gun.position.z = -0.45 + this.recoil * 0.05;
    this.gun.rotation.x = this.recoil * 0.25 + (this.reloading > 0 ? 0.6 : 0);
    this.gun.position.y = -0.185 + Math.sin(this.bob) * 0.005;
    this.flashT -= dt; this.flash.material.opacity = this.flashT > 0 ? 0.9 : 0;
    this.gun.visible = true;
  }
}
