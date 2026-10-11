/*
 De postbode (stap 141). Gekozen op 12 okt 2026: "Brievenbusbezorger die 's ochtends met een fietstas
 langs de huizen loopt."

 Een bezorger van "Post Tinga" — een verzonnen bedrijf, geen echt merk: oranje shirt, donkerblauwe
 broek en pet, en een posttas over de schouder (het doek is op canvas getekend: oranje met een blauwe
 band, een envelop en de naam). Van POST.van tot POST.tot uur loopt er één tegelijk een straat bij jou
 in de buurt af, aan één kant van de weg, van deur naar deur:

   - de deuren: adressen uit `KAART.huisnummers`, de deur aan de gevel zoals de pizzabezorger hem
     vindt (`deurVan` uit js/pizzabaan.js: het punt van de omtrek van het pand het dichtst bij de
     weg, een halve meter naar buiten; staat daar iets, dan wat verder naar de weg toe);
   - de weg ertussen: een looproute om heggen, schuttingen en gevels heen (`zoekLooppad`), en elk
     stapje nog eens door `resolveCollisions`;
   - bij de deur: hij draait naar de gevel, buigt iets voorover en steekt de arm met een envelop naar
     de brievenbus; de klep klikt (`geluid.brievenbus`), de envelop is weg.

 Hij komt alleen tevoorschijn waar de camera niet kijkt, en is ook alleen uit beeld weer weg: na de
 laatste deur, als je ver weg bent of als de ochtend om is. Daarna een tijdje niets (POST.rust) en dan
 een volgende straat. Een schot in de buurt: hij rent weg en komt pas de volgende ochtend terug.
 Geraakt of aangereden valt hij om, en ook dan is het voor die dag gedaan.
*/
import * as THREE from 'three';
import { Persoon } from './persoon.js';
import { grondHoogte, resolveCollisions } from './world.js';
import { zoekLooppad } from './looppad.js';
import { deurVan } from './pizzabaan.js';
import { geluid } from './audio.js';
import { HOUSE_STYLES } from './textures.js';

export const POST = {
  van: 8, tot: 11.5,          // speltijd
  min: 30, straal: 150,       // waar de eerste deur mag liggen, gemeten van de speler
  weg: 220,                   // verder weg dan dit: hij gaat (uit beeld)
  lopen: 1.45,                // m/s
  ren: 5,                     // weg na een schot
  deurT: 2.6,                 // zo lang bij een deur
  klepOp: 1.15,               // daarin: hier valt de klep
  deuren: [4, 9],             // per straat
  langs: 70,                  // zover langs de weg van de eerste deur
  rust: [25, 60],             // tussen twee straten
  schrik: 50,                 // een schot binnen zoveel meter
};

// in een bepaald tijdvak
const binnen = (uur, van, tot) => uur >= van && uur < tot;

// ---- het doek van de tas: oranje, een blauwe band, een envelop en "Post Tinga" ----
function tasDoek() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 192;
  const g = c.getContext('2d');
  g.fillStyle = '#ee7d1e'; g.fillRect(0, 0, 256, 192);
  // de klep van de tas iets donkerder, met een naad
  g.fillStyle = '#d96c14'; g.fillRect(0, 0, 256, 54);
  g.strokeStyle = '#a8500c'; g.lineWidth = 3; g.setLineDash([7, 5]);
  g.beginPath(); g.moveTo(8, 50); g.lineTo(248, 50); g.stroke(); g.setLineDash([]);
  // de blauwe band
  g.fillStyle = '#1d3a7a'; g.fillRect(0, 128, 256, 26);
  // een envelop in een wit rondje
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(52, 92, 30, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#1d3a7a'; g.fillRect(34, 80, 36, 24);
  g.strokeStyle = '#ffffff'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(35, 81); g.lineTo(52, 95); g.lineTo(69, 81); g.stroke();
  // de naam
  g.fillStyle = '#ffffff'; g.textBaseline = 'middle'; g.textAlign = 'left';
  g.font = 'bold 34px Arial, sans-serif'; g.fillText('Post', 92, 78);
  g.font = 'bold 30px Arial, sans-serif'; g.fillText('Tinga', 92, 108);
  g.fillStyle = '#ffffff'; g.font = 'bold 16px Arial, sans-serif'; g.textAlign = 'center';
  g.fillText('BRIEVEN · PAKJES', 128, 141);
  // wat sleet: lichte vlekjes
  for (let i = 0; i < 140; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '90,40,0'},${Math.random() * 0.06})`;
    g.fillRect(Math.random() * 256, Math.random() * 192, 2 + Math.random() * 4, 2 + Math.random() * 4);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function initPostbode({ scene, KAART }) {
  if (!KAART || !KAART.huisnummers) return null;

  // ---- het poppetje, de tas en de envelop: alles bij het opstarten (dan gaan ze mee met het voorvertalen) ----
  const p = new Persoon({ shirt: 0xee7d1e, broek: 0x1c2a4a, huid: 0xd2a77f, pet: true, petKleur: 0x1d3a7a, hoogte: 0.98 });
  p.groep.name = 'postbode'; p.groep.visible = false;
  scene.add(p.groep);
  {
    const oranje = new THREE.MeshStandardMaterial({ color: 0xd96c14, roughness: 0.75 });
    const voor = new THREE.MeshStandardMaterial({ map: tasDoek(), roughness: 0.75 });
    const band = new THREE.MeshStandardMaterial({ color: 0x1d3a7a, roughness: 0.8 });
    // de tas hangt voor de linkerheup, het doek naar voren (−z is voor)
    const tas = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.27, 0.11), [oranje, oranje, oranje, oranje, oranje, voor]);
    tas.position.set(-0.08, 0.94, -0.17); tas.rotation.y = 0.15; tas.castShadow = true; tas.name = 'posttas';
    p.groep.add(tas);
    // de schouderband: van de rechterschouder schuin naar de tas, voor en achter langs
    for (const [z, eind] of [[-0.118, [-0.2, 1.06, -0.16]], [0.112, [-0.24, 0.98, 0.09]]]) {
      const a = [0.16, 1.43, z * 0.85], b = eind;
      const l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.045, l, 0.012), band);
      m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
      // de lange as (y) langs a→b
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize());
      m.castShadow = true;
      p.groep.add(m);
    }
  }
  // de envelop in de rechterhand (aan het eind van de onderarm)
  const envelop = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.16, 0.11), new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: 0.9 }));
  envelop.position.set(0, -0.08, -0.03); envelop.visible = false; envelop.name = 'envelop';
  p.armRechts.eind.add(envelop);

  const panden = new Map();
  for (const q of KAART.panden || []) panden.set(q.id, q);

  const st = {
    fase: 'weg', deuren: [], nr: 0, pad: null, padI: 0, deurT: 0, rust: 8, vandaag: false,
    rondes: 0, kleppen: 0, bezocht: 0, vlucht: null, omT: 0, vastT: 0, reden: null, x: 0, z: 0,
  };

  // ---- de straat ----
  // het dichtstbijzijnde punt op de as van een rijweg, met de richting van dat stuk weg
  function wegBij(x, z, tot = 40) {
    let beste = null;
    for (const as of KAART.wegassen || []) {
      if (!as.drive) continue;
      const P = as.pts;
      for (let i = 0; i < P.length - 1; i++) {
        const ax = P[i][0], az = P[i][1], bx = P[i + 1][0], bz = P[i + 1][1];
        if (Math.min(ax, bx) - tot > x || Math.max(ax, bx) + tot < x || Math.min(az, bz) - tot > z || Math.max(az, bz) + tot < z) continue;
        const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez;
        if (l2 < 1e-6) continue;
        const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2));
        const px = ax + ex * t, pz = az + ez * t, d = Math.hypot(x - px, z - pz);
        if (d > tot || (beste && d >= beste.d)) continue;
        const l = Math.sqrt(l2);
        beste = { d, x: px, z: pz, rx: ex / l, rz: ez / l, as };
      }
    }
    return beste;
  }
  /*
   De voordeur zoals hij op de gevel getekend staat. `deurVan` geeft het punt van de omtrek dat het dichtst
   bij de weg ligt, en dat is bij een rijtjeshuis meestal het midden van de gevel: de woonkamerpui. Op de
   eerste foto deed hij de post door het raam. De deur zit in het doek van T.facade (js/textures.js) per
   woning op 0,5 m van de rand, 0,95 m breed, om en om gespiegeld (`mirror`), en het doek loopt over het
   muurvlak uit het 3D BAG-model zoals `muurKeuze` in js/kaartwereld.js het legt (u van de linkerrand,
   `huizen`, `toon`). Dat rekenen we hier na, voor het muurvlak aan de voorkant (`front`) op de grond.
   Geen getekende deur (een flat, een bedrijf, geen 3D-model): null, en dan `deurVan`.
  */
  function voordeurVan(pand, vanaf) {
    const st = pand && HOUSE_STYLES[pand.type];
    if (!st || !pand.v || !pand.f || !pand.s || !pand.voet || !pand.front) return null;   // (zonder `front` geen gevel met deur)
    if (st.industrieel || st.galerij || st.strookramen || pand.type === 'appart' || pand.type === 'spil' || !(st.storeys >= 1) || !st.w) return null;
    const V = pand.v, binnenVoet = (x, z) => { let c = false; const P = pand.voet;
      for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
    let beste = null;
    for (let k = 0; k < pand.f.length; k++) {
      if (pand.s[k] !== 1) continue;
      const ring = pand.f[k][0];
      if (!ring || ring.length < 3) continue;
      // de normaal (Newell) en de maten van het vlak
      let nx = 0, ny = 0, nz = 0, mx = 0, mz = 0, laag = Infinity;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i] * 3, b = ring[(i + 1) % ring.length] * 3;
        nx += (V[a + 1] - V[b + 1]) * (V[a + 2] + V[b + 2]); ny += (V[a + 2] - V[b + 2]) * (V[a] + V[b]); nz += (V[a] - V[b]) * (V[a + 1] + V[b + 1]);
        mx += V[a]; mz += V[a + 2]; laag = Math.min(laag, V[a + 1]);
      }
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      mx /= ring.length; mz /= ring.length;
      if (Math.abs(ny) > 0.3 || laag > 0.5) continue;
      // naar buiten (zoals `inVoet` in js/kaartwereld.js): 40 cm ervoor buiten het pand
      if (binnenVoet(mx + nx * 0.4, mz + nz * 0.4) && !binnenVoet(mx - nx * 0.4, mz - nz * 0.4)) { nx = -nx; nz = -nz; }
      const kant = nx * pand.front[0] + nz * pand.front[1];
      if (kant < 0.6) continue;
      const rx = nz, rz = -nx;
      let u0 = Infinity, u1 = -Infinity;
      for (const i of ring) { const u = V[i * 3] * rx + V[i * 3 + 2] * rz; u0 = Math.min(u0, u); u1 = Math.max(u1, u); }
      const breed = u1 - u0;
      if (breed < (st.gevelMin || 2.4)) continue;
      const huizen = Math.max(1, Math.round(breed / st.w));
      const toon = huizen === 1 ? Math.min(1, breed / (0.7 * st.w)) : 1;
      const uMid = mx * rx + mz * rz;
      for (let i = 0; i < huizen; i++) {
        const mirror = st.deurRechts ? true : ((i % 2 === 1) && !st.detached);
        const a = (0.5 + 0.475) / st.w;
        const uTex = (i + (mirror ? 1 - a : a)) / huizen;
        const fr = 0.5 + (uTex - 0.5) / toon;
        if (fr < 0.03 || fr > 0.97) continue;
        const u = u0 + fr * breed;
        const wx = mx + rx * (u - uMid), wz = mz + rz * (u - uMid);
        const d = Math.hypot(wx - vanaf.x, wz - vanaf.z);
        if (!beste || d < beste.d) beste = { d, wx, wz, nx, nz };
      }
    }
    if (!beste) return null;
    return { x: beste.wx + beste.nx * 0.5, z: beste.wz + beste.nz * 0.5, nx: beste.nx, nz: beste.nz, echt: true };
  }
  const vrijOp = (x, z, r = 0.32) => { const [rx, rz] = resolveCollisions(x, z, r); return Math.hypot(rx - x, rz - z) < 0.03; };
  // de deur van een adres, vrij om te staan; null als er geen plek is
  function deurPlek(h) {
    const w = wegBij(h.x, h.z, 45);
    if (!w) return null;
    if (Math.abs(grondHoogte(w.x, w.z) - grondHoogte(h.x, h.z)) > 1.5) return null;
    const pand = panden.get(h.pand);
    const echt = voordeurVan(pand, w);
    const d = echt || deurVan(pand, h, w);
    // de kijkrichting: van de deur naar de gevel (bij `deurVan` ligt de deur op de lijn van de gevel naar de weg)
    let ux, uz;
    if (echt) { ux = -echt.nx; uz = -echt.nz; }
    else { ux = d.x - w.x; uz = d.z - w.z; const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul; }
    for (let extra = 0; extra <= 1.5; extra += 0.25) {
      const x = d.x - ux * extra, z = d.z - uz * extra;
      if (vrijOp(x, z)) return { x, z, gx: d.x + ux * 0.5, gz: d.z + uz * 0.5, w, nr: h.t, echt: !!echt };
    }
    return null;
  }
  const lengte = (pad) => { let s = 0; for (let i = 1; i < pad.length; i++) s += Math.hypot(pad[i][0] - pad[i - 1][0], pad[i][1] - pad[i - 1][1]); return s; };

  /*
   Een straat kiezen: een adres op POST.min–POST.straal meter van de speler, en daarvandaan de deuren aan
   dezelfde kant van dezelfde weg, op volgorde langs die weg. Een deur waar geen looproute heen gaat (of
   alleen een omweg van meer dan het dubbele) valt af. Minstens POST.deuren[0] deuren; de eerste uit beeld.
  */
  function kiesStraat(sp, ziet, { zeker = false } = {}) {
    const hSp = grondHoogte(sp.x, sp.z);
    const lijst = KAART.huisnummers.filter(h => {
      const d = Math.hypot(h.x - sp.x, h.z - sp.z);
      return d > POST.min && d < POST.straal;
    });
    st.reden = lijst.length ? 'geen straat' : 'geen adres';
    for (let poging = 0; poging < 10 && lijst.length; poging++) {
      const anker = lijst[Math.floor(Math.random() * lijst.length)];
      const a = deurPlek(anker);
      if (!a || Math.abs(grondHoogte(a.x, a.z) - hSp) > 1.5) continue;
      const dir = { x: a.w.rx, z: a.w.rz };
      const kant = Math.sign((a.x - a.w.x) * dir.z - (a.z - a.w.z) * dir.x) || 1;
      // de buren aan dezelfde kant van dezelfde weg
      const buren = [];
      for (const h of KAART.huisnummers) {
        if (Math.abs(h.x - anker.x) > POST.langs + 20 || Math.abs(h.z - anker.z) > POST.langs + 20) continue;
        const d = h === anker ? a : deurPlek(h);
        if (!d || d.w.as !== a.w.as) continue;
        if ((Math.sign((d.x - d.w.x) * dir.z - (d.z - d.w.z) * dir.x) || 1) !== kant) continue;
        const s = (d.x - a.x) * dir.x + (d.z - a.z) * dir.z;
        if (Math.abs(s) > POST.langs) continue;
        // twee nummers achter één deur (een bovenwoning): één keer
        if (buren.some(q => Math.hypot(q.x - d.x, q.z - d.z) < 2.2)) continue;
        buren.push({ ...d, s });
      }
      if (buren.length < POST.deuren[0]) continue;
      buren.sort((p1, p2) => p1.s - p2.s);
      if (Math.random() < 0.5) buren.reverse();
      // de eerste uit beeld; anders van de andere kant
      if (!zeker && ziet(buren[0].x, buren[0].z)) {
        buren.reverse();
        if (ziet(buren[0].x, buren[0].z)) { st.reden = 'in beeld'; continue; }
      }
      // de looproutes ertussen
      const deuren = [buren[0]];
      deuren[0].pad = null;
      for (let i = 1; i < buren.length && deuren.length < POST.deuren[1]; i++) {
        const v = deuren[deuren.length - 1], n = buren[i];
        const hemel = Math.hypot(n.x - v.x, n.z - v.z);
        if (hemel > 45) break;
        const pad = zoekLooppad({ x: v.x, z: v.z }, { x: n.x, z: n.z });
        if (!pad || pad.length < 2) continue;
        if (lengte(pad) > hemel * 2.2 + 12) continue;
        // het pad eindigt op de dichtstbijzijnde vrije cel: het laatste stukje is naar de deur zelf
        pad.push([n.x, n.z]);
        deuren.push({ ...n, pad });
      }
      if (deuren.length < POST.deuren[0]) { st.reden = 'geen route'; continue; }
      st.reden = null;
      return deuren;
    }
    return null;
  }

  function begin(deuren) {
    st.deuren = deuren; st.nr = 0; st.fase = 'deur'; st.deurT = 0; st.rondes++; st.vastT = 0; st.omT = 0;
    st.pad = null; st.padI = 0; st.vlucht = null;
    const d = deuren[0];
    p.legNeer(0);
    p.zetNeer(d.x, d.z, Math.atan2(-(d.gx - d.x), -(d.gz - d.z)));
    p.groep.visible = true;
    st.x = d.x; st.z = d.z;
    return true;
  }
  function weg(rust = true) {
    st.fase = 'weg'; p.groep.visible = false; envelop.visible = false; st.deuren = []; st.pad = null; st.vlucht = null;
    p.legNeer(0);
    if (rust) st.rust = POST.rust[0] + Math.random() * (POST.rust[1] - POST.rust[0]);
  }

  // een stap naar (x, z); true als hij er is
  function stapNaar(x, z, dt, snel) {
    const pos = p.groep.position, dx = x - pos.x, dz = z - pos.z, d = Math.hypot(dx, dz);
    if (d < 0.12) return true;
    const stap = Math.min(d, snel * dt);
    // in stukjes van hoogstens 20 cm: rennend (50 cm per beeld) duwde een hoek van twee botsdozen hem er half in
    const n = Math.max(1, Math.ceil(stap / 0.2));
    let nx = pos.x, nz = pos.z;
    for (let i = 0; i < n; i++) [nx, nz] = resolveCollisions(nx + dx / d * stap / n, nz + dz / d * stap / n, 0.3);
    [nx, nz] = resolveCollisions(nx, nz, 0.3);
    if (Math.hypot(nx - pos.x, nz - pos.z) < stap * 0.2) st.vastT += dt; else st.vastT = Math.max(0, st.vastT - dt);
    pos.x = nx; pos.z = nz;
    p.draaiNaar(Math.atan2(-dx, -dz), dt, 7);
    p.update(dt, { loopt: true, snelheid: snel });
    return d - stap < 0.12;
  }

  // de houding bij de brievenbus: a = 0 (rechtop) … 1 (de arm bij de klep)
  function bijDeBus(a) {
    p.armRechts.boven.rotation.x = 0.15 + 0.85 * a;
    p.armRechts.onder.rotation.x = 0.1 + 0.25 * a;
    p.armRechts.boven.rotation.z = 0.04;
    p.groep.rotation.x = 0.16 * a;
    p.hoofd.rotation.x = 0.12 * a;
  }

  function update(dt, sp, ziet, uur) {
    const tijd = binnen(uur, POST.van, POST.tot);
    if (!tijd) st.vandaag = false;          // de volgende ochtend weer
    if (st.fase === 'weg') {
      if (!tijd || st.vandaag) return;
      st.rust -= dt;
      if (st.rust > 0) return;
      const deuren = kiesStraat(sp, ziet);
      if (deuren) begin(deuren); else st.rust = 6;
      return;
    }
    const pos = p.groep.position;
    st.x = pos.x; st.z = pos.z;
    const d = Math.hypot(pos.x - sp.x, pos.z - sp.z);
    const gezien = ziet(pos.x, pos.z);

    if (st.fase === 'neer') {
      if (st.omT < 1) { st.omT = Math.min(1, st.omT + dt * 2); p.legNeer(st.omT); }
      if (!gezien && d > 40) weg(false);
      return;
    }
    if (st.fase === 'vlucht') {
      const v = st.vlucht, er = v.i >= v.pad.length;
      if (!er) {
        const [x, z] = v.pad[v.i];
        if (stapNaar(x, z, dt, POST.ren) || st.vastT > 1) { v.i++; st.vastT = 0; }
      } else p.update(dt, {});
      if ((er || d > 60) && !gezien) weg(false);
      return;
    }
    // klaar of te ver: uit beeld weg
    if ((!tijd || d > POST.weg) && !gezien) { weg(); return; }

    if (st.fase === 'deur') {
      const deur = st.deuren[st.nr];
      st.deurT += dt;
      p.update(dt, {});
      p.kijkNaar(deur.gx, deur.gz, dt, 6);
      const t = st.deurT;
      const a = Math.max(0, Math.min(1, Math.min((t - 0.3) / 0.5, (POST.deurT - 0.35 - t) / 0.5)));
      bijDeBus(a);
      envelop.visible = t > 0.2 && t < POST.klepOp;
      if (t >= POST.klepOp && t - dt < POST.klepOp) {
        st.kleppen++;
        if (geluid.brievenbus) geluid.brievenbus(d);
      }
      if (t >= POST.deurT) {
        st.bezocht++; envelop.visible = false;
        st.nr++;
        if (st.nr >= st.deuren.length) { st.fase = 'klaar'; return; }
        st.pad = st.deuren[st.nr].pad; st.padI = 1; st.fase = 'loopt'; st.vastT = 0;
      }
      return;
    }
    if (st.fase === 'loopt') {
      const pad = st.pad;
      const [x, z] = pad[Math.min(st.padI, pad.length - 1)];
      if (stapNaar(x, z, dt, POST.lopen)) st.padI++;
      // vast (er staat iemand of een auto in de weg): het volgende punt
      if (st.vastT > 1.5) { st.padI++; st.vastT = 0; }
      if (st.padI >= pad.length) { st.fase = 'deur'; st.deurT = 0; }
      return;
    }
    if (st.fase === 'klaar') {
      // de ronde zit erop: hij zoekt in zijn tas naar de volgende stapel, tot je niet meer kijkt
      p.update(dt, {});
      if (!gezien) weg();
    }
  }

  return {
    POST, persoon: p, envelop,
    get stand() { return { fase: st.fase, x: st.x, z: st.z, nr: st.nr, deuren: st.deuren.map(q => ({ x: q.x, z: q.z, gx: q.gx, gz: q.gz, nr: q.nr, pad: q.pad, echt: q.echt })),
      rondes: st.rondes, kleppen: st.kleppen, bezocht: st.bezocht, vandaag: st.vandaag, reden: st.reden, rust: st.rust, zichtbaar: p.groep.visible }; },
    update,
    // een schot of een knal in de buurt: hij rent weg, en komt pas morgen terug
    schrik(x, z) {
      if (st.fase === 'weg' || st.fase === 'neer' || st.fase === 'vlucht') return false;
      const pos = p.groep.position;
      if (Math.hypot(pos.x - x, pos.z - z) > POST.schrik) return false;
      /*
       Weg langs de straat, de kant op die van het schot af ligt, over een looproute. Recht van het
       schot af liep hij vanaf een stoep meestal tegen de gevel waar hij net de post in deed.
      */
      const deur = st.deuren[Math.min(st.nr, st.deuren.length - 1)];
      let doel = null;
      if (deur && deur.w) {
        const w = deur.w, kanten = [1, -1].map(k => ({ x: w.x + w.rx * k * 40, z: w.z + w.rz * k * 40 }));
        kanten.sort((a, b) => Math.hypot(b.x - x, b.z - z) - Math.hypot(a.x - x, a.z - z));
        doel = kanten[0];
      } else {
        let dx = pos.x - x, dz = pos.z - z; const l = Math.hypot(dx, dz) || 1;
        doel = { x: pos.x + dx / l * 40, z: pos.z + dz / l * 40 };
      }
      let pad = zoekLooppad({ x: pos.x, z: pos.z }, doel);
      // geen route die kant op: dan de andere kant van de straat op
      if ((!pad || pad.length < 2) && deur && deur.w) {
        const w = deur.w, k = Math.sign((doel.x - w.x) * w.rx + (doel.z - w.z) * w.rz) || 1;
        pad = zoekLooppad({ x: pos.x, z: pos.z }, { x: w.x - w.rx * k * 40, z: w.z - w.rz * k * 40 });
      }
      st.vlucht = { pad: pad && pad.length > 1 ? pad : [[pos.x, pos.z], [doel.x, doel.z]], i: 1 };
      st.fase = 'vlucht'; st.vandaag = true; st.vastT = 0; envelop.visible = false;
      return true;
    },
    aanrijden(x, z, straal = 1.5, snelheid = 0) {
      if (snelheid < 3.5 || st.fase === 'weg' || st.fase === 'neer') return 0;
      const q = p.groep.position;
      if (Math.hypot(q.x - x, q.z - z) > straal + 0.2) return 0;
      st.fase = 'neer'; st.omT = 0; st.vandaag = true; envelop.visible = false;
      return 1;
    },
    doelen() { return st.fase !== 'weg' && st.fase !== 'neer' ? [p.groep] : []; },
    raak(obj) {
      for (let o = obj; o; o = o.parent) {
        if (o !== p.groep) continue;
        if (st.fase === 'weg' || st.fase === 'neer') return null;
        st.fase = 'neer'; st.omT = 0; st.vandaag = true; envelop.visible = false;
        return { x: p.groep.position.x, z: p.groep.position.z, herstel: null };
      }
      return null;
    },
    // voor de proeven
    kiesStraat, begin, weg, deurPlek,
    start(sp, opties = {}) { const d = kiesStraat(sp, () => false, opties); return d ? begin(d) : false; },
  };
}
