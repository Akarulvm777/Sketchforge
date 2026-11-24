// Layer effects (p10sf): border, drop shadow, outer glow kept as settings: shown on screen, exported, follow new
// strokes, undo, saved; the layer's own pixels never change.
const H = require('./harness.cjs');
const path = require('path');
(async () => {
  const root = process.argv[2], out = process.argv[3] || '/tmp';
  const { pg, errors, done } = await H.open(root, 8918, { width: 1300, height: 860 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const S = src => pg.evaluate(s => window.__sketchforge.scope(s), src);
  await S(`(() => { newDocument(400, 300, 1, 12, false, 'F'); CMD.layerAdd(); const g = activeLayer().cels.get(0).getContext('2d'); g.fillStyle = '#2040ff'; g.fillRect(150, 100, 100, 100); activeLayer().cels.get(0)._ink = true; refreshAll(); })()`);
  const px = (x, y) => S(`[...compositeFrame(0, {}).getContext('2d').getImageData(${x}, ${y}, 1, 1).data].slice(0, 3)`);
  await S('CMD.layerFx()'); await pg.waitForTimeout(200);
  check('Layer › Layer effects opens its window', await pg.isVisible('#fxDialog'));
  await pg.evaluate(() => { const c = document.querySelector('#fxDialog .fxsec input[type=checkbox]'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); c.click && 0; });
  await S("activeLayer().fx.border.on = true; activeLayer().fx.border.color = '#ff0000'; activeLayer().fx.border.w = 8; refreshStage()");
  await pg.click('#fxDialog [data-a=ok]'); await pg.waitForTimeout(200);
  const edge = await px(145, 150), inside = await px(200, 150), far = await px(120, 150);
  console.log('     ' + JSON.stringify({ edge, inside, far }));
  check('border: a red outline around the shape in the picture', edge[0] > 200 && edge[2] < 60 && inside[2] > 200 && far.every(v => v > 240));
  check('the layer pixels are unchanged', await S('activeLayer().cels.get(0).getContext("2d").getImageData(145, 150, 1, 1).data[3]') === 0);
  check('on screen too', await S(`(() => { const v = activeLayer()._fxView; if (!v || !v.parentNode) return false; const d = v.getContext('2d').getImageData(145, 150, 1, 1).data; return d[0] > 200 && d[3] > 200; })()`));
  // a new stroke gets the outline too
  await S("selectTool('pen'); settings.pen.size = 10; setColor('#000000')");
  await pg.strokeDoc([[60, 260], [140, 260]]);
  await pg.waitForTimeout(300);
  check('a new stroke is outlined as well', (await px(100, 250))[0] > 200);
  // shadow
  await S("activeLayer().fx.shadow.on = true; activeLayer().fx.shadow.blur = 0; activeLayer().fx.shadow.alpha = 1; activeLayer().fx.shadow.dx = 20; activeLayer().fx.shadow.dy = 20; refreshStage()");
  const sh = await px(262, 215);
  check('drop shadow below right: ' + sh, sh.every(v => v < 60));
  await S("activeLayer().fx.glow.on = true; refreshStage()");
  check('outer glow works', !errors.length && (await px(200, 92)).some(v => v < 250));
  // undo of the whole effects window
  await S('activeLayer().fx = null; refreshStage()');
  await S('CMD.layerFx()'); await pg.waitForTimeout(150);
  await S("activeLayer().fx.border.on = true; activeLayer().fx.border.color = '#00ff00'"); await pg.click('#fxDialog [data-a=ok]');
  check('effects set again', (await px(145, 150))[1] > 200);
  await S('CMD.undo()'); await pg.waitForTimeout(150);
  check('undo removes them', (await px(145, 150)).every(v => v > 240));
  await S('CMD.redo()');
  const saved = await S('(async () => { const o = await buildDocObject(null, { cache: false }); const L = o.layers.find(l => l.fx); return L && L.fx.border.color; })()');
  check('saved in the file', saved === '#00ff00');
  await pg.screenshot({ path: path.join(out, 'layerfx.png') });
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
