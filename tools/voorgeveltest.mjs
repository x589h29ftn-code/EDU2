/*
 Stap 155: een steekproef van de voorgevels (npm run voorgeveltest). Gevraagd: "wereld 2" — de steekproef van
 woningen: goothoogte, voorgevelrichting, en de voorgevel aan de Vang die alleen steen was.

 Voor elke woning (een pand met een huisnummer, een voorgevelrichting `front` en een goot) gaan zeven stralen op
 deurhoogte (1,2 m) van de straatkant recht op het pand af, verdeeld over de hele breedte van de voorkant. De eerste
 treffer op de rand van dat pand telt. Een gevel met deur en ramen herken je aan zijn materiaal (`nachtRamen`: de
 ramen die 's avonds gaan branden, js/licht.js); kale steen heeft dat niet. Raakt geen van de zeven een gevel met
 openingen, dan kijkt de voorkant tegen een blinde muur: de richting klopt niet, of de goot knipt de gevel weg.

   1. minstens 97,5 % van de woningen heeft een voorkant met openingen (gemeten bij het bouwen: 98,0 %; met één straal
      in het midden 92,7 %, want vóór het midden staat vaak een berging of uitbouw met een blinde muur);
   2. de Vang 28, 10 en 12 (goot 0,51 tot 1,28 m bij een nok van tien): de voorgevel met deur en ramen loopt van de
      grond tot boven de deur (0,5, 1,2, 2,0 en 2,6 m), en is geen kopgevel van kale steen;
   3. de lijst van wat nog niet klopt, per straat: om met foto's na te lopen.

 De LOD draait headless niet vanzelf: per buurt van 120 m wordt hij bijgewerkt.

 Gebruik: npm run server &  node tools/voorgeveltest.mjs [poort]
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fout = 0;
const ok = (goed, wat, extra = '') => { console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`); if (!goed) fout++; };
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
page.setDefaultTimeout(1800000);
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

const r = await page.evaluate(async () => {
  const THREE = await import('three');
  const { KAART } = await import('/js/kaart.js');
  const W = await import('/js/world.js');
  const g = window.__game;
  document.getElementById('overlay').style.display = 'none';
  g.player.active = false; window.__autoplay = false;
  g.reliëfAf();
  const zichtbaar = (o) => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
  let doelen = [], lodBij = null;
  const verzamel = () => { doelen = []; g.scene.traverse(o => { if (o.isMesh && !o.isInstancedMesh && zichtbaar(o)) doelen.push(o); }); };
  const randAfst = (x, z, v) => {
    let best = Infinity;
    for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
      const a = v[j], b = v[i], dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l));
      best = Math.min(best, Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z));
    }
    return best;
  };
  const rc = new THREE.Raycaster();
  const naarLOD = (x, z) => {
    if (!lodBij || Math.hypot(x - lodBij[0], z - lodBij[1]) > 120) { W.updateLOD(x, z); g.scene.updateMatrixWorld(true); verzamel(); lodBij = [x, z]; }
  };
  // wat raakt een straal van de straatkant op hoogte y, op u meter opzij van het midden
  const straal = (p, u, y) => {
    const [x, z] = p._h, f = p.front, tx = -f[1], tz = f[0];
    rc.set(new THREE.Vector3(x + tx * u + f[0] * 25, y, z + tz * u + f[1] * 25), new THREE.Vector3(-f[0], 0, -f[1])); rc.far = 40;
    const h = rc.intersectObjects(doelen, false).find(h => randAfst(h.point.x, h.point.z, p.voet) < 0.6);
    if (!h) return 'geen';
    const m = Array.isArray(h.object.material) ? h.object.material[h.face.materialIndex] : h.object.material;
    return m.userData && m.userData.nachtRamen ? 'ramen' : (m.map ? 'kaal' : 'zonder kaart');
  };
  const panden = KAART.panden.filter(p => p.nr && p.nr.length && p.front && p.goot > 0);
  for (const p of panden) { let x = 0, z = 0; for (const q of p.voet) { x += q[0]; z += q[1]; } p._h = [x / p.voet.length, z / p.voet.length]; }
  panden.sort((a, b) => (Math.floor(a._h[0] / 150) - Math.floor(b._h[0] / 150)) || (a._h[1] - b._h[1]));
  const tel = {}, mis = [];
  for (const p of panden) {
    naarLOD(...p._h);
    const [x, z] = p._h, f = p.front, tx = -f[1], tz = f[0];
    let lo = Infinity, hi = -Infinity;
    for (const q of p.voet) { const u = (q[0] - x) * tx + (q[1] - z) * tz; lo = Math.min(lo, u); hi = Math.max(hi, u); }
    let soort = 'geen';
    for (let k = 0; k < 7; k++) {
      const s = straal(p, lo + (hi - lo) * (k + 0.5) / 7, 1.2);
      if (s === 'ramen') { soort = s; break; }
      if (soort === 'geen') soort = s;
    }
    tel[soort] = (tel[soort] || 0) + 1;
    if (soort !== 'ramen') mis.push({ straat: p.straat || '(zonder straat)', nr: p.nr.join('/'), type: p.type, soort });
  }
  // de Vang
  const vang = {};
  for (const nr of ['28', '10', '12']) {
    const p = KAART.panden.find(q => q.straat === 'de Vang' && q.nr && q.nr.includes(nr));
    if (!p) { vang[nr] = null; continue; }
    if (!p._h) { let x = 0, z = 0; for (const q of p.voet) { x += q[0]; z += q[1]; } p._h = [x / p.voet.length, z / p.voet.length]; }
    lodBij = null; naarLOD(...p._h);
    vang[nr] = { goot: p.goot, nok: p.nok, hoogten: [0.5, 1.2, 2.0, 2.6].map(y => straal(p, 0, y)) };
  }
  return { n: panden.length, tel, mis, vang };
});

kop('1. de voorkant van elke woning');
const goed = (r.tel.ramen || 0) / r.n;
console.log('      ', JSON.stringify(r.tel));
ok(goed >= 0.975, 'een voorkant met deur of ramen', `${(goed * 100).toFixed(1)} % van ${r.n} woningen`);
kop('2. de Vang');
for (const [nr, v] of Object.entries(r.vang)) {
  ok(v && v.hoogten.every(s => s === 'ramen'), `de Vang ${nr}: de voorgevel van de grond tot boven de deur`,
    v ? `goot ${v.goot} m, nok ${v.nok} m: ${v.hoogten.join(', ')}` : 'niet gevonden');
}
kop('3. na te lopen met foto\'s');
const perStraat = {};
for (const m of r.mis) (perStraat[m.straat] = perStraat[m.straat] || []).push(`${m.nr} (${m.type}, ${m.soort})`);
for (const [straat, lijst] of Object.entries(perStraat).sort((a, b) => b[1].length - a[1].length)) console.log(`       ${straat}: ${lijst.join(', ')}`);

await browser.close();
console.log(fout ? `\n${fout} fout(en)` : '\nalles goed');
process.exit(fout ? 1 : 0);
