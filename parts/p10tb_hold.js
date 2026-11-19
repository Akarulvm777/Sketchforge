/* ---------- Hold gestures ----------
   - Hold still at the START of a stroke (finger, pen or mouse, ~0.5 s): eyedropper. The dab is removed and the colour
     under the pointer is picked; keep moving to pick another colour, release to keep it. Also works when touch pans.
   - Hold still at the END of a stroke, before lifting: QuickShape. The wobbly stroke is redrawn as the shape it looks
     like (straight line, corner line, arc, circle / ellipse, triangle, rectangle / square, polygon) with the same brush.
   Settings: View › Hold to pick colour / Hold to snap shapes (sketchforge.hold.v1).                                   */
const HOLD_KEY = 'sketchforge.hold.v1';
const HOLD = { pick: true, shape: true, ms: 500 };
try { Object.assign(HOLD, JSON.parse(localStorage.getItem(HOLD_KEY) || '{}')); } catch (e) { /* ignore */ }
const holdSave = () => { try { localStorage.setItem(HOLD_KEY, JSON.stringify(HOLD)); } catch (e) { /* ignore */ } };

/* called by beginStroke (p04) */
function holdBegin(st, e) {
  if (st.isShape || st.direct) return;
  st.qs = [[st.startX, st.startY, st.sp]];
  st.hold = { ax: e.clientX, ay: e.clientY, cx: e.clientX, cy: e.clientY, moved: 0, timer: 0 };
  holdArm(st);
}
/* called by moveStroke (p04) for every input point */
function qsRecord(st, x, y, pr, ev) {
  if (!st.qs || st.snapped) return;
  const h = st.hold, dx = ev.clientX - h.cx, dy = ev.clientY - h.cy;
  h.moved += Math.hypot(dx, dy); h.cx = ev.clientX; h.cy = ev.clientY;
  const last = st.qs[st.qs.length - 1];
  if (Math.hypot(x - last[0], y - last[1]) > 0.5) st.qs.push([x, y, pr]);
  if (Math.hypot(ev.clientX - h.ax, ev.clientY - h.ay) > (h.moved < 10 ? 6 : 4)) { h.ax = ev.clientX; h.ay = ev.clientY; holdArm(st); } // moving: restart the hold timer
}
function holdArm(st) {
  clearTimeout(st.hold.timer);
  st.hold.timer = setTimeout(() => holdFire(st), HOLD.ms);
}
function holdCancel(st) { if (st && st.hold) clearTimeout(st.hold.timer); }
function holdFire(st) {
  if (stroke !== st || st.snapped) return;
  const h = st.hold;
  if (h.moved < 9) { // never really moved: eyedropper
    if (!HOLD.pick || st.erase || pointers.size > 1) return;
    endStroke(true);
    pickAt({ clientX: h.cx, clientY: h.cy, altKey: false });
    active = { type: 'pick', hold: true };
    holdLoupe(h.cx, h.cy);
    return;
  }
  if (!HOLD.shape || st.erase || st.rlock || st.waitPr) return;
  const shape = recognizeShape(st.qs);
  if (shape) qsApply(st, shape);
}

/* ---------- eyedropper loupe ---------- */
function holdLoupe(x, y) {
  let el = $('#holdLoupe');
  if (!el) { el = document.createElement('div'); el.id = 'holdLoupe'; document.body.appendChild(el); }
  el.style.display = 'block';
  el.style.left = x + 'px'; el.style.top = y + 'px';
  el.style.setProperty('--c', state.color);
}
function holdLoupeHide() { const el = $('#holdLoupe'); if (el) el.style.display = 'none'; }

/* ---------- shape recognition ---------- */
function qsResample(P, n) {
  const out = [[P[0][0], P[0][1]]];
  let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
  if (L < 1e-6) return { R: out, L };
  const step = L / (n - 1); let acc = 0, prev = [P[0][0], P[0][1]];
  for (let i = 1; i < P.length; i++) {
    let cur = [P[i][0], P[i][1]], d = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
    while (acc + d >= step && d > 0) {
      const k = (step - acc) / d, q = [prev[0] + (cur[0] - prev[0]) * k, prev[1] + (cur[1] - prev[1]) * k];
      out.push(q); prev = q; d = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]); acc = 0;
    }
    acc += d; prev = cur;
  }
  if (out.length < n) out.push([P[P.length - 1][0], P[P.length - 1][1]]);
  return { R: out, L };
}
const segDist = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const t = l2 ? clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2, 0, 1) : 0;
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t);
};
function rdp(P, eps) {
  if (P.length < 3) return P.slice();
  let best = -1, idx = 0;
  for (let i = 1; i < P.length - 1; i++) { const d = segDist(P[i], P[0], P[P.length - 1]); if (d > best) { best = d; idx = i; } }
  if (best <= eps) return [P[0], P[P.length - 1]];
  const a = rdp(P.slice(0, idx + 1), eps), b = rdp(P.slice(idx), eps);
  return a.slice(0, -1).concat(b);
}
const polyErr = (R, V, closed) => {
  let s = 0;
  for (const p of R) {
    let m = 1e18;
    for (let i = 0; i < V.length - (closed ? 0 : 1); i++) m = Math.min(m, segDist(p, V[i], V[(i + 1) % V.length]));
    s += m * m;
  }
  return Math.sqrt(s / R.length);
};
/* algebraic circle fit (Kasa) */
function fitCircle(R) {
  let sx = 0, sy = 0; for (const p of R) { sx += p[0]; sy += p[1]; }
  const mx = sx / R.length, my = sy / R.length;
  let suu = 0, svv = 0, suv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0;
  for (const p of R) {
    const u = p[0] - mx, v = p[1] - my;
    suu += u * u; svv += v * v; suv += u * v; suuu += u * u * u; svvv += v * v * v; suvv += u * v * v; svuu += v * u * u;
  }
  const det = suu * svv - suv * suv;
  if (Math.abs(det) < 1e-9) return null;
  const b1 = 0.5 * (suuu + suvv), b2 = 0.5 * (svvv + svuu);
  const uc = (b1 * svv - b2 * suv) / det, vc = (suu * b2 - suv * b1) / det;
  const cx = uc + mx, cy = vc + my, r = Math.sqrt(uc * uc + vc * vc + (suu + svv) / R.length);
  let e = 0; for (const p of R) { const d = Math.hypot(p[0] - cx, p[1] - cy) - r; e += d * d; }
  return { cx, cy, r, err: Math.sqrt(e / R.length) };
}
const snapAng = (a, deg) => { const s = Math.PI / 4, n = Math.round(a / s) * s; return Math.abs(a - n) < deg * DEG ? n : a; };
function recognizeShape(P) {
  if (!P || P.length < 4) return null;
  const { R, L } = qsResample(P, 72);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of R) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  const D = Math.hypot(x1 - x0, y1 - y0);
  if (L * view.scale < 24 || D * view.scale < 14) return null;
  const A = R[0], B = R[R.length - 1], gap = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const closed = gap < 0.25 * D && L > 1.7 * D;
  if (!closed) {
    // straight line
    let dev = 0; for (const p of R) dev = Math.max(dev, segDist(p, A, B));
    if (dev < Math.max(0.065 * gap, 2 / view.scale)) {
      const ang = snapAng(Math.atan2(B[1] - A[1], B[0] - A[0]), 4);
      const E = [A[0] + Math.cos(ang) * gap, A[1] + Math.sin(ang) * gap];
      return { type: 'line', name: 'Straight line', pts: [A, E] };
    }
    const V = rdp(R, 0.06 * D), pe = polyErr(R, V, false) / D;
    const c = fitCircle(R), ce = c ? c.err / D : 1;
    if (c && ce < 0.03 && ce <= pe && c.r < 4 * D) { // arc from A to B through the stroke
      const a0 = Math.atan2(A[1] - c.cy, A[0] - c.cx), M = R[R.length >> 1];
      let a1 = Math.atan2(B[1] - c.cy, B[0] - c.cx), am = Math.atan2(M[1] - c.cy, M[0] - c.cx);
      const norm = a => { while (a < a0) a += 2 * Math.PI; while (a >= a0 + 2 * Math.PI) a -= 2 * Math.PI; return a; };
      a1 = norm(a1); am = norm(am);
      if (am > a1) a1 -= 2 * Math.PI; // go the other way round
      const n = Math.max(12, Math.ceil(Math.abs(a1 - a0) * 24)), pts = [];
      for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([c.cx + Math.cos(a) * c.r, c.cy + Math.sin(a) * c.r]); }
      return { type: 'arc', name: 'Arc', pts };
    }
    if (V.length >= 3 && V.length <= 5 && pe < 0.03) return { type: 'polyline', name: 'Corner line', pts: V };
    return null;
  }
  // closed: ellipse or polygon
  let mx = 0, my = 0; for (const p of R) { mx += p[0]; my += p[1]; } mx /= R.length; my /= R.length;
  let cxx = 0, cyy = 0, cxy = 0; for (const p of R) { const u = p[0] - mx, v = p[1] - my; cxx += u * u; cyy += v * v; cxy += u * v; }
  let th = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
  const co = Math.cos(th), si = Math.sin(th);
  let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
  for (const p of R) { const u = (p[0] - mx) * co + (p[1] - my) * si, v = -(p[0] - mx) * si + (p[1] - my) * co; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  let a = (u1 - u0) / 2, b = (v1 - v0) / 2;
  const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2, ex = mx + cu * co - cv * si, ey = my + cu * si + cv * co;
  let ee = 0;
  for (const p of R) {
    const u = (p[0] - ex) * co + (p[1] - ey) * si, v = -(p[0] - ex) * si + (p[1] - ey) * co;
    const r = Math.hypot(u / a, v / b); ee += ((r - 1) * (a + b) / 2) ** 2;
  }
  ee = Math.sqrt(ee / R.length) / D;
  // polygon corners: start from the point farthest from the centre, simplify the loop
  let fi = 0, fd = -1; R.forEach((p, i) => { const d = Math.hypot(p[0] - mx, p[1] - my); if (d > fd) { fd = d; fi = i; } });
  const loop = R.slice(fi).concat(R.slice(0, fi)); loop.push(loop[0]);
  let V = rdp(loop, 0.07 * D).slice(0, -1);
  V = V.filter((p, i) => { // drop corners that are almost straight
    const q = V[(i + V.length - 1) % V.length], r = V[(i + 1) % V.length];
    const a1 = Math.atan2(q[1] - p[1], q[0] - p[0]), a2 = Math.atan2(r[1] - p[1], r[0] - p[0]);
    let d = Math.abs(a1 - a2); if (d > Math.PI) d = 2 * Math.PI - d;
    return d < 158 * DEG;
  });
  if (V.length >= 3 && V.length <= 6) V = qsRefineCorners(loop, V);
  const pe = V.length >= 3 ? polyErr(R, V, true) / D : 1;
  if (V.length >= 3 && V.length <= 6 && pe < 0.035 && pe < ee * 0.85) {
    if (V.length === 4) { // rectangle / square if the corners are about 90°
      const right = V.every((p, i) => {
        const q = V[(i + 3) % 4], r = V[(i + 1) % 4];
        const d = (q[0] - p[0]) * (r[0] - p[0]) + (q[1] - p[1]) * (r[1] - p[1]);
        return Math.abs(d) / (Math.hypot(q[0] - p[0], q[1] - p[1]) * Math.hypot(r[0] - p[0], r[1] - p[1])) < 0.3;
      });
      if (right) {
        let best = 0, ang = 0;
        for (let i = 0; i < 4; i++) { const p = V[i], q = V[(i + 1) % 4], l = Math.hypot(q[0] - p[0], q[1] - p[1]); if (l > best) { best = l; ang = Math.atan2(q[1] - p[1], q[0] - p[0]); } }
        ang = ((ang % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2); if (ang > Math.PI / 4) ang -= Math.PI / 2;
        if (Math.abs(ang) < 7 * DEG) ang = 0;
        const c = Math.cos(ang), s = Math.sin(ang);
        let p0 = 1e9, p1 = -1e9, q0 = 1e9, q1 = -1e9;
        for (const p of V) { const u = p[0] * c + p[1] * s, v = -p[0] * s + p[1] * c; p0 = Math.min(p0, u); p1 = Math.max(p1, u); q0 = Math.min(q0, v); q1 = Math.max(q1, v); }
        let w = p1 - p0, hh = q1 - q0, name = 'Rectangle';
        const cu = (p0 + p1) / 2, cv = (q0 + q1) / 2;
        if (Math.abs(w - hh) / Math.max(w, hh) < 0.12) { w = hh = (w + hh) / 2; name = 'Square'; }
        const pts = [[-w / 2, -hh / 2], [w / 2, -hh / 2], [w / 2, hh / 2], [-w / 2, hh / 2]].map(([u, v]) => [(cu + u) * c - (cv + v) * s, (cu + u) * s + (cv + v) * c]);
        return { type: 'poly', name, pts: [...pts, pts[0]] };
      }
    }
    return { type: 'poly', name: V.length === 3 ? 'Triangle' : V.length === 4 ? 'Four-sided shape' : 'Polygon', pts: [...V, V[0]] };
  }
  if (ee < 0.06) {
    let name = 'Ellipse';
    if (Math.abs(a - b) / Math.max(a, b) < 0.12) { a = b = (a + b) / 2; name = 'Circle'; th = 0; }
    else { const s = snapAng(th, 8); if (Math.abs(s - th) > 1e-9 && Math.round(s / (Math.PI / 2)) * (Math.PI / 2) === s) th = s; }
    const c2 = Math.cos(th), s2 = Math.sin(th), n = 96, pts = [];
    // start where the stroke started, so the brush taper / texture begins at the same place
    const st0 = Math.atan2(-(A[0] - ex) * s2 + (A[1] - ey) * c2, (A[0] - ex) * c2 + (A[1] - ey) * s2);
    for (let i = 0; i <= n; i++) { const t = st0 + i / n * Math.PI * 2, u = Math.cos(t) * a, v = Math.sin(t) * b; pts.push([ex + u * c2 - v * s2, ey + u * s2 + v * c2]); }
    return { type: 'ellipse', name, pts };
  }
  return null;
}

/* corners where the best straight lines through each side meet (more exact than the wobbly corner points);
   sides within 4° of horizontal / vertical are levelled */
function qsRefineCorners(loop, V) {
  const n = V.length, idx = V.map(v => loop.indexOf(v));
  if (idx.some(i => i < 0)) return V;
  const lines = [];
  for (let k = 0; k < n; k++) {
    const i0 = idx[k], i1 = k + 1 < n ? idx[k + 1] : loop.length - 1, cnt = i1 - i0, pts = [];
    for (let i = i0 + Math.floor(cnt * 0.15); i <= i1 - Math.floor(cnt * 0.15); i++) pts.push(loop[i]);
    if (pts.length < 2) return V;
    let mx = 0, my = 0; for (const p of pts) { mx += p[0]; my += p[1]; } mx /= pts.length; my /= pts.length;
    let xx = 0, yy = 0, xy = 0; for (const p of pts) { const u = p[0] - mx, v = p[1] - my; xx += u * u; yy += v * v; xy += u * v; }
    let a = 0.5 * Math.atan2(2 * xy, xx - yy);
    const q = Math.round(a / (Math.PI / 2)) * (Math.PI / 2); if (Math.abs(a - q) < 4 * DEG) a = q;
    lines.push({ mx, my, dx: Math.cos(a), dy: Math.sin(a) });
  }
  const out = [];
  for (let k = 0; k < n; k++) {
    const A = lines[(k + n - 1) % n], B = lines[k], den = A.dx * B.dy - A.dy * B.dx;
    if (Math.abs(den) < 1e-6) return V;
    const t = ((B.mx - A.mx) * B.dy - (B.my - A.my) * B.dx) / den, P = [A.mx + A.dx * t, A.my + A.dy * t];
    if (Math.hypot(P[0] - V[k][0], P[1] - V[k][1]) > 0.25 * Math.hypot(...[0, 1].map(j => V[(k + 1) % n][j] - V[k][j]))) return V; // something odd: keep the simple corners
    out.push(P);
  }
  return out;
}
/* redraw the stroke as the recognised shape, with the same brush */
function qsApply(st, shape) {
  const b = st.box.x1 > st.box.x0 ? clampBox(st.box.x0 - 4, st.box.y0 - 4, st.box.x1 + 4, st.box.y1 + 4) : null;
  if (b) { bufCtx.clearRect(b.x, b.y, b.w, b.h); rawCtx.clearRect(b.x, b.y, b.w, b.h); }
  const prs = st.qs.map(p => p[2]).sort((x, y) => x - y), pr = prs[prs.length >> 1] || 0.5;
  st.box = newBox(); st.mbox = newBox(); st.cr = null; st.travel = 0;
  if (st.tq) st.tq = []; // thin end: forget the queued tail of the hand-drawn stroke
  const P = shape.pts, [sx, sy] = P[0];
  st.lx = st.sx = st.rx = sx; st.ly = st.sy = st.ry = sy; st.lp = st.sp = st.rp = pr;
  stampAt(st, sx, sy, pr); st.next = stepAt(st, pr);
  for (let i = 1; i < P.length; i++) segment(st, P[i][0], P[i][1], pr);
  st.rx = st.lx; st.ry = st.ly;
  if (b) { st.mbox.x0 = Math.min(st.mbox.x0, b.x); st.mbox.y0 = Math.min(st.mbox.y0, b.y); st.mbox.x1 = Math.max(st.mbox.x1, b.x + b.w); st.mbox.y1 = Math.max(st.mbox.y1, b.y + b.h); }
  afterMove(st);
  st.snapped = shape.type;
  toast(shape.name + ' ✓ — lift to keep it', 1400);
}

function installHold() {
  Object.assign(CMD, {
    holdPick: () => { HOLD.pick = !HOLD.pick; holdSave(); toast('Hold to pick a colour: ' + (HOLD.pick ? 'on' : 'off')); },
    holdShape: () => { HOLD.shape = !HOLD.shape; holdSave(); toast('Hold to snap shapes: ' + (HOLD.shape ? 'on' : 'off')); }
  });
  const V = MENUS.find(m => m[0] === 'View')[1];
  const i = V.findIndex(x => Array.isArray(x) && x[1] === 'penSettings');
  V.splice(i + 1, 0, ['Hold to pick colour (on / off)', 'holdPick'], ['Hold to snap shapes (on / off)', 'holdShape']);
  // touch that pans (Touch draws off) can also hold to pick
  let pan = null;
  viewport.addEventListener('pointerdown', e => {
    if (!HOLD.pick || e.pointerType !== 'touch' || !active || active.type !== 'pan' || pointers.size !== 1) return;
    pan = { id: e.pointerId, x: e.clientX, y: e.clientY, t: setTimeout(() => {
      if (!pan || !active || active.type !== 'pan' || pointers.size !== 1) return;
      pickAt({ clientX: pan.x, clientY: pan.y, altKey: false }); active = { type: 'pick', hold: true }; holdLoupe(pan.x, pan.y);
    }, HOLD.ms) };
  });
  viewport.addEventListener('pointermove', e => {
    if (pan && e.pointerId === pan.id && Math.hypot(e.clientX - pan.x, e.clientY - pan.y) > 8) { clearTimeout(pan.t); pan = null; }
    if (active && active.type === 'pick' && active.hold) holdLoupe(e.clientX, e.clientY);
  });
  const up = e => { if (pan && e.pointerId === pan.id) { clearTimeout(pan.t); pan = null; } holdLoupeHide(); };
  viewport.addEventListener('pointerup', up); viewport.addEventListener('pointercancel', up);
}
