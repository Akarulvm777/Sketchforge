// Custom P: pictures instead of colours (Colours tab) for the background and parts of the interface.
const H = require('./harness.cjs');
const fs = require('fs'), path = require('path');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, errors, done } = await H.open(root, 8804);
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const img = path.join(out, 'cp_bg.png');
  fs.copyFileSync(path.join(root, 'site/assets/shots/model3d.png'), img);
  await pg.evaluate(() => window.__sketchforge.CMD.cpOpen()); await pg.waitForTimeout(300);
  await pg.click('#cpDialog .cpTabs [data-tab="colors"]'); await pg.waitForTimeout(300);
  check('Colours tab has a "Pictures instead of colours" group', (await pg.textContent('#cpDialog')).includes('Pictures instead of colours'));
  const pick = async label => {
    const row = pg.locator('#cpDialog .cprow', { hasText: label }).first();
    const [fc] = await Promise.all([pg.waitForEvent('filechooser'), row.locator('button', { hasText: 'Choose image' }).click()]);
    await fc.setFiles(img); await pg.waitForTimeout(500);
  };
  await pick('Whole background'); await pick('Side panels'); await pick('Menu bar');
  const bg = await pg.evaluate(() => ({ body: getComputedStyle(document.body).backgroundImage, dock: getComputedStyle(document.querySelector('#rightdock')).backgroundImage, menu: getComputedStyle(document.querySelector('#menubar')).backgroundImage }));
  check('background picture applied', /url\(/.test(bg.body));
  check('side panels picture applied', /url\(/.test(bg.dock));
  check('menu bar picture applied', /url\(/.test(bg.menu));
  check('darken slider appears', (await pg.textContent('#cpDialog')).includes('Darken pictures'));
  await pg.screenshot({ path: out + '/cp_pictures.png' });
  await pg.click('#cpClose'); await pg.waitForTimeout(200); await pg.screenshot({ path: out + '/cp_pictures_app.png' });
  await pg.reload(); await pg.waitForTimeout(2500);
  check('pictures kept after restarting', /url\(/.test(await pg.evaluate(() => getComputedStyle(document.querySelector('#rightdock')).backgroundImage)));
  await pg.evaluate(() => window.__sketchforge.CMD.cpOpen()); await pg.waitForTimeout(300);
  await pg.click('#cpDialog .cpTabs [data-tab="colors"]'); await pg.waitForTimeout(300);
  await pg.click('#cpResetSec'); await pg.waitForTimeout(600);
  check('"Reset this tab" removes the part pictures', !/url\(/.test(await pg.evaluate(() => getComputedStyle(document.querySelector('#rightdock')).backgroundImage)));
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
