// Every tool in the palette: does it do its job, can it be undone, and does it run without JS errors?
const H = require('./harness.cjs');
(async () => {
  const root = process.argv[2], out = process.argv[3], only = process.argv[4];
  const { pg, errors, done } = await H.open(root, 8779);
  const E = (f, a) => pg.evaluate(f, a);
  pg.on('dialog', d => d.accept());
  await E(() => window.__sketchforge.newDocument(800, 600, 1, 12, false, 'Sweep'));
  await pg.waitForTimeout(400);
  const stats = () => E(() => { const SF = window.__sketchforge, l = SF.activeLayer(), c = l.cels.get(0) || [...l.cels.values()][0], d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0, h = 0; for (let i = 0; i < d.length; i += 8) { if (d[i + 3] > 20) n++; h = (h + d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7 + d[i + 3] * 11) % 1000000007; } return { n, h }; });
  const fresh = async prefill => {
    await E(() => { const SF = window.__sketchforge; SF.CMD.deselect && SF.CMD.deselect(); SF.CMD.layerAdd(); });
    if (prefill) await E(() => { const SF = window.__sketchforge, c = SF.activeLayer().cels.get(0), g = c.getContext('2d'); g.fillStyle = '#d02020'; g.fillRect(150, 150, 250, 300); g.fillStyle = '#2040d0'; g.fillRect(400, 150, 250, 300); c._ink = true; c._bb = undefined; SF.gotoFrame(0); });
    await pg.waitForTimeout(60);
  };
  const stroke = async (pts) => { const c = []; for (const [x, y] of pts) c.push(await pg.d2c(x, y)); await pg.mouse.move(c[0][0], c[0][1]); await pg.mouse.down(); for (const q of c.slice(1)) await pg.mouse.move(q[0], q[1], { steps: 8 }); await pg.mouse.up(); await pg.waitForTimeout(120); };
  const click = async (x, y) => { const c = await pg.d2c(x, y); await pg.mouse.click(c[0], c[1]); await pg.waitForTimeout(150); };
  const dbl = async (x, y) => { const c = await pg.d2c(x, y); await pg.mouse.dblclick(c[0], c[1]); await pg.waitForTimeout(150); };
  const undo = async () => { await pg.keyboard.press('Control+z'); await pg.waitForTimeout(120); };
  const zig = [[200, 200], [300, 380], [400, 220], [500, 400], [600, 250]];
  const tools = await E(() => { const SF = window.__sketchforge; return SF.GROUPS.filter(g => g.subs).flatMap(g => g.subs.map(id => ({ id, g: g.id, kind: SF.TOOLDEF[id].kind, erase: !!SF.TOOLDEF[id].erase, smudge: !!(SF.TOOLDEF[id].preset && SF.TOOLDEF[id].preset.smudge != null), name: SF.TOOLDEF[id].name }))); });
  const results = [];
  for (const t of tools) {
    if (only && !t.id.includes(only)) continue;
    const e0 = errors.length; let ok = true, note = '';
    const fail = m => { ok = false; note += m + '; '; };
    try {
      const needPaint = t.erase || t.smudge || ['liquify', 'pick', 'move', 'puppet'].includes(t.id) || t.g === 'wand';
      await fresh(needPaint || t.id === 'gerase');
      await E(id => window.__sketchforge.selectTool(id), t.id);
      const s0 = await stats();
      if (t.kind === 'brush' && !t.erase && !t.smudge) {
        await stroke(zig); const s1 = await stats();
        if (s1.n < 30) fail('no ink (' + s1.n + ')');
        await undo(); if ((await stats()).n !== 0) fail('undo left ink');
      } else if (t.kind === 'brush' && (t.erase || t.smudge)) {
        await stroke([[200, 300], [380, 300], [420, 300], [600, 300]]); const s1 = await stats();
        if (t.erase ? s1.n >= s0.n - 50 : s1.h === s0.h) fail(t.erase ? `erased too little (${s0.n}->${s1.n})` : 'no change');
        await undo(); if ((await stats()).h !== s0.h) fail('undo did not restore');
      } else if (t.kind === 'shape' || t.kind === 'lassofill') {
        await stroke(t.kind === 'shape' ? [[200, 200], [500, 420]] : [[200, 200], [500, 200], [500, 420], [200, 420]]); const s1 = await stats();
        if (s1.n < 30) fail('no ink');
        await undo(); if ((await stats()).n !== 0) fail('undo left ink');
      } else if (t.kind === 'poly') {
        await click(200, 200); await click(500, 220); await click(450, 420); await dbl(250, 400); const s1 = await stats();
        if (s1.n < 30) fail('no ink');
      } else if (t.kind === 'fill') {
        { await E(() => window.__sketchforge.selectTool('pen')); await stroke([[200, 200], [600, 200], [600, 450], [200, 450], [200, 200]]); await E(id => window.__sketchforge.selectTool(id), t.id); }
        const a = await stats(); await click(400, 320); const s1 = await stats();
        if (s1.n < a.n + 1000) fail(`fill too small (${a.n}->${s1.n})`);
        await undo(); if ((await stats()).n !== a.n) fail('undo did not restore');
      } else if (t.kind === 'gradient') {
        await stroke([[150, 300], [650, 300]]); const s1 = await stats();
        if (t.erase ? s1.n >= s0.n : s1.n < 20000) fail(`gradient result ${s0.n}->${s1.n}`);
        await undo(); if ((await stats()).h !== s0.h) fail('undo did not restore');
      } else if (t.kind === 'select') {
        if (t.id === 'selerase' || t.id === 'selshrink') { await E(() => window.__sketchforge.CMD.selectAll && window.__sketchforge.CMD.selectAll()); }
        if (t.id === 'selpoly') { await click(200, 200); await click(500, 220); await click(450, 420); await dbl(250, 400); }
        else if (t.g === 'wand') { if (t.id === 'selwandref') await E(() => { window.__sketchforge.activeLayer().ref = true; }); await click(250, 300); if (t.id === 'selwandref') await E(() => { window.__sketchforge.activeLayer().ref = false; }); }
        else await stroke(t.id === 'sellasso' || t.id === 'selpen' || t.id === 'selerase' || t.id === 'selshrink' ? [[200, 200], [500, 210], [480, 420], [210, 400]] : [[200, 200], [500, 420]]);
        const act = await E(() => window.__sketchforge.sel.active);
        if (!act) fail('no selection');
      } else if (t.kind === 'pick') {
        await E(() => window.__sketchforge.setColor('#000000')); await click(250, 300);
        const c = await E(() => window.__sketchforge.state.color); if (c.toLowerCase() !== '#d02020') fail('picked ' + c);
      } else if (t.kind === 'move') {
        await stroke([[250, 300], [330, 340]]);
        const x = await E(() => { const c = window.__sketchforge.activeLayer().cels.get(0); return c._xf ? [Math.round(c._xf.x), Math.round(c._xf.y)] : null; });
        if (!x || x[0] < 60) fail('did not move: ' + JSON.stringify(x));
        await undo();
      } else if (t.kind === 'puppet') {
        await click(250, 300); await stroke([[400, 300], [420, 360]]);
        if (!(await E(() => !!window.__sketchforge.activeLayer().cels.get(0)._pup))) fail('no pins');
      } else if (t.kind === 'dragdraw') {
        if (t.id === 'fr_cut') { await E(() => window.__sketchforge.selectTool('fr_rect')); await stroke([[150, 150], [650, 450]]); await E(() => window.__sketchforge.selectTool('fr_cut')); }
        const a = await stats();
        await stroke(t.id.startsWith('rl_') ? [[200, 300], [600, 320]] : t.id === 'liquify' ? [[300, 300], [420, 300]] : [[250, 200], [550, 420]]);
        const s1 = await stats();
        if (t.id.startsWith('bl_') || t.id === 'fr_rect' || t.id === 'fr_cut' || t.id === 'liquify') { if (s1.h === a.h) fail('no change'); }
        if (t.id.startsWith('rl_')) { await E(() => window.__sketchforge.CMD.rulerClear()); }
      } else if (t.kind === 'text') {
        await click(250, 300);
        await pg.waitForTimeout(150); await pg.keyboard.type('Hello'); await pg.keyboard.press('Enter').catch(() => {});
        if (await E(() => document.querySelector('#textDialog').open)) await E(() => document.querySelector('#textForm').requestSubmit());
        await pg.waitForTimeout(200);
        if ((await stats()).n < 30) fail('no text');
      } else if (['hand', 'rotate', 'zoom'].includes(t.kind)) {
        const v0 = await E(() => JSON.stringify(window.__sketchforge.view));
        await stroke([[300, 300], [380, 340]]);
        if (await E(() => JSON.stringify(window.__sketchforge.view)) === v0) fail('view did not change');
        await E(() => { window.__sketchforge.CMD.zoomFit(); window.__sketchforge.CMD.rotReset && window.__sketchforge.CMD.rotReset(); });
      } else note = 'not exercised';
    } catch (e) { fail('test error: ' + e.message.split('\n')[0]); }
    if (errors.length > e0) fail('JS error: ' + errors.slice(e0).join(' | ').slice(0, 200));
    await E(() => { const SF = window.__sketchforge; if (SF.CMD.deselect) SF.CMD.deselect(); });
    await pg.keyboard.press('Escape');
    results.push({ ...t, ok, note });
    console.log((ok ? 'ok   ' : 'FAIL ') + `${t.g}/${t.id} (${t.name}, ${t.kind})${note ? ' — ' + note : ''}`);
  }
  const bad = results.filter(r => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} tools OK`);
  console.log(bad.length ? 'FAIL' : 'PASS');
  await done();
})();
