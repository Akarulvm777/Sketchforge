/* Inkvessa website › Community: reviews & ideas (comments without item, optional 1–5 star rating), with links to
   the Shared page (art / tools) and the profile. Post cards and author links: assets/social.js. */
(function () {
  const S = window.SFSocial, { SB, $ } = S;
  let stars = 0;
  if (!SB || !SB.ready) { $('#cNotSetUp').hidden = false; return; }
  $('#cMain').hidden = false;
  const st = $('#cStars');
  for (let i = 1; i <= 5; i++) { const s = document.createElement('button'); s.type = 'button'; s.textContent = '★'; s.onclick = () => { stars = stars === i ? 0 : i; paintStars(); }; st.appendChild(s); }
  const paintStars = () => [...st.children].forEach((s, i) => s.classList.toggle('on', i < stars));
  function show() {
    const signed = !!S.me();
    $('#cSignin').hidden = signed; $('#cReview').hidden = !signed;
    $('#cMyProfile').href = signed ? 'profile.html?u=' + S.me().id : 'account.html';
    load();
  }
  async function load() {
    const L = $('#cList'); L.innerHTML = '<p class="muted small">Loading…</p>';
    try {
      const rows = await SB.restPublic('comments?item_id=is.null&select=*&order=created_at.desc&limit=200');
      await S.loadProfiles(rows.map(r => r.user_id));
      L.innerHTML = rows.length ? rows.map(S.reviewCard).join('') : '<p class="muted">No reviews yet — be the first!</p>';
      S.wireDeletes(L, load);
    } catch (e) { L.innerHTML = `<p class="muted">Could not load: ${S.esc(e.message)}</p>`; }
  }
  $('#cReview').onsubmit = async e => {
    e.preventDefault(); const f = e.target, msg = $('#cReviewMsg');
    try { await SB.rest('comments', { method: 'POST', body: { author: S.myName(), rating: stars || null, body: f.body.value.trim() }, headers: { Prefer: 'return=minimal' } }); f.reset(); stars = 0; paintStars(); msg.textContent = 'Thank you!'; load(); }
    catch (er) { msg.textContent = 'Could not post: ' + er.message; }
  };
  window.addEventListener('sf-auth', show);
  show();
})();
