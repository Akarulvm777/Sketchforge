// Screenshots of the real app for the website (site/assets/shots). Run: node tools/make_screenshots.cjs
const path = require('path');
const H = require('./e2e/harness.cjs');
const ROOT = path.dirname(__dirname), OUT = path.join(ROOT, 'site/assets/shots');
(async () => {
  const { pg, done } = await H.open(ROOT, 8812, { width: 1440, height: 900 });
  const E = (f, a) => pg.evaluate(f, a);
  const shot = n => pg.screenshot({ path: path.join(OUT, n + '.png') });
  // a drawing: strokes with a few pens and colours
  await E(() => window.__sketchforge.newDocument(1600, 1000, 1, 12, false, 'Sketch'));
  await pg.waitForTimeout(400);
  const draw = async (pts, color, size, tool) => {
    await E(([c, s, t]) => { const SF = window.__sketchforge; SF.selectTool(t); SF.setColor(c); }, [color, size, tool]);
    const c = []; for (const [x, y] of pts) c.push(await pg.d2c(x, y));
    await pg.mouse.move(c[0][0], c[0][1]); await pg.mouse.down();
    for (const q of c.slice(1)) await pg.mouse.move(q[0], q[1], { steps: 6 });
    await pg.mouse.up();
  };
  const curve = (cx, cy, r, a0, a1, n = 24) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.9]; });
  const tools = await E(() => Object.keys(window.__sketchforge.TOOLDEF));
  const pen = tools.find(t => /gpen|g_pen|pen/i.test(t)) || tools[0], brush = tools.find(t => /water|brush/i.test(t)) || pen;
  await draw(curve(800, 480, 260, 0, Math.PI * 2, 48), '#2a2a2a', 6, pen);
  await draw(curve(700, 420, 40, 0, Math.PI * 2), '#2a2a2a', 6, pen);
  await draw(curve(900, 420, 40, 0, Math.PI * 2), '#2a2a2a', 6, pen);
  await draw(curve(800, 560, 110, 0.3, Math.PI - 0.3), '#c0392b', 8, pen);
  for (let i = 0; i < 6; i++) await draw([[560 + i * 60, 820], [600 + i * 60, 700], [640 + i * 60, 820]], ['#e67e22', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#e84393'][i], 12, brush);
  await E(() => { const SF = window.__sketchforge; SF.CMD.fit && SF.CMD.fit(); });
  await pg.waitForTimeout(400); await shot('drawing');
  // animation workspace with onion skin
  await pg.click('#modeSwitch [data-mode="anim"]'); await pg.waitForTimeout(500);
  for (let i = 1; i <= 3; i++) { await E(() => window.__sketchforge.CMD.newDrawing()); await draw(curve(800 + i * 60, 480 - i * 25, 200, 0, Math.PI * 2, 40), '#2a2a2a', 6, pen); }
  await pg.waitForTimeout(400); await shot('animation');
  await pg.click('#modeSwitch [data-mode="draw"]'); await pg.waitForTimeout(300);
  // 3D model
  await E(() => window.__sketchforge.CMD.show3d()); await pg.waitForTimeout(6000);
  await pg.click('#m3dPoses button:text("Walk")'); await pg.waitForTimeout(500); await shot('model3d');
  // Custom P
  await E(() => window.__sketchforge.CMD.cpOpen ? window.__sketchforge.CMD.cpOpen() : null);
  if (!(await pg.isVisible('#cpDialog'))) await pg.click('.menu[data-menu="🎨 Custom P"] > .menu-btn').catch(() => {});
  await pg.waitForTimeout(600); await shot('custom');
  await pg.keyboard.press('Escape');
  // tutorials
  await E(() => window.__sketchforge.CMD.tutorials()); await pg.waitForTimeout(500); await shot('tutorials');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
  // brush editor (on the watercolour brush) over a drawing on grainy paper
  await E(() => { const SF = window.__sketchforge; document.querySelectorAll('dialog[open]').forEach(d => d.close()); SF.selectTool(Object.keys(SF.TOOLDEF).find(k => /watercolor/i.test(SF.TOOLDEF[k].name)) || 'pencil'); });
  await E(() => window.__sketchforge.CMD.brushEdit()); await pg.waitForTimeout(800);
  await E(() => { const d = document.querySelector('dialog.brushedit'); d.querySelectorAll('details').forEach((x, i) => { x.open = i < 4; }); });
  await pg.waitForTimeout(300); await shot('brushes');
  await E(() => document.querySelector('.brushedit [data-a=cancel]').click());
  await done();
  console.log('screenshots in', OUT);
})();
