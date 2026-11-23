/* Nexilune website: the shared social parts of Community (reviews & ideas), Shared (art / tools) and Profile pages.
   Data (supabase/setup.sql, sections 5–7): shared_items (+ origin 'own' / 'other', credit, reshare_of), comments
   (item_id null = review / idea), reactions (👍 = 1 / 👎 = -1, one per person and post), profiles (name, picture, bio,
   website). Files: the public "shared" bucket, <uid>/… . Browsing needs no account; posting, reacting, resharing and
   downloading tools need sign-in. Every post shows its author (link to the profile) and the date. */
(function () {
  const SB = window.SFSB, $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const when = t => new Date(t).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const KIND_LABEL = { art: 'Art', timelapse: 'Time-lapse', brush: 'Brush / tool', theme: 'Theme' };
  const me = () => (SB && SB.ready ? SB.profile() : null);
  const mine = r => me() && r.user_id === me().id;
  const PROF = new Map(); // user id -> profile row (or null)
  async function loadProfiles(ids) {
    const need = [...new Set(ids.filter(id => id && !PROF.has(id)))];
    if (!need.length) return;
    try { const rows = await SB.restPublic(`profiles?id=in.(${need.join(',')})&select=*`); for (const id of need) PROF.set(id, null); for (const p of rows) PROF.set(p.id, p); }
    catch (e) { for (const id of need) PROF.set(id, null); } // profiles table not set up yet: names from the posts
  }
  const nameOf = (uid, fallback) => { const p = PROF.get(uid); return (p && p.display_name) || fallback || 'someone'; };
  const avatarOf = uid => { const p = PROF.get(uid); return p && p.avatar_url; };
  const byLine = (uid, author, t) => `<p class="cby small muted">${avatarOf(uid) ? `<img class="cav" src="${esc(avatarOf(uid))}" alt="">` : ''}by <a href="profile.html?u=${esc(uid)}"><b>${esc(nameOf(uid, author))}</b></a> · ${when(t)}</p>`;
  const myName = () => nameOf(me() && me().id, me() && me().name);

  /* ---- reactions (likes / dislikes) for a list of posts ---- */
  async function loadReactions(ids) {
    const out = new Map(ids.map(id => [id, { up: 0, down: 0, mine: 0 }]));
    if (!ids.length) return out;
    try {
      const rows = await SB.restPublic(`reactions?item_id=in.(${ids.join(',')})&select=item_id,user_id,value`);
      for (const r of rows) { const o = out.get(r.item_id); if (!o) continue; if (r.value > 0) o.up++; else o.down++; if (me() && r.user_id === me().id) o.mine = r.value; }
    } catch (e) { /* reactions table not set up yet */ }
    return out;
  }
  async function react(item, value, box, state) {
    if (!me()) { location.href = 'account.html'; return; }
    try {
      if (state.mine === value) { await SB.rest(`reactions?item_id=eq.${item.id}&user_id=eq.${me().id}`, { method: 'DELETE' }); if (value > 0) state.up--; else state.down--; state.mine = 0; }
      else {
        await SB.rest('reactions', { method: 'POST', body: { item_id: item.id, value }, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
        if (state.mine > 0) state.up--; else if (state.mine < 0) state.down--;
        if (value > 0) state.up++; else state.down++; state.mine = value;
      }
      paintReactions(box, state);
    } catch (e) { alert('Could not save your reaction: ' + e.message); }
  }
  function paintReactions(box, s) {
    box.querySelector('.cup').innerHTML = `👍 <b>${s.up}</b>`; box.querySelector('.cdown').innerHTML = `👎 <b>${s.down}</b>`;
    box.querySelector('.cup').classList.toggle('on', s.mine > 0); box.querySelector('.cdown').classList.toggle('on', s.mine < 0);
  }

  /* ---- a shared post (art / time-lapse / tool / theme) ---- */
  function itemCard(r, opts = {}) {
    const el = document.createElement('article'); el.className = 'card citem';
    const url = SB.publicUrl('shared', r.file_path), tool = r.kind === 'brush' || r.kind === 'theme';
    const media = r.kind === 'art' ? `<img loading="lazy" src="${esc(url)}" alt="${esc(r.name)}">`
      : r.kind === 'timelapse' ? `<video controls preload="metadata" src="${esc(url)}"></video>`
      : `<div class="cfile">${r.kind === 'theme' ? '🎨' : '🖌'} <span>${esc(r.file_name)}</span></div>`;
    const origin = r.reshare_of ? `<p class="corigin small">🔁 Reshared${r.credit ? ' from <b>' + esc(r.credit) + '</b>' : ''}</p>`
      : r.origin === 'other' ? `<p class="corigin small">📎 Not made by the poster${r.credit ? ' — credit: <b>' + esc(r.credit) + '</b>' : ''}</p>`
      : `<p class="corigin small own">✔ Made by ${esc(nameOf(r.user_id, r.author))}</p>`;
    el.innerHTML = `${media}<h3>${esc(r.name)} <span class="ctag">${KIND_LABEL[r.kind] || r.kind}</span></h3>${origin}${r.description ? `<p class="small">${esc(r.description)}</p>` : ''}${byLine(r.user_id, r.author, r.created_at)}
      <div class="crow creact"><button type="button" class="mini cup" title="I like it">👍 0</button><button type="button" class="mini cdown" title="I don't like it">👎 0</button>${r.kind === 'art' || r.kind === 'timelapse' ? '<button type="button" class="mini cshare" title="Reshare on your profile">🔁 Reshare</button>' : ''}
      ${tool ? `<button class="btn cdl">⬇ Download</button> <span class="small muted">${r.downloads || 0} downloads</span>` : `<a class="mini" href="${esc(url)}" download="${esc(r.file_name)}" target="_blank" rel="noopener">⬇</a>`}
      ${mine(r) ? `<button class="mini cdel" data-i="${r.id}" data-p="${r.reshare_of ? '' : esc(r.file_path)}">Delete</button>` : ''}</div>
      <details class="ccoms"><summary>💬 Comments</summary><div class="ccomlist"></div>${me() ? '<form class="ccomform"><input maxlength="2000" required placeholder="Write a comment…"><button class="btn">Send</button></form>' : '<p class="small muted"><a href="account.html">Sign in</a> to comment.</p>'}</details>`;
    const rs = (opts.reactions && opts.reactions.get(r.id)) || { up: 0, down: 0, mine: 0 }, rbox = el.querySelector('.creact');
    paintReactions(rbox, rs);
    rbox.querySelector('.cup').onclick = () => react(r, 1, rbox, rs);
    rbox.querySelector('.cdown').onclick = () => react(r, -1, rbox, rs);
    const sh = rbox.querySelector('.cshare');
    if (sh) sh.onclick = async () => {
      if (!me()) { location.href = 'account.html'; return; }
      if (mine(r)) { alert('This is your own post.'); return; }
      try {
        await SB.rest('shared_items', { method: 'POST', body: { kind: r.kind, name: r.name, description: r.description, author: myName(), file_path: r.file_path, file_name: r.file_name, size: r.size, origin: 'other', credit: nameOf(r.user_id, r.author), reshare_of: r.reshare_of || r.id }, headers: { Prefer: 'return=minimal' } });
        sh.textContent = '🔁 Reshared ✓'; sh.disabled = true;
      } catch (e) { alert('Could not reshare: ' + e.message); }
    };
    if (tool) el.querySelector('.cdl').onclick = () => {
      if (!me()) { location.href = 'account.html'; return; }
      SB.rpc('count_download', { item: r.id }).catch(() => {});
      const a = document.createElement('a'); a.href = url; a.download = r.file_name; document.body.appendChild(a); a.click(); a.remove();
    };
    const box = el.querySelector('.ccomlist'), det = el.querySelector('details');
    const loadComs = async () => {
      const rows = await SB.restPublic(`comments?item_id=eq.${r.id}&select=*&order=created_at.asc&limit=200`);
      await loadProfiles(rows.map(c => c.user_id));
      box.innerHTML = rows.length ? rows.map(c => `<div class="ccom"><p>${esc(c.body)}</p>${byLine(c.user_id, c.author, c.created_at)}${mine(c) ? `<button class="mini cdel" data-c="${c.id}">Delete</button>` : ''}</div>`).join('') : '<p class="small muted">No comments yet.</p>';
      wireDeletes(box, loadComs);
    };
    det.ontoggle = () => { if (det.open) loadComs(); };
    const cf = el.querySelector('.ccomform');
    if (cf) cf.onsubmit = async e => { e.preventDefault(); const t = cf.querySelector('input'); try { await SB.rest('comments', { method: 'POST', body: { item_id: r.id, author: myName(), body: t.value.trim() }, headers: { Prefer: 'return=minimal' } }); t.value = ''; loadComs(); } catch (er) { alert(er.message); } };
    wireDeletes(el, opts.reload);
    return el;
  }
  function wireDeletes(root, after) {
    root.querySelectorAll('.cdel').forEach(b => b.onclick = async () => {
      if (!confirm('Delete this?')) return;
      try {
        if (b.dataset.c) await SB.rest('comments?id=eq.' + b.dataset.c, { method: 'DELETE' });
        else { await SB.rest('shared_items?id=eq.' + b.dataset.i, { method: 'DELETE' }); if (b.dataset.p) await SB.remove('shared', [b.dataset.p]).catch(() => {}); }
        if (after) after(); else b.closest('article').remove();
      } catch (e) { alert(e.message); }
    });
  }
  /* a list of posts with their authors' profiles and reactions */
  async function renderItems(L, rows, reload) {
    await loadProfiles(rows.map(r => r.user_id));
    const reactions = await loadReactions(rows.map(r => r.id));
    L.innerHTML = '';
    for (const r of rows) L.appendChild(itemCard(r, { reactions, reload }));
  }
  function reviewCard(r) {
    return `<article class="card ccomment"><div class="cstarsro">${r.rating ? '★'.repeat(r.rating) + '<span>' + '★'.repeat(5 - r.rating) + '</span>' : ''}</div><p>${esc(r.body).replace(/\n/g, '<br>')}</p>${byLine(r.user_id, r.author, r.created_at)}${mine(r) ? `<button class="mini cdel" data-c="${r.id}">Delete</button>` : ''}</article>`;
  }
  /* upload a new post (Shared page): the file goes to shared/<uid>/…, then the post row */
  async function publish({ file, kind, name, description, origin, credit }) {
    if (file.size > 100 * 1024 * 1024) throw new Error('the file is bigger than 100 MB');
    const path = `${me().id}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`;
    try { await SB.upload('shared', path, file, file.type, { upsert: false }); } catch (er) { throw new Error('uploading the file was refused (' + er.message + ')'); }
    const body = { kind, name, description, author: myName(), file_path: path, file_name: file.name, size: file.size, origin, credit };
    try { await SB.rest('shared_items', { method: 'POST', body, headers: { Prefer: 'return=minimal' } }); }
    catch (er) { // an older database without the origin / credit columns: post without them, keep the credit in the text
      if (!/origin|credit|column/i.test(er.message)) throw new Error('the file was uploaded, but saving the post was refused (' + er.message + ')');
      delete body.origin; delete body.credit; if (origin === 'other') body.description = (description ? description + '\n' : '') + 'Credit: ' + (credit || 'not made by me');
      await SB.rest('shared_items', { method: 'POST', body, headers: { Prefer: 'return=minimal' } });
    }
  }
  window.SFSocial = { SB, $, esc, when, me, mine, KIND_LABEL, loadProfiles, nameOf, avatarOf, myName, byLine, itemCard, renderItems, reviewCard, wireDeletes, publish, PROF };
})();
