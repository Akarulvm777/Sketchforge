#!/usr/bin/env node
// Builds models3d.js (rigged male / female mannequins for the 3D panel) from assets/HumanLowPolyBaseMesh.fbx.
// Usage: npm install (installs the "three" devDependency), then: node tools/build_models.mjs
// Steps: weld vertices, scale to metres, place 16 body joints from landmarks + 3 joints per finger (fingers are found
// from the mesh: the parts of the hand that split apart away from the wrist), compute smoothed skin weights,
// bake the A-pose arms down so the rest pose matches the panel's poses (arms hanging, facing +Z), quantize, write.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(ROOT, 'assets', 'HumanLowPolyBaseMesh.fbx');
const OUT = path.join(ROOT, 'models3d.js');
const MALE_HEIGHT = 1.8; // metres; the female keeps her height relative to the male

// Joint landmarks in source units: [dx from body centre, y]. Mirrored for the right side (dx < 0).
// Picked from front renders of the source mesh, then refined to the limb centre (see refine()).
const LM = {
  female: { mesh: 'LOD7', shoulder: [2.05, 18.65], elbow: [4.2, 15.27], wrist: [5.67, 13.4], tip: [6.33, 11.8],
    hip: [1.27, 11.6], knee: [1.67, 6.87], ankle: [2.0, 1.0], neck: 19.27, head: 20.3 },
  male: { mesh: 'Male1', shoulder: [2.5, 19.25], elbow: [4.53, 15.67], wrist: [6.4, 13.67], tip: [6.8, 12.2],
    hip: [1.2, 11.95], knee: [1.56, 6.87], ankle: [2.07, 0.87], neck: 20.07, head: 21.0 }
};
// Bone "radius" as a fraction of body height: distances to each bone are divided by it before choosing the bone.
const RAD = { pelvis: 0.075, spine: 0.085, neck: 0.035, head: 0.06, arm: 0.03, forearm: 0.024, hand: 0.022,
  leg: 0.05, shin: 0.032, foot: 0.03 };
const ORDER = ['pelvis', 'spine', 'neck', 'head', 'armL', 'forearmL', 'handL', 'armR', 'forearmR', 'handR',
  'legL', 'shinL', 'footL', 'legR', 'shinR', 'footR'];
const PARENT = { pelvis: null, spine: 'pelvis', neck: 'spine', head: 'neck', armL: 'spine', forearmL: 'armL', handL: 'forearmL',
  armR: 'spine', forearmR: 'armR', handR: 'forearmR', legL: 'pelvis', shinL: 'legL', footL: 'shinL', legR: 'pelvis', shinR: 'legR', footR: 'shinR' };
// 3 bones per finger: thumb1L (base) -> thumb2L -> thumb3L (tip segment), parent of the first one = the hand
const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'];
for (const s of ['L', 'R']) for (const f of FINGERS) for (let k = 1; k <= 3; k++) { const b = f + k + s; ORDER.push(b); PARENT[b] = k === 1 ? 'hand' + s : f + (k - 1) + s; }
const isFinger = b => FINGERS.some(f => b.startsWith(f));

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function loadMeshes() {
  const buf = fs.readFileSync(SRC);
  const warn = console.warn; console.warn = () => {};
  const obj = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  console.warn = warn;
  obj.updateMatrixWorld(true);
  const out = {};
  obj.traverse(o => {
    if (!o.isMesh) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', o.geometry.attributes.position.clone());
    g.applyMatrix4(o.matrixWorld);
    out[o.name] = mergeVertices(g, 1e-4);
  });
  return out;
}

// Centroid of the vertices inside a cylinder (along Z) of radius r around (x, y), iterated a few times.
function refine(pos, x, y, r, keepY) {
  let cx = x, cy = y, cz = 0;
  for (let it = 0; it < 4; it++) {
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (let i = 0; i < pos.count; i++) {
      const dx = pos.getX(i) - cx, dy = pos.getY(i) - cy;
      if (dx * dx + dy * dy < r * r) { sx += pos.getX(i); sy += pos.getY(i); sz += pos.getZ(i); n++; }
    }
    if (!n) break;
    cx = sx / n; if (!keepY) cy = sy / n; cz = sz / n;
  }
  return V(cx, cy, cz);
}
function sliceCentreZ(pos, x, y, r) { return refine(pos, x, y, r, true).z; }

function placeJoints(g, lm) {
  const pos = g.attributes.position;
  g.computeBoundingBox();
  const bb = g.boundingBox, cx = (bb.min.x + bb.max.x) / 2;
  const J = {};
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    const at = (k, r, keepY) => refine(pos, cx + sx * lm[k][0], lm[k][1], r, keepY);
    const sh = V(cx + sx * lm.shoulder[0], lm.shoulder[1], sliceCentreZ(pos, cx + sx * lm.shoulder[0], lm.shoulder[1], 0.5));
    J['arm' + s] = sh;
    J['forearm' + s] = at('elbow', 0.55);
    J['hand' + s] = at('wrist', 0.4);
    J['tip' + s] = at('tip', 0.35);
    J['leg' + s] = V(cx + sx * lm.hip[0], lm.hip[1], sliceCentreZ(pos, cx + sx * lm.hip[0], lm.hip[1], 0.7));
    J['shin' + s] = at('knee', 0.7, true);
    J['foot' + s] = at('ankle', 0.45, true);
    // toe: the most forward vertex of this foot
    let best = null;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > 1.2 || Math.sign(pos.getX(i) - cx) !== sx) continue;
      if (!best || pos.getZ(i) > best.z) best = V(pos.getX(i), pos.getY(i), pos.getZ(i));
    }
    J['toe' + s] = V(J['foot' + s].x, 0.25, best.z - 0.3);
  }
  findFingers(g, J);
  const hipY = (J.legL.y + J.legR.y) / 2;
  J.pelvis = V(cx, hipY + 0.25, sliceCentreZ(pos, cx, hipY + 0.25, 1.0));
  J.neck = V(cx, lm.neck, sliceCentreZ(pos, cx, lm.neck, 0.4));
  J.spine = V(cx, J.pelvis.y + (J.neck.y - J.pelvis.y) * 0.14, 0);
  J.spine.z = sliceCentreZ(pos, cx, J.spine.y, 1.0);
  J.head = V(cx, lm.head, sliceCentreZ(pos, cx, lm.head, 0.4));
  J.top = V(cx, bb.max.y, J.head.z);
  return J;
}

// Fingers: hand vertices far from the wrist split into separate pieces of the mesh. The thumb splits off early
// (~25% of the hand length), the 4 fingers later (~65%). Each piece gets 3 joints; vertices get a finger label.
function findFingers(g, J) {
  const pos = g.attributes.position, n = pos.count, idx = g.index.array;
  const nbr = Array.from({ length: n }, () => []);
  for (let t = 0; t < idx.length; t += 3) for (let k = 0; k < 3; k++) { const a = idx[t + k], b = idx[t + (k + 1) % 3]; nbr[a].push(b); nbr[b].push(a); }
  g.userData.finger = new Int16Array(n).fill(-1); // index into ORDER of the finger bone chain start, per vertex
  const P = i => V(pos.getX(i), pos.getY(i), pos.getZ(i));
  for (const s of ['L', 'R']) {
    const W = J['hand' + s], T = J['tip' + s], ax = T.clone().sub(W), L = ax.length(); ax.normalize();
    const elbowDist = W.distanceTo(J['forearm' + s]);
    const t = new Float32Array(n), inHand = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const p = P(i), d = p.clone().sub(W); t[i] = d.dot(ax) / L;
      const radial = d.clone().addScaledVector(ax, -d.dot(ax)).length();
      inHand[i] = t[i] > -0.1 && t[i] < 1.6 && radial < L * 0.9 && p.distanceTo(J['forearm' + s]) > elbowDist * 0.8 ? 1 : 0;
    }
    const comps = tau => {
      const lab = new Int32Array(n).fill(-1), out = [];
      for (let i = 0; i < n; i++) {
        if (!inHand[i] || t[i] < tau || lab[i] >= 0) continue;
        const st = [i], vs = []; lab[i] = out.length;
        while (st.length) { const u = st.pop(); vs.push(u); for (const v of nbr[u]) if (inHand[v] && t[v] >= tau && lab[v] < 0) { lab[v] = out.length; st.push(v); } }
        out.push(vs);
      }
      return out.filter(c => c.length > 8).sort((a, b) => b.length - a.length);
    };
    const cen = vs => vs.reduce((a, i) => a.add(P(i)), V(0, 0, 0)).multiplyScalar(1 / vs.length);
    // thumb: the piece (other than the main hand) that splits off below ~0.45
    let thumb = null;
    for (let tau = 0.15; tau <= 0.45 && !thumb; tau += 0.05) { const c = comps(tau); if (c.length >= 2) thumb = c[1]; }
    // fingers: 4 pieces at a higher cut, then grown back towards the knuckles
    let seeds = null;
    for (let tau = 0.55; tau <= 0.9 && !seeds; tau += 0.05) { const c = comps(tau); if (c.length >= 4) seeds = c.slice(0, 4); }
    if (!thumb || !seeds) throw new Error('fingers not found on hand ' + s);
    const lab = new Int8Array(n).fill(-1), q = [];
    seeds.forEach((c, k) => c.forEach(i => { lab[i] = k; q.push(i); }));
    while (q.length) { const u = q.shift(); for (const v of nbr[u]) if (lab[v] < 0 && inHand[v] && t[v] >= 0.5) { lab[v] = lab[u]; q.push(v); } }
    const tc = cen(thumb);
    const fingers = seeds.map((c, k) => { const vs = []; for (let i = 0; i < n; i++) if (lab[i] === k) vs.push(i); return vs; })
      .sort((a, b) => cen(a).distanceTo(tc) - cen(b).distanceTo(tc)); // index is next to the thumb
    const chains = [thumb, ...fingers];
    chains.forEach((vs, fi) => {
      const name = FINGERS[fi];
      const tmin = Math.min(...vs.map(i => t[i]));
      const baseVs = vs.filter(i => t[i] < tmin + 0.06), base = cen(baseVs.length ? baseVs : vs);
      let tip = null, best = -1; for (const i of vs) { const d = P(i).distanceTo(base); if (d > best) { best = d; tip = P(i); } }
      // pull the tip slightly inside the finger, the root back into the palm (the knuckle)
      const dir = tip.clone().sub(base).normalize();
      const root = name === 'thumb' ? base.clone().addScaledVector(dir, -L * 0.12) : base.clone().addScaledVector(dir, -L * 0.1);
      const end = tip.clone().addScaledVector(dir, -L * 0.03);
      const seg = end.clone().sub(root);
      const fr = name === 'thumb' ? [0, 0.42, 0.72] : [0, 0.45, 0.74];
      fr.forEach((f, k) => { J[name + (k + 1) + s] = root.clone().addScaledVector(seg, f); });
      J[name + 'Tip' + s] = end;
      const bi = ORDER.indexOf(name + '1' + s);
      for (const i of vs) g.userData.finger[i] = bi;
    });
    J['knuckle' + s] = ['index', 'middle', 'ring', 'pinky'].reduce((a, f) => a.add(J[f + '1' + s]), V(0, 0, 0)).multiplyScalar(0.25);
  }
}

function segDist(p, a, b) {
  const ab = b.clone().sub(a), t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1);
  return p.distanceTo(a.clone().addScaledVector(ab, t));
}

function computeWeights(g, J, H) {
  const pos = g.attributes.position, n = pos.count, nb = ORDER.length;
  // Each bone is one or more segments; the vertex goes to the bone with the smallest distance / radius.
  const segs = {
    pelvis: [[J.legL, J.legR], [J.pelvis, J.spine]],
    // clavicle segments reach only part-way to the shoulder and are thinner, so the deltoid follows the arm
    spine: [[J.spine, J.neck], [J.neck, J.armL.clone().lerp(J.neck, 0.6), 0.45], [J.neck, J.armR.clone().lerp(J.neck, 0.6), 0.45]],
    neck: [[J.neck, J.head]], head: [[J.head, J.top]]
  };
  for (const s of ['L', 'R']) {
    segs['arm' + s] = [[J['arm' + s], J['forearm' + s]]];
    segs['forearm' + s] = [[J['forearm' + s], J['hand' + s]]];
    segs['hand' + s] = [[J['hand' + s], J['knuckle' + s]]];
    for (const f of FINGERS) {
      segs[f + '1' + s] = [[J[f + '1' + s], J[f + '2' + s]]];
      segs[f + '2' + s] = [[J[f + '2' + s], J[f + '3' + s]]];
      segs[f + '3' + s] = [[J[f + '3' + s], J[f + 'Tip' + s]]];
    }
    segs['leg' + s] = [[J['leg' + s], J['shin' + s]]];
    segs['shin' + s] = [[J['shin' + s], J['foot' + s]]];
    segs['foot' + s] = [[J['foot' + s], J['toe' + s]]];
  }
  const rad = ORDER.map(b => (isFinger(b) ? 0.01 : RAD[b.replace(/[LR]$/, '')]) * H);
  const fing = g.userData.finger;
  let W = new Float32Array(n * nb);
  const p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(pos, i);
    let best = 0, bd = Infinity;
    const fb = fing[i];
    ORDER.forEach((b, bi) => {
      if (fb >= 0 ? (bi < fb || bi > fb + 2) : isFinger(b)) return; // finger vertices: only their finger; others: no finger bones
      let d = Infinity; for (const [a, c, f = 1] of segs[b]) d = Math.min(d, segDist(p, a, c) / f);
      d /= rad[bi];
      if (d < bd) { bd = d; best = bi; }
    });
    W[i * nb + best] = 1;
  }
  // Smooth across mesh edges so joints bend softly.
  const idx = g.index.array, nbr = Array.from({ length: n }, () => new Set());
  for (let t = 0; t < idx.length; t += 3) for (let k = 0; k < 3; k++) { const a = idx[t + k], b = idx[t + (k + 1) % 3]; nbr[a].add(b); nbr[b].add(a); }
  const nl = nbr.map(s => Int32Array.from(s));
  for (let it = 0; it < 12; it++) {
    const W2 = new Float32Array(W.length);
    for (let i = 0; i < n; i++) {
      const o = i * nb, L = nl[i];
      for (let b = 0; b < nb; b++) {
        let s = 0; for (let k = 0; k < L.length; k++) s += W[L[k] * nb + b];
        W2[o + b] = 0.5 * W[o + b] + 0.5 * (L.length ? s / L.length : W[o + b]);
      }
    }
    W = W2;
  }
  // Keep the 4 strongest bones per vertex, quantize to bytes that sum to 255.
  const si = new Uint8Array(n * 4), sw = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const row = Array.from(W.subarray(i * nb, i * nb + nb), (w, b) => [w, b]).sort((a, b) => b[0] - a[0]).slice(0, 4);
    const tot = row.reduce((s, r) => s + r[0], 0) || 1;
    const q = row.map(([w]) => Math.floor(w / tot * 255));
    q[0] += 255 - q.reduce((s, v) => s + v, 0); // rounding remainder goes to the strongest bone; sum is exactly 255
    row.forEach(([, b], k) => { si[i * 4 + k] = b; sw[i * 4 + k] = q[k]; });
  }
  return { si, sw };
}

function makeSkeleton(J) {
  const bones = {}, list = [];
  for (const name of ORDER) {
    const b = new THREE.Bone(); b.name = name; bones[name] = b; list.push(b);
    const par = PARENT[name];
    if (par) { b.position.copy(J[name]).sub(J[par]); bones[par].add(b); } else b.position.copy(J[name]);
  }
  bones.pelvis.updateMatrixWorld(true);
  return { bones, list };
}

// Rotate the arms (and forearms, hands) so they hang straight down, deform the mesh with linear blend skinning.
function bakeArmsDown(g, J, si, sw) {
  const { bones, list } = makeSkeleton(J);
  const inv = list.map(b => b.matrixWorld.clone().invert());
  const down = V(0, -1, 0);
  for (const s of ['L', 'R']) {
    for (const [b, from, to] of [['arm' + s, 'arm' + s, 'forearm' + s], ['forearm' + s, 'forearm' + s, 'hand' + s], ['hand' + s, 'hand' + s, 'tip' + s]]) {
      bones.pelvis.updateMatrixWorld(true);
      const bone = bones[b];
      const a = V(0, 0, 0).applyMatrix4(bone.matrixWorld);
      // world direction of this segment after the parents' rotations
      const childLocal = J[to].clone().sub(J[from]);
      const parentQ = bone.parent.getWorldQuaternion(new THREE.Quaternion());
      const dirWorld = childLocal.clone().applyQuaternion(parentQ).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(dirWorld, down);
      // local rotation = parent^-1 * q * parent
      bone.quaternion.copy(parentQ.clone().invert().multiply(q).multiply(parentQ));
      void a;
    }
  }
  bones.pelvis.updateMatrixWorld(true);
  const pos = g.attributes.position, p = new THREE.Vector3(), acc = new THREE.Vector3(), t = new THREE.Vector3(), m = new THREE.Matrix4();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i); acc.set(0, 0, 0);
    for (let k = 0; k < 4; k++) {
      const w = sw[i * 4 + k] / 255; if (!w) continue;
      const bi = si[i * 4 + k];
      m.multiplyMatrices(list[bi].matrixWorld, inv[bi]);
      acc.addScaledVector(t.copy(p).applyMatrix4(m), w);
    }
    pos.setXYZ(i, acc.x, acc.y, acc.z);
  }
  // new joint positions = posed bone positions (tips follow their parent bone)
  const NJ = {};
  for (const name of ORDER) NJ[name] = V(0, 0, 0).applyMatrix4(bones[name].matrixWorld);
  for (const s of ['L', 'R']) {
    NJ['tip' + s] = J['tip' + s].clone().applyMatrix4(m.multiplyMatrices(bones['hand' + s].matrixWorld, inv[ORDER.indexOf('hand' + s)]));
    NJ['toe' + s] = J['toe' + s];
  }
  for (const s of ['L', 'R']) for (const f of FINGERS) {
    const b = f + '3' + s; NJ[f + 'Tip' + s] = J[f + 'Tip' + s].clone().applyMatrix4(m.multiplyMatrices(bones[b].matrixWorld, inv[ORDER.indexOf(b)]));
  }
  NJ.top = J.top;
  NJ._handQ = { L: bones.handL.getWorldQuaternion(new THREE.Quaternion()), R: bones.handR.getWorldQuaternion(new THREE.Quaternion()) };
  return NJ;
}

function build() {
  const meshes = loadMeshes();
  const male = meshes[LM.male.mesh];
  male.computeBoundingBox();
  const k = MALE_HEIGHT / (male.boundingBox.max.y - male.boundingBox.min.y);
  const meta = { version: 2, bones: ORDER.map(n => [n, PARENT[n]]), models: {} };
  const chunks = []; let off = 0;
  const push = arr => { const u = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength); const o = off; chunks.push(u); off += u.byteLength; const pad = (4 - off % 4) % 4; if (pad) { chunks.push(new Uint8Array(pad)); off += pad; } return o; };
  for (const gender of ['female', 'male']) {
    const lm = LM[gender], g = meshes[lm.mesh];
    const J = placeJoints(g, lm);
    // centre on the pelvis in X/Z, feet on the ground, scale to metres
    g.computeBoundingBox();
    const shift = V(-J.pelvis.x, -g.boundingBox.min.y, -J.pelvis.z);
    g.translate(shift.x, shift.y, shift.z); g.scale(k, k, k);
    for (const key in J) J[key].add(shift).multiplyScalar(k);
    g.computeBoundingBox();
    const H = g.boundingBox.max.y - g.boundingBox.min.y;
    const { si, sw } = computeWeights(g, J, H);
    const NJ = bakeArmsDown(g, J, si, sw);
    g.computeBoundingBox();
    const bb = g.boundingBox, pos = g.attributes.position, n = pos.count;
    const size = bb.getSize(V()), q = new Uint16Array(n * 3);
    for (let i = 0; i < n; i++) {
      q[i * 3] = Math.round((pos.getX(i) - bb.min.x) / size.x * 65535);
      q[i * 3 + 1] = Math.round((pos.getY(i) - bb.min.y) / size.y * 65535);
      q[i * 3 + 2] = Math.round((pos.getZ(i) - bb.min.z) / size.z * 65535);
    }
    const index = n > 65535 ? Uint32Array.from(g.index.array) : Uint16Array.from(g.index.array);
    const r6 = v => Math.round(v * 1e5) / 1e5;
    // bend axis of each finger (local = rest space): turns the finger towards the palm with a positive angle
    const bend = {};
    for (const [s, sx] of [['L', 1], ['R', -1]]) {
      const palm = V(-sx, 0, 0).applyQuaternion(NJ._handQ[s]);
      for (const f of FINGERS) {
        const d = NJ[f + 'Tip' + s].clone().sub(NJ[f + '1' + s]).normalize();
        let to = palm.clone();
        if (f === 'thumb') to = NJ['middle1' + s].clone().sub(NJ['thumb1' + s]);
        to.addScaledVector(d, -to.dot(d)).normalize();
        const axis = d.clone().cross(to).normalize();
        bend[f + s] = axis.toArray().map(r6);
      }
    }
    meta.models[gender] = {
      vertices: n, triangles: index.length / 3, index32: n > 65535,
      min: bb.min.toArray().map(r6), size: size.toArray().map(r6), height: r6(H),
      joints: Object.fromEntries(ORDER.map(b => [b, NJ[b].toArray().map(r6)])), bend,
      tips: Object.fromEntries(['L', 'R'].flatMap(s => FINGERS.map(f => [f + s, NJ[f + 'Tip' + s].toArray().map(r6)]))),
      pos: push(q), skinIndex: push(si), skinWeight: push(sw), index: push(index)
    };
    console.log(gender, 'vertices', n, 'triangles', index.length / 3, 'height', H.toFixed(3) + ' m');
  }
  const bin = Buffer.concat(chunks.map(c => Buffer.from(c)));
  const js = '/* Generated by tools/build_models.mjs from assets/HumanLowPolyBaseMesh.fbx. Do not edit. */\n' +
    'var SF_MODELS = ' + JSON.stringify(meta) + ';\nSF_MODELS.data = "' + bin.toString('base64') + '";\n';
  fs.writeFileSync(OUT, js);
  console.log('wrote', path.relative(ROOT, OUT), (js.length / 1024).toFixed(0) + ' KB');
}
build();
