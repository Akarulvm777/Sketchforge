const H = require('./harness.cjs');
const fs = require('fs');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, errors, done } = await H.open(root, 8776);
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const E = (f, a) => pg.evaluate(f, a);
  const comp = (x, y, f) => pg.evaluate(([x, y, f]) => { const SF = window.__sketchforge, c = SF.compositeFrame(f ?? SF.state.frame), d = c.getContext('2d').getImageData(x - 3, y - 3, 7, 7).data; let m = 255; for (let i = 0; i < d.length; i += 4) m = Math.min(m, d[i]); return m < 100; }, [x, y, f]);
  pg.on('dialog', d => d.accept());
  await E(() => window.__sketchforge.newDocument(900, 800, 11, 12, false, 'Rig'));
  await pg.waitForTimeout(400);
  await E(() => { const SF = window.__sketchforge; SF.selectTool('pen'); });
  // layer "Layer 1" = upper arm, add "Layer 2" = forearm
  await pg.strokeDoc([[300, 310], [500, 310]]);
  await E(() => window.__sketchforge.CMD.layerAdd()); await pg.waitForTimeout(200);
  await pg.strokeDoc([[500, 310], [650, 310]]);
  const names = await E(() => window.__sketchforge.state.layers.map(l => l.name));
  console.log('     layers: ' + names.join(', '));
  check('before rigging: forearm at (575,310)', await comp(575, 310));
  // parent the forearm to the arm via the dialog
  await E(() => window.__sketchforge.CMD.rigParent());
  await pg.evaluate(() => { const s = document.querySelector('dialog.csdlg[open] select'); s.value = [...s.options].find(o => o.textContent === 'Layer 1').value; });
  await pg.click('dialog.csdlg[open] button[value=ok]'); await pg.waitForTimeout(300);
  check('forearm shows "↳ Layer 1" in the layer list', await E(() => document.querySelector('#layerList') ? document.querySelector('#layerList').textContent.includes('↳ Layer 1') : true));
  check('parenting does not move the forearm', await comp(575, 310));
  // set the arm pivot at the shoulder and rotate it 90° on frame 1 (keyframe 0)
  await E(() => { const SF = window.__sketchforge, arm = SF.state.layers.find(l => l.name === 'Layer 1'); arm.px = 300; arm.py = 310; const x = arm.cels.get(0); x._xf = { ...(x._xf || {}), x: 0, y: 0, rot: 90, sx: 1, sy: 1, alpha: 1, tween: false, ease: 0 }; SF.gotoFrame(0); });
  check('rotating the arm 90° swings the forearm down: now at (300,585)', await comp(300, 585) && !(await comp(575, 310)));
  check('on screen too (stage CSS uses the combined matrix)', await E(() => { const SF = window.__sketchforge, fa = SF.state.layers.find(l => l.name === 'Layer 2'); return /matrix\(/.test(fa.canvas.style.transform); }));
  // tween: frame 1 rot 0, frame 11 rot 90
  await E(() => { const SF = window.__sketchforge, arm = SF.state.layers.find(l => l.name === 'Layer 1'); arm.cels.get(0)._xf.rot = 0; SF.state.activeId = arm.id; SF.gotoFrame(10); SF.insertKeyframe(false); });
  await E(() => { const SF = window.__sketchforge, arm = SF.state.layers.find(l => l.name === 'Layer 1'); arm.cels.get(10)._xf = { ...arm.cels.get(10)._xf, rot: 90 }; SF.gotoFrame(0); SF.createTween(); });
  await E(() => window.__sketchforge.gotoFrame(5));
  check('tween: halfway the forearm is at 45° (≈ 494,504)', await comp(494, 504, 5));
  await pg.screenshot({ path: out + '/rig_tween.png' });
  // painting on the forearm while the arm is rotated lands on the forearm's own pixels
  await E(() => { const SF = window.__sketchforge; SF.gotoFrame(10); SF.state.activeId = SF.state.layers.find(l => l.name === 'Layer 2').id; });
  await pg.strokeDoc([[290, 640], [310, 640]]);   // doc point (300,640) = forearm local (630,310)
  check('stroke on the rotated forearm is stored where the forearm is', await E(() => { const SF = window.__sketchforge, fa = SF.state.layers.find(l => l.name === 'Layer 2'); let k = null; for (const kk of fa.cels.keys()) if (kk <= 10 && (k === null || kk > k)) k = kk; const d = fa.cels.get(k).getContext('2d').getImageData(620, 290, 20, 40).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 100) n++; return n > 20; }));
  // move tool: dragging the child goes where the pen goes even though its parent is rotated
  await E(() => window.__sketchforge.selectTool('move'));
  const before = await comp(300, 585, 10);
  const a = await pg.d2c(300, 585), b = await pg.d2c(380, 585);
  await pg.mouse.move(a[0], a[1]); await pg.mouse.down(); await pg.mouse.move(b[0], b[1], { steps: 6 }); await pg.mouse.up();
  check('dragging the forearm right by 80 px moves it right on screen', before && await comp(380, 585, 10) && !(await comp(300, 585, 10)));
  // save / reopen keeps the rig
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.keyboard.press('Control+s')]);
  await dl.saveAs(out + '/rig.sketchforge');
  await pg.setInputFiles('#fileOpen', out + '/rig.sketchforge'); await pg.waitForTimeout(1500);
  check('reopened file keeps the parent link', await E(() => { const SF = window.__sketchforge, fa = SF.state.layers.find(l => l.name === 'Layer 2'), arm = SF.state.layers.find(l => l.name === 'Layer 1'); return fa.parent === arm.id; }));
  check('reopened tween still swings the forearm', await comp(494, 504, 5));
  console.log('page errors:', errors.length ? errors : 'none');
  console.log(ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
