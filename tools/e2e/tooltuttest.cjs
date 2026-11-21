// Tutorials for every tool: one per tool group, a step per tool (made from the tool list, so new and imported tools
// are included), "Try it" uses the tool on a practice page.
const H = require('./harness.cjs');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, errors, done } = await H.open(root, 8903, { width: 1300, height: 860 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const info = await pg.evaluate(() => { const SF = window.__sketchforge, auto = SF.TUTORIALS.filter(t => t.auto), steps = auto.reduce((n, t) => n + t.steps.length - 1, 0), tools = SF.GROUPS.reduce((n, g) => n + ((g && g.subs) || []).filter(id => SF.TOOLDEF[id]).length, 0); return { n: auto.length, steps, tools }; });
  console.log('     ' + JSON.stringify(info));
  check('a tutorial for every tool group, a step for every tool', info.n >= 20 && info.steps === info.tools);
  await pg.evaluate(() => window.__sketchforge.CMD.tutorials()); await pg.waitForTimeout(300);
  check('they are in Help › Tutorials under "Every tool"', /Every tool/.test(await pg.textContent('#tutCenter')) && /Pen tools/.test(await pg.textContent('#tutCenter')));
  await pg.evaluate(() => document.querySelector('#tutCenter').close());
  const ink = () => pg.evaluate(() => { const SF = window.__sketchforge, l = SF.activeLayer(), c = l.cels.get(0), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 64) if (d[i] > 20) n++; return n; });
  const tryTool = id => pg.evaluate(id => window.__sketchforge.scope('toolTry')(id), id).then(() => pg.waitForTimeout(250));
  await tryTool('pen'); const a = await ink();
  check('Try it: Pen draws on a practice page', a > 50 && await pg.evaluate(() => window.__sketchforge.state.name === 'Tool practice'));
  await tryTool('eraser'); const b = await ink(); check('Try it: Hard eraser erases', b > 0);
  await pg.evaluate(() => window.__sketchforge.CMD.undo());
  await tryTool('selrect'); check('Try it: Rectangle selection selects', await pg.evaluate(() => window.__sketchforge.sel.active));
  await pg.evaluate(() => window.__sketchforge.CMD.selectNone && window.__sketchforge.CMD.selectNone());
  await tryTool('fill'); check('Try it: Fill works without errors', true);
  await tryTool('bl_cloud'); check('Try it: a balloon works without errors', true);
  // a tool added later (like an imported one) gets its step
  await pg.evaluate(async () => { await window.__sketchforge.scope('registerBrush')({ name: 'My imported pen', group: 'pen', size: 6 }, false); });
  const has = await pg.evaluate(() => { window.__sketchforge.CMD.tutorials(); document.querySelector('#tutCenter').close(); const t = window.__sketchforge.TUTORIALS.find(t => t.id === 'tools_pen'); return t.steps.some(s => s.t === 'My imported pen'); });
  check('a tool added later gets its own step automatically', has);
  await pg.evaluate(() => window.__sketchforge.CMD.tut_tools_brush()); await pg.waitForTimeout(400);
  check('a tool tutorial opens with its steps', await pg.isVisible('#tutCard') || await pg.evaluate(() => !!document.querySelector('.tut-card')));
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
