// Shared test harness: serves the repo, opens the app, returns { pg, errors, done }.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
exports.open = async (root, port = 8767, viewport = { width: 1500, height: 950 }, extraArgs = []) => {
  const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }).listen(port);
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', ...extraArgs] });
  const ctx = await b.newContext({ viewport, acceptDownloads: true });
  const pg = await ctx.newPage();
  const errors = []; pg.on('pageerror', e => errors.push(String(e)));
  await pg.goto(`http://127.0.0.1:${port}/index.html`); await pg.waitForTimeout(2000);
  // document coords -> client coords (same maths as docToScreen in p03)
  pg.d2c = (x, y) => pg.evaluate(([x, y]) => { const v = window.__sketchforge.view, r = document.querySelector('#viewport').getBoundingClientRect();
    const R = v.rot * Math.PI / 180, c = Math.cos(R), s = Math.sin(R), fx = v.flip ? -1 : 1, k = v.scale;
    return [r.left + c * fx * k * x - s * k * y + v.x, r.top + s * fx * k * x + c * k * y + v.y]; }, [x, y]);
  pg.strokeDoc = async pts => { const c = []; for (const [x, y] of pts) c.push(await pg.d2c(x, y));
    await pg.mouse.move(c[0][0], c[0][1]); await pg.mouse.down(); for (const q of c.slice(1)) await pg.mouse.move(q[0], q[1], { steps: 4 }); await pg.mouse.up(); };
  // alpha of the active layer's current cel at a document point (max in a 5x5 box)
  pg.inkAt = (x, y) => pg.evaluate(([x, y]) => { const SF = window.__sketchforge, l = SF.activeLayer(), cel = l.cels.get(SF.state.frame) || [...l.cels.values()][0];
    const d = cel.getContext('2d').getImageData(Math.round(x) - 2, Math.round(y) - 2, 5, 5).data; let m = 0; for (let i = 3; i < d.length; i += 4) m = Math.max(m, d[i]); return m; }, [x, y]);
  return { pg, ctx, errors, done: async () => { await b.close(); srv.close(); } };
};
