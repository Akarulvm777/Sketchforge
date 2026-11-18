/* ---------- Effects + live preview ----------
   effectDialog(title, fields, fn) shows the result on the canvas while the sliders move (Preview box), OK keeps it
   (one undo step, inside the selection if there is one), Cancel puts the layer back. All filters use it.
   New effects (Filter menu): glow, drop shadow, outline, bloom, emboss, extract line art, vignette, chromatic
   aberration, glitch, halftone dots, oil paint, twirl, wave, pinch, grayscale, sepia.                             */
function fxFields(fields) {
  return fields.map(f => {
    if (f.type === 'select') return `<label>${f.label}<select data-k="${f.k}" style="grid-column:2/4">${f.options.map(o => `<option value="${o[0]}"${o[0] == f.val ? ' selected' : ''}>${o[1]}</option>`).join('')}</select></label>`;
    if (f.type === 'color') return `<label>${f.label}<input type="color" data-k="${f.k}" value="${f.val}" style="grid-column:2/4;width:60px"></label>`;
    if (f.type === 'check') return `<label>${f.label}<input type="checkbox" data-k="${f.k}"${f.val ? ' checked' : ''} style="grid-column:2/4;justify-self:start"></label>`;
    return `<label>${f.label}<input type="range" data-k="${f.k}" min="${f.min}" max="${f.max}" step="${f.step || 1}" value="${f.val}"><output>${f.val}</output></label>`;
  }).join('');
}
/* write a filter result into the cel (only inside the selection, if any) */
function fxPut(t, orig, out) {
  const g = t.ctx;
  g.save(); g.globalCompositeOperation = 'copy'; g.drawImage(orig, 0, 0); g.restore();
  if (sel.active) {
    const o = makeCanvas(state.w, state.h), og = o.getContext('2d');
    og.drawImage(out, 0, 0); og.globalCompositeOperation = 'destination-in'; og.drawImage(sel.mask, 0, 0);
    g.save(); g.globalCompositeOperation = 'destination-out'; g.drawImage(sel.mask, 0, 0); g.restore();
    g.drawImage(o, 0, 0);
  } else { g.save(); g.globalCompositeOperation = 'copy'; g.drawImage(out, 0, 0); g.restore(); }
  t.cel._bb = undefined;
}
const fxCopy = c => { const o = makeCanvas(c.width, c.height); o.getContext('2d').drawImage(c, 0, 0); return o; };
function effectDialog(title, fields, fn) {
  const layer = canPaint(); if (!layer) return;
  if (!fields.length) { runFilter(s => fn(s, {})); return; }
  const t = acquireCel(layer), orig = fxCopy(t.cel);
  const d = document.createElement('dialog'); d.className = 'csdlg fxdlg';
  d.innerHTML = `<form method="dialog"><h5>${title}</h5>${fxFields(fields)}
    <label class="fxprev">Preview<input type="checkbox" data-prev checked style="grid-column:2/4;justify-self:start"></label>
    <div class="row"><button value="cancel">Cancel</button><button value="ok" class="primary">OK</button></div></form>`;
  document.body.appendChild(d);
  const params = () => { const p = {}; d.querySelectorAll('[data-k]').forEach(r => { p[r.dataset.k] = r.type === 'checkbox' ? r.checked : (r.type === 'range' ? +r.value : r.value); }); return p; };
  let timer = 0, shown = false;
  const render = () => {
    if (d.querySelector('[data-prev]').checked) { fxPut(t, orig, fn(fxCopy(orig), params())); shown = true; }
    else if (shown) { fxPut(t, orig, orig); shown = false; }
    refreshStage();
  };
  const soon = () => { clearTimeout(timer); timer = setTimeout(render, state.w * state.h > 4e6 ? 220 : 90); };
  d.querySelectorAll('input,select').forEach(r => { r.addEventListener('input', () => { if (r.type === 'range') r.nextElementSibling.textContent = r.value; soon(); }); r.addEventListener('change', soon); });
  d.addEventListener('close', () => {
    clearTimeout(timer);
    if (d.returnValue === 'ok') {
      fxPut(t, orig, fn(fxCopy(orig), params()));
      t.cel._ink = true; t.cel._sv = (t.cel._sv || 0) + 1;
      const b = { x: 0, y: 0, w: state.w, h: state.h };
      pushHistory(celEntry(t, b, crop(orig, b), crop(t.cel, b)));
      afterEdit();
    } else {
      fxPut(t, orig, orig); t.cel._sv = (t.cel._sv || 0) + 1;
      releaseCel(t); refreshStage();
    }
    d.remove();
  });
  d.showModal();
  render();
}

/* ---------- helpers ---------- */
const fxRGB = h => { const n = parseInt(String(h).slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
function fxSilhouette(src, color) { // the drawing's shape filled with one colour
  const c = makeCanvas(src.width, src.height), g = c.getContext('2d');
  g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  return c;
}
function fxBehind(src, layer, alpha) { // put `layer` behind the drawing
  const g = src.getContext('2d'); g.save(); g.globalCompositeOperation = 'destination-over'; g.globalAlpha = alpha == null ? 1 : alpha; g.drawImage(layer, 0, 0); g.restore();
  return src;
}
function fxSample(d, w, h, x, y) { // bilinear, clamped
  x = clamp(x, 0, w - 1.001); y = clamp(y, 0, h - 1.001);
  const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = (y0 * w + x0) * 4, j = i + w * 4, out = [0, 0, 0, 0];
  for (let k = 0; k < 4; k++) out[k] = (d[i + k] * (1 - fx) + d[i + 4 + k] * fx) * (1 - fy) + (d[j + k] * (1 - fx) + d[j + 4 + k] * fx) * fy;
  return out;
}
function fxWarp(src, map) { // inverse mapping: map(x, y) -> source point
  const w = src.width, h = src.height, g = src.getContext('2d'), sd = g.getImageData(0, 0, w, h).data, out = g.createImageData(w, h), od = out.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const q = map(x, y); if (!q) { const i = (y * w + x) * 4; od[i] = sd[i]; od[i + 1] = sd[i + 1]; od[i + 2] = sd[i + 2]; od[i + 3] = sd[i + 3]; continue; }
    const s = fxSample(sd, w, h, q[0], q[1]), i = (y * w + x) * 4; od[i] = s[0]; od[i + 1] = s[1]; od[i + 2] = s[2]; od[i + 3] = s[3];
  }
  g.putImageData(out, 0, 0); return src;
}
const fxCenter = p => [state.w * (p.cx == null ? 50 : p.cx) / 100, state.h * (p.cy == null ? 50 : p.cy) / 100];

/* ---------- effects ---------- */
const FX = {
  glow(src, p) {
    const s = fxSilhouette(src, p.color); gaussianBlur(s, p.size / 2.5);
    for (let i = 0; i < Math.round(p.strength / 34) + 1; i++) fxBehind(src, s, Math.min(1, p.strength / 100 * 1.4));
    return src;
  },
  shadow(src, p) {
    const s = fxSilhouette(src, p.color); if (p.blur) gaussianBlur(s, p.blur / 2);
    const o = makeCanvas(src.width, src.height), og = o.getContext('2d'), a = p.angle * DEG;
    og.drawImage(s, Math.cos(a) * p.dist, Math.sin(a) * p.dist);
    return fxBehind(src, o, p.opacity / 100);
  },
  outline(src, p) {
    const s = fxSilhouette(src, p.color), o = makeCanvas(src.width, src.height), og = o.getContext('2d'), n = Math.max(12, Math.round(p.width * 3));
    for (let r = p.width; r > 0; r -= Math.max(1, p.width / 3)) for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; og.drawImage(s, Math.cos(a) * r, Math.sin(a) * r); }
    if (p.where === 'only') { const g = src.getContext('2d'); g.save(); g.globalCompositeOperation = 'copy'; g.drawImage(o, 0, 0); g.globalCompositeOperation = 'destination-out'; g.drawImage(s, 0, 0); g.restore(); return src; }
    return fxBehind(src, o);
  },
  bloom(src, p) {
    const b = fxCopy(src);
    mapPixels(b, (d, i) => { const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2], k = clamp((l - p.threshold) / (255 - p.threshold + 1), 0, 1); d[i + 3] *= k; });
    gaussianBlur(b, p.size / 2);
    const g = src.getContext('2d'); g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = p.strength / 100; g.drawImage(b, 0, 0); g.restore();
    return src;
  },
  emboss(src, p) {
    const w = src.width, h = src.height, g = src.getContext('2d'), im = g.getImageData(0, 0, w, h), d = im.data, s = new Uint8ClampedArray(d);
    const a = p.angle * DEG, dx = Math.round(Math.cos(a) * p.depth), dy = Math.round(Math.sin(a) * p.depth), k = p.amount / 100;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; if (!s[i + 3]) continue;
      const x1 = clamp(x - dx, 0, w - 1), y1 = clamp(y - dy, 0, h - 1), x2 = clamp(x + dx, 0, w - 1), y2 = clamp(y + dy, 0, h - 1);
      const i1 = (y1 * w + x1) * 4, i2 = (y2 * w + x2) * 4;
      const l1 = (s[i1] + s[i1 + 1] + s[i1 + 2]) / 3 * s[i1 + 3] / 255, l2 = (s[i2] + s[i2 + 1] + s[i2 + 2]) / 3 * s[i2 + 3] / 255;
      const v = (l2 - l1) * 2;
      for (let c = 0; c < 3; c++) d[i + c] = p.mode === 'gray' ? 128 + v : s[i + c] + v * k;
    }
    g.putImageData(im, 0, 0); return src;
  },
  lineArt(src, p) { // Sobel edges -> dark lines on a transparent layer (trace a photo)
    const w = src.width, h = src.height, g = src.getContext('2d'), im = g.getImageData(0, 0, w, h), d = im.data;
    const L = new Float32Array(w * h);
    for (let i = 0, j = 0; j < L.length; i += 4, j++) { const a = d[i + 3] / 255; L[j] = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) * a + 255 * (1 - a); }
    if (p.smooth) { const c = makeCanvas(w, h), cg = c.getContext('2d'), ci = cg.createImageData(w, h); for (let j = 0; j < L.length; j++) { ci.data[j * 4] = ci.data[j * 4 + 1] = ci.data[j * 4 + 2] = L[j]; ci.data[j * 4 + 3] = 255; } cg.putImageData(ci, 0, 0); gaussianBlur(c, p.smooth / 2); const bd = cg.getImageData(0, 0, w, h).data; for (let j = 0; j < L.length; j++) L[j] = bd[j * 4]; }
    const [r, gg, b] = fxRGB(p.color), th = p.threshold;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const at = (xx, yy) => L[clamp(yy, 0, h - 1) * w + clamp(xx, 0, w - 1)];
      const gx = -at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1) + at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1);
      const gy = -at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1) + at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1);
      const m = Math.hypot(gx, gy) / 4, i = (y * w + x) * 4, a = clamp((m - th) / Math.max(1, (100 - th) * 0.6) * 255, 0, 255);
      d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = a;
    }
    g.putImageData(im, 0, 0); return src;
  },
  vignette(src, p) {
    const w = src.width, h = src.height, g = src.getContext('2d'), [cx, cy] = [w / 2, h / 2], R = Math.hypot(cx, cy);
    const gr = g.createRadialGradient(cx, cy, R * (1 - p.size / 100) * 0.9, cx, cy, R);
    const [r, gg, b] = fxRGB(p.color);
    gr.addColorStop(0, `rgba(${r},${gg},${b},0)`); gr.addColorStop(1, `rgba(${r},${gg},${b},${p.amount / 100})`);
    g.save(); g.globalCompositeOperation = 'source-atop'; g.fillStyle = gr; g.fillRect(0, 0, w, h); g.restore();
    return src;
  },
  chroma(src, p) {
    const w = src.width, h = src.height, g = src.getContext('2d'), im = g.getImageData(0, 0, w, h), d = im.data, s = new Uint8ClampedArray(d), k = p.amount;
    const [cx, cy] = [w / 2, h / 2];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let ox = k, oy = 0;
      if (p.mode === 'lens') { const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) / Math.hypot(cx, cy); ox = dx / Math.max(1, Math.hypot(dx, dy)) * k * l; oy = dy / Math.max(1, Math.hypot(dx, dy)) * k * l; }
      const r = fxSample(s, w, h, x - ox, y - oy), b = fxSample(s, w, h, x + ox, y + oy);
      d[i] = r[0]; d[i + 2] = b[2]; d[i + 3] = Math.max(s[i + 3], r[3], b[3]);
    }
    g.putImageData(im, 0, 0); return src;
  },
  glitch(src, p) {
    const w = src.width, h = src.height, o = makeCanvas(w, h), og = o.getContext('2d');
    let seed = p.seed * 9301 + 49297; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    let y = 0;
    while (y < h) {
      const sh = Math.max(2, Math.round(rnd() * h / (6 + p.slices))), off = rnd() < 0.5 ? (rnd() - 0.5) * 2 * p.shift / 100 * w : 0;
      og.drawImage(src, 0, y, w, sh, off, y, w, sh); y += sh;
    }
    const res = FX.chroma(o, { amount: p.split, mode: 'flat' });
    const g = src.getContext('2d'); g.save(); g.globalCompositeOperation = 'copy'; g.drawImage(res, 0, 0); g.restore();
    return src;
  },
  halftone(src, p) {
    const w = src.width, h = src.height, g = src.getContext('2d'), d = g.getImageData(0, 0, w, h).data, cell = p.size, a = p.angle * DEG;
    const o = makeCanvas(w, h), og = o.getContext('2d'); og.fillStyle = p.color;
    const ca = Math.cos(a), sa = Math.sin(a), R = Math.hypot(w, h);
    for (let v = -R; v < R; v += cell) for (let u = -R; u < R; u += cell) {
      const x = w / 2 + u * ca - v * sa, y = h / 2 + u * sa + v * ca;
      if (x < -cell || y < -cell || x > w + cell || y > h + cell) continue;
      const xi = clamp(Math.round(x), 0, w - 1), yi = clamp(Math.round(y), 0, h - 1), i = (yi * w + xi) * 4;
      const al = d[i + 3] / 255; if (al < 0.02) continue;
      const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255, dark = (1 - lum) * al;
      const r = Math.sqrt(dark) * cell * 0.72; if (r < 0.3) continue;
      og.beginPath(); og.arc(x, y, r, 0, Math.PI * 2); og.fill();
    }
    if (p.keep) { g.save(); g.globalAlpha = 0.35; g.globalCompositeOperation = 'source-atop'; g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.restore(); g.drawImage(o, 0, 0); }
    else { g.save(); g.globalCompositeOperation = 'copy'; g.drawImage(o, 0, 0); g.restore(); }
    return src;
  },
  oil(src, p) { // Kuwahara filter with summed-area tables: flat brushy patches, sharp edges
    const w = src.width, h = src.height, g = src.getContext('2d'), im = g.getImageData(0, 0, w, h), d = im.data, r = p.size, W1 = w + 1;
    const S = [0, 1, 2, 3].map(() => new Float64Array(W1 * (h + 1))), Q = new Float64Array(W1 * (h + 1));
    for (let y = 0; y < h; y++) { const rs = [0, 0, 0, 0]; let rq = 0;
      for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        for (let c = 0; c < 4; c++) { rs[c] += d[i + c]; S[c][(y + 1) * W1 + x + 1] = S[c][y * W1 + x + 1] + rs[c]; }
        rq += l * l; Q[(y + 1) * W1 + x + 1] = Q[y * W1 + x + 1] + rq; } }
    const box = (T, x0, y0, x1, y1) => T[y1 * W1 + x1] - T[y0 * W1 + x1] - T[y1 * W1 + x0] + T[y0 * W1 + x0];
    const out = new Uint8ClampedArray(d.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let best = Infinity, bi = 0; const R4 = [[x - r, y - r, x + 1, y + 1], [x, y - r, x + r + 1, y + 1], [x - r, y, x + 1, y + r + 1], [x, y, x + r + 1, y + r + 1]];
      for (let q = 0; q < 4; q++) {
        const [a0, b0, a1, b1] = R4[q], X0 = clamp(a0, 0, w), Y0 = clamp(b0, 0, h), X1 = clamp(a1, 0, w), Y1 = clamp(b1, 0, h), n = (X1 - X0) * (Y1 - Y0); if (n <= 0) continue;
        const m = (0.299 * box(S[0], X0, Y0, X1, Y1) + 0.587 * box(S[1], X0, Y0, X1, Y1) + 0.114 * box(S[2], X0, Y0, X1, Y1)) / n;
        const v = box(Q, X0, Y0, X1, Y1) / n - m * m; if (v < best) { best = v; bi = q; R4.best = [X0, Y0, X1, Y1, n]; }
      }
      const [X0, Y0, X1, Y1, n] = R4.best, i = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) out[i + c] = box(S[c], X0, Y0, X1, Y1) / n;
    }
    im.data.set(out); g.putImageData(im, 0, 0); return src;
  },
  twirl(src, p) {
    const [cx, cy] = fxCenter(p), R = Math.min(state.w, state.h) * p.radius / 100, A = p.angle * DEG;
    return fxWarp(src, (x, y) => { const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy); if (d >= R) return null; const t = (1 - d / R) ** 2 * A, c = Math.cos(t), s = Math.sin(t); return [cx + dx * c - dy * s, cy + dx * s + dy * c]; });
  },
  pinch(src, p) {
    const [cx, cy] = fxCenter(p), R = Math.min(state.w, state.h) * p.radius / 100, k = p.amount / 100;
    return fxWarp(src, (x, y) => { const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy); if (d >= R || d < 1e-6) return null; const f = Math.pow(d / R, k > 0 ? 1 - k * 0.7 : 1 - k * 1.5) * R / d; return [cx + dx * f, cy + dy * f]; });
  },
  wave(src, p) {
    const A = p.amp, L = Math.max(4, p.len);
    return fxWarp(src, (x, y) => p.dir === 'v' ? [x, y + Math.sin(x / L * Math.PI * 2) * A] : p.dir === 'ripple' ? (() => { const dx = x - state.w / 2, dy = y - state.h / 2, d = Math.hypot(dx, dy) || 1, o = Math.sin(d / L * Math.PI * 2) * A; return [x + dx / d * o, y + dy / d * o]; })() : [x + Math.sin(y / L * Math.PI * 2) * A, y]);
  },
  gray: src => mapPixels(src, (d, i) => { const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; d[i] = d[i + 1] = d[i + 2] = l; }),
  sepia: (src, p) => mapPixels(src, (d, i) => {
    const r = d[i], g = d[i + 1], b = d[i + 2], k = (p.amount == null ? 100 : p.amount) / 100;
    d[i] = r + (Math.min(255, r * 0.393 + g * 0.769 + b * 0.189) - r) * k; d[i + 1] = g + (Math.min(255, r * 0.349 + g * 0.686 + b * 0.168) - g) * k; d[i + 2] = b + (Math.min(255, r * 0.272 + g * 0.534 + b * 0.131) - b) * k;
  })
};

function installEffects() {
  const E = (title, fields, fn) => () => effectDialog(title, fields, fn);
  const C = () => state.color;
  Object.assign(CMD, {
    fxGlow: () => effectDialog('Glow', [{ k: 'color', label: 'Colour', type: 'color', val: '#ffe680' }, { k: 'size', label: 'Size', min: 2, max: 120, val: 24 }, { k: 'strength', label: 'Strength', min: 10, max: 100, val: 70 }], FX.glow),
    fxShadow: () => effectDialog('Drop shadow', [{ k: 'color', label: 'Colour', type: 'color', val: '#000000' }, { k: 'dist', label: 'Distance', min: 0, max: 150, val: 14 }, { k: 'angle', label: 'Angle', min: 0, max: 359, val: 45 }, { k: 'blur', label: 'Softness', min: 0, max: 80, val: 10 }, { k: 'opacity', label: 'Opacity', min: 5, max: 100, val: 60 }], FX.shadow),
    fxOutline: () => effectDialog('Outline (border)', [{ k: 'color', label: 'Colour', type: 'color', val: C() === '#ffffff' ? '#000000' : '#ffffff' }, { k: 'width', label: 'Width', min: 1, max: 60, val: 6 }, { k: 'where', label: 'Keep', type: 'select', val: 'both', options: [['both', 'Drawing + outline'], ['only', 'Only the outline']] }], FX.outline),
    fxBloom: E('Bloom (soft light)', [{ k: 'threshold', label: 'Bright from', min: 0, max: 250, val: 150 }, { k: 'size', label: 'Size', min: 2, max: 120, val: 30 }, { k: 'strength', label: 'Strength', min: 5, max: 100, val: 60 }], FX.bloom),
    fxEmboss: E('Emboss', [{ k: 'mode', label: 'Look', type: 'select', val: 'color', options: [['color', 'Keep colours'], ['gray', 'Grey relief']] }, { k: 'depth', label: 'Depth', min: 1, max: 10, val: 2 }, { k: 'angle', label: 'Light angle', min: 0, max: 359, val: 135 }, { k: 'amount', label: 'Amount', min: 10, max: 300, val: 100 }], FX.emboss),
    fxLineArt: E('Extract line art (trace a photo)', [{ k: 'threshold', label: 'Detail (lower = more lines)', min: 2, max: 90, val: 18 }, { k: 'smooth', label: 'Ignore texture', min: 0, max: 10, val: 2 }, { k: 'color', label: 'Line colour', type: 'color', val: '#000000' }], FX.lineArt),
    fxVignette: E('Vignette', [{ k: 'amount', label: 'Darkness', min: 5, max: 100, val: 55 }, { k: 'size', label: 'Size', min: 5, max: 100, val: 45 }, { k: 'color', label: 'Colour', type: 'color', val: '#000000' }], FX.vignette),
    fxChroma: E('Chromatic aberration', [{ k: 'mode', label: 'Type', type: 'select', val: 'lens', options: [['lens', 'Lens (edges)'], ['flat', 'Shift sideways']] }, { k: 'amount', label: 'Amount', min: 1, max: 40, val: 6 }], FX.chroma),
    fxGlitch: E('Glitch', [{ k: 'slices', label: 'Slices', min: 2, max: 60, val: 18 }, { k: 'shift', label: 'Shift', min: 0, max: 40, val: 8 }, { k: 'split', label: 'Colour split', min: 0, max: 30, val: 6 }, { k: 'seed', label: 'Variation', min: 1, max: 99, val: 7 }], FX.glitch),
    fxHalftone: E('Halftone dots', [{ k: 'size', label: 'Dot spacing', min: 3, max: 40, val: 8 }, { k: 'angle', label: 'Angle', min: 0, max: 90, val: 45 }, { k: 'color', label: 'Dot colour', type: 'color', val: '#000000' }, { k: 'keep', label: 'Keep colours under the dots', type: 'check', val: false }], FX.halftone),
    fxOil: E('Oil paint', [{ k: 'size', label: 'Brush size', min: 1, max: 14, val: 4 }], FX.oil),
    fxTwirl: E('Twirl', [{ k: 'angle', label: 'Angle', min: -720, max: 720, val: 180 }, { k: 'radius', label: 'Radius', min: 5, max: 100, val: 45 }, { k: 'cx', label: 'Centre X %', min: 0, max: 100, val: 50 }, { k: 'cy', label: 'Centre Y %', min: 0, max: 100, val: 50 }], FX.twirl),
    fxPinch: E('Pinch / bulge', [{ k: 'amount', label: 'Pinch ↔ Bulge', min: -100, max: 100, val: 50 }, { k: 'radius', label: 'Radius', min: 5, max: 100, val: 40 }, { k: 'cx', label: 'Centre X %', min: 0, max: 100, val: 50 }, { k: 'cy', label: 'Centre Y %', min: 0, max: 100, val: 50 }], FX.pinch),
    fxWave: E('Wave / ripple', [{ k: 'dir', label: 'Type', type: 'select', val: 'h', options: [['h', 'Wave sideways'], ['v', 'Wave up and down'], ['ripple', 'Ripple (rings)']] }, { k: 'amp', label: 'Height', min: 1, max: 80, val: 10 }, { k: 'len', label: 'Wave length', min: 4, max: 400, val: 60 }], FX.wave),
    fxGray: () => runFilter(FX.gray),
    fxSepia: E('Sepia', [{ k: 'amount', label: 'Amount', min: 5, max: 100, val: 100 }], FX.sepia)
  });
  const F = MENUS.find(m => m[0] === 'Filter')[1];
  F.push('-', ['✨ Glow…', 'fxGlow'], ['Drop shadow…', 'fxShadow'], ['Outline (border)…', 'fxOutline'], ['Bloom (soft light)…', 'fxBloom'],
    '-', ['Extract line art (trace a photo)…', 'fxLineArt'], ['Emboss…', 'fxEmboss'], ['Halftone dots…', 'fxHalftone'], ['Oil paint…', 'fxOil'],
    '-', ['Vignette…', 'fxVignette'], ['Chromatic aberration…', 'fxChroma'], ['Glitch…', 'fxGlitch'],
    '-', ['Twirl…', 'fxTwirl'], ['Pinch / bulge…', 'fxPinch'], ['Wave / ripple…', 'fxWave'],
    '-', ['Grayscale', 'fxGray'], ['Sepia…', 'fxSepia']);
}
