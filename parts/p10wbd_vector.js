/* ---------- Vector ink layers ----------
   A vector layer (l.vector, Layer › New vector layer) keeps every pen stroke as an editable line: cel._vec = [{ s
   (the brush settings of the stroke), color, pts: [[x, y, pressure]…] (layer pixels) }]. The pixels are still drawn by
   the normal brush engine while you draw (so everything else — display, export, layers — just works); after a vector
   edit the cel is drawn again from its lines (vecRender: each line through the real dab engine, stampAt1).
   Tools (Vector group): Vector eraser — removes a line up to where it crosses other lines ("to intersection") or the
   whole line; Vector edit — click a line to pick it, drag to bend it (nearby points follow softly), Tool Property:
   thickness, smooth, delete. Erasers on a vector layer erase whole lines; fill / mixing brushes / filters are refused
   there (they would not survive an edit): use a normal layer for colours. Saved in the file (cels[].vec). */
const VEC = { sel: null, mode: 'cross' };
const isVecLayer = l => !!(l && l.vector);
const vecOf = cel => (cel && cel._vec) || [];
const cloneVec = v => v.map(o => ({ s: { ...o.s }, color: o.color, pts: o.pts.map(p => p.slice()) }));
/* ---- pure geometry ---- */
function polyLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
/* arc-length positions where segment-chain a crosses segment-chain b */
function polyCross(a, b) {
  const out = []; let acc = 0;
  for (let i = 1; i < a.length; i++) {
    const [x1, y1] = a[i - 1], [x2, y2] = a[i], L = Math.hypot(x2 - x1, y2 - y1);
    for (let j = 1; j < b.length; j++) {
      const [x3, y3] = b[j - 1], [x4, y4] = b[j], den = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3); if (!den) continue;
      const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / den, u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / den;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) out.push(acc + t * L);
    }
    acc += L;
  }
  return out.sort((p, q) => p - q);
}
/* the part of a line between arc lengths t0 and t1 (points interpolated at the cuts) */
function polySlice(pts, t0, t1) {
  const out = []; let acc = 0;
  const at = (i, t) => { const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, k = (t - acc) / L; return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; };
  if (t0 <= 0) out.push(pts[0].slice());
  for (let i = 1; i < pts.length; i++) {
    const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]), e = acc + L;
    if (t0 > acc && t0 < e) out.push(at(i, t0));
    if (e > t0 && e < t1) out.push(pts[i].slice());
    if (t1 > acc && t1 <= e) { out.push(at(i, t1)); break; }
    acc = e;
  }
  return out;
}
/* nearest point of a line to (x, y): { d (distance), t (arc length), i (segment) } */
function polyNear(pts, x, y) {
  let best = { d: Infinity, t: 0, i: 0 }, acc = 0;
  if (pts.length === 1) return { d: Math.hypot(pts[0][0] - x, pts[0][1] - y), t: 0, i: 0 };
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1], [x2, y2] = pts[i], dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1, L = Math.sqrt(L2);
    const k = clamp(((x - x1) * dx + (y - y1) * dy) / L2, 0, 1), d = Math.hypot(x1 + dx * k - x, y1 + dy * k - y);
    if (d < best.d) best = { d, t: acc + k * L, i };
    acc += L;
  }
  return best;
}
/* vector eraser on one line: the pieces that remain when the part around arc length th, between the nearest
   crossings with the other lines, is removed (mode 'cross'), or nothing (mode 'whole') */
function vecErasePieces(line, others, th, mode) {
  if (mode === 'whole') return [];
  const L = polyLen(line.pts), xs = []; for (const o of others) xs.push(...polyCross(line.pts, o.pts));
  let a = 0, b = L; for (const t of xs) { if (t < th - 0.5 && t > a) a = t; if (t > th + 0.5 && t < b) b = t; }
  const out = [];
  if (a > 1) out.push({ ...line, s: { ...line.s }, pts: polySlice(line.pts, 0, a) });
  if (L - b > 1) out.push({ ...line, s: { ...line.s }, pts: polySlice(line.pts, b, L) });
  return out.filter(p => p.pts.length >= 2);
}
/* soft move: points near arc length t0 follow (dx, dy), falling off over radius R (pure) */
function vecBend(pts, t0, dx, dy, R) {
  let acc = 0; return pts.map((p, i) => { if (i) acc += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]); const k = Math.max(0, 1 - Math.abs(acc - t0) / R), w = k * k * (3 - 2 * k); return [p[0] + dx * w, p[1] + dy * w, p[2]]; });
}
function vecSmooth(pts, n = 3) { let P = pts.map(p => p.slice()); for (let k = 0; k < n; k++) P = P.map((p, i) => (i === 0 || i === P.length - 1) ? p : [(P[i - 1][0] + 2 * p[0] + P[i + 1][0]) / 4, (P[i - 1][1] + 2 * p[1] + P[i + 1][1]) / 4, p[2]]); return P; }
/* ---- drawing a line again with the real dab engine ---- */
function vecDrawLine(g, line) {
  const s = { ...line.s, smudge: undefined, paint: undefined }, pts = line.pts; if (!pts.length) return;
  const pad = (s.size || 10) * (1 + 2 * (s.scatter || 0)) + 6;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  x0 = Math.floor(x0 - pad); y0 = Math.floor(y0 - pad); const w = Math.ceil(x1 + pad) - x0, h = Math.ceil(y1 + pad) - y0; if (w < 1 || h < 1) return;
  const tmp = makeCanvas(w, h), tg = tmp.getContext('2d'); tg.translate(-x0, -y0);
  const st = { s, color: line.color, ctx: tg, erase: false, box: newBox(), mbox: newBox(), travel: 0, tex: false };
  const L = polyLen(pts); let trav = 0, next = 0;
  stampAt1(st, pts[0][0], pts[0][1], pts[0][2]); next = stepAt(st, pts[0][2]);
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay, ap] = pts[i - 1], [bx, by, bp] = pts[i], d = Math.hypot(bx - ax, by - ay);
    while (next <= d) { const k = d ? next / d : 0, pr = ap + (bp - ap) * k; st.travel = trav + next; st.outK = s.taperOut && L - st.travel < s.taperOut ? clamp((L - st.travel) / s.taperOut, 0, 1) : null; stampAt1(st, ax + (bx - ax) * k, ay + (by - ay) * k, pr); next += stepAt(st, pr); }
    next -= d; trav += d;
  }
  g.save(); g.globalAlpha = s.opacity ?? 1; g.globalCompositeOperation = s.blendOp || 'source-over'; g.drawImage(tmp, x0, y0); g.restore();
}
function vecRender(cel) {
  const g = cel.getContext('2d'); g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cel.width, cel.height); g.restore();
  for (const line of vecOf(cel)) vecDrawLine(g, line);
  cel._ink = vecOf(cel).length > 0; cel._sv = (cel._sv || 0) + 1; cel._bb = undefined;
}
/* an undoable change of the lines of a cel */
function vecEdit(l, cel, fn) {
  const before = cloneVec(vecOf(cel)); fn(); const after = cloneVec(vecOf(cel));
  const apply = v => { cel._vec = cloneVec(v); vecRender(cel); markDirty(); refreshAll(); };
  vecRender(cel); markDirty(); refreshAll();
  pushHistory({ undo() { apply(before); }, redo() { apply(after); } });
}
const vecCel = () => { const l = activeLayer(); if (!isVecLayer(l)) return null; const k = keyAt(l, state.frame); return k == null ? null : l.cels.get(k); };
function vecHit(cel, x, y) {
  const lines = vecOf(cel); let best = -1, bd = Infinity, bt = 0;
  lines.forEach((ln, i) => { const n = polyNear(ln.pts, x, y), tol = Math.max(8 / view.scale, (ln.s.size || 6) / 2 + 3 / view.scale); if (n.d < tol && n.d < bd) { bd = n.d; best = i; bt = n.t; } });
  return best < 0 ? null : { i: best, t: bt };
}
function vecEraseAt(l, cel, x, y, mode) {
  const h = vecHit(cel, x, y); if (!h) return false;
  const lines = vecOf(cel), line = lines[h.i], others = lines.filter((_, j) => j !== h.i);
  cel._vec = [...lines.slice(0, h.i), ...vecErasePieces(line, others, h.t, mode), ...lines.slice(h.i + 1)];
  return true;
}
const VEC_ERASER = {
  name: 'Vector eraser', kind: 'dragdraw', icon: 'eraser',
  ddDown(o) { const l = activeLayer(), cel = vecCel(); if (!cel) { toast('The Vector eraser works on a vector layer (Layer › New vector layer)'); return; } o.l = l; o.cel = cel; o.before = cloneVec(vecOf(cel)); o.hit = vecEraseAt(l, cel, o.x0, o.y0, VEC.mode); if (o.hit) vecRender(cel), refreshStage(); },
  ddMove(o) { if (!o.cel) return; if (vecEraseAt(o.l, o.cel, o.x1, o.y1, VEC.mode)) { o.hit = true; vecRender(o.cel); refreshStage(); } },
  ddEnd(o) { if (!o.cel || !o.hit) return; const after = cloneVec(vecOf(o.cel)), before = o.before, cel = o.cel; const apply = v => { cel._vec = cloneVec(v); vecRender(cel); markDirty(); refreshAll(); }; markDirty(); refreshAll(); pushHistory({ undo() { apply(before); }, redo() { apply(after); } }); },
  overlay: (g, S) => vecOverlay(g, S),
  props(body) {
    hint(body, 'Rub over a line of a vector layer to erase it.');
    seg(body, [['cross', 'To the crossing lines'], ['whole', 'Whole line']], VEC.mode, v => { VEC.mode = v; refreshProps(); });
    hint(body, VEC.mode === 'cross' ? 'Erases the line only up to where it crosses other lines — clean corners in one rub.' : 'Erases every line you touch.');
  }
};
const VEC_EDIT = {
  name: 'Vector edit (bend, thickness)', kind: 'dragdraw', icon: 'pen',
  ddDown(o) { const cel = vecCel(); if (!cel) { toast('Vector edit works on a vector layer (Layer › New vector layer)'); return; } const h = vecHit(cel, o.x0, o.y0); VEC.sel = h ? h.i : null; o.cel = cel; o.h = h; if (h) { o.before = cloneVec(vecOf(cel)); o.pts0 = vecOf(cel)[h.i].pts.map(p => p.slice()); } refreshProps(); drawOverlay(); },
  ddMove(o) { if (!o.h) return; const ln = vecOf(o.cel)[o.h.i], R = Math.max(40, polyLen(o.pts0) * 0.35); ln.pts = vecBend(o.pts0, o.h.t, o.x1 - o.x0, o.y1 - o.y0, R); o.moved = true; vecRender(o.cel); refreshStage(); },
  ddEnd(o) { if (!o.h || !o.moved) return; const cel = o.cel, before = o.before, after = cloneVec(vecOf(cel)); const apply = v => { cel._vec = cloneVec(v); vecRender(cel); markDirty(); refreshAll(); }; markDirty(); refreshAll(); pushHistory({ undo() { apply(before); }, redo() { apply(after); } }); },
  overlay: (g, S) => vecOverlay(g, S),
  props(body) {
    const cel = vecCel(), ln = cel && VEC.sel != null ? vecOf(cel)[VEC.sel] : null;
    hint(body, 'Click a line of a vector layer to pick it; drag it to bend it (the points nearby follow softly).');
    if (!ln) { const p = document.createElement('div'); p.className = 'small muted'; p.textContent = cel ? `${vecOf(cel).length} lines on this layer — click one.` : 'Pick a vector layer.'; body.appendChild(p); return; }
    const l = activeLayer();
    slider(body, 'Line thickness', 1, 200, 1, ln.s.size, v => v + 'px', v => { ln.s.size = v; vecRender(cel); refreshStage(); clearTimeout(VEC.t); VEC.t = setTimeout(() => { markDirty(); }, 300); });
    btns(body, [['Smooth this line', () => vecEdit(l, cel, () => { ln.pts = vecSmooth(ln.pts, 4); })], ['Delete this line', () => { vecEdit(l, cel, () => { cel._vec = vecOf(cel).filter(x => x !== ln); }); VEC.sel = null; refreshProps(); }]]);
  }
};
function vecOverlay(g, S) {
  const cel = vecCel(); if (!cel) return;
  const l = activeLayer(), m = layerMat(l, state.frame) || I6;
  g.save(); g.lineWidth = 1.2;
  vecOf(cel).forEach((ln, i) => {
    g.strokeStyle = i === VEC.sel ? '#ff8a3d' : 'rgba(79,195,255,.75)'; g.beginPath();
    ln.pts.forEach((p, k) => { const q = S(...applyMat(m, p[0], p[1])); if (k) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.stroke();
    if (i === VEC.sel) { g.fillStyle = '#ff8a3d'; for (let k = 0; k < ln.pts.length; k += Math.max(1, Math.round(ln.pts.length / 24))) { const q = S(...applyMat(m, ln.pts[k][0], ln.pts[k][1])); g.fillRect(q[0] - 2, q[1] - 2, 4, 4); } }
  });
  g.restore();
}
function newVectorLayer() {
  timelineOp(() => { const l = createLayer('Vector ' + (state.layers.filter(x => x.vector).length + 1)); l.vector = true; const c = makeCel(false); c._vec = []; l.cels = new Map([[state.frame, c]]); insertLayerAt(l, state.layers.indexOf(activeLayer()) + 1); state.activeId = l.id; });
  refreshAll(); toast('Vector layer: every line stays editable — Vector edit bends a line or changes its thickness, the Vector eraser stops at crossing lines.', 5000);
}
function installVector() {
  TOOLDEF.vecerase = VEC_ERASER; TOOLDEF.vecedit = VEC_EDIT; settings.vecerase = {}; settings.vecedit = {};
  const at = GROUPS.findIndex(g => g.id === 'eraser') + 1 || GROUPS.length;
  GROUPS.splice(at, 0, { id: 'vector', name: 'Vector', key: '', icon: 'pen', subs: ['vecedit', 'vecerase'] });
  CMD.newVectorLayer = newVectorLayer;
  const L = MENUS.find(m => m[0] === 'Layer'); if (L) { const i = L[1].findIndex(x => Array.isArray(x) && x[1] === 'layerAdd'); L[1].splice(i + 1, 0, ['New vector layer', 'newVectorLayer']); }
  // record the path of every pen stroke on a vector layer
  const b0 = beginStroke; beginStroke = function (e) {
    const l = activeLayer();
    if (isVecLayer(l)) {
      const k = kindOf(state.tool), s = settings[state.tool] || {};
      if (k === 'fill' || (k === 'brush' && s.smudge != null)) { toast('Use a normal layer for colours and blending: a vector layer keeps lines only'); return; }
      if (k === 'brush' && TOOLDEF[state.tool].erase) { // erasers erase whole lines on a vector layer
        const cel = vecCel(); if (!cel) return; const d = toDoc(e), inv = invMat(layerMat(l, state.frame) || I6), [x, y] = applyMat(inv, d.x, d.y);
        const before = cloneVec(vecOf(cel)); if (vecEraseAt(l, cel, x, y, 'whole')) { const after = cloneVec(vecOf(cel)); vecRender(cel); markDirty(); refreshAll(); pushHistory({ undo() { cel._vec = cloneVec(before); vecRender(cel); refreshAll(); }, redo() { cel._vec = cloneVec(after); vecRender(cel); refreshAll(); } }); }
        return;
      }
    }
    const out = b0.apply(this, arguments);
    if (stroke && isVecLayer(stroke.t.layer) && !stroke.erase && !stroke.direct && !stroke.isShape) { stroke.vrec = []; stroke.vrec0 = [stroke.lx, stroke.ly, stroke.lp]; }
    return out;
  };
  const sg0 = segment; segment = function (st, x, y, pr) { if (st && st.vrec && !st.replaying) st.vrec.push([x, y, pr]); return sg0.apply(this, arguments); };
  const e0 = endStroke; endStroke = function (cancel) {
    const st = stroke, rec = st && st.vrec && !cancel ? [st.vrec0, ...st.vrec] : null;
    const n0 = history.undo.length, out = e0.apply(this, arguments);
    if (rec && rec.length >= 1) {
      const cel = st.t.cel, before = cloneVec(vecOf(cel)), s = JSON.parse(JSON.stringify({ ...(st.sFull || st.s), perfDefer: undefined }));
      const lines = [{ s, color: st.color, pts: rec }];
      if (st.sym) for (const m of st.sym) lines.push({ s: { ...s }, color: st.color, pts: rec.map(p => { const q = applyMat(m, p[0], p[1]); return [q[0], q[1], p[2]]; }) });
      cel._vec = [...before, ...lines]; const after = cloneVec(cel._vec);
      if (history.undo.length > n0) { const e = history.undo[history.undo.length - 1], u = e.undo, r = e.redo; e.undo = function () { const o = u.apply(this, arguments); cel._vec = cloneVec(before); return o; }; e.redo = function () { const o = r.apply(this, arguments); cel._vec = cloneVec(after); return o; }; }
    }
    return out;
  };
  // filters would not survive a line edit
  if (typeof effectDialog === 'function') { const fx0 = effectDialog; effectDialog = function () { if (isVecLayer(activeLayer())) { toast('Filters work on normal layers (a vector layer keeps lines only)'); return; } return fx0.apply(this, arguments); }; }
  // only pen / brush lines on a vector layer: fill, gradients, shapes… would not survive a line edit
  const cp0 = canPaint; canPaint = function () {
    const l = activeLayer();
    if (isVecLayer(l) && !(l.maskEdit && l.mask) && kindOf(state.tool) !== 'brush') { toast('Use a normal layer for colours, gradients and shapes: a vector layer keeps lines only'); return null; }
    return cp0.apply(this, arguments);
  };
  const cc0 = copyCel; copyCel = function (src) { const c = cc0.apply(this, arguments); if (src && src._vec) c._vec = cloneVec(src._vec); return c; };
}
