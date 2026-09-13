/*
 Een piepklein statisch servertje voor het spel, met één ding dat
 `python3 -m http.server` niet heeft: **Range-verzoeken**.

 Dat is nodig sinds Radio Spannenburg erin zit, een uitzending van een uur. Wil
 je daar ergens in het midden beginnen, dan vraagt de browser alleen dat stuk op
 (`Range: bytes=…`). Een server die dat negeert en gewoon het hele bestand met
 status 200 terugstuurt, laat de browser niet springen: `currentTime` blijft op
 nul staan. GitHub Pages kan het wel, de Electron-schil (desktop/main.cjs) sinds
 kort ook, en dit servertje dus ook — zodat de proeven hetzelfde gedrag zien als
 een speler.

 Gebruik: node tools/server.mjs [poort]     (standaard 8123)
*/
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const WORTEL = fileURLToPath(new URL('..', import.meta.url));
const poort = Number(process.argv[2] || 8123);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.wav': 'audio/wav',
  '.woff2': 'font/woff2', '.gpkg': 'application/octet-stream',
};

createServer((req, res) => {
  const pad = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const bestand = join(WORTEL, normalize(pad === '/' ? 'index.html' : pad).replace(/^(\.\.[/\\])+/, ''));
  if (!bestand.startsWith(WORTEL)) { res.writeHead(403).end(); return; }
  let st;
  try { st = statSync(bestand); } catch { res.writeHead(404).end('niet gevonden'); return; }
  if (st.isDirectory()) { res.writeHead(403).end(); return; }
  const type = MIME[extname(bestand).toLowerCase()] || 'application/octet-stream';
  const bereik = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (bereik) {
    const van = bereik[1] ? Number(bereik[1]) : Math.max(0, st.size - Number(bereik[2]));
    const tot = bereik[2] && bereik[1] ? Math.min(Number(bereik[2]), st.size - 1) : st.size - 1;
    if (van >= st.size || van > tot) {
      res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }).end();
      return;
    }
    res.writeHead(206, {
      'Content-Type': type, 'Content-Length': tot - van + 1,
      'Content-Range': `bytes ${van}-${tot}/${st.size}`, 'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
    });
    createReadStream(bestand, { start: van, end: tot }).pipe(res);
    return;
  }
  res.writeHead(200, {
    'Content-Type': type, 'Content-Length': st.size,
    'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store',
  });
  createReadStream(bestand).pipe(res);
}).listen(poort, '127.0.0.1', () => console.log(`spel op http://127.0.0.1:${poort}/`));
