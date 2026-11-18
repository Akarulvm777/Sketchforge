/* ---------- VRoid / VRM characters in the 3D panel ----------
   vroid3d.js (tools/build_vrm.py) holds the built-in male / female VRoid models (by bluegi) as trimmed .glb.
   A VRM is loaded with three's GLTFLoader, then mapped onto the panel's own skeleton (the one the poses, hand poses,
   drag-to-move and body shape use): VRM humanoid bones -> pelvis / spine / neck / head / arms / legs + 3 bones per
   finger. Bones the panel has no joint for (chest, shoulders, toes, eyes, hair...) follow their nearest mapped parent.
   The T-pose arms are lowered (linear blend skinning) so "no rotation" = arms hanging, like the other mannequins.
   Textures and materials are kept. Load VRM… does the same with the user's own VRoid model.                        */
const VRM_ORDER = ['pelvis', 'spine', 'neck', 'head', 'armL', 'forearmL', 'handL', 'armR', 'forearmR', 'handR', 'legL', 'shinL', 'footL', 'legR', 'shinR', 'footR'];
const VRM_PARENT = { pelvis: null, spine: 'pelvis', neck: 'spine', head: 'neck', armL: 'spine', forearmL: 'armL', handL: 'forearmL', armR: 'spine', forearmR: 'armR', handR: 'forearmR',
  legL: 'pelvis', shinL: 'legL', footL: 'shinL', legR: 'pelvis', shinR: 'legR', footR: 'shinR' };
const VRM_FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'];
for (const s of ['L', 'R']) for (const f of VRM_FINGERS) for (let k = 1; k <= 3; k++) { const b = f + k + s; VRM_ORDER.push(b); VRM_PARENT[b] = k === 1 ? 'hand' + s : f + (k - 1) + s; }
function vrmBoneMap(v1) {
  const M = { pelvis: 'hips', spine: 'spine', neck: 'neck', head: 'head' };
  const FN = { thumb: v1 ? ['ThumbMetacarpal', 'ThumbProximal', 'ThumbDistal'] : ['ThumbProximal', 'ThumbIntermediate', 'ThumbDistal'],
    index: ['IndexProximal', 'IndexIntermediate', 'IndexDistal'], middle: ['MiddleProximal', 'MiddleIntermediate', 'MiddleDistal'],
    ring: ['RingProximal', 'RingIntermediate', 'RingDistal'], pinky: ['LittleProximal', 'LittleIntermediate', 'LittleDistal'] };
  for (const [s, side] of [['L', 'left'], ['R', 'right']]) {
    Object.assign(M, { ['arm' + s]: side + 'UpperArm', ['forearm' + s]: side + 'LowerArm', ['hand' + s]: side + 'Hand',
      ['leg' + s]: side + 'UpperLeg', ['shin' + s]: side + 'LowerLeg', ['foot' + s]: side + 'Foot' });
    for (const f of VRM_FINGERS) for (let k = 1; k <= 3; k++) M[f + k + s] = side + FN[f][k - 1];
  }
  return M;
}
const b64bytes = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; };

/* VRM (ArrayBuffer) -> model data for buildVrmMesh() */
async function vrmConvert(buf) {
  const T = M3.T;
  const gltf = await new Promise((res, rej) => new SF3D.GLTFLoader().parse(buf, '', res, rej));
  const json = gltf.parser.json, ext = json.extensions || {}, v1 = !!ext.VRMC_vrm;
  const hb = {};
  if (v1) for (const k in ext.VRMC_vrm.humanoid.humanBones) hb[k] = ext.VRMC_vrm.humanoid.humanBones[k].node;
  else if (ext.VRM) for (const h of ext.VRM.humanoid.humanBones) hb[h.bone] = h.node;
  else throw new Error('this file has no VRM humanoid skeleton (export it from VRoid Studio as .vrm)');
  const scene = gltf.scene;
  if (!v1) scene.rotation.y = Math.PI; // VRM 0.x faces -Z
  scene.updateMatrixWorld(true);
  const MAP = vrmBoneMap(v1), node2ours = new Map(), wp = {};
  let fingers = true;
  for (const name of VRM_ORDER) {
    let ni = hb[MAP[name]];
    if (ni == null && name === 'neck') ni = hb.head;
    if (ni == null) { if (/^(thumb|index|middle|ring|pinky)/.test(name)) { fingers = false; continue; } throw new Error('the VRM skeleton has no ' + MAP[name]); }
    const o = await gltf.parser.getDependency('node', ni);
    if (!node2ours.has(o)) node2ours.set(o, name);
    wp[name] = new T.Vector3().setFromMatrixPosition(o.matrixWorld);
  }
  const order = VRM_ORDER.filter(n => wp[n]), idx = Object.fromEntries(order.map((n, i) => [n, i]));
  const oursOf = bone => { for (let o = bone; o; o = o.parent) if (node2ours.has(o)) return idx[node2ours.get(o)]; return 0; };
  // gather every skinned primitive: rest positions (world), uvs, our bone weights, materials
  const prims = [];
  scene.traverse(o => { if (o.isSkinnedMesh && o.visible !== false) prims.push(o); });
  let nv = 0, ni = 0; for (const m of prims) { nv += m.geometry.attributes.position.count; ni += m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count; }
  const pos = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), si = new Uint8Array(nv * 4), sw = new Float32Array(nv * 4), index = new Uint32Array(ni);
  const groups = [], mats = [], v = new T.Vector3();
  let vo = 0, io = 0;
  for (const m of prims) {
    const g = m.geometry, P = g.attributes.position, UV = g.attributes.uv, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight, n = P.count;
    m.skeleton.update();
    const bmap = m.skeleton.bones.map(oursOf);
    const xform = (m.applyBoneTransform || m.boneTransform).bind(m);
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(P, i); xform(i, v); v.applyMatrix4(m.matrixWorld);
      pos[(vo + i) * 3] = v.x; pos[(vo + i) * 3 + 1] = v.y; pos[(vo + i) * 3 + 2] = v.z;
      if (UV) { uv[(vo + i) * 2] = UV.getX(i); uv[(vo + i) * 2 + 1] = UV.getY(i); }
      const acc = new Map();
      for (let k = 0; k < 4; k++) { const w = SW.getComponent(i, k); if (w > 0) { const b = bmap[SI.getComponent(i, k)]; acc.set(b, (acc.get(b) || 0) + w); } }
      const top = [...acc].sort((a, b) => b[1] - a[1]).slice(0, 4), tot = top.reduce((s, x) => s + x[1], 0) || 1;
      top.forEach(([b, w], k) => { si[(vo + i) * 4 + k] = b; sw[(vo + i) * 4 + k] = w / tot; });
      if (!top.length) sw[(vo + i) * 4] = 1;
    }
    const start = io;
    if (g.index) for (let i = 0; i < g.index.count; i++) index[io++] = g.index.getX(i) + vo; else for (let i = 0; i < n; i++) index[io++] = vo + i;
    const mt = Array.isArray(m.material) ? m.material[0] : m.material;
    groups.push({ start, count: io - start, mat: mats.length });
    mats.push({ map: mt.map || null, color: mt.color ? mt.color.getHex() : 0xffffff, transparent: !!mt.transparent, alphaTest: mt.alphaTest || 0,
      side: mt.side, opacity: mt.opacity == null ? 1 : mt.opacity, name: mt.name || '' });
    vo += n;
  }
  // feet on the ground, centred on the hips
  let minY = Infinity, maxY = -Infinity; for (let i = 1; i < pos.length; i += 3) { minY = Math.min(minY, pos[i]); maxY = Math.max(maxY, pos[i]); }
  const sh = new T.Vector3(-wp.pelvis.x, -minY, -wp.pelvis.z);
  for (let i = 0; i < nv; i++) { pos[i * 3] += sh.x; pos[i * 3 + 1] += sh.y; pos[i * 3 + 2] += sh.z; }
  for (const k in wp) wp[k].add(sh);
  const data = { order, parents: order.map(n => VRM_PARENT[n] ? idx[VRM_PARENT[n]] : -1), pos, uv, si, sw, index, groups, mats, wp, fingers, height: maxY - minY,
    name: (v1 ? ext.VRMC_vrm.meta.name : ext.VRM.meta && ext.VRM.meta.title) || 'VRM' };
  vrmTips(data); vrmArmsDown(data); vrmBend(data);
  return data;
}
/* finger tips: the farthest point of each last finger bone's vertices, along the finger */
function vrmTips(d) {
  d.tips = {};
  if (!d.fingers) return;
  const T = M3.T, n = d.pos.length / 3;
  for (const s of ['L', 'R']) for (const f of VRM_FINGERS) {
    const b3 = d.order.indexOf(f + '3' + s), j2 = d.wp[f + '2' + s], j3 = d.wp[f + '3' + s], dir = j3.clone().sub(j2).normalize();
    let best = j3.distanceTo(j2) * 0.8;
    for (let i = 0; i < n; i++) {
      if (d.si[i * 4] !== b3 || d.sw[i * 4] < 0.5) continue;
      const t = (d.pos[i * 3] - j3.x) * dir.x + (d.pos[i * 3 + 1] - j3.y) * dir.y + (d.pos[i * 3 + 2] - j3.z) * dir.z;
      if (t > best) best = t;
    }
    d.wp['tip_' + f + s] = j3.clone().addScaledVector(dir, best * 0.92);
  }
}
/* lower the T-pose arms so they hang down: rotate arm, forearm and hand to point down, skin the mesh (LBS) */
function vrmArmsDown(d) {
  const T = M3.T, bones = d.order.map(() => new T.Bone());
  d.order.forEach((nm, i) => { const p = d.parents[i]; bones[i].position.copy(p < 0 ? d.wp[nm] : d.wp[nm].clone().sub(d.wp[d.order[p]])); if (p >= 0) bones[p].add(bones[i]); });
  bones[0].updateMatrixWorld(true);
  const inv = bones.map(b => b.matrixWorld.clone().invert()), I = n => d.order.indexOf(n), down = new T.Vector3(0, -1, 0);
  d.handQ = {};
  for (const s of ['L', 'R']) {
    const seg = [['arm' + s, 'forearm' + s], ['forearm' + s, 'hand' + s], ['hand' + s, d.fingers ? 'middle1' + s : null]];
    for (const [a, b] of seg) {
      bones[0].updateMatrixWorld(true);
      const bone = bones[I(a)], from = d.wp[a], to = b ? d.wp[b] : null; if (!to) continue;
      const pq = bone.parent.getWorldQuaternion(new T.Quaternion());
      const dir = to.clone().sub(from).applyQuaternion(pq).normalize();
      const q = new T.Quaternion().setFromUnitVectors(dir, down);
      bone.quaternion.copy(pq.clone().invert().multiply(q).multiply(pq));
    }
    bones[0].updateMatrixWorld(true);
    d.handQ[s] = bones[I('hand' + s)].getWorldQuaternion(new T.Quaternion());
  }
  bones[0].updateMatrixWorld(true);
  const mats = bones.map((b, i) => new T.Matrix4().multiplyMatrices(b.matrixWorld, inv[i]));
  const n = d.pos.length / 3, p = new T.Vector3(), acc = new T.Vector3(), t = new T.Vector3();
  for (let i = 0; i < n; i++) {
    p.set(d.pos[i * 3], d.pos[i * 3 + 1], d.pos[i * 3 + 2]); acc.set(0, 0, 0);
    for (let k = 0; k < 4; k++) { const w = d.sw[i * 4 + k]; if (w) acc.addScaledVector(t.copy(p).applyMatrix4(mats[d.si[i * 4 + k]]), w); }
    d.pos[i * 3] = acc.x; d.pos[i * 3 + 1] = acc.y; d.pos[i * 3 + 2] = acc.z;
  }
  for (const nm of d.order) d.wp[nm] = new T.Vector3().setFromMatrixPosition(bones[I(nm)].matrixWorld);
  for (const k in d.wp) if (k.startsWith('tip_')) { const b = k.slice(4, -1).replace(/$/, '3') + k.slice(-1); d.wp[k].applyMatrix4(mats[I(b)]); }
}
/* bend axis of each finger: a positive angle curls it towards the palm (thumb: towards the middle finger) */
function vrmBend(d) {
  d.bend = {};
  if (!d.fingers) return;
  const T = M3.T;
  for (const s of ['L', 'R']) {
    const palm = new T.Vector3(0, -1, 0).applyQuaternion(d.handQ[s]); // T-pose palms face down
    for (const f of VRM_FINGERS) {
      const dir = d.wp['tip_' + f + s].clone().sub(d.wp[f + '1' + s]).normalize();
      let to = f === 'thumb' ? d.wp['middle1' + s].clone().sub(d.wp['thumb1' + s]) : palm.clone();
      to.addScaledVector(dir, -to.dot(dir)).normalize();
      d.bend[f + s] = dir.clone().cross(to).normalize().toArray();
    }
  }
}
/* smooth normals that ignore UV seams (same position = same normal) */
function weldNormals(geo, weld) {
  geo.computeVertexNormals();
  const N = geo.attributes.normal, a = N.array, sum = new Float32Array(a.length);
  for (let i = 0; i < weld.length; i++) { const r = weld[i] * 3; sum[r] += a[i * 3]; sum[r + 1] += a[i * 3 + 1]; sum[r + 2] += a[i * 3 + 2]; }
  for (let i = 0; i < weld.length; i++) { const r = weld[i] * 3, l = Math.hypot(sum[r], sum[r + 1], sum[r + 2]) || 1; a[i * 3] = sum[r] / l; a[i * 3 + 1] = sum[r + 1] / l; a[i * 3 + 2] = sum[r + 2] / l; }
  N.needsUpdate = true;
}
/* Grey mannequin look (default): skin, clothes and hair become one grey (the texture keeps only its transparency),
   eyes, brows and mouth stay as grey shades so you can still see where the face looks. */
M3.vrmLook = 'grey'; try { M3.vrmLook = localStorage.getItem('sketchforge.m3dlook') || 'grey'; } catch (e) { /* ignore */ }
const VRM_DETAIL = /eye|brow|mouth/i;
function vrmGreyTex(desc) {
  if (!desc.map || !desc.map.image) return null;
  if (desc.greyMap) return desc.greyMap;
  const T = M3.T, img = desc.map.image, w = img.width, h = img.height, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const im = g.getImageData(0, 0, w, h), d = im.data, detail = VRM_DETAIL.test(desc.name);
  for (let i = 0; i < d.length; i += 4) { const l = detail ? 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] : 255; d[i] = d[i + 1] = d[i + 2] = l; }
  g.putImageData(im, 0, 0);
  const t = new T.CanvasTexture(c);
  for (const k of ['flipY', 'colorSpace', 'wrapS', 'wrapT', 'magFilter', 'minFilter']) if (k in desc.map) t[k] = desc.map[k];
  t.needsUpdate = true;
  return (desc.greyMap = t);
}
function mkVrmMat(desc, toon) {
  const grey = M3.vrmLook !== 'color', detail = VRM_DETAIL.test(desc.name);
  const T = M3.T, o = { color: grey ? (detail ? 0xffffff : GREY) : desc.color, map: grey ? vrmGreyTex(desc) : desc.map, vertexColors: true, transparent: desc.transparent, alphaTest: desc.alphaTest, side: desc.side, opacity: desc.opacity };
  if (desc.transparent) o.depthWrite = false;
  if (toon && /face|eye|brow|mouth/i.test(desc.name)) { // anime faces are shaded almost flat: no hard shadow patches across the face
    if (!M3.gradSoft) { const g = new T.DataTexture(new Uint8Array([215, 255]), 2, 1, T.RedFormat); g.minFilter = g.magFilter = T.NearestFilter; g.needsUpdate = true; M3.gradSoft = g; }
    return new T.MeshToonMaterial({ ...o, gradientMap: M3.gradSoft });
  }
  return toon ? new T.MeshToonMaterial({ ...o, gradientMap: M3.grad }) : new T.MeshStandardMaterial({ ...o, roughness: 0.85, metalness: 0 });
}
/* model data -> { root, joints, parts, legTop }, same shape as buildRigged() */
function buildVrmMesh(d) {
  const T = M3.T, n = d.pos.length / 3, geo = new T.BufferGeometry();
  const p = d.pos.slice();
  geo.setAttribute('position', new T.BufferAttribute(p, 3));
  geo.setAttribute('uv', new T.BufferAttribute(d.uv, 2));
  geo.setAttribute('skinIndex', new T.Uint16BufferAttribute(d.si, 4));
  geo.setAttribute('skinWeight', new T.BufferAttribute(d.sw, 4));
  geo.setAttribute('color', new T.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  geo.setIndex(new T.BufferAttribute(d.index, 1));
  for (const g of d.groups) geo.addGroup(g.start, g.count, g.mat);
  if (!d.weld) { const key = new Map(); d.weld = new Uint32Array(n); for (let i = 0; i < n; i++) { const k = Math.round(p[i * 3] * 1e4) + ',' + Math.round(p[i * 3 + 1] * 1e4) + ',' + Math.round(p[i * 3 + 2] * 1e4); if (!key.has(k)) key.set(k, i); d.weld[i] = key.get(k); } }
  weldNormals(geo, d.weld);
  const joints = {}, list = [], j0 = {};
  d.order.forEach((nm, i) => {
    const b = new T.Bone(); b.name = nm; joints[nm] = b; list.push(b); j0[nm] = d.wp[nm].toArray();
    const pi = d.parents[i]; b.position.copy(pi < 0 ? d.wp[nm] : d.wp[nm].clone().sub(d.wp[d.order[pi]]));
    if (pi >= 0) list[pi].add(b);
  });
  const mesh = new T.SkinnedMesh(geo, d.mats.map(m => mkVrmMat(m, M3.toon)));
  mesh.add(joints.pelvis); mesh.bind(new T.Skeleton(list)); mesh.frustumCulled = false;
  const dom = new Uint8Array(n);
  for (let i = 0; i < n; i++) { let best = 0; for (let k = 1; k < 4; k++) if (d.sw[i * 4 + k] > d.sw[i * 4 + best]) best = k; dom[i] = d.si[i * 4 + best]; }
  let minY0 = Infinity; for (let i = 1; i < p.length; i += 3) if (p[i] < minY0) minY0 = p[i];
  const tips0 = {}; for (const k in d.wp) if (k.startsWith('tip_')) tips0[k.slice(4)] = d.wp[k].toArray();
  mesh.userData = { color: 0xffffff, rigged: true, vc: true, vrm: d, dom, boneNames: d.order.slice(), p0: p.slice(), w: d.sw, si: d.si, j0, minY0,
    parents: d.parents, bend: d.bend, tips0 };
  const root = new T.Group(); root.add(mesh);
  return { root, joints, parts: [mesh], legTop: joints.pelvis.position.y };
}
/* built-in VRoid models (vroid3d.js), converted once per session */
M3.style = 'vroid'; M3.vrm = {};
function vrmReady(g) { return M3.vrm[g] && !(M3.vrm[g] instanceof Promise) ? M3.vrm[g] : null; }
function vrmLoad(g) {
  if (M3.vrm[g]) return Promise.resolve(M3.vrm[g]);
  if (g === 'custom') return Promise.reject(new Error('no VRM loaded'));
  if (typeof SF_VRM === 'undefined' || !SF_VRM[g]) return Promise.reject(new Error('vroid3d.js is missing'));
  return (M3.vrm[g] = vrmConvert(b64bytes(SF_VRM[g])).then(d => (M3.vrm[g] = d), e => { delete M3.vrm[g]; throw e; }));
}
async function loadUserVrm(file) {
  await load3D();
  toast('Loading ' + file.name + '…');
  try {
    M3.vrm.custom = await vrmConvert(await file.arrayBuffer());
    M3.gender = 'custom'; M3.style = 'vroid'; M3.kind = 'mannequin';
    syncModelButtons(); rebuildModel(); fitModel();
    toast(`${M3.vrm.custom.name} is ready to pose${M3.vrm.custom.fingers ? '' : ' (this model has no finger bones)'}`, 3500);
  } catch (e) { toast('Could not load this VRM: ' + e.message, 5000); }
}
function syncModelButtons() {
  const b = $('#m3dBody'); if (!b) return;
  b.querySelectorAll('#m3dGender button').forEach(x => x.classList.toggle('on', x.dataset.g === M3.gender));
  const k = $('#m3dKind'); if (k) k.value = M3.kind === 'mannequin' ? (M3.style === 'simple' ? 'simple' : 'mannequin') : M3.kind;
}
