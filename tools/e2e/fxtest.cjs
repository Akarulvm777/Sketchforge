// Effects and filters: every Filter menu entry shows a live preview, OK changes the layer (one undo step), Cancel puts it back.
const H = require('./harness.cjs');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, errors, done } = await H.open(root, 8813);
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  await pg.evaluate(() => { const SF = window.__sketchforge; SF.newDocument(400, 300, 1, 12, false, 'FX'); });
  // a simple test drawing: coloured shapes + a black outline, on a transparent layer
  const paint = () => pg.evaluate(() => { const SF = window.__sketchforge, c = [...SF.activeLayer().cels.values()][0], g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = '#e04040'; g.fillRect(60, 60, 120, 120); g.fillStyle = '#ffd040'; g.beginPath(); g.arc(270, 150, 70, 0, 7); g.fill();
    g.strokeStyle = '#000'; g.lineWidth = 6; g.strokeRect(60, 60, 120, 120); });
  const hash = () => pg.evaluate(() => { const c = [...window.__sketchforge.activeLayer().cels.values()][0], d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 7) h = (h * 31 + d[i]) | 0; return h; });
  const cmds = await pg.evaluate(() => window.__sketchforge.MENUS.find(m => m[0] === 'Filter')[1].filter(Array.isArray).map(x => [x[1], x[0]]));
  console.log('     Filter menu:', cmds.length, 'entries');
  check('Filter menu has the new effects', ['fxGlow', 'fxShadow', 'fxOutline', 'fxLineArt', 'fxHalftone', 'fxOil', 'fxTwirl', 'fxWave', 'fxGray'].every(c => cmds.some(x => x[0] === c)));
  for (const [cmd, label] of cmds) {
    await paint(); const h0 = await hash();
    await pg.evaluate(c => window.__sketchforge.CMD[c](), cmd); await pg.waitForTimeout(250);
    const dlg = await pg.$('dialog[open]');
    if (!dlg) { // one-click filters
      const h1 = await hash(); await pg.evaluate(() => window.__sketchforge.CMD.undo()); const h2 = await hash();
      check(`${label}: changes the layer, undo restores`, h1 !== h0 && h2 === h0); continue;
    }
    // move the last slider a bit, like a user would (some filters start at "no change")
    await pg.evaluate(() => { const r = [...document.querySelectorAll('dialog[open] input[type=range]')].pop(); if (r) { r.value = String(Math.min(+r.max, +r.value + (+r.max - +r.min) * 0.3)); r.dispatchEvent(new Event('input')); } });
    await pg.waitForTimeout(400);
    const hp = await hash();
    await pg.click('dialog[open] button[value=cancel]'); await pg.waitForTimeout(150);
    const hc = await hash();
    await pg.evaluate(c => window.__sketchforge.CMD[c](), cmd); await pg.waitForTimeout(250);
    await pg.evaluate(() => { const r = [...document.querySelectorAll('dialog[open] input[type=range]')].pop(); if (r) { r.value = String(Math.min(+r.max, +r.value + (+r.max - +r.min) * 0.3)); r.dispatchEvent(new Event('input')); } });
    await pg.click('dialog[open] button[value=ok]'); await pg.waitForTimeout(250);
    const ho = await hash();
    await pg.evaluate(() => window.__sketchforge.CMD.undo()); const hu = await hash();
    check(`${label}: preview shows, Cancel restores, OK applies, undo restores`, hp !== h0 && hc === h0 && ho !== h0 && hu === h0);
  }
  // effect inside a selection only
  await paint(); const h0 = await hash();
  const outside = () => pg.evaluate(() => { const c = [...window.__sketchforge.activeLayer().cels.values()][0], d = c.getContext('2d').getImageData(240, 100, 60, 100).data; let h = 0; for (let i = 0; i < d.length; i++) h = (h * 31 + d[i]) | 0; return h; });
  const o0 = await outside();
  await pg.evaluate(() => { const SF = window.__sketchforge; SF.sel.active = false; });
  await pg.evaluate(() => { const SF = window.__sketchforge; const m = SF.sel.mask, g = m.getContext('2d'); g.clearRect(0, 0, m.width, m.height); g.fillStyle = '#000'; g.fillRect(40, 40, 160, 160); SF.sel.active = true; SF.sel.bb = { x: 40, y: 40, w: 160, h: 160 }; });
  await pg.evaluate(() => window.__sketchforge.CMD.fxGray());
  check('an effect with a selection only changes the selected part', (await hash()) !== h0 && (await outside()) === o0);
  await pg.evaluate(() => { window.__sketchforge.sel.active = false; });
  // a look at a few effects
  await paint(); await pg.evaluate(() => window.__sketchforge.CMD.fxGlow()); await pg.waitForTimeout(400);
  await pg.screenshot({ path: out + '/fx_glow_preview.png' });
  await pg.click('dialog[open] button[value=ok]');
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
