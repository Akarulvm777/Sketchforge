/* ---------- editable text layers (3.6) ----------
   Each text placed with the Text tool goes on its own text layer (like Clip Studio): the cel keeps what was typed and
   its style (cel._text = textSpecFrom(…), p10rc) and its pixels are drawn from it (textCel). Clicking the text again
   with the Text tool reopens it in the text box with its style loaded in Tool Property: Update text redraws it, an
   empty text deletes the layer. Size, colour, font, balloon… changed in Tool Property while a text layer is active
   apply to it at once. A text layer can be moved / transformed like any layer; brushes, fill, filters… are refused
   (Layer › Rasterize text turns it into a normal layer). An edit replaces the cel: one undo step (timelineOp), and undo
   brings the old text back. Tool Property › "Editable text layer" off = old behaviour (pixels on the current layer).
   Saved: cels[].text, layers[].textLayer. */
let textEditing = null; // the text layer being edited, while the text box is open
const isTextLayer = l => !!(l && l.textLayer);
function textCel(spec) {
  const c = makeCel(true); c._text = { ...spec };
  paintText(c.getContext('2d'), spec);
  return c;
}
const textNameOf = txt => (txt.replace(/\s+/g, ' ').trim().slice(0, 24) || 'Text') + (txt.trim().length > 24 ? '…' : '');
/* pure: does a point fall in the text box (with some margin)? */
function textHit(box, x, y, pad = 8) { return !!box && x >= box.x - pad && x <= box.x + box.w + pad && y >= box.y - pad && y <= box.y + box.h + pad; }
function textBoxOf(spec) { const g = makeCanvas(1, 1).getContext('2d'); return paintTextBox(g, spec); }
function paintTextBox(g, S) { // the text's own box (not the balloon), in layer pixels
  g.font = `${S.italic ? 'italic ' : ''}${S.bold ? 'bold ' : ''}${S.size}px ${S.font}`;
  const L = textLayout(S.txt.split('\n'), S.size, S.dir, S.spacing, S.align, s => g.measureText(s).width);
  return { x: L.box.x + S.x, y: L.box.y + S.y, w: L.box.w, h: L.box.h };
}
function textLayerPlace(txt, at) {
  if (textEditing) return textLayerUpdate(textEditing, txt);
  if (!txt.trim()) return;
  timelineOp(() => {
    const spec = textSpecFrom(txt, at.x, at.y);
    const l = createLayer(textNameOf(txt)); l.textLayer = true;
    l.cels = new Map([[state.frame, textCel(spec)]]);
    if (state.frame > 0) l.cels.set(0, makeCel(false)); // the text starts on the frame it was placed on
    const i = state.layers.findIndex(x => x.id === state.activeId);
    insertLayerAt(l, i < 0 ? state.layers.length : i + 1);
  });
  addRecent(state.color);
}
function textLayerUpdate(l, txt, specChanges) {
  const k = keyAt(l, state.frame), old = k == null ? null : l.cels.get(k);
  if (!old || !old._text) return;
  if (txt != null && !txt.trim()) { timelineOp(() => { removeLayerObj(l); }); toast('Text removed'); return; }
  timelineOp(() => {
    const spec = { ...old._text, ...(specChanges || {}), ...(txt != null ? { txt } : {}) };
    const c = textCel(spec); if (old._xf) c._xf = { ...old._xf };
    l.cels.set(k, c); l.name = textNameOf(spec.txt);
  });
}
/* the text layer under a document point (active layer first, then from the top) */
function textLayerAt(x, y) {
  const list = [activeLayer(), ...state.layers.slice().reverse()].filter(isTextLayer);
  for (const l of list) {
    if (!l.visible) continue;
    const c = celCanvas(l, state.frame); if (!c || !c._text) continue;
    const [lx, ly] = localMapper(l).map(x, y);
    if (textHit(textBoxOf(c._text), lx, ly)) return l;
  }
  return null;
}
/* load a text's style into the tool, so Tool Property shows it */
function textLoadStyle(S) {
  Object.assign(state, { fontSize: S.size, font: S.font, bold: S.bold, italic: S.italic, textDir: S.dir, textSpacing: S.spacing, align: S.align, textBalloon: S.balloon, textTail: S.tail });
  if (typeof setColor === 'function') setColor(S.color); else state.color = S.color;
}
function textEditOpen(l) {
  const c = celCanvas(l, state.frame); if (!c || !c._text) return false;
  textEditing = l; state.activeId = l.id; textLoadStyle(c._text);
  const dlg = $('#textDialog'); $('#textInput').value = c._text.txt;
  $('#textOk').textContent = 'Update text';
  refreshAll();
  if (typeof dlg.showModal === 'function') { dlg.showModal(); const f = () => $('#textInput').focus(); f(); setTimeout(f, 0); setTimeout(f, 120); }
  return true;
}
function textRasterize() {
  const l = activeLayer(); if (!isTextLayer(l)) { toast('Choose a text layer first'); return; }
  timelineOp(() => { l.textLayer = false; for (const [k, c] of l.cels) if (c._text) { const n = copyCel(c, true); delete n._text; l.cels.set(k, n); } });
  toast('The text is now a normal picture layer');
}
function installTextLayers() {
  if (state.textLayer == null) state.textLayer = true;
  // Text tool on an existing text → edit it
  const tc0 = textClick; textClick = function (e) {
    const d = toDoc(e), l = textLayerAt(d.x, d.y);
    if (l && textEditOpen(l)) return;
    textEditing = null; $('#textOk').textContent = 'Place text';
    return tc0.apply(this, arguments);
  };
  $('#textDialog').addEventListener('close', () => { textEditing = null; $('#textOk').textContent = 'Place text'; });
  // Tool Property changes apply to the active text layer
  const live = () => {
    const l = activeLayer(); if (!isTextLayer(l) || kindOf(state.tool) !== 'text' || $('#textDialog').open) return;
    const c = celCanvas(l, state.frame); if (!c || !c._text) return;
    const S = c._text, now = textSpecFrom(S.txt, S.x, S.y);
    if (['size', 'font', 'bold', 'italic', 'color', 'dir', 'spacing', 'align', 'balloon', 'tail'].some(k => now[k] !== S[k])) textLayerUpdate(l, null, { ...now, x: S.x, y: S.y, lw: S.lw });
  };
  let liveT = 0; const soon = () => { clearTimeout(liveT); liveT = setTimeout(live, 120); };
  document.addEventListener('input', e => { if (e.target.closest && e.target.closest('#propBody')) soon(); }, true);
  document.addEventListener('change', e => { if (e.target.closest && e.target.closest('#propBody')) soon(); }, true);
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('#propBody')) soon(); }, true);
  const sc0 = setColor; setColor = function () { const out = sc0.apply(this, arguments); soon(); return out; };
  hookAfter('refreshProps', () => {
    if (kindOf(state.tool) !== 'text') return;
    const body = $('#propBody'); if (!body) return;
    checkbox(body, 'Editable text layer (click the text again to change it)', state.textLayer !== false, v => { state.textLayer = v; });
    const l = activeLayer();
    if (isTextLayer(l)) hint(body, 'Text layer selected: changes here apply to it. Click the text to change the words.');
  });
  // brushes, fill, filters… would be lost at the next text edit
  const cp0 = canPaint; canPaint = function () {
    const l = activeLayer();
    if (isTextLayer(l) && !(l.maskEdit && l.mask) && kindOf(state.tool) !== 'text') { toast('This is a text layer: click it with the Text tool to change it, or Layer › Rasterize text to paint on it'); return null; }
    return cp0.apply(this, arguments);
  };
  if (typeof effectDialog === 'function') { const fx0 = effectDialog; effectDialog = function () { if (isTextLayer(activeLayer())) { toast('Filters work on picture layers: Layer › Rasterize text first'); return; } return fx0.apply(this, arguments); }; }
  const cc0 = copyCel; copyCel = function (src) { const c = cc0.apply(this, arguments); if (src && src._text) c._text = { ...src._text }; return c; };
  CMD.editText = () => { const l = activeLayer(); if (!isTextLayer(l) || !textEditOpen(l)) toast('Choose a text layer first'); };
  CMD.rasterizeText = textRasterize;
  const L = MENUS.find(m => m[0] === 'Layer');
  if (L && !L[1].some(x => Array.isArray(x) && x[1] === 'editText')) L[1].push('-', ['✎ Edit text…', 'editText'], ['Rasterize text (make it a picture)', 'rasterizeText']);
}
