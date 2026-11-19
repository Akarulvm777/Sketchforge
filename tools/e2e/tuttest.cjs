// Tutorials: the first-start card, the tutorial centre, and every step of every tutorial (desktop + phone).
process.env.SF_TUT_FIRST = '1';
const H = require('./harness.cjs');
async function runAll(pg, label, out, check) {
  const ids = await pg.evaluate(() => [...document.querySelectorAll('#tutCenter [data-tut]')].map(b => b.dataset.tut));
  const nT = await pg.evaluate(() => window.__sketchforge.TUTORIALS.length);
  check(label + `: tutorial centre lists all ${nT} tutorials`, ids.length === nT && ids.includes('fox'));
  await pg.evaluate(() => document.querySelector('#tutCenter').close());
  const missing = [];
  for (const id of ids) {
    await pg.evaluate(id => window.__sketchforge.CMD['tut_' + id](), id);
    for (let i = 0; ; i++) {
      await pg.waitForTimeout(120);
      const st = await pg.evaluate(() => { const o = document.querySelector('#tutOverlay'); if (!o) return { open: false, gone: true }; const h = o.querySelector('.tut-hole'), c = o.querySelector('.tut-card'), r = c.getBoundingClientRect();
        return { open: !o.hidden, hole: h.style.display !== 'none', title: c.querySelector('h4').textContent, step: c.querySelector('.tut-top span:last-child').textContent, onScreen: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 }; });
      if (st.gone) missing.push(id + ' overlay gone at step ' + i);
      if (!st.open) break;
      const hasEl = await pg.evaluate(() => { const s = window.__sketchforge.TUT.steps[window.__sketchforge.TUT.i]; return !!s.el; });
      if (hasEl && !st.hole) missing.push(`${id} "${st.title}"`);
      if (!st.onScreen) missing.push(`${id} "${st.title}" card off screen`);
      if (id === 'custom' && i === 2) await pg.screenshot({ path: `${out}/tut_${label}_custom.png` });
      if (id === 'welcome' && i === 5) await pg.screenshot({ path: `${out}/tut_${label}_welcome.png` });
      if (id === 'animation' && i === 3) await pg.screenshot({ path: `${out}/tut_${label}_anim.png` });
      if (i > 40) break;
      await pg.click('#tutOverlay .tut-next');
    }
  }
  console.log('     not found: ' + (missing.join(', ') || 'none'));
  check(label + ': every spotlight target found and card on screen', missing.length === 0);
  check(label + ': all tutorials marked done', await pg.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('sketchforge.tutorials.v1'))).length) === ids.length + 1); // + the 'seen' flag
}
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  let { pg, errors, done } = await H.open(root, 8798);
  pg.on('dialog', d => d.accept());
  await pg.waitForTimeout(800);
  check('first start: "take the tour" card shown', await pg.isVisible('#tutWelcome'));
  await pg.screenshot({ path: out + '/tut_firststart.png' });
  await pg.click('#tutWelcome [data-a="go"]'); await pg.waitForTimeout(300);
  check('Start the tour opens the welcome tour', await pg.evaluate(() => window.__sketchforge.TUT.cur && window.__sketchforge.TUT.cur.id === 'welcome'));
  await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(200);
  check('→ key goes to step 2', await pg.evaluate(() => window.__sketchforge.TUT.i === 1));
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  check('Esc closes the tour', await pg.evaluate(() => document.querySelector('#tutOverlay').hidden));
  check('Help menu has the tutorials', await pg.evaluate(() => [...document.querySelectorAll('.menu[data-menu="Help"] [data-cmd]')].some(b => b.dataset.cmd === 'tutorials')));
  await pg.evaluate(() => window.__sketchforge.CMD.tutorials()); await pg.waitForTimeout(300);
  await pg.screenshot({ path: out + '/tut_center.png' });
  await runAll(pg, 'desktop', out, check);
  await pg.reload(); await pg.waitForTimeout(2500);
  check('card not shown again after the first start', !(await pg.isVisible('#tutWelcome')));
  // first switch to Animation asks "first time?"
  await pg.evaluate(() => window.__sketchforge.CMD.tutorials && document.querySelector('#tutCenter') && document.querySelector('#tutCenter').open && document.querySelector('#tutCenter').close());
  await pg.click('#modeSwitch [data-mode="anim"]'); await pg.waitForTimeout(700);
  check('Animation: "first time?" asked', await pg.isVisible('#animIntro'));
  await pg.screenshot({ path: out + '/tut_animintro.png' });
  await pg.click('#aiNo'); await pg.click('#modeSwitch [data-mode="draw"]'); await pg.click('#modeSwitch [data-mode="anim"]'); await pg.waitForTimeout(700);
  check('"No" without the tick: asked again next time', await pg.isVisible('#animIntro'));
  await pg.check('#aiNever'); await pg.click('#aiNo'); await pg.click('#modeSwitch [data-mode="draw"]'); await pg.click('#modeSwitch [data-mode="anim"]'); await pg.waitForTimeout(700);
  check('"Don\'t ask me again" ticked: not asked any more', !(await pg.isVisible('#animIntro')));
  await pg.evaluate(() => localStorage.removeItem('sketchforge.animintro.v1'));
  await pg.click('#modeSwitch [data-mode="draw"]'); await pg.click('#modeSwitch [data-mode="anim"]'); await pg.waitForTimeout(700);
  await pg.click('#aiYes'); await pg.waitForTimeout(400);
  check('"Yes" starts the animation tutorials (then every tool, tweens, rig)', await pg.evaluate(() => window.__sketchforge.TUT.cur && window.__sketchforge.TUT.cur.id === 'animation' && window.__sketchforge.TUT.queue.join() === 'animtools,tween,rig'));
  await pg.keyboard.press('Escape');
  await pg.click('#modeSwitch [data-mode="draw"]');
  const e1 = errors.slice(); await done();
  // phone
  ({ pg, errors, done } = await H.open(root, 8799, { width: 412, height: 915 }));
  await pg.evaluate(() => { localStorage.setItem('sketchforge.tutorials.v1', '{"seen":true}'); document.querySelector('#tutWelcome') && document.querySelector('#tutWelcome').remove(); window.__sketchforge.CMD.tutorials(); });
  await pg.waitForTimeout(300);
  await runAll(pg, 'phone', out, check);
  const all = e1.concat(errors);
  console.log(all.length ? all : 'no errors', ok.every(Boolean) && !all.length ? 'PASS' : 'FAIL');
  await done();
})();
