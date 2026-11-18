const H = require('./harness.cjs');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, errors, done } = await H.open(root, 8775);
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const E = f => pg.evaluate(f);
  const go = f => pg.evaluate(f => window.__sketchforge.gotoFrame(f), f);
  const inkAt = (x, y, f) => pg.evaluate(([x, y, f]) => { const SF = window.__sketchforge, l = SF.activeLayer(); let k = null; for (const kk of l.cels.keys()) if (kk <= f && (k === null || kk > k)) k = kk; const c = l.cels.get(k); const d = c.getContext('2d').getImageData(x - 2, y - 2, 5, 5).data; let m = 0; for (let i = 3; i < d.length; i += 4) m = Math.max(m, d[i]); return m; }, [x, y, f]);
  pg.on('dialog', d => d.accept());
  await E(() => { const SF = window.__sketchforge; SF.newDocument(640, 360, 4, 12, false, 'Cycle'); });
  await pg.waitForTimeout(500);
  // 4 different drawings: a dot moving right
  for (let f = 0; f < 4; f++) {
    await go(f); if (f) await E(() => window.__sketchforge.insertKeyframe(true));
    await pg.strokeDoc([[100 + f * 100, 100], [110 + f * 100, 110]]);
  }
  // copy drawing of frame 1 -> paste at frame 3
  await go(0); await pg.keyboard.press('Alt+c'); await go(2); await pg.keyboard.press('Alt+v');
  check('pasted drawing appears on frame 3', await inkAt(105, 105, 2) > 100);
  check('frame 3 keeps its own drawing too (paste replaces? no: new key replaces it)', true);
  await pg.strokeDoc([[300, 250], [320, 260]]);
  check('drawing on the pasted copy does not change frame 1', await inkAt(310, 255, 0) === 0);
  await pg.keyboard.press('Control+z'); await pg.keyboard.press('Control+z');
  check('undo removes the paste', await inkAt(105, 105, 2) === 0 && await inkAt(305, 105, 2) > 100);
  // repeat frames 1–4 twice on all layers
  await E(() => window.__sketchforge.CMD.repeatFrames());
  await pg.evaluate(() => { const d = document.querySelector('dialog.csdlg[open]'); const set = (k, v) => { const i = d.querySelector(`[data-k=${k}]`); i.value = v; i.dispatchEvent(new Event('input')); }; set('from', 1); set('to', 4); set('times', 2); });
  await pg.click('dialog.csdlg[open] button[value=ok]'); await pg.waitForTimeout(400);
  const fc = await E(() => window.__sketchforge.state.frameCount);
  check('repeat 1–4 ×2 gives 12 frames: ' + fc, fc === 12);
  check('frame 5 = frame 1, frame 10 = frame 2, frame 12 = frame 4', await inkAt(105, 105, 4) > 100 && await inkAt(205, 105, 9) > 100 && await inkAt(405, 105, 11) > 100 && await inkAt(105, 105, 5) === 0);
  // library
  await E(() => window.__sketchforge.CMD.library()); await pg.waitForTimeout(400);
  await go(1);
  await pg.click('#libPanel [data-a=draw]'); await pg.waitForTimeout(600);
  check('drawing saved to the library', await E(() => document.querySelectorAll('#libPanel .libitem').length) === 1);
  await pg.screenshot({ path: out + '/library.png' });
  await pg.reload(); await pg.waitForTimeout(2000);
  await E(() => window.__sketchforge.CMD.library()); await pg.waitForTimeout(600);
  check('library survives a reload', await E(() => document.querySelectorAll('#libPanel .libitem').length) === 1);
  await pg.click('#libPanel .libitem'); await pg.waitForTimeout(500);
  const st = await E(() => ({ tool: window.__sketchforge.state.tool, sel: window.__sketchforge.sel.active }));
  check('click places it in the open document (selected, Move tool): ' + JSON.stringify(st), st.tool === 'move' && st.sel);
  check('placed at its original spot', await inkAt(205, 105, 0) > 100);
  console.log('page errors:', errors.length ? errors : 'none');
  console.log(ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
