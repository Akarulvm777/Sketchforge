/* ---------- The 3D model has its own layer, and the mouse turns / zooms the view ----------
   • Dropping the model on the canvas makes a "🧍 3D model" layer (l.m3d) above the active layer: the model is shown at
     that layer's place in the stack (layers above it cover it, layers below are under it), hidden with the layer's eye,
     faded with its opacity. Delete the layer = the model is deleted with it (undo brings both back). While posing, the model comes to the top so it can
     be grabbed; it goes back to its layer when you pick a drawing tool.
   • Mouse on the model while posing: right-drag = turn the view around it, wheel = zoom, middle-drag or Shift+drag =
     move the model. Left-drag still poses (body parts, rings). */
const m3Layer = () => state.layers.find(l => l.m3d) || null;
function m3EnsureLayer() {
  let l = m3Layer(); if (l) return l;
  const a = activeLayer(), i = a ? state.layers.indexOf(a) + 1 : state.layers.length;
  timelineOp(() => { l = createLayer('🧍 3D model'); l.m3d = true; insertLayerAt(l, i); });
  M3.layerHad = true; refreshAll(); markDirty();
  return l;
}
/* the model's canvas: at its layer's place in the stack, with its eye and opacity */
function m3ApplyLayer() {
  if (!M3.renderer) return;
  const cv = M3.renderer.domElement, l = m3Layer();
  if (!l) { if (M3.layerHad && !M3.deleted) m3DeleteModel(); return; }
  if (M3.deleted) m3RestoreModel(); // the layer came back (undo)
  const i = state.layers.indexOf(l);
  cv.style.zIndex = M3.poseOn ? '4500' : String(11 + i * 2);
  if (!l.visible) cv.style.display = 'none';
  else if (m3Visible()) { cv.style.display = 'block'; cv.style.opacity = String((M3.overOp ?? 1) * l.opacity); }
}
/* the 3D layer was deleted: the model goes with it (taken out of the scene; undo brings both back) */
function m3DeleteModel() {
  M3.deleted = true; M3.hidden = true;
  if (M3.root && M3.root.parent) M3.root.parent.remove(M3.root);
  if (M3.renderer) M3.renderer.domElement.style.display = 'none';
  if (M3.poseOn) setPoseOnCanvas(false);
  if (typeof m3Fab === 'function') m3Fab();
}
function m3RestoreModel() {
  M3.deleted = false; M3.hidden = false;
  if (M3.root && M3.scene && !M3.root.parent) M3.scene.add(M3.root);
  render3D(); if (typeof m3Fab === 'function') m3Fab();
}
function m3ViewControls(cv) {
  if (cv._m3view) return; cv._m3view = true;
  let drag = null;
  cv.addEventListener('pointerdown', e => {
    if (!M3.poseOn) return;
    const mode = e.button === 2 || (e.button === 0 && e.altKey) ? 'orbit' : e.button === 1 || (e.button === 0 && e.shiftKey) ? 'pan' : null;
    if (!mode) return; // left button: posing as before
    e.stopImmediatePropagation(); e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
    drag = { mode, x: e.clientX, y: e.clientY, id: e.pointerId };
  }, true);
  cv.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    e.stopImmediatePropagation();
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    if (drag.mode === 'orbit') { M3.cam.az -= dx * 0.008; M3.cam.el = clamp(M3.cam.el + dy * 0.008, -1.4, 1.4); }
    else { const T = M3.T, k = M3.cam.dist * 0.0012, right = new T.Vector3().setFromMatrixColumn(M3.camera.matrixWorld, 0); M3.root.position.addScaledVector(right, dx * k); M3.root.position.y -= dy * k; }
    render3D();
  }, true);
  const end = e => { if (drag && e.pointerId === drag.id) { e.stopImmediatePropagation(); drag = null; } };
  cv.addEventListener('pointerup', end, true); cv.addEventListener('pointercancel', end, true);
  cv.addEventListener('wheel', e => {
    if (!M3.poseOn) return;
    e.preventDefault(); e.stopPropagation();
    M3.cam.dist = clamp(M3.cam.dist * Math.exp(e.deltaY * 0.0012), 0.6, 25); render3D();
  }, { passive: false });
  cv.addEventListener('contextmenu', e => e.preventDefault());
}
function install3DLayer() {
  const md0 = m3Drop; m3Drop = async function () {
    if (M3.deleted) { m3RestoreModel(); if (typeof applyPose === 'function') applyPose('Stand'); if (typeof fitModel === 'function') fitModel(); }
    const out = await md0.apply(this, arguments);
    m3EnsureLayer(); if (M3.renderer) m3ViewControls(M3.renderer.domElement); m3ApplyLayer();
    if (!M3.viewTip) { M3.viewTip = true; toast('3D model on its own layer "🧍 3D model". Left-drag = pose · right-drag = turn the view · wheel = zoom · middle / Shift-drag = move it', 6500); }
    return out;
  };
  const sp0 = setPoseOnCanvas; setPoseOnCanvas = function (on) {
    const out = sp0.apply(this, arguments);
    if (on && M3.renderer) { m3ViewControls(M3.renderer.domElement); if (M3.root && !m3Layer()) m3EnsureLayer(); }
    const lbl = $('#m3dPoseBar'); if (lbl) lbl.title = 'Left-drag: pose · Right-drag: turn the view · Wheel: zoom · Middle or Shift-drag: move the model';
    m3ApplyLayer(); return out;
  };
  const rs0 = refreshStage; refreshStage = function () { const out = rs0.apply(this, arguments); m3ApplyLayer(); return out; };
  const r0 = render3D; render3D = function () { const out = r0.apply(this, arguments); requestAnimationFrame(m3ApplyLayer); return out; };
}
