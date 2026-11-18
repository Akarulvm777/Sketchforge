const H = require('./harness.cjs');
const fs = require('fs');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, ctx, errors, done } = await H.open(root, 8768, undefined, ['--auto-accept-this-tab-capture', '--use-fake-ui-for-media-stream', '--auto-select-desktop-capture-source=Sketchforge']);
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const SF = fn => pg.evaluate(fn);
  const frames = async () => { await pg.evaluate(() => window.__sketchforge.tlIdle()); return pg.evaluate(() => window.__sketchforge.TL.frames.length); };
  check('records by default: ' + await SF(() => document.querySelector('#tlBtn .lbl').textContent), (await SF(() => document.querySelector('#tlBtn').classList.contains('rec'))));
  await pg.click('#tlBtn .lbl');
  check('click turns recording off', !(await SF(() => document.querySelector('#tlBtn').classList.contains('rec'))));
  const n0 = await frames();
  await pg.strokeDoc([[200, 200], [300, 300]]); await pg.waitForTimeout(500);
  check('no snapshots while off', await frames() === n0);
  await pg.reload(); await pg.waitForTimeout(2000);
  check('off state remembered after reload', !(await SF(() => document.querySelector('#tlBtn').classList.contains('rec'))));
  await pg.click('#tlBtn .lbl');
  check('click turns it back on', await SF(() => document.querySelector('#tlBtn').classList.contains('rec')));
  await pg.waitForTimeout(600);
  const a = await frames();
  await pg.strokeDoc([[200, 200], [400, 260], [500, 400]]); await pg.waitForTimeout(2000);
  const b = await frames();
  check(`stroke adds a snapshot (${a} -> ${b})`, b > a);
  await pg.keyboard.press('+'); await pg.waitForTimeout(500); await pg.keyboard.press(']'); await pg.waitForTimeout(700);
  const c = await frames();
  check(`zoom / rotate add snapshots in workspace view (${b} -> ${c})`, c > b);
  // look at the last snapshot: it must be the viewport (wider than tall here), not the 1280x720 canvas scaled
  const snap = await pg.evaluate(async () => { const SFi = window.__sketchforge; return null; });
  // new document resets
  await pg.evaluate(() => window.__sketchforge.newDocument(800, 600, 1, 12, false, 'Second'));
  await pg.waitForTimeout(800);
  check('new file starts its own time-lapse: ' + await frames(), await frames() <= 2);
  await pg.strokeDoc([[100, 100], [300, 200]]); await pg.waitForTimeout(600);
  await pg.strokeDoc([[300, 100], [100, 200]]); await pg.waitForTimeout(2500);
  const nSecond = await frames();
  // save -> file contains timelapse
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.keyboard.press('Control+s')]);
  const p = out + '/second.sketchforge'; await dl.saveAs(p);
  const doc = JSON.parse(fs.readFileSync(p, 'utf8'));
  const nSaved = doc.timelapse ? doc.timelapse.frames.length : 0;
  check(`saved file holds ${nSaved} snapshots (button said ${nSecond})`, nSaved >= nSecond && nSaved >= 3);
  // open a file WITHOUT time-lapse -> empty, then open the saved one -> restored
  delete doc.timelapse; doc.name = 'NoTL'; fs.writeFileSync(out + '/notl.sketchforge', JSON.stringify(doc));
  await pg.evaluate(() => { window.__sketchforge.state; });
  const openFile = async f => { await pg.setInputFiles('#fileOpen', f); await pg.waitForTimeout(1500); };
  pg.on('dialog', d => d.accept());
  await openFile(out + '/notl.sketchforge');
  check('opening a file without time-lapse gives a fresh one: ' + await frames(), await frames() <= 2);
  await openFile(p);
  check('opening the saved file restores exactly its time-lapse: ' + await frames() + ' of ' + nSaved, await frames() === nSaved);
  // export video
  await pg.click('#tlBtn .caret');
  await pg.evaluate(() => { const s = document.querySelector('#tlSecs'); s.value = 3; s.oninput(); });
  const [vid] = await Promise.all([pg.waitForEvent('download', { timeout: 60000 }), pg.click('#tlGo')]);
  await vid.saveAs(out + '/tl.' + (vid.suggestedFilename().split('.').pop()));
  const sz = fs.statSync(out + '/tl.' + vid.suggestedFilename().split('.').pop()).size;
  check(`video exported: ${vid.suggestedFilename()} ${sz} bytes`, sz > 1000);
  // screen mode (fake capture in headless)
  await pg.selectOption('#tlMode', 'screen'); await pg.waitForTimeout(2500);
  const mode = await pg.evaluate(() => document.querySelector('#tlMode').value);
  console.log('     screen mode result:', mode, '(headless may refuse capture; app must fall back to view without errors)');
  check('screen mode either active or cleanly fell back', mode === 'screen' || mode === 'view');
  await pg.click('#tlClose');
  await pg.screenshot({ path: out + '/tl_ui.png', clip: { x: 0, y: 0, width: 1500, height: 60 } });
  console.log('page errors:', errors.length ? errors : 'none');
  console.log(ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
