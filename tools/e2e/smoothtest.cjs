// Sparse input (a busy phone sends few touch points): a circle from 8 points must stay round, not a 12-sided polygon.
const H = require('./harness.cjs');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, errors, done } = await H.open(root, 8803);
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  await pg.evaluate(() => { const SF = window.__sketchforge; SF.newDocument(800, 800, 1, 12, false, 'Round'); }); await pg.waitForTimeout(300);
  await pg.evaluate(() => window.__sketchforge.selectTool('pen'));
  const cx = 400, cy = 400, r = 250, N = 8, pts = [];
  for (let i = 0; i <= N; i++) { const a = i / N * Math.PI * 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  const c = []; for (const [x, y] of pts) c.push(await pg.d2c(x, y));
  await pg.mouse.move(c[0][0], c[0][1]); await pg.mouse.down();
  for (const q of c.slice(1)) await pg.mouse.move(q[0], q[1], { steps: 1 }); // one event per point: very sparse
  await pg.mouse.up(); await pg.waitForTimeout(200);
  // roundness: distance from the centre to the line, all around (a polygon varies by r(1 - cos(pi/N)) = 19 px here)
  const radii = await pg.evaluate(([cx, cy]) => { const SF = window.__sketchforge, l = SF.activeLayer(), cel = [...l.cels.values()][0], g = cel.getContext('2d');
    const d = g.getImageData(0, 0, cel.width, cel.height).data, out = [];
    for (let i = 0; i < 72; i++) { const a = i / 72 * Math.PI * 2; let r0 = -1, r1 = -1;
      for (let r = 150; r < 330; r += 0.5) { const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r); if (d[(y * cel.width + x) * 4 + 3] > 128) { if (r0 < 0) r0 = r; r1 = r; } }
      if (r0 > 0 && i > 9 && i < 63) out.push((r0 + r1) / 2); } // skip the first / last piece (no neighbour to curve towards)
    return out; }, [cx, cy]);
  const spread = Math.max(...radii) - Math.min(...radii);
  console.log('     radius spread', spread.toFixed(1), 'px over', radii.length, 'angles');
  await pg.screenshot({ path: out + '/smooth_circle.png' });
  check('sparse circle stays round (radius varies < 8 px, a polygon would vary 19 px)', radii.length > 50 && spread < 8);
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
