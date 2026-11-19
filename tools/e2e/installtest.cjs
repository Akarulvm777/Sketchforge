// A new install (the installed app's version changes) resets the settings and keeps the work; an automatic update
// (same installed version) or the first start with this code keeps everything. Also: Sub tool rows keep their size.
const H = require('./harness.cjs');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, errors, done } = await H.open(root, 8825, { width: 1400, height: 900 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const keys = () => pg.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('sketchforge.')).sort());
  const seed = v => pg.evaluate(v => { localStorage.setItem('sketchforge.pen', '{"gamma":1.4}'); localStorage.setItem('sketchforge.customp.v2', '{"theme":"x"}');
    localStorage.setItem('sketchforge.session.v1', 'on'); localStorage.setItem('sketchforge.addons.v1', '{"scripts":[]}'); if (v) localStorage.setItem('sketchforge.install.v1', v); else localStorage.removeItem('sketchforge.install.v1'); }, v);
  const go = async shell => { await pg.goto(`http://127.0.0.1:8825/index.html${shell ? '?shell=' + shell : ''}`); await pg.waitForTimeout(2600); };
  // first start with this code (no install mark yet): nothing reset
  await seed(null); await go('2.9.1');
  let k = await keys();
  check('first start with this code: settings kept, install remembered', k.includes('sketchforge.pen') && k.includes('sketchforge.customp.v2') && (await pg.evaluate(() => localStorage.getItem('sketchforge.install.v1'))) === '2.9.1');
  // automatic update: same installed version
  await seed('2.9.1'); await go('2.9.1');
  k = await keys(); check('automatic update (same app version): settings kept', k.includes('sketchforge.pen') && k.includes('sketchforge.customp.v2'));
  // new install: version changed
  await seed('2.8.0'); await go('2.9.1');
  k = await keys();
  check('new install: settings back to default', !k.includes('sketchforge.customp.v2') && (await pg.evaluate(() => localStorage.getItem('sketchforge.pen'))) !== '{"gamma":1.4}');
  check('…the work and imported tools are kept', k.includes('sketchforge.session.v1') && k.includes('sketchforge.addons.v1'));
  check('…and a message says so', /settings are back to default/.test(await pg.textContent('#toast')));
  // browser (no installed app): nothing happens
  await seed('2.8.0'); await go(null);
  check('in the browser nothing is reset', (await keys()).includes('sketchforge.customp.v2'));
  // Sub tool rows keep their height with many tools
  const h = await pg.evaluate(() => { const SF = window.__sketchforge, g = SF.GROUPS.find(x => x.id === 'decor'); for (let i = 0; i < 25; i++) { const id = 'sparkle_t' + i; SF.TOOLDEF[id] = { ...SF.TOOLDEF.sparkle, name: 'Test tool ' + i }; SF.settings[id] = { ...SF.settings.sparkle }; g.subs.push(id); } SF.selectTool('glitter'); SF.selectTool('sparkle'); const rows = [...document.querySelectorAll('#subtoolList > *')]; return { n: rows.length, min: Math.min(...rows.map(r => r.getBoundingClientRect().height)), scroll: document.querySelector('#subtoolList').scrollHeight > document.querySelector('#subtoolList').clientHeight }; });
  console.log('     decoration sub tools:', h.n, 'rows, smallest', Math.round(h.min) + 'px, scrolls:', h.scroll);
  check('with 33 tools the rows keep a readable height and the list scrolls', h.n >= 33 && h.min >= 18 && h.scroll);
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
