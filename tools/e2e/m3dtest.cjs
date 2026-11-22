// 3D model: finger bones + hand poses, drag to move (IK), body shape, zoom.
const H = require('./harness.cjs');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, errors, done } = await H.open(root, 8801);
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const E = (f, a) => pg.evaluate(f, a);
  await E(() => window.__sketchforge.CMD.show3d()); await pg.waitForTimeout(3000);
  const info = await E(() => { const M3 = window.__sketchforge.M3; return { bones: Object.keys(M3.joints).length, fingers: !!M3.joints.index3L, opts: document.querySelectorAll('#m3dJointSel option').length }; });
  check('46 bones incl. 3 per finger (' + info.bones + ')', info.bones === 46 && info.fingers);
  check('joint list has the fingers (' + info.opts + ')', info.opts === 46);
  const shot = async name => { await pg.waitForTimeout(250); const el = await pg.$('#model3d-canvas'); await el.screenshot({ path: `${out}/m3d_${name}.png` }); };
  // close-up of the right hand
  await E(() => { const M3 = window.__sketchforge.M3; M3.cam = { az: -0.3, el: 0.1, dist: 1.0, tx: -0.2, ty: 0.8 }; document.querySelector('#m3dLa').dispatchEvent(new Event('input')); });
  await pg.click('#m3dHands button:text("Fist")'); await shot('fist');
  const tipY = () => E(() => { const M3 = window.__sketchforge.M3, v = new M3.T.Vector3(); M3.root.updateMatrixWorld(true); M3.joints.index3R.getWorldPosition(v); return v.toArray(); });
  const fist = await tipY();
  await pg.click('#m3dHands button:text("Open")'); await shot('open');
  const open = await tipY();
  check('fist curls the fingers (index tip moves)', Math.hypot(fist[0] - open[0], fist[1] - open[1], fist[2] - open[2]) > 0.01);
  await pg.click('#m3dHands button:text("Point")'); await shot('point');
  await pg.click('#m3dHands button:text("Peace")'); await shot('peace');
  // curl one finger
  await E(() => { const M3 = window.__sketchforge.M3; M3.sel = 'middle2R'; document.querySelector('#m3dJointSel').value = 'middle2R'; document.querySelector('#m3dJointSel').dispatchEvent(new Event('change')); });
  check('finger selected: curl slider shown', await pg.isVisible('#m3dCurlRow'));
  // whole body, drag the right hand up (IK)
  await pg.click('#m3dCam'); await pg.click('#m3dPoses button:text("Stand")'); await pg.waitForTimeout(200);
  await E(() => { const M3 = window.__sketchforge.M3; M3.cam = { az: 0, el: 0.1, dist: 1.8, tx: -0.2, ty: 0.95 }; document.querySelector('#m3dLa').dispatchEvent(new Event('input')); }); await pg.waitForTimeout(300);
  await E(() => window.__sketchforge.scope('setPoseOnCanvas(true)')); await pg.waitForTimeout(150); // posed on the canvas (no small window)
  const handScreen = await E(() => { const M3 = window.__sketchforge.M3, T = M3.T, mesh = M3.parts[0]; M3.root.updateMatrixWorld(true); mesh.skeleton.update();
    const src = mesh.geometry.attributes.position, di = mesh.userData.boneNames.indexOf('forearmR'), v = new T.Vector3(), c = new T.Vector3(); let n = 0;
    for (let i = 0; i < src.count; i++) if (mesh.userData.dom[i] === di) { v.fromBufferAttribute(src, i); mesh.applyBoneTransform(i, v); c.add(v); n++; }
    c.multiplyScalar(1 / n); c.z += 0.03; c.project(M3.camera); const r = document.querySelector('#model3d-canvas').getBoundingClientRect(); return [r.left + (c.x + 1) / 2 * r.width, r.top + (1 - c.y) / 2 * r.height, r.height]; });
  const before = await E(() => { const M3 = window.__sketchforge.M3, v = new M3.T.Vector3(); M3.joints.handR.getWorldPosition(v); return v.y; });
  await pg.mouse.move(handScreen[0], handScreen[1]); await pg.mouse.down();
  await pg.mouse.move(handScreen[0] - 10, handScreen[1] - handScreen[2] * 0.45, { steps: 12 }); await pg.mouse.up();
  const after = await E(() => { const M3 = window.__sketchforge.M3, v = new M3.T.Vector3(); M3.root.updateMatrixWorld(true); M3.joints.handR.getWorldPosition(v); return { y: v.y, sel: M3.sel, el: new M3.T.Euler().setFromQuaternion(M3.joints.forearmR.quaternion, 'YXZ').x }; });
  console.log('     hand y', before.toFixed(3), '->', after.y.toFixed(3), 'grabbed', after.sel, 'elbow', (after.el * 57.3).toFixed(0));
  check('drag the hand: the arm follows (hand goes up)', after.y > before + 0.15);
  check('elbow bends the right way', after.el <= 0.001);
  await shot('ik');
  // body shape
  const h0 = await E(() => { const M3 = window.__sketchforge.M3; M3.root.updateMatrixWorld(true); const v = new M3.T.Vector3(); M3.joints.head.getWorldPosition(v); return v.y; });
  await E(() => { const i = document.querySelector('[data-shape="legs"]'); i.value = 130; i.dispatchEvent(new Event('input')); const j = document.querySelector('[data-shape="build"]'); j.value = 160; j.dispatchEvent(new Event('input')); const k = document.querySelector('[data-shape="head"]'); k.value = 140; k.dispatchEvent(new Event('input')); });
  await pg.waitForTimeout(400);
  const h1 = await E(() => { const M3 = window.__sketchforge.M3; M3.root.updateMatrixWorld(true); const v = new M3.T.Vector3(); M3.joints.head.getWorldPosition(v); const g = M3.parts[0].geometry; g.computeBoundingBox(); return { y: v.y, minY: g.boundingBox.min.y }; });
  check('longer legs: head higher, feet still on the ground', h1.y > h0 + 0.1 && Math.abs(h1.minY) < 0.02);
  await E(() => { const M3 = window.__sketchforge.M3; M3.cam = { az: 0.5, el: 0.15, dist: 5, tx: 0, ty: 1 }; document.querySelector('#m3dLa').dispatchEvent(new Event('input')); }); await shot('shape');
  await pg.click('#m3dShapeReset'); await pg.waitForTimeout(200);
  // gender switch keeps working with fingers
  await pg.click('#m3dGender [data-g="male"]'); await pg.waitForTimeout(300);
  check('male model has fingers too', await E(() => !!window.__sketchforge.M3.joints.pinky3L));
  // zoom
  await E(() => { const z = document.querySelector('#m3dZoom'); z.value = 200; z.dispatchEvent(new Event('input')); });
  check('zoom slider changes the camera', await E(() => Math.abs(window.__sketchforge.M3.cam.dist - 2.2) < 0.01));
  await E(() => { const z = document.querySelector('#m3dH'); z.value = 250; z.dispatchEvent(new Event('input')); });
  check('model size up to 250%', await E(() => Math.abs(window.__sketchforge.M3.root.scale.x - 2.5) < 0.01));
  await pg.screenshot({ path: out + '/m3d_panel.png' });
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
