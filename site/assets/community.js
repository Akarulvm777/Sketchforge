/* Sketchforge website › Community: art and time-lapse videos, brushes / tools / themes (shared_items + the public
   "shared" bucket) and comments (comments table: on an item, or without item = a review / idea). Every post shows its
   author's name and the date. Browsing needs no account; posting, uploading and downloading tools need sign-in.
   Tables and rules: supabase/setup.sql (section 5). */
(function () {
  const SB = window.SFSB, $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const when = t => new Date(t).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const by = (a, t) => `<p class="cby small muted">by <b>${esc(a || 'someone')}</b> · ${when(t)}</p>`;
  const TABS = {
    art: { kinds: ['art', 'timelapse'], title: 'Share your art or a time-lapse', accept: 'image/*,video/*', help: 'A picture (PNG, JPEG, WebP, GIF) or a time-lapse video (WebM, MP4) — export it from the app with File › Export, or the time-lapse ▾ menu. Up to 100 MB.' },
    tools: { kinds: ['brush', 'theme'], title: 'Share a brush, tool or theme', accept: '.sut,.sfbrush,.sftheme,.zip', help: 'Clip Studio tools (.sut), Sketchforge brushes (.sfbrush, from the brush editor) or themes (.sftheme, from 🎨 Custom P).' },
    reviews: {}
  };
  const KIND_LABEL = { art: 'Art', timelapse: 'Time-lapse', brush: 'Brush / tool', theme: 'Theme' };
  let tab = 'art', stars = 0;

  if (!SB || !SB.ready) { $('#cNotSetUp').hidden = false; return; }
  $('#cMain').hidden = false;
  const me = () => SB.profile();

  document.querySelectorAll('.ctabs button').forEach(b => b.onclick = () => { tab = b.dataset.tab; document.querySelectorAll('.ctabs button').forEach(x => x.classList.toggle('on', x === b)); show(); });
  // stars for reviews
  const st = $('#cStars');
  for (let i = 1; i <= 5; i++) { const s = document.createElement('button'); s.type = 'button'; s.textContent = '★'; s.onclick = () => { stars = stars === i ? 0 : i; paintStars(); }; st.appendChild(s); }
  const paintStars = () => [...st.children].forEach((s, i) => s.classList.toggle('on', i < stars));

  function show() {
    const signed = !!me(), T = TABS[tab];
    $('#cSignin').hidden = signed;
    $('#cShare').hidden = !signed || tab === 'reviews';
    $('#cReview').hidden = !signed || tab !== 'reviews';
    if (tab !== 'reviews') {
      $('#cShareTitle').textContent = T.title; $('#cFileHelp').textContent = T.help;
      const f = $('#cShare'); f.file.accept = T.accept;
      f.kind.innerHTML = T.kinds.map(k => `<option value="${k}">${KIND_LABEL[k]}</option>`).join('');
    }
    load();
  }
  async function load() {
    const L = $('#cList'); L.className = tab === 'reviews' ? 'clist' : 'cgrid'; L.innerHTML = '<p class="muted small">Loading…</p>';
    try {
      if (tab === 'reviews') {
        const rows = await SB.restPublic('comments?item_id=is.null&select=*&order=created_at.desc&limit=200');
        L.innerHTML = rows.length ? rows.map(reviewCard).join('') : '<p class="muted">No reviews yet — be the first!</p>';
      } else {
        const rows = await SB.restPublic(`shared_items?kind=in.(${TABS[tab].kinds.join(',')})&select=*&order=created_at.desc&limit=120`);
        L.innerHTML = rows.length ? '' : '<p class="muted">Nothing shared yet — be the first!</p>';
        for (const r of rows) L.appendChild(itemCard(r));
      }
      wireDeletes(L);
    } catch (e) { L.innerHTML = `<p class="muted">Could not load: ${esc(e.message)}</p>`; }
  }
  const mine = r => me() && r.user_id === me().id;
  function reviewCard(r) {
    return `<article class="card ccomment"><div class="cstarsro">${r.rating ? '★'.repeat(r.rating) + '<span>' + '★'.repeat(5 - r.rating) + '</span>' : ''}</div><p>${esc(r.body).replace(/\n/g, '<br>')}</p>${by(r.author, r.created_at)}${mine(r) ? `<button class="mini cdel" data-c="${r.id}">Delete</button>` : ''}</article>`;
  }
  function itemCard(r) {
    const el = document.createElement('article'); el.className = 'card citem';
    const url = SB.publicUrl('shared', r.file_path);
    const media = r.kind === 'art' ? `<img loading="lazy" src="${esc(url)}" alt="${esc(r.name)}">`
      : r.kind === 'timelapse' ? `<video controls preload="metadata" src="${esc(url)}"></video>`
      : `<div class="cfile">${r.kind === 'theme' ? '🎨' : '🖌'} <span>${esc(r.file_name)}</span></div>`;
    const tool = r.kind === 'brush' || r.kind === 'theme';
    el.innerHTML = `${media}<h3>${esc(r.name)} <span class="ctag">${KIND_LABEL[r.kind]}</span></h3>${r.description ? `<p class="small">${esc(r.description)}</p>` : ''}${by(r.author, r.created_at)}
      <div class="crow">${tool ? `<button class="btn cdl">⬇ Download</button> <span class="small muted">${r.downloads || 0} downloads</span>` : ''}${mine(r) ? ` <button class="mini cdel" data-i="${r.id}" data-p="${esc(r.file_path)}">Delete</button>` : ''}</div>
      <details class="ccoms"><summary>💬 Comments</summary><div class="ccomlist"></div>${me() ? '<form class="ccomform"><input maxlength="2000" required placeholder="Write a comment…"><button class="btn">Send</button></form>' : '<p class="small muted"><a href="account.html">Sign in</a> to comment.</p>'}</details>`;
    if (tool) el.querySelector('.cdl').onclick = async () => {
      if (!me()) { location.href = 'account.html'; return; }
      try { SB.rpc('count_download', { item: r.id }).catch(() => {}); const a = document.createElement('a'); a.href = url; a.download = r.file_name; document.body.appendChild(a); a.click(); a.remove(); }
      catch (e) { alert(e.message); }
    };
    const box = el.querySelector('.ccomlist'), det = el.querySelector('details');
    const loadComs = async () => {
      const rows = await SB.restPublic(`comments?item_id=eq.${r.id}&select=*&order=created_at.asc&limit=200`);
      box.innerHTML = rows.length ? rows.map(c => `<div class="ccom"><p>${esc(c.body)}</p>${by(c.author, c.created_at)}${mine(c) ? `<button class="mini cdel" data-c="${c.id}">Delete</button>` : ''}</div>`).join('') : '<p class="small muted">No comments yet.</p>';
      wireDeletes(box, loadComs);
    };
    det.ontoggle = () => { if (det.open) loadComs(); };
    const cf = el.querySelector('.ccomform');
    if (cf) cf.onsubmit = async e => { e.preventDefault(); const t = cf.querySelector('input'); try { await SB.rest('comments', { method: 'POST', body: { item_id: r.id, author: me().name, body: t.value.trim() }, headers: { Prefer: 'return=minimal' } }); t.value = ''; loadComs(); } catch (er) { alert(er.message); } };
    return el;
  }
  function wireDeletes(root, after) {
    root.querySelectorAll('.cdel').forEach(b => b.onclick = async () => {
      if (!confirm('Delete this?')) return;
      try {
        if (b.dataset.c) await SB.rest('comments?id=eq.' + b.dataset.c, { method: 'DELETE' });
        else { await SB.rest('shared_items?id=eq.' + b.dataset.i, { method: 'DELETE' }); await SB.remove('shared', [b.dataset.p]).catch(() => {}); }
        after ? after() : load();
      } catch (e) { alert(e.message); }
    });
  }
  $('#cShare').onsubmit = async e => {
    e.preventDefault(); const f = e.target, file = f.file.files[0], msg = $('#cShareMsg'); if (!file) return;
    if (file.size > 100 * 1024 * 1024) { msg.textContent = 'The file is bigger than 100 MB.'; return; }
    let kind = f.kind.value;
    if (tab === 'art') kind = /^video\//.test(file.type) ? 'timelapse' : 'art';
    if (tab === 'tools') kind = /\.sftheme$/i.test(file.name) ? 'theme' : 'brush';
    msg.textContent = 'Uploading…';
    try {
      const path = `${me().id}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`;
      try { await SB.upload('shared', path, file, file.type, { upsert: false }); } // a new file name every time: plain upload
      catch (er) { throw new Error('uploading the file was refused (' + er.message + ')'); }
      try { await SB.rest('shared_items', { method: 'POST', body: { kind, name: f.name.value.trim(), description: f.description.value.trim(), author: me().name, file_path: path, file_name: file.name, size: file.size }, headers: { Prefer: 'return=minimal' } }); }
      catch (er) { throw new Error('the file was uploaded, but saving the post was refused (' + er.message + ')'); }
      f.reset(); msg.textContent = 'Published!'; load();
    } catch (er) { msg.textContent = 'Could not publish: ' + er.message; }
  };
  $('#cReview').onsubmit = async e => {
    e.preventDefault(); const f = e.target, msg = $('#cReviewMsg');
    try { await SB.rest('comments', { method: 'POST', body: { author: me().name, rating: stars || null, body: f.body.value.trim() }, headers: { Prefer: 'return=minimal' } }); f.reset(); stars = 0; paintStars(); msg.textContent = 'Thank you!'; load(); }
    catch (er) { msg.textContent = 'Could not post: ' + er.message; }
  };
  window.addEventListener('sf-auth', show);
  show();
})();
