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
};

function startServer() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const file = path.join(APP_DIR, rel === '/' ? 'index.html' : rel);
      // niet buiten de app-map lezen
      if (!file.startsWith(APP_DIR)) { res.writeHead(403).end(); return; }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('niet gevonden'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(buf);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

let venster = null;

async function maakVenster() {
  const port = await startServer();
  venster = new BrowserWindow({
    width: 1600, height: 950,
    backgroundColor: '#0b1420',
    title: 'Tinga Sneek – wijkeditor',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  venster.loadURL(`http://127.0.0.1:${port}/index.html`);

  const menu = Menu.buildFromTemplate([
    {
      label: 'Wijk',
      submenu: [
        { label: 'Editor aan/uit (F2)', click: () => venster.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'F2' }) },
        { label: 'Rijen opslaan (Ctrl+S)', accelerator: 'CmdOrCtrl+Shift+S', click: () => venster.webContents.executeJavaScript('window.__game && window.__game.editor && window.__game.editor.opslaan()') },
        { type: 'separator' },
        { label: 'Map met rows.user.js openen', click: () => shell.openPath(path.join(APP_DIR, 'js')) },
        { type: 'separator' },
        { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' },
        { type: 'separator' }, { role: 'quit', label: 'Afsluiten' },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

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

app.whenReady().then(maakVenster);
app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) maakVenster(); });

process.on('uncaughtException', err => {
  dialog.showErrorBox('Tinga', String(err && err.stack || err));
});
