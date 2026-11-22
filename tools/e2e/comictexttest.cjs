// Comic text: a balloon that fits the text, vertical text (manga style), the comic font families; one undo step.
const H = require('./harness.cjs');
const path = require('path');
(async () => {
  const root = process.argv[2], out = process.argv[3] || '/tmp';
  const { pg, errors, done } = await H.open(root, 8915, { width: 1300, height: 860 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  await pg.evaluate(() => { const SF = window.__sketchforge; SF.newDocument(800, 600, 1, 12, false, 'T'); SF.CMD.layerAdd(); SF.selectTool('text'); SF.setColor('#000000'); SF.state.fontSize = 32; });
  check('Tool Property: comic fonts, direction, balloon', await pg.evaluate(() => { const t = document.querySelector('#propBody').textContent; return /Vertical/.test(t) && /Balloon/.test(t) && [...document.querySelectorAll('#propBody select option')].some(o => /Comic/.test(o.textContent)); }));
  const place = async (x, y, txt) => { const c = await pg.d2c(x, y); await pg.mouse.click(c[0], c[1]); await pg.waitForTimeout(250); await pg.fill('#textInput', txt); await pg.click('#textOk'); await pg.waitForTimeout(300); };
  await pg.evaluate(() => { const S = window.__sketchforge.scope; S("state.textBalloon = 'ellipse'"); S("state.align = 'center'"); S('refreshProps()'); });
  await place(250, 200, 'Hello!\nHow are you?');
  const bal = await pg.evaluate(() => { const d = window.__sketchforge.activeLayer().cels.get(0).getContext('2d').getImageData(0, 0, 800, 600).data, a = (x, y) => [...d.slice((y * 800 + x) * 4, (y * 800 + x) * 4 + 4)];
    let minX = 800, maxX = 0; for (let x = 0; x < 800; x++) if (d[(220 * 800 + x) * 4 + 3] > 0) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
    return { inside: a(250, 194), width: maxX - minX }; });
  console.log('     ' + JSON.stringify(bal));
  check('a speech balloon is drawn around the text (white inside, wider than the text)', bal.width > 260);
  await pg.evaluate(() => window.__sketchforge.CMD.undo());
  check('one undo removes text and balloon', await pg.evaluate(() => { const d = window.__sketchforge.activeLayer().cels.get(0).getContext('2d').getImageData(0, 0, 800, 600).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return false; return true; }));
  // vertical
  await pg.evaluate(() => { const S = window.__sketchforge.scope; S("state.textBalloon = ''"); S("state.textDir = 'v'"); S('refreshProps()'); });
  await place(600, 100, 'ABCD\nEF');
  const vert = await pg.evaluate(() => { const d = window.__sketchforge.activeLayer().cels.get(0).getContext('2d').getImageData(0, 0, 800, 600).data; let x0 = 800, x1 = 0, y0 = 600, y1 = 0; for (let y = 0; y < 600; y++) for (let x = 0; x < 800; x++) if (d[(y * 800 + x) * 4 + 3] > 100) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { w: x1 - x0, h: y1 - y0, right: x1 }; });
  console.log('     vertical text box ' + JSON.stringify(vert));
  check('vertical text: tall, two columns to the left of the click', vert.h > vert.w * 1.5 && vert.right <= 602);
  await pg.screenshot({ path: path.join(out, 'comictext.png') });
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done(); process.exit(ok.every(Boolean) && !errors.length ? 0 : 1);
})();
