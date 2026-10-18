// Electron-schil rond de webversie. Draait een piepklein statisch servertje op
// localhost (ES-modules werken niet vanaf file://) en geeft de editor het recht
// om js/rows.user.js weg te schrijven.
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

// De map met index.html, js/ en lib/. In een ingepakte app staat die naast
// main.cjs; in de repo een niveau hoger.
const APP_DIR = fs.existsSync(path.join(__dirname, '..', 'index.html'))
  ? path.join(__dirname, '..')
  : __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon',
  // de radiomuziek en het menudeuntje: zonder eigen type valt het terug op
  // octet-stream, en dan hangt het van de browser af of hij het nog afspeelt
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.wav': 'audio/wav',
};

/*
 (stap 219, gemeld: "hij heeft een spel opgeslagen, maar bij opnieuw starten is het opgeslagen spel weg") Het servertje
 luisterde op een willekeurige poort (listen(0)), en de browser bewaart localStorage per adres mét poort: elke start was
 een nieuw adres met een lege opslag. Nu een vaste poort (met een paar vaste reserves als hij bezet is), één venster
 tegelijk, en alles wat met 'tinga.' begint ook in een bestand in de app-map van Windows (`opslag.json`, via preload.cjs).
 Bij de eerste start van deze versie haalt `haalOudeOpslagOp` de spellen van de vorige starts terug.
*/
const VASTE_POORT = 47231;
const POORTEN = [VASTE_POORT, VASTE_POORT + 1, VASTE_POORT + 2, VASTE_POORT + 3];
const OPSLAG_BESTAND = () => path.join(app.getPath('userData'), 'opslag.json');
const PROEF = process.env.TINGA_PROEF || '';
if (process.env.TINGA_DATA) app.setPath('userData', process.env.TINGA_DATA);

function maakServer() {
  return http.createServer((req, res) => {
      const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      // een lege pagina om de opslag van een oud adres uit te lezen (haalOudeOpslagOp)
      if (rel === '/__leeg') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end('<!doctype html><title>.</title>'); return; }
      const file = path.join(APP_DIR, rel === '/' ? 'index.html' : rel);
      // niet buiten de app-map lezen
      if (!file.startsWith(APP_DIR)) { res.writeHead(403).end(); return; }
      /*
       Range-verzoeken. Zonder dit kan de browser niet in een bestand springen,
       en dan blijft Radio Spannenburg — een uitzending van een uur — altijd bij
       nul beginnen: `currentTime` zetten doet dan niets. Met een 206 en het
       gevraagde stuk erin werkt het wel.
      */
      fs.stat(file, (err, st) => {
        if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('niet gevonden'); return; }
        const type = MIME[path.extname(file)] || 'application/octet-stream';
        const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
        if (m) {
          const van = m[1] ? Number(m[1]) : Math.max(0, st.size - Number(m[2]));
          const tot = m[2] && m[1] ? Math.min(Number(m[2]), st.size - 1) : st.size - 1;
          if (van >= st.size || van > tot) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }).end(); return; }
          res.writeHead(206, {
            'Content-Type': type, 'Content-Length': tot - van + 1,
            'Content-Range': `bytes ${van}-${tot}/${st.size}`, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store',
          });
          fs.createReadStream(file, { start: van, end: tot }).pipe(res);
          return;
        }
        res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' });
        fs.createReadStream(file).pipe(res);
      });
  });
}
// luisteren op een poort; null als hij bezet is
function luister(poort) {
  return new Promise(resolve => {
    const server = maakServer();
    server.once('error', () => resolve(null));
    server.listen(poort, '127.0.0.1', () => resolve(server));
  });
}
async function startServer() {
  const keuze = process.env.TINGA_POORT !== undefined ? [Number(process.env.TINGA_POORT)] : [...POORTEN, 0];
  for (const p of keuze) {
    const server = await luister(p);
    if (server) return server.address().port;
  }
  throw new Error('geen poort vrij');
}

// ---------- de opslag als bestand (stap 219) ----------
function leesOpslagBestand() {
  try { return JSON.parse(fs.readFileSync(OPSLAG_BESTAND(), 'utf8')); } catch { return null; }
}
function schrijfOpslagBestand(obj) {
  try {
    const doel = OPSLAG_BESTAND(), tmp = doel + '.tmp';
    fs.mkdirSync(path.dirname(doel), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(obj), 'utf8');
    fs.renameSync(tmp, doel);
    return true;
  } catch { return false; }
}
const spiegelAan = () => !process.env.TINGA_GEEN_SPIEGEL;
ipcMain.on('tinga:opslagLees', e => { e.returnValue = spiegelAan() ? { aan: true, data: leesOpslagBestand() || {} } : { aan: false }; });
ipcMain.on('tinga:opslagSchrijf', (e, tekst) => {
  let ok = false;
  try { const obj = JSON.parse(tekst); if (obj && typeof obj === 'object' && spiegelAan()) ok = schrijfOpslagBestand(obj); } catch { /* ongeldig */ }
  e.returnValue = ok;
});

/*
 De spellen van vroeger terughalen. Elke oude start had een eigen poort, dus een eigen localStorage. De poorten staan in de
 namen van de sleutels in Local Storage/leveldb ("_http://127.0.0.1:52811"); per poort een onzichtbaar venster op dat adres
 dat de sleutels uitleest. Alle opgeslagen spellen (tinga.spel.v1, tinga.spel.v1.n) samen, de nieuwste eerst, tot tien; de
 instellingen en het checkpoint van het nieuwste adres. Gebeurt één keer: daarna bestaat opslag.json.
*/
async function haalOudeOpslagOp(huidig) {
  if (!spiegelAan() || leesOpslagBestand()) return 0;
  const dir = path.join(app.getPath('userData'), 'Local Storage', 'leveldb');
  const poorten = new Set();
  try {
    for (const f of fs.readdirSync(dir)) {
      if (!/\.(log|ldb)$/.test(f)) continue;
      const tekst = fs.readFileSync(path.join(dir, f)).toString('latin1');
      for (const m of tekst.matchAll(/http:\/\/127\.0\.0\.1:(\d{2,5})/g)) { const p = Number(m[1]); if (p !== huidig && p > 0 && p < 65536) poorten.add(p); }
    }
  } catch { return 0; }
  const oogst = [];
  for (const p of [...poorten].slice(0, 40)) {
    const server = await luister(p);
    if (!server) continue;
    const w = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false } });
    try {
      await w.loadURL(`http://127.0.0.1:${p}/__leeg`);
      const data = await w.webContents.executeJavaScript(`(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('tinga.')) o[k] = localStorage.getItem(k); } return o; })()`);
      if (data && Object.keys(data).length) oogst.push(data);
    } catch { /* dit adres overslaan */ }
    w.destroy();
    await new Promise(r => server.close(() => r()));
  }
  if (!oogst.length) { schrijfOpslagBestand({}); return 0; }
  const tijdVan = (v) => { try { return JSON.parse(v).tijd || 0; } catch { return 0; } };
  const spellen = [];
  let nieuwste = null, nieuwsteT = -1, checkpoint = null, checkpointT = -1;
  for (const data of oogst) {
    for (const [k, v] of Object.entries(data)) {
      if (/^tinga\.spel\.v1(\.\d+)?$/.test(k)) {
        const t = tijdVan(v);
        if (!spellen.some(s => s.v === v)) spellen.push({ v, t });
        if (t > nieuwsteT) { nieuwsteT = t; nieuwste = data; }
      } else if (k === 'tinga.checkpoint.v1') {
        const t = tijdVan(v);
        if (t > checkpointT) { checkpointT = t; checkpoint = v; }
      }
    }
  }
  const uit = {};
  for (const [k, v] of Object.entries(nieuwste || oogst[0])) if (!/^tinga\.(spel\.|checkpoint\.)/.test(k)) uit[k] = v;
  spellen.sort((a, b) => b.t - a.t).slice(0, 10).forEach((s, i) => { uit[i === 0 ? 'tinga.spel.v1' : `tinga.spel.v1.${i + 1}`] = s.v; });
  if (spellen.length) uit['tinga.spel.actief'] = '1';
  if (checkpoint) uit['tinga.checkpoint.v1'] = checkpoint;
  schrijfOpslagBestand(uit);
  return spellen.length;
}

let venster = null;

async function maakVenster() {
  const port = await startServer();
  bezigMetTerughalen = true;
  const terug = await haalOudeOpslagOp(port);
  bezigMetTerughalen = false;
  if (PROEF) console.log(`PROEF poort ${port} teruggehaald ${terug}`);
  venster = new BrowserWindow({
    width: 1600, height: 950,
    backgroundColor: '#0b1420',
    title: 'Tinga Sneek',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  venster.loadURL(`http://127.0.0.1:${port}/index.html`);

  /*
   (stap 219) Voor tools/desktopopslagtest.mjs: TINGA_PROEF=schrijf:<tekst> zet een opgeslagen spel en sluit af,
   TINGA_PROEF=lees schrijft de opslag naar stdout en sluit af.
  */
  if (PROEF) {
    venster.webContents.once('did-finish-load', async () => {
      try {
        if (PROEF.startsWith('schrijf:')) {
          const w = PROEF.slice(8);
          await venster.webContents.executeJavaScript(`localStorage.setItem('tinga.spel.v1', JSON.stringify({ tijd: Date.now(), proef: ${JSON.stringify(w)} })); 1`);
        }
        const data = await venster.webContents.executeJavaScript(`(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('tinga.')) o[k] = localStorage.getItem(k); } return o; })()`);
        console.log('PROEF opslag ' + JSON.stringify(data));
      } catch (err) { console.log('PROEF fout ' + err); }
      venster.close();
    });
  }
  /*
   Geen menubalk meer (stap 127, gevraagd: "Verwijder in het menu van de applicatie 'wijk'"): het menu Wijk was van
   de wijkeditor. F11 zet het volledige scherm aan en uit, Esc in het spel opent het pauzemenu (daar staat ook
   "Volledig scherm"), en Ctrl+Shift+I blijft de ontwikkelhulp.
  */
  Menu.setApplicationMenu(null);
  venster.webContents.on('before-input-event', (e, inv) => {
    if (inv.type !== 'keyDown') return;
    if (inv.key === 'F11') { venster.setFullScreen(!venster.isFullScreen()); e.preventDefault(); }
    else if (inv.control && inv.shift && (inv.key === 'I' || inv.key === 'i')) venster.webContents.toggleDevTools();
  });
}
ipcMain.handle('tinga:volledig', (_e, aan) => {
  if (!venster) return false;
  venster.setFullScreen(aan === undefined ? !venster.isFullScreen() : !!aan);
  return venster.isFullScreen();
});

// De editor schrijft js/rows.user.js. Alleen die ene bestandsnaam, zodat een
// pagina niet zomaar ergens anders kan schrijven.
ipcMain.handle('tinga:saveRows', async (_e, tekst) => {
  try {
    if (typeof tekst !== 'string' || tekst.length > 4_000_000) throw new Error('ongeldige inhoud');
    const doel = path.join(APP_DIR, 'js', 'rows.user.js');
    if (fs.existsSync(doel)) fs.copyFileSync(doel, doel + '.bak');
    fs.writeFileSync(doel, tekst, 'utf8');
    return { ok: true, path: doel };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
});

ipcMain.handle('tinga:info', () => ({ appDir: APP_DIR, versie: app.getVersion() }));

// één venster tegelijk: een tweede start haalt het eerste naar voren (en bezet de poort niet)
if (!PROEF && !app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (venster) { if (venster.isMinimized()) venster.restore(); venster.focus(); } });
  app.whenReady().then(maakVenster);
}
// (stap 219) het verborgen venster van haalOudeOpslagOp is even het enige venster: dan niet afsluiten
let bezigMetTerughalen = false;
app.on('window-all-closed', () => { if (!bezigMetTerughalen) app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) maakVenster(); });

process.on('uncaughtException', err => {
  dialog.showErrorBox('Tinga', String(err && err.stack || err));
});
