// Procedurele textures (canvas) – baksteen, dakpannen, klinkers, asfalt, gras, water, gevels.
import * as THREE from 'three';

const cache = new Map();

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/*
 Een getekend doek verkleinen voordat het een texture wordt.

 De steen- en dakpandoeken worden per huisstijl in een eigen kleur gemaakt, dus
 er zijn er tientallen; op 512x512 kost dat elk een megabyte en samen bijna
 zestig. Ze liggen bovendien getegeld op de muur (een herhaling per 2,6 m), dus
 288 px is nog altijd honderd beeldpunten per meter — ruim vier keer zo scherp
 als de gevelplaten zelf. De tekencode blijft op ware grootte werken en het
 resultaat wordt hier verkleind.
*/
function kleiner(c, max) {
  if (c.width <= max && c.height <= max) return c;
  const f = max / Math.max(c.width, c.height);
  const k = canvas(Math.round(c.width * f), Math.round(c.height * f));
  const g = k.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(c, 0, 0, k.width, k.height);
  return k;
}

// Deterministische pseudo-random
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/*
 Anisotroop filteren houdt schuin weglopende vlakken — asfalt, stoeptegels, een
 dakvlak — scherp in plaats van een grijze brij in de verte. Acht is een veilige
 ondergrens; js/main.js zet hem bij het opstarten op wat de kaart aankan (meestal
 zestien). Dat kost geen geheugen, alleen wat vulkracht.
*/
let ANIS = 8;
export function zetAnisotropie(n) { ANIS = Math.max(1, Math.min(16, Math.round(n) || 8)); }

/*
 Van welke soort is dit doek? Dat wordt bij het dóek onthouden en niet bij de
 texture, want een texture wordt soms gekloond (de ondergrond doet dat om zijn
 eigen herhaling te kunnen zetten) en dan is het doek nog steeds hetzelfde.
 `normaalVoor` en `ruwVoor` onderaan dit bestand hebben de soort nodig om te
 weten welk reliëf en welke glans erbij horen.
*/
const soortVanDoek = new WeakMap();
function tex(c, repeatX = 1, repeatY = 1, anis = 0, soort = null) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = anis || ANIS;
  t.colorSpace = THREE.SRGBColorSpace;
  if (soort) soortVanDoek.set(c, soort);
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
  const t = tex(kleiner(c, 288), 1, 1, 0, 'baksteen'); cache.set(key, t); return t;
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
  const t = tex(kleiner(c, 288), 1, 1, 0, 'pleister'); cache.set(key, t); return t;
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
  const t = tex(kleiner(c, 288), 1, 1, 0, 'dakpan'); cache.set(key, t); return t;
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
  // Uitrekken naar het volle doek: sinds de textures verkleind worden (zie
  // `kleiner`) is het pannendoek zelf geen 512 px meer, en zonder maat bleef de
  // rest van dit canvas zwart — een kap met zwarte gaten ertussen.
  const bron = roofTiles(base, 5).image;
  g.drawImage(bron, 0, 0, 512, 512);
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
  // Het doek bestaat uit twee panelen rug aan rug (zie js/props.js), die elk
  // hun eigen -Z-vlak naar buiten keren. Dat vlak leest de texture gewoon van
  // links naar rechts, dus het canvas gaat er recht in en het woordmerk staat
  // aan beide kanten goed.
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
  t.anisotropy = ANIS; t.colorSpace = THREE.SRGBColorSpace;
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
  const t = tex(c, 1, 1, 0, 'bitumen'); cache.set('bit', t); return t;
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
  const t = tex(c, 1, 1, 0, 'klinkers'); cache.set(key, t); return t;
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
  const t = tex(c, 1, 1, 0, 'tegels'); cache.set('tiles', t); return t;
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
  const t = tex(c, 1, 1, 0, 'asfalt'); cache.set('asf', t); return t;
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
  const t = tex(c, 1, 1, 0, 'gras'); cache.set('grass', t); return t;
}

// ---------- Kunstgras ----------
/*
 De twee velden van VV Sneek Wit Zwart en de hockeyvelden liggen in de BGT als
 "kunststof". Kunstgras is egaler dan gras — geen madeliefjes, geen dorre
 plekken, alleen de mat met instrooirubber erin. De maaibanen zitten hier
 bewust niet in: de ondergrond krijgt zijn uv uit de wereldcoördinaten, dus
 banen in de texture zouden schuin over het veld lopen. js/sportveld.js legt ze
 er als aparte banen overheen, in de richting van het veld zelf.
*/
export function kunstgras() {
  if (cache.has('kunstgras')) return cache.get('kunstgras');
  const S = 512;                       // 512 px = 5 m
  const c = canvas(S, S); const g = c.getContext('2d');
  const r = rng(77);
  g.fillStyle = '#3f8f3f'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 70000; i++) {
    const gr = 120 + r() * 55;
    g.fillStyle = `rgba(${28 + r() * 25},${gr},${38 + r() * 25},${0.32 + r() * 0.28})`;
    g.fillRect(r() * S, r() * S, 1.4, 2 + r() * 2);
  }
  // wat instrooirubber: kleine donkere korrels
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(20,22,20,${0.15 + r() * 0.2})`; g.fillRect(r() * S, r() * S, 1.6, 1.6); }
  const t = tex(c, 1, 1, 0, 'kunstgras'); cache.set('kunstgras', t); return t;
}

// ---------- Reclameborden langs het veld ----------
/*
 De borden rond het hoofdveld. Er staat geen echte merknaam op: het zijn de
 gekleurde vlakken en woordbeelden die je op een sportpark ziet, zodat de rand
 van het veld van een afstand klopt zonder dat er een bestaand logo wordt
 nagemaakt.
*/
export function reclamebord(seed = 1) {
  const key = 'reclame' + seed;
  if (cache.has(key)) return cache.get(key);
  // 512 x 154 px = 3 bij 0,9 m: dezelfde verhouding als het bord zelf, anders
  // wordt alles wat erop staat in de breedte samengeknepen
  const W = 512, H = 154;
  const c = canvas(W, H); const g = c.getContext('2d');
  const r = rng(300 + seed * 17);
  /*
   Elke variant zijn eigen kleur. Dit was een trekking uit de reeks, en die
   leverde bij vier van de zes seeds dezelfde amberkleur op — dan staat er een
   rij van vier gele borden naast elkaar langs de lijn.
  */
  const grond = ['#c8442c', '#1f4f9c', '#e8a021', '#1f7a48', '#2b2f36', '#f0efe9'];
  const bg = grond[seed % grond.length];
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const licht = bg === '#f0efe9' || bg === '#e8a021';
  // een schuine baan als accent
  g.save(); g.beginPath(); g.moveTo(W * 0.62, 0); g.lineTo(W, 0); g.lineTo(W, H); g.lineTo(W * 0.5, H); g.closePath();
  g.fillStyle = licht ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.16)'; g.fill(); g.restore();
  // een woordbeeld: blokken die op letters lijken
  const tekst = licht ? '#22262c' : '#f4f2ec';
  let x = 26;
  const n = 4 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const b = 16 + r() * 26, h = 48 + r() * 36;
    g.fillStyle = tekst; g.fillRect(x, (H - h) / 2, b, h);
    if (r() < 0.4) { g.fillStyle = bg; g.fillRect(x + 4, (H - h) / 2 + 10, b - 8, h / 3); }
    x += b + 8 + r() * 8;
    if (x > W - 60) break;
  }
  // randlijst boven en onder
  g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, 0, W, 8); g.fillRect(0, H - 9, W, 9);
  const t = tex(c); cache.set(key, t); return t;
}

/*
 Het bord van Radio Spannenburg, de lokale omroep van De Fryske Marren. Er
 staan geen plaatjesbestanden in dit spel — elke texture wordt hier op een canvas
 getekend, net als het Jumbo-woordmerk — dus het logo wordt nagetekend: het
 blauwe hart dat uit schuine geluidsbalken bestaat, het woordmerk RADIO /
 SPANNENBURG in zwaar schreefloos zwart, en de slogan in blauwe cursief.
*/
export function bordSpannenburg() {
  if (cache.has('spannenburg')) return cache.get('spannenburg');
  const W = 512, H = 154;              // 3 bij 0,9 m, dezelfde verhouding als het bord
  const c = canvas(W, H); const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);

  // ---- het hart ----
  const hx = 62, hy = 74, hw = 96, hh = 100;
  g.save();
  g.beginPath();
  g.moveTo(hx, hy + hh * 0.46);
  g.bezierCurveTo(hx - hw * 0.62, hy + hh * 0.02, hx - hw * 0.54, hy - hh * 0.56, hx - hw * 0.20, hy - hh * 0.36);
  g.bezierCurveTo(hx - hw * 0.07, hy - hh * 0.28, hx + hw * 0.07, hy - hh * 0.28, hx + hw * 0.20, hy - hh * 0.36);
  g.bezierCurveTo(hx + hw * 0.54, hy - hh * 0.56, hx + hw * 0.62, hy + hh * 0.02, hx, hy + hh * 0.46);
  g.closePath();
  g.fillStyle = '#1f6dc0'; g.fill();
  /*
   In het hart staan schuine balken, als de uitslag van een geluidsmeter. Ze
   worden binnen het hart geknipt, zodat de vorm heel blijft; de linkerhelft
   blijft egaal, net als in het logo.
  */
  g.clip();
  const tinten = ['#4a96da', '#2f7fcb', '#63a9e4', '#1b5fa8', '#3d8ad2'];
  const baan = (x, breed, kleur) => {
    g.fillStyle = kleur;
    g.beginPath();
    g.moveTo(x, hy + hh * 0.6);
    g.lineTo(x + breed, hy + hh * 0.6);
    g.lineTo(x + breed + 18, hy - hh * 0.6);
    g.lineTo(x + 18, hy - hh * 0.6);
    g.closePath(); g.fill();
  };
  let i = 0;
  for (let x = hx - hw * 0.20; x < hx + hw * 0.72; x += 16) {
    baan(x, 3, '#ffffff');                       // witte naad tussen de balken
    baan(x + 3, 11 + (i % 3) * 1.5, tinten[i % tinten.length]);
    i++;
  }
  g.restore();

  // ---- het woordmerk ----
  g.fillStyle = '#1a1a1a';
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  // een smal, zwaar schreefloos font: horizontaal iets samendrukken
  const smal = (tekst, x, y, px, f) => {
    g.save(); g.translate(x, y); g.scale(f, 1);
    g.font = `bold ${px}px sans-serif`;
    g.fillText(tekst, 0, 0);
    const breed = g.measureText(tekst).width * f;
    g.restore();
    return x + breed;            // waar het woord ophoudt
  };
  const radioEind = smal('RADIO', 88, 74, 52, 0.92);
  const spanEind = smal('SPANNENBURG', 84, 130, 54, 0.92);

  /*
   De slogan staat rechts van RADIO en loopt tot waar SPANNENBURG eindigt. Hoe
   breed dat is hangt af van het font dat de browser voor 'serif' pakt, dus de
   lettergrootte wordt hier op de beschikbare ruimte gerekend in plaats van
   vastgezet — anders liep hij het bord af.
  */
  const slogan = 'It hert fan De Fryske Marren!';
  const ruimte = spanEind - radioEind - 20;
  g.font = 'italic bold 30px Georgia, "Times New Roman", serif';
  const px = Math.min(30, 30 * ruimte / g.measureText(slogan).width);
  g.save();
  g.translate(radioEind + 14, 70); g.rotate(-0.045);
  g.fillStyle = '#1f6dc0';
  g.font = `italic bold ${px.toFixed(1)}px Georgia, "Times New Roman", serif`;
  g.fillText(slogan, 0, 0);
  g.restore();

  // randlijst boven en onder, net als bij de andere borden
  g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, 0, W, 8); g.fillRect(0, H - 9, W, 9);
  const t = tex(c); cache.set('spannenburg', t); return t;
}

// ---------- Clubvlag ----------
// De vlag aan de mast bij de tribune: geel en zwart, de kleuren van de club.
export function clubvlag() {
  if (cache.has('clubvlag')) return cache.get('clubvlag');
  const W = 192, H = 120;
  const c = canvas(W, H); const g = c.getContext('2d');
  g.fillStyle = '#f2c327'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#1d1d1b'; g.fillRect(0, H * 0.38, W, H * 0.24);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (let x = 0; x < W; x += 24) g.fillRect(x, 0, 10, H);          // plooien in het doek
  const t = tex(c); cache.set('clubvlag', t); return t;
}

// ---------- Ballenvanger ----------
// Zwart net achter de doelen: fijne mazen, dus grotendeels doorzichtig.
export function ballenvanger() {
  if (cache.has('ballenvanger')) return cache.get('ballenvanger');
  const S = 64;                        // 64 px = 1 m: mazen van ongeveer 12 cm
  const c = canvas(S, S); const g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  g.strokeStyle = 'rgba(20,26,22,0.85)'; g.lineWidth = 1.4;
  for (let i = 0; i <= S; i += 8) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(S, i); g.stroke();
  }
  const t = tex(c); cache.set('ballenvanger', t); return t;
}

// ---------- Doelnet ----------
export function doelnet() {
  if (cache.has('doelnet')) return cache.get('doelnet');
  const S = 64;                        // 64 px = 1 m
  const c = canvas(S, S); const g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  g.strokeStyle = 'rgba(245,245,240,0.9)'; g.lineWidth = 1.2;
  for (let i = 0; i <= S; i += 6) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(S, i); g.stroke();
  }
  const t = tex(c); cache.set('doelnet', t); return t;
}

// ---------- Tuinhek van gaas ----------
// Groen geplastificeerd gaas van 5 cm om een volkstuintje. Veel fijner en
// lichter dan de ballenvanger op het sportpark, anders staat er een bouwhek om
// iemands sperziebonen.
export function tuingaas() {
  if (cache.has('tuingaas')) return cache.get('tuingaas');
  const S = 128;                       // 128 px = 1 m: mazen van 5 cm
  const c = canvas(S, S); const g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  g.strokeStyle = 'rgba(58,78,58,0.75)'; g.lineWidth = 1;
  for (let i = 0; i <= S; i += 6.4) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(S, i); g.stroke();
  }
  const t = tex(c); cache.set('tuingaas', t); return t;
}

// ---------- Schelpenpad ----------
// Het pad tussen de tuintjes: gebroken schelp met wat aarde erdoor.
export function schelpenpad() {
  if (cache.has('schelp')) return cache.get('schelp');
  const S = 256;                       // 256 px = 2 m
  const c = canvas(S, S); const g = c.getContext('2d');
  const r = rng(611);
  g.fillStyle = '#9d947c'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 7000; i++) {
    const v = r();
    g.fillStyle = v < 0.3 ? `rgba(224,217,197,${0.3 + r() * 0.45})`
      : v < 0.75 ? `rgba(132,120,95,${0.25 + r() * 0.4})`
        : `rgba(84,70,52,${0.25 + r() * 0.35})`;
    g.fillRect(r() * S, r() * S, 1.5 + r() * 3, 1.5 + r() * 2.5);
  }
  const t = tex(c, 1, 1, 0, 'schelp'); cache.set('schelp', t); return t;
}

// ---------- Moestuingrond ----------
// Omgespitte aarde met rijen gewas erin, voor de volkstuinen achter de Wieken.
export function moestuin(seed = 1) {
  const key = 'moestuin' + seed;
  if (cache.has(key)) return cache.get(key);
  const S = 256;                       // 256 px = 4 m
  const c = canvas(S, S); const g = c.getContext('2d');
  const r = rng(500 + seed * 31);
  g.fillStyle = '#5b4630'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 9000; i++) {
    const v = 0.1 + r() * 0.25;
    g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${v})` : `rgba(190,170,140,${v * 0.8})`;
    g.fillRect(r() * S, r() * S, 2 + r() * 3, 2 + r() * 3);
  }
  // bedden: banen van 50 cm met gewas erop
  const kleur = ['#4e7a30', '#6a8f3a', '#3f6b34', '#7d9a45', '#5f8b52'][seed % 5];
  for (let y = 10; y < S; y += 32) {
    if (r() < 0.22) continue;                      // een bed dat net leeg is
    for (let x = 4; x < S - 4; x += 7 + r() * 5) {
      const rad = 3 + r() * 4;
      g.fillStyle = kleur; g.beginPath(); g.arc(x, y + (r() - 0.5) * 5, rad, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.arc(x - rad * 0.3, y - rad * 0.3, rad * 0.4, 0, Math.PI * 2); g.fill();
    }
  }
  const t = tex(c); cache.set(key, t); return t;
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
  wieken_white:{ brick: ['#c9b98f', '#dcd4c1'], frame: '#ffffff', frame2: '#c8322b', door: ['#c8322b', '#c8322b', '#1746a0'], roof: '#3d3430', roofType: 'gable', storeys: 1, w: 5.5, dormer: true, dormerGroot: true, dormerFrame: '#c8322b', chimney: false, band: '#f4f4f4', deurRechts: true },
  wieken_yellow:{ brick: ['#c9b98f', '#dcd4c1'], frame: '#ffffff', frame2: '#c8322b', door: ['#c8322b', '#b52a24'], roof: '#3d3430', roofType: 'gable', storeys: 1, w: 5.5, dormer: true, dormerGroot: true, dormerFrame: '#c8322b', chimney: false, solar: true, band: '#f4f4f4' },
  // Bonkelaar 11 (foto): twee-onder-een-kap in donkere roodbruine steen, witte
  // kozijnen, witte houten topgevel, donkergrijze pannen, garage of carport
  // tussen de woningen, grindtuin met klinkerpad.
  bonkelaar:  { brick: ['#7a4a3c', '#c9bfae'], frame: '#ffffff', frame2: '#ffffff', door: ['#f2f2f2', '#2a2a2a', '#1f3a6e'], roof: '#37322f', roofType: 'gable', storeys: 2, w: 6.4, dormer: false, chimney: true, band: '#f2f2f2', semi: true, topgevel: '#f2f2ee' },
  detached:   { brick: ['#7e5a48', '#c9bfae'], frame: '#ffffff', frame2: '#ffffff', door: ['#2a2a2a', '#5a2d1a'], roof: '#3b3432', roofType: 'gable', storeys: 2, w: 10.0, dormer: false, chimney: true, band: '#f2f2f2', solar: true, detached: true },
  /*
   Keizersmantel 401-437 en 441-485 in Duinterpen (foto's Street View april 2024,
   in de chat 7 sep 2026). Twee gebogen blokken van drie lagen die om hun eigen
   parkeerterrein heen buigen: roodbruine baksteen, een cremekleurige band langs
   de gebogen dakrand, en per woning een brede pui met een donker paneel eronder
   waar op de foto het balkon zit.

   De begane grond zit hier niet in. Die ligt in het echt een paar meter terug
   achter een rij ronde zuilen, en dat bouwt js/zuilengang.js als echte
   geometrie — een gevelplaat is één plat vlak op de rooilijn en kan een
   terugliggende pui niet laten zien. `js/kaartwereld.js` knipt de muren van
   deze panden daarom op de goothoogte af en laat het stuk eronder weg. De uv
   van de plaat loopt nog wel vanaf straatniveau, dus de onderste laag van dit
   doek valt achter de gang en is niet te zien.

   Het verschil tussen de twee blokken: bij de Poiesz antracietgrijze kozijnen
   met donkere panelen eronder, wat de brede puien met rolluiken van de foto
   geeft; bij het blok ernaast witte kozijnen zonder paneel, dus losse ramen met
   steen ertussen zoals daar op de foto staat.
  */
  duinterpen:  { brick: ['#9e5a44', '#cfc7ba'], frame: '#ffffff', frame2: '#ffffff', door: ['#4a3b30'], roof: '#8f8d88', roofType: 'flat', storeys: 3, storeyH: 3.9, w: 5.6, dormer: false, chimney: false, band: '#ece6d6', plint: '#6b5a4d', balcony: true },
  duinterpen_poiesz: { brick: ['#9e5a44', '#cfc7ba'], frame: '#3a3f44', frame2: '#3a3f44', door: ['#2f3337'], roof: '#8f8d88', roofType: 'flat', storeys: 3, storeyH: 3.9, w: 5.6, dormer: false, chimney: false, band: '#ece6d6', plint: '#6b5a4d', paneel: '#33383b', balcony: true },
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
  // `winkel` kiest in facade() de winkelpui, `metaaldak` de dakplaten,
  // `huisstijl` is de kleur van de band bovenaan en `merk`/`merkKleur` het
  // woordmerk dat erin staat.
  jumbo:       { brick: ['#8a7f74', '#c4bdb2'], frame: '#f4f4f2', frame2: '#f4f4f2', door: ['#3f4247'], roof: '#4b4e52', roofType: 'gable', storeys: 1, storeyH: 2.7, w: 6.0, dormer: false, chimney: false, band: '#f2f2f0', plint: '#3f4247', industrieel: true, winkel: true, metaaldak: true, huisstijl: '#ffd200', merk: 'JUMBO' },
  // Supermarkt Poiesz, De Dassenboarch 32 in IJlst (foto Street View, mei 2022):
  // een laag gebouw in donkerbruine baksteen onder een flauw hellend dak van
  // grijze metalen dakplaten, met over de hele voorgevel een glazen pui met
  // lichtgrijze stijlen, en boven de ingang — die onder een puntdak met een
  // luifel zit — het groene woordmerk op een zilvergrijze band. Verder dezelfde
  // opzet als de Jumbo hierboven; alleen de kleuren en het merk verschillen.
  poiesz:      { brick: ['#7c4b3c', '#c0b8ad'], frame: '#e8eaea', frame2: '#e8eaea', door: ['#3f4247'], roof: '#98a0a4', roofType: 'gable', storeys: 1, storeyH: 2.7, w: 6.0, dormer: false, chimney: false, band: '#eceeee', plint: '#4a4a48', industrieel: true, winkel: true, metaaldak: true, huisstijl: '#dfe4e3', merk: 'POIESZ', merkKleur: '#43b02a', merkAccent: 2, merkAccentKleur: '#e8511f', puiDeel: 0.62 },
  // Tinga State, Molenkrite 115 (foto, 4 sep 2026): een stelpboerderij — een
  // enorme steile piramidekap van rode pannen die van de nok op 13,3 m tot een
  // goot op 1,9 m doorloopt, met rijen dakramen erin. Daaronder een lage
  // bakstenen gevel met witte kozijnen, een zwarte schuurdeur en een terras.
  // `boerderij` kiest in facade() die lage wand, `dakramen` het pannendak met
  // dakramen erin (js/kaartwereld.js). `industrieel` houdt de wand in één stuk
  // (niet afgeknipt op de goot, want de dakvoet loopt hier van 2 tot 4 m) en
  // zet de wand aan alle kanten aan; een boerderij heeft geen achtergevel.
  tinga_state: { brick: ['#9b6a4e', '#c9bfae'], frame: '#f6f6f2', frame2: '#1f4230', door: ['#1e1f22', '#1f4230'], roof: '#a8512c', roofType: 'gable', storeys: 1, storeyH: 3.2, w: 6.0, dormer: false, chimney: false, band: '#f2f2ee', plint: '#5a3a2e', industrieel: true, boerderij: true, dakramen: true },
  // Basisschool De Spil, Molenkrite 169 (Street View, foto in de chat 5 sep
  // 2026): een laag gebouw in roodbruine baksteen rond een plein, met over de
  // hele lengte een doorlopende raamstrook met felblauwe kozijnen en gele
  // gordijnen erachter, daarboven een gele plaatband onder een lichte dakrand,
  // en bij de ingang een geel bord. `school` kiest die gevel in facade().
  /*
   Kindcentrum De Wynpôlle, Keizersmantel 1 in Duinterpen (foto's Street View
   april 2024 en mei 2022, in de chat 7 sep 2026). Een complex van 7937 m² met
   131 hoeken in zijn grondvlak: een lage gebogen vleugel met een liggend houten
   beschot en per lokaal een felgekleurde luifel — rood, oranje, geel, groen,
   blauw als een regenboog langs de bocht — en daarnaast hogere delen van
   roodbruine baksteen met lichte kozijnen.

   Welk deel wat krijgt komt uit de hoogte van het 3D BAG-model en niet uit een
   aanname: de bovenkanten van de 228 muurvlakken liggen in twee groepen, 78
   vlakken tot 9,5 m (de houten vleugel, goot 7,49 m) en 143 erboven (tot de nok
   op 14,61 m). `steenBoven` legt die grens, `bovenType` zegt welke stijl de
   hoge vlakken krijgen.

   `industrieel` staat aan omdat een school naar alle kanten ramen heeft.
   `voorkantNaar` wijst maar één richting aan, en bij een gebogen plattegrond
   met 131 hoeken haalt dat hoogstens een handvol vlakken: de rest kwam als kale
   bleke steen in beeld. Met deze vlag krijgt elke muur boven 2,6 m een gevel,
   net als bij de waterzuivering.

   De oranje deur zit alleen op de houten vleugel. De bakstenen delen kregen er
   per lokaal ook een, want de gewone geveltak zet op elke begane grond een
   deur: zes oranje deuren op een gevel van vier lagen, terwijl dat deel op de
   foto donkere entrees heeft.
  */
  dewynpolle:  { brick: ['#9c5a42', '#cfc7ba'], hout: '#8a6a45', luifels: ['#c8402c', '#e07b1a', '#e8c11a', '#4a9c4a', '#2f6fb5'], frame: '#f0efe9', frame2: '#f0efe9', door: ['#e0651a'], roof: '#8f8d88', roofType: 'flat', storeys: 2, storeyH: 3.7, w: 5.2, dormer: false, chimney: false, band: '#e8e4d8', plint: '#5f5347', industrieel: true, steenBoven: 9.5, bovenType: 'dewynpolle_steen' },
  dewynpolle_steen: { brick: ['#9c5a42', '#cfc7ba'], frame: '#efeee7', frame2: '#efeee7', door: ['#3a3f44'], roof: '#8f8d88', roofType: 'flat', storeys: 4, storeyH: 3.6, w: 4.6, dormer: false, chimney: false, band: '#e8e4d8', plint: '#5f5347', industrieel: true },
  /*
   Keizersmantel 1A, de bijbouw die tegen de school aan staat (BAG-pand
   1900100010087850, 87 m², plat dak op 3,49 m, bouwjaar 2023). Uit de data komt
   dat het aan hetzelfde huisnummer hangt (1 en 1A), dat het het pand op 4,9 m
   raakt en dat het één laag is. Dat het bij de school hoort zegt de gebruiker.

   Het krijgt het houten beschot en de kozijnen van de lage vleugel, zodat het
   één complex is en geen losse flat — het stond als `jasker_flat` in beeld,
   want dat is het type van de straat. De luifels blijven eraf: die zitten op de
   foto op de lange vleugel van de school en niet op een bijgebouw van één laag.
   Eén laag van 3,4 m met brede ramen en een donkere deur.

   `kantoor` staat erbij omdat de bedrijfstak van `facade()` anders in elke derde
   travee een overheaddeur zet: op vijftien meter gevel stond er een grote
   grijze roldeur midden op het schoolplein. Met deze vlag komen er gewone ramen
   met lichte kozijnen en alleen een stalen deur.
  */
  dewynpolle_bij: { brick: ['#9c5a42', '#cfc7ba'], hout: '#8a6a45', frame: '#f0efe9', frame2: '#f0efe9', door: ['#3a3f44'], roof: '#8f8d88', roofType: 'flat', storeys: 1, storeyH: 3.4, w: 4.4, dormer: false, chimney: false, band: '#e8e4d8', plint: '#5f5347', industrieel: true, kantoor: true },
  school:      { brick: ['#8c5340', '#c9bfae'], frame: '#1f6fc4', frame2: '#1f6fc4', door: ['#1f6fc4'], roof: '#54514c', roofType: 'flat', storeys: 1, storeyH: 3.2, w: 6.0, dormer: false, chimney: false, band: '#d8d5cc', plint: '#6b4436', industrieel: true, school: true, huisstijl: '#f2c012' },
  // Jeugdhulp Friesland, Molenkrite 234 (Street View, foto in de chat 5 sep
  // 2026): een lang gebouw van één laag met plat dak, donkerbruine steen,
  // lichte kozijnen en een blauwe deur, met een parkeerterrein en een
  // omheinde speeltuin ervoor.
  zorg:        { brick: ['#6f5a4c', '#c2bbb0'], frame: '#eceae4', frame2: '#eceae4', door: ['#1f6fc4', '#3a3d42'], roof: '#4a4d50', roofType: 'flat', storeys: 1, storeyH: 3.0, w: 6.0, dormer: false, chimney: false, band: '#c9c6bd', plint: '#4f4137', industrieel: true, kantoor: true },
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
  const t = tex(c, 1, 1, 0, 'damwand'); cache.set(key, t); return t;
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

// ---------- Riet (het achtkant en de kap van de molen) ----------
/*
 Het achtkant van een houtzaagmolen is met riet gedekt: verticale bossen die van
 de kap naar de stelling lopen, van dichtbij vezelig en van veraf een egale
 donkerbruine huid. De tekening is verticaal, want zo hangt het riet ook — leg je
 hem horizontaal, dan lijkt het gepotdekseld hout.
*/
export function rietdak(kleur = '#5a4630') {
  const key = 'riet' + kleur;
  if (cache.has(key)) return cache.get(key);
  const S = 256, c = canvas(S, S), g = c.getContext('2d');
  const r = rng(83);
  g.fillStyle = kleur; g.fillRect(0, 0, S, S);
  // bossen van ongeveer 20 px breed, elk met een eigen tint
  for (let x = 0; x < S; x += 20) {
    g.fillStyle = `rgba(0,0,0,${0.06 + r() * 0.10})`; g.fillRect(x, 0, 20, S);
    g.fillStyle = `rgba(255,240,205,${0.05 + r() * 0.07})`; g.fillRect(x + 2, 0, 3, S);
  }
  // losse halmen eroverheen
  for (let i = 0; i < 900; i++) {
    const x = r() * S, y = r() * S, h = 14 + r() * 26;
    g.strokeStyle = r() < 0.5 ? `rgba(0,0,0,${0.05 + r() * 0.12})` : `rgba(214,192,150,${0.05 + r() * 0.12})`;
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y + h); g.stroke();
  }
  // de bindrepen: om de meter een donkere band dwars over het riet
  for (let y = 40; y < S; y += 84) { g.fillStyle = 'rgba(28,20,12,0.28)'; g.fillRect(0, y, S, 3); }
  const t = tex(c, 1, 1, 0, 'riet'); cache.set(key, t); return t;
}

// ---------- Hekwerk van een molenroede ----------
/*
 Het roedehekwerk: de latten (heklatten) waar bij het malen het zeil overheen
 gaat. Ze zitten om de 25 cm dwars op de roede, met twee langsregels erlangs.
 64 px = 1 m, doorzichtig ertussen, dus het vlak wordt met alphaTest getekend en
 je kijkt er echt doorheen — een molenwiek is meer lucht dan hout.
*/
export function wiekhek() {
  if (cache.has('wiekhek')) return cache.get('wiekhek');
  const S = 64, c = canvas(S, S), g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  g.fillStyle = 'rgba(46,36,26,0.95)';
  for (let y = 0; y < S; y += 16) g.fillRect(0, y, S, 3);        // heklatten, om de 25 cm
  g.fillRect(0, 0, 3, S); g.fillRect(S - 4, 0, 3, S);            // langsregels aan de randen
  g.fillStyle = 'rgba(70,55,40,0.9)'; g.fillRect(S * 0.5 - 1, 0, 3, S);
  const t = tex(c); cache.set('wiekhek', t); return t;
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
  const t = tex(c, 1, 1, 0, 'planken'); cache.set(key, t); return t;
}

// Idem voor de gevels: zes varianten per type geeft genoeg afwisseling in
// gordijnen, deurkleuren en raamindeling zonder het geheugen op te blazen.
const GEVEL_VARIANTEN = 6;
export function facade(type, n, storeys, back = false, seed = 1) {
  seed = ((seed % GEVEL_VARIANTEN) + GEVEL_VARIANTEN) % GEVEL_VARIANTEN;
  const key = `fac_${type}_${n}_${storeys}_${back}_${seed}`;
  if (cache.has(key)) return cache.get(key);
  const st = HOUSE_STYLES[type];
  /*
   Beeldpunten per meter. Dit stond op 40 — een kozijn van 8 cm is dan drie
   pixels breed — maar de gevels zijn samen goed voor het leeuwendeel van het
   texturegeheugen, en dat liep op tot 187 MB. Op een telefoon is dat rond of
   over het budget van de browser. Toen de wereld tot IJlst werd doorgetrokken
   liep het weer op naar 215 MB: honderdvijfenvijftig straten geven veel meer
   verschillende rijtjes, en elk rijtje is een eigen doek. Op 21 px/m en met een
   afkapping op 1600 px in plaats van 2048 komt het geheel weer onder de 140 MB
   die de kleine wereld ook kostte. Een kozijn van 8 cm is dan nog anderhalve
   pixel: van dichtbij iets zachter, op straat niet te zien.
  */
  const PM = Math.min(21, 1600 / Math.max(1, st.w * n));
  const HW = Math.round(st.w * PM);
  const SH = st.storeyH || 2.9;
  const H = Math.round(storeys * SH * PM);
  const c = canvas(HW * n, H); const g = c.getContext('2d');
  const r = rng(seed * 7 + n);
  const m = (v) => v * PM;   // meters -> pixels

  // achtergrond baksteen / pleister (320 px baksteen = 2,6 m)
  // `hout` is een liggend houten beschot in plaats van metselwerk: 1,2 m per
  // doek in plaats van 2,6 m, want `planks` tekent acht delen van 15 cm
  const bimg = st.hout ? planks(st.hout).image
    : st.damwand ? damwand(st.brick[0]).image
    : st.plaster ? plaster(st.brick[0]).image
    : brick(st.brick[0], st.brick[1], seed).image;
  const pat = g.createPattern(bimg, 'repeat');
  const sc = PM * (st.hout ? 1.2 : 2.6) / bimg.width;
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
    /*
     Waar zit de voordeur? Standaard om en om: twee woningen delen een bouwmuur
     en spiegelen om elkaar heen, zoals in de meeste rijtjes. Aan de Wieken zit
     hij bij álle woningen aan dezelfde kant — rechts, met de woonkamerpui
     ernaast links — dus die stijl zet `deurRechts` en dan vervalt het om en om.
    */
    const mirror = st.deurRechts ? true : ((i % 2 === 1) && !st.detached);
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
      const huisstijl = st.huisstijl || '#ffd200';
      const bandH2 = H * 0.13, luifelH = H * 0.05;
      const plintH2 = Math.max(m(0.22), H * 0.06);
      /*
       Hoeveel van de gevel is glas? Bij de Jumbo alles onder de luifel; de
       Poiesz is voor het grootste deel gewoon een bakstenen doos met onderlangs
       een glazen pui, dus daar begint het glas pas op ruim de helft. Wat
       daarboven blijft staan is het metselwerk waar het doek al mee begon.
      */
      const glas = st.puiDeel ?? 1;
      const bovenkant = H * (1 - glas);
      const puiBoven = bovenkant + bandH2 + luifelH, puiOnder = H - plintH2;
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
      g.fillStyle = '#f6f6f4'; g.fillRect(x0, bovenkant + bandH2, HW, luifelH);
      g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(x0, bovenkant + bandH2, HW, luifelH * 0.2);
      const sg2 = g.createLinearGradient(0, puiBoven, 0, puiBoven + luifelH * 3);
      sg2.addColorStop(0, 'rgba(0,0,0,0.4)'); sg2.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sg2; g.fillRect(x0, puiBoven, HW, luifelH * 3);
      // de huisstijlband bovenaan met het woordmerk erin. Het staat in de eerste
      // travee, want een smalle muur (het hoge blok bij de ingang) krijgt er
      // maar één. Jumbo heeft een gele band met donkere letters, Poiesz een
      // zilvergrijze band met het groene woordmerk erop.
      g.fillStyle = huisstijl; g.fillRect(x0, bovenkant, HW, bandH2);
      g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(x0, bovenkant + bandH2 - m(0.05), HW, m(0.05));
      if (i % 3 === 0) {
        /*
         Het woordmerk. `merkAccent` is de letter die een eigen kleur heeft: bij
         Poiesz is dat de I, die in het logo oranje is en schuin tussen de groene
         letters door staat. Per letter tekenen in plaats van in één keer, zodat
         die ene letter zijn eigen kleur en schuinte kan krijgen.
        */
        const woord = st.merk || 'JUMBO';
        g.save();
        g.font = `bold ${Math.round(bandH2 * 0.62)}px sans-serif`;
        g.textBaseline = 'middle';
        const breedtes = [...woord].map(l => g.measureText(l).width);
        const totaal = breedtes.reduce((a, b) => a + b, 0);
        let lx = x0 + HW / 2 - totaal / 2;
        const ly = bovenkant + bandH2 * 0.54;
        for (let k = 0; k < woord.length; k++) {
          const accent = st.merkAccent === k;
          g.fillStyle = accent ? (st.merkAccentKleur || '#e8511f') : (st.merkKleur || '#2b2b28');
          if (accent) {
            g.save();
            g.translate(lx + breedtes[k] / 2, ly);
            g.rotate(-0.16);                    // het schuine streepje van het logo
            g.textAlign = 'center';
            g.fillText(woord[k], 0, 0);
            g.restore();
          } else {
            g.textAlign = 'left';
            g.fillText(woord[k], lx, ly);
          }
          lx += breedtes[k];
        }
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
    } else if (st.luifels) {
      /*
       Schoolgevel met luifels (kindcentrum De Wynpôlle, Keizersmantel 1): een
       liggend houten beschot met per lokaal een brede raamstrook en daarboven
       een felgekleurde luifel. Op de foto lopen die kleuren als een regenboog
       langs de gebogen vleugel en verschilt de rij boven van de rij onder, dus
       de kleur hangt af van zowel het lokaal als de verdieping.

       De luifel wordt hier als band getekend en niet als uitstekend zeil: van de
       straat gezien is een luifel boven een raam een gekleurde balk met een
       slagschaduw op het glas eronder, en dat is precies wat een plat vlak kan.
      */
      const kl = st.luifels;
      for (let s2 = 0; s2 < storeys; s2++) {
        const fy = H - (s2 + 1) * SH * PM;
        const bx = x0 + m(0.3), bw2 = m(st.w - 0.6);
        // de raamstrook
        win(bx, fy + m(1.05), bw2, m(1.55), st.frame);
        // de luifel erboven, met een lichte bovenrand en schaduw op het glas
        const ly = fy + m(0.62);
        const lh = m(0.40);
        g.fillStyle = kl[(i + s2 * 2) % kl.length];
        g.fillRect(bx - m(0.12), ly, bw2 + m(0.24), lh);
        g.fillStyle = 'rgba(255,255,255,0.22)';
        g.fillRect(bx - m(0.12), ly, bw2 + m(0.24), m(0.07));
        const sg2 = g.createLinearGradient(0, ly + lh, 0, ly + lh + m(0.5));
        sg2.addColorStop(0, 'rgba(0,0,0,0.42)'); sg2.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = sg2; g.fillRect(bx - m(0.12), ly + lh, bw2 + m(0.24), m(0.5));
        // een dorpel onder het raam
        g.fillStyle = shade(st.hout || '#8a6a45', 0.78);
        g.fillRect(bx, fy + m(2.6), bw2, m(0.09));
      }
      // de ingang: één oranje deur per zes lokalen
      if (i % 6 === 3) door(x0 + m(st.w / 2 - 0.6), H - m(2.25), m(1.2), m(2.25), st.door[0]);
    } else if (st.school) {
      /*
       Schoolgevel (De Spil): een doorlopende raamstrook met felblauwe kozijnen
       en gele gordijnen erachter, daarboven een gele plaatband onder een lichte
       dakrand, daaronder metselwerk met een donkere plint. Net als bij de
       winkel rekt kaartwereld.js de texture over de hele muurhoogte uit, dus
       alles staat in verhoudingen van H en niet in vaste meters.
      */
      const geel = st.huisstijl || '#f2c012';
      const randH = H * 0.07, bandH2 = H * 0.13;
      const ramenY = randH + bandH2 + H * 0.05, ramenH = H * 0.40;
      // lichte dakrand en gele plaatband eronder
      g.fillStyle = '#d8d5cc'; g.fillRect(x0, 0, HW, randH);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x0, randH, HW, H * 0.012);
      g.fillStyle = geel; g.fillRect(x0, randH, HW, bandH2);
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x0, randH + bandH2 - H * 0.012, HW, H * 0.012);
      // raamstrook: kozijnen van 1,3 m naast elkaar, met gele gordijnen
      const lat = m(1.3);
      for (let k = 0; m(0.45) + (k + 1) * lat < HW - m(0.2); k++) {
        win(x0 + m(0.45) + k * lat, ramenY, lat - m(0.14), ramenH, st.frame);
        g.fillStyle = 'rgba(242,192,18,0.35)';
        g.fillRect(x0 + m(0.55) + k * lat, ramenY + ramenH * 0.12, lat - m(0.34), ramenH * 0.5);
      }
      // om de drie traveeën de ingang, met een geel bord erboven
      if (i % 3 === 1) {
        const dw = m(1.7), dx = x0 + (HW - dw) / 2, dh = H - ramenY - H * 0.06;
        g.fillStyle = st.frame; g.fillRect(dx - m(0.1), ramenY, dw + m(0.2), dh);
        g.fillStyle = '#28323a'; g.fillRect(dx, ramenY + m(0.1), dw, dh - m(0.2));
        g.fillStyle = 'rgba(200,220,240,0.3)'; g.fillRect(dx + m(0.08), ramenY + m(0.16), dw * 0.3, dh - m(0.4));
        g.fillStyle = st.frame; g.fillRect(dx + dw / 2 - m(0.05), ramenY, m(0.10), dh);
        g.fillStyle = geel; g.fillRect(dx - m(0.1), ramenY - H * 0.10, dw + m(0.2), H * 0.085);
        g.save();
        g.fillStyle = '#2b2b28';
        g.font = `bold ${Math.round(H * 0.055)}px sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('INGANG', dx + dw / 2, ramenY - H * 0.057);
        g.restore();
      }
      // plint onder het metselwerk
      const plintH2 = Math.max(m(0.2), H * 0.05);
      g.fillStyle = plintKleur; g.fillRect(x0, H - plintH2, HW, plintH2);
      g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x0, H - plintH2, HW, m(0.03));
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
    if (!st.winkel && !st.boerderij && !st.school) {
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
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANIS;
  soortVanDoek.set(c, 'gevel');
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

/*
 ================= Reliëf en glans, afgeleid uit dezelfde doeken =================

 Alle doeken hierboven zijn alleen kleur. Een gemetselde muur is daardoor een
 vlakke plaat met een tekening erop: strijklicht doet er niets mee, en van
 dichtbij zie je dat het geen steen is maar een plaatje van steen. Twee kaarten
 halen daar het meeste uit, en allebei zijn ze uit het bestaande doek te maken —
 er hoeft geen enkele nieuwe tekening bij.

 **De normal map** komt uit de helderheid van het doek: die wordt als hoogte
 gelezen en met een Sobel-operator omgezet in een helling per beeldpunt. Dat is
 geen echte hoogtemeting, maar bij metselwerk, een pannendak of een
 klinkerbestrating ligt de tekening zó dicht tegen het reliëf aan dat het klopt.

 Eén ding moet je per soort weten: **is licht hoog of laag?** Bij klinkers,
 stoeptegels, dakpannen, planken en riet is de voeg of de naad donker getekend,
 dus donker is laag. Bij baksteen is het net andersom — `brick()` zet de specie
 lichter dan de steen — en daar moet de hoogte dus omgekeerd. Zonder die vlag
 zit het metselwerk binnenstebuiten en steken de voegen uit de muur.

 **De roughness map** is er alleen voor de gevels, en daar is hij het meest waard:
 een gevel is mat metselwerk met glimmend glas erin, en zonder zo'n kaart is
 alles even mat. Het glas is in het doek te herkennen aan zijn kleur — de ruiten
 zijn met een blauwgrijs verloop getekend en het metselwerk is warm — dus een
 pixel die blauwer is dan rood is glas. Verf (de witte kozijnen en boeiboorden)
 glimt er een beetje tussenin.

 Maten: de normal maps blijven op ware grootte, de roughness maps gaan naar een
 kwart. Dat eerste is een les uit de eerste poging: op halve maat waren ze
 nauwelijks te zien. Een voeg in het metselwerk is 1,3 cm en het steendoek staat
 op 111 beeldpunten per meter, dus die voeg is anderhalve pixel breed — halveer
 je dat doek, dan verdwijnt hij in de vervaging en blijft er een vlakke muur
 over. De doeken met reliëf zijn allemaal 288 tot 512 px, dus op ware grootte
 kosten ze samen maar een paar megabyte. Glans is wel laagfrequent (een ruit is
 glad, een muur is mat) en kan prima op een kwart.

 De gevels krijgen bewust géén normal map. Het gevelblad bevat naast de
 baksteen ook geschilderd licht — vitrage, spiegelingen, slagschaduw onder de
 dakrand — en dat zou als reliëf terugkomen. Ze krijgen wel hun glans; het
 metselwerk ernaast en de daken erboven dragen het reliëf.
*/

// s = hoe sterk het reliëf, om = licht is laag in plaats van hoog
const RELIEF = {
  baksteen:  { s: 2.2, om: true },
  pleister:  { s: 0.7, om: false },
  dakpan:    { s: 1.8, om: false },
  klinkers:  { s: 1.6, om: false },
  tegels:    { s: 1.4, om: false },
  asfalt:    { s: 0.5, om: false },
  bitumen:   { s: 0.8, om: false },
  planken:   { s: 1.2, om: false },
  damwand:   { s: 1.5, om: false },
  riet:      { s: 1.3, om: false },
  gras:      { s: 0.5, om: false },
  kunstgras: { s: 0.4, om: false },
  schelp:    { s: 0.9, om: false },
};

const normaalCache = new Map();      // doek -> basis-normaaltexture
const ruwCache = new Map();          // doek -> basis-roughnesstexture
const kopieCache = new Map();        // basis + herhaling -> kloon

// Een doek als helderheid uitlezen, op ware grootte. Levert { w, h, v }.
function helderheid(bron) {
  const w = bron.width, h = bron.height;
  const k = canvas(w, h); const g = k.getContext('2d');
  g.drawImage(bron, 0, 0);
  const d = g.getImageData(0, 0, w, h).data;
  const v = new Float32Array(w * h);
  for (let i = 0, p = 0; p < w * h; p++, i += 4) {
    v[p] = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
  }
  return { w, h, v };
}

/*
 De normal map. Let op het teken van het groene kanaal: een canvas telt zijn
 rijen van boven naar beneden, maar three keert het doek om (`flipY`), zodat v
 juist omhoog loopt. De afgeleide naar beneden in het doek is daarmee de
 afgeleide omhoog in de texture, en het groene kanaal krijgt dus +dy en niet
 -dy. Staat dat verkeerd om, dan lijkt elke bult een deuk zodra de zon draait.
*/
function normaalDoek(bron, sterkte, omkeren) {
  const { w, h, v } = helderheid(bron);
  const k = canvas(w, h); const g = k.getContext('2d');
  const beeld = g.createImageData(w, h), o = beeld.data;
  // de doeken liggen getegeld, dus over de rand heen doorlezen
  const H = (x, y) => v[((y % h) + h) % h * w + ((x % w) + w) % w] * (omkeren ? -1 : 1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1))
             - (H(x - 1, y - 1) + 2 * H(x - 1, y) + H(x - 1, y + 1));
    const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1))
             - (H(x - 1, y - 1) + 2 * H(x, y - 1) + H(x + 1, y - 1));
    const nx = -dx * sterkte, ny = dy * sterkte, nz = 1;
    const L = Math.hypot(nx, ny, nz) || 1;
    const i = (y * w + x) * 4;
    o[i] = Math.round((nx / L * 0.5 + 0.5) * 255);
    o[i + 1] = Math.round((ny / L * 0.5 + 0.5) * 255);
    o[i + 2] = Math.round((nz / L * 0.5 + 0.5) * 255);
    o[i + 3] = 255;
  }
  g.putImageData(beeld, 0, 0);
  return k;
}

/*
 De roughness map van een gevel. Glas is blauwer dan rood en wordt glad (0,10),
 licht en kleurloos is verf en wordt halfglanzend (0,55), de rest is metselwerk
 en blijft mat (0,92). Er gaat een lichte vervaging overheen zodat de randen
 van een kozijn niet gaan flikkeren.
*/
function ruwDoek(bron) {
  const w = Math.max(8, Math.round(bron.width / 4));
  const h = Math.max(8, Math.round(bron.height / 4));
  const k = canvas(w, h); const g = k.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.filter = 'blur(1px)';
  g.drawImage(bron, 0, 0, w, h);
  g.filter = 'none';
  const beeld = g.getImageData(0, 0, w, h), d = beeld.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gr = d[i + 1], b = d[i + 2];
    let ruw = 0.92;
    if (b > r + 6) ruw = 0.10;                                        // glas
    else if (r > 190 && Math.abs(r - b) < 14 && Math.abs(r - gr) < 14) ruw = 0.55;  // verf
    const v = Math.round(ruw * 255);
    d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
  }
  g.putImageData(beeld, 0, 0);
  return k;
}

// De herhaling en de filtering van het kleurdoek overnemen. Een kloon deelt zijn
// bron, dus hij kost geen tweede plek in het videogeheugen.
function zelfdeLigging(basis, kleur) {
  const sleutel = `${basis.uuid}|${kleur.repeat.x}|${kleur.repeat.y}|${kleur.offset.x}|${kleur.offset.y}|${kleur.wrapS}|${kleur.wrapT}`;
  let k = kopieCache.get(sleutel);
  if (k) return k;
  k = basis.clone();
  k.repeat.copy(kleur.repeat);
  k.offset.copy(kleur.offset);
  k.wrapS = kleur.wrapS; k.wrapT = kleur.wrapT;
  k.anisotropy = kleur.anisotropy;
  k.needsUpdate = true;
  kopieCache.set(sleutel, k);
  return k;
}

/*
 Alleen voor tools/relieftest.mjs: het omzetten van een doek naar een normal map
 los aanroepbaar. De richting van het groene kanaal is het soort fout dat je pas
 ziet als de zon een halve dag verder staat, dus die wordt met een doek met een
 bekende bult nagerekend in plaats van met het oog.
*/
export function _normaalDoek(bron, sterkte = 1, omkeren = false) {
  return normaalDoek(bron, sterkte, omkeren);
}

/** De normal map die bij dit kleurdoek hoort, of null als die soort er geen heeft. */
export function normaalVoor(kleur) {
  if (!kleur || !kleur.image) return null;
  const R = RELIEF[soortVanDoek.get(kleur.image)];
  if (!R) return null;
  let basis = normaalCache.get(kleur.image);
  if (!basis) {
    basis = new THREE.CanvasTexture(normaalDoek(kleur.image, R.s, R.om));
    basis.wrapS = basis.wrapT = THREE.RepeatWrapping;
    basis.colorSpace = THREE.NoColorSpace;     // richtingen, geen kleuren
    basis.anisotropy = ANIS;
    normaalCache.set(kleur.image, basis);
  }
  return zelfdeLigging(basis, kleur);
}

/** De roughness map die bij dit kleurdoek hoort (nu alleen de gevels). */
export function ruwVoor(kleur) {
  if (!kleur || !kleur.image) return null;
  if (soortVanDoek.get(kleur.image) !== 'gevel') return null;
  let basis = ruwCache.get(kleur.image);
  if (!basis) {
    basis = new THREE.CanvasTexture(ruwDoek(kleur.image));
    basis.wrapS = basis.wrapT = THREE.RepeatWrapping;
    basis.colorSpace = THREE.NoColorSpace;
    basis.anisotropy = ANIS;
    ruwCache.set(kleur.image, basis);
  }
  return zelfdeLigging(basis, kleur);
}

/*
 Reliëf en glans over een hele scene zetten. Eén keer aanroepen na het bouwen van
 de wereld: elk materiaal dat een kleurdoek heeft van een soort met reliëf
 krijgt de bijbehorende normal map, en elke gevel zijn roughness map. Levert
 hoeveel materialen er zijn aangeraakt.
*/
export function zetReliëf(root) {
  const gezien = new Set();
  let normalen = 0, glans = 0;
  root.traverse(o => {
    const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    for (const m of mats) {
      if (!m || gezien.has(m) || !m.isMeshStandardMaterial || !m.map) continue;
      gezien.add(m);
      if (!m.normalMap) { const nm = normaalVoor(m.map); if (nm) { m.normalMap = nm; normalen++; } }
      if (!m.roughnessMap) {
        const rm = ruwVoor(m.map);
        // de kaart draagt de waarde, dus het getal op het materiaal moet 1 zijn
        if (rm) { m.roughnessMap = rm; m.roughness = 1; glans++; }
      }
      if (m.normalMap || m.roughnessMap) m.needsUpdate = true;
    }
  });
  return { normalen, glans, materialen: gezien.size };
}
