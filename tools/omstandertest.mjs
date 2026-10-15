/*
 Proef bij stap 188 (npm run omstandertest): mensen die je eerst niet kon raken (js/omstanders.js). Gevraagd: "als een persoon op
 een zeilboot zit kan je hem niet neerschieten zo te zien, dat soort dingetjes".

 Voor één figuur van elke soort (zeiler, opvarende, terrasgast, klant van de supermarkt;
 wie een rol heeft staat er niet in, gevraagd: "de figuranten zoals Mark en Sjoerd niet neerschieten"): in beeld zetten, met het echte schot (`player.shootCb`) van een paar meter afstand op zijn borst
 schieten, en dan:
   - hij gaat neer (`neer`, en een zeiler ligt na een tel in het water);
   - het is een misdaad (de politie krijgt een melding);
   - na `OMSTANDER.terug` seconden en met de camera ver weg staat hij weer op.
 Daarna: het mes raakt een omstander, de knal van de Tiger ook, en de voetgangers blijven gewoon te raken.

 Gebruik: npm run server &  node tools/omstandertest.mjs [poort]
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => { console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`); if (!goed) fouten++; };

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
page.setDefaultTimeout(900000);
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

const r = await page.evaluate(async () => {
  const g = window.__game, THREE = await import('three'), O = await import('/js/omstanders.js');
  const P = g.player, S = g.omstanders;
  document.getElementById('overlay').style.display = 'none';
  P.active = true; window.__autoplay = true;
  P.wapens = ['pistool']; P.wapenNr = 0; P.ammo = 12; P.reserve = 200;
  g.politie.proefStil = true;
  const soorten = [...new Set(S.lijst.map(e => e.wie))];
  const uit = { soorten, per: {} };
  const maakZichtbaar = (o) => { const was = []; for (let q = o; q; q = q.parent) { was.push([q, q.visible]); q.visible = true; } return was; };
  const misdaadWas = g.politie.misdaad;
  let misdaden = 0;
  g.politie.misdaad = (...a) => { misdaden++; return misdaadWas.apply(g.politie, a); };
  for (const wie of soorten) {
    const e = S.lijst.find(q => q.wie === wie && !q.neer);
    if (!e) continue;
    const was = maakZichtbaar(e.groep);
    g.scene.updateMatrixWorld(true);
    // de borst: het midden van de wereldmaten van de figuur
    const box = new THREE.Box3().setFromObject(e.groep), mid = box.getCenter(new THREE.Vector3());
    const hoog = box.max.y - box.min.y;
    const doel = new THREE.Vector3(mid.x, box.min.y + hoog * 0.62, mid.z);
    // van vóór hem (zijn kijkrichting is zijn −z), drie meter; een zeiler schuin van boven
    const voor = e.groep.getWorldDirection(new THREE.Vector3()).multiplyScalar(-1).setY(0).normalize();
    const van = e.p.valOverboord ? doel.clone().add(new THREE.Vector3(1.5, 2.5, 0.5)) : doel.clone().addScaledVector(voor, 3).add(new THREE.Vector3(0, 0.25, 0));
    const dir = doel.clone().sub(van).normalize();
    P.vuurKlok = 0; P.ammo = 12;
    const m0 = misdaden;
    P.shootCb(van, dir);
    // (wie tegenover hem zit kan het schot eerst opvangen: dan telt dat ook, als het iemand van dezelfde soort is)
    const geraakt = e.neer || S.lijst.some(q => q.wie === wie && q.neer);
    for (let i = 0; i < 30; i++) S.update(0.05, van.x, van.z);
    uit.per[wie] = { geraakt, misdaad: misdaden > m0, hoog: +hoog.toFixed(2), zeilerWeg: e.p.valOverboord ? !e.groep.visible : null };
    // weer opstaan: lang genoeg, en de camera ver weg
    S.update(O.OMSTANDER.terug + 1, van.x + 500, van.z + 500);
    uit.per[wie].terug = S.lijst.filter(q => q.wie === wie).every(q => !q.neer) && (e.p.valOverboord ? e.groep.visible : true);
    for (const [q, v] of was) q.visible = v;
  }
  // het mes, op een omstander op 1,2 m
  {
    const e = S.lijst.find(q => q.wie === 'terrasgast') || S.lijst[0];
    const was = maakZichtbaar(e.groep); g.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(e.groep), mid = box.getCenter(new THREE.Vector3());
    const van = new THREE.Vector3(mid.x + 1.2, mid.y + 0.2, mid.z), dir = mid.clone().sub(van).normalize();
    P.shootCb(van, dir, { mes: true, bereik: 1.6 });
    uit.mes = { wie: e.wie, geraakt: e.neer };
    S.reset();
    for (const [q, v] of was) q.visible = v;
  }
  // de knal van de Tiger
  {
    const e = S.lijst.find(q => q.wie === 'terrasgast') || S.lijst[0];
    const was = maakZichtbaar(e.groep); g.scene.updateMatrixWorld(true);
    const w = e.groep.getWorldPosition(new THREE.Vector3());
    const n = g.explosieRaakt(w.x + 3, w.y, w.z, 9);
    uit.knal = { wie: e.wie, geraakt: e.neer, n };
    S.reset();
    for (const [q, v] of was) q.visible = v;
  }
  // de voetgangers blijven te raken
  {
    const q = g.npcs.people.find(p => p.alive && !p.slaapt && !p.verborgen && !p.fietst);
    g.npcs.update && g.scene.updateMatrixWorld(true);
    uit.voetgangerVoor = q.alive;
    g.npcs.hitPersoon(q, 1);
    uit.voetganger = !q.alive;
  }
  g.politie.misdaad = misdaadWas;
  return uit;
});

console.log(`\n--- soorten omstanders: ${r.soorten.join(', ')} ---`);
ok(r.soorten.length === 4 && ['zeiler', 'opvarende', 'terrasgast', 'klant'].every(w => r.soorten.includes(w)), 'de gewone omstanders zijn aangemeld', r.soorten.join(', '));
for (const [wie, x] of Object.entries(r.per)) {
  ok(x.geraakt && x.misdaad, `${wie}: met het echte schot neer, en de politie hoort ervan`, x.zeilerWeg !== null ? `overboord: ${x.zeilerWeg}` : `${x.hoog} m hoog`);
  ok(x.terug, `${wie}: staat later weer op (camera ver weg)`);
}
ok(r.mes.geraakt, 'het mes raakt een omstander', r.mes.wie);
ok(r.knal.geraakt && r.knal.n >= 1, 'de knal van de Tiger ook', `${r.knal.wie}, ${r.knal.n} neer`);
ok(r.voetganger, 'de voetgangers blijven gewoon te raken');
await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);
