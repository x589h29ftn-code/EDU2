/*
 Tennispark: de banen, het net, het hekwerk en de lichtmasten.

 Voor het tennispark bij Molenkrite 130, pal naast het sportpark (verzoek in de
 chat 12 sep 2026: "rond Molenkrite 130 is een tennisbaan, daar heb je nu al
 groene velden gemaakt").

 Uit de data komen de blokken: de banen liggen in de BGT als halfverhard vlak
 (vier blokken van 1276 tot 2535 m²), en de generator rekent er met de maat van
 een echte baan (36,6 × 18,3 m inclusief uitloop) uit hoeveel banen erin passen —
 hier tien.

 Dat halfverhard is ook de reden dat de banen hier roodbruin zijn en niet grijs:
 halfverhard is in de BGT grind, en een grindbaan is in Nederland de gewone
 gravelbaan. De belijning, het gaashek en de lichtmasten horen daarbij; hun maten
 staan hieronder als opgemeten waarden, want die staan niet in de brondata.

 De belijning wordt op een canvas getekend en als één texture over het hele blok
 gelegd. Dat scheelt honderd losse lijnbalkjes per park, en het is ook scherper:
 een lijn van vijf centimeter is als vlakje op deze schaal een paar beeldpunten.
*/
import * as THREE from 'three';

// maten van een tennisbaan in meters (NOC*NSF / ITF)
const BAAN = { l: 23.77, b: 10.97, enkel: 8.23, service: 6.40, netHoog: 1.07, netMidden: 0.914 };

/*
 Het net zelf: een fijne maas met de witte band erboven, op één vlak. Als doos
 met een effen kleur viel hij tegen het hek op de achtergrond weg — een net is
 van dichtbij vooral de witte band, en verderop nauwelijks meer dan dat.
*/
let netDoekje = null;
function netDoek() {
  if (netDoekje) return netDoekje;
  const c = document.createElement('canvas'); c.width = 64; c.height = 96;
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  g.strokeStyle = 'rgba(24,28,30,0.95)'; g.lineWidth = 1.6;
  for (let x = 0; x <= 64; x += 5) { g.beginPath(); g.moveTo(x, 10); g.lineTo(x, 96); g.stroke(); }
  for (let y = 10; y <= 96; y += 5) { g.beginPath(); g.moveTo(0, y); g.lineTo(64, y); g.stroke(); }
  g.fillStyle = '#f2f2ec'; g.fillRect(0, 0, 64, 10);          // de band bovenlangs
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 9, 64, 1);
  netDoekje = new THREE.CanvasTexture(c);
  netDoekje.wrapS = THREE.RepeatWrapping;
  netDoekje.colorSpace = THREE.SRGBColorSpace;
  return netDoekje;
}

let MAT = null;
function materialen() {
  if (MAT) return MAT;
  MAT = {
    paal: new THREE.MeshStandardMaterial({ color: 0x2f4034, roughness: 0.75, metalness: 0.2 }),
    mast: new THREE.MeshStandardMaterial({ color: 0xb9bdb8, roughness: 0.6, metalness: 0.3 }),
    // de lampkoppen gloeien zelf; een echte lichtbron per mast zou zestien
    // schaduwwerpende lampen betekenen, en dat is het beeld niet waard
    lamp: new THREE.MeshStandardMaterial({ color: 0xdfe3e0, emissive: 0x7a6b3c, roughness: 0.5 }),
  };
  return MAT;
}

/*
 Het doek van één blok: de baanvloer met de belijning erop. `L` is de lengte van
 een baan, `B` de breedte van het hele blok, `n` het aantal banen naast elkaar.
*/
function baanDoek(L, B, n, px = 8) {
  const c = document.createElement('canvas');
  c.width = Math.min(2048, Math.round(L * px));
  c.height = Math.min(2048, Math.round(B * px));
  const g = c.getContext('2d');
  const sx = c.width / L, sz = c.height / B;
  // het gravel zelf: roodbruin, met korrel en met lichte sleepsporen erdoor
  g.fillStyle = '#a85c40'; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 9000; i++) {
    const licht = Math.random() < 0.5;
    g.fillStyle = licht ? `rgba(226,166,132,${0.05 + Math.random() * 0.13})`
      : `rgba(96,44,28,${0.05 + Math.random() * 0.13})`;
    g.fillRect(Math.random() * c.width, Math.random() * c.height, 2, 2);
  }
  // sleepsporen van het sleepnet, in de lengte van de baan
  for (let i = 0; i < 120; i++) {
    g.strokeStyle = `rgba(214,150,118,${0.05 + Math.random() * 0.06})`;
    g.lineWidth = 1 + Math.random() * 2;
    const y = Math.random() * c.height;
    g.beginPath(); g.moveTo(0, y); g.lineTo(c.width, y + (Math.random() - 0.5) * 14); g.stroke();
  }
  const vak = B / n;                               // breedte per baan, inclusief uitloop
  g.strokeStyle = '#f2f4f0'; g.lineJoin = 'miter';
  for (let i = 0; i < n; i++) {
    const mz = (i + 0.5) * vak;                    // hart van deze baan
    const mx = L / 2;
    const lijn = (x1, z1, x2, z2, dik = 0.05) => {
      g.lineWidth = Math.max(1.5, dik * sx);
      g.beginPath();
      g.moveTo((mx + x1) * sx, (mz + z1) * sz);
      g.lineTo((mx + x2) * sx, (mz + z2) * sz);
      g.stroke();
    };
    const hl = BAAN.l / 2, hb = BAAN.b / 2, he = BAAN.enkel / 2, hs = BAAN.service;
    // buitenlijnen (dubbelspel), met dikkere achterlijnen
    lijn(-hl, -hb, hl, -hb, 0.05); lijn(-hl, hb, hl, hb, 0.05);
    lijn(-hl, -hb, -hl, hb, 0.10); lijn(hl, -hb, hl, hb, 0.10);
    // enkelspellijnen
    lijn(-hl, -he, hl, -he); lijn(-hl, he, hl, he);
    // servicelijnen en de middenlijn
    lijn(-hs, -he, -hs, he); lijn(hs, -he, hs, he);
    lijn(-hs, 0, hs, 0);
    // de middenmerkjes op de achterlijn
    lijn(-hl, 0, -hl + 0.1, 0, 0.05); lijn(hl - 0.1, 0, hl, 0, 0.05);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export { baanDoek as __baanDoek };   // alleen voor tools/tennistest.mjs

// gaas voor het hek: een canvas met ruitjes en veel doorzicht
let gaasDoek = null;
function gaas() {
  if (gaasDoek) return gaasDoek;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 64, 64);
  g.strokeStyle = 'rgba(46,64,52,0.95)'; g.lineWidth = 2;
  for (let i = -64; i < 128; i += 10) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke();
    g.beginPath(); g.moveTo(i + 64, 0); g.lineTo(i, 64); g.stroke();
  }
  gaasDoek = new THREE.CanvasTexture(c);
  gaasDoek.wrapS = gaasDoek.wrapT = THREE.RepeatWrapping;
  return gaasDoek;
}

export function bouwTennisparken(scene, W, parken) {
  if (!parken || !parken.length) return;
  const M = materialen();

  for (const P of parken) {
    for (const blok of P.blokken) {
      const groep = new THREE.Group();
      const L = blok.lengte, B = blok.breedte, n = blok.banen;
      // de as komt afgerond uit de kaart; weer op lengte 1 brengen, anders
      // schuiven de hoekpunten die eruit gerekend worden een paar centimeter
      const asL = Math.hypot(blok.as[0], blok.as[1]);
      const as = [blok.as[0] / asL, blok.as[1] / asL];
      /*
       De baanlengte ligt hier langs de plaatselijke x-as, en `rotation.y` legt
       de plaatselijke z-as op een richting — vandaar de kwartslag eraf. Zonder
       die kwartslag staat het hele blok dwars: bij het blok van vier banen werd
       de baan van 35 m 73 m lang, en dan liggen de banen over het pad en de
       bomen ernaast heen.
      */
      const yaw = Math.atan2(as[0], as[1]) - Math.PI / 2;
      const botsYaw = -Math.atan2(as[1], as[0]);

      // ---- de baanvloer met de belijning ----
      const vloer = new THREE.Mesh(new THREE.PlaneGeometry(L, B),
        new THREE.MeshStandardMaterial({ map: baanDoek(L, B, n), roughness: 0.95 }));
      vloer.rotation.x = -Math.PI / 2;
      vloer.position.y = 0.135;                 // net boven de verharding uit de kaart
      vloer.receiveShadow = true;
      groep.add(vloer);

      // ---- de netten: één per baan ----
      const vak = B / n;
      const netB = BAAN.b + 0.9, netH = BAAN.netHoog;
      for (let i = 0; i < n; i++) {
        const mz = -B / 2 + (i + 0.5) * vak;
        const doek = netDoek().clone();
        doek.needsUpdate = true;
        doek.repeat.set(netB / 1.1, 1);
        const net = new THREE.Mesh(new THREE.PlaneGeometry(netB, netH),
          new THREE.MeshStandardMaterial({
            map: doek, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.9,
          }));
        net.position.set(0, 0.135 + netH / 2, mz);
        net.rotation.y = Math.PI / 2;
        groep.add(net);
        for (const kant of [-1, 1]) {
          const paal = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, BAAN.netHoog, 8), M.paal);
          paal.position.set(0, 0.135 + BAAN.netHoog / 2, mz + kant * (BAAN.b + 0.9) / 2);
          groep.add(paal);
        }
      }

      // ---- het hek eromheen ----
      const H = P.hek || 3.6;
      const gaasMat = new THREE.MeshStandardMaterial({
        map: gaas(), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.9,
      });
      for (const [w, d, dx, dz] of [[L, 0, 0, -B / 2], [L, 0, 0, B / 2], [0, B, -L / 2, 0], [0, B, L / 2, 0]]) {
        const breed = w || d;
        const doek = gaasMat.clone();
        doek.map = gaas().clone();
        doek.map.needsUpdate = true;
        doek.map.repeat.set(breed / 2.2, H / 2.2);
        const vlak = new THREE.Mesh(new THREE.PlaneGeometry(breed, H), doek);
        vlak.position.set(dx, H / 2, dz);
        vlak.rotation.y = w ? 0 : Math.PI / 2;
        groep.add(vlak);
        // palen om de paar meter
        const palen = Math.max(2, Math.round(breed / 3));
        for (let i = 0; i <= palen; i++) {
          const t = -breed / 2 + (breed * i) / palen;
          const paal = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, H, 6), M.paal);
          paal.position.set(w ? t : dx, H / 2, w ? dz : t);
          groep.add(paal);
        }
      }

      // ---- lichtmasten op de hoeken ----
      if (P.masten) {
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 8.5, 8), M.mast);
          mast.position.set(sx * (L / 2 - 1.2), 4.25, sz * (B / 2 - 1.2));
          mast.castShadow = true;
          groep.add(mast);
          const kop = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.3, 0.45), M.lamp);
          // de lamp steekt een eindje naar binnen, over de baan heen
          kop.position.set(sx * (L / 2 - 1.5), 8.5, sz * (B / 2 - 1.2));
          groep.add(kop);
          const wx = blok.cx + sx * (L / 2 - 1.2) * as[0] + sz * (B / 2 - 1.2) * -as[1];
          const wz = blok.cz + sx * (L / 2 - 1.2) * as[1] + sz * (B / 2 - 1.2) * as[0];
          W.addCollider(wx, wz, 0.2, 0.2, 0, 8.5);
        }
      }

      groep.position.set(blok.cx, 0, blok.cz);
      groep.rotation.y = yaw;
      scene.add(groep);
      if (W.lodAan) W.lodAan(groep, blok.cx, blok.cz, { tot: 380, straal: Math.max(L, B) });

      /*
       Botsing: het hek als vier dunne dozen om het blok heen. Zonder dat rijd je
       zo de baan op, en dat is precies wat een hek moet voorkomen.
      */
      for (const [hx, hz, dx, dz] of [[L / 2, 0.12, 0, -B / 2], [L / 2, 0.12, 0, B / 2],
        [0.12, B / 2, -L / 2, 0], [0.12, B / 2, L / 2, 0]]) {
        const wx = blok.cx + dx * as[0] + dz * -as[1];
        const wz = blok.cz + dx * as[1] + dz * as[0];
        W.addCollider(wx, wz, hx, hz, botsYaw, H);
      }
    }
  }
}
