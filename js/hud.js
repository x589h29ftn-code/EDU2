// HUD: straatnaam, snelheid, munitie, minimap.
import { roadSegments } from './world.js';
import { WATER, ROADS, toWorld } from './data.js';
import { KAART, waterRingen, kaartLabels } from './kaartwereld.js';

// Waterpolygonen in meters, uit de kaart of uit data.js.
function waterVlakken() {
  return KAART ? waterRingen : WATER.map(poly => poly.map(p => toWorld(p[0], p[1])));
}

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
    this.big = document.getElementById('bigmap');
    this.bigOpen = false;
    window.addEventListener('keydown', e => { if (e.code === 'KeyM') this.toggleBig(); });
    // labelposities: per straatnaam het langste stuk
    this.labels = [];
    const seen = new Map();
    if (KAART) {
      // straatnaamlabels uit de BGT: positie en hoek zoals op de kaart
      for (const l of kaartLabels) {
        const h = l.hoek * Math.PI / 180, dx = Math.cos(h) * 15, dz = -Math.sin(h) * 15;
        this.labels.push({ name: l.t, L: 30, a: [l.x - dx, l.z - dz], b: [l.x + dx, l.z + dz] });
      }
    }
    for (const r of KAART ? [] : ROADS) {
      if (['Fietspad', 'Voetpad'].includes(r.name)) continue;
      const p = r.pts.map(q => toWorld(q[0], q[1]));
      let best = null;
      for (let i = 0; i < p.length - 1; i++) {
        const L = Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]);
        if (!best || L > best.L) best = { L, a: p[i], b: p[i + 1] };
      }
      const prev = seen.get(r.name);
      if (!prev || best.L > prev.L) seen.set(r.name, best);
      // Molenkrite is lang: extra labels op elk los stuk
      if (['Molenkrite', 'Jasker', 'De Wieken', 'Bonkelaar', 'Monnikmolen'].includes(r.name) && best.L > 40) {
        const mx = (best.a[0] + best.b[0]) / 2, mz = (best.a[1] + best.b[1]) / 2;
        const near = this.labels.some(l => l.name === r.name && Math.hypot((l.a[0] + l.b[0]) / 2 - mx, (l.a[1] + l.b[1]) / 2 - mz) < 90);
        if (!near) this.labels.push({ name: r.name, ...best });
      }
    }
    for (const [name, b] of seen) if (!this.labels.some(l => l.name === name)) this.labels.push({ name, ...b });
  }
  drawLabels(c, scale, rot, minLen) {
    c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const l of this.labels) {
      if (l.L * scale < minLen) continue;
      const mx = (l.a[0] + l.b[0]) / 2 * scale, mz = (l.a[1] + l.b[1]) / 2 * scale;
      let ang = Math.atan2(l.b[1] - l.a[1], l.b[0] - l.a[0]);
      let screenAng = ang + rot;
      screenAng = ((screenAng % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      if (screenAng > Math.PI / 2 && screenAng < Math.PI * 1.5) ang += Math.PI;
      c.save(); c.translate(mx, mz); c.rotate(ang);
      c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.75)'; c.strokeText(l.name, 0, -7);
      c.fillStyle = '#fff'; c.fillText(l.name, 0, -7);
      c.restore();
    }
  }
  show(text, t = 2.5) { this.msg.textContent = text; this.msg.style.opacity = 1; this.msgT = t; }
  toggleBig() { this.bigOpen = !this.bigOpen; this.big.style.display = this.bigOpen ? 'block' : 'none'; }
  // praten = er staat iemand naast je of er loopt een gesprek; dan gaat E over
  // praten en niet over instappen (zie praatOfAuto in main.js)
  update(dt, player, vehicles, npcs, streetName, praten = false) {
    this.street.textContent = streetName;
    if (player.inCar) {
      this.speed.textContent = Math.round(Math.abs(player.inCar.speed) * 3.6) + ' km/u';
      this.speed.style.display = 'block'; this.ammo.style.display = 'none';
      this.hint.textContent = 'W/S gas en rem · A/D sturen · spatie handrem · E uitstappen';
    } else {
      this.speed.style.display = 'none'; this.ammo.style.display = 'block';
      this.ammo.textContent = player.reloading > 0 ? 'herladen…' : `${player.ammo} / ${player.reserve}`;
      const car = vehicles.nearestDriveable(player.pos.x, player.pos.z);
      this.hint.textContent = (car && !praten) ? 'Druk E om in te stappen' : 'WASD lopen · shift sprinten · spatie springen · muis kijken · LMB schieten · R herladen · M kaart';
    }
    if (this.msgT > 0) { this.msgT -= dt; if (this.msgT <= 0) this.msg.style.opacity = 0; }
    this.drawMap(player, vehicles, npcs);
    if (this.bigOpen) this.drawBig(player, vehicles);
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
    for (const poly of waterVlakken()) { c.beginPath(); poly.forEach(([x, z], i) => { if (i) c.lineTo(x * scale, z * scale); else c.moveTo(x * scale, z * scale); }); c.closePath(); c.fill(); }
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
    for (const p of npcs.people) if (p.alive) { c.fillRect(p.x * scale - 1.5, p.z * scale - 1.5, 3, 3); }
    this.drawLabels(c, scale, -yaw + Math.PI, 40);
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

HUD.prototype.drawBig = function (player, vehicles) {
  const cv = this.big, c = cv.getContext('2d');
  const W = cv.width = Math.min(window.innerWidth - 80, 1100), H = cv.height = Math.min(window.innerHeight - 80, 760);
  c.clearRect(0, 0, W, H);
  c.fillStyle = 'rgba(8,14,24,0.92)'; c.fillRect(0, 0, W, H);
  // wereldgrenzen (m)
  const g = KAART ? KAART.gebied : { x0: -140, x1: 280, z0: -290, z1: 300 };
  const minX = g.x0, maxX = g.x1, minZ = g.z0, maxZ = g.z1;
  const scale = Math.min(W / (maxX - minX), H / (maxZ - minZ));
  c.save(); c.translate(W / 2, H / 2); c.scale(scale, scale); c.translate(-(minX + maxX) / 2, -(minZ + maxZ) / 2);
  c.fillStyle = '#3f6a2b'; c.fillRect(minX, minZ, maxX - minX, maxZ - minZ);
  c.fillStyle = '#6a97a8';
  for (const poly of waterVlakken()) { c.beginPath(); poly.forEach(([x, z], i) => { if (i) c.lineTo(x, z); else c.moveTo(x, z); }); c.closePath(); c.fill(); }
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const s of roadSegments) {
    if (s.w === 0) continue;
    c.strokeStyle = s.drive ? '#d9d6cf' : '#b9a58a'; c.lineWidth = Math.max(1.5, s.w);
    c.beginPath(); c.moveTo(s.a[0], s.a[1]); c.lineTo(s.b[0], s.b[1]); c.stroke();
  }
  c.fillStyle = '#2255dd';
  for (const car of vehicles.cars) c.fillRect(car.x - 1.2, car.z - 1.2, 2.4, 2.4);
  const px = player.inCar ? player.inCar.x : player.pos.x, pz = player.inCar ? player.inCar.z : player.pos.z;
  const yaw = player.inCar ? player.inCar.yaw : player.yaw;
  c.save(); c.translate(px, pz); c.rotate(-yaw + Math.PI);
  c.fillStyle = '#ffd400'; c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(-5, 6); c.closePath(); c.fill(); c.restore();
  c.restore();
  // labels in schermcoördinaten
  c.save(); c.translate(W / 2, H / 2); c.translate(-(minX + maxX) / 2 * scale, -(minZ + maxZ) / 2 * scale);
  this.drawLabels(c, scale, 0, 0);
  c.restore();
  const sluit = document.body.classList.contains('touch') ? 'tik weer op de kaartknop' : 'M om te sluiten';
  c.fillStyle = '#fff'; c.font = 'bold 16px sans-serif'; c.textAlign = 'left'; c.fillText(`TINGA · SNEEK — kaart (${sluit}, noorden boven)`, 16, 26);
};
