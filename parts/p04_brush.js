/* ---------- brush engine ---------- */
const tipCache = new Map();
function getTip(color, hardness) {
  const key = color + '|' + hardness.toFixed(2);
  let t = tipCache.get(key);
  if (t) return t;
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  const [r, gg, b] = hexToRgb(color);
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  const h = clamp(hardness, 0, 0.99);
  grad.addColorStop(0, `rgba(${r},${gg},${b},1)`);
  grad.addColorStop(h, `rgba(${r},${gg},${b},1)`);
  grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  if (tipCache.size > 40) tipCache.clear();
  tipCache.set(key, c);
  return c;
}

/* custom (imported) brush tips */
const customTips = new Map(), tintCache = new Map();
function tintedTip(id, color) {
  const key = id + color;
  let c = tintCache.get(key);
  if (c) return c;
  const src = customTips.get(id);
  c = makeCanvas(src.width, src.height);
  const g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(src, 0, 0);
  if (tintCache.size > 60) tintCache.clear();
  tintCache.set(key, c);
  return c;
}
const curKey = () => {
  const k = kindOf(state.tool);
  return k === 'brush' ? state.tool : k === 'shape' ? 'shape' : state.lastBrush;
};
const curSettings = () => settings[curKey()];

const newBox = () => ({ x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 });
/* pen pressure with a user-adjustable response curve (Edit -> Pen pressure & touch) */
const penCfg = { gamma: 1, min: 0, max: 1, palm: true, twoTapUndo: true, penSeen: false };
try { Object.assign(penCfg, JSON.parse(localStorage.getItem('sketchforge.pen') || '{}'), { penSeen: false }); } catch (e) { /* ignore */ }
function shapePressure(p) {
  const lo = penCfg.min, hi = Math.max(lo + 0.05, penCfg.max);
  return clamp(Math.pow(clamp((p - lo) / (hi - lo), 0, 1), penCfg.gamma), 0.01, 1);
}
/* Pressure works automatically for every pen that reaches the browser as a pointer: Wacom, XP-Pen, Huion, Gaomon,
   Apple Pencil, Surface/Android styluses. Some drivers (XP-Pen without Windows Ink) report the pen as a 'mouse'
   with real pressure values - those are honoured too once a value other than 0/0.5 has been seen. */
let realPressureSeen = false, penSamples = 0, penFlat = true, penWarned = false;
function pressureOf(e) {
  const pt = e.pointerType;
  if (pt === 'pen') {
    penSamples++; if (Math.abs(e.pressure - 0.5) > 0.001 && e.pressure > 0) penFlat = false;
    if (!penWarned && penSamples > 40 && penFlat) { penWarned = true; toast('Your pen sends no pressure data. In the tablet driver (XP-Pen: PenTablet) turn on Windows Ink, then restart the app.'); }
    return shapePressure(e.pressure > 0 ? Math.max(e.pressure, 0.03) : 0.03);
  }
  if (pt === 'mouse' && e.buttons && e.pressure > 0 && Math.abs(e.pressure - 0.5) > 0.001) realPressureSeen = true;
  if (realPressureSeen && pt === 'mouse' && e.pressure > 0) return shapePressure(e.pressure);
  if (pt === 'touch' && e.pressure > 0 && e.pressure !== 0.5 && e.pressure !== 1 && penCfg.penSeen === false && e.force !== undefined) return shapePressure(e.pressure);
  return 1;
}
function diameterAt(st, pr) {
  return Math.max(0.5, st.s.size * ((st.s.pSize || st.s.speed > 0) ? lerp(0.12, 1, pr) : 1) *
    (st.s.taperIn ? lerp(st.s.taperRatio, 1, clamp((st.travel || 0) / st.s.taperIn, 0, 1)) : 1));
}
function stepAt(st, pr) {
  const d = diameterAt(st, pr);
  return Math.max(0.6, d * (st.s.tipId ? (st.s.spacing || 0.15) : st.s.hardness >= 0.97 ? 0.08 : 0.1));
}
function growBox(st, x, y, d) {
  const r = d / 2 + 2;
  for (const b of [st.box, st.mbox]) {
    if (x - r < b.x0) b.x0 = x - r;
    if (y - r < b.y0) b.y0 = y - r;
    if (x + r > b.x1) b.x1 = x + r;
    if (y + r > b.y1) b.y1 = y + r;
  }
}
/* one tip image drawn at (cx, cy) with diameter d */
function paintTip(ctx, st, cx, cy, d) {
  const s = st.s;
  if (s.shape) { drawShapeTip(ctx, s.shape, cx, cy, d, st.erase ? '#000' : st.color); return; }
  if (s.tipId && customTips.has(s.tipId)) {
    const tip = tintedTip(s.tipId, st.erase ? '#000000' : st.color);
    ctx.save();
    ctx.translate(cx, cy);
    if (s.tipRot) ctx.rotate(Math.random() * Math.PI * 2);
    ctx.drawImage(tip, -d / 2, -d / 2, d, d);
    ctx.restore();
  } else if (s.hardness >= 0.97) {
    ctx.save();
    ctx.fillStyle = st.erase ? '#000' : st.color;
    ctx.beginPath();
    if (s.nib) { ctx.translate(cx, cy); ctx.rotate(-s.nib * DEG); ctx.scale(1, 0.28); ctx.arc(0, 0, d / 2, 0, Math.PI * 2); }
    else if (s.nibRatio < 1) { ctx.translate(cx, cy); ctx.rotate(-s.nibAngle * DEG); ctx.scale(1, s.nibRatio); ctx.arc(0, 0, d / 2, 0, Math.PI * 2); }
    else ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (s.nibRatio < 1) {
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(-s.nibAngle * DEG); ctx.scale(1, s.nibRatio);
    ctx.drawImage(getTip(st.erase ? '#000000' : st.color, s.hardness), -d / 2, -d / 2, d, d);
    ctx.restore();
  } else {
    ctx.drawImage(getTip(st.erase ? '#000000' : st.color, s.hardness), cx - d / 2, cy - d / 2, d, d);
  }
}
/* decoration shapes (stars, petals, hearts ...) */
function drawShapeTip(ctx, kind, cx, cy, d, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.random() * Math.PI * 2);
  ctx.fillStyle = color; ctx.strokeStyle = color;
  const r = d / 2;
  ctx.beginPath();
  if (kind === 'sparkle') {
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.18 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
  } else if (kind === 'star') {
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
  } else if (kind === 'petal') {
    ctx.moveTo(0, -r); ctx.bezierCurveTo(r * 0.9, -r * 0.5, r * 0.6, r * 0.7, 0, r); ctx.bezierCurveTo(-r * 0.6, r * 0.7, -r * 0.9, -r * 0.5, 0, -r);
    ctx.fill();
  } else if (kind === 'heart') {
    ctx.moveTo(0, r * 0.85); ctx.bezierCurveTo(-r * 1.4, -r * 0.1, -r * 0.6, -r * 1.0, 0, -r * 0.35);
    ctx.bezierCurveTo(r * 0.6, -r * 1.0, r * 1.4, -r * 0.1, 0, r * 0.85); ctx.fill();
  } else if (kind === 'bubble') {
    ctx.lineWidth = Math.max(1, r * 0.14); ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha *= 0.5; ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.35, r * 0.2, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'feather') {
    ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * 0.7, -r * 0.2, 0, r); ctx.quadraticCurveTo(-r * 0.7, -r * 0.2, 0, -r); ctx.fill();
    ctx.globalAlpha *= 0.6; ctx.lineWidth = Math.max(1, r * 0.06); ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.strokeStyle = '#fff'; ctx.stroke();
  } else if (kind === 'soft') {
    ctx.drawImage(getTip(color, 0.15), -r, -r, d, d);
  } else { ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

/* ---------- procedural paper / bristle textures (original, generated) ---------- */
const TEX_N = 256, texBase = new Map(), texAmtCache = new Map();
function latticeNoise(w, h, gx, gy, seed) {          /* tileable value noise, 0..1 */
  let sd = seed;
  const rnd = () => (sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296;
  const g = new Float32Array(gx * gy);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = y / h * gy, y0 = Math.floor(fy) % gy, y1 = (y0 + 1) % gy, ty = fy - Math.floor(fy), sy = ty * ty * (3 - 2 * ty);
    for (let x = 0; x < w; x++) {
      const fx = x / w * gx, x0 = Math.floor(fx) % gx, x1 = (x0 + 1) % gx, tx = fx - Math.floor(fx), sx = tx * tx * (3 - 2 * tx);
      const a = g[y0 * gx + x0], b = g[y0 * gx + x1], c = g[y1 * gx + x0], d = g[y1 * gx + x1];
      out[y * w + x] = (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
    }
  }
  return out;
}
function texBaseFor(id) {
  let c = texBase.get(id);
  if (c) return c;
  const N = TEX_N, v = new Float32Array(N * N);
  let sd = 1234567;
  const rnd = () => (sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296;
  const mix = (arr, k) => { for (let i = 0; i < v.length; i++) v[i] += arr[i] * k; };
  if (id === 'paper') {
    mix(latticeNoise(N, N, 64, 64, 11), 0.45); mix(latticeNoise(N, N, 16, 16, 12), 0.3);
    for (let i = 0; i < v.length; i++) v[i] += rnd() * 0.25;
  } else if (id === 'grain') {
    const gn = latticeNoise(N, N, 128, 128, 5);
    for (let i = 0; i < v.length; i++) v[i] = Math.pow(rnd(), 0.55) * 0.6 + gn[i] * 0.4;
  } else if (id === 'canvas') {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const wv = 0.5 + 0.5 * Math.sin(x * Math.PI / 2.5) * Math.sin(y * Math.PI / 2.5);
      v[y * N + x] = 0.55 + wv * 0.3 + rnd() * 0.15;
    }
  } else if (id === 'rough') {
    mix(latticeNoise(N, N, 32, 32, 21), 0.5); mix(latticeNoise(N, N, 8, 8, 22), 0.35);
    for (let i = 0; i < v.length; i++) v[i] += rnd() * 0.15;
    for (let i = 0; i < v.length; i++) v[i] = clamp((v[i] - 0.3) * 1.5, 0, 1);
  } else if (id === 'bristle') {
    const st = latticeNoise(N, N, 4, 96, 31);                 /* long streaks */
    for (let i = 0; i < v.length; i++) v[i] = clamp(0.35 + st[i] * 0.75 + (rnd() - 0.5) * 0.12, 0, 1);
  } else if (id === 'charcoal') {
    const st = latticeNoise(N, N, 16, 64, 41), gr = latticeNoise(N, N, 128, 128, 42);
    for (let i = 0; i < v.length; i++) v[i] = clamp((st[i] * 0.5 + gr[i] * 0.4 + rnd() * 0.3 - 0.25) * 1.7, 0, 1);
  } else { for (let i = 0; i < v.length; i++) v[i] = rnd(); }
  c = makeCanvas(N, N);
  const g = c.getContext('2d'), im = g.createImageData(N, N);
  for (let i = 0; i < v.length; i++) { im.data[i * 4 + 3] = clamp(v[i], 0, 1) * 255; }
  g.putImageData(im, 0, 0);
  c._vals = v;
  texBase.set(id, c);
  return c;
}
/* texture with strength baked in: alpha = 1 - amt * (1 - value) */
function texFor(id, amt) {
  amt = Math.round(clamp(amt, 0, 1) * 20) / 20;
  const key = id + amt;
  let c = texAmtCache.get(key);
  if (c) return c;
  const base = texBaseFor(id), N = TEX_N, v = base._vals;
  c = makeCanvas(N, N);
  const g = c.getContext('2d'), im = g.createImageData(N, N);
  for (let i = 0; i < v.length; i++) im.data[i * 4 + 3] = (1 - amt * (1 - clamp(v[i], 0, 1))) * 255;
  g.putImageData(im, 0, 0);
  texAmtCache.set(key, c);
  return c;
}
let texTmp = null;
function texTemp(sz) {
  if (sz > 512) return makeCanvas(sz, sz);
  if (!texTmp) texTmp = makeCanvas(512, 512);
  return texTmp;
}
function drawOne(st, x, y, d, a) {
  const s = st.s, ctx = st.ctx;
  if (!s.tex) { ctx.save(); ctx.globalAlpha = a; paintTip(ctx, st, x, y, d); ctx.restore(); return; }
  const sz = Math.ceil(d) + 6, tc = texTemp(sz), tg = tc.getContext('2d');
  const ox = Math.round(x - sz / 2), oy = Math.round(y - sz / 2);
  tg.setTransform(1, 0, 0, 1, 0, 0);
  tg.globalCompositeOperation = 'source-over';
  tg.globalAlpha = 1;
  tg.clearRect(0, 0, sz, sz);
  paintTip(tg, st, x - ox, y - oy, d);
  tg.globalCompositeOperation = 'destination-in';
  const tcv = texFor(s.tex, s.texAmt == null ? 0.6 : s.texAmt);
  let pat = tg._pat && tg._patSrc === tcv ? tg._pat : null;
  if (!pat) { pat = tg._pat = tg.createPattern(tcv, 'repeat'); tg._patSrc = tcv; }
  if (pat.setTransform) pat.setTransform(new DOMMatrix([s.texScale || 1, 0, 0, s.texScale || 1, -ox, -oy]));
  tg.fillStyle = pat;
  tg.fillRect(0, 0, sz, sz);
  tg.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.globalAlpha = a;
  ctx.drawImage(tc, 0, 0, sz, sz, ox, oy, sz, sz);
  ctx.restore();
}
function stampAt(st, x, y, pr) {
  stampAt1(st, x, y, pr);
  if (symOn() && !st.isShape) for (const q of symPoints(x, y)) stampAt1(st, q[0], q[1], pr);
}
function stampAt1(st, x, y, pr) {
  const s = st.s;
  if (st.direct) { smudgeStamp(st, x, y, pr); return; }
  const d = diameterAt(st, pr);
  const a = clamp(s.flow * (s.pAlpha ? lerp(0.1, 1, pr) : 1) * (s.grain ? 1 - s.grain * Math.random() : 1), 0, 1);
  const n = s.count || 1, sc = s.scatter || 0;
  for (let i = 0; i < n; i++) {
    let px = x, py = y, dd = d;
    if (sc) { const ang = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * sc * d; px += Math.cos(ang) * r; py += Math.sin(ang) * r; }
    if (s.jitter) dd = Math.max(1, d * (1 - s.jitter * Math.random() * 0.9));
    if (sc || s.jitter) dd *= (s.shape || n > 1) ? 0.35 + 0.65 * (s.shape ? 1 : 0.5) : 1;
    drawOne(st, px, py, dd, a);
  }
  growBox(st, x, y, d * (1 + 2 * sc));
}
/* watercolour wet edge: pigment pools at the rim, centre goes lighter */
function applyWet(st, b) {
  const level = st.s.wet;
  const reg = makeCanvas(b.w, b.h);
  reg.getContext('2d').drawImage(bufCanvas, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
  const bl = makeCanvas(b.w, b.h);
  bl.getContext('2d').drawImage(reg, 0, 0);
  gaussianBlur(bl, Math.max(1.5, st.s.size * 0.09));
  const rg = reg.getContext('2d'), im = rg.getImageData(0, 0, b.w, b.h), d = im.data;
  const bd = bl.getContext('2d').getImageData(0, 0, b.w, b.h).data;
  for (let i = 3; i < d.length; i += 4) {
    d[i] = d[i] * (1 - level * 0.55 * Math.min(1, bd[i] / 255));
  }
  rg.putImageData(im, 0, 0);
  bufCtx.clearRect(b.x, b.y, b.w, b.h);
  bufCtx.drawImage(reg, b.x, b.y);
}
function segment(st, x, y, pr) {
  const x0 = st.lx, y0 = st.ly, p0 = st.lp;
  const dist = Math.hypot(x - x0, y - y0);
  if (dist < 0.01) return;
  const tr0 = st.travel || 0;
  let t = st.next;
  while (t <= dist) {
    const k = t / dist;
    const p = p0 + (pr - p0) * k;
    st.travel = tr0 + t;
    stampAt(st, x0 + (x - x0) * k, y0 + (y - y0) * k, p);
    t += stepAt(st, p);
  }
  st.travel = tr0 + dist;
  st.next = t - dist;
  st.lx = x; st.ly = y; st.lp = pr;
}

/* Keep only the part of the raw stroke that lies inside the selection (region b). */
function clipSync(clip, b) {
  bufCtx.save();
  bufCtx.beginPath(); bufCtx.rect(b.x, b.y, b.w, b.h); bufCtx.clip();
  bufCtx.globalCompositeOperation = 'source-over';
  bufCtx.clearRect(b.x, b.y, b.w, b.h);
  bufCtx.drawImage(rawCanvas, 0, 0);
  bufCtx.globalCompositeOperation = 'destination-in';
  bufCtx.drawImage(clip, 0, 0);
  bufCtx.restore();
}
/* Eraser: rebuild region b from the pre-stroke snapshot, minus the stroke. */
function eraseRegion(st, b) {
  const g = st.t.ctx;
  g.save();
  g.beginPath(); g.rect(b.x, b.y, b.w, b.h); g.clip();
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.clearRect(b.x, b.y, b.w, b.h);
  g.drawImage(snapCanvas, 0, 0);
  let src = bufCanvas;
  if (st.clip) {
    tmpCtx.save();
    tmpCtx.beginPath(); tmpCtx.rect(b.x, b.y, b.w, b.h); tmpCtx.clip();
    tmpCtx.globalCompositeOperation = 'source-over';
    tmpCtx.clearRect(b.x, b.y, b.w, b.h);
    tmpCtx.drawImage(bufCanvas, 0, 0);
    tmpCtx.globalCompositeOperation = 'destination-in';
    tmpCtx.drawImage(st.clip, 0, 0);
    tmpCtx.restore();
    src = tmpCanvas;
  }
  g.globalCompositeOperation = 'destination-out';
  g.globalAlpha = st.s.opacity;
  g.drawImage(src, 0, 0);
  g.restore();
}
function afterMove(st) {
  const m = st.mbox;
  st.mbox = newBox();
  if (!st.clip && !st.erase) return;
  const b = clampBox(m.x0, m.y0, m.x1, m.y1);
  if (!b) return;
  if (st.erase) eraseRegion(st, b); else clipSync(st.clip, b);
}

/* ---------- shapes ---------- */
function drawShape(ctx, st) {
  const x0 = st.startX, y0 = st.startY;
  let x1 = st.cx, y1 = st.cy;
  if (st.shift) {
    if (st.kind === 'line') {
      const ang = Math.round(Math.atan2(y1 - y0, x1 - x0) / (Math.PI / 4)) * (Math.PI / 4);
      const len = Math.hypot(x1 - x0, y1 - y0);
      x1 = x0 + Math.cos(ang) * len;
      y1 = y0 + Math.sin(ang) * len;
    } else {
      const dx = x1 - x0, dy = y1 - y0;
      const m = Math.max(Math.abs(dx), Math.abs(dy));
      x1 = x0 + (dx < 0 ? -m : m);
      y1 = y0 + (dy < 0 ? -m : m);
    }
  }
  ctx.save();
  ctx.lineWidth = st.s.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = st.color;
  ctx.fillStyle = st.color;
  ctx.beginPath();
  if (st.kind === 'line') {
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  } else if (st.kind === 'rect') {
    ctx.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    if (state.shapeFill) ctx.fill(); else ctx.stroke();
  } else {
    ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, Math.PI * 2);
    if (state.shapeFill) ctx.fill(); else ctx.stroke();
  }
  ctx.restore();
  const pad = st.s.size / 2 + 3;
  return {
    x0: Math.min(x0, x1) - pad, y0: Math.min(y0, y1) - pad,
    x1: Math.max(x0, x1) + pad, y1: Math.max(y0, y1) + pad
  };
}
function drawShapePreview(st) {
  const prev = st.box;
  st.ctx.clearRect(0, 0, state.w, state.h);
  st.box = drawShape(st.ctx, st);
  if (st.clip) {
    const b = clampBox(Math.min(prev.x0, st.box.x0), Math.min(prev.y0, st.box.y0),
      Math.max(prev.x1, st.box.x1), Math.max(prev.y1, st.box.y1));
    if (b) clipSync(st.clip, b);
  }
}

/* ---------- stroke lifecycle ---------- */
function canPaint() {
  const layer = activeLayer();
  if (!layer) { toast('No layer selected'); return null; }
  if (!layer.visible) { toast('Layer is hidden'); return null; }
  if (layer.locked) { toast('Layer is locked'); return null; }
  if (layer.maskEdit && layer.mask) { bindLayer(layer.mask, state.frame); return layer.mask; }
  return layer;
}
/* Position / style the preview canvas to sit exactly where the layer will be. */
function prepBuffer(layer, p, opacity, hide) {
  const s = bufCanvas.style;
  s.opacity = hide ? '0' : String(opacity * layer.opacity * (p ? p.alpha : 1));
  s.mixBlendMode = layer.blend;
  s.transform = p ? xfCss(p, layer) : 'none';
  s.zIndex = layerZ(layer) + 1;
}
/* Returns {ident, map(x,y)} mapping document points to the layer's own pixels. */
function localMapper(layer) {
  const fp = frameParams(layer, state.frame);
  if (!fp || isIdentP(fp.p)) return { fp, ident: true, map: (x, y) => [x, y] };
  const inv = invMat(xfMatrix(fp.p, layer));
  return { fp, ident: false, map: inv ? (x, y) => applyMat(inv, x, y) : (x, y) => [x, y] };
}

function beginStroke(e) {
  const tool = state.tool, def = TOOLDEF[tool];
  const layer = canPaint();
  if (!layer) return;
  const t = acquireCel(layer);
  const lm = localMapper(layer);
  const rlock = rulerStart(toDoc(e));
  const d0 = rulerApply(rlock, toDoc(e));
  const [x0, y0] = lm.map(d0.x, d0.y);
  const pr = pressureOf(e);
  snapCtx.clearRect(0, 0, state.w, state.h);
  snapCtx.drawImage(t.cel, 0, 0);
  const isShape = def.kind === 'shape';
  const erase = !!def.erase;
  const direct = TOOLDEF[tool].preset && TOOLDEF[tool].preset.smudge != null;
  const clip = (sel.active && lm.ident && !direct) ? sel.mask : null;
  const s = { ...curSettings() };
  bufCtx.clearRect(0, 0, state.w, state.h);
  rawCtx.clearRect(0, 0, state.w, state.h);
  stroke = {
    kind: tool, t, isShape, erase, direct, s, color: layer.isMask ? '#ff2a2a' : state.color, map: lm.map, clip,
    ctx: (clip && !erase) ? rawCtx : bufCtx,
    box: newBox(), mbox: newBox(),
    sx: x0, sy: y0, sp: pr, rx: x0, ry: y0, rp: pr,
    lx: x0, ly: y0, lp: pr, next: 0,
    startX: x0, startY: y0, cx: x0, cy: y0, shift: e.shiftKey,
    pointerId: e.pointerId, rlock
  };
  prepBuffer(layer, lm.fp && lm.fp.p, s.opacity, erase || direct);
  if (layer.isMask) { Object.assign(bufCanvas.style, { opacity: erase ? '0' : '0.5', zIndex: 9999, mixBlendMode: 'normal', transform: 'none' }); }
  if (!isShape) {
    stampAt(stroke, x0, y0, pr);
    stroke.next = stepAt(stroke, pr);
    afterMove(stroke);
  }
}

function moveStroke(e) {
  const st = stroke;
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
  const list = evs.length ? evs : [e];
  for (const ev of list) {
    const d = rulerApply(st.rlock, toDoc(ev));
    const [x, y] = st.map(d.x, d.y);
    let pr = pressureOf(ev);
    if (st.s.speed > 0 && !st.isShape) {
      const dt = Math.max(1, ev.timeStamp - (st.lt || ev.timeStamp - 8));
      const v = Math.hypot(x - st.rx, y - st.ry) / dt;
      st.vf = (st.vf || 0) * 0.7 + v * 0.3;
      st.lt = ev.timeStamp;
      pr *= 1 - st.s.speed * clamp(st.vf / 2.5, 0, 0.8);
    }
    if (st.isShape) {
      st.cx = x; st.cy = y; st.shift = ev.shiftKey;
      continue;
    }
    st.rx = x; st.ry = y; st.rp = pr;
    const k = 1 - st.s.smooth * 0.92;
    st.sx += (x - st.sx) * k;
    st.sy += (y - st.sy) * k;
    st.sp += (pr - st.sp) * Math.max(k, 0.3);
    segment(st, st.sx, st.sy, st.sp);
  }
  if (st.isShape) drawShapePreview(st); else afterMove(st);
}

function clearBuffers() {
  bufCtx.clearRect(0, 0, state.w, state.h);
  rawCtx.clearRect(0, 0, state.w, state.h);
}

function endStroke(cancel) {
  const st = stroke;
  if (!st) return;
  stroke = null;
  const t = st.t;

  if (cancel) {
    if (st.erase || st.direct) {
      t.ctx.save();
      t.ctx.globalCompositeOperation = 'copy';
      t.ctx.drawImage(snapCanvas, 0, 0);
      t.ctx.restore();
    }
    clearBuffers();
    releaseCel(t);
    return;
  }

  if (st.isShape) {
    drawShapePreview(st);
  } else if (st.s.smooth > 0) {
    segment(st, st.rx, st.ry, st.rp);
    afterMove(st);
  }

  const b = clampBox(st.box.x0, st.box.y0, st.box.x1, st.box.y1);
  if (!b) {
    clearBuffers();
    releaseCel(t);
    return;
  }

  if (st.direct) { finishDirect(st, b); return; }
  if (!st.erase && !st.isShape) applyAA(st.s.aa, b);
  if (st.s.wet && !st.erase && !st.isShape) applyWet(st, b);
  if (!st.erase) {
    t.ctx.save();
    t.ctx.globalAlpha = st.s.opacity;
    t.ctx.globalCompositeOperation = t.layer.alock ? 'source-atop' : 'source-over';
    t.ctx.drawImage(bufCanvas, b.x, b.y, b.w, b.h, b.x, b.y, b.w, b.h);
    t.ctx.restore();
    t.cel._ink = true;
    if (!t.layer.isMask) addRecent(st.color);
  }
  clearBuffers();

  const before = crop(snapCanvas, b);
  const after = crop(t.cel, b);
  pushHistory(celEntry(t, b, before, after));
  afterEdit();
}
/* anti-aliasing levels: 0 none, 1 weak, 2 normal, 3 strong */
function applyAA(level, b) {
  if (level === 2 || level === undefined) return;
  if (level === 3) {
    tmpCtx.clearRect(0, 0, state.w, state.h);
    tmpCtx.filter = 'blur(0.7px)';
    tmpCtx.drawImage(bufCanvas, 0, 0);
    tmpCtx.filter = 'none';
    bufCtx.clearRect(b.x, b.y, b.w, b.h);
    bufCtx.drawImage(tmpCanvas, b.x, b.y, b.w, b.h, b.x, b.y, b.w, b.h);
    return;
  }
  const img = bufCtx.getImageData(b.x, b.y, b.w, b.h), d = img.data;
  for (let i = 3; i < d.length; i += 4) {
    const a = d[i];
    d[i] = level === 0 ? (a >= 128 ? 255 : 0) : Math.max(0, Math.min(255, (a - 40) * 1.9));
  }
  bufCtx.putImageData(img, b.x, b.y);
}
/* shared tail for every pixel edit */
function afterEdit() {
  updateClipViews();
  renderLayers(); renderTimeline(); updateOnion(); refreshProps(); drawOverlay();
}

/* ---------- compositing, eyedropper, flood fill ---------- */
function compositeFrame(f, opts = {}) {
  const c = makeCanvas(state.w, state.h);
  const g = c.getContext('2d');
  state.layers.forEach((l, i) => {
    if (!l.visible || (opts.skipPaper && l.paper)) return;
    if (opts.onlyRef ? !l.ref : ((l.draft || l.ref) && !opts.all)) return;
    const fp = frameParams(l, f);
    if (!fp) return;
    g.save();
    g.globalAlpha = l.opacity * fp.p.alpha;
    g.globalCompositeOperation = canvasBlend(l.blend);
    const base = l.clip ? clipBaseOf(i) : null;
    if (base || l.mask) {
      const lc = makeCanvas(state.w, state.h);
      drawLayerOwn.frame = f; drawLayerOwn(lc.getContext('2d'), l, fp); drawLayerOwn.frame = undefined;
      if (base) clipToBase(lc, base, f);
      g.drawImage(lc, 0, 0);
    } else {
      if (!isIdentP(fp.p)) g.transform(...xfMatrix(fp.p, l));
      g.drawImage(fp.cel, 0, 0);
    }
    g.restore();
  });
  return c;
}

function sampleColor(x, y) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= state.w || y >= state.h) return null;
  pickCtx.clearRect(0, 0, 1, 1);
  for (const l of state.layers) {
    if (!l.visible) continue;
    const fp = frameParams(l, state.frame);
    if (!fp) continue;
    pickCtx.save();
    pickCtx.globalAlpha = l.opacity * fp.p.alpha;
    pickCtx.globalCompositeOperation = canvasBlend(l.blend);
    pickCtx.translate(-x, -y);
    if (!isIdentP(fp.p)) pickCtx.transform(...xfMatrix(fp.p, l));
    pickCtx.drawImage(fp.cel, 0, 0);
    pickCtx.restore();
  }
  const d = pickCtx.getImageData(0, 0, 1, 1).data;
  if (d[3] === 0) return null;
  return rgbToHex(d[0], d[1], d[2]);
}

/* Scanline flood fill. Returns {mask, bb} or null when the seed is out of range. */
function floodMask(data, w, h, sx, sy, tolPct) {
  const i0 = (sy * w + sx) * 4;
  const tr = data[i0], tg = data[i0 + 1], tb = data[i0 + 2], ta = data[i0 + 3];
  const tol = tolPct * 2.55;
  const match = i => {
    const j = i * 4;
    return Math.abs(data[j] - tr) <= tol && Math.abs(data[j + 1] - tg) <= tol &&
           Math.abs(data[j + 2] - tb) <= tol && Math.abs(data[j + 3] - ta) <= tol;
  };
  const mask = new Uint8Array(w * h);
  const stack = [sx, sy];
  let bb = { x0: w, y0: h, x1: -1, y1: -1 };
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    let xl = x;
    while (xl >= 0 && !mask[y * w + xl] && match(y * w + xl)) xl--;
    xl++;
    let up = false, down = false;
    let xx = xl;
    while (xx < w && !mask[y * w + xx] && match(y * w + xx)) {
      mask[y * w + xx] = 1;
      if (y > 0) {
        const m = !mask[(y - 1) * w + xx] && match((y - 1) * w + xx);
        if (m && !up) { stack.push(xx, y - 1); up = true; } else if (!m) up = false;
      }
      if (y < h - 1) {
        const m = !mask[(y + 1) * w + xx] && match((y + 1) * w + xx);
        if (m && !down) { stack.push(xx, y + 1); down = true; } else if (!m) down = false;
      }
      xx++;
    }
    if (xx - 1 >= xl) {
      if (xl < bb.x0) bb.x0 = xl;
      if (xx - 1 > bb.x1) bb.x1 = xx - 1;
      if (y < bb.y0) bb.y0 = y;
      if (y > bb.y1) bb.y1 = y;
    }
  }
  return bb.x1 < bb.x0 ? null : { mask, bb };
}

function floodFill(px, py) {
  const layer = canPaint();
  if (!layer) return;
  const t = acquireCel(layer);
  const lm = localMapper(layer);
  const [fx, fy] = lm.map(px, py);
  const w = state.w, h = state.h;
  const sx = Math.floor(fx), sy = Math.floor(fy);
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) { releaseCel(t); return; }

  const fm = state.tool;
  const srcCtx = fm === 'fillref' ? compositeFrame(state.frame, { onlyRef: true }).getContext('2d')
    : fm === 'fillone' ? t.ctx : (state.fillAll || fm === 'fill') ? compositeFrame(state.frame).getContext('2d') : t.ctx;
  const data = srcCtx.getImageData(0, 0, w, h).data;
  const res = floodMask(data, w, h, sx, sy, state.fillTol);
  if (!res) { releaseCel(t); return; }
  const mask = res.mask;
  let bb = res.bb;

  for (let it = 0; it < state.fillGrow; it++) {
    const x0 = Math.max(0, bb.x0 - 1), x1 = Math.min(w - 1, bb.x1 + 1);
    const y0 = Math.max(0, bb.y0 - 1), y1 = Math.min(h - 1, bb.y1 + 1);
    const add = [];
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * w + x;
        if (mask[i]) continue;
        if ((x > 0 && mask[i - 1]) || (x < w - 1 && mask[i + 1]) ||
            (y > 0 && mask[i - w]) || (y < h - 1 && mask[i + w])) add.push(i);
      }
    }
    for (const i of add) mask[i] = 1;
    bb = { x0, y0, x1, y1 };
  }
  if (sel.active && lm.ident) {
    const sd = sel.mask.getContext('2d').getImageData(0, 0, w, h).data;
    for (let y = bb.y0; y <= bb.y1; y++) {
      for (let x = bb.x0; x <= bb.x1; x++) {
        const i = y * w + x;
        if (mask[i] && sd[i * 4 + 3] < 128) mask[i] = 0;
      }
    }
  }

  const b = clampBox(bb.x0, bb.y0, bb.x1 + 1, bb.y1 + 1);
  if (!b) { releaseCel(t); return; }
  const before = crop(t.cel, b);
  const img = t.ctx.getImageData(b.x, b.y, b.w, b.h);
  const [fr, fg, fb] = hexToRgb(state.color);
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if (mask[(b.y + y) * w + (b.x + x)]) {
        const j = (y * b.w + x) * 4;
        img.data[j] = fr; img.data[j + 1] = fg; img.data[j + 2] = fb; img.data[j + 3] = 255;
      }
    }
  }
  t.ctx.putImageData(img, b.x, b.y);
  t.cel._ink = true;
  const after = crop(t.cel, b);
  pushHistory(celEntry(t, b, before, after));
  addRecent(state.color);
  afterEdit();
}

