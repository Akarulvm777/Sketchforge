// Colour sets (several named sets, add / remove / switch, kept after a restart) and colour history; paper texture on a new
// file (+ brushes pick up the grain, Layer › Paper colour & texture…); the brush editor (create a brush with any settings,
// live preview, save, draw with it, edit it into another group, kept after a restart, .sfbrush file).
const H = require('./harness.cjs');
const path = require('path'), fs = require('fs');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, errors, done } = await H.open(root, 8833, { width: 1400, height: 900 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const answers = []; pg.on('dialog', d => d.accept(answers.shift() ?? ''));
  // ---- colour sets ----
  check('the Color panel has a colour set picker, ＋ and ⋯', !!(await pg.$('#csSel')) && !!(await pg.$('#csAdd')) && !!(await pg.$('#csMenu')));
  check('the first set is "Basic" with 14 colours', /Basic \(14\)/.test(await pg.textContent('#csSel')) && (await pg.$$('#swatches .swatch')).length === 14);
  await pg.click('#csMenu'); answers.push('Skin tones');
  await pg.click('.lpop button:has-text("New colour set")'); await pg.waitForTimeout(150);
  check('⋯ › New colour set makes an empty named set', /Skin tones \(0\)/.test(await pg.textContent('#csSel')) && (await pg.$$('#swatches .swatch')).length === 0);
  for (const c of ['#f2c9a8', '#d99a6c', '#8a5a3c']) { await pg.evaluate(c => window.__sketchforge.setColor(c), c); await pg.click('#csAdd'); await pg.waitForTimeout(60); }
  check('＋ adds the main colour (3 colours)', (await pg.$$('#swatches .swatch')).length === 3);
  await pg.click('#swatches .swatch >> nth=1', { button: 'right' }); await pg.waitForTimeout(80);
  await pg.click('.lpop button:has-text("Remove from")'); await pg.waitForTimeout(80);
  check('right-click › Remove takes a colour out', (await pg.$$('#swatches .swatch')).length === 2);
  await pg.click('#swatches .swatch >> nth=0'); await pg.waitForTimeout(50);
  check('tapping a colour of the set uses it', (await pg.evaluate(() => window.__sketchforge.state.color)) === '#f2c9a8');
  await pg.selectOption('#csSel', '0'); await pg.waitForTimeout(80);
  check('switching back to Basic shows its colours', (await pg.$$('#swatches .swatch')).length === 14);
  // history: colours you painted with
  await pg.evaluate(() => { const SF = window.__sketchforge; SF.newDocument(400, 300, 1, 12, false, 'Hist'); SF.selectTool('pen'); SF.setColor('#123456'); });
  await pg.strokeDoc([[50, 50], [150, 80]]); await pg.evaluate(() => window.__sketchforge.setColor('#a1b2c3'));
  await pg.strokeDoc([[50, 150], [150, 180]]); await pg.waitForTimeout(150);
  const hist = await pg.evaluate(() => [...document.querySelectorAll('#recent .swatch')].map(b => b.title));
  check('History shows the colours you painted with, newest first', hist[0] === '#a1b2c3' && hist[1] === '#123456');
  // ---- paper texture on a new file ----
  await pg.evaluate(() => window.__sketchforge.CMD.newDoc()); await pg.waitForTimeout(200);
  check('the New dialog has paper texture, grain strength, "brushes pick up the grain"', !!(await pg.$('#newTex')) && !!(await pg.$('#newAmt')) && !!(await pg.$('#newGrain')));
  await pg.selectOption('#newPreset', { index: 6 }).catch(() => {});
  await pg.fill('#newW', '600'); await pg.fill('#newH', '400'); await pg.selectOption('#newUnit', 'px');
  await pg.selectOption('#newTex', 'grain'); await pg.fill('#newAmt', '0.9').catch(() => pg.evaluate(() => { document.querySelector('#newAmt').value = '0.9'; }));
  await pg.evaluate(() => { document.querySelector('#newPaper').value = '#fbf6ea'; });
  await pg.click('#newCreate'); await pg.waitForTimeout(500);
  const paper = await pg.evaluate(() => { const L = window.__sketchforge.state.layers.find(l => l.paper), c = L.cels.get(0), d = c.getContext('2d').getImageData(100, 100, 60, 60).data; let mn = 255, mx = 0, s = 0;
    for (let i = 0; i < d.length; i += 4) { mn = Math.min(mn, d[i]); mx = Math.max(mx, d[i]); s += d[i]; } return { mn, mx, avg: s / (d.length / 4), tex: L.paperTex }; });
  console.log('     paper red channel min / max / avg', paper.mn, paper.mx, paper.avg.toFixed(1), JSON.stringify(paper.tex));
  check('the paper layer has its colour and a visible grain', paper.mx > 230 && paper.mx - paper.mn > 15 && paper.tex && paper.tex.id === 'grain');
  await pg.evaluate(() => { const SF = window.__sketchforge; SF.selectTool('pen'); SF.setColor('#000000'); SF.settings.pen.size = 40; });
  await pg.strokeDoc([[100, 200], [500, 200]]); await pg.waitForTimeout(250);
  const grain = await pg.evaluate(() => { const c = [...window.__sketchforge.activeLayer().cels.values()][0], d = c.getContext('2d').getImageData(200, 190, 200, 20).data; let mn = 255, mx = 0; for (let i = 3; i < d.length; i += 4) { mn = Math.min(mn, d[i]); mx = Math.max(mx, d[i]); } return { mn, mx }; });
  console.log('     pen stroke alpha min / max on grainy paper', grain.mn, grain.mx);
  check('brushes pick up the paper grain (the solid pen shows texture)', grain.mx > 200 && grain.mn < grain.mx - 40);
  // save + open keeps the paper setting
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.evaluate(() => window.__sketchforge.CMD.save())]);
  const f = path.join(out, 'paper.sketchforge'); await dl.saveAs(f);
  await pg.evaluate(() => window.__sketchforge.newDocument(200, 200, 1, 12, false, 'Other'));
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.evaluate(() => window.__sketchforge.CMD.open())]);
  await fc.setFiles(f); await pg.waitForTimeout(1200);
  check('saved and opened: the paper keeps its texture setting', await pg.evaluate(() => { const L = window.__sketchforge.state.layers.find(l => l.paper); return !!(L && L.paperTex && L.paperTex.id === 'grain' && L.paperTex.grain); }));
  // change it later
  await pg.evaluate(() => window.__sketchforge.CMD.paperTexture()); await pg.waitForTimeout(150);
  await pg.selectOption('.paperdlg #ppTex', 'canvas'); await pg.evaluate(() => { document.querySelector('#ppColor').value = '#d9c3a0'; });
  await pg.click('.paperdlg button[value=ok]'); await pg.waitForTimeout(300);
  check('Layer › Paper colour & texture… repaints the paper (kraft, canvas)', await pg.evaluate(() => { const L = window.__sketchforge.state.layers.find(l => l.paper), p = L.cels.get(0).getContext('2d').getImageData(10, 10, 1, 1).data; return L.paperTex.id === 'canvas' && p[0] > 150 && p[2] < p[0] - 20; }));
  // ---- brush editor ----
  await pg.evaluate(() => { const SF = window.__sketchforge; SF.newDocument(700, 400, 1, 12, false, 'Brushes'); });
  check('Sub Tool has the brush editor button, Tool Property "All brush settings…"', !!(await pg.$('#subtoolBar button[data-ic=sliders]')) && !!(await pg.$('#propBody .beopen')));
  await pg.evaluate(() => window.__sketchforge.CMD.brushNew()); await pg.waitForTimeout(400);
  check('Create a brush opens the editor with every section', await pg.evaluate(() => { const d = document.querySelector('dialog.brushedit'); return d && d.open && ['Size & ink', 'Tip shape', 'Pen pressure', 'Start & end', 'Spray & scatter', 'Colour', 'Texture'].every(s => d.textContent.includes(s)); }));
  const prevInk = () => pg.evaluate(() => { const c = document.querySelector('.beprev'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++; return n; });
  const p0 = await prevInk();
  const setRange = (k, v) => pg.evaluate(([k, v]) => { const i = document.querySelector(`.brushedit .berow[data-k=${k}] input[type=range]`); i.value = v; i.dispatchEvent(new Event('input')); }, [k, v]);
  await pg.fill('.brushedit .berow[data-k=name] input', 'Test scatter brush');
  await setRange('size', 30); await setRange('scatter', 1.2); await setRange('count', 4); await setRange('hueJit', 0.3);
  await pg.evaluate(() => { const s = document.querySelector('.brushedit .berow[data-k=texSel] select'); s.value = 'rough'; s.dispatchEvent(new Event('change')); });
  await pg.waitForTimeout(200);
  const p1 = await prevInk();
  console.log('     preview ink pixels: default', p0, '| after changes', p1);
  check('the live preview draws and changes with the settings', p0 > 300 && p1 > 100 && p1 !== p0);
  await pg.click('.brushedit [data-a=save]'); await pg.waitForTimeout(500);
  const nb = await pg.evaluate(() => { const SF = window.__sketchforge, id = Object.keys(SF.TOOLDEF).find(k => SF.TOOLDEF[k].name === 'Test scatter brush'); const s = id && SF.settings[id]; return id && { id, grp: SF.groupOf(id).id, sel: SF.state.tool === id, scatter: s.scatter, count: s.count, hue: s.hueJit, tex: s.tex, size: s.size }; });
  console.log('     ' + JSON.stringify(nb));
  check('Create brush adds it to the current group (Pen) and selects it, with the chosen settings', nb && nb.grp === 'pen' && nb.sel && nb.scatter === 1.2 && nb.count === 4 && nb.hue === 0.3 && nb.tex === 'rough' && nb.size === 30);
  await pg.strokeDoc([[100, 200], [300, 150], [600, 220]]); await pg.waitForTimeout(250);
  check('the new brush draws', (await pg.evaluate(() => { const c = [...window.__sketchforge.activeLayer().cels.values()][0], d = c.getContext('2d').getImageData(0, 0, 700, 400).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 20) n++; return n; })) > 800);
  // edit it: into the Airbrush group, new name
  await pg.evaluate(() => window.__sketchforge.CMD.brushEdit()); await pg.waitForTimeout(400);
  check('editing an own brush opens it with its settings', await pg.evaluate(() => document.querySelector('.brushedit .berow[data-k=name] input').value === 'Test scatter brush' && document.querySelector('.brushedit .berow[data-k=scatter] output').textContent === '1.20×'));
  await pg.selectOption('.brushedit .berow[data-k=group] select', 'airbrush');
  await pg.click('.brushedit [data-a=save]'); await pg.waitForTimeout(500);
  check('Save moves it to the group you chose (no duplicate)', await pg.evaluate(id => { const SF = window.__sketchforge; return SF.groupOf(id).id === 'airbrush' && SF.GROUPS.filter(g => (g.subs || []).includes(id)).length === 1; }, nb.id));
  // a built-in tool is edited as a copy
  await pg.evaluate(() => window.__sketchforge.selectTool('pen')); await pg.evaluate(() => window.__sketchforge.CMD.brushEdit()); await pg.waitForTimeout(400);
  check('editing a built-in pen starts a copy "(mine)"', await pg.evaluate(() => /\(mine\)/.test(document.querySelector('.brushedit .berow[data-k=name] input').value)));
  await pg.click('.brushedit [data-a=cancel]'); await pg.waitForTimeout(100);
  // export .sfbrush and import it again
  await pg.evaluate(id => window.__sketchforge.selectTool(id), nb.id); await pg.evaluate(() => window.__sketchforge.CMD.brushEdit()); await pg.waitForTimeout(400);
  const [dl2] = await Promise.all([pg.waitForEvent('download'), pg.click('.brushedit [data-a=export]')]);
  const bf = path.join(out, 'brush.sfbrush'); await dl2.saveAs(bf); await pg.click('.brushedit [data-a=cancel]');
  const j = JSON.parse(fs.readFileSync(bf, 'utf8'));
  check('Export .sfbrush writes the brush settings', j.format === 'sketchforge-brush' && j.def.scatter === 1.2 && j.def.group === 'airbrush');
  const [fc2] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('#subtoolBar button[data-ic=plus]')]);
  await fc2.setFiles(bf); await pg.waitForTimeout(700);
  check('a .sfbrush file added with ＋ becomes a brush', await pg.evaluate(() => Object.values(window.__sketchforge.TOOLDEF).filter(t => t.name === 'Test scatter brush').length === 2));
  // an imported Clip Studio tool: ⓘ › Adjust opens it in the editor, with what Clip Studio does differently; saving keeps every translated setting
  require('child_process').execSync(`python3 -I ${JSON.stringify(path.join(__dirname, 'mksut.py'))} ${JSON.stringify(out)}`);
  const [fc3] = await Promise.all([pg.waitForEvent('filechooser'), pg.evaluate(() => window.__sketchforge.CMD.addSut())]);
  await fc3.setFiles(path.join(out, 'sut', 'real_settings.sut')); await pg.waitForTimeout(1500);
  const lid = await pg.evaluate(() => { const SF = window.__sketchforge, id = Object.keys(SF.TOOLDEF).find(k => SF.TOOLDEF[k].name === 'Multiply liner'); SF.selectTool(id); return id; });
  await pg.click('#subtoolBar button[data-ic=info]'); await pg.waitForTimeout(200);
  await pg.click('dialog.toolreport [data-a=tune]'); await pg.waitForTimeout(500);
  check('ⓘ › Adjust opens the imported tool in the brush editor with what Clip Studio does differently', await pg.evaluate(() => { const d = document.querySelector('dialog.brushedit'); return !!d && d.open && /Imported from Clip Studio/.test(d.textContent) && /Ink stickiness/.test(d.textContent) && document.querySelector('.brushedit .berow[data-k=name] input').value === 'Multiply liner'; }));
  await setRange('spacing', 0.05); await pg.click('.brushedit [data-a=save]'); await pg.waitForTimeout(500);
  const kept = await pg.evaluate(id => { const SF = window.__sketchforge, s = SF.settings[id], t = SF.TOOLDEF[id]; return { sp: s.spacing, blend: s.blendOp, out: s.taperOut, curve: !!s.pCurve, min1: s.min1, rep: (t.report || []).length, grp: SF.groupOf(id).id }; }, lid);
  console.log('     after tuning', JSON.stringify(kept));
  check('the tuned tool keeps its translated settings (blending mode, curve, thin end, report) and the new spacing', kept.sp === 0.05 && kept.blend === 'multiply' && kept.out === 60 && kept.curve && kept.min1 && kept.rep > 3 && kept.grp === 'pen');
  // restart: colour sets, history, brushes kept
  await pg.reload(); await pg.waitForTimeout(3000);
  const after = await pg.evaluate(() => ({ sets: document.querySelector('#csSel').textContent, hist: [...document.querySelectorAll('#recent .swatch')].slice(0, 2).map(b => b.title),
    brush: Object.keys(window.__sketchforge.TOOLDEF).filter(k => window.__sketchforge.TOOLDEF[k].name === 'Test scatter brush').map(k => window.__sketchforge.groupOf(k).id) }));
  console.log('     after restart', JSON.stringify(after));
  check('after a restart: colour sets, history and your brushes are still there', /Skin tones \(2\)/.test(after.sets) && after.hist[0] === '#000000' && after.hist[1] === '#a1b2c3' && after.brush.length === 2 && after.brush.every(g => g === 'airbrush'));
  await pg.screenshot({ path: out + '/studio.png' });
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
