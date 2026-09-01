// Speler: first-person besturing, botsingen, pistool.
import * as THREE from 'three';
import { resolveCollisions, pointInWater } from './world.js';

export class Player {
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
    this.locked = false;
    this.shootCb = null;

    this.buildGun();
    this.bindInput();
  }

  buildGun() {
    const g = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.5, metalness: 0.6 });
    const grip = new THREE.MeshStandardMaterial({ color: 0x2b2420, roughness: 0.9 });
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.045, 0.2), dark); slide.position.set(0, 0.02, -0.05);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.06, 8), dark); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.025, -0.17);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.04), grip); handle.position.set(0, -0.045, 0.02); handle.rotation.x = 0.25;
    const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.02, 0.006), dark); trigger.position.set(0, -0.015, -0.02);
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffd080, transparent: true, opacity: 0 }));
    flash.position.set(0, 0.025, -0.21);
    g.add(slide, barrel, handle, trigger, flash);
    this.flash = flash;
    g.position.set(0.18, -0.16, -0.32);
    this.gun = g;
    this.camera.add(g);
    // arm/hand suggestie
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.09), new THREE.MeshStandardMaterial({ color: 0xd9b48f, roughness: 0.9 }));
    hand.position.set(0, -0.06, 0.03); g.add(hand);
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.16), new THREE.MeshStandardMaterial({ color: 0x2f3a56, roughness: 0.9 }));
    sleeve.position.set(0.01, -0.09, 0.14); g.add(sleeve);
  }

  bindInput() {
    window.addEventListener('keydown', e => { this.keys[e.code] = true; if (e.code === 'KeyR') this.reload(); });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    document.addEventListener('mousemove', e => {
      if (!this.locked) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch -= e.movementY * 0.0022;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    });
    document.addEventListener('mousedown', e => {
      if (!this.locked) return;
      if (e.button === 0) this.shoot();
    });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement != null; });
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
    this.gun.position.z = -0.32 + this.recoil * 0.06;
    this.gun.rotation.x = this.recoil * 0.25 + (this.reloading > 0 ? 0.6 : 0);
    this.gun.position.y = -0.16 + Math.sin(this.bob) * 0.006;
    this.flashT -= dt; this.flash.material.opacity = this.flashT > 0 ? 0.9 : 0;
    this.gun.visible = true;
  }
}
