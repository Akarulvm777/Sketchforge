/* ---------- Multiple documents: tabs, close, reorder, move to a new window, second view ----------
   The app keeps one document in the globals (state, history, view, sel, layerSeq, layerCounter, dirty,
   TL, aud, lightPins). Every open document has a record in DOCS.list; switching tabs stashes the globals
   into the current record and loads the other one. Inactive records hold their data in rec.saved. */
const DOC_FIELDS = ['name', 'w', 'h', 'layers', 'activeId', 'frame', 'frameCount', 'fps', 'loop', 'onion', 'mode', 'projectType', 'dpi', 'playIn', 'playOut'];
const DOCS = { list: [], cur: null, seq: 1 };

function docIsCurrent(r) { return r === DOCS.cur; }
function docName(r) { return docIsCurrent(r) ? state.name : r.saved.state.name; }
function docDirty(r) { return docIsCurrent(r) ? dirty : r.saved.dirty; }
/* the untouched blank document created at start-up can be replaced by the next New / Open */
function docPristine(r) { return r && r.blank && !dirty && !history.undo.length; }

function docStash(r) {
  const st = {}; for (const k of DOC_FIELDS) st[k] = state[k];
  r.saved = {
    state: st, undo: history.undo, redo: history.redo, view: { ...view },
    sel: { mask: sel.mask, active: sel.active, bb: sel.bb },
    layerSeq, layerCounter, dirty,
    tl: TL.frames,
    aud: { ...aud }, pins: lightPins.slice()
  };
}
function docLoad(r) {
  const s = r.saved; r.saved = null;
  Object.assign(state, s.state);
  history.undo = s.undo; history.redo = s.redo;
  Object.assign(view, s.view);
  sel.mask = s.sel.mask; sel.active = s.sel.active; sel.bb = s.sel.bb;
  layerSeq = s.layerSeq; layerCounter = s.layerCounter; dirty = s.dirty;
  TL.gen++; TL.frames = s.tl; clearTimeout(TL.vt); clearTimeout(TL.trail);
  if (aud.el && aud.el !== s.aud.el) aud.el.pause();
  Object.assign(aud, s.aud);
  lightPins.length = 0; lightPins.push(...s.pins);
}
/* Fresh globals for a document that New / Open is about to fill in. */
function docBlankGlobals() {
  history.undo = []; history.redo = [];
  sel.mask = makeCanvas(state.w, state.h); sel.active = false; sel.bb = null;
  TL.gen++; TL.frames = [];
  if (aud.el) aud.el.pause();
  Object.assign(aud, { el: null, name: '', peaks: null, dur: 0, url: '', file: null });
  lightPins.length = 0;
  state.playIn = state.playOut = null;
  dirty = false;
}
function docSettle() {
  if (stroke) endStroke(true);
  active = null;
  stop();
}
/* Called right before New / Open fills the globals: opens a new tab unless the current one is a blank start page. */
function docPrepareNew() {
  docSettle();
  const cur = DOCS.cur;
  if (docPristine(cur)) { cur.blank = false; return; }
  if (cur) docStash(cur);
  docBlankGlobals();
  const r = { id: DOCS.seq++, blank: false, saved: null };
  const at = cur ? DOCS.list.indexOf(cur) + 1 : DOCS.list.length;
  DOCS.list.splice(at, 0, r); DOCS.cur = r;
}
function docSwitch(r) {
  if (!r || r === DOCS.cur) return;
  if (busy()) return;
  docSettle();
  docStash(DOCS.cur);
  DOCS.cur = r; docLoad(r);
  for (const c of DOC_CANVASES) { if (c.width !== state.w || c.height !== state.h) { c.width = state.w; c.height = state.h; } }
  if (sel.mask.width !== state.w || sel.mask.height !== state.h) { sel.mask.width = state.w; sel.mask.height = state.h; }
  antsEdge = null; antsDirty = true; startAnts();
  setMode(state.mode || 'draw', true);
  refreshAll(); applyView(); syncTab(); updateHistoryButtons();
  if (typeof drawAudioStrip === 'function') drawAudioStrip();
  if (typeof tlUpdateBtn === 'function') tlUpdateBtn();
  subViewInvalidate();
  if (typeof sessionSoon === 'function') sessionSoon(800);
}
function docClose(r, force) {
  r = r || DOCS.cur;
  if (!force && docDirty(r) && !confirm(`"${docName(r)}" has unsaved changes. Close it anyway?`)) return false;
  const i = DOCS.list.indexOf(r);
  if (DOCS.list.length === 1) {
    // last tab: replace it with a blank document
    if (r.saved && r.saved.aud && r.saved.aud.el) r.saved.aud.el.pause();
    DOCS.list = []; DOCS.cur = null;
    newDocument(1280, 720, 1, 12, false); DOCS.cur.blank = true;
    renderTabs(); return true;
  }
  if (r === DOCS.cur) {
    const next = DOCS.list[i + 1] || DOCS.list[i - 1];
    docSwitch(next);
  }
  if (r.saved && r.saved.aud && r.saved.aud.el) r.saved.aud.el.pause();
  DOCS.list.splice(DOCS.list.indexOf(r), 1);
  renderTabs();
  if (typeof sessionSoon === 'function') sessionSoon(800);
  return true;
}
function docCloseOthers(keep) {
  for (const r of DOCS.list.slice()) if (r !== keep && !docClose(r)) return;
}
function docMove(r, toIndex) {
  const i = DOCS.list.indexOf(r); if (i < 0) return;
  DOCS.list.splice(i, 1); DOCS.list.splice(clamp(toIndex, 0, DOCS.list.length), 0, r);
  renderTabs();
}
async function docDuplicate(r) {
  if (r !== DOCS.cur) docSwitch(r);
  const json = JSON.stringify(await buildDocObject());
  await openDocumentFile(new File([json], state.name + ' copy.sketchforge'));
  state.name = state.name + ' copy'; dirty = true; syncTab();
}

/* ---- tab bar ---- */
function renderTabs() {
  const bar = $('#tabbar'); if (!bar) return;
  bar.innerHTML = '';
  for (const r of DOCS.list) {
    const t = document.createElement('div');
    t.className = 'tab' + (r === DOCS.cur ? ' on' : ''); t.draggable = true; t.dataset.id = r.id;
    t.title = docName(r) + (docDirty(r) ? ' (unsaved changes)' : '') + ' — right-click for more';
    t.innerHTML = `<span class="nm"></span><i class="dot${docDirty(r) ? ' on' : ''}"></i><button class="x" title="Close">×</button>`;
    t.querySelector('.nm').textContent = docName(r);
    t.onclick = e => { if (!e.target.classList.contains('x')) docSwitch(r); };
    t.querySelector('.x').onclick = e => { e.stopPropagation(); docClose(r); };
    t.onauxclick = e => { if (e.button === 1) { e.preventDefault(); docClose(r); } };
    t.oncontextmenu = e => { e.preventDefault(); tabMenu(r, e.clientX, e.clientY); };
    t.ondragstart = e => { e.dataTransfer.setData('text/x-sf-doc', String(r.id)); e.dataTransfer.effectAllowed = 'move'; t.classList.add('drag'); };
    t.ondragend = () => t.classList.remove('drag');
    t.ondragover = e => { if (e.dataTransfer.types.includes('text/x-sf-doc')) { e.preventDefault(); t.classList.add('over'); } };
    t.ondragleave = () => t.classList.remove('over');
    t.ondrop = e => {
      e.preventDefault(); t.classList.remove('over');
      const src = DOCS.list.find(x => String(x.id) === e.dataTransfer.getData('text/x-sf-doc'));
      if (src && src !== r) { const rect = t.getBoundingClientRect(), after = e.clientX > rect.left + rect.width / 2; const ti = DOCS.list.indexOf(r); docMove(src, DOCS.list.indexOf(src) < ti ? ti - (after ? 0 : 1) : ti + (after ? 1 : 0)); }
    };
    bar.appendChild(t);
  }
  const plus = document.createElement('button'); plus.className = 'tabplus'; plus.title = 'New document (Ctrl+N)'; plus.textContent = '+';
  plus.onclick = () => openNewDialog();
  bar.appendChild(plus);
  const on = bar.querySelector('.tab.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
function tabMenu(r, x, y) {
  let m = $('#tabMenu');
  if (!m) { m = document.createElement('div'); m.id = 'tabMenu'; m.className = 'popover tabmenu'; document.body.appendChild(m); document.addEventListener('pointerdown', e => { if (!m.contains(e.target)) m.hidden = true; }); }
  const items = [['Close', () => docClose(r)], ['Close others', () => docCloseOthers(r)], ['Duplicate', () => docDuplicate(r)], '-',
    ['Move to new window', () => docToWindow(r, true)], ['Open a copy in new window', () => docToWindow(r, false)], '-', ['Save', () => { docSwitch(r); saveDocument(); }]];
  m.innerHTML = '';
  for (const it of items) {
    if (it === '-') { m.appendChild(document.createElement('hr')); continue; }
    const b = document.createElement('button'); b.textContent = it[0]; b.onclick = () => { m.hidden = true; it[1](); }; m.appendChild(b);
  }
  m.hidden = false; m.style.left = Math.min(x, innerWidth - 220) + 'px'; m.style.top = Math.min(y, innerHeight - 260) + 'px';
}

/* ---- move / copy a document to another app window ---- */
const childWins = new Map();
async function docToWindow(r, move) {
  if (r !== DOCS.cur) docSwitch(r);
  const json = JSON.stringify(await buildDocObject());
  const w = window.open(location.href.split('#')[0] + '#sf-child', '_blank', 'popup=yes,width=1300,height=880');
  if (!w) { toast('The new window was blocked — allow pop-ups for this page'); return; }
  childWins.set(w, { json, name: state.name, dirty, rec: r, move });
  toast(move ? 'Moving "' + state.name + '" to a new window…' : 'Opening a copy in a new window…');
}
function installChildProtocol() {
  window.addEventListener('message', async e => {
    const d = e.data || {};
    if (d.type === 'sf-ready' && childWins.has(e.source)) {
      const p = childWins.get(e.source);
      e.source.postMessage({ type: 'sf-doc', json: p.json, name: p.name, dirty: p.dirty }, '*');
    } else if (d.type === 'sf-loaded' && childWins.has(e.source)) {
      const p = childWins.get(e.source); childWins.delete(e.source);
      if (p.move && DOCS.list.includes(p.rec)) docClose(p.rec, true);
    } else if (d.type === 'sf-doc' && window.opener && e.source === window.opener) {
      await openDocumentFile(new File([d.json], d.name + '.sketchforge'));
      if (d.dirty) { dirty = true; syncTab(); }
      e.source.postMessage({ type: 'sf-loaded' }, '*');
    }
  });
  if (location.hash === '#sf-child' && window.opener) {
    try { window.history.replaceState(null, '', location.href.split('#')[0]); } catch (e) { /* ignore */ }
    window.opener.postMessage({ type: 'sf-ready' }, '*');
  }
}

/* ---- second view: a live view of the current document with its own zoom / rotation / flip ---- */
const SV = { el: null, cv: null, win: null, on: false, z: 1, rot: 0, flip: false, px: 0, py: 0, fit: true, t: 0, pending: false };
function subViewInvalidate() {
  if (!SV.on || SV.pending) return;
  SV.pending = true;
  const wait = Math.max(0, 120 - (performance.now() - SV.t));
  setTimeout(() => requestAnimationFrame(() => { SV.pending = false; subViewDraw(); }), wait);
}
function subViewDraw() {
  if (!SV.on || !SV.cv) return;
  SV.t = performance.now();
  const cv = SV.cv, host = cv.parentNode; if (!host) return;
  const dpr = (SV.win ? SV.win.devicePixelRatio : devicePixelRatio) || 1;
  const W = Math.max(10, host.clientWidth), H = Math.max(10, host.clientHeight);
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
  const g = cv.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = getComputedStyle(viewport).backgroundColor || '#444'; g.fillRect(0, 0, cv.width, cv.height);
  if (SV.fit) { SV.z = Math.min(W / state.w, H / state.h) * 0.92; SV.px = 0; SV.py = 0; }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.translate(W / 2 + SV.px, H / 2 + SV.py); g.rotate(SV.rot * DEG); g.scale(SV.flip ? -SV.z : SV.z, SV.z); g.translate(-state.w / 2, -state.h / 2);
  g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 12; g.fillStyle = '#fff'; g.fillRect(0, 0, state.w, state.h); g.shadowColor = 'transparent';
  g.imageSmoothingQuality = 'high';
  g.drawImage(compositeFrame(state.frame), 0, 0);
  const lbl = SV.el && SV.el.querySelector('.svinfo'); if (lbl) lbl.textContent = `${Math.round(SV.z * 100)}% · ${Math.round(SV.rot)}°${SV.flip ? ' · flipped' : ''}`;
}
function subViewBuild() {
  if (SV.el) return;
  const el = SV.el = document.createElement('div'); el.id = 'subView'; el.className = 'subview';
  el.innerHTML = `<div class="svhead"><b>Second view</b><span class="svinfo"></span><span style="flex:1"></span>
    <button data-a="out" title="Zoom out">−</button><button data-a="in" title="Zoom in">+</button><button data-a="fit" title="Fit">Fit</button>
    <button data-a="rl" title="Rotate left">⟲</button><button data-a="rr" title="Rotate right">⟳</button><button data-a="flip" title="Flip">⇋</button>
    <button data-a="pop" title="Open in its own window">⧉</button><button data-a="close" title="Close">×</button></div><div class="svbody"></div>`;
  document.body.appendChild(el);
  SV.cv = document.createElement('canvas'); el.querySelector('.svbody').appendChild(SV.cv);
  el.querySelectorAll('[data-a]').forEach(b => b.onclick = () => subViewAction(b.dataset.a));
  // drag the panel by its header
  const head = el.querySelector('.svhead');
  head.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    const r = el.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top; head.setPointerCapture(e.pointerId);
    const mv = ev => { el.style.left = clamp(ev.clientX - ox, 0, innerWidth - 60) + 'px'; el.style.top = clamp(ev.clientY - oy, 0, innerHeight - 30) + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto'; };
    const up = () => { head.removeEventListener('pointermove', mv); head.removeEventListener('pointerup', up); };
    head.addEventListener('pointermove', mv); head.addEventListener('pointerup', up);
  });
  subViewBindCanvas(SV.cv);
  new ResizeObserver(() => subViewInvalidate()).observe(el.querySelector('.svbody'));
}
function subViewBindCanvas(cv) {
  cv.addEventListener('wheel', e => { e.preventDefault(); SV.fit = false; SV.z = clamp(SV.z * Math.exp(-e.deltaY * 0.0015), 0.02, 32); subViewDraw(); }, { passive: false });
  let drag = null;
  cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => { if (!drag) return; SV.fit = false; SV.px += e.clientX - drag.x; SV.py += e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY }; subViewDraw(); });
  cv.addEventListener('pointerup', () => { drag = null; });
  cv.addEventListener('dblclick', () => { SV.fit = true; subViewDraw(); });
}
function subViewAction(a) {
  if (a === 'in' || a === 'out') { SV.fit = false; SV.z = clamp(SV.z * (a === 'in' ? 1.25 : 0.8), 0.02, 32); }
  else if (a === 'fit') { SV.fit = true; }
  else if (a === 'rl' || a === 'rr') SV.rot = (SV.rot + (a === 'rl' ? -15 : 15) + 360) % 360;
  else if (a === 'flip') SV.flip = !SV.flip;
  else if (a === 'pop') { subViewPopOut(); return; }
  else if (a === 'close') { subViewShow(false); return; }
  subViewDraw();
}
/* The canvas moves into a separate same-origin window and keeps being drawn from here. */
function subViewPopOut() {
  if (SV.win && !SV.win.closed) { SV.win.focus(); return; }
  const w = window.open('', 'sfSecondView', 'popup=yes,width=760,height=620');
  if (!w) { toast('The window was blocked — allow pop-ups for this page'); return; }
  w.document.title = 'Second view – ' + state.name;
  w.document.body.style.cssText = 'margin:0;background:#2b2b2b;overflow:hidden;font:12px system-ui;color:#ddd';
  const bar = w.document.createElement('div'); bar.style.cssText = 'position:fixed;left:0;right:0;top:0;height:28px;display:flex;gap:4px;align-items:center;padding:0 6px;background:#1f2023;z-index:2';
  for (const [a, t] of [['out', '−'], ['in', '+'], ['fit', 'Fit'], ['rl', '⟲'], ['rr', '⟳'], ['flip', '⇋'], ['back', 'Dock back']]) {
    const b = w.document.createElement('button'); b.textContent = t; b.style.cssText = 'background:#3a3c40;color:#ddd;border:1px solid #111;border-radius:4px;padding:2px 8px;cursor:pointer';
    b.onclick = () => { if (a === 'back') { w.close(); return; } subViewAction(a); }; bar.appendChild(b);
  }
  const host = w.document.createElement('div'); host.style.cssText = 'position:fixed;left:0;right:0;top:28px;bottom:0';
  w.document.body.append(bar, host);
  host.appendChild(SV.cv);
  SV.win = w; SV.el.hidden = true;
  w.addEventListener('resize', () => subViewDraw());
  const back = () => { if (SV.win !== w) return; SV.win = null; SV.el.querySelector('.svbody').appendChild(SV.cv); SV.el.hidden = !SV.on; subViewDraw(); };
  w.addEventListener('pagehide', back);
  const poll = setInterval(() => { if (w.closed) { clearInterval(poll); back(); } }, 700);
  subViewDraw();
}
function subViewShow(on) {
  subViewBuild();
  SV.on = on === undefined ? !SV.on : !!on;
  if (!SV.on && SV.win && !SV.win.closed) SV.win.close();
  SV.el.hidden = !SV.on || !!SV.win;
  if (SV.on) subViewDraw();
}

function installMultiDoc() {
  Object.assign(CMD, {
    docClose: () => docClose(),
    docNext: () => { const i = DOCS.list.indexOf(DOCS.cur); docSwitch(DOCS.list[(i + 1) % DOCS.list.length]); },
    docPrev: () => { const i = DOCS.list.indexOf(DOCS.cur); docSwitch(DOCS.list[(i - 1 + DOCS.list.length) % DOCS.list.length]); },
    docToWindow: () => docToWindow(DOCS.cur, true),
    docCopyToWindow: () => docToWindow(DOCS.cur, false),
    subView: () => subViewShow()
  });
  const file = MENUS[0][1], at = file.findIndex(it => Array.isArray(it) && it[1] === 'save');
  file.splice(at >= 0 ? at + 1 : file.length, 0, ['Close document', 'docClose']);
  MENUS.find(m => m[0] === 'Window')[1].splice(2, 0, ['Next document', 'docNext', 'Ctrl+Tab'], ['Previous document', 'docPrev', 'Ctrl+Shift+Tab'],
    ['Move document to new window', 'docToWindow'], ['Open a copy in new window', 'docCopyToWindow'], ['Second view (show / hide)', 'subView'], '-');
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'PageDown' || (e.key === 'Tab' && !e.shiftKey))) { e.preventDefault(); CMD.docNext(); }
    else if ((e.ctrlKey || e.metaKey) && (e.key === 'PageUp' || (e.key === 'Tab' && e.shiftKey))) { e.preventDefault(); CMD.docPrev(); }
  }, true);
  window.addEventListener('beforeunload', e => { if (DOCS.list.some(r => r !== DOCS.cur && r.saved && r.saved.dirty)) { e.preventDefault(); e.returnValue = ''; } });
  installChildProtocol();
}
