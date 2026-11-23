// Clip Studio .clip files open with their layers (p10ppb_clip): names, order, blend modes, opacity, hidden layers,
// folders, clipping, "Layer color", offsets; an animation folder becomes one layer with its cels on the right frames.
// Test files are made by mkclip.py with the structures found in real files.
const H = require('./harness.cjs');
const path = require('path');
(async () => {
  const root = process.argv[2], out = process.argv[3], dir = path.join(out, 'clip');
  require('child_process').execSync(`python3 -I ${JSON.stringify(path.join(__dirname, 'mkclip.py'))} ${JSON.stringify(dir)}`);
  const { pg, errors, done } = await H.open(root, 8798);
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const open = async f => {
    await pg.evaluate(() => { document.querySelector('#toast').textContent = ''; });
    await pg.setInputFiles('#fileOpen', path.join(dir, f));
    await pg.waitForFunction(f => { const t = document.querySelector('#toast').textContent; return t.includes('Opened ' + f) || /Could not/.test(t); }, f, { timeout: 60000 });
    await pg.waitForTimeout(300);
    return pg.evaluate(() => document.querySelector('#toast').textContent);
  };
  const px = (frame, x, y) => pg.evaluate(([f, x, y]) => window.__sketchforge.scope(`(() => { const c = compositeFrame(${f}, {}), s = makeCanvas(1, 1), g = s.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 1, 1); g.drawImage(c, ${x}, ${y}, 1, 1, 0, 0, 1, 1); return [...g.getImageData(0, 0, 1, 1).data].slice(0, 3); })()`), [frame, x, y]);
  const near = (a, b, t = 12) => a.every((v, i) => Math.abs(v - b[i]) <= t);

  const t1 = await open('layers.clip');
  console.log('     ' + t1);
  check('a layered .clip opens with its layers (not the flat picture)', /Opened layers\.clip: 6 layers/.test(t1));
  const L = await pg.evaluate(() => window.__sketchforge.state.layers.map(l => ({ n: l.name, v: l.visible, o: Math.round(l.opacity * 100), b: l.blend, c: l.clip, f: l.folder ? l.folder.name : null, p: !!l.paper })));
  console.log('     ' + JSON.stringify(L));
  check('layers in the same order, bottom to top', L.map(l => l.n).join('|') === 'Paper|Red multiply|Green hidden|Blue|Yellow clipped|Sketch|Moved');
  check('paper layer', L[0].p);
  check('blend mode and opacity', L[1].b === 'multiply' && L[1].o === 50);
  check('hidden layer stays hidden', L[2].v === false);
  check('folder and clipping', L[3].f === 'Shapes' && L[4].f === 'Shapes' && L[4].c === true);
  check('red at 50 % multiply over white', near(await px(0, 100, 100), [255, 128, 128]));
  check('hidden green does not show', near(await px(0, 250, 100), [255, 255, 255]));
  check('blue in the folder', near(await px(0, 370, 100), [0, 0, 255]));
  check('yellow clipped onto the blue only', near(await px(0, 420, 100), [255, 255, 0]) && near(await px(0, 520, 100), [255, 255, 255]));
  check('"Layer color": black sketch shown in its blue', near(await px(0, 100, 300), [40, 120, 230]));
  check('a moved layer keeps its position', near(await px(0, 525, 325), [255, 0, 255]) && near(await px(0, 25, 25), [255, 255, 255]));
  await pg.screenshot({ path: out + '/clip_layers.png' });

  const t2 = await open('anim.clip');
  console.log('     ' + t2);
  const A = await pg.evaluate(() => { const S = window.__sketchforge.state; return { fc: S.frameCount, fps: S.fps, n: S.layers.length, keys: [...S.layers[1].cels.keys()].sort((a, b) => a - b), name: S.layers[1].name }; });
  console.log('     ' + JSON.stringify(A));
  check('animation: frames and frame rate from the timeline', A.fc === 48 && A.fps === 24);
  check('an animation folder becomes one layer with keyframes where the cels change', A.name === 'Animation folder' && A.keys.join(',') === '0,6,12,20,30');
  check('frame 3 shows cel A', near(await px(3, 35, 35), [255, 0, 0]) && near(await px(3, 125, 35), [255, 255, 255]));
  check('frame 8 shows cel B', near(await px(8, 125, 35), [0, 0, 255]) && near(await px(8, 35, 35), [255, 255, 255]));
  check('nothing between the clips (frame 15)', near(await px(15, 35, 35), [255, 255, 255]) && near(await px(15, 125, 35), [255, 255, 255]));
  check('a folder cel is merged (frame 25: green with its red dot)', near(await px(25, 45, 135), [0, 200, 0]) && near(await px(25, 25, 115), [255, 0, 0]));
  check('after the last clip the layer is empty', near(await px(40, 45, 135), [255, 255, 255]));
  check('the sound of the audio layer comes too', /with its sound/.test(t2) && await pg.evaluate(() => window.__sketchforge.scope('aud.dur > 0.9 && aud.dur < 1.1')));
  check('opens in the Animation workspace', await pg.evaluate(() => document.body.classList.contains('mode-anim')));

  // a broken file falls back to the flat preview
  const fs = require('fs'), b = fs.readFileSync(path.join(dir, 'layers.clip'));
  const j = b.indexOf(Buffer.from('BlockDataBeginChunk', 'utf16le').swap16());
  b.fill(0xff, j - 8, j + 60); // the first tile record is unreadable
  fs.writeFileSync(path.join(dir, 'broken.clip'), b);
  const t3 = await open('broken.clip');
  console.log('     ' + t3);
  check('a file whose layers cannot be read still opens', await pg.evaluate(() => window.__sketchforge.state.layers.length >= 1) && !errors.length);
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
