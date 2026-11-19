// "Rig the fox" tutorial: opens the practice file (10 part layers), every "Show me" step works (assemble, link, joints,
// pose, animate, play), the arm follows the shoulder, the animation moves. Screenshots of each step: fox_N.png.
const H = require('./harness.cjs');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, errors, done } = await H.open(root, 8819, { width: 1400, height: 900 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  check('Help menu has "Rig the fox"', await pg.evaluate(() => window.__sketchforge.MENUS.find(m => m[0] === 'Help')[1].some(x => x[1] === 'tut_fox')));
  await pg.evaluate(() => window.__sketchforge.CMD.tut_fox()); await pg.waitForTimeout(1500);
  const doc = await pg.evaluate(() => ({ name: window.__sketchforge.state.name, layers: window.__sketchforge.state.layers.map(l => l.name) }));
  check(`practice file "${doc.name}" with the 10 parts on their own layers`, doc.layers.length === 11 && ['head', 'body', 'tail', 'right arm', 'left foot'].every(n => doc.layers.includes(n)));
  await pg.screenshot({ path: out + '/fox_1.png' });
  const demo = async (i, wait) => { await pg.click('.tut-next'); await pg.waitForTimeout(400); await pg.click('.tut-demo'); await pg.waitForTimeout(wait); await pg.screenshot({ path: out + `/fox_${i}.png` }); };
  // world position of a layer's pixel centre, on a frame
  const centre = (name, f = 0) => pg.evaluate(([name, f]) => { const SF = window.__sketchforge, l = SF.state.layers.find(x => x.name === name);
    let k = null; for (const x of l.cels.keys()) if (x <= f && (k === null || x > k)) k = x; const b = SF.celBBox(l.cels.get(k)); const m = SF.layerMat ? SF.layerMat(l, f) : null;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2; return m ? [m[0] * cx + m[2] * cy + m[4], m[1] * cx + m[3] * cy + m[5]] : [cx, cy]; }, [name, f]);
  await demo(2, 2200);
  const head = await pg.evaluate(() => { const SF = window.__sketchforge, b = SF.celBBox(SF.state.layers.find(x => x.name === 'head').cels.get(0)); return [b.x, b.y]; });
  check('Show me: the parts go together (head on top)', head[0] === 35 * 4 && head[1] === 4 * 4);
  await demo(3, 800);
  check('Show me: parts linked (arm → shoulder → body)', await pg.evaluate(() => { const L = window.__sketchforge.state.layers, f = n => L.find(x => x.name === n); return f('right arm').parent === f('right shoulder').id && f('right shoulder').parent === f('body').id && f('tail').parent === f('lower body').id; }));
  await demo(4, 800);
  check('Show me: joints placed', await pg.evaluate(() => window.__sketchforge.state.layers.filter(l => !l.paper).every(l => l.px != null)));
  const arm0 = await centre('right arm');
  await demo(5, 1600);
  const arm1 = await centre('right arm');
  console.log('     right arm centre', arm0.map(Math.round), '->', arm1.map(Math.round));
  check('Show me: turning the shoulder carries the arm', Math.hypot(arm1[0] - arm0[0], arm1[1] - arm0[1]) > 40);
  await demo(6, 1000);
  const a0 = await centre('right arm', 0), a8 = await centre('right arm', 8), t0 = await centre('tail', 0), t8 = await centre('tail', 8);
  check('Show me: animation (the arm and tail move between keyframes)', Math.hypot(a8[0] - a0[0], a8[1] - a0[1]) > 10 && Math.hypot(t8[0] - t0[0], t8[1] - t0[1]) > 5);
  check('…on 17 frames in the Animation workspace', await pg.evaluate(() => window.__sketchforge.state.frameCount >= 17 && window.__sketchforge.state.mode === 'anim'));
  await demo(7, 1200);
  const fA = await pg.evaluate(() => window.__sketchforge.state.frame); await pg.waitForTimeout(350); const fB = await pg.evaluate(() => window.__sketchforge.state.frame);
  check('Play runs the animation (frame ' + fA + ' → ' + fB + ')', fA !== fB);
  await pg.evaluate(() => window.__sketchforge.CMD.play());
  await pg.click('.tut-next'); await pg.waitForTimeout(300);
  check('tutorial finishes', !(await pg.isVisible('.tut-card')));
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
