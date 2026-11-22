// Speed guard: colour-mixing / blend tools on a big page, zoomed out (thousands of dabs per pen movement).
// Fails if one dab gets slow again (3.0 took ~0.15–0.25 ms per dab: the line fell behind the pen).
const H = require('./harness.cjs');
(async () => {
  const { pg, errors, done } = await H.open(process.argv[2], 8831, { width: 1600, height: 950 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const run = tool => pg.evaluate(t => window.__sketchforge.scope(`(t => {
    newDocument(2894, 4093, 1, 12, false, 'Speed'); selectTool(t); fit();
    if (t === 'blend') Object.assign(settings[t], { paint: 0.5, paintDensity: 0.5 }); // a paint (colour-mixing) brush, like many imported tools
    const vp = document.querySelector('#viewport'), R = vp.getBoundingClientRect(), cx = R.left + R.width / 2, cy = R.top + R.height / 2;
    let n = 0, inDab = 0; const s0 = smudgeStamp; smudgeStamp = function () { n++; const a = performance.now(); const r = s0.apply(this, arguments); inDab += performance.now() - a; return r; };
    const ev = (type, x, y) => vp.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', pressure: 0.6, buttons: 1, bubbles: true, isPrimary: true }));
    ev('pointerdown', cx - 400, cy); const t0 = performance.now();
    for (let i = 1; i <= 40; i++) ev('pointermove', cx - 400 + i * 20, cy + Math.sin(i / 4) * 100);
    const ms = performance.now() - t0; ev('pointerup', cx + 400, cy); smudgeStamp = s0;
    return { dabs: n, ms: Math.round(ms), perDab: +(inDab / Math.max(1, n)).toFixed(4) };
  })`)(t), tool);
  for (const t of ['blend', 'finger', 'blurtool']) {
    const r = await run(t); console.log('    ', t, JSON.stringify(r));
    check(`${t}: one dab under 0.12 ms on a 2894×4093 page`, r.dabs > 200 && r.perDab < 0.12);
  }
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done(); process.exit(ok.every(Boolean) && !errors.length ? 0 : 1);
})();
