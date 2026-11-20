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
  // painting and animation lessons
  const askL = q => pg.evaluate(q => { const ta = document.querySelector('#aiPanel textarea'); ta.value = q; document.querySelector('#aiPanel form').requestSubmit(); return [...document.querySelectorAll('#aiPanel .ai-msg.assistant')].pop().textContent; }, q);
  await pg.evaluate(() => window.__sketchforge.CMD.ai ? window.__sketchforge.CMD.ai() : document.querySelector('#aiPanel') || null);
  if (!(await pg.$('#aiPanel'))) await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Ask/.test(x.textContent)); b && b.click(); });
  await pg.evaluate(() => { const p = document.querySelector('#aiPanel'); if (p) p.hidden = false; });
  const skin = await askL('how do I shade skin?');
  check('a painting question gets a step-by-step lesson', /Painting skin/.test(skin) && /1\./.test(skin) && /blush/i.test(skin));
  const persp = await askL('perspective vanishing point');
  check('perspective lesson with the perspective ruler button', /Perspective/.test(persp) && await pg.evaluate(() => [...document.querySelectorAll('#aiPanel .ai-msg.assistant')].pop().querySelector('[data-id="rl_persp"]') !== null));
  const lips = await askL('mouth shapes for talking');
  check('animation lessons too (mouth shapes)', /Mouth shapes/.test(lips) && /closed/i.test(lips));
  await pg.click('#aiPanel .ai-learn'); await pg.waitForTimeout(100);
  const cats = await pg.evaluate(() => [...[...document.querySelectorAll('#aiPanel .ai-msg.assistant')].pop().querySelectorAll('.ai-act')].map(b => b.textContent));
  check('📚 Learn lists the topics', cats.length >= 6 && cats.includes('Animation') && cats.includes('Colour'));
  const clickLast = t => pg.evaluate(t => { const b = [...[...document.querySelectorAll('#aiPanel .ai-msg.assistant')].pop().querySelectorAll('.ai-act')].find(x => x.textContent === t); b && b.click(); return !!b; }, t);
  await clickLast('Animation'); await pg.waitForTimeout(100);
  await clickLast('Walk cycle'); await pg.waitForTimeout(100);
  check('a topic lists its lessons, a lesson opens', /contact/.test(await pg.evaluate(() => [...document.querySelectorAll('#aiPanel .ai-msg.assistant')].pop().textContent)));
  const badActs = await pg.evaluate(() => { const SF = window.__sketchforge, bad = []; for (const L of SF.HELP_LESSONS) for (const [k, id] of L.a || []) if (k === 'cmd' ? !SF.CMD[id] : k === 'tool' ? !SF.TOOLDEF[id] : !SF.TUTORIALS.some(t => t.id === id)) bad.push(L.id + ':' + id); return bad; });
  check('every lesson button points to a real tool / command / tutorial (' + (badActs.join(', ') || 'all fine') + ')', badActs.length === 0);
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
