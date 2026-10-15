/*
 Proef bij stap 185 (npm run dvdtest, zonder browser): alles voor de installer en de dvd, voor zover het zonder Windows kan.
 Het echte bouwen (Electron inpakken, Inno Setup, de ISO) doet .github/workflows/windows.yml met "dvd" aangevinkt.

   1. installer/beelden.py maakt het icoon (16 tot 256 px) en de wizardbeelden op de maten die Inno Setup wil;
   2. installer/tinga.iss verwijst alleen naar bestanden die er dan zijn, met de vaste AppId, zonder beheerdersrechten, in het
      Nederlands, met snelkoppelingen zonder tekens die in een bestandsnaam niet mogen;
   3. tools/pack.mjs neemt het icoon mee en laat installer/ en de brondata buiten de app;
   4. tools/dvd.mjs zet autorun.inf (ASCII, CRLF, open= de setup), LEESMIJ.txt (de toetsen bestaan in het spel), het icoon en de
      hoes klaar; zonder installer meldt hij wat er mist;
   5. de workflow bouwt de installer en, met "dvd", de inhoud en een ISO onder de 4,7 GB.
*/
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, rmSync } from 'node:fs';

let fouten = 0;
const ok = (goed, wat, extra = '') => { console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? `: ${extra}` : ''}`); if (!goed) fouten++; };

console.log('\n--- 1. de beelden ---');
rmSync('dist/installer', { recursive: true, force: true });
execSync('python3 installer/beelden.py', { stdio: 'pipe' });
const maten = JSON.parse(execSync(`python3 -c "
import json
from PIL import Image
r={}
for n in ['wizard_100','wizard_150','wizard_200','wizard_250','klein_100','klein_150','klein_200','klein_250']:
    r[n]=Image.open('dist/installer/'+n+'.bmp').size
i=Image.open('dist/installer/tinga.ico'); r['ico']=sorted(s[0] for s in i.info['sizes'])
print(json.dumps(r))"`).toString());
ok(JSON.stringify(maten.ico) === '[16,24,32,48,64,128,256]', 'het icoon in zeven maten', maten.ico.join(', '));
ok(maten.wizard_100.join() === '164,314' && maten.wizard_250.join() === '410,797', 'het wizardbeeld op 164 × 314 (en tot 410 × 797 voor hoge dpi)');
ok(maten.klein_100.join() === '55,55' && maten.klein_250.join() === '138,138', 'het kleine beeld op 55 × 55 (en tot 138)');

console.log('\n--- 2. het installerscript ---');
const iss = readFileSync('installer/tinga.iss', 'utf8');
const beelden = [...iss.matchAll(/\{#Beelden\}\\([\w.]+)/g)].map(m => m[1]);
ok(beelden.length >= 9 && beelden.every(b => existsSync(`dist/installer/${b}`)), 'elk beeld uit het script bestaat', beelden.join(' '));
ok(/AppId=\{\{[0-9A-F-]{36}\}/.test(iss), 'een vaste AppId (een nieuwere versie werkt de oude bij)');
ok(/PrivilegesRequired=lowest/.test(iss), 'installeren zonder beheerdersrechten');
ok(/Dutch\.isl/.test(iss), 'in het Nederlands');
const koppelingen = [...iss.matchAll(/^Name: "\{(?:group|autodesktop)\}\\([^"]+)"/gm)].map(m => m[1]);
ok(koppelingen.length >= 3 && koppelingen.every(k => !/[:*?"<>|]/.test(k)), 'snelkoppelingen met geldige namen', koppelingen.join(' / '));
ok(/#define Bron "\.\.\\dist\\Tinga-win32-x64"/.test(iss) && /OutputBaseFilename=Tinga-Setup-\{#Versie\}/.test(iss), 'van de uitgepakte app naar Tinga-Setup-<versie>.exe');
ok(!/—/.test(iss.split('\n').filter(r => !r.startsWith(';')).join('\n')), 'geen gedachtestreepjes in wat de speler ziet');

console.log('\n--- 3. het inpakken ---');
const pack = readFileSync('tools/pack.mjs', 'utf8');
ok(/icon: 'dist\/installer\/tinga\.ico'/.test(pack), 'Tinga.exe krijgt het icoon');
ok(/\\\/installer\//.test(pack) && /\\\/data\\\/geo/.test(pack), 'installer/ en de brondata blijven buiten de app');

console.log('\n--- 4. de dvd ---');
const uit = execSync('node tools/dvd.mjs', { stdio: 'pipe' }).toString();
const auto = readFileSync('dist/dvd/autorun.inf');
const autoTekst = auto.toString('latin1');
ok(auto.every(b => b < 128), 'autorun.inf is gewone ASCII');
ok(/\r\n/.test(autoTekst) && !/[^\r]\n/.test(autoTekst), 'met Windows-regeleinden');
const versie = JSON.parse(readFileSync('package.json', 'utf8')).version;
ok(autoTekst.includes(`open=Tinga-Setup-${versie}.exe`) && autoTekst.includes('icon=tinga.ico') && /label=.{1,32}\r\n/.test(autoTekst), 'open = de setup, het icoon, een naam van hoogstens 32 tekens');
ok(existsSync('dist/dvd/tinga.ico') && existsSync('dist/dvd/Hoes/Hoes op A4 (zelf printen).pdf'), 'het icoon en de hoes op de schijf');
const lees = readFileSync('dist/dvd/LEESMIJ.txt', 'utf8');
const code = ['main', 'player', 'hud', 'menu'].map(n => readFileSync(`js/${n}.js`, 'utf8')).join('\n');
const toetsen = { M: 'KeyM', V: 'KeyV', R: 'KeyR', T: 'KeyT', C: 'KeyC', E: 'KeyE', F5: 'F5', F9: 'F9', Esc: 'Escape', Spatie: 'Space', Shift: 'Shift' };
const ontbreekt = Object.entries(toetsen).filter(([k, c]) => lees.includes(k) && !code.includes(c)).map(([k]) => k);
ok(ontbreekt.length === 0, 'elke toets uit de LEESMIJ bestaat in het spel', ontbreekt.join(', ') || Object.keys(toetsen).join(' '));
ok(!lees.includes('—'), 'geen gedachtestreepjes in de LEESMIJ');
ok(/ontbreekt:[\s\S]*Tinga-Setup/.test(uit), 'zonder installer zegt het script wat er mist');

console.log('\n--- 5. de workflow ---');
const wf = readFileSync('.github/workflows/windows.yml', 'utf8');
ok(/installer\/beelden\.py/.test(wf) && /ISCC\.exe/.test(wf) && /installer\\tinga\.iss/.test(wf), 'beelden, Inno Setup en het script');
ok(/dvd:\s*\n\s*description/.test(wf) && /node tools\/dvd\.mjs/.test(wf), 'een vinkje "dvd" dat de inhoud samenstelt');
ok(/xorriso -as mkisofs[^\n]*-J -joliet-long/.test(wf) && /-lt 4700000000/.test(wf), 'de ISO met lange Windows-namen, en onder de 4,7 GB');

console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);
