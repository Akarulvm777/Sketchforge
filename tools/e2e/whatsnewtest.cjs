// After an update, a "What's new" popup lists this version's changes and fixes, once. Update card offers a download.
const H = require('./harness.cjs');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, errors, done } = await H.open(root, 8808);
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  check('first start: no What\'s new popup', !(await pg.isVisible('#whatsNew')));
  await pg.evaluate(() => localStorage.setItem('sketchforge.lastver', '2.4.1'));
  await pg.reload(); await pg.waitForTimeout(2500);
  check('after updating from 2.4.1: What\'s new popup', await pg.isVisible('#whatsNew'));
  const txt = await pg.textContent('#whatsNew');
  const notes = await pg.evaluate(() => APP_CHANGES), hasFix = notes.some(c => c.items.some(i => /^Fixed:/i.test(i)));
  check('lists this version\'s changes' + (hasFix ? ' with "Fixed" marks' : ''), notes.length && txt.includes(notes[0].items[0].replace(/^Fixed:\s*/i, '').slice(0, 30)) && (!hasFix || /Fixed/.test(txt)) && /Updated from 2\.4\.1/.test(txt));
  await pg.screenshot({ path: out + '/whatsnew.png' });
  await pg.click('#whatsNew button[value="ok"]');
  await pg.reload(); await pg.waitForTimeout(2500);
  check('shown only once', !(await pg.isVisible('#whatsNew')));
  await pg.evaluate(() => window.__sketchforge.CMD.whatsNew()); await pg.waitForTimeout(200);
  check('Help › What\'s new opens it again', await pg.isVisible('#whatsNew'));
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
