// Desktop wrapper (Electron). Run with: npm start
// The app is served from the private sfapp:// scheme, either from the files inside the installed app or from a newer
// copy downloaded from the website (live update, see checkForUpdate). If a downloaded copy fails to start, the
// built-in files are used again.
const { app, BrowserWindow, dialog, session, protocol, net, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

protocol.registerSchemesAsPrivileged([{ scheme: 'sfapp', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

// The app was called Sketchforge before 3.4: keep its data folder (settings, saved session, imported tools, live
// updates) when the name shown to people changes, so nothing is lost after the update.
app.setPath('userData', path.join(app.getPath('appData'), 'Sketchforge'));

const BUILTIN = __dirname;
const LIVE = () => path.join(app.getPath('userData'), 'web');
const STATE = () => path.join(LIVE(), 'state.json');
let root = BUILTIN, rootVersion = app.getVersion();

const semver = v => String(v || '0').split('.').map(x => parseInt(x, 10) || 0);
const verGt = (a, b) => { const x = semver(a), y = semver(b); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
const readJSON = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const writeJSON = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o)); };
function siteUrl() { // from cloud-config.js (public settings shared with the web app)
  try { const m = /SF_CLOUD\s*=\s*(\{[\s\S]*?\});/.exec(fs.readFileSync(path.join(BUILTIN, 'cloud-config.js'), 'utf8')); return (JSON.parse(m[1]).site || '').replace(/\/+$/, ''); } catch (e) { return ''; }
}
function pickRoot() {
  const st = readJSON(STATE());
  if (st && st.version && st.version !== st.bad && verGt(st.version, app.getVersion())) {
    const dir = path.join(LIVE(), st.version);
    if (fs.existsSync(path.join(dir, 'index.html'))) { root = dir; rootVersion = st.version; return; }
  }
  root = BUILTIN; rootVersion = app.getVersion();
}
function serve(req) {
  const u = new URL(req.url);
  let rel = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'index.html';
  const file = path.normalize(path.join(root, rel));
  if (!file.startsWith(root)) return new Response('Forbidden', { status: 403 });
  // never cached: the files change when the app switches to a downloaded version (or back)
  return net.fetch(pathToFileURL(file).toString()).then(r => new Response(r.body, { status: r.status,
    headers: { 'content-type': r.headers.get('content-type') || 'application/octet-stream', 'cache-control': 'no-store' } }));
}

// The page asks before unloading when there are unsaved changes; show a real dialog.
function promptOnUnload(win) {
  win.webContents.on('will-prevent-unload', event => {
    const choice = dialog.showMessageBoxSync(win, {
      type: 'question',
      buttons: ['Leave without saving', 'Stay'],
      defaultId: 1,
      cancelId: 1,
      title: 'Unsaved changes',
      message: 'You have unsaved changes. Leave without saving?'
    });
    if (choice === 0) event.preventDefault(); // ignore beforeunload and close
  });
}
const startUrl = () => `sfapp://app/index.html?shell=${app.getVersion()}`;
let mainWin = null;
function createWindow() {
  const win = mainWin = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#2b2b2b',
    title: 'Inkvessa',
    icon: path.join(__dirname, 'icon-512.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.setMenuBarVisibility(false);
  promptOnUnload(win);
  // "Move document to new window" / "Second view" open extra app windows; web links open in the browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url) && !/\/auth\/v1\/authorize/.test(url)) { shell.openExternal(url); return { action: 'deny' }; }
    return {
      action: 'allow',
      overrideBrowserWindowOptions: { backgroundColor: '#2b2b2b', autoHideMenuBar: true, icon: path.join(__dirname, 'icon-512.png'),
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } }
    };
  });
  win.webContents.on('did-create-window', child => { child.setMenuBarVisibility(false); promptOnUnload(child); });
  // a downloaded version that does not start is marked bad and the built-in app is loaded again
  const fallback = () => {
    if (root === BUILTIN) return;
    const st = readJSON(STATE()) || {}; st.bad = rootVersion; writeJSON(STATE(), st);
    root = BUILTIN; rootVersion = app.getVersion();
    win.webContents.session.clearCache().finally(() => win.loadURL(startUrl()));
  };
  win.webContents.on('did-fail-load', (e, code, desc, url, isMain) => { if (isMain) fallback(); });
  win.webContents.on('render-process-gone', fallback);
  win.webContents.on('did-finish-load', () => {
    setTimeout(async () => {
      try { if (!(await win.webContents.executeJavaScript('!!window.__sketchforge'))) fallback(); } catch (e) { /* window closed */ }
    }, 8000);
  });
  win.loadURL(startUrl());
}

// Live update: download the app files listed in the website's version.json into userData/web/<version>.
let checking = false;
async function checkForUpdate() {
  const site = siteUrl(); if (!site || checking) return;
  checking = true;
  try {
    const j = await (await net.fetch(site + '/version.json', { cache: 'no-store' })).json();
    const st = readJSON(STATE()) || {};
    if (!verGt(j.version, rootVersion) || j.version === st.bad || !Array.isArray(j.files)) return;
    if (j.shell && j.shell.desktop && verGt(j.shell.desktop, app.getVersion())) return; // needs a new installer: the page shows the download card
    const dir = path.join(LIVE(), j.version), tmp = dir + '.part';
    fs.rmSync(tmp, { recursive: true, force: true });
    for (const f of j.files) {
      const r = await net.fetch(`${site}/app/${f.path}?v=${j.version}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(f.path + ': HTTP ' + r.status);
      const b = Buffer.from(await r.arrayBuffer());
      if (f.size && b.length !== f.size) throw new Error(f.path + ': incomplete download');
      const out = path.join(tmp, f.path); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, b);
    }
    // keep the shell's own config (site / backend), then switch
    fs.copyFileSync(path.join(BUILTIN, 'cloud-config.js'), path.join(tmp, 'cloud-config.js'));
    fs.rmSync(dir, { recursive: true, force: true }); fs.renameSync(tmp, dir);
    writeJSON(STATE(), { version: j.version, bad: st.bad });
    // old copies
    for (const d of fs.readdirSync(LIVE())) if (/^\d+\.\d+\.\d+/.test(d) && d !== j.version && d !== rootVersion) fs.rmSync(path.join(LIVE(), d), { recursive: true, force: true });
    root = dir; rootVersion = j.version; // new pages load the new files
    if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.executeJavaScript(`window.sfUpdateReady && window.sfUpdateReady(${JSON.stringify(j.version)}, ${JSON.stringify(j.notes || '')})`).catch(() => {});
  } catch (e) {
    console.warn('update check failed:', e.message);
  } finally { checking = false; }
}

app.whenReady().then(() => {
  pickRoot();
  protocol.handle('sfapp', serve);
  // Time-lapse "Whole screen" mode: getDisplayMedia records the app's own window.
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => callback({ video: request.frame }));
  createWindow();
  setTimeout(checkForUpdate, 10000);
  setInterval(checkForUpdate, 6 * 3600 * 1000);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
