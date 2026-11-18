// Light pen pressure: slow, light strokes must draw right up to the pen tip while drawing (no trailing lag),
// a stroke whose first samples report pressure 0 must start where the pen touched down, and light pressure gives a visible line.
const H = require('./harness.cjs');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, ctx, errors, done } = await H.open(root, 8814);
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const cdp = await ctx.newCDPSession(pg);
  const pen = (type, x, y, force) => cdp.send('Input.dispatchMouseEvent', { type, x, y, force, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, pointerType: 'pen', clickCount: 1 });
  await pg.evaluate(() => { const SF = window.__sketchforge; SF.newDocument(800, 600, 1, 12, false, 'Light'); SF.selectTool('pen'); });
  await pg.waitForTimeout(300);
  const inkNear = async (x, y) => { let m = 0; for (let dx = -3; dx <= 3; dx += 3) m = Math.max(m, await pg.inkAt(x + dx, y)); return m; };

  // slow light stroke, first 4 samples with pressure 0 (Windows Ink / some pens)
  const y = 300, [sx, sy] = await pg.d2c(100, y);
  await pen('mousePressed', sx, sy, 0);
  let x = 100;
  for (let i = 0; i < 4; i++) { x += 1; const c = await pg.d2c(x, y); await pen('mouseMoved', c[0], c[1], 0); }
  for (; x < 400; x += 0.8) { const c = await pg.d2c(x, y); await pen('mouseMoved', c[0], c[1], 0.06); } // slow and light
  await pg.waitForTimeout(50);
  // still drawing: the line must already reach the pen
  // the live stroke is in the stroke buffer until the pen lifts
  const nearTip = await pg.evaluate(([x, y]) => { const c = document.getElementById('stroke-buffer'), d = c.getContext('2d').getImageData(Math.round(x) - 6, y - 3, 3, 7).data; let m = 0; for (let i = 3; i < d.length; i += 4) m = Math.max(m, d[i]); return m; }, [x, y]);
  console.log('     ink 4–6 px behind the pen while drawing:', nearTip);
  check('slow light stroke reaches the pen tip while drawing (no trailing lag)', nearTip > 0);
  const end = await pg.d2c(x, y); await pen('mouseReleased', end[0], end[1], 0);
  await pg.waitForTimeout(150);
  check('stroke starts where the pen touched down, even with pressure 0 at first', (await inkNear(102, y)) > 0);
  check('light pressure (6 %) still draws a visible line', (await inkNear(250, y)) > 60);
  // thickness at light vs full pressure: light must be thinner (pressure works) but not invisible
  const thick = (yy) => pg.evaluate(yy => { const l = window.__sketchforge.activeLayer(), c = [...l.cels.values()][0], d = c.getContext('2d').getImageData(250, yy - 30, 1, 60).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 60) n++; return n; }, yy);
  const y2 = 450; let c0 = await pg.d2c(100, y2); await pen('mousePressed', c0[0], c0[1], 1);
  for (let xx = 100; xx < 400; xx += 3) { const c = await pg.d2c(xx, y2); await pen('mouseMoved', c[0], c[1], 1); }
  c0 = await pg.d2c(400, y2); await pen('mouseReleased', c0[0], c0[1], 0); await pg.waitForTimeout(150);
  const tl = await thick(y), tf = await thick(y2);
  console.log('     line thickness: light', tl, 'px, full', tf, 'px');
  check('light line is thinner than a full-pressure line', tl >= 1 && tl < tf);
  await pg.screenshot({ path: out + '/light_pressure.png' });
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
