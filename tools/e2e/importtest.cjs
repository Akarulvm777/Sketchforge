// Import pictures: every format (PNG, JPEG, WebP, BMP, ICO, SVG, TIFF none/LZW/PackBits/Deflate/grey), several pictures
// and animated GIF as frames, File › Open a picture as a document, paste and drop a picture, sound import accepts files.
const H = require('./harness.cjs');
const fs = require('fs'), path = require('path');
(async () => {
  const root = process.argv[2], out = process.argv[3], dir = path.join(out, 'img');
  if (!fs.existsSync(path.join(dir, 'anim.gif'))) require('child_process').execSync(`python3 -I ${JSON.stringify(path.join(__dirname, 'mkimages.py'))} ${JSON.stringify(out)}`);
  const { pg, errors, done } = await H.open(root, 8812);
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const fresh = () => pg.evaluate(() => { const SF = window.__sketchforge; SF.newDocument(800, 600, 1, 12, false, 'Import'); });
  const choose = async (cmd, files) => {
    const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.evaluate(c => window.__sketchforge.CMD[c](), cmd)]);
    await fc.setFiles(files.map(f => path.join(dir, f))); await pg.waitForTimeout(700);
  };
  // colour in the middle of the active layer at frame f
  const mid = (f = null) => pg.evaluate(f => { const SF = window.__sketchforge, l = SF.activeLayer(); const fr = f == null ? SF.state.frame : f;
    let k = null; for (const x of l.cels.keys()) if (x <= fr && (k === null || x > k)) k = x;
    const c = l.cels.get(k), d = c.getContext('2d').getImageData(c.width >> 1, c.height >> 1, 1, 1).data; return [d[0], d[1], d[2], d[3]]; }, f);
  const near = (c, rgb) => c[3] > 200 && Math.abs(c[0] - rgb[0]) < 40 && Math.abs(c[1] - rgb[1]) < 40 && Math.abs(c[2] - rgb[2]) < 40;
  const R = [220, 30, 30], G = [30, 180, 60], B = [40, 70, 220], GRAY = [130, 130, 130];

  check('File menu has Import image / sound / video', await pg.evaluate(() => { const F = window.__sketchforge.MENUS[0][1].map(x => x[1]); return ['importImage', 'importFrames', 'audioImport', 'videoImport'].every(c => F.includes(c)); }));

  for (const [f, col] of [['red.png', R], ['red.jpg', R], ['green.webp', G], ['blue.bmp', B], ['blue.ico', B], ['star.svg', [30, 60, 220]],
    ['red_lzw.tif', R], ['green_raw.tif', G], ['blue_packbits.tif', B], ['red_deflate.tif', R], ['gray.tif', [140, 140, 140]]]) {
    await fresh();
    const n0 = await pg.evaluate(() => window.__sketchforge.state.layers.length);
    await choose('importImage', [f]);
    const n1 = await pg.evaluate(() => window.__sketchforge.state.layers.length), c = await mid();
    check(`${f}: new layer with the picture (${c.join(',')})`, n1 === n0 + 1 && near(c, col));
  }

  // a big picture is made smaller to fit the page
  await fresh(); await choose('importImage', ['big.png']);
  check('a picture bigger than the page is fitted inside it', await pg.evaluate(() => { const l = window.__sketchforge.activeLayer(), c = [...l.cels.values()][0], d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let x0 = 1e9, x1 = -1; for (let x = 0; x < c.width; x++) if (d[(300 * c.width + x) * 4 + 3] > 0) { x0 = Math.min(x0, x); x1 = x; } return x0 > 0 && x1 < c.width - 1 && x1 - x0 > 600; }));

  // several pictures -> frames on one layer
  await fresh(); await choose('importImage', ['seq_2.png', 'seq_1.png', 'seq_3.png']);
  const seq = await pg.evaluate(() => { const SF = window.__sketchforge; return { frames: SF.state.frameCount, keys: [...SF.activeLayer().cels.keys()].sort((a, b) => a - b) }; });
  check('3 pictures become 3 frames, in name order', seq.frames >= 3 && near(await mid(0), R) && near(await mid(1), G) && near(await mid(2), B));

  // animated GIF -> frames (held as long as the GIF says: 250 ms at 12 fps = 3 frames)
  await fresh(); await choose('importImage', ['anim.gif']);
  const gif = await pg.evaluate(() => window.__sketchforge.state.frameCount);
  console.log('     GIF frames on the timeline:', gif);
  check('animated GIF becomes animation frames', gif >= 3 && near(await mid(0), R) && near(await mid(gif - 1), B));
  check('…and the Animation workspace opens', await pg.evaluate(() => window.__sketchforge.state.mode === 'anim'));

  // File › Open a picture: new document of its size
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.evaluate(() => window.__sketchforge.CMD.open())]);
  await fc.setFiles(path.join(dir, 'blue.bmp')); await pg.waitForTimeout(800);
  const doc = await pg.evaluate(() => ({ w: window.__sketchforge.state.w, h: window.__sketchforge.state.h, name: window.__sketchforge.state.name }));
  check(`File › Open a picture makes a ${doc.w}×${doc.h} document "${doc.name}"`, doc.w === 300 && doc.h === 200 && doc.name === 'blue' && near(await mid(), B));

  // paste a picture copied in another app (paste event with an image file)
  await fresh();
  const b64 = fs.readFileSync(path.join(dir, 'green.webp')).toString('base64');
  const n0 = await pg.evaluate(() => window.__sketchforge.state.layers.length);
  await pg.evaluate(b64 => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const dt = new DataTransfer(); dt.items.add(new File([u], 'clip.webp', { type: 'image/webp' }));
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true })); }, b64);
  await pg.waitForTimeout(700);
  check('pasting a picture from another app adds it on a new layer', (await pg.evaluate(() => window.__sketchforge.state.layers.length)) === n0 + 1 && near(await mid(), G));

  // drop a picture on the canvas
  await fresh();
  await pg.evaluate(b64 => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const dt = new DataTransfer(); dt.items.add(new File([u], 'drop.webp', { type: 'image/webp' }));
    document.querySelector('#viewport').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); }, b64);
  await pg.waitForTimeout(700);
  check('dropping a picture on the canvas adds it', near(await mid(), G));

  // undo removes an imported picture in one step
  await pg.evaluate(() => window.__sketchforge.CMD.undo());
  check('undo removes the imported layer', (await pg.evaluate(() => window.__sketchforge.state.layers.length)) === n0);

  // Ctrl+C / Ctrl+V inside Sketchforge still pastes Sketchforge's own copy
  await fresh();
  await pg.evaluate(() => { const SF = window.__sketchforge, g = [...SF.activeLayer().cels.values()][0].getContext('2d'); g.fillStyle = '#dd2222'; g.fillRect(350, 250, 100, 100); SF.CMD.selectAll(); });
  await pg.keyboard.press('Control+c'); await pg.evaluate(() => window.__sketchforge.CMD.layerAdd()); await pg.keyboard.press('Control+v'); await pg.waitForTimeout(400);
  check('Ctrl+C then Ctrl+V pastes inside Sketchforge as before', near(await mid(), R));

  // sound import accepts common audio files
  const acc = await pg.evaluate(() => [...document.querySelectorAll('input[type=file]')].map(i => i.accept).find(a => /mp3/.test(a)) || '');
  check('sound import accepts mp3, wav, m4a, ogg, flac', ['mp3', 'wav', 'm4a', 'ogg', 'flac'].every(x => acc.includes('.' + x)));

  await pg.screenshot({ path: out + '/import.png' });
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
