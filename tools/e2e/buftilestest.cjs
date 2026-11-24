// Big pages (p10wab): the stroke being drawn is shown in 512 px tiles instead of the page-size buffer.
// Same pixels as the old way, tiles only during the stroke, buffer hidden meanwhile; symmetry and textures too.
const H = require('./harness.cjs');
const path = require('path');
(async () => {
  const root = process.argv[2], out = process.argv[3] || '/tmp';
  const { pg, errors, done } = await H.open(root, 8927, { width: 1200, height: 900 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const S = src => pg.evaluate(s => window.__sketchforge.scope(s), src);
  const draw = (tiles, setup) => S(`(async () => {
    BUFT.on = ${tiles}; symSet(false); newDocument(2894, 4093, 1, 12, false, 'Big'); setColor('#203040'); selectTool('pen'); ${setup || ''} fit();
    const vp = document.querySelector('#viewport'), R = vp.getBoundingClientRect(), cx = R.left + R.width / 2, cy = R.top + R.height / 2;
    const ev = (type, x, y) => vp.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, pointerType: 'pen', pressure: 0.7, buttons: 1, bubbles: true, isPrimary: true }));
    ev('pointerdown', cx - 150, cy - 200); let during = null;
    for (let i = 1; i <= 30; i++) { ev('pointermove', cx - 150 + i * 9, cy - 200 + i * 12 + Math.sin(i / 3) * 30); if (i === 15) { await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); during = { tiles: BUFT.tiles.size, el: !!(BUFT.el && BUFT.el.parentNode), bufHidden: bufCanvas.style.display === 'none', tileInk: [...BUFT.tiles.values()].some(c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let k = 3; k < d.length; k += 4) if (d[k]) return true; return false; }) }; } }
    ev('pointerup', cx + 120, cy + 170);
    const after = { el: !!document.querySelector('.buf-tiles'), bufShown: bufCanvas.style.display !== 'none' };
    const c = activeLayer().cels.get(0), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let sum = 0, n = 0; for (let k = 3; k < d.length; k += 4) if (d[k]) { n++; sum += d[k] * (k % 9973); }
    return { during, after, n, sum };
  })()`);
  const a = await draw(false), b = await draw(true);
  console.log('     old way ' + a.n + ' px, tiles ' + b.n + ' px; during the stroke ' + JSON.stringify(b.during));
  check('during a stroke on a big page: tiles with ink, page-size buffer hidden', b.during && b.during.tiles > 0 && b.during.el && b.during.bufHidden && b.during.tileInk);
  check('after the stroke: tiles gone, buffer back', !b.after.el && b.after.bufShown);
  check('same pixels as without tiles', a.n > 1000 && a.n === b.n && a.sum === b.sum);
  check('old way untouched when off', a.during && a.during.tiles === 0 && !a.during.bufHidden);
  const sa = await draw(false, "Object.assign(settings.pen, { tex: 'linen', texAmt: 1 }); symSet(true); ruler.symMode = 'mirror';"), sb = await draw(true, "Object.assign(settings.pen, { tex: 'linen', texAmt: 1 }); symSet(true); ruler.symMode = 'mirror';");
  check('texture + symmetry: same pixels', sa.n > 1000 && sa.n === sb.n && sa.sum === sb.sum);
  // erasers: the layer's touched parts live in tiles during the stroke, then go back; same pixels, undo works
  const erase = tiles => S(`(async () => {
    BUFT.on = ${tiles}; symSet(false); newDocument(2894, 4093, 1, 12, false, 'Er'); setColor('#203040'); selectTool('pen'); fit();
    const vp = document.querySelector('#viewport'), R = vp.getBoundingClientRect(), cx = R.left + R.width / 2, cy = R.top + R.height / 2;
    const ev = (type, x, y) => vp.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, pointerType: 'pen', pressure: 0.9, buttons: 1, bubbles: true, isPrimary: true }));
    const line = async (y0, dy, mid) => { ev('pointerdown', cx - 150, cy + y0); for (let i = 1; i <= 30; i++) { ev('pointermove', cx - 150 + i * 10, cy + y0 + i * dy); if (mid && i === 15) await mid(); } ev('pointerup', cx + 150, cy + y0 + 30 * dy); };
    settings.pen.size = 60; await line(-150, 10);
    const ink = () => { const c = activeLayer().cels.get(0), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0, sum = 0; for (let k = 3; k < d.length; k += 4) if (d[k]) { n++; sum += d[k] * (k % 9973); } return { n, sum }; };
    const before = ink(); selectTool('eraser'); settings.eraser.size = 30; let mid = null;
    await line(150, -10, async () => { await new Promise(r => requestAnimationFrame(r)); mid = { ov: !!document.querySelector('.mir-ov'), tiles: document.querySelectorAll('.mir-ov canvas').length }; });
    const after = ink(), ovGone = !document.querySelector('.mir-ov'); CMD.undo(); const undone = ink();
    return { before, after, mid, ovGone, undoOk: undone.n === before.n && undone.sum === before.sum };
  })()`);
  const ea = await erase(false), eb = await erase(true);
  console.log('     eraser: ' + JSON.stringify({ off: ea.after, on: eb.after, mid: eb.mid }));
  check('eraser on a big page: tiles over the layer during the stroke, gone after', eb.mid && eb.mid.ov && eb.mid.tiles > 0 && eb.ovGone);
  check('eraser: same pixels as without tiles, and it really erased', ea.after.n < ea.before.n && ea.after.n === eb.after.n && ea.after.sum === eb.after.sum);
  check('eraser: undo brings the line back', ea.undoOk && eb.undoOk);
  const small = await S(`(() => { BUFT.on = true; newDocument(800, 600, 1, 12, false, 'Small'); return buftWanted({ s: {} }); })()`);
  check('small pages keep the plain buffer', small === false);
  await pg.screenshot({ path: path.join(out, 'buftiles.png') });
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
