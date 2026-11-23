// The 3D model lives on the drawing: no small control window in the panel (a "drag onto your drawing" tile instead),
// dropping / tapping it puts the model on the canvas in pose mode, it stays on the canvas through tool changes,
// strokes and layer changes, a drawing tool ends posing (model stays), "✋ Pose 3D model" starts it again, ✕ hides it.
const H = require('./harness.cjs');
(async () => {
  const root = process.argv[2];
  const { pg, errors, done } = await H.open(root, 8909, { width: 1300, height: 860 }, ['--ignore-gpu-blocklist']);
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  await pg.evaluate(() => { const SF = window.__sketchforge; SF.newDocument(800, 1000, 1, 12, false, '3D'); SF.CMD.layerAdd(); });
  await pg.evaluate(() => window.__sketchforge.scope('show3D()')); await pg.waitForTimeout(6000);
  const panel = await pg.evaluate(() => ({ preview: getComputedStyle(document.querySelector('#m3dPreview')).display, tile: !!document.querySelector('#m3dDragTile') }));
  check('the 3D panel has no small control window, but a "drag onto your drawing" tile', panel.preview === 'none' && panel.tile);
  // drop the model onto the canvas (a real HTML drag & drop)
  const vp = await pg.evaluate(() => { const r = document.querySelector('#viewport').getBoundingClientRect(); return [r.left + r.width * 0.65, r.top + r.height * 0.5]; });
  await pg.evaluate(([x, y]) => { const dt = new DataTransfer(); dt.setData('text/sf3d', '1'); document.querySelector('#viewport').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt })); }, vp);
  await pg.waitForTimeout(1500);
  const onCanvas = () => pg.evaluate(() => { const cv = document.querySelector('#model3d-canvas'); return !!(cv && cv.parentNode && cv.parentNode.id === 'stage' && cv.style.display !== 'none'); });
  check('dropped: the model is on the canvas, ready to pose', await onCanvas() && await pg.evaluate(() => window.__sketchforge.scope('M3.poseOn')));
  check('…placed where it was dropped (right of the middle)', await pg.evaluate(() => window.__sketchforge.scope('M3.root.position.x') > 0.05));
  // pick a drawing tool: posing ends, the model stays; draw; change layers
  await pg.evaluate(() => window.__sketchforge.selectTool('pen')); await pg.waitForTimeout(300);
  check('a drawing tool ends posing, the model stays on the canvas', !(await pg.evaluate(() => window.__sketchforge.scope('M3.poseOn'))) && await onCanvas());
  await pg.strokeDoc([[100, 100], [300, 200], [500, 150]]); await pg.waitForTimeout(300);
  await pg.evaluate(() => { const SF = window.__sketchforge; SF.CMD.layerAdd(); SF.scope('refreshAll()'); }); await pg.waitForTimeout(300);
  check('the model stays after drawing and a layer change (it used to disappear)', await onCanvas());
  check('"✋ Pose 3D model" is offered on the canvas', await pg.evaluate(() => { const f = document.querySelector('#m3dFab'); return f && !f.hidden; }));
  await pg.evaluate(() => document.querySelector('#m3dFab [data-a=pose]').click()); await pg.waitForTimeout(300);
  check('…and starts posing again', await pg.evaluate(() => window.__sketchforge.scope('M3.poseOn')) && await onCanvas());
  // its own layer, and the mouse turns / zooms the view while posing
  const S = c => pg.evaluate(c => window.__sketchforge.scope(c)(), c);
  check('the model has its own "3D model" layer', await S(`(() => !!m3Layer() && state.layers.filter(l => l.m3d).length === 1)`));
  await S(`(() => { if (!M3.poseOn) setPoseOnCanvas(true); })`);
  const mid = await pg.evaluate(() => { const r = document.querySelector('#model3d-canvas').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  const v0 = await S(`(() => [M3.cam.dist, M3.cam.az])`);
  await pg.mouse.move(mid[0], mid[1]); await pg.mouse.wheel(0, 300); await pg.waitForTimeout(150);
  await pg.mouse.down({ button: 'right' }); await pg.mouse.move(mid[0] + 100, mid[1], { steps: 5 }); await pg.mouse.up({ button: 'right' }); await pg.waitForTimeout(150);
  const v1 = await S(`(() => [M3.cam.dist, M3.cam.az])`);
  check('wheel zooms and right-drag turns the view of the 3D model', v1[0] > v0[0] && Math.abs(v1[1] - v0[1]) > 0.2);
  check('when posing ends the model sits at its layer in the stack, and hiding the layer hides it', await S(`(() => { setPoseOnCanvas(false); const z = M3.renderer.domElement.style.zIndex === String(11 + state.layers.indexOf(m3Layer()) * 2); m3Layer().visible = false; refreshStage(); const hid = M3.renderer.domElement.style.display === 'none'; m3Layer().visible = true; refreshStage(); return z && hid; })`));
  // closing the panel keeps the model
  await pg.evaluate(() => window.__sketchforge.scope("togglePanel('3d-model')")); await pg.waitForTimeout(400);
  check('closing the 3D panel keeps the model on the drawing', await onCanvas());
  await pg.evaluate(() => document.querySelector('#m3dFab [data-a=hide]') && (window.__sketchforge.scope('setPoseOnCanvas(false)'), document.querySelector('#m3dFab [data-a=hide]').click())); await pg.waitForTimeout(400);
  check('✕ hides the model', !(await onCanvas()));
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done(); process.exit(ok.every(Boolean) && !errors.length ? 0 : 1);
})();
