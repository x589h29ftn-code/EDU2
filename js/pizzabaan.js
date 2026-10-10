/*
 Pizza bezorgen als bijbaantje.

 Gevraagd (10 okt 2026): "Pizza bezorgen toevoegen". De pizzascooter van js/leven.js rijdt
 al rond etenstijd door de wijk; hier word je zelf de bezorger.

 Hoe het gaat
   1. Bij Pizzeria Sneek (tegen de Jumbo in Tinga) en Cappadocia (tegen de Jumbo aan de
      Lemmerweg) staat een afhaalluik: een toonbank onder een luifel, een stapel dozen en de
      bakker erachter. De zaken staan niet in de BGT; hun plek komt uit het pand van de
      supermarkt ernaast (`zoekPizzerias`): de gevel die naar de weg kijkt.
   2. E aan de toonbank (te voet binnen PIZZABAAN.toonbank, of stilstaand in een voertuig binnen
      `toonbankRijdend`) neemt een rit aan. Voor de deur staat een scooter van de zaak; je eigen
      auto mag ook. Het adres komt uit de kaart (`huisnummers`, met de straat erbij), de route
      over de weg (js/navigatie.js), en de tijd is de lengte van die route gedeeld door
      PIZZABAAN.tempo plus een marge.
   3. Bij het adres: stilstaan binnen `deur` meter van de voordeur (in een voertuig `deurRijdend`,
      je stapt even af) en E: € 40 plus een fooi naar de tijd die over is (0–30), min de schade
      aan wat je reed. Daarna: "nog een rit?", de route terug naar de zaak.
   4. Te laat: de pizza is koud, geen geld, de rit is voorbij. X breekt af (js/main.js).

 Alleen buiten de missies om: js/main.js geeft `vrij` mee aan `update`. Wordt het onder een rit
 onvrij (de telefoon, een klus), dan stopt de rit zonder geld.

 De route staat als eigen doel op de kaart (`hud.zetEigenNav`, paars): de gele navigatie is van
 het verhaal (js/verhaal.js zet hem op elk moment terug). Heeft de speler zelf een doel gekozen,
 dan wint dat; is dat bereikt, dan komt de route van de pizza terug.

 Alles wat hier getekend wordt, wordt bij het opstarten gemaakt en in de scène gehangen (de
 scooters staan al voor de zaken), zodat `soortenVoorbereid` (js/world.js) de materialen vooraf
 vertaalt. Er gaat tijdens het spelen geen lichtbron aan of uit.
*/
import * as THREE from 'three';
import { Persoon } from './persoon.js';
import { grondHoogte, nearestRoadName, addCollider } from './world.js';
import { Navigatie, routeLengte } from './navigatie.js';
import { doosDoek } from './leven.js';
import { euro } from './hud.js';

export const PIZZABAAN = {
  toonbank: 3, toonbankRijdend: 8,      // hoe dicht bij de toonbank E werkt (te voet / in een voertuig)
  deur: 6, deurRijdend: 12,             // hoe dicht bij de voordeur
  stil: 1.5,                            // m/s: harder dan dit rijd je nog, en geef je niets af
  tempo: 7, marge: 25,                  // de tijd: routelengte / tempo + marge (s)
  basis: 40, fooi: 30,                  // € per rit, en de fooi bij nul seconden gebruikt
  adresVan: 250, adresTot: 1100,        // hoe ver het adres van de zaak ligt (hemelsbreed)
  scooterTop: 13,                       // m/s, zo'n 47 km/u
  terugNa: 150,                         // een achtergelaten scooter gaat terug als je verder weg bent
  navKlok: 2, navOpnieuw: 15,           // de route opnieuw: om de zoveel tellen, als je zoveel verder bent
};

// de twee zaken: naam, het merk op de doos (zie `doosDoek` in js/leven.js) en het pand ernaast
export const PIZZERIAS = [
  { naam: 'Pizzeria Sneek', merk: 'Pizzeria', pand: 'jumbo', kleur: '#c8202a', donker: '#7a1016', licht: '#f4efe6', scooter: 0xc8202a },
  { naam: 'Cappadocia', merk: 'Cappadocia', pand: 'jumbo_lemmerweg', kleur: '#1f2f5a', donker: '#121c38', licht: '#d6b04a', scooter: 0x1f2f5a },
];

// ---- doeken ----
// de luifel: banen in de kleuren van de zaak
function luifelDoek(z) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? z.licht : z.kleur; g.fillRect(i * 16, 0, 16, 64); }
  // de plooi aan de voorkant iets donkerder
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 54, 128, 10);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// het bord aan de voorkant van de luifel, met de naam
function bordDoek(z) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 72;
  const g = c.getContext('2d');
  g.fillStyle = z.donker; g.fillRect(0, 0, 512, 72);
  g.strokeStyle = z.licht; g.lineWidth = 4; g.strokeRect(6, 6, 500, 60);
  g.fillStyle = z.licht; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 40px Georgia, serif';
  g.fillText(z.naam.toUpperCase(), 256, 38);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
// de voorkant van de toonbank: "BEZORGERS GEZOCHT" — daar gaat het om
function frontDoek(z) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = z.kleur; g.fillRect(0, 0, 256, 160);
  g.fillStyle = z.licht; g.fillRect(0, 0, 256, 12); g.fillRect(0, 148, 256, 12);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 30px sans-serif'; g.fillText('PIZZA', 128, 50);
  g.font = 'bold 19px sans-serif'; g.fillText('BEZORGERS', 128, 92); g.fillText('GEZOCHT', 128, 118);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// het menu op de muur naast het luik
function menuDoek(z) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 192;
  const g = c.getContext('2d');
  g.fillStyle = '#1b1b1b'; g.fillRect(0, 0, 128, 192);
  g.strokeStyle = z.licht; g.lineWidth = 3; g.strokeRect(4, 4, 120, 184);
  g.fillStyle = '#f0ece0'; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.font = 'bold 16px sans-serif'; g.fillText('MENU', 12, 22);
  g.font = '11px sans-serif';
  const regels = [['Margherita', '9,50'], ['Salami', '11,00'], ['Hawaï', '11,50'], ['Tonno', '12,00'], ['Calzone', '13,50'], ['Döner', '12,50'], ['Lahmacun', '6,00']];
  regels.forEach(([w, p], i) => { g.fillText(w, 12, 48 + i * 19); g.textAlign = 'right'; g.fillText(p, 116, 48 + i * 19); g.textAlign = 'left'; });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/*
 Waar de zaak staat. Het pand van de supermarkt (`def.pand`) en daarvan de gevel die het meest
 recht naar een weg voor auto's kijkt; op die gevel een kwart uit het midden (het midden is de
 ingang van de supermarkt), een afhaalluik. Geeft per zaak:
   wand    het punt op de gevel, n de normaal naar buiten, e langs de gevel
   staan   waar je staat om te bestellen (voor de toonbank)
   scooter waar de scooter staat (op de stoep, evenwijdig aan de gevel)
   goot    de goothoogte van het pand (de luifel blijft eronder)
*/
export function zoekPizzerias(KAART) {
  const assen = (KAART.wegassen || []).filter(a => a.drive);
  // het dichtstbijzijnde punt op een rijweg
  function naasteWeg(x, z) {
    let beste = null;
    for (const as of assen) {
      for (let i = 1; i < as.pts.length; i++) {
        const a = as.pts[i - 1], b = as.pts[i];
        const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz;
        if (L2 < 0.01) continue;
        const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2));
        const qx = a[0] + dx * t, qz = a[1] + dz * t, d = Math.hypot(qx - x, qz - z);
        if (!beste || d < beste.d) beste = { d, x: qx, z: qz, w: as.w || 5 };
      }
    }
    return beste;
  }
  const uit = [];
  for (const def of PIZZERIAS) {
    const pand = (KAART.panden || []).find(p => p.type === def.pand);
    if (!pand || !pand.voet || pand.voet.length < 3) continue;
    const V = pand.voet;
    let cx = 0, cz = 0;
    for (const [x, z] of V) { cx += x; cz += z; }
    cx /= V.length; cz /= V.length;
    let beste = null;
    for (let i = 0; i < V.length; i++) {
      const [ax, az] = V[i], [bx, bz] = V[(i + 1) % V.length];
      const L = Math.hypot(bx - ax, bz - az);
      if (L < 5) continue;
      const ex = (bx - ax) / L, ez = (bz - az) / L;
      let nx = ez, nz = -ex;
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      if ((mx - cx) * nx + (mz - cz) * nz < 0) { nx = -nx; nz = -nz; }
      const w = naasteWeg(mx, mz);
      if (!w) continue;
      const dx = w.x - mx, dz = w.z - mz, d = Math.hypot(dx, dz) || 1;
      const recht = (dx * nx + dz * nz) / d;          // 1: de weg ligt recht voor de gevel
      if (recht < 0.5) continue;
      const score = d / recht;
      if (!beste || score < beste.score) beste = { score, ax, az, ex, ez, nx, nz, L };
    }
    if (!beste) continue;
    const { ax, az, ex, ez, nx, nz, L } = beste;
    const s = L > 10 ? L / 2 - Math.min(L / 2 - 2.5, Math.max(3, L * 0.25)) : L / 2;
    const wx = ax + ex * s, wz = az + ez * s;
    const yaw = Math.atan2(nx, nz);                      // lokale +z is naar buiten
    uit.push({
      ...def, wand: { x: wx, z: wz }, n: { x: nx, z: nz }, e: { x: ex, z: ez }, yaw, goot: pand.goot || 3,
      staan: { x: wx + nx * 1.9, z: wz + nz * 1.9 },
      scooter: { x: wx + nx * 2.9 + ex * 2.2, z: wz + nz * 2.9 + ez * 2.2, yaw: Math.atan2(-ex, -ez) },
      pandId: pand.id,
    });
  }
  return uit;
}

/*
 De voordeur van een adres: zoals de bezorger van js/leven.js (`deurVan` daar) het punt van de
 omtrek van het pand dat het dichtst bij de weg ligt, een halve meter naar buiten. Het adrespunt
 zelf ligt midden in het pand.
*/
function deurVan(pand, adres, vanaf) {
  if (!pand || !pand.voet || pand.voet.length < 3) return { x: adres.x, z: adres.z };
  const V = pand.voet;
  let beste = null;
  for (let i = 0; i < V.length; i++) {
    const [ax, az] = V[i], [bx, bz] = V[(i + 1) % V.length];
    const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez || 1;
    const t = Math.max(0, Math.min(1, ((vanaf.x - ax) * ex + (vanaf.z - az) * ez) / l2));
    const x = ax + ex * t, z = az + ez * t, d = Math.hypot(vanaf.x - x, vanaf.z - z);
    if (!beste || d < beste.d) beste = { x, z, d };
  }
  const k = beste.d || 1;
  return { x: beste.x + (vanaf.x - beste.x) / k * 0.5, z: beste.z + (vanaf.z - beste.z) / k * 0.5 };
}

/*
 Een scooter als voertuig voor js/vehicles.js (`voegToe({ mesh })`). Hij draagt dezelfde
 `userData` als een auto uit js/carmodel.js: `wielen` (dan vervangt `maakBestuurbaar` hem niet
 door een hatchback), `bak` (overhellen), `R`, `length` en `oog`. De voorkant is −z, net als bij
 de auto's en de scooter van js/leven.js.
*/
function maakScooter(romp, zwart, chroom, doos) {
  const g = new THREE.Group(); g.name = 'pizzascooter-speler';
  const bak = new THREE.Group(); g.add(bak);
  const R = 0.22;
  const bandGeo = new THREE.TorusGeometry(R - 0.05, 0.06, 6, 16);
  const velgGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.08, 10);
  const wielen = [];
  for (const [z, stuur] of [[-0.62, true], [0.55, false]]) {
    const groep = new THREE.Group(); groep.position.set(0, R, z);
    const band = new THREE.Group(); groep.add(band);
    const t = new THREE.Mesh(bandGeo, zwart); t.rotation.y = Math.PI / 2; t.castShadow = true; band.add(t);
    const v = new THREE.Mesh(velgGeo, chroom); v.rotation.z = Math.PI / 2; band.add(v);
    (stuur ? bak : g).add(groep);
    wielen.push({ groep, band, stuur });
  }
  const deel = (geo, mat, x, y, z, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.x = rx; m.castShadow = true; bak.add(m); return m; };
  deel(new THREE.BoxGeometry(0.34, 0.1, 0.8), romp, 0, 0.32, 0.02);                // de treeplank
  deel(new THREE.BoxGeometry(0.42, 0.36, 0.62), romp, 0, 0.55, 0.42);              // de kap achter
  deel(new THREE.BoxGeometry(0.3, 0.09, 0.56), zwart, 0, 0.77, 0.38);              // het zadel
  deel(new THREE.BoxGeometry(0.38, 0.72, 0.12), romp, 0, 0.62, -0.5, -0.25);       // het voorscherm
  deel(new THREE.BoxGeometry(0.1, 0.5, 0.1), zwart, 0, 0.62, -0.6, -0.3);          // de voorvork
  deel(new THREE.CylinderGeometry(0.02, 0.02, 0.62, 6), chroom, 0, 1.02, -0.58).rotation.z = Math.PI / 2;   // het stuur
  deel(new THREE.BoxGeometry(0.14, 0.08, 0.04), chroom, 0, 0.92, -0.58);           // de koplamp
  // het rek achterop met de bezorgkoffer van de zaak
  deel(new THREE.BoxGeometry(0.36, 0.03, 0.4), chroom, 0, 0.8, 0.72);
  deel(new THREE.BoxGeometry(0.48, 0.42, 0.48), doos, 0, 1.03, 0.72);
  const zitPlek = new THREE.Group(); zitPlek.position.set(0, 0.36, 0.3); bak.add(zitPlek);
  g.userData = { length: 1.75, bak, wielen, R, oog: { x: 0, y: 1.55, z: 0.12 }, scooter: true, zitPlek };
  return g;
}

export function initPizzabaan({ scene, KAART, vehicles, player, hud, geluid = null, navigatie = null, verdien = null, derde = null }) {
  if (!KAART || !scene) return null;
  const zaken = zoekPizzerias(KAART);

  // ---------------------------------------------------------------- de materialen (bij het opstarten)
  const hout = new THREE.MeshStandardMaterial({ color: 0x6a4a30, roughness: 0.75 });
  const staal = new THREE.MeshStandardMaterial({ color: 0x9a9ea4, roughness: 0.35, metalness: 0.6 });
  const zwart = new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.7 });
  const chroom = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.25, metalness: 0.8 });
  const doosMat = {}, luifelMat = {}, bordMat = {}, frontMat = {}, menuMat = {}, rompMat = {};
  for (const z of PIZZERIAS) {
    doosMat[z.naam] = new THREE.MeshStandardMaterial({ map: doosDoek(z.merk), roughness: 0.8 });
    luifelMat[z.naam] = new THREE.MeshStandardMaterial({ map: luifelDoek(z), roughness: 0.9, side: THREE.DoubleSide });
    bordMat[z.naam] = new THREE.MeshStandardMaterial({ map: bordDoek(z), roughness: 0.6 });
    frontMat[z.naam] = new THREE.MeshStandardMaterial({ map: frontDoek(z), roughness: 0.7 });
    menuMat[z.naam] = new THREE.MeshStandardMaterial({ map: menuDoek(z), roughness: 0.6 });
    rompMat[z.naam] = new THREE.MeshStandardMaterial({ color: z.scooter, roughness: 0.35, metalness: 0.25 });
  }

  // ---------------------------------------------------------------- het afhaalluik
  const toonbankGeo = new THREE.BoxGeometry(1.8, 1.0, 0.55);
  const bladGeo = new THREE.BoxGeometry(1.95, 0.05, 0.7);
  const stapelGeo = new THREE.BoxGeometry(0.42, 0.05, 0.42);
  const frontGeo = new THREE.PlaneGeometry(1.7, 0.92);
  for (const z of zaken) {
    const g = new THREE.Group(); g.name = 'pizzeria ' + z.naam;
    g.position.set(z.wand.x, grondHoogte(z.wand.x, z.wand.z), z.wand.z);
    g.rotation.y = z.yaw;
    scene.add(g);
    const zet = (m, x, y, zz) => { m.position.set(x, y, zz); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    zet(new THREE.Mesh(toonbankGeo, hout), 0, 0.5, 1.05);
    zet(new THREE.Mesh(frontGeo, frontMat[z.naam]), 0, 0.5, 1.33).castShadow = false;
    zet(new THREE.Mesh(bladGeo, staal), 0, 1.025, 1.08);
    // de stapel dozen op de toonbank
    for (let i = 0; i < 4; i++) zet(new THREE.Mesh(stapelGeo, doosMat[z.naam]), 0.55, 1.08 + i * 0.055, 1.05).rotation.y = (i % 2) * 0.12;
    // de luifel, schuin naar buiten, en het bord aan de voorkant
    const luifelY = Math.max(2.1, Math.min(2.45, z.goot - 0.15));
    const luifel = zet(new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.5), luifelMat[z.naam]), 0, luifelY - 0.2, 0.7);
    luifel.rotation.x = -Math.PI / 2 + 0.28;
    zet(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.32, 0.04), bordMat[z.naam]), 0, luifelY - 0.55, 1.43).castShadow = false;
    // het menu naast het luik, plat op de gevel
    zet(new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.9), menuMat[z.naam]), -1.45, 1.45, 0.03).castShadow = false;
    // de bakker achter de toonbank
    const bakker = new Persoon({ shirt: 0xf2f2ee, broek: 0x2a2a2e, pet: true, petKleur: z.scooter, korteMouw: true });
    // (los in de scène: `Persoon.update` peilt de grond onder zijn eigen positie; een Persoon kijkt naar −z)
    const lx = z.n.z, lz = -z.n.x;                         // de lokale x-as van het luik
    bakker.zetNeer(z.wand.x + lx * 0.3 + z.n.x * 0.45, z.wand.z + lz * 0.3 + z.n.z * 0.45, Math.atan2(-z.n.x, -z.n.z));
    scene.add(bakker.groep);
    z.bakker = bakker;
    // de toonbank houdt je tegen (de wereld draait een doos zoals een mesh: hz langs de lokale z)
    const tx = z.wand.x + z.n.x * 1.05, tz = z.wand.z + z.n.z * 1.05;
    addCollider(tx, tz, 0.9, 0.3, z.yaw, 1.1);
    // de scooter van de zaak, al voor de deur (en daardoor al bij het opstarten in de scène)
    if (vehicles && vehicles.voegToe) {
      const mesh = maakScooter(rompMat[z.naam], zwart, chroom, doosMat[z.naam]);
      const car = vehicles.voegToe({ x: z.scooter.x, z: z.scooter.z, yaw: z.scooter.yaw, soort: 'scooter', kleur: z.scooter, mesh });
      // een scooter is geen auto: smaller, korter, minder hard
      Object.assign(car, { topSnelheid: PIZZABAAN.scooterTop, trek: 0.9, breedte: 0.8, botsRadius: 0.55, as: 0.55, instap: 1.3,
        pizza: z.naam, start: { x: z.scooter.x, z: z.scooter.z, yaw: z.scooter.yaw } });
      if (vehicles.zetNeer) vehicles.zetNeer(car, 0, car.yaw);
      z.auto = car;
    }
  }

  // de bezorger op de scooter: alleen te zien als jij erop zit en van buiten kijkt
  const rijder = new Persoon({ shirt: 0x2a2c30, broek: 0x24303f, pet: true, petKleur: 0xc8202a, hoogte: 0.97 });
  rijder.groep.visible = false;
  if (zaken[0] && zaken[0].auto) zaken[0].auto.mesh.userData.zitPlek.add(rijder.groep); else scene.add(rijder.groep);

  // ---------------------------------------------------------------- de stand
  const stand = { fase: 'vrij', bezorgd: 0, verdiend: 0, koud: 0, rit: null, laatste: null, terugNaar: null };
  let vrijNu = false;
  let nav = null;
  const route = () => {
    if (!nav) nav = navigatie && typeof navigatie.route === 'function' ? navigatie : new Navigatie(KAART.wegassen || []);
    return nav;
  };
  const panden = new Map();
  for (const p of KAART.panden || []) panden.set(p.id, p);
  const balk = typeof document !== 'undefined' ? document.getElementById('schaduwbalk') : null;
  let balkVanMij = false;

  const plek = () => player.inCar ? { x: player.inCar.x, z: player.inCar.z } : { x: player.pos.x, z: player.pos.z };
  const snelheid = () => player.inCar ? Math.abs(player.inCar.speed || 0) : 0;
  const betaal = (n) => {
    if (n <= 0) return 0;
    if (verdien) return verdien(n);
    if (typeof player.geld === 'number') { player.geld += n; return n; }
    return 0;
  };
  const tijdTekst = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  // ---- de route op de kaart (het eigen doel, zie boven) ----
  let mijnNav = null, navT = 0, navVanaf = null, navDoel = null;
  function zetNav(x, z, naam) {
    navDoel = { x, z, naam }; navT = 0; navVanaf = null;
    werkNavBij(true);
  }
  function werkNavBij(nu = false) {
    if (!navDoel) return;
    if (hud.eigen && hud.eigen !== mijnNav) return;      // de speler heeft zelf een doel gekozen
    const p = plek();
    if (!nu && hud.eigen === mijnNav && navVanaf && Math.hypot(p.x - navVanaf.x, p.z - navVanaf.z) < PIZZABAAN.navOpnieuw) return;
    navVanaf = { x: p.x, z: p.z };
    const r = route().route([p.x, p.z], [navDoel.x, navDoel.z]);
    mijnNav = { route: r, doel: [navDoel.x, navDoel.z], naam: navDoel.naam };
    hud.zetEigenNav(mijnNav);
  }
  function navUit() {
    if (mijnNav && hud.eigen === mijnNav) hud.zetEigenNav(null);
    mijnNav = null; navDoel = null;
  }

  // ---- de balk: de tijd die over is, en het tellertje ----
  function werkBalkBij() {
    if (!balk) return;
    const r = stand.rit;
    if (!r) { if (balkVanMij) { balk.hidden = true; balk.classList.remove('fout'); balkVanMij = false; } return; }
    balkVanMij = true;
    balk.hidden = false;
    balk.style.setProperty('--dicht', '0%');
    balk.style.setProperty('--ver', '85%');
    const deel = 1 - Math.max(0, r.rest) / r.tijd;
    balk.style.setProperty('--nu', `${Math.max(0, Math.min(100, deel * 100)).toFixed(1)}%`);
    balk.classList.toggle('fout', r.rest < r.tijd * 0.15);
    const t = balk.querySelector('.tekst');
    if (t) t.textContent = `Pizza naar ${r.naam} · nog ${tijdTekst(r.rest)} · bezorgd ${stand.bezorgd} · ${euro(stand.verdiend)}`;
  }

  // ---- een adres kiezen ----
  function kiesAdres(zaak) {
    const lijst = (KAART.huisnummers || []).filter(h => {
      if (h.pand === zaak.pandId) return false;
      const d = Math.hypot(h.x - zaak.wand.x, h.z - zaak.wand.z);
      return d > PIZZABAAN.adresVan && d < PIZZABAAN.adresTot;
    });
    const weg = { x: zaak.scooter.x, z: zaak.scooter.z };
    for (let poging = 0; poging < 14 && lijst.length; poging++) {
      const h = lijst[Math.floor(Math.random() * lijst.length)];
      const pand = panden.get(h.pand);
      const deur = deurVan(pand, h, naarDeWeg(h));
      if (Math.abs(grondHoogte(deur.x, deur.z) - grondHoogte(weg.x, weg.z)) > 1.5) continue;
      const r = route().route([weg.x, weg.z], [deur.x, deur.z]);
      if (!r || r.length < 2) continue;
      // het laatste stuk van de route is hemelsbreed van de weg naar de deur: niet te lang
      const [lx, lz] = r[r.length - 2];
      if (Math.hypot(lx - deur.x, lz - deur.z) > 45) continue;
      const lengte = routeLengte(r);
      if (lengte > PIZZABAAN.adresTot * 2.4) continue;
      const straat = nearestRoadName(deur.x, deur.z) || 'Tinga';
      return { adres: h, deur, naam: `${straat} ${h.t}`, lengte };
    }
    return null;
  }
  // het dichtstbijzijnde punt op een rijweg (voor de kant van het pand waar de deur zit)
  function naarDeWeg(h) {
    let beste = null;
    for (const as of KAART.wegassen || []) {
      if (!as.drive) continue;
      for (const q of as.pts) {
        const d = Math.abs(q[0] - h.x) + Math.abs(q[1] - h.z);
        if (d > 160) continue;
        const e = Math.hypot(q[0] - h.x, q[1] - h.z);
        if (!beste || e < beste.d) beste = { d: e, x: q[0], z: q[1] };
      }
    }
    return beste || { x: h.x, z: h.z + 1 };
  }

  // ---- aannemen, afleveren, voorbij ----
  function neemAan(zaak) {
    const a = kiesAdres(zaak);
    if (!a) { hud.show(`${zaak.naam}: even geen bestellingen.`, 2.5); return false; }
    const tijd = Math.round(a.lengte / PIZZABAAN.tempo + PIZZABAAN.marge);
    stand.rit = { zaak: zaak.naam, naam: a.naam, deur: a.deur, adres: a.adres, tijd, rest: tijd, lengte: a.lengte,
      auto: null, autoHp: 0, autoSchade: 0, bijDeur: false };
    stand.fase = 'rit'; stand.terugNaar = null;
    volgAuto();
    zetNav(a.deur.x, a.deur.z, a.naam);
    hud.melding('PIZZA BEZORGEN', `${zaak.naam} → ${a.naam} · ${tijdTekst(tijd)}`, 5);
    if (!player.inCar && zaak.auto && zaak.auto.driveable) hud.show('De scooter staat voor de deur (E). Je eigen auto mag ook.', 4);
    return true;
  }
  // in wat rijd je? De schade telt vanaf het moment dat je erin stapt
  function volgAuto() {
    const r = stand.rit, c = player.inCar;
    if (!r || !c || c === r.auto) return;
    r.auto = c; r.autoHp = c.hp ?? 100; r.autoSchade = (c.schade || []).length;
  }
  function aftrekVoor(r, max) {
    const c = r.auto;
    if (!c) return 0;
    if (c.wrak) return max;
    const hp = Math.max(0, r.autoHp - (c.hp ?? 100));
    const deuken = Math.max(0, (c.schade || []).length - r.autoSchade);
    return Math.min(max, Math.round(hp * 0.5 + deuken * 4));
  }
  function lever() {
    const r = stand.rit;
    const fooi = Math.round(PIZZABAAN.fooi * Math.max(0, Math.min(1, r.rest / r.tijd)));
    const aftrek = aftrekVoor(r, PIZZABAAN.basis + fooi);
    const loon = Math.max(0, PIZZABAAN.basis + fooi - aftrek);
    betaal(loon);
    stand.bezorgd++; stand.verdiend += loon;
    stand.laatste = { naam: r.naam, basis: PIZZABAAN.basis, fooi, aftrek, loon, rest: r.rest, tijd: r.tijd };
    if (geluid && geluid.aftelPiep) geluid.aftelPiep(true);
    const uitleg = `€ ${PIZZABAAN.basis} + fooi € ${fooi}` + (aftrek ? ` − schade € ${aftrek}` : '');
    hud.melding('PIZZA BEZORGD', `+ ${euro(loon)} (${uitleg}) · nog een rit? Terug naar de zaak`, 6);
    eindRit(r.zaak);
  }
  function eindRit(terug) {
    stand.rit = null;
    navUit();
    werkBalkBij();
    const z = terug ? zaken.find(q => q.naam === terug) : null;
    if (z && vrijNu) { stand.fase = 'terug'; stand.terugNaar = z.naam; zetNav(z.staan.x, z.staan.z, `${z.naam} — nog een rit?`); }
    else { stand.fase = 'vrij'; stand.terugNaar = null; }
  }
  function afbreken(reden = 'Je hebt de rit laten lopen.', kop = 'RIT AFGEBROKEN') {
    if (!stand.rit) {
      if (stand.fase === 'terug') { navUit(); stand.fase = 'vrij'; stand.terugNaar = null; return true; }
      return false;
    }
    hud.melding(kop, reden, 4);
    stand.rit = null;
    navUit(); werkBalkBij();
    stand.fase = 'vrij'; stand.terugNaar = null;
    return true;
  }

  // ---- E ----
  const zaakBij = () => {
    const p = plek(), rijdend = !!player.inCar;
    let beste = null;
    for (const z of zaken) {
      const d = Math.hypot(p.x - z.staan.x, p.z - z.staan.z);
      if (d <= (rijdend ? PIZZABAAN.toonbankRijdend : PIZZABAAN.toonbank) && (!beste || d < beste.d)) beste = { z, d };
    }
    return beste ? beste.z : null;
  };
  const bijDeDeur = () => {
    const r = stand.rit;
    if (!r) return false;
    const p = plek();
    const d = Math.hypot(p.x - r.deur.x, p.z - r.deur.z);
    return d <= (player.inCar ? PIZZABAAN.deurRijdend : PIZZABAAN.deur);
  };
  function toets() {
    if (player.binnen) return false;
    if (stand.rit) {
      // (bij de zaak niets: daar staat de scooter, en E moet je erop zetten)
      if (!bijDeDeur()) return false;
      if (snelheid() > PIZZABAAN.stil) { hud.show('Eerst stilstaan.', 1.5); return true; }
      lever();
      return true;
    }
    const z = zaakBij();
    if (!z) return false;
    if (player.inCar && snelheid() > PIZZABAAN.stil) return false;
    if (!vrijNu) { hud.show(`${z.naam}: niet nu.`, 2); return true; }
    return neemAan(z);
  }

  // ---------------------------------------------------------------- elk beeld
  let hintZaak = null, hintDeur = false;
  function update(dt, { vrij = true } = {}) {
    vrijNu = !!vrij;
    const p = plek();
    // de bakkers ademen alleen als je in de buurt bent
    for (const z of zaken) if (Math.hypot(p.x - z.wand.x, p.z - z.wand.z) < 60) z.bakker.update(dt, {});
    // de bezorger op de scooter waar jij op zit
    const scooter = player.inCar && player.inCar.mesh && player.inCar.mesh.userData.scooter ? player.inCar : null;
    if (scooter) {
      const zp = scooter.mesh.userData.zitPlek;
      if (rijder.groep.parent !== zp) zp.add(rijder.groep);
      const zien = !derde || !!derde.aan;
      if (rijder.groep.visible !== zien) rijder.groep.visible = zien;
      if (zien) rijder.update(dt, { zit: 0.4 });
    } else if (rijder.groep.visible) rijder.groep.visible = false;
    // een achtergelaten scooter gaat terug naar zijn zaak, als niemand kijkt
    for (const z of zaken) {
      const c = z.auto;
      if (!c || c === player.inCar || c.wrak || (stand.rit && stand.rit.auto === c)) continue;
      if (Math.hypot(c.x - z.scooter.x, c.z - z.scooter.z) < 3) continue;
      if (Math.hypot(p.x - c.x, p.z - c.z) < PIZZABAAN.terugNa || Math.hypot(p.x - z.scooter.x, p.z - z.scooter.z) < PIZZABAAN.terugNa) continue;
      c.x = z.scooter.x; c.z = z.scooter.z; c.yaw = z.scooter.yaw; c.speed = 0;
      if (vehicles.zetNeer) vehicles.zetNeer(c, 0, c.yaw);
    }

    const r = stand.rit;
    if (r) {
      if (!vrijNu) { afbreken('De rit is voorbij: er is iets anders.', 'RIT GESTOPT'); return; }
      volgAuto();
      r.rest -= dt;
      if (r.rest <= 0) {
        stand.koud++;
        stand.laatste = { naam: r.naam, basis: 0, fooi: 0, aftrek: 0, loon: 0, rest: 0, tijd: r.tijd, koud: true };
        hud.melding('PIZZA KOUD', `Te laat bij ${r.naam}. Geen geld · nog een rit? Terug naar de zaak`, 5);
        eindRit(r.zaak);
        return;
      }
      const bij = bijDeDeur();
      if (bij && !hintDeur) hud.show(`E — de pizza afgeven aan ${r.naam}`, 2.5);
      hintDeur = bij;
      navT += dt;
      if (navT > PIZZABAAN.navKlok) { navT = 0; werkNavBij(); }
      werkBalkBij();
      return;
    }
    hintDeur = false;
    if (stand.fase === 'terug') {
      const z = zaken.find(q => q.naam === stand.terugNaar);
      if (!vrijNu || !z) { navUit(); stand.fase = 'vrij'; stand.terugNaar = null; }
      else if (Math.hypot(p.x - z.staan.x, p.z - z.staan.z) < 25) { navUit(); stand.fase = 'vrij'; stand.terugNaar = null; }
      else { navT += dt; if (navT > PIZZABAAN.navKlok) { navT = 0; werkNavBij(); } }
    }
    const z = vrijNu && !player.binnen ? zaakBij() : null;
    if (z && z !== hintZaak) hud.show(`E — een bezorgrit voor ${z.naam}`, 2.5);
    hintZaak = z;
  }

  return {
    update, toets, afbreken: () => afbreken(),
    get bezig() { return !!stand.rit; },
    get stand() {
      const r = stand.rit;
      return {
        fase: stand.fase, bezorgd: stand.bezorgd, verdiend: stand.verdiend, koud: stand.koud, terugNaar: stand.terugNaar,
        laatste: stand.laatste ? { ...stand.laatste } : null,
        rit: r ? { zaak: r.zaak, naam: r.naam, x: r.deur.x, z: r.deur.z, tijd: r.tijd, rest: r.rest, lengte: r.lengte, auto: r.auto } : null,
      };
    },
    // voor de kaart (`hud.zetWinkels`): waar je staat om te bestellen, met het speldje 'pizza'
    plekken: zaken.map(z => ({ x: z.staan.x, z: z.staan.z, naam: z.naam, wat: 'pizza' })),
    // de scooters van de zaken (voor een proef: `stand.rit.auto === scooters[0]`)
    scooters: zaken.map(z => z.auto).filter(Boolean),
    zaken,
  };
}
