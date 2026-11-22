/* ---------- Clip Studio-style features (original code) ----------
   Layer settings (clip to layer below, lock transparent pixels, reference / draft),
   Filter menu, Tonal correction, Select > expand / shrink / blur border.          */

function layerFlags(l) {
  const par = typeof layerParent === 'function' ? layerParent(l) : null;
  return (par ? '  ↳ ' + par.name : '') + (l.vref ? '  VIDEO' : '') + (l.clip ? '  clip' : '') + (l.alock ? '  α-lock' : '') + (l.ref ? '  REF' : '') + (l.draft ? '  draft' : '') + (l.mask ? (l.maskEdit ? '  MASK✎' : '  mask') : '');
}
function clipBaseOf(i) {
  for (let j = i - 1; j >= 0; j--) if (!state.layers[j].clip) return state.layers[j];
  return null;
}
function drawLayerOwn(g, l, fp) {
  g.save();
  { const m = layerMat(l, drawLayerOwn.frame ?? state.frame); if (m) g.transform(...m); }
  g.drawImage(fp.cel, 0, 0);
  g.restore();
  if (l.mask) {
    const mc = celCanvas(l.mask, state.frame === undefined ? 0 : (drawLayerOwn.frame ?? state.frame));
    if (mc) { g.save(); g.globalCompositeOperation = 'destination-out'; g.drawImage(mc, 0, 0); g.restore(); }
  }
}
function clipToBase(lc, base, f) {
  const g = lc.getContext('2d');
  const bf = frameParams(base, f);
  if (!bf) { g.clearRect(0, 0, state.w, state.h); return; }
  const bc = makeCanvas(state.w, state.h);
  drawLayerOwn.frame = f; drawLayerOwn(bc.getContext('2d'), base, bf); drawLayerOwn.frame = undefined;
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(bc, 0, 0);
  g.globalCompositeOperation = 'source-over';
}
/* A display canvas showing a clipped layer, masked by the layer it clips to. */
function clipViewFor(l, i) {
  if (!l.clip && !l.mask) return null;
  const base = l.clip ? clipBaseOf(i) : null;
  if (!base && !l.mask) return null;
  const fp = frameParams(l, state.frame);
  if (!fp) return null;
  let cv = l._cv;
  if (!cv || cv.width !== state.w || cv.height !== state.h) cv = l._cv = makeCanvas(state.w, state.h);
  const g = cv.getContext('2d');
  g.clearRect(0, 0, state.w, state.h);
  drawLayerOwn(g, l, fp);
  if (base) clipToBase(cv, base, state.frame);
  const s = cv.style;
  s.display = l.visible ? 'block' : 'none';
  s.opacity = String(l.opacity * fp.p.alpha * (l.draft ? 0.45 : 1));
  s.mixBlendMode = cssBlend(l.blend);
  s.transform = 'none';
  s.zIndex = 10 + i * 2;
  return cv;
}
function updateClipViews() {
  if (state.layers.some(l => l.clip || l.mask)) refreshStage();
  else if (typeof refreshCustomBlends === 'function') refreshCustomBlends(); // layers with linear burn, add… show the new pixels
}
function toggleLayerFlag(flag, label) {
  const l = activeLayer();
  if (!l) return;
  if (flag === 'clip' && !l.clip && state.layers.indexOf(l) === 0) { toast('Nothing below to clip to'); return; }
  timelineOp(() => { l[flag] = !l[flag]; });
  toast(label + (l[flag] ? ' on' : ' off'));
}

/* ---------- small parameter dialog ---------- */
function paramDialog(title, fields, ok) {
  const d = document.createElement('dialog');
  d.className = 'csdlg';
  const rows = fields.map(f => `<label>${f.label}<input type="range" data-k="${f.k}" min="${f.min}" max="${f.max}" step="${f.step || 1}" value="${f.val}"><output>${f.val}</output></label>`).join('');
  d.innerHTML = `<form method="dialog"><h5>${title}</h5>${rows}<div class="row"><button value="cancel">Cancel</button><button value="ok" class="primary">OK</button></div></form>`;
  document.body.appendChild(d);
  d.querySelectorAll('input[type=range]').forEach(r => r.oninput = () => { r.nextElementSibling.textContent = r.value; });
  d.addEventListener('close', () => {
    if (d.returnValue === 'ok') {
      const p = {};
      d.querySelectorAll('input[type=range]').forEach(r => { p[r.dataset.k] = +r.value; });
      ok(p);
    }
    d.remove();
  });
  d.showModal();
}

/* ---------- running a filter on the active cel ---------- */
function runFilter(fn) {
  const layer = canPaint();
  if (!layer) return;
  const t = acquireCel(layer);
  const b = { x: 0, y: 0, w: state.w, h: state.h };
  const before = crop(t.cel, b);
  const src = makeCanvas(b.w, b.h);
  src.getContext('2d').drawImage(t.cel, 0, 0);
  const out = fn(src);
  if (sel.active) {
    const o = makeCanvas(b.w, b.h), og = o.getContext('2d');
    og.drawImage(out, 0, 0);
    og.globalCompositeOperation = 'destination-in';
    og.drawImage(sel.mask, 0, 0);
    t.ctx.save();
    t.ctx.globalCompositeOperation = 'destination-out';
    t.ctx.drawImage(sel.mask, 0, 0);
    t.ctx.restore();
    t.ctx.drawImage(o, 0, 0);
  } else {
    t.ctx.clearRect(0, 0, b.w, b.h);
    t.ctx.drawImage(out, 0, 0);
  }
  t.cel._ink = true;
  pushHistory(celEntry(t, b, before, crop(t.cel, b)));
  afterEdit();
}
function mapPixels(src, fn) {
  const g = src.getContext('2d');
  const im = g.getImageData(0, 0, src.width, src.height), d = im.data;
  for (let i = 0; i < d.length; i += 4) fn(d, i);
  g.putImageData(im, 0, 0);
  return src;
}

/* ---------- blur (3 box passes ~ gaussian, premultiplied alpha) ---------- */
function boxSizes(sigma, n) {
  const wi = Math.sqrt(12 * sigma * sigma / n + 1);
  let wl = Math.floor(wi); if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  const m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4));
  return Array.from({ length: n }, (_, i) => (i < m ? wl : wu));
}
function boxPass(src, dst, w, h, r, horiz) {
  const len = horiz ? w : h, lines = horiz ? h : w;
  const stride = horiz ? 4 : w * 4, lineStride = horiz ? w * 4 : 4;
  const inv = 1 / (2 * r + 1);
  for (let L = 0; L < lines; L++) {
    const base = L * lineStride;
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let k = 0; k <= r && k < len; k++) sum += src[base + k * stride + c];
      for (let i = 0; i < len; i++) {
        dst[base + i * stride + c] = sum * inv;
        const add = i + r + 1, rem = i - r;
        if (add < len) sum += src[base + add * stride + c];
        if (rem >= 0) sum -= src[base + rem * stride + c];
      }
    }
  }
}
function gaussianBlur(src, sigma) {
  const w = src.width, h = src.height, g = src.getContext('2d');
  const im = g.getImageData(0, 0, w, h), d = im.data, n = w * h;
  let a = new Float32Array(n * 4), b = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const al = d[i * 4 + 3] / 255;
    a[i * 4] = d[i * 4] * al; a[i * 4 + 1] = d[i * 4 + 1] * al; a[i * 4 + 2] = d[i * 4 + 2] * al; a[i * 4 + 3] = d[i * 4 + 3];
  }
  for (const sz of boxSizes(Math.max(0.4, sigma), 3)) {
    const r = (sz - 1) / 2;
    boxPass(a, b, w, h, r, true);
    boxPass(b, a, w, h, r, false);
  }
  for (let i = 0; i < n; i++) {
    const al = a[i * 4 + 3];
    const k = al > 0.5 ? 255 / al : 0;
    d[i * 4] = a[i * 4] * k; d[i * 4 + 1] = a[i * 4 + 1] * k; d[i * 4 + 2] = a[i * 4 + 2] * k; d[i * 4 + 3] = al;
  }
  g.putImageData(im, 0, 0);
  return src;
}
function motionBlur(src, len, angle) {
  const n = clamp(Math.round(len), 2, 160);
  const out = makeCanvas(src.width, src.height), g = out.getContext('2d');
  const rad = angle * DEG, dx = Math.cos(rad) * len, dy = Math.sin(rad) * len;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    g.globalAlpha = 1 / (i + 1);
    g.drawImage(src, dx * t, dy * t);
  }
  return out;
}
function unsharp(src, amount, sigma) {
  const blurred = makeCanvas(src.width, src.height);
  blurred.getContext('2d').drawImage(src, 0, 0);
  gaussianBlur(blurred, sigma);
  const bd = blurred.getContext('2d').getImageData(0, 0, src.width, src.height).data;
  const k = amount / 100;
  return mapPixels(src, (d, i) => {
    for (let c = 0; c < 3; c++) d[i + c] = clamp(d[i + c] + (d[i + c] - bd[i + c]) * k, 0, 255);
  });
}
function mosaic(src, size) {
  const sw = Math.max(1, Math.ceil(src.width / size)), sh = Math.max(1, Math.ceil(src.height / size));
  const small = makeCanvas(sw, sh), sg = small.getContext('2d');
  sg.imageSmoothingEnabled = true; sg.imageSmoothingQuality = 'high';
  sg.drawImage(src, 0, 0, sw, sh);
  const out = makeCanvas(src.width, src.height), g = out.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(small, 0, 0, sw * size, sh * size);
  return out;
}

/* ---------- tonal correction ---------- */
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const dd = mx - mn;
    s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
    h = mx === r ? (g - b) / dd + (g < b ? 6 : 0) : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hsl2rgb(h, s, l) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = (t + 1) % 1; return 255 * (t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p); };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}
const fBrightContrast = (src, p) => {
  const cf = (259 * (p.c + 255)) / (255 * (259 - p.c));
  return mapPixels(src, (d, i) => { for (let k = 0; k < 3; k++) d[i + k] = clamp((d[i + k] - 128) * cf + 128 + p.b * 2.55, 0, 255); });
};
const fHSL = (src, p) => mapPixels(src, (d, i) => {
  if (!d[i + 3]) return;
  let [h, s, l] = rgb2hsl(d[i], d[i + 1], d[i + 2]);
  h = (h + p.h / 360 + 1) % 1;
  s = clamp(s * (1 + p.s / 100), 0, 1);
  l = p.l >= 0 ? l + (1 - l) * p.l / 100 : l * (1 + p.l / 100);
  const [r, g, b] = hsl2rgb(h, s, l);
  d[i] = r; d[i + 1] = g; d[i + 2] = b;
});
const fLevels = (src, p) => mapPixels(src, (d, i) => {
  for (let k = 0; k < 3; k++) {
    const v = clamp((d[i + k] - p.lo) / Math.max(1, p.hi - p.lo), 0, 1);
    d[i + k] = Math.pow(v, 1 / p.g) * 255;
  }
});
const fPoster = (src, p) => mapPixels(src, (d, i) => { for (let k = 0; k < 3; k++) d[i + k] = Math.round(d[i + k] / 255 * (p.n - 1)) / (p.n - 1) * 255; });
const fBinarize = (src, p) => mapPixels(src, (d, i) => {
  const v = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114 >= p.t ? 255 : 0;
  d[i] = d[i + 1] = d[i + 2] = v;
});
const fInvert = src => mapPixels(src, (d, i) => { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; });
const fNoise = (src, p) => mapPixels(src, (d, i) => {
  if (!d[i + 3]) return;
  const n = (Math.random() - 0.5) * 5.1 * p.a;
  for (let k = 0; k < 3; k++) d[i + k] = clamp(d[i + k] + n, 0, 255);
});
const fBrightToAlpha = src => mapPixels(src, (d, i) => {
  const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
  d[i + 3] = d[i + 3] * (1 - lum / 255);
  d[i] = d[i + 1] = d[i + 2] = 0;
});

/* ---------- selection modify ---------- */
function dilateMask(src, r) {
  let cur = src, left = r;
  while (left > 0) {
    const s = Math.min(4, left); left -= s;
    const n = makeCanvas(state.w, state.h), g = n.getContext('2d');
    for (let k = 0; k < 8; k++) g.drawImage(cur, Math.round(Math.cos(k * Math.PI / 4) * s), Math.round(Math.sin(k * Math.PI / 4) * s));
    g.drawImage(cur, 0, 0);
    cur = n;
  }
  return cur;
}
function modifySelection(mode, r) {
  if (!sel.active) { toast('Make a selection first'); return; }
  const before = selSnapshot();
  let res;
  if (mode === 'expand') res = dilateMask(sel.mask, r);
  else if (mode === 'shrink') {
    const inv = makeCanvas(state.w, state.h), ig = inv.getContext('2d');
    ig.fillStyle = '#000'; ig.fillRect(0, 0, state.w, state.h);
    ig.globalCompositeOperation = 'destination-out'; ig.drawImage(sel.mask, 0, 0);
    const grown = dilateMask(inv, r);
    res = makeCanvas(state.w, state.h);
    const rg = res.getContext('2d');
    rg.fillStyle = '#000'; rg.fillRect(0, 0, state.w, state.h);
    rg.globalCompositeOperation = 'destination-out'; rg.drawImage(grown, 0, 0);
  } else {
    res = makeCanvas(state.w, state.h);
    res.getContext('2d').drawImage(sel.mask, 0, 0);
    gaussianBlur(res, r / 2);
  }
  const g = selCtx();
  g.globalCompositeOperation = 'copy'; g.drawImage(res, 0, 0); g.globalCompositeOperation = 'source-over';
  const bb = mode === 'blur' ? clampBox((sel.bb ? sel.bb.x : 0) - r * 2, (sel.bb ? sel.bb.y : 0) - r * 2,
    (sel.bb ? sel.bb.x + sel.bb.w : state.w) + r * 2, (sel.bb ? sel.bb.y + sel.bb.h : state.h) + r * 2) : computeBB();
  sel.bb = bb; sel.active = !!bb; antsDirty = true;
  pushHistory(selEntry(before, selSnapshot()));
  startAnts(); refreshProps(); drawOverlay();
}


/* ---------- Blend tools: smudge / finger / blur (work directly on the cel) ---------- */
/* colour-mixing / blend brushes keep the painted area in ordinary memory while the stroke lasts (tiles of MIR_T px):
   each tile is read from the layer once (the first time the brush touches it), the dabs read and write the copy, and
   the layer is updated once per screen frame (mirFlush). Reading the layer back from the graphics chip on every dab
   (twice: read + write) is what made imported mixing pens lag and freeze on PCs with a graphics card. */
const MIR_T = 256;
function mirTile(st, tx, ty) {
  if (!st.mir) st.mir = new Map();
  const k = tx + ',' + ty; let t = st.mir.get(k);
  if (!t) {
    const cv = st.t.ctx.canvas, x = tx * MIR_T, y = ty * MIR_T, w = Math.min(MIR_T, cv.width - x), h = Math.min(MIR_T, cv.height - y);
    // read through a small canvas: calling getImageData on the layer itself makes the browser move the whole layer
    // to slow memory, and then every change re-sends the full picture to the screen (lag on big pages)
    const tc = makeCanvas(w, h), tg = tc.getContext('2d', { willReadFrequently: true });
    tg.drawImage(cv, x, y, w, h, 0, 0, w, h);
    t = { x, y, w, h, im: tg.getImageData(0, 0, w, h), d0: null, tc };
    const ov = mirOverlay(st);
    if (ov) { // shown as a small tile over the layer while the stroke lasts; the layer gets it back at the end (mirFinish)
      tc.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
      ov.el.appendChild(tc); tg.putImageData(t.im, 0, 0); st.t.ctx.clearRect(x, y, w, h); t.ov = true;
    }
    st.mir.set(k, t);
  }
  return t;
}
/* big layers: during a mixing stroke the changed area lives in 256 px tile canvases laid over the layer (same place,
   transform, opacity and blend), so each frame updates a few small tiles instead of the whole page-size layer */
let MIR_OV = null;
function mirOverlay(st) {
  if (st.mirOv !== undefined) return st.mirOv;
  st.mirOv = null;
  const cv = st.t.ctx.canvas, cs = cv.style;
  if (typeof stage === 'undefined' || cv.parentNode !== stage || cs.display === 'none' || cv.width !== state.w || cv.height !== state.h || cv.width * cv.height < 1.5e6) return null;
  const el = document.createElement('div'); el.className = 'mir-ov';
  el.style.cssText = `position:absolute;left:0;top:0;width:${state.w}px;height:${state.h}px;pointer-events:none;transform-origin:${cs.transformOrigin || '0 0'};transform:${cs.transform || 'none'};opacity:${cs.opacity || 1};mix-blend-mode:${cs.mixBlendMode || 'normal'};z-index:${cs.zIndex}`;
  cv.after(el);
  return st.mirOv = MIR_OV = { el, cv, st };
}
/* end of the stroke: the tiles go back into the layer (one write per tile) and the overlay is removed */
function mirFinish(st) {
  if (!st || !st.mir) return;
  for (const t of st.mir.values()) if (t.ov) { st.t.ctx.clearRect(t.x, t.y, t.w, t.h); st.t.ctx.drawImage(t.tc, t.x, t.y); t.ov = false; }
  if (st.mirOv) { st.mirOv.el.remove(); if (MIR_OV === st.mirOv) MIR_OV = null; st.mirOv = null; }
}
/* copy the rectangle (x0, y0, w, h) between the tiles and an ImageData (put = false: tiles → image; true: image → tiles) */
function mirCopy(st, im, x0, y0, put) {
  const w = im.width, h = im.height, D = im.data;
  for (let ty = Math.floor(y0 / MIR_T); ty * MIR_T < y0 + h; ty++) for (let tx = Math.floor(x0 / MIR_T); tx * MIR_T < x0 + w; tx++) {
    if (tx < 0 || ty < 0 || tx * MIR_T >= st.t.ctx.canvas.width || ty * MIR_T >= st.t.ctx.canvas.height) continue;
    const t = mirTile(st, tx, ty), ax = Math.max(x0, t.x), ay = Math.max(y0, t.y), bx = Math.min(x0 + w, t.x + t.w), by = Math.min(y0 + h, t.y + t.h);
    if (bx <= ax || by <= ay) continue;
    const T = t.im.data, n = (bx - ax) * 4;
    for (let yy = ay; yy < by; yy++) {
      const ti = ((yy - t.y) * t.w + (ax - t.x)) * 4, ii = ((yy - y0) * w + (ax - x0)) * 4;
      if (put) T.set(D.subarray(ii, ii + n), ti); else D.set(T.subarray(ti, ti + n), ii);
    }
    if (put) { const r = t.d0; t.d0 = r ? [Math.min(r[0], ax), Math.min(r[1], ay), Math.max(r[2], bx), Math.max(r[3], by)] : [ax, ay, bx, by]; }
  }
  if (put && !st.mirRaf) st.mirRaf = requestAnimationFrame(() => { st.mirRaf = 0; mirFlush(st); });
}
function mirGet(st, x0, y0, w, h) { const im = new ImageData(w, h); mirCopy(st, im, x0, y0, false); return im; }
function mirFlush(st) {
  if (!st || !st.mir) return;
  for (const t of st.mir.values()) if (t.d0) {
    const [ax, ay, bx, by] = t.d0;
    if (t.ov) t.tc.getContext('2d').putImageData(t.im, 0, 0, ax - t.x, ay - t.y, bx - ax, by - ay);
    else st.t.ctx.putImageData(t.im, t.x, t.y, ax - t.x, ay - t.y, bx - ax, by - ay);
    t.d0 = null;
  }
  if (st.t.cel) st.t.cel._sv = (st.t.cel._sv || 0) + 1;
}
/* one dab of a colour-mixing / blend brush, in plain number math (no canvas calls). The brush carries colour along
   (st.sm.carry: a G×G premultiplied grid in brush space), picks up the layer under it, mixes it with the brush colour
   (paint brushes) and lays it back through the tip shape. It used to take ~10 small canvas operations per dab
   (≈0.15 ms); a pen stroke on a big page zoomed out makes thousands of dabs per second, so the line fell behind the
   pen. Same result, many times faster. smudgeDab is the pure core (tested in unit.cjs). */
function smudgeStamp(st, x, y, pr) {
  const s = st.s, d = Math.max(3, diameterAt(st, pr)), sx = x - d / 2, sy = y - d / 2;
  const paint = s.paint != null && !s.blurTool, P = paint ? clamp(s.paint, 0, 1) : 0, D = paint ? clamp(s.paintDensity ?? 1, 0, 1) : 1;
  const strength = clamp(s.flow * (s.pAlpha ? lerp(s.aMin ?? 0.15, 1, typeof prCurve === 'function' ? prCurve(s.aCurve, pr) : pr) : 1) * (paint ? s.opacity : 1), 0, 1);
  if (!st.sm) { // per stroke: the tip's alpha as numbers, and the carried-colour grid
    const t0 = s.tipId && customTips.has(s.tipId) ? customTips.get(s.tipId) : getTip('#000000', s.hardness);
    const c = makeCanvas(t0.width, t0.height), g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(t0, 0, 0);
    const td = g.getImageData(0, 0, c.width, c.height).data, ta = new Float32Array(c.width * c.height);
    for (let i = 0; i < ta.length; i++) ta[i] = td[i * 4 + 3] / 255;
    const G = clamp(Math.ceil(Math.max(d, diameterAt(st, 1)) / 2), 4, 40); // carried colour is smooth: half the brush size is plenty
    st.sm = { tw: c.width, th: c.height, ta, G, carry: new Float32Array(G * G * 4), pick: new Float32Array(G * G * 4), init: false };
  }
  const cv = st.t.ctx.canvas, ox = Math.floor(sx), oy = Math.floor(sy), D0 = Math.ceil(d) + 2;
  const x0 = Math.max(0, ox), y0 = Math.max(0, oy), x1 = Math.min(cv.width, ox + D0), y1 = Math.min(cv.height, oy + D0);
  if (x1 > x0 && y1 > y0) {
    const o = {
      blur: !!s.blurTool, smudge: s.smudge ?? 0.5, strength, paint, P, D, rgb: paint ? hexToRgb(st.color) : [0, 0, 0],
      tv: paint && s.tex ? texBaseFor(s.tex)._vals : null, tN: TEX_N, tk: s.texScale || 1, tA: clamp(s.texAmt ?? 0.6, 0, 1), tex: paint && s.tex ? s.tex : null
    };
    if (typeof gpuDab === 'function' && gpuDab(st, sx, sy, d, o)) { growBox(st, x, y, d); return; } // on the graphics card (p10wa_gpumix)
    const im = mirGet(st, x0, y0, x1 - x0, y1 - y0); // the layer under the dab, from the in-memory copy
    smudgeDab(st.sm, im.data, x1 - x0, y1 - y0, x0, y0, sx, sy, d, o);
    mirCopy(st, im, x0, y0, true); // to the copy; the layer is updated once per frame (mirFlush)
  }
  growBox(st, x, y, d);
}
/* the dab itself (pure): M = per-stroke buffers, S = RGBA pixels of the region (rw × rh at x0, y0, changed in place) */
function smudgeDab(M, S, rw, rh, x0, y0, sx, sy, d, o) {
  const G = M.G, T = M.pick, cell = d / G;
  // premultiplied bilinear sample of the region at document point (fx, fy); outside = transparent
  const samp = (fx, fy, out, k) => {
    const X = fx - 0.5 - x0, Y = fy - 0.5 - y0, ix = Math.floor(X), iy = Math.floor(Y), ax = X - ix, ay = Y - iy;
    let r = 0, g = 0, b = 0, a = 0;
    for (let j = 0; j < 4; j++) {
      const px = ix + (j & 1), py = iy + (j >> 1); if (px < 0 || py < 0 || px >= rw || py >= rh) continue;
      const w = ((j & 1) ? ax : 1 - ax) * ((j >> 1) ? ay : 1 - ay); if (!w) continue;
      const i = (py * rw + px) * 4, al = S[i + 3] / 255 * w; r += S[i] * al; g += S[i + 1] * al; b += S[i + 2] * al; a += al;
    }
    out[k] = r; out[k + 1] = g; out[k + 2] = b; out[k + 3] = a;
  };
  const sub = cell > 3 ? 2 : 1, q = new Float32Array(4); // big brushes: 2×2 samples per cell
  const pickCell = (cx, cy, cw, out, k) => { // average of the area [cx, cx + cw)²
    if (sub === 1) { samp(cx + cw / 2, cy + cw / 2, out, k); return; }
    let r = 0, g = 0, b = 0, a = 0;
    for (let v = 0; v < 2; v++) for (let u = 0; u < 2; u++) { samp(cx + cw * (u + 0.5) / 2, cy + cw * (v + 0.5) / 2, q, 0); r += q[0]; g += q[1]; b += q[2]; a += q[3]; }
    out[k] = r / 4; out[k + 1] = g / 4; out[k + 2] = b / 4; out[k + 3] = a / 4;
  };
  if (o.blur) { // blur: the area shrunk to n×n, then stretched back (smooth)
    const n = clamp(Math.round(d / 7), 3, 64), B = new Float32Array(n * n * 4), bc = d / n;
    for (let v = 0; v < n; v++) for (let u = 0; u < n; u++) pickCell(sx + u * bc, sy + v * bc, bc, B, (v * n + u) * 4);
    for (let v = 0; v < G; v++) for (let u = 0; u < G; u++) {
      const X = clamp((u + 0.5) * n / G - 0.5, 0, n - 1), Y = clamp((v + 0.5) * n / G - 0.5, 0, n - 1), ix = Math.min(n - 2, Math.floor(X)), iy = Math.min(n - 2, Math.floor(Y)), ax = X - ix, ay = Y - iy, k = (v * G + u) * 4;
      for (let c = 0; c < 4; c++) { const i = (iy * n + ix) * 4 + c; T[k + c] = (B[i] * (1 - ax) + B[i + 4] * ax) * (1 - ay) + (B[i + n * 4] * (1 - ax) + B[i + n * 4 + 4] * ax) * ay; }
    }
  } else {
    for (let v = 0; v < G; v++) for (let u = 0; u < G; u++) pickCell(sx + u * cell, sy + v * cell, cell, T, (v * G + u) * 4);
    const C = M.carry;
    if (!M.init) { C.set(T); M.init = true; }
    else { const k = 1 - o.smudge; for (let i = 0; i < C.length; i += 4) { const f = 1 - T[i + 3] * k; C[i] = T[i] * k + C[i] * f; C[i + 1] = T[i + 1] * k + C[i + 1] * f; C[i + 2] = T[i + 2] * k + C[i + 2] * f; C[i + 3] = T[i + 3] * k + C[i + 3] * f; } }
  }
  const CG = o.blur ? T : M.carry, ta = M.ta, tw = M.tw, th = M.th, [BR, BG, BB] = o.rgb, { P, D, paint, strength, tv, tN, tk, tA } = o;
  const bil = (A, W, H, X, Y, stride, c) => { // clamped bilinear in a W×H grid
    X = clamp(X, 0, W - 1); Y = clamp(Y, 0, H - 1); const ix = Math.min(W - 2, Math.floor(X)) | 0, iy = Math.min(H - 2, Math.floor(Y)) | 0, ax = X - ix, ay = Y - iy;
    if (W < 2 || H < 2) return A[c];
    const i = (iy * W + ix) * stride + c;
    return (A[i] * (1 - ax) + A[i + stride] * ax) * (1 - ay) + (A[i + W * stride] * (1 - ax) + A[i + W * stride + stride] * ax) * ay;
  };
  const rx = Math.max(x0, Math.floor(sx)), ry = Math.max(y0, Math.floor(sy)), ex = Math.min(x0 + rw, Math.ceil(sx + d) + 1), ey = Math.min(y0 + rh, Math.ceil(sy + d) + 1);
  for (let py = ry; py < ey; py++) {
    const v = (py + 0.5 - sy) / d; if (v < 0 || v >= 1) continue;
    for (let px = rx; px < ex; px++) {
      const u = (px + 0.5 - sx) / d; if (u < 0 || u >= 1) continue;
      let km = strength * bil(ta, tw, th, u * tw - 0.5, v * th - 0.5, 1, 0);
      if (km <= 0.0005) continue;
      if (tv) { const tu = Math.floor(px / tk) % tN, tw2 = Math.floor(py / tk) % tN; km *= 1 - tA * (1 - tv[(tw2 < 0 ? tw2 + tN : tw2) * tN + (tu < 0 ? tu + tN : tu)]); }
      // carried colour at this point (bilinear, 4 channels at once)
      const GX = clamp(u * G - 0.5, 0, G - 1), GY = clamp(v * G - 0.5, 0, G - 1), gx = Math.min(G - 2, GX | 0), gy = Math.min(G - 2, GY | 0), fx = GX - gx, fy = GY - gy;
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy, j0 = (gy * G + gx) * 4, j1 = j0 + G * 4;
      let ca = CG[j0 + 3] * w00 + CG[j0 + 7] * w10 + CG[j1 + 3] * w01 + CG[j1 + 7] * w11, cr = 0, cgr = 0, cb = 0;
      if (ca > 0.0001) {
        cr = (CG[j0] * w00 + CG[j0 + 4] * w10 + CG[j1] * w01 + CG[j1 + 4] * w11) / ca;
        cgr = (CG[j0 + 1] * w00 + CG[j0 + 5] * w10 + CG[j1 + 1] * w01 + CG[j1 + 5] * w11) / ca;
        cb = (CG[j0 + 2] * w00 + CG[j0 + 6] * w10 + CG[j1 + 2] * w01 + CG[j1 + 6] * w11) / ca;
      }
      ca = Math.min(1, ca);
      const i = ((py - y0) * rw + (px - x0)) * 4, oa = S[i + 3] / 255;
      if (paint) { // amount of paint P: brush colour vs picked-up colour; density D: how much it covers
        const wp = (1 - P) * ca, ws = P + wp;
        if (ws > 0.0001) { cr = (BR * P + cr * wp) / ws; cgr = (BG * P + cgr * wp) / ws; cb = (BB * P + cb * wp) / ws; }
        ca = D * Math.min(1, ws);
        const da = km * ca, na = da + oa * (1 - da); // paint goes on top (never makes the layer more transparent)
        if (na > 0.0001) { const wo = oa * (1 - da); S[i] = (cr * da + S[i] * wo) / na; S[i + 1] = (cgr * da + S[i + 1] * wo) / na; S[i + 2] = (cb * da + S[i + 2] * wo) / na; }
        S[i + 3] = na * 255 + 0.5;
        continue;
      }
      const keep = 1 - km, na = oa * keep + km * ca;
      S[i + 3] = na * 255 + 0.5;
      if (na > 0.0001) { const wo = oa * keep, wc = km * ca; S[i] = (S[i] * wo + cr * wc) / na; S[i + 1] = (S[i + 1] * wo + cgr * wc) / na; S[i + 2] = (S[i + 2] * wo + cb * wc) / na; }
    }
  }
}
function finishDirect(st, b) {
  const t = st.t;
  if (sel.active) {
    const nw = crop(t.cel, b), ng = nw.getContext('2d');
    ng.globalCompositeOperation = 'destination-in';
    ng.drawImage(sel.mask, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
    t.ctx.save();
    t.ctx.beginPath(); t.ctx.rect(b.x, b.y, b.w, b.h); t.ctx.clip();
    t.ctx.clearRect(b.x, b.y, b.w, b.h);
    t.ctx.drawImage(snapCanvas, 0, 0);
    t.ctx.globalCompositeOperation = 'destination-out';
    t.ctx.drawImage(sel.mask, 0, 0);
    t.ctx.globalCompositeOperation = 'source-over';
    t.ctx.drawImage(nw, b.x, b.y);
    t.ctx.restore();
  }
  t.cel._ink = true;
  clearBuffers(st);
  pushHistory(celEntry(t, b, crop(snapCanvas, b), crop(t.cel, b)));
  afterEdit();
}
function registerExtraTools() {
  IC.blend = '<path d="M12 3c3.5 4.5 6 7.3 6 10.5A6 6 0 0 1 6 13.5C6 10.3 8.5 7.5 12 3z"/><path d="M9 14a3 3 0 0 0 3 3" opacity=".7"/>';
  IC.sparkle = '<path d="M12 3l1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8z"/><path d="M19 3v4M17 5h4M5 17v4M3 19h4"/>';
  IC.airbrush = '<path d="M4 20l5-5"/><path d="M9 15l6-6 3 3-6 6z"/><path d="M15 9l2-5 3 3-5 2"/><circle cx="5" cy="13" r=".7"/><circle cx="8" cy="10" r=".7"/><circle cx="4" cy="9" r=".7"/>';
  const T = (name, icon, preset) => ({ name, kind: 'brush', icon, preset });
  const extra = {
    /* blend group */
    blend:    T('Blend',      'blend', P(42, 0.45, 0.55, 1, true, false, 0, { smudge: 0.88 })),
    blurtool: T('Blur',       'blend', P(42, 0.3, 0.45, 1, true, false, 0, { smudge: 0, blurTool: true })),
    finger:   T('Finger tip', 'blend', P(30, 0.75, 0.92, 1, true, false, 0, { smudge: 0.97 })),
    /* sketch / pencil group */
    charcoal: T('Charcoal',   'pencil', P(16, 0.55, 0.6, 1, true, true, 0.10, { tex: 'charcoal', texAmt: 0.75 })),
    crayon:   T('Crayon',     'pencil', P(12, 0.7, 0.75, 1, true, true, 0.10, { tex: 'rough', texAmt: 0.7 })),
    pastel:   T('Pastel',     'brush',  P(24, 0.5, 0.6, 1, true, true, 0.10, { tex: 'rough', texAmt: 0.85, texScale: 1.4 })),
    chalk:    T('Chalk',      'brush',  P(20, 0.8, 0.85, 1, true, true, 0.10, { tex: 'canvas', texAmt: 0.9 })),
    /* watercolour tab */
    wcround:  T('Round watercolor brush', 'brush', P(32, 0.55, 0.35, 0.8, true, true, 0.20, { tex: 'paper', texAmt: 0.7, wet: 0.75 })),
    wcflat:   T('Flat watercolor brush',  'brush', P(36, 1, 0.3, 0.75, true, true, 0.20, { nibRatio: 0.3, nibAngle: 25, tex: 'paper', texAmt: 0.75, wet: 0.6 })),
    softbleed:T('Soft bleed',   'brush', P(54, 0.1, 0.22, 0.8, true, true, 0.25, { wet: 0.35 })),
    wetwash:  T('Wet wash',     'brush', P(130, 0.6, 0.22, 0.55, false, true, 0.30, { tex: 'rough', texAmt: 0.35, wet: 0.9 })),
    roughwash:T('Rough wash',   'brush', P(95, 0.7, 0.28, 0.65, false, true, 0.30, { tex: 'rough', texAmt: 0.75, wet: 0.55 })),
    wcsplash: T('Watercolor splash', 'brush', P(16, 0.9, 0.75, 0.85, false, false, 0, { scatter: 3.2, count: 5, jitter: 0.85, wet: 0.5 })),
    wcwatery: T('Watery brush',  'brush', P(24, 0.4, 0.4, 0.75, true, true, 0.25, { tex: 'paper', texAmt: 0.6, wet: 0.5 })),
    brushpen: T('Brush pen',     'pen',   P(12, 1, 1, 1, true, false, 0.35, { speed: 0.45, taperIn: 24, taperRatio: 0.25 })),
    dryink:   T('Dry ink',       'pen',   P(9, 0.95, 0.85, 1, true, true, 0.25, { tex: 'grain', texAmt: 0.9 })),
    waterink: T('Watery ink',    'pen',   P(14, 0.7, 0.55, 0.85, true, true, 0.30, { tex: 'paper', texAmt: 0.3, wet: 0.8 })),
    blotink:  T('Wet blotting ink', 'pen',P(28, 0.75, 0.55, 0.9, true, true, 0.30, { tex: 'rough', texAmt: 0.4, wet: 1 })),
    /* thick paint tab */
    oilpaint: T('Oil paint',   'brush', P(30, 0.9, 0.95, 1, true, false, 0.20, { tex: 'bristle', texAmt: 0.8 })),
    flatoil:  T('Flat oil',    'brush', P(36, 1, 0.95, 1, true, false, 0.20, { nibRatio: 0.35, nibAngle: 20, tex: 'bristle', texAmt: 0.85 })),
    gouache:  T('Gouache',     'brush', P(32, 0.95, 1, 1, true, false, 0.20, { tex: 'canvas', texAmt: 0.5 })),
    impasto:  T('Impasto',     'brush', P(40, 0.95, 1, 1, true, false, 0.20, { tex: 'bristle', texAmt: 1, texScale: 1.3 })),
    acrylic:  T('Acrylic',     'brush', P(26, 1, 1, 1, true, false, 0.20, { tex: 'canvas', texAmt: 0.35 })),
    /* eraser extras */
    kneaded:  { name: 'Kneaded eraser', kind: 'brush', icon: 'eraser', erase: true, preset: P(40, 0.3, 0.35, 1, true, true, 0.20) },
    roughera: { name: 'Rough eraser',   kind: 'brush', icon: 'eraser', erase: true, preset: P(36, 0.85, 0.9, 1, true, false, 0.20, { tex: 'rough', texAmt: 0.8 }) },
    snapera:  { name: 'Snap eraser',    kind: 'brush', icon: 'eraser', erase: true, preset: P(18, 1, 1, 1, false, false, 0.05) },
    /* airbrush group */
    spray:    T('Spray',       'airbrush', P(60, 0.8, 0.9, 1, true, false, 0, { scatter: 1.1, count: 9, jitter: 0.9 })),
    droplet:  T('Droplet',     'airbrush', P(30, 1, 1, 1, false, false, 0, { scatter: 2.2, count: 3, jitter: 0.9 })),
    noisespr: T('Noise',       'airbrush', P(80, 0.4, 0.5, 1, true, false, 0.1, { tex: 'grain', texAmt: 1 })),
    /* decoration: effect tab */
    sparkle:  T('Sparkle',     'sparkle', P(26, 1, 1, 1, false, false, 0, { shape: 'sparkle', scatter: 1.2, count: 2, jitter: 0.85 })),
    glitter:  T('Glitter',     'sparkle', P(18, 1, 0.9, 1, false, false, 0, { shape: 'star', scatter: 1.6, count: 3, jitter: 0.9 })),
    dapple:   T('Dappled light','sparkle', P(60, 1, 0.5, 1, false, false, 0, { shape: 'soft', scatter: 1.5, count: 2, jitter: 0.8 })),
    petal:    T('Petal',       'sparkle', P(34, 1, 0.95, 1, false, false, 0, { shape: 'petal', scatter: 1.4, count: 2, jitter: 0.6 })),
    heart:    T('Heart',       'sparkle', P(30, 1, 1, 1, false, false, 0, { shape: 'heart', scatter: 1.3, count: 2, jitter: 0.6 })),
    bubble:   T('Bubble',      'sparkle', P(40, 1, 0.9, 1, false, false, 0, { shape: 'bubble', scatter: 1.5, count: 2, jitter: 0.85 })),
    feather:  T('Feather',     'sparkle', P(44, 1, 0.9, 1, false, false, 0, { shape: 'feather', scatter: 1.2, count: 2, jitter: 0.5 }))
  };
  for (const k in extra) { TOOLDEF[k] = extra[k]; settings[k] = { ...extra[k].preset }; }
  /* make the stock pencils textured too */
  for (const k of ['pencil', 'mech']) { Object.assign(TOOLDEF[k].preset, { tex: 'grain', texAmt: k === 'pencil' ? 0.8 : 0.5 }); Object.assign(settings[k], { tex: 'grain', texAmt: k === 'pencil' ? 0.8 : 0.5 }); }
  Object.assign(settings.textured, { tex: 'paper', texAmt: 0.85 }); Object.assign(TOOLDEF.textured.preset, { tex: 'paper', texAmt: 0.85 });

  const grp = id => GROUPS.find(g => g.id === id);
  grp('pencil').name = 'Sketch';
  grp('pencil').subs.push('charcoal', 'crayon', 'pastel', 'chalk');
  const wc = ['wcround', 'wcflat', 'softbleed', 'wetwash', 'roughwash', 'wcsplash', 'wcwatery', 'brushpen', 'dryink', 'waterink', 'blotink'];
  const thick = ['oilpaint', 'flatoil', 'gouache', 'impasto', 'acrylic'];
  const br = grp('brush');
  br.subs = ['brush', 'marker', ...wc, ...thick];
  br.tabs = [['Basic', ['brush', 'marker']], ['Watercolor', wc], ['Thick paint', thick]];
  grp('eraser').subs.push('kneaded', 'roughera', 'snapera');
  const at = GROUPS.findIndex(g => g.id === 'eraser') + 1;
  const fx = ['sparkle', 'glitter', 'dapple', 'petal', 'heart', 'bubble', 'feather'];
  GROUPS.splice(at, 0,
    { id: 'blend', name: 'Blend', key: '', icon: 'blend', subs: ['blend', 'blurtool', 'finger'] },
    { id: 'airbrush', name: 'Airbrush', key: '', icon: 'airbrush', subs: ['airbrush', 'spray', 'droplet', 'noisespr'] },
    { id: 'decor', name: 'Decoration', key: '', icon: 'sparkle', subs: fx, tabs: [['Effect', fx]] });
}


/* ---------- click-by-click polyline engine (polyline selection, polyline, polygon, curve) ---------- */
let polyDraw = null, lastPolyClick = 0;
function polyClick(e) {
  const d = toDoc(e), tool = state.tool, now = performance.now();
  if (!polyDraw) polyDraw = { tool, pts: [], hover: [d.x, d.y], mode: e.shiftKey ? 'add' : e.altKey ? 'subtract' : null };
  const pd = polyDraw, last = pd.pts[pd.pts.length - 1];
  const dbl = last && now - lastPolyClick < 350 && Math.hypot(d.x - last[0], d.y - last[1]) * view.scale < 10;
  lastPolyClick = now;
  if (dbl) { polyFinish(); return; }
  if (pd.pts.length >= 3 && (tool === 'selpoly' || tool === 'polygon')) {
    const f = pd.pts[0];
    if (Math.hypot(d.x - f[0], d.y - f[1]) * view.scale < 8) { polyFinish(); return; }
  }
  pd.pts.push([d.x, d.y]);
  if (tool === 'curve' && pd.pts.length === 3) { polyFinish(); return; }
  drawOverlay();
}
function polyMove(e) {
  if (!polyDraw) return;
  const d = toDoc(e);
  polyDraw.hover = [d.x, d.y];
  drawOverlay();
}
function polyCancel() { if (polyDraw) { polyDraw = null; drawOverlay(); } }
function polyFinish() {
  const pd = polyDraw; polyDraw = null; drawOverlay();
  if (!pd) return;
  if (pd.tool === 'selpoly') {
    const pts = pd.pts;
    if (pts.length < 3) return;
    combineSel(g => { g.fillStyle = '#000'; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill(); }, pd.mode || state.selMode);
    return;
  }
  commitVector(pd.tool, pd.pts);
}
function drawPolyOverlay(g, S) {
  if (!polyDraw) return;
  const pd = polyDraw;
  let pts = pd.pts.slice();
  g.save();
  g.lineWidth = 1.5; g.setLineDash(pd.tool === 'selpoly' ? [5, 4] : []);
  g.strokeStyle = '#fff';
  const path = () => {
    g.beginPath();
    if (pd.tool === 'curve' && pts.length >= 1) {
      const a = S(pts[0][0], pts[0][1]);
      g.moveTo(a[0], a[1]);
      if (pts.length === 1) { const h = S(pd.hover[0], pd.hover[1]); g.lineTo(h[0], h[1]); }
      else { const c = S(pd.hover[0], pd.hover[1]), z = S(pts[1][0], pts[1][1]); g.quadraticCurveTo(c[0], c[1], z[0], z[1]); }
    } else {
      pts.concat([pd.hover]).forEach((q, i) => { const p = S(q[0], q[1]); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); });
    }
  };
  path(); g.stroke();
  g.strokeStyle = '#000'; g.lineDashOffset = 4; path(); g.stroke();
  g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.setLineDash([]);
  pts.forEach(q => { const p = S(q[0], q[1]); g.fillRect(p[0] - 3, p[1] - 3, 6, 6); g.strokeRect(p[0] - 3, p[1] - 3, 6, 6); });
  g.restore();
}
function commitVector(tool, pts) {
  if (tool === 'curve') {
    if (pts.length === 2) pts = [pts[0], pts[1], [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2]];
    else if (pts.length < 3) return;
  } else if (pts.length < 2) return;
  const layer = canPaint();
  if (!layer) return;
  const t = acquireCel(layer), lm = localMapper(layer);
  const mp = pts.map(p => lm.map(p[0], p[1]));
  const size = settings.shape.size;
  const tmp = makeCanvas(state.w, state.h), g = tmp.getContext('2d');
  g.lineWidth = size; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = g.fillStyle = state.color;
  g.beginPath();
  if (tool === 'curve') { g.moveTo(mp[0][0], mp[0][1]); g.quadraticCurveTo(mp[2][0], mp[2][1], mp[1][0], mp[1][1]); }
  else { mp.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); if (tool === 'polygon') g.closePath(); }
  if (tool === 'polygon' && state.shapeFill) g.fill(); else g.stroke();
  if (sel.active && lm.ident) { g.globalCompositeOperation = 'destination-in'; g.drawImage(sel.mask, 0, 0); }
  const xs = mp.map(p => p[0]), ys = mp.map(p => p[1]), pad = size + 4;
  const b = clampBox(Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad);
  if (!b) { releaseCel(t); return; }
  const before = crop(t.cel, b);
  t.ctx.drawImage(tmp, 0, 0);
  t.cel._ink = true;
  pushHistory(celEntry(t, b, before, crop(t.cel, b)));
  addRecent(state.color);
  afterEdit();
}

/* ---------- Lasso fill / Enclose and fill ---------- */
function lassoFill(pts, mode) {
  const layer = canPaint();
  if (!layer) return;
  const t = acquireCel(layer), lm = localMapper(layer);
  const mp = pts.map(p => lm.map(p[0], p[1]));
  const xs = mp.map(p => p[0]), ys = mp.map(p => p[1]);
  const b = clampBox(Math.min(...xs) - 2, Math.min(...ys) - 2, Math.max(...xs) + 3, Math.max(...ys) + 3);
  if (!b) { releaseCel(t); return; }
  const poly = makeCanvas(state.w, state.h), pg = poly.getContext('2d');
  pg.fillStyle = '#000'; pg.beginPath();
  mp.forEach((p, i) => i ? pg.lineTo(p[0], p[1]) : pg.moveTo(p[0], p[1])); pg.closePath(); pg.fill();
  if (sel.active && lm.ident) { pg.globalCompositeOperation = 'destination-in'; pg.drawImage(sel.mask, 0, 0); }
  const out = makeCanvas(b.w, b.h), og = out.getContext('2d');
  og.fillStyle = state.color; og.fillRect(0, 0, b.w, b.h);
  og.globalCompositeOperation = 'destination-in';
  og.drawImage(poly, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
  if (mode === 'fillenclose') {
    const src = state.fillAll ? compositeFrame(state.frame) : layer.canvas;
    const sd = src.getContext('2d').getImageData(b.x, b.y, b.w, b.h).data;
    const oi = og.getImageData(0, 0, b.w, b.h), od = oi.data;
    for (let i = 0; i < od.length; i += 4) {
      const a = sd[i + 3];
      const lum = sd[i] * 0.299 + sd[i + 1] * 0.587 + sd[i + 2] * 0.114;
      const line = state.fillAll ? lum < 150 : a > 90;
      if (line) od[i + 3] = 0;
    }
    og.putImageData(oi, 0, 0);
  }
  const before = crop(t.cel, b);
  t.ctx.drawImage(out, b.x, b.y);
  t.cel._ink = true;
  pushHistory(celEntry(t, b, before, crop(t.cel, b)));
  addRecent(state.color);
  afterEdit();
}

function gradPreview(id) {
  const c = makeCanvas(150, 30), g = c.getContext('2d');
  const def = TOOLDEF[id];
  g.fillStyle = '#d0d0d0'; g.fillRect(0, 0, 150, 30);
  g.fillStyle = '#a8a8a8';
  for (let y = 0; y < 30; y += 6) for (let x = (y / 6) % 2 ? 0 : 6; x < 150; x += 12) g.fillRect(x, y, 6, 6);
  const gr = def.radial ? g.createRadialGradient(75, 15, 0, 75, 15, 75) : g.createLinearGradient(0, 0, 150, 0);
  def.stops.forEach(([o, col]) => gr.addColorStop(o, col === 'fg' ? state.color : col === 'bg' ? state.color2 : col === 'fg0' ? 'rgba(0,0,0,0)' : col));
  g.fillStyle = gr; g.fillRect(0, 0, 150, 30);
  return c;
}


function registerWave2() {
  const D = (name, kind, icon, extra) => ({ name, kind, icon, ...extra });
  const stripe = []; for (let i = 0; i < 8; i++) { stripe.push([i / 8, i % 2 ? 'bg' : 'fg'], [(i + 1) / 8, i % 2 ? 'bg' : 'fg']); }
  Object.assign(TOOLDEF, {
    selpoly:   D('Polyline', 'select', 'sellasso'),
    selpen:    D('Selection pen', 'select', 'sellasso'),
    selerase:  D('Erase selection', 'select', 'sellasso'),
    selshrink: D('Shrink selection', 'select', 'sellasso'),
    selwandone:D('Refer to editing layer only', 'select', 'selwand', { wand: 'one' }),
    selwandref:D('Selection for referred layers', 'select', 'selwand', { wand: 'ref' }),
    fillone:   D('Refer only to editing layer', 'fill', 'fill'),
    fillref:   D('Refer to reference layers', 'fill', 'fill'),
    fillenclose: D('Enclose and fill', 'lassofill', 'fill'),
    filllasso: D('Lasso fill', 'lassofill', 'fill'),
    gfgtr:     D('Foreground to transparent', 'gradient', 'gradient', { stops: [[0, 'fg'], [1, 'fg0']] }),
    gfgbg:     D('Foreground to background', 'gradient', 'gradient', { stops: [[0, 'fg'], [1, 'bg']] }),
    gstripe:   D('Stripe', 'gradient', 'gradient', { stops: stripe }),
    grainbow:  D('Rainbow', 'gradient', 'gradient', { stops: [[0, '#ff2a2a'], [.17, '#ffa52a'], [.34, '#ffe92a'], [.5, '#3ccf4e'], [.67, '#2ab4ff'], [.84, '#4a3cff'], [1, '#b43cff']] }),
    gsunset:   D('Sunset', 'gradient', 'gradient', { stops: [[0, '#1b1230'], [.35, '#7a2f5e'], [.6, '#e0583a'], [.85, '#ffb347'], [1, '#fff1b8']] }),
    gmidday:   D('Midday sky', 'gradient', 'gradient', { stops: [[0, '#2a7de1'], [.6, '#6fb7ff'], [1, '#cfeaff']] }),
    gbluesky:  D('Blue sky', 'gradient', 'gradient', { stops: [[0, '#0b2a6b'], [.5, '#1f7fd1'], [1, '#bff3ff']] }),
    gnight:    D('Night sky', 'gradient', 'gradient', { stops: [[0, '#05060f'], [.6, '#16224d'], [1, '#3f67a8']] }),
    gphoto:    D('Photosphere', 'gradient', 'gradient', { radial: true, stops: [[0, '#fffbe8'], [.35, '#ffd9a0'], [.7, '#ff7a45'], [1, '#6b1230']] }),
    gerase:    D('Gradient erase', 'gradient', 'gradient', { erase: true, stops: [[0, 'fg'], [1, 'fg0']] }),
    gmanga:    D('Manga gradient', 'gradient', 'gradient', { stops: [[0, '#000000'], [1, 'rgba(0,0,0,0)']] }),
    polyline:  D('Polyline', 'poly', 'line'),
    polygon:   D('Polygon', 'poly', 'rect'),
    curve:     D('Curve', 'poly', 'line')
  });
  TOOLDEF.fill.name = 'Refer other layers';
  TOOLDEF.selwand.name = 'Refer to all layers'; TOOLDEF.selwand.wand = 'all';
  TOOLDEF.linear.name = 'Linear (main to sub)'; TOOLDEF.radial.name = 'Radial (main to sub)';
  const grp = id => GROUPS.find(g => g.id === id);
  grp('select').subs = ['selrect', 'selellipse', 'sellasso', 'selpoly', 'selpen', 'selerase', 'selshrink'];
  const selAt = GROUPS.findIndex(g => g.id === 'select') + 1;
  GROUPS.splice(selAt, 0, { id: 'wand', name: 'Auto select', key: 'W', icon: 'selwand', subs: ['selwand', 'selwandone', 'selwandref'] });
  grp('fill').subs = ['fill', 'fillone', 'fillref', 'fillenclose', 'filllasso'];
  grp('gradient').subs = ['linear', 'radial', 'gfgtr', 'gfgbg', 'gstripe', 'grainbow', 'gsunset', 'gmidday', 'gbluesky', 'gnight', 'gphoto', 'gerase', 'gmanga'];
  grp('shape').subs = ['line', 'rect', 'oval', 'polyline', 'polygon', 'curve'];
  document.addEventListener('keydown', e => {
    if (!polyDraw) return;
    if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); polyFinish(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); polyCancel(); }
  }, true);
}

/* ---------- menus & commands ---------- */
function installCsFeatures() {
  registerExtraTools();
  registerWave2();
  registerManga(); if (typeof installTwoTone === "function") installTwoTone();
  /* every painting tool responds to pen pressure out of the box: size always, opacity for soft / light media */
  for (const k in TOOLDEF) {
    const d = TOOLDEF[k], pr = d.preset;
    if (!pr || k === 'snapera' || d.kind === 'shape' || pr.smudge != null || pr.blurTool) continue;
    if (!pr.pSize) pr.pSize = true;
    if (!pr.pAlpha && (pr.hardness < 0.8 || pr.flow < 0.8 || pr.opacity < 0.8 || /pencil|air|water|wash|spray|chalk|charcoal|crayon|pastel|oil|paint/i.test(d.name || ''))) pr.pAlpha = true;
    settings[k] = { ...settings[k], pSize: pr.pSize, pAlpha: pr.pAlpha };
  }
  const dlg = (title, fields, fn) => () => effectDialog(title, fields, fn); // live preview (p10qa)
  Object.assign(CMD, {
    clipLayer: () => toggleLayerFlag('clip', 'Clip to layer below'),
    alphaLock: () => toggleLayerFlag('alock', 'Lock transparent pixels'),
    refLayer: () => toggleLayerFlag('ref', 'Reference layer'),
    draftLayer: () => toggleLayerFlag('draft', 'Draft layer'),
    lockLayer: () => { const l = activeLayer(); if (l) toggleLock(l); },
    fBlur: () => runFilter(s => gaussianBlur(s, 1.2)),
    fBlurStrong: () => runFilter(s => gaussianBlur(s, 3.5)),
    fGauss: dlg('Gaussian blur', [{ k: 'r', label: 'Radius', min: 1, max: 80, val: 8 }], (s, p) => gaussianBlur(s, p.r / 2)),
    fMotion: dlg('Motion blur', [{ k: 'len', label: 'Length', min: 2, max: 150, val: 30 }, { k: 'ang', label: 'Angle', min: 0, max: 179, val: 0 }], (s, p) => motionBlur(s, p.len, p.ang)),
    fSharpen: dlg('Sharpen', [{ k: 'a', label: 'Amount', min: 10, max: 400, val: 120 }, { k: 'r', label: 'Radius', min: 1, max: 10, val: 2 }], (s, p) => unsharp(s, p.a, p.r)),
    fMosaic: dlg('Mosaic', [{ k: 'n', label: 'Block size', min: 2, max: 120, val: 12 }], (s, p) => mosaic(s, p.n)),
    fNoise: dlg('Noise', [{ k: 'a', label: 'Amount', min: 1, max: 100, val: 20 }], fNoise),
    tBright: dlg('Brightness / Contrast', [{ k: 'b', label: 'Brightness', min: -100, max: 100, val: 0 }, { k: 'c', label: 'Contrast', min: -100, max: 100, val: 0 }], fBrightContrast),
    tHSL: dlg('Hue / Saturation / Luminosity', [{ k: 'h', label: 'Hue', min: -180, max: 180, val: 0 }, { k: 's', label: 'Saturation', min: -100, max: 100, val: 0 }, { k: 'l', label: 'Luminosity', min: -100, max: 100, val: 0 }], fHSL),
    tLevels: dlg('Level correction', [{ k: 'lo', label: 'Shadow', min: 0, max: 254, val: 0 }, { k: 'hi', label: 'Highlight', min: 1, max: 255, val: 255 }, { k: 'g', label: 'Gamma', min: 0.2, max: 3, step: 0.05, val: 1 }], fLevels),
    tPoster: dlg('Posterization', [{ k: 'n', label: 'Levels', min: 2, max: 16, val: 4 }], fPoster),
    tBinary: dlg('Binarization', [{ k: 't', label: 'Threshold', min: 1, max: 254, val: 128 }], fBinarize),
    tInvert: () => runFilter(fInvert),
    tBrightAlpha: () => runFilter(fBrightToAlpha),
    selExpand: () => paramDialog('Expand selection', [{ k: 'r', label: 'Pixels', min: 1, max: 100, val: 6 }], p => modifySelection('expand', p.r)),
    selShrink: () => paramDialog('Shrink selection', [{ k: 'r', label: 'Pixels', min: 1, max: 100, val: 6 }], p => modifySelection('shrink', p.r)),
    selBlur: () => paramDialog('Blur border', [{ k: 'r', label: 'Pixels', min: 1, max: 100, val: 8 }], p => modifySelection('blur', p.r))
  });
  const menu = n => MENUS.find(m => m[0] === n)[1];
  menu('Layer').splice(4, 0, '-', ['Clip to layer below', 'clipLayer', 'Ctrl+Alt+G'], ['Lock transparent pixels', 'alphaLock'],
    ['Lock layer', 'lockLayer'], ['Set as reference layer', 'refLayer'], ['Set as draft layer', 'draftLayer']);
  menu('Select').push('-', ['Expand selected area…', 'selExpand'], ['Shrink selected area…', 'selShrink'], ['Blur border…', 'selBlur']);
  menu('Edit').push('-', ['Convert brightness to opacity', 'tBrightAlpha'], '-',
    ['Brightness / Contrast…', 'tBright'], ['Hue / Saturation / Luminosity…', 'tHSL', 'Ctrl+U'], ['Level correction…', 'tLevels'],
    ['Posterization…', 'tPoster'], ['Binarization…', 'tBinary'], ['Reverse gradient (invert)', 'tInvert']);
  MENUS.splice(MENUS.findIndex(m => m[0] === 'View') + 1, 0, ['Filter', [['Blur', 'fBlur'], ['Blur (strong)', 'fBlurStrong'], ['Gaussian blur…', 'fGauss'],
    ['Motion blur…', 'fMotion'], '-', ['Sharpen…', 'fSharpen'], '-', ['Mosaic…', 'fMosaic'], ['Noise…', 'fNoise']]]);
  document.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && e.altKey && k === 'g') { e.preventDefault(); CMD.clipLayer(); }
    else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && k === 'u') { e.preventDefault(); CMD.tHSL(); }
  });
}
