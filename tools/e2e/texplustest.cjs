// Brush textures upgrade (p10zbi): 8 new textures, contrast / brightness / invert on built-in textures, texture on
// each dab with pressure depth, Tool Property swatch and controls, brush editor list.
const H = require('./harness.cjs');
const path = require('path');
(async () => {
  const root = process.argv[2], out = process.argv[3] || '/tmp';
  const { pg, errors, done } = await H.open(root, 8925, { width: 1300, height: 860 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const S = src => pg.evaluate(s => window.__sketchforge.scope(s), src);
  await S("newDocument(1000, 700, 1, 12, false, 'Tex'); setColor('#000000')");
  const line = async (y, pr) => { const p = []; for (let i = 0; i <= 10; i++) p.push([150 + i * 70, y, pr]); await pg.strokeDoc(p.map(q => [q[0], q[1]])); };
  const stat = (y) => S(`(() => { const d = activeLayer().cels.get(0).getContext('2d').getImageData(300, ${y - 8}, 400, 16).data; let s = 0, n = 0, holes = 0; const row = []; for (let i = 3; i < d.length; i += 4) { s += d[i]; n++; if (d[i] < 100) holes++; if (i < 1600) row.push(d[i]); } return { mean: Math.round(s / n), holes: Math.round(holes / n * 100), row }; })()`);
  const diff = (a, b) => Math.round(a.row.reduce((t, v, i) => t + Math.abs(v - b.row[i]), 0) / a.row.length);
  const use = async (tex, extra) => S(`(() => { CMD.layerAdd(); selectTool('marker'); const s = settings.marker; Object.assign(s, { size: 40, pSize: false, opacity: 1, flow: 1, tex: ${JSON.stringify(tex)}, texAmt: 1, texScale: 1, texContrast: 0, texBright: 0, texInv: false, texMode: '', texPress: 0 }, ${JSON.stringify(extra || {})}); refreshProps(); })()`);
  // every new texture draws with grain
  const res = {};
  for (const t of ['linen', 'coldpress', 'sponge', 'crackle', 'sand', 'wood', 'kraft', 'finenoise']) { await use(t); await line(200); res[t] = await stat(200); }
  console.log('     ' + JSON.stringify(Object.fromEntries(Object.entries(res).map(([k, v]) => [k, v.mean + '/' + v.holes + '%']))));
  check('8 new textures, each leaves grain in the stroke', Object.values(res).every(r => r.mean > 20 && r.mean < 250 && r.holes > 2));
  // contrast / invert change a built-in texture
  await use('paper'); await line(300); const base = await stat(300);
  await use('paper', { texBright: 60 }); await line(300); const bright = await stat(300);
  await use('paper', { texInv: true }); await line(300); const inv = await stat(300);
  console.log('     paper mean ' + [base.mean, bright.mean, inv.mean] + ', invert changes pixels by ' + diff(base, inv));
  check('brightness on a built-in texture: more paint', bright.mean > base.mean + 20);
  check('invert on a built-in texture swaps grain and gaps', diff(base, inv) > 40);
  // the tool's own settings keep the plain texture (the stroke used a derived copy)
  check("the tool's texture setting is not changed by a stroke", await S('settings.marker.tex') === 'paper');
  // each dab + pressure: harder = less grain
  const pen = async (y, pr) => { await S("CMD.layerAdd()"); const pts = []; for (let i = 0; i <= 10; i++) { const c = await pg.d2c(150 + i * 70, y); pts.push([c[0], c[1], pr]); } const cdp = await pg.context().newCDPSession(pg); const ev = (type, p) => cdp.send('Input.dispatchMouseEvent', { type, x: p[0], y: p[1], force: p[2], button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, pointerType: 'pen', clickCount: 1 }); await ev('mousePressed', pts[0]); for (const p of pts.slice(1)) await ev('mouseMoved', p); await ev('mouseReleased', pts[pts.length - 1]); await pg.waitForTimeout(250); };
  await S(`(() => { selectTool('marker'); Object.assign(settings.marker, { tex: 'sponge', texMode: 'dab', texPress: 1, texAmt: 1, size: 40, pSize: false }); })()`);
  await pen(450, 0.15); const soft = await stat(450);
  await pen(450, 1.0); const hard = await stat(450);
  console.log('     each dab: light ' + soft.mean + ', hard ' + hard.mean);
  check('texture on each dab: pressing harder fills the grain in', hard.mean > soft.mean + 15);
  // Tool Property
  await S("selectTool('marker'); settings.marker.tex = 'crackle'; settings.marker.texMode = ''; refreshProps()");
  const tp = await pg.evaluate(() => { const b = document.querySelector('#propBody'); return { swatch: !!b.querySelector('.texswatch canvas'), txt: b.textContent, opts: [...b.querySelectorAll('select option')].map(o => o.textContent) }; });
  check('Tool Property: texture picture, rotation, contrast, brightness, invert, each dab', tp.swatch && /Rotation/.test(tp.txt) && /Contrast/.test(tp.txt) && /Invert the texture/.test(tp.txt) && /each dab/.test(tp.txt));
  check('the texture list has the new textures', ['Linen', 'Sponge', 'Crackle', 'Wood grain', 'Pastel paper (laid lines)', 'Dry brush streaks', 'Hatching', 'Burlap', 'Concrete'].every(n => tp.opts.includes(n)));
  check('brush editor knows them too', await S("BE_TEX.some(x => x[0] === 'kraft') && BE_FORM.find(x => x[0] === 'Texture')[1].some(f => f[0] === 'texMode')"));
  await pg.screenshot({ path: path.join(out, 'texplus.png') });
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
