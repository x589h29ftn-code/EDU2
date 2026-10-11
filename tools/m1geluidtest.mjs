/*
 De geluiden van de M1 en de stad (stap 139, 11 okt 2026), nagemeten.

   node tools/server.mjs 8123 &   node tools/m1geluidtest.mjs [poort]   (npm run m1geluidtest)

 Laadt alleen js/audio.js (dat importeert niets), dus snel.

 1. De drie nieuwe bestanden zijn er (geen 404) en laten zich ontleden; hun niveaus gemeten (piek, RMS over 300 ms
    na het begin, waar het geluid begint en ophoudt).
 2. Het schot van de garand komt uit m1_schot.mp3: vanaf de knal, alleen het eerste schot, in volume bij de sniper
    (niet meer dan 3 dB harder) en boven het pistool.
 3. Op afstand zachter en doffer; twee schoten vlak na elkaar uit één bron: het eerste wordt afgekapt.
 4. De ping komt uit m1_clip.mp3, vanaf de ping zelf, 12 tot 15 dB onder het garandschot (gain × RMS).
 5. Zonder opname (een wapen zonder `url`) blijft schot.mp3; zonder clip-opname de gemaakte ping (de code).
 6. De stadsachtergrond is stad.mp3, streamend, heel zacht (zachter dan de oude dag), 's nachts nog zachter, buiten
    de stad zachter.
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fouten++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);
const dB = x => 20 * Math.log10(x);
const f1 = x => (x == null || !isFinite(x)) ? String(x) : x.toFixed(1);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
const missend = [];
page.on('response', r => { if (r.status() >= 400) missend.push(`${r.status()} ${r.url()}`); });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/package.json`, { waitUntil: 'load', timeout: 120000 });

// ------------------------------------------------------------------ 1. de bestanden
kop('de bestanden en hun niveaus');
const nv = await page.evaluate(async () => {
  const ctx = new OfflineAudioContext(1, 44100, 44100);
  const meet = async (url, stuk) => {
    const r = await fetch('/' + url);
    if (!r.ok) return { status: r.status };
    let ab = await r.arrayBuffer();
    const bytes = ab.byteLength;
    // lange opnames: een stuk van 2 MB uit het midden (de hele zou honderden MB ontleed zijn)
    if (stuk && bytes > 3 * stuk) ab = ab.slice(Math.floor(bytes / 2), Math.floor(bytes / 2) + stuk);
    const b = await ctx.decodeAudioData(ab);
    const sr = b.sampleRate, L = b.length, K = b.numberOfChannels;
    const d = new Float32Array(L);
    for (let c = 0; c < K; c++) { const x = b.getChannelData(c); for (let i = 0; i < L; i++) d[i] += x[i] / K; }
    let piek = 0; for (let i = 0; i < L; i++) piek = Math.max(piek, Math.abs(d[i]));
    const rms = (a, z) => { let s = 0, n = 0; for (let i = Math.round(a * sr); i < Math.min(L, Math.round(z * sr)); i++, n++) s += d[i] * d[i]; return Math.sqrt(s / Math.max(1, n)); };
    const N = Math.round(sr * 0.005); let begin = 0;
    for (let i = 0; i < L; i += N) if (rms(i / sr, (i + N) / sr) > piek * 0.0316) { begin = Math.max(0, i / sr - 0.004); break; }
    // de omhullende per 50 ms na het begin (om een tweede schot of een ping erachter te zien)
    const omh = [];
    for (let t = begin; t < b.duration; t += 0.05) omh.push(+(20 * Math.log10(rms(t, t + 0.05) + 1e-9)).toFixed(0));
    return { status: r.status, bytes, duur: b.duration, piek, begin, rms300: rms(begin, begin + 0.3), rmsAlles: rms(0, b.duration), omh };
  };
  return {
    schot: await meet('audio/wapen/schot.mp3'),
    m1schot: await meet('audio/wapen/m1_schot.mp3'),
    clip: await meet('audio/wapen/m1_clip.mp3'),
    stad: await meet('audio/sfeer/stad.mp3', 2000000),
    oudDag: await meet('audio/sfeer/achtergrond1.mp3', 2000000),
  };
});
for (const [k, m] of Object.entries(nv)) {
  console.log(`       ${k.padEnd(8)} ${m.status} ${(m.bytes / 1e6).toFixed(2)} MB, ${m.duur.toFixed(2)} s, piek ${f1(dB(m.piek))} dB, begin ${m.begin.toFixed(3)} s, ` +
    `RMS 300 ms ${f1(dB(m.rms300))} dB, RMS geheel ${f1(dB(m.rmsAlles))} dB`);
}
ok(['m1schot', 'clip', 'stad'].every(k => nv[k].status === 200 && nv[k].duur > 0.3), 'de drie nieuwe bestanden zijn er en laten zich ontleden');
// één schot: na de eerste 150 ms geen stuk dat 6 dB boven het vorige uitkomt (geen tweede knal, geen ping erachter)
const sprongen = nv.m1schot.omh.slice(3).map((v, i, a) => i ? v - a[i - 1] : 0);
ok(Math.max(...sprongen) < 6, 'm1_schot.mp3 is één schot, zonder tweede knal of ping erachter',
  `grootste stijging na 150 ms ${Math.max(...sprongen)} dB; omhullende ${nv.m1schot.omh.slice(0, 12).join(' ')} …`);

// ------------------------------------------------------------------ 2–5. het spel
const sp = await page.evaluate(async () => {
  const A = await import('/js/audio.js'), G = A.geluid;
  G.start();
  await Promise.all([G.laadSchot(), G.laadWapenOpnames()]);
  G.zetSchotSoort('opname');
  const uit = { opnames: G.wapenOpnameStand(), SCHOT: A.SCHOT, M1_CLIP: A.M1_CLIP, ACHTERGROND: A.ACHTERGROND, ctx: null };
  const schot = (afstand, wapen, bron) => { G.schot(afstand, { wapen, bron }); return { ...G.schotStand().laatste }; };
  uit.garand = schot(0, 'garand', 'proefA');
  uit.garandVer = schot(60, 'garand', 'proefB');
  uit.sniper = schot(0, 'sniper', 'proefC');
  uit.pistool = schot(0, 'pistool', 'proefD');
  // afkappen: twee schoten uit één bron vlak na elkaar
  G.schot(0, { wapen: 'garand', bron: 'kap' });
  G.schot(0, { wapen: 'garand', bron: 'kap' });
  uit.kapStemmen = G.schotStand('kap').stemmen;
  const p0 = G.m1Pings || 0;
  G.m1Ping();
  uit.pings = (G.m1Pings || 0) - p0;
  uit.ping = G.wapenOpnameStand().laatstePing;
  uit.bron = await fetch('/js/audio.js').then(r => r.text());
  // de achtergrond: dag in de stad, dag op het land, nacht in de stad
  const wacht = (ms) => new Promise(r => setTimeout(r, ms));
  const zet = async (nacht, stad) => {
    let st = null;
    for (let i = 0; i < 40; i++) { G.achtergrond(nacht, false, stad); await wacht(150); st = G.achtergrondStand(); }
    return st;
  };
  uit.dag = await zet(false, 1);
  uit.land = await zet(false, 0);
  uit.nacht = await zet(true, 1);
  return uit;
});

kop('het schot van de garand');
const S = sp.SCHOT;
ok(sp.opnames.garand && sp.garand.opname && sp.garand.bestand === 'm1_schot.mp3', 'de garand speelt m1_schot.mp3', JSON.stringify(sp.opnames.garand));
ok(sp.garand.offset > 0.02 && sp.garand.offset < 0.06 && Math.abs(sp.garand.offset - nv.m1schot.begin) < 0.01,
  'vanaf de knal: de stilte vooraf eraf', `offset ${sp.garand.offset.toFixed(3)} s (gemeten begin ${nv.m1schot.begin.toFixed(3)} s)`);
ok(sp.garand.duur > 1 && sp.garand.duur < nv.m1schot.duur, 'alleen het eerste schot, tot het wegsterft', `${sp.garand.duur.toFixed(2)} van ${nv.m1schot.duur.toFixed(2)} s`);
const niveau = {
  pistool: dB(nv.schot.rms300 * S.pistool.vol),
  sniper: dB(nv.schot.rms300 * S.sniper.vol),
  garand: dB(nv.m1schot.rms300 * S.garand.vol),
  garandOud: dB(nv.schot.rms300 * S.garand.terug.vol),
};
console.log(`       niveaus (RMS 300 ms × gain): pistool ${f1(niveau.pistool)}, sniper ${f1(niveau.sniper)}, garand ${f1(niveau.garand)} dB ` +
  `(de oude garand met schot.mp3 ${f1(niveau.garandOud)} dB); gains ${S.pistool.vol} / ${S.sniper.vol} / ${S.garand.vol}`);
ok(niveau.garand - niveau.sniper < 3 && niveau.garand - niveau.sniper > -1, 'de garand in volume bij de sniper (niet meer dan 3 dB harder)',
  `${f1(niveau.garand - niveau.sniper)} dB`);
ok(niveau.garand > niveau.pistool, 'en zwaarder dan het pistool', `${f1(niveau.garand - niveau.pistool)} dB`);
ok(Math.abs(sp.garand.gain - S.garand.vol) < 1e-6, 'de gain van het schot is die van SCHOT.garand', `${sp.garand.gain}`);
ok(sp.sniper.bestand === 'schot.mp3' && sp.pistool.bestand === 'schot.mp3', 'de andere wapens houden schot.mp3');

kop('op afstand en afkappen');
ok(sp.garandVer.gain < sp.garand.gain * 0.5 && sp.garandVer.lp < sp.garand.lp, 'op 60 m zachter en doffer',
  `gain ${sp.garand.gain.toFixed(3)} → ${sp.garandVer.gain.toFixed(3)}, laagdoorlaat ${Math.round(sp.garand.lp)} → ${Math.round(sp.garandVer.lp)} Hz`);
ok(sp.kapStemmen === 1, 'twee schoten uit één bron: het eerste wordt afgekapt', `${sp.kapStemmen} stem(men)`);

kop('de ping van de clip');
const pingNiveau = dB(nv.clip.rms300 * sp.M1_CLIP.vol);
ok(sp.pings === 1 && sp.ping && sp.ping.opname, 'de ping speelt m1_clip.mp3', JSON.stringify(sp.ping));
ok(sp.ping.offset > 0.15 && Math.abs(sp.ping.offset - nv.clip.begin) < 0.01, 'vanaf de ping zelf: 0,2 s stilte en geritsel eraf',
  `offset ${sp.ping.offset.toFixed(3)} s`);
ok(niveau.garand - pingNiveau >= 12 && niveau.garand - pingNiveau <= 15, 'de ping 12 tot 15 dB onder het garandschot',
  `ping ${f1(pingNiveau)} dB, schot ${f1(niveau.garand)} dB: ${f1(niveau.garand - pingNiveau)} dB eronder (gain ${sp.M1_CLIP.vol})`);
ok(/m1Ping\(\)[\s\S]{0,900}laatstePing = \{ opname: false \}[\s\S]{0,300}2950/.test(sp.bron), 'zonder opname de gemaakte ping (terugval)');
ok(/eigen \|\| !S\.terug \? S : S\.terug/.test(sp.bron) && S.garand.terug, 'zonder opname het garandschot uit schot.mp3 (terugval)');

kop('de stadsachtergrond');
const A = sp.ACHTERGROND;
const nieuwDag = dB(nv.stad.rmsAlles * A.stad.vol), oudDag = dB(nv.oudDag.rmsAlles * 0.12);
console.log(`       stad.mp3 ${f1(dB(nv.stad.rmsAlles))} dB × ${A.stad.vol} = ${f1(nieuwDag)} dB; oud achtergrond1 ${f1(dB(nv.oudDag.rmsAlles))} dB × 0,12 = ${f1(oudDag)} dB`);
ok(sp.dag && sp.dag.bestand === 'stad.mp3' && !sp.dag.stuk && sp.dag.aan, 'de achtergrond is stad.mp3, streamend', JSON.stringify(sp.dag));
ok(nieuwDag < oudDag - 6, 'heel zacht: minstens 6 dB zachter dan de oude dag', `${f1(nieuwDag - oudDag)} dB`);
ok(sp.dag.volume > 0.6 * A.stad.vol && sp.land.volume < sp.dag.volume * 0.5 && sp.nacht.volume < sp.dag.volume * 0.6,
  'buiten de stad en \'s nachts zachter', `dag ${sp.dag.volume}, land ${sp.land.volume}, nacht ${sp.nacht.volume}`);
ok(!/achtergrond[12]\.mp3/.test(sp.bron.replace(/\/\*[\s\S]*?\*\//g, '')), 'de oude opnames staan niet meer in de code (alleen in het commentaar)');

ok(missend.length === 0, 'geen 404', missend.join(', '));
await browser.close();
console.log(fouten ? `\n${fouten} FOUT` : '\nalles goed');
process.exit(fouten ? 1 : 0);
