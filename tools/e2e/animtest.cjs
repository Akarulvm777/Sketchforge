// Animation: one layer holds the whole animation (new blank drawings), New drawing, hold, drag keys, play range, ping-pong, onion, export.
const H = require('./harness.cjs');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, errors, done } = await H.open(root, 8800);
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const E = (f, a) => pg.evaluate(f, a);
  const keys = () => E(() => { const l = window.__sketchforge.activeLayer(); return Array.from(l.cels.keys()).sort((a, b) => a - b); });
  const inkAtFrame = (f, x, y) => E(([f, x, y]) => { const SF = window.__sketchforge, l = SF.activeLayer(); let k = null; for (const q of l.cels.keys()) if (q <= f && (k === null || q > k)) k = q;
    const d = l.cels.get(k).getContext('2d').getImageData(x - 2, y - 2, 5, 5).data; let m = 0; for (let i = 3; i < d.length; i += 4) m = Math.max(m, d[i]); return m; }, [f, x, y]);
  await E(() => { localStorage.removeItem('sketchforge.anim.v1'); window.__sketchforge.newDocument(800, 600, 1, 12, false, 'Walk'); });
  await pg.waitForTimeout(300);
  await pg.click('#modeSwitch [data-mode="anim"]'); await pg.waitForTimeout(400);
  check('starts with 1 frame', (await E(() => window.__sketchforge.state.frameCount)) === 1);
  await pg.strokeDoc([[100, 100], [300, 120]]);
  await pg.click('#anNewBtn'); await pg.waitForTimeout(200);
  let st = await E(() => ({ fc: window.__sketchforge.state.frameCount, f: window.__sketchforge.state.frame, onion: window.__sketchforge.state.onion.on }));
  check('＋ New drawing adds frame 2 and goes there', st.fc === 2 && st.f === 1);
  check('onion skin turned on by itself', st.onion);
  check('frame 2 is a new blank drawing on the SAME layer', JSON.stringify(await keys()) === '[0,1]' && (await inkAtFrame(1, 200, 110)) === 0);
  await pg.strokeDoc([[100, 300], [300, 320]]);
  check('drawing on frame 2 does not change frame 1', (await inkAtFrame(0, 200, 310)) === 0 && (await inkAtFrame(1, 200, 310)) > 0);
  await pg.screenshot({ path: out + '/anim_onion.png' });
  // on 2s
  await pg.selectOption('#anExpose', '2'); await pg.click('#anNewBtn'); await pg.waitForTimeout(200);
  check('on 2s: new drawing 2 frames later', (await E(() => window.__sketchforge.state.frame)) === 3 && (await E(() => window.__sketchforge.state.frameCount)) === 4);
  await pg.selectOption('#anExpose', '1');
  // drawing on a held frame makes a blank drawing
  await E(() => window.__sketchforge.gotoFrame(2));
  await pg.strokeDoc([[500, 100], [600, 120]]);
  check('drawing on a held frame = new blank drawing (old lines not copied)', JSON.stringify(await keys()) === '[0,1,2,3]' && (await inkAtFrame(2, 200, 310)) === 0 && (await inkAtFrame(1, 550, 110)) === 0);
  // copy mode
  await pg.selectOption('#anNewKey', 'copy');
  await E(() => { const SF = window.__sketchforge; SF.CMD.insertFrame(); SF.gotoFrame(5 - 1); });
  await E(() => { const SF = window.__sketchforge; SF.CMD.insertFrame(); });
  await E(() => window.__sketchforge.gotoFrame(4));
  const kk = await keys(); const heldFrom = kk.filter(k => k <= 4).pop();
  await pg.strokeDoc([[650, 400], [700, 420]]);
  check('copy mode: new key keeps the previous drawing', (await keys()).includes(4) && (await inkAtFrame(4, 550, 110)) === (await inkAtFrame(heldFrom, 550, 110)));
  await pg.selectOption('#anNewKey', 'blank');
  // hold longer / shorter
  await E(() => window.__sketchforge.gotoFrame(0));
  const before = await keys();
  await E(() => window.__sketchforge.CMD.holdLonger());
  const after = await keys();
  check('hold longer shifts later drawings by 1', after[0] === 0 && after[1] === before[1] + 1);
  await E(() => window.__sketchforge.CMD.holdShorter());
  check('hold shorter undoes it', JSON.stringify(await keys()) === JSON.stringify(before));
  // context menu
  const cell = async (f) => E(f => { const l = window.__sketchforge.activeLayer(); const c = document.querySelector(`#tlInner .tl-row[data-id="${l.id}"] .tl-cell[data-f="${f}"]`); const r = c.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, f);
  let [cx, cy] = await cell(1);
  await pg.mouse.click(cx, cy, { button: 'right' }); await pg.waitForTimeout(200);
  check('right-click on a cell opens the timeline menu', await pg.isVisible('#anMenu'));
  await pg.screenshot({ path: out + '/anim_menu.png' });
  await pg.keyboard.press('Escape'); await pg.mouse.click(5, 5);
  // drag the selected keyframe (frame 2) to the end
  const fc = await E(() => window.__sketchforge.state.frameCount);
  await E(() => window.__sketchforge.gotoFrame(1));
  [cx, cy] = await cell(1); const [tx] = await cell(fc - 1);
  const k1 = await keys();
  if (!k1.includes(fc - 1)) {
    await pg.mouse.move(cx, cy); await pg.mouse.down(); await pg.mouse.move(tx, cy, { steps: 6 }); await pg.mouse.up(); await pg.waitForTimeout(200);
    const k2 = await keys();
    check('drag the selected keyframe moves it', !k2.includes(1) && k2.includes(fc - 1));
    await E(() => window.__sketchforge.CMD.undo ? window.__sketchforge.CMD.undo() : null);
  } else check('drag (skipped: end already a key)', true);
  // double-click empty frame = new drawing
  await E(() => window.__sketchforge.CMD.insertFrame());
  const n2 = await E(() => window.__sketchforge.state.frameCount);
  const kd = await keys(); const free = Array.from({ length: n2 }, (_, i) => i).find(i => !kd.includes(i));
  if (free !== undefined) { [cx, cy] = await cell(free); await pg.mouse.dblclick(cx, cy); await pg.waitForTimeout(200); check('double-click a frame = new drawing', (await keys()).includes(free)); }
  // play range + ping-pong
  await E(() => { const SF = window.__sketchforge; SF.gotoFrame(1); SF.CMD.playIn(); SF.gotoFrame(3); SF.CMD.playOut(); });
  check('ruler shows the play range', await E(() => document.querySelectorAll('#tlInner .tl-rc.out-range').length > 0));
  const seen = await E(async () => { const SF = window.__sketchforge, s = new Set(); SF.state.fps = 30; SF.CMD.play(); await new Promise(r => { const t0 = performance.now(); const tick = () => { s.add(SF.state.frame); if (performance.now() - t0 < 900) requestAnimationFrame(tick); else r(); }; tick(); }); SF.CMD.play(); return [...s].sort((a, b) => a - b); });
  check('play range: only frames 2–4 play (' + seen + ')', seen.every(f => f >= 1 && f <= 3) && seen.length === 3);
  await E(() => window.__sketchforge.CMD.pingpong());
  const seq = await E(async () => { const SF = window.__sketchforge, a = []; SF.gotoFrame(1); SF.CMD.play(); await new Promise(r => { const t0 = performance.now(); const tick = () => { if (a[a.length - 1] !== SF.state.frame) a.push(SF.state.frame); if (performance.now() - t0 < 700) requestAnimationFrame(tick); else r(); }; tick(); }); SF.CMD.play(); return a; });
  check('ping-pong goes back and forth (' + seq.join(',') + ')', seq.join(',').includes('3,2,1') || seq.join(',').includes('3,2'));
  await E(() => { window.__sketchforge.CMD.pingpong(); window.__sketchforge.CMD.playAll(); });
  // onion settings popover
  await pg.click('#anOnionBtn'); await pg.waitForTimeout(150);
  check('onion settings open', await pg.isVisible('#anOnionPop'));
  await pg.screenshot({ path: out + '/anim_onionpop.png' });
  await pg.mouse.click(5, 5);
  // export sprite sheet + transparent PNG frames
  await E(() => window.__sketchforge.CMD.exportAnim());
  await pg.selectOption('#expFormat', 'sheet');
  const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 15000 }), pg.click('#expGo')]);
  check('sprite sheet exported: ' + dl.suggestedFilename(), /_sheet_\d+x\d+\.png$/.test(dl.suggestedFilename()));
  await pg.selectOption('#expFormat', 'gif'); await pg.check('#expTransp'); await pg.selectOption('#expRange', 'all');
  const [dl2] = await Promise.all([pg.waitForEvent('download', { timeout: 20000 }), pg.click('#expGo')]);
  check('transparent GIF exported', dl2.suggestedFilename().endsWith('.gif'));
  await pg.click('#expCancel');
  // undo the timeline ops
  const u = await E(() => window.__sketchforge.history.undo.length);
  check('timeline changes are undoable', u > 5);
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
