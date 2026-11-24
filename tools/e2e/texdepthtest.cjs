// Brush textures, more control (p10zbj): pressure on whole-stroke textures, texture grows with brush size,
// second texture, live preview in Tool Property, brush editor fields.
const H = require('./harness.cjs');
const path = require('path');
(async () => {
  const root = process.argv[2], out = process.argv[3] || '/tmp';
  const { pg, errors, done } = await H.open(root, 8926, { width: 1300, height: 860 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const S = src => pg.evaluate(s => window.__sketchforge.scope(s), src);
  await S("newDocument(1000, 700, 1, 12, false, 'Tex'); setColor('#000000')");
  const stat = (y) => S(`(() => { const d = activeLayer().cels.get(0).getContext('2d').getImageData(300, ${y - 8}, 400, 16).data; let s = 0, n = 0, holes = 0; const row = []; for (let i = 3; i < d.length; i += 4) { s += d[i]; n++; if (d[i] < 100) holes++; if (i < 1600) row.push(d[i]); } return { mean: Math.round(s / n), holes: Math.round(holes / n * 100), row }; })()`);
  const diff = (a, b) => Math.round(a.row.reduce((t, v, i) => t + Math.abs(v - b.row[i]), 0) / a.row.length);
  const set = extra => S(`(() => { selectTool('marker'); const s = settings.marker; Object.assign(s, { size: 40, pSize: false, opacity: 1, flow: 1, tex: 'sponge', texAmt: 1, texScale: 1, texContrast: 0, texBright: 0, texInv: false, texMode: '', texPress: 0, texSizeLink: false, texRefSize: undefined, tex2: undefined, tex2Amt: 1, tex2Scale: 1 }, ${JSON.stringify(extra || {})}); refreshProps(); })()`);
  const pen = async (y, pr) => { await S("CMD.layerAdd()"); const pts = []; for (let i = 0; i <= 10; i++) { const c = await pg.d2c(150 + i * 70, y); pts.push([c[0], c[1], pr]); } const cdp = await pg.context().newCDPSession(pg); const ev = (type, p) => cdp.send('Input.dispatchMouseEvent', { type, x: p[0], y: p[1], force: p[2], button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, pointerType: 'pen', clickCount: 1 }); await ev('mousePressed', pts[0]); for (const p of pts.slice(1)) await ev('mouseMoved', p); await ev('mouseReleased', pts[pts.length - 1]); await pg.waitForTimeout(250); };
  // whole stroke + press harder
  await set({ texPress: 1 });
  await pen(150, 0.15); const soft = await stat(150);
  await pen(150, 1.0); const hard = await stat(150);
  await set({ texPress: 0 }); await pen(150, 1.0); const off = await stat(150);
  console.log('     whole stroke: light ' + soft.mean + ' / ' + soft.holes + '%, hard ' + hard.mean + ' / ' + hard.holes + '%, setting off ' + off.mean);
  check('whole-stroke texture: pressing harder fills the grain in', hard.mean > soft.mean + 15 && hard.holes < soft.holes);
  check('with the setting off, pressure does not change the grain', Math.abs(off.mean - soft.mean) < 25);
  // grows with brush size
  await set({ texSizeLink: true, texRefSize: 40, size: 40 }); await pen(300, 0.8); const s40 = await stat(300);
  await set({ texSizeLink: true, texRefSize: 40, size: 40, texScale: 1 }); await S("settings.marker.size = 40"); await pen(300, 0.8); const same = await stat(300);
  const scaleIn = await S("(() => { const s = { ...settings.marker, size: 120 }; paperGrain(s, false, false, false); return s.texScale; })()");
  console.log('     linked scale at size 120: ' + scaleIn);
  check('texture grows with the brush size (scale ×3 at 3× the size)', Math.abs(scaleIn - 3) < 1e-6 && diff(s40, same) < 5);
  check("the tool's own scale is not changed", await S('settings.marker.texScale') === 1);
  // second texture
  await set({ tex: 'linen' }); await pen(450, 0.8); const one = await stat(450);
  await set({ tex: 'linen', tex2: 'crackle' }); await pen(450, 0.8); const two = await stat(450);
  console.log('     linen ' + one.mean + ', linen + crackle ' + two.mean);
  check('second texture adds its grain (less paint, different pattern)', two.mean < one.mean - 10 && diff(one, two) > 15);
  await set({ tex: 'sponge', texMode: 'dab', tex2: 'crackle' }); await pen(550, 0.8); const dab2 = await stat(550);
  check('second texture with "on each dab" draws', dab2.mean > 10);
  // Tool Property: live preview, size link, second texture
  await set({ tex: 'linen', tex2: 'crackle' });
  await pg.waitForTimeout(200);
  const tp = await pg.evaluate(() => { const b = document.querySelector('#propBody'), c = b.querySelector('canvas.texpreview'); let ink = 0; if (c) { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 0; i < d.length; i += 4) if (d[i] < 128) ink++; } return { has: !!c, ink, txt: b.textContent }; });
  check('Tool Property: live preview stroke', tp.has && tp.ink > 200);
  check('Tool Property: size link, second texture and its sliders, press harder always shown', /Grows with the brush size/.test(tp.txt) && /Second texture/.test(tp.txt) && /Second strength/.test(tp.txt) && /Press harder/.test(tp.txt));
  const ink1 = tp.ink;
  await pg.evaluate(() => { const r = [...document.querySelectorAll('#propBody label.slider')].find(l => /Second strength/.test(l.textContent)).querySelector('input'); r.value = 0; r.dispatchEvent(new Event('input', { bubbles: true })); });
  await pg.waitForTimeout(300);
  const ink2 = await pg.evaluate(() => { const c = document.querySelector('#propBody canvas.texpreview'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 128) n++; return n; });
  console.log('     preview ink ' + ink1 + ' → ' + ink2);
  check('the preview follows the settings', ink2 > ink1 + 50);
  check('brush editor: the new fields', await S("['texSizeLink', 'tex2', 'tex2Amt', 'tex2Scale'].every(k => BE_FORM.find(x => x[0] === 'Texture')[1].some(f => f[0] === k) && BRUSH_KEYS.includes(k))"));
  await pg.screenshot({ path: path.join(out, 'texdepth.png') });
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
