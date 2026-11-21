// File › New manga page…: page size, panel layout on a Panels layer, print guides (draft), colour / tone / ink / text layers.
const H = require('./harness.cjs');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, errors, done } = await H.open(root, 8904, { width: 1300, height: 860 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  check('File › New manga page… is in the menu', await pg.evaluate(() => window.__sketchforge.MENUS.find(m => m[0] === 'File')[1].some(x => Array.isArray(x) && x[1] === 'newManga')));
  for (const [size, layout, wh, minInk] of [['phone', 'classic', [1200, 1800], 3000], ['a4', 'grid6', [2480, 3508], 5000], ['square', 'none', [2000, 2000], 0]]) {
    await pg.evaluate(() => window.__sketchforge.CMD.newManga()); await pg.waitForTimeout(200);
    await pg.selectOption('dialog.csdlg [data-k=size]', size); await pg.selectOption('dialog.csdlg [data-k=layout]', layout);
    await pg.click('dialog.csdlg button[value=ok]'); await pg.waitForTimeout(500);
    const r = await pg.evaluate(() => { const SF = window.__sketchforge, S = SF.state, p = S.layers.find(l => l.name === 'Panels'); let ink = 0; if (p) { const d = p.cels.get(0).getContext('2d').getImageData(0, 0, S.w, S.h).data; for (let i = 3; i < d.length; i += 40) if (d[i] > 100) ink++; } return { wh: [S.w, S.h], names: S.layers.map(l => l.name), guides: S.layers.some(l => l.name === 'Guides' && l.draft), active: SF.activeLayer().name, ink }; });
    console.log('     ' + JSON.stringify(r));
    check(`${size} / ${layout}: right size, layers, guides, Ink selected`, r.wh.join() === wh.join() && ['Colour', 'Tone', 'Ink', 'Text & balloons'].every(n => r.names.includes(n)) && r.guides && r.active === 'Ink');
    check(`${size} / ${layout}: panels drawn` + (minInk ? '' : ' (none asked)'), minInk ? r.ink > minInk : !r.names.includes('Panels'));
  }
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
