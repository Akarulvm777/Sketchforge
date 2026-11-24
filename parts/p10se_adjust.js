/* ---------- adjustment layers (3.6) ----------
   Layer › New adjustment layer: Hue / Saturation / Brightness, Brightness & Contrast, Levels, Tone curve, Colour
   balance, Gradient map, Posterize, Threshold, Invert. An adjustment layer changes everything below it without
   touching their pixels, and its settings can be changed at any time (double-click it, or Layer › Adjustment
   settings…). Its own pixels are a mask: full white = everywhere; erase parts to limit where it applies; layer
   opacity = strength. It uses the custom blend path of p02b: l.blend = 'adjust', l.adjust = { kind, …settings };
   blendCustom(g, mask, 'adjust', r, layer) changes the backdrop where the mask is (on screen, exports, eyedropper,
   merge). Saved: layers[].adjust. */
const ADJ_KINDS = {
  hsb: { name: 'Hue / Saturation / Brightness', icon: '🌈', fields: [['hue', 'Hue', -180, 180, 0], ['sat', 'Saturation', -100, 100, 0], ['bri', 'Brightness', -100, 100, 0]] },
  bc: { name: 'Brightness & Contrast', icon: '☀', fields: [['bri', 'Brightness', -100, 100, 0], ['con', 'Contrast', -100, 100, 0]] },
  levels: { name: 'Levels', icon: '📊', fields: [['lo', 'Shadows (input)', 0, 254, 0], ['hi', 'Highlights (input)', 1, 255, 255], ['gamma', 'Midtones (gamma ×100)', 20, 300, 100], ['olo', 'Output black', 0, 255, 0], ['ohi', 'Output white', 0, 255, 255]] },
  curve: { name: 'Tone curve', icon: '〰', fields: [['sh', 'Shadows', -100, 100, 0], ['mid', 'Midtones', -100, 100, 0], ['hi', 'Highlights', -100, 100, 0]] },
  balance: { name: 'Colour balance', icon: '⚖', fields: [['cr', 'Cyan ↔ Red', -100, 100, 0], ['mg', 'Magenta ↔ Green', -100, 100, 0], ['yb', 'Yellow ↔ Blue', -100, 100, 0]] },
  gradmap: { name: 'Gradient map', icon: '🎨', colors: [['c0', 'Shadows colour', '#1b1340'], ['c1', 'Highlights colour', '#ffe2a8']], fields: [['mix', 'Strength', 0, 100, 100]] },
  posterize: { name: 'Posterize', icon: '▦', fields: [['n', 'Levels', 2, 32, 5]] },
  threshold: { name: 'Threshold (black & white)', icon: '◐', fields: [['t', 'Threshold', 1, 254, 128]] },
  invert: { name: 'Invert', icon: '◑', fields: [] }
};
const adjDefaults = kind => { const K = ADJ_KINDS[kind], o = { kind }; for (const f of K.fields) o[f[0]] = f[4]; for (const c of K.colors || []) o[c[0]] = c[2]; return o; };
/* pure: a 256-entry table per channel for the kinds that are per-channel (levels, curve, bc, invert, posterize, threshold) */
function adjLUT(a) {
  const L = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) {
    let o = v;
    if (a.kind === 'levels') { const t = clamp((v - a.lo) / Math.max(1, a.hi - a.lo), 0, 1); o = a.olo + (a.ohi - a.olo) * Math.pow(t, 100 / Math.max(1, a.gamma)); }
    else if (a.kind === 'bc') { const k = (259 * (a.con * 2.55 + 255)) / (255 * (259 - a.con * 2.55)); o = k * (v + a.bri * 1.28 - 128) + 128; }
    else if (a.kind === 'invert') o = 255 - v;
    else if (a.kind === 'posterize') { const k = 255 / (a.n - 1); o = Math.round(v / k) * k; }
    L[v] = o;
  }
  if (a.kind === 'curve') {
    const id = [[0, 0], [64, 64 + a.sh * 0.7], [128, 128 + a.mid * 0.7], [192, 192 + a.hi * 0.7], [255, 255]].map(q => [q[0], clamp(q[1], 0, 255)]);
    id[1][1] = Math.min(id[1][1], id[2][1] - 1); id[3][1] = Math.max(id[3][1], id[2][1] + 1);
    return curveLUT(id);
  }
  return L;
}
/* pure: the adjusted colour of RGBA pixels d (in place); only where the alpha is > 0 */
function adjApply(d, a) {
  if (a.kind === 'hsb') return fx2Hsb(d, a.hue, a.sat, a.bri, false);
  if (a.kind === 'threshold') { for (let i = 0; i < d.length; i += 4) { const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] >= a.t ? 255 : 0; d[i] = d[i + 1] = d[i + 2] = v; } return d; }
  if (a.kind === 'balance') {
    for (let i = 0; i < d.length; i += 4) { const l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255, w = 4 * l * (1 - l) * 0.7; d[i] = clamp(d[i] + a.cr * w, 0, 255); d[i + 1] = clamp(d[i + 1] - a.mg * w, 0, 255); d[i + 2] = clamp(d[i + 2] + a.yb * w, 0, 255); }
    return d;
  }
  if (a.kind === 'gradmap') {
    const A = fx2Rgb(a.c0), B = fx2Rgb(a.c1), m = a.mix / 100;
    for (let i = 0; i < d.length; i += 4) { const t = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255; for (let j = 0; j < 3; j++) d[i + j] = d[i + j] * (1 - m) + (A[j] + (B[j] - A[j]) * t) * m; }
    return d;
  }
  const L = adjLUT(a);
  for (let i = 0; i < d.length; i += 4) { d[i] = L[d[i]]; d[i + 1] = L[d[i + 1]]; d[i + 2] = L[d[i + 2]]; }
  return d;
}
/* the custom "blend" of an adjustment layer: the backdrop g, changed where the layer's mask is (alpha = strength) */
function adjustBlend(g, mask, r, layer) {
  const a = layer && layer.adjust; if (!a) return;
  const W = g.canvas.width, H = g.canvas.height, x = r ? r.x : 0, y = r ? r.y : 0, w = r ? r.w : W, h = r ? r.h : H;
  if (w <= 0 || h <= 0) return;
  const D = g.getImageData(x, y, w, h), d = D.data, orig = d.slice(), m = mask.getContext('2d').getImageData(r && r.local ? 0 : x, r && r.local ? 0 : y, w, h).data;
  adjApply(d, a);
  for (let i = 0; i < d.length; i += 4) {
    const k = m[i + 3] / 255;
    if (k >= 1) { d[i + 3] = orig[i + 3]; continue; }
    d[i] = orig[i] + (d[i] - orig[i]) * k; d[i + 1] = orig[i + 1] + (d[i + 1] - orig[i + 1]) * k; d[i + 2] = orig[i + 2] + (d[i + 2] - orig[i + 2]) * k; d[i + 3] = orig[i + 3];
  }
  g.putImageData(D, x, y);
}
const isAdjLayer = l => !!(l && l.adjust);
function adjNew(kind) {
  timelineOp(() => {
    const l = createLayer(ADJ_KINDS[kind].icon + ' ' + ADJ_KINDS[kind].name, '#ffffff'); // white mask = everywhere
    l.adjust = adjDefaults(kind); l.blend = 'adjust';
    const i = state.layers.findIndex(x => x.id === state.activeId);
    insertLayerAt(l, i < 0 ? state.layers.length : i + 1);
  });
  adjDialog(activeLayer(), true);
}
/* the settings window: live preview, OK keeps them (one undo step), Cancel goes back */
function adjDialog(l, isNew) {
  if (!isAdjLayer(l)) { toast('Choose an adjustment layer first'); return; }
  const before = { ...l.adjust }, K = ADJ_KINDS[l.adjust.kind];
  const d = document.createElement('dialog'); d.className = 'adjdlg'; d.id = 'adjDialog';
  d.innerHTML = `<form method="dialog"><h3>${K.icon} ${escHtml(K.name)}</h3><div class="adjbody"></div>
    <p class="muted small">Changes every layer below it. Erase parts of this layer to keep them unchanged; its opacity sets the strength.</p>
    <div class="dialog-actions"><button type="button" data-a="cancel">Cancel</button><button type="button" data-a="ok" class="primary">OK</button></div></form>`;
  const body = d.querySelector('.adjbody');
  const live = () => { l._bvSelf = null; l._bvState = null; markDirty(); refreshStage(); };
  for (const [k, label, min, max] of K.fields) slider(body, label, min, max, 1, l.adjust[k], v => String(v), v => { l.adjust[k] = v; live(); });
  for (const [k, label] of K.colors || []) { const row = document.createElement('label'); row.className = 'select'; row.innerHTML = `<span>${escHtml(label)}</span>`; const c = document.createElement('input'); c.type = 'color'; c.value = l.adjust[k]; c.oninput = () => { l.adjust[k] = c.value; live(); }; row.appendChild(c); body.appendChild(row); }
  if (!K.fields.length && !(K.colors || []).length) body.innerHTML = '<p>No settings: the colours below are inverted.</p>';
  document.body.appendChild(d); d.show();
  d.querySelector('[data-a=ok]').onclick = () => {
    const after = { ...l.adjust };
    if (!isNew && JSON.stringify(after) !== JSON.stringify(before)) pushHistory({ undo() { l.adjust = { ...before }; live(); }, redo() { l.adjust = { ...after }; live(); }, bytes: 0 });
    d.remove();
  };
  d.querySelector('[data-a=cancel]').onclick = () => { l.adjust = { ...before }; live(); d.remove(); };
}
function installAdjust() {
  BLEND_LABEL.adjust = 'Adjustment';
  CMD.adjSettings = () => adjDialog(activeLayer());
  const L = MENUS.find(m => m[0] === 'Layer');
  if (L && !L[1].some(x => Array.isArray(x) && x[1] === 'adjSettings')) {
    const i = L[1].findIndex(x => Array.isArray(x) && x[1] === 'layerAdd');
    const items = Object.keys(ADJ_KINDS).map(k => { CMD['adj_' + k] = () => adjNew(k); return [`${ADJ_KINDS[k].icon} New adjustment layer: ${ADJ_KINDS[k].name}`, 'adj_' + k]; });
    L[1].splice(i + 2, 0, '-', ...items, ['Adjustment settings…', 'adjSettings'], '-');
  }
  // Layer Property: an adjustment layer has settings instead of a blend mode
  hookAfter('syncLayerControls', () => {
    const sel = $('#layerBlend'); if (!sel) return;
    let b = $('#adjBtn');
    if (!b) { b = document.createElement('button'); b.type = 'button'; b.id = 'adjBtn'; b.textContent = 'Adjustment settings…'; b.onclick = () => adjDialog(activeLayer()); sel.after(b); }
    const on = isAdjLayer(activeLayer()); sel.hidden = on; b.hidden = !on;
  });
  // double-click an adjustment layer in the Layer panel = its settings
  document.addEventListener('dblclick', e => {
    const row = e.target.closest && e.target.closest('[data-lid]'); if (!row) return;
    const l = state.layers.find(x => String(x.id) === row.dataset.lid); if (isAdjLayer(l)) { e.stopPropagation(); e.preventDefault(); state.activeId = l.id; adjDialog(l); }
  }, true);
}
