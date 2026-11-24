/* ---------- layer effects (3.6) ----------
   Layer › Layer effects…: Border (an outline around everything on the layer, like Clip Studio's border effect), Drop
   shadow and Outer glow. Kept as settings (l.fx = { border: { on, w, color }, shadow: { on, dx, dy, blur, color,
   alpha }, glow: { on, size, color, alpha } }): the pixels are never changed, the effects follow every later stroke.
   Shown on the stage in place of the layer's canvas (refreshStage hook; the plain cel while you draw on it) and used
   by compositeFrame (exports, previews, thumbnails) through frameParams, like the hair bones of p10wde_chain.
   fxRender caches per cel version and settings. Saved: layers[].fx. */
const FX_DEFAULT = () => ({ border: { on: false, w: 6, color: '#ffffff' }, shadow: { on: false, dx: 8, dy: 8, blur: 8, color: '#000000', alpha: 0.5 }, glow: { on: false, size: 16, color: '#ffd84a', alpha: 0.8 } });
const fxOn = l => !!(l && l.fx && (l.fx.border.on || l.fx.shadow.on || l.fx.glow.on));
let fxExport = false;
/* pure: offsets that cover a disc of radius r (for the outline: the layer drawn at each one) */
function fxRing(r) {
  const out = [], n = Math.max(8, Math.min(48, Math.round(r * 2.2)));
  for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; out.push([Math.cos(a) * r, Math.sin(a) * r]); }
  if (r > 3) for (let k = 0; k < n; k++) { const a = (k + 0.5) / n * Math.PI * 2; out.push([Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55]); }
  return out;
}
function fxSilhouette(cel, color) { // the layer's shape in one colour
  const s = makeCanvas(cel.width, cel.height), g = s.getContext('2d');
  g.drawImage(cel, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, s.width, s.height);
  return s;
}
function fxRender(l, cel) {
  if (!fxOn(l) || !cel) return cel;
  const key = JSON.stringify(l.fx) + '|' + (cel._sv || 0) + '|' + cel.width;
  if (cel._fx && cel._fxKey === key) return cel._fx;
  const out = makeCanvas(cel.width, cel.height), g = out.getContext('2d'), F = l.fx;
  if (F.glow.on) { g.save(); g.globalAlpha = F.glow.alpha; g.filter = `blur(${F.glow.size / 2}px)`; const s = fxSilhouette(cel, F.glow.color); g.drawImage(s, 0, 0); g.drawImage(s, 0, 0); g.restore(); }
  if (F.shadow.on) { g.save(); g.globalAlpha = F.shadow.alpha; if (F.shadow.blur > 0) g.filter = `blur(${F.shadow.blur / 2}px)`; g.drawImage(fxSilhouette(cel, F.shadow.color), F.shadow.dx, F.shadow.dy); g.restore(); }
  if (F.border.on && F.border.w > 0) { const s = fxSilhouette(cel, F.border.color); for (const [dx, dy] of fxRing(F.border.w)) g.drawImage(s, dx, dy); }
  g.drawImage(cel, 0, 0);
  out._ink = true; cel._fx = out; cel._fxKey = key;
  return out;
}
const fxEditing = l => typeof stroke !== 'undefined' && stroke && activeLayer() === l;
function fxDialog() {
  const l = activeLayer(); if (!l || l.vref) { toast('Choose a layer first'); return; }
  if ($('#fxDialog')) $('#fxDialog').remove();
  const before = JSON.stringify(l.fx || null);
  if (!l.fx) l.fx = FX_DEFAULT();
  const d = document.createElement('dialog'); d.className = 'adjdlg'; d.id = 'fxDialog';
  d.innerHTML = `<form method="dialog"><h3>✨ Layer effects — ${escHtml(l.name)}</h3><div class="fxbody"></div>
    <p class="muted small">Kept as settings: draw on the layer and the effects follow. Your pixels are not changed.</p>
    <div class="dialog-actions"><button type="button" data-a="off">Remove effects</button><span style="flex:1"></span><button type="button" data-a="cancel">Cancel</button><button type="button" data-a="ok" class="primary">OK</button></div></form>`;
  const body = d.querySelector('.fxbody'), F = l.fx;
  const live = () => { markDirty(); refreshStage(); if (typeof renderLayers === 'function') renderLayers(); };
  const color = (parent, label, obj, k) => { const row = document.createElement('label'); row.className = 'select'; row.innerHTML = `<span>${label}</span>`; const c = document.createElement('input'); c.type = 'color'; c.value = obj[k]; c.oninput = () => { obj[k] = c.value; live(); }; row.appendChild(c); parent.appendChild(row); };
  const sec = (title, obj, build) => { const box = document.createElement('div'); box.className = 'fxsec'; body.appendChild(box); checkbox(box, title, obj.on, v => { obj.on = v; live(); }); build(box); };
  sec('Border (outline)', F.border, b => { slider(b, 'Width', 1, 40, 1, F.border.w, v => v + ' px', v => { F.border.w = v; live(); }); color(b, 'Colour', F.border, 'color'); });
  sec('Drop shadow', F.shadow, b => { slider(b, 'Right', -60, 60, 1, F.shadow.dx, v => v + ' px', v => { F.shadow.dx = v; live(); }); slider(b, 'Down', -60, 60, 1, F.shadow.dy, v => v + ' px', v => { F.shadow.dy = v; live(); }); slider(b, 'Softness', 0, 40, 1, F.shadow.blur, v => v + ' px', v => { F.shadow.blur = v; live(); }); slider(b, 'Opacity', 0, 100, 1, F.shadow.alpha * 100, v => v + '%', v => { F.shadow.alpha = v / 100; live(); }); color(b, 'Colour', F.shadow, 'color'); });
  sec('Outer glow', F.glow, b => { slider(b, 'Size', 2, 80, 1, F.glow.size, v => v + ' px', v => { F.glow.size = v; live(); }); slider(b, 'Opacity', 0, 100, 1, F.glow.alpha * 100, v => v + '%', v => { F.glow.alpha = v / 100; live(); }); color(b, 'Colour', F.glow, 'color'); });
  document.body.appendChild(d); d.show(); live();
  const finish = after => {
    if (after !== before) { const a = after, b = before; pushHistory({ undo() { l.fx = b === 'null' ? null : JSON.parse(b); live(); }, redo() { l.fx = a === 'null' ? null : JSON.parse(a); live(); }, bytes: 0 }); markDirty(); }
    d.remove(); live();
  };
  d.querySelector('[data-a=ok]').onclick = () => { if (!fxOn(l)) l.fx = null; finish(JSON.stringify(l.fx || null)); };
  d.querySelector('[data-a=off]').onclick = () => { l.fx = null; finish('null'); };
  d.querySelector('[data-a=cancel]').onclick = () => { l.fx = before === 'null' ? null : JSON.parse(before); d.remove(); live(); };
}
function installLayerFx() {
  CMD.layerFx = fxDialog;
  const L = MENUS.find(m => m[0] === 'Layer');
  if (L && !L[1].some(x => Array.isArray(x) && x[1] === 'layerFx')) { const i = L[1].findIndex(x => Array.isArray(x) && x[1] === 'adjSettings'); L[1].splice(i < 0 ? L[1].length : i + 1, 0, ['✨ Layer effects (border, shadow, glow)…', 'layerFx']); }
  // on screen: the layer with its effects in place of the plain canvas (not while drawing on it, nor with a custom blend / bent drawing)
  hookAfter('refreshStage', () => {
    state.layers.forEach(l => {
      const c = l.canvas, rm = () => { if (l._fxView && l._fxView.parentNode) l._fxView.remove(); };
      if (!c || !fxOn(l) || l.vref || !l.visible || fxEditing(l) || isCustomBlend(l.blend) || l.clip || c.style.display === 'none') { rm(); return; }
      const src = fxRender(l, c);
      let v = l._fxView; if (!v) v = l._fxView = makeCanvas(1, 1);
      if (v.width !== src.width || v.height !== src.height) { v.width = src.width; v.height = src.height; }
      if (v._src !== src) { const g = v.getContext('2d'); g.clearRect(0, 0, v.width, v.height); g.drawImage(src, 0, 0); v._src = src; }
      v.style.cssText = c.style.cssText; v.style.pointerEvents = 'none'; c.style.display = 'none';
      if (v.parentNode !== stage) stage.insertBefore(v, c.nextSibling);
    });
  }, 5);
  // exports and previews
  const fp0 = frameParams;
  frameParams = function (l, f) {
    const fp = fp0.apply(this, arguments);
    if (!fxExport || !fp || !fxOn(l) || l.clip) return fp;
    return { ...fp, cel: fxRender(l, fp.cel) };
  };
  const cf0 = compositeFrame;
  compositeFrame = function () { const was = fxExport; fxExport = true; try { return cf0.apply(this, arguments); } finally { fxExport = was; } };
}
