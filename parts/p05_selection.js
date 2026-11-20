/* ---------- selection ---------- */
const sel = { active: false, mask: makeCanvas(state.w, state.h), bb: null };
const selCtx = () => sel.mask.getContext('2d');
let clipboard = null;
let antsTimer = null, antsOffset = 0, antsEdge = null, antsDirty = true;

function selSnapshot() {
  const c = makeCanvas(state.w, state.h);
  c.getContext('2d').drawImage(sel.mask, 0, 0);
  return { active: sel.active, bb: sel.bb ? { ...sel.bb } : null, canvas: c };
}
function selRestore(s) {
  const g = selCtx();
  g.globalCompositeOperation = 'copy';
  g.drawImage(s.canvas, 0, 0);
  g.globalCompositeOperation = 'source-over';
  sel.active = s.active;
  sel.bb = s.bb ? { ...s.bb } : null;
  antsDirty = true;
  startAnts();
}
function selEntry(before, after) {
  return {
    undo() { selRestore(before); },
    redo() { selRestore(after); }
  };
}
function computeBB() {
  const w = state.w, h = state.h;
  const d = selCtx().getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    for (let x = 0; x < w; x++) {
      if (d[row + x * 4 + 3] > 127) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/* Combine a shape (drawn by fn onto a fresh canvas) into the mask using the current mode. */
function combineSel(fn, mode) {
  mode = mode || state.selMode;
  const before = selSnapshot();
  const add = makeCanvas(state.w, state.h);
  fn(add.getContext('2d'));
  const g = selCtx();
  if (mode === 'replace' || !sel.active) {
    g.clearRect(0, 0, state.w, state.h);
    g.drawImage(add, 0, 0);
  } else if (mode === 'add') {
    g.drawImage(add, 0, 0);
  } else if (mode === 'subtract') {
    g.globalCompositeOperation = 'destination-out';
    g.drawImage(add, 0, 0);
    g.globalCompositeOperation = 'source-over';
  } else if (mode === 'intersect') {
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(add, 0, 0);
    g.globalCompositeOperation = 'source-over';
  }
  sel.bb = computeBB();
  sel.active = !!sel.bb;
  antsDirty = true;
  pushHistory(selEntry(before, selSnapshot()));
  startAnts();
  refreshProps(); drawOverlay();
}
function selectAll() {
  combineSel(g => { g.fillStyle = '#000'; g.fillRect(0, 0, state.w, state.h); }, 'replace');
}
function deselect() {
  if (!sel.active) return;
  const before = selSnapshot();
  selCtx().clearRect(0, 0, state.w, state.h);
  sel.active = false; sel.bb = null; antsDirty = true;
  pushHistory(selEntry(before, selSnapshot()));
  startAnts(); refreshProps(); drawOverlay();
}
function invertSel() {
  const before = selSnapshot();
  const inv = makeCanvas(state.w, state.h);
  const g = inv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, state.w, state.h);
  if (sel.active) { g.globalCompositeOperation = 'destination-out'; g.drawImage(sel.mask, 0, 0); }
  const m = selCtx();
  m.globalCompositeOperation = 'copy'; m.drawImage(inv, 0, 0); m.globalCompositeOperation = 'source-over';
  sel.bb = computeBB(); sel.active = !!sel.bb; antsDirty = true;
  pushHistory(selEntry(before, selSnapshot()));
  startAnts(); refreshProps(); drawOverlay();
}

/* Magic wand: flood fill on the (flattened or layer) pixels */
function wandSelect(px, py, mode) {
  const layer = activeLayer();
  const wm = TOOLDEF[state.tool].wand;
  if (wm === 'ref' && !state.layers.some(l => l.ref)) { toast('Mark a layer as reference first (Layer > Set as reference layer)'); return; }
  const src = wm === 'ref' ? compositeFrame(state.frame, { onlyRef: true })
    : wm === 'one' ? (layer && layer.canvas ? layer.canvas : compositeFrame(state.frame))
    : !layer || !layer.canvas || wm === 'all' || state.fillAll ? compositeFrame(state.frame) : layer.canvas;
  const w = state.w, h = state.h;
  const sx = Math.floor(px), sy = Math.floor(py);
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;
  const data = src.getContext('2d').getImageData(0, 0, w, h).data;
  const res = floodMask(data, w, h, sx, sy, state.wandTol);
  if (!res) return;
  combineSel(g => {
    const img = g.createImageData(w, h);
    for (let i = 0; i < res.mask.length; i++) if (res.mask[i]) { img.data[i * 4 + 3] = 255; }
    g.putImageData(img, 0, 0);
  }, mode);
}

/* ---------- marching ants ---------- */
function scheduleAntsRebuild() { antsDirty = true; startAnts(); }
function startAnts() {
  if (antsTimer) { clearInterval(antsTimer); antsTimer = null; }
  renderAnts();
  if (sel.active) antsTimer = setInterval(() => { antsOffset = (antsOffset + 1) % 8; renderAnts(); }, 120);
}
function buildEdge() {
  const w = state.w, h = state.h;
  const e = makeCanvas(w, h);
  if (!sel.active || !sel.bb) return e;
  const b = sel.bb;
  const x0 = Math.max(0, b.x - 1), y0 = Math.max(0, b.y - 1);
  const x1 = Math.min(w, b.x + b.w + 1), y1 = Math.min(h, b.y + b.h + 1);
  const bw = x1 - x0, bh = y1 - y0;
  const d = selCtx().getImageData(x0, y0, bw, bh).data;
  const out = new ImageData(bw, bh);
  const inside = (x, y) => x >= 0 && y >= 0 && x < bw && y < bh && d[(y * bw + x) * 4 + 3] > 127;
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      if (!inside(x, y)) continue;
      if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) {
        const j = (y * bw + x) * 4;
        out.data[j + 3] = 255;
        out.data[j] = ((x + y) % 8 < 4) ? 0 : 255;
        out.data[j + 1] = out.data[j]; out.data[j + 2] = out.data[j];
      }
    }
  }
  e.getContext('2d').putImageData(out, x0, y0);
  return e;
}
function renderAnts() {
  docSize(antsCanvas, sel.active);
  antsCtx.clearRect(0, 0, state.w, state.h);
  if (!sel.active) return;
  if (antsDirty || !antsEdge) { antsEdge = buildEdge(); antsDirty = false; }
  antsCtx.drawImage(antsEdge, 0, 0);
  /* animated dash feel: tint alternate bands */
  antsCtx.save();
  antsCtx.globalCompositeOperation = 'source-atop';
  antsCtx.fillStyle = 'rgba(255,255,255,.55)';
  for (let k = -state.h; k < state.w + state.h; k += 8) {
    antsCtx.beginPath();
    const o = k + antsOffset;
    antsCtx.moveTo(o, 0); antsCtx.lineTo(o + 4, 0); antsCtx.lineTo(o + 4 - state.h, state.h); antsCtx.lineTo(o - state.h, state.h);
    antsCtx.fill();
  }
  antsCtx.restore();
}

/* ---------- selection-aware edits ---------- */
function editSelected(fn, label) {
  const layer = canPaint();
  if (!layer) return;
  const t = acquireCel(layer);
  const lm = localMapper(layer);
  const b = sel.active ? sel.bb : { x: 0, y: 0, w: state.w, h: state.h };
  const before = crop(t.cel, b);
  const work = makeCanvas(b.w, b.h);
  fn(work.getContext('2d'), b, t);
  const clipped = makeCanvas(b.w, b.h);
  const cg = clipped.getContext('2d');
  cg.drawImage(work, 0, 0);
  if (sel.active && lm.ident) {
    cg.globalCompositeOperation = 'destination-in';
    cg.drawImage(sel.mask, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
  }
  return { t, b, before, clipped };
}
function clearSelection() {
  const layer = canPaint();
  if (!layer) return;
  const t = acquireCel(layer);
  const b = sel.active ? sel.bb : { x: 0, y: 0, w: state.w, h: state.h };
  const before = crop(t.cel, b);
  t.ctx.save();
  if (sel.active) {
    const m = makeCanvas(b.w, b.h);
    const mg = m.getContext('2d');
    mg.drawImage(t.cel, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
    mg.globalCompositeOperation = 'destination-out';
    mg.drawImage(sel.mask, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
    t.ctx.clearRect(b.x, b.y, b.w, b.h);
    t.ctx.drawImage(m, b.x, b.y);
  } else t.ctx.clearRect(b.x, b.y, b.w, b.h);
  t.ctx.restore();
  pushHistory(celEntry(t, b, before, crop(t.cel, b)));
  afterEdit();
}
function fillSelection() {
  const layer = canPaint();
  if (!layer) return;
  const t = acquireCel(layer);
  const b = sel.active ? sel.bb : { x: 0, y: 0, w: state.w, h: state.h };
  const before = crop(t.cel, b);
  const f = makeCanvas(b.w, b.h);
  const fg = f.getContext('2d');
  fg.fillStyle = state.color; fg.fillRect(0, 0, b.w, b.h);
  if (sel.active) { fg.globalCompositeOperation = 'destination-in'; fg.drawImage(sel.mask, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h); }
  t.ctx.drawImage(f, b.x, b.y);
  t.cel._ink = true;
  pushHistory(celEntry(t, b, before, crop(t.cel, b)));
  afterEdit();
}
function copySelection(cut) {
  const layer = activeLayer();
  if (!layer || !layer.canvas) { toast('Nothing to copy'); return; }
  const b = sel.active ? sel.bb : { x: 0, y: 0, w: state.w, h: state.h };
  const c = makeCanvas(b.w, b.h);
  const g = c.getContext('2d');
  g.drawImage(layer.canvas, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
  if (sel.active) { g.globalCompositeOperation = 'destination-in'; g.drawImage(sel.mask, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h); }
  clipboard = { canvas: c, x: b.x, y: b.y };
  toast(cut ? 'Cut' : 'Copied');
  if (cut) clearSelection();
}
function pasteClipboard() {
  if (!clipboard) { toast('Clipboard is empty'); return; }
  const layer = canPaint();
  if (!layer) return;
  const t = acquireCel(layer);
  const b = { x: clipboard.x, y: clipboard.y, w: clipboard.canvas.width, h: clipboard.canvas.height };
  const cb = clampBox(b.x, b.y, b.x + b.w, b.y + b.h);
  if (!cb) return;
  const before = crop(t.cel, cb);
  t.ctx.drawImage(clipboard.canvas, b.x, b.y);
  t.cel._ink = true;
  pushHistory(celEntry(t, cb, before, crop(t.cel, cb)));
  afterEdit();
  toast('Pasted');
}

/* ---------- selection tool drag handling ---------- */
function selShapePath(kind, st) {
  return g => {
    g.fillStyle = '#000';
    g.beginPath();
    if (kind === 'selrect') g.rect(Math.min(st.x0, st.x1), Math.min(st.y0, st.y1), Math.abs(st.x1 - st.x0), Math.abs(st.y1 - st.y0));
    else if (kind === 'selellipse') g.ellipse((st.x0 + st.x1) / 2, (st.y0 + st.y1) / 2, Math.abs(st.x1 - st.x0) / 2, Math.abs(st.y1 - st.y0) / 2, 0, 0, Math.PI * 2);
    else if (kind === 'selpen' || kind === 'selerase') {
      g.strokeStyle = '#000'; g.lineWidth = state.selPenSize || 24; g.lineCap = 'round'; g.lineJoin = 'round';
      if (st.pts.length === 1) st.pts.push([st.pts[0][0] + 0.01, st.pts[0][1]]);
      st.pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
      g.stroke(); return;
    } else { st.pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); }
    g.fill();
  };
}
function selDragStart(e) {
  const d = toDoc(e);
  let modeKey = e.shiftKey ? 'add' : e.altKey ? 'subtract' : null;
  const tk = TOOLDEF[state.tool].kind;
  if (!modeKey && state.tool === 'selpen') modeKey = 'add';
  if (!modeKey && (state.tool === 'selerase' || state.tool === 'selshrink')) modeKey = 'subtract';
  active = { type: 'sel', kind: tk === 'lassofill' ? 'sellasso' : state.tool, fillMode: tk === 'lassofill' ? state.tool : null,
    x0: d.x, y0: d.y, x1: d.x, y1: d.y, pts: [[d.x, d.y]], mode: modeKey };
}
function selDragMove(e) {
  const d = toDoc(e);
  active.x1 = d.x; active.y1 = d.y;
  if (active.kind !== 'selrect' && active.kind !== 'selellipse') active.pts.push([d.x, d.y]);
  drawOverlay();
}
function selDragEnd() {
  const a = active; active = null;
  const ptsKind = a.kind !== 'selrect' && a.kind !== 'selellipse';
  const pen = a.kind === 'selpen' || a.kind === 'selerase';
  if (ptsKind ? a.pts.length < (pen ? 1 : 3) : Math.abs(a.x1 - a.x0) < 2 && Math.abs(a.y1 - a.y0) < 2) {
    if (!a.mode && !ptsKind) deselect();
    drawOverlay();
    return;
  }
  if (a.fillMode) { lassoFill(a.pts, a.fillMode); return; }
  combineSel(selShapePath(a.kind, a), a.mode || state.selMode);
}

