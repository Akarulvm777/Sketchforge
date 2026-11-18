// Online features against a fake Supabase (no network): sign-in, cloud save / open, settings sync, sharing a theme,
// the AI helper (answer with action buttons), the update notice, the website and the app sign-in hand-over.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const root = process.argv[2], out = process.argv[3];
const SITE = 8820, API = 8821;
execSync('node tools/build_site.mjs', { cwd: root, env: { ...process.env } });
const dist = path.join(root, 'dist-site');
const cfg = `window.SF_CLOUD = { "site": "http://127.0.0.1:${SITE}", "supabaseUrl": "http://127.0.0.1:${API}", "supabaseAnonKey": "anon-key" };`;
// version.json says there is a newer version
const ver = JSON.parse(fs.readFileSync(path.join(dist, 'version.json'), 'utf8')); ver.version = '99.0.0'; ver.notes = '• test update';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const site = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  if (u.endsWith('/cloud-config.js')) { r.writeHead(200, { 'content-type': 'text/javascript' }); r.end(cfg); return; }
  if (u === '/version.json') { r.writeHead(200, { 'content-type': 'application/json' }); r.end(JSON.stringify(ver)); return; }
  let f = path.join(dist, u); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); });
}).listen(SITE);
// fake Supabase
const USER = { id: 'u-1', email: 'ann@example.com', user_metadata: { full_name: 'Ann Artist' }, app_metadata: { provider: 'google' } };
const db = { settings: null, shared: [], links: {}, store: {}, asks: [], handed: [] };
const send = (r, code, body, type = 'application/json') => { r.writeHead(code, { 'content-type': type, 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }); r.end(body === undefined ? '' : typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
const api = http.createServer((q, r) => {
  const chunks = []; q.on('data', c => chunks.push(c)); q.on('end', () => {
    const body = Buffer.concat(chunks), url = new URL(q.url, 'http://x'), p = url.pathname, auth = q.headers.authorization || '';
    const json = () => { try { return JSON.parse(body.toString() || 'null'); } catch (e) { return null; } };
    if (q.method === 'OPTIONS') return send(r, 204);
    if (p === '/auth/v1/authorize') { r.writeHead(302, { location: url.searchParams.get('redirect_to') + '#access_token=AT1&refresh_token=RT1&expires_in=3600&token_type=bearer' }); return r.end(); }
    if (p === '/auth/v1/user') return auth.includes('AT') ? send(r, 200, USER) : send(r, 401, { message: 'no' });
    if (p === '/auth/v1/token') return send(r, 200, { access_token: 'AT2', refresh_token: 'RT2', expires_in: 3600, user: USER });
    if (p === '/auth/v1/logout') return send(r, 204);
    const signed = auth.includes('AT');
    if (p === '/rest/v1/settings') {
      if (q.method === 'POST') { db.settings = { ...json(), updated_at: new Date().toISOString() }; return send(r, 201); }
      return send(r, 200, db.settings ? [db.settings] : []);
    }
    if (p === '/rest/v1/shared_items') {
      if (q.method === 'POST') { if (!signed) return send(r, 401, { message: 'auth' }); db.shared.push({ ...json(), user_id: USER.id, downloads: 0, created_at: new Date().toISOString() }); return send(r, 201); }
      if (q.method === 'DELETE') { const id = (url.searchParams.get('id') || '').replace('eq.', ''); db.shared = db.shared.filter(x => x.id !== id); return send(r, 204); }
      return send(r, 200, db.shared);
    }
    if (p === '/rest/v1/rpc/count_download') { const it = db.shared.find(x => x.id === json().item); if (it) it.downloads++; return send(r, 204); }
    if (p === '/rest/v1/device_links') { if (!signed) return send(r, 401, { message: 'auth' }); const b = json(); db.links[b.id] = b.refresh_token; db.handed.push(b.id); return send(r, 201); }
    if (p === '/rest/v1/rpc/claim_device_link') { const id = json().link_id, t = db.links[id] || null; delete db.links[id]; return send(r, 200, JSON.stringify(t)); }
    let m;
    if ((m = /^\/storage\/v1\/object\/list\/(\w+)$/.exec(p))) { const pre = json().prefix; return send(r, 200, Object.keys(db.store).filter(k => k.startsWith(m[1] + '/' + pre)).map(k => ({ name: k.slice(m[1].length + 1 + pre.length), updated_at: new Date().toISOString(), metadata: { size: db.store[k].length } }))); }
    if ((m = /^\/storage\/v1\/object\/(?:authenticated|public)\/(\w+)\/(.+)$/.exec(p))) { const k = m[1] + '/' + decodeURIComponent(m[2]); return db.store[k] ? send(r, 200, db.store[k], 'application/octet-stream') : send(r, 404, { message: 'not found' }); }
    if ((m = /^\/storage\/v1\/object\/(\w+)\/(.+)$/.exec(p)) && q.method === 'POST') { if (!signed) return send(r, 401, { message: 'auth' }); db.store[m[1] + '/' + decodeURIComponent(m[2])] = body; return send(r, 200, { Key: p }); }
    if ((m = /^\/storage\/v1\/object\/(\w+)$/.exec(p)) && q.method === 'DELETE') { for (const k of json().prefixes) delete db.store[m[1] + '/' + k]; return send(r, 200, []); }
    if (p === '/functions/v1/ask') { if (!signed) return send(r, 401, { error: 'sign in' }); const b = json(); db.asks.push(b); return send(r, 200, { text: 'Turn on **onion skin**: [[cmd:onion|Onion skin]] or follow [[tut:animation|Make an animation]].', left: 39 }); }
    send(r, 404, { message: 'no route ' + p });
  });
}).listen(API);
(async () => {
  const b = await chromium.launch(); const ok = [];
  const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
  await ctx.addInitScript(() => { localStorage.setItem('sketchforge.tutorials.v1', '{"seen":true}'); localStorage.setItem('sketchforge.animintro.v1', 'never'); });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e))); pg.on('dialog', d => d.accept());
  const E = (f, a) => pg.evaluate(f, a);
  await pg.goto(`http://127.0.0.1:${SITE}/app/`); await pg.waitForTimeout(2000);
  check('Sign in button in the menu bar', (await pg.textContent('#acctBtn')).includes('Sign in'));
  // update notice (version.json says 99.0.0)
  await pg.waitForTimeout(5500);
  check('update notice shown for a newer version', await pg.isVisible('#updCard') && (await pg.textContent('#updCard')).includes('99.0.0'));
  await pg.screenshot({ path: out + '/cloud_update.png' });
  await pg.click('#updCard button:text("Later")');
  // sign in
  await pg.click('#acctBtn'); await pg.waitForTimeout(300);
  await pg.screenshot({ path: out + '/cloud_signin.png' });
  await Promise.all([pg.waitForNavigation(), pg.click('#acctDlg [data-p="google"]')]); await pg.waitForTimeout(2500);
  check('signed in after coming back from the provider', await E(() => !!window.SFSB.user()) && (await pg.getAttribute('#acctBtn', 'title')).includes('Ann Artist'));
  check('token removed from the address bar', !(await E(() => location.hash.includes('access_token'))));
  // cloud save + open
  await pg.mouse.move(600, 400); await pg.mouse.down(); await pg.mouse.move(700, 450, { steps: 5 }); await pg.mouse.up();
  await E(() => { window.__sketchforge.state.name = 'Cloud test'; window.__sketchforge.CMD.cloudSave(); }); await pg.waitForTimeout(1200);
  check('saved to the cloud (drawing + preview)', Object.keys(db.store).some(k => k.endsWith('u-1/Cloud test.sketchforge')) && Object.keys(db.store).some(k => k.endsWith('Cloud test.png')));
  await E(() => window.__sketchforge.CMD.cloudOpen()); await pg.waitForTimeout(800);
  check('cloud files list', (await pg.textContent('#cloudFilesDlg')).includes('Cloud test'));
  await pg.screenshot({ path: out + '/cloud_files.png' });
  const tabs0 = await E(() => document.querySelectorAll('#tabbar .tab').length);
  await pg.click('#cloudFilesDlg [data-o]'); await pg.waitForTimeout(1200);
  check('open from the cloud (new tab)', (await E(() => document.querySelectorAll('#tabbar .tab').length)) === tabs0 + 1);
  // settings sync
  await E(() => localStorage.setItem('sketchforge.testpref', 'blue'));
  await E(() => window.__sketchforge.CMD.syncPush()); await pg.waitForTimeout(500);
  check('settings uploaded', db.settings && db.settings.data['sketchforge.testpref'] === 'blue' && !db.settings.data['sketchforge.auth.v1']);
  db.settings.data['sketchforge.testpref'] = 'red'; db.settings.updated_at = new Date(Date.now() + 60000).toISOString();
  await E(() => window.__sketchforge.CMD.syncPull()); await pg.waitForTimeout(500);
  check('settings downloaded from the cloud', (await E(() => localStorage.getItem('sketchforge.testpref'))) === 'red');
  await pg.click('#updCard button:text("Later")').catch(() => {});
  // share current theme, then install it
  await E(() => window.__sketchforge.CMD.communityLib()); await pg.waitForTimeout(500);
  await pg.click('#libShare'); await pg.waitForTimeout(300);
  await pg.selectOption('#shK', 'theme-current'); await pg.fill('#shN', 'My dark theme'); await pg.click('#shGo'); await pg.waitForTimeout(1200);
  check('theme shared to the community library', db.shared.length === 1 && db.shared[0].kind === 'theme');
  check('library lists it', (await pg.textContent('#libDlg2')).includes('My dark theme'));
  await pg.screenshot({ path: out + '/cloud_library.png' });
  await pg.click('#libDlg2 [data-add]'); await pg.waitForTimeout(800);
  check('installing counts a download', db.shared[0].downloads === 1);
  await pg.keyboard.press('Escape');
  // AI helper
  await pg.click('#aiBtn'); await pg.fill('#aiPanel textarea', 'How do I see the previous drawing?'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(800);
  check('AI helper answers with buttons', await pg.isVisible('#aiPanel .ai-act[data-id="onion"]'));
  check('question sent with what the user is doing', db.asks[0] && db.asks[0].context && db.asks[0].context.version && db.asks[0].messages.slice(-1)[0].content.includes('previous drawing'));
  await pg.screenshot({ path: out + '/cloud_ai.png' });
  const on0 = await E(() => window.__sketchforge.state.onion.on);
  await pg.click('#aiPanel .ai-act[data-id="onion"]');
  check('AI action button runs the command', (await E(() => window.__sketchforge.state.onion.on)) !== on0);
  // website
  const sp = await ctx.newPage(); sp.on('pageerror', e => errs.push('site: ' + e));
  await sp.goto(`http://127.0.0.1:${SITE}/`); await sp.waitForTimeout(1500);
  check('website: version shown', (await sp.textContent('#dlVer')).includes('99.0.0'));
  check('website: community item listed', (await sp.textContent('#commGrid')).includes('My dark theme'));
  await sp.screenshot({ path: out + '/site_home.png', fullPage: false });
  await sp.goto(`http://127.0.0.1:${SITE}/account.html`); await sp.waitForTimeout(1500);
  check('website account page: signed in, files listed', (await sp.textContent('#meName')) === 'Ann Artist' && (await sp.textContent('#myFiles')).includes('Cloud test'));
  await sp.screenshot({ path: out + '/site_account.png', fullPage: true });
  // app sign-in hand-over: link page -> provider -> back -> code handed to the app
  const code = 'c'.repeat(48);
  await sp.goto(`http://127.0.0.1:${SITE}/link.html?p=github#code=${code}`); await sp.waitForTimeout(3000);
  check('link page: signed in and handed over', db.handed.includes(code) && (await sp.textContent('#linkBox')).includes("You're signed in"));
  const claimed = await E(async c => { await window.SFSB.signOut(); const t = await window.SFSB.claim(c); const p = await window.SFSB.signInWithRefresh(t); return p && p.name; }, code);
  check('app picks up the sign-in with the code', claimed === 'Ann Artist');
  console.log(errs.length ? errs : 'no errors', ok.every(Boolean) && !errs.length ? 'PASS' : 'FAIL');
  await b.close(); site.close(); api.close();
})();
