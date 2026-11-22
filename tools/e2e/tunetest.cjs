// Tool tuner: a tool too slow even with every change that keeps its look gets a light stand-in while drawing and the
// full-quality stroke when the pen lifts (replayFull); undo removes that stroke in one step; no JS errors.
const H = require('./harness.cjs');
(async () => {
  const root = process.argv[2];
  const { pg, errors, done } = await H.open(root, 8910, { width: 1200, height: 800 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const r = await pg.evaluate(() => { const S = window.__sketchforge.scope; const b = S('TUNE').budget; S('TUNE').budget = 0.3; // this machine pretends to be very slow
    const res = S('tuneTool')({ ...S('settings').spray, count: 40, spacing: 0.03 }); S('TUNE').budget = b; return res; });
  console.log('     ' + JSON.stringify(r.perf));
  check('a very heavy tool gets a light stand-in for drawing (perfDefer)', !!(r.perf.perfDefer && r.perf.perfDefer.spacing > (r.perf.perfSpacing || 0)));
  await pg.evaluate(perf => { const SF = window.__sketchforge; SF.newDocument(700, 400, 1, 12, false, 'T'); SF.CMD.layerAdd(); SF.selectTool('spray'); Object.assign(SF.settings.spray, { count: 40, spacing: 0.03, size: 40 }, perf); }, r.perf);
  const pts = []; for (let i = 0; i <= 25; i++) pts.push([60 + i * 22, 200 + Math.sin(i / 4) * 80]);
  const c = []; for (const [x, y] of pts) c.push(await pg.d2c(x, y));
  await pg.mouse.move(...c[0]); await pg.mouse.down(); for (const q of c.slice(1)) await pg.mouse.move(...q, { steps: 2 });
  const mid = await pg.evaluate(() => { const st = window.__sketchforge.scope('stroke'); return { live: st.s.perfSpacing, full: st.sFull && st.sFull.perfSpacing, rec: st.rec.length }; });
  check('while drawing: the light stand-in, the path is recorded', mid.live > (mid.full || 0) && mid.rec > 20);
  await pg.mouse.up(); await pg.waitForTimeout(300);
  const ink = () => pg.evaluate(() => { const c = window.__sketchforge.activeLayer().cels.get(0), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 128) n++; return n; });
  const after = await ink();
  check(`when the pen lifts: the full-quality stroke is on the layer (${after} px)`, after > 15000);
  await pg.evaluate(() => window.__sketchforge.CMD.undo()); await pg.waitForTimeout(200);
  check('undo removes it in one step', (await ink()) === 0);
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done(); process.exit(ok.every(Boolean) && !errors.length ? 0 : 1);
})();
