// Manga tone tool + shading pens: patterns (not solid), aligned to the page (overlaps don't double), every tool paints.
const H = require('./harness.cjs');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, errors, done } = await H.open(root, 8805);
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  await pg.evaluate(() => window.__sketchforge.newDocument(1000, 700, 1, 12, false, 'Tones')); await pg.waitForTimeout(300);
  const g = await pg.evaluate(() => { const G = window.__sketchforge.GROUPS; return { tone: (G.find(x => x.id === 'tone') || {}).subs, shade: (G.find(x => x.id === 'shade') || {}).subs }; });
  check('Manga tone tool in the palette (' + (g.tone || []).length + ' sub tools)', g.tone && g.tone.length === 11);
  check('Shading pens in the palette', g.shade && g.shade.length === 4);
  check('tool buttons shown', await pg.isVisible('#toolbox .tool[data-group="tone"]') && await pg.isVisible('#toolbox .tool[data-group="shade"]'));
  const stats = (x0, y0, w, h) => pg.evaluate(([x0, y0, w, h]) => { const SF = window.__sketchforge, l = SF.activeLayer(), c = l.cels.get(SF.state.frame) || [...l.cels.values()][0];
    const d = c.getContext('2d').getImageData(x0, y0, w, h).data; let on = 0, off = 0; for (let i = 3; i < d.length; i += 4) { if (d[i] > 200) on++; else if (d[i] < 30) off++; } return { on: on / (w * h), off: off / (w * h) }; }, [x0, y0, w, h]);
  const row = async (tool, y) => { await pg.evaluate(t => window.__sketchforge.selectTool(t), tool); await pg.strokeDoc([[60, y], [940, y]]); };
  const tones = ['tone10', 'tone30', 'tone50', 'tonefine', 'tonebig', 'toneline', 'tonehline', 'tonecross', 'tonesand'];
  let y = 40;
  for (const t of tones) { await row(t, y); y += 70; }
  for (const [i, t] of tones.entries()) {
    const s = await stats(300, 40 + i * 70 - 12, 200, 24);
    const pattern = s.on > 0.02 && s.off > 0.2;
    if (!pattern) console.log('     ', t, JSON.stringify(s));
    ok.push(pattern);
  }
  console.log((ok.slice(-tones.length).every(Boolean) ? 'ok   ' : 'FAIL ') + 'every tone paints a pattern (dots / lines with gaps, not solid)');
  const c10 = await stats(300, 28, 200, 24), c50 = await stats(300, 168, 200, 24);
  check(`10% tone lighter than 50% (${c10.on.toFixed(2)} < ${c50.on.toFixed(2)})`, c10.on < c50.on);
  // painting the same tone again over itself must not darken it (pattern fixed to the page)
  const before = await stats(300, 28, 200, 24);
  await row('tone10', 40);
  const after = await stats(300, 28, 200, 24);
  check(`overlapping tone strokes don't double the dots (${before.on.toFixed(3)} → ${after.on.toFixed(3)})`, Math.abs(after.on - before.on) < 0.01);
  // tone eraser
  await pg.evaluate(() => window.__sketchforge.selectTool('toneera')); await pg.strokeDoc([[300, 40], [500, 40]]);
  check('tone eraser removes tone', (await stats(330, 30, 140, 20)).on < 0.01);
  // shading pens
  await pg.evaluate(() => window.__sketchforge.newDocument(1000, 400, 1, 12, false, 'Shade')); await pg.waitForTimeout(300);
  let yy = 60;
  for (const t of ['shadowpen', 'hatchbrush', 'xhatchbrush', 'stipple']) { await row(t, yy); yy += 90; }
  const sp = await stats(300, 50, 200, 20), hb = await stats(300, 140, 200, 20), st = await stats(300, 220, 200, 80);
  check('shadow pen paints solid black', sp.on > 0.9);
  check('hatching brush paints lines with gaps', hb.on > 0.05 && hb.off > 0.3);
  check('stipple pen scatters dots', st.on > 0.003 && st.off > 0.8);
  await pg.evaluate(() => { const SF = window.__sketchforge; SF.view.scale = 2.5; }); 
  await pg.screenshot({ path: out + '/tones.png' });
  // undo works
  const u = await pg.evaluate(() => { const SF = window.__sketchforge; const n = SF.history.undo.length; SF.CMD.undo(); return n; });
  check('undoable', u > 0);
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
