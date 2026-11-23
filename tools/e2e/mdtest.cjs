const H = require('./harness.cjs');
const fs = require('fs');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, ctx, errors, done } = await H.open(root, 8771);
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const tabs = () => pg.evaluate(() => [...document.querySelectorAll('#tabbar .tab')].map(t => (t.classList.contains('on') ? '*' : '') + t.querySelector('.nm').textContent + (t.querySelector('.dot.on') ? '•' : '')));
  const E = f => pg.evaluate(f);
  let dlgAnswer = true; pg.on('dialog', d => dlgAnswer ? d.accept() : d.dismiss());
  check('starts with one tab: ' + (await tabs()).join(' | '), (await tabs()).length === 1);
  await pg.strokeDoc([[100, 100], [300, 150]]);                 // doc A
  await E(() => window.__sketchforge.selectAll && 0);
  // New 800x600 via the dialog
  await pg.click('#tabbar .tabplus');
  await pg.fill('#newName', 'Bee'); await pg.selectOption('#newUnit', 'px').catch(() => {});
  await pg.fill('#newW', '800'); await pg.dispatchEvent('#newW', 'input'); await pg.fill('#newH', '600'); await pg.dispatchEvent('#newH', 'input');
  await pg.click('#newCreate'); await pg.waitForTimeout(500);
  check('New opens a second tab: ' + (await tabs()).join(' | '), (await tabs()).length === 2 && (await tabs())[1].startsWith('*Bee'));
  check('doc B is 800×600', await E(() => window.__sketchforge.state.w === 800 && window.__sketchforge.state.h === 600));
  check('doc B does not contain A\'s stroke', await pg.inkAt(200, 125) === 0);
  await pg.strokeDoc([[400, 400], [600, 450]]);                 // doc B
  await pg.keyboard.press('Control+a');
  check('B has a selection', await E(() => window.__sketchforge.sel.active));
  // switch to A
  await pg.click('#tabbar .tab:nth-child(1)'); await pg.waitForTimeout(300);
  check('switch back to A: size 1280×720', await E(() => window.__sketchforge.state.w === 1280 && window.__sketchforge.state.h === 720));
  check('A still has its stroke', await pg.inkAt(200, 125) > 100);
  check('A has no selection (selection is per document)', !(await E(() => window.__sketchforge.sel.active)));
  check('A has its own undo history (1 step)', await E(() => window.__sketchforge.history.undo.length) === 1);
  await pg.keyboard.press('Control+z');
  check('undo in A removes A\'s stroke', await pg.inkAt(200, 125) === 0);
  await pg.click('#tabbar .tab:nth-child(2)'); await pg.waitForTimeout(300);
  check('B untouched by A\'s undo', await pg.inkAt(500, 425) > 100);
  check('B selection restored', await E(() => window.__sketchforge.sel.active));
  check('B undo history intact', await E(() => window.__sketchforge.history.undo.length) >= 1);
  const tlA = await E(async () => { await window.__sketchforge.tlIdle(); return window.__sketchforge.TL.frames.length; });
  // save B, then open it again -> third tab
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.keyboard.press('Control+s')]);
  await dl.saveAs(out + '/bee.sketchforge');
  await pg.setInputFiles('#fileOpen', out + '/bee.sketchforge'); await pg.waitForTimeout(1200);
  check('Open adds a third tab: ' + (await tabs()).join(' | '), (await tabs()).length === 3);
  // close with unsaved changes: dismiss keeps it
  await pg.click('#tabbar .tab:nth-child(1)'); await pg.waitForTimeout(200);
  await pg.strokeDoc([[50, 50], [90, 60]]);
  // closing always asks (3.3): a draft → Save as a file / Keep as a draft / Delete it / Cancel
  await pg.click('#tabbar .tab:nth-child(1) .x'); await pg.waitForTimeout(200);
  check('closing a draft asks: save as a file, keep as a draft, delete or cancel', (await pg.$$eval('#closeAskDlg [data-a]', b => b.map(x => x.dataset.a).join(','))) === 'save,keep,delete,cancel');
  await pg.click('#closeAskDlg [data-a=cancel]'); await pg.waitForTimeout(200);
  check('close of an unsaved tab can be cancelled', (await tabs()).length === 3);
  await pg.click('#tabbar .tab:nth-child(1) .x'); await pg.waitForTimeout(200);
  await pg.click('#closeAskDlg [data-a=delete]'); await pg.waitForTimeout(400);
  check('confirmed close removes it: ' + (await tabs()).join(' | '), (await tabs()).length === 2);
  check('a file saved with File › Save is a real file (no draft question when unchanged)', await pg.evaluate(() => { const D = window.__sketchforge.scope('DOCS'); return D.list.some(r => r.realFile); }));
  // reorder by drag
  const before = await tabs();
  await pg.dragAndDrop('#tabbar .tab:nth-child(2)', '#tabbar .tab:nth-child(1)', { targetPosition: { x: 3, y: 10 } });
  const after = await tabs();
  check(`drag reorders tabs: ${before.join(' | ')}  ->  ${after.join(' | ')}`, after[0].replace('*', '') === before[1].replace('*', ''));
  // second view
  await E(() => window.__sketchforge.CMD.subView());
  await pg.waitForTimeout(500);
  const svInk = await E(() => { const c = document.querySelector('#subView canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 60 && d[i + 1] < 60 && d[i + 2] < 60) n++; return n; });
  check('second view shows the drawing (' + svInk + ' dark px)', svInk > 50);
  await pg.screenshot({ path: out + '/md.png' });
  // move to a new window
  const [popup] = await Promise.all([ctx.waitForEvent('page'), E(() => window.__sketchforge.CMD.docToWindow())]);
  await popup.waitForTimeout(3500);
  const childTabs = await popup.evaluate(() => [...document.querySelectorAll('#tabbar .tab .nm')].map(t => t.textContent));
  check('new window opened the document: ' + childTabs.join(' | '), childTabs.length === 1 && childTabs[0].startsWith('Bee'));
  check('the moved tab left this window: ' + (await tabs()).join(' | '), (await tabs()).length === 1);
  await popup.screenshot({ path: out + '/md_child.png' });
  console.log('page errors:', errors.length ? errors : 'none');
  console.log(ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
