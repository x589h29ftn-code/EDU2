// Procedurele textures (canvas) – baksteen, dakpannen, klinkers, asfalt, gras, water, gevels.
import * as THREE from 'three';

const cache = new Map();

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Deterministische pseudo-random
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function tex(c, repeatX = 1, repeatY = 1, anis = 8) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = anis;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function shade(hex, f) {
  const c = new THREE.Color(hex);
  c.r = Math.min(1, c.r * f); c.g = Math.min(1, c.g * f); c.b = Math.min(1, c.b * f);
  return '#' + c.getHexString();
}

// ---------- Baksteen ----------
export function brick(base = '#8a6752', mortar = '#b9b2a6', seed = 1) {
  const key = `brick${base}${mortar}${seed}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(512, 512); const g = c.getContext('2d');
  const r = rng(seed);
  g.fillStyle = mortar; g.fillRect(0, 0, 512, 512);
  const bw = 64, bh = 24; // 4 stenen breed per 512 = ~ 21cm steen als 512px = 3.4m? we use 512px = 2.6m
  for (let y = 0, row = 0; y < 512; y += bh + 3, row++) {
    const offs = (row % 2) * (bw / 2);
    for (let x = -bw; x < 512 + bw; x += bw + 3) {
      const f = 0.82 + r() * 0.36;
      g.fillStyle = shade(base, f);
      g.fillRect(x + offs, y, bw, bh);
      // lichte kleurvariatie in de steen
      g.fillStyle = 'rgba(0,0,0,' + (r() * 0.12) + ')';
      g.fillRect(x + offs + r() * bw * 0.6, y, bw * 0.3, bh);
    }
  }
  const t = tex(c, 1, 1); cache.set(key, t); return t;
}

// ---------- Pleisterwerk ----------
export function plaster(base = '#ece9e2', seed = 3) {
  const key = `plaster${base}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(256, 256); const g = c.getContext('2d');
  const r = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 6000; i++) {
    g.fillStyle = `rgba(0,0,0,${r() * 0.07})`;
    g.fillRect(r() * 256, r() * 256, 2, 2);
  }
  const t = tex(c); cache.set(key, t); return t;
}

// ---------- Dakpannen ----------
export function roofTiles(base = '#4a3a33', seed = 5) {
  const key = `roof${base}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(512, 512); const g = c.getContext('2d');
  const r = rng(seed);
  g.fillStyle = shade(base, 0.6); g.fillRect(0, 0, 512, 512);
  const tw = 42, th = 34;
  for (let y = 0, row = 0; y < 512 + th; y += th, row++) {
    const offs = (row % 2) * tw / 2;
    for (let x = -tw; x < 512 + tw; x += tw) {
      const f = 0.8 + r() * 0.45;
      g.fillStyle = shade(base, f);
      g.beginPath();
      g.moveTo(x + offs, y);
      g.lineTo(x + offs + tw, y);
      g.lineTo(x + offs + tw, y + th - 6);
      g.quadraticCurveTo(x + offs + tw / 2, y + th + 6, x + offs, y + th - 6);
      g.closePath(); g.fill();
      // golving / glans
      g.fillStyle = 'rgba(255,255,255,' + (0.04 + r() * 0.06) + ')';
      g.fillRect(x + offs + 6, y + 4, tw * 0.35, th - 10);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(x + offs, y + th - 8, tw, 3);
      if (r() < 0.12) { // mos
        g.fillStyle = 'rgba(120,140,60,0.5)';
        g.fillRect(x + offs + r() * tw, y + r() * th, 8, 6);
      }
    }
  }
  const t = tex(c); cache.set(key, t); return t;
}

// ---------- Bitumen plat dak ----------
export function bitumen() {
  if (cache.has('bit')) return cache.get('bit');
  const c = canvas(256, 256); const g = c.getContext('2d');
  const r = rng(9);
  g.fillStyle = '#5a5a58'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(${200 + r() * 55},${200 + r() * 55},${200 + r() * 40},${r() * 0.25})`;
    g.fillRect(r() * 256, r() * 256, 2, 2);
  }
  const t = tex(c); cache.set('bit', t); return t;
}

// ---------- Klinkers ----------
export function klinkers(kind = 'grijs') {
  const key = 'kl' + kind;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(512, 512); const g = c.getContext('2d');
  const r = rng(kind === 'grijs' ? 11 : 12);
  const base = kind === 'grijs' ? '#7d7c78' : '#8d4a3c';
  const joint = kind === 'grijs' ? '#5c5b57' : '#5a3a33';
  g.fillStyle = joint; g.fillRect(0, 0, 512, 512);
  // 512 px = 2.0 m ; steen 21 x 10.5 cm -> 54 x 27 px
  const sw = 54, sh = 27;
  if (kind === 'rood') {
    // keperverband (visgraat) – blokken van 2 stenen afwisselend
    g.save(); g.translate(256, 256); g.rotate(Math.PI / 4); g.translate(-400, -400);
    for (let y = 0; y < 800; y += sh + 2) {
      for (let x = 0, k = Math.round(y / (sh + 2)) % 2; x < 800; x += sw + 2, k++) {
        const f = 0.75 + r() * 0.5;
        g.fillStyle = shade(base, f);
        if (k % 2) g.fillRect(x, y, sw, sh); else g.fillRect(x, y, sh, sw);
      }
    }
    g.restore();
  } else {
    // elleboogverband/halfsteens
    for (let y = 0, row = 0; y < 512; y += sh + 2, row++) {
      const offs = (row % 2) * sw / 2;
      for (let x = -sw; x < 512 + sw; x += sw + 2) {
        const f = 0.72 + r() * 0.55;
        g.fillStyle = shade(base, f);
        g.fillRect(x + offs, y, sw, sh);
        g.fillStyle = `rgba(255,255,255,${r() * 0.08})`;
        g.fillRect(x + offs + 4, y + 3, sw - 8, 5);
      }
    }
  }
  const t = tex(c); cache.set(key, t); return t;
}

// ---------- Stoeptegels 30x30 ----------
export function tiles() {
  if (cache.has('tiles')) return cache.get('tiles');
  const c = canvas(256, 256); const g = c.getContext('2d');
  const r = rng(21);
  g.fillStyle = '#6c6b66'; g.fillRect(0, 0, 256, 256);
  const s = 64; // 256px = 1.2m -> 4 tegels van 30cm
  for (let y = 0; y < 256; y += s) for (let x = 0; x < 256; x += s) {
    g.fillStyle = shade('#a8a6a0', 0.85 + r() * 0.3);
    g.fillRect(x + 1, y + 1, s - 2, s - 2);
  }
  const t = tex(c); cache.set('tiles', t); return t;
}

// ---------- Asfalt ----------
export function asphalt() {
  if (cache.has('asf')) return cache.get('asf');
  const c = canvas(512, 512); const g = c.getContext('2d');
  const r = rng(31);
  g.fillStyle = '#5b5b5c'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 40000; i++) {
    const v = 60 + r() * 80;
    g.fillStyle = `rgba(${v},${v},${v + 4},0.6)`;
    g.fillRect(r() * 512, r() * 512, 2, 2);
  }
  const t = tex(c); cache.set('asf', t); return t;
}

// ---------- Gras ----------
export function grass() {
  if (cache.has('grass')) return cache.get('grass');
  const c = canvas(512, 512); const g = c.getContext('2d');
  const r = rng(41);
  g.fillStyle = '#4f7a2e'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 60000; i++) {
    const gr = 90 + r() * 80, rd = 50 + r() * 50;
    g.fillStyle = `rgba(${rd},${gr},${30 + r() * 30},0.7)`;
    g.fillRect(r() * 512, r() * 512, 2, 3);
  }
  const t = tex(c); cache.set('grass', t); return t;
}

// ---------- Water ----------
export function water() {
  if (cache.has('water')) return cache.get('water');
  const c = canvas(256, 256); const g = c.getContext('2d');
  const r = rng(51);
  g.fillStyle = '#6d8f92'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 400; i++) {
    g.strokeStyle = `rgba(225,240,248,${0.10 + r() * 0.22})`;
    g.lineWidth = 1 + r() * 2;
    const x = r() * 256, y = r() * 256;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 10 + r() * 30, y + (r() - 0.5) * 4); g.stroke();
  }
  const t = tex(c); cache.set('water', t); return t;
}

// ---------- Heg (blad) ----------
export function hedge() {
  if (cache.has('hedge')) return cache.get('hedge');
  const c = canvas(256, 256); const g = c.getContext('2d');
  const r = rng(61);
  g.fillStyle = '#284a1c'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = `rgba(${40 + r() * 60},${90 + r() * 90},${30 + r() * 30},0.85)`;
    g.beginPath(); g.ellipse(r() * 256, r() * 256, 3 + r() * 4, 2 + r() * 3, r() * 3, 0, 6.3); g.fill();
  }
  const t = tex(c); cache.set('hedge', t); return t;
}

// ---------- Boomblad (alpha) ----------
export function leaves(tint = '#4a7a2a') {
  const key = 'leaves' + tint;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(256, 256); const g = c.getContext('2d');
  const r = rng(71);
  g.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const f = 0.7 + r() * 0.6;
    g.fillStyle = shade(tint, f);
    const x = r() * 256, y = r() * 256;
    g.beginPath(); g.ellipse(x, y, 5 + r() * 9, 4 + r() * 6, r() * 3, 0, 6.3); g.fill();
  }
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; cache.set(key, t); return t;
}

// ---------- Gevel per huistype ----------
// Levert een canvas texture met `n` huizen naast elkaar, `storeys` verdiepingen.
// Elke huis-eenheid = 256 px breed; hoogte = storeys*3m -> 96px per meter... we gebruiken 128px per meter.
export const HOUSE_STYLES = {
  molenkrite: { brick: ['#96755b', '#c0b7a6'], frame: '#ffffff', frame2: '#1f3a6e', door: ['#1f3a6e', '#2a2a2a', '#7a1f1f', '#1f3a6e'], roof: '#4e3d34', roofType: 'gable', storeys: 2, w: 5.4, dormer: true, chimney: false, solar: true, band: '#f2f2f2' },
  monnik:     { brick: ['#8a5a45', '#bfb5a6'], frame: '#ffffff', frame2: '#ffffff', door: ['#2a2a2a', '#5a2d1a', '#1f3a6e'], roof: '#463c37', roofType: 'gable', storeys: 2, w: 5.4, dormer: false, chimney: true, band: '#f2f2f2' },
  kruirad:    { brick: ['#9a4a3a', '#c9c0b0'], frame: '#ffffff', frame2: '#ffffff', door: ['#1f3a6e', '#2a2a2a', '#3a6e2a'], roof: '#483c35', roofType: 'gable', storeys: 2, w: 5.4, dormer: true, chimney: true, band: '#f2f2f2' },
  molenpaal:  { brick: ['#d3bd8e', '#e5dccb'], frame: '#ffffff', frame2: '#ffffff', door: ['#2a2a2a', '#1f3a6e', '#4a4a4a'], roof: '#453b37', roofType: 'gable', storeys: 2, w: 5.6, dormer: true, dormerBand: true, chimney: false, solar: true, band: '#f2f2f2' },
  jasker_flat:{ brick: ['#e0d0a6', '#e8e0cd'], frame: '#2b2b2b', frame2: '#2b2b2b', door: ['#2b2b2b', '#3a3a3a'], roof: '#555', roofType: 'flat', storeys: 2, w: 5.6, dormer: false, chimney: false, band: '#2b2b2b' },
  jasker_gable:{ brick: ['#dcc89a', '#e5ddcb'], frame: '#ffffff', frame2: '#ffffff', door: ['#2a2a2a', '#1f3a6e', '#6a1a1a'], roof: '#453b37', roofType: 'gable', storeys: 2, w: 5.6, dormer: false, chimney: true, band: '#f2f2f2' },
  wieken_white:{ brick: ['#d9c9a0', '#e6dfcd'], frame: '#1746a0', frame2: '#1746a0', door: ['#1746a0', '#1746a0', '#12388a'], roof: '#453b37', roofType: 'gable', storeys: 1, w: 5.5, dormer: true, chimney: true, band: '#f4f4f4' },
  wieken_yellow:{ brick: ['#cfbf94', '#e2dac6'], frame: '#1746a0', frame2: '#1746a0', door: ['#1746a0', '#12388a'], roof: '#433934', roofType: 'gable', storeys: 1, w: 5.5, dormer: true, chimney: true, solar: true, band: '#f4f4f4' },
  bonkelaar:  { brick: ['#8e4a3a', '#c9bfae'], frame: '#ffffff', frame2: '#ffffff', door: ['#2a2a2a', '#1f3a6e', '#3a6e2a'], roof: '#4a3327', roofType: 'gable', storeys: 2, w: 6.4, dormer: false, chimney: true, band: '#f2f2f2', semi: true },
  detached:   { brick: ['#7e5a48', '#c9bfae'], frame: '#ffffff', frame2: '#ffffff', door: ['#2a2a2a', '#5a2d1a'], roof: '#3b3432', roofType: 'gable', storeys: 2, w: 10.0, dormer: false, chimney: true, band: '#f2f2f2', solar: true, detached: true },
  appart:     { brick: ['#d6c08c', '#e5dccb'], frame: '#ffffff', frame2: '#ffffff', door: ['#2b2b2b'], roof: '#555', roofType: 'flat', storeys: 3, w: 7.0, dormer: false, chimney: false, band: '#f2f2f2', balcony: true },
  spil:       { brick: ['#b57a5a', '#d0c6b8'], frame: '#2b2b2b', frame2: '#2b2b2b', door: ['#2b2b2b'], roof: '#555', roofType: 'flat', storeys: 1, w: 8.0, dormer: false, chimney: false, band: '#2b2b2b' },
};

export function facade(type, n, storeys, back = false, seed = 1) {
  const key = `fac_${type}_${n}_${storeys}_${back}_${seed}`;
  if (cache.has(key)) return cache.get(key);
  const st = HOUSE_STYLES[type];
  const HW = 128; // px per huis
  const PM = HW / st.w; // px per meter
  const H = Math.round(storeys * 2.9 * PM);
  const c = canvas(HW * n, H); const g = c.getContext('2d');
  const r = rng(seed * 7 + n);

  // achtergrond baksteen / pleister
  const bimg = st.plaster ? plaster(st.brick[0]).image : brick(st.brick[0], st.brick[1], seed).image;
  const pat = g.createPattern(bimg, 'repeat');
  g.save();
  g.scale(PM * 2.6 / 512, PM * 2.6 / 512); // 512 px baksteen = 2.6 m
  g.fillStyle = pat; g.fillRect(0, 0, HW * n / (PM * 2.6 / 512), H / (PM * 2.6 / 512));
  g.restore();

  for (let i = 0; i < n; i++) {
    const x0 = i * HW;
    const mirror = (i % 2 === 1) && !st.detached;
    const doorColor = st.door[(i + seed) % st.door.length];
    // begane grond
    const gy = H - 2.9 * PM; // top begane grond
    const win = (x, y, w, h, frame, glassDark = true) => {
      g.fillStyle = frame; g.fillRect(x, y, w, h);
      g.fillStyle = glassDark ? '#28323a' : '#7d95a8';
      g.fillRect(x + 4, y + 4, w - 8, h - 8);
      // reflectie
      g.fillStyle = 'rgba(180,200,220,0.35)';
      g.fillRect(x + 6, y + 6, (w - 12) * 0.35, h - 12);
      // stijl in het midden
      g.fillStyle = frame; g.fillRect(x + w / 2 - 2, y, 4, h);
      // gordijn/vitrage onderaan
      g.fillStyle = 'rgba(235,235,230,0.55)';
      g.fillRect(x + 4, y + h * 0.65, w - 8, h * 0.35 - 4);
    };
    const door = (x, y, w, h, col) => {
      g.fillStyle = st.frame; g.fillRect(x - 3, y - 3, w + 6, h + 3);
      g.fillStyle = col; g.fillRect(x, y, w, h);
      // glasstrook
      g.fillStyle = '#28323a'; g.fillRect(x + w * 0.62, y + h * 0.08, w * 0.22, h * 0.55);
      g.fillStyle = 'rgba(200,220,240,0.4)'; g.fillRect(x + w * 0.64, y + h * 0.1, w * 0.06, h * 0.5);
      // klink
      g.fillStyle = '#cfcfcf'; g.fillRect(x + w * 0.15, y + h * 0.5, 6, 3);
      // bovenlicht
      g.fillStyle = st.frame; g.fillRect(x - 3, y - 0.5 * PM, w + 6, 0.5 * PM);
      g.fillStyle = '#28323a'; g.fillRect(x, y - 0.5 * PM + 3, w, 0.5 * PM - 6);
      // huisnummer
      g.fillStyle = '#ddd'; g.fillRect(x - 3 + w + 10, y + h * 0.2, 12, 8);
    };

    if (!back) {
      if (st.storeys >= 1 && type !== 'appart' && type !== 'spil') {
        // grote woonkamerpui + deur
        const dw = 0.95 * PM, dh = 2.15 * PM;
        const ww = (st.w - 0.95 - 1.3) * PM, wh = 1.7 * PM;
        const dx = mirror ? x0 + st.w * PM - 0.5 * PM - dw : x0 + 0.5 * PM;
        const wx = mirror ? x0 + 0.4 * PM : x0 + 0.5 * PM + dw + 0.4 * PM;
        door(dx, H - dh, dw, dh, doorColor);
        win(wx, H - 0.85 * PM - wh, ww, wh, st.frame2);
        // dorpel / plint
        g.fillStyle = '#4a4a4a'; g.fillRect(x0, H - 0.25 * PM, HW, 0.25 * PM);
      } else if (type === 'appart') {
        // appartement: per verdieping 2 ramen + balkon
        for (let s = 0; s < storeys; s++) {
          const fy = H - (s + 1) * 2.9 * PM;
          win(x0 + 0.5 * PM, fy + 0.7 * PM, 2.2 * PM, 1.5 * PM, st.frame);
          win(x0 + 4.2 * PM, fy + 0.7 * PM, 2.2 * PM, 1.5 * PM, st.frame);
          if (s === 0 && i % 3 === 0) door(x0 + 3.0 * PM, H - 2.1 * PM, 1.0 * PM, 2.1 * PM, '#2b2b2b');
          if (s > 0) { g.fillStyle = '#9aa0a8'; g.fillRect(x0 + 0.3 * PM, fy + 1.9 * PM, 2.6 * PM, 0.9 * PM); }
        }
      } else if (type === 'spil') {
        for (let k = 0; k < 3; k++) win(x0 + (0.4 + k * 2.5) * PM, H - 2.5 * PM, 2.0 * PM, 1.6 * PM, st.frame);
        if (i === 0) door(x0 + 3.0 * PM, H - 2.2 * PM, 1.6 * PM, 2.2 * PM, '#2b2b2b');
      }
      // verdieping(en) ramen
      for (let s = 1; s < storeys; s++) {
        if (type === 'appart') break;
        const fy = H - (s + 1) * 2.9 * PM;
        win(x0 + 0.5 * PM, fy + 0.8 * PM, 2.0 * PM, 1.4 * PM, st.frame);
        win(x0 + (st.w - 2.5) * PM, fy + 0.8 * PM, 2.0 * PM, 1.4 * PM, st.frame);
        if (st.w > 8) win(x0 + (st.w / 2 - 1.0) * PM, fy + 0.8 * PM, 2.0 * PM, 1.4 * PM, st.frame);
      }
    } else {
      // achtergevel: ramen + tuindeur
      for (let s = 0; s < storeys; s++) {
        const fy = H - (s + 1) * 2.9 * PM;
        if (s === 0) {
          g.fillStyle = st.frame; g.fillRect(x0 + 0.6 * PM, H - 2.2 * PM, 2.4 * PM, 2.2 * PM);
          g.fillStyle = '#28323a'; g.fillRect(x0 + 0.65 * PM, H - 2.15 * PM, 2.3 * PM, 2.05 * PM);
          win(x0 + (st.w - 2.6) * PM, fy + 1.0 * PM, 2.0 * PM, 1.3 * PM, st.frame);
        } else {
          win(x0 + 0.6 * PM, fy + 0.8 * PM, 1.6 * PM, 1.3 * PM, st.frame);
          win(x0 + (st.w - 2.4) * PM, fy + 0.8 * PM, 1.6 * PM, 1.3 * PM, st.frame);
        }
      }
    }
    // dakrand (witte boeiboord) bovenaan
    g.fillStyle = st.band; g.fillRect(x0, 0, HW, 0.28 * PM);
    // scheidingsvoeg tussen huizen
    if (!st.plaster) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x0, 0, 2, H); }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  cache.set(key, t); return t;
}

// Straatnaambord (blauw met witte tekst)
export function streetSign(name) {
  const key = 'sign' + name;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(512, 96); const g = c.getContext('2d');
  g.fillStyle = '#0b3d91'; g.fillRect(0, 0, 512, 96);
  g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(6, 6, 500, 84);
  g.fillStyle = '#fff'; g.font = 'bold 56px Arial, Helvetica, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(name, 256, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t); return t;
}

// Verkeersbord 30 km zone
export function sign30() {
  if (cache.has('s30')) return cache.get('s30');
  const c = canvas(128, 128); const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  g.fillStyle = '#d0202a'; g.beginPath(); g.arc(64, 64, 62, 0, 6.3); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 48, 0, 6.3); g.fill();
  g.fillStyle = '#111'; g.font = 'bold 52px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('30', 64, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; cache.set('s30', t); return t;
}

export function zebra() {
  if (cache.has('zebra')) return cache.get('zebra');
  const c = canvas(256, 64); const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 64);
  for (let x = 0; x < 256; x += 32) { g.fillStyle = 'rgba(240,240,240,0.9)'; g.fillRect(x, 0, 16, 64); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; cache.set('zebra', t); return t;
}

export function solarPanel() {
  if (cache.has('solar')) return cache.get('solar');
  const c = canvas(256, 256); const g = c.getContext('2d');
  g.fillStyle = '#1a2233'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#6a7690'; g.lineWidth = 3;
  for (let i = 0; i <= 256; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
  const t = tex(c); cache.set('solar', t); return t;
}

// Voorkant dakkapel: wit kozijn met donker glas
export function dormerFront(frameColor = '#ffffff') {
  const key = 'dormer' + frameColor;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(256, 128); const g = c.getContext('2d');
  g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = frameColor; g.fillRect(14, 14, 228, 100);
  g.fillStyle = '#28323a'; g.fillRect(22, 22, 212, 84);
  g.fillStyle = frameColor; g.fillRect(124, 22, 8, 84);
  g.fillStyle = 'rgba(190,210,230,0.35)'; g.fillRect(26, 26, 60, 76);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; cache.set(key, t); return t;
}
