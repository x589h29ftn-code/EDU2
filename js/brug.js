/*
 De Dúvelsrak in missie 12: het houten viaduct over de N7 bij Tinga, dat in de
 kaart "Viaduct Tinga" heet (data/stijl/omgeving.json, js/viaduct.js).

 Mark wil De Veteraan op de brug laten stoppen voor wat een gewone politiecontrole
 lijkt, en dan de achterkant van de brug opblazen. Daarvoor is hier:

 - `brugAssen`: het assenstelsel van het dek. `s` loopt van het eind aan de Tinga-
   kant (s = 0) naar de kant van de Lemmerweg, `u` dwars erop (positief is rechts
   als je naar de Lemmerweg kijkt). Het dek is vlak, 5,6 m hoog en ruim tien
   meter breed; de hellingen erop en eraf volgen de stations van het viaduct.
 - `maakDranghek`: een rood-wit hek op twee schragen, met een oranje lampje. Rijdt
   er een auto tegenaan, dan valt het om: het is een versperring voor wie wil
   stoppen, geen muur.
 - `maakC4`: een blok kneedbare springstof met tape en een knipperend lampje,
   zoals de vier van de balie van Tinga State (js/boerderij.js).
 - `maakSchade`: wat er na de knal van het dek over is: een zwartgeblakerd gat
   in het asfalt, versplinterde planken, een geknakte leuning en vuur dat nog
   een hele tijd doorbrandt.

 Alles wordt bij het opstarten gebouwd en verborgen neergezet, zodat de shaders
 achter het laadscherm vertaald worden (zie `soortenVoorbereid` in js/world.js);
 een materiaal dat pas midden in de missie ontstaat, hapert.

 Geen lampen: het vuur is licht van zichzelf (MeshBasicMaterial), want een
 extra lichtbron laat three elk materiaal opnieuw vertalen (stap 83).
*/
import * as THREE from 'three';

/*
 Het dek. `tinga` is een punt aan de Tinga-kant (Molenkrite 15): het eind van het
 dek dat daar het dichtst bij ligt is s = 0. Levert null als de kaart geen
 viaduct heeft.
*/
export function brugAssen(KAART, tinga) {
  const lijst = (KAART && KAART.viaducten) || [];
  const v = lijst.find(q => /tinga/i.test(q.naam || '')) || lijst[0];
  if (!v || !v.as || v.dekVan == null) return null;
  let A = v.as[v.dekVan], B = v.as[v.dekTot];
  // de stations lopen van de ene voet naar de andere; welke kant is Tinga?
  let omgekeerd = false;
  if (Math.hypot(B[0] - tinga.x, B[1] - tinga.z) < Math.hypot(A[0] - tinga.x, A[1] - tinga.z)) {
    const t = A; A = B; B = t; omgekeerd = true;
  }
  const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const f = { x: (B[0] - A[0]) / L, z: (B[1] - A[1]) / L };
  // rechts als je naar de Lemmerweg kijkt: bij f = (0, −1) is dat (1, 0)
  const r = { x: -f.z, z: f.x };
  const hoogte = A[2];
  const breed = Math.min(A[3], A[5]) + Math.min(A[3], A[5]);     // van kruin tot kruin
  const p = (s, u = 0) => ({ x: A[0] + f.x * s + r.x * u, z: A[1] + f.z * s + r.z * u });
  const noord = Math.atan2(-f.x, -f.z);     // yaw met de neus naar de Lemmerweg
  /*
   De weg over het viaduct vanaf `stations` meter voorbij het eind aan de
   Lemmerweg-kant, de helling op en over het dek tot `sTot`, op `u` naast de as:
   de route van de auto's van De Veteraan. Punten [x, z].
  */
  function vanLemmerweg(voorbij, sTot, u = 0) {
    const st = v.as;
    const eind = omgekeerd ? v.dekVan : v.dekTot;
    const stap = omgekeerd ? -1 : 1;
    // hoe ver de helling af: stations tot `voorbij` meter langs de as
    let k = eind, af = 0;
    while (k + stap >= 0 && k + stap < st.length && af < voorbij) {
      af += Math.hypot(st[k + stap][0] - st[k][0], st[k + stap][1] - st[k][1]);
      k += stap;
    }
    const pts = [];
    for (let i = k; i !== eind; i -= stap) pts.push([st[i][0], st[i][1]]);
    // en dan over het dek tot sTot
    for (let s = L; s >= sTot - 1e-6; s -= 2) { const q = p(s); pts.push([q.x, q.z]); }
    const q = p(sTot); pts.push([q.x, q.z]);
    return naastAs(pts, u);
  }
  /*
   Een plek op `s` meter langs de as, ook voorbij de einden van het dek: dan
   langs de stations van de helling, niet recht door. Rechtdoor gerekend kwam je
   24 m voor het dek al vier meter naast de oprit uit, naast de dijk op maaiveld,
   en Johan liep zo onder het dek door naar zijn plek (stap 90).
  */
  function langsAs(s, u = 0) {
    if (s >= 0 && s <= L) return p(s, u);
    const st = v.as;
    const naarTinga = s < 0;
    const begin = naarTinga ? (omgekeerd ? v.dekTot : v.dekVan) : (omgekeerd ? v.dekVan : v.dekTot);
    const stap = (naarTinga !== omgekeerd) ? -1 : 1;
    const nodig = naarTinga ? -s : s - L;
    let k = begin, af = 0;
    while (k + stap >= 0 && k + stap < st.length) {
      const a = st[k], b = st[k + stap];
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (af + d >= nodig && d > 1e-6) {
        const t = (nodig - af) / d;
        const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        // opzij: dezelfde kant op als op het dek (rechts als je naar de Lemmerweg kijkt)
        let rx = -(b[1] - a[1]) / d, rz = (b[0] - a[0]) / d;
        if (rx * r.x + rz * r.z < 0) { rx = -rx; rz = -rz; }
        return { x: x + rx * u, z: z + rz * u };
      }
      af += d; k += stap;
    }
    const q = st[k];
    return { x: q[0] + r.x * u, z: q[1] + r.z * u };
  }
  // de voet van het viaduct aan de Tinga-kant, waar de helling op maaiveld begint
  const vt = omgekeerd ? v.as[v.as.length - 1] : v.as[0];
  const voetTinga = { x: vt[0], z: vt[1] };
  return { v, L, f, r, hoogte, breed, p, langsAs, noord, zuid: noord + Math.PI, vanLemmerweg, voetTinga,
    // ligt (x, z) op het dek, met `marge` meter speling in de lengte?
    opDek(x, z, marge = 0) {
      const dx = x - A[0], dz = z - A[1];
      const s = dx * f.x + dz * f.z, u = dx * r.x + dz * r.z;
      return s > -marge && s < L + marge && Math.abs(u) < breed / 2 + 0.5;
    },
    // de s en u van een punt
    lokaal(x, z) { const dx = x - A[0], dz = z - A[1]; return { s: dx * f.x + dz * f.z, u: dx * r.x + dz * r.z }; },
  };
}

// Een lijn [[x, z], ...] een vaste afstand opzij verschuiven (rechts van de rijrichting).
function naastAs(pts, u) {
  if (!u) return pts;
  return pts.map((q, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    // rechts van (dx, dz) in dit assenstelsel is (−dz, dx)
    return [q[0] - dz / l * u, q[1] + dx / l * u];
  });
}

// ---------- de dranghekken ----------
let strepenDoek = null;
function strepen() {
  if (strepenDoek) return strepenDoek;
  const c = document.createElement('canvas'); c.width = 256; c.height = 32;
  const g = c.getContext('2d');
  // schuine rood-witte banen, zoals op elke wegafzetting
  for (let i = -2; i < 12; i++) {
    g.fillStyle = i % 2 ? '#f4f1ea' : '#c8202a';
    g.beginPath();
    g.moveTo(i * 28, 32); g.lineTo(i * 28 + 28, 32); g.lineTo(i * 28 + 44, 0); g.lineTo(i * 28 + 16, 0);
    g.closePath(); g.fill();
  }
  // een rand van vuil langs de onderkant
  g.fillStyle = 'rgba(40,30,20,0.18)'; g.fillRect(0, 26, 256, 6);
  strepenDoek = new THREE.CanvasTexture(c);
  strepenDoek.colorSpace = THREE.SRGBColorSpace;
  return strepenDoek;
}

export const HEK_BREED = 2.6;

/*
 Een dranghek: twee planken rood-wit op 0,55 en 0,95 m, twee grijze schragen en
 een oranje lamp bovenop die knippert. `omver` laat hem in een halve tel
 achterover vallen.
*/
/*
 (Geen Math.random bij het maken: dit gebeurt bij het opstarten, en een trekking
 meer schuift de hele reeks op waar daarna de voetgangers mee neergezet worden —
 bevolkingtest zag het. Elk hek krijgt een eigen, vaste fase.)
*/
let hekTeller = 0, c4Teller = 0;
export function maakDranghek(scene) {
  const groep = new THREE.Group();
  const plankMat = new THREE.MeshStandardMaterial({ map: strepen(), roughness: 0.7 });
  const poot = new THREE.MeshStandardMaterial({ color: 0x5d6168, roughness: 0.6, metalness: 0.3 });
  for (const y of [0.55, 0.95]) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(HEK_BREED, 0.22, 0.04), plankMat);
    plank.position.y = y;
    plank.castShadow = true;
    groep.add(plank);
  }
  for (const x of [-HEK_BREED / 2 + 0.25, HEK_BREED / 2 - 0.25]) {
    for (const z of [-0.22, 0.22]) {
      const been = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.12, 0.05), poot);
      been.position.set(x, 0.53, z * 0.5);
      been.rotation.x = z > 0 ? -0.36 : 0.36;
      groep.add(been);
    }
  }
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffa21a });
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 10), lampMat);
  lamp.position.set(HEK_BREED / 2 - 0.25, 1.13, 0);
  groep.add(lamp);
  groep.visible = false;
  scene.add(groep);
  let t = (hekTeller++ * 0.37) % 0.9, valT = -1, omT = 0;
  return {
    groep,
    zet(x, y, z, yaw) { groep.position.set(x, y, z); groep.rotation.set(0, yaw, 0); valT = -1; omT = 0; },
    toon(v) { groep.visible = !!v; },
    get zichtbaar() { return groep.visible; },
    get om() { return valT >= 0; },
    omver() { if (valT < 0) valT = 0; },
    update(dt) {
      if (!groep.visible) return;
      t += dt;
      lampMat.color.setHex((t % 0.9) < 0.45 ? 0xffa21a : 0x3a2406);
      if (valT >= 0 && omT < 1) {
        valT += dt;
        omT = Math.min(1, valT / 0.45);
        groep.rotation.x = -omT * omT * 1.45;
      }
    },
  };
}

// ---------- de C4 ----------
/*
 Eén blok: wit, met twee banden zwarte tape, een oranje draad en een rood lampje
 dat knippert als hij scherp staat.
*/
export function maakC4(scene) {
  const groep = new THREE.Group();
  const blok = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.10, 0.19), new THREE.MeshStandardMaterial({ color: 0xe7e2d2, roughness: 0.85 }));
  blok.position.y = 0.05;
  groep.add(blok);
  const tape = new THREE.MeshStandardMaterial({ color: 0x17181b, roughness: 0.6 });
  for (const x of [-0.08, 0.08]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.105, 0.195), tape);
    band.position.set(x, 0.05, 0);
    groep.add(band);
  }
  const draad = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.26, 6), new THREE.MeshStandardMaterial({ color: 0xe8741e, roughness: 0.5 }));
  draad.rotation.z = Math.PI / 2;
  draad.position.set(0, 0.105, 0.05);
  groep.add(draad);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xff2d2d });
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.03), ledMat);
  led.position.set(0.1, 0.11, -0.05);
  groep.add(led);
  groep.visible = false;
  scene.add(groep);
  let t = (c4Teller++ * 0.53) % 1.0;
  return {
    groep,
    zet(x, y, z, yaw = 0) { groep.position.set(x, y, z); groep.rotation.y = yaw; },
    toon(v) { groep.visible = !!v; },
    get zichtbaar() { return groep.visible; },
    update(dt) {
      if (!groep.visible) return;
      t += dt;
      ledMat.color.setHex((t % 1.0) < 0.18 ? 0xff4a4a : 0x4a0c0c);
    },
  };
}

// ---------- wat er na de knal van het dek over is ----------
let schroeiDoek = null;
function schroei() {
  if (schroeiDoek) return schroeiDoek;
  const W = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = W;
  const g = c.getContext('2d');
  // een grillige rand: een ster met veel punten, en daarbinnen steeds donkerder
  let a = 7;
  const rnd = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  const vlek = (straal, kleur, rafel) => {
    g.fillStyle = kleur;
    g.beginPath();
    for (let i = 0; i <= 48; i++) {
      const hoek = i / 48 * Math.PI * 2;
      const rr = straal * (1 - rafel + rnd() * rafel * 2);
      const x = W / 2 + Math.cos(hoek) * rr, y = W / 2 + Math.sin(hoek) * rr * 0.8;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.closePath(); g.fill();
  };
  vlek(124, 'rgba(24,20,18,0.55)', 0.12);   // roet, ver uitgewaaierd
  vlek(100, 'rgba(18,15,13,0.85)', 0.16);
  vlek(78, 'rgba(10,8,7,0.97)', 0.2);        // de verkoolde rand
  vlek(58, 'rgba(58,26,10,1)', 0.22);        // gloeiend hout
  vlek(48, 'rgba(3,3,4,1)', 0.25);           // het gat: je kijkt de diepte in
  // een paar gloeiende sintels op de rand
  for (let i = 0; i < 60; i++) {
    const hoek = rnd() * Math.PI * 2, rr = 50 + rnd() * 22;
    g.fillStyle = `rgba(255,${110 + Math.floor(rnd() * 80)},30,${0.5 + rnd() * 0.5})`;
    g.fillRect(W / 2 + Math.cos(hoek) * rr, W / 2 + Math.sin(hoek) * rr * 0.8, 2 + rnd() * 3, 2 + rnd() * 3);
  }
  schroeiDoek = new THREE.CanvasTexture(c);
  schroeiDoek.colorSpace = THREE.SRGBColorSpace;
  return schroeiDoek;
}

/*
 De schade op het dek, rond (x, y, z) met de brug in richting `yaw`. `breed` is de
 breedte van het dek: het gat loopt van leuning tot leuning, op een smalle strook
 langs de westkant na (daar komen de vier van de achterkant nog overheen).
*/
export function maakSchade(scene) {
  const groep = new THREE.Group();
  // het gat en de schroeiplek eromheen, plat op het asfalt
  const vlakMat = new THREE.MeshBasicMaterial({ map: schroei(), transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const vlak = new THREE.Mesh(new THREE.PlaneGeometry(13, 11), vlakMat);
  vlak.rotation.x = -Math.PI / 2;
  vlak.position.y = 0.04;
  vlak.renderOrder = 2;
  groep.add(vlak);
  // versplinterde planken en balken, de meeste schuin omhoog uit de rand
  const hout = new THREE.MeshStandardMaterial({ color: 0x6b4f33, roughness: 0.95 });
  const zwart = new THREE.MeshStandardMaterial({ color: 0x241a13, roughness: 1 });
  let a = 11;
  const rnd = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  for (let i = 0; i < 18; i++) {
    const hoek = i / 18 * Math.PI * 2 + rnd() * 0.3;
    const rr = 3.0 + rnd() * 1.6;
    const lang = 0.8 + rnd() * 1.6;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.16 + rnd() * 0.12, 0.09, lang), rnd() < 0.5 ? hout : zwart);
    m.position.set(Math.cos(hoek) * rr * 1.15, 0.2 + rnd() * 0.3, Math.sin(hoek) * rr * 0.9);
    m.rotation.set(-0.3 - rnd() * 0.9, hoek + Math.PI / 2 + (rnd() - 0.5), (rnd() - 0.5) * 0.6);
    m.castShadow = true;
    groep.add(m);
  }
  // twee stukken van de leuning, geknakt naar buiten
  for (const kant of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 4.2), hout);
    m.position.set(kant * 5.0, 0.9, 0.6 * kant);
    m.rotation.set(0.25 * kant, 0.2, kant * 0.9);
    groep.add(m);
  }
  // vuur: vlammen die flakkeren, en rook die blijft opstijgen
  const vlammen = [];
  const vuurMat = new THREE.MeshBasicMaterial({ color: 0xff8a26, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
  const kernMat = new THREE.MeshBasicMaterial({ color: 0xffe07a, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
  const plekken = [[-3.2, -1.8], [2.6, -2.4], [3.8, 1.6], [-2.0, 2.6], [0.4, -3.4], [-4.3, 0.6]];
  for (const [x, z] of plekken) {
    const v = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.6, 8), vuurMat);
    const k = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.9, 8), kernMat);
    v.position.set(x, 0.8, z); k.position.set(x, 0.45, z);
    groep.add(v, k);
    vlammen.push({ v, k, fase: rnd() * 6 });
  }
  const rook = [];
  for (let i = 0; i < 6; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x3a3836, transparent: true, opacity: 0, depthWrite: false });
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mat);
    groep.add(m);
    rook.push({ m, mat, t: i * 1.1, x: (rnd() - 0.5) * 6, z: (rnd() - 0.5) * 5 });
  }
  groep.visible = false;
  scene.add(groep);
  let t = 0;
  return {
    groep,
    zet(x, y, z, yaw) { groep.position.set(x, y, z); groep.rotation.y = yaw; },
    toon(v) { groep.visible = !!v; t = 0; },
    get zichtbaar() { return groep.visible; },
    update(dt) {
      if (!groep.visible) return;
      t += dt;
      for (const f of vlammen) {
        const s = 1 + Math.sin(t * 9 + f.fase) * 0.18 + Math.sin(t * 23 + f.fase * 2) * 0.08;
        f.v.scale.set(1, s, 1); f.k.scale.set(1, 2 - s, 1);
      }
      vuurMat.opacity = 0.7 + Math.sin(t * 13) * 0.12;
      // de rook: elke bol stijgt zes tellen op en begint dan opnieuw onderaan
      for (const r of rook) {
        const u = ((t + r.t) % 6.6) / 6.6;
        r.m.position.set(r.x + u * 2.5, 1 + u * 11, r.z);
        r.m.scale.setScalar(0.8 + u * 3.2);
        r.mat.opacity = 0.42 * Math.sin(u * Math.PI);
      }
    },
  };
}
