// Smart colouring: Fill › Close gaps stops the fill at a gap in the lines (and reaches the lines: no halo);
// Auto-flat colours makes a "Flats" layer under the lines with one colour per closed area, the outside left empty.
const H = require('./harness.cjs');
const path = require('path');
(async () => {
  const root = process.argv[2], out = process.argv[3] || '/tmp';
  const { pg, errors, done } = await H.open(root, 8911, { width: 1300, height: 860 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  await pg.evaluate(() => { const SF = window.__sketchforge; SF.newDocument(600, 400, 1, 12, false, 'Fill'); SF.CMD.layerAdd(); const l = SF.activeLayer(); l.name = 'Ink';
    const g = l.cels.get(0).getContext('2d'); g.strokeStyle = '#111'; g.lineWidth = 4;
    g.beginPath(); g.arc(200, 200, 120, 0.12, Math.PI * 2 - 0.12); g.stroke();           // a circle with a ~25 px… no: a 3–4 px gap
    g.beginPath(); g.moveTo(200, 80); g.lineTo(200, 320); g.stroke();                     // splits it in two
    g.strokeRect(400, 120, 140, 160);                                                     // a closed box
    l.cels.get(0)._ink = true; l.cels.get(0)._sv = 9; SF.scope('refreshAll()'); });
  // the gap: make it exactly 6 px
  await pg.evaluate(() => { const g = window.__sketchforge.activeLayer().cels.get(0).getContext('2d'); g.strokeStyle = '#111'; g.lineWidth = 4; g.beginPath(); g.arc(200, 200, 120, -0.12, 0.12); g.stroke(); g.clearRect(315, 197, 12, 6); });
  // fill a new layer under the lines, lines from all layers
  await pg.evaluate(() => { const SF = window.__sketchforge; SF.CMD.layerAdd(); SF.selectTool('fill'); SF.state.fillAll = true; SF.setColor('#3366ff'); });
  const fillAt = async (x, y) => { const [cx, cy] = await pg.d2c(x, y); await pg.mouse.click(cx, cy); await pg.waitForTimeout(400); };
  const filled = () => pg.evaluate(() => { const c = window.__sketchforge.activeLayer().cels.get(0), d = c.getContext('2d').getImageData(0, 0, 600, 400).data; let n = 0, outside = d[(10 * 600 + 10) * 4 + 3]; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return { n, outside }; });
  await pg.evaluate(() => { window.__sketchforge.state.fillGap = 0; });
  await fillAt(260, 200); const leak = await filled();
  await pg.evaluate(() => window.__sketchforge.CMD.undo());
  await pg.evaluate(() => { window.__sketchforge.state.fillGap = 8; });
  await fillAt(260, 200); const sealed = await filled();
  console.log('     plain fill', JSON.stringify(leak), '| close gaps 8', JSON.stringify(sealed));
  check('without "Close gaps" the fill leaks out through the gap', leak.outside > 0);
  check('with "Close gaps" it stays inside the half circle', sealed.outside === 0 && sealed.n > 15000 && sealed.n < 30000);
  check('…and reaches the lines (no white halo)', await pg.evaluate(() => { const d = window.__sketchforge.activeLayer().cels.get(0).getContext('2d').getImageData(203, 200, 1, 1).data; return d[3] > 0; }));
  check('Fill tool property: Close gaps + Auto-flat button', await pg.evaluate(() => /Close gaps/.test(document.querySelector('#propBody').textContent) && /Auto-flat/.test(document.querySelector('#propBody').textContent)));
  // auto-flat from the Ink layer
  await pg.evaluate(() => { const SF = window.__sketchforge; SF.state.activeId = SF.state.layers.find(l => l.name === 'Ink').id; SF.state.fillGap = 8; SF.CMD.autoFlat(); });
  await pg.waitForTimeout(1500);
  const flats = await pg.evaluate(() => { const SF = window.__sketchforge, L = SF.state.layers, f = L.find(l => l.name === 'Flats'); if (!f) return null;
    const d = f.cels.get(0).getContext('2d').getImageData(0, 0, 600, 400).data, px = (x, y) => [...d.slice((y * 600 + x) * 4, (y * 600 + x) * 4 + 4)].join(',');
    return { below: L.indexOf(f) < L.findIndex(l => l.name === 'Ink'), left: px(140, 200), right: px(260, 200), box: px(470, 200), outside: px(10, 10), underLine: d[(200 * 600 + 200) * 4 + 3] }; });
  console.log('     ' + JSON.stringify(flats));
  check('Auto-flat: a "Flats" layer under the lines', flats && flats.below);
  check('…each closed area its own colour (both halves of the circle and the box)', flats && flats.left !== flats.right && flats.right !== flats.box && !/,0$/.test(flats.left) && !/,0$/.test(flats.box));
  check('…the outside stays empty, colour goes under the line edges', flats && /,0$/.test(flats.outside) && flats.underLine > 0);
  await pg.evaluate(() => window.__sketchforge.CMD.undo());
  check('undo removes the Flats layer', await pg.evaluate(() => !window.__sketchforge.state.layers.some(l => l.name === 'Flats')));
  // speed on an A4 page
  const ms = await pg.evaluate(() => { const S = window.__sketchforge.scope, w = 2480, h = 3508, m = new Uint8Array(w * h); for (let y = 0; y < h; y += 300) for (let x = 0; x < w; x++) m[y * w + x] = 1; for (let x = 0; x < w; x += 300) for (let y = 0; y < h; y++) m[y * w + x] = 1; const t = performance.now(); S('flatLabels')(m, w, h, 4, 30); return performance.now() - t; });
  console.log('     auto-flat on an A4 page: ' + Math.round(ms) + ' ms');
  check('auto-flat on an A4 page takes a few seconds at most', ms < 8000);
  await pg.screenshot({ path: path.join(out, 'smartfill.png') });
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done(); process.exit(ok.every(Boolean) && !errors.length ? 0 : 1);
})();
