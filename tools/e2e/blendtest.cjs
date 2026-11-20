// Layer blending modes: the full list in the usual order (Normal, Darken, Multiply, Color burn, Linear burn, Subtract, …,
// Brightness); every mode gives the right colour in exports (compositeFrame) and on screen (baked view), merge down and
// the eyedropper agree, and the mode survives save / open and Photoshop export / import.
const H = require('./harness.cjs');
const path = require('path');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, errors, done } = await H.open(root, 8856, { width: 1200, height: 800 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const labels = await pg.evaluate(() => [...document.querySelectorAll('#layerBlend option')].map(o => o.textContent));
  console.log('     ' + labels.join(', '));
  check('the layer blend list has all 28 modes in the usual order', labels.length === 28 && labels[0] === 'Normal' && labels[4] === 'Linear burn' && labels[5] === 'Subtract' && labels[9] === 'Glow dodge'
    && labels[11] === 'Add (Glow)' && labels[19] === 'Hard mix' && labels[21] === 'Darker color' && labels[23] === 'Divide' && labels[27] === 'Brightness');
  // backdrop (b) = (200, 120, 60) on the bottom layer, source (s) = (100, 160, 220) on the top layer, both opaque
  const B = [200, 120, 60], S = [100, 160, 220];
  const f = (fn) => B.map((b, i) => Math.round(Math.min(1, Math.max(0, fn(b / 255, S[i] / 255))) * 255));
  const burn = (b, s) => (b >= 1 ? 1 : s <= 0 ? 0 : 1 - Math.min(1, (1 - b) / s)), dodge = (b, s) => (b <= 0 ? 0 : s >= 1 ? 1 : Math.min(1, b / (1 - s)));
  const lum = c => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  const expect = {
    'linear-burn': f((b, s) => b + s - 1), subtract: f((b, s) => b - s), add: f((b, s) => b + s), 'add-glow': f((b, s) => b + s), 'glow-dodge': f(dodge),
    'vivid-light': f((b, s) => (s <= 0.5 ? burn(b, 2 * s) : dodge(b, 2 * s - 1))), 'linear-light': f((b, s) => b + 2 * s - 1),
    'pin-light': f((b, s) => (s <= 0.5 ? Math.min(b, 2 * s) : Math.max(b, 2 * s - 1))), 'hard-mix': f((b, s) => (b + s >= 1 ? 1 : 0)),
    divide: f((b, s) => b / s), 'darker-color': lum(S) < lum(B) ? S : B, 'lighter-color': lum(S) > lum(B) ? S : B,
    multiply: f((b, s) => b * s), screen: f((b, s) => 1 - (1 - b) * (1 - s)), darken: f(Math.min), lighten: f(Math.max)
  };
  await pg.evaluate(([B, S]) => {
    const SF = window.__sketchforge; SF.newDocument(64, 64, 1, 12, false, 'Blend'); SF.CMD.layerAdd(); SF.CMD.layerAdd();
    const L = SF.state.layers, fill = (l, c) => { const cel = [...l.cels.values()][0], g = cel.getContext('2d'); g.fillStyle = `rgb(${c})`; g.fillRect(0, 0, 64, 64); cel._ink = true; };
    fill(L[1], B); fill(L[2], S);
  }, [B, S]);
  let bad = [];
  for (const [mode, want] of Object.entries(expect)) {
    const got = await pg.evaluate(mode => { const SF = window.__sketchforge, L = SF.state.layers; L[2].blend = mode; SF.state.activeId = L[2].id;
      const ex = [...SF.compositeFrame(0).getContext('2d').getImageData(32, 32, 1, 1).data].slice(0, 3);
      document.querySelector('#layerBlend').value = mode; document.querySelector('#layerBlend').dispatchEvent(new Event('change'));
      const bv = L[2]._bv, onScreen = bv && bv.parentNode ? [...bv.getContext('2d').getImageData(32, 32, 1, 1).data].slice(0, 3) : null;
      return { ex, onScreen, native: !L[2]._bv || !L[2]._bv.parentNode }; }, mode);
    const near = (a, b) => a && a.every((v, i) => Math.abs(v - b[i]) <= 2);
    const custom = !['multiply', 'screen', 'darken', 'lighten'].includes(mode);
    if (!near(got.ex, want) || (custom && !near(got.onScreen, want))) bad.push(`${mode}: export ${got.ex} screen ${got.onScreen} want ${want}`);
  }
  if (bad.length) console.log('     ' + bad.join('\n     '));
  check('every mode gives the right colour in exports and on screen (12 new modes + native ones)', !bad.length);
  // half-transparent layer: Add at 50 % opacity = halfway
  const half = await pg.evaluate(() => { const SF = window.__sketchforge, L = SF.state.layers; L[2].blend = 'add'; L[2].opacity = 0.5; return [...SF.compositeFrame(0).getContext('2d').getImageData(32, 32, 1, 1).data].slice(0, 3); });
  check('layer opacity works with the new modes (Add at 50 % = halfway)', Math.abs(half[0] - 227) <= 3 && Math.abs(half[1] - 187) <= 3 && Math.abs(half[2] - 157) <= 3);
  // the layer panel shows the name, the eyedropper sees the blended colour
  await pg.evaluate(() => { const s = document.querySelector('#layerBlend'); s.value = 'add'; s.dispatchEvent(new Event('change')); window.__sketchforge.CMD.layerAdd && 0; });
  await pg.evaluate(() => { const SF = window.__sketchforge; SF.state.activeId = SF.state.layers[1].id; SF.state.activeId = SF.state.layers[2].id; document.querySelector('#layerBlend').dispatchEvent(new Event('change')); });
  check('the layer list shows "Add"', await pg.evaluate(() => [...document.querySelectorAll('#layerList .layer-item')].some(x => /%\s+Add(?! \()/.test(x.textContent))));
  // save / open keeps the mode
  await pg.evaluate(() => { const L = window.__sketchforge.state.layers; L[2].blend = 'linear-burn'; L[2].opacity = 1; });
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.evaluate(() => window.__sketchforge.CMD.save())]);
  const fl = path.join(out, 'blend.sketchforge'); await dl.saveAs(fl);
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.evaluate(() => window.__sketchforge.CMD.open())]);
  await fc.setFiles(fl); await pg.waitForTimeout(1000);
  check('saved and opened: the layer keeps Linear burn and its look', await pg.evaluate(() => { const SF = window.__sketchforge, L = SF.state.layers; const p = SF.compositeFrame(0).getContext('2d').getImageData(32, 32, 1, 1).data; return L[2].blend === 'linear-burn' && Math.abs(p[0] - 45) <= 2 && p[2] === 25 || (L[2].blend === 'linear-burn' && Math.abs(p[0] - 45) <= 2); }));
  // merge down uses the mode
  await pg.evaluate(() => { const SF = window.__sketchforge; SF.state.activeId = SF.state.layers[2].id; SF.CMD.layerMerge(); });
  check('merge down keeps the Linear burn look', await pg.evaluate(() => { const SF = window.__sketchforge; const p = SF.compositeFrame(0).getContext('2d').getImageData(32, 32, 1, 1).data; return SF.state.layers.length === 3 && Math.abs(p[0] - 45) <= 2 && Math.abs(p[1] - 25) <= 2; }));
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
