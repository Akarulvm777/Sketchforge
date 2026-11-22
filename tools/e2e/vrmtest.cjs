// VRoid characters: built-in models load with textures and the panel skeleton, Pose on canvas (drag a body part on
// the big model), Load VRM… with a user file, the old Simple mannequin still works, toon mode, no JS errors.
const H = require('./harness.cjs');
const fs = require('fs'), path = require('path'), vm = require('vm');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, errors, done } = await H.open(root, 8817, { width: 1400, height: 900 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  await pg.evaluate(() => window.__sketchforge.newDocument(1000, 1000, 1, 12, false, 'VRM'));
  await pg.evaluate(() => window.__sketchforge.CMD.show3d()); await pg.waitForTimeout(6000);
  const info = () => pg.evaluate(() => { const M3 = window.__sketchforge.M3, m = M3.parts[0]; return { style: M3.style, gender: M3.gender, vrm: !!(m && m.userData.vrm), textured: !!(m && [].concat(m.material).some(x => x.map)), bones: Object.keys(M3.joints).length, h: m && m.userData.vrm ? m.userData.vrm.height : 0 }; });
  let I = await info();
  check(`female VRoid model with textures and ${I.bones} bones`, I.vrm && I.textured && I.bones === 46 && I.h > 1.3 && I.h < 2);
  // the arms hang down (rest pose like the other mannequins): the hand is well below the shoulder
  const handBelow = await pg.evaluate(() => { const M3 = window.__sketchforge.M3, T = M3.T, a = new T.Vector3(), h = new T.Vector3(); M3.root.updateMatrixWorld(true);
    for (const k in M3.joints) M3.joints[k].quaternion.identity(); M3.root.updateMatrixWorld(true); M3.joints.armL.getWorldPosition(a); M3.joints.handL.getWorldPosition(h); return a.y - h.y; });
  check('arms hang down at rest (T-pose was lowered)', handBelow > 0.35);
  // Pose on canvas: drag the left hand on the big model
  await pg.evaluate(() => { document.querySelector('#m3dDrag [data-d=move]').click(); [...document.querySelectorAll('#m3dPoses button')].find(x => x.textContent === 'Stand').click(); });
  await pg.evaluate(() => window.__sketchforge.scope('setPoseOnCanvas(true)')); await pg.waitForTimeout(400); // the model is posed on the canvas (no small window)
  check('Pose on canvas shows the pose bar', await pg.isVisible('#m3dPoseBar'));
  const handScreen = await pg.evaluate(() => { const SF = window.__sketchforge, M3 = SF.M3, T = M3.T, v = new T.Vector3(); M3.root.updateMatrixWorld(true);
    M3.joints.handL.getWorldPosition(v); v.y -= 0.05; v.project(M3.camera); const dx = (v.x + 1) / 2 * SF.state.w, dy = (1 - v.y) / 2 * SF.state.h;
    const r = document.querySelector('#viewport').getBoundingClientRect(), V = SF.view, k = V.scale; return [r.left + V.x + dx * k, r.top + V.y + dy * k]; });
  const y0 = await pg.evaluate(() => { const M3 = window.__sketchforge.M3, v = new M3.T.Vector3(); M3.joints.handL.getWorldPosition(v); return v.y; });
  const layers0 = await pg.evaluate(() => window.__sketchforge.state.layers.length), hist0 = await pg.evaluate(() => window.__sketchforge.history.undo.length);
  await pg.mouse.move(handScreen[0], handScreen[1]); await pg.mouse.down();
  for (let i = 1; i <= 10; i++) await pg.mouse.move(handScreen[0] - i * 6, handScreen[1] - i * 18);
  await pg.mouse.up(); await pg.waitForTimeout(300);
  const sel = await pg.evaluate(() => window.__sketchforge.M3.sel), y1 = await pg.evaluate(() => { const M3 = window.__sketchforge.M3, v = new M3.T.Vector3(); M3.root.updateMatrixWorld(true); M3.joints.handL.getWorldPosition(v); return v.y; });
  console.log('     grabbed', sel, '| hand y', y0.toFixed(3), '->', y1.toFixed(3));
  check('dragging the hand on the canvas raises it (the arm follows)', y1 > y0 + 0.15 && /L$/.test(sel));
  check('posing on the canvas does not draw on the layer', (await pg.evaluate(() => window.__sketchforge.history.undo.length)) === hist0 && (await pg.evaluate(() => window.__sketchforge.state.layers.length)) === layers0);
  check('the pose bar names the grabbed part', /left/i.test(await pg.textContent('#m3dPoseLbl')));
  await pg.screenshot({ path: out + '/vrm_pose_canvas.png' });
  // rotate mode on the canvas: drag the head
  await pg.click('#m3dPoseBar [data-d=rotate]');
  check('Rotate in the pose bar switches the drag mode', await pg.evaluate(() => window.__sketchforge.M3.dragMode === 'rotate'));
  await pg.click('#m3dPoseBar [data-x=done]'); await pg.waitForTimeout(200);
  check('Done hides the bar and drawing works again', !(await pg.isVisible('#m3dPoseBar')) && (await pg.evaluate(() => getComputedStyle(document.querySelector('#model3d-canvas')).pointerEvents)) === 'none');
  // male
  await pg.click('#m3dGender [data-g=male]'); await pg.waitForTimeout(4000);
  I = await info(); check('male VRoid model', I.gender === 'male' && I.vrm && I.textured);
  // Load VRM… with a user file (the built-in female, written to disk as .vrm)
  const ctx = {}; vm.runInNewContext(fs.readFileSync(path.join(root, 'vroid3d.js'), 'utf8'), ctx);
  const f = path.join(out, 'my_model.vrm'); fs.writeFileSync(f, Buffer.from(ctx.SF_VRM.female, 'base64'));
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('#m3dVrm')]);
  await fc.setFiles(f); await pg.waitForTimeout(5000);
  I = await info(); check('Load VRM… poses your own VRoid model', I.gender === 'custom' && I.vrm && I.bones === 46);
  // simple mannequin still available
  await pg.selectOption('#m3dKind', 'simple'); await pg.waitForTimeout(800);
  I = await info(); check('Simple mannequin (grey) is still there', I.style === 'simple' && !I.vrm && I.bones === 46);
  await pg.selectOption('#m3dKind', 'mannequin'); await pg.waitForTimeout(3000);
  I = await info(); check('back to the VRoid character', I.vrm);
  // toon + place on layer
  await pg.click('#m3dToon'); await pg.waitForTimeout(500);
  check('toon shading keeps the textures', (await info()).textured);
  await pg.click('#m3dPlace'); await pg.waitForTimeout(500);
  check('Place on new layer works', await pg.evaluate(() => /^3D /.test(window.__sketchforge.activeLayer().name)));
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
