// Vector layers: pen lines are kept as editable lines; the Vector eraser removes a line up to where it crosses the
// others; Vector edit bends a line and changes its thickness; undo / redo; saved and opened; fill is refused there.
const H = require('./harness.cjs');
const path = require('path');
(async () => {
  const root = process.argv[2], out = process.argv[3] || '/tmp';
  const { pg, errors, done } = await H.open(root, 8913, { width: 1300, height: 860 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  await pg.evaluate(() => { const SF = window.__sketchforge; SF.newDocument(600, 400, 1, 12, false, 'Vec'); SF.CMD.newVectorLayer(); SF.selectTool('pen'); SF.settings.pen.size = 6; SF.settings.pen.smooth = 0; });
  const line = async (a, b) => { const pts = []; for (let i = 0; i <= 12; i++) pts.push([a[0] + (b[0] - a[0]) * i / 12, a[1] + (b[1] - a[1]) * i / 12]); await pg.strokeDoc(pts); await pg.waitForTimeout(100); };
  await line([60, 200], [540, 200]); await line([200, 60], [200, 340]); await line([400, 60], [400, 340]);
  const info = () => pg.evaluate(() => { const SF = window.__sketchforge, l = SF.activeLayer(), c = l.cels.get(0), d = c.getContext('2d').getImageData(0, 0, 600, 400).data; const a = (x, y) => d[(y * 600 + x) * 4 + 3];
    return { vector: !!l.vector, lines: (c._vec || []).length, mid: a(300, 200), left: a(120, 200), right: a(480, 200), vert: a(200, 120) }; });
  const i1 = await info(); console.log('     ' + JSON.stringify(i1));
  check('a vector layer keeps each pen stroke as a line', i1.vector && i1.lines === 3 && i1.mid > 100);
  // vector eraser, to the crossings: rub the middle of the horizontal line
  await pg.evaluate(() => window.__sketchforge.selectTool('vecerase'));
  { const c = await pg.d2c(300, 200); await pg.mouse.click(c[0], c[1]); await pg.waitForTimeout(200); }
  const i2 = await info(); console.log('     ' + JSON.stringify(i2));
  check('Vector eraser: the middle part goes, up to the crossing lines; the ends stay', i2.mid === 0 && i2.left > 100 && i2.right > 100 && i2.lines === 4);
  await pg.evaluate(() => window.__sketchforge.CMD.undo()); await pg.waitForTimeout(150);
  check('undo brings the line back', (await info()).mid > 100);
  await pg.evaluate(() => window.__sketchforge.CMD.redo()); await pg.waitForTimeout(150);
  // vector edit: bend the left vertical line, then thicker
  await pg.evaluate(() => window.__sketchforge.selectTool('vecedit'));
  { const a = await pg.d2c(200, 120), b = await pg.d2c(250, 120); await pg.mouse.move(a[0], a[1]); await pg.mouse.down(); await pg.mouse.move(b[0], b[1], { steps: 8 }); await pg.mouse.up(); await pg.waitForTimeout(200); }
  const bent = await pg.evaluate(() => { const d = window.__sketchforge.activeLayer().cels.get(0).getContext('2d').getImageData(0, 0, 600, 400).data; const a = (x, y) => d[(y * 600 + x) * 4 + 3]; return { old: a(200, 120), moved: Math.max(a(246, 120), a(248, 120), a(250, 120), a(252, 120)) }; });
  check('Vector edit: dragging a line bends it there', bent.old === 0 && bent.moved > 100);
  const thick = await pg.evaluate(async () => { const SF = window.__sketchforge, cel = SF.activeLayer().cels.get(0), S = SF.scope, i = S('VEC').sel; const ln = cel._vec[i]; const w0 = ln.s.size; const inp = [...document.querySelectorAll('#propBody input[type=range]')][0]; inp.value = 30; inp.dispatchEvent(new Event('input')); await new Promise(r => setTimeout(r, 100)); return { w0, w1: cel._vec[i].s.size }; });
  check('Vector edit: the thickness slider changes the line', thick.w1 === 30 && thick.w0 !== 30);
  // fill refused on a vector layer
  await pg.evaluate(() => window.__sketchforge.selectTool('fill'));
  { const c = await pg.d2c(300, 300); await pg.mouse.click(c[0], c[1]); await pg.waitForTimeout(200); }
  check('fill is refused on a vector layer (colours go on a normal layer)', /normal layer/.test(await pg.textContent('#toast')));
  // save / open
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.evaluate(() => window.__sketchforge.CMD.save())]);
  const fl = path.join(out, 'vec.sketchforge'); await dl.saveAs(fl);
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.evaluate(() => window.__sketchforge.CMD.open())]);
  await fc.setFiles(fl); await pg.waitForTimeout(1200);
  check('saved and opened: still a vector layer with its lines', await pg.evaluate(() => { const l = window.__sketchforge.state.layers.find(x => x.vector); return !!(l && l.cels.get(0)._vec && l.cels.get(0)._vec.length === 4); }));
  await pg.screenshot({ path: path.join(out, 'vector.png') });
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done(); process.exit(ok.every(Boolean) && !errors.length ? 0 : 1);
})();
