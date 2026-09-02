// Touchbesturing voor telefoon en tablet.
//
//   linkerhelft  virtuele joystick om te lopen (helemaal uitslaan = sprinten)
//   rechterhelft vegen om rond te kijken, korte tik = schot
//   knoppen      schieten, springen, herladen, in-/uitstappen, kaart, pauze
//
// De knoppen en de twee veeggebieden luisteren zelf naar touch-events, zodat
// meerdere vingers tegelijk werken: een touch die op een element begint stuurt
// zijn move- en end-events altijd naar datzelfde element.

const LOOK_SPEED = 0.0055;   // radialen per pixel veegafstand
const STICK_R = 52;          // px waarbij de stick volledig is uitgeslagen
const DEAD = 0.14;           // dode zone rond het midden
const SPRINT = 0.92;         // vanaf deze uitslag ga je rennen
const TAP = 12;              // veegafstand in px die nog als een tik telt

// Aanraakscherm? Met ?touch=1 of ?touch=0 forceer je het voor tests.
export function isTouchDevice() {
  const q = new URLSearchParams(location.search).get('touch');
  if (q === '1') return true;
  if (q === '0') return false;
  return (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window ||
    window.matchMedia('(pointer: coarse)').matches;
}

export function initTouchControls(player, opts = {}) {
  const root = document.getElementById('touch');
  if (!root) return null;
  document.body.classList.add('touch');
  const startBtn = document.getElementById('start');
  if (startBtn) startBtn.textContent = 'Tik om te spelen';

  const $ = id => root.querySelector('#' + id);
  const zone = $('tmove'), base = $('tstick'), knob = $('tknob'), look = $('tlook');

  // Is de vinger met dit id opgehouden? Niet elke browser vult changedTouches
  // bij touchend even netjes, dus vallen we terug op de lijst met vingers die
  // nog op het scherm staan.
  function released(e, id) {
    if (id === null) return false;
    for (const t of e.changedTouches) if (t.identifier === id) return true;
    for (const t of e.touches) if (t.identifier === id) return false;
    return true;
  }

  // ---------- loopstick ----------
  let stickId = null, ox = 0, oy = 0;

  function axis(x, y) {
    player.moveAxis.x = x;
    player.moveAxis.y = y;
    player.sprint = Math.hypot(x, y) > SPRINT;
  }

  function stickEnd(e) {
    if (e) {
      e.preventDefault();
      if (!released(e, stickId)) return;   // een tweede vinger in dit vak
    }
    stickId = null;
    base.classList.remove('on');
    knob.style.transform = 'translate(-50%,-50%)';
    axis(0, 0);
  }

  zone.addEventListener('touchstart', e => {
    e.preventDefault();
    if (stickId !== null) return;
    const t = e.changedTouches[0];
    stickId = t.identifier; ox = t.clientX; oy = t.clientY;
    base.style.left = ox + 'px'; base.style.top = oy + 'px';
    base.classList.add('on');
  }, { passive: false });

  zone.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== stickId) continue;
      const dx = t.clientX - ox, dy = t.clientY - oy;
      const d = Math.hypot(dx, dy);
      const m = Math.min(1, d / STICK_R);
      const nx = d > 0.001 ? dx / d : 0, ny = d > 0.001 ? dy / d : 0;
      knob.style.transform =
        `translate(calc(-50% + ${(nx * m * STICK_R).toFixed(1)}px), calc(-50% + ${(ny * m * STICK_R).toFixed(1)}px))`;
      // naar boven vegen is vooruit, dus de schermas keert om
      if (m < DEAD) axis(0, 0); else axis(nx * m, -ny * m);
    }
  }, { passive: false });

  zone.addEventListener('touchend', stickEnd, { passive: false });
  zone.addEventListener('touchcancel', stickEnd, { passive: false });

  // ---------- rondkijken ----------
  let lookId = null, lx = 0, ly = 0, dist = 0;

  function lookEnd(e) {
    e.preventDefault();
    if (!released(e, lookId)) return;
    if (dist < TAP) player.shoot();      // korte tik is een schot
    lookId = null;
  }

  look.addEventListener('touchstart', e => {
    e.preventDefault();
    if (lookId !== null) return;
    const t = e.changedTouches[0];
    lookId = t.identifier; lx = t.clientX; ly = t.clientY; dist = 0;
  }, { passive: false });

  look.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== lookId) continue;
      const dx = t.clientX - lx, dy = t.clientY - ly;
      lx = t.clientX; ly = t.clientY;
      dist += Math.abs(dx) + Math.abs(dy);
      player.lookBy(dx, dy, LOOK_SPEED);
    }
  }, { passive: false });

  look.addEventListener('touchend', lookEnd, { passive: false });
  look.addEventListener('touchcancel', lookEnd, { passive: false });

  // ---------- knoppen ----------
  function button(id, down, up) {
    const el = $(id);
    if (!el) return;
    el.addEventListener('touchstart', e => {
      e.preventDefault(); e.stopPropagation();
      el.classList.add('down');
      if (down) down();
    }, { passive: false });
    const end = e => {
      e.preventDefault(); e.stopPropagation();
      el.classList.remove('down');
      if (up) up();
    };
    el.addEventListener('touchend', end, { passive: false });
    el.addEventListener('touchcancel', end, { passive: false });
    // Ook met de muis bruikbaar, handig om de knoppen op een pc te testen.
    // Na een touch komt er geen click meer, want touchstart is afgevangen.
    el.addEventListener('click', e => {
      e.preventDefault();
      if (down) down();
      if (up) up();
    });
  }

  button('tfire', () => player.shoot());
  // springen meteen uitvoeren: een korte tik zou anders tussen twee beelden
  // door vallen. Space blijft ingedrukt voor de handrem in de auto.
  button('tjump', () => { player.keys.Space = true; player.jump(); }, () => { player.keys.Space = false; });
  button('treload', () => player.reload());
  button('tcar', () => opts.onCar && opts.onCar());
  button('tmap', () => opts.onMap && opts.onMap());
  button('tpause', () => opts.onPause && opts.onPause());

  function reset() { stickEnd(); lookId = null; player.keys.Space = false; }

  return {
    setVisible(v) {
      root.style.display = v ? 'block' : 'none';
      if (!v) reset();
    },
    reset,
  };
}
