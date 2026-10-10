/*
 Een dienst als dj bij Radio Tinga (stap 131).

 Gevraagd op 10 okt 2026: "Bedenk ook dat je iets bij radio Tinga kan doen bij de schuifknoppen enzo." Buiten de
 missies staat de studio open (js/studio.js). Aan de tafel, met E: Sjors laat je even de knoppen. Je kiest met 1, 2
 of 3 het volgende nummer op Radio Tinga (uit audio/radio/zenders.json); de schuif gaat omhoog, ON AIR gaat aan, en
 in elke auto speelt dat nummer als volgende op Radio Tinga (`geluid.radioVerzoek`). Met 4 draai je een jingle, met
 5 stop je. Een dienst betaalt DJ.loon, hoogstens eens per DJ.rust tellen, en het nieuws meldt het
 (`nieuws.meld('dj', …)`).

   initDjDienst({ studio, geluid, hud, player, verdien, nieuws }) → { update(dt, { vrij }), toets(), kies(n), get open, stop() }
*/
export const DJ = { loon: 75, rust: 240, schuifTempo: 1.6 };

export function initDjDienst({ studio, geluid, hud, player, verdien = () => {}, nieuws = null }) {
  let open = false, lijst = [], gekozen = null, rustT = 0, schuifDoel = 0, diensten = 0, beweegt = false;
  // (alleen na een eigen keuze aan de schuif trekken: missie 18 zet hem ook)
  const schuifNaar = (v) => { schuifDoel = v; beweegt = true; };

  async function laadLijst() {
    try {
      const z = await fetch('audio/radio/zenders.json').then(r => r.json());
      const t = (z.zenders || []).find(q => q.naam === 'Radio Tinga');
      lijst = t ? t.nummers.slice(0, 3) : [];
    } catch { lijst = []; }
  }
  laadLijst();

  function toonKeuze() {
    const regels = lijst.map((n, i) => `${i + 1} — ${n.titel}${n.artiest ? ` (${n.artiest})` : ''}`);
    hud.melding('RADIO TINGA · JIJ DRAAIT', `${regels.join(' · ')} · 4 — jingle · 5 — stoppen`, 12);
  }

  return {
    get open() { return open; },
    get gekozen() { return gekozen; },
    get diensten() { return diensten; },
    get lijst() { return lijst; },
    // E aan de tafel van de studio: de knoppen overnemen
    toets() {
      if (!studio || !studio.bijTafel || player.inCar) return false;
      if (!studio.bijTafel(player.pos.x, player.pos.z)) return false;
      if (open) { this.stop(); return true; }
      if (!lijst.length) { hud.melding('Radio Tinga', 'Sjors: "Even geduld, de lijst laadt nog."', 3); return true; }
      open = true; schuifNaar(0.35);
      toonKeuze();
      return true;
    },
    // 1–5 terwijl je aan de knoppen zit
    kies(n) {
      if (!open) return false;
      if (n >= 1 && n <= lijst.length) {
        gekozen = lijst[n - 1];
        if (geluid.radioVerzoek) geluid.radioVerzoek(gekozen.bestand);
        schuifNaar(1);
        if (studio.zetOnAir) studio.zetOnAir(true);
        hud.melding('ON AIR', `"Dit is Radio Tinga, en nu: ${gekozen.titel}." Het speelt straks in elke auto op Radio Tinga.`, 6);
        if (rustT <= 0) {
          verdien(DJ.loon); diensten++; rustT = DJ.rust;
          hud.show(`Sjors stopt je € ${DJ.loon} toe`, 2.6);
          if (nieuws && nieuws.meld) nieuws.meld('dj', player.pos.x, player.pos.z);
        }
        return true;
      }
      if (n === 4) {
        if (geluid.aftelPiep) { geluid.aftelPiep(false); setTimeout(() => geluid.aftelPiep(true), 380); }
        schuifNaar(0.8);
        hud.show('♪ Radio Tinga — 87.9 FM ♪', 2);
        return true;
      }
      if (n === 5) { this.stop(); return true; }
      return false;
    },
    stop() {
      if (!open) return;
      open = false; schuifNaar(0);
      if (studio.zetOnAir) studio.zetOnAir(false);
      hud.show('Je geeft de knoppen terug aan Sjors', 2.2);
    },
    update(dt, { vrij = true } = {}) {
      if (rustT > 0) rustT -= dt;
      if (open && (!vrij || !studio.bijTafel || !studio.bijTafel(player.pos.x, player.pos.z))) this.stop();
      // de schuif glijdt naar zijn doel
      if (beweegt && studio.zetSchuif && studio.schuif !== undefined) {
        const s = studio.schuif;
        if (Math.abs(s - schuifDoel) > 0.005) studio.zetSchuif(s + Math.sign(schuifDoel - s) * Math.min(Math.abs(schuifDoel - s), DJ.schuifTempo * dt));
        else beweegt = false;
      }
    },
  };
}
