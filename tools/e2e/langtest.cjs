// Languages: the interface follows the system language, the picker changes it, English comes back exactly.
const H = require('./harness.cjs');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, errors, done } = await H.open(root, 8795);
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const E = f => pg.evaluate(f);
  const menuText = () => E(() => document.querySelector('#menubar').textContent);
  const en = await menuText();
  check('English by default here (browser in English)', /File/.test(en) && await E(() => document.documentElement.lang) === 'en');
  await E(() => window.__sketchforge.CMD.language());
  check('Help › Language opens the picker with 9 languages', await E(() => document.querySelectorAll('#langPick [data-l]').length) === 9);
  await pg.click('#langPick [data-l=th]'); await pg.waitForTimeout(300);
  const th = await menuText();
  check('Thai: the menus are translated', /ไฟล์/.test(th) && /แก้ไข/.test(th));
  check('Thai: panel titles too', await E(() => document.body.textContent.includes('คุณสมบัติเครื่องมือ')));
  await pg.click('#langPick [data-a=ok]');
  check('the choice is saved', await E(() => localStorage.getItem('sketchforge.lang.v1')) === 'th');
  // new interface parts made later are translated as they appear (a menu opened, a dialog)
  await E(() => window.__sketchforge.CMD.penSettings()); await pg.waitForTimeout(200);
  check('a dialog opened later is translated (Reset → รีเซ็ต)', await E(() => document.querySelector('#penReset').textContent) === 'รีเซ็ต');
  await E(() => document.querySelector('#penDialog').close());
  await pg.screenshot({ path: out + '/lang_th.png' });
  // after a restart: still Thai
  await pg.reload(); await pg.waitForTimeout(2500);
  check('after a restart the app is still in Thai', /ไฟล์/.test(await menuText()));
  await E(() => window.__sketchforge.scope("setLanguage('fr', true)"));
  check('French', /Fichier/.test(await menuText()) && /Édition/.test(await menuText()));
  await E(() => window.__sketchforge.scope("setLanguage('en', true)"));
  check('back to English exactly', await menuText() === en);
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
