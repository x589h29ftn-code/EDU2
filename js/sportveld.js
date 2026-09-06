/*
 De velden van VV Sneek Wit Zwart aan de Molenkrite 132, en de hockeyvelden
 ernaast.

 Het vlak zelf komt uit de BGT en ligt al in de wereld: kunstgras (in de
 brondata "kunststof") of gras. Wat hier bovenop komt is alles wat een veld pas
 een veld maakt en niet in de geodata staat, omdat het te klein of te tijdelijk
 is om geregistreerd te worden:

   - de belijning, uitgezet volgens de KNVB-maten op het speelveld dat
     tools/geo/genereer.mjs uit de omhullende rechthoek van het BGT-vlak heeft
     berekend (middenstip, middencirkel van 9,15 m, strafschopgebied van
     16,5 x 40,32 m, doelgebied van 5,5 x 18,32 m, strafschopstip op 11 m en
     hoekcirkels van 1 m);
   - twee doelen van 7,32 bij 2,44 m met een net;
   - rondom het hoofdveld de reclameborden, op een meter achter de zijlijn, met
     om de vijf borden dat van Radio Spannenburg (js/textures.js);
   - een ballenvanger achter de doelen en een laag hek langs de kant;
   - dugouts langs de zijlijn en lichtmasten op de hoeken.

 Alles staat in de lengterichting van het veld uitgezet: u loopt langs het veld,
 v er dwars op. Let op de draairichting — de wereld draait om Y met -hoek, want
 een botsingsdoos met yaw legt zijn lokale x-as op (cos yaw, -sin yaw).
*/
import * as THREE from 'three';
import * as T from './textures.js';

const LIJN = 0.12;          // breedte van een lijn (m)
const DOEL_B = 7.32, DOEL_H = 2.44;
const CIRKEL = 9.15;        // straal middencirkel
const STRAF_D = 16.5, STRAF_B = 40.32;
const DOELGEB_D = 5.5, DOELGEB_B = 18.32;
const STIP = 11.0;
/*
 Om de hoeveel borden er weer een van Radio Spannenburg staat. De lokale omroep
 van De Fryske Marren sponsort de club, dus zijn bord komt rond het hele veld
 terug in plaats van op één plek — precies zoals een hoofdsponsor op een
 sportpark langs de lijn staat.
*/
const SPANNENBURG_STAP = 5;

// de doelpalen en de lat: één vorm, hergebruikt voor alle acht doelen
const paalGeo = new THREE.CylinderGeometry(0.06, 0.06, DOEL_H, 8);
const latGeo = new THREE.BoxGeometry(0.12, 0.12, DOEL_B);

/*
 Eén materiaalset voor alle velden samen. De borden krijgen elk hun eigen doek,
 maar het zijn er zes die om beurten langs het veld gaan — zo staat er niet
 twee keer hetzelfde bord naast elkaar en kost het toch niet meer dan zes
 texturen.
*/
function materialen() {
  const wit = new THREE.MeshStandardMaterial({ color: 0xf2f4f0, roughness: 0.85 });
  return {
    lijn: new THREE.MeshBasicMaterial({ color: 0xf4f6f2 }),
    paal: wit,
    net: new THREE.MeshStandardMaterial({ map: T.doelnet(), transparent: true, alphaTest: 0.25, side: THREE.DoubleSide, roughness: 0.9, depthWrite: false }),
    vanger: new THREE.MeshStandardMaterial({ map: T.ballenvanger(), transparent: true, alphaTest: 0.2, side: THREE.DoubleSide, roughness: 0.9, depthWrite: false }),
    staal: new THREE.MeshStandardMaterial({ color: 0x6f757c, roughness: 0.5, metalness: 0.45 }),
    hek: new THREE.MeshStandardMaterial({ map: T.spijlenhek('#4c5a4e'), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.3 }),
    dugout: new THREE.MeshStandardMaterial({ color: 0x2c3138, roughness: 0.7, metalness: 0.2 }),
    ruit: new THREE.MeshStandardMaterial({ color: 0xbcd2dc, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
    bank: new THREE.MeshStandardMaterial({ color: 0xd8552f, roughness: 0.8 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xd8dde2, emissive: 0x2a2f34, roughness: 0.35, metalness: 0.5 }),
    borden: [0, 1, 2, 3, 4, 5].map(i => new THREE.MeshStandardMaterial({ map: T.reclamebord(i), roughness: 0.55, side: THREE.DoubleSide })),
    spannenburg: new THREE.MeshStandardMaterial({ map: T.bordSpannenburg(), roughness: 0.5, side: THREE.DoubleSide }),
    achterkant: new THREE.MeshStandardMaterial({ color: 0x9aa1a8, roughness: 0.9 }),
  };
}

/*
 Een staand vlak waarvan de texture per meter herhaalt. Een PlaneGeometry legt
 zijn texture standaard één keer over het hele vlak; op een ballenvanger van
 zesenzeventig bij zes meter wordt een net van twaalf centimeter dan een paar
 brede balken. De mazen van de ballenvanger en het doelnet zijn op één
 meter per herhaling getekend, het spijlenhek op 2,5 bij 2 m; `mx` en `my` zeggen
 hoeveel meter één herhaling beslaat.
*/
function gaasGeo(breed, hoog, mx = 1, my = 1) {
  const g = new THREE.PlaneGeometry(breed, hoog);
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * breed / mx, uv.getY(i) * hoog / my);
  uv.needsUpdate = true;
  return g;
}

/*
 Alles wat op een sportpark staat samenvoegen per materiaal. Vier velden met
 hun doelen, hun palen en een ring van honderdtwintig reclameborden zijn samen
 ruim vierhonderd losse meshes, en dat zijn vierhonderd draw calls per beeld.
 Per materiaal één mesh maakt er vijftien van. `bak` verzamelt de hoekpunten,
 `voegToe` zet er een vorm in op zijn plek in de wereld.
*/
function bak() { return { pos: [], uv: [], nor: [] }; }

const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _nm = new THREE.Matrix3();
function voegToe(b, geo, m) {
  const pos = geo.getAttribute('position'), nor = geo.getAttribute('normal'), uv = geo.getAttribute('uv');
  const idx = geo.getIndex();
  _nm.getNormalMatrix(m);
  const zet = (i) => {
    _v.fromBufferAttribute(pos, i).applyMatrix4(m);
    b.pos.push(_v.x, _v.y, _v.z);
    if (nor) { _n.fromBufferAttribute(nor, i).applyMatrix3(_nm).normalize(); b.nor.push(_n.x, _n.y, _n.z); }
    else b.nor.push(0, 1, 0);
    if (uv) b.uv.push(uv.getX(i), uv.getY(i)); else b.uv.push(0, 0);
  };
  if (idx) for (let i = 0; i < idx.count; i++) zet(idx.getX(i));
  else for (let i = 0; i < pos.count; i++) zet(i);
}

/**
 * Bouwt alle sportvelden uit js/kaart.js.
 * @param scene Three-scene
 * @param W de lijsten uit world.js (addCollider)
 * @param velden KAART.sportvelden
 * @param grondY hoogte van de ondergrond (de velden liggen op stoephoogte)
 */
export function bouwSportvelden(scene, W, velden, grondY = 0.12) {
  if (!velden || !velden.length) return;
  const M = materialen();
  const groep = new THREE.Group();
  groep.name = 'sportvelden';

  // alle belijning van alle velden in één mesh: het zijn platte vlakjes zonder
  // schaduw, dus dat scheelt een draw call per veld
  const lijnPos = [];
  /*
   De maaibanen. Dat is het eerste wat je van een afstand van een veld ziet, en
   ze horen in de lengterichting te lopen. Ze kunnen niet in de texture van de
   ondergrond zitten, want die krijgt zijn uv uit de wereldcoördinaten en de
   velden liggen schuin; daarom liggen ze hier als losse banen over het veld,
   om en om iets lichter en iets donkerder.
  */
  const baanLicht = [], baanDonker = [];
  // één bak per materiaal; aan het eind wordt er per bak één mesh van gemaakt
  const B = {
    paal: bak(), net: bak(), vanger: bak(), staal: bak(), hek: bak(),
    dugout: bak(), ruit: bak(), bank: bak(), lamp: bak(), achterkant: bak(),
    borden: M.borden.map(() => bak()), spannenburg: bak(),
  };
  /*
   Welk bord is dit er een? Om de zoveel staat Radio Spannenburg langs de lijn;
   de rest gaat de zes gewone doeken langs. Die krijgen een eigen teller, want
   met `n % 6` over álle borden vielen de overgeslagen nummers weg en stonden er
   steeds dezelfde twee kleuren naast elkaar.
  */
  let gewoon = 0;
  const bordBak = (n) => (n % SPANNENBURG_STAP === 2 ? B.spannenburg : B.borden[gewoon++ % B.borden.length]);
  // een vorm op zijn plek in de wereld zetten: eerst lokaal draaien en
  // verschuiven, dan het veld in
  const mat = new THREE.Matrix4(), hulp = new THREE.Matrix4();
  const plaats = (x, y, z, draaiY = 0, draaiX = 0) => {
    mat.makeRotationY(draaiY);
    if (draaiX) mat.multiply(hulp.makeRotationX(draaiX));
    mat.setPosition(x, y, z);
    return mat;
  };

  for (const V of velden) {
    const ex = Math.cos(V.hoek), ez = Math.sin(V.hoek);
    // lokaal (u langs het veld, v dwars) naar de wereld
    const wx = (u, v) => V.cx + ex * u - ez * v;
    const wz = (u, v) => V.cz + ez * u + ex * v;
    const hl = V.vl / 2, hb = V.vb / 2;

    // ---- maaibanen ----
    {
      const breed = 5.0;
      const n = Math.round(V.vl / breed);
      for (let i = 0; i < n; i++) {
        const u0 = -hl + i * (V.vl / n), u1 = u0 + V.vl / n;
        const h = [[u0, -hb], [u1, -hb], [u1, hb], [u0, hb]].map(([u, v]) => [wx(u, v), grondY + 0.008, wz(u, v)]);
        const uit = i % 2 ? baanLicht : baanDonker;
        for (const [a, b, c] of [[0, 2, 1], [0, 3, 2]]) for (const k of [a, b, c]) uit.push(...h[k]);
      }
    }

    // ---- belijning ----
    const balk = (u0, v0, u1, v1, dik = LIJN) => {
      const du = u1 - u0, dv = v1 - v0, L = Math.hypot(du, dv);
      if (L < 1e-3) return;
      const nu = -dv / L * dik / 2, nv = du / L * dik / 2;
      const hoeken = [[u0 - nu, v0 - nv], [u1 - nu, v1 - nv], [u1 + nu, v1 + nv], [u0 + nu, v0 + nv]];
      const p = hoeken.map(([u, v]) => [wx(u, v), grondY + 0.015, wz(u, v)]);
      // met de klok mee gezien van boven: dan wijst de normaal omhoog
      lijnPos.push(...p[0], ...p[2], ...p[1], ...p[0], ...p[3], ...p[2]);
    };
    const boog = (cu, cv, r, van, tot, n = 28) => {
      let vu = cu + Math.cos(van) * r, vv = cv + Math.sin(van) * r;
      for (let i = 1; i <= n; i++) {
        const a = van + (tot - van) * i / n;
        const nu2 = cu + Math.cos(a) * r, nv2 = cv + Math.sin(a) * r;
        balk(vu, vv, nu2, nv2); vu = nu2; vv = nv2;
      }
    };
    // zijlijnen, doellijnen en de middenlijn
    balk(-hl, -hb, hl, -hb); balk(-hl, hb, hl, hb);
    balk(-hl, -hb, -hl, hb); balk(hl, -hb, hl, hb);
    balk(0, -hb, 0, hb);
    boog(0, 0, CIRKEL, 0, Math.PI * 2, 44);
    balk(-0.15, 0, 0.15, 0, 0.3);                       // middenstip
    for (const s of [-1, 1]) {
      const gb = Math.min(STRAF_B, V.vb - 2) / 2, gd = Math.min(STRAF_D, V.vl / 2 - 6);
      balk(s * hl, -gb, s * (hl - gd), -gb); balk(s * hl, gb, s * (hl - gd), gb);
      balk(s * (hl - gd), -gb, s * (hl - gd), gb);
      const db = Math.min(DOELGEB_B, V.vb - 2) / 2;
      balk(s * hl, -db, s * (hl - DOELGEB_D), -db); balk(s * hl, db, s * (hl - DOELGEB_D), db);
      balk(s * (hl - DOELGEB_D), -db, s * (hl - DOELGEB_D), db);
      const su = s * (hl - STIP);
      balk(su - 0.15, 0, su + 0.15, 0, 0.3);            // strafschopstip
      // de boog van het strafschopgebied, alleen het stuk buiten de lijn
      boog(su, 0, CIRKEL, s > 0 ? Math.PI * 0.64 : -Math.PI * 0.36, s > 0 ? Math.PI * 1.36 : Math.PI * 0.36, 18);
      for (const t of [-1, 1]) boog(s * hl, t * hb, 1.0, 0, Math.PI * 2, 10);   // hoekcirkels
    }

    // ---- doelen ----
    if (V.doelen) for (const s of [-1, 1]) {
      const halve = DOEL_B / 2, diep = 1.6, draai = -V.hoek;
      // lokaal (u langs het veld, v dwars) naar de wereld, met de doellijn als nul
      const dw = (du, dv) => [wx(s * hl + du, dv), wz(s * hl + du, dv)];
      for (const t of [-1, 1]) {
        const [px, pz] = dw(0, t * halve);
        voegToe(B.paal, paalGeo, plaats(px, grondY + DOEL_H / 2, pz, draai));
        // je loopt niet door een doelpaal heen, maar wel onder de lat door
        W.addCollider(px, pz, 0.08, 0.08, draai, DOEL_H);
      }
      const [lx, lz] = dw(0, 0);
      voegToe(B.paal, latGeo, plaats(lx, grondY + DOEL_H, lz, draai));
      /*
       Het net hangt áchter het doel, dus buiten het speelveld. Dat stond
       verkeerd om: `dw` telt zijn eerste getal bij de doellijn s * hl op, en met
       -s * diep kwam het net het veld ín te hangen — het doel stond met zijn rug
       naar de goede kant. Naar buiten is dezelfde kant op als s.
      */
      const [ax, az] = dw(s * diep, 0);
      voegToe(B.net, gaasGeo(DOEL_B, DOEL_H + 0.4), plaats(ax, grondY + (DOEL_H + 0.4) / 2, az, draai + Math.PI / 2));
      for (const t of [-1, 1]) {
        const [zx, zz] = dw(s * diep / 2, t * halve);
        voegToe(B.net, gaasGeo(diep, DOEL_H), plaats(zx, grondY + DOEL_H / 2, zz, draai));
      }
      const [dx, dz] = dw(s * diep / 2, 0);
      voegToe(B.net, gaasGeo(diep, DOEL_B), plaats(dx, grondY + DOEL_H, dz, draai, -Math.PI / 2));
    }

    // ---- reclameborden ----
    if (V.reclame) {
      const bordL = 3.0, bordH = 0.9, af = 1.6;      // achter de zijlijn
      const ru = hl + af, rv = hb + af;
      const zijden = [
        { a: [-ru, -rv], b: [ru, -rv] }, { a: [ru, rv], b: [-ru, rv] },
        { a: [ru, -rv], b: [ru, rv] }, { a: [-ru, rv], b: [-ru, -rv] },
      ];
      let n = 0;
      for (const zij of zijden) {
        const du = zij.b[0] - zij.a[0], dv = zij.b[1] - zij.a[1], L = Math.hypot(du, dv);
        const aantal = Math.max(1, Math.round(L / bordL));
        const stap = L / aantal;
        for (let i = 0; i < aantal; i++) {
          const t0 = (i + 0.5) * stap / L;
          const u = zij.a[0] + du * t0, v = zij.a[1] + dv * t0;
          const hoek = Math.atan2(dv, du);
          // de voorkant kijkt naar het veld toe
          const naarVeld = Math.atan2(-v, -u);
          const draai = -(V.hoek + hoek) + (Math.cos(naarVeld - hoek - Math.PI / 2) < 0 ? Math.PI : 0);
          const bx = wx(u, v), bz = wz(u, v);
          const vlak = new THREE.PlaneGeometry(stap - 0.06, bordH);
          voegToe(bordBak(n), vlak,
            plaats(bx + Math.sin(draai) * 0.03, grondY + bordH / 2, bz + Math.cos(draai) * 0.03, draai));
          voegToe(B.achterkant, vlak,
            plaats(bx - Math.sin(draai) * 0.03, grondY + bordH / 2, bz - Math.cos(draai) * 0.03, draai + Math.PI));
          W.addCollider(bx, bz, stap / 2, 0.1, -(V.hoek + hoek), bordH);
          n++;
        }
      }
    }

    // ---- ballenvanger achter de doelen en een laag hek langs de kant ----
    if (V.hek) {
      const vu = hl + (V.reclame ? 4.5 : 3.0), vv = hb + (V.reclame ? 4.5 : 3.0);
      const vangerH = 6.0;
      for (const s of [-1, 1]) {
        const breed = Math.min(V.vb + 8, V.b - 1);
        voegToe(B.vanger, gaasGeo(breed, vangerH),
          plaats(wx(s * vu, 0), grondY + vangerH / 2, wz(s * vu, 0), -V.hoek + Math.PI / 2));
        const staafGeo = new THREE.CylinderGeometry(0.07, 0.07, vangerH, 8);
        for (let t = -breed / 2; t <= breed / 2 + 0.01; t += breed / 6) {
          voegToe(B.staal, staafGeo, plaats(wx(s * vu, t), grondY + vangerH / 2, wz(s * vu, t), 0));
        }
        W.addCollider(wx(s * vu, 0), wz(s * vu, 0), 0.1, breed / 2, -V.hoek, vangerH);
      }
      // spijlenhek langs de lange kanten; de texture is 2,5 bij 2 m, dus het
      // hek is precies zo hoog als het doek en herhaalt om de 2,5 m
      const hekH = 2.0, lang = Math.min(V.vl + 6, V.l - 1);
      for (const t of [-1, 1]) {
        voegToe(B.hek, gaasGeo(lang, hekH, 2.5, 2.0),
          plaats(wx(0, t * vv), grondY + hekH / 2, wz(0, t * vv), -V.hoek));
        W.addCollider(wx(0, t * vv), wz(0, t * vv), lang / 2, 0.08, -V.hoek, hekH);
      }
    }

    // ---- dugouts ----
    if (V.dugouts) for (const i of [-1, 1]) {
      const b = 6.0, d = 1.8, h = 2.0;
      const u = i * 12, v = -(hb + 3.0), draai = -V.hoek;
      const ox = wx(u, v), oz = wz(u, v);
      // lokaal in de dugout: x langs de bank, z naar het veld toe
      const lok = (lx, ly, lz) => plaats(ox + Math.cos(draai) * lx + Math.sin(draai) * lz, grondY + ly,
        oz - Math.sin(draai) * lx + Math.cos(draai) * lz, draai);
      voegToe(B.dugout, new THREE.BoxGeometry(b, h, 0.12), lok(0, h / 2, -d / 2));
      for (const s of [-1, 1]) voegToe(B.ruit, new THREE.BoxGeometry(0.1, h, d), lok(s * b / 2, h / 2, 0));
      voegToe(B.dugout, new THREE.BoxGeometry(b + 0.3, 0.12, d + 0.3), lok(0, h, 0));
      voegToe(B.bank, new THREE.BoxGeometry(b - 0.4, 0.1, 0.45), lok(0, 0.45, -d / 4));
      W.addCollider(ox, oz, b / 2, d / 2, draai, h);
    }

    // ---- lichtmasten ----
    for (let i = 0; i < (V.masten || 0); i++) {
      const u = (i % 2 ? 1 : -1) * (hl - 6), v = (i < 2 ? -1 : 1) * (hb + 6);
      const h = 18;
      const draai = -Math.atan2(-v, -u) - V.hoek;
      const mx = wx(u, v), mz = wz(u, v);
      voegToe(B.staal, new THREE.CylinderGeometry(0.16, 0.3, h, 10), plaats(mx, grondY + h / 2, mz, draai));
      voegToe(B.lamp, new THREE.BoxGeometry(2.6, 0.9, 0.35),
        plaats(mx + Math.sin(draai) * 0.25, grondY + h - 0.4, mz + Math.cos(draai) * 0.25, draai));
      W.addCollider(mx, mz, 0.32, 0.32, 0, h);
    }
  }

  const plat = (pos, mat, klasse, volgorde) => {
    if (!pos.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.klasse = klasse;
    mesh.renderOrder = volgorde;
    groep.add(mesh);
  };
  plat(baanLicht, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.09, depthWrite: false }), 'maaibaan', 1);
  plat(baanDonker, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.07, depthWrite: false }), 'maaibaan', 1);
  plat(lijnPos, M.lijn, 'veldlijn', 2);

  // en van elke bak één mesh
  const stukken = [
    [B.paal, M.paal, 'doelpaal'], [B.net, M.net, 'doelnet'], [B.vanger, M.vanger, 'ballenvanger'],
    [B.staal, M.staal, 'sportpaal'], [B.hek, M.hek, 'sporthek'], [B.dugout, M.dugout, 'dugout'],
    [B.ruit, M.ruit, 'dugoutruit'], [B.bank, M.bank, 'dugoutbank'], [B.lamp, M.lamp, 'lichtmast'],
    [B.achterkant, M.achterkant, 'reclameachter'],
    [B.spannenburg, M.spannenburg, 'reclamebordSpannenburg'],
    ...B.borden.map((b, i) => [b, M.borden[i], 'reclamebord']),
  ];
  for (const [b, materiaal, klasse] of stukken) {
    if (!b.pos.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
    const m = new THREE.Mesh(geo, materiaal);
    m.castShadow = true; m.receiveShadow = true; m.userData.klasse = klasse;
    groep.add(m);
  }
  scene.add(groep);
}
