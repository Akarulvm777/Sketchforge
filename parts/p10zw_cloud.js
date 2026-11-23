/* ---------- Account and cloud (needs cloud-lib.js + cloud-config.js) ----------
   Sign in with Google or GitHub. In a browser the sign-in page comes back to the app directly; the installed apps
   (Windows / Mac / Android) open the website in the browser and pick the sign-in up with a secret one-time code.
   Then: save / open drawings in the cloud, sync settings (pens, layout, Custom P, …) between devices, browse and
   share brushes (.sut) and themes (.sftheme). (The ✨ Ask helper is free and offline: p10zxa_helper.)               */
const SB = () => window.SFSB || { ready: false, user: () => null, profile: () => null };
const SYNC_SKIP = /^sketchforge\.(auth|live|shell|session)\b/;
function cloudReady(quiet) {
  if (SB().ready) return true;
  if (!quiet) toast('Online features are not set up in this copy yet (see docs/ONLINE-SETUP.md).', 4500);
  return false;
}
function needLogin(then) {
  if (!cloudReady()) return false;
  if (SB().user()) return true;
  accountDialog(then); return false;
}
const esc = escHtml;
function cloudDlg(id, title, html, wide) {
  let d = $('#' + id);
  if (!d) { d = document.createElement('dialog'); d.id = id; d.className = 'csdlg clouddlg' + (wide ? ' wide' : ''); document.body.appendChild(d); }
  d.innerHTML = `<form method="dialog"><h5>${title}</h5><div class="cloudbody">${html}</div><div class="dialog-actions"><span style="flex:1"></span><button value="close" class="primary">Close</button></div></form>`;
  if (!d.open) d.showModal();
  return d;
}

/* ---- sign in ---- */
let linkPoll = 0;
async function signIn(provider) {
  if (!cloudReady()) return;
  const native = isElectron() || (typeof isNativeApp === 'function' && isNativeApp());
  if (!native) { // browser: go to the provider, come back here
    try { sessionStorage.setItem('sketchforge.authReturn', '1'); } catch (e) { /* ignore */ }
    location.href = SB().authorizeUrl(provider, location.href.split('#')[0]);
    return;
  }
  const site = siteUrl(); if (!site) { toast('The website address is not set up in this copy.'); return; }
  const code = SB().newLinkCode();
  const url = `${site}/link.html?p=${provider}#code=${code}`;
  if (isElectron()) window.open(url, '_blank'); // the desktop shell opens web links in the browser
  else location.assign(url); // Android: links to other sites open in the browser, the app stays
  const d = $('#acctDlg'); if (d) d.querySelector('.cloudbody').innerHTML = `<p>Finish signing in in your browser…</p><p class="muted small">Nexilune opened the website. When it says "You're signed in", come back here.</p><p><span class="spin"></span> Waiting</p><button type="button" id="acctCancel">Cancel</button>`;
  const cancel = $('#acctCancel'); if (cancel) cancel.onclick = () => { clearInterval(linkPoll); accountDialog(); };
  const t0 = Date.now(); clearInterval(linkPoll);
  linkPoll = setInterval(async () => {
    if (Date.now() - t0 > 15 * 60 * 1000) { clearInterval(linkPoll); toast('Sign-in timed out'); return; }
    try {
      const rt = await SB().claim(code);
      if (rt) { clearInterval(linkPoll); await SB().signInWithRefresh(rt); toast('Signed in as ' + SB().profile().name); accountDialog(); afterLogin(); }
    } catch (e) { /* keep waiting */ }
  }, 3000);
}
async function finishBrowserLogin() { // back from Google / GitHub in a browser: #access_token=…
  if (!/access_token=|error_description=/.test(location.hash) || !SB().ready) return;
  try {
    const s = await SB().sessionFromHash(location.hash);
    window.history.replaceState(null, '', location.pathname + location.search);
    if (s) { SB().useSession(s); toast('Signed in as ' + SB().profile().name); afterLogin(); }
  } catch (e) { toast('Sign-in failed: ' + e.message, 5000); window.history.replaceState(null, "", location.pathname + location.search); }
}
function afterLogin() { renderAcctBtn(); settingsPull(true).catch(() => {}); }
function renderAcctBtn() {
  const b = $('#acctBtn'); if (!b) return;
  const p = SB().profile();
  b.innerHTML = p ? (p.avatar ? `<img src="${esc(p.avatar)}" alt="">` : `<span class="ini">${esc((p.name || '?')[0].toUpperCase())}</span>`) : 'Sign in';
  b.classList.toggle('out', !p);
  b.title = p ? `${p.name} — account, cloud files, settings sync` : 'Sign in with Google or GitHub';
  b.classList.toggle('in', !!p);
}
function accountDialog(then) {
  if (!cloudReady()) return;
  const p = SB().profile();
  const html = p ? `<div class="acct-me">${p.avatar ? `<img src="${esc(p.avatar)}" alt="">` : ''}<div><b>${esc(p.name)}</b><div class="muted small">${esc(p.email)} · ${esc(p.provider)}</div></div></div>
      <div class="btnrow"><button type="button" data-a="files">☁ My cloud files</button><button type="button" data-a="save">Save this drawing to the cloud</button></div>
      <div class="btnrow"><button type="button" data-a="push">⬆ Upload my settings</button><button type="button" data-a="pull">⬇ Get my settings</button></div>
      <label class="check"><input type="checkbox" id="acctAuto" ${prefAutoSync() ? 'checked' : ''}> Keep my settings in sync automatically</label>
      <div class="btnrow"><button type="button" data-a="library">Brushes & themes library</button><button type="button" data-a="ai">✨ Ask the helper</button></div>
      <div class="btnrow"><button type="button" data-a="out">Sign out</button>${siteUrl() ? `<a class="btnlink" href="${esc(siteUrl())}/account.html" target="_blank" rel="noopener">Open my account on the website</a>` : ''}</div>`
    : `<p>Sign in to save drawings in the cloud, keep your settings on all your devices, and share brushes and themes. Everything else in Nexilune works without an account.</p>
      <div class="acct-providers"><button type="button" class="prov google" data-p="google">Continue with Google</button><button type="button" class="prov github" data-p="github">Continue with GitHub</button></div>
      <p class="muted small">Signing up is the same as signing in: the first time creates your account.</p>`;
  const d = cloudDlg('acctDlg', p ? '👤 Your account' : '👤 Sign in or sign up', html);
  d.querySelectorAll('[data-p]').forEach(b => b.onclick = () => signIn(b.dataset.p));
  const act = { files: cloudFiles, save: cloudSave, push: () => settingsPush(), pull: () => settingsPull(), library: libraryDialog, ai: aiOpen,
    out: async () => { await SB().signOut(); renderAcctBtn(); toast('Signed out'); accountDialog(); } };
  d.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { if (b.dataset.a !== 'out') d.close(); act[b.dataset.a](); });
  const au = d.querySelector('#acctAuto'); if (au) au.onchange = () => { try { localStorage.setItem('sketchforge.cloudsync.v1', au.checked ? '1' : '0'); } catch (e) { /* ignore */ } if (au.checked) settingsPush(true); };
  if (p && then) { d.close(); then(); }
}

/* ---- cloud drawings ---- */
const docKey = name => `${SB().user().id}/${(name || 'Untitled').replace(/[^\w\- ]+/g, '_').slice(0, 80)}.sketchforge`;
async function cloudSave() {
  if (!needLogin(cloudSave)) return;
  try {
    toast('Saving to the cloud…');
    const doc = await buildDocObject();
    const blob = new Blob([JSON.stringify(doc)], { type: 'application/json' });
    if (blob.size > 50 * 1024 * 1024) throw new Error('this drawing is bigger than 50 MB — save it as a file instead');
    await SB().upload('docs', docKey(state.name), blob, 'application/json');
    try { // small preview next to it
      const c = compositeFrame(state.frame), k = 320 / Math.max(state.w, state.h), t = makeCanvas(Math.max(1, Math.round(state.w * k)), Math.max(1, Math.round(state.h * k)));
      t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
      await SB().upload('docs', docKey(state.name).replace(/\.sketchforge$/, '.png'), await canvasToBlob(t), 'image/png');
    } catch (e) { /* preview is optional */ }
    toast(`"${state.name}" saved to your cloud ✓`);
  } catch (e) { toast('Cloud save failed: ' + e.message, 5000); }
}
async function cloudFiles() {
  if (!needLogin(cloudFiles)) return;
  const d = cloudDlg('cloudFilesDlg', '☁ My cloud files', '<p><span class="spin"></span> Loading…</p>', true);
  try {
    const list = (await SB().list('docs', SB().user().id + '/')).filter(f => /\.sketchforge$/.test(f.name));
    const pngs = new Set(); // previews are downloaded on demand
    const body = d.querySelector('.cloudbody');
    if (!list.length) { body.innerHTML = '<p>No drawings in your cloud yet. Use <b>File › Save to cloud</b>.</p>'; return; }
    body.innerHTML = `<div class="cloudgrid">${list.map(f => `<div class="cfile" data-n="${esc(f.name)}"><div class="thumb"></div><b>${esc(f.name.replace(/\.sketchforge$/, ''))}</b>
      <span class="muted small">${new Date(f.updated_at || f.created_at).toLocaleString()} · ${((f.metadata && f.metadata.size || 0) / 1048576).toFixed(1)} MB</span>
      <div class="btnrow"><button type="button" data-o>Open</button><button type="button" data-x title="Delete from the cloud">🗑</button></div></div>`).join('')}</div>`;
    for (const el of body.querySelectorAll('.cfile')) {
      const n = el.dataset.n, path = SB().user().id + '/' + n;
      SB().download('docs', path.replace(/\.sketchforge$/, '.png')).then(b => { pngs.add(n); el.querySelector('.thumb').style.backgroundImage = `url(${URL.createObjectURL(b)})`; }).catch(() => {});
      el.querySelector('[data-o]').onclick = async () => {
        try { toast('Opening…'); const b = await SB().download('docs', path); d.close(); await openDocumentFile(new File([b], n)); }
        catch (e) { toast('Could not open: ' + e.message); }
      };
      el.querySelector('[data-x]').onclick = async () => {
        if (!confirm(`Delete "${n}" from your cloud?`)) return;
        try { await SB().remove('docs', [path, path.replace(/\.sketchforge$/, '.png')]); el.remove(); } catch (e) { toast(e.message); }
      };
    }
  } catch (e) { d.querySelector('.cloudbody').innerHTML = `<p>Could not load your files: ${esc(e.message)}</p>`; }
}

/* ---- settings sync ---- */
const prefAutoSync = () => { try { return localStorage.getItem('sketchforge.cloudsync.v1') !== '0'; } catch (e) { return false; } };
function settingsSnapshot() {
  const o = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('sketchforge.') && !SYNC_SKIP.test(k) && k !== 'sketchforge.cloudsync.v1') o[k] = localStorage.getItem(k); }
  return o;
}
async function settingsPush(quiet) {
  if (!SB().user()) { if (!quiet) needLogin(() => settingsPush()); return; }
  try {
    await SB().rest('settings', { method: 'POST', body: { user_id: SB().user().id, data: settingsSnapshot(), updated_at: new Date().toISOString() }, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
    try { localStorage.setItem('sketchforge.cloudsync.at', String(Date.now())); } catch (e) { /* ignore */ }
    if (!quiet) toast('Settings uploaded ✓');
  } catch (e) { if (!quiet) toast('Upload failed: ' + e.message); }
}
async function settingsPull(auto) {
  if (!SB().user()) { if (!auto) needLogin(() => settingsPull()); return; }
  if (auto && !prefAutoSync()) return;
  const rows = await SB().rest(`settings?select=data,updated_at&user_id=eq.${SB().user().id}`);
  const row = rows && rows[0];
  if (!row) { if (auto) settingsPush(true); else toast('No settings in your cloud yet — upload them first'); return; }
  const mine = +(localStorage.getItem('sketchforge.cloudsync.at') || 0);
  if (auto && Date.parse(row.updated_at) <= mine) return settingsPush(true); // this device is newer
  const changed = Object.entries(row.data || {}).filter(([k, v]) => k.startsWith('sketchforge.') && !SYNC_SKIP.test(k) && localStorage.getItem(k) !== v);
  if (!changed.length) { if (!auto) toast('Your settings are already up to date ✓'); return; }
  for (const [k, v] of changed) localStorage.setItem(k, v);
  try { localStorage.setItem('sketchforge.cloudsync.at', String(Date.parse(row.updated_at))); } catch (e) { /* ignore */ }
  updCard('<b>☁ Your settings from the cloud are ready</b><span class="muted small">Reload to use them (your work is kept).</span>',
    [['Later'], ['Reload now', async () => { await updSaveFirst(); location.reload(); }, true]]);
}
let syncT = 0;
function settingsChanged() { if (!SB().user() || !prefAutoSync()) return; clearTimeout(syncT); syncT = setTimeout(() => settingsPush(true), 20000); }

/* ---- brushes & themes library ---- */
async function libraryDialog() {
  if (!cloudReady()) return;
  const d = cloudDlg('libDlg2', '🖌 Brushes & themes from the community',
    `<div class="lib-bar"><input type="search" id="libQ" placeholder="Search brushes and themes…"><select id="libK"><option value="">All</option><option value="brush">Brushes</option><option value="theme">Themes</option></select><button type="button" id="libShare" class="primary">＋ Share mine</button></div><div id="libList"><p><span class="spin"></span> Loading…</p></div>`, true);
  const load = async () => {
    const q = d.querySelector('#libQ').value.trim(), k = d.querySelector('#libK').value;
    let path = 'shared_items?select=id,kind,name,description,author,file_path,file_name,size,downloads,created_at,user_id&order=created_at.desc&limit=60';
    if (k) path += '&kind=eq.' + k;
    if (q) path += '&name=ilike.*' + encodeURIComponent(q.replace(/[*,()]/g, ' ')) + '*';
    try {
      const rows = await SB().restPublic(path);
      const me = SB().user() && SB().user().id;
      d.querySelector('#libList').innerHTML = rows.length ? `<div class="cloudgrid">${rows.map(r => `<div class="cfile lib" data-id="${r.id}"><span class="kind">${r.kind === 'brush' ? '🖌 Brush' : '🎨 Theme'}</span><b>${esc(r.name)}</b>
        <span class="muted small">${esc(r.author || 'Anonymous')} · ⬇ ${r.downloads}</span><span class="small desc">${esc(r.description)}</span>
        <div class="btnrow"><button type="button" data-add class="primary">Add to Nexilune</button>${r.user_id === me ? '<button type="button" data-del title="Stop sharing">🗑</button>' : ''}</div></div>`).join('')}</div>`
        : '<p>Nothing shared yet. Be the first: <b>＋ Share mine</b>.</p>';
      for (const el of d.querySelectorAll('.cfile.lib')) {
        const r = rows.find(x => x.id === el.dataset.id);
        el.querySelector('[data-add]').onclick = () => libInstall(r);
        const del = el.querySelector('[data-del]');
        if (del) del.onclick = async () => { if (!confirm(`Stop sharing "${r.name}"?`)) return; try { await SB().rest('shared_items?id=eq.' + r.id, { method: 'DELETE' }); await SB().remove('shared', [r.file_path]); el.remove(); } catch (e) { toast(e.message); } };
      }
    } catch (e) { d.querySelector('#libList').innerHTML = `<p>Could not load the library: ${esc(e.message)}</p>`; }
  };
  d.querySelector('#libQ').oninput = () => { clearTimeout(d._t); d._t = setTimeout(load, 300); };
  d.querySelector('#libK').onchange = load;
  d.querySelector('#libShare').onclick = () => { if (needLogin(libraryDialog)) shareDialog(); };
  load();
}
async function libInstall(r) {
  try {
    toast('Downloading ' + r.name + '…');
    const res = await fetch(SB().publicUrl('shared', r.file_path)); if (!res.ok) throw new Error('download failed');
    const file = new File([await res.blob()], r.file_name);
    if (r.kind === 'brush') await importTools([file]);
    else { await cpRestore(JSON.parse(await file.text())); toast('Theme applied ✓ (🎨 Custom P to change it)'); }
    SB().rpc('count_download', { item: r.id }).catch(() => {});
  } catch (e) { toast('Could not add it: ' + e.message, 5000); }
}
function shareDialog() {
  const p = SB().profile();
  const d = cloudDlg('shareDlg', '＋ Share a brush or theme', `
    <label class="select"><span>What</span><select id="shK"><option value="brush">Brush (.sut file)</option><option value="theme-current">My current Custom P theme</option><option value="theme">Theme file (.sftheme)</option></select></label>
    <label class="select"><span>Name</span><input id="shN" maxlength="80" placeholder="e.g. Soft charcoal"></label>
    <label class="select"><span>About it</span><input id="shD" maxlength="500" placeholder="What is it good for?"></label>
    <label class="select"><span>Shown as</span><input id="shA" maxlength="80" value="${esc(p ? p.name : '')}"></label>
    <p class="muted small">Only share brushes and themes you made yourself or are allowed to share. Everyone can download what you share; you can remove it any time.</p>
    <div class="btnrow"><button type="button" id="shGo" class="primary">Choose file & share</button></div>`);
  const kind = () => d.querySelector('#shK').value;
  d.querySelector('#shK').onchange = () => { d.querySelector('#shGo').textContent = kind() === 'theme-current' ? 'Share' : 'Choose file & share'; };
  const go = async file => {
    const name = d.querySelector('#shN').value.trim() || file.name.replace(/\.[^.]+$/, '');
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('files up to 20 MB');
      const k = kind() === 'brush' ? 'brush' : 'theme', id = crypto.randomUUID(), path = `${SB().user().id}/${id}/${file.name.replace(/[^\w.\- ]+/g, '_')}`;
      await SB().upload('shared', path, file, file.type, { upsert: false }); // new file: plain upload (no Storage update rule needed)
      await SB().rest('shared_items', { method: 'POST', body: { id, kind: k, name, description: d.querySelector('#shD').value.trim(), author: d.querySelector('#shA').value.trim(), file_path: path, file_name: file.name, size: file.size }, headers: { Prefer: 'return=minimal' } });
      d.close(); toast(`"${name}" is shared ✓`); libraryDialog();
    } catch (e) { toast('Sharing failed: ' + e.message, 5000); }
  };
  d.querySelector('#shGo').onclick = async () => {
    if (kind() === 'theme-current') { const snap = await cpSnapshot(); go(new File([JSON.stringify(snap)], 'theme.sftheme', { type: 'application/json' })); }
    else pickFile(kind() === 'brush' ? '.sut' : '.sftheme,application/json', go);
  };
}

function installCloud() {
  CMD.askAI = aiOpen;
  CMD.community = () => window.open(((window.SF_CLOUD || {}).site || 'https://akarulvm777.github.io/Sketchforge') + '/community.html', '_blank');
  MENUS.find(m => m[0] === 'Help')[1].unshift(['✨ Ask the helper (free)…', 'askAI'], ['🌐 Community: share art, tools, reviews', 'community'], '-');
  const ai = document.createElement('button'); ai.id = 'aiBtn'; ai.type = 'button'; ai.textContent = '✨ Ask'; ai.title = 'Ask where things are and how they work (free, offline)'; ai.onclick = aiOpen;
  $('#menubar .grow').after(ai);
  // phones / tablets: the top bar is full, so ✨ Ask is a round button in the corner, always in reach
  const fab = document.createElement('button'); fab.id = 'aiFab'; fab.type = 'button'; fab.textContent = '✨'; fab.title = 'Ask the helper'; fab.setAttribute('aria-label', 'Ask the helper'); fab.onclick = aiOpen;
  document.body.appendChild(fab);
  if (!SB().ready) return; // accounts are not set up in this copy: no sign-in buttons that lead nowhere
  Object.assign(CMD, { account: () => accountDialog(), cloudSave, cloudOpen: cloudFiles, syncPush: () => settingsPush(), syncPull: () => settingsPull(), communityLib: libraryDialog });
  const F = MENUS.find(m => m[0] === 'File')[1];
  const at = F.findIndex(it => Array.isArray(it) && it[1] === 'save');
  F.splice(at + 1, 0, ['☁ Save to cloud', 'cloudSave'], ['☁ Open from cloud…', 'cloudOpen']);
  MENUS.splice(MENUS.findIndex(m => m[0] === 'Help'), 0, ['☁ Account', [['Sign in / my account…', 'account'], '-', ['Save this drawing to the cloud', 'cloudSave'], ['My cloud files…', 'cloudOpen'], '-',
    ['Upload my settings', 'syncPush'], ['Get my settings', 'syncPull'], '-', ['Brushes & themes library…', 'communityLib']]]);
  const b = document.createElement('button'); b.id = 'acctBtn'; b.type = 'button'; b.onclick = () => accountDialog();
  ai.after(b);
  renderAcctBtn();
  window.addEventListener('sf-auth', renderAcctBtn);
  finishBrowserLogin();
  if (SB().user()) setTimeout(() => settingsPull(true).catch(() => {}), 3000);
  const ls = Storage.prototype.setItem; // auto-sync: notice settings changes
  Storage.prototype.setItem = function (k, v) { ls.call(this, k, v); if (this === window.localStorage && typeof k === 'string' && k.startsWith('sketchforge.') && !SYNC_SKIP.test(k) && !k.startsWith('sketchforge.cloudsync')) settingsChanged(); };
}
