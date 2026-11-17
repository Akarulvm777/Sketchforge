/* ---------- 3D model panel: posable male / female mannequin, primitives, glTF / OBJ import ---------- */
const M3 = { ready: null, T: null, renderer: null, scene: null, camera: null, root: null, joints: {}, parts: [], sel: null,
  gender: 'female', cam: { az: 0.5, el: 0.25, dist: 4.6, tx: 0, ty: 0.9 }, light: { az: 40, el: 50 }, toon: false, over: true, overOp: 0.85,
  heightScale: 1, pending: false, imported: null, kind: 'mannequin' };

function load3D() {
  if (M3.ready) return M3.ready;
  M3.ready = new Promise((res, rej) => {
    const sc = document.createElement('script'); sc.src = 'three3d.js';
    sc.onload = () => { try { initThree(); res(); } catch (e) { rej(e); } };
    sc.onerror = () => rej(new Error('three3d.js not found next to index.html'));
    document.head.appendChild(sc);
  });
  M3.ready.catch(() => { M3.ready = null; });
  return M3.ready;
}
const JOINT_NAMES = [['pelvis', 'Pelvis / hips'], ['spine', 'Spine'], ['neck', 'Neck'], ['head', 'Head'],
  ['armL', 'Left upper arm'], ['forearmL', 'Left forearm'], ['handL', 'Left hand'], ['armR', 'Right upper arm'], ['forearmR', 'Right forearm'], ['handR', 'Right hand'],
  ['legL', 'Left thigh'], ['shinL', 'Left shin'], ['footL', 'Left foot'], ['legR', 'Right thigh'], ['shinR', 'Right shin'], ['footR', 'Right foot']];
const POSES = {
  Stand: { armL: [0, 0, 6], armR: [0, 0, -6], forearmL: [-8, 0, 0], forearmR: [-8, 0, 0] },
  'T-pose': { armL: [0, 0, 90], armR: [0, 0, -90] },
  'A-pose': { armL: [0, 0, 40], armR: [0, 0, -40], forearmL: [-10, 0, 0], forearmR: [-10, 0, 0] },
  Sit: { pelvis: [0, 0, 0], legL: [-90, 0, 0], legR: [-90, 0, 0], shinL: [90, 0, 0], shinR: [90, 0, 0], armL: [-25, 0, 8], armR: [-25, 0, -8], forearmL: [-60, 0, 0], forearmR: [-60, 0, 0], _y: -0.43 },
  Walk: { legL: [-28, 0, 0], shinL: [8, 0, 0], legR: [22, 0, 0], shinR: [34, 0, 0], armL: [24, 0, 5], armR: [-24, 0, -5], forearmL: [-18, 0, 0], forearmR: [-30, 0, 0], spine: [0, 6, 0] },
  Run: { legL: [-62, 0, 0], shinL: [70, 0, 0], legR: [30, 0, 0], shinR: [60, 0, 0], armL: [45, 0, 8], armR: [-50, 0, -8], forearmL: [-85, 0, 0], forearmR: [-85, 0, 0], spine: [-12, 8, 0] },
  'Reach up': { armL: [0, 0, 165], armR: [0, 0, -165], forearmL: [0, 0, 0], forearmR: [0, 0, 0], head: [-12, 0, 0] },
  Kneel: { legL: [-90, 0, 0], shinL: [120, 0, 0], legR: [-10, 0, 0], shinR: [100, 0, 0], armL: [-10, 0, 8], armR: [-10, 0, -8], _y: -0.43 }
};
function initThree() {
  const T = M3.T = SF3D.THREE;
  M3.renderer = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  M3.renderer.setClearColor(0x000000, 0);
  M3.scene = new T.Scene();
  M3.camera = new T.PerspectiveCamera(30, 1, 0.1, 100);
  M3.amb = new T.AmbientLight(0xffffff, 0.55);
  M3.sun = new T.DirectionalLight(0xffffff, 2.2);
  M3.scene.add(M3.amb, M3.sun, M3.sun.target);
  const c = M3.renderer.domElement;
  c.id = 'model3d-canvas'; c.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;width:100%;height:100%;z-index:4500';
  const gm = new Uint8Array([70, 150, 255]); M3.grad = new T.DataTexture(gm, 3, 1, T.RedFormat); M3.grad.needsUpdate = true;
  M3.grad.minFilter = M3.grad.magFilter = T.NearestFilter;
}
const skin = () => (M3.toon ? 0xe9c8b0 : 0xd9c3b3);
function mkMat(color, toon) {
  const T = M3.T;
  return toon ? new T.MeshToonMaterial({ color, gradientMap: M3.grad }) : new T.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0 });
}
function buildMannequin(g) {
  const T = M3.T, F = g === 'female';
  const S = { shoulder: F ? 0.185 : 0.235, hip: F ? 0.105 : 0.088, torso: F ? 0.5 : 0.56, chestR: F ? 0.125 : 0.158, waistR: F ? 0.098 : 0.135, pelvisR: F ? 0.15 : 0.135,
    thigh: F ? 0.43 : 0.46, shin: F ? 0.43 : 0.46, upperArm: F ? 0.27 : 0.3, fore: F ? 0.24 : 0.27, headR: F ? 0.105 : 0.115, thighR: F ? 0.078 : 0.075, limbR: F ? 0.036 : 0.043 };
  const root = new T.Group(), joints = {}, parts = [];
  const mesh = (geo, joint, color, parent, pos) => {
    const m = new T.Mesh(geo, mkMat(color || skin(), M3.toon)); m.userData.joint = joint; m.userData.color = color || skin();
    if (pos) m.position.set(...pos); parent.add(m); parts.push(m); return m;
  };
  const joint = (name, parent, pos) => { const j = new T.Group(); j.position.set(...pos); parent.add(j); joints[name] = j; return j; };
  const limb = (len, r, name, parent, taper) => {
    const m = mesh(new T.CapsuleGeometry(r, Math.max(0.01, len - 2 * r), 6, 16), name, null, parent, [0, -len / 2, 0]); return m;
  };
  const legTop = S.thigh + S.shin + 0.08;
  const pelvis = joint('pelvis', root, [0, legTop, 0]);
  const pm = mesh(new T.SphereGeometry(1, 20, 14), 'pelvis', null, pelvis, [0, 0.02, 0]); pm.scale.set(S.pelvisR, 0.1, 0.11 + (F ? 0.015 : 0));
  const spine = joint('spine', pelvis, [0, 0.07, 0]);
  const waist = mesh(new T.CylinderGeometry(S.chestR * 0.92, S.waistR, 0.18, 20), 'spine', null, spine, [0, 0.08, 0]); waist.scale.z = 0.7;
  const chest = mesh(new T.SphereGeometry(1, 22, 16), 'spine', null, spine, [0, S.torso - 0.2, 0]); chest.scale.set(S.chestR * 1.3, 0.155, S.chestR * 0.78);
  if (F) { for (const sx of [-1, 1]) { const b = mesh(new T.SphereGeometry(0.058, 16, 12), 'spine', null, spine, [sx * 0.06, S.torso - 0.27, 0.085]); b.scale.set(1, 1, 0.9); } }
  const neck = joint('neck', spine, [0, S.torso - 0.03, 0.0]);
  mesh(new T.CylinderGeometry(0.036, 0.042, 0.1, 14), 'neck', null, neck, [0, 0.05, 0]);
  const head = joint('head', neck, [0, 0.1, 0]);
  const hm = mesh(new T.SphereGeometry(1, 24, 18), 'head', null, head, [0, S.headR * 0.95, 0]); hm.scale.set(S.headR * 0.86, S.headR * 1.1, S.headR * 0.98);
  mesh(new T.ConeGeometry(0.014, 0.036, 10), 'head', null, head, [0, S.headR * 0.92, S.headR * 0.93]).rotation.x = Math.PI / 2;
  for (const [sx, n] of [[1, 'L'], [-1, 'R']]) {
    const arm = joint('arm' + n, spine, [sx * S.shoulder, S.torso - 0.07, 0]);
    mesh(new T.SphereGeometry(S.limbR * 1.35, 14, 10), 'arm' + n, null, arm);
    limb(S.upperArm, S.limbR * 1.1, 'arm' + n, arm);
    const fore = joint('forearm' + n, arm, [0, -S.upperArm, 0]); limb(S.fore, S.limbR, 'forearm' + n, fore);
    const hand = joint('hand' + n, fore, [0, -S.fore, 0]);
    const hmh = mesh(new T.SphereGeometry(1, 14, 10), 'hand' + n, null, hand, [0, -0.05, 0]); hmh.scale.set(0.03, 0.058, 0.016);
    const leg = joint('leg' + n, pelvis, [sx * S.hip, -0.03, 0]);
    mesh(new T.SphereGeometry(S.thighR * 1.02, 14, 10), 'leg' + n, null, leg);
    limb(S.thigh, S.thighR, 'leg' + n, leg);
    const shin = joint('shin' + n, leg, [0, -S.thigh, 0]); limb(S.shin, S.thighR * 0.72, 'shin' + n, shin);
    const foot = joint('foot' + n, shin, [0, -S.shin, 0]);
    mesh(new T.BoxGeometry(0.075, 0.05, 0.2), 'foot' + n, null, foot, [0, -0.025, 0.055]);
  }
  return { root, joints, parts, legTop };
}
function makePrimitive(kind) {
  const T = M3.T, root = new T.Group(), j = new T.Group(); root.add(j);
  const geo = kind === 'cube' ? new T.BoxGeometry(0.8, 0.8, 0.8) : kind === 'sphere' ? new T.SphereGeometry(0.5, 32, 24) : new T.CylinderGeometry(0.4, 0.4, 1, 32);
  const m = new T.Mesh(geo, mkMat(0xc9c9cf, M3.toon)); m.userData.joint = 'body'; m.userData.color = 0xc9c9cf; m.position.y = 0.5; j.add(m);
  return { root, joints: { body: j }, parts: [m], legTop: 0 };
}
function setModel(m) {
  if (M3.root) M3.scene.remove(M3.root);
  const keep = {}; for (const k in M3.joints) keep[k] = M3.joints[k].quaternion.clone();
  M3.root = m.root; M3.joints = m.joints; M3.parts = m.parts; M3.legTop = m.legTop;
  for (const k in keep) if (M3.joints[k]) M3.joints[k].quaternion.copy(keep[k]);
  M3.root.scale.setScalar(M3.heightScale);
  M3.scene.add(M3.root);
  if (!M3.joints[M3.sel]) M3.sel = Object.keys(M3.joints)[0];
  markSel(); render3D(); buildJointUI();
}
function rebuildModel() {
  if (M3.kind === 'mannequin') setModel(buildMannequin(M3.gender));
  else if (M3.kind === 'import' && M3.imported) setModel(M3.imported);
  else setModel(makePrimitive(M3.kind));
}
function markSel() {
  for (const p of M3.parts) if (p.material.emissive) p.material.emissive.setHex(p.userData.joint === M3.sel ? 0x2a4f8f : 0x000000);
}
function applyToon() {
  for (const p of M3.parts) { p.material.dispose && p.material.dispose(); p.material = mkMat(p.userData.color, M3.toon); }
  markSel(); render3D();
}
function sizeRenderer() {
  const k = Math.min(1, 1600 / Math.max(state.w, state.h));
  const w = Math.round(state.w * k), h = Math.round(state.h * k);
  if (M3.renderer.domElement.width !== w || M3.renderer.domElement.height !== h) {
    M3.renderer.setSize(w, h, false); M3.camera.aspect = w / h; M3.camera.updateProjectionMatrix();
  }
}
function render3D() {
  if (!M3.renderer || M3.pending) return;
  M3.pending = true;
  requestAnimationFrame(() => {
    M3.pending = false;
    if (!M3.root) return;
    sizeRenderer();
    const c = M3.cam, cosE = Math.cos(c.el);
    M3.camera.position.set(c.tx + Math.sin(c.az) * cosE * c.dist, c.ty + Math.sin(c.el) * c.dist, Math.cos(c.az) * cosE * c.dist);
    M3.camera.lookAt(c.tx, c.ty, 0);
    const la = M3.light.az * DEG, le = M3.light.el * DEG;
    M3.sun.position.set(Math.sin(la) * Math.cos(le) * 5, Math.sin(le) * 5, Math.cos(la) * Math.cos(le) * 5);
    M3.renderer.render(M3.scene, M3.camera);
    const cv = M3.renderer.domElement;
    if (M3.over && !M3.hidden) { if (cv.parentNode !== stage) stage.appendChild(cv); cv.style.display = 'block'; cv.style.opacity = M3.overOp; }
    else cv.style.display = 'none';
    const pv = $('#m3dPreview');
    if (pv) { const g = pv.getContext('2d'); pv.height = Math.round(pv.width * state.h / state.w); g.fillStyle = '#2b2d30'; g.fillRect(0, 0, pv.width, pv.height); g.drawImage(cv, 0, 0, pv.width, pv.height); }
  });
}
function buildJointUI() {
  const box = $('#m3dJoint'); if (!box) return;
  const sel = $('#m3dJointSel'); sel.innerHTML = '';
  const names = M3.kind === 'mannequin' ? JOINT_NAMES : [['body', 'Whole model']];
  names.forEach(([k, t]) => { const o = document.createElement('option'); o.value = k; o.textContent = t; if (k === M3.sel) o.selected = true; sel.appendChild(o); });
  syncJointSliders();
}
function syncJointSliders() {
  const j = M3.joints[M3.sel]; if (!j) return;
  const e = new M3.T.Euler().setFromQuaternion(j.quaternion, 'YXZ');
  [['X', e.x], ['Y', e.y], ['Z', e.z]].forEach(([a, v]) => { const i = $('#m3d' + a); if (i) { i.value = Math.round(v / DEG); $('#m3d' + a + 'V').textContent = Math.round(v / DEG) + '°'; } });
}
function setJointEuler() {
  const j = M3.joints[M3.sel]; if (!j) return;
  j.quaternion.setFromEuler(new M3.T.Euler(+$('#m3dX').value * DEG, +$('#m3dY').value * DEG, +$('#m3dZ').value * DEG, 'YXZ'));
  syncJointSliders(); render3D();
}
function applyPose(name) {
  const p = POSES[name]; if (!p) return;
  for (const k in M3.joints) M3.joints[k].quaternion.identity();
  M3.root.position.y = 0;
  for (const k in p) {
    if (k === '_y') { M3.root.position.y = p._y * M3.heightScale; continue; }
    if (M3.joints[k]) M3.joints[k].quaternion.setFromEuler(new M3.T.Euler(p[k][0] * DEG, p[k][1] * DEG, p[k][2] * DEG, 'YXZ'));
  }
  syncJointSliders(); render3D();
}
function fitModel() {
  M3.cam = { az: 0.5, el: 0.2, dist: 4.4 / (state.w / state.h > 1 ? 1 : 1), tx: 0, ty: M3.kind === 'mannequin' ? 0.88 * M3.heightScale : 0.5 };
  if (state.w / state.h < 1) M3.cam.dist *= 1.0;
  render3D();
}
function pick(e, cv) {
  const r = cv.getBoundingClientRect(), T = M3.T;
  const v = new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  const rc = new T.Raycaster(); rc.setFromCamera(v, M3.camera);
  const hit = rc.intersectObjects(M3.parts, false)[0];
  return hit ? hit.object.userData.joint : null;
}
function bind3DPreview() {
  const cv = $('#m3dPreview'); let drag = null;
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId);
    const hit = pick(e, cv);
    drag = { x: e.clientX, y: e.clientY, mode: e.shiftKey || e.button === 2 ? 'pan' : hit ? 'joint' : 'orbit' };
    if (hit && drag.mode === 'joint') { M3.sel = hit; markSel(); buildJointUI(); }
    render3D();
  });
  cv.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    const T = M3.T;
    if (drag.mode === 'orbit') { M3.cam.az -= dx * 0.01; M3.cam.el = clamp(M3.cam.el + dy * 0.01, -1.4, 1.4); }
    else if (drag.mode === 'pan') {
      const k = M3.cam.dist * 0.0035; const right = new T.Vector3().setFromMatrixColumn(M3.camera.matrixWorld, 0);
      M3.root.position.addScaledVector(right, dx * k); M3.root.position.y -= dy * k;
    } else {
      const j = M3.joints[M3.sel]; if (!j) return;
      const right = new T.Vector3().setFromMatrixColumn(M3.camera.matrixWorld, 0), up = new T.Vector3().setFromMatrixColumn(M3.camera.matrixWorld, 1);
      j.rotateOnWorldAxis(up, dx * 0.012); j.rotateOnWorldAxis(right, dy * 0.012);
      syncJointSliders();
    }
    render3D();
  });
  cv.addEventListener('pointerup', () => { drag = null; });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('wheel', e => { e.preventDefault(); M3.cam.dist = clamp(M3.cam.dist * Math.exp(e.deltaY * 0.001), 1, 20); render3D(); }, { passive: false });
}
async function importModelFile(f) {
  await load3D();
  const T = M3.T; let obj;
  const buf = await f.arrayBuffer();
  if (/\.(glb|gltf)$/i.test(f.name)) obj = (await new Promise((res, rej) => new SF3D.GLTFLoader().parse(buf, '', res, rej))).scene;
  else if (/\.obj$/i.test(f.name)) obj = new SF3D.OBJLoader().parse(new TextDecoder().decode(buf));
  else throw new Error('Use a .glb, .gltf or .obj file (FBX is not supported)');
  const box = new T.Box3().setFromObject(obj), size = box.getSize(new T.Vector3()), ctr = box.getCenter(new T.Vector3());
  const k = 1.7 / Math.max(size.x, size.y, size.z);
  const wrap = new T.Group(), inner = new T.Group(); inner.add(obj); obj.position.sub(ctr); inner.scale.setScalar(k); inner.position.y = size.y * k / 2; wrap.add(inner);
  const parts = [];
  obj.traverse(o => { if (o.isMesh) { const col = o.material && o.material.color ? o.material.color.getHex() : 0xc9c9cf; o.userData.joint = 'body'; o.userData.color = col; o.material = mkMat(col, M3.toon); parts.push(o); } });
  M3.imported = { root: wrap, joints: { body: inner }, parts, legTop: 0 };
  M3.kind = 'import'; $('#m3dKind').value = 'import'; setModel(M3.imported); fitModel();
  toast('Imported ' + f.name + ' (whole model is movable; only the mannequin has joints)');
}
function build3DPanel() {
  const b = $('#m3dBody');
  b.innerHTML = `
    <div class="seg" id="m3dGender"><button data-g="female" class="on">Female</button><button data-g="male">Male</button></div>
    <label class="select"><span>Model</span><select id="m3dKind"><option value="mannequin">Posable mannequin</option><option value="cube">Cube</option><option value="sphere">Sphere</option><option value="cylinder">Cylinder</option><option value="import">Imported file</option></select></label>
    <canvas id="m3dPreview" width="236" height="133" style="width:100%;border-radius:6px;border:1px solid #1d1f21;touch-action:none;display:block;margin:6px 0;cursor:grab"></canvas>
    <div class="hint">Drag the background = orbit · drag a body part = rotate that joint · Shift+drag = move model · wheel = zoom</div>
    <div class="grp">Pose</div>
    <div class="btnrow" id="m3dPoses"></div>
    <label class="select"><span>Joint</span><select id="m3dJointSel"></select></label>
    <div id="m3dJoint">
      <label class="slider"><span>Bend (X)</span><input type="range" id="m3dX" min="-180" max="180"><output id="m3dXV"></output></label>
      <label class="slider"><span>Turn (Y)</span><input type="range" id="m3dY" min="-180" max="180"><output id="m3dYV"></output></label>
      <label class="slider"><span>Tilt (Z)</span><input type="range" id="m3dZ" min="-180" max="180"><output id="m3dZV"></output></label>
    </div>
    <div class="btnrow"><button id="m3dResetJ">Reset joint</button><button id="m3dResetAll">Reset pose</button><button id="m3dCam">Reset camera</button></div>
    <div class="grp">Look</div>
    <label class="slider"><span>Light dir.</span><input type="range" id="m3dLa" min="-180" max="180" value="40"><output id="m3dLaV">40°</output></label>
    <label class="slider"><span>Light height</span><input type="range" id="m3dLe" min="0" max="90" value="50"><output id="m3dLeV">50°</output></label>
    <label class="slider"><span>Size</span><input type="range" id="m3dH" min="60" max="160" value="100"><output id="m3dHV">100%</output></label>
    <label class="check"><input type="checkbox" id="m3dToon"> Toon (flat manga-style shading)</label>
    <label class="check"><input type="checkbox" id="m3dOver" checked> Show over canvas as reference</label>
    <label class="slider"><span>Opacity</span><input type="range" id="m3dOp" min="10" max="100" value="85"><output id="m3dOpV">85%</output></label>
    <div class="btnrow"><button id="m3dPlace" class="primary">Place on new layer</button><button id="m3dImport">Import model…</button></div>
    <div class="hint">Place on new layer turns the current 3D view into a normal layer you can trace and paint over. Import accepts .glb / .gltf / .obj.</div>`;
  Object.keys(POSES).forEach(n => { const x = document.createElement('button'); x.textContent = n; x.onclick = () => applyPose(n); $('#m3dPoses').appendChild(x); });
  b.querySelectorAll('#m3dGender button').forEach(x => x.onclick = () => {
    M3.gender = x.dataset.g; b.querySelectorAll('#m3dGender button').forEach(y => y.classList.toggle('on', y === x));
    if (M3.kind !== 'mannequin') { M3.kind = 'mannequin'; $('#m3dKind').value = 'mannequin'; }
    rebuildModel();
  });
  $('#m3dKind').onchange = e => { M3.kind = e.target.value; if (M3.kind === 'import' && !M3.imported) { pickFile('.glb,.gltf,.obj', f => importModelFile(f).catch(err => toast(err.message))); M3.kind = 'mannequin'; e.target.value = 'mannequin'; return; } rebuildModel(); fitModel(); };
  $('#m3dJointSel').onchange = e => { M3.sel = e.target.value; markSel(); syncJointSliders(); render3D(); };
  ['X', 'Y', 'Z'].forEach(a => $('#m3d' + a).oninput = setJointEuler);
  $('#m3dResetJ').onclick = () => { const j = M3.joints[M3.sel]; if (j) { j.quaternion.identity(); syncJointSliders(); render3D(); } };
  $('#m3dResetAll').onclick = () => { for (const k in M3.joints) M3.joints[k].quaternion.identity(); M3.root.position.set(0, 0, 0); syncJointSliders(); render3D(); };
  $('#m3dCam').onclick = fitModel;
  $('#m3dLa').oninput = e => { M3.light.az = +e.target.value; $('#m3dLaV').textContent = e.target.value + '°'; render3D(); };
  $('#m3dLe').oninput = e => { M3.light.el = +e.target.value; $('#m3dLeV').textContent = e.target.value + '°'; render3D(); };
  $('#m3dH').oninput = e => { M3.heightScale = e.target.value / 100; $('#m3dHV').textContent = e.target.value + '%'; M3.root.scale.setScalar(M3.heightScale); render3D(); };
  $('#m3dToon').onchange = e => { M3.toon = e.target.checked; applyToon(); };
  $('#m3dOver').onchange = e => { M3.over = e.target.checked; render3D(); };
  $('#m3dOp').oninput = e => { M3.overOp = e.target.value / 100; $('#m3dOpV').textContent = e.target.value + '%'; render3D(); };
  $('#m3dImport').onclick = () => pickFile('.glb,.gltf,.obj', f => importModelFile(f).catch(err => toast(err.message)));
  $('#m3dPlace').onclick = placeOnLayer;
  bind3DPreview();
}
function placeOnLayer() {
  if (!M3.renderer) return;
  sizeRenderer(); M3.renderer.render(M3.scene, M3.camera);
  const cv = M3.renderer.domElement;
  timelineOp(() => {
    const l = createLayer('3D ' + (M3.kind === 'mannequin' ? M3.gender : M3.kind));
    const c = makeCel(true); c.getContext('2d').drawImage(cv, 0, 0, state.w, state.h);
    l.cels = new Map([[0, makeCel(false)]]);
    if (state.frame === 0) l.cels.set(0, c); else l.cels.set(state.frame, c);
    insertLayerAt(l, state.layers.length);
  });
  toast('Placed on a new layer. Turn off "Show over canvas" to hide the live reference.');
}
async function show3D() {
  const p = $('#m3dPanel');
  p.classList.remove('phidden', 'collapsed'); refreshDocks(); saveLayout();
  try {
    await load3D();
    if (!M3.root) { build3DPanel(); rebuildModel(); fitModel(); applyPose('Stand'); }
    M3.hidden = false; render3D();
  } catch (e) { toast('3D could not start: ' + e.message); }
}

