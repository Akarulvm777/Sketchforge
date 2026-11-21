// Easier rig: Make main part (free parts follow it) and gravity bones (hair swings when the body moves, settles,
// frame 0 untouched, keyframes untouched, saved in the file).
const H = require('./harness.cjs');
const path = require('path');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, errors, done } = await H.open(root, 8901, { width: 1300, height: 860 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const ids = await pg.evaluate(() => {
    const SF = window.__sketchforge; SF.newDocument(400, 400, 30, 12, false, 'Phys');
    const mk = (name, x, y, w, h, col) => { SF.CMD.layerAdd(); const l = SF.activeLayer(); l.name = name; const g = l.cels.get(0).getContext('2d'); g.fillStyle = col; g.fillRect(x, y, w, h); l.cels.get(0)._ink = true; return l; };
    const body = mk('Body', 150, 100, 100, 160, '#333'), hair = mk('Hair', 230, 110, 30, 110, '#a52'), arm = mk('Arm', 100, 140, 50, 20, '#777');
    return { body: body.id, hair: hair.id, arm: arm.id };
  });
  // main part = body: hair and arm follow it
  await pg.evaluate(id => { const SF = window.__sketchforge; SF.state.activeId = id; SF.CMD.mainPart(); }, ids.body);
  check('Make main part: the free parts follow it', await pg.evaluate(i => { const L = window.__sketchforge.state.layers; return L.find(l => l.id === i.hair).parent === i.body && L.find(l => l.id === i.arm).parent === i.body; }, ids));
  // the body slides right on frames 0 → 8 (tween) and stops; the hair's joint is its top
  await pg.evaluate(i => { const SF = window.__sketchforge, L = SF.state.layers, body = L.find(l => l.id === i.body), hair = L.find(l => l.id === i.hair);
    hair.px = 245; hair.py = 110;
    SF.state.activeId = body.id; SF.gotoFrame(8); SF.insertKeyframe(false); const c8 = body.cels.get(8); c8._xf = { x: 160, y: 0, rot: 0, sx: 1, sy: 1, alpha: 1 };
    const c0 = body.cels.get(0); c0._xf = { x: 0, y: 0, rot: 0, sx: 1, sy: 1, alpha: 1, tween: true, ease: 0 }; SF.gotoFrame(0); }, ids);
  // gravity on the hair (dialog)
  await pg.evaluate(id => { window.__sketchforge.state.activeId = id; window.__sketchforge.CMD.physBone(); }, ids.hair); await pg.waitForTimeout(200);
  await pg.evaluate(() => { const d = document.querySelector('dialog.csdlg'); d.querySelector('[data-k=on]').checked = true; d.querySelector('button[value=ok]').click(); });
  await pg.waitForTimeout(200);
  const sw = await pg.evaluate(id => { const SF = window.__sketchforge, hair = SF.state.layers.find(l => l.id === id); return Array.from({ length: 30 }, (_, f) => +SF.scope('physAngle')(hair, f).toFixed(1)); }, ids.hair);
  console.log('     swing (°) per frame: ' + sw.join(' '));
  check('frame 0 is the drawing as made (no swing)', sw[0] === 0);
  check('the hair swings while the body moves', Math.max(...sw.slice(1, 12).map(Math.abs)) > 3);
  check('…and settles after the body stops', Math.abs(sw[29]) < Math.max(...sw.slice(1, 12).map(Math.abs)) * 0.5);
  check('the hair is drawn swung (layerMat), keyframes are not changed', await pg.evaluate(id => { const SF = window.__sketchforge, hair = SF.state.layers.find(l => l.id === id), m = SF.layerMat(hair, 6), c = hair.cels.get(0); return Math.abs(Math.atan2(m[1], m[0])) > 0.02 && (!c._xf || !c._xf.rot); }, ids.hair));
  // save / open
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.evaluate(() => window.__sketchforge.CMD.save())]);
  const fl = path.join(out, 'phys.sketchforge'); await dl.saveAs(fl);
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.evaluate(() => window.__sketchforge.CMD.open())]);
  await fc.setFiles(fl); await pg.waitForTimeout(1200);
  check('saved and opened: gravity settings kept', await pg.evaluate(() => { const h = window.__sketchforge.state.layers.find(l => l.name === 'Hair'); return !!(h && h.phys && h.phys.on); }));
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
