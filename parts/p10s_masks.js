/* ---------- layer masks ----------
   A mask is a hidden pixel layer stored on the layer (layer.mask). Its opaque pixels HIDE the layer.
   While "edit mask" is on you paint red = hide, erase = reveal.                                    */
function newMaskLayer() {
  const m = { id: -1, name: 'mask', cels: new Map([[0, makeCel(false)]]), canvas: null, ctx: null, visible: true, opacity: 1, blend: 'normal',
    locked: false, paper: false, px: null, py: null, clip: false, alock: false, ref: false, draft: false, isMask: true };
  bindLayer(m, state.frame);
  return m;
}
function maskOp(fn) { const l = activeLayer(); if (!l) return; timelineOp(() => fn(l)); }
function maskAdd() { const l = activeLayer(); if (!l) return; if (l.mask) { toast('Layer already has a mask'); return; }
  timelineOp(() => { l.mask = newMaskLayer(); l.maskEdit = true; }); toast('Mask added — paint to hide, erase to reveal'); }
function maskFromSel(hideOutside) {
  const l = activeLayer(); if (!l) return;
  if (!sel.active) { toast('Make a selection first'); return; }
  timelineOp(() => {
    const m = newMaskLayer(), c = m.cels.get(0), g = c.getContext('2d');
    if (hideOutside) { g.fillStyle = '#000'; g.fillRect(0, 0, state.w, state.h); g.globalCompositeOperation = 'destination-out'; g.drawImage(sel.mask, 0, 0); }
    else g.drawImage(sel.mask, 0, 0);
    c._ink = true; l.mask = m; l.maskEdit = false;
  });
}
function maskToggleEdit() { const l = activeLayer(); if (!l || !l.mask) { toast('Add a mask first'); return; }
  timelineOp(() => { l.maskEdit = !l.maskEdit; }); toast(l.maskEdit ? 'Editing mask' : 'Editing layer'); }
function maskInvert() {
  const l = activeLayer(); if (!l || !l.mask) return;
  timelineOp(() => {
    const m = newMaskLayer(); m.cels = new Map();
    for (const [k, c] of l.mask.cels) {
      const n = makeCel(true), g = n.getContext('2d');
      g.fillStyle = '#000'; g.fillRect(0, 0, state.w, state.h); g.globalCompositeOperation = 'destination-out'; g.drawImage(c, 0, 0);
      m.cels.set(k, n);
    }
    l.mask = m;
  });
}
function maskApply() {
  const l = activeLayer(); if (!l || !l.mask) return;
  timelineOp(() => {
    const cels = new Map();
    for (const [k, c] of l.cels) {
      const n = copyCel(c, true), g = n.getContext('2d'), mc = celCanvas(l.mask, k);
      if (mc) { g.globalCompositeOperation = 'destination-out'; g.drawImage(mc, 0, 0); }
      cels.set(k, n);
    }
    l.cels = cels; l.mask = null; l.maskEdit = false; bindAll(state.frame);
  });
  toast('Mask applied');
}
function maskDelete() { const l = activeLayer(); if (!l || !l.mask) return; timelineOp(() => { l.mask = null; l.maskEdit = false; }); toast('Mask removed (layer shown in full)'); }
function installMasks() {
  Object.assign(CMD, { maskAdd, maskEdit: maskToggleEdit, maskInvert, maskApply, maskDel: maskDelete,
    maskHideOut: () => maskFromSel(true), maskHideIn: () => maskFromSel(false) });
  const L = MENUS.find(m => m[0] === 'Layer')[1];
  L.push('-', ['Add layer mask', 'maskAdd'], ['Mask: hide outside selection', 'maskHideOut'], ['Mask: hide selection', 'maskHideIn'],
    ['Edit mask / edit layer', 'maskEdit'], ['Invert mask', 'maskInvert'], ['Apply mask to layer', 'maskApply'], ['Delete mask', 'maskDel']);
}
