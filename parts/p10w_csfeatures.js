/* ---------- Clip Studio-style features (original code) ----------
   Layer settings (clip to layer below, lock transparent pixels, reference / draft),
   Filter menu, Tonal correction, Select > expand / shrink / blur border.          */

function layerFlags(l) {
  return (l.clip ? '  clip' : '') + (l.alock ? '  α-lock' : '') + (l.ref ? '  REF' : '') + (l.draft ? '  draft' : '') + (l.mask ? (l.maskEdit ? '  MASK✎' : '  mask') : '');
}
function clipBaseOf(i) {
  for (let j = i - 1; j >= 0; j--) if (!state.layers[j].clip) return state.layers[j];
  return null;
}
function drawLayerOwn(g, l, fp) {
  g.save();
  if (!isIdentP(fp.p)) g.transform(...xfMatrix(fp.p, l));
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
  s.mixBlendMode = l.blend;
  s.transform = 'none';
  s.zIndex = 10 + i * 2;
  return cv;
}
function updateClipViews() {
  if (state.layers.some(l => l.clip || l.mask)) refreshStage();
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
function smudgeStamp(st, x, y, pr) {
  const s = st.s, g = st.t.ctx, C = 128;
  const d = Math.max(3, diameterAt(st, pr));
  const sx = x - d / 2, sy = y - d / 2;
  if (!st.carry) { st.carry = makeCanvas(C, C); st.tmpc = makeCanvas(C, C); st.small = makeCanvas(64, 64); }
  const cg = st.carry.getContext('2d'), tg = st.tmpc.getContext('2d');
  const strength = clamp(s.flow * (s.pAlpha ? lerp(0.15, 1, pr) : 1), 0, 1);
  const tip = getTip('#000000', s.hardness);
  tg.globalCompositeOperation = 'source-over';
  tg.clearRect(0, 0, C, C);
  if (s.blurTool) {
    const n = clamp(Math.round(d / 7), 3, 64);
    const sg = st.small.getContext('2d');
    sg.clearRect(0, 0, 64, 64);
    sg.imageSmoothingQuality = 'high';
    sg.drawImage(st.t.cel, sx, sy, d, d, 0, 0, n, n);
    tg.imageSmoothingQuality = 'high';
    tg.drawImage(st.small, 0, 0, n, n, 0, 0, C, C);
  } else {
    if (!st.carryInit) { st.carryInit = true; cg.drawImage(st.t.cel, sx, sy, d, d, 0, 0, C, C); }
    else { cg.globalAlpha = 1 - s.smudge; cg.drawImage(st.t.cel, sx, sy, d, d, 0, 0, C, C); cg.globalAlpha = 1; }
    tg.drawImage(st.carry, 0, 0);
  }
  const rx = Math.max(0, Math.floor(sx)), ry = Math.max(0, Math.floor(sy));
  const rw = Math.min(state.w, Math.ceil(sx + d) + 1) - rx, rh = Math.min(state.h, Math.ceil(sy + d) + 1) - ry;
  if (rw > 0 && rh > 0) {
    if (!st.rc || st.rc.width !== rw || st.rc.height !== rh) { st.rc = makeCanvas(rw, rh); st.mc = makeCanvas(rw, rh); }
    const rg = st.rc.getContext('2d', { willReadFrequently: true }), mg = st.mc.getContext('2d', { willReadFrequently: true });
    rg.clearRect(0, 0, rw, rh); rg.drawImage(st.tmpc, sx - rx, sy - ry, d, d);
    mg.clearRect(0, 0, rw, rh); mg.drawImage(tip, sx - rx, sy - ry, d, d);
    const cd = rg.getImageData(0, 0, rw, rh).data, md = mg.getImageData(0, 0, rw, rh).data;
    const im = g.getImageData(rx, ry, rw, rh), od = im.data;
    for (let i = 0; i < od.length; i += 4) {
      const km = strength * md[i + 3] / 255;
      if (km <= 0) continue;
      const oa = od[i + 3] / 255, ca = cd[i + 3] / 255;
      const keep = 1 - km, na = oa * keep + km * ca;
      od[i + 3] = na * 255 + 0.5;
      if (na > 0.0001) {
        const wo = oa * keep, wc = km * ca;
        od[i] = (od[i] * wo + cd[i] * wc) / na;
        od[i + 1] = (od[i + 1] * wo + cd[i + 1] * wc) / na;
        od[i + 2] = (od[i + 2] * wo + cd[i + 2] * wc) / na;
      }
    }
    g.putImageData(im, rx, ry);
  }
  growBox(st, x, y, d);
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
  clearBuffers();
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
  Object.assign(settings.textured, { tex: 'paper', texAmt: 0.5 });

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
  /* every painting tool responds to pen pressure out of the box: size always, opacity for soft / light media */
  for (const k in TOOLDEF) {
    const d = TOOLDEF[k], pr = d.preset;
    if (!pr || k === 'snapera' || d.kind === 'shape' || pr.smudge != null || pr.blurTool) continue;
    if (!pr.pSize) pr.pSize = true;
    if (!pr.pAlpha && (pr.hardness < 0.8 || pr.flow < 0.8 || pr.opacity < 0.8 || /pencil|air|water|wash|spray|chalk|charcoal|crayon|pastel|oil|paint/i.test(d.name || ''))) pr.pAlpha = true;
    settings[k] = { ...settings[k], pSize: pr.pSize, pAlpha: pr.pAlpha };
  }
  const dlg = (title, fields, fn) => () => paramDialog(title, fields, p => runFilter(src => fn(src, p)));
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
