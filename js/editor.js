// Wijkeditor: huizenrijen selecteren, verplaatsen, draaien, toevoegen en
// verwijderen zonder de code aan te raken. F2 zet hem aan en uit.
//
// De editor werkt op ROWS uit data.js. Een rij is een lijnstuk a->b in
// kaartpixels met een afstand tot de wegas (off), een diepte en een woningtype.
// Wijzigingen blijven in localStorage staan en kun je met Ctrl+S wegschrijven
// naar js/rows.user.js, dat bij het opstarten voorrang krijgt boven data.js.
import * as THREE from 'three';
import { ROWS, PX_PER_M, toWorld, toPx } from './data.js';
import { HOUSE_STYLES } from './textures.js';
import { resetWorld, buildWorld } from './world.js';

const TYPES = Object.keys(HOUSE_STYLES);
const OPSLAG = 'tinga.rows.v1';

// ---------- opslag ----------
export function opgeslagenRijen() {
  try {
    const raw = localStorage.getItem(OPSLAG);
    if (!raw) return null;
    const rows = JSON.parse(raw);
    return Array.isArray(rows) && rows.length ? rows : null;
  } catch { return null; }
}

export function pasRijenToe(rows) {
  ROWS.length = 0;
  rows.forEach((r, i) => ROWS.push({ ...r, src: i }));
}

function bewaarLokaal() {
  try { localStorage.setItem(OPSLAG, JSON.stringify(schoneRijen())); } catch {}
}

// zonder de velden die de wereldopbouw er zelf bij zet
function schoneRijen() {
  return ROWS.map(r => {
    const o = {};
    for (const [k, v] of Object.entries(r)) {
      if (k === 'src' || k === 'generated' || k === 'contiguous' || v === undefined || v === null) continue;
      o[k] = v;
    }
    return o;
  });
}

// ---------- broncode genereren ----------
export function rijenAlsBestand() {
  const regels = schoneRijen().map(r => {
    const opts = {};
    for (const [k, v] of Object.entries(r)) {
      if (['a', 'b', 'off', 'depth', 'type'].includes(k)) continue;
      opts[k] = v;
    }
    const staart = Object.keys(opts).length ? `, ${JSON.stringify(opts)}` : '';
    const n = x => Math.round(x * 10) / 10;
    return `  R(${n(r.a[0])},${n(r.a[1])}, ${n(r.b[0])},${n(r.b[1])}, ${n(r.off)}, ${n(r.depth)}, '${r.type}'${staart}),`;
  });
  return `// Huizenrijen, opgeslagen vanuit de wijkeditor (F2 in het spel).
// Dit bestand krijgt voorrang boven de rijen in data.js. Verwijder het om
// terug te vallen op de originele kaart.
// Opgeslagen: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}
const R = (ax, ay, bx, by, off, depth, type, opts = {}) => ({ a: [ax, ay], b: [bx, by], off, depth, type, ...opts });

export const ROWS = [
${regels.join('\n')}
];
`;
}

// ---------- de editor ----------
export function initEditor(ctx) {
  const { scene, camera, player, hud, npcs, vehicles, onRebuild } = ctx;
  const paneel = document.getElementById('editor');
  if (!paneel) return null;

  let actief = false;
  let sel = null;                 // index in ROWS
  let grijpen = false;            // rij volgt het vizier
  let grijpBasis = null;
  const geschiedenis = [];
  let laatsteType = 'molenkrite';
  let herbouwTimer = null;

  const raycaster = new THREE.Raycaster();
  const grondVlak = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hulp = new THREE.Group();
  hulp.visible = false;
  scene.add(hulp);
  const kader = new THREE.Box3Helper(new THREE.Box3(), 0xffd400);
  const as = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineBasicMaterial({ color: 0x00e5ff }));
  hulp.add(kader, as);

  // ---------- hulpjes ----------
  const rij = () => (sel != null ? ROWS[sel] : null);

  function groepenVan(src) {
    const uit = [];
    scene.traverse(o => { if (o.isGroup && o.userData && o.userData.src === src && !o.userData.generated) uit.push(o); });
    return uit;
  }

  function vizierOpGrond() {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const p = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(grondVlak, p) && p.distanceTo(camera.position) < 400) return p;
    // kijk je horizontaal of omhoog, dan pakken we een punt vijfentwintig meter
    // voor de camera op maaiveld
    const f = new THREE.Vector3(); camera.getWorldDirection(f);
    f.y = 0; if (f.lengthSq() < 1e-6) f.set(0, 0, -1); f.normalize();
    return new THREE.Vector3(camera.position.x + f.x * 25, 0, camera.position.z + f.z * 25);
  }

  function bewaarStap() {
    geschiedenis.push(JSON.stringify(schoneRijen()));
    if (geschiedenis.length > 60) geschiedenis.shift();
  }

  function herbouw(direct = false) {
    clearTimeout(herbouwTimer);
    const doen = () => {
      const bewaardSel = sel;
      resetWorld(scene);
      buildWorld(scene);
      if (onRebuild) onRebuild();
      sel = bewaardSel;
      markeer();
      bewaarLokaal();
      toon();
    };
    if (direct) doen(); else herbouwTimer = setTimeout(doen, 350);
  }

  function markeer() {
    const groepen = sel == null ? [] : groepenVan(sel);
    if (!groepen.length) { hulp.visible = false; return; }
    const box = new THREE.Box3();
    for (const g of groepen) box.union(new THREE.Box3().setFromObject(g));
    box.expandByScalar(0.25);
    kader.box.copy(box);
    const r = rij();
    const [ax, az] = toWorld(r.a[0], r.a[1]);
    const [bx, bz] = toWorld(r.b[0], r.b[1]);
    as.geometry.setFromPoints([new THREE.Vector3(ax, 0.4, az), new THREE.Vector3(bx, 0.4, bz)]);
    hulp.visible = true;
  }

  // ---------- bewerkingen ----------
  function verschuif(dxPx, dyPx) {
    const r = rij(); if (!r) return;
    r.a = [r.a[0] + dxPx, r.a[1] + dyPx];
    r.b = [r.b[0] + dxPx, r.b[1] + dyPx];
  }

  function draai(graden) {
    const r = rij(); if (!r) return;
    const cx = (r.a[0] + r.b[0]) / 2, cy = (r.a[1] + r.b[1]) / 2;
    const c = Math.cos(graden * Math.PI / 180), s = Math.sin(graden * Math.PI / 180);
    const dr = ([x, y]) => { const dx = x - cx, dy = y - cy; return [cx + dx * c - dy * s, cy + dx * s + dy * c]; };
    r.a = dr(r.a); r.b = dr(r.b);
  }

  function rek(meters) {
    const r = rij(); if (!r) return;
    const dx = r.b[0] - r.a[0], dy = r.b[1] - r.a[1];
    const len = Math.hypot(dx, dy) || 1;
    const nieuw = Math.max(PX_PER_M * 4, len + meters * PX_PER_M);
    r.b = [r.a[0] + dx / len * nieuw, r.a[1] + dy / len * nieuw];
  }

  function nieuweRij() {
    const p = vizierOpGrond(); if (!p) return;
    const [px, py] = toPx(p.x, p.z);
    // langs de kijkrichting, dertig meter lang
    const f = new THREE.Vector3(); camera.getWorldDirection(f);
    const [fx, fy] = [f.x, f.z];
    const l = Math.hypot(fx, fy) || 1;
    const L = 30 * PX_PER_M;
    bewaarStap();
    ROWS.push({
      src: ROWS.length,
      a: [Math.round(px), Math.round(py)],
      b: [Math.round(px + fx / l * L), Math.round(py + fy / l * L)],
      off: 10, depth: 9, type: laatsteType,
    });
    sel = ROWS.length - 1;
    herbouw(true);
  }

  function verwijder() {
    if (sel == null) return;
    bewaarStap();
    ROWS.splice(sel, 1);
    ROWS.forEach((r, i) => { r.src = i; });
    sel = null;
    herbouw(true);
  }

  function dupliceer() {
    const r = rij(); if (!r) return;
    bewaarStap();
    const kopie = { ...r, src: ROWS.length, a: [...r.a], b: [...r.b], off: -r.off };
    ROWS.push(kopie);
    sel = ROWS.length - 1;
    herbouw(true);
  }

  function terug() {
    if (!geschiedenis.length) return;
    pasRijenToe(JSON.parse(geschiedenis.pop()));
    if (sel != null && sel >= ROWS.length) sel = null;
    herbouw(true);
  }

  // ---------- opslaan ----------
  async function opslaan() {
    const tekst = rijenAlsBestand();
    bewaarLokaal();
    if (window.tinga && window.tinga.saveRows) {
      const uit = await window.tinga.saveRows(tekst);
      hud.show(uit && uit.ok ? `Opgeslagen in ${uit.path}` : `Opslaan mislukt: ${uit && uit.error}`, 4);
      return;
    }
    const blob = new Blob([tekst], { type: 'text/javascript' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'rows.user.js';
    a.click(); URL.revokeObjectURL(a.href);
    hud.show('rows.user.js gedownload – zet hem in de map js/', 5);
  }

  async function naarKlembord() {
    try { await navigator.clipboard.writeText(rijenAlsBestand()); hud.show('Rijen naar het klembord', 3); }
    catch { hud.show('Klembord geweigerd; gebruik Ctrl+S', 3); }
  }

  function origineelHerstellen() {
    localStorage.removeItem(OPSLAG);
    hud.show('Lokale wijzigingen gewist – pagina wordt herladen', 3);
    setTimeout(() => location.reload(), 600);
  }

  // ---------- paneel ----------
  function toon() {
    if (!actief) { paneel.style.display = 'none'; return; }
    paneel.style.display = 'block';
    const r = rij();
    const info = r
      ? `<b>rij ${sel}</b> &nbsp; <span class="t">${r.type}</span><br>
         a ${Math.round(r.a[0])},${Math.round(r.a[1])} &nbsp; b ${Math.round(r.b[0])},${Math.round(r.b[1])}<br>
         afstand tot wegas ${r.off.toFixed(1)} m &nbsp; diepte ${r.depth.toFixed(1)} m
         &nbsp; lengte ${(Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]) / PX_PER_M).toFixed(1)} m
         ${r.flip ? '&nbsp; <i>omgedraaid</i>' : ''}`
      : '<i>niets geselecteerd – richt het vizier op een huis en klik</i>';
    paneel.innerHTML = `
      <div class="kop">WIJKEDITOR ${grijpen ? '· <span class="g">verplaatsen</span>' : ''}</div>
      <div class="sel">${info}</div>
      <table>
        <tr><td>klik</td><td>rij kiezen</td><td>Tab</td><td>volgende rij</td></tr>
        <tr><td>G</td><td>verplaatsen, klik = neerzetten</td><td>Esc</td><td>afbreken</td></tr>
        <tr><td>pijltjes</td><td>1 px verschuiven (shift = 5)</td><td>[ ]</td><td>draaien</td></tr>
        <tr><td>, .</td><td>dichter bij / verder van de weg</td><td>- =</td><td>korter / langer</td></tr>
        <tr><td>9 0</td><td>diepte</td><td>T / shift+T</td><td>woningtype</td></tr>
        <tr><td>F</td><td>gevel omdraaien</td><td>N</td><td>nieuwe rij op het vizier</td></tr>
        <tr><td>Del</td><td>rij weghalen</td><td>Ctrl+D</td><td>rij aan de overkant</td></tr>
        <tr><td>Ctrl+Z</td><td>ongedaan maken</td><td>Ctrl+S</td><td>opslaan naar rows.user.js</td></tr>
        <tr><td>Ctrl+E</td><td>naar klembord</td><td>Ctrl+Alt+R</td><td>origineel herstellen</td></tr>
        <tr><td>W A S D</td><td>vliegen (shift = snel)</td><td>Q E</td><td>omlaag / omhoog</td></tr>
      </table>
      <div class="voet">${ROWS.length} rijen · F2 sluit de editor</div>`;
  }

  // ---------- invoer ----------
  function kies() {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    raycaster.far = 400;
    const treffers = raycaster.intersectObjects(scene.children, true);
    for (const t of treffers) {
      let o = t.object;
      while (o && !(o.isGroup && o.userData && o.userData.src !== undefined)) o = o.parent;
      if (o && !o.userData.generated) { sel = o.userData.src; markeer(); toon(); return true; }
    }
    return false;
  }

  window.addEventListener('keydown', e => {
    if (e.code === 'F2') {
      e.preventDefault();
      zet(!actief);
      return;
    }
    if (!actief) return;
    const shift = e.shiftKey, ctrl = e.ctrlKey || e.metaKey;

    if (ctrl && e.code === 'KeyS') { e.preventDefault(); opslaan(); return; }
    if (ctrl && e.code === 'KeyE') { e.preventDefault(); naarKlembord(); return; }
    if (ctrl && e.altKey && e.code === 'KeyR') { e.preventDefault(); origineelHerstellen(); return; }
    if (ctrl && e.code === 'KeyZ') { e.preventDefault(); terug(); return; }
    if (ctrl && e.code === 'KeyD') { e.preventDefault(); dupliceer(); return; }
    if (e.code === 'KeyN') { e.preventDefault(); nieuweRij(); return; }
    if (e.code === 'Tab') {
      e.preventDefault();
      sel = sel == null ? 0 : (sel + (shift ? -1 : 1) + ROWS.length) % ROWS.length;
      markeer(); toon(); return;
    }
    if (e.code === 'Escape' && grijpen) { grijpen = false; if (grijpBasis) { const r = rij(); r.a = grijpBasis.a; r.b = grijpBasis.b; herbouw(true); } toon(); return; }

    if (sel == null) return;
    const r = rij();
    const stap = shift ? 5 : 1;
    const voorstand = JSON.stringify(schoneRijen());   // eerst bewaren, dan pas wijzigen
    let veranderd = true;
    switch (e.code) {
      case 'KeyG': bewaarStap(); grijpen = !grijpen; grijpBasis = { a: [...r.a], b: [...r.b] }; toon(); return;
      case 'ArrowLeft':  verschuif(-stap, 0); break;
      case 'ArrowRight': verschuif(stap, 0); break;
      case 'ArrowUp':    verschuif(0, -stap); break;
      case 'ArrowDown':  verschuif(0, stap); break;
      case 'BracketLeft':  draai(-(shift ? 5 : 1)); break;
      case 'BracketRight': draai(shift ? 5 : 1); break;
      case 'Comma':  r.off -= (shift ? 2 : 0.5); break;
      case 'Period': r.off += (shift ? 2 : 0.5); break;
      case 'Minus':  rek(-(shift ? 10 : 2)); break;
      case 'Equal':  rek(shift ? 10 : 2); break;
      case 'Digit9': r.depth = Math.max(4, r.depth - 0.5); break;
      case 'Digit0': r.depth = Math.min(20, r.depth + 0.5); break;
      case 'KeyT': {
        const i = TYPES.indexOf(r.type);
        r.type = TYPES[(i + (shift ? -1 : 1) + TYPES.length) % TYPES.length];
        laatsteType = r.type; break;
      }
      case 'KeyF': r.flip = !r.flip; break;
      case 'Delete': case 'Backspace': verwijder(); return;
      default: veranderd = false;
    }
    if (!veranderd) return;
    e.preventDefault();
    geschiedenis.push(voorstand);
    if (geschiedenis.length > 60) geschiedenis.shift();
    herbouw();
    toon();
  });

  document.addEventListener('mousedown', e => {
    if (!actief || e.button !== 0) return;
    if (grijpen) { grijpen = false; herbouw(true); toon(); return; }
    kies();
  }, true);

  // ---------- aan/uit ----------
  function zet(aan) {
    actief = aan;
    player.fly = aan;
    if (aan) {
      player.pos.y = Math.max(player.pos.y, 6);
      for (const m of npcs.targets) m.visible = false;
      for (const c of vehicles.cars) c.mesh.visible = false;
      hud.show('Wijkeditor aan – F2 om te sluiten', 3);
    } else {
      for (const m of npcs.targets) m.visible = true;
      for (const c of vehicles.cars) c.mesh.visible = true;
      player.pos.y = 0;
      hulp.visible = false;
    }
    toon();
  }

  // per frame: de gegrepen rij volgt het vizier
  function update() {
    if (!actief) return;
    if (grijpen && sel != null) {
      const p = vizierOpGrond();
      if (p) {
        const r = rij();
        const [px, py] = toPx(p.x, p.z);
        const cx = (r.a[0] + r.b[0]) / 2, cy = (r.a[1] + r.b[1]) / 2;
        verschuif(px - cx, py - cy);
        // tijdens het slepen alleen de groep meeschuiven, geen volledige herbouw
        for (const g of groepenVan(sel)) {
          g.position.x += (px - cx) / PX_PER_M;
          g.position.z += (py - cy) / PX_PER_M;
        }
        markeer();
      }
    }
  }

  return { update, get actief() { return actief; }, zet, opslaan };
}
