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
// Het zaad bepaalt alleen de willekeurige schakering van de stenen. Vier
// varianten is ruim genoeg; een eigen texture per woning kostte honderden
// megabytes videogeheugen.
const BRICK_VARIANTEN = 2;
export function brick(base = '#8a6752', mortar = '#b9b2a6', seed = 1) {
  seed = ((seed % BRICK_VARIANTEN) + BRICK_VARIANTEN) % BRICK_VARIANTEN;
  const key = `brick${base}${mortar}${seed}`;
  if (cache.has(key)) return cache.get(key);
  // 512 px voor 2,6 m is 197 px/m. Waalformaat: 21 x 5 cm steen met een voeg
  // van ruim een centimeter, in halfsteensverband.
  const S = 512, PM = S / 2.6;
  const c = canvas(S, S); const g = c.getContext('2d');
  const r = rng(seed + 3);
  // voeg: iets donkerder en grijzer dan opgegeven, met korrel
  g.fillStyle = shade(mortar, 0.9); g.fillRect(0, 0, S, S);
  for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.08})`; g.fillRect(r() * S, r() * S, 2, 2); }
  const bw = 0.21 * PM, bh = 0.052 * PM, voeg = 0.012 * PM;
  const rijen = Math.ceil(S / (bh + voeg)) + 1;
  for (let row = 0; row < rijen; row++) {
    const y = row * (bh + voeg);
    const offs = (row % 2) * ((bw + voeg) / 2);
    for (let x = -bw - voeg; x < S + bw; x += bw + voeg) {
      // kleurschakering per steen: een deel van de stenen is duidelijk
      // donkerder of lichter, de rest wijkt maar weinig af
      const uitschieter = r() < 0.12;
      const f = uitschieter ? 0.7 + r() * 0.6 : 0.9 + r() * 0.2;
      g.fillStyle = shade(base, f);
      g.fillRect(x + offs, y, bw, bh);
      // korrel en een licht bovenrandje geven de steen reliëf
      g.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.12})`;
      g.fillRect(x + offs + r() * bw * 0.7, y + r() * bh * 0.5, bw * 0.3, bh * 0.5);
      g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x + offs, y, bw, 1.5);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x + offs, y + bh - 1.5, bw, 1.5);
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

/*
 Pannendak met dakramen erin (Tinga State, Molenkrite 115). De kap van een
 stelpboerderij is één groot vlak van de nok tot bijna de grond, met rijen
 dakramen erin. Het dakvlak wordt in kaartwereld.js op 0,25 texture per meter
 gelegd, dus dit canvas van 512 px staat voor 4 bij 4 m: één dakraam van 0,8 bij
 1,2 m per vier meter dak geeft ongeveer de rijen van de foto.
*/
export function pannenMetDakramen(base = '#a8512c') {
  const key = `roofram${base}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(512, 512); const g = c.getContext('2d');
  const bron = roofTiles(base, 5).image;
  g.drawImage(bron, 0, 0);
  // dakraam: grijs kader, donker glas met een schuine weerspiegeling
  const bw = Math.round(512 * 0.8 / 4), bh = Math.round(512 * 1.2 / 4);
  const bx = Math.round(512 * 0.42), by = Math.round(512 * 0.34);
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(bx - 4, by - 4, bw + 8, bh + 8);
  g.fillStyle = '#9aa0a6'; g.fillRect(bx, by, bw, bh);
  g.fillStyle = '#2a3238'; g.fillRect(bx + 7, by + 7, bw - 14, bh - 14);
  g.fillStyle = 'rgba(190,215,238,0.45)';
  g.beginPath();
  g.moveTo(bx + 8, by + 8); g.lineTo(bx + bw * 0.62, by + 8);
  g.lineTo(bx + bw * 0.22, by + bh - 8); g.lineTo(bx + 8, by + bh - 8);
  g.closePath(); g.fill();
  g.fillStyle = '#c9ccd0'; g.fillRect(bx + bw * 0.3, by + 2, bw * 0.4, 5);   // greep bovenaan
  const t = tex(c); cache.set(key, t); return t;
}

/*
 De gele Jumbo-vlag aan de masten voor de ingang (js/props.js). Portret, met
 het woordmerk twee keer op zijn kant, zoals op de foto.
*/
export function jumboVlag() {
  if (cache.has('jumbovlag')) return cache.get('jumbovlag');
  const c = canvas(128, 512); const g = c.getContext('2d');
  // De voorkant van het doek is het -Z-vlak van de doos in props.js, en dat
  // vlak leest de texture gespiegeld; het canvas gaat er dus omgekeerd in. De
  // achterkant staat daardoor in spiegelschrift, net als bij een echte vlag.
  g.translate(128, 0); g.scale(-1, 1);
  g.fillStyle = '#ffd200'; g.fillRect(0, 0, 128, 512);
  // vouwen in het doek
  for (let x = 0; x < 128; x += 16) {
    g.fillStyle = `rgba(0,0,0,${0.04 + (x / 128) * 0.08})`;
    g.fillRect(x, 0, 8, 512);
  }
  g.save();
  g.translate(64, 256);
  g.rotate(-Math.PI / 2);
  g.fillStyle = '#2b2b28';
  g.font = 'bold 74px sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('JUMBO', 0, 0);
  g.restore();
  // zoom langs de mastkant
  g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(0, 0, 6, 512);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace;
  cache.set('jumbovlag', t); return t;
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
  const base = kind === 'grijs' ? '#7d7c78' : '#7d4034';
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
  // 512 px = 1,2 m: vier tegels van 30 cm met een voeg van een centimeter
  const S = 512, s = 128;
  const c = canvas(S, S); const g = c.getContext('2d');
  const r = rng(21);
  g.fillStyle = '#5e5d58'; g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += s) for (let x = 0; x < S; x += s) {
    g.fillStyle = shade('#a9a7a1', 0.86 + r() * 0.26);
    g.fillRect(x + 3, y + 3, s - 6, s - 6);
    // korrel en een lichte bovenrand (licht van boven)
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.12})`; g.fillRect(x + 3 + r() * (s - 6), y + 3 + r() * (s - 6), 2, 2); }
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x + 3, y + 3, s - 6, 3);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x + 3, y + s - 6, s - 6, 3);
    if (r() < 0.15) { g.fillStyle = 'rgba(60,80,30,0.35)'; g.fillRect(x + 3, y + 3, s - 6, 3); }   // mos in de voeg
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
  // 512 px = 4 m: fijne sprieten, met kleurvlekken (klaver, dor gras) zodat
  // de herhaling niet opvalt.
  const S = 512;
  const c = canvas(S, S); const g = c.getContext('2d');
  const r = rng(41);
  g.fillStyle = '#4c7a2c'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 40; i++) {
    const x = r() * S, y = r() * S, rad = 30 + r() * 90;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    const tint = r() < 0.5 ? `rgba(120,150,60,${0.25 + r() * 0.3})` : `rgba(50,95,35,${0.25 + r() * 0.3})`;
    gr.addColorStop(0, tint); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 90000; i++) {
    const gr = 95 + r() * 90, rd = 45 + r() * 60;
    g.fillStyle = `rgba(${rd},${gr},${25 + r() * 35},${0.55 + r() * 0.35})`;
    const x = r() * S, y = r() * S;
    g.fillRect(x, y, 1.5, 2 + r() * 3);
  }
  // paar bruine blaadjes en madeliefjes
  for (let i = 0; i < 260; i++) { g.fillStyle = r() < 0.6 ? `rgba(${120 + r() * 60},${80 + r() * 40},30,0.7)` : 'rgba(240,240,230,0.8)'; g.fillRect(r() * S, r() * S, 2 + r() * 2, 2); }
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
// Ligusterhagen in Tinga zijn fris groen, niet bijna zwart. Een berberis of
// rode beuk krijgt zijn eigen bladkleur in de texture; die met een rood
// materiaal over het groen heen tinten leverde vieze zwarte blokken op.
const HAAG_KLEUREN = {
  groen: { basis: '#3a6329', blad: [62, 70, 112, 95, 40, 38] },
  rood:  { basis: '#5c2a26', blad: [125, 75, 48, 40, 40, 34] },
};
export function hedge(soort = 'groen') {
  const key = 'hedge' + soort;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(256, 256); const g = c.getContext('2d');
  const r = rng(soort === 'groen' ? 61 : 62);
  const k = HAAG_KLEUREN[soort] || HAAG_KLEUREN.groen;
  const [r0, rd, g0, gd, b0, bd] = k.blad;
  g.fillStyle = k.basis; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = `rgba(${r0 + r() * rd},${g0 + r() * gd},${b0 + r() * bd},0.85)`;
    g.beginPath(); g.ellipse(r() * 256, r() * 256, 3 + r() * 4, 2 + r() * 3, r() * 3, 0, 6.3); g.fill();
  }
  const t = tex(c); cache.set(key, t); return t;
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
  // Kleuren en details per woningtype. Bron: de Street View-foto's in
  // data/stijl/fotos/ (zie docs/steekproef/README.md). Heel Tinga is gebouwd
  // in lichtgele tot beige baksteen met donkerbruine pannen en witte
  // boeiboorden; het verschil zit in de kleur van deuren en kozijnaccenten,
  // de dakvorm en de details (dakkapel, dakraam, zonnepanelen, luifel).
  //
  // Molenkrite, tweelaags deel (nog niet met een foto bevestigd)
  molenkrite: { brick: ['#b39a75', '#d2c9b6'], frame: '#ffffff', frame2: '#1f2f4f', door: ['#1f3a2a', '#1f2f5f', '#2a2a2a'], roof: '#3d3430', roofType: 'gable', storeys: 2, w: 5.4, dormer: true, chimney: false, solar: true, band: '#f2f2f2' },
  // Molenkrite 19 en 43 (foto): bungalow met de woonruimte in een steile kap
  // (goot 3,2 m, nok 9 m), grote dakkapel per woning met witte wangen, bruinbeige
  // steen, witte kozijnen met donkere accenten, donkergroene of donkerblauwe
  // voordeur, witte boeiboord boven de pui, roodbruine plint.
  molenkrite_kap: { brick: ['#a9906c', '#cfc6b4'], frame: '#ffffff', frame2: '#1f2f4f', door: ['#1f3a2a', '#1f2f5f', '#2a2a2a'], roof: '#3d3430', roofType: 'gable', storeys: 1, w: 5.4, dormer: true, dormerGroot: true, chimney: false, band: '#f2f2f2', plint: '#6a3a2e' },
  // Molenkrite 70 (foto): lage bungalow (nok 6,7 m) met een vol zonnedak, witte
  // kozijnen, rode deur en rode accenten, schoorstenen, dakramen.
  molenkrite_bung:{ brick: ['#b09772', '#d0c7b5'], frame: '#ffffff', frame2: '#c8322b', door: ['#c8322b', '#b52a24'], roof: '#3d3430', roofType: 'gable', storeys: 1, w: 5.4, dormer: false, skylight: true, solar: true, solarFull: true, chimney: true, band: '#f4f4f4' },
  // Monnikmolen 148 (foto): twee lagen, geelbeige steen, witte kozijnen met
  // rode ramen en rode deuren, witte luifel over de hele breedte boven de pui,
  // schoorsteen per woning, donker pannendak.
  monnik:     { brick: ['#c2b184', '#d9d2c0'], frame: '#ffffff', frame2: '#b8231f', door: ['#b8231f', '#a01e1b', '#8c1f2a'], roof: '#3a3330', roofType: 'gable', storeys: 2, storeyH: 2.75, w: 5.4, dormer: false, chimney: true, luifel: true, band: '#f2f2f2' },
  // Kruirad 12 (foto): twee lagen, lichtgele steen, witte kozijnen met felrode
  // draaidelen en felrode voordeur, roodbruine plint, schoorsteen per woning.
  kruirad_rood: { brick: ['#bfae83', '#d6cfbd'], frame: '#ffffff', frame2: '#c81e1e', door: ['#c81e1e', '#b51a1a'], roof: '#35302d', roofType: 'gable', storeys: 2, storeyH: 2.75, w: 5.4, dormer: false, chimney: true, band: '#f2f2f2', plint: '#5a3a30' },
  // Kruirad 50 (foto): dezelfde rij aan de hofkant, met felblauwe deur en blauwe
  // draaidelen; ervoor staan bergingen in donkerbruine steen met plat dak (die
  // zijn aparte panden in de BGT).
  kruirad:    { brick: ['#bba97f', '#d4ccb9'], frame: '#ffffff', frame2: '#1746a0', door: ['#1746a0', '#12388a'], roof: '#3a3330', roofType: 'gable', storeys: 2, storeyH: 2.75, w: 5.4, dormer: false, chimney: true, band: '#f2f2f2' },
  // Molenpaal 6 (foto, achterkant): twee lagen met kap, lichtgele steen, witte
  // kozijnen, zonnepanelen en dakramen, houten schuurtjes en schuttingen.
  molenpaal:  { brick: ['#c9bd97', '#dcd6c5'], frame: '#ffffff', frame2: '#ffffff', door: ['#2a2a2a', '#1f3a6e', '#4a4a4a'], roof: '#3a3330', roofType: 'gable', storeys: 2, w: 5.6, dormer: false, skylight: true, chimney: false, solar: true, band: '#f2f2f2' },
  // Jasker 101 (foto): platte daken, lichtgele steen, witte kozijnen en witte
  // dakrand, bergingen in steen ervoor met roodbruine plint.
  jasker_flat:{ brick: ['#c9bb90', '#dcd4c1'], frame: '#ffffff', frame2: '#ffffff', door: ['#1e1f22', '#f2f2ee'], roof: '#555', roofType: 'flat', storeys: 2, w: 5.6, dormer: false, chimney: false, band: '#f2f2f2' },
  // Jasker 7 (foto, zijkant): lichtgele steen, witte kozijnen, witte houten
  // topgevel boven de goot, lage aanbouw met plat dak en witte boeiboord.
  jasker_gable:{ brick: ['#c9b98f', '#dcd4c1'], frame: '#ffffff', frame2: '#ffffff', door: ['#2a2a2a', '#1f3a6e', '#6a1a1a'], roof: '#3a3330', roofType: 'gable', storeys: 2, w: 5.6, dormer: false, chimney: true, band: '#f2f2f2', topgevel: '#f0efe9' },
  // de Wieken 34 (foto): bungalow met de woonruimte in de kap, grote dakkapel
  // met rode kozijnen, rode deuren en rode ramen, lichtgele steen, witte
  // boeiboord, zonnepanelen op een deel van de daken.
  wieken_white:{ brick: ['#c9b98f', '#dcd4c1'], frame: '#ffffff', frame2: '#c8322b', door: ['#c8322b', '#c8322b', '#1746a0'], roof: '#3d3430', roofType: 'gable', storeys: 1, w: 5.5, dormer: true, dormerGroot: true, dormerFrame: '#c8322b', chimney: false, band: '#f4f4f4' },
  wieken_yellow:{ brick: ['#c9b98f', '#dcd4c1'], frame: '#ffffff', frame2: '#c8322b', door: ['#c8322b', '#b52a24'], roof: '#3d3430', roofType: 'gable', storeys: 1, w: 5.5, dormer: true, dormerGroot: true, dormerFrame: '#c8322b', chimney: false, solar: true, band: '#f4f4f4' },
  // Bonkelaar 11 (foto): twee-onder-een-kap in donkere roodbruine steen, witte
  // kozijnen, witte houten topgevel, donkergrijze pannen, garage of carport
  // tussen de woningen, grindtuin met klinkerpad.
  bonkelaar:  { brick: ['#7a4a3c', '#c9bfae'], frame: '#ffffff', frame2: '#ffffff', door: ['#f2f2f2', '#2a2a2a', '#1f3a6e'], roof: '#37322f', roofType: 'gable', storeys: 2, w: 6.4, dormer: false, chimney: true, band: '#f2f2f2', semi: true, topgevel: '#f2f2ee' },
  detached:   { brick: ['#7e5a48', '#c9bfae'], frame: '#ffffff', frame2: '#ffffff', door: ['#2a2a2a', '#5a2d1a'], roof: '#3b3432', roofType: 'gable', storeys: 2, w: 10.0, dormer: false, chimney: true, band: '#f2f2f2', solar: true, detached: true },
  appart:     { brick: ['#d6c08c', '#e5dccb'], frame: '#ffffff', frame2: '#ffffff', door: ['#2b2b2b'], roof: '#555', roofType: 'flat', storeys: 3, w: 7.0, dormer: false, chimney: false, band: '#f2f2f2', balcony: true },
  // Bovenas 5 (foto): één laag met de slaapkamers in de kap, lichtgele steen,
  // witte kozijnen met bordeauxrode deuren en draaidelen, dakramen,
  // schoorstenen, witte boeiboord.
  bovenas_bung:{ brick: ['#cdbf95', '#dfd8c6'], frame: '#ffffff', frame2: '#8c1f2a', door: ['#8c1f2a', '#7a1a24'], roof: '#3d3530', roofType: 'gable', storeys: 1, w: 5.4, dormer: false, skylight: true, chimney: true, band: '#f4f4f4' },
  bovenas_gal: { brick: ['#cdbf95', '#dfd8c6'], frame: '#ffffff', frame2: '#8c1f2a', door: ['#8c1f2a', '#7a1a24'], roof: '#3d3530', roofType: 'gable', storeys: 2, w: 5.4, dormer: false, skylight: true, chimney: true, gallery: true, band: '#f4f4f4' },
  tinga_groen:{ brick: ['#9a6a53', '#c9beac'], frame: '#1f4230', frame2: '#1f4230', door: ['#1f4230', '#17351f'], roof: '#4a3f37', roofType: 'gable', storeys: 2, w: 5.6, dormer: false, chimney: true, band: '#f4f4f4' },
  tinga_blauw:{ brick: ['#c9bb96', '#ded6c2'], frame: '#1746a0', frame2: '#1746a0', door: ['#1746a0', '#12388a'], roof: '#4a3b30', roofType: 'gable', storeys: 2, w: 5.6, dormer: false, chimney: true, band: '#ffffff' },
  spil:       { brick: ['#b57a5a', '#d0c6b8'], frame: '#2b2b2b', frame2: '#2b2b2b', door: ['#2b2b2b'], roof: '#555', roofType: 'flat', storeys: 1, w: 8.0, dormer: false, chimney: false, band: '#2b2b2b' },
  // Spinnekop 9 (foto): twee lagen, geelbeige steen, antracietgrijze kozijnen en
  // zwarte deur, bergingen met dakterras ervoor, zonnepanelen en dakramen.
  spinnekop:  { brick: ['#c2ae82', '#d8d1c0'], frame: '#3a3d42', frame2: '#3a3d42', door: ['#1e1f22', '#2a2d31'], roof: '#35302d', roofType: 'gable', storeys: 2, w: 5.4, dormer: false, skylight: true, solar: true, chimney: false, band: '#f2f2f2' },
  // Grootwiel 7 (foto): twee lagen met kap, grijsbruine steen, witte kozijnen,
  // zwarte deur, donkere dakkapellen, rode klinkers in de straat.
  grootwiel:  { brick: ['#8f7d68', '#c9c2b4'], frame: '#ffffff', frame2: '#ffffff', door: ['#1e1f22', '#2a2d31'], roof: '#35302d', roofType: 'gable', storeys: 2, w: 5.6, dormer: true, dormerFrame: '#3a3d42', chimney: false, band: '#f2f2f2' },
  // de Hekken 5 (foto): één laag met kap, grote dakkapel met antracietgrijze
  // kozijnen, lichte steen, zwarte deur, donkere houten topgevels bij de buren.
  hekken:     { brick: ['#b9a58a', '#d6cfc2'], frame: '#ffffff', frame2: '#3a3d42', door: ['#1e1f22'], roof: '#3a3330', roofType: 'gable', storeys: 1, w: 6.0, dormer: true, dormerGroot: true, dormerFrame: '#3a3d42', chimney: true, band: '#f2f2f2', topgevel: '#3a3530' },
  // Eekmolen 21 (foto): twee lagen met kap, roodbruine steen, witte kozijnen,
  // witte houten topgevel, garages ervoor, zonnepanelen.
  eekmolen:   { brick: ['#9a5a44', '#c9bfae'], frame: '#ffffff', frame2: '#ffffff', door: ['#f2f2ee', '#1e1f22'], roof: '#35302d', roofType: 'gable', storeys: 2, w: 5.6, dormer: false, skylight: true, solar: true, chimney: false, band: '#f2f2f2', topgevel: '#f2f2ee' },
  // RWZI Buitenroede 1 (foto Street View, 4 sep 2026): lage bedrijfsgebouwen in
  // lichtbeige tot grijze steen met plat dak en grijze dakrand, hoge smalle
  // ramen met antracietgrijze kozijnen, stalen deuren en een overheaddeur.
  // `industrieel` zet in facade() en kaartwereld.js de bedrijfsgevel aan alle
  // kanten aan (geen voor/achter, geen dakkapellen, lagen passen op de muurhoogte).
  rwzi:        { brick: ['#c8bfad', '#dad5cb'], frame: '#4a4f55', frame2: '#4a4f55', door: ['#5d636b', '#3f444a'], roof: '#4a4d50', roofType: 'flat', storeys: 1, storeyH: 3.6, w: 6.0, dormer: false, chimney: false, band: '#8d9297', plint: '#6b6862', industrieel: true },
  // het blok met blauwe stalen gevelbeplating (damwandprofiel) en blauw dak
  rwzi_blauw:  { brick: ['#2f5da8', '#2f5da8'], frame: '#c9ccd0', frame2: '#c9ccd0', door: ['#3f444a'], roof: '#2b4f8e', roofType: 'flat', storeys: 1, storeyH: 3.6, w: 6.0, dormer: false, chimney: false, band: '#1f3d70', plint: '#1f3d70', industrieel: true, damwand: true },
  // bedieningsgebouw/kantoor: lichtbruine steen, witte kozijnen met gewone
  // ramen, grijze deuren; de grijze buitentrap is een los object (props.js)
  rwzi_kantoor:{ brick: ['#c4ad86', '#d8d0bd'], frame: '#f2f2f0', frame2: '#4a4f55', door: ['#4a4f55'], roof: '#4a4d50', roofType: 'gable', storeys: 1, storeyH: 3.2, w: 6.0, dormer: false, chimney: false, band: '#8d9297', plint: '#6b6862', industrieel: true, kantoor: true },
  // Supermarkt Jumbo, Molenkrite 1 (foto Look Around, 4 sep 2026): een rij
  // puntdaken van donker metaal (die staan in het 3D BAG-model), een luifel op
  // slanke kolommen over de volle breedte, daaronder een glazen pui met witte
  // stijlen op een donkere plint, en boven de luifel de gele huisstijlband met
  // het woordmerk. `industrieel` zet de gevel aan alle kanten aan (een
  // vrijstaande winkel heeft geen achterkant) en houdt de dakkapellen uit;
  // `winkel` kiest in facade() de winkelpui, `metaaldak` de dakplaten.
  jumbo:       { brick: ['#8a7f74', '#c4bdb2'], frame: '#f4f4f2', frame2: '#f4f4f2', door: ['#3f4247'], roof: '#4b4e52', roofType: 'gable', storeys: 1, storeyH: 2.7, w: 6.0, dormer: false, chimney: false, band: '#f2f2f0', plint: '#3f4247', industrieel: true, winkel: true, metaaldak: true, geel: '#ffd200' },
  // Tinga State, Molenkrite 115 (foto, 4 sep 2026): een stelpboerderij — een
  // enorme steile piramidekap van rode pannen die van de nok op 13,3 m tot een
  // goot op 1,9 m doorloopt, met rijen dakramen erin. Daaronder een lage
  // bakstenen gevel met witte kozijnen, een zwarte schuurdeur en een terras.
  // `boerderij` kiest in facade() die lage wand, `dakramen` het pannendak met
  // dakramen erin (js/kaartwereld.js). `industrieel` houdt de wand in één stuk
  // (niet afgeknipt op de goot, want de dakvoet loopt hier van 2 tot 4 m) en
  // zet de wand aan alle kanten aan; een boerderij heeft geen achtergevel.
  tinga_state: { brick: ['#9b6a4e', '#c9bfae'], frame: '#f6f6f2', frame2: '#1f4230', door: ['#1e1f22', '#1f4230'], roof: '#a8512c', roofType: 'gable', storeys: 1, storeyH: 3.2, w: 6.0, dormer: false, chimney: false, band: '#f2f2ee', plint: '#5a3a2e', industrieel: true, boerderij: true, dakramen: true },
};

// ---------- Stalen damwandprofiel (blauwe gevelbeplating RWZI) ----------
// 512 px = 2,6 m, net als de baksteen, zodat facade() dezelfde schaal kan gebruiken.
export function damwand(kleur = '#2f5da8') {
  const key = 'damwand' + kleur;
  if (cache.has(key)) return cache.get(key);
  const S = 512, PM = S / 2.6;
  const c = canvas(S, S); const g = c.getContext('2d');
  g.fillStyle = kleur; g.fillRect(0, 0, S, S);
  const rib = 0.2 * PM;                              // profiel om de 20 cm
  for (let x = 0; x < S; x += rib) {
    g.fillStyle = shade(kleur, 1.14); g.fillRect(x, 0, rib * 0.35, S);           // lichte flank
    g.fillStyle = shade(kleur, 0.72); g.fillRect(x + rib * 0.35, 0, rib * 0.12, S); // schaduwkant
    g.fillStyle = shade(kleur, 0.9); g.fillRect(x + rib * 0.85, 0, rib * 0.15, S);
  }
  const t = tex(c); cache.set(key, t); return t;
}

// ---------- Spijlenhek (grijs stalen hek van 2 m, RWZI) ----------
// Eén paneel van 2,5 m breed = 512 px, hoogte 2 m; doorzichtig tussen de spijlen.
// De paal zit aan de linkerkant van het paneel, zodat om de 2,5 m een paal staat.
export function spijlenhek(kleur = '#7b8085') {
  const key = 'spijlen' + kleur;
  if (cache.has(key)) return cache.get(key);
  const W = 512, H = 410, PM = W / 2.5;
  const c = canvas(W, H); const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  const staaf = (x, y, w, h, f = 1) => {
    g.fillStyle = shade(kleur, f); g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x, y, Math.max(1, w * 0.3), h);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + w * 0.7, y, Math.max(1, w * 0.3), h);
  };
  for (let x = 0.10 * PM; x < W; x += 0.125 * PM) staaf(x, 0.04 * PM, 0.025 * PM, H - 0.08 * PM);   // spijlen 2,5 cm om de 12,5 cm
  g.fillStyle = shade(kleur, 0.9); g.fillRect(0, 0.10 * PM, W, 0.06 * PM); g.fillRect(0, H - 0.20 * PM, W, 0.06 * PM);   // twee liggers
  staaf(0, 0, 0.08 * PM, H, 0.85);                                                                     // paal
  const t = tex(c); t.wrapT = THREE.ClampToEdgeWrapping; cache.set(key, t); return t;
}

// ---------- Laag houten hekje: latten met tussenruimte ----------
export function hekje(kleur = '#8a7352') {
  const key = 'hekje' + kleur;
  if (cache.has(key)) return cache.get(key);
  // 256 px = 1 m breed, 128 px = 0,5 m hoog; doorzichtig tussen de latten
  const c = canvas(256, 128); const g = c.getContext('2d');
  const r = rng(77);
  g.clearRect(0, 0, 256, 128);
  for (let x = 4; x < 256; x += 23) {                 // latten van 5 cm om de 9 cm
    g.fillStyle = shade(kleur, 0.85 + r() * 0.3); g.fillRect(x, 6, 13, 122);
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x + 10, 6, 3, 122);
    g.fillStyle = shade(kleur, 1.1); g.beginPath(); g.moveTo(x, 8); g.lineTo(x + 6.5, 0); g.lineTo(x + 13, 8); g.closePath(); g.fill();
  }
  g.fillStyle = shade(kleur, 0.75); g.fillRect(0, 30, 256, 9); g.fillRect(0, 96, 256, 9);   // twee liggers
  const t = tex(c); t.wrapT = THREE.ClampToEdgeWrapping; cache.set(key, t); return t;
}

// ---------- Houten delen (witte topgevels, schuttingen) ----------
export function planks(kleur = '#f0efe9') {
  const key = 'planks' + kleur;
  if (cache.has(key)) return cache.get(key);
  // 256 px = 1,2 m: acht delen van 15 cm
  const c = canvas(256, 256); const g = c.getContext('2d');
  const r = rng(21);
  g.fillStyle = kleur; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    g.fillStyle = `rgba(0,0,0,${0.10 + r() * 0.06})`; g.fillRect(0, y, 256, 3);          // schaduw onder elk deel
    g.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.1})`; g.fillRect(0, y + 3, 256, 2);   // lichtrandje
    g.fillStyle = `rgba(0,0,0,${r() * 0.04})`; g.fillRect(0, y + 8, 256, 20);
  }
  const t = tex(c); cache.set(key, t); return t;
}

// Idem voor de gevels: zes varianten per type geeft genoeg afwisseling in
// gordijnen, deurkleuren en raamindeling zonder het geheugen op te blazen.
const GEVEL_VARIANTEN = 6;
export function facade(type, n, storeys, back = false, seed = 1) {
  seed = ((seed % GEVEL_VARIANTEN) + GEVEL_VARIANTEN) % GEVEL_VARIANTEN;
  const key = `fac_${type}_${n}_${storeys}_${back}_${seed}`;
  if (cache.has(key)) return cache.get(key);
  const st = HOUSE_STYLES[type];
  // 40 px per meter: een kozijn van 8 cm is dan drie pixels breed en een
  // deurklink is nog te zien. Dat is vier keer zo scherp als de eerste versie.
  const PM = 40;
  const HW = Math.round(st.w * PM);
  const SH = st.storeyH || 2.9;
  const H = Math.round(storeys * SH * PM);
  const c = canvas(HW * n, H); const g = c.getContext('2d');
  const r = rng(seed * 7 + n);
  const m = (v) => v * PM;   // meters -> pixels

  // achtergrond baksteen / pleister (320 px baksteen = 2,6 m)
  const bimg = st.damwand ? damwand(st.brick[0]).image : st.plaster ? plaster(st.brick[0]).image : brick(st.brick[0], st.brick[1], seed).image;
  const pat = g.createPattern(bimg, 'repeat');
  const sc = PM * 2.6 / bimg.width;
  g.save(); g.scale(sc, sc); g.fillStyle = pat; g.fillRect(0, 0, HW * n / sc, H / sc); g.restore();
  // lichte vervuiling onder de dakrand en boven de plint
  const vuil = g.createLinearGradient(0, 0, 0, H);
  vuil.addColorStop(0, 'rgba(0,0,0,0.10)'); vuil.addColorStop(0.12, 'rgba(0,0,0,0)'); vuil.addColorStop(0.9, 'rgba(0,0,0,0)'); vuil.addColorStop(1, 'rgba(0,0,0,0.12)');
  g.fillStyle = vuil; g.fillRect(0, 0, HW * n, H);

  const win = (x, y, w, h, frame, opties = {}) => {
    // latei-schaduw boven het kozijn
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x - m(0.03), y - m(0.08), w + m(0.06), m(0.08));
    // kozijn (buitenrand) en een donkere sponning erbinnen
    g.fillStyle = frame; g.fillRect(x, y, w, h);
    const k = m(0.08);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + k, y + k, w - 2 * k, h - 2 * k);
    // glas: lucht bovenin, donker onderin
    const gl = g.createLinearGradient(0, y, 0, y + h);
    gl.addColorStop(0, '#9fb6c8'); gl.addColorStop(0.45, '#3d4d5a'); gl.addColorStop(1, '#232c33');
    g.fillStyle = gl; g.fillRect(x + k + 2, y + k + 2, w - 2 * k - 4, h - 2 * k - 4);
    // schuine reflectie
    g.fillStyle = 'rgba(210,225,240,0.22)';
    g.beginPath(); g.moveTo(x + k + 2, y + k + 2); g.lineTo(x + k + 2 + (w - 2 * k) * 0.45, y + k + 2); g.lineTo(x + k + 2 + (w - 2 * k) * 0.15, y + h - k - 2); g.lineTo(x + k + 2, y + h - k - 2); g.closePath(); g.fill();
    // stijlen: middenstijl en eventueel een draaiend deel in de accentkleur
    g.fillStyle = frame; g.fillRect(x + w / 2 - m(0.04), y, m(0.08), h);
    if (opties.draai) { g.fillStyle = opties.draai; g.fillRect(x + w * 0.62, y + k, w * 0.38 - k, h - 2 * k); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + w * 0.62 + k, y + 2 * k, w * 0.38 - 3 * k, h - 4 * k); g.fillStyle = gl; g.fillRect(x + w * 0.62 + k + 2, y + 2 * k + 2, w * 0.38 - 3 * k - 4, h - 4 * k - 4); }
    // vitrage / gordijn onderin (niet bij bedrijfsramen)
    if (!opties.kaal) {
      g.fillStyle = 'rgba(238,236,228,0.6)'; g.fillRect(x + k + 2, y + h * 0.62, w - 2 * k - 4, h * 0.38 - k - 2);
      if (r() < 0.5) { g.fillStyle = 'rgba(120,90,70,0.55)'; g.fillRect(x + k + 2, y + k + 2, w * 0.12, h - 2 * k - 4); g.fillRect(x + w - k - 2 - w * 0.12, y + k + 2, w * 0.12, h - 2 * k - 4); }
    }
    // vensterbank met schaduw
    g.fillStyle = '#d9d6cf'; g.fillRect(x - m(0.04), y + h, w + m(0.08), m(0.06));
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x - m(0.04), y + h + m(0.06), w + m(0.08), m(0.05));
  };
  const door = (x, y, w, h, col) => {
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x - m(0.08), y - m(0.62), w + m(0.16), m(0.08));
    g.fillStyle = st.frame; g.fillRect(x - m(0.06), y - m(0.55), w + m(0.12), h + m(0.55));
    // bovenlicht
    g.fillStyle = '#28323a'; g.fillRect(x, y - m(0.5), w, m(0.42));
    g.fillStyle = 'rgba(200,220,240,0.35)'; g.fillRect(x + m(0.05), y - m(0.47), w * 0.35, m(0.36));
    // deurblad met een lichte rand en een glasstrook
    g.fillStyle = col; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x, y, w, m(0.03)); g.fillRect(x, y, m(0.03), h);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + w - m(0.03), y, m(0.03), h); g.fillRect(x, y + h - m(0.03), w, m(0.03));
    g.fillStyle = '#28323a'; g.fillRect(x + w * 0.6, y + h * 0.1, w * 0.25, h * 0.5);
    g.fillStyle = 'rgba(200,220,240,0.4)'; g.fillRect(x + w * 0.62, y + h * 0.12, w * 0.07, h * 0.46);
    // klink en brievenbus
    g.fillStyle = '#d8d8d8'; g.fillRect(x + w * 0.12, y + h * 0.48, m(0.14), m(0.03));
    g.fillStyle = '#c9c9c9'; g.fillRect(x + w * 0.3, y + h * 0.58, m(0.28), m(0.05));
    // huisnummerbordje en drempel
    g.fillStyle = '#e8e8e8'; g.fillRect(x + w + m(0.14), y + h * 0.18, m(0.16), m(0.11));
    g.fillStyle = '#6a6a68'; g.fillRect(x - m(0.06), y + h - m(0.04), w + m(0.12), m(0.04));
  };
  // stalen deur en overheaddeur voor de bedrijfsgevels
  const staalDeur = (x, y, w, h, col) => {
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x - m(0.05), y - m(0.08), w + m(0.1), m(0.08));
    g.fillStyle = st.frame; g.fillRect(x - m(0.05), y, w + m(0.1), h);
    g.fillStyle = col; g.fillRect(x, y, w, h - m(0.02));
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x, y, w, m(0.03));
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x + w - m(0.03), y, m(0.03), h);
    g.fillStyle = '#d8d8d8'; g.fillRect(x + w * 0.15, y + h * 0.48, m(0.14), m(0.03));
  };
  const overheadDeur = (x, y, w, h) => {
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x - m(0.06), y - m(0.1), w + m(0.12), m(0.1));
    g.fillStyle = '#4a4f55'; g.fillRect(x - m(0.06), y, w + m(0.12), h);
    g.fillStyle = '#b9bcc0'; g.fillRect(x, y, w, h);
    for (let yy = y; yy < y + h - 1; yy += m(0.5)) {          // panelen van 50 cm
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x, yy, w, m(0.04));
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x, yy + m(0.04), w, m(0.03));
    }
    g.fillStyle = '#28323a'; g.fillRect(x + m(0.3), y + m(1.0), w - m(0.6), m(0.35));   // raamstrook
  };
  const plintKleur = st.plint || '#5a4a42';
  const plintH = st.industrieel ? 0.5 : 0.3, bandH = st.industrieel ? 0.45 : 0.28;

  for (let i = 0; i < n; i++) {
    const x0 = i * HW;
    const mirror = (i % 2 === 1) && !st.detached;
    const doorColor = st.door[(i + seed) % st.door.length];
    if (st.winkel) {
      /*
       Winkelpui (Jumbo): donkere plint, glazen pui met witte stijlen, een witte
       luifelband en bovenaan de gele huisstijlband met het woordmerk. Bij een
       bedrijfsgevel rekt kaartwereld.js de texture over de hele muurhoogte uit,
       dus de banden staan in verhoudingen en niet in vaste meters: op de lage
       gevel onder de luifel geeft dat een pui van ruim twee meter, op het hoge
       glazen blok bij de ingang dezelfde opbouw maar groter.
      */
      const geel = st.geel || '#ffd200';
      const bandH2 = H * 0.13, luifelH = H * 0.05;
      const plintH2 = Math.max(m(0.22), H * 0.06);
      const puiBoven = bandH2 + luifelH, puiOnder = H - plintH2;
      // plint
      g.fillStyle = st.plint || '#3f4247'; g.fillRect(x0, puiOnder, HW, plintH2);
      g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x0, puiOnder, HW, m(0.03));
      // glas met lucht bovenin en de donkere winkel erachter
      const pg = g.createLinearGradient(0, puiBoven, 0, puiOnder);
      pg.addColorStop(0, '#93aabd'); pg.addColorStop(0.4, '#3d4d5a'); pg.addColorStop(1, '#242d34');
      g.fillStyle = pg; g.fillRect(x0, puiBoven, HW, puiOnder - puiBoven);
      // schuine weerspiegeling in de ruiten
      g.fillStyle = 'rgba(215,230,244,0.18)';
      g.beginPath(); g.moveTo(x0, puiBoven); g.lineTo(x0 + HW * 0.42, puiBoven); g.lineTo(x0 + HW * 0.14, puiOnder); g.lineTo(x0, puiOnder); g.closePath(); g.fill();
      // witte stijlen elke 1,2 m, met een dorpel bovenaan
      g.fillStyle = st.frame;
      for (let k = 0; k * 1.2 <= st.w; k++) g.fillRect(x0 + m(k * 1.2) - m(0.05), puiBoven, m(0.10), puiOnder - puiBoven);
      g.fillRect(x0, puiBoven, HW, m(0.10));
      // schuifdeuren met een mat ervoor, in elke derde travee van de lage gevel
      if (i % 3 === 1 && H < m(3.6)) {
        const dw = m(1.9), dx = x0 + (HW - dw) / 2;
        g.fillStyle = st.frame; g.fillRect(dx - m(0.08), puiBoven, dw + m(0.16), H - puiBoven);
        g.fillStyle = '#2b353d'; g.fillRect(dx, puiBoven + m(0.10), dw, H - m(0.04) - puiBoven - m(0.10));
        g.fillStyle = 'rgba(200,220,240,0.30)'; g.fillRect(dx + m(0.06), puiBoven + m(0.16), dw * 0.3, H - m(0.2) - puiBoven);
        g.fillStyle = st.frame; g.fillRect(dx + dw / 2 - m(0.04), puiBoven, m(0.08), H - puiBoven);
        g.fillStyle = '#3f4247'; g.fillRect(dx - m(0.3), H - m(0.05), dw + m(0.6), m(0.05));
      }
      // luifelband met slagschaduw op de pui
      g.fillStyle = '#f6f6f4'; g.fillRect(x0, bandH2, HW, luifelH);
      g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(x0, bandH2, HW, luifelH * 0.2);
      const sg2 = g.createLinearGradient(0, puiBoven, 0, puiBoven + luifelH * 3);
      sg2.addColorStop(0, 'rgba(0,0,0,0.4)'); sg2.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sg2; g.fillRect(x0, puiBoven, HW, luifelH * 3);
      // de gele band bovenaan met het woordmerk erin. Het staat in de eerste
      // travee, want een smalle muur (het hoge blok bij de ingang) krijgt er
      // maar één.
      g.fillStyle = geel; g.fillRect(x0, 0, HW, bandH2);
      g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(x0, bandH2 - m(0.05), HW, m(0.05));
      if (i % 3 === 0) {
        g.save();
        g.fillStyle = '#2b2b28';
        g.font = `bold ${Math.round(bandH2 * 0.62)}px sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('JUMBO', x0 + HW / 2, bandH2 * 0.54);
        g.restore();
      }
    } else if (st.boerderij) {
      /*
       Stelpboerderij (Tinga State): de kap komt over de gevel heen tot een
       dakvoet van twee tot vier meter, dus onder het dak zit alleen een lage
       bakstenen wand — rondom, want een boerderij heeft geen voor- en
       achterkant. Per travee wisselen twee ramen, een zwarte schuurdeur met een
       klein raam ernaast, en een groene staldeur met bovenlicht elkaar af.
       Bovenaan het overstek van de kap, dat de wand in de schaduw zet.
      */
      const soort = (i + seed) % 3;
      g.fillStyle = st.plint || '#5a3a2e'; g.fillRect(x0, H - m(0.3), HW, m(0.3));
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x0, H - m(0.3), HW, m(0.04));
      if (soort === 0) {
        win(x0 + m(0.8), H - m(2.1), m(1.4), m(1.15), st.frame);
        win(x0 + m(3.2), H - m(2.1), m(2.0), m(1.15), st.frame);
      } else if (soort === 1) {
        // zwarte schuurdeur met houten planken en een lichte lijst
        const dh = m(2.3), dw = m(2.5), dx = x0 + m(1.5), dy = H - dh;
        g.fillStyle = st.frame; g.fillRect(dx - m(0.10), dy - m(0.10), dw + m(0.20), dh + m(0.10));
        g.fillStyle = '#1e1f22'; g.fillRect(dx, dy, dw, dh - m(0.02));
        for (let k = 1; k < 9; k++) { g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(dx + k * dw / 9, dy, m(0.03), dh - m(0.02)); }
        g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(dx, dy + dh * 0.5, dw, m(0.05));
        win(x0 + m(4.5), H - m(1.95), m(1.0), m(0.9), st.frame);
      } else {
        const dh = m(2.15), dw = m(1.0), dx = x0 + m(0.8), dy = H - dh;
        g.fillStyle = st.frame; g.fillRect(dx - m(0.09), dy - m(0.09), dw + m(0.18), dh + m(0.09));
        g.fillStyle = st.frame2; g.fillRect(dx, dy, dw, dh - m(0.02));
        g.fillStyle = '#28323a'; g.fillRect(dx + m(0.14), dy + m(0.18), dw - m(0.28), m(0.55));
        g.fillStyle = 'rgba(200,220,240,0.4)'; g.fillRect(dx + m(0.18), dy + m(0.22), (dw - m(0.28)) * 0.4, m(0.47));
        g.fillStyle = '#d8d8d8'; g.fillRect(dx + dw - m(0.22), dy + m(1.05), m(0.14), m(0.03));
        win(x0 + m(2.4), H - m(2.1), m(1.6), m(1.15), st.frame);
        win(x0 + m(4.5), H - m(2.1), m(1.1), m(1.15), st.frame);
      }
      // overstek van de kap: donkere band met een verloop naar beneden
      g.fillStyle = '#3a2f28'; g.fillRect(x0, 0, HW, m(0.14));
      const og = g.createLinearGradient(0, m(0.14), 0, m(1.0));
      og.addColorStop(0, 'rgba(0,0,0,0.5)'); og.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = og; g.fillRect(x0, m(0.14), HW, m(0.86));
    } else if (st.industrieel) {
      // bedrijfsgevel (RWZI): hoge smalle ramen, per twee traveeën een stalen
      // deur, in elke derde travee een overheaddeur; het kantoortype krijgt
      // gewone ramen met witte kozijnen en geen overheaddeur
      const kantoor = !!st.kantoor;
      for (let s = 0; s < storeys; s++) {
        const fy = H - (s + 1) * SH * PM;
        if (s === 0 && !kantoor && i % 3 === 1) { overheadDeur(x0 + m(1.4), H - m(3.0), m(3.2), m(3.0)); continue; }
        const ry = kantoor ? fy + m(SH - 2.5) : fy + m(SH - 3.05), rh = kantoor ? m(1.5) : m(1.1);
        const eerste = (s === 0 && i % 2 === 0) ? 1 : 0;           // travee met een deur: het eerste raam vervalt
        for (let k = eerste; k < 3; k++) win(x0 + m(0.5 + k * 1.9), ry, m(1.2), rh, st.frame, { kaal: !kantoor });
        if (eerste) staalDeur(x0 + m(0.5), H - m(2.2), m(1.0), m(2.2), doorColor);
      }
    } else if (!back) {
      if (st.storeys >= 1 && type !== 'appart' && type !== 'spil') {
        // grote woonkamerpui + deur
        const dw = m(0.95), dh = m(2.15);
        const ww = m(st.w - 0.95 - 1.3), wh = m(1.75);
        const dx = mirror ? x0 + HW - m(0.5) - dw : x0 + m(0.5);
        const wx = mirror ? x0 + m(0.4) : x0 + m(0.5) + dw + m(0.4);
        door(dx, H - dh, dw, dh, doorColor);
        win(wx, H - m(0.85) - wh, ww, wh, st.frame, { draai: st.frame2 !== st.frame ? st.frame2 : null });
        // luifel: witte band over de volle breedte boven pui en deur, met slagschaduw
        if (st.luifel) {
          const ly = H - m(2.75);
          g.fillStyle = '#f2f2f0'; g.fillRect(x0, ly, HW, m(0.28));
          g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x0, ly, HW, m(0.04));
          const sg = g.createLinearGradient(0, ly + m(0.28), 0, ly + m(0.7));
          sg.addColorStop(0, 'rgba(0,0,0,0.35)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = sg; g.fillRect(x0, ly + m(0.28), HW, m(0.42));
        }
      } else if (type === 'appart') {
        for (let s = 0; s < storeys; s++) {
          const fy = H - (s + 1) * SH * PM;
          win(x0 + m(0.5), fy + m(0.7), m(2.2), m(1.5), st.frame);
          win(x0 + m(4.2), fy + m(0.7), m(2.2), m(1.5), st.frame);
          if (s === 0 && i % 3 === 0) door(x0 + m(3.0), H - m(2.1), m(1.0), m(2.1), '#2b2b2b');
          if (s > 0) { g.fillStyle = '#9aa0a8'; g.fillRect(x0 + m(0.3), fy + m(1.9), m(2.6), m(0.9)); }
        }
      } else if (type === 'spil') {
        for (let k = 0; k < 3; k++) win(x0 + m(0.4 + k * 2.5), H - m(2.5), m(2.0), m(1.6), st.frame);
        if (i === 0) door(x0 + m(3.0), H - m(2.2), m(1.6), m(2.2), '#2b2b2b');
      }
      // verdieping(en)
      for (let s = 1; s < storeys; s++) {
        if (type === 'appart') break;
        const fy = H - (s + 1) * SH * PM;
        if (st.paneel) {
          const bx = x0 + m(0.35), bw2 = m(st.w - 0.7);
          win(bx, fy + m(0.5), bw2, m(1.25), st.frame);
          g.fillStyle = st.paneel; g.fillRect(bx, fy + m(1.75), bw2, m(0.62));
          g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(bx, fy + m(2.31), bw2, m(0.06));
          continue;
        }
        const accent = st.frame2 !== st.frame ? st.frame2 : null;
        win(x0 + m(0.5), fy + m(0.8), m(2.0), m(1.4), st.frame, { draai: accent });
        win(x0 + m(st.w - 2.5), fy + m(0.8), m(2.0), m(1.4), st.frame, { draai: accent });
        if (st.w > 8) win(x0 + m(st.w / 2 - 1.0), fy + m(0.8), m(2.0), m(1.4), st.frame);
      }
    } else {
      // achtergevel: ramen + tuindeur
      for (let s = 0; s < storeys; s++) {
        const fy = H - (s + 1) * SH * PM;
        if (s === 0) {
          g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x0 + m(0.55), H - m(2.28), m(2.5), m(0.08));
          g.fillStyle = st.frame; g.fillRect(x0 + m(0.6), H - m(2.2), m(2.4), m(2.2));
          g.fillStyle = '#28323a'; g.fillRect(x0 + m(0.68), H - m(2.12), m(2.24), m(2.05));
          g.fillStyle = 'rgba(200,220,240,0.3)'; g.fillRect(x0 + m(0.7), H - m(2.1), m(0.8), m(2.0));
          g.fillStyle = st.frame; g.fillRect(x0 + m(1.76), H - m(2.2), m(0.08), m(2.2));
          win(x0 + m(st.w - 2.6), fy + m(1.0), m(2.0), m(1.3), st.frame);
        } else {
          win(x0 + m(0.6), fy + m(0.8), m(1.6), m(1.3), st.frame);
          win(x0 + m(st.w - 2.4), fy + m(0.8), m(1.6), m(1.3), st.frame);
        }
      }
    }
    // De winkel en de boerderij hebben hun eigen plint en dakrand hierboven
    // afgemaakt; die zouden hier overschreven worden.
    if (!st.winkel && !st.boerderij) {
      // plint
      g.fillStyle = plintKleur; g.fillRect(x0, H - m(plintH), HW, m(plintH));
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x0, H - m(plintH), HW, m(0.03));
      // dakrand (boeiboord) bovenaan, met schaduw eronder
      g.fillStyle = st.band; g.fillRect(x0, 0, HW, m(bandH));
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x0, m(bandH), HW, m(0.06));
      // regenpijp op de woningscheiding
      if (!st.plaster && !st.detached && !st.damwand) {
        g.fillStyle = '#8f9296'; g.fillRect(x0 + m(0.06), m(0.28), m(0.08), H - m(0.28));
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x0 + m(0.12), m(0.28), m(0.03), H - m(0.28));
        g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x0, 0, m(0.04), H);
      }
    }
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
