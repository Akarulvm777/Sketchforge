// Clip Studio tools of every kind: each imported .sut lands in the right tool group automatically (pen, pencil, brush,
// airbrush, decoration, eraser, blend, gradient), fill / text tools are skipped, several files + .zip at once, decoration
// brushes keep all their shapes (and colour shapes their colours), they draw without errors, and they are still there
// after a restart.
const H = require('./harness.cjs');
const fs = require('fs'), path = require('path');
(async () => {
  const root = process.argv[2], out = process.argv[3], dir = path.join(out, 'sut');
  require('child_process').execSync(`python3 -I ${JSON.stringify(path.join(__dirname, 'mksut.py'))} ${JSON.stringify(out)}`);
  const { pg, ctx, errors, done } = await H.open(root, 8824, { width: 1400, height: 900 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const where = () => pg.evaluate(() => { const SF = window.__sketchforge, o = {}; for (const g of SF.GROUPS) for (const id of g.subs || []) { const t = SF.TOOLDEF[id]; if (t && t.custom) o[t.name] = g.id; } return o; });
  const files = ['ink_pen.sut', 'stars_deco.sut', 'sunset_gradient.sut', 'soft_blur.sut', 'hard_eraser.sut', 'spray.sut', 'watercolor.sut', 'fill.sut', 'set_two.sut'];
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.evaluate(() => window.__sketchforge.CMD.addSut())]);
  await fc.setFiles(files.map(f => path.join(dir, f))); await pg.waitForTimeout(2500);
  const toastTxt = await pg.textContent('#toast');
  console.log('     ' + toastTxt);
  const w = await where();
  console.log('     ' + JSON.stringify(w));
  const expect = { 'Inking pen': 'pen', 'Sparkle stars': 'decor', 'Sunset gradation': 'gradient', 'Soft blur': 'blend', 'Hard eraser': 'eraser', 'Fine spray': 'airbrush', 'Wet watercolor': 'brush', 'Pencil 2B': 'pencil', 'Flower lace': 'decor' };
  for (const [n, g] of Object.entries(expect)) check(`"${n}" goes to ${g}`, w[n] === g);
  check('the fill tool is skipped (not a drawing tool)', !('Refer other layers' in w) && /skipped/.test(toastTxt));
  check('the message says where everything went', /Imported 9 tools/.test(toastTxt) && /Decoration/.test(toastTxt) && /Gradient/.test(toastTxt));
  // decoration brush details
  const deco = await pg.evaluate(() => { const SF = window.__sketchforge, id = Object.keys(SF.TOOLDEF).find(k => SF.TOOLDEF[k].name === 'Sparkle stars'), p = SF.TOOLDEF[id].preset; return { id, tips: (p.tipIds || []).length, scatter: p.scatter, count: p.count, rot: p.tipRot, hue: p.hueJit }; });
  check(`decoration keeps its ${deco.tips} shapes, scatter, rotation and colour jitter`, deco.tips === 3 && deco.scatter > 1 && deco.count > 1 && deco.rot && deco.hue > 0);
  check('the eraser erases, the blur blends, the watercolour has wet edges', await pg.evaluate(() => { const SF = window.__sketchforge, t = n => SF.TOOLDEF[Object.keys(SF.TOOLDEF).find(k => SF.TOOLDEF[k].name === n)];
    return t('Hard eraser').erase === true && t('Soft blur').preset.blurTool === true && t('Wet watercolor').preset.wet > 0; }));
  check('the gradient is a gradient preset', await pg.evaluate(() => { const SF = window.__sketchforge, t = SF.TOOLDEF[Object.keys(SF.TOOLDEF).find(k => SF.TOOLDEF[k].name === 'Sunset gradation')]; return t.kind === 'gradient' && t.stops.length >= 2; }));
  // draw with the decoration brush
  await pg.evaluate(() => { const SF = window.__sketchforge; SF.newDocument(800, 600, 1, 12, false, 'Deco'); });
  await pg.evaluate(id => window.__sketchforge.selectTool(id), deco.id); await pg.waitForTimeout(150);
  await pg.strokeDoc([[150, 300], [300, 260], [450, 330], [650, 280]]); await pg.waitForTimeout(300);
  const ink = await pg.evaluate(() => { const l = window.__sketchforge.activeLayer(), c = [...l.cels.values()][0], d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0, mag = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 100) { n++; if (d[i] > 150 && d[i + 2] > 100 && d[i + 1] < 120) mag++; } return { n, mag }; });
  console.log('     decoration stroke: ink pixels', ink.n, '| magenta (colour shape) pixels', ink.mag);
  check('the decoration brush draws its shapes', ink.n > 1500);
  check('its colour shape keeps its own colour', ink.mag > 50);
  await pg.screenshot({ path: out + '/sut_deco.png' });
  // gradient tool works
  const gid = await pg.evaluate(() => { const SF = window.__sketchforge; return Object.keys(SF.TOOLDEF).find(k => SF.TOOLDEF[k].name === 'Sunset gradation'); });
  await pg.evaluate(() => window.__sketchforge.CMD.layerAdd());
  await pg.evaluate(id => window.__sketchforge.selectTool(id), gid);
  await pg.strokeDoc([[100, 100], [700, 500]]); await pg.waitForTimeout(200);
  check('the imported gradient draws', (await pg.inkAt(400, 300)) > 200);
  // a zip of tools
  const before = Object.keys(await where()).length;
  const [fc2] = await Promise.all([pg.waitForEvent('filechooser'), pg.evaluate(() => window.__sketchforge.CMD.addSut())]);
  await fc2.setFiles(path.join(dir, 'pack.zip')); await pg.waitForTimeout(2000);
  check('a .zip of tools imports them all (4 tools)', /Imported 4 tools/.test(await pg.textContent('#toast')));
  // still there after a restart (saved in IndexedDB)
  await pg.reload(); await pg.waitForTimeout(3000);
  const w2 = await where();
  check('after a restart the tools are still in their groups', w2['Sparkle stars'] === 'decor' && w2['Sunset gradation'] === 'gradient' && w2['Hard eraser'] === 'eraser' && Object.keys(w2).length >= before);
  check('…with all the decoration shapes', await pg.evaluate(() => { const SF = window.__sketchforge, id = Object.keys(SF.TOOLDEF).find(k => SF.TOOLDEF[k].name === 'Sparkle stars'); return (SF.TOOLDEF[id].preset.tipIds || []).length === 3; }));
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
