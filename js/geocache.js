/*
 De Tinga Cache (stap 196): geocachen in Tinga en IJlst. Het ontwerp staat in docs/ontwerp-geocache.md; gevraagd: "Laat de BP
 medewerker bij aankoop GPS tracker uitleggen dat hij Sjors moet zien van Radio Tinga. Laat de poster in de BP shop maar ook op
 paar andere plekken terugkomen die logisch zijn, bijvoorbeeld op tafel van Eriks huisje. Maak een soort GPS tracker handheld die
 je ziet als je op de knop klikt. Kies Sjors, beloning is gouden M1 Garand en 2.500 euro. Plekken goed."

 Hoe het werkt:
  - Posters (TINGA CACHE, vijf caches, GPS € 250 bij de BP, vraag Sjors) op de balie van de BP-shop, op een prikbord bij de stoep
    van Radio Tinga en op de eettafel van de drie woningen die Erik kan kopen.
  - De GPS koop je aan de kassa van de BP (3, € 250, js/bpkassa.js); de medewerker vertelt dat je bij Sjors moet zijn.
  - Dan staat Sjors op de stoep van Radio Tinga, met een S op de kaart. E bij hem: de uitleg en de eerste cache.
  - N zet de GPS aan en uit: een handapparaat in beeld (canvas) met je eigen coördinaten, het doel, een pijl en de afstand, het
    raadsel van de cache waar je bent, en "Tinga Cache n/5". De cijfers van het doel tik je in (1–9, 0, backspace).
  - Een cache ligt een paar meter van het punt uit het raadsel (`CACHE.radius`): vanaf `CACHE.dichtbij` meter zegt de GPS
    "dichtbij — zoek!", op `CACHE.open` meter is het "E — cache openen". Cache 4 kan alleen vanuit een boot.
  - In elk logboek een letter en een cijfer; de letters vormen SLAG, de cijfers maken de coördinaten van de vijfde af.
  - De vijfde: € 2.500 en de gouden M1 Garand; na elke cache meldt Sjors het op Radio Tinga.
 Geen missie: niets begint vanzelf, niets neemt de navigatie over (de les van stap 193); het werkt ook tijdens een missie.

 Coördinaten: graden en minuten met drie decimalen (WGS84), zoals geocachers ze schrijven. De kaart kent zijn oorsprong in graden
 (`KAART.oorsprong.wgs84`); daaromheen rekenen we vlak (+x = oost, +z = zuid). Eén duizendste minuut is ~1,85 m noord-zuid en
 ~1,1 m oost-west. Dat is niet precies het RD-raster, maar de GPS en de raadsels gebruiken dezelfde omrekening.
*/
import * as THREE from 'three';
import { resolveCollisions, pointInWater } from './world.js';
import { grondHoogte } from './viaduct.js';
import { bpWereld, BP_WINKEL } from './bouwvlak.js';
import { TIGER } from './tiger.js';
import { NOMERCY5 } from './nomercy5.js';

export const CACHE = {
  prijs: 250,          // de GPS aan de kassa van de BP
  totaal: 5,
  radius: 5,           // zo ver ligt de cache hoogstens van het punt uit het raadsel (m)
  dichtbij: 15,        // vanaf hier zegt de GPS "dichtbij — zoek!"
  open: 1.7,           // zo dicht bij de cache: E opent hem
  vanafBoot: 4.5,      // cache 4: zo dicht vanuit de boot
  schommel: 4,         // de GPS geeft je eigen plek op ± zoveel meter
  mis: 12,             // op het ingetikte punt en niets binnen deze afstand: "hier is niets"
  loon: [100, 200, 250, 300, 2500],
  letters: ['S', 'L', 'A', 'G'],
  sjorsVoor: 2.2,      // Sjors staat zoveel van de stoep van Radio Tinga
  praat: 3.2,
};

// ---------------------------------------------------------------- coördinaten
const M_LAT = 111254;                                   // meter per graad noorderbreedte op 53°
export function maakOmrekening(oorsprong) {
  const [lat0, lon0] = oorsprong;
  const mLon = 111320 * Math.cos(lat0 * Math.PI / 180);
  return {
    naarGraden(x, z) { return { lat: lat0 - z / M_LAT, lon: lon0 + x / mLon }; },
    vanGraden(lat, lon) { return { x: (lon - lon0) * mLon, z: (lat0 - lat) * M_LAT }; },
  };
}
// graden → { gr, min, dui }: 53.02123 → 53°, 01 min, 274 duizendsten
export function deel(g) {
  const gr = Math.floor(g), mt = (g - gr) * 60;
  let min = Math.floor(mt), dui = Math.round((mt - min) * 1000);
  if (dui === 1000) { dui = 0; min++; }
  return { gr, min, dui };
}
export const twee = (n) => String(n).padStart(2, '0');
export const drie = (n) => String(n).padStart(3, '0');
export function tekstN(lat) { const d = deel(lat); return `N ${d.gr}° ${twee(d.min)}.${drie(d.dui)}`; }
export function tekstE(lon) { const d = deel(lon); return `E ${drie(d.gr)}° ${twee(d.min)}.${drie(d.dui)}`; }
export function uitDelen(n, e) { return { lat: n.gr + (n.min + n.dui / 1000) / 60, lon: e.gr + (e.min + e.dui / 1000) / 60 }; }

// ---------------------------------------------------------------- doeken
function doek(b, h, teken) {
  const c = document.createElement('canvas'); c.width = b; c.height = h;
  teken(c.getContext('2d'), b, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
export function tekenPoster(g, b, h) {
  g.fillStyle = '#f4ead2'; g.fillRect(0, 0, b, h);
  g.fillStyle = '#1f4d2b'; g.fillRect(0, 0, b, h * 0.2);
  g.fillStyle = '#ffd34d'; g.font = `900 ${b * 0.13}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('TINGA CACHE', b / 2, h * 0.1);
  // een kistje en een kompas
  g.save(); g.translate(b * 0.3, h * 0.36);
  g.fillStyle = '#5b6b3a'; g.fillRect(-b * 0.13, -h * 0.05, b * 0.26, h * 0.1);
  g.fillStyle = '#3e4a27'; g.fillRect(-b * 0.13, -h * 0.065, b * 0.26, h * 0.025);
  g.fillStyle = '#d9c27a'; g.fillRect(-b * 0.03, -h * 0.02, b * 0.06, h * 0.03);
  g.restore();
  g.save(); g.translate(b * 0.72, h * 0.36);
  g.beginPath(); g.arc(0, 0, b * 0.11, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill();
  g.lineWidth = b * 0.012; g.strokeStyle = '#1f4d2b'; g.stroke();
  g.fillStyle = '#c0392b'; g.beginPath(); g.moveTo(0, -b * 0.09); g.lineTo(b * 0.025, 0); g.lineTo(-b * 0.025, 0); g.fill();
  g.fillStyle = '#34495e'; g.beginPath(); g.moveTo(0, b * 0.09); g.lineTo(b * 0.025, 0); g.lineTo(-b * 0.025, 0); g.fill();
  g.fillStyle = '#1f4d2b'; g.font = `bold ${b * 0.05}px sans-serif`; g.fillText('N', 0, -b * 0.13);
  g.restore();
  g.fillStyle = '#1b1b1b'; g.font = `bold ${b * 0.075}px sans-serif`;
  g.fillText('5 caches', b / 2, h * 0.53);
  g.font = `${b * 0.052}px sans-serif`;
  g.fillText('verstopt in Tinga en IJlst', b / 2, h * 0.6);
  g.font = `bold ${b * 0.058}px sans-serif`;
  g.fillText('Vind ze alle vijf!', b / 2, h * 0.68);
  g.fillStyle = '#1f4d2b'; g.fillRect(b * 0.08, h * 0.74, b * 0.84, h * 0.002 + 2);
  g.fillStyle = '#1b1b1b'; g.font = `${b * 0.048}px sans-serif`;
  g.fillText('GPS te koop bij de BP · € 250', b / 2, h * 0.8);
  g.fillText('Vraag Sjors van Radio Tinga', b / 2, h * 0.87);
  g.fillStyle = '#c0392b'; g.font = `bold ${b * 0.05}px sans-serif`;
  g.fillText('87.9 FM', b / 2, h * 0.94);
}
function tekenBordje(g, b, h, regels) {
  g.fillStyle = '#ffd34d'; g.fillRect(0, 0, b, h);
  g.strokeStyle = '#1f4d2b'; g.lineWidth = b * 0.03; g.strokeRect(b * 0.03, b * 0.03, b - b * 0.06, h - b * 0.06);
  g.fillStyle = '#1f4d2b'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `900 ${h * 0.16}px sans-serif`; g.fillText('TINGA CACHE · STAP 1', b / 2, h * 0.2);
  g.fillStyle = '#1b1b1b'; g.font = `bold ${h * 0.16}px monospace`;
  regels.forEach((r, i) => g.fillText(r, b / 2, h * (0.5 + i * 0.22)));
}

// ---------------------------------------------------------------- de module
/**
 * @param {object} o  { scene, player, hud, geluid, KAART, studio, woningen, boten, vishandel, zeg(regels, na, opties), balkDicht(),
 *                      betaal(n), verdien(n), geld() }
 */
export function initGeocache(o) {
  const { scene, player, hud, KAART } = o;
  if (!KAART || !KAART.oorsprong || !KAART.oorsprong.wgs84) return null;
  const om = maakOmrekening(KAART.oorsprong.wgs84);
  const st = { gps: false, intro: false, gevonden: 0, invoer: '', mis: 0, goud: false, aan: false, misGemeld: false };
  let caches = null, bordje = null, bouwFout = null;
  const posters = [];
  let sjors = null, hintT = 0, tekenT = 0, sjorsZicht = false;

  // ------------------------------------------------ een vrije plek: geen botsdoos, geen water, op de grond
  // (binnen de voetafdruk van een pand ligt hij onder het dak of het dek: het landhoofd van de Geeuwbrug heeft botsdozen die niet
  // de hele voetafdruk dekken, en daar lag cache 1 eerst onder het beton)
  function inPand(x, z) {
    for (const p of KAART.panden || []) {
      const r = p.rect;
      if (!r || Math.abs(r.cx - x) > 60 || Math.abs(r.cz - z) > 60 || !p.voet) continue;
      let binnen = false;
      for (let i = 0, j = p.voet.length - 1; i < p.voet.length; j = i++) {
        const [xi, zi] = p.voet[i], [xj, zj] = p.voet[j];
        if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) binnen = !binnen;
      }
      if (binnen) return true;
    }
    return false;
  }
  function vrij(x, z, r = 0.45) {
    if (pointInWater(x, z) || inPand(x, z)) return false;
    const [rx, rz] = resolveCollisions(x, z, r);
    return Math.hypot(rx - x, rz - z) < 0.01;
  }
  function zoekVrij(x, z, max = 25, eis = null) {
    for (let d = 0; d <= max; d += 0.5) {
      const n = Math.max(1, Math.round(d * 2 * Math.PI / 0.6));
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2 + d * 0.37;
        const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
        if (vrij(px, pz) && (!eis || eis(px, pz))) return { x: px, z: pz };
      }
    }
    return null;
  }
  const waterBij = (x, z, r) => {
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; if (pointInWater(x + Math.cos(a) * r, z + Math.sin(a) * r)) return true; }
    return false;
  };
  // het midden van het watervlak dat het dichtst bij (x, z) ligt
  function waterBijPunt(x, z) {
    let best = null, d = Infinity;
    for (const v of KAART.vlakken || []) {
      if (v.k !== 'water' || !v.r || !v.r[0]) continue;
      const ring = v.r[0];
      let sx = 0, sz = 0;
      for (const p of ring) { sx += p[0]; sz += p[1]; }
      sx /= ring.length; sz /= ring.length;
      const e = Math.hypot(sx - x, sz - z);
      if (e < d && pointInWater(sx, sz)) { d = e; best = { x: sx, z: sz }; }
    }
    return best;
  }
  const pandId = (id) => (KAART.panden || []).find(p => p.id === id) || null;

  // ------------------------------------------------ de vijf plekken (pas als de wereld er staat)
  function bouw() {
    if (caches || bouwFout) return;
    try {
      const plekken = [];
      // 1 · onder het landhoofd van de oude Geeuwbrug (BAG 0091100000016709), tussen de graffiti
      const gb = pandId('0091100000016709');
      const g0 = gb ? { x: gb.rect.cx, z: gb.rect.cz } : { x: -85, z: -482 };
      plekken.push(zoekVrij(g0.x, g0.z, 30, (x, z) => !waterBij(x, z, 1.5)));
      // 2 · aan de vijver in Duinterpen: de oever, een paar meter van het water
      const v = waterBijPunt(1400, 470) || { x: 1400, z: 470 };
      plekken.push(zoekVrij(v.x, v.z, 60, (x, z) => waterBij(x, z, 3.5) && !waterBij(x, z, 1.2)));
      // 3 · een multi: stap 1 bij Martens Vishandel (het bordje), de cache achter de tennishal (BAG 0091100000013880)
      const vp = o.vishandel && o.vishandel.plek ? (typeof o.vishandel.plek === 'function' ? o.vishandel.plek() : o.vishandel.plek) : null;
      const bordPlek = vp ? zoekVrij(vp.x + 4, vp.z + 4, 20) : null;
      const th = pandId('0091100000013880');
      let achter = { x: 980, z: -250 };
      if (th) {
        const L = Math.hypot(th.front[0], th.front[1]) || 1, fx = th.front[0] / L, fz = th.front[1] / L;
        const u = [Math.cos(th.rect.hoek), Math.sin(th.rect.hoek)];
        const diep = Math.abs(fx * u[0] + fz * u[1]) > 0.7 ? th.rect.hx : th.rect.hz;
        achter = { x: th.rect.cx - fx * (diep + 2.5), z: th.rect.cz - fz * (diep + 2.5) };
      }
      plekken.push(zoekVrij(achter.x, achter.z, 30));
      // 4 · aan het water bij Houtzaagmolen De Rat in IJlst: alleen vanaf het water te pakken
      const a4 = NOMERCY5.aanleg;
      plekken.push(zoekVrij(a4.x, a4.z, 30, (x, z) => waterBij(x, z, 2.5)));
      // 5 · bij de gedenkplek met de Tiger aan de Sudergoweg
      const t = TIGER.plek;
      plekken.push(zoekVrij(t.x - Math.sin(t.yaw) * 6, t.z - Math.cos(t.yaw) * 6, 20));
      if (plekken.some(p => !p)) { bouwFout = 'geen vrije plek'; return; }
      // het punt uit het raadsel: een vaste verschuiving van 2,5–4,5 m, en dan afgerond op duizendsten van een minuut
      caches = plekken.map((p, i) => {
        const a = 1.3 + i * 2.1, r = 2.5 + (i % 3) * 1.0;
        let q = { x: p.x + Math.cos(a) * r, z: p.z + Math.sin(a) * r };
        const gr = om.naarGraden(q.x, q.z), n = deel(gr.lat), e = deel(gr.lon);
        const terug = uitDelen(n, e), qq = om.vanGraden(terug.lat, terug.lon);
        return { nr: i + 1, plek: p, punt: qq, n, e, gevonden: false, mesh: null };
      });
      // de cijfers in de logboeken: die van het doel van de vijfde (N: alle drie, E: de eerste)
      const c5 = caches[4];
      const dN = drie(c5.n.dui), dE = drie(c5.e.dui);
      caches.forEach((c, i) => { if (i < 4) { c.letter = CACHE.letters[i]; c.cijfer = i < 3 ? dN[i] : dE[0]; } });
      c5.rest = dE.slice(1);
      // het bordje van stap 1 bij de vishandel: daarop staat het doel van de cache achter de tennishal
      const c3 = caches[2];
      if (bordPlek) {
        bordje = bouwBordje(bordPlek, [tekstN(uitDelen(c3.n, c3.e).lat), tekstE(uitDelen(c3.n, c3.e).lon)]);
        c3.stap1 = bordPlek;
        const s1 = om.naarGraden(bordPlek.x, bordPlek.z);
        c3.stap1n = deel(s1.lat); c3.stap1e = deel(s1.lon);
      }
      caches.forEach(c => { c.mesh = bouwKistje(c.plek); });
      bouwPosters();
      werkZichtBij();
    } catch (e) { bouwFout = String(e && e.message || e); caches = null; }
  }

  // ------------------------------------------------ de dingen in de wereld
  const matKist = new THREE.MeshStandardMaterial({ color: 0x55633a, roughness: 0.75, metalness: 0.15 });
  const matDeksel = new THREE.MeshStandardMaterial({ color: 0x3d4829, roughness: 0.7, metalness: 0.2 });
  const matPaal = new THREE.MeshStandardMaterial({ color: 0x6b6f72, roughness: 0.6, metalness: 0.3 });
  const matPoster = new THREE.MeshStandardMaterial({ map: doek(512, 724, tekenPoster), roughness: 0.85 });
  function bouwKistje(p) {
    const g = new THREE.Group();
    const y = grondHoogte(p.x, p.z);
    const romp = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.17, 0.2), matKist); romp.position.y = 0.085;
    const deksel = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.22), matDeksel); deksel.position.y = 0.185;
    const greep = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.03), matDeksel); greep.position.y = 0.21;
    g.add(romp, deksel, greep);
    g.position.set(p.x, y, p.z);
    g.rotation.y = (p.x * 13.1 + p.z * 7.3) % Math.PI;
    g.visible = false;
    g.userData.deksel = deksel;
    scene.add(g);
    return g;
  }
  function bouwBordje(p, regels) {
    const g = new THREE.Group();
    const y = grondHoogte(p.x, p.z);
    const paal = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.3, 0.06), matPaal); paal.position.y = 0.65;
    const mat = new THREE.MeshStandardMaterial({ map: doek(512, 320, (gg, b, h) => tekenBordje(gg, b, h, regels)), roughness: 0.6 });
    const bord = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.375), mat); bord.position.set(0, 1.25, 0.035);
    const achter = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.39, 0.02), matPaal); achter.position.set(0, 1.25, 0.02);
    g.add(paal, achter, bord);
    g.position.set(p.x, y, p.z);
    g.visible = false;
    g.userData.regels = regels;
    scene.add(g);
    return g;
  }
  // een poster: rechtop (met een `naar` waar hij heen kijkt) of plat op een tafel
  function poster(x, y, z, { naar = null, plat = false, draai = 0, maat = 0.42 } = {}) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(maat, maat * 724 / 512), matPoster);
    m.position.set(x, y, z);
    if (plat) { m.rotation.x = -Math.PI / 2; m.rotation.z = draai; }
    else if (naar) m.lookAt(naar.x, y, naar.z);
    scene.add(m);
    posters.push(m);
    return m;
  }
  function bouwPosters() {
    // 1 · in de BP-shop, rechtop op de balie, naar de klant (de klant staat aan de kant van de deur: kleinere w)
    {
      const [x, z] = bpWereld(4.9, 6.0), [nx, nz] = bpWereld(4.9, 3.0);
      poster(x, 1.05 + 0.3 * 724 / 512 / 2 + 0.02, z, { naar: { x: nx, z: nz }, maat: 0.3 });
    }
    // 2 · een prikbord op een paal bij de stoep van Radio Tinga
    const sp = o.studio && o.studio.plekken;
    if (sp && sp.stoep) {
      const d = sp.deurBuiten || sp.stoep;
      const dx = sp.stoep.x - d.x, dz = sp.stoep.z - d.z, L = Math.hypot(dx, dz) || 1;
      const zij = { x: -dz / L, z: dx / L };
      const p = zoekVrij(sp.stoep.x + zij.x * 2.2, sp.stoep.z + zij.z * 2.2, 6) || { x: sp.stoep.x + zij.x * 2.2, z: sp.stoep.z + zij.z * 2.2 };
      const y = grondHoogte(p.x, p.z);
      const paal = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.6, 0.08), matPaal); paal.position.set(p.x, y + 0.8, p.z);
      scene.add(paal); posters.push(paal);
      poster(p.x + dx / L * 0.05, y + 1.35, p.z + dz / L * 0.05, { naar: { x: p.x + dx / L * 5, z: p.z + dz / L * 5 }, maat: 0.5 });
    }
    // 3 · op de eettafel van de drie woningen die Erik kan kopen (Zeskanter 16, Molenkrite 130c, Koningsspil 20)
    for (const w of o.woningen || []) {
      const naam = (w.adres || w.naam || '').replace(/\s/g, '');
      if (!/Zeskanter16|Molenkrite130c|Koningsspil20/.test(naam) || !w.plekken || !w.plekken.tafel) continue;
      const t = w.plekken.tafel;
      poster(t.x + 0.18, 0.745, t.z - 0.06, { plat: true, draai: 0.35, maat: 0.21 });
    }
  }

  // ------------------------------------------------ Sjors
  function sjorsPlek() {
    const sp = o.studio && o.studio.plekken;
    if (!sp || !sp.stoep) return null;
    const d = sp.deurBuiten || sp.stoep;
    const dx = sp.stoep.x - d.x, dz = sp.stoep.z - d.z, L = Math.hypot(dx, dz) || 1;
    const p = zoekVrij(sp.stoep.x + dx / L * CACHE.sjorsVoor - dz / L * 1.2, sp.stoep.z + dz / L * CACHE.sjorsVoor + dx / L * 1.2, 6);
    return p ? { ...p, yaw: Math.atan2(-dx / L, -dz / L) + Math.PI } : null;
  }
  function zorgVoorSjors() {
    if (sjors || !o.Persoon) return sjors;
    const p = sjorsPlek();
    if (!p) return null;
    sjors = new o.Persoon({ shirt: 0x202020, broek: 0x2c3e66, huid: 0xe2b996, haar: 0x2a1c12, hoogte: 1.0, korteMouw: true });
    scene.add(sjors.groep);
    sjors.zetNeer(p.x, p.z, p.yaw);
    sjors.groep.visible = false;
    sjors.plek = p;
    return sjors;
  }

  // ------------------------------------------------ de staat
  const huidig = () => (caches && st.gevonden < CACHE.totaal ? caches[st.gevonden] : null);
  const spelerPunt = () => (player.inCar ? { x: player.inCar.x, z: player.inCar.z } : { x: player.pos.x, z: player.pos.z });
  // het ingetikte doel: 6 cijfers (N en E, duizendsten); de rest van de coördinaten staat in het raadsel
  function doel() {
    const c = huidig();
    if (!c) return null;
    if (c.nr === 1) return c.punt;                       // de eerste zet Sjors zelf in je GPS
    if (st.invoer.length < 6) return null;
    const vast = (c.nr === 3 && !c.stap1Gezien && c.stap1n) ? { n: c.stap1n, e: c.stap1e } : { n: c.n, e: c.e };
    const n = { ...vast.n, dui: +st.invoer.slice(0, 3) }, e = { ...vast.e, dui: +st.invoer.slice(3, 6) };
    const g = uitDelen(n, e);
    return om.vanGraden(g.lat, g.lon);
  }
  // het raadsel van de cache waar je bent
  function raadsel() {
    const c = huidig();
    if (!c) return st.gevonden >= CACHE.totaal ? ['Alle vijf gevonden!', 'Gefeliciteerd, cacher van Tinga.'] : [];
    const N = (d) => `N ${d.gr}° ${twee(d.min)}.`, E = (d) => `E ${drie(d.gr)}° ${twee(d.min)}.`;
    const vol = (n, e) => `${N(n)}${drie(n.dui)}  ${E(e)}${drie(e.dui)}`;
    if (c.nr === 1) return ['Cache 1 · de oude Geeuwbrug', vol(c.n, c.e), 'Onder het landhoofd, tussen de graffiti.', 'Sjors heeft hem al in je GPS gezet.'];
    if (c.nr === 2) {
      const kN = 1944 - c.n.dui, kE = 879 + 15 - c.e.dui;
      const fN = kN >= 0 ? `B − ${kN}` : `B + ${-kN}`, fE = kE >= 0 ? `C + A − ${kE}` : `C + A + ${-kE}`;
      return ['Cache 2 · een raadsel', 'A = het huisnummer van Mark', 'B = het jaar op de gedenksteen aan de Sudergoweg', 'C = de frequentie van Radio Tinga × 10',
        `${N(c.n)}(${fN})  ${E(c.e)}(${fE})`, 'Bij het water in Duinterpen.'];
    }
    if (c.nr === 3) {
      if (!c.stap1Gezien) return ['Cache 3 · een multi', `Stap 1: ${vol(c.stap1n, c.stap1e)}`, 'Bij Martens Vishandel staat een bordje.', 'Daarop staat waar de cache ligt.'];
      return ['Cache 3 · stap 2', 'Tik in wat er op het bordje stond.', 'Achter een grote hal aan de Lemmerweg.'];
    }
    if (c.nr === 4) return ['Cache 4 · een opdracht', vol(c.n, c.e), 'Bij de molen De Rat in IJlst.', 'Alleen te pakken vanaf het water:', 'neem een boot.'];
    const r = CACHE.letters.join(' ');
    return ['Cache 5 · de finale', `Letters uit je logboeken: ${r}`, 'Waar herdenkt Sneek de ___ om Sneek?', 'De cijfers uit je logboeken, op volgorde:',
      `${N(c.n)}[1][2][3]  ${E(c.e)}[4]${c.rest}`];
  }

  function werkZichtBij() {
    if (!caches) return;
    caches.forEach((c, i) => { if (c.mesh) c.mesh.visible = st.gps && i <= st.gevonden; });
    if (bordje) bordje.visible = st.gps && st.gevonden >= 2;
    caches.forEach((c, i) => { if (c.mesh && c.mesh.userData.deksel) c.mesh.userData.deksel.rotation.x = i < st.gevonden ? -0.9 : 0; });
  }

  // ------------------------------------------------ de GPS in beeld
  const gpsEl = document.createElement('div');
  gpsEl.id = 'gpsToestel'; gpsEl.hidden = true;
  const doekEl = document.createElement('canvas'); doekEl.width = 300; doekEl.height = 470;
  gpsEl.appendChild(doekEl);
  {
    const css = document.createElement('style');
    css.textContent = `#gpsToestel { position: fixed; right: 18px; bottom: 96px; z-index: 5; width: 230px; pointer-events: none;
      filter: drop-shadow(0 6px 14px rgba(0,0,0,.55)); }
      #gpsToestel[hidden] { display: none; } #gpsToestel canvas { width: 100%; display: block; }
      @media (max-width: 700px) { #gpsToestel { width: 170px; bottom: 150px; } }`;
    document.head.appendChild(css);
    (document.getElementById('ui') || document.body).appendChild(gpsEl);
  }
  let schommel = { x: 0, z: 0, t: 0 };
  function tekenGps(dt) {
    const g = doekEl.getContext('2d'), B = doekEl.width, H = doekEl.height;
    g.clearRect(0, 0, B, H);
    // de behuizing: geel met zwarte randen, zoals een eTrex
    const rond = (x, y, b, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + b, y, x + b, y + h, r); g.arcTo(x + b, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + b, y, r); g.closePath(); };
    rond(8, 6, B - 16, H - 12, 34); g.fillStyle = '#f2c230'; g.fill(); g.lineWidth = 6; g.strokeStyle = '#222'; g.stroke();
    g.fillStyle = '#2b2b2b'; g.fillRect(B / 2 - 18, 0, 36, 14);               // de antenne
    rond(26, 40, B - 52, H - 140, 12); g.fillStyle = '#1a1d16'; g.fill();
    rond(32, 46, B - 64, H - 152, 8); g.fillStyle = '#c9d8b0'; g.fill();          // het scherm
    // de knoppen onderaan
    for (const [x, y] of [[B * 0.32, H - 62], [B * 0.5, H - 52], [B * 0.68, H - 62]]) { g.beginPath(); g.arc(x, y, 13, 0, Math.PI * 2); g.fillStyle = '#2b2b2b'; g.fill(); }
    g.fillStyle = '#2b2b2b'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.fillText('TINGA GPS', B / 2, H - 22);
    // het scherm
    const x0 = 42, w = B - 84;
    let y = 66;
    g.textAlign = 'left'; g.fillStyle = '#1b2410';
    g.font = 'bold 15px monospace'; g.fillText(st.gevonden >= 5 ? 'TINGA CACHE 5/5 ✓' : `TINGA CACHE ${st.gevonden + 1}/5`, x0, y);
    y += 14; g.font = '11px monospace'; g.fillText(`gevonden: ${st.gevonden} van 5`, x0, y);
    y += 18;
    schommel.t -= dt;
    if (schommel.t <= 0) { schommel = { x: (Math.random() - 0.5) * 2 * CACHE.schommel, z: (Math.random() - 0.5) * 2 * CACHE.schommel, t: 1.2 }; }
    const sp = spelerPunt(), gr = om.naarGraden(sp.x + schommel.x * 0.3, sp.z + schommel.z * 0.3);
    g.font = '12px monospace';
    g.fillText('JIJ', x0, y); g.fillText(tekstN(gr.lat), x0 + 34, y); y += 15; g.fillText(tekstE(gr.lon), x0 + 34, y); y += 20;
    const c = huidig();
    if (c) {
      const d = doel();
      const iv = st.invoer.padEnd(6, '_');
      const vast = (c.nr === 3 && !c.stap1Gezien && c.stap1n) ? { n: c.stap1n, e: c.stap1e } : { n: c.n, e: c.e };
      const toon = c.nr === 1 ? [drie(c.n.dui), drie(c.e.dui)] : [iv.slice(0, 3), iv.slice(3, 6)];
      g.fillText('DOEL', x0, y); g.fillText(`N ${vast.n.gr}° ${twee(vast.n.min)}.${toon[0]}`, x0 + 34, y); y += 15;
      g.fillText(`E ${drie(vast.e.gr)}° ${twee(vast.e.min)}.${toon[1]}`, x0 + 34, y); y += 10;
      // de pijl en de afstand
      if (d) {
        const dx = d.x - sp.x, dz = d.z - sp.z, afstand = Math.hypot(dx, dz);
        const kijk = player.inCar ? player.inCar.yaw : player.yaw;
        const hoek = Math.atan2(dx, -dz) + kijk;               // 0 = recht vooruit
        const cx = x0 + 52, cy = y + 52;
        g.beginPath(); g.arc(cx, cy, 40, 0, Math.PI * 2); g.strokeStyle = '#33401f'; g.lineWidth = 2; g.stroke();
        g.save(); g.translate(cx, cy);
        const zwalk = afstand < CACHE.dichtbij ? Math.sin(performance.now() / 180) * 0.9 : 0;
        g.rotate(hoek + zwalk);
        g.beginPath(); g.moveTo(0, -34); g.lineTo(13, 10); g.lineTo(0, 2); g.lineTo(-13, 10); g.closePath(); g.fillStyle = '#b8261b'; g.fill();
        g.restore();
        g.font = 'bold 20px monospace'; g.fillStyle = '#1b2410';
        g.fillText(afstand >= 1000 ? `${(afstand / 1000).toFixed(2)} km` : `${Math.round(afstand)} m`, x0 + 106, y + 46);
        g.font = '11px monospace'; g.fillText(`± ${CACHE.schommel} m`, x0 + 106, y + 64);
        if (afstand < CACHE.dichtbij) { g.font = 'bold 12px monospace'; g.fillStyle = '#7a1d12'; g.fillText('DICHTBIJ — ZOEK!', x0 + 100, y + 84); g.fillStyle = '#1b2410'; }
        y += 104;
      } else {
        g.font = '11px monospace'; g.fillText('tik het doel in: 1–9, 0', x0, y + 22); g.fillText('← backspace wist', x0, y + 37);
        y += 52;
      }
    } else { y += 10; }
    // het raadsel
    g.font = '11px sans-serif'; g.fillStyle = '#1b2410';
    const rg = raadsel();
    for (const r of rg) {
      const woorden = r.split(' '); let regel = '';
      for (const wd of woorden) {
        const proef = regel ? `${regel} ${wd}` : wd;
        if (g.measureText(proef).width > w) { g.fillText(regel, x0, y); y += 13; regel = wd; } else regel = proef;
      }
      if (regel) { g.fillText(regel, x0, y); y += 13; }
      if (y > H - 108) break;
    }
  }

  // ------------------------------------------------ openen, beloning
  function openCache(c) {
    c.gevonden = true;
    st.gevonden++;
    st.invoer = ''; st.mis = 0; st.misGemeld = false;
    const loon = CACHE.loon[c.nr - 1];
    if (o.verdien) o.verdien(loon);
    if (o.geluid && o.geluid.kistje) o.geluid.kistje();
    werkZichtBij();
    if (c.nr < 5) {
      hud.melding(`CACHE ${c.nr}/5 GEVONDEN`, `Logboek getekend. In het logboek: letter ${c.letter}, cijfer ${c.cijfer}. + € ${loon}`, 8);
      const radio = [
        `Radio Tinga 87.9: de cache bij de oude Geeuwbrug is gevonden, door Erik! Nog vier te gaan.`,
        `Radio Tinga 87.9: Erik heeft het raadsel opgelost, de cache bij het water in Duinterpen is gevonden.`,
        `Radio Tinga 87.9: de multi achter de tennishal is binnen. Goed gezocht, Erik.`,
        `Radio Tinga 87.9: vanaf het water nog wel! Cache vier bij de molen De Rat is gevonden. Nu de finale…`,
      ][c.nr - 1];
      if (o.zeg) setTimeout(() => o.zeg([{ wie: 'Sjors · Radio Tinga', tekst: radio }], null, { auto: 4.5 }), 2500);
      return;
    }
    // de finale: de gouden M1 Garand en € 2.500
    st.goud = true;
    geefGoud();
    hud.melding('TINGA CACHE VOLTOOID', `Alle vijf gevonden! + € ${loon} en de gouden M1 Garand.`, 10);
    if (o.zeg) setTimeout(() => o.zeg([{ wie: 'Sjors · Radio Tinga', tekst: 'Radio Tinga 87.9: we hebben een winnaar! Erik heeft alle vijf caches van de Tinga Cache gevonden. Erik, dit nummer is voor jou.' }], null, { auto: 5 }), 2500);
  }
  function geefGoud() {
    if (!player.wapens || !player.modellen || !player.modellen.garand) return;
    if (!player.wapens.includes('garand')) {
      player.reserve = Math.min(999, (player.reserve || 0) + 56);
      if (player.krijgWapen) player.krijgWapen('garand');
    }
    if (player.modellen.garand.zetGoud) player.modellen.garand.zetGoud(true);
  }

  // ------------------------------------------------ toetsen
  function bijSjors() {
    if (!sjors || !sjors.groep.visible || player.inCar) return false;
    const sp = spelerPunt();
    return Math.hypot(sp.x - sjors.groep.position.x, sp.z - sjors.groep.position.z) < CACHE.praat;
  }
  function bijCache() {
    const c = huidig();
    if (!c || !c.mesh || !c.mesh.visible) return null;
    const sp = spelerPunt(), d = Math.hypot(sp.x - c.plek.x, sp.z - c.plek.z);
    if (c.nr === 4) return o.boten && o.boten.inBoot && d < CACHE.vanafBoot ? c : null;
    return !player.inCar && d < CACHE.open ? c : null;
  }
  function bijBordje() {
    const c = huidig();
    if (!c || c.nr !== 3 || !c.stap1 || !bordje || !bordje.visible || player.inCar) return false;
    const sp = spelerPunt();
    return Math.hypot(sp.x - c.stap1.x, sp.z - c.stap1.z) < 2.2;
  }
  function praatMetSjors() {
    if (!o.zeg) return;
    const c = huidig();
    if (!st.intro) {
      st.intro = true;
      o.zeg([
        { wie: 'Sjors', tekst: 'Hé, jij hebt een GPS! Doe je mee met de Tinga Cache? Ik heb er vijf verstopt, in Tinga en in IJlst.' },
        { wie: 'Sjors', tekst: 'Zo werkt het: met N pak je je GPS. Bij elke cache hoort een raadsel, en de antwoorden zijn coördinaten. Die tik je in.' },
        { wie: 'Sjors', tekst: 'De GPS wijst je de weg, maar niet tot op de meter: het laatste stukje moet je zelf zoeken. Een kistje, onder een struik of achter een paaltje.' },
        { wie: 'Sjors', tekst: 'In elk logboek staat een letter en een cijfer. Die heb je nodig voor de laatste. En wie ze alle vijf vindt… krijgt van mij iets heel moois.' },
        { wie: 'Sjors', tekst: 'De eerste heb ik al in je GPS gezet: bij de oude Geeuwbrug. Succes!' },
      ], () => werkZichtBij());
      return;
    }
    if (!c) { o.zeg([{ wie: 'Sjors', tekst: 'Alle vijf! Je bent de beste cacher van Sneek. Die gouden M1 heb je verdiend.' }]); return; }
    const hints = [
      'Cache 1 ligt bij de oude Geeuwbrug, aan de kant van het land, tussen de graffiti. Kijk laag.',
      'Het huisnummer van Mark ken je wel. Het jaar staat op de bronzen plaat bij de Tiger, en de frequentie hoor je op de radio: 87.9.',
      c.stap1Gezien ? 'Het bordje bij de vishandel geeft je de coördinaten van de tweede stap. De cache ligt achter de tennishal.' : 'Ga eerst naar het bordje bij Martens Vishandel, op het parkeerterrein van de Jumbo.',
      'Cache 4 hangt aan de waterkant bij de molen in IJlst. Te voet kom je er niet bij: pak een sloep.',
      'S, L, A, G: de Slag om Sneek. De cijfers uit de logboeken op volgorde, en de laatste twee staan al in je GPS.',
    ];
    o.zeg([{ wie: 'Sjors', tekst: hints[c.nr - 1] }]);
  }

  const api = {
    CACHE,
    get stand() { return { ...st, caches: caches ? caches.map(c => ({ nr: c.nr, plek: c.plek, punt: c.punt, n: c.n, e: c.e, letter: c.letter, cijfer: c.cijfer, stap1: c.stap1 || null, zicht: !!(c.mesh && c.mesh.visible) })) : null, bouwFout, rest: caches ? caches[4].rest : null }; },
    get gevonden() { return st.gevonden; },
    get aan() { return st.aan; },
    get gps() { return st.gps; },
    get bordje() { return bordje; },
    get posters() { return posters; },
    get sjors() { return sjors; },
    om, raadsel, doel, bouw,
    // (js/bpkassa.js) de GPS kopen
    koopGps() {
      if (st.gps) { hud.melding('BP', '"Die heb je al, toch? Zet hem maar aan met N."', 3); return 'heeft'; }
      if (!o.betaal || !o.betaal(CACHE.prijs)) { hud.melding('Te weinig geld', `Een GPS kost € ${CACHE.prijs}.`, 3); return 'arm'; }
      st.gps = true;
      bouw();
      werkZichtBij();
      if (o.zeg) o.zeg([
        { wie: 'Medewerker BP', tekst: 'Een GPS, mooi ding. Ga je meedoen met de Tinga Cache? Daar hangt de poster.' },
        { wie: 'Medewerker BP', tekst: 'Dan moet je bij Sjors zijn, van Radio Tinga. Die heeft de caches verstopt. Hij staat vaak voor de studio aan de Tinga.' },
        { wie: 'Medewerker BP', tekst: 'Met N zet je hem aan. Veel plezier!' },
      ]);
      hud.melding('GPS gekocht', `€ ${CACHE.prijs} betaald. N zet hem aan. Sjors staat bij Radio Tinga (de S op de kaart).`, 6);
      return 'ok';
    },
    // N: aan en uit
    wissel() {
      if (!st.gps) { hud.show(`Je hebt geen GPS: te koop aan de kassa van de BP (€ ${CACHE.prijs}).`, 3); return false; }
      bouw();
      st.aan = !st.aan;
      gpsEl.hidden = !st.aan;
      if (st.aan) tekenGps(0);
      return true;
    },
    // de cijfertoetsen terwijl de GPS aan is; true als hij ze gebruikt
    cijfer(d) {
      if (!st.aan || !caches) return false;
      const c = huidig();
      if (!c || c.nr === 1) return false;
      if (d === 'terug') { st.invoer = st.invoer.slice(0, -1); tekenGps(0); return true; }
      if (st.invoer.length >= 6) st.invoer = '';
      st.invoer += String(d);
      st.misGemeld = false;
      tekenGps(0);
      return true;
    },
    // E: Sjors, het bordje of een cache
    toets() {
      if (o.balkDicht && !o.balkDicht()) return false;
      if (bijSjors()) { praatMetSjors(); return true; }
      if (bijBordje()) {
        const c = huidig();
        c.stap1Gezien = true; st.invoer = '';
        hud.melding('TINGA CACHE · STAP 1', `Op het bordje: ${bordje.userData.regels.join('  ')}. Tik ze in je GPS.`, 10);
        return true;
      }
      const c = bijCache();
      if (c) { openCache(c); return true; }
      return false;
    },
    hint() {
      if (bijSjors()) return 'E — praten met Sjors (Tinga Cache)';
      if (bijBordje()) return 'E — het bordje lezen';
      if (bijCache()) return 'E — cache openen';
      return null;
    },
    update(dt) {
      if (!player.active && !window.__autoplay) return;
      if (st.gps) bouw();
      // Sjors op de stoep zolang er nog iets te zoeken is; de S op de kaart
      const wil = st.gps && st.gevonden < CACHE.totaal;
      if (wil) zorgVoorSjors();
      if (sjors) {
        const sp = spelerPunt();
        const ver = Math.hypot(sp.x - sjors.plek.x, sp.z - sjors.plek.z) > 50;
        if (wil !== sjors.groep.visible && (ver || !wil)) sjors.groep.visible = wil;
        if (sjors.groep.visible) {
          const d = Math.hypot(sp.x - sjors.groep.position.x, sp.z - sjors.groep.position.z);
          if (d < 8) sjors.kijkNaar(sp.x, sp.z, dt); else sjors.draaiNaar(sjors.plek.yaw, dt, 1.5);
          if (d < 120) sjors.update(dt, {});
        }
      }
      const s = wil && sjors ? { x: sjors.plek.x, z: sjors.plek.z } : null;
      if (hud.zetSjors && (sjorsZicht !== !!s)) { hud.zetSjors(s); sjorsZicht = !!s; }
      // de GPS
      if (st.aan) { tekenT -= dt; if (tekenT <= 0) { tekenT = 0.12; tekenGps(0.12); } }
      // op het ingetikte punt en niets: na twee keer een hint van Sjors
      const c = huidig(), d = doel();
      if (c && d && c.nr !== 1 && !st.misGemeld) {
        const sp = spelerPunt();
        if (Math.hypot(sp.x - d.x, sp.z - d.z) < 6 && Math.hypot(d.x - c.punt.x, d.z - c.punt.z) > CACHE.mis) {
          st.misGemeld = true; st.mis++;
          hud.melding('Hier is niets…', st.mis >= 2 ? 'Klopt je raadsel wel? Sjors bij Radio Tinga heeft een hint (E bij hem).' : 'Kijk je raadsel nog eens na.', 5);
        }
      }
      // de hint bij een cache of het bordje
      hintT -= dt;
      const h = api.hint();
      if (h && hintT <= 0) { hintT = 1.2; hud.show(h, 1.4); }
    },
    // opslag (js/opslag.js)
    bewaar() { return { gps: st.gps, intro: st.intro, gevonden: st.gevonden, invoer: st.invoer, mis: st.mis, goud: st.goud, stap1: !!(caches && caches[2] && caches[2].stap1Gezien) }; },
    herstel(d) {
      st.gps = !!(d && d.gps); st.intro = !!(d && d.intro); st.gevonden = Math.max(0, Math.min(CACHE.totaal, (d && d.gevonden) | 0));
      st.invoer = d && typeof d.invoer === 'string' ? d.invoer.replace(/\D/g, '').slice(0, 6) : '';
      st.mis = (d && d.mis) | 0; st.goud = !!(d && d.goud); st.misGemeld = false;
      st.aan = false; gpsEl.hidden = true;
      if (st.gps) bouw();
      if (caches) { caches.forEach((c, i) => { c.gevonden = i < st.gevonden; }); if (caches[2]) caches[2].stap1Gezien = !!(d && d.stap1); }
      werkZichtBij();
      if (player.modellen && player.modellen.garand && player.modellen.garand.zetGoud) player.modellen.garand.zetGoud(st.goud);
      if (st.goud && player.wapens && !player.wapens.includes('garand')) geefGoud();
    },
    nieuw() { api.herstel(null); },
    // (voor proeven) een cache meteen openen
    __open(nr) { bouw(); const c = caches && caches[nr - 1]; if (c && nr - 1 === st.gevonden) { openCache(c); return true; } return false; },
  };
  return api;
}
