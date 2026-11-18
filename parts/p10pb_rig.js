/* ---------- Rigging: bone rig (layer parenting) and puppet warp ----------
   Bone rig (Animate-style cut-out animation): each body part is a layer; a layer can follow a parent layer
   (l.parent). Its pivot is the joint. Moving / rotating / scaling a parent with the Move tool carries every
   child with it, on keyframes and through motion tweens (layerMat in p02 composes the matrices). */

function rigDescendants(l) {
  const out = new Set(), walk = p => { for (const c of state.layers) if (c.parent === p.id && !out.has(c)) { out.add(c); walk(c); } };
  walk(l); return out;
}
function setParentDialog() {
  const l = activeLayer(); if (!l) return;
  const bad = rigDescendants(l);
  const opts = [['', '— none (free layer) —']].concat(state.layers.filter(x => x !== l && !bad.has(x) && !x.paper && !x.vref).reverse().map(x => [String(x.id), x.name]));
  proDialog(`Bone rig: parent of "${l.name}"`, [{ k: 'parent', label: 'Follows', type: 'select', val: String(l.parent || ''), options: opts }], p => {
    const pid = p.parent ? +p.parent : null;
    timelineOp(() => { setLayerParent(l, pid); });
    toast(pid ? `"${l.name}" now follows "${layerParent(l).name}". Alt+drag its orange dot (Move tool) onto the joint.` : `"${l.name}" is free again`, 6000);
  }, 'Set');
}
/* Re-parent without the picture jumping: every keyframe keeps its on-screen placement. */
function setLayerParent(l, pid) {
  const I = [1, 0, 0, 1, 0, 0], keys = [...l.cels.keys()];
  const before = new Map(keys.map(k => [k, layerMat(l, k) || I]));
  l.parent = pid;
  const par = layerParent(l);
  for (const k of keys) {
    const inv = invMat(par ? layerMat(par, k) || I : I); if (!inv) continue;
    rigDecompose(mulMat(inv, before.get(k)), ensureXf(l.cels.get(k)), l);
  }
}
/* matrix → x, y, rot, sx, sy (around the layer pivot) */
function rigDecompose(m, x, l) {
  const [px, py] = pivotOf(l);
  const sx = Math.hypot(m[0], m[1]) || 1, rot = Math.atan2(m[1], m[0]) / DEG, det = m[0] * m[3] - m[1] * m[2], sy = det / sx;
  x.rot = rot; x.sx = sx; x.sy = sy;
  const base = matFrom({ x: 0, y: 0, rot, sx, sy }, px, py);
  x.x = m[4] - base[4]; x.y = m[5] - base[5];
}
function drawBones(g, S) {
  const rigged = state.layers.filter(l => l.visible && layerParent(l));
  if (!rigged.length) return;
  const act = activeLayer(), chain = new Set(); for (let l = act; l; l = layerParent(l)) { chain.add(l); if (chain.size > 20) break; }
  const joint = l => { const m = layerMat(l, state.frame) || [1, 0, 0, 1, 0, 0], [px, py] = pivotOf(l); return S(...applyMat(m, px, py)); };
  g.save();
  for (const l of rigged) {
    const a = joint(layerParent(l)), b = joint(l), on = chain.has(l);
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), len = Math.hypot(b[0] - a[0], b[1] - a[1]), w = Math.min(9, Math.max(4, len * 0.09));
    g.fillStyle = on ? 'rgba(255,170,60,.55)' : 'rgba(120,200,255,.35)'; g.strokeStyle = on ? '#ffaa3c' : '#78c8ff'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(a[0], a[1]);
    g.lineTo(a[0] + Math.cos(ang + 1.2) * w, a[1] + Math.sin(ang + 1.2) * w); g.lineTo(b[0], b[1]);
    g.lineTo(a[0] + Math.cos(ang - 1.2) * w, a[1] + Math.sin(ang - 1.2) * w); g.closePath(); g.fill(); g.stroke();
    for (const p of [a, b]) { g.beginPath(); g.arc(p[0], p[1], 4, 0, 7); g.fillStyle = '#fff'; g.fill(); g.stroke(); }
  }
  g.restore();
}
function rigHelp() {
  let d = $('#rigHelp');
  if (!d) {
    d = document.createElement('dialog'); d.id = 'rigHelp'; d.className = 'csdlg';
    d.innerHTML = `<form method="dialog"><h5>Rigging a character</h5><div class="small" style="line-height:1.55">
      <p><b>Bone rig (cut-out animation)</b></p>
      <ol style="margin:0 0 8px 18px;padding:0"><li>Draw each body part on its own layer (body, upper arm, forearm, hand…).</li>
      <li>Select a part and use <i>Layer › Bone rig: set parent…</i> — forearm follows upper arm, upper arm follows body…</li>
      <li>With the <i>Move</i> tool, <b>Alt+drag the orange dot</b> of each part onto its joint (shoulder, elbow…).</li>
      <li>Rotate parts with the Move tool's round handle. Children follow. Make keyframes and press <b>Tween</b>: the whole limb animates.</li></ol>
      <p><b>Puppet warp (bend one drawing)</b></p>
      <ol style="margin:0 0 8px 18px;padding:0"><li>Choose the <i>Puppet warp</i> sub-tool (Move group) and click on the drawing to place pins (shoulder, elbow, wrist…).</li>
      <li>Drag a pin: the drawing bends smoothly around the other pins. Keep a pin still to hold that part in place.</li>
      <li>Pose it on two keyframes, then <i>Animation › Puppet: create in-betweens</i> fills the frames between.</li></ol></div>
      <div class="dialog-actions"><button value="ok" class="primary">OK</button></div></form>`;
    document.body.appendChild(d);
  }
  d.showModal();
}
function installRig() {
  Object.assign(CMD, { rigParent: setParentDialog, rigFree: () => { const l = activeLayer(); if (l && l.parent) timelineOp(() => setLayerParent(l, null)); }, rigHelp });
  const LY = MENUS.find(m => m[0] === 'Layer')[1];
  LY.push('-', ['Bone rig: set parent…', 'rigParent'], ['Bone rig: free this layer', 'rigFree'], ['How to rig a character…', 'rigHelp']);
  const AN = MENUS.find(m => m[0] === 'Animation')[1];
  AN.push('-', ['How to rig a character…', 'rigHelp']);
}
