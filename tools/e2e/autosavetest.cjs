// Auto-save: File › Save with the browser's "save to" window keeps the file; after a change, when nobody draws for a
// while and the auto-save minutes have passed, the same file is written again by itself (no download); without a
// file (Safari…) a copy goes to the app's own storage; on / off and minutes in the File menu.
const H = require('./harness.cjs');
(async () => {
  const root = process.argv[2];
  const { pg, errors, done } = await H.open(root, 8907, { width: 1300, height: 860 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  // a fake "save to" window: the handle keeps what is written
  await pg.evaluate(() => { localStorage.setItem('sketchforge.savepick.v1', 'on'); window.__writes = [];
    window.showSaveFilePicker = async o => ({ name: o.suggestedName, queryPermission: async () => 'granted', createWritable: async () => { let parts = []; return { write: async b => parts.push(b), close: async () => window.__writes.push(await new Blob(parts).text()) }; } });
    const SF = window.__sketchforge; SF.newDocument(300, 200, 1, 12, false, 'Auto'); SF.CMD.layerAdd(); });
  check('File menu: auto-save on / off and settings', await pg.evaluate(() => { const F = window.__sketchforge.MENUS[0][1].map(x => x[1]); return F.includes('autoSave') && F.includes('autoSaveMin'); }));
  await pg.evaluate(() => window.__sketchforge.CMD.save()); await pg.waitForTimeout(500);
  check('Save asks where once and writes the file', await pg.evaluate(() => window.__writes.length === 1 && JSON.parse(window.__writes[0]).format === 'sketchforge' && !!window.__sketchforge.scope('DOCS.cur.handle')));
  await pg.strokeDoc([[40, 40], [200, 120]]); await pg.waitForTimeout(200);
  check('a stroke makes the file unsaved', await pg.evaluate(() => window.__sketchforge.scope('dirty')));
  // not yet: the minutes have not passed
  await pg.evaluate(() => window.__sketchforge.scope('autoSaveTick()')); await pg.waitForTimeout(300);
  check('no auto-save before the minutes have passed', await pg.evaluate(() => window.__writes.length === 1));
  // the minutes have passed, but the user is still drawing (input a moment ago): wait
  await pg.evaluate(() => { const S = window.__sketchforge.scope; S('AUTO.last = Date.now() - 6 * 60000'); S('lastInputAt = performance.now()'); S('autoSaveTick()'); }); await pg.waitForTimeout(300);
  check('no auto-save while you are drawing', await pg.evaluate(() => window.__writes.length === 1));
  // quiet for a while → saved in place
  await pg.evaluate(() => { const S = window.__sketchforge.scope; S('AUTO.last = Date.now() - 6 * 60000'); S('lastInputAt = performance.now() - 10000'); S('autoSaveTick()'); }); await pg.waitForTimeout(1500);
  check('after 5 minutes, when you rest, the same file is saved by itself', await pg.evaluate(() => window.__writes.length === 2 && !window.__sketchforge.scope('dirty')));
  check('the status bar says when', await pg.evaluate(() => /Auto-saved/.test((document.querySelector('#autoSaveStat') || {}).textContent || '')));
  // no file (no "save to" window): a copy in the app's own storage
  await pg.evaluate(() => { const S = window.__sketchforge.scope; S('DOCS.cur.handle = null'); window.showSaveFilePicker = undefined; S('dirty = true'); S('AUTO.last = Date.now() - 6 * 60000'); S('lastInputAt = performance.now() - 10000'); S('autoSaveTick()'); }); await pg.waitForTimeout(2500);
  check('without a file: saved in the app (reopen my last work)', await pg.evaluate(() => /in the app/.test(document.querySelector('#autoSaveStat').textContent)));
  check('off: nothing is saved', await pg.evaluate(() => { const S = window.__sketchforge.scope; S('AUTO.on = false'); S('dirty = true'); S('AUTO.last = Date.now() - 6 * 60000'); S('lastInputAt = performance.now() - 10000'); return !S('autoSaveDue({ on: AUTO.on, dirty, busy: false, quiet: true, now: Date.now(), last: AUTO.last, min: AUTO.min })'); }));
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done(); process.exit(ok.every(Boolean) && !errors.length ? 0 : 1);
})();
