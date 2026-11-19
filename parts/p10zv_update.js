/* ---------- Updates: the app keeps itself up to date ----------
   The website publishes /version.json (version, notes, the list of app files, download links, the oldest app
   shell that can run this version). A few seconds after start:
   - browser / iPad / PWA (served by the website): "New version — Reload" (the service worker is network-first);
   - Windows / Mac app: main.js downloads the new files itself and calls window.sfUpdateReady(version);
   - Android app: the new files are downloaded into the app's storage and opened from there next time
     (index.html's boot script; if that version fails to start, the built-in one is used again).
   If the installed app itself is too old for the update, a card links to the new installer.               */
const UPD_KEY = 'sketchforge.live.v1';
const semver = v => String(v || '0').split('.').map(x => parseInt(x, 10) || 0);
const verGt = (a, b) => { const x = semver(a), y = semver(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
const cloudCfg = () => window.SF_CLOUD || {};
const siteUrl = () => (cloudCfg().site || '').replace(/\/+$/, '');
const isElectron = () => /Electron\//.test(navigator.userAgent);
const isLiveCopy = () => location.pathname.includes('/_capacitor_file_/');
function shellInfo() {
  if (isElectron()) return { platform: 'desktop', version: new URLSearchParams(location.search).get('shell') || APP_VERSION };
  if (typeof isNativeApp === 'function' && isNativeApp()) { let v = APP_VERSION; try { v = localStorage.getItem('sketchforge.shell.v1') || v; } catch (e) { /* ignore */ } const C = window.Capacitor; return { platform: C && C.getPlatform && C.getPlatform() === 'ios' ? 'ios' : 'android', version: v }; }
  return { platform: 'web', version: APP_VERSION };
}
function updCard(html, buttons) {
  let c = $('#updCard'); if (c) c.remove();
  c = document.createElement('div'); c.id = 'updCard'; c.innerHTML = `<div>${html}</div><div class="upd-btns"></div>`;
  for (const [label, fn, primary] of buttons) { const b = document.createElement('button'); b.textContent = label; if (primary) b.className = 'primary'; b.onclick = () => { c.remove(); fn && fn(); }; c.querySelector('.upd-btns').appendChild(b); }
  document.body.appendChild(c);
  return c;
}
async function updSaveFirst() { try { if (typeof sessionSave === 'function') await sessionSave(); } catch (e) { /* ignore */ } }
const notesHtml = j => j && j.notes ? `<div class="muted small upd-notes">${String(j.notes).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</div>` : '';
/* called by the desktop shell (main.js) once the new files are downloaded */
window.sfUpdateReady = (v, notes) => updCard(`<b>⬆ Sketchforge ${v} is ready</b>${notesHtml({ notes })}<span class="muted small">Your work is kept and reopened.</span>`,
  [['Later'], ['Use it now', async () => { await updSaveFirst(); location.reload(); }, true]]);
async function androidLiveUpdate(j) {
  const FS = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
  if (!FS || !Array.isArray(j.files)) return;
  const v = j.version, base = siteUrl() + '/app/';
  for (const f of j.files) {
    const r = await fetch(base + f.path + '?v=' + v, { cache: 'no-store' });
    if (!r.ok) throw new Error(f.path + ': ' + r.status);
    const b = new Uint8Array(await r.arrayBuffer());
    if (f.size && b.length !== f.size) throw new Error(f.path + ': incomplete download');
    let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    await FS.writeFile({ path: `web/${v}/${f.path}`, data: btoa(s), directory: 'DATA', recursive: true });
  }
  const { uri } = await FS.getUri({ path: `web/${v}/index.html`, directory: 'DATA' });
  const url = window.Capacitor.convertFileSrc(uri);
  try { localStorage.setItem(UPD_KEY, JSON.stringify({ version: v, url })); } catch (e) { /* ignore */ }
  updCard(`<b>⬆ Sketchforge ${v} is ready</b>${notesHtml(j)}<span class="muted small">Your work is kept and reopened.</span>`,
    [['Later'], ['Use it now', async () => { await updSaveFirst(); location.replace(url); }, true]]);
}
/* opens an installer link in the browser (Android: the system browser downloads the .apk; Windows: the .exe) */
function openDownload(url) {
  if (isElectron()) window.open(url, '_blank'); // main.js sends web links to the browser
  else if (typeof isNativeApp === 'function' && isNativeApp()) location.assign(url); // Capacitor opens other sites in the browser
  else window.open(url, '_blank');
}
async function checkForUpdate(manual) {
  const site = siteUrl();
  if (!site) { if (manual) toast('Updates come from the Sketchforge website, which is not set up in this copy yet.'); return; }
  let j;
  try { const r = await fetch(site + '/version.json', { cache: 'no-store' }); j = await r.json(); }
  catch (e) { if (manual) toast('Could not reach the update server (offline?)'); return; }
  const sh = shellInfo();
  if (!verGt(j.version, APP_VERSION)) { if (manual) toast(`You have the latest version (${APP_VERSION}) ✓`); return; }
  const need = j.shell && j.shell[sh.platform];
  const dl = j.downloads && (sh.platform === 'android' ? j.downloads.android : sh.platform === 'ios' ? j.downloads.ios : sh.platform === 'desktop' ? (/Mac/.test(navigator.platform) ? (j.downloads.macArm || j.downloads.mac) : /Linux/.test(navigator.platform) ? j.downloads.linux : j.downloads.windows) : null);
  if (need && verGt(need, sh.version) && sh.platform !== 'web') {
    updCard(`<b>⬆ Sketchforge ${j.version} is available</b>${notesHtml(j)}Tap <b>Download update</b>, then open the file and install it <b>over this one</b> — no need to uninstall: your drawings and settings stay.`,
      [['Later'], ['Download update', () => openDownload(dl || site + '/#download'), true]]);
    return;
  }
  if (sh.platform === 'web') {
    updCard(`<b>⬆ Sketchforge ${j.version} is available</b>${notesHtml(j)}`, [['Later'], ['Reload now', async () => { await updSaveFirst(); location.reload(); }, true]]);
  } else if (sh.platform === 'android' || sh.platform === 'ios') { // the iPad app (.ipa) updates its files the same way
    try { await androidLiveUpdate(j); } catch (e) { console.warn('update', e); if (manual) toast('Update failed: ' + e.message); }
  } else if (manual) toast('Downloading Sketchforge ' + j.version + ' in the background…');
}
/* What's new: shown once, the first time a new version starts (notes from the README, injected by build.py) */
function whatsNew(force) {
  let last = null; try { last = localStorage.getItem('sketchforge.lastver'); localStorage.setItem('sketchforge.lastver', APP_VERSION); } catch (e) { /* ignore */ }
  if (!force && (!last || !verGt(APP_VERSION, last))) return; // first install: the welcome tour covers it
  if (typeof APP_CHANGES === 'undefined' || !APP_CHANGES.length) { if (force) toast('Sketchforge ' + APP_VERSION); return; }
  let d = $('#whatsNew'); if (d) d.remove();
  d = document.createElement('dialog'); d.id = 'whatsNew'; d.className = 'csdlg wndlg';
  const esc2 = s => String(s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  d.innerHTML = `<form method="dialog"><h5>🎉 Sketchforge ${APP_VERSION}: what's new</h5>
    ${last && !force ? `<p class="muted small" style="margin:0 0 8px">Updated from ${esc2(last)}. Your drawings and settings were kept.</p>` : ''}
    <div class="wnlist">${APP_CHANGES.map(c => `<section><b>${esc2(c.title.charAt(0).toUpperCase() + c.title.slice(1))}</b><ul>${c.items.map(i => /^Fixed:/i.test(i)
      ? `<li><span class="wnfix">Fixed</span> ${esc2(i.replace(/^Fixed:\s*/i, ''))}</li>` : `<li>${esc2(i)}</li>`).join('')}</ul></section>`).join('')}</div>
    <div class="dialog-actions"><span style="flex:1"></span><button value="ok" class="primary">Start drawing</button></div></form>`;
  document.body.appendChild(d); d.showModal();
}
function installUpdater() {
  // Android: remember the built-in version, and confirm that a downloaded version started fine
  try {
    if (typeof isNativeApp === 'function' && isNativeApp()) {
      if (!isLiveCopy()) localStorage.setItem('sketchforge.shell.v1', APP_VERSION);
      else { const L = JSON.parse(localStorage.getItem(UPD_KEY) || 'null'); if (L && L.version === APP_VERSION) { L.ok = APP_VERSION; localStorage.setItem(UPD_KEY, JSON.stringify(L)); } }
    }
  } catch (e) { /* ignore */ }
  try { // first start after installing the app again: settings were reset by index.html, the work is kept
    const fresh = localStorage.getItem('sketchforge.freshinstall');
    if (fresh) { localStorage.removeItem('sketchforge.freshinstall'); setTimeout(() => toast(`Sketchforge ${fresh} installed: settings are back to default, your work is kept.`, 6000), 1800); }
  } catch (e) { /* ignore */ }
  CMD.checkUpdate = () => checkForUpdate(true);
  CMD.whatsNew = () => whatsNew(true);
  CMD.about = () => toast(`Sketchforge ${APP_VERSION}${isLiveCopy() ? ' (updated)' : ''} — ${shellInfo().platform}`, 4000);
  const H = MENUS.find(m => m[0] === 'Help')[1];
  H.push('-', ["What's new in this version", 'whatsNew'], ['Check for updates', 'checkUpdate'], ['About Sketchforge', 'about']);
  if (location.hash !== '#sf-child') setTimeout(() => whatsNew(false), 1200);
  if (location.hash !== '#sf-child' && !isElectron()) setTimeout(() => checkForUpdate(false), 6000);
}
