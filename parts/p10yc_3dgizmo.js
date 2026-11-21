/* ---------- 3D panel, posing like a pro (the user's "topic1" video) ----------
   • Hover a body part = it lights up blue; the selected part is red.
   • Rotation rings: red / green / blue circles around the selected joint (its own X / Y / Z axes). Drag a ring = turn
     the part around exactly that axis. Fingers get small rings.
   • Floor grid + ground shadow (panel › Look; the grid never goes into "Place on new layer").
   • Pose on canvas: the bar floats above the model's head, with camera buttons (front / side / back / zoom / reset).
   Hooks: initThree (renderer.render is wrapped to place the helpers each frame), bindPoseSurface (hover + ring drag in
   the capture phase, before the normal drag), markSel (colours), setPoseOnCanvas (bar buttons), build3DPanel (options),
   placeOnLayer (helpers hidden). */
const GIZ = { on: true, gridOn: true, shadow: true, hover: null, ring: null, hot: null, grid: null };
try { const o = JSON.parse(localStorage.getItem('sketchforge.m3dgiz.v1') || '{}'); if ('on' in o) GIZ.on = !!o.on; if ('grid' in o) GIZ.gridOn = !!o.grid; if ('shadow' in o) GIZ.shadow = !!o.shadow; } catch (e) { /* defaults */ }
const gizSave = () => { try { localStorage.setItem('sketchforge.m3dgiz.v1', JSON.stringify({ on: GIZ.on, grid: GIZ.gridOn, shadow: GIZ.shadow })); } catch (e) { /* ignore */ } };
const GIZ_FINGER = /thumb|index|middle|ring|pinky|little/i;
function gizBuild() {
  const T = M3.T; if (GIZ.group || !T) return;
  // rotation rings
  GIZ.group = new T.Group(); GIZ.group.renderOrder = 999;
  // solid thin rings (WebGL lines are 1 px: too thin to see and to grab); a torus lies around its Z axis
  GIZ.rings = [['x', 0xff4a4a], ['y', 0x4cff6a], ['z', 0x4a8cff]].map(([ax, col]) => {
    const ring = new T.Mesh(new T.TorusGeometry(1, 0.045, 8, 72), new T.MeshBasicMaterial({ color: col, depthTest: false, transparent: true, opacity: 0.85 }));
    if (ax === 'x') ring.rotation.y = Math.PI / 2; else if (ax === 'y') ring.rotation.x = Math.PI / 2;
    ring.userData.axis = ax; ring.userData.color = col; ring.renderOrder = 999; GIZ.group.add(ring); return ring;
  });
  M3.scene.add(GIZ.group);
  // floor grid + shadow catcher
  GIZ.grid = new T.GridHelper(4, 20, 0x5aa0ff, 0x8a9bbd); GIZ.grid.material.transparent = true; GIZ.grid.material.opacity = 0.35;
  GIZ.floor = new T.Mesh(new T.PlaneGeometry(8, 8), new T.ShadowMaterial({ opacity: 0.28 })); GIZ.floor.rotation.x = -Math.PI / 2; GIZ.floor.receiveShadow = true;
  M3.scene.add(GIZ.grid, GIZ.floor);
  const R = M3.renderer; R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap;
  const sh = M3.sun.shadow; sh.mapSize.set(1024, 1024); Object.assign(sh.camera, { left: -2, right: 2, top: 3, bottom: -1, near: 0.1, far: 20 }); sh.camera.updateProjectionMatrix(); sh.bias = -0.0005;
  // the helpers are placed right before every render
  const r0 = R.render.bind(R);
  R.render = (scene, cam) => { gizSync(); return r0(scene, cam); };
}
function gizSync() {
  if (!GIZ.group) return;
  const T = M3.T, j = M3.joints && M3.joints[M3.sel], show = GIZ.on && !GIZ.placing && M3.selShown && j && M3.kind === 'mannequin';
  GIZ.group.visible = !!show;
  if (show) {
    j.updateWorldMatrix(true, false);
    const p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3(); j.matrixWorld.decompose(p, q, s);
    GIZ.group.position.copy(p); GIZ.group.quaternion.copy(q);
    GIZ.group.scale.setScalar((GIZ_FINGER.test(M3.sel) ? 0.035 : /head|neck/.test(M3.sel) ? 0.13 : /pelvis|spine|chest/.test(M3.sel) ? 0.2 : 0.11) * (M3.heightScale || 1));
    for (const r of GIZ.rings) { const hot = GIZ.hot === r || GIZ.ring === r; r.material.opacity = hot ? 1 : 0.75; r.material.color.setHex(hot ? 0xffffff : r.userData.color); }
  }
  // the ground: under the feet (root position), grid only while posing / in the panel, never placed on a layer
  const y = M3.root ? M3.root.position.y : 0;
  GIZ.grid.position.y = y; GIZ.floor.position.y = y;
  GIZ.grid.visible = GIZ.gridOn && !GIZ.placing && M3.kind === 'mannequin';
  GIZ.floor.visible = GIZ.shadow && M3.kind === 'mannequin';
  M3.sun.castShadow = !!GIZ.shadow;
  for (const pt of M3.parts || []) { pt.castShadow = !!GIZ.shadow; }
  gizBarPlace();
}
/* the pose bar floats above the head of the model (Pose on canvas) */
function gizBarPlace() {
  const bar = $('#m3dPoseBar'); if (!bar || bar.hidden || !M3.joints) return;
  const head = M3.joints.head || M3.joints.neck; if (!head) return;
  const T = M3.T, p = new T.Vector3(); head.updateWorldMatrix(true, false); p.setFromMatrixPosition(head.matrixWorld); p.y += 0.25 * (M3.heightScale || 1);
  p.project(M3.camera);
  const [sx, sy] = docToScreen((p.x + 1) / 2 * state.w, (1 - p.y) / 2 * state.h), vw = viewport.clientWidth, vh = viewport.clientHeight;
  const w = bar.offsetWidth || 300, h = bar.offsetHeight || 36;
  bar.style.left = clamp(sx - w / 2, 6, Math.max(6, vw - w - 6)) + 'px'; bar.style.top = clamp(sy - h - 8, 6, Math.max(6, vh - h - 6)) + 'px';
  bar.style.right = 'auto'; bar.style.bottom = 'auto'; bar.style.transform = 'none';
}
/* hover highlight + ring drag, before the normal drag of bindPoseSurface */
function gizBind(cv, big) {
  const T = M3.T;
  // the ring under the pointer: each ring's circle projected on the screen, nearest within ~1.6% of the view
  const ringAt = e => {
    if (!GIZ.group || !GIZ.group.visible) return null;
    GIZ.group.updateMatrixWorld(true);
    const v = m3Ndc(e, cv), asp = M3.camera.aspect, pt = new T.Vector3(); let best = null, bd = 0.032;
    for (const r of GIZ.rings) {
      for (let i = 0; i < 48; i++) {
        const a = i / 48 * Math.PI * 2; pt.set(Math.cos(a), Math.sin(a), 0).applyMatrix4(r.matrixWorld).project(M3.camera);
        const d = Math.hypot((pt.x - v.x) * asp, pt.y - v.y); if (d < bd) { bd = d; best = r; }
      }
    }
    return best;
  };
  const centerNdc = () => { const p = GIZ.group.position.clone().project(M3.camera); return [p.x * M3.camera.aspect, p.y]; };
  const angleAt = e => { const v = m3Ndc(e, cv), [cx, cy] = centerNdc(); return Math.atan2(v.y - cy, v.x * M3.camera.aspect - cx); };
  cv.addEventListener('pointerdown', e => {
    if (big && !M3.poseOn) return;
    const r = ringAt(e); if (!r) return;
    e.stopImmediatePropagation(); e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch (er) { /* synthetic */ }
    const j = M3.joints[M3.sel], axis = new T.Vector3(r.userData.axis === 'x' ? 1 : 0, r.userData.axis === 'y' ? 1 : 0, r.userData.axis === 'z' ? 1 : 0);
    const worldAxis = axis.clone().applyQuaternion(GIZ.group.quaternion), toCam = M3.camera.position.clone().sub(GIZ.group.position);
    GIZ.ring = r; GIZ.drag = { j, axis, a: angleAt(e), sign: worldAxis.dot(toCam) >= 0 ? 1 : -1 };
    render3D();
  }, true);
  cv.addEventListener('pointermove', e => {
    if (GIZ.drag) {
      e.stopImmediatePropagation();
      const a = angleAt(e); let d = a - GIZ.drag.a; if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
      GIZ.drag.a = a; GIZ.drag.j.rotateOnAxis(GIZ.drag.axis, d * GIZ.drag.sign);
      if (typeof syncJointSliders === 'function') syncJointSliders(); render3D(); return;
    }
    if (big && !M3.poseOn) return;
    if (e.buttons) return; // a normal drag is running
    const now = performance.now(); if (now - (GIZ.lastHover || 0) < 50) return; GIZ.lastHover = now; // picking a skinned mesh is heavy
    const r = ringAt(e); const hotChanged = r !== GIZ.hot; GIZ.hot = r;
    const h = r ? null : pick(e, cv);
    cv.style.cursor = r ? 'pointer' : h ? 'grab' : big ? 'default' : 'grab';
    if (h !== GIZ.hover || hotChanged) { GIZ.hover = h; markSel(); render3D(); }
  }, true);
  const end = e => { if (GIZ.drag) { e.stopImmediatePropagation(); GIZ.drag = null; GIZ.ring = null; render3D(); } };
  cv.addEventListener('pointerup', end, true); cv.addEventListener('pointercancel', end, true);
  cv.addEventListener('pointerleave', () => { if (GIZ.hover || GIZ.hot) { GIZ.hover = null; GIZ.hot = null; markSel(); render3D(); } });
}
/* colours: selected part red, hovered part blue */
function gizMarkSel() {
  for (const p of M3.parts || []) {
    if (p.userData.rigged) {
      const names = p.userData.boneNames, sel = M3.selShown ? names.indexOf(M3.sel) : -1, hov = GIZ.hover ? names.indexOf(GIZ.hover) : -1, dom = p.userData.dom, col = p.geometry.attributes.color;
      for (let i = 0; i < dom.length; i++) {
        const d = dom[i];
        if (d === sel) col.setXYZ(i, 1.35, 0.62, 0.66); else if (d === hov) col.setXYZ(i, 0.72, 0.78, 1.35); else col.setXYZ(i, 1, 1, 1);
      }
      col.needsUpdate = true;
    } else if (p.material.emissive) p.material.emissive.setHex(p.userData.joint === M3.sel ? 0x6a1f24 : p.userData.joint === GIZ.hover ? 0x1f3a6a : 0x000000);
  }
}
function gizBarButtons() {
  const bar = $('#m3dPoseBar'); if (!bar || bar._giz) return; bar._giz = true;
  const cam = document.createElement('span'); cam.className = 'm3dcam';
  cam.innerHTML = '<button data-v="0" title="Front view">Front</button><button data-v="90" title="Side view">Side</button><button data-v="180" title="Back view">Back</button><button data-z="-1" title="Zoom in">＋</button><button data-z="1" title="Zoom out">−</button><button data-c="1" title="Reset camera">⟲</button><button data-r="1" title="Show / hide the rotation rings">◎</button>';
  bar.insertBefore(cam, bar.querySelector('[data-x=done]'));
  cam.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { M3.cam.az = +b.dataset.v * DEG; M3.cam.el = 0.1; render3D(); });
  cam.querySelectorAll('[data-z]').forEach(b => b.onclick = () => { M3.cam.dist = clamp(M3.cam.dist * (b.dataset.z > 0 ? 1.15 : 1 / 1.15), 1, 20); render3D(); });
  cam.querySelector('[data-c]').onclick = () => fitModel();
  const rb = cam.querySelector('[data-r]'); rb.classList.toggle('on', GIZ.on);
  rb.onclick = () => { GIZ.on = !GIZ.on; rb.classList.toggle('on', GIZ.on); gizSave(); const c = $('#m3dGiz'); if (c) c.checked = GIZ.on; render3D(); };
}
function gizPanelOptions() {
  const anchor = $('#m3dToon'); if (!anchor || $('#m3dGiz')) return;
  const box = document.createElement('div');
  box.innerHTML = `<label class="check"><input type="checkbox" id="m3dGiz"> Rotation rings on the selected joint</label>
    <label class="check"><input type="checkbox" id="m3dGrid"> Floor grid (only while posing)</label>
    <label class="check"><input type="checkbox" id="m3dShadow"> Ground shadow</label>`;
  anchor.closest('label').after(box);
  const bind = (id, k) => { const c = $(id); c.checked = !!GIZ[k]; c.onchange = () => { GIZ[k] = c.checked; gizSave(); render3D(); }; };
  bind('#m3dGiz', 'on'); bind('#m3dGrid', 'gridOn'); bind('#m3dShadow', 'shadow');
  const h = $('#m3dBody .hint'); if (h) h.textContent = 'Point at a body part = it lights up · drag it = pose it · drag a coloured ring = turn it around that axis · drag the background = orbit · Shift+drag = move the model · wheel = zoom';
}
function install3DGizmo() {
  const i0 = initThree; initThree = function () { const r = i0.apply(this, arguments); try { gizBuild(); } catch (e) { console.warn('3D helpers:', e.message); } return r; };
  const b0 = bindPoseSurface; bindPoseSurface = function (cv, big) { gizBind(cv, big); return b0.apply(this, arguments); };
  markSel = gizMarkSel;
  const s0 = setPoseOnCanvas; setPoseOnCanvas = function (on) { const r = s0.apply(this, arguments); if (on) gizBarButtons(); render3D(); return r; };
  const p0 = build3DPanel; build3DPanel = function () { const r = p0.apply(this, arguments); gizPanelOptions(); return r; };
  const l0 = placeOnLayer; placeOnLayer = function () { GIZ.placing = true; try { return l0.apply(this, arguments); } finally { GIZ.placing = false; render3D(); } };
}
