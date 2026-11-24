// Your own keyboard shortcuts (p10zbh): set one for a command and for a tool, it works, wins over a built-in key,
// shows in the menu, stays after a restart, and can be removed.
const H = require('./harness.cjs');
(async () => {
  const root = process.argv[2];
  const { pg, errors, done } = await H.open(root, 8920, { width: 1300, height: 860 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const S = src => pg.evaluate(s => window.__sketchforge.scope(s), src);
  const setKey = async (search, keys) => {
    await S('CMD.keyShortcuts()'); await pg.waitForTimeout(200);
    await pg.fill('#keysDlg .keysearch', search); await pg.waitForTimeout(100);
    await pg.click('#keysDlg .keyrow >> nth=0 >> button'); await pg.waitForTimeout(100);
    await pg.keyboard.press(keys); await pg.waitForTimeout(150);
    const shown = await pg.textContent('#keysDlg .keyrow >> nth=0 >> kbd');
    await pg.click('#keysDlg button[type=submit]'); await pg.waitForTimeout(150);
    return shown;
  };
  check('Help › Keyboard shortcuts lists commands and tools', await (async () => { await S('CMD.keyShortcuts()'); await pg.waitForTimeout(200); const n = await pg.$$eval('#keysDlg .keyrow', r => r.length); await pg.click('#keysDlg button[type=submit]'); return n > 150; })());
  const shown = await setKey('Zoom in', 'Alt+Q');
  check('a key set for a command: ' + shown, shown === 'Alt+Q' && await S("KEYS.map['Alt+Q']") === 'cmd:zoomIn');
  const z0 = await S('view.scale');
  await pg.mouse.move(600, 400); await pg.keyboard.press('Alt+Q'); await pg.waitForTimeout(150);
  check('pressing it runs the command', await S('view.scale') > z0);
  // a tool, on a key that already has a built-in use (B = brush group)
  await setKey('Hard eraser', 'B');
  await pg.keyboard.press('B'); await pg.waitForTimeout(150);
  const tool = await S('state.tool');
  check('a key set for a tool wins over the built-in key (B → ' + tool + ')', await S('TOOLDEF[state.tool].name') === 'Hard eraser');
  check('the menu shows your key', await pg.evaluate(() => { const mi = document.querySelector('#menus .mi[data-cmd=zoomIn] kbd'); return mi && mi.textContent === 'Alt+Q'; }));
  await pg.reload(); await pg.waitForTimeout(2200);
  await pg.mouse.move(600, 400);
  const z1 = await S('view.scale'); await pg.keyboard.press('Alt+Q'); await pg.waitForTimeout(150);
  check('after a restart your keys still work', await S('view.scale') > z1);
  // remove it: B is the brush group again
  await S('CMD.keyShortcuts()'); await pg.waitForTimeout(200);
  await pg.fill('#keysDlg .keysearch', 'Hard eraser'); await pg.waitForTimeout(100);
  await pg.click('#keysDlg .keyrow >> nth=0 >> .kclear'); await pg.click('#keysDlg button[type=submit]'); await pg.waitForTimeout(150);
  await pg.keyboard.press('B'); await pg.waitForTimeout(150);
  check('removing your key gives the built-in one back (B → brush)', await S('state.group') === 'brush');
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
