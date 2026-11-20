// Never a blank screen: 1) a browser without <dialog> (old iPad Safari, before iPadOS 15.4) still gets working windows;
// 2) when the app cannot start, a page says why, with "Repair & reload" (clears the saved app files and the service worker).
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
(async () => {
  const root = process.argv[2];
  const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }).listen(8843);
  const b = await chromium.launch();
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const errors = [];
  // 1) no <dialog> support
  let ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('sketchforge.tutorials.v1', '{"seen":true}'); localStorage.setItem('sketchforge.welcome.v1', 'never'); } catch (e) {} delete HTMLDialogElement.prototype.showModal; delete HTMLDialogElement.prototype.show; delete HTMLDialogElement.prototype.close; });
  let pg = await ctx.newPage(); pg.on('pageerror', e => errors.push(String(e)));
  await pg.goto('http://127.0.0.1:8843/index.html'); await pg.waitForTimeout(3000);
  check('without <dialog> support the app still starts', await pg.evaluate(() => !!window.__sketchforgeReady && !document.querySelector('#bootFail')));
  check('closed windows stay hidden', await pg.evaluate(() => getComputedStyle(document.querySelector('#newDialog')).display === 'none'));
  await pg.evaluate(() => window.__sketchforge.CMD.newDoc()); await pg.waitForTimeout(200);
  check('File › New opens its window', await pg.evaluate(() => { const d = document.querySelector('#newDialog'); return d.open && getComputedStyle(d).display !== 'none'; }));
  await pg.fill('#newW', '640'); await pg.fill('#newH', '480'); await pg.selectOption('#newUnit', 'px'); await pg.click('#newCreate'); await pg.waitForTimeout(400);
  check('…and OK makes the file and closes the window', await pg.evaluate(() => window.__sketchforge.state.w === 640 && !document.querySelector('#newDialog').open));
  await pg.evaluate(() => window.__sketchforge.CMD.brushNew()); await pg.waitForTimeout(400);
  check('the brush editor opens', await pg.evaluate(() => { const d = document.querySelector('dialog.brushedit'); return !!d && d.open; }));
  await pg.click('.brushedit [data-a=cancel]'); await pg.waitForTimeout(150);
  check('…and closes', await pg.evaluate(() => !document.querySelector('dialog.brushedit')));
  await ctx.close();
  // 2) the app cannot start
  ctx = await b.newContext({ viewport: { width: 1024, height: 768 } });
  pg = await ctx.newPage();
  await pg.route('**/app.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: 'throw new Error("simulated start-up failure");' }));
  await pg.goto('http://127.0.0.1:8843/index.html'); await pg.waitForTimeout(7500);
  const txt = await pg.evaluate(() => { const b = document.querySelector('#bootFail'); return b ? b.textContent : ''; });
  check('a page says the app could not start, with the reason and the device', /could not start/.test(txt) && /simulated start-up failure/.test(txt) && /app\.js/.test(txt) && /Mozilla/.test(txt));
  check('…with Repair & reload and Reload buttons', !!(await pg.$('#bootRepair')) && !!(await pg.$('#bootReload')));
  await pg.unroute('**/app.js*');
  await Promise.all([pg.waitForNavigation(), pg.click('#bootRepair')]); await pg.waitForTimeout(3500);
  check('Repair & reload starts the app again', await pg.evaluate(() => !!window.__sketchforgeReady && /repair=/.test(location.search)));
  await ctx.close(); await b.close(); srv.close();
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
})();
