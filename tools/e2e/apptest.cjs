// Node port of tools/smoke.py plus 3D-panel checks.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = process.argv[2], OUT = process.argv[3];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }).listen(8766);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errors = []; pg.on('pageerror', e => errors.push(String(e)));
  await pg.goto('http://127.0.0.1:8766/index.html'); await pg.waitForTimeout(2500);
  await pg.mouse.move(600, 400); await pg.mouse.down(); for (let i = 0; i < 40; i++) await pg.mouse.move(600 + i * 8, 400 + i * 4); await pg.mouse.up();
  await pg.click('#btn3d'); await pg.waitForTimeout(4000);
  const info = await pg.evaluate(() => { const SF = window.__sketchforge; return ({ three: typeof SF3D, models: typeof SF_MODELS, rigged: !!(SF.M3.parts[0] && SF.M3.parts[0].userData.rigged), joints: Object.keys(SF.M3.joints).length, sel: SF.M3.sel }) });
  console.log(JSON.stringify(info));
  await pg.screenshot({ path: OUT + '/app_female_stand.png' });
  // click the left upper arm in the preview: project its bone midpoint to preview coordinates
  const pickRes = await pg.evaluate(() => { const SF = window.__sketchforge;
    const cv = document.querySelector('#m3dPreview'), r = cv.getBoundingClientRect(), T = SF.M3.T;
    SF.M3.root.updateMatrixWorld(true); SF.M3.camera.updateMatrixWorld(true);
    const a = new T.Vector3().setFromMatrixPosition(SF.M3.joints.armL.matrixWorld), e = new T.Vector3().setFromMatrixPosition(SF.M3.joints.forearmL.matrixWorld);
    const m = a.lerp(e, 0.5).project(SF.M3.camera);
    return { x: r.left + (m.x + 1) / 2 * r.width, y: r.top + (1 - m.y) / 2 * r.height };
  });
  await pg.mouse.move(pickRes.x, pickRes.y); await pg.mouse.down(); await pg.mouse.move(pickRes.x, pickRes.y - 25, { steps: 5 }); await pg.mouse.up();
  await pg.waitForTimeout(500);
  console.log('after arm drag, selected =', await pg.evaluate(() => window.__sketchforge.M3.sel));
  await pg.evaluate(() => { const SF = window.__sketchforge; document.querySelector('#m3dGender button[data-g="male"]').click(); });
  await pg.waitForTimeout(800);
  await pg.evaluate(() => { const SF = window.__sketchforge; [...document.querySelectorAll('#m3dPoses button')].find(x => x.textContent === 'Walk').click(); document.querySelector('#m3dToon').click(); });
  await pg.waitForTimeout(1500);
  console.log('male rigged:', await pg.evaluate(() => window.__sketchforge.M3.parts[0].userData.rigged), 'toon:', await pg.evaluate(() => window.__sketchforge.M3.parts[0].material.type));
  await pg.screenshot({ path: OUT + '/app_male_walk_toon.png' });
  await pg.click('#m3dPlace'); await pg.waitForTimeout(800);
  console.log('layers:', await pg.evaluate(() => window.__sketchforge.state.layers.map(l => l.name).join(', ')));
  await b.close(); srv.close();
  console.log('page errors:', errors.length ? errors : 'none');
  console.log(!errors.length && info.three === 'object' && info.rigged ? 'PASS' : 'FAIL');
})();
