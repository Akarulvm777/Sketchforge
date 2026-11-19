// Bone tool: its own group after the Shading pens; click a part then its parent = linked with the joint where they
// touch; drag a part onto another = linked with the joint at the press point; drag a joint dot; Alt+click frees;
// Bone: pose turns a part around its joint and its children follow; undo.
const H = require('./harness.cjs');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, errors, done } = await H.open(root, 8821, { width: 1400, height: 900 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const groups = await pg.evaluate(() => window.__sketchforge.GROUPS.map(g => g.id));
  check('Bone group comes right after the Shading pens', groups.indexOf('bone') === groups.indexOf('shade') + 1);
  check('…with "link parts" and "pose" sub tools', await pg.evaluate(() => window.__sketchforge.GROUPS.find(g => g.id === 'bone').subs.join() === 'bone,bonepose'));
  // the fox practice parts, put together, nothing linked yet
  await pg.evaluate(async () => { await window.__sketchforge.foxOpen(); await window.__sketchforge.foxAssemble(false); });
  await pg.waitForTimeout(300);
  const L = n => pg.evaluate(n => { const l = window.__sketchforge.state.layers.find(x => x.name === n); return { id: l.id, parent: l.parent || null, px: l.px, py: l.py }; }, n);
  const click = async (x, y) => { const [a, b] = await pg.d2c(x * 4, y * 4); await pg.mouse.click(a, b); await pg.waitForTimeout(150); };
  await pg.evaluate(() => window.__sketchforge.selectTool('bone')); await pg.waitForTimeout(200);
  check('Bone tool shows its help in Tool Property', /Click a part/.test(await pg.textContent('#propBody')));
  // 1. click the right arm, then the right shoulder
  await click(40, 72);  // right arm (128 px fox units)
  check('first click picks the part', /Picked: right arm/.test(await pg.textContent('#boneState')));
  await click(41, 55);  // right shoulder
  let arm = await L('right arm'), sh = await L('right shoulder');
  check('second click links it: right arm follows right shoulder', arm.parent === sh.id);
  console.log('     joint at', Math.round(arm.px / 4), Math.round(arm.py / 4), '(fox px)');
  check('the joint is where the arm meets the shoulder', Math.abs(arm.py / 4 - 61) < 7 && Math.abs(arm.px / 4 - 40) < 8);
  // 2. drag from the head onto the body: joint where the drag started
  const [hx, hy] = await pg.d2c(60 * 4, 47 * 4), [bx, by] = await pg.d2c(60 * 4, 66 * 4);
  await pg.mouse.move(hx, hy); await pg.mouse.down(); await pg.mouse.move(bx, by, { steps: 8 }); await pg.mouse.up(); await pg.waitForTimeout(200);
  const head = await L('head'), body = await L('body');
  check('drag head → body links them, joint at the press point', head.parent === body.id && Math.abs(head.py / 4 - 47) < 2);
  // 3. shoulder → body by clicking, then pose: turn the shoulder, the arm follows
  await click(41, 55); await click(60, 66);
  check('shoulder → body', (await L('right shoulder')).parent === body.id);
  await pg.screenshot({ path: out + '/bone_link.png' });
  const armBox = () => pg.evaluate(() => { const SF = window.__sketchforge, l = SF.state.layers.find(x => x.name === 'right arm'), b = SF.celBBox(l.cels.get(0)), m = SF.layerMat(l, SF.state.frame) || [1, 0, 0, 1, 0, 0], cx = b.x + b.w / 2, cy = b.y + b.h / 2; return [m[0] * cx + m[2] * cy + m[4], m[1] * cx + m[3] * cy + m[5]]; });
  const a0 = await armBox();
  await pg.evaluate(() => window.__sketchforge.selectTool('bonepose')); await pg.waitForTimeout(150);
  const [sx, sy] = await pg.d2c(37 * 4, 58 * 4), [tx, ty] = await pg.d2c(42 * 4, 38 * 4);
  await pg.mouse.move(sx, sy); await pg.mouse.down(); await pg.mouse.move(tx, ty, { steps: 10 }); await pg.mouse.up(); await pg.waitForTimeout(200);
  const a1 = await armBox(), rot = await pg.evaluate(() => { const l = window.__sketchforge.state.layers.find(x => x.name === 'right shoulder'); return l.cels.get(0)._xf ? l.cels.get(0)._xf.rot : 0; });
  console.log('     shoulder turned', Math.round(rot) + '°', '| arm centre', a0.map(Math.round), '->', a1.map(Math.round));
  check('Bone: pose turns the shoulder and the arm follows', Math.abs(rot) > 20 && Math.hypot(a1[0] - a0[0], a1[1] - a0[1]) > 30);
  await pg.screenshot({ path: out + '/bone_pose.png' });
  await pg.evaluate(() => window.__sketchforge.CMD.undo()); await pg.waitForTimeout(100);
  const a2 = await armBox();
  check('undo puts the pose back', Math.hypot(a2[0] - a0[0], a2[1] - a0[1]) < 2);
  // 4. drag the arm's joint dot somewhere else: the picture stays in place
  await pg.evaluate(() => window.__sketchforge.selectTool('bone')); await pg.waitForTimeout(100);
  arm = await L('right arm');
  const [jx, jy] = await pg.d2c(arm.px, arm.py), [kx, ky] = await pg.d2c(arm.px + 12, arm.py + 20);
  await pg.mouse.move(jx, jy); await pg.mouse.down(); await pg.mouse.move(kx, ky, { steps: 6 }); await pg.mouse.up(); await pg.waitForTimeout(150);
  const arm2 = await L('right arm'), a3 = await armBox();
  check('dragging a joint dot moves the joint, the arm stays put', Math.hypot(arm2.px - arm.px - 12, arm2.py - arm.py - 20) < 3 && Math.hypot(a3[0] - a0[0], a3[1] - a0[1]) < 2);
  // 5. Alt+click frees a part
  const [fx, fy] = await pg.d2c(40 * 4, 75 * 4);
  await pg.keyboard.down('Alt'); await pg.mouse.click(fx, fy); await pg.keyboard.up('Alt'); await pg.waitForTimeout(150);
  check('Alt+click frees the part', (await L('right arm')).parent === null);
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
