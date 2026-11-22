// Lip-sync from sound (mouth swap drawings placed from the voice's loudness, one undo step) and the sound inside
// exported WebM videos.
const H = require('./harness.cjs');
const fs = require('fs'), path = require('path');
(async () => {
  const root = process.argv[2], out = process.argv[3] || '/tmp';
  const { pg, errors, done } = await H.open(root, 8914, { width: 1300, height: 860 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  // a 2 s "voice": silence, loud, quiet, loud — as a real WAV file through Animation › Import audio
  await pg.evaluate(async () => {
    const SF = window.__sketchforge, S = SF.scope; SF.newDocument(320, 240, 24, 12, false, 'Lips'); SF.CMD.layerAdd();
    const sr = 8000, n = sr * 2, b = new ArrayBuffer(44 + n * 2), v = new DataView(b), w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) { const t = i / sr, amp = t < 0.5 ? 0 : t < 1 ? 0.9 : t < 1.5 ? 0.15 : 0.9; v.setInt16(44 + i * 2, Math.sin(t * 2 * Math.PI * 220) * amp * 32767, true); }
    await S('audioImport')(new File([b], 'voice.wav', { type: 'audio/wav' }), true);
    // three mouths in the swap bar
    const l = SF.activeLayer(); l.swaps = ['closed', 'open', 'half'].map((name, i) => { const c = S('makeCel')(true), g = c.getContext('2d'); g.fillStyle = ['#000', '#f00', '#00f'][i]; g.fillRect(100, 100, 120, 20 + i * 10); return { id: 'm' + i, name, cel: c }; });
  });
  check('the voice is loaded', await pg.evaluate(() => !!window.__sketchforge.scope('aud.peaks')));
  await pg.evaluate(() => window.__sketchforge.CMD.lipSync()); await pg.waitForTimeout(300);
  await pg.evaluate(() => document.querySelector('dialog[open] button[value=ok]').click()); await pg.waitForTimeout(400);
  const keys = await pg.evaluate(() => { const l = window.__sketchforge.activeLayer(); return [...l.cels.entries()].sort((a, b) => a[0] - b[0]).map(([k, c]) => k + ':' + (c._swap || '-')); });
  console.log('     keys ' + keys.join(' '));
  const mouthAt = f => pg.evaluate(f => { const S = window.__sketchforge.scope, l = window.__sketchforge.activeLayer(), k = S('keyAt')(l, f); return k == null ? null : l.cels.get(k)._swap; }, f);
  check('silence = closed mouth (frame 2)', (await mouthAt(2)) === 'm0');
  check('loud = open mouth (frame 9)', (await mouthAt(9)) === 'm1');
  check('quiet = half-open mouth (frame 15)', (await mouthAt(15)) === 'm2');
  check('only where the mouth changes (few keyframes)', keys.length <= 6);
  await pg.evaluate(() => window.__sketchforge.CMD.undo());
  check('one undo removes the lip-sync', await pg.evaluate(() => window.__sketchforge.activeLayer().cels.size === 1));
  // export a WebM with the sound
  await pg.evaluate(() => { const S = window.__sketchforge.scope; S('openExport()'); const f = document.querySelector('#expFmt') || document.querySelector('#exportDialog select'); if (f) { f.value = 'webm'; f.dispatchEvent(new Event('change')); } });
  check('the export window offers "Include the sound"', await pg.evaluate(() => !!document.querySelector('#expSound') && document.querySelector('#expSound').checked));
  const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 60000 }), pg.click('#expGo')]);
  const fl = path.join(out, 'lips.webm'); await dl.saveAs(fl);
  const bytes = fs.readFileSync(fl).toString('latin1');
  console.log('     ' + path.basename(fl) + ' ' + fs.statSync(fl).size + ' bytes');
  check('the exported video has a sound track (Opus)', /A_OPUS|OpusHead/.test(bytes));
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done(); process.exit(ok.every(Boolean) && !errors.length ? 0 : 1);
})();
