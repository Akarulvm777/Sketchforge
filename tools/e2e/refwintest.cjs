// Reference window (p10zbg): add a picture, see it, zoom, pick a colour from it, it stays after a restart, remove it.
const H = require('./harness.cjs');
const path = require('path');
(async () => {
  const root = process.argv[2], out = process.argv[3] || '/tmp';
  const { pg, errors, done } = await H.open(root, 8919, { width: 1300, height: 860 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const S = src => pg.evaluate(s => window.__sketchforge.scope(s), src);
  await S('CMD.refWin()'); await pg.waitForTimeout(300);
  check('Window › Reference window opens it (empty, with a hint)', await pg.isVisible('#refWin') && await pg.isVisible('#refWin .refempty'));
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('#refWin [data-a=add]')]);
  await fc.setFiles(path.join(out, 'red.png')); await pg.waitForTimeout(700);
  const mid = () => pg.evaluate(() => { const c = document.querySelector('#refWin canvas'), d = c.getContext('2d').getImageData(c.width / 2 | 0, c.height / 2 | 0, 1, 1).data; return [...d]; });
  const m = await mid();
  check('the picture is shown, fitted to the window: ' + m, m[3] > 0 && !await pg.isVisible('#refWin .refempty'));
  const z0 = await S('REF.z'); await pg.click('#refWin [data-a=in]');
  check('zoom in', await S('REF.z') > z0);
  await pg.click('#refWin [data-a=fit]');
  // pick a colour from the picture
  await S("setColor('#00ff00')");
  await pg.click('#refWin [data-a=pick]');
  const box = await pg.evaluate(() => { const r = document.querySelector('#refWin canvas').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await pg.mouse.click(box[0], box[1]); await pg.waitForTimeout(150);
  const col = await S('state.color');
  check('💧 picks the colour of the picture: ' + col + ' (picture ' + m.slice(0, 3) + ')', parseInt(col.slice(1, 3), 16) === m[0] && col !== '#00ff00');
  // stays after a restart, with its window place
  await pg.evaluate(() => { const w = document.querySelector('#refWin'); w.style.left = '100px'; w.style.top = '150px'; });
  await S('refSaveBox()');
  await pg.reload(); await pg.waitForTimeout(2000);
  await S('CMD.refWin()'); await pg.waitForTimeout(800);
  const pos = await pg.evaluate(() => { const r = document.querySelector('#refWin').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top)]; });
  check('after a restart: the picture is still there, the window where it was ' + pos, (await mid())[3] > 0 && pos[0] === 100 && pos[1] === 150);
  await pg.screenshot({ path: path.join(out, 'refwin.png') });
  await pg.click('#refWin [data-a=del]'); await pg.waitForTimeout(400);
  check('🗑 removes it', await S('REF.list.length') === 0 && await pg.isVisible('#refWin .refempty'));
  await pg.click('#refWin [data-a=close]');
  check('✕ closes the window', !await pg.isVisible('#refWin'));
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
