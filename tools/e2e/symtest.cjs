const H = require('./harness.cjs');
(async () => {
  const { pg, errors, done } = await H.open(process.argv[2]);
  const ok = []; const check = (name, cond) => { ok.push(cond); console.log((cond ? 'ok   ' : 'FAIL ') + name); };
  // canvas is 1280x720; axis at x=640
  await pg.click('#symBtn .lbl');
  check('button turns symmetry on', await pg.evaluate(() => document.querySelector('#symBtn').classList.contains('on')));
  await pg.strokeDoc([[200, 200], [300, 260], [400, 230]]);
  check('ink on drawn side', await pg.inkAt(300, 260) > 100);
  check('ink mirrored at x=1280-300', await pg.inkAt(980, 260) > 100);
  check('nothing at an unmirrored spot', await pg.inkAt(300, 460) === 0);
  // 4-way via the popup
  await pg.click('#symBtn .caret'); await pg.click('#symPop [data-m="quad"]');
  await pg.strokeDoc([[150, 100], [200, 120], [250, 110]]);
  check('4-way: top-right copy', await pg.inkAt(1080, 120) > 100);
  check('4-way: bottom-left copy', await pg.inkAt(200, 600) > 100);
  check('4-way: bottom-right copy', await pg.inkAt(1080, 600) > 100);
  // line shape mirrored (Figure group, key U)
  await pg.keyboard.press('Escape');
  await pg.evaluate(() => window.__sketchforge.selectTool('line'));
  await pg.strokeDoc([[100, 360], [300, 360]]);
  check('line shape copied across axis', await pg.inkAt(1080, 360) > 100);
  // undo removes the whole symmetric stroke in one step
  await pg.keyboard.press('Control+z');
  check('one undo removes original and copies', await pg.inkAt(200, 360) === 0 && await pg.inkAt(1080, 360) === 0);
  // Shift+M turns it off
  await pg.keyboard.press('Shift+M');
  check('Shift+M turns symmetry off', !(await pg.evaluate(() => document.querySelector('#symBtn').classList.contains('on'))));
  check('Shift+M did not switch to the selection tool', await pg.evaluate(() => window.__sketchforge.state.tool) === 'line');
  await pg.evaluate(() => window.__sketchforge.selectTool('pen'));
  await pg.strokeDoc([[200, 650], [260, 660]]);
  check('off: no mirrored ink', await pg.inkAt(1050, 655) === 0);
  await pg.screenshot({ path: process.argv[3] + '/sym.png' });
  console.log('page errors:', errors.length ? errors : 'none');
  console.log(ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
