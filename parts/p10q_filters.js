/* ---------- more filters: tone curve, colour balance, gradient map, radial blur, Liquify ---------- */
function hexRGB(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function curveLUT(pts) { /* monotone cubic through pts [[x,y]...], returns 256 LUT */
  const n = pts.length, xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), dx = [], m = [], t = new Array(n);
  for (let i = 0; i < n - 1; i++) { dx[i] = xs[i + 1] - xs[i]; m[i] = (ys[i + 1] - ys[i]) / dx[i]; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) { if (m[i] === 0) { t[i] = t[i + 1] = 0; continue; } const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b; if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; } }
  const lut = new Uint8ClampedArray(256);
  for (let x = 0; x < 256; x++) {
    let i = 0; while (i < n - 2 && x > xs[i + 1]) i++;
    const h = dx[i], u = (x - xs[i]) / h, u2 = u * u, u3 = u2 * u;
    lut[x] = (2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * h * t[i] + (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * h * t[i + 1];
  }
  return lut;
}
function perPixel(src, fn) {
  const g = src.getContext('2d'), im = g.getImageData(0, 0, src.width, src.height), d = im.data;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3]) fn(d, i);
  g.putImageData(im, 0, 0); return src;
}
function toneCurve(src, p) {
  const id = [[0, 0], [64, 64 + p.sh * 0.7], [128, 128 + p.mid * 0.7], [192, 192 + p.hi * 0.7], [255, 255]].map(q => [q[0], Math.max(0, Math.min(255, q[1]))]);
  id[1][1] = Math.min(id[1][1], id[2][1] - 1); id[3][1] = Math.max(id[3][1], id[2][1] + 1);
  const L = curveLUT(id), c = p.ch;
  return perPixel(src, (d, i) => { if (c === 'rgb' || c === 'r') d[i] = L[d[i]]; if (c === 'rgb' || c === 'g') d[i + 1] = L[d[i + 1]]; if (c === 'rgb' || c === 'b') d[i + 2] = L[d[i + 2]]; });
}
function colorBalance(src, p) {
  return perPixel(src, (d, i) => {
    const l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
    const w = p.range === 'sh' ? (1 - l) * (1 - l) : p.range === 'hi' ? l * l : 4 * l * (1 - l);
    d[i] = Math.max(0, Math.min(255, d[i] + p.cr * w * 0.7)); d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + p.mg * w * 0.7)); d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + p.yb * w * 0.7));
  });
}
function gradientMap(src, p) {
  const a = hexRGB(p.c0), b = hexRGB(p.c1), m = hexRGB(p.cm), mid = p.useMid;
  return perPixel(src, (d, i) => {
    const l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
    let c;
    if (mid) c = l < 0.5 ? [0, 1, 2].map(k => a[k] + (m[k] - a[k]) * l * 2) : [0, 1, 2].map(k => m[k] + (b[k] - m[k]) * (l - 0.5) * 2);
    else c = [0, 1, 2].map(k => a[k] + (b[k] - a[k]) * l);
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
  });
}
function radialBlur(src, p) {
  const w = src.width, h = src.height, R = regionOf(), cx = R.x + R.w / 2, cy = R.y + R.h / 2;
  const out = makeCanvas(w, h), g = out.getContext('2d'), K = 18;
  for (let i = 0; i < K; i++) {
    const t = (i / (K - 1) - 0.5);
    g.save(); g.globalAlpha = 1 / (i + 1); g.translate(cx, cy);
    if (p.mode === 'spin') g.rotate(t * p.amount * Math.PI / 180); else { const s = 1 + t * p.amount / 100; g.scale(s, s); }
    g.translate(-cx, -cy); g.drawImage(src, 0, 0); g.restore();
  }
  return out;
}
/* ---- Liquify (live brush on the cel) ---- */
const liq = { size: 140, strength: 60, mode: 'push' };
function liqWarp(cel, x, y, dx, dy) {
  const R = liq.size / 2, x0 = Math.max(0, Math.floor(x - R)), y0 = Math.max(0, Math.floor(y - R)), x1 = Math.min(cel.width, Math.ceil(x + R)), y1 = Math.min(cel.height, Math.ceil(y + R));
  const w = x1 - x0, h = y1 - y0; if (w < 2 || h < 2) return;
  const g = cel.getContext('2d'), src = g.getImageData(x0, y0, w, h), out = g.createImageData(w, h), S = src.data, O = out.data, k = liq.strength / 100;
  const smp = (fx, fy, o) => {
    fx = Math.max(0, Math.min(w - 1.001, fx)); fy = Math.max(0, Math.min(h - 1.001, fy));
    const ix = fx | 0, iy = fy | 0, ux = fx - ix, uy = fy - iy;
    let r = 0, gg = 0, b = 0, a = 0;
    for (const [ox, oy, wt] of [[0, 0, (1 - ux) * (1 - uy)], [1, 0, ux * (1 - uy)], [0, 1, (1 - ux) * uy], [1, 1, ux * uy]]) {
      const j = ((iy + oy) * w + ix + ox) * 4, al = S[j + 3] * wt; r += S[j] * al; gg += S[j + 1] * al; b += S[j + 2] * al; a += al;
    }
    if (a > 0) { O[o] = r / a; O[o + 1] = gg / a; O[o + 2] = b / a; O[o + 3] = a; }
  };
  const cx = x - x0, cy = y - y0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const ddx = i - cx, ddy = j - cy, d = Math.hypot(ddx, ddy) / R, o = (j * w + i) * 4;
    if (d >= 1) { O[o] = S[o]; O[o + 1] = S[o + 1]; O[o + 2] = S[o + 2]; O[o + 3] = S[o + 3]; continue; }
    const wt = (1 - d * d) * (1 - d * d) * k;
    let sx = i, sy = j;
    if (liq.mode === 'push') { sx = i - dx * wt * 1.4; sy = j - dy * wt * 1.4; }
    else if (liq.mode === 'pinch') { sx = i + ddx * wt * 0.35; sy = j + ddy * wt * 0.35; }
    else if (liq.mode === 'bloat') { sx = i - ddx * wt * 0.35; sy = j - ddy * wt * 0.35; }
    else { const a = wt * 0.18, c = Math.cos(a), s = Math.sin(a); sx = cx + ddx * c - ddy * s; sy = cy + ddx * s + ddy * c; }
    smp(sx, sy, o);
  }
  g.putImageData(out, x0, y0);
}
function installFilters() {
  Object.assign(IC, { liquify: '<path d="M3 15c3-5 6 3 9-2s6 3 9-3"/><path d="M3 20c3-5 6 3 9-2s6 3 9-3"/>' });
  TOOLDEF.liquify = { name: 'Liquify', kind: 'dragdraw', icon: 'liquify',
    ddDown(o) {
      const layer = canPaint(); if (!layer) { dd = null; active = null; return; }
      const t = acquireCel(layer), snap = makeCanvas(state.w, state.h); snap.getContext('2d').drawImage(t.cel, 0, 0);
      o.t = t; o.snap = snap; o.box = newBox();
    },
    ddMove(o) {
      if (!o.t) return;
      const dx = o.x1 - o.px, dy = o.y1 - o.py, dist = Math.hypot(dx, dy), step = Math.max(2, liq.size / 8), n = Math.max(1, Math.ceil(dist / step));
      for (let i = 1; i <= n; i++) {
        const x = o.px + dx * i / n, y = o.py + dy * i / n;
        liqWarp(o.t.cel, x, y, dx / n, dy / n);
        const r = liq.size / 2 + 2; o.box.x0 = Math.min(o.box.x0, x - r); o.box.y0 = Math.min(o.box.y0, y - r); o.box.x1 = Math.max(o.box.x1, x + r); o.box.y1 = Math.max(o.box.y1, y + r);
      }
      o.t.cel._ink = true; refreshStage();
    },
    ddEnd(o) {
      if (!o.t) return;
      const b = clampBox(o.box.x0, o.box.y0, o.box.x1, o.box.y1);
      if (!b) { releaseCel(o.t); return; }
      pushHistory(celEntry(o.t, b, crop(o.snap, b), crop(o.t.cel, b)));
      afterEdit();
    },
    ddPreview(g, S, o) { const c = S(o.x1, o.y1); g.beginPath(); g.arc(c[0], c[1], liq.size / 2 * view.scale, 0, 7); g.stroke(); }
  };
  GROUPS.splice(GROUPS.findIndex(g => g.id === 'blend') + 1, 0, { id: 'liquify', name: 'Liquify', key: '', icon: 'liquify', subs: ['liquify'] });
  Object.assign(CMD, {
    fCurve: () => effectDialog('Tone curve', [{ k: 'ch', label: 'Channel', type: 'select', val: 'rgb', options: [['rgb', 'RGB'], ['r', 'Red'], ['g', 'Green'], ['b', 'Blue']] },
      { k: 'sh', label: 'Shadows', min: -100, max: 100, val: 0 }, { k: 'mid', label: 'Midtones', min: -100, max: 100, val: 0 }, { k: 'hi', label: 'Highlights', min: -100, max: 100, val: 0 }], (s, p) => (toneCurve(s, p))),
    fBalance: () => effectDialog('Colour balance', [{ k: 'range', label: 'Tones', type: 'select', val: 'mid', options: [['sh', 'Shadows'], ['mid', 'Midtones'], ['hi', 'Highlights']] },
      { k: 'cr', label: 'Cyan ↔ Red', min: -100, max: 100, val: 0 }, { k: 'mg', label: 'Magenta ↔ Green', min: -100, max: 100, val: 0 }, { k: 'yb', label: 'Yellow ↔ Blue', min: -100, max: 100, val: 0 }], (s, p) => (colorBalance(s, p))),
    fGradMap: () => effectDialog('Gradient map', [{ k: 'c0', label: 'Shadows', type: 'color', val: state.color }, { k: 'useMid', label: 'Middle colour', type: 'check', val: false },
      { k: 'cm', label: 'Middle', type: 'color', val: '#c0507a' }, { k: 'c1', label: 'Highlights', type: 'color', val: state.color2 || '#ffffff' }], (s, p) => (gradientMap(s, p))),
    fRadial: () => effectDialog('Radial blur', [{ k: 'mode', label: 'Type', type: 'select', val: 'zoom', options: [['zoom', 'Zoom'], ['spin', 'Spin']] }, { k: 'amount', label: 'Amount', min: 1, max: 60, val: 12 }], (s, p) => (radialBlur(s, p))),
    fInvert: () => runFilter(s => perPixel(s, (d, i) => { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; })),
    fPoster: () => effectDialog('Posterize', [{ k: 'n', label: 'Levels', min: 2, max: 16, val: 4 }], (s, p) => (perPixel(s, (d, i) => { const q = 255 / (p.n - 1); d[i] = Math.round(d[i] / q) * q; d[i + 1] = Math.round(d[i + 1] / q) * q; d[i + 2] = Math.round(d[i + 2] / q) * q; }))),
    fThreshold: () => effectDialog('Binarize (black & white)', [{ k: 't', label: 'Threshold', min: 1, max: 254, val: 128 }], (s, p) => (perPixel(s, (d, i) => { const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2], v = l < p.t ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = v; })))
  });
  const F = MENUS.find(m => m[0] === 'Filter')[1];
  F.push('-', ['Radial blur…', 'fRadial'], '-', ['Tone curve…', 'fCurve'], ['Colour balance…', 'fBalance'], ['Gradient map…', 'fGradMap'], '-', ['Invert colours', 'fInvert'], ['Posterize…', 'fPoster'], ['Binarize (B&W)…', 'fThreshold']);
}
function liqProps(body) {
  const l = document.createElement('label'); l.className = 'select'; l.innerHTML = '<span>Mode</span>';
  const s = document.createElement('select');
  [['push', 'Push'], ['pinch', 'Pinch'], ['bloat', 'Bloat'], ['twirl', 'Twirl']].forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; if (liq.mode === v) o.selected = true; s.appendChild(o); });
  s.onchange = () => liq.mode = s.value; l.appendChild(s); body.appendChild(l);
  slider(body, 'Size', 20, 500, 5, liq.size, v => v + 'px', v => liq.size = v);
  slider(body, 'Strength', 5, 100, 1, liq.strength, v => v + '%', v => liq.strength = v);
}
