/* ---------- overlay canvas (screen space) ---------- */
const ovl = overlay;
function resizeOverlay() {
  const r = vpRect();
  const dpr = window.devicePixelRatio || 1;
  ovl.width = Math.max(1, Math.round(r.width * dpr));
  ovl.height = Math.max(1, Math.round(r.height * dpr));
  ovl.style.width = r.width + 'px';
  ovl.style.height = r.height + 'px';
  drawOverlay();
}
if (window.ResizeObserver) new ResizeObserver(resizeOverlay).observe(viewport);
window.addEventListener('resize', resizeOverlay);

/* ---------- content bounding box of a cel ---------- */
function celBBox(c) {
  if (c._bb !== undefined) return c._bb;
  const w = c.width, h = c.height;
  const d = c.getContext('2d').getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 0) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  c._bb = x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  return c._bb;
}

/* ---------- cel-mode transform (Animate-style motion) ---------- */
/* Make sure the active layer has a keyframe on the current frame; returns its cel (or null). */
function ensureKeyHere(layer) {
  const f = state.frame;
  const k = keyAt(layer, f);
  if (k === f) return layer.cels.get(f);
  if (k === null) return null;
  const prev = layer.cels.get(k);
  const fp = frameParams(layer, f);
  const c = copyCel(prev, false);
  c._xf = { ...IDENT, x: fp.p.x, y: fp.p.y, rot: fp.p.rot, sx: fp.p.sx, sy: fp.p.sy, alpha: fp.p.alpha };
  if (xfOf(prev).tween) { c._xf.tween = true; c._xf.ease = xfOf(prev).ease; }
  layer.cels.set(f, c);
  bindAll(f);
  return c;
}
function handlesOf(layer) {
  if (!layer || !layer.canvas) return null;
  const fp = frameParams(layer, state.frame);
  const bb = celBBox(fp.cel);
  if (!bb) return null;
  const M = layerMat(layer, state.frame) || [1, 0, 0, 1, 0, 0];
  const corners = [[bb.x, bb.y], [bb.x + bb.w, bb.y], [bb.x + bb.w, bb.y + bb.h], [bb.x, bb.y + bb.h]]
    .map(([x, y]) => docToScreen(...applyMat(M, x, y)));
  const top = [(corners[0][0] + corners[1][0]) / 2, (corners[0][1] + corners[1][1]) / 2];
  const ctr = [(corners[0][0] + corners[2][0]) / 2, (corners[0][1] + corners[2][1]) / 2];
  let vx = top[0] - ctr[0], vy = top[1] - ctr[1];
  const len = Math.hypot(vx, vy) || 1;
  const rot = [top[0] + vx / len * 28, top[1] + vy / len * 28];
  const [px, py] = pivotOf(layer);
  const pv = docToScreen(...applyMat(M, px, py));
  return { corners, top, rot, pv, fp, M };
}
function hitHandle(e) {
  const layer = activeLayer();
  const h = handlesOf(layer);
  if (!h) return null;
  const r = vpRect();
  const X = e.clientX - r.left, Y = e.clientY - r.top;
  const near = (p, rad = 10) => Math.hypot(p[0] - X, p[1] - Y) <= rad;
  if (e.altKey && near(h.pv, 14)) return 'pivot';
  if (near(h.rot)) return 'rot';
  for (let i = 0; i < 4; i++) if (near(h.corners[i])) return 'c' + i;
  return null;
}

function moveDown(e) {
  const layer = activeLayer();
  if (!layer) return;
  if (layer.locked) { toast('Layer is locked'); return; }
  if (sel.active) return pixelMoveDown(e);
  if (!layer.canvas) { toast('Nothing on this layer here'); return; }
  const hit = hitHandle(e);
  const before = snapshotTimeline();
  if (keyAt(layer, state.frame) !== state.frame && !state.autoKey && xfOf(layer.canvas).tween === false &&
      nextKey(layer, state.frame) === null && false) return;
  const cel = ensureKeyHere(layer);
  if (!cel) return;
  const x = ensureXf(cel);
  const h = handlesOf(layer);
  const r = vpRect();
  const sx0 = e.clientX - r.left, sy0 = e.clientY - r.top;
  active = {
    type: 'xf', mode: hit || 'move', layer, cel, x, before,
    d0: toDoc(e), x0: x.x, y0: x.y, rot0: x.rot, sx0: x.sx, sy0: x.sy,
    pv: h ? h.pv : [0, 0],
    a0: h ? Math.atan2(sy0 - h.pv[1], sx0 - h.pv[0]) : 0,
    r0: h ? Math.hypot(sx0 - h.pv[0], sy0 - h.pv[1]) || 1 : 1,
    pxy: [layer.px, layer.py], pvDoc: pivotOf(layer), changed: false
  };
}
function moveMove(e) {
  const a = active;
  const r = vpRect();
  const X = e.clientX - r.left, Y = e.clientY - r.top;
  if (a.type === 'pixmove') return pixelMoveMove(e);
  a.changed = true;
  if (a.mode === 'move') {
    const d = toDoc(e);
    let dx = d.x - a.d0.x, dy = d.y - a.d0.y;
    if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
    [dx, dy] = toParentSpace(a.layer, dx, dy);
    a.x.x = a.x0 + dx; a.x.y = a.y0 + dy;
  } else if (a.mode === 'rot') {
    let da = (Math.atan2(Y - a.pv[1], X - a.pv[0]) - a.a0) / DEG * (view.flip ? -1 : 1);
    let rot = a.rot0 + da;
    if (e.shiftKey) rot = Math.round(rot / 15) * 15;
    a.x.rot = rot;
  } else if (a.mode === 'pivot') {
    const d = toDoc(e);
    const l = a.layer, fp = frameParams(l, state.frame);
    /* move pivot in layer space while keeping the picture where it is */
    const I = [1, 0, 0, 1, 0, 0];
    const oldM = layerMat(l, state.frame) || I;
    const [lx, ly] = applyMat(invMat(oldM) || I, d.x, d.y);
    const keep = applyMat(oldM, 0, 0);
    l.px = lx; l.py = ly;
    const newM = layerMat(l, state.frame) || I;
    const k2 = applyMat(newM, 0, 0);
    const [ddx, ddy] = toParentSpace(l, keep[0] - k2[0], keep[1] - k2[1]);
    a.x.x += ddx; a.x.y += ddy;
  } else {
    let k = (Math.hypot(X - a.pv[0], Y - a.pv[1]) || 1) / a.r0;
    if (e.shiftKey) { a.x.sx = a.sx0 * k; a.x.sy = a.sy0 * k; }
    else { a.x.sx = a.sx0 * k; a.x.sy = a.sy0 * k; }
  }
  refreshStage(); drawOverlay(); syncTimelineFields();
}
/* a movement in document space → the same movement in the parent layer's space (bone rig) */
function toParentSpace(l, dx, dy) {
  const par = layerParent(l), pm = par ? layerMat(par, state.frame) : null;
  if (!pm) return [dx, dy];
  const inv = invMat([pm[0], pm[1], pm[2], pm[3], 0, 0]);
  return inv ? applyMat(inv, dx, dy) : [dx, dy];
}
function moveUp() {
  const a = active; active = null;
  if (a.type === 'pixmove') return pixelMoveUp(a);
  if (!a.changed) {
    /* nothing moved: drop a freshly-made key */
    if (a.before) { applyTimeline(a.before); afterHistory(); history.undo.pop(); }
    return;
  }
  const after = snapshotTimeline();
  pushHistory(timelineEntry(a.before, after));
  afterEdit(); syncTimelineFields();
}

/* ---------- pixel-mode move (selection active): lifts the selected pixels ---------- */
function pixelMoveDown(e) {
  const layer = canPaint();
  if (!layer) return;
  const t = acquireCel(layer);
  const lm = localMapper(layer);
  const b = sel.bb;
  const floatC = makeCanvas(b.w, b.h);
  const fg = floatC.getContext('2d');
  fg.drawImage(t.cel, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
  fg.globalCompositeOperation = 'destination-in';
  fg.drawImage(sel.mask, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
  docSize(snapCanvas, true);
  snapCtx.clearRect(0, 0, state.w, state.h);
  snapCtx.drawImage(t.cel, 0, 0);
  /* base = cel with selected pixels removed */
  const base = makeCanvas(state.w, state.h);
  const bg = base.getContext('2d');
  bg.drawImage(t.cel, 0, 0);
  bg.globalCompositeOperation = 'destination-out';
  bg.drawImage(sel.mask, 0, 0);
  const d = lm.map(...(() => { const q = toDoc(e); return [q.x, q.y]; })());
  active = {
    type: 'pixmove', t, b, floatC, base, map: lm.map, start: d, dx: 0, dy: 0,
    selBefore: selSnapshot(), before: crop(t.cel, { x: 0, y: 0, w: state.w, h: state.h })
  };
}
function pixelMoveMove(e) {
  const a = active;
  const q = toDoc(e);
  const p = a.map(q.x, q.y);
  a.dx = Math.round(p[0] - a.start[0]); a.dy = Math.round(p[1] - a.start[1]);
  if (e.shiftKey) { if (Math.abs(a.dx) > Math.abs(a.dy)) a.dy = 0; else a.dx = 0; }
  const g = a.t.ctx;
  g.save();
  g.globalCompositeOperation = 'copy';
  g.drawImage(a.base, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.drawImage(a.floatC, a.b.x + a.dx, a.b.y + a.dy);
  g.restore();
  a.t.cel._bb = undefined;
  renderLayers();
}
function pixelMoveUp(a) {
  if (!a.dx && !a.dy) { return; }
  /* shift the selection mask along with the pixels */
  const m = makeCanvas(state.w, state.h);
  m.getContext('2d').drawImage(sel.mask, a.dx, a.dy);
  const g = selCtx();
  g.globalCompositeOperation = 'copy'; g.drawImage(m, 0, 0); g.globalCompositeOperation = 'source-over';
  sel.bb = computeBB(); sel.active = !!sel.bb; antsDirty = true;
  const full = { x: 0, y: 0, w: state.w, h: state.h };
  const after = crop(a.t.cel, full);
  const before = a.before, selBefore = a.selBefore, selAfter = selSnapshot();
  const ce = celEntry(a.t, full, before, after);
  a.t.cel._ink = true;
  pushHistory({
    frame: ce.frame, bytes: ce.bytes,
    undo() { ce.undo(); selRestore(selBefore); },
    redo() { ce.redo(); selRestore(selAfter); }
  });
  startAnts(); afterEdit();
}

/* ---------- gradient ---------- */
function gradDown(e) {
  if (!canPaint()) return;
  const d = toDoc(e);
  active = { type: 'grad', x0: d.x, y0: d.y, x1: d.x, y1: d.y };
}
function gradMove(e) { const d = toDoc(e); active.x1 = d.x; active.y1 = d.y; drawOverlay(); }
function gradUp() {
  const a = active; active = null;
  const len = Math.hypot(a.x1 - a.x0, a.y1 - a.y0);
  drawOverlay();
  if (len < 2) return;
  const layer = canPaint();
  if (!layer) return;
  const t = acquireCel(layer);
  const lm = localMapper(layer);
  const [x0, y0] = lm.map(a.x0, a.y0), [x1, y1] = lm.map(a.x1, a.y1);
  const b = sel.active && lm.ident ? sel.bb : { x: 0, y: 0, w: state.w, h: state.h };
  const before = crop(t.cel, b);
  const f = makeCanvas(state.w, state.h);
  const fg = f.getContext('2d');
  const def = TOOLDEF[state.tool];
  const gr = (state.tool === 'radial' || def.radial)
    ? fg.createRadialGradient(x0, y0, 0, x0, y0, Math.hypot(x1 - x0, y1 - y0))
    : fg.createLinearGradient(x0, y0, x1, y1);
  const [r1, g1, b1] = hexToRgb(state.color), [r2, g2, b2] = hexToRgb(state.color2);
  if (def.stops) def.stops.forEach(([o, c]) => gr.addColorStop(o, c === 'fg' ? state.color : c === 'bg' ? state.color2 : c === 'fg0' ? `rgba(${r1},${g1},${b1},0)` : c));
  else {
    const end = state.gradEnd === 'transparent' ? `rgba(${r1},${g1},${b1},0)` : `rgb(${r2},${g2},${b2})`;
    gr.addColorStop(0, `rgb(${r1},${g1},${b1})`);
    gr.addColorStop(1, end);
  }
  fg.fillStyle = gr; fg.fillRect(0, 0, state.w, state.h);
  if (sel.active && lm.ident) { fg.globalCompositeOperation = 'destination-in'; fg.drawImage(sel.mask, 0, 0); }
  if (def.erase) { t.ctx.save(); t.ctx.globalCompositeOperation = 'destination-out'; t.ctx.drawImage(f, 0, 0); t.ctx.restore(); }
  else t.ctx.drawImage(f, 0, 0);
  t.cel._ink = true;
  pushHistory(celEntry(t, b, before, crop(t.cel, b)));
  afterEdit();
}

/* ---------- text ---------- */
let textPos = null;
function textClick(e) {
  if (!canPaint()) return;
  const d = toDoc(e);
  textPos = { x: d.x, y: d.y };
  const dlg = $('#textDialog');
  $('#textInput').value = '';
  if (typeof dlg.showModal === 'function') {
    dlg.showModal();
    // the press that opened the dialog moves focus back to the canvas: focus the text box once it is over
    const focusIt = () => $('#textInput').focus();
    focusIt(); setTimeout(focusIt, 0); setTimeout(focusIt, 120);
    window.addEventListener('pointerup', () => setTimeout(focusIt, 0), { once: true });
  }
}
$('#textInput').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $('#textForm').requestSubmit(); } });
$('#textForm').addEventListener('submit', e => {
  e.preventDefault();
  const txt = $('#textInput').value;
  $('#textDialog').close();
  if (!txt.trim() || !textPos) return;
  const layer = canPaint();
  if (!layer) return;
  const t = acquireCel(layer);
  const lm = localMapper(layer);
  const [x, y] = lm.map(textPos.x, textPos.y);
  const size = state.fontSize;
  const font = `${state.italic ? 'italic ' : ''}${state.bold ? 'bold ' : ''}${size}px ${state.font}`;
  const tc = makeCanvas(state.w, state.h);
  const tg = tc.getContext('2d');
  tg.font = font; tg.fillStyle = state.color; tg.textBaseline = 'top'; tg.textAlign = state.align;
  const lines = txt.split('\n');
  let maxW = 0;
  lines.forEach((ln, i) => { tg.fillText(ln, x, y + i * size * 1.25); maxW = Math.max(maxW, tg.measureText(ln).width); });
  const b = clampBox(x - maxW - 4, y - 4, x + maxW + 4, y + lines.length * size * 1.25 + 8);
  if (!b) { releaseCel(t); return; }
  const before = crop(t.cel, b);
  if (sel.active && lm.ident) { tg.globalCompositeOperation = 'destination-in'; tg.drawImage(sel.mask, 0, 0); }
  t.ctx.drawImage(tc, 0, 0);
  t.cel._ink = true;
  pushHistory(celEntry(t, b, before, crop(t.cel, b)));
  addRecent(state.color);
  afterEdit();
});
$('#textCancel').onclick = () => $('#textDialog').close();

/* ---------- overlay drawing ---------- */
function drawOverlay() {
  const g = ovl.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, ovl.width, ovl.height);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const a = active;
  const S = (x, y) => docToScreen(x, y);
  if (a && a.type === 'sel') {
    g.save();
    g.lineWidth = 1; g.strokeStyle = '#fff'; g.setLineDash([5, 4]);
    g.beginPath();
    if (a.kind === 'selrect') {
      const c = [[a.x0, a.y0], [a.x1, a.y0], [a.x1, a.y1], [a.x0, a.y1]].map(p => S(p[0], p[1]));
      c.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath();
    } else if (a.kind === 'selellipse') {
      for (let i = 0; i <= 64; i++) {
        const t = i / 64 * Math.PI * 2;
        const p = S((a.x0 + a.x1) / 2 + Math.cos(t) * (a.x1 - a.x0) / 2, (a.y0 + a.y1) / 2 + Math.sin(t) * (a.y1 - a.y0) / 2);
        i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]);
      }
    } else a.pts.forEach((q, i) => { const p = S(q[0], q[1]); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); });
    g.stroke();
    g.strokeStyle = '#000'; g.lineDashOffset = 4; g.stroke();
    g.restore();
  }
  if (a && a.type === 'grad') {
    const p0 = S(a.x0, a.y0), p1 = S(a.x1, a.y1);
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke();
    g.fillStyle = state.color; g.beginPath(); g.arc(p0[0], p0[1], 5, 0, 7); g.fill(); g.stroke();
    g.fillStyle = state.color2; g.beginPath(); g.arc(p1[0], p1[1], 5, 0, 7); g.fill(); g.stroke();
  }
  drawPolyOverlay(g, S);
  drawRulers(g, S); drawDDOverlay(g, S); drawPuppet(g);
  if (TOOLDEF[state.tool] && TOOLDEF[state.tool].overlay) TOOLDEF[state.tool].overlay(g, S); // Bone tool joints / bones
  if (state.tool === 'move' && !sel.active && !(a && a.type === 'pixmove')) {
    drawBones(g, S);
    const h = handlesOf(activeLayer());
    if (h) {
      g.strokeStyle = '#4da3ff'; g.fillStyle = '#fff'; g.lineWidth = 1.5;
      g.beginPath(); h.corners.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.stroke();
      g.beginPath(); g.moveTo(h.top[0], h.top[1]); g.lineTo(h.rot[0], h.rot[1]); g.stroke();
      g.beginPath(); g.arc(h.rot[0], h.rot[1], 6, 0, 7); g.fill(); g.stroke();
      h.corners.forEach(p => { g.fillRect(p[0] - 5, p[1] - 5, 10, 10); g.strokeRect(p[0] - 5, p[1] - 5, 10, 10); });
      g.beginPath(); g.arc(h.pv[0], h.pv[1], 6, 0, 7);
      g.moveTo(h.pv[0] - 10, h.pv[1]); g.lineTo(h.pv[0] + 10, h.pv[1]);
      g.moveTo(h.pv[0], h.pv[1] - 10); g.lineTo(h.pv[0], h.pv[1] + 10);
      g.strokeStyle = '#ff8a3d'; g.stroke();
    }
  }
}

