/*
 Nieuwe foto's voor het boekje (stap 143, gevraagd: "voor het boekje nieuwe foto's maken, de huidige zijn deels
 outdated"). De foto's in docs/boekje/foto/ waren kopieën van oude schermafdrukken op 1280 × 720; dit gereedschap
 maakt ze opnieuw, van de huidige stand van het spel en groot genoeg voor drukwerk.

   npm run server &   node tools/boekjeshots.mjs [poort] [--opnieuw] [--alleen script,script]   (npm run boekjeshots)

 Het draait de bestaande fotoscripts (die weten al waar de camera moet staan) met SHOT_B × SHOT_H = 2400 × 1350 en een
 eigen map (SHOT_MAP = docs/boekje/ruw, niet in git), twee tegelijk, en zet daarna de gekozen opnamen om naar JPEG
 (kwaliteit 0,92, op een canvas in de browser: geen beeldpakketten) in docs/boekje/foto/. 2400 px breed is een halve
 A5-pagina op ruim 500 dpi, of een hele A5 liggend op 350. Een script waarvan alle opnamen al in de ruwe map staan,
 slaat het over (behalve met --opnieuw), zodat een onderbroken ronde verder kan.

 Daarna schrijft het docs/boekje/fotolijst.md opnieuw: bestand, hoofdstuk, onderschrift en waar de foto vandaan komt.
*/
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';

const args = process.argv.slice(2);
const poort = args.find(a => /^\d+$/.test(a)) || '8123';
const opnieuw = args.includes('--opnieuw');
const alleenI = args.indexOf('--alleen');
const alleen = alleenI >= 0 ? (args[alleenI + 1] || '').split(',') : null;
const B = 2400, H = 1350;
const RUW = 'docs/boekje/ruw', FOTO = 'docs/boekje/foto';
mkdirSync(RUW, { recursive: true }); mkdirSync(FOTO, { recursive: true });

/*
 Per foto: het script dat hem maakt, de naam van zijn opname, de naam in het boekje, het hoofdstuk en het onderschrift.
 De namen houden de nummering van de eerste fotolijst aan; nieuw zijn 04b (het schap met de huidige prijzen), 19b–19f
 (No Mercy 4 en 5, de stafauto, het zijspan), 22 (de postbode) en 23 (de besturing in het menu).
*/
const LIJST = [
  ['introshots', 'intro_molenkrite', '01_welkom', 'Welkom', 'Molenkrite, het begin van alles.'],
  ['rijshots', 'lopen_derdepersoon', '02_lopen', 'Besturing', 'Erik te voet in Tinga.'],
  ['wensen5shots', 'wensen5_vishandel', '03_vishandel', 'Gezondheid', 'Martens Vishandel op het Jumbo-terrein: kibbeling voor € 20.'],
  ['winkelshots', 'tinga_state_deur', '04_tinga_state', 'Wapens', 'Tinga State aan de Molenkrite.'],
  ['richtshots', 'boerderij_schap', '04b_schap', 'Wapens', 'Het schap van Tinga State, met de prijzen van nu.'],
  ['m1shots', 'm1_hand', '05_m1_garand', 'Wapens', 'De M1 Garand.'],
  ['echtshots', 'wapen_echt_sniper', '05b_sniper', 'Wapens', 'De sniper.'],
  ['zespuntenshots', 'mes_in_hand', '05c_mes', 'Wapens', 'Het mes: altijd bij de hand.'],
  ['droneshots', 'drone_beeld', '06_drone', 'Wapens (drone)', 'Door de camera van de drone.'],
  ['garageshots', 'garage_buiten', '07_autohuis', "Auto's", 'Autohuis Lemmerweg, tegenover de BP.'],
  ['garageshots', 'garage_ferrari', '07b_ferrari', "Auto's", 'De Ferrari.'],
  ['wensen5shots', 'wensen5_tuning', '08_tuning', "Auto's (tuning)", 'Tuning en decals bij Sjoerd.'],
  ['spuitshots', 'spuiterij_open', '09_wasbox', "Auto's / Politie", 'De wasbox achter de BP: nieuwe kleur, geen sterren.'],
  ['tankshots', 'tank_voor', '09b_bp', "Auto's", 'BP Slump Oil aan de Lemmerweg.'],
  ['klusjesshots', 'klus_aanbod', '10_klusje', 'Geld verdienen', 'Mark wijst je een klusje aan, met een K op de kaart.'],
  ['buurtshots', 'buurt_pizza', '11_pizza', 'Geld verdienen', 'Pizza bezorgen op de scooter.'],
  ['tennisshots', 'tennis_park', '12_tennis', 'Geld verdienen', 'Tennis op het park.'],
  ['raceshots', 'race_grid', '13_race', 'Geld verdienen', 'Aan de start van de race.'],
  ['uitzendingshots', 'studio_tafel', '14_radio_tinga', 'Geld verdienen', 'De studio van Radio Tinga.'],
  ['politieshots', 'politie_blokkade', '15_politie_blokkade', 'Politie', 'Wegversperring vanaf drie sterren.'],
  ['helishots', 'heli_zoeklicht', '15b_politie_heli', 'Politie', 'Vanaf vier sterren komt de heli.'],
  ['missieshots', 'sterren_voor', '15c_sterren', 'Politie', 'De sterren onder de minikaart.'],
  ['legendatest', 'legenda', '16_kaart_legenda', 'Plekken / speldjes', 'De grote kaart met de legenda onderaan.'],
  ['verhaalshots', 'kaart_route', '16b_kaart_route', 'Plekken', 'Een paarse route naar je doel.'],
  ['verhaalshots', 'molenkrite15', '17_molenkrite15', 'Plekken', 'Molenkrite 15.'],
  ['woningshots', 'wieken29_woonkamer', '17b_wieken29', 'Plekken', 'De woonkamer van de Wieken 29.'],
  ['viaductshots', 'viaduct_dek', '17c_duvelsrak', 'Plekken', 'De Dúvelsrak (Viaduct Tinga).'],
  ['wensen5shots', 'wensen5_tinganieuws', '18_tv_thuis', 'Handig', 'Tinga Nieuws op de tv thuis.'],
  ['nachtshots', 'nacht_straat', '18b_nacht', 'Handig', 'Tinga bij nacht.'],
  ['omgevingshots', 'licht_ochtend', '18c_ochtend', 'Handig', 'Een ochtend in de wijk.'],
  ['nomercyshots', 'nomercy_flak', '19_nomercy', 'Geld verdienen', 'No Mercy 4: de set in het Tinga-bos.'],
  ['nomercyshots', 'nomercy_kamp', '19b_nomercy_kamp', 'Geld verdienen', 'No Mercy 4: het bunkerdorp, met de stafauto.'],
  ['nomercy5shots', 'nomercy5_overtocht', '19c_nomercy5', 'Geld verdienen', 'No Mercy 5: de overtocht naar molen De Rat.'],
  ['nomercy5shots', 'nomercy5_molen', '19d_nomercy5_molen', 'Geld verdienen', 'No Mercy 5: de Duitse post bij de molen.'],
  ['stafautoshots', 'nomercy5_stafauto', '19e_stafauto', "Auto's", 'De stafauto uit No Mercy: houd hem, of neem de gage.'],
  ['stafautoshots', 'nomercy5_zijspan', '19f_zijspan', 'Geld verdienen', 'Het zijspan uit de rit van No Mercy 5.'],
  ['droneshots', 'terras_poiesz', '20_poiesz', 'Gezondheid', 'De Poiesz in IJlst, met het terras: bier voor € 5.'],
  ['ambulanceshots', 'ambulance_dag', '21_ambulance', 'Gezondheid / sfeer', 'De ambulance rijdt uit.'],
  ['postbodeshots', 'postbode', '22_postbode', 'Handig', "De postbode van Post Tinga, 's ochtends langs de deuren."],
  ['menushots', 'menu_besturing', '23_menu_besturing', 'Besturing', 'De besturing in het menu (Esc).'],
];

// de scripts, in de volgorde van de lijst, met wat ze moeten opleveren
const scripts = [];
for (const [s, bron] of LIJST) {
  let r = scripts.find(q => q.s === s);
  if (!r) scripts.push(r = { s, bronnen: [] });
  if (!r.bronnen.includes(bron)) r.bronnen.push(bron);
}
const klaar = (r) => r.bronnen.every(b => existsSync(`${RUW}/${b}.png`));

function draai(r) {
  return new Promise((ok) => {
    const t0 = Date.now();
    const log = [];
    const kind = spawn(process.execPath, [`tools/${r.s}.mjs`, poort, RUW], {
      env: { ...process.env, SHOT_B: String(B), SHOT_H: String(H), SHOT_MAP: RUW },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    kind.stdout.on('data', d => log.push(String(d)));
    kind.stderr.on('data', d => log.push(String(d)));
    kind.on('close', (code) => {
      writeFileSync(`${RUW}/${r.s}.log`, log.join(''));
      const mist = r.bronnen.filter(b => !existsSync(`${RUW}/${b}.png`));
      console.log(`${mist.length ? ' FOUT ' : '  ok  '} ${r.s} (${Math.round((Date.now() - t0) / 60000)} min, exit ${code})${mist.length ? ` — ontbreekt: ${mist.join(', ')}` : ''}`);
      ok();
    });
  });
}

/*
 De kaart van het speelgebied voor het boekje: tools/geo/printkaart.mjs op 1 px per meter (4380 × 2500 px, A4 liggend op
 ruim 370 dpi), onder een eigen naam zodat de grote drukbladen van \`npm run kaart:print\` in docs/kaart/ blijven staan.
*/
const KAART_NAAM = 'tinga-boekje';
function maakKaart() {
  return new Promise((ok) => {
    const t0 = Date.now();
    const kind = spawn(process.execPath, ['tools/geo/printkaart.mjs', poort, '1', KAART_NAAM], { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    const log = [];
    kind.stdout.on('data', d => log.push(String(d))); kind.stderr.on('data', d => log.push(String(d)));
    kind.on('close', (code) => {
      writeFileSync(`${RUW}/printkaart.log`, log.join(''));
      console.log(`${code ? ' FOUT ' : '  ok  '} printkaart op 1 px/m (${Math.round((Date.now() - t0) / 60000)} min, exit ${code})`);
      ok();
    });
  });
}

const teDoen = scripts.filter(r => (!alleen || alleen.includes(r.s)) && (opnieuw || !klaar(r)));
console.log(`${teDoen.length} van ${scripts.length} fotoscripts te draaien, ${B} × ${H}`);
const rij = teDoen.slice();
const kaartNodig = (!alleen || alleen.includes('kaart')) && (opnieuw || !existsSync(`docs/kaart/${KAART_NAAM}.jpg`));
if (kaartNodig) rij.push('kaart');
await Promise.all([0, 1].map(async () => { while (rij.length) { const r = rij.shift(); if (r === 'kaart') await maakKaart(); else await draai(r); } }));

// ------------------------------------------------------------ omzetten naar JPEG, op een canvas in de browser
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
const page = await browser.newPage();
let fouten = 0;
const regels = [];
for (const [s, bron, naam, hoofdstuk, onder] of LIJST) {
  const pad = `${RUW}/${bron}.png`;
  if (!existsSync(pad)) { console.log(` FOUT  ${naam}: geen ${bron}.png van ${s}`); fouten++; continue; }
  const data = readFileSync(pad).toString('base64');
  const uit = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    return { url: c.toDataURL('image/jpeg', 0.92), b: c.width, h: c.height };
  }, data);
  writeFileSync(`${FOTO}/${naam}.jpg`, Buffer.from(uit.url.split(',')[1], 'base64'));
  const klein = uit.b < 2000;
  if (klein) { console.log(` FOUT  ${naam}: maar ${uit.b} × ${uit.h}`); fouten++; }
  regels.push(`| ${naam}.jpg | ${hoofdstuk} | ${onder} | ${uit.b} × ${uit.h} | \`${s}\` → ${bron} |`);
}
await browser.close();

// de kaart erbij, in kleur en licht (met de herkenningspunten)
const { copyFileSync } = await import('node:fs');
for (const [van, naar, onder] of [[`${KAART_NAAM}.jpg`, 'kaart_speelgebied', 'Het hele speelgebied van boven, met de straatnamen en een maatverdeling langs de randen.'],
  [`${KAART_NAAM}-licht.jpg`, 'kaart_speelgebied_licht', 'Dezelfde kaart, licht, met de herkenningspunten: hierop teken je.']]) {
  if (!existsSync(`docs/kaart/${van}`)) { console.log(` FOUT  geen docs/kaart/${van}`); fouten++; continue; }
  copyFileSync(`docs/kaart/${van}`, `${FOTO}/${naar}.jpg`);
  regels.push(`| ${naar}.jpg | Plekken (kaart) | ${onder} | 4380 × 2500 | \`printkaart\` op 1 px/m |`);
}

// de oude PNG-kopieën weg (ze zijn vervangen door de JPEG's hierboven)
for (const f of readdirSync(FOTO)) if (f.endsWith('.png')) unlinkSync(`${FOTO}/${f}`);

writeFileSync('docs/boekje/fotolijst.md', `# Fotolijst boekje

Alle foto's staan in \`docs/boekje/foto/\`, als JPEG op kwaliteit 0,92. Ze zijn gemaakt met \`npm run boekjeshots\`
(tools/boekjeshots.mjs): de fotoscripts van het spel opnieuw gedraaid op ${B} × ${H}, met de stand van het spel van nu.
Dat is een halve A5-pagina op ruim 500 dpi, of een hele A5 liggend op 350 dpi.

De kaart van het hele speelgebied voor achterin staat in \`docs/kaart/\` (\`npm run kaart:print\`): \`tinga-speelgebied.jpg\`
in kleur en \`tinga-speelgebied-licht.jpg\` met de herkenningspunten, allebei 13.140 × 7500 px (3 px per meter). Voor het
boekje staan er twee op 1 px per meter in deze map: \`kaart_speelgebied.jpg\` en \`kaart_speelgebied_licht.jpg\` (4380 × 2500,
A4 liggend op ruim 370 dpi).

| Bestand | Hoofdstuk | Onderschrift | Maat | Gemaakt door |
|---|---|---|---|---|
${regels.join('\n')}
`);
console.log(fouten ? `\n${fouten} fout${fouten > 1 ? 'en' : ''}` : '\nalles goed');
process.exit(fouten ? 1 : 0);
