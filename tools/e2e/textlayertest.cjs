// Editable text layers (p10rd): placing text makes a text layer; clicking it with the Text tool reopens the words;
// Tool Property changes apply to it; undo brings the old text back; brushes are refused; rasterize; save / open keeps it.
const H = require('./harness.cjs');
const path = require('path');
(async () => {
  const root = process.argv[2], out = process.argv[3] || '/tmp';
  const { pg, errors, done } = await H.open(root, 8916, { width: 1300, height: 860 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const S = src => pg.evaluate(s => window.__sketchforge.scope(s), src);
  await pg.evaluate(() => { const SF = window.__sketchforge; SF.newDocument(800, 600, 1, 12, false, 'T'); SF.selectTool('text'); SF.setColor('#000000'); SF.state.fontSize = 40; });
  const click = async (x, y) => { const c = await pg.d2c(x, y); await pg.mouse.click(c[0], c[1]); await pg.waitForTimeout(250); };
  const ink = (x0, y0, x1, y1) => S(`(() => { const c = compositeFrame(0, {}), d = c.getContext('2d').getImageData(${x0}, ${y0}, ${x1 - x0}, ${y1 - y0}).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 100 && d[i - 3] < 100) n++; return n; })()`);
  const n0 = await S('state.layers.length');
  await click(100, 100); await pg.fill('#textInput', 'Hello'); await pg.click('#textOk'); await pg.waitForTimeout(300);
  const L = await S('(() => { const l = activeLayer(), c = l.cels.get(0); return { n: state.layers.length, text: !!l.textLayer, name: l.name, txt: c._text && c._text.txt, size: c._text && c._text.size }; })()');
  console.log('     ' + JSON.stringify(L));
  check('placing text makes a new text layer named after the text', L.n === n0 + 1 && L.text && L.name === 'Hello' && L.txt === 'Hello' && L.size === 40);
  check('the text is drawn', await ink(90, 90, 300, 160) > 50);
  // click it again: the box opens with the words
  await click(130, 115);
  check('clicking the text again opens it for editing', await pg.isVisible('#textDialog') && await pg.inputValue('#textInput') === 'Hello' && await pg.textContent('#textOk') === 'Update text');
  await pg.fill('#textInput', 'Hello world'); await pg.click('#textOk'); await pg.waitForTimeout(300);
  const L2 = await S('(() => { const l = activeLayer(); return { n: state.layers.length, txt: l.cels.get(0)._text.txt, name: l.name }; })()');
  check('updating changes the same layer (no new layer)', L2.n === n0 + 1 && L2.txt === 'Hello world' && L2.name === 'Hello world');
  check('the longer text is drawn further right', await ink(220, 90, 300, 160) > 20);
  await S('CMD.undo()'); await pg.waitForTimeout(200);
  check('undo brings the old words back', await S('activeLayer().cels.get(0)._text.txt') === 'Hello' && await ink(220, 90, 300, 160) === 0);
  // Tool Property change applies to the active text layer
  await S("state.fontSize = 80; refreshProps()");
  await pg.evaluate(() => { const i = document.querySelector('#propBody input'); i.dispatchEvent(new Event('input', { bubbles: true })); });
  await pg.waitForTimeout(400);
  check('a new size in Tool Property resizes the selected text', await S('activeLayer().cels.get(0)._text.size') === 80);
  await pg.evaluate(() => window.__sketchforge.setColor('#ff0000')); await pg.waitForTimeout(400);
  check('a new colour recolours it', await S('activeLayer().cels.get(0)._text.color') === '#ff0000');
  await pg.evaluate(() => window.__sketchforge.setColor('#000000')); await pg.waitForTimeout(300);
  // brushes are refused on a text layer
  await S("selectTool('pen')");
  await pg.strokeDoc([[100, 400], [300, 400]]);
  check('a brush does not paint on a text layer (it asks to rasterize)', /Rasterize text/.test(await pg.textContent('#toast')) && await S('(() => { const d = activeLayer().cels.get(0).getContext("2d").getImageData(200, 400, 1, 1).data; return d[3]; })()') === 0);
  // save / open keeps the text editable
  const round = await S(`(async () => { const o = await buildDocObject(null, { cache: false }); const L = o.layers.find(l => l.textLayer); return { has: !!L, text: L && L.cels[0].text && L.cels[0].text.txt }; })()`);
  console.log('     ' + JSON.stringify(round));
  check('saved in the file as text (not only pixels)', round.has && round.text === 'Hello');
  // empty text deletes the layer
  await S("selectTool('text')");
  await click(110, 120);
  await pg.fill('#textInput', ''); await pg.click('#textOk'); await pg.waitForTimeout(300);
  check('clearing the words removes the text layer', await S('state.layers.length') === n0 && !await S('state.layers.some(l => l.textLayer)'));
  // rasterize
  await click(400, 300); await pg.fill('#textInput', 'Paint me'); await pg.click('#textOk'); await pg.waitForTimeout(300);
  await S('CMD.rasterizeText()');
  check('Rasterize text makes it a normal layer you can paint on', !await S('activeLayer().textLayer') && await ink(390, 290, 640, 360) > 30);
  // the old way: pixels on the current layer
  await S('state.textLayer = false');
  const n1 = await S('state.layers.length');
  await click(100, 500); await pg.fill('#textInput', 'Flat'); await pg.click('#textOk'); await pg.waitForTimeout(300);
  check('"Editable text layer" off: text drawn on the current layer, no new layer', await S('state.layers.length') === n1 && await ink(90, 490, 220, 560) > 30);
  await pg.screenshot({ path: path.join(out, 'textlayer.png') });
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
