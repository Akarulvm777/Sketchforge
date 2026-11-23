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
  // real Clip Studio structures: gradient stops, material tips / textures
  const [fc3] = await Promise.all([pg.waitForEvent('filechooser'), pg.evaluate(() => window.__sketchforge.CMD.addSut())]);
  await fc3.setFiles([path.join(dir, 'real_gradient.sut'), path.join(dir, 'material_pen.sut')]); await pg.waitForTimeout(2500);
  const real = await pg.evaluate(() => { const SF = window.__sketchforge, t = n => SF.TOOLDEF[Object.keys(SF.TOOLDEF).filter(k => SF.TOOLDEF[k].name === n).pop()], g = t('Venice sky'), h = t('4カケペンm'), d = t('ハートと光');
    const grp = n => (SF.GROUPS.find(G => (G.subs || []).includes(Object.keys(SF.TOOLDEF).filter(k => SF.TOOLDEF[k].name === n).pop())) || {}).id;
    return { stops: g && g.stops, hatchGroup: grp('4カケペンm'), heartGroup: grp('ハートと光'), hatchTip: !!(h && h.preset.tipId), hatchTex: h && h.preset.tex, texScale: h && h.preset.texScale, hue: h && h.preset.hueJit, heartTip: !!(d && d.preset.tipId), heartId: Object.keys(SF.TOOLDEF).filter(k => SF.TOOLDEF[k].name === 'ハートと光').pop() }; });
  console.log('     ' + JSON.stringify({ ...real, heartId: undefined }));
  check('a real gradient keeps its own colours', real.stops && real.stops.length === 4 && real.stops[0][1] === '#3d0625' && Math.abs(real.stops[1][0] - 0.306) < 0.01 && real.stops[3][1] === '#f9e5b0');
  check('hatching pens go to Shading pens, the hearts brush to Decoration', real.hatchGroup === 'shade' && real.heartGroup === 'decor');
  check('tip and texture are read from the materials inside the file', real.hatchTip && /^tex_/.test(real.hatchTex || '') && real.heartTip);
  check('the texture keeps its size (300 px thumbnail when the full picture is not readable)', Math.abs(real.texScale - 300 / 256) < 0.02);
  check('colour change stays off when the tool has it switched off', !real.hue);
  // the heart material: white heart = no ink (dark = ink), so the middle of the stamp stays empty
  await pg.evaluate(() => window.__sketchforge.newDocument(400, 400, 1, 12, false, 'Heart'));
  await pg.evaluate(id => { const SF = window.__sketchforge; SF.selectTool(id); SF.settings[id].size = 240; }, real.heartId);
  const [hx, hy] = await pg.d2c(200, 200); await pg.mouse.click(hx, hy); await pg.waitForTimeout(200);
  const heart = await pg.evaluate(() => { const c = [...window.__sketchforge.activeLayer().cels.values()][0], g = c.getContext('2d'), a = (x, y, r) => { const d = g.getImageData(x - r, y - r, 2 * r, 2 * r).data; let s = 0; for (let i = 3; i < d.length; i += 4) s += d[i]; return s / (d.length / 4); }; return { heart: a(200, 196, 12), dots: a(130, 300, 14) }; });
  console.log('     stamp ink: inside the heart', heart.heart.toFixed(1), '| dots', heart.dots.toFixed(1));
  check('dark = ink, white = no ink: the heart is a hole in the dots', heart.dots > 15 && heart.heart < heart.dots * 0.3);

  // real settings: colour mixing picks up the canvas colour, a tool's own blending mode, pressure curve + minimum, thin start, report
  const [fc4] = await Promise.all([pg.waitForEvent('filechooser'), pg.evaluate(() => window.__sketchforge.CMD.addSut())]);
  await fc4.setFiles(path.join(dir, 'real_settings.sut')); await pg.waitForTimeout(2000);
  const rs = await pg.evaluate(() => { const SF = window.__sketchforge, id = n => Object.keys(SF.TOOLDEF).filter(k => SF.TOOLDEF[k].name === n).pop(), b = id('Thick paint'), m = id('Multiply liner');
    const pb = SF.TOOLDEF[b].preset, pm = SF.TOOLDEF[m].preset; return { b, m, paint: pb.paint, dens: pb.paintDensity, pMinB: pb.pMin, blend: pm.blendOp, pMin: pm.pMin, curve: pm.pCurve, taper: pm.taperIn, taperR: pm.taperRatio, taperB: pb.taperIn,
      rep: SF.TOOLDEF[m].report, grpB: SF.groupOf(b).id, grpM: SF.groupOf(m).id }; });
  console.log('     ' + JSON.stringify({ ...rs, rep: rs.rep.length }));
  check('colour mixing is read (amount of paint 35%, density 40%)', Math.abs(rs.paint - 0.35) < 0.01 && Math.abs(rs.dens - 0.4) < 0.01);
  check('pressure: the real minimum and curve are read', Math.abs(rs.pMin - 0.35) < 0.01 && rs.curve && rs.curve.length === 3 && Math.abs(rs.curve[1][0] - 0.78) < 0.01 && Math.abs(rs.pMinB - 0.31) < 0.01);
  check('the tool\'s blending mode (multiply) is kept', rs.blend === 'multiply');
  check('thin start only when the tool switches it on for size', rs.taper === 12 && rs.taperR === 0 && !rs.taperB);
  check('the report lists what was translated and what Sketchforge does not do yet', rs.rep.some(r => r[0] === 'ok' && /Multiply/.test(r[1])) && rs.rep.some(r => r[0] === 'no' && /Ink stickiness/.test(r[1])));
  check('generic name + colour mixing → Brush, liner → Pen', rs.grpB === 'brush' && rs.grpM === 'pen');
  check('settings Sketchforge does not use yet are remembered', await pg.evaluate(() => (JSON.parse(localStorage.getItem('sketchforge.sutlearn.v1') || '{}').Stickness || 0) >= 1));
  // the mixing brush picks up a yellow area and mixes it with blue
  await pg.evaluate(() => { const SF = window.__sketchforge; SF.newDocument(400, 300, 1, 12, false, 'Mix'); SF.selectTool('pen'); SF.setColor('#f0c020'); SF.settings.pen.size = 120; });
  await pg.strokeDoc([[60, 150], [200, 150]]); await pg.waitForTimeout(200);
  await pg.evaluate(id => { const SF = window.__sketchforge; SF.selectTool(id); SF.setColor('#1030e0'); }, rs.b);
  await pg.strokeDoc([[100, 150], [180, 150], [260, 150], [340, 150]]); await pg.waitForTimeout(300);
  const mix = await pg.evaluate(() => { const c = [...window.__sketchforge.activeLayer().cels.values()][0], g = c.getContext('2d'), px = (x, y) => [...g.getImageData(x, y, 1, 1).data]; return { onYellow: px(175, 150), onEmpty: px(330, 150) }; });
  console.log('     mixing brush: over yellow', mix.onYellow.join(','), '| over nothing', mix.onEmpty.join(','));
  check('over the yellow the brush mixes (yellow picked up, some blue added)', mix.onYellow[3] > 200 && mix.onYellow[0] > 80 && mix.onYellow[2] > 40 && mix.onYellow[2] < 200);
  check('over nothing it carries the picked-up yellow and paints a light blue', mix.onEmpty[3] > 10);
  // thin end: the last 60 px of a stroke get thinner and thinner (the tail waits until the pen lifts)
  await pg.evaluate(id => { const SF = window.__sketchforge; SF.newDocument(500, 200, 1, 12, false, 'Taper'); SF.selectTool(id); SF.setColor('#000000'); }, rs.m);
  const tp = []; for (let x = 40; x <= 460; x += 20) tp.push([x, 100]);
  await pg.strokeDoc(tp); await pg.waitForTimeout(250);
  const th = await pg.evaluate(() => { const c = [...window.__sketchforge.activeLayer().cels.values()][0], g = c.getContext('2d'), col = x => { const d = g.getImageData(x, 0, 1, 200).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 100) n++; return n; }; return { mid: col(250), end: col(452), at: col(459) }; });
  console.log('     liner thickness: middle', th.mid, '| 8 px before the end', th.end, '| last px', th.at);
  check('thin end: the stroke gets thinner over its last part', th.mid >= 6 && th.end < th.mid * 0.5 && th.end >= 1);
  check('the report says thin end and at least 1 px', await pg.evaluate(id => { const r = window.__sketchforge.TOOLDEF[id].report; return r.some(x => /Thin end/.test(x[1])) && r.some(x => /At least 1 px/.test(x[1])); }, rs.m));
  // ⓘ: the translator report dialog
  await pg.evaluate(id => window.__sketchforge.selectTool(id), rs.m);
  await pg.click('#subtoolBar button[data-ic=info]'); await pg.waitForTimeout(200);
  check('ⓘ under Sub Tool opens the tool report', await pg.evaluate(() => { const d = document.querySelector('dialog.toolreport'); const ok = d && d.open && d.querySelectorAll('.trep li').length >= 4 && /Multiply/.test(d.textContent); if (d) d.close(); return !!ok; }));

  // a zip of tools
  const before = Object.keys(await where()).length;
  const [fc2] = await Promise.all([pg.waitForEvent('filechooser'), pg.evaluate(() => window.__sketchforge.CMD.addSut())]);
  await fc2.setFiles(path.join(dir, 'pack.zip')); await pg.waitForTimeout(2000);
  check('a .zip of tools imports them all (4 tools)', /Imported 4 tools/.test(await pg.textContent('#toast')));
  // the import window: one row per tool, each at 100 % with its group and a preview
  const iw = await pg.evaluate(() => { const d = document.querySelector('#importWin'); if (!d) return null; return { shown: !d.hidden, done: d.classList.contains('done'), all: d.querySelector('.impw-all').textContent,
    rows: [...d.querySelectorAll('.impw-tool')].map(r => [r.querySelector('b').textContent, r.querySelector('.impw-pct').textContent, r.querySelector('.impw-grp').textContent, !!r.querySelector('.impw-prev canvas')]) }; });
  console.log('     ' + JSON.stringify(iw));
  check('the import window shows each tool studied to 100 % with its group and preview', iw && iw.shown && iw.done && iw.all === '100%' && iw.rows.length === 4 && iw.rows.every(r => r[1] === '100%' && /→/.test(r[2]) && r[3]));
  await pg.screenshot({ path: out + '/sut_importwin.png' });
  await pg.click('#importWin .impw-x');
  check('Close hides the import window', await pg.evaluate(() => document.querySelector('#importWin').hidden));
  // still there after a restart (saved in IndexedDB)
  await pg.reload(); await pg.waitForTimeout(3000);
  const w2 = await where();
  check('after a restart the tools are still in their groups', w2['Sparkle stars'] === 'decor' && w2['Sunset gradation'] === 'gradient' && w2['Hard eraser'] === 'eraser' && Object.keys(w2).length >= before);
  check('…with all the decoration shapes', await pg.evaluate(() => { const SF = window.__sketchforge, id = Object.keys(SF.TOOLDEF).find(k => SF.TOOLDEF[k].name === 'Sparkle stars'); return (SF.TOOLDEF[id].preset.tipIds || []).length === 3; }));
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
