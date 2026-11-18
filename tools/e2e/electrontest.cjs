// Desktop app (Electron): loads from sfapp://, downloads a newer version from the website (live update),
// switches to it, keeps it after a restart, and falls back to the built-in files when the copy is broken.
// Run with a display: xvfb-run node electrontest.cjs ROOT OUT
const { _electron } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), { execSync } = require('child_process');
const root = process.argv[2], out = process.argv[3], PORT = 8830;
execSync('node tools/build_site.mjs', { cwd: root });
const dist = path.join(root, 'dist-site');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-el-')), appDir = path.join(tmp, 'app'), home = path.join(tmp, 'home');
fs.mkdirSync(appDir); fs.mkdirSync(home);
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const f of pkg.build.files) fs.copyFileSync(path.join(root, f), path.join(appDir, f));
fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify({ name: 'sketchforge-test', version: pkg.version, main: 'main.js' }));
fs.writeFileSync(path.join(appDir, 'cloud-config.js'), `window.SF_CLOUD = { "site": "http://127.0.0.1:${PORT}", "supabaseUrl": "", "supabaseAnonKey": "" };`);
const ver = JSON.parse(fs.readFileSync(path.join(dist, 'version.json'), 'utf8')); ver.version = '99.0.0'; ver.notes = '• live update test'; ver.shell = { desktop: '1.0.0', android: '1.0.0' };
let served = 0; const MARK = '\nwindow.__liveMarker = "99";\n'; ver.files.find(f => f.path === 'app.js').size += Buffer.byteLength(MARK);
const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/version.json') { r.writeHead(200, { 'content-type': 'application/json' }); r.end(JSON.stringify(ver)); return; }
  const f = path.join(dist, u);
  fs.readFile(f, (e, d) => {
    if (e) { r.writeHead(404); r.end(); return; }
    served++;
    if (u === '/app/app.js') { d = Buffer.concat([d, Buffer.from(MARK)]); }
    r.writeHead(200); r.end(d);
  });
}).listen(PORT);
const electronPath = require(path.join(root, 'node_modules/electron'));
const launch = () => _electron.launch({ executablePath: electronPath, args: [appDir, '--no-sandbox'], env: { ...process.env, NO_PROXY: '127.0.0.1,localhost', no_proxy: '127.0.0.1,localhost', HOME: home, XDG_CONFIG_HOME: path.join(home, '.config') } });
(async () => {
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  let app = await launch(); app.process().stderr.on('data', d => { if (/update/.test(d)) console.log('     main:', String(d).trim()); }); let win = await app.firstWindow(); await win.waitForTimeout(3000);
  check('loads from sfapp:// (' + win.url().split('?')[0] + ')', win.url().startsWith('sfapp://app/index.html'));
  check('app started', await win.evaluate(() => !!window.__sketchforge));
  check('built-in version first', await win.evaluate(() => !window.__liveMarker));
  await win.waitForSelector('#updCard', { timeout: 30000 }).catch(() => {});
  check('downloaded the new version and offers it (' + served + ' files served)', await win.isVisible('#updCard') && (await win.textContent('#updCard')).includes('99.0.0'));
  await win.screenshot({ path: out + '/electron_update.png' });
  await Promise.all([win.waitForEvent('load'), win.click('#updCard button:text("Use it now")')]); await win.waitForTimeout(2500);
  check('"Use it now" runs the new version', (await win.evaluate(() => window.__liveMarker)) === '99' && await win.evaluate(() => !!window.__sketchforge));
  await app.close();
  app = await launch(); win = await app.firstWindow(); await win.waitForTimeout(3000);
  check('after a restart: still the new version', (await win.evaluate(() => window.__liveMarker)) === '99');
  await app.close();
  // broken downloaded copy -> built-in files again
  const live = fs.readdirSync(path.join(home, '.config')).map(d => path.join(home, '.config', d, 'web', '99.0.0')).find(d => fs.existsSync(d));
  fs.writeFileSync(path.join(live, 'app.js'), 'throw new Error("broken")');
  ver.version = '2.0.0'; // no new update offered
  app = await launch(); win = await app.firstWindow(); await win.waitForTimeout(12000);
  console.log('     state', await win.evaluate(() => JSON.stringify({ sf: !!window.__sketchforge, m: window.__liveMarker || null, u: location.href })));
  check('broken update: falls back to the built-in app', await win.evaluate(() => !!window.__sketchforge && !window.__liveMarker));
  await app.close();
  console.log(ok.every(Boolean) ? 'PASS' : 'FAIL');
  srv.close(); fs.rmSync(tmp, { recursive: true, force: true });
})().catch(e => { console.log('ERROR', e.message); srv.close(); process.exit(1); });
