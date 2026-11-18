/* Sketchforge website: download links (from version.json), sign-in, account page, app sign-in hand-over, community. */
(function () {
  const SB = window.SFSB, $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const page = location.pathname.endsWith('account.html') ? 'account' : location.pathname.endsWith('link.html') ? 'link' : 'home';
  const os = (() => { const u = navigator.userAgent; if (/iPad|iPhone|iPod/.test(u) || (/Macintosh/.test(u) && navigator.maxTouchPoints > 1)) return 'ios'; if (/Android/.test(u)) return 'android'; if (/Mac/.test(u)) return 'mac'; if (/Win/.test(u)) return 'windows'; if (/Linux/.test(u)) return 'linux'; return 'web'; })();

  function navAccount() {
    const a = $('#navAccount'); if (!a) return;
    if (!SB || !SB.ready) { a.hidden = true; return; }
    const p = SB && SB.ready && SB.profile();
    a.innerHTML = p ? (p.avatar ? `<img src="${esc(p.avatar)}" alt=""> ` : '') + esc(p.name) : 'Sign in';
  }
  async function loginFromHash() { // back from Google / GitHub
    if (!SB || !SB.ready || !/access_token=|error_description=/.test(location.hash) || page === 'link') return;
    try { const s = await SB.sessionFromHash(location.hash); if (s) SB.useSession(s); }
    catch (e) { alert('Sign-in failed: ' + e.message); }
    history.replaceState(null, '', location.pathname + location.search);
  }
  const signIn = p => { location.href = SB.authorizeUrl(p, location.href.split('#')[0]); };

  /* ---- home ---- */
  async function home() {
    try {
      const v = await (await fetch('version.json', { cache: 'no-store' })).json();
      const d = v.downloads || {};
      document.querySelectorAll('[data-dl]').forEach(a => { const u = d[a.dataset.dl]; if (u) a.href = u; else a.hidden = true; });
      $('#dlVer').textContent = `Version ${v.version} · free for everyone`;
      $('#footVer').textContent = 'Version ' + v.version;
      $('#heroVer').textContent = `Version ${v.version} · free · works offline · your files stay yours`;
      if (Array.isArray(v.changes) && v.changes.length) { // What's new: from the README notes of this version
        $('#newsVer').textContent = 'version ' + v.version;
        $('#newsDate').textContent = 'Released ' + new Date(v.date + 'T12:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) + '. Installed apps update by themselves.';
        $('#newsGrid').innerHTML = v.changes.map(c => `<article class="newscard"><h3>${esc(c.title.charAt(0).toUpperCase() + c.title.slice(1))}</h3><ul>${c.items.map(i => {
          const fix = /^Fixed:/i.test(i);
          return `<li class="${fix ? 'fix' : ''}">${fix ? '<span class="tag">Fixed</span> ' + esc(i.replace(/^Fixed:\s*/i, '')) : esc(i)}</li>`;
        }).join('')}</ul></article>`).join('');
        $('#news').hidden = false;
      }
    } catch (e) { /* local preview without version.json */ }
    const label = { windows: 'Download for Windows', mac: 'Download for Mac', android: 'Download for Android', ios: 'Get it on iPad / iPhone', linux: 'Download for Linux', web: 'Download' }[os];
    $('#heroDl').textContent = label;
    const card = document.querySelector(`.dl[data-os="${os}"]`); if (card) card.classList.add('mine');
    if (os === 'ios') $('#heroDl').href = '#download';
    // community
    const grid = $('#commGrid');
    if (!SB || !SB.ready) { $('#community').hidden = true; const l = document.querySelector('.nav a[href="#community"]'); if (l) l.hidden = true; return; }
    try {
      const rows = await SB.restPublic('shared_items?select=id,kind,name,description,author,downloads&order=downloads.desc&limit=8');
      grid.innerHTML = rows.length ? rows.map(r => `<div class="citem"><span class="kind">${r.kind === 'brush' ? '🖌 Brush' : '🎨 Theme'}</span><b>${esc(r.name)}</b><span class="muted small">by ${esc(r.author || 'Anonymous')} · ⬇ ${r.downloads}</span><span class="small">${esc(r.description)}</span></div>`).join('')
        : '<p class="muted small">Nothing shared yet — be the first, from the app.</p>';
    } catch (e) { grid.innerHTML = '<p class="muted small">Could not load the library right now.</p>'; }
  }

  /* ---- account ---- */
  async function account() {
    if (!SB || !SB.ready) { $('#notSetUp').hidden = false; return; }
    const p = SB.profile();
    if (!p) { $('#signedOut').hidden = false; document.querySelectorAll('[data-p]').forEach(b => b.onclick = () => signIn(b.dataset.p)); return; }
    $('#signedIn').hidden = false;
    $('#meName').textContent = p.name; $('#meEmail').textContent = `${p.email} · signed in with ${p.provider}`;
    if (p.avatar) $('#meAvatar').src = p.avatar; else $('#meAvatar').hidden = true;
    $('#signOut').onclick = async () => { await SB.signOut(); location.reload(); };
    // files
    try {
      const list = (await SB.list('docs', p.id + '/')).filter(f => /\.sketchforge$/.test(f.name));
      $('#myFiles').innerHTML = list.length ? list.map(f => `<div class="citem file" data-n="${esc(f.name)}"><div class="thumb"></div><b>${esc(f.name.replace(/\.sketchforge$/, ''))}</b><span class="muted small">${new Date(f.updated_at || f.created_at).toLocaleString()}</span><div class="row"><button class="btn sm" data-get>Download</button><button class="btn sm" data-del>Delete</button></div></div>`).join('')
        : '<p class="muted small">No drawings in your cloud yet.</p>';
      document.querySelectorAll('.citem.file').forEach(el => {
        const path = p.id + '/' + el.dataset.n;
        SB.download('docs', path.replace(/\.sketchforge$/, '.png')).then(b => { el.querySelector('.thumb').style.backgroundImage = `url(${URL.createObjectURL(b)})`; }).catch(() => {});
        el.querySelector('[data-get]').onclick = async () => { const b = await SB.download('docs', path); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = el.dataset.n; a.click(); };
        el.querySelector('[data-del]').onclick = async () => { if (confirm('Delete this drawing from your cloud?')) { await SB.remove('docs', [path, path.replace(/\.sketchforge$/, '.png')]); el.remove(); } };
      });
    } catch (e) { $('#myFiles').innerHTML = `<p class="muted small">Could not load: ${esc(e.message)}</p>`; }
    // shared
    try {
      const rows = await SB.rest(`shared_items?select=id,kind,name,downloads,file_path&user_id=eq.${p.id}&order=created_at.desc`);
      $('#myShared').innerHTML = rows.length ? rows.map(r => `<div class="citem" data-id="${r.id}"><span class="kind">${r.kind === 'brush' ? '🖌 Brush' : '🎨 Theme'}</span><b>${esc(r.name)}</b><span class="muted small">⬇ ${r.downloads}</span><button class="btn sm" data-del>Stop sharing</button></div>`).join('')
        : '<p class="muted small">You haven\'t shared anything yet. In the app: ☁ Account › Brushes & themes library › Share mine.</p>';
      document.querySelectorAll('#myShared .citem').forEach(el => { const r = rows.find(x => x.id === el.dataset.id); el.querySelector('[data-del]').onclick = async () => { await SB.rest('shared_items?id=eq.' + r.id, { method: 'DELETE' }); await SB.remove('shared', [r.file_path]); el.remove(); }; });
    } catch (e) { $('#myShared').innerHTML = `<p class="muted small">Could not load: ${esc(e.message)}</p>`; }
    // settings
    try {
      const rows = await SB.rest(`settings?select=updated_at,data&user_id=eq.${p.id}`);
      $('#syncInfo').textContent = rows[0] ? `Your settings were last saved ${new Date(rows[0].updated_at).toLocaleString()} (${Object.keys(rows[0].data || {}).length} items). Every device you sign in on gets them.` : 'No settings saved yet — sign in in the app and they upload by themselves.';
    } catch (e) { $('#syncInfo').textContent = 'Could not load: ' + e.message; }
  }

  /* ---- link: sign in for the installed app ---- */
  async function link() {
    const msg = $('#linkMsg'), prov = $('#linkProv');
    const fromHash = new URLSearchParams(location.hash.replace(/^#/, '')).get('code');
    if (fromHash) { sessionStorage.setItem('sf-link-code', fromHash); history.replaceState(null, '', location.pathname + location.search); }
    const code = sessionStorage.getItem('sf-link-code');
    if (!SB || !SB.ready) { msg.textContent = 'Online features are not switched on yet.'; prov.hidden = true; return; }
    if (!code) { msg.textContent = 'Open this page from the Sketchforge app (☁ Account › Sign in).'; prov.hidden = true; return; }
    const back = location.origin + location.pathname;
    prov.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { location.href = SB.authorizeUrl(b.dataset.p, back); });
    if (/access_token=/.test(location.hash)) {
      prov.hidden = true; msg.textContent = 'Signing in…';
      try {
        const s = await SB.sessionFromHash(location.hash); // used only to hand over to the app, not kept on this page
        history.replaceState(null, '', location.pathname);
        await SB.handOver(code, s);
        sessionStorage.removeItem('sf-link-code');
        $('#linkBox').innerHTML = `<h1>✓ You're signed in</h1><p>Hi ${esc((s.user && (s.user.user_metadata || {}).full_name) || '')}! Go back to the Sketchforge app — it signs in by itself in a few seconds.</p><p class="small muted">You can close this tab.</p>`;
      } catch (e) { msg.textContent = 'Sign-in failed: ' + e.message; prov.hidden = false; }
    } else {
      const p = new URLSearchParams(location.search).get('p');
      if (p === 'google' || p === 'github') { msg.textContent = 'Taking you to ' + (p === 'google' ? 'Google' : 'GitHub') + '…'; setTimeout(() => { location.href = SB.authorizeUrl(p, back); }, 600); }
    }
  }

  (async () => {
    await loginFromHash();
    navAccount();
    if (page === 'home') home(); else if (page === 'account') account(); else link();
  })();
})();
