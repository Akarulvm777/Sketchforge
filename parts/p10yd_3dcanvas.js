/* ---------- The 3D model lives on the drawing, not in a small window ----------
   • The small preview in the 3D panel is gone: the panel shows a tile "drag the model onto your drawing". Drop it on the
     canvas (or tap it) → the model appears there, where you dropped it, ready to pose on the canvas (rings, drag…).
   • The model stays on the canvas while you work: refreshStage used to remove its canvas from the stage (every tool
     change, stroke or layer change made it vanish until something redrew it) — it is now put back every time.
   • Pose ↔ draw: picking a drawing tool ends posing (the model stays as a reference, you draw over it); the floating
     button "✋ Pose 3D model" on the canvas starts posing again; ✕ hides the model. Closing the 3D panel keeps the model. */
function m3Visible() { return !!(M3.renderer && M3.root && M3.over && !M3.hidden); }
function m3KeepOnStage() {
  if (!m3Visible()) return;
  const cv = M3.renderer.domElement;
  if (cv.parentNode !== stage) stage.appendChild(cv);
  cv.style.display = 'block'; cv.style.opacity = M3.overOp;
}
/* put the model where the pointer is (screen point → the model's middle moves there, on its own depth plane) */
function m3PlaceAt(clientX, clientY) {
  if (!M3.root || !M3.camera) return;
  const r = vpRect(), d = toDoc({ clientX, clientY }), T = M3.T;
  if (!d || d.x < 0 || d.y < 0 || d.x > state.w || d.y > state.h) return;
  const ndc = new T.Vector2(d.x / state.w * 2 - 1, -(d.y / state.h * 2 - 1));
  const box = new T.Box3().setFromObject(M3.root), mid = box.getCenter(new T.Vector3());
  const plane = new T.Plane(new T.Vector3(0, 0, 1), -mid.z), ray = new T.Raycaster(); ray.setFromCamera(ndc, M3.camera);
  const hit = new T.Vector3(); if (!ray.ray.intersectPlane(plane, hit)) return;
  M3.root.position.x += hit.x - mid.x; M3.root.position.y += hit.y - mid.y;
  void r; render3D();
}
async function m3Drop(clientX, clientY) {
  await show3D();
  M3.over = true; M3.hidden = false; const o = $('#m3dOver'); if (o) o.checked = true;
  if (clientX != null) m3PlaceAt(clientX, clientY);
  setPoseOnCanvas(true); m3Fab();
}
function m3Fab() {
  let f = $('#m3dFab');
  if (!f) {
    f = document.createElement('div'); f.id = 'm3dFab';
    f.innerHTML = '<button class="primary" data-a="pose" title="Pose the 3D model on the canvas">✋ Pose 3D model</button><button data-a="hide" title="Hide the 3D model">✕</button>';
    f.addEventListener('pointerdown', e => e.stopPropagation());
    f.querySelector('[data-a=pose]').onclick = () => { setPoseOnCanvas(true); m3Fab(); };
    f.querySelector('[data-a=hide]').onclick = () => { M3.hidden = true; setPoseOnCanvas(false); render3D(); m3Fab(); toast('3D model hidden (the 🧍 3D model button brings it back)'); };
    viewport.appendChild(f);
  }
  f.hidden = !m3Visible() || !!M3.poseOn;
}
function m3PanelTile() {
  const pv = $('#m3dPreview'); if (!pv || pv._tiled) return; pv._tiled = true;
  pv.style.display = 'none';
  const hint = pv.nextElementSibling; if (hint && hint.classList.contains('hint')) hint.remove();
  const t = document.createElement('div'); t.id = 'm3dDragTile'; t.draggable = true; t.tabIndex = 0;
  t.innerHTML = '<span>🧍</span><div><b>Drag the model onto your drawing</b><small>or tap here — then pose it right on the canvas</small></div>';
  t.addEventListener('dragstart', e => { e.dataTransfer.setData('text/sf3d', '1'); e.dataTransfer.effectAllowed = 'copy'; });
  t.onclick = () => m3Drop(null, null);
  t.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); m3Drop(null, null); } };
  pv.after(t);
}
function install3DCanvas() {
  // the model is never removed by a stage refresh
  hookAfter('refreshStage', m3KeepOnStage, 10);
  // drop the model from the panel onto the canvas
  viewport.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('text/sf3d')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  viewport.addEventListener('drop', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('text/sf3d')) { e.preventDefault(); e.stopPropagation(); m3Drop(e.clientX, e.clientY); } }, true);
  // the panel: no small control window
  const b0 = build3DPanel; build3DPanel = function () { const out = b0.apply(this, arguments); m3PanelTile(); return out; };
  const s0 = show3D; show3D = async function () { const out = await s0.apply(this, arguments); m3PanelTile(); m3Fab(); return out; };
  CMD.show3d = () => show3D().then(() => { if (M3.root && !M3.poseOn) setPoseOnCanvas(true); m3Fab(); });
  // closing the 3D panel keeps the model on the drawing
  const tp0 = togglePanel; togglePanel = function (pid) {
    if (pid !== '3d-model') return tp0.apply(this, arguments);
    const p = panels.find(x => x.dataset.pid === pid);
    if (p && p.classList.contains('phidden')) return tp0.apply(this, arguments);
    p.classList.add('phidden'); refreshDocks(); saveLayout(); m3Fab();
  };
  // a drawing tool ends posing (draw over the model); the floating button starts it again
  const st0 = selectTool; selectTool = function (id) {
    const out = st0.apply(this, arguments);
    if (M3.poseOn && ['brush', 'fill', 'shape', 'poly'].includes(kindOf(id))) setPoseOnCanvas(false);
    m3Fab(); return out;
  };
  hookAfter('setPoseOnCanvas', () => { m3KeepOnStage(); m3Fab(); });
  hookAfter('render3D', () => requestAnimationFrame(() => m3Fab()));
}
