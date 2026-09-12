/*
 Toetst het tennispark aan de Molenkrite.

 Wat er mis kan gaan, en dus wat hier nagerekend wordt:
 1. de banen komen uit de BGT (de halfverharde grindvlakken naast het sportpark)
    en niet uit een schatting: elk blok moet met zo'n vlak samenvallen;
 2. een baan heeft een vaste maat — 23,77 × 10,97 m met uitloop eromheen. Past er
    per blok een onzinnig aantal banen in, dan klopt de as of de maat niet;
 3. het hek staat er om je tegen te houden: erdoorheen rijden mag niet, maar op
    de baan zelf mag je niet klem komen te staan;
 4. de belijning wordt op een canvas getekend; die moet wit-op-grijs zijn en niet
    leeg of egaal blijven;
 5. het park hangt aan de LOD, anders staan er tien banen met hekken en masten
    aan de andere kant van de stad mee te tekenen.

 Gebruik: python3 -m http.server 8123 &  node tools/tennistest.mjs 8123
*/
import { chromium } from 'playwright';

const port = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fouten++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });

kop('de banen komen uit de kaart');
const kaart = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const P = (KAART.tennisparken || [])[0];
  if (!P) return null;
  // bij elk blok het dichtstbijzijnde halfverharde vlak zoeken
  const blokken = P.blokken.map((b) => {
    let d = Infinity, opp = 0;
    for (const v of KAART.vlakken) {
      if (v.k !== 'halfverhard') continue;
      const r = v.r[0];
      let cx = 0, cz = 0; for (const q of r) { cx += q[0]; cz += q[1]; }
      cx /= r.length; cz /= r.length;
      const dd = Math.hypot(cx - b.cx, cz - b.cz);
      if (dd < d) {
        d = dd;
        let a = 0;
        for (let i = 0; i < r.length; i++) {
          const p = r[i], q = r[(i + 1) % r.length];
          a += p[0] * q[1] - q[0] * p[1];
        }
        opp = Math.abs(a) / 2;
      }
    }
    return { ...b, d, opp, asL: Math.hypot(b.as[0], b.as[1]) };
  });
  return { naam: P.naam, hek: P.hek, masten: P.masten, blokken, banen: P.blokken.reduce((s, b) => s + b.banen, 0) };
});
ok(!!kaart, 'het tennispark staat in de kaart', kaart ? `${kaart.naam}, ${kaart.banen} banen` : '');
ok(kaart && kaart.blokken.length >= 4, 'met de vier grindblokken uit de BGT',
  kaart ? `${kaart.blokken.length} blokken` : '');
ok(kaart && kaart.blokken.every(b => b.d < 1.0), 'en elk blok valt op zo\'n vlak',
  kaart ? `grootste afstand ${Math.max(...kaart.blokken.map(b => b.d)).toFixed(2)} m` : '');
ok(kaart && kaart.blokken.every(b => Math.abs(b.asL - 1) < 0.02), 'de as van elk blok is een eenheidsvector',
  kaart ? kaart.blokken.map(b => b.asL.toFixed(3)).join(', ') : '');

kop('de maat van een baan klopt');
// 23,77 × 10,97 m speelvlak; met uitloop is een baan ~36 × 18 m
ok(kaart && kaart.blokken.every(b => b.lengte > 24 && b.lengte < 42),
  'elk blok is lang genoeg voor een baan met uitloop',
  kaart ? kaart.blokken.map(b => b.lengte.toFixed(1)).join(' / ') + ' m' : '');
ok(kaart && kaart.blokken.every(b => b.breedte / b.banen > 14 && b.breedte / b.banen < 24),
  'en de breedte per baan ligt rond de 18 m',
  kaart ? kaart.blokken.map(b => (b.breedte / b.banen).toFixed(1)).join(' / ') + ' m' : '');
ok(kaart && kaart.blokken.every(b => b.opp / b.banen > 500),
  'er wordt geen baan op een postzegel gelegd',
  kaart ? kaart.blokken.map(b => Math.round(b.opp / b.banen)).join(' / ') + ' m²/baan' : '');

kop('het hek houdt je tegen, de baan niet');
const bots = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const W = await import('/js/world.js');
  const P = (KAART.tennisparken || [])[0];
  const b = P.blokken.slice().sort((p, q) => q.banen - p.banen)[0];
  const l = Math.hypot(b.as[0], b.as[1]);
  const ax = b.as[0] / l, az = b.as[1] / l, bx = -az, bz = ax;
  const duw = (x, z, straal = 0.9) => {
    const [nx, nz] = W.resolveCollisions(x, z, straal);
    return Math.hypot(nx - x, nz - z);
  };
  return {
    // pal op de lange hekkant
    hekLang: +duw(b.cx + bx * (b.breedte / 2), b.cz + bz * (b.breedte / 2)).toFixed(2),
    // pal op de korte hekkant
    hekKort: +duw(b.cx + ax * (b.lengte / 2), b.cz + az * (b.lengte / 2)).toFixed(2),
    // midden op de baan
    midden: +duw(b.cx, b.cz).toFixed(2),
    // een eind buiten het hek
    buiten: +duw(b.cx + bx * (b.breedte / 2 + 6), b.cz + bz * (b.breedte / 2 + 6)).toFixed(2),
  };
});
ok(bots.hekLang > 0.4, 'door de lange hekkant rijd je niet heen', `${bots.hekLang} m weggeduwd`);
ok(bots.hekKort > 0.4, 'door de korte hekkant ook niet', `${bots.hekKort} m weggeduwd`);
ok(bots.midden < 0.05, 'maar midden op de baan sta je vrij', `${bots.midden} m`);
ok(bots.buiten < 0.05, 'en buiten het hek ook', `${bots.buiten} m`);

kop('de belijning staat op het doek');
const doek = await page.evaluate(async () => {
  const T = await import('/js/tennis.js');
  const { KAART } = await import('/js/kaart.js');
  const P = (KAART.tennisparken || [])[0];
  const b = P.blokken.slice().sort((p, q) => q.banen - p.banen)[0];
  // dezelfde tekening, maar op een eigen canvas zodat we de beeldpunten kunnen lezen
  const t = T.__baanDoek(b.lengte, b.breedte, b.banen);
  const c = t.image;
  const g = c.getContext('2d');
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let wit = 0, gravel = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gg = d[i + 1], bb = d[i + 2];
    if (r > 225 && gg > 225 && bb > 220) wit++;
    // roodbruin: rood duidelijk boven groen, groen weer boven blauw
    else if (r > gg + 25 && gg > bb + 5 && r > 90 && r < 235) gravel++;
  }
  const n = d.length / 4;
  return { breedte: c.width, hoogte: c.height, witDeel: wit / n, gravelDeel: gravel / n };
});
ok(doek.witDeel > 0.004 && doek.witDeel < 0.08, 'er staat witte belijning op, maar geen witte vlakte',
  `${(doek.witDeel * 100).toFixed(2)}% wit`);
ok(doek.gravelDeel > 0.7, 'en de rest is roodbruin gravel',
  `${(doek.gravelDeel * 100).toFixed(1)}% gravel`);

kop('de baan ligt zoals de kaart hem beschrijft');
/*
 Een groep draait om zijn plaatselijke z-as; de baanvloer wordt langs de
 plaatselijke x-as gebouwd. Zet je die kwartslag verkeerd, dan staat het blok
 dwars en ligt de baan over het pad ernaast — en dat zie je niet aan de maat,
 alleen aan de plek van de hoeken. Dus: de hoek van de vloer in de wereld
 nameten en vergelijken met wat de kaart zegt.
*/
const hoeken = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const W = await import('/js/world.js');
  const P = (KAART.tennisparken || [])[0];
  const b = P.blokken.slice().sort((p, q) => q.banen - p.banen)[0];
  W.updateLOD(b.cx, b.cz);
  const groep = window.__game.scene.children.find(o => o.isGroup
    && Math.hypot(o.position.x - b.cx, o.position.z - b.cz) < 2);
  if (!groep) return null;
  const vloer = groep.children.find(c => c.geometry && c.geometry.type === 'PlaneGeometry'
    && Math.abs(c.rotation.x + Math.PI / 2) < 0.01);
  groep.updateWorldMatrix(true, true);
  vloer.geometry.computeBoundingBox();
  const bb = vloer.geometry.boundingBox;
  const hoek = bb.max.clone();                       // hoek (+x, +y) van het vlak
  vloer.localToWorld(hoek);
  const l = Math.hypot(b.as[0], b.as[1]);
  const ax = b.as[0] / l, az = b.as[1] / l;
  // die hoek uitdrukken langs de as en er dwars op: dat moet een halve lengte
  // en een halve breedte zijn, en niet andersom
  const dx = hoek.x - b.cx, dz = hoek.z - b.cz;
  return {
    langs: Math.abs(dx * ax + dz * az),
    dwars: Math.abs(dx * -az + dz * ax),
    lengte: b.lengte, breedte: b.breedte,
  };
});
ok(!!hoeken, 'de baanvloer staat in de scene');
ok(hoeken && Math.abs(hoeken.langs - hoeken.lengte / 2) < 0.5,
  'de baanlengte ligt langs de as van het blok',
  hoeken ? `${hoeken.langs.toFixed(1)} m, verwacht ${(hoeken.lengte / 2).toFixed(1)}` : '');
ok(hoeken && Math.abs(hoeken.dwars - hoeken.breedte / 2) < 0.5,
  'en de rij banen er dwars op',
  hoeken ? `${hoeken.dwars.toFixed(1)} m, verwacht ${(hoeken.breedte / 2).toFixed(1)}` : '');

kop('het park hangt aan de LOD');
const lod = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const W = await import('/js/world.js');
  const P = (KAART.tennisparken || [])[0];
  const b = P.blokken[0];
  const groepen = window.__game.scene.children.filter(o => o.isGroup
    && Math.hypot(o.position.x - b.cx, o.position.z - b.cz) < 2);
  const zoek = () => ({
    aan: groepen.filter(o => o.visible).length,
    uit: groepen.filter(o => !o.visible).length,
  });
  W.updateLOD(b.cx, b.cz);
  const dichtbij = zoek();
  W.updateLOD(b.cx + 900, b.cz + 900);
  const veraf = zoek();
  W.updateLOD(b.cx, b.cz);
  return { dichtbij, veraf };
});
ok(lod.dichtbij.aan >= 1, 'van dichtbij staan de banen er', `${lod.dichtbij.aan} groep(en) zichtbaar`);
ok(lod.veraf.aan === 0 && lod.veraf.uit >= 1, 'en van een kilometer verderop zijn ze uit',
  `${lod.veraf.aan} zichtbaar, ${lod.veraf.uit} uit`);

await browser.close();
console.log(fouten === 0 ? '\nAlles goed.' : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
