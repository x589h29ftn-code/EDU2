/*
 De figuranten van No Mercy 4 en 5 (stap 142), drie meldingen van de gebruiker:
   "in missie no mercy zie ik in het tinga bos nog de bx als auto. De duitsers lopen ook wat door elkaar. Laat ze als
    ze je raken wel rood zien in beeld maar geen levens"

   node tools/server.mjs 8123 &   node tools/figurantentest.mjs [poort]      (npm run figurantentest)

 1. De stafauto in het bunkerdorp (No Mercy 4) is het eigen model uit js/nomercy5.js (`maakStafauto`), geen BX; hij staat
    op zijn plek, is niet bestuurbaar en vertaalt geen nieuwe shader.
 2. Uit elkaar: in de eerste golf van No Mercy 4 komen de Duitsers op je af, maar elk beeld staan twee levende mannen
    minstens `uitElkaar` (1,4 m) van elkaar, min een paar centimeter; ze lopen niet meer naar hetzelfde punt.
 3. Rood zonder schade: een treffer van een figurant laat het beeld rood flitsen (`hud.flits`), en je leven blijft vol;
    in No Mercy 4 en in No Mercy 5 (het MG en de sluipschutter op de overtocht).
 4. Een gewone `Bewaking` (zonder `uitElkaar`) duwt niemand weg, en met `schade: 0` geeft ook het machinegeweer 0.
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fouten++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);
const r2 = (x) => (x == null || !isFinite(x)) ? String(x) : (Math.round(x * 100) / 100).toString();

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
let soortenKlaar = false;
page.on('console', m => { if (/^soorten:/.test(m.text())) soortenKlaar = true; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  const W = await import('/js/world.js');
  const B = await import('/js/bewaking.js');
  for (let n = 1; n <= 15; n++) localStorage.removeItem(n === 1 ? 'tinga.spel.v1' : `tinga.spel.v1.${n}`);
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, v = g.verhaal;
  g.player.active = false;
  window.__autoplay = false;
  g.sfeer.uur = 13;
  window.__W = W; window.__B = B;
  window.__flits = 0;
  const echt = g.hud.flits.bind(g.hud);
  g.hud.flits = () => { window.__flits++; return echt(); };
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) v.update(dt); };
  window.__klik = (max = 40) => { for (let i = 0; i < max && !document.getElementById('dialoog').hidden; i++) { v.toets(); window.__stap(1); } };
  window.__zet = (x, z) => { g.player.inCar = null; const [rx, rz] = W.resolveCollisions(x, z, 0.4); g.player.pos.set(rx, 0, rz); g.player.applyCamera(); };
  // vrij spelen na missie 5 (No Mercy 4 nog te doen)
  window.__naMissie5 = () => {
    const s = v.bewaar(); s.missie = 'bx'; s.fase = 'wacht'; s.volgende = null; s.noMercyKlaar = false; s.noMercyGebeld = true;
    v.herstel(s); v.__geenVolgende(); g.politie.reset(); v.klusjes.reset();
    window.__stap(2);
  };
  // de kleinste afstand tussen twee levende mannen van een groep
  window.__dichtst = (grp) => {
    const L = grp.wachters.filter(w => w.staat !== 'neer').map(w => w.persoon.groep.position);
    let m = Infinity;
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) m = Math.min(m, Math.hypot(L[i].x - L[j].x, L[i].z - L[j].z));
    return m;
  };
});

// ------------------------------------------------------------------ 1. de stafauto in het bunkerdorp
kop('1. de stafauto in het bunkerdorp');
await page.evaluate(() => window.__game.reliëfAf());
for (let i = 0; i < 1800 && !soortenKlaar; i++) await new Promise(r => setTimeout(r, 200));
const een = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, R = g.renderer, P = g.player;
  window.__naMissie5();
  const K = { x: -63, z: -214 };
  const kijk = () => { P.inCar = null; P.pos.set(K.x - 14, 0, K.z + 6); P.yaw = Math.atan2(-(K.x - P.pos.x), -(K.z - P.pos.z)); P.pitch = 0; P.applyCamera(); g.scene.updateMatrixWorld(true); R.render(g.scene, P.camera); };
  kijk();
  const voor = R ? R.info.programs.length : null;
  v.startNoMercy(); window.__klik(); window.__stap(90);
  v.noMercy.naarKamp(); window.__stap(2); window.__klik(); window.__stap(2);
  kijk();
  const na = R ? R.info.programs.length : null;
  const n = v.noMercy, st = n.staf, plek = n.kamp.staf;
  return { model: !!(st.mesh.userData && st.mesh.userData.stafauto), bx: !st.mesh.userData.stafauto, bestuurbaar: st.driveable !== false,
    zichtbaar: st.mesh.visible, d: Math.hypot(st.x - plek.x, st.z - plek.z), voor, na, fase: n.fase };
});
ok(een.model, 'het eigen model van de stafauto, geen BX', een.fase);
ok(een.zichtbaar && een.d < 0.2 && !een.bestuurbaar, 'op zijn plek in het kamp, niet bestuurbaar', `${r2(een.d)} m`);
if (een.voor !== null) ok(een.na === een.voor, 'geen nieuwe shader', `${een.voor} → ${een.na} programma's (soorten vooraf: ${soortenKlaar ? 'klaar' : 'niet gezien'})`);
await page.evaluate(() => { window.__game.verhaal.klusAfbreken(); window.__stap(2); });

// ------------------------------------------------------------------ 2 en 3. uit elkaar, en rood zonder schade (No Mercy 4)
kop('2. uit elkaar, en 3. rood zonder schade (No Mercy 4)');
const twee = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  window.__naMissie5();
  v.startNoMercy(); window.__klik(); window.__stap(90);
  const f = v.noMercy.set.groep.position, r = v.noMercy.set.ruit;
  window.__zet(f.x - 3, f.z + 10.5); window.__stap(3); window.__klik();
  window.__zet(r.x + 0.8, r.z); window.__stap(2); v.toets();
  const dx = r.x - f.x, dz = r.z - f.z, d = Math.hypot(dx, dz);
  window.__zet(f.x + dx / d * 17, f.z + dz / d * 17);
  window.__stap(140);
  const n = v.noMercy;
  const uit = { fase: n.fase };
  if (!n.golf) return uit;
  // de doelen: ieder een eigen punt
  const doelen = n.golf.wachters.map(w => w.doel ? w.doel.join(',') : '');
  uit.doelen = new Set(doelen).size;
  uit.uitElkaar = n.golf.uitElkaar;
  // twintig tellen stilstaan midden in het gevecht: elk beeld de kleinste afstand, de flitsen en het leven
  P.health = 100; window.__flits = 0;
  let dichtst = Infinity, beelden = 0;
  for (let i = 0; i < 400; i++) {
    v.update(0.05); beelden++;
    if (i > 60) dichtst = Math.min(dichtst, window.__dichtst(n.golf));
  }
  uit.dichtst = dichtst; uit.flits = window.__flits; uit.leven = P.health; uit.levend = n.golf.wachters.filter(w => w.staat !== 'neer').length;
  v.klusAfbreken(); window.__stap(2);
  return uit;
});
ok(twee.fase === 'golf1', 'de eerste golf komt eraan', twee.fase);
ok(twee.uitElkaar === 1.4, 'de Duitsers houden 1,4 m afstand van elkaar (`uitElkaar`)');
ok(twee.doelen === 4, 'ieder een eigen doel om je heen, niet allemaal hetzelfde punt', `${twee.doelen} verschillende doelen`);
ok(twee.dichtst >= 1.4 - 0.08, 'twintig tellen lang nooit door elkaar', `kleinste afstand ${r2(twee.dichtst)} m, ${twee.levend} man`);
ok(twee.flits > 0, 'een treffer geeft een rode flits', `${twee.flits} flitsen`);
ok(twee.leven === 100, 'en geen schade', `leven ${twee.leven}`);

// ------------------------------------------------------------------ 3. rood zonder schade (No Mercy 5)
kop('3. rood zonder schade (No Mercy 5, de overtocht)');
const drie = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  const s = v.bewaar(); s.missie = 'klaar'; s.fase = 'klaar'; s.volgende = null; s.brugKlaar = true; s.noMercyKlaar = true;
  v.herstel(s); v.__geenVolgende(); g.politie.reset(); v.klusjes.reset(); window.__stap(2);
  v.startNoMercy5(); window.__klik(); window.__stap(90); window.__klik(); window.__stap(2);
  const n = v.noMercy5, B = g.boten, b = n.sloep;
  // dichterbij de molen op het water, in het zicht van het MG
  B.verplaats(b, -1185, 884, -Math.PI / 2); P.pos.set(b.x, 0, b.z); P.applyCamera();
  P.health = 100; window.__flits = 0;
  for (let i = 0; i < 500; i++) { P.pos.set(b.x, 0, b.z); v.update(0.05); }
  const uit = { fase: v.noMercy5.fase, flits: window.__flits, leven: P.health };
  v.klusAfbreken(); window.__stap(2);
  if (B.inBoot) B.herstel({ boten: B.bewaar().boten, aanBoord: -1 });
  return uit;
});
ok(drie.fase === 'overtocht', 'op het water, onder vuur', drie.fase);
ok(drie.flits > 0 && drie.leven === 100, 'het MG en de sluipschutter: rode flitsen, geen schade', `${drie.flits} flitsen, leven ${drie.leven}`);

// ------------------------------------------------------------------ 4. een gewone Bewaking
kop('4. een gewone Bewaking blijft zoals hij was');
const vier = await page.evaluate(() => {
  const g = window.__game, Bw = window.__B.Bewaking;
  const x = -200, z = 0;
  const posten = [{ a: [x, z], b: [x, z] }, { a: [x + 0.5, z], b: [x + 0.5, z] }];
  const gewoon = new Bw(g.scene, posten, {});
  const voor = window.__dichtst(gewoon);
  gewoon.duwUitElkaar && gewoon.uitElkaar > 0 && gewoon.duwUitElkaar(0.05);
  for (let i = 0; i < 20; i++) gewoon.update(0.05, { pos: { x: x + 300, z }, inCar: null }, false);
  const na = window.__dichtst(gewoon);
  gewoon.verwijder();
  // een machinegeweer met schade 0: elke treffer telt, maar geeft geen schade
  const mg = new Bw(g.scene, [{ a: [x, z + 40], b: [x, z + 40] }], { schade: 0, mg: [0] });
  const w = mg.wachters[0];
  let schade = 0;
  for (let i = 0; i < 300; i++) { w.vuurT = 0; schade += mg.schiet(w, 2, 0.05); }
  const raak = mg.raakNu;
  mg.verwijder();
  return { voor, na, schade, raak };
});
ok(Math.abs(vier.na - vier.voor) < 0.05, 'zonder `uitElkaar` duwt niemand weg', `${r2(vier.voor)} → ${r2(vier.na)} m`);
ok(vier.schade === 0 && vier.raak > 0, 'een machinegeweer met schade 0 raakt wel, maar doet niets', `${vier.raak} treffers, schade ${vier.schade}`);

await browser.close();
console.log(fouten ? `\n${fouten} fout${fouten > 1 ? 'en' : ''}` : '\nalles goed');
process.exit(fouten ? 1 : 0);
