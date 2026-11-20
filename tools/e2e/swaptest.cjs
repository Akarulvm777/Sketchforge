// Swap drawings: ＋ adds the current frame's drawing to the layer's swap drawings, tapping one puts it on the current
// frame (new keyframe, the frame's position / rotation kept), "Update everywhere" spreads an edit, undo, Alt+] cycles,
// and everything is kept in the .sketchforge file.
const H = require('./harness.cjs');
const path = require('path');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, errors, done } = await H.open(root, 8862, { width: 1300, height: 860 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const names = []; pg.on('dialog', d => d.accept(names.shift() ?? ''));
  await pg.evaluate(() => { const SF = window.__sketchforge; SF.newDocument(200, 200, 8, 12, false, 'Swap'); SF.CMD.layerAdd(); });
  await pg.evaluate(() => document.querySelector('#modeSwitch [data-mode="anim"]').click());
  await pg.waitForTimeout(300);
  const paint = col => pg.evaluate(col => { const SF = window.__sketchforge, l = SF.activeLayer(), f = SF.state.frame; let c = l.cels.get(f); if (!c) { SF.insertKeyframe(true); c = l.cels.get(f); } const g = c.getContext('2d'); g.clearRect(0, 0, 200, 200); g.fillStyle = col; g.fillRect(60, 60, 80, 80); c._ink = true; }, col);
  const px = f => pg.evaluate(f => { const SF = window.__sketchforge, l = SF.activeLayer(); let k = null; for (const x of l.cels.keys()) if (x <= f && (k === null || x > k)) k = x; const c = l.cels.get(k); return [...c.getContext('2d').getImageData(100, 100, 1, 1).data].slice(0, 3); }, f);
  check('the swap bar shows in the Animation workspace', await pg.isVisible('#swapBar') && /Swap/.test(await pg.textContent('#swapBar')));
  await paint('#ff0000'); names.push('Hand open'); await pg.click('#swapBar .sw-add'); await pg.waitForTimeout(150);
  await pg.evaluate(() => window.__sketchforge.gotoFrame(2)); await paint('#0000ff'); names.push('Hand closed'); await pg.click('#swapBar .sw-add'); await pg.waitForTimeout(150);
  check('＋ adds two named swap drawings', (await pg.$$('#swapBar .sw-item')).length === 2 && /Hand open/.test(await pg.textContent('#swapBar')) && /Hand closed/.test(await pg.textContent('#swapBar')));
  // frame 5: a keyframe with a position (like a bone pose), then swap to "Hand open"
  await pg.evaluate(() => { const SF = window.__sketchforge; SF.gotoFrame(5); });
  await pg.click('#swapBar .sw-item >> nth=0'); await pg.waitForTimeout(150);
  check('tapping a drawing puts it on this frame (new keyframe)', (await px(5)).join() === '255,0,0' && await pg.evaluate(() => window.__sketchforge.activeLayer().cels.has(5)));
  check('…and frames before it are unchanged', (await px(3)).join() === '0,0,255');
  await pg.evaluate(() => { const c = window.__sketchforge.activeLayer().cels.get(5); c._xf = { ...(c._xf || {}), x: 12, y: -7, rot: 20, sx: 1, sy: 1, alpha: 1 }; });
  await pg.click('#swapBar .sw-item >> nth=1'); await pg.waitForTimeout(150);
  const xf = await pg.evaluate(() => { const c = window.__sketchforge.activeLayer().cels.get(5); return [c._xf && c._xf.x, c._xf && c._xf.rot, c._swap]; });
  check('swapping keeps the frame\'s position and rotation (bones, tweens)', (await px(5)).join() === '0,0,255' && xf[0] === 12 && xf[1] === 20);
  check('the bar marks the drawing in use', await pg.evaluate(() => document.querySelectorAll('#swapBar .sw-item')[1].classList.contains('on')));
  await pg.evaluate(() => window.__sketchforge.CMD.undo()); await pg.waitForTimeout(100);
  check('undo puts the previous drawing back', (await px(5)).join() === '255,0,0');
  // Alt+] cycles
  await pg.keyboard.press('Alt+BracketRight'); await pg.waitForTimeout(150);
  check('Alt+] = next swap drawing', (await px(5)).join() === '0,0,255');
  // edit the drawing on frame 0 and update everywhere: frame 5 uses "Hand open"? set it back, then update
  await pg.keyboard.press('Alt+BracketLeft'); await pg.waitForTimeout(150);
  await pg.evaluate(() => window.__sketchforge.gotoFrame(0)); await paint('#00aa00'); await pg.waitForTimeout(100);
  await pg.evaluate(() => { const SF = window.__sketchforge; SF.gotoFrame(1); SF.gotoFrame(0); });
  await pg.click('#swapBar .sw-upd'); await pg.waitForTimeout(150);
  check('"Update everywhere" spreads the edited drawing to every frame using it', (await px(5)).join() === '0,170,0' && (await px(3)).join() === '0,0,255');
  // save and open
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.evaluate(() => window.__sketchforge.CMD.save())]);
  const fl = path.join(out, 'swap.sketchforge'); await dl.saveAs(fl);
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.evaluate(() => window.__sketchforge.CMD.open())]);
  await fc.setFiles(fl); await pg.waitForTimeout(1200);
  const re = await pg.evaluate(() => { const L = window.__sketchforge.state.layers.find(l => l.swaps && l.swaps.length); return L && { n: L.swaps.length, names: L.swaps.map(s => s.name), used: L.cels.get(5) && L.cels.get(5)._swap === L.swaps[0].id }; });
  check('saved and opened: the swap drawings and which frame uses which', re && re.n === 2 && re.names[1] === 'Hand closed' && re.used);
  await pg.screenshot({ path: out + '/swap.png' });
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
