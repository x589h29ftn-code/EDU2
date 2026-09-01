// HUD: straatnaam, snelheid, munitie, minimap.
import { roadSegments } from './world.js';
import { WATER, toWorld } from './data.js';

export class HUD {
  constructor() {
    this.street = document.getElementById('street');
    this.speed = document.getElementById('speed');
    this.ammo = document.getElementById('ammo');
    this.hint = document.getElementById('hint');
    this.msg = document.getElementById('msg');
    this.canvas = document.getElementById('minimap');
    this.ctx = this.canvas.getContext('2d');
    this.msgT = 0;
  }
  show(text, t = 2.5) { this.msg.textContent = text; this.msg.style.opacity = 1; this.msgT = t; }
  update(dt, player, vehicles, npcs, streetName) {
    this.street.textContent = streetName;
    if (player.inCar) {
      this.speed.textContent = Math.round(Math.abs(player.inCar.speed) * 3.6) + ' km/u';
      this.speed.style.display = 'block'; this.ammo.style.display = 'none';
      this.hint.textContent = 'W/S gas en rem · A/D sturen · spatie handrem · E uitstappen';
    } else {
      this.speed.style.display = 'none'; this.ammo.style.display = 'block';
      this.ammo.textContent = player.reloading > 0 ? 'herladen…' : `${player.ammo} / ${player.reserve}`;
      const car = vehicles.nearestDriveable(player.pos.x, player.pos.z);
      this.hint.textContent = car ? 'Druk E om in te stappen' : 'WASD lopen · shift sprinten · spatie springen · muis kijken · LMB schieten · R herladen';
    }
    if (this.msgT > 0) { this.msgT -= dt; if (this.msgT <= 0) this.msg.style.opacity = 0; }
    this.drawMap(player, vehicles, npcs);
  }
  drawMap(player, vehicles, npcs) {
    const c = this.ctx, W = this.canvas.width, H = this.canvas.height;
    const scale = 1.35; // px per meter
    const px = player.inCar ? player.inCar.x : player.pos.x, pz = player.inCar ? player.inCar.z : player.pos.z;
    const yaw = player.inCar ? player.inCar.yaw : player.yaw;
    c.clearRect(0, 0, W, H);
    c.save();
    c.beginPath(); c.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2); c.clip();
    c.fillStyle = '#3f6a2b'; c.fillRect(0, 0, W, H);
    c.translate(W / 2, H / 2); c.rotate(-yaw + Math.PI); c.translate(-px * scale, -pz * scale);
    // water
    c.fillStyle = '#6a97a8';
    for (const poly of WATER) { c.beginPath(); poly.forEach((p, i) => { const [x, z] = toWorld(p[0], p[1]); if (i) c.lineTo(x * scale, z * scale); else c.moveTo(x * scale, z * scale); }); c.closePath(); c.fill(); }
    // wegen
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const s of roadSegments) {
      if (s.w === 0) continue;
      c.strokeStyle = s.drive ? '#d9d6cf' : '#b9a58a'; c.lineWidth = Math.max(2, s.w * scale);
      c.beginPath(); c.moveTo(s.a[0] * scale, s.a[1] * scale); c.lineTo(s.b[0] * scale, s.b[1] * scale); c.stroke();
    }
    // auto's
    c.fillStyle = '#2255dd';
    for (const car of vehicles.cars) { c.fillRect(car.x * scale - 2, car.z * scale - 2, 4, 4); }
    c.fillStyle = '#ffffff';
    for (const p of npcs.people) if (p.alive) { c.fillRect(p.mesh.position.x * scale - 1.5, p.mesh.position.z * scale - 1.5, 3, 3); }
    c.restore();
    // speler
    c.save(); c.translate(W / 2, H / 2);
    c.fillStyle = '#ffd400'; c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(-5, 6); c.closePath(); c.fill();
    c.restore();
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 2; c.beginPath(); c.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2); c.stroke();
    // noordpijl
    c.save(); c.translate(W / 2, H / 2); c.rotate(-yaw + Math.PI);
    c.fillStyle = '#ff5544'; c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.fillText('N', 0, -(W / 2 - 12));
    c.restore();
  }
}
