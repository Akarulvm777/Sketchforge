/* ---------- Bone tool: rig a character by clicking ----------
   Its own tool group (after the Shading pens), two sub tools:
   - Bone: link parts. Click a part (the child), then click the part it should follow (the parent): they are linked and
     the joint is put where the two parts touch. Or drag from a part straight onto its parent (the joint goes where you
     pressed). Drag any joint dot to move it. Alt+click a part frees it. Esc cancels.
   - Bone: pose. Drag a part to turn it around its joint; everything attached follows. A part with no parent moves.
     Shift+drag moves any part. On the timeline it makes a keyframe on this frame, ready for tweens.
   Uses the bone rig of p10pb_rig (layer parents + pivots).                                                         */
const BONE = { child: null, hover: null };
const I6 = [1, 0, 0, 1, 0, 0];
const rigCandidates = () => state.layers.filter(l => l.visible && !l.paper && !l.vref && !l.isMask);
/* the topmost part with ink under a document point (transforms included) */
function partAt(x, y) {
  for (let i = state.layers.length - 1; i >= 0; i--) {
    const l = state.layers[i]; if (!l.visible || l.paper || l.vref) continue;
    const k = keyAt(l, state.frame); if (k === null) continue;
    const c = l.cels.get(k), m = layerMat(l, state.frame), inv = m ? invMat(m) : I6; if (!inv) continue;
    const [lx, ly] = applyMat(inv, x, y);
    if (lx < 0 || ly < 0 || lx >= c.width || ly >= c.height) continue;
    // a little tolerance: thin lines are easy to miss
    const r = Math.max(1, Math.round(3 / view.scale)), d = c.getContext('2d').getImageData(Math.max(0, Math.round(lx) - r), Math.max(0, Math.round(ly) - r), 2 * r + 1, 2 * r + 1).data;
    for (let j = 3; j < d.length; j += 4) if (d[j] > 40) return l;
  }
  return null;
}
const jointDoc = l => { const m = layerMat(l, state.frame) || I6, [px, py] = pivotOf(l); return applyMat(m, px, py); };
/* change a part's joint (pivot) without the picture moving: every keyframe keeps its on-screen placement */
function setJointKeep(l, dx, dy) {
  const inv = invMat(layerMat(l, state.frame) || I6) || I6, [lx, ly] = applyMat(inv, dx, dy);
  const keys = [...l.cels.keys()], before = new Map(keys.map(k => [k, layerMat(l, k)]));
  l.px = lx; l.py = ly;
  const par = layerParent(l);
  for (const k of keys) {
    const b = before.get(k); if (!b) continue;
    const pinv = invMat(par ? layerMat(par, k) || I6 : I6); if (!pinv) continue;
    rigDecompose(mulMat(pinv, b), ensureXf(l.cels.get(k)), l);
  }
}
/* where two parts touch: the middle of the child's pixels that are next to the parent's pixels */
function autoJoint(child, parent) {
  const W = state.w, H = state.h, k = Math.min(1, 256 / Math.max(W, H)), w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(H * k));
  const mask = l => { const c = makeCanvas(w, h), g = c.getContext('2d'), cel = celCanvas(l, state.frame); if (!cel) return new Uint8Array(w * h);
    const m = layerMat(l, state.frame) || I6; g.setTransform(m[0] * k, m[1] * k, m[2] * k, m[3] * k, m[4] * k, m[5] * k); g.drawImage(cel, 0, 0);
    const d = g.getImageData(0, 0, w, h).data, o = new Uint8Array(w * h); for (let i = 0; i < o.length; i++) o[i] = d[i * 4 + 3] > 40 ? 1 : 0; return o; };
  const A = mask(child), B = mask(parent), R = 3;
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!A[y * w + x]) continue;
    let near = false;
    for (let dy = -R; dy <= R && !near; dy++) for (let dx = -R; dx <= R; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h && B[Y * w + X]) { near = true; break; } }
    if (near) { sx += x; sy += y; n++; }
  }
  if (n) return [(sx / n + 0.5) / k, (sy / n + 0.5) / k];
  // not touching: the child's point closest to the parent's centre
  let bx = 0, by = 0, bn = 0; for (let i = 0; i < B.length; i++) if (B[i]) { bx += i % w; by += (i / w) | 0; bn++; }
  if (!bn) return null;
  bx /= bn; by /= bn; let best = Infinity, px = 0, py = 0;
  for (let i = 0; i < A.length; i++) if (A[i]) { const x = i % w, y = (i / w) | 0, d = (x - bx) ** 2 + (y - by) ** 2; if (d < best) { best = d; px = x; py = y; } }
  return best < Infinity ? [(px + 0.5) / k, (py + 0.5) / k] : null;
}
function boneLink(child, parent, joint) {
  if (!child || !parent || child === parent) return;
  if (rigDescendants(child).has(parent)) { toast(`"${parent.name}" already follows "${child.name}": choose another part`); return; }
  timelineOp(() => {
    setLayerParent(child, parent.id);
    const j = joint || autoJoint(child, parent);
    if (j) setJointKeep(child, j[0], j[1]);
  });
  state.activeId = child.id;
  toast(`"${child.name}" follows "${parent.name}" ✓ — drag the dot to move the joint`, 3500);
}
function boneUnlink(l) { if (!l || !l.parent) return; timelineOp(() => setLayerParent(l, null)); toast(`"${l.name}" is free`); }
const jointHit = (x, y) => { // a joint dot near the pointer (screen distance)
  let best = null, bd = 12;
  for (const l of rigCandidates()) {
    if (!layerParent(l) && !state.layers.some(c => c.parent === l.id) && l !== BONE.child) continue;
    const [jx, jy] = jointDoc(l), s = docToScreen(jx, jy), t = docToScreen(x, y), d = Math.hypot(s[0] - t[0], s[1] - t[1]);
    if (d < bd) { bd = d; best = l; }
  }
  return best;
};
const BONE_LINK = {
  name: 'Bone: link parts', kind: 'dragdraw', icon: 'bone',
  ddDown(o) {
    o.before = snapshotTimeline();
    o.joint = jointHit(o.x0, o.y0);
    if (o.joint) { state.activeId = o.joint.id; return; }
    o.part = partAt(o.x0, o.y0);
  },
  ddMove(o) {
    if (o.joint) { setJointKeep(o.joint, o.x1, o.y1); o.moved = true; refreshStage(); return; }
    BONE.hover = partAt(o.x1, o.y1);
  },
  ddEnd(o) {
    if (o.joint) { if (o.moved) { pushHistory(timelineEntry(o.before, snapshotTimeline())); markDirty(); } refreshAll(); return; }
    const end = partAt(o.x1, o.y1), drag = Math.hypot(o.x1 - o.x0, o.y1 - o.y0) * view.scale > 10;
    if (o.alt) { boneUnlink(o.part); BONE.child = null; refreshAll(); return; }
    if (drag && o.part && end && end !== o.part) { boneLink(o.part, end, [o.x0, o.y0]); BONE.child = null; refreshAll(); return; }
    if (!o.part) { BONE.child = null; drawOverlay(); renderBoneProps(); return; }
    if (!BONE.child || BONE.child === o.part) { BONE.child = BONE.child === o.part ? null : o.part; state.activeId = o.part.id; refreshAll(); renderBoneProps();
      if (BONE.child) toast(`"${o.part.name}" picked. Now click the part it should follow`, 3000); return; }
    boneLink(BONE.child, o.part); BONE.child = null; refreshAll(); renderBoneProps();
  },
  overlay: (g, S) => boneOverlay(g, S, true),
  props: body => boneProps(body, 'link')
};
const BONE_POSE = {
  name: 'Bone: pose', kind: 'dragdraw', icon: 'bonepose',
  ddDown(o) {
    const l = partAt(o.x0, o.y0); if (!l) return;
    if (l.locked) { toast('Layer is locked'); return; }
    o.part = l; state.activeId = l.id; o.before = snapshotTimeline();
    const c = ensureKeyHere(l) || l.cels.get(keyAt(l, state.frame)); o.x = ensureXf(c); o.start = { ...o.x };
    o.rotate = !o.shift && !!(layerParent(l) || l.px != null);
    const [jx, jy] = jointDoc(l); o.jx = jx; o.jy = jy; o.a0 = Math.atan2(o.y0 - jy, o.x0 - jx);
    const par = layerParent(l), pm = par ? layerMat(par, state.frame) : null; o.pinv = pm ? invMat(pm) : null;
    renderTimeline();
  },
  ddMove(o) {
    if (!o.part) return;
    if (o.rotate) { // follow the pointer continuously (no jump of 360° when it passes behind the joint)
      const a = Math.atan2(o.y1 - o.jy, o.x1 - o.jx); let step = a - (o.alast ?? o.a0); while (step > Math.PI) step -= 2 * Math.PI; while (step < -Math.PI) step += 2 * Math.PI;
      o.acc = (o.acc || 0) + step; o.alast = a; let d = o.acc / DEG; if (o.shift) d = Math.round(d / 15) * 15; o.x.rot = o.start.rot + d; }
    else { const P = o.pinv ? (x, y) => applyMat(o.pinv, x, y) : (x, y) => [x, y], a = P(o.x0, o.y0), b = P(o.x1, o.y1); o.x.x = o.start.x + b[0] - a[0]; o.x.y = o.start.y + b[1] - a[1]; }
    o.moved = true; refreshStage();
  },
  ddEnd(o) { if (o.part && o.moved) { pushHistory(timelineEntry(o.before, snapshotTimeline())); markDirty(); } refreshAll(); },
  overlay: (g, S) => boneOverlay(g, S, false),
  props: body => boneProps(body, 'pose')
};
function boneOverlay(g, S, link) {
  drawBones(g, S);
  g.save();
  // joints of every rigged part (and of the picked part)
  for (const l of rigCandidates()) {
    const rigged = layerParent(l) || state.layers.some(c => c.parent === l.id) || l === BONE.child; if (!rigged) continue;
    const [x, y] = jointDoc(l), p = S(x, y);
    g.beginPath(); g.arc(p[0], p[1], l.id === state.activeId ? 7 : 5.5, 0, 7);
    g.fillStyle = l.id === state.activeId ? '#ff8a3d' : '#ffffff'; g.strokeStyle = '#1b1d20'; g.lineWidth = 1.5; g.fill(); g.stroke();
  }
  const outline = (l, col) => { // dashed box around a part
    const cel = celCanvas(l, state.frame), b = cel && celBBox(cel); if (!b) return;
    const m = layerMat(l, state.frame) || I6, pts = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]].map(q => S(...applyMat(m, q[0], q[1])));
    g.setLineDash([6, 4]); g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.stroke(); g.setLineDash([]);
  };
  if (link && BONE.child) outline(BONE.child, '#ff8a3d');
  if (BONE.hover && BONE.hover !== BONE.child) outline(BONE.hover, link && BONE.child ? '#4dd28a' : '#78c8ff');
  g.restore();
}
function boneProps(body, mode) {
  const p = document.createElement('div'); p.className = 'small'; p.style.cssText = 'line-height:1.5;margin:2px 0 8px';
  p.innerHTML = mode === 'link'
    ? '<b>1.</b> Click a part (arm). <b>2.</b> Click the part it follows (shoulder). Done: the joint is where they touch.<br>Or drag from a part onto its parent. Drag a dot to move a joint. Alt+click frees a part.'
    : 'Drag a part to turn it around its joint: everything attached follows. Shift: steps of 15°, or move instead of turn. On the timeline each pose makes a keyframe.';
  body.appendChild(p);
  const st = document.createElement('div'); st.id = 'boneState'; st.className = 'small muted'; body.appendChild(st);
  const row = document.createElement('div'); row.className = 'btnrow';
  const btn = (t, fn) => { const b = document.createElement('button'); b.textContent = t; b.onclick = fn; row.appendChild(b); };
  if (mode === 'link') { btn('Free this part', () => boneUnlink(activeLayer())); btn('Remove all bones', () => { timelineOp(() => { for (const l of state.layers) if (l.parent) setLayerParent(l, null); }); BONE.child = null; toast('All parts are free'); }); }
  else btn('Reset this pose', () => { const l = activeLayer(); if (!l) return; timelineOp(() => { const c = l.cels.get(keyAt(l, state.frame)); if (c && c._xf) Object.assign(c._xf, { x: 0, y: 0, rot: 0, sx: 1, sy: 1 }); }); });
  btn('🦊 Practice', () => CMD.tut_fox && CMD.tut_fox());
  body.appendChild(row);
  renderBoneProps();
}
function renderBoneProps() {
  const st = $('#boneState'); if (!st) return;
  const n = state.layers.filter(l => l.parent).length;
  st.textContent = BONE.child ? `Picked: ${BONE.child.name} → click its parent part` : `${n} part${n === 1 ? '' : 's'} linked`;
}
function installBoneTool() {
  Object.assign(IC, {
    bone: '<circle cx="6" cy="6" r="2.6"/><circle cx="18" cy="18" r="2.6"/><path d="M8 8l8 8"/><path d="M6 3.4v-1M3.4 6h-1M18 20.6v1M20.6 18h1"/>',
    bonepose: '<circle cx="5" cy="19" r="2.4"/><path d="M6.7 17.3L12 12"/><circle cx="12" cy="12" r="2"/><path d="M13.6 10.6l4-5"/><path d="M15 4.5h3.5V8"/>'
  });
  TOOLDEF.bone = BONE_LINK; TOOLDEF.bonepose = BONE_POSE;
  settings.bone = {}; settings.bonepose = {};
  const at = GROUPS.findIndex(g => g.id === 'shade') + 1 || GROUPS.length;
  GROUPS.splice(at, 0, { id: 'bone', name: 'Bone (rig)', key: '', icon: 'bone', subs: ['bone', 'bonepose'] });
  CMD.boneTool = () => selectTool('bone'); CMD.bonePose = () => selectTool('bonepose');
  const LY = MENUS.find(m => m[0] === 'Layer')[1], i = LY.findIndex(x => Array.isArray(x) && x[1] === 'rigParent');
  if (i >= 0) LY.splice(i, 0, ['🦴 Bone tool: link parts by clicking', 'boneTool'], ['🦴 Bone tool: pose', 'bonePose']);
  // hover highlight while the Bone tool is out
  viewport.addEventListener('pointermove', e => {
    if (state.tool !== 'bone' && state.tool !== 'bonepose') { if (BONE.hover) { BONE.hover = null; } return; }
    if (active) return;
    const d = toDoc(e), h = partAt(d.x, d.y); if (h !== BONE.hover) { BONE.hover = h; drawOverlay(); }
    viewport.style.cursor = jointHit(d.x, d.y) ? 'move' : h ? 'pointer' : '';
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && BONE.child) { BONE.child = null; drawOverlay(); renderBoneProps(); } });
}
