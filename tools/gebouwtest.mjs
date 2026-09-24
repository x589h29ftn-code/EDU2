/*
 Gebouwen: vectoren en textures (verzoek 24 sep 2026: "neem de wereld met
 gebouwen door op steekproef basis — gaat het nog fout qua vectors en
 textures?").

   node tools/server.mjs 8123 &   node tools/gebouwtest.mjs [poort]

 Deze proef loopt élke driehoek van de wereld na die een klasse heeft (muur,
 gevel, dak, stoep, haag …) en meet wat je op een foto pas ziet als je toevallig
 op de goede plek staat:

 1. Wijst de muur naar buiten? Een punt 40 cm vóór de muur hoort buiten het
    pand te liggen. Vóór deze ronde: 529 muurdriehoeken die het huis in keken.
 2. Klopt de richting van elke driehoek met zijn normaal? Een vlak dat andersom
    rond staat is met FrontSide onzichtbaar. Vóór deze ronde: de bovenkant van
    elke volkstuinhaag (400 driehoeken).
 3. Is de texture niet uitgerekt? Per driehoek de beeldpunten per meter langs u
    en langs v; scheelt dat meer dan 1,8 keer, dan is de gevel of de pan platge-
    drukt. Vóór deze ronde: bijna een kwart van de gevels en een op de vijf
    dakdriehoeken.
 4. Is de bovenkant van een gevel niet afgekapt? Een hoekpunt boven de laatste
    woonlaag kreeg de bovenste rij beeldpunten: verticale strepen. Vóór deze
    ronde: 3812 gevel­driehoeken.
 5. Een verdieping boven de goot. Bij 719 panden (vooral molenkrite_kap) loopt
    de voorgevel in het 3D BAG-model over de volle breedte tot bijna zes meter,
    maar de goot staat op 2,6 m; alles erboven werd kale steen.
 6. Geen NaN in de posities.

 Kleine sliertjes (onder 0,05 m²) tellen niet mee: daar maakt de afronding van
 float32 op een paar kilometer van de oorsprong de richting willekeurig, en je
 ziet ze niet.
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
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

const r = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const { kaartTelling } = await import('/js/kaartwereld.js');
  const THREE = await import('three');
  const g = window.__game; g.reliëfAf();
  // een raster van de grondvlakken, voor "binnen of buiten een pand"
  const C = 25, raster = new Map(), sl = (i, j) => i * 100003 + j;
  for (const p of KAART.panden) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of p.voet) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    p._b = [x0, z0, x1, z1];
    for (let i = Math.floor(x0 / C); i <= Math.floor(x1 / C); i++) for (let j = Math.floor(z0 / C); j <= Math.floor(z1 / C); j++) {
      const k = sl(i, j); if (!raster.has(k)) raster.set(k, []); raster.get(k).push(p);
    }
  }
  const inPoly = (x, z, poly) => { let r = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) r = !r; } return r; };
  const pandOp = (x, z) => (raster.get(sl(Math.floor(x / C), Math.floor(z / C))) || []).find(p => { const b = p._b; return x >= b[0] && x <= b[2] && z >= b[1] && z <= b[3] && inPoly(x, z, p.voet); }) || null;

  const per = {}, vb = {};
  const noteer = (kl, soort, info) => {
    per[kl] = per[kl] || {}; per[kl][soort] = (per[kl][soort] || 0) + 1;
    vb[soort] = vb[soort] || []; if (vb[soort].length < 4) vb[soort].push({ kl, ...info });
  };
  const tel = (kl, soort) => { per[kl] = per[kl] || {}; per[kl][soort] = (per[kl][soort] || 0) + 1; };
  g.scene.traverse(o => {
    if (!o.isMesh || !o.userData.klasse || !o.geometry || o.isInstancedMesh) return;
    const kl = o.userData.klasse;
    const P = o.geometry.attributes.position, N = o.geometry.attributes.normal, U = o.geometry.attributes.uv;
    if (!P || !N || o.geometry.index) return;
    const tweezijdig = o.material.side === THREE.DoubleSide;
    const map = o.material.map; const tw = map && map.image ? map.image.width : 0, th = map && map.image ? map.image.height : 0;
    const rep = map ? map.repeat : { x: 1, y: 1 };
    const gevel = /^(voor|achter)gevel$/.test(kl);
    for (let t = 0; t < P.count; t += 3) {
      const a = [P.getX(t), P.getY(t), P.getZ(t)], b = [P.getX(t + 1), P.getY(t + 1), P.getZ(t + 1)], c = [P.getX(t + 2), P.getY(t + 2), P.getZ(t + 2)];
      if ([...a, ...b, ...c].some(v => !Number.isFinite(v))) { noteer(kl, 'NaN', {}); continue; }
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const opp = Math.hypot(...n) / 2;
      if (opp < 0.05) continue;
      tel(kl, 'driehoeken');
      const fn = n.map(v => v / (2 * opp));
      const sn = [N.getX(t), N.getY(t), N.getZ(t)];
      const L = Math.hypot(...sn) || 1;
      if (!tweezijdig && (fn[0] * sn[0] + fn[1] * sn[1] + fn[2] * sn[2]) / L < -0.2) noteer(kl, 'omgekeerd', { x: +a[0].toFixed(1), z: +a[2].toFixed(1) });
      // muren: wijst de normaal naar buiten?
      if (Math.abs(fn[1]) < 0.3 && opp > 0.5 && /gevel|muur/.test(kl)) {
        const mx = (a[0] + b[0] + c[0]) / 3, mz = (a[2] + b[2] + c[2]) / 3;
        const voor = pandOp(mx + sn[0] * 0.4, mz + sn[2] * 0.4), achter = pandOp(mx - sn[0] * 0.4, mz - sn[2] * 0.4);
        tel(kl, 'wanden');
        if (voor && !achter) noteer(kl, 'naarBinnen', { x: +mx.toFixed(1), z: +mz.toFixed(1), adres: `${voor.straat} ${(voor.nr || [])[0] || ''}` });
      }
      // uitgerekt of afgekapt
      if (U && tw > 8 && opp > 0.3) {
        const ua = [U.getX(t), U.getY(t)], ub = [U.getX(t + 1), U.getY(t + 1)], uc = [U.getX(t + 2), U.getY(t + 2)];
        const du1 = [ub[0] - ua[0], ub[1] - ua[1]], du2 = [uc[0] - ua[0], uc[1] - ua[1]];
        const det = du1[0] * du2[1] - du2[0] * du1[1];
        if (Math.abs(det) < 1e-9) continue;
        const dPdu = e1.map((v, i) => (v * du2[1] - e2[i] * du1[1]) / det), dPdv = e1.map((v, i) => (-v * du2[0] + e2[i] * du1[0]) / det);
        const verh = (Math.hypot(...dPdu) / (tw * (rep.x || 1))) / (Math.hypot(...dPdv) / (th * (rep.y || 1)));
        tel(kl, 'uv');
        const vs = [ua[1], ub[1], uc[1]], ys = [a[1], b[1], c[1]];
        const boven = ys.filter((y, i) => vs[i] >= 0.999);
        if (gevel && boven.length >= 2 && Math.max(...boven) - Math.min(...boven) > 0.15) noteer(kl, 'afgekapt', { x: +a[0].toFixed(1), z: +a[2].toFixed(1) });
        else if (verh > 1.8 || verh < 1 / 1.8) noteer(kl, 'uitgerekt', { verh: +verh.toFixed(2), x: +a[0].toFixed(1), z: +a[2].toFixed(1) });
      }
    }
  });
  // de tiny houses aan de Molenkrite: houden ze hun voordeur (een gevel met
  // doek per huis) nu smalle vlakken niet meer worden ingedrukt?
  let tinyGevel = 0;
  g.scene.traverse(o => { if (o.isMesh && /gevel/.test(o.userData.klasse || '') && o.material.map && o.material.map.image) {
    const P = o.geometry.attributes.position;
    for (let t = 0; t < P.count; t += 3) { const p = pandOp(P.getX(t), P.getZ(t)) || pandOp(P.getX(t) - 0.3, P.getZ(t)) || pandOp(P.getX(t) + 0.3, P.getZ(t)); if (p && p.type === 'tinyhouse') { tinyGevel++; break; } }
  } });
  return { per, vb, gedraaid: kaartTelling.gedraaid, opbouwen: kaartTelling.opbouwen, tinyGevel };
});

const som = (soort, re) => Object.entries(r.per).filter(([k]) => re.test(k)).reduce((t, [, v]) => t + (v[soort] || 0), 0);
const deel = (soort, noemer, re) => { const a = som(soort, re), b = som(noemer, re); return { a, b, p: b ? a / b : 0 }; };
const pct = (x) => `${(x.p * 100).toFixed(1)} % (${x.a} van ${x.b})`;
const toon = (soort) => { if (r.vb[soort]) console.log(`       bv. ${JSON.stringify(r.vb[soort].slice(0, 3))}`); };
for (const [k, v] of Object.entries(r.per).sort()) if (/gevel|muur|dak|haag|voetpad|rijbaan|erf|berm|parkeer/.test(k)) console.log(`       ${k.padEnd(14)} ${JSON.stringify(v)}`);

kop('muren wijzen naar buiten');
const binnen = deel('naarBinnen', 'wanden', /gevel|muur/);
toon('naarBinnen');
ok(r.gedraaid > 100, 'de verkeerd om staande vlakken uit het model worden bij het bouwen gedraaid', `${r.gedraaid} vlakken`);
ok(binnen.p < 0.002, 'vrijwel geen muur kijkt nog het huis in', `${pct(binnen)} (was 529 driehoeken)`);

kop('elke driehoek ligt zoals zijn normaal zegt');
const om = som('omgekeerd', /./);
toon('omgekeerd');
ok((r.per.tuinhaag || {}).omgekeerd === undefined, 'de bovenkant van de volkstuinhagen is weer te zien', `${(r.per.tuinhaag || {}).omgekeerd || 0} omgekeerd (was 400)`);
ok(som('omgekeerd', /gevel|muur|dak/) === 0, 'geen enkel gebouwvlak staat andersom', `${som('omgekeerd', /gevel|muur|dak/)}`);
ok(om < 40, 'en op de grond hoogstens een handvol', `${om} in totaal`);
ok(som('NaN', /./) === 0, 'geen NaN in de posities');

kop('textures niet uitgerekt of afgekapt');
const gv = deel('uitgerekt', 'uv', /^(voor|achter)gevel$/);
toon('uitgerekt');
ok(gv.p < 0.03, 'gevels: ramen en deuren op hun maat', `${pct(gv)} uitgerekt (was 23 %)`);
const ak = deel('afgekapt', 'uv', /^(voor|achter)gevel$/);
toon('afgekapt');
ok(ak.p < 0.005, 'gevels: niets boven de laatste woonlaag afgekapt', `${pct(ak)} (was 3812 driehoeken)`);
const dk = deel('uitgerekt', 'uv', /^dak$/);
ok(dk.p < 0.01, 'daken: de pannen zijn overal even lang als breed', `${pct(dk)} (was een op de vijf)`);
ok(r.opbouwen > 500, 'een hele verdieping boven een lage goot krijgt ramen in plaats van kale steen',
  `${r.opbouwen} voor- en achtermuren heel gelaten (onder meer Partuurstraat 73)`);
ok(r.tinyGevel > 0, 'de tiny houses hebben nog een gevel met deur', `${r.tinyGevel} gevelmeshes`);

console.log(`\n${fout ? fout + ' fout' : 'alles goed'}`);
await browser.close();
process.exit(fout ? 1 : 0);
