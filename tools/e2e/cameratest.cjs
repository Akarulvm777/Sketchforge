// Animation camera (p10pcb): keys glide (eased), exports are framed by the camera, the camera box is drawn, playback
// through the camera, undo, saved with the file.
const H = require('./harness.cjs');
const path = require('path');
(async () => {
  const root = process.argv[2], out = process.argv[3] || '/tmp';
  const { pg, errors, done } = await H.open(root, 8924, { width: 1300, height: 860 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const S = src => pg.evaluate(s => window.__sketchforge.scope(s), src);
  // 400 × 200 page, 10 frames: left half red, right half blue
  await S(`(() => { newDocument(400, 200, 10, 12, false, 'Cam'); const g = activeLayer().cels.get(0).getContext('2d'); g.fillStyle = '#ff0000'; g.fillRect(0, 0, 200, 200); g.fillStyle = '#0000ff'; g.fillRect(200, 0, 200, 200); activeLayer().cels.get(0)._ink = true; setMode('anim', true); refreshAll(); })()`);
  await S('CMD.camera()'); await pg.waitForTimeout(200);
  check('Animation › Camera opens its panel', await pg.isVisible('#camPanel'));
  // frame 1: zoomed ×2 on the red half; frame 10: zoomed ×2 on the blue half
  await S('camSetKey(0, { x: 100, y: 100, z: 2, rot: 0 }); gotoFrame(9); camSetKey(9, { x: 300, y: 100, z: 2, rot: 0 }); gotoFrame(0)');
  const mid = await S('(() => { const c = camAt(state.camera, 4.5, 400, 200); return [Math.round(c.x), c.z]; })()');
  check('between keys the camera glides: ' + mid, mid[0] === 200 && mid[1] === 2);
  const exp = f => S(`(() => { CAM.export++; try { const c = compositeFrame(${f}, {}); const d = c.getContext('2d').getImageData(0, 0, 400, 200).data; const at = (x, y) => [...d.slice((y * 400 + x) * 4, (y * 400 + x) * 4 + 3)]; return { w: c.width, left: at(10, 100), right: at(390, 100) }; } finally { CAM.export--; } })()`);
  const e0 = await exp(0), e9 = await exp(9);
  console.log('     ' + JSON.stringify({ e0, e9 }));
  check('export at frame 1 shows only the red half (zoomed)', e0.w === 400 && e0.left[0] > 200 && e0.right[0] > 200 && e0.right[2] < 50);
  check('export at frame 10 shows only the blue half', e9.left[2] > 200 && e9.right[2] > 200);
  check('the page itself is not changed (no camera outside exports)', await S('(() => { const d = compositeFrame(0, {}).getContext("2d").getImageData(390, 100, 1, 1).data; return d[2] > 200; })()'));
  // the PNG export goes through the camera
  const [dl] = await Promise.all([pg.waitForEvent('download'), S('CMD.exportPNG()')]);
  const p = path.join(out, 'cam_f1.png'); await dl.saveAs(p);
  const right = JSON.parse(require('child_process').execFileSync('python3', ['-I', '-c', 'import sys,json; from PIL import Image; im = Image.open(sys.argv[1]).convert("RGB"); print(json.dumps(im.getpixel((390, 100))))', p]).toString());
  check('File › Export current frame (PNG) is framed by the camera: ' + right, right[0] > 200 && right[2] < 50);
  // playback through the camera, back to normal after
  await S('play()'); await pg.waitForTimeout(400);
  check('playback is watched through the camera', await S('CAM.previewing') && await pg.evaluate(() => document.querySelector('#viewport').classList.contains('campreview')));
  await S('stop()'); await pg.waitForTimeout(150);
  check('after stopping, the normal view comes back', !await S('CAM.previewing'));
  // the camera box on the canvas
  await S('gotoFrame(0); drawOverlay()');
  check('the camera frame is drawn on the canvas', await pg.evaluate(() => { const c = document.querySelector('#overlay'), g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] < 120 && d[i + 2] < 120 && d[i + 3] > 200) return true; return false; }));
  await pg.screenshot({ path: path.join(out, 'camera.png') });
  // undo, save
  await S('CMD.undo()');
  check('undo removes the last camera key', await S('state.camera.keys.length') === 1);
  await S('CMD.redo()');
  const saved = await S('(async () => (await buildDocObject(null, { cache: false })).camera)()');
  check('saved with the file', saved && saved.keys.length === 2);
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
