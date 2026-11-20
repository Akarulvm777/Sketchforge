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
  // the update history: every earlier version, newest first, with its date; opening one shows its notes; it scrolls
  const hist = await pg.evaluate(() => { const v = [...document.querySelectorAll('#whatsNew .wnver')]; return { n: v.length, first: v[0] && v[0].querySelector('summary').textContent, last: v.length && v[v.length - 1].querySelector('summary b').textContent,
    dated: v.filter(x => /\d{4}|\d{1,2}:\d{2}/.test(x.querySelector('summary .muted').textContent)).length, scroll: getComputedStyle(document.querySelector('#whatsNew .wnlist')).overflowY }; });
  console.log('     history:', JSON.stringify(hist));
  const APPV = await pg.evaluate(() => APP_VERSION.split('.').slice(0, 2).join('.') + '.');
  check('What\'s new also lists the earlier updates, newest first, with date and time', hist.n >= 10 && /^2\.\d+/.test(hist.first.trim()) && !hist.first.trim().startsWith(APPV) && hist.last === '0.5' && hist.dated >= 8 && hist.scroll === 'auto');
  await pg.click('#whatsNew .wnver >> nth=0'); await pg.waitForTimeout(100);
  check('tapping an earlier update shows its notes', await pg.evaluate(() => { const d = document.querySelector('#whatsNew .wnver'); return d.open && d.querySelectorAll('li').length > 2; }));
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
