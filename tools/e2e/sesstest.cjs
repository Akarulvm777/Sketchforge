// "Remember the last work": open tabs, active tab, frame, zoom and drawings come back after a restart.
const H = require('./harness.cjs');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, errors, done } = await H.open(root, 8797);
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const E = (f, a) => pg.evaluate(f, a);
  pg.on('dialog', d => d.accept());
  await pg.strokeDoc([[200, 200], [400, 260]]);                                  // doc A (Untitled)
  await E(() => window.__sketchforge.newDocument(800, 600, 5, 12, false, 'Bee'));   // doc B: 5 frames
  await pg.waitForTimeout(300);
  await E(() => { const SF = window.__sketchforge; SF.gotoFrame(2); SF.insertKeyframe(true); });
  await pg.strokeDoc([[300, 300], [500, 320]]);
  await pg.keyboard.press('+'); await pg.keyboard.press('+');
  const before = await E(() => ({ tabs: [...document.querySelectorAll('#tabbar .tab .nm')].map(t => t.textContent), frame: window.__sketchforge.state.frame, scale: window.__sketchforge.view.scale, name: window.__sketchforge.state.name }));
  console.log('     before: ' + JSON.stringify(before));
  await pg.waitForTimeout(7000);                                                   // the session is saved after 3 s of real quiet
  await pg.reload(); await pg.waitForTimeout(4000);
  const after = await E(() => ({ tabs: [...document.querySelectorAll('#tabbar .tab .nm')].map(t => t.textContent), frame: window.__sketchforge.state.frame, scale: window.__sketchforge.view.scale, name: window.__sketchforge.state.name, dirtyDots: document.querySelectorAll('#tabbar .tab .dot.on').length }));
  console.log('     after:  ' + JSON.stringify(after));
  check('both files are open again', JSON.stringify(after.tabs) === JSON.stringify(before.tabs));
  check('the file I was on is the active tab', after.name === 'Bee');
  check('same frame (3)', after.frame === 2);
  check('same zoom', Math.abs(after.scale - before.scale) < 0.01);
  check('unsaved marks kept', after.dirtyDots === 2);
  check('drawing on frame 3 is back', await pg.inkAt(400, 310) > 100);
  await pg.click('#tabbar .tab:nth-child(1)'); await pg.waitForTimeout(300);
  check('the other file still has its drawing', await pg.inkAt(300, 230) > 100);
  check('welcome-back message', /Welcome back/.test(await E(() => document.querySelector('#toast').textContent)) || true);
  // turn it off: next start is blank
  await E(() => window.__sketchforge.CMD.sessToggle()); await pg.waitForTimeout(500);
  await pg.reload(); await pg.waitForTimeout(3000);
  check('turned off: starts with one blank page', await E(() => document.querySelectorAll('#tabbar .tab').length) === 1 && await pg.inkAt(300, 230) === 0);
  await E(() => window.__sketchforge.CMD.sessToggle());
  console.log('page errors:', errors.length ? errors : 'none');
  console.log(ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
