/* ---------- Start screen (the home page before you draw) ----------
   #startHub: a full-screen page with a left rail (Draw, Home, Projects, Learn, Community, Account) and, on Home:
   start something new (illustration, manga page, animation, webtoon, open a file), Continue drawing (the files open now
   + your recent files with thumbnails), What's new in this version, Learn (tutorials and videos), Tips, and the newest
   shares of the community (Supabase shared_items, when online).
   Shown when the installed app starts (desktop app, Android / iPad app, installed web app) — and on the web if you tick
   "Show when Nexilune starts" (sketchforge.start.v1: 'on' / 'off'; unset = installed apps only). File › 🏠 Start screen.
   Recent files: IndexedDB 'sketchforge-recent' (list + each file's .sketchforge data, up to RECENT_MAX files, 40 MB each),
   recorded when you save, when auto-save runs and when you close a tab. */
const RECENT_MAX = 12;
const HUB = { view: 'home', db: null, shared: null };
const hubInstalled = () => { try { return (typeof shellInfo === 'function' && shellInfo().platform !== 'web') || matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } };
function hubPref() { try { return localStorage.getItem('sketchforge.start.v1'); } catch (e) { return null; } }
/* show at start? (pure) */
function hubShouldShow(pref, installed) { return pref === 'on' || (pref !== 'off' && !!installed); }
function recentDB() {
  if (HUB.db) return Promise.resolve(HUB.db);
  return new Promise(res => { try { const rq = indexedDB.open('sketchforge-recent', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('kv'); rq.onsuccess = () => res(HUB.db = rq.result); rq.onerror = () => res(null); } catch (e) { res(null); } });
}
async function recentKV(mode, fn) {
  const db = await recentDB(); if (!db) return null;
  return new Promise(res => { try { const tx = db.transaction('kv', mode), s = tx.objectStore('kv'); const r = fn(s); tx.oncomplete = () => res(r && r.result !== undefined ? r.result : null); tx.onerror = () => res(null); } catch (e) { res(null); } });
}
const recentList = async () => (await recentKV('readonly', s => s.get('list'))) || [];
/* the recent list after adding / replacing one file (pure): newest first, one entry per name, at most max */
function recentMerge(list, entry, max = RECENT_MAX) { return [entry, ...list.filter(e => e.name !== entry.name)].slice(0, max); }
async function recentRecord() {
  if (typeof RECENT_SKIP !== 'undefined' && RECENT_SKIP) return;
  try {
    if (!state.layers || !state.layers.some(l => !l.paper)) return;
    // everything about this document is read now (a closed tab is gone after the first await)
    const H = 180, k = H / state.h, w = Math.max(40, Math.round(state.w * k)), tc = makeCanvas(w, H), g = tc.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, H); g.drawImage(compositeFrame(state.frame, { scale: Math.min(1, k * 2) }), 0, 0, w, H);
    const entry = { name: state.name || 'Untitled', draft: !(DOCS.cur && DOCS.cur.realFile), time: Date.now(), thumb: tc.toDataURL('image/jpeg', 0.8), w: state.w, h: state.h, type: state.projectType || 'illust', frames: state.frameCount };
    const doc = await buildDocObject(undefined, { cache: true, quiet: true }), text = JSON.stringify(doc);
    if (text.length > 40e6) return;
    const list = recentMerge(await recentList(), entry), keep = new Set(list.map(e => 'doc:' + e.name));
    await recentKV('readwrite', s => { s.put(list, 'list'); s.put(text, 'doc:' + entry.name); });
    const keys = (await recentKV('readonly', s => s.getAllKeys())) || [];
    const old = keys.filter(k2 => String(k2).startsWith('doc:') && !keep.has(k2)); if (old.length) await recentKV('readwrite', s => { old.forEach(k2 => s.delete(k2)); });
  } catch (e) { console.warn('recent save failed', e); }
}
async function recentOpen(name) {
  const open = DOCS.list.find(r => docName(r) === name); if (open) { docSwitch(open); hubClose(); return; }
  const text = await recentKV('readonly', s => s.get('doc:' + name));
  if (!text) { toast('This file is no longer in the recent list'); return; }
  const e = (await recentList()).find(x => x.name === name);
  hubClose(); await openDocumentFile(new File([text], name + '.sketchforge', { type: 'application/json' }));
  if (DOCS.cur) { DOCS.cur.realFile = !(e && e.draft); syncTab(); }
}
const hubAgo = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : new Date(t).toLocaleDateString(); };
function hubNew(kind) {
  hubClose();
  if (kind === 'manga') return newMangaPage();
  if (kind === 'webtoon') { newDocument(800, 6400, 1, 12, false, 'Webtoon'); state.projectType = 'comic'; setMode('draw', true); refreshAll(); fit(); return; }
  if (typeof newSetType === 'function') newSetType(kind === 'anim' ? 'anim' : kind === 'comic' ? 'comic' : 'illust');
  $('#newDialog').showModal();
}
const HUB_LEARN = [
  ['👋', 'Welcome tour', 'Where everything is', () => tutStart('welcome')],
  ['✏️', 'Your first drawing', 'Pen, colour, layers, save', () => tutStart('first')],
  ['🎞', 'Make an animation', 'One layer, onion skin, play', () => tutStart('animation')],
  ['🦴', 'Rig like Spine', 'Main part, hair & cloth bones', () => tutStart('spinerig')],
  ['📖', 'Make a manga page', 'Pages, panels, tones', () => tutStart('mangapage')],
  ['▶', 'Video: rig the fox', '1 minute', () => CMD.foxVideo && CMD.foxVideo()],
  ['▶', 'Video: rig like Spine', 'Hair & cloth bones', () => CMD.videoSpine && CMD.videoSpine()],
  ['▶', 'Video: swap drawings', 'Faces, hands, eyes', () => CMD.videoSwap && CMD.videoSwap()]
];
function hubCards(items) { return items.map((it, i) => `<button class="hub-learn" data-i="${i}"><span class="hl-ico">${it[0]}</span><b>${escHtml(it[1])}</b><small>${escHtml(it[2])}</small></button>`).join(''); }
async function hubShared() {
  if (HUB.shared) return HUB.shared;
  const sb = window.SFSB; if (!sb || !sb.rest || !(window.SF_CLOUD || {}).url) return [];
  try { HUB.shared = await sb.rest('shared_items?select=id,kind,name,author,file_path,created_at&order=created_at.desc&limit=12'); } catch (e) { HUB.shared = []; }
  return HUB.shared || [];
}
function hubSiteLink(page) { return ((window.SF_CLOUD || {}).site || 'https://akarulvm777.github.io/Sketchforge').replace(/\/+$/, '') + '/' + page; }
async function hubRender() {
  const H = $('#startHub'); if (!H) return;
  const main = H.querySelector('.hub-main'), v = HUB.view;
  H.querySelectorAll('.hub-rail [data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  const all = await recentList();
  const liveThumb = () => { try { const H = 180, k = H / state.h, w = Math.max(40, Math.round(state.w * k)), tc = makeCanvas(w, H), g = tc.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, H); g.drawImage(compositeFrame(state.frame, { scale: Math.min(1, k * 2) }), 0, 0, w, H); return tc.toDataURL('image/jpeg', 0.8); } catch (e) { return ''; } };
  const open = DOCS.list.filter(r => !docPristine(r)).map(r => { const e = all.find(x => x.name === docName(r)) || {}; return { name: docName(r), open: true, draft: !r.realFile, thumb: r === DOCS.cur ? liveThumb() : e.thumb, type: r === DOCS.cur ? state.projectType : e.type }; });
  const recent = all.filter(e => !open.some(o => o.name === e.name));
  const fileCard = e => `<button class="hub-file" data-name="${escHtml(e.name)}">${e.thumb ? `<img src="${e.thumb}" alt="">` : '<span class="hf-blank">✎</span>'}<b>${escHtml(e.name)}</b><small>${e.open ? 'Open now' : hubAgo(e.time)}${e.type === 'comic' ? ' · 📖' : e.type === 'anim' ? ' · 🎞' : ''}</small></button>`;
  const files = [...open, ...recent].filter(e => !e.draft), drafts = [...open, ...recent].filter(e => e.draft);
  const filesHtml = files.length ? files.map(fileCard).join('') : '<p class="muted">Your saved files show here (File › Save makes a real file on your device).</p>';
  const draftsHtml = drafts.length ? drafts.map(fileCard).join('') : '';
  const newCards = `<div class="hub-new">
    <button data-new="illust"><span>🖼</span><b>Illustration</b><small>A new picture</small></button>
    <button data-new="manga"><span>📖</span><b>Manga / comic</b><small>Pages, panels, tones</small></button>
    <button data-new="anim"><span>🎞</span><b>Animation</b><small>Timeline, onion skin</small></button>
    <button data-new="webtoon"><span>📜</span><b>Webtoon</b><small>A long vertical strip</small></button>
    <button data-cmd="open"><span>📂</span><b>Open a file</b><small>.sketchforge, PSD, images</small></button></div>`;
  const changes = (typeof APP_CHANGES !== 'undefined' ? APP_CHANGES : []).slice(0, 3);
  const news = changes.map(c => `<div class="hub-news"><b>${escHtml(c.title[0].toUpperCase() + c.title.slice(1))}</b><p>${escHtml(c.items[0]).slice(0, 220)}${c.items[0].length > 220 ? '…' : ''}</p></div>`).join('');
  const tips = (typeof HELP_TIPS !== 'undefined' ? HELP_TIPS : []).slice().sort(() => Math.random() - 0.5).slice(0, 3)
    .map(t => `<div class="hub-tip"><b>💡 ${escHtml(t.t)}</b><p>${escHtml(String(t.x).replace(/\[\[[^\]]*\]\]/g, '').replace(/<[^>]+>/g, '')).slice(0, 170)}…</p></div>`).join('');
  const sec = (title, more, body) => `<section class="hub-sec"><div class="hub-sec-h"><h3>${title}</h3>${more || ''}</div>${body}</section>`;
  let html = '';
  if (v === 'home') {
    html = sec('Start something new', '', newCards)
      + sec('Continue drawing', files.length > 5 ? '<a href="#" data-v="projects">See all</a>' : '', `<div class="hub-files">${filesHtml}</div>`)
      + (drafts.length ? sec('📝 Drafts — not saved as files', '<span class="muted small">Kept inside Nexilune only: deleted if you reinstall or reset it. Open one and use File › Save to keep it.</span>', `<div class="hub-files">${draftsHtml}</div>`) : '')
      + `<div class="hub-two">${sec(`What's new in ${APP_VERSION}`, '<a href="#" data-cmd="whatsNew">All changes</a>', news)}${sec('Tips', '<a href="#" data-cmd="askAI">✨ Ask</a>', tips)}</div>`
      + sec('Learn', '<a href="#" data-v="learn">All tutorials</a>', `<div class="hub-learns">${hubCards(HUB_LEARN.slice(0, 8))}</div>`)
      + sec('From the community', `<a href="${hubSiteLink('shared.html')}" target="_blank" rel="noopener">See more</a>`, '<div class="hub-comm muted">Loading…</div>');
  } else if (v === 'projects') {
    html = sec('Your files', '<a href="#" data-cmd="open">Open other files…</a>', `<div class="hub-files big">${filesHtml}</div>`) + sec('Start something new', '', newCards);
  } else if (v === 'learn') {
    const all = (typeof TUTORIALS !== 'undefined' ? TUTORIALS : []).filter(t => !t.auto).map(t => [t.icon, t.title, t.desc, () => tutStart(t.id)]);
    HUB.learnAll = [...HUB_LEARN.filter(x => x[0] === '▶'), ...all];
    html = sec('Tutorials & videos', '<a href="#" data-cmd="tutorials">Open the tutorial list</a>', `<div class="hub-learns" data-all="1">${hubCards(HUB.learnAll)}</div>`);
  } else if (v === 'community') {
    html = sec('Newest shares', `<a href="${hubSiteLink('shared.html')}" target="_blank" rel="noopener">Shared art & tools</a> · <a href="${hubSiteLink('community.html')}" target="_blank" rel="noopener">Reviews & ideas</a>`, '<div class="hub-comm muted">Loading…</div>')
      + sec('Share yours', '', '<p class="muted">Share art, time-lapses, brushes, Clip Studio tools and themes on the website — sign in with Google or GitHub. In the app: ☁ Account › Brushes & themes library.</p><button class="primary" data-cmd="communityLib">Brushes & themes library</button>');
  }
  main.innerHTML = html;
  main.scrollTop = 0;
  // actions
  main.querySelectorAll('[data-new]').forEach(b => b.onclick = () => hubNew(b.dataset.new));
  main.querySelectorAll('[data-cmd]').forEach(b => b.onclick = e => { e.preventDefault(); const c = b.dataset.cmd; hubClose(); if (c === 'tutorials') CMD.tutorials ? CMD.tutorials() : null; else if (c === 'whatsNew') whatsNew(true); else if (CMD[c]) CMD[c](); });
  main.querySelectorAll('a[data-v]').forEach(a => a.onclick = e => { e.preventDefault(); HUB.view = a.dataset.v; hubRender(); });
  main.querySelectorAll('.hub-file').forEach(b => b.onclick = () => recentOpen(b.dataset.name));
  main.querySelectorAll('.hub-learns').forEach(box => box.querySelectorAll('.hub-learn').forEach(b => b.onclick = () => { const L = box.dataset.all ? HUB.learnAll : HUB_LEARN, it = L[+b.dataset.i]; hubClose(); if (it) it[3](); }));
  const comm = main.querySelector('.hub-comm');
  if (comm) {
    const items = await hubShared();
    if (!items.length) comm.innerHTML = `Nothing to show (offline, or nothing shared yet). <a href="${hubSiteLink('shared.html')}" target="_blank" rel="noopener">Open the website</a>`;
    else {
      const pub = (window.SFSB && window.SFSB.publicUrl) || null;
      comm.classList.remove('muted');
      comm.innerHTML = items.slice(0, v === 'home' ? 6 : 12).map(it => { const art = /^(art|timelapse)$/.test(it.kind), img = art && pub && /\.(png|jpe?g|webp|gif)$/i.test(it.file_path || '') ? pub('shared', it.file_path) : '';
        return `<a class="hub-share" href="${hubSiteLink('shared.html' + (art ? '#art' : '#tools'))}" target="_blank" rel="noopener">${img ? `<img src="${escHtml(img)}" alt="" loading="lazy">` : `<span class="hs-ico">${art ? '🎨' : '🖌'}</span>`}<b>${escHtml(it.name)}</b><small>${escHtml(it.kind)}${it.author ? ' · ' + escHtml(it.author) : ''}</small></a>`; }).join('');
    }
  }
}
function hubOpen(view) {
  let H = $('#startHub');
  if (!H) {
    H = document.createElement('div'); H.id = 'startHub';
    H.innerHTML = `<header class="hub-top"><img src="icon-192.png" alt=""><div class="hub-brand"><b>Nexilune</b><small>v${APP_VERSION}</small></div><span class="grow"></span>
      <label class="hub-pref"><input type="checkbox" id="hubShowAtStart"> Show when Nexilune starts</label><button class="hub-close primary" title="Go to the canvas (Esc)">Go to canvas ✕</button></header>
      <nav class="hub-rail"><button class="hub-draw" data-act="draw"><span>✎</span>Draw</button><hr>
      <button data-v="home"><span>⌂</span>Home</button><button data-v="projects"><span>🗂</span>Projects</button><button data-v="learn"><span>📚</span>Learn</button>
      <button data-v="community"><span>🌐</span>Community</button><hr><button data-act="account"><span>👤</span>Account</button></nav>
      <main class="hub-main"></main>`;
    document.body.appendChild(H);
    H.querySelector('.hub-close').onclick = hubClose;
    H.querySelector('[data-act="draw"]').onclick = () => hubNew('illust');
    H.querySelector('[data-act="account"]').onclick = () => { hubClose(); if (CMD.account) CMD.account(); };
    H.querySelectorAll('.hub-rail [data-v]').forEach(b => b.onclick = () => { HUB.view = b.dataset.v; hubRender(); });
    const cb = H.querySelector('#hubShowAtStart');
    cb.onchange = () => { try { localStorage.setItem('sketchforge.start.v1', cb.checked ? 'on' : 'off'); } catch (e) { /* ignore */ } };
    H.addEventListener('keydown', e => { if (e.key === 'Escape') hubClose(); });
  }
  H.querySelector('#hubShowAtStart').checked = hubShouldShow(hubPref(), hubInstalled());
  HUB.view = view || 'home'; H.hidden = false; document.body.classList.add('hub-open');
  H.tabIndex = -1; H.focus();
  hubRender(); if (typeof renderTabs === 'function') renderTabs(); hubPlace();
}
function hubClose() { const H = $('#startHub'); if (H) H.hidden = true; document.body.classList.remove('hub-open'); if (typeof renderTabs === 'function') renderTabs(); }
/* the Home page sits under the menu and tab bars, like a tab next to the drawing (the 🏠 Home tab) */
function hubPlace() {
  const H = $('#startHub'), bar = $('#tabrow') || $('#tabbar'); if (!H || H.hidden) return;
  const r = bar && bar.offsetParent ? bar.getBoundingClientRect() : null;
  H.style.top = (r && r.bottom > 0 ? Math.round(r.bottom) : 0) + 'px';
}
function installStartHub() {
  CMD.startHub = () => hubOpen('home');
  // 🏠 Home tab, just before the file tabs (its own element, so file tabs keep their places); a file tab closes the Home page
  const bar0 = $('#tabbar');
  if (bar0 && !$('#hometab')) {
    const row = document.createElement('div'); row.id = 'tabrow'; bar0.parentNode.insertBefore(row, bar0); row.appendChild(bar0);
    const h = document.createElement('button'); h.id = 'hometab'; h.type = 'button'; h.title = 'Home page: new files, your drafts and recent files, learn, community';
    h.textContent = '🏠 Home'; h.onclick = () => hubOpen('home'); row.insertBefore(h, bar0);
  }
  const rt0 = renderTabs; renderTabs = function () {
    const out = rt0.apply(this, arguments), bar = $('#tabbar'), open = document.body.classList.contains('hub-open');
    const h = $('#hometab'); if (h) h.classList.toggle('on', open);
    if (bar) {
      if (open) bar.querySelectorAll('.tab').forEach(t => t.classList.remove('on'));
      bar.querySelectorAll('.tab').forEach(t => t.addEventListener('click', e => { if (!e.target.classList.contains('x') && document.body.classList.contains('hub-open')) hubClose(); }));
    }
    return out;
  };
  addEventListener('resize', hubPlace);
  renderTabs();
  const F = MENUS.find(m => m[0] === 'File'); if (F) F[1].unshift(['🏠 Start screen', 'startHub'], '-');
  // recent files: on save, on auto-save, when a tab is closed
  hookAfter('saveDocument', () => recentRecord(), 10);
  if (typeof autoSaveNow === 'function') { const a0 = autoSaveNow; autoSaveNow = async function () { const out = await a0.apply(this, arguments); recentRecord(); return out; }; }
  const c0 = docClose; docClose = function (r) { if (r === DOCS.cur && !docPristine(r)) recentRecord(); return c0.apply(this, arguments); };
  // at start: after the welcome animation (and the session reopening the last work)
  if (hubShouldShow(hubPref(), hubInstalled())) Promise.resolve(typeof welcomeGate !== 'undefined' ? welcomeGate : null).then(() => setTimeout(() => { if (!document.querySelector('dialog[open]')) hubOpen('home'); }, 900));
}
