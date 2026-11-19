// Layer panel: tick boxes (several layers), folders (make, open / close, hide, move in, ungroup), colour labels
// (preset + your own), undo, and everything kept when the file is saved and opened again.
const H = require('./harness.cjs');
const path = require('path');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, errors, done } = await H.open(root, 8822, { width: 1400, height: 900 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  await pg.evaluate(() => { const SF = window.__sketchforge; SF.newDocument(400, 300, 1, 12, false, 'Layers'); for (let i = 0; i < 4; i++) SF.CMD.layerAdd(); });
  await pg.waitForTimeout(300);
  const names = () => pg.evaluate(() => window.__sketchforge.state.layers.map(l => l.name + (l.folder ? '@' + l.folder.name : '') + (l.tag ? l.tag : '')));
  console.log('     layers', (await names()).join(' | '));
  check('Layer panel toolbar has a New folder button', !!(await pg.$('#rightdock button[data-cmd=layerFolder][data-ic], button[data-cmd=layerFolder][data-ic]')) && await pg.evaluate(() => !document.querySelector('button[data-cmd=layerFolder][data-ic]').closest('.dropdown')));
  check('every layer has a tick box', (await pg.$$('#layerList .layer-item .ltick')).length === 6);
  // tick two layers
  const tick = n => pg.evaluate(n => { const it = [...document.querySelectorAll('#layerList .layer-item')].find(x => x.querySelector('.name span:last-child').textContent === n); it.querySelector('.ltick').click(); }, n);
  await tick('Layer 2'); await tick('Layer 4'); await pg.waitForTimeout(100);
  check('ticking shows the bar with "2 ticked"', /2 ticked/.test(await pg.textContent('#layerSelBar')));
  // make a folder from them
  await pg.click('#layerSelBar [data-a=folder]'); await pg.waitForTimeout(150);
  let n = await names();
  console.log('     after folder', n.join(' | '));
  check('the ticked layers go into a new folder, next to each other', n.filter(x => /@Folder 1/.test(x)).length === 2 && Math.abs(n.indexOf('Layer 2@Folder 1') - n.indexOf('Layer 4@Folder 1')) === 1);
  check('the folder shows in the list', (await pg.$$('#layerList .layer-folder')).length === 1);
  // close / open
  await pg.click('#layerList .layer-folder .farrow'); await pg.waitForTimeout(100);
  check('closing the folder hides its layers in the list', (await pg.$$('#layerList .layer-item')).length === 4);
  await pg.click('#layerList .layer-folder .farrow'); await pg.waitForTimeout(100);
  // hide the folder: its layers are hidden on the canvas
  await pg.click('#layerList .layer-folder .mini:not(.farrow)'); await pg.waitForTimeout(100);
  check('the folder eye hides its layers', await pg.evaluate(() => window.__sketchforge.state.layers.filter(l => l.folder).every(l => !l.visible)));
  await pg.click('#layerList .layer-folder .mini:not(.farrow)'); await pg.waitForTimeout(100);
  check('…and shows them again', await pg.evaluate(() => window.__sketchforge.state.layers.filter(l => l.folder).every(l => l.visible)));
  // colour label (preset) on a layer through its right-click menu
  const row = n => pg.evaluateHandle(n => [...document.querySelectorAll('#layerList .layer-item')].find(x => x.querySelector('.name span:last-child').textContent === n), n);
  await (await row('Layer 1')).click({ button: 'right' }); await pg.waitForTimeout(100);
  await pg.click('.lpop button:has-text("Colour label")'); await pg.waitForTimeout(100);
  await pg.click('.lcolors .lsw[data-c="#46a758"]'); await pg.waitForTimeout(100);
  console.log('     after label', (await names()).join(' | '));
  check('colour label on a layer (green stripe)', (await names()).includes('Layer 1#46a758'));
  // own colour on the folder
  await pg.click('#layerList .layer-folder .mini:last-child'); await pg.waitForTimeout(100);
  await pg.click('.lpop button:has-text("Folder colour")'); await pg.waitForTimeout(100);
  await pg.evaluate(() => { const i = document.querySelector('.lcolors input[type=color]'); i.value = '#123abc'; i.dispatchEvent(new Event('change')); });
  check('your own colour on the folder', await pg.evaluate(() => window.__sketchforge.state.layers.find(l => l.folder).folder.color === '#123abc'));
  check('your colour is remembered for next time', await pg.evaluate(() => JSON.parse(localStorage.getItem('sketchforge.tagcolors.v1')).includes('#123abc')));
  // move another layer into the folder (Move to…)
  await tick('Layer 3'); await pg.waitForTimeout(80);
  await pg.click('#layerSelBar [data-a=move]'); await pg.waitForTimeout(80);
  await pg.click('.lpop button:has-text("📁 Folder 1")'); await pg.waitForTimeout(150);
  n = await names();
  check('Move to… puts a layer in the folder', n.filter(x => /@Folder 1/.test(x)).length === 3);
  // undo / redo
  await pg.evaluate(() => window.__sketchforge.CMD.undo()); await pg.waitForTimeout(100);
  check('undo takes it out again', (await names()).filter(x => /@Folder 1/.test(x)).length === 2);
  await pg.evaluate(() => window.__sketchforge.CMD.redo()); await pg.waitForTimeout(100);
  await pg.screenshot({ path: out + '/layers_folders.png' });
  // save and open again
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.evaluate(() => window.__sketchforge.CMD.save())]);
  const f = path.join(out, 'layers.sketchforge'); await dl.saveAs(f);
  await pg.evaluate(() => window.__sketchforge.newDocument(200, 200, 1, 12, false, 'Other')); await pg.waitForTimeout(200);
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.evaluate(() => window.__sketchforge.CMD.open())]);
  await fc.setFiles(f); await pg.waitForTimeout(1200);
  const re = await pg.evaluate(() => { const L = window.__sketchforge.state.layers, fl = L.filter(l => l.folder); return { n: fl.length, same: fl.every(l => l.folder === fl[0].folder), name: fl[0] && fl[0].folder.name, color: fl[0] && fl[0].folder.color, tag: (L.find(l => l.name === 'Layer 1') || {}).tag }; });
  check('saved and opened: folder, its colour and the layer colour are back', re.n === 3 && re.same && re.name === 'Folder 1' && re.color === '#123abc' && re.tag === '#46a758');
  // ungroup
  await pg.click('#layerList .layer-folder .mini:last-child'); await pg.waitForTimeout(100);
  await pg.click('.lpop button:has-text("Ungroup")'); await pg.waitForTimeout(150);
  check('Ungroup keeps the layers, removes the folder', (await pg.$$('#layerList .layer-folder')).length === 0 && (await pg.evaluate(() => window.__sketchforge.state.layers.length)) === 6);
  // delete several ticked layers at once
  await tick('Layer 1'); await tick('Layer 2'); await pg.click('#layerSelBar [data-a=del]'); await pg.waitForTimeout(150);
  check('delete several ticked layers at once', (await pg.evaluate(() => window.__sketchforge.state.layers.length)) === 4);
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
