// Curve ruler and concentric ruler (p10rf): strokes follow the drawn curve / go round the centre.
const H = require('./harness.cjs');
const path = require('path');
(async () => {
  const root = process.argv[2], out = process.argv[3] || '/tmp';
  const { pg, errors, done } = await H.open(root, 8923, { width: 1300, height: 860 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const S = src => pg.evaluate(s => window.__sketchforge.scope(s), src);
  await S("newDocument(800, 600, 1, 12, false, 'R'); CMD.layerAdd()");
  const drag = async pts => { const s = await pg.d2c(pts[0][0], pts[0][1]); await pg.mouse.move(s[0], s[1]); await pg.mouse.down(); for (const p of pts.slice(1)) { const c = await pg.d2c(p[0], p[1]); await pg.mouse.move(c[0], c[1], { steps: 2 }); } await pg.mouse.up(); await pg.waitForTimeout(150); };
  const ink = (x, y) => S(`(() => { const d = activeLayer().cels.get(0).getContext('2d').getImageData(${x - 4}, ${y - 4}, 9, 9).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 80) n++; return n; })()`);
  // curve ruler: an arch y = 300 - 150 sin(πx/800)
  await S("selectGroup('ruler'); selectTool('rl_curve')");
  const arch = []; for (let x = 50; x <= 750; x += 25) arch.push([x, 300 - 150 * Math.sin(Math.PI * x / 800)]);
  await drag(arch);
  check('the curve ruler is kept and smoothed', await S('ruler.curve && ruler.curve.pts.length > 20'));
  await S("selectTool('pen'); settings.pen.size = 6; setColor('#000000')");
  // a straight stroke that starts on the curve: it slides along the arch
  await drag([[200, 300 - 150 * Math.sin(Math.PI * 200 / 800)], [400, 140], [600, 140]]);
  const yAt = x => Math.round(300 - 150 * Math.sin(Math.PI * x / 800));
  console.log('     ink on the arch at x=400: ' + await ink(400, yAt(400)) + ', straight path: ' + await ink(500, 140));
  check('a stroke starting on the curve follows it', await ink(400, yAt(400)) > 5 && await ink(500, yAt(500)) > 5);
  // concentric: centre (400, 300), circles
  await S("CMD.rulerClear(); CMD.layerAdd(); selectGroup('ruler'); selectTool('rl_conc')");
  await drag([[300, 200], [500, 400]]);
  check('the concentric ruler is set (centre 400, 300)', await S('ruler.conc && Math.round(ruler.conc.cx) === 400 && Math.round(ruler.conc.cy) === 300'));
  await S("selectTool('pen')");
  // start 150 px right of the centre, move up-left: the stroke stays at 150 px from the centre
  await drag([[550, 300], [520, 200], [400, 140], [300, 180]]);
  const r = await S(`(() => { const d = activeLayer().cels.get(0).getContext('2d').getImageData(0, 0, 800, 600).data; let mn = 1e9, mx = 0; for (let y = 0; y < 600; y += 2) for (let x = 0; x < 800; x += 2) if (d[(y * 800 + x) * 4 + 3] > 120) { const q = Math.hypot(x - 400, y - 300); mn = Math.min(mn, q); mx = Math.max(mx, q); } return [Math.round(mn), Math.round(mx)]; })()`);
  console.log('     distance of the ink from the centre: ' + r);
  check('the stroke goes round the centre at the same distance', r[0] > 140 && r[1] < 160);
  await pg.screenshot({ path: path.join(out, 'rulers2.png') });
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
