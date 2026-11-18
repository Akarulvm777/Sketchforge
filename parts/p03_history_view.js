/* ---------- history ---------- */
const history = { undo: [], redo: [] };
const busy = () => !!(stroke || active);

function syncTab() {
  document.title = (dirty ? '• ' : '') + state.name + ' – Sketchforge';
  if (typeof renderTabs === 'function' && typeof DOCS !== 'undefined' && DOCS.list.length) renderTabs();
}
function markDirty() {
  const was = dirty; dirty = true;
  if (!was) syncTab();
  if (typeof tlCapture === 'function') tlCapture();
  if (typeof subViewInvalidate === 'function') subViewInvalidate();
}
function updateHistoryButtons() { /* menu items read the stacks when opened */ }
function pushHistory(entry) {
  history.undo.push(entry);
  if (history.undo.length > 80) history.undo.shift();
  history.redo.length = 0;
  markDirty();
  updateHistoryButtons();
}
function afterHistory() {
  state.frame = clamp(state.frame, 0, state.frameCount - 1);
  bindAll(state.frame);
  refreshStage(); renderLayers(); renderTimeline(); syncLayerControls();
  syncTimelineFields(); updateHistoryButtons(); updateOnion(); updateStatus();
  refreshProps(); drawOverlay(); markDirty();
}
function undo() {
  if (busy() || exporting) return;
  const e = history.undo.pop();
  if (!e) { toast('Nothing to undo'); return; }
  if (e.frame !== undefined) state.frame = e.frame;
  e.undo();
  history.redo.push(e);
  afterHistory();
}
function redo() {
  if (busy() || exporting) return;
  const e = history.redo.pop();
  if (!e) { toast('Nothing to redo'); return; }
  if (e.frame !== undefined) state.frame = e.frame;
  e.redo();
  history.undo.push(e);
  afterHistory();
}
function restoreRegion(ctx, b, canvas) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.clearRect(b.x, b.y, b.w, b.h);
  ctx.drawImage(canvas, b.x, b.y);
  ctx.restore();
}
function celEntry(t, b, before, after) {
  t.cel._bb = undefined;
  return {
    frame: t.frame,
    undo() { restoreRegion(t.ctx, b, before); t.cel._bb = undefined; if (t.created) t.layer.cels.delete(t.key); },
    redo() { if (t.created) t.layer.cels.set(t.key, t.cel); restoreRegion(t.ctx, b, after); t.cel._bb = undefined; }
  };
}

/* Get (or create) the cel to paint on at the current frame. */
function acquireCel(layer) {
  const f = state.frame;
  const k = keyAt(layer, f);
  let created = false;
  if (k !== f && (k === null || state.autoKey)) {
    const c = k !== null ? copyCel(layer.cels.get(k)) : makeCel(false);
    layer.cels.set(f, c);
    layer.canvas = c;
    layer.ctx = c.getContext('2d');
    created = true;
    refreshStage(); renderTimeline();
  }
  return { layer, cel: layer.canvas, ctx: layer.ctx, created, key: f, frame: f };
}
function releaseCel(t) {
  if (!t.created) return;
  t.layer.cels.delete(t.key);
  bindAll(state.frame);
  refreshStage(); renderTimeline();
}

/* ---------- view: zoom / pan / rotate / flip ---------- */
function vmat() {
  const r = view.rot * DEG, c = Math.cos(r), s = Math.sin(r), fx = view.flip ? -1 : 1, k = view.scale;
  return { a: c * fx * k, b: s * fx * k, c: -s * k, d: c * k };
}
function docToScreen(x, y) {
  const m = vmat();
  return [m.a * x + m.c * y + view.x, m.b * x + m.d * y + view.y];
}
function screenToDoc(X, Y) {
  const m = vmat();
  const det = m.a * m.d - m.b * m.c;
  const dx = X - view.x, dy = Y - view.y;
  return { x: (m.d * dx - m.c * dy) / det, y: (-m.b * dx + m.a * dy) / det };
}
function toDoc(e) {
  const r = viewport.getBoundingClientRect();
  return screenToDoc(e.clientX - r.left, e.clientY - r.top);
}
function applyView() {
  const m = vmat();
  stage.style.transform = `matrix(${m.a},${m.b},${m.c},${m.d},${view.x},${view.y})`;
  stage.classList.toggle('pixelated', view.scale >= 3);
  updateStatus();
  syncNav();
  scheduleAntsRebuild();
  drawOverlay();
  if (typeof tlViewChanged === 'function') tlViewChanged();
}
function anchorView(cx, cy, p) {
  const m = vmat();
  view.x = cx - (m.a * p.x + m.c * p.y);
  view.y = cy - (m.b * p.x + m.d * p.y);
}
function zoomAt(cx, cy, factor) {
  const p = screenToDoc(cx, cy);
  view.scale = clamp(view.scale * factor, 0.05, 32);
  anchorView(cx, cy, p);
  applyView();
}
function vpCenter() {
  const r = viewport.getBoundingClientRect();
  return [r.width / 2, r.height / 2];
}
function zoomCenter(factor) { const [cx, cy] = vpCenter(); zoomAt(cx, cy, factor); }
function zoomTo100() { const [cx, cy] = vpCenter(); zoomAt(cx, cy, 1 / view.scale); }
function setZoom(scale) { const [cx, cy] = vpCenter(); zoomAt(cx, cy, scale / view.scale); }
function rotateViewAt(deg, cx, cy) {
  const p = screenToDoc(cx, cy);
  view.rot += deg * (view.flip ? -1 : 1);
  view.rot = ((view.rot + 540) % 360) - 180;
  anchorView(cx, cy, p);
  applyView();
}
function setViewRot(deg) {
  const [cx, cy] = vpCenter();
  const p = screenToDoc(cx, cy);
  view.rot = clamp(deg, -180, 180);
  anchorView(cx, cy, p);
  applyView();
}
function flipView() {
  const [cx, cy] = vpCenter();
  const p = screenToDoc(cx, cy);
  view.flip = !view.flip;
  anchorView(cx, cy, p);
  applyView();
}
function fit() {
  const r = viewport.getBoundingClientRect();
  const a = view.rot * DEG;
  const bw = Math.abs(state.w * Math.cos(a)) + Math.abs(state.h * Math.sin(a));
  const bh = Math.abs(state.w * Math.sin(a)) + Math.abs(state.h * Math.cos(a));
  view.scale = clamp(Math.min((r.width - 40) / bw, (r.height - 40) / bh), 0.05, 32);
  anchorView(r.width / 2, r.height / 2, { x: state.w / 2, y: state.h / 2 });
  applyView();
}
function updateStatus() {
  if (typeof updatePageBar === 'function') updatePageBar();
  $('#statusText').textContent =
    (state.mode === 'anim' ? `Frame ${state.frame + 1} / ${state.frameCount}  ·  ${state.fps} fps` : (state.frameCount > 1 ? `Page ${state.frame + 1} / ${state.frameCount}` : 'Drawing')) + `  ·  ${state.w}×${state.h}`;
  $('#statusView').textContent =
    `${Math.round(view.scale * 100)}%  ·  ${Math.round(view.rot)}°${view.flip ? '  ·  flipped' : ''}`;
}

