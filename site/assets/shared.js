/* Nexilune website › Shared: every shared post, art (pictures, time-lapses) or tools (brushes, .sut, themes).
   Opens on a choice between the two (or #art / #tools in the address); sorting by newest / most liked / most
   downloaded; sharing asks who made it (own / other + credit). Cards, likes, reshares, comments: assets/social.js. */
(function () {
  const S = window.SFSocial, { SB, $ } = S;
  const TABS = {
    art: { kinds: ['art', 'timelapse'], title: 'Share your art or a time-lapse', accept: 'image/*,video/*', help: 'A picture (PNG, JPEG, WebP, GIF) or a time-lapse video (WebM, MP4) — export it from the app with File › Export, or the time-lapse ▾ menu. Up to 100 MB.' },
    tools: { kinds: ['brush', 'theme'], title: 'Share a brush, tool or theme', accept: '.sut,.sfbrush,.sftheme,.zip', help: 'Clip Studio tools (.sut), Nexilune brushes (.sfbrush, from the brush editor) or themes (.sftheme, from 🎨 Custom P).' }
  };
  if (!SB || !SB.ready) { $('#cNotSetUp').hidden = false; return; }
  $('#cMain').hidden = false;
  let tab = null;
  const open = t => {
    tab = TABS[t] ? t : null;
    $('#cPick').hidden = !!tab; $('#cBrowse').hidden = !tab;
    if (tab && location.hash !== '#' + tab) history.replaceState(null, '', '#' + tab);
    if (!tab) return;
    document.querySelectorAll('.ctabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    const T = TABS[tab], f = $('#cShare');
    $('#cShareTitle').textContent = T.title; $('#cFileHelp').textContent = T.help; f.file.accept = T.accept;
    $('#cSort').querySelector('[value=downloads]').hidden = tab !== 'tools';
    show();
  };
  document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => open(b.dataset.tab));
  $('#cSort').onchange = load;
  $('#cShare').querySelectorAll('[name=origin]').forEach(r => r.onchange = () => { $('#cCreditRow').hidden = $('#cShare').origin.value !== 'other'; });
  function show() { const signed = !!S.me(); $('#cSignin').hidden = signed; $('#cShareBox').hidden = !signed; load(); }
  async function load() {
    const L = $('#cList'); L.innerHTML = '<p class="muted small">Loading…</p>';
    try {
      const sort = $('#cSort').value, order = sort === 'downloads' ? 'downloads.desc,created_at.desc' : 'created_at.desc';
      let rows = await SB.restPublic(`shared_items?kind=in.(${TABS[tab].kinds.join(',')})&select=*&order=${order}&limit=150`);
      if (!rows.length) { L.innerHTML = '<p class="muted">Nothing shared yet — be the first!</p>'; return; }
      await S.renderItems(L, rows, load);
      if (sort === 'liked') { // order the cards by their 👍 count
        const cards = [...L.children], score = c => +(c.querySelector('.cup b') || {}).textContent || 0;
        cards.sort((a, b) => score(b) - score(a)).forEach(c => L.appendChild(c));
      }
    } catch (e) { L.innerHTML = `<p class="muted">Could not load: ${S.esc(e.message)}</p>`; }
  }
  $('#cShare').onsubmit = async e => {
    e.preventDefault(); const f = e.target, file = f.file.files[0], msg = $('#cShareMsg'); if (!file) return;
    const origin = f.origin.value; if (!origin) { msg.textContent = 'Please say who made it.'; return; }
    if (origin === 'other' && !f.credit.value.trim()) { msg.textContent = 'Please give a credit: who made it or where it comes from.'; return; }
    const kind = tab === 'art' ? (/^video\//.test(file.type) ? 'timelapse' : 'art') : (/\.sftheme$/i.test(file.name) ? 'theme' : 'brush');
    msg.textContent = 'Uploading…';
    try {
      await S.publish({ file, kind, name: f.name.value.trim(), description: f.description.value.trim(), origin, credit: origin === 'other' ? f.credit.value.trim() : '' });
      f.reset(); $('#cCreditRow').hidden = true; msg.textContent = 'Published!'; load();
    } catch (er) { msg.textContent = 'Could not publish: ' + er.message; }
  };
  window.addEventListener('sf-auth', () => { if (tab) show(); });
  open((location.hash || '').slice(1));
})();
