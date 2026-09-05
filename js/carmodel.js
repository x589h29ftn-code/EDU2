/*
 Automodellen, samengevoegd per materiaal zodat een auto weinig draw calls kost.
 Er staan er 329 geparkeerd in de wijk, dus elke extra mesh per auto telt zwaar
 mee; de vorm mag daarentegen zoveel driehoeken hebben als hij nodig heeft,
 want de geometrie wordt per soort maar één keer gemaakt en daarna gedeeld.

 Vandaar twee uitvoeringen:

   stil       zeven meshes: lak, glas, zwart (met de banden erin), chroom (met
              de naafdoppen erin), koplampen, achterlichten en de kentekenplaat.
              Dat is de auto zoals hij geparkeerd staat.
   animatie   de wielen zitten los in eigen groepjes, zodat de voorwielen kunnen
              sturen en alle vier kunnen rollen; de carrosserie hangt in een
              tussengroep die kan overhellen in de bocht en duiken bij het
              remmen; en er zijn losse rem- en achteruitrijlichten. Die krijgt
              alleen de auto waar je in stapt (zie js/vehicles.js).
*/
import * as THREE from 'three';

function merge(parts) {
  const pos = [], nor = [], uv = [];
  for (const { geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 } of parts) {
    const g = geo.clone();
    if (rx || ry || rz) g.rotateX(rx), g.rotateY(ry), g.rotateZ(rz);
    g.translate(x, y, z);
    const ng = g.index ? g.toNonIndexed() : g;
    pos.push(...ng.attributes.position.array);
    nor.push(...ng.attributes.normal.array);
    if (ng.attributes.uv) uv.push(...ng.attributes.uv.array); else for (let i = 0; i < ng.attributes.position.count; i++) uv.push(0, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
const doos = (b, h, d) => new THREE.BoxGeometry(b, h, d);

// Een wielkast: een halve ring die om het wiel heen staat, in de lengterichting
// van de auto. Dat is wat een auto van een schoenendoos onderscheidt.
function wielkast(R) {
  const g = new THREE.TorusGeometry(R + 0.07, 0.05, 4, 10, Math.PI);
  g.rotateY(Math.PI / 2);
  return g;
}

const GEO = {};

// Bakwagen: chassis met cabine voorop en een gesloten laadbak erachter. Zeven
// meter lang, dus hij rijdt en botst anders dan een auto (zie vehicles.js).
function truckGeoms() {
  const L = 7.2, W = 2.35, R = 0.45;      // lengte, breedte, wielradius
  const cabZ = -L / 2 + 1.15, bakZ = 1.0;
  const paint = merge([
    { geo: doos(W - 0.1, 0.35, L), y: 0.62 },                     // chassis
    { geo: doos(W, 1.45, 2.1), y: 1.52, z: cabZ },                // cabine
    { geo: doos(W - 0.14, 0.3, 1.9), y: 2.35, z: cabZ + 0.05 },   // dakspoiler
    { geo: doos(W, 2.3, 4.8), y: 2.15, z: bakZ },                 // laadbak
    { geo: doos(W + 0.06, 0.12, 4.8), y: 3.32, z: bakZ },         // dakrand
    { geo: doos(0.2, 0.1, 0.14), x: -W / 2 - 0.12, y: 1.9, z: cabZ - 0.9 },
    { geo: doos(0.2, 0.1, 0.14), x: W / 2 + 0.12, y: 1.9, z: cabZ - 0.9 },
  ]);
  const glass = merge([
    { geo: doos(W - 0.22, 0.8, 0.06), y: 1.95, z: cabZ - 1.03 },  // voorruit
    { geo: doos(0.06, 0.65, 1.1), x: -W / 2 + 0.02, y: 1.9, z: cabZ + 0.2 },
    { geo: doos(0.06, 0.65, 1.1), x: W / 2 - 0.02, y: 1.9, z: cabZ + 0.2 },
  ]);
  const wielGeo = new THREE.CylinderGeometry(R, R, 0.3, 14); wielGeo.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.32, 8); hubGeo.rotateZ(Math.PI / 2);
  const wielen = [
    { x: -W / 2 + 0.18, z: cabZ + 0.1, stuur: true }, { x: W / 2 - 0.18, z: cabZ + 0.1, stuur: true },
    { x: -W / 2 + 0.18, z: 1.5 }, { x: W / 2 - 0.18, z: 1.5 },
    { x: -W / 2 + 0.18, z: 2.6 }, { x: W / 2 - 0.18, z: 2.6 },
  ];
  const zwartVast = [
    { geo: doos(W + 0.04, 0.24, 0.22), y: 0.5, z: -L / 2 + 0.05 },
    { geo: doos(W + 0.04, 0.24, 0.22), y: 0.62, z: L / 2 - 0.05 },
    { geo: doos(1.2, 0.5, 0.06), y: 1.0, z: -L / 2 - 0.01 },      // grille
    { geo: doos(0.16, 0.16, 0.5), x: -W / 2 + 0.3, y: 0.42, z: L / 2 - 0.6 },   // uitlaat
  ];
  const head = merge([
    { geo: doos(0.4, 0.2, 0.05), x: -0.75, y: 0.78, z: -L / 2 - 0.02 },
    { geo: doos(0.4, 0.2, 0.05), x: 0.75, y: 0.78, z: -L / 2 - 0.02 },
  ]);
  const achter = [
    { geo: doos(0.34, 0.18, 0.05), x: -0.85, y: 0.9, z: L / 2 + 0.02 },
    { geo: doos(0.34, 0.18, 0.05), x: 0.85, y: 0.9, z: L / 2 + 0.02 },
  ];
  const plate = merge([{ geo: doos(0.5, 0.11, 0.02), y: 0.72, z: L / 2 + 0.04 }]);
  const rem = merge(achter.map(a => ({ ...a, z: a.z + 0.01 })));
  const achteruit = merge([
    { geo: doos(0.2, 0.14, 0.05), x: -0.45, y: 0.9, z: L / 2 + 0.03 },
    { geo: doos(0.2, 0.14, 0.05), x: 0.45, y: 0.9, z: L / 2 + 0.03 },
  ]);
  // oogpunt van de bestuurder: net vóór de voorruit, zodat je niet door twee
  // getinte glasplaten naar buiten kijkt (zie js/main.js)
  // in de cabine, vlak achter de voorruit: de cabine is één doos, dus vanbinnen
  // zie je er niets van en heb je vrij zicht over de weg
  const oog = { x: -(W / 2 - 0.6), y: 1.98, z: cabZ - 0.85 };
  return { paint, glass, zwartVast, chroomVast: [], head, tail: merge(achter), rem, achteruit, plate,
    wielGeo, hubGeo, wielen, R, L, W, oog };
}

/*
 Personenauto. De vorm is opgebouwd uit lagen die naar boven toe smaller worden
 — dorpel, flank, schouderlijn, motorkap, kofferklep en dak — met schuine
 stijlen ertussen en wielkasten om de wielen. Daardoor heeft hij een taille en
 een aflopende neus in plaats van de rechte doos van hiervoor.
*/
function autoGeoms(kind) {
  const bus = kind === 'van';
  const L = bus ? 5.20 : 4.30, W = bus ? 1.90 : 1.78, R = bus ? 0.35 : 0.32;
  const wielZ = bus ? 1.62 : 1.32, wielX = W / 2 - 0.09;
  const dorpelY = 0.30 + R * 0.42;

  // hoogtes: dorpel → flank → schouder → dak
  const flankY = bus ? 1.02 : 0.72, flankH = bus ? 0.84 : 0.30;
  const schouderY = bus ? 1.50 : 0.90;
  const dakY = bus ? 2.02 : 1.40;
  const cabZ = bus ? -0.60 : 0.10;              // midden van de cabine
  const cabL = bus ? 2.30 : 1.95;               // lengte van de cabine
  const kapZ = -L / 2 + (bus ? 0.55 : 0.80), kapL = bus ? 1.00 : 1.55;
  const kontZ = L / 2 - (bus ? 1.10 : 0.55), kontL = bus ? 2.10 : 1.05;

  const lak = [
    { geo: doos(W - 0.10, R * 0.84, L - 0.34), y: dorpelY },                        // dorpel
    { geo: doos(W, flankH, L - 0.12), y: flankY },                                  // flank, breedste punt
    { geo: doos(W - 0.09, 0.10, L - 0.40), y: schouderY - 0.05 },                   // schouderlijn
    { geo: doos(W - 0.20, 0.11, kapL), y: schouderY + (bus ? 0.30 : 0.02), z: kapZ }, // motorkap
    { geo: doos(W - 0.14, 0.20, kontL), y: schouderY + 0.09, z: kontZ },            // kofferklep
    { geo: doos(W - (bus ? 0.20 : 0.40), 0.07, cabL - (bus ? 0.10 : 0.55)), y: dakY, z: cabZ }, // dak
    // spiegels op een steeltje
    { geo: doos(0.09, 0.05, 0.05), x: -W / 2 - 0.05, y: schouderY + 0.16, z: cabZ - cabL / 2 + 0.15 },
    { geo: doos(0.09, 0.05, 0.05), x: W / 2 + 0.05, y: schouderY + 0.16, z: cabZ - cabL / 2 + 0.15 },
    { geo: doos(0.17, 0.11, 0.07), x: -W / 2 - 0.13, y: schouderY + 0.17, z: cabZ - cabL / 2 + 0.15 },
    { geo: doos(0.17, 0.11, 0.07), x: W / 2 + 0.13, y: schouderY + 0.17, z: cabZ - cabL / 2 + 0.15 },
  ];
  // stijlen: A schuin naar voren, C schuin naar achteren, B recht in het midden
  const stijlH = dakY - schouderY;
  const aHoek = bus ? 0.34 : 0.62, cHoek = bus ? -0.16 : -0.50;
  for (const zx of [-1, 1]) {
    const x = zx * (W / 2 - (bus ? 0.10 : 0.20));
    lak.push({ geo: doos(0.09, stijlH + 0.16, 0.10), x, y: (schouderY + dakY) / 2, z: cabZ - cabL / 2 + 0.30 - Math.sin(aHoek) * stijlH / 2, rx: aHoek });
    lak.push({ geo: doos(0.09, stijlH + 0.14, 0.12), x, y: (schouderY + dakY) / 2, z: cabZ + cabL / 2 - 0.24 - Math.sin(cHoek) * stijlH / 2, rx: cHoek });
    lak.push({ geo: doos(0.07, stijlH, 0.08), x, y: (schouderY + dakY) / 2, z: cabZ + (bus ? 0.30 : 0.18) });
  }
  if (!bus) lak.push({ geo: doos(W - 0.55, 0.05, 0.16), y: dakY + 0.02, z: cabZ + cabL / 2 - 0.30 });  // dakspoiler

  const glas = [
    // voorruit en achterruit staan schuin tussen de schouderlijn en het dak
    { geo: doos(W - (bus ? 0.24 : 0.42), stijlH / Math.cos(aHoek) + 0.10, 0.05),
      y: (schouderY + dakY) / 2 + 0.03, z: cabZ - cabL / 2 + 0.30 - Math.sin(aHoek) * stijlH / 2, rx: aHoek },
    { geo: doos(W - (bus ? 0.26 : 0.46), stijlH / Math.cos(cHoek) + 0.06, 0.05),
      y: (schouderY + dakY) / 2 + 0.03, z: cabZ + cabL / 2 - 0.24 - Math.sin(cHoek) * stijlH / 2, rx: cHoek },
    // zijruiten
    { geo: doos(0.05, stijlH - 0.06, cabL - (bus ? 0.35 : 0.85)), x: -W / 2 + 0.10, y: (schouderY + dakY) / 2 + 0.02, z: cabZ + 0.02 },
    { geo: doos(0.05, stijlH - 0.06, cabL - (bus ? 0.35 : 0.85)), x: W / 2 - 0.10, y: (schouderY + dakY) / 2 + 0.02, z: cabZ + 0.02 },
  ];

  const zwartVast = [
    { geo: doos(W + 0.03, 0.24, 0.26), y: dorpelY + 0.06, z: -L / 2 + 0.09 },      // bumper voor
    { geo: doos(W + 0.03, 0.24, 0.26), y: dorpelY + 0.08, z: L / 2 - 0.09 },       // bumper achter
    { geo: doos(W - 0.42, 0.13, 0.06), y: schouderY - 0.13, z: -L / 2 - 0.005 },   // grille
    { geo: doos(0.07, 0.13, L - 1.5), x: -W / 2 + 0.01, y: dorpelY - 0.04 },       // sierlijst dorpel
    { geo: doos(0.07, 0.13, L - 1.5), x: W / 2 - 0.01, y: dorpelY - 0.04 },
    { geo: doos(0.10, 0.10, 0.24), x: -W / 2 + 0.34, y: dorpelY - 0.02, z: L / 2 + 0.02 },  // uitlaat
  ];
  // portiernaden: twee dunne lijnen per flank
  for (const zx of [-1, 1]) for (const dz of bus ? [-0.15, 1.35] : [-0.62, 0.62]) {
    zwartVast.push({ geo: doos(0.04, flankH + 0.16, 0.035), x: zx * (W / 2 - 0.005), y: flankY + 0.05, z: cabZ + dz });
  }
  // wielkasten rond alle vier de wielen
  const kast = wielkast(R);
  const wielen = [
    { x: -wielX, z: -wielZ, stuur: true }, { x: wielX, z: -wielZ, stuur: true },
    { x: -wielX, z: wielZ }, { x: wielX, z: wielZ },
  ];
  for (const w of wielen) zwartVast.push({ geo: kast, x: w.x + Math.sign(w.x) * 0.02, y: R, z: w.z });

  const chroomVast = [
    { geo: doos(0.11, 0.035, 0.05), x: -W / 2 - 0.01, y: flankY + 0.12, z: cabZ - 0.32 },   // portiergrepen
    { geo: doos(0.11, 0.035, 0.05), x: W / 2 + 0.01, y: flankY + 0.12, z: cabZ - 0.32 },
    { geo: doos(0.11, 0.035, 0.05), x: -W / 2 - 0.01, y: flankY + 0.12, z: cabZ + 0.92 },
    { geo: doos(0.11, 0.035, 0.05), x: W / 2 + 0.01, y: flankY + 0.12, z: cabZ + 0.92 },
  ];

  const wielGeo = new THREE.CylinderGeometry(R, R, 0.22, 14); wielGeo.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(R * 0.58, R * 0.58, 0.23, 8); hubGeo.rotateZ(Math.PI / 2);

  const kopY = schouderY - 0.14;
  const head = merge([
    { geo: doos(0.40, 0.15, 0.06), x: -W / 2 + 0.26, y: kopY, z: -L / 2 - 0.005 },
    { geo: doos(0.40, 0.15, 0.06), x: W / 2 - 0.26, y: kopY, z: -L / 2 - 0.005 },
  ]);
  const achter = [
    { geo: doos(0.34, 0.17, 0.06), x: -W / 2 + 0.24, y: kopY + 0.06, z: L / 2 + 0.005 },
    { geo: doos(0.34, 0.17, 0.06), x: W / 2 - 0.24, y: kopY + 0.06, z: L / 2 + 0.005 },
  ];
  const rem = merge([
    ...achter.map(a => ({ ...a, z: a.z + 0.012 })),
    { geo: doos(W - 0.60, 0.05, 0.05), y: dakY - 0.05, z: cabZ + cabL / 2 - 0.22 },   // derde remlicht
  ]);
  const achteruit = merge([
    { geo: doos(0.16, 0.11, 0.06), x: -W / 2 + 0.60, y: kopY + 0.06, z: L / 2 + 0.012 },
    { geo: doos(0.16, 0.11, 0.06), x: W / 2 - 0.60, y: kopY + 0.06, z: L / 2 + 0.012 },
  ]);
  const plate = merge([
    { geo: doos(0.5, 0.11, 0.02), y: dorpelY + 0.16, z: L / 2 + 0.06 },
    { geo: doos(0.5, 0.11, 0.02), y: dorpelY + 0.14, z: -L / 2 - 0.06 },
  ]);

  // oogpunt van de bestuurder: net vóór de voorruit en vlak onder de dakrand.
  // Zat de camera op de stoel, dan vulde de voorruit het halve beeld met een
  // grauwe tint en hing de dakrand als een donkere balk in beeld.
  const zVoorruit = cabZ - cabL / 2 + 0.30 - Math.sin(aHoek) * stijlH / 2;
  const oog = { x: -(W / 2 - 0.55), y: dakY - 0.08, z: zVoorruit - 0.15 };
  return { paint: merge(lak), glass: merge(glas), zwartVast, chroomVast,
    head, tail: merge(achter), rem, achteruit, plate, wielGeo, hubGeo, wielen, R, L, W, oog };
}

function geoms(kind) {
  if (GEO[kind]) return GEO[kind];
  const G = kind === 'truck' ? truckGeoms() : autoGeoms(kind);
  // twee uitvoeringen van zwart en chroom: met en zonder de wielen erin
  const banden = G.wielen.map(w => ({ geo: G.wielGeo, x: w.x, y: G.R, z: w.z }));
  const naven = G.wielen.map(w => ({ geo: G.hubGeo, x: w.x, y: G.R, z: w.z }));
  G.black = merge([...G.zwartVast, ...banden]);
  G.chrome = merge([...G.chroomVast, ...naven]);
  G.blackLos = merge(G.zwartVast);
  G.chroomLos = G.chroomVast.length ? merge(G.chroomVast) : null;
  GEO[kind] = G;
  return G;
}

const SHARED = {
  glass: new THREE.MeshStandardMaterial({ color: 0x1b2630, roughness: 0.1, metalness: 0.6, transparent: true, opacity: 0.85 }),
  black: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xbbbbbb, metalness: 0.8, roughness: 0.3 }),
  head: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d0, emissiveIntensity: 0.4 }),
  tail: new THREE.MeshStandardMaterial({ color: 0xaa1111, emissive: 0xff2020, emissiveIntensity: 0.4 }),
  rem: new THREE.MeshStandardMaterial({ color: 0xff3020, emissive: 0xff2010, emissiveIntensity: 2.2 }),
  achteruit: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e0, emissiveIntensity: 1.6 }),
  plate: new THREE.MeshStandardMaterial({ color: 0xf2c400 }),
};
const paintCache = new Map();

/*
 Een stapel geparkeerde auto's van één soort als instanced meshes.

 De 329 auto's in de wijk stonden er als losse groepjes van zeven meshes: ruim
 tweeduizend objecten, en op straat waren er zeshonderd van in beeld — meer dan
 de helft van alle draw calls. Ze delen allemaal dezelfde geometrie en op de lak
 na ook dezelfde materialen, dus ze kunnen in één keer getekend worden: zeven
 InstancedMeshes per soort, met de lakkleur per instantie.

 Levert { meshes, zet(i, x, z, yaw, zichtbaar), kleur(i, hex), klaar() }.
 Een auto verbergen is hem op schaal nul zetten; dat gebeurt als je erin stapt
 (dan komt het losse model met wielen ervoor in de plaats) of als de hele wijk
 uit beeld moet (binnen, of het bovenaanzicht).
*/
export function maakAutoStapel(kind, aantal) {
  const G = geoms(kind);
  const lak = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.5 });
  const delen = [
    { geo: G.paint, mat: lak, kleurbaar: true, schaduw: true },
    { geo: G.glass, mat: SHARED.glass },
    { geo: G.black, mat: SHARED.black, schaduw: true },
    { geo: G.head, mat: SHARED.head },
    { geo: G.tail, mat: SHARED.tail },
    { geo: G.plate, mat: SHARED.plate },
  ];
  if (G.chrome) delen.push({ geo: G.chrome, mat: SHARED.chrome });
  const meshes = delen.map(d => {
    const m = new THREE.InstancedMesh(d.geo, d.mat, aantal);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.castShadow = !!d.schaduw;
    m.receiveShadow = true;
    m.frustumCulled = false;      // ze staan over de hele wijk verspreid
    m.userData.autoStapel = kind;
    return m;
  });
  const lakMesh = meshes[0];
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3();
  const kleurHulp = new THREE.Color();
  return {
    meshes, lengte: G.L,
    zet(i, x, z, yaw, zichtbaar = true) {
      P.set(x, 0, z);
      Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      S.setScalar(zichtbaar ? 1 : 0);
      M.compose(P, Q, S);
      for (const m of meshes) m.setMatrixAt(i, M);
    },
    kleur(i, hex) { lakMesh.setColorAt(i, kleurHulp.setHex(hex)); },
    klaar() {
      for (const m of meshes) m.instanceMatrix.needsUpdate = true;
      if (lakMesh.instanceColor) lakMesh.instanceColor.needsUpdate = true;
    },
  };
}

/*
 color    lakkleur
 kind     'hatch', 'van' of 'truck'
 animatie losse wielen, een kantelende carrosserie en rem- en
          achteruitrijlichten; alleen voor een auto die echt rijdt
*/
export function makeCar(color, kind = 'hatch', animatie = false) {
  const g = new THREE.Group();
  const G = geoms(kind);
  if (!paintCache.has(color)) paintCache.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 }));

  const bak = animatie ? new THREE.Group() : g;    // carrosserie, kan overhellen
  const body = new THREE.Mesh(G.paint, paintCache.get(color)); body.castShadow = true;
  const glas = new THREE.Mesh(G.glass, SHARED.glass);
  bak.add(body, glas,
    new THREE.Mesh(animatie ? G.blackLos : G.black, SHARED.black),
    new THREE.Mesh(G.head, SHARED.head),
    new THREE.Mesh(G.tail, SHARED.tail),
    new THREE.Mesh(G.plate, SHARED.plate));
  const chroom = animatie ? G.chroomLos : G.chrome;
  if (chroom) bak.add(new THREE.Mesh(chroom, SHARED.chrome));

  if (!animatie) { g.userData.length = G.L; g.userData.oog = G.oog; return g; }

  g.add(bak);
  const rem = new THREE.Mesh(G.rem, SHARED.rem); rem.visible = false; bak.add(rem);
  const achteruit = new THREE.Mesh(G.achteruit, SHARED.achteruit); achteruit.visible = false; bak.add(achteruit);
  const wielen = G.wielen.map(w => {
    const groep = new THREE.Group();
    groep.position.set(w.x, G.R, w.z);
    const band = new THREE.Mesh(G.wielGeo, SHARED.black); band.castShadow = true;
    const naaf = new THREE.Mesh(G.hubGeo, SHARED.chrome);
    groep.add(band, naaf);
    g.add(groep);
    return { groep, band, stuur: !!w.stuur };
  });
  g.userData = { length: G.L, oog: G.oog, bak, glas, wielen, rem, achteruit, R: G.R };
  return g;
}
