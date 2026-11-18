const H = require('./harness.cjs');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, errors, done } = await H.open(root, 8782);
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const E = (f, a) => pg.evaluate(f, a);
  pg.on('dialog', d => d.accept());
  await E(() => window.__sketchforge.newDocument(1000, 600, 1, 12, false, 'Tex'));
  await pg.waitForTimeout(300);
  // alpha statistics inside a box of the active layer
  const st = (x0, y0, x1, y1) => pg.evaluate(([x0, y0, x1, y1]) => { const SF = window.__sketchforge, c = SF.activeLayer().cels.get(0), d = c.getContext('2d').getImageData(x0, y0, x1 - x0, y1 - y0).data; let s = 0, s2 = 0, n = 0, holes = 0; for (let i = 3; i < d.length; i += 4) { s += d[i]; s2 += d[i] * d[i]; n++; if (d[i] < 128) holes++; } const m = s / n; return { mean: Math.round(m), sd: Math.round(Math.sqrt(s2 / n - m * m)), holes: Math.round(holes / n * 100) }; }, [x0, y0, x1, y1]);
  const line = async (y) => { const p = []; for (let i = 0; i <= 10; i++) p.push([150 + i * 70, y]); await pg.strokeDoc(p); };
  for (const [tool, y] of [['chalk', 100], ['oilpaint', 200], ['dryink', 300]]) {
    await E(t => { const SF = window.__sketchforge; SF.CMD.layerAdd(); SF.selectTool(t); SF.settings[t].size = 40; SF.settings[t].pSize = false; }, tool);
    await line(y);
    const s = await st(300, y - 6, 700, y + 6);
    check(`${tool}: grain stays visible (alpha spread ${s.sd}, ${s.holes}% light spots)`, s.sd > 18 && s.mean < 250);
  }
  // custom image texture via the Tool Property menu
  await E(() => { const SF = window.__sketchforge; SF.CMD.layerAdd(); SF.selectTool('marker'); const s = SF.settings.marker; s.size = 50; s.pSize = false; s.opacity = 1; });
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.evaluate(() => { const sel = [...document.querySelectorAll('#propBody select')].find(s => [...s.options].some(o => o.value === '@load')); sel.value = '@load'; sel.onchange(); })]);
  await fc.setFiles(out + '/psd/stripes.png'); await pg.waitForTimeout(600);
  check('own image chosen as texture: ' + await E(() => window.__sketchforge.settings.marker.tex), (await E(() => window.__sketchforge.settings.marker.tex || '')).startsWith('tex_'));
  await line(420);
  const cols = await E(() => { const c = window.__sketchforge.activeLayer().cels.get(0), d = c.getContext('2d').getImageData(400, 420, 64, 1).data, a = []; for (let i = 3; i < d.length; i += 4) a.push(d[i] > 128 ? 1 : 0); return a.join(''); });
  check('stroke shows the image stripes: ' + cols, /1{5,}0{5,}1{5,}/.test(cols));
  // texture + selection: nothing outside the selection
  await E(() => { const SF = window.__sketchforge; SF.CMD.layerAdd(); SF.selectTool('chalk'); });
  await E(() => { const SF = window.__sketchforge, g = SF.sel.mask.getContext('2d'); g.clearRect(0, 0, 1000, 600); g.fillRect(400, 0, 200, 600); SF.sel.active = true; SF.sel.bb = { x: 400, y: 0, w: 200, h: 600 }; });
  await line(520);
  const outSel = await st(200, 510, 380, 530), inSel = await st(420, 510, 580, 530);
  check(`textured stroke respects the selection (outside ${outSel.mean}, inside ${inSel.mean})`, outSel.mean === 0 && inSel.mean > 30);
  await E(() => window.__sketchforge.CMD.deselect());
  // .sut with an embedded texture image
  const [fc2] = await Promise.all([pg.waitForEvent('filechooser'), E(() => window.__sketchforge.CMD.addSut())]);
  await fc2.setFiles(out + '/psd/tex.sut'); await pg.waitForTimeout(1200);
  const imp = await E(() => { const SF = window.__sketchforge, id = Object.keys(SF.TOOLDEF).find(k => SF.TOOLDEF[k].name === 'Stripe test brush'); return id ? { id, tex: SF.settings[id].tex, amt: SF.settings[id].texAmt } : null; });
  check('.sut brush imported with its own texture: ' + JSON.stringify(imp), imp && imp.tex && imp.tex.startsWith('tex_') && imp.amt === 1);
  await E(() => window.__sketchforge.CMD.layerAdd());
  await line(570);
  const cols2 = await E(() => { const c = window.__sketchforge.activeLayer().cels.get(0), d = c.getContext('2d').getImageData(400, 570, 64, 1).data, a = []; for (let i = 3; i < d.length; i += 4) a.push(d[i] > 128 ? 1 : 0); return a.join(''); });
  check('imported .sut brush paints with the stripes: ' + cols2, /1{5,}0{5,}1{5,}/.test(cols2));
  await pg.screenshot({ path: out + '/textures.png' });
  console.log('page errors:', errors.length ? errors : 'none');
  console.log(ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
