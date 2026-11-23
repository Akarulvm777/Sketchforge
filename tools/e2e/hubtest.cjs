// Start screen (File › Start screen; shown at start by installed apps or when ticked) and the Pages panel of manga /
// comic projects (opens by itself with a manga file, closes with any other file, Window › Pages panel = off; no
// Animation mode for manga files; new pages keep the panels).
const H = require('./harness.cjs');
(async () => {
  const root = process.argv[2];
  const { pg, errors, done } = await H.open(root, 8908, { width: 1300, height: 860 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const S = src => pg.evaluate(s => window.__sketchforge.scope(s), src);
  check('not shown at start in a browser tab (only installed apps, or when ticked)', await pg.evaluate(() => !document.querySelector('#startHub') || document.querySelector('#startHub').hidden));
  check('shown at start: installed app yes, web no, "on" yes, "off" no', await S("hubShouldShow(null, true) && !hubShouldShow(null, false) && hubShouldShow('on', false) && !hubShouldShow('off', true)"));
  check('recent list: newest first, one per name, at most 12', await S("(() => { let l = []; for (let i = 0; i < 15; i++) l = recentMerge(l, { name: 'f' + (i % 13) }); return l.length === 12 && l[0].name === 'f1' && new Set(l.map(e => e.name)).size === 12; })()"));
  // a saved file goes to Continue drawing
  await pg.evaluate(() => { const SF = window.__sketchforge; SF.newDocument(400, 300, 1, 12, false, 'Fox sketch'); SF.CMD.layerAdd(); const g = SF.activeLayer().cels.get(0).getContext('2d'); g.fillStyle = '#d60'; g.fillRect(50, 50, 200, 120); });
  await Promise.all([pg.waitForEvent('download'), pg.evaluate(() => window.__sketchforge.CMD.save())]); await pg.waitForTimeout(1500);
  await pg.evaluate(() => window.__sketchforge.CMD.startHub()); await pg.waitForTimeout(1200);
  const hub = await pg.evaluate(() => { const H = document.querySelector('#startHub'); return { shown: !H.hidden, files: [...H.querySelectorAll('.hub-file b')].map(b => b.textContent), news: H.querySelectorAll('.hub-news').length, learn: H.querySelectorAll('.hub-learn').length, newCards: H.querySelectorAll('.hub-new button').length, thumb: !!H.querySelector('.hub-file img') }; });
  console.log('     ' + JSON.stringify(hub));
  check('File › Start screen opens it, with new-file cards, What\'s new and Learn', hub.shown && hub.newCards === 5 && hub.news >= 1 && hub.learn >= 6);
  check('Continue drawing shows the saved file with a picture', hub.files.includes('Fox sketch') && hub.thumb);
  for (const v of ['projects', 'learn', 'community', 'home']) { await pg.evaluate(v => document.querySelector(`#startHub .hub-rail [data-v="${v}"]`).click(), v); await pg.waitForTimeout(300); }
  check('every page of the start screen opens (Projects, Learn, Community, Home)', await pg.evaluate(() => document.querySelector('#startHub .hub-rail [data-v="home"]').classList.contains('on')));
  // a recent file that is not open any more: reopen it from the start screen
  await pg.evaluate(() => { const S = window.__sketchforge.scope; S('docClose(DOCS.cur, true)'); });
  await pg.evaluate(() => window.__sketchforge.CMD.startHub()); await pg.waitForTimeout(1000);
  await pg.evaluate(() => [...document.querySelectorAll('#startHub .hub-file')].find(b => b.textContent.includes('Fox sketch')).click()); await pg.waitForTimeout(1500);
  check('clicking a recent file opens it and closes the start screen', await pg.evaluate(() => window.__sketchforge.state.name === 'Fox sketch' && document.querySelector('#startHub').hidden));
  // ticking "Show when Sketchforge starts"
  await pg.evaluate(() => { window.__sketchforge.CMD.startHub(); const c = document.querySelector('#hubShowAtStart'); c.checked = true; c.dispatchEvent(new Event('change')); window.__sketchforge.scope('hubClose()'); });
  check('"Show when Sketchforge starts" is remembered', await pg.evaluate(() => localStorage.getItem('sketchforge.start.v1') === 'on'));
  await pg.evaluate(() => localStorage.removeItem('sketchforge.start.v1'));
  // manga project: the Pages panel opens by itself, no Animation mode
  await pg.evaluate(() => window.__sketchforge.scope('newMangaPage()')); await pg.waitForTimeout(300);
  await pg.evaluate(() => document.querySelector('dialog[open] button[value=ok]').click()); await pg.waitForTimeout(800);
  check('a manga page opens the Pages panel by itself', await pg.evaluate(() => { const p = document.querySelector('#pagesPanel'); return p && !p.hidden && p.querySelectorAll('.pp-page').length === 1; }));
  await pg.evaluate(() => document.querySelector('#pagesPanel .pp-add').click()); await pg.waitForTimeout(400);
  await pg.evaluate(() => document.querySelector('#pagesPanel .pp-add').click()); await pg.waitForTimeout(600);
  const pp = await pg.evaluate(() => { const SF = window.__sketchforge, P = SF.state.layers.find(l => l.name === 'Panels'), d = c => { const x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < x.length; i += 4) if (x[i]) n++; return n; };
    return { pages: SF.state.frameCount, thumbs: document.querySelectorAll('#pagesPanel .pp-page').length, frame: SF.state.frame, panelsInk: d(P.cels.get(2)) }; });
  console.log('     ' + JSON.stringify(pp));
  check('＋ New page adds pages (as many as you like)', pp.pages === 3 && pp.thumbs === 3 && pp.frame === 2);
  check('a new page keeps the panel borders', pp.panelsInk > 1000);
  await pg.evaluate(() => document.querySelectorAll('#pagesPanel .pp-page')[0].click()); await pg.waitForTimeout(400);
  check('clicking a page opens it', await pg.evaluate(() => window.__sketchforge.state.frame === 0));
  await pg.evaluate(() => window.__sketchforge.scope("setMode('anim')")); await pg.waitForTimeout(200);
  check('manga files stay in the Drawing workspace', await pg.evaluate(() => window.__sketchforge.state.mode === 'draw' && document.querySelector('#modeSwitch [data-mode="anim"]').disabled));
  // another file: the panel closes; back: it opens
  await pg.evaluate(() => window.__sketchforge.newDocument(400, 300, 1, 12, false, 'Other')); await pg.waitForTimeout(300);
  check('switching to another file closes the panel (and Animation is allowed again)', await pg.evaluate(() => document.querySelector('#pagesPanel').hidden && !document.querySelector('#modeSwitch [data-mode="anim"]').disabled));
  await pg.evaluate(() => { const S = window.__sketchforge.scope; S("docSwitch(DOCS.list.find(r => docName(r) === 'Manga page'))"); }); await pg.waitForTimeout(400);
  check('back to the manga file: the panel opens again', await pg.evaluate(() => !document.querySelector('#pagesPanel').hidden));
  await pg.evaluate(() => window.__sketchforge.CMD.pagesPanel()); await pg.waitForTimeout(200);
  check('Window › Pages panel turns it off', await pg.evaluate(() => document.querySelector('#pagesPanel').hidden && localStorage.getItem('sketchforge.pagespanel.v1') === 'off'));
  await pg.evaluate(() => window.__sketchforge.CMD.pagesPanel());
    // 3.3: the Home page is a tab next to the drawing
  await pg.evaluate(() => window.__sketchforge.scope('hubOpen')('home')); await pg.waitForTimeout(300);
  const ht = await pg.evaluate(() => ({ on: !!document.querySelector('#hometab.on'), below: parseInt(document.querySelector('#startHub').style.top) > 20 }));
  await pg.click('#tabbar .tab'); await pg.waitForTimeout(250);
  const closed = await pg.evaluate(() => !document.body.classList.contains('hub-open'));
  await pg.click('#hometab'); await pg.waitForTimeout(250);
  check('the Home page is a tab next to the file tabs (opens under the tab bar, a file tab goes back to drawing)', ht.on && ht.below && closed && await pg.evaluate(() => document.body.classList.contains('hub-open')));
  await pg.evaluate(() => window.__sketchforge.scope('hubClose')());
console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done(); process.exit(ok.every(Boolean) && !errors.length ? 0 : 1);
})();
