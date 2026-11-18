/* ---------- 3D model, more control ----------
   - finger bones (3 per finger, from models3d.js v2): curl a finger, hand poses (fist, point, peace…)
   - drag a body part to MOVE it: the limb follows the mouse (inverse kinematics, elbows / knees bend one way);
     the old "rotate the joint" drag is still there (Drag: Rotate)
   - body shape: head, build, shoulders, hips, torso / arm / leg length, hands, feet (the rest mesh and the bones are
     reshaped, then the pose is applied again)
   - zoom slider / buttons, pinch to zoom on the preview, model size 20–300 %                                  */
const FINGER_NAMES = [['thumb', 'Thumb'], ['index', 'Index'], ['middle', 'Middle'], ['ring', 'Ring'], ['pinky', 'Little']];
const HAND_POSES = {
  Relaxed: { thumb: 12, index: 18, middle: 24, ring: 28, pinky: 32 },
  Open: { thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0 },
  Fist: { thumb: 55, index: 92, middle: 95, ring: 95, pinky: 95 },
  Point: { thumb: 50, index: 0, middle: 92, ring: 95, pinky: 95 },
  Peace: { thumb: 55, index: 0, middle: 0, ring: 95, pinky: 95 },
  'Thumbs up': { thumb: 0, index: 92, middle: 95, ring: 95, pinky: 95 },
  Grip: { thumb: 35, index: 55, middle: 60, ring: 62, pinky: 65 }
};
const SHAPE_DEF = { head: 1, build: 1, shoulders: 1, hips: 1, torso: 1, arms: 1, legs: 1, hands: 1, feet: 1 };
const SHAPE_UI = [['head', 'Head size', 60, 160], ['build', 'Build (thin ↔ heavy)', 60, 170], ['shoulders', 'Shoulders', 70, 140], ['hips', 'Hips', 70, 150],
  ['torso', 'Torso length', 75, 130], ['arms', 'Arm length', 75, 130], ['legs', 'Leg length', 70, 135], ['hands', 'Hands', 70, 150], ['feet', 'Feet', 70, 150]];
M3.shape = { ...SHAPE_DEF }; M3.dragMode = 'move'; M3.curl = {};
const riggedMesh = () => M3.parts.find(p => p.userData.rigged) || null;
const fingerOf = b => { const m = /^(thumb|index|middle|ring|pinky)([123])([LR])$/.exec(b || ''); return m ? { f: m[1], k: +m[2], s: m[3] } : null; };
function hasFingers() { return !!(M3.joints && M3.joints.index1L); }

/* ---- finger curl ---- */
function setCurl(f, s, deg) {
  const mesh = riggedMesh(); if (!mesh || !M3.joints[f + '1' + s]) return;
  const ax = mesh.userData.bend[f + s]; if (!ax) return;
  const axis = new M3.T.Vector3(...ax), mult = f === 'thumb' ? [0.35, 0.8, 0.85] : [0.85, 1.05, 0.75];
  for (let k = 1; k <= 3; k++) M3.joints[f + k + s].quaternion.setFromAxisAngle(axis, deg * mult[k - 1] * DEG);
  M3.curl[f + s] = deg;
}
function applyHandPose(name, side) {
  const p = HAND_POSES[name]; if (!p) return;
  for (const s of side === 'both' ? ['L', 'R'] : [side]) for (const f in p) setCurl(f, s, p[f]);
  syncJointSliders(); syncCurl(); render3D();
}
function syncCurl() {
  const fo = fingerOf(M3.sel), row = $('#m3dCurlRow'); if (!row) return;
  row.hidden = !fo; if (!fo) return;
  const v = Math.round(M3.curl[fo.f + fo.s] || 0);
  $('#m3dCurl').value = v; $('#m3dCurlV').textContent = v + '°';
}

/* ---- body shape: reshape the rest mesh + joints, keep the pose ---- */
function shapeScale(name) {
  const S = M3.shape, b = name.replace(/[LR]$/, ''), lb = Math.pow(S.build, 0.8);
  if (fingerOf(name) || b === 'hand') return [S.hands, S.hands, S.hands];
  switch (b) {
    case 'head': return [S.head, S.head, S.head];
    case 'neck': return [Math.sqrt(S.build), 1, Math.sqrt(S.build)];
    case 'spine': return [S.shoulders * S.build, S.torso, S.build];
    case 'pelvis': return [S.hips * S.build, 1, S.build];
    case 'arm': case 'forearm': return [lb, S.arms, lb];
    case 'leg': case 'shin': return [lb, S.legs, lb];
    case 'foot': return [S.feet, S.feet, S.feet];
  }
  return [1, 1, 1];
}
function applyShape() {
  const mesh = riggedMesh(); if (!mesh) return;
  const T = M3.T, ud = mesh.userData, n = ud.p0.length / 3, names = ud.boneNames, par = ud.parents;
  const J0 = names.map(nm => ud.j0[nm]), A = [], D = names.map(shapeScale);
  names.forEach((nm, i) => {
    const pi = par[i];
    if (pi < 0) { A[i] = J0[i].slice(); return; }
    const j = J0[i], pj = J0[pi], d = D[pi], a = A[pi];
    A[i] = [a[0] + d[0] * (j[0] - pj[0]), a[1] + d[1] * (j[1] - pj[1]), a[2] + d[2] * (j[2] - pj[2])];
  });
  const pos = mesh.geometry.attributes.position, out = pos.array, p0 = ud.p0, w = ud.w, si = ud.si;
  let minY = Infinity;
  for (let v = 0; v < n; v++) {
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < 4; k++) {
      const wt = w[v * 4 + k]; if (!wt) continue;
      const b = si[v * 4 + k], j = J0[b], d = D[b], a = A[b];
      x += wt * (a[0] + d[0] * (p0[v * 3] - j[0])); y += wt * (a[1] + d[1] * (p0[v * 3 + 1] - j[1])); z += wt * (a[2] + d[2] * (p0[v * 3 + 2] - j[2]));
    }
    out[v * 3] = x; out[v * 3 + 1] = y; out[v * 3 + 2] = z; if (y < minY) minY = y;
  }
  const dy = ud.minY0 - minY; // keep the feet on the ground
  for (let v = 0; v < n; v++) out[v * 3 + 1] += dy;
  pos.needsUpdate = true; if (ud.vrm) weldNormals(mesh.geometry, ud.vrm.weld); else mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere();
  // bones: rest positions from the reshaped joints, re-bind in the rest pose, then put the pose back
  const quats = names.map(nm => M3.joints[nm].quaternion.clone());
  names.forEach((nm, i) => {
    const b = M3.joints[nm], pi = par[i];
    b.quaternion.identity();
    if (pi < 0) b.position.set(A[i][0], A[i][1] + dy, A[i][2]); else b.position.set(A[i][0] - A[pi][0], A[i][1] - A[pi][1], A[i][2] - A[pi][2]);
  });
  M3.root.updateMatrixWorld(true);
  mesh.bind(mesh.skeleton);
  names.forEach((nm, i) => M3.joints[nm].quaternion.copy(quats[i]));
  ud.tipsNow = {};
  for (const k in ud.tips0) { const t = ud.tips0[k], s = k.slice(-1), f3 = names.indexOf(k.slice(0, -1) + '3' + s), d = D[f3], j = J0[f3], a = A[f3]; ud.tipsNow[k] = [a[0] + d[0] * (t[0] - j[0]), a[1] + dy + d[1] * (t[1] - j[1]), a[2] + d[2] * (t[2] - j[2])]; }
  render3D();
}
function shapeIsDefault() { return Object.keys(SHAPE_DEF).every(k => Math.abs(M3.shape[k] - SHAPE_DEF[k]) < 1e-3); }

/* ---- drag to move a part (CCD inverse kinematics) ---- */
const IK_STOP = new Set(['pelvis']);
function ikChain(bone) {
  const fo = fingerOf(bone);
  if (fo) { const c = []; for (let k = fo.k; k >= 1; k--) c.push(fo.f + k + fo.s); return c; }
  if (/^(head|neck)$/.test(bone)) return ['head', 'neck', 'spine'].slice(bone === 'head' ? 0 : 1);
  if (bone === 'spine') return ['spine'];
  const m = /^(arm|forearm|hand|leg|shin|foot)([LR])$/.exec(bone); if (!m) return [bone];
  const s = m[2], order = /arm|hand/.test(m[1]) ? ['hand', 'forearm', 'arm'] : ['foot', 'shin', 'leg'];
  return order.slice(order.indexOf(m[1])).map(x => x + s);
}
function ikConstrain(name) {
  const T = M3.T, j = M3.joints[name], fo = fingerOf(name);
  if (/^(forearm|shin)[LR]$/.test(name)) { // elbows and knees are hinges
    const e = new T.Euler().setFromQuaternion(j.quaternion, 'YXZ'), knee = name.startsWith('shin');
    const x = clamp(e.x, knee ? 0 : -150 * DEG, knee ? 150 * DEG : 0);
    j.quaternion.setFromEuler(new T.Euler(x, name.startsWith('forearm') ? clamp(e.y, -80 * DEG, 80 * DEG) : 0, 0, 'YXZ'));
  } else if (fo) { // fingers bend around their bend axis only
    const ax = riggedMesh().userData.bend[fo.f + fo.s]; if (!ax) return;
    const axis = new T.Vector3(...ax), q = j.quaternion;
    const tw = new T.Vector3(q.x, q.y, q.z).dot(axis), ang = 2 * Math.atan2(tw, q.w);
    j.quaternion.setFromAxisAngle(axis, clamp(ang, -20 * DEG, (fo.f === 'thumb' ? 80 : 110) * DEG));
  }
}
function ikSolve(bone, grabLocal, target) {
  const T = M3.T, chain = ikChain(bone).filter(b => M3.joints[b] && !IK_STOP.has(b)), end = M3.joints[bone];
  const eff = new T.Vector3(), bp = new T.Vector3(), q = new T.Quaternion(), pq = new T.Quaternion();
  for (let it = 0; it < 10; it++) {
    for (const name of chain) {
      const j = M3.joints[name];
      M3.root.updateMatrixWorld(true);
      eff.copy(grabLocal); end.localToWorld(eff);
      if (eff.distanceToSquared(target) < 1e-7) return;
      j.getWorldPosition(bp);
      const v1 = eff.clone().sub(bp), v2 = target.clone().sub(bp);
      if (v1.lengthSq() < 1e-10 || v2.lengthSq() < 1e-10) continue;
      q.setFromUnitVectors(v1.normalize(), v2.normalize());
      q.slerp(new T.Quaternion(), name === bone && chain.length > 1 ? 0.6 : 0.2); // the grabbed part itself turns less
      j.parent.getWorldQuaternion(pq);
      j.quaternion.premultiply(pq.clone().invert().multiply(q).multiply(pq));
      ikConstrain(name);
    }
  }
}
function rayToPlane(e, cv, point) {
  const T = M3.T;
  const rc = new T.Raycaster(); rc.setFromCamera(m3Ndc(e, cv), M3.camera);
  const nrm = new T.Vector3(); M3.camera.getWorldDirection(nrm);
  const plane = new T.Plane().setFromNormalAndCoplanarPoint(nrm, point);
  return rc.ray.intersectPlane(plane, new T.Vector3());
}

/* ---- zoom ---- */
const ZOOM_BASE = 4.4;
function setZoom(pct) { M3.cam.dist = clamp(ZOOM_BASE * 100 / pct, 0.4, 20); syncZoom(); render3D(); }
function syncZoom() { const z = Math.round(ZOOM_BASE * 100 / M3.cam.dist); const i = $('#m3dZoom'); if (i) { i.value = clamp(z, 20, 500); $('#m3dZoomV').textContent = z + '%'; } }

/* ---- UI ---- */
function install3DPlus(b) {
  const after = (sel, html) => { const el = b.querySelector(sel); el.insertAdjacentHTML('afterend', html); };
  b.querySelector('.hint').textContent = 'Drag a body part = move it (or rotate, see Drag) · drag the background = orbit · Shift / right-drag = move model · wheel or pinch = zoom';
  after('.hint', `<div class="seg" id="m3dDrag" title="What dragging a body part does"><button data-d="move" class="on">Drag: Move part</button><button data-d="rotate">Drag: Rotate joint</button></div>
    <label class="slider"><span>Zoom</span><input type="range" id="m3dZoom" min="20" max="500" value="100"><output id="m3dZoomV">100%</output></label>`);
  after('#m3dJoint', `<label class="slider" id="m3dCurlRow" hidden><span>Curl finger</span><input type="range" id="m3dCurl" min="-20" max="110" value="0"><output id="m3dCurlV">0°</output></label>
    <div class="grp">Hands</div><div class="btnrow" id="m3dHandSide"><select id="m3dHandWhich"><option value="both">Both hands</option><option value="L">Left hand</option><option value="R">Right hand</option></select></div>
    <div class="btnrow" id="m3dHands"></div>`);
  const look = [...b.querySelectorAll('.grp')].find(g => g.textContent === 'Look');
  look.insertAdjacentHTML('beforebegin', `<div class="grp">Body shape</div><div id="m3dShape"></div><div class="btnrow"><button id="m3dShapeReset">Reset body shape</button></div>`);
  const sh = $('#m3dShape');
  for (const [k, label, mn, mx] of SHAPE_UI) {
    sh.insertAdjacentHTML('beforeend', `<label class="slider"><span>${label}</span><input type="range" data-shape="${k}" min="${mn}" max="${mx}" value="100"><output>100%</output></label>`);
  }
  sh.querySelectorAll('[data-shape]').forEach(i => {
    i.oninput = () => { M3.shape[i.dataset.shape] = i.value / 100; i.nextElementSibling.textContent = i.value + '%'; clearTimeout(M3.shT); M3.shT = setTimeout(applyShape, 30); };
  });
  $('#m3dShapeReset').onclick = () => { M3.shape = { ...SHAPE_DEF }; sh.querySelectorAll('[data-shape]').forEach(i => { i.value = 100; i.nextElementSibling.textContent = '100%'; }); applyShape(); };
  Object.keys(HAND_POSES).forEach(n => { const x = document.createElement('button'); x.textContent = n; x.onclick = () => applyHandPose(n, $('#m3dHandWhich').value); $('#m3dHands').appendChild(x); });
  $('#m3dCurl').oninput = e => { const fo = fingerOf(M3.sel); if (!fo) return; setCurl(fo.f, fo.s, +e.target.value); $('#m3dCurlV').textContent = e.target.value + '°'; syncJointSliders(); render3D(); };
  b.querySelectorAll('#m3dDrag button').forEach(x => x.onclick = () => { M3.dragMode = x.dataset.d; syncPoseBar(); });
  $('#m3dZoom').oninput = e => setZoom(+e.target.value);
  const h = $('#m3dH'); h.min = 20; h.max = 300;
  $('#m3dResetAll').addEventListener('click', () => { M3.curl = {}; syncCurl(); });
  // pinch to zoom on the preview
  const cv = $('#m3dPreview'), pts = new Map(); let pinch = null;
  cv.addEventListener('pointerdown', e => { pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) { const [a, c] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - c[0], a[1] - c[1]), dist: M3.cam.dist }; } }, true);
  cv.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && pts.size === 2) { const [a, c] = [...pts.values()]; M3.cam.dist = clamp(pinch.dist * pinch.d / Math.max(10, Math.hypot(a[0] - c[0], a[1] - c[1])), 0.4, 20); syncZoom(); render3D(); e.stopImmediatePropagation(); }
  }, true);
  const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; };
  cv.addEventListener('pointerup', up, true); cv.addEventListener('pointercancel', up, true);
  cv.addEventListener('wheel', () => setTimeout(syncZoom, 0));
}
/* joint list with fingers */
function jointNameList() {
  if (M3.kind !== 'mannequin') return [['body', 'Whole model']];
  const list = JOINT_NAMES.slice();
  if (hasFingers()) for (const [s, side] of [['L', 'Left'], ['R', 'Right']]) for (const [f, nm] of FINGER_NAMES) for (let k = 1; k <= 3; k++) list.push([f + k + s, `${side} ${nm.toLowerCase()} ${['base', 'middle', 'tip'][k - 1]}`]);
  return list;
}
