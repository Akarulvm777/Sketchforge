// ✨ Ask, the free offline helper: finds commands, tools and tutorial steps (English + French), buttons work, never draws.
const H = require('./harness.cjs');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, errors, done } = await H.open(root, 8802);
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const ask = async q => { await pg.fill('#aiPanel textarea', q); await pg.keyboard.press('Enter'); await pg.waitForTimeout(150); return pg.evaluate(() => { const m = [...document.querySelectorAll('#aiPanel .ai-msg.assistant')].pop(); return { text: m.innerText, btns: [...m.querySelectorAll('.ai-act')].map(b => b.dataset.k + ':' + b.dataset.id) }; }); };
  await pg.click('#aiBtn'); await pg.waitForTimeout(200);
  check('panel opens without signing in', await pg.isVisible('#aiPanel'));
  let r = await ask('where is the eraser?');
  check('"where is the eraser" -> eraser tools (' + r.btns.slice(0, 3) + ')', r.btns.some(b => b.startsWith('tool:')) && /eraser/i.test(r.text));
  r = await ask('how do I make an animation');
  check('"how do I make an animation" -> animation help', /animat/i.test(r.text) && r.btns.some(b => /tut:animation|cmd:newDrawing/.test(b)));
  r = await ask('comment exporter un gif');
  check('French: "comment exporter un gif" -> export', r.btns.some(b => /exportAnim/.test(b)));
  r = await ask('ma pression de stylo ne marche pas');
  check('French: pen pressure -> pen settings', r.btns.some(b => /penSettings|tut:pen/.test(b)));
  r = await ask('onion skin');
  check('"onion skin" -> onion command', r.btns.some(b => b === 'cmd:onion'));
  await pg.screenshot({ path: out + '/helper.png' });
  r = await ask('can you draw me a cat');
  check('refuses to draw', /don't draw|art is yours/i.test(r.text) && !r.btns.some(b => b.startsWith('cmd:')));
  r = await ask('why won\'t you draw for me?');
  check('"why" -> AI is not supposed to steal your job', r.text.includes('AI is not supposed to steal your job'));
  r = await ask('xqzv blorf');
  check('unknown -> friendly fallback', /couldn't find/i.test(r.text));
  // buttons work
  r = await ask('layers');
  const on0 = await pg.evaluate(() => window.__sketchforge.state.onion.on);
  await ask('onion skin'); await pg.click('#aiPanel .ai-msg.assistant:last-child .ai-act[data-id="onion"]');
  check('command button runs it', (await pg.evaluate(() => window.__sketchforge.state.onion.on)) !== on0);
  await ask('eraser'); await pg.click('#aiPanel .ai-msg.assistant:last-child .ai-act[data-k="tool"]');
  check('tool button selects the tool', await pg.evaluate(() => /eras/i.test(window.__sketchforge.state.tool) || /eras/i.test(window.__sketchforge.TOOLDEF[window.__sketchforge.state.tool].name)));
  await ask('onion skin before after colour'); const t = await pg.$('#aiPanel .ai-msg.assistant:last-child .ai-act[data-k="tut"]');
  if (t) { await t.click(); await pg.waitForTimeout(400); check('tutorial button opens the tutorial', await pg.evaluate(() => !!window.__sketchforge.TUT.cur)); await pg.keyboard.press('Escape'); }
  else check('tutorial button present', false);
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
