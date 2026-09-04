/*
 Loopt het verhaal in de Molenkrite na en toetst opslaan en laden.

 - staat de speler bij het opstarten voor Molenkrite 15, met de buurman ervoor?
 - komen die plekken echt uit de kaartdata (pand met huisnummer 15 en 20)?
 - kijkt de buurman naar de speler en zwaait hij?
 - begint E een gesprek, staat de tekst onderin en klikt E door?
 - loopt de buurman daarna naar de bierdrinkers schuin tegenover?
 - roept hij daar de opdracht, en vallen de drinkers om als je ze raakt?
 - overleeft alles een keer opslaan (F5) en laden (F9)?

 Gebruik: python3 -m http.server 8123 &  node tools/verhaaltest.mjs 8123
*/
import { chromium } from 'playwright';

const port = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fouten++;
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
await page.evaluate(() => {
  localStorage.removeItem('tinga.spel.v1');       // begin als een eerste keer
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  window.__game.player.active = true;
});
await page.waitForTimeout(600);

// ---------- 1. het startpunt komt uit de kaartdata ----------
const start = await page.evaluate(async () => {
  const { verhaalStart } = await import('./js/verhaal.js');
  const { KAART } = await import('./js/kaartwereld.js');
  const g = window.__game;
  const s = verhaalStart();
  const b = g.verhaal.buurman.groep.position;
  // welk pand met huisnummer staat het dichtst bij de buurman?
  let dichtst = null;
  for (const p of KAART.panden) {
    if (!p.nr || !p.nr.length) continue;
    const d = Math.hypot(p.rect.cx - b.x, p.rect.cz - b.z);
    if (!dichtst || d < dichtst.d) dichtst = { d, nr: p.nr.join('/'), straat: p.straat, type: p.type, kapel: !!p.kapel };
  }
  const plek = g.verhaal.plekken;
  // ligt de bende aan de andere kant van de straat? (voorkanten kijken naar elkaar)
  const dot = plek.huis.fx * plek.overkant.fx + plek.huis.fz * plek.overkant.fz;
  return {
    speler: { x: g.player.pos.x, z: g.player.pos.z, yaw: g.player.yaw },
    start: s, buurman: { x: b.x, z: b.z },
    afstand: Math.hypot(b.x - g.player.pos.x, b.z - g.player.pos.z),
    dichtst, fase: g.verhaal.fase,
    tafelAfstand: Math.hypot(plek.tafel.x - plek.overkant.x, plek.tafel.z - plek.overkant.z),
    overkantAfstand: Math.hypot(plek.tafel.x - b.x, plek.tafel.z - b.z),
    tegenover: dot,
  };
});
ok(start.start != null, 'het startpunt komt uit de kaartdata (verhaalStart)');
ok(Math.hypot(start.speler.x - start.start.x, start.speler.z - start.start.z) < 0.1,
  'de speler begint op dat punt');
ok(start.dichtst && start.dichtst.nr === '15' && start.dichtst.straat === 'Molenkrite',
  'de buurman staat voor Molenkrite 15', start.dichtst ? `${start.dichtst.straat} ${start.dichtst.nr} op ${start.dichtst.d.toFixed(1)} m` : '-');
ok(start.dichtst && start.dichtst.kapel, 'dat huis heeft een dakkapel (de kant met de dakkapellen)');
ok(start.afstand > 2 && start.afstand < 6, `de buurman staat ${start.afstand.toFixed(1)} m voor de speler`);
ok(start.tegenover < -0.9, 'de bierdrinkers zitten aan de overkant van de straat', `voorkanten dot ${start.tegenover.toFixed(2)}`);
ok(start.overkantAfstand > 15 && start.overkantAfstand < 45,
  `het gezelschap zit ${start.overkantAfstand.toFixed(0)} m schuin tegenover`);
ok(start.fase === 'wacht', `het verhaal begint in fase 'wacht'`, start.fase);

// kijkt hij naar de speler en zwaait hij?
const zwaai = await page.evaluate(() => {
  const g = window.__game;
  let maxArm = 0;
  for (let i = 0; i < 40; i++) { g.verhaal.update(0.05); maxArm = Math.max(maxArm, g.verhaal.buurman.armR.rotation.z); }
  const b = g.verhaal.buurman;
  const dx = g.player.pos.x - b.groep.position.x, dz = g.player.pos.z - b.groep.position.z;
  const doel = Math.atan2(-dx, -dz);
  const d = Math.abs(((b.yaw - doel + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  return { maxArm, hoekverschil: d, praathint: !document.getElementById('praat').hidden };
});
ok(zwaai.maxArm > 1.5, `hij zwaait met zijn arm (${zwaai.maxArm.toFixed(2)} rad)`);
ok(zwaai.hoekverschil < 0.15, `hij kijkt naar de speler (${zwaai.hoekverschil.toFixed(2)} rad verschil)`);
ok(zwaai.praathint, 'de hint "E — praten" staat op het scherm');
await page.waitForTimeout(300);
const hint = await page.evaluate(() => document.getElementById('hint').textContent);
ok(!/instappen/.test(hint), 'de regel onderin stuurt je niet naar een auto terwijl je kunt praten', hint);

// ---------- 2. het gesprek ----------
await page.keyboard.press('KeyE');
const regel1 = await page.evaluate(() => ({
  zichtbaar: !document.getElementById('dialoog').hidden,
  naam: document.getElementById('dialoogNaam').textContent,
  tekst: document.getElementById('dialoogTekst').textContent,
  fase: window.__game.verhaal.fase,
}));
ok(regel1.zichtbaar, 'E opent de tekstbalk onderin het scherm');
ok(regel1.tekst.startsWith('Erik, kom met mij mee'), 'de eerste regel is die van de buurman', regel1.tekst.slice(0, 60));
ok(regel1.fase === 'gesprek', `fase 'gesprek'`, regel1.fase);

await page.keyboard.press('KeyE');
const naGesprek = await page.evaluate(() => ({
  zichtbaar: !document.getElementById('dialoog').hidden,
  fase: window.__game.verhaal.fase,
  opdracht: document.getElementById('opdracht').textContent,
}));
ok(!naGesprek.zichtbaar, 'E klikt het gesprek weg');
ok(naGesprek.fase === 'loopt', 'daarna gaat de buurman lopen', naGesprek.fase);
ok(/buurman/.test(naGesprek.opdracht), 'er staat een opdracht op het scherm', naGesprek.opdracht);

// ---------- 3. de wandeling naar de bierdrinkers ----------
const wandeling = await page.evaluate(() => {
  const g = window.__game;
  const tafel = g.verhaal.plekken.tafel;
  let stappen = 0;
  for (let i = 0; i < 2000 && g.verhaal.fase === 'loopt'; i++) {
    g.verhaal.update(0.05);
    // de speler loopt mee, anders roept de buurman niets
    const p = g.verhaal.buurman.groep.position;
    g.player.pos.set(p.x + 2.2, 0, p.z + 2.2);
    stappen++;
  }
  for (let i = 0; i < 80; i++) g.verhaal.update(0.05);
  const p = g.verhaal.buurman.groep.position;
  return {
    fase: g.verhaal.fase, seconden: stappen * 0.05,
    bijBende: Math.hypot(p.x - tafel.x, p.z - tafel.z),
    tekst: document.getElementById('dialoogTekst').textContent,
    zichtbaar: !document.getElementById('dialoog').hidden,
  };
});
ok(wandeling.bijBende < 4, `hij komt bij het gezelschap aan (${wandeling.bijBende.toFixed(1)} m van het tafeltje)`);
ok(wandeling.seconden < 60, `de wandeling duurt ${wandeling.seconden.toFixed(0)} seconden`);
ok(wandeling.zichtbaar && wandeling.tekst === 'Schiet ze neer!', 'daar roept hij de opdracht', wandeling.tekst);

await page.keyboard.press('KeyE');
const opdracht = await page.evaluate(() => ({
  fase: window.__game.verhaal.fase,
  doelen: window.__game.verhaal.doelen().length,
  opdracht: document.getElementById('opdracht').textContent,
}));
ok(opdracht.fase === 'opdracht', `fase 'opdracht'`, opdracht.fase);
ok(opdracht.doelen === 4, 'de vier bierdrinkers zijn nu doelen', String(opdracht.doelen));
ok(/Schiet ze neer/.test(opdracht.opdracht), 'de opdracht staat in beeld', opdracht.opdracht);

// ---------- 4. echt schieten met het pistool ----------
const schot = await page.evaluate(async () => {
  const THREE = await import('three');
  const g = window.__game;
  const doel = g.verhaal.doelen()[0];
  const p = doel.getWorldPosition(new THREE.Vector3());
  p.y += 1.05;                                  // romp van de zittende buur
  g.player.pos.set(p.x + 3, 0, p.z + 3);
  const dx = p.x - g.player.pos.x, dz = p.z - g.player.pos.z;
  g.player.yaw = Math.atan2(-dx, -dz);
  g.player.pitch = Math.atan2(p.y - 1.7, Math.hypot(dx, dz));
  g.player.applyCamera();
  g.player.ammo = 12; g.player.reloading = 0;
  const voor = g.verhaal.doelen().length;
  g.player.shoot();
  for (let i = 0; i < 40; i++) g.verhaal.update(0.05);
  return { voor, na: g.verhaal.doelen().length, kanteling: doel.rotation.x, opdracht: document.getElementById('opdracht').textContent };
});
ok(schot.na === schot.voor - 1, 'een schot met het pistool legt een drinker om', `${schot.voor} → ${schot.na}`);
ok(schot.kanteling < -1, 'de geraakte drinker kantelt om', schot.kanteling.toFixed(2));
ok(/3 te gaan/.test(schot.opdracht), 'de teller in de opdracht loopt terug', schot.opdracht);

// ---------- 5. opslaan en laden ----------
const opslag = await page.evaluate(() => {
  const g = window.__game;
  // nog een drinker omleggen (dan liggen er twee), en dan opslaan
  g.verhaal.raak(g.verhaal.doelen()[0]);
  for (let i = 0; i < 40; i++) g.verhaal.update(0.05);
  const voor = { over: g.verhaal.doelen().length, x: g.player.pos.x, z: g.player.pos.z };
  g.sfeer.uur = 21.5; g.sfeer.weer = 'regen';
  g.opslaan();
  // alles door de war schoppen
  g.player.pos.set(0, 0, 0); g.player.ammo = 3; g.sfeer.uur = 8; g.sfeer.weer = 'helder';
  for (const o of [...g.verhaal.doelen()]) g.verhaal.raak(o);
  for (let i = 0; i < 40; i++) g.verhaal.update(0.05);
  const tussen = { over: g.verhaal.doelen().length, fase: g.verhaal.fase };
  g.laden();
  const na = {
    over: g.verhaal.doelen().length, fase: g.verhaal.fase,
    x: g.player.pos.x, z: g.player.pos.z, ammo: g.player.ammo,
    uur: g.sfeer.uur, weer: g.sfeer.weer,
  };
  return { voor, tussen, na, opgeslagen: !!localStorage.getItem('tinga.spel.v1') };
});
ok(opslag.opgeslagen, 'F5 zet een opgeslagen spel in de localStorage');
ok(opslag.voor.over === 2, 'twee van de vier drinkers liggen bij het opslaan', String(opslag.voor.over));
ok(opslag.tussen.over === 0 && opslag.tussen.fase === 'klaar', 'daarna gaan alle vier om', `${opslag.tussen.over} over, fase ${opslag.tussen.fase}`);
ok(opslag.na.over === 2 && opslag.na.fase === 'opdracht', 'na laden liggen er weer twee en loopt de opdracht nog', `${opslag.na.over} over, fase ${opslag.na.fase}`);
ok(Math.hypot(opslag.na.x - opslag.voor.x, opslag.na.z - opslag.voor.z) < 0.1, 'de speler staat na laden terug op zijn plek');
ok(Math.abs(opslag.na.uur - 21.5) < 0.01 && opslag.na.weer === 'regen', 'tijd en weer komen terug', `${opslag.na.uur} uur, ${opslag.na.weer}`);

// ---------- 6. het startscherm na het opslaan ----------
const startscherm = await page.evaluate(() => {
  window.__game.player.active = false;
  document.getElementById('overlay').style.display = 'flex';
  return { verder: !document.getElementById('verder').hidden, regel: document.getElementById('opslaginfo').textContent };
});
ok(startscherm.verder, 'het startscherm biedt "verder spelen" aan');
ok(/Opgeslagen/.test(startscherm.regel), 'met de datum van de opslag erbij', startscherm.regel);

await browser.close();
console.log(fouten === 0 ? '\nAlles goed.' : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
