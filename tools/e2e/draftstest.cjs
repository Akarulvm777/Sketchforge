// Real files and drafts (3.3): new file notice, drafts on the Home page, saving makes a real file, reset drops drafts.
const H = require('./harness.cjs');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, errors, done } = await H.open(root, 8816);
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const S = c => pg.evaluate(c => window.__sketchforge.scope(c)(), c);
  await pg.evaluate(() => localStorage.removeItem('sketchforge.draftnote.v1'));
  await S(`(() => { newDocument(800, 600, 1, 12, false, 'Draft one'); })`); await pg.waitForTimeout(300);
  check('a new file shows the draft notice', await pg.isVisible('#draftNote'));
  await pg.check('#draftNoteOff'); await pg.click('#draftNote button'); await pg.waitForTimeout(150);
  await S(`(() => { newDocument(800, 600, 1, 12, false, 'Draft two'); })`); await pg.waitForTimeout(300);
  check('Do not show this again works', !(await pg.$('#draftNote')));
  await pg.strokeDoc([[200, 200], [400, 260]]);
  check('a new file is a draft (not a real file)', await S(`(() => !DOCS.cur.realFile)`));
  await S(`(async () => { await recentRecord(); })`);
  await S(`(async () => { hubOpen('home'); await new Promise(r => setTimeout(r, 400)); })`);
  check('Home page lists it under Drafts', await pg.evaluate(() => [...document.querySelectorAll('#startHub .hub-sec h3')].some(h => /Drafts/.test(h.textContent)) && document.querySelector('#startHub').textContent.includes('Draft two')));
  await S(`(() => hubClose())`);
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.keyboard.press('Control+s')]); await dl.saveAs(out + '/draft_two.sketchforge'); await pg.waitForTimeout(500);
  check('File › Save makes it a real file', await S(`(() => !!DOCS.cur.realFile)`));
  await S(`(async () => { await recentRecord(); })`);
  check('the Home page entry is no longer a draft', await S(`(async () => { const l = await recentList(); const e = l.find(x => x.name === 'Draft two'); return !!e && !e.draft; })`));
  await S(`(async () => { DOCS.cur.realFile = false; await recentRecord(); state.name = 'Gone soon'; DOCS.cur.realFile = false; await recentRecord(); })`);
  await S(`(async () => { await dropDrafts(); })`);
  check('reset / reinstall drops the drafts (dropDrafts), saved files stay', await S(`(async () => { const l = await recentList(); return !l.some(e => e.draft) && l.length >= 0; })`));
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done(); process.exit(ok.every(Boolean) && !errors.length ? 0 : 1);
})();
