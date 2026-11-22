/* ---------- Pro tools: rulers, panel frames, speech balloons, manga effects ---------- */
function proDialog(title, fields, ok, okLabel) {
  const d = document.createElement('dialog'); d.className = 'csdlg';
  const rows = fields.map(f => {
    if (f.type === 'select') return `<label>${f.label}<select data-k="${f.k}" style="grid-column:2/4">${f.options.map(o => `<option value="${o[0]}"${o[0] == f.val ? ' selected' : ''}>${o[1]}</option>`).join('')}</select></label>`;
    if (f.type === 'color') return `<label>${f.label}<input type="color" data-k="${f.k}" value="${f.val}" style="grid-column:2/4;width:60px"></label>`;
    if (f.type === 'check') return `<label>${f.label}<input type="checkbox" data-k="${f.k}"${f.val ? ' checked' : ''} style="grid-column:2/4;justify-self:start"></label>`;
    return `<label>${f.label}<input type="range" data-k="${f.k}" min="${f.min}" max="${f.max}" step="${f.step || 1}" value="${f.val}"><output>${f.val}</output></label>`;
  }).join('');
  d.innerHTML = `<form method="dialog"><h5>${title}</h5>${rows}<div class="row"><button value="cancel">Cancel</button><button value="ok" class="primary">${okLabel || 'OK'}</button></div></form>`;
  document.body.appendChild(d);
  d.querySelectorAll('input[type=range]').forEach(r => r.oninput = () => { r.nextElementSibling.textContent = r.value; });
  d.addEventListener('close', () => {
    if (d.returnValue === 'ok') {
      const p = {};
      d.querySelectorAll('[data-k]').forEach(r => { p[r.dataset.k] = r.type === 'checkbox' ? r.checked : (r.type === 'range' ? +r.value : r.value); });
      ok(p);
    }
    d.remove();
  });
  d.showModal();
}

/* paint arbitrary vector-ish content onto the active cel (respecting selection + undo) */
function paintOp(fn, box) {
  const layer = canPaint(); if (!layer) return;
  const t = acquireCel(layer);
  const tmp = makeCanvas(state.w, state.h), g = tmp.getContext('2d');
  fn(g, tmp);
  if (sel.active) { g.save(); g.globalCompositeOperation = 'destination-in'; g.drawImage(sel.mask, 0, 0); g.restore(); }
  let b = box ? clampBox(box.x0, box.y0, box.x1, box.y1) : { x: 0, y: 0, w: state.w, h: state.h };
  if (sel.active && sel.bb && !box) b = clampBox(sel.bb.x - 2, sel.bb.y - 2, sel.bb.x + sel.bb.w + 2, sel.bb.y + sel.bb.h + 2) || b;
  if (!b) { releaseCel(t); return; }
  const before = crop(t.cel, b);
  t.ctx.drawImage(tmp, 0, 0);
  t.cel._ink = true;
  pushHistory(celEntry(t, b, before, crop(t.cel, b)));
  afterEdit();
}
function regionOf() { return sel.active && sel.bb ? { x: sel.bb.x, y: sel.bb.y, w: sel.bb.w, h: sel.bb.h } : { x: 0, y: 0, w: state.w, h: state.h }; }

/* ======================== RULERS ======================== */
const ruler = { line: null, persp: null, sym: null, ell: null, show: true, snap: { line: true, persp: true, sym: true, ell: true }, symMode: 'mirror', symCount: 6 };
const RL_HIT = 36; /* screen px */
function distToLine(r, x, y) {
  const dx = r.x1 - r.x0, dy = r.y1 - r.y0, L = Math.hypot(dx, dy) || 1;
  return Math.abs((x - r.x0) * dy - (y - r.y0) * dx) / L;
}
function projLine(r, x, y) {
  const dx = r.x1 - r.x0, dy = r.y1 - r.y0, L2 = dx * dx + dy * dy || 1;
  const t = ((x - r.x0) * dx + (y - r.y0) * dy) / L2;
  return { x: r.x0 + dx * t, y: r.y0 + dy * t };
}
function ellInfo(r) { return { cx: (r.x0 + r.x1) / 2, cy: (r.y0 + r.y1) / 2, rx: Math.abs(r.x1 - r.x0) / 2 || 1, ry: Math.abs(r.y1 - r.y0) / 2 || 1 }; }
function projEll(r, x, y) {
  const e = ellInfo(r), a = Math.atan2((y - e.cy) / e.ry, (x - e.cx) / e.rx);
  return { x: e.cx + e.rx * Math.cos(a), y: e.cy + e.ry * Math.sin(a) };
}
function rulerStart(d) {
  const R = RL_HIT / view.scale;
  const cand = [];
  if (ruler.line && ruler.snap.line) { const dl = distToLine(ruler.line, d.x, d.y); if (dl < R) cand.push([dl, { type: 'line', r: ruler.line }]); }
  if (ruler.ell && ruler.snap.ell) { const p = projEll(ruler.ell, d.x, d.y), dl = Math.hypot(p.x - d.x, p.y - d.y); if (dl < R) cand.push([dl, { type: 'ell', r: ruler.ell }]); }
  if (ruler.persp && ruler.snap.persp) {
    const P = ruler.persp, dd = Math.hypot(d.x - P.x, d.y - P.y);
    if (dd > 6 / view.scale) cand.push([R * 0.9, { type: 'persp', x: P.x, y: P.y, a: Math.atan2(d.y - P.y, d.x - P.x) }]);
  }
  cand.sort((a, b) => a[0] - b[0]);
  return cand.length ? cand[0][1] : null;
}
function rulerApply(lock, d) {
  if (!lock) return d;
  if (lock.type === 'line') return projLine(lock.r, d.x, d.y);
  if (lock.type === 'ell') return projEll(lock.r, d.x, d.y);
  if (lock.type === 'persp') {
    const ux = Math.cos(lock.a), uy = Math.sin(lock.a), t = (d.x - lock.x) * ux + (d.y - lock.y) * uy;
    return { x: lock.x + ux * t, y: lock.y + uy * t };
  }
  return d;
}
function symOn() { return !!(ruler.sym && ruler.snap.sym); }
/* Symmetry as affine matrices [a,b,c,d,e,f] in document space, one per extra copy (identity excluded).
   Modes: mirror (one axis), quad (axis + perpendicular), rot (n-fold rotation), kaleido (n-fold rotation + mirrors). */
function symMats() {
  const a = ruler.sym; if (!a) return [];
  const cx = (a.x0 + a.x1) / 2, cy = (a.y0 + a.y1) / 2, th = Math.atan2(a.y1 - a.y0, a.x1 - a.x0), n = Math.max(2, ruler.symCount | 0);
  const about = m => { m[4] = cx - (m[0] * cx + m[2] * cy); m[5] = cy - (m[1] * cx + m[3] * cy); return m; };
  const refl = t => { const c = Math.cos(2 * t), s = Math.sin(2 * t); return about([c, s, s, -c, 0, 0]); };
  const rot = t => { const c = Math.cos(t), s = Math.sin(t); return about([c, s, -s, c, 0, 0]); };
  const m = ruler.symMode;
  if (m === 'quad') return [refl(th), refl(th + Math.PI / 2), rot(Math.PI)];
  if (m === 'rot' || m === 'kaleido') {
    const out = [];
    for (let i = 1; i < n; i++) out.push(rot(i * 2 * Math.PI / n));
    if (m === 'kaleido') for (let i = 0; i < n; i++) out.push(refl(th + i * Math.PI / n));
    return out;
  }
  return [refl(th)];
}
function symPoints(x, y) { return symMats().map(m => applyMat(m, x, y)); }
/* Symmetry matrices expressed in a layer's own pixel space (fwd = layer -> document matrix, or null if untransformed). */
function symLocal(fwd) {
  const ms = symMats(); if (!fwd) return ms;
  const inv = invMat(fwd); if (!inv) return ms;
  return ms.map(m => mulMat(inv, mulMat(m, fwd)));
}
function drawRulers(g, S) {
  if (!ruler.show) return;
  g.save();
  const line = (x0, y0, x1, y1, col, dash) => { const a = S(x0, y0), b = S(x1, y1); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.strokeStyle = col; g.setLineDash(dash || []); g.stroke(); };
  g.lineWidth = 1.3;
  const ext = (r, col, dash) => { const dx = r.x1 - r.x0, dy = r.y1 - r.y0, L = Math.hypot(dx, dy) || 1, k = 20000 / L; line(r.x0 - dx * k, r.y0 - dy * k, r.x1 + dx * k, r.y1 + dy * k, col, dash); };
  const handle = (x, y, col) => { const p = S(x, y); g.fillStyle = col; g.beginPath(); g.arc(p[0], p[1], 4, 0, 7); g.fill(); };
  if (ruler.line) { ext(ruler.line, ruler.snap.line ? '#2fd0ff' : '#6a8794'); handle(ruler.line.x0, ruler.line.y0, '#2fd0ff'); handle(ruler.line.x1, ruler.line.y1, '#2fd0ff'); }
  if (ruler.sym) {
    const r = ruler.sym, col = ruler.snap.sym ? '#ff5fd2' : '#8a6a82', cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2, th = Math.atan2(r.y1 - r.y0, r.x1 - r.x0);
    const axis = t => ext({ x0: cx, y0: cy, x1: cx + Math.cos(t), y1: cy + Math.sin(t) }, col, [8, 5]);
    const m = ruler.symMode, n = Math.max(2, ruler.symCount | 0);
    if (m === 'quad') { axis(th); axis(th + Math.PI / 2); }
    else if (m === 'rot' || m === 'kaleido') { for (let i = 0; i < n; i++) axis(th + i * Math.PI / n); }
    else axis(th);
    if (m !== 'mirror') handle(cx, cy, '#ff5fd2');
  }
  if (ruler.persp) {
    const P = ruler.persp, col = ruler.snap.persp ? 'rgba(255,190,60,.55)' : 'rgba(150,130,90,.4)';
    for (let i = 0; i < 48; i++) { const a = i * Math.PI / 24; line(P.x - Math.cos(a) * 20000, P.y - Math.sin(a) * 20000, P.x + Math.cos(a) * 20000, P.y + Math.sin(a) * 20000, col); }
    handle(P.x, P.y, '#ffbe3c');
  }
  if (ruler.ell) {
    const e = ellInfo(ruler.ell), c = S(e.cx, e.cy), m = vmat();
    g.save(); g.translate(c[0], c[1]); g.transform(m.a, m.b, m.c, m.d, 0, 0);
    g.beginPath(); g.ellipse(0, 0, e.rx, e.ry, 0, 0, 7); g.restore();
    g.strokeStyle = ruler.snap.ell ? '#6dff8a' : '#6a8a70'; g.setLineDash([]); g.stroke();
  }
  g.restore();
}

/* ======================== drag-draw tool engine ======================== */
let dd = null;
function ddDown(e) {
  const id = state.tool, def = TOOLDEF[id], d = toDoc(e);
  dd = { id, def, x0: d.x, y0: d.y, x1: d.x, y1: d.y, px: d.x, py: d.y, shift: e.shiftKey, alt: e.altKey, pr: 1 };
  active = { type: 'dd' };
  if (def.ddDown) def.ddDown(dd);
  drawOverlay();
}
function ddMove(e) {
  if (!dd) return;
  const d = toDoc(e);
  dd.px = dd.x1; dd.py = dd.y1; dd.x1 = d.x; dd.y1 = d.y; dd.shift = e.shiftKey; dd.pr = pressureOf(e);
  if (dd.def.ddMove) dd.def.ddMove(dd);
  drawOverlay();
}
function ddUp() {
  const o = dd; dd = null; active = null;
  if (o && o.def.ddEnd) o.def.ddEnd(o);
  drawOverlay();
}
function drawDDOverlay(g, S) {
  if (!dd || !dd.def.ddPreview) return;
  g.save(); g.lineWidth = 1.5; g.strokeStyle = '#fff'; g.setLineDash([5, 4]);
  dd.def.ddPreview(g, S, dd);
  g.restore();
}
function ddBox(o) {
  let x0 = Math.min(o.x0, o.x1), y0 = Math.min(o.y0, o.y1), x1 = Math.max(o.x0, o.x1), y1 = Math.max(o.y0, o.y1);
  if (o.shift) { const s = Math.max(x1 - x0, y1 - y0); x1 = x0 + s; y1 = y0 + s; }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
const boxPreview = (g, S, o, round) => { const b = ddBox(o), a = S(b.x, b.y), c = S(b.x + b.w, b.y + b.h); g.strokeRect(a[0], a[1], c[0] - a[0], c[1] - a[1]); };

/* ======================== balloons & frames ======================== */
const pro = { lw: 6, fill: true, tail: true, tailAng: 135, tailLen: 0.45, gutter: 14 };
function balloonPath(g, kind, b) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, rx = b.w / 2, ry = b.h / 2;
  g.beginPath();
  if (kind === 'ellipse') g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  else if (kind === 'round') { const r = Math.min(b.w, b.h) * 0.28; g.roundRect ? g.roundRect(b.x, b.y, b.w, b.h, r) : g.rect(b.x, b.y, b.w, b.h); }
  else if (kind === 'cloud' || kind === 'thought') {
    const n = Math.max(8, Math.round((rx + ry) / 28));
    for (let i = 0; i < n; i++) {
      const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, am = (a0 + a1) / 2;
      const p0 = [cx + Math.cos(a0) * rx * 0.9, cy + Math.sin(a0) * ry * 0.9], p1 = [cx + Math.cos(a1) * rx * 0.9, cy + Math.sin(a1) * ry * 0.9];
      const c = [cx + Math.cos(am) * rx * 1.12, cy + Math.sin(am) * ry * 1.12];
      if (!i) g.moveTo(p0[0], p0[1]);
      g.quadraticCurveTo(c[0], c[1], p1[0], p1[1]);
    }
    g.closePath();
  } else if (kind === 'spike') {
    const n = Math.max(12, Math.round((rx + ry) / 14)); let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n * 2; i++) {
      const a = i / (n * 2) * Math.PI * 2, k = i % 2 ? 0.72 + rnd() * 0.06 : 1.0 - rnd() * 0.08;
      const x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
  }
}
function tailPath(g, b, kind, ang, lenK) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, rx = b.w / 2, ry = b.h / 2, A = ang * Math.PI / 180, sp = 0.2;
  const pt = (a, k) => [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
  const L = 1 + lenK, p0 = pt(A - sp, 0.92), p1 = pt(A + sp, 0.92), tip = pt(A + 0.1, L);
  g.beginPath(); g.moveTo(p0[0], p0[1]);
  g.quadraticCurveTo((p0[0] + tip[0]) / 2 + (tip[1] - p0[1]) * 0.08, (p0[1] + tip[1]) / 2 - (tip[0] - p0[0]) * 0.08, tip[0], tip[1]);
  g.quadraticCurveTo((p1[0] + tip[0]) / 2 - (tip[1] - p1[1]) * 0.08, (p1[1] + tip[1]) / 2 + (tip[0] - p1[0]) * 0.08, p1[0], p1[1]);
  g.closePath();
}
function drawBalloon(g, kind, b, o) {
  const lw = o.lw, ink = state.color, paper = o.fillColor || state.color2 || '#ffffff';
  g.lineJoin = 'round'; g.lineCap = 'round';
  const thoughtDots = () => {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, A = o.tailAng * Math.PI / 180;
    [[1.18, 0.09], [1.36, 0.06], [1.52, 0.04]].forEach(([k, r]) => {
      const x = cx + Math.cos(A) * b.w / 2 * k, y = cy + Math.sin(A) * b.h / 2 * k, rr = Math.min(b.w, b.h) * r;
      g.beginPath(); g.arc(x, y, rr + lw, 0, 7); g.fillStyle = ink; g.fill();
      g.beginPath(); g.arc(x, y, rr, 0, 7); g.fillStyle = paper; g.fill();
    });
  };
  g.strokeStyle = ink; g.lineWidth = lw * 2;
  balloonPath(g, kind, b); g.stroke();
  const hasTail = o.tail && kind !== 'thought';
  if (hasTail) { tailPath(g, b, kind, o.tailAng, o.tailLen); g.stroke(); }
  g.fillStyle = paper;
  balloonPath(g, kind, b); g.fill();
  if (hasTail) { tailPath(g, b, kind, o.tailAng, o.tailLen); g.fill(); }
  if (kind === 'thought' && o.tail) thoughtDots();
}
function drawFrameRect(g, b, o) {
  g.lineJoin = 'miter';
  if (o.fill) { g.fillStyle = state.color2 || '#fff'; g.fillRect(b.x, b.y, b.w, b.h); }
  g.strokeStyle = state.color; g.lineWidth = o.lw; g.strokeRect(b.x, b.y, b.w, b.h);
}
function panelLayout(p) {
  const m = p.margin, gu = p.gutter, cw = (state.w - 2 * m - gu * (p.cols - 1)) / p.cols, ch = (state.h - 2 * m - gu * (p.rows - 1)) / p.rows;
  paintOp(g => {
    for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++) drawFrameRect(g, { x: m + c * (cw + gu), y: m + r * (ch + gu), w: cw, h: ch }, { lw: p.lw, fill: p.fill });
  });
}
function frameCut(o) {
  const gu = pro.gutter, lw = pro.lw;
  const dx = o.x1 - o.x0, dy = o.y1 - o.y0, L = Math.hypot(dx, dy); if (L < 4) return;
  const nx = -dy / L, ny = dx / L, k = 4000 / L;
  const a = [o.x0 - dx * k, o.y0 - dy * k], b = [o.x1 + dx * k, o.y1 + dy * k];
  const layer = canPaint(); if (!layer) return;
  const t = acquireCel(layer), full = { x: 0, y: 0, w: state.w, h: state.h }, before = crop(t.cel, full);
  const reg = new Path2D(); // restrict to the area spanned by the dragged segment (+ margin) so far-away panels stay intact
  const pad = Math.max(gu + lw * 2, 20);
  const rx0 = Math.min(o.x0, o.x1) - pad, ry0 = Math.min(o.y0, o.y1) - pad, rw = Math.abs(dx) + pad * 2, rh = Math.abs(dy) + pad * 2;
  t.ctx.save(); t.ctx.beginPath(); t.ctx.rect(rx0, ry0, rw, rh); t.ctx.clip();
  t.ctx.globalCompositeOperation = 'destination-out'; t.ctx.lineWidth = gu + lw * 2; t.ctx.lineCap = 'butt';
  t.ctx.beginPath(); t.ctx.moveTo(a[0], a[1]); t.ctx.lineTo(b[0], b[1]); t.ctx.stroke();
  t.ctx.globalCompositeOperation = 'source-over'; t.ctx.strokeStyle = state.color; t.ctx.lineWidth = lw;
  for (const s of [-1, 1]) { const off = s * (gu / 2 + lw / 2); t.ctx.beginPath(); t.ctx.moveTo(a[0] + nx * off, a[1] + ny * off); t.ctx.lineTo(b[0] + nx * off, b[1] + ny * off); t.ctx.stroke(); }
  t.ctx.restore();
  t.cel._ink = true;
  pushHistory(celEntry(t, full, before, crop(t.cel, full)));
  afterEdit();
}

/* ======================== manga effects ======================== */
function tapered(g, x0, y0, x1, y1, w0, w1) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  g.beginPath(); g.moveTo(x0 + nx * w0 / 2, y0 + ny * w0 / 2); g.lineTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
  g.lineTo(x1 - nx * w1 / 2, y1 - ny * w1 / 2); g.lineTo(x0 - nx * w0 / 2, y0 - ny * w0 / 2); g.closePath(); g.fill();
}
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function focusLines(p) {
  const R = regionOf(), cx = R.x + R.w / 2, cy = R.y + R.h / 2, reach = Math.hypot(R.w, R.h) * 0.75, inner = Math.min(R.w, R.h) / 2 * p.inner / 100;
  const r = rng(p.seed);
  paintOp(g => {
    g.fillStyle = state.color;
    for (let i = 0; i < p.count; i++) {
      const a = (i + (r() - 0.5) * p.random / 100) / p.count * Math.PI * 2, k = 1 + r() * p.random / 100 * 0.7;
      const r0 = inner * (0.85 + r() * 0.3 * p.random / 50), w = p.width * (0.5 + r() * p.random / 100);
      tapered(g, cx + Math.cos(a) * r0 * k, cy + Math.sin(a) * r0 * k, cx + Math.cos(a) * reach, cy + Math.sin(a) * reach, 0.6, w);
    }
  });
}
function speedLines(p) {
  const R = regionOf(), cx = R.x + R.w / 2, cy = R.y + R.h / 2, A = p.angle * Math.PI / 180, ux = Math.cos(A), uy = Math.sin(A), nx = -uy, ny = ux;
  const span = Math.hypot(R.w, R.h), r = rng(p.seed);
  paintOp(g => {
    g.fillStyle = state.color;
    for (let i = 0; i < p.count; i++) {
      const off = (r() - 0.5) * span, len = span * (p.length / 100) * (0.4 + r() * 0.6), start = (r() - 0.5) * span;
      const x = cx + nx * off + ux * start, y = cy + ny * off + uy * start;
      tapered(g, x - ux * len / 2, y - uy * len / 2, x + ux * len / 2, y + uy * len / 2, 0.5, p.width * (0.4 + r() * 0.6));
      /* second half: taper the other way for a spindle */
      tapered(g, x + ux * len / 2, y + uy * len / 2, x + ux * len, y + uy * len, p.width * (0.4 + r() * 0.6) * 0.6, 0.3);
    }
  });
}
function toneFill(p) {
  const R = regionOf(), dpi = state.dpi || 72, sp = Math.max(4, dpi / p.lpi), A = p.angle * Math.PI / 180, c = Math.cos(A), s = Math.sin(A);
  const cx = R.x + R.w / 2, cy = R.y + R.h / 2, span = Math.hypot(R.w, R.h);
  const dens = (x, y) => {
    let d = p.density / 100;
    if (p.grad === 'h') d *= (x - R.x) / R.w; else if (p.grad === 'v') d *= (y - R.y) / R.h;
    else if (p.grad === 'r') d *= Math.min(1, Math.hypot(x - cx, y - cy) / (Math.min(R.w, R.h) / 2));
    return Math.max(0, Math.min(1, d));
  };
  paintOp(g => {
    g.fillStyle = state.color; g.strokeStyle = state.color;
    const n = Math.ceil(span / sp) + 2, r = rng(3);
    for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
      const lx = i * sp, ly = j * sp, x = cx + lx * c - ly * s, y = cy + lx * s + ly * c;
      if (x < R.x - sp || y < R.y - sp || x > R.x + R.w + sp || y > R.y + R.h + sp) continue;
      const d = dens(x, y); if (d <= 0.01) continue;
      if (p.kind === 'dot') { g.beginPath(); g.arc(x, y, Math.sqrt(d / Math.PI) * sp * 0.98, 0, 7); g.fill(); }
      else if (p.kind === 'cross') { const w = d * sp * 0.5; g.fillRect(x - w, y - sp / 2, w * 2, sp); g.fillRect(x - sp / 2, y - w, sp, w * 2); }
      else if (p.kind === 'noise') { if (r() < d) g.fillRect(x, y, Math.max(1, sp * 0.4), Math.max(1, sp * 0.4)); }
      else if (p.kind === 'line' && i === 0) { g.lineWidth = Math.max(0.6, d * sp); g.beginPath(); g.moveTo(cx + lx * c - (-n * sp) * s, cy + lx * s + (-n * sp) * c); g.lineTo(cx + lx * c - (n * sp) * s, cy + lx * s + (n * sp) * c); g.stroke(); }
    }
  });
}

/* ======================== install ======================== */
function installPro() {
  Object.assign(IC, {
    ruler: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
    frame: '<rect x="3" y="3" width="18" height="18"/><path d="M3 12h18M12 3v9"/>',
    balloon: '<ellipse cx="12" cy="10" rx="9" ry="6.5"/><path d="M7 15l-2 5 6-3.5"/>'
  });
  const mk = (id, name, icon, extra) => { TOOLDEF[id] = { name, kind: 'dragdraw', icon, ...extra }; };
  /* rulers */
  mk('rl_line', 'Linear ruler', 'ruler', { ddEnd: o => { if (Math.hypot(o.x1 - o.x0, o.y1 - o.y0) > 3) { ruler.line = { x0: o.x0, y0: o.y0, x1: o.x1, y1: o.y1 }; } else ruler.line = null; ruler.snap.line = true; refreshProps(); },
    ddPreview: (g, S, o) => { const a = S(o.x0, o.y0), b = S(o.x1, o.y1); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); } });
  mk('rl_persp', 'Perspective ruler', 'ruler', { ddEnd: o => { ruler.persp = { x: o.x1, y: o.y1 }; ruler.snap.persp = true; refreshProps(); } });
  mk('rl_sym', 'Symmetry ruler', 'ruler', { ddEnd: o => {
    if (Math.hypot(o.x1 - o.x0, o.y1 - o.y0) > 3) ruler.sym = { x0: o.x0, y0: o.y0, x1: o.x1, y1: o.y1 }; else ruler.sym = { x0: o.x0, y0: o.y0 - 400, x1: o.x0, y1: o.y0 + 400 };
    ruler.snap.sym = true; refreshProps(); },
    ddPreview: (g, S, o) => { const a = S(o.x0, o.y0), b = S(o.x1, o.y1); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); } });
  mk('rl_ell', 'Figure ruler (ellipse)', 'ruler', { ddEnd: o => { const b = ddBox(o); if (b.w > 3 && b.h > 3) { ruler.ell = { x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.h }; ruler.snap.ell = true; } refreshProps(); },
    ddPreview: (g, S, o) => { const b = ddBox(o), c = S(b.x + b.w / 2, b.y + b.h / 2), m = vmat(); g.save(); g.translate(c[0], c[1]); g.transform(m.a, m.b, m.c, m.d, 0, 0); g.beginPath(); g.ellipse(0, 0, b.w / 2, b.h / 2, 0, 0, 7); g.restore(); g.stroke(); } });
  /* panel frames */
  mk('fr_rect', 'Frame border', 'frame', { ddEnd: o => { const b = ddBox(o); if (b.w > 6 && b.h > 6) paintOp(g => drawFrameRect(g, b, pro), { x0: b.x - pro.lw, y0: b.y - pro.lw, x1: b.x + b.w + pro.lw, y1: b.y + b.h + pro.lw }); }, ddPreview: boxPreview });
  mk('fr_cut', 'Divide frame', 'frame', { ddEnd: frameCut, ddPreview: (g, S, o) => { const a = S(o.x0, o.y0), b = S(o.x1, o.y1); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); } });
  /* balloons */
  const bal = (id, name, kind) => mk(id, name, 'balloon', { balloon: kind, ddEnd: o => { const b = ddBox(o); if (b.w > 10 && b.h > 10) { const pad = pro.lw * 2 + Math.max(b.w, b.h) * pro.tailLen + 20; paintOp(g => drawBalloon(g, kind, b, pro), { x0: b.x - pad, y0: b.y - pad, x1: b.x + b.w + pad, y1: b.y + b.h + pad }); } },
    ddPreview: (g, S, o) => { const b = ddBox(o), a = S(b.x, b.y), c = S(b.x + b.w, b.y + b.h); g.strokeRect(a[0], a[1], c[0] - a[0], c[1] - a[1]); } });
  bal('bl_ellipse', 'Ellipse balloon', 'ellipse'); bal('bl_round', 'Rounded balloon', 'round'); bal('bl_cloud', 'Cloud balloon', 'cloud');
  bal('bl_spike', 'Shout balloon', 'spike'); bal('bl_thought', 'Thought balloon', 'thought');
  const at = GROUPS.findIndex(g => g.id === 'text');
  GROUPS.splice(at, 0,
    { id: 'ruler', name: 'Ruler', key: '', icon: 'ruler', subs: ['rl_line', 'rl_persp', 'rl_sym', 'rl_ell'] },
    { id: 'frame', name: 'Frame border', key: '', icon: 'frame', subs: ['fr_rect', 'fr_cut'] },
    { id: 'balloon', name: 'Balloon', key: '', icon: 'balloon', subs: ['bl_ellipse', 'bl_round', 'bl_cloud', 'bl_spike', 'bl_thought'] });
  Object.assign(CMD, {
    rulerClear: () => { ruler.line = ruler.persp = ruler.sym = ruler.ell = null; drawOverlay(); refreshProps(); toast('Rulers cleared'); },
    rulerShow: () => { ruler.show = !ruler.show; drawOverlay(); },
    rulerSnap: () => { const on = !Object.values(ruler.snap).some(Boolean); for (const k in ruler.snap) ruler.snap[k] = on; drawOverlay(); refreshProps(); toast('Ruler snapping ' + (on ? 'on' : 'off')); },
    panelLayout: () => proDialog('Panel layout', [
      { k: 'cols', label: 'Columns', min: 1, max: 6, val: 2 }, { k: 'rows', label: 'Rows', min: 1, max: 8, val: 3 },
      { k: 'margin', label: 'Page margin', min: 0, max: Math.round(state.w / 4), val: Math.round(state.w * 0.06) },
      { k: 'gutter', label: 'Gutter', min: 0, max: 200, val: Math.round(state.w * 0.015) },
      { k: 'lw', label: 'Border width', min: 1, max: 30, val: pro.lw }, { k: 'fill', label: 'Fill panels', type: 'check', val: false }], panelLayout),
    focusLines: () => proDialog('Focus lines (concentration)', [
      { k: 'count', label: 'Lines', min: 20, max: 500, val: 160 }, { k: 'inner', label: 'Inner clearing %', min: 5, max: 95, val: 45 },
      { k: 'width', label: 'Max line width', min: 1, max: 60, val: 14 }, { k: 'random', label: 'Randomness', min: 0, max: 100, val: 60 }, { k: 'seed', label: 'Seed', min: 1, max: 99, val: 7 }], focusLines),
    speedLines: () => proDialog('Speed lines', [
      { k: 'angle', label: 'Direction °', min: 0, max: 359, val: 0 }, { k: 'count', label: 'Lines', min: 10, max: 400, val: 120 },
      { k: 'length', label: 'Length %', min: 10, max: 100, val: 55 }, { k: 'width', label: 'Max line width', min: 1, max: 40, val: 8 }, { k: 'seed', label: 'Seed', min: 1, max: 99, val: 3 }], speedLines),
    toneFill: () => proDialog('Screen tone', [
      { k: 'kind', label: 'Pattern', type: 'select', val: 'dot', options: [['dot', 'Halftone dots'], ['line', 'Lines'], ['cross', 'Cross hatch'], ['noise', 'Noise / sand']] },
      { k: 'lpi', label: 'Lines / inch', min: 20, max: 120, val: 60 }, { k: 'angle', label: 'Angle °', min: 0, max: 90, val: 45 },
      { k: 'density', label: 'Density %', min: 5, max: 100, val: 30 },
      { k: 'grad', label: 'Gradient', type: 'select', val: 'none', options: [['none', 'None (flat)'], ['h', 'Left → right'], ['v', 'Top → bottom'], ['r', 'Radial (centre light)']] }], toneFill)
  });
  const M = n => MENUS.find(m => m[0] === n)[1];
  MENUS.splice(MENUS.findIndex(m => m[0] === 'Animation'), 0, ['Manga', [
    ['Panel layout…', 'panelLayout'], '-', ['Focus lines…', 'focusLines'], ['Speed lines…', 'speedLines'], ['Screen tone…', 'toneFill'], '-',
    ['Clear rulers', 'rulerClear'], ['Show / hide rulers', 'rulerShow'], ['Ruler snapping on / off', 'rulerSnap']]]);
}
/* property panel for the drag-draw tools */
function proProps(body, id) {
  const def = TOOLDEF[id];
  const chk = (label, get, set) => { const l = document.createElement('label'); l.className = 'check'; const i = document.createElement('input'); i.type = 'checkbox'; i.checked = get(); i.onchange = () => { set(i.checked); drawOverlay(); }; l.append(i, ' ' + label); body.appendChild(l); };
  const sel2 = (label, opts, get, set) => { const l = document.createElement('label'); l.className = 'select'; l.innerHTML = `<span>${label}</span>`; const s = document.createElement('select'); opts.forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; if (v == get()) o.selected = true; s.appendChild(o); }); s.onchange = () => { set(s.value); drawOverlay(); }; l.appendChild(s); body.appendChild(l); };
  if (id.startsWith('rl_')) {
    grp(body, 'Snap strokes to');
    chk('Linear ruler' + (ruler.line ? '' : ' (not set)'), () => ruler.snap.line, v => ruler.snap.line = v);
    chk('Perspective ruler' + (ruler.vps && ruler.vps.length ? '' : ' (not set)'), () => ruler.snap.persp, v => ruler.snap.persp = v);
    chk('Figure ruler' + (ruler.ell ? '' : ' (not set)'), () => ruler.snap.ell, v => ruler.snap.ell = v);
    chk('Symmetry ruler' + (ruler.sym ? '' : ' (not set)'), () => ruler.snap.sym, v => ruler.snap.sym = v);
    sel2('Symmetry', SYM_MODES, () => ruler.symMode, v => { ruler.symMode = v; refreshProps(); symChanged(); });
    if (ruler.symMode === 'rot' || ruler.symMode === 'kaleido') slider(body, 'Segments', 2, 16, 1, ruler.symCount, v => v, v => ruler.symCount = v);
    const hint = document.createElement('p'); hint.className = 'muted small';
    hint.textContent = id === 'rl_line' ? 'Drag to draw a straight guide. Strokes that start near it follow it.' : id === 'rl_persp' ? 'Click to place the vanishing points (1, 2 or 3, below).' : id === 'rl_sym' ? 'Drag an axis (click = vertical). Everything you draw is mirrored.' : 'Drag a box to set an ellipse / circle (Shift = circle). Strokes near it follow the curve.';
    body.appendChild(hint);
    const b = document.createElement('button'); b.textContent = 'Clear all rulers'; b.onclick = CMD.rulerClear; body.appendChild(b);
    return;
  }
  grp(body, def.balloon ? 'Balloon' : 'Frame');
  slider(body, 'Line width', 1, 40, 1, pro.lw, v => v + 'px', v => pro.lw = v);
  if (id === 'fr_cut') slider(body, 'Gutter', 2, 120, 1, pro.gutter, v => v + 'px', v => pro.gutter = v);
  if (id === 'fr_rect') chk('Fill with secondary colour', () => pro.fill, v => pro.fill = v);
  if (def.balloon) {
    chk('Fill with secondary colour', () => pro.fill, v => pro.fill = v);
    if (id !== 'bl_thought' || true) chk('Tail', () => pro.tail, v => pro.tail = v);
    slider(body, 'Tail direction', 0, 359, 1, pro.tailAng, v => v + '°', v => pro.tailAng = v);
    slider(body, 'Tail length', 10, 100, 1, pro.tailLen * 100, v => v + '%', v => pro.tailLen = v / 100);
    const p = document.createElement('p'); p.className = 'muted small'; p.textContent = 'Drag a box on the canvas. Outline = main colour, inside = secondary colour. Use the Text tool for the lettering.'; body.appendChild(p);
  } else if (id === 'fr_cut') { const p = document.createElement('p'); p.className = 'muted small'; p.textContent = 'Drag a line across a panel to split it with a gutter.'; body.appendChild(p); }
}
