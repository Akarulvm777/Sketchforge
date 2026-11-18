// Hold gestures: QuickShape (hold at the end of a wobbly stroke -> perfect shape) and hold-to-pick colour.
const H = require('./harness.cjs');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, errors, done } = await H.open(root, 8811);
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const fresh = async () => { await pg.evaluate(() => { const SF = window.__sketchforge; SF.newDocument(800, 800, 1, 12, false, 'Hold'); SF.selectTool('pen'); SF.setColor('#000000'); }); await pg.waitForTimeout(250); };
  const ink = () => pg.evaluate(() => { const SF = window.__sketchforge, l = SF.activeLayer(), cel = [...l.cels.values()][0], d = cel.getContext('2d').getImageData(0, 0, cel.width, cel.height).data;
    const P = []; for (let y = 0; y < cel.height; y += 2) for (let x = 0; x < cel.width; x += 2) if (d[(y * cel.width + x) * 4 + 3] > 128) P.push([x, y]); return P; });
  // draw a stroke through doc points, then hold still (ms) before lifting
  const draw = async (pts, hold) => {
    const c = []; for (const [x, y] of pts) c.push(await pg.d2c(x, y));
    await pg.mouse.move(c[0][0], c[0][1]); await pg.mouse.down();
    for (const q of c.slice(1)) await pg.mouse.move(q[0], q[1], { steps: 2 });
    if (hold) await pg.waitForTimeout(hold);
    await pg.mouse.up(); await pg.waitForTimeout(150);
  };
  const wob = (i, a = 9) => Math.sin(i * 1.7) * a + Math.cos(i * 0.6) * a * 0.6;

  // 1. wobbly circle + hold -> circle
  await fresh();
  const circ = []; for (let i = 0; i <= 60; i++) { const t = i / 60 * Math.PI * 2, r = 220 + wob(i); circ.push([400 + Math.cos(t) * r, 400 + Math.sin(t) * r]); }
  await draw(circ, 900);
  let P = await ink();
  const mx = P.reduce((s, p) => s + p[0], 0) / P.length, my = P.reduce((s, p) => s + p[1], 0) / P.length; // centre of the drawn circle
  const rad = P.map(([x, y]) => Math.hypot(x - mx, y - my)), spread = Math.max(...rad) - Math.min(...rad);
  console.log('     circle: ink radius', Math.min(...rad).toFixed(0), '..', Math.max(...rad).toFixed(0));
  check('wobbly circle + hold becomes a round circle (radius spread < 14 px, line width included)', P.length > 100 && spread < 14);
  await pg.screenshot({ path: out + '/hold_circle.png' });
  // undo removes it in one step
  await pg.evaluate(() => window.__sketchforge.CMD.undo()); P = await ink();
  check('undo removes the snapped shape', P.length === 0);

  // 2. same circle without holding: stays as drawn (wobbly)
  await fresh(); await draw(circ, 0); P = await ink();
  { const r = P.map(([x, y]) => Math.hypot(x - 400, y - 400)); check('without holding the stroke stays as drawn', Math.max(...r) - Math.min(...r) > 18); }

  // 3. wobbly line + hold -> straight
  await fresh();
  const line = []; for (let i = 0; i <= 30; i++) line.push([100 + i * 20, 300 + wob(i, 6) + i * 0.3]);
  await draw(line, 900); P = await ink();
  { // distance of ink to the best straight line through the endpoints
    const ys = P.filter(p => p[0] > 150 && p[0] < 650).map(p => p[1]);
    console.log('     line: y range', Math.min(...ys), '..', Math.max(...ys));
    check('wobbly line + hold becomes straight (thickness only)', ys.length > 50 && Math.max(...ys) - Math.min(...ys) < 16);
  }

  // 4. wobbly square + hold -> square with straight sides
  await fresh();
  const sq = [], C = [[200, 200], [600, 200], [600, 600], [200, 600], [200, 200]];
  for (let k = 0; k < 4; k++) for (let i = 0; i < 12; i++) { const a = C[k], b = C[k + 1], t = i / 12; sq.push([a[0] + (b[0] - a[0]) * t + wob(i + k * 12, 5), a[1] + (b[1] - a[1]) * t + wob(i + k * 7, 5)]); }
  sq.push([203, 205]);
  await draw(sq, 900); P = await ink();
  { const top = P.filter(p => p[0] > 260 && p[0] < 540 && p[1] < 400).map(p => p[1]);
    const shape = await pg.evaluate(() => document.querySelector('#toast') ? document.querySelector('#toast').textContent : '');
    console.log('     square:', shape, '| top side y', Math.min(...top), '..', Math.max(...top));
    check('wobbly square + hold becomes a square (straight top side)', top.length > 30 && Math.max(...top) - Math.min(...top) < 14 && /Square|Rectangle/.test(shape)); }
  await pg.screenshot({ path: out + '/hold_square.png' });

  // 4b. triangle
  await fresh();
  const tri = [], T = [[400, 150], [650, 600], [150, 600], [400, 150]];
  for (let k = 0; k < 3; k++) for (let i = 0; i < 14; i++) { const a = T[k], b = T[k + 1], t = i / 14; tri.push([a[0] + (b[0] - a[0]) * t + wob(i + k * 5, 5), a[1] + (b[1] - a[1]) * t + wob(i * 2 + k, 5)]); }
  tri.push([402, 156]);
  await draw(tri, 900);
  check('wobbly triangle + hold is recognised as a triangle', /Triangle/.test(await pg.evaluate(() => document.querySelector('#toast').textContent)));
  { P = await ink(); const bottom = P.filter(p => p[0] > 220 && p[0] < 580 && p[1] > 500).map(p => p[1]); check('its bottom side is straight', bottom.length > 30 && Math.max(...bottom) - Math.min(...bottom) < 14); }
  await pg.screenshot({ path: out + '/hold_triangle.png' });

  // 5. hold still at the start: eyedropper picks the colour, draws nothing
  await fresh();
  await pg.evaluate(() => { const SF = window.__sketchforge, l = SF.activeLayer(), g = [...l.cels.values()][0].getContext('2d'); g.fillStyle = '#2266dd'; g.fillRect(300, 300, 200, 200); SF.setColor('#000000'); });
  const [hx, hy] = await pg.d2c(400, 400);
  await pg.mouse.move(hx, hy); await pg.mouse.down(); await pg.waitForTimeout(800);
  const loupe = await pg.evaluate(() => { const e = document.querySelector('#holdLoupe'); return !!e && getComputedStyle(e).display !== 'none'; });
  await pg.mouse.up(); await pg.waitForTimeout(150);
  const col = await pg.evaluate(() => window.__sketchforge.state.color.toLowerCase());
  const blackDots = await pg.evaluate(() => { const l = window.__sketchforge.activeLayer(), d = [...l.cels.values()][0].getContext('2d').getImageData(380, 380, 40, 40).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 30 && d[i + 2] < 30 && d[i + 3] > 200) n++; return n; });
  check('hold at the start picks the colour (' + col + ')', col === '#2266dd');
  check('the colour preview circle shows while holding', loupe);
  check('the dab under the finger is removed', blackDots === 0);

  // 6. setting off: hold does nothing
  await pg.evaluate(() => window.__sketchforge.CMD.holdShape());
  await fresh(); await draw(circ, 900); P = await ink();
  { const r = P.map(([x, y]) => Math.hypot(x - 400, y - 400)); check('View › Hold to snap shapes off: stroke stays as drawn', Math.max(...r) - Math.min(...r) > 18); }
  await pg.evaluate(() => window.__sketchforge.CMD.holdShape());

  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
