const H = require('./harness.cjs');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, errors, done } = await H.open(root);
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const bg = sel => pg.evaluate(s => getComputedStyle(document.querySelector(s)).backgroundColor, sel);
  const menus = await pg.evaluate(() => [...document.querySelectorAll('#menus .menu-btn')].map(b => b.textContent));
  check('menu "🎨 Custom P" right after Add-ons: ' + menus.join(' | '), menus[menus.indexOf('Add-ons') + 1] === '🎨 Custom P');
  const before = { bar: await bg('#cmdbar'), dock: await bg('#leftdock'), menu: await bg('#menubar') };
  await pg.evaluate(() => window.__sketchforge.CMD.cpTheme_midnight());
  const mid = { bar: await bg('#cmdbar'), dock: await bg('#leftdock') };
  check(`midnight repaints top bar ${before.bar} -> ${mid.bar}`, mid.bar !== before.bar);
  check(`midnight repaints left dock ${before.dock} -> ${mid.dock}`, mid.dock !== before.dock);
  await pg.screenshot({ path: out + '/cp_midnight.png' });
  await pg.evaluate(() => window.__sketchforge.CMD.cpTheme_light());
  const lightBar = await bg('#cmdbar');
  check('light theme makes the bar light: ' + lightBar, (() => { const m = lightBar.match(/\d+/g).map(Number); return m[0] > 180; })());
  await pg.screenshot({ path: out + '/cp_light.png' });
  // dialog + custom colour
  await pg.evaluate(() => window.__sketchforge.CMD.cpOpen());
  await pg.evaluate(() => { const i = document.querySelector('[data-ck="bg"]'); i.value = '#550022'; i.dispatchEvent(new Event('input')); i.dispatchEvent(new Event('change')); });
  check('custom background applied live', (await pg.evaluate(() => JSON.parse(localStorage.getItem('sketchforge.customp.v1')).preset)) === 'custom');
  await pg.screenshot({ path: out + '/cp_dialog.png' });
  // icons tab: replace the "pen" icon
  await pg.click('.cpTabs [data-tab="icons"]');
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('.cpIcon[data-ik="pen"] .cpPick')]);
  await fc.setFiles(out + '/red.png'); await pg.waitForTimeout(600);
  check('pen tool button now shows the custom image', await pg.evaluate(() => !!document.querySelector('#toolbox .tool[data-group="pen"] svg.cicon image')));
  check('custom icon stored at 64 px', await pg.evaluate(() => new Promise(r => { const im = new Image(); im.onload = () => r(im.width === 64 && im.height === 64); im.src = JSON.parse(localStorage.getItem('sketchforge.customp.v1')).icons.pen; })));
  await pg.screenshot({ path: out + '/cp_icons.png' });
  await pg.click('#cpClose');
  // reload: settings persist
  await pg.reload(); await pg.waitForTimeout(2000);
  check('after reload: custom theme still applied', (await bg('#cmdbar')) !== before.bar);
  check('after reload: custom pen icon still shown', await pg.evaluate(() => !!document.querySelector('#toolbox .tool[data-group="pen"] svg.cicon')));
  // reset
  pg.on('dialog', d => d.accept());
  await pg.evaluate(() => window.__sketchforge.CMD.cpReset());
  await pg.waitForTimeout(300);
  check('reset restores the original bar colour', (await bg('#cmdbar')) === before.bar);
  check('reset restores the original pen icon', await pg.evaluate(() => !document.querySelector('#toolbox .cicon')));
  console.log('page errors:', errors.length ? errors : 'none');
  console.log(ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
