// Welcome animation: the mascot says "Welcome!" on the first start (then the tour card), not again on the next start,
// again on the first start of a new version (then What's new), tap to skip, Help › Play the welcome animation.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif' };
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const srv = http.createServer((q, r) => { const p = decodeURIComponent(q.url.split('?')[0]), f = path.join(root, p === '/' ? 'index.html' : p); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }).listen(8859);
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1200, height: 800 } }); const pg = await ctx.newPage();
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const errors = []; pg.on('pageerror', e => errors.push(String(e)));
  await pg.goto('http://127.0.0.1:8859/index.html'); await pg.waitForTimeout(1500);
  const w = await pg.evaluate(() => { const el = document.querySelector('#sfWelcome'), im = el && el.querySelector('img'); return el ? { txt: el.textContent, img: im.complete && im.naturalWidth } : null; });
  console.log('     ' + JSON.stringify(w));
  check('first start: the mascot says "Welcome!"', w && /Welcome!/.test(w.txt) && w.img === 640);
  await pg.screenshot({ path: out + '/welcome.png' });
  check('the tour card waits for the welcome', !(await pg.$('#tutWelcome')));
  await pg.waitForTimeout(4500);
  check('the welcome ends by itself, then the tour card comes', !(await pg.$('#sfWelcome')) && !!(await pg.$('#tutWelcome')));
  await pg.reload(); await pg.waitForTimeout(1500);
  check('next start: no welcome', !(await pg.$('#sfWelcome')));
  // a new version: welcome, tap to skip, then What's new
  await pg.evaluate(() => { localStorage.setItem('sketchforge.welcome.v1', '2.4.1'); localStorage.setItem('sketchforge.lastver', '2.4.1'); });
  await pg.reload(); await pg.waitForTimeout(1500);
  const up = await pg.evaluate(() => { const el = document.querySelector('#sfWelcome'); return el && el.textContent; });
  check('first start of a new version: welcome with the new version', up && new RegExp('Inkvessa ' + (await pg.evaluate(() => APP_VERSION)).replace(/\./g, '\\.') + ' is here').test(up));
  check('…and What\'s new waits for it', !(await pg.isVisible('#whatsNew')));
  await pg.mouse.click(600, 400); await pg.waitForTimeout(2000);
  check('tap skips it, then What\'s new opens', !(await pg.$('#sfWelcome')) && await pg.isVisible('#whatsNew'));
  await pg.click('#whatsNew button[value="ok"]');
  await pg.evaluate(() => { window.__sketchforge.CMD.welcome(); }); await pg.waitForTimeout(400);
  check('Help › Play the welcome animation shows it again', !!(await pg.$('#sfWelcome')) && await pg.evaluate(() => window.__sketchforge.MENUS.find(m => m[0] === 'Help')[1].some(x => Array.isArray(x) && x[1] === 'welcome')));
  await b.close(); srv.close();
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
})();
