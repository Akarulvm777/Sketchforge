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
const penCfg = { gamma: 0.8, min: 0, max: 1, palm: true, twoTapUndo: true, penSeen: false, side: 'pick' };
try { Object.assign(penCfg, JSON.parse(localStorage.getItem('sketchforge.pen') || '{}'), { penSeen: false }); } catch (e) { /* ignore */ }
function shapePressure(p) {
  const lo = penCfg.min, hi = Math.max(lo + 0.05, penCfg.max);
  return clamp(Math.pow(clamp((p - lo) / (hi - lo), 0, 1), penCfg.gamma), 0.01, 1);
}
/* Pressure works automatically for every pen that reaches the browser as a pointer: Wacom, XP-Pen, Huion, Gaomon,
   Apple Pencil, Surface/Android styluses. Some drivers (XP-Pen without Windows Ink) report the pen as a 'mouse'
   with real pressure values - those are honoured too once a value other than 0/0.5 has been seen. */
let realPressureSeen = false, penSamples = 0, penFlat = true, penWarned = false;
/* iPad / iPhone Safari: the Apple Pencil's force also comes with the touch events (touchType 'stylus'). When the pointer
   events of the pen carry no usable pressure (0, or always 0.5), that force is used instead. */
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
let stylusForce = -1, stylusAt = 0, stylusVaries = false, stylusLast = -1;
(function () {
  const tf = e => { for (const t of e.changedTouches || []) if (t.touchType === 'stylus' && typeof t.force === 'number') {
    if (stylusLast >= 0 && Math.abs(t.force - stylusLast) > 0.002) stylusVaries = true;
    stylusForce = stylusLast = t.force; stylusAt = performance.now(); } };
  if (typeof window !== 'undefined') for (const ev of ['touchstart', 'touchmove']) window.addEventListener(ev, tf, { passive: true, capture: true });
  // on the canvas, the Pencil must only draw (no magnifier, text selection or double-tap zoom on iPad)
  if (typeof window !== 'undefined') window.addEventListener('touchstart', e => { const t = e.changedTouches && e.changedTouches[0]; if (t && t.touchType === 'stylus' && e.target && e.target.closest && e.target.closest('#viewport')) e.preventDefault(); }, { passive: false });
})();
const stylusPressure = () => (stylusForce > 0 && performance.now() - stylusAt < 120 ? clamp(stylusForce, 0, 1) : null);
/* the pen's raw pressure 0..1: the pointer event's, or the Apple Pencil force from the touch events (iPad Safari) */
function penRaw(e) {
  const raw = e.pressure, sf = stylusPressure();
  if (sf != null && stylusVaries && (!(raw > 0) || Math.abs(raw - 0.5) < 0.001 || penFlat)) { penRaw.src = 'Apple Pencil force'; return sf; }
  penRaw.src = 'pointer'; return raw;
}
function pressureOf(e) {
  const pt = e.pointerType;
  if (pt === 'pen') {
    const raw = penRaw(e);
    penSamples++; if (Math.abs(raw - 0.5) > 0.001 && raw > 0) { penFlat = false; realPressureSeen = true; }
    if (!penWarned && penSamples > 40 && penFlat) {
      penWarned = true;
      toast(IS_IOS ? 'Your Apple Pencil sends no pressure here: open Sketchforge in Safari (not inside another app), update iPadOS, and turn off Settings › Apple Pencil › Scribble. Test it: View › Pen pressure & touch.'
        : 'Your pen sends no pressure data: turn on Windows Ink in your tablet driver (Wacom, XP-Pen, Huion…), then restart. Help: View › Pen pressure & touch.', 8000);
    }
    return shapePressure(raw > 0 ? Math.max(raw, 0.03) : 0.03);
  }
  if (pt === 'mouse' && e.buttons && e.pressure > 0 && Math.abs(e.pressure - 0.5) > 0.001) realPressureSeen = true;
  if (realPressureSeen && pt === 'mouse' && e.pressure > 0) return shapePressure(e.pressure);
  if (pt === 'touch' && e.pressure > 0 && e.pressure !== 0.5 && e.pressure !== 1 && penCfg.penSeen === false && e.force !== undefined) return shapePressure(e.pressure);
  return 1;
}
/* a tool's own pressure curve (imported Clip Studio tools): points [x, y] from 0 to 1, straight lines in between */
function prCurve(c, p) {
  if (!c || c.length < 2) return p;
  if (p <= c[0][0]) return c[0][1];
  for (let i = 1; i < c.length; i++) if (p <= c[i][0]) { const a = c[i - 1], b = c[i], w = b[0] - a[0]; return w > 1e-6 ? a[1] + (b[1] - a[1]) * (p - a[0]) / w : b[1]; }
  return c[c.length - 1][1];
}
function diameterAt(st, pr) {
  const s = st.s;
  let d = s.size * ((s.pSize || s.speed > 0) ? lerp(s.pMin ?? 0.12, 1, prCurve(s.pCurve, pr)) : 1) *
    (s.taperIn ? lerp(s.taperRatio, 1, clamp((st.travel || 0) / s.taperIn, 0, 1)) : 1);
  // imported tools: pen tilt and drawing speed through their own curves, thin end of the stroke
  if (s.tCurve && st.tilt != null) d *= lerp(s.tMin ?? 0, 1, prCurve(s.tCurve, st.tilt));
  if (s.vCurve && st.vel != null) d *= lerp(s.vMin ?? 0, 1, prCurve(s.vCurve, st.vel));
  if (st.outK != null && s.taperOut) d *= lerp(s.taperOutRatio ?? 0, 1, st.outK);
  return Math.max(s.min1 ? 1 : 0.5, d);
}
/* pen tilt: 0 = upright, 1 = flat on the tablet (null without a pen) */
function tiltOf(e) {
  if (e.pointerType !== 'pen') return null;
  if (typeof e.altitudeAngle === 'number' && e.altitudeAngle > 0 && e.altitudeAngle < Math.PI / 2 + 0.01) return clamp(1 - e.altitudeAngle / (Math.PI / 2), 0, 1);
  if (e.tiltX || e.tiltY) return clamp(Math.max(Math.abs(e.tiltX || 0), Math.abs(e.tiltY || 0)) / 90, 0, 1);
  return null;
}
/* hue / saturation / brightness change per dab (imported tools), in steps so the tinted tips stay cached */
function colourJitter(hex, s) {
  if (!s.hueJit && !s.satJit && !s.valJit) return hex;
  let col = s.hueJit ? hueShift(hex, Math.round((Math.random() - 0.5) * 2 * s.hueJit * 12) * 15) : hex;
  if (s.satJit || s.valJit) {
    const n = parseInt(col.slice(1), 16); let r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
    const L = (r + g + b) / 3, ks = 1 - Math.round(Math.random() * 4) / 4 * (s.satJit || 0), kv = 1 + Math.round((Math.random() - 0.5) * 8) / 4 * (s.valJit || 0);
    const f = c => clamp(Math.round((L + (c - L) * ks) * kv), 0, 255);
    col = '#' + ((1 << 24) | (f(r) << 16) | (f(g) << 8) | f(b)).toString(16).slice(1);
  }
  return col;
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
  const ink = st.erase ? '#000000' : colourJitter(st.color, s);
  if (s.shape) { drawShapeTip(ctx, s.shape, cx, cy, d, st.erase ? '#000' : st.color); return; }
  if (s.tipId && customTips.has(s.tipId)) {
    // decoration brushes: several tip images (random or one after the other), full-colour tips keep their colours,
    // colour jitter shifts the hue a little per dab (in 24 steps, so the tinted tips stay cached)
    let tid = s.tipId;
    if (s.tipIds && s.tipIds.length > 1) tid = s.tipOrder === 'seq' ? s.tipIds[st.tipSeq = ((st.tipSeq ?? -1) + 1) % s.tipIds.length] : s.tipIds[Math.floor(Math.random() * s.tipIds.length)];
    if (!customTips.has(tid)) tid = s.tipId;
    const raw = customTips.get(tid);
    const col = ink;
    const tip = raw._colour && !st.erase ? raw : tintedTip(tid, col);
    ctx.save();
    ctx.translate(cx, cy);
    // fixed angle, random turn (all the way or a little), following the stroke direction, squashed tip (thickness)
    let ang = -(s.tipAngle || 0) * (s.rotP ? (st.lastPr ?? 1) : 1) * DEG;
    if (s.tipRot) ang += (Math.random() - 0.5) * 2 * Math.PI * (s.tipRotAmt ?? 1);
    if (s.tipFollow && st.dir != null) ang += st.dir;
    if (ang) ctx.rotate(ang);
    if (s.tipThick && s.tipThick !== 1) ctx.scale(1, s.tipThick);
    ctx.drawImage(tip, -d / 2, -d / 2, d, d);
    ctx.restore();
  } else if (s.hardness >= 0.97 && !s.nib && !(s.nibRatio < 1)) { // plain round pen: no save / restore per dab
    ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, Math.PI * 2); ctx.fill();
  } else if (s.hardness >= 0.97) {
    ctx.save();
    ctx.fillStyle = ink;
    ctx.beginPath();
    if (s.nib) { ctx.translate(cx, cy); ctx.rotate(-s.nib * DEG); ctx.scale(1, 0.28); ctx.arc(0, 0, d / 2, 0, Math.PI * 2); }
    else if (s.nibRatio < 1) { ctx.translate(cx, cy); ctx.rotate(-s.nibAngle * DEG); ctx.scale(1, s.nibRatio); ctx.arc(0, 0, d / 2, 0, Math.PI * 2); }
    else ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (s.nibRatio < 1) {
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(-s.nibAngle * DEG); ctx.scale(1, s.nibRatio);
    ctx.drawImage(getTip(ink, s.hardness), -d / 2, -d / 2, d, d);
    ctx.restore();
  } else {
    ctx.drawImage(getTip(ink, s.hardness), cx - d / 2, cy - d / 2, d, d);
  }
}
function hueShift(hex, deg) { // rotate the hue of a #rrggbb colour
  if (!deg) return hex;
  const n = parseInt(hex.slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return hex;
  const sat = d / (1 - Math.abs(2 * l - 1)); let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = ((h * 60 + deg) % 360 + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * sat, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [R, G, B] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [R, G, B].map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
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
      v[y * N + x] = 0.25 + wv * 0.6 + rnd() * 0.15; // weave tops take paint, gaps stay lighter
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
  } else if (!(typeof toneTexture === 'function' && toneTexture(id, v, N))) { for (let i = 0; i < v.length; i++) v[i] = rnd(); } // manga tones: p10wb_manga
  c = makeCanvas(N, N);
  const g = c.getContext('2d'), im = g.createImageData(N, N);
  for (let i = 0; i < v.length; i++) { im.data[i * 4 + 3] = clamp(v[i], 0, 1) * 255; }
  g.putImageData(im, 0, 0);
  c._vals = v;
  texBase.set(id, c);
  return c;
}
/* An image as a paper texture (imported brushes): darker = more paint, unless invert. */
function registerTexture(id, img, invert) {
  const N = TEX_N, c = makeCanvas(N, N), g = c.getContext('2d');
  g.drawImage(img, 0, 0, N, N);
  const d = g.getImageData(0, 0, N, N).data, v = new Float32Array(N * N);
  for (let i = 0; i < v.length; i++) {
    const a = d[i * 4 + 3] / 255, L = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255 * a + (1 - a);
    v[i] = invert ? L : 1 - L;
  }
  const out = makeCanvas(N, N), og = out.getContext('2d'), im = og.createImageData(N, N);
  for (let i = 0; i < v.length; i++) im.data[i * 4 + 3] = v[i] * 255;
  og.putImageData(im, 0, 0); out._vals = v;
  texBase.set(id, out);
  for (const k of [...texAmtCache.keys()]) if (k.startsWith(id)) texAmtCache.delete(k);
  return id;
}
/* hard-edged texture for erasers: a spot is either fully erased or left alone (more strength = more erased) */
function texHardFor(id, amt) {
  amt = Math.round(clamp(amt, 0, 1) * 20) / 20;
  const key = id + 'hard' + amt;
  let c = texAmtCache.get(key);
  if (c) return c;
  const v = texBaseFor(id)._vals, N = TEX_N, th = 0.6 - 0.4 * amt;
  c = makeCanvas(N, N);
  const g = c.getContext('2d'), im = g.createImageData(N, N);
  for (let i = 0; i < v.length; i++) im.data[i * 4 + 3] = clamp((v[i] - th) / 0.08 + 0.5, 0, 1) * 255;
  g.putImageData(im, 0, 0);
  texAmtCache.set(key, c);
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
  if (!s.tex || st.tex) { const ga = ctx.globalAlpha; ctx.globalAlpha = a; paintTip(ctx, st, x, y, d); ctx.globalAlpha = ga; return; } // st.tex: texture is applied to the whole stroke (texSync)
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
/* thin end (imported tools): the last taperOut px of the stroke wait in a queue; when the pen lifts they are drawn thinner and thinner */
function stampAt(st, x, y, pr) {
  if (st.tq && !st.snapped) {
    st.tq.push([x, y, pr, st.travel || 0]);
    const lim = (st.travel || 0) - st.s.taperOut, keep = st.travel;
    while (st.tq.length && st.tq[0][3] < lim) { const q = st.tq.shift(); st.travel = q[3]; stampNow(st, q[0], q[1], q[2]); }
    st.travel = keep;
    return;
  }
  stampNow(st, x, y, pr);
}
function flushTaper(st) {
  if (!st.tq) return;
  const q = st.tq, end = st.travel || 0, keep = st.travel; st.tq = null;
  for (const p of q) { st.outK = end < 1 ? 1 : clamp((end - p[3]) / st.s.taperOut, 0, 1); st.travel = p[3]; stampNow(st, p[0], p[1], p[2]); }
  st.outK = null; st.travel = keep;
}
function stampNow(st, x, y, pr) {
  stampAt1(st, x, y, pr);
  if (!st.sym) return;
  // Each copy is drawn through its mirror / rotation matrix, so tips, nib angles and textures mirror exactly.
  for (const m of st.sym) {
    const [qx, qy] = applyMat(m, x, y);
    if (st.direct) { stampAt1(st, qx, qy, pr); continue; } // smudge / blend read pixels, so they work on points
    st.ctx.save(); st.ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    stampAt1(st, x, y, pr);
    st.ctx.restore();
    growBox(st, qx, qy, diameterAt(st, pr) * (1 + 2 * (st.s.scatter || 0)));
  }
}
function stampAt1(st, x, y, pr) {
  const s = st.s;
  if (st.direct) { smudgeStamp(st, x, y, pr); return; }
  const d = diameterAt(st, pr);
  let a = clamp(s.flow * (s.pAlpha ? lerp(s.aMin ?? 0.1, 1, prCurve(s.aCurve, pr)) : 1) * (s.grain ? 1 - s.grain * Math.random() : 1), 0, 1);
  if (s.fadeIn && s.taperIn) a *= clamp((st.travel || 0) / s.taperIn, 0.05, 1);
  if (s.fadeOut && st.outK != null) a *= Math.max(0.05, st.outK);
  if (s.aRand != null) a *= lerp(s.aRand, 1, Math.random());
  if (s.atCurve && st.tilt != null) a *= lerp(s.atMin ?? 0, 1, prCurve(s.atCurve, st.tilt));
  if (s.avCurve && st.vel != null) a *= lerp(s.avMin ?? 0, 1, prCurve(s.avCurve, st.vel));
  if (s.flowSp) a = 1 - Math.pow(1 - a, clamp((s.spacing || 0.1) / 0.1, 0.05, 1)); // dense spacing: less ink per dab, same look
  st.lastPr = pr;
  const n = s.count || 1, sc = s.scatter || 0;
  if (st.dlx != null) { const dx = x - st.dlx, dy = y - st.dly; if (dx * dx + dy * dy > 0.25) st.dir = Math.atan2(dy, dx); }
  st.dlx = x; st.dly = y;
  for (let i = 0; i < n; i++) {
    let px = x, py = y, dd = d;
    // spray bias (imported tools): -1 = particles at the rim, 0 = even, +1 = towards the middle
    if (sc) { const ang = Math.random() * Math.PI * 2, r = Math.pow(Math.random(), s.sprayBias ? clamp(0.5 + 0.5 * s.sprayBias, 0.02, 1.5) : 0.5) * sc * d; px += Math.cos(ang) * r; py += Math.sin(ang) * r; }
    if (s.jitter) dd = Math.max(1, d * (1 - s.jitter * Math.random() * 0.9));
    if (s.sRand != null) dd = Math.max(s.min1 ? 1 : 0.5, d * lerp(s.sRand, 1, Math.random()));
    if ((sc || s.jitter) && !s.sprayFix) dd *= (s.shape || n > 1) ? 0.35 + 0.65 * (s.shape ? 1 : 0.5) : 1;
    drawOne(st, px, py, dd, a);
  }
  growBox(st, x, y, d * (1 + 2 * sc));
}
/* watercolour wet edge: pigment pools at the rim, centre goes lighter */
function applyWet(st, b) {
  const level = st.s.wet;
  const reg = makeCanvas(b.w, b.h);
  reg.getContext('2d').drawImage(bufCanvas, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
  // the edge only needs a soft copy of the stroke: blur a smaller copy (blurring big strokes at full size froze iPads)
  const sig = Math.max(1.5, st.s.size * 0.09), f = clamp(sig / 1.5, 1, 8);
  const sw = Math.max(1, Math.round(b.w / f)), sh = Math.max(1, Math.round(b.h / f)), small = makeCanvas(sw, sh), sg = small.getContext('2d');
  sg.imageSmoothingQuality = 'high'; sg.drawImage(reg, 0, 0, sw, sh);
  gaussianBlur(small, sig / f);
  const bl = makeCanvas(b.w, b.h), blg = bl.getContext('2d');
  blg.imageSmoothingQuality = 'high'; blg.drawImage(small, 0, 0, b.w, b.h);
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
  bufCtx.drawImage(rawCanvas, b.x, b.y, b.w, b.h, b.x, b.y, b.w, b.h);
  bufCtx.globalCompositeOperation = 'destination-in';
  bufCtx.drawImage(clip, b.x, b.y, b.w, b.h, b.x, b.y, b.w, b.h);
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
  g.drawImage(snapCanvas, b.x, b.y, b.w, b.h, b.x, b.y, b.w, b.h);
  let src = bufCanvas;
  if (st.clip) {
    tmpCtx.save();
    tmpCtx.beginPath(); tmpCtx.rect(b.x, b.y, b.w, b.h); tmpCtx.clip();
    tmpCtx.globalCompositeOperation = 'source-over';
    tmpCtx.clearRect(b.x, b.y, b.w, b.h);
    tmpCtx.drawImage(bufCanvas, b.x, b.y, b.w, b.h, b.x, b.y, b.w, b.h);
    tmpCtx.globalCompositeOperation = 'destination-in';
    tmpCtx.drawImage(st.clip, b.x, b.y, b.w, b.h, b.x, b.y, b.w, b.h);
    tmpCtx.restore();
    src = tmpCanvas;
  }
  g.globalCompositeOperation = 'destination-out';
  g.globalAlpha = st.s.opacity;
  g.drawImage(src, b.x, b.y, b.w, b.h, b.x, b.y, b.w, b.h);
  g.restore();
}
function afterMove(st) {
  const m = st.mbox;
  st.mbox = newBox();
  if (!st.clip && !st.erase && !st.tex) return;
  const b = clampBox(m.x0, m.y0, m.x1, m.y1);
  if (!b) return;
  if (st.tex) texSync(st, b);
  if (st.erase) eraseRegion(st, b); else if (!st.tex) clipSync(st.clip, b);
}
/* Paper texture on the whole stroke: visible stroke = raw stroke × texture (× selection), for region b.
   Applying it per dab made overlapping dabs fill the grain in, so textures washed out to solid. */
function texSync(st, b) {
  const s = st.s;
  if (!st.texPat) {
    const amt = s.texAmt == null ? 0.6 : s.texAmt;
    st.texPat = bufCtx.createPattern(st.erase ? texHardFor(s.tex, amt) : texFor(s.tex, amt), 'repeat');
    const k = s.texScale || 1;
    if (st.texPat.setTransform) st.texPat.setTransform(s.texRot ? new DOMMatrix().rotateSelf(s.texRot).scaleSelf(k, k) : new DOMMatrix([k, 0, 0, k, 0, 0]));
  }
  bufCtx.save();
  bufCtx.beginPath(); bufCtx.rect(b.x, b.y, b.w, b.h); bufCtx.clip();
  bufCtx.globalCompositeOperation = 'source-over';
  bufCtx.clearRect(b.x, b.y, b.w, b.h);
  bufCtx.drawImage(rawCanvas, b.x, b.y, b.w, b.h, b.x, b.y, b.w, b.h);
  bufCtx.globalCompositeOperation = 'destination-in';
  bufCtx.fillStyle = st.texPat; bufCtx.fillRect(b.x, b.y, b.w, b.h);
  if (st.clip && !st.erase) bufCtx.drawImage(st.clip, b.x, b.y, b.w, b.h, b.x, b.y, b.w, b.h);
  bufCtx.restore();
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
  { const c = prev.x1 > prev.x0 ? clampBox(prev.x0 - 4, prev.y0 - 4, prev.x1 + 4, prev.y1 + 4) : null; if (c) st.ctx.clearRect(c.x, c.y, c.w, c.h); }
  st.box = drawShape(st.ctx, st);
  if (st.sym) for (const m of st.sym) {
    st.ctx.save(); st.ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    const b = drawShape(st.ctx, st);
    st.ctx.restore();
    for (const [x, y] of [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]].map(p => applyMat(m, p[0], p[1]))) {
      st.box.x0 = Math.min(st.box.x0, x); st.box.y0 = Math.min(st.box.y0, y); st.box.x1 = Math.max(st.box.x1, x); st.box.y1 = Math.max(st.box.y1, y);
    }
  }
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
  if (layer.vref) { toast('This is a video reference layer — draw on another layer'); return null; }
  if (layer.locked) { toast('Layer is locked'); return null; }
  if (layer.maskEdit && layer.mask) { bindLayer(layer.mask, state.frame); return layer.mask; }
  return layer;
}
/* Position / style the preview canvas to sit exactly where the layer will be. */
function prepBuffer(layer, p, opacity, hide) {
  const s = bufCanvas.style;
  s.opacity = hide ? '0' : String(opacity * layer.opacity * (p ? p.alpha : 1));
  s.mixBlendMode = cssBlend(layer.blend);
  s.transform = p ? xfCss(p, layer) : 'none';
  s.zIndex = layerZ(layer) + 1;
}
/* Returns {ident, map(x,y)} mapping document points to the layer's own pixels. */
function localMapper(layer) {
  const fp = frameParams(layer, state.frame);
  const fwd = fp ? layerMat(layer, state.frame) : null;
  if (!fwd) return { fp, ident: true, fwd: null, map: (x, y) => [x, y] };
  const inv = invMat(fwd);
  return { fp, ident: false, fwd, map: inv ? (x, y) => applyMat(inv, x, y) : (x, y) => [x, y] };
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
  const isShape = def.kind === 'shape';
  const erase = !!def.erase;
  const direct = TOOLDEF[tool].preset && TOOLDEF[tool].preset.smudge != null;
  // a copy of the whole picture is only needed when the stroke changes the layer while drawing (eraser, blend / mixing);
  // normal strokes draw into the buffer and keep "before" from the stroke's area only (copying 12+ MP per stroke lagged)
  docSize(snapCanvas, erase || direct);
  if (erase || direct) { snapCtx.globalCompositeOperation = 'copy'; snapCtx.drawImage(t.cel, 0, 0); snapCtx.globalCompositeOperation = 'source-over'; }
  const clip = (sel.active && lm.ident && !direct) ? sel.mask : null;
  const s = { ...curSettings() };
  if (typeof paperGrain === 'function') paperGrain(s, erase, direct, isShape); // the paper's grain for brushes without a texture
  docSize(rawCanvas, (clip && !erase) || (s.tex && !direct)); docSize(tmpCanvas, !!clip); // helpers this stroke needs (see docSize)
  if (!bufClean) { bufCtx.clearRect(0, 0, state.w, state.h); rawCtx.clearRect(0, 0, state.w, state.h); }
  bufClean = false;
  stroke = {
    kind: tool, t, isShape, erase, direct, s, color: layer.isMask ? '#ff2a2a' : state.color, map: lm.map, clip,
    ctx: ((clip && !erase) || (s.tex && !direct)) ? rawCtx : bufCtx,
    tex: !!(s.tex && !direct && !isShape),
    box: newBox(), mbox: newBox(),
    sx: x0, sy: y0, sp: pr, rx: x0, ry: y0, rp: pr,
    lx: x0, ly: y0, lp: pr, next: 0,
    startX: x0, startY: y0, cx: x0, cy: y0, shift: e.shiftKey,
    pointerId: e.pointerId, rlock,
    sym: symOn() ? symLocal(lm.fwd) : null,
    // Wacom / Huion on Windows (and others) report pressure 0 on the first sample: wait for a real value
    waitPr: e.pointerType === 'pen' && !(e.pressure > 0) && !isShape,
    tilt: tiltOf(e), tq: s.taperOut && !isShape && !erase ? [] : null
  };
  prepBuffer(layer, lm.fp && lm.fp.p, s.opacity, erase || direct);
  if (s.blendOp && !erase && !direct && (!layer.blend || layer.blend === 'normal')) bufCanvas.style.mixBlendMode = s.blendOp === 'lighter' ? 'plus-lighter' : s.blendOp;
  if (layer.isMask) { Object.assign(bufCanvas.style, { opacity: erase ? '0' : '0.5', zIndex: 9999, mixBlendMode: 'normal', transform: 'none' }); }
  if (!isShape && !stroke.waitPr) {
    stampAt(stroke, x0, y0, pr);
    stroke.next = stepAt(stroke, pr);
    afterMove(stroke);
  }
  if (typeof holdBegin === 'function') holdBegin(stroke, e); // hold: eyedropper at the start, QuickShape at the end (p10tb)
}
/* first real pressure of a pen stroke that started with pressure 0 */
function startDeferred(st, pr) {
  st.waitPr = false;
  st.sp = st.lp = st.rp = pr;
  stampAt(st, st.lx, st.ly, pr);
  st.next = stepAt(st, pr);
}

function moveStroke(e) {
  const st = stroke;
  if (st.snapped) return; // QuickShape replaced the stroke: keep the shape until the pen lifts
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
  const list = evs.length ? evs : [e];
  for (const ev of list) {
    const d = rulerApply(st.rlock, toDoc(ev));
    const [x, y] = st.map(d.x, d.y);
    let pr = pressureOf(ev.pointerType === 'pen' && ev !== e && !(ev.pressure > 0) && e.pressure > 0 ? e : ev); // Safari: in-between samples can come without pressure
    if (st.waitPr) {
      if (!(ev.pressure > 0)) { (st.waitPts || (st.waitPts = [])).push([x, y]); continue; } // keep the first points: drawn once pressure comes
      startDeferred(st, pr);
      if (st.waitPts) { for (const [wx, wy] of st.waitPts) { if (st.qs) qsRecord(st, wx, wy, pr, ev); curveTo(st, wx, wy, pr); } st.waitPts = null; }
    }
    st.tilt = tiltOf(ev);
    if ((st.s.vCurve || st.s.avCurve) && !st.isShape) {
      const dt = Math.max(1, ev.timeStamp - (st.lt2 || ev.timeStamp - 8));
      st.vraw = (st.vraw || 0) * 0.7 + Math.hypot(x - st.rx, y - st.ry) / dt * 0.3; st.lt2 = ev.timeStamp;
      st.vel = clamp(st.vraw / 3, 0, 1);
    }
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
    if (st.qs) qsRecord(st, x, y, pr, ev);
    curveTo(st, x, y, pr); // curve through the real points, then the stabiliser on the dense curve (emitPoint)
  }
  if (st.isShape) drawShapePreview(st); else afterMove(st);
}

/* The stroke buffers are as big as the document (12+ megapixels on big pages): clearing them whole on every stroke
   was a large part of the lag on phones. Only the area the stroke used is cleared; bufClean says they are empty. */
let bufClean = true; // the buffers start empty (and are emptied whenever the page size changes)
/* Smooth curves through the input points (Catmull-Rom). When the device is busy, touch points arrive far apart and
   joining them with straight lines turned circles into polygons; the curve passes through every point instead.
   The curve runs one point behind the finger; curveEnd() draws the last piece. Ruler strokes stay straight. */
/* stabiliser: each curve point is pulled towards the input; dense curve points keep the lag even however
   sparse the input is (applied to sparse points it shrank circles) */
function emitPoint(st, x, y, pr) {
  const k = 1 - st.s.smooth * 0.92;
  st.sx += (x - st.sx) * k;
  st.sy += (y - st.sy) * k;
  st.sp += (pr - st.sp) * Math.max(k, 0.3);
  segment(st, st.sx, st.sy, st.sp);
}
/* The curve keeps one point of look-ahead only when the pen moves fast (sparse points, where joining them with straight
   lines made polygons). Slow, light strokes have dense points: those are drawn right up to the pen at once, otherwise
   the line trailed one point behind the tip (felt like lag at low pressure). */
function curveTo(st, x, y, pr) {
  if (st.rlock) { emitPoint(st, x, y, pr); return; }
  const P = st.cr || (st.cr = [[st.sx, st.sy, st.sp]], st.crAt = 0, st.cr);
  const last = P[P.length - 1], gap = Math.hypot(x - last[0], y - last[1]) * view.scale;
  if (gap < 0.35) { if (st.crAt < P.length - 1) P[P.length - 1] = [x, y, pr]; else last[2] = pr; return; } // sensor noise
  P.push([x, y, pr]);
  const n = P.length, upTo = gap < 5 ? n - 1 : n - 2; // slow: draw to the newest point; fast: keep one point to curve towards
  for (let i = st.crAt; i < upTo; i++) crSegment(st, P[Math.max(0, i - 1)], P[i], P[i + 1], P[Math.min(n - 1, i + 2)]);
  st.crAt = Math.max(st.crAt, upTo);
  if (n > 5) { const cut = Math.min(n - 4, st.crAt - 1); if (cut > 0) { P.splice(0, cut); st.crAt -= cut; } }
}
function curveEnd(st) {
  const P = st.cr; st.cr = null;
  if (!P) return;
  const n = P.length;
  for (let i = st.crAt || 0; i < n - 1; i++) crSegment(st, P[Math.max(0, i - 1)], P[i], P[i + 1], P[Math.min(n - 1, i + 2)]);
}
function crSegment(st, p0, p1, p2, p3) {
  const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), steps = Math.min(48, Math.ceil(len * view.scale / 3));
  if (steps <= 1) { emitPoint(st, p2[0], p2[1], p2[2]); return; }
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, t2 = t * t, t3 = t2 * t;
    const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
    emitPoint(st, f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), p1[2] + (p2[2] - p1[2]) * t);
  }
}
function clearBuffers(st) {
  const b = st && st.box && st.box.x1 > st.box.x0 ? clampBox(st.box.x0 - 4, st.box.y0 - 4, st.box.x1 + 4, st.box.y1 + 4) : null;
  if (st && st.box && !(st.box.x1 > st.box.x0)) { bufClean = true; return; } // nothing was drawn
  if (b) { bufCtx.clearRect(b.x, b.y, b.w, b.h); rawCtx.clearRect(b.x, b.y, b.w, b.h); }
  else if (!st || st.box) { bufCtx.clearRect(0, 0, state.w, state.h); rawCtx.clearRect(0, 0, state.w, state.h); }
  bufClean = true;
}

function endStroke(cancel) {
  const st = stroke;
  if (!st) return;
  stroke = null;
  const t = st.t;
  if (typeof holdCancel === 'function') holdCancel(st);

  if (cancel) {
    if (st.erase || st.direct) {
      t.ctx.save();
      t.ctx.globalCompositeOperation = 'copy';
      t.ctx.drawImage(snapCanvas, 0, 0);
      t.ctx.restore();
    }
    clearBuffers(st);
    releaseCel(t);
    return;
  }

  if (st.waitPr) { startDeferred(st, shapePressure(0.35)); afterMove(st); } // a tap that never reported pressure
  if (st.isShape) {
    drawShapePreview(st);
  } else if (!st.snapped) {
    curveEnd(st);
    if (st.s.smooth > 0) segment(st, st.rx, st.ry, st.rp); // the stabiliser catches up with the pen
    flushTaper(st);
    afterMove(st);
  }
  if (st.tq) { flushTaper(st); afterMove(st); }

  const b = clampBox(st.box.x0, st.box.y0, st.box.x1, st.box.y1);
  if (!b) {
    clearBuffers(st);
    releaseCel(t);
    return;
  }

  if (st.direct) { finishDirect(st, b); return; }
  if (!st.erase && !st.isShape) applyAA(st.s.aa, b);
  if (st.s.wet && !st.erase && !st.isShape) applyWet(st, b);
  const beforeNormal = st.erase ? null : crop(t.cel, b); // the stroke's area before it is committed
  if (!st.erase) {
    t.ctx.save();
    t.ctx.globalAlpha = st.s.opacity;
    t.ctx.globalCompositeOperation = t.layer.alock ? 'source-atop' : (st.s.blendOp || 'source-over'); // a tool's own blending mode (multiply…)
    t.ctx.drawImage(bufCanvas, b.x, b.y, b.w, b.h, b.x, b.y, b.w, b.h);
    t.ctx.restore();
    t.cel._ink = true;
    if (!t.layer.isMask) addRecent(st.color);
  }
  clearBuffers(st);

  const before = beforeNormal || crop(snapCanvas, b);
  const after = crop(t.cel, b);
  pushHistory(celEntry(t, b, before, after));
  afterEdit();
}
/* anti-aliasing levels: 0 none, 1 weak, 2 normal, 3 strong */
function applyAA(level, b) {
  if (level === 2 || level === undefined) return;
  if (level === 3) {
    // blur only the stroke's area (+2 px), in a canvas of that size (a whole-page blur per stroke lagged big pages)
    const x = Math.max(0, b.x - 2), y = Math.max(0, b.y - 2), w = Math.min(state.w, b.x + b.w + 2) - x, h = Math.min(state.h, b.y + b.h + 2) - y;
    if (w <= 0 || h <= 0) return;
    const c = makeCanvas(w, h), g = c.getContext('2d');
    g.filter = 'blur(0.7px)'; g.drawImage(bufCanvas, x, y, w, h, 0, 0, w, h); g.filter = 'none';
    bufCtx.clearRect(b.x, b.y, b.w, b.h);
    bufCtx.drawImage(c, b.x - x, b.y - y, b.w, b.h, b.x, b.y, b.w, b.h);
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
  // opts.scale < 1: a smaller picture (time-lapse, previews) — much less work than full size then shrinking
  const k = opts.scale && opts.scale < 1 ? opts.scale : 1;
  const c = makeCanvas(Math.max(1, Math.round(state.w * k)), Math.max(1, Math.round(state.h * k)));
  const g = c.getContext('2d');
  if (k !== 1) g.scale(k, k);
  state.layers.forEach((l, i) => {
    if (opts.until != null && i >= opts.until) return; // only the layers below (custom blend views)
    if (!l.visible || (opts.skipPaper && l.paper)) return;
    if (l.vref) { if (opts.all) { g.save(); g.globalAlpha = l.opacity; g.drawImage(l.vref.canvas, 0, 0); g.restore(); } return; } // video reference: never exported
    if (opts.onlyRef ? !l.ref : ((l.draft || l.ref) && !opts.all && !opts.view)) return;
    const fp = frameParams(l, f);
    if (!fp) return;
    if (isCustomBlend(l.blend)) { // blended pixel by pixel (the browser has no such mode)
      const lc = makeCanvas(c.width, c.height), lg = lc.getContext('2d');
      lg.setTransform(g.getTransform()); lg.drawImage(layerPixels(l, i, f, fp, l.opacity * fp.p.alpha * (opts.view && l.draft ? 0.45 : 1)), 0, 0);
      blendCustom(g, lc, l.blend);
      return;
    }
    g.save();
    g.globalAlpha = l.opacity * fp.p.alpha;
    g.globalCompositeOperation = canvasBlend(l.blend);
    const base = l.clip ? clipBaseOf(i) : null;
    if (base || l.mask) {
      const lc = makeCanvas(state.w, state.h);
      drawLayerOwn.frame = f; drawLayerOwn(lc.getContext('2d'), l, fp); drawLayerOwn.frame = undefined;
      if (base) clipToBase(lc, base, f);
      g.drawImage(lc, 0, 0, state.w, state.h);
    } else {
      { const m = layerMat(l, f); if (m) g.transform(...m); }
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
    if (l.vref) { pickCtx.save(); pickCtx.globalAlpha = l.opacity; pickCtx.drawImage(l.vref.canvas, -x, -y); pickCtx.restore(); continue; } // pick colours from the video
    const fp = frameParams(l, state.frame);
    if (!fp) continue;
    if (isCustomBlend(l.blend)) { // the same blend as on screen, for this one pixel
      const t = makeCanvas(pickCtx.canvas.width, pickCtx.canvas.height), tg = t.getContext('2d');
      tg.globalAlpha = l.opacity * fp.p.alpha; tg.translate(-x, -y); { const m = layerMat(l, state.frame); if (m) tg.transform(...m); } tg.drawImage(fp.cel, 0, 0);
      blendCustom(pickCtx, t, l.blend); continue;
    }
    pickCtx.save();
    pickCtx.globalAlpha = l.opacity * fp.p.alpha;
    pickCtx.globalCompositeOperation = canvasBlend(l.blend);
    pickCtx.translate(-x, -y);
    { const m = layerMat(l, state.frame); if (m) pickCtx.transform(...m); }
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

