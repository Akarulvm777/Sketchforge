// Perspective rulers: 2 vanishing points placed by clicks, a stroke started towards a point follows the line to it,
// a stroke started upwards stays vertical; 3 points: verticals go to the third point; points can be dragged.
const H = require('./harness.cjs');
const path = require('path');
(async () => {
  const root = process.argv[2], out = process.argv[3] || '/tmp';
  const { pg, errors, done } = await H.open(root, 8912, { width: 1300, height: 860 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  check('pure: directions and pick', await pg.evaluate(() => { const S = window.__sketchforge.scope; const d = S('perspDirs')([{ x: 0, y: 0 }, { x: 100, y: 0 }], 50, 50); return d.length === 3 && Math.abs(S('perspPick')(d, 0, 10) - Math.PI / 2) < 1e-9; }));
  await pg.evaluate(() => { const SF = window.__sketchforge; SF.newDocument(800, 600, 1, 12, false, 'P'); SF.CMD.layerAdd(); SF.selectTool('rl_persp'); });
  await pg.evaluate(() => { document.querySelectorAll('#propBody .seg button')[1].click(); }); // 2 points
  for (const [x, y] of [[40, 200], [760, 200]]) { const c = await pg.d2c(x, y); await pg.mouse.click(c[0], c[1]); await pg.waitForTimeout(150); }
  check('two clicks place two vanishing points', await pg.evaluate(() => window.__sketchforge.scope('ruler.vps.length') === 2));
  await pg.evaluate(() => window.__sketchforge.selectTool('pen'));
  // a stroke from (400, 400) heading roughly to point 1 (40, 200): the end should land on the line to point 1
  const strokeEnd = async (pts) => { await pg.evaluate(() => window.__sketchforge.CMD.layerAdd()); await pg.strokeDoc(pts); await pg.waitForTimeout(150);
    return pg.evaluate(() => { const c = window.__sketchforge.activeLayer().cels.get(0), d = c.getContext('2d').getImageData(0, 0, 800, 600).data; let xs = []; for (let y = 0; y < 600; y++) for (let x = 0; x < 800; x++) if (d[(y * 800 + x) * 4 + 3] > 128) xs.push([x, y]); return xs; }); };
  const onLine = (px, a, b, tol) => px.every(([x, y]) => Math.abs((x - a[0]) * (b[1] - a[1]) - (y - a[1]) * (b[0] - a[0])) / Math.hypot(b[0] - a[0], b[1] - a[1]) < tol);
  const s1 = await strokeEnd([[400, 400], [330, 370], [260, 345], [200, 310]]);
  check(`a stroke towards point 1 follows the line to it (${s1.length} px)`, s1.length > 100 && onLine(s1, [400, 400], [40, 200], 8));
  const s2 = await strokeEnd([[400, 400], [405, 340], [398, 280], [402, 220]]);
  check('a stroke started upwards stays vertical (2 points)', s2.length > 100 && s2.every(([x]) => Math.abs(x - 400) < 8));
  // 3 points: the third point is the vertical one
  await pg.evaluate(() => { const SF = window.__sketchforge; SF.selectTool('rl_persp'); document.querySelectorAll('#propBody .seg button')[2].click(); });
  { const c = await pg.d2c(400, 2000 > 600 ? 590 : 590); await pg.mouse.click(c[0], c[1]); await pg.waitForTimeout(150); }
  await pg.evaluate(() => window.__sketchforge.scope('ruler.vps[2] = { x: 400, y: 1600 }'));
  await pg.evaluate(() => window.__sketchforge.selectTool('pen'));
  const s3 = await strokeEnd([[250, 300], [253, 240], [249, 180], [252, 120]]);
  check('3 points: a near-vertical stroke goes towards the third point', s3.length > 80 && onLine(s3, [250, 300], [400, 1600], 8));
  // drag a point
  await pg.evaluate(() => window.__sketchforge.selectTool('rl_persp'));
  { const a = await pg.d2c(40, 200), b = await pg.d2c(100, 150); await pg.mouse.move(a[0], a[1]); await pg.mouse.down(); await pg.mouse.move(b[0], b[1], { steps: 6 }); await pg.mouse.up(); }
  check('dragging a vanishing point moves it', await pg.evaluate(() => { const p = window.__sketchforge.scope('ruler.vps[0]'); return Math.abs(p.x - 100) < 3 && Math.abs(p.y - 150) < 3; }));
  check('Tool Property: 1 / 2 / 3 points', await pg.evaluate(() => /1 point/.test(document.querySelector('#propBody').textContent) && /3 points/.test(document.querySelector('#propBody').textContent)));
  await pg.screenshot({ path: path.join(out, 'persp.png') });
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done(); process.exit(ok.every(Boolean) && !errors.length ? 0 : 1);
})();
