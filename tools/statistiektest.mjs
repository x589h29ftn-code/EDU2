/*
 Proef bij stap 195 (npm run statistiektest): de statistieken. Gevraagd: "een statistiekenscherm in het pauzemenu: gespeelde tijd,
 gereden kilometers, neergeschoten mensen, verdiend geld, hoogste aantal sterren, voltooide missies en bijmissies; en deze ook in
 het eindscherm laten zien".

 1. De teller zelf (js/statistiek.js, zonder browser): tijd alleen als je speelt; afstand te voet, met de auto en met de boot;
    een sprong (laden, een overgang) telt niet; geld verdiend en uitgegeven; klusjes; neergaan; de hoogste sterren; bewaren en
    terugzetten; nul bij een nieuw spel; de regels in het Nederlands.
 2. In het spel: een schot telt, een voetganger neer telt, een auto die ontploft telt; lopen en rijden tellen via de hoofdlus.
 3. Opslaan en laden houdt de tellers; een checkpoint draait ze niet terug.
 4. Het pauzemenu: de knop Statistieken, met de regels en "Missies x van 18"; buiten de pauze geen knop.
 5. De titelrol aan het eind: "Jouw spel in cijfers" met dezelfde regels.

 Gebruik: npm run server &  node tools/statistiektest.mjs [poort]
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => { console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`); if (!goed) fouten++; };
const kop = (t) => console.log(`\n--- ${t} ---`);

kop('1. de teller');
{
  const { statistiek: S, STAT } = await import('../js/statistiek.js');
  S.nieuw();
  const stap = (o) => S.werkBij(0.5, { speelt: true, x: 0, z: 0, auto: false, boot: false, geld: 100, klusjes: 0, sterren: 0, leven: 100, ...o });
  stap({});
  stap({ x: 3, z: 4 });                         // 5 m te voet
  stap({ x: 3, z: 14, auto: true });            // 10 m met de auto
  stap({ x: 3, z: 16, boot: true });            // 2 m met de boot
  stap({ x: 3 + STAT.sprong + 5, z: 16 });      // een sprong: telt niet
  stap({ x: 3 + STAT.sprong + 5, z: 16, speelt: false });
  stap({ x: 3 + STAT.sprong + 5, z: 16, geld: 600 });          // + 500
  stap({ x: 3 + STAT.sprong + 5, z: 16, geld: 350, klusjes: 1, sterren: 3 });   // − 250, een klus, drie sterren
  stap({ x: 3 + STAT.sprong + 5, z: 16, geld: 350, klusjes: 1, sterren: 1, leven: 0 });  // neer
  stap({ x: 3 + STAT.sprong + 5, z: 16, geld: 350, klusjes: 1, leven: 0 });
  S.tel('schoten', 3); S.tel('mensen'); S.tel('onzin');
  const st = S.stand;
  ok(Math.abs(st.voet - 5) < 1e-6 && Math.abs(st.auto - 10) < 1e-6 && Math.abs(st.boot - 2) < 1e-6, 'te voet 5 m, met de auto 10 m, met de boot 2 m; de sprong telt niet', `${st.voet} / ${st.auto} / ${st.boot}`);
  ok(Math.abs(st.tijd - 4.5) < 1e-6, 'de tijd loopt alleen als je speelt', `${st.tijd} s van 5 s`);
  ok(st.verdiend === 500 && st.uitgegeven === 250, 'verdiend € 500, uitgegeven € 250');
  ok(st.klusjes === 1 && st.sterren === 3 && st.neer === 1, 'een klus, hoogste sterren 3, één keer neergegaan', JSON.stringify({ k: st.klusjes, s: st.sterren, n: st.neer }));
  ok(st.schoten === 3 && st.mensen === 1 && !('onzin' in st), 'tellen met `tel`, en niets wat er niet hoort');
  const b = S.bewaar(); S.nieuw();
  const leeg = Object.values(S.stand).every(v => v === 0);
  S.herstel(b);
  ok(leeg && S.stand.auto === b.auto && S.stand.verdiend === 500, 'een nieuw spel begint bij nul; bewaren en terugzetten');
  S.herstel({ tijd: 'x', auto: NaN, mensen: 4 });
  ok(S.stand.tijd === 0 && S.stand.auto === 0 && S.stand.mensen === 4, 'een kapotte opslag geeft geen NaN');
  S.herstel(b);
  const r = S.regels({ missies: 7, bijmissies: 1, bijTotaal: 3 });
  const kaart = Object.fromEntries(r);
  ok(kaart.Missies === '7 van 18' && kaart.Bijmissies === '1 van 3' && kaart.Gereden === '0,0 km' && kaart.Verdiend === '€ 500' && kaart['Hoogste sterren'] === '★★★',
    'de regels: missies, bijmissies, kilometers, euro\'s, sterren', r.map(([k, w]) => `${k} ${w}`).join(' · '));
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
page.setDefaultTimeout(900000);
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

kop('2. in het spel');
const spel = await page.evaluate(async () => {
  for (const k of Object.keys(localStorage)) if (k.startsWith('tinga.spel')) localStorage.removeItem(k);
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, P = g.player, S = g.statistiek, THREE = await import('three');
  g.politie.proefStil = true;
  S.nieuw();
  // een voetganger op een eigen wegvak naast de camera (zoals tools/wapentest.mjs), en raak
  const c = g.camera.position;
  const q = g.npcs.people.find(p => p.alive && !p.slaapt && !p.verborgen && !p.fietst && !p.doe);
  q.seg = { a: [c.x, c.z - 6], b: [c.x, c.z + 6], w: 5, walkOff: 2, drive: false, name: 'proef' };
  q.t = 0.5; q.dir = 1; q.side = 0; q.steek = 0; q.pause = 0; q.alive = true; q.raken = 0; q.fall = 0; q.respawn = 0; q.paniek = 0; q.speed = 0; q.slaapt = false;
  for (let k = 0; k < 3; k++) g.npcs.update(0.016, performance.now() / 1000, c.x + 3, c.z);
  g.scene.updateMatrixWorld(true);
  g.derde.aan = false;
  P.wapens = ['pistool']; P.wapenNr = 0; P.ammo = 12;
  const doel = new THREE.Vector3(q.x, 1.2, q.z), van = doel.clone().add(new THREE.Vector3(3, 0.2, 0));
  let raak = false;
  for (let k = 0; k < 4 && q.alive; k++) { P.shootCb(van, doel.clone().sub(van).normalize()); raak = true; }
  const naSchot = S.stand;
  // een auto ontploft
  const auto = g.vehicles.cars.find(a => a.mesh && a.mesh.visible && a.driveable !== false && !a.wrak);
  let ontploft = null;
  if (auto) { auto.hp = 0; g.vehicles.laatOntploffen(auto); }
  return { mensen: naSchot.mensen, schoten: naSchot.schoten, neer: !q.alive, raak, auto: !!auto };
});
ok(spel.schoten >= 1, 'een schot telt', `${spel.schoten}`);
ok(spel.neer && spel.mensen === 1, 'een voetganger neer telt één keer', `${spel.mensen}`);

kop('3. opslaan en laden');
const opslag = await page.evaluate(async () => {
  const g = window.__game, P = g.player, S = g.statistiek;
  const O = await import('/js/opslag.js');
  S.tel('schoten', 10); S.tel('autos', 2);
  const voor = S.stand;
  O.bewaarSpel({ player: P, sfeer: g.sfeer, vehicles: g.vehicles, verhaal: g.verhaal });
  O.bewaarSpel({ player: P, sfeer: g.sfeer, vehicles: g.vehicles, verhaal: g.verhaal, checkpoint: true });
  S.nieuw();
  O.laadSpel({ player: P, sfeer: g.sfeer, vehicles: g.vehicles, verhaal: g.verhaal });
  const na = S.stand;
  S.tel('schoten', 5);
  O.laadSpel({ player: P, sfeer: g.sfeer, vehicles: g.vehicles, verhaal: g.verhaal, checkpoint: true });
  const naCp = S.stand;
  for (const k of Object.keys(localStorage)) if (k.startsWith('tinga.spel')) localStorage.removeItem(k);
  return { voor, na, naCp };
});
ok(opslag.na.schoten === opslag.voor.schoten && opslag.na.autos === opslag.voor.autos && opslag.na.mensen === opslag.voor.mensen, 'na laden dezelfde tellers', `${opslag.na.schoten} schoten, ${opslag.na.autos} auto's`);
ok(opslag.naCp.schoten === opslag.voor.schoten + 5, 'een checkpoint draait ze niet terug', `${opslag.naCp.schoten}`);

kop('4. het pauzemenu');
const menu = await page.evaluate(async () => {
  const M = await import('/js/menu.js');
  M.toonMenu({ pauze: false });
  const knop = document.getElementById('menuStatistiek');
  const buiten = !!knop && getComputedStyle(knop).display !== 'none' && !knop.hidden;
  M.toonMenu({ pauze: true });
  const zicht = !!knop && !knop.hidden && getComputedStyle(knop).display !== 'none';
  knop.click();
  const paneel = document.querySelector('.menuzij');
  const tekst = paneel && !paneel.hidden ? paneel.textContent : '';
  M.verbergMenu();
  return { buiten, zicht, tekst };
});
ok(!menu.buiten && menu.zicht, 'de knop Statistieken staat in de pauze, niet in het startmenu');
ok(/Jouw spel in cijfers/.test(menu.tekst) && /Gespeeld/.test(menu.tekst) && /Missies\s*\d+ van 18/.test(menu.tekst) && /Gereden/.test(menu.tekst) && /Hoogste sterren/.test(menu.tekst),
  'het paneel met de regels', menu.tekst.slice(0, 120));

kop('5. de titelrol');
const rol = await page.evaluate(() => {
  const v = window.__game.verhaal;
  v.__titelrol(true);
  const el = document.getElementById('titelrol');
  const tekst = el.textContent, zicht = !el.hidden;
  v.__titelrol(false);
  return { tekst, zicht };
});
ok(rol.zicht && /Jouw spel in cijfers/.test(rol.tekst) && /Neergeschoten:\s*1/.test(rol.tekst) && /Missies:\s*\d+ van 18/.test(rol.tekst),
  'in de titelrol "Jouw spel in cijfers", met dezelfde regels', rol.tekst.slice(rol.tekst.indexOf('Jouw'), rol.tekst.indexOf('Jouw') + 120));

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);
