/*
 Tankstation: de luifel met de pompen, de prijzenzuil en de verlichting.

 Voor BP Slump Oil aan de Lemmerweg 63, aan de rondweg naast het sportpark
 (foto's Street View, chat 12 sep 2026). Wat je op die foto's ziet en wat hier
 terugkomt: een vlakke luifel op ronde kolommen met een groene rand en een dunne
 gele lijn eronder, het BP-zonnetje op de kopse kanten, twee pompeilanden met
 groen-witte pompen eronder, en aan de weg een witte prijzenzuil met het zonnetje
 bovenop en de prijzen in groen.

 De maten komen uit de kaart (tools/geo/genereer.mjs → `tankstations`): de luifel
 staat als los bouwwerk in de BGT, 24,6 × 10,8 m, en de generator haalt daar de
 plek, de richting en de maat uit. Alleen de doorrijhoogte en het aantal pompen
 staan in data/stijl/omgeving.json.

 Net als overal in dit spel zijn er geen plaatjes: het zonnetje en de
 prijsborden worden op een canvas getekend.
*/
import * as THREE from 'three';

const GROEN = '#009640';        // BP-groen
const GEEL = '#ffe500';         // de gele ring van het zonnetje

let MAT = null;
function materialen() {
  if (MAT) return MAT;
  const std = (kleur, extra = {}) => new THREE.MeshStandardMaterial({ color: kleur, roughness: 0.7, ...extra });
  MAT = {
    dek: std(0xf2f3f1, { roughness: 0.85 }),          // de onderkant van de luifel
    rand: std(0x009640, { roughness: 0.55 }),         // de groene rand
    geel: std(0xffe500, { roughness: 0.5 }),
    kolom: std(0xe8e9e6, { roughness: 0.6, metalness: 0.1 }),
    eiland: std(0xbdbfba, { roughness: 0.9 }),
    pomp: std(0xf4f5f3, { roughness: 0.55 }),
    pompGroen: std(0x009640, { roughness: 0.5 }),
    scherm: std(0x1d2326, { roughness: 0.35, metalness: 0.2 }),
    slang: std(0x23262a, { roughness: 0.9 }),
    zuil: std(0xf2f3f1, { roughness: 0.6 }),
    licht: new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xfff0cc, emissiveIntensity: 0.55, roughness: 1 }),
  };
  return MAT;
}

// ---------- het zonnetje van BP, op een canvas ----------
function heliosDoek(maat = 256) {
  const c = document.createElement('canvas'); c.width = c.height = maat;
  const g = c.getContext('2d');
  g.clearRect(0, 0, maat, maat);
  const m = maat / 2;
  /*
   Het zonnetje is een ster van punten die naar buiten toe van geel naar groen
   verloopt. Achttien punten, om en om iets korter, met een witte kern: van een
   meter of tien afstand is dat precies wat je ziet.
  */
  const punten = 18;
  for (let i = 0; i < punten; i++) {
    const a0 = (i / punten) * Math.PI * 2, a1 = ((i + 0.62) / punten) * Math.PI * 2;
    const buiten = m * (i % 2 ? 0.94 : 0.99);
    g.beginPath();
    g.moveTo(m + Math.cos(a0) * m * 0.10, m + Math.sin(a0) * m * 0.10);
    g.lineTo(m + Math.cos(a0) * buiten, m + Math.sin(a0) * buiten);
    g.lineTo(m + Math.cos(a1) * buiten, m + Math.sin(a1) * buiten);
    g.lineTo(m + Math.cos(a1) * m * 0.10, m + Math.sin(a1) * m * 0.10);
    g.closePath();
    const vl = g.createLinearGradient(m, m, m + Math.cos(a0) * buiten, m + Math.sin(a0) * buiten);
    vl.addColorStop(0, GEEL); vl.addColorStop(0.55, '#8cc63f'); vl.addColorStop(1, GROEN);
    g.fillStyle = vl; g.fill();
  }
  g.beginPath(); g.arc(m, m, m * 0.13, 0, Math.PI * 2);
  g.fillStyle = GEEL; g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- het prijsbord van de zuil ----------
function zuilDoek(prijzen, breed = 256, hoog = 512) {
  const c = document.createElement('canvas'); c.width = breed; c.height = hoog;
  const g = c.getContext('2d');
  g.fillStyle = '#f2f3f1'; g.fillRect(0, 0, breed, hoog);
  // bovenin het merk, daaronder de prijzen op een groen vlak
  g.fillStyle = GROEN; g.fillRect(0, hoog * 0.30, breed, hoog * 0.70);
  g.fillStyle = '#ffffff';
  g.font = `bold ${Math.round(hoog * 0.055)}px sans-serif`;
  g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText('shop', breed * 0.10, hoog * 0.365);
  prijzen.slice(0, 3).forEach((p, i) => {
    const y = hoog * (0.47 + i * 0.13);
    g.fillStyle = '#dfe7e0';
    g.font = `${Math.round(hoog * 0.042)}px sans-serif`;
    g.fillText(p.naam, breed * 0.10, y - hoog * 0.045);
    // de cijfers als groene led-cijfers op zwart, zoals op de foto
    g.fillStyle = '#10241a'; g.fillRect(breed * 0.08, y - hoog * 0.025, breed * 0.84, hoog * 0.075);
    g.fillStyle = '#5dff7a';
    g.font = `bold ${Math.round(hoog * 0.062)}px monospace`;
    g.textAlign = 'right';
    g.fillText(p.prijs, breed * 0.90, y + hoog * 0.013);
    g.textAlign = 'left';
  });
  g.fillStyle = '#ffffff';
  g.font = `bold ${Math.round(hoog * 0.045)}px sans-serif`;
  g.fillText('car wash', breed * 0.10, hoog * 0.87);
  g.fillText('24 h cards', breed * 0.10, hoog * 0.945);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/*
 Alles neerzetten. `W` is dezelfde bundel als bij de rest van de kaartwereld:
 `addCollider` voor de botsingen en `lodAan` voor de afstand.
*/
export function bouwTankstations(scene, W, stations) {
  if (!stations || !stations.length) return;
  const M = materialen();
  const helios = heliosDoek();

  for (const T of stations) {
    const groep = new THREE.Group();
    const yaw = Math.atan2(T.as[0], T.as[1]);        // de lange as van de luifel
    /*
     De botsdozen draaien anders dan de meshes: `addCollider` wil de hoek van de
     lange as zelf (−atan2(dz, dx)), en niet de draaiing om de y-as van het
     model. Met de verkeerde van de twee stond het pompeiland dwars over het
     plein en kon je er niet langs — de proef mat 1,97 m wegduwen midden onder
     de luifel.
    */
    const botsYaw = -Math.atan2(T.as[1], T.as[0]);
    const L = T.lengte, B = T.breedte;
    const onder = T.hoogte, dik = T.dek;

    // ---- de luifel: een plaat met een groene rand eromheen ----
    const dek = new THREE.Mesh(new THREE.BoxGeometry(L, dik * 0.55, B), M.dek);
    dek.position.set(0, onder + dik * 0.72, 0);
    dek.castShadow = true; dek.receiveShadow = true;
    groep.add(dek);
    /*
     Het plafond. Zonder deze plaat kijk je van onderen tegen de binnenkant van
     de groene rand aan en is de hele luifel groen; op de foto is de onderkant
     juist licht, met de lichtbakken erin.
    */
    const plafond = new THREE.Mesh(new THREE.BoxGeometry(L + 0.3, 0.08, B + 0.3), M.dek);
    plafond.position.set(0, onder + 0.04, 0);
    plafond.receiveShadow = true;
    groep.add(plafond);
    // groene rand: vier balken om de plaat heen, met een dunne gele lijn eronder
    const randH = dik * 0.62;
    for (const [dx, dz, w, d] of [[0, B / 2, L + 0.34, 0.34], [0, -B / 2, L + 0.34, 0.34],
      [L / 2, 0, 0.34, B + 0.34], [-L / 2, 0, 0.34, B + 0.34]]) {
      const rand = new THREE.Mesh(new THREE.BoxGeometry(w, randH, d), M.rand);
      rand.position.set(dx, onder + dik * 0.42, dz);
      rand.castShadow = true;
      groep.add(rand);
      const lijn = new THREE.Mesh(new THREE.BoxGeometry(w * 0.995, 0.07, d * 0.995), M.geel);
      lijn.position.set(dx, onder + dik * 0.42 - randH / 2 - 0.03, dz);
      groep.add(lijn);
    }
    // het zonnetje op beide kopse kanten
    for (const kant of [-1, 1]) {
      const vlag = new THREE.Mesh(new THREE.PlaneGeometry(randH * 0.86, randH * 0.86),
        new THREE.MeshBasicMaterial({ map: helios, transparent: true }));
      vlag.position.set(kant * (L / 2 + 0.19), onder + dik * 0.42, 0);
      vlag.rotation.y = kant * Math.PI / 2;
      groep.add(vlag);
    }
    // en op de lange zijden, midden boven de pompen
    for (const kant of [-1, 1]) {
      const vlag = new THREE.Mesh(new THREE.PlaneGeometry(randH * 0.86, randH * 0.86),
        new THREE.MeshBasicMaterial({ map: helios, transparent: true }));
      vlag.position.set(0, onder + dik * 0.42, kant * (B / 2 + 0.19));
      vlag.rotation.y = kant > 0 ? 0 : Math.PI;
      groep.add(vlag);
    }

    // ---- lichtbakken in de onderkant ----
    for (let i = 0; i < 4; i++) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(L * 0.16, 0.08, B * 0.5), M.licht);
      lamp.position.set(-L * 0.33 + i * (L * 0.22), onder - 0.05, 0);
      groep.add(lamp);
    }

    // ---- de kolommen: één per hoek van het middenvak ----
    const kolomX = L / 2 - 2.6, kolomZ = B / 2 - 2.2;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const k = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.30, onder, 10), M.kolom);
      k.position.set(sx * kolomX, onder / 2, sz * kolomZ);
      k.castShadow = true;
      groep.add(k);
      // botsing: de kolom staat in de rijbaan van het plein
      const wx = T.cx + sx * kolomX * T.as[0] + sz * kolomZ * -T.as[1];
      const wz = T.cz + sx * kolomX * T.as[1] + sz * kolomZ * T.as[0];
      W.addCollider(wx, wz, 0.32, 0.32, 0, onder);
    }

    // ---- de pompeilanden ----
    for (const eil of T.eilanden) {
      // plek van het eiland ten opzichte van het hart van de luifel
      const dx = eil.x - T.cx, dz = eil.z - T.cz;
      const lokX = dx * T.as[0] + dz * T.as[1];
      const lokZ = dx * -T.as[1] + dz * T.as[0];
      const band = new THREE.Mesh(new THREE.BoxGeometry(eil.lengte, 0.16, 1.5), M.eiland);
      band.position.set(lokX, 0.20, lokZ);
      band.receiveShadow = true;
      groep.add(band);
      W.addCollider(eil.x, eil.z, eil.lengte / 2, 0.75, botsYaw, 0.25);

      for (let i = 0; i < eil.pompen; i++) {
        const px = lokX + (i - (eil.pompen - 1) / 2) * (eil.lengte * 0.5);
        const kast = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.55, 0.62), M.pomp);
        kast.position.set(px, 0.28 + 1.55 / 2, lokZ);
        kast.castShadow = true;
        groep.add(kast);
        const kop = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.34, 0.66), M.pompGroen);
        kop.position.set(px, 0.28 + 1.55 + 0.17, lokZ);
        groep.add(kop);
        for (const kant of [-1, 1]) {
          const scherm = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.5, 0.03), M.scherm);
          scherm.position.set(px, 0.28 + 1.12, lokZ + kant * 0.33);
          groep.add(scherm);
          // de slang aan een beugel opzij
          const slang = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.55, 0.10), M.slang);
          slang.position.set(px + 0.66, 0.28 + 0.85, lokZ + kant * 0.18);
          groep.add(slang);
        }
        // een pomp is een paal waar je niet doorheen rijdt
        const wx = T.cx + px * T.as[0] + lokZ * -T.as[1];
        const wz = T.cz + px * T.as[1] + lokZ * T.as[0];
        W.addCollider(wx, wz, 0.6, 0.4, botsYaw, 2.1);
      }
    }

    groep.position.set(T.cx, 0, T.cz);
    groep.rotation.y = yaw;
    scene.add(groep);
    if (W.lodAan) W.lodAan(groep, T.cx, T.cz, { tot: 420, straal: Math.max(L, B) });

    // ---- de prijzenzuil aan de weg ----
    const Z = T.zuil;
    const zuil = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, Z.hoog, 0.45), M.zuil);
    body.position.y = Z.hoog / 2; body.castShadow = true;
    zuil.add(body);
    const doek = zuilDoek(T.prijzen.length ? T.prijzen : [{ naam: 'euro 95', prijs: '206.9' }]);
    for (const kant of [-1, 1]) {
      const blad = new THREE.Mesh(new THREE.PlaneGeometry(1.8, Z.hoog * 0.72),
        new THREE.MeshBasicMaterial({ map: doek }));
      blad.position.set(0, Z.hoog * 0.40, kant * 0.235);
      blad.rotation.y = kant > 0 ? 0 : Math.PI;
      zuil.add(blad);
      const zon = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.25),
        new THREE.MeshBasicMaterial({ map: helios, transparent: true }));
      zon.position.set(0, Z.hoog * 0.86, kant * 0.24);
      zon.rotation.y = kant > 0 ? 0 : Math.PI;
      zuil.add(zon);
    }
    zuil.position.set(Z.x, 0, Z.z);
    zuil.rotation.y = Z.yaw;
    scene.add(zuil);
    W.addCollider(Z.x, Z.z, 0.95, 0.3, -Math.atan2(Math.cos(Z.yaw), Math.sin(Z.yaw)), Z.hoog);
    if (W.lodAan) W.lodAan(zuil, Z.x, Z.z, { tot: 500, straal: 4 });
  }
}
