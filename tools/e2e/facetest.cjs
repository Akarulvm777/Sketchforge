// Face sliders (Live2D-style): mark eyes / mouth / smile / brow with a box on the canvas, sliders deform the drawing,
// a face key on another frame makes smooth in-betweens, Blink here, undo, save / open.
const H = require('./harness.cjs');
const path = require('path');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, errors, done } = await H.open(root, 8864, { width: 1300, height: 860 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  await pg.evaluate(() => { const SF = window.__sketchforge; SF.newDocument(300, 300, 12, 12, false, 'Face'); SF.CMD.layerAdd(); });
  await pg.evaluate(() => document.querySelector('#modeSwitch [data-mode="anim"]').click()); await pg.waitForTimeout(300);
  // a face: two eyes (white with a dark outline and pupil), a brow, a mouth line
  await pg.evaluate(() => {
    const SF = window.__sketchforge, c = SF.activeLayer().cels.get(0), g = c.getContext('2d');
    for (const x of [100, 200]) { g.fillStyle = '#fff'; g.strokeStyle = '#111'; g.lineWidth = 4; g.beginPath(); g.ellipse(x, 120, 26, 18, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = '#2050c0'; g.beginPath(); g.arc(x, 120, 9, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#111'; g.fillRect(75, 80, 50, 5);
    g.fillRect(120, 200, 60, 4);
    c._ink = true; c._sv = (c._sv || 0) + 1; SF.refreshAll && SF.refreshAll();
  });
  await pg.evaluate(() => window.__sketchforge.CMD.faceSliders()); await pg.waitForTimeout(200);
  check('the Face sliders panel opens with how-to', await pg.isVisible('#facePanel') && /Draw a face/.test(await pg.textContent('#facePanel')));
  const box = async (kind, x0, y0, x1, y1) => {
    await pg.click(`#facePanel .fc-add button:text("${kind}")`); await pg.waitForTimeout(100);
    const a = await pg.d2c(x0, y0), b = await pg.d2c(x1, y1);
    await pg.mouse.move(a[0], a[1]); await pg.mouse.down(); await pg.mouse.move((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); await pg.mouse.move(b[0], b[1]); await pg.mouse.up(); await pg.waitForTimeout(150);
  };
  await box('Eye', 70, 98, 130, 142); await box('Eye', 170, 98, 230, 142); await box('Mouth', 112, 190, 188, 212); await box('Brow', 70, 74, 130, 90);
  const parts = await pg.evaluate(() => window.__sketchforge.activeLayer().faceParts.map(p => [p.kind, p.name, p.x, p.y, p.w, p.h]));
  console.log('     ' + JSON.stringify(parts));
  check('dragging boxes on the canvas adds the parts', parts.length === 4 && parts[0][1] === 'Eye (left)' && parts[1][1] === 'Eye (right)' && Math.abs(parts[0][2] - 70) <= 2 && Math.abs(parts[2][3] - 190) <= 2);
  check('…one slider per part', (await pg.$$('#facePanel .fc-row input[type=range]')).length === 4);
  const a = (x, y, f) => pg.evaluate(([x, y, f]) => { const SF = window.__sketchforge, l = SF.activeLayer(); let k = null; for (const q of l.cels.keys()) if (q <= f && (k === null || q > k)) k = q; return [...l.cels.get(k).getContext('2d').getImageData(x, y, 1, 1).data]; }, [x, y, f]);
  const setSlider = (i, v) => pg.evaluate(([i, v]) => { const r = document.querySelectorAll('#facePanel .fc-row input[type=range]')[i]; r.value = v; r.dispatchEvent(new Event('input')); r.value = v; r.dispatchEvent(new Event('change')); }, [i, v]);
  // close the left eye on frame 0
  check('before: the pupil is there', (await a(100, 120, 0))[2] > 150);
  await setSlider(0, 0);
  const eyeL = await a(100, 120, 0), eyeR = await a(200, 120, 0), above = await a(100, 106, 0);
  console.log("     eye", JSON.stringify([eyeL, eyeR, above]));
  check('Eye slider 0 closes that eye (a dark line), the other stays open', eyeL[3] > 200 && eyeL[0] < 90 && eyeR[2] > 150 && above[3] === 0);
  await pg.evaluate(() => window.__sketchforge.CMD.undo()); await pg.waitForTimeout(100);
  check('undo opens it again', (await a(100, 120, 0))[2] > 150);
  // mouth open
  await setSlider(2, 1);
  const inside = await a(150, 212, 0), lower = await pg.evaluate(() => { const SF = window.__sketchforge, c = SF.activeLayer().cels.get(0), d = c.getContext('2d').getImageData(150, 200, 1, 60).data; let last = -1; for (let i = 0; i < 60; i++) if (d[i * 4 + 3] > 200 && d[i * 4] < 40) last = i; return 200 + last; });
  check('Mouth slider opens the mouth: dark-red inside, lower lip moved down', inside[0] > 80 && inside[1] < 60 && inside[3] === 255 && lower > 215);
  check('…and it is a face key', await pg.evaluate(() => { const c = window.__sketchforge.activeLayer().cels.get(0); return !!(c._face && c._face.rest && !c._face.auto); }));
  // frame 8: mouth closed again → in-betweens 1..7
  await pg.evaluate(() => window.__sketchforge.gotoFrame(8)); await pg.waitForTimeout(100);
  await setSlider(2, 0);
  const tw = await pg.evaluate(() => { const l = window.__sketchforge.activeLayer(), ids = l.faceParts.map(p => p.id); return [1, 2, 3, 4, 5, 6, 7].map(f => { const c = l.cels.get(f); return c && c._face && c._face.auto ? +c._face.v[ids[2]].toFixed(2) : null; }); });
  console.log('     mouth in-betweens ' + JSON.stringify(tw));
  check('another face key makes smooth in-betweens (mouth closes little by little)', tw.every(v => v !== null) && tw.every((v, i) => i === 0 || v <= tw[i - 1]) && tw[0] > 0.9 && tw[6] < 0.1);
  check('…frame 4 is half open', await (async () => { const p = await a(150, 208, 4); return p[3] === 255 && p[0] > 80 && p[1] < 60; })());
  // blink at frame 2: eyes closed on frame 4
  await pg.evaluate(() => window.__sketchforge.gotoFrame(2)); await pg.click('#facePanel .fc-blink'); await pg.waitForTimeout(200);
  const bl = await pg.evaluate(() => { const l = window.__sketchforge.activeLayer(), e = l.faceParts[0].id, v = f => { const c = l.cels.get(f); return c && c._face ? +c._face.v[e].toFixed(2) : null; }; return [v(2), v(3), v(4), v(5), v(6)]; });
  console.log('     blink ' + JSON.stringify(bl));
  check('👁 Blink here: open → closed → open', bl[0] === 1 && bl[2] === 0 && bl[4] === 1 && bl[1] > 0 && bl[1] < 1);
  check('…the mouth keeps its in-between values during the blink', await pg.evaluate(() => { const l = window.__sketchforge.activeLayer(), m = l.faceParts[2].id; return l.cels.get(4)._face.v[m] > 0.2; }));
  // brow up on frame 8
  await pg.evaluate(() => window.__sketchforge.gotoFrame(8)); await setSlider(3, 1);
  check('Brow slider moves the brow up', (await a(100, 82, 8))[3] === 0 && (await pg.evaluate(() => { const d = window.__sketchforge.activeLayer().cels.get(8).getContext('2d').getImageData(100, 60, 1, 22).data; for (let i = 0; i < 22; i++) if (d[i * 4 + 3] > 200) return true; return false; })));
  await pg.screenshot({ path: out + '/face.png' });
  // save and open
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.evaluate(() => window.__sketchforge.CMD.save())]);
  const fl = path.join(out, 'face.sketchforge'); await dl.saveAs(fl);
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.evaluate(() => window.__sketchforge.CMD.open())]);
  await fc.setFiles(fl); await pg.waitForTimeout(1500);
  const re = await pg.evaluate(() => { const L = window.__sketchforge.state.layers.find(l => l.faceParts && l.faceParts.length); if (!L) return null; const c0 = L.cels.get(0), c4 = L.cels.get(3); return { n: L.faceParts.length, k0: !!(c0._face && !c0._face.auto), shared: c0._face.rest === L.cels.get(8)._face.rest, auto4: !!(c4 && c4._face && c4._face.auto) }; });
  console.log("     re", JSON.stringify(re));
  check('saved and opened: parts, face keys, shared original, in-betweens', re && re.n === 4 && re.k0 && re.shared && re.auto4);
  await pg.evaluate(() => window.__sketchforge.gotoFrame(0)); await pg.evaluate(() => window.__sketchforge.CMD.faceSliders && 0);
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
