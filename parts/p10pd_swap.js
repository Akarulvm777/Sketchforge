/* ---------- Swap drawings (replacement animation): open hand ↔ closed hand, eyes open ↔ closed ----------
   Each layer can keep a small library of named drawings (l.swaps = [{ id, name, cel }]). The swap bar (Animation
   workspace, above the timeline) shows the active layer's drawings: ＋ adds the drawing of the current frame, tapping a
   drawing puts it on the current frame (a keyframe is made if needed; its position / rotation — bones, tweens — stays).
   The keyframe remembers which drawing it uses (cel._swap); "Update everywhere" copies an edited drawing back to the
   library and to every frame that uses it. Alt+] / Alt+[ = next / previous drawing. Saved in the .sketchforge file. */
let swapSeq = 1;
const swapsOf = l => (l && !l.vref ? (l.swaps || (l.swaps = [])) : []);
const swapNewId = () => 'sw' + Date.now().toString(36) + (swapSeq++);
function swapCopy(src) { const c = makeCel(true); c.getContext('2d').drawImage(src, 0, 0); return c; }
/* ＋: the current frame's drawing becomes a swap drawing */
function swapAdd(l, name) {
  l = l || activeLayer(); if (!l || l.vref) return null;
  const cel = celCanvas(l, state.frame);
  if (!cel || !celBBox(cel)) { toast('Draw something on this frame first, then ＋ adds it as a swap drawing'); return null; }
  const list = swapsOf(l);
  name = name || prompt('Name of this drawing (e.g. "Hand open", "Eyes closed"):', `Drawing ${list.length + 1}`);
  if (name === null) return null;
  const s = { id: swapNewId(), name: (name || `Drawing ${list.length + 1}`).trim(), cel: swapCopy(cel) };
  list.push(s); cel._swap = s.id;
  pushHistory({ undo() { const i = list.indexOf(s); if (i >= 0) list.splice(i, 1); if (cel._swap === s.id) delete cel._swap; renderSwapBar(true); },
    redo() { list.push(s); cel._swap = s.id; renderSwapBar(true); } });
  markDirty(); renderSwapBar(true); toast(`Added "${s.name}" — tap it on any frame to swap`, 2500);
  return s;
}
/* a swap drawing on the current frame: a new keyframe cel (keeps the frame's transform), one undo step */
function swapUse(l, id) {
  l = l || activeLayer(); const s = swapsOf(l).find(x => x.id === id); if (!s) return;
  const f = state.frame, k = keyAt(l, f), cur = k !== null ? l.cels.get(k) : null;
  if (k === f && cur && cur._swap === id) return;
  const before = snapshotTimeline();
  const c = swapCopy(s.cel);
  if (cur) {
    if (k === f) { if (cur._xf) c._xf = { ...cur._xf }; }
    else { const fp = frameParams(l, f); c._xf = { ...IDENT, x: fp.p.x, y: fp.p.y, rot: fp.p.rot, sx: fp.p.sx, sy: fp.p.sy, alpha: fp.p.alpha }; if (xfOf(cur).tween) { c._xf.tween = true; c._xf.ease = xfOf(cur).ease; } }
  }
  c._swap = id; c._ink = true; c._sv = (c._sv || 0) + 1;
  l.cels.set(f, c);
  pushHistory(timelineEntry(before, snapshotTimeline()));
  bindAll(f); refreshAll(); markDirty(); renderSwapBar(true);
}
/* the drawing on this frame (edited) → the library and every frame that uses it */
function swapUpdate(l, id) {
  l = l || activeLayer(); const s = swapsOf(l).find(x => x.id === id), cel = celCanvas(l, state.frame); if (!s || !cel) return;
  const before = snapshotTimeline(), oldCel = s.cel;
  s.cel = swapCopy(cel); s._thumb = null;
  let n = 0;
  for (const [fk, c] of l.cels) if (c._swap === id && c !== cel) { const nc = swapCopy(s.cel); if (c._xf) nc._xf = { ...c._xf }; nc._swap = id; nc._ink = true; l.cels.set(fk, nc); n++; }
  cel._swap = id;
  const after = snapshotTimeline(), newCel = s.cel;
  pushHistory({ undo() { applyTimeline(before); s.cel = oldCel; s._thumb = null; bindAll(state.frame); refreshAll(); renderSwapBar(true); },
    redo() { applyTimeline(after); s.cel = newCel; s._thumb = null; bindAll(state.frame); refreshAll(); renderSwapBar(true); } });
  bindAll(state.frame); refreshAll(); markDirty(); renderSwapBar(true);
  toast(`"${s.name}" updated${n ? ` on ${n} other frame${n > 1 ? 's' : ''}` : ''}`);
}
function swapRename(l, id) { const s = swapsOf(l).find(x => x.id === id); if (!s) return; const n = prompt('Rename the drawing:', s.name); if (n && n.trim()) { s.name = n.trim(); markDirty(); renderSwapBar(true); } }
function swapDelete(l, id) {
  const list = swapsOf(l), i = list.findIndex(x => x.id === id); if (i < 0) return;
  if (!confirm(`Remove "${list[i].name}" from the swap drawings? Frames that use it keep their drawing.`)) return;
  const s = list[i]; list.splice(i, 1);
  pushHistory({ undo() { list.splice(i, 0, s); renderSwapBar(true); }, redo() { const j = list.indexOf(s); if (j >= 0) list.splice(j, 1); renderSwapBar(true); } });
  markDirty(); renderSwapBar(true);
}
function swapStep(dir) {
  const l = activeLayer(), list = swapsOf(l); if (!list.length) { toast('This layer has no swap drawings yet: ＋ in the swap bar adds one'); return; }
  const cur = celCanvas(l, state.frame), i = cur ? list.findIndex(s => s.id === cur._swap) : -1;
  swapUse(l, list[((i < 0 ? (dir > 0 ? -1 : 0) : i) + dir + list.length) % list.length].id);
}
function swapThumb(s) {
  if (s._thumb) return s._thumb;
  const t = makeCanvas(56, 56), g = t.getContext('2d'), bb = celBBox(s.cel);
  if (bb) { const k = Math.min(52 / bb.w, 52 / bb.h); g.drawImage(s.cel, bb.x, bb.y, bb.w, bb.h, 28 - bb.w * k / 2, 28 - bb.h * k / 2, bb.w * k, bb.h * k); }
  return (s._thumb = t);
}
let swapKey = '';
function renderSwapBar(force) {
  let bar = $('#swapBar');
  if (!bar) {
    const tl = $('#tlScroll'); if (!tl) return;
    bar = document.createElement('div'); bar.id = 'swapBar'; tl.before(bar);
  }
  const l = activeLayer(), show = state.mode === 'anim' && l && !l.vref;
  bar.hidden = !show; if (!show) return;
  const list = swapsOf(l), cur = celCanvas(l, state.frame), curId = cur && cur._swap;
  const key = [l.id, state.frame, list.map(s => s.id + s.name).join(), curId, list.length].join('|');
  if (!force && key === swapKey) return; swapKey = key;
  bar.innerHTML = `<span class="sw-title" title="Swap drawings of this layer: tap one to put it on this frame">🔁 Swap <b>${esc(l.name)}</b></span>`;
  for (const s of list) {
    const b = document.createElement('button'); b.className = 'sw-item' + (s.id === curId ? ' on' : ''); b.title = s.name + ' — tap: use on this frame · right-click: rename, update, remove';
    b.appendChild(swapThumb(s)); const n = document.createElement('span'); n.textContent = s.name; b.appendChild(n);
    b.onclick = () => swapUse(l, s.id);
    b.oncontextmenu = e => { e.preventDefault(); popMenu(e.clientX, e.clientY, [['Use on this frame', () => swapUse(l, s.id)], [`Update "${s.name}" everywhere from this frame`, () => swapUpdate(l, s.id)], ['Rename…', () => swapRename(l, s.id)], '-', ['Remove from swap drawings', () => swapDelete(l, s.id)]]); };
    bar.appendChild(b);
  }
  const add = document.createElement('button'); add.className = 'sw-add'; add.textContent = '＋'; add.title = 'Add the drawing of this frame as a swap drawing'; add.onclick = () => swapAdd(l); bar.appendChild(add);
  if (curId && list.some(s => s.id === curId)) { const up = document.createElement('button'); up.className = 'sw-upd'; up.textContent = '⟳ Update everywhere'; up.title = 'You edited this drawing: copy it to the swap drawing and to every frame that uses it'; up.onclick = () => swapUpdate(l, curId); bar.appendChild(up); }
  if (!list.length) { const h = document.createElement('span'); h.className = 'sw-hint'; h.textContent = 'Draw a version (e.g. hand open) and tap ＋, then draw another version on a new frame and ＋ again. Tap a drawing to swap it on any frame.'; bar.appendChild(h); }
}
function installSwap() {
  Object.assign(CMD, { swapAdd: () => swapAdd(), swapNext: () => swapStep(1), swapPrev: () => swapStep(-1) });
  const A = MENUS.find(m => m[0] === 'Animation') || MENUS.find(m => m[0] === 'Layer');
  if (A) A[1].push('-', ['Swap: add this drawing', 'swapAdd'], ['Swap: next drawing', 'swapNext', 'Alt+]'], ['Swap: previous drawing', 'swapPrev', 'Alt+[']);
  document.addEventListener('keydown', e => { if (!e.altKey || e.ctrlKey || e.metaKey || /input|textarea|select/i.test((e.target.tagName || ''))) return; if (e.code === 'BracketRight') { e.preventDefault(); swapStep(1); } else if (e.code === 'BracketLeft') { e.preventDefault(); swapStep(-1); } });
  hookAfter('setMode', () => renderSwapBar(true));
  hookAfter('renderTimeline', () => renderSwapBar());
}
