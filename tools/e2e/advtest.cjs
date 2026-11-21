// Advanced tool setup (Tool Property › Advanced setup): every quick setup draws on several tools, each stroke
// quality draws, Reset this tool brings the first settings back, no JS errors.
const H = require('./harness.cjs');
(async () => {
  const root = process.argv[2];
  const { pg, errors, done } = await H.open(root, 8905, { width: 1300, height: 860 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  await pg.evaluate(() => { const SF = window.__sketchforge; SF.newDocument(900, 1200, 1, 12, false, 'T'); SF.CMD.layerAdd(); });
  const ink = () => pg.evaluate(() => { const c = window.__sketchforge.activeLayer().cels.get(0), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; });
  const stroke = async y => { const a = await ink(); await pg.strokeDoc([[80, y], [300, y + 30], [600, y - 10], [820, y]]); await pg.waitForTimeout(80); return (await ink()) - a; };
  const tools = await pg.evaluate(() => ['pen', 'pencil', 'brush', 'airbrush'].filter(t => window.__sketchforge.settings[t]));
  let y = 40;
  for (const t of tools) {
    await pg.evaluate(t => { window.__sketchforge.selectTool(t); window.__sketchforge.settings[t].size = 14; try { localStorage.setItem('sketchforge.tooladv.v1', '1'); } catch (e) {} window.__sketchforge.scope('refreshProps()'); }, t);
    const n = await pg.$$eval('#propBody .advbox .btnrow', r => r[0].children.length);
    check(`${t}: Advanced setup shows 4 quick setups`, n === 4);
    for (let i = 0; i < n; i++) {
      await pg.evaluate(i => document.querySelector('#propBody .advbox .btnrow').children[i].click(), i);
      await pg.evaluate(t => { window.__sketchforge.settings[t].size = 14; }, t);
      const d = await stroke(y); y += 34; if (y > 1150) { await pg.evaluate(() => window.__sketchforge.CMD.layerAdd()); y = 40; }
      check(`${t}: quick setup ${i + 1} draws (${d} px)`, d > 50);
    }
  }
  for (const [i, q] of [[1, 'fast'], [3, 'best'], [2, 'normal']]) {
    await pg.click(`#propBody .advbox .seg button:nth-child(${i})`);
    const d = await stroke(y); y += 34;
    check(`stroke quality ${q} draws (${d} px)`, d > 50 && await pg.evaluate(() => localStorage.getItem('sketchforge.quality.v1')) === q);
  }
  const reset = await pg.evaluate(() => { const SF = window.__sketchforge, t = SF.state.tool; SF.settings[t].hardness = 0.123; [...document.querySelectorAll('#propBody .advbox button')].find(b => b.textContent.includes('Reset')).click(); return SF.settings[t].hardness !== 0.123; });
  check('Reset this tool', reset);
  check('no JS errors', !errors.length); if (errors.length) console.log(errors);
  await done();
  const pass = ok.every(Boolean); console.log(pass ? 'PASS' : 'FAIL'); process.exit(pass ? 0 : 1);
})();
