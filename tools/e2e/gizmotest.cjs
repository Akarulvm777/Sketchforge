// 3D posing like the topic1 video: hover lights a body part up, click selects it (red) with rotation rings, dragging a
// ring turns the joint around that axis, floor grid + shadow, the pose bar floats above the head with camera views.
const H = require('./harness.cjs');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, errors, done } = await H.open(root, 8899, { width: 1400, height: 900 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  await pg.evaluate(() => window.__sketchforge.newDocument(1000, 1000, 1, 12, false, 'G'));
  await pg.evaluate(() => window.__sketchforge.CMD.show3d()); await pg.waitForTimeout(6000);
  await pg.click('#m3dPoseCanvas'); await pg.waitForTimeout(400);
  const scr = (name, dy = 0) => pg.evaluate(([name, dy]) => { const SF = window.__sketchforge, M3 = SF.M3, T = M3.T, v = new T.Vector3(); M3.root.updateMatrixWorld(true); M3.joints[name].getWorldPosition(v); v.y += dy; v.project(M3.camera);
    const dx = (v.x + 1) / 2 * SF.state.w, dyy = (1 - v.y) / 2 * SF.state.h, r = document.querySelector('#viewport').getBoundingClientRect(), V = SF.view, k = V.scale; return [r.left + V.x + dx * k, r.top + V.y + dyy * k]; }, [name, dy]);
  const G = () => pg.evaluate(() => { const g = window.__sketchforge.scope('GIZ'); return { rings: !!(g.group && g.group.visible), hover: g.hover, grid: !!(g.grid && g.grid.visible), shadow: !!(g.floor && g.floor.visible) }; });
  const fa = await scr('forearmL'); await pg.mouse.move(fa[0], fa[1]); await pg.mouse.down(); await pg.mouse.up(); await pg.waitForTimeout(300);
  const sel = await pg.evaluate(() => window.__sketchforge.M3.sel);
  check('click a body part selects it and shows the rotation rings', /arm/i.test(sel) && (await G()).rings);
  const ch = await scr('spine', 0.1); await pg.mouse.move(ch[0], ch[1]); await pg.waitForTimeout(120); await pg.mouse.move(ch[0] + 2, ch[1]); await pg.waitForTimeout(300);
  const g1 = await G();
  check('pointing at another part lights it up', g1.hover && g1.hover !== sel);
  check('floor grid and ground shadow', g1.grid && g1.shadow);
  const ringPt = await pg.evaluate(() => { const SF = window.__sketchforge, M3 = SF.M3, T = M3.T, g = SF.scope('GIZ'), r = g.rings[2]; g.group.updateMatrixWorld(true); const v = new T.Vector3(); let best = null;
    for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; v.set(Math.cos(a), Math.sin(a), 0).applyMatrix4(r.matrixWorld).project(M3.camera); const b = document.querySelector('#viewport').getBoundingClientRect(), V = SF.view, k = V.scale; const p = [b.left + V.x + (v.x + 1) / 2 * SF.state.w * k, b.top + V.y + (1 - v.y) / 2 * SF.state.h * k]; if (!best || p[1] < best[1]) best = p; } return best; });
  const q = () => pg.evaluate(() => { const M3 = window.__sketchforge.M3; return M3.joints[M3.sel].quaternion.toArray().map(x => +x.toFixed(3)).join(); });
  const q0 = await q();
  await pg.mouse.move(ringPt[0], ringPt[1]); await pg.waitForTimeout(100); await pg.mouse.down(); for (let i = 1; i <= 8; i++) await pg.mouse.move(ringPt[0] + i * 6, ringPt[1] + i * 4); await pg.mouse.up(); await pg.waitForTimeout(300);
  check('dragging a ring turns the joint around that axis', (await q()) !== q0);
  check('the pose bar floats above the model with camera buttons', await pg.isVisible('#m3dPoseBar .m3dcam') && (await pg.evaluate(() => document.querySelector('#m3dPoseBar').style.left)) !== '');
  const az0 = await pg.evaluate(() => window.__sketchforge.M3.cam.az); await pg.click('#m3dPoseBar [data-v="90"]'); await pg.waitForTimeout(300);
  check('Side view turns the camera', Math.abs((await pg.evaluate(() => window.__sketchforge.M3.cam.az)) - Math.PI / 2) < 0.01 && az0 !== Math.PI / 2);
  await pg.screenshot({ path: out + '/gizmo.png' });
  await pg.click('#m3dPoseBar [data-x=done]'); await pg.waitForTimeout(200);
  await pg.evaluate(() => document.querySelector('#m3dPlace').click()); await pg.waitForTimeout(300);
  check('Place on new layer works (helpers hidden while placing)', await pg.evaluate(() => window.__sketchforge.state.layers.some(l => /^3D/.test(l.name)) && !window.__sketchforge.scope('GIZ').placing));
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
