// Help › Speed check (p10zbk): records real strokes per tool and shows a table + device details.
const H = require('./harness.cjs');
const path = require('path');
(async () => {
  const root = process.argv[2], out = process.argv[3] || '/tmp';
  const { pg, errors, done } = await H.open(root, 8929, { width: 1300, height: 900 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const S = src => pg.evaluate(s => window.__sketchforge.scope(s), src);
  await S("(() => { newDocument(1200, 800, 1, 12, false, 'Speed'); CMD.layerAdd(); CMD.speedCheck(); })()");
  check('badge shows', await pg.isVisible('#speedBadge'));
  for (const t of ['pen', 'brush', 'textured']) {
    await S(`selectTool('${t}')`);
    for (let k = 0; k < 2; k++) { await pg.strokeDoc([[200, 200 + k * 80], [400, 230 + k * 80], [700, 260 + k * 80], [900, 240 + k * 80]]); await pg.waitForTimeout(80); }
  }
  const sum = await S("[...SPEED.rows].map(([t, r]) => [t, speedSummary(r)])");
  console.log('     ' + JSON.stringify(sum));
  check('3 tools, 2 strokes each, dabs and moves counted', sum.length === 3 && sum.every(([, s]) => s.strokes === 2 && s.dabMs > 0 && s.moveMs > 0 && s.dabsPerMove > 0));
  await pg.click('#speedBadge [data-a=show]');
  const txt = await pg.evaluate(() => document.querySelector('#speedDlg').textContent);
  check('results table with tools and device details', /G-pen/.test(txt) && /Textured pen/.test(txt) && /page 1200×800/.test(txt) && /Screen FPS/.test(txt));
  await pg.screenshot({ path: path.join(out, 'speedcheck.png') });
  await pg.click('#speedDlg [data-a=close]'); await pg.click('#speedBadge [data-a=stop]');
  await S("selectTool('pen')"); await pg.strokeDoc([[200, 600], [600, 620]]);
  check('off: nothing more is recorded', (await S("SPEED.rows.get('pen').strokes")) === 2 && !(await pg.isVisible('#speedBadge')));
  check('unit: speedSummary', await S("(() => { const s = speedSummary({ strokes: 2, dabs: 100, dabMs: 10, moves: 20, moveMs: 40, moveMax: 9, frames: [16, 16, 100], upMs: 60 }); return s.dabMs === 0.1 && s.dabsPerMove === 5 && s.moveMs === 2 && s.fps === 63 && s.slowFrames === 1 && s.upMs === 30; })()"));
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
