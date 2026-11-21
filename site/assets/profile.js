/* Sketchforge website › Profile (profile.html?u=<user id>; without u = your own). Anyone sees the name, picture, bio,
   website and the person's shared art / tools (their own posts and reshares). The owner edits it (profiles row,
   picture squared to 256 px and uploaded to shared/<uid>/avatar-….png). */
(function () {
  const S = window.SFSocial, { SB, $, esc } = S;
  if (!SB || !SB.ready) { $('#pNotSetUp').hidden = false; return; }
  const uid = new URLSearchParams(location.search).get('u') || (S.me() && S.me().id);
  if (!uid) { $('#pAsk').hidden = false; return; }
  $('#pMain').hidden = false;
  let tab = 'art', prof = null;
  const own = () => S.me() && S.me().id === uid;
  async function loadProfile() {
    S.PROF.delete(uid); await S.loadProfiles([uid]); prof = S.PROF.get(uid);
    let fallback = own() ? S.me().name : '';
    if (!fallback) { try { const r = await SB.restPublic(`shared_items?user_id=eq.${uid}&select=author&limit=1`); fallback = r[0] && r[0].author; } catch (e) { /* none */ } }
    const name = (prof && prof.display_name) || fallback || 'Sketchforge artist';
    $('#pName').textContent = name; document.title = name + ' — Sketchforge';
    const av = (prof && prof.avatar_url) || (own() && S.me().avatar) || 'icon-192.png'; $('#pAvatar').src = av;
    $('#pBio').textContent = (prof && prof.bio) || (own() ? 'Tell people about yourself: ✏ Edit my profile.' : '');
    const site = prof && prof.website; $('#pSite').hidden = !site;
    if (site) { $('#pSite').href = /^https?:\/\//i.test(site) ? site : 'https://' + site; $('#pSite').textContent = '🔗 ' + site.replace(/^https?:\/\//i, ''); }
    $('#pEditBtn').hidden = !own();
  }
  async function loadPosts() {
    const L = $('#pList'); L.innerHTML = '<p class="muted small">Loading…</p>';
    try {
      const kinds = tab === 'art' ? 'art,timelapse' : 'brush,theme';
      const rows = await SB.restPublic(`shared_items?user_id=eq.${uid}&kind=in.(${kinds})&select=*&order=created_at.desc&limit=150`);
      const all = await SB.restPublic(`shared_items?user_id=eq.${uid}&select=id`).catch(() => rows);
      $('#pStats').textContent = `${all.length} post${all.length === 1 ? '' : 's'} shared`;
      if (!rows.length) { L.innerHTML = `<p class="muted">${own() ? 'You have' : 'Nothing'} ${own() ? 'not shared any ' + (tab === 'art' ? 'art' : 'tools') + ' yet. <a href="shared.html#' + tab + '">Share something</a>' : 'shared here yet.'}</p>`; return; }
      await S.renderItems(L, rows, loadPosts);
    } catch (e) { L.innerHTML = `<p class="muted">Could not load: ${esc(e.message)}</p>`; }
  }
  document.querySelectorAll('.ctabs button').forEach(b => b.onclick = () => { tab = b.dataset.tab; document.querySelectorAll('.ctabs button').forEach(x => x.classList.toggle('on', x === b)); loadPosts(); });
  const f = $('#pEdit');
  $('#pEditBtn').onclick = () => { f.hidden = false; f.display_name.value = (prof && prof.display_name) || S.me().name || ''; f.bio.value = (prof && prof.bio) || ''; f.website.value = (prof && prof.website) || ''; f.scrollIntoView({ behavior: 'smooth' }); };
  $('#pCancel').onclick = () => { f.hidden = true; };
  async function squareAvatar(file) { // 256 × 256 PNG, centre crop
    const img = await createImageBitmap(file), s = Math.min(img.width, img.height), c = document.createElement('canvas');
    c.width = c.height = 256; c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 256, 256);
    return new Promise(res => c.toBlob(res, 'image/png'));
  }
  f.onsubmit = async e => {
    e.preventDefault(); const msg = $('#pMsg'); msg.textContent = 'Saving…';
    try {
      const body = { id: uid, display_name: f.display_name.value.trim(), bio: f.bio.value.trim(), website: f.website.value.trim(), updated_at: new Date().toISOString() };
      const file = f.avatar.files[0];
      if (file) { const png = await squareAvatar(file), path = `${uid}/avatar-${Date.now()}.png`; await SB.upload('shared', path, png, 'image/png', { upsert: false }); body.avatar_url = SB.publicUrl('shared', path); }
      else if (prof && prof.avatar_url) body.avatar_url = prof.avatar_url;
      else if (S.me().avatar) body.avatar_url = S.me().avatar;
      await SB.rest('profiles', { method: 'POST', body, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
      msg.textContent = 'Saved!'; f.hidden = true; f.avatar.value = ''; await loadProfile(); loadPosts();
    } catch (er) { msg.textContent = 'Could not save: ' + er.message + (/profiles|relation/i.test(er.message) ? ' — the database needs the latest supabase/setup.sql (section 7).' : ''); }
  };
  window.addEventListener('sf-auth', () => { loadProfile(); loadPosts(); });
  loadProfile().then(loadPosts);
})();
