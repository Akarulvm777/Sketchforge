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
/* blends canvas src (same size as g's canvas, layer opacity already applied) into g with a custom mode */
function blendCustom(g, src, mode) {
  const w = g.canvas.width, h = g.canvas.height;
  if (!w || !h) return;
  const D = g.getImageData(0, 0, w, h), d = D.data, sd = src.getContext('2d').getImageData(0, 0, w, h).data;
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
  g.putImageData(D, 0, 0);
}
const hasCustomBlend = () => state.layers.some(l => l.visible && isCustomBlend(l.blend));
/* on screen: a layer with a custom mode is shown as "everything below + this layer, blended" */
function customBlendView(l, i) {
  let cv = l._bv;
  if (!cv || cv.width !== state.w || cv.height !== state.h) cv = l._bv = makeCanvas(state.w, state.h);
  const g = cv.getContext('2d');
  g.clearRect(0, 0, state.w, state.h);
  g.drawImage(compositeFrame(state.frame, { until: i, view: true }), 0, 0);
  const fp = frameParams(l, state.frame);
  if (fp && l.visible) {
    const lc = layerPixels(l, i, state.frame, fp, l.opacity * fp.p.alpha * (l.draft ? 0.45 : 1));
    blendCustom(g, lc, l.blend);
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
function refreshCustomBlends() { if (!hasCustomBlend() || _cbvT) return; _cbvT = requestAnimationFrame(() => { _cbvT = 0; refreshStage(); }); }
