/*
 Foto's bij stap 154 (npm run voetgangershots): de voetgangers. In docs/screenshots/:

   voetgangers_rij.png     acht mensen naast elkaar op de stoep: mannen en vrouwen, huidskleuren, kapsels, baarden, een rok
   voetgangers_poiesz.png  voor de Poiesz in Duinterpen: iemand loopt naar binnen, een fietser zet zijn fiets in het rek
   voetgangers_bank.png    iemand op een bankje en iemand die belt
   voetgangers_regen.png   regen: jassen en paraplu's (de lucht helder: met regen werd hij headless zwart)

 Gebruik: npm run server &  node tools/voetgangershots.mjs [poort] [map]
*/
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const poort = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
mkdirSync(map, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(900000);
let fouten = 0;
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  const g = window.__game;
  window.__W = await import('./js/world.js');
  window.__GD = (await import('./js/gedrag.js')).GEDRAG;
  window.__L = await import('./js/lichaam.js');
  document.getElementById('overlay').style.display = 'none';
  g.player.active = false; window.__autoplay = false;
  if (g.reliëfAf) await g.reliëfAf();
  g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
  g.sfeer.uur = 15; g.sfeer.weer = 'helder';
  Object.assign(window.__GD, { bankKans: 0, winkelKans: 0, fietsKans: 0, belKans: 0, bankTijd: [999, 999], binnenTijd: [999, 999] });
});

const foto = async (naam, code) => {
  const data = await page.evaluate(new Function(`
    const g = window.__game, W = window.__W, C = g.camera, npcs = g.npcs, gd = npcs.gedrag, P = npcs.people;
    let klok = 0;
    const stap = (x, z, dt = 0.1) => { klok += dt; npcs.kijk = null; npcs.update(dt, klok, x, z); g.werkSchuifdeurenBij(dt, gd.bijDeur(P)); };
    // iedereen ver weg, behalve wie de foto nodig heeft
    const opzij = () => { for (const p of P) { if (p.doe) gd.afmaken(p); p.seg = npcs.segs[0]; p.t = 0.5; p.pause = 999; p.belt = 0; p.slaapt = false; p.alive = true; p.paniek = 0; p.steek = 0; p.steekWacht = 999; } };
    const opWegvak = (p, s, t, side) => { p.seg = s; p.t = t; p.side = side; p.pause = 999; p.steek = 0; p.steekWacht = 999; p.doe = null; p.slaapt = false; p.slaap = 0; p.alive = true; };
    const wegvakBij = (x, z) => {
      let best = null, bd = Infinity;
      for (const s of npcs.segs) {
        const ex = s.b[0] - s.a[0], ez = s.b[1] - s.a[1], L2 = ex * ex + ez * ez || 1;
        const t = Math.max(0.05, Math.min(0.95, ((x - s.a[0]) * ex + (z - s.a[1]) * ez) / L2));
        const d = Math.hypot(s.a[0] + ex * t - x, s.a[1] + ez * t - z);
        if (d < bd) { bd = d; best = { s, t }; }
      }
      return best;
    };
    const kijk = (van, naar) => {
      C.position.set(van[0], van[1], van[2]); C.lookAt(naar[0], naar[1], naar[2]); C.updateMatrixWorld(true);
      g.scene.traverse(o => { if (o.material && o.material.uniforms && o.material.uniforms.maanDir) o.position.copy(C.position); });
      W.updateLOD(C.position.x, C.position.z);
      for (let i = 0; i < 3; i++) g.sfeer.update(0.1, C.position.x, C.position.z);
      g.scene.updateMatrixWorld(true); g.renderer.shadowMap.needsUpdate = true;
      g.renderer.render(g.scene, C); g.renderer.render(g.scene, C);
      return g.renderer.domElement.toDataURL('image/png');
    };
    ${code}
  `));
  writeFileSync(`${map}/${naam}.png`, Buffer.from(data.split(',')[1], 'base64'));
  console.log(`${map}/${naam}.png`);
};

// acht mensen naast elkaar: een lang recht wegvak, om de 1,1 m
await foto('voetgangers_rij', `
  opzij();
  const s = npcs.segs.filter(s => Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) > 30).sort((a, b) => Math.hypot(b.b[0] - b.a[0], b.b[1] - b.a[1]) - Math.hypot(a.b[0] - a.a[0], a.b[1] - a.a[1]))[3];
  const L = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
  const kies = [];
  const wil = [p => p.vrouw && p.kapsel === 'lang' && p.rok, p => !p.vrouw && p.baard === 'vol', p => p.vrouw && p.kapsel === 'staart',
    p => p.kind, p => p.oud && p.kapsel === 'kaal', p => p.vrouw && p.kapsel === 'halflang', p => !p.vrouw && p.baard === 'stoppels', p => p.vrouw && p.kapsel === 'kort'];
  for (const f of wil) { const p = P.find(q => !q.fietst && !q.hond && !kies.includes(q) && f(q)) || P.find(q => !q.fietst && !q.hond && !kies.includes(q)); kies.push(p); }
  kies.forEach((p, k) => opWegvak(p, s, 0.5 + (k - 3.5) * 1.1 / L, 1));
  // tegen de looprichting in kijkend: allemaal naar de camera
  kies.forEach(p => { p.dir = 1; });
  stap(0, 0, 0.016);
  const mid = kies[3], mid2 = kies[4];
  const cx = (mid.x + mid2.x) / 2, cz = (mid.z + mid2.z) / 2;
  stap(cx, cz, 0.016); stap(cx, cz, 0.016);
  const ux = (s.b[0] - s.a[0]) / L, uz = (s.b[1] - s.a[1]) / L;
  // de camera vóór de rij, op de rijbaan, naar de stoep
  const nx = -uz, nz = ux;
  const kant = Math.sign((mid.x - (s.a[0] + ux * L * 0.5)) * nx + (mid.z - (s.a[1] + uz * L * 0.5)) * nz) || 1;
  // voor de foto naar de camera gedraaid, in de staande houding (js/npc.js zet de kijkrichting langs het wegvak)
  const camX = cx - nx * kant * 4.6, camZ = cz - nz * kant * 4.6;
  kies.forEach((p, k) => {
    const j = npcs.slotVan[P.indexOf(p)]; if (j < 0) return;
    const H = {}; window.__L.loopHouding(0, false, 0, H, k * 0.83); H.armZijR = null;
    npcs.zetLichaam(j, p.x, H.wip * p.height, p.z, Math.atan2(p.x - camX, p.z - camZ), H.romp, p.height, H, p);
  });
  for (const mm of Object.values(npcs.meshes)) mm.instanceMatrix.needsUpdate = true;
  return kijk([cx - nx * kant * 4.6, 1.4, cz - nz * kant * 4.6], [cx, 0.95, cz]);
`);

// voor de Poiesz: iemand op weg naar binnen, een fietser die op slot zet
await foto('voetgangers_poiesz', `
  opzij();
  const w = gd.winkel;
  const klant = P.find(p => !p.fietst && !p.hond && p.vrouw && p.kapsel === 'lang');
  const fietser = P.find(p => p.fietst);
  const anderen = P.filter(p => !p.fietst && !p.hond && p !== klant).slice(0, 4);
  const b = wegvakBij(w.stoep.x, w.stoep.z);
  for (const p of [klant, fietser, ...anderen]) opWegvak(p, b.s, b.t, 1);
  anderen.forEach((p, k) => { p.t = b.t + (k - 1.5) * 0.04; p.pause = 0; });
  stap(w.stoep.x, w.stoep.z, 0.016);
  klant.pause = 0; fietser.pause = 0;
  gd.begin(klant, 'winkel', { toch: true });
  gd.begin(fietser, 'fiets', { toch: true });
  for (let n = 0; n < 800 && !(klant.doe && klant.doe.fase === 'deur' && Math.hypot(klant.x - w.deur.x, klant.z - w.deur.z) < 1.4); n++) {
    stap(w.stoep.x, w.stoep.z);
    if (fietser.doe && fietser.doe.fase === 'slot') { fietser.doe.t = 999; }
  }
  for (let n = 0; n < 300 && !(fietser.doe && fietser.doe.fase === 'slot'); n++) { stap(w.stoep.x, w.stoep.z); if (klant.doe && klant.doe.fase === 'deur') klant.doe.vast = 0; }
  if (fietser.doe) fietser.doe.t = 999;
  stap(w.stoep.x, w.stoep.z, 0.016);
  const fx = w.f[0], fz = w.f[1];
  return kijk([w.deur.x + fx * 11 + fz * 4, 2.0, w.deur.z + fz * 11 - fx * 4], [w.deur.x + fx * 2.5, 1.0, w.deur.z + fz * 2.5]);
`);

// een bankje: iemand zit, iemand belt ernaast
await foto('voetgangers_bank', `
  opzij();
  const bank = gd.plekken[0];
  const zitter = P.find(p => !p.fietst && !p.hond && !p.kind && p.oud) || P.find(p => !p.fietst && !p.hond);
  const beller = P.find(p => !p.fietst && !p.hond && !p.kind && p !== zitter && p.vrouw);
  const b = wegvakBij(bank.x, bank.z);
  opWegvak(zitter, b.s, b.t, 1); opWegvak(beller, b.s, b.t, 1);
  stap(bank.x, bank.z, 0.016);
  zitter.pause = 0;
  gd.begin(zitter, 'bank', { plek: bank });
  for (let n = 0; n < 600 && !(zitter.doe && zitter.doe.fase === 'zit'); n++) stap(bank.x, bank.z);
  // de beller staat een paar meter naast het bankje
  beller.doe = null; gd.begin(beller, 'bellen', { tijd: 999 });
  stap(bank.x, bank.z, 0.016); stap(bank.x, bank.z, 0.016);
  const vx = bank.voor.x - bank.x, vz = bank.voor.z - bank.z, l = Math.hypot(vx, vz);
  return kijk([bank.x + vx / l * 4.2 + vz / l * 1.6, 1.4, bank.z + vz / l * 4.2 - vx / l * 1.6], [bank.x, 0.85, bank.z]);
`);

// regen: jassen en paraplu's
await foto('voetgangers_regen', `
  opzij();
  // (de lucht helder: met regen of bewolkt werd hij headless zwart; de paraplu's en jassen hangen aan npcs.zetRegen)
  g.sfeer.weer = 'helder';
  npcs.zetRegen(true);
  const s = npcs.segs.filter(s => Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) > 30)[5];
  const L = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
  const kies = [...P.filter(p => p.paraplu && !p.hond).slice(0, 4), ...P.filter(p => !p.paraplu && p.jasBijRegen && !p.fietst && !p.hond).slice(0, 2)];
  kies.forEach((p, k) => { opWegvak(p, s, 0.5 + (k - 2.5) * 1.6 / L, k % 2 ? 1 : -1); p.dir = -1; p.pause = 0; });
  stap(0, 0, 0.016);
  const m = kies[2];
  for (let n = 0; n < 3; n++) stap(m.x, m.z, 0.05);
  const ux = (s.b[0] - s.a[0]) / L, uz = (s.b[1] - s.a[1]) / L;
  return kijk([m.x - ux * 6 + uz * 2.0, 1.9, m.z - uz * 6 - ux * 2.0], [m.x, 1.3, m.z]);
`);

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);
