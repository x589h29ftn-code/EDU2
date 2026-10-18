/*
 Proef bij stap 219 (npm run desktopopslagtest). Gemeld (18 okt 2026): "de gebruiker heeft een spel opgeslagen, maar bij opnieuw
 starten is het opgeslagen spel weg" (de Windows-app).

 De oorzaak: desktop/main.cjs luisterde op poort 0, dus elke start een andere poort, en localStorage hoort bij de oorsprong
 (http://127.0.0.1:<poort>). Elke start was een leeg spel. Nu een vaste poort, een kopie van de opslag in opslag.json in de
 map van de app (desktop/preload.cjs), en een eenmalige redding van de opslag van oude, willekeurige poorten.

 Draait de echte Electron onder xvfb-run, telkens met een eigen, lege gegevensmap:
  1. Zoals de oude versie (poort 0, geen kopie) een spel opslaan; de nieuwe versie haalt het terug.
  2. De nieuwe versie slaat op; na opnieuw starten is het er nog (de vaste poort).
  3. Op een andere poort (de vaste poort bezet) komt het uit opslag.json.

 Gebruik: node tools/desktopopslagtest.mjs
*/
import { spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let fouten = 0;
const ok = (goed, wat, extra = '') => { console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`); if (!goed) fouten++; };
const kop = (t) => console.log(`\n--- ${t} ---`);

const start = (data, env) => {
  const r = spawnSync('xvfb-run', ['-a', 'node_modules/.bin/electron', '.', '--no-sandbox', '--disable-gpu'], {
    env: { ...process.env, TINGA_DATA: data, ...env }, encoding: 'utf8', timeout: 600000,
  });
  const uit = (r.stdout || '') + (r.stderr || '');
  const m = uit.match(/PROEF opslag (\{.*\})/);
  const terug = uit.match(/teruggehaald (\d+)/);
  return { opslag: m ? JSON.parse(m[1]) : null, terug: terug ? +terug[1] : null, uit };
};
const spel = (o) => { try { return JSON.parse(o['tinga.spel.v1']).proef; } catch { return null; } };

kop('1. een spel uit de oude versie');
const d1 = mkdtempSync(join(tmpdir(), 'tinga-'));
const oud = start(d1, { TINGA_POORT: '0', TINGA_GEEN_SPIEGEL: '1', TINGA_PROEF: 'schrijf:oud' });
ok(oud.opslag && spel(oud.opslag) === 'oud', 'de oude versie heeft opgeslagen', oud.opslag ? '' : oud.uit.slice(-600));
ok(!existsSync(join(d1, 'opslag.json')), 'zonder opslag.json (zoals de oude versie)');
const nieuw = start(d1, { TINGA_PROEF: 'lees' });
ok(nieuw.terug === 1, 'de nieuwe versie haalt één spel terug van de oude poort', `teruggehaald ${nieuw.terug}`);
ok(nieuw.opslag && spel(nieuw.opslag) === 'oud', 'en het spel staat er', JSON.stringify(nieuw.opslag || {}).slice(0, 200));
ok(existsSync(join(d1, 'opslag.json')) && spel(JSON.parse(readFileSync(join(d1, 'opslag.json'), 'utf8'))) === 'oud', 'en het staat in opslag.json');

kop('2. opslaan en opnieuw starten');
const d2 = mkdtempSync(join(tmpdir(), 'tinga-'));
const a = start(d2, { TINGA_PROEF: 'schrijf:nieuw' });
ok(a.opslag && spel(a.opslag) === 'nieuw', 'opgeslagen', a.opslag ? '' : a.uit.slice(-600));
const b = start(d2, { TINGA_PROEF: 'lees' });
ok(b.opslag && spel(b.opslag) === 'nieuw', 'na opnieuw starten is het spel er nog', JSON.stringify(b.opslag || {}).slice(0, 200));

kop('3. een andere poort');
const c = start(d2, { TINGA_PROEF: 'lees', TINGA_POORT: '0' });
ok(c.opslag && spel(c.opslag) === 'nieuw', 'ook op een andere poort: uit opslag.json', JSON.stringify(c.opslag || {}).slice(0, 200));

console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);
