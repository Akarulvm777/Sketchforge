/* ---------- curve ruler and concentric ruler (3.6) ----------
   Ruler group, two more rulers (like Clip Studio's):
   - Curve ruler (rl_curve): draw the guide curve with the mouse / pen; it is smoothed and kept (ruler.curve =
     { pts }). A stroke that starts near it slides along it (the nearest point of the curve).
   - Concentric ruler (rl_conc): drag a box = the centre and the shape of the circles / ellipses (ruler.conc =
     { cx, cy, rx, ry }). Every stroke goes round the centre on the ellipse through its first point (any size), so
     rings, eyes, tree rings and planets are easy.
   Both hook rulerStart / rulerApply / drawRulers / proProps like p10rb_persp, and are cleared by Clear rulers. */
/* pure: a smooth, evenly spaced copy of a freehand path (moving average then resampling every `step`) */
function curveSmooth(pts, step = 6, win = 4) {
  if (pts.length < 2) return pts.slice();
  const sm = pts.map((p, i) => { let x = 0, y = 0, n = 0; for (let k = Math.max(0, i - win); k <= Math.min(pts.length - 1, i + win); k++) { x += pts[k][0]; y += pts[k][1]; n++; } return [x / n, y / n]; });
  sm[0] = pts[0].slice(); sm[sm.length - 1] = pts[pts.length - 1].slice();
  const out = [sm[0]]; let carry = 0;
  for (let i = 1; i < sm.length; i++) {
    const [x0, y0] = sm[i - 1], [x1, y1] = sm[i], L = Math.hypot(x1 - x0, y1 - y0); let t = step - carry;
    while (t <= L) { out.push([x0 + (x1 - x0) * t / L, y0 + (y1 - y0) * t / L]); t += step; }
    carry = L - (t - step);
  }
  const last = sm[sm.length - 1]; if (Math.hypot(last[0] - out[out.length - 1][0], last[1] - out[out.length - 1][1]) > 0.5) out.push(last);
  return out;
}
/* pure: the nearest point of a polyline, and its distance */
function curveNearest(pts, x, y) {
  let best = { x: pts[0][0], y: pts[0][1], d: Infinity };
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / L2, 0, 1), px = ax + dx * t, py = ay + dy * t, d = Math.hypot(x - px, y - py);
    if (d < best.d) best = { x: px, y: py, d };
  }
  return best;
}
/* pure: the point of the concentric ellipse family (centre, shape rx:ry) through p0, nearest to p */
function concApply(c, k, x, y) {
  const a = Math.atan2((y - c.cy) / c.ry, (x - c.cx) / c.rx);
  return { x: c.cx + c.rx * k * Math.cos(a), y: c.cy + c.ry * k * Math.sin(a) };
}
const concScale = (c, x, y) => Math.hypot((x - c.cx) / c.rx, (y - c.cy) / c.ry);
function installRulers2() {
  if (ruler.snap.curve == null) ruler.snap.curve = true;
  if (ruler.snap.conc == null) ruler.snap.conc = true;
  const mk = (id, name, extra) => { TOOLDEF[id] = { name, kind: 'dragdraw', icon: 'ruler', ...extra }; if (!settings[id]) settings[id] = {}; };
  mk('rl_curve', 'Curve ruler', {
    ddDown(o) { o.path = [[o.x0, o.y0]]; },
    ddMove(o) { o.path.push([o.x1, o.y1]); },
    ddEnd(o) { if (o.path && o.path.length > 3) { ruler.curve = { pts: curveSmooth(o.path, Math.max(2, 6 / view.scale)) }; ruler.snap.curve = true; } refreshProps(); },
    ddPreview: (g, S, o) => { if (!o.path) return; g.beginPath(); o.path.forEach(([x, y], i) => { const s = S(x, y); i ? g.lineTo(s[0], s[1]) : g.moveTo(s[0], s[1]); }); g.stroke(); }
  });
  mk('rl_conc', 'Concentric ruler', {
    ddEnd(o) { const b = ddBox(o); if (b.w > 3 && b.h > 3) { ruler.conc = { cx: b.x + b.w / 2, cy: b.y + b.h / 2, rx: b.w / 2, ry: b.h / 2 }; ruler.snap.conc = true; } refreshProps(); },
    ddPreview: (g, S, o) => { const b = ddBox(o), c = S(b.x + b.w / 2, b.y + b.h / 2), m = vmat(); g.save(); g.translate(c[0], c[1]); g.transform(m.a, m.b, m.c, m.d, 0, 0); for (const k of [0.5, 1]) { g.beginPath(); g.ellipse(0, 0, b.w / 2 * k, b.h / 2 * k, 0, 0, 7); g.stroke(); } g.restore(); }
  });
  const G = GROUPS.find(g => g.id === 'ruler'); if (G) for (const id of ['rl_curve', 'rl_conc']) if (!G.subs.includes(id)) G.subs.push(id);
  const rs0 = rulerStart; rulerStart = function (d) {
    const lock = rs0.apply(this, arguments), R = RL_HIT / view.scale;
    if (ruler.curve && ruler.snap.curve) { const n = curveNearest(ruler.curve.pts, d.x, d.y); if (n.d < R && (!lock || lock.type === 'pmulti' || lock.type === 'persp')) return { type: 'curve' }; }
    if (lock) return lock;
    if (ruler.conc && ruler.snap.conc) { const k = concScale(ruler.conc, d.x, d.y); if (k > 0.02) return { type: 'conc', k }; }
    return null;
  };
  const ra0 = rulerApply; rulerApply = function (lock, d) {
    if (lock && lock.type === 'curve' && ruler.curve) { const n = curveNearest(ruler.curve.pts, d.x, d.y); return { x: n.x, y: n.y }; }
    if (lock && lock.type === 'conc' && ruler.conc) return concApply(ruler.conc, lock.k, d.x, d.y);
    return ra0.apply(this, arguments);
  };
  const dr0 = drawRulers; drawRulers = function (g, S) {
    dr0.apply(this, arguments);
    if (!ruler.show) return;
    g.save(); g.lineWidth = 1.5; g.setLineDash([]);
    if (ruler.curve) { g.strokeStyle = ruler.snap.curve ? '#ff9f2f' : '#8a7458'; g.beginPath(); ruler.curve.pts.forEach(([x, y], i) => { const s = S(x, y); i ? g.lineTo(s[0], s[1]) : g.moveTo(s[0], s[1]); }); g.stroke(); }
    if (ruler.conc) {
      const c = ruler.conc, s = S(c.cx, c.cy), m = vmat();
      g.save(); g.translate(s[0], s[1]); g.transform(m.a, m.b, m.c, m.d, 0, 0); g.strokeStyle = ruler.snap.conc ? 'rgba(180,120,255,.7)' : 'rgba(130,110,150,.45)';
      for (let k = 1; k <= 6; k++) { g.beginPath(); g.ellipse(0, 0, c.rx * k / 3, c.ry * k / 3, 0, 0, 7); g.stroke(); }
      g.restore(); g.fillStyle = '#b478ff'; g.beginPath(); g.arc(s[0], s[1], 4, 0, 7); g.fill();
    }
    g.restore();
  };
  const pp0 = proProps; proProps = function (body, id) {
    const out = pp0.apply(this, arguments);
    if (!id.startsWith('rl_')) return out;
    const btn = body.querySelector('button'), chk = (label, k, set) => { const l = document.createElement('label'); l.className = 'check'; const i = document.createElement('input'); i.type = 'checkbox'; i.checked = ruler.snap[k]; i.onchange = () => { ruler.snap[k] = i.checked; drawOverlay(); }; l.append(i, ' ' + label + (set ? '' : ' (not set)')); btn ? body.insertBefore(l, btn) : body.appendChild(l); };
    chk('Curve ruler', 'curve', !!ruler.curve); chk('Concentric ruler', 'conc', !!ruler.conc);
    if (id === 'rl_curve' || id === 'rl_conc') { const h = body.querySelector('p.muted.small'); if (h) h.textContent = id === 'rl_curve' ? 'Draw the guide curve. Strokes that start near it slide along it.' : 'Drag a box: the centre and the shape. Every stroke then goes round that centre (circles or ellipses of any size).'; }
    return out;
  };
  const rc0 = CMD.rulerClear; CMD.rulerClear = () => { ruler.curve = ruler.conc = null; rc0(); };
  if (typeof TOOL_TIPS === 'object') Object.assign(TOOL_TIPS, { rl_curve: 'Draw a guide curve; strokes that start near it follow it.', rl_conc: 'Drag a box for the centre: strokes go round it in circles or ellipses.' });
}
