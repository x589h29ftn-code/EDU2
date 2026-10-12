/*
 Het interieur van elke soort auto, gemeten uit de ogen van de bestuurder (stap 146): npm run binnentest.
 Laadt alleen de modellen (js/carmodel.js, js/nomercy5.js) op een lege pagina, dus een paar minuten.

 Per soort (hatch, van, bx, gti, truck, ferrari, ambulance en de stafauto):
 1. er is een interieur, en het staat uit tot je erin zit;
 2. het stuur staat 0,38–0,70 m vóór je ogen en 20–40° onder de horizon (de ambulance had 0,16 m en 71°: onder je kin);
 3. de klokken liggen hoogstens 33° onder de horizon, dus binnen beeld als je recht vooruit kijkt (de camera ziet 36°
    naar beneden);
 4. recht vooruit en 6° omlaag kijk je vrij door de voorruit: geen stuk carrosserie boven de raamlijn binnen 1,6 m (de bus
    had zijn motorkap op 1,80 m, een balk dwars door de voorruit; de motorkap van de Ferrari onder de raamlijn mag);
 5. het stuur draait mee met het sturen en de snelheidsmeter met de vaart;
 6. de pook is een dunne stang met een bol (geen balkje), behalve in de Ferrari en de stafauto (die hun eigen hebben).
 Stap 147 (detail en opmaak, niet voor de stafauto):
 7. de doeken: elk MeshStandardMaterial met een kaart is enkelzijdig, niet doorzichtig en zonder hoekpuntkleuren (een soort die
    het spel al vertaalt), alles met een kaart heeft uv, en de grote panelen herhalen hun doek (de uv is in meters);
 8. de onderdelen: roosters, het radiootje, luidsprekers, vloermatten, de hendels; in de gewone auto's ook het
    handschoenenkastje, de bekerhouders, het binnenlampje en de handgreep; in hatch, bus, BX en GTI de bekleding van de
    A- en B-stijlen, tussen de stijl en het deurpaneel;
 9. de stoelen blijven onder de hemel, en het blijft één auto: hoogstens 30.000 driehoeken (stap 148: afgeronde vormen).
 Stap 148 (afgerond, logisch opgebouwd, de radio en de verlichting):
 11. de klokken zijn te zien: een straal van de ogen naar het midden van elke klok raakt eerst de klok (niet het huis);
 12. de radio laat de zender zien (Radio Tinga, Radio Spannenburg, 100% NL) en het nummer, en is leeg zonder zender;
 13. 's nachts wisselen de klokken naar het verlichte doek, gaan de knopjes aan, en zakt de eigen gloed van het interieur;
 14. het dashboard is één vorm, en de console komt er als één geheel uit (niet erdoorheen): de console begint achter het
     voorvlak van het dashboard.
 Stap 149 (het dashboard en er omheen):
 15. het dashboard loopt door tot de voorruit: stralen recht omlaag tussen de voet van het glas en het voorvlak raken eerst
     het interieur (tot stap 148 lag daar twintig centimeter motorkap in beeld);
 16. de hemel, de binnenspiegel en de zonnekleppen blijven binnen de ruiten (de hemel stak voor en achter door het glas).
 Stap 151 (van buiten):
 20. niets van het interieur steekt door de carrosserie: stralen uit negen richtingen op een raster van 4 cm raken het
     interieur nooit zonder eerst door glas te gaan (de achterbank stond achter de achterruit, de stijlbekleding half vóór
     de voorruit, de vloer onder de vrachtwagen uit, de deurpanelen van de Ferrari door zijn zijwand).
 Stap 150 (de klokken, de pook, de kijkhoek):
 17. de klokken niet ingezonken: de rand van de kap steekt hoogstens 1 cm voor de wijzerplaat uit en het huis niet;
 18. de pookknop hoogstens 2,4 cm straal;
 19. de kijkhoek (`autoKijk` in js/autobinnen.js): bij het instappen recht vooruit en iets omlaag met een wijdere beeldhoek,
     niet verder omlaag dan je schoot, stilstaand of net met de muis bewogen blijft hij staan, rijdend draait hij terug; en in
     het spel zet die beeldhoek de camera (78°) en gaat hij terug als je uitstapt (72°).
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fout = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fout++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.setDefaultTimeout(600000);
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/binnenbank`, { waitUntil: 'load', timeout: 120000 });
await page.setContent(`<!doctype html><html><head>
<script type="importmap">{ "imports": { "three": "/lib/three.module.js" } }</script></head><body>
<script type="module">
  import * as THREE from 'three';
  import { makeCar, autoMaat } from '/js/carmodel.js';
  import { maakStafauto } from '/js/nomercy5.js';
  window.__t = { THREE, makeCar, autoMaat, maakStafauto };
</script></body></html>`);
await page.waitForFunction(() => window.__t, null, { timeout: 120000 });

const uit = await page.evaluate(() => {
  const { THREE, makeCar, autoMaat, maakStafauto } = window.__t;
  const res = {};
  for (const soort of ['hatch', 'van', 'bx', 'gti', 'truck', 'ferrari', 'ambulance', 'staf']) {
    const g = soort === 'staf' ? maakStafauto() : makeCar(0x3b6ea8, soort, true);
    g.updateMatrixWorld(true);
    const u = g.userData, B = u.binnen, o = u.oog;
    if (!B) { res[soort] = null; continue; }
    const uitBijStart = B.groep.visible === false;
    B.groep.visible = true;
    const wp = (x) => x.getWorldPosition(new THREE.Vector3());
    // het stuur: de groep die draait (autobinnen: `stuur`, de stafauto: `draai`)
    const stuurObj = B.stuur || B.draai;
    const st = wp(stuurObj);
    const hoek = (p) => Math.atan2(o.y - p.y, Math.hypot(p.z - o.z, p.x - o.x)) * 180 / Math.PI;
    // de klokken: het laagste punt van de wijzerplaat(en)
    let klokObj = B.klok || null;
    if (!klokObj) B.groep.traverse(x => { if (!klokObj && x.name === 'klok') klokObj = x; });
    const kb = new THREE.Box3().setFromObject(klokObj);
    const klokLaag = new THREE.Vector3((kb.min.x + kb.max.x) / 2, kb.min.y, (kb.min.z + kb.max.z) / 2);
    // vrij zicht: stralen recht vooruit en 6° omlaag, carrosserie zonder glas en zonder interieur
    const glas = new Set(); if (u.glas) u.glas.traverse ? u.glas.traverse(x => glas.add(x)) : glas.add(u.glas);
    const inBinnen = (x) => { let q = x; while (q) { if (q === B.groep) return true; q = q.parent; } return false; };
    const ray = new THREE.Raycaster(); const vrij = {};
    for (const a of [0, 6]) {
      const d = new THREE.Vector3(0, -Math.sin(a * Math.PI / 180), -Math.cos(a * Math.PI / 180));
      ray.set(new THREE.Vector3(o.x, o.y, o.z), d); ray.far = 1.6;
      // carrosserie onder de raamlijn (de motorkap van een lage sportwagen) mag; erboven is een balk door de voorruit
      const raamlijn = soort === 'staf' ? 0.98 : autoMaat(soort).schouderY;
      const h = ray.intersectObject(g, true).find(x => !glas.has(x.object) && !inBinnen(x.object) && x.object.visible !== false && x.point.y > raamlijn + 0.10);
      vrij[a] = h ? +h.distance.toFixed(2) : null;
    }
    // sturen en snelheid
    const auto = { steer: 0, speed: 0, topSnelheid: 30 };
    B.update(auto, 1);
    const s0 = stuurObj.rotation.z;
    auto.steer = 0.3; auto.speed = 50 / 3.6;
    for (let i = 0; i < 40; i++) B.update(auto, 0.1);
    const s1 = stuurObj.rotation.z;
    const naald = (B.naalden && B.naalden[0]) || B.naald;
    // naald: opnieuw vanaf stilstand, dan op snelheid
    const auto2 = { steer: 0, speed: 0, topSnelheid: 30 };
    for (let i = 0; i < 40; i++) B.update(auto2, 0.1);
    const n0 = naald.rotation.z;
    auto2.speed = 50 / 3.6; for (let i = 0; i < 40; i++) B.update(auto2, 0.1);
    const n1 = naald.rotation.z;
    // de pook: een bol, en de stang dun
    let bol = 0, dunsteStang = Infinity;
    B.groep.traverse(x => {
      if (!x.isMesh) return;
      const p = x.geometry.parameters || {};
      if (x.geometry.type === 'SphereGeometry' && p.radius < 0.04 && p.radius > 0.015) bol++;
      if (x.geometry.type === 'CylinderGeometry' && p.height > 0.1 && p.height < 0.2 && Math.max(p.radiusTop, p.radiusBottom) < 0.015) dunsteStang = Math.min(dunsteStang, Math.max(p.radiusTop, p.radiusBottom));
    });
    // (stap 147) doeken, onderdelen, stoelen onder de hemel, driehoeken
    const regels = { fout: [], metKaart: 0, tegelMax: 0 };
    let driehoeken = 0, meshes = 0;
    const namen = {};
    B.groep.traverse(x => {
      if (x.name) namen[x.name] = (namen[x.name] || 0) + 1;
      if (!x.isMesh) return;
      meshes++;
      const geo = x.geometry; driehoeken += (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
      const m = x.material;
      if (!m.map) return;
      regels.metKaart++;
      if (!geo.attributes.uv) regels.fout.push(`${x.name || geo.type}: geen uv`);
      if (m.type === 'MeshStandardMaterial' && (m.side !== THREE.FrontSide || m.transparent || m.vertexColors)) regels.fout.push(`${x.name || geo.type}: ${m.side === THREE.DoubleSide ? 'tweezijdig' : ''}${m.transparent ? ' doorzichtig' : ''}${m.vertexColors ? ' hoekpuntkleuren' : ''}`);
      if (m.userData && m.userData.tegel > 0) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) regels.tegelMax = Math.max(regels.tegelMax, uv.getX(i), uv.getY(i)); }
    });
    let maat = null, stijlen = [], stoelTop = -Infinity;
    if (soort !== 'staf') {
      maat = autoMaat(soort);
      const binnenX = maat.W / 2 - 0.145, x0 = maat.W / 2 - (maat.bus ? 0.10 : 0.075);
      B.groep.traverse(x => {
        if (x.name === 'stijlbekleding') { const p = wp(x); stijlen.push(Math.abs(p.x) > binnenX - 0.05 && Math.abs(p.x) < x0); }
      });
      // de stoelen: alles van stoelstof (ruwheid 0,98) of rood leer (0,62): zitting, wangen, rug, hoofdsteun, achterbank
      B.groep.traverse(x => {
        if (!x.isMesh || !x.material.map || ![0.98, 0.62].includes(x.material.roughness)) return;
        stoelTop = Math.max(stoelTop, new THREE.Box3().setFromObject(x).max.y);
      });
    }
    const hemelY = maat ? maat.dakY - 0.045 : null;
    /*
     (stap 149) Het dashboard tot aan het glas: stralen recht naar beneden tussen de voet van de voorruit en het
     voorvlak van het dashboard raken (zonder het glas) eerst het interieur, niet de motorkap. En de hemel, de spiegel
     en de zonnekleppen blijven achter de voorruit: een straal van vóór de auto naar achteren raakt eerst de carrosserie.
    */
    let ruitMeting = null;
    if (soort !== 'staf') {
      const rc = new THREE.Raycaster();
      const eersteBuiten = (o, d) => { rc.set(o, d); rc.far = 12; return rc.intersectObject(g, true).find(x => !inBinnen(x.object) && x.object.visible !== false); };
      const F = maat.cabZ - maat.cabL / 2 + 0.46, R = maat.ruit;
      const y0 = Math.min(R.y + 0.30, hemelY - 0.05);
      const mis = [];
      let stralen = 0;
      for (const x of [-0.35, 0, 0.35]) for (let i = 0; i <= 5; i++) {
        const z = R.z + 0.05 + (F - 0.05 - R.z - 0.05) * i / 5;   // (de eerste 5 cm zie je alleen schuin, door het glas)
        // (vanuit de cabine, onder het glas: de ambulance is één dichte vorm met de ruit erop, die raak je van buiten altijd)
        const yStart = R.tan > 0 ? Math.min(y0, R.y + (z - R.z) / R.tan - 0.01) : y0;
        rc.set(new THREE.Vector3(x, yStart, z), new THREE.Vector3(0, -1, 0)); rc.far = 2;
        const h = rc.intersectObject(g, true).find(q => !glas.has(q.object) && !(q.object.material && q.object.material.transparent && !inBinnen(q.object)) && q.object.visible !== false);
        stralen++;
        if (!h || !inBinnen(h.object)) mis.push(`(${x}, ${z.toFixed(2)}): ${h ? (h.object.name || 'carrosserie') + ' op ' + h.point.y.toFixed(2) + ' ' + h.object.material.type + (h.object.material.transparent ? ' doorzichtig' : '') + ' ' + h.object.material.color?.getHexString() : 'niets'}`);
      }
      const achterGlas = [];
      B.groep.traverse(x => {
        if (!['hemel', 'binnenspiegel', 'zonneklep'].includes(x.name)) return;
        const bb = new THREE.Box3().setFromObject(x);
        const y = Math.min(bb.max.y - 0.002, (bb.min.y + bb.max.y) / 2 + 0.01), xm = (bb.min.x + bb.max.x) / 2;
        const v = eersteBuiten(new THREE.Vector3(xm, y, maat.cabZ - 6), new THREE.Vector3(0, 0, 1));
        const a = x.name === 'hemel' ? eersteBuiten(new THREE.Vector3(xm, y, maat.cabZ + 9), new THREE.Vector3(0, 0, -1)) : null;
        achterGlas.push({ naam: x.name, voor: v ? +(bb.min.z - v.point.z).toFixed(3) : null, achter: a ? +(a.point.z - bb.max.z).toFixed(3) : null });
      });
      /*
       (stap 151) Van buiten: niets van het interieur steekt door de carrosserie. Stralen uit negen richtingen (opzij, voor,
       achter, van boven en schuin van boven) op een raster van 4 cm door het kastje van het interieur; raakt een straal eerst
       het interieur, zonder eerst door glas te gaan, dan steekt daar iets uit.
      */
      const bbB = new THREE.Box3().setFromObject(B.groep), cB = bbB.getCenter(new THREE.Vector3());
      const isGlas = (h) => h.object.material && h.object.material.transparent && !inBinnen(h.object);
      const uitsteek = {}; let uitN = 0;
      for (const d of [[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[0,-1,0],[0.7,-0.7,0],[-0.7,-0.7,0],[0,-0.7,0.7],[0,-0.7,-0.7]]) {
        const D = new THREE.Vector3(...d).normalize();
        const u = Math.abs(D.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0).cross(D).normalize();
        const v = new THREE.Vector3().crossVectors(D, u).normalize();
        for (let a = -1.6; a <= 1.6; a += 0.04) for (let b = -1.6; b <= 1.6; b += 0.04) {
          const o = cB.clone().addScaledVector(u, a).addScaledVector(v, b).addScaledVector(D, -6);
          rc.set(o, D); rc.far = 12;
          if (!rc.ray.intersectsBox(bbB)) continue;
          const hs = rc.intersectObject(g, true).filter(h => h.object.visible !== false);
          const eerste = hs.find(h => !isGlas(h));
          if (!eerste || !inBinnen(eerste.object) || hs.some(h => isGlas(h) && h.distance < eerste.distance)) continue;
          uitN++;
          const k = eerste.object.name || eerste.object.geometry.type;
          uitsteek[k] = (uitsteek[k] || 0) + 1;
        }
      }
      ruitMeting = { stralen, mis, achterGlas, uitN, uitsteek };
    }
    // (stap 148) de klokken te zien, de radio, de nacht, de opbouw
    let extra = null;
    if (soort !== 'staf') {
      const stuurDeel = new Set(); B.stuur.traverse(x => stuurDeel.add(x));
      const platen = []; B.klok.traverse(x => { if (x.isMesh && x.geometry.type === 'CircleGeometry' && x.material.map) platen.push(x); });
      const klokDeel = new Set(); B.klok.traverse(x => klokDeel.add(x));
      // (de naald, het dopje en de rand horen bij de klok zelf: alleen het huis, de kap en de rest kunnen hem verstoppen)
      const meshes = []; B.groep.traverse(x => { if (x.isMesh && !stuurDeel.has(x) && (!klokDeel.has(x) || platen.includes(x))) meshes.push(x); });
      const rc = new THREE.Raycaster();
      const zichtbaar = platen.map(pl => {
        const doel = wp(pl), van = new THREE.Vector3(o.x, o.y, o.z);
        rc.set(van, doel.clone().sub(van).normalize()); rc.far = van.distanceTo(doel) + 0.01;
        const h = rc.intersectObjects(meshes, false)[0];
        return !!h && h.object === pl;
      });
      const radioTekst = (z, n) => { B.update({ steer: 0, speed: 0 }, 0.1, { nacht: false, zender: z, nummer: n }); return B.radioTekst; };
      const tinga = radioTekst({ naam: 'Radio Tinga', logo: 'tinga' }, { artiest: 'Kali', titel: 'Tinga' });
      const spannen = radioTekst({ naam: 'Radio Spannenburg', logo: 'spannenburg' }, null);
      const nl = radioTekst({ naam: '100% NL', logo: '100nl' }, { artiest: 'Lenny', titel: 'Ren Lenny Ren' });
      const uit = radioTekst(null, null);
      const kaartDag = platen[0] && platen[0].material.map;
      const knop = []; B.groep.traverse(x => { if (x.isMesh && x.material.isMeshBasicMaterial && !x.material.map && x.material !== platen[0]?.material && ![0xd21f1f, 0xf1ead2, 0xff5a2a, 0xf2c418].includes(x.material.color.getHex())) knop.push(x.material); });
      const knopDag = knop[0] ? knop[0].color.getHex() : null;
      const dash = []; B.groep.traverse(x => { if (x.name === 'dashboard') dash.push(x); });
      const gloedDag = dash[0] ? dash[0].material.emissiveIntensity : null;
      B.update({ steer: 0, speed: 0 }, 0.1, { nacht: true, zender: { naam: 'Radio Tinga', logo: 'tinga' } });
      const kaartNacht = platen[0] && platen[0].material.map, knopNacht = knop[0] ? knop[0].color.getHex() : null;
      const gloedNacht = dash[0] ? dash[0].material.emissiveIntensity : null;
      B.update({ steer: 0, speed: 0 }, 0.1, { nacht: false, zender: { naam: 'Radio Tinga', logo: 'tinga' } });
      // de opbouw: het voorvlak van het dashboard en het begin van de console
      let dashAchter = -Infinity, consoleVoor = Infinity;
      if (dash[0]) dashAchter = new THREE.Box3().setFromObject(dash[0]).max.z;
      B.groep.traverse(x => { if (x.isMesh && x.geometry.type === 'ExtrudeGeometry' && x.material.userData && x.material.userData.tegel === 0.18 && !x.name) {
        const bb = new THREE.Box3().setFromObject(x);
        if (bb.max.y < (maat.schouderY - 0.05) && Math.abs((bb.min.x + bb.max.x) / 2) < 0.02 && (bb.max.x - bb.min.x) < 0.3 && (bb.max.z - bb.min.z) > 0.25) consoleVoor = Math.min(consoleVoor, bb.min.z);
      } });
      extra = { platen: platen.length, zichtbaar, tinga, spannen, nl, uit, nachtWissel: kaartDag !== kaartNacht && !!kaartNacht, knopDag, knopNacht,
        gloedDag, gloedNacht, dashStukken: dash.length, dashAchter: +dashAchter.toFixed(3), consoleVoor: +consoleVoor.toFixed(3) };
      // (stap 150) niet ingezonken: hoe ver de rand van de kap en het huis vóór de wijzerplaat uitsteken; en de pookknop
      let kapBB = null, huisBB = null, knopR = null;
      B.groep.traverse(x => {
        if (x.name === 'klokkap') kapBB = new THREE.Box3().setFromObject(x);
        if (x.name === 'klokhuis') huisBB = new THREE.Box3().setFromObject(x);
        if (x.name === 'pookknop') knopR = x.geometry.parameters.radius;
      });
      const plaatZ = platen[0] ? wp(platen[0]).z : NaN;
      extra.kapVoor = kapBB ? +(kapBB.max.z - plaatZ).toFixed(3) : null;
      extra.huisVoor = huisBB ? +(huisBB.max.z - plaatZ).toFixed(3) : null;
      extra.knopR = knopR;
    }
    res[soort] = {
      extra, ruitMeting, regels, driehoeken: Math.round(driehoeken), meshes, namen, stijlen, stoelTop: +stoelTop.toFixed(3), hemelY,
      uitBijStart, oog: o,
      stuur: { dz: +(o.z - st.z).toFixed(2), hoek: +hoek(st).toFixed(1) },
      klokHoek: +hoek(klokLaag).toFixed(1), vrij, stuurDraait: Math.abs(s1 - s0) > 0.5, naaldLoopt: Math.abs(n1 - n0) > 0.2,
      pook: { bol, stang: isFinite(dunsteStang) ? dunsteStang : null },
    };
  }
  return res;
});

for (const [soort, r] of Object.entries(uit)) {
  kop(soort);
  ok(!!r && r.uitBijStart, 'een interieur, en het staat uit tot je erin zit');
  if (!r) continue;
  ok(r.stuur.dz >= 0.38 && r.stuur.dz <= 0.70 && r.stuur.hoek >= 20 && r.stuur.hoek <= 40, 'het stuur vóór je, onder je ogen', `${r.stuur.dz} m, ${r.stuur.hoek}° omlaag`);
  ok(r.klokHoek <= 33, 'de klokken in beeld als je recht vooruit kijkt', `${r.klokHoek}° omlaag`);
  ok(r.vrij[0] === null && r.vrij[6] === null, 'vrij zicht door de voorruit, recht vooruit en 6° omlaag (boven de raamlijn)', `${r.vrij[0] ?? 'vrij'} / ${r.vrij[6] ?? 'vrij'}`);
  ok(r.stuurDraait && r.naaldLoopt, 'het stuur draait mee en de naald loopt mee');
  if (soort !== 'ferrari' && soort !== 'staf') ok(r.pook.bol >= 1 && r.pook.stang !== null, 'de pook: een dunne stang met een bol', r.pook.stang ? `stang ${r.pook.stang} m` : 'geen');
  if (soort === 'staf') continue;
  ok(r.regels.fout.length === 0 && r.regels.metKaart >= 20, 'de doeken: enkelzijdig, niet doorzichtig, met uv', r.regels.fout.length ? r.regels.fout.slice(0, 4).join('; ') : `${r.regels.metKaart} onderdelen met een doek`);
  ok(r.regels.tegelMax > 2, 'de grote panelen herhalen hun doek (uv in meters)', `uv tot ${r.regels.tegelMax.toFixed(1)}`);
  const n = r.namen, gewoon = soort !== 'ferrari';
  const mist = [];
  if ((n.rooster || 0) < 4) mist.push('roosters'); if (!n.radio) mist.push('radio'); if ((n.luidspreker || 0) < 2) mist.push('luidsprekers');
  if ((n.vloermat || 0) < 2) mist.push('vloermatten'); if ((n.hendel || 0) < 2) mist.push('hendels');
  if (gewoon) { if (!n.handschoenenkastje) mist.push('handschoenenkastje'); if ((n.bekerhouder || 0) < 2) mist.push('bekerhouders'); if (!n.binnenlampje) mist.push('binnenlampje'); if (!n.handgreep) mist.push('handgreep'); }
  ok(mist.length === 0, 'de onderdelen: roosters, radio, luidsprekers, matten, hendels' + (gewoon ? ', handschoenenkastje, bekerhouders, lampje, handgreep' : ''), mist.length ? `mist: ${mist.join(', ')}` : '');
  if (['hatch', 'van', 'bx', 'gti'].includes(soort)) ok(r.stijlen.length === 4 && r.stijlen.every(Boolean), 'de A- en B-stijl bekleed, tussen de stijl en het deurpaneel', `${r.stijlen.length} bekledingen`);
  ok(r.stoelTop <= r.hemelY + 1e-3, 'de stoelen blijven onder de hemel', `stoel tot ${r.stoelTop}, hemel ${r.hemelY.toFixed(3)}`);
  const e = r.extra;
  ok(e.platen === 2 && e.zichtbaar.every(Boolean), 'de twee klokken zijn te zien (een straal raakt eerst de klok)', e.zichtbaar.map(v => v ? 'ja' : 'nee').join(', '));
  ok(/RADIO TINGA|Radio Tinga/.test(e.tinga) && /Kali/.test(e.tinga) && /Spannenburg/.test(e.spannen) && /100% NL/.test(e.nl) && /Lenny/.test(e.nl) && e.uit.startsWith('-|'),
    'de radio volgt de zender en het nummer, en is leeg zonder zender', `${e.tinga.split('|')[0]} · ${e.spannen.split('|')[0]} · ${e.nl.split('|')[0]} · uit`);
  ok(e.nachtWissel && e.knopDag !== e.knopNacht && e.gloedNacht < e.gloedDag, "'s nachts het verlichte doek op de klokken, de knopjes aan, de gloed van het interieur omlaag",
    `knop ${e.knopDag?.toString(16)} → ${e.knopNacht?.toString(16)}, gloed ${e.gloedDag} → ${e.gloedNacht?.toFixed(3)}`);
  ok(e.dashStukken === 1 && e.consoleVoor >= e.dashAchter - 0.02, 'het dashboard is één vorm, en de console komt eruit in plaats van erdoorheen',
    `voorvlak tot z ${e.dashAchter}, console vanaf ${e.consoleVoor}`);
  ok(e.kapVoor !== null && e.kapVoor <= 0.01 && e.huisVoor !== null && e.huisVoor <= 0.002, 'de klokken niet ingezonken: de kap steekt hoogstens 1 cm voor de wijzerplaat uit, het huis niet',
    `kap ${e.kapVoor} m, huis ${e.huisVoor} m voor de plaat`);
  if (soort !== 'ferrari') ok(e.knopR !== null && e.knopR <= 0.024, 'de pookknop op maat (hoogstens 2,4 cm straal)', `${e.knopR} m`);
  const rm = r.ruitMeting;
  ok(rm.mis.length === 0, 'het dashboard loopt door tot de voorruit: tussen glas en dashboard geen motorkap in beeld', rm.mis.length ? `${rm.mis.length} van ${rm.stralen}: ${rm.mis.slice(0, 3).join('; ')}` : `${rm.stralen} stralen`);
  const fouteRuit = rm.achterGlas.filter(a => a.voor === null || a.voor < 0 || (a.achter !== null && a.achter < 0));
  ok(rm.achterGlas.length >= (soort === 'ferrari' ? 2 : 4) && fouteRuit.length === 0, 'de hemel, de spiegel en de zonnekleppen blijven binnen de ruiten',
    fouteRuit.length ? fouteRuit.map(a => `${a.naam} ${a.voor} / ${a.achter}`).join('; ') : rm.achterGlas.map(a => `${a.naam} ${a.voor}${a.achter !== null ? '/' + a.achter : ''}`).join(', '));
  ok(rm.uitN === 0, 'van buiten: niets van het interieur steekt door de carrosserie', rm.uitN ? Object.entries(rm.uitsteek).map(([k, n]) => `${k} ${n}×`).join(', ') : 'negen richtingen, raster van 4 cm');
  ok(r.driehoeken <= 30000, 'één auto: hoogstens 30.000 driehoeken', `${r.driehoeken} driehoeken in ${r.meshes} onderdelen`);
}

// ---------------------------------------------------------------- (stap 150) de kijkhoek van de bestuurder
kop('de kijkhoek van de bestuurder');
const kijk = await page.evaluate(async () => {
  const { autoKijk, AUTO_KIJK } = await import('/js/autobinnen.js');
  const car = { yaw: 0.8, speed: 0 };
  // te voet keek je naar de grond, een kwart slag opzij
  const sp = { yaw: 2.4, pitch: -1.3, kijkT: 0 };
  const beeld = autoKijk(sp, car, 0.016, true);
  const inst = { yaw: sp.yaw, pitch: sp.pitch, beeld };
  // met de muis opzij en omlaag gekeken, verder dan mag
  sp.yaw = car.yaw + 1.2; sp.pitch = -1.4; sp.kijkT = 1.6;
  autoKijk(sp, car, 0.016, false);
  const geklemd = sp.pitch;
  // stilstaand: de blik blijft waar hij is, ook als de muis al even stil ligt
  for (let i = 0; i < 200; i++) autoKijk(sp, car, 0.016, false);
  const stil = sp.yaw - car.yaw;
  // rijdend, de muis net bewogen: eerst niets, dan terug naar vooruit
  car.speed = 12; sp.kijkT = 1.6;
  for (let i = 0; i < 60; i++) autoKijk(sp, car, 0.016, false);
  const netBewogen = sp.yaw - car.yaw;
  for (let i = 0; i < 250; i++) autoKijk(sp, car, 0.016, false);
  return { AUTO_KIJK, inst, geklemd, stil, netBewogen, terug: { dyaw: sp.yaw - car.yaw, pitch: sp.pitch } };
});
const AK = kijk.AUTO_KIJK;
ok(Math.abs(kijk.inst.yaw - 0.8) < 1e-9 && Math.abs(kijk.inst.pitch - AK.pitch) < 1e-9 && kijk.inst.beeld > 72,
  'bij het instappen recht vooruit en iets omlaag, met een wijdere beeldhoek', `pitch ${kijk.inst.pitch.toFixed(2)}, beeld ${kijk.inst.beeld}°`);
ok(Math.abs(kijk.geklemd - AK.pitchMin) < 1e-9, 'omlaag kijken houdt op bij je schoot', `${kijk.geklemd.toFixed(2)} rad`);
ok(Math.abs(kijk.stil - 1.2) < 1e-6 && Math.abs(kijk.netBewogen - 1.2) < 1e-6, 'stilstaand, of net met de muis bewogen, blijft de blik waar hij is', `${kijk.stil.toFixed(2)} / ${kijk.netBewogen.toFixed(2)} rad opzij`);
ok(Math.abs(kijk.terug.dyaw) < 0.05 && Math.abs(kijk.terug.pitch - AK.pitch) < 0.05, 'rijdend draait de blik daarna terug naar vooruit', `${kijk.terug.dyaw.toFixed(3)} rad opzij, pitch ${kijk.terug.pitch.toFixed(2)}`);

// ---------------------------------------------------------------- 10. in het spel: geen nieuwe shader
// (ALLEEN_MODELLEN=1 slaat dit deel over: voor snel nameten tijdens het bouwen)
if (!process.env.ALLEEN_MODELLEN) {
kop('in het spel: het interieur vertaalt geen nieuwe shader');
const spel = await browser.newPage({ viewport: { width: 640, height: 400 } });
spel.setDefaultTimeout(900000);
spel.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await spel.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await spel.waitForFunction(() => window.__game, null, { timeout: 900000 });
const prog = await spel.evaluate(async () => {
  const g = window.__game, R = g.renderer;
  if (!R || !R.info.programs) return null;
  // eerst wat het spel achter het laadscherm doet: het reliëf, de LOD en het vooraf vertalen van alle soorten
  await g.voorbereidSpel();
  document.getElementById('overlay').style.display = 'none';
  g.player.active = false; window.__autoplay = false;
  const p = g.player.pos;
  const uit = {};
  // (stap 150) de beeldhoek in de auto door je eigen ogen, en terug als je uitstapt
  { const C = g.camera, pl = g.player; pl.autoBeeld = 78; pl.zetBeeldhoek(); const inAuto = C.fov; pl.autoBeeld = 0; pl.zetBeeldhoek();
    uit.__beeld = { inAuto, buiten: C.fov }; }
  for (const soort of ['hatch', 'ferrari', 'van']) {
    const car = g.vehicles.voegToe({ x: p.x + 3, z: p.z, yaw: 0, soort, driveable: true });
    const u = car.mesh.userData, o = u.oog;
    const C = g.camera;
    const kijk = () => {
      car.mesh.updateMatrixWorld(true);
      const v = car.mesh.localToWorld({ x: o.x, y: o.y, z: o.z, isVector3: true, applyMatrix4(m) { const e = m.elements, x = this.x, y = this.y, z = this.z, w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]); this.x = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w; this.y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w; this.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w; return this; } });
      C.position.set(v.x, v.y, v.z); C.rotation.set(-0.25, car.yaw, 0, 'YXZ'); C.updateMatrixWorld(true);
      g.scene.updateMatrixWorld(true); R.render(g.scene, C);
    };
    u.binnen.groep.visible = false; kijk(); kijk();
    const voor = R.info.programs.length;
    const oud = new Set(R.info.programs.map(q => q.cacheKey));
    u.binnen.groep.visible = true; u.binnen.update(car, 0.1); kijk(); kijk();
    // wie de nieuwe programma's gebruikt (voor het zoeken)
    const nieuw = new Set(R.info.programs.filter(q => !oud.has(q.cacheKey)));
    const wie = new Set();
    u.binnen.groep.traverse(x => { if (!x.isMesh) return; const pm = R.properties.get(x.material); if (pm && pm.currentProgram && nieuw.has(pm.currentProgram)) wie.add(`${x.material.type}${x.material.map ? '+kaart' : ''}${x.material.side === 2 ? ' tweezijdig' : ''}${x.material.emissive && x.material.emissive.getHex() ? ' gloed' : ''}`); });
    uit[soort] = { voor, na: R.info.programs.length, wie: [...wie] };
    u.binnen.groep.visible = false;
    if (g.vehicles.verwijder) g.vehicles.verwijder(car);
  }
  return uit;
});
if (prog && prog.__beeld) { ok(Math.abs(prog.__beeld.inAuto - 78) < 0.5 && Math.abs(prog.__beeld.buiten - 72) < 0.5, 'in het spel: de wijdere beeldhoek in de auto, en terug als je uitstapt', `${prog.__beeld.inAuto.toFixed(1)}° → ${prog.__beeld.buiten.toFixed(1)}°`); delete prog.__beeld; }
if (prog) for (const [soort, v] of Object.entries(prog)) ok(v.na === v.voor, `${soort}: het interieur in beeld, geen nieuw programma`, `${v.voor} → ${v.na}${v.wie.length ? ' · ' + v.wie.join(', ') : ''}`);
else ok(false, 'geen renderer in de pagina');
}

await browser.close();
console.log(fout ? `\n${fout} fout${fout > 1 ? 'en' : ''}` : '\nalles goed');
process.exit(fout ? 1 : 0);
