// Adjustment layers (p10se): change everything below without touching it; settings can be changed later; erasing
// the layer limits where it applies; opacity = strength; undo; export / eyedropper / save see the same.
const H = require('./harness.cjs');
const path = require('path');
(async () => {
  const root = process.argv[2], out = process.argv[3] || '/tmp';
  const { pg, errors, done } = await H.open(root, 8917, { width: 1300, height: 860 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const S = src => pg.evaluate(s => window.__sketchforge.scope(s), src);
  // a red half and a grey half
  await S(`(() => { newDocument(400, 200, 1, 12, false, 'A'); CMD.layerAdd(); const g = activeLayer().cels.get(0).getContext('2d'); g.fillStyle = '#c03020'; g.fillRect(0, 0, 200, 200); g.fillStyle = '#808080'; g.fillRect(200, 0, 200, 200); activeLayer().cels.get(0)._ink = true; refreshAll(); })()`);
  const px = (x, y) => S(`[...compositeFrame(0, {}).getContext('2d').getImageData(${x}, ${y}, 1, 1).data].slice(0, 3)`);
  const before = await px(100, 100);
  await S("CMD.adj_invert()"); await pg.waitForTimeout(300);
  check('a new adjustment layer goes above, with its settings window', await S('activeLayer().adjust.kind') === 'invert' && await pg.isVisible('#adjDialog'));
  await pg.click('#adjDialog [data-a=ok]');
  const inv = await px(100, 100);
  console.log('     ' + before + ' → ' + inv);
  check('invert: the colours below are inverted in the picture', inv.every((v, i) => Math.abs(v - (255 - before[i])) <= 2));
  check('the layer below keeps its own pixels', await S('(() => { const d = state.layers[state.layers.indexOf(activeLayer()) - 1].cels.get(0).getContext("2d").getImageData(100, 100, 1, 1).data; return d[0]; })()') === 0xc0);
  // on screen the same (the baked view of the adjustment layer)
  await pg.waitForTimeout(200);
  check('on screen too', await S(`(() => { const l = activeLayer(), v = l._bv; if (!v) return false; const d = v.getContext('2d').getImageData(100, 100, 1, 1).data; return Math.abs(d[0] - (255 - 0xc0)) <= 2; })()`));
  // opacity = strength
  await S('activeLayer().opacity = 0.5; refreshAll()');
  const half = await px(100, 100);
  check('opacity 50 % = half strength: ' + half, Math.abs(half[0] - (0xc0 + (255 - 0xc0)) / 2) <= 4);
  await S('activeLayer().opacity = 1; refreshAll()');
  // erasing part of the mask keeps that part unchanged
  await S(`(() => { const c = activeLayer().cels.get(0); c.getContext('2d').clearRect(200, 0, 200, 200); c._sv = (c._sv || 0) + 1; refreshAll(); })()`);
  check('erased part of the adjustment layer: no change there', (await px(300, 100)).every(v => Math.abs(v - 0x80) <= 2) && (await px(100, 100))[0] < 100);
  // a new adjustment with settings, changed later (one undo step)
  await S("CMD.adj_hsb()"); await pg.waitForTimeout(200);
  await pg.click('#adjDialog [data-a=ok]');
  await S("activeLayer().adjust.sat = -100; activeLayer()._bvSelf = null; refreshAll()");
  const grey = await px(100, 100);
  check('Hue / Saturation: saturation −100 makes it grey: ' + grey, Math.abs(grey[0] - grey[1]) <= 3 && Math.abs(grey[1] - grey[2]) <= 3);
  await S("activeLayer().adjust.sat = 0; activeLayer()._bvSelf = null; refreshAll()");
  await S('CMD.adjSettings()'); await pg.waitForTimeout(200);
  await pg.evaluate(() => { const r = [...document.querySelectorAll('#adjDialog input[type=range]')][1]; r.value = -100; r.dispatchEvent(new Event('input', { bubbles: true })); });
  await pg.waitForTimeout(150);
  await pg.click('#adjDialog [data-a=ok]');
  check('the settings can be changed later', await S('activeLayer().adjust.sat') === -100);
  await S('CMD.undo()'); await pg.waitForTimeout(150);
  check('undo goes back to the old settings', await S('activeLayer().adjust.sat') === 0);
  // levels / curve / posterize / threshold / gradient map / colour balance / bc all run
  for (const k of ['levels', 'curve', 'balance', 'gradmap', 'posterize', 'threshold', 'bc']) { await S(`CMD.adj_${k}()`); await pg.waitForTimeout(80); await pg.click('#adjDialog [data-a=ok]'); }
  check('every kind of adjustment layer works', await S('state.layers.filter(l => l.adjust).length') === 9 && !errors.length);
  // saved in the file
  const saved = await S('(async () => { const o = await buildDocObject(null, { cache: false }); return o.layers.filter(l => l.adjust).map(l => l.adjust.kind); })()');
  check('saved in the file: ' + saved.join(','), saved.length === 9 && saved[0] === 'invert');
  await pg.screenshot({ path: path.join(out, 'adjust.png') });
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
