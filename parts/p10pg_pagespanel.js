/* ---------- Pages panel for manga / comic projects ----------
   A comic or manga project (state.projectType === 'comic') is a book: each page is a frame. The Pages panel (#pagesPanel,
   inside the canvas area, on the right) shows every page as a thumbnail: click to open a page, ＋ adds a page after this
   one (as many as you like), ⧉ duplicates, ◀ ▶ move, ✕ deletes (the page functions of p10p_anim).
   Window › Pages panel: Auto (opens with a comic / manga file and closes with any other file — the default) or Off
   (sketchforge.pagespanel.v1). Comic / manga projects stay in the Drawing workspace: Animation mode is not offered. */
const PAGES = { pref: 'auto', thumbs: new Map(), t: null, dirty: new Set(), all: true, n: 0, doc: null };
try { PAGES.pref = localStorage.getItem('sketchforge.pagespanel.v1') || 'auto'; } catch (e) { /* ignore */ }
const isComic = () => state.projectType === 'comic';
/* should the panel be open? (pure) */
function pagesPanelWanted(pref, projectType) { return pref !== 'off' && projectType === 'comic'; }
function pageThumb(i) {
  const H = 132, k = H / state.h, w = Math.max(30, Math.round(state.w * k));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = H;
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, H);
  try { g.drawImage(compositeFrame(i, { scale: Math.min(1, k * 2) }), 0, 0, w, H); } catch (e) { /* ignore */ }
  return cv;
}
function renderPagesPanel() {
  const p = $('#pagesPanel'); if (!p || p.hidden) return;
  if (PAGES.n !== state.frameCount || PAGES.doc !== DOCS.cur) { PAGES.all = true; PAGES.thumbs.clear(); PAGES.n = state.frameCount; PAGES.doc = DOCS.cur; }
  const list = p.querySelector('.pp-list'); list.innerHTML = '';
  p.querySelector('.pp-count').textContent = `${state.frameCount} page${state.frameCount > 1 ? 's' : ''}`;
  for (let i = 0; i < state.frameCount; i++) {
    const cell = document.createElement('div'); cell.className = 'pp-page' + (i === state.frame ? ' on' : '');
    // thumbnails are kept; only pages that changed are drawn again (a stroke redraws its own page, not the whole book)
    let th = PAGES.thumbs.get(i); if (!th || PAGES.dirty.has(i) || PAGES.all) { th = pageThumb(i); PAGES.thumbs.set(i, th); }
    cell.appendChild(th);
    const lab = document.createElement('div'); lab.className = 'pp-lab'; lab.textContent = i + 1;
    const bar = document.createElement('div'); bar.className = 'pp-bar';
    const mk = (t, title, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.title = title; b.onclick = e => { e.stopPropagation(); fn(); PAGES.all = true; pagesChanged(); }; bar.appendChild(b); };
    mk('◀', 'Move earlier', () => pageSwap(i, i - 1)); mk('▶', 'Move later', () => pageSwap(i, i + 1)); mk('⧉', 'Duplicate this page', () => pageDup(i)); mk('✕', 'Delete this page', () => { if (confirm(`Delete page ${i + 1}?`)) pageDel(i); });
    cell.append(lab, bar);
    cell.onclick = () => { gotoFrame(i); pagesChanged(); };
    list.appendChild(cell);
  }
  PAGES.dirty.clear(); PAGES.all = false;
  const on = list.querySelector('.pp-page.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
}
/* redraw soon (after a stroke, a page change…), never during a stroke */
function pagesChanged(ms = 60) { clearTimeout(PAGES.t); PAGES.t = setTimeout(() => { if (stroke || active) { pagesChanged(400); return; } renderPagesPanel(); updatePageBar(); }, ms); }
function pagesPanelSync() {
  let p = $('#pagesPanel');
  const want = pagesPanelWanted(PAGES.pref, state.projectType);
  if (!p && want) {
    p = document.createElement('div'); p.id = 'pagesPanel';
    p.innerHTML = '<div class="pp-head"><b>📖 Pages</b><span class="pp-count muted"></span><button class="pp-x" type="button" title="Hide (Window › Pages panel)">✕</button></div><div class="pp-list"></div><button class="pp-add primary" type="button">＋ New page</button>';
    p.querySelector('.pp-add').onclick = () => { pageAdd(); pagesChanged(); };
    p.querySelector('.pp-x').onclick = () => { p.hidden = true; document.body.classList.remove('has-pages'); };
    $('#viewport').appendChild(p);
  }
  if (p) { const was = !p.hidden; p.hidden = !want; document.body.classList.toggle('has-pages', want); if (want && !was) requestAnimationFrame(() => fit()); }
  // comic / manga: drawing workspace only
  const sw = $('#modeSwitch [data-mode="anim"]'); if (sw) { sw.disabled = isComic(); sw.title = isComic() ? 'Manga / comic projects use the Drawing workspace (pages, not frames)' : 'Animation workspace (timeline)'; }
  if (want) pagesChanged();
}
/* a new page of a manga project keeps the panel borders and the print guides of the page before it */
function pageKeepLayout(at) {
  for (const l of state.layers) if ((l.draft || l.name === 'Panels') && l.cels.has(at - 1) && l.cels.has(at)) { const c = copyCel(l.cels.get(at - 1), false); l.cels.set(at, c); }
}
function installPagesPanel() {
  const pa0 = pageAdd; pageAdd = function () { const n = state.frameCount, out = pa0.apply(this, arguments); if (isComic() && state.frameCount > n) { pageKeepLayout(state.frame); refreshAll(); } return out; };
  // any file change (New, Open, tab switch) refreshes everything: open / close the panel to match the file
  hookAfter('refreshAll', () => { const p = $('#pagesPanel'), want = pagesPanelWanted(PAGES.pref, state.projectType); if ((p ? !p.hidden : false) !== want || (want && !isComic()) || (!!$('#modeSwitch [data-mode="anim"]') && $('#modeSwitch [data-mode="anim"]').disabled !== isComic())) pagesPanelSync(); });
  // Fit leaves room for the panel (on phones it covered part of the page)
  const fit0 = fit; fit = function () {
    const p = $('#pagesPanel'); if (!p || p.hidden) return fit0.apply(this, arguments);
    const r = vpRect(), pw = p.offsetWidth + 16, a = view.rot * DEG;
    const bw = Math.abs(state.w * Math.cos(a)) + Math.abs(state.h * Math.sin(a)), bh = Math.abs(state.w * Math.sin(a)) + Math.abs(state.h * Math.cos(a));
    view.scale = clamp(Math.min((r.width - pw - 32) / bw, (r.height - 40) / bh), 0.05, 32);
    anchorView((r.width - pw) / 2, r.height / 2, { x: state.w / 2, y: state.h / 2 }); applyView();
  };
  for (const n of ['undo', 'redo']) { const f0 = CMD[n]; if (typeof f0 === 'function') CMD[n] = function () { const out = f0.apply(this, arguments); if (isComic()) { PAGES.all = true; pagesChanged(150); } return out; }; } // undo can change any page
  CMD.pageAdd = () => { pageAdd(); PAGES.all = true; pagesChanged(); };
  if ($('#pgAdd')) $('#pgAdd').onclick = CMD.pageAdd;
  const sm0 = setMode;
  setMode = function (m, quiet) {
    if (m === 'anim' && isComic()) { if (!quiet) toast('This is a manga / comic project: its pages are in the Pages panel. Animation mode is for animation files.', 4000); m = 'draw'; }
    const out = sm0.call(this, m, quiet); pagesPanelSync(); return out;
  };
  hookAfter('gotoFrame', () => { if (isComic()) pagesChanged(120); });
  hookAfter('markDirty', () => { if (isComic()) { PAGES.dirty.add(state.frame); pagesChanged(700); } });
  CMD.pagesPanel = () => {
    PAGES.pref = PAGES.pref === 'off' ? 'auto' : 'off';
    try { localStorage.setItem('sketchforge.pagespanel.v1', PAGES.pref); } catch (e) { /* ignore */ }
    pagesPanelSync();
    toast(PAGES.pref === 'off' ? 'Pages panel off (Window › Pages panel turns it back on)' : 'Pages panel: opens by itself with manga / comic files');
  };
  const W = MENUS.find(m => m[0] === 'Window'); if (W) W[1].push('-', ['📖 Pages panel (manga / comic: auto / off)', 'pagesPanel']);
  pagesPanelSync();
}
