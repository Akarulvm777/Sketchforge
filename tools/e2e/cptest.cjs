// Custom P studio: every section changes the interface, settings persist, themes save / export / import, reset works.
const H = require('./harness.cjs');
const fs = require('fs');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, errors, done } = await H.open(root, 8790);
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const E = (f, a) => pg.evaluate(f, a);
  pg.on('dialog', d => d.type() === 'prompt' ? d.accept('Test theme') : d.accept());
  const cs = (sel, prop) => pg.evaluate(([s, p]) => getComputedStyle(document.querySelector(s))[p], [sel, prop]);
  const rect = sel => pg.evaluate(s => document.querySelector(s).getBoundingClientRect().toJSON(), sel);
  const tab = async t => { await pg.click(`#cpDialog .cpTabs [data-tab="${t}"]`); await pg.waitForTimeout(150); };
  const row = label => `#cpDialog .cprow:has(.cplbl:text-is("${label}"))`;
  const setRange = async (label, v) => pg.evaluate(([l, v]) => { const r = [...document.querySelectorAll('#cpDialog .cprow')].find(x => x.querySelector('.cplbl').textContent === l).querySelector('input[type=range]'); r.value = v; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change')); }, [label, v]);
  const setColor = async (label, v) => pg.evaluate(([l, v]) => { const r = [...document.querySelectorAll('#cpDialog .cprow')].find(x => x.querySelector('.cplbl').textContent === l).querySelector('input[type=color]'); r.value = v; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change')); }, [label, v]);
  const setSelect = async (label, v) => { await pg.evaluate(([l, v]) => { const r = [...document.querySelectorAll('#cpDialog .cprow')].find(x => x.querySelector('.cplbl').textContent === l).querySelector('select'); r.value = v; r.dispatchEvent(new Event('change')); }, [label, v]); await pg.waitForTimeout(200); };
  const toggle = async label => { await pg.evaluate(l => { const t = [...document.querySelectorAll('#cpDialog .cptoggle')].find(x => x.textContent.trim() === l).querySelector('input'); t.click(); }, label); await pg.waitForTimeout(100); };
  const menus = await E(() => [...document.querySelectorAll('#menus .menu-btn')].map(b => b.textContent));
  check('menu "🎨 Custom P" right after Add-ons', menus[menus.indexOf('Add-ons') + 1] === '🎨 Custom P');
  const bar0 = await cs('#cmdbar', 'backgroundColor');
  await E(() => window.__sketchforge.CMD.cpOpen()); await pg.waitForTimeout(300);
  check('studio has 8 sections', await E(() => document.querySelectorAll('#cpDialog .cpTabs button').length) === 8);
  // themes
  await pg.click('#cpDialog [data-preset="midnight"]'); await pg.waitForTimeout(150);
  check('colour theme repaints the interface', (await cs('#cmdbar', 'backgroundColor')) !== bar0);
  await pg.click('#cpDialog .cpbtns button:text("Big & touch-friendly (tablet)")'); await pg.waitForTimeout(200);
  check('layout style "touch" makes tool buttons bigger', (await rect('#toolbox .tool')).width >= 40);
  // colours
  await tab('colors');
  await setColor('Menu bar', '#f4e04d');
  check('menu bar colour changed', (await cs('#menubar', 'backgroundColor')) === 'rgb(244, 224, 77)');
  check('menu text turns dark on a light bar (auto contrast)', (await cs('#menubar .menu-btn', 'color')) === 'rgb(29, 31, 34)');
  await setColor('Side panels', '#2a6f4f');
  check('side panel colour changed', (await cs('#rightdock', 'backgroundColor')) === 'rgb(42, 111, 79)');
  await setColor('Keyframe dots', '#ff0000');
  await setColor('Sliders & check boxes', '#00aaff');
  check('slider colour changed', (await cs('input[type=range]', 'accentColor')) === 'rgb(0, 170, 255)');
  // text
  await tab('text');
  await setSelect('Interface font', 'Georgia, "Times New Roman", serif');
  check('font changed: ' + await cs('body', 'fontFamily'), /Georgia/.test(await cs('body', 'fontFamily')));
  await setRange('Text size', 130);
  check('text size 130% = 15.6px', (await cs('body', 'fontSize')) === '15.6px');
  await setRange('Text size', 100);
  // layout
  await tab('layout');
  await setRange('Interface scale', 100);
  await setSelect('Tool palette side', 'right');
  check('tool palette moved to the right', (await rect('#toolbox')).x > (await rect('#viewport')).x);
  await setSelect('Command bar', 'bottom');
  check('command bar moved to the bottom', (await rect('#cmdbar')).y > (await rect('#viewport')).y);
  await setSelect('Tool palette columns', '3');
  check('3-column tool palette', (await rect('#toolbox')).width > 100);
  await setRange('Right panel width', 360);
  check('right panel 360 px wide', Math.abs((await rect('#rightdock')).width - 360) < 4);
  await setRange('Roundness', 16);
  check('roundness applied', (await cs('.pal button, #cmdbar button', 'borderTopLeftRadius')) === '16px');
  await setRange('Interface scale', 120);
  // icons
  await tab('icons');
  await setColor('Icon colour', '#ff8800');
  check('icon colour changed', (await cs('#toolbox .tool:not(.active)', 'color')) === 'rgb(255, 136, 0)');
  await setRange('Line thickness', 2.8);
  check('icon line thickness changed', (await cs('#toolbox .tool svg', 'strokeWidth')) === '2.8px');
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('.cpIcon[data-ik="pen"] .cpPick')]);
  await fc.setFiles(out + '/red.png'); await pg.waitForTimeout(500);
  check('pen icon replaced by an image', await E(() => !!document.querySelector('#toolbox .tool[data-group="pen"] svg.cicon image')));
  // canvas
  await tab('canvas');
  await setSelect('Style', 'checker');
  check('canvas area: checkerboard', /conic-gradient/.test(await cs('#viewport', 'backgroundImage')));
  await setRange('Shadow', 80);
  // cursor
  await tab('cursor');
  await setColor('Outline colour', '#00ff00');
  check('cursor colour changed', (await cs('#cursor', 'borderTopColor')) === 'rgb(0, 255, 0)');
  // effects
  await tab('effects');
  const [fc2] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('#cpDialog .cprow:has(.cplbl:text-is("Wallpaper behind the whole app")) button:not(.cpreset)')]);
  await fc2.setFiles(out + '/red.png'); await pg.waitForTimeout(600);
  check('wallpaper behind the app', /url\("blob:/.test(await cs('body', 'backgroundImage')));
  check('panels turn see-through with a wallpaper', /color-mix|rgba|oklab|srgb/.test(await cs('#leftdock', 'backgroundColor')) || (await cs('#leftdock', 'backgroundColor')).includes(', 0.'));
  await toggle('Glow on the selected tool, layer and tab');
  await pg.screenshot({ path: out + '/cp_studio.png' });
  // drawing still lands where the pen is, and the timeline still works, with the changed layout and 120% scale
  await pg.click('#cpClose');
  await pg.strokeDoc([[300, 300], [360, 320]]);
  check('drawing still lands under the pen after the layout change', await pg.inkAt(330, 310) > 100);
  await pg.screenshot({ path: out + '/cp_result.png' });
  // save theme, reset, restore
  await E(() => window.__sketchforge.CMD.cpOpen()); await pg.waitForTimeout(300); await tab('themes');
  await pg.click('#cpDialog .cpbtns button:text("💾 Save current as theme…")'); await pg.waitForTimeout(500);
  const styled = await cs('#menubar', 'backgroundColor');
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('#cpDialog .cpbtns button:text("⬇ Export theme file")')]);
  await dl.saveAs(out + '/test.sftheme');
  const th = JSON.parse(fs.readFileSync(out + '/test.sftheme', 'utf8'));
  check('exported theme holds colours, layout, icons and the wallpaper', th.o.col.menubar === '#f4e04d' && th.o.toolSide === 'right' && th.icons.pen && th.assets.wallpaper);
  // reload: everything persists
  await pg.reload(); await pg.waitForTimeout(2500);
  check('after reload: menu bar colour kept', (await cs('#menubar', 'backgroundColor')) === styled);
  check('after reload: tool palette still on the right', (await rect('#toolbox')).x > (await rect('#viewport')).x);
  check('after reload: wallpaper kept', /url\("blob:/.test(await cs('body', 'backgroundImage')));
  // reset everything
  await E(() => window.__sketchforge.CMD.cpReset()); await pg.waitForTimeout(400);
  check('reset: original bar colour', (await cs('#cmdbar', 'backgroundColor')) === bar0);
  check('reset: tool palette back on the left', (await rect('#toolbox')).x < (await rect('#viewport')).x);
  check('reset: no wallpaper', !/url/.test(await cs('body', 'backgroundImage')));
  check('reset: original pen icon', await E(() => !document.querySelector('#toolbox .cicon')));
  // saved theme comes back
  await E(() => window.__sketchforge.CMD.cpOpen()); await pg.waitForTimeout(300); await tab('themes');
  await pg.click('#cpDialog .cpsaved button:text("Test theme")'); await pg.waitForTimeout(800);
  check('saved theme re-applied (menu bar colour, palette side)', (await cs('#menubar', 'backgroundColor')) === styled && (await rect('#toolbox')).x > (await rect('#viewport')).x);
  // import the exported file after a reset
  await E(() => window.__sketchforge.CMD.cpReset()); await pg.waitForTimeout(300);
  const [fc3] = await Promise.all([pg.waitForEvent('filechooser'), E(() => window.__sketchforge.CMD.cpImport())]);
  await fc3.setFiles(out + '/test.sftheme'); await pg.waitForTimeout(800);
  check('imported theme file applied', (await cs('#menubar', 'backgroundColor')) === styled && /url\("blob:/.test(await cs('body', 'backgroundImage')));
  await E(() => window.__sketchforge.CMD.cpReset()); await pg.waitForTimeout(300);
  console.log('page errors:', errors.length ? errors : 'none');
  console.log(ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
