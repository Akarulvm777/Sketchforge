// Two-colour brushes: main colour inside, sub colour outside (Outline marker) and a sub-colour glow (Neon glow pen);
// the glow is not cut by the stroke area; Tool Property shows Two colours for any round brush.
const H = require('./harness.cjs');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, errors, done } = await H.open(root, 8900, { width: 1300, height: 860 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  await pg.evaluate(() => { const SF = window.__sketchforge; SF.newDocument(600, 400, 1, 12, false, 'T'); SF.CMD.layerAdd(); SF.setColor('#ff0000'); SF.state.color2 = '#0040ff'; });
  const probe = y => pg.evaluate(y => { const g = window.__sketchforge.activeLayer().cels.get(0).getContext('2d'); const rows = []; for (let yy = y - 44; yy <= y + 44; yy += 2) rows.push([...g.getImageData(300, yy, 1, 1).data]);
    return { red: rows.filter(p => p[3] > 200 && p[0] > 180 && p[2] < 80).length, blue: rows.filter(p => p[3] > 40 && p[2] > 150 && p[0] < 120).length, outerBlue: rows.slice(0, 6).concat(rows.slice(-6)).some(p => p[3] > 10 && p[2] > p[0]) }; }, y);
  for (const [tool, y, label] of [['outlinemarker', 120, 'Outline marker: red inside, blue outline'], ['neonpen', 270, 'Neon glow pen: red core, blue glow']]) {
    await pg.evaluate(t => { window.__sketchforge.selectTool(t); window.__sketchforge.settings[t].size = 40; }, tool);
    await pg.strokeDoc([[80, y], [200, y + 20], [340, y - 10], [520, y]]); await pg.waitForTimeout(200);
    const r = await probe(y); console.log('     ' + JSON.stringify(r));
    check(label, r.red >= 4 && r.blue >= 3);
    if (tool === 'neonpen') check('the glow reaches past the dab (not cut by the stroke area)', r.outerBlue || r.blue >= 8);
  }
  check('Tool Property: Two colours for a round brush', await pg.evaluate(() => { window.__sketchforge.selectTool('pen'); return /Two colours/i.test(document.querySelector('#propBody').textContent); }));
  await pg.screenshot({ path: out + '/twotone.png' });
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
