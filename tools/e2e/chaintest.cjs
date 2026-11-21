// Hair & cloth bones (Bone › Hair & cloth): click points along the hair with the tool, the body moves → the hair
// drawing BENDS (lags, swings, settles); frame 0 and the pixels are untouched; the stage and exports show the bent
// drawing; undo removes a point; saved in the file.
const H = require('./harness.cjs');
const path = require('path');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, errors, done } = await H.open(root, 8906, { width: 1300, height: 860 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const ids = await pg.evaluate(() => {
    const SF = window.__sketchforge; SF.newDocument(400, 400, 30, 12, false, 'Chain');
    const mk = (name, x, y, w, h, col) => { SF.CMD.layerAdd(); const l = SF.activeLayer(); l.name = name; const g = l.cels.get(0).getContext('2d'); g.fillStyle = col; g.fillRect(x, y, w, h); l.cels.get(0)._ink = true; return l; };
    const body = mk('Body', 150, 80, 100, 160, '#333'), hair = mk('Hair', 235, 90, 24, 200, '#c33');
    return { body: body.id, hair: hair.id };
  });
  await pg.evaluate(i => { const SF = window.__sketchforge, L = SF.state.layers, body = L.find(l => l.id === i.body), hair = L.find(l => l.id === i.hair);
    SF.scope('setLayerParent')(hair, body.id); hair.px = 247; hair.py = 90;
    SF.state.activeId = body.id; SF.gotoFrame(6); SF.insertKeyframe(false); body.cels.get(6)._xf = { x: 120, y: 0, rot: 0, sx: 1, sy: 1, alpha: 1 };
    body.cels.get(0)._xf = { x: 0, y: 0, rot: 0, sx: 1, sy: 1, alpha: 1, tween: true, ease: 0 }; SF.gotoFrame(0); SF.state.activeId = hair.id; SF.selectTool('bonechain'); }, ids);
  check('the tool is in the Bone group', await pg.evaluate(() => window.__sketchforge.scope('GROUPS').find(g => g.id === 'bone').subs.includes('bonechain')));
  for (const y of [92, 140, 190, 240, 285]) { const [cx, cy] = await pg.d2c(247, y); await pg.mouse.click(cx, cy); await pg.waitForTimeout(60); }
  const n = await pg.evaluate(id => window.__sketchforge.state.layers.find(l => l.id === id).chain.pts.length, ids.hair);
  check(`clicking along the hair makes a chain (${n} points)`, n === 5);
  const tip = await pg.evaluate(id => { const SF = window.__sketchforge, h = SF.state.layers.find(l => l.id === id); return Array.from({ length: 30 }, (_, f) => +SF.scope('chainAt')(h, f)[4][0].toFixed(1)); }, ids.hair);
  console.log('     tip x per frame: ' + tip.join(' '));
  check('frame 0 is the drawing as made', Math.abs(tip[0] - 247) < 1);
  check('the tip lags behind while the body moves', Math.min(...tip.slice(1, 7)) < 240);
  check('…swings past and settles back', Math.max(...tip.slice(6, 20)) > 252 && Math.abs(tip[29] - 247) < Math.abs(Math.min(...tip.slice(1, 7)) - 247));
  // the stage shows a bent view on frame 4; exports bend too; the cel pixels are untouched
  const st = await pg.evaluate(id => { const SF = window.__sketchforge, h = SF.state.layers.find(l => l.id === id); SF.selectTool('bonechain'); SF.gotoFrame(4); SF.scope('refreshAll()');
    const v = h._chainView, shown = !!(v && v.parentNode && h.canvas.style.display === 'none' && v.style.display !== 'none');
    const comp = SF.compositeFrame(4).getContext('2d'), cel = h.cels.get(0).getContext('2d');
    const bentInk = [...comp.getImageData(0, 0, 400, 400).data].filter((x, i) => i % 4 === 0 && x > 180).length; // red channel of the hair
    const celSame = cel.getImageData(240, 280, 1, 1).data[3] === 255;
    // the hair's lower end in the export is no longer where it is drawn on the moved body (x 235+~72…)
    return { shown, celSame, bentInk }; }, ids.hair);
  console.log('     ' + JSON.stringify(st));
  check('the stage shows the bent hair', st.shown);
  check('the drawing itself is not changed', st.celSame);
  const diff = await pg.evaluate(id => { const SF = window.__sketchforge, h = SF.state.layers.find(l => l.id === id);
    const a = SF.compositeFrame(4).getContext('2d').getImageData(0, 0, 400, 400).data; const keep = h.chain; h.chain = null; h._chainCache = null; SF.scope('refreshAll()');
    const b = SF.compositeFrame(4).getContext('2d').getImageData(0, 0, 400, 400).data; h.chain = keep; SF.scope('refreshAll()'); let d = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 60) d++; return d; }, ids.hair);
  check(`exports show the bent hair (${diff} px differ)`, diff > 200);
  // undo removes the last point
  await pg.evaluate(() => window.__sketchforge.CMD.undo());
  check('undo removes the last point', await pg.evaluate(id => window.__sketchforge.state.layers.find(l => l.id === id).chain.pts.length === 4, ids.hair));
  await pg.evaluate(() => window.__sketchforge.CMD.redo());
  // settings in Tool Property
  check('Tool Property: strength, damping, gravity, wind', await pg.evaluate(() => { const t = document.querySelector('#propBody').textContent; return /Strength/.test(t) && /Damping/.test(t) && /Gravity/.test(t) && /Wind/.test(t); }));
  // play a few frames: no errors
  await pg.evaluate(() => window.__sketchforge.scope('play')()); await pg.waitForTimeout(800); await pg.evaluate(() => window.__sketchforge.scope('stop')());
  // save / open
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.evaluate(() => window.__sketchforge.CMD.save())]);
  const fl = path.join(out, 'chain.sketchforge'); await dl.saveAs(fl);
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.evaluate(() => window.__sketchforge.CMD.open())]);
  await fc.setFiles(fl); await pg.waitForTimeout(1200);
  check('saved and opened: the chain is kept', await pg.evaluate(() => { const h = window.__sketchforge.state.layers.find(l => l.name === 'Hair'); return !!(h && h.chain && h.chain.pts.length === 5); }));
  // practice model: hair and cape with bones, the body sways, they bend
  await pg.evaluate(() => window.__sketchforge.CMD.chainPractice()); await pg.waitForTimeout(1200);
  const pr = await pg.evaluate(() => { const SF = window.__sketchforge; SF.scope('stop()'); const L = SF.state.layers, h = L.find(l => l.name === 'Hair'), c = L.find(l => l.name === 'Cape');
    const ch = SF.scope('chainAt'); return { hair: !!(h && h.chain), cape: !!(c && c.chain), bend: Math.abs(ch(h, 12)[4][0] - h.chain.pts[4][0]) + Math.abs(ch(c, 12)[4][0] - c.chain.pts[4][0]), tool: SF.state.tool }; });
  console.log('     ' + JSON.stringify(pr));
  check('practice model: hair and cape have bones and bend while the body sways', pr.hair && pr.cape && pr.bend > 10 && pr.tool === 'bonechain');
  check('Spine-like settings (inertia, strength, damping, mass, gravity, wind, mix) and ready settings', await pg.evaluate(() => { const t = document.querySelector('#propBody').textContent; return ['Inertia', 'Strength', 'Damping', 'Mass', 'Gravity', 'Wind', 'Mix', 'Ready setting'].every(w => t.includes(w)); }));
  // skeleton tree: main part on top, parts indented under what they follow
  const tree = await pg.evaluate(() => { const SF = window.__sketchforge; SF.selectTool('bone'); return [...document.querySelectorAll('#skelTree .skelrow')].map(r => parseInt(r.style.paddingLeft) + ':' + r.querySelector('.sk-name').textContent); });
  console.log('     tree: ' + tree.join(' | '));
  check('skeleton tree: ★ main part first, Head under Body, Hair under Head', tree[0] === '6:Body' && tree.includes('20:Head') && tree.includes('34:Hair') && tree.includes('20:Cape'));
  check('only one main part', await pg.evaluate(() => { const SF = window.__sketchforge, L = SF.state.layers; SF.state.activeId = L.find(l => l.name === 'Head').id; SF.CMD.mainPart(); return L.filter(l => l.mainPart).length === 1 && L.find(l => l.name === 'Head').mainPart; }));
  check('tutorial "Rig like Spine" is in the list', await pg.evaluate(() => window.__sketchforge.scope('TUTORIALS').some(t => t.id === 'spinerig')));
  // pose the bones (Pose bones mode): drag a point → a pose key on this frame; bones after it follow; physics on top
  await pg.evaluate(() => { const SF = window.__sketchforge; SF.CMD.chainPractice(); });
  await pg.waitForTimeout(900);
  await pg.evaluate(() => { const SF = window.__sketchforge; SF.scope('stop()'); SF.gotoFrame(0); const h = SF.state.layers.find(l => l.name === 'Hair'); SF.state.activeId = h.id; SF.selectTool('bonechain'); SF.scope("CHAIN.mode = 'pose'"); SF.scope('refreshProps()'); });
  const hp = await pg.evaluate(() => { const SF = window.__sketchforge, h = SF.state.layers.find(l => l.name === 'Hair'), m = SF.layerMat(h, 0) || [1, 0, 0, 1, 0, 0]; const p = SF.scope('chainAt')(h, 0)[2]; return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]]; });
  { const a = await pg.d2c(hp[0], hp[1]), b = await pg.d2c(hp[0] + 60, hp[1] - 10); await pg.mouse.move(a[0], a[1]); await pg.mouse.down(); await pg.mouse.move(b[0], b[1], { steps: 6 }); await pg.mouse.up(); }
  const posed = await pg.evaluate(() => { const SF = window.__sketchforge, h = SF.state.layers.find(l => l.name === 'Hair'), C = h.chain, c0 = SF.scope('chainAt')(h, 0);
    return { keys: (C.poses || []).map(p => p[0]), ang: C.poses && C.poses[0][1], tipMoved: c0[4][0] - C.pts[4][0], rootSame: Math.abs(c0[0][0] - C.pts[0][0]) < 0.01 }; });
  console.log('     ' + JSON.stringify(posed));
  check('Pose bones: dragging a point makes a pose key on this frame', posed.keys.length === 1 && posed.keys[0] === 0);
  check('…the bone turns and every bone after it follows (the main bone stays attached)', posed.tipMoved > 20 && posed.rootSame && Math.abs(posed.ang[1]) > 5);
  check('…and the physics still plays on top of the pose', await pg.evaluate(() => { const SF = window.__sketchforge, h = SF.state.layers.find(l => l.name === 'Hair'), ch = SF.scope('chainAt'), P = SF.scope('chainPosed');
    const a = ch(h, 12), p = P(h.chain.pts, h.chain.poses, 12); return Math.hypot(a[4][0] - p[4][0], a[4][1] - p[4][1]) > 5; }));
  // Bone: pose tool poses chain bones too (another frame → a second key)
  await pg.evaluate(() => { const SF = window.__sketchforge; SF.gotoFrame(20); SF.selectTool('bonepose'); });
  const hp2 = await pg.evaluate(() => { const SF = window.__sketchforge, h = SF.state.layers.find(l => l.name === 'Hair'), m = SF.layerMat(h, 20) || [1, 0, 0, 1, 0, 0]; const p = SF.scope('chainAt')(h, 20)[3]; return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]]; });
  { const a = await pg.d2c(hp2[0], hp2[1]), b = await pg.d2c(hp2[0] - 50, hp2[1]); await pg.mouse.move(a[0], a[1]); await pg.mouse.down(); await pg.mouse.move(b[0], b[1], { steps: 6 }); await pg.mouse.up(); }
  check('Bone: pose turns hair bones too (second pose key)', await pg.evaluate(() => { const h = window.__sketchforge.state.layers.find(l => l.name === 'Hair'); return (h.chain.poses || []).length === 2; }));
  await pg.evaluate(() => window.__sketchforge.CMD.undo());
  check('undo removes that pose key', await pg.evaluate(() => { const h = window.__sketchforge.state.layers.find(l => l.name === 'Hair'); return (h.chain.poses || []).length === 1; }));
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done(); process.exit(ok.every(Boolean) && !errors.length ? 0 : 1);
})();
