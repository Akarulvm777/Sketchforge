// Selection bar + transform (p10sb): scale, rotate, distort, apply / cancel / undo, outline follows,
// and after moving a selection a drawing tool drops it so the old place can be drawn on.
const H = require('./harness.cjs');
const path = require('path');
(async () => {
  const root = process.argv[2], out = process.argv[3] || '/tmp';
  const { pg, errors, done } = await H.open(root, 8928, { width: 1300, height: 900 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const S = src => pg.evaluate(s => window.__sketchforge.scope(s), src);
  const ink = `(() => { const c = activeLayer().cels.get(0), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (let i = 3; i < d.length; i += 4) if (d[i] > 128) { n++; const p = (i - 3) / 4, x = p % c.width, y = (p / c.width) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return { n, x0, y0, x1, y1 }; })()`;
  await S(`(() => { newDocument(1000, 700, 1, 12, false, 'Sel'); CMD.layerAdd(); const g = activeLayer().cels.get(0) ? activeLayer().cels.get(0).getContext('2d') : acquireCel(activeLayer()).ctx; g.fillStyle = '#c03'; g.fillRect(200, 200, 100, 100); activeLayer().cels.get(0)._ink = true; refreshStage(); combineSel(m => { m.fillStyle = '#000'; m.fillRect(200, 200, 100, 100); }, 'replace'); })()`);
  await pg.waitForTimeout(400);
  const bar1 = await pg.evaluate(() => { const b = document.querySelector('#selBar'); return b && !b.hidden ? b.textContent : ''; });
  check('selection bar appears with Transform and Deselect', /Transform/.test(bar1) && /Deselect/.test(bar1));
  await pg.click('#selBar [data-a=transform]');
  check('transform starts', await S('SELX.on'));
  // drag the bottom-right corner from (300,300) to (400,400): 2× bigger
  const drag = async (fx, fy, tx, ty, steps = 8) => { const a = await pg.d2c(fx, fy), b = await pg.d2c(tx, ty); await pg.mouse.move(a[0], a[1]); await pg.mouse.down(); for (let i = 1; i <= steps; i++) await pg.mouse.move(a[0] + (b[0] - a[0]) * i / steps, a[1] + (b[1] - a[1]) * i / steps); await pg.mouse.up(); await pg.waitForTimeout(80); };
  await drag(300, 300, 400, 400);
  let r = await S(ink); console.log('     scaled ' + JSON.stringify(r));
  check('corner drag scales the part (100 → 200 px)', Math.abs(r.x1 - r.x0 - 200) <= 3 && Math.abs(r.y1 - r.y0 - 200) <= 3 && r.x0 >= 198 && r.x0 <= 202);
  // move by dragging inside
  await drag(300, 300, 350, 320);
  r = await S(ink); check('dragging inside moves it', Math.abs(r.x0 - 250) <= 3 && Math.abs(r.y0 - 220) <= 3);
  await pg.click('#selBar [data-a=apply]');
  r = await S(ink);
  const selbb = await S('sel.bb');
  check('apply keeps the result, the selection outline follows', !(await S('SELX.on')) && r.n > 38000 && selbb && Math.abs(selbb.w - 200) <= 3 && Math.abs(selbb.x - 250) <= 3);
  await S('CMD.undo()'); r = await S(ink);
  check('one undo brings back the original square and selection', Math.abs(r.x1 - r.x0 - 100) <= 2 && r.x0 === 200 && (await S('sel.bb.w')) === 100);
  // rotate 90°: handle above the top edge
  await pg.click('#selBar [data-a=transform]');
  const h = await S('(() => { const h = selxHandles(), r = vpRect(); return { rot: [h.rot[0] + r.left, h.rot[1] + r.top], c: [h.ctr[0] + r.left, h.ctr[1] + r.top] }; })()');
  await pg.mouse.move(h.rot[0], h.rot[1]); await pg.mouse.down();
  const R = h.c[0] - h.rot[0], Rr = Math.hypot(h.rot[0] - h.c[0], h.rot[1] - h.c[1]);
  for (let i = 1; i <= 10; i++) { const a = -Math.PI / 2 + (Math.PI / 4) * i / 10; await pg.mouse.move(h.c[0] + Math.cos(a) * Rr, h.c[1] + Math.sin(a) * Rr); }
  await pg.mouse.up(); await pg.waitForTimeout(80);
  r = await S(ink); console.log('     rotated 45° ' + JSON.stringify(r));
  check('rotate handle turns it (45°: wider box, same ink)', r.x1 - r.x0 > 130 && Math.abs(r.n - 10000) < 1500);
  await pg.click('#selBar [data-a=cancel]'); r = await S(ink);
  check('cancel puts it back exactly', r.x0 === 200 && r.x1 === 299 && r.n === 10000);
  // distort: pull one corner
  await pg.click('#selBar [data-a=transform]'); await pg.click('#selBar [data-a=distort]');
  await drag(300, 300, 380, 340);
  r = await S(ink); console.log('     distorted ' + JSON.stringify(r));
  check('distort moves one corner on its own', r.x1 >= 375 && r.y1 >= 335 && r.y0 === 200 && r.x0 === 200);
  await pg.screenshot({ path: path.join(out, 'seltrans.png') });
  await pg.click('#selBar [data-a=apply]');
  // after moving / transforming, choosing a brush drops the selection: the old place can be drawn on
  await S("selectTool('pen')");
  check('a drawing tool drops a moved / transformed selection', !(await S('sel.active')));
  await S("(() => { activeLayer().cels.get(0).getContext('2d').clearRect(0, 0, 1000, 700); setColor('#000'); })()");
  await pg.strokeDoc([[600, 500], [700, 520], [800, 540]]);
  r = await S(ink); check('then drawing works outside the old selection', r.n > 100 && r.x0 >= 590);
  // Move tool path too
  await S("(() => { combineSel(m => { m.fillStyle = '#000'; m.fillRect(590, 480, 230, 80); }, 'replace'); selectTool('move'); })()");
  await drag(650, 510, 650, 300);
  check('moving the selected part with the Move tool marks it', await S('sel._floated === true'));
  await S("selectTool('pen')");
  check('…and the pen then drops the selection', !(await S('sel.active')));
  const bar2 = await pg.evaluate(() => { const b = document.querySelector('#selBar'); return !b || b.hidden; });
  check('bar hidden without a selection', bar2);
  check('unit: quad maths', await S(`(() => { const q = [[0,0],[10,0],[10,10],[0,10]]; const p = quadPoint(q, .5, .5); const s = quadScaleCorner(q, 2, 20, 20, false); const e = quadScaleEdge(q, 1, 30, 5); return p[0] === 5 && p[1] === 5 && quadIsAffine(q) && s[2][0] === 20 && s[0][0] === 0 && e[1][0] === 30 && e[2][0] === 30 && e[0][0] === 0 && !quadIsAffine([[0,0],[10,0],[20,20],[0,10]]); })()`));
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
