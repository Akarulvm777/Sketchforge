/* ---------- selection bar + transform (scale / rotate / distort) (3.9) ----------
   - Selection bar (#selBar, floating at the bottom of the canvas) whenever something is selected: Transform,
     Deselect, Invert, Copy, Cut, Fill — on tablets there was no easy way to drop a selection, and drawing only works
     inside a selection, so after moving a part "the place where it was" could not be drawn on any more.
   - Transform: the selected pixels of the active layer float on 4 corners (SELX.q, page pixels, clockwise from the
     top left). Drag inside = move, a corner = scale (Shift / the Keep shape button: same proportions), an edge =
     stretch one side, the round handle = rotate, Distort mode = each corner on its own (free four corners).
     ✓ Apply = one undo step (layer pixels + selection outline transformed the same way), ✕ Cancel = as before.
     Enter / Esc work too. A parallelogram is drawn with one transform (sharp); a distorted quad as a mesh of small
     triangles (quadWarp: bilinear inside the quad).
   - After a selection was moved or transformed, choosing a drawing tool drops it (selectTool wrapped; one undo step),
     so the whole page can be drawn on again. */
const SELX = { on: false, mode: 'free', keep: false, q: null, q0: null, drag: null, base: null, flt: null, mflt: null, b: null, t: null, before: null, selBefore: null, prevBox: null };
/* pure: the point (u, v) ∈ [0, 1]² of quad q (bilinear) */
function quadPoint(q, u, v) {
  const [a, b, c, d] = q;
  return [(1 - v) * ((1 - u) * a[0] + u * b[0]) + v * ((1 - u) * d[0] + u * c[0]), (1 - v) * ((1 - u) * a[1] + u * b[1]) + v * ((1 - u) * d[1] + u * c[1])];
}
/* pure: is q a parallelogram (then one affine transform draws it exactly)? */
const quadIsAffine = (q, eps = 0.5) => Math.abs(q[0][0] + q[2][0] - q[1][0] - q[3][0]) < eps && Math.abs(q[0][1] + q[2][1] - q[1][1] - q[3][1]) < eps;
/* pure: the bounding box of a quad, rounded out */
function quadBox(q, pad = 2) {
  const xs = q.map(p => p[0]), ys = q.map(p => p[1]);
  const x = Math.floor(Math.min(...xs)) - pad, y = Math.floor(Math.min(...ys)) - pad;
  return { x, y, w: Math.ceil(Math.max(...xs)) + pad - x, h: Math.ceil(Math.max(...ys)) + pad - y };
}
const quadCenter = q => [(q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4];
/* pure: rotate a quad by ang (radians) around (cx, cy) */
const quadRotate = (q, ang, cx, cy) => { const c = Math.cos(ang), s = Math.sin(ang); return q.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]); };
/* pure: drag corner i of a parallelogram to (x, y), the opposite corner staying put (scale in the quad's own axes;
   keep = same proportions) */
function quadScaleCorner(q, i, x, y, keep) {
  const o = q[(i + 2) % 4], ui = [q[1][0] - q[0][0], q[1][1] - q[0][1]], vi = [q[3][0] - q[0][0], q[3][1] - q[0][1]];
  const lu = Math.hypot(...ui) || 1, lv = Math.hypot(...vi) || 1, U = [ui[0] / lu, ui[1] / lu], V = [vi[0] / lv, vi[1] / lv];
  const cu = (q[i][0] - o[0]) * U[0] + (q[i][1] - o[1]) * U[1], cv = (q[i][0] - o[0]) * V[0] + (q[i][1] - o[1]) * V[1];
  let su = ((x - o[0]) * U[0] + (y - o[1]) * U[1]) / (cu || 1), sv = ((x - o[0]) * V[0] + (y - o[1]) * V[1]) / (cv || 1);
  if (keep) { const s = Math.abs(su) > Math.abs(sv) ? su : sv; su = sv = s; }
  return q.map(([px, py]) => { const pu = (px - o[0]) * U[0] + (py - o[1]) * U[1], pv = (px - o[0]) * V[0] + (py - o[1]) * V[1]; return [o[0] + U[0] * pu * su + V[0] * pv * sv, o[1] + U[1] * pu * su + V[1] * pv * sv]; });
}
/* pure: drag edge e (0 top, 1 right, 2 bottom, 3 left) of a parallelogram: stretch across it, the opposite edge stays */
function quadScaleEdge(q, e, x, y) {
  const a = q[e], b = q[(e + 1) % 4], c = q[(e + 2) % 4], d = q[(e + 3) % 4]; // edge a-b, opposite c-d (d next to a)
  const n = [a[0] - d[0], a[1] - d[1]], ln = Math.hypot(...n) || 1, N = [n[0] / ln, n[1] / ln];
  const s = ((x - d[0]) * N[0] + (y - d[1]) * N[1]) / ln;
  const out = q.map(p => p.slice());
  out[e] = [d[0] + n[0] * s, d[1] + n[1] * s]; out[(e + 1) % 4] = [c[0] + (b[0] - c[0]) * s, c[1] + (b[1] - c[1]) * s];
  return out;
}
/* draw image src (its rectangle sw × sh) into the quad q on g */
function quadWarp(g, src, q, sw, sh) {
  if (quadIsAffine(q)) {
    const [a, b, , d] = q;
    g.save(); g.setTransform((b[0] - a[0]) / sw, (b[1] - a[1]) / sw, (d[0] - a[0]) / sh, (d[1] - a[1]) / sh, a[0], a[1]);
    g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0); g.restore(); return;
  }
  const N = 16;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u0 = i / N, u1 = (i + 1) / N, v0 = j / N, v1 = (j + 1) / N;
    const P = (u, v) => [u * sw, v * sh, ...quadPoint(q, u, v)];
    quadTri(g, src, P(u0, v0), P(u1, v0), P(u1, v1)); quadTri(g, src, P(u0, v0), P(u1, v1), P(u0, v1));
  }
}
function quadTri(g, src, a, b, c) {
  const [sx0, sy0, dx0, dy0] = a, [sx1, sy1, dx1, dy1] = b, [sx2, sy2, dx2, dy2] = c;
  const den = (sx1 - sx0) * (sy2 - sy0) - (sx2 - sx0) * (sy1 - sy0); if (!den) return;
  const A = ((dx1 - dx0) * (sy2 - sy0) - (dx2 - dx0) * (sy1 - sy0)) / den, C = ((dx2 - dx0) * (sx1 - sx0) - (dx1 - dx0) * (sx2 - sx0)) / den;
  const B = ((dy1 - dy0) * (sy2 - sy0) - (dy2 - dy0) * (sy1 - sy0)) / den, D = ((dy2 - dy0) * (sx1 - sx0) - (dy1 - dy0) * (sx2 - sx0)) / den;
  const E = dx0 - A * sx0 - C * sy0, F = dy0 - B * sx0 - D * sy0;
  // grow the triangle by half a pixel so neighbouring triangles leave no hairline gaps
  const cx = (dx0 + dx1 + dx2) / 3, cy = (dy0 + dy1 + dy2) / 3, gr = p => { const vx = p[0] - cx, vy = p[1] - cy, l = Math.hypot(vx, vy) || 1; return [p[0] + vx / l * 0.6, p[1] + vy / l * 0.6]; };
  const [p0, p1, p2] = [gr([dx0, dy0]), gr([dx1, dy1]), gr([dx2, dy2])];
  g.save(); g.beginPath(); g.moveTo(...p0); g.lineTo(...p1); g.lineTo(...p2); g.closePath(); g.clip();
  g.setTransform(A, B, C, D, E, F); g.drawImage(src, 0, 0); g.restore();
}

/* ---------- transform session ---------- */
function selxStart() {
  if (SELX.on) return;
  if (!sel.active || !sel.bb) { toast('Select something first'); return; }
  const layer = canPaint(); if (!layer) return;
  const lm = localMapper(layer);
  if (!lm.ident) { toast('This layer is moved or rotated: transform it with the Move tool instead'); return; }
  const t = acquireCel(layer), b = { ...sel.bb };
  const flt = makeCanvas(b.w, b.h), fg = flt.getContext('2d');
  fg.drawImage(t.cel, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
  fg.globalCompositeOperation = 'destination-in'; fg.drawImage(sel.mask, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
  const mflt = makeCanvas(b.w, b.h); mflt.getContext('2d').drawImage(sel.mask, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
  const base = makeCanvas(t.cel.width, t.cel.height), bg = base.getContext('2d');
  bg.drawImage(t.cel, 0, 0); bg.globalCompositeOperation = 'destination-out'; bg.drawImage(sel.mask, 0, 0);
  const q = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]];
  Object.assign(SELX, { on: true, t, b, flt, mflt, base, q, q0: q.map(p => p.slice()), drag: null, prevBox: quadBox(q), before: crop(t.cel, { x: 0, y: 0, w: t.cel.width, h: t.cel.height }), selBefore: selSnapshot() });
  selxRender(); selBarRender(); drawOverlay();
}
/* show base + the floating part in its quad, only redrawing the area that changed */
function selxRender() {
  const g = SELX.t.ctx, nb = quadBox(SELX.q), pb = SELX.prevBox;
  const x0 = Math.max(0, Math.min(nb.x, pb.x)), y0 = Math.max(0, Math.min(nb.y, pb.y)), x1 = Math.min(g.canvas.width, Math.max(nb.x + nb.w, pb.x + pb.w)), y1 = Math.min(g.canvas.height, Math.max(nb.y + nb.h, pb.y + pb.h));
  if (x1 > x0 && y1 > y0) {
    g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip();
    g.clearRect(x0, y0, x1 - x0, y1 - y0); g.drawImage(SELX.base, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    quadWarp(g, SELX.flt, SELX.q, SELX.b.w, SELX.b.h); g.restore();
  }
  SELX.prevBox = nb; SELX.t.cel._bb = undefined; SELX.t.cel._sv = (SELX.t.cel._sv || 0) + 1;
  if (typeof refreshCustomBlends === 'function') try { refreshCustomBlends(); } catch (e) {}
}
function selxEnd(apply) {
  if (!SELX.on) return;
  const S = SELX, t = S.t, full = { x: 0, y: 0, w: t.cel.width, h: t.cel.height };
  Object.assign(SELX, { on: false, drag: null });
  if (!apply) {
    t.ctx.save(); t.ctx.globalCompositeOperation = 'copy'; t.ctx.drawImage(S.before, 0, 0); t.ctx.restore();
    t.cel._bb = undefined; t.cel._sv = (t.cel._sv || 0) + 1; releaseCel(t);
  } else {
    // the selection outline follows the pixels
    const m = makeCanvas(state.w, state.h); quadWarp(m.getContext('2d'), S.mflt, S.q, S.b.w, S.b.h);
    const sg = selCtx(); sg.globalCompositeOperation = 'copy'; sg.drawImage(m, 0, 0); sg.globalCompositeOperation = 'source-over';
    sel.bb = computeBB(); sel.active = !!sel.bb; sel._floated = true; antsDirty = true;
    const ce = celEntry(t, full, S.before, crop(t.cel, full)), selBefore = S.selBefore, selAfter = selSnapshot();
    t.cel._ink = true;
    pushHistory({ frame: ce.frame, bytes: ce.bytes, undo() { ce.undo(); selRestore(selBefore); }, redo() { ce.redo(); selRestore(selAfter); } });
    startAnts(); afterEdit();
  }
  SELX.base = SELX.flt = SELX.mflt = SELX.before = SELX.t = null;
  selBarRender(); drawOverlay(); refreshStage();
}
/* handles in screen pixels (viewport space) */
function selxHandles() {
  const q = SELX.q, S = p => docToScreen(p[0], p[1]);
  const cs = q.map(S), mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const edges = [0, 1, 2, 3].map(i => mid(cs[i], cs[(i + 1) % 4]));
  const ctr = mid(cs[0], cs[2]), top = edges[0], v = [top[0] - ctr[0], top[1] - ctr[1]], l = Math.hypot(...v) || 1;
  return { cs, edges, rot: [top[0] + v[0] / l * 34, top[1] + v[1] / l * 34], ctr };
}
function selxHit(X, Y) {
  const h = selxHandles(), R = matchMedia('(pointer: coarse)').matches ? 22 : 12, near = p => Math.hypot(p[0] - X, p[1] - Y) <= R;
  if (near(h.rot)) return { k: 'rot' };
  for (let i = 0; i < 4; i++) if (near(h.cs[i])) return { k: 'corner', i };
  if (SELX.mode !== 'distort') for (let i = 0; i < 4; i++) if (near(h.edges[i])) return { k: 'edge', i };
  // inside the quad = move
  let inside = false; const P = h.cs;
  for (let i = 0, j = 3; i < 4; j = i++) if ((P[i][1] > Y) !== (P[j][1] > Y) && X < (P[j][0] - P[i][0]) * (Y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) inside = !inside;
  return inside ? { k: 'move' } : null;
}
function selxDown(e) {
  if (!SELX.on || !e.isPrimary || e.button > 0) return;
  const r = vpRect(), hit = selxHit(e.clientX - r.left, e.clientY - r.top);
  if (!hit) return; // outside: let pan / zoom gestures through
  e.preventDefault(); e.stopImmediatePropagation();
  const d = toDoc(e), c = quadCenter(SELX.q);
  SELX.drag = { ...hit, x0: d.x, y0: d.y, q: SELX.q.map(p => p.slice()), a0: Math.atan2(d.y - c[1], d.x - c[0]), c, id: e.pointerId };
}
function selxMove(e) {
  const D = SELX.drag; if (!SELX.on || !D || e.pointerId !== D.id) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const d = toDoc(e), dx = d.x - D.x0, dy = d.y - D.y0, keep = SELX.keep || e.shiftKey;
  if (D.k === 'move') SELX.q = D.q.map(([x, y]) => [x + dx, y + dy]);
  else if (D.k === 'rot') { let a = Math.atan2(d.y - D.c[1], d.x - D.c[0]) - D.a0; if (e.shiftKey) a = Math.round(a / (Math.PI / 12)) * (Math.PI / 12); SELX.q = quadRotate(D.q, a, D.c[0], D.c[1]); }
  else if (D.k === 'corner' && SELX.mode === 'distort') { SELX.q = D.q.map(p => p.slice()); SELX.q[D.i] = [D.q[D.i][0] + dx, D.q[D.i][1] + dy]; }
  else if (D.k === 'corner') SELX.q = quadScaleCorner(D.q, D.i, D.q[D.i][0] + dx, D.q[D.i][1] + dy, keep);
  else if (D.k === 'edge') { const m = [(D.q[D.i][0] + D.q[(D.i + 1) % 4][0]) / 2 + dx, (D.q[D.i][1] + D.q[(D.i + 1) % 4][1]) / 2 + dy]; SELX.q = quadScaleEdge(D.q, D.i, m[0], m[1]); }
  if (!SELX.raf) SELX.raf = requestAnimationFrame(() => { SELX.raf = 0; if (SELX.on) { selxRender(); drawOverlay(); } });
}
function selxUp(e) { if (SELX.drag && e.pointerId === SELX.drag.id) { SELX.drag = null; e.stopImmediatePropagation(); } }
function selxFlip(h) {
  const q = SELX.q; SELX.q = h ? [q[1], q[0], q[3], q[2]] : [q[3], q[2], q[1], q[0]];
  selxRender(); drawOverlay();
}

/* ---------- the bar ---------- */
function selBarRender() {
  let bar = $('#selBar');
  const want = SELX.on || (sel.active && !stroke);
  if (!want) { if (bar) bar.hidden = true; return; }
  if (!bar) { bar = document.createElement('div'); bar.id = 'selBar'; viewport.appendChild(bar); for (const t of ['pointerdown', 'pointerup', 'touchstart', 'wheel']) bar.addEventListener(t, e => e.stopPropagation()); } // taps on the bar are not canvas strokes
  const key = SELX.on ? 'x' + SELX.mode + SELX.keep : 's';
  if (bar.dataset.key !== key) {
    bar.dataset.key = key;
    const B = (a, label, title, on) => `<button type="button" data-a="${a}" title="${title}"${on ? ' class="on"' : ''}>${label}</button>`;
    bar.innerHTML = SELX.on
      ? B('free', '⤢ Scale / rotate', 'Corners scale, the round handle rotates, inside moves', SELX.mode === 'free') + B('distort', '◇ Distort', 'Move each corner on its own', SELX.mode === 'distort') + B('keep', '🔒 Keep shape', 'Corners keep the proportions (or hold Shift)', SELX.keep) + B('fliph', '⇋', 'Flip left ↔ right') + B('flipv', '⇵', 'Flip up ↕ down') + B('cancel', '✕ Cancel', 'Cancel (Esc)') + B('apply', '✓ Apply', 'Apply (Enter)', true)
      : B('transform', '⤢ Transform', 'Scale, rotate or distort the selected part') + B('deselect', '⬚ Deselect', 'Drop the selection (Ctrl+D)') + B('invert', '◩ Invert', 'Select everything else') + B('copy', '⧉ Copy', 'Copy (Ctrl+C)') + B('cut', '✂ Cut', 'Cut (Ctrl+X)') + B('fill', '🪣 Fill', 'Fill with the colour');
    bar.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
      const a = b.dataset.a;
      if (a === 'transform') selxStart(); else if (a === 'deselect') deselect(); else if (a === 'invert') invertSel(); else if (a === 'copy') copySelection(false); else if (a === 'cut') copySelection(true); else if (a === 'fill') fillSelection();
      else if (a === 'free' || a === 'distort') { if (a === 'free' && SELX.mode === 'distort' && !quadIsAffine(SELX.q)) toast('Distorted: corners stay free until you apply'); SELX.mode = a; }
      else if (a === 'keep') SELX.keep = !SELX.keep; else if (a === 'fliph') selxFlip(true); else if (a === 'flipv') selxFlip(false);
      else if (a === 'apply') selxEnd(true); else if (a === 'cancel') selxEnd(false);
      selBarRender(); drawOverlay();
    });
  }
  bar.hidden = false;
}
function installSelTransform() {
  viewport.addEventListener('pointerdown', selxDown, true);
  addEventListener('pointermove', selxMove, true);
  addEventListener('pointerup', selxUp, true); addEventListener('pointercancel', selxUp, true);
  // Enter / Esc during a transform (capture: before the app's own Esc = deselect)
  addEventListener('keydown', e => {
    if (!SELX.on || e.target.closest && e.target.closest('input, textarea, [contenteditable]')) return;
    if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); selxEnd(true); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); selxEnd(false); }
  }, true);
  // the frame and its handles on the canvas
  hookAfter('drawOverlay', () => {
    if (!SELX.on) return;
    const g = ovl.getContext('2d'), dpr = window.devicePixelRatio || 1, h = selxHandles();
    g.save(); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.strokeStyle = '#4fc3ff'; g.lineWidth = 1.5; g.beginPath(); h.cs.forEach((p, i) => i ? g.lineTo(...p) : g.moveTo(...p)); g.closePath(); g.stroke();
    g.beginPath(); g.moveTo(...h.edges[0]); g.lineTo(...h.rot); g.stroke();
    const dot = (p, r, round) => { g.beginPath(); if (round) g.arc(p[0], p[1], r, 0, 7); else g.rect(p[0] - r, p[1] - r, r * 2, r * 2); g.fillStyle = '#fff'; g.fill(); g.stroke(); };
    h.cs.forEach(p => dot(p, SELX.mode === 'distort' ? 6 : 5, SELX.mode === 'distort'));
    if (SELX.mode !== 'distort') h.edges.forEach(p => dot(p, 4));
    dot(h.rot, 6, true);
    g.restore();
  }, 30);
  // any other action ends a transform first (apply), so nothing is left half done
  const st0 = selectTool; selectTool = function (id) {
    if (SELX.on) selxEnd(true);
    // a selection that was moved / transformed is dropped when a drawing tool is chosen, so the whole page can be drawn on
    if (sel.active && sel._floated && TOOLDEF[id] && ['brush', 'shape', 'fill', 'gradient'].includes(kindOf(id))) { deselect(); toast('Selection dropped: you can draw anywhere again'); }
    return st0.apply(this, arguments);
  };
  const ds0 = deselect; deselect = function () { if (SELX.on) selxEnd(true); sel._floated = false; const out = ds0.apply(this, arguments); selBarRender(); return out; };
  const cs0 = combineSel; combineSel = function () { if (SELX.on) selxEnd(true); sel._floated = false; const out = cs0.apply(this, arguments); selBarRender(); return out; };
  // moving the selected pixels with the Move tool also makes it "floated"
  const pu0 = pixelMoveUp; pixelMoveUp = function (a) { const out = pu0.apply(this, arguments); if (a && (a.dx || a.dy)) sel._floated = true; return out; };
  const gf0 = gotoFrame; gotoFrame = function () { if (SELX.on) selxEnd(true); return gf0.apply(this, arguments); };
  // keep the bar in step with the selection (cheap check)
  setInterval(selBarRender, 250);
  CMD.selTransform = selxStart;
  const sm = MENUS.find(m => m[0] === 'Select');
  if (sm && !sm[1].some(x => Array.isArray(x) && x[1] === 'selTransform')) sm[1].push('-', ['⤢ Transform selection (scale / rotate / distort)', 'selTransform', 'Ctrl+T']);
  addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 't' && sel.active && !(e.target.closest && e.target.closest('input, textarea'))) { e.preventDefault(); selxStart(); } });
}
