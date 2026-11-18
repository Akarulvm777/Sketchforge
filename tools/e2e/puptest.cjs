const H = require('./harness.cjs');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, errors, done } = await H.open(root, 8777);
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const E = (f, a) => pg.evaluate(f, a);
  const ink = (x, y, f) => pg.evaluate(([x, y, f]) => { const SF = window.__sketchforge, c = SF.compositeFrame(f ?? SF.state.frame), d = c.getContext('2d').getImageData(x - 6, y - 6, 13, 13).data; let m = 255; for (let i = 0; i < d.length; i += 4) m = Math.min(m, d[i]); return m < 100; }, [x, y, f]);
  const click = async (x, y, mods = []) => { const c = await pg.d2c(x, y); for (const m of mods) await pg.keyboard.down(m); await pg.mouse.click(c[0], c[1]); for (const m of mods) await pg.keyboard.up(m); await pg.waitForTimeout(150); };
  const drag = async (x0, y0, x1, y1) => { const a = await pg.d2c(x0, y0), b = await pg.d2c(x1, y1); await pg.mouse.move(a[0], a[1]); await pg.mouse.down(); await pg.mouse.move(b[0], b[1], { steps: 10 }); await pg.mouse.up(); await pg.waitForTimeout(300); };
  pg.on('dialog', d => d.accept());
  await E(() => window.__sketchforge.newDocument(800, 800, 11, 12, false, 'Puppet'));
  await pg.waitForTimeout(300);
  await E(() => { const SF = window.__sketchforge; SF.selectTool('pen'); });
  for (let k = -8; k <= 8; k += 4) await pg.strokeDoc([[200, 400 + k], [600, 400 + k]]);   // a thick bar
  check('bar drawn: tip at (590,400)', await ink(590, 400));
  await E(() => window.__sketchforge.selectTool('puppet'));
  check('Puppet warp is a sub-tool of Move: ' + await E(() => window.__sketchforge.state.group), await E(() => window.__sketchforge.state.group) === 'move');
  await click(210, 400); await click(400, 400); await click(590, 400);
  check('3 pins placed', await E(() => { const SF = window.__sketchforge, l = SF.activeLayer(); return l.cels.get(0)._pup.pins.length; }) === 3);
  await drag(590, 400, 400, 590);
  check('shoulder pin holds: still ink at (215,400)', await ink(215, 400));
  check('tip moved away from (590,400)', !(await ink(590, 400)));
  check('bent end is near (405,585)', await ink(405, 585));
  await pg.screenshot({ path: out + '/puppet_bent.png' });
  await pg.keyboard.press('Control+z'); await pg.waitForTimeout(200);
  check('undo straightens it again', await ink(590, 400) && !(await ink(405, 585)));
  await pg.keyboard.press('Control+y'); await pg.waitForTimeout(200);
  check('redo bends it again', await ink(405, 585));
  await pg.keyboard.press('Control+z'); await pg.waitForTimeout(200);
  // Alt+click removes the middle pin
  await click(400, 400, ['Alt']);
  check('Alt+click removes a pin', await E(() => window.__sketchforge.activeLayer().cels.get(0)._pup.pins.length) === 2);
  await click(400, 400);
  // in-betweens: frame 1 straight, frame 11 bent
  await E(() => { const SF = window.__sketchforge; SF.gotoFrame(10); SF.insertKeyframe(false); });
  await drag(590, 400, 400, 590);
  check('frame 11 bent', await ink(405, 585, 10));
  check('frame 1 still straight', await ink(590, 400, 0));
  await E(() => window.__sketchforge.gotoFrame(0));
  await E(() => window.__sketchforge.CMD.puppetInbetween()); await pg.waitForTimeout(400);
  const keys = await E(() => [...window.__sketchforge.activeLayer().cels.keys()].sort((a, b) => a - b).join(','));
  check('in-betweens created on frames 2–10: keys ' + keys, keys === '0,1,2,3,4,5,6,7,8,9,10');
  check('frame 6 is halfway: tip near (500,500), not at either end', await ink(500, 500, 5) && !(await ink(590, 400, 5)) && !(await ink(405, 585, 5)));
  await E(() => window.__sketchforge.gotoFrame(5));
  await pg.screenshot({ path: out + '/puppet_mid.png' });
  // save / reopen keeps pins
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.keyboard.press('Control+s')]);
  await dl.saveAs(out + '/puppet.sketchforge');
  await pg.setInputFiles('#fileOpen', out + '/puppet.sketchforge'); await pg.waitForTimeout(1500);
  check('reopened: pins kept on keyframes', await E(() => { const SF = window.__sketchforge, l = SF.state.layers.find(x => x.cels.get(10) && x.cels.get(10)._pup); return !!l && l.cels.get(10)._pup.pins.length === 3 && l.cels.get(0)._pup.rest === l.cels.get(10)._pup.rest; }));
  console.log('page errors:', errors.length ? errors : 'none');
  console.log(ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
