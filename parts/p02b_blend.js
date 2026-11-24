/* ---------- Layer blending modes (the full list, in the usual painting-app order) ----------
   The browser blends the native ones itself (CSS mix-blend-mode on screen, globalCompositeOperation for exports).
   The others (linear burn, subtract, glow dodge, add, add (glow), vivid / linear / pin light, hard mix, darker /
   lighter colour, divide) are blended here pixel by pixel: on screen through a baked view of the layer over what is
   below it (refreshStage → customBlendView), and in compositeFrame (exports, thumbnails), merge down and the eyedropper. */
const NATIVE_BLEND = new Set(['normal', 'darken', 'multiply', 'color-burn', 'lighten', 'screen', 'color-dodge', 'overlay', 'soft-light', 'hard-light',
  'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity']);
const BLEND_LABEL = { normal: 'Normal', darken: 'Darken', multiply: 'Multiply', 'color-burn': 'Color burn', 'linear-burn': 'Linear burn', subtract: 'Subtract',
  lighten: 'Lighten', screen: 'Screen', 'color-dodge': 'Color dodge', 'glow-dodge': 'Glow dodge', add: 'Add', 'add-glow': 'Add (Glow)', overlay: 'Overlay',
  'soft-light': 'Soft light', 'hard-light': 'Hard light', difference: 'Difference', 'vivid-light': 'Vivid light', 'linear-light': 'Linear light',
  'pin-light': 'Pin light', 'hard-mix': 'Hard mix', exclusion: 'Exclusion', 'darker-color': 'Darker color', 'lighter-color': 'Lighter color', divide: 'Divide',
  hue: 'Hue', saturation: 'Saturation', color: 'Color', luminosity: 'Brightness' };
const isCustomBlend = b => !!b && !NATIVE_BLEND.has(b);
/* the closest native mode, for the live stroke preview on a layer with a custom mode */
const CSS_BLEND_NEAR = { 'linear-burn': 'color-burn', subtract: 'difference', 'darker-color': 'darken', 'glow-dodge': 'color-dodge', add: 'plus-lighter', 'add-glow': 'plus-lighter',
  'vivid-light': 'hard-light', 'linear-light': 'hard-light', 'pin-light': 'hard-light', 'hard-mix': 'hard-light', 'lighter-color': 'lighten', divide: 'color-dodge' };
const cssBlend = b => (isCustomBlend(b) ? CSS_BLEND_NEAR[b] || 'normal' : b || 'normal');
const _burn = (b, s) => (b >= 1 ? 1 : s <= 0 ? 0 : 1 - Math.min(1, (1 - b) / s));
const _dodge = (b, s) => (b <= 0 ? 0 : s >= 1 ? 1 : Math.min(1, b / (1 - s)));
/* separable custom modes: backdrop b, source s, both 0..1 */
const BLEND_FN = {
  'linear-burn': (b, s) => Math.max(0, b + s - 1),
  subtract: (b, s) => Math.max(0, b - s),
  add: (b, s) => Math.min(1, b + s),
  'add-glow': (b, s) => Math.min(1, b + s),
  'glow-dodge': _dodge,
  'vivid-light': (b, s) => (s <= 0.5 ? _burn(b, 2 * s) : _dodge(b, 2 * s - 1)),
  'linear-light': (b, s) => Math.min(1, Math.max(0, b + 2 * s - 1)),
  'pin-light': (b, s) => (s <= 0.5 ? Math.min(b, 2 * s) : Math.max(b, 2 * s - 1)),
  'hard-mix': (b, s) => (b + s >= 1 ? 1 : 0),
  divide: (b, s) => (s <= 0 ? (b > 0 ? 1 : 0) : Math.min(1, b / s))
};
const GLOW_BLEND = new Set(['glow-dodge', 'add-glow']); // the source's transparency strengthens / weakens the effect itself
/* blends canvas src (same size as g's canvas, layer opacity already applied) into g with a custom mode;
   r = { x, y, w, h }: only that area (src then holds just that area, at 0,0, when r.local) */
function blendCustom(g, src, mode, r, layer) {
  if (mode === 'adjust') return adjustBlend(g, src, r, layer); // adjustment layers (p10se): the backdrop is changed, not blended
  const W = g.canvas.width, Hh = g.canvas.height;
  if (!W || !Hh) return;
  const x = r ? r.x : 0, y = r ? r.y : 0, w = r ? r.w : W, h = r ? r.h : Hh;
  if (w <= 0 || h <= 0) return;
  const D = g.getImageData(x, y, w, h), d = D.data, sd = src.getContext('2d').getImageData(r && r.local ? 0 : x, r && r.local ? 0 : y, w, h).data;
  const fn = BLEND_FN[mode], glow = GLOW_BLEND.has(mode), dark = mode === 'darker-color', light = mode === 'lighter-color';
  const res = [0, 0, 0];
  for (let i = 0; i < d.length; i += 4) {
    const as = sd[i + 3] / 255; if (as <= 0) continue;
    const ab = d[i + 3] / 255;
    const sr = sd[i] / 255, sg = sd[i + 1] / 255, sb = sd[i + 2] / 255, br = d[i] / 255, bg = d[i + 1] / 255, bb = d[i + 2] / 255;
    if (dark || light) {
      const ls = 0.3 * sr + 0.59 * sg + 0.11 * sb, lb = 0.3 * br + 0.59 * bg + 0.11 * bb, useS = dark ? ls < lb : ls > lb;
      res[0] = useS ? sr : br; res[1] = useS ? sg : bg; res[2] = useS ? sb : bb;
    } else if (glow) { res[0] = fn(br, sr * as); res[1] = fn(bg, sg * as); res[2] = fn(bb, sb * as); }
    else if (fn) { res[0] = fn(br, sr); res[1] = fn(bg, sg); res[2] = fn(bb, sb); }
    else { res[0] = sr; res[1] = sg; res[2] = sb; }
    // normal: source over backdrop, with the blended colour where both exist; glow: the blended colour (the source
    // transparency is already inside it) replaces the backdrop fully, and where there is no backdrop the layer shows as it is
    const wS = as * (1 - ab), wB = glow ? ab : as * ab, wD = glow ? 0 : ab * (1 - as), ao = wS + wB + wD;
    if (ao <= 0) continue;
    d[i] = Math.round((sr * wS + res[0] * wB + br * wD) / ao * 255);
    d[i + 1] = Math.round((sg * wS + res[1] * wB + bg * wD) / ao * 255);
    d[i + 2] = Math.round((sb * wS + res[2] * wB + bb * wD) / ao * 255);
    d[i + 3] = Math.round(Math.min(1, ao) * 255);
  }
  g.putImageData(D, x, y);
}
const hasCustomBlend = () => state.layers.some(l => l.visible && isCustomBlend(l.blend));
/* on screen: a layer with a custom mode is shown as "everything below + this layer, blended" */
/* what the layers below look like: a key that changes when any of them changes (pixels, transform, visibility…) */
function cbBelowKey(i) {
  let k = state.frame + '|' + state.w + 'x' + state.h;
  for (let j = 0; j < i; j++) { const L = state.layers[j], fp = frameParams(L, state.frame); k += `|${L.id}:${L.visible ? 1 : 0}${L.opacity}${L.blend}${L.clip ? 1 : 0}${L.draft ? 1 : 0}${L.ref ? 1 : 0}:${fp ? (fp.cel._sv || 0) + ',' + fp.key + ',' + [fp.p.x, fp.p.y, fp.p.rot, fp.p.sx, fp.p.sy, fp.p.alpha].join(',') : '-'}${L.mask ? ':m' + ((L.mask.cels.get(0) || {})._sv || 0) : ''}`; }
  return k;
}
let CB_DIRTY = null; // the area changed by the last edits (celEntry), or null = everything
function customBlendView(l, i) {
  let cv = l._bv;
  const full = !cv || cv.width !== state.w || cv.height !== state.h;
  if (full) cv = l._bv = makeCanvas(state.w, state.h);
  const g = cv.getContext('2d');
  // the layers below are composited once and kept until one of them changes (a stroke on this layer or above only
  // redoes the changed area: a whole-page redo per stroke lagged big pages)
  const key = cbBelowKey(i), belowOk = l._belowKey === key && l._below && l._below.width === state.w;
  if (!belowOk) { l._below = compositeFrame(state.frame, { until: i, view: true }); l._belowKey = key; }
  const fp = frameParams(l, state.frame);
  const st = fp ? `${l.adjust ? JSON.stringify(l.adjust) : ''}${l.visible}${l.opacity}${l.blend}${l.draft}${l.clip ? 1 : 0}${l.mask ? 'm' + ((l.mask.cels.get(0) || {})._sv || 0) : ''}|${fp.key},${fp.p.x},${fp.p.y},${fp.p.rot},${fp.p.sx},${fp.p.sy},${fp.p.alpha}` : 'none';
  const self = st + '|' + (fp ? fp.cel._sv || 0 : 0);
  const styleIt = () => { const s = cv.style; s.display = l.visible ? 'block' : 'none'; s.opacity = '1'; s.mixBlendMode = 'normal'; s.transform = 'none'; s.zIndex = 10 + i * 2; s.position = 'absolute'; s.left = s.top = '0'; s.width = s.height = '100%'; return cv; };
  if (!full && belowOk && l._bvSelf === self) return styleIt(); // nothing below or here changed (e.g. a stroke on a layer above)
  let r = null;
  if (!full && belowOk && CB_DIRTY && fp && l._bvState === st && !l.clip && !l.mask && !layerMat(l, state.frame)) {
    const b = clampBox(CB_DIRTY.x0, CB_DIRTY.y0, CB_DIRTY.x1, CB_DIRTY.y1); if (b && b.w > 0 && b.h > 0) r = b;
  }
  l._bvState = st; l._bvSelf = self;
  const x = r ? r.x : 0, y = r ? r.y : 0, w = r ? r.w : state.w, h = r ? r.h : state.h;
  g.clearRect(x, y, w, h);
  g.drawImage(l._below, x, y, w, h, x, y, w, h);
  if (fp && l.visible) {
    const alpha = l.opacity * fp.p.alpha * (l.draft ? 0.45 : 1);
    if (r) { // the layer's pixels of that area only
      const lc = makeCanvas(w, h), lg = lc.getContext('2d'); lg.globalAlpha = alpha; lg.translate(-x, -y);
      { const m = layerMat(l, state.frame); if (m) lg.transform(...m); } lg.drawImage(fp.cel, 0, 0);
      blendCustom(g, lc, l.blend, { x, y, w, h, local: true }, l);
    } else blendCustom(g, layerPixels(l, i, state.frame, fp, alpha), l.blend, null, l);
  }
  const s = cv.style;
  s.display = l.visible ? 'block' : 'none'; s.opacity = '1'; s.mixBlendMode = 'normal'; s.transform = 'none'; s.zIndex = 10 + i * 2;
  s.position = 'absolute'; s.left = s.top = '0'; s.width = s.height = '100%';
  return cv;
}
/* a layer's own pixels at frame f, as a page-size canvas (transform, clipping and mask included), at a given alpha */
function layerPixels(l, i, f, fp, alpha) {
  const lc = makeCanvas(state.w, state.h), lg = lc.getContext('2d');
  const base = l.clip ? clipBaseOf(i) : null;
  if (base || l.mask) {
    drawLayerOwn.frame = f; drawLayerOwn(lg, l, fp); drawLayerOwn.frame = undefined;
    if (base) clipToBase(lc, base, f);
    if (alpha < 1) { const t = makeCanvas(state.w, state.h), tg = t.getContext('2d'); tg.globalAlpha = alpha; tg.drawImage(lc, 0, 0); return t; }
    return lc;
  }
  lg.globalAlpha = alpha;
  { const m = layerMat(l, f); if (m) lg.transform(...m); }
  lg.drawImage(fp.cel, 0, 0);
  return lc;
}
let _cbvT = 0;
/* after an edit: refresh the baked views (once per frame) */
function refreshCustomBlends() { if (!hasCustomBlend() || _cbvT) return; _cbvT = requestAnimationFrame(() => { _cbvT = 0; refreshStage(); CB_DIRTY = null; }); }
/* the area of each pixel edit (undo steps know it): the next refresh only redoes that area */
function cbMarkDirty(b) {
  if (!b) { CB_DIRTY = null; return; }
  const box = { x0: b.x - 2, y0: b.y - 2, x1: b.x + b.w + 2, y1: b.y + b.h + 2 };
  CB_DIRTY = CB_DIRTY && CB_DIRTY !== 'all' ? { x0: Math.min(CB_DIRTY.x0, box.x0), y0: Math.min(CB_DIRTY.y0, box.y0), x1: Math.max(CB_DIRTY.x1, box.x1), y1: Math.max(CB_DIRTY.y1, box.y1) } : box;
}
